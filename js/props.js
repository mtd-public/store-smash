// City props, in the same flat-shaded toy style as js/models.js: street lamps, traffic lights, benches, bins,
// hydrants, planters, house yards (picket fences, flower boxes, bushes, mailboxes, gnomes), pitched roofs with
// chimneys, apartment balconies, rooftop kit (parapets, AC units, water tanks, helipads), the park (a rounded pond,
// paths, flower beds, a playground, picnic tables) and the stunt lot's cones, flags and tyre stacks. Each builder
// returns one vertex-coloured geometry in local space (+z is "front"); js/scene.js places and merges them.
import * as THREE from 'three';
import { part, merge, roundBox } from './models.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const CYL6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
const CONE = new THREE.ConeGeometry(0.5, 1, 10);
const SPH = new THREE.IcosahedronGeometry(0.5, 1);
const SPH0 = new THREE.IcosahedronGeometry(0.5, 0);
const TOR = new THREE.TorusGeometry(0.5, 0.18, 6, 14);
const POLE = 0x3b4a55, WOOD = 0xb07a4a, LEAF = 0x4caf50, LEAF2 = 0x6cc35a;

const cache = new Map();
const once = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };
const b = (c, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) => part(BOX, c, [x, y, z], [rx, ry, rz], [w, h, d]);

// ---------------------------------------------------------------- streets
export const streetLamp = () => once('lamp', () => merge([
  part(CYL6, POLE, [0, 0.15, 0], [0, 0, 0], [0.42, 0.3, 0.42]),
  part(CYL6, POLE, [0, 3, 0], [0, 0, 0], [0.18, 6, 0.18]),
  part(CYL6, POLE, [0, 5.9, 0.8], [Math.PI / 2, 0, 0], [0.1, 1.6, 0.1]),
  part(roundBox(0.5, 0.22, 0.8, 0.08), POLE, [0, 5.85, 1.55]),
  b(0xfff3c4, 0, 5.72, 1.55, 0.36, 0.04, 0.6),
  part(SPH0, 0xe8c070, [0, 6.1, 0], [0, 0, 0], [0.22, 0.22, 0.22]),
]));
export const signal = () => once('signal', () => {
  const out = [part(CYL6, 0x2b2f38, [0, 2.3, 0], [0, 0, 0], [0.16, 4.6, 0.16]), part(CYL6, 0x2b2f38, [0, 4.45, 1.1], [Math.PI / 2, 0, 0], [0.1, 2.2, 0.1]), b(0xf2c14e, 0, 1.1, 0.12, 0.2, 0.3, 0.1)];
  const head = (z) => { out.push(part(roundBox(0.38, 1.05, 0.34, 0.06), 0x2b2f38, [0, 4.0, z])); [0xff4a3a, 0xffc23a, 0x3fe07a].forEach((c, i) => { for (const s of [-1, 1]) out.push(part(SPH0, c, [0, 4.33 - i * 0.33, z + s * 0.17], [0, 0, 0], [0.22, 0.22, 0.08])); }); };
  head(2.1); head(0);
  return merge(out);
});
export const bench = () => once('bench', () => merge([
  b(WOOD, 0, 0.46, 0.05, 1.8, 0.08, 0.22), b(WOOD, 0, 0.46, -0.2, 1.8, 0.08, 0.22),
  b(WOOD, 0, 0.78, -0.33, 1.8, 0.18, 0.06, -0.15), b(WOOD, 0, 1.0, -0.36, 1.8, 0.14, 0.06, -0.15),
  ...[-0.75, 0.75].flatMap((x) => [b(POLE, x, 0.22, -0.08, 0.08, 0.44, 0.5), b(POLE, x, 0.7, -0.33, 0.08, 0.6, 0.06, -0.15)]),
]));
export const bin = () => once('bin', () => merge([part(CYL, 0x3fae7a, [0, 0.45, 0], [0, 0, 0], [0.55, 0.9, 0.55]), part(CYL, 0x2f8a55, [0, 0.93, 0], [0, 0, 0], [0.62, 0.08, 0.62]), b(0xffffff, 0, 0.55, 0.27, 0.2, 0.2, 0.02)]));
export const hydrant = () => once('hydrant', () => merge([
  part(CYL, 0xe8423b, [0, 0.35, 0], [0, 0, 0], [0.32, 0.7, 0.32]), part(SPH, 0xe8423b, [0, 0.72, 0], [0, 0, 0], [0.34, 0.26, 0.34]),
  part(CYL, 0xc4302a, [0, 0.45, 0], [0, 0, Math.PI / 2], [0.14, 0.56, 0.14]), part(CYL, 0xc4302a, [0, 0.45, 0.15], [Math.PI / 2, 0, 0], [0.16, 0.2, 0.16]),
  part(CYL, 0xf2c14e, [0, 0.86, 0], [0, 0, 0], [0.1, 0.08, 0.1]), part(CYL, 0xc4302a, [0, 0.04, 0], [0, 0, 0], [0.44, 0.08, 0.44]),
]));
export const planter = () => once('planter', () => merge([
  part(roundBox(1.3, 0.55, 1.3, 0.1), 0xd8cfc0, [0, 0.28, 0]), b(0x6b4a2a, 0, 0.56, 0, 1.1, 0.04, 1.1),
  part(SPH, LEAF, [0, 0.95, 0], [0, 0, 0], [1.1, 0.8, 1.1]), part(SPH, LEAF2, [0.18, 1.2, 0.1], [0, 0, 0], [0.6, 0.5, 0.6]),
  ...[[0.35, 0.35], [-0.4, 0.2], [0.1, -0.42], [-0.25, -0.3]].map(([x, z]) => part(SPH0, [0xff8fb1, 0xffd23f, 0xffffff, 0xff6b5a][Math.abs(Math.round(x * 10)) % 4], [x, 1.12, z], [0, 0, 0], [0.16, 0.16, 0.16])),
]));
export const manhole = () => once('manhole', () => merge([part(CYL, 0x3a3b42, [0, 0, 0], [0, 0, 0], [1.3, 0.02, 1.3]), part(new THREE.TorusGeometry(0.55, 0.05, 3, 16), 0x6a6c74, [0, 0.015, 0], [Math.PI / 2, 0, 0], [1, 1, 1]), b(0x55575e, 0, 0.012, 0, 0.9, 0.01, 0.06), b(0x55575e, 0, 0.012, 0, 0.06, 0.01, 0.9)]));

// ---------------------------------------------------------------- houses
export const flowerbox = (color) => once('fb' + color, () => merge([
  b(0xffffff, 0, 0.2, 0, 2.2, 0.4, 0.45), b(0x6b4a2a, 0, 0.41, 0, 2.0, 0.03, 0.35),
  ...Array.from({ length: 7 }, (_, i) => part(SPH0, i % 2 ? LEAF : color, [-0.9 + i * 0.3, 0.5 + (i % 2) * 0.03, (i % 3 - 1) * 0.08], [0, i, 0], [0.24, 0.2, 0.24])),
]));
export const bush = (r) => once('bush' + r.toFixed(1), () => merge([part(SPH, LEAF, [0, r * 0.55, 0], [0, 0, 0], [r * 1.8, r * 1.3, r * 1.6]), part(SPH, LEAF2, [r * 0.3, r * 0.85, r * 0.15], [0, 0, 0], [r, r * 0.8, r])]));
export const mailbox = (color) => once('mb' + color, () => merge([
  b(WOOD, 0, 0.5, 0, 0.1, 1.0, 0.1), part(roundBox(0.3, 0.32, 0.5, 0.12), color, [0, 1.12, 0]), b(0xe8423b, 0.17, 1.25, -0.05, 0.03, 0.22, 0.06), b(0xe8423b, 0.17, 1.33, 0.02, 0.03, 0.06, 0.14),
]));
export function picket(len) {
  return once('pk' + len.toFixed(2), () => {
    const out = [b(0xffffff, 0, 0.35, 0, len, 0.07, 0.04), b(0xffffff, 0, 0.7, 0, len, 0.07, 0.04)];
    const n = Math.max(2, Math.round(len / 0.38));
    for (let i = 0; i <= n; i++) { const x = -len / 2 + (i * len) / n; out.push(b(0xffffff, x, 0.45, 0.03, 0.1, 0.9, 0.03), part(new THREE.ConeGeometry(0.07, 0.12, 4), 0xffffff, [x, 0.96, 0.03], [0, Math.PI / 4, 0])); }
    return merge(out);
  });
}
export const gnome = () => once('gnome', () => merge([
  part(CONE, 0x3a8fe8, [0, 0.22, 0], [0, 0, 0], [0.34, 0.44, 0.34]), part(SPH, 0xf2c6a0, [0, 0.47, 0.02], [0, 0, 0], [0.2, 0.2, 0.2]),
  part(CONE, 0xffffff, [0, 0.38, 0.09], [Math.PI, 0, 0], [0.18, 0.24, 0.12]), part(CONE, 0xe8423b, [0, 0.66, 0], [0, 0, 0.12], [0.24, 0.38, 0.24]),
  part(SPH0, 0xf2a0a0, [0, 0.46, 0.12], [0, 0, 0], [0.07, 0.07, 0.07]),
]));
// A pitched roof that overhangs the walls, a ridge cap, and maybe a brick chimney (-1 left, 1 right, 0 none).
export function roof(w, d, h, color, chimney = 0) {
  return once(`roof${w},${d},${h},${color},${chimney}`, () => {
    const X = w / 2 + 0.35, Z = d / 2 + 0.45, T = 0.18; // overhang
    const tri = (pts) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); return g; };
    // two slopes (each a thin slab: top and underside), the gables (wall colour, set back under the overhang)
    const out = [];
    for (const s of [-1, 1]) {
      const a = [-X, 0, s * Z], c = [X, 0, s * Z], r1 = [X, h, 0], r0 = [-X, h, 0];
      const up = s > 0 ? [a, c, r1, a, r1, r0] : [c, a, r0, c, r0, r1];
      const g = tri(up); g.computeVertexNormals(); out.push(part(g, color));
      const lo = up.map((p) => [p[0], p[1] - T, p[2]]); const g2 = tri([lo[0], lo[2], lo[1], lo[3], lo[5], lo[4]]); g2.computeVertexNormals(); out.push(part(g2, 0x7a5a44));
      out.push(b(color, 0, -T / 2, s * Z, w + 0.7, T, 0.08)); // fascia
    }
    for (const s of [-1, 1]) { const x = s * (w / 2 - 0.02), g = tri(s > 0 ? [[x, 0, -d / 2], [x, h * (1 - 0.45 / Z * 0), 0], [x, 0, d / 2]] : [[x, 0, d / 2], [x, h, 0], [x, 0, -d / 2]]); g.computeVertexNormals(); out.push(part(g, 0xf4efe6)); }
    out.push(part(CYL6, new THREE.Color(color).multiplyScalar(0.8).getHex(), [0, h + 0.02, 0], [0, 0, Math.PI / 2], [0.22, w + 0.8, 0.22])); // ridge
    if (chimney) out.push(b(0xa85a42, chimney * w * 0.28, h * 0.75, -d * 0.15, 0.8, h * 0.9, 0.8), b(0x6b3a2a, chimney * w * 0.28, h * 1.22, -d * 0.15, 0.95, 0.12, 0.95));
    return merge(out);
  });
}

// ---------------------------------------------------------------- apartments and towers
export const awning = (w, color) => once(`aw${w},${color}`, () => merge([
  b(color, 0, 0, 0.8, w, 0.14, 1.6, 0.12), b(0xffffff, 0, -0.12, 1.6, w + 0.04, 0.12, 0.06),
  ...Array.from({ length: Math.floor(w / 0.8) }, (_, i) => b(0xffffff, -w / 2 + 0.4 + i * 0.8, 0.075, 0.8, 0.3, 0.02, 1.6, 0.12)),
]));
export function balconies(w, ht, color) {
  return once(`bal${w},${ht},${color}`, () => {
    const out = [], slab = new THREE.Color(color).multiplyScalar(0.85).getHex();
    for (let y = 3.2; y < ht - 1.5; y += 3) for (let x = -w / 2 + 4; x <= w / 2 - 3.9; x += 6.4) {
      out.push(b(slab, x, y, 0.5, 2.8, 0.14, 1.0), b(0xffffff, x, y + 0.5, 0.98, 2.8, 0.06, 0.06), b(0xbfe6ff, x, y + 0.3, 0.98, 2.7, 0.4, 0.03));
      for (const s of [-1, 1]) out.push(b(0xffffff, x + s * 1.38, y + 0.3, 0.5, 0.05, 0.5, 1.0));
      if (((x * 7 + y * 3) | 0) % 3 === 0) out.push(part(SPH, LEAF, [x + 1, y + 0.32, 0.6], [0, 0, 0], [0.4, 0.4, 0.4]), part(CYL6, 0xc8643c, [x + 1, y + 0.15, 0.6], [0, 0, 0], [0.3, 0.2, 0.3]));
    }
    return merge(out);
  });
}
// The roof kit: a parapet, then AC units and a water tank (apartments), AC and an antenna (towers), or a helipad.
export function rooftop(w, d, kind) {
  return once(`rt${w},${d},${kind}`, () => {
    const out = [], P = 0xd8d2c6, H = 0.6;
    out.push(b(P, 0, H / 2, -d / 2 + 0.15, w, H, 0.3), b(P, 0, H / 2, d / 2 - 0.15, w, H, 0.3), b(P, -w / 2 + 0.15, H / 2, 0, 0.3, H, d), b(P, w / 2 - 0.15, H / 2, 0, 0.3, H, d));
    const ac = (x, z) => out.push(part(roundBox(1.6, 1.0, 1.2, 0.1), 0xc9ccd2, [x, 0.5, z]), part(CYL, 0x6a6c74, [x, 1.02, z], [0, 0, 0], [0.9, 0.05, 0.9]), b(0x9aa3ad, x, 1.04, z, 0.9, 0.02, 0.06));
    if (kind === 'apts') {
      ac(-w * 0.3, -d * 0.2); ac(-w * 0.3 + 2.2, -d * 0.2); ac(w * 0.15, d * 0.25);
      const tx = w * 0.32, tz = -d * 0.15; // water tank on legs
      for (const [lx, lz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) out.push(b(0x6b4a2a, tx + lx, 1.1, tz + lz, 0.12, 2.2, 0.12));
      out.push(part(CYL, 0x9a6b42, [tx, 3.1, tz], [0, 0, 0], [2.4, 1.9, 2.4]), part(CONE, 0x6b4a2a, [tx, 4.45, tz], [0, 0, 0], [2.6, 0.8, 2.6]));
      out.push(part(roundBox(3, 2.4, 3, 0.1), 0xe6dac6, [-w * 0.05, 1.2, -d * 0.2])); // stair hut
    } else if (kind === 'heli') {
      out.push(part(CYL, 0x55575e, [0, 0.05, 0], [0, 0, 0], [w * 0.7, 0.1, w * 0.7]), part(new THREE.TorusGeometry(w * 0.3, 0.18, 3, 40), 0xf2c14e, [0, 0.11, 0], [Math.PI / 2, 0, 0], [1, 1, 1]));
      out.push(b(0xffffff, -1.6, 0.12, 0, 0.7, 0.02, 5), b(0xffffff, 1.6, 0.12, 0, 0.7, 0.02, 5), b(0xffffff, 0, 0.12, 0, 3.2, 0.02, 0.7));
      out.push(b(POLE, w / 2 - 1, 1.5, -d / 2 + 1, 0.1, 3, 0.1), part(CONE, 0xff8a2a, [w / 2 - 1, 2.8, -d / 2 + 1.6], [Math.PI / 2, 0, 0], [0.4, 1.2, 0.4]));
    } else {
      ac(-w * 0.25, -d * 0.25); ac(-w * 0.25 + 2.2, -d * 0.25); ac(-w * 0.25, -d * 0.25 + 1.8); ac(w * 0.2, d * 0.2);
      out.push(part(roundBox(5, 3, 4, 0.2), 0xd8dde4, [w * 0.15, 1.5, -d * 0.2])); // plant room
      out.push(part(CYL6, 0xc9ccd2, [w * 0.15, 6, -d * 0.2], [0, 0, 0], [0.15, 6, 0.15]), part(SPH0, 0xff4a3a, [w * 0.15, 9.1, -d * 0.2], [0, 0, 0], [0.35, 0.35, 0.35]));
    }
    return merge(out);
  });
}
// Light bands round a tower every few floors, and a glassy lobby at its foot.
export function bands(w, d, ht) {
  return once(`bd${w},${d},${ht}`, () => {
    const out = [b(0xe8f2fb, 0, 2.1, 0, w + 0.3, 4.2, d + 0.3), b(0xf4f6fa, 0, 4.3, 0, w + 0.5, 0.35, d + 0.5)];
    for (let y = 10; y < ht - 2; y += 10) out.push(b(0xf4f6fa, 0, y, 0, w + 0.25, 0.4, d + 0.25));
    out.push(b(0xf4f6fa, 0, ht + 0.15, 0, w + 0.4, 0.3, d + 0.4));
    return merge(out);
  });
}

// ---------------------------------------------------------------- the park
const rrShape = (w, d, r) => { const s = new THREE.Shape(), x = -w / 2, y = -d / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d); s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; };
const flat = (shape) => { const g = new THREE.ShapeGeometry(shape, 8); g.rotateX(-Math.PI / 2); return g; };
// The pond's water (textured: UVs in metres) and its dressing (a stone rim, lily pads, reeds, a family of ducks).
export function pondWater(w, d, r) {
  const g = flat(rrShape(w, d, r)), n = g.attributes.position.count;
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  return g;
}
export function pondDressing(w, d, r) {
  return once(`pd${w},${d}`, () => {
    const out = [];
    const rim = rrShape(w + 1.6, d + 1.6, r + 0.8); rim.holes.push(rrShape(w, d, r));
    out.push(part(flat(rim), 0xb9b2a4, [0, 0.06, 0]));
    const pts = rrShape(w + 0.8, d + 0.8, r + 0.4).getSpacedPoints(46);
    pts.forEach((p, i) => out.push(part(SPH0, i % 3 ? 0xa9a294 : 0xc8c1b2, [p.x, 0.12, -p.y], [i, i * 2, 0], [0.7 + (i % 4) * 0.15, 0.4, 0.6 + (i % 3) * 0.15])));
    for (const [x, z] of [[-9, -4], [-7, 3], [6, 5], [10, -3], [-2, 6], [3, -5.5]]) out.push(part(CYL, 0x4caf50, [x, 0.04, z], [0, 0, 0], [1.1, 0.02, 1.1]), part(SPH0, 0xff8fb1, [x + 0.2, 0.12, z], [0, 0, 0], [0.22, 0.16, 0.22]));
    for (const [x, z] of [[-w / 2 + 1, -d / 2 + 1], [w / 2 - 1, d / 2 - 1], [w / 2 - 1.5, -d / 2 + 1]]) for (let k = 0; k < 6; k++) out.push(part(CYL6, 0x5f9a4a, [x + Math.cos(k) * 0.5, 0.7, z + Math.sin(k * 1.7) * 0.5], [0.1 * Math.cos(k), 0, 0.1 * Math.sin(k)], [0.06, 1.4, 0.06]), part(CYL6, 0x7a4a2a, [x + Math.cos(k) * 0.5, 1.35, z + Math.sin(k * 1.7) * 0.5], [0, 0, 0], [0.12, 0.35, 0.12]));
    const duck = (x, z, s, ry) => { const g = merge([part(SPH, 0xffd23f, [0, 0.15, 0], [0, 0, 0], [0.5, 0.3, 0.36]), part(SPH, 0xffd23f, [0.2, 0.36, 0], [0, 0, 0], [0.26, 0.26, 0.26]), part(CONE, 0xff8a2a, [0.37, 0.35, 0], [0, 0, -Math.PI / 2], [0.1, 0.14, 0.08])]); g.scale(s, s, s); g.rotateY(ry); g.translate(x, 0, z); out.push(g); };
    duck(-4, 1, 1.4, 0.4); duck(-2.6, 1.8, 0.8, 0.4); duck(-1.8, 2.4, 0.8, 0.5); duck(-1, 3.1, 0.8, 0.3);
    return merge(out);
  });
}
// A path loop round the pond and four paths out to the sidewalks.
export function parkPaths(I, w, d, r) {
  return once(`pp${I}`, () => {
    const C = 0xe4d3b4, out = [];
    const ring = rrShape(w + 9, d + 9, r + 4.5); ring.holes.push(rrShape(w + 4, d + 4, r + 2));
    out.push(part(flat(ring), C, [0, 0.014, 0]));
    const PW = 2.8, ex = (w + 9) / 2 - 0.5, ez = (d + 9) / 2 - 0.5;
    out.push(b(C, (ex + I) / 2, 0.006, 0, I - ex, 0.012, PW), b(C, -(ex + I) / 2, 0.006, 0, I - ex, 0.012, PW), b(C, 0, 0.006, (ez + I) / 2, PW, 0.012, I - ez), b(C, 0, 0.006, -(ez + I) / 2, PW, 0.012, I - ez));
    return merge(out);
  });
}
export const flowerbed = (r, color) => once(`fl${r},${color}`, () => {
  const out = [part(CYL, 0x7a5236, [0, 0.06, 0], [0, 0, 0], [r * 2, 0.12, r * 2]), part(new THREE.TorusGeometry(r, 0.14, 4, 20), 0xd8d0c0, [0, 0.12, 0], [Math.PI / 2, 0, 0], [1, 1, 1])];
  for (let i = 0; i < 26; i++) { const a = i * 2.4, q = Math.sqrt((i + 0.5) / 26) * r * 0.85, x = Math.cos(a) * q, z = Math.sin(a) * q; out.push(part(SPH0, i % 4 ? color : 0xffffff, [x, 0.3, z], [0, i, 0], [0.32, 0.26, 0.32]), part(SPH0, LEAF, [x * 0.9, 0.18, z * 0.9], [0, i, 0], [0.3, 0.16, 0.3])); }
  return merge(out);
});
export const playground = () => once('play', () => {
  const out = [part(CYL, 0xf2dfa8, [0, 0.03, 0], [0, 0, 0], [7.5, 0.06, 7.5])];
  // slide: a ladder up to a platform, a slide down
  for (const x of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) out.push(b(0x3a8fe8, x - 1.2, 1.1, z, 0.12, 2.2, 0.12));
  out.push(b(0xf2c14e, -1.2, 2.0, 0, 1.2, 0.12, 1.2), part(CONE, 0xe8423b, [-1.2, 3.0, 0], [0, Math.PI / 4, 0], [1.9, 1, 1.9]));
  for (let k = 0; k < 5; k++) out.push(b(0xffffff, -1.2, 0.35 + k * 0.38, 0.65, 0.9, 0.06, 0.06));
  out.push(b(0xe8423b, 0.3, 1.1, 0, 2.4, 0.08, 0.8, 0, 0, -0.75), b(0xe8423b, 0.3, 1.25, 0.38, 2.4, 0.25, 0.05, 0, 0, -0.75), b(0xe8423b, 0.3, 1.25, -0.38, 2.4, 0.25, 0.05, 0, 0, -0.75));
  // swings
  for (const s of [-1, 1]) out.push(b(0x3fae7a, 1.6, 1.15, 1.6 + s * 0.4, 0.12, 2.4, 0.12, s * 0.35), b(0x3fae7a, 1.6 + 2.6, 1.15, 1.6 + s * 0.4, 0.12, 2.4, 0.12, s * 0.35));
  out.push(b(0x3fae7a, 2.9, 2.3, 1.6, 2.8, 0.12, 0.12));
  for (const x of [2.4, 3.4]) out.push(b(0xd8dde4, x - 0.2, 1.5, 1.6, 0.03, 1.6, 0.03), b(0xd8dde4, x + 0.2, 1.5, 1.6, 0.03, 1.6, 0.03), b(0xff8fb1, x, 0.7, 1.6, 0.5, 0.06, 0.25));
  out.push(part(SPH, 0xff8fb1, [1.5, 0.3, -1.6], [0, 0, 0], [0.6, 0.6, 0.6]), part(SPH, 0x3a8fe8, [2.2, 0.25, -2.2], [0, 0, 0], [0.5, 0.5, 0.5])); // a couple of balls
  return merge(out);
});
export const picnic = () => once('picnic', () => merge([
  b(WOOD, 0, 0.78, 0, 2.0, 0.08, 0.9), b(0xe8423b, 0, 0.83, 0, 1.4, 0.02, 0.9), b(0xffffff, -0.35, 0.835, 0, 0.35, 0.02, 0.9), b(0xffffff, 0.35, 0.835, 0, 0.35, 0.02, 0.9),
  b(WOOD, 0, 0.45, 0.75, 2.0, 0.07, 0.3), b(WOOD, 0, 0.45, -0.75, 2.0, 0.07, 0.3),
  ...[-0.8, 0.8].flatMap((x) => [b(0x8a5a34, x, 0.4, 0.38, 0.1, 0.85, 0.1, -0.5), b(0x8a5a34, x, 0.4, -0.38, 0.1, 0.85, 0.1, 0.5)]),
]));

// ---------------------------------------------------------------- the stunt lot
export const cone = () => once('cone', () => merge([b(0xff8a2a, 0, 0.03, 0, 0.5, 0.06, 0.5), part(CONE, 0xff8a2a, [0, 0.4, 0], [0, 0, 0], [0.38, 0.72, 0.38]), part(CYL, 0xffffff, [0, 0.42, 0], [0, 0, 0], [0.27, 0.1, 0.27])]));
export const flag = () => once('flag', () => {
  const out = [b(0xd8dde4, 0, 2.5, 0, 0.08, 5, 0.08)];
  for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) out.push(b((i + k) % 2 ? 0x2b2b30 : 0xffffff, 0.05, 4.7 - k * 0.3, 0.2 + i * 0.3, 0.02, 0.3, 0.3));
  return merge(out);
});
export const tyres = () => once('tyres', () => merge([0, 1, 2].map((k) => part(TOR, k === 1 ? 0xf2c14e : 0x2b2b30, [0, 0.2 + k * 0.36, 0], [Math.PI / 2, 0, 0], [1.1, 1.1, 1.1]))));

// ---------------------------------------------------------------- trees
// Round trees (three soft blobs) and pines (stacked cones), two greens each.
export function treeGeos() {
  return {
    trunk: merge([part(CYL6, 0x8a6a44, [0, 0.5, 0], [0, 0, 0], [0.32, 1, 0.32])]),
    crown: merge([part(SPH, 0x4caf50, [0, 0, 0], [0, 0, 0], [1, 0.86, 1]), part(SPH, 0x5fc25a, [0.32, 0.22, 0.12], [0, 0.5, 0], [0.66, 0.6, 0.66]), part(SPH, 0x6fd06a, [-0.22, 0.3, -0.2], [0, 1, 0], [0.5, 0.46, 0.5])]),
    pine: merge([part(CONE, 0x2f8a55, [0, -0.05, 0], [0, 0, 0], [1.25, 0.9, 1.25]), part(CONE, 0x3ea062, [0, 0.42, 0], [0, 0.3, 0], [0.95, 0.75, 0.95]), part(CONE, 0x4caf6a, [0, 0.82, 0], [0, 0.6, 0], [0.62, 0.6, 0.62])]),
  };
}
