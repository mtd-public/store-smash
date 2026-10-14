// See-through level (v0.99.62): when lawns, walls or hedges come between the camera and the mower, the part
// of them over the mower turns into a light purple screen door (most pixels dropped, the rest tinted), so you
// see yourself and the lawn round you instead of a purple silhouette. Hazards (saws, fire, icicles, rails…)
// keep their own materials, so they stay solid and plainly visible through the veil.
//
// How: the level's materials get one extra fragment step (patchSee). In view space the camera is the origin;
// a fragment is "in the way" when it is nearer than the mower along the camera→mower line, inside a cone round
// that line (a circle of constant size on screen) and above the mower's wheels (the lawn you stand on never
// fades). Those fragments are dropped on a 4×4 ordered-dither pattern: no transparency sorting, no extra draw
// call, it works on the static bake (js/bake.js shares patched materials only with patched ones), and the
// mower's own materials are never patched. Shadows use three.js's depth material, so they don't change.
// The farmer's x-ray silhouette (js/models.js) skips the pixels the veil keeps, so it no longer shows through.
//
// Store Smash (copied from dr-mow js/seethru.js, then extended):
//   * the overhead cut: while you're under a slab (the store's upper floor, the garage deck, the skybridge),
//     everything above your head within uSeeOverR metres of you dithers away too, not just the cone on the
//     camera line, so the whole floor you're on reads like a cutaway — aisles, rivals, shelves round you;
//   * the hole is bigger and keeps fewer pixels (set per frame from js/scene.js), and a dropped fragment is
//     tested once after both rules.
import * as THREE from 'three';

export const SEE = {
  uSeeOn: { value: 0 },                        // 1 while playing (frame() turns it off around other renders)
  uSeeV: { value: new THREE.Vector3() },       // the mower's chest, in view space
  uSeeY: { value: new THREE.Vector4(0, 1, 0, 0) }, // world height of a view-space point: dot(xyz, p) + w
  uSeeFoot: { value: 0 },                      // world height under which nothing fades (the wheels + a tall tuft: your own lawn and its grass never fade)
  uSeeR: { value: 3.4 },                       // radius of the hole round the mower, in metres at the mower
  uSeeKeep: { value: 0.3 },                    // share of pixels the veil keeps at full fade
  uSeeTint: { value: new THREE.Color(0xcdb4ff) }, // light lavender
  uSeeCam: { value: new THREE.Matrix4() },     // camera → world (to place a fragment in the world)
  uSeeP: { value: new THREE.Vector3() },       // your dasher's feet, in the world
  uSeeOver: { value: 0 },                      // 1 while you're under a slab: the overhead cut is on
  uSeeOverR: { value: 12 },                    // its radius (m, round you, horizontally)
  uSeeHead: { value: 2.1 },                    // height over your feet above which it cuts
};

const DECL = /* glsl */ `
uniform float uSeeOn;
uniform vec3 uSeeV;
uniform vec4 uSeeY;
uniform float uSeeFoot;
uniform float uSeeR;
uniform float uSeeKeep;
uniform vec3 uSeeTint;
uniform mat4 uSeeCam;
uniform vec3 uSeeP;
uniform float uSeeOver;
uniform float uSeeOverR;
uniform float uSeeHead;
varying vec3 vSeeV;
float seeBayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float seeBayer(vec2 a) { return seeBayer2(0.5 * a) * 0.25 + seeBayer2(a); } // 4x4 ordered dither, 0..15/16
`;
// at the top of main(): how far this fragment is "in the way" (seeK), and drop it on the dither pattern
const BODY = /* glsl */ `
  float seeK = 0.0;
  if (uSeeOn > 0.5) {
    float seeL = length(uSeeV);
    vec3 seeD = uSeeV / seeL;
    float seeA = dot(vSeeV, seeD);
    if (seeA > 0.0 && seeA < seeL + 0.3) {
      float seeR = uSeeR * seeA / seeL, seeOff = length(vSeeV - seeD * seeA), seeCone = 1.0 - smoothstep(seeR * 0.6, seeR, seeOff);
      #ifdef SEE_HULL
        // an ink line's far inside wall (it faces away from the camera) only shows because the face in front
        // of it was dropped: drop it too, whatever its height (it sits lower than that face, on the same ray,
        // and can be right up against the mower)
        if (seeOff < seeR * 1.3 && dot(normalize(vSeeN), normalize(vSeeV)) > 0.3) discard;
      #endif
      float seeH = dot(uSeeY.xyz, vSeeV) + uSeeY.w;
      seeK = seeCone * smoothstep(seeL - 0.2, seeL - 0.7, seeA) * smoothstep(uSeeFoot, uSeeFoot + 0.3, seeH);
    }
    if (uSeeOver > 0.5) { // under a slab: everything over your head near you goes too
      vec3 seeW = (uSeeCam * vec4(vSeeV, 1.0)).xyz;
      float seeO = (1.0 - smoothstep(uSeeOverR * 0.7, uSeeOverR, length(seeW.xz - uSeeP.xz))) * smoothstep(uSeeP.y + uSeeHead, uSeeP.y + uSeeHead + 0.25, seeW.y);
      seeK = max(seeK, seeO);
    }
    if (seeK > 0.0 && seeBayer(gl_FragCoord.xy) >= 1.0 - seeK * (1.0 - uSeeKeep)) discard;
  }
`;
const TINT = /* glsl */ `
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uSeeTint, seeK * 0.7);
`;

// The shader edit itself (also chained by materials with their own onBeforeCompile: the grass).
export function seeShader(sh, hull = false) {
  Object.assign(sh.uniforms, SEE);
  let vs = sh.vertexShader;
  if (vs.includes('#include <project_vertex>')) vs = vs.replace('#include <project_vertex>', '#include <project_vertex>\n  vSeeV = mvPosition.xyz;');
  else vs = vs.replace(/gl_Position = projectionMatrix \* (\w+);/, (s, mv) => `${s}\n  vSeeV = ${mv}.xyz;${hull ? '\n  vSeeN = normalMatrix * normal;' : ''}`);
  sh.vertexShader = 'varying vec3 vSeeV;\n' + (hull ? 'varying vec3 vSeeN;\n' : '') + vs;
  sh.fragmentShader = (hull ? '#define SEE_HULL\nvarying vec3 vSeeN;\n' : '') + DECL + sh.fragmentShader.replace('void main() {', 'void main() {' + BODY).replace(/\}\s*$/, TINT + '}');
}
function seePatch(sh) { seeShader(sh); }
function seePatchHull(sh) { seeShader(sh, true); }
// three.js's clone() drops onBeforeCompile; a patched material's clones (a recoloured copy, a Flower Climb
// ghost, the bake's shared copy) stay patched.
function seeClone() { const n = Object.getPrototypeOf(this).clone.call(this); n.onBeforeCompile = this.onBeforeCompile; n.clone = seeClone; return n; }
seePatch.bakeKey = seeClone.bakeKey = 'see'; seePatchHull.bakeKey = 'seeHull'; // (js/bake.js: patched materials still share one vertex-coloured copy per look)

// A patched copy of a level material (one per original, so the mower's own copy stays as it is).
const copies = new WeakMap();
function seeMat(m) {
  if (m.onBeforeCompile === seePatch || m.onBeforeCompile === seePatchHull) return m;
  let c = copies.get(m);
  if (!c) {
    const plainFn = m.onBeforeCompile === THREE.Material.prototype.onBeforeCompile;
    if (!plainFn || m.transparent || (m.isShaderMaterial && !m.userData.outline) || m.isMeshDepthMaterial) c = m; // (its own shader, or see-through already: leave it)
    else { c = m.clone(); c.onBeforeCompile = m.userData.outline ? seePatchHull : seePatch; c.clone = seeClone; }
    copies.set(m, c);
  }
  return c;
}

// Patch every mesh under `group` (a lawn, wall, hedge…). Skips meshes that fade their own way (noBake: the
// Flower Climb ghosts, wine) and instanced ones (the grass: its material is patched where it is made).
export function seeThroughGroup(group) {
  group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.noBake) return;
    o.material = Array.isArray(o.material) ? o.material.map(seeMat) : seeMat(o.material);
  });
}

// Patch a material in place (the grass and leaf piles: only ever on lawns, never on the mower).
export function seeInPlace(m) {
  const own = m.onBeforeCompile;
  if (own === THREE.Material.prototype.onBeforeCompile) m.onBeforeCompile = seePatch;
  else { m.onBeforeCompile = (sh, r) => { own.call(m, sh, r); seeShader(sh); }; m.customProgramCacheKey = () => own.toString() + '+see'; }
  return m;
}

// The farmer's x-ray silhouette: drop it where the veil keeps a pixel (so the veil isn't speckled purple).
export function seeXray(m) {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, SEE);
    sh.fragmentShader = DECL.replace('varying vec3 vSeeV;', '') + sh.fragmentShader.replace('void main() {', 'void main() {\n  if (uSeeOn > 0.5 && seeBayer(gl_FragCoord.xy) < uSeeKeep) discard;');
  };
  return m;
}

const _m = new THREE.Vector3();
// Per frame, just before rendering: where the mower is (world x, y, z of its chest; footY = its wheels).
export function updateSee(camera, x, y, z, footY, on, over = null) {
  SEE.uSeeOn.value = on ? 1 : 0;
  SEE.uSeeOver.value = on && over ? 1 : 0;
  if (!on) return;
  camera.updateMatrixWorld();
  SEE.uSeeCam.value.copy(camera.matrixWorld);
  if (over) { SEE.uSeeP.value.set(x, over.feet, z); SEE.uSeeOverR.value = over.r; SEE.uSeeHead.value = over.head; }
  _m.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
  SEE.uSeeV.value.copy(_m);
  const e = camera.matrixWorld.elements;
  SEE.uSeeY.value.set(e[1], e[5], e[9], e[13]);
  SEE.uSeeFoot.value = footY;
}
