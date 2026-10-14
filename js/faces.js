// Cartoon faces, straight from Dr. Mow (dr-mow js/drmow.js: drawFace and its helpers, copied as is): anime
// expressions drawn into a canvas and wrapped round the front of a head as a sphere patch. Every dasher wears
// them — the farmer's set, including the on-fire pair (aghast / seethe) that flip back and forth.
//   normal, blink, joy (^ ^), stress (> <), shock, dizzy (@ @), fired (fired up), cry, aghast, seethe
import * as THREE from 'three';

const FACE = { w: 144, h: 96, phi: 2.4, th0: 0.6, th: 1.6 };
const INK = '#2a1a2e', IRIS = '#2f73c9', IRIS_D = '#1b3f86', MOUTH = '#7a2436', TONGUE = '#ff7f93', BLUSH = '#ff8aa0', TEAR = '#8fdcff';
const EYE_X = 21, EYE_Y = 58; // eye centres: 72 ± 21 across, 58 down (the head's equator)
export const FACE_NAMES = ['normal', 'blink', 'joy', 'stress', 'shock', 'dizzy', 'fired', 'cry', 'aghast', 'seethe']; // aghast / seethe: on fire, flipping between the two
let FEM = false;
function star(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, k = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k); }
  g.fill();
}

function line(g, w, pts, col = INK) {
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
}
function ell(g, x, y, rx, ry, col, rot = 0) { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill(); }
function blush(g, strong) {
  for (const s of [-1, 1]) {
    if (strong) ell(g, 72 + s * 36, 70, 9, 4.5, BLUSH);
    else ell(g, 72 + s * 32, 71, 6, 3, '#ffb4c2'); // (calm: a small, soft flush)
    if (strong) for (let i = -1; i <= 1; i++) line(g, 1.4, [[72 + s * 36 + i * 4 - 2, 72], [72 + s * 36 + i * 4 + 2, 67]], '#e0506e'); // anime blush hatching
  }
}
// The open anime eye (owner: friendlier, not staring): a big warm iris filling most of the eye, so little
// white shows, a soft pupil, two catchlights, a lash line with a small flick.
function eye(g, s, { h = 10, look = 0, pupil = 3 } = {}) {
  const x = 72 + s * EYE_X, y = EYE_Y + 1;
  ell(g, x, y, 7, h, '#ffffff');
  ell(g, x + look, y + 0.8, 6.2, h * 0.92, IRIS);
  g.save(); g.beginPath(); g.ellipse(x + look, y + 0.8, 6.2, h * 0.92, 0, 0, Math.PI * 2); g.clip(); g.fillStyle = IRIS_D; g.fillRect(x - 8, y - h, 16, h * 0.6); g.fillStyle = '#6aa8ec'; g.fillRect(x - 8, y + h * 0.45, 16, h); g.restore(); // darker top, a lighter glow at the bottom
  ell(g, x + look, y + 1.5, pupil * 0.8, pupil, '#1a1030');
  ell(g, x + look + 2.4, y - h * 0.38, 2.3, 2.8, '#ffffff');
  ell(g, x + look - 2.4, y + h * 0.42, 1.1, 1.1, '#ffffff');
  line(g, 2.6, [[x - s * 8, y - h * 0.45], [x - s * 3.5, y - h - 0.3], [x + s * 3.5, y - h - 0.3], [x + s * 8, y - h * 0.5], [x + s * 9.5, y - h * 0.75]]); // lash line, with a small flick
  if (FEM) for (const k of [0, 1, 2]) line(g, 2, [[x + s * (4 + k * 3.5), y - h - 0.5 + k * 2], [x + s * (7 + k * 4.5), y - h - 4.5 + k * 3]]); // lashes
}
function brows(g, tilt = 0, lift = 0, w = 3) { // tilt > 0: angry (inner ends down); < 0: worried
  if (FEM) w *= 0.7;
  for (const s of [-1, 1]) { const x = 72 + s * EYE_X, y = EYE_Y - 21 - lift; line(g, w, [[x - s * 9, y + tilt * 3], [x, y - 1.5], [x + s * 9, y - tilt * 3 + 1]], '#5a3418'); }
}
function closedArc(g, s, up = true) { // ^ (up) or a sleepy ‿ (down)
  const x = 72 + s * EYE_X, y = EYE_Y + (up ? 2 : -1);
  line(g, 3.4, up ? [[x - 8, y + 3], [x - 3, y - 4], [x + 3, y - 4], [x + 8, y + 3]] : [[x - 8, y - 2], [x - 3, y + 3], [x + 3, y + 3], [x + 8, y - 2]]);
  if (FEM) for (const k of [0, 1]) line(g, 1.8, up ? [[x + s * (6 + k * 2), y - 1 + k * 3], [x + s * (10 + k * 2), y - 4 + k * 3]] : [[x + s * (5 + k * 3), y + 1], [x + s * (8 + k * 3), y + 5]]); // lashes
}
function drawFace(name, g, fem) {
  FEM = fem;
  g.clearRect(0, 0, FACE.w, FACE.h);
  switch (name) {
    case 'normal':
      blush(g, false); brows(g, -0.15, 1, 2.4); eye(g, -1); eye(g, 1);
      g.fillStyle = MOUTH; g.beginPath(); g.moveTo(65, 77); g.quadraticCurveTo(72, 84, 79, 77); g.quadraticCurveTo(72, 79, 65, 77); g.fill(); // a small, easy smile
      line(g, 1.6, [[64, 76.5], [65.5, 77.5]]); line(g, 1.6, [[80, 76.5], [78.5, 77.5]]); // (the corners turn up)
      break;
    case 'blink':
      blush(g, false); brows(g); closedArc(g, -1, false); closedArc(g, 1, false);
      g.fillStyle = MOUTH; g.beginPath(); g.moveTo(64, 77); g.quadraticCurveTo(72, 86, 80, 77); g.closePath(); g.fill();
      break;
    case 'joy': // ^ ^ and a big open laugh
      blush(g, true); brows(g, -0.3, 3); closedArc(g, -1); closedArc(g, 1);
      g.fillStyle = MOUTH; g.beginPath(); g.moveTo(58, 74); g.quadraticCurveTo(72, 96, 86, 74); g.closePath(); g.fill();
      ell(g, 72, 86, 7, 4, TONGUE);
      g.fillStyle = '#fff'; g.fillRect(61, 74, 22, 2.5);
      for (const [x, y] of [[44, 34], [104, 32]]) { g.fillStyle = '#fff8a0'; star(g, x, y, 4); } // sparkles
      break;
    case 'stress': // > <  grinding teeth, a sweat drop
      blush(g, false); brows(g, 1.2, -2);
      for (const s of [-1, 1]) { const x = 72 + s * EYE_X; line(g, 3.4, [[x - s * 7, EYE_Y - 6], [x + s * 6, EYE_Y], [x - s * 7, EYE_Y + 6]]); }
      g.fillStyle = '#fff'; g.fillRect(58, 75, 28, 9); line(g, 2, [[58, 75], [86, 75], [86, 84], [58, 84], [58, 75]]);
      for (const x of [65, 72, 79]) line(g, 1.4, [[x, 75], [x, 84]]); line(g, 1.4, [[58, 79.5], [86, 79.5]]);
      g.fillStyle = TEAR; g.beginPath(); g.moveTo(112, 28); g.quadraticCurveTo(104, 42, 112, 44); g.quadraticCurveTo(120, 42, 112, 28); g.fill(); // sweat drop
      break;
    case 'shock': // white saucer eyes, pin pupils, an O mouth, gloom lines
      brows(g, -0.6, 7, 2.6);
      for (const s of [-1, 1]) { const x = 72 + s * EYE_X; ell(g, x, EYE_Y, 9.5, 12.5, INK); ell(g, x, EYE_Y, 8, 11, '#fff'); ell(g, x, EYE_Y + 1, 1.8, 2.4, INK); }
      ell(g, 72, 81, 5.5, 7, MOUTH); ell(g, 72, 84, 3, 2.5, TONGUE);
      for (const x of [56, 64, 72, 80, 88]) line(g, 1.6, [[x, 22], [x, 32 + (x % 16 ? 2 : 0)]], '#6a7ad8'); // gloom lines
      break;
    case 'dizzy': // @ @ and a wobbly line
      blush(g, false); brows(g, -0.5, 2, 2.6);
      for (const s of [-1, 1]) {
        const x = 72 + s * EYE_X, pts = [];
        for (let a = 0; a < Math.PI * 5; a += 0.3) pts.push([x + Math.cos(a * s) * a * 0.6, EYE_Y + Math.sin(a * s) * a * 0.75]);
        line(g, 2.2, pts);
      }
      line(g, 2.6, [[60, 80], [64, 77], [68, 81], [72, 77], [76, 81], [80, 77], [84, 80]]);
      break;
    case 'fired': // fired up: narrowed eyes, brows down hard, a toothy grin
      blush(g, false); brows(g, 1.6, -1, 3.4);
      for (const s of [-1, 1]) {
        eye(g, s, { h: 9, pupil: 3 });
        const x = 72 + s * EYE_X; g.fillStyle = '#00000000';
        g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(x - 12, EYE_Y - 14); g.lineTo(x + 12, EYE_Y - 14); g.lineTo(x + 12, EYE_Y - 4 + s * 3); g.lineTo(x - 12, EYE_Y - 4 - s * 3); g.closePath(); g.fill(); g.restore(); // the top lid comes down at a slant
        line(g, 3.4, [[x - 10, EYE_Y - 4 - s * 3], [x + 10, EYE_Y - 4 + s * 3]]);
      }
      g.fillStyle = MOUTH; g.beginPath(); g.moveTo(58, 75); g.lineTo(86, 73); g.quadraticCurveTo(78, 88, 62, 84); g.closePath(); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(58, 75); g.lineTo(86, 73); g.lineTo(84, 77); g.lineTo(60, 78.5); g.closePath(); g.fill();
      break;
    case 'aghast': // on fire, part 1 (owner, 2026-10-10): bug-eyed disbelief, eyes popping, a jaw-drop O, sweat flying
      brows(g, -0.9, 9, 2.8);
      for (const s of [-1, 1]) {
        const x = 72 + s * (EYE_X + 1);
        ell(g, x, EYE_Y - 1, 12.5, 15, INK); ell(g, x, EYE_Y - 1, 10.5, 13, '#fff'); // bulging saucers
        ell(g, x - s * 1.5, EYE_Y + 1, 2, 2.6, INK); // tiny pupils, a little cross-eyed
        line(g, 1.4, [[x + s * 13, EYE_Y - 12], [x + s * 17, EYE_Y - 15]]); line(g, 1.4, [[x + s * 14, EYE_Y - 5], [x + s * 19, EYE_Y - 6]]); // pop lines
      }
      g.fillStyle = MOUTH; g.beginPath(); g.ellipse(72, 83, 7.5, 9.5, 0, 0, Math.PI * 2); g.fill(); // the jaw drops
      ell(g, 72, 88.5, 4.5, 3, TONGUE); g.fillStyle = '#fff'; g.fillRect(67, 74.5, 10, 2.2); // tongue, top teeth
      g.fillStyle = TEAR; for (const [x, y] of [[110, 30], [36, 34]]) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - 6, y + 11, x, y + 13); g.quadraticCurveTo(x + 6, y + 11, x, y); g.fill(); } // sweat flying
      break;
    case 'seethe': // on fire, part 2: eyes squeezed to angry slanted slits, gritted teeth, a throbbing anger mark
      blush(g, true); brows(g, 2.1, -3, 3.6);
      for (const s of [-1, 1]) {
        const x = 72 + s * EYE_X, out = x + s * 10, inn = x - s * 9;
        line(g, 4.2, [[out, EYE_Y - 4], [inn, EYE_Y + 3]]); // the slit, slanting down to the nose
        line(g, 2, [[out - s * 2, EYE_Y + 3], [inn + s * 3, EYE_Y + 6]]); // the squeezed lower lid
      }
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(56, 76); g.quadraticCurveTo(72, 71, 88, 76); g.lineTo(86, 86); g.quadraticCurveTo(72, 89, 58, 86); g.closePath(); g.fill(); // a wide grimace
      line(g, 2.2, [[56, 76], [58, 86]]); line(g, 2.2, [[88, 76], [86, 86]]);
      line(g, 2, [[56, 76], [64, 73.6], [72, 73], [80, 73.6], [88, 76]]); line(g, 2, [[58, 86], [66, 88], [72, 88.4], [78, 88], [86, 86]]);
      line(g, 1.5, [[57, 81], [72, 80.5], [87, 81]]); for (const x of [63, 68, 72.5, 77, 82]) line(g, 1.3, [[x, 74], [x, 88]]); // clenched teeth
      for (const [dx, dy, r] of [[-1, -1, 0], [1, -1, 1], [1, 1, 2], [-1, 1, 3]]) { // 💢 the anger mark at the temple
        const cx = 108 + dx * 3.5, cy = 26 + dy * 3.5;
        line(g, 2.4, [[cx + dx * 5, cy], [cx, cy], [cx, cy + dy * 5]], '#e0283c');
      }
      break;
    case 'cry': // eyes screwed shut, waterfall tears, a wail
      blush(g, true); brows(g, -1.4, 4, 2.8);
      for (const s of [-1, 1]) {
        const x = 72 + s * EYE_X; line(g, 3.4, [[x - 8, EYE_Y - 1], [x - 3, EYE_Y + 3], [x + 3, EYE_Y + 3], [x + 8, EYE_Y - 1]]);
        g.fillStyle = TEAR; g.fillRect(x - 4, EYE_Y + 4, 8, 34); g.fillStyle = '#d8f4ff'; g.fillRect(x - 2, EYE_Y + 6, 2, 30);
      }
      g.fillStyle = MOUTH; g.beginPath(); g.moveTo(62, 74); g.lineTo(82, 74); g.lineTo(86, 88); g.lineTo(58, 88); g.closePath(); g.fill();
      ell(g, 72, 86, 6, 2.5, TONGUE);
      break;
  }
}

const mats = new Map(), canvases = new Map();
// The drawn face itself (also the HUD portrait's source).
export function faceCanvas(name) {
  let c = canvases.get(name);
  if (!c) { c = document.createElement('canvas'); c.width = FACE.w; c.height = FACE.h; drawFace(name, c.getContext('2d'), false); canvases.set(name, c); }
  return c;
}
// A round portrait of a dasher wearing a face: skin, their cap, the face (the HUD shows yours as it changes).
export function drawPortrait(g, size, name, capColor) {
  g.clearRect(0, 0, size, size);
  g.save(); g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2); g.clip();
  g.fillStyle = '#ffe9c9'; g.fillRect(0, 0, size, size);
  g.fillStyle = '#f2c6a0'; g.beginPath(); g.ellipse(size / 2, size * 0.62, size * 0.44, size * 0.46, 0, 0, Math.PI * 2); g.fill();
  g.drawImage(faceCanvas(name), 20, 22, 104, 74, size * 0.06, size * 0.3, size * 0.88, size * 0.63);
  g.fillStyle = capColor; g.beginPath(); g.ellipse(size / 2, size * 0.2, size * 0.5, size * 0.24, 0, 0, Math.PI * 2); g.fill();
  g.fillRect(size * 0.15, size * 0.24, size * 0.7, size * 0.07);
  g.restore();
  g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2); g.stroke();
}
export function faceMat(name) {
  let m = mats.get(name);
  if (!m) {
    const c = faceCanvas(name);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    m = new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.5, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.25 });
    mats.set(name, m);
  }
  return m;
}
const geos = new Map();
// The patch for a head of radius r (just proud of its surface), centred on +z (the way the head faces).
export function faceGeo(r) {
  let g = geos.get(r);
  if (!g) { g = new THREE.SphereGeometry(r * 1.02, 20, 12, Math.PI / 2 - FACE.phi / 2, FACE.phi, FACE.th0, FACE.th); geos.set(r, g); }
  return g;
}
// A set of faces on a head (one visible at a time). Returns { set(name) }.
export function addFaces(head, r, sy = 1) {
  const faces = {};
  for (const n of FACE_NAMES) {
    const m = new THREE.Mesh(faceGeo(r), faceMat(n));
    m.scale.y = sy; m.renderOrder = 3; m.visible = n === 'normal'; m.userData.face = true;
    head.add(m); faces[n] = m;
  }
  let now = 'normal';
  return { faces, get now() { return now; }, set(name) { if (name === now || !faces[name]) return; faces[now].visible = false; faces[name].visible = true; now = name; } };
}
