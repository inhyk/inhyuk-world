// Instanced copies of a prototype (trees, rocks, grass...) split into map chunks, so whole chunks
// can be frustum-culled (also from the sun's shadow camera) and swapped to a cheap far version.
// With a far version (trees) each copy picks its own detail by its distance, and a chunk's detailed
// meshes hold only its near copies, packed: a big tree is ~20 000 triangles, the far one ~270.
import * as THREE from 'three';

const CHUNK = 64;
const HALF_DIAG = CHUNK * 0.71;
// trees switch to the far copy this much beyond `range`: chunks used to switch whole, so in practice
// trees showed full detail out to range + 30..90 m; one fixed distance keeps the look and drops the rest
const FAR_SLACK = 30;
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const tmp = new THREE.Matrix4();

function meshesOf(proto) {
  proto.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(proto.matrixWorld).invert();
  const out = [];
  proto.traverse((o) => {
    if (!o.isMesh) return;
    out.push({ geometry: o.geometry, material: o.material, local: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), cast: o.castShadow !== false });
  });
  return out;
}

export class Scatter {
  /**
   * proto: Object3D; opts.far: cheaper Object3D shown beyond opts.range metres; opts.maxRange:
   * nothing is drawn beyond it. opts.cast: shadows.
   */
  constructor(parent, proto, capacity = 1e6, { far = null, range = 150, maxRange = 900, cast = true, farCast = false } = {}) {
    this.parent = parent;
    this.near = meshesOf(proto);
    this.far = far ? meshesOf(far) : null;
    this.range = range;
    this.nearDist = far ? range + FAR_SLACK : range;
    this.maxRange = maxRange;
    this.cast = cast;
    this.farCast = farCast;
    this.capacity = capacity;
    this.items = [];
    this.chunks = new Map();
    this.done = false;
  }
  get count() { return this.items.length; }

  /** Add one copy (before or after finish); returns its index. */
  add(x, y, z, ry = 0, s = 1, sy = s) {
    if (this.items.length >= this.capacity) return -1;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(s, sy, s));
    const it = { matrix: m, visible: true, x, z, chunk: null, slot: -1, near: true };
    this.items.push(it);
    if (this.done) { this.rebuildChunk(this.chunkOf(it)); this.buildFar(); }
    return this.items.length - 1;
  }

  chunkOf(it) {
    const k = `${Math.floor(it.x / CHUNK)},${Math.floor(it.z / CHUNK)}`;
    if (!this.chunks.has(k)) this.chunks.set(k, { key: k, items: [], near: [], far: [], center: new THREE.Vector3((Math.floor(it.x / CHUNK) + 0.5) * CHUNK, 0, (Math.floor(it.z / CHUNK) + 0.5) * CHUNK) });
    const c = this.chunks.get(k);
    if (it.chunk !== c) { it.chunk = c; it.slot = c.items.length; c.items.push(it); }
    return c;
  }

  rebuildChunk(c) {
    for (const im of [...c.near, ...c.far]) { this.parent.remove(im); im.dispose(); }
    c.near = this.near.map((p) => {
      const im = new THREE.InstancedMesh(p.geometry, p.material, Math.max(1, c.items.length));
      im.castShadow = this.cast && p.cast; im.receiveShadow = true;
      im.userData.local = p.local;
      this.parent.add(im);
      return im;
    });
    c.far = [];
    c.isNear = null;
    c.packed = null;
    this.pack(c);
  }

  /**
   * Write the chunk's detailed copies: every copy (no far version) or only the near ones, packed in
   * front so the mesh draws just those (it.slot = place in the mesh, -1 = not in it).
   */
  pack(c) {
    let n = 0;
    for (const it of c.items) {
      // broken copies are left out too (a zero-scaled copy would stretch the bounds to the origin)
      if ((this.far && !it.near) || !it.visible) { it.slot = -1; continue; }
      it.slot = n;
      for (const im of c.near) im.setMatrixAt(n, tmp.multiplyMatrices(it.matrix, im.userData.local));
      n++;
    }
    for (const im of c.near) { im.count = n; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }
    c.nearCount = n;
  }

  buildFar() {
    if (!this.far) return;
    for (const im of this.farAll ?? []) { this.parent.remove(im); im.dispose(); }
    this.farAll = this.far.map((p) => {
      const im = new THREE.InstancedMesh(p.geometry, p.material, Math.max(1, this.items.length));
      im.castShadow = this.farCast && p.cast; im.receiveShadow = true;
      im.userData.local = p.local;
      im.count = 0;
      this.parent.add(im);
      return im;
    });
    this.farDirty = true;
  }

  /**
   * The far copies hold only the copies that show them, packed together: copies hidden by a zero
   * scale would still cost the GPU a vertex pass each (about a thousand trees).
   */
  refreshFar() {
    this.farDirty = false;
    if (!this.farAll) return;
    let n = 0;
    for (const c of this.chunks.values()) {
      if (!c.farShow) continue;
      for (const it of c.items) {
        if (!it.visible || it.near) continue;
        for (const im of this.farAll) im.setMatrixAt(n, tmp.multiplyMatrices(it.matrix, im.userData.local));
        n++;
      }
    }
    for (const im of this.farAll) { im.count = n; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }
  }

  finish() {
    for (const it of this.items) this.chunkOf(it);
    for (const c of this.chunks.values()) this.rebuildChunk(c);
    this.buildFar();
    this.done = true;
  }

  setMat(it, m) {
    const c = it.chunk;
    if (!c) return;
    if (it.slot >= 0) for (const im of c.near) { im.setMatrixAt(it.slot, m ? tmp.multiplyMatrices(m, im.userData.local) : ZERO); im.instanceMatrix.needsUpdate = true; }
    if (this.farAll && c.farShow && !it.near) this.farDirty = true;
  }
  setVisible(i, v) {
    const it = this.items[i];
    if (!it || it.visible === v) return;
    it.visible = v;
    if (!it.chunk) return;
    if (v) this.pack(it.chunk); // grown back: give it a place in the mesh again
    else this.setMat(it, null); // keeps its place until the next repack
    it.chunk.packed = false;
    if (this.farAll && !it.near) this.refreshFar();
  }
  /** Briefly squash one copy (breaking wobble); k = 0 restores it. */
  wobble(i, k) {
    const it = this.items[i];
    if (!it || !it.visible) return;
    this.setMat(it, k ? it.matrix.clone().multiply(new THREE.Matrix4().makeScale(1 + k, 1 - k * 0.6, 1 + k)) : it.matrix);
  }

  /** Near/far switching by distance to the camera (chunks, and copies when there is a far version). */
  update(cam) {
    const R = this.nearDist;
    for (const c of this.chunks.values()) {
      const dc = Math.hypot(c.center.x - cam.x, c.center.z - cam.z);
      const d = dc - CHUNK * 0.7;
      if (!this.far) {
        if (c.packed !== true) { c.packed = true; this.pack(c); }
        const near = d < this.range;
        if (c.isNear !== near) { c.isNear = near; for (const im of c.near) im.visible = near; }
        continue;
      }
      // per copy: near ones in the chunk's detailed meshes, the rest in the shared far meshes
      let changed = false;
      if (dc - HALF_DIAG > R) { if (c.nearCount) for (const it of c.items) { if (it.near) { it.near = false; changed = true; } } }
      else if (dc + HALF_DIAG < R) { for (const it of c.items) if (!it.near) { it.near = true; changed = true; } }
      else for (const it of c.items) { const n = Math.hypot(it.x - cam.x, it.z - cam.z) < R; if (n !== it.near) { it.near = n; changed = true; } }
      if (changed || c.packed !== true) { c.packed = true; this.pack(c); if (c.farShow) this.farDirty = true; }
      const has = c.nearCount > 0;
      if (c.isNear !== has) { c.isNear = has; for (const im of c.near) im.visible = has; }
      const farShow = d < this.maxRange && c.nearCount < c.items.length;
      if (c.farShow !== farShow) { c.farShow = farShow; this.farDirty = true; }
    }
    if (this.farDirty) this.refreshFar();
  }
}
