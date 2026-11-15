// 씽씽 카트 · 화면, 조작, 메뉴. 규칙 계산은 core.mjs.
import * as THREE from 'three';
import './style.css';
import * as C from './core.mjs';
import { buildWorld } from './src/scene.js';
import { makeKart, makeItemBox, makeTrap, makeShot, Particles } from './src/models.js';
import { unlock, setSound, setMusic, setTune, engineSound, skidSound, sfx } from './src/audio.js';
import { Net, peerNum } from './src/net.js';

const $ = (id) => document.getElementById(id);
const setText = (el, t) => { if (el.textContent !== t) el.textContent = t; };
const canvas = $('game');
const debug = new URLSearchParams(location.search).has('debug');

// ── 저장 ──
function load() { try { return C.fixSave(JSON.parse(localStorage.getItem(C.SAVE_KEY))); } catch { return C.newSave(); } }
let save = load();
function persist() { try { localStorage.setItem(C.SAVE_KEY, JSON.stringify(save)); } catch { /* 저장을 못 해도 게임은 계속 */ } }

// ── 3D 준비 ──
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 2000);
function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize); resize();
const particles = new Particles(scene);

// ── 상태 ──
let screen = 'lobby', world = null, worldId = null, race = null, paused = false, overT = 0, shownResult = false;
let views = [], boxViews = [], trapViews = new Map(), shotViews = new Map(), lobbyKart = null;
let camA = 0, camFov = 62, shake = 0, clock = 0, msgT = 0, lastCount = 9, mini = null;
const dyn = new THREE.Group(); scene.add(dyn);

function setWorld(id) {
  if (worldId === id) return;
  if (world) world.dispose();
  const T = C.buildTrack(id);
  world = buildWorld(scene, T); worldId = id; mini = makeMini(T);
}
function clearDyn() {
  for (const v of views) dyn.remove(v.group);
  for (const b of boxViews) dyn.remove(b);
  for (const m of trapViews.values()) dyn.remove(m);
  for (const m of shotViews.values()) dyn.remove(m);
  if (lobbyKart) { dyn.remove(lobbyKart.group); lobbyKart = null; }
  views = []; boxViews = []; trapViews.clear(); shotViews.clear(); particles.clear();
}

// ── 조작 ──
const keys = new Set(), touch = { left: false, right: false, drift: false, brake: false, item: false };
let touchMode = false, useEdge = false;
const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight'];
window.addEventListener('keydown', (e) => {
  if (GAME_KEYS.includes(e.code)) e.preventDefault();
  unlock();
  if (e.repeat) return;
  keys.add(e.code);
  if (screen === 'race') {
    if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
    if (e.code === 'KeyR' && race && !paused) C.requestReset(race);
    if (['ControlLeft', 'ControlRight', 'KeyZ', 'KeyX', 'KeyE'].includes(e.code)) useEdge = true;
  } else if (screen === 'lobby' && e.code === 'Enter' && $('panel').hidden && !net.active) startRace();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); if (screen === 'race' && race && race.state === 'race' && !paused && !race.online) togglePause(); });
function bindTouch(id, key) {
  const el = $(id);
  const on = (e) => { e.preventDefault(); unlock(); touch[key] = true; el.classList.add('down'); if (key === 'item') useEdge = true; };
  const off = (e) => { e.preventDefault(); touch[key] = false; el.classList.remove('down'); };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
}
bindTouch('t-left', 'left'); bindTouch('t-right', 'right'); bindTouch('t-drift', 'drift'); bindTouch('t-brake', 'brake'); bindTouch('t-item', 'item');
window.addEventListener('touchstart', () => { touchMode = true; }, { passive: true });
function readInput() {
  const left = keys.has('ArrowLeft') || keys.has('KeyA') || touch.left, right = keys.has('ArrowRight') || keys.has('KeyD') || touch.right;
  const brake = keys.has('ArrowDown') || keys.has('KeyS') || touch.brake;
  const gas = keys.has('ArrowUp') || keys.has('KeyW') || (touchMode && !brake);
  const drift = keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('Space') || touch.drift;
  return { steer: (right ? 1 : 0) - (left ? 1 : 0), gas, brake, drift, use: useEdge };
}

// ── 대기실 ──
const MEDAL = ['', '🥇', '🥈', '🥉'];
function trackThumb(T, w = 148, h = 112) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const bg = { forest: '#4fae4a', beach: '#ecd08a', snow: '#dfeaf8', city: '#1b2040', volcano: '#4a2c24', cloud: '#bfd9ff' }[T.theme];
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < T.n; i++) { x0 = Math.min(x0, T.x[i]); x1 = Math.max(x1, T.x[i]); z0 = Math.min(z0, T.z[i]); z1 = Math.max(z1, T.z[i]); }
  const s = Math.min((w - 20) / (x1 - x0), (h - 20) / (z1 - z0)), ox = w / 2 + ((x0 + x1) / 2) * s, oy = h / 2 + ((z0 + z1) / 2) * s;
  const path = () => { g.beginPath(); for (let i = 0; i < T.n; i += 2) { const px = ox - T.x[i] * s, py = oy - T.z[i] * s; if (i) g.lineTo(px, py); else g.moveTo(px, py); } g.closePath(); };
  g.lineJoin = 'round'; path(); g.strokeStyle = '#fff'; g.lineWidth = 9; g.stroke(); path(); g.strokeStyle = T.theme === 'cloud' ? '#b48cff' : '#444a58'; g.lineWidth = 6; g.stroke();
  g.fillStyle = '#ff3d5a'; g.beginPath(); g.arc(ox - T.x[0] * s, oy - T.z[0] * s, 4.5, 0, 7); g.fill();
  return c;
}
const btn = (cls, html, onClick) => { const b = document.createElement('button'); b.className = cls; b.innerHTML = html; b.addEventListener('click', () => { unlock(); sfx.click(); onClick(); }); return b; };
function drawLobby() {
  if (net.active) net.send(myLook());
  setText($('l-coins'), String(save.coins));
  $('b-sound').classList.toggle('off', !save.sound); $('b-music').classList.toggle('off', !save.music);
  const tr = $('l-tracks'); tr.replaceChildren();
  C.TRACKS.forEach((t, i) => {
    const locked = i >= save.unlocked, T = C.buildTrack(t.id), best = save.best[t.id], medal = save.medals[t.id];
    const b = btn('track' + (save.track === t.id ? ' on' : '') + (locked ? ' lock' : ''), '', () => {
      if (locked) { flash('앞 트랙에서 3등 안에 들면 열려요!'); return; }
      save.track = t.id; persist(); drawLobby(); showLobbyScene();
    });
    b.append(trackThumb(T));
    const info = document.createElement('div');
    info.innerHTML = `<div class="nm">${locked ? '🔒 ' : ''}${t.name}</div><div class="st">${'★'.repeat(t.star)}${'☆'.repeat(5 - t.star)} · ${t.laps || C.LAPS}바퀴${best && best.lap ? ' · 최고 ' + C.fmtTime(best.lap) : ''}</div>`;
    const md = document.createElement('div'); md.className = 'md'; md.textContent = medal ? (MEDAL[medal] || medal + '등') : '';
    b.append(info, md); tr.append(b);
  });
  const mo = $('l-modes'); mo.replaceChildren(...C.MODES.map((m) => { const b = btn(save.mode === m.id ? 'on' : '', m.name, () => { save.mode = m.id; persist(); drawLobby(); }); b.title = m.desc; return b; }));
  const df = $('l-diffs'); df.replaceChildren(...C.DIFFS.map((d, i) => btn(save.difficulty === i ? 'on' : '', '컴퓨터 ' + d.name, () => { save.difficulty = i; persist(); drawLobby(); })));
  df.style.visibility = save.mode === 'time' ? 'hidden' : '';
  $('l-racers').replaceChildren(...C.RACERS.map((r) => btn(save.racer === r.id ? 'on' : '', `<span>${r.emoji}</span>${r.name}`, () => { save.racer = r.id; persist(); drawLobby(); showLobbyScene(true); })));
  const bar = (v) => '●'.repeat(Math.round((v - 0.9) * 25)) || '·';
  $('l-karts').replaceChildren(...C.KARTS.map((k) => {
    const own = save.karts.includes(k.id), cant = !own && save.coins < k.price;
    const b = btn('kart' + (save.kart === k.id ? ' on' : '') + (cant ? ' cant' : ''), `<i style="background:#${k.color.toString(16).padStart(6, '0')}"></i><div>${k.name}<small>빠르기 ${bar(k.speed)} 출발 ${bar(k.accel)} 드리프트 ${bar(k.drift)}</small></div><div class="pr">${own ? (save.kart === k.id ? '타는 중' : '고르기') : '<i class="c"></i>' + k.price}</div>`, () => {
      if (own) save.kart = k.id;
      else if (C.buyKart(save, k.id)) { sfx.coin(); flash(k.name + '를 샀어요!'); }
      else { flash(`코인이 ${k.price - save.coins}개 모자라요. 경주를 하면 코인을 받아요!`); return; }
      persist(); drawLobby(); showLobbyScene(true);
    });
    return b;
  }));
}
function showLobbyScene(force) {
  if (!force && worldId === save.track && lobbyKart) return;
  setWorld(save.track); clearDyn();
  const T = C.buildTrack(save.track);
  lobbyKart = makeKart(C.RACERS.find((r) => r.id === save.racer), C.KARTS.find((k) => k.id === save.kart));
  const p = C.trackPos(T, 6, 0); lobbyKart.group.position.set(p.x, 0, p.z); lobbyKart.group.rotation.y = p.h; dyn.add(lobbyKart.group);
  setTune('menu');
}
function toLobby() {
  screen = 'lobby'; race = null; paused = false;
  $('hud').hidden = true; $('touch').hidden = true; $('panel').hidden = true; $('lobby').hidden = false;
  engineSound(0, false, false); skidSound(0);
  drawLobby(); showLobbyScene(true);
}
$('b-start').addEventListener('click', () => { unlock(); if (net.active) roomPanel(); else startRace(); });
$('b-online').addEventListener('click', () => { unlock(); sfx.click(); roomPanel(); });
$('b-sound').addEventListener('click', () => { unlock(); save.sound = !save.sound; setSound(save.sound); persist(); drawLobby(); });
$('b-music').addEventListener('click', () => { unlock(); save.music = !save.music; setMusic(save.music); persist(); drawLobby(); });
$('b-pause').addEventListener('click', () => togglePause());

// ── 경주 시작 ──
function startRace(trackId = save.track, on = null) {
  if (!on) { if (net.active) { roomPanel(); return; } save.track = trackId; persist(); }
  setWorld(trackId); clearDyn();
  race = on ? C.createRace({ track: trackId, mode: on.mode, difficulty: on.difficulty, seed: on.seed, slots: on.slots, host: net.host })
    : C.createRace({ track: trackId, mode: save.mode, difficulty: save.difficulty, racer: save.racer, kart: save.kart, seed: (Date.now() & 0xffff) + 1 });
  sendT = 0;
  views = race.karts.map((k) => { const v = makeKart(k.racer, k.kart); v.spin = 0; v.hop = 0; dyn.add(v.group); return v; });
  boxViews = race.boxes.map((b) => { const m = makeItemBox(); m.position.set(b.x, 1.3, b.z); dyn.add(m); return m; });
  screen = 'race'; paused = false; overT = 0; shownResult = false; lastCount = 9; camA = race.player.h; acc = 0;
  $('lobby').hidden = true; $('panel').hidden = true; $('hud').hidden = false; $('touch').hidden = !touchMode;
  $('h-gauge-wrap').style.visibility = race.mode === 'item' ? 'hidden' : '';
  $('h-order').style.display = race.mode === 'time' ? 'none' : '';
  setText($('h-count'), ''); $('h-center').classList.remove('show');
  setTune(race.track.theme); setSound(save.sound); setMusic(save.music);
  canvas.focus();
}
function togglePause() {
  if (!race || race.state === 'over') return;
  if (race.online) { // 같이 할 때는 멈출 수 없다. 나가기만 고를 수 있다
    if (!$('panel').hidden) { $('panel').hidden = true; return; }
    panel(`<h2>같이 달리는 중</h2><p class="note">친구들이 달리고 있어서 멈출 수 없어.</p><div class="btns"><button class="main" data-a="close">계속 달리기</button><button data-a="quit">방 나가기</button></div>`);
    return;
  }
  paused = !paused;
  if (paused) {
    engineSound(0, false, false); skidSound(0);
    panel(`<h2>잠깐 멈춤</h2><p class="note">${race.track.name}</p><div class="btns"><button class="main" data-a="resume">계속 달리기</button><button data-a="retry">처음부터</button><button data-a="menu">나가기</button></div>`);
  } else $('panel').hidden = true;
}
function panel(html) {
  $('panel-box').innerHTML = html; $('panel').hidden = false;
  $('panel-box').querySelectorAll('button[data-a]').forEach((b) => b.addEventListener('click', () => {
    sfx.click(); const a = b.dataset.a;
    if (a === 'resume') togglePause(); else if (a === 'retry') startRace(); else if (a === 'menu') toLobby();
    else if (a === 'close') $('panel').hidden = true; else if (a === 'quit') { net.leave(); toLobby(); } else if (a === 'room') { toLobby(); roomPanel(); }
    else if (a === 'next') { const i = C.TRACKS.findIndex((t) => t.id === save.track); startRace(C.TRACKS[Math.min(i + 1, save.unlocked - 1)].id); }
  }));
}
let flashTimer = 0, rowTimer = 0;
function flash(text, sec = 2) { const el = $('h-center'); if (screen === 'lobby') { toast(text); return; } setText(el, text); el.classList.add('show'); msgT = sec; }
function toast(text) {
  let el = $('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:rgba(14,20,48,.9);padding:11px 20px;border-radius:16px;font-size:17px;z-index:5;pointer-events:none;transition:opacity .3s'; document.body.append(el); }
  el.textContent = text; el.style.opacity = '1'; clearTimeout(flashTimer); flashTimer = setTimeout(() => { el.style.opacity = '0'; }, 2200);
}

function showResult() {
  shownResult = true;
  const out = C.applyResult(save, race); persist();
  const P = race.player, time = race.mode === 'time';
  const title = out.retired ? '시간 초과…' : time ? '완주!' : P.rank === 1 ? '1등! 🏆' : P.rank <= 3 ? `${P.rank}등! 🎉` : `${P.rank}등`;
  if (!out.retired && (time || P.rank <= 3)) sfx.finish(); else sfx.lose();
  const rowsOf = () => C.results(race).map((r) => `<li class="${r.player ? 'me' : ''}"><span>${r.rank}</span><span>${r.emoji}</span><span>${r.name}${r.player ? ' (나)' : r.friend ? ' (친구)' : ''}</span><span>${r.time == null ? '달리는 중' : C.fmtTime(r.time)}</span></li>`).join('');
  const rows = rowsOf();
  const gains = [`<span><i class="c"></i>+${out.coins}</span>`, P.bestLap ? `<span>한 바퀴 ${C.fmtTime(P.bestLap)}</span>` : ''];
  if (out.newLap) gains.push('<span class="new">한 바퀴 새 기록!</span>');
  if (out.newTotal) gains.push('<span class="new">완주 새 기록!</span>');
  if (out.unlockedTrack) gains.push(`<span class="new">새 트랙: ${out.unlockedTrack}</span>`);
  const i = C.TRACKS.findIndex((t) => t.id === save.track), canNext = i + 1 < save.unlocked;
  const btns = race.online ? '<button class="main" data-a="room">방으로 돌아가기</button><button data-a="quit">방 나가기</button>'
    : `${canNext ? '<button class="main" data-a="next">다음 트랙</button>' : ''}<button class="${canNext ? '' : 'main'}" data-a="retry">다시 달리기</button><button data-a="menu">대기실</button>`;
  panel(`<h2>${title}</h2><p class="note">${race.track.name} · ${C.MODES.find((m) => m.id === race.mode).name}${race.online ? ' · 같이 하기' : ''}</p><ol id="r-rows">${rows}</ol><div class="gain">${gains.join('')}</div><div class="btns">${btns}</div>`);
  // 친구가 나중에 들어오면 순위표를 고쳐 그린다
  const mine = race; clearInterval(rowTimer);
  if (race.online) rowTimer = setInterval(() => { const el = $('r-rows'); if (!el || race !== mine) { clearInterval(rowTimer); return; } const h = rowsOf(); if (el.innerHTML !== h) el.innerHTML = h; }, 700);
}

// ── 같이 하기 (방 코드, 4명까지). 숫자만 주고받는다 ──
let sendT = 0, roomOpen = false;
const friends = new Map(); // 방 사람 번호 → { r: 선수 번호, c: 카트 번호 }
const myLook = () => ({ t: 'me', r: Math.max(0, C.RACERS.findIndex((x) => x.id === save.racer)), c: Math.max(0, C.KARTS.findIndex((x) => x.id === save.kart)) });
const KINDS = ['jelly', 'bee', 'snow', 'cloud'];
function onlineButton() {
  $('b-online').classList.toggle('live', net.active);
  $('b-online').textContent = net.active ? `👫 방 ${net.code} (${net.peers.length + 1}명)` : '👫 친구랑 같이 하기';
}
const net = new Net({
  status: (s, text) => {
    onlineButton();
    if (s === 'offline' || s === 'error') {
      friends.clear();
      if (race && race.online && race.karts.some((k) => !k.owned && !k.gone)) { // 연결이 끊기면 혼자 이어서 달린다
        for (const k of race.karts) if (k.kind === 'remote') C.dropPeer(race, k.peer);
        C.setHost(race, true); flash('연결이 끊겨서 혼자 달려요', 2.5);
      }
    }
    if (roomOpen) roomPanel(s === 'error' ? text : '');
  },
  join: () => { net.send(myLook()); onlineButton(); if (roomOpen) roomPanel(); },
  depart: (id) => {
    friends.delete(peerNum(id)); onlineButton();
    if (race && race.online && C.dropPeer(race, id)) flash('친구가 나갔어요', 2);
    if (roomOpen) roomPanel();
  },
  host: () => { if (race && race.online) C.setHost(race, net.host); if (roomOpen) roomPanel(); },
  message: (m, from) => {
    if (m.t === 'me') { if (Number.isInteger(m.r) && Number.isInteger(m.c)) friends.set(peerNum(from), { r: m.r, c: m.c }); if (roomOpen) roomPanel(); return; }
    if (m.t === 'start') { if (from === net.hostId) beginOnline(m); return; } // 방장이 정한 대로 새 판을 시작한다
    if (!race || !race.online) return;
    if (m.t === 's' && Array.isArray(m.k)) { for (const a of m.k.slice(0, 8)) C.applySnap(race, a, from, net.hostId); return; }
    const k = race.karts[m.k];
    if (!k || k.owned || k.gone || !(k.kind === 'remote' ? k.peer === from : from === net.hostId)) return;
    if (m.t === 'use') { const item = Object.keys(C.ITEMS)[m.it]; if (!item) return; if (m.sp) C.spawnItem(race, k.i, item, m.sp); race.events.push({ type: 'use', kart: k, item, remote: true }); }
    else if (m.t === 'gone' && Number.isFinite(m.id)) C.removeItem(race, m.id);
    else if (m.t === 'fx' && (m.e === 'hit' || m.e === 'block')) race.events.push({ type: m.e, kart: k, kind: KINDS[m.kd], by: Number.isFinite(m.by) ? m.by : -1, remote: true });
    else if (m.t === 'fin') C.applyFinish(race, k.i, m.time, m.best, from, net.hostId);
  },
});
function sendEvent(e) {
  const k = e.kart.i;
  if (e.type === 'use') net.send({ t: 'use', k, it: Object.keys(C.ITEMS).indexOf(e.item), sp: e.spawn ? e.spawn.map((v) => Math.round(v * 100) / 100) : null });
  else if (e.type === 'gone') net.send({ t: 'gone', k, id: e.id });
  else if (e.type === 'hit' || e.type === 'block') net.send({ t: 'fx', k, e: e.type, kd: KINDS.indexOf(e.kind), by: e.by ?? -1 });
  else if (e.type === 'finish') net.send({ t: 'fin', k, time: Math.round(e.kart.finishT * 1000) / 1000, best: Math.round(e.kart.bestLap * 1000) / 1000 });
}
function sendSnap() { const list = race.karts.filter((k) => k.owned && !k.gone).map(C.snapOf); if (list.length) net.send({ t: 's', k: list }); }
function hostStart() {
  if (!net.host || !net.live) return;
  const me = peerNum(net.id), mine = myLook();
  const humans = [[me, mine.r, mine.c], ...net.peers.map((id) => { const f = friends.get(peerNum(id)) || { r: 0, c: 0 }; return [peerNum(id), f.r, f.c]; })].sort((a, b) => a[0] - b[0]);
  const m = { t: 'start', tr: Math.max(0, C.TRACKS.findIndex((t) => t.id === save.track)), mo: save.mode === 'speed' ? 1 : 0, df: save.difficulty, seed: (Date.now() & 0xffff) + 1, hu: humans };
  net.send(m); beginOnline(m);
}
function beginOnline(m) {
  const track = C.TRACKS[m.tr]; if (!track || !Array.isArray(m.hu)) return;
  const me = peerNum(net.id); if (!m.hu.some((h) => Array.isArray(h) && h[0] === me)) return;
  roomOpen = false;
  startRace(track.id, { mode: m.mo === 1 ? 'speed' : 'item', difficulty: [0, 1, 2].includes(m.df) ? m.df : 0, seed: Number.isFinite(m.seed) ? m.seed : 1, slots: C.makeSlots(m.hu, me) });
}
function roomPanel(error = '') {
  roomOpen = true;
  const who = (f, label) => { const r = C.RACERS[f.r] || C.RACERS[0]; return `<li class="p${label === '나' ? ' me' : ''}"><span>${r.emoji}</span><span>${r.name}</span><span>${label}</span></li>`; };
  let html;
  if (!net.active) {
    html = `<h2>친구랑 같이 하기</h2><p class="note">${error || (net.state === 'connecting' ? '연결하는 중…' : '방을 만들고 코드를 친구에게 알려 줘. 4명까지 같이 달릴 수 있어.')}</p>
      <button class="wide" id="r-make">방 만들기</button><p class="or">친구가 만든 방에 들어가려면</p>
      <div class="join"><input id="r-code" maxlength="6" placeholder="방 코드" autocomplete="off" autocapitalize="characters" spellcheck="false"><button id="r-join">들어가기</button></div>
      <div class="btns"><button data-a="closeroom">닫기</button></div>`;
  } else {
    const track = C.TRACKS.find((t) => t.id === save.track), mode = save.mode === 'speed' ? '스피드전' : '아이템전';
    const list = [who(myLook(), net.host ? '나 (방장)' : '나').replace('class="p"', 'class="p me"'), ...net.peers.map((id) => who(friends.get(peerNum(id)) || { r: 0 }, id === net.hostId ? '방장' : '친구'))].join('');
    const racing = race && race.online && race.state !== 'over';
    html = `<h2>우리 방</h2><div class="code">${net.code}</div><p class="note">${error || net.text}</p><ol>${list}</ol>
      <p class="note">${net.host ? `${track.name} · ${mode} 로 달려. 바꾸려면 닫고 대기실에서 골라 줘.<br>빈자리는 컴퓨터가 채워.` : '방장이 출발을 누르면 시작해. 선수와 카트는 닫고 대기실에서 바꿀 수 있어.'}</p>
      <div class="btns">${net.host ? `<button class="main" id="r-go" ${net.live && !racing ? '' : 'disabled'}>${net.live ? '출발! 🏁' : '친구를 기다리는 중…'}</button>` : ''}<button data-a="closeroom">닫기</button><button data-a="leave">방 나가기</button></div>`;
  }
  panel(html);
  const on = (id, f) => { const el = $(id); if (el) el.addEventListener('click', () => { unlock(); sfx.click(); f(); }); };
  on('r-make', () => { net.create(); roomPanel(); });
  on('r-join', () => { const code = $('r-code').value.trim(); if (code.length < 6) { roomPanel('방 코드는 6글자야.'); return; } net.join(code); roomPanel(); });
  on('r-go', hostStart);
  $('panel-box').querySelectorAll('button[data-a=closeroom]').forEach((b) => b.addEventListener('click', () => { roomOpen = false; $('panel').hidden = true; }));
  $('panel-box').querySelectorAll('button[data-a=leave]').forEach((b) => b.addEventListener('click', () => { net.leave(); roomPanel(); }));
  const input = $('r-code'); if (input) input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') $('r-join').click(); });
}

// ── 작은 지도 ──
function makeMini(T) {
  const W = 170; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < T.n; i++) { x0 = Math.min(x0, T.x[i]); x1 = Math.max(x1, T.x[i]); z0 = Math.min(z0, T.z[i]); z1 = Math.max(z1, T.z[i]); }
  const s = (W - 26) / Math.max(x1 - x0, z1 - z0), ox = W / 2 + ((x0 + x1) / 2) * s, oy = W / 2 + ((z0 + z1) / 2) * s;
  const bg = document.createElement('canvas'); bg.width = bg.height = W; const g = bg.getContext('2d');
  g.lineJoin = 'round'; g.beginPath(); for (let i = 0; i < T.n; i += 2) { const px = ox - T.x[i] * s, py = oy - T.z[i] * s; if (i) g.lineTo(px, py); else g.moveTo(px, py); } g.closePath();
  g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 7; g.stroke(); g.strokeStyle = '#2b3350'; g.lineWidth = 4; g.stroke();
  g.fillStyle = '#fff'; g.fillRect(ox - T.x[0] * s - 2, oy - T.z[0] * s - 5, 4, 10);
  return { bg, px: (x) => ox - x * s, py: (z) => oy - z * s };
}
const miniCtx = $('minimap').getContext('2d');
function drawMini() {
  miniCtx.clearRect(0, 0, 170, 170); miniCtx.drawImage(mini.bg, 0, 0);
  for (const k of race.order.slice().reverse()) {
    if (k.gone) continue;
    miniCtx.beginPath(); miniCtx.arc(mini.px(k.x), mini.py(k.z), k.player ? 6 : 4, 0, 7);
    miniCtx.fillStyle = k.player ? '#ffd23e' : '#' + k.racer.color.toString(16).padStart(6, '0'); miniCtx.fill();
    miniCtx.lineWidth = k.player ? 2.5 : 1; miniCtx.strokeStyle = k.player ? '#fff' : 'rgba(0,0,0,.6)'; miniCtx.stroke();
  }
}

// ── 일어난 일 처리 (소리, 글자) ──
const KIND = { jelly: '미끌 젤리', bee: '꿀벌', snow: '눈덩이', cloud: '번개' };
function handleEvents() {
  const P = race.player;
  for (const e of race.events) {
    if (race.online && !e.remote && e.kart.owned) sendEvent(e);
    const me = e.kart === P, near = me || Math.hypot(e.kart.x - P.x, e.kart.z - P.z) < 40;
    switch (e.type) {
      case 'go': sfx.go(); setText($('h-count'), '출발!'); pop(); setTimeout(() => { if (race && race.state !== 'countdown') setText($('h-count'), ''); }, 900); break;
      case 'startboost': if (me) { sfx.boost(); flash('출발 부스터! 🚀', 1.2); } break;
      case 'turbo': if (me) sfx.turbo(e.lv); views[e.kart.i].hop = 0.16; break;
      case 'drift': views[e.kart.i].hop = 0.28; break;
      case 'charged': if (me) { sfx.charged(); flash('부스터 충전! Ctrl 로 써요', 1.2); } break;
      case 'box': if (me) sfx.box(); break;
      case 'use':
        if (me) { if (e.item === 'boost') sfx.boost(); else sfx.use(); }
        if (e.item === 'cloud') sfx.thunder();
        break;
      case 'hit':
        if (near) sfx.hit();
        if (me) { shake = 0.5; flash(`앗! ${KIND[e.kind] || '아이템'}에 맞았어요`, 1.4); }
        else if (e.by === P.i) flash(`${e.kart.racer.name}에게 명중! 🎯`, 1.4);
        burst(e.kart.x, 1, e.kart.z, 0xffe14d, 26);
        break;
      case 'block': if (near) sfx.block(); if (me) flash('방패로 막았어요! 🫧', 1.2); burst(e.kart.x, 1, e.kart.z, 0x8fe9ff, 20); break;
      case 'wall': if (me) { sfx.wall(); shake = Math.min(0.4, e.power / 60); } break;
      case 'bump': if (me) sfx.wall(); break;
      case 'lap':
        if (me && e.lap < race.laps) { sfx.lap(); flash(e.lap === race.laps - 1 ? `마지막 바퀴! (${C.fmtTime(e.time)})` : `${e.lap + 1}바퀴째! (${C.fmtTime(e.time)})`, 2); }
        break;
      case 'finish': if (me) flash('골인! 🏁', 2.5); break;
      case 'reset': if (me) flash('트랙으로 돌아왔어요', 1); break;
      default: break;
    }
  }
  race.events.length = 0;
}
function pop() { const el = $('h-count'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
function burst(x, y, z, color, n) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 3 + Math.random() * 7; particles.emit(x, y, z, Math.cos(a) * s, 2 + Math.random() * 6, Math.sin(a) * s, color, 0.5, 0.6 + Math.random() * 0.4, 0, 12); } }

// ── 화면에 그릴 것 맞추기 ──
const DRIFT_COL = [0xd8dde8, 0x4db8ff, 0xff9a2e, 0xd45cff];
const ROLL = Object.values(C.ITEMS).map((i) => i.emoji);
function syncViews(dt) {
  const T = race.track;
  race.karts.forEach((k, i) => {
    const v = views[i];
    v.hop = Math.max(0, v.hop - dt * 0.9);
    v.spin = k.spinT > 0 ? v.spin + dt * 14 : 0;
    v.group.position.set(k.x, Math.sin(Math.min(1, v.hop / 0.28) * Math.PI) * 0.35, k.z);
    v.group.rotation.y = k.h + v.spin;
    const lean = k.drifting ? k.driftDir * 0.13 : k.steer * 0.05;
    v.body.rotation.z += (lean - v.body.rotation.z) * Math.min(1, 10 * dt);
    v.body.rotation.x = -clamp01((k.boostT > 0 ? 0.06 : 0) + (k.turboT > 0 ? 0.03 : 0));
    v.body.position.y = Math.sin(clock * 38 + i) * 0.012 * Math.min(1, Math.abs(k.s) / 20);
    for (const w of v.wheels) w.rotation.x += (k.s * dt) / 0.42;
    for (const f of v.front) f.rotation.y = -k.steer * 0.42;
    v.head.rotation.y = -k.steer * 0.35;
    const fl = k.boostT > 0 ? 1.5 : k.turboT > 0 ? 0.9 : 0;
    for (const f of v.flames) { f.visible = fl > 0; if (fl) { f.scale.set(1, 1, fl * (0.8 + Math.random() * 0.45)); f.material.color.setHex(k.boostT > 0 ? 0xffa23e : 0x66d9ff); } }
    v.shield.visible = k.shieldT > 0; if (v.shield.visible) v.shield.scale.setScalar(1 + Math.sin(clock * 6) * 0.04);
    v.cloud.visible = k.slowT > 0;
    v.group.visible = !k.gone && !(k.safeT > 0 && k.spinT <= 0 && Math.floor(clock * 14) % 2 === 0);
    if (k.gone) return;
    // 반짝이
    const sh = Math.sin(k.h), ch = Math.cos(k.h);
    const rear = (lx) => [k.x + lx * ch - 0.95 * sh, k.z - lx * sh - 0.95 * ch];
    if (k.drifting && Math.random() < 0.9) {
      const lv = k.driftT >= 2.4 ? 3 : k.driftT >= 1.4 ? 2 : k.driftT >= 0.7 ? 1 : 0;
      for (const lx of [-1, 1]) { const [x, z] = rear(lx);
        if (lv) particles.emit(x, 0.15, z, (Math.random() - 0.5) * 5 - sh * 3, 2 + Math.random() * 4, (Math.random() - 0.5) * 5 - ch * 3, DRIFT_COL[lv], 0.3, 0.35, 0, 14);
        particles.emit(x, 0.2, z, (Math.random() - 0.5) * 1.5, 0.8, (Math.random() - 0.5) * 1.5, 0xffffff, 0.7, 0.55, 2.4, 0, 0.35);
      }
    }
    if (fl > 0) for (const lx of [-0.36, 0.36]) { const [x, z] = [k.x + lx * ch - 2.1 * sh, k.z - lx * sh - 2.1 * ch]; particles.emit(x, 0.5, z, -sh * 6 + (Math.random() - 0.5) * 2, Math.random() * 1.5, -ch * 6 + (Math.random() - 0.5) * 2, k.boostT > 0 ? 0xffb347 : 0x7fdcff, 0.6, 0.3, -1.2); }
    if (k.offroad && Math.abs(k.s) > 8 && Math.random() < 0.5) { const [x, z] = rear(Math.random() < 0.5 ? -1 : 1); particles.emit(x, 0.2, z, (Math.random() - 0.5) * 2, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 2, world.theme.shoulder, 0.6, 0.6, 1.5, 3, 0.7); }
  });
  race.boxes.forEach((b, i) => { const m = boxViews[i]; m.visible = b.off <= 0; m.rotation.y = clock * 1.6 + i; m.rotation.x = clock * 0.9; m.position.y = 1.35 + Math.sin(clock * 3 + i) * 0.18; });
  syncMap(trapViews, race.traps, () => makeTrap(), (m, t) => { m.position.set(t.x, 0, t.z); m.scale.setScalar(1 + Math.sin(clock * 5 + t.id) * 0.06); });
  syncMap(shotViews, race.shots, (s) => makeShot(s.type), (m, s) => {
    if (s.type === 'cloud') { m.position.set(s.x, 0, s.z); m.children[3].visible = s.life < 0.25; }
    else { const p = C.trackPos(T, s.s, s.d); m.position.set(s.x, s.type === 'bee' ? 1.3 + Math.sin(clock * 20) * 0.15 : 0.75, s.z); m.rotation.y = p.h; if (s.type === 'snow') m.rotation.x = clock * 12; }
  });
}
function syncMap(map, list, make, place) {
  const seen = new Set();
  for (const it of list) { seen.add(it.id); let m = map.get(it.id); if (!m) { m = make(it); map.set(it.id, m); dyn.add(m); } place(m, it); }
  for (const [id, m] of map) if (!seen.has(id)) { dyn.remove(m); map.delete(id); }
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function updateCamera(dt) {
  const k = race.player, target = k.mv + k.slip * 0.35;
  camA += C.wrap(target - camA) * Math.min(1, (k.spinT > 0 ? 2 : 7) * dt);
  const boost = k.boostT > 0 ? 1 : k.turboT > 0 ? 0.5 : 0, narrow = camera.aspect < 1;
  camFov += ((narrow ? 74 : 62) + boost * 13 + clamp01(k.s / 40) * 5 - camFov) * Math.min(1, 4 * dt);
  camera.fov = camFov; camera.updateProjectionMatrix();
  const dist = (narrow ? 8.6 : 7.4) - boost * 0.9, sx = Math.sin(camA), cz = Math.cos(camA);
  shake = Math.max(0, shake - dt * 1.6);
  const jx = (Math.random() - 0.5) * shake, jy = (Math.random() - 0.5) * shake;
  camera.position.set(k.x - sx * dist + jx, 3.5 + jy, k.z - cz * dist);
  camera.lookAt(k.x + sx * 5, 1.2, k.z + cz * 5);
}

function updateHud(dt) {
  const k = race.player;
  setText($('h-lap'), `${Math.min(race.laps, Math.max(0, k.lap) + 1)}/${race.laps}`);
  setText($('h-time'), C.fmtTime(k.finished ? k.finishT : race.t));
  const rec = save.best[race.track.id];
  setText($('h-best'), C.fmtTime(k.bestLap || (rec && rec.lap) || null));
  $('h-rank').style.visibility = race.mode === 'time' ? 'hidden' : '';
  setText($('h-rank').firstElementChild, String(k.rank)); setText($('h-rank').lastElementChild, '/' + race.karts.filter((o) => !o.gone).length);
  setText($('h-speed'), String(Math.round(Math.abs(k.s) * 4.6)));
  $('h-gauge').style.width = (k.gauge * 100).toFixed(1) + '%';
  const slots = $('h-items').children;
  for (let i = 0; i < 2; i++) {
    const it = k.items[i], rolling = i === 0 && k.rollT > 0;
    setText(slots[i], it ? (rolling ? ROLL[Math.floor(clock * 14) % ROLL.length] : C.ITEMS[it].emoji) : '');
    slots[i].classList.toggle('has', !!it && !rolling);
  }
  if (race.mode !== 'time') {
    const ol = $('h-order'), html = race.order.filter((r) => !r.gone).map((r) => `<li class="${r.player ? 'me' : ''}"><i>${r.rank}</i>${r.racer.emoji} ${r.racer.name}${r.kind === 'remote' ? ' 👤' : ''}</li>`).join('');
    if (ol.dataset.h !== html) { ol.innerHTML = html; ol.dataset.h = html; }
  }
  $('h-wrong').hidden = !(k.wrong && !k.finished);
  $('speedlines').classList.toggle('on', k.boostT > 0 || k.turboT > 0.2);
  if (race.state === 'countdown') {
    const c = Math.ceil(race.countdown);
    if (c !== lastCount) { lastCount = c; if (c <= 3 && c >= 1) { setText($('h-count'), String(c)); pop(); sfx.beep(); } else setText($('h-count'), '준비!'); }
  }
  if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('h-center').classList.remove('show'); }
  drawMini();
}

// ── 매 순간 ──
let last = performance.now(), acc = 0;
const STEP = 1 / 60;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now; clock += dt;
  if (screen === 'race' && race) {
    if (!paused) {
      acc += dt; let n = 0;
      while (acc >= STEP && n < 6) {
        const inp = readInput(); useEdge = false;
        C.stepRace(race, STEP, inp); // 아이템 쓰기는 누른 그 한 걸음에만 전달
        handleEvents(); acc -= STEP; n++;
        if (race.online) { sendT += STEP; if (sendT >= 1 / 12) { sendT = 0; sendSnap(); } }
      }
      if (n === 6) acc = 0;
      syncViews(dt); particles.update(dt); updateHud(dt);
      const k = race.player;
      engineSound(clamp01(Math.abs(k.s) / 46), k.boostT > 0 || k.turboT > 0, race.state !== 'over' || overT < 2);
      skidSound(k.drifting ? 0.6 + Math.min(0.4, Math.abs(k.slip)) : k.spinT > 0 ? 0.8 : 0);
      if (race.state === 'over') { overT += dt; if (overT > 2.4 && !shownResult) { engineSound(0, false, false); skidSound(0); showResult(); } }
    }
    updateCamera(paused ? 0 : dt);
    world.update(clock, race.player.x, race.player.z);
  } else if (world) {
    // 대기실: 출발선에 선 내 카트 둘레를 천천히 돈다
    const T = C.buildTrack(worldId), p = C.trackPos(T, 6, 0), a = clock * 0.25 + T.h[0] + 2.4;
    camera.fov = camera.aspect < 1 ? 70 : 50; camera.updateProjectionMatrix();
    camera.position.set(p.x + Math.sin(a) * 9, 3.4, p.z + Math.cos(a) * 9); camera.lookAt(p.x, 1, p.z);
    if (lobbyKart) lobbyKart.head.rotation.y = Math.sin(clock * 1.3) * 0.5;
    world.update(clock, p.x, p.z);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

setSound(save.sound); setMusic(save.music);
toLobby();
requestAnimationFrame(frame);
if (debug) window.__kart = { C, net, friends, get race() { return race; }, get save() { return save; }, set save(s) { save = C.fixSave(s); persist(); drawLobby(); }, get screen() { return screen; }, startRace, toLobby, keys, get shownResult() { return shownResult; } };
