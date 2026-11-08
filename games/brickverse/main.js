// BRICKVERSE · 브릭버스: 아바타를 꾸미고 광장에서 문을 골라 여러 게임을 하는 3D 블록 놀이터.
import './style.css';
import { createView, buildStatic, partMesh, disposeGroup, signMesh, animated, tex, THREE } from './src/render.js';
import { Avatar } from './src/avatar.js';
import { Controls } from './src/controls.js';
import { Effects } from './src/effects.js';
import { sfx as sound, unlock, setSound, setMusic, playMusic } from './src/audio.js';
import { UI } from './src/ui.js';
import { Net } from './src/net.js';
import { Tycoon, remoteTycoonFrom } from './src/tycoon.js';
import { Survival } from './src/survival.js';
import { Cloud } from './src/cloud.js';
import {
  P, SAVE_KEY, makeBox, placeBox, newPlayer, stepPlayer, clearMotion, segmentDistance, cleanSave, defaultSave,
  HATS, FACES, EMBLEMS, PHRASES, displayName, lookToArray, lookFromArray, packPose, unpackPose,
  OBBY_STAGES, obbyStageCoins, OBBY_CLEAR_COINS, ADJECTIVES, ANIMALS,
} from './core.mjs';
import { buildHub, buildObby, buildTycoon, buildSurvival, OBBY_NAMES, PLOT_SLOTS } from './worlds.mjs';

const $ = id => document.getElementById(id);
const canvas = $('game');
const WORLD_INFO = [
  { icon: '🏠', name: '브릭 광장', build: buildHub },
  { icon: '🌈', name: '무지개 점프 탑', build: buildObby },
  { icon: '🏭', name: '블록 공장 타이쿤', build: buildTycoon },
  { icon: '🔥', name: '바닥이 사라져요', build: buildSurvival },
];
const fmtTime = ms => { const s = ms / 1000; return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`; };
const LOOK_KEYS = { hat: HATS, face: FACES, emblem: EMBLEMS };

// ───── 저장 ─────
function loadSave() {
  try { const raw = localStorage.getItem(SAVE_KEY); if (raw) return cleanSave(JSON.parse(raw)); } catch { /* 처음 */ }
  return defaultSave();
}

const game = {
  save: loadSave(),
  started: false,
  world: null,
  worldId: 0,
  remotes: new Map(),
  wardrobeOpen: false,
  obbyStart: 0,
  obbyTiming: false,
  persistTimer: 0,
  emoteId: 0,
  sfx: name => sound[name]?.(),
};

const view = createView(canvas);
const controls = new Controls(canvas, $('stick'), $('jump'));
const effects = new Effects(view.scene);
game.effects = effects;
const ui = new UI(game);
game.ui = ui;

// 나
const me = { pl: newPlayer(0, 0.3, 18), yaw: Math.PI, avatar: new Avatar(game.save.look, '', { local: true }), dead: 0, emote: 0, hurtCooldown: 0 };
view.scene.add(me.avatar.root);
game.player = me.pl;
Object.defineProperty(me.pl, 'yaw', { get: () => me.yaw, set: v => { me.yaw = v; } });

setSound(game.save.sound); setMusic(game.save.music);
ui.setCoins(game.save.coins);
ui.syncMenu();

const writeLocal = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(game.save)); } catch { /* 저장 공간 없음 */ } };
game.persist = () => {
  clearTimeout(game.persistTimer);
  game.persistTimer = setTimeout(writeLocal, 250);
  game.cloud?.queue();
};

// ───── 로그인과 서버 저장 ─────
game.cloud = new Cloud({
  getState: () => JSON.parse(JSON.stringify(game.save)),
  applyState: data => {
    game.save = cleanSave(data);
    writeLocal();
    me.avatar.setLook(game.save.look);
    setSound(game.save.sound); setMusic(game.save.music);
    ui.setCoins(game.save.coins);
    ui.syncMenu();
    if (game.world) loadWorld(game.worldId);
    sendHi();
  },
  toast: t => ui.toast(t),
  choose: (a, b, first) => ui.choose(a, b, first),
});
game.cloud.onStatus = () => ui.renderLogin();
ui.renderLogin();
game.controlsOff = off => { controls.enabled = !off && !game.wardrobeOpen; };
addEventListener('pagehide', () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(game.save)); } catch { /* 무시 */ } });

game.addCoins = n => {
  if (!n) return;
  game.save.coins += n;
  ui.setCoins(game.save.coins);
  ui.bumpCoins();
  game.persist();
};

// ───── 부품 만들기 ─────
game.makeParts = (parts, parent) => {
  const group = new THREE.Group();
  const boxes = [];
  const statics = [];
  const dyn = [];
  for (const p of parts) {
    if (p.spin) {
      const mesh = partMesh({ ...p, ry: 0 });
      group.add(mesh);
      dyn.push({ p, mesh, spin: true });
      continue;
    }
    let box = null;
    if (!p.deco) { box = makeBox(p); boxes.push(box); }
    const moving = p.move || p.k === 'fade' || p.flag || p.turn;
    if (moving && !p.hidden) {
      const mesh = partMesh(p);
      if (p.k === 'fade') { mesh.material = mesh.material.clone(); mesh.material.transparent = true; mesh.material.userData.own = true; }
      group.add(mesh);
      dyn.push({ p, mesh, box, base: { x: p.x, y: p.y, z: p.z }, fade: p.k === 'fade' ? { state: 0, t: 0 } : null });
    } else if (!p.hidden) statics.push(p);
  }
  if (statics.length) group.add(buildStatic(statics));
  (parent ?? game.world.group).add(group);
  if (game.world) { game.world.boxes.push(...boxes); game.world.dyn.push(...dyn); }
  return { group, boxes, dyn };
};

game.removeParts = handle => {
  if (!handle || !game.world) return;
  const w = game.world;
  const set = new Set(handle.boxes);
  w.boxes = w.boxes.filter(b => !set.has(b));
  const dset = new Set(handle.dyn);
  w.dyn = w.dyn.filter(d => !dset.has(d));
  handle.group.removeFromParent();
  disposeGroup(handle.group);
  if (me.pl.ground && set.has(me.pl.ground)) me.pl.ground = null;
};

function addSign(s, group) {
  const make = () => {
    const m = signMesh(s.lines, { w: s.w, h: s.h, bg: s.bg, fg: s.fg, accent: s.accent, sizes: s.sizes });
    m.position.set(s.x, s.y, s.z);
    return m;
  };
  const a = make(); a.rotation.y = s.ry ?? 0; group.add(a);
  if (s.double) { const b = make(); b.rotation.y = (s.ry ?? 0) + Math.PI; group.add(b); }
}

// ───── 세계 바꾸기 ─────
function loadWorld(id) {
  const old = game.world;
  if (old) {
    old.runtime?.dispose();
    old.npcs.forEach(n => n.avatar.dispose());
    old.group.removeFromParent();
    disposeGroup(old.group);
  }
  effects.clear();
  const info = WORLD_INFO[id];
  const def = info.build();
  const group = new THREE.Group();
  view.scene.add(group);
  const w = { id, def, group, boxes: [], dyn: [], zones: def.zones ?? [], npcs: [], runtime: null, inZone: new Set() };
  game.world = w; game.worldId = id;
  game.makeParts(def.parts);
  for (const s of def.signs ?? []) addSign(s, group);
  for (const e of def.effects ?? []) effects.add(e);
  effects.setCoins(def.coins ?? []);
  for (const n of def.npcs ?? []) {
    const avatar = new Avatar(n.look, n.name ?? '');
    if (n.mannequin) avatar.setName('🧍 마네킹');
    group.add(avatar.root);
    const pl = newPlayer(n.x, 0.3, n.z);
    w.npcs.push({ ...n, avatar, pl, home: { x: n.x, z: n.z }, dir: { x: 0, z: 0 }, think: Math.random() * 2, yaw: n.yaw ?? 0, talk: 0 });
  }
  if (id === 2) w.runtime = new Tycoon(game);
  if (id === 3) w.runtime = new Survival(game);
  view.setSky(def.sky);
  playMusic(def.sky);
  ui.setWorld(info.icon, info.name);
  if (id !== 2 && id !== 3) ui.setInfo('');
  // 시작 위치
  let spawn = def.spawn;
  if (id === 1) {
    const cp = Math.min(game.save.obby.cp, def.checkpoints.length - 1);
    spawn = def.checkpoints[cp];
    game.obbyStart = performance.now();
    game.obbyTiming = cp === 0;
    if (cp > 0) ui.toast(`🚩 ${cp}번 체크포인트에서 이어 해. 처음부터 하려면 ⚙️ 메뉴!`, 3600);
  }
  game.teleport(spawn.x, spawn.y + 0.05, spawn.z, spawn.yaw);
  controls.faceBehind(spawn.yaw);
  controls.pitch = 0.3;
  sendHi();
  sendPose(true);
  refreshRemoteVisibility();
}

game.teleport = (x, y, z, yaw = me.yaw) => {
  Object.assign(me.pl, { x, y, z, vx: 0, vy: 0, vz: 0, ground: null, air: 0, buf: 0, climb: false });
  me.yaw = yaw;
  me.avatar.visualY = null;
};

async function enterWorld(id) {
  if (game.entering) return;
  game.entering = true;
  sound.portal();
  ui.closeWardrobe();
  await ui.fade(() => loadWorld(id));
  game.entering = false;
  const info = WORLD_INFO[id];
  ui.big(`${info.icon} ${info.name}`, 1500, 'title');
}
game.goHome = () => { if (game.worldId !== 0) enterWorld(0); else { const s = game.world.def.spawn; game.teleport(s.x, s.y, s.z, s.yaw); controls.faceBehind(s.yaw); } };

// ───── 죽고 다시 나기 ─────
game.burstMe = () => {
  const m = me.avatar.mats;
  effects.burst(me.pl.x, me.pl.y + 1.4, me.pl.z, [m.skin.color, m.shirt.color, m.pants.color].map(c => '#' + c.getHexString()), 26, 8);
};

function die() {
  if (me.dead > 0) return;
  me.dead = 1.1;
  me.avatar.root.visible = false;
  game.burstMe();
  sound.die();
}

function respawn() {
  me.avatar.root.visible = true;
  const w = game.world;
  let s = w.def.spawn;
  if (w.id === 1) s = w.def.checkpoints[Math.min(game.save.obby.cp, w.def.checkpoints.length - 1)];
  game.teleport(s.x, s.y + 0.05, s.z, s.yaw);
  controls.faceBehind(s.yaw);
}

// ───── 점프 탑 ─────
function reachCheckpoint(cp) {
  const o = game.save.obby;
  if (cp <= o.cp) return;
  o.cp = cp;
  if (cp > o.top) o.top = cp;
  const c = game.world.def.checkpoints[cp];
  effects.burst(c.x, c.y + 0.6, c.z, ['#ffffff', '#ffd23f', '#ff8fc7'], 18, 6);
  sound.check();
  if (cp > o.paid) {
    let coins = 0;
    for (let s = o.paid + 1; s <= cp; s++) coins += obbyStageCoins(s);
    o.paid = cp;
    game.addCoins(coins);
    ui.toast(`🚩 체크포인트 ${cp}! 🪙+${coins}`);
  } else ui.toast(`🚩 체크포인트 ${cp}`);
  if (cp === OBBY_STAGES) finishObby();
  game.persist();
}

function finishObby() {
  const o = game.save.obby;
  o.clears++;
  const c = game.world.def.checkpoints[OBBY_STAGES];
  effects.confetti(c.x, c.y + 3, c.z, 260);
  sound.win();
  game.addCoins(OBBY_CLEAR_COINS);
  let msg = `🏆 꼭대기 도착! 🪙+${OBBY_CLEAR_COINS}`;
  if (game.obbyTiming) {
    const t = performance.now() - game.obbyStart;
    if (!o.best || t < o.best) { o.best = Math.round(t); msg += ` · 새 기록 ${fmtTime(t)}!`; } else msg += ` · ${fmtTime(t)}`;
  }
  ui.big(msg, 4200, 'gold');
  game.obbyTiming = false;
  game.persist();
}

game.restartObby = () => {
  game.save.obby.cp = 0;
  game.persist();
  if (game.worldId === 1) { respawn(); game.obbyStart = performance.now(); game.obbyTiming = true; ui.toast('처음부터 다시! 🏃'); }
};

// ───── 옷장 ─────
game.wardrobe = open => {
  game.wardrobeOpen = open;
  document.body.classList.toggle('dressing', open);
  if (open) game.wardrobeYaw = me.yaw;
  else view.camera.clearViewOffset();
  controls.enabled = !open;
  me.emote = 0;
  if (!open) { controls.faceBehind(me.yaw); sendHi(); }
};
game.setLook = part => {
  Object.assign(game.save.look, part);
  me.avatar.setLook(game.save.look);
  game.persist();
};
game.setName = n => { game.save.name = n; game.persist(); sendHi(); };
game.buyLookItem = (key, i) => {
  const item = LOOK_KEYS[key][i];
  if (game.save.coins < item.price) { sound.nope(); ui.toast(`🪙 코인이 ${item.price - game.save.coins}개 모자라! 점프 탑과 게임에서 모아 봐.`); return false; }
  game.save.coins -= item.price;
  game.save.owned[key].push(i);
  game.save.owned[key].sort((a, b) => a - b);
  ui.setCoins(game.save.coins);
  sound.buy();
  game.setLook({ [key]: i });
  ui.toast(`✨ ${item.name} 샀어!`);
  return true;
};

// ───── 말, 감정 표현 ─────
game.say = i => {
  me.avatar.say(PHRASES[i]);
  sound.say();
  ui.log(`나: ${PHRASES[i]}`);
  game.net.send({ t: 'say', i });
};
game.emote = i => { me.emote = i; sendPose(true); };

// ───── 소리 ─────
game.toggleSound = () => { game.save.sound = !game.save.sound; setSound(game.save.sound); ui.syncMenu(); game.persist(); };
game.toggleMusic = () => { game.save.music = !game.save.music; setMusic(game.save.music); ui.syncMenu(); game.persist(); };

game.resetAll = () => {
  const keepName = game.save.name;
  game.save = defaultSave();
  game.save.name = keepName;
  writeLocal();
  game.cloud.queue();
  me.avatar.setLook(game.save.look);
  ui.setCoins(0);
  ui.toast('기록을 모두 지웠어. 처음부터 시작!');
  loadWorld(0);
};

// ───── 친구와 같이 ─────
game.net = new Net({
  status: () => { ui.renderFriends(); },
  opened: () => {
    ui.renderFriends();
    sendHi(); sendPose(true);
    if (game.worldId === 2) loadWorld(2); // 내 땅 번호가 바뀐다
  },
  closed: () => { for (const id of [...game.remotes.keys()]) removeRemote(id); ui.renderFriends(); if (game.worldId === 2) loadWorld(2); },
  join: id => { sendHi(id); sendPose(true); },
  depart: id => { if (id) removeRemote(id); else for (const k of [...game.remotes.keys()]) removeRemote(k); ui.renderFriends(); },
  message: (data, from) => onMessage(data, from),
});

function myHi() {
  const msg = { t: 'hi', n: game.save.name, l: lookToArray(game.save.look), w: game.worldId };
  if (game.worldId === 2 && game.world?.runtime) msg.o = game.world.runtime.itemIndexes();
  else msg.o = game.save.tycoon.items.length ? undefined : undefined;
  return msg;
}
function sendHi(to) {
  if (!game.net?.active) return;
  const msg = myHi();
  if (to) game.net.sendTo(to, msg); else game.net.send(msg);
}

let poseTimer = 0, lastPose = '';
function sendPose(force) {
  if (!game.net?.live) return;
  const anim = me.pl.climb ? 2 : me.pl.ground ? 0 : 1;
  const q = packPose(me.pl, me.yaw, game.worldId, anim, me.emote);
  const key = q.join(',');
  if (!force && key === lastPose && poseTimer > -0.9) return;
  lastPose = key; poseTimer = 0;
  game.net.send({ t: 'p', q });
}

function getRemote(id) {
  let r = game.remotes.get(id);
  if (!r) {
    r = { id, name: '친구', look: null, avatar: null, w: -1, x: 0, y: -100, z: 0, yaw: 0, tx: 0, ty: -100, tz: 0, tyaw: 0, anim: 0, emote: 0, speed: 0, muted: false, slot: slotOf(id), tycoon: null, where: '' };
    game.remotes.set(id, r);
  }
  return r;
}
const slotOf = id => { const n = parseInt(String(id).replace(/\D/g, ''), 10); return Number.isFinite(n) && n > 0 ? (n - 1) % PLOT_SLOTS.length : 0; };

function removeRemote(id) {
  const r = game.remotes.get(id);
  if (!r) return;
  r.avatar?.dispose();
  game.remotes.delete(id);
  if (game.worldId === 2 && r.tycoon) game.world.runtime?.remoteChanged(r.slot);
  ui.log(`${r.name} 님이 나갔어`);
  updatePlayerList();
}

function onMessage(data, from) {
  const r = getRemote(from);
  switch (data.t) {
    case 'hi': {
      const first = !r.avatar;
      const n = Array.isArray(data.n) ? [data.n[0] | 0, data.n[1] | 0] : [0, 0];
      r.name = displayName([Math.min(Math.max(n[0], 0), ADJECTIVES.length - 1), Math.min(Math.max(n[1], 0), ANIMALS.length - 1)]);
      r.look = lookFromArray(data.l);
      if (!r.avatar) { r.avatar = new Avatar(r.look, r.name); view.scene.add(r.avatar.root); }
      else { r.avatar.setLook(r.look); r.avatar.setName(r.name); }
      if (Number.isInteger(data.w)) r.w = data.w;
      if (data.o !== undefined) {
        const items = remoteTycoonFrom(data.o);
        if (items) { r.tycoon = items; if (game.worldId === 2) game.world.runtime?.remoteChanged(r.slot); }
      }
      if (first) { ui.log(`${r.name} 님이 들어왔어! 👋`); sound.pop(); }
      refreshRemoteVisibility();
      updatePlayerList();
      ui.renderFriends();
      break;
    }
    case 'p': {
      const p = unpackPose(data.q);
      if (!p) return;
      const moved = p.w !== r.w;
      r.w = p.w; r.tx = p.x; r.ty = p.y; r.tz = p.z; r.tyaw = p.yaw; r.anim = p.anim; r.emote = p.emote;
      if (moved || r.y < -90) { r.x = p.x; r.y = p.y; r.z = p.z; r.yaw = p.yaw; refreshRemoteVisibility(); updatePlayerList(); }
      break;
    }
    case 'say': {
      const i = data.i;
      if (!Number.isInteger(i) || i < 0 || i >= PHRASES.length || r.muted) return;
      if (r.w === game.worldId) r.avatar?.say(PHRASES[i]);
      ui.log(`${r.name}: ${PHRASES[i]}`);
      sound.say();
      break;
    }
    case 'ty': {
      const items = remoteTycoonFrom(data.o);
      if (!items) return;
      r.tycoon = items;
      if (game.worldId === 2) game.world.runtime?.remoteChanged(r.slot);
      break;
    }
    case 'sv':
      if (game.worldId === 3 && game.world.runtime) game.world.runtime.message(data, from);
      break;
    default: break;
  }
}

function refreshRemoteVisibility() {
  for (const r of game.remotes.values()) if (r.avatar) r.avatar.root.visible = r.w === game.worldId && !r.muted;
}
function updatePlayerList() {
  const list = [...game.remotes.values()].filter(r => r.avatar).map(r => { r.where = WORLD_INFO[r.w]?.name ?? ''; return r; });
  ui.setPlayers(list);
}
game.toggleMute = id => { const r = game.remotes.get(id); if (!r) return; r.muted = !r.muted; refreshRemoteVisibility(); };

// ───── 시작 ─────
game.start = () => {
  unlock();
  if (game.started) return;
  game.started = true;
  $('title').hidden = true;
  document.body.classList.add('playing');
  controls.enabled = true;
  controls.faceBehind(me.yaw);
  canvas.focus();
  if (game.cloud.loggedIn) game.cloud.sync();
  if (!game.save.tutorial) {
    game.save.tutorial = true; game.persist();
    setTimeout(() => ui.toast('빛나는 문으로 걸어 들어가면 게임이 시작돼! 🌈🏭🔥', 4200), 900);
  }
};

controls.onKey = (k) => {
  if (!game.started) { if (k === 'Enter' || k === 'Space') game.start(); return; }
  if (k === 'Escape') { ui.closeWardrobe(); ui.closeFriends(); ui.togglePanel(null); }
  if (game.wardrobeOpen) return;
  if (k === 'KeyT' || k === 'Slash') ui.togglePanel('chat');
  if (k === 'KeyG') ui.togglePanel('emote');
  if (k === 'KeyR' && game.worldId === 0) game.goHome();
  if (k.startsWith('Digit')) { const n = Number(k.slice(5)); if (n >= 1 && n <= 4) game.emote(n); }
};

// ───── 매 프레임 ─────
let last = performance.now(), titleSpin = 0;
const epoch = () => (Date.now() / 1000) % 100000;

function updateWorld(dt) {
  const w = game.world;
  const t = epoch();
  clearMotion(w.boxes);
  for (const d of w.dyn) {
    const p = d.p;
    if (d.spin) {
      d.angle = t * p.spin.spd;
      d.mesh.rotation.y = d.angle;
      continue;
    }
    if (p.move) {
      const off = Math.sin(t * p.move.spd + p.move.ph) * p.move.amp;
      const x = d.base.x + (p.move.ax === 'x' ? off : 0), y = d.base.y + (p.move.ax === 'y' ? off : 0), z = d.base.z + (p.move.ax === 'z' ? off : 0);
      if (d.box) placeBox(d.box, x, y, z);
      d.mesh.position.set(x, y, z);
    }
    if (d.fade) {
      const f = d.fade;
      if (f.state === 1) { f.t += dt; d.mesh.material.opacity = 1 - (f.t / 0.55) * 0.5; d.mesh.position.x = d.base.x + (Math.random() - 0.5) * 0.08; if (f.t > 0.55) { f.state = 2; f.t = 0; d.box.on = false; d.mesh.visible = false; } }
      else if (f.state === 2) { f.t += dt; if (f.t > 2.6) { f.state = 0; d.box.on = true; d.mesh.visible = true; d.mesh.material.opacity = 1; d.mesh.position.x = d.base.x; } }
    }
    if (p.flag) d.mesh.rotation.y = Math.sin(t * 3) * 0.15;
    if (p.turn) d.mesh.rotation[p.turn.ax] = (p.turn.base ?? 0) + t * p.turn.spd;
  }
  // 재질 움직이기
  const arrow = tex('arrow'); arrow.offset.y -= dt * 1.6;
  for (const m of animated.lava) { m.map.offset.x += dt * 0.02; m.map.offset.y += dt * 0.012; m.emissiveIntensity = 1.1 + Math.sin(t * 2) * 0.15; }
  for (const m of animated.water) { m.normalMap.offset.x += dt * 0.01; m.normalMap.offset.y += dt * 0.006; }
}

function hazards() {
  for (const d of game.world.dyn) {
    if (!d.spin) continue;
    const p = d.p, a = d.angle ?? 0, h = p.spin.len / 2;
    const ax = p.x + Math.sin(a) * h, az = p.z + Math.cos(a) * h, bx = p.x - Math.sin(a) * h, bz = p.z - Math.cos(a) * h;
    if (me.pl.y < p.y + 0.3 && me.pl.y + P.H > p.y - 0.3 && segmentDistance(me.pl.x, me.pl.z, ax, az, bx, bz) < P.R + 0.28) return true;
  }
  return false;
}

function updateNpcs(dt) {
  for (const n of game.world.npcs) {
    const pl = n.pl;
    const near = Math.hypot(me.pl.x - pl.x, me.pl.z - pl.z) < 6;
    if (n.wander) {
      n.think -= dt;
      if (n.think <= 0) {
        n.think = 2 + Math.random() * 4;
        if (Math.random() < 0.55) { const a = Math.random() * Math.PI * 2, r = Math.random() * 12; const tx = n.home.x + Math.cos(a) * r - pl.x, tz = n.home.z + Math.sin(a) * r - pl.z, l = Math.hypot(tx, tz) || 1; n.dir = { x: tx / l * 0.45, z: tz / l * 0.45 }; }
        else n.dir = { x: 0, z: 0 };
      }
      if (near) n.dir = { x: 0, z: 0 };
      stepPlayer(pl, { mx: n.dir.x, mz: n.dir.z, jump: false }, game.world.boxes, dt);
      const sp = Math.hypot(pl.vx, pl.vz);
      if (sp > 0.3) n.yaw = Math.atan2(pl.vx, pl.vz);
      else if (near) n.yaw = Math.atan2(me.pl.x - pl.x, me.pl.z - pl.z);
      n.avatar.place(pl.x, pl.y, pl.z, n.yaw, dt);
      n.avatar.animate(dt, { speed: sp, grounded: true, vy: 0, climb: false, emote: near && sp < 0.3 ? 1 : 0 });
    } else {
      if (near) n.yaw += (Math.atan2(me.pl.x - pl.x, me.pl.z - pl.z) - n.yaw) * 0.1;
      n.avatar.place(pl.x, pl.y, pl.z, n.yaw, dt);
      n.avatar.animate(dt, { speed: 0, grounded: true, vy: 0, climb: false, emote: n.mannequin ? 0 : near ? 1 : 0 });
    }
    n.talk -= dt;
    if (near && n.talk <= 0 && !n.mannequin) {
      n.talk = 9;
      const lines = n.still ? ['어서 와! 옷 구경해 👕', '모자도 새로 들어왔어!'] : ['안녕! 👋', '문으로 들어가 봐!', '점프 탑 꼭대기에 트로피가 있대!', '코인 모아서 왕관 사고 싶어 👑'];
      n.avatar.say(lines[Math.floor(Math.random() * lines.length)]);
    }
  }
}

function updateMe(dt) {
  const w = game.world;
  if (me.dead > 0) {
    me.dead -= dt;
    if (me.dead <= 0) respawn();
    return;
  }
  const mv = game.wardrobeOpen || !game.started ? { x: 0, z: 0 } : controls.move();
  const jump = game.started && !game.wardrobeOpen && controls.takeJump();
  const ev = stepPlayer(me.pl, { mx: mv.x, mz: mv.z, jump }, w.boxes, dt);
  const moving = Math.hypot(mv.x, mv.z) > 0.1;
  if (moving) {
    const target = Math.atan2(mv.x, mv.z);
    let d = target - me.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    me.yaw += d * (1 - Math.exp(-dt * 16));
    if (me.emote) { me.emote = 0; sendPose(true); }
  }
  if (ev.jumped) { sound.jump(); if (me.emote) me.emote = 0; }
  if (ev.bounce) sound.bounce();
  if (ev.landed && ev.hard) sound.land();
  if (ev.kill || hazards()) { die(); return; }
  if (ev.landed?.part?.cp !== undefined && w.id === 1) reachCheckpoint(ev.landed.part.cp);
  const killY = w.id === 1 ? w.def.checkpoints[Math.min(game.save.obby.cp, w.def.checkpoints.length - 1)].y - 40 : w.def.killY ?? -30;
  if (me.pl.y < killY) { die(); return; }
  // 코인
  const got = effects.takeCoins(me.pl.x, me.pl.y, me.pl.z);
  if (got.length) { sound.coin(); game.addCoins(got.length); }
  // 구역
  for (const z of w.zones) {
    const inside = me.pl.x > z.x0 && me.pl.x < z.x1 && me.pl.y + 1 > z.y0 && me.pl.y < z.y1 && me.pl.z > z.z0 && me.pl.z < z.z1;
    if (inside && !w.inZone.has(z)) {
      w.inZone.add(z);
      if (z.portal !== undefined) { enterWorld(z.portal); return; }
      if (z.wardrobe) ui.openWardrobe();
      if (z.finish && game.save.obby.cp >= OBBY_STAGES) { /* 꼭대기 */ }
    } else if (!inside) w.inZone.delete(z);
  }
}

function updateRemotes(dt) {
  const k = 1 - Math.exp(-dt * 10);
  for (const r of game.remotes.values()) {
    if (!r.avatar || r.w !== game.worldId) continue;
    const px = r.x, pz = r.z;
    // 받은 위치로 부드럽게 (멀면 바로)
    if (Math.hypot(r.tx - r.x, r.ty - r.y, r.tz - r.z) > 12) { r.x = r.tx; r.y = r.ty; r.z = r.tz; }
    r.x += (r.tx - r.x) * k; r.y += (r.ty - r.y) * k; r.z += (r.tz - r.z) * k;
    let d = r.tyaw - r.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); r.yaw += d * k;
    const sp = Math.hypot(r.x - px, r.z - pz) / Math.max(dt, 1e-3);
    r.speed += (sp - r.speed) * Math.min(1, dt * 8);
    r.avatar.place(r.x, r.y, r.z, r.yaw, dt);
    r.avatar.animate(dt, { speed: r.speed, grounded: r.anim === 0, vy: r.anim === 1 ? (r.ty > r.y ? 1 : -1) : 0, climb: r.anim === 2, emote: r.emote });
  }
}

function updateInfo() {
  if (game.worldId === 1) {
    const o = game.save.obby;
    const stage = Math.min(o.cp + 1, OBBY_STAGES);
    const name = o.cp >= OBBY_STAGES ? '🏆 꼭대기!' : OBBY_NAMES[o.cp];
    const time = game.obbyTiming ? fmtTime(performance.now() - game.obbyStart) : '이어 하기';
    ui.setInfo(`<b>STAGE ${stage}/${OBBY_STAGES} · ${name}</b><small>⏱ ${time}${o.best ? ` · 최고 ${fmtTime(o.best)}` : ''}</small>`);
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  updateWorld(dt);
  updateMe(dt);
  game.world.runtime?.update(dt);
  updateNpcs(dt);
  updateRemotes(dt);
  effects.update(dt, now / 1000);
  view.clouds.update(dt);
  me.hurtCooldown -= dt;
  // 내 아바타
  const speed = Math.hypot(me.pl.vx, me.pl.vz);
  me.avatar.place(me.pl.x, me.pl.y, me.pl.z, me.yaw, dt);
  me.avatar.animate(dt, { speed, grounded: !!me.pl.ground, vy: me.pl.vy, climb: me.pl.climb, emote: me.emote });
  // 카메라
  const tx = me.pl.x, ty = (me.avatar.visualY ?? me.pl.y) + 2.3, tz = me.pl.z;
  if (!game.started) {
    titleSpin += dt * 0.08;
    view.camera.position.set(Math.sin(titleSpin) * 34, 14, Math.cos(titleSpin) * 34 + 4);
    view.camera.lookAt(0, 4, -6);
  } else if (game.wardrobeOpen) {
    // 아바타를 정면에서 보고, 옷장이 가린 만큼 화면을 밀어서 남은 곳 가운데에 오게 한다
    const a = game.wardrobeYaw;
    const wide = innerWidth > 760;
    const dist = wide ? 7.4 : 6.2;
    view.camera.position.set(me.pl.x + Math.sin(a) * dist, me.pl.y + 2.1, me.pl.z + Math.cos(a) * dist);
    view.camera.lookAt(me.pl.x, me.pl.y + 1.45, me.pl.z);
    const W = innerWidth, H = innerHeight;
    const panel = document.getElementById('wardrobe').getBoundingClientRect();
    if (wide) view.camera.setViewOffset(W, H, panel.width / 2, 0, W, H);
    else view.camera.setViewOffset(W, H, 0, (H - panel.top) / 2, W, H);
    me.yaw = a + Math.sin(now / 1400) * 0.5;
  } else controls.update(view.camera, tx, ty, tz, game.world.boxes, dt);
  view.follow(me.pl.x, me.pl.y, me.pl.z);
  // 네트워크
  poseTimer -= dt;
  if (poseTimer <= -0.075) { poseTimer = 0; sendPose(false); }
  updateInfo();
  view.render();
  requestAnimationFrame(frame);
}

loadWorld(0);
requestAnimationFrame(t => { last = t; frame(t); });
$('loading')?.remove();

// 디버그 (시험용): 콘솔에서 쓰기
globalThis.brickverse = { game, me, enterWorld, loadWorld, view, controls };
