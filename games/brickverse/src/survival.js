// 바닥이 사라져요: 밟은 바닥은 금이 가다가 떨어진다. 세 층을 지나 용암에 빠지면 탈락, 마지막까지 남으면 우승.
// 혼자 할 때는 봇과, 친구와 할 때는 방장이 판(라운드)을 시작하고 봇을 움직인다.
import { THREE } from './render.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Avatar } from './avatar.js';
import { SURVIVAL, tileIndex, tileAt, makeBox, newPlayer, stepPlayer, seeded, displayName, ADJECTIVES, ANIMALS, SKINS, COLORS, P, PHRASES } from '../core.mjs';
import { LAYER_COLORS } from '../worlds.mjs';
import { Spectate } from './spectate.js';

const { N, TILE, LAYERS, LAVA, LOBBY, FALL_AFTER, ROUND_WAIT } = SURVIVAL;
const HALF = (N * TILE) / 2;
const tileGeo = new RoundedBoxGeometry(TILE - 0.18, 0.8, TILE - 0.18, 2, 0.12);
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class Survival {
  constructor(game) {
    this.game = game;
    this.tiles = [];
    this.meshes = LAYERS.map(() => {
      const mesh = new THREE.InstancedMesh(tileGeo, new THREE.MeshStandardMaterial({ roughness: 0.35 }), N * N);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
      game.world.group.add(mesh);
      return mesh;
    });
    for (let L = 0; L < LAYERS.length; L++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -HALF + (i + 0.5) * TILE, z = -HALF + (j + 0.5) * TILE, y = LAYERS[L] - 0.4;
      const box = makeBox({ x, y, z, w: TILE, h: 0.8, d: TILE, k: 'tile' });
      box.tile = tileIndex(L, i, j);
      game.world.boxes.push(box);
      const base = new THREE.Color(LAYER_COLORS[L]).offsetHSL(((i * 7 + j * 3) % 5 - 2) * 0.012, 0, ((i + j) % 2 ? 0.04 : -0.03));
      this.tiles.push({ L, i, j, x, y, z, box, state: 0, t: 0, drop: 0, base });
    }
    this.state = 'lobby';
    this.timer = ROUND_WAIT;
    this.round = 0;
    this.bots = [];
    this.inRound = false;
    this.alive = 0;
    this.playTime = 0;
    this.botSend = 0;
    this.lastCount = 0;
    this.participants = [];
    this.remoteAlive = new Map();
    this.m = new THREE.Matrix4(); this.c = new THREE.Color(); this.v = new THREE.Vector3(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(1, 1, 1);
    this.drawTiles(0);
  }

  get host() { return this.game.net.host; }

  // ───── 바닥 ─────
  crack(index, broadcast) {
    const t = this.tiles[index];
    if (!t || t.state !== 0) return;
    t.state = 1; t.t = 0;
    if (broadcast) this.game.net.send({ t: 'sv', k: 'tile', r: this.round, i: index });
  }

  resetTiles() {
    for (const t of this.tiles) { t.state = 0; t.t = 0; t.drop = 0; t.box.on = true; }
  }

  drawTiles(dt) {
    const counts = [0, 0, 0];
    for (const t of this.tiles) {
      if (t.state === 1) {
        t.t += dt;
        if (t.t >= FALL_AFTER) { t.state = 2; t.t = 0; t.box.on = false; if (Math.random() < 0.3) this.game.sfx('crumble'); }
      } else if (t.state === 2) { t.t += dt; t.drop += dt * 14 * t.t; }
      const mesh = this.meshes[t.L];
      const idx = t.j * N + t.i;
      let x = t.x, y = t.y, z = t.z, s = 1;
      this.c.copy(t.base);
      if (t.state === 1) {
        const k = t.t / FALL_AFTER;
        x += (Math.random() - 0.5) * 0.12 * k; z += (Math.random() - 0.5) * 0.12 * k; y -= k * 0.08;
        this.c.lerp(new THREE.Color('#ffffff'), 0.25 + k * 0.35);
      } else if (t.state === 2) {
        y -= t.drop; s = Math.max(0, 1 - t.t * 0.9);
      }
      this.v.set(x, y, z); this.s.set(s, s, s);
      this.m.compose(this.v, this.q, this.s);
      mesh.setMatrixAt(idx, this.m); mesh.setColorAt(idx, this.c);
      counts[t.L]++;
    }
    for (const m of this.meshes) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }

  // ───── 봇 ─────
  makeBots(count, seed) {
    for (const b of this.bots) b.avatar.dispose();
    this.bots = [];
    const rnd = seeded(seed);
    for (let k = 0; k < count; k++) {
      const look = { skin: Math.floor(rnd() * SKINS.length), shirt: Math.floor(rnd() * COLORS.length), pants: Math.floor(rnd() * COLORS.length), hat: Math.floor(rnd() * 8), face: Math.floor(rnd() * 6), emblem: Math.floor(rnd() * 6), hair: Math.floor(rnd() * 12), hairColor: Math.floor(rnd() * 10) };
      const name = `🤖 ${displayName([Math.floor(rnd() * ADJECTIVES.length), Math.floor(rnd() * ANIMALS.length)])}`;
      const avatar = new Avatar(look, name);
      this.game.world.group.add(avatar.root);
      const skill = 0.8 + rnd() * 0.2; // 0.8~1.0: 잘하는 봇 (2026-11-07 인혁: "컴퓨터가 너무 못해")
      this.bots.push({ avatar, pl: newPlayer(0, LOBBY, 0), alive: false, yaw: rnd() * 6, think: 0, dir: { x: 0, z: 0 }, skill, jump: false, target: null, lastDir: null, leap: false, name, wanderT: rnd() * 5, rnd: seeded(seed + k * 101) });
    }
  }

  // 칸 하나 (없으면 null)
  tileOf(L, i, j) {
    if (L < 0 || L >= LAYERS.length || i < 0 || j < 0 || i >= N || j >= N) return null;
    return this.tiles[tileIndex(L, i, j)];
  }
  // 멀쩡한 칸인가 (다른 봇이 가려는 칸은 조금 피한다)
  intact(t) { return !!t && t.state === 0; }
  // 이 칸 둘레 8칸 중 멀쩡한 칸 수 (클수록 오래 버틸 수 있는 곳)
  room(t) {
    let n = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if ((di || dj) && this.intact(this.tileOf(t.L, t.i + di, t.j + dj))) n++;
    return n;
  }

  // 봇: 서 있는 칸이 떨어지기 전에 계속 옆 칸으로 옮겨 가고, 둘레에 바닥이 많이 남은 칸을 고른다.
  // 앞에 구멍이 있으면 점프로 건너고, 옆 칸이 다 없으면 두 칸 떨어진 곳으로 뛴다.
  plan(b, L, i, j) {
    const taken = new Set(this.bots.filter(o => o !== b && o.alive && o.target).map(o => o.target));
    let best = null, bestScore = -1e9;
    for (let r = 1; r <= 2 && !best; r++) {
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const t = this.tileOf(L, i + di, j + dj);
        if (!this.intact(t)) continue;
        const diag = di && dj ? 1 : 0;
        const centre = (Math.abs(t.i - (N - 1) / 2) + Math.abs(t.j - (N - 1) / 2)) * 0.12;
        const keep = b.lastDir ? (di * b.lastDir[0] + dj * b.lastDir[1] > 0 ? 0.6 : 0) : 0; // 가던 쪽으로 계속 (덜 흔들림)
        let score = this.room(t) * 1.4 - diag * 0.9 - centre + keep - (taken.has(t) ? 3 : 0) - (r - 1) * 2.5;
        score += b.rnd() * (1 - b.skill) * 6; // 실수
        if (score > bestScore) { bestScore = score; best = t; }
      }
    }
    if (best) { b.lastDir = [Math.sign(best.i - i), Math.sign(best.j - j)]; b.leap = Math.max(Math.abs(best.i - i), Math.abs(best.j - j)) > 1; }
    return best;
  }

  botBrain(b, dt) {
    const pl = b.pl;
    if (!b.alive) {
      // 대기실에서 어슬렁
      b.wanderT -= dt;
      if (b.wanderT <= 0) { b.wanderT = 1.5 + b.rnd() * 3; const a = b.rnd() * 6.28; const go = b.rnd() < 0.6; b.dir = go ? { x: Math.cos(a) * 0.5, z: Math.sin(a) * 0.5 } : { x: 0, z: 0 }; }
      if (Math.abs(pl.x) > 8 || Math.abs(pl.z) > 8) b.dir = { x: -Math.sign(pl.x) * 0.5, z: -Math.sign(pl.z) * 0.5 };
      b.target = null;
      return;
    }
    b.think -= dt;
    const L = pl.ground ? LAYERS.findIndex(ly => Math.abs(pl.y - ly) < 1.2) : -1;
    if (L < 0) return; // 떨어지는 중: 하던 방향 그대로
    const at = tileAt(pl.x, pl.z);
    if (!at) { b.dir = { x: -Math.sign(pl.x), z: -Math.sign(pl.z) }; return; }
    const [i, j] = at;
    const here = this.tileOf(L, i, j);
    const arrived = b.target && b.target.L === L && b.target.i === i && b.target.j === j;
    const lost = !b.target || b.target.L !== L || b.target.state !== 0;
    // 목표 칸에 들어서면 바로 다음 칸을 고른다 (서 있으면 바닥이 떨어지니까). 반응 속도는 실력에 따라.
    if ((arrived || lost) && b.think <= 0) {
      b.target = this.plan(b, L, i, j);
      b.think = (1 - b.skill) * 0.25;
      if (!b.target) b.target = null;
    }
    const t = b.target;
    if (!t) { b.dir = { x: 0, z: 0 }; return; }
    // 목표 칸 가운데로 (도착하면 다음 칸 쪽으로 미리 기울이기)
    const dx = t.x - pl.x, dz = t.z - pl.z, len = Math.hypot(dx, dz) || 1;
    b.dir = { x: dx / len, z: dz / len };
    // 바로 앞이 구멍이면 점프 (두 칸 너머로 갈 때도)
    const ax = pl.x + b.dir.x * 1.3, az = pl.z + b.dir.z * 1.3;
    const ahead = tileAt(ax, az);
    const aheadTile = ahead && this.tileOf(L, ahead[0], ahead[1]);
    const gap = !this.intact(aheadTile) && aheadTile !== t;
    const sinking = here && here.state === 1 && here.t > FALL_AFTER * 0.7 && len > TILE * 0.9;
    if ((gap || (b.leap && len < TILE * 1.7) || sinking) && b.rnd() < 0.55 + b.skill * 0.45) b.jump = true;
  }

  // ───── 판 진행 ─────
  participantsNow() {
    return [this.game.net.active ? this.game.net.id : 'me', ...(this.game.net.active ? this.game.net.peers.filter(id => this.game.remotes.get(id)?.w === 3) : [])];
  }

  startRound(seed, list, botCount) {
    this.round++;
    this.resetTiles();
    this.state = 'play';
    this.playTime = 0;
    this.participants = list;
    const rnd = seeded(seed);
    const spots = [];
    for (let k = 0; k < list.length + botCount; k++) spots.push([Math.floor(rnd() * (N - 2)) + 1, Math.floor(rnd() * (N - 2)) + 1]);
    const meId = this.game.net.active ? this.game.net.id : 'me';
    const myIndex = list.indexOf(meId);
    this.inRound = myIndex >= 0;
    if (this.inRound) {
      const [i, j] = spots[myIndex];
      this.game.teleport(-HALF + (i + 0.5) * TILE, LAYERS[0] + 0.5, -HALF + (j + 0.5) * TILE, this.game.player.yaw);
    }
    this.makeBots(botCount, seed);
    this.bots.forEach((b, k) => {
      const [i, j] = spots[list.length + k];
      Object.assign(b.pl, newPlayer(-HALF + (i + 0.5) * TILE, LAYERS[0] + 0.5, -HALF + (j + 0.5) * TILE));
      b.alive = true; b.target = null; b.lastDir = null; b.think = 0;
    });
    this.remoteAlive = new Map(list.filter(id => id !== meId).map(id => [id, true]));
    this.game.sfx('go');
    this.game.ui.big('시작! 🔥', 1100);
  }

  out(reason) {
    if (!this.inRound) return;
    this.inRound = false;
    const sec = this.playTime;
    const rank = this.countAlive() + 1;
    const coins = Math.floor(sec / 3) + (rank <= 3 ? (4 - rank) * 5 : 0);
    const s = this.game.save.survival;
    if (sec > s.best) s.best = Math.floor(sec);
    this.game.addCoins(coins);
    this.game.ui.big(`탈락! ${fmt(sec)} 버텼어 · ${rank}등 · 🪙+${coins}`, 3000);
    this.game.net.send({ t: 'sv', k: 'out', r: this.round });
    void reason;
    this.game.persist();
  }

  // 탈락하면 남은 사람 관전 (◀ ▶, Q/E)
  startSpectate() {
    this.spec?.dispose();
    this.spec = new Spectate(this.game, () => {
      const list = [];
      this.bots.forEach((b, k) => { if (b.alive) list.push({ key: `b${k}`, name: b.name, x: b.pl.x, y: b.pl.y, z: b.pl.z }); });
      for (const [id, alive] of this.remoteAlive) { const r = this.game.remotes.get(id); if (alive && r && r.w === 3) list.push({ key: id, name: r.name, x: r.x, y: r.y, z: r.z }); }
      return list;
    }, { onLeave: () => this.stopSpectate() });
  }
  stopSpectate() { this.spec?.dispose(); this.spec = null; }
  spectateTarget() { return this.spec ? this.spec.update() : null; }
  key(code) { return !!this.spec?.key(code); }

  countAlive() {
    let n = this.bots.filter(b => b.alive).length + (this.inRound ? 1 : 0);
    for (const v of this.remoteAlive.values()) if (v) n++;
    return n;
  }

  win() {
    const s = this.game.save.survival;
    s.wins++;
    if (this.playTime > s.best) s.best = Math.floor(this.playTime);
    const coins = 30 + Math.floor(this.playTime / 3);
    this.game.addCoins(coins);
    this.game.sfx('win');
    const p = this.game.player;
    this.game.effects.confetti(p.x, p.y + 3, p.z, 200);
    this.game.ui.big(`🏆 우승! ${fmt(this.playTime)} · 🪙+${coins}`, 3600, 'gold');
    this.inRound = false;
    this.game.persist();
  }

  endRound() {
    this.stopSpectate();
    this.state = 'end';
    this.timer = 4;
  }

  toLobby() {
    this.state = 'lobby';
    this.timer = ROUND_WAIT;
    this.resetTiles();
    for (const b of this.bots) { b.alive = false; Object.assign(b.pl, newPlayer((Math.random() - 0.5) * 12, LOBBY + 0.2, (Math.random() - 0.5) * 12)); }
    if (this.game.player.y < LOBBY - 2) this.game.teleport((Math.random() - 0.5) * 8, LOBBY + 0.2, 2 + Math.random() * 4, Math.PI);
  }

  message(data, from) {
    if (data.k === 'tile' && data.r === this.round && Number.isInteger(data.i)) this.crack(data.i, false);
    else if (data.k === 'start' && from === this.game.net.room.hostId && Number.isInteger(data.seed) && Array.isArray(data.list)) {
      this.startRound(data.seed, data.list.filter(id => typeof id === 'string').slice(0, 8), Math.max(0, Math.min(6, data.bots | 0)));
      this.round = data.r | 0;
    } else if (data.k === 'out' && data.r === this.round) this.remoteAlive.set(from, false);
    else if (data.k === 'bots' && from === this.game.net.room.hostId && Array.isArray(data.q)) {
      data.q.forEach((q, k) => {
        const b = this.bots[k];
        if (!b || !Array.isArray(q)) return;
        const [x, y, z, yaw, alive] = q;
        if ([x, y, z, yaw].every(Number.isFinite)) { b.net = { x, y, z, yaw }; b.alive = !!alive; }
      });
    } else if (data.k === 'end' && from === this.game.net.room.hostId) {
      if (this.inRound) this.win();
      this.endRound();
    } else if (data.k === 'lobby' && from === this.game.net.room.hostId) this.toLobby();
  }

  update(dt) {
    const game = this.game, net = game.net;
    const authority = !net.active || net.host;
    // 판 진행
    if (this.state === 'lobby') {
      this.timer -= dt;
      const sec = Math.ceil(this.timer);
      if (sec !== this.lastCount && sec <= 3 && sec > 0) { this.lastCount = sec; game.sfx('tick'); game.ui.big(String(sec), 800); }
      if (this.timer <= 0 && authority) {
        const seed = (Math.random() * 1e9) | 0;
        const list = this.participantsNow();
        const bots = Math.max(0, 6 - list.length);
        this.startRound(seed, list, bots);
        net.send({ t: 'sv', k: 'start', r: this.round, seed, list, bots });
      } else if (this.timer <= -3 && !authority) this.timer = ROUND_WAIT; // 방장 소식을 기다림
    } else if (this.state === 'play') {
      this.playTime += dt;
      if (authority) {
        const alive = this.countAlive();
        const total = this.participants.length + this.bots.length;
        if (alive <= (total > 1 ? 1 : 0)) {
          if (this.inRound) this.win();
          net.send({ t: 'sv', k: 'end', r: this.round });
          this.endRound();
        }
      }
    } else if (this.state === 'end') {
      this.timer -= dt;
      if (this.timer <= 0 && authority) { this.toLobby(); net.send({ t: 'sv', k: 'lobby' }); }
    }

    // 내 발밑 (시작하고 1초는 안 떨어진다)
    const me = game.player;
    const ready = this.state === 'play' && this.playTime > 1.1;
    if (ready && this.inRound && me.ground?.tile !== undefined) this.crack(me.ground.tile, true);
    // 내가 아래층에 있으면 위층을 투명하게
    this.meshes.forEach((m, L) => {
      const above = me.y < LAYERS[L] - 1.5;
      const want = above ? 0.28 : 1;
      if (m.material.opacity !== want) { m.material.transparent = want < 1; m.material.opacity = want; m.material.depthWrite = want === 1; m.material.needsUpdate = true; m.castShadow = want === 1; }
    });
    if (this.inRound && me.y < LAVA + 4) { this.out('lava'); game.burstMe(); game.teleport((Math.random() - 0.5) * 8, LOBBY + 0.2, 2 + Math.random() * 4, Math.PI); if (this.state === 'play') this.startSpectate(); }

    // 봇
    const boxes = game.world.boxes;
    this.botSend -= dt;
    const pack = [];
    for (const b of this.bots) {
      if (authority) {
        this.botBrain(b, dt);
        const ev = stepPlayer(b.pl, { mx: b.dir.x, mz: b.dir.z, jump: b.jump }, boxes, dt);
        b.jump = false;
        void ev;
        if (ready && b.alive && b.pl.ground?.tile !== undefined) this.crack(b.pl.ground.tile, true);
        if (b.alive && b.pl.y < LAVA + 4) {
          b.alive = false;
          game.effects.burst(b.pl.x, LAVA + 2, b.pl.z, [COLORS[b.avatar.look.shirt], '#ff7a1a'], 16, 7);
          Object.assign(b.pl, newPlayer((Math.random() - 0.5) * 12, LOBBY + 0.2, (Math.random() - 0.5) * 12));
          if (b.rnd() < 0.5) b.avatar.say(PHRASES[[5, 11, 6][Math.floor(b.rnd() * 3)]]);
        }
        const sp = Math.hypot(b.pl.vx, b.pl.vz);
        if (sp > 0.3) b.yaw = Math.atan2(b.pl.vx, b.pl.vz);
        b.avatar.place(b.pl.x, b.pl.y, b.pl.z, b.yaw, dt);
        b.avatar.animate(dt, { speed: sp, grounded: !!b.pl.ground, vy: b.pl.vy, climb: false, emote: 0 });
        pack.push([r2(b.pl.x), r2(b.pl.y), r2(b.pl.z), r2(b.yaw), b.alive ? 1 : 0]);
      } else if (b.net) {
        const k = 1 - Math.exp(-dt * 12);
        const prev = { x: b.pl.x, z: b.pl.z };
        b.pl.x += (b.net.x - b.pl.x) * k; b.pl.y += (b.net.y - b.pl.y) * k; b.pl.z += (b.net.z - b.pl.z) * k;
        const sp = Math.hypot(b.pl.x - prev.x, b.pl.z - prev.z) / Math.max(dt, 1e-3);
        b.avatar.place(b.pl.x, b.pl.y, b.pl.z, b.net.yaw, dt);
        b.avatar.animate(dt, { speed: sp, grounded: true, vy: 0, climb: false, emote: 0 });
      }
    }
    if (authority && net.live && this.botSend <= 0 && pack.length) { this.botSend = 0.1; net.send({ t: 'sv', k: 'bots', q: pack }); }

    this.drawTiles(dt);

    // 글자
    const s = game.save.survival;
    let line;
    if (this.state === 'lobby') line = `<b>⏳ 다음 판까지 ${Math.max(0, Math.ceil(this.timer))}초</b>`;
    else if (this.state === 'play') line = `<b>🔥 남은 사람 ${this.countAlive()}명 · ${fmt(this.playTime)}</b>`;
    else line = '<b>🏁 판 끝!</b>';
    game.ui.setInfo(`${line}<small>최고 ${fmt(s.best)} · 우승 ${s.wins}번</small>`);
  }

  dispose() {
    this.spec?.dispose();
    for (const b of this.bots) b.avatar.dispose();
    for (const m of this.meshes) { m.removeFromParent(); m.dispose(); }
    this.game.ui.setInfo('');
  }
}

const r2 = v => Math.round(v * 100) / 100;
export { P };
