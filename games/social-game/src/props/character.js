// People. One skeleton, six skinned meshes (skin, hair, face, top, bottom, shoes) with vertex colours
// for small accents, so a person costs about 6 draw calls. Origin at the feet, faces -Z, ~1.72 m.
// Procedural animation: walk/run cycle, idle breathing and blinking, sit/type/eat/drive, wave.
import * as THREE from 'three';
import { mergeVertices, toCreasedNormals, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paint, textured, mat } from '../mat.js';
import { canvasTex } from '../tex.js';
import { prep } from '../geom.js';
import { rng } from '../noise.js';

const PI = Math.PI;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const col = (h) => new THREE.Color(h);

// ------------------------------------------------------------------------------------------ skeleton
// bind pose: relaxed A-pose. Joint positions in character space (metres).
const J = {
  hips: V(0, 0.93, 0), spine: V(0, 1.03, 0), chest: V(0, 1.2, 0), neck: V(0, 1.4, 0), head: V(0, 1.47, 0),
  eyeL: V(-0.045, 1.562, -0.1), eyeR: V(0.045, 1.562, -0.1),
  shoulderL: V(-0.185, 1.355, 0.005), elbowL: V(-0.225, 1.085, 0.01), handL: V(-0.25, 0.845, 0.0),
  shoulderR: V(0.185, 1.355, 0.005), elbowR: V(0.225, 1.085, 0.01), handR: V(0.25, 0.845, 0.0),
  thighL: V(-0.092, 0.9, 0.005), kneeL: V(-0.096, 0.5, 0.0), footL: V(-0.1, 0.085, 0.02),
  thighR: V(0.092, 0.9, 0.005), kneeR: V(0.096, 0.5, 0.0), footR: V(0.1, 0.085, 0.02),
};
const PARENT = {
  hips: null, spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', eyeL: 'head', eyeR: 'head',
  shoulderL: 'chest', elbowL: 'shoulderL', handL: 'elbowL', shoulderR: 'chest', elbowR: 'shoulderR', handR: 'elbowR',
  thighL: 'hips', kneeL: 'thighL', footL: 'kneeL', thighR: 'hips', kneeR: 'thighR', footR: 'kneeR',
};
const BONES = Object.keys(J);
const BI = Object.fromEntries(BONES.map((n, i) => [n, i]));
const HEAD_C = V(0, 1.572, -0.005); // head centre

function makeSkeleton() {
  const bones = {};
  for (const n of BONES) { const b = new THREE.Bone(); b.name = n; bones[n] = b; }
  for (const n of BONES) {
    const p = PARENT[n];
    if (p) { bones[p].add(bones[n]); bones[n].position.copy(J[n]).sub(J[p]); } else bones[n].position.copy(J[n]);
  }
  return bones;
}

// ------------------------------------------------------------------------------------------ geometry chunks
/** A bucket gathers geometry chunks (bind pose, character space) for one skinned mesh. */
class Bucket {
  constructor() { this.parts = []; }
  /** add(geo, bone, color, blend) – blend: [{bone, from: Vector3 joint, dir: Vector3, width}] weight ramps. */
  add(geo, bone, color = 0xffffff, blend = null) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    g = prep(g, !!g.attributes.uv && g.userData?.keepUV);
    const n = g.attributes.position.count;
    const c = col(color), cs = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { cs[i * 3] = c.r; cs[i * 3 + 1] = c.g; cs[i * 3 + 2] = c.b; }
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    const p = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      si[i * 4] = BI[bone]; sw[i * 4] = 1;
      if (blend) {
        p.fromBufferAttribute(g.attributes.position, i);
        let k = 1;
        for (const b of blend) {
          const t = p.clone().sub(b.from).dot(b.dir) / b.width;
          const w = sstep(-1, 1, t) * (b.max ?? 1);
          if (w > 0.001 && k < 4) { si[i * 4 + k] = BI[b.bone]; sw[i * 4 + k] = w; k++; }
        }
        let tot = 0; for (let j = 1; j < k; j++) tot += sw[i * 4 + j];
        if (tot > 1) for (let j = 1; j < k; j++) sw[i * 4 + j] /= tot;
        sw[i * 4] = Math.max(0, 1 - Math.min(1, tot));
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(cs, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    this.parts.push(g);
    return g;
  }
  /** Tint vertices by a function of position (blush, gradients). */
  build() {
    if (!this.parts.length) return null;
    const keys = ['position', 'normal', 'uv', 'color', 'skinIndex', 'skinWeight'];
    const total = this.parts.reduce((s, g) => s + g.attributes.position.count, 0);
    const out = new THREE.BufferGeometry();
    for (const k of keys) {
      const proto = this.parts[0].attributes[k];
      const arr = new proto.array.constructor(total * proto.itemSize);
      let o = 0;
      for (const g of this.parts) { arr.set(g.attributes[k].array, o); o += g.attributes[k].array.length; }
      out.setAttribute(k, new THREE.BufferAttribute(arr, proto.itemSize));
    }
    return out;
  }
}

// ------------------------------------------------------------------------------------------ caches
// Making a person used to take ~22 ms, most of it rebuilding the same shapes. Shapes that do not
// depend on the person are made once and copied; finished bucket parts are shared (Bucket.build
// only reads them).
const shapeCache = new Map();
/** memo(key, make) → a copy of the geometry make() returned the first time for this key. */
function memo(key, make) {
  let g = shapeCache.get(key);
  if (!g) { g = make(); shapeCache.set(key, g); }
  return g.clone();
}
const partCache = new Map();
/** Run build() once per key, recording the parts it adds to `buckets`; later calls replay them. */
function cachedParts(key, buckets, build) {
  let rec = partCache.get(key);
  if (!rec) {
    const marks = buckets.map((b) => b.parts.length);
    build();
    rec = buckets.map((b, i) => b.parts.slice(marks[i]));
    partCache.set(key, rec);
    return;
  }
  buckets.forEach((b, i) => b.parts.push(...rec[i]));
}
const geoCache = new Map();
const sharedGeo = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };
const vkey = (v) => `${v.x.toFixed(5)},${v.y.toFixed(5)},${v.z.toFixed(5)}`;

/** Lathe profile [[r, y]] around +Y, smooth; optional depth scale (zs) and front flattening. */
function latheGeo(pts, seg = 20, zs = 1, xs = 1) {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), seg);
  g.scale(xs, 1, zs);
  return smooth(g);
}
function smooth(g, crease = 1.2) {
  g.deleteAttribute('normal');
  if (g.attributes.uv) g.deleteAttribute('uv');
  let m = mergeVertices(g, 1e-5);
  m = toCreasedNormals(m, crease);
  return m;
}
/** Place a +Y-built geometry so its y = 0 sits at `a` and +Y points at `b`. */
function along(g, a, b) {
  const d = b.clone().sub(a);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  return g;
}
/** Tapered limb tube from a to b: radii r0 → r1, profile bulge, rounded ends. */
function limb(a, b, r0, r1, opts = {}) {
  if (opts.rnd) return limbGeo(a, b, r0, r1, opts);
  const { seg = 18, bulge = 0.08, zs = 1, capA = true, capB = true, folds = 0 } = opts;
  return memo(`limb|${vkey(a)}|${vkey(b)}|${r0}|${r1}|${seg}|${bulge}|${zs}|${capA}|${capB}|${folds}`, () => limbGeo(a, b, r0, r1, opts));
}
function limbGeo(a, b, r0, r1, { seg = 18, bulge = 0.08, zs = 1, capA = true, capB = true, folds = 0, rnd = null } = {}) {
  const L = a.distanceTo(b);
  const pts = [];
  seg = Math.max(8, Math.round(seg * 0.8));
  if (capA) for (let i = 0; i <= 3; i++) { const t = i / 3, ang = -PI / 2 + t * PI / 2; pts.push([r0 * Math.cos(ang), r0 * 0.6 * Math.sin(ang)]); }
  const N = folds ? 10 : 7;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    let r = lerp(r0, r1, t) * (1 + bulge * Math.sin(t * PI));
    if (folds) r *= 1 + folds * 0.5 * (Math.sin(t * 31 + (rnd ? rnd() * 6 : 0)) * sstep(0.55, 0.9, t));
    pts.push([r, t * L]);
  }
  if (capB) for (let i = 1; i <= 3; i++) { const ang = (i / 3) * PI / 2; pts.push([r1 * Math.cos(ang), L + r1 * 0.6 * Math.sin(ang)]); }
  const g = latheGeo(pts, seg, zs);
  return along(g, a, b);
}
function ellipsoid(rx, ry, rz, ws = 20, hs = 14) { const g = new THREE.SphereGeometry(1, ws, hs); g.scale(rx, ry, rz); return g; }
function tubeAlong(points, r, seg = 16, rs = 6) {
  const c = new THREE.CatmullRomCurve3(points);
  const g = new THREE.TubeGeometry(c, seg, r, rs, false);
  // round end caps
  const caps = [c.getPoint(0), c.getPoint(1)].map((p) => { const s = new THREE.SphereGeometry(r, rs, Math.max(3, rs / 2)); s.translate(p.x, p.y, p.z); return s.toNonIndexed(); });
  const parts = [g.toNonIndexed(), ...caps];
  for (const p of parts) { p.deleteAttribute('uv'); }
  return mergeList(parts);
}
function mergeList(list) {
  const out = list.map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); if (!n.attributes.normal) n.computeVertexNormals(); return n; });
  const total = out.reduce((s, g) => s + g.attributes.position.count, 0);
  const P = new Float32Array(total * 3), N = new Float32Array(total * 3);
  let o = 0;
  for (const g of out) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.BufferAttribute(P, 3));
  r.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  return r;
}
/**
 * Smooth closed body from horizontal superellipse sections [[y, halfWidth, halfDepth, n, zOffset]],
 * bottom to top, both ends capped with soft domes. Used for torso and pelvis.
 */
function bodyLoft(sec, M = 32, dome = 0.5) {
  const rows = [];
  const ring = (y, w, d, n, zo) => { const r = []; for (let k = 0; k < M; k++) { const a = (k / M) * PI * 2, c = Math.cos(a), s2 = Math.sin(a); r.push([w * Math.sign(c) * Math.abs(c) ** (2 / n), y, zo + d * Math.sign(s2) * Math.abs(s2) ** (2 / n)]); } return r; };
  // densify between sections with a smooth (Catmull-Rom) interpolation of the parameters
  const P = (i) => sec[clamp(i, 0, sec.length - 1)];
  const cr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  const first = sec[0], last = sec[sec.length - 1];
  for (let k = 1; k <= 3; k++) { const t = k / 4; rows.push(ring(first[0] - (1 - Math.sin(t * PI / 2)) * dome * 0.04, first[1] * Math.sin(t * PI / 2) ** 0.6, first[2] * Math.sin(t * PI / 2) ** 0.6, first[3], first[4] ?? 0)); }
  for (let i = 0; i < sec.length - 1; i++) {
    for (let k = 0; k < 4; k++) {
      const t = k / 4, v = [0, 1, 2, 3, 4].map((j) => cr(P(i - 1)[j] ?? 0, P(i)[j] ?? 0, P(i + 1)[j] ?? 0, P(i + 2)[j] ?? 0, t));
      rows.push(ring(v[0], v[1], v[2], v[3], v[4]));
    }
  }
  rows.push(ring(last[0], last[1], last[2], last[3], last[4] ?? 0));
  for (let k = 3; k >= 1; k--) { const t = k / 4; rows.push(ring(last[0] + (1 - Math.sin(t * PI / 2)) * dome * 0.03, last[1] * Math.sin(t * PI / 2) ** 0.6, last[2] * Math.sin(t * PI / 2) ** 0.6, last[3], last[4] ?? 0)); }
  const pos = [], idx = [];
  const bot = [0, first[0] - dome * 0.04, first[4] ?? 0], top = [0, last[0] + dome * 0.03, last[4] ?? 0];
  pos.push(...bot);
  for (const r of rows) for (const p of r) pos.push(...p);
  pos.push(...top);
  const nr = rows.length, ti = 1 + nr * M;
  for (let k = 0; k < M; k++) idx.push(0, 1 + (k + 1) % M, 1 + k);
  for (let i = 0; i < nr - 1; i++) for (let k = 0; k < M; k++) {
    const a = 1 + i * M + k, b = 1 + i * M + (k + 1) % M, c = 1 + (i + 1) * M + (k + 1) % M, d = 1 + (i + 1) * M + k;
    idx.push(a, b, c, a, c, d);
  }
  for (let k = 0; k < M; k++) idx.push(ti, 1 + (nr - 1) * M + k, 1 + (nr - 1) * M + (k + 1) % M);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** Thin rounded flat piece from a 2D outline, extruded `depth`, bevelled. */
function plate(shape, depth, bevel = 0.004) {
  const j = shape.toJSON();
  return memo(`plate|${depth}|${bevel}|${JSON.stringify([j.curves, j.holes])}`, () => plateGeo(shape, depth, bevel));
}
function plateGeo(shape, depth, bevel) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 8 });
  return smooth(g, 0.9);
}
/** Push vertices of a geometry out along their normals by fn(p) (organic folds / volume). */
function bump(g, fn) {
  const c = g.clone();
  if (c.attributes.uv) c.deleteAttribute('uv');
  if (c.attributes.normal) c.deleteAttribute('normal');
  const m = mergeVertices(c, 1e-5);
  m.computeVertexNormals();
  const p = m.attributes.position, n = m.attributes.normal, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d = fn(v);
    p.setXYZ(i, v.x + n.getX(i) * d, v.y + n.getY(i) * d, v.z + n.getZ(i) * d);
  }
  m.computeVertexNormals();
  return m;
}
/** Point on the head ellipsoid in a direction given by yaw (0 = straight ahead -Z, + = character's left?) and pitch. */
const HEAD_S = V(0.118, 0.13, 0.122);
function headPoint(yaw, pitch, out = 0) {
  const d = V(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  const p = V(d.x * HEAD_S.x, d.y * HEAD_S.y, d.z * HEAD_S.z);
  const n = V(d.x / HEAD_S.x, d.y / HEAD_S.y, d.z / HEAD_S.z).normalize();
  p.addScaledVector(n, out).add(HEAD_C);
  return { p, n };
}
function orientTo(g, n, p) {
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, -1), n);
  g.applyQuaternion(q); g.translate(p.x, p.y, p.z);
  return g;
}

// ------------------------------------------------------------------------------------------ materials
const SKIN_TONES = [0xf3cfb0, 0xeec19c, 0xe2ad85, 0xc98f68, 0x9a6845];
const matCache = new Map();
function vcMat(key, make) {
  if (matCache.has(key)) return matCache.get(key);
  const m = make().clone();
  m.vertexColors = true;
  m.name = key;
  matCache.set(key, m);
  return m;
}
let FLORAL = null;
function floralTex() {
  if (FLORAL) return FLORAL;
  FLORAL = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#1f8a9a'; c.fillRect(0, 0, w, h);
    const R = rng(11);
    const leaf = (x, y, a, s) => { c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = R() < 0.5 ? '#2f6b3a' : '#3f8a45';
      c.beginPath(); c.ellipse(0, 0, 34 * s, 12 * s, 0, 0, PI * 2); c.fill(); c.strokeStyle = 'rgba(200,240,190,0.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-30 * s, 0); c.lineTo(30 * s, 0); c.stroke(); c.restore(); };
    const flower = (x, y, s, colr) => {
      c.save(); c.translate(x, y); c.rotate(R() * PI);
      for (let i = 0; i < 5; i++) { c.rotate((PI * 2) / 5); c.fillStyle = colr; c.beginPath(); c.ellipse(0, 18 * s, 13 * s, 20 * s, 0, 0, PI * 2); c.fill(); }
      c.fillStyle = '#ffe27a'; c.beginPath(); c.arc(0, 0, 6 * s, 0, PI * 2); c.fill();
      c.strokeStyle = '#ffe27a'; c.lineWidth = 2.5 * s; c.beginPath(); c.moveTo(0, 0); c.lineTo(10 * s, -22 * s); c.stroke();
      c.restore(); };
    for (let i = 0; i < 40; i++) { const x = R() * w, y = R() * h; for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) leaf(x + dx, y + dy, R() * PI, 0.8 + R() * 0.6); }
    const cols = ['#f25c54', '#ffffff', '#f7a072', '#ff8fab'];
    for (let i = 0; i < 16; i++) { const x = R() * w, y = R() * h, s = 0.8 + R() * 0.7, cl = cols[i % cols.length]; for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) flower(x + dx, y + dy, s, cl); }
  });
  FLORAL.wrapS = FLORAL.wrapT = THREE.RepeatWrapping;
  FLORAL.repeat.set(1 / 0.42, 1 / 0.42);
  return FLORAL;
}
function topMat(kind) {
  switch (kind) {
    case 'stripes': return vcMat('chr:stripes', () => textured('stripes', { color: 0x6f9bd6, color2: 0xf2f5fa, count: 6, ratio: 0.42 }, 0.36, { physical: true, sheen: 0.5 }));
    case 'floral': return vcMat('chr:floral', () => new THREE.MeshStandardMaterial({ map: floralTex(), roughness: 0.75 }));
    case 'denim': return vcMat('chr:denim', () => mat('fabricBlue'));
    case 'fabric': return vcMat('chr:fabric', () => paint(0xffffff, 0.82, 0, { sheen: 0.6 }));
    case 'wool': return vcMat('chr:wool', () => paint(0xffffff, 0.7, 0, { sheen: 0.45 }));
    default: return vcMat('chr:cloth', () => paint(0xffffff, 0.78, 0, { sheen: 0.5 }));
  }
}
const shoeMat = () => vcMat('chr:shoe', () => paint(0xffffff, 0.45, 0, { clearcoat: 0.4 }));
const faceMat = () => vcMat('chr:face', () => paint(0xffffff, 0.28));
const skinMat = (tone) => vcMat('chr:skin:' + tone, () => paint(tone, 0.55, 0, { sheen: 0.35 }));
const hairMat = (c) => vcMat('chr:hair:' + c, () => paint(c, 0.48, 0, { sheen: 0.7 }));

// ------------------------------------------------------------------------------------------ body parts
const shade = (h, k) => { const c = col(h); c.multiplyScalar(k); return c.getHex(); };

function buildHead(sk, face, skin) {
  // skull + face: ellipsoid with a narrower jaw, soft cheeks and chin
  let g = new THREE.SphereGeometry(1, 34, 24);
  g = bump(g, () => 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const low = sstep(0.0, -0.95, y);
    x *= 1 - 0.2 * low * low;
    z *= 1 - 0.1 * low;
    if (z < 0) z *= 1 + 0.05 * sstep(0.2, -0.4, y) * (1 - Math.abs(x)); // cheeks
    if (y > 0.2 && z > 0) z *= 1.04; // back of the skull
    p.setXYZ(i, x * HEAD_S.x, y * HEAD_S.y, z * HEAD_S.z);
  }
  g.computeVertexNormals();
  g.translate(HEAD_C.x, HEAD_C.y, HEAD_C.z);
  const hg = skin.add(g, 'head', 0xffffff);
  // blush on the cheeks
  const c = hg.attributes.color, pp = hg.attributes.position;
  const blush = col(0xf08a8a), v = new THREE.Vector3();
  for (const sg of [-1, 1]) {
    const ck = headPoint(sg * 0.62, -0.32).p;
    for (let i = 0; i < pp.count; i++) {
      v.fromBufferAttribute(pp, i);
      const w = Math.exp(-v.distanceToSquared(ck) / (0.022 * 0.022)) * 0.32;
      if (w > 0.002) c.setXYZ(i, lerp(c.getX(i), blush.r, w), lerp(c.getY(i), blush.g, w), lerp(c.getZ(i), blush.b, w));
    }
  }
  // nose, ears
  { const n = headPoint(0, -0.2, -0.012); const g2 = ellipsoid(0.017, 0.02, 0.018, 14, 10); g2.translate(n.p.x, n.p.y, n.p.z - 0.004); skin.add(g2, 'head'); }
  for (const sg of [-1, 1]) {
    const e = ellipsoid(0.016, 0.034, 0.024, 14, 10);
    const inner = ellipsoid(0.008, 0.022, 0.014, 10, 8); inner.translate(sg * 0.007, 0, -0.003);
    e.rotateZ(sg * 0.12);
    e.translate(HEAD_C.x + sg * 0.118, HEAD_C.y - 0.012, HEAD_C.z + 0.008);
    skin.add(e, 'head');
  }
  // neck
  skin.add(limb(V(0, 1.37, 0.008), V(0, 1.5, 0.0), 0.05, 0.047, { capA: false, capB: false, seg: 16 }), 'neck', 0xf4f4f4, [{ bone: 'head', from: V(0, 1.47, 0), dir: V(0, 1, 0), width: 0.03 }]);
  // eyes: white, iris with gradient ring, pupil and two highlights (each eye bound to its own bone to blink)
  for (const [sg, bone] of [[-1, 'eyeL'], [1, 'eyeR']]) {
    const e = headPoint(sg * 0.37, -0.03, -0.006);
    const white = ellipsoid(0.022, 0.027, 0.012, 18, 12); orientTo(white, e.n, e.p); face.add(white, bone, 0xfbfbf8);
    const ir = headPoint(sg * 0.36, -0.045, 0.0035);
    const iris = ellipsoid(0.0165, 0.0195, 0.004, 18, 8); orientTo(iris, ir.n, ir.p); face.add(iris, bone, 0x5a3a22);
    const pu = headPoint(sg * 0.36, -0.045, 0.0062);
    const pupil = ellipsoid(0.0095, 0.0115, 0.003, 14, 6); orientTo(pupil, pu.n, pu.p); face.add(pupil, bone, 0x120c08);
    const hl = headPoint(sg * 0.36 - 0.05, -0.0, 0.0085);
    const h1 = ellipsoid(0.0045, 0.0045, 0.002, 8, 6); orientTo(h1, hl.n, hl.p); face.add(h1, bone, 0xffffff);
    const hl2 = headPoint(sg * 0.36 + 0.035, -0.08, 0.008);
    const h2 = ellipsoid(0.0022, 0.0022, 0.0015, 6, 4); orientTo(h2, hl2.n, hl2.p); face.add(h2, bone, 0xffffff);
    // upper lid line
    const lid = []; for (let i = 0; i <= 6; i++) { const t = i / 6; lid.push(headPoint(sg * (0.36 + (t - 0.5) * 0.36), 0.1 + 0.05 * Math.sin(t * PI) - 0.04, 0.002).p); }
    face.add(tubeAlong(lid, 0.0028, 12, 5), bone, 0x2a1a12);
  }
  // mouth: a small smile with a hint of lip
  const sm = []; for (let i = 0; i <= 8; i++) { const t = i / 8; sm.push(headPoint((t - 0.5) * 0.36, -0.43 - 0.06 * Math.sin(t * PI), 0.0).p); }
  face.add(tubeAlong(sm, 0.0042, 16, 6), 'head', 0xb24a4f);
  return hg;
}

function buildEyebrows(hairB, hairColor) {
  for (const sg of [-1, 1]) {
    const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(headPoint(sg * (0.2 + t * 0.32), 0.17 + 0.05 * Math.sin(t * PI * 0.9), 0.003).p); }
    hairB.add(tubeAlong(pts, 0.0048, 12, 6), 'head', 0xffffff);
  }
}

// hair cap: a parametric shell over the skull from the crown down to a smooth hairline(yaw), with
// strand grooves, a rolled edge tucked back to the scalp, and an optional curtain/length below.
function hairCap({ line, puff = 1.08, grooves = 0.0022, curtain = 0, flare = 0, U = 56, Vn = 14 }) {
  const rows = [];
  const P = (yaw, pitch, k) => {
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    let rx = HEAD_S.x * k, rz = HEAD_S.z * k;
    let y = sp * HEAD_S.y * (k + 0.005);
    const cu = typeof curtain === 'function' ? curtain(yaw) : curtain;
    if (pitch < 0 && cu) { // hair falls straight instead of following the jaw inwards
      const c = Math.min(1, -pitch / 0.9);
      rx *= lerp(cp, 1 + flare * c, c) / cp; rz *= lerp(cp, 1 + flare * c, c) / cp;
      y = lerp(y, -cu * c, c * 0.65) + sp * HEAD_S.y * 0.35 * c;
    }
    return V(Math.sin(yaw) * cp * rx + HEAD_C.x, y + HEAD_C.y, -Math.cos(yaw) * cp * rz + HEAD_C.z);
  };
  for (let j = 0; j <= Vn + 2; j++) {
    const r = [];
    for (let i = 0; i <= U; i++) {
      const yaw = (i / U) * PI * 2 - PI;
      const pl = line(yaw);
      const tv = Math.min(j, Vn) / Vn;
      const pitch = lerp(PI / 2 - 0.001, pl, tv ** 0.9);
      const g = 1 + Math.sin(yaw * 34 + pitch * 4) * grooves * 4 * sstep(1.4, 0.5, pitch);
      let k = puff * g;
      if (j === Vn + 1) k = lerp(puff, 1.0, 0.6);
      if (j === Vn + 2) k = 0.985;
      const pt = P(yaw, j > Vn ? pl + 0.04 * (j - Vn) : pitch, k);
      r.push(pt);
    }
    rows.push(r);
  }
  const pos = [], idx = [];
  for (const r of rows) for (const p of r) pos.push(p.x, p.y, p.z);
  const W = U + 1;
  for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < U; i++) {
    const a = j * W + i, b = j * W + i + 1, c = (j + 1) * W + i + 1, d = (j + 1) * W + i;
    idx.push(a, c, d, a, b, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const m = mergeVertices(g, 1e-5);
  m.computeVertexNormals();
  return m;
}
const hairline = (front, temple, ear, nape) => (yaw) => {
  const f = Math.abs(yaw) / PI;
  if (f < 0.35) return lerp(front, temple, sstep(0.05, 0.35, f));
  if (f < 0.6) return lerp(temple, ear, sstep(0.35, 0.6, f));
  return lerp(ear, nape, sstep(0.6, 1.0, f));
};
function lock(a, b, c, r0, r1) {
  // soft tapering lock of hair through three points
  const curve = new THREE.QuadraticBezierCurve3(a, b, c);
  const N = 10, pts = curve.getSpacedPoints(N);
  const parts = [];
  const g = new THREE.TubeGeometry(curve, N, 1, 8, false);
  const p = g.attributes.position;
  // taper: rescale ring radii along the tube
  for (let i = 0; i <= N; i++) {
    const t = i / N, r = lerp(r0, r1, t * t);
    const cpt = pts[i];
    for (let j = 0; j <= 8; j++) {
      const idx = i * 9 + j;
      const x = p.getX(idx) - cpt.x, y = p.getY(idx) - cpt.y, z = p.getZ(idx) - cpt.z;
      p.setXYZ(idx, cpt.x + x * r, cpt.y + y * r, cpt.z + z * r);
    }
  }
  g.computeVertexNormals();
  parts.push(g);
  const cap = new THREE.SphereGeometry(r0, 8, 6); cap.translate(a.x, a.y, a.z); parts.push(cap);
  return mergeList(parts);
}

function buildHair(hairB, style) {
  const H = HEAD_C;
  const cap = (o) => hairB.add(hairCap(o), 'head');
  if (style === 'short' || style === 'spiky') cap({ line: hairline(0.5, 0.18, -0.18, -0.55), puff: 1.08 });
  if (style === 'bob') cap({ line: hairline(0.5, -0.3, -0.85, -0.95), puff: 1.1, curtain: 0.075, flare: 0.08 });
  if (style === 'long') hairB.add(hairCap({ line: hairline(0.5, -0.3, -0.95, -1.1), puff: 1.09, curtain: (yaw) => lerp(0.07, 0.36, sstep(0.45, 0.85, Math.abs(yaw) / PI)), flare: 0.06 }), 'head', 0xffffff, [{ bone: 'chest', from: V(0, 1.44, 0), dir: V(0, -1, 0), width: 0.05, max: 0.85 }]);
  if (style === 'bun') cap({ line: hairline(0.55, 0.15, -0.15, -0.6), puff: 1.06, grooves: 0.0016 });
  // bangs: locks sweeping from the crown over the forehead
  const R = rng(style.length * 7 + 3);
  const nb = style === 'bun' ? 0 : style === 'spiky' ? 5 : 7;
  for (let i = 0; i < nb; i++) {
    const t = (i + 0.5) / nb - 0.5;
    const yaw = t * 1.5;
    const a = headPoint(yaw * 0.6, 0.85, 0.012).p;
    const b = headPoint(yaw * 0.9 + 0.05, 0.5, 0.03).p;
    const c = headPoint(yaw * 1.05 + 0.12 * Math.sign(t + 0.01), style === 'bob' || style === 'long' ? 0.22 : 0.3 - Math.abs(t) * 0.25 + R() * 0.04, 0.012).p;
    hairB.add(lock(a, b, c, 0.034, 0.008), 'head');
  }
  if (style === 'spiky') {
    for (let i = 0; i < 11; i++) {
      const yaw = (i / 11) * PI * 2, pitch = 0.62 + (i % 2) * 0.18;
      const a = headPoint(yaw, pitch, -0.01).p, n = a.clone().sub(H).normalize();
      const tip = a.clone().addScaledVector(n, 0.07 + R() * 0.03).add(V(0, 0.02, 0.02));
      const mid = a.clone().lerp(tip, 0.5).add(V(0, 0.01, 0));
      hairB.add(lock(a, mid, tip, 0.026, 0.004), 'head');
    }
  }
  if (style === 'bun') {
    const bun = bump(ellipsoid(0.058, 0.052, 0.058, 22, 16), (v) => Math.sin(Math.atan2(v.x, v.z) * 9 + v.y * 60) * 0.002);
    bun.translate(H.x, H.y + 0.13, H.z + 0.05);
    hairB.add(bun, 'head');
    const tie = new THREE.TorusGeometry(0.04, 0.008, 8, 20); tie.rotateX(PI / 2 - 0.4); tie.translate(H.x, H.y + 0.1, H.z + 0.04);
    hairB.add(tie, 'head', 0xe0527a);
  }
}

function buildHands(skin) {
  for (const [sg, side] of [[-1, 'L'], [1, 'R']]) {
    const w = J['hand' + side];
    // mitten palm with four soft finger bumps and a thumb
    let palm = ellipsoid(0.039, 0.054, 0.027, 18, 14);
    palm = bump(palm, (v) => (v.y < -0.01 ? 0.004 * Math.max(0, Math.sin((v.z + 0.02) * 120)) * sstep(-0.01, -0.04, v.y) : 0));
    palm.translate(0, -0.052, 0);
    palm.rotateZ(sg * 0.08);
    palm.translate(w.x, w.y, w.z);
    skin.add(palm, 'hand' + side);
    const th = limb(V(0, 0, 0), V(0, -0.04, -0.022), 0.014, 0.012, { seg: 10 });
    th.translate(w.x - sg * 0.006, w.y - 0.03, w.z - 0.02);
    skin.add(th, 'hand' + side);
  }
}

// ------------------------------------------------------------------------------------------ outfits
const OUTFITS = ['pajama', 'suit', 'office', 'casual', 'beach', 'chef', 'police', 'fire', 'doctor', 'mart', 'post'];
const BRIGHT = [0xe07a3c, 0x4f8f5c, 0x7d5cc0, 0xd94f5c, 0x3f78c8, 0xf0b93a, 0x2f9c9a];

/** Fill top / bottom / shoe buckets (and skin for exposed limbs) for an outfit. */
function dressUp(o, B, skinB, seed) {
  const R = rng(seed * 31 + 7);
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const top = B.top, bot = B.bottom, shoe = B.shoes;
  let topKind = 'cloth', botKind = 'cloth';
  let topC = 0xffffff, botC = 0x2b2e35;
  let sleeves = 'long', legs = 'long', shoes = 'sneaker', hood = false, hem = 0.88;
  const extras = [];
  switch (o) {
    case 'pajama': topKind = 'stripes'; botKind = 'stripes'; topC = 0xffffff; botC = 0xffffff; shoes = 'slipper'; hem = 0.86; break;
    case 'suit': topC = 0x232f4d; botC = 0x262b36; shoes = 'dress'; hem = 0.83; extras.push('lapels', 'shirtV', 'tie', 'buttons2', 'pocketSq'); break;
    case 'office': topC = pick([0xcfe0f2, 0xf4f4ef, 0xe9dccd]); botC = pick([0x4d5058, 0x3b3f48, 0x6a5d50]); shoes = 'brown'; hem = 0.95; extras.push('collar', 'placket', 'belt', 'lanyard', 'pocket'); break;
    case 'casual': {
      const hoodie = seed % 2 === 1;
      topC = pick(BRIGHT); botKind = 'denim'; botC = 0xffffff; shoes = 'sneaker';
      if (hoodie) { hood = true; extras.push('pouch', 'strings', 'cuffs'); hem = 0.86; } else { sleeves = 'short'; extras.push('crew', 'print'); hem = 0.9; }
      break;
    }
    case 'beach': topKind = 'floral'; topC = 0xffffff; botC = pick([0x2f5f8a, 0x2f8a7a, 0xd06a4a]); sleeves = 'short'; legs = 'shorts'; shoes = 'flipflop'; hem = 0.9; extras.push('openCollar', 'buttons'); break;
    case 'chef': topC = 0xf6f5f0; botC = 0x2a2c31; shoes = 'clog'; hem = 0.88; extras.push('apron', 'neckerchief', 'buttonsDouble'); break;
    // job uniforms (인혁: "직업을 더 만들어줘. 다양하게 경찰, 소방관 같은 것도 넣어.")
    case 'police': topC = 0x26406e; botC = 0x1a2236; shoes = 'dress'; hem = 0.95; extras.push('collar', 'placket', 'belt', 'badge', 'policeCap'); break;
    case 'fire': topKind = 'fabric'; botKind = 'fabric'; topC = 0xb89a5a; botC = 0xa88a4e; shoes = 'dress'; hem = 0.86; extras.push('collar', 'reflect', 'fireHelmet', 'tank'); break;
    case 'doctor': topC = 0xf6f6f2; botC = 0x2f4a6a; shoes = 'sneaker'; hem = 0.88; extras.push('lapels', 'shirtV', 'pocket', 'steth', 'buttons2'); break;
    case 'mart': topC = 0xf4f4f2; botC = 0x3b3f48; shoes = 'sneaker'; hem = 0.95; extras.push('collar', 'vest'); break;
    case 'post': topC = 0xd8452a; botC = 0x2a3048; shoes = 'sneaker'; hem = 0.9; extras.push('collar', 'placket', 'reflect', 'postCap', 'bag'); break;
    default: break;
  }
  // torso (top) and pelvis (bottom). Lathe profiles: [r, y], depth scaled.
  const loose = o === 'beach' || o === 'chef' || o === 'fire' || o === 'doctor' || hood ? 1.04 : 1;
  const torso = memo(`torso|${hem}|${loose}`, () => bump(bodyLoft([
    [hem, 0.15 * loose, 0.107 * loose, 2.4, 0.004], [1.0, 0.142 * loose, 0.1 * loose, 2.4, 0.0], [1.1, 0.146 * loose, 0.104 * loose, 2.5, -0.002], [1.2, 0.158 * loose, 0.112 * loose, 2.6, -0.004],
    [1.28, 0.165, 0.108, 2.8, -0.002], [1.335, 0.158, 0.098, 2.8, 0.002], [1.375, 0.12, 0.078, 2.4, 0.004], [1.4, 0.075, 0.06, 2.2, 0.004], [1.412, 0.05, 0.048, 2, 0.004],
  ], 30, 0.4), (v) => 0.0016 * Math.sin(v.y * 80 + v.x * 25) * sstep(1.22, 1.02, v.y)));
  top.add(torso, 'chest', topC, [{ bone: 'spine', from: V(0, 1.12, 0), dir: V(0, -1, 0), width: 0.07, max: 1 }, { bone: 'hips', from: V(0, 0.98, 0), dir: V(0, -1, 0), width: 0.05 }]);
  const pelvis = memo('pelvis', () => bodyLoft([[0.81, 0.07, 0.065, 2.2, 0.01], [0.85, 0.14, 0.098, 2.4, 0.008], [0.9, 0.158, 0.106, 2.6, 0.004], [0.96, 0.152, 0.102, 2.6, 0.0], [1.01, 0.14, 0.097, 2.5, 0.0]], 32, 0.3));
  bot.add(pelvis, 'hips', botC, [{ bone: 'spine', from: V(0, 1.0, 0), dir: V(0, 1, 0), width: 0.04, max: 0.6 }]);
  // deltoids round the shoulders into the sleeves
  for (const side of ['L', 'R']) {
    const sg = side === 'L' ? -1 : 1, sh = J['shoulder' + side];
    const d = ellipsoid(0.052, 0.05, 0.054, 16, 10); d.translate(sh.x - sg * 0.02, sh.y - 0.016, sh.z);
    top.add(d, 'shoulder' + side, topC, [{ bone: 'chest', from: sh.clone().add(V(-sg * 0.03, 0.02, 0)), dir: V(-sg, 0.6, 0).normalize(), width: 0.04, max: 0.7 }]);
  }
  // shoulders blend to the arms
  for (const side of ['L', 'R']) {
    const sg = side === 'L' ? -1 : 1;
    const sh = J['shoulder' + side], el = J['elbow' + side], wr = J['hand' + side];
    const armBlend = [{ bone: 'elbow' + side, from: el, dir: wr.clone().sub(el).normalize(), width: 0.035 }];
    const shBlend = [{ bone: 'chest', from: sh.clone().add(V(0, -0.02, 0)), dir: V(-sg, 0.4, 0).normalize(), width: 0.05, max: 0.6 }];
    const upper = limb(sh.clone().add(V(0, 0.0, 0)), el, 0.058, 0.047, { seg: 18, bulge: 0.05 });
    const lower = limb(el, wr, 0.046, 0.036, { seg: 16, bulge: 0.06 });
    if (sleeves === 'long') {
      top.add(upper, 'shoulder' + side, topC, [...shBlend, ...armBlend]);
      top.add(lower, 'elbow' + side, topC, [{ bone: 'shoulder' + side, from: el, dir: el.clone().sub(wr).normalize(), width: 0.035 }]);
      // cuff
      const cuff = limb(wr.clone().lerp(el, 0.12), wr.clone().lerp(el, -0.01), 0.039, 0.039, { seg: 16, bulge: 0, capA: false, capB: false });
      top.add(cuff, 'elbow' + side, extras.includes('cuffs') ? shade(topC, 0.85) : o === 'suit' ? 0xf2f2f0 : shade(topC, 0.95));
    } else {
      const mid = sh.clone().lerp(el, 0.5);
      top.add(limb(sh.clone().add(V(0, 0.0, 0)), mid, 0.066, 0.06, { seg: 18, bulge: 0.04, capB: false }), 'shoulder' + side, topC, shBlend);
      const hemR = limb(mid.clone().lerp(sh, 0.05), mid.clone().lerp(el, 0.06), 0.062, 0.062, { seg: 18, bulge: 0, capA: false, capB: false });
      top.add(hemR, 'shoulder' + side, shade(topC, o === 'beach' ? 1 : 0.9));
      skinB.add(limb(sh.clone().lerp(el, 0.3), el, 0.05, 0.045, { seg: 16, bulge: 0.04 }), 'shoulder' + side, 0xffffff, armBlend);
      skinB.add(lower, 'elbow' + side, 0xffffff, [{ bone: 'shoulder' + side, from: el, dir: el.clone().sub(wr).normalize(), width: 0.035 }]);
    }
    // legs
    const th = J['thigh' + side], kn = J['knee' + side], ft = J['foot' + side];
    const legBlend = [{ bone: 'knee' + side, from: kn, dir: ft.clone().sub(kn).normalize(), width: 0.04 }];
    const hipBlend = [{ bone: 'hips', from: th.clone().add(V(0, -0.02, 0)), dir: V(0, 1, 0), width: 0.05, max: 0.7 }];
    const thigh = limb(th.clone().add(V(-sg * 0.004, -0.005, 0)), kn, 0.074, 0.057, { seg: 18, bulge: 0.03, capA: true });
    bot.add(thigh, 'thigh' + side, botC, [...hipBlend, ...legBlend]);
    const ankle = ft.clone().add(V(0, 0.02, 0));
    if (legs === 'long') {
      const shin = limb(kn, ankle, 0.056, 0.05, { seg: 16, bulge: 0.04, folds: 0.05, rnd: R });
      bot.add(shin, 'knee' + side, botC, [{ bone: 'thigh' + side, from: kn, dir: kn.clone().sub(ft).normalize(), width: 0.04 }]);
    } else {
      const hemL = limb(kn.clone().lerp(th, 0.2), kn.clone().lerp(th, 0.08), 0.068, 0.066, { seg: 18, bulge: 0, capA: false, capB: false });
      bot.add(hemL, 'thigh' + side, shade(botC, 0.9));
      skinB.add(limb(kn.clone().lerp(th, 0.15), ankle, 0.05, 0.034, { seg: 16, bulge: 0.08 }), 'knee' + side, 0xffffff, [{ bone: 'thigh' + side, from: kn, dir: kn.clone().sub(ft).normalize(), width: 0.04 }]);
    }
    const accent = [0xe8455a, 0x3f78c8, 0x2f9c9a][Math.floor(R() * 3)];
    cachedParts(`shoe|${shoes}|${side}|${accent}`, [shoe, skinB], () => buildShoe(shoe, skinB, side, shoes, accent));
  }
  // ---- extras
  const zf = (y) => -0.66 * (y > 1.17 ? lerp(0.15, 0.168, (y - 1.17) / 0.14) : lerp(0.14, 0.15, (y - 1.0) / 0.17)); // torso front surface z at height y (centre line)
  if (hood) {
    const hd = new THREE.TorusGeometry(0.11, 0.045, 12, 28, PI * 1.25);
    hd.rotateX(PI / 2); hd.rotateY(PI * 0.5 - PI * 0.125 + PI); hd.scale(1.1, 1, 0.9);
    hd.rotateX(-0.35);
    hd.translate(0, 1.4, 0.06);
    top.add(smooth(hd), 'chest', shade(topC, 0.92));
  }
  if (extras.includes('pouch')) {
    const s = new THREE.Shape(); s.moveTo(-0.1, 0); s.lineTo(0.1, 0); s.lineTo(0.075, 0.12); s.lineTo(-0.075, 0.12); s.closePath();
    const g = plate(s, 0.006, 0.004); g.translate(0, hem + 0.03, 0); g.rotateY(PI);
    g.translate(0, 0, zf(hem + 0.09) - 0.006);
    top.add(g, 'spine', shade(topC, 0.94));
  }
  if (extras.includes('strings')) for (const sg of [-1, 1]) top.add(tubeAlong([V(sg * 0.035, 1.38, -0.09), V(sg * 0.04, 1.3, -0.112), V(sg * 0.042, 1.22, -0.112)], 0.0035, 10, 5), 'chest', 0xf4f4f0);
  if (extras.includes('crew')) { const c = new THREE.TorusGeometry(0.058, 0.009, 8, 26); c.rotateX(PI / 2 - 0.25); c.scale(1, 1, 0.85); c.translate(0, 1.402, -0.008); top.add(smooth(c), 'chest', shade(topC, 0.85)); }
  if (extras.includes('print')) { const s = new THREE.Shape(); s.absarc(0, 0, 0.045, 0, PI * 2); const g = plate(s, 0.002, 0.002); g.rotateY(PI); g.translate(0.0, 1.24, zf(1.24) - 0.0015); top.add(g, 'chest', 0xffffff); const s2 = new THREE.Shape(); s2.moveTo(0, -0.02); s2.bezierCurveTo(0.04, 0.01, 0.015, 0.035, 0, 0.015); s2.bezierCurveTo(-0.015, 0.035, -0.04, 0.01, 0, -0.02); const g2 = plate(s2, 0.002, 0.001); g2.rotateY(PI); g2.translate(0, 1.24, zf(1.24) - 0.005); top.add(g2, 'chest', 0xe8455a); }
  if (extras.includes('lapels') || extras.includes('shirtV')) {
    // white shirt V and tie under an open jacket
    const v = new THREE.Shape(); v.moveTo(-0.075, 1.4); v.lineTo(0.075, 1.4); v.lineTo(0.0, 1.17); v.closePath();
    const g = plate(v, 0.003, 0.002); g.rotateY(PI); g.translate(0, 0, zf(1.3) + 0.003); top.add(g, 'chest', o === 'doctor' ? 0x9fc4e8 : 0xf4f4f2);
    if (extras.includes('tie')) {
      const t = new THREE.Shape(); t.moveTo(-0.012, 1.375); t.lineTo(0.012, 1.375); t.lineTo(0.022, 1.2); t.lineTo(0, 1.17); t.lineTo(-0.022, 1.2); t.closePath();
      const tg2 = plate(t, 0.004, 0.002); tg2.rotateY(PI); tg2.translate(0, 0, zf(1.3) - 0.003); top.add(tg2, 'chest', 0x9b2335);
      const knot = ellipsoid(0.015, 0.014, 0.01, 10, 8); knot.translate(0, 1.378, zf(1.38) - 0.006); top.add(knot, 'chest', 0x86202f);
    }
    for (const sg of [-1, 1]) {
      const l = new THREE.Shape(); l.moveTo(0, 0); l.lineTo(0.085, 0.24); l.lineTo(0.06, 0.25); l.lineTo(0.05, 0.19); l.lineTo(0.02, 0.18); l.closePath();
      const lg = plate(l, 0.004, 0.003); lg.scale(sg, 1, 1); lg.rotateY(PI); lg.translate(0, 1.15, zf(1.27) - 0.002);
      top.add(lg, 'chest', shade(topC, 1.15));
    }
  }
  if (extras.includes('buttons2')) for (const y of [1.06, 1.13]) { const b = ellipsoid(0.008, 0.008, 0.003, 10, 6); b.translate(0.01, y, zf(y) - 0.004); top.add(b, 'spine', 0x111318); }
  if (extras.includes('pocketSq')) { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.04, 0); s.lineTo(0.035, 0.018); s.lineTo(0.02, 0.012); s.lineTo(0.006, 0.02); s.closePath(); const g = plate(s, 0.002, 0.001); g.rotateY(PI); g.translate(-0.08, 1.27, zf(1.27) * 0.92 - 0.004); top.add(g, 'chest', 0xf4f4f2); }
  if (extras.includes('collar') || extras.includes('openCollar')) {
    for (const sg of [-1, 1]) {
      const c = new THREE.Shape(); c.moveTo(0, 0); c.lineTo(0.06, 0.035); c.lineTo(0.05, -0.04); c.closePath();
      const g = plate(c, 0.003, 0.003); g.scale(sg, 1, 1); g.rotateY(PI); g.rotateX(-0.25);
      const open = extras.includes('openCollar') ? 0.02 : 0;
      g.translate(sg * (0.012 + open), 1.395, zf(1.38) + 0.01);
      top.add(g, 'chest', shade(topC, o === 'beach' ? 1.05 : 1.02));
    }
    const band = new THREE.TorusGeometry(0.056, 0.011, 8, 26, PI * 1.6); band.rotateZ(-PI * 0.3 - PI / 2); band.rotateX(PI / 2 - 0.25); band.scale(1, 1, 0.85); band.translate(0, 1.408, -0.006);
    top.add(smooth(band), 'chest', shade(topC, 1.03));
  }
  if (extras.includes('placket')) { for (let i = 0; i < 4; i++) { const y = 1.36 - i * 0.075; const b = ellipsoid(0.006, 0.006, 0.0025, 8, 6); b.translate(0, y, zf(y) - 0.003); top.add(b, 'chest', 0xf8f8f8); } }
  if (extras.includes('pocket')) { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.06, 0); s.lineTo(0.06, 0.065); s.lineTo(0.03, 0.072); s.lineTo(0, 0.065); s.closePath(); const g = plate(s, 0.002, 0.002); g.rotateY(PI); g.translate(-0.05, 1.22, zf(1.25) * 0.97 - 0.002); top.add(g, 'chest', shade(topC, 0.96)); }
  if (extras.includes('buttons')) { for (let i = 0; i < 4; i++) { const y = 1.3 - i * 0.08; const b = ellipsoid(0.006, 0.006, 0.0025, 8, 6); b.translate(0.01, y, zf(y) - 0.003); top.add(b, 'chest', 0xf3e6c8); } }
  if (extras.includes('buttonsDouble')) { for (let i = 0; i < 3; i++) for (const x of [-0.05, 0.05]) { const y = 1.3 - i * 0.075; const b = ellipsoid(0.007, 0.007, 0.003, 8, 6); b.translate(x, y, zf(y) * Math.sqrt(1 - (x / 0.16) ** 2) - 0.003); top.add(b, 'chest', 0xd8d4c8); } }
  if (extras.includes('belt')) { const b = latheGeo([[0.141, 0.955], [0.144, 0.96], [0.144, 0.99], [0.141, 0.995]], 26, 0.75); bot.add(b, 'hips', 0x3a2a20); const bk = new THREE.BoxGeometry(0.04, 0.03, 0.008); bk.translate(0, 0.975, -0.112); bot.add(bk, 'hips', 0xc9b27a); }
  if (extras.includes('lanyard')) {
    for (const sg of [-1, 1]) top.add(tubeAlong([V(sg * 0.055, 1.41, -0.02), V(sg * 0.06, 1.37, -0.075), V(sg * 0.03, 1.27, -0.108), V(sg * 0.008, 1.2, -0.111)], 0.004, 12, 5), 'chest', 0xd8323c);
    const card = new THREE.Shape(); card.moveTo(-0.03, 0); card.lineTo(0.03, 0); card.lineTo(0.03, 0.085); card.lineTo(-0.03, 0.085); card.closePath();
    const g = plate(card, 0.002, 0.002); g.rotateY(PI); g.translate(0, 1.11, zf(1.15) - 0.006); top.add(g, 'chest', 0xffffff);
    const band = new THREE.Shape(); band.moveTo(-0.03, 0); band.lineTo(0.03, 0); band.lineTo(0.03, 0.022); band.lineTo(-0.03, 0.022); band.closePath();
    const bg = plate(band, 0.001, 0.0005); bg.rotateY(PI); bg.translate(0, 1.17, zf(1.15) - 0.0095); top.add(bg, 'chest', 0x2f6fd0);
    const ph = new THREE.Shape(); ph.absellipse(0, 0, 0.012, 0.015, 0, PI * 2); const pg = plate(ph, 0.001, 0.0005); pg.rotateY(PI); pg.translate(-0.012, 1.135, zf(1.15) - 0.0095); top.add(pg, 'chest', 0x9db8d8);
  }
  if (extras.includes('apron')) {
    const s = new THREE.Shape();
    s.moveTo(-0.15, 0.0); s.quadraticCurveTo(0, -0.02, 0.15, 0.0); s.lineTo(0.14, 0.32); s.lineTo(0.09, 0.4); s.lineTo(0.085, 0.58); s.lineTo(-0.085, 0.58); s.lineTo(-0.09, 0.4); s.lineTo(-0.14, 0.32); s.closePath();
    let g = plate(s, 0.004, 0.003);
    g.rotateY(PI);
    // wrap it around the body front
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i) + 0.72, z = p.getZ(i);
      const zs = y > 1.0 ? zf(Math.min(y, 1.3)) * Math.sqrt(Math.max(0.05, 1 - (x / 0.165) ** 2)) : -0.112 * Math.sqrt(Math.max(0.05, 1 - (x / 0.16) ** 2)) - (1.0 - y) * 0.06;
      p.setXYZ(i, x, y, z + zs - 0.008);
    }
    g.computeVertexNormals();
    top.add(g, 'spine', 0x34383f, [{ bone: 'thighL', from: V(0, 0.86, 0), dir: V(0, -1, 0), width: 0.1, max: 0.25 }, { bone: 'thighR', from: V(0, 0.86, 0), dir: V(0, -1, 0), width: 0.1, max: 0.25 }, { bone: 'chest', from: V(0, 1.15, 0), dir: V(0, 1, 0), width: 0.06 }]);
    const pk = new THREE.Shape(); pk.moveTo(-0.07, 0); pk.lineTo(0.07, 0); pk.lineTo(0.07, 0.07); pk.lineTo(-0.07, 0.07); pk.closePath();
    const pg = plate(pk, 0.002, 0.002); pg.rotateY(PI); pg.translate(0, 0.9, -0.132); top.add(pg, 'hips', 0x2a2d33);
    for (const sg of [-1, 1]) top.add(tubeAlong([V(sg * 0.085, 1.3, -0.122), V(sg * 0.07, 1.4, -0.06), V(0, 1.43, 0.03)], 0.005, 12, 5), 'chest', 0x34383f);
  }
  jobExtras(o, extras, top, bot, B.shoes, zf, loose);
  if (extras.includes('neckerchief')) { const k = new THREE.TorusGeometry(0.058, 0.014, 8, 24); k.rotateX(PI / 2 - 0.25); k.translate(0, 1.4, -0.006); top.add(smooth(k), 'chest', 0xc8333c); const kn = ellipsoid(0.02, 0.016, 0.012, 10, 8); kn.translate(0, 1.37, -0.075); top.add(kn, 'chest', 0xb02a33); }
  return { topKind, botKind };
}

/** Job uniform details: badge, caps and helmets (on the glossy shoe material), reflective bands, air tank, vest, bag. */
function jobExtras(o, extras, top, bot, gloss, zf, loose) {
  const H = HEAD_C;
  if (extras.includes('badge')) {
    const s = new THREE.Shape(); s.moveTo(-0.022, 0.03); s.lineTo(0.022, 0.03); s.lineTo(0.022, 0.0); s.quadraticCurveTo(0.018, -0.022, 0, -0.032); s.quadraticCurveTo(-0.018, -0.022, -0.022, 0.0); s.closePath();
    const g = plate(s, 0.004, 0.002); g.rotateY(PI); g.translate(-0.075, 1.27, zf(1.27) * 0.95 - 0.006); gloss.add(g, 'chest', 0xd8b25a);
    const n = plate(new THREE.Shape([new THREE.Vector2(-0.03, 0), new THREE.Vector2(0.03, 0), new THREE.Vector2(0.03, 0.014), new THREE.Vector2(-0.03, 0.014)]), 0.002, 0.001);
    n.rotateY(PI); n.translate(0.075, 1.25, zf(1.25) * 0.95 - 0.004); gloss.add(n, 'chest', 0xf4f4f2);
    for (const sg of [-1, 1]) { const ep = new THREE.BoxGeometry(0.06, 0.012, 0.09); ep.translate(sg * 0.15, 1.395, 0); top.add(ep, 'chest', 0x1a2c50); }
  }
  if (extras.includes('policeCap') || extras.includes('postCap')) {
    const c = extras.includes('policeCap') ? 0x1f3354 : 0xd8452a, band = extras.includes('policeCap') ? 0x111318 : 0x2a3048;
    // wide peaked crown: spiky hair stays inside it
    const crown = latheGeo([[0.123, 1.615], [0.128, 1.655], [0.162, 1.722], [0.168, 1.756], [0.13, 1.776], [0.0, 1.782]], 30, 1.06);
    crown.translate(H.x, 0, H.z); gloss.add(crown, 'head', c);
    const b = latheGeo([[0.127, 1.612], [0.129, 1.616], [0.129, 1.652], [0.127, 1.656]], 30, 1.06); b.translate(H.x, 0, H.z); gloss.add(b, 'head', band);
    const visor = new THREE.CylinderGeometry(0.125, 0.125, 0.012, 24, 1, false, PI / 2, PI); visor.scale(1, 1, 0.75);
    visor.rotateX(-0.28); visor.translate(H.x, 1.618, H.z - 0.075); gloss.add(visor, 'head', 0x111318);
    const em = ellipsoid(0.022, 0.026, 0.008, 12, 8); em.translate(H.x, 1.69, H.z - 0.152); gloss.add(em, 'head', extras.includes('policeCap') ? 0xd8b25a : 0xf4f4f2);
  }
  if (extras.includes('fireHelmet')) {
    const dome = new THREE.SphereGeometry(1, 30, 14, 0, PI * 2, 0, PI / 2); dome.scale(0.152, 0.148, 0.168); dome.translate(H.x, 1.6, H.z + 0.004);
    gloss.add(dome, 'head', 0xe8b830);
    const brim = latheGeo([[0.14, 1.606], [0.2, 1.585], [0.206, 1.574], [0.2, 1.57], [0.14, 1.592]], 32, 1.18); brim.translate(H.x, 0, H.z + 0.03); gloss.add(brim, 'head', 0xd8a828);
    const ridge = new THREE.BoxGeometry(0.03, 0.035, 0.3); ridge.translate(H.x, 1.745, H.z + 0.01); gloss.add(ridge, 'head', 0xd8a828);
    const ref = latheGeo([[0.153, 1.62], [0.155, 1.625], [0.15, 1.648], [0.147, 1.652]], 30, 1.1); ref.translate(H.x, 0, H.z + 0.004); gloss.add(ref, 'head', 0xd9dcde);
    const sh = ellipsoid(0.04, 0.045, 0.01, 14, 8); sh.translate(H.x, 1.66, H.z - 0.168); gloss.add(sh, 'head', 0xf4f4f2);
  }
  if (extras.includes('reflect')) {
    const yb = o === 'fire' ? 0xd8e04a : 0xd9dcde;
    for (const y of [1.0, 1.21]) {
      const r = (y > 1.1 ? 0.16 : 0.144) * loose + 0.004;
      const g = latheGeo([[r - 0.002, y - 0.018], [r + 0.001, y - 0.014], [r + 0.001, y + 0.014], [r - 0.002, y + 0.018]], 30, 0.72);
      top.add(g, y > 1.1 ? 'chest' : 'spine', yb);
    }
    for (const side of ['L', 'R']) {
      const el = J['elbow' + side], wr = J['hand' + side], kn = J['knee' + side], ft = J['foot' + side];
      top.add(limb(el.clone().lerp(wr, 0.56), el.clone().lerp(wr, 0.68), 0.05, 0.049, { seg: 16, bulge: 0, capA: false, capB: false }), 'elbow' + side, yb);
      if (o === 'fire') bot.add(limb(kn.clone().lerp(ft, 0.6), kn.clone().lerp(ft, 0.7), 0.06, 0.058, { seg: 16, bulge: 0, capA: false, capB: false }), 'knee' + side, yb);
    }
  }
  if (extras.includes('tank')) {
    // tank, backplate and straps stay outside the torso shell (it is seen through from the front otherwise)
    const t = latheGeo([[0, 0.92], [0.06, 0.925], [0.075, 0.96], [0.075, 1.32], [0.06, 1.36], [0.025, 1.38], [0.025, 1.41], [0, 1.41]], 18); t.translate(0, 0, 0.215);
    gloss.add(t, 'chest', 0xc9ced3);
    const bp = new THREE.BoxGeometry(0.2, 0.42, 0.024); bp.translate(0, 1.12, 0.14); top.add(bp, 'chest', 0x2b2d31);
    for (const sg of [-1, 1]) top.add(tubeAlong([V(sg * 0.08, 1.3, 0.14), V(sg * 0.11, 1.425, 0.0), V(sg * 0.1, 1.36, -0.118), V(sg * 0.075, 1.1, -0.128)], 0.012, 10, 5), 'chest', 0x2b2d31);
  }
  if (o === 'doctor') {
    // the white coat goes on down to mid-thigh (a skirt round the hips)
    const sk = latheGeo([[0.158, 0.765], [0.172, 0.755], [0.178, 0.77], [0.174, 0.86], [0.166, 0.96], [0.156, 1.03], [0.149, 1.07]], 32, 0.72); // bottom to top: faces out
    top.add(sk, 'hips', 0xf6f6f2, [{ bone: 'spine', from: V(0, 1.0, 0), dir: V(0, 1, 0), width: 0.04, max: 0.6 }]);
    for (const sg of [-1, 1]) { const pk = new THREE.BoxGeometry(0.075, 0.07, 0.006); pk.translate(sg * 0.085, 0.86, -0.128); top.add(pk, 'hips', 0xe4e4de); }
  }
  if (extras.includes('steth')) {
    for (const sg of [-1, 1]) top.add(tubeAlong([V(0, 1.42, 0.05), V(sg * 0.065, 1.41, -0.02), V(sg * 0.07, 1.33, -0.112), V(sg * 0.05, 1.2, -0.122)], 0.006, 12, 5), 'chest', 0x2b2d31);
    const d = new THREE.CylinderGeometry(0.018, 0.018, 0.01, 16); d.rotateX(PI / 2); d.translate(0.05, 1.185, -0.126); gloss.add(d, 'chest', 0xc9ced3);
  }
  if (extras.includes('vest')) {
    const vg = bodyLoft([[0.96, 0.152, 0.11, 2.4, 0.002], [1.0, 0.149, 0.106, 2.4, 0.0], [1.1, 0.153, 0.11, 2.5, -0.002], [1.2, 0.166, 0.118, 2.6, -0.004], [1.29, 0.17, 0.112, 2.8, -0.002], [1.335, 0.162, 0.1, 2.8, 0.002]], 30, 0);
    // bodyLoft winds its faces inwards (the torso gets away with it through bump()); turn the vest outwards
    const ix = vg.index.array;
    for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    vg.computeVertexNormals();
    top.add(vg, 'chest', 0x1f8a4c, [{ bone: 'spine', from: V(0, 1.12, 0), dir: V(0, -1, 0), width: 0.07, max: 1 }, { bone: 'hips', from: V(0, 0.98, 0), dir: V(0, -1, 0), width: 0.05 }]);
    const tag = new THREE.BoxGeometry(0.06, 0.03, 0.004); tag.translate(-0.07, 1.24, zf(1.24) * 1.05 - 0.008); gloss.add(tag, 'chest', 0xf4f4f2);
    const dot = new THREE.BoxGeometry(0.014, 0.03, 0.005); dot.translate(-0.098, 1.24, zf(1.24) * 1.05 - 0.01); gloss.add(dot, 'chest', 0xf28a1e);
  }
  if (extras.includes('bag')) {
    top.add(tubeAlong([V(-0.12, 1.4, 0.0), V(-0.05, 1.32, -0.12), V(0.08, 1.12, -0.13), V(0.16, 0.98, -0.06)], 0.012, 12, 5), 'chest', 0x3a2a20);
    top.add(tubeAlong([V(-0.12, 1.4, 0.0), V(-0.06, 1.3, 0.12), V(0.08, 1.12, 0.13), V(0.16, 0.98, 0.06)], 0.012, 12, 5), 'chest', 0x3a2a20);
    const bag = new THREE.BoxGeometry(0.07, 0.2, 0.26); bag.translate(0.18, 0.92, 0); gloss.add(bag, 'hips', 0x6b4529);
    const flap = new THREE.BoxGeometry(0.075, 0.08, 0.265); flap.translate(0.181, 0.99, 0); gloss.add(flap, 'hips', 0xd8452a);
  }
}

function buildShoe(shoeB, skinB, side, kind, accent) {
  const f = J['foot' + side], sg = side === 'L' ? -1 : 1;
  const bone = 'foot' + side;
  const base = { sneaker: [0xf2f2ef, 0xffffff], dress: [0x1a1a1c, 0x0f0f10], brown: [0x6a4027, 0x2a1e18], slipper: [0xf1d7c8, 0xd9c0b3], flipflop: [0x2f8fb0, 0xf0e6d0], clog: [0x1d1f22, 0x111213] }[kind] ?? [0x333333, 0x222222];
  if (kind === 'flipflop') {
    // bare foot + flat sole with a thong strap
    let foot = ellipsoid(0.045, 0.032, 0.11, 16, 12); foot.translate(f.x, 0.04, f.z - 0.05); skinB.add(foot, bone);
    skinB.add(limb(V(f.x, 0.04, f.z + 0.005), V(f.x, 0.11, f.z + 0.01), 0.04, 0.036, { seg: 12, capB: false }), bone);
    const s = new THREE.Shape(); s.absellipse(0, 0, 0.05, 0.13, 0, PI * 2);
    const sole = plate(s, 0.012, 0.004); sole.rotateX(PI / 2); sole.translate(f.x, 0.014, f.z - 0.045); shoeB.add(sole, bone, base[1]);
    for (const dx of [-0.032, 0.032]) shoeB.add(tubeAlong([V(f.x, 0.02, f.z - 0.12), V(f.x + dx * 0.6, 0.06, f.z - 0.07), V(f.x + dx, 0.03, f.z - 0.02)], 0.006, 10, 5), bone, base[0]);
    return;
  }
  const len = kind === 'clog' ? 0.27 : 0.26, w = kind === 'slipper' ? 0.105 : 0.098, h = kind === 'dress' ? 0.075 : kind === 'slipper' ? 0.08 : 0.085;
  // upper: an egg-shaped shell, toe forward (-Z), heel slightly behind the ankle
  let up = ellipsoid(w / 2, h, len / 2, 20, 12);
  up = bump(up, (v) => (v.y < 0 ? -v.y * 0.0 : 0));
  const p = up.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < 0) y *= 0.15; // flat bottom
    const toe = sstep(0.0, -len / 2, z);
    y *= 1 - 0.45 * toe; // lower toe box
    if (z > 0) y *= 1 + 0.15 * sstep(0, len / 2, z); // taller heel counter
    x *= 1 - 0.1 * sstep(0, len / 2, z);
    p.setXYZ(i, x, y, z);
  }
  up.computeVertexNormals();
  up.translate(f.x + sg * 0.004, 0.022, f.z - 0.05);
  shoeB.add(up, bone, base[0]);
  // ankle opening + tongue (dark) for sneakers and shoes
  if (kind !== 'clog') {
    const col2 = kind === 'sneaker' ? 0x2b2b2e : kind === 'slipper' ? 0xe7cdbf : 0x0c0c0d;
    const o = new THREE.TorusGeometry(0.036, 0.009, 8, 20); o.rotateX(PI / 2 + 0.25); o.scale(1, 1, 1.25); o.translate(f.x, 0.095, f.z + 0.012);
    shoeB.add(smooth(o), bone, kind === 'slipper' ? 0xf6e4da : base[0]);
    const tg = ellipsoid(0.03, 0.012, 0.045, 10, 8); tg.rotateX(-0.6); tg.translate(f.x, 0.085, f.z - 0.035); shoeB.add(tg, bone, col2 === 0x2b2b2e ? base[0] : col2);
  }
  // sole: flat rounded footprint, slightly wider
  const s = new THREE.Shape();
  s.moveTo(0, -len / 2 - 0.006); s.bezierCurveTo(w * 0.62, -len / 2, w * 0.6, 0.02, w * 0.48, len / 2 - 0.02); s.quadraticCurveTo(0, len / 2 + 0.012, -w * 0.48, len / 2 - 0.02); s.bezierCurveTo(-w * 0.6, 0.02, -w * 0.62, -len / 2, 0, -len / 2 - 0.006);
  const sole = plate(s, kind === 'clog' ? 0.022 : 0.016, 0.005);
  sole.rotateX(PI / 2);
  sole.translate(f.x + sg * 0.004, 0.021, f.z - 0.05);
  shoeB.add(sole, bone, base[1]);
  if (kind === 'sneaker') {
    // side swoosh stripe + laces
    for (const s2 of [-1, 1]) {
      const pts = [V(f.x + s2 * (w / 2 + 0.001), 0.04, f.z + 0.03), V(f.x + s2 * (w / 2 - 0.002), 0.055, f.z - 0.04), V(f.x + s2 * (w / 2 - 0.012), 0.06, f.z - 0.1)];
      shoeB.add(tubeAlong(pts, 0.006, 10, 5), bone, accent);
    }
    for (let i = 0; i < 3; i++) { const z = f.z - 0.035 - i * 0.022; const l = new THREE.BoxGeometry(0.04, 0.005, 0.006); l.rotateX(-0.5); l.translate(f.x, 0.083 - i * 0.008, z); shoeB.add(l, bone, 0xffffff); }
  }
}

// ------------------------------------------------------------------------------------------ assembly
/**
 * buildCharacter({skin, hair, hairColor, outfit, seed}) → {group, setOutfit(name), update(dt, state), height}
 * state = {speed (m/s), mode: 'idle'|'walk'|'run'|'sit'|'type'|'eat'|'wave'|'drive', seat?: seat height (0.46)}
 */
export function buildCharacter({ skin, hair = 'short', hairColor = 0x2a211c, outfit = 'casual', seed = 1 } = {}) {
  const R = rng(seed * 97 + 5);
  const tone = skin ?? SKIN_TONES[Math.floor(R() * 3)];
  const group = new THREE.Group();
  group.name = 'character';
  const bones = makeSkeleton();
  group.add(bones.hips);
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(BONES.map((n) => bones[n]));

  const meshes = {};
  const mk = (key, geo, material) => {
    if (meshes[key]) { group.remove(meshes[key]); meshes[key].geometry.dispose(); delete meshes[key]; }
    if (!geo) return;
    const m = new THREE.SkinnedMesh(geo, material);
    m.name = key;
    m.castShadow = key !== 'face'; m.receiveShadow = true; // eyes and mouth lie on the head: the head's shadow covers theirs
    m.bind(skeleton, new THREE.Matrix4());
    m.boundingSphere = new THREE.Sphere(V(0, 0.85, 0), 1.25);
    m.frustumCulled = true;
    group.add(m);
    meshes[key] = m;
  };
  // fixed parts: head, face, hair, hands
  // head, face and hands are the same for everyone, hair per style: made once, shared
  const skinFixed = new Bucket(), faceB = new Bucket(), hairB = new Bucket();
  cachedParts('head', [faceB, skinFixed], () => { buildHead(skeleton, faceB, skinFixed); buildHands(skinFixed); });
  cachedParts('hair|' + hair, [hairB], () => { buildHair(hairB, hair); buildEyebrows(hairB, hairColor); });
  // the merged face and hair geometry is shared too (never disposed: mk only replaces outfit meshes)
  mk('face', sharedGeo('face', () => faceB.build()), faceMat());
  mk('hair', sharedGeo('hair|' + hair, () => hairB.build()), hairMat(hairColor));

  let current = null;
  function setOutfit(name) {
    if (!OUTFITS.includes(name)) name = 'casual';
    current = name;
    const B = { top: new Bucket(), bottom: new Bucket(), shoes: new Bucket() };
    const skinB = new Bucket();
    skinB.parts.push(...skinFixed.parts);
    const kinds = dressUp(name, B, skinB, seed);
    mk('skin', skinB.build(), skinMat(tone));
    mk('top', B.top.build(), topMat(kinds.topKind));
    mk('bottom', B.bottom.build(), topMat(kinds.botKind));
    mk('shoes', B.shoes.build(), shoeMat());
    if (meshes.hair) meshes.hair.visible = name !== 'fire'; // under the fire helmet
  }
  setOutfit(outfit);

  // ---------------------------------------------------------------- animation
  const rest = {};
  for (const n of BONES) rest[n] = bones[n].position.clone();
  let phase = R() * 10, t = R() * 10, blinkT = 1 + R() * 3, blink = 0, wavePh = 0, mix = { walk: 0, sit: 0 };
  const b = bones;
  function update(dt, state = {}) {
    const mode = state.mode ?? 'idle', speed = state.speed ?? 0;
    t += dt;
    const sitting = mode === 'sit' || mode === 'type' || mode === 'eat' || mode === 'drive';
    const moving = !sitting && (mode === 'walk' || mode === 'run' || speed > 0.15);
    const run = mode === 'run' || speed > 2.6;
    mix.walk = lerp(mix.walk, moving ? 1 : 0, 1 - Math.exp(-dt * 8));
    mix.sit = lerp(mix.sit, sitting ? 1 : 0, 1 - Math.exp(-dt * 6));
    const stride = run ? 1.25 : 0.72;
    const v = moving ? Math.max(speed, run ? 3.2 : 1.2) : 0;
    phase += (v / (stride * 2)) * PI * 2 * dt;
    const w = mix.walk, s = mix.sit;
    // reset
    for (const n of BONES) { b[n].rotation.set(0, 0, 0); b[n].position.copy(rest[n]); b[n].scale.set(1, 1, 1); }
    const A = run ? 0.75 : 0.42, Ak = run ? 1.25 : 0.65, Aa = run ? 0.9 : 0.42;
    for (const [side, off] of [['L', 0], ['R', PI]]) {
      const p = phase + off;
      const swing = Math.sin(p) * A * w;
      const knee = -(Math.max(0, Math.cos(p - 0.35)) ** 1.4) * Ak * w - (run ? 0.25 * w : 0.06 * w);
      b['thigh' + side].rotation.x = swing;
      b['knee' + side].rotation.x = knee;
      b['foot' + side].rotation.x = -(swing + knee) * 0.55 * w;
      const arm = -Math.sin(p) * Aa * w;
      b['shoulder' + side].rotation.x = arm;
      b['shoulder' + side].rotation.z = (side === 'L' ? -1 : 1) * 0.04;
      b['elbow' + side].rotation.x = (run ? 1.35 : 0.22 + Math.max(0, -arm) * 0.5) * w + 0.1 * (1 - w);
    }
    // body bob, lean and twist
    const bob = (run ? 0.05 : 0.028) * w;
    b.hips.position.y = rest.hips.y - bob * Math.sin(phase * 2 - PI / 2) * 0.5 - bob * 0.5;
    b.hips.rotation.y = Math.sin(phase) * 0.08 * w;
    b.chest.rotation.y = -Math.sin(phase) * 0.14 * w;
    b.spine.rotation.x = -(run ? 0.18 : 0.04) * w;
    b.hips.rotation.z = Math.sin(phase) * 0.03 * w;
    // idle life: breathing, small sway, looking around, blinking
    const breath = Math.sin(t * 1.6);
    b.chest.scale.set(1 + 0.01 * breath, 1 + 0.008 * breath, 1 + 0.015 * breath);
    b.chest.rotation.x += 0.01 * breath;
    b.hips.position.x = Math.sin(t * 0.5) * 0.012 * (1 - w) * (1 - s);
    b.head.rotation.y = Math.sin(t * 0.37) * 0.25 * (1 - w) + Math.sin(t * 0.13) * 0.1;
    b.head.rotation.x = Math.sin(t * 0.29) * 0.05;
    blinkT -= dt;
    if (blinkT < 0) { blink = 0.16; blinkT = 2 + Math.random() * 3.5; }
    blink = Math.max(0, blink - dt);
    const lid = blink > 0 ? Math.max(0.08, Math.abs(blink - 0.08) / 0.08) : 1;
    b.eyeL.scale.y = b.eyeR.scale.y = lid;
    // sitting family
    if (s > 0.001) {
      const seat = state.seat ?? (mode === 'drive' ? 0.36 : 0.46);
      b.hips.position.y = lerp(b.hips.position.y, seat + 0.07, s);
      b.hips.position.z = lerp(b.hips.position.z, 0.1, s);
      for (const side of ['L', 'R']) {
        b['thigh' + side].rotation.x = lerp(b['thigh' + side].rotation.x, mode === 'drive' ? 1.35 : 1.57, s);
        b['knee' + side].rotation.x = lerp(b['knee' + side].rotation.x, mode === 'drive' ? -0.95 : -1.57, s);
        b['foot' + side].rotation.x = lerp(b['foot' + side].rotation.x, mode === 'drive' ? -0.2 : 0, s);
        b['thigh' + side].rotation.z = (side === 'L' ? 1 : -1) * 0.04 * s;
      }
      b.spine.rotation.x = lerp(b.spine.rotation.x, mode === 'drive' ? 0.12 : 0.0, s);
      // arms
      let ua = 0.25, el = 1.1;
      if (mode === 'type') { ua = 0.42; el = 1.15; }
      if (mode === 'drive') { ua = 0.95; el = 0.55; }
      for (const side of ['L', 'R']) {
        const sg = side === 'L' ? -1 : 1;
        b['shoulder' + side].rotation.x = lerp(b['shoulder' + side].rotation.x, ua, s);
        b['shoulder' + side].rotation.z = lerp(b['shoulder' + side].rotation.z, sg * (mode === 'drive' ? -0.12 : 0.08), s);
        b['elbow' + side].rotation.x = lerp(b['elbow' + side].rotation.x, el, s);
        b['elbow' + side].rotation.y = sg * (mode === 'type' || mode === 'drive' ? 0.35 : 0.2) * s;
        if (mode === 'type') {
          const tap = Math.max(0, Math.sin(t * 13 + (sg > 0 ? 0 : 1.7) + Math.sin(t * 3.1) * 2));
          b['hand' + side].rotation.x = -0.25 * s + tap * 0.18;
        }
        if (mode === 'drive') { b['hand' + side].rotation.z = -sg * 0.5 * s; b['hand' + side].rotation.x = -0.4 * s; }
      }
      b.head.rotation.x = lerp(b.head.rotation.x, mode === 'type' ? 0.12 : 0.03, s);
      if (mode === 'type') b.head.rotation.y *= 0.2;
      if (mode === 'eat') {
        const c = 0.5 - 0.5 * Math.cos(t * 2.1);
        const lift = sstep(0.2, 0.85, c);
        b.shoulderR.rotation.x = lerp(0.3, 0.85, lift) * s;
        b.shoulderR.rotation.z = lerp(0.1, 0.35, lift) * s;
        b.elbowR.rotation.x = lerp(1.15, 2.45, lift) * s;
        b.elbowR.rotation.y = lerp(0.2, 0.9, lift) * s;
        b.handR.rotation.x = -0.4 * lift * s;
        b.head.rotation.x = lerp(0.08, -0.05, lift) * s;
        b.head.rotation.y *= 0.3;
      }
    }
    if (mode === 'wave') {
      wavePh += dt * 9;
      b.shoulderR.rotation.z = 2.55;
      b.shoulderR.rotation.x = -0.15;
      b.elbowR.rotation.x = 0.0;
      b.elbowR.rotation.z = 0.35 + Math.sin(wavePh) * 0.4;
      b.handR.rotation.z = Math.sin(wavePh - 0.6) * 0.2;
      b.head.rotation.z = -0.06;
      b.head.rotation.y = 0;
    }
  }
  update(0, { mode: 'idle' });
  return {
    group, setOutfit, update, height: 1.73,
    get outfit() { return current; },
    bones, skeleton,
  };
}

// ------------------------------------------------------------------------------------------ first-person arm
/**
 * buildFirstPersonArm({outfit}) → {group, setOutfit(name), hold(object3D|null), update(dt, {swing, walk})}
 * The group goes on the camera. The hand rests near (0.32, -0.32, -0.55) in camera space, pointing -Z.
 * hold(obj) puts obj in the fist (obj origin in the palm; the game scales it, ~0.15-0.3 m works).
 */
export function buildFirstPersonArm({ outfit = 'casual', skin } = {}) {
  const tone = skin ?? SKIN_TONES[1];
  const group = new THREE.Group();
  group.name = 'fpArm';
  const pivot = new THREE.Group(); // shoulder-ish pivot below the camera, swings for actions
  const P0 = V(0.46, -0.6, 0.0);
  pivot.position.copy(P0);
  group.add(pivot);
  const arm = new THREE.Group();
  pivot.add(arm);
  // forearm enters from the bottom-right corner and ends at the wrist (pivot space)
  const wrist = V(-0.125, 0.27, -0.5), elbow = V(0.07, 0.02, -0.2);
  const skinM = paint(tone, 0.55, 0, { sheen: 0.35 });
  let sleeve = null, cuffM = null;
  const meshes = [];
  const add = (geo, material) => { const m = new THREE.Mesh(prep(geo), material); m.castShadow = false; m.receiveShadow = false; arm.add(m); meshes.push(m); return m; };
  // skin forearm and the fist
  const fore = limb(elbow, wrist, 0.048, 0.036, { seg: 22, bulge: 0.08 });
  const foreMesh = add(fore, skinM);
  const hand = new THREE.Group();
  hand.position.copy(wrist);
  {
    // hand +Y along the forearm, +Z (palm / finger curl side) towards the screen centre and a bit up
    const y = wrist.clone().sub(elbow).normalize();
    const z = V(-1, 0.25, 0.1).normalize(); z.addScaledVector(y, -z.dot(y)).normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    hand.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  }
  arm.add(hand);
  const handParts = [];
  {
    // palm block along +Y (hand space: +Y = towards the fingers, -Z = back of the hand faces up/forward)
    let palm = ellipsoid(0.042, 0.05, 0.026, 24, 18);
    palm = bump(palm, (v) => -0.004 * sstep(0.0, 0.03, v.z) * (1 - Math.abs(v.x) / 0.05));
    palm.translate(0, 0.045, 0);
    handParts.push(palm);
    // four curled fingers (two segments each) wrapping towards the palm side (+Z)
    for (let i = 0; i < 4; i++) {
      const x = lerp(-0.027, 0.03, i / 3), l = [0.92, 1, 0.96, 0.82][i];
      const k1 = V(x, 0.088 * l + 0.004, -0.004), k2 = V(x * 1.02, 0.112 * l, 0.022), k3 = V(x * 1.02, 0.096 * l, 0.045);
      handParts.push(limb(V(x, 0.07, -0.006), k1, 0.0135, 0.013, { seg: 12, bulge: 0.04 }));
      handParts.push(limb(k1, k2, 0.0132, 0.0125, { seg: 12, bulge: 0.04 }));
      handParts.push(limb(k2, k3, 0.0122, 0.0112, { seg: 12, bulge: 0.03 }));
      // knuckle
      const kn = ellipsoid(0.012, 0.011, 0.011, 10, 8); kn.translate(k1.x, k1.y, k1.z - 0.002); handParts.push(kn);
    }
    // thumb across the fingers
    handParts.push(limb(V(-0.036, 0.03, 0.01), V(-0.042, 0.065, 0.032), 0.016, 0.014, { seg: 10 }));
    handParts.push(limb(V(-0.042, 0.065, 0.032), V(-0.018, 0.088, 0.046), 0.014, 0.012, { seg: 10 }));
    // fingernails
  }
  { const m = new THREE.Mesh(mergeGeometries(handParts.map((g) => prep(g))), skinM); m.castShadow = false; hand.add(m); meshes.push(m); }
  const nails = [];
  for (let i = 0; i < 4; i++) {
    const x = lerp(-0.027, 0.03, i / 3), l = [0.92, 1, 0.96, 0.82][i];
    const n = ellipsoid(0.0065, 0.0015, 0.0055, 10, 6); n.rotateX(1.25); n.translate(x * 1.02, 0.097 * l - 0.004, 0.0505);
    nails.push(n);
  }
  const nailM = paint(shade(tone, 1.04), 0.3);
  { const m = new THREE.Mesh(mergeGeometries(nails.map((g) => prep(g))), nailM); m.castShadow = false; hand.add(m); }
  // grip anchor in the fist
  const grip = new THREE.Group();
  grip.position.set(0.0, 0.08, 0.03);
  hand.add(grip);
  // sleeve: covers the forearm from the elbow to near the wrist
  const sleeveGeo = () => limb(elbow.clone().lerp(wrist, -0.6), elbow.clone().lerp(wrist, 0.8), 0.068, 0.054, { seg: 28, bulge: 0.05, folds: 0.07, rnd: rng(3), capB: false });
  const cuffGeo = () => limb(elbow.clone().lerp(wrist, 0.78), elbow.clone().lerp(wrist, 0.88), 0.052, 0.05, { seg: 28, bulge: 0, capA: false, capB: false });
  function setOutfit(name) {
    if (sleeve) { arm.remove(sleeve); arm.remove(cuffM); }
    const look = {
      pajama: [topMat('stripes'), 0xffffff, 0xf0f0f0, true], suit: [topMat('cloth'), 0x232f4d, 0xf2f2f0, true], office: [topMat('cloth'), 0xcfe0f2, 0xc6d8ec, true],
      casual: [topMat('cloth'), 0xe07a3c, 0xc96a30, true], beach: [topMat('floral'), 0xffffff, 0xffffff, false], chef: [topMat('cloth'), 0xf6f5f0, 0xe6e4dc, true],
      police: [topMat('cloth'), 0x26406e, 0x1a2c50, true], fire: [topMat('fabric'), 0xb89a5a, 0xd8e04a, true], doctor: [topMat('cloth'), 0xf6f6f2, 0xe8e8e2, true],
      mart: [topMat('cloth'), 0xf4f4f2, 0xe4e4e0, true], post: [topMat('cloth'), 0xd8452a, 0xd9dcde, true],
    }[name] ?? [topMat('cloth'), 0xe07a3c, 0xc96a30, true];
    const [m, c, cc, long] = look;
    if (!long) { sleeve = new THREE.Group(); cuffM = new THREE.Group(); return; }
    const colorize = (g, h) => { const n = g.attributes.position.count, a = new Float32Array(n * 3), cl = col(h); for (let i = 0; i < n; i++) { a[i * 3] = cl.r; a[i * 3 + 1] = cl.g; a[i * 3 + 2] = cl.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
    sleeve = new THREE.Mesh(colorize(prep(sleeveGeo()), c), m);
    cuffM = new THREE.Mesh(colorize(prep(cuffGeo()), cc), m);
    arm.add(sleeve, cuffM);
  }
  setOutfit(outfit);
  let held = null;
  function hold(obj) {
    if (held) grip.remove(held);
    held = obj || null;
    if (held) grip.add(held);
  }
  let t = 0;
  function update(dt, { swing = 0, walk = 0 } = {}) {
    t += dt;
    // swing: punch/place motion forward and down; walk: bob and sway
    const sw = Math.sin(clamp(swing, 0, 1) * PI);
    pivot.rotation.set(-0.55 * sw + Math.sin(t * 7) * 0.015 * walk, 0.12 * sw, 0.1 * sw);
    pivot.position.set(P0.x + Math.sin(t * 3.6) * 0.012 * walk, P0.y + Math.abs(Math.cos(t * 3.6)) * 0.016 * walk + Math.sin(t * 1.3) * 0.003, P0.z - 0.05 * sw);
  }
  update(0, {});
  void foreMesh;
  return { group, setOutfit, hold, update, grip, hand };
}

// ------------------------------------------------------------------------------------------ viewer helpers
/** All outfits and hair styles in a row. */
export function characterLineup(args = {}) {
  const g = new THREE.Group();
  const list = [
    ['pajama', 'short', 0x2a211c, 0], ['suit', 'spiky', 0x1c1714, 1], ['office', 'bob', 0x3a2618, 2], ['casual', 'short', 0x2a211c, 1],
    ['casual', 'bun', 0x5a3a24, 2], ['beach', 'long', 0x1c1714, 0], ['chef', 'short', 0x2f2620, 4],
  ];
  const people = [];
  list.forEach(([outfit, hair, hc, s], i) => {
    const c = buildCharacter({ outfit, hair, hairColor: hc, seed: i + 1, skin: SKIN_TONES[s] });
    c.group.position.x = (i - (list.length - 1) / 2) * 0.75;
    c.update(0.016, { mode: args.mode ?? 'idle', speed: args.speed ?? 0 });
    if (args.phase) for (let k = 0; k < args.phase; k++) c.update(0.033, { mode: args.mode ?? 'idle', speed: args.speed ?? 0 });
    g.add(c.group);
    people.push(c);
  });
  g.userData.people = people;
  return g;
}
/** One posed person: args {outfit, hair, mode, speed, steps}. */
export function characterPose(args = {}) {
  const c = buildCharacter(args);
  for (let k = 0; k < (args.steps ?? 10); k++) c.update(0.033, { mode: args.mode ?? 'idle', speed: args.speed ?? 0 });
  return c;
}
/** Camera-like frame for the first-person arm: camera at (0, 1.6, 0) looking -Z. */
export async function fpArmView(args = {}) {
  const g = new THREE.Group();
  const a = buildFirstPersonArm({ outfit: args.outfit ?? 'casual' });
  a.group.position.set(0, 1.6, 0);
  if (args.hold !== false) {
    const { BLOCKS } = await import('./blocks.js');
    const def = BLOCKS.find((b) => b.id === (args.hold ?? 'stone')) ?? BLOCKS[0];
    const item = def.build(1);
    item.scale.setScalar(0.13);
    item.position.set(0.0, 0.0, 0.05);
    item.rotation.set(-0.5, 0.5, 0.4);
    a.hold(item);
  }
  a.update(0.016, { swing: args.swing ?? 0, walk: 0 });
  g.add(a.group);
  return g;
}
/** Viewer helper: one outfit in every animation mode, side by side. */
export function characterModes(args = {}) {
  const g = new THREE.Group();
  const modes = [['idle', 0], ['walk', 1.4], ['run', 4], ['sit', 0], ['type', 0], ['eat', 0], ['wave', 0], ['drive', 0]];
  modes.forEach(([mode, speed], i) => {
    const c = buildCharacter({ outfit: args.outfit ?? 'office', hair: args.hair ?? 'short', seed: 3 + i });
    for (let k = 0; k < (args.steps ?? 14); k++) c.update(0.033, { mode, speed });
    c.group.position.x = (i - (modes.length - 1) / 2) * 0.9;
    g.add(c.group);
  });
  return g;
}
