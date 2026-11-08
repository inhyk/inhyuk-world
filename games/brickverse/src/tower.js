// 하늘 타워 짓기: 내 땅(돌판)에 블록을 놓고 부수며 타워를 짓는다. 쌓은 블록을 밟고 올라가야 더 높이 놓을 수 있다.
// 친구 방에서는 각자 다른 땅에 짓는다 (혼자면 가운데 0번 땅, 방에서는 p1 → 0번, p2 → 1번 …).
// 친구 타워는 보이고 올라갈 수도 있지만 블록은 내 땅에만 놓고 부순다.
// 🌈 무지개 카펫: 내 땅 앞에 있다. 올라타면 조종한다 (WASD 이동, Space 위, C 아래, X 내리기).
//    내 땅 위에서만 날고, 블록에 부딪히면 멈춘다. 🏗️ 꼭대기로, 🌈 부르기 버튼도 있다.
import { THREE, material, textSprite } from './render.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TOWER, BLOCKS, P, cellKey, cellCenter, inTower, towerFloor, makeBox, placeBox } from '../core.mjs';
import { TOWER_SLOTS, TOWER_HALF, carpetHome } from '../worlds.mjs';

const CAP = 3200;
const geo = new RoundedBoxGeometry(TOWER.CELL, TOWER.CELL, TOWER.CELL, 2, 0.14);
const ICON = { glass: '💎', neon: '✨', gold: '👑', ice: '🧊', bounce: '⤒', ladder: '🪜', wood: '🪵', stone: '🪨' };
const matOf = b => material(b.c, b.m ?? (b.k === 'glass' ? 'glass' : b.k === 'ice' ? 'ice' : 'plastic'));
const RAINBOW = ['#ff4d5e', '#ff8a3d', '#ffd23f', '#5ad16b', '#3fa7ff', '#4a5cff', '#9b5cff'];
const CARPET = { W: 3.2, H: 0.3, Y: 0.16, SPEED: 7, CLIMB: 6, ACCEL: 22, AUTO: 7, MARGIN: 6, IDLE: 60 };

function carpetTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  RAINBOW.forEach((col, n) => { g.fillStyle = col; g.fillRect(0, (n * 256) / 7, 256, 256 / 7 + 1); });
  g.strokeStyle = '#fff6c2'; g.lineWidth = 14; g.strokeRect(7, 7, 242, 242);
  g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 4; g.strokeRect(22, 22, 212, 212);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Tower {
  constructor(game) {
    this.game = game;
    this.slot = game.net.active ? game.net.slot : 0;
    this.cells = new Map();   // 내 블록 "i,j,k" → { i, j, k, t, box }
    this.remote = new Map();  // 친구 id → Map("i,j,k" → { i, j, k, t, box, slot })
    this.type = 0;
    this.mode = 'place';
    this.cool = 0;
    this.hover = null;
    this.clearArmed = 0;
    this.m = new THREE.Matrix4();
    this.meshes = BLOCKS.map(b => {
      const mesh = new THREE.InstancedMesh(geo, matOf(b), CAP);
      mesh.count = 0; mesh.castShadow = b.k !== 'glass'; mesh.receiveShadow = true; mesh.frustumCulled = false;
      game.world.group.add(mesh);
      return mesh;
    });
    const g = new THREE.BoxGeometry(TOWER.CELL + 0.06, TOWER.CELL + 0.06, TOWER.CELL + 0.06);
    this.ghostMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.38, depthWrite: false });
    this.ghost = new THREE.Mesh(g, this.ghostMat);
    this.edges = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: '#ffffff' }));
    this.ghost.add(this.edges);
    this.ghost.visible = false;
    game.world.group.add(this.ghost);
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.labels = [];

    for (const [i, j, k, t] of game.save.tower.blocks) this.addMine(i, j, k, t, false);
    this.makeCarpet();
    this.remoteChanged();
    this.makeBar();
    this.bind();
    this.updateInfo();
  }

  get mine() { return this.cells.size; }
  origin(slot = this.slot) { return TOWER_SLOTS[slot] ?? TOWER_SLOTS[0]; }
  world(i, j, k, slot = this.slot) { const [x, y, z] = cellCenter(i, j, k), [ox, oz] = this.origin(slot); return [x + ox, y, z + oz]; }

  // ───── 칸 ─────
  makeCell(map, i, j, k, t, slot) {
    const key = cellKey(i, j, k);
    if (!inTower(i, j, k) || map.has(key)) return null;
    const [x, y, z] = this.world(i, j, k, slot);
    const box = makeBox({ x, y, z, w: TOWER.CELL, h: TOWER.CELL, d: TOWER.CELL, k: BLOCKS[t].k });
    this.game.world.boxes.push(box);
    const cell = { i, j, k, t, box, slot };
    map.set(key, cell);
    return cell;
  }
  dropCell(map, key) {
    const c = map.get(key);
    if (!c) return null;
    map.delete(key);
    this.game.world.boxes = this.game.world.boxes.filter(b => b !== c.box);
    if (this.game.player.ground === c.box) this.game.player.ground = null;
    return c;
  }
  addMine(i, j, k, t, redraw = true) { const c = this.makeCell(this.cells, i, j, k, t, this.slot); if (c && redraw) this.redraw(); return !!c; }
  removeMine(key, redraw = true) { const c = this.dropCell(this.cells, key); if (c && redraw) this.redraw(); return c; }

  redraw() {
    const counts = BLOCKS.map(() => 0);
    const put = c => {
      const n = counts[c.t]++;
      if (n >= CAP) return;
      const [x, y, z] = this.world(c.i, c.j, c.k, c.slot);
      this.m.makeTranslation(x, y, z);
      this.meshes[c.t].setMatrixAt(n, this.m);
    };
    for (const c of this.cells.values()) put(c);
    for (const map of this.remote.values()) for (const c of map.values()) put(c);
    this.meshes.forEach((mesh, t) => { mesh.count = Math.min(CAP, counts[t]); mesh.instanceMatrix.needsUpdate = true; });
  }

  // 친구 블록과 이름표를 다시 맞춘다 (친구가 들어오거나 나갈 때)
  remoteChanged() {
    for (const map of this.remote.values()) for (const key of [...map.keys()]) this.dropCell(map, key);
    this.remote.clear();
    for (const r of this.game.remotes.values()) {
      const slot = this.game.slotOf(r.id);
      if (slot === this.slot) continue;
      const map = new Map();
      this.remote.set(r.id, map);
      if (r.tower) for (const [key, t] of r.tower) { const [i, j, k] = key.split(',').map(Number); this.makeCell(map, i, j, k, t, slot); }
    }
    this.redraw();
    this.makeLabels();
  }
  remoteAdd(id, i, j, k, t) {
    const slot = this.game.slotOf(id);
    if (slot === this.slot) return;
    if (!this.remote.has(id)) this.remote.set(id, new Map());
    if (this.makeCell(this.remote.get(id), i, j, k, t, slot)) this.redraw();
  }
  remoteDel(id, i, j, k) { const map = this.remote.get(id); if (map && this.dropCell(map, cellKey(i, j, k))) this.redraw(); }

  makeLabels() {
    for (const s of this.labels) { s.removeFromParent(); s.material.map.dispose(); s.material.dispose(); }
    this.labels = [];
    const owners = [{ slot: this.slot, text: '🏗️ 나의 타워', bg: 'rgba(33,199,184,0.9)' }];
    for (const r of this.game.remotes.values()) if (r.avatar) owners.push({ slot: this.game.slotOf(r.id), text: `${r.name}의 타워`, bg: 'rgba(20,22,30,0.72)' });
    for (const o of owners) {
      const [ox, oz] = this.origin(o.slot);
      const s = textSprite(o.text, { size: 56, bg: o.bg, scale: 0.016 });
      s.position.set(ox, 1.2, oz + TOWER_HALF + 0.8);
      this.game.world.group.add(s);
      this.labels.push(s);
    }
  }

  saveMine() {
    this.game.save.tower.blocks = [...this.cells.values()].map(c => [c.i, c.j, c.k, c.t]);
    this.game.persist();
  }

  // ───── 화면 위치 → 칸 (내 땅만) ─────
  pick(cx, cy) {
    this.ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.game.camera);
    const o = this.ray.ray.origin, d = this.ray.ray.direction;
    let best = 90, hit = null;
    const oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];
    for (const c of this.cells.values()) {
      const b = c.box;
      const lo = [b.x0, b.y0, b.z0], hi = [b.x1, b.y1, b.z1];
      let t0 = 0, t1 = best, axis = -1, ok = true;
      for (let a = 0; a < 3; a++) {
        if (Math.abs(dd[a]) < 1e-9) { if (oo[a] < lo[a] || oo[a] > hi[a]) { ok = false; break; } continue; }
        let ta = (lo[a] - oo[a]) / dd[a], tb = (hi[a] - oo[a]) / dd[a];
        if (ta > tb) [ta, tb] = [tb, ta];
        if (ta > t0) { t0 = ta; axis = a; }
        if (tb < t1) t1 = tb;
        if (t0 > t1) { ok = false; break; }
      }
      if (ok && axis >= 0 && t0 < best) {
        best = t0;
        const n = [0, 0, 0]; n[axis] = dd[axis] > 0 ? -1 : 1;
        hit = { cell: c, normal: n };
      }
    }
    if (d.y < -1e-6) {
      const tg = -o.y / d.y;
      if (tg < best) {
        const [ox, oz] = this.origin();
        const i = Math.floor((o.x + d.x * tg - ox) / TOWER.CELL), k = Math.floor((o.z + d.z * tg - oz) / TOWER.CELL);
        if (inTower(i, 0, k)) hit = { ground: true, i, k };
        else hit = { outside: true };
      }
    }
    return hit;
  }

  target(hit) {
    if (!hit) return null;
    if (hit.outside) return this.mode === 'place' ? { i: 0, j: 0, k: 0, ok: false, why: '내 땅(파란 테두리 돌판)에만 지을 수 있어', hidden: true } : null;
    if (this.mode === 'remove') {
      if (!hit.cell) return null;
      return { i: hit.cell.i, j: hit.cell.j, k: hit.cell.k, ok: true, key: cellKey(hit.cell.i, hit.cell.j, hit.cell.k) };
    }
    const [i, j, k] = hit.ground ? [hit.i, 0, hit.k] : [hit.cell.i + hit.normal[0], hit.cell.j + hit.normal[1], hit.cell.k + hit.normal[2]];
    let why = '';
    if (!inTower(i, j, k)) why = j > TOWER.TOP ? '100층이 끝이야!' : '내 땅 밖에는 못 놓아';
    else if (this.cells.has(cellKey(i, j, k))) why = '이미 블록이 있어';
    else if (this.mine >= TOWER.LIMIT) why = `블록은 ${TOWER.LIMIT}개까지야. 부수고 다시 놓아 봐`;
    else {
      const [x, y, z] = this.world(i, j, k), pl = this.game.player, h = TOWER.CELL / 2;
      if (Math.hypot(x - pl.x, y - (pl.y + 1.6), z - pl.z) > TOWER.REACH) why = '너무 멀어! 가까이 가서 놓아 (🌈 카펫을 타 봐)';
      else if (pl.x + P.R > x - h && pl.x - P.R < x + h && pl.z + P.R > z - h && pl.z - P.R < z + h && pl.y + P.H > y - h && pl.y < y + h) why = '내 자리에는 못 놓아';
      else if (this.carpet && this.overlapsCarpet(x, y, z)) why = '카펫 자리에는 못 놓아';
    }
    return { i, j, k, ok: !why, why };
  }

  overlapsCarpet(x, y, z) {
    const b = this.carpet.box, h = TOWER.CELL / 2;
    return x + h > b.x0 && x - h < b.x1 && y + h > b.y0 && y - h < b.y1 && z + h > b.z0 && z - h < b.z1;
  }

  act(cx, cy, mode = this.mode) {
    if (this.cool > 0) return;
    const keep = this.mode;
    this.mode = mode;
    const tg = this.target(this.pick(cx, cy));
    this.mode = keep;
    if (!tg) return;
    if (!tg.ok) { if (tg.why) this.game.ui.toast(tg.why, 1800); this.game.sfx('nope'); return; }
    this.cool = TOWER.RATE;
    const net = this.game.net;
    if (mode === 'remove') {
      const c = this.removeMine(tg.key);
      if (!c) return;
      const [x, y, z] = this.world(c.i, c.j, c.k);
      this.game.effects.burst(x, y, z, [BLOCKS[c.t].c, '#ffffff'], 10, 5);
      this.game.sfx('crumble');
      net.send({ t: 'tw', a: 2, b: [c.i, c.j, c.k] });
    } else {
      if (!this.addMine(tg.i, tg.j, tg.k, this.type)) return;
      this.game.sfx('pop');
      net.send({ t: 'tw', a: 1, b: [tg.i, tg.j, tg.k, this.type] });
    }
    this.saveMine();
    this.updateInfo();
  }

  clearMine() {
    for (const key of [...this.cells.keys()]) this.removeMine(key, false);
    this.redraw();
    this.saveMine();
    this.game.net.send({ t: 'tw', a: 3 });
    this.game.sfx('crumble');
    this.game.ui.toast('내 블록을 모두 치웠어');
    this.updateInfo();
  }

  // ───── 🌈 무지개 카펫 ─────
  makeCarpet() {
    const [hx, , hz] = carpetHome(this.slot);
    this.home = { x: hx, y: CARPET.Y, z: hz };
    const group = new THREE.Group();
    const tex = carpetTexture();
    this.carpetMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.18 });
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(CARPET.W, 0.22, CARPET.W, 2, 0.08), this.carpetMat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    const tassel = new THREE.MeshStandardMaterial({ color: '#ffd23f', roughness: 0.4, metalness: 0.3 });
    const tg = new THREE.SphereGeometry(0.14, 10, 8);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const t = new THREE.Mesh(tg, tassel); t.position.set(sx * CARPET.W / 2, -0.05, sz * CARPET.W / 2); group.add(t); }
    this.carpetGroup = group;
    this.game.world.group.add(group);
    const box = makeBox({ x: hx, y: CARPET.Y, z: hz, w: CARPET.W, h: CARPET.H, d: CARPET.W });
    this.game.world.boxes.push(box);
    // mode: park(떠 있음) · drive(조종) · path(자동으로 날아감)
    this.carpet = { box, mode: 'park', pos: { ...this.home }, vel: { x: 0, y: 0, z: 0 }, path: [], idle: 0, sparkle: 0, told: false, off: 0, stuck: 0, upBtn: false, downBtn: false };
    this.carpetGroup.position.set(hx, CARPET.Y, hz);
    // 날 수 있는 곳: 내 땅 위 (옆으로 조금 더)
    const [ox, oz] = this.origin();
    const m = TOWER_HALF + CARPET.MARGIN;
    this.bounds = { x0: ox - m, x1: ox + m, z0: oz - m, z1: hz + 1, y0: CARPET.Y, y1: (TOWER.TOP + 1) * TOWER.CELL + 6 };
  }

  get riding() { return !!this.carpet && this.game.player.ground === this.carpet.box; }
  // main.js 가 보고 플레이어 걷기를 멈춘다 (조종하는 동안은 키가 카펫을 움직인다)
  get driving() { return this.carpet?.mode === 'drive' && this.riding && this.carpet.off <= 0; }

  // 카펫과 그 위에 탄 사람 자리가 무엇과 겹치나 (블록, 기둥, 땅)
  blocked(x, y, z) {
    const h = CARPET.W / 2;
    const x0 = x - h, x1 = x + h, y0 = y - CARPET.H / 2, y1 = y + CARPET.H / 2 + P.H, z0 = z - h, z1 = z + h;
    for (const b of this.game.world.boxes) {
      if (b === this.carpet.box || !b.on) continue;
      if (x1 > b.x0 && x0 < b.x1 && y1 > b.y0 && y0 < b.y1 && z1 > b.z0 && z0 < b.z1) return true;
    }
    return false;
  }

  // 내 타워 꼭대기 블록 바로 옆 (같은 높이, 비어 있는 칸)
  carpetTarget() {
    let top = null;
    const from = this.carpet.pos;
    for (const c of this.cells.values()) {
      if (!top || c.j > top.j) top = c;
      else if (c.j === top.j) {
        const [ax, , az] = this.world(c.i, c.j, c.k), [bx, , bz] = this.world(top.i, top.j, top.k);
        if (Math.hypot(ax - from.x, az - from.z) < Math.hypot(bx - from.x, bz - from.z)) top = c;
      }
    }
    if (!top) return null;
    // 꼭대기 블록 옆면에 카펫 가장자리가 딱 붙는 자리 (블록과 겹치지 않는 곳 중 가까운 곳)
    const [cx, , cz] = this.world(top.i, top.j, top.k);
    const y = (top.j + 1) * TOWER.CELL - CARPET.H / 2, gap = TOWER.CELL / 2 + CARPET.W / 2 + 0.05;
    let best = null, bestD = Infinity;
    for (const [di, dk] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const x = cx + di * gap, z = cz + dk * gap;
      if (this.blocked(x, y, z)) continue;
      const d = Math.hypot(x - from.x, z - from.z);
      if (d < bestD) { bestD = d; best = { x, z }; }
    }
    if (!best) return null;
    return { x: best.x, y, z: best.z, floor: top.j + 1 };
  }

  flyTop() {
    const cp = this.carpet, tg = this.carpetTarget();
    if (!tg) { this.game.ui.toast('블록을 쌓으면 꼭대기까지 데려다줄게!'); return; }
    cp.path = [{ x: cp.pos.x, y: Math.max(cp.pos.y, tg.y), z: cp.pos.z }, { x: tg.x, y: Math.max(cp.pos.y, tg.y), z: tg.z }, { x: tg.x, y: tg.y, z: tg.z }];
    cp.mode = 'path'; cp.stuck = 0;
    this.game.sfx('portal');
    this.game.ui.toast(`🌈 ${tg.floor}층 꼭대기로!`, 1600);
  }
  callCarpet() {
    const cp = this.carpet, pl = this.game.player, b = this.bounds;
    const yaw = this.game.controls.facing;
    let x = pl.x + Math.sin(yaw) * 2.8, z = pl.z + Math.cos(yaw) * 2.8, y = Math.max(CARPET.Y, pl.y - CARPET.H / 2);
    const inside = pl.x > b.x0 && pl.x < b.x1 && pl.z > b.z0 && pl.z < b.z1;
    if (!inside || this.blocked(x, y, z)) { x = this.home.x; y = this.home.y; z = this.home.z; }
    cp.path = [{ x, y, z }];
    cp.mode = 'path'; cp.stuck = 0; cp.ghostPath = true;
    this.game.sfx('portal');
    this.game.ui.toast(inside ? '🌈 카펫이 날아와!' : '🌈 카펫이 집으로 돌아가', 1500);
  }
  dismount() {
    const cp = this.carpet;
    if (!this.riding) return;
    cp.off = 1.4; cp.mode = 'park'; cp.vel = { x: 0, y: 0, z: 0 };
    this.game.ui.toast('🛬 카펫이 멈췄어. 걸어서 내려!', 1600);
  }

  // main.js 가 플레이어를 움직이기 전에 부른다 (카펫에 탄 사람을 같이 옮기려고)
  move(dt) {
    const cp = this.carpet;
    if (!cp) return;
    const c = this.game.controls, b = this.bounds;
    const riding = this.riding;
    cp.off = Math.max(0, cp.off - dt);
    if (riding && cp.off <= 0 && cp.mode === 'park') {
      cp.mode = 'drive';
      if (!cp.told) { cp.told = true; this.game.ui.toast(matchMedia('(pointer: coarse)').matches ? '🌈 조이스틱으로 날고 ⬆⬇ 로 위아래, 🛬 로 내려' : '🌈 WASD 로 날고 Space 위 · C 아래 · X 내리기', 3600); }
    }
    if (cp.mode === 'drive' && !riding) cp.mode = 'park';
    let want = { x: 0, y: 0, z: 0 };
    if (cp.mode === 'drive' && cp.off <= 0) {
      const mv = c.move();
      const up = c.keys.has('Space') || c.jumpHeld || cp.upBtn, down = c.keys.has('KeyC') || cp.downBtn;
      want = { x: mv.x * CARPET.SPEED, y: (up ? 1 : 0) * CARPET.CLIMB - (down ? 1 : 0) * CARPET.CLIMB, z: mv.z * CARPET.SPEED };
    } else if (cp.mode === 'path') {
      // 조종 키를 누르면 자동 비행을 멈추고 직접 조종
      if (riding && (Math.hypot(c.move().x, c.move().z) > 0.2 || c.keys.has('KeyC'))) { cp.mode = 'drive'; cp.path = []; }
      const p = cp.path[0];
      if (p) {
        const dx = p.x - cp.pos.x, dy = p.y - cp.pos.y, dz = p.z - cp.pos.z, dist = Math.hypot(dx, dy, dz);
        if (dist < 0.15) { cp.path.shift(); if (!cp.path.length) { cp.mode = riding ? 'drive' : 'park'; cp.ghostPath = false; } }
        else { const sp = Math.min(CARPET.AUTO, dist * 3); want = { x: dx / dist * sp, y: dy / dist * sp, z: dz / dist * sp }; }
      } else cp.mode = 'park';
    }
    // 부드럽게 빨라지고 멈춘다
    const k = Math.min(1, CARPET.ACCEL * dt / Math.max(1, CARPET.SPEED));
    cp.vel.x += (want.x - cp.vel.x) * k * 2; cp.vel.y += (want.y - cp.vel.y) * k * 2; cp.vel.z += (want.z - cp.vel.z) * k * 2;
    if (cp.mode === 'path') { cp.vel = { ...want }; }
    // 축마다 움직여 보고, 부딪히거나 내 땅 밖이면 그 축은 멈춘다 (부르기로 날아올 때는 안 부딪힘)
    const before = { ...cp.pos };
    const free = cp.ghostPath && !riding;
    for (const ax of ['y', 'x', 'z']) {
      const v = cp.vel[ax];
      if (Math.abs(v) < 1e-4) continue;
      const next = { ...cp.pos, [ax]: cp.pos[ax] + v * dt };
      const lo = b[ax + '0'], hi = b[ax + '1'];
      if (!free && (next[ax] < lo || next[ax] > hi || this.blocked(next.x, next.y, next.z))) { cp.vel[ax] = 0; continue; }
      cp.pos = next;
    }
    if (cp.mode === 'path') {
      cp.stuck = Math.hypot(cp.pos.x - before.x, cp.pos.y - before.y, cp.pos.z - before.z) < 1e-3 ? cp.stuck + dt : 0;
      if (cp.stuck > 1) { cp.mode = riding ? 'drive' : 'park'; cp.path = []; cp.ghostPath = false; if (riding) this.game.ui.toast('블록에 막혀서 멈췄어. 직접 조종해 봐!', 1800); }
    }
    // 아무도 안 타고 오래 떠 있으면 집으로
    const away = Math.hypot(cp.pos.x - this.home.x, cp.pos.y - this.home.y, cp.pos.z - this.home.z) > 0.5;
    cp.idle = !riding && cp.mode === 'park' && away ? cp.idle + dt : 0;
    if (cp.idle > CARPET.IDLE) { cp.path = [{ ...this.home }]; cp.mode = 'path'; cp.ghostPath = true; cp.idle = 0; }
    const moving = Math.hypot(cp.vel.x, cp.vel.y, cp.vel.z) > 0.5;
    cp.sparkle -= dt;
    if (moving && cp.sparkle <= 0) { cp.sparkle = 0.12; this.game.effects.burst(cp.pos.x, cp.pos.y - 0.2, cp.pos.z, RAINBOW, 2, 2); }
    placeBox(cp.box, cp.pos.x, cp.pos.y, cp.pos.z);
    // 조종 버튼 보이기
    const show = riding;
    if (this.carpetBar.hidden === show) this.carpetBar.hidden = !show;
  }

  // ───── 입력 ─────
  bind() {
    const c = this.game.canvas;
    this.down = null;
    this.onDown = e => { this.down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, button: e.button }; };
    this.onMove = e => { if (e.pointerType === 'mouse') this.hover = { x: e.clientX, y: e.clientY }; };
    this.onUp = e => {
      const d = this.down; this.down = null;
      if (!d || d.id !== e.pointerId || !this.ready()) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || performance.now() - d.t > 450) return;
      const [x, y] = this.game.controls.locked ? [innerWidth / 2, innerHeight / 2] : [e.clientX, e.clientY];
      this.act(x, y, d.button === 2 ? 'remove' : this.mode);
    };
    this.onLeave = () => { this.hover = null; };
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointerleave', this.onLeave);
  }
  ready() { return this.game.started && !this.game.wardrobeOpen && !this.game.isDead(); }

  key(code) {
    if (code.startsWith('Digit')) { const n = Number(code.slice(5)); this.select(n === 0 ? 9 : n - 1); return true; }
    if (code === 'KeyQ') { this.select((this.type + BLOCKS.length - 1) % BLOCKS.length); return true; }
    if (code === 'KeyE') { this.select((this.type + 1) % BLOCKS.length); return true; }
    if (code === 'KeyF') { this.setMode(this.mode === 'place' ? 'remove' : 'place'); return true; }
    if (code === 'KeyX' && this.riding) { this.dismount(); return true; }
    return false;
  }

  select(t) {
    if (t < 0 || t >= BLOCKS.length) return;
    this.type = t;
    this.setMode('place');
    this.bar.querySelectorAll('.blocks button').forEach((b, n) => b.classList.toggle('on', n === t));
    this.bar.querySelector('.blocks button.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  setMode(m) {
    this.mode = m;
    const btn = this.bar.querySelector('.mode');
    btn.textContent = m === 'place' ? '🧱 놓기' : '⛏️ 부수기';
    btn.classList.toggle('remove', m === 'remove');
  }

  makeBar() {
    const bar = document.createElement('div');
    bar.id = 'build-bar';
    bar.innerHTML = '<button class="mode" title="놓기/부수기 바꾸기 (F)">🧱 놓기</button><div class="blocks"></div><button class="clear" title="내 블록 모두 치우기">🗑</button><p class="tip"></p>';
    const list = bar.querySelector('.blocks');
    BLOCKS.forEach((b, n) => {
      const btn = document.createElement('button');
      btn.title = `${b.name}${n < 10 ? ` (${(n + 1) % 10})` : ''}`;
      btn.setAttribute('aria-label', b.name);
      btn.style.setProperty('--c', b.c);
      const ic = ICON[b.id];
      if (ic) btn.textContent = ic;
      if (b.k === 'glass') btn.classList.add('glass');
      btn.addEventListener('click', () => { this.game.sfx('click'); this.select(n); });
      list.append(btn);
    });
    bar.querySelector('.mode').addEventListener('click', () => { this.game.sfx('click'); this.setMode(this.mode === 'place' ? 'remove' : 'place'); });
    const clear = bar.querySelector('.clear');
    clear.addEventListener('click', () => {
      if (this.clearArmed > 0) { this.clearArmed = 0; clear.textContent = '🗑'; this.clearMine(); return; }
      this.clearArmed = 3; clear.textContent = '정말?';
      this.game.ui.toast('한 번 더 누르면 내 블록을 모두 치워');
    });
    bar.querySelector('.tip').textContent = matchMedia('(pointer: coarse)').matches ? '톡: 놓기 · 버튼으로 부수기 모드 · 🌈 카펫으로 꼭대기까지' : '클릭 놓기 · 오른쪽 클릭 부수기 · 숫자/Q E 고르기 · F 바꾸기 · 🌈 카펫으로 꼭대기까지';
    const call = document.createElement('button');
    call.className = 'call'; call.title = '카펫 부르기'; call.textContent = '🌈 부르기';
    call.addEventListener('click', () => { this.game.sfx('click'); this.callCarpet(); });
    bar.insertBefore(call, bar.querySelector('.clear'));
    document.body.append(bar);
    this.bar = bar;
    // 카펫에 탔을 때만 보이는 조종 버튼
    const cb = document.createElement('div');
    cb.id = 'carpet-bar'; cb.hidden = true;
    cb.innerHTML = '<button class="up" aria-label="위로">⬆</button><button class="down" aria-label="아래로">⬇</button><button class="top">🏗️ 꼭대기로</button><button class="off">🛬 내리기</button><p class="tip"></p>';
    const hold = (el, key) => {
      const on = e => { e.preventDefault(); this.carpet[key] = true; el.classList.add('on'); };
      const offf = () => { this.carpet[key] = false; el.classList.remove('on'); };
      el.addEventListener('pointerdown', on); el.addEventListener('pointerup', offf); el.addEventListener('pointerleave', offf); el.addEventListener('pointercancel', offf);
    };
    hold(cb.querySelector('.up'), 'upBtn');
    hold(cb.querySelector('.down'), 'downBtn');
    cb.querySelector('.top').addEventListener('click', () => { this.game.sfx('click'); this.flyTop(); });
    cb.querySelector('.off').addEventListener('click', () => { this.game.sfx('click'); this.dismount(); });
    cb.querySelector('.tip').textContent = matchMedia('(pointer: coarse)').matches ? '조이스틱: 날기 · ⬆⬇: 위아래' : 'WASD 날기 · Space 위 · C 아래 · X 내리기';
    document.body.append(cb);
    this.carpetBar = cb;
    this.select(0);
  }

  updateInfo() {
    const s = this.game.save.tower;
    const now = towerFloor(this.game.player.y);
    this.game.ui.setInfo(`<b>🏗️ 지금 ${now}층 · 최고 ${s.best}층</b><small>내 블록 ${this.mine}/${TOWER.LIMIT}</small>`);
  }

  update(dt, t) {
    this.cool -= dt;
    if (this.clearArmed > 0) { this.clearArmed -= dt; if (this.clearArmed <= 0) this.bar.querySelector('.clear').textContent = '🗑'; }
    const pl = this.game.player, s = this.game.save.tower;
    // 처음 올라간 층마다 코인
    if (pl.ground && pl.ground !== this.carpet?.box) {
      const floor = towerFloor(pl.y);
      if (floor > s.best) {
        const gain = floor - s.best;
        s.best = floor;
        this.game.addCoins(gain);
        if (floor % 5 === 0 || gain > 2) { this.game.ui.toast(`🏗️ ${floor}층 도착! 🪙+${gain}`); this.game.sfx('check'); } else this.game.sfx('coin');
        this.game.persist();
      }
    }
    // 카펫 모양 (가만히 있을 때 살랑살랑)
    const cp = this.carpet;
    if (cp) {
      const now = t ?? performance.now() / 1000;
      const still = Math.hypot(cp.vel.x, cp.vel.y, cp.vel.z) < 0.5;
      const wave = still ? Math.sin(now * 2) * 0.05 : 0;
      this.carpetGroup.position.set(cp.pos.x, cp.pos.y + 0.04 + wave, cp.pos.z);
      // 가는 쪽으로 살짝 기울기
      this.carpetGroup.rotation.z = Math.sin(now * 1.7) * 0.02 - cp.vel.x * 0.012;
      this.carpetGroup.rotation.x = Math.cos(now * 1.3) * 0.02 + cp.vel.z * 0.012;
    }
    // 미리 보기 (마우스)
    let tg = null;
    const aim = this.game.controls.locked ? { x: innerWidth / 2, y: innerHeight / 2 } : this.hover;
    if (aim && this.ready()) tg = this.target(this.pick(aim.x, aim.y));
    if (tg && !tg.hidden) {
      const [x, y, z] = this.world(tg.i, tg.j, tg.k);
      this.ghost.position.set(x, y, z);
      const col = this.mode === 'remove' ? '#ff4d5e' : tg.ok ? BLOCKS[this.type].c : '#ff4d5e';
      this.ghostMat.color.set(col);
      this.ghostMat.opacity = this.mode === 'remove' ? 0.3 : tg.ok ? 0.45 : 0.22;
      this.edges.material.color.set(tg.ok ? '#ffffff' : '#ff4d5e');
      this.ghost.visible = true;
    } else this.ghost.visible = false;
    this.infoTimer = (this.infoTimer ?? 0) - dt;
    if (this.infoTimer <= 0) { this.infoTimer = 0.3; this.updateInfo(); }
  }

  dispose() {
    const c = this.game.canvas;
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('pointermove', this.onMove);
    c.removeEventListener('pointerup', this.onUp);
    c.removeEventListener('pointerleave', this.onLeave);
    this.bar.remove();
    this.carpetBar.remove();
    for (const m of this.meshes) { m.removeFromParent(); m.dispose(); }
    for (const s of this.labels) { s.removeFromParent(); s.material.map.dispose(); s.material.dispose(); }
    this.ghost.removeFromParent();
    this.ghost.geometry.dispose(); this.ghostMat.dispose(); this.edges.geometry.dispose(); this.edges.material.dispose();
    this.carpetGroup.removeFromParent();
    this.carpetMat.map.dispose(); this.carpetMat.dispose();
    this.game.ui.setInfo('');
  }
}
