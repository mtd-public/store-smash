// CPU dashers. They shop and drive through the same controller as you (js/drive.js) with the same rules
// (js/match.js); all they get is a map (js/nav.js). Like Dr. Mow's autopilot they steer at a point a little way
// down a path, and they can be bumped off it, get stuck on a pillar, or take the long way round.
//
// Plan: stack 1–3 orders off the board (each CPU has a taste for it), then go for whatever is cheapest to reach:
// a shelf with something the orders need, a spilled item on the floor, or — for the pushy ones — a rival whose
// cart holds it (walk up and punch: a steal). Then the car, each drop-off, and back to park and shop again.
// On the way they barge and swing at rivals who wander into reach, more often the higher their aggression.
import { findPath, nearestNode, dijkstra } from './nav.js';
import { bodyOf, needs, held, readyOrders, accept, openOrders, bagCount } from './match.js';
import { mulberry32 } from './utils.js';
import { MATCH, COMBAT } from './tuning.js';
import { walkable } from './world.js';
import { circles } from './drive.js';

export function createBrain(M, d, skill = 0.85, seed = 1) {
  const rng = mulberry32(seed * 7919 + d.i * 31 + 7);
  return { skill, aggro: 0.25 + rng() * 0.7, stack: 1 + Math.floor(rng() * 3), rng, path: null, pi: 0, target: null, replanT: 0, retargetT: 0, stuckT: 0, lastX: null, lastZ: null, unstickT: 0, unstickDir: 1, pauseT: 0, sig: '', wiggle: 0, decideT: 0, mugT: 0, mugCD: 0, stealCD: 0 };
}

// Take orders off the board up to this CPU's appetite: the best tip for the trouble, with a little noise.
export function pickOrders(M, d, brain) {
  const want = Math.max(1, Math.min(MATCH.STACK, brain.stack));
  const open = openOrders(M).filter((o) => !d.orders.includes(o.i));
  const score = (o) => o.tip / (o.items.length * 14 + o.dist / 6) * (0.8 + brain.rng() * 0.4);
  for (const o of open.sort((a, b) => score(b) - score(a))) { if (d.orders.length >= want) break; accept(M, d, o.i); }
}

// The objective right now: { x, y, z, kind, id?, rival? }.
export function objective(M, d, nav, brain = null) {
  const B = bodyOf(d);
  if (d.mode === 'car') {
    const r = readyOrders(M, d).sort((a, b) => Math.hypot(a.drop.x - B.x, a.drop.z - B.z) - Math.hypot(b.drop.x - B.x, b.drop.z - B.z))[0];
    return r ? { ...r.drop, kind: 'drop', order: r } : { x: d.spot.x, y: d.spot.y, z: d.spot.z, kind: 'park' };
  }
  const need = needs(M, d);
  if (!Object.keys(need).length) return held(M, d).length ? { x: d.car.x, y: d.car.y, z: d.car.z, kind: 'car' } : null;
  const cost = dijkstra(nav.cart, B);
  const at = (x, y, z, cache) => { const n = cache ? (cache.node ??= nearestNode(nav.cart, x, y, z)) : nearestNode(nav.cart, x, y, z); return n ? cost[n.i] + Math.hypot(n.x - x, n.z - z) : Infinity; };
  const options = [];
  M.L.slots.forEach((s, k) => { const id = M.O.stock[k]; if (id && need[id]) options.push([at(s.at.x, s.at.y, s.at.z, s), { x: s.at.x, y: s.at.y, z: s.at.z, kind: 'item', id, slot: k }]); });
  for (const l of M.loose) if (need[l.id] && l.rest) options.push([at(l.x, l.y, l.z, l) * 0.9, { x: l.x, y: l.y, z: l.z, kind: 'loose', id: l.id, loose: l }]);
  options.sort((a, b) => a[0] - b[0]);
  // a mugging, for the pushy ones: only when a rival with the goods is far closer than any shelf (and not again
  // straight after the last one — or a crowd of CPUs would rob each other in circles forever)
  if (brain && brain.aggro > 0.55 && brain.mugCD <= 0) for (const r of M.dashers) {
    if (r === d || r.mode !== 'cart' || Math.abs(r.cart.y - B.y) > 1.2 || r.guardT > 0) continue;
    const id = Object.keys(r.bag).find((k) => need[k]);
    const dist = Math.hypot(r.cart.x - B.x, r.cart.z - B.z);
    if (id && dist < 10 && dist * 1.6 + 4 < (options[0]?.[0] ?? Infinity) * 0.5) { return { x: r.cart.x, y: r.cart.y, z: r.cart.z, kind: 'rival', id, rival: r }; }
  }
  if (!options.length) return null;
  if (brain && options.length > 1 && brain.rng() > brain.skill + 0.1) return options[Math.min(options.length - 1, 1 + Math.floor(brain.rng() * 3))][1]; // a sloppier choice
  return options[0][1];
}

// Wedged: probe 16 directions and take the one with the most clear floor ahead (ties go toward the target).
function escapeDir(M, d, B, T, rng) {
  let best = null, bs = -Infinity;
  const W = M.W, toT = Math.atan2(T.x - B.x, T.z - B.z), off = rng() * 0.4;
  const others = [...M.dashers.flatMap((o) => (o === d ? (d.mode === 'cart' ? [d.car] : []) : [bodyOf(o), ...(o.mode === 'cart' ? [o.car] : [])])), ...M.props].filter((O) => O !== B && Math.abs(O.y - B.y) < 1.5).flatMap((O) => circles(O));
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 + off, sx = Math.sin(a), sz = Math.cos(a);
    let free = 0;
    for (let r = 0.6; r <= 4.2; r += 0.6) {
      const px = B.x + sx * r, pz = B.z + sz * r;
      if (!walkable(W, B.H, B.x, B.z, B.y, px, pz, null, { margin: B.H.WALL_MARGIN * 0.8 }) || others.some(([cx, cz, cr]) => Math.hypot(cx - px, cz - pz) < cr + 0.6)) break;
      free = r;
    }
    const score = free + Math.cos(a - toT) * 0.8;
    if (score > bs) { bs = score; best = { x: sx, z: sz }; }
  }
  return best;
}

// Controls for one step. nav: { cart, car } graphs.
export function think(M, d, brain, nav, dt) {
  if (M.phase !== 'play') return { dir: null };
  const B = bodyOf(d), car = d.mode === 'car', N = car ? nav.car : nav.cart;
  brain.huntT = (brain.huntT || 0) - dt;
  d.hunting = brain.huntT > 0 ? brain.huntI : -1; // (who we've got our eye on: the HUD's hostile warning reads it)
  if (d.stunT > 0) { brain.path = null; return { dir: null }; }
  if (!car && !held(M, d).length && openOrders(M).length) pickOrders(M, d, brain);
  // the plan changes when the cart or the orders do
  const sig = `${d.mode}|${bagCount(d)}|${d.orders.join(',')}|${M.loose.length}`;
  if (sig !== brain.sig) {
    if (brain.sig && bagCount(d) > Number(brain.sig.split('|')[1])) brain.pauseT = (1 - brain.skill) * 1.4 * brain.rng(); // a look at the list
    brain.sig = sig; brain.target = null; brain.path = null;
  }
  if (brain.pauseT > 0) { brain.pauseT -= dt; return { dir: null }; }
  brain.mugCD -= dt; brain.stealCD -= dt;
  if (brain.target?.kind === 'rival' && (brain.mugT -= dt) <= 0) { brain.target = null; brain.mugCD = 10; } // (gave up the chase)
  if ((brain.retargetT -= dt) <= 0 && !car) { brain.retargetT = 2.5; brain.target = null; }
  if (!brain.target) {
    const was = brain.lastKind;
    brain.target = objective(M, d, nav, brain); brain.path = null;
    brain.lastKind = brain.target?.kind;
    if (brain.lastKind === 'rival' && was !== 'rival') brain.mugT = 4; // (a chase gets four seconds, retargets and all)
  }
  const T = brain.target;
  if (T?.kind === 'rival') d.hunting = T.rival.i;
  if (!T) return { dir: null };
  if (T.kind === 'rival') { T.x = T.rival.cart.x; T.y = T.rival.cart.y; T.z = T.rival.cart.z; if (T.rival.mode !== 'cart' || !T.rival.bag[T.id]) { brain.target = null; return { dir: null }; } }

  // combat, decided a few times a second
  let rush = false, punch = false;
  if (!car && (brain.decideT -= dt) <= 0) {
    brain.decideT = 0.15;
    const need = needs(M, d);
    for (const r of M.dashers) {
      if (r === d || r.mode !== 'cart' || r.guardT > 0 || Math.abs(r.cart.y - B.y) > 1.2) continue;
      const dx = r.cart.x - B.x, dz = r.cart.z - B.z, dist = Math.hypot(dx, dz);
      const ang = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - B.heading), Math.cos(Math.atan2(dx, dz) - B.heading)));
      const has = bagCount(r) > 0, mine = Object.keys(r.bag).some((k) => need[k]);
      if (dist < 6 && ang < 0.8 && (mine || (has && brain.aggro > 0.6))) { brain.huntI = r.i; brain.huntT = 0.6; d.hunting = r.i; } // (sizing them up)
      if (d.punchCD <= 0 && dist < COMBAT.PUNCH_REACH + 0.5 && ang < COMBAT.PUNCH_ARC * 0.9 && (mine ? brain.stealCD <= 0 && brain.rng() < 0.2 + brain.aggro * 0.5 : has && brain.rng() < brain.aggro * 0.06)) {
        punch = true; brain.huntI = r.i; brain.huntT = 0.6; d.hunting = r.i; if (mine) { brain.stealCD = 5; if (brain.target?.kind === 'rival') { brain.target = null; brain.mugCD = 10; } }
        break;
      }
      if (d.rushCD <= 0 && has && dist > 2.5 && dist < 7 && ang < 0.3 && brain.rng() < brain.aggro * 0.08) { rush = true; brain.huntI = r.i; brain.huntT = 0.8; d.hunting = r.i; break; }
    }
  }

  // a rival in reach of a straight line: just go at them
  if (T.kind === 'rival' && Math.hypot(T.x - B.x, T.z - B.z) < 7 && walkable(M.W, B.H, B.x, B.z, B.y, T.x, T.z, null, { stepLen: 0.8 })) {
    const dx = T.x - B.x, dz = T.z - B.z, l = Math.hypot(dx, dz) || 1;
    return { dir: { x: dx / l, z: dz / l, mag: 1 }, rush, punch };
  }
  if (!brain.path || (brain.replanT -= dt) <= 0) {
    brain.path = findPath(N, B, T) || [{ x: T.x, y: T.y, z: T.z }];
    brain.pi = 0; brain.replanT = T.kind === 'rival' ? 0.8 : car ? 2 : 3;
  }
  // stuck? (on a pillar, wedged against a parked car) — back off at an angle and hop, then replan
  brain.stuckT += dt;
  if (brain.stuckT > 1) {
    const moved = brain.lastX == null ? 9 : Math.hypot(B.x - brain.lastX, B.z - brain.lastZ);
    brain.lastX = B.x; brain.lastZ = B.z; brain.stuckT = 0;
    if (moved < (car ? 1.6 : 0.7) && !(T.kind === 'park' && Math.hypot(T.x - B.x, T.z - B.z) < MATCH.PARK_R)) {
      brain.wiggle++; brain.path = null;
      brain.unstickT = car ? 1.1 : 0.7; brain.unstickDir = brain.rng() < 0.5 ? -1 : 1;
      brain.escape = brain.wiggle > 1 ? escapeDir(M, d, B, T, brain.rng) : null; // (twice stuck: head for open floor)
    } else brain.wiggle = 0;
  }
  if (brain.unstickT > 0) {
    brain.unstickT -= dt;
    if (brain.escape) { // open floor behind you: back out toward it (a three-point turn); ahead: drive at it
      const off = Math.atan2(Math.sin(Math.atan2(brain.escape.x, brain.escape.z) - B.heading), Math.cos(Math.atan2(brain.escape.x, brain.escape.z) - B.heading));
      if (Math.abs(off) > 1.9) return { turn: off > 0 ? 1 : -1, throttle: -1 };
      return { dir: { ...brain.escape, mag: 1 }, jump: false };
    }
    return { turn: brain.unstickDir, throttle: -1, jump: brain.wiggle > 3 && brain.unstickT < 0.1 };
  }
  // follow: drop waypoints we've reached, aim a little way down the path
  const P = brain.path, reach = car ? 4.5 : 1.3;
  while (brain.pi < P.length - 1 && Math.hypot(P[brain.pi].x - B.x, P[brain.pi].z - B.z) < reach) brain.pi++;
  const aim = P[brain.pi];
  if (Math.hypot(aim.x - B.x, aim.z - B.z) > (car ? 14 : 6)) brain.replanT = Math.min(brain.replanT, 0.2); // knocked off the line
  let dx = aim.x - B.x, dz = aim.z - B.z;
  const dl = Math.hypot(dx, dz) || 1;
  dx /= dl; dz /= dl;
  let mag = 0.82 + 0.18 * brain.skill;
  const toEnd = Math.hypot(T.x - B.x, T.z - B.z);
  if (car) { // ease off for a sharp bend ahead, pull up gently at the drop, crawl into the parking spot
    const nxt = P[Math.min(P.length - 1, brain.pi + 1)];
    const a1 = Math.atan2(dx, dz), a2 = Math.atan2(nxt.x - aim.x, nxt.z - aim.z);
    const bend = Math.abs(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1)));
    if (bend > 0.9 && dl < B.speed * 0.9) mag = Math.min(mag, 0.35);
    if (T.kind === 'drop' && toEnd < 12) mag = Math.min(mag, 0.3 + toEnd / 20);
    if (T.kind === 'park' && toEnd < 16) mag = Math.min(mag, 0.15 + toEnd / 30);
    if (T.kind === 'park' && toEnd < MATCH.PARK_R - 1) return { dir: null };
  } else if (T.kind === 'car' && toEnd < MATCH.DOOR_R + 3) mag = 0.5;
  [dx, dz] = avoid(M, d, B, dx, dz, T);
  return { dir: { x: dx, z: dz, mag }, rush, punch };
}

// Local avoidance: the nav graph doesn't know where cars are parked or who's in the way, so lean away from any
// body a few metres ahead (parked cars, rivals, abandoned carts) — hard sideways when you're already touching
// one — but not from the car you're walking up to.
function avoid(M, d, B, dx, dz, T) {
  const look = B.H.name === 'car' ? 9 : 3.5, rb = B.H.name === 'car' ? 1.1 : 0.5;
  let ax = 0, az = 0;
  const bodies = [...M.dashers.flatMap((o) => (o === d ? (d.mode === 'cart' && T.kind !== 'car' ? [d.car] : []) : [bodyOf(o), ...(o.mode === 'cart' ? [o.car] : [])])), ...M.props];
  for (const O of bodies) {
    if (O === B || Math.abs(O.y - B.y) > 1.5 || Math.abs(O.x - B.x) > 12 || Math.abs(O.z - B.z) > 12) continue;
    for (const [cx, cz, cr] of circles(O)) {
      const ox = cx - B.x, oz = cz - B.z, dist = Math.hypot(ox, oz), R = cr + rb + 0.3;
      const along = ox * dx + oz * dz;
      if (along < -0.5 || along > look) continue;
      const side = ox * -dz + oz * dx;
      if (Math.abs(side) > R) continue;
      const k = Math.min(3, ((R - Math.abs(side)) / R) * (1.2 + 2 * Math.max(0, 1 - dist / (R + 1))));
      const s = side >= 0 ? -1 : 1; // steer to the other side of it
      ax += -dz * s * k; az += dx * s * k;
    }
  }
  const x = dx + ax, z = dz + az, l = Math.hypot(x, z) || 1;
  return [x / l, z / l];
}
