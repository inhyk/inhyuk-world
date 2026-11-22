// 모아몬 탐험대: 걸어서 찾고, 방울로 잡고, 같이 자라는 모험
import * as THREE from 'three';
import { World, moodAt } from './src/world.js';
import { buildMon } from './src/monsters.js';
import { Encounter } from './src/encounter.js';
import { Battle } from './src/battle.js';
import { UI } from './src/ui.js';
import * as audio from './src/audio.js';
import * as C from './core.mjs';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;

function load() { try { return C.fixSave(JSON.parse(localStorage.getItem(C.SAVE_KEY))); } catch { return C.newSave(); } }
const hitGeo = new THREE.SphereGeometry(1, 8, 6), hitMat = new THREE.MeshBasicMaterial({ visible: false });

const game = {
  save: load(), mode: 'title', wild: [], pending: null, walkAcc: 0, weather: 'sunny', mood: 'day', saveWarned: false,
  persist() { this.save.pos = { x: Math.round(world.pos.x * 10) / 10, z: Math.round(world.pos.z * 10) / 10 }; try { localStorage.setItem(C.SAVE_KEY, JSON.stringify(this.save)); } catch { if (!this.saveWarned) { this.saveWarned = true; ui.toast('이 브라우저에서는 저장이 안 돼. 창을 닫으면 기록이 사라져.', '⚠️'); } } },
  sfx: (n) => audio.sfx(n),
  applySettings() { audio.setOptions(this.save.settings); },
  distTo(p) { return Math.hypot((p.x ?? p.group.position.x) - world.pos.x, (p.z ?? p.group.position.z) - world.pos.z); },
  setMusic() { audio.music(this.mode === 'encounter' ? 'catch' : this.mode === 'battle' ? 'battle' : this.mood === 'night' ? 'night' : 'map'); },
  // ----- 야생 몬스터 -----
  addWild(mon, x, z) {
    const group = new THREE.Group(); group.position.set(x, 0, z); const model = buildMon(mon.sp, mon.shiny); model.scale.multiplyScalar(1.25); group.add(model);
    const hit = new THREE.Mesh(hitGeo, hitMat); const r = Math.max(1.2, model.userData.radius * 1.9); hit.scale.setScalar(r); hit.position.y = Math.max(0.9, model.userData.center * 1.25); group.add(hit);
    const a = { group, model, mon, hit, age: 0, life: 150 + Math.random() * 120, hopT: Math.random() * 3, hop: 0, face: Math.random() * 6.28, seed: Math.random() * 10 }; hit.userData.pick = { type: 'mon', actor: a }; group.scale.setScalar(0.001);
    world.addActor(a); this.wild.push(a); return a;
  },
  removeWild(a) { world.removeActor(a); const k = this.wild.indexOf(a); if (k >= 0) this.wild.splice(k, 1); if (this.pending?.actor === a) this.pending = null; },
  trySpawn() {
    const inc = this.save.incenseUntil > Date.now(), a = Math.random() * 6.283, d = inc ? 7 + Math.random() * 16 : 11 + Math.random() * 30, x = world.pos.x + Math.cos(a) * d, z = world.pos.z + Math.sin(a) * d;
    if (!world.isFree(x, z, 1.4) || this.wild.some((w) => Math.hypot(w.group.position.x - x, w.group.position.z - z) < 5)) return;
    this.addWild(C.pickSpawn(world.biomeAt(x, z), this.mood === 'night', this.weather, this.save.lv), x, z);
  },
  updateWild(dt, t) {
    const p = world.pos, want = this.save.incenseUntil > Date.now() ? 11 : 7;
    this.spawnT = (this.spawnT || 0) - dt; if (this.spawnT <= 0 && this.wild.length < want) { this.spawnT = this.wild.length < 3 ? 0.3 : 1.6; this.trySpawn(); }
    for (let i = this.wild.length - 1; i >= 0; i--) {
      const a = this.wild[i], g = a.group; if (a.hidden) continue; a.age += dt; const d = Math.hypot(g.position.x - p.x, g.position.z - p.z);
      if (d > 85 || a.age > a.life) { a.out = (a.out || 0) + dt * 2.5; if (a.out >= 1) { this.removeWild(a); continue; } }
      const k = Math.min(1, a.age / 0.45), pop = k < 1 ? (1 - Math.pow(1 - k, 3)) * (1 + Math.sin(k * Math.PI) * 0.25) : 1; g.scale.setScalar(Math.max(0.001, pop * (1 - (a.out || 0))));
      a.hopT -= dt; if (a.hopT <= 0) { a.hopT = 1.6 + Math.random() * 2.6; a.hop = 0.45; if (d > 16) a.face += (Math.random() - 0.5) * 2; }
      if (a.hop > 0) { a.hop -= dt; a.model.position.y = Math.sin((1 - a.hop / 0.45) * Math.PI) * 0.5; } else a.model.position.y = 0;
      const want2 = d < 16 ? Math.atan2(p.x - g.position.x, p.z - g.position.z) : a.face; let da = want2 - g.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); g.rotation.y += da * Math.min(1, dt * 4);
      if (d < 70) a.model.userData.update(t + a.seed);
    }
  },
  near() { return this.wild.filter((a) => !a.hidden && !a.out).map((a) => { a.dist = this.distTo(a); return a; }).sort((a, b) => a.dist - b.dist); },
  goTo(a) { this.handlePick({ type: 'mon', actor: a }); },
  // ----- 누른 것 처리 -----
  handlePick(hit) {
    if (!hit) return; ui.tip('');
    if (hit.type === 'ground') { this.pending = null; world.walkTo(hit.x, hit.z); return; }
    const tx = hit.actor ? hit.actor.group.position.x : hit.poi.x, tz = hit.actor ? hit.actor.group.position.z : hit.poi.z, range = hit.type === 'mon' ? 24 : hit.type === 'stop' ? 22 : 28;
    const d = Math.hypot(tx - world.pos.x, tz - world.pos.z);
    if (d <= range) return this.trigger(hit);
    const stopAt = hit.type === 'arena' ? 8 : 4; world.walkTo(tx + ((world.pos.x - tx) / d) * stopAt, tz + ((world.pos.z - tz) / d) * stopAt); this.pending = { ...hit, range: range - 6, tx, tz };
  },
  trigger(hit) { this.pending = null; if (hit.type === 'mon') this.startEncounter(hit.actor); else if (hit.type === 'stop') { ui.openStop(hit.poi); audio.sfx('open'); } else { ui.openArena(hit.poi); audio.sfx('open'); } },
  // ----- 잡기 -----
  startEncounter(actor, starterMon) {
    const s = this.save, mon = starterMon || actor.mon;
    if (s.mons.length >= C.MAX_MONS) return ui.toast('친구가 너무 많아. 몇 마리를 보내 주고 다시 와.', '📦');
    const ball = ['ball', 'ball2', 'ball3'].find((k) => s.items[k] > 0);
    if (!ball) return ui.toast('방울이 하나도 없어! 별샘을 돌리거나 상점에서 사자.', '🫧');
    world.target = null; world.marker.visible = false; if (actor) { actor.hidden = true; actor.group.visible = false; }
    s.dex[mon.sp] = { ...(s.dex[mon.sp] || { caught: 0 }), seen: 1 };
    this.mode = 'encounter'; this.encActor = actor; ui.setMode('encounter'); this.setMusic();
    const biome = actor ? world.biomeAt(actor.group.position.x, actor.group.position.z) : 'park';
    enc.sure = !!starterMon; enc.start(mon, biome, this.mood, {
      sfx: audio.sfx, say: (t, k) => ui.say(t, k), changed: () => ui.encRefresh(),
      useBall: (k) => { if (!(s.items[k] > 0)) { const o = ['ball', 'ball2', 'ball3'].find((x) => s.items[x] > 0); if (o) { enc.setBall(o); ui.toast(`${C.josa(C.ITEMS[k].name, '이', '가')} 없어서 ${C.josa(C.ITEMS[o].name, '으로', '로')} 바꿨어`); } else { ui.toast('방울을 다 썼어...', '🫧'); setTimeout(() => this.endEncounter(false), 700); } return false; } s.items[k]--; return true; },
      done: (r) => {
        if (!r.caught) return this.endEncounter(true);
        const info = C.onCaught(s, mon, r.bonus, r.gold, r.firstTry); C.questEvent(s, 'catch'); C.questEvent(s, 'el', 1, C.species(mon.sp).el); if (r.bonus) C.questEvent(s, 'nice');
        if (starterMon) { s.started = true; s.buddy = mon.uid; mon.fav = true; this.buddyChanged(); }
        this.persist(); ui.catchResult(mon, info, () => { this.endEncounter(true); if (starterMon) ui.tip('땅을 누르거나 WASD로 걸어 봐. 몬스터를 누르면 잡을 수 있어!'); });
      },
    });
    enc.setBall(ball); ui.encRefresh();
  },
  endEncounter(gone) { const a = this.encActor; if (a) { if (gone) this.removeWild(a); else { a.hidden = false; a.group.visible = true; a.life = a.age + 40; } } enc.stop(); this.encActor = null; this.mode = 'map'; ui.setMode('map'); this.setMusic(); this.persist(); if (!this.save.started) ui.starters((id) => this.pickStarter(id)); },
  runAway() { if (enc.sure || !enc.active || (enc.state !== 'aim' && enc.state !== 'intro')) return; audio.sfx('close'); this.endEncounter(false); },
  feed(k) { const s = this.save; if (!(s.items[k] > 0)) return; if (enc.feed(k)) { s.items[k]--; ui.encRefresh(); } },
  pickStarter(id) { this.startEncounter(null, C.makeMon(id, 3, Math.random, { iv: [10, 10, 10], shiny: false })); },
  // ----- 별샘, 도장, 물건 -----
  spinStop(poi) {
    const s = this.save, now = Date.now(); if (this.distTo(poi) > 24 || (s.stopCd[poi.key] || 0) > now) return null;
    const r = C.spinLoot(s); s.stopCd[poi.key] = now + C.STOP_COOLDOWN; for (const k in s.stopCd) if (s.stopCd[k] < now) delete s.stopCd[k];
    C.questEvent(s, 'spin'); const pg = world.pois.get(poi.key); if (pg) { pg.userData.spin = 1.2; pg.userData.setReady(false); } audio.sfx('spin'); this.persist(); ui.refresh(); return r;
  },
  useIncense() { const s = this.save; if (!(s.items.incense > 0)) return false; s.items.incense--; s.incenseUntil = Math.max(Date.now(), s.incenseUntil) + 5 * 60e3; this.persist(); audio.sfx('shiny'); return true; },
  startBattle(poi, mine, foes) {
    if (!mine.length) return; this.mode = 'battle'; ui.batKey = null; ui.setMode('battle'); this.setMusic(); world.target = null;
    battle.start(mine, foes.team, foes.el, this.mood, { sfx: audio.sfx, say: (t, k) => ui.say(t, k), dmg: (n, side, eff) => ui.dmg(n, side, eff), changed: () => ui.batRefresh(),
      done: ({ win }) => { let r = null; if (win) { r = C.arenaReward(this.save, poi.key); C.questEvent(this.save, 'win'); this.persist(); } ui.battleResult(win, r, () => { battle.stop(); this.mode = 'map'; ui.setMode('map'); this.setMusic(); }); } });
    ui.batRefresh();
  },
  buddyChanged() {
    if (this.buddy) { world.scene.remove(this.buddy); this.buddy = null; }
    const b = this.save.mons.find((m) => m.uid === this.save.buddy); if (!b) return;
    const m = buildMon(b.sp, b.shiny); m.scale.multiplyScalar(0.85); m.position.set(world.pos.x - 1.5, 0, world.pos.z - 1.5); world.scene.add(m); this.buddy = m;
  },
  updateBuddy(dt, t) {
    const b = this.buddy; if (!b) return; const p = world.pos, bx = p.x - Math.sin(world.heading) * 1.6 + Math.cos(world.heading) * 1.0, bz = p.z - Math.cos(world.heading) * 1.6 - Math.sin(world.heading) * 1.0;
    const dx = bx - b.position.x, dz = bz - b.position.z, d = Math.hypot(dx, dz);
    if (d > 30) b.position.set(bx, 0, bz); else if (d > 0.25) { const sp = Math.min(d * 4, 9) * dt; b.position.x += (dx / d) * sp; b.position.z += (dz / d) * sp; let da = Math.atan2(dx, dz) - b.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); b.rotation.y += da * Math.min(1, dt * 10); b.position.y = b.userData.float ? 0 : Math.abs(Math.sin(t * 9)) * 0.22; } else b.position.y *= 0.8;
    b.userData.update(t);
  },
  reset() { try { localStorage.removeItem(C.SAVE_KEY); } catch { /* 저장이 안 되는 곳 */ } location.reload(); },
  refreshSky() { const now = Date.now(); this.mood = q.get('mood') || moodAt(now); this.weather = q.get('weather') || C.weatherAt(now); world.setMood(this.mood, this.weather); if (C.ensureQuests(this.save, now)) this.persist(); if (this.mode !== 'title') this.setMusic(); },
};

const world = new World(), enc = new Encounter(), battle = new Battle();
world.arenaEl = (poi) => C.arenaTeam(poi.seed, 0, 1).el;
game.world = world; game.enc = enc; game.battle = battle;
const chanceOf = enc.chance.bind(enc); enc.chance = (b) => (enc.sure ? 1 : chanceOf(b));
const ui = new UI(game); game.ui = ui;
world.pos.set(game.save.pos.x || 0, 0, game.save.pos.z ?? 7); if (!game.save.started) world.pos.set(0, 0, 7);
world.cam.tx = world.pos.x; world.cam.tz = world.pos.z; world.cam.pitch = 0.5; world.cam.dist = 16;
game.refreshSky(); world.ensureBlocks(300); game.applySettings(); game.buddyChanged();
ui.setMode('title'); ui.title(game.save.started, () => { audio.unlock(); game.mode = 'map'; ui.setMode('map'); game.setMusic(); audio.sfx('appear'); if (!game.save.started) ui.starters((id) => game.pickStarter(id)); });

// ----- 입력 -----
const keys = {}, ptr = new Map(); let drag = null, pinch = 0;
addEventListener('keydown', (e) => { keys[e.code] = 1; if (e.code === 'Escape') { if (!ui.$('menu').hidden) ui.a_menu(); else if (ui.panel) ui.a_close(); } if (game.mode === 'battle') { if (e.code === 'Space') { battle.tap(); e.preventDefault(); } if (e.code === 'KeyQ') battle.charge(); if (e.code === 'KeyF') battle.dodge(); } });
addEventListener('keyup', (e) => { keys[e.code] = 0; }); addEventListener('blur', () => { for (const k in keys) keys[k] = 0; });
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock(); canvas.setPointerCapture(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]);
  if (game.mode === 'encounter') return enc.down(e.clientX, e.clientY);
  if (game.mode === 'battle') return battle.tap();
  if (ptr.size === 1) drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false }; else if (ptr.size === 2) { const p = [...ptr.values()]; pinch = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]); if (drag) drag.moved = true; }
});
canvas.addEventListener('pointermove', (e) => {
  if (!ptr.has(e.pointerId)) return; ptr.set(e.pointerId, [e.clientX, e.clientY]);
  if (game.mode === 'encounter') return enc.move(e.clientX, e.clientY);
  if (game.mode !== 'map') return;
  if (ptr.size === 2) { const p = [...ptr.values()], d = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]); if (pinch) world.cam.dist = Math.max(8, Math.min(34, world.cam.dist * (pinch / d))); pinch = d; return; }
  if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 8) drag.moved = true;
  if (drag.moved) { world.cam.yaw -= dx * 0.006; world.cam.pitch = Math.max(0.22, Math.min(1.3, world.cam.pitch + dy * 0.004)); } drag.x = e.clientX; drag.y = e.clientY;
});
const pup = (e) => {
  if (!ptr.has(e.pointerId)) return; ptr.delete(e.pointerId); pinch = 0;
  if (game.mode === 'encounter') return enc.up(e.clientX, e.clientY);
  if (game.mode === 'map' && drag && !drag.moved && e.type === 'pointerup' && !ui.busy) game.handlePick(world.pick((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1));
  if (!ptr.size) drag = null;
};
canvas.addEventListener('pointerup', pup); canvas.addEventListener('pointercancel', pup);
canvas.addEventListener('wheel', (e) => { if (game.mode === 'map') world.cam.dist = Math.max(8, Math.min(34, world.cam.dist * (1 + Math.sign(e.deltaY) * 0.08))); e.preventDefault(); }, { passive: false });
addEventListener('contextmenu', (e) => e.preventDefault());
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); world.resize(w, h); enc.resize(w, h); battle.resize(w, h); }
addEventListener('resize', resize); resize();
addEventListener('visibilitychange', () => { if (document.hidden) game.persist(); }); addEventListener('pagehide', () => game.persist());

// ----- 매 장면 -----
let last = performance.now(), slow = 0, sky = 0, saveT = 0;
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000), t = now / 1000; last = now;
  if (game.mode === 'title') { world.cam.yaw += dt * 0.08; world.update(dt, null); game.updateWild(dt, t); game.updateBuddy(dt, t); }
  else if (game.mode === 'map') {
    const free = !ui.busy, ix = free ? (keys.KeyD || keys.ArrowRight || 0) - (keys.KeyA || keys.ArrowLeft || 0) + ui.joy.x : 0, iy = free ? (keys.KeyW || keys.ArrowUp || 0) - (keys.KeyS || keys.ArrowDown || 0) + ui.joy.y : 0;
    if (ix || iy) { game.pending = null; ui.tip(''); }
    const moved = world.update(dt, { x: ix, y: iy }); game.walkAcc += moved;
    if (game.walkAcc >= 5) { const m = game.walkAcc; game.walkAcc = 0; const h = C.walk(game.save, m); C.questEvent(game.save, 'walk', m); if (h.length) { ui.hatched(h); game.persist(); } if (h.buddyCandy) ui.toast(`${C.josa(C.species(h.buddyCandy.sp).name, '이', '가')} 사탕을 찾아왔어!`, '🍬'); }
    const pd = game.pending; if (pd && free) { const tx = pd.actor ? pd.actor.group.position.x : pd.tx, tz = pd.actor ? pd.actor.group.position.z : pd.tz; if (Math.hypot(tx - world.pos.x, tz - world.pos.z) <= pd.range) game.trigger(pd); else if (!world.target) game.pending = null; }
    game.updateWild(dt, t); game.updateBuddy(dt, t);
    slow -= dt; if (slow <= 0) { slow = 0.5; ui.nearby(game.near()); ui.refresh(); const n = Date.now(); for (const pg of world.pois.values()) if (pg.userData.setReady) pg.userData.setReady(!((game.save.stopCd[pg.userData.poi.key] || 0) > n)); }
    saveT += dt; if (saveT > 12) { saveT = 0; game.persist(); }
  } else if (game.mode === 'encounter') enc.update(dt);
  else if (game.mode === 'battle') { battle.update(dt); if (battle.active) ui.batRefresh(); }
  sky += dt; if (sky > 30) { sky = 0; game.refreshSky(); }
  renderer.toneMappingExposure = world.exposure;
  if (game.mode === 'encounter' && enc.scene) renderer.render(enc.scene, enc.camera); else if (game.mode === 'battle' && battle.scene) renderer.render(battle.scene, battle.camera); else renderer.render(world.scene, world.camera);
});
// 살펴보기용: ?gallery=1 이면 모든 몬스터를 줄 세운다
if (q.get('gallery')) { const row = +q.get('row') || 0; C.SPECIES.slice(row * 9, row * 9 + 9).forEach((sp, k) => { const m = buildMon(sp.id, q.get('shiny') === '1'); m.scale.multiplyScalar(1.3); m.position.set((k - 4) * 2.6, 0, 60); m.rotation.y = 0.35; world.scene.add(m); game.wild.push({ group: m, model: m, mon: { uid: sp.id }, hidden: true }); renderer.setAnimationLoop((now) => { world.pos.set(0, 0, 66); world.cam.yaw = 0; world.cam.pitch = 0.2; world.cam.dist = 9; world.cam.tx = 0; world.cam.tz = 62; world.update(0.016, null); world.scene.traverse((o) => o.userData.update && o.userData.update.length === 1 && o.userData.update(now / 1000)); renderer.render(world.scene, world.camera); }); }); document.getElementById('ui').hidden = true; }
window.__moa = game;
