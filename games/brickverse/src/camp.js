// 모닥불 캠프: 낮에는 나무를 베고 열매를 따서 모닥불에 넣고, 밤에는 불빛 안에서 그림자 늑대를 버틴다. 99일 버티면 성공.
// 빛(모닥불, 횃불) 안에는 늑대가 못 들어온다. 불이 꺼지면 늑대가 캠프까지 온다. 10일마다 큰 그림자 보스.
// 혼자면 AI 캠프 친구 3명과, 친구 방이면 방장이 날짜, 불, 늑대를 맡고 각자 자기 체력과 가방을 맡는다. 보내는 것은 모두 숫자.
import { THREE, textSprite } from './render.js';
import { Avatar } from './avatar.js';
import { makeCritter } from './egghunt.js';
import { CAMP, fireLevel, fireRadius, nightMonsters, dayCoins, freshCamp, seeded, displayName, ADJECTIVES, ANIMALS, SKINS, COLORS } from '../core.mjs';
import { CAMP_R } from '../worlds.mjs';

const r2 = v => Math.round(v * 100) / 100;
const numOf = id => { const n = parseInt(String(id).replace(/\D/g, ''), 10); return Number.isFinite(n) ? n : 0; };
const fmt = s => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;
const std = (c, extra) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...extra });

export class Camp {
  constructor(game) {
    this.game = game;
    this.def = game.world.def;
    this.group = new THREE.Group();
    game.world.group.add(this.group);
    this.t = 0;
    this.cool = 0; this.feedT = 0; this.cookT = 0; this.saveT = 0; this.sendT = 0; this.hurtT = 0; this.toastT = 0; this.regenT = 0;
    this.monsters = new Map(); this.nextId = 1;
    this.spawnQ = 0; this.spawnT = 0;
    this.makeTrees();
    this.makeBushes();
    this.makeFire();
    this.makeTorchPool();
    this.makeHud();
    this.makeBots();
    this.night = null; // 첫 프레임에 낮/밤 하늘을 맞춘다 (loadWorld 가 기본 하늘을 나중에 칠한다)
    if (this.c.hp <= 0) this.c.hp = CAMP.HP;
  }
  get c() { return this.game.save.camp; }
  get net() { return this.game.net; }
  get auth() { return !this.net.active || this.net.host; }
  get myNum() { return this.net.active ? numOf(this.net.id) : 0; }
  get frozen() { return this.downT > 0 ? 1 : 0; }
  get isNight() { return this.c.t >= CAMP.DAY; }
  get fireLv() { return fireLevel(this.c.fed); }
  get fireR() { return fireRadius(this.fireLv, this.c.fuel); }
  lights() {
    const out = [{ x: 0, z: 0, r: this.fireR }];
    for (const [x, z] of this.c.torches) out.push({ x, z, r: CAMP.TORCH_R });
    return out;
  }
  inLight(x, z, pad = 0) { return this.lights().some(l => l.r > 0 && Math.hypot(x - l.x, z - l.z) < l.r - pad); }

  // ───── 나무 (한 번에 그리기, 베면 숨겼다가 다시 자란다) ─────
  makeTrees() {
    const list = this.def.trees;
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.5, 1, 8), std('#6b4a2f'), list.length);
    const leafA = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 9), std('#2f7a4a'), list.length);
    const leafB = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 9), std('#3a8f55'), list.length);
    for (const m of [trunk, leafA, leafB]) { m.castShadow = true; m.receiveShadow = true; this.group.add(m); }
    this.treeMeshes = { trunk, leafA, leafB };
    this.trees = list.map((t, i) => {
      const box = { x0: t.x - 0.45 * t.s, x1: t.x + 0.45 * t.s, y0: 0, y1: 4 * t.s, z0: t.z - 0.45 * t.s, z1: t.z + 0.45 * t.s, kind: 'solid', on: true, dx: 0, dy: 0, dz: 0, cx: 0, cz: 0, part: null };
      this.game.world.boxes.push(box);
      return { ...t, i, hp: CAMP.TREE_HP, down: 0, shake: 0, box };
    });
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.sc = new THREE.Vector3();
    for (const t of this.trees) this.drawTree(t);
  }
  drawTree(t) {
    const { trunk, leafA, leafB } = this.treeMeshes, s = t.down > 0 ? 0.0001 : t.s;
    const sx = t.shake > 0 ? Math.sin(this.t * 60) * 0.08 : 0;
    const set = (m, y, w, h) => { this.v.set(t.x + sx, y * s, t.z); this.sc.set(w * s, h * s, w * s); this.m4.compose(this.v, this.q, this.sc); m.setMatrixAt(t.i, this.m4); m.instanceMatrix.needsUpdate = true; };
    set(trunk, 1.5, 1, 3);
    set(leafA, 4.2, 2.6, 3.6);
    set(leafB, 6.2, 1.8, 2.8);
  }
  makeBushes() {
    this.bushes = this.def.bushes.map(b => {
      const g = new THREE.Group();
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 9), std('#2f8f45'));
      leaf.position.y = 0.9; leaf.scale.set(1.2, 0.8, 1.1); leaf.castShadow = true; g.add(leaf);
      const berries = new THREE.Group();
      for (let i = 0; i < 9; i++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), std('#3f5bff', { emissive: '#1a2aaa', emissiveIntensity: 0.3 }));
        const a = (i / 9) * Math.PI * 2; m.position.set(Math.cos(a) * 1.15, 0.9 + Math.sin(i * 2.3) * 0.35, Math.sin(a) * 1.0); berries.add(m);
      }
      g.add(berries);
      g.position.set(b.x, 0, b.z);
      this.group.add(g);
      return { ...b, berries, t: 0 };
    });
  }

  // ───── 모닥불 ─────
  makeFire() {
    const g = new THREE.Group();
    this.flames = [];
    for (const [c, s, y] of [['#ff5a1a', 1.9, 1.2], ['#ffa21a', 1.35, 1.35], ['#ffe066', 0.8, 1.4]]) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.6 * s, 1.8 * s, 9), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2.2, transparent: true, opacity: 0.9 }));
      m.position.y = y; g.add(m); this.flames.push(m);
    }
    this.fireLight = new THREE.PointLight('#ffae5c', 0, 40, 1.25);
    this.fireLight.position.set(0, 2.2, 0);
    g.add(this.fireLight);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 72), new THREE.MeshBasicMaterial({ color: '#ffcf66', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08;
    this.group.add(ring);
    this.ring = ring;
    this.group.add(g);
    this.fire = g;
  }
  makeTorchPool() {
    this.torchPool = [];
    for (let i = 0; i < CAMP.TORCH_MAX; i++) {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2, 6), std('#6b4a2f')); pole.position.y = 1; g.add(pole);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 7), new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff8a1a', emissiveIntensity: 2.5 })); flame.position.y = 2.3; g.add(flame);
      const light = new THREE.PointLight('#ffb070', 0, 16, 1.6); light.position.y = 2.4; g.add(light);
      const ring = new THREE.Mesh(new THREE.RingGeometry(CAMP.TORCH_R - 0.08, CAMP.TORCH_R, 48), new THREE.MeshBasicMaterial({ color: '#ffcf66', transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; g.add(ring);
      g.visible = false;
      this.group.add(g);
      this.torchPool.push({ g, flame, light, ring });
    }
  }
  drawFire() {
    const lv = this.fireLv, fuel = this.c.fuel, on = fuel > 0;
    const size = on ? (0.6 + lv * 0.25) * (0.5 + Math.min(1, fuel / 40) * 0.5) : 0.001;
    this.flames.forEach((m, i) => { const f = 1 + Math.sin(this.t * (9 + i * 3)) * 0.08; m.scale.set(size * f, size * (1 + Math.sin(this.t * 7 + i) * 0.12), size * f); m.visible = on; });
    this.fireLight.intensity = on ? (this.isNight ? 140 : 8) * (0.9 + Math.sin(this.t * 11) * 0.1) * (0.6 + lv * 0.15) : 0;
    this.fireLight.distance = Math.max(10, this.fireR * 2.6);
    const r = this.fireR;
    this.ring.visible = r > 0 && this.isNight;
    this.ring.scale.setScalar(Math.max(0.01, r));
    this.torchPool.forEach((tp, i) => {
      const t = this.c.torches[i];
      tp.g.visible = !!t;
      if (!t) { tp.light.intensity = 0; return; }
      tp.g.position.set(t[0], 0, t[1]);
      tp.light.intensity = this.isNight ? 18 : 0;
      tp.ring.visible = this.isNight;
      tp.flame.scale.setScalar(1 + Math.sin(this.t * 12 + i) * 0.12);
    });
  }

  // ───── 화면 ─────
  makeHud() {
    const bar = document.createElement('div');
    bar.id = 'camp-bar';
    bar.innerHTML = '<button data-a="use"><kbd>E</kbd>🪓 베기·때리기</button><button data-a="eat"><kbd>Q</kbd>🍖 먹기</button><button data-a="torch"><kbd>F</kbd>🔦 횃불 (🪵5)</button>';
    bar.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) this.act(b.dataset.a); });
    document.body.append(bar);
    const hurt = document.createElement('div'); hurt.id = 'camp-hurt'; document.body.append(hurt);
    document.body.classList.add('campw');
    this.bar = bar; this.hurtEl = hurt;
  }
  key(code) {
    const a = { KeyE: 'use', KeyQ: 'eat', KeyF: 'torch' }[code];
    if (!a) return false;
    this.act(a);
    return true;
  }
  act(a) {
    const g = this.game, c = this.c, me = g.player;
    if (g.isDead()) return;
    if (a === 'use') this.use();
    else if (a === 'eat') {
      if (c.cooked > 0) { c.cooked--; c.hunger = Math.min(CAMP.HUNGER, c.hunger + CAMP.MEAT_FOOD); g.sfx('coin'); g.ui.toast('🍖 고기 냠냠! 배가 많이 불러'); }
      else if (c.berry > 0) { c.berry--; c.hunger = Math.min(CAMP.HUNGER, c.hunger + CAMP.BERRY_FOOD); g.sfx('pop'); g.ui.toast('🫐 열매 냠냠!'); }
      else if (c.meat > 0) this.say('🥩 날고기는 모닥불 옆에 서 있으면 구워져!');
      else this.say('먹을 게 없어! 🫐 열매 덤불을 찾아 봐');
    } else if (a === 'torch') {
      if (c.wood < CAMP.TORCH_WOOD) { this.say(`🔦 나무가 ${CAMP.TORCH_WOOD - c.wood}개 더 필요해`); return; }
      if (c.torches.length >= CAMP.TORCH_MAX && !this.net.active) { this.say(`🔦 횃불은 ${CAMP.TORCH_MAX}개까지야`); return; }
      c.wood -= CAMP.TORCH_WOOD;
      if (this.auth) this.addTorch(me.x, me.z);
      else this.net.send({ t: 'cp', k: 'torch', x: r2(me.x), z: r2(me.z) });
      g.sfx('buy'); g.ui.toast(`🔦 횃불을 세웠어! 밤 ${CAMP.TORCH_NIGHTS}번 동안 빛이 나`);
    }
    g.persist();
  }
  addTorch(x, z) {
    const c = this.c;
    if (c.torches.length >= CAMP.TORCH_MAX) c.torches.shift();
    c.torches.push([r2(x), r2(z), CAMP.TORCH_NIGHTS]);
  }
  say(text) { if (this.toastT > 0) return; this.toastT = 1.8; this.game.ui.toast(text); this.game.sfx('nope'); }
  // E: 가까운 늑대 때리기 → 나무 베기 → 열매 따기
  use() {
    const g = this.game, c = this.c, me = g.player;
    if (this.cool > 0) return;
    this.cool = 0.35;
    let mon = null, md = 3;
    for (const m of this.monsters.values()) { const d = Math.hypot(m.x - me.x, m.z - me.z); if (d < md + m.r) { md = d; mon = m; } }
    if (mon) {
      g.sfx('hit');
      g.effects.burst(mon.x, 1.2, mon.z, ['#2a2d3a', '#ff3b3b', '#ffffff'], 8, 4);
      if (this.auth) this.hitMonster(mon, CAMP.AXE, this.myNum, me);
      else this.net.send({ t: 'cp', k: 'hit', id: mon.id, x: r2(me.x), z: r2(me.z) });
      return;
    }
    let tree = null, td = 2.7;
    for (const t of this.trees) { if (t.down > 0) continue; const d = Math.hypot(t.x - me.x, t.z - me.z); if (d < td) { td = d; tree = t; } }
    if (tree) { this.chop(tree, () => { c.wood++; }); g.sfx('hit'); return; }
    for (const b of this.bushes) {
      if (b.t > 0 || Math.hypot(b.x - me.x, b.z - me.z) > 2.6) continue;
      b.t = CAMP.BUSH_REGROW; b.berries.visible = false;
      c.berry += CAMP.BERRY; g.sfx('coin'); g.ui.toast(`🫐 열매 ${CAMP.BERRY}개!`);
      return;
    }
    this.cool = 0.1;
    this.say('🪓 나무, 열매 덤불, 늑대 가까이에서 눌러!');
  }
  chop(t, gain) {
    t.hp--; t.shake = 0.25;
    gain();
    this.game.effects.burst(t.x, 1.5, t.z, ['#c98a4b', '#8b5a3c', '#3a8f55'], 6, 4);
    if (t.hp <= 0) { t.down = CAMP.TREE_REGROW; t.box.on = false; this.game.sfx('crumble'); }
    this.drawTree(t);
  }

  // ───── 늑대 ─────
  spawnMonster(type, rnd = Math.random) {
    const N = nightMonsters(this.c.day);
    const a = rnd() * Math.PI * 2, r = CAMP_R - 8 - rnd() * 10;
    const boss = type === 'boss';
    const body = makeCritter(boss ? 'shade' : 'wolf');
    const mesh = new THREE.Group(); body.scale.setScalar(boss ? 2.8 : 1.5); mesh.add(body);
    if (boss) { const tag = textSprite('👁️ 그림자 거인', { bg: 'rgba(40,20,80,0.85)', size: 36, scale: 0.013 }); tag.position.y = 5.4; mesh.add(tag); }
    this.group.add(mesh);
    const id = this.nextId++;
    const m = { id, boss, body, mesh, x: Math.cos(a) * r, z: Math.sin(a) * r, yaw: 0, hp: boss ? N.bossHp : N.wolfHp, max: boss ? N.bossHp : N.wolfHp, dmg: boss ? 25 : N.wolfDmg, speed: boss ? 4.6 : Math.min(8, 6 + this.c.day * 0.03), r: boss ? 2 : 0.7, atk: 0, flee: 0, wa: a, tx: 0, tz: 0 };
    this.monsters.set(id, m);
    return m;
  }
  removeMonster(m, poof) {
    if (poof) this.game.effects.burst(m.x, 1.2, m.z, ['#2a2d3a', '#5b3aff', '#ffffff'], m.boss ? 40 : 14, m.boss ? 8 : 5);
    m.mesh.traverse(o => { if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); } });
    m.mesh.removeFromParent();
    this.monsters.delete(m.id);
  }
  hitMonster(m, dmg, by, from) {
    m.hp -= dmg; m.flee = 0.8;
    const dx = m.x - from.x, dz = m.z - from.z, d = Math.hypot(dx, dz) || 1;
    if (!m.boss) { m.x += (dx / d) * 2; m.z += (dz / d) * 2; }
    if (m.hp <= 0) {
      this.removeMonster(m, true);
      this.killed(by, m.boss);
      this.net.send({ t: 'cp', k: 'dead', id: m.id, by, b: m.boss ? 1 : 0 });
    }
  }
  killed(by, boss) {
    const g = this.game;
    if (by === this.myNum && !(by < 0)) {
      this.c.meat += boss ? 5 : 1;
      g.sfx('coin');
      if (boss) { g.addCoins(30); g.ui.big('👁️ 그림자 거인을 쫓아냈어! 🥩+5 · 🪙+30', 2600, 'gold'); }
      else g.ui.toast('🐺 늑대를 쫓아냈어! 🥩 날고기 +1', 1400);
    } else if (boss) g.ui.big('👁️ 그림자 거인이 사라졌어!', 2000, 'gold');
  }
  // 맞을 수 있는 사람들 (나, 친구, AI)
  victims() {
    const g = this.game, out = [];
    if (!g.isDead() && !this.downT) out.push({ me: true, x: g.player.x, z: g.player.z });
    if (this.net.active) for (const id of this.net.peers) { const r = g.remotes.get(id); if (r && r.w === 8 && r.avatar) out.push({ id, x: r.x, z: r.z }); }
    this.bots.forEach((b, k) => { if (b.hp > 0) out.push({ bot: k, x: b.x, z: b.z }); });
    return out;
  }
  stepMonsters(dt) {
    const lights = this.lights();
    const vs = this.victims().filter(v => !this.inLight(v.x, v.z, -0.3));
    for (const m of this.monsters.values()) {
      m.atk -= dt; m.flee -= dt;
      if (!this.isNight) { m.dawn = (m.dawn ?? 0) + dt; if (m.dawn > 0.4) { this.removeMonster(m, true); continue; } }
      let tx, tz, sp = m.speed;
      let tgt = null, td = 45;
      for (const v of vs) { const d = Math.hypot(v.x - m.x, v.z - m.z); if (d < td) { td = d; tgt = v; } }
      if (m.flee > 0) { const d = Math.hypot(m.x, m.z) || 1; tx = m.x + (m.x / d) * 5; tz = m.z + (m.z / d) * 5; }
      else if (tgt) { tx = tgt.x; tz = tgt.z; }
      else { m.wa += dt * 0.15 * (m.id % 2 ? 1 : -1); const rr = Math.max(this.fireR + 4, 12); tx = Math.cos(m.wa) * rr; tz = Math.sin(m.wa) * rr; sp *= 0.5; }
      const dx = tx - m.x, dz = tz - m.z, d = Math.hypot(dx, dz);
      let moving = false;
      if (d > 0.1) { const s = Math.min(d, sp * dt); m.x += (dx / d) * s; m.z += (dz / d) * s; m.yaw = Math.atan2(dx, dz); moving = true; }
      // 빛 안으로는 못 들어온다: 빛 가장자리로 밀어낸다
      for (const l of lights) {
        if (l.r <= 0) continue;
        const lx = m.x - l.x, lz = m.z - l.z, ld = Math.hypot(lx, lz), edge = l.r + m.r * 0.6;
        if (ld < edge) { const k = edge / (ld || 1); m.x = l.x + lx * k; m.z = l.z + lz * k; }
      }
      const rr = Math.hypot(m.x, m.z); if (rr > CAMP_R) { m.x *= CAMP_R / rr; m.z *= CAMP_R / rr; }
      if (tgt && m.atk <= 0 && Math.hypot(tgt.x - m.x, tgt.z - m.z) < 1.3 + m.r) {
        m.atk = 1;
        if (tgt.me) this.hurtMe(m.dmg);
        else if (tgt.id) this.net.sendTo(tgt.id, { t: 'cp', k: 'hurt', d: m.dmg });
        else if (tgt.bot !== undefined) this.hurtBot(this.bots[tgt.bot], m.dmg);
      }
      this.drawMonster(m, moving);
    }
  }
  drawMonster(m, moving) {
    m.mesh.position.set(m.x, 0, m.z); m.mesh.rotation.y = m.yaw;
    const { legs } = m.body.userData;
    const tt = this.t * (m.boss ? 6 : 12);
    legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(tt + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.7 : 0; });
  }
  hurtMe(dmg) {
    const g = this.game, c = this.c;
    if (g.isDead() || this.downT > 0) return;
    c.hp -= dmg;
    this.hurtT = 0.35;
    g.sfx('hurt');
    if (c.hp <= 0) this.down();
  }
  down() {
    const g = this.game, c = this.c;
    c.lives--;
    g.burstMe();
    g.myAvatar.root.visible = false;
    this.downT = 2.5;
    if (c.lives > 0) g.ui.big(`💀 쓰러졌어! 목숨 ${c.lives}개 남음 · 모닥불에서 다시 일어나`, 2400);
    else if (this.net.active) g.ui.big('💀 목숨을 다 썼어! 다시 목숨 3개로 일어나', 2600);
    else g.ui.big(`💀 ${c.day}일째에 쓰러졌어… 처음부터 다시! (최고 ${Math.max(c.best, c.day - 1)}일)`, 3600);
    g.persist();
  }
  getUp() {
    const g = this.game, c = this.c;
    this.downT = 0;
    if (c.lives <= 0) {
      if (this.net.active) c.lives = CAMP.LIVES;
      else this.resetRun(false);
    }
    c.hp = CAMP.HP; c.hunger = Math.max(c.hunger, 60);
    g.teleport(0, 0.3, 4, 0);
    g.myAvatar.root.visible = true;
  }
  resetRun(won) {
    const c = this.c;
    const keep = { best: Math.max(c.best, won ? CAMP.DAYS : c.day - 1), wins: c.wins + (won ? 1 : 0), runs: c.runs + 1 };
    Object.assign(c, freshCamp(), keep);
    for (const m of [...this.monsters.values()]) this.removeMonster(m, false);
    for (const t of this.trees) { t.down = 0; t.hp = CAMP.TREE_HP; t.box.on = true; this.drawTree(t); }
    for (const b of this.bots) { b.hp = 100; b.wood = 0; b.x = Math.cos(b.k * 2.1) * 5; b.z = Math.sin(b.k * 2.1) * 5; }
    this.syncSky(true);
    this.game.persist();
  }

  // ───── 하루 ─────
  syncSky(force) {
    const night = this.isNight;
    if (!force && night === this.night) return;
    this.night = night;
    this.game.setSky?.(night ? 'campNight' : 'camp');
  }
  nightStarts() {
    const g = this.game, N = nightMonsters(this.c.day);
    this.spawnQ = N.wolves + (N.boss ? 1 : 0);
    this.bossQ = N.boss;
    this.spawnT = 2;
    g.sfx('crumble');
    g.ui.big(N.boss ? `🌙 ${this.c.day}일째 밤… 👁️ 그림자 거인이 온다! 불빛 안에 있어!` : `🌙 ${this.c.day}일째 밤! 늑대 ${N.wolves}마리 · 불빛 안에 있어`, 2600, N.boss ? 'gold' : '');
  }
  dayEnds() {
    const g = this.game, c = this.c;
    const survived = c.day;
    c.torches = c.torches.map(([x, z, n]) => [x, z, n - 1]).filter(t => t[2] > 0);
    const coins = dayCoins(survived);
    g.addCoins(coins);
    if (survived >= CAMP.DAYS) {
      g.sfx('win'); g.effects.confetti(g.player.x, g.player.y + 4, g.player.z, 400);
      g.ui.big(`🏆 99일 버텼어!! 대단해! 🪙+${coins}`, 6000, 'gold');
      if (this.auth) this.resetRun(true);
      return;
    }
    c.day++;
    if (c.day - 1 > c.best) c.best = c.day - 1;
    g.sfx('check');
    g.ui.big(`☀️ ${survived}일 버텼어! ${c.day}일째 아침 · 🪙+${coins}`, 2400, coins > 2 ? 'gold' : '');
    g.persist();
  }
  updateDay(dt) {
    const c = this.c;
    c.t += dt;
    if (c.t >= CAMP.DAY + CAMP.NIGHT) { c.t = 0; this.dayEnds(); }
    // 밤이 되면 (밤 중간에 들어와도) 그날 밤 늑대를 한 번 부른다
    if (this.isNight && this.spawnedDay !== c.day) { this.spawnedDay = c.day; this.nightStarts(); }
    // 불 연료
    c.fuel = Math.max(0, c.fuel - dt * (this.isNight ? CAMP.BURN_NIGHT : CAMP.BURN_DAY));
    if (this.isNight && this.spawnQ > 0) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) { this.spawnT = 1.2; this.spawnQ--; this.spawnMonster(this.bossQ && this.spawnQ === 0 ? 'boss' : 'wolf'); }
    }
  }
  feedFire(n) {
    const c = this.c, before = this.fireLv;
    c.fuel = Math.min(CAMP.FUEL_MAX, c.fuel + n * CAMP.WOOD_FUEL);
    c.fed += n;
    if (this.fireLv > before) { this.game.sfx('win'); this.game.ui.big(`🔥 모닥불 Lv${this.fireLv}! 빛이 더 넓어졌어`, 2000, 'gold'); }
  }

  // ───── AI 캠프 친구 (혼자 할 때) ─────
  makeBots() {
    this.bots = [];
    if (this.net.active) return;
    const rnd = seeded(Date.now() % 1e9);
    for (let k = 0; k < 3; k++) {
      const look = { skin: Math.floor(rnd() * SKINS.length), shirt: Math.floor(rnd() * COLORS.length), pants: Math.floor(rnd() * COLORS.length), hat: Math.floor(rnd() * 8), face: Math.floor(rnd() * 6), emblem: Math.floor(rnd() * 6), hair: Math.floor(rnd() * 12), hairColor: Math.floor(rnd() * 10) };
      const short = displayName([Math.floor(rnd() * ADJECTIVES.length), Math.floor(rnd() * ANIMALS.length)]);
      const avatar = new Avatar(look, `🤖 ${short}`);
      this.group.add(avatar.root);
      this.bots.push({ k, avatar, short, x: Math.cos(k * 2.1) * 5, z: Math.sin(k * 2.1) * 5, yaw: 0, hp: 100, wood: 0, state: 'idle', tree: null, cool: 0, think: rnd() * 2, rnd: seeded(Math.floor(rnd() * 1e9)), spot: null });
    }
  }
  hurtBot(b, dmg) {
    if (!b || b.hp <= 0) return;
    b.hp -= dmg;
    if (b.hp <= 0) { this.game.effects.burst(b.x, 1.5, b.z, ['#ffffff', '#ff3b3b'], 14, 5); b.avatar.root.visible = false; b.avatar.say?.('으악!'); }
  }
  botGo(b, x, z, dt, sp = 7.5) {
    const dx = x - b.x, dz = z - b.z, d = Math.hypot(dx, dz);
    if (d > 0.05) { const s = Math.min(d, sp * dt); b.x += (dx / d) * s; b.z += (dz / d) * s; b.yaw = Math.atan2(dx, dz); }
    return d;
  }
  updateBots(dt) {
    const taken = new Set(this.bots.map(b => b.tree).filter(Boolean));
    for (const b of this.bots) {
      b.cool -= dt;
      let moving = false;
      if (b.hp <= 0) { if (!this.isNight) { b.hp = 100; b.avatar.root.visible = true; b.x = 3; b.z = 3; } continue; }
      if (this.isNight && b.wood > 0) {
        b.tree = null;
        if (this.botGo(b, 0, 0, dt) < 3.2) { this.feedFire(b.wood); b.wood = 0; } else moving = true;
      } else if (this.isNight) {
        // 밤: 불빛 안에 있다가, 빛 가장자리로 온 늑대를 때린다
        b.tree = null;
        let mon = null, md = 7;
        for (const m of this.monsters.values()) { const d = Math.hypot(m.x - b.x, m.z - b.z); if (d < md && this.inLight(m.x, m.z, -3)) { md = d; mon = m; } }
        if (mon) {
          const want = Math.max(0.8, this.fireR - 1.2), mdist = Math.hypot(mon.x, mon.z) || 1;
          const tx = (mon.x / mdist) * Math.min(want, mdist - 1.5), tz = (mon.z / mdist) * Math.min(want, mdist - 1.5);
          moving = this.botGo(b, tx, tz, dt) > 0.3;
          if (md < 2.6 && b.cool <= 0) { b.cool = 0.8; this.hitMonster(mon, 15, -(b.k + 1), b); this.game.effects.burst(mon.x, 1.2, mon.z, ['#2a2d3a', '#ff3b3b'], 5, 3); }
        } else {
          if (!b.spot || b.rnd() < 0.003) { const a = b.rnd() * Math.PI * 2, r = Math.max(1.5, this.fireR * 0.55) * Math.sqrt(b.rnd()); b.spot = [Math.cos(a) * r, Math.sin(a) * r]; }
          moving = this.botGo(b, b.spot[0], b.spot[1], dt, 4) > 0.3;
        }
      } else if (b.wood >= 6 || (b.wood > 0 && this.c.fuel < 30)) {
        // 나무를 들고 모닥불로
        b.tree = null;
        if (this.botGo(b, 0, 0, dt) < 3.2) { this.feedFire(b.wood); b.wood = 0; if (b.rnd() < 0.3) b.avatar.say(['불 지폈어! 🔥', '나무 넣었어~', '따뜻하다'][Math.floor(b.rnd() * 3)]); }
        else moving = true;
      } else {
        // 가장 가까운 나무 베기 (밤이 오기 전에는 너무 멀리 안 간다)
        if (!b.tree || b.tree.down > 0) {
          let best = null, bd = 1e9;
          for (const t of this.trees) { if (t.down > 0 || taken.has(t)) continue; const d = Math.hypot(t.x - b.x, t.z - b.z) + Math.hypot(t.x, t.z) * 0.5; if (d < bd) { bd = d; best = t; } }
          b.tree = best; if (best) taken.add(best);
        }
        const t = b.tree;
        if (t) {
          const d = Math.hypot(t.x - b.x, t.z - b.z);
          if (d > 1.8) { const k = (d - 1.5) / d; moving = this.botGo(b, b.x + (t.x - b.x) * k, b.z + (t.z - b.z) * k, dt) > 0.05; }
          else if (b.cool <= 0) { b.cool = 0.7; b.yaw = Math.atan2(t.x - b.x, t.z - b.z); this.chop(t, () => { b.wood++; }); }
        }
      }
      b.avatar.place(b.x, 0.3, b.z, b.yaw, dt);
      b.avatar.animate(dt, { speed: moving ? 7 : 0, grounded: true, vy: 0, climb: false, emote: 0 });
    }
  }

  // ───── 친구 방 ─────
  message(d, from) {
    const g = this.game, hostId = this.net.room.hostId;
    if (this.auth) {
      if (d.k === 'feed' && Number.isInteger(d.n) && d.n > 0 && d.n <= 20) this.feedFire(d.n);
      else if (d.k === 'torch' && Number.isFinite(d.x) && Number.isFinite(d.z)) this.addTorch(d.x, d.z);
      else if (d.k === 'hit' && Number.isInteger(d.id)) { const m = this.monsters.get(d.id); if (m && Number.isFinite(d.x) && Number.isFinite(d.z)) this.hitMonster(m, CAMP.AXE, numOf(from), { x: d.x, z: d.z }); }
      return;
    }
    if (from !== hostId) return;
    if (d.k === 'tick') {
      const c = this.c;
      const day = d.d | 0;
      if (Number.isFinite(d.t)) {
        const wasNight = this.isNight;
        if (day > c.day && day >= 1) { const coins = dayCoins(c.day); g.addCoins(coins); g.ui.big(`☀️ ${c.day}일 버텼어! ${day}일째 아침 · 🪙+${coins}`, 2400); }
        if (day >= 1 && day <= CAMP.DAYS) c.day = day;
        c.t = d.t;
        if (!wasNight && this.isNight) g.ui.big(`🌙 ${c.day}일째 밤! 불빛 안에 있어`, 2200);
      }
      if (Number.isFinite(d.f)) c.fuel = d.f;
      if (Number.isInteger(d.fd)) c.fed = d.fd;
      if (Array.isArray(d.tr)) { c.torches = []; for (let i = 0; i + 2 < d.tr.length && c.torches.length < CAMP.TORCH_MAX; i += 3) c.torches.push([d.tr[i], d.tr[i + 1], d.tr[i + 2]]); }
      if (Array.isArray(d.m)) {
        const seen = new Set();
        for (const q of d.m) {
          if (!Array.isArray(q) || !q.slice(0, 5).every(Number.isFinite)) continue;
          const [id, boss, x, z, hp] = q;
          seen.add(id);
          let m = this.monsters.get(id);
          if (!m) { m = this.spawnMonster(boss ? 'boss' : 'wolf'); this.monsters.delete(m.id); m.id = id; this.monsters.set(id, m); m.x = x; m.z = z; }
          m.nx = x; m.nz = z; m.hp = hp;
        }
        for (const m of [...this.monsters.values()]) if (!seen.has(m.id)) this.removeMonster(m, true);
      }
    } else if (d.k === 'hurt' && Number.isFinite(d.d)) this.hurtMe(Math.min(60, d.d));
    else if (d.k === 'dead' && Number.isInteger(d.id)) { const m = this.monsters.get(d.id); if (m) this.removeMonster(m, true); this.killed(d.by, !!d.b); }
  }
  sendTick() {
    const c = this.c, tr = [];
    for (const [x, z, n] of c.torches) tr.push(x, z, n);
    const m = [...this.monsters.values()].slice(0, 40).map(q => [q.id, q.boss ? 1 : 0, r2(q.x), r2(q.z), Math.ceil(q.hp)]);
    this.net.send({ t: 'cp', k: 'tick', d: c.day, t: r2(c.t), f: r2(c.fuel), fd: c.fed, tr, m });
  }

  // ───── 매 프레임 ─────
  update(dt) {
    const g = this.game, c = this.c, me = g.player;
    this.t += dt;
    this.cool -= dt; this.toastT -= dt; this.feedT -= dt; this.cookT -= dt; this.saveT -= dt; this.sendT -= dt;
    if (this.auth) { this.updateDay(dt); this.stepMonsters(dt); }
    else for (const m of this.monsters.values()) { if (m.nx !== undefined) { const k = 1 - Math.exp(-dt * 10), px = m.x, pz = m.z; m.x += (m.nx - m.x) * k; m.z += (m.nz - m.z) * k; const mv = Math.hypot(m.x - px, m.z - pz) > 0.01; if (mv) m.yaw = Math.atan2(m.x - px, m.z - pz); this.drawMonster(m, mv); } }
    this.syncSky(false);
    // 나무, 덤불 다시 자라기
    for (const t of this.trees) {
      if (t.shake > 0) { t.shake -= dt; this.drawTree(t); }
      if (t.down > 0) { t.down -= dt; if (t.down <= 0) { t.hp = CAMP.TREE_HP; t.box.on = true; this.drawTree(t); } }
    }
    for (const b of this.bushes) if (b.t > 0) { b.t -= dt; if (b.t <= 0) b.berries.visible = true; }
    // 쓰러짐
    if (this.downT > 0) { this.downT -= dt; if (this.downT <= 0) this.getUp(); }
    else {
      // 배고픔과 체력
      c.hunger = Math.max(0, c.hunger - dt * CAMP.HUNGER_RATE);
      if (c.hunger <= 0) { c.hp -= dt * CAMP.STARVE; if (c.hp <= 0) this.down(); }
      else if (c.hunger > 50 && this.inLight(me.x, me.z) && c.hp < CAMP.HP) c.hp = Math.min(CAMP.HP, c.hp + dt * 1.5);
      // 불 옆: 나무 넣기, 고기 굽기
      const nearFire = Math.hypot(me.x, me.z) < CAMP.FEED_R;
      if (nearFire && c.wood > 0 && c.fuel < CAMP.FUEL_MAX - 4 && this.feedT <= 0) {
        this.feedT = 0.15; c.wood--;
        if (this.auth) this.feedFire(1); else this.net.send({ t: 'cp', k: 'feed', n: 1 });
        g.effects.burst(0, 1.2, 0, ['#ff8a1a', '#ffe066'], 5, 3);
      }
      if (nearFire && c.meat > 0 && c.fuel > 0 && this.cookT <= 0) { this.cookT = 1; c.meat--; c.cooked++; g.sfx('pop'); g.ui.toast('🍖 고기가 구워졌어! Q 로 먹어', 1200); }
    }
    if (this.auth) this.updateBots(dt);
    this.drawFire();
    this.hurtT -= dt;
    this.hurtEl.style.opacity = String(Math.max(0, this.hurtT * 2.2) + (c.hp < 30 && !this.downT ? 0.25 + Math.sin(this.t * 6) * 0.1 : 0));
    if (this.auth && this.net.live && this.sendT <= 0) { this.sendT = 0.15; this.sendTick(); }
    if (this.saveT <= 0) { this.saveT = 5; g.persist(); }
    this.updateInfo();
  }
  updateInfo() {
    const c = this.c;
    const left = this.isNight ? CAMP.DAY + CAMP.NIGHT - c.t : CAMP.DAY - c.t;
    const lives = '❤️'.repeat(Math.max(0, c.lives)) + '🖤'.repeat(Math.max(0, CAMP.LIVES - c.lives));
    const fire = c.fuel > 0 ? `🔥 Lv${this.fireLv} ${Math.ceil(c.fuel)}%` : '🔥 꺼짐!';
    const html = `<b>${this.isNight ? '🌙' : '☀️'} ${c.day}일째 / ${CAMP.DAYS} · ${this.isNight ? '밤' : '낮'} ${fmt(left)} · ${fire}</b><small>체력 ${Math.ceil(Math.max(0, c.hp))} · 🍖 ${Math.ceil(c.hunger)} · 🪵 ${c.wood} · 🫐 ${c.berry} · 🍗 ${c.cooked}${c.meat ? ` · 🥩 ${c.meat}` : ''} · ${lives}${c.best ? ` · 최고 ${c.best}일` : ''}</small>`;
    this.game.ui.setInfo(html);
  }

  dispose() {
    for (const b of this.bots) b.avatar.dispose();
    for (const m of [...this.monsters.values()]) this.removeMonster(m, false);
    this.game.world.boxes = this.game.world.boxes.filter(b => !this.trees.some(t => t.box === b));
    this.group.traverse(o => { if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); } });
    this.group.removeFromParent();
    this.bar.remove(); this.hurtEl.remove();
    document.body.classList.remove('campw');
    if (this.downT > 0) this.getUp();
    this.game.ui.setInfo('');
    this.game.persist();
  }
}
