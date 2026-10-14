// Headless smoke test (Dr. Mow's tools/smoke.mjs, adapted): loads the game, plays a real match with the CPU
// brain driving player 1 (GAME.autoplay) through shopping, the car and the dash, screenshots each stage, and
// reports console errors and page scroll (both must be zero). Also drives player 1 with real keys for a bit.
// Usage: python3 -m http.server 4180 &  BASE=http://localhost:4180/ node tools/smoke.mjs
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
const pw = await import('playwright').catch(() => import(join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs')));
const { chromium } = pw;
const OUT = process.env.OUT || 'shots';
mkdirSync(OUT, { recursive: true });
const base = process.env.BASE || 'http://localhost:4180/';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
let failures = 0;

async function run(name, ctxOpts, act) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base);
  await page.waitForFunction(() => window.GAME && !document.querySelector('#loading'), null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${name}-title.png` });
  await act(page);
  const st = await page.evaluate(() => ({ mode: GAME.state.mode, scroll: [document.scrollingElement.scrollHeight, innerHeight, document.scrollingElement.scrollWidth, innerWidth] }));
  const scrolls = st.scroll[0] > st.scroll[1] || st.scroll[2] > st.scroll[3];
  if (errors.length || scrolls) failures++;
  console.log(name, 'errors:', errors.length ? errors : 'none', scrolls ? 'PAGE SCROLLS' : 'no scroll', st.mode);
  await ctx.close();
}

const stage = (page) => page.evaluate(() => { const M = GAME.state.M, d = M.dashers[0], B = d.mode === 'car' ? d.car : d.cart; return { phase: M.phase, mode: d.mode, bag: Object.values(d.bag).reduce((a, b) => a + b, 0), earned: d.earned, orders: d.orders.length, x: +B.x.toFixed(1), y: +B.y.toFixed(1), z: +B.z.toFixed(1), t: +M.t.toFixed(1), why: M.why }; });
// put player 1's cart somewhere (for the see-through shots) and let the camera settle
const place = async (page, x, y, z, heading = Math.PI) => { await page.evaluate(([x, y, z, h]) => { const d = GAME.state.M.dashers[0]; Object.assign(d.cart, { x, y, z, heading: h, vh: h, speed: 0, kx: 0, kz: 0, grounded: true }); GAME.ff(0.05); }, [x, y, z, heading]); await page.waitForTimeout(700); };

await run('desktop', { viewport: { width: 1280, height: 800 } }, async (page) => {
  await page.click('[data-go]');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/desktop-board.png` });
  await page.click('[data-ready]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/desktop-countdown.png` });
  await page.evaluate(() => GAME.ff(3.2));
  await page.waitForTimeout(500);
  // real keys: run in through the doors, hop, rush, punch
  await page.keyboard.down('KeyW'); await page.waitForTimeout(900); await page.keyboard.press('Space'); await page.keyboard.press('ShiftLeft'); await page.keyboard.press('KeyF'); await page.waitForTimeout(300); await page.keyboard.up('KeyW');
  await page.screenshot({ path: `${OUT}/desktop-keys.png` });
  console.log(' after keys', await stage(page));
  // see-through: under the upper floor, behind the store in the yard, under the garage deck, on the upper floor
  await place(page, -18.5 + 2.5, 0.15, -27, Math.PI); await page.screenshot({ path: `${OUT}/see-under-mezz.png` });
  await place(page, -34, 0.15, -22, Math.PI); await page.screenshot({ path: `${OUT}/see-yard.png` });
  await place(page, 29, 0.15, -18, Math.PI); await page.screenshot({ path: `${OUT}/see-garage.png` });
  await place(page, 4, 5.15, -27, Math.PI); await page.screenshot({ path: `${OUT}/see-upper.png` });
  await page.keyboard.press('KeyO'); await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/desktop-board-mid.png` }); await page.keyboard.press('KeyO');
  await page.evaluate(() => { GAME.autoplay = true; });
  let s = await stage(page), shots = 0;
  for (let i = 0; i < 500 && s.phase !== 'over'; i++) {
    await page.evaluate(() => GAME.ff(0.5));
    const n = await stage(page);
    if ((n.bag !== s.bag && shots < 6) || n.mode !== s.mode || n.earned !== s.earned) {
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/desktop-${String(++shots).padStart(2, '0')}-${n.mode}-${n.bag}.png` });
      console.log(' ', JSON.stringify(n));
    }
    if (n.mode === 'car' && i % 15 === 0) { await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/desktop-drive-${i}.png` }); }
    s = n;
  }
  console.log(' end', JSON.stringify(s));
  await page.waitForTimeout(2400);
  await page.screenshot({ path: `${OUT}/desktop-results.png` });
});

await run('phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, async (page) => {
  await page.tap('[data-go]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/phone-board.png` });
  await page.tap('[data-ready]');
  await page.evaluate(() => GAME.ff(3.2));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/phone-play.png` });
  await page.evaluate(() => { GAME.autoplay = true; GAME.ff(30); });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/phone-later.png` });
});

await run('split', { viewport: { width: 1280, height: 720 } }, async (page) => {
  await page.click('.seg[data-opt=humans] button[data-v="2"]');
  await page.click('[data-go]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/split-board.png` });
  for (const b of await page.$$('[data-ready]')) await b.click();
  await page.evaluate(() => GAME.ff(3.2));
  await page.keyboard.down('KeyW'); await page.keyboard.down('ArrowUp'); await page.waitForTimeout(900); await page.keyboard.up('KeyW'); await page.keyboard.up('ArrowUp');
  await page.screenshot({ path: `${OUT}/split-play.png` });
});

await browser.close();
console.log(failures ? `${failures} FAILED` : 'smoke ok');
process.exit(failures ? 1 : 0);
