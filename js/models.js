// Procedural low-poly models, in Dr. Mow's flat-shaded toy style: the shopper and cart, the dasher's hatchback,
// every product on the list, parked cars and props. Everything is built from primitives with the colour baked
// into the vertices, so static things merge into one draw call and one shared material serves them all.
import * as THREE from 'three';
import { mergeGeometries } from './vendor/addons/BufferGeometryUtils.js';
import { addFaces } from './faces.js';

export const VCOL = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _c = new THREE.Color();

// A primitive, coloured, moved into place: part(geo, color, [x, y, z], [rx, ry, rz], [sx, sy, sz]).
export function part(geo, color, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  _c.set(color);
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  _m.compose(_p.set(...pos), _q.setFromEuler(_e.set(...rot)), _s.set(...scl));
  g.applyMatrix4(_m);
  return g;
}
export const merge = (parts) => mergeGeometries(parts.filter(Boolean), false);
export const place = (geo, x, y, z, ry = 0, s = 1) => { const g = geo.clone(); g.applyMatrix4(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(s, s, s))); return g; };

const BOX = new THREE.BoxGeometry(1, 1, 1);
const SPH = new THREE.IcosahedronGeometry(0.5, 1);
const SPH0 = new THREE.IcosahedronGeometry(0.5, 0);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
const CYL6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
const CONE = new THREE.ConeGeometry(0.5, 1, 6);
const TOR = new THREE.TorusGeometry(0.5, 0.12, 4, 8, Math.PI * 0.9);

// ---------------------------------------------------------------- products (each ~0.3–1 m, base at y 0)
const pot = (c = 0xc8643c) => [part(CYL6, c, [0, 0.16, 0], [0, 0, 0], [0.42, 0.32, 0.42]), part(CYL6, 0x5a3a24, [0, 0.31, 0], [0, 0, 0], [0.36, 0.03, 0.36])];
const BUILD = {
  tp: (band) => { const out = []; for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) out.push(part(CYL, 0xffffff, [(i - 1) * 0.17, 0.11, (k - 0.5) * 0.17], [0, 0, 0], [0.16, 0.22, 0.16])); out.push(part(BOX, band, [0, 0.11, 0], [0, 0, 0], [0.53, 0.08, 0.36])); return out; },
  tp12: () => BUILD.tp(0x6fb7ff),
  tp24: () => [...BUILD.tp(0xffd23f), ...BUILD.tp(0xffd23f).map((g) => g.translate(0, 0.22, 0))],
  tpQuilt: () => BUILD.tp(0xff8fb1),
  bananas: () => [0, 1, 2, 3].map((i) => part(TOR, 0xffd84a, [0, 0.1 + i * 0.02, (i - 1.5) * 0.06], [Math.PI / 2, 0, 0.2 * i], [0.4, 0.4, 0.6])),
  apples: () => [[0, 0], [0.16, 0.05], [-0.14, 0.08], [0.03, -0.15]].flatMap(([x, z], i) => [part(SPH, i % 2 ? 0xd62f2f : 0xe84a3a, [x, 0.1, z], [0, 0, 0], [0.2, 0.19, 0.2]), part(BOX, 0x5a3a24, [x, 0.21, z], [0, 0, 0], [0.02, 0.05, 0.02])]),
  broccoli: () => [part(CYL6, 0x9acd5a, [0, 0.12, 0], [0, 0, 0], [0.1, 0.24, 0.1]), ...[[0, 0], [0.09, 0.04], [-0.08, 0.05], [0.02, -0.09]].map(([x, z]) => part(SPH0, 0x2f8a3f, [x, 0.28, z], [0, 0, 0], [0.18, 0.15, 0.18]))],
  carrots: () => [-0.08, 0, 0.08].flatMap((x, i) => [part(CONE, 0xff8a2a, [x, 0.08, (i - 1) * 0.04], [0, 0, Math.PI / 2], [0.09, 0.36, 0.09]), part(CONE, 0x4caf50, [x - 0.22, 0.08, (i - 1) * 0.04], [0, 0, -Math.PI / 2], [0.07, 0.12, 0.07])]),
  watermelon: () => [part(SPH, 0x2f8a3f, [0, 0.18, 0], [0, 0, 0], [0.52, 0.36, 0.36]), part(SPH, 0x9bd36a, [0, 0.185, 0], [0, 0, 0], [0.4, 0.365, 0.365])],
  pineapple: () => [part(SPH, 0xd9a032, [0, 0.18, 0], [0, 0, 0], [0.24, 0.36, 0.24]), ...[0, 1, 2, 3, 4].map((i) => part(CONE, 0x3f9a45, [Math.sin(i * 1.26) * 0.04, 0.42, Math.cos(i * 1.26) * 0.04], [Math.sin(i * 1.26) * 0.4, 0, Math.cos(i * 1.26) * 0.4], [0.06, 0.24, 0.06]))],
  teddy: () => [part(SPH, 0xb07a4a, [0, 0.17, 0], [0, 0, 0], [0.32, 0.34, 0.28]), part(SPH, 0xb07a4a, [0, 0.42, 0], [0, 0, 0], [0.26, 0.24, 0.24]), part(SPH0, 0x8a5a34, [-0.1, 0.53, 0], [0, 0, 0], [0.09, 0.09, 0.06]), part(SPH0, 0x8a5a34, [0.1, 0.53, 0], [0, 0, 0], [0.09, 0.09, 0.06]), part(SPH0, 0xe8c9a0, [0, 0.4, 0.11], [0, 0, 0], [0.1, 0.08, 0.06]), part(SPH0, 0x1a1a1a, [0, 0.43, 0.14], [0, 0, 0], [0.04, 0.03, 0.03])],
  duck: () => [part(SPH, 0xffd23f, [0, 0.12, 0], [0, 0, 0], [0.34, 0.24, 0.26]), part(SPH, 0xffd23f, [0.1, 0.3, 0], [0, 0, 0], [0.18, 0.18, 0.18]), part(CONE, 0xff8a2a, [0.22, 0.29, 0], [0, 0, -Math.PI / 2], [0.07, 0.1, 0.05])],
  robot: () => [part(BOX, 0x9aa7b8, [0, 0.16, 0], [0, 0, 0], [0.26, 0.24, 0.16]), part(BOX, 0xbfc9d6, [0, 0.38, 0], [0, 0, 0], [0.2, 0.17, 0.16]), part(BOX, 0x47c4ff, [0, 0.39, 0.081], [0, 0, 0], [0.13, 0.04, 0.01]), part(BOX, 0x7a8696, [-0.17, 0.17, 0], [0, 0, 0], [0.06, 0.2, 0.06]), part(BOX, 0x7a8696, [0.17, 0.17, 0], [0, 0, 0], [0.06, 0.2, 0.06]), part(SPH0, 0xff5a5a, [0, 0.52, 0], [0, 0, 0], [0.05, 0.05, 0.05])],
  ball: () => [part(SPH, 0xff5a5a, [0, 0.2, 0], [0, 0, 0], [0.4, 0.4, 0.4]), part(SPH, 0xffffff, [0, 0.2, 0], [0, 0.6, 0], [0.41, 0.41, 0.2]), part(SPH, 0x3a8fe8, [0, 0.2, 0], [0, -0.6, 0], [0.2, 0.41, 0.41])],
  dino: () => [part(SPH, 0x5fd06a, [0, 0.16, 0], [0, 0, 0], [0.42, 0.26, 0.24]), part(SPH, 0x5fd06a, [0.2, 0.34, 0], [0, 0, 0], [0.2, 0.18, 0.16]), part(CONE, 0x5fd06a, [-0.28, 0.12, 0], [0, 0, Math.PI / 2], [0.1, 0.24, 0.1]), part(CONE, 0xffd23f, [0, 0.3, 0], [0, 0, 0], [0.06, 0.12, 0.06]), part(CONE, 0xffd23f, [-0.1, 0.28, 0], [0, 0, 0], [0.05, 0.1, 0.05])],
  rug: (a, b) => [part(CYL, a, [0, 0.13, 0], [Math.PI / 2, 0, 0], [0.26, 1.7, 0.26]), part(CYL, b, [0, 0.13, 0.86], [Math.PI / 2, 0, 0], [0.18, 0.02, 0.18]), part(CYL, b, [0, 0.13, -0.86], [Math.PI / 2, 0, 0], [0.18, 0.02, 0.18]), ...[-0.5, 0, 0.5].map((z) => part(CYL, b, [0, 0.13, z], [Math.PI / 2, 0, 0], [0.27, 0.08, 0.27]))],
  rugShag: () => BUILD.rug(0xf2a65a, 0xfff1d6),
  rugRunner: () => BUILD.rug(0x4a7fd8, 0xf2c14e),
  rugPersian: () => BUILD.rug(0xb03a48, 0x2b3a66),
  fern: () => [...pot(), ...[0, 1, 2, 3, 4, 5].map((i) => part(CONE, 0x3fae5a, [Math.sin(i) * 0.12, 0.5, Math.cos(i) * 0.12], [Math.cos(i) * 0.6, 0, -Math.sin(i) * 0.6], [0.12, 0.42, 0.06]))],
  cactus: () => [...pot(0xe0a060), part(CYL6, 0x5f9a4a, [0, 0.55, 0], [0, 0, 0], [0.16, 0.5, 0.16]), part(SPH0, 0x5f9a4a, [0, 0.8, 0], [0, 0, 0], [0.16, 0.12, 0.16]), part(CYL6, 0x5f9a4a, [0.12, 0.6, 0], [0, 0, 0.9], [0.09, 0.16, 0.09]), part(CYL6, 0x5f9a4a, [0.17, 0.7, 0], [0, 0, 0], [0.08, 0.18, 0.08]), part(SPH0, 0xff6fa0, [0, 0.88, 0], [0, 0, 0], [0.07, 0.05, 0.07])],
  sunflower: () => [...pot(), part(CYL6, 0x4caf50, [0, 0.62, 0], [0, 0, 0], [0.04, 0.6, 0.04]), part(CYL, 0xffcc33, [0, 0.95, 0.03], [Math.PI / 2 - 0.3, 0, 0], [0.34, 0.03, 0.34]), part(CYL, 0x6b3f1f, [0, 0.95, 0.05], [Math.PI / 2 - 0.3, 0, 0], [0.16, 0.04, 0.16]), part(CONE, 0x4caf50, [0.08, 0.6, 0], [0, 0, -1], [0.08, 0.2, 0.03])],
  palm: () => [...pot(0xd8c8a8), part(CYL6, 0x8a6a44, [0, 0.62, 0], [0, 0, 0], [0.07, 0.62, 0.07]), ...[0, 1, 2, 3, 4].map((i) => part(CONE, 0x4caf6a, [Math.sin(i * 1.26) * 0.18, 0.92, Math.cos(i * 1.26) * 0.18], [Math.cos(i * 1.26) * 1.2, 0, -Math.sin(i * 1.26) * 1.2], [0.1, 0.5, 0.03]))],
  bonsai: () => [part(BOX, 0x3b4a66, [0, 0.06, 0], [0, 0, 0], [0.5, 0.12, 0.3]), part(CYL6, 0x6b4a2a, [0, 0.22, 0], [0, 0, 0.3], [0.06, 0.28, 0.06]), part(SPH0, 0x6b8f3a, [0.07, 0.38, 0], [0, 0, 0], [0.34, 0.16, 0.28]), part(SPH0, 0x7aa548, [-0.08, 0.32, 0.03], [0, 0, 0], [0.2, 0.1, 0.18])],
  plunger: (cup = 0xe23b3b, stick = 0xc89a5a) => [part(SPH, cup, [0, 0.08, 0], [0, 0, 0], [0.26, 0.22, 0.26]), part(BOX, cup, [0, 0.0, 0], [0, 0, 0], [0.24, 0.02, 0.24]), part(CYL6, stick, [0, 0.45, 0], [0, 0, 0], [0.05, 0.7, 0.05])],
  plungerXL: () => BUILD.plunger(0x2b2b30, 0x8a6a44).map((g) => g.scale(1.25, 1.2, 1.25)),
  plungerGold: () => BUILD.plunger(0xf2c14e, 0xf2c14e),
};
const PRODUCT_CACHE = new Map();
export function productGeo(id) {
  let g = PRODUCT_CACHE.get(id);
  if (!g) { g = merge(BUILD[id]()); g.computeBoundingBox(); PRODUCT_CACHE.set(id, g); }
  return g;
}
export function productMesh(id) { const m = new THREE.Mesh(productGeo(id), VCOL); m.castShadow = true; return m; }

// A heap of produce for a bin top (2.6 × 1.8): copies of the product scattered and stacked.
export function heapGeo(id, rng) {
  const out = [], base = productGeo(id);
  const big = id === 'watermelon' || id === 'pineapple';
  const nx = big ? 4 : 6, nz = big ? 3 : 4;
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) for (let l = 0; l < 2; l++) {
    const x = -1.05 + (2.1 * (i + 0.5)) / nx + (rng() - 0.5) * 0.12, z = -0.7 + (1.4 * (k + 0.5)) / nz + (rng() - 0.5) * 0.12;
    out.push(place(base, x + l * 0.08, l * (big ? 0.28 : 0.14), z, rng() * Math.PI * 2, big ? 0.85 : 0.9));
  }
  return merge(out);
}

// ---------------------------------------------------------------- the shopper (dasher) and their cart
// Group layout: root at the body centre on the ground, facing +z. The cart sits ahead (+z), the shopper behind.
export function makeShopper(color) {
  const root = new THREE.Group();
  const shirt = color, skin = 0xf2c6a0, pants = 0x3b4a66;
  const body = new THREE.Group(); body.position.set(0, 0, -0.55); root.add(body);
  const torso = new THREE.Mesh(merge([
    part(BOX, shirt, [0, 1.0, 0], [0.25, 0, 0], [0.48, 0.58, 0.3]),
    part(BOX, 0x2b2b30, [0, 1.02, -0.2], [0.25, 0, 0], [0.4, 0.46, 0.14]), // delivery backpack
    part(BOX, shirt, [0, 1.08, -0.29], [0.25, 0, 0], [0.3, 0.2, 0.02]),
    part(BOX, shirt, [-0.24, 1.0, 0.24], [-1.1, 0, 0], [0.12, 0.44, 0.12]), // arms out to the handle
    part(BOX, shirt, [0.24, 1.0, 0.24], [-1.1, 0, 0], [0.12, 0.44, 0.12]),
    part(SPH0, skin, [-0.24, 0.93, 0.46], [0, 0, 0], [0.11, 0.11, 0.11]),
    part(SPH0, skin, [0.24, 0.93, 0.46], [0, 0, 0], [0.11, 0.11, 0.11]),
  ]), VCOL);
  // a big chibi head (Dr. Mow proportions) so the cartoon faces read from the isometric camera
  const head = new THREE.Mesh(merge([
    part(new THREE.IcosahedronGeometry(0.5, 2), skin, [0, 0, 0], [0, 0, 0], [0.56, 0.58, 0.56]),
    part(CYL, color, [0, 0.19, -0.02], [0, 0, 0], [0.6, 0.16, 0.6]),   // cap
    part(BOX, color, [0, 0.13, 0.29], [0, 0, 0], [0.44, 0.04, 0.26]),  // brim
    part(SPH0, skin, [-0.28, 0, 0], [0, 0, 0], [0.08, 0.12, 0.08]), part(SPH0, skin, [0.28, 0, 0], [0, 0, 0], [0.08, 0.12, 0.08]), // ears
  ]), VCOL);
  head.position.set(0, 1.62, 0.06);
  const face = addFaces(head, 0.28, 0.58 / 0.56);
  const legGeo = merge([part(BOX, pants, [0, -0.25, 0], [0, 0, 0], [0.16, 0.5, 0.18]), part(BOX, 0xffffff, [0, -0.52, 0.05], [0, 0, 0], [0.17, 0.1, 0.28])]);
  const legL = new THREE.Mesh(legGeo, VCOL), legR = new THREE.Mesh(legGeo, VCOL);
  legL.position.set(-0.12, 0.6, 0); legR.position.set(0.12, 0.6, 0);
  body.add(torso, head, legL, legR);
  // the cart: a wire basket on four casters, handle in the dasher's colour
  const cart = new THREE.Group(); cart.position.set(0, 0, 0.42); root.add(cart);
  const wire = 0xc9d2dc;
  const cartParts = [part(BOX, color, [0, 0.98, -0.42], [0, 0, 0], [0.62, 0.06, 0.06])];
  const bars = (x0, x1, y0, y1, z0, z1) => cartParts.push(part(BOX, wire, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [0, 0, 0], [Math.max(0.03, x1 - x0), Math.max(0.03, y1 - y0), Math.max(0.03, z1 - z0)]));
  for (const y of [0.45, 0.68, 0.92]) { bars(-0.3, 0.3, y, y, -0.38, -0.38); bars(-0.33, 0.33, y, y, 0.42, 0.42); bars(-0.31, -0.31, y, y, -0.38, 0.42); bars(0.31, 0.31, y, y, -0.38, 0.42); }
  for (const x of [-0.31, 0.31]) for (const z of [-0.38, 0.42]) bars(x, x, 0.45, 0.92, z, z);
  for (const x of [-0.15, 0, 0.15]) { bars(x, x, 0.45, 0.92, 0.42, 0.42); bars(x, x, 0.45, 0.92, -0.38, -0.38); }
  for (const z of [-0.12, 0.15]) { bars(-0.31, -0.31, 0.45, 0.92, z, z); bars(0.31, 0.31, 0.45, 0.92, z, z); }
  cartParts.push(part(BOX, 0xaab4c0, [0, 0.45, 0.02], [0, 0, 0], [0.62, 0.02, 0.8]));          // basket floor
  cartParts.push(part(BOX, 0x8a96a4, [0, 0.16, 0.02], [0, 0, 0], [0.5, 0.03, 0.72]));          // under-rack
  for (const x of [-0.24, 0.24]) for (const z of [-0.3, 0.36]) cartParts.push(part(BOX, 0x8a96a4, [x, 0.27, z], [0, 0, 0], [0.03, 0.3, 0.03]), part(CYL, 0x2b2b30, [x, 0.07, z], [0, 0, Math.PI / 2], [0.12, 0.05, 0.12]));
  cartParts.push(part(BOX, color, [0, 0.95, 0.43], [0, 0, 0], [0.5, 0.18, 0.02]));              // the dasher logo plate
  cart.add(new THREE.Mesh(merge(cartParts), VCOL));
  const load = new THREE.Group(); load.position.set(0, 0.47, 0.02); cart.add(load);
  root.traverse((o) => { if (o.isMesh && !o.userData.face) o.castShadow = true; });
  return { root, body, head, legL, legR, cart, load, items: [], face };
}

// ---------------------------------------------------------------- cars
export function carGeo(color, { sign = null, dark = false } = {}) {
  const glass = dark ? 0x23303f : 0x2f4a66, trim = 0x2b2b30;
  const parts = [
    part(BOX, color, [0, 0.62, 0], [0, 0, 0], [1.86, 0.62, 4.2]),            // body
    part(BOX, color, [0, 1.18, -0.35], [0, 0, 0], [1.62, 0.56, 2.3]),        // cabin
    part(BOX, glass, [0, 1.2, 0.81], [-0.5, 0, 0], [1.5, 0.48, 0.05]),       // windscreen
    part(BOX, glass, [0, 1.2, -1.5], [0.35, 0, 0], [1.48, 0.44, 0.05]),      // rear window
    part(BOX, glass, [-0.815, 1.2, -0.35], [0, 0, 0], [0.02, 0.36, 2.0]),    // side windows
    part(BOX, glass, [0.815, 1.2, -0.35], [0, 0, 0], [0.02, 0.36, 2.0]),
    part(BOX, trim, [0, 0.38, 2.1], [0, 0, 0], [1.9, 0.22, 0.12]),           // bumpers
    part(BOX, trim, [0, 0.38, -2.1], [0, 0, 0], [1.9, 0.22, 0.12]),
    part(BOX, 0xfff3c4, [-0.62, 0.7, 2.11], [0, 0, 0], [0.36, 0.16, 0.04]),  // lights
    part(BOX, 0xfff3c4, [0.62, 0.7, 2.11], [0, 0, 0], [0.36, 0.16, 0.04]),
    part(BOX, 0xd33a3a, [-0.66, 0.72, -2.11], [0, 0, 0], [0.3, 0.14, 0.04]),
    part(BOX, 0xd33a3a, [0.66, 0.72, -2.11], [0, 0, 0], [0.3, 0.14, 0.04]),
  ];
  if (sign) parts.push(part(BOX, 0xffffff, [0, 1.6, -0.35], [0, 0, 0], [0.9, 0.3, 0.3]), part(BOX, sign, [0, 1.6, -0.35], [0, 0, 0], [0.92, 0.18, 0.32]));
  return merge(parts);
}
const WHEEL = merge([part(CYL, 0x1e1e22, [0, 0, 0], [0, 0, Math.PI / 2], [0.68, 0.32, 0.68]), part(CYL, 0xc9ccd2, [0, 0, 0], [0, 0, Math.PI / 2], [0.36, 0.34, 0.36])]);
export const WHEEL_POS = [[-0.86, 0.34, 1.32], [0.86, 0.34, 1.32], [-0.86, 0.34, -1.32], [0.86, 0.34, -1.32]];
export function parkedCarGeo(color) { return merge([carGeo(color, { dark: true }), ...WHEEL_POS.map((p) => place(WHEEL, ...p))]); }

export function makeCar(color) {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  body.add(new THREE.Mesh(carGeo(color, { sign: color }), VCOL));
  const wheels = WHEEL_POS.map(([x, y, z]) => { const w = new THREE.Mesh(WHEEL, VCOL); w.position.set(x, y, z); root.add(w); return w; });
  const driver = new THREE.Mesh(merge([part(SPH, 0xf2c6a0, [0, 0, 0], [0, 0, 0], [0.3, 0.32, 0.3]), part(CYL, color, [0, 0.1, 0], [0, 0, 0], [0.32, 0.12, 0.32])]), VCOL);
  driver.position.set(-0.4, 1.25, -0.2); body.add(driver); driver.visible = false;
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root, body, wheels, driver };
}

// ---------------------------------------------------------------- props
export function treeGeos() {
  return {
    trunk: merge([part(CYL6, 0x8a6a44, [0, 0.5, 0], [0, 0, 0], [0.32, 1, 0.32])]),
    crown: merge([part(SPH0, 0x4caf50, [0, 0, 0], [0, 0, 0], [1, 0.85, 1]), part(SPH0, 0x5fc25a, [0.25, 0.2, 0.1], [0, 0.5, 0], [0.7, 0.6, 0.7])]),
  };
}
export function lampGeo() { return merge([part(CYL6, 0x5a6270, [0, 3.5, 0], [0, 0, 0], [0.18, 7, 0.18]), part(BOX, 0x5a6270, [0.6, 7, 0], [0, 0, 0], [1.4, 0.12, 0.2]), part(BOX, 0xfff3c4, [1.1, 6.9, 0], [0, 0, 0], [0.5, 0.08, 0.3])]); }
export function registerGeo() { return merge([part(BOX, 0x2b2b30, [0, 0.15, 0], [0, 0, 0], [0.5, 0.3, 0.4]), part(BOX, 0x47c4ff, [0, 0.42, -0.05], [-0.4, 0, 0], [0.4, 0.28, 0.04])]); }
export function corralGeo(w, d) {
  const out = [], c = 0x9fb4c8;
  for (const [x0, x1, z0, z1] of [[-w / 2, w / 2, -d / 2, -d / 2], [-w / 2, w / 2, d / 2, d / 2], [-w / 2, -w / 2, -d / 2, d / 2]]) out.push(part(BOX, c, [(x0 + x1) / 2, 1.05, (z0 + z1) / 2], [0, 0, 0], [Math.max(0.08, x1 - x0), 0.08, Math.max(0.08, z1 - z0)]));
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) out.push(part(CYL6, c, [x, 0.55, z], [0, 0, 0], [0.08, 1.1, 0.08]));
  return merge(out);
}
export function roofGeo(w, d, h, color) {
  // a pitched roof: ridge along the longer side
  const g = new THREE.BufferGeometry(), X = w / 2, Z = d / 2;
  const along = w >= d;
  const v = along
    ? [-X, 0, -Z, X, 0, -Z, X, h, 0, -X, 0, -Z, X, h, 0, -X, h, 0, -X, 0, Z, -X, h, 0, X, h, 0, -X, 0, Z, X, h, 0, X, 0, Z, -X, 0, -Z, -X, h, 0, -X, 0, Z, X, 0, -Z, X, 0, Z, X, h, 0]
    : [-X, 0, -Z, -X, 0, Z, 0, h, Z, -X, 0, -Z, 0, h, Z, 0, h, -Z, X, 0, -Z, 0, h, -Z, 0, h, Z, X, 0, -Z, 0, h, Z, X, 0, Z, -X, 0, -Z, 0, h, -Z, X, 0, -Z, -X, 0, Z, X, 0, Z, 0, h, Z];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return part(g, color);
}
export function fountainGeo() { return merge([part(CYL, 0xd8d0c0, [0, 0.3, 0], [0, 0, 0], [3.2, 0.6, 3.2]), part(CYL, 0x5fb8e8, [0, 0.58, 0], [0, 0, 0], [2.8, 0.06, 2.8]), part(CYL6, 0xd8d0c0, [0, 1.2, 0], [0, 0, 0], [0.4, 1.6, 0.4]), part(SPH0, 0xbfe6ff, [0, 2.1, 0], [0, 0, 0], [0.8, 0.5, 0.8])]); }
export function doorGeo(wide) { return merge([part(BOX, 0x5a3a24, [0, 1.1, 0], [0, 0, 0], [wide ? 3 : 1.1, 2.2, 0.08]), part(BOX, 0xffe9a8, [0, 2.45, 0.05], [0, 0, 0], [wide ? 3.2 : 1.3, 0.2, 0.12])]); }
