// Store Smash — the shell: loading, the title (with a live CPU match behind it), the order board and countdown,
// play (one player, or two in split screen, against CPU dashers), pause, results. Sim / render / UI stay split
// as in Dr. Mow: js/match.js + js/drive.js are the rules, js/scene.js draws, this file wires input and the HUD.
//
// Console hooks (for playtests and tools/smoke.mjs): GAME.start({ humans, cpus, seed }), GAME.ff(seconds),
// GAME.autoplay = true (a CPU brain drives player 1), GAME.state.
import { buildLevel, DEPTS, EDGE } from './level.js';
import { createWorld } from './world.js';
import { buildNav, findPath } from './nav.js';
import { HANDLING, DT, MATCH, COMBAT, SLOWMO } from './tuning.js';
import { createMatch, matchStep, bodyOf, standings, needs, held, readyOrders, toggle, openOrders } from './match.js';
import { createBrain, think, objective, pickOrders } from './ai.js';
import { View } from './scene.js';
import { Input } from './input.js';
import { Sfx, SFX } from './sfx-synth.js';
import { PRODUCT } from './order.js';
import { drawPortrait } from './faces.js';

const $ = (s) => document.querySelector(s);
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const SETTINGS_KEY = 'storesmash.settings';
const DEFAULTS = { humans: 1, cpus: 3, chase: false, muted: false };
const settings = (() => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch (_) { return { ...DEFAULTS }; } })();
const save = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) { /* private mode */ } };

await Promise.all([document.fonts.load('40px "Lilita One"'), document.fonts.load('40px "Luckiest Guy"')]).catch(() => {});
await new Promise((r) => setTimeout(r, 30)); // (let the loading card paint before the heavy build)
const L = buildLevel(), W = createWorld(L);
const nav = { cart: buildNav(W, L, HANDLING.cart), car: buildNav(W, L, HANDLING.car) };
const canvas = $('#game');
const view = new View(canvas, L, W);
view.chase = settings.chase;
const input = new Input(canvas);
const sfx = new Sfx({ volume: 0.7 });
sfx.setMuted(settings.muted);
const unlock = () => sfx.unlock();
addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
const play = (name, o) => { const f = SFX[name]; if (f && sfx.ctx) f(sfx, o); };
for (const [id, a] of [['#btn-hop', 'hop'], ['#btn-rush', 'rush'], ['#btn-punch', 'punch'], ['#btn-slow', 'slow']]) input.bindButton($(id), a);
input.slowBtn = $('#btn-slow');

const state = { scale: 1, autoSlowT: 0, autoGap: 0, slowing: [false, false], mode: 'title', M: null, brains: [], locals: [], acc: 0, guideT: 0, guides: [], overT: 0, autoplay: false, panes: [], hud: [], attractK: 0, boardOpen: false, hostile: [] };
window.GAME = { state, L, nav, view, start: (o) => startMatch(o), ff, get autoplay() { return state.autoplay; }, set autoplay(v) { state.autoplay = v; } };

// ---------------------------------------------------------------- matches
function newMatch({ humans, cpus, seed }) {
  const M = createMatch(L, W, { humans, cpus, seed });
  state.M = M;
  state.brains = M.dashers.map((d, i) => createBrain(M, d, d.cpu ? 0.78 + 0.04 * ((i * 37) % 5) : 0.95, M.seed));
  M.dashers.forEach((d, i) => { if (d.cpu) pickOrders(M, d, state.brains[i]); });
  state.locals = M.dashers.filter((d) => d.human).map((d) => d.i);
  state.acc = 0; state.overT = 0; state.guides = []; state.hostile = state.locals.map(() => ({ t: 0, who: null }));
  view.setMatch(M, state.locals);
  view.resetCams();
  return M;
}
function startAttract() {
  state.mode = 'title'; state.boardOpen = false;
  input.enabled = false;
  newMatch({ humans: 0, cpus: 6 });
  state.attractK = Math.floor(Math.random() * 6);
  state.M.readyT = 0.2;
  buildPanes([]);
  $('#topbar').classList.add('hidden');
  showTitle();
}
function startMatch(o = {}) {
  const humans = o.humans ?? settings.humans, cpus = Math.min(o.cpus ?? settings.cpus, 6 - humans);
  const M = newMatch({ humans, cpus, seed: o.seed });
  for (const i of state.locals) { const best = openOrders(M).slice().sort((a, b) => b.tip - a.tip)[0]; if (best) toggle(M, M.dashers[i], best.i); } // (one picked for you to start)
  state.mode = 'play';
  input.players = humans; input.enabled = true; input.reset();
  buildPanes(state.locals);
  $('#topbar').classList.remove('hidden');
  if (state.autoplay || o.skipBoard) { for (const d of M.dashers) d.ready = true; }
  else showBoard(true);
}

function ff(sec) { for (let t = 0; t < sec; t += DT) simStep(false); view.resetCams(); }

// One fixed sim step, everyone's controls included.
let frameInput = [];
function simStep(first) {
  const M = state.M;
  const ctls = M.dashers.map((d, i) => {
    if (d.cpu || (state.autoplay && d.human)) {
      if (d.human && state.autoplay) { d.ready = true; if (!held(M, d).length && d.mode === 'cart' && M.phase === 'play') pickOrders(M, d, state.brains[i]); }
      return think(M, d, state.brains[i], nav, DT);
    }
    const k = state.locals.indexOf(i), inp = frameInput[k];
    if (k === 0 && window.GAME.force) { const f = window.GAME.force; if (f.jump) window.GAME.force = { ...f, jump: false }; return f; } // (test hook: tools/smoke.mjs drives P1 exactly)
    return inp ? toCtl(k, inp, first) : { dir: null };
  });
  matchStep(M, ctls);
  for (const e of M.events) handleEvent(e);
  M.events.length = 0;
}

// Input → the controller's format. Isometric: the stick / keys / d-pad point the way on screen. Chase: the
// stick is camera-relative (so it steers), keys steer like a car.
function toCtl(k, inp, first) {
  const act = { jump: first && inp.jump, rush: first && inp.rush, punch: first && inp.punch };
  if (view.chase && inp.keys && !inp.touch) return { turn: inp.keys.x, throttle: -inp.keys.y || (inp.keys.x ? 1 : 0), ...act };
  if (!inp.dir) return { dir: null, ...act };
  const w = view.screenToWorld(k, inp.dir.x, inp.dir.y);
  return { dir: { x: w.x, z: w.z, mag: inp.dir.mag }, ...act };
}

// ---------------------------------------------------------------- events → sound, toasts, the view
function handleEvent(e) {
  view.onEvent(e);
  if (state.mode !== 'play' && state.mode !== 'pause') return;
  const M = state.M, mine = (d) => d && d.human;
  const local = (B) => state.locals.some((i) => bodyOf(M.dashers[i]) === B);
  const names = (list) => list.map((p) => p.name).join(', ');
  switch (e.type) {
    case 'countdown': if (state.boardOpen) hideBoard(); showCountdown(); break;
    case 'go': play('go'); toast('GO!', 'big'); hideScreen(); break;
    case 'accept': if (mine(e.d) && M.phase === 'play') { play('ui'); toast(`Took order ${e.order.tag} · ${e.order.customer}`, 'small', e.d); } break;
    case 'pick':
      if (mine(e.d)) {
        play('coin'); toast(`+ ${e.item.name}${e.n > 1 ? ` ×${e.n}` : ''}`, 'small', e.d);
        const r = readyOrders(M, e.d);
        if (r.length && !e.left) { play('power'); toast(`ORDER${r.length > 1 ? 'S' : ''} ${r.map((o) => o.tag).join(' + ')} READY! To your car`, 'small', e.d); }
      }
      break;
    case 'steal':
      if (mine(e.d)) { play('bonus'); toast(`STOLEN! + ${e.item.name} from ${e.from.name}`, 'small', e.d); }
      else if (mine(e.from)) { play('hurt'); toast(`${e.d.name} STOLE your ${e.item.name}!`, 'small', e.from); }
      break;
    case 'hit':
      if (mine(e.d)) { play(e.kind === 'car' ? 'crash' : 'hit'); toast(`SMASHED by ${e.by?.name ?? 'a car'}!${e.lost.length ? ` Dropped ${names(e.lost)}` : ''}`, 'small', e.d); }
      else if (mine(e.by)) { play('whack'); toast(`SMASH! ${e.d.name}${e.lost.length ? ` dropped ${names(e.lost)}` : ' is seeing stars'}`, 'small', e.by); }
      break;
    case 'swing': if (mine(e.d)) play('swish'); break;
    case 'trick':
      if (mine(e.d)) {
        toast(e.name, 'trick', e.d);
        if (e.sick && state.autoGap <= 0) { state.autoSlowT = SLOWMO.AUTO_TIME; state.autoGap = SLOWMO.AUTO_GAP; play('slowIn'); }
      }
      break;
    case 'grindStart': if (local(e.B)) play('clank'); break;
    case 'launch': if (local(e.B)) play('boing'); break;
    case 'rush': if (mine(e.d)) play('boost'); break;
    case 'enter': if (mine(e.d)) { play('boost'); toast(`IN THE CAR! Deliver ${e.orders.map((o) => o.tag).join(', ')}`, 'small', e.d); } else toast(`${e.d.name} is in the car`, 'small'); break;
    case 'dropOrder': if (mine(e.d)) toast(`Order ${e.order.tag} dropped (incomplete)`, 'small', e.d); break;
    case 'deliver':
      if (mine(e.d)) { play('deliver'); toast(`DELIVERED ${e.order.tag}! +$${e.order.tip}`, '', e.d); }
      else toast(`${e.d.name} delivered order ${e.order.tag}`, 'small');
      break;
    case 'poached': if (mine(e.d)) { play('fail'); toast(`POACHED! ${e.by.name} delivered ${e.order.tag}`, '', e.d); } break;
    case 'exit': if (mine(e.d)) { play('ui'); toast(openOrders(M).length ? 'Back on foot — take more orders (O)' : 'Back on foot', 'small', e.d); } break;
    case 'jump': if (local(e.B)) play('jump'); break;
    case 'land': if (local(e.B) && e.v > 4) play('land'); break;
    case 'crash': if (local(e.B)) play(e.v > 10 ? 'crash' : 'bonk'); break;
    case 'bump': if (local(e.A) || local(e.B)) play(e.v > 8 ? 'crash' : 'bonk'); break;
    case 'bonk': if (local(e.B)) play('bonk'); break;
    default: break;
  }
}

// ---------------------------------------------------------------- the frame
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const M = state.M;
  if (M && (state.mode === 'play' || state.mode === 'title')) {
    frameInput = state.mode === 'play' ? input.read() : [];
    state.acc += dt * slowMo(dt);
    let first = true, n = 0;
    while (state.acc >= DT && n < 14) { simStep(first); first = false; state.acc -= DT; n++; }
    if (n >= 14) state.acc = 0;
    if (state.mode === 'play') {
      if (M.phase === 'board') updateBoardTimer();
      if (M.phase === 'ready') updateCountdown();
      if (M.phase === 'over' && (state.overT += dt) > 1.8) showResults();
    } else if (M.phase === 'over' && (state.overT += dt) > 3) startAttract();
  }
  if (M) updateGuides(dt);
  const layout = state.mode === 'title' || !state.locals.length
    ? [{ k: 0, x: 0, y: 0, w: 1, h: 1, body: M ? bodyOf(M.dashers[state.attractK % M.dashers.length]) : null }]
    : state.panes.map((p) => ({ ...p, body: bodyOf(M.dashers[state.locals[p.k]]) }));
  view.frame(dt, layout);
  if (state.mode === 'play' || state.mode === 'pause') updateHud(dt);
  updateSound();
}

// ---------------------------------------------------------------- slow-mo (Dr. Mow's, on a style meter)
// Hold SLO-MO to spend your meter (tricks, steals and smashes fill it); sick moments drop into a short burst of
// bullet time on their own. The whole world slows (CPUs too), so it's fair; the music and sound go muffled.
function slowMo(dt) {
  const M = state.M;
  let manual = false;
  if (state.mode === 'play' && M.phase === 'play') state.locals.forEach((li, k) => {
    const d = M.dashers[li], want = !!frameInput[k]?.slow;
    if (want && d.style > (state.slowing[k] ? 0 : SLOWMO.MIN)) { if (!state.slowing[k]) play('slowIn'); state.slowing[k] = true; d.style = Math.max(0, d.style - SLOWMO.DRAIN * dt); manual = true; }
    else { if (state.slowing[k]) play('slowOut'); state.slowing[k] = false; }
  });
  state.autoSlowT -= dt; state.autoGap -= dt;
  const target = manual ? SLOWMO.SCALE : state.autoSlowT > 0 && state.mode === 'play' ? SLOWMO.AUTO : 1;
  state.scale += (target - state.scale) * (1 - Math.exp(-12 * dt));
  if (Math.abs(state.scale - target) < 0.01) state.scale = target;
  document.body.classList.toggle('slowmo', state.scale < 0.85);
  if (sfx.ctx) sfx.setRate(state.scale < 0.99 ? state.scale : 1);
  return state.scale;
}

// ---------------------------------------------------------------- guides (per local player)
// In the store your list only names departments; a glint shows over anything you need once you're close.
// In the car: beams over your drop-offs, and the GPS route to the nearest one.
function updateGuides(dt) {
  const M = state.M;
  if ((state.guideT -= dt) > 0) return;
  state.guideT = 0.25;
  state.locals.forEach((li, k) => {
    const d = M.dashers[li], B = bodyOf(d);
    if (d.mode === 'car') {
      const ready = readyOrders(M, d), obj = M.phase === 'play' ? objective(M, d, nav) : null;
      const path = obj ? findPath(nav.car, B, obj) : null;
      state.guides[k] = { obj, path };
      view.setGuides(k, { beams: (ready.length ? ready.map((o) => o.drop) : [d.spot]), path, body: B });
    } else {
      const need = needs(M, d), glints = [];
      L.slots.forEach((s, i) => { const id = M.O.stock[i]; if (id && need[id] && Math.abs(s.at.y - B.y) < 1.5 && Math.hypot(s.x - B.x, s.z - B.z) < 7) glints.push({ x: s.x, y: s.y, z: s.z }); });
      for (const l of M.loose) if (need[l.id]) glints.push(l);
      if (!Object.keys(need).length && readyOrders(M, d).length) glints.push({ x: d.car.x, y: d.car.y + 1.4, z: d.car.z });
      state.guides[k] = { obj: null, path: null };
      view.setGuides(k, { glints });
    }
  });
}

// ---------------------------------------------------------------- HUD
function buildPanes(locals) {
  const root = $('#panes');
  root.innerHTML = '';
  state.hud = [];
  const n = locals.length, wide = innerWidth >= innerHeight;
  state.panes = locals.map((li, k) => n === 1 ? { k, x: 0, y: 0, w: 1, h: 1 } : wide ? { k, x: k * 0.5, y: 0, w: 0.5, h: 1 } : { k, x: 0, y: k * 0.5, w: 1, h: 0.5 });
  input.paneAt = (x, y) => (n < 2 ? 0 : wide ? (x < innerWidth / 2 ? 0 : 1) : (y < innerHeight / 2 ? 0 : 1));
  for (const p of state.panes) {
    const d = state.M.dashers[locals[p.k]];
    const el = document.createElement('div');
    el.className = 'pane' + (p.k && n > 1 ? (wide ? ' split-v' : ' split-h') : '');
    Object.assign(el.style, { left: p.x * 100 + '%', top: p.y * 100 + '%', width: p.w * 100 + '%', height: p.h * 100 + '%' });
    el.innerHTML = `${n > 1 ? `<div class="tag" style="background:${hex(d.color)}">${d.name}</div>` : ''}<canvas class="portrait" width="128" height="128"></canvas><div class="list"><div class="lb"></div><div class="style">SLO-MO <i><b></b></i><span>${n > 1 ? (p.k ? "'" : 'R') : 'X'}</span></div></div>
      <div class="hostile hidden"><div class="stripes"></div><b>⚠ HOSTILE DASHER APPROACHING ⚠</b><span></span></div>
      <div class="objective"></div><div class="speed"></div><canvas class="minimap hidden" width="300" height="300"></canvas>`;
    if (n > 1 && p.k === 0) el.querySelector('.list').style.top = '44px';
    root.appendChild(el);
    state.hud.push({ el, portrait: el.querySelector('.portrait'), faceSig: '', list: el.querySelector('.lb'), meter: el.querySelector('.style b'), obj: el.querySelector('.objective'), speed: el.querySelector('.speed'), map: el.querySelector('.minimap'), hostile: el.querySelector('.hostile'), sig: '' });
  }
  const touch = locals.length === 1 && matchMedia('(pointer: coarse)').matches;
  document.body.classList.toggle('touch', touch);
  for (const id of ['#btn-hop', '#btn-rush', '#btn-punch', '#btn-slow']) $(id).classList.toggle('hidden', !touch);
  $('#btn-cam').classList.toggle('hidden', !locals.length);
  $('#btn-board').classList.toggle('hidden', !locals.length);
}

function updateHud(dt) {
  const M = state.M;
  $('#clock').textContent = M.phase === 'play' ? fmt(Math.max(0, MATCH.LIMIT - M.t)) : fmt(MATCH.LIMIT);
  const open = openOrders(M).length;
  $('#btn-board').textContent = `📋 ${open}`;
  // rivals strip: everyone, in order
  const st = standings(M);
  const rivals = st.map((d, r) => {
    const B = bodyOf(d), status = d.stunT > 0 ? '😵' : d.mode === 'car' ? (readyOrders(M, d).length ? '🚗' : '🅿') : `🛒${Object.values(d.bag).reduce((a, b) => a + b, 0)}`;
    void B;
    return `<div class="rival${r === 0 && d.earned > 0 ? ' lead' : ''}"><i style="background:${hex(d.color)}"></i><span class="nm">${d.name} </span><b>$${d.earned}</b> <em>${status}</em></div>`;
  }).join('');
  if ($('#rivals').innerHTML !== rivals) $('#rivals').innerHTML = rivals;
  state.hud.forEach((h, k) => {
    const d = M.dashers[state.locals[k]], B = bodyOf(d), g = state.guides[k];
    // the list: your orders, each with its items and their departments
    const need = needs(M, d), ready = readyOrders(M, d);
    const sig = JSON.stringify([d.bag, d.orders, d.mode, ready.map((o) => o.i), M.board.map((o) => o.status)]);
    if (sig !== h.sig) {
      h.sig = sig;
      const left = { ...d.bag };
      const blocks = held(M, d).map((o) => {
        const isReady = ready.includes(o);
        const rows = o.items.map((it) => {
          const got = (left[it.id] || 0) > 0;
          if (got) left[it.id]--;
          return `<div class="row${got ? ' got' : ''}"><span class="dot" style="background:${hex(it.color)}"></span><span class="nm">${it.name}<span class="dp">${DEPTS[it.dept].name}</span></span><span class="ck">${got ? '✓' : ''}</span></div>`;
        }).join('');
        return `<div class="ord${isReady ? ' ready' : ''}"><div class="oh"><b>${o.tag}</b> ${o.customer} · ${o.drop.name}<span>$${o.tip}</span></div>${d.mode === 'cart' || isReady ? rows : ''}</div>`;
      }).join('');
      const empty = !held(M, d).length ? `<div class="ord empty">${d.mode === 'car' ? 'Nothing to deliver — park at your spot to shop again.' : open ? `No orders. Open the board (O / 📋) — ${open} open.` : 'The board is empty.'}</div>` : '';
      h.list.innerHTML = `<div class="who"><i style="background:${hex(d.color)}"></i>$${d.earned} earned · ${d.delivered} delivered${d.mode === 'cart' ? ` · <span class="kbd">${held(M, d).length}/${MATCH.STACK} orders</span>` : ''}</div>${blocks}${empty}`;
    }
    let obj = '';
    if (M.phase === 'board' || M.phase === 'ready') obj = 'Pick your orders…';
    else if (d.stunT > 0) obj = '<b>😵 Dazed!</b>';
    else if (d.mode === 'car') {
      const r = ready.slice().sort((a, b) => Math.hypot(a.drop.x - B.x, a.drop.z - B.z) - Math.hypot(b.drop.x - B.x, b.drop.z - B.z))[0];
      const dist = g?.path ? Math.round(pathLen(B, g.path)) : null;
      obj = r ? `Deliver <b>${r.tag}</b> to <b>${r.drop.name}</b>${dist != null ? ` · ${dist} m` : ''}` : `Park at your spot · <b>${d.spot.area}</b>`;
    } else if (ready.length && !Object.keys(need).length) obj = `All set! Get to your car · <b>${d.spot.area}</b>`;
    else if (Object.keys(need).length) {
      const id = Object.keys(need)[0], p = PRODUCT[id];
      obj = `Find <b>${p.name}</b> · ${DEPTS[p.dept].name}${ready.length ? ` · or go: <b>${ready.map((o) => o.tag).join('+')}</b> ready` : ''}`;
    } else obj = open ? 'Take an order: <b>O</b> / 📋' : 'Board empty';
    if (h.obj.innerHTML !== obj) h.obj.innerHTML = obj;
    h.speed.textContent = d.mode === 'car' ? `${Math.round(Math.abs(B.speed) * 3.6)} km/h` : '';
    h.meter.style.width = `${Math.min(100, (d.style / 1) * 100)}%`;
    const face = view.faceNow(d);
    if (face !== h.faceSig) { h.faceSig = face; drawPortrait(h.portrait.getContext('2d'), 128, face, hex(d.color)); }
    h.meter.classList.toggle('over', d.style > 1);
    // minimap: only on the road
    h.map.classList.toggle('hidden', d.mode !== 'car');
    if (d.mode === 'car') drawMinimap(h.map, M, d, g);
    // HOSTILE DASHER APPROACHING: on foot, a rival close by who's coming for you — hunting you, charging at
    // you, or a car bearing down on you in the lot
    const H = state.hostile[k];
    let who = null;
    if (d.mode === 'cart' && M.phase === 'play' && M.t > 4) for (const r of M.dashers) {
      if (r === d) continue;
      const R = bodyOf(r), dx = B.x - R.x, dz = B.z - R.z, dist = Math.hypot(dx, dz) || 1;
      if (Math.abs(R.y - B.y) > 1.6) continue;
      const toward = Math.cos(Math.atan2(dx, dz) - R.heading); // 1: pointed straight at you
      const closing = (Math.sin(R.vh) * R.speed * dx + Math.cos(R.vh) * R.speed * dz) / dist;
      if ((r.hunting === d.i && dist < COMBAT.HOSTILE_R) || (r.rushT > 0 && toward > 0.85 && dist < COMBAT.HOSTILE_R) || (r.mode === 'car' && closing > 9 && toward > 0.9 && dist < 22)) { who = r; break; }
    }
    if (who) { if (H.t <= -1) play('warn'); H.t = Math.max(H.t, 1.4); H.who = who; view.mood(d, 'onfire', 0.3); }
    H.t = d.mode === 'car' ? -2 : H.t - dt;
    const on = H.t > 0;
    h.hostile.classList.toggle('hidden', !on);
    if (on) h.hostile.querySelector('span').textContent = `${H.who.name}${H.who.mode === 'car' ? ' (in a car!)' : ''}`;
  });
  // touch sticks
  input.sticks.forEach((s, i) => {
    const el = document.querySelector(`.stick.s${i}`);
    el.classList.toggle('on', !!s);
    if (s) { el.style.left = s.bx + 'px'; el.style.top = s.by + 'px'; el.firstElementChild.style.transform = `translate(${s.x - s.bx}px, ${s.y - s.by}px)`; }
  });
  if (state.boardOpen) refreshBoard();
}
const pathLen = (B, P) => { let d = 0, c = B; for (const p of P) { d += Math.hypot(p.x - c.x, p.z - c.z); c = p; } return d; };

// ---------------------------------------------------------------- minimap (north up, round; in the car)
let mapImg = null;
const MAP_S = 2; // px per metre in the baked map
function bakeMap() {
  const N = Math.ceil((EDGE + 16) * 2 * MAP_S), c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d'), o = N / 2;
  g.fillStyle = '#5c5d64'; g.fillRect(0, 0, N, N);
  const col = { sidewalk: '#cfc9bf', grass: '#86d46f', lot: '#6a6b72', storeFloor: '#f6e7c8', pavers: '#b9e3a0', plaza: '#d9d0c0', concrete: '#a9a9ae', deck: '#a9a9ae', water: '#5fb8e8', stunt: '#f2c14e' };
  const solid = { house: '#e2c6a8', apartment: '#e2c6a8', tower: '#8fa3bd', hedge: '#3e8f4a', roof: '#e8423b' };
  const sorted = L.plats.filter((p) => !p.hidden && p.tag !== 'mezz' && p.tag !== 'storeUpper').sort((a, b) => a.top - b.top);
  for (const p of sorted) {
    const c2 = p.floor ? col[p.mat] : solid[p.mat];
    if (!c2) continue;
    g.fillStyle = c2;
    g.fillRect(o + (p.x - p.w / 2) * MAP_S, o + (p.z - p.d / 2) * MAP_S, p.w * MAP_S, p.d * MAP_S);
  }
  g.fillStyle = '#fff'; g.font = `${14 * MAP_S}px "Lilita One"`; g.textAlign = 'center';
  g.fillText('STORE', o - 6 * MAP_S, o - 18 * MAP_S);
  mapImg = c;
}
function drawMinimap(cv, M, d, g) {
  if (!mapImg) bakeMap();
  const ctx = cv.getContext('2d'), S = cv.width, B = bodyOf(d);
  const R = 130, k = S / (2 * R); // metres shown from the centre to the rim
  ctx.save();
  ctx.clearRect(0, 0, S, S);
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); ctx.clip();
  const o = mapImg.width / 2;
  ctx.drawImage(mapImg, o + (B.x - R) * MAP_S, o + (B.z - R) * MAP_S, 2 * R * MAP_S, 2 * R * MAP_S, 0, 0, S, S);
  const P = (x, z) => [S / 2 + (x - B.x) * k, S / 2 + (z - B.z) * k];
  if (g?.path) { ctx.strokeStyle = hex(d.color); ctx.lineWidth = 6; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(...P(B.x, B.z)); for (const p of g.path) ctx.lineTo(...P(p.x, p.z)); ctx.stroke(); ctx.setLineDash([]); }
  const pin = (x, z, color, r = 9, label = '') => {
    let [px, py] = P(x, z); const dx = px - S / 2, dy = py - S / 2, dl = Math.hypot(dx, dy), lim = S / 2 - r - 3;
    if (dl > lim) { px = S / 2 + (dx / dl) * lim; py = S / 2 + (dy / dl) * lim; }
    ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (label) { ctx.fillStyle = '#fff'; ctx.font = `${r * 1.3}px "Lilita One"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, px, py + 1); }
  };
  const mine = readyOrders(M, d);
  for (const o of M.board) if (o.status === 'open') pin(o.drop.x, o.drop.z, mine.includes(o) ? '#3fe07a' : '#8a8e9c', mine.includes(o) ? 14 : 9, mine.includes(o) ? o.tag : '');
  if (!mine.length) pin(d.spot.x, d.spot.z, '#2f6fd6', 11, 'P');
  for (const o2 of M.dashers) if (o2 !== d) { const b = bodyOf(o2); pin(b.x, b.z, hex(o2.color), 7); }
  ctx.translate(S / 2, S / 2); ctx.rotate(-B.heading + Math.PI);
  ctx.fillStyle = hex(d.color); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, 10); ctx.lineTo(0, 5); ctx.lineTo(-10, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- sound
function updateSound() {
  if (!sfx.ctx) return;
  const M = state.M, d = state.mode === 'play' && state.locals.length ? M.dashers[state.locals[0]] : null;
  const B = d ? bodyOf(d) : null;
  sfx.setEngine(d && d.mode === 'car' && M.phase === 'play' ? 0.2 + 0.8 * Math.min(1, Math.abs(B.speed) / HANDLING.car.CRUISE) : 0);
  sfx.setRoll(d && d.mode === 'cart' && M.phase === 'play' ? Math.abs(B.speed) : 0, !!B?.grounded, { maxSpeed: 8, vol: 0.08 });
  sfx.setScrape?.(!!(d && B?.grind && M.phase === 'play'));
}

// ---------------------------------------------------------------- toasts + screens
function toast(text, cls = '', d = null) {
  if (d && state.locals.length > 1) text = `${d.name}: ${text}`;
  const el = document.createElement('div');
  el.className = 'toast ' + cls; el.textContent = text;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 1900);
  while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
}
function screen(html) { const s = $('#screen'); s.innerHTML = html; s.classList.remove('hidden'); return s; }
function hideScreen() { $('#screen').classList.add('hidden'); }

function showTitle() {
  const seg = (name, vals, cur, label = (v) => v) => `<div class="seg" data-opt="${name}">${vals.map((v) => `<button data-v="${v}" class="${v === cur ? 'on' : ''}">${label(v)}</button>`).join('')}</div>`;
  const s = screen(`<div class="card">
    <div class="logo">STORE<br>SMASH</div>
    <div class="tagline">Grab the list. Smash the aisles. Dash the order.</div>
    <button class="btn" data-go="1">PLAY</button>
    <div class="opt"><span>Players</span>${seg('humans', [1, 2], settings.humans, (v) => (v === 1 ? '1' : '2 · split'))}</div>
    <div class="opt"><span>CPU dashers</span>${seg('cpus', [0, 1, 2, 3, 4, 5], Math.min(settings.cpus, 6 - settings.humans))}</div>
    <div class="opt"><span>Camera</span>${seg('chase', ['iso', 'chase'], settings.chase ? 'chase' : 'iso', (v) => (v === 'iso' ? 'Isometric' : 'Chase'))}</div>
    <div class="how">
      <b>How to dash</b>
      <ul>
        <li>Take up to <b>3 orders</b> off the board. Each needs a few items from Produce, Paper Goods (toilet paper), Hardware (plungers), Toys, Home &amp; Carpet and the Garden Center.</li>
        <li>The store's <b>layout changes every shift</b>: your list names the department, the signs and the directory by the door tell you where it is. Two floors, ramps, and an outdoor yard.</li>
        <li>Roll past a shelf to grab what you need. <b>Rush</b> or <b>punch</b> rival dashers: a punch steals an item you need from their cart, otherwise their stuff spills on the floor.</li>
        <li><b>Grind</b> the railings, handrails and checkout ledges (hop onto them), and hit the <b>kickers</b> — hop at the lip of the one upstairs to fly off the upper floor. Tricks fill your <b>SLO-MO</b> meter; hold it for bullet time.</li>
        <li>Order complete? Find <b>your car</b> (outdoor lot, indoor garage, or the garage roof over the skybridge) and drive it to the drop-off. First to deliver gets the tip — everyone else is <b>poached</b>. Most money wins.</li>
      </ul>
      <b>Controls</b> — stick / WASD / arrows: go that way · Space: hop · Shift: rush · F: punch / steal · X (hold): slow-mo · O: order board · C: camera · Esc: pause.
      Two players: P1 WASD + Space / left Shift / F / R, P2 arrows + Enter / right Shift / "/" / '. Pads: A hop, B rush, X punch, LB slow-mo, Back board.
    </div>
  </div>`);
  s.querySelector('[data-go]').onclick = () => { sfx.unlock(); play('ui'); startMatch(); };
  s.querySelectorAll('.seg button').forEach((b) => b.onclick = () => {
    const opt = b.parentElement.dataset.opt, v = b.dataset.v;
    if (opt === 'humans') { settings.humans = +v; settings.cpus = Math.min(settings.cpus, 6 - settings.humans); }
    else if (opt === 'cpus') settings.cpus = +v;
    else { settings.chase = v === 'chase'; view.chase = settings.chase; }
    save(); play('ui'); showTitle();
  });
}

// The order board: at the start (blocking, with a timer) and mid-shift (an overlay; the game keeps going).
function showBoard(start = false) {
  state.boardOpen = true; state.boardStart = start;
  const s = screen(`<div class="card board"><h2>${start ? 'ORDER BOARD' : 'ORDERS'}</h2>
    <p>${start ? `Take up to ${MATCH.STACK} orders — the store's been rearranged, so check the directory by the door.` : `Up to ${MATCH.STACK} at a time. Whoever delivers first gets the tip.`}</p>
    <div class="orders"></div>
    ${start ? `<div class="timer"><i></i></div><div class="row2">${state.locals.map((i) => `<button class="btn green" data-ready="${i}">${state.locals.length > 1 ? state.M.dashers[i].name + ' ' : ''}READY</button>`).join('')}</div>` : '<button class="btn ghost" data-close>BACK TO THE AISLES</button>'}
  </div>`);
  s.querySelector('[data-close]')?.addEventListener('click', hideBoard);
  s.querySelectorAll('[data-ready]').forEach((b) => b.onclick = () => { const d = state.M.dashers[+b.dataset.ready]; d.ready = true; b.disabled = true; b.textContent = 'READY ✓'; play('ui'); });
  state.boardSig = '';
  refreshBoard();
}
function refreshBoard() {
  const M = state.M, el = $('#screen .orders');
  if (!el) return;
  const sig = JSON.stringify([M.board.map((o) => o.status), M.dashers.map((d) => d.orders), M.dashers.map((d) => d.mode)]);
  if (sig === state.boardSig) return;
  state.boardSig = sig;
  el.innerHTML = M.board.map((o) => {
    const takers = M.dashers.filter((d) => d.orders.includes(o.i));
    const items = o.items.map((it) => `<span class="chip"><i style="background:${hex(it.color)}"></i>${it.name}<em>${DEPTS[it.dept].name}</em></span>`).join('');
    const btns = state.locals.map((li) => {
      const d = M.dashers[li], has = d.orders.includes(o.i);
      return `<button class="take${has ? ' on' : ''}" data-o="${o.i}" data-d="${li}" ${o.status !== 'open' || d.mode !== 'cart' || (!has && d.orders.length >= MATCH.STACK) ? 'disabled' : ''} style="--c:${hex(d.color)}">${has ? '✓ ' : '+ '}${state.locals.length > 1 ? d.name : has ? 'TAKEN' : 'TAKE'}</button>`;
    }).join('');
    const rivals = takers.filter((d) => !d.human).map((d) => `<i title="${d.name}" style="background:${hex(d.color)}"></i>`).join('');
    return `<div class="oc${o.status !== 'open' ? ' gone' : ''}"><div class="ot"><b>${o.tag}</b><span>${o.customer} · ${o.drop.name}</span><em>$${o.tip}</em></div>
      <div class="oi">${items}</div><div class="ob"><span class="dist">${Math.round(o.dist)} m away</span><span class="takers">${rivals ? `${rivals} on it` : ''}</span>${o.status === 'open' ? btns : `<span class="st">${o.status === 'done' ? `delivered by ${M.dashers[o.by].name}` : 'cancelled'}</span>`}</div></div>`;
  }).join('');
  el.querySelectorAll('.take').forEach((b) => b.onclick = () => { toggle(M, M.dashers[+b.dataset.d], +b.dataset.o); play('ui'); state.boardSig = ''; refreshBoard(); });
}
function hideBoard() { state.boardOpen = false; if (state.M?.phase === 'play') hideScreen(); }
function updateBoardTimer() {
  const i = $('#screen .timer i');
  if (i) i.style.width = `${(state.M.boardT / MATCH.BOARD_TIME) * 100}%`;
}
function showCountdown() {
  const M = state.M;
  const cars = state.locals.map((i) => { const d = M.dashers[i]; return `<div class="car"><span class="dotc" style="background:${hex(d.color)}"></span>${state.locals.length > 1 ? d.name + ' — ' : ''}your car: <b>${d.spot.area}</b></div>`; }).join('');
  screen(`<div class="card order"><h2>SHIFT STARTING</h2><p>${M.board.length} orders on the board. Most tips wins.</p>${cars}<div class="count" id="count">3</div></div>`);
}
function updateCountdown() {
  const el = $('#count'), M = state.M;
  if (!el) return;
  const n = Math.ceil(M.readyT);
  if (el.textContent !== String(n)) { el.textContent = n; play('ready'); }
}

function showResults() {
  if (state.mode !== 'play') return;
  state.mode = 'over'; state.boardOpen = false;
  input.enabled = false;
  const M = state.M, w = M.winner, me = state.locals.map((i) => M.dashers[i]);
  const won = w && w.human;
  play(won ? 'deliver' : 'fail');
  const title = !w ? 'NO DELIVERIES' : won ? 'TOP DASHER!' : 'OUT-DASHED!';
  const sub = !w ? 'Every order was cancelled.' : won ? `${state.locals.length > 1 ? w.name : 'You'} made $${w.earned} this shift.` : `${w.name} made the most: $${w.earned}.`;
  const rows = standings(M).map((d, r) => `<tr class="${me.includes(d) ? 'me' : ''}"><td>${r === 0 && w ? '🏆' : r + 1}</td><td><span class="dotc" style="background:${hex(d.color)}"></span>${d.name}</td><td>$${d.earned}</td><td>${d.delivered} delivered${d.poached ? ` · ${d.poached} poached` : ''}</td></tr>`).join('');
  const s = screen(`<div class="card"><h2>${title}</h2><p>${sub}</p><table class="stand">${rows}</table>
    <div class="row2"><button class="btn green" data-a="next">NEXT SHIFT</button><button class="btn ghost" data-a="menu">MENU</button></div></div>`);
  s.querySelector('[data-a=next]').onclick = () => { play('ui'); startMatch(); };
  s.querySelector('[data-a=menu]').onclick = () => { play('ui'); startAttract(); };
}

function pause(on) {
  if (on && state.mode === 'play' && state.M.phase === 'play') {
    state.mode = 'pause'; state.boardOpen = false; input.reset();
    const s = screen(`<div class="card"><h2>PAUSED</h2>
      <button class="btn" data-a="resume">RESUME</button>
      <div class="row2"><button class="btn blue" data-a="cam">CAMERA: ${view.chase ? 'CHASE' : 'ISO'}</button><button class="btn ghost" data-a="mute">${settings.muted ? 'SOUND OFF' : 'SOUND ON'}</button></div>
      <div class="row2"><button class="btn ghost" data-a="restart">NEW SHIFT</button><button class="btn ghost" data-a="menu">MENU</button></div></div>`);
    s.querySelector('[data-a=resume]').onclick = () => pause(false);
    s.querySelector('[data-a=cam]').onclick = () => { toggleCam(); state.mode = 'play'; pause(true); };
    s.querySelector('[data-a=mute]').onclick = () => { toggleMute(); state.mode = 'play'; pause(true); };
    s.querySelector('[data-a=restart]').onclick = () => startMatch();
    s.querySelector('[data-a=menu]').onclick = () => startAttract();
  } else if (!on && state.mode === 'pause') { state.mode = 'play'; hideScreen(); last = performance.now(); state.acc = 0; }
}
function toggleCam() { view.chase = settings.chase = !view.chase; save(); toast(view.chase ? 'CHASE CAM' : 'ISO CAM', 'small'); }
function toggleMute() { settings.muted = !settings.muted; sfx.setMuted(settings.muted); save(); }
function toggleBoard() {
  if (state.mode !== 'play' || state.M.phase !== 'play') return;
  if (state.boardOpen) hideBoard(); else showBoard(false);
}

input.onKey = (code) => {
  const M = state.M;
  if (code === 'Escape' && state.boardOpen && M?.phase === 'play') hideBoard();
  else if (code === 'Escape' || code === 'KeyP') pause(state.mode === 'play');
  else if (code === 'KeyC' && state.mode === 'play') toggleCam();
  else if (code === 'KeyM') toggleMute();
  else if (code === 'KeyO' || code === 'Tab') toggleBoard();
  else if (/^Digit[1-9]$/.test(code) && state.boardOpen && state.locals.length) { toggle(M, M.dashers[state.locals[0]], +code.slice(5) - 1); play('ui'); state.boardSig = ''; refreshBoard(); }
  else if (code === 'Enter' && state.boardOpen && M?.phase === 'board' && state.locals.length === 1) { M.dashers[state.locals[0]].ready = true; }
};
input.onPad = (b) => { if (b === 'start') pause(state.mode === 'play'); else if (b === 'y' && state.mode === 'play') toggleCam(); else if (b === 'back') toggleBoard(); };
addEventListener('keydown', (e) => { if (e.code === 'Tab' && state.mode === 'play') e.preventDefault(); });
$('#btn-pause').onclick = () => pause(true);
$('#btn-cam').onclick = () => toggleCam();
$('#btn-board').onclick = () => toggleBoard();
addEventListener('blur', () => pause(true));
addEventListener('resize', () => { if (state.locals.length > 1 && (state.mode === 'play' || state.mode === 'pause')) buildPanes(state.locals); });

$('#loading').remove();
startAttract();
requestAnimationFrame(frame);
