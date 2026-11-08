// 블록 배틀 로얄: 하늘 대기실 → 낙하산으로 섬에 내려가기 → 블래스터와 아이템 줍기 → 줄어드는 안전 구역 안에서
// 마지막까지 남으면 우승. 장난감 블래스터라서 맞으면 체력이 줄고 0 이 되면 "탈락" (펑 사라짐).
// 혼자면 봇과, 친구 방이면 방장이 판과 봇을 움직이고 각자 자기 체력을 맡는다. 주고받는 것은 모두 숫자.
import { THREE } from './render.js';
import { Avatar } from './avatar.js';
import {
  BATTLE, WEAPONS, LOOT, applyDamage, zonePhases, zoneAt, outsideZone, rayBody, rayBoxes, battleCoins,
  newPlayer, stepPlayer, seeded, displayName, ADJECTIVES, ANIMALS, SKINS, COLORS, PHRASES,
} from '../core.mjs';
import { BATTLE_LOBBY } from '../worlds.mjs';

const WI = Object.fromEntries(WEAPONS.map((w, i) => [w.id, i]));
const r2 = v => Math.round(v * 100) / 100;
const fmt = s => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;
const ARROWS = ['⬆', '↗', '➡', '↘', '⬇', '↙', '⬅', '↖'];
const numOf = id => { const n = parseInt(String(id).replace(/\D/g, ''), 10); return Number.isFinite(n) ? n : 0; };

// 장난감 블래스터 모양 (총구 +z)
export function makeGun(id) {
  const w = WEAPONS[WI[id]] ?? WEAPONS[0];
  const g = new THREE.Group();
  const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 });
  const add = (wd, h, d, x, y, z, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(wd, h, d), mat(c)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  const len = { pistol: 0.7, rifle: 1.2, shotgun: 1.0, sniper: 1.6 }[w.id];
  add(0.2, 0.24, len, 0, 0, len / 2 - 0.15, w.color);
  add(0.14, 0.14, 0.3, 0, 0.02, len - 0.05, '#ffffff');
  add(0.1, 0.1, 0.12, 0, 0.02, len + 0.14, '#ffd23f');
  add(0.16, 0.34, 0.16, 0, -0.24, 0.05, '#3a3f4b');
  if (w.id === 'sniper') add(0.1, 0.12, 0.5, 0, 0.2, len / 2, '#23262f');
  if (w.id === 'rifle') add(0.14, 0.3, 0.14, 0, -0.22, len * 0.55, '#3a3f4b');
  if (w.id === 'shotgun') add(0.18, 0.1, 0.5, 0, -0.14, len * 0.6, '#ffd23f');
  return g;
}
function disposeObj(o) { o?.traverse(c => { if (c.isMesh) { c.geometry.dispose(); c.material.dispose(); } }); o?.removeFromParent(); }

export class Battle {
  constructor(game) {
    this.game = game;
    this.state = 'lobby';
    this.timer = BATTLE.LOBBY_WAIT;
    this.round = 0;
    this.t = 0;
    this.me = this.freshMe();
    this.bots = [];
    this.loot = [];
    this.rs = new Map();     // 친구 id → { hp, armor, alive, kills }
    this.out = { s: [], h: [], timer: 0 };
    this.tracers = [];
    this.firing = false; this.fireBtn = false; this.zoom = false;
    this.cool = 0;
    this.lastCount = 0;
    this.fov = game.camera.fov;
    this.phases = zonePhases(1);
    this.zone = zoneAt(this.phases, 0);
    this.participants = [];
    this.buildGrid();
    this.makeZone();
    this.makeHud();
    this.bind();
    // 내 블래스터
    this.myGun = null;
    this.equip('pistol');
    game.myAvatar.aim = true;
    this.updateHud();
  }

  // 섬이 커서 블록이 많다: 16칸씩 나눠 두고 가까운 것만 살핀다 (봇 움직임, 보기, 쏘기)
  buildGrid() {
    const C = 16, grid = new Map(), big = [];
    for (const b of this.game.world.boxes) {
      const i0 = Math.floor(b.x0 / C), i1 = Math.floor(b.x1 / C), k0 = Math.floor(b.z0 / C), k1 = Math.floor(b.z1 / C);
      if ((i1 - i0 + 1) * (k1 - k0 + 1) > 64) { big.push(b); continue; }
      for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) { const key = i * 4096 + k; if (!grid.has(key)) grid.set(key, []); grid.get(key).push(b); }
    }
    this.grid = grid; this.bigBoxes = big; this.cell = C; this.stamp = 0;
  }
  boxesIn(x0, z0, x1, z1) {
    const C = this.cell, out = [...this.bigBoxes], st = ++this.stamp;
    for (let i = Math.floor(Math.min(x0, x1) / C); i <= Math.floor(Math.max(x0, x1) / C); i++) {
      for (let k = Math.floor(Math.min(z0, z1) / C); k <= Math.floor(Math.max(z0, z1) / C); k++) {
        const list = this.grid.get(i * 4096 + k);
        if (list) for (const b of list) if (b._st !== st) { b._st = st; out.push(b); }
      }
    }
    return out;
  }
  near(x, z, r = 4) { return this.boxesIn(x - r, z - r, x + r, z + r); }

  freshMe() { return { hp: BATTLE.HP, armor: 0, alive: false, weapons: new Set(['pistol']), cur: 'pistol', kills: 0, para: false, outTimer: 0, place: 0 }; }
  get net() { return this.game.net; }
  get auth() { return !this.net.active || this.net.host; }
  get myId() { return this.net.active ? this.net.id : 'me'; }
  get myNum() { return this.net.active ? numOf(this.net.id) : 0; }

  // ───── 안전 구역 ─────
  makeZone() {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 72, 1, true);
    this.zoneMat = new THREE.MeshBasicMaterial({ color: '#4a8cff', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
    this.zoneMesh = new THREE.Mesh(geo, this.zoneMat);
    this.zoneMesh.scale.set(BATTLE.R0, 160, BATTLE.R0);
    this.zoneMesh.position.y = 60;
    this.zoneMesh.renderOrder = 2;
    this.game.world.group.add(this.zoneMesh);
    this.nextRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 6, 96), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }));
    this.nextRing.rotation.x = Math.PI / 2;
    this.nextRing.visible = false;
    this.game.world.group.add(this.nextRing);
  }

  // ───── 화면 ─────
  makeHud() {
    const hud = document.createElement('div');
    hud.id = 'battle-hud';
    hud.innerHTML = `
      <div class="bars"><div class="bar hp"><i></i><span></span></div><div class="bar ar"><i></i><span></span></div></div>
      <div class="slots">${WEAPONS.map((w, i) => `<button data-w="${w.id}" title="${w.name} (${i + 1})"><b>${w.icon}</b><small>${i + 1}</small></button>`).join('')}</div>`;
    hud.querySelectorAll('.slots button').forEach(b => b.addEventListener('click', () => { if (this.me.weapons.has(b.dataset.w)) { this.game.sfx('click'); this.equip(b.dataset.w); } }));
    document.body.append(hud);
    this.hud = hud;
    const fire = document.createElement('button');
    fire.id = 'fire-btn'; fire.textContent = '🔫'; fire.setAttribute('aria-label', '쏘기');
    const on = e => { e.preventDefault(); this.fireBtn = true; fire.classList.add('on'); };
    const off = () => { this.fireBtn = false; fire.classList.remove('on'); };
    fire.addEventListener('pointerdown', on); fire.addEventListener('pointerup', off); fire.addEventListener('pointercancel', off); fire.addEventListener('pointerleave', off);
    const zoom = document.createElement('button');
    zoom.id = 'zoom-btn'; zoom.textContent = '🔭'; zoom.setAttribute('aria-label', '확대');
    zoom.addEventListener('click', () => { this.zoom = !this.zoom; zoom.classList.toggle('on', this.zoom); });
    document.body.append(fire, zoom);
    this.fireEl = fire; this.zoomEl = zoom;
    const scope = document.createElement('div'); scope.id = 'scope';
    const hurt = document.createElement('div'); hurt.id = 'hurt';
    document.body.append(scope, hurt);
    this.scopeEl = scope; this.hurtEl = hurt;
    document.body.classList.add('battle');
  }

  updateHud() {
    const m = this.me;
    const hp = this.hud.querySelector('.hp'), ar = this.hud.querySelector('.ar');
    hp.querySelector('i').style.width = `${m.hp}%`;
    hp.querySelector('i').style.background = m.hp > 50 ? '#5ad16b' : m.hp > 25 ? '#ffb820' : '#ff4d5e';
    hp.querySelector('span').textContent = `❤️ ${Math.ceil(m.hp)}`;
    ar.querySelector('i').style.width = `${m.armor}%`;
    ar.querySelector('span').textContent = `🛡️ ${Math.ceil(m.armor)}`;
    ar.style.opacity = m.armor > 0 ? 1 : 0.45;
    this.hud.querySelectorAll('.slots button').forEach(b => { b.classList.toggle('have', m.weapons.has(b.dataset.w)); b.classList.toggle('on', m.cur === b.dataset.w); });
    this.zoomEl.hidden = m.cur !== 'sniper';
  }

  equip(id) {
    if (!this.me.weapons.has(id)) return;
    this.me.cur = id;
    disposeObj(this.myGun);
    this.myGun = makeGun(id);
    this.attachGun(this.game.myAvatar, this.myGun);
    if (id !== 'sniper') { this.zoom = false; this.zoomEl?.classList.remove('on'); }
    this.updateHud();
  }
  attachGun(avatar, gun) {
    gun.position.set(0, -0.72, 0.05);
    gun.rotation.x = Math.PI / 2;
    avatar.arms[0].add(gun);
  }

  // ───── 입력 ─────
  bind() {
    const c = this.game.canvas, ctl = this.game.controls;
    this.onDown = e => {
      if (!this.game.started || this.game.wardrobeOpen) return;
      if (e.pointerType === 'mouse') {
        if (!ctl.locked) { if (!ctl.shiftLock) this.game.setShiftLock(true); else ctl.lockPointer(); return; } // 처음 누르면 마우스를 붙잡고 조준
        if (e.button === 0) this.firing = true;
        if (e.button === 2 && this.me.cur === 'sniper') this.zoom = true;
      }
    };
    this.onUp = e => { if (e.pointerType === 'mouse') { if (e.button === 0) this.firing = false; if (e.button === 2) this.zoom = false; } };
    c.addEventListener('pointerdown', this.onDown);
    addEventListener('pointerup', this.onUp);
    // 배틀은 처음부터 어깨 너머 시점 (내 머리가 조준점을 가리지 않게). 컴퓨터는 화면을 누르면 마우스를 붙잡는다
    this.game.setShiftLock(true);
  }
  key(code) {
    if (code.startsWith('Digit')) {
      const w = WEAPONS[Number(code.slice(5)) - 1];
      if (w && this.me.weapons.has(w.id)) { this.equip(w.id); this.game.sfx('click'); }
      return true;
    }
    return false;
  }

  // ───── 판 진행 ─────
  participantsNow() {
    const ids = [this.myId];
    if (this.net.active) for (const id of this.net.peers) if (this.game.remotes.get(id)?.w === 5) ids.push(id);
    return ids;
  }

  makeBots(n, seed) {
    for (const b of this.bots) { disposeObj(b.gun); b.avatar.dispose(); }
    this.bots = [];
    const rnd = seeded(seed * 7 + 3);
    for (let k = 0; k < n; k++) {
      const look = { skin: Math.floor(rnd() * SKINS.length), shirt: Math.floor(rnd() * COLORS.length), pants: Math.floor(rnd() * COLORS.length), hat: Math.floor(rnd() * 10), face: Math.floor(rnd() * 8), emblem: Math.floor(rnd() * 8), hair: Math.floor(rnd() * 12), hairColor: Math.floor(rnd() * 10) };
      const name = `🤖 ${displayName([Math.floor(rnd() * ADJECTIVES.length), Math.floor(rnd() * ANIMALS.length)])}`;
      const avatar = new Avatar(look, name);
      avatar.aim = true;
      this.game.world.group.add(avatar.root);
      const gun = makeGun('pistol'); this.attachGun(avatar, gun);
      this.bots.push({ avatar, gun, name, pl: newPlayer(BATTLE_LOBBY.x + (rnd() - 0.5) * 16, BATTLE_LOBBY.y + 0.2, BATTLE_LOBBY.z + (rnd() - 0.5) * 16), yaw: rnd() * 6, hp: BATTLE.HP, armor: 0, alive: false, weapon: 'pistol', target: null, think: 0, cool: 0, skill: 0.68 + rnd() * 0.3, lastSeen: null, dodge: 0, goal: null, strafe: rnd() < 0.5 ? 1 : -1, para: false, kills: 0, rnd: seeded(seed * 13 + k), stuck: 0 });
    }
  }

  spawnLoot(seed) {
    for (const l of this.loot) disposeObj(l.mesh);
    this.loot = [];
    const rnd = seeded(seed * 31 + 9);
    const spots = this.game.world.def.loot;
    spots.forEach(([x, y, z], i) => {
      if (rnd() < 0.18) return;
      const roll = rnd();
      const item = roll < 0.24 ? LOOT[0] : roll < 0.44 ? LOOT[1] : roll < 0.56 ? LOOT[2] : roll < 0.8 ? LOOT[3] : LOOT[4];
      const mesh = new THREE.Group();
      if (item.kind === 'weapon') { const g = makeGun(item.id); g.scale.setScalar(1.3); mesh.add(g); }
      else if (item.kind === 'heal') { const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.35), new THREE.MeshStandardMaterial({ color: '#ff6fb5', roughness: 0.4 })); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4), new THREE.MeshStandardMaterial({ color: '#ffffff' })); s.position.set(0.12, 0.5, 0); b.add(s); mesh.add(b); }
      else { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.32, 0.12, 6), new THREE.MeshStandardMaterial({ color: '#3fa7ff', metalness: 0.4, roughness: 0.3, emissive: '#1f5fbf', emissiveIntensity: 0.4 })); b.rotation.x = Math.PI / 2; mesh.add(b); }
      const color = item.kind === 'weapon' ? WEAPONS[WI[item.id]].color : item.kind === 'heal' ? '#ff6fb5' : '#3fa7ff';
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 6, 24), new THREE.MeshBasicMaterial({ color }));
      ring.rotation.x = Math.PI / 2; ring.position.y = -0.45; mesh.add(ring);
      mesh.position.set(x, y + 0.3, z);
      this.game.world.group.add(mesh);
      this.loot.push({ i, ...item, x, y, z, mesh, taken: false });
    });
  }

  takeLoot(l, who) {
    if (l.taken) return;
    l.taken = true;
    l.mesh.visible = false;
    if (who === 'me') this.out.take = (this.out.take ?? []).concat(l.i);
  }

  startRound(seed, list, nBots) {
    this.round++;
    this.state = 'play';
    this.t = 0;
    this.phases = zonePhases(seed);
    this.zone = zoneAt(this.phases, 0);
    this.participants = list;
    this.rs = new Map(list.filter(id => id !== this.myId).map(id => [id, { hp: BATTLE.HP, armor: 0, alive: true, kills: 0 }]));
    this.spawnLoot(seed);
    this.makeBots(nBots, seed);
    const rnd = seeded(seed);
    const spots = [];
    for (let k = 0; k < list.length + nBots; k++) { const a = rnd() * Math.PI * 2, d = 20 + rnd() * (BATTLE.ISLAND - 60); spots.push([Math.cos(a) * d, BATTLE.DROP_Y + rnd() * 6, Math.sin(a) * d]); }
    const mine = list.indexOf(this.myId);
    this.me = this.freshMe();
    if (mine >= 0) {
      const [x, y, z] = spots[mine];
      this.me.alive = true; this.me.para = true;
      this.game.teleport(x, y, z, Math.atan2(-x, -z));
      this.game.controls.faceBehind(Math.atan2(-x, -z));
      this.game.myAvatar.root.visible = true;
    }
    this.equip('pistol');
    this.bots.forEach((b, k) => {
      const [x, y, z] = spots[list.length + k];
      Object.assign(b.pl, newPlayer(x, y, z));
      b.alive = true; b.para = true; b.hp = BATTLE.HP; b.armor = 0; b.weapon = 'pistol';
      b.goal = { x: x * 0.6 + (b.rnd() - 0.5) * 20, z: z * 0.6 + (b.rnd() - 0.5) * 20 };
    });
    this.parachutes();
    this.game.sfx('go');
    this.game.ui.big('🪂 낙하산을 펴고 내려가!', 2200);
    this.updateHud();
  }

  parachutes() {
    const make = () => {
      const g = new THREE.Group();
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ff5e3a', roughness: 0.6, side: THREE.DoubleSide }));
      canopy.scale.y = 0.55; canopy.position.y = 4.6; g.add(canopy);
      const stripe = new THREE.Mesh(new THREE.SphereGeometry(1.72, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, side: THREE.DoubleSide, wireframe: true }));
      stripe.scale.y = 0.56; stripe.position.y = 4.6; g.add(stripe);
      return g;
    };
    this.myChute = this.myChute ?? make();
    this.game.myAvatar.root.add(this.myChute);
    this.myChute.visible = this.me.para;
    for (const b of this.bots) { if (!b.chute) { b.chute = make(); b.avatar.root.add(b.chute); } b.chute.visible = true; }
  }

  // 누가 몇 명 남았나
  aliveCount() {
    let n = this.bots.filter(b => b.alive).length + (this.me.alive ? 1 : 0);
    for (const s of this.rs.values()) if (s.alive) n++;
    return n;
  }
  totalCount() { return this.participants.length + this.bots.length; }
  nameOf(num) {
    if (num === this.myNum) return '나';
    if (num < 0) return this.bots[-num - 1]?.name ?? '봇';
    for (const r of this.game.remotes.values()) if (numOf(r.id) === num) return r.name;
    return '친구';
  }

  // ───── 맞히기 ─────
  // 내가 맞음 (봇이나 친구가 쏨). by: 쏜 사람 번호
  hurtMe(dmg, by) {
    const m = this.me;
    if (!m.alive) return;
    const r = applyDamage(m, dmg);
    m.hp = r.hp; m.armor = r.armor;
    this.hurtEl.classList.remove('on'); void this.hurtEl.offsetWidth; this.hurtEl.classList.add('on');
    this.game.sfx('hurt');
    if (m.hp <= 0) this.eliminateMe(by);
    this.updateHud();
  }
  eliminateMe(by) {
    const m = this.me;
    m.alive = false;
    m.place = this.aliveCount() + 1;
    const coins = battleCoins(m.place, m.kills);
    const s = this.game.save.battle;
    s.kills += m.kills;
    if (!s.best || m.place < s.best) s.best = m.place;
    this.game.addCoins(coins);
    this.game.burstMe();
    this.game.myAvatar.root.visible = false;
    this.game.sfx('die');
    const who = by === undefined ? '안전 구역' : this.nameOf(by);
    this.game.ui.big(`탈락! ${m.place}등 · 처치 ${m.kills} · 🪙+${coins}`, 3600);
    this.game.ui.log(`💥 ${who} → 나`);
    this.out.dead = by ?? -999;
    this.game.persist();
    setTimeout(() => { if (this.game.world.runtime === this && !this.me.alive) { this.game.teleport(BATTLE_LOBBY.x + (Math.random() - 0.5) * 10, BATTLE_LOBBY.y + 0.2, BATTLE_LOBBY.z + 4, Math.PI); this.game.myAvatar.root.visible = true; } }, 2600);
  }
  // 봇이 맞음 (방장/혼자만 계산)
  hurtBot(k, dmg, by) {
    const b = this.bots[k];
    if (!b || !b.alive) return;
    const r = applyDamage(b, dmg);
    b.hp = r.hp; b.armor = r.armor;
    if (b.hp <= 0) {
      b.alive = false;
      this.game.effects.burst(b.pl.x, b.pl.y + 1.4, b.pl.z, [COLORS[b.avatar.look.shirt], SKINS[b.avatar.look.skin], '#ffffff'], 22, 7);
      if (by === this.myNum) { this.me.kills++; this.game.sfx('coin'); }
      else if (by < 0 && this.bots[-by - 1]) this.bots[-by - 1].kills++;
      this.game.ui.log(`💥 ${this.nameOf(by)} → ${b.name}`);
      if (b.rnd() < 0.4) b.avatar.say(PHRASES[[5, 11, 6][Math.floor(b.rnd() * 3)]]);
    }
  }

  // 화면 가운데로 쏜다
  shoot() {
    const w = WEAPONS[WI[this.me.cur]];
    const cam = this.game.camera, pl = this.game.player;
    const o = cam.position.clone();
    const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
    // 카메라와 나 사이에 있는 것은 무시 (내 뒤의 벽을 맞히지 않게)
    const head = new THREE.Vector3(pl.x, pl.y + 1.6, pl.z);
    const tMin = Math.max(0, head.clone().sub(o).dot(fwd) - 0.6);
    const hand = new THREE.Vector3(); this.game.myAvatar.arms[0].getWorldPosition(hand);
    hand.addScaledVector(fwd, 0.9);
    let hitAny = false;
    for (let n = 0; n < w.pellets; n++) {
      const d = fwd.clone();
      const sp = w.spread * (this.zoom ? 0.3 : 1) * (pl.ground ? 1 : 1.8);
      d.x += (Math.random() - 0.5) * 2 * sp; d.y += (Math.random() - 0.5) * 2 * sp; d.z += (Math.random() - 0.5) * 2 * sp;
      d.normalize();
      const so = o.clone().addScaledVector(d, tMin);
      let best = rayBoxes(so.x, so.y, so.z, d.x, d.y, d.z, this.boxesIn(so.x, so.z, so.x + d.x * w.range, so.z + d.z * w.range), w.range);
      let target = null;
      this.bots.forEach((b, k) => {
        if (!b.alive) return;
        const t = rayBody(so.x, so.y, so.z, d.x, d.y, d.z, b.pl.x, b.pl.y, b.pl.z);
        if (t < best) { best = t; target = { bot: k }; }
      });
      for (const [id, s] of this.rs) {
        const r = this.game.remotes.get(id);
        if (!s.alive || !r || r.w !== 5) continue;
        const t = rayBody(so.x, so.y, so.z, d.x, d.y, d.z, r.x, r.y, r.z);
        if (t < best) { best = t; target = { id }; }
      }
      const end = so.clone().addScaledVector(d, best);
      this.tracer(hand, end, w.color);
      this.out.s.push([r2(hand.x), r2(hand.y), r2(hand.z), r2(end.x), r2(end.y), r2(end.z), WI[w.id]]);
      if (target) {
        hitAny = true;
        this.game.effects.burst(end.x, end.y, end.z, [w.color, '#ffffff'], 4, 3);
        if (target.bot !== undefined) {
          if (this.auth) this.hurtBot(target.bot, w.dmg, this.myNum);
          else this.out.h.push([-(target.bot + 1), w.dmg]);
        } else this.out.h.push([numOf(target.id), w.dmg]);
      } else if (best < w.range) this.game.effects.burst(end.x, end.y, end.z, ['#ffffff', w.color], 2, 2);
    }
    this.game.sfx('shoot');
    if (hitAny) { this.game.sfx('hit'); const ch = document.getElementById('crosshair'); ch.classList.remove('hit'); void ch.offsetWidth; ch.classList.add('hit'); }
    this.game.controls.pitch = Math.min(1.25, this.game.controls.pitch + (w.id === 'sniper' ? 0.04 : 0.008));
  }

  tracer(a, b, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([a.clone ? a.clone() : new THREE.Vector3(...a), b.clone ? b.clone() : new THREE.Vector3(...b)]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }));
    this.game.world.group.add(line);
    this.tracers.push({ line, life: 0.12 });
  }

  // 봇의 한 번 쏘기: 거리와 실력으로 맞을지 정한다
  botShoot(b, k, target) {
    const w = WEAPONS[WI[b.weapon]];
    const from = new THREE.Vector3(b.pl.x, b.pl.y + 1.7, b.pl.z);
    const to = new THREE.Vector3(target.x, target.y + 1.3, target.z);
    const dist = from.distanceTo(to);
    if (dist > w.range) return;
    let hits = 0;
    for (let n = 0; n < w.pellets; n++) {
      const chance = 0.9 * b.skill * Math.max(0.12, 1 - dist / (w.range * 1.3)) * (target.moving ? 0.82 : 1) * (w.id === 'shotgun' ? 0.8 : 1);
      const hit = b.rnd() < chance;
      if (hit) hits++;
      const miss = hit ? new THREE.Vector3() : new THREE.Vector3((b.rnd() - 0.5) * 3, (b.rnd() - 0.5) * 2, (b.rnd() - 0.5) * 3);
      if (n === 0 || hit) this.tracer(from, to.clone().add(miss), w.color);
    }
    this.game.sfx('shoot');
    if (!hits) return;
    const dmg = hits * w.dmg;
    if (target.me) this.hurtMe(dmg, -(k + 1));
    else if (target.bot !== undefined) this.hurtBot(target.bot, dmg, -(k + 1));
    else if (target.id) this.out.h.push([numOf(target.id), dmg, -(k + 1)]);
  }

  sees(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz) || 1;
    return rayBoxes(ax, ay, az, dx / d, dy / d, dz / d, this.boxesIn(ax, az, bx, bz), d) >= d - 0.5;
  }

  // 봇 (2026-11-08 인혁: "ai가 너무 못해" → 더 잘 맞히고, 쫓아오고, 피하고, 좋은 무기와 회복을 챙긴다)
  botBrain(b, k, dt) {
    const pl = b.pl;
    const RANK = { pistol: 0, shotgun: 1, sniper: 2, rifle: 3 };
    b.think -= dt; b.cool -= dt; b.dodge -= dt;
    // 볼 수 있는 가장 가까운 적
    if (b.think <= 0) {
      b.think = 0.25 + b.rnd() * 0.2;
      let best = null, bd = 62;
      const consider = (t) => { const d = Math.hypot(t.x - pl.x, t.z - pl.z); if (d < bd && this.sees(pl.x, pl.y + 1.7, pl.z, t.x, t.y + 1.3, t.z)) { bd = d; best = t; } };
      const me = this.game.player;
      if (this.me.alive && !this.me.para) consider({ x: me.x, y: me.y, z: me.z, me: true, moving: Math.hypot(me.vx, me.vz) > 2 });
      this.bots.forEach((o, j) => { if (j !== k && o.alive && !o.para) consider({ x: o.pl.x, y: o.pl.y, z: o.pl.z, bot: j, moving: Math.hypot(o.pl.vx, o.pl.vz) > 2 }); });
      for (const [id, s] of this.rs) { const r = this.game.remotes.get(id); if (s.alive && r && r.w === 5) consider({ x: r.x, y: r.y, z: r.z, id, moving: r.speed > 2 }); }
      if (best && !b.target) b.cool = Math.max(b.cool, 0.22 + (1 - b.skill) * 0.45); // 처음 봤을 때 반응 시간
      if (best) b.lastSeen = { x: best.x, z: best.z, until: this.t + 8 };
      b.target = best;
    }
    let mx = 0, mz = 0, jump = false;
    const z = this.zone;
    const out = outsideZone(z, pl.x, pl.z) || Math.hypot(pl.x - z.x, pl.z - z.z) > z.r - 6;
    if (b.target) {
      const t = b.target, dx = t.x - pl.x, dz = t.z - pl.z, d = Math.hypot(dx, dz) || 1;
      b.yaw = Math.atan2(dx, dz);
      const want = { pistol: 14, rifle: 20, shotgun: 6, sniper: 38 }[b.weapon];
      const fwd = d > want + 3 ? 1 : d < want - 3 ? -0.7 : 0;
      // 좌우로 자주 바꾸며 움직이고 가끔 점프해서 맞히기 어렵게
      if (b.dodge <= 0) { b.dodge = 0.5 + b.rnd() * 0.9; b.strafe = b.rnd() < 0.5 ? 1 : -1; if (b.rnd() < 0.25 * b.skill) jump = true; }
      mx = (dx / d) * fwd + (-dz / d) * b.strafe; mz = (dz / d) * fwd + (dx / d) * b.strafe;
      // 처음 12초는 쏘지 않는다 (내려와서 블래스터를 주울 시간)
      if (b.cool <= 0 && !b.para && this.t > 12) { this.botShoot(b, k, t); const w = WEAPONS[WI[b.weapon]]; b.cool = (1 / w.rate) * (1.12 + (1 - b.skill) * 0.9); }
    } else {
      const g = b.goal;
      if (out) b.goal = { x: z.x + (b.rnd() - 0.5) * z.r * 0.5, z: z.z + (b.rnd() - 0.5) * z.r * 0.5 };
      else if (!g || g.loot === undefined) {
        // 챙기기: 체력이 낮으면 회복, 방패가 없으면 방패, 더 좋은 블래스터
        let near = null, nd = Infinity;
        for (const l of this.loot) {
          if (l.taken || Math.abs(l.y - pl.y) > 3) continue;
          const d = Math.hypot(l.x - pl.x, l.z - pl.z);
          const want = (l.kind === 'heal' && b.hp < 65 && d < 32) || (l.kind === 'shield' && b.armor < 40 && d < 32) || (l.kind === 'weapon' && RANK[l.id] > RANK[b.weapon] && d < 48);
          if (want && d < nd) { nd = d; near = l; }
        }
        if (near) b.goal = { x: near.x, z: near.z, loot: near.i };
        else if (b.lastSeen && this.t < b.lastSeen.until) b.goal = { x: b.lastSeen.x, z: b.lastSeen.z, hunt: true }; // 숨은 적 쫓기
      }
      if (b.goal?.loot !== undefined && this.loot.find(l => l.i === b.goal.loot)?.taken) b.goal = null;
      if (!b.goal || Math.hypot(b.goal.x - pl.x, b.goal.z - pl.z) < 2) { if (b.goal?.hunt) b.lastSeen = null; b.goal = { x: z.x + (b.rnd() - 0.5) * z.r, z: z.z + (b.rnd() - 0.5) * z.r }; }
      const dx = b.goal.x - pl.x, dz = b.goal.z - pl.z, d = Math.hypot(dx, dz) || 1;
      mx = dx / d; mz = dz / d;
      if (Math.hypot(pl.vx, pl.vz) > 0.5) b.yaw = Math.atan2(pl.vx, pl.vz);
    }
    if (b.stuck > 0.4) { jump = true; b.stuck = 0; if (b.goal && b.rnd() < 0.5) b.goal = null; b.strafe *= -1; }
    if (b.para) { pl.vy = Math.max(pl.vy, BATTLE.FALL); mx *= 0.6; mz *= 0.6; }
    const before = [pl.x, pl.z];
    const ev = stepPlayer(pl, { mx, mz, jump }, this.near(pl.x, pl.z), dt);
    if (ev.wall && Math.hypot(pl.x - before[0], pl.z - before[1]) < 0.02) b.stuck += dt; else b.stuck = Math.max(0, b.stuck - dt);
    if (b.para && pl.ground) { b.para = false; if (b.chute) b.chute.visible = false; }
    // 줍기 (블래스터는 더 좋은 것만)
    for (const l of this.loot) {
      if (l.taken || Math.hypot(l.x - pl.x, l.z - pl.z) > 1.6 || Math.abs(l.y - pl.y) > 2) continue;
      const take = () => { this.takeLoot(l, 'bot'); this.out.take = (this.out.take ?? []).concat(l.i); if (b.goal?.loot === l.i) b.goal = null; };
      if (l.kind === 'weapon' && RANK[l.id] > RANK[b.weapon]) { b.weapon = l.id; disposeObj(b.gun); b.gun = makeGun(l.id); this.attachGun(b.avatar, b.gun); take(); }
      else if (l.kind === 'heal' && b.hp < BATTLE.HP) { b.hp = Math.min(BATTLE.HP, b.hp + l.amount); take(); }
      else if (l.kind === 'shield' && b.armor < BATTLE.ARMOR) { b.armor = Math.min(BATTLE.ARMOR, b.armor + l.amount); take(); }
    }
    // 구역 밖
    if (!b.para && outsideZone(z, pl.x, pl.z)) this.hurtBot(k, z.dps * dt, -999);
  }

  // ───── 네트워크 ─────
  message(d, from) {
    const host = this.net.room.hostId;
    if (d.k === 'start' && from === host && Number.isInteger(d.seed) && Array.isArray(d.list)) {
      this.startRound(d.seed, d.list.filter(x => typeof x === 'string').slice(0, 8), Math.max(0, Math.min(BATTLE.PLAYERS, d.bots | 0)));
      this.round = d.r | 0;
      return;
    }
    if (d.k === 'end' && from === host) { this.finish(Number.isInteger(d.w) ? d.w : null); return; }
    if (d.k === 'lobby' && from === host) { this.toLobby(); return; }
    if (d.k !== 'tick' || d.r !== this.round) return;
    const s = this.rs.get(from);
    if (s) {
      if (Number.isFinite(d.hp)) s.hp = d.hp;
      if (Number.isFinite(d.ar)) s.armor = d.ar;
      if (d.al === 0 && s.alive) { s.alive = false; const r = this.game.remotes.get(from); if (r?.avatar) this.game.effects.burst(r.x, r.y + 1.4, r.z, ['#ffffff', '#ff5e3a'], 20, 7); if (Number.isFinite(d.by)) { this.game.ui.log(`💥 ${this.nameOf(d.by)} → ${r?.name ?? '친구'}`); if (d.by === this.myNum) { this.me.kills++; this.game.sfx('coin'); } else if (d.by < 0 && this.auth && this.bots[-d.by - 1]) this.bots[-d.by - 1].kills++; } }
      if (Number.isFinite(d.kills)) s.kills = d.kills;
    }
    if (Array.isArray(d.s)) for (const q of d.s.slice(0, 20)) if (Array.isArray(q) && q.length >= 7 && q.every(Number.isFinite)) this.tracer(new THREE.Vector3(q[0], q[1], q[2]), new THREE.Vector3(q[3], q[4], q[5]), (WEAPONS[q[6]] ?? WEAPONS[0]).color);
    if (Array.isArray(d.h)) for (const q of d.h.slice(0, 40)) {
      if (!Array.isArray(q) || !Number.isFinite(q[0]) || !Number.isFinite(q[1])) continue;
      const dmg = Math.max(0, Math.min(500, q[1]));
      const by = Number.isFinite(q[2]) ? q[2] : numOf(from);
      if (q[0] === this.myNum && this.net.active) this.hurtMe(dmg, by);
      else if (q[0] < 0 && this.auth) this.hurtBot(-q[0] - 1, dmg, by);
    }
    if (Array.isArray(d.t)) for (const i of d.t.slice(0, 20)) { const l = this.loot.find(x => x.i === i); if (l) this.takeLoot(l, 'net'); }
    if (Array.isArray(d.b) && from === host && !this.auth) d.b.forEach((q, k) => {
      const b = this.bots[k];
      if (!b || !Array.isArray(q) || !q.slice(0, 5).every(Number.isFinite)) return;
      const [x, y, z, yaw, hp, al, wi, para] = q;
      b.net = { x, y, z, yaw };
      b.hp = hp;
      if (b.alive && !al) this.game.effects.burst(b.pl.x, b.pl.y + 1.4, b.pl.z, [COLORS[b.avatar.look.shirt], '#ffffff'], 22, 7);
      b.alive = !!al; b.para = !!para;
      const wid = WEAPONS[wi]?.id;
      if (wid && wid !== b.weapon) { b.weapon = wid; disposeObj(b.gun); b.gun = makeGun(wid); this.attachGun(b.avatar, b.gun); }
    });
  }

  sendTick(dt) {
    const o = this.out;
    o.timer -= dt;
    if (o.timer > 0 || !this.net.live || this.state === 'lobby') return;
    o.timer = 0.1;
    const msg = { t: 'br', k: 'tick', r: this.round, hp: Math.ceil(this.me.hp), ar: Math.ceil(this.me.armor), al: this.me.alive ? 1 : 0, kills: this.me.kills };
    if (o.dead !== undefined) { msg.by = o.dead; o.dead = undefined; }
    if (o.s.length) msg.s = o.s.splice(0, 8);
    if (o.h.length) msg.h = o.h.splice(0);
    if (o.take?.length) { msg.t = o.take; o.take = []; }
    if (this.auth && this.bots.length) msg.b = this.bots.map(b => [r2(b.pl.x), r2(b.pl.y), r2(b.pl.z), r2(b.yaw), Math.ceil(b.hp), b.alive ? 1 : 0, WI[b.weapon], b.para ? 1 : 0]);
    o.s.length = 0;
    this.net.send(msg);
  }

  finish(winner) {
    if (this.state === 'end') return;
    this.state = 'end';
    this.timer = 7;
    if (this.me.alive && (winner === null || winner === this.myNum || !this.net.active)) {
      const s = this.game.save.battle;
      s.wins++; s.best = 1; s.kills += this.me.kills;
      const coins = battleCoins(1, this.me.kills);
      this.game.addCoins(coins);
      this.game.sfx('win');
      const p = this.game.player;
      this.game.effects.confetti(p.x, p.y + 3, p.z, 220);
      this.game.ui.big(`🏆 최후의 1인! 처치 ${this.me.kills} · 🪙+${coins}`, 4200, 'gold');
      this.me.alive = false;
      this.game.persist();
    } else if (winner !== null && winner !== undefined) this.game.ui.log(`🏆 ${this.nameOf(winner)} 우승!`);
  }

  toLobby() {
    this.state = 'lobby';
    this.timer = BATTLE.LOBBY_WAIT;
    this.me = this.freshMe();
    this.equip('pistol');
    this.game.myAvatar.root.visible = true;
    if (this.myChute) this.myChute.visible = false;
    for (const l of this.loot) disposeObj(l.mesh);
    this.loot = [];
    for (const b of this.bots) { b.alive = false; b.avatar.root.visible = false; }
    const pl = this.game.player;
    if (Math.abs(pl.y - BATTLE_LOBBY.y) > 3) this.game.teleport(BATTLE_LOBBY.x + (Math.random() - 0.5) * 10, BATTLE_LOBBY.y + 0.2, BATTLE_LOBBY.z + 4, Math.PI);
    this.updateHud();
  }

  // 플레이어보다 먼저: 낙하산이면 천천히 떨어진다
  move() {
    const pl = this.game.player;
    if (this.me.para) pl.vy = Math.max(pl.vy, BATTLE.FALL);
  }

  update(dt) {
    const g = this.game, net = this.net;
    // 판 진행 (혼자이거나 방장)
    if (this.state === 'lobby') {
      this.timer -= dt;
      const sec = Math.ceil(this.timer);
      if (sec !== this.lastCount && sec <= 3 && sec > 0) { this.lastCount = sec; g.sfx('tick'); g.ui.big(String(sec), 800); }
      if (this.timer <= 0 && this.auth) {
        const seed = (Math.random() * 1e9) | 0, list = this.participantsNow();
        const bots = Math.max(0, BATTLE.PLAYERS - list.length);
        this.startRound(seed, list, bots);
        net.send({ t: 'br', k: 'start', r: this.round, seed, list, bots });
      } else if (this.timer <= -4 && !this.auth) this.timer = BATTLE.LOBBY_WAIT;
    } else if (this.state === 'play') {
      this.t += dt;
      this.zone = zoneAt(this.phases, Math.max(0, this.t - 8));
      if (this.auth && this.t > 3) {
        const alive = this.aliveCount();
        if (alive <= 1) {
          let w = null;
          if (this.me.alive) w = this.myNum;
          else { const k = this.bots.findIndex(b => b.alive); if (k >= 0) w = -(k + 1); else for (const [id, s] of this.rs) if (s.alive) w = numOf(id); }
          this.finish(w);
          net.send({ t: 'br', k: 'end', w });
        }
      }
    } else if (this.state === 'end') {
      this.timer -= dt;
      if (this.timer <= 0 && this.auth) { this.toLobby(); net.send({ t: 'br', k: 'lobby' }); }
    }

    // 나
    const pl = g.player, m = this.me;
    if (m.para && pl.ground) { m.para = false; if (this.myChute) this.myChute.visible = false; g.sfx('land'); }
    if (this.myChute) this.myChute.visible = m.para;
    if (this.state === 'play' && m.alive) {
      // 쏘기
      this.cool -= dt;
      const w = WEAPONS[WI[m.cur]];
      const wantFire = this.firing || this.fireBtn;
      if (wantFire && this.cool <= 0 && !m.para) {
        this.shoot();
        this.cool = 1 / w.rate;
        if (!w.auto) this.firing = false;
      }
      // 줍기
      for (const l of this.loot) {
        if (l.taken || Math.hypot(l.x - pl.x, l.z - pl.z) > 1.7 || Math.abs(l.y - pl.y) > 2.2) continue;
        if (l.kind === 'weapon' && !m.weapons.has(l.id)) { m.weapons.add(l.id); this.takeLoot(l, 'me'); this.equip(l.id); g.sfx('buy'); g.ui.toast(`${WEAPONS[WI[l.id]].icon} ${WEAPONS[WI[l.id]].name}! (${WI[l.id] + 1}번)`, 1600); }
        else if (l.kind === 'heal' && m.hp < BATTLE.HP) { m.hp = Math.min(BATTLE.HP, m.hp + l.amount); this.takeLoot(l, 'me'); g.sfx('check'); g.ui.toast(`🧃 회복 주스 +${l.amount}`, 1400); this.updateHud(); }
        else if (l.kind === 'shield' && m.armor < BATTLE.ARMOR) { m.armor = Math.min(BATTLE.ARMOR, m.armor + l.amount); this.takeLoot(l, 'me'); g.sfx('check'); g.ui.toast(`🛡️ 방패 +${l.amount}`, 1400); this.updateHud(); }
      }
      // 구역 밖이면 체력이 준다
      if (!m.para && outsideZone(this.zone, pl.x, pl.z)) {
        m.outTimer += dt;
        m.hp = Math.max(0, m.hp - this.zone.dps * dt);
        if (m.outTimer > 0.6) { m.outTimer = 0; this.hurtEl.classList.remove('on'); void this.hurtEl.offsetWidth; this.hurtEl.classList.add('on'); this.updateHud(); }
        if (m.hp <= 0) this.eliminateMe(undefined);
      }
      // 섬 밖으로 떨어지면 탈락
      if (pl.y < -8) { m.hp = 0; this.eliminateMe(undefined); }
    }
    // 저격 확대
    const zoomOn = this.zoom && m.cur === 'sniper' && m.alive && this.state === 'play';
    const fov = zoomOn ? 20 : this.fov;
    if (Math.abs(g.camera.fov - fov) > 0.1) { g.camera.fov += (fov - g.camera.fov) * Math.min(1, dt * 12); g.camera.updateProjectionMatrix(); }
    this.scopeEl.classList.toggle('on', zoomOn);

    // 봇
    this.bots.forEach((b, k) => {
      if (!b.alive) { b.avatar.root.visible = false; return; }
      b.avatar.root.visible = true;
      if (this.auth) {
        if (this.state === 'play') this.botBrain(b, k, dt);
      } else if (b.net) {
        const kk = 1 - Math.exp(-dt * 12);
        b.pl.x += (b.net.x - b.pl.x) * kk; b.pl.y += (b.net.y - b.pl.y) * kk; b.pl.z += (b.net.z - b.pl.z) * kk; b.yaw = b.net.yaw;
      }
      if (b.chute) b.chute.visible = b.para;
      const sp = Math.hypot(b.pl.vx, b.pl.vz);
      b.avatar.place(b.pl.x, b.pl.y, b.pl.z, b.yaw, dt);
      b.avatar.animate(dt, { speed: this.auth ? sp : 3, grounded: !b.para, vy: b.para ? -1 : 0, climb: false, emote: 0 });
    });
    // 친구 모습: 탈락하면 숨기고, 블래스터를 들게
    for (const r of g.remotes.values()) {
      if (!r.avatar || r.w !== 5) continue;
      r.avatar.aim = true;
      if (!r.battleGun) { r.battleGun = makeGun('rifle'); this.attachGun(r.avatar, r.battleGun); }
      const s = this.rs.get(r.id);
      if (this.state === 'play' && s) r.avatar.root.visible = s.alive && !r.muted;
    }
    // 총알 자국
    this.tracers = this.tracers.filter(t => { t.life -= dt; t.line.material.opacity = Math.max(0, t.life / 0.12); if (t.life <= 0) { t.line.removeFromParent(); t.line.geometry.dispose(); t.line.material.dispose(); return false; } return true; });
    // 아이템 빙글빙글
    const now = performance.now() / 1000;
    const ppl = this.game.player;
    for (const l of this.loot) {
      l.mesh.visible = !l.taken && Math.abs(l.x - ppl.x) < 90 && Math.abs(l.z - ppl.z) < 90;
      if (l.mesh.visible) { l.mesh.rotation.y = now * 1.6 + l.i; l.mesh.position.y = l.y + 0.35 + Math.sin(now * 2.5 + l.i) * 0.12; }
    }
    // 안전 구역 모습
    const z = this.zone;
    const playing = this.state !== 'lobby';
    this.zoneMesh.visible = playing;
    if (playing) { this.zoneMesh.scale.set(Math.max(0.5, z.r), 160, Math.max(0.5, z.r)); this.zoneMesh.position.set(z.x, 60, z.z); this.zoneMat.opacity = 0.18 + Math.sin(now * 3) * 0.04; }
    const ph = this.phases[z.phase];
    this.nextRing.visible = playing && !!ph && !z.shrinking;
    if (this.nextRing.visible) { this.nextRing.scale.set(Math.max(0.5, ph.to.r), Math.max(0.5, ph.to.r), 1); this.nextRing.position.set(ph.to.x, 0.3, ph.to.z); }

    this.sendTick(dt);
    this.info();
  }

  info() {
    const s = this.game.save.battle, m = this.me, z = this.zone, pl = this.game.player;
    let html;
    if (this.state === 'lobby') html = `<b>⏳ 다음 판까지 ${Math.max(0, Math.ceil(this.timer))}초</b><small>우승 ${s.wins}번 · 처치 ${s.kills} · 최고 ${s.best ? `${s.best}등` : '-'}</small>`;
    else if (this.state === 'end') html = '<b>🏁 판 끝!</b><small>곧 대기실로</small>';
    else {
      const line = z.shrinking ? `⚠ 안전 구역이 줄어드는 중 ${fmt(z.next)}` : z.next > 0 ? `안전 구역이 줄어들기까지 ${fmt(z.next)}` : '마지막 구역!';
      let warn = '';
      if (m.alive && outsideZone(z, pl.x, pl.z)) {
        const ang = Math.atan2(z.x - pl.x, z.z - pl.z) - this.game.controls.facing;
        const idx = ((Math.round(-ang / (Math.PI / 4)) % 8) + 8) % 8;
        warn = `<small class="warn-zone">⚠ 구역 밖! ${ARROWS[idx]} 쪽으로 가</small>`;
      }
      html = `<b>🎯 남은 사람 ${this.aliveCount()} / ${this.totalCount()} · 처치 ${m.kills}</b><small>${line}</small>${warn}`;
    }
    this.game.ui.setInfo(html);
  }

  dispose() {
    const g = this.game;
    g.canvas.removeEventListener('pointerdown', this.onDown);
    removeEventListener('pointerup', this.onUp);
    for (const el of [this.hud, this.fireEl, this.zoomEl, this.scopeEl, this.hurtEl]) el.remove();
    document.body.classList.remove('battle');
    disposeObj(this.myGun); disposeObj(this.myChute);
    g.myAvatar.aim = false;
    g.myAvatar.root.visible = true;
    for (const b of this.bots) { disposeObj(b.gun); b.avatar.dispose(); }
    for (const r of g.remotes.values()) { if (r.battleGun) { disposeObj(r.battleGun); r.battleGun = null; } if (r.avatar) r.avatar.aim = false; }
    for (const t of this.tracers) { t.line.removeFromParent(); t.line.geometry.dispose(); t.line.material.dispose(); }
    g.camera.fov = this.fov; g.camera.updateProjectionMatrix();
    g.setShiftLock(false);
    g.ui.setInfo('');
  }
}
