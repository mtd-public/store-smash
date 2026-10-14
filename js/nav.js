// Navigation: a graph sampled straight off the collision world, one per body profile (a cart fits between the
// bollards and down an aisle; a car doesn't), and A* over it. The CPU dashers drive along these paths through
// the same controller the player uses, and the player's GPS line is the same search.
//
// Nodes: every walkable surface (a plat with `floor`, or the road) at each sample point of the level's
// navRegions, where the body would fit (no wall within its margin, no ceiling over its head) — so both floors of
// the store, the ramps, both garage levels and the streets all fall out of one loop. Links: neighbours whose
// straight line js/world.js walkable() can drive.
import { platsNear, contains, heightAt, wallAt, ceilingAt, walkable, FLOOR } from './world.js';

const BUCKET = 10;

export function buildNav(W, L, H) {
  const nodes = [];
  const surfacesAt = (x, z) => {
    const out = [0];
    for (const p of platsNear(W, x, z)) if (p.floor && contains(p, x, z)) out.push(heightAt(p, x, z));
    return out;
  };
  const fits = (x, z, h) => {
    for (const p of platsNear(W, x, z)) { // (inside something: under a block's slab, in a shelf)
      if (!contains(p, x, z)) continue;
      const top = heightAt(p, x, z);
      if (top > h + 0.02 && p.bot < h + H.HEIGHT - 0.02) return false;
    }
    if (wallAt(W, x, z, h, H.WALL_MARGIN + 0.1, H.STEP, H.HEIGHT)) return false;
    return ceilingAt(W, x, z, h + 0.05) >= h + H.HEIGHT;
  };
  for (const R of L.navRegions) {
    for (let x = R.x0; x <= R.x1 + 1e-6; x += R.step) for (let z = R.z0; z <= R.z1 + 1e-6; z += R.step) {
      if (R.skip && x > R.skip.x0 && x < R.skip.x1 && z > R.skip.z0 && z < R.skip.z1) continue;
      const seen = [];
      for (const h of surfacesAt(x, z)) {
        if (seen.some((s) => Math.abs(s - h) < 0.3) || !fits(x, z, h)) continue;
        seen.push(h);
        nodes.push({ x, y: h, z, step: R.step, links: [] });
      }
    }
  }
  const N = { nodes, H, buckets: new Map(), W };
  nodes.forEach((n, i) => { n.i = i; bucketAdd(N, n); });
  // links: neighbours within 1.5 grid steps (diagonals), drivable both ways
  for (const a of nodes) {
    for (const b of near(N, a.x, a.z, Math.max(a.step, 2) * 1.5 + 0.01)) {
      if (b.i <= a.i || Math.abs(b.y - a.y) > 2.5) continue;
      const d = Math.hypot(b.x - a.x, b.z - a.z), lim = Math.max(a.step, b.step) * 1.5 + 0.01;
      if (d > lim || d < 1e-6) continue;
      if (!walkable(W, H, a.x, a.z, a.y, b.x, b.z, b.y) || !walkable(W, H, b.x, b.z, b.y, a.x, a.z, a.y)) continue;
      const cost = Math.hypot(d, b.y - a.y);
      a.links.push([b.i, cost]); b.links.push([a.i, cost]);
    }
  }
  // keep only the biggest connected piece (stray nodes in a sealed pocket would strand a path)
  const comp = new Int32Array(nodes.length).fill(-1);
  let best = -1, bestN = 0;
  for (let s = 0, c = 0; s < nodes.length; s++) {
    if (comp[s] >= 0) continue;
    let n = 0; const st = [s]; comp[s] = c;
    while (st.length) { const i = st.pop(); n++; for (const [j] of nodes[i].links) if (comp[j] < 0) { comp[j] = c; st.push(j); } }
    if (n > bestN) { bestN = n; best = c; }
    c++;
  }
  for (const n of nodes) n.dead = comp[n.i] !== best;
  return N;
}

function bucketAdd(N, n) {
  const k = Math.floor(n.x / BUCKET) * 8192 + Math.floor(n.z / BUCKET);
  let a = N.buckets.get(k);
  if (!a) N.buckets.set(k, (a = []));
  a.push(n);
}
function near(N, x, z, r) {
  const out = [];
  for (let i = Math.floor((x - r) / BUCKET); i <= Math.floor((x + r) / BUCKET); i++)
    for (let k = Math.floor((z - r) / BUCKET); k <= Math.floor((z + r) / BUCKET); k++) {
      const a = N.buckets.get(i * 8192 + k);
      if (a) for (const n of a) if (Math.abs(n.x - x) <= r && Math.abs(n.z - z) <= r) out.push(n);
    }
  return out;
}

// The best node to start from / end at for a point: close, about the same height, and reachable in a line.
export function nearestNode(N, x, y, z, maxR = 28) {
  let best = null, bd = Infinity;
  for (let r = 3.5; r <= maxR && !best; r *= 2) {
    const cand = near(N, x, z, r).filter((n) => !n.dead && Math.abs(n.y - y) < 1.4).map((n) => [n, Math.hypot(n.x - x, n.z - z) + Math.abs(n.y - y) * 3]).sort((a, b) => a[1] - b[1]);
    for (const [n, d] of cand.slice(0, 14)) if (d < bd && walkable(N.W, N.H, x, z, y, n.x, n.z, n.y, { margin: N.H.WALL_MARGIN * 0.6 })) { best = n; bd = d; break; }
    if (!best && cand.length && r * 2 > maxR) best = cand[0][0]; // (nothing in a clean line: take the closest anyway)
  }
  return best;
}

// A* from a point to a point. Returns [{ x, y, z }, …] ending at the target, or null.
export function findPath(N, from, to) {
  const s = nearestNode(N, from.x, from.y, from.z), g = nearestNode(N, to.x, to.y, to.z);
  if (!s || !g) return null;
  const nodes = N.nodes, n = nodes.length;
  const gs = new Float64Array(n).fill(Infinity), came = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
  const heap = new Heap();
  const h = (i) => Math.hypot(nodes[i].x - g.x, nodes[i].z - g.z) + Math.abs(nodes[i].y - g.y);
  gs[s.i] = 0; heap.push(s.i, h(s.i));
  while (heap.size) {
    const i = heap.pop();
    if (i === g.i) break;
    if (closed[i]) continue;
    closed[i] = 1;
    for (const [j, c] of nodes[i].links) {
      const t = gs[i] + c;
      if (t < gs[j]) { gs[j] = t; came[j] = i; heap.push(j, t + h(j)); }
    }
  }
  if (gs[g.i] === Infinity) return null;
  const out = [{ x: to.x, y: to.y, z: to.z }];
  for (let i = g.i; i >= 0; i = came[i]) out.push(nodes[i]);
  out.reverse();
  out.cost = gs[g.i];
  return smoothPath(N, from, out);
}

// String pulling: skip ahead to the furthest point (within a few nodes) you can drive to in a straight line.
export function smoothPath(N, from, path) {
  const out = [];
  let cur = from, i = 0;
  while (i < path.length) {
    let j = Math.min(path.length - 1, i + 8);
    for (; j > i; j--) if (Math.abs(path[j].y - cur.y) < 0.4 && walkable(N.W, N.H, cur.x, cur.z, cur.y, path[j].x, path[j].z, null, { stepLen: 0.8 })) break;
    const p = path[j];
    out.push({ x: p.x, y: p.y, z: p.z });
    cur = p; i = j + 1;
  }
  out.cost = path.cost;
  return out;
}

// Single-source costs from a point to every node (one sweep answers "which item is nearest by path").
export function dijkstra(N, from) {
  const nodes = N.nodes, dist = new Float64Array(nodes.length).fill(Infinity);
  const s = nearestNode(N, from.x, from.y, from.z);
  if (!s) return dist;
  const heap = new Heap();
  dist[s.i] = Math.hypot(s.x - from.x, s.z - from.z); heap.push(s.i, dist[s.i]);
  const done = new Uint8Array(nodes.length);
  while (heap.size) {
    const i = heap.pop();
    if (done[i]) continue;
    done[i] = 1;
    for (const [j, c] of nodes[i].links) { const t = dist[i] + c; if (t < dist[j]) { dist[j] = t; heap.push(j, t); } }
  }
  return dist;
}

export function pathLength(from, path) {
  let d = 0, c = from;
  for (const p of path) { d += Math.hypot(p.x - c.x, p.z - c.z); c = p; }
  return d;
}

class Heap {
  constructor() { this.i = []; this.k = []; }
  get size() { return this.i.length; }
  push(i, k) {
    const I = this.i, K = this.k;
    let n = I.length; I.push(i); K.push(k);
    while (n > 0) { const p = (n - 1) >> 1; if (K[p] <= k) break; I[n] = I[p]; K[n] = K[p]; n = p; }
    I[n] = i; K[n] = k;
  }
  pop() {
    const I = this.i, K = this.k, top = I[0], li = I.pop(), lk = K.pop();
    if (I.length) {
      let n = 0;
      for (;;) {
        let c = 2 * n + 1;
        if (c >= I.length) break;
        if (c + 1 < I.length && K[c + 1] < K[c]) c++;
        if (K[c] >= lk) break;
        I[n] = I[c]; K[n] = K[c]; n = c;
      }
      I[n] = li; K[n] = lk;
    }
    return top;
  }
}
export { FLOOR };
