// 곤충 채집 (인혁이 계획: "곤충을 채집할 수 있게 해줘."). Insects live only around you: every third of a
// second a free spot 7..30 m away is looked up in a small habitat grid (flowers, bushes, street and forest
// trees, grass, the sea shore and the fountain, bare ground) and an insect that lives there at this hour
// comes out (bugs.mjs). They sit on real surfaces (petals, leaves, bark: found by a ray against the tree or
// flower model), flutter, dart, hop, crawl or glow, flee when you run near them, and go away past 38 m.
// At most a couple of dozen are alive; models are pooled per species, are hidden beyond a few metres
// (ants) to ~26 m, and cast no shadows. B takes out the 잠자리채; left click swings it and catches what is
// in the sweep. K (or the 📗 button) opens the 곤충 도감. The 도감 is state.bugs, saved with the game.
import * as THREE from 'three';
import { SPECIES, BY_ID, speciesFor, pickWeighted, fleeRadius, inNet, caughtText, normBook, addCatch, release, bookStats, activeAt, eul, MAX_ALIVE } from '../bugs.mjs';
import { buildInsect, buildNet } from './props/insects.js';
import { audioOut } from './audio.js';
import { wildLand } from './wildlife.js';
import { LAYOUT, isRoad } from './world.js';
import { FC } from './sites/plaza.js';

const CELL = 8;
const SPAWN_MIN = 7, SPAWN_MAX = 30, KEEP = 38;
const VIEW = { ant: 7, ladybug: 12, firefly: 9 };
const TREE = { 나무: 1, 벚나무: 1, 소나무: 1 };
const $ = (id) => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const CSS = `
#bugbook .mcard.book { width: min(860px, calc(100vw - 32px)); max-height: calc(100vh - 40px); overflow: auto; background: linear-gradient(180deg, #f6fbef, #fffaf0); }
#bugbook h2 { color: #3d8a3a; } #bugbook h2 small { font-size: 15px; color: #7a8a68; }
#bugbook .bgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
#bugbook .bcard { position: relative; background: #fff; border-radius: 14px; padding: 8px 8px 10px; box-shadow: 0 3px 0 #d6e2c8, 0 6px 14px #0001; display: flex; flex-direction: column; gap: 3px; }
#bugbook .bcard .pic { background: radial-gradient(circle at 50% 40%, #fdfdf6, #e8efdc); border-radius: 10px; }
#bugbook .bcard img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: contain; }
#bugbook .bcard b { font-size: 18px; font-weight: normal; color: #2b2620; }
#bugbook .bcard .n { position: absolute; top: 10px; right: 12px; background: #3d8a3a; color: #fff; border-radius: 999px; padding: 1px 9px; font-size: 14px; }
#bugbook .bcard p { margin: 0; font-size: 12.5px; color: #6a6258; line-height: 1.35; }
#bugbook .bcard.unknown img { filter: brightness(0) opacity(.42); }
#bugbook .bcard.unknown b { color: #9a9488; }
#bugbook .bcard .q { position: absolute; top: 34px; left: 0; right: 0; text-align: center; font-size: 44px; color: #5a6a4a; text-shadow: 0 2px 0 #fff; pointer-events: none; }
#bugbook .bcard button.rel { font-size: 13px; padding: 4px 8px; border-radius: 10px; margin-top: 2px; background: #eaf5e0; color: #2f6a2a; box-shadow: 0 2px 0 #c4dcb0; }
#bugbook .tag { display: inline-block; font-size: 11.5px; padding: 1px 7px; border-radius: 999px; background: #fff3c8; color: #8a6a10; margin-left: 4px; vertical-align: 2px; }
`;

export class Insects {
  /** engine, player, input, groundAt, colliders, places, state, hud, sfx, build, flight, breakables, scatters, save */
  constructor(o) {
    Object.assign(this, o);
    this.col = o.colliders;
    this.book = normBook(o.state.bugs);
    o.state.bugs = this.book;
    this.max = o.engine.quality === 'low' ? MAX_ALIVE.low : MAX_ALIVE.high;
    this.alive = [];
    this.pool = new Map();
    this.t = 0;
    this.spawnT = 0;
    this.holding = false;
    this.swingT = -1;
    this.caughtShow = [];
    this.root = new THREE.Group(); this.root.name = 'insects';
    o.engine.scene.add(this.root);
    this.ray = new THREE.Raycaster();
    this.tmpMesh = new THREE.Mesh();
    this.indexHabitats(o.breakables ?? [], o.scatters ?? []);
    // one of each species parked out of sight but drawn once, so the loading warm-up compiles them
    this.warm = new THREE.Group(); this.warm.position.set(0, -480, 0);
    for (const sp of SPECIES) { const m = buildInsect(sp.id); m.group.scale.setScalar(sp.size); this.warm.add(m.group); (this.pool.get(sp.id) ?? this.pool.set(sp.id, []).get(sp.id)).push(m); }
    o.engine.scene.add(this.warm);
    this.glow = this.makeGlow();
    // the net for the first-person hand
    this.net = buildNet();
    this.netItem = new THREE.Group(); this.netItem.add(this.net.group);
    this.ui();
  }

  // ------------------------------------------------------------------ habitats
  cellOf(x, z, make = false) {
    const k = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    let c = this.grid.get(k);
    if (!c && make) { c = { flower: [], bush: [], tree: [], forest: [], grass: 0, water: null }; this.grid.set(k, c); }
    return c;
  }

  indexHabitats(breakables, scatters) {
    this.grid = new Map();
    for (const e of breakables) {
      const x = (e.min[0] + e.max[0]) / 2, z = (e.min[2] + e.max[2]) / 2;
      const kind = e.name === '꽃' ? 'flower' : e.name === '덤불' ? 'bush' : TREE[e.name] ? (wildLand(x, z) ? 'forest' : 'tree') : null;
      if (kind) this.cellOf(x, z, true)[kind].push(e);
    }
    const grass = scatters.find((s) => s.range === 22 && s.maxRange === 22 && s.count > 1000);
    if (grass) for (const it of grass.items) this.cellOf(it.x, it.z, true).grass++;
    // water: the sea shore and the fountain basin
    for (let z = -84; z <= 84; z += CELL) for (const x of [LAYOUT.beachX - 30, LAYOUT.beachX - 22]) this.cellOf(x, z, true).water = { sea: true };
    const pl = this.places?.sites?.plaza;
    if (pl) {
      const c = Math.cos(pl.worldYaw), s = Math.sin(pl.worldYaw);
      const cx = pl.worldPos[0] + FC[0] * c + FC[2] * s, cz = pl.worldPos[2] - FC[0] * s + FC[2] * c;
      this.fountain = { x: cx, z: cz, y: pl.worldPos[1] };
      for (let dx = -8; dx <= 8; dx += 4) for (let dz = -8; dz <= 8; dz += 4) this.cellOf(cx + dx, cz + dz, true).water = { fountain: this.fountain };
    }
  }

  /** Nearest hit of a ray on a scatter copy's model (petals, leaves, bark), in world space: {p, n}. */
  hitProp(e, origin, dir, far = 3) {
    const sc = e.scatter, it = sc?.items?.[e.index];
    if (!it) return null;
    this.ray.set(origin, dir); this.ray.far = far;
    let best = null, bestM = null;
    for (const part of sc.near) {
      this.tmpMesh.geometry = part.geometry; this.tmpMesh.material = part.material;
      this.tmpMesh.matrixWorld.multiplyMatrices(it.matrix, part.local);
      const hits = [];
      this.tmpMesh.raycast(this.ray, hits);
      for (const h of hits) if (!best || h.distance < best.distance) { best = h; bestM = this.tmpMesh.matrixWorld.clone(); }
    }
    if (!best) return null;
    const n = best.face ? best.face.normal.clone().transformDirection(bestM) : new THREE.Vector3(0, 1, 0);
    if (n.dot(dir) > 0) n.negate();
    return { p: best.point.clone(), n };
  }

  /** A place to put one insect of a habitat in a cell: {x, y, z, n (surface normal), kind}. */
  placeFor(habitat, cell, x, z) {
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    const g = this.groundAt;
    if (habitat === 'flower' || habitat === 'bush') {
      const e = pick(cell[habitat]); if (!e || e.broken) return null;
      const cx = (e.min[0] + e.max[0]) / 2, cz = (e.min[2] + e.max[2]) / 2, r = (e.max[0] - e.min[0]) / 2;
      const o = new THREE.Vector3(cx + rnd(-0.6, 0.6) * r, e.max[1] + 0.4, cz + rnd(-0.6, 0.6) * r);
      const h = this.hitProp(e, o, new THREE.Vector3(rnd(-0.15, 0.15), -1, rnd(-0.15, 0.15)).normalize(), 2);
      if (!h || h.n.y < 0.35) return { x: cx, y: e.max[1] * 0.92 + e.min[1] * 0.08, z: cz, n: new THREE.Vector3(0, 1, 0), e };
      return { x: h.p.x, y: h.p.y, z: h.p.z, n: h.n, e };
    }
    if (habitat === 'tree' || habitat === 'forest') {
      const e = pick(cell[habitat]); if (!e || e.broken) return null;
      const cx = (e.min[0] + e.max[0]) / 2, cz = (e.min[2] + e.max[2]) / 2, y0 = e.min[1];
      const a = Math.random() * Math.PI * 2, hgt = y0 + rnd(0.9, 2.0);
      const o = new THREE.Vector3(cx + Math.cos(a) * 1.6, hgt, cz + Math.sin(a) * 1.6);
      const h = this.hitProp(e, o, new THREE.Vector3(-Math.cos(a), 0, -Math.sin(a)), 2);
      if (!h || Math.abs(h.n.y) > 0.6) return null;
      return { x: h.p.x, y: h.p.y, z: h.p.z, n: h.n, e, trunk: true };
    }
    if (habitat === 'water') {
      const w = cell.water;
      if (w.fountain) { const a = Math.random() * Math.PI * 2, r = rnd(1.5, 5.5); const fx = w.fountain.x + Math.cos(a) * r, fz = w.fountain.z + Math.sin(a) * r; return { x: fx, y: w.fountain.y + rnd(1.2, 2.2), z: fz, air: true }; }
      const sx = LAYOUT.beachX - rnd(18, 32), sz = z + rnd(-4, 4);
      return { x: sx, y: Math.max(g(sx, sz), LAYOUT.seaY) + rnd(0.6, 1.8), z: sz, air: true };
    }
    // grass, ground: open ground that is not road, water or inside something
    if (isRoad(x, z)) return null;
    const y = g(x, z);
    if (y < LAYOUT.seaY + 0.3) return null;
    for (const b of this.col.query(x - 0.3, z - 0.3, x + 0.3, z + 0.3)) if (b.min[1] < y + 0.5 && b.max[1] > y) return null;
    if (this.places?.inside?.(new THREE.Vector3(x, y + 0.5, z))) return null;
    return { x, y, z, n: new THREE.Vector3(0, 1, 0) };
  }

  /** Try to bring one insect out somewhere around (cx, cz). */
  trySpawn(cx, cz, hour, minR = SPAWN_MIN, maxR = SPAWN_MAX) {
    const a = Math.random() * Math.PI * 2, r = rnd(minR, maxR);
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    const cell = this.cellOf(x, z);
    const opts = [];
    const add = (hab, ok) => { if (!ok) return; for (const s of speciesFor(hab, hour)) opts.push({ ...s, hab }); };
    add('flower', cell?.flower.length); add('bush', cell?.bush.length); add('tree', cell?.tree.length); add('forest', cell?.forest.length);
    add('grass', cell?.grass > 3); add('water', cell?.water); add('ground', true);
    for (const o of opts) {
      const sp = BY_ID[o.id], n = this.alive.filter((b) => b.sp === sp).length;
      if (n >= sp.cap) o.w = 0;
      else if (o.hab === 'ground') o.w *= 0.35;
    }
    const pick = pickWeighted(opts.filter((o) => o.w > 0), Math.random());
    if (!pick) return null;
    const at = this.placeFor(pick.hab, cell ?? { flower: [], bush: [], tree: [], forest: [] }, x, z);
    if (!at) return null;
    const sp = BY_ID[pick.id];
    if (sp.id === 'ant') { const first = this.spawn(sp, at); for (let i = 0; i < 2 && first; i++) this.spawn(sp, { ...at, x: at.x + rnd(-0.25, 0.25), z: at.z + rnd(-0.25, 0.25) }); return first; }
    return this.spawn(sp, at);
  }

  takeModel(sp) {
    const list = this.pool.get(sp.id) ?? [];
    const m = list.pop() ?? buildInsect(sp.id);
    m.group.scale.setScalar(sp.size);
    m.group.visible = true;
    this.root.add(m.group);
    return m;
  }

  spawn(sp, at, { stay = false } = {}) {
    if (this.alive.length >= this.max + 4) return null;
    const m = this.takeModel(sp);
    const b = {
      sp, m, x: at.x, y: at.y, z: at.z, n: at.n?.clone() ?? new THREE.Vector3(0, 1, 0), home: { x: at.x, y: at.y, z: at.z }, perch: at.air ? null : { x: at.x, y: at.y, z: at.z, n: at.n?.clone() ?? new THREE.Vector3(0, 1, 0) },
      yaw: Math.random() * Math.PI * 2, pitch: 0, bank: 0, st: at.air ? 'fly' : 'sit', t: 0, dur: rnd(2, 6), vx: 0, vy: 0, vz: 0, tx: at.x, ty: at.y, tz: at.z,
      phase: Math.random() * 10, stay, trunk: !!at.trunk, hops: 0, k: 0, blink: Math.random() * 3, gone: false,
    };
    if ((sp.move === 'flutter' || sp.move === 'dart' || sp.move === 'glow') && !at.air) {
      // butterflies sit on flowers; on grass (and dragonflies, fireflies everywhere) they start in the air
      if (sp.move === 'flutter' && at.e) b.st = 'sit';
      else { b.st = 'fly'; b.y += rnd(0.5, 1.4); b.perch = null; b.home.y = b.y; }
    }
    this.alive.push(b);
    this.place(b);
    return b;
  }

  despawn(b) {
    const i = this.alive.indexOf(b); if (i >= 0) this.alive.splice(i, 1);
    b.gone = true;
    this.root.remove(b.m.group);
    b.m.group.visible = false;
    this.pool.get(b.sp.id)?.push(b.m);
  }

  // ------------------------------------------------------------------ placing a model
  place(b) {
    const g = b.m.group;
    g.position.set(b.x, b.y, b.z);
    if (b.perch && (b.st === 'sit' || b.st === 'crawl')) {
      // stand on the surface: up = its normal, head up the trunk (or along the yaw on flat ground)
      const up = b.n;
      const want = b.trunk ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(-Math.sin(b.yaw), 0, -Math.cos(b.yaw));
      const fwd = want.addScaledVector(up, -want.dot(up));
      if (fwd.lengthSq() < 1e-6) fwd.set(1, 0, 0).addScaledVector(up, -up.x);
      fwd.normalize();
      if (b.trunk && b.yaw) fwd.applyAxisAngle(up, Math.sin(b.yaw) * 0.5);
      const zAxis = fwd.clone().negate(), xAxis = new THREE.Vector3().crossVectors(up, zAxis).normalize();
      g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, up, zAxis));
    } else {
      g.rotation.set(b.pitch, b.yaw, b.bank, 'YXZ');
    }
  }

  // ------------------------------------------------------------------ frame
  update(dt) {
    this.t += dt;
    if (this.t > 1.5 && this.warm.visible) this.warm.visible = false;
    const p = this.player.pos, hour = this.state.hour;
    const indoors = !!this.places?.inside?.(p) || this.flight?.active;
    const driving = this.vehicle?.driving;
    this.root.visible = !indoors;
    this.updateSwing(dt);
    this.updateHold();
    if (indoors) { if (this.alive.length) for (const b of [...this.alive]) this.despawn(b); this.glowFrame(); this.song(null); return; }
    if ((this.spawnT -= dt) <= 0) {
      this.spawnT = 0.33;
      if (!driving && this.alive.length < this.max) for (let k = 0; k < 3; k++) this.trySpawn(p.x, p.z, hour);
    }
    const speed = this.player.speed ?? 0;
    const cam = this.engine.camera.position;
    let singer = null, sd = 1e9, near = 1e9;
    for (const b of [...this.alive]) {
      const d = Math.hypot(b.x - p.x, b.y - (p.y + 1), b.z - p.z);
      if (!b.stay && (d > KEEP || (!activeAt(b.sp, hour) && d > 12))) { this.despawn(b); continue; }
      if (!b.stay) this.behave(b, dt, d, speed, p);
      if (b.gone) continue;
      const dc = Math.hypot(b.x - cam.x, b.y - cam.y, b.z - cam.z);
      const vis = dc < (VIEW[b.sp.id] ?? 26);
      b.m.group.visible = vis;
      if (vis) { this.place(b); b.m.pose(b.st === 'fly' || b.st === 'flee' || b.st === 'dash' || b.st === 'land' ? 'fly' : 'rest', this.t + b.phase, b.k); }
      if (b.sp.sings && b.st === 'sit' && d < sd) { sd = d; singer = b; }
      if (d < near) near = d;
    }
    this.glowFrame();
    this.song(singer && sd < 32 ? sd : null);
    // first time an insect is close: how to catch it
    if (near < 6 && this.book.tip < 1 && !this.holding) { this.book.tip = 1; this.hud.toast('🦋 근처에 곤충이 있어요! C 키로 채집망을 들고 왼쪽 클릭으로 휘둘러 잡아요', 4200); }
  }

  behave(b, dt, d, speed, p) {
    const sp = b.sp, mv = sp.move;
    b.t += dt;
    const flee = fleeRadius(sp, speed);
    const away = () => { const a = Math.atan2(b.x - p.x, b.z - p.z) + rnd(-0.6, 0.6); return a; };
    if (flee > 0 && d < flee && b.st !== 'flee' && b.st !== 'hop') {
      if (mv === 'hop') this.hop(b, away(), rnd(1.4, 2.8));
      else this.startFlee(b, away());
    }
    switch (mv) {
      case 'flutter': this.flutter(b, dt); break;
      case 'dart': this.dart(b, dt); break;
      case 'glow': this.drift(b, dt); break;
      case 'hop': this.hopper(b, dt); break;
      case 'crawl': this.crawl(b, dt); break;
      default: this.sitter(b, dt); break;
    }
  }

  startFlee(b, a) {
    if (b.sp.id === 'cicada') this.squawk(b);
    b.st = 'flee'; b.t = 0; b.dur = rnd(2.2, 3.5); b.perch = null;
    const sp = b.sp.move === 'dart' ? 8 : b.sp.move === 'glow' ? 0.8 : b.sp.move === 'flutter' ? 3.2 : 3;
    b.vx = Math.sin(a) * sp; b.vz = Math.cos(a) * sp; b.vy = b.sp.move === 'glow' ? 0.5 : 1.4;
    b.yaw = Math.atan2(-b.vx, -b.vz);
  }

  fleeStep(b, dt) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    b.vy *= 0.98;
    b.yaw = Math.atan2(-b.vx, -b.vz); b.pitch = 0.2;
    if (b.t > b.dur) {
      if (b.sp.move === 'flutter' || b.sp.move === 'dart' || b.sp.move === 'glow') { b.st = 'fly'; b.home = { x: b.x, y: Math.max(b.y - 0.5, this.groundAt(b.x, b.z) + 0.6), z: b.z }; b.t = 0; }
      else this.despawn(b); // cicadas, ladybugs, jewel beetles fly off for good
    }
  }

  flutter(b, dt) {
    const g = this.groundAt(b.x, b.z);
    if (b.st === 'flee') { this.fleeStep(b, dt); b.y += Math.sin((this.t + b.phase) * 40) * 0.01; return; }
    if (b.st === 'sit') {
      b.k = 0.5 + 0.5 * Math.sin(b.t * 0.7 + b.phase) > 0.6 ? Math.min(1, b.k + dt) : Math.max(0, b.k - dt * 0.7); // basking open now and then
      if (b.t > b.dur) { b.st = 'fly'; b.t = 0; b.dur = rnd(6, 14); b.home = { x: b.x, y: b.y, z: b.z }; b.vy = 0.8; }
      return;
    }
    // flying: wander toward a target near home, bobbing with every wing beat
    if (b.t > b.dur && b.perch) { b.st = 'land'; }
    if (b.st === 'land' && b.perch) {
      const dx = b.perch.x - b.x, dy = b.perch.y - b.y, dz = b.perch.z - b.z, l = Math.hypot(dx, dy, dz);
      if (l < 0.04) { b.st = 'sit'; b.t = 0; b.dur = rnd(3, 9); b.x = b.perch.x; b.y = b.perch.y; b.z = b.perch.z; b.n.copy(b.perch.n); return; }
      const v = Math.min(1.2, l * 2.5);
      b.x += (dx / l) * v * dt; b.y += (dy / l) * v * dt; b.z += (dz / l) * v * dt;
      b.yaw = Math.atan2(-dx, -dz); b.pitch = 0;
      return;
    }
    if (Math.hypot(b.tx - b.x, b.tz - b.z) < 0.4 || b.t % 2.2 < dt) { b.tx = b.home.x + rnd(-4, 4); b.tz = b.home.z + rnd(-4, 4); b.ty = Math.max(this.groundAt(b.tx, b.tz), LAYOUT.seaY) + rnd(0.5, 2.0); }
    const want = Math.atan2(-(b.tx - b.x), -(b.tz - b.z));
    let dy = want - b.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    b.yaw += Math.max(-2.5 * dt, Math.min(2.5 * dt, dy)) + Math.sin(this.t * 3 + b.phase) * dt * 1.5;
    const v = 1.3;
    b.x += -Math.sin(b.yaw) * v * dt; b.z += -Math.cos(b.yaw) * v * dt;
    b.y += (b.ty - b.y) * dt * 0.8 + Math.sin((this.t + b.phase) * 6.5 * Math.PI * 2) * 0.012;
    b.y = Math.max(b.y, g + 0.25);
    b.pitch = -0.15; b.bank = dy * 0.3;
  }

  dart(b, dt) {
    if (b.st === 'flee') { this.fleeStep(b, dt); return; }
    if (b.st === 'dash') {
      const dx = b.tx - b.x, dy = b.ty - b.y, dz = b.tz - b.z, l = Math.hypot(dx, dy, dz);
      const v = Math.min(7, l * 6 + 0.5);
      if (l < 0.05) { b.st = 'fly'; b.t = 0; b.dur = rnd(1, 3.2); return; }
      b.x += (dx / l) * v * dt; b.y += (dy / l) * v * dt; b.z += (dz / l) * v * dt;
      b.yaw = Math.atan2(-dx, -dz); b.pitch = -0.1;
      return;
    }
    // hover with a tiny drift, then dash to a new spot near home
    b.x += Math.sin(this.t * 2.1 + b.phase) * 0.03 * dt; b.y += Math.sin(this.t * 3.3 + b.phase) * 0.04 * dt;
    b.pitch = 0; b.bank = 0;
    if (b.t > b.dur) {
      b.st = 'dash'; b.t = 0;
      b.tx = b.home.x + rnd(-5, 5); b.tz = b.home.z + rnd(-5, 5); b.ty = Math.max(this.groundAt(b.tx, b.tz), LAYOUT.seaY) + rnd(0.7, 2.0);
    }
  }

  drift(b, dt) {
    if (b.st === 'flee') { this.fleeStep(b, dt); return; }
    const g = this.groundAt(b.x, b.z);
    b.yaw += Math.sin(this.t * 0.7 + b.phase) * dt * 0.8;
    const v = 0.35;
    b.x += -Math.sin(b.yaw) * v * dt; b.z += -Math.cos(b.yaw) * v * dt;
    if (Math.hypot(b.x - b.home.x, b.z - b.home.z) > 4) b.yaw = Math.atan2(-(b.home.x - b.x), -(b.home.z - b.z));
    const ty = Math.max(g, LAYOUT.seaY) + 0.6 + 0.5 * Math.sin(this.t * 0.5 + b.phase * 3);
    b.y += (ty - b.y) * dt * 0.7;
    b.pitch = 0;
  }

  hop(b, a, dist) {
    b.st = 'hop'; b.t = 0; b.dur = 0.35 + dist * 0.09; b.hops++;
    b.sx = b.x; b.sy = b.y; b.sz = b.z;
    let tx = b.x + Math.sin(a) * dist, tz = b.z + Math.cos(a) * dist;
    if (isRoad(tx, tz)) { tx = b.x - Math.sin(a) * dist; tz = b.z - Math.cos(a) * dist; }
    b.tx = tx; b.tz = tz; b.ty = this.groundAt(tx, tz); b.peak = 0.25 + dist * 0.18;
    b.yaw = Math.atan2(-(tx - b.x), -(tz - b.z)); b.perch = { x: tx, y: b.ty, z: tz, n: new THREE.Vector3(0, 1, 0) };
  }

  hopper(b, dt) {
    if (b.st === 'hop') {
      const k = Math.min(1, b.t / b.dur);
      b.x = b.sx + (b.tx - b.sx) * k; b.z = b.sz + (b.tz - b.sz) * k;
      b.y = b.sy + (b.ty - b.sy) * k + Math.sin(k * Math.PI) * b.peak;
      b.pitch = (0.5 - k) * 0.9;
      if (k >= 1) { b.st = 'sit'; b.t = 0; b.dur = rnd(5, 14); b.n.set(0, 1, 0); b.pitch = 0; }
      return;
    }
    if (b.t > b.dur) this.hop(b, b.yaw + Math.PI + rnd(-1.5, 1.5), rnd(0.4, 1));
  }

  crawl(b, dt) {
    b.st = 'crawl';
    b.yaw += (Math.sin(this.t * 1.7 + b.phase * 5) * 2.2 + Math.sin(this.t * 4.1 + b.phase) * 1.2) * dt;
    if (Math.hypot(b.x - b.home.x, b.z - b.home.z) > 1.2) b.yaw = Math.atan2(-(b.home.x - b.x), -(b.home.z - b.z));
    const v = 0.07 * (0.6 + 0.4 * Math.sin(this.t * 3 + b.phase));
    b.x += -Math.sin(b.yaw) * v * dt; b.z += -Math.cos(b.yaw) * v * dt;
    b.y = this.groundAt(b.x, b.z) + 0.002;
  }

  sitter(b, dt) {
    if (b.st === 'flee') { this.fleeStep(b, dt); return; }
    // ladybugs turn round on their leaf, mantises rock from side to side, beetles shuffle
    if (b.sp.id === 'ladybug') b.yaw += Math.sin(this.t * 0.6 + b.phase) * dt * 0.9;
    else if (b.sp.id === 'mantis') { if (b.home.yaw == null) b.home.yaw = b.yaw; b.yaw = b.home.yaw + Math.sin(this.t * 2.2) * 0.12; }
    else if (b.trunk && b.sp.id !== 'cicada') b.yaw = Math.sin(this.t * 0.3 + b.phase) * 0.6;
  }

  // ------------------------------------------------------------------ fireflies' light
  makeGlow() {
    const n = 24, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    const m = new THREE.PointsMaterial({ size: 0.16, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    const pts = new THREE.Points(geo, m);
    pts.frustumCulled = false; pts.renderOrder = 3; pts.name = 'fireflyGlow';
    geo.setDrawRange(0, 0);
    this.engine.scene.add(pts);
    return pts;
  }

  glowFrame() {
    const g = this.glow, pos = g.geometry.attributes.position, col = g.geometry.attributes.color;
    let n = 0;
    if (this.root.visible) for (const b of this.alive) {
      if (b.sp.id !== 'firefly' || n >= pos.count) continue;
      const s = (this.t * 0.6 + b.blink) % 2.2, on = s < 0.9 ? Math.sin((s / 0.9) * Math.PI) : 0;
      const lp = new THREE.Vector3(0, 0.09, 0.32).multiplyScalar(b.sp.size).applyQuaternion(b.m.group.quaternion);
      pos.setXYZ(n, b.x + lp.x, b.y + lp.y, b.z + lp.z);
      const k = 0.15 + on * 3.2;
      col.setXYZ(n, 0.75 * k, 1.0 * k, 0.3 * k);
      n++;
    }
    g.geometry.setDrawRange(0, n);
    g.visible = n > 0;
    if (n) { pos.needsUpdate = true; col.needsUpdate = true; }
  }

  // ------------------------------------------------------------------ the net
  /** The net for the hand, turned so it points up and forward from the fist (needs the arm on the camera). */
  holdItem(arm, camera) {
    arm.update?.(0, {});
    camera.updateMatrixWorld(true);
    arm.grip.updateWorldMatrix(true, false);
    const rel = new THREE.Matrix4().copy(camera.matrixWorld).invert().multiply(arm.grip.matrixWorld);
    const qGrip = new THREE.Quaternion(); rel.decompose(new THREE.Vector3(), qGrip, new THREE.Vector3());
    const Y = new THREE.Vector3(0.02, 0.36, -0.93).normalize();
    const X = new THREE.Vector3(1, -0.1, 0.5); X.addScaledVector(Y, -X.dot(Y)).normalize();
    const Z = new THREE.Vector3().crossVectors(X, Y);
    const qWant = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
    this.netItem.quaternion.copy(qGrip.invert().multiply(qWant));
    this.netItem.position.set(0, 0, 0);
    this.arm = arm;
    return this.netItem;
  }

  toggleNet(on = !this.holding) {
    this.holding = on;
    if (on && this.book.tip < 2) { this.book.tip = 2; this.hud.toast('🥅 곤충 채집망! 살금살금 다가가서 왼쪽 클릭으로 휘둘러요. 뛰어가면 도망가요! (C 넣기 · K 도감)', 4800); }
    else this.hud.toast(on ? '🥅 채집망을 들었어요 (왼쪽 클릭 휘두르기)' : '채집망을 넣었어요', 1200);
    this.sfx?.('click');
    if (this.btn) this.btn.classList.toggle('on', on);
  }

  updateHold() {
    const inp = this.input;
    if (this.holding && (inp.mouse.wheel || [1, 2, 3, 4, 5, 6, 7, 8, 9].some((k) => inp.hit('Digit' + k)))) this.toggleNet(false); // picking a block puts the net away
  }

  /** Called by the game each frame while it is allowed to swing (on foot, not in a menu). */
  canSwing(ok) {
    if (!this.holding || !ok) return;
    if (this.input.mouse.leftPressed && this.swingT < 0) { this.swingT = 0; this.struck = false; this.whoosh(); }
  }

  updateSwing(dt) {
    const arm = this.player.arm;
    if (this.swingT >= 0) {
      this.swingT += dt / 0.5;
      const s = this.swingT;
      if (!this.struck && s >= 0.4) { this.struck = true; this.strike(); }
      if (s >= 1) this.swingT = -1;
    }
    const s = this.swingT < 0 ? 0 : this.swingT;
    // wind up to the right, sweep down through the middle to the left, come back
    const wind = ss(0, 0.22, s) * (1 - ss(0.22, 0.5, s)), hit = ss(0.22, 0.5, s) * (1 - ss(0.6, 1, s));
    if (arm && this.holding) {
      arm.group.rotation.set(0.12 * wind - 0.55 * hit, -0.5 * wind + 0.95 * hit, -0.3 * wind + 0.5 * hit);
      this.net.bag.rotation.y = (-0.6 * hit + 0.5 * wind) * (this.swingT >= 0 ? 1 : 0) + Math.sin(this.t * 2) * 0.03;
    } else if (arm && arm.group.rotation.y !== 0) arm.group.rotation.set(0, 0, 0);
    // insects just caught ride in the bag for a moment
    for (const c of [...this.caughtShow]) {
      c.t -= dt;
      if (c.t <= 0) { this.net.bag.remove(c.b.m.group); this.caughtShow.splice(this.caughtShow.indexOf(c), 1); c.b.m.group.position.set(0, 0, 0); c.b.m.group.rotation.set(0, 0, 0); this.pool.get(c.b.sp.id)?.push(c.b.m); }
    }
  }

  eyeAndAim() {
    const p = this.player.pos;
    const f = this.player.forward;
    return { eye: [p.x, p.y + (this.player.eye ?? 1.62), p.z], dir: [f.x, f.y, f.z] };
  }

  strike() {
    const { eye, dir } = this.eyeAndAim();
    const got = [];
    for (const b of [...this.alive]) {
      const d = inNet(eye, dir, [b.x, b.y + b.sp.size * 0.1, b.z]);
      if (d < 0) continue;
      const fast = b.st === 'dash' || b.st === 'flee' || b.st === 'hop' || (b.sp.move === 'flutter' && b.st === 'fly');
      const dodge = fast ? b.sp.dodge : b.sp.move === 'dart' ? 0.12 : 0;
      if (!b.stay && Math.random() < dodge) { if (b.sp.move === 'hop') this.hop(b, Math.atan2(b.x - eye[0], b.z - eye[2]), 2.2); else this.startFlee(b, Math.atan2(b.x - eye[0], b.z - eye[2])); this.hud.toast(`앗, ${b.sp.name}가 피했어요!`, 1100); continue; }
      got.push(b);
      if (got.length >= 3) break;
    }
    // a missed cicada flies off at once
    for (const b of this.alive) if (b.sp.id === 'cicada' && !got.includes(b) && !b.stay && b.st === 'sit' && Math.hypot(b.x - eye[0], b.y - eye[1], b.z - eye[2]) < 4) this.startFlee(b, Math.atan2(b.x - eye[0], b.z - eye[2]));
    for (const b of got) this.caught(b);
  }

  caught(b) {
    const fresh = addCatch(this.book, b.sp.id, this.state.day);
    this.build?.burst?.([b.x, b.y - 0.2, b.z], b.sp.color, 10);
    this.pop();
    const st = bookStats(this.book);
    this.hud.toast(caughtText(b.sp) + (fresh ? ` ✨ 새 곤충! 도감 ${st.kinds}/${st.all}` : ` (${this.book.c[b.sp.id]}마리)`), 2400);
    // into the bag for a moment, then back to the pool
    const i = this.alive.indexOf(b); if (i >= 0) this.alive.splice(i, 1);
    b.gone = true;
    this.root.remove(b.m.group);
    b.m.group.visible = true;
    b.m.group.position.set(0.24 + this.caughtShow.length * 0.05, -0.1, (Math.random() - 0.5) * 0.08);
    b.m.group.rotation.set(0.3, Math.random() * 6, 0.4);
    b.m.group.scale.setScalar(b.sp.size * 1.3);
    b.m.pose('rest', 0, 0);
    if (this.holding) { this.net.bag.add(b.m.group); this.caughtShow.push({ b, t: 1.4 }); } else this.pool.get(b.sp.id)?.push(b.m);
    this.save?.();
    this.onCatch?.(b.sp.id);
  }

  // ------------------------------------------------------------------ sounds (made in code)
  ac() { return audioOut(); }
  whoosh() {
    const o = this.ac(); if (!o) return;
    const { ctx, master } = o, t = ctx.currentTime;
    const b = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = b;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(2200, t + 0.12); f.frequency.exponentialRampToValueAtTime(700, t + 0.28);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.08); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + 0.32);
  }
  pop() {
    const o = this.ac(); if (!o) return;
    const { ctx, master } = o, t = ctx.currentTime;
    [880, 1320, 1760].forEach((fr, i) => {
      const os = ctx.createOscillator(); os.type = 'triangle'; os.frequency.setValueAtTime(fr, t + i * 0.06);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t + i * 0.06); g.gain.linearRampToValueAtTime(0.12, t + i * 0.06 + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.18);
      os.connect(g).connect(master); os.start(t + i * 0.06); os.stop(t + i * 0.06 + 0.2);
    });
  }
  squawk(b) {
    const o = this.ac(); if (!o) return;
    const { ctx, master } = o, t = ctx.currentTime;
    const d = Math.hypot(b.x - this.player.pos.x, b.z - this.player.pos.z), v = 0.18 / (1 + d * 0.3);
    const os = ctx.createOscillator(); os.type = 'sawtooth'; os.frequency.setValueAtTime(3800, t); os.frequency.linearRampToValueAtTime(2600, t + 0.5);
    const am = ctx.createOscillator(); am.frequency.value = 90; const amg = ctx.createGain(); amg.gain.value = 0.5; const vca = ctx.createGain(); vca.gain.value = 0.5; am.connect(amg).connect(vca.gain);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3600; f.Q.value = 3;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    os.connect(vca).connect(f).connect(g).connect(master); os.start(t); am.start(t); os.stop(t + 0.6); am.stop(t + 0.6);
  }
  /** 참매미 song "맴맴맴맴 매애앰" from the nearest singing cicada (distance in m, or null for none). */
  song(dist) {
    const o = (dist != null || this.songNode) ? this.ac() : null; if (!o) return;
    const { ctx, master } = o;
    if (!this.songNode && dist != null) {
      const sr = ctx.sampleRate, len = Math.floor(sr * 7.5), buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
      let ph1 = 0, ph2 = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        let env = 0, f = 5200;
        if (t < 3.6) { const k = t % 0.3; env = k < 0.21 ? Math.sin((k / 0.21) * Math.PI) ** 0.6 : 0; f = 5100 + 300 * (k / 0.21); }
        else if (t < 5.6) { const k = (t - 3.6) / 2; env = Math.sin(Math.min(1, k * 1.3) * Math.PI) ** 0.5 * (1 - 0.3 * k); f = 5400 - 900 * k; }
        ph1 += (2 * Math.PI * f) / sr; ph2 += (2 * Math.PI * 190) / sr;
        d[i] = env * Math.sin(ph1) * (0.55 + 0.45 * Math.sin(ph2)) * (0.8 + 0.2 * (Math.random() * 2 - 1));
      }
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 5000; bp.Q.value = 0.8;
      const g = ctx.createGain(); g.gain.value = 0;
      s.connect(bp).connect(g).connect(master); s.start();
      this.songNode = { s, g };
    }
    if (!this.songNode) return;
    const v = dist == null ? 0 : 0.11 * Math.max(0, 1 - dist / 32) ** 1.6;
    this.songNode.g.gain.setTargetAtTime(v, ctx.currentTime, 0.3);
  }

  // ------------------------------------------------------------------ 곤충 도감
  ui() {
    if (!document.getElementById('bugbook-css')) { const st = document.createElement('style'); st.id = 'bugbook-css'; st.textContent = CSS; document.head.appendChild(st); }
    this.modal = document.createElement('div'); this.modal.id = 'bugbook'; this.modal.className = 'modal hidden';
    document.body.appendChild(this.modal);
    const bar = $('buttons');
    if (bar) {
      this.btn = document.createElement('button'); this.btn.id = 'btn-net'; this.btn.title = '곤충 채집망 (C)'; this.btn.textContent = '🥅 채집망';
      this.btn.addEventListener('click', () => this.toggleNet());
      const bk = document.createElement('button'); bk.id = 'btn-bugs'; bk.title = '곤충 도감 (K)'; bk.textContent = '📗 곤충 도감';
      bk.addEventListener('click', () => this.open());
      bar.insertBefore(bk, $('btn-login')); bar.insertBefore(this.btn, bk);
    }
    const tb = $('tbtns');
    if (tb) { const t = document.createElement('button'); t.dataset.k = 'KeyC'; t.textContent = '채집망'; tb.appendChild(t); }
  }

  /** Pictures of every species (shown as a dark shape until it is found). */
  icons() {
    if (this.pics) return this.pics;
    const W = 200, H = 150;
    const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.setSize(W, H); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.AgXToneMapping; r.toneMappingExposure = 1.15;
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xffffff, 0x8a8070, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.6); sun.position.set(2, 5, 3); sc.add(sun);
    const rim = new THREE.DirectionalLight(0xdfe8ff, 1.2); rim.position.set(-3, 2, -2); sc.add(rim);
    const cam = new THREE.PerspectiveCamera(30, W / H, 0.01, 50);
    this.pics = {};
    for (const sp of SPECIES) {
      const m = buildInsect(sp.id);
      const wide = sp.move === 'flutter';
      m.pose(wide ? 'open' : sp.id === 'cicada' ? 'rest' : 'rest', 0.3, 0);
      m.group.rotation.y = wide ? 0 : 0.75;
      sc.add(m.group);
      if (m.lantern) m.lantern.material.emissiveIntensity = 1.2;
      const box = new THREE.Box3().setFromObject(m.group), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3()).length();
      if (wide) cam.position.set(c.x, c.y + s * 1.55, c.z + s * 0.9); else cam.position.set(c.x + s * 0.55, c.y + s * 1.1, c.z + s * 1.45);
      cam.lookAt(c);
      r.render(sc, cam);
      this.pics[sp.id] = r.domElement.toDataURL(); // not found yet: the same picture as a dark shape (CSS)
      sc.remove(m.group);
    }
    r.dispose(); r.forceContextLoss?.();
    return this.pics;
  }

  open() {
    if (this.modal.classList.contains('hidden') === false) { this.close(); return; }
    const pics = this.icons(), st = bookStats(this.book);
    const cards = SPECIES.map((sp) => {
      const seen = !!this.book.seen[sp.id], n = this.book.c[sp.id] ?? 0;
      if (!seen) return `<div class="bcard unknown"><div class="pic"><img alt="?" src="${pics[sp.id]}"></div><span class="q">?</span><b>???</b><p>${sp.where}</p></div>`;
      return `<div class="bcard" data-id="${sp.id}"><div class="pic"><img alt="${sp.name}" src="${pics[sp.id]}"></div>${n ? `<span class="n">×${n}</span>` : ''}<b>${sp.emoji} ${sp.name}${sp.rare ? '<span class="tag">드물어요</span>' : ''}</b><p>${sp.fact}</p><p>📍 ${sp.where}</p>${n ? `<button class="rel" data-id="${sp.id}">🍃 한 마리 놓아주기</button>` : '<p>모두 놓아줬어요</p>'}</div>`;
    }).join('');
    this.modal.innerHTML = `<div class="mcard book"><h2>📗 곤충 도감 <small>찾은 곤충 ${st.kinds} / ${st.all}종 · 가지고 있는 곤충 ${st.kept}마리</small></h2><p class="small">C 키로 채집망을 들고 왼쪽 클릭으로 휘둘러요. 낮엔 꽃밭, 풀밭, 나무, 물가에서, 밤엔 숲과 물가에서 찾아봐요!</p><div class="bgrid">${cards}</div><button class="alt close" id="bugbook-x">닫기</button></div>`;
    this.modal.classList.remove('hidden');
    this.input.enabled = false;
    document.exitPointerLock?.();
    for (const b of this.modal.querySelectorAll('button.rel')) b.onclick = () => { this.letGo(b.dataset.id); this.open2(); };
    $('bugbook-x').onclick = () => this.close();
  }
  open2() { this.modal.classList.add('hidden'); this.open(); }

  close() {
    this.modal.classList.add('hidden');
    this.input.enabled = true;
    this.input.lock?.();
  }

  get isOpen() { return !this.modal.classList.contains('hidden'); }

  /** Let one go: it is released next to you and flies, hops or crawls away. */
  letGo(id) {
    if (!release(this.book, id)) return;
    const sp = BY_ID[id], p = this.player.pos, f = this.player.forward;
    this.hud.toast(`🍃 ${sp.name}${eul(sp.name)} 놓아줬어요. 잘 가!`, 1800);
    this.save?.();
    if (this.places?.inside?.(p)) return;
    const x = p.x + f.x * 0.8, z = p.z + f.z * 0.8, y = this.groundAt(x, z);
    const b = this.spawn(sp, { x, y: sp.move === 'crawl' || sp.move === 'hop' ? y : p.y + 1.2, z, n: new THREE.Vector3(0, 1, 0), air: !(sp.move === 'crawl' || sp.move === 'hop') });
    if (b && sp.move !== 'crawl') { if (sp.move === 'hop') this.hop(b, Math.atan2(f.x, f.z), 2); else this.startFlee(b, Math.atan2(f.x, f.z)); }
  }

  // ------------------------------------------------------------------ test helpers
  /** Put one insect on its own kind of place (flower, leaf, bark) in the nearest such cell, holding still. */
  showcase(id, near = this.player.pos) {
    const sp = BY_ID[id];
    const habs = Object.entries(sp.habitats).sort((a, b) => b[1] - a[1]).map(([h]) => h).filter((h) => h !== 'water' && h !== 'grass' && h !== 'ground');
    for (const hab of habs) {
      let best = null, bd = 1e9;
      for (const [k, c] of this.grid) {
        if (!c[hab]?.length) continue;
        const [i, j] = k.split(',').map(Number), d = Math.hypot((i + 0.5) * CELL - near.x, (j + 0.5) * CELL - near.z);
        if (d < bd) { bd = d; best = c; }
      }
      if (!best) continue;
      for (let k = 0; k < 16; k++) {
        const at = this.placeFor(hab, best, 0, 0);
        if (!at || at.air) continue;
        const b = this.spawn(sp, at, { stay: true });
        if (b) { b.st = 'sit'; b.perch = { x: b.x, y: b.y, z: b.z, n: b.n }; return b; }
      }
    }
    return null;
  }
  /** Put one insect `dist` metres in front of the eye (dy up/down), holding still if stay. */
  spawnNear(id, dist = 2, { stay = true, dy = 0, side = 0 } = {}) {
    const sp = BY_ID[id];
    const { eye, dir } = this.eyeAndAim();
    const len = Math.hypot(dir[0], dir[2]) || 1;
    const x = eye[0] + (dir[0] / len) * dist + (-dir[2] / len) * side, z = eye[2] + (dir[2] / len) * dist + (dir[0] / len) * side;
    const y = eye[1] + dy;
    const g = this.groundAt(x, z);
    const onGround = sp.move === 'crawl' || sp.move === 'hop';
    const b = this.spawn(sp, { x, y: onGround ? g : Math.max(y, g + 0.05), z, n: new THREE.Vector3(0, 1, 0), air: !onGround && sp.move !== 'perch' && sp.move !== 'trunk' }, { stay });
    if (b) { b.yaw = Math.atan2(dir[0], dir[2]) + Math.PI * 0.7; if (sp.move === 'trunk' || sp.move === 'perch') { b.st = 'sit'; b.perch = { x, y: b.y, z, n: b.n }; } }
    return b;
  }
}
