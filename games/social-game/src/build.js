// Minecraft-style breaking and placing of smooth (non-cube) blocks on a 1 m grid.
import * as THREE from 'three';
import { Colliders } from './collide.js';
import { snapCell } from '../core.mjs';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { texBusy, texReady } from './tex.js';

const REACH = 6;

/** Ray vs AABB → {t, n:[x,y,z]} or null. */
function rayBox(o, d, b, maxT) {
  let t0 = 0, t1 = maxT, axis = -1, sign = 0;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) { if (o[a] < b.min[a] || o[a] > b.max[a]) return null; continue; }
    let ta = (b.min[a] - o[a]) / d[a], tb = (b.max[a] - o[a]) / d[a], s = -1;
    if (ta > tb) { [ta, tb] = [tb, ta]; s = 1; }
    if (ta > t0) { t0 = ta; axis = a; sign = s; }
    t1 = Math.min(t1, tb);
    if (t0 > t1) return null;
  }
  if (axis < 0) return null; // started inside
  const n = [0, 0, 0]; n[axis] = sign;
  return { t: t0, n };
}

export class Build {
  constructor({ engine, colliders, groundAt, blocks, state, hud, sfx, isRoad }) {
    this.engine = engine;
    this.col = colliders;
    this.groundAt = groundAt;
    this.blocks = blocks;           // BLOCKS from props/blocks.js
    this.byId = Object.fromEntries(blocks.map((b) => [b.id, b]));
    this.state = state;
    this.hud = hud;
    this.sfx = sfx;
    this.isRoad = isRoad;
    this.pick = new Colliders(4);   // pickable boxes: blocks, breakable props, static surfaces
    this.placed = new Map();        // key → {id, x, y, z, rot, obj, box, col}
    this.root = new THREE.Group();
    this.root.name = 'blocks';
    engine.scene.add(this.root);
    this.slot = 0;
    this.rot = 0;
    this.progress = 0;
    this.target = null;
    this.enabled = true;
    this.protos = new Map();
    // highlight + ghost + chips
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    this.outline = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthTest: true }));
    this.outline.visible = false;
    engine.scene.add(this.outline);
    this.ghostMat = new THREE.MeshStandardMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0.38, depthWrite: false, emissive: 0x2a5a80, emissiveIntensity: 0.4 });
    this.badMat = new THREE.MeshStandardMaterial({ color: 0xff7a7a, transparent: true, opacity: 0.32, depthWrite: false, emissive: 0x802a2a, emissiveIntensity: 0.4 });
    this.ghost = null;
    this.ghostId = null;
    const chipGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
    this.chips = new THREE.InstancedMesh(chipGeo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), 120);
    this.chips.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(120 * 3), 3);
    this.chips.frustumCulled = false;
    this.chipData = [];
    for (let i = 0; i < 120; i++) this.chipData.push({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Vector3() });
    this.chipNext = 0;
    engine.scene.add(this.chips);
    this.onBreakProp = null;  // (entry) => void   world props (trees, shells...)
    this.onChange = null;     // () => void        save
    // shared town (src/town.js): null in solo play
    this.canBreak = null;     // (entry) => null | Korean reason it can't be broken
    this.onPlaced = null;     // (rec) => void      a block the player just placed
    this.onBlockBroken = null; // (rec) => void     a block the player just broke
    this.snapY = false;       // round y to the cell key (2 decimals) so every computer agrees
  }

  proto(id) {
    if (!this.protos.has(id)) this.protos.set(id, this.byId[id].build(7));
    return this.protos.get(id);
  }

  /** Static boxes the player can place blocks onto (walls, floors, furniture). */
  addStatic(box) { this.pick.add({ min: box.min, max: box.max, kind: 'static' }); }

  /** Breakable world prop: {min, max, item, count, hardness, name, scatter, index, key, color} */
  addProp(entry) { entry.kind = 'prop'; this.pick.add(entry); return entry; }
  removeProp(entry) { this.pick.remove(entry); if (entry.col) { this.col.remove(entry.col); } }

  key(x, y, z) { return `${x}|${y.toFixed(2)}|${z}`; }

  placeBlock(id, x, y, z, rot = 0, save = true) {
    const def = this.byId[id];
    if (!def) return null;
    if (this.snapY) y = Math.round(y * 100) / 100;
    const obj = this.proto(id).clone();
    obj.position.set(x, y, z);
    obj.rotation.y = rot * Math.PI / 2;
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.root.add(obj);
    const rec = { id, x, y, z, rot, obj };
    rec.box = this.pick.add({ min: [x - 0.5, y, z - 0.5], max: [x + 0.5, y + 1, z + 0.5], kind: 'block', rec });
    if (def.solid !== false) rec.col = this.col.add({ min: [x - 0.5, y, z - 0.5], max: [x + 0.5, y + 1, z + 0.5], tag: 'block' });
    this.placed.set(this.key(x, y, z), rec);
    if (id === 'lamp') this.onLamp?.(rec, true);
    if (save) this.onChange?.();
    return rec;
  }

  removeBlock(rec, save = true) {
    this.root.remove(rec.obj);
    this.pick.remove(rec.box);
    if (rec.col) this.col.remove(rec.col);
    this.placed.delete(this.key(rec.x, rec.y, rec.z));
    if (rec.id === 'lamp') this.onLamp?.(rec, false);
    if (save) this.onChange?.();
  }

  /** Serializable list for the save. */
  dump() { return [...this.placed.values()].map(({ id, x, y, z, rot }) => ({ id, x, y, z, rot })); }

  raycast() {
    const cam = this.engine.camera;
    const o = cam.position.toArray();
    const dv = new THREE.Vector3(); cam.getWorldDirection(dv);
    const d = dv.toArray();
    let best = null;
    const ex = o[0] + d[0] * REACH, ez = o[2] + d[2] * REACH;
    const list = this.pick.query(Math.min(o[0], ex) - 0.5, Math.min(o[2], ez) - 0.5, Math.max(o[0], ex) + 0.5, Math.max(o[2], ez) + 0.5);
    for (const b of list) {
      const h = rayBox(o, d, b, REACH);
      if (h && (!best || h.t < best.t)) best = { ...h, entry: b };
    }
    // movement colliders count as surfaces too (walls, floors, furniture), but are not breakable
    const list2 = this.col.query(Math.min(o[0], ex) - 0.5, Math.min(o[2], ez) - 0.5, Math.max(o[0], ex) + 0.5, Math.max(o[2], ez) + 0.5);
    for (const b of list2) {
      if (b.tag === 'block' || b.tag === 'car') continue;
      const h = rayBox(o, d, b, REACH);
      if (h && (!best || h.t < best.t - 1e-4)) best = { ...h, entry: { kind: 'static', min: b.min, max: b.max } };
    }
    // terrain by marching
    const maxT = best ? best.t : REACH;
    let prev = 0;
    for (let t = 0.2; t <= maxT; t += 0.15) {
      const y = o[1] + d[1] * t;
      if (y < this.groundAt(o[0] + d[0] * t, o[2] + d[2] * t)) {
        let lo = prev, hi = t;
        for (let k = 0; k < 8; k++) { const m = (lo + hi) / 2; if (o[1] + d[1] * m < this.groundAt(o[0] + d[0] * m, o[2] + d[2] * m)) hi = m; else lo = m; }
        best = { t: hi, n: [0, 1, 0], entry: { kind: 'ground' } };
        break;
      }
      prev = t;
    }
    if (!best) return null;
    best.point = [o[0] + d[0] * best.t, o[1] + d[1] * best.t, o[2] + d[2] * best.t];
    return best;
  }

  /** Where a new block would go for this hit. */
  cellFor(hit) {
    const [px, py, pz] = hit.point, n = hit.n, e = hit.entry;
    if (e.kind === 'block') { const r = e.rec; return { x: r.x + n[0], y: r.y + n[1], z: r.z + n[2] }; }
    if (n[1] > 0.5) { const c = snapCell(px, py, pz); return { x: c.x, y: e.kind === 'ground' ? this.groundAt(c.x, c.z) - 0.04 : py, z: c.z }; }
    if (n[1] < -0.5) return null;
    const c = snapCell(px + n[0] * 0.5, py, pz + n[2] * 0.5);
    const g = this.groundAt(c.x, c.z);
    return { x: c.x, y: py - g < 1.1 ? g - 0.04 : Math.floor(py - g) + g, z: c.z };
  }

  valid(cell, playerPos) {
    if (!cell) return '여기엔 못 놓아요';
    const { x, y, z } = cell;
    if (this.placed.has(this.key(x, y, z))) return '이미 블럭이 있어요';
    if (this.isRoad?.(x, z)) return '도로에는 못 놓아요';
    const pp = playerPos;
    if (pp && Math.abs(pp.x - x) < 0.8 && Math.abs(pp.z - z) < 0.8 && pp.y < y + 1 && pp.y + 1.75 > y) return '내 자리에는 못 놓아요';
    const list = this.col.query(x - 0.48, z - 0.48, x + 0.48, z + 0.48);
    for (const b of list) if (b.max[1] > y + 0.05 && b.min[1] < y + 0.95) return '자리가 없어요';
    return null;
  }

  ensureGhost(id) {
    if (this.ghostId === id) return;
    if (this.ghost) this.engine.scene.remove(this.ghost);
    this.ghostId = id;
    this.ghost = this.proto(id).clone();
    this.ghost.traverse((o) => { if (o.isMesh) { o.material = this.ghostMat; o.castShadow = false; o.receiveShadow = false; } });
    this.engine.scene.add(this.ghost);
  }

  burst(pos, color, n = 14) {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const i = this.chipNext; this.chipNext = (this.chipNext + 1) % this.chipData.length;
      const ch = this.chipData[i];
      ch.life = 0.9 + Math.random() * 0.5;
      ch.p.set(pos[0] + (Math.random() - 0.5) * 0.6, pos[1] + Math.random() * 0.6, pos[2] + (Math.random() - 0.5) * 0.6);
      ch.v.set((Math.random() - 0.5) * 3.5, 2 + Math.random() * 3, (Math.random() - 0.5) * 3.5);
      ch.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      const t = 0.75 + Math.random() * 0.35;
      this.chips.setColorAt(i, new THREE.Color(c.r * t, c.g * t, c.b * t));
    }
    this.chips.instanceColor.needsUpdate = true;
  }

  updateChips(dt) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
    for (let i = 0; i < this.chipData.length; i++) {
      const ch = this.chipData[i];
      if (ch.life <= 0) { m.makeScale(0, 0, 0); this.chips.setMatrixAt(i, m); continue; }
      ch.life -= dt;
      ch.v.y -= 14 * dt;
      ch.p.addScaledVector(ch.v, dt);
      const g = this.groundAt(ch.p.x, ch.p.z);
      if (ch.p.y < g + 0.035) { ch.p.y = g + 0.035; ch.v.multiplyScalar(0.4); ch.v.y = Math.abs(ch.v.y) * 0.3; }
      e.set(ch.r.x * ch.life, ch.r.y * ch.life, ch.r.z); q.setFromEuler(e);
      const k = Math.min(1, ch.life * 3);
      s.set(k, k, k);
      m.compose(ch.p, q, s);
      this.chips.setMatrixAt(i, m);
    }
    this.chips.instanceMatrix.needsUpdate = true;
  }

  selectedId() { return this.blocks[this.slot]?.id; }

  update(dt, input, playerPos) {
    this.updateChips(dt);
    const inv = this.state.inventory;
    if (input.mouse.wheel) this.select((this.slot + input.mouse.wheel + 9) % 9);
    for (let k = 1; k <= 9; k++) if (input.hit('Digit' + k)) this.select(k - 1);
    if (input.hit('KeyR')) this.rot = (this.rot + 1) % 4;
    if (!this.enabled) { this.outline.visible = false; if (this.ghost) this.ghost.visible = false; this.progress = 0; return; }
    const hit = this.raycast();
    this.target = hit;
    const e = hit?.entry;
    // outline on breakable things
    if (e && (e.kind === 'block' || e.kind === 'prop')) {
      this.outline.visible = true;
      this.outline.position.set((e.min[0] + e.max[0]) / 2, (e.min[1] + e.max[1]) / 2, (e.min[2] + e.max[2]) / 2);
      this.outline.scale.set(e.max[0] - e.min[0] + 0.02, e.max[1] - e.min[1] + 0.02, e.max[2] - e.min[2] + 0.02);
    } else this.outline.visible = false;
    // breaking (in the shared town some things belong to someone else)
    const no = input.mouse.left && e && (e.kind === 'block' || e.kind === 'prop') ? this.canBreak?.(e) : null;
    if (no) {
      this._noT = (this._noT ?? 0) - dt;
      if (input.mouse.leftPressed || this._noFor !== e || this._noT <= 0) { this._noFor = e; this._noT = 1.5; this.hud.toast(no, 1600); }
    } else this._noFor = null;
    if (input.mouse.left && e && (e.kind === 'block' || e.kind === 'prop') && !no) {
      if (this.breaking !== e) { this.breaking = e; this.progress = 0; }
      const hard = e.kind === 'block' ? (this.byId[e.rec.id].hardness ?? 1) : (e.hardness ?? 1);
      this.progress += dt / hard;
      this.swing = 1;
      const pos = [(e.min[0] + e.max[0]) / 2, e.min[1] + 0.2, (e.min[2] + e.max[2]) / 2];
      this._chipT = (this._chipT ?? 0) - dt;
      if (this._chipT <= 0) { this._chipT = 0.22; this.burst(pos, e.kind === 'block' ? this.byId[e.rec.id].color : e.color ?? 0x7a6a50, 3); this.sfx?.('hit'); }
      if (e.kind === 'block') { const w = Math.sin(this.progress * 40) * 0.03; e.rec.obj.scale.set(1 + w, 1 - w, 1 + w); }
      else e.scatter?.wobble(e.index, Math.sin(this.progress * 40) * 0.04);
      if (this.progress >= 1) {
        this.progress = 0; this.breaking = null;
        if (e.kind === 'block') {
          const id = e.rec.id;
          this.burst(pos, this.byId[id].color, 18);
          this.removeBlock(e.rec);
          inv[id] = (inv[id] ?? 0) + 1;
          this.hud.toast(`${this.byId[id].name} +1`, 1200);
          this.onBlockBroken?.(e.rec);
        } else {
          this.burst(pos, e.color ?? 0x7a6a50, 22);
          e.scatter?.setVisible(e.index, false);
          this.removeProp(e);
          this.onBreakProp?.(e);
        }
        this.sfx?.('break');
        this.renderHotbar();
      }
    } else {
      if (this.breaking) {
        if (this.breaking.kind === 'block') this.breaking.rec.obj.scale.set(1, 1, 1);
        else this.breaking.scatter?.wobble(this.breaking.index, 0);
      }
      this.breaking = null; this.progress = 0;
      if (input.mouse.leftPressed && e && e.kind === 'static') this.hud.toast('이건 못 부숴요', 900);
    }
    // ghost + placing
    const id = this.selectedId();
    const cell = hit && id ? this.cellFor(hit) : null;
    const why = cell ? this.valid(cell, playerPos) : 'no';
    if (id && cell && (inv[id] ?? 0) > 0 && !input.mouse.left) {
      this.ensureGhost(id);
      this.ghost.visible = true;
      this.ghost.position.set(cell.x, cell.y, cell.z);
      this.ghost.rotation.y = this.rot * Math.PI / 2;
      const mt = why ? this.badMat : this.ghostMat;
      this.ghost.traverse((o) => { if (o.isMesh) o.material = mt; });
    } else if (this.ghost) this.ghost.visible = false;
    if (input.mouse.rightPressed && id) {
      if ((inv[id] ?? 0) <= 0) this.hud.toast(`${this.byId[id].name}이(가) 없어요. 부숴서 모아요!`, 1500);
      else if (why && why !== 'no') this.hud.toast(why, 1000);
      else if (cell) {
        const rec = this.placeBlock(id, cell.x, cell.y, cell.z, this.rot);
        inv[id]--;
        if (rec) this.onPlaced?.(rec);
        this.swing = 1;
        this.sfx?.('place');
        this.renderHotbar();
      }
    }
  }

  select(i) {
    this.slot = i;
    this.renderHotbar();
    const b = this.blocks[i];
    if (b) this.hud.toast(`${b.name} (${this.state.inventory[b.id] ?? 0}개)`, 900);
  }

  /** Small rendered pictures of every block for the hotbar. */
  makeIcons() {
    // the block textures are made by workers: draw the pictures once they are there
    for (const b of this.blocks) this.proto(b.id);
    if (texBusy()) { this.icons = {}; texReady().then(() => { this.icons = null; this.renderHotbar(); }); return; }
    const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.setSize(96, 96);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.AgXToneMapping;
    const sc = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r);
    sc.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    const sun = new THREE.DirectionalLight(0xffffff, 2.5); sun.position.set(2, 4, 3); sc.add(sun);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    cam.position.set(2.3, 2.0, 2.6); cam.lookAt(0, 0.45, 0);
    this.icons = {};
    for (const b of this.blocks) {
      const o = this.proto(b.id).clone();
      sc.add(o);
      r.render(sc, cam);
      this.icons[b.id] = r.domElement.toDataURL();
      sc.remove(o);
    }
    pm.dispose(); r.dispose(); r.forceContextLoss?.();
  }

  renderHotbar() {
    const el = this.hud.hotbar;
    if (!this.icons) this.makeIcons();
    el.innerHTML = '';
    this.blocks.forEach((b, i) => {
      const n = this.state.inventory[b.id] ?? 0;
      const d = document.createElement('div');
      d.className = 'slot' + (i === this.slot ? ' sel' : '') + (n <= 0 ? ' empty' : '');
      d.title = b.name;
      d.innerHTML = `<span class="k">${i + 1}</span>${this.icons[b.id] ? `<img alt="${b.name}" src="${this.icons[b.id]}">` : ''}<span class="n">${n}</span>`;
      el.appendChild(d);
    });
  }
}
