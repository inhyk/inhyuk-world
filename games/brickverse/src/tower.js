// 하늘 타워 짓기: 내 땅(돌판)에 블록을 놓고 부수며 타워를 짓는다. 쌓은 블록을 밟고 올라가야 더 높이 놓을 수 있다.
// 친구 방에서는 각자 다른 땅에 짓는다 (혼자면 가운데 0번 땅, 방에서는 p1 → 0번, p2 → 1번 …).
// 친구 타워는 보이고 올라갈 수도 있지만 블록은 내 땅에만 놓고 부순다.
// 🌈 무지개 카펫: 내 땅 앞에 있다. 올라타면 내 타워 꼭대기 블록 옆까지 날아가고, 내리면 잠시 뒤 돌아온다.
import { THREE, material, textSprite } from './render.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TOWER, BLOCKS, P, cellKey, cellCenter, inTower, towerFloor, makeBox, placeBox } from '../core.mjs';
import { TOWER_SLOTS, TOWER_HALF, carpetHome } from '../worlds.mjs';

const CAP = 3200;
const geo = new RoundedBoxGeometry(TOWER.CELL, TOWER.CELL, TOWER.CELL, 2, 0.14);
const ICON = { glass: '💎', neon: '✨', gold: '👑', ice: '🧊', bounce: '⤒', ladder: '🪜', wood: '🪵', stone: '🪨' };
const matOf = b => material(b.c, b.m ?? (b.k === 'glass' ? 'glass' : b.k === 'ice' ? 'ice' : 'plastic'));
const RAINBOW = ['#ff4d5e', '#ff8a3d', '#ffd23f', '#5ad16b', '#3fa7ff', '#4a5cff', '#9b5cff'];
const CARPET = { W: 3.2, H: 0.3, RISE: 8, FLY: 6, WAIT: 2.5 };

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
    this.home = { x: hx, y: 0, z: hz };
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
    const box = makeBox({ x: hx, y: 0, z: hz, w: CARPET.W, h: CARPET.H, d: CARPET.W });
    this.game.world.boxes.push(box);
    this.carpet = { box, state: 'home', pos: { ...this.home }, path: [], idle: 0, sparkle: 0, told: false };
    this.carpetGroup.position.set(hx, 0, hz);
  }

  // 내 타워 꼭대기 블록 바로 옆 (같은 높이, 비어 있는 칸)
  carpetTarget() {
    let top = null;
    for (const c of this.cells.values()) {
      if (!top || c.j > top.j) top = c;
      else if (c.j === top.j) {
        const [ax, , az] = this.world(c.i, c.j, c.k), [bx, , bz] = this.world(top.i, top.j, top.k);
        if (Math.hypot(ax - this.home.x, az - this.home.z) < Math.hypot(bx - this.home.x, bz - this.home.z)) top = c;
      }
    }
    if (!top) return null;
    let best = null, bestD = Infinity;
    for (const [di, dk] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const i = top.i + di, k = top.k + dk;
      if (this.cells.has(cellKey(i, top.j, k))) continue;
      const [ox, oz] = this.origin();
      const x = (i + 0.5) * TOWER.CELL + ox, z = (k + 0.5) * TOWER.CELL + oz;
      const d = Math.hypot(x - this.home.x, z - this.home.z);
      if (d < bestD) { bestD = d; best = { x, z }; }
    }
    if (!best) return null;
    return { x: best.x, y: (top.j + 1) * TOWER.CELL - CARPET.H / 2, z: best.z, floor: top.j + 1 };
  }

  // main.js 가 플레이어를 움직이기 전에 부른다 (카펫에 탄 사람을 같이 옮기려고)
  move(dt) {
    const cp = this.carpet;
    if (!cp) return;
    const rider = this.game.player.ground === cp.box;
    if (cp.state === 'home') {
      if (rider) {
        const tg = this.carpetTarget();
        if (!tg) {
          if (!cp.told) { this.game.ui.toast('블록을 쌓으면 🌈 카펫이 꼭대기까지 데려다줘!'); cp.told = true; }
        } else {
          cp.path = [{ x: cp.pos.x, y: tg.y, z: cp.pos.z, speed: CARPET.RISE }, { x: tg.x, y: tg.y, z: tg.z, speed: CARPET.FLY }];
          cp.state = 'up';
          this.game.sfx('portal');
          this.game.ui.toast(`🌈 ${tg.floor}층 꼭대기로 출발!`, 1800);
        }
      } else cp.told = false;
    } else if (cp.state === 'top') {
      cp.idle = rider ? 0 : cp.idle + dt;
      if (cp.idle > CARPET.WAIT) { cp.path = [{ x: this.home.x, y: cp.pos.y, z: this.home.z, speed: CARPET.FLY }, { ...this.home, speed: CARPET.RISE }]; cp.state = 'down'; }
    }
    if (cp.state === 'up' || cp.state === 'down') {
      let left = dt;
      while (left > 0 && cp.path.length) {
        const p = cp.path[0];
        const dx = p.x - cp.pos.x, dy = p.y - cp.pos.y, dz = p.z - cp.pos.z, dist = Math.hypot(dx, dy, dz);
        const step = p.speed * left;
        if (dist <= step) { cp.pos = { x: p.x, y: p.y, z: p.z }; left -= dist / p.speed; cp.path.shift(); }
        else { cp.pos.x += dx / dist * step; cp.pos.y += dy / dist * step; cp.pos.z += dz / dist * step; left = 0; }
      }
      if (!cp.path.length) { cp.state = cp.state === 'up' ? 'top' : 'home'; cp.idle = 0; }
      cp.sparkle -= dt;
      if (cp.sparkle <= 0) { cp.sparkle = 0.12; this.game.effects.burst(cp.pos.x, cp.pos.y - 0.2, cp.pos.z, RAINBOW, 2, 2); }
    }
    placeBox(cp.box, cp.pos.x, cp.pos.y, cp.pos.z);
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
      this.act(e.clientX, e.clientY, d.button === 2 ? 'remove' : this.mode);
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
    document.body.append(bar);
    this.bar = bar;
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
      const wave = cp.state === 'home' ? Math.sin(now * 2) * 0.05 : 0;
      this.carpetGroup.position.set(cp.pos.x, cp.pos.y + 0.04 + wave, cp.pos.z);
      this.carpetGroup.rotation.z = Math.sin(now * 1.7) * (cp.state === 'home' ? 0.02 : 0.05);
      this.carpetGroup.rotation.x = Math.cos(now * 1.3) * (cp.state === 'home' ? 0.02 : 0.05);
    }
    // 미리 보기 (마우스)
    let tg = null;
    if (this.hover && this.ready()) tg = this.target(this.pick(this.hover.x, this.hover.y));
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
    for (const m of this.meshes) { m.removeFromParent(); m.dispose(); }
    for (const s of this.labels) { s.removeFromParent(); s.material.map.dispose(); s.material.dispose(); }
    this.ghost.removeFromParent();
    this.ghost.geometry.dispose(); this.ghostMat.dispose(); this.edges.geometry.dispose(); this.edges.material.dispose();
    this.carpetGroup.removeFromParent();
    this.carpetMat.map.dispose(); this.carpetMat.dispose();
    this.game.ui.setInfo('');
  }
}
