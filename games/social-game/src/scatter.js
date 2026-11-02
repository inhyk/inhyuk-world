// Instanced copies of a prototype (trees, rocks, grass...) split into map chunks, so whole chunks
// can be frustum-culled (also from the sun's shadow camera) and swapped to a cheap far version.
import * as THREE from 'three';

const CHUNK = 64;

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
    const it = { matrix: m, visible: true, x, z, chunk: null, slot: -1 };
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
    const make = (list, cast) => list.map((p) => {
      const im = new THREE.InstancedMesh(p.geometry, p.material, c.items.length);
      im.castShadow = cast && p.cast; im.receiveShadow = true;
      im.userData.local = p.local;
      c.items.forEach((it, i) => im.setMatrixAt(i, it.visible ? new THREE.Matrix4().multiplyMatrices(it.matrix, p.local) : new THREE.Matrix4().makeScale(0, 0, 0)));
      im.computeBoundingSphere();
      this.parent.add(im);
      return im;
    });
    c.near = make(this.near, this.cast);
    c.far = [];
    c.isNear = null;
  }

  buildFar() {
    if (!this.far) return;
    for (const im of this.farAll ?? []) { this.parent.remove(im); im.dispose(); }
    this.farAll = this.far.map((p) => {
      const im = new THREE.InstancedMesh(p.geometry, p.material, Math.max(1, this.items.length));
      im.castShadow = this.farCast && p.cast; im.receiveShadow = true;
      im.userData.local = p.local;
      this.items.forEach((it, i) => im.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)));
      im.count = this.items.length;
      this.parent.add(im);
      return im;
    });
  }

  /** Show or hide the far copies of one chunk's items. */
  farChunk(c, show) {
    if (!this.farAll) return;
    const z = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const it of c.items) {
      const i = this.items.indexOf(it);
      for (const im of this.farAll) im.setMatrixAt(i, show && it.visible ? new THREE.Matrix4().multiplyMatrices(it.matrix, im.userData.local) : z);
    }
    for (const im of this.farAll) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }
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
    for (const im of c.near) { im.setMatrixAt(it.slot, m ? new THREE.Matrix4().multiplyMatrices(m, im.userData.local) : new THREE.Matrix4().makeScale(0, 0, 0)); im.instanceMatrix.needsUpdate = true; }
    if (this.farAll && c.isNear === false) {
      const i = this.items.indexOf(it);
      for (const im of this.farAll) { im.setMatrixAt(i, m ? new THREE.Matrix4().multiplyMatrices(m, im.userData.local) : new THREE.Matrix4().makeScale(0, 0, 0)); im.instanceMatrix.needsUpdate = true; }
    }
  }
  setVisible(i, v) {
    const it = this.items[i];
    if (!it || it.visible === v) return;
    it.visible = v;
    this.setMat(it, v ? it.matrix : null);
  }
  /** Briefly squash one copy (breaking wobble); k = 0 restores it. */
  wobble(i, k) {
    const it = this.items[i];
    if (!it || !it.visible) return;
    this.setMat(it, k ? it.matrix.clone().multiply(new THREE.Matrix4().makeScale(1 + k, 1 - k * 0.6, 1 + k)) : it.matrix);
  }

  /** Near/far switching by distance to the camera. */
  update(cam) {
    for (const c of this.chunks.values()) {
      const d = Math.hypot(c.center.x - cam.x, c.center.z - cam.z) - CHUNK * 0.7;
      const near = d < this.range;
      for (const im of c.near) im.visible = near;
      if (c.isNear !== near) { c.isNear = near; this.farChunk(c, !near && d < this.maxRange); }
    }
  }
}
