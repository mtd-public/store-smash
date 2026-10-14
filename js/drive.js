// The character controller, lifted out of Dr. Mow's mower step (dr-mow js/sim.js step(): steering, speed,
// slick-lawn drift, wall slide, hop with coyote time and a jump buffer, step-up / snap-down, landing) and
// made generic: one body, one HANDLING profile (js/tuning.js). The shopper's cart and the dasher's car are the
// same code with different numbers, and the CPU dashers drive through it too (js/ai.js) — they get no cheats.
//
// What changed from the mower:
//   * throttle: Dr. Mow's mower never stops. A body here cruises while the stick is pushed (a light push walks,
//     a full push runs), coasts to a stop when it's released (profile AUTO_CRUISE brings the old way back), and
//     relative controls (keys in the chase cam) can brake and back up;
//   * grip: the slick-lawn drift (travel direction lagging the heading) is a per-profile GRIP, always on, so the
//     car slides through hard turns and the cart barely skids;
//   * yaw by speed: a car can't spin on the spot (YAW_FULL / YAW_LOW); the cart can, like the Zero-Turn;
//   * bodies are two circles along the heading (a cart + shopper, a hatchback), tested against walls, posts
//     and each other; a head-on crash stops you and kicks you back a little;
//   * ceilings: a hop under a mezzanine slab bumps its head.
//
// ctl: { dir: { x, z, mag } world-space "go this way" (stick / CPU) or null,
//        turn: -1..1 relative steering (+1 = right), throttle: -1..1 relative (keys, chase cam), jump: bool (edge) }
import { clamp, damp, wrapAngle } from './utils.js';
import { groundAt, ceilingAt, wallAt, postsNear } from './world.js';

const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };

export function createBody(H, x, y, z, heading) {
  return { H, x, y, z, vy: 0, heading, vh: heading, speed: 0, grounded: true, plat: null, coyote: 0, jumpBuf: 0, airT: 0, turnErr: 0, kx: 0, kz: 0, safe: { x, y, z, heading }, crashT: 0, steer: 0 };
}

// The body's collision circles in world space: [[x, z, r], …].
export function circles(B) {
  const s = Math.sin(B.heading), c = Math.cos(B.heading);
  return B.H.CIRCLES.map(([o, r]) => [B.x + s * o, B.z + c * o, r]);
}

// Would the body, moved to (x, z), push into a wall? Every circle is tested (Dr. Mow tested one nose point), each
// from the floor under it: on a ramp a car's nose is higher than its middle, so the deck at the top isn't a wall.
export function blockedAt(W, B, x, z) {
  const s = Math.sin(B.heading), c = Math.cos(B.heading);
  for (const [o, r] of B.H.CIRCLES) {
    const cx = x + s * o, cz = z + c * o;
    let fy = B.y;
    if (B.grounded) { // (a long body pitches on a slope: its nose or tail can sit up to ~24° up a ramp)
      const g = groundAt(W, cx, cz, B.y + B.H.STEP + Math.abs(o) * 0.45);
      if (g && (g.h <= B.y + B.H.STEP || g.p.ramp)) fy = Math.max(B.y, g.h);
    }
    const hit = wallAt(W, cx, cz, fy, Math.max(B.H.WALL_MARGIN, r * 0.9), B.H.STEP, B.H.HEIGHT);
    if (hit) return hit;
  }
  return null;
}

// Vertical speed from driving along the ramp under you (m/s; 0 off a ramp).
function rampClimb(B) {
  const r = B.plat?.ramp;
  if (!r) return 0;
  const along = r.axis === 'x' ? Math.sin(B.vh) * (r.h1 - r.h0) / B.plat.w : Math.cos(B.vh) * (r.h1 - r.h0) / B.plat.d;
  return B.speed * along;
}

// Overlapping a wall (spawned there, or a spin swung a circle in): out to the nearest free spot.
export function depenetrate(W, B) {
  if (!blockedAt(W, B, B.x, B.z)) return true;
  for (let d = 0.05; d <= 2.2; d += 0.05) for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2, x = B.x + Math.sin(a) * d, z = B.z + Math.cos(a) * d;
    if (!blockedAt(W, B, x, z)) { B.x = x; B.z = z; return true; }
  }
  return false;
}
// Turn the body to a heading if its circles fit there (a dazed spin, a shove).
export function turnTo(W, B, h) { const h0 = B.heading; B.heading = h; if (blockedAt(W, B, B.x, B.z)) B.heading = h0; }

export function driveStep(W, B, ctl, dt, ev = null) {
  const H = B.H;
  depenetrate(W, B);
  const emit = (type, data) => ev?.push({ type, B, ...data });
  const auth = B.grounded ? 1 : H.AIR_CONTROL;
  if (B.crashT > 0) B.crashT = Math.max(0, B.crashT - dt);

  // --- steering: an absolute target from the stick, or relative from the keys (Dr. Mow)
  const yawK = H.YAW_FULL > 0 ? clamp(Math.abs(B.speed) / H.YAW_FULL, H.YAW_LOW, 1) : 1; // (a car needs to roll to turn)
  let slow = 0, throttle = H.AUTO_CRUISE ? 1 : 0;
  B.turnErr = 0;
  const h0 = B.heading;
  if (ctl.dir && ctl.dir.mag > H.STICK_MIN) {
    const target = Math.atan2(ctl.dir.x, ctl.dir.z);
    const err = wrapAngle(target - B.heading);
    const mag = Math.min(1, ctl.dir.mag);
    const maxRate = H.YAW_MAX * (H.YAW_MIN_FRAC + (1 - H.YAW_MIN_FRAC) * mag) * yawK;
    B.heading = wrapAngle(B.heading + clamp(err * H.YAW_GAIN, -maxRate, maxRate) * auth * dt);
    B.turnErr = err;
    slow = H.TURN_SLOW * smooth(0.5, 1.8, Math.abs(err)); // the stick far off the heading: dig in (tightens the turn)
    throttle = H.THROTTLE_MIN + (1 - H.THROTTLE_MIN) * smooth(H.STICK_MIN, 0.85, mag);
  } else if (ctl.turn || ctl.throttle) {
    const back = (ctl.throttle || 0) < 0 && B.speed < 0.5 ? -1 : 1; // (backing up: the wheel steers the tail)
    B.heading = wrapAngle(B.heading - (ctl.turn || 0) * H.KEY_YAW * auth * yawK * back * dt);
    B.turnErr = -(ctl.turn || 0);
    slow = H.KEY_SLOW * Math.abs(ctl.turn || 0);
    throttle = ctl.throttle ?? (ctl.turn ? 1 : 0);
    if (throttle < 0) throttle = B.speed > 0.5 ? 0 : -H.REVERSE; // brake first, then reverse
  }
  // Turning swings the body's circles round its middle: a car's nose can't swing into a wall (the turn waits
  // until you've rolled clear). Dr. Mow's mower was one point, so it never had to ask.
  if (B.heading !== h0 && blockedAt(W, B, B.x, B.z)) B.heading = h0;
  B.steer = wrapAngle(B.heading - h0) / dt; // (yaw rate this step: the renderer leans and steers the wheels with it)
  if (B.grounded) {
    const target = H.CRUISE * throttle * (1 - slow) * (B.plat?.slow ?? 1) * (B.boost ?? 1); // (boost: a cart rush)
    B.speed = damp(B.speed, target, Math.abs(target) > Math.abs(B.speed) && Math.sign(target) === Math.sign(B.speed || target) ? H.ACCEL : H.BRAKE, dt);
    if (Math.abs(B.speed) < 0.02 && !throttle) B.speed = 0;
  }

  // --- travel direction: on full grip it IS the heading; with low grip it lags (Dr. Mow's slick lawns), so a
  // hard turn at speed becomes a drift: the nose points in, the body slides out. In the air it carries on.
  if (B.grounded) B.vh = H.GRIP >= 100 ? B.heading : wrapAngle(B.heading - wrapAngle(B.heading - B.vh) * Math.exp(-H.GRIP * dt));
  B.slip = wrapAngle(B.heading - B.vh);

  // --- horizontal: walls slide (try the move, then each axis alone), posts push out
  const fx = Math.sin(B.vh), fz = Math.cos(B.vh);
  if (B.kx || B.kz) { const k = Math.exp(-4 * dt); B.kx = Math.abs(B.kx * k) < 0.05 ? 0 : B.kx * k; B.kz = Math.abs(B.kz * k) < 0.05 ? 0 : B.kz * k; } // knockback fades
  const nx = B.x + (fx * B.speed + B.kx) * dt, nz = B.z + (fz * B.speed + B.kz) * dt;
  B.blocked = false;
  const free = (x, z) => !blockedAt(W, B, x, z);
  if (free(nx, nz)) { B.x = nx; B.z = nz; }
  else {
    B.blocked = true;
    const slideX = free(nx, B.z), slideZ = !slideX && free(B.x, nz);
    if (slideX) B.x = nx; else if (slideZ) B.z = nz;
    const v = Math.abs(B.speed);
    if (!slideX && !slideZ) { // head-on: stop, and a hard hit bounces you back a touch
      if (v > H.CRUISE * 0.45 && B.crashT <= 0) { B.kx = -fx * v * 0.3; B.kz = -fz * v * 0.3; B.crashT = 0.5; emit('crash', { v }); }
      B.speed = 0;
    } else { // scraping along a wall bleeds speed by how square you hit it
      const along = slideX ? Math.abs(fx) : Math.abs(fz);
      B.speed *= 1 - (1 - along) * Math.min(1, 6 * dt);
      if (v > 2 && B.crashT <= 0 && along < 0.75) { B.crashT = 0.35; emit('scrape', { v }); }
    }
  }
  // tree trunks, pillars, bollards: pushed round them (Dr. Mow's hay bales), every circle of the body
  for (let pass = 0; pass < 2; pass++) for (const [cx, cz, r] of circles(B)) for (const q of postsNear(W, cx, cz)) {
    if (q.y1 <= B.y + H.STEP || q.y0 >= B.y + H.HEIGHT) continue;
    const dx = cx - q.x, dz = cz - q.z, d = Math.hypot(dx, dz), min = q.r + r;
    if (d >= min || d < 1e-6) continue;
    const push = min - d;
    if (wallAt(W, B.x + (dx / d) * push, B.z + (dz / d) * push, B.y, H.WALL_MARGIN * 0.5, H.STEP, H.HEIGHT)) continue; // (never shoved into a wall)
    B.x += (dx / d) * push; B.z += (dz / d) * push;
    B.blocked = true;
    if (Math.abs(B.speed) > H.CRUISE * 0.5 && B.crashT <= 0) { B.crashT = 0.4; B.speed *= 0.5; emit('crash', { v: Math.abs(B.speed) * 2, post: q }); }
  }

  // --- hop input (buffered) + vertical
  if (ctl.jump) B.jumpBuf = H.JUMP_BUFFER;
  B.jumpBuf -= dt;
  if (B.grounded) {
    const g = groundAt(W, B.x, B.z, B.y + H.STEP);
    if (g && g.h >= B.y - H.SNAP_DOWN) { B.y = g.h; B.plat = g.p; }
    else { // rolled off a ledge. Off the top of a ramp you keep its climb (Dr. Mow set vy = 0): kickers launch cars
      B.vy = Math.max(0, rampClimb(B)); B.grounded = false; B.plat = null; B.coyote = H.COYOTE; B.airT = 0;
    }
  } else {
    B.coyote -= dt;
    B.airT += dt;
    const prevY = B.y;
    B.vy -= H.GRAVITY * dt;
    B.y += B.vy * dt;
    const ceil = ceilingAt(W, B.x, B.z, prevY + 0.1);
    if (B.vy > 0 && B.y + H.HEIGHT > ceil) { B.y = ceil - H.HEIGHT; B.vy = 0; emit('bonk'); } // head on the slab
    if (B.vy <= 0) {
      const g = groundAt(W, B.x, B.z, prevY + 0.02);
      if (g && B.y <= g.h) {
        B.y = g.h; B.plat = g.p; B.grounded = true;
        if (B.airT > 0.12) emit('land', { v: -B.vy });
        B.vy = 0;
      }
    }
  }
  if (B.jumpBuf > 0 && (B.grounded || B.coyote > 0)) {
    B.vy = H.JUMP_V; B.grounded = false; B.plat = null; B.coyote = 0; B.jumpBuf = 0; B.airT = 0;
    emit('jump');
  }
  if (B.grounded && !B.blocked) B.safe = { x: B.x, y: B.y, z: B.z, heading: B.heading };
  if (B.y < -30) { Object.assign(B, { ...B.safe, vy: 0, speed: 0, vh: B.safe.heading, grounded: false }); emit('respawn'); } // (out of the world: back where you last stood)
}

// Two bodies touching: pushed apart, the heavier one moving less (Dr. Mow's Versus bump, with mass).
// Returns the closing speed of the hit (0 when they don't touch).
export function bumpBodies(A, B, W = null) {
  if (Math.abs(A.y - B.y) > Math.min(A.H.HEIGHT, B.H.HEIGHT)) return 0;
  // (separation never pushes a body into a wall: the other one takes the whole push, or neither moves)
  const move = (P, dx, dz) => { if (!W || !blockedAt(W, P, P.x + dx, P.z + dz)) { P.x += dx; P.z += dz; return true; } return false; };
  let hit = 0;
  for (const [ax, az, ar] of circles(A)) for (const [bx, bz, br] of circles(B)) {
    const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz), min = ar + br;
    if (d >= min || d < 1e-6) continue;
    const nx = dx / d, nz = dz / d, over = min - d, ka = B.H.MASS / (A.H.MASS + B.H.MASS), kb = 1 - ka;
    if (!move(A, -nx * over * ka, -nz * over * ka)) move(B, nx * over * ka, nz * over * ka);
    if (!move(B, nx * over * kb, nz * over * kb)) move(A, -nx * over * kb, -nz * over * kb);
    const va = A.speed * (Math.sin(A.vh) * nx + Math.cos(A.vh) * nz), vb = B.speed * (Math.sin(B.vh) * nx + Math.cos(B.vh) * nz);
    const closing = va - vb;
    if (closing > 0) {
      hit = Math.max(hit, closing);
      // the lighter body gets shoved along the hit; both lose some speed
      B.kx += nx * closing * ka * 0.9; B.kz += nz * closing * ka * 0.9;
      A.kx -= nx * closing * kb * 0.9; A.kz -= nz * closing * kb * 0.9;
      A.speed *= 1 - 0.5 * ka; B.speed *= 1 - 0.5 * kb;
    }
  }
  return hit;
}
