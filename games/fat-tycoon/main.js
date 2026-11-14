// 뚱뚱해지기 · 먹방 타이쿤. 먹기는 클릭, 상호작용은 E.
import * as THREE from 'three';
import './style.css';
import * as C from './core.mjs';
import { Character } from './src/character.js';
import { makeFood, mat, part } from './src/foods.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildWorld, LAYOUT, LIMIT, redrawLabels, makeLabel } from './src/world.js';
import { Net } from './src/net.js';
import { Cloud } from './src/cloud.js';
import { buildHome, buildJump } from './src/places.js';
import { sfx, unlock, setSound, setMusic, setTune } from './src/audio.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const setText = (el, t) => { if (el.textContent !== t) el.textContent = t; };

// ── 저장 ──
function load() { try { return C.fixSave(JSON.parse(localStorage.getItem(C.SAVE_KEY))); } catch { return C.newSave(); } }
let save = load();
function persist() { try { localStorage.setItem(C.SAVE_KEY, JSON.stringify(save)); } catch { /* 저장을 못 해도 게임은 계속 */ } cloud?.queue(); }
let cloud = null;
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
// 계획 2: 점프, 지금 있는 곳(월드 번호, 'home', 'jump'), 먹방 촬영, 운동
const GRAVITY = 22;
let place = 1, vy = 0, onGround = true, jumpHeld = false, checkpoint = null, rec = null, recCool = 0, gymOn = false, gymT = 0, wxHour = -1;
const placeCode = () => (place === 'home' ? C.HOME_PLACE : place === 'jump' ? C.JUMP_PLACE : save.world);

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
  world = worlds[id] || (worlds[id] = id === 'home' ? buildHome() : id === 'jump' ? buildJump() : buildWorld(id)); scene.add(world.root);
  place = id; if (typeof id === 'number') save.world = id;
  setTune(typeof id === 'number' ? id : id === 'home' ? 1 : 5);
  if (spawn) { const sp = world.spawn ?? LAYOUT.spawn; pos.set(sp[0], 0, sp[1]); facing = Math.PI; camYaw = 0; vy = 0; onGround = true; }
  checkpoint = null; stopGym();
  if (id === 'home' && !save.home) { save.home = true; }
  applyAtmosphere(); refresh();
}
// 우리 집이나 점프맵에서 원래 월드로 돌아간다
function leavePlace() {
  const from = place; sfx.portal(); enterWorld(save.world);
  if (from === 'home') { pos.set(LAYOUT.home[0], 0, LAYOUT.home[1] - 1.6); facing = Math.PI; }
  else { pos.set(LAYOUT.portal[0], 0, LAYOUT.portal[1] + 4.5); facing = 0; camYaw = Math.PI; portalArmed = false; }
  persist(); sendState(true);
}

// ── 날씨 (1시간마다 바뀐다) ──
const wx = new THREE.Group(); scene.add(wx);
const RAIN = 500, rainPos = new Float32Array(RAIN * 6), rainGeo = new THREE.BufferGeometry();
for (let i = 0; i < RAIN; i += 1) { const x = (Math.random() - 0.5) * 60, y = Math.random() * 34, z = (Math.random() - 0.5) * 60; rainPos.set([x, y, z, x + 0.15, y - 1.1, z], i * 6); }
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#cfe6ff', transparent: true, opacity: 0.6 })); rain.frustumCulled = false; wx.add(rain);
const SNOW = 600, snowPos = new Float32Array(SNOW * 3), snowGeo = new THREE.BufferGeometry();
for (let i = 0; i < SNOW; i += 1) snowPos.set([(Math.random() - 0.5) * 60, Math.random() * 34, (Math.random() - 0.5) * 60], i * 3);
snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
const snowFall = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.24, transparent: true, opacity: 0.95 })); snowFall.frustumCulled = false; wx.add(snowFall);
const rainbow = new THREE.Group();
['#ff5e7e', '#ff922b', '#ffd43b', '#51cf66', '#4dabf7', '#b197fc'].forEach((c, i) => rainbow.add(new THREE.Mesh(new THREE.TorusGeometry(110 - i * 4.5, 2.3, 6, 60, Math.PI), new THREE.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0.8 }))));
scene.add(rainbow);
const grey = new THREE.Color(), tmpC = new THREE.Color();
let wxForce = null; // 시험할 때만 날씨를 정해 본다 (?debug)
const weatherNow = () => (wxForce ? C.WEATHERS.find((w) => w.id === wxForce) : C.weatherAt(Date.now()));
function applyAtmosphere() {
  if (!world) return;
  const th = world.theme, w = th.indoor ? 'sunny' : weatherNow().id; wxHour = C.hourOf(Date.now());
  const mix = { cloudy: 0.5, rain: 0.72, snow: 0.5, fog: 0.62 }[w] ?? 0, dim = { cloudy: 0.68, rain: 0.45, snow: 0.72, fog: 0.55 }[w] ?? 1, fogK = { fog: 0.26, rain: 0.7, snow: 0.75 }[w] ?? 1;
  grey.set(world.night ? '#23263a' : w === 'snow' ? '#e9eef5' : w === 'fog' ? '#d5dbe3' : '#93a1b0');
  sky.material.uniforms.top.value.set(th.top).lerp(grey, mix); sky.material.uniforms.bottom.value.set(th.bottom).lerp(grey, mix * 0.8);
  scene.fog.color.set(th.fog).lerp(grey, mix); scene.fog.near = th.fogNear * fogK * (w === 'fog' ? 0.2 : 1); scene.fog.far = th.fogFar * fogK;
  hemi.color.set(th.hemiSky).lerp(tmpC.set(grey), mix * 0.5); hemi.groundColor.set(th.hemiGround); hemi.intensity = th.hemiI * (0.55 + dim * 0.45);
  sun.color.set(th.sun); sun.intensity = th.sunI * dim; scene.environmentIntensity = th.env; renderer.toneMappingExposure = th.exposure;
  rain.visible = w === 'rain'; snowFall.visible = w === 'snow'; rainbow.visible = w === 'rainbow';
}
function weatherTick(dt) {
  wx.position.set(camera.position.x, 0, camera.position.z);
  if (rain.visible) { for (let i = 0; i < RAIN; i += 1) { let y = rainPos[i * 6 + 1] - 38 * dt; if (y < 0) y += 34; rainPos[i * 6 + 1] = y; rainPos[i * 6 + 4] = y - 1.1; } rainGeo.attributes.position.needsUpdate = true; wx.position.y = Math.max(0, pos.y - 6); }
  if (snowFall.visible) { for (let i = 0; i < SNOW; i += 1) { let y = snowPos[i * 3 + 1] - 2.6 * dt; if (y < 0) y += 34; snowPos[i * 3 + 1] = y; snowPos[i * 3] += Math.sin(clock + i) * 0.4 * dt; } snowGeo.attributes.position.needsUpdate = true; wx.position.y = Math.max(0, pos.y - 6); }
  if (rainbow.visible) rainbow.position.set(pos.x, -8, pos.z - 170);
  if (C.hourOf(Date.now()) !== wxHour) { applyAtmosphere(); if (mode === 'play' && !world.theme.indoor) { const w = weatherNow(); toast(`${w.emoji} 날씨가 바뀌었어요: ${w.name}`); } }
}

// ── 화면 글씨 ──
let handId = null;
function refreshHand() {
  const id = save.plate > 0 ? (save.plateModel || C.STAGES[save.plateStage].id) : null;
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
  if (world.portal) { world.portal.open = true; world.portal.label.userData.set('🚪 월드 문\n들어가면 갈 곳을 골라요', { bg: '#e5dbff' }); }
  if (hero.gender !== save.gender) { hero.gender = save.gender; hero.setGender(save.gender); }
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
  const ps = C.STAGES[save.plateStage], dish = save.plateName ? C.DISHES.find((d) => d.name === save.plateName) : null;
  setText($('h-plate'), save.plate > 0 ? (dish ? `🍽️ ${dish.emoji} ${dish.name} ${save.plate}개 (x${save.plateMult})` : `🍽️ ${ps.emoji} ${ps.name} ${save.plate}개`) : '🍽️ 쟁반이 비었어요');
  setText($('h-jump'), save.jump.toFixed(2));
  const w = world.theme.indoor ? null : weatherNow();
  setText($('h-weather'), w ? `${w.emoji} ${w.name} · ${C.minutesToNextWeather(Date.now())}분 뒤 바뀜` : '🏠 우리 집');
  $('h-plate').classList.toggle('empty', save.plate <= 0 && !save.up.drone);
}
let toastT = 0;
function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('on'); toastT = 2.2; }
let bigT = 0;
function big(t, sec = 2.4) { const e = $('big'); e.textContent = t; e.classList.add('on'); bigT = sec; }
const v3 = new THREE.Vector3();
function float(text, cls = '') {
  const box = $('floats'); if (box.children.length > 24) return;
  v3.set(pos.x, pos.y + hero.height + 0.2, pos.z).project(camera);
  const s = document.createElement('span'); s.className = cls; s.textContent = text;
  s.style.left = `${(v3.x * 0.5 + 0.5) * innerWidth + (Math.random() - 0.5) * 120}px`; s.style.top = `${(-v3.y * 0.5 + 0.5) * innerHeight + (Math.random() - 0.5) * 30}px`;
  box.appendChild(s); setTimeout(() => s.remove(), 800);
}
function confetti(n = 70) {
  const box = $('confetti');
  for (let i = 0; i < n; i += 1) { const c = document.createElement('i'); c.style.left = `${Math.random() * 100}%`; c.style.background = ['#ff5e7e', '#ffd43b', '#3fd0ff', '#7bff8a', '#b197fc', '#ff9f43'][i % 6]; c.style.animationDuration = `${1.6 + Math.random() * 1.8}s`; c.style.animationDelay = `${Math.random() * 0.5}s`; box.appendChild(c); setTimeout(() => c.remove(), 4200); }
}

// ── 로그인과 클라우드 저장 ──
let chooseDone = null, loginMsg = '', loginBad = false;
cloud = new Cloud({
  getState: () => save,
  applyState: (data) => { rec = null; save = C.fixSave(data); try { localStorage.setItem(C.SAVE_KEY, JSON.stringify(save)); } catch { /* 계속 */ } handId = null; hero.setFood(null); enterWorld(C.canEnterWorld(save, save.world) ? save.world : 1); setSound(save.sound); setMusic(save.music); },
  toast: (t) => toast(t),
  choose: (local, server) => new Promise((resolve) => { chooseDone = { local, server, resolve }; panelKind = 'choose'; $('panel').hidden = false; drawPanel(); }),
});
cloud.onStatus = () => { refreshLogin(); if (panelKind === 'login') drawPanel(); };
function refreshLogin() {
  document.querySelectorAll('#b-login .dot, #m-login .dot').forEach((d) => { d.hidden = !cloud.loggedIn; });
  setText($('m-login-txt'), cloud.loggedIn ? cloud.nickname : '로그인');
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
  net.send({ t: 's', p: [Math.round(pos.x * 100) / 100, Math.round(pos.z * 100) / 100, Math.round(facing * 100) / 100, Math.round(pos.y * 100) / 100], w: save.weight, wd: placeCode(), g: save.gender === 'girl' ? 1 : 0, ds: save.plate > 0 && save.plateName ? C.DISHES.findIndex((d) => d.name === save.plateName) : -1, sk: C.SKINS.findIndex((k) => k.id === save.skin), fd: save.plate > 0 ? save.plateStage : -1, n: save.bites, m: moving ? 1 : 0, st: save.stage });
}
function updateRemotes(dt) {
  for (const r of remotes.values()) {
    const st = r.st, ch = r.ch;
    ch.root.visible = !!st && st.world === placeCode() && place !== 'home';
    if (!st) continue;
    if (r.fresh) { r.x = st.x; r.z = st.z; r.f = st.f; r.fresh = false; }
    const k = Math.min(1, dt * 10); r.x += (st.x - r.x) * k; r.z += (st.z - r.z) * k;
    const d = Math.atan2(Math.sin(st.f - r.f), Math.cos(st.f - r.f)); r.f += d * k;
    if (st.skin !== r.skin) { r.skin = st.skin; ch.star = null; ch.setSkin(C.SKINS[st.skin]); }
    const fkey = st.food >= 0 ? (st.dish >= 0 ? C.DISHES[st.dish].model : C.STAGES[st.food].id) : '';
    if (fkey !== r.food) { r.food = fkey; ch.setFood(fkey ? makeFood(fkey, 0.62) : null); }
    if (st.girl !== r.girl) { r.girl = st.girl; ch.setGender(st.girl ? 'girl' : 'boy'); }
    r.y = (r.y ?? st.y) + (st.y - (r.y ?? st.y)) * Math.min(1, dt * 14); ch.baseY = r.y;
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
  if (gymOn) { doRep(); return; }
  const r = C.bite(save);
  if (r && net.live) { const extra = Math.max(1, Math.round(r.coin * C.FRIEND_BONUS)); save.coins += extra; r.coin += extra; }
  if (!r) {
    if (now - lastDeny > 900) { lastDeny = now; sfx.deny(); toast('쟁반이 비었어요! 음식 테이블에서 E로 사거나, 우리 집 부엌에서 요리해요'); }
    return;
  }
  if (rec) rec.bites += 1;
  hero.bite(); sfx.bite(); float(`+${C.fmtKg(r.kg)}`); if (Math.random() < 0.34) float(`+${C.fmtNum(r.coin)}코인`, 'c');
  burst(3, ['#ffd9a0', '#ff9a1f', '#e8262d', '#c8281e'][save.plateStage % 4]);
  refreshHand();
  if (save.plate <= 0 && !save.up.drone) { sfx.plate(); toast('다 먹었어요! 테이블에서 E로 또 사요'); }
}

// ── 계획 2: 운동, 먹방 동영상 ──
function doRep() {
  const loss = C.exercise(save); hero.jiggle = 0.6;
  if (loss > 0) { float(`-${C.fmtKg(loss)}`, 'r'); sfx.click(); } else if (performance.now() - lastDeny > 1500) { lastDeny = performance.now(); toast('더는 뺄 살이 없어요! (30kg)'); }
}
function stopGym() { if (!gymOn) return; gymOn = false; if (world?.gym) world.gym.running = false; checkAdv(); persist(); }
function startGym() {
  gymOn = true; gymT = 0; world.gym.running = true; pos.set(world.bounds.gym[0], 0, world.bounds.gym[1]); facing = Math.PI / 2; vy = 0;
  toast('🏃 운동 시작! 클릭하면 더 빨리 빠져요. 움직이면 멈춰요');
}
function startVideo() {
  if (rec) return;
  if (recCool > 0) { sfx.deny(); toast(`카메라 배터리 충전 중... ${Math.ceil(recCool)}초 뒤에 찍을 수 있어요`); return; }
  if (save.plate <= 0 && !save.up.drone) { sfx.deny(); toast('먹을 음식이 없어요! 음식을 사 오거나 부엌에서 요리한 뒤에 찍어요'); return; }
  rec = { t: C.VIDEO_SEC, bites: 0 }; if (world.video) world.video.recording = true; sfx.buy(); big('🔴 촬영 시작!\n클릭해서 맛있게 먹어요', 1.6);
}
function endVideo() {
  const r = C.videoPay(save, rec.bites); rec = null; recCool = C.VIDEO_COOL; if (world?.video) world.video.recording = false; $('goal').classList.remove('rec');
  if (!r.coin) { sfx.deny(); big('🎬 촬영 끝\n아무것도 안 먹어서 조회수 0회...', 2.6); }
  else { sfx.level(); confetti(40); hero.cheer = 1.5; big(`🎬 조회수 ${C.fmtNum(r.views)}회!\n+${C.fmtNum(r.coin)}코인 · 구독자 +${C.fmtNum(r.subs)}`, 3); }
  checkAdv(); persist();
}

// ── 상호작용 (E) ──
let near = null, cookCounts = { tomato: 0, meat: 0, onion: 0, choco: 0 };
function promptFor(it) {
  if (it.type === 'table') {
    if (it.stage.index > C.bestStage(save)) return [`🔒 ${it.stage.level}레벨이 되면 먹을 수 있어요`, false];
    const price = C.platePrice(save, it.stage.index);
    if (!price) return [`${it.stage.emoji} ${it.stage.name} 받기 (${C.traySize(save)}개 · 공짜)`, true];
    return save.coins >= price ? [`${it.stage.emoji} ${it.stage.name} 사기 (${C.traySize(save)}개 · ${C.fmtNum(price)}코인)`, true] : [`${it.stage.emoji} 돈이 모자라요 (${C.fmtNum(price)}코인) · 시식 ${C.SAMPLE}개 받기`, true];
  }
  if (it.type === 'tramp') return ['🦘 트램폴린 위로 올라가서 통통 튀어요', true];
  if (it.type === 'home') return ['🏠 우리 집에 들어가기', true];
  if (it.type === 'exit') return ['🚪 밖으로 나가기', true];
  if (it.type === 'cook') return ['🍳 요리하기 (토마토, 고기, 양파, 초콜렛)', true];
  if (it.type === 'video') return rec ? ['🔴 촬영 중...', false] : recCool > 0 ? [`🔋 충전 중 ${Math.ceil(recCool)}초`, false] : [`🎬 먹방 동영상 찍기 (${C.VIDEO_SEC}초)`, true];
  if (it.type === 'gym') return gymOn ? ['🏃 운동 멈추기', true] : ['🏃 운동해서 살 빼기', true];
  if (it.type === 'pad') { const c = C.upgradeCost(save, it.up.id); return c === Infinity ? [`${it.up.name}: 끝까지 올렸어요`, false] : [`${it.up.emoji} ${it.up.name} 사기 · ${C.fmtNum(c)}코인`, save.coins >= c]; }
  if (it.type === 'scale') return C.allDone(save) ? ['🏆 기록 인증서 보기', true] : C.canLevelUp(save) ? ['⚖️ 몸무게 재고 레벨 업!', true] : ['⚖️ 몸무게 재기', true];
  return ['🚪 문 안으로 들어가면 갈 곳을 골라요', true];
}
function interact() {
  if (mode !== 'play' || overlayOpen() || !near) return;
  const it = near;
  if (it.type === 'table') {
    const price = C.platePrice(save, it.stage.index), got = C.fillPlate(save, it.stage.index);
    if (!got) { sfx.deny(); toast(`${it.stage.level}레벨이 되어야 ${it.stage.name}을(를) 먹을 수 있어요`); return; }
    sfx.plate();
    if (got === 'sample') toast(`돈이 모자라서 시식 ${save.plate}개만 받았어요. 먹방 동영상을 찍어서 돈을 벌어요!`);
    else toast(price ? `${it.stage.emoji} ${it.stage.name} ${save.plate}개를 ${C.fmtNum(price)}코인에 샀어요. 클릭해서 먹어요!` : `${it.stage.emoji} ${it.stage.name} ${save.plate}개를 받았어요. 클릭해서 먹어요!`);
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
  } else if (it.type === 'portal') { openPanel('worlds'); return; }
  else if (it.type === 'home') { sfx.portal(); enterWorld('home'); big('🏠 우리 집', 1.6); }
  else if (it.type === 'exit') { leavePlace(); return; }
  else if (it.type === 'cook') { cookCounts = { tomato: 0, meat: 0, onion: 0, choco: 0 }; openPanel('cook'); return; }
  else if (it.type === 'video') { startVideo(); return; }
  else if (it.type === 'gym') { if (gymOn) stopGym(); else startGym(); return; }
  else if (it.type === 'tramp') { toast('트램폴린 위로 걸어 올라가면 저절로 튀어요. 튈 때마다 점프력 +0.02!'); return; }
  refresh(); checkAdv(); persist(); sendState(true);
}

// ── 창: 보상, 스킨, 이야기, 인증서 ──
function openPanelGuard() { return panelKind === 'choose'; }
const overlayOpen = () => !$('panel').hidden || !$('story').hidden || !$('cert').hidden;
let panelKind = null;
function openPanel(kind) { if (openPanelGuard()) return; unlock(); sfx.click(); panelKind = kind; $('panel').hidden = false; drawPanel(); }
function closePanel() { if (panelKind === 'choose' || panelKind === 'gender') return; $('panel').hidden = true; panelKind = null; }
function drawPanel() {
  const body = $('panel-body'); body.innerHTML = ''; $('panel-close').hidden = panelKind === 'choose' || panelKind === 'gender';
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
    const gb = el('div', 'gender mini');
    [['girl', '👧', '여자'], ['boy', '👦', '남자']].forEach(([g, e, name]) => { const b = el('button', save.gender === g ? 'on' : ''); b.append(el('span', '', e), document.createTextNode(` ${name}`)); b.onclick = () => { sfx.click(); save.gender = g; persist(); refresh(); drawPanel(); sendState(true); }; gb.append(b); });
    body.append(gb);
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
    $('panel-title').textContent = '🚪 월드 문'; $('panel-sub').textContent = '가고 싶은 곳을 골라요. 앞 월드를 끝까지 깨면 다음 월드가 열려요.';
    const rows = el('div', 'rows');
    { const row = el('div', 'row'), left = el('div', '', '🏔️ 점프맵'), btn = el('button', 'primary', place === 'jump' ? '여기' : '가기'); btn.disabled = place === 'jump';
      left.append(el('small', '', save.jumpTop >= C.JUMP_SECTIONS.length ? '✔ 꼭대기까지 올랐어요' : `깃발 ${save.jumpTop}/${C.JUMP_SECTIONS.length} · 지금 점프력 ${save.jump.toFixed(2)}`));
      btn.onclick = () => { closePanel(); sfx.portal(); enterWorld('jump'); big('🏔️ 점프맵\n스페이스로 점프!', 2); persist(); sendState(true); };
      row.append(left, btn); rows.append(row); }
    C.WORLDS.forEach((w) => {
      const can = C.canEnterWorld(save, w.id), here = place === w.id, row = el('div', 'row'), left = el('div', '', `${w.emoji} 월드 ${w.id} · ${w.name}`), first = C.STAGES[(w.id - 1) * 10], last = C.STAGES[w.id * 10 - 1];
      left.append(el('small', '', save.cleared[w.id - 1] ? `✔ 기록: ${w.record}` : can ? `${first.name}부터 ${last.name}까지` : `🔒 월드 ${w.id - 1}을(를) 끝까지 깨면 열려요`));
      const btn = el('button', 'primary', here ? '여기' : can ? '가기' : '잠김'); btn.disabled = here || !can;
      btn.onclick = () => { closePanel(); sfx.portal(); enterWorld(w.id); big(`월드 ${w.id}\n${w.name}`, 2); checkAdv(); persist(); sendState(true); };
      row.append(left, btn); rows.append(row);
    });
    body.append(rows);
  } else if (panelKind === 'cook') {
    $('panel-title').textContent = '🍳 요리하기'; $('panel-sub').textContent = `재료를 골라서 내 음식을 만들어요. 지금 ${C.fmtNum(save.coins)}코인`;
    const box = el('div', 'cook');
    C.INGREDIENTS.forEach((ing) => {
      const row = el('div', 'ing'), left = el('div', '', `${ing.emoji} ${ing.name}`), cnt = el('div', 'cnt'), minus = el('button', '', '−'), num = el('b', '', String(cookCounts[ing.id])), plus = el('button', '', '+');
      left.append(el('small', '', `한 개 ${C.fmtNum(C.ingredientPrice(save, ing.id))}코인`));
      minus.disabled = cookCounts[ing.id] <= 0; plus.disabled = cookCounts[ing.id] >= C.INGREDIENT_MAX;
      minus.onclick = () => { sfx.click(); cookCounts[ing.id] -= 1; drawPanel(); }; plus.onclick = () => { sfx.click(); cookCounts[ing.id] += 1; drawPanel(); };
      cnt.append(minus, num, plus); row.append(left, cnt); box.append(row);
    });
    const r = C.recipe(cookCounts), price = C.cookPrice(save, cookCounts), out = el('div', `out${r && r.mult < 1 ? ' bad' : ''}`);
    if (r) { out.append(el('b', '', `${r.emoji} ${r.name}`), document.createTextNode(`${C.DISH_BITES}입 · 한 입에 몸무게 ${r.mult}배 · ${C.fmtNum(price)}코인`)); if (r.note) out.append(el('small', '', ` ${r.note}`)); }
    else out.textContent = '재료를 하나 넣어 봐요. 무슨 요리가 될까?';
    const go = el('button', 'primary', !r ? '재료를 골라요' : save.coins < price ? `코인이 ${C.fmtNum(price - save.coins)}개 모자라요` : save.plate > 0 ? '요리하기 (쟁반 음식은 버려요)' : '요리하기'); go.disabled = !r || save.coins < price;
    go.onclick = () => { const d = C.cook(save, cookCounts); if (!d) return; closePanel(); sfx.buy(); hero.cheer = 1; refreshHand(); big(`${d.emoji} ${d.name} 완성!${d.note ? `\n${d.note}` : ''}`, 2.4); checkAdv(); persist(); sendState(true); };
    box.append(out, go); body.append(box);
  } else if (panelKind === 'gender') {
    $('panel-title').textContent = '누구로 시작할까?'; $('panel-sub').textContent = '여자로 시작할지 남자로 시작할지 골라요. 스킨 창에서 언제든 바꿀 수 있어요.';
    const box = el('div', 'gender');
    [['girl', '👧', '여자'], ['boy', '👦', '남자']].forEach(([g, e, name]) => { const b = el('button'); b.append(el('span', '', e), document.createTextNode(name)); b.onclick = () => { sfx.buy(); save.gender = g; persist(); refresh(); $('panel').hidden = true; panelKind = null; if (!save.intro) showStory(); else startPlay(); }; box.append(b); });
    body.append(box);
  } else if (panelKind === 'choose' && chooseDone) {
    $('panel-title').textContent = '☁️ 어느 기록으로 할까?'; $('panel-sub').textContent = '이 기기와 서버의 기록이 달라요. 하나를 고르면 다른 하나는 없어져요.';
    const box = el('div', 'pick'), done = (pick) => { const d = chooseDone; chooseDone = null; panelKind = null; $('panel').hidden = true; sfx.click(); d.resolve(pick); };
    [['local', '📱 이 기기 기록', chooseDone.local], ['server', '☁️ 서버 기록', chooseDone.server]].forEach(([k, name, text]) => {
      const row = el('div', 'row'), left = el('div'); left.append(el('b', '', name), el('small', '', text));
      const btn = el('button', 'primary', '이걸로 하기'); btn.onclick = () => done(k); row.append(left, btn); box.append(row);
    });
    body.append(box);
  } else if (panelKind === 'login') {
    $('panel-title').textContent = '👤 로그인'; $('panel-sub').textContent = '로그인하면 기록이 서버에 저장돼서 다른 기기에서도 이어 할 수 있어요.';
    const box = el('div', 'login'), msg = el('div', `msg${loginBad ? ' bad' : ''}`, loginMsg || cloud.statusText || (cloud.loggedIn ? '서버에 저장됨 ☁️' : 'seonn.dev 게임은 모두 같은 계정을 써요.'));
    if (cloud.loggedIn) {
      const out = el('button', 'primary', '로그아웃'); out.onclick = async () => { sfx.click(); await cloud.logout(); loginMsg = '로그아웃했어. 기록은 이 기기에 그대로 있어.'; loginBad = false; refreshLogin(); drawPanel(); };
      const now = el('button', 'primary', '지금 서버에 저장'); now.onclick = () => { sfx.click(); loginMsg = ''; cloud.upload(); };
      box.append(el('div', 'who', cloud.nickname), msg, now, out);
    } else {
      const nl = el('label', '', '닉네임 (2~10글자)'), ni = el('input'), pl = el('label', '', '비밀번호 (4~16글자)'), pi = el('input'), two = el('div', 'two'), a = el('button', 'primary', '로그인'), b = el('button', 'primary', '계정 만들기');
      ni.maxLength = 10; ni.autocomplete = 'username'; ni.spellcheck = false; pi.type = 'password'; pi.maxLength = 16; pi.autocomplete = 'current-password';
      const go = async (make) => {
        sfx.click(); a.disabled = b.disabled = true; loginMsg = make ? '계정을 만드는 중…' : '로그인하는 중…'; loginBad = false; msg.textContent = loginMsg; msg.className = 'msg';
        try { await (make ? cloud.signup(ni.value, pi.value) : cloud.login(ni.value, pi.value)); loginMsg = ''; sfx.buy(); }
        catch (e) { loginMsg = e?.message || '잘 안 됐어. 다시 해 볼래?'; loginBad = true; sfx.deny(); }
        refreshLogin(); if (panelKind === 'login') drawPanel();
      };
      a.onclick = () => go(false); b.onclick = () => go(true); pi.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(false); });
      nl.append(ni); pl.append(pi); two.append(a, b);
      box.append(msg, nl, pl, two, el('small', '', '진짜 이름 말고 별명을 써요. 이메일은 안 받아서, 비밀번호를 잊으면 되찾을 수 없어요.'));
    }
    body.append(box);
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
  ['🏠', '마쮸는 공짜지만 다른 음식은 돈을 내야 해.\n우리 집에서 먹방 동영상을 찍으면 돈을 벌 수 있어.\n스페이스바로 점프도 할 수 있어!'],
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
$('m-start').onclick = () => { unlock(); sfx.click(); if (!save.gender) openPanel('gender'); else if (!save.intro) showStory(); else startPlay(); };
$('m-daily').onclick = $('b-daily').onclick = () => openPanel('daily');
$('m-time').onclick = $('b-time').onclick = () => openPanel('time');
$('m-skin').onclick = $('b-skin').onclick = () => openPanel('skin');
$('m-adv').onclick = $('b-adv').onclick = () => openPanel('adv');
$('m-login').onclick = $('b-login').onclick = () => { loginMsg = ''; loginBad = false; openPanel('login'); };
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
  if (e.code === 'Space') e.preventDefault();
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
$('t-jump').addEventListener('pointerdown', (e) => { e.preventDefault(); unlock(); jumpHeld = true; });
['pointerup', 'pointercancel', 'pointerleave'].forEach((n) => $('t-jump').addEventListener(n, () => { jumpHeld = false; }));

function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ── 매 프레임 ──
let robotAcc = 0, slow = 0, saveT = 0, last = performance.now(), portalArmed = true;
const camTarget = new THREE.Vector3(), camPos = new THREE.Vector3();
function groundAt(x, z, y) {
  let g = world.flat ? 0 : -Infinity, hit = null;
  for (const p of world.platforms) {
    if (p.top > y + 0.35 || p.top < g) continue;
    let inside;
    if (p.kind === 'box') { const dx = x - p.x, dz = z - p.z, c = Math.cos(p.ry), s = Math.sin(p.ry), lx = dx * c - dz * s, lz = dx * s + dz * c; inside = Math.abs(lx) <= p.w / 2 + 0.25 && Math.abs(lz) <= p.d / 2 + 0.25; }
    else inside = Math.hypot(x - p.x, z - p.z) <= p.r;
    if (inside) { g = p.top; hit = p; }
  }
  return [g, hit];
}
function respawn() {
  const c = checkpoint; sfx.deny();
  if (c) { pos.set(c.x, c.top + 0.2, c.z); } else { const sp = world.spawn ?? LAYOUT.spawn; pos.set(sp[0], 0.2, sp[1]); }
  vy = 0; toast(c ? '앗, 떨어졌어요! 마지막 깃발에서 다시 해요' : '앗, 떨어졌어요! 처음부터 다시 해요');
}
function goalTarget() {
  if (rec) return [null, `🔴 촬영 중 ${Math.ceil(rec.t)}초 · 먹은 횟수 ${rec.bites}번 · 클릭해서 먹어요!`];
  if (gymOn) return [null, `🏃 운동 중 · 몸무게 ${C.fmtKg(save.weight)} · 클릭하면 더 빨리!`];
  if (place === 'home') return [null, '🏠 우리 집: 부엌에서 요리, 카메라로 먹방, 러닝머신으로 운동'];
  if (place === 'jump') { const sec = C.JUMP_SECTIONS[checkpoint ? checkpoint.flag : 0]; return [null, sec ? `🏔️ 점프맵 ${(checkpoint ? checkpoint.flag : 0) + 1}구간 · 필요한 점프력 ${sec.need.toFixed(1)} (지금 ${save.jump.toFixed(2)})` : '🏆 점프맵 꼭대기! 대단해요']; }
  if (C.canLevelUp(save)) return [world.scale, '⚖️ 저울로 가서 E로 레벨 업!'];
  if (C.allDone(save)) return [null, '🏆 우주 기록 보유자! 계속 먹어 봐요'];
  const st = C.stageOf(save);
  if (st.world !== save.world) return [world.portal, `🚪 문 안으로 들어가서 월드 ${st.world}로!`];
  const table = world.tables[st.level - 1];
  if (save.plate <= 0 && !save.up.drone) return [table, `${st.emoji} ${st.name} 테이블에서 E로 ${st.index ? '사기' : '받기'}`];
  if (save.plateStage !== st.index && !save.up.drone && !save.plateName) return [table, `${st.emoji} 새 음식 ${st.name}을(를) 사러 가요!`];
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
    if (l > 0.12 && gymOn) stopGym();
    if (l > 0.12) {
      if (l > 1) { ix /= l; iz /= l; }
      const c = Math.cos(camYaw), s = Math.sin(camYaw), dx = ix * c + iz * s, dz = -ix * s + iz * c, sp = C.walkSpeed(save);
      pos.x += dx * sp * dt; pos.z += dz * sp * dt; moving = true;
      let d = Math.atan2(dx, dz) - facing; d = Math.atan2(Math.sin(d), Math.cos(d)); facing += d * Math.min(1, dt * 12);
    }
    const pr = Math.min(1.5, hero.radius * 0.7);
    for (const [sx, sz, sr] of world.solids) { const dx = pos.x - sx, dz = pos.z - sz, d = Math.hypot(dx, dz), m = sr + pr; if (d < m && d > 1e-4) { pos.x = sx + (dx / d) * m; pos.z = sz + (dz / d) * m; } }
    if (world.bounds) { pos.x = Math.min(world.bounds.maxX, Math.max(world.bounds.minX, pos.x)); pos.z = Math.min(world.bounds.maxZ, Math.max(world.bounds.minZ, pos.z)); }
    else if (world.flat) { const d = Math.hypot(pos.x, pos.z); if (d > LIMIT) { pos.x *= LIMIT / d; pos.z *= LIMIT / d; } }
    // 점프 (스페이스), 중력, 트램폴린, 점프맵 발판
    if (gymOn) { gymT += dt; moving = true; if (gymT > 0.6) { gymT = 0; doRep(); } }
    else {
      if ((keys.has('Space') || jumpHeld) && onGround) { vy = C.jumpVelocity(save); onGround = false; save.jumps += 1; sfx.click(); }
      vy -= GRAVITY * dt; pos.y += vy * dt;
      const [ground, hit] = groundAt(pos.x, pos.z, pos.y - vy * dt);
      if (pos.y <= ground && vy <= 0) {
        pos.y = ground;
        if (hit?.kind === 'tramp') { vy = C.jumpVelocity(save) * 1.25; onGround = false; hit.tramp.bounce(clock); sfx.plate(); if (C.trainJump(save)) { float(`점프력 +${C.JUMP_STEP}`, 'r'); const ch = $('h-jump').parentElement; ch.classList.remove('up'); void ch.offsetWidth; ch.classList.add('up'); } }
        else { vy = 0; onGround = true; if (hit?.flag && (!checkpoint || hit.flag > checkpoint.flag)) { checkpoint = hit; const coin = C.jumpReward(save, hit.flag); if (coin) { sfx.level(); confetti(50); hero.cheer = 1.5; big(`🚩 ${hit.flag}구간 깼다!\n+${C.fmtNum(coin)}코인`, 2.4); checkAdv(); persist(); } else toast(`🚩 ${hit.flag}구간 깃발! 떨어지면 여기서 다시 해요`); } }
      } else onGround = false;
      if (!world.flat && pos.y < (checkpoint ? checkpoint.top : 0) - 14) respawn();
    }
    // 먹방 촬영 시간
    if (rec) { rec.t -= dt; $('goal').classList.add('rec'); if (rec.t <= 0) endVideo(); }
    if (recCool > 0) recCool -= dt;
    // 포탈 안으로 걸어 들어가면 갈 곳을 고르는 창이 뜬다
    const inPortal = !!world.portal && Math.hypot(pos.x - LAYOUT.portal[0], pos.z - LAYOUT.portal[1]) < 1.7;
    if (!inPortal) portalArmed = true;
    else if (portalArmed) { portalArmed = false; openPanel('worlds'); }
    // 로봇이 먹여 준다
    robotAcc += C.robotRate(save) * dt;
    if (robotAcc >= 1) { const n = Math.floor(robotAcc); robotAcc -= n; const r = C.robotBites(save, n); if (r) { hero.jiggle = Math.max(hero.jiggle, 0.5); if (Math.random() < 0.5) float(`🤖 +${C.fmtKg(r.kg)}`, 'r'); } }
    C.tickTime(save, today(), dt);
    // 가까운 것 찾기
    near = null; let bestD = 1e9;
    for (const it of world.interact) { const dd = Math.hypot(pos.x - it.x, pos.z - it.z) - it.r - pr * 0.5; if (dd < 0 && dd < bestD && pos.y < 3) { bestD = dd; near = it; } }
    const pe = $('prompt'); pe.hidden = !near;
    if (near) { const [t, ok] = promptFor(near); setText($('prompt-text'), t); pe.classList.toggle('no', !ok); }
    const [target, text] = goalTarget(); setText($('goal'), text);
    arrow.visible = !!target && target !== near && typeof place === 'number';
    if (target) { arrow.position.set(target.at ? target.at[0] : target.x, (target.top || 5) + 0.9 + Math.sin(clock * 5) * 0.3, target.at ? target.at[1] : target.z); arrow.rotation.y = clock * 2; }
    if (world.scale) world.scale.beam.visible = C.canLevelUp(save);
    hud();
    slow += dt; if (slow > 0.5) { slow = 0; refresh(); checkAdv(); if (panelKind === 'time') drawPanel(); }
    sendT += dt; if (sendT > 0.1) { sendT = 0; sendState(); }
    saveT += dt; if (saveT > 4) { saveT = 0; persist(); }
  } else { arrow.visible = false; if (mode === 'menu') { $('prompt').hidden = true; } }

  advTick(dt); updateRemotes(dt); weatherTick(dt);
  hero.baseY = pos.y;
  hero.setFat(C.fatScale(save.weight));
  hero.root.position.x = pos.x; hero.root.position.z = pos.z;
  hero.update(dt, clock, moving);
  hero.root.rotation.y = mode === 'menu' ? Math.sin(clock * 0.6) * 0.5 : facing;
  if (world) { for (const sp of world.sprites) { const d = sp.getWorldPosition(v3).distanceTo(camera.position); sp.material.opacity = mode === 'menu' ? 0 : Math.min(1, Math.max(0, (d - 4.5 - hero.shownFat) / 3.5)); }
    world.update(clock); if (world.scale) world.scale.needle.rotation.z = 2.1 - C.levelProgress(save) * 4.2; }
  const rr = hero.radius + 1.0;
  robots.children.forEach((r, i) => { const a = clock * 0.9 + (i / robots.children.length) * Math.PI * 2; r.visible = i < save.up.robot; r.position.set(pos.x + Math.sin(a) * rr, pos.y + hero.headY - 0.2 + Math.sin(clock * 3 + i) * 0.15, pos.z + Math.cos(a) * rr); r.rotation.y = a + Math.PI; r.scale.setScalar(0.8 + hero.shownFat * 0.25); });
  drone.position.set(pos.x, pos.y + hero.height + 1.0 + Math.sin(clock * 2) * 0.15, pos.z); drone.rotation.y = clock * 1.5; drone.scale.setScalar(0.8 + hero.shownFat * 0.3);
  for (const m of crumbs) if (m.visible) { const u = m.userData; u.life -= dt; u.v.y -= 14 * dt; m.position.addScaledVector(u.v, dt); if (u.life <= 0 || m.position.y < pos.y - 0.5) m.visible = false; }
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
    camTarget.set(pos.x, pos.y + hero.height * 0.72, pos.z);
    camPos.set(pos.x + Math.sin(camYaw) * Math.cos(camPitch) * dist, camTarget.y + Math.sin(camPitch) * dist, pos.z + Math.cos(camYaw) * Math.cos(camPitch) * dist);
    camera.position.lerp(camPos, Math.min(1, dt * 12));
  }
  camera.lookAt(camTarget);
  sun.position.set(pos.x + 22, pos.y + 46, pos.z + 16); sun.target.position.set(pos.x, pos.y, pos.z);
  sky.position.copy(camera.position);
  renderer.render(scene, camera);
}

enterWorld(C.canEnterWorld(save, save.world) ? save.world : 1);
setMode('menu');
refreshLogin(); cloud.sync();
document.fonts?.ready.then(() => { redrawLabels(); });
addEventListener('pagehide', () => { persist(); net.leave(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { persist(); cloud.upload(); } last = performance.now(); });
if (new URLSearchParams(location.search).has('debug')) window.__fat = { C, hero, pos, get save() { return save; }, set save(v) { save = C.fixSave(v); refresh(); }, refresh, interact, doBite, enterWorld, net, remotes, cloud, get place() { return place; }, get world() { return world; }, get rec() { return rec; }, set rec(v) { rec = v; }, set recCool(v) { recCool = v; }, get checkpoint() { return checkpoint; }, applyAtmosphere, weather(id) { wxForce = id; applyAtmosphere(); }, start: startPlay, cam(y, p, z) { camYaw = y; camPitch = p; zoom = z; } };
requestAnimationFrame(frame);
