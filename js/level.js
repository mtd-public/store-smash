// The test level, as data: a two-storey grocery store with its outdoor garden centre, an outdoor parking lot,
// a two-level indoor parking garage joined to the store's upper floor by a skybridge, all on one block of a
// 5 × 5 city grid with houses, apartments, towers, parks and a stunt lot. No three.js: the sim, the nav graph
// and the headless proof read it; js/scene.js draws it.
//
// Coordinates: metres; x east, z south, y up. Heading 0 faces +z (south), π faces north (Dr. Mow's convention).
// Every collision shape is a `plat` (js/world.js) with render hints: mat (material key), color, tag (a group the
// renderer can cut away: the store roof and upper walls when you're inside), floor (walkable: the nav graph samples
// its top). Things that only draw go in `decor`.
import { mulberry32 } from './utils.js';

export const G = 0.15;          // block surface (a 15 cm curb above the roads)
export const F2 = 5.15;         // the store's upper floor and the garage roof deck
const SLAB = 0.45;              // floor slab thickness
const WALL_TOP = 10.5;          // store parapet
const DOOR_TOP = G + 3.4;       // door / glass height
const RAIL = 1.6;               // railing height: above a cart's hop + step (1.17 + 0.35), so nobody ends up standing on one
export const PITCH = 100;       // city block pitch: 86 m blocks, 14 m roads
export const HALF = 43;         // half a block
export const CITY = 2;          // blocks run -CITY..CITY
export const EDGE = CITY * PITCH + 57; // outer edge of the ring road (257)

// Departments, and the kind of fixture each can be stocked on (the store's layout is shuffled per match).
export const DEPTS = {
  produce: { name: 'Produce', color: 0x5bbf4a, fits: 'table' },
  garden: { name: 'Garden Center', color: 0x3fae7a, fits: 'table' },
  paper: { name: 'Paper Goods', color: 0x56a8e8, fits: 'shelf' },
  hardware: { name: 'Hardware', color: 0xe8743b, fits: 'shelf' },
  toys: { name: 'Toys', color: 0xf05aa0, fits: 'shelf' },
  home: { name: 'Home & Carpet', color: 0xa77be0, fits: 'shelf' },
};

// Street names: east–west roads by z, north–south roads by x (road centrelines at ±50, ±150, ±250).
const EW = { '-250': 'North Rd', '-150': 'Pine St', '-50': 'Oak St', 50: 'Maple St', 150: 'Elm St', 250: 'South Rd' };
const NS = { '-250': 'West Way', '-150': '1st Ave', '-50': '2nd Ave', 50: '3rd Ave', 150: '4th Ave', 250: 'East Way' };

// City block types, [j][i] for i, j in -2..2 (rows north to south).
const MAP = [
  ['park', 'houses', 'towers', 'houses', 'apts'],
  ['houses', 'towers', 'towers', 'park', 'houses'],
  ['apts', 'houses', 'store', 'houses', 'stunt'],
  ['houses', 'park', 'apts', 'towers', 'houses'],
  ['houses', 'apts', 'houses', 'houses', 'park'],
];

export function buildLevel() {
  const L = { plats: [], posts: [], decor: [], signs: [], slots: [], deptZones: {}, carSpots: [], starts: [], addresses: [], navRegions: [], zones: {}, streets: { EW, NS } };
  const rng = mulberry32(20261013); // the static world (parked cars, house colours) is the same every match
  const P = (o) => { L.plats.push(o); return o; };
  // An edge-based box (Dr. Mow's `box` helper): x0..x1, z0..z1, top, thickness (or { bot }).
  const box = (x0, x1, z0, z1, top, thick, mat, color, extra = {}) => P({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h: top, thick, mat, color, ...extra });
  const floor = (x0, x1, z0, z1, top, mat, color, extra = {}) => box(x0, x1, z0, z1, top, extra.thick ?? 1, mat, color, { floor: true, ...extra });
  // A ramp rising along `axis` from h0 (at x0 / z0) to h1 (at x1 / z1).
  const ramp = (x0, x1, z0, z1, axis, h0, h1, mat, color, extra = {}) => P({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h: Math.max(h0, h1), thick: 0.3, ramp: { axis, h0, h1 }, mat, color, floor: true, ...extra });
  const post = (x, z, r, y0, y1, kind, extra = {}) => { const q = { x, z, r, y0, y1, kind, ...extra }; L.posts.push(q); return q; };
  const decor = (o) => { L.decor.push(o); return o; };
  const sign = (text, x, y, z, rot, w, h, bg, fg = '#ffffff', extra = {}) => L.signs.push({ text, x, y, z, rot, w, h, bg, fg, ...extra });
  // A wall from the floor up, split at door height: the part above is tagged so the renderer can cut it away.
  const wall = (x0, x1, z0, z1, mat = 'wall', color = 0xf3eadb, tag = 'storeUpper') => {
    box(x0, x1, z0, z1, DOOR_TOP, DOOR_TOP, mat, color, { solid: true });
    box(x0, x1, z0, z1, WALL_TOP, WALL_TOP - DOOR_TOP, mat, color, { tag, solid: true });
  };
  const lintel = (x0, x1, z0, z1, bot = DOOR_TOP, top = WALL_TOP, tag = 'storeUpper', color = 0xf3eadb) => box(x0, x1, z0, z1, top, top - bot, 'wall', color, { tag, solid: true });

  buildStoreBlock(L, { box, floor, ramp, post, decor, sign, wall, lintel, rng });
  buildCity(L, { box, floor, ramp, post, decor, sign, rng });

  // Nav sampling: dense on the store block (both floors, ramps, garage levels), coarse over the city.
  L.navRegions.push({ x0: -42, x1: 42, z0: -42, z1: 42, step: 1.6 });
  L.navRegions.push({ x0: -EDGE + 2, x1: EDGE - 2, z0: -EDGE + 2, z1: EDGE - 2, step: 6.5, skip: { x0: -43, x1: 43, z0: -43, z1: 43 } });
  return L;
}

// ---------------------------------------------------------------- the store block (0, 0)
function buildStoreBlock(L, { box, floor, ramp, post, decor, sign, wall, lintel, rng }) {
  // Ground partition (no two floors overlap, so nothing z-fights):
  floor(-43, 43, -43, -40, G, 'sidewalk', 0xd9d4cc);           // sidewalk ring
  floor(-43, 43, 40, 43, G, 'sidewalk', 0xd9d4cc);
  floor(-43, -40, -40, 40, G, 'sidewalk', 0xd9d4cc);
  floor(40, 43, -40, 40, G, 'sidewalk', 0xd9d4cc);
  floor(-40, -28, -40, -4, G, 'pavers', 0xc9b79c);              // garden centre (outdoor)
  floor(-40, -28, -4, 4, G, 'sidewalk', 0xd9d4cc);               // garden apron
  floor(-28, 16, -40, -2, G, 'storeFloor', 0xffffff);            // the store's ground floor
  floor(-28, 16, -2, 4, G, 'sidewalk', 0xd9d4cc);                // front plaza
  floor(16, 20, -40, 4, G, 'sidewalk', 0xd9d4cc);                // walkway to the garage
  floor(20, 40, -40, 4, G, 'concrete', 0xb8b8bc, { tag: 'garageGround' }); // garage level 1 (indoor)
  floor(-40, 40, 4, 40, G, 'lot', 0x55565c);                     // outdoor parking lot
  L.zones.store = { x0: -28, x1: 16, z0: -40, z1: -2, y0: -1, y1: WALL_TOP };
  L.zones.garage = { x0: 20, x1: 40, z0: -40, z1: 4, y0: -1, y1: F2 - 0.2 };

  // --- store shell
  wall(-28, 16, -40, -39.5);                                      // north (back)
  wall(-28, -27.5, -39.5, -12); wall(-28, -27.5, -6, -2.5); lintel(-28, -27.5, -12, -6); // west, garden door z -12..-6
  wall(15.5, 16, -39.5, -34); wall(15.5, 16, -28, -12); wall(15.5, 16, -6, -2.5); lintel(15.5, 16, -12, -6); // east, door to the garage walkway
  box(15.5, 16, -34, -28, DOOR_TOP, DOOR_TOP, 'wall', 0xf3eadb, { solid: true });           // under the skybridge door
  box(15.5, 16, -34, -28, F2, F2 - DOOR_TOP, 'wall', 0xf3eadb, { tag: 'storeUpper', solid: true });
  lintel(15.5, 16, -34, -28, F2 + 3.35);
  // front: glass shopfronts either side of the entrance (x -10..-2)
  wall(-28, -26, -2.5, -2); box(-26, -12, -2.5, -2, DOOR_TOP, DOOR_TOP - G, 'glass', 0xbfe6ff, { solid: true }); lintel(-26, -12, -2.5, -2);
  wall(-12, -10, -2.5, -2); lintel(-10, -2, -2.5, -2);
  wall(-2, 0, -2.5, -2); box(0, 14, -2.5, -2, DOOR_TOP, DOOR_TOP - G, 'glass', 0xbfe6ff, { solid: true }); lintel(0, 14, -2.5, -2);
  wall(14, 16, -2.5, -2);
  box(-28, 16, -40, -2, WALL_TOP + 0.3, 0.3, 'roof', 0xe8e2d6, { tag: 'storeRoof' });
  sign('STORE SMASH', -6, 7.4, -1.9, 0, 15, 2.6, '#e8423b', '#fff6d8', { tag: 'storeUpper', font: 'logo' });
  sign('GROCERY · HOME · GARDEN', -6, 5.3, -1.9, 0, 12, 1.1, '#2b3a55', '#ffe066', { tag: 'storeUpper' });
  sign('ENTRANCE', -6, DOOR_TOP + 0.5, -1.85, 0, 5, 0.8, '#3fae7a');

  // --- upper floor (mezzanine) over the back of the store, two travelator ramps up from the front hall
  floor(-27.5, 15.5, -39.5, -18, F2, 'storeFloor2', 0xffffff, { thick: SLAB, tag: 'mezz' });
  floor(-27.5, -24, -18, -14, F2, 'storeFloor2', 0xffffff, { thick: SLAB, tag: 'mezz' });   // west landing
  floor(12, 15.5, -18, -14, F2, 'storeFloor2', 0xffffff, { thick: SLAB, tag: 'mezz' });     // east landing
  ramp(-24, -10, -18, -14, 'x', F2, G, 'travelator', 0xffffff);  // west ramp: up toward the west wall
  ramp(-2, 12, -18, -14, 'x', G, F2, 'travelator', 0xffffff);    // east ramp: up toward the east wall
  box(-24, 12, -18.15, -18, F2 + RAIL, RAIL, 'rail', 0x9fb4c8);   // the mezzanine's edge
  P2(L, { x: -17, z: -13.92, w: 14, d: 0.15, h: F2 + RAIL, thick: F2 + RAIL, bot: 0, ramp: { axis: 'x', h0: F2 + RAIL, h1: G + RAIL }, mat: 'rail', color: 0x9fb4c8 }); // ramp balustrades
  P2(L, { x: 5, z: -13.92, w: 14, d: 0.15, h: F2 + RAIL, thick: F2 + RAIL, bot: 0, ramp: { axis: 'x', h0: G + RAIL, h1: F2 + RAIL }, mat: 'rail', color: 0x9fb4c8 });
  box(-27.5, -24, -14, -13.85, F2 + RAIL, RAIL, 'rail', 0x9fb4c8);
  box(12, 15.5, -14, -13.85, F2 + RAIL, RAIL, 'rail', 0x9fb4c8);
  for (const x of [-26, 14]) post(x, -13.9, 0.3, 0, F2 - SLAB, 'column'); // landing columns
  for (const x of [-20, -6, 2, 10]) post(x, -18.6, 0.3, 0, F2 - SLAB, 'column'); // mezzanine columns along its edge

  // --- department zones. The fixtures are fixed; which department fills which zone is shuffled every match
  // (js/order.js makeLayout), so the signs that name them are drawn per match too (js/scene.js). Slots are where
  // a product sits; `at` is the spot in the aisle that grabs it.
  const zone = (id, kind, label, signs) => (L.deptZones[id] = { id, kind, label, signs, slots: [] });
  const shelfRow = (zid, xs, y, top, faces = 4, mat = 'shelf', zA = -36, zB = -21.5) => {
    const Z = L.deptZones[zid];
    for (const x of xs) {
      box(x - 0.6, x + 0.6, zA, zB, y + top, top, mat, mat === 'shelf' ? 0xffffff : 0xc89a6a, { zone: zid });
      Z.headers ||= []; Z.headers.push({ x, y: y + top, z0: zA, z1: zB });
      for (const side of [-1, 1]) for (let k = 0; k < faces; k++) {
        const z = zA + 1.6 + (k * (zB - zA - 3.2)) / (faces - 1);
        const onTop = top < 2; // (low racks: goods lie on top; shelves: two levels on each face)
        Z.slots.push(L.slots.push({ zone: zid, x: x + side * (onTop ? 0.3 : 0.42), y: onTop ? y + top : y + (k % 2 ? 1.25 : 0.55), z, at: { x: x + side * 1.45, y, z }, face: side * Math.PI / 2, shelf: !onTop, rack: onTop }) - 1);
      }
    }
  };
  zone('GW', 'shelf', 'Ground floor, back left', [{ x: -18.5, y: 3.9, z: -21, w: 7, h: 1 }]);
  zone('GE', 'shelf', 'Ground floor, back right', [{ x: 6.5, y: 3.9, z: -21, w: 7, h: 1 }]);
  zone('UW', 'shelf', 'Upper floor, left', [{ x: -18.5, y: F2 + 3.6, z: -21, w: 7, h: 1.1, tag: 'storeUpper' }]);
  zone('UE', 'rack', 'Upper floor, right', [{ x: 6.5, y: F2 + 3.6, z: -21, w: 7, h: 1.1, tag: 'storeUpper' }]);
  zone('HALL', 'table', 'Front hall', [{ x: -18, y: 4.4, z: -8.4, w: 6.5, h: 1.1 }]);
  zone('YARD', 'table', 'Outdoors (west side)', [{ x: -34, y: 3.4, z: -4.1, w: 7, h: 1, post: true }]);
  shelfRow('GW', [-23.5, -18.5, -13.5], G, 2.2);
  shelfRow('GE', [1.5, 6.5, 11.5], G, 2.2);
  shelfRow('UW', [-23.5, -18.5, -13.5], F2, 2.2);
  shelfRow('UE', [1.5, 6.5, 11.5], F2, 1.3, 3, 'rack');
  // the front hall: six bins
  for (const [bi, bx] of [-23, -18, -13].entries()) for (const [bk, bz] of [-10.6, -6.2].entries()) {
    box(bx - 1.3, bx + 1.3, bz - 0.9, bz + 0.9, G + 0.95, 0.95, 'bin', 0x8a5a3a, { zone: 'HALL' });
    const bin = bi * 2 + bk;
    for (const sx of [-0.65, 0.65]) for (const sz of [-1, 1]) L.deptZones.HALL.slots.push(L.slots.push({ zone: 'HALL', bin, x: bx + sx, y: G + 0.95, z: bz + sz * 0.42, at: { x: bx + sx, y: G, z: bz + sz * 2.05 }, face: 0, table: true }) - 1);
  }
  // signposts for the floors (their text names this match's departments)
  L.floorSigns = [{ x: -17, y: 3.2, z: -13.8, w: 9, h: 0.9, floor: 'U' }, { x: 5, y: 3.2, z: -13.8, w: 9, h: 0.9, floor: 'U' }];
  L.directory = { x: -14.6, y: G + 1.5, z: -3.6, w: 3.6, h: 2.6 }; // the store directory, just inside the doors
  // checkouts (in the way, like real ones)
  for (const x of [4, 8, 12]) { box(x - 0.5, x + 0.5, -10, -6.4, G + 1, 1, 'counter', 0x3b4a66); decor({ type: 'register', x, y: G + 1, z: -9.2 }); }
  sign('CHECKOUT', 8, 4.2, -8.2, 0, 6, 1, '#2b3a55', '#ffe066', { hang: true });

  // --- outdoor yard: fenced, door from the front hall's west wall, gate to the lot
  const FENCE = G + 1.8; // (taller than a hop + step: you can't climb out)
  box(-40, -39.85, -40, -4, FENCE, FENCE, 'fence', 0x2f8a55); box(-40, -28, -40, -39.85, FENCE, FENCE, 'fence', 0x2f8a55);
  box(-40, -36, -4.15, -4, FENCE, FENCE, 'fence', 0x2f8a55); box(-31, -28, -4.15, -4, FENCE, FENCE, 'fence', 0x2f8a55);
  for (const [z0, z1] of [[-37, -29], [-25, -17]]) {
    box(-35, -33, z0, z1, G + 0.9, 0.9, 'bench', 0x9a6b42, { zone: 'YARD' });
    for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
      const z = z0 + 1.4 + k * ((z1 - z0 - 2.8) / 2);
      L.deptZones.YARD.slots.push(L.slots.push({ zone: 'YARD', x: -34 + side * 0.5, y: G + 0.9, z, at: { x: -34 + side * 2.4, y: G, z }, face: side * Math.PI / 2, table: true }) - 1);
    }
  }
  for (const [x, z] of [[-38, -38], [-30, -38], [-38, -12], [-30.5, -14]]) { post(x, z, 0.7, 0, G + 0.8, 'pot'); decor({ type: 'tree', x, y: G + 0.8, z, h: 3.2, r: 1.3, potted: true }); }

  // --- parking garage (east): level 1 indoor, roof deck on top, ramp inside, skybridge to the upper floor
  box(20, 40, -40, -39.6, F2 + 1.5, F2 + 1.5, 'concrete', 0xa9a9ae, { solid: true });                  // north wall
  floor(20, 34, -39.6, 4, F2, 'deck', 0xb8b8bc, { thick: 0.5, tag: 'deck' });
  floor(34, 40, -39.6, -30, F2, 'deck', 0xb8b8bc, { thick: 0.5, tag: 'deck' });
  floor(34, 40, -6, 4, F2, 'deck', 0xb8b8bc, { thick: 0.5, tag: 'deck' });
  ramp(34.2, 39.6, -30, -6, 'z', F2, G, 'concrete', 0x9a9aa0);                                     // up to the north
  P2(L, { x: 39.85, z: -18, w: 0.3, d: 24, h: F2 + 1.5, thick: F2 + 1.5, bot: 0, ramp: { axis: 'z', h0: F2 + 1.5, h1: G + 1.5 }, mat: 'concrete', color: 0xa9a9ae });
  box(33.8, 34, -30, -6, F2 + 1.5, 1.5, 'concrete', 0xa9a9ae);                                          // parapet over the ramp well
  box(34, 40, -6.2, -6, F2 + 1.5, 1.5, 'concrete', 0xa9a9ae);
  box(20, 40, 3.6, 4, F2 + 1.5, 1.5, 'concrete', 0xa9a9ae);                                             // deck parapets
  box(39.6, 40, -39.6, -30, F2 + 1.5, 1.5, 'concrete', 0xa9a9ae); box(39.6, 40, -6, 3.6, F2 + 1.5, 1.5, 'concrete', 0xa9a9ae);
  box(20, 20.4, -39.6, -34, F2 + 1.5, 1.5, 'concrete', 0xa9a9ae); box(20, 20.4, -28, 3.6, F2 + 1.5, 1.5, 'concrete', 0xa9a9ae);
  for (const z of [-34, -24, -14, -4]) post(26, z, 0.45, 0, F2 - 0.5, 'column');
  for (const z of [-34, -24, -14]) post(33.5, z, 0.45, 0, F2 - 0.5, 'column');
  floor(16, 20, -34, -28, F2, 'deck', 0xc9c4d6, { thick: 0.5, tag: 'bridge' });                    // skybridge
  box(16, 20, -34.15, -34, F2 + RAIL, RAIL, 'rail', 0x9fb4c8); box(16, 20, -28, -27.85, F2 + RAIL, RAIL, 'rail', 0x9fb4c8);
  decor({ type: 'canopy', x: 18, z: -31, y: F2 + 3.3, w: 4.4, d: 6.6 });
  sign('PARKING', 30, F2 + 2.2, 4.1, 0, 6, 1.2, '#2f6fd6', '#fff');
  sign('P1 · INDOOR PARKING', 30, 3.6, 4.15, 0, 7, 0.8, '#2b3a55', '#fff');
  sign('SKYBRIDGE → ROOF PARKING', 13.5, F2 + 2.6, -31, -Math.PI / 2, 6.5, 0.8, '#2f6fd6', '#fff', { tag: 'storeUpper' });
  sign('ROOF PARKING', 30, F2 + 2.4, -39.4, 0, 6, 1, '#2f6fd6', '#fff');

  // --- front plaza: bollards keep cars out of the entrance (carts slip between)
  for (const x of [-11.6, -9.6, -7.6, -5.6, -3.6, -1.6, 0.4]) post(x, 3.2, 0.28, 0, G + 1, 'bollard');
  decor({ type: 'corral', x: 6, y: G, z: 1, w: 5, d: 1.8 });
  box(3.5, 8.5, 0.1, 1.9, G + 1.1, 1.1, 'rail', 0x9fb4c8, { hidden: true }); // (the corral's collision)
  for (let i = 0; i < 6; i++) L.starts.push({ x: -9.6 + i * 1.44, y: G, z: 0.6, heading: Math.PI }); // lined up at the doors

  // --- outdoor lot: three rows of stalls. Dasher spots stay clear on both sides.
  const stalls = [];
  const row = (z0, z1, heading) => { for (let x = -37.6; x <= 37.7; x += 2.8) stalls.push({ x, z: (z0 + z1) / 2, heading, z0, z1 }); };
  row(7, 12, 0); row(20, 25, Math.PI); row(25, 30, 0);
  decor({ type: 'stalls', list: stalls.map((s) => ({ x: s.x, z: s.z, z0: s.z0, z1: s.z1 })) });
  const spots = [
    { x: -18.4, y: G, z: 9.5, heading: 0, area: 'Outdoor lot (front row)' },
    { x: 15.2, y: G, z: 27.5, heading: 0, area: 'Outdoor lot (back row)' },
    { x: 23.2, y: G, z: -19, heading: Math.PI / 2, area: 'Garage level 1 (indoor)' },
    { x: 23.2, y: G, z: -6, heading: Math.PI / 2, area: 'Garage level 1 (indoor)' },
    { x: 23.2, y: F2, z: -21, heading: Math.PI / 2, area: 'Garage roof (skybridge)' },
    { x: 23.2, y: F2, z: -10, heading: Math.PI / 2, area: 'Garage roof (skybridge)' },
  ];
  L.carSpots.push(...spots);
  const near = (x, z, y) => spots.some((s) => Math.abs(s.y - y) < 1 && Math.abs(s.x - x) < 5.2 && Math.abs(s.z - z) < 5.2);
  const colors = [0xd94a4a, 0x3a6fd8, 0xf2f2f2, 0x2b2b30, 0xb8bcc4, 0x4caf6a, 0xf2c14e, 0x8a5ad8];
  const parked = (x, y, z, heading) => {
    const along = Math.abs(Math.sin(heading)) > 0.5, w = along ? 4.3 : 1.9, d = along ? 1.9 : 4.3;
    const color = colors[Math.floor(rng() * colors.length)];
    box(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y + 1.45, 1.45, 'carBody', color, { hidden: true, parked: true });
    decor({ type: 'parkedCar', x, y, z, heading, color });
  };
  for (const s of stalls) if (!near(s.x, s.z, G) && rng() < 0.42) parked(s.x, G, s.z, s.heading);
  for (let z = -37; z <= 1; z += 2.9) { // garage stalls along the west side, both levels
    if (!near(23.2, z, G) && rng() < 0.55) parked(23.2, G, z, Math.PI / 2);
    if (!(z > -35.5 && z < -26.5) && !near(23.2, z, F2) && rng() < 0.45) parked(23.2, F2, z, Math.PI / 2);
  }
  decor({ type: 'garageStalls', x: 23.2, z0: -37, z1: 1, step: 2.9, ys: [G, F2] });
  for (const [x, z] of [[-39.2, 16], [39.2, 16], [-25, 25], [0.2, 25], [25.4, 25], [-20, 39.3], [20, 39.3]]) { post(x, z, 0.25, 0, 7, 'lamp'); decor({ type: 'lamp', x, y: G, z }); } // (between stalls and on the edges, never in a lane)
}

// ---------------------------------------------------------------- the city
function buildCity(L, { box, floor, ramp, post, decor, sign, rng }) {
  // Outer border: grass verge and a hedge wall so nobody drives off the map.
  const B = EDGE, V = EDGE + 14;
  floor(-V, V, -V, -B, G, 'grass', 0x7ccf6a); floor(-V, V, B, V, G, 'grass', 0x7ccf6a);
  floor(-V, -B, -B, B, G, 'grass', 0x7ccf6a); floor(B, V, -B, B, G, 'grass', 0x7ccf6a);
  box(-V, V, -V, -V + 2, 4, 4, 'hedge', 0x3e8f4a); box(-V, V, V - 2, V, 4, 4, 'hedge', 0x3e8f4a);
  box(-V, -V + 2, -V + 2, V - 2, 4, 4, 'hedge', 0x3e8f4a); box(V - 2, V, -V + 2, V - 2, 4, 4, 'hedge', 0x3e8f4a);
  for (let j = -CITY; j <= CITY; j++) for (let i = -CITY; i <= CITY; i++) {
    const type = MAP[j + CITY][i + CITY], cx = i * PITCH, cz = j * PITCH;
    if (type === 'store') continue;
    // sidewalk ring + interior
    const H = HALF, S = 3;
    floor(cx - H, cx + H, cz - H, cz - H + S, G, 'sidewalk', 0xd9d4cc); floor(cx - H, cx + H, cz + H - S, cz + H, G, 'sidewalk', 0xd9d4cc);
    floor(cx - H, cx - H + S, cz - H + S, cz + H - S, G, 'sidewalk', 0xd9d4cc); floor(cx + H - S, cx + H, cz - H + S, cz + H - S, G, 'sidewalk', 0xd9d4cc);
    const I = H - S;
    const ctx = { L, box, floor, ramp, post, decor, sign, rng, cx, cz, I, i, j };
    ({ houses, apts, towers, park, stunt })[type](ctx);
  }
}

const streetName = (dir, v) => (dir === 'ew' ? EW[v] : NS[v]);
const houseNo = (v, odd) => 100 + Math.round((v + 260) / 4) * 2 + (odd ? 1 : 0); // (odd numbers on the south side of a street, like real ones)
function address(L, x, z, y, side, cx, cz, kind) {
  // side: which road it faces: 'n' | 's' | 'e' | 'w'; the pad sits on the sidewalk by the curb
  const roadZ = side === 'n' ? cz - 50 : cz + 50, roadX = side === 'w' ? cx - 50 : cx + 50;
  const name = side === 'n' || side === 's' ? `${houseNo(x, side === 'n')} ${streetName('ew', roadZ)}` : `${houseNo(z, side === 'w')} ${streetName('ns', roadX)}`;
  const heading = { n: Math.PI, s: 0, e: Math.PI / 2, w: -Math.PI / 2 }[side];
  L.addresses.push({ x, y, z, heading, name, kind });
}

const PASTEL = [0xf6c7b6, 0xf8e3a3, 0xbfe3c8, 0xbcd7f2, 0xe2c6ef, 0xf4b6c2, 0xd8d0c0, 0xc6e8e4];
function houses({ L, box, floor, post, decor, rng, cx, cz, I }) {
  floor(cx - I, cx + I, cz - I, cz + I, G, 'grass', 0x86d46f);
  for (const side of ['n', 's']) for (let k = -2; k <= 2; k++) {
    const hx = cx + k * 16, front = side === 's' ? cz + I : cz - I, hz = side === 's' ? front - 11.5 : front + 11.5;
    const color = PASTEL[Math.floor(rng() * PASTEL.length)], ht = 3.6 + Math.floor(rng() * 2) * 2.4;
    box(hx - 5, hx + 5, hz - 4.5, hz + 4.5, G + ht, ht, 'house', color);
    decor({ type: 'roof', x: hx, z: hz, y: G + ht, w: 10.6, d: 9.6, h: 2.6, color: [0xb5533c, 0x6b6f7a, 0x3e5f8a, 0x8a4f6e][Math.floor(rng() * 4)] });
    decor({ type: 'path', x: hx, z: (front + hz) / 2 + (side === 's' ? 2.2 : -2.2), w: 1.6, d: Math.abs(front - hz) - 4.5 });
    decor({ type: 'door', x: hx, y: G, z: hz + (side === 's' ? 4.52 : -4.52), rot: side === 's' ? 0 : Math.PI });
    address(L, hx, front + (side === 's' ? 1.6 : -1.6), G, side, cx, cz, 'house');
    if (rng() < 0.7) { const tx = hx + (rng() < 0.5 ? -6.5 : 6.5), tz = hz + (side === 's' ? -9 : 9); post(tx, tz, 0.35, 0, 6, 'trunk'); decor({ type: 'tree', x: tx, y: G, z: tz, h: 5 + rng() * 2, r: 2 + rng() }); }
  }
}
function apts({ L, box, floor, post, decor, sign, rng, cx, cz, I }) {
  floor(cx - I, cx + I, cz - I, cz + I, G, 'plaza', 0xcfc6b8);
  for (const side of ['n', 's']) {
    const front = side === 's' ? cz + I : cz - I, hz = side === 's' ? front - 16 : front + 16;
    const color = PASTEL[Math.floor(rng() * PASTEL.length)], ht = 12 + Math.floor(rng() * 3) * 3;
    box(cx - 20, cx + 20, hz - 9, hz + 9, G + ht, ht, 'apartment', color);
    decor({ type: 'door', x: cx, y: G, z: hz + (side === 's' ? 9.02 : -9.02), rot: side === 's' ? 0 : Math.PI, wide: true });
    address(L, cx, front + (side === 's' ? 1.6 : -1.6), G, side, cx, cz, 'apartment');
    for (const tx of [cx - 30, cx + 30]) { post(tx, hz, 0.35, 0, 6, 'trunk'); decor({ type: 'tree', x: tx, y: G, z: hz, h: 6, r: 2.4 }); }
  }
}
function towers({ L, box, floor, decor, rng, cx, cz, I }) {
  floor(cx - I, cx + I, cz - I, cz + I, G, 'plaza', 0xc4c9d1);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = cx + sx * 19, z = cz + sz * 19, ht = 22 + Math.floor(rng() * 6) * 5;
    box(x - 13, x + 13, z - 13, z + 13, G + ht, ht, 'tower', [0x8fb3d9, 0x9fc8c0, 0xc0b4d8, 0xa9b8c8][Math.floor(rng() * 4)]);
    const side = sz > 0 ? 's' : 'n', front = sz > 0 ? cz + I : cz - I;
    decor({ type: 'door', x, y: G, z: z + sz * 13.02, rot: sz > 0 ? 0 : Math.PI, wide: true });
    address(L, x, front + (sz > 0 ? 1.6 : -1.6), G, side, cx, cz, 'office');
  }
}
function park({ box, floor, post, decor, rng, cx, cz, I }) {
  floor(cx - I, cx + I, cz - I, cz + I, G, 'grass', 0x7fd06a);
  box(cx - 14, cx + 14, cz - 9, cz + 9, G + 0.03, 0.2, 'water', 0x5fb8e8, { floor: true, slow: 0.4 }); // a pond: drivable, but it holds you back
  for (let k = 0; k < 16; k++) {
    const a = rng() * Math.PI * 2, r = 18 + rng() * 18, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    post(x, z, 0.4, 0, 6, 'trunk'); decor({ type: 'tree', x, y: G, z, h: 5 + rng() * 3, r: 2.2 + rng() * 1.2 });
  }
  post(cx, cz, 1.6, 0, 2.5, 'fountain'); decor({ type: 'fountain', x: cx, y: G + 0.03, z: cz });
}
function stunt({ ramp, floor, sign, cx, cz, I }) {
  floor(cx - I, cx + I, cz - I, cz + I, G, 'lot', 0x55565c);
  // a kicker, a 7 m gap and a landing ramp across the middle: flat out, a car clears it (js/drive.js carries a
  // ramp's climb into the air); too slow and you drop into the gap and drive out the side
  ramp(cx - 34, cx - 10, cz - 6, cz + 6, 'x', G, G + 4, 'stunt', 0xf2c14e);
  ramp(cx - 3, cx + 23, cz - 6, cz + 6, 'x', G + 3.4, G, 'stunt', 0xf2c14e);
  sign('STUNT LOT', cx - 20, 4.6, cz - 6.2, 0, 7, 1.2, '#f2c14e', '#2b2b30');
}

// (a plat with an explicit bottom, for the sloped balustrades)
function P2(L, o) { L.plats.push(o); return o; }
