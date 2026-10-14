// Headless proof (Dr. Mow's tools/sim-check.mjs idea): no browser, no three.js.
//   1. the controller: hop arc, curb step-up, ramp climb, the mezzanine as floor and ceiling, wall sliding,
//      a car can't spin on the spot, a cart can, ramp launch;
//   2. the level: every shelf slot, car spot and drop-off is reachable on the nav graphs;
//   3. whole matches of CPU dashers (the same controller and rules as a human) finish with a delivery, over
//      several seeds.
// Usage: node tools/sim-check.mjs [matches=6]
import { buildLevel, G, F2 } from '../js/level.js';
import { createWorld, groundAt } from '../js/world.js';
import { createBody, driveStep } from '../js/drive.js';
import { HANDLING, DT, MATCH } from '../js/tuning.js';
import { buildNav, findPath } from '../js/nav.js';
import { createMatch, matchStep, standings, bodyOf, accept, needs, bagCount } from '../js/match.js';
import { createBrain, think, pickOrders } from '../js/ai.js';
import { COMBAT } from '../js/tuning.js';

let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ok ' : 'FAIL '} ${msg}`); if (!cond) fails++; };
const t0 = performance.now();
const L = buildLevel(), W = createWorld(L);
const nav = { cart: buildNav(W, L, HANDLING.cart), car: buildNav(W, L, HANDLING.car) };
console.log(`level: ${L.plats.length} plats, ${L.posts.length} posts, ${L.slots.length} slots, ${L.addresses.length} addresses; nav ${nav.cart.nodes.length}/${nav.car.nodes.length} nodes (${(performance.now() - t0).toFixed(0)} ms)`);

// ---------------------------------------------------------------- 1. controller
const run = (B, ctl, secs, each) => { const ev = []; for (let t = 0; t < secs; t += DT) { driveStep(W, B, typeof ctl === 'function' ? ctl(t) : ctl, DT, ev); each?.(B, t); } return ev; };
{
  const B = createBody(HANDLING.cart, -6, G, -8, Math.PI); // front hall, facing north
  let apex = 0, first = true;
  run(B, (t) => ({ dir: null, jump: first && !(first = false) }), 1.2, (b) => { apex = Math.max(apex, b.y - G); });
  ok(Math.abs(apex - HANDLING.cart.JUMP_V ** 2 / (2 * HANDLING.cart.GRAVITY)) < 0.06, `cart hop apex ${apex.toFixed(2)} m`);
  ok(B.grounded && Math.abs(B.y - G) < 1e-6, 'lands back on the store floor');
}
{
  const R = createBody(HANDLING.cart, 0, 0, 46, Math.PI);  // on Maple St (road, y 0), facing the lot's 15 cm curb
  run(R, { dir: { x: 0, z: -1, mag: 1 } }, 1.5);
  ok(R.grounded && Math.abs(R.y - G) < 1e-6 && R.z < 42, `cart rolls up the curb (y ${R.y.toFixed(2)}, z ${R.z.toFixed(1)})`);
}
{
  // up the east travelator to the upper floor, then along it: the slab is the floor up there
  const B = createBody(HANDLING.cart, -6, G, -16, Math.PI / 2); // in the gap between the ramps, facing east
  run(B, (t) => ({ dir: t < 3.8 ? { x: 1, z: 0, mag: 1 } : { x: 0, z: -1, mag: 1 } }), 5);
  ok(Math.abs(B.y - F2) < 0.05, `cart climbs the east ramp to the upper floor (y ${B.y.toFixed(2)})`);
  const g = groundAt(W, -6, -25, 1);
  ok(Math.abs(g.h - G) < 1e-6, 'under the mezzanine the ground floor is still the floor');
  const C = createBody(HANDLING.cart, -6, G, -25, Math.PI);
  let peak = 0, first = true;
  run(C, () => ({ dir: null, jump: first && !(first = false) }), 1, (b) => { peak = Math.max(peak, b.y); });
  ok(peak + HANDLING.cart.HEIGHT < F2 - 0.4, 'a hop on the ground floor stays under the slab');
}
{
  // drive into the store's back wall at an angle: slides along it, never through
  const B = createBody(HANDLING.cart, -6, G, -37.5, Math.PI * 0.8);
  run(B, { dir: { x: Math.sin(Math.PI * 0.8), z: Math.cos(Math.PI * 0.8), mag: 1 } }, 2);
  ok(B.z > -39.5 + 0.3 && B.x > -6.5, `cart slides along the back wall (x ${B.x.toFixed(1)}, z ${B.z.toFixed(2)})`);
}
{
  const car = createBody(HANDLING.car, 0, 0, 150, 0), cart = createBody(HANDLING.cart, 0, 0, 150, 0);
  run(car, { dir: { x: 0, z: -1, mag: 1 } }, 0.5); run(cart, { dir: { x: 0, z: -1, mag: 1 } }, 0.5);
  ok(Math.abs(car.heading) < 1.2, `a car from rest can't spin on the spot (turned ${car.heading.toFixed(2)} rad in 0.5 s)`);
  ok(Math.abs(Math.abs(cart.heading) - Math.PI) < 0.3, `a cart pivots round (heading ${cart.heading.toFixed(2)})`);
  const fast = createBody(HANDLING.car, -150, 0, 50, Math.PI / 2);
  run(fast, { dir: { x: 1, z: 0, mag: 1 } }, 4);
  ok(fast.speed > HANDLING.car.CRUISE * 0.95, `car reaches top speed (${fast.speed.toFixed(1)} m/s)`);
}
{
  // the stunt lot: flat out off the kicker clears the gap
  const cx = 200, cz = 0;
  const B = createBody(HANDLING.car, cx - 80, 0, cz, Math.PI / 2);
  B.speed = HANDLING.car.CRUISE;
  let air = 0, maxX = 0;
  run(B, { dir: { x: 1, z: 0, mag: 1 } }, 6, (b) => { if (!b.grounded) air += DT; if (b.x > cx - 10 && b.x < cx + 6) maxX = Math.max(maxX, b.y); });
  ok(air > 0.25 && B.x > cx + 20, `car jumps the stunt-lot gap (air ${air.toFixed(2)} s, x ${(B.x - cx).toFixed(0)})`);
}

// ---------------------------------------------------------------- 2. reachability
{
  const start = L.starts[0];
  const slotFail = L.slots.filter((s) => !findPath(nav.cart, start, s.at)).length;
  ok(slotFail === 0, `every shelf slot reachable by cart (${L.slots.length})`);
  const carFail = L.carSpots.filter((c) => !findPath(nav.cart, start, c)).length;
  ok(carFail === 0, `every car spot reachable by cart (${L.carSpots.length})`);
  const dropFail = L.addresses.filter((a) => L.carSpots.some((c) => !findPath(nav.car, c, a))).length;
  ok(dropFail === 0, `every address reachable by car from every spot (${L.addresses.length})`);
}

// ---------------------------------------------------------------- 3. combat
{
  const M = createMatch(L, W, { seed: 42, humans: 0, cpus: 2 });
  M.phase = 'play';
  const [A, V] = M.dashers;
  const o = M.board[0];
  accept(M, A, 0); accept(M, V, 0);
  const id = o.items[0].id;
  V.bag[id] = 1; V.bag.extraThing = 0; delete V.bag.extraThing;
  Object.assign(A.cart, { x: -6, z: -8, heading: Math.PI, speed: 0, kx: 0, kz: 0 }); Object.assign(V.cart, { x: -6, z: -9.6, heading: 0, speed: 0, kx: 0, kz: 0 });
  matchStep(M, [{ dir: null, punch: true }, null]);
  const st = M.events.find((e) => e.type === 'steal');
  ok(st && A.bag[id] === 1 && !V.bag[id], `a punch steals an item you need from a rival's cart (${st?.item.name})`);
  M.events.length = 0;
  // the victim is guarded for a moment, then a rush into them spills their cart
  V.guardT = 0; V.stunT = 0; V.bag = { [o.items[1].id]: 2 };
  Object.assign(A.cart, { x: -6, z: -6, heading: Math.PI, speed: 0, kx: 0, kz: 0, vh: Math.PI }); Object.assign(V.cart, { x: -6, z: -10.5, heading: Math.PI / 2, vh: Math.PI / 2, speed: 0, kx: 0, kz: 0 });
  A.rushCD = 0;
  let spilled = null;
  for (let k = 0; k < 120 && !spilled; k++) { matchStep(M, [{ dir: null, rush: k === 0 }, null]); spilled = M.events.find((e) => e.type === 'hit'); M.events.length = 0; }
  ok(spilled && spilled.lost.length === COMBAT.SPILL_RUSH && M.loose.length === COMBAT.SPILL_RUSH && V.stunT > 0, `a rush knocks ${spilled?.lost.length} items loose and dazes the victim`);
  for (let k = 0; k < 240; k++) matchStep(M, [null, null]);
  ok(M.loose.every((l) => l.rest && Math.abs(l.y - G) < 0.05), 'spilled items land on the floor');
  // the victim (who needs them) picks one back up by rolling over it
  const l = M.loose.find((q) => needs(M, V)[q.id]);
  V.stunT = 0;
  Object.assign(V.cart, { x: l.x - 0.5, z: l.z, y: G, heading: Math.PI / 2, speed: 0 });
  const before = bagCount(V);
  for (let k = 0; k < 30; k++) matchStep(M, [null, null]);
  ok(bagCount(V) === before + 1, 'rolling over a spilled item you need grabs it');
}

// ---------------------------------------------------------------- 4. CPU matches
const games = Number(process.argv[2] || 6);
const times = [];
for (let g = 0; g < games; g++) {
  const seed = 1000 + g * 7919;
  const M = createMatch(L, W, { seed, humans: 0, cpus: 6 });
  const brains = M.dashers.map((d) => createBrain(M, d, 0.75 + 0.05 * d.i, seed));
  M.dashers.forEach((d, i) => pickOrders(M, d, brains[i]));
  const tg = performance.now();
  const n = { pick: 0, enter: 0, deliver: 0, poached: 0, steal: 0, hit: 0, exit: 0 };
  // a stall: a dasher with something to do who hasn't got 2.5 m from where they were, for a long while
  const seen = M.dashers.map(() => ({ x: 0, z: 0, t: 0 }));
  let stall = { t: 0 };
  while (M.phase !== 'over' && M.steps < (MATCH.LIMIT + MATCH.READY + 5) / DT) {
    matchStep(M, M.dashers.map((d, i) => think(M, d, brains[i], nav, DT)));
    for (const e of M.events) if (e.type in n) n[e.type]++;
    M.events.length = 0;
    if (M.steps % 60 === 0) M.dashers.forEach((d, i) => {
      const B = bodyOf(d), S = seen[i], busy = d.orders.length || d.mode === 'car';
      if (!busy || Math.hypot(B.x - S.x, B.z - S.z) > 2.5) Object.assign(S, { x: B.x, z: B.z, t: M.t });
      else if (M.t - S.t > stall.t) stall = { t: M.t - S.t, who: d.name, at: `${d.mode} (${B.x.toFixed(1)}, ${B.y.toFixed(1)}, ${B.z.toFixed(1)}) t=${M.t.toFixed(0)}` };
    });
  }
  const s = standings(M), w = M.winner;
  const zones = Object.entries(M.O.layout).map(([z, d]) => `${z}:${d}`).join(' ');
  console.log(`  match ${g} seed ${seed}: ${M.board.length} orders, layout ${zones}`);
  console.log(`     ${M.why} at ${M.t.toFixed(0)} s; ` + s.map((d) => `${d.name} $${d.earned} (${d.delivered})`).join(', ') + `; ` + Object.entries(n).map(([k, v]) => `${k} ${v}`).join(', ') + `; ${(performance.now() - tg).toFixed(0)} ms`);
  const done = M.board.filter((o) => o.status === 'done').length;
  ok(done >= Math.ceil(M.board.length * 0.75), `match ${g}: ${done}/${M.board.length} orders delivered`);
  ok(stall.t < 20, `match ${g}: nobody stalls (longest ${stall.t.toFixed(0)} s${stall.who ? `, ${stall.who} ${stall.at}` : ''})`);
  times.push(M.t);
}
if (times.length) console.log(`match lengths: ${times.map((t) => t.toFixed(0)).join(', ')} s`);
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
