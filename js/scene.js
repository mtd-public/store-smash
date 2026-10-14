// The renderer: builds the level from js/level.js data (merged by material, one draw call per look), dresses it,
// draws every dasher from their bodies, and renders one pane per local player (split screen for two).
//
// Seeing through geometry is Dr. Mow's see-through level (js/seethru.js, copied as is): every level material
// gets a fragment step that dithers away whatever stands between the camera and *your* dasher — shelves, the
// upper floor's slab when you're under it, the garage deck, towers, trees — in a cone round the camera→you line,
// above your wheels. On top of that the store's roof and the upper half of its walls are cut away while you're
// inside (a roof would leave only a keyhole). Both are set per pane, so in split screen each player gets their own.
import * as THREE from 'three';
import { seeThroughGroup, seeInPlace, updateSee, SEE } from './seethru.js';
import { heightAt, ceilingAt } from './world.js';
import { CAMERA, HANDLING } from './tuning.js';
import { G, F2, EDGE, PITCH, CITY, DEPTS } from './level.js';
import { bodyOf } from './match.js';
import { PRODUCT } from './order.js';
import { mulberry32, damp, wrapAngle, clamp } from './utils.js';
import * as MD from './models.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const LOOK = (CAMERA.YAW * Math.PI) / 180, PITCHR = (CAMERA.PITCH * Math.PI) / 180;
const CAM_DIR = new THREE.Vector3(Math.sin(LOOK) * Math.cos(PITCHR), Math.sin(PITCHR), Math.cos(LOOK) * Math.cos(PITCHR));

// ---------------------------------------------------------------- textures (canvas, no image files)
function canvasTex(size, draw, { repeat = 1, alpha = false } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.repeat.set(1 / repeat, 1 / repeat);
  t.userData.alpha = alpha;
  return t;
}
const noise = (g, s, base, spread, n = 900, sz = 2) => { g.fillStyle = base; g.fillRect(0, 0, s, s); for (let i = 0; i < n; i++) { const v = Math.random() * spread - spread / 2; g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v)})`; g.fillRect(Math.random() * s, Math.random() * s, sz, sz); } };
const PRODUCT_COLORS = ['#e8423b', '#f2c14e', '#3a8fe8', '#5bbf4a', '#ff8fb1', '#a77be0', '#ffffff', '#ff8a2a', '#1fb5a8', '#2b3a66'];
function makeTextures() {
  const T = {};
  T.tiles = canvasTex(128, (g, s) => { g.fillStyle = '#f4efe6'; g.fillRect(0, 0, s, s); g.fillStyle = '#e4ded3'; g.fillRect(0, 0, s / 2, s / 2); g.fillRect(s / 2, s / 2, s / 2, s / 2); g.strokeStyle = '#cfc8bb'; g.lineWidth = 2; for (const k of [0, s / 2]) { g.strokeRect(k, 0, s / 2, s / 2); g.strokeRect(k, s / 2, s / 2, s / 2); } }, { repeat: 2 });
  T.tiles2 = canvasTex(128, (g, s) => { g.fillStyle = '#e9e2f2'; g.fillRect(0, 0, s, s); g.strokeStyle = '#d4cbe2'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(0, i * s / 4); g.lineTo(s, i * s / 4); g.stroke(); g.beginPath(); g.moveTo(((i * 37) % 4) * s / 4 + s / 8, i * s / 4); g.lineTo(((i * 37) % 4) * s / 4 + s / 8, (i + 1) * s / 4); g.stroke(); } }, { repeat: 3 });
  T.sidewalk = canvasTex(128, (g, s) => { noise(g, s, '#dcd7cf', 0.08, 600); g.strokeStyle = '#bdb6aa'; g.lineWidth = 3; g.strokeRect(0, 0, s, s); }, { repeat: 1.6 });
  T.asphalt = canvasTex(256, (g, s) => noise(g, s, '#55565c', 0.12, 3000, 2), { repeat: 6 });
  T.grass = canvasTex(256, (g, s) => { noise(g, s, '#86d46f', 0.14, 2500, 3); }, { repeat: 5 });
  T.pavers = canvasTex(128, (g, s) => { g.fillStyle = '#c9b79c'; g.fillRect(0, 0, s, s); g.strokeStyle = '#a8957a'; g.lineWidth = 3; for (let r = 0; r < 4; r++) { g.beginPath(); g.moveTo(0, r * s / 4); g.lineTo(s, r * s / 4); g.stroke(); for (let k = 0; k < 2; k++) { const x = k * s / 2 + (r % 2) * s / 4; g.beginPath(); g.moveTo(x, r * s / 4); g.lineTo(x, (r + 1) * s / 4); g.stroke(); } } }, { repeat: 1.6 });
  T.plaza = canvasTex(128, (g, s) => { noise(g, s, '#cfc6b8', 0.06, 400); g.strokeStyle = '#b6ac9b'; g.lineWidth = 2; g.strokeRect(0, 0, s, s); g.strokeRect(0, 0, s / 2, s / 2); }, { repeat: 4 });
  T.concrete = canvasTex(256, (g, s) => noise(g, s, '#b8b8bc', 0.08, 1500, 3), { repeat: 5 });
  T.wall = canvasTex(128, (g, s) => { g.fillStyle = '#f3eadb'; g.fillRect(0, 0, s, s); g.fillStyle = '#e6dac6'; g.fillRect(0, s - 10, s, 10); g.strokeStyle = '#e3d7c3'; g.lineWidth = 2; g.beginPath(); g.moveTo(s / 2, 0); g.lineTo(s / 2, s); g.stroke(); }, { repeat: 4 });
  T.shelf = canvasTex(256, (g, s) => {
    g.fillStyle = '#eef1f5'; g.fillRect(0, 0, s, s);
    const rows = [0.04, 0.29, 0.54, 0.79];
    for (const r of rows) {
      let x = 2;
      while (x < s - 4) {
        const w = 10 + Math.random() * 22, h = s * (0.12 + Math.random() * 0.09);
        g.fillStyle = PRODUCT_COLORS[Math.floor(Math.random() * PRODUCT_COLORS.length)];
        g.fillRect(x, s * (1 - r) - 8 - h, w - 2, h);
        g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(x + 2, s * (1 - r) - 8 - h + 4, (w - 6) * 0.6, 3);
        x += w;
      }
      g.fillStyle = '#9aa4b2'; g.fillRect(0, s * (1 - r) - 8, s, 8);
    }
  }, { repeat: 2.2 });
  T.towers = canvasTex(256, (g, s) => { g.fillStyle = '#e8eef5'; g.fillRect(0, 0, s, s); for (let i = 0; i < 2; i++) for (let k = 0; k < 2; k++) { g.fillStyle = Math.random() < 0.2 ? '#fff2b0' : '#5d7fa6'; g.fillRect(i * s / 2 + 10, k * s / 2 + 16, s / 2 - 20, s / 2 - 34); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(i * s / 2 + 14, k * s / 2 + 20, 10, s / 2 - 44); } }, { repeat: 7 });
  T.apartment = canvasTex(256, (g, s) => { g.fillStyle = '#f2ece2'; g.fillRect(0, 0, s, s); for (let i = 0; i < 2; i++) { g.fillStyle = '#6e8fb3'; g.fillRect(i * s / 2 + 26, 40, s / 2 - 52, s / 2); g.fillStyle = '#ffffff'; g.fillRect(i * s / 2 + 14, 40 + s / 2, s / 2 - 28, 10); g.fillStyle = '#d8cfc0'; g.fillRect(0, s - 18, s, 18); } }, { repeat: 6 });
  T.house = canvasTex(128, (g, s) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s); g.strokeStyle = 'rgba(0,0,0,0.08)'; for (let y = 0; y < s; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke(); } g.fillStyle = '#5d7fa6'; g.fillRect(s * 0.3, s * 0.25, s * 0.4, s * 0.35); g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.strokeRect(s * 0.3, s * 0.25, s * 0.4, s * 0.35); }, { repeat: 4 });
  T.fence = canvasTex(64, (g, s) => { g.clearRect(0, 0, s, s); g.strokeStyle = '#2f8a55'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(s, s); g.moveTo(s, 0); g.lineTo(0, s); g.stroke(); g.lineWidth = 6; g.strokeRect(0, 0, s, s); }, { repeat: 0.5, alpha: true });
  T.travelator = canvasTex(64, (g, s) => { g.fillStyle = '#8a91a0'; g.fillRect(0, 0, s, s); g.fillStyle = '#a9b0bd'; for (let i = 0; i < s; i += 8) g.fillRect(i, 0, 3, s); }, { repeat: 1 });
  T.stunt = canvasTex(64, (g, s) => { g.fillStyle = '#f2c14e'; g.fillRect(0, 0, s, s); g.fillStyle = '#2b2b30'; for (let i = -s; i < s * 2; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 16, 0); g.lineTo(i + 16 - s, s); g.lineTo(i - s, s); g.fill(); } }, { repeat: 3 });
  T.water = canvasTex(128, (g, s) => { g.fillStyle = '#5fb8e8'; g.fillRect(0, 0, s, s); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; for (let i = 0; i < 9; i++) { const x = Math.random() * s, y = Math.random() * s; g.beginPath(); g.arc(x, y, 6 + Math.random() * 10, 0.2, 2.6); g.stroke(); } }, { repeat: 6 });
  T.hedge = canvasTex(128, (g, s) => noise(g, s, '#3e8f4a', 0.2, 1500, 4), { repeat: 2 });
  T.wood = canvasTex(64, (g, s) => { g.fillStyle = '#9a6b42'; g.fillRect(0, 0, s, s); g.fillStyle = '#7f5634'; for (let y = 0; y < s; y += 16) g.fillRect(0, y, s, 3); }, { repeat: 1 });
  T.roofTop = canvasTex(128, (g, s) => { noise(g, s, '#d8d2c6', 0.06, 500); g.fillStyle = '#b9b2a4'; g.fillRect(s * 0.2, s * 0.2, s * 0.25, s * 0.18); }, { repeat: 8 });
  return T;
}

// One look per material key (the colour of each plat is in its vertices and multiplies the texture).
function makeMaterials(T) {
  const lam = (o = {}) => new THREE.MeshLambertMaterial({ vertexColors: true, ...o });
  return {
    storeFloor: lam({ map: T.tiles }), storeFloor2: lam({ map: T.tiles2 }), sidewalk: lam({ map: T.sidewalk }), lot: lam({ map: T.asphalt }),
    grass: lam({ map: T.grass }), pavers: lam({ map: T.pavers }), plaza: lam({ map: T.plaza }), concrete: lam({ map: T.concrete }), deck: lam({ map: T.concrete }),
    wall: lam({ map: T.wall }), wallTop: lam(), roof: lam({ map: T.roofTop }), glass: new THREE.MeshLambertMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.32, depthWrite: false }),
    shelf: lam({ map: T.shelf }), shelfTop: lam(), rack: lam({ map: T.wood }), rackTop: lam({ map: T.wood }), bin: lam({ map: T.wood }), binTop: lam(), bench: lam({ map: T.wood }),
    counter: lam(), rail: lam(), travelator: lam({ map: T.travelator }), fence: lam({ map: T.fence, alphaTest: 0.5, side: THREE.DoubleSide }),
    house: lam({ map: T.house }), apartment: lam({ map: T.apartment }), tower: lam({ map: T.towers }), roofFlat: lam(),
    water: lam({ map: T.water, emissive: 0x0a2a3a }), hedge: lam({ map: T.hedge }), stunt: lam({ map: T.stunt }),
  };
}
const TOP_MAT = { shelf: 'shelfTop', rack: 'rackTop', bin: 'binTop', wall: 'wallTop', house: 'roofFlat', apartment: 'roofFlat', tower: 'roofFlat', counter: 'counter', hedge: 'hedge' };
const NO_SHADOW_TAGS = new Set(['storeRoof', 'storeUpper', 'mezz', 'deck', 'bridge']);

// ---------------------------------------------------------------- level geometry (UVs in metres)
class Bucket {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; }
  quad(a, b, c, d, uva, uvb, uvc, uvd, color) {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]], l = Math.hypot(...n) || 1;
    for (const [p, u] of [[a, uva], [b, uvb], [c, uvc], [a, uva], [c, uvc], [d, uvd]]) { this.pos.push(...p); this.nor.push(n[0] / l, n[1] / l, n[2] / l); this.uv.push(...u); this.col.push(color.r, color.g, color.b); }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}
const _col = new THREE.Color();
function addPlat(buckets, p) {
  const key = (m) => `${m}|${p.tag || ''}`;
  const get = (k) => buckets.get(k) || buckets.set(k, new Bucket()).get(k);
  const side = get(key(p.mat)), top = get(key(TOP_MAT[p.mat] || p.mat));
  const color = _col.set(p.color ?? 0xffffff).clone(), topColor = TOP_MAT[p.mat] === 'shelfTop' || TOP_MAT[p.mat] === 'binTop' ? color : TOP_MAT[p.mat] ? _col.set(p.mat === 'wall' ? 0xe6dac6 : p.mat === 'counter' ? p.color : 0xb9b4ac).clone() : color;
  const x0 = p.x - p.w / 2, x1 = p.x + p.w / 2, z0 = p.z - p.d / 2, z1 = p.z + p.d / 2, b = p.bot;
  const h = (x, z) => heightAt(p, x, z);
  const h00 = h(x0, z0), h10 = h(x1, z0), h01 = h(x0, z1), h11 = h(x1, z1);
  top.quad([x0, h00, z0], [x0, h01, z1], [x1, h11, z1], [x1, h10, z0], [x0, z0], [x0, z1], [x1, z1], [x1, z0], topColor);
  if (p.floor && p.thick >= 0.9 && p.top <= 0.2) { // (ground slabs: only the curb shows)
    const cb = 0;
    side.quad([x0, cb, z1], [x1, cb, z1], [x1, h11, z1], [x0, h01, z1], [x0, 0], [x1, 0], [x1, h11], [x0, h01], color);
    side.quad([x1, cb, z0], [x0, cb, z0], [x0, h00, z0], [x1, h10, z0], [-x1, 0], [-x0, 0], [-x0, h00], [-x1, h10], color);
    side.quad([x1, cb, z1], [x1, cb, z0], [x1, h10, z0], [x1, h11, z1], [-z1, 0], [-z0, 0], [-z0, h10], [-z1, h11], color);
    side.quad([x0, cb, z0], [x0, cb, z1], [x0, h01, z1], [x0, h00, z0], [z0, 0], [z1, 0], [z1, h01], [z0, h00], color);
    return;
  }
  side.quad([x0, b, z1], [x1, b, z1], [x1, h11, z1], [x0, h01, z1], [x0, 0], [x1, 0], [x1, h11 - b], [x0, h01 - b], color);       // south (+z)
  side.quad([x1, b, z0], [x0, b, z0], [x0, h00, z0], [x1, h10, z0], [-x1, 0], [-x0, 0], [-x0, h00 - b], [-x1, h10 - b], color);   // north
  side.quad([x1, b, z1], [x1, b, z0], [x1, h10, z0], [x1, h11, z1], [-z1, 0], [-z0, 0], [-z0, h10 - b], [-z1, h11 - b], color);   // east
  side.quad([x0, b, z0], [x0, b, z1], [x0, h01, z1], [x0, h00, z0], [z0, 0], [z1, 0], [z1, h01 - b], [z0, h00 - b], color);       // west
  if (p.tag === 'mezz' || p.tag === 'deck' || p.tag === 'bridge') // (an underside you see from the floor below, through the hole)
    side.quad([x0, b, z0], [x1, b, z0], [x1, b, z1], [x0, b, z1], [x0, z0], [x1, z0], [x1, z1], [x0, z1], _col.set(0xdcd6cc).clone());
}

// ---------------------------------------------------------------- the view
export class View {
  constructor(canvas, L, W) {
    this.canvas = canvas; this.L = L; this.W = W;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.setClearColor(0xbfe3ff);
    const S = (this.scene = new THREE.Scene());
    S.background = new THREE.Color(0xbfe3ff);
    S.fog = new THREE.Fog(0xcfe9ff, 120, 420);
    S.add(new THREE.HemisphereLight(0xeaf4ff, 0x8f8a7a, 1.15));
    const sun = (this.sun = new THREE.DirectionalLight(0xfff4e0, 1.6));
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
    this.sunOff = new THREE.Vector3(-30, 60, 38);
    S.add(sun, sun.target);
    this.T = makeTextures(); this.M = makeMaterials(this.T);
    this.cut = { storeRoof: [], storeUpper: [] };
    this.cams = [0, 1].map(() => ({ cam: new THREE.PerspectiveCamera(CAMERA.FOV, 1, 0.5, 900), focus: new THREE.Vector3(), view: CAMERA.VIEW_CART, yaw: null, mode: 'iso', ready: false }));
    this.cams.forEach((c, k) => { c.cam.layers.enable(k + 1); });
    this.chase = false;
    this.buildLevel();
    this.fx = new FX(S);
    this.tags = [];
    this.flying = [];
    this.panes = [];
  }

  // ------------------------------------------------------------ static level
  buildLevel() {
    const L = this.L, S = this.scene, rng = mulberry32(7);
    const level = (this.level = new THREE.Group());
    S.add(level);
    // the road surface: one plane under everything
    const groundTex = this.T.asphalt.clone(); groundTex.needsUpdate = true; groundTex.repeat.set(560 / 6, 560 / 6);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), new THREE.MeshLambertMaterial({ map: groundTex, color: 0x9a9ba2 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; level.add(ground);
    const buckets = new Map();
    for (const p of L.plats) if (!p.hidden) addPlat(buckets, p);
    for (const [k, b] of buckets) {
      const [mat, tag] = k.split('|');
      const mesh = new THREE.Mesh(b.geometry(), this.M[mat] || this.M.wall);
      mesh.receiveShadow = true; mesh.castShadow = !NO_SHADOW_TAGS.has(tag) && !/^(lot|grass|sidewalk|plaza|pavers|storeFloor|concrete|water)$/.test(mat);
      mesh.userData.tag = tag;
      if (this.cut[tag]) this.cut[tag].push(mesh);
      level.add(mesh);
    }
    this.buildMarkings(level);
    this.buildDecor(level, rng);
    this.buildSigns(level);
    seeThroughGroup(level); // (after every level mesh is in: they all get the veil; dashers never do)
  }

  buildMarkings(level) {
    const L = this.L, white = [], yellow = [];
    const stripe = (arr, x, z, w, d, y = 0.012) => arr.push(MD.part(new THREE.PlaneGeometry(1, 1), 0xffffff, [x, y, z], [-Math.PI / 2, 0, 0], [w, d, 1]));
    const roads = [];
    for (let k = -CITY - 1; k <= CITY; k++) roads.push(k * PITCH + PITCH / 2);
    const isX = (v) => roads.some((r) => Math.abs(v - r) < 8);
    for (const r of roads) {
      for (let t = -EDGE + 2; t < EDGE - 2; t += 6) {
        if (isX(t) || isX(t + 3)) continue;
        stripe(yellow, t + 1.5, r, 3, 0.22); stripe(yellow, r, t + 1.5, 0.22, 3);
      }
      for (const c of roads) for (const s of [-1, 1]) for (let q = -5.5; q <= 5.5; q += 1.1) { // crosswalks
        stripe(white, c + s * 9.5, r + q, 2.6, 0.55); stripe(white, r + q, c + s * 9.5, 0.55, 2.6);
      }
    }
    for (const d of L.decor) {
      if (d.type === 'stalls') for (const s of d.list) { stripe(white, s.x - 1.4, s.z, 0.12, s.z1 - s.z0, G + 0.012); stripe(white, s.x + 1.4, s.z, 0.12, s.z1 - s.z0, G + 0.012); }
      if (d.type === 'garageStalls') for (const y of d.ys) for (let z = d.z0 - 1.45; z <= d.z1 + 1.46; z += d.step) stripe(white, d.x, z, 4.6, 0.12, y + 0.012);
      if (d.type === 'path') stripe(white, d.x, d.z, d.w, d.d, G + 0.01);
    }
    const mk = (arr, color) => { if (!arr.length) return; const m = new THREE.Mesh(MD.merge(arr), new THREE.MeshLambertMaterial({ color, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2 })); m.receiveShadow = true; level.add(m); };
    mk(white, 0xffffff); mk(yellow, 0xf2c14e);
  }

  buildDecor(level, rng) {
    const L = this.L, stat = [], trees = [];
    const lamp = MD.lampGeo(), reg = MD.registerGeo(), fountain = MD.fountainGeo();
    for (const d of L.decor) {
      if (d.type === 'tree') trees.push(d);
      else if (d.type === 'lamp') stat.push(MD.place(lamp, d.x, d.y, d.z, Math.atan2(-d.x, -d.z) - Math.PI / 2 + (Math.abs(d.x) > 38 ? Math.PI / 2 : 0)));
      else if (d.type === 'register') stat.push(MD.place(reg, d.x, d.y, d.z));
      else if (d.type === 'roof') stat.push(MD.place(MD.roofGeo(d.w, d.d, d.h, d.color), d.x, d.y, d.z));
      else if (d.type === 'parkedCar') stat.push(MD.place(MD.parkedCarGeo(d.color), d.x, d.y, d.z, d.heading));
      else if (d.type === 'corral') stat.push(MD.place(MD.corralGeo(d.w, d.d), d.x, d.y, d.z));
      else if (d.type === 'fountain') stat.push(MD.place(fountain, d.x, d.y, d.z));
      else if (d.type === 'door') stat.push(MD.place(MD.doorGeo(d.wide), d.x, d.y, d.z, d.rot));
      else if (d.type === 'canopy') stat.push(MD.part(new THREE.BoxGeometry(1, 1, 1), 0xbfe6ff, [d.x, d.y, d.z], [0, 0, 0], [d.w, 0.12, d.d]));
    }
    if (stat.length) { const m = new THREE.Mesh(MD.merge(stat), MD.VCOL); m.castShadow = m.receiveShadow = true; level.add(m); }
    // trees: two instanced meshes (trunks, crowns)
    const tg = MD.treeGeos();
    const trunk = new THREE.InstancedMesh(tg.trunk, MD.VCOL.clone(), trees.length), crown = new THREE.InstancedMesh(tg.crown, seeInPlace(MD.VCOL.clone()), trees.length);
    trees.forEach((t, i) => {
      const th = t.potted ? t.h * 0.45 : t.h * 0.45;
      trunk.setMatrixAt(i, _m4.compose(_v.set(t.x, t.y, t.z), _q.identity(), _s.set(1, th, 1)));
      crown.setMatrixAt(i, _m4.compose(_v.set(t.x, t.y + th + t.r * 0.55, t.z), _q.setFromEuler(_e.set(0, rng() * 6, 0)), _s.set(t.r, t.r, t.r)));
    });
    trunk.castShadow = crown.castShadow = true; crown.receiveShadow = true;
    level.add(trunk, crown);
  }

  buildSigns(level) {
    for (const s of this.L.signs) level.add(this.sign(s));
  }
  // A sign: a thin box with the text on both faces (canvas texture), hung on wires or stood on a post.
  sign(s) {
    const c = document.createElement('canvas'), ppm = 64;
    c.width = Math.min(2048, Math.round(s.w * ppm)); c.height = Math.round(s.h * ppm);
    const g = c.getContext('2d');
    g.fillStyle = s.bg; g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 6; g.strokeRect(6, 6, c.width - 12, c.height - 12);
    g.fillStyle = s.fg || '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const fam = s.font === 'logo' ? '"Luckiest Guy"' : '"Lilita One"';
    const lines = String(s.text).split('\n');
    let size = (c.height / lines.length) * 0.62;
    g.font = `${size}px ${fam}, sans-serif`;
    while (lines.some((t) => g.measureText(t).width > c.width * 0.9) && size > 8) { size -= 2; g.font = `${size}px ${fam}, sans-serif`; }
    lines.forEach((t, i) => g.fillText(t, c.width / 2, (c.height / lines.length) * (i + 0.5) + size * 0.06));
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const face = new THREE.MeshLambertMaterial({ map: tex, emissive: 0x222222 }), edge = new THREE.MeshLambertMaterial({ color: s.bg });
    const grp = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, 0.1), [edge, edge, edge, edge, face, face]);
    m.castShadow = true; grp.add(m);
    if (s.hang) for (const dx of [-s.w * 0.4, s.w * 0.4]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.2, 0.03), edge); w.position.set(dx, s.h / 2 + 0.6, 0); grp.add(w); }
    if (s.post) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, s.y - s.h / 2, 0.15), edge); p.position.set(0, -(s.y - s.h / 2) / 2 - s.h / 2, 0); grp.add(p); }
    grp.position.set(s.x, s.y, s.z); grp.rotation.y = s.rot || 0;
    if (s.tag && this.cut[s.tag]) this.cut[s.tag].push(grp);
    return grp;
  }

  // ------------------------------------------------------------ a match
  setMatch(M, locals) {
    this.clearMatch();
    this.Mt = M; this.locals = locals;
    const S = this.scene, L = this.L, root = (this.matchRoot = new THREE.Group());
    S.add(root);
    const deco = new THREE.Group(); root.add(deco); // (static for the match: gets the see-through veil)
    // this match's layout: what's on the shelves, the departments' colours on the shelf tops, their signs
    const shelf = [], rng = mulberry32(M.seed), bins = new Map();
    L.slots.forEach((s, k) => {
      const id = M.O.stock[k];
      if (!id) return;
      if (s.bin != null && PRODUCT[id].dept === 'produce') { if (!bins.has(s.bin)) { const q = L.slots.filter((o) => o.bin === s.bin); bins.set(s.bin, { id, x: q.reduce((a, o) => a + o.x, 0) / q.length, z: q.reduce((a, o) => a + o.z, 0) / q.length, y: s.y }); } return; }
      const g = MD.productGeo(id), rug = PRODUCT[id].dept === 'home';
      const n = s.rack || rug || s.table ? 1 : 3, scale = s.rack || s.table ? 1 : 0.85;
      for (let i = 0; i < n; i++) shelf.push(MD.place(g, s.x, s.y, s.z + (i - (n - 1) / 2) * 0.55, rug ? 0 : s.face + (rng() - 0.5) * 0.3, scale));
    });
    for (const b of bins.values()) shelf.push(MD.place(MD.heapGeo(b.id, rng), b.x, b.y, b.z));
    const heads = [];
    for (const [zid, dept] of Object.entries(M.O.layout)) {
      const Z = L.deptZones[zid], col = DEPTS[dept].color;
      for (const h of Z.headers || []) heads.push(MD.part(new THREE.BoxGeometry(1, 1, 1), col, [h.x, h.y + 0.06, (h.z0 + h.z1) / 2], [0, 0, 0], [1.26, 0.12, h.z1 - h.z0 + 0.04]));
      for (const sg of Z.signs) deco.add(this.sign({ ...sg, text: DEPTS[dept].name.toUpperCase(), bg: hex(col), fg: '#fff', hang: !sg.post, rot: 0 }));
    }
    const display = new THREE.Mesh(MD.merge([...shelf, ...heads]), MD.VCOL);
    display.castShadow = true; display.receiveShadow = true;
    deco.add(display);
    const upper = Object.entries(M.O.layout).filter(([z]) => z[0] === 'U').map(([, d]) => DEPTS[d].name.toUpperCase()).join(' · ');
    for (const f of L.floorSigns) deco.add(this.sign({ ...f, text: `UPPER FLOOR ↑  ${upper}`, bg: '#2b3a55', fg: '#ffe066' }));
    const dir = Object.entries(M.O.layout).map(([z, d]) => `${DEPTS[d].name} — ${L.deptZones[z].label}`);
    deco.add(this.sign({ ...L.directory, text: ['STORE DIRECTORY', ...dir].join('\n'), bg: '#2b3a55', fg: '#ffffff', post: true, rot: 0 }));
    seeThroughGroup(deco);
    // drop-offs: a pad at every order's address (lit while the order's still open)
    this.pads = M.board.map((o) => {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.06, 24), new THREE.MeshBasicMaterial({ color: 0x3fe07a, transparent: true, opacity: 0.7 }));
      pad.position.set(o.drop.x, o.drop.y + 0.04, o.drop.z); root.add(pad);
      const tag = textSprite(`${o.tag} · ${o.customer}`, '#2a8a52'); tag.position.set(o.drop.x, o.drop.y + 3.2, o.drop.z); root.add(tag);
      return { o, pad, tag };
    });
    // spilled items on the floor
    this.looseMeshes = new Map();
    // dashers
    this.ds = M.dashers.map((d) => {
      const shop = MD.makeShopper(d.color), car = MD.makeCar(d.color);
      root.add(shop.root, car.root);
      xray(shop.root, d.color); xray(car.root, d.color);
      const tag = nameTag(d.name, d.color);
      const stars = makeStars(); stars.visible = false;
      root.add(tag, stars);
      return { d, shop, car, tag, stars, walk: 0, wheel: 0, lean: 0, bagSig: '', props: [] };
    });
    // per local player: objective beams (car), a GPS line (car), glints over what you need nearby (store)
    this.guides = locals.map((li, k) => {
      const layer = k + 1, color = M.dashers[li].color;
      const beams = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.9, 1.3, 1, 10, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), 8);
      const glints = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: 0xffe066 }), 40);
      const chev = new THREE.InstancedMesh(chevronGeo(), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false }), 80);
      for (const o of [beams, glints, chev]) { o.layers.set(layer); o.count = 0; o.frustumCulled = false; root.add(o); }
      return { k, li, beams, glints, chev, layer };
    });
  }
  clearMatch() {
    if (!this.matchRoot) return;
    this.scene.remove(this.matchRoot);
    this.matchRoot = null; this.flying = []; this.ds = null; this.guides = null;
  }

  onEvent(e) {
    const M = this.Mt;
    if (!M || !this.ds) return;
    const v = this.ds.find((q) => q.d === e.d);
    if (e.type === 'pick' && v?.shop) {
      const from = e.loose ? { x: e.loose.x, y: e.loose.y, z: e.loose.z } : this.L.slots[e.slot];
      this.fly(e.id, from, v);
      this.fx.burst(from.x, from.y + 0.4, from.z, 10, PRODUCT[e.id].color, 3);
    } else if (e.type === 'steal' && v?.shop) {
      const f = this.ds.find((q) => q.d === e.from);
      this.fly(e.id, { x: e.from.cart.x, y: e.from.cart.y + 1, z: e.from.cart.z }, v);
      this.fx.burst(e.from.cart.x, e.from.cart.y + 1.2, e.from.cart.z, 12, 0xffe066, 4);
      if (f) f.bagSig = '';
    } else if (e.type === 'hit' && v) {
      const B = e.d.cart;
      this.fx.burst(B.x, B.y + 1.2, B.z, 14, 0xffffff, 5);
      this.fx.shake = Math.max(this.fx.shake, e.kind === 'car' ? 0.5 : 0.25);
    } else if (e.type === 'enter' && v) {
      v.shop.body.visible = false; v.car.driver.visible = true;
      this.fillCart(v.shop, {});
      v.props.push({ shop: v.shop, body: e.d.cart }); v.shop = null; v.bagSig = '';
      this.fx.burst(e.d.car.x, e.d.car.y + 1, e.d.car.z, 18, 0xffffff, 4);
    } else if (e.type === 'exit' && v) { // a fresh shopper and cart out of the driver's door
      const shop = MD.makeShopper(e.d.color);
      xray(shop.root, e.d.color);
      this.matchRoot.add(shop.root);
      v.shop = shop; v.bagSig = ''; v.car.driver.visible = false;
    } else if (e.type === 'deliver') {
      const a = e.order.drop;
      this.fx.burst(a.x, a.y + 1.5, a.z, 60, null, 9);
    } else if (e.type === 'rush' && v) {
      this.fx.burst(e.d.cart.x, e.d.cart.y + 0.2, e.d.cart.z, 8, 0xf2ecff, 2);
    } else if (e.type === 'crash' || e.type === 'bump') {
      const B = e.B || e.A;
      if (B && (e.v || 0) > 4) this.fx.burst(B.x, B.y + 0.6, B.z, Math.min(16, 4 + e.v), 0xf2ecff, 3);
    } else if (e.type === 'land' && (e.v || 0) > 6) this.fx.burst(e.B.x, e.B.y + 0.1, e.B.z, 6, 0xf2ecff, 2);
  }
  // a product flying in an arc into a dasher's cart
  fly(id, from, v) {
    const mesh = MD.productMesh(id);
    mesh.position.set(from.x, from.y, from.z);
    this.matchRoot.add(mesh);
    this.flying.push({ mesh, v, t: 0, from: mesh.position.clone() });
  }

  // ------------------------------------------------------------ per frame
  frame(dt, layout) {
    const M = this.Mt;
    if (M && this.ds) { this.updateDashers(M, dt); this.updateLoose(M, dt); }
    this.fx.update(dt);
    this.updateFlying(dt);
    for (const p of this.pads || []) { const on = p.o.status === 'open'; p.pad.visible = p.tag.visible = on; p.pad.material.opacity = 0.55 + 0.2 * Math.sin(performance.now() / 250); }
    const r = this.renderer, W = this.canvas.clientWidth, H = this.canvas.clientHeight;
    const sz = r.getSize(_w);
    if (sz.x !== W || sz.y !== H) r.setSize(W, H, false);
    r.setScissorTest(layout.length > 1);
    for (const pane of layout) {
      const C = this.cams[pane.k];
      const vx = pane.x * W, vy = pane.y * H, vw = pane.w * W, vh = pane.h * H;
      r.setViewport(vx, H - vy - vh, vw, vh); r.setScissor(vx, H - vy - vh, vw, vh);
      C.cam.aspect = vw / Math.max(1, vh);
      this.updateCamera(C, pane, dt);
      this.paneSetup(C, pane);
      r.render(this.scene, C.cam);
    }
    updateSee(this.cams[0].cam, 0, 0, 0, 0, false);
  }

  // Where each local player's camera looks.
  updateCamera(C, pane, dt) {
    const B = pane.body, cam = C.cam;
    if (!B) { // no one to follow: a slow orbit round the store
      const t = performance.now() / 1000 * 0.05, R = 70;
      cam.fov = 40; cam.position.set(Math.sin(t) * R - 6, 46, Math.cos(t) * R - 10); cam.lookAt(-6, 0, -14); cam.updateProjectionMatrix();
      return;
    }
    const car = B.H === HANDLING.car, chase = this.chase;
    const wantView = car ? CAMERA.VIEW_CAR : CAMERA.VIEW_CART;
    C.view = C.ready ? damp(C.view, wantView, 2.5, dt) : wantView;
    const look = car ? CAMERA.LOOK_CAR * clamp(B.speed / B.H.CRUISE, 0, 1) + 2 : CAMERA.LOOK_CART;
    const tx = B.x + Math.sin(B.heading) * look, tz = B.z + Math.cos(B.heading) * look;
    if (!C.ready) { C.focus.set(tx, B.y, tz); C.yaw = B.heading; C.ready = true; }
    if (chase) {
      const R = car ? CAMERA.CHASE_CAR : CAMERA.CHASE;
      C.yaw += wrapAngle(B.heading - C.yaw) * (1 - Math.exp(-R.yawRate * dt));
      C.focus.x = damp(C.focus.x, B.x, 10, dt); C.focus.z = damp(C.focus.z, B.z, 10, dt); C.focus.y = damp(C.focus.y, B.y, 5, dt);
      const sx = Math.sin(C.yaw), sz = Math.cos(C.yaw), f = C.focus;
      cam.fov = cam.aspect < 1 ? R.fovPortrait : R.fov;
      cam.position.set(f.x - sx * R.back, f.y + R.height, f.z - sz * R.back);
      cam.lookAt(f.x + sx * R.ahead, f.y + R.lookUp, f.z + sz * R.ahead);
    } else {
      C.focus.x = damp(C.focus.x, tx, car ? 3 : 4, dt); C.focus.z = damp(C.focus.z, tz, car ? 3 : 4, dt); C.focus.y = damp(C.focus.y, B.y, 4, dt);
      cam.fov = CAMERA.FOV;
      const half = cam.aspect < 1 ? (C.view / cam.aspect) * CAMERA.PORTRAIT_K : C.view;
      const dist = half / Math.tan(THREE.MathUtils.degToRad(CAMERA.FOV / 2));
      cam.position.copy(C.focus).addScaledVector(CAM_DIR, dist);
      cam.lookAt(C.focus);
    }
    const sh = this.fx.shake * 0.3;
    if (sh) { cam.position.x += (Math.random() - 0.5) * sh; cam.position.y += (Math.random() - 0.5) * sh; }
    cam.near = chase ? 0.3 : 2; cam.far = 900;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  // Per pane: what's cut away, the see-through veil, the sun, the name tags.
  paneSetup(C, pane) {
    const B = pane.body, cam = C.cam;
    // the store's roof and upper walls go whenever they'd stand between this camera and your dasher (inside,
    // or behind the building: the garden yard, the back sidewalk), or while you're inside
    const z = this.L.zones.store;
    let cut = false;
    if (B) {
      const inside = B.x > z.x0 - 0.5 && B.x < z.x1 + 0.5 && B.z > z.z0 - 0.5 && B.z < z.z1 + 0.3 && B.y < z.y1;
      cut = inside || segBox(cam.position, _v.set(B.x, B.y + 1, B.z), z.x0, 3.4, z.z0, z.x1, z.y1 + 0.4, z.z1);
    }
    for (const m of this.cut.storeRoof) m.visible = !cut;
    for (const m of this.cut.storeUpper) m.visible = !cut;
    // the see-through veil (Dr. Mow): a cone on the camera line round your dasher, plus — under a slab — the
    // whole storey above your head round you
    if (B) {
      const car = B.H === HANDLING.car;
      SEE.uSeeR.value = car ? 8 : 5.5;
      SEE.uSeeKeep.value = 0.14;
      const under = ceilingAt(this.W, B.x, B.z, B.y + 0.1) < B.y + 7;
      updateSee(cam, B.x, B.y + (car ? 1.1 : 1.0), B.z, B.y + (car ? 1.0 : 0.85), true, under ? { feet: B.y, r: car ? 16 : 13, head: car ? 2.2 : 2.3 } : null);
    } else updateSee(cam, 0, 0, 0, 0, false);
    // the sun's shadow box follows this pane's focus
    const f = B ? C.focus : _v.set(-6, 0, -14), big = B?.H === HANDLING.car ? 70 : 34;
    this.sun.position.copy(f).add(this.sunOff); this.sun.target.position.copy(f);
    const sc = this.sun.shadow.camera;
    if (sc.right !== big) { Object.assign(sc, { left: -big, right: big, top: big, bottom: -big, near: 1, far: 220 }); sc.updateProjectionMatrix(); }
    // name tags: a constant size on screen
    const dist = cam.position.distanceTo(f);
    for (const v of this.ds || []) { const k = this.chase ? 0.045 : dist * 0.012; v.tag.scale.set(k * 4, k, 1); v.tag.visible = !(B && bodyOf(v.d) === B); }
    for (const p of this.pads || []) { const k = this.chase ? 0.06 : dist * 0.016; p.tag.scale.set(k * 5, k, 1); }
  }

  updateDashers(M, dt) {
    const t = performance.now() / 1000;
    for (const v of this.ds) {
      const d = v.d, cart = d.cart, car = d.car;
      // abandoned carts follow their own (shoved-about) bodies
      for (const p of v.props) { p.shop.root.position.set(p.body.x, p.body.y, p.body.z); p.shop.root.rotation.y = p.body.heading; }
      const S = v.shop;
      if (S) { // the shopper and their cart
        S.root.position.set(cart.x, cart.y, cart.z);
        S.root.rotation.y = cart.heading;
        v.walk += Math.abs(cart.speed) * dt * 2.2;
        const swing = cart.grounded ? Math.sin(v.walk) * Math.min(1, Math.abs(cart.speed) / 2) * 0.7 : 0.5;
        S.legL.rotation.x = swing; S.legR.rotation.x = -swing;
        S.head.position.y = 1.5 + Math.abs(Math.sin(v.walk)) * 0.04 * Math.min(1, Math.abs(cart.speed));
        S.cart.rotation.z = damp(S.cart.rotation.z, clamp(-cart.steer * 0.02, -0.12, 0.12), 8, dt);
        // a punch: the shopper lunges round the cart; a rush: leaning right into it
        const lunge = d.punchT > 0 ? Math.sin((1 - d.punchT / 0.25) * Math.PI) : 0;
        S.body.position.z = -0.55 + lunge * 0.6 + (d.rushT > 0 ? 0.15 : 0);
        S.body.rotation.x = d.rushT > 0 ? 0.35 : lunge * 0.3;
        S.body.rotation.y = lunge * 0.5;
        const sig = JSON.stringify(d.bag); // (the cart's load shows the dasher's bag)
        if (sig !== v.bagSig) { v.bagSig = sig; this.fillCart(S, d.bag); }
      }
      // dazed: stars round the head
      v.stars.visible = d.stunT > 0;
      if (v.stars.visible) { v.stars.position.set(cart.x, cart.y + 2.05, cart.z); v.stars.rotation.y = t * 6; }
      // car
      v.car.root.position.set(car.x, car.y, car.z);
      v.car.root.rotation.y = car.heading;
      v.wheel += car.speed * dt / 0.34;
      for (const [i, w] of v.car.wheels.entries()) { w.rotation.x = v.wheel; w.rotation.y = i < 2 ? clamp(car.turnErr * 0.6, -0.5, 0.5) : 0; }
      v.lean = damp(v.lean, clamp(-car.steer * car.speed * 0.006, -0.12, 0.12), 6, dt);
      v.car.body.rotation.z = v.lean;
      v.car.body.position.y = car.grounded ? 0 : 0.05;
      const B = bodyOf(d);
      v.tag.position.set(B.x, B.y + (d.mode === 'car' ? 2.8 : 2.3), B.z);
    }
  }
  fillCart(S, bag) {
    for (const m of S.items) if (m) S.load.remove(m);
    S.items = [];
    let n = 0;
    for (const [id, c] of Object.entries(bag)) for (let i = 0; i < c; i++) {
      const m = MD.productMesh(id), s = cartSlot(n++);
      m.position.set(s[0], s[1], s[2]); m.rotation.y = s[3]; m.scale.setScalar(PRODUCT[id].dept === 'home' ? 0.5 : 0.75);
      S.load.add(m); S.items.push(m);
    }
  }
  updateLoose(M, dt) {
    const seen = new Set(), t = performance.now() / 1000;
    for (const l of M.loose) {
      seen.add(l);
      let m = this.looseMeshes.get(l);
      if (!m) {
        m = new THREE.Group();
        const p = MD.productMesh(l.id); p.scale.setScalar(0.85); m.add(p);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.06, 4, 16), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
        ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; m.add(ring); m.userData.ring = ring;
        xray(p, 0xffe066);
        this.matchRoot.add(m); this.looseMeshes.set(l, m);
      }
      m.position.set(l.x, l.y, l.z);
      m.children[0].rotation.y = l.rest ? Math.sin(t * 2 + l.t0) * 0.4 : t * 9;
      m.userData.ring.visible = l.rest;
      m.userData.ring.scale.setScalar(1 + 0.15 * Math.sin(t * 6));
    }
    for (const [l, m] of this.looseMeshes) if (!seen.has(l)) { this.matchRoot.remove(m); this.looseMeshes.delete(l); }
  }

  updateFlying(dt) {
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i];
      f.t += dt / 0.4;
      if (!f.v.shop) { this.matchRoot.remove(f.mesh); this.flying.splice(i, 1); continue; }
      const load = f.v.shop.load;
      load.updateMatrixWorld(true);
      const to = _w.set(0, 0.2, 0).applyMatrix4(load.matrixWorld);
      const k = Math.min(1, f.t);
      f.mesh.position.lerpVectors(f.from, to, k);
      f.mesh.position.y += Math.sin(k * Math.PI) * 1.4;
      f.mesh.rotation.y += dt * 8;
      if (f.t >= 1) { this.matchRoot.remove(f.mesh); this.flying.splice(i, 1); }
    }
  }

  // Guides for one local player (their own layer, so the other pane doesn't see them).
  //   car: a beam over each drop-off you can deliver, and the GPS chevrons along the route;
  //   store: a glint over anything on your list within a few metres (the list only names the department).
  setGuides(k, { beams = [], glints = [], path = null, body = null }) {
    const G = this.guides?.[k];
    if (!G) return;
    const t = performance.now() / 1000;
    G.beams.count = Math.min(8, beams.length);
    beams.slice(0, 8).forEach((p, i) => G.beams.setMatrixAt(i, _m4.compose(_v.set(p.x, p.y + 30, p.z), _q.identity(), _s.set(1, 60, 1))));
    G.beams.instanceMatrix.needsUpdate = true;
    G.glints.count = Math.min(40, glints.length);
    glints.slice(0, 40).forEach((p, i) => G.glints.setMatrixAt(i, _m4.compose(_v.set(p.x, p.y + 0.9 + 0.15 * Math.sin(t * 5 + i), p.z), _q.setFromEuler(_e.set(0, t * 3, 0)), _s.set(1, 1.3, 1))));
    G.glints.instanceMatrix.needsUpdate = true;
    let n = 0;
    if (path && body) {
      const gap = 5, maxD = 220;
      let px = body.x, pz = body.z, py = body.y, along = (t * 10) % gap, total = 0;
      for (const q of path) {
        const dx = q.x - px, dz = q.z - pz, seg = Math.hypot(dx, dz);
        while (along < seg && n < 80 && total + along < maxD) {
          const f = along / seg, x = px + dx * f, z = pz + dz * f, y = py + (q.y - py) * f;
          if (total + along > 6) G.chev.setMatrixAt(n++, _m4.compose(_v.set(x, y + 0.07, z), _q.setFromEuler(_e.set(0, Math.atan2(dx, dz), 0)), _s.set(2.2, 1, 2.2)));
          along += gap;
        }
        along -= seg; total += seg; px = q.x; pz = q.z; py = q.y;
        if (total > maxD) break;
      }
    }
    G.chev.count = n;
    G.chev.instanceMatrix.needsUpdate = true;
  }

  // Screen direction (x right, y down, unit) → world direction on the ground, for this player's camera.
  screenToWorld(k, sx, sy) {
    const cam = this.cams[k].cam;
    cam.getWorldDirection(_v); _v.y = 0; _v.normalize();      // screen up, on the ground
    const rx = -_v.z, rz = _v.x;                               // screen right
    return { x: rx * sx - _v.x * sy, z: rz * sx - _v.z * sy };
  }
  resetCams() { for (const c of this.cams) c.ready = false; }
}

// Does the segment a→b pass through the box? (slab test)
function segBox(a, b, x0, y0, z0, x1, y1, z1) {
  let t0 = 0, t1 = 1;
  for (const [o, d, lo, hi] of [[a.x, b.x - a.x, x0, x1], [a.y, b.y - a.y, y0, y1], [a.z, b.z - a.z, z0, z1]]) {
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return false; continue; }
    let u = (lo - o) / d, w = (hi - o) / d;
    if (u > w) [u, w] = [w, u];
    t0 = Math.max(t0, u); t1 = Math.min(t1, w);
    if (t0 > t1) return false;
  }
  return true;
}

// X-ray: every mesh of a dasher gets a twin drawn only where something in the level hides it (depth test
// reversed), as a dithered silhouette in the dasher's colour — you always see yourself and your rivals.
// Drawn after the level (renderOrder 1) and before the dashers themselves (2), so a dasher never x-rays itself.
const XRAY = new Map();
function xrayMat(color) {
  let m = XRAY.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, depthWrite: false, depthFunc: THREE.GreaterDepth });
    m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'void main() {\n  if (mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) > 0.5) discard;'); };
    XRAY.set(color, m);
  }
  return m;
}
function xray(root, color) {
  const meshes = [];
  root.traverse((o) => { if (o.isMesh && !o.userData.xray) meshes.push(o); });
  for (const o of meshes) {
    const twin = new THREE.Mesh(o.geometry, xrayMat(color));
    twin.userData.xray = true; twin.renderOrder = 1; twin.frustumCulled = false;
    o.add(twin);
    o.renderOrder = 2;
  }
}

function makeStars() {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), new THREE.MeshBasicMaterial({ color: 0xffe066 })); const a = (i / 4) * Math.PI * 2; s.position.set(Math.cos(a) * 0.45, Math.sin(i * 2) * 0.06, Math.sin(a) * 0.45); g.add(s); }
  return g;
}

// The spot in the basket for the n-th item: [x, y, z, rotY] in the cart's load group.
function cartSlot(n) {
  const spots = [[-0.14, 0, -0.18], [0.14, 0, -0.18], [-0.14, 0, 0.2], [0.14, 0, 0.2], [0, 0.22, 0], [0, 0.42, 0.05]];
  const s = spots[n % spots.length];
  return [s[0], s[1] + Math.floor(n / spots.length) * 0.4, s[2], n * 0.7];
}

function chevronGeo() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, -0.3, 0, 0, 0.35, 0, 0, 0.05, -0.5, 0, -0.3, 0, 0, 0.05, -0.5, 0, -0.6, 0.5, 0, -0.3, 0.5, 0, -0.6, 0, 0, 0.05, 0.5, 0, -0.3, 0, 0, 0.05, 0, 0, 0.35], 3));
  g.computeVertexNormals();
  return g;
}

const hex = (c) => '#' + c.toString(16).padStart(6, '0');
function nameTag(name, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(20,24,40,0.72)'; roundRect(g, 4, 6, 248, 52, 26); g.fill();
  g.fillStyle = hex(color); g.beginPath(); g.arc(34, 32, 16, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.font = '34px "Lilita One", sans-serif'; g.textBaseline = 'middle'; g.fillText(name, 60, 34);
  return spriteOf(c);
}
function textSprite(text, bg) {
  const c = document.createElement('canvas'); c.width = 320; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = bg; roundRect(g, 4, 6, 312, 52, 26); g.fill();
  g.fillStyle = '#fff'; g.font = '32px "Lilita One", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 160, 34);
  return spriteOf(c);
}
function spriteOf(c) {
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.renderOrder = 10; s.center.set(0.5, 0);
  return s;
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// ---------------------------------------------------------------- particles (one instanced mesh)
class FX {
  constructor(scene) {
    this.max = 260; this.n = 0; this.shake = 0;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial(), this.max);
    this.mesh.frustumCulled = false; this.mesh.count = 0;
    this.p = Array.from({ length: this.max }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, s: 1 }));
    this.col = new THREE.Color();
    scene.add(this.mesh);
  }
  burst(x, y, z, n, color, speed = 3) {
    const pal = [0xff9fbd, 0xffd45e, 0x56e27d, 0x4ea4ea, 0xa58cf2, 0xff6b35];
    for (let i = 0; i < n; i++) {
      const p = this.p[this.n++ % this.max];
      const a = Math.random() * Math.PI * 2, u = Math.random();
      Object.assign(p, { x, y, z, vx: Math.cos(a) * speed * u, vy: speed * (0.6 + Math.random()), vz: Math.sin(a) * speed * u, life: 0, max: 0.6 + Math.random() * 0.6, s: 0.6 + Math.random() * 0.8 });
      this.mesh.setColorAt(this.p.indexOf(p), this.col.set(color ?? pal[i % pal.length]));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    if (speed > 6) this.shake = Math.max(this.shake, 0.4);
  }
  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 1.5);
    let live = 0;
    for (let i = 0; i < this.max; i++) {
      const p = this.p[i];
      if (p.life >= p.max) { this.mesh.setMatrixAt(i, _m4.makeScale(0, 0, 0)); continue; }
      p.life += dt; p.vy -= 14 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const k = p.s * (1 - p.life / p.max);
      this.mesh.setMatrixAt(i, _m4.compose(_v.set(p.x, p.y, p.z), _q.setFromEuler(_e.set(p.life * 7, p.life * 5, 0)), _s.set(k, k, k)));
      live++;
    }
    this.mesh.count = this.max;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = live > 0;
  }
}
export { F2 };
