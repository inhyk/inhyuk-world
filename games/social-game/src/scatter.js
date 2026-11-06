// Instanced copies of a prototype (trees, rocks, grass...) split into map chunks, so whole chunks
// can be frustum-culled (also from the sun's shadow camera) and swapped to a cheap far version.
// Each copy picks its own detail by its distance to the camera: a chunk's meshes hold only its near
// copies, packed in front (a big tree is ~20 000 triangles, its far version ~270), and only the
// nearest of them cast sun shadows (the shadow box reaches ~42 m around the player).
import * as THREE from 'three';

const CHUNK = 128;
const HALF_DIAG = CHUNK * 0.71;
// copies used to be shown or hidden by whole 64 m chunks, so in practice they stayed detailed out to
// range + 30..90 m: these slacks keep that look with one fixed distance per copy
const FAR_SLACK = 30, SLACK = 45;
const SHADOW_R = 70, SMALL_SHADOW_R = 35; // casters farther than this cannot reach the visible shadow
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
    this.nearDist = range + (far ? FAR_SLACK : SLACK);
    this.shadowDist = Math.min(this.nearDist, far || range >= 70 ? SHADOW_R : SMALL_SHADOW_R);
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
    const it = { matrix: m, visible: true, x, z, chunk: null, slot: -1, near: false, cast: false };
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
    c.nearCount = 0;
    c.shadowCount = 0;
    c.near = this.near.map((p) => {
      const im = new THREE.InstancedMesh(p.geometry, p.material, Math.max(1, c.items.length));
      im.castShadow = this.cast && p.cast; im.receiveShadow = true;
      im.userData.local = p.local;
      im.count = 0;
      im.visible = false;
      // the sun's shadow pass draws only the first shadowCount copies (the nearest, packed first)
      im.onBeforeShadow = () => { im.count = c.shadowCount; };
      im.onAfterShadow = () => { im.count = c.nearCount; };
      this.parent.add(im);
      return im;
    });
    c.far = [];
    c.packed = false;
  }

  /**
   * Write the chunk's detailed copies: shadow casters first, then the other near ones (it.slot =
   * place in the mesh, -1 = not in it). Broken copies are left out.
   */
  pack(c) {
    let n = 0;
    const put = (it) => {
      it.slot = n;
      for (const im of c.near) im.setMatrixAt(n, tmp.multiplyMatrices(it.matrix, im.userData.local));
      n++;
    };
    for (const it of c.items) { it.slot = -1; if (it.visible && it.near && it.cast) put(it); }
    c.shadowCount = n;
    for (const it of c.items) if (it.visible && it.near && !it.cast) put(it);
    c.nearCount = n;
    for (const im of c.near) {
      im.count = n;
      im.visible = n > 0;
      if (n) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }
    }
    c.packed = true;
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
  }
  setVisible(i, v) {
    const it = this.items[i];
    if (!it || it.visible === v) return;
    it.visible = v;
    if (!it.chunk) return;
    if (v) this.pack(it.chunk); // grown back: give it a place in the mesh again
    else { this.setMat(it, null); it.chunk.packed = false; } // keeps its place until the next repack
    if (this.farAll && !it.near) this.refreshFar();
  }
  /** Briefly squash one copy (breaking wobble); k = 0 restores it. */
  wobble(i, k) {
    const it = this.items[i];
    if (!it || !it.visible) return;
    this.setMat(it, k ? it.matrix.clone().multiply(new THREE.Matrix4().makeScale(1 + k, 1 - k * 0.6, 1 + k)) : it.matrix);
  }

  /** Near/far (and shadow) choice for every copy by its distance to the camera. */
  update(cam) {
    const R = this.nearDist, S = this.shadowDist;
    for (const c of this.chunks.values()) {
      const dc = Math.hypot(c.center.x - cam.x, c.center.z - cam.z);
      let changed = !c.packed;
      if (dc - HALF_DIAG > R) {
        if (c.nearCount || !c.packed) for (const it of c.items) { if (it.near) changed = true; it.near = it.cast = false; }
      } else {
        for (const it of c.items) {
          const d = Math.hypot(it.x - cam.x, it.z - cam.z);
          const near = d < R, cast = d < S;
          if (near !== it.near || cast !== it.cast) { it.near = near; it.cast = cast; changed = true; }
        }
      }
      if (changed) { this.pack(c); if (this.far) this.farDirty = true; }
      if (this.far) {
        const farShow = dc - HALF_DIAG < this.maxRange && c.nearCount < c.items.length;
        if (c.farShow !== farShow) { c.farShow = farShow; this.farDirty = true; }
      }
    }
    if (this.farDirty) this.refreshFar();
  }
}
