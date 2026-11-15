// 팀전 (성 지키기): 동서남북 포털에서 몬스터가 웨이브로 나와 길을 따라 성의 보석을 공격한다.
// 친구들과 동료 봇이 같이 블래스터로 막는다. 몬스터는 방장(혼자면 나)이 움직이고, 다른 사람은 받아서 그리기만 한다.
// 몬스터는 길 위를 걸어서(부딪힘 없이) 오고, 가까운 사람이 땅에 있으면 그 사람을 먼저 때린다 (성벽 위는 안전).
import { THREE } from './render.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Avatar } from './avatar.js';
import { MONSTERS, MONSTER_TYPES, DEFENSE, waveOf, monsterHp, seeded } from '../core.mjs';
import { CASTLE } from '../worlds.mjs';

const TI = Object.fromEntries(MONSTER_TYPES.map((t, i) => [t, i]));
const r2 = v => Math.round(v * 100) / 100;

function slimeMesh(king) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.3, 1.5, 3, 0.4), new THREE.MeshStandardMaterial({ color: king ? '#3fd16b' : '#6fe07a', roughness: 0.18, transparent: true, opacity: 0.88 }));
  body.position.y = 0.65; body.castShadow = true; g.add(body);
  const white = new THREE.MeshStandardMaterial({ color: '#ffffff' }), black = new THREE.MeshStandardMaterial({ color: '#1e1f26' });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), white); e.position.set(s * 0.32, 0.85, 0.72); g.add(e);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), black); p.position.set(s * 0.32, 0.85, 0.88); g.add(p);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.05), black); mouth.position.set(0, 0.55, 0.76); g.add(mouth);
  if (king) {
    const gold = new THREE.MeshStandardMaterial({ color: '#ffcf33', metalness: 0.8, roughness: 0.25 });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 10, 1, true), gold); ring.position.y = 1.42; g.add(ring);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const sp = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 6), gold); sp.position.set(Math.cos(a) * 0.38, 1.6, Math.sin(a) * 0.38); g.add(sp); }
  }
  return g;
}

function monsterModel(type) {
  if (type === 'slime') { const g = slimeMesh(false); return { root: g, hop: g }; }
  if (type === 'king') { const g = slimeMesh(true); g.scale.setScalar(2.8); return { root: g, hop: g }; }
  const look = type === 'goblin'
    ? { skin: 6, shirt: 13, pants: 12, hat: 11, face: 5, emblem: 0, hair: 0, hairColor: 0 }
    : { skin: 4, shirt: 11, pants: 12, hat: 0, face: 3, emblem: 4, hair: 0, hairColor: 0 };
  const a = new Avatar(look, '');
  if (type === 'golem') { a.root.scale.setScalar(1.7); a.mats.skin.color.set('#8f8f99'); a.mats.shirt.color.set('#6b6f7a'); }
  else a.mats.skin.color.set('#7bd35a');
  return { root: a.root, avatar: a };
}

export class Defense {
  constructor(battle) {
    this.b = battle;
    this.game = battle.game;
    this.monsters = new Map(); // id → monster
    this.nextId = 1;
    this.wave = 0;
    this.phase = 'break';      // break(쉬는 중) · wave(몰려오는 중) · win · lose
    this.timer = DEFENSE.FIRST;
    this.coreHp = DEFENSE.CORE_HP;
    this.queue = [];
    this.spawnT = 0;
    this.team = DEFENSE.TEAM;
    this.rnd = seeded(1);
    this.makeCore();
    // 체력 막대
    this.barBg = new THREE.MeshBasicMaterial({ color: '#1e1f26', transparent: true, opacity: 0.7, depthWrite: false });
    this.barFg = new THREE.MeshBasicMaterial({ color: '#ff4d5e', depthWrite: false });
    this.barGeo = new THREE.PlaneGeometry(1, 0.14);
  }

  makeCore() {
    const g = new THREE.Group();
    this.coreMat = new THREE.MeshStandardMaterial({ color: '#7dfcff', emissive: '#3fd6ff', emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.92 });
    for (const s of [1, -1]) { const c = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.8, 6), this.coreMat); c.position.y = s * 0.9; if (s < 0) c.rotation.x = Math.PI; c.castShadow = true; g.add(c); }
    g.position.set(0, 3.6, 0);
    this.game.world.group.add(g);
    this.core = g;
  }

  start(seed, team) {
    for (const id of [...this.monsters.keys()]) this.remove(id, false);
    this.wave = 0; this.phase = 'break'; this.timer = DEFENSE.FIRST; this.coreHp = DEFENSE.CORE_HP;
    this.queue = []; this.spawnT = 0; this.team = team; this.rnd = seeded(seed);
    this.nextId = 1;
  }

  // ───── 몬스터 ─────
  add(id, type, x, z, hp, lane = 0, from = 0) {
    const M = MONSTERS[type];
    const model = monsterModel(type);
    this.game.world.group.add(model.root);
    const bar = new THREE.Group();
    const bg = new THREE.Mesh(this.barGeo, this.barBg), fg = new THREE.Mesh(this.barGeo, this.barFg);
    fg.position.z = 0.01; bar.add(bg, fg);
    bar.scale.setScalar(type === 'king' ? 3 : type === 'golem' ? 1.8 : 1.1);
    this.game.world.group.add(bar);
    const [gx, gz] = CASTLE.gates[from];
    // 길: 포털 → 성문 바깥 → 성문 → 보석
    const side = from % 2 ? [0, lane] : [lane, 0];
    const path = [[gx * 1.3 + side[0], gz * 1.3 + side[1]], [gx + side[0] * 0.6, gz + side[1] * 0.6], [side[0] * 0.3, side[1] * 0.3]];
    const m = { id, type, M, x, z, y: 0.06, hp, max: hp, path, wp: 0, cool: 0, yaw: 0, model, bar, fg, t: this.rnd() * 6, net: null, speed: 0 };
    this.monsters.set(id, m);
    return m;
  }
  remove(id, poof = true) {
    const m = this.monsters.get(id);
    if (!m) return;
    if (poof) this.game.effects.burst(m.x, m.y + m.M.h * 0.6, m.z, m.type === 'golem' ? ['#8f8f99', '#ffffff'] : m.type === 'goblin' ? ['#7bd35a', '#8b5a3c'] : ['#6fe07a', '#ffffff'], m.type === 'king' ? 60 : 16, m.type === 'king' ? 10 : 6);
    if (m.model.avatar) m.model.avatar.dispose(); else m.model.root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    m.model.root.removeFromParent();
    m.bar.removeFromParent();
    this.monsters.delete(id);
  }

  // 방장(혼자면 나)만: 맞히기
  hit(id, dmg, by) {
    const m = this.monsters.get(id);
    if (!m) return;
    m.hp -= dmg;
    if (m.hp <= 0) {
      this.remove(id);
      this.b.creditKill(by, m);
    }
  }

  // 공격할 사람 (땅 위에 있고 가까운 사람). 성벽 위(높이 차이 2.5 이상)는 못 때린다.
  victims() {
    const out = [];
    const me = this.game.player;
    if (this.b.me.alive) out.push({ me: true, x: me.x, y: me.y, z: me.z });
    for (const [id, s] of this.b.rs) { const r = this.game.remotes.get(id); if (s.alive && r && r.w === 5) out.push({ id, x: r.x, y: r.y, z: r.z }); }
    this.b.bots.forEach((bt, k) => { if (bt.alive) out.push({ bot: k, x: bt.pl.x, y: bt.pl.y, z: bt.pl.z }); });
    return out;
  }

  step(m, dt, people) {
    const M = m.M;
    m.cool -= dt;
    // 가까운 사람 먼저
    let target = null, td = 7 + M.r;
    for (const p of people) {
      if (Math.abs(p.y - m.y) > 2.5) continue;
      const d = Math.hypot(p.x - m.x, p.z - m.z);
      if (d < td) { td = d; target = p; }
    }
    let gx, gz, reach;
    if (target) { gx = target.x; gz = target.z; reach = M.r + 1.0; }
    else {
      const w = m.path[m.wp];
      gx = w[0]; gz = w[1];
      reach = m.wp === m.path.length - 1 ? 2.6 + M.r : 0.6;
    }
    const dx = gx - m.x, dz = gz - m.z, d = Math.hypot(dx, dz);
    m.speed = 0;
    if (d > reach) {
      const sp = M.speed * (m.type === 'slime' || m.type === 'king' ? 0.75 + Math.abs(Math.sin(m.t * 5)) * 0.5 : 1);
      const k = Math.min(1, (sp * dt) / d);
      m.x += dx * k; m.z += dz * k; m.speed = sp;
      m.yaw = Math.atan2(dx, dz);
    } else if (!target && m.wp < m.path.length - 1) m.wp++;
    else if (m.cool <= 0) {
      m.cool = 1.1;
      m.yaw = Math.atan2(dx, dz);
      if (target) this.b.monsterHits(target, M.dmg);
      else { this.coreHp = Math.max(0, this.coreHp - M.dmg); this.game.effects.burst(0, 3.6, 0, ['#7dfcff', '#ffffff'], 4, 3); this.coreHurt = 0.3; }
    }
  }

  // ───── 매 프레임 ─────
  update(dt, auth) {
    this.coreHurt = Math.max(0, (this.coreHurt ?? 0) - dt);
    if (auth && this.phase !== 'win' && this.phase !== 'lose') {
      if (this.phase === 'break') {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.wave++;
          this.phase = 'wave';
          const list = waveOf(this.wave, this.team);
          for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(this.rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
          // 킹 슬라임은 맨 마지막에
          list.sort((a, b) => (a === 'king') - (b === 'king'));
          this.queue = list; this.spawnT = 0;
          this.b.waveStarted(this.wave);
        }
      } else if (this.phase === 'wave') {
        this.spawnT -= dt;
        if (this.queue.length && this.spawnT <= 0) {
          this.spawnT = DEFENSE.SPAWN_GAP;
          const type = this.queue.shift();
          const from = Math.floor(this.rnd() * 4);
          const [sx, sz] = CASTLE.spawns[from];
          const lane = (this.rnd() - 0.5) * 4;
          this.add(this.nextId++, type, sx + (from % 2 ? 0 : lane), sz + (from % 2 ? lane : 0), monsterHp(type, this.wave), lane, from);
        }
        if (!this.queue.length && !this.monsters.size) {
          if (this.wave >= DEFENSE.WAVES) { this.phase = 'win'; this.b.teamEnd(true); }
          else { this.phase = 'break'; this.timer = DEFENSE.BREAK; this.b.waveCleared(this.wave); }
        }
      }
      const people = this.victims();
      for (const m of this.monsters.values()) this.step(m, dt, people);
      if (this.coreHp <= 0 && this.phase !== 'lose') { this.phase = 'lose'; this.b.teamEnd(false); }
    } else if (!auth) {
      // 받은 위치로 부드럽게
      const k = 1 - Math.exp(-dt * 10);
      for (const m of this.monsters.values()) if (m.net) {
        const px = m.x, pz = m.z;
        m.x += (m.net.x - m.x) * k; m.z += (m.net.z - m.z) * k;
        m.speed = Math.hypot(m.x - px, m.z - pz) / Math.max(dt, 1e-3);
        if (m.speed > 0.3) m.yaw = Math.atan2(m.x - px, m.z - pz);
      }
    }
    // 모양
    const cam = this.game.camera;
    for (const m of this.monsters.values()) {
      m.t += dt;
      const r = m.model.root;
      if (m.model.hop) {
        const hop = Math.abs(Math.sin(m.t * 5)) * (m.speed > 0.3 ? 0.5 : 0.08) * (m.type === 'king' ? 1.6 : 1);
        r.position.set(m.x, m.y + hop, m.z);
        r.rotation.y = m.yaw;
        const sq = 1 + Math.sin(m.t * 10) * 0.05;
        const base = m.type === 'king' ? 2.8 : 1;
        r.scale.set(base * sq, base / sq, base * sq);
      } else {
        m.model.avatar.place(m.x, m.y, m.z, m.yaw, dt);
        m.model.avatar.animate(dt, { speed: m.speed, grounded: true, vy: 0, climb: false, emote: 0 });
      }
      m.bar.position.set(m.x, m.y + m.M.h + 0.5 + (m.type === 'king' ? 1.4 : 0), m.z);
      m.bar.quaternion.copy(cam.quaternion);
      const f = Math.max(0, m.hp / m.max);
      m.fg.scale.x = Math.max(0.001, f); m.fg.position.x = -(1 - f) / 2;
      m.bar.visible = f < 1 || m.type === 'king' || m.type === 'golem';
    }
    // 보석: 빙글빙글, 맞으면 빨갛게
    const now = performance.now() / 1000;
    this.core.rotation.y = now * 0.8;
    this.core.position.y = 3.6 + Math.sin(now * 2) * 0.2;
    const hpf = this.coreHp / DEFENSE.CORE_HP;
    this.coreMat.color.set(this.coreHurt > 0 ? '#ff6b6b' : hpf > 0.5 ? '#7dfcff' : hpf > 0.25 ? '#ffd23f' : '#ff8a6b');
    this.coreMat.emissive.set(this.coreHurt > 0 ? '#ff3b3b' : hpf > 0.5 ? '#3fd6ff' : '#ff9a3d');
  }

  // ───── 네트워크 (방장 → 다른 사람) ─────
  pack() {
    return { m: [...this.monsters.values()].slice(0, 80).map(m => [m.id, TI[m.type], r2(m.x), r2(m.z), Math.ceil(m.hp), Math.ceil(m.max)]), c: Math.ceil(this.coreHp), wv: this.wave, ph: ['break', 'wave', 'win', 'lose'].indexOf(this.phase), tm: r2(this.timer), q: this.queue.length };
  }
  apply(d) {
    if (Number.isFinite(d.c)) this.coreHp = d.c;
    if (Number.isInteger(d.wv)) this.wave = d.wv;
    if (Number.isInteger(d.ph)) this.phase = ['break', 'wave', 'win', 'lose'][d.ph] ?? this.phase;
    if (Number.isFinite(d.tm)) this.timer = d.tm;
    if (Number.isInteger(d.q)) this.queueLeft = d.q;
    if (!Array.isArray(d.m)) return;
    const seen = new Set();
    for (const q of d.m) {
      if (!Array.isArray(q) || !q.every(Number.isFinite)) continue;
      const [id, ti, x, z, hp, max] = q;
      const type = MONSTER_TYPES[ti];
      if (!type) continue;
      seen.add(id);
      let m = this.monsters.get(id);
      if (!m) { m = this.add(id, type, x, z, hp); m.max = max; }
      m.net = { x, z }; m.hp = hp; m.max = max;
    }
    for (const id of [...this.monsters.keys()]) if (!seen.has(id)) this.remove(id);
  }

  get count() { return this.monsters.size + (this.queue.length || this.queueLeft || 0); }

  dispose() {
    for (const id of [...this.monsters.keys()]) this.remove(id, false);
    this.core.removeFromParent();
    this.core.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
    this.coreMat.dispose(); this.barBg.dispose(); this.barFg.dispose(); this.barGeo.dispose();
  }
}
