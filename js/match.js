// A dash match: the rules, with no three.js, DOM or audio (the headless proof runs whole matches of CPUs).
//
//   BOARD  the store opens with a fresh layout (departments shuffled between its aisles, floors and the outdoor
//          yard) and a board of orders. Each dasher stacks up to three; several dashers can chase the same one.
//   SHOP   on foot with a cart. Roll past a shelf slot holding something your orders need to grab it. Your list
//          tells you the department, not the aisle. SMASH a rival (a lunge with the cart): if they carry an item
//          you still need it lands in your cart; otherwise their items spill on the floor for anyone who needs
//          them. A car hitting a shopper spills a cart too.
//   CAR    with at least one order complete, touch your own car (outdoor lot, indoor garage, or the garage roof
//          over the skybridge) to jump in. Orders you hadn't finished go back on the board; your cart stays
//          behind — a prop anyone can smash.
//   DASH   drive each finished order to its drop-off. The first dasher to deliver an order gets its tip and
//          POACHES it from everyone else holding it. Out of orders? Park back at your spot to shop again.
//   END    when every order's delivered (or the clock runs out). Most tips wins.
//
// Every body steps through js/drive.js; dashers differ only by where their controls come from (keys / pad /
// touch for humans, js/ai.js for CPUs — a remote player would be one more control source).
import { createBody, driveStep, bumpBodies, circles, turnTo, penAt } from './drive.js';
import { HANDLING, MATCH, COMBAT, SLOWMO, CPU, DT } from './tuning.js';
import { makeOrders, PRODUCT } from './order.js';
import { groundAt, wallAt } from './world.js';
import { mulberry32, shuffle } from './utils.js';

export const HUMANS = [{ name: 'P1', color: 0xff6b35 }, { name: 'P2', color: 0x2fb7ff }];
export const CPUS = [
  { name: 'Dee', color: 0xa05cf0 },
  { name: 'Sal', color: 0x3fc46d },
  { name: 'Tam', color: 0xf2c14e },
  { name: 'Ray', color: 0xef476f },
  { name: 'Zoe', color: 0x1fb5a8 },
  { name: 'Max', color: 0x8d6e63 },
];

export function createMatch(L, W, { seed = (Math.random() * 2 ** 31) >>> 0, humans = 1, cpus = 3, orders = null } = {}) {
  const rng = mulberry32(seed ^ 0x5eed);
  const n = Math.min(6, humans + cpus);
  const O = makeOrders(L, seed, orders ?? MATCH.ORDERS(n));
  const spots = shuffle(L.carSpots.slice(), rng);
  const starts = shuffle(L.starts.slice(0, Math.max(n, 1)), rng);
  const cpuLooks = shuffle(CPUS.slice(), rng);
  const dashers = [];
  for (let i = 0; i < n; i++) {
    const human = i < humans, look = human ? HUMANS[i] : cpuLooks[i - humans];
    const s = starts[i], c = spots[i];
    dashers.push({
      i, human, cpu: !human, name: humans === 1 && human ? 'You' : look.name, color: look.color,
      mode: 'cart', bag: {}, orders: [], spot: c, ready: !human,
      cart: createBody(HANDLING.cart, s.x, s.y, s.z, s.heading),
      car: createBody(HANDLING.car, c.x, c.y, c.z, c.heading),
      earned: 0, delivered: 0, poached: 0, enterT: null, lastT: null,
      stunT: 0, guardT: 0, smashT: 0, smashCD: 0, smashHit: false, hunting: -1, style: SLOWMO.START, tricks: 0,
    });
  }
  return { L, W, seed, O, board: O.board, dashers, props: [], loose: [], rng, phase: humans ? 'board' : 'ready', boardT: MATCH.BOARD_TIME, t: 0, readyT: MATCH.READY, winner: null, events: [], steps: 0 };
}

export const bodyOf = (d) => (d.mode === 'cart' ? d.cart : d.car);
export const held = (M, d) => d.orders.map((i) => M.board[i]).filter((o) => o.status === 'open');
const count = (bag) => Object.values(bag).reduce((a, b) => a + b, 0);
export const bagCount = (d) => count(d.bag);

// What a dasher's orders still need, as id → count missing (the cart is shared between their orders).
export function needs(M, d) {
  const req = {};
  for (const o of held(M, d)) for (const it of o.items) req[it.id] = (req[it.id] || 0) + 1;
  for (const id in req) { req[id] -= d.bag[id] || 0; if (req[id] <= 0) delete req[id]; }
  return req;
}
export const needCount = (M, d) => count(needs(M, d));
// Orders the cart covers in full, taken in the order they were accepted.
export function readyOrders(M, d) {
  const left = { ...d.bag }, out = [];
  for (const o of held(M, d)) if (o.items.every((it) => (left[it.id] || 0) > 0)) { for (const it of o.items) left[it.id]--; out.push(o); }
  return out;
}

// --- the board
export function accept(M, d, oi) {
  const o = M.board[oi];
  if (!o || o.status !== 'open' || d.orders.includes(oi) || d.orders.length >= MATCH.STACK || d.mode !== 'cart') return false;
  d.orders.push(oi);
  M.events.push({ type: 'accept', d, order: o });
  return true;
}
export function release(M, d, oi) {
  const k = d.orders.indexOf(oi);
  if (k < 0) return false;
  d.orders.splice(k, 1);
  return true;
}
export const toggle = (M, d, oi) => (d.orders.includes(oi) ? release(M, d, oi) : accept(M, d, oi));
export const openOrders = (M) => M.board.filter((o) => o.status === 'open');

// One fixed step (DT) of the whole match. ctls[i]: dasher i's controls (js/drive.js format + smash) or null.
export function matchStep(M, ctls) {
  const ev = M.events;
  M.steps++;
  if (M.phase === 'board') {
    if ((M.boardT -= DT) <= 0 || M.dashers.every((d) => d.ready)) { M.phase = 'ready'; ev.push({ type: 'countdown' }); }
    return;
  }
  if (M.phase === 'ready') {
    if ((M.readyT -= DT) <= 0) { M.phase = 'play'; ev.push({ type: 'go' }); }
    return;
  }
  if (M.phase !== 'play') return;
  M.t += DT;
  for (const d of M.dashers) dasherStep(M, d, ctls[d.i] || NO_CTL, ev);
  for (const p of M.props) driveStep(M.W, p, NO_CTL, DT, null); // abandoned carts coast and take shoves
  looseStep(M);
  collide(M, ev);
  if (M.board.every((o) => o.status !== 'open')) end(M, 'cleared');
  else if (M.t >= MATCH.LIMIT) end(M, 'time');
}
const NO_CTL = { dir: null };

function end(M, why) {
  M.phase = 'over'; M.why = why;
  for (const o of M.board) if (o.status === 'open') o.status = 'cancelled';
  const best = standings(M)[0];
  M.winner = best && best.earned > 0 ? best : null;
  M.events.push({ type: 'over', why, winner: M.winner });
}

function dasherStep(M, d, ctl, ev) {
  const L = M.L, W = M.W;
  const wasSmash = d.smashT > 0;
  for (const k of ['stunT', 'guardT', 'smashT', 'smashCD']) if (d[k] > 0) d[k] = Math.max(0, d[k] - DT);
  if (wasSmash && d.smashT <= 0 && !d.smashHit) ev.push({ type: 'swing', d }); // (a lunge that hit nobody)
  const B = bodyOf(d);
  B.pace = d.cpu ? (d.mode === 'car' ? CPU.PACE_CAR : CPU.PACE_CART) : 1; // (CPU dashers run a little slower)
  if (d.stunT > 0) { // dazed: the cart spins, no control
    turnTo(M.W, B, B.heading + 8 * Math.min(1, d.stunT) * DT);
    ctl = NO_CTL;
  }
  if (d.mode === 'cart') {
    if ((ctl.smash || ctl.rush || ctl.punch) && d.smashCD <= 0) { // SMASH: lunge (old rush / punch controls do the same)
      d.smashT = COMBAT.SMASH_TIME; d.smashCD = COMBAT.SMASH_CD; d.smashHit = false;
      B.speed = Math.max(B.speed, B.H.CRUISE * 1.4);
      ev.push({ type: 'smash', d });
    }
    if (d.smashT > 0 && !d.smashHit) smashReach(M, d, ev); // (someone right in front of the cart: it lands now)
    if (d.smashT > 0) { // the lunge: full speed ahead (you can still lean it a little)
      B.boost = COMBAT.SMASH_BOOST;
      const f = ctl.dir?.mag > 0.2 ? ctl.dir : { x: Math.sin(B.heading), z: Math.cos(B.heading) };
      ctl = { ...ctl, dir: { x: f.x, z: f.z, mag: 1 } };
    } else B.boost = 1;
  }
  const evd = [];
  driveStep(W, B, ctl, DT, evd);
  for (const e of evd) { ev.push(e); trick(M, d, e, ev); }
  if (B.grind) d.style = Math.min(SLOWMO.MAX, d.style + SLOWMO.GRIND * DT);
  if (d.mode === 'cart') {
    const fx = B.x + Math.sin(B.heading) * 0.5, fz = B.z + Math.cos(B.heading) * 0.5;
    const need = needs(M, d);
    // grab: the cart rolls past a slot holding something your orders still need (you take as many as you need)
    if (Object.keys(need).length) for (let k = 0; k < L.slots.length; k++) {
      const id = M.O.stock[k];
      if (!id || !need[id]) continue;
      const s = L.slots[k];
      if (Math.abs(s.at.y - B.y) > 1.2 || Math.hypot(s.at.x - fx, s.at.z - fz) > B.H.PICK_R) continue;
      d.bag[id] = (d.bag[id] || 0) + need[id];
      ev.push({ type: 'pick', d, id, slot: k, n: need[id], item: PRODUCT[id], left: needCount(M, d) });
      delete need[id];
    }
    // spilled stuff on the floor
    for (let k = M.loose.length - 1; k >= 0; k--) {
      const l = M.loose[k];
      if (!need[l.id] || M.t - l.t0 < COMBAT.LOOSE_WAIT * (l.from === d.i ? 2 : 1) || Math.abs(l.y - B.y) > 1.4) continue;
      if (Math.hypot(l.x - fx, l.z - fz) > B.H.PICK_R) continue;
      d.bag[l.id] = (d.bag[l.id] || 0) + 1; need[l.id]--;
      M.loose.splice(k, 1);
      ev.push({ type: 'pick', d, id: l.id, loose: l, n: 1, item: PRODUCT[l.id], left: needCount(M, d) });
    }
    // jump in your car with at least one order ready to go
    const C = d.car;
    if (Math.abs(C.y - B.y) < 1.2 && Math.hypot(C.x - B.x, C.z - B.z) < MATCH.DOOR_R + 1.2 && d.stunT <= 0) {
      const ready = readyOrders(M, d);
      if (ready.length) {
        for (const o of held(M, d)) if (!ready.includes(o)) { release(M, d, o.i); ev.push({ type: 'dropOrder', d, order: o }); }
        d.mode = 'car'; d.enterT = M.t; C.speed = 0; d.smashT = 0; d.hunting = -1;
        B.abandoned = d.i; B.speed = 0; B.boost = 1; M.props.push(B);
        if (M.props.length > 10) M.props.shift();
        ev.push({ type: 'enter', d, orders: ready });
      }
    }
  } else {
    for (const o of readyOrders(M, d)) {
      const a = o.drop;
      if (Math.abs(a.y - B.y) > 2 || Math.hypot(a.x - B.x, a.z - B.z) > B.H.DROP_R) continue;
      for (const it of o.items) if (--d.bag[it.id] <= 0) delete d.bag[it.id];
      o.status = 'done'; o.by = d.i; o.doneT = M.t;
      d.earned += o.tip; d.delivered++; d.lastT = M.t;
      release(M, d, o.i);
      ev.push({ type: 'deliver', d, order: o });
      for (const r of M.dashers) if (r !== d && release(M, r, o.i)) { r.poached++; ev.push({ type: 'poached', d: r, by: d, order: o }); }
    }
    // nothing left to deliver: park back at your spot and you're on foot again, with a fresh cart
    if (!readyOrders(M, d).length && Math.abs(B.y - d.spot.y) < 1 && Math.hypot(B.x - d.spot.x, B.z - d.spot.z) < MATCH.PARK_R && Math.abs(B.speed) < 5) {
      for (const o of held(M, d)) release(M, d, o.i);
      // out of the driver's door (the left), or wherever round the car is clear: a wall, a parked car or a rival
      const s = Math.sin(B.heading), c = Math.cos(B.heading);
      const spots = [[2.4, 0], [-2.4, 0], [3.2, 0], [-3.2, 0], [0, -3.6], [0, 3.6], [2.4, -2], [-2.4, -2], [2.4, 2], [-2.4, 2]];
      const others = [...M.dashers.flatMap((o) => (o === d ? [] : [bodyOf(o), ...(o.mode === 'cart' ? [o.car] : [])])), ...M.props].flatMap((O) => circles(O));
      let at = null;
      for (const [l, f] of spots) {
        const x = B.x + c * l + s * f, z = B.z - s * l + c * f, probe = fresh(B, x, z);
        if (penAt(W, probe, x, z) > 0 || others.some(([ox, oz, r]) => Math.hypot(ox - x, oz - z) < r + 1)) continue;
        at = [x, z]; break;
      }
      const [x, z] = at || [B.x + c * 2.4, B.z - s * 2.4];
      d.cart = { ...d.cart, ...fresh(B, x, z) };
      d.mode = 'cart'; B.speed = 0; B.parked = true;
      ev.push({ type: 'exit', d });
    }
  }
}
function fresh(B, x, z) {
  const b = createBody(HANDLING.cart, x, B.y, z, B.heading);
  return { ...b, abandoned: undefined, boost: 1 };
}

// --- tricks: grinds, launches, big air, big drops. They fill the style meter (slow-mo) and pop a toast.
function trick(M, d, e, ev) {
  const add = (name, pts, sick = false) => { d.style = Math.min(SLOWMO.MAX, d.style + pts); d.tricks++; ev.push({ type: 'trick', d, name, sick }); };
  if (e.type === 'grindStart') add('GRIND!', 0.05, (e.B.airT ?? 0) > 0.25);
  else if (e.type === 'grindEnd' && e.time > 1.2) add(`${e.time.toFixed(1)}s GRIND`, 0.1);
  else if (e.type === 'launch' && e.vy > 7.5) add('LAUNCH!', 0.1, true);
  else if (e.type === 'land') {
    if (e.drop > 3) add('SICK DROP!', SLOWMO.DROP);
    else if (e.airT > 0.8) add('BIG AIR!', SLOWMO.AIR);
  }
}

// --- combat: one move, SMASH
// A rival right in front of your cart's nose while you lunge: it lands.
function smashReach(M, d, ev) {
  const A = d.cart, fx = A.x + Math.sin(A.heading) * 0.7, fz = A.z + Math.cos(A.heading) * 0.7;
  let best = null, bd = Infinity;
  for (const r of M.dashers) {
    if (r === d || r.mode !== 'cart' || r.guardT > 0 || Math.abs(r.cart.y - A.y) > 1.2) continue;
    const dist = Math.min(...circles(r.cart).map(([x, z]) => Math.hypot(x - fx, z - fz)));
    const ang = Math.abs(Math.atan2(Math.sin(Math.atan2(r.cart.x - A.x, r.cart.z - A.z) - A.heading), Math.cos(Math.atan2(r.cart.x - A.x, r.cart.z - A.z) - A.heading)));
    if (dist <= COMBAT.SMASH_REACH && ang <= COMBAT.SMASH_ARC && dist < bd) { best = r; bd = dist; }
  }
  if (best) land(M, d, best, ev);
}
// A smash lands: snatch an item you still need, or knock their cart's load all over the floor.
function land(M, d, v, ev) {
  if (v.guardT > 0 || v.mode !== 'cart') return false;
  d.smashHit = true; d.smashT = Math.min(d.smashT, 0.12); // (the lunge stops on impact)
  const A = d.cart, want = needs(M, d), steal = Object.keys(v.bag).find((id) => want[id]);
  if (steal) {
    if (--v.bag[steal] <= 0) delete v.bag[steal];
    d.bag[steal] = (d.bag[steal] || 0) + 1;
    v.stunT = Math.max(v.stunT, COMBAT.STUN_STEAL); v.guardT = COMBAT.GUARD;
    d.guardT = Math.max(d.guardT, COMBAT.GUARD_THIEF); // (a getaway: no instant steal-back)
    shove(v.cart, A, 5);
    d.style = Math.min(SLOWMO.MAX, d.style + SLOWMO.STEAL);
    ev.push({ type: 'steal', d, from: v, id: steal, item: PRODUCT[steal] });
    return true;
  }
  return hit(M, v, d, 'smash', ev);
}

function shove(V, A, v) {
  const dx = V.x - A.x, dz = V.z - A.z, l = Math.hypot(dx, dz) || 1;
  V.kx += (dx / l) * v; V.kz += (dz / l) * v;
}

// Knock items loose from a shopper's cart (a smash, a car).
export function hit(M, v, by, kind, ev = M.events) {
  if (v.mode !== 'cart' || v.guardT > 0) return false;
  const n = kind === 'car' ? COMBAT.SPILL_CAR : COMBAT.SPILL_SMASH;
  const pool = shuffle(Object.entries(v.bag).flatMap(([id, c]) => Array(c).fill(id)), M.rng);
  const lost = pool.slice(0, n);
  const V = v.cart;
  for (const id of lost) {
    if (--v.bag[id] <= 0) delete v.bag[id];
    const a = M.rng() * Math.PI * 2, sp = 2 + M.rng() * 2.5;
    M.loose.push({ id, x: V.x + Math.sin(V.heading) * 0.45, y: V.y + 1, z: V.z + Math.cos(V.heading) * 0.45, vx: Math.cos(a) * sp, vy: 4 + M.rng() * 2, vz: Math.sin(a) * sp, t0: M.t, from: v.i, rest: false });
  }
  v.stunT = Math.max(v.stunT, kind === 'car' ? COMBAT.STUN_CAR : COMBAT.STUN_SMASH);
  v.guardT = COMBAT.GUARD; v.smashT = 0;
  if (by) { shove(V, bodyOf(by), kind === 'car' ? 9 : 6.5); by.style = Math.min(SLOWMO.MAX, by.style + SLOWMO.SMASH); }
  V.grind = null;
  ev.push({ type: 'hit', d: v, by, kind, lost: lost.map((id) => PRODUCT[id]) });
  return true;
}

// Spilled items: a hop through the air, a bounce off walls, then they sit where they land.
function looseStep(M) {
  for (const l of M.loose) {
    if (l.rest) continue;
    l.vy -= 24 * DT;
    const nx = l.x + l.vx * DT, nz = l.z + l.vz * DT;
    if (wallAt(M.W, nx, nz, l.y, 0.15, 0.2, 0.3)) { l.vx *= -0.4; l.vz *= -0.4; } else { l.x = nx; l.z = nz; }
    l.y += l.vy * DT;
    const g = groundAt(M.W, l.x, l.z, l.y + 0.4);
    if (g && l.y <= g.h && l.vy <= 0) { l.y = g.h; l.vx *= 0.5; l.vz *= 0.5; l.vy = Math.abs(l.vy) > 3 ? -l.vy * 0.3 : 0; if (!l.vy) l.rest = true; }
    if (l.y < -20) { l.y = 0; l.rest = true; }
  }
}

// Everyone against everyone: moving bodies shove each other (by mass); parked cars don't budge. A lunge that
// connects lands a smash; a car hitting a shopper hard knocks items loose.
function collide(M, ev) {
  const live = M.dashers.map((d) => [bodyOf(d), d]), parked = M.dashers.filter((d) => d.mode === 'cart').map((d) => d.car);
  const all = [...live, ...M.props.map((p) => [p, null])];
  for (let a = 0; a < all.length; a++) {
    const [A, da] = all[a];
    for (let b = a + 1; b < all.length; b++) {
      const [B, db] = all[b];
      if (Math.abs(A.x - B.x) > 7 || Math.abs(A.z - B.z) > 7) continue;
      const v = bumpBodies(A, B, M.W);
      if (v <= 1) continue;
      ev.push({ type: 'bump', A, B, v });
      if (da && db) {
        if (da.mode === 'cart' && db.mode === 'cart') {
          if (da.smashT > 0 && !da.smashHit) land(M, da, db, ev);
          if (db.smashT > 0 && !db.smashHit) land(M, db, da, ev);
        } else if (da.mode === 'car' && db.mode === 'cart' && v > COMBAT.CAR_HIT) hit(M, db, da, 'car', ev);
        else if (db.mode === 'car' && da.mode === 'cart' && v > COMBAT.CAR_HIT) hit(M, da, db, 'car', ev);
      }
    }
    for (const C of parked) {
      if (Math.abs(A.x - C.x) > 7 || Math.abs(A.z - C.z) > 7) continue;
      const cx = C.x, cz = C.z, v = bumpBodies(A, C, M.W);
      C.x = cx; C.z = cz; C.kx = C.kz = 0;
      if (v > 2) ev.push({ type: 'bump', A, B: C, v });
    }
  }
}

// Standings: money first, then deliveries, then who's furthest along right now.
export function progress(M, d) {
  const B = bodyOf(d);
  let now = d.mode === 'car' ? 500 : bagCount(d) * 20;
  if (d.mode === 'car') { const r = readyOrders(M, d)[0]; if (r) now -= Math.hypot(r.drop.x - B.x, r.drop.z - B.z) / 10; }
  return d.earned * 10000 + d.delivered * 1000 + now - (d.lastT ?? 0) * 0.01;
}
export const standings = (M) => M.dashers.slice().sort((a, b) => progress(M, b) - progress(M, a));
