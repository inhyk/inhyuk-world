import './style.css';
import { Match } from './match.mjs';
import { Renderer } from './render.mjs';
import { Sound } from './audio.mjs';
import { Controls } from './input.mjs';
import { AI_LEVELS, createBrain } from './ai.mjs';
import { FLOORS, TOP_FLOOR, floorState, currentFloor, helpLevel, floorReward, clearFloor, loseFloor } from './tower.mjs';
import { SKINS, EFFECTS, canBuy, buy, equip, grant } from './shop.mjs';
import { GROUPS, track, claim, missionView, unclaimedCount } from './missions.mjs';
import {
  loadStore, saveStore, createAccount, login, logout, currentAccount, exportCode, importCode,
  newProgress, addXp, xpToNext,
} from './profile.mjs';
import { drawCharacter, drawGarbageIcon } from './characters.mjs';
import { drawPreview } from './skins.mjs';
import { Effects } from './effects.mjs';
import { GARBAGE_ICONS } from './core.mjs';
import { createOnline } from './online.mjs';
import { playEnding } from './ending.mjs';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Number(n || 0).toLocaleString('ko-KR');
const TEST = new URLSearchParams(location.search).has('test');

// ---------- 저장 ----------
let storage = null;
try { storage = window.localStorage; storage.getItem('x'); } catch { storage = null; }
const store = loadStore(storage);
let account = currentAccount(store);
let guest = null;
const DEVICE_KEY = 'puyo-tower-device';
let device = { sound: true, music: true };
try { device = { ...device, ...JSON.parse(storage?.getItem(DEVICE_KEY) || '{}') }; } catch { /* 기본값 */ }
const me = () => account || guest;
const P = () => me()?.progress || (guest = { name: '손님', guest: true, progress: newProgress() }).progress;
function save() {
  if (account) { account.last = Date.now(); saveStore(storage, store); }
  try { storage?.setItem(DEVICE_KEY, JSON.stringify(device)); } catch { /* 저장 안 됨 */ }
}

// ---------- 준비 ----------
const brain = createBrain(() => new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' }));
const canvas = $('stage');
const renderer = new Renderer(canvas);
const sound = new Sound();
sound.setSfx(device.sound);
sound.setMusic(device.music);
const controls = new Controls();
controls.bindButtons($('touch'));
const coarse = matchMedia('(pointer: coarse)').matches;
controls.bindSwipe(canvas, () => renderer.layout?.fields?.[0]?.cell || 30);
const unlock = () => sound.unlock();
addEventListener('pointerdown', unlock, { capture: true });
addEventListener('keydown', unlock, { capture: true });

let screen = '', match = null, demo = null, game = null, paused = false, talking = false;

// ---------- 알림 ----------
function toast(text, gold = false) {
  const t = document.createElement('div');
  t.className = `toast${gold ? ' gold' : ''}`;
  t.textContent = text;
  $('toasts').append(t);
  setTimeout(() => t.remove(), 3300);
}

// ---------- 화면 ----------
const SCREENS = ['login', 'menu', 'tower', 'vs', 'local', 'online', 'missions', 'shop', 'profile', 'help'];
function show(name) {
  screen = name;
  for (const s of SCREENS) $(`scr-${s}`).hidden = s !== name;
  $('hud').hidden = true;
  $('touch').hidden = true;
  document.body.classList.remove('duo');
  controls.enabled = false;
  if (!match && !demo) startDemo();
  renderScreen(name);
  if (name && !match) sound.play('menu');
}
function hideScreens() { for (const s of SCREENS) $(`scr-${s}`).hidden = true; screen = ''; }

function renderScreen(name) {
  document.querySelectorAll('.coin-count').forEach(el => { el.textContent = fmt(P().coins); });
  if (name === 'login') renderLogin();
  if (name === 'menu') renderMenu();
  if (name === 'tower') renderTower();
  if (name === 'vs') renderVs();
  if (name === 'missions') renderMissions();
  if (name === 'shop') renderShop();
  if (name === 'profile') renderProfile();
  if (name === 'help') renderHelp();
}

document.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => {
  sound.sfx('click');
  const to = btn.dataset.go;
  if (to === 'solo') return startSolo();
  if (to === 'online' && online.active && screen === 'online') return;
  show(to);
}));

// ---------- 뒤에서 도는 AI 시범 경기 ----------
function startDemo() {
  demo = new Match({ seed: (Math.random() * 2 ** 31) | 0, specs: [{ kind: 'ai', level: 4 }, { kind: 'ai', level: 5 }], firstTo: 99, brain });
  renderer.setTheme('default');
  const skin = P().equip.skin, effect = P().equip.effect;
  renderer.setup([{ name: '', skin, effect }, { name: '', skin, effect }], { insets: { top: 0, bottom: 0, left: 0, right: 0 } });
}

// ---------- 로그인 ----------
let loginTarget = null;
function renderLogin() {
  const list = $('login-accounts');
  list.innerHTML = '';
  for (const a of store.accounts.slice().sort((x, y) => (y.last || 0) - (x.last || 0))) {
    const b = document.createElement('button');
    b.innerHTML = `<span>👤 ${esc(a.name)}</span><small>Lv.${a.progress.level} · 🪙${fmt(a.progress.coins)}</small>`;
    b.onclick = () => { loginTarget = a; $('login-name').textContent = a.name; loginPanel('login'); $('login-pass').focus(); };
    list.append(b);
  }
  loginPanel('main');
}
function loginPanel(which) {
  $('login-main').hidden = which !== 'main';
  $('login-accounts').hidden = which !== 'main' || !store.accounts.length;
  $('login-form').hidden = which !== 'login';
  $('signup-form').hidden = which !== 'signup';
  $('import-form').hidden = which !== 'import';
  $('login-msg').textContent = '';
}
$('go-signup').onclick = () => { loginPanel('signup'); $('signup-name').focus(); };
$('go-import').onclick = () => { loginPanel('import'); $('import-code').focus(); };
$('go-guest').onclick = () => {
  guest = { name: '손님', guest: true, progress: newProgress() };
  account = null;
  toast('손님은 기록이 저장되지 않아. 계정을 만들면 레벨·코인이 저장돼!');
  afterLogin();
};
['login-back', 'signup-back', 'import-back'].forEach(id => { $(id).onclick = () => loginPanel('main'); });
$('login-form').onsubmit = async e => {
  e.preventDefault();
  const r = await login(store, loginTarget?.name, $('login-pass').value);
  $('login-pass').value = '';
  if (!r.ok) { $('login-msg').textContent = r.error; sound.sfx('bump'); return; }
  account = r.account; guest = null; save(); afterLogin();
};
$('signup-form').onsubmit = async e => {
  e.preventDefault();
  const r = await createAccount(store, $('signup-name').value, $('signup-pass').value);
  if (!r.ok) { $('login-msg').textContent = r.error; sound.sfx('bump'); return; }
  $('signup-pass').value = '';
  account = r.account; guest = null; save();
  toast(`환영해, ${account.name}! 🪙100 선물이야.`, true);
  afterLogin();
};
$('import-form').onsubmit = e => {
  e.preventDefault();
  const r = importCode(store, $('import-code').value);
  if (!r.ok) { $('login-msg').textContent = r.error; return; }
  save();
  $('import-code').value = '';
  toast(`${r.account.name} 기록을 가져왔어! 비밀번호로 로그인해 줘.`);
  renderLogin();
};
function afterLogin() {
  sound.sfx('coin');
  startDemo();
  show('menu');
}

// ---------- 메뉴 ----------
function renderMenu() {
  const p = P();
  $('chip-name').textContent = me()?.name || '손님';
  $('chip-level').textContent = p.level;
  $('chip-coins').textContent = fmt(p.coins);
  $('chip-xp').style.width = `${Math.min(100, (p.xp / xpToNext(p.level)) * 100)}%`;
  const f = currentFloor(p.tower);
  $('menu-tower-sub').textContent = p.tower.cleared ? (p.tower.comet ? '👑 타워 정복! 다시 올라가 볼까?' : '✨ 탑 너머에 혜성이 보여…') : `${f}층 ${FLOORS[f - 1].name} 도전 중`;
  const n = unclaimedCount(p);
  $('mission-badge').hidden = !n;
  $('mission-badge').textContent = n;
}
$('profile-chip').onclick = () => { sound.sfx('click'); show('profile'); };

// ---------- 타워 ----------
function iconCanvas(id, size = 64) {
  const c = document.createElement('canvas');
  c.width = size * 2; c.height = size * 2;
  const ctx = c.getContext('2d');
  drawGarbageIcon(ctx, id, size, size, size * 1.6);
  return c;
}
function renderTower() {
  const t = P().tower;
  const list = $('tower-list');
  list.innerHTML = '';
  for (let floor = FLOORS.length; floor >= 1; floor--) {
    const info = FLOORS[floor - 1];
    const state = floorState(t, floor);
    if (state === 'hidden') continue;
    const li = document.createElement('li');
    li.className = `floor ${state}${info.secret ? ' secret' : ''}`;
    const help = helpLevel(t, floor);
    const label = state === 'cleared' ? '✔ 클리어' : state === 'open' ? '▶ 도전 가능' : '🔒 잠김';
    li.innerHTML = `<div class="num">${info.secret ? '★' : floor}<small>${info.secret ? '비밀' : '층'}</small></div><div class="ic"></div>
      <div><h3>${esc(info.name)}</h3><p>${esc(info.boss)} · AI 레벨 ${info.ai}${help ? ` · 도움 ${help}단계` : ''}</p><p class="state">${label}${state === 'cleared' && info.secret && t.comet ? ' · 혜성 꼬리 효과 획득' : ''}</p></div>`;
    li.querySelector('.ic').append(iconCanvas(info.icon, 32));
    if (state === 'open' || state === 'cleared') {
      const b = document.createElement('button');
      b.className = state === 'open' ? 'primary' : 'ghost';
      b.textContent = state === 'open' ? '도전!' : '다시';
      b.onclick = () => { sound.sfx('click'); startTower(floor); };
      li.append(b);
    } else li.append(document.createElement('span'));
    list.append(li);
  }
  $('tower-ending').hidden = !t.cleared;
}
$('tower-ending').onclick = () => runEnding(() => show('tower'));

// ---------- AI 대전 설정 ----------
let vsLevel = 3;
function faceCanvas(char, size = 72, mood = 'idle') {
  const c = document.createElement('canvas');
  c.width = size * 2; c.height = size * 2;
  drawCharacter(c.getContext('2d'), char, size, size, size * 1.9, mood, 0);
  return c;
}
function renderVs() {
  const grid = $('vs-levels');
  grid.innerHTML = '';
  for (let lv = 1; lv <= 7; lv++) {
    const info = FLOORS[lv - 1];
    const locked = lv === 7 && !P().tower.cleared;
    const b = document.createElement('button');
    b.className = `level${vsLevel === lv ? ' on' : ''}`;
    b.disabled = locked;
    b.append(faceCanvas(info.char, 36));
    b.insertAdjacentHTML('beforeend', `<b>${locked ? '???' : esc(info.boss)}</b><small>AI 레벨 ${lv} · ${locked ? '타워를 깨면 열려' : esc(AI_LEVELS[lv].name)}</small>`);
    b.onclick = () => { vsLevel = lv; sound.sfx('click'); renderVs(); };
    grid.append(b);
  }
}
function segValue(id) { return Number($(id).querySelector('.on')?.dataset.v || 1); }
document.querySelectorAll('.seg').forEach(seg => seg.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || seg.id === 'shop-tabs') return;
  seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  sound.sfx('click');
  if (seg.id === 'online-first') online.setFirstTo(Number(b.dataset.v));
}));
$('vs-start').onclick = () => startVs(vsLevel, segValue('vs-first'));
$('local-start').onclick = () => startLocal(segValue('local-first'));

// ---------- 게임 시작 ----------
function computeInsets() {
  const top = 54;
  if (!coarse) return { top, bottom: 8, left: 8, right: 8 };
  const portrait = innerHeight > innerWidth;
  if (portrait) return { top, bottom: 104, left: 4, right: 4 };
  return { top: 46, bottom: 6, left: 205, right: 205 };
}
function myView(extra = {}) {
  return { name: me()?.name || '나', level: P().level, skin: P().equip.skin, effect: P().equip.effect, char: 'hero', color: '#ffe45c', ...extra };
}
function startGame(cfg) {
  demo = null;
  game = { ...cfg, tracked: 0, started: performance.now(), warned: false };
  const seed = cfg.seed ?? ((Math.random() * 2 ** 31) | 0);
  match = new Match({ seed, specs: cfg.specs, firstTo: cfg.firstTo || 1, solo: cfg.mode === 'solo', online: cfg.online || null, makeRemote: cfg.makeRemote, brain });
  if (cfg.slow && match.ai[1]) match.ai[1].slow = cfg.slow;
  renderer.setTheme(cfg.theme || 'default');
  renderer.setup(cfg.views, { solo: cfg.mode === 'solo', ghost: P().settings.ghost !== false, insets: computeInsets() });
  hideScreens();
  $('hud').hidden = false;
  $('hud-title').textContent = cfg.title || '';
  $('touch').hidden = !coarse;
  document.body.classList.toggle('duo', cfg.mode === 'local');
  document.querySelector('#touch .pad[data-side="1"]').hidden = cfg.mode !== 'local';
  controls.mode = cfg.mode === 'local' ? 'duo' : 'solo';
  controls.reset();
  controls.enabled = true;
  paused = false;
  sound.play(cfg.music || 'battle');
}

function startTower(floor) {
  const info = FLOORS[floor - 1];
  const help = helpLevel(P().tower, floor);
  const cfg = {
    mode: 'tower', floor, title: `${info.secret ? '비밀 ' : ''}${info.name} · ${info.boss}`, theme: info.theme,
    music: floor >= 6 ? 'boss' : 'battle', firstTo: 1, slow: 1 + help * 0.15,
    specs: [{ kind: 'human' }, { kind: 'ai', level: info.ai }],
    views: [myView(), { name: info.boss, level: 0, skin: 'classic', effect: 'sparkle', char: info.char, color: '#ffb3c8' }],
  };
  talk(info, info.intro, () => { startGame(cfg); if (help) toast(`도움 ${help}단계: ${info.boss}의 손이 조금 느려져!`); });
}
function startVs(level, firstTo) {
  const info = FLOORS[level - 1];
  startGame({
    mode: 'vs', level, title: `AI 대전 · ${info.boss}`, theme: info.theme, music: level >= 6 ? 'boss' : 'battle', firstTo,
    specs: [{ kind: 'human' }, { kind: 'ai', level }],
    views: [myView(), { name: info.boss, level: 0, skin: 'classic', effect: 'sparkle', char: info.char, color: '#ffb3c8' }],
  });
}
function startLocal(firstTo) {
  const name2 = ($('local-name').value || '2P').slice(0, 10);
  startGame({
    mode: 'local', title: '2인 플레이', theme: 'sky', music: 'battle', firstTo,
    specs: [{ kind: 'human' }, { kind: 'human' }],
    views: [myView({ char: null }), { name: name2, skin: 'classic', effect: 'sparkle', char: null, color: '#9fe3ff' }],
  });
}
function startSolo() {
  startGame({
    mode: 'solo', title: '혼자 하기 · 끝없이', theme: 'meadow', music: 'menu', firstTo: 1,
    specs: [{ kind: 'human' }], views: [myView()],
  });
}

// ---------- 층 주인 대사 ----------
let talkDone = null, talkTimer = null, talkState = null;
function talk(info, text, done) {
  talking = true;
  talkDone = done;
  talkState = { n: 0, text };
  $('talk').hidden = false;
  $('talk-floor').textContent = info.secret ? '★ 비밀의 층' : `${info.floor}층 · ${info.name}`;
  $('talk-name').textContent = info.boss;
  $('talk-text').textContent = '';
  const face = $('talk-face'), ctx = face.getContext('2d');
  const t0 = performance.now(), state = talkState;
  clearInterval(talkTimer);
  talkTimer = setInterval(() => {
    const t = (performance.now() - t0) / 1000;
    ctx.clearRect(0, 0, face.width, face.height);
    drawCharacter(ctx, info.char, 80, 84, 150, state.n < text.length ? 'attack' : 'idle', t);
    if (state.n < text.length) { state.n++; $('talk-text').textContent = text.slice(0, state.n); if (state.n % 2) sound.sfx('talk'); }
  }, 33);
}
function closeTalk() {
  if (!talking || !talkState) return;
  // 글자가 아직 나오는 중이면 한 번에 다 보여 준다
  if (talkState.n < talkState.text.length) { talkState.n = talkState.text.length; $('talk-text').textContent = talkState.text; return; }
  clearInterval(talkTimer);
  talking = false;
  talkState = null;
  $('talk').hidden = true;
  const done = talkDone;
  talkDone = null;
  done?.();
}
$('talk').addEventListener('click', () => { sound.sfx('click'); closeTalk(); });

// ---------- 일시정지 ----------
function pause(on) {
  if (!match || game?.mode === 'online') return;
  paused = on;
  $('pause').hidden = !on;
  controls.reset();
}
$('hud-pause').onclick = () => {
  if (game?.mode === 'online') { if (confirm('온라인 대전을 그만할까? 방에서 나가게 돼.')) quitGame(); return; }
  pause(true);
};
$('pause-resume').onclick = () => pause(false);
$('pause-retry').onclick = () => { $('pause').hidden = true; paused = false; retry(); };
$('pause-quit').onclick = () => { $('pause').hidden = true; paused = false; quitGame(); };
function updateHudButtons() {
  $('hud-sound').textContent = device.sound ? '🔊' : '🔇';
  $('hud-music').style.opacity = device.music ? 1 : 0.4;
}
$('hud-sound').onclick = () => { device.sound = !device.sound; sound.setSfx(device.sound); updateHudButtons(); save(); };
$('hud-music').onclick = () => { device.music = !device.music; sound.setMusic(device.music); updateHudButtons(); save(); };
updateHudButtons();
document.addEventListener('visibilitychange', () => { if (document.hidden && match && !paused && game?.mode !== 'online' && match.phase !== 'over') pause(true); });

controls.onKey = e => {
  if (talking && (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyZ')) { e.preventDefault(); closeTalk(); return true; }
  if (!$('result').hidden && (e.code === 'Enter')) { e.preventDefault(); $('result-buttons').querySelector('button')?.click(); return true; }
  if (match && (e.code === 'Escape' || e.code === 'KeyP') && !talking && $('result').hidden) { e.preventDefault(); pause(!paused); return true; }
  if (paused && e.code === 'Enter') { pause(false); return true; }
  return false;
};

function quitGame() {
  if (game?.mode === 'online') online.leave();
  match = null;
  const back = game?.mode === 'tower' ? 'tower' : game?.mode === 'online' ? 'online' : 'menu';
  game = null;
  $('result').hidden = true;
  startDemo();
  show(back);
}
function retry() {
  const g = game;
  if (!g) return;
  $('result').hidden = true;
  match = null;
  if (g.mode === 'tower') startTower(g.floor);
  else if (g.mode === 'vs') startVs(g.level, g.firstTo);
  else if (g.mode === 'local') startLocal(g.firstTo);
  else if (g.mode === 'solo') startSolo();
  else if (g.mode === 'online') online.rematch();
}

// ---------- 매 프레임 ----------
let last = performance.now(), acc = 0;
function loop(now) {
  acc += Math.min(250, now - last);
  last = now;
  const step = 1000 / 60;
  while (acc >= step) { acc -= step; tick(); }
  renderer.draw(match || demo, now / 1000);
  requestAnimationFrame(loop);
}
function tick() {
  const m = match || demo;
  if (!m || (match && (paused || talking))) return;
  const inputs = match ? controls.frame(2, m.players.map(p => p.state === 'control')) : [];
  m.step(inputs);
  for (const e of m.events) handle(e, m);
  m.events.length = 0;
  renderer.step(m);
  if (match && game?.mode === 'online') online.tick(match);
  if (match && game) watchDanger(m);
}

let heartClock = 0;
function watchDanger(m) {
  const p = m.players[0];
  if (m.phase !== 'play' || !p?.h) return;
  if (p.h[2] >= 10 && ++heartClock % 48 === 0) sound.sfx('heart');
}

function human(m, i) { return m.specs[i]?.kind === 'human'; }
function mode() { return game?.mode === 'solo' ? 'solo' : game?.mode; }
function trackEvent(ev) {
  const done = track(P(), ev);
  for (const d of done) { toast(`🎯 챌린지 완료! ${d.title}`, true); sound.sfx('mission'); }
  if (done.length) save();
}

function handle(e, m) {
  renderer.onEvent(e, m);
  if (m === demo) return;
  const mine = e.p === game.tracked;
  switch (e.type) {
    case 'rotate': if (human(m, e.p)) sound.sfx(e.quick ? 'quick' : 'rotate'); break;
    case 'move': if (human(m, e.p)) sound.sfx('move'); break;
    case 'bump': if (human(m, e.p)) sound.sfx('bump'); break;
    case 'lock': sound.sfx('lock'); break;
    case 'drop': if (human(m, e.p)) sound.sfx('drop'); break;
    case 'pop': {
      sound.sfx('pop', e.chain);
      setTimeout(() => sound.sfx('burst'), 560);
      if (game.online && mine) online.event(e);
      if (mine) trackEvent({ type: 'pop', mode: mode(), puyos: e.puyos, colors: new Set(e.colors).size, maxGroup: Math.max(...e.groups.map(g => g.length)) });
      break;
    }
    case 'chainStart': if (game.online && mine) online.send({ t: 'cs' }); break;
    case 'chainEnd':
      if (game.online && mine) online.send({ t: 'ce' });
      if (mine) trackEvent({ type: 'chain', mode: mode(), chain: e.chain, made: e.made, sent: e.sent });
      break;
    case 'allClear': sound.sfx('allclear'); if (game.online && mine) online.event(e); if (mine) trackEvent({ type: 'allClear', mode: mode() }); break;
    case 'offset': sound.sfx('offset'); if (game.online && mine) online.event(e); if (mine) trackEvent({ type: 'offset', mode: mode(), amount: e.amount }); break;
    case 'incoming':
      if (human(m, e.p) && m.players[e.p].incoming >= 30 && !game.warned) { game.warned = true; sound.sfx('warn'); }
      break;
    case 'garbage': sound.sfx('garbage', e.count); game.warned = false; if (game.online && mine) online.event(e); break;
    case 'remoteSend': online.send({ t: 'atk', n: e.amount }); break;
    case 'count': sound.sfx('count', 0); break;
    case 'go': sound.sfx('count', 1); break;
    case 'dead': if (game.online && mine) online.send({ t: 'dead', r: m.round }); break;
    case 'roundEnd': roundEnd(e, m); break;
    case 'round': renderer.resetRound(); break;
    case 'matchEnd': finishMatch(); break;
    default: break;
  }
}

function roundEnd(e, m) {
  if (m.solo) { renderer.setResult(0, ''); sound.sfx('lose'); return; }
  const w = e.winner;
  m.players.forEach((_, i) => renderer.setResult(i, w < 0 ? 'draw' : i === w ? 'win' : 'lose'));
  const humans = m.specs.filter(s => s.kind === 'human').length;
  if (humans === 2) sound.sfx('win');
  else sound.sfx(w === game.tracked ? 'win' : 'lose');
  if (game.online) online.roundOver(e, m);
}

// ---------- 결과와 보상 ----------
function finishMatch() {
  const m = match, g = game;
  if (!m || !g || g.finished) return;
  g.finished = true;
  const p = P();
  const win = m.winner() === 0;
  const totals = m.totals(0);
  let coins = 0, xp = 0, title = win ? '승리!' : '패배…', sub = '', ending = false;
  const buttons = [];
  if (g.mode === 'tower') {
    const info = FLOORS[g.floor - 1];
    if (win) {
      const r = floorReward(p.tower, g.floor);
      coins += r.coins; xp += r.xp;
      const res = clearFloor(p.tower, g.floor);
      trackEvent({ type: 'tower', floor: g.floor });
      if (res.ending) { grant(p, 'skin', 'crown'); ending = true; }
      if (info.secret && res.secretFirst) { grant(p, 'effect', 'comet'); toast('✨ 혜성 꼬리 효과를 얻었어!', true); }
      title = info.secret ? '혜성 층 정복!' : g.floor === TOP_FLOOR ? '타워 정복!' : `${g.floor}층 클리어!`;
      sub = r.first ? `${info.name}을(를) 처음 깼어!` : `${info.name} 다시 클리어`;
      const next = g.floor < TOP_FLOOR ? g.floor + 1 : null;
      if (next) buttons.push(['primary', `${next}층 도전 ▶`, () => { closeResult(); startTower(next); }]);
      else if (p.tower.cleared && !info.secret && !p.tower.comet) buttons.push(['primary', '비밀의 층으로 ★', () => { closeResult(); startTower(7); }]);
      buttons.push(['ghost', '타워로', () => { closeResult(); quitGame(); }]);
    } else {
      loseFloor(p.tower, g.floor);
      coins += 10; xp += 15;
      sub = `${info.boss}에게 졌어. 다시 도전하면 AI 손이 조금 느려져!`;
      buttons.push(['primary', '다시 도전', () => { closeResult(); startTower(g.floor); }]);
      buttons.push(['ghost', '타워로', () => { closeResult(); quitGame(); }]);
    }
  } else if (g.mode === 'vs') {
    if (win) { coins += 20 + g.level * 10; xp += 30 + g.level * 12; } else { coins += 5; xp += 15; }
    sub = `${FLOORS[g.level - 1].boss} (AI 레벨 ${g.level}) · ${m.wins[0]} : ${m.wins[1]}`;
    buttons.push(['primary', '다시 하기', () => { closeResult(); retry(); }], ['ghost', '메뉴로', () => { closeResult(); quitGame(); }]);
  } else if (g.mode === 'local') {
    title = m.winner() === 0 ? `${me()?.name || '1P'} 승리!` : m.winner() === 1 ? `${renderer.views[1]?.name || '2P'} 승리!` : '무승부!';
    coins += 20; xp += 30;
    sub = `${m.wins[0]} : ${m.wins[1]}`;
    buttons.push(['primary', '다시 하기', () => { closeResult(); retry(); }], ['ghost', '메뉴로', () => { closeResult(); quitGame(); }]);
  } else if (g.mode === 'online') {
    if (win) { coins += 80; xp += 100; } else { coins += 20; xp += 40; }
    sub = `${online.peerName()} · ${m.wins[0]} : ${m.wins[1]}`;
    buttons.push(['primary', '한 번 더!', () => { closeResult(); online.rematch(); }], ['ghost', '나가기', () => { closeResult(); quitGame(); }]);
  } else if (g.mode === 'solo') {
    title = '게임 끝!';
    const score = m.players[0].score;
    coins += Math.min(300, Math.floor(score / 400));
    xp += Math.min(250, Math.floor(score / 150)) + 10;
    sub = `점수 ${fmt(score)}${score > p.stats.endlessBest ? ' · 새 최고 기록!' : ''}`;
    p.stats.endlessBest = Math.max(p.stats.endlessBest, score);
    trackEvent({ type: 'endless', score });
    buttons.push(['primary', '다시 하기', () => { closeResult(); retry(); }], ['ghost', '메뉴로', () => { closeResult(); quitGame(); }]);
  }
  xp += totals.maxChain * 5;
  if (g.mode !== 'solo') trackEvent({ type: 'match', mode: g.mode, win });
  else trackEvent({ type: 'match', mode: 'solo', win: false });
  const s = p.stats;
  s.games++;
  if (g.mode !== 'solo' && g.mode !== 'local') { if (win) s.wins++; else s.losses++; }
  if (g.mode === 'local') s.localGames++;
  if (g.mode === 'online') { s.onlineGames++; if (win) s.onlineWins++; }
  s.maxChain = Math.max(s.maxChain, totals.maxChain);
  s.maxScore = Math.max(s.maxScore, totals.maxScore);
  s.popped += totals.popped; s.allClears += totals.allClears; s.offsets += totals.offsets; s.garbageSent += totals.garbageSent;
  s.playSeconds += Math.round((performance.now() - g.started) / 1000);
  if (guest && !account) { coins = Math.round(coins); }
  p.coins += coins;
  const before = { level: p.level, xp: p.xp };
  const lv = addXp(p, xp);
  for (const level of lv.levels) trackEvent({ type: 'level', level });
  save();
  const show = () => showResult({ title, sub, win: g.mode === 'solo' || g.mode === 'local' ? true : win, totals, coins, xp, lv, before, buttons, mode: g.mode, score: m.players[0].score });
  if (g.mode === 'tower') {
    const info = FLOORS[g.floor - 1];
    setTimeout(() => talk(info, win ? info.win : info.lose, () => (ending ? runEnding(show) : show())), 900);
  } else setTimeout(show, 700);
}

function showResult(r) {
  sound.play('menu');
  $('result').hidden = false;
  $('result').querySelector('.card').classList.toggle('lose', !r.win);
  $('result-title').textContent = r.title;
  $('result-sub').textContent = r.sub;
  const t = r.totals;
  $('result-stats').innerHTML = [
    ['최대 연쇄', `${t.maxChain}연쇄`], ['점수', fmt(r.mode === 'solo' ? r.score : t.maxScore)], ['보낸 방해뿌요', `${fmt(t.garbageSent)}개`],
    ['터뜨린 뿌요', `${fmt(t.popped)}개`], ['상쇄', `${t.offsets}번`], ['전소', `${t.allClears}번`],
  ].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('');
  $('result-xp').textContent = `+${r.xp}`;
  $('result-coins').textContent = `+${fmt(r.coins + (r.lv.coins || 0))}`;
  const p = P();
  const bar = $('result-xpbar');
  bar.style.transition = 'none';
  bar.style.width = `${Math.min(100, (r.before.xp / xpToNext(r.before.level)) * 100)}%`;
  requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transition = 'width 1s'; bar.style.width = `${Math.min(100, (p.xp / xpToNext(p.level)) * 100)}%`; }));
  $('result-level').innerHTML = r.lv.levels.length ? `<span class="levelup">🎉 레벨 업! Lv.${p.level} (레벨 보상 🪙${fmt(r.lv.coins)})</span>` : `Lv.${p.level} · 다음 레벨까지 ${fmt(xpToNext(p.level) - p.xp)}`;
  if (r.lv.levels.length) sound.sfx('level'); else sound.sfx('coin');
  const view = missionView(p);
  const ready = [...view.daily, ...view.list].filter(x => x.done && !x.claimed);
  $('result-missions').innerHTML = ready.length ? `<div>🎯 받을 수 있는 챌린지 보상이 ${ready.length}개 있어! 메뉴 → 챌린지</div>` : '';
  const row = $('result-buttons');
  row.innerHTML = '';
  for (const [cls, label, fn] of r.buttons) {
    const b = document.createElement('button');
    b.className = cls;
    b.textContent = label;
    b.onclick = () => { sound.sfx('click'); fn(); };
    row.append(b);
  }
}
function closeResult() { $('result').hidden = true; }

// ---------- 엔딩 ----------
function runEnding(done) {
  $('ending').hidden = false;
  hideScreens();
  $('hud').hidden = true; $('touch').hidden = true;
  controls.enabled = false;
  sound.play('ending');
  P().tower.endings = (P().tower.endings || 0) + 1;
  save();
  const stop = playEnding($('ending-canvas'), { name: me()?.name || '나', skin: P().equip.skin, sound, onDone: finish });
  $('ending-skip').onclick = () => { stop(); finish(); };
  function finish() {
    if ($('ending').hidden) return;
    $('ending').hidden = true;
    toast('👑 황금 왕관 뿌요 스킨을 받았어! 상점에서 장착해 봐.', true);
    toast('✨ 탑 너머 비밀의 혜성 층이 열렸어!', true);
    done?.();
  }
}

// ---------- 챌린지 ----------
function renderMissions() {
  const p = P();
  const view = missionView(p);
  const root = $('mission-list');
  root.innerHTML = '';
  const section = (title, rows) => {
    const h = document.createElement('h3');
    h.className = 'mgroup';
    h.textContent = title;
    root.append(h);
    for (const m of rows) {
      const d = document.createElement('div');
      d.className = `mission${m.done ? ' done' : ''}${m.claimed ? ' claimed' : ''}${m.id === 'tower-chain-5' ? ' kid' : ''}`;
      const pct = Math.round((m.v / m.goal) * 100);
      d.innerHTML = `<b>${m.id === 'tower-chain-5' ? '<span class="star">★</span> ' : ''}${esc(m.title)}</b><button ${m.done && !m.claimed ? 'class="primary"' : 'disabled'}>${m.claimed ? '✔ 받음' : m.done ? '받기!' : `${fmt(m.v)}/${fmt(m.goal)}`}</button>
        <div class="bar"><i style="width:${pct}%"></i></div><span class="rw">보상 🪙${fmt(m.reward.coins)}${m.reward.xp ? ` · 경험치 ${m.reward.xp}` : ''}</span>`;
      d.querySelector('button').onclick = () => {
        const reward = claim(p, m.id);
        if (!reward) return;
        p.coins += reward.coins;
        const lv = addXp(p, reward.xp || 0);
        for (const level of lv.levels) { trackEvent({ type: 'level', level }); toast(`🎉 레벨 업! Lv.${level}`, true); }
        sound.sfx(lv.levels.length ? 'level' : 'coin');
        save();
        renderScreen('missions');
      };
      root.append(d);
    }
  };
  section('📅 오늘의 미션', view.daily);
  for (const [key, title] of Object.entries(GROUPS)) section(title, view.list.filter(m => m.group === key));
}

// ---------- 상점 ----------
let shopTab = 'skin', previewTimer = null;
$('shop-tabs').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  shopTab = b.dataset.v;
  $('shop-tabs').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  sound.sfx('click');
  renderShop();
});
function renderShop() {
  const p = P();
  const grid = $('shop-grid');
  grid.innerHTML = '';
  const items = shopTab === 'skin' ? SKINS : EFFECTS;
  const previews = [];
  for (const item of items) {
    const state = canBuy(p, shopTab, item.id);
    const owned = p.owned[shopTab].includes(item.id);
    const on = p.equip[shopTab] === item.id;
    const card = document.createElement('div');
    card.className = `item${on ? ' equipped' : ''}`;
    const cv = document.createElement('canvas');
    cv.width = 240; cv.height = 200;
    card.append(cv);
    card.insertAdjacentHTML('beforeend', `<b>${esc(item.name)}</b><p>${esc(item.desc)}</p>`);
    const b = document.createElement('button');
    if (on) { b.textContent = '✔ 장착 중'; b.disabled = true; }
    else if (owned) { b.textContent = '장착하기'; b.className = 'ghost'; }
    else if (state === 'reward') { b.textContent = item.reward === 'tower' ? '🗼 타워 정복 보상' : '★ 비밀 층 보상'; b.disabled = true; }
    else if (state === 'level') { b.innerHTML = `🔒 Lv.${item.level}부터 · <span class="price">🪙${fmt(item.price)}</span>`; b.disabled = true; }
    else { b.innerHTML = `<span class="price">🪙${fmt(item.price)}</span> 사기`; b.className = state === 'ok' ? 'primary' : ''; b.disabled = state !== 'ok'; }
    b.onclick = () => {
      if (owned) { equip(p, shopTab, item.id); sound.sfx('click'); toast(`${item.name} 장착!`); }
      else {
        const r = buy(p, shopTab, item.id);
        if (r !== 'bought') return;
        sound.sfx('coin');
        toast(`🛍️ ${item.name}을(를) 샀어!`, true);
        trackEvent({ type: 'buy', kind: shopTab });
      }
      save();
      renderShop();
      document.querySelectorAll('.coin-count').forEach(el => { el.textContent = fmt(p.coins); });
    };
    card.append(b);
    grid.append(card);
    previews.push({ cv, item });
  }
  clearInterval(previewTimer);
  const fx = previews.map(() => new Effects());
  let t = 0;
  const paint = () => {
    t += 1 / 30;
    previews.forEach(({ cv, item }, k) => {
      if (shopTab === 'skin') { drawPreview(cv, item.id, [1, 3, 4, 2], t); return; }
      const ctx = cv.getContext('2d');
      const e = fx[k];
      if (Math.floor(t * 30) % 50 === k % 50 || !e.parts.length && !e.rings.length && Math.random() < 0.02) e.pop(item.id, 120, 110, [1, 2, 3, 4, 5][k % 5], 60, 3);
      e.update();
      ctx.clearRect(0, 0, cv.width, cv.height);
      drawPreview(cv, p.equip.skin, [[1, 2, 3, 4, 5][k % 5], 3], t + 2);
      e.draw(ctx);
    });
    if (screen !== 'shop') clearInterval(previewTimer);
  };
  paint();
  previewTimer = setInterval(paint, 33);
}

// ---------- 내 정보 ----------
function renderProfile() {
  const p = P();
  $('profile-name').textContent = me()?.name || '손님';
  $('profile-level').textContent = p.level;
  $('profile-xp').style.width = `${Math.min(100, (p.xp / xpToNext(p.level)) * 100)}%`;
  $('profile-xp-text').textContent = `경험치 ${fmt(p.xp)} / ${fmt(xpToNext(p.level))}`;
  const av = $('profile-avatar'), ctx = av.getContext('2d');
  ctx.clearRect(0, 0, av.width, av.height);
  drawCharacter(ctx, 'hero', 60, 62, 110, 'happy', 0, { crown: p.tower.cleared });
  const s = p.stats;
  const t = p.tower;
  $('profile-stats').innerHTML = [
    ['타워', t.cleared ? (t.comet ? '👑 + ★ 정복' : '👑 정복') : `${t.best}층까지`], ['판 수', `${fmt(s.games)}판`], ['승리', `${fmt(s.wins)}승 ${fmt(s.losses)}패`],
    ['최대 연쇄', `${s.maxChain}연쇄`], ['최고 점수', fmt(s.maxScore)], ['혼자 하기 최고', fmt(s.endlessBest)],
    ['터뜨린 뿌요', `${fmt(s.popped)}개`], ['보낸 방해뿌요', `${fmt(s.garbageSent)}개`], ['전소', `${fmt(s.allClears)}번`],
    ['상쇄', `${fmt(s.offsets)}번`], ['온라인', `${fmt(s.onlineWins)}승 / ${fmt(s.onlineGames)}판`], ['엔딩 본 횟수', `${t.endings || 0}번`],
  ].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('');
  $('set-sound').checked = device.sound;
  $('set-music').checked = device.music;
  $('set-ghost').checked = p.settings.ghost !== false;
  $('set-shake').checked = p.settings.shake !== false;
  $('export-copy').disabled = !account;
  $('logout').textContent = account ? '🚪 로그아웃' : '🔑 로그인하러 가기';
  $('export-code').hidden = true;
}
$('set-sound').onchange = e => { device.sound = e.target.checked; sound.setSfx(device.sound); updateHudButtons(); save(); };
$('set-music').onchange = e => { device.music = e.target.checked; sound.setMusic(device.music); updateHudButtons(); save(); };
$('set-ghost').onchange = e => { P().settings.ghost = e.target.checked; save(); };
$('set-shake').onchange = e => { P().settings.shake = e.target.checked; save(); };
$('export-copy').onclick = async () => {
  if (!account) return;
  const code = exportCode(account);
  $('export-code').hidden = false;
  $('export-code').value = code;
  try { await navigator.clipboard.writeText(code); toast('📋 기록 코드를 복사했어!'); } catch { $('export-code').select(); toast('코드를 길게 눌러 복사해 줘.'); }
};
$('logout').onclick = () => {
  if (account) { logout(store); account = null; save(); }
  guest = null;
  show('login');
};

// ---------- 하는 방법 ----------
function renderHelp() {
  const box = $('help-icons');
  if (box.childElementCount) return;
  for (const icon of GARBAGE_ICONS) {
    const s = document.createElement('span');
    s.append(iconCanvas(icon.id, 20));
    s.append(`${icon.name} ${fmt(icon.value)}`);
    box.append(s);
  }
}

// ---------- 온라인 ----------
const online = createOnline({
  $, toast, sound, esc,
  me: () => ({ name: me()?.name || '손님', level: P().level, skin: P().equip.skin, effect: P().equip.effect }),
  start: ({ seed, firstTo, peer, role, makeRemote }) => {
    startGame({
      mode: 'online', online: role, seed, firstTo, title: `온라인 · ${peer.name}`, theme: 'starry', music: 'battle',
      specs: [{ kind: 'human' }, { kind: 'remote' }], makeRemote,
      views: [myView({ char: null }), { name: peer.name, level: peer.level, skin: peer.skin || 'classic', effect: peer.effect || 'sparkle', char: null, color: '#9fe3ff' }],
    });
  },
  match: () => match,
  finished: () => finishMatch(),
  quit: () => { if (match && game?.mode === 'online') { match = null; game = null; $('result').hidden = true; startDemo(); show('online'); } },
  renderer,
});

// ---------- 창 크기 ----------
addEventListener('resize', () => {
  renderer.resize();
  if (match) renderer.setInsets(computeInsets());
});
// 휴대폰을 가로·세로로 돌려도 효과음 (기획서 12번)
const portraitQuery = matchMedia('(orientation: portrait)');
portraitQuery.addEventListener?.('change', e => {
  sound.sfx('rotate');
  if (coarse) toast(e.matches ? '📱 세로 화면!' : '📱 가로 화면!');
});

// ---------- 테스트용 ----------
window.render_game_to_text = () => JSON.stringify({
  screen, paused, talking,
  account: me()?.name || null, level: P().level, coins: P().coins, tower: P().tower,
  mode: game?.mode || null,
  match: match ? {
    phase: match.phase, round: match.round, wins: match.wins, frame: match.frame,
    players: match.players.map(p => ({ state: p.state, score: p.score, incoming: p.incoming, pieces: p.stats?.pieces, maxChain: p.stats?.maxChain, piece: p.piece ? { x: p.piece.x, y: Math.round(p.piece.y * 10) / 10, rot: p.piece.rot } : null })),
  } : null,
});
if (TEST) {
  window.__puyo = { get match() { return match; }, get game() { return game; }, P, store, startTower, startVs, startSolo, startLocal, show, finishMatch, renderer, online, runEnding };
}

// ---------- 시작 ----------
show(account ? 'menu' : 'login');
requestAnimationFrame(loop);
