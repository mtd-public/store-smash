// Department icons: cute kawaii pictures drawn straight into a canvas (no image files), one per department —
// an apple, a toilet-paper roll, a plunger, a teddy, a rolled rug, a potted sprout, each with a little face.
// They print on the floor of every aisle in the department's zone, hang on its signs, fill the store directory and
// sit next to every item on your list.
import { DEPTS } from './level.js';

const INK = '#2a1a2e', BLUSH = 'rgba(255,120,150,0.75)';
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

// A kawaii face centred at (x, y), u = unit size.
function face(g, x, y, u, mood = 'smile') {
  g.fillStyle = INK;
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(x + s * u * 1.6, y, u * 0.42, u * 0.55, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#fff';
  for (const s of [-1, 1]) { g.beginPath(); g.arc(x + s * u * 1.6 + u * 0.14, y - u * 0.2, u * 0.16, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = BLUSH;
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(x + s * u * 2.5, y + u * 0.75, u * 0.6, u * 0.32, 0, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = INK; g.lineWidth = u * 0.32; g.lineCap = 'round';
  g.beginPath();
  if (mood === 'open') { g.fillStyle = '#7a2436'; g.arc(x, y + u * 0.55, u * 0.6, 0, Math.PI); g.fill(); }
  else g.arc(x, y + u * 0.35, u * 0.55, 0.15 * Math.PI, 0.85 * Math.PI);
  g.stroke();
}
const blob = (g, fill, stroke, w, path) => { g.beginPath(); path(); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = w; g.lineJoin = 'round'; g.stroke(); } };

// Draw a department's icon into a size × size box at (x, y).
export function drawDeptIcon(g, dept, x, y, size) {
  g.save();
  g.translate(x, y); g.scale(size / 100, size / 100);
  const O = 3.2; // outline width
  switch (dept) {
    case 'produce': // an apple with a leaf
      blob(g, '#ff5a5a', INK, O, () => { g.moveTo(50, 30); g.bezierCurveTo(30, 18, 10, 30, 12, 55); g.bezierCurveTo(14, 80, 35, 94, 50, 86); g.bezierCurveTo(65, 94, 86, 80, 88, 55); g.bezierCurveTo(90, 30, 70, 18, 50, 30); });
      blob(g, 'rgba(255,255,255,0.45)', null, 0, () => g.ellipse(30, 45, 6, 11, -0.4, 0, Math.PI * 2));
      blob(g, '#8a5a34', INK, O, () => { g.moveTo(48, 31); g.quadraticCurveTo(46, 18, 52, 10); g.lineTo(56, 12); g.quadraticCurveTo(51, 20, 53, 31); g.closePath(); });
      blob(g, '#5fd06a', INK, O, () => { g.moveTo(54, 18); g.quadraticCurveTo(70, 4, 82, 14); g.quadraticCurveTo(70, 26, 54, 18); });
      face(g, 50, 58, 5.5);
      break;
    case 'paper': // a toilet-paper roll, a sheet hanging off it
      blob(g, '#ffffff', INK, O, () => { g.moveTo(18, 30); g.lineTo(18, 78); g.ellipse(50, 78, 32, 10, 0, Math.PI, 0, true); g.lineTo(82, 30); g.closePath(); });
      blob(g, '#dff0ff', INK, O, () => g.ellipse(50, 30, 32, 11, 0, 0, Math.PI * 2));
      blob(g, '#c9a27a', INK, O * 0.8, () => g.ellipse(50, 30, 10, 4, 0, 0, Math.PI * 2));
      blob(g, '#ffffff', INK, O, () => { g.moveTo(82, 40); g.lineTo(95, 40); g.lineTo(95, 70); g.lineTo(90, 66); g.lineTo(86, 72); g.lineTo(82, 68); g.closePath(); });
      g.strokeStyle = '#9fd0ff'; g.lineWidth = 2; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(82, 52); g.lineTo(95, 52); g.stroke(); g.setLineDash([]);
      face(g, 50, 58, 5.5);
      break;
    case 'hardware': // a plunger
      blob(g, '#e8b36a', INK, O, () => { g.rect(45, 4, 10, 52); });
      blob(g, '#e8423b', INK, O, () => { g.moveTo(14, 88); g.bezierCurveTo(14, 50, 86, 50, 86, 88); g.closePath(); });
      blob(g, '#c4302a', INK, O, () => g.ellipse(50, 88, 38, 7, 0, 0, Math.PI * 2));
      blob(g, 'rgba(255,255,255,0.4)', null, 0, () => g.ellipse(32, 66, 5, 9, -0.5, 0, Math.PI * 2));
      face(g, 50, 74, 5);
      break;
    case 'toys': // a teddy bear's head
      for (const s of [-1, 1]) { blob(g, '#b07a4a', INK, O, () => g.arc(50 + s * 28, 22, 14, 0, Math.PI * 2)); blob(g, '#f2c6a0', null, 0, () => g.arc(50 + s * 28, 22, 7, 0, Math.PI * 2)); }
      blob(g, '#b07a4a', INK, O, () => g.ellipse(50, 54, 38, 34, 0, 0, Math.PI * 2));
      blob(g, '#f2d2b0', INK, O * 0.7, () => g.ellipse(50, 68, 16, 12, 0, 0, Math.PI * 2));
      blob(g, INK, null, 0, () => g.ellipse(50, 62, 5, 3.5, 0, 0, Math.PI * 2));
      face(g, 50, 52, 5.5);
      break;
    case 'home': // a rolled rug, fringe and all
      blob(g, '#a77be0', INK, O, () => { g.moveTo(10, 32); g.lineTo(78, 32); g.ellipse(78, 56, 12, 24, 0, -Math.PI / 2, Math.PI / 2); g.lineTo(10, 80); g.ellipse(10, 56, 12, 24, 0, Math.PI / 2, -Math.PI / 2); g.closePath(); });
      g.strokeStyle = '#ffe066'; g.lineWidth = 5; for (const x of [28, 46, 64]) { g.beginPath(); g.moveTo(x, 34); g.lineTo(x, 78); g.stroke(); }
      blob(g, '#c9a8f2', INK, O, () => g.ellipse(78, 56, 12, 24, 0, 0, Math.PI * 2));
      g.strokeStyle = INK; g.lineWidth = 2.4; g.beginPath(); for (let a = 0; a < Math.PI * 5; a += 0.2) { const r = 1 + a * 1.2; g.lineTo(78 + Math.cos(a) * r * 0.5, 56 + Math.sin(a) * r); } g.stroke();
      g.strokeStyle = '#ffe066'; g.lineWidth = 2.4; for (let y = 36; y <= 76; y += 6) { g.beginPath(); g.moveTo(90, y); g.lineTo(97, y); g.stroke(); }
      face(g, 40, 54, 5.5);
      break;
    case 'garden': // a sprout in a pot, with a flower
      blob(g, '#5fd06a', INK, O, () => { g.moveTo(50, 46); g.quadraticCurveTo(22, 40, 20, 18); g.quadraticCurveTo(44, 16, 50, 40); });
      blob(g, '#4caf50', INK, O, () => { g.moveTo(50, 46); g.quadraticCurveTo(78, 42, 82, 22); g.quadraticCurveTo(58, 16, 50, 40); });
      g.strokeStyle = INK; g.lineWidth = O; g.beginPath(); g.moveTo(50, 54); g.lineTo(50, 30); g.stroke();
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; blob(g, '#ff8fb1', INK, 2, () => g.arc(50 + Math.cos(a) * 7, 20 + Math.sin(a) * 7, 5.5, 0, Math.PI * 2)); }
      blob(g, '#ffd23f', INK, 2, () => g.arc(50, 20, 5, 0, Math.PI * 2));
      blob(g, '#e0805a', INK, O, () => { g.moveTo(18, 50); g.lineTo(82, 50); g.lineTo(74, 94); g.lineTo(26, 94); g.closePath(); });
      blob(g, '#c8643c', INK, O, () => g.rect(14, 46, 72, 12));
      face(g, 50, 74, 5);
      break;
  }
  g.restore();
}

// A round badge: the department's colour, a white ring, the icon in the middle (and its name, for the floor).
export function drawDeptBadge(g, dept, cx, cy, r, { label = false } = {}) {
  const col = hex(DEPTS[dept].color);
  g.save();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = col; g.beginPath(); g.arc(cx, cy, r * 0.88, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(cx, cy, r * (label ? 0.6 : 0.74), 0, Math.PI * 2); g.fill();
  const s = r * (label ? 1.0 : 1.25);
  drawDeptIcon(g, dept, cx - s / 2, cy - s / 2 - (label ? r * 0.06 : 0), s);
  if (label) { // the name round the bottom of the ring
    const name = DEPTS[dept].name.toUpperCase();
    g.fillStyle = '#ffffff'; g.font = `${Math.round(r * 0.2)}px "Lilita One", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const arc = Math.min(Math.PI * 0.95, name.length * 0.15), start = Math.PI / 2 + arc / 2;
    [...name].forEach((ch, i) => {
      const a = start - (i + 0.5) * (arc / name.length);
      g.save(); g.translate(cx + Math.cos(a) * r * 0.74, cy + Math.sin(a) * r * 0.74); g.rotate(a - Math.PI / 2); g.fillText(ch, 0, 0); g.restore();
    });
  }
  g.restore();
}

const urls = new Map();
// A data URL of the plain icon (for the HUD and the board).
export function deptIconURL(dept, size = 48) {
  const key = dept + size;
  if (!urls.has(key)) {
    const c = document.createElement('canvas'); c.width = c.height = size * 2;
    drawDeptIcon(c.getContext('2d'), dept, 0, 0, size * 2);
    urls.set(key, c.toDataURL());
  }
  return urls.get(key);
}
// A canvas of the floor badge (for the aisle decals).
export function deptDecalCanvas(dept, px = 512) {
  const c = document.createElement('canvas'); c.width = c.height = px;
  drawDeptBadge(c.getContext('2d'), dept, px / 2, px / 2, px / 2 - 4, { label: true });
  return c;
}
