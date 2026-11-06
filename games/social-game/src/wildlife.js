// 숲의 반달가슴곰 (인혁: "숲에 곰이 가끔씩 있게 해줘"). The forest is where the trees stand thick on the
// hills around town (40 m cells with 3+ trees, outside the town and the airport). Every game day is
// rolled from the day number, so a reload gives the same answer: about half the days one or two bears
// roam one patch of that forest for a few hours. They wander, sniff the ground, sit, and stand up to
// look around. Within ~15 m a bear notices you, stands up and huffs, then ambles away. Run at it or
// crowd it and it bluff-charges, stopping short with a slam and a roar; touch it and it shoves you.
// Bears are local to this computer (not shared in the online town).
import * as THREE from 'three';
import { rng } from './noise.js';
import { LAYOUT } from './world.js';
import { bodyFree } from './collide.js';
import { buildBear } from './props/bear.js';

const CELL = 40;
const TREES = new Set(['나무', '소나무', '벚나무']);
const NOTICE = 15;          // metres: the bear sees / smells you
const TOO_CLOSE = 5;        // metres: it feels cornered and charges
const WALK = 0.8, HURRY = 1.6, CHARGE = 7.5;
const PI = Math.PI;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** Land that belongs to the forest, not the town: hills outside the town rectangle, not the airport or beach. */
export function wildLand(x, z) {
  const L = LAYOUT;
  if (x > 1500 || x < L.beachX + 14) return false;
  if (x > 180 && x < 352 && z > -152 && z < -28) return false; // airport, runway and apron
  return z < L.townMin[1] - 8 || z > L.townMax[1] + 8 || x > L.townMax[0] + 8;
}

/** Forest cells from tree positions: [{i, j, n, x, z}] (n = trees in the cell). */
export function forestCells(breakables) {
  const count = new Map();
  for (const e of breakables ?? []) {
    if (!TREES.has(e.name)) continue;
    const x = (e.min[0] + e.max[0]) / 2, z = (e.min[2] + e.max[2]) / 2;
    if (!wildLand(x, z)) continue;
    const k = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  const cells = [];
  for (const [k, n] of count) {
    if (n < 3) continue;
    const [i, j] = k.split(',').map(Number);
    cells.push({ i, j, n, x: (i + 0.5) * CELL, z: (j + 0.5) * CELL });
  }
  return cells.sort((a, b) => a.i - b.i || a.j - b.j);
}

/** Which bears come out on a day (deterministic): [{id, home, from, to, seed}] */
export function dayPlan(day, cells) {
  const R = rng(9001 + day * 7919);
  if (!cells.length || R() > 0.5) return [];
  const total = cells.reduce((s, c) => s + c.n, 0);
  let t = R() * total, home = cells[cells.length - 1];
  for (const c of cells) if ((t -= c.n) <= 0) { home = c; break; }
  const n = R() < 0.3 ? 2 : 1;
  const out = [];
  for (let i = 0; i < n; i++) {
    const from = 6.5 + R() * 7, len = 4 + R() * 5;
    out.push({ id: `${day}-${i}`, home, from, to: Math.min(20.5, from + len), seed: Math.floor(R() * 1e6) });
  }
  return out;
}

export class Wildlife {
  /**
   * engine, colliders, groundAt, player, vehicle, hud, sfx, state, places, flight, trees (deco.breakables).
   * onHurt(n) is set by the game to take health and flash the screen.
   */
  constructor({ engine, colliders, groundAt, player, vehicle, hud, sfx, state, places, flight, trees }) {
    Object.assign(this, { engine, col: colliders, groundAt, player, vehicle, hud, sfx, state, places, flight });
    this.cells = forestCells(trees);
    this.bears = [];
    this.onHurt = null;
    this.shake = 0;
    this.lastToast = -1e9;
    this.seenOnce = false;
    this.planDay = null;
    this.plan = [];
    this.done = new Set(); // bears of today that already went home
    // two models built now (shared geometry) so spawning later never hitches; parked far below
    // the world but visible once, so the game's shader warm-up compiles them
    this.pool = [];
    for (let i = 0; i < 2; i++) {
      const m = buildBear({ seed: i + 1 });
      m.group.position.set(0, -500, 0);
      engine.scene.add(m.group);
      this.pool.push(m);
    }
    this._lateHooked = false;
    this.t = 0;
  }

  /** Bears for the minimap (only the ones close enough to have been seen). */
  dots() {
    const p = this.player.pos, out = [];
    for (const b of this.bears) if (Math.hypot(b.x - p.x, b.z - p.z) < 70) out.push({ x: b.x, z: b.z, color: '#2a1c14' });
    return out;
  }

  /** Test helper: put a bear `dist` metres in front of the player now (ignores the day plan). */
  spawnNear(dist = 20, opts = {}) {
    const p = this.player.pos, f = this.player.forward;
    const len = Math.hypot(f.x, f.z) || 1;
    const x = p.x + (f.x / len) * dist, z = p.z + (f.z / len) * dist;
    const b = this.spawn({ id: `test-${this.t.toFixed(2)}`, home: { x, z, i: Math.floor(x / CELL), j: Math.floor(z / CELL), n: 9 }, from: 0, to: 99, seed: 5 }, x, z, opts);
    if (b) b.yaw = Math.atan2(-(p.x - x), -(p.z - z)) + (opts.facing ?? PI);
    return b;
  }

  spawn(plan, x, z, { stay = false } = {}) {
    const model = this.pool.find((m) => !this.bears.some((b) => b.model === m));
    if (!model) return null;
    const R = rng(plan.seed + 3);
    const b = {
      plan, model, R, x, z, y: this.groundAt(x, z), yaw: R() * PI * 2, speed: 0, yawRate: 0,
      state: 'pause', mode: 'sniff', t: 0, dur: 2 + R() * 3, target: null, avoid: 0, avoidYaw: 0,
      cool: 0, chargeCool: 0, swatCool: 0, huff: false, slam: false, huffAt: [], scale: 0.92 + R() * 0.16,
      box: { min: [0, 0, 0], max: [0, 0, 0], tag: 'bear' }, stay, noticed: false,
    };
    model.group.scale.setScalar(b.scale);
    model.group.visible = true;
    this.col.add(b.box);
    this.bears.push(b);
    return b;
  }

  despawn(b) {
    this.col.remove(b.box);
    b.model.group.visible = false;
    b.model.group.position.y = -500;
    this.bears.splice(this.bears.indexOf(b), 1);
    this.done.add(b.plan.id);
  }

  /** A free spot in a forest cell (or near home), at least `away` metres from the player. */
  spot(home, R, away = 0, spread = 1) {
    const p = this.player.pos;
    const near = this.cells.filter((c) => Math.abs(c.i - home.i) <= spread && Math.abs(c.j - home.j) <= spread);
    const list = near.length ? near : [home];
    for (let k = 0; k < 30; k++) {
      const c = list[Math.floor(R() * list.length)];
      const x = (c.i + R()) * CELL, z = (c.j + R()) * CELL;
      if (!wildLand(x, z) || Math.hypot(x - p.x, z - p.z) < away) continue;
      if (!bodyFree(this.col, x, this.groundAt(x, z), z, 0.6, 1)) continue;
      return { x, z };
    }
    return null;
  }

  toast(text, ms = 3200, force = false) {
    if (!force && this.t - this.lastToast < 45) return;
    this.lastToast = this.t;
    this.hud.toast(text, ms);
  }

  sound(name, b, gain = 1) {
    const d = Math.hypot(b.x - this.player.pos.x, b.z - this.player.pos.z);
    const g = gain * Math.max(0, 1.15 - d / 45);
    if (g > 0.03) this.sfx(name, { gain: g });
  }

  /** Who and where the bear reacts to: the player, or the car while driving. */
  target() {
    const v = this.vehicle;
    if (v?.driving) return { pos: v.pos, vel: new THREE.Vector3(-Math.sin(v.yaw) * v.speed, 0, -Math.cos(v.yaw) * v.speed), speed: Math.abs(v.speed), car: true };
    return { pos: this.player.pos, vel: this.player.vel, speed: this.player.speed, car: false };
  }

  update(dt) {
    this.t += dt;
    const s = this.state;
    if (!this._lateHooked) {
      // camera shake after the game placed the camera (late updaters run in order)
      this._lateHooked = true;
      this.engine.onUpdate((d) => {
        if (this.shake <= 0) return;
        this.shake = Math.max(0, this.shake - d);
        const k = this.shake * 0.06;
        this.engine.camera.position.x += (Math.random() - 0.5) * k;
        this.engine.camera.position.y += (Math.random() - 0.5) * k;
      }, true);
    }
    // warm-up: for the first second the spare models sit a few metres under the player (inside the
    // shadow box, hidden by the ground) so their shadow shaders compile behind the start screen
    for (const m of this.pool) {
      if (this.bears.some((b) => b.model === m)) continue;
      if (this.t < 1) { m.group.visible = true; m.group.position.set(this.player.pos.x, this.player.pos.y - 6, this.player.pos.z); m.update(dt, {}); }
      else if (m.group.visible) { m.group.visible = false; m.group.position.y = -500; }
    }
    // today's plan
    if (this.planDay !== s.day) { this.planDay = s.day; this.plan = dayPlan(s.day, this.cells); this.done.clear(); }
    const away = this.player.pos.x > 1500 || this.flight?.active;
    for (const pl of this.plan) {
      if (away || this.done.has(pl.id) || this.bears.some((b) => b.plan.id === pl.id)) continue;
      if (s.hour < pl.from || s.hour > pl.to) continue;
      const at = this.spot(pl.home, rng(pl.seed), 45, 1);
      if (at) this.spawn(pl, at.x, at.z);
    }
    const tg = this.target();
    const cam = this.engine.camera.position;
    for (const b of [...this.bears]) {
      // time to go home: when its hours are over and nobody is watching
      const d = Math.hypot(tg.pos.x - b.x, tg.pos.z - b.z);
      if (!b.stay && (s.hour > b.plan.to || s.hour < b.plan.from - 0.01) && d > 60) { this.despawn(b); continue; }
      if (away && !b.stay) { this.despawn(b); continue; }
      this.think(b, dt, tg, d);
      this.move(b, dt);
      // model
      const g = b.model.group;
      g.position.set(b.x, b.y, b.z);
      g.rotation.y = b.yaw;
      const dc = Math.hypot(b.x - cam.x, b.z - cam.z), far = dc > 170;
      g.visible = !far;
      // level of detail: fur cards and the small glossy bits only up close
      b.model.meshes.hair.visible = dc < 45;
      b.model.meshes.gloss.visible = dc < 30;
      if (!far) {
        const look = b.lookAt ? new THREE.Vector3(tg.pos.x, tg.pos.y + 1.5, tg.pos.z) : null;
        b.model.update(dt, { mode: b.mode, speed: b.speed + Math.abs(b.yawRate) * 0.35, look, ground: this.groundAt, alert: b.alert, huff: b.huff, slam: b.slam });
      }
      b.huff = false; b.slam = false;
      // collider (the player bumps into the bear)
      const r = 0.5 * b.scale;
      this.col.remove(b.box);
      b.box.min[0] = b.x - r; b.box.max[0] = b.x + r; b.box.min[2] = b.z - r; b.box.max[2] = b.z + r;
      b.box.min[1] = b.y; b.box.max[1] = b.y + (b.mode === 'stand' ? 1.6 : 0.95) * b.scale;
      this.col.add(b.box);
    }
  }

  /** Decide what the bear does this frame. */
  think(b, dt, tg, d) {
    b.t += dt;
    b.cool = Math.max(0, b.cool - dt);
    b.chargeCool = Math.max(0, b.chargeCool - dt);
    b.swatCool = Math.max(0, b.swatCool - dt);
    const R = b.R;
    const toYaw = Math.atan2(-(tg.pos.x - b.x), -(tg.pos.z - b.z));
    const inside = !!this.places?.inside?.(tg.pos);
    const sees = !inside && !this.flight?.active && Math.abs(tg.pos.y - b.y) < 6;
    // closing speed toward the bear
    const dir = new THREE.Vector3(b.x - tg.pos.x, 0, b.z - tg.pos.z).normalize();
    const closing = tg.vel.x * dir.x + tg.vel.z * dir.z;
    const calm = b.state === 'wander' || b.state === 'pause';
    // react to the player
    if (sees && b.chargeCool <= 0 && (calm || b.state === 'alert' || b.state === 'leave')
      && (d < TOO_CLOSE || (d < 13 && closing > 3.5 && tg.speed > 5))) {
      this.go(b, 'charge');
      this.sound('bearRoar', b, 1);
      this.toast('😱 곰이 겁주려고 달려왔어요! 뛰지 말고 천천히 뒤로 물러나요', 3600, true);
    } else if (sees && calm && b.cool <= 0 && d < NOTICE) {
      this.go(b, 'alert');
      b.noticed = true;
      if (!this.seenOnce) { this.seenOnce = true; this.toast('🐻 반달가슴곰이다! 천천히 뒤로 물러나요', 4200, true); }
      else this.toast('🐻 곰이 나를 봤어요! 조용히 뒤로 물러나요', 3000);
    }
    // shove when touched
    if (sees && d < 1.5 + 0.3 * b.scale && b.swatCool <= 0 && !tg.car) {
      b.swatCool = 4;
      const p = this.player;
      const ax = (tg.pos.x - b.x) / (d || 1), az = (tg.pos.z - b.z) / (d || 1);
      p.vel.x += ax * 11; p.vel.z += az * 11; p.vel.y = Math.max(p.vel.y, 4.5); p.onGround = false;
      b.huff = true; b.slam = true;
      this.sound('bearRoar', b, 0.9);
      this.shake = 0.5;
      this.onHurt?.(5);
      this.toast('🐾 곰이 앞발로 밀었어요! 곰한테 가까이 가면 안 돼요 (체력 -5)', 3200, true);
      if (b.state !== 'charge') this.go(b, 'leave', tg);
    }
    b.lookAt = false; b.alert = false;
    switch (b.state) {
      case 'pause': {
        b.speed = 0;
        if (b.mode === 'stand' || (d < 30 && R() < dt * 0.15)) b.lookAt = d < 40;
        if (b.mode === 'sniff' && R() < dt * 0.25) this.sound('bearGrunt', b, 0.5);
        if (b.t > b.dur) this.go(b, 'wander');
        break;
      }
      case 'wander': {
        if (!b.target || b.t > 45) b.target = this.spot(b.plan.home, R, 0, 1) ?? { x: b.plan.home.x, z: b.plan.home.z };
        b.mode = 'walk';
        const dx = b.target.x - b.x, dz = b.target.z - b.z;
        this.steer(b, dt, Math.atan2(-dx, -dz), WALK);
        if (Math.hypot(dx, dz) < 1.5 || b.t > 45) {
          const k = R();
          const mode = k < 0.45 ? 'sniff' : k < 0.65 ? 'idle' : k < 0.82 ? 'stand' : 'sit';
          this.go(b, 'pause', null, mode);
        }
        break;
      }
      case 'alert': {
        // turn to face, rise up, huff twice, then leave
        b.alert = true; b.lookAt = true;
        this.steer(b, dt, toYaw, 0, 2.6);
        b.mode = b.t > 0.35 ? 'stand' : 'idle';
        for (const at of [1.1, 2.1]) if (b.t - dt < at && b.t >= at) { b.huff = true; this.sound('bearHuff', b, 1); }
        if (b.t > 3.3) this.go(b, 'leave', tg);
        break;
      }
      case 'leave': {
        b.mode = 'walk';
        if (!b.target) b.target = this.retreat(b, tg);
        const dx = b.target.x - b.x, dz = b.target.z - b.z;
        this.steer(b, dt, Math.atan2(-dx, -dz), HURRY, 2.2);
        if (Math.hypot(dx, dz) < 2 || b.t > 22) { b.cool = 30; this.go(b, 'wander'); }
        break;
      }
      case 'charge': {
        b.mode = 'run'; b.alert = true; b.lookAt = true;
        this.steer(b, dt, toYaw, CHARGE, 5, 9);
        // brake in time to stop about 2.6 m short (slam decelerates at 30 m/s²)
        if (d < 2.6 + (b.speed * b.speed) / 60 || b.t > 2.4) { this.go(b, 'slam'); b.slam = true; b.huff = true; this.shake = 0.6; this.sound('bearRoar', b, 1.1); }
        break;
      }
      case 'slam': {
        b.mode = 'idle'; b.alert = true; b.lookAt = true;
        b.speed = Math.max(0, b.speed - dt * 30);
        if (b.t - dt < 0.75 && b.t >= 0.75) { b.huff = true; this.sound('bearHuff', b, 1); }
        if (b.t > 1.7) { b.chargeCool = 14; b.cool = 30; this.go(b, 'leave', tg); }
        break;
      }
      default: break;
    }
  }

  go(b, state, tg = null, mode = null) {
    b.state = state; b.t = 0; b.target = null;
    if (state === 'pause') { b.mode = mode ?? 'idle'; b.dur = { sniff: 4 + b.R() * 5, idle: 3 + b.R() * 3, stand: 2.6 + b.R() * 2, sit: 6 + b.R() * 6 }[b.mode]; }
    if (state === 'leave' && tg) b.target = this.retreat(b, tg);
  }

  /** A point ~35 m away from whoever bothered the bear, back in the forest when possible. */
  retreat(b, tg) {
    const ax = b.x - tg.pos.x, az = b.z - tg.pos.z, l = Math.hypot(ax, az) || 1;
    for (const turn of [0, 0.5, -0.5, 1, -1]) {
      const c = Math.cos(turn), s = Math.sin(turn);
      const dx = (ax * c - az * s) / l, dz = (ax * s + az * c) / l;
      const x = b.x + dx * 35, z = b.z + dz * 35;
      if (wildLand(x, z)) return { x, z };
    }
    return { x: b.plan.home.x, z: b.plan.home.z };
  }

  /** Turn toward `want` (with simple obstacle avoidance) and move at up to `speed`. */
  steer(b, dt, want, speed, turnRate = 1.5, accel = 2) {
    if (speed > 0) {
      // probe ahead; if a tree, wall or rock is in the way, swing to the freer side for a moment
      b.avoid = Math.max(0, b.avoid - dt);
      if (b.avoid <= 0) {
        const free = (a, dist) => { const x = b.x - Math.sin(a) * dist, z = b.z - Math.cos(a) * dist; return bodyFree(this.col, x, this.groundAt(x, z) + 0.05, z, 0.45, 0.9); };
        this.col.remove(b.box);
        if (!free(want, 1.4) || !free(want, 2.6)) {
          for (const off of [0.6, -0.6, 1.2, -1.2, 1.9, -1.9]) {
            const a = want + off * (wrap(want - b.yaw) >= 0 ? 1 : -1);
            if (free(a, 1.4) && free(a, 2.6)) { b.avoidYaw = a; b.avoid = 0.9; break; }
          }
        }
        this.col.add(b.box);
      }
      if (b.avoid > 0) want = b.avoidYaw;
    }
    const diff = wrap(want - b.yaw);
    const turn = Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
    b.yaw += turn;
    b.yawRate = turn / Math.max(dt, 1e-4);
    // slow down while turning sharply; turn on the spot when facing away
    const k = Math.max(0, 1 - Math.abs(diff) / 1.3);
    const want2 = speed * k;
    b.speed += Math.max(-accel * 2 * dt, Math.min(accel * dt, want2 - b.speed));
  }

  move(b, dt) {
    if (b.state === 'pause' || b.state === 'alert') b.speed = Math.max(0, b.speed - dt * 3);
    if (b.speed > 0.001) {
      const nx = b.x - Math.sin(b.yaw) * b.speed * dt, nz = b.z - Math.cos(b.yaw) * b.speed * dt;
      this.col.remove(b.box);
      const ok = bodyFree(this.col, nx, this.groundAt(nx, nz) + 0.05, nz, 0.4, 0.9);
      this.col.add(b.box);
      if (ok || b.state === 'charge') { b.x = nx; b.z = nz; } else { b.speed = 0; b.avoid = 0; }
    }
    b.y = this.groundAt(b.x, b.z);
  }
}
