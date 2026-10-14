// The order: a randomized shopping list (one item from each of several departments), a customer and a
// drop-off address across town, and how the shelves are stocked this match. All from one seed, so every dasher
// — human, CPU or (later) remote — shops the same store for the same list.
import { mulberry32, shuffle } from './utils.js';
import { MATCH } from './tuning.js';
import { DEPTS } from './level.js';

export const PRODUCTS = {
  paper: [
    { id: 'tp12', name: 'Toilet Paper 12-Pack', color: 0x6fb7ff },
    { id: 'tp24', name: 'Mega Roll TP 24-Pack', color: 0xffd23f },
    { id: 'tpQuilt', name: 'Quilted TP 6-Pack', color: 0xff8fb1 },
  ],
  produce: [
    { id: 'bananas', name: 'Bananas', color: 0xffd84a },
    { id: 'apples', name: 'Red Apples', color: 0xe23b3b },
    { id: 'broccoli', name: 'Broccoli', color: 0x3f9a45 },
    { id: 'carrots', name: 'Carrots', color: 0xff8a2a },
    { id: 'watermelon', name: 'Watermelon', color: 0x2f8a3f },
    { id: 'pineapple', name: 'Pineapple', color: 0xe8b33a },
  ],
  toys: [
    { id: 'teddy', name: 'Teddy Bear', color: 0xb07a4a },
    { id: 'duck', name: 'Rubber Duck', color: 0xffd23f },
    { id: 'robot', name: 'Toy Robot', color: 0x9aa7b8 },
    { id: 'ball', name: 'Beach Ball', color: 0xff5a5a },
    { id: 'dino', name: 'Plush Dino', color: 0x5fd06a },
  ],
  home: [
    { id: 'rugShag', name: 'Shag Rug', color: 0xf2a65a },
    { id: 'rugRunner', name: 'Hallway Runner', color: 0x4a7fd8 },
    { id: 'rugPersian', name: 'Persian Carpet', color: 0xb03a48 },
  ],
  garden: [
    { id: 'fern', name: 'Boston Fern', color: 0x3fae5a },
    { id: 'cactus', name: 'Cactus', color: 0x5f9a4a },
    { id: 'sunflower', name: 'Sunflower', color: 0xffcc33 },
    { id: 'palm', name: 'Potted Palm', color: 0x4caf6a },
    { id: 'bonsai', name: 'Bonsai Tree', color: 0x6b8f3a },
  ],
  hardware: [
    { id: 'plunger', name: 'Red Plunger', color: 0xe23b3b },
    { id: 'plungerXL', name: 'Heavy-Duty Plunger', color: 0x2b2b30 },
    { id: 'plungerGold', name: 'Golden Plunger', color: 0xf2c14e },
  ],
};
export const PRODUCT = Object.fromEntries(Object.entries(PRODUCTS).flatMap(([dept, list]) => list.map((p) => [p.id, { ...p, dept }])));
const CUSTOMERS = ['Pat', 'Morgan', 'Jules', 'Riley', 'Casey', 'Sam', 'Alex', 'Jamie', 'Robin', 'Quinn', 'Avery', 'Drew'];

// The store's layout this match: which department fills which zone. Tables (the front hall's bins, the outdoor
// yard's benches) take produce and plants; the four aisle blocks (two per floor) take the rest.
export function makeLayout(L, rng) {
  const zones = Object.values(L.deptZones), layout = {};
  for (const kind of ['table', 'shelf']) {
    const zs = shuffle(zones.filter((z) => (kind === 'table' ? z.kind === 'table' : z.kind !== 'table')).map((z) => z.id), rng);
    const ds = shuffle(Object.keys(DEPTS).filter((d) => DEPTS[d].fits === kind), rng);
    zs.forEach((z, i) => { layout[z] = ds[i]; });
  }
  return layout; // zone id → department
}

// Stock the shelves: every product of a department sits in a couple of places in its zone (so there's a route to
// plan); produce on the hall's bins is one fruit or veg per bin. Slots left over carry filler stock.
export function makeStock(L, layout, rng) {
  const stock = new Array(L.slots.length).fill(null);
  for (const [zid, dept] of Object.entries(layout)) {
    const Z = L.deptZones[zid], kinds = PRODUCTS[dept].map((p) => p.id), idx = Z.slots.slice();
    if (dept === 'produce' && zid === 'HALL') {
      const bins = shuffle([...new Set(idx.map((i) => L.slots[i].bin))], rng);
      bins.forEach((b, k) => idx.filter((i) => L.slots[i].bin === b).forEach((i) => (stock[i] = kinds[k % kinds.length])));
      continue;
    }
    shuffle(idx, rng);
    const per = Math.max(1, Math.min(3, Math.floor(idx.length / kinds.length)));
    let k = 0;
    for (const id of kinds) for (let c = 0; c < per && k < idx.length; c++) stock[idx[k++]] = id;
  }
  return stock;
}

// The order board: several orders from different customers, each a short list across departments and an
// address across town. Dashers stack up to MATCH.STACK of them; whoever delivers an order first takes it from
// everyone else holding it (poached).
export function makeBoard(L, rng, n) {
  const far = shuffle(L.addresses.filter((a) => Math.hypot(a.x, a.z) >= MATCH.MIN_DROP_DIST), rng);
  const names = shuffle(CUSTOMERS.slice(), rng);
  const orders = [];
  for (let i = 0; i < n; i++) {
    const [lo, hi] = MATCH.ITEMS, k = lo + Math.floor(rng() * (hi - lo + 1));
    const depts = shuffle(Object.keys(PRODUCTS), rng).slice(0, k);
    const items = depts.map((d) => { const list = PRODUCTS[d]; return { ...list[Math.floor(rng() * list.length)], dept: d }; });
    const drop = far[i % far.length];
    const dist = Math.abs(drop.x) + Math.abs(drop.z);
    const tip = Math.round(3 + items.length * 2.5 + dist / 45 + rng() * 4);
    orders.push({ i, tag: String.fromCharCode(65 + i), customer: names[i % names.length], items, drop, tip, dist, status: 'open', by: null, doneT: null });
  }
  return orders;
}

export function makeOrders(L, seed, n) {
  const rng = mulberry32(seed);
  const layout = makeLayout(L, rng), stock = makeStock(L, layout, rng), board = makeBoard(L, rng, n);
  const deptZone = Object.fromEntries(Object.entries(layout).map(([z, d]) => [d, z]));
  return { seed, layout, deptZone, stock, board, code: seed.toString(36).toUpperCase().padStart(5, '0').slice(-5) };
}
