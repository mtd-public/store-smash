// Procedural low-poly models, in Dr. Mow's flat-shaded toy style: the shopper and cart, the dasher's hatchback,
// every product on the list, parked cars and props. Everything is built from primitives with the colour baked
// into the vertices, so static things merge into one draw call and one shared material serves them all.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from './vendor/addons/BufferGeometryUtils.js';
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
export function productMesh(id) { const m = new THREE.Mesh(productGeo(id), VCOL); m.castShadow = true; return ink(m); }

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
// Characters and their cars are toon-shaded (three tones) with ink outlines, so they read as cartoons against the
// flat-shaded level.
const RAMP = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 200, 200, 200, 255, 255, 255, 255, 255]), 3, 1);
RAMP.minFilter = RAMP.magFilter = THREE.NearestFilter; RAMP.needsUpdate = true;
export const TOON = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: RAMP });
// Ink: an inverted hull pushed out along smoothed normals, a near-constant width on screen at any distance.
export const INK = new THREE.MeshBasicMaterial({ color: 0x2a1a2e, side: THREE.BackSide });
INK.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  { vec4 inkP = modelViewMatrix * vec4(transformed, 1.0); transformed += normalize(normal) * clamp(-inkP.z * 0.0012, 0.015, 0.13); }`);
};
const inkGeos = new WeakMap();
function inkGeo(geo) {
  let g = inkGeos.get(geo);
  if (!g) {
    const p = new THREE.BufferGeometry(); p.setAttribute('position', geo.attributes.position.clone());
    g = mergeVertices(p, 1e-3); g.computeVertexNormals(); inkGeos.set(geo, g);
  }
  return g;
}
// Give every mesh under root an ink outline (not the faces, not x-ray twins).
export function ink(root) {
  const meshes = [];
  root.traverse((o) => { if (o.isMesh && !o.userData.face && !o.userData.xray && !o.userData.ink && !o.userData.noInk) meshes.push(o); });
  for (const o of meshes) { const m = new THREE.Mesh(inkGeo(o.geometry), INK); m.userData.ink = true; m.castShadow = false; m.raycast = () => {}; o.add(m); }
  return root;
}

// A box with rounded edges and corners (normals exact), for the bubbly cars, the bag and the cart's bumpers.
const RB = new Map(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
export function roundBox(w, h, d, r, seg = 4) {
  const key = [w, h, d, r, seg].join();
  if (RB.has(key)) return RB.get(key);
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg), P = g.attributes.position, N = g.attributes.normal;
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r, cl = (v, m) => Math.max(-m, Math.min(m, v));
  for (let i = 0; i < P.count; i++) {
    _a.fromBufferAttribute(P, i); _b.set(cl(_a.x, hx), cl(_a.y, hy), cl(_a.z, hz));
    _a.sub(_b); const l = _a.length() || 1; _a.multiplyScalar(1 / l);
    N.setXYZ(i, _a.x, _a.y, _a.z); _a.multiplyScalar(r).add(_b); P.setXYZ(i, _a.x, _a.y, _a.z);
  }
  RB.set(key, g);
  return g;
}
// A cylinder from point a to point b (limbs).
const CYLS = new THREE.CylinderGeometry(1, 1, 1, 10);
function limb(color, a, b, r) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
  const g = part(CYLS, color, [0, 0, 0], [0, 0, 0], [r, len, r]);
  g.applyMatrix4(_m.compose(A.add(B).multiplyScalar(0.5), _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), _s.set(1, 1, 1)));
  return g;
}
const BALL = new THREE.IcosahedronGeometry(0.5, 2);
const HAIR = [0x3b2a20, 0x7a4a2a, 0xe8c070, 0x1e1e22, 0xc0542a, 0x8a3a5a];
const SKIN = [0xf2c6a0, 0xe0a97a, 0xb8794e, 0x8a5634, 0xf6d3b5];
const shade = (c, k) => { _c.set(c); _c.multiplyScalar(k); return _c.getHex(); };

// Group layout: root at the body centre on the ground, facing +z. The cart sits ahead (+z), the shopper behind.
export function makeShopper(color) {
  const root = new THREE.Group();
  const shirt = color, skin = SKIN[(color >> 3) % SKIN.length], hair = HAIR[(color >> 7) % HAIR.length], pants = 0x3b4a66;
  const body = new THREE.Group(); body.position.set(0, 0, -0.55); root.add(body);
  // a round delivery jacket leaning into the push, white collar and chest logo; the insulated bag on the back;
  // sleeves out to the handle, round mitten hands
  const torso = new THREE.Mesh(merge([
    part(BALL, pants, [0, 0.7, -0.02], [0, 0, 0], [0.42, 0.34, 0.34]),
    part(BALL, shirt, [0, 1.0, 0.02], [0.28, 0, 0], [0.54, 0.66, 0.44]),
    part(new THREE.TorusGeometry(0.15, 0.045, 6, 14), 0xffffff, [0, 1.3, 0.08], [Math.PI / 2 + 0.28, 0, 0], [1, 1, 1]),
    part(CYL, 0xffffff, [0, 1.08, 0.235], [Math.PI / 2 + 0.28, 0, 0], [0.18, 0.02, 0.18]),
    part(CYL, shade(shirt, 0.8), [0, 1.08, 0.245], [Math.PI / 2 + 0.28, 0, 0], [0.1, 0.02, 0.1]),
    part(roundBox(0.5, 0.52, 0.3, 0.08), 0xf4f1ea, [0, 1.12, -0.3], [0.28, 0, 0]),       // the bag
    part(roundBox(0.52, 0.12, 0.32, 0.05), shirt, [0, 1.32, -0.36], [0.28, 0, 0]),       // its lid band
    part(roundBox(0.2, 0.2, 0.04, 0.04), shirt, [0, 1.06, -0.47], [0.28, 0, 0]),         // its logo
    limb(shirt, [-0.25, 1.2, 0.04], [-0.3, 1.02, 0.3], 0.085), limb(shirt, [0.25, 1.2, 0.04], [0.3, 1.02, 0.3], 0.085),
    limb(skin, [-0.3, 1.02, 0.3], [-0.24, 0.98, 0.5], 0.065), limb(skin, [0.3, 1.02, 0.3], [0.24, 0.98, 0.5], 0.065),
    part(BALL, skin, [-0.24, 0.98, 0.53], [0, 0, 0], [0.17, 0.15, 0.17]), part(BALL, skin, [0.24, 0.98, 0.53], [0, 0, 0], [0.17, 0.15, 0.17]),
  ]), TOON);
  // a big chibi head (Dr. Mow proportions) so the cartoon faces read from the isometric camera: hair under a
  // delivery cap with a button on top
  const head = new THREE.Mesh(merge([
    part(BALL, skin, [0, 0, 0], [0, 0, 0], [0.56, 0.58, 0.56]),
    part(BALL, hair, [0, 0.03, -0.12], [0, 0, 0], [0.6, 0.54, 0.44]),                            // hair at the back
    part(BALL, hair, [-0.12, 0.17, 0.2], [0.6, 0, 0.3], [0.2, 0.1, 0.14]), part(BALL, hair, [0.07, 0.18, 0.21], [0.6, 0, -0.2], [0.2, 0.1, 0.14]), // a fringe
    part(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), color, [0, 0.1, -0.02], [0, 0, 0], [0.62, 0.44, 0.62]), // cap
    part(CYL, color, [0, 0.11, 0.27], [0.12, 0, 0], [0.42, 0.035, 0.3]),                        // brim
    part(BALL, 0xffffff, [0, 0.32, -0.02], [0, 0, 0], [0.08, 0.06, 0.08]),                      // button
    part(BALL, skin, [-0.29, -0.02, 0], [0, 0, 0], [0.1, 0.14, 0.1]), part(BALL, skin, [0.29, -0.02, 0], [0, 0, 0], [0.1, 0.14, 0.1]), // ears
  ]), TOON);
  head.position.set(0, 1.62, 0.06);
  const face = addFaces(head, 0.28, 0.58 / 0.56);
  // legs: short and round, chunky sneakers with soles in the dasher's colour
  const legGeo = merge([limb(pants, [0, 0.02, 0], [0, -0.42, 0.02], 0.09), part(BALL, 0xffffff, [0, -0.47, 0.07], [0, 0, 0], [0.2, 0.15, 0.32]), part(roundBox(0.2, 0.05, 0.33, 0.02), shirt, [0, -0.54, 0.07])]);
  const legL = new THREE.Mesh(legGeo, TOON), legR = new THREE.Mesh(legGeo, TOON);
  legL.position.set(-0.12, 0.6, 0); legR.position.set(0.12, 0.6, 0);
  body.add(torso, head, legL, legR);
  // the cart: a wire basket on four casters, the handle and bumpers in the dasher's colour, and a pennant on a
  // whip so you can pick your cart out of a crowd
  const cart = new THREE.Group(); cart.position.set(0, 0, 0.42); root.add(cart);
  const wire = 0xc9d2dc;
  const cartParts = [part(roundBox(0.66, 0.08, 0.08, 0.035), color, [0, 0.98, -0.42])];
  const bars = (x0, x1, y0, y1, z0, z1) => cartParts.push(part(BOX, wire, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [0, 0, 0], [Math.max(0.03, x1 - x0), Math.max(0.03, y1 - y0), Math.max(0.03, z1 - z0)]));
  for (const y of [0.45, 0.68, 0.92]) { bars(-0.3, 0.3, y, y, -0.38, -0.38); bars(-0.33, 0.33, y, y, 0.42, 0.42); bars(-0.31, -0.31, y, y, -0.38, 0.42); bars(0.31, 0.31, y, y, -0.38, 0.42); }
  for (const x of [-0.31, 0.31]) for (const z of [-0.38, 0.42]) bars(x, x, 0.45, 0.92, z, z);
  for (const x of [-0.15, 0, 0.15]) { bars(x, x, 0.45, 0.92, 0.42, 0.42); bars(x, x, 0.45, 0.92, -0.38, -0.38); }
  for (const z of [-0.12, 0.15]) { bars(-0.31, -0.31, 0.45, 0.92, z, z); bars(0.31, 0.31, 0.45, 0.92, z, z); }
  cartParts.push(part(BOX, 0xaab4c0, [0, 0.45, 0.02], [0, 0, 0], [0.62, 0.02, 0.8]));          // basket floor
  cartParts.push(part(BOX, 0x8a96a4, [0, 0.16, 0.02], [0, 0, 0], [0.5, 0.03, 0.72]));          // under-rack
  for (const x of [-0.24, 0.24]) for (const z of [-0.3, 0.36]) cartParts.push(part(BOX, 0x8a96a4, [x, 0.27, z], [0, 0, 0], [0.03, 0.3, 0.03]), part(CYL, 0x2b2b30, [x, 0.08, z], [0, 0, Math.PI / 2], [0.15, 0.06, 0.15]));
  cartParts.push(part(roundBox(0.72, 0.1, 0.1, 0.045), color, [0, 0.45, 0.45]));                // front bumper
  cartParts.push(part(roundBox(0.5, 0.2, 0.03, 0.01), color, [0, 0.95, 0.44]));                 // the dasher logo plate
  cartParts.push(part(BALL, 0xffffff, [0, 0.95, 0.46], [0, 0, 0], [0.12, 0.12, 0.03]));
  cartParts.push(limb(0xd8dde4, [0.31, 0.92, -0.38], [0.36, 1.85, -0.44], 0.012));              // the whip…
  const flag = new THREE.BufferGeometry();
  flag.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, -0.26, 0, 0, -0.13, -0.42, 0, 0, 0, 0, -0.13, -0.42, 0, -0.26, 0], 3));
  flag.computeVertexNormals();
  cart.add(new THREE.Mesh(merge(cartParts), VCOL));
  const pennant = new THREE.Mesh(part(flag, color, [0.36, 1.86, -0.44]), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); // …and its pennant
  cart.add(pennant);
  const load = new THREE.Group(); load.position.set(0, 0.47, 0.02); cart.add(load);
  ink(body);
  root.traverse((o) => { if (o.isMesh && !o.userData.face && !o.userData.ink) o.castShadow = true; });
  return { root, body, head, legL, legR, cart, load, items: [], face, pennant };
}

// ---------------------------------------------------------------- cars
// A bubbly little hatchback: rounded body and cabin, a glass band all round, a lit DASH sign on the roof.
export function carGeo(color, { sign = null, dark = false } = {}) {
  const glass = dark ? 0x23303f : 0x2f4a66, trim = 0x2b2b30;
  const parts = [
    part(roundBox(1.9, 0.78, 4.2, 0.3), color, [0, 0.68, 0]),                       // body
    part(roundBox(1.64, 0.76, 2.36, 0.32), color, [0, 1.3, -0.32]),                  // cabin
    part(roundBox(1.68, 0.4, 2.1, 0.18), glass, [0, 1.3, -0.3]),                      // the glass band
    part(roundBox(1.95, 0.22, 0.24, 0.1), trim, [0, 0.42, 2.06]),                     // bumpers
    part(roundBox(1.95, 0.22, 0.24, 0.1), trim, [0, 0.42, -2.06]),
    part(BALL, 0xfff3c4, [-0.6, 0.78, 2.03], [0, 0, 0], [0.36, 0.26, 0.14]),           // round headlights
    part(BALL, 0xfff3c4, [0.6, 0.78, 2.03], [0, 0, 0], [0.36, 0.26, 0.14]),
    part(BALL, 0xd33a3a, [-0.66, 0.8, -2.04], [0, 0, 0], [0.3, 0.18, 0.1]),
    part(BALL, 0xd33a3a, [0.66, 0.8, -2.04], [0, 0, 0], [0.3, 0.18, 0.1]),
    part(roundBox(0.6, 0.08, 0.04, 0.02), trim, [0, 0.62, 2.12]),                    // grille smile
  ];
  for (const z of [1.32, -1.32]) for (const x of [-0.9, 0.9]) parts.push(part(CYL, shade(color, 0.6), [x, 0.5, z], [0, 0, Math.PI / 2], [0.86, 0.12, 0.86])); // wheel arches
  if (sign) parts.push(part(roundBox(1.0, 0.36, 0.34, 0.1), 0xffffff, [0, 1.84, -0.35]), part(roundBox(1.02, 0.14, 0.36, 0.05), sign, [0, 1.84, -0.35]), part(BOX, trim, [0, 1.67, -0.35], [0, 0, 0], [0.5, 0.06, 0.12]));
  return merge(parts);
}
const WHEEL = merge([part(CYL, 0x1e1e22, [0, 0, 0], [0, 0, Math.PI / 2], [0.74, 0.34, 0.74]), part(CYL, 0xe8ebf0, [0, 0, 0], [0, 0, Math.PI / 2], [0.38, 0.36, 0.38]), part(CYL, 0x9aa3ad, [0, 0, 0], [0, 0, Math.PI / 2], [0.14, 0.38, 0.14])]);
export const WHEEL_POS = [[-0.86, 0.37, 1.32], [0.86, 0.37, 1.32], [-0.86, 0.37, -1.32], [0.86, 0.37, -1.32]];
export function parkedCarGeo(color) { return merge([carGeo(color, { dark: true }), ...WHEEL_POS.map((p) => place(WHEEL, ...p))]); }

export function makeCar(color) {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const shell = new THREE.Mesh(carGeo(color, { sign: color }), TOON);
  body.add(shell);
  const wheels = WHEEL_POS.map(([x, y, z]) => { const w = new THREE.Mesh(WHEEL, TOON); w.position.set(x, y, z); root.add(w); return w; });
  const driver = new THREE.Mesh(merge([part(BALL, 0xf2c6a0, [0, 0, 0], [0, 0, 0], [0.36, 0.38, 0.36]), part(new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), color, [0, 0.06, 0], [0, 0, 0], [0.4, 0.3, 0.4])]), TOON);
  driver.position.set(-0.4, 1.32, -0.2); body.add(driver); driver.visible = false;
  ink(root);
  root.traverse((o) => { if (o.isMesh && !o.userData.ink) o.castShadow = true; });
  return { root, body, shell, wheels, driver };
}

// ---------------------------------------------------------------- props
export function lampGeo() { return merge([part(CYL6, 0x5a6270, [0, 3.5, 0], [0, 0, 0], [0.18, 7, 0.18]), part(BOX, 0x5a6270, [0.6, 7, 0], [0, 0, 0], [1.4, 0.12, 0.2]), part(BOX, 0xfff3c4, [1.1, 6.9, 0], [0, 0, 0], [0.5, 0.08, 0.3])]); }
export function registerGeo() { return merge([part(BOX, 0x2b2b30, [0, 0.15, 0], [0, 0, 0], [0.5, 0.3, 0.4]), part(BOX, 0x47c4ff, [0, 0.42, -0.05], [-0.4, 0, 0], [0.4, 0.28, 0.04])]); }
export function corralGeo(w, d) {
  const out = [], c = 0x9fb4c8;
  for (const [x0, x1, z0, z1] of [[-w / 2, w / 2, -d / 2, -d / 2], [-w / 2, w / 2, d / 2, d / 2], [-w / 2, -w / 2, -d / 2, d / 2]]) out.push(part(BOX, c, [(x0 + x1) / 2, 1.05, (z0 + z1) / 2], [0, 0, 0], [Math.max(0.08, x1 - x0), 0.08, Math.max(0.08, z1 - z0)]));
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) out.push(part(CYL6, c, [x, 0.55, z], [0, 0, 0], [0.08, 1.1, 0.08]));
  return merge(out);
}
export function fountainGeo() { return merge([part(CYL, 0xd8d0c0, [0, 0.3, 0], [0, 0, 0], [3.2, 0.6, 3.2]), part(CYL, 0x5fb8e8, [0, 0.58, 0], [0, 0, 0], [2.8, 0.06, 2.8]), part(CYL6, 0xd8d0c0, [0, 1.2, 0], [0, 0, 0], [0.4, 1.6, 0.4]), part(SPH0, 0xbfe6ff, [0, 2.1, 0], [0, 0, 0], [0.8, 0.5, 0.8])]); }
export function doorGeo(wide) { return merge([part(BOX, 0x5a3a24, [0, 1.1, 0], [0, 0, 0], [wide ? 3 : 1.1, 2.2, 0.08]), part(BOX, 0xffe9a8, [0, 2.45, 0.05], [0, 0, 0], [wide ? 3.2 : 1.3, 0.2, 0.12])]); }
