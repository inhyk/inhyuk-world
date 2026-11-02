// Placeable "blocks" (Minecraft-style building, 인혁's rule: "블럭이 네모나지는 않는 거야").
// Every block snaps to a 1 m grid cell and stacks, but is a smooth, detailed object.
//
// BLOCKS[i] = {id, name, color, hardness, solid, build(seed)}:
//   build(seed) → THREE.Group, origin at the bottom centre of its 1x1x1 cell; everything stays inside
//   x,z ∈ [-0.5, 0.5], y ∈ [0, 1]. Faces +Z (only the log, crate and lamp have a direction at all).
//   Built once per (id, seed % 4) and returned as clones that SHARE geometry and materials: never
//   dispose() them when a block breaks, just remove the object.
//   group.userData: {blockId, solid, hardness}; the lamp also has userData.lamp = {pos, color,
//   intensity, range} (light anchor in block space) and userData.glow (its emissive material).
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat, paint, textured } from '../mat.js';
import { prep, put, bake, rbox, lathe, sphere, capsule } from '../geom.js';
import { rng } from '../noise.js';
import { canvasTex } from '../tex.js';
import { fbm3, noise3, bush, grassTuft, windify, foliageMat, rockMat } from './nature.js';

const TAU = Math.PI * 2;
const V3 = THREE.Vector3;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const col = (h) => new THREE.Color(h);

// ------------------------------------------------------------------ materials (shared, built lazily)
const M = {};
const once = (k, f) => (M[k] ??= f());
const stoneM = () => rockMat();
const soilM = () => once('soil', () => { const m = mat('dirt').clone(); m.vertexColors = true; m.normalScale.set(0.6, 0.6); m.name = 'block-soil'; return m; });
/** Neutral porous clay, tinted per vertex: bricks and terracotta. */
const clayM = () => once('clay', () => { const m = textured('concrete', { color: 0xe2ddd6, seed: 5 }, 0.9, { normal: 0.9 }).clone(); m.vertexColors = true; m.name = 'block-clay'; return m; });
const mortarM = () => mat('concrete');
const barkM = () => mat('bark');
const leafM = () => once('leaf', () => { const m = windify(foliageMat('bush'), 0.03, 0.004, { side: THREE.DoubleSide }); m.name = 'block-leaf'; return m; });
const grassBladeM = () => once('blade', () => { const b = paint(0xffffff, 0.75).clone(); b.vertexColors = true; b.side = THREE.DoubleSide; b.name = 'block-grass'; return b; });
const ironM = () => paint(0x2a2f2c, 0.42, 0.65);
const ringTex = () => once('ringTex', () => canvasTex(512, 512, (c, w, h) => {
  const R = rng(77), cx = w / 2, cy = h / 2, rad = w / 2;
  c.fillStyle = '#5a3a24'; c.fillRect(0, 0, w, h);
  // heartwood to sapwood
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, rad * 0.93);
  g.addColorStop(0, '#b07a4a'); g.addColorStop(0.55, '#d3a46c'); g.addColorStop(0.86, '#e2bd88'); g.addColorStop(0.93, '#caa070'); g.addColorStop(1, '#7a5134');
  c.fillStyle = g; c.beginPath(); c.arc(cx, cy, rad * 0.95, 0, TAU); c.fill();
  // growth rings with wobble
  for (let r = 6; r < rad * 0.9; r += 5 + R() * 6) {
    c.beginPath();
    for (let a = 0; a <= 64; a++) {
      const t = a / 64 * TAU;
      const rr = r * (1 + 0.025 * Math.sin(t * 3 + r * 0.05) + 0.015 * Math.sin(t * 7 + r));
      const x = cx + Math.cos(t) * rr, y = cy + Math.sin(t) * rr;
      if (a === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.strokeStyle = `rgba(110,66,34,${0.25 + R() * 0.35})`;
    c.lineWidth = 1 + R() * 2.2;
    c.stroke();
  }
  // pith and drying cracks
  c.fillStyle = '#6b4126'; c.beginPath(); c.arc(cx + 3, cy - 2, 5, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(60,34,18,0.85)'; c.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a = R() * TAU, r0 = rad * (0.15 + R() * 0.4), r1 = rad * (0.6 + R() * 0.3);
    c.lineWidth = 2 + R() * 2.5;
    c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    c.lineTo(cx + Math.cos(a + 0.05) * (r0 + r1) / 2, cy + Math.sin(a + 0.05) * (r0 + r1) / 2);
    c.lineTo(cx + Math.cos(a - 0.02) * r1, cy + Math.sin(a - 0.02) * r1); c.stroke();
  }
  // saw marks
  c.globalAlpha = 0.08;
  for (let i = 0; i < 70; i++) { c.strokeStyle = i % 2 ? '#fff' : '#000'; c.lineWidth = 2; c.beginPath(); const y = R() * h; c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + 20, w * 0.6, y - 20, w, y + 8); c.stroke(); }
  c.globalAlpha = 1;
}));
const endGrainM = () => once('endGrain', () => {
  const m = paint(0xffffff, 0.78).clone();
  m.map = ringTex();
  m.bumpMap = ringTex();
  m.bumpScale = 1.5;
  m.normalMap = null;
  m.name = 'block-endgrain';
  return m;
});

// ------------------------------------------------------------------ helpers
function weld(geo) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  return mergeVertices(g, 1e-4);
}
function setColors(geo, fn) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const arr = new Float32Array(p.count * 3), c = new THREE.Color(), P = new V3(), N = new V3();
  for (let i = 0; i < p.count; i++) {
    P.fromBufferAttribute(p, i); N.fromBufferAttribute(n, i);
    fn(P, N, c, i);
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
/** Squash any vertex that pokes out of the 1 m cell back onto its walls (contact faces only). */
function fitCell(geo, m = 0.003) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, Math.max(-0.5 + m, Math.min(0.5 - m, p.getX(i))), Math.max(m, Math.min(1 - m, p.getY(i))), Math.max(-0.5 + m, Math.min(0.5 - m, p.getZ(i))));
  }
  return geo;
}
/** Uniform-colour attribute for geometry that shares a vertex-coloured material. */
const tint = (geo, hex, k = 1) => { const c = col(hex).multiplyScalar(k); return setColors(geo, (P, N, o) => o.copy(c)); };

/**
 * Pillow: a superellipsoid (exponent p, 2 = sphere, large = box) with half sizes hx, hy, hz,
 * low-frequency lumps (noise, fraction of size) and an optional top tilt. Centred on origin.
 */
function pillow(hx, hy, hz, { p = 3.2, seg = 8, seed = 0, noise = 0.05, tilt = [0, 0], sag = 0 } = {}) {
  const g = weld(new THREE.BoxGeometry(2, 2, 2, seg, seg, seg));
  const pos = g.attributes.position, d = new V3();
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i).normalize();
    const s = Math.pow(Math.pow(Math.abs(d.x), p) + Math.pow(Math.abs(d.y), p) + Math.pow(Math.abs(d.z), p), -1 / p);
    const n = (fbm3(d.x * 1.6 + seed * 1.3, d.y * 1.6, d.z * 1.6, 3, seed) - 0.5) * 2;
    const k = 1 + noise * n + 0.012 * (noise3(d.x * 7, d.y * 7, d.z * 7, seed + 1) - 0.5);
    let x = d.x * s * hx * k, y = d.y * s * hy * k, z = d.z * s * hz * k;
    if (y > 0) y += tilt[0] * x + tilt[1] * z;
    if (sag && y < 0) y *= 1 - sag;
    pos.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ stone (둥근 돌)
const STONE_TONES = [0xc9bfae, 0xb6b4ad, 0xa7abac, 0xcbb89e, 0x9f978b, 0xbdb2a2];
function stoneBlock(seed) {
  const R = rng(seed * 97 + 1);
  const g = new THREE.Group();
  const variant = seed % 4;
  // stones as [cx, cy, cz, hx, hy, hz] inside the cell (y from 0 to 1)
  let parts;
  if (variant === 0) parts = [[0, 0.49, 0, 0.485, 0.485, 0.485]];
  else if (variant === 1) parts = [[0, 0.28, 0, 0.485, 0.275, 0.485], [0, 0.775, 0, 0.485, 0.215, 0.485]];
  else if (variant === 2) parts = [[0, 0.3, 0, 0.485, 0.295, 0.485], [-0.245, 0.795, 0, 0.24, 0.195, 0.485], [0.245, 0.795, 0, 0.24, 0.195, 0.485]];
  else parts = [[-0.15, 0.49, 0, 0.335, 0.485, 0.485], [0.34, 0.27, 0, 0.145, 0.26, 0.485], [0.34, 0.77, 0, 0.145, 0.22, 0.485]];
  parts.forEach(([cx, cy, cz, hx, hy, hz], i) => {
    const small = Math.min(hx, hy, hz);
    const geo = pillow(hx, hy, hz, { p: 3.4 + R() * 1.2, seg: hx < 0.3 || hy < 0.25 ? 7 : 10, seed: seed * 7 + i, noise: 0.05 + 0.02 * R(), tilt: [(R() - 0.5) * 0.05, (R() - 0.5) * 0.05] });
    geo.translate(cx, cy, cz);
    fitCell(geo);
    geo.computeVertexNormals();
    const tone = col(STONE_TONES[Math.floor(R() * STONE_TONES.length)]).multiplyScalar(0.85 + R() * 0.25);
    const moss = col(0x7a9a46).multiplyScalar(1.2), dark = col(0x5a5348).multiplyScalar(0.9);
    const s0 = seed * 13 + i;
    setColors(geo, (P, N, c) => {
      const n = fbm3(P.x * 3.1 + s0, P.y * 3.1, P.z * 3.1, 3, s0);
      c.copy(tone).multiplyScalar(0.74 + 0.42 * n + 0.16 * (fbm3(P.x * 9, P.y * 9, P.z * 9, 2, s0 + 1) - 0.5));
      // weathered dark streaks running down, lichen spots, moss on the upper faces
      c.lerp(dark, sstep(0.62, 0.8, fbm3(P.x * 2.2, P.y * 0.6, P.z * 2.2, 2, s0 + 3)) * 0.35);
      const lich = sstep(0.64, 0.72, fbm3(P.x * 4.5, P.y * 4.5, P.z * 4.5, 3, s0 + 5));
      c.lerp(col(0xd9d2b0).multiplyScalar(1.1), lich * 0.35);
      const m = sstep(0.35, 0.9, N.y) * sstep(0.45, 0.66, fbm3(P.x * 2.4, P.y * 2.4, P.z * 2.4, 3, s0 + 9));
      c.lerp(moss, m * 0.85);
      // contact shadow towards the bottom of each stone
      const lowY = (P.y - (cy - hy)) / (2 * hy);
      c.multiplyScalar(0.72 + 0.28 * sstep(0.0, 0.35, lowY));
    });
    void small;
    put(g, prep(geo), stoneM());
  });
  return g;
}

// ------------------------------------------------------------------ log (통나무)
function logBlock(seed) {
  const R = rng(seed * 61 + 7);
  const g = new THREE.Group();
  const r = 0.47, L = 0.98, seg = 14, radial = 36;
  const cy = 0.48;
  const knots = [];
  for (let k = 0; k < 2; k++) knots.push([(R() - 0.5) * 0.5, R() * TAU, 0.045 + R() * 0.03]);
  // bark: a cylinder along X whose radius wobbles (but returns to r at both ends so the caps fit)
  const cylG = new THREE.CylinderGeometry(1, 1, L, radial, seg, true);
  const pos = cylG.attributes.position, uv = cylG.attributes.uv;
  const circ = 1.2 * Math.round(TAU * r / 1.2);
  for (let i = 0; i < pos.count; i++) {
    const x0 = pos.getX(i), y0 = pos.getY(i), z0 = pos.getZ(i);
    const a = Math.atan2(z0, x0), along = y0;
    const endFade = sstep(0, 0.12, L / 2 - Math.abs(along));
    let rr = r * (1 + endFade * (0.035 * (fbm3(Math.cos(a) * 1.5, along * 2.5, Math.sin(a) * 1.5, 3, seed) - 0.5) * 2 + 0.012 * Math.sin(along * 9 + a * 2)));
    for (const [kx, ka, ks] of knots) {
      const da = Math.atan2(Math.sin(a - ka), Math.cos(a - ka)) * r, dx = along - kx;
      rr += ks * Math.exp(-(da * da + dx * dx) / 0.0035) * endFade;
    }
    rr = Math.min(rr, 0.495);
    pos.setXYZ(i, Math.cos(a) * rr, along, Math.sin(a) * rr);
    uv.setXY(i, uv.getX(i) * circ, along);
  }
  cylG.computeVertexNormals();
  const n = cylG.attributes.normal, A = new V3(), B = new V3();
  for (let i = 0; i <= seg; i++) {
    const a = i * (radial + 1), b = a + radial;
    A.fromBufferAttribute(n, a).add(B.fromBufferAttribute(n, b)).normalize();
    n.setXYZ(a, A.x, A.y, A.z); n.setXYZ(b, A.x, A.y, A.z);
  }
  const bark = prep(cylG, true);
  bark.rotateZ(Math.PI / 2);
  bark.translate(0, cy, 0);
  put(g, bark, barkM());
  // end grain: slightly domed discs, inset a hair, plus a dark bark lip ring
  const capR = r * 0.9;
  for (const sd of [-1, 1]) {
    const disc = new THREE.CircleGeometry(capR, radial);
    const dp = disc.attributes.position;
    for (let i = 0; i < dp.count; i++) {
      const x = dp.getX(i), y = dp.getY(i), q = 1 - (x * x + y * y) / (capR * capR);
      dp.setZ(i, 0.006 * q + 0.004 * (noise3(x * 12, y * 12, sd, seed) - 0.5));
    }
    disc.computeVertexNormals();
    // rotate each log's rings a little so stacked logs do not repeat
    const uvA = disc.attributes.uv, rot = R() * TAU, cs = Math.cos(rot), sn = Math.sin(rot);
    for (let i = 0; i < uvA.count; i++) {
      const u = uvA.getX(i) - 0.5, v = uvA.getY(i) - 0.5;
      uvA.setXY(i, 0.5 + (u * cs - v * sn) * 0.97, 0.5 + (u * sn + v * cs) * 0.97);
    }
    const d = prep(disc, true);
    d.rotateY(sd * Math.PI / 2);
    d.translate(sd * (L / 2 - 0.004), cy, 0);
    put(g, d, endGrainM());
    const ring = prep(new THREE.RingGeometry(capR * 0.985, r * 1.002, radial, 1));
    ring.rotateY(sd * Math.PI / 2);
    ring.translate(sd * (L / 2 - 0.001), cy, 0);
    put(g, ring, paint(0x4a2f1d, 0.85));
  }
  return g;
}

// ------------------------------------------------------------------ brick (벽돌)
const BRICK_TONES = [0xb4523a, 0xa84a34, 0xc0603f, 0x9a4431, 0xb86448, 0x8e3f2e, 0xc77a52];
function brickBlock(seed) {
  const R = rng(seed * 43 + 9);
  const g = new THREE.Group();
  const courses = 5, ch = 1 / courses, gap = 0.012, depth = 0.2, edge = 0.5;
  const core = rbox(0.88, 0.985, 0.88, 0.05, 2);
  core.translate(0, 0.4925, 0);
  put(g, core, mortarM());
  const brick = (x0, x1, y, z0, z1, round) => {
    const w = x1 - x0 - gap * 2, d = z1 - z0 - gap * 2, h = ch - gap * 2;
    const geo = rbox(w, h, d, round ? 0.035 : 0.022, 1);
    const k = 0.9 + R() * 0.18;
    const base = col(BRICK_TONES[Math.floor(R() * BRICK_TONES.length)]).multiplyScalar(k * 1.2);
    const s0 = Math.floor(R() * 1000);
    setColors(geo, (P, N, c) => {
      c.copy(base).multiplyScalar(0.86 + 0.28 * fbm3(P.x * 9 + s0, P.y * 9, P.z * 9, 2, s0));
      // sooty, slightly darker edges
      c.multiplyScalar(0.85 + 0.15 * clamp01(Math.abs(N.x) + Math.abs(N.z) + Math.abs(N.y) - 0.9));
    });
    // handmade wobble
    geo.translate((x0 + x1) / 2 + (R() - 0.5) * 0.008, y + ch / 2, (z0 + z1) / 2 + (R() - 0.5) * 0.008);
    put(g, geo, clayM());
  };
  for (let c = 0; c < courses; c++) {
    const y = c * ch, even = c % 2 === 0;
    if (even) {
      // stretchers on front and back run the full width; one header-length brick on each side
      for (const zs of [-1, 1]) {
        const z0 = zs > 0 ? edge - depth : -edge, z1 = zs > 0 ? edge : -edge + depth;
        brick(-edge, 0, y, z0, z1, true); brick(0, edge, y, z0, z1, true);
      }
      for (const xs of [-1, 1]) {
        const x0 = xs > 0 ? edge - depth : -edge, x1 = xs > 0 ? edge : -edge + depth;
        brick(x0, x1, y, -edge + depth, edge - depth, false);
      }
    } else {
      for (const xs of [-1, 1]) {
        const x0 = xs > 0 ? edge - depth : -edge, x1 = xs > 0 ? edge : -edge + depth;
        brick(x0, x1, y, -edge, 0, true); brick(x0, x1, y, 0, edge, true);
      }
      for (const zs of [-1, 1]) {
        const z0 = zs > 0 ? edge - depth : -edge, z1 = zs > 0 ? edge : -edge + depth;
        brick(-edge + depth, edge - depth, y, z0, z1, false);
      }
    }
    if (c === courses - 1) {
      // cover the top with two bricks laid across the middle
      brick(-edge + depth, 0, y, -edge + depth, edge - depth, false);
      brick(0, edge - depth, y, -edge + depth, edge - depth, false);
    }
  }
  return g;
}

// ------------------------------------------------------------------ glass (유리)
function glassBlock(seed) {
  const g = new THREE.Group();
  const frame = mat('birch');
  const r = 0.052, e = 0.5 - r - 0.002, len = 2 * e;
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    put(g, capsule(r, len, 4, 12), frame, a * e, 0.5, b * e);                               // posts
    put(g, capsule(r, len, 4, 12), frame, 0, 0.5 + a * e, b * e, 0, 0, Math.PI / 2);         // rails along X
    put(g, capsule(r, len, 4, 12), frame, b * e, 0.5 + a * e, 0, Math.PI / 2, 0, 0);         // rails along Z
  }
  // thick glass: a soft pillow that bulges slightly past the frame's inner faces
  const pane = pillow(0.46, 0.46, 0.46, { p: 5, seg: 8, seed, noise: 0.004 });
  pane.translate(0, 0.5, 0);
  const pm = put(g, prep(pane), M.glass ??= Object.assign(mat('glass').clone(), { opacity: 0.3, name: 'block-glass' }));
  pm.material.color.set(0xcfeaea);
  pm.castShadow = false;
  return g;
}

// ------------------------------------------------------------------ turf (잔디 흙)
function turfBlock(seed) {
  const R = rng(seed * 29 + 3);
  const g = new THREE.Group();
  // soil body
  const soil = pillow(0.485, 0.42, 0.485, { p: 3.4, seg: 8, seed, noise: 0.03 });
  soil.translate(0, 0.42, 0);
  fitCell(soil);
  soil.computeVertexNormals();
  const earth = col(0x8a6a4c).multiplyScalar(1.5), deep = col(0x4a3426).multiplyScalar(1.6), peb = col(0xb8ab98).multiplyScalar(1.8);
  setColors(soil, (P, N, c) => {
    c.copy(deep).lerp(earth, sstep(0.05, 0.8, P.y));
    c.multiplyScalar(0.85 + 0.3 * fbm3(P.x * 6 + seed, P.y * 6, P.z * 6, 3, seed));
    c.lerp(peb, sstep(0.78, 0.86, noise3(P.x * 16, P.y * 16, P.z * 16, seed + 4)) * 0.8);
  });
  put(g, prep(soil), soilM());
  // grass cap: a thick lawn pad with a wavy, drooping edge
  const cap = pillow(0.494, 0.14, 0.494, { p: 3.4, seg: 10, seed: seed + 3, noise: 0.025 });
  const cp = cap.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i);
    if (y < 0) {
      const a = Math.atan2(z, x);
      const wave = 0.5 + 0.3 * Math.sin(a * 6 + seed) + 0.2 * Math.sin(a * 13 + seed * 2);
      cp.setY(i, y - 0.13 * wave * sstep(0.3, 0.47, Math.max(Math.abs(x), Math.abs(z))));
    }
  }
  cap.computeVertexNormals();
  cap.translate(0, 0.76, 0);
  fitCell(cap);
  put(g, prep(cap), mat('grass'));
  // lush blades on top (static, kept below the cell top so a block above never clips them)
  const { geometry: tuft } = grassTuft();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3(), p = new V3();
  const geos = [];
  const n = 52;
  for (let i = 0; i < n; i++) {
    const x = (R() - 0.5) * 0.84, z = (R() - 0.5) * 0.84;
    p.set(x, 0.865 - 0.03 * sstep(0.3, 0.42, Math.max(Math.abs(x), Math.abs(z))), z);
    q.setFromAxisAngle(new V3(0, 1, 0), R() * TAU);
    const k = 0.36 + R() * 0.14;
    s.set(k * 1.1, k, k * 1.1);
    const tg = tuft.clone();
    tg.applyMatrix4(m4.compose(p, q, s));
    geos.push(fitCell(tg, 0.006));
  }
  for (const tg of geos) put(g, tg, grassBladeM());
  // now and then a clover flower
  if (seed % 3 === 0) {
    for (let i = 0; i < 3; i++) {
      const f = sphere(0.022, 8, 6);
      tint(f, i % 2 ? 0xffffff : 0xf6e7f0, 1.2);
      put(g, f, grassBladeM(), (R() - 0.5) * 0.7, 0.93, (R() - 0.5) * 0.7);
    }
  }
  return g;
}

// ------------------------------------------------------------------ plank crate (나무 판자)
function plankBlock(seed) {
  const R = rng(seed * 71 + 5);
  const g = new THREE.Group();
  const oak = mat('oak'), frame = mat('walnut');
  const e = 0.5, post = 0.11, h = 0.995;
  // corner posts
  for (const a of [-1, 1]) for (const b of [-1, 1]) put(g, rbox(post, h, post, 0.025, 2), frame, a * (e - post / 2), h / 2, b * (e - post / 2));
  // top and bottom rails on every face
  const rail = 0.09;
  for (const y of [rail / 2, h - rail / 2]) {
    for (const s of [-1, 1]) {
      put(g, rbox(1 - post * 2 + 0.01, rail, 0.06, 0.02, 1), frame, 0, y, s * (e - 0.03));
      put(g, rbox(0.06, rail, 1 - post * 2 + 0.01, 0.02, 1), frame, s * (e - 0.03), y, 0);
    }
  }
  // side boards (three per face, slightly uneven), set just behind the frame
  const boardH = (h - rail * 2) / 3;
  for (let i = 0; i < 3; i++) {
    const y = rail + boardH * (i + 0.5);
    for (const s of [-1, 1]) {
      const bh = boardH - 0.016 - R() * 0.006;
      put(g, rbox(1 - post * 2 + 0.02, bh, 0.045, 0.016, 1), oak, (R() - 0.5) * 0.004, y, s * (e - 0.055));
      put(g, rbox(0.045, bh, 1 - post * 2 + 0.02, 0.016, 1), oak, s * (e - 0.055), y, (R() - 0.5) * 0.004);
    }
  }
  // lid boards
  for (let i = 0; i < 4; i++) {
    const z = -0.5 + post + (1 - post * 2) * (i + 0.5) / 4;
    put(g, rbox(1 - post * 2 + 0.03, 0.04, (1 - post * 2) / 4 - 0.014, 0.014, 1), oak, 0, h - 0.035 - R() * 0.004, z);
  }
  // inner dark box so gaps never show daylight
  put(g, rbox(0.8, h - 0.06, 0.8, 0.01, 1), paint(0x3a2618, 0.9), 0, h / 2, 0);
  // diagonal brace on front and back
  for (const s of [-1, 1]) {
    const len = Math.hypot(1 - post * 2, h - rail * 2) - 0.06;
    const br = rbox(len, 0.075, 0.03, 0.012, 1);
    put(g, br, frame, 0, h / 2, s * (e - 0.022), 0, 0, s * Math.atan2(h - rail * 2, 1 - post * 2));
  }
  return g;
}

// ------------------------------------------------------------------ pot (화분)
function potBlock(seed) {
  const R = rng(seed * 53 + 11);
  const g = new THREE.Group();
  const PK = 1.32;
  const prof = [[0.001, 0], [0.15, 0], [0.165, 0.012], [0.2, 0.3], [0.205, 0.31], [0.232, 0.315], [0.245, 0.33], [0.245, 0.385], [0.235, 0.4], [0.215, 0.4], [0.205, 0.37], [0.2, 0.35], [0.001, 0.35]].map(([r, y]) => [r * PK, y * PK]);
  const pot = lathe(prof, 40);
  const terra = col(0xc8693f), pale = col(0xe9d6c0);
  setColors(pot, (P, N, c) => {
    c.copy(terra).multiplyScalar(1.1 + 0.2 * fbm3(P.x * 8, P.y * 8, P.z * 8, 2, seed));
    c.lerp(pale, sstep(0.62, 0.8, fbm3(P.x * 5, P.y * 3, P.z * 5, 3, seed + 2)) * 0.45);
    c.multiplyScalar(0.8 + 0.3 * sstep(0, 0.3, P.y));
  });
  put(g, pot, clayM());
  const soilG = lathe([[0.001, 0.372], [0.12, 0.37], [0.2, 0.36], [0.205, 0.35]].map(([r, y]) => [r * PK, y * PK]), 24);
  put(g, soilG, mat('dirt'));
  // leafy plant: glossy oval leaves on arching stems
  const pos = [], cols = [];
  const nL = 20 + Math.floor(R() * 5);
  const dark = col(0x2b5a24), mid = col(0x4f8a34), light = col(0x8ab857), rib = col(0xb5d27a);
  const push = (v, c) => { pos.push(v.x, v.y, v.z); cols.push(c.r, c.g, c.b); };
  for (let i = 0; i < nL; i++) {
    const a = i * 2.39996 + R() * 0.4, t = i / nL;
    const el = 0.35 + (1 - t) * 0.9 + (R() - 0.5) * 0.2;
    const dir = new V3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
    const stemL = 0.14 + R() * 0.14 + (1 - t) * 0.16;
    const base = new V3((R() - 0.5) * 0.06, 0.37 * PK, (R() - 0.5) * 0.06);
    const tipS = base.clone().addScaledVector(dir, stemL);
    // stem as a thin triangle prism (cheap)
    const side = new V3(-dir.z, 0, dir.x).normalize().multiplyScalar(0.006);
    const sc = mid.clone().multiplyScalar(0.8);
    push(base.clone().sub(side), sc); push(tipS, sc); push(base.clone().add(side), sc);
    // leaf blade
    const ld = new V3(Math.cos(a), Math.sin(el) * 0.35 - 0.25, Math.sin(a)).normalize();
    const lside = new V3(-ld.z, 0, ld.x).normalize();
    const up = new V3().crossVectors(lside, ld).normalize();
    const Ll = 0.2 + R() * 0.09, Wl = Ll * 0.44;
    const st = 6, ptsL = [], ptsR = [], ptsM = [];
    for (let k = 0; k <= st; k++) {
      const u = k / st;
      const w = Wl * Math.sin(Math.PI * Math.pow(u, 0.8)) * 0.5;
      const along = tipS.clone().addScaledVector(ld, Ll * u).addScaledVector(up, -Ll * 0.25 * u * u);
      ptsM.push(along.clone().addScaledVector(up, 0.008 * Math.sin(Math.PI * u)));
      ptsL.push(along.clone().addScaledVector(lside, -w).addScaledVector(up, -w * 0.35));
      ptsR.push(along.clone().addScaledVector(lside, w).addScaledVector(up, -w * 0.35));
    }
    const tone = dark.clone().lerp(mid, 0.4 + R() * 0.5);
    const edgeC = tone.clone().lerp(light, 0.35);
    for (let k = 0; k < st; k++) {
      const cm = rib, ce = edgeC;
      push(ptsM[k], cm); push(ptsL[k], ce); push(ptsM[k + 1], cm);
      push(ptsM[k + 1], cm); push(ptsL[k], ce); push(ptsL[k + 1], ce);
      push(ptsM[k], cm); push(ptsM[k + 1], cm); push(ptsR[k], tone);
      push(ptsM[k + 1], cm); push(ptsR[k + 1], tone); push(ptsR[k], tone);
    }
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  lg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  lg.computeVertexNormals();
  // keep every leaf inside the cell
  const lp = lg.attributes.position;
  for (let i = 0; i < lp.count; i++) {
    const x = lp.getX(i), z = lp.getZ(i), r = Math.hypot(x, z);
    if (r > 0.47) { lp.setX(i, x * 0.47 / r); lp.setZ(i, z * 0.47 / r); }
    lp.setY(i, Math.min(lp.getY(i), 0.97));
  }
  put(g, prep(lg), leafM());
  return g;
}

// ------------------------------------------------------------------ garden lamp (정원등)
function lampBlock(seed) {
  const g = new THREE.Group();
  const iron = ironM();
  put(g, tint(rbox(0.34, 0.08, 0.34, 0.03, 2), 0xb4ada2, 0.95), rockMat(), 0, 0.04, 0);
  put(g, lathe([[0.001, 0.08], [0.09, 0.08], [0.095, 0.095], [0.07, 0.12], [0.05, 0.15], [0.036, 0.19], [0.032, 0.56], [0.044, 0.58], [0.046, 0.6], [0.001, 0.605]], 20), iron);
  // cup that holds the globe
  put(g, lathe([[0.02, 0.58], [0.08, 0.6], [0.125, 0.635], [0.115, 0.643], [0.07, 0.62], [0.02, 0.612]], 24), iron);
  // frosted glowing globe
  const globe = lathe([[0.001, 0.62], [0.07, 0.625], [0.125, 0.67], [0.142, 0.735], [0.128, 0.8], [0.085, 0.84], [0.001, 0.85]], 28);
  const gm = put(g, globe, mat('lampGlow'));
  gm.castShadow = false;
  // cage straps over the globe
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU + Math.PI / 4;
    const pts = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8, y = 0.632 + t * 0.215;
      const r = Math.sin(Math.PI * (0.15 + t * 0.75)) * 0.146 + 0.005;
      pts.push(new V3(Math.cos(a) * r, y, Math.sin(a) * r));
    }
    const c = new THREE.CatmullRomCurve3(pts);
    put(g, prep(new THREE.TubeGeometry(c, 10, 0.006, 5, false)), iron);
  }
  // little roof and finial
  put(g, lathe([[0.001, 0.84], [0.19, 0.855], [0.195, 0.868], [0.15, 0.895], [0.06, 0.935], [0.025, 0.952], [0.001, 0.956]], 28), iron);
  put(g, sphere(0.024, 12, 8), iron, 0, 0.968, 0);
  return g;
}

// ------------------------------------------------------------------ flowering bush (꽃)
const FLOWER_SETS = [[0xf38bb0, 0xffd1e0, 0xffffff], [0xf7c843, 0xff9d3a, 0xfff2c0], [0xb98ae8, 0xe8d0ff, 0xffffff], [0xff6f61, 0xffc2b0, 0xffffff]];
function flowerBlock(seed) {
  const g = new THREE.Group();
  const b = bush({ seed: 30 + seed, color: [0x4f8a2e, 0x3f7a3a, 0x5a8f34, 0x46803a][seed % 4], size: 0.72, flowers: FLOWER_SETS[seed % FLOWER_SETS.length] });
  // fit inside the cell
  b.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(b);
  const k = Math.min(1, 0.96 / Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z));
  b.scale.setScalar(k);
  b.position.set(-(bb.min.x + bb.max.x) / 2 * k, 0, -(bb.min.z + bb.max.z) / 2 * k);
  g.add(b);
  return g;
}

// ------------------------------------------------------------------ registry
function make(id, fn) {
  const cache = new Map();
  return (seed = 1) => {
    const v = ((seed % 4) + 4) % 4;
    if (!cache.has(v)) {
      const g = fn(v + 1);
      g.name = 'block-' + id;
      bake(g);
      cache.set(v, g);
    }
    const out = cache.get(v).clone();
    const def = BLOCKS.find((b) => b.id === id);
    out.userData = { ...out.userData, blockId: id, solid: def.solid, hardness: def.hardness };
    if (id === 'lamp') { out.userData.lamp = { pos: [0, 0.74, 0], color: 0xffd9a0, intensity: 1.2, range: 6 }; out.userData.glow = mat('lampGlow'); }
    return out;
  };
}

export const BLOCKS = [
  { id: 'stone', name: '둥근 돌', color: 0x9e988c, hardness: 1.6, solid: true },
  { id: 'log', name: '통나무', color: 0x8a5a36, hardness: 1.3, solid: true },
  { id: 'brick', name: '벽돌', color: 0xb5523a, hardness: 1.8, solid: true },
  { id: 'glass', name: '유리', color: 0xa8d8e8, hardness: 0.6, solid: true },
  { id: 'turf', name: '잔디 흙', color: 0x5f9a3a, hardness: 0.6, solid: true },
  { id: 'plank', name: '나무 판자', color: 0xc8945a, hardness: 1.0, solid: true },
  { id: 'pot', name: '화분', color: 0xc8693f, hardness: 0.5, solid: false },
  { id: 'lamp', name: '정원등', color: 0xffd27a, hardness: 0.6, solid: false },
  { id: 'flower', name: '꽃', color: 0xf28db6, hardness: 0.4, solid: false },
];
const BUILDERS = { stone: stoneBlock, log: logBlock, brick: brickBlock, glass: glassBlock, turf: turfBlock, plank: plankBlock, pot: potBlock, lamp: lampBlock, flower: flowerBlock };
for (const b of BLOCKS) b.build = make(b.id, BUILDERS[b.id]);

/** Viewer helper: one block by id. */
export function block({ id = 'stone', seed = 1 } = {}) {
  return BLOCKS.find((b) => b.id === id).build(seed);
}

/** Viewer helper: every block alone in a row (1.5 m apart, along X), in BLOCKS order. */
export function blockRow({ seed = 1 } = {}) {
  const g = new THREE.Group();
  BLOCKS.forEach((b, i) => { const o = b.build(seed + i); o.position.set((i - (BLOCKS.length - 1) / 2) * 1.5, 0, 0); g.add(o); });
  return g;
}

/**
 * blockCluster({kind}) → a 3 (x) × 3 (z) × 2 (y) test build on the 1 m grid. With kind, every cell
 * is that block (non-solid kinds stand on a stone base); without, a mixed garden wall that shows
 * every block next to the others.
 */
export function blockCluster({ kind = null, seed = 1 } = {}) {
  const g = new THREE.Group();
  const at = (id, x, y, z, s) => { const o = BLOCKS.find((b) => b.id === id).build(seed + s); o.position.set(x, y, z); g.add(o); };
  if (kind) {
    const solid = BLOCKS.find((b) => b.id === kind).solid;
    let s = 0;
    for (let y = 0; y < 2; y++) for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) {
      if (!solid && y === 0) at('stone', x, 0, z, s++);
      else if (!solid && y === 1) at(kind, x, 1, z, s++);
      else at(kind, x, y, z, s++);
    }
    return g;
  }
  // back row: a tall wall; middle: lower; front: planters and lights
  const plan = [
    // [id, x, y, z]
    ['stone', -1, 0, -1], ['brick', 0, 0, -1], ['stone', 1, 0, -1],
    ['brick', -1, 1, -1], ['glass', 0, 1, -1], ['brick', 1, 1, -1],
    ['log', -1, 0, 0], ['turf', 0, 0, 0], ['plank', 1, 0, 0],
    ['flower', 0, 1, 0], ['pot', 1, 1, 0], ['stone', -1, 1, 0],
    ['turf', -1, 0, 1], ['stone', 0, 0, 1], ['turf', 1, 0, 1],
    ['lamp', 0, 1, 1], ['flower', -1, 1, 1], ['pot', 1, 1, 1],
  ];
  plan.forEach(([id, x, y, z], i) => at(id, x, y, z, i));
  return g;
}
