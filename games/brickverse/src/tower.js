// 하늘 타워 짓기: 블록을 놓고 부수며 타워를 짓는다. 내가 쌓은 블록을 밟고 올라가야 더 높이 놓을 수 있다.
// 친구 방에서는 같은 땅에 같이 짓는다 (친구 블록은 못 부순다). 내 블록은 저장된다.
import { THREE, material } from './render.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TOWER, BLOCKS, P, cellKey, cellCenter, inTower, towerFloor, makeBox } from '../core.mjs';

const CAP = 3200;
const geo = new RoundedBoxGeometry(TOWER.CELL, TOWER.CELL, TOWER.CELL, 2, 0.14);
const ICON = { glass: '💎', neon: '✨', gold: '👑', ice: '🧊', bounce: '⤒', ladder: '🪜', wood: '🪵', stone: '🪨' };
const matOf = b => material(b.c, b.m ?? (b.k === 'glass' ? 'glass' : b.k === 'ice' ? 'ice' : 'plastic'));

export class Tower {
  constructor(game) {
    this.game = game;
    this.cells = new Map(); // "i,j,k" → { i, j, k, t, owner, box }
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
    // 놓을 곳 미리 보기
    const g = new THREE.BoxGeometry(TOWER.CELL + 0.06, TOWER.CELL + 0.06, TOWER.CELL + 0.06);
    this.ghostMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.38, depthWrite: false });
    this.ghost = new THREE.Mesh(g, this.ghostMat);
    this.edges = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: '#ffffff' }));
    this.ghost.add(this.edges);
    this.ghost.visible = false;
    game.world.group.add(this.ghost);
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();

    for (const [i, j, k, t] of game.save.tower.blocks) this.add(i, j, k, t, 'me', false);
    this.remoteChanged();
    this.makeBar();
    this.bind();
    this.updateInfo();
  }

  get mine() { let n = 0; for (const c of this.cells.values()) if (c.owner === 'me') n++; return n; }

  // ───── 칸 ─────
  add(i, j, k, t, owner, redraw = true) {
    const key = cellKey(i, j, k);
    if (!inTower(i, j, k) || this.cells.has(key)) return false;
    const [x, y, z] = cellCenter(i, j, k);
    const box = makeBox({ x, y, z, w: TOWER.CELL, h: TOWER.CELL, d: TOWER.CELL, k: BLOCKS[t].k });
    box.towerKey = key;
    this.game.world.boxes.push(box);
    this.cells.set(key, { i, j, k, t, owner, box });
    if (redraw) this.redraw();
    return true;
  }

  remove(key, redraw = true) {
    const c = this.cells.get(key);
    if (!c) return null;
    this.cells.delete(key);
    this.game.world.boxes = this.game.world.boxes.filter(b => b !== c.box);
    if (this.game.player.ground === c.box) this.game.player.ground = null;
    if (redraw) this.redraw();
    return c;
  }

  redraw() {
    const counts = BLOCKS.map(() => 0);
    for (const c of this.cells.values()) {
      const n = counts[c.t]++;
      if (n >= CAP) continue;
      const [x, y, z] = cellCenter(c.i, c.j, c.k);
      this.m.makeTranslation(x, y, z);
      this.meshes[c.t].setMatrixAt(n, this.m);
    }
    this.meshes.forEach((mesh, t) => { mesh.count = Math.min(CAP, counts[t]); mesh.instanceMatrix.needsUpdate = true; });
  }

  // 친구 블록을 다시 맞춘다 (친구가 들어오거나 나갈 때)
  remoteChanged() {
    for (const [key, c] of [...this.cells]) if (c.owner !== 'me') this.remove(key, false);
    for (const r of this.game.remotes.values()) {
      if (!r.tower) continue;
      for (const [key, t] of r.tower) {
        const [i, j, k] = key.split(',').map(Number);
        this.add(i, j, k, t, r.id, false);
      }
    }
    this.redraw();
  }
  remoteAdd(id, i, j, k, t) { this.add(i, j, k, t, id); }
  remoteDel(id, i, j, k) { const key = cellKey(i, j, k); if (this.cells.get(key)?.owner === id) this.remove(key); }

  saveMine() {
    this.game.save.tower.blocks = [...this.cells.values()].filter(c => c.owner === 'me').map(c => [c.i, c.j, c.k, c.t]);
    this.game.persist();
  }

  // ───── 화면 위치 → 칸 ─────
  pick(cx, cy) {
    const cam = this.game.camera;
    this.ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
    this.ray.setFromCamera(this.ndc, cam);
    const o = this.ray.ray.origin, d = this.ray.ray.direction;
    let best = 90, hit = null;
    for (const c of this.cells.values()) {
      const b = c.box;
      let t0 = 0, t1 = best, axis = -1, ok = true;
      const lo = [b.x0, b.y0, b.z0], hi = [b.x1, b.y1, b.z1], oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];
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
        const i = Math.floor((o.x + d.x * tg) / TOWER.CELL), k = Math.floor((o.z + d.z * tg) / TOWER.CELL);
        if (inTower(i, 0, k)) hit = { ground: true, i, k };
      }
    }
    return hit;
  }

  // 놓을 칸과 이유
  target(hit) {
    if (!hit) return null;
    if (this.mode === 'remove') {
      if (!hit.cell) return null;
      return { i: hit.cell.i, j: hit.cell.j, k: hit.cell.k, ok: hit.cell.owner === 'me', why: hit.cell.owner === 'me' ? '' : '친구 블록은 부술 수 없어', key: cellKey(hit.cell.i, hit.cell.j, hit.cell.k) };
    }
    const [i, j, k] = hit.ground ? [hit.i, 0, hit.k] : [hit.cell.i + hit.normal[0], hit.cell.j + hit.normal[1], hit.cell.k + hit.normal[2]];
    let why = '';
    if (!inTower(i, j, k)) why = j > TOWER.TOP ? '100층이 끝이야!' : '돌판 밖에는 못 놓아';
    else if (this.cells.has(cellKey(i, j, k))) why = '이미 블록이 있어';
    else if (this.mine >= TOWER.LIMIT) why = `블록은 ${TOWER.LIMIT}개까지야. 부수고 다시 놓아 봐`;
    else {
      const [x, y, z] = cellCenter(i, j, k), pl = this.game.player, h = TOWER.CELL / 2;
      if (Math.hypot(x - pl.x, y - (pl.y + 1.6), z - pl.z) > TOWER.REACH) why = '너무 멀어! 가까이 가서 놓아';
      else if (pl.x + P.R > x - h && pl.x - P.R < x + h && pl.z + P.R > z - h && pl.z - P.R < z + h && pl.y + P.H > y - h && pl.y < y + h) why = '내 자리에는 못 놓아';
    }
    return { i, j, k, ok: !why, why };
  }

  act(cx, cy, mode = this.mode) {
    if (this.cool > 0) return;
    const keep = this.mode;
    this.mode = mode;
    const tg = this.target(this.pick(cx, cy));
    this.mode = keep;
    if (!tg) return;
    if (!tg.ok) { if (tg.why) this.game.ui.toast(tg.why, 1600); this.game.sfx('nope'); return; }
    this.cool = TOWER.RATE;
    const net = this.game.net;
    if (mode === 'remove') {
      const c = this.remove(tg.key);
      if (!c) return;
      const [x, y, z] = cellCenter(c.i, c.j, c.k);
      this.game.effects.burst(x, y, z, [BLOCKS[c.t].c, '#ffffff'], 10, 5);
      this.game.sfx('crumble');
      net.send({ t: 'tw', a: 2, b: [c.i, c.j, c.k] });
    } else {
      if (!this.add(tg.i, tg.j, tg.k, this.type, 'me')) return;
      this.game.sfx('pop');
      net.send({ t: 'tw', a: 1, b: [tg.i, tg.j, tg.k, this.type] });
    }
    this.saveMine();
    this.updateInfo();
  }

  clearMine() {
    for (const [key, c] of [...this.cells]) if (c.owner === 'me') this.remove(key, false);
    this.redraw();
    this.saveMine();
    this.game.net.send({ t: 'tw', a: 3 });
    this.game.sfx('crumble');
    this.game.ui.toast('내 블록을 모두 치웠어');
    this.updateInfo();
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
  ready() { return this.game.started && !this.game.wardrobeOpen && this.game.player && !this.game.isDead(); }

  key(code) {
    if (code.startsWith('Digit')) {
      const n = Number(code.slice(5));
      this.select(n === 0 ? 9 : n - 1);
      return true;
    }
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
    bar.querySelector('.tip').textContent = matchMedia('(pointer: coarse)').matches ? '톡: 놓기 · 버튼으로 부수기 모드' : '클릭 놓기 · 오른쪽 클릭 부수기 · 숫자/Q E 고르기 · F 바꾸기';
    document.body.append(bar);
    this.bar = bar;
    this.select(0);
  }

  updateInfo() {
    const s = this.game.save.tower;
    const now = towerFloor(this.game.player.y);
    this.game.ui.setInfo(`<b>🏗️ 지금 ${now}층 · 최고 ${s.best}층</b><small>내 블록 ${this.mine}/${TOWER.LIMIT}</small>`);
  }

  update(dt) {
    this.cool -= dt;
    if (this.clearArmed > 0) { this.clearArmed -= dt; if (this.clearArmed <= 0) this.bar.querySelector('.clear').textContent = '🗑'; }
    // 처음 올라간 층마다 코인
    const pl = this.game.player, s = this.game.save.tower;
    if (pl.ground) {
      const floor = towerFloor(pl.y);
      if (floor > s.best) {
        const gain = floor - s.best;
        s.best = floor;
        this.game.addCoins(gain);
        if (floor % 5 === 0 || gain > 2) { this.game.ui.toast(`🏗️ ${floor}층 도착! 🪙+${gain}`); this.game.sfx('check'); } else this.game.sfx('coin');
        this.game.persist();
      }
    }
    // 미리 보기 (마우스)
    let tg = null;
    if (this.hover && this.ready()) tg = this.target(this.pick(this.hover.x, this.hover.y));
    if (tg) {
      const [x, y, z] = cellCenter(tg.i, tg.j, tg.k);
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
    this.ghost.removeFromParent();
    this.ghost.geometry.dispose(); this.ghostMat.dispose(); this.edges.geometry.dispose(); this.edges.material.dispose();
    this.game.ui.setInfo('');
  }
}
