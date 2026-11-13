// 뚱뚱해지기 · 먹방 타이쿤. 먹기는 클릭, 상호작용은 E.
import * as THREE from 'three';
import './style.css';
import * as C from './core.mjs';
import { Character } from './src/character.js';
import { makeFood, mat, part } from './src/foods.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildWorld, LAYOUT, LIMIT, redrawLabels, makeLabel } from './src/world.js';
import { Net } from './src/net.js';
import { sfx, unlock, setSound, setMusic, setTune } from './src/audio.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const setText = (el, t) => { if (el.textContent !== t) el.textContent = t; };

// ── 저장 ──
function load() { try { return C.fixSave(JSON.parse(localStorage.getItem(C.SAVE_KEY))); } catch { return C.newSave(); } }
let save = load();
function persist() { try { localStorage.setItem(C.SAVE_KEY, JSON.stringify(save)); } catch { /* 저장을 못 해도 게임은 계속 */ } }
const today = () => C.dayKey();
const yesterday = () => C.dayKey(new Date(Date.now() - 864e5));

// ── 3D 준비 ──
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);
const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 24, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
  vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying float h; void main(){ gl_FragColor = vec4(mix(bottom, top, smoothstep(-0.05, 0.75, h)), 1.0); }',
}));
sky.renderOrder = -10; scene.add(sky);
const hemi = new THREE.HemisphereLight(); scene.add(hemi);
const sun = new THREE.DirectionalLight(); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 140 });
scene.add(sun, sun.target);
scene.fog = new THREE.Fog('#ffffff', 50, 200);

const hero = new Character(); scene.add(hero.root);
const pos = new THREE.Vector3(LAYOUT.spawn[0], 0, LAYOUT.spawn[1]);
let facing = Math.PI, camYaw = 0, camPitch = 0.36, zoom = 1, mode = 'menu', clock = 0, moving = false;

// 목표 화살표
const arrow = new THREE.Group();
arrow.add(part(new THREE.ConeGeometry(0.55, 1.1, 4), mat('#ffd43b', { emissive: '#ffb300', glow: 0.9 }), 0, 0, 0)); arrow.children[0].rotation.x = Math.PI; arrow.children[0].castShadow = false;
scene.add(arrow);

// 로봇과 드론
const robots = new THREE.Group(); scene.add(robots);
function makeRobot(i) {
  const g = new THREE.Group(), c = ['#4dabf7', '#ff8fb3', '#7bff8a', '#ffd43b'][i % 4];
  g.add(part(new THREE.BoxGeometry(0.5, 0.45, 0.4), mat('#f1f3f5', { metal: 0.5, rough: 0.35 }), 0, 0, 0), part(new THREE.BoxGeometry(0.36, 0.16, 0.05), mat('#20232a'), 0, 0.04, 0.2),
    part(new THREE.SphereGeometry(0.04, 8, 6), mat(c, { emissive: c, glow: 2 }), 0.08, 0.04, 0.23), part(new THREE.SphereGeometry(0.04, 8, 6), mat(c, { emissive: c, glow: 2 }), -0.08, 0.04, 0.23),
    part(new THREE.CylinderGeometry(0.015, 0.015, 0.2, 5), mat('#adb5bd'), 0, 0.32, 0), part(new THREE.SphereGeometry(0.06, 8, 6), mat(c, { emissive: c, glow: 1.5 }), 0, 0.44, 0),
    part(new THREE.CapsuleGeometry(0.04, 0.3, 3, 6), mat('#adb5bd', { metal: 0.5 }), 0, -0.05, 0.36), part(new THREE.SphereGeometry(0.09, 8, 6), mat(c), 0, -0.05, 0.56));
  g.children[6].rotation.x = Math.PI / 2;
  return g;
}
const drone = new THREE.Group();
drone.add(part(new THREE.SphereGeometry(0.5, 20, 10), mat('#ced4da', { metal: 0.7, rough: 0.25 }), 0, 0, 0, [1.6, 0.3, 1.6]), part(new THREE.SphereGeometry(0.36, 16, 10, 0, 6.3, 0, 1.6), new THREE.MeshStandardMaterial({ color: '#9be7ff', transparent: true, opacity: 0.7, roughness: 0.1 }), 0, 0.05, 0),
  part(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 16), mat('#fff8ea'), 0, -0.3, 0));
for (let i = 0; i < 6; i += 1) drone.add(part(new THREE.SphereGeometry(0.06, 8, 6), mat('#7bff8a', { emissive: '#7bff8a', glow: 2 }), Math.sin(i * 1.047) * 0.68, -0.03, Math.cos(i * 1.047) * 0.68));
scene.add(drone);

// 부스러기
const crumbs = Array.from({ length: 28 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 4), new THREE.MeshBasicMaterial({ color: '#ffd9a0' })); m.visible = false; m.userData = { v: new THREE.Vector3(), life: 0 }; scene.add(m); return m; });
let crumbI = 0;
function burst(n, color) {
  const o = new THREE.Vector3(Math.sin(facing) * hero.radius * 0.9, hero.headY - 0.1 * hero.headS, Math.cos(facing) * hero.radius * 0.9).add(pos);
  for (let i = 0; i < n; i += 1) { const m = crumbs[crumbI = (crumbI + 1) % crumbs.length]; m.visible = true; m.position.copy(o); m.material.color.set(color); m.scale.setScalar(0.7 + Math.random() * hero.shownFat * 0.7); m.userData.life = 0.6; m.userData.v.set((Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4); }
}

// ── 월드 ──
const worlds = {}; let world = null;
function enterWorld(id, spawn = true) {
  if (world) scene.remove(world.root);
  world = worlds[id] || (worlds[id] = buildWorld(id)); scene.add(world.root);
  const th = world.theme;
  sky.material.uniforms.top.value.set(th.top); sky.material.uniforms.bottom.value.set(th.bottom);
  scene.fog.color.set(th.fog); scene.fog.near = th.fogNear; scene.fog.far = th.fogFar;
  hemi.color.set(th.hemiSky); hemi.groundColor.set(th.hemiGround); hemi.intensity = th.hemiI;
  sun.color.set(th.sun); sun.intensity = th.sunI; scene.environmentIntensity = th.env; renderer.toneMappingExposure = th.exposure;
  save.world = id; setTune(id);
  if (spawn) { pos.set(LAYOUT.spawn[0], 0, LAYOUT.spawn[1]); facing = Math.PI; camYaw = 0; }
  refresh();
}

// ── 화면 글씨 ──
let handId = null;
function refreshHand() {
  const id = save.plate > 0 ? C.STAGES[save.plateStage].id : null;
  if (id !== handId) { handId = id; hero.setFood(id ? makeFood(id, 0.62) : null); }
  if (id) hero.foodScale = 0.55 + 0.45 * (((save.plate - 1) % 4) + 1) / 4;
}
function refresh() {
  if (!world) return;
  const best = C.bestStage(save);
  world.tables.forEach((t) => {
    const s = t.stage, locked = s.index > best, now = s.index === save.stage;
    t.label.userData.set(`${s.level}레벨\n${s.emoji} ${s.name}`, { bg: locked ? 'rgba(210,205,220,.95)' : now ? '#ffe066' : 'rgba(255,255,255,.94)', color: locked ? '#8a8499' : '#2a2140' });
    t.lock.visible = locked;
  });
  world.pads.forEach((p) => {
    const lv = save.up[p.up.id], cost = C.upgradeCost(save, p.up.id), max = cost === Infinity;
    p.label.userData.set(`${p.up.name} ${p.up.max > 1 ? `Lv.${lv}` : (max ? '✔' : '')}\n${max ? '끝까지 올렸어요' : `🪙 ${C.fmtNum(cost)}`}`, { bg: max ? 'rgba(210,205,220,.95)' : save.coins >= cost ? '#b9ffb0' : 'rgba(255,255,255,.94)' });
  });
  const open = C.canEnterWorld(save, 2);
  world.portal.open = open;
  world.portal.label.userData.set(open ? '🚪 월드 문\n들어가면 월드를 골라요' : '🔒 월드 문\n10레벨을 깨면 열려요', { bg: open ? '#e5dbff' : 'rgba(210,205,220,.95)' });
  refreshHand();
  const n = Math.min(8, save.up.robot);
  while (robots.children.length < n) robots.add(makeRobot(robots.children.length));
  drone.visible = !!save.up.drone;
  const sk = C.SKINS.find((k) => k.id === save.skin); if (hero.skinId !== sk.id) { hero.skinId = sk.id; hero.star = null; hero.setSkin(sk); }
  const dr = C.dailyReady(save, today()), tr = C.anyTimeReady(save);
  document.querySelectorAll('#b-daily .dot, #m-daily .dot').forEach((d) => { d.hidden = !dr; });
  document.querySelectorAll('#b-time .dot, #m-time .dot').forEach((d) => { d.hidden = !tr; });
  $('b-sound').textContent = save.sound ? '🔊' : '🔇';
  setText($('m-record'), `지금 몸무게 ${C.fmtKg(save.weight)} · ${C.allDone(save) ? '🏆 우주 기록 달성!' : `월드 ${C.stageOf(save).world} ${C.stageOf(save).level}레벨`}`);
}
function hud() {
  const st = C.stageOf(save), done = C.allDone(save);
  setText($('h-world'), `월드 ${save.world}`);
  setText($('h-stage'), done ? '🏆 우주 기록 보유자' : `${st.level}레벨 ${st.emoji} ${st.name}`);
  setText($('h-weight'), C.fmtKg(save.weight));
  setText($('h-coins'), C.fmtNum(save.coins));
  const p = C.levelProgress(save), full = C.canLevelUp(save);
  $('h-bar').style.width = `${p * 100}%`; $('h-bar').parentElement.classList.toggle('full', full);
  setText($('h-need'), done ? '계속 먹어서 기록을 늘려요!' : full ? '저울로 가서 레벨 업!' : `다음 레벨까지 ${C.fmtKg(st.target - save.weight)}`);
  const ps = C.STAGES[save.plateStage];
  setText($('h-plate'), save.plate > 0 ? `🍽️ ${ps.emoji} ${ps.name} ${save.plate}개` : '🍽️ 쟁반이 비었어요');
  $('h-plate').classList.toggle('empty', save.plate <= 0 && !save.up.drone);
}
let toastT = 0;
function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('on'); toastT = 2.2; }
let bigT = 0;
function big(t, sec = 2.4) { const e = $('big'); e.textContent = t; e.classList.add('on'); bigT = sec; }
const v3 = new THREE.Vector3();
function float(text, cls = '') {
  const box = $('floats'); if (box.children.length > 24) return;
  v3.set(pos.x, hero.height + 0.2, pos.z).project(camera);
  const s = document.createElement('span'); s.className = cls; s.textContent = text;
  s.style.left = `${(v3.x * 0.5 + 0.5) * innerWidth + (Math.random() - 0.5) * 120}px`; s.style.top = `${(-v3.y * 0.5 + 0.5) * innerHeight + (Math.random() - 0.5) * 30}px`;
  box.appendChild(s); setTimeout(() => s.remove(), 800);
}
function confetti(n = 70) {
  const box = $('confetti');
  for (let i = 0; i < n; i += 1) { const c = document.createElement('i'); c.style.left = `${Math.random() * 100}%`; c.style.background = ['#ff5e7e', '#ffd43b', '#3fd0ff', '#7bff8a', '#b197fc', '#ff9f43'][i % 6]; c.style.animationDuration = `${1.6 + Math.random() * 1.8}s`; c.style.animationDelay = `${Math.random() * 0.5}s`; box.appendChild(c); setTimeout(() => c.remove(), 4200); }
}

// ── 발전과제 ──
const advQueue = []; let advT = 0;
function checkAdv() {
  const got = C.checkAdvancements(save);
  if (got.length) { advQueue.push(...got); persist(); if (panelKind === 'adv') drawPanel(); }
}
function advTick(dt) {
  if (advT > 0) { advT -= dt; if (advT <= 0) $('adv-pop').classList.remove('on'); return; }
  if (advT > -0.4) { advT -= dt; return; }
  const a = advQueue.shift(); if (!a) return;
  $('adv-ico').textContent = a.emoji; $('adv-name').textContent = a.name; $('adv-coin').textContent = `+${C.fmtNum(a.coin)}코인`;
  $('adv-pop').classList.add('on'); advT = 3; sfx.level();
}

// ── 같이 하기 (방 코드) ──
const remotes = new Map();
function dropRemote(id) { const r = remotes.get(id); if (r) { scene.remove(r.ch.root); remotes.delete(id); } }
function remoteFor(id) {
  let r = remotes.get(id);
  if (!r) {
    const ch = new Character(), label = makeLabel(`친구 ${C.peerNumber(id)}`, { width: 2.2, bg: '#b9ffb0' });
    ch.root.add(label); scene.add(ch.root);
    r = { ch, label, st: null, x: 0, z: 0, f: 0, food: -2, skin: -1, n: -1, fresh: true };
    remotes.set(id, r);
  }
  return r;
}
const net = new Net({
  status: (s) => {
    if (s === 'offline' || s === 'error') [...remotes.keys()].forEach(dropRemote);
    document.querySelectorAll('#b-friends .dot, #m-friends .dot').forEach((d) => { d.hidden = !net.active; });
    if (panelKind === 'friends') drawPanel();
  },
  join: (id) => { toast(`👫 ${C.peerNumber(id)}번 친구가 들어왔어요!`); sfx.coin(); sendState(true); if (panelKind === 'friends') drawPanel(); },
  depart: (id) => { if (id) { dropRemote(id); toast(`${C.peerNumber(id)}번 친구가 나갔어요`); } if (panelKind === 'friends') drawPanel(); },
  message: (data, from) => {
    if (data.t === 's') {
      const st = C.cleanPeer(data); if (!st) return;
      remoteFor(from).st = st;
      if (mode === 'play' && !save.friend) { save.friend = true; checkAdv(); }
    } else if (data.t === 'up' && remotes.has(from)) {
      const s = C.STAGES[Math.floor(Number(data.st))]; remotes.get(from).ch.cheer = 2.5;
      if (Number.isInteger(data.wc) && C.WORLDS[data.wc - 1]) toast(`🏆 ${C.peerNumber(from)}번 친구가 '${C.WORLDS[data.wc - 1].record}' 기록을 세웠어요!`);
      else if (s) toast(`🎉 ${C.peerNumber(from)}번 친구가 ${s.level}레벨(${s.name})이 됐어요!`);
    }
  },
});
let sendT = 0;
function sendState(force) {
  if (!net.live || (!force && mode !== 'play')) return;
  net.send({ t: 's', p: [Math.round(pos.x * 100) / 100, Math.round(pos.z * 100) / 100, Math.round(facing * 100) / 100], w: save.weight, wd: save.world, sk: C.SKINS.findIndex((k) => k.id === save.skin), fd: save.plate > 0 ? save.plateStage : -1, n: save.bites, m: moving ? 1 : 0, st: save.stage });
}
function updateRemotes(dt) {
  for (const r of remotes.values()) {
    const st = r.st, ch = r.ch;
    ch.root.visible = !!st && st.world === save.world;
    if (!st) continue;
    if (r.fresh) { r.x = st.x; r.z = st.z; r.f = st.f; r.fresh = false; }
    const k = Math.min(1, dt * 10); r.x += (st.x - r.x) * k; r.z += (st.z - r.z) * k;
    const d = Math.atan2(Math.sin(st.f - r.f), Math.cos(st.f - r.f)); r.f += d * k;
    if (st.skin !== r.skin) { r.skin = st.skin; ch.star = null; ch.setSkin(C.SKINS[st.skin]); }
    if (st.food !== r.food) { r.food = st.food; ch.setFood(st.food >= 0 ? makeFood(C.STAGES[st.food].id, 0.62) : null); }
    if (r.n >= 0 && st.bites > r.n && st.food >= 0) ch.bite();
    r.n = st.bites;
    ch.setFat(C.fatScale(st.weight)); ch.root.position.x = r.x; ch.root.position.z = r.z;
    ch.update(dt, clock, st.moving); ch.root.rotation.y = r.f;
    r.label.position.y = ch.height + 0.7; r.label.material.opacity = mode === 'menu' ? 0 : 1;
  }
}

// ── 먹기 (클릭) ──
let lastBite = 0, lastDeny = 0;
function doBite() {
  if (mode !== 'play' || overlayOpen()) return;
  const now = performance.now(); if (now - lastBite < 70) return; lastBite = now;
  const r = C.bite(save);
  if (r && net.live) { const extra = Math.max(1, Math.round(r.coin * C.FRIEND_BONUS)); save.coins += extra; r.coin += extra; }
  if (!r) {
    if (now - lastDeny > 900) { lastDeny = now; sfx.deny(); toast('쟁반이 비었어요! 음식 테이블로 가서 E를 눌러요'); }
    return;
  }
  hero.bite(); sfx.bite(); float(`+${C.fmtKg(r.kg)}`); if (Math.random() < 0.34) float(`+${C.fmtNum(r.coin)}코인`, 'c');
  burst(3, ['#ffd9a0', '#ff9a1f', '#e8262d', '#c8281e'][save.plateStage % 4]);
  refreshHand();
  if (save.plate <= 0 && !save.up.drone) { sfx.plate(); toast('다 먹었어요! 테이블에서 E로 또 받아요'); }
}

// ── 상호작용 (E) ──
let near = null;
function promptFor(it) {
  if (it.type === 'table') return it.stage.index > C.bestStage(save) ? [`🔒 ${it.stage.level}레벨이 되면 먹을 수 있어요`, false] : [`${it.stage.emoji} ${it.stage.name} 받기 (${C.traySize(save)}개)`, true];
  if (it.type === 'pad') { const c = C.upgradeCost(save, it.up.id); return c === Infinity ? [`${it.up.name}: 끝까지 올렸어요`, false] : [`${it.up.emoji} ${it.up.name} 사기 · ${C.fmtNum(c)}코인`, save.coins >= c]; }
  if (it.type === 'scale') return C.allDone(save) ? ['🏆 기록 인증서 보기', true] : C.canLevelUp(save) ? ['⚖️ 몸무게 재고 레벨 업!', true] : ['⚖️ 몸무게 재기', true];
  return C.canEnterWorld(save, 2) ? ['🚪 문 안으로 들어가면 월드를 골라요', true] : ['🔒 10레벨 마라탕 100판을 깨면 열려요', false];
}
function interact() {
  if (mode !== 'play' || overlayOpen() || !near) return;
  const it = near;
  if (it.type === 'table') {
    if (!C.fillPlate(save, it.stage.index)) { sfx.deny(); toast(`${it.stage.level}레벨이 되어야 ${it.stage.name}을(를) 먹을 수 있어요`); return; }
    sfx.plate(); toast(`${it.stage.emoji} ${it.stage.name} ${save.plate}개를 받았어요. 클릭해서 먹어요!`);
  } else if (it.type === 'pad') {
    const c = C.upgradeCost(save, it.up.id);
    if (!C.buyUpgrade(save, it.up.id)) { sfx.deny(); toast(c === Infinity ? '이미 끝까지 올렸어요' : `코인이 ${C.fmtNum(c - save.coins)}개 모자라요`); return; }
    sfx.buy(); hero.cheer = 0.7; toast(`${it.up.emoji} ${it.up.name}! ${it.up.desc}`);
  } else if (it.type === 'scale') {
    if (C.allDone(save)) { showCert(C.WORLD_COUNT, false); return; }
    const r = C.levelUp(save);
    if (!r) { sfx.click(); const st = C.stageOf(save); toast(`심사위원: "지금 ${C.fmtKg(save.weight)}! ${C.fmtKg(st.target - save.weight)} 더 쪄서 오세요."`); return; }
    hero.cheer = 2.6; confetti(); float(`+${C.fmtNum(r.bonus)}코인`, 'c');
    net.send({ t: 'up', st: save.stage, wc: r.worldClear || 0 });
    if (r.worldClear) { sfx.record(); setTimeout(() => showCert(r.worldClear, true), 900); } else { sfx.level(); big(`레벨 업!\n${r.next.level}레벨 ${r.next.emoji} ${r.next.name}`); }
  } else if (it.type === 'portal') {
    if (!C.canEnterWorld(save, 2)) { sfx.deny(); toast('월드 1의 10레벨을 깨면 문이 열려요'); return; }
    openPanel('worlds'); return;
  }
  refresh(); checkAdv(); persist(); sendState(true);
}

// ── 창: 보상, 스킨, 이야기, 인증서 ──
const overlayOpen = () => !$('panel').hidden || !$('story').hidden || !$('cert').hidden;
let panelKind = null;
function openPanel(kind) { unlock(); sfx.click(); panelKind = kind; $('panel').hidden = false; drawPanel(); }
function closePanel() { $('panel').hidden = true; panelKind = null; }
function drawPanel() {
  const body = $('panel-body'); body.innerHTML = '';
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  if (panelKind === 'daily') {
    $('panel-title').textContent = '🎁 일일 보상'; $('panel-sub').textContent = '하루에 한 번 받아요. 매일 오면 더 많이 줘요!';
    const ready = C.dailyReady(save, today()), cur = C.dailyAmount(save, today(), yesterday());
    const shownDay = ready ? cur.day : ((save.daily.streak - 1) % 7) + 1, scale = cur.coin / C.DAILY[cur.day - 1];
    const days = el('div', 'days');
    C.DAILY.forEach((c, i) => { const d = el('div', `day${i + 1 < shownDay || (!ready && i + 1 === shownDay) ? ' got' : ''}${ready && i + 1 === shownDay ? ' now' : ''}`); d.append(el('span', '', `${i + 1}일째`), el('b', '', `${C.fmtNum(c * scale)}코인`)); days.append(d); });
    const btn = el('button', 'primary', ready ? `오늘 보상 받기 (${C.fmtNum(cur.coin)}코인)` : '내일 또 와요!'); btn.disabled = !ready;
    btn.onclick = () => { const got = C.claimDaily(save, today(), yesterday()); if (got) { sfx.coin(); confetti(30); toast(`일일 보상 ${C.fmtNum(got)}코인 받았어요!`); persist(); refresh(); drawPanel(); } };
    body.append(days, btn);
  } else if (panelKind === 'time') {
    $('panel-title').textContent = '⏰ 시간 보상'; $('panel-sub').textContent = `오늘 게임을 한 시간: ${Math.floor(save.time.sec / 60)}분 ${Math.floor(save.time.sec % 60)}초`;
    const rows = el('div', 'rows');
    C.TIME_REWARDS.forEach((t, i) => {
      const row = el('div', 'row'), left = el('div', '', `${t.min}분 놀기`), got = save.time.got.includes(i), ready = C.timeRewardReady(save, i), remain = Math.max(0, t.min * 60 - save.time.sec);
      left.append(el('small', '', `${C.fmtNum(C.timeRewardCoin(save, i))}코인`));
      const btn = el('button', 'primary', got ? '받았어요' : ready ? '받기' : `${Math.floor(remain / 60)}:${String(Math.floor(remain % 60)).padStart(2, '0')}`); btn.disabled = !ready;
      btn.onclick = () => { const c = C.claimTime(save, i); if (c) { sfx.coin(); toast(`시간 보상 ${C.fmtNum(c)}코인 받았어요!`); persist(); refresh(); drawPanel(); } };
      row.append(left, btn); rows.append(row);
    });
    body.append(rows);
  } else if (panelKind === 'skin') {
    $('panel-title').textContent = '😀 스킨'; $('panel-sub').textContent = `코인으로 옷을 사서 입어요. 지금 ${C.fmtNum(save.coins)}코인`;
    const grid = el('div', 'skins');
    C.SKINS.forEach((k) => {
      const own = save.skins.includes(k.id), on = save.skin === k.id, card = el('div', `skin${on ? ' on' : ''}`), sw = el('div', 'sw'), pants = el('i');
      sw.style.background = k.shirt === 'rainbow' ? 'conic-gradient(#ff5e7e,#ffd43b,#7bff8a,#3fd0ff,#b197fc,#ff5e7e)' : k.shirt; pants.style.background = k.pants; sw.append(pants);
      const btn = el('button', 'primary', on ? '입는 중' : own ? '입기' : '사기'); btn.disabled = on || (!own && save.coins < k.cost);
      btn.onclick = () => { if (C.buySkin(save, k.id)) { sfx.buy(); persist(); refresh(); drawPanel(); } };
      card.append(sw, el('div', '', k.name), el('small', '', own ? '내 옷' : `${C.fmtNum(k.cost)}코인`), btn); grid.append(card);
    });
    body.append(grid);
  } else if (panelKind === 'worlds') {
    $('panel-title').textContent = '🚪 월드 문'; $('panel-sub').textContent = '가고 싶은 월드를 골라요. 앞 월드를 끝까지 깨면 다음 월드가 열려요.';
    const rows = el('div', 'rows');
    C.WORLDS.forEach((w) => {
      const can = C.canEnterWorld(save, w.id), here = save.world === w.id, row = el('div', 'row'), left = el('div', '', `${w.emoji} 월드 ${w.id} · ${w.name}`), first = C.STAGES[(w.id - 1) * 10], last = C.STAGES[w.id * 10 - 1];
      left.append(el('small', '', save.cleared[w.id - 1] ? `✔ 기록: ${w.record}` : can ? `${first.name}부터 ${last.name}까지` : `🔒 월드 ${w.id - 1}을(를) 끝까지 깨면 열려요`));
      const btn = el('button', 'primary', here ? '여기' : can ? '가기' : '잠김'); btn.disabled = here || !can;
      btn.onclick = () => { closePanel(); sfx.portal(); enterWorld(w.id); big(`월드 ${w.id}\n${w.name}`, 2); checkAdv(); persist(); sendState(true); };
      row.append(left, btn); rows.append(row);
    });
    body.append(rows);
  } else if (panelKind === 'adv') {
    const done = save.adv.length, all = C.ADVANCEMENTS.length;
    $('panel-title').textContent = '🏆 발전과제'; $('panel-sub').textContent = `${all}개 중에 ${done}개를 이뤘어요. 이루면 코인을 받아요!`;
    const bar = el('div', 'advbar'), fill = el('i'); fill.style.width = `${(done / all) * 100}%`; bar.append(fill);
    const rows = el('div', 'rows');
    C.ADVANCEMENTS.forEach((a) => {
      const ok = save.adv.includes(a.id), row = el('div', `row adv${ok ? ' done' : ''}`), mid = el('div', '', a.name);
      mid.append(el('small', '', a.desc));
      row.append(el('div', 'ico', a.emoji), mid, el('div', 'state', ok ? '✔ 달성' : `${C.fmtNum(a.coin)}코인`)); rows.append(row);
    });
    body.append(bar, rows);
  } else if (panelKind === 'friends') {
    $('panel-title').textContent = '👥 같이 하기'; $('panel-sub').textContent = '방 코드로 친구와 같은 월드에서 먹어요. 4명까지!';
    const box = el('div', 'net'); box.append(el('div', 'msg', net.text));
    if (net.active) {
      box.append(el('div', '', '방 코드'), el('div', 'code', net.code || '······'));
      const who = el('div', 'who'); who.append(el('span', '', `나 (${C.peerNumber(net.id) || '?'}번)`)); net.peers.forEach((id) => who.append(el('span', '', `${C.peerNumber(id)}번 친구`))); box.append(who);
      const out = el('button', 'primary', '방에서 나가기'); out.onclick = () => { sfx.click(); net.leave(); }; box.append(out);
    } else {
      const make = el('button', 'primary', '➕ 방 만들기'); make.onclick = () => { sfx.click(); net.create(); };
      const join = el('div', 'join'), input = el('input'), go = el('button', 'primary', '들어가기');
      input.maxLength = 6; input.placeholder = '방 코드'; input.autocapitalize = 'characters'; input.autocomplete = 'off'; input.spellcheck = false; input.setAttribute('aria-label', '방 코드 여섯 글자');
      const enter = () => { sfx.click(); net.join(input.value); };
      go.onclick = enter; input.addEventListener('keydown', (e) => { if (e.key === 'Enter') enter(); });
      join.append(input, go); box.append(make, el('div', '', '또는 친구가 알려 준 코드를 적어요'), join);
    }
    body.append(box);
  }
}
const STORY = [
  ['🧒', '나는 먹는 걸 세상에서 제일 좋아하는 아이.\n몸무게는 30kg이야.'],
  ['📺', '어느 날 TV에 기네스북이 나왔어.\n"세계에서 제일 뚱뚱한 사람" 기록이래!'],
  ['🔥', '좋아, 결심했어!\n많이 먹고 뚱뚱해져서 기네스북에 오를 거야!'],
  ['🍬', '먼저 마쮸부터 시작하자.\n음식 테이블에서 E로 받고, 클릭해서 먹어.\n몸무게가 차면 가운데 저울에서 E!'],
];
let storyI = 0;
function showStory() { storyI = 0; $('story').hidden = false; drawStory(); }
function drawStory() { $('story-emoji').textContent = STORY[storyI][0]; $('story-text').textContent = STORY[storyI][1]; $('story-next').textContent = storyI === STORY.length - 1 ? '먹으러 가자! ▶' : '다음 ▶'; }
$('story-next').onclick = () => { sfx.click(); storyI += 1; if (storyI >= STORY.length) { $('story').hidden = true; save.intro = true; persist(); startPlay(); } else drawStory(); };
function showCert(w, fresh) {
  const rec = C.WORLDS[w - 1].record;
  $('cert-title').textContent = rec; $('cert-weight').textContent = C.fmtKg(save.weight);
  const next = C.WORLDS[w];
  $('cert-text').textContent = w === 1
    ? '심사위원: "축하합니다! 한국 기록입니다!"\n하지만 세계 기록은 아직 멀었어요.\n저울 뒤의 월드 문으로 들어가서 월드 2 별빛 야시장에 가요!'
    : w === 2
      ? '심사위원: "믿을 수 없어요... 세계 신기록입니다!"\n드디어 기네스북에 내 이름이 올랐어!\n그런데 우주에는 더 뚱뚱한 누군가가 있대요.\n월드 문으로 월드 3 눈꽃 얼음 나라에 가요!'
      : next
        ? `심사위원: "이럴 수가! ${C.WORLDS[w - 1].record}입니다!"\n기네스북을 또 새로 써야겠어요.\n월드 문으로 월드 ${next.id} ${next.name}에 가요!`
        : '심사위원: "더는 잴 수가 없어요... 온 우주 신기록입니다!"\n기네스북 맨 첫 장에 내 이름이 올랐어!\n이제 마음껏 먹어서 기록을 더 늘려 봐요.';
  $('cert').hidden = false; if (fresh) { confetti(120); hero.cheer = 4; }
}
$('cert-ok').onclick = () => { sfx.click(); $('cert').hidden = true; };

// ── 메인화면과 시작 ──
function setMode(m) {
  mode = m; $('menu').hidden = m !== 'menu'; $('hud').hidden = m !== 'play'; $('touch').hidden = !(m === 'play' && document.body.classList.contains('touch'));
  if (m === 'menu') { $('prompt').hidden = true; refresh(); }
}
function startPlay() { setMode('play'); canvas.focus(); refresh(); if (C.dailyReady(save, today())) toast('🎁 오늘의 일일 보상을 받을 수 있어요!'); }
$('m-start').onclick = () => { unlock(); sfx.click(); if (!save.intro) showStory(); else startPlay(); };
$('m-daily').onclick = $('b-daily').onclick = () => openPanel('daily');
$('m-time').onclick = $('b-time').onclick = () => openPanel('time');
$('m-skin').onclick = $('b-skin').onclick = () => openPanel('skin');
$('m-adv').onclick = $('b-adv').onclick = () => openPanel('adv');
$('m-friends').onclick = $('b-friends').onclick = () => openPanel('friends');
$('panel-close').onclick = () => { sfx.click(); closePanel(); };
$('panel').addEventListener('pointerdown', (e) => { if (e.target === $('panel')) closePanel(); });
$('b-home').onclick = () => { sfx.click(); persist(); setMode('menu'); };
$('b-sound').onclick = () => { save.sound = !save.sound; save.music = save.sound; setSound(save.sound); setMusic(save.music); if (save.sound) unlock(); refresh(); persist(); };
$('prompt').onclick = interact;
setSound(save.sound); setMusic(save.music);

// ── 조작 ──
const keys = new Set();
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) { if (e.code === 'Escape') closePanel(); return; }
  if (e.repeat && (e.code === 'KeyE')) return;
  keys.add(e.code);
  if (e.code === 'KeyE') interact();
  if (e.code === 'Space') { e.preventDefault(); doBite(); }
  if (e.code === 'Escape') { if (panelKind) closePanel(); else if (mode === 'play' && !overlayOpen()) setMode('menu'); }
  if (e.code === 'Enter' && mode === 'menu' && !overlayOpen()) $('m-start').click();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
let drag = null, holdTimer = null;
const stopHold = () => { clearInterval(holdTimer); holdTimer = null; };
canvas.addEventListener('pointerdown', (e) => {
  unlock(); if (mode !== 'play') return;
  canvas.setPointerCapture(e.pointerId); drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, t: performance.now() };
  stopHold(); holdTimer = setInterval(() => { if (drag && !drag.moved && performance.now() - drag.t > 320) doBite(); }, 150);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 8) return;
  if (!drag.moved) { drag.moved = true; drag.x = e.clientX; drag.y = e.clientY; return; }
  camYaw -= dx * 0.006; camPitch = Math.min(1.15, Math.max(0.08, camPitch + dy * 0.004)); drag.x = e.clientX; drag.y = e.clientY;
});
const endDrag = (e) => { if (!drag || drag.id !== e.pointerId) return; const tap = !drag.moved && performance.now() - drag.t <= 320; drag = null; stopHold(); if (tap && e.type === 'pointerup') doBite(); };
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom = Math.min(1.8, Math.max(0.6, zoom * (e.deltaY > 0 ? 1.08 : 0.93))); }, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// 터치: 조이스틱, 먹기, E
const stick = { x: 0, y: 0, id: null };
if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
const stickEl = $('stick'), knob = stickEl.firstElementChild;
const moveStick = (e) => { const r = stickEl.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } stick.x = x; stick.y = y; knob.style.transform = `translate(${x * 36}px, ${y * 36}px)`; };
stickEl.addEventListener('pointerdown', (e) => { unlock(); stick.id = e.pointerId; stickEl.setPointerCapture(e.pointerId); moveStick(e); });
stickEl.addEventListener('pointermove', (e) => { if (stick.id === e.pointerId) moveStick(e); });
const endStick = (e) => { if (stick.id !== e.pointerId) return; stick.id = null; stick.x = stick.y = 0; knob.style.transform = ''; };
stickEl.addEventListener('pointerup', endStick); stickEl.addEventListener('pointercancel', endStick);
let eatTimer = null;
$('t-eat').addEventListener('pointerdown', (e) => { e.preventDefault(); unlock(); doBite(); clearInterval(eatTimer); eatTimer = setInterval(doBite, 160); });
['pointerup', 'pointercancel', 'pointerleave'].forEach((n) => $('t-eat').addEventListener(n, () => { clearInterval(eatTimer); eatTimer = null; }));
$('t-e').addEventListener('pointerdown', (e) => { e.preventDefault(); unlock(); interact(); });

function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ── 매 프레임 ──
let robotAcc = 0, slow = 0, saveT = 0, last = performance.now(), portalArmed = true;
const camTarget = new THREE.Vector3(), camPos = new THREE.Vector3();
function goalTarget() {
  if (C.canLevelUp(save)) return [world.scale, '⚖️ 저울로 가서 E로 레벨 업!'];
  if (C.allDone(save)) return [null, '🏆 우주 기록 보유자! 계속 먹어 봐요'];
  const st = C.stageOf(save);
  if (st.world !== save.world) return [world.portal, `🚪 문 안으로 들어가서 월드 ${st.world}로!`];
  const table = world.tables[st.level - 1];
  if (save.plate <= 0 && !save.up.drone) return [table, `${st.emoji} ${st.name} 테이블에서 E로 받기`];
  if (save.plateStage !== st.index && !save.up.drone) return [table, `${st.emoji} 새 음식 ${st.name}을(를) 받으러 가요!`];
  return [null, '🖱️ 클릭해서 냠냠 먹기!'];
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
  const playing = mode === 'play' && !overlayOpen();
  moving = false;
  if (playing) {
    let ix = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + stick.x;
    let iz = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) + stick.y;
    const l = Math.hypot(ix, iz);
    if (l > 0.12) {
      if (l > 1) { ix /= l; iz /= l; }
      const c = Math.cos(camYaw), s = Math.sin(camYaw), dx = ix * c + iz * s, dz = -ix * s + iz * c, sp = C.walkSpeed(save);
      pos.x += dx * sp * dt; pos.z += dz * sp * dt; moving = true;
      let d = Math.atan2(dx, dz) - facing; d = Math.atan2(Math.sin(d), Math.cos(d)); facing += d * Math.min(1, dt * 12);
    }
    const pr = Math.min(1.5, hero.radius * 0.7);
    for (const [sx, sz, sr] of world.solids) { const dx = pos.x - sx, dz = pos.z - sz, d = Math.hypot(dx, dz), m = sr + pr; if (d < m && d > 1e-4) { pos.x = sx + (dx / d) * m; pos.z = sz + (dz / d) * m; } }
    const d = Math.hypot(pos.x, pos.z); if (d > LIMIT) { pos.x *= LIMIT / d; pos.z *= LIMIT / d; }
    // 포탈 안으로 걸어 들어가면 월드를 고르는 창이 뜬다
    const inPortal = Math.hypot(pos.x - LAYOUT.portal[0], pos.z - LAYOUT.portal[1]) < 1.7;
    if (!inPortal) portalArmed = true;
    else if (portalArmed) { portalArmed = false; if (C.canEnterWorld(save, 2)) openPanel('worlds'); else { sfx.deny(); toast('🔒 월드 1의 10레벨을 깨면 문이 열려요'); } }
    // 로봇이 먹여 준다
    robotAcc += C.robotRate(save) * dt;
    if (robotAcc >= 1) { const n = Math.floor(robotAcc); robotAcc -= n; const r = C.robotBites(save, n); if (r) { hero.jiggle = Math.max(hero.jiggle, 0.5); if (Math.random() < 0.5) float(`🤖 +${C.fmtKg(r.kg)}`, 'r'); } }
    C.tickTime(save, today(), dt);
    // 가까운 것 찾기
    near = null; let bestD = 1e9;
    for (const it of world.interact) { const dd = Math.hypot(pos.x - it.x, pos.z - it.z) - it.r - pr * 0.5; if (dd < 0 && dd < bestD) { bestD = dd; near = it; } }
    const pe = $('prompt'); pe.hidden = !near;
    if (near) { const [t, ok] = promptFor(near); setText($('prompt-text'), t); pe.classList.toggle('no', !ok); }
    const [target, text] = goalTarget(); setText($('goal'), text);
    arrow.visible = !!target && target !== near;
    if (target) { arrow.position.set(target.at ? target.at[0] : target.x, (target.top || 5) + 0.9 + Math.sin(clock * 5) * 0.3, target.at ? target.at[1] : target.z); arrow.rotation.y = clock * 2; }
    world.scale.beam.visible = C.canLevelUp(save);
    hud();
    slow += dt; if (slow > 0.5) { slow = 0; refresh(); checkAdv(); if (panelKind === 'time') drawPanel(); }
    sendT += dt; if (sendT > 0.1) { sendT = 0; sendState(); }
    saveT += dt; if (saveT > 4) { saveT = 0; persist(); }
  } else { arrow.visible = false; if (mode === 'menu') { $('prompt').hidden = true; } }

  advTick(dt); updateRemotes(dt);
  hero.setFat(C.fatScale(save.weight));
  hero.root.position.x = pos.x; hero.root.position.z = pos.z;
  hero.update(dt, clock, moving);
  hero.root.rotation.y = mode === 'menu' ? Math.sin(clock * 0.6) * 0.5 : facing;
  if (world) { for (const sp of world.sprites) { const d = sp.getWorldPosition(v3).distanceTo(camera.position); sp.material.opacity = mode === 'menu' ? 0 : Math.min(1, Math.max(0, (d - 4.5 - hero.shownFat) / 3.5)); }
    world.update(clock); world.scale.needle.rotation.z = 2.1 - C.levelProgress(save) * 4.2; }
  const rr = hero.radius + 1.0;
  robots.children.forEach((r, i) => { const a = clock * 0.9 + (i / robots.children.length) * Math.PI * 2; r.visible = i < save.up.robot; r.position.set(pos.x + Math.sin(a) * rr, hero.headY - 0.2 + Math.sin(clock * 3 + i) * 0.15, pos.z + Math.cos(a) * rr); r.rotation.y = a + Math.PI; r.scale.setScalar(0.8 + hero.shownFat * 0.25); });
  drone.position.set(pos.x, hero.height + 1.0 + Math.sin(clock * 2) * 0.15, pos.z); drone.rotation.y = clock * 1.5; drone.scale.setScalar(0.8 + hero.shownFat * 0.3);
  for (const m of crumbs) if (m.visible) { const u = m.userData; u.life -= dt; u.v.y -= 14 * dt; m.position.addScaledVector(u.v, dt); if (u.life <= 0 || m.position.y < 0) m.visible = false; }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('on'); }
  if (bigT > 0) { bigT -= dt; if (bigT <= 0) $('big').classList.remove('on'); }

  // 카메라
  const f = hero.shownFat;
  if (mode === 'menu') {
    const dist = 5.2 + f * 2.2, a = 0.25 + Math.sin(clock * 0.25) * 0.12, side = innerWidth > innerHeight ? 0.42 : 0;
    camTarget.set(pos.x - Math.cos(a) * dist * side, hero.height * 0.55, pos.z + Math.sin(a) * dist * side * 0.2);
    camPos.set(pos.x + Math.sin(a) * dist - Math.cos(a) * dist * side, hero.height * 0.7 + 0.6, pos.z + Math.cos(a) * dist);
    camera.position.copy(camPos);
  } else {
    const dist = (5.8 + f * 2.3) * zoom;
    camTarget.set(pos.x, hero.height * 0.72, pos.z);
    camPos.set(pos.x + Math.sin(camYaw) * Math.cos(camPitch) * dist, camTarget.y + Math.sin(camPitch) * dist, pos.z + Math.cos(camYaw) * Math.cos(camPitch) * dist);
    camera.position.lerp(camPos, Math.min(1, dt * 12));
  }
  camera.lookAt(camTarget);
  sun.position.set(pos.x + 22, 46, pos.z + 16); sun.target.position.set(pos.x, 0, pos.z);
  sky.position.copy(camera.position);
  renderer.render(scene, camera);
}

enterWorld(C.canEnterWorld(save, save.world) ? save.world : 1);
setMode('menu');
document.fonts?.ready.then(() => { redrawLabels(); });
addEventListener('pagehide', () => { persist(); net.leave(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); last = performance.now(); });
if (new URLSearchParams(location.search).has('debug')) window.__fat = { C, hero, pos, get save() { return save; }, set save(v) { save = C.fixSave(v); refresh(); }, refresh, interact, doBite, enterWorld, net, remotes, start: startPlay, cam(y, p, z) { camYaw = y; camPitch = p; zoom = z; } };
requestAnimationFrame(frame);
