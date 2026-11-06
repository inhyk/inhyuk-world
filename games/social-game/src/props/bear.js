// 반달가슴곰 (Asiatic black bear, Ursus thibetanus) for the forest (인혁: "곰은 반달가슴곰에 진짜 곰처럼").
// One skeleton and three skinned meshes that share it:
//  - fur: one lofted body (rump → torso → thick neck → head → muzzle), four leg tubes with
//    plantigrade paws, big round ears and a stub tail, under a procedural strand texture with sheen,
//  - hair: about a thousand alpha-to-coverage fur cards (the lion-like neck ruff, shaggy flanks,
//    belly fringe, leg feathering) that carry the cream chest crescent ("반달") in their colours,
//  - gloss: wet nose, small dark eyes, curved claws.
// Origin on the ground under the belly, faces -Z, about 1.5 m nose to rump, 0.8 m at the shoulder.
// Procedural animation with two-bone leg IK on uneven ground: four-beat lateral walk with rolling
// shoulders and head bob, gallop (bluff charge), idle, sniff, stand up on the hind legs, sit, and
// huff / ear overlays. Geometry and materials are built once and shared by every bear.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '../noise.js';

const PI = Math.PI, TAU = PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));

// ------------------------------------------------------------------------------------------ skeleton
// bind pose joints (metres, bear space). Legs: shoulder blade → upper arm → forearm → front paw,
// thigh → shin → hind foot. Every bone frame is axis aligned in the bind pose.
const J = {
  pelvis: V(0, 0.56, 0.36), spine: V(0, 0.585, 0.05), chest: V(0, 0.6, -0.23), neck: V(0, 0.635, -0.43),
  head: V(0, 0.685, -0.56), jaw: V(0, 0.652, -0.635), tail: V(0, 0.63, 0.6),
  earL: V(-0.108, 0.778, -0.565), scapL: V(-0.115, 0.75, -0.19), humL: V(-0.15, 0.5, -0.245), foreL: V(-0.16, 0.275, -0.2), pawL: V(-0.155, 0.062, -0.255),
  thighL: V(-0.135, 0.545, 0.37), shinL: V(-0.15, 0.3, 0.295), footL: V(-0.15, 0.07, 0.43),
};
for (const k of Object.keys(J)) if (k.endsWith('L')) J[k.slice(0, -1) + 'R'] = J[k].clone().setX(-J[k].x);
const PARENT = {
  pelvis: null, spine: 'pelvis', chest: 'spine', neck: 'chest', head: 'neck', jaw: 'head', tail: 'pelvis',
  earL: 'head', earR: 'head', scapL: 'chest', scapR: 'chest', humL: 'scapL', humR: 'scapR', foreL: 'humL', foreR: 'humR', pawL: 'foreL', pawR: 'foreR',
  thighL: 'pelvis', thighR: 'pelvis', shinL: 'thighL', shinR: 'thighR', footL: 'shinL', footR: 'shinR',
};
const BONES = Object.keys(PARENT);
const BI = Object.fromEntries(BONES.map((n, i) => [n, i]));
// toe tips (paw ends), used for the plantigrade foot pivot
const TOE = { L: { front: V(-0.15, 0.02, -0.366), hind: V(-0.15, 0.02, 0.25) } };
TOE.R = { front: TOE.L.front.clone().setX(0.15), hind: TOE.L.hind.clone().setX(0.15) };

// ------------------------------------------------------------------------------------------ shapes
// body sections, rump tip → nose: [z, centre y, half width, top, bottom, superellipse n]
const BODY = [
  [0.662, 0.602, 0.03, 0.03, 0.03, 2],
  [0.648, 0.6, 0.11, 0.12, 0.13, 2.2],
  [0.598, 0.597, 0.178, 0.192, 0.212, 2.3],
  [0.5, 0.591, 0.208, 0.216, 0.246, 2.4],
  [0.37, 0.584, 0.214, 0.219, 0.256, 2.4],
  [0.2, 0.577, 0.207, 0.207, 0.257, 2.3],
  [0.04, 0.577, 0.212, 0.206, 0.26, 2.3],
  [-0.1, 0.587, 0.218, 0.216, 0.263, 2.3],
  [-0.22, 0.6, 0.215, 0.223, 0.262, 2.3],
  [-0.32, 0.612, 0.198, 0.206, 0.232, 2.2],
  [-0.4, 0.634, 0.182, 0.18, 0.18, 2.1],
  [-0.47, 0.658, 0.17, 0.158, 0.152, 2.1],
  [-0.535, 0.678, 0.158, 0.138, 0.124, 2.1],
  [-0.59, 0.693, 0.157, 0.132, 0.104, 2.2],
  [-0.64, 0.692, 0.132, 0.114, 0.09, 2.3],
  [-0.678, 0.682, 0.09, 0.083, 0.075, 2.3],
  [-0.718, 0.672, 0.07, 0.066, 0.065, 2.3],
  [-0.758, 0.667, 0.059, 0.056, 0.055, 2.2],
  [-0.787, 0.664, 0.05, 0.047, 0.046, 2.1],
  [-0.805, 0.663, 0.038, 0.036, 0.035, 2],
];
// leg sections, top (inside the body) → toes: [x, y, z, lateral radius, other radius]
const FRONT = [
  [-0.1, 0.76, -0.19, 0.07, 0.08], [-0.13, 0.66, -0.215, 0.1, 0.13], [-0.145, 0.56, -0.235, 0.104, 0.13],
  [-0.152, 0.45, -0.24, 0.092, 0.112], [-0.157, 0.35, -0.228, 0.083, 0.1], [-0.16, 0.275, -0.21, 0.079, 0.094],
  [-0.159, 0.19, -0.222, 0.075, 0.084], [-0.157, 0.115, -0.242, 0.07, 0.074], [-0.155, 0.07, -0.258, 0.066, 0.066],
  [-0.154, 0.047, -0.29, 0.07, 0.047], [-0.152, 0.038, -0.325, 0.072, 0.038], [-0.15, 0.034, -0.352, 0.064, 0.03], [-0.149, 0.033, -0.368, 0.05, 0.022],
];
const HIND = [
  [-0.08, 0.77, 0.4, 0.07, 0.08], [-0.115, 0.67, 0.39, 0.12, 0.16], [-0.135, 0.56, 0.37, 0.128, 0.155],
  [-0.144, 0.45, 0.335, 0.11, 0.13], [-0.149, 0.36, 0.31, 0.092, 0.108], [-0.151, 0.295, 0.305, 0.082, 0.096],
  [-0.152, 0.21, 0.345, 0.07, 0.08], [-0.151, 0.13, 0.395, 0.064, 0.07], [-0.15, 0.085, 0.43, 0.062, 0.066],
  [-0.15, 0.05, 0.435, 0.064, 0.05], [-0.15, 0.04, 0.375, 0.068, 0.04], [-0.15, 0.035, 0.31, 0.068, 0.034],
  [-0.15, 0.033, 0.268, 0.062, 0.028], [-0.15, 0.032, 0.248, 0.048, 0.02],
];

// ------------------------------------------------------------------------------------------ colours
const C = (h) => new THREE.Color(h);
const COL = {
  fur: C(0x161312), furBrown: C(0x231c17), crescent: C(0xe9e1cf), muzzle: C(0x9b7956), muzzleDark: C(0x5a4433),
  chin: C(0xcfc3ad), lip: C(0x120c0b), mouth: C(0x2a0f0e), sole: C(0x2a2624), earIn: C(0x3a302a), nose: C(0x0d0c0c),
};
// crescent ("반달") on the chest front: a ∪ band, wide in the middle and thin at the tips
function crescentMask(p) {
  if (p.z > -0.27 || p.z < -0.52 || p.y > 0.64) return 0;
  let best = 9, tb = 0;
  for (let i = 0; i <= 24; i++) {
    const t = -1 + i / 12;
    const cx = 0.165 * t, cy = 0.432 + 0.15 * t * t;
    const d = Math.hypot(p.x - cx, p.y - cy);
    if (d < best) { best = d; tb = t; }
  }
  const half = 0.036 * (1 - 0.6 * Math.abs(tb)) + 0.004;
  return 1 - sstep(half - 0.006, half + 0.004, best);
}
// colour of the fur at a bind-pose point (body, legs, head)
function furColour(p, part, out = new THREE.Color()) {
  out.copy(COL.fur);
  // a faint brown cast on the flanks, legs and rump (black bears are never pure black in sun)
  out.lerp(COL.furBrown, 0.35 * sstep(0.5, 0.25, p.y) + 0.25 * sstep(0.2, 0.6, p.z));
  if (part === 'body') {
    const muz = sstep(-0.675, -0.715, p.z) * (1 - sstep(0.07, 0.1, Math.abs(p.x)));
    if (muz > 0) {
      out.lerp(COL.muzzle, muz * (1 - 0.3 * sstep(0.7, 0.74, p.y)));
      out.lerp(COL.muzzleDark, sstep(-0.76, -0.795, p.z) * 0.75);
    }
    // white chin under the mouth
    const chin = sstep(-0.6, -0.66, p.z) * sstep(0.63, 0.605, p.y) * (1 - sstep(-0.77, -0.8, p.z));
    out.lerp(COL.chin, chin * 0.85);
    out.lerp(COL.crescent, crescentMask(p));
  }
  if (part === 'paw') out.lerp(COL.sole, sstep(0.03, 0.012, p.y));
  return out;
}

// ------------------------------------------------------------------------------------------ geometry
/** Mesh accumulator with skinning. */
class Part {
  constructor() { this.P = []; this.N = []; this.U = []; this.Cl = []; this.SI = []; this.SW = []; this.I = []; this.n = 0; }
  vert(p, nrm, u, v, col, weights) {
    this.P.push(p.x, p.y, p.z); this.N.push(nrm.x, nrm.y, nrm.z); this.U.push(u, v); this.Cl.push(col.r, col.g, col.b);
    const w = weights.slice().sort((a, b) => b[1] - a[1]).slice(0, 4);
    let tot = 0; for (const x of w) tot += x[1];
    for (let i = 0; i < 4; i++) { this.SI.push(w[i] ? BI[w[i][0]] : 0); this.SW.push(w[i] ? w[i][1] / tot : 0); }
    return this.n++;
  }
  tri(a, b, c) { this.I.push(a, b, c); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.Cl, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.SI, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.SW, 4));
    g.setIndex(this.I);
    return g;
  }
}

/**
 * Lofted closed tube through control sections {p, w, ht, hb, n}: Catmull-Rom between them, rings
 * of M points (seam on the -up side), rounded caps. Returns a grid of {p, n, t (along), up, s, a}.
 */
function loft(ctrl, { M = 28, sub = 3, side = V(1, 0, 0), dome = 0.6 } = {}) {
  const cr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  const G = (i) => ctrl[clamp(i, 0, ctrl.length - 1)];
  const rings = [];
  for (let i = 0; i < ctrl.length - 1; i++) for (let k = 0; k < sub; k++) {
    const t = k / sub, A = G(i - 1), B = G(i), Cc = G(i + 1), D = G(i + 2);
    const r = { p: V(cr(A.p.x, B.p.x, Cc.p.x, D.p.x, t), cr(A.p.y, B.p.y, Cc.p.y, D.p.y, t), cr(A.p.z, B.p.z, Cc.p.z, D.p.z, t)) };
    for (const key of ['w', 'ht', 'hb', 'n']) r[key] = Math.max(0.002, cr(A[key], B[key], Cc[key], D[key], t));
    rings.push(r);
  }
  rings.push({ ...ctrl[ctrl.length - 1], p: ctrl[ctrl.length - 1].p.clone() });
  // frames
  for (let i = 0; i < rings.length; i++) {
    const a = rings[Math.max(0, i - 1)].p, b = rings[Math.min(rings.length - 1, i + 1)].p;
    const t = b.clone().sub(a).normalize();
    const s = side.clone().addScaledVector(t, -side.dot(t)).normalize();
    rings[i].t = t; rings[i].s = s; rings[i].up = s.clone().cross(t);
  }
  // domes on both ends
  const f = rings[0], l = rings[rings.length - 1];
  const capRings = (r, dir) => {
    const out = [];
    const len = Math.min(r.w, r.ht, r.hb) * dome;
    for (let j = 3; j >= 1; j--) {
      const a = (j / 4) * (PI / 2), k = Math.cos(a) ** 0.7;
      out.push({ ...r, p: r.p.clone().addScaledVector(r.t, dir * len * Math.sin(a)), w: r.w * k, ht: r.ht * k, hb: r.hb * k });
    }
    return out;
  };
  const all = [...capRings(f, -1).reverse(), ...rings, ...capRings(l, 1)];
  // arc length along the centre
  let acc = 0;
  for (let i = 0; i < all.length; i++) { if (i) acc += all[i].p.distanceTo(all[i - 1].p); all[i].s0 = acc; }
  const grid = all.map((r) => {
    const pts = [];
    for (let k = 0; k < M; k++) {
      const a = -PI / 2 + (k / M) * TAU, ca = Math.cos(a), sa = Math.sin(a);
      const x = r.w * Math.sign(ca) * Math.abs(ca) ** (2 / r.n);
      const y = (sa > 0 ? r.ht : r.hb) * Math.sign(sa) * Math.abs(sa) ** (2 / r.n);
      pts.push({ p: r.p.clone().addScaledVector(r.s, x).addScaledVector(r.up, y), a, s: r.s0 });
    }
    return { r, pts };
  });
  const tipA = { p: f.p.clone().addScaledVector(f.t, -Math.min(f.w, f.ht, f.hb) * dome), s: 0 };
  const tipB = { p: l.p.clone().addScaledVector(l.t, Math.min(l.w, l.ht, l.hb) * dome), s: acc + 0.01 };
  // smooth normals from the grid
  const nR = grid.length;
  const P = (i, k) => grid[clamp(i, 0, nR - 1)].pts[(k + M) % M].p;
  for (let i = 0; i < nR; i++) for (let k = 0; k < M; k++) {
    const du = P(i + 1, k).clone().sub(P(i - 1, k)), dv = P(i, k + 1).clone().sub(P(i, k - 1));
    const n = du.clone().cross(dv);
    if (n.lengthSq() < 1e-12) n.copy(grid[i].pts[k].p).sub(grid[i].r.p);
    grid[i].pts[k].n = n.normalize();
    grid[i].pts[k].t = du.normalize();
  }
  tipA.n = f.t.clone().negate(); tipB.n = l.t.clone();
  return { grid, M, tipA, tipB, length: acc };
}

/** Write a loft into a Part with colours and skin weights per vertex; returns the vertex index grid. */
function addLoft(part, L, colourAt, weightsAt, vSign = 1, uvScale = null) {
  const { grid, M } = L;
  const idx = [];
  const tmp = new THREE.Color();
  for (let i = 0; i < grid.length; i++) {
    const row = [];
    // perimeter-based u so the strand texture keeps its size
    let per = 0;
    for (let k = 0; k <= M; k++) {
      const q = grid[i].pts[k % M];
      if (k) per += q.p.distanceTo(grid[i].pts[k - 1].p);
      const us = uvScale ? uvScale(q.p) : 1;
      row.push(part.vert(q.p, q.n, per * us, q.s * vSign * us, colourAt(q.p, q, tmp), weightsAt(q.p, q)));
    }
    idx.push(row);
  }
  for (let i = 0; i < grid.length - 1; i++) for (let k = 0; k < M; k++) {
    const a = idx[i][k], b = idx[i + 1][k], c = idx[i][k + 1], d = idx[i + 1][k + 1];
    part.tri(a, b, c); part.tri(b, d, c);
  }
  const ta = part.vert(L.tipA.p, L.tipA.n, 0, 0, colourAt(L.tipA.p, L.tipA, tmp), weightsAt(L.tipA.p, L.tipA));
  const tb = part.vert(L.tipB.p, L.tipB.n, 0, L.length, colourAt(L.tipB.p, L.tipB, tmp), weightsAt(L.tipB.p, L.tipB));
  const last = grid.length - 1;
  for (let k = 0; k < M; k++) { part.tri(ta, idx[0][k], idx[0][k + 1]); part.tri(tb, idx[last][k + 1], idx[last][k]); }
  return idx;
}

/** Arc length along a loft of the ring centre nearest to a point. */
function atOf(L, pt) {
  let best = 1e9, at = 0;
  for (const g of L.grid) { const d = g.r.p.distanceToSquared(pt); if (d < best) { best = d; at = g.r.s0; } }
  return at;
}

/** Weights along a chain: joints [{at, bone}] sorted by `at`; blends over `bw` around each joint. */
function chainWeights(x, joints, bw) {
  let i = 0;
  while (i < joints.length - 1 && x > joints[i + 1].at) i++;
  const out = [[joints[i].bone, 1]];
  const next = joints[i + 1], prev = joints[i];
  if (next) { const k = sstep(next.at - bw, next.at + bw, x); if (k > 0) { out[0][1] -= k; out.push([next.bone, k]); } }
  if (i > 0) { const k = 1 - sstep(prev.at - bw, prev.at + bw, x); if (k > 0) { out[0][1] -= k; out.push([joints[i - 1].bone, k]); } }
  return out.filter((w) => w[1] > 1e-3);
}

/** Small rigid helper geometries for the gloss mesh. */
function ellipsoidGeo(rx, ry, rz, ws = 14, hs = 10) { const g = new THREE.SphereGeometry(1, ws, hs); g.scale(rx, ry, rz); return g; }
function addGeo(part, g, bone, colourFn) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  const base = part.n, v = new THREE.Vector3(), nn = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); nn.fromBufferAttribute(n, i);
    part.vert(v, nn, uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0, colourFn(v, nn, c), [[bone, 1]]);
  }
  if (g.index) for (let i = 0; i < g.index.count; i += 3) part.tri(base + g.index.getX(i), base + g.index.getX(i + 1), base + g.index.getX(i + 2));
  else for (let i = 0; i < p.count; i += 3) part.tri(base + i, base + i + 1, base + i + 2);
}

// ------------------------------------------------------------------------------------------ textures
let TEX = null;
function textures() {
  if (TEX) return TEX;
  const R = rng(4242);
  // 1) body: overlapping tapered fur clumps (root up, tip down = along the flow), like shingles
  const S = 256;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgb(40,40,40)'; g.fillRect(0, 0, S, S);
  const clumps = [];
  for (let i = 0; i < 560; i++) clumps.push({ x: R() * S, y: R() * S, len: 26 + R() * 40, w: 5 + R() * 7, bend: (R() - 0.5) * 9, l: 120 + R() * 135 });
  clumps.sort((a, b) => b.y - a.y);
  for (const c of clumps) {
    for (const dx of c.x < 14 ? [0, S] : c.x > S - 14 ? [0, -S] : [0]) for (const dy of c.y > S - c.len - 2 ? [0, -S] : [0]) {
      const x = c.x + dx, y = c.y + dy;
      const gr = g.createLinearGradient(x - c.w / 2, 0, x + c.w / 2, 0);
      gr.addColorStop(0, 'rgb(30,30,30)'); gr.addColorStop(0.5, `rgb(${c.l | 0},${c.l | 0},${c.l | 0})`); gr.addColorStop(1, 'rgb(30,30,30)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x - c.w / 2, y);
      g.quadraticCurveTo(x - c.w * 0.45 + c.bend * 0.3, y + c.len * 0.6, x + c.bend, y + c.len);
      g.quadraticCurveTo(x + c.w * 0.45 + c.bend * 0.3, y + c.len * 0.6, x + c.w / 2, y);
      g.closePath(); g.fill();
    }
  }
  // fine strands on top
  g.lineCap = 'round';
  for (let i = 0; i < 900; i++) {
    const x = R() * S, y = R() * S, len = 8 + R() * 16, l = (90 + R() * 150) | 0;
    g.strokeStyle = `rgba(${l},${l},${l},0.55)`; g.lineWidth = 0.7 + R() * 0.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 3, y + len); g.stroke();
  }
  const hd = g.getImageData(0, 0, S, S).data;
  const H = (x, y) => hd[(((y + S) % S) * S + ((x + S) % S)) * 4] / 255;
  const col = new Uint8ClampedArray(S * S * 4), nor = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const h = H(x, y), j = (y * S + x) * 4;
    const c = 110 + h * 145;
    col[j] = c; col[j + 1] = c * 0.985; col[j + 2] = c * 0.97; col[j + 3] = 255;
    const dx = (H(x + 1, y) - H(x - 1, y)) * 3, dy = (H(x, y + 1) - H(x, y - 1)) * 3;
    const len = Math.hypot(dx, dy, 1);
    nor[j] = (-dx / len * 0.5 + 0.5) * 255; nor[j + 1] = (dy / len * 0.5 + 0.5) * 255; nor[j + 2] = (1 / len * 0.5 + 0.5) * 255; nor[j + 3] = 255;
  }
  const mk = (data, srgb) => {
    const c = document.createElement('canvas'); c.width = c.height = S;
    c.getContext('2d').putImageData(new ImageData(data, S, S), 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.repeat.set(1 / 0.22, 1 / 0.22);
    return t;
  };
  // 2) fur cards: four clump variants side by side, roots at the bottom (v = 0), tips taper and fade
  const W = 256, Hh = 256;
  const cc = document.createElement('canvas'); cc.width = W; cc.height = Hh;
  const h2 = cc.getContext('2d');
  h2.lineCap = 'round';
  for (let v = 0; v < 4; v++) {
    const x0 = v * 64, tipC = x0 + 32 + (R() - 0.5) * 10;
    const n = 26 + Math.floor(R() * 8);
    for (let i = 0; i < n; i++) {
      const rx = x0 + 4 + R() * 56, len = (0.5 + R() * 0.5) * Hh, tipX = lerp(rx, tipC, 0.45 + R() * 0.4) + (R() - 0.5) * 6;
      const l = (150 + R() * 105) | 0, w0 = 2.2 + R() * 2.4;
      const segs = 8;
      for (let k = 0; k < segs; k++) {
        const t0 = k / segs, t1 = (k + 1) / segs;
        const xa = lerp(rx, tipX, t0 * t0), xb = lerp(rx, tipX, t1 * t1);
        h2.strokeStyle = `rgba(${l},${l},${l},${1 - sstep(0.6, 1, t1) * 0.85})`;
        h2.lineWidth = lerp(w0, 0.7, t0);
        h2.beginPath(); h2.moveTo(xa, Hh - t0 * len); h2.lineTo(xb, Hh - t1 * len); h2.stroke();
      }
    }
  }
  const card = new THREE.CanvasTexture(cc);
  card.colorSpace = THREE.SRGBColorSpace; card.anisotropy = 4;
  card.wrapS = card.wrapT = THREE.ClampToEdgeWrapping;
  TEX = { map: mk(col, true), normalMap: mk(nor, false), card };
  return TEX;
}

// ------------------------------------------------------------------------------------------ materials
let MATS = null;
function materials() {
  if (MATS) return MATS;
  const t = textures();
  const fur = new THREE.MeshPhysicalMaterial({
    vertexColors: true, map: t.map, normalMap: t.normalMap, roughness: 0.74, metalness: 0,
    sheen: 0.4, sheenColor: new THREE.Color(0x5c5048), sheenRoughness: 0.5, envMapIntensity: 0.4,
  });
  fur.normalScale.set(1.25, 1.25);
  fur.name = 'bear-fur';
  // fur cards: lit with the body normal on both sides, so they read as one coat with ragged edges
  const hair = new THREE.MeshPhysicalMaterial({
    vertexColors: true, map: t.card, roughness: 0.74, metalness: 0, side: THREE.DoubleSide, specularIntensity: 0.45,
    alphaTest: 0.3, alphaToCoverage: true, envMapIntensity: 0.35,
  });
  hair.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
  };
  hair.customProgramCacheKey = () => 'bear-hair-1';
  hair.name = 'bear-hair';
  const gloss = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12 });
  gloss.name = 'bear-gloss';
  MATS = { fur, hair, gloss };
  return MATS;
}

// ------------------------------------------------------------------------------------------ build geometry (once)
let GEO = null;
function buildGeometry() {
  if (GEO) return GEO;
  const T0 = performance.now();
  const R = rng(77);
  const furP = new Part(), hairP = new Part(), glossP = new Part();
  const cards = []; // fur card roots collected from every loft

  // --- body
  const bodyCtrl = BODY.map(([z, y, w, ht, hb, n]) => ({ p: V(0, y, z), w, ht, hb, n }));
  const body = loft(bodyCtrl, { M: 32, sub: 4 });
  // each bone owns the body from its own joint back to its child's joint (head, neck, chest, spine, pelvis)
  const bodyJoints = [{ at: -0.62, bone: 'head' }, { at: J.head.z, bone: 'neck' }, { at: J.neck.z, bone: 'chest' }, { at: J.chest.z, bone: 'spine' }, { at: J.spine.z, bone: 'pelvis' }];
  // mouth line on the muzzle: below it belongs to the jaw
  const mouthY = (z) => lerp(0.647, 0.636, sstep(-0.64, -0.8, z));
  const bodyWeights = (p) => {
    let w = chainWeights(p.z, bodyJoints, 0.07);
    if (p.z < -0.6 && p.z > -0.86) {
      const k = sstep(mouthY(p.z) + 0.004, mouthY(p.z) - 0.006, p.y) * sstep(-0.61, -0.67, p.z);
      if (k > 0) w = [...w.map(([b, x]) => [b, x * (1 - k)]), ['jaw', k]];
    }
    // rolling shoulder blades and haunches drag the skin over them
    for (const sd of ['L', 'R']) {
      const sx = sd === 'L' ? -1 : 1;
      const ds = Math.hypot(p.x - sx * 0.14, p.y - 0.66, p.z + 0.2);
      const ks = (1 - sstep(0.05, 0.16, ds)) * 0.55 * sstep(0, 0.08, p.x * sx);
      if (ks > 0) w = [...w.map(([b, x]) => [b, x * (1 - ks)]), ['scap' + sd, ks]];
      const dh = Math.hypot(p.x - sx * 0.14, p.y - 0.6, p.z - 0.4);
      const kh = (1 - sstep(0.06, 0.17, dh)) * 0.45 * sstep(0, 0.08, p.x * sx);
      if (kh > 0) w = [...w.map(([b, x]) => [b, x * (1 - kh)]), ['thigh' + sd, kh]];
    }
    if (p.z > 0.6) { const k = sstep(0.6, 0.66, p.z) * 0.7; w = [...w.map(([b, x]) => [b, x * (1 - k)]), ['tail', k]]; }
    return w.filter((x) => x[1] > 1e-3);
  };
  const bodyColour = (p, q, out) => {
    furColour(p, 'body', out);
    // lips and the dark mouth seam
    if (p.z < -0.62) {
      // lips and the inside of the mouth: dark, so the gap reads as an open mouth when the jaw drops
      const d = Math.abs(p.y - mouthY(p.z)), k = sstep(-0.62, -0.66, p.z);
      out.lerp(COL.mouth, (1 - sstep(0.006, 0.016, d)) * k);
      out.lerp(COL.lip, (1 - sstep(0.002, 0.007, d)) * k);
    }
    return out;
  };
  const bodyIdx = addLoft(furP, body, bodyColour, bodyWeights, 1, (p) => lerp(1, 2.4, sstep(-0.56, -0.7, p.z)));
  cards.push({ L: body, idx: bodyIdx, part: 'body', flow: -1, weights: bodyWeights });

  // --- legs
  for (const sd of ['L', 'R']) {
    const sx = sd === 'L' ? 1 : -1;
    const mk = (rows) => rows.map(([x, y, z, w, d]) => ({ p: V(x * sx, y, z), w, ht: d, hb: d, n: 2.15 }));
    // front
    const fl = loft(mk(FRONT), { M: 18, sub: 3, dome: 0.5 });
    const fj = [{ at: 0, bone: 'chest' }, { at: 0.07, bone: 'scap' + sd }, { at: atOf(fl, J['hum' + sd]), bone: 'hum' + sd }, { at: atOf(fl, J['fore' + sd]), bone: 'fore' + sd }, { at: atOf(fl, J['paw' + sd]) + 0.01, bone: 'paw' + sd }];
    const fw = (p, q) => chainWeights(q.s, fj, 0.045);
    const fIdx = addLoft(furP, fl, (p, q, out) => furColour(p, q.s > fj[4].at ? 'paw' : 'leg', out), fw, -1);
    cards.push({ L: fl, idx: fIdx, part: 'front', flow: 1, weights: fw, pawAt: fj[4].at });
    // hind
    const hl = loft(mk(HIND), { M: 18, sub: 3, dome: 0.5 });
    const hj = [{ at: 0, bone: 'pelvis' }, { at: atOf(hl, J['thigh' + sd]) - 0.04, bone: 'thigh' + sd }, { at: atOf(hl, J['shin' + sd]), bone: 'shin' + sd }, { at: atOf(hl, J['foot' + sd]), bone: 'foot' + sd }];
    const hw = (p, q) => chainWeights(q.s, hj, 0.05);
    const hIdx = addLoft(furP, hl, (p, q, out) => furColour(p, q.s > hj[3].at + 0.02 ? 'paw' : 'leg', out), hw, -1);
    cards.push({ L: hl, idx: hIdx, part: 'hind', flow: 1, weights: hw, pawAt: hj[3].at + 0.03 });
  }

  // --- ears: big round cups facing forward and out, black outside, dark brown inside
  const earCards = [];
  for (const sd of ['L', 'R']) {
    const sx = sd === 'L' ? -1 : 1;
    const prof = [[0.001, -0.014], [0.026, -0.013], [0.042, -0.006], [0.05, 0.004], [0.05, 0.013], [0.043, 0.019], [0.033, 0.014], [0.018, 0.002], [0.001, -0.004]];
    const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 22);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (z < -0.015) p.setXYZ(i, x * 0.85, y, z * 0.7); } // flatter where it joins the skull
    g.deleteAttribute('normal');
    { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.31, uv.getY(i) * 0.16); } // metres around and along the profile
    const gm = mergeVertices(g, 1e-5);
    gm.computeVertexNormals();
    const orient = new THREE.Matrix4().makeRotationX(-PI / 2).premultiply(new THREE.Matrix4().makeRotationX(0.15)).premultiply(new THREE.Matrix4().makeRotationY(-sx * 0.62)).premultiply(new THREE.Matrix4().makeRotationZ(-sx * 0.22));
    const at = V(J['ear' + sd].x + sx * 0.004, J['ear' + sd].y + 0.03, J['ear' + sd].z + 0.012);
    gm.applyMatrix4(orient); gm.translate(at.x, at.y, at.z);
    const axis = V(0, 1, 0).applyMatrix4(new THREE.Matrix4().extractRotation(orient));
    addGeo(furP, gm, 'ear' + sd, (v, n, c) => c.copy(COL.fur).lerp(COL.earIn, sstep(0.0, 0.6, n.dot(axis)) * sstep(0.05, 0.02, v.distanceTo(at))));
    // fur over the back of the ear, flowing up and out past the rim: a soft round outline
    for (let i = 0; i < 16; i++) {
      const a = PI * (0.05 + 0.9 * (i / 15)) + (R() - 0.5) * 0.2; // upper half of the ear
      const r = 0.012 + R() * 0.03;
      const loc = V(Math.cos(a) * r, -0.012, Math.sin(a) * r).applyMatrix4(orient).add(at);
      const out = V(Math.cos(a), 0, Math.sin(a)).transformDirection(orient);
      earCards.push({ P: loc, N: axis.clone().negate(), F: out.clone().addScaledVector(axis, -0.15).normalize(), bone: 'ear' + sd, len: 0.035 + (0.05 - r) * 0.5 });
    }
    // tufts growing out of the cup
    for (let i = 0; i < 9; i++) {
      const a = PI * (0.15 + 0.7 * (i / 8));
      const loc = V(Math.cos(a) * 0.016, 0.0, Math.sin(a) * 0.016 - 0.008).applyMatrix4(orient).add(at);
      const out = V(Math.cos(a) * 0.6, 0.8, Math.sin(a) * 0.6).transformDirection(orient);
      earCards.push({ P: loc, N: axis.clone(), F: out, bone: 'ear' + sd, len: 0.04, col: COL.earIn });
    }
  }
  // --- stub tail
  { const g = ellipsoidGeo(0.035, 0.03, 0.05, 10, 8); g.rotateX(-0.6); g.translate(0, 0.635, 0.655); addGeo(furP, g, 'tail', (v, n, c) => c.copy(COL.fur)); }

  // --- toes: five rounded toes along the front of every paw
  for (const sd of ['L', 'R']) {
    for (const [front, bone, tip] of [[true, 'paw' + sd, TOE[sd].front], [false, 'foot' + sd, TOE[sd].hind]]) {
      for (let i = 0; i < 5; i++) {
        const off = (i - 2) * (front ? 0.026 : 0.025);
        const g = ellipsoidGeo(front ? 0.017 : 0.016, front ? 0.019 : 0.017, 0.022, 10, 8);
        g.translate(tip.x + off, 0.022, tip.z + 0.012 + Math.abs(i - 2) * 0.008 * (front ? 1 : 1.2));
        addGeo(furP, g, bone, (v, n, c) => furColour(v, 'paw', c));
      }
    }
  }
  // --- nose pad (leathery, on the fur material so it stays matte) with nostrils; gloss: eyes, claws
  {
    const g = ellipsoidGeo(0.035, 0.026, 0.025, 20, 14);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      // heart shaped from the front: wider on top, a groove down the middle below; top slopes back
      const groove = z < 0 && y < 0.004 ? 0.006 * Math.exp(-((x / 0.007) ** 2)) * (1 - y / 0.027) : 0;
      p.setXYZ(i, x * (1 + 0.12 * Math.max(0, y) / 0.027 - 0.1 * Math.max(0, -y) / 0.027), y, (z < 0 ? z * 0.9 : z + Math.max(0, y) * 0.6) + groove);
    }
    g.computeVertexNormals();
    g.translate(0, 0.668, -0.812);
    { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.06, uv.getY(i) * 0.03); }
    addGeo(furP, g, 'head', (v, n, c) => {
      c.copy(COL.nose);
      for (const sx of [-1, 1]) { const d = Math.hypot((v.x - sx * 0.021) * 1.5, (v.y - 0.665) * 0.85, (v.z + 0.828) * 1.2); c.lerp(C(0x000000), 1 - sstep(0.004, 0.008, d)); }
      return c;
    });
  }
  const headMesh = new THREE.Mesh(furP.build(), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const ray = new THREE.Raycaster();
  for (const sx of [-1, 1]) {
    ray.set(V(sx * 0.052, 0.722, -1.2), V(0, 0, 1));
    const hit = ray.intersectObject(headMesh)[0];
    const ez = hit ? hit.point.z + 0.004 : -0.68;
    const g = ellipsoidGeo(0.0145, 0.013, 0.011, 14, 10);
    g.rotateY(sx * 0.4);
    g.translate(sx * 0.052, 0.722, ez);
    addGeo(glossP, g, 'head', (v, n, c) => c.set(0x120b08).lerp(C(0x3a2416), sstep(0.2, 0.9, -n.z) * 0.4));
  }
  for (const sd of ['L', 'R']) {
    for (const [front, bone, tip, len] of [[true, 'paw' + sd, TOE[sd].front, 0.046], [false, 'foot' + sd, TOE[sd].hind, 0.03]]) {
      for (let i = 0; i < 5; i++) {
        const off = (i - 2) * (front ? 0.026 : 0.025);
        const base = V(tip.x + off, 0.03, tip.z - 0.004 + Math.abs(i - 2) * 0.008);
        const pts = [];
        for (let k = 0; k <= 5; k++) { const t = k / 5; pts.push(V(base.x + off * 0.08 * t, base.y + 0.006 - (len * 0.55) * t * t, base.z - len * Math.sin(t * 1.2) * 0.95)); }
        const curve = new THREE.CatmullRomCurve3(pts);
        const tg = new THREE.TubeGeometry(curve, 8, 1, 6, false);
        // taper the tube to a point
        const tp = tg.attributes.position, cpos = curve.getSpacedPoints(8);
        for (let s = 0; s <= 8; s++) for (let r = 0; r <= 6; r++) {
          const j = s * 7 + r, c = cpos[s], rr = lerp(front ? 0.0062 : 0.0055, 0.0007, (s / 8) ** 0.8);
          tp.setXYZ(j, c.x + (tp.getX(j) - c.x) * rr, c.y + (tp.getY(j) - c.y) * rr, c.z + (tp.getZ(j) - c.z) * rr);
        }
        tg.computeVertexNormals();
        addGeo(glossP, tg, bone, (v, n, c) => c.set(0x221e1b).lerp(C(0x6e6255), sstep(base.z, base.z - len * 0.9, v.z) * 0.8));
      }
    }
  }

  // --- fur cards
  const tmpC = new THREE.Color();
  const tmpV = new THREE.Vector3();
  const down = V(0, -1, 0);
  let nCards = 0;
  const addCard = (P, N, F, len, width, lift, droop, grav, colour, weights) => {
    const Wd = N.clone().cross(F).normalize();
    const pt = (t) => P.clone().addScaledVector(N, len * (lift * t - droop * t * t) - 0.006 * (1 - t)).addScaledVector(F, len * t).addScaledVector(down, len * grav * t * t);
    const col = (R() * 4) | 0, u0 = col / 4 + 0.004, u1 = (col + 1) / 4 - 0.004;
    const rows = [0, 0.5, 1].map((t) => ({ p: pt(t), w: width * lerp(1, 0.62, t), t }));
    const nn = N;
    const light = colour.r > 0.3;
    const shade = light ? 0.92 + R() * 0.12 : 0.8 + R() * 0.4;
    const c = colour.clone().multiplyScalar(shade);
    const ids = [];
    for (const r of rows) {
      ids.push(hairP.vert(tmpV.copy(r.p).addScaledVector(Wd, -r.w / 2), nn, u0, r.t, c, weights));
      ids.push(hairP.vert(tmpV.copy(r.p).addScaledVector(Wd, r.w / 2), nn, u1, r.t, c, weights));
    }
    for (let k = 0; k < 2; k++) { const a = ids[k * 2], b = ids[k * 2 + 1], c2 = ids[k * 2 + 2], d = ids[k * 2 + 3]; hairP.tri(a, b, d); hairP.tri(a, d, c2); }
    nCards++;
  };
  for (const C0 of cards) {
    const { grid, M } = C0.L;
    for (let i = 0; i < grid.length - 1; i++) for (let k = 0; k < M; k++) {
      const q00 = grid[i].pts[k], q10 = grid[i + 1].pts[k], q01 = grid[i].pts[(k + 1) % M], q11 = grid[i + 1].pts[(k + 1) % M];
      const area = q10.p.distanceTo(q00.p) * q01.p.distanceTo(q00.p);
      const mid = q00.p.clone().add(q11.p).multiplyScalar(0.5);
      const nrm = q00.n.clone().add(q11.n).normalize();
      // density (cards per m2), length and stand-off by region
      let dens = 0, len = 0.06, lift = 0.22, droop = 0.18, grav = 0.1;
      if (C0.part === 'body') {
        const z = mid.z, below = -nrm.y, side = Math.abs(nrm.x);
        if (z < -0.665) dens = 0; // muzzle: short fur only
        else if (z < -0.55) { dens = 1500; len = 0.032 + 0.07 * side * sstep(-0.66, -0.58, z); lift = 0.06 + 0.35 * side; droop = 0.08; grav = 0; }
        else if (z < -0.28) { // ruff: the long mane around the neck and down the chest
          dens = 1150; len = 0.13 + 0.08 * sstep(-0.55, -0.45, z) * (1 - 0.35 * Math.max(0, nrm.y)); lift = 0.5 + 0.25 * side; droop = 0.24; grav = 0.18;
        } else if (z < -0.1) { dens = 700; len = 0.09 + 0.025 * side; lift = 0.26; grav = 0.12; }
        else { dens = 620; len = 0.075 + 0.02 * side; lift = 0.2; grav = 0.1; }
        if (below > 0.55 && z > -0.3 && z < 0.5) { len = 0.12; lift = 0.1; droop = 0.04; grav = 0.4; dens = 650; } // belly fringe
        if (z > 0.55) { len = 0.065; dens = 600; }
        if (crescentMask(mid) > 0.2) { dens = 2400; len = 0.08; lift = 0.3; droop = 0.12; grav = 0.15; } // the cream crescent: its own long fur on top
        else if (crescentMask(mid.clone().setY(mid.y - 0.05)) > 0.2) { len = Math.min(len, 0.045); lift = 0.15; } // dark fur just above it stays short
      } else {
        const s = (grid[i].pts[k].s), L = C0.L.length;
        const back = C0.part === 'front' ? nrm.z : -nrm.z; // behind the leg
        void L;
        if (s > C0.pawAt) { dens = nrm.y > 0.3 && s < C0.pawAt + 0.08 ? 700 : 0; len = 0.04; lift = 0.15; grav = 0; } // fur over the top of the paw
        else if (s < 0.06) dens = 0; // inside the body
        else { dens = 620; len = lerp(0.085, 0.045, s / C0.pawAt) + 0.035 * Math.max(0, back) * (C0.part === 'front' ? 1 : 0.5); lift = 0.22; grav = 0.06; }
      }
      const want = area * dens;
      let n = Math.floor(want) + (R() < want % 1 ? 1 : 0);
      while (n-- > 0) {
        const u = R(), v = R();
        const P = q00.p.clone().lerp(q10.p, u).lerp(q01.p.clone().lerp(q11.p, u), v);
        const N = q00.n.clone().lerp(q10.n, u).lerp(q01.n.clone().lerp(q11.n, u), v).normalize();
        // flow: along the loft (to the tail on the body, down the legs), pulled down on the sides
        const F = q00.t.clone().lerp(q10.t, u).multiplyScalar(C0.flow);
        F.addScaledVector(down, (C0.part === 'body' ? 0.55 : 0.2) * Math.abs(N.x) + (C0.part === 'body' && mid.z < -0.28 && mid.z > -0.56 ? 0.5 : 0));
        F.addScaledVector(N, -F.dot(N)).normalize();
        if (F.lengthSq() < 0.5) continue;
        const ll = len * (0.75 + R() * 0.5);
        const colour = furColour(P, C0.part === 'body' ? 'body' : 'leg', tmpC);
        const wts = C0.weights(q00.p, q00);
        addCard(P, N, F, ll, clamp(ll * 0.5 + 0.016, 0.024, 0.08), lift * (0.8 + R() * 0.4), droop, grav, colour, wts);
      }
    }
  }

  for (const e of earCards) addCard(e.P, e.N, e.F, e.len, 0.03, 0.1, 0.12, 0.02, e.col ?? COL.fur, [[e.bone, 1]]);
  const geo = { fur: furP.build(), hair: hairP.build(), gloss: glossP.build() };
  const tris = (g) => g.index.count / 3;
  GEO = { ...geo, cards: nCards, tris: tris(geo.fur) + tris(geo.hair) + tris(geo.gloss), ms: Math.round(performance.now() - T0) };
  return GEO;
}

// ------------------------------------------------------------------------------------------ the bear
const BIND_DIR = {};
for (const [b, c] of [['humL', 'foreL'], ['foreL', 'pawL'], ['thighL', 'shinL'], ['shinL', 'footL'], ['humR', 'foreR'], ['foreR', 'pawR'], ['thighR', 'shinR'], ['shinR', 'footR']]) BIND_DIR[b] = J[c].clone().sub(J[b]).normalize();
const LEN = {};
for (const b of Object.keys(BIND_DIR)) {
  const c = { humL: 'foreL', foreL: 'pawL', thighL: 'shinL', shinL: 'footL', humR: 'foreR', foreR: 'pawR', thighR: 'shinR', shinR: 'footR' }[b];
  LEN[b] = J[c].distanceTo(J[b]);
}
const LEGS = [
  { key: 'LF', sd: 'L', front: true, up: 'humL', low: 'foreL', end: 'pawL', par: 'scapL', pole: V(0, -0.2, 1) },
  { key: 'RF', sd: 'R', front: true, up: 'humR', low: 'foreR', end: 'pawR', par: 'scapR', pole: V(0, -0.2, 1) },
  { key: 'LH', sd: 'L', front: false, up: 'thighL', low: 'shinL', end: 'footL', par: 'pelvis', pole: V(0, 0, -1) },
  { key: 'RH', sd: 'R', front: false, up: 'thighR', low: 'shinR', end: 'footR', par: 'pelvis', pole: V(0, 0, -1) },
];
for (const L of LEGS) {
  L.toe = (L.front ? TOE[L.sd].front : TOE[L.sd].hind).clone();
  L.ankleFromToe = J[L.end].clone().sub(L.toe); // wrist / heel relative to the toe tip
  L.pole.normalize();
}
// walk: four-beat lateral sequence (LH, LF, RH, RF); gallop: rotary bound with paired hind and fore feet
const WALK = { duty: 0.64, off: { LH: 0, LF: 0.24, RH: 0.5, RF: 0.74 }, stride: (v) => clamp(0.22 + 0.28 * v, 0.3, 0.62), lift: 0.075 };
const RUN = { duty: 0.36, off: { LH: 0, RH: 0.09, LF: 0.46, RF: 0.56 }, stride: (v) => clamp(0.4 + 0.07 * v, 0.6, 1.0), lift: 0.16 };

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _e = new THREE.Euler();
const X = V(1, 0, 0), Y = V(0, 1, 0);

/**
 * buildBear({seed}) → {group, update(dt, state), height, length, stats, bones}
 * state = { mode: 'idle'|'walk'|'run'|'sniff'|'stand'|'sit', speed (m/s), look: world Vector3|null,
 *   ground: (x, z) => y, alert: bool, huff: bool (one shot), slam: bool (one shot) }
 */
export function buildBear({ seed = 1 } = {}) {
  const geo = buildGeometry();
  const M = materials();
  const R = rng(seed * 131 + 7);
  const group = new THREE.Group();
  group.name = 'bear';
  const bones = {};
  for (const n of BONES) { const b = new THREE.Bone(); b.name = n; bones[n] = b; }
  for (const n of BONES) {
    const p = PARENT[n];
    if (p) { bones[p].add(bones[n]); bones[n].position.copy(J[n]).sub(J[p]); } else bones[n].position.copy(J[n]);
  }
  group.add(bones.pelvis);
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(BONES.map((n) => bones[n]));
  const meshes = {};
  for (const [k, cast] of [['fur', true], ['hair', false], ['gloss', true]]) {
    const m = new THREE.SkinnedMesh(geo[k], M[k]);
    m.name = 'bear-' + k;
    m.castShadow = cast; m.receiveShadow = true;
    m.bind(skeleton, new THREE.Matrix4());
    m.boundingSphere = new THREE.Sphere(V(0, 0.7, 0), 1.3);
    group.add(m);
    meshes[k] = m;
  }

  // ---------------------------------------------------------------- animation state
  const rest = {};
  for (const n of BONES) rest[n] = bones[n].position.clone();
  const st = {
    t: R() * 10, phase: R(), w: { walk: 0, run: 0, stand: 0, sit: 0, sniff: 0, alert: 0, slam: 0 }, huff: 0,
    lookYaw: 0, lookPitch: 0, earT: [1 + R() * 3, 2 + R() * 3], ear: [0, 0], twitch: 0,
    feet: Object.fromEntries(LEGS.map((L) => [L.key, { y: 0 }])),
  };
  const RR = {}; // root-relative bone frames {q, p}
  for (const n of BONES) RR[n] = { q: new THREE.Quaternion(), p: new THREE.Vector3() };
  const frame = (n) => {
    const b = bones[n], par = PARENT[n], r = RR[n];
    if (!par) { r.q.copy(b.quaternion); r.p.copy(b.position); return; }
    const pr = RR[par];
    r.q.multiplyQuaternions(pr.q, b.quaternion);
    r.p.copy(b.position).applyQuaternion(pr.q).add(pr.p);
  };
  const setRootRot = (n, qRoot) => { // make bone n have root-relative rotation qRoot
    bones[n].quaternion.copy(_q2.copy(RR[PARENT[n]].q).invert().multiply(qRoot));
    frame(n);
  };
  const qx = (a) => new THREE.Quaternion().setFromAxisAngle(X, a);
  const qy = (a) => new THREE.Quaternion().setFromAxisAngle(Y, a);

  /** Two-bone IK in bear space: upper joint → target (wrist / heel), pole picks the bend side. */
  function solveLeg(L, target, footAngle, turnIn) {
    frame(L.up);
    const A = RR[L.up].p;
    const l1 = LEN[L.up], l2 = LEN[L.low];
    const toT = _v.copy(target).sub(A);
    let d = toT.length();
    const n = toT.clone().normalize();
    d = clamp(d, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-4);
    const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    const pp = _v2.copy(L.pole).addScaledVector(n, -L.pole.dot(n)).normalize();
    const upDir = n.clone().multiplyScalar(cosA).addScaledVector(pp, sinA);
    const knee = A.clone().addScaledVector(upDir, l1);
    const end = A.clone().addScaledVector(n, d);
    const lowDir = end.sub(knee).normalize();
    setRootRot(L.up, _q.setFromUnitVectors(BIND_DIR[L.up], upDir));
    setRootRot(L.low, new THREE.Quaternion().setFromUnitVectors(BIND_DIR[L.low], lowDir));
    setRootRot(L.end, qy(turnIn).multiply(qx(-footAngle)));
  }

  let lastGround = null;
  function update(dt, s = {}) {
    const mode = s.mode ?? 'idle', v = Math.max(0, s.speed ?? 0);
    st.t += dt;
    const w = st.w;
    const want = { walk: mode === 'walk' ? 1 : 0, run: mode === 'run' ? 1 : 0, stand: mode === 'stand' ? 1 : 0, sit: mode === 'sit' ? 1 : 0, sniff: mode === 'sniff' ? 1 : 0, alert: s.alert ? 1 : 0 };
    w.walk = damp(w.walk, want.walk, 6, dt); w.run = damp(w.run, want.run, 7, dt);
    w.stand = damp(w.stand, want.stand, 3.2, dt); w.sit = damp(w.sit, want.sit, 2.4, dt);
    w.sniff = damp(w.sniff, want.sniff, 3, dt); w.alert = damp(w.alert, want.alert, 4, dt);
    if (s.huff) st.huff = 1;
    if (s.slam) w.slam = 1;
    st.huff = Math.max(0, st.huff - dt * 1.6);
    w.slam = Math.max(0, w.slam - dt * 1.1);
    const gw = clamp(w.walk + w.run, 0, 1);
    const G = w.run > w.walk ? RUN : WALK;
    const stride = G.stride(Math.max(v, 0.4));
    if (v > 0.02) st.phase = (st.phase + dt * v * G.duty / stride) % 1;
    const ph = st.phase * TAU;
    const huffK = Math.sin(clamp(st.huff, 0, 1) * PI);

    // reset
    for (const n of BONES) { bones[n].position.copy(rest[n]); bones[n].quaternion.identity(); bones[n].scale.set(1, 1, 1); }
    // ground under the feet (world), as heights relative to the root
    const gfun = s.ground;
    group.updateMatrixWorld();
    const gy = (L) => {
      if (!gfun) return 0;
      _v3.copy(L.toe).applyMatrix4(group.matrixWorld);
      return (gfun(_v3.x, _v3.z) - group.position.y) / (group.scale.y || 1);
    };
    for (const L of LEGS) st.feet[L.key].y = gy(L);
    const fy = st.feet;
    const front = (fy.LF.y + fy.RF.y) / 2, hind = (fy.LH.y + fy.RH.y) / 2;
    const slope = Math.atan2(front - hind, 0.66);
    lastGround = { front, hind };

    // ---- body pose
    let pY = rest.pelvis.y + hind * 0.9, pZ = rest.pelvis.z, pPitch = slope * (1 - w.stand), pRoll = 0, pYaw = 0;
    let spP = 0, chP = 0, chR = 0, chY = 0, nkP = 0, nkY = 0, hdP = 0, hdY = 0, hdR = 0, jaw = 0, earBack = 0, earFwd = 0;
    // walk: bob, roll and twist; head carried low and nodding
    pY += gw * (-0.012 + 0.011 * Math.cos(2 * ph)) * (1 - w.run);
    pRoll += w.walk * 0.035 * Math.sin(ph);
    chR += -w.walk * 0.05 * Math.sin(ph + 1.2);
    pYaw += w.walk * 0.035 * Math.sin(ph);
    chY += -w.walk * 0.05 * Math.sin(ph + 0.6);
    nkP += w.walk * (-0.3 + 0.04 * Math.sin(2 * ph + 1.4));
    hdP += w.walk * 0.1;
    hdY += w.walk * 0.07 * Math.sin(ph + 1.8);
    // gallop: spine flexes, body bounds, head stretched forward, ears back
    pPitch += w.run * 0.13 * Math.sin(ph + 0.3);
    chP += -w.run * 0.17 * Math.sin(ph + 0.9);
    pY += w.run * (0.045 * Math.abs(Math.sin(ph)) - 0.035);
    nkP += w.run * -0.24; hdP += w.run * 0.12; earBack += w.run;
    // idle life: breathing, slow head turns, weight shifts
    const breath = Math.sin(st.t * 1.5);
    const idle = 1 - gw;
    hdY += idle * (0.28 * Math.sin(st.t * 0.31) + 0.1 * Math.sin(st.t * 0.83)) * (1 - w.sniff * 0.5);
    nkP += idle * (-0.06 + 0.05 * Math.sin(st.t * 0.23));
    pRoll += idle * 0.012 * Math.sin(st.t * 0.4);
    // sniff the ground: nose down, little twitches, sweeping side to side
    st.twitch = Math.max(0, st.twitch - dt);
    if (w.sniff > 0.5 && st.twitch <= 0 && R() < dt * 1.2) st.twitch = 0.6 + R() * 0.6;
    const tw = st.twitch > 0 ? Math.sin(st.t * 26) * 0.028 : 0;
    nkP += w.sniff * -0.62; hdP += w.sniff * (-0.3 + tw); nkY += w.sniff * 0.3 * Math.sin(st.t * 0.5);
    jaw += w.sniff * (st.twitch > 0 ? 0.03 + 0.03 * Math.sin(st.t * 13) : 0);
    // stand up on the hind legs: pelvis rolls back over the hips, head levels out, nose in the air
    pPitch += w.stand * 1.02; spP += w.stand * 0.26; chP += w.stand * 0.1;
    nkP += w.stand * -0.62; hdP += w.stand * (-0.58 + 0.05 * Math.sin(st.t * 2.2));
    pY += w.stand * -0.04; pZ += w.stand * 0.02;
    // sit on the rump
    pY = lerp(pY, 0.25 + hind, w.sit); pZ += w.sit * 0.06;
    pPitch += w.sit * 0.78; spP += w.sit * 0.12; chP += w.sit * 0.04; nkP += w.sit * -0.5; hdP += w.sit * -0.28;
    // alert: head up, ears forward
    nkP += w.alert * 0.12 * (1 - w.stand); earFwd += w.alert;
    // slam at the end of a bluff charge: chest dropped, head low, mouth open
    pPitch += w.slam * -0.12; nkP += w.slam * -0.3; hdP += w.slam * 0.25; earBack += w.slam;
    // huff: jaw pops open, head jerks down, chest pumps
    jaw += huffK * 0.32 + w.slam * 0.2;
    hdP += huffK * -0.12;
    // breathing scale
    const br = 1 + 0.012 * breath + 0.05 * huffK;
    bones.chest.scale.set(br, 1 + 0.008 * breath + 0.03 * huffK, 1);

    bones.pelvis.position.set(rest.pelvis.x, pY, pZ);
    bones.pelvis.quaternion.setFromEuler(_e.set(pPitch, pYaw, pRoll, 'YXZ'));
    bones.spine.quaternion.setFromEuler(_e.set(spP, -pYaw * 0.4, 0, 'YXZ'));
    bones.chest.quaternion.setFromEuler(_e.set(chP, chY, chR, 'YXZ'));
    // look at a target (world point): neck takes 40 %, head 60 %
    let ly = 0, lp = 0;
    if (s.look) {
      // direction from where the head was last frame, in bear space (no scale)
      bones.head.getWorldPosition(_v2);
      _v.copy(s.look).sub(_v2).applyQuaternion(_q.copy(group.quaternion).invert());
      ly = clamp(Math.atan2(-_v.x, -_v.z), -1.1, 1.1);
      lp = clamp(Math.atan2(_v.y, Math.hypot(_v.x, _v.z)), -0.6, 0.5);
    }
    st.lookYaw = damp(st.lookYaw, ly, 4, dt); st.lookPitch = damp(st.lookPitch, lp, 4, dt);
    bones.neck.quaternion.setFromEuler(_e.set(nkP + st.lookPitch * 0.4, nkY + st.lookYaw * 0.4, 0, 'YXZ'));
    bones.head.quaternion.setFromEuler(_e.set(hdP + st.lookPitch * 0.6, hdY * (1 - Math.min(1, Math.abs(st.lookYaw) * 3)) + st.lookYaw * 0.6, hdR, 'YXZ'));
    bones.jaw.quaternion.setFromAxisAngle(X, -clamp(jaw, 0, 0.45)); // lower jaw drops
    // ears: flicks now and then, forward when alert, flat when charging
    for (let i = 0; i < 2; i++) {
      st.earT[i] -= dt;
      if (st.earT[i] < 0) { st.ear[i] = 1; st.earT[i] = 2 + R() * 5; }
      st.ear[i] = Math.max(0, st.ear[i] - dt * 5);
      const sx = i ? 1 : -1;
      const flick = Math.sin(st.ear[i] * PI) * 0.35;
      const e = bones[i ? 'earR' : 'earL'];
      e.quaternion.setFromEuler(_e.set(-0.15 * earFwd + 0.55 * clamp(earBack, 0, 1) + flick * 0.4, sx * (0.25 * earFwd - 0.3 * clamp(earBack, 0, 1) + flick), 0, 'YXZ'));
    }
    bones.tail.quaternion.setFromAxisAngle(X, 0.1 * Math.sin(st.t * 1.3) + gw * 0.15 * Math.sin(ph * 2));

    // ---- shoulder blades follow the front legs (rolling shoulders)
    const footInfo = {};
    for (const L of LEGS) {
      // gait target (toe offset from rest, foot angle) for walk and gallop
      const g = (Gt) => {
        const p = (st.phase + Gt.off[L.key]) % 1;
        const S = Gt.stride(Math.max(v, 0.4));
        let dz, dy, piv, ang;
        if (p < Gt.duty) {
          const u = p / Gt.duty;
          dz = -S / 2 + u * S; dy = 0;
          piv = sstep(0.62, 1, u) * (L.front ? 0.7 : 0.55); ang = piv;
        } else {
          const u = (p - Gt.duty) / (1 - Gt.duty), e = sstep(0, 1, u);
          dz = S / 2 - e * S; dy = Gt.lift * (L.front ? 1.15 : 1) * Math.sin(PI * u) ** 0.8;
          piv = (L.front ? 0.7 : 0.55) * (1 - sstep(0, 0.6, u));
          ang = L.front ? lerp(0.7, 1.35, sstep(0, 0.3, u)) * (1 - sstep(0.5, 0.92, u)) : lerp(0.55, -0.15, sstep(0, 0.6, u)) * (1 - sstep(0.75, 1, u));
        }
        return { dz, dy, piv, ang };
      };
      const a = g(WALK), b = g(RUN);
      const k = w.run / Math.max(1e-3, w.walk + w.run);
      const m = { dz: lerp(a.dz, b.dz, k) * gw, dy: lerp(a.dy, b.dy, k) * gw, piv: lerp(a.piv, b.piv, k) * gw, ang: lerp(a.ang, b.ang, k) * gw };
      footInfo[L.key] = m;
    }
    for (const sd of ['L', 'R']) {
      const f = footInfo[sd + 'F'];
      const scap = bones['scap' + sd];
      scap.quaternion.setFromAxisAngle(X, -f.dz * 0.75 * (1 - w.stand));
      scap.position.y += (f.dy > 0.001 ? -0.008 : 0.01) * gw;
    }
    // root-relative frames of the body chain
    for (const n of ['pelvis', 'spine', 'chest', 'scapL', 'scapR']) frame(n);

    // ---- legs
    for (const L of LEGS) {
      const m = footInfo[L.key];
      const gyF = st.feet[L.key].y;
      // quadruped target: toe tip on the ground (plus the gait), wrist / heel pivoting about it
      const toe = L.toe.clone();
      toe.z += m.dz; toe.y += m.dy + gyF;
      if (!L.front) toe.z += w.sit * -0.42 + w.stand * 0.02;
      if (!L.front) toe.x *= 1 + 0.25 * w.sit + 0.12 * w.stand;
      if (L.front) { toe.z += w.slam * -0.12; toe.z += w.sit * 0.05; }
      const piv = m.piv;
      let target = L.ankleFromToe.clone().applyAxisAngle(X, -piv).add(toe);
      let footAng = m.ang, turn = L.front ? (L.sd === 'L' ? -1 : 1) * -0.16 : 0;
      if (L.front) {
        // standing: front legs hang in front of the chest, paws drooping
        frame(L.up);
        const hang = RR[L.up].p.clone().add(_v.set((L.sd === 'L' ? -1 : 1) * 0.05, -0.29, -0.12));
        target.lerp(hang, w.stand);
        footAng = lerp(footAng, 1.7 + 0.08 * Math.sin(st.t * 1.7), w.stand);
        turn *= 1 - w.stand;
      }
      solveLeg(L, target, footAng, turn);
    }
    group.userData.ground = lastGround;
  }

  update(0, {});
  return {
    group, update, bones, skeleton, meshes,
    height: 0.82, length: 1.5,
    stats: { tris: geo.tris, cards: geo.cards, draws: 3, buildMs: geo.ms },
  };
}

// ------------------------------------------------------------------------------------------ viewer helpers
/** Viewer: one bear posed. args {mode, speed, steps, look: [x,y,z], huff} → group */
export function bearPose(args = {}) {
  const b = buildBear({ seed: args.seed ?? 1 });
  const look = args.look ? V(...args.look) : null;
  const steps = args.steps ?? 40;
  for (let i = 0; i < steps; i++) b.update(1 / 30, { mode: args.mode ?? 'idle', speed: args.speed ?? 0, look, huff: args.huff && i === steps - 6 });
  if (args.live) {
    let last = performance.now();
    const tick = (now) => { requestAnimationFrame(tick); const dt = Math.min(0.05, (now - last) / 1000); last = now; b.update(dt, { mode: args.mode ?? 'idle', speed: args.speed ?? 0, look }); };
    requestAnimationFrame(tick);
  }
  b.group.userData.stats = b.stats;
  console.info('bear', b.stats);
  return b.group;
}

/** Viewer: a row of poses side by side. */
export function bearModes(args = {}) {
  const g = new THREE.Group();
  const modes = args.modes ?? ['walk', 'stand', 'sit', 'sniff', 'idle'];
  modes.forEach((mode, i) => {
    const b = buildBear({ seed: i + 1 });
    for (let k = 0; k < (args.steps ?? 40); k++) b.update(1 / 30, { mode, speed: mode === 'walk' ? 0.8 : mode === 'run' ? 7 : 0 });
    b.group.position.x = (i - (modes.length - 1) / 2) * (args.gap ?? 1.6);
    b.group.rotation.y = args.yaw ?? -PI / 2;
    g.add(b.group);
  });
  return g;
}
