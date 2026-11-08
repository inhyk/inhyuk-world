// 바다 펜션: a whitewashed beach cabin with a big deck facing the sea (+Z). Footprint 12 x 10.
// Cabin floor and deck top at y = 0.5; two steps down to the sand at the front centre.
// Site contract: see ../site.js. Kit (atlas, vertex colours, plants, furniture) comes from ./office.js.
import * as THREE from 'three';
import { mat, paint, textured, glow } from '../mat.js';
import { box, sphere, cyl, capsule, torus, lathe, tube, plane, quad, prep, put, group, bake, aabb } from '../geom.js';
import { makeSite, solid } from '../site.js';
import { dressBed, throwPillow, painted, velvetMat, foldedBlanket, towelMat } from '../soft.js';
import { rng } from '../noise.js';
import {
  PI, RB, CY, SP, V, D, tint, cached, vcMat, vcGloss, vcSoft, vcLeaf, Atlas, txt, rr, leafGeo, pottedPlant,
  mug, bottle, sofa, cafeChair, blackPl, whitePl, frameWhite, bottleWaterMat,
} from './office.js';

const FY = 0.5;          // floor / deck top
const T = 0.12;          // wall thickness
const WX = 4.6, ZF = 0.6, ZB = -4.4; // wall centre lines
const WTOP = 3.08;       // wall top (buried in the roof)
const RIDGE_Z = -1.9, RIDGE_Y = 4.6; // roof underside at the ridge
const PITCH = Math.atan2(1.6, 2.56);
const TAN = Math.tan(PITCH);
const vaultY = (z) => RIDGE_Y - 0.02 - Math.abs(z - RIDGE_Z) * TAN;

/* ------------------------------------------------------------------ materials + atlas */
function pmats() {
  return cached('pensionMats', () => {
    const bulb = glow(0xffd28a, 2.4); bulb.name = 'pensionBulbGlow';
    const shade = glow(0xffdcaa, 1.25); shade.side = THREE.DoubleSide; shade.name = 'pensionShadeGlow';
    return {
      siding: mat('sidingWhite'),
      lining: textured('siding', { color: 0xf7f3eb, count: 10 }, 1.5, { normal: 0.45 }),
      deck: textured('wood', { color: 0xa38a6c, seed: 21 }, 1.2, { normal: 0.5 }),
      roof: textured('shingles', { color: 0x5b6b76, seed: 7 }, 2, { normal: 1.1 }),
      towel: textured('stripes', { color: 0xe8735a, color2: 0xf7f2e8, count: 6 }, 0.7, { normal: 0.5 }),
      rug: textured('stripes', { color: 0x3f8f96, color2: 0xece3d1, count: 12, ratio: 0.3 }, 1.6, { normal: 0.6 }),
      trim: frameWhite(),
      teal: paint(0x2f7f86, 0.42),
      seafoam: paint(0xa5cec8, 0.42),
      bulb, shade,
      winGlass: (() => { const m = mat('glass').clone(); m.emissive.set(0xffb870); m.emissiveIntensity = 0.55; m.name = 'pensionWindowGlass'; return m; })(),
      curtain: (() => { const m = mat('linen').clone(); m.vertexColors = true; m.color.set(0xffffff); m.emissive.set(0xffc58a); m.emissiveIntensity = 0.4; m.name = 'pensionCurtainGlow'; return m; })(),
    };
  });
}

function pensionAtlas() {
  return cached('pensionAtlas', () => {
    const A = new Atlas(1024);
    A.add('sign', 900, 290, (c, w, h) => {
      c.save(); c.translate(120, 150);
      c.fillStyle = '#ffd27a'; c.beginPath(); c.arc(0, -10, 52, PI, 0); c.fill();
      c.strokeStyle = '#bff0ec'; c.lineWidth = 14; c.lineCap = 'round';
      for (let k = 0; k < 2; k++) { c.beginPath(); c.moveTo(-80, 26 + k * 34); for (let i = 0; i <= 8; i++) c.lineTo(-80 + i * 20, 26 + k * 34 + Math.sin(i * 1.4) * 8); c.stroke(); }
      c.restore();
      txt(c, '바다 펜션', 240, 196, 150, '#fff4dc');
    });
    A.add('seaArt', 512, 360, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f6c9a0'); g.addColorStop(0.45, '#fbe3c4'); g.addColorStop(0.46, '#3d8fae'); g.addColorStop(1, '#1f5f7e');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffd27a'; c.beginPath(); c.arc(330, 160, 46, PI, 0); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 3;
      for (let i = 0; i < 9; i++) { c.beginPath(); const y = 180 + i * 20; for (let x = 0; x <= w; x += 16) c.lineTo(x, y + Math.sin(x / 30 + i) * 3); c.stroke(); }
      c.fillStyle = '#f4f1ea'; c.beginPath(); c.moveTo(150, 170); c.lineTo(150, 92); c.lineTo(196, 170); c.fill();
      c.fillStyle = '#8a5a3b'; c.fillRect(126, 170, 84, 12);
      c.strokeStyle = '#f7f2e8'; c.lineWidth = 16; c.strokeRect(0, 0, w, h);
    });
    A.add('lighthouse', 300, 400, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#a9d8ee'); g.addColorStop(0.62, '#e6f4fa'); g.addColorStop(0.63, '#3d8fae'); g.addColorStop(1, '#2b6f8e');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = '#8f8a7e'; c.beginPath(); c.moveTo(60, 270); c.lineTo(240, 270); c.lineTo(280, 300); c.lineTo(30, 300); c.fill();
      for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? '#d9533f' : '#f7f2e8'; c.beginPath(); c.moveTo(118 + i * 3, 270 - i * 36); c.lineTo(182 - i * 3, 270 - i * 36); c.lineTo(179 - i * 3, 234 - i * 36); c.lineTo(121 + i * 3, 234 - i * 36); c.fill(); }
      c.fillStyle = '#ffe9a8'; c.fillRect(132, 72, 36, 20); c.fillStyle = '#2b2f33'; c.beginPath(); c.moveTo(126, 72); c.lineTo(150, 50); c.lineTo(174, 72); c.fill();
      c.strokeStyle = '#f7f2e8'; c.lineWidth = 14; c.strokeRect(0, 0, w, h);
    });
    A.add('welcome', 300, 220, (c, w, h) => {
      c.fillStyle = '#fbf7ee'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#3f8f96'; c.lineWidth = 4; c.strokeRect(10, 10, w - 20, h - 20);
      txt(c, '환영합니다!', w / 2, 62, 38, '#2b5f66', 'center');
      txt(c, '바다 펜션에서 푹 쉬세요', w / 2, 104, 22, '#4a4a4a', 'center');
      txt(c, '체크아웃 오전 11시', w / 2, 144, 20, '#6a6a6a', 'center');
      txt(c, '와이파이 SEA-1234', w / 2, 176, 20, '#6a6a6a', 'center');
      c.strokeStyle = '#7cc6d6'; c.lineWidth = 4; c.beginPath(); for (let x = 40; x <= 260; x += 10) c.lineTo(x, 196 + Math.sin(x / 14) * 4); c.stroke();
    });
    A.add('plaque', 300, 120, (c, w, h) => {
      c.fillStyle = '#c9a77e'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 9; i++) { c.fillStyle = 'rgba(110,70,40,0.18)'; c.fillRect(0, 10 + i * 12, w, 2); }
      txt(c, '바다 펜션 · 101', w / 2, 76, 44, '#5a3a22', 'center');
    });
    ['#2a6f8e', '#e8735a'].forEach((col, i) => A.add('book' + i, 120, 170, (c, w, h) => { c.fillStyle = col; c.fillRect(0, 0, w, h); c.fillStyle = '#fbf3e2'; c.fillRect(12, 20, w - 24, 34); c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.arc(60, 112, 26, 0, PI * 2); c.fill(); }));
    A.add('note', 64, 64, (c, w, h) => { c.fillStyle = '#ffe680'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(40,40,40,0.55)'; c.fillRect(8, 18, 44, 3); c.fillRect(8, 30, 36, 3); });
    A.build();
    A.mat = A.printed(0.7);
    A.sign = A.lit(1.8, 0xffffff); A.sign.name = 'pensionSignGlow';
    return A;
  });
}

/* ------------------------------------------------------------------ geometry helpers */
/** Prism: convex polygon pts [[z, y], ...] in the YZ plane, extruded along X from x0 to x1. World-aligned UVs. */
function prism(x0, x1, pts) {
  const p = [];
  const cz = pts.reduce((s, q) => s + q[0], 0) / pts.length, cy = pts.reduce((s, q) => s + q[1], 0) / pts.length;
  const tri = (a, b, c, out) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * out[0] + ny * out[1] + nz * out[2] < 0) p.push(...a, ...c, ...b); else p.push(...a, ...b, ...c);
  };
  const P = (x, q) => [x, q[1], q[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    tri(P(x0, pts[0]), P(x0, pts[i]), P(x0, pts[i + 1]), [-1, 0, 0]);
    tri(P(x1, pts[0]), P(x1, pts[i]), P(x1, pts[i + 1]), [1, 0, 0]);
  }
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const out = [0, (a[1] + b[1]) / 2 - cy, (a[0] + b[0]) / 2 - cz];
    tri(P(x0, a), P(x1, a), P(x1, b), out); tri(P(x0, a), P(x1, b), P(x0, b), out);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return prep(g);
}
/** Box placed in world space with world-aligned metric UVs (siding courses line up across pieces). */
const wbox = (cx, cy, cz, w, h, d) => prep(box(w, h, d).translate(cx, cy, cz));

/** Wall along X at z (interior on side `inner` = +1/-1) from x0..x1 with holes [[x0, x1, y0, y1]]. */
function wallX(ctx, z, x0, x1, holes, inner) {
  const { g, site, M } = ctx;
  const xs = [...new Set([x0, x1, ...holes.flatMap((h) => [h[0], h[1]])])].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1];
    const h = holes.find((q) => q[0] <= a + 1e-6 && q[1] >= b - 1e-6);
    for (const [ya, yb] of h ? [[0.38, h[2]], [h[3], WTOP]] : [[0.38, WTOP]]) {
      if (yb - ya < 0.01) continue;
      put(g, wbox((a + b) / 2, (ya + yb) / 2, z, b - a, yb - ya, T), M.siding);
      const la = Math.max(ya, FY), lb = Math.min(yb, 3.06);
      if (lb > la) put(g, wbox((a + b) / 2, (la + lb) / 2, z + inner * (T / 2 + 0.006), b - a, lb - la, 0.01), M.lining);
      solid(site, (a + b) / 2, (ya + yb) / 2, z, b - a, yb - ya, T);
    }
  }
}
/** Wall along Z at x (interior on side `inner`). holes: [[z0, z1, y0, y1]]. */
function wallZ(ctx, x, z0, z1, holes, inner) {
  const { g, site, M } = ctx;
  const zs = [...new Set([z0, z1, ...holes.flatMap((h) => [h[0], h[1]])])].sort((a, b) => a - b);
  for (let i = 0; i < zs.length - 1; i++) {
    const a = zs[i], b = zs[i + 1];
    const h = holes.find((q) => q[0] <= a + 1e-6 && q[1] >= b - 1e-6);
    for (const [ya, yb] of h ? [[0.38, h[2]], [h[3], WTOP]] : [[0.38, WTOP]]) {
      if (yb - ya < 0.01) continue;
      put(g, wbox(x, (ya + yb) / 2, (a + b) / 2, T, yb - ya, b - a), M.siding);
      const la = Math.max(ya, FY), lb = Math.min(yb, 3.06);
      if (lb > la) put(g, wbox(x + inner * (T / 2 + 0.006), (la + lb) / 2, (a + b) / 2, 0.01, lb - la, b - a), M.lining);
      solid(site, x, (ya + yb) / 2, (a + b) / 2, T, yb - ya, b - a);
    }
  }
}

/**
 * Window in a wall: group at the opening centre (x, y, z) rotated so local +Z points outside.
 * o: { cols, rows, curtain (hex), shutters, flowers, stool }
 */
function windowUnit(ctx, x, y, z, ry, w, h, o = {}) {
  const { g, M } = ctx;
  const u = group(g, x, y, z, ry);
  const tt = T + 0.004;
  put(u, RB(w, 0.03, tt, 0.004, 1), M.trim, 0, -h / 2 + 0.015, 0);
  put(u, RB(w, 0.03, tt, 0.004, 1), M.trim, 0, h / 2 - 0.015, 0);
  for (const s of [-1, 1]) put(u, RB(0.03, h, tt, 0.004, 1), M.trim, s * (w / 2 - 0.015), 0, 0);
  for (const s of [-1, 1]) put(u, RB(0.05, h - 0.06, 0.05, 0.008, 1), M.trim, s * (w / 2 - 0.055), 0, 0);
  for (const s of [-1, 1]) put(u, RB(w - 0.06, 0.05, 0.05, 0.008, 1), M.trim, 0, s * (h / 2 - 0.055), 0);
  const cols = o.cols ?? 2, rows = o.rows ?? 2;
  for (let i = 1; i < cols; i++) put(u, box(0.024, h - 0.1, 0.032), M.trim, -w / 2 + 0.05 + i * (w - 0.1) / cols, 0, 0);
  for (let i = 1; i < rows; i++) put(u, box(w - 0.1, 0.024, 0.032), M.trim, 0, -h / 2 + 0.05 + i * (h - 0.1) / rows, 0);
  D(u, quad(w - 0.1, h - 0.1), M.winGlass, 0, 0, 0);
  const ez = T / 2 + 0.012;
  put(u, RB(w + 0.26, 0.11, 0.024, 0.006, 1), M.trim, 0, h / 2 + 0.055, ez);
  put(u, RB(w + 0.34, 0.035, 0.07, 0.008, 1), M.trim, 0, h / 2 + 0.128, ez + 0.02);
  for (const s of [-1, 1]) put(u, RB(0.11, h, 0.024, 0.006, 1), M.trim, s * (w / 2 + 0.055), 0, ez);
  put(u, RB(w + 0.32, 0.05, 0.12, 0.01, 1), M.trim, 0, -h / 2 - 0.025, T / 2 + 0.05);
  const iz = -(T / 2 + 0.018);
  put(u, RB(w + 0.2, 0.09, 0.024, 0.006, 1), M.trim, 0, h / 2 + 0.045, iz);
  for (const s of [-1, 1]) put(u, RB(0.09, h, 0.024, 0.006, 1), M.trim, s * (w / 2 + 0.045), 0, iz);
  if (o.stool !== false) {
    put(u, RB(w + 0.24, 0.03, 0.13, 0.008, 1), mat('oak'), 0, -h / 2 - 0.015, -(T / 2 + 0.05));
    put(u, RB(w + 0.16, 0.07, 0.02, 0.006, 1), M.trim, 0, -h / 2 - 0.065, iz);
  }
  if (o.curtain) {
    const cz = -(T / 2 + 0.13), top = h / 2 + 0.2;
    V(u, CY(0.011, 0.011, w + 0.66, 8), 0x8a6a4a, 0, top, cz, 0, 0, PI / 2);
    for (const s of [-1, 1]) V(u, SP(0.024, 8, 6), 0x8a6a4a, s * (w / 2 + 0.33), top, cz);
    const len = Math.min(h + 0.35, top + h / 2 + 0.25);
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
      V(u, capsule(0.032, len - 0.064, 3, 8), k % 2 ? o.curtain : (o.curtain2 ?? o.curtain), s * (w / 2 + 0.22 - k * 0.052), top - len / 2 - 0.02, cz + (k % 2 ? 0.022 : -0.008), 0, 0, 0, M.curtain);
    }
  }
  if (o.shutters) {
    const sw = w / 2 + 0.04;
    for (const s of [-1, 1]) {
      const sg = group(u, s * (w / 2 + 0.13 + sw / 2), 0, T / 2 + 0.03, 0);
      put(sg, RB(sw, h + 0.06, 0.03, 0.006, 1), M.teal, 0, 0, 0);
      const n = Math.floor((h - 0.1) / 0.065);
      for (let i = 0; i < n; i++) put(sg, box(sw - 0.08, 0.014, 0.03), M.teal, 0, -h / 2 + 0.08 + i * 0.065, 0.014, -0.55, 0, 0);
      put(sg, RB(sw, 0.06, 0.035, 0.006, 1), M.teal, 0, 0, 0.004);
    }
  }
  if (o.flowers) {
    const fy = -h / 2 - 0.2, fz = T / 2 + 0.15, R = rng(Math.round(x * 13 + z * 7));
    put(u, RB(w + 0.1, 0.18, 0.2, 0.02, 1), M.teal, 0, fy, fz);
    V(u, box(w, 0.02, 0.16), 0x4a3726, 0, fy + 0.085, fz);
    for (const s of [-1, 1]) put(u, RB(0.035, 0.12, 0.14, 0.008, 1), M.trim, s * (w / 2 - 0.12), fy - 0.12, T / 2 + 0.08);
    const n = Math.round(w * 22);
    for (let i = 0; i < n; i++) {
      const az = R() * PI * 2, lx = (R() - 0.5) * w * 0.95, lz = fz + (R() - 0.5) * 0.12;
      const l = leafGeo(0.09 + R() * 0.05, 0.035, 0.6, 0.25); l.rotateX(-(0.3 + R() * 0.8)); l.rotateY(az); l.translate(lx, fy + 0.09, lz);
      put(u, tint(l, [0x3c6a2e, 0x4a7a33, 0x5a8a3a][i % 3]), vcLeaf());
    }
    const cols2 = [0xe8505b, 0xf7f2e8, 0xf28aa6, 0xe8505b];
    for (let i = 0; i < Math.round(w * 9); i++) {
      const lx = (R() - 0.5) * w * 0.9, lz = fz + (R() - 0.5) * 0.12, ly = fy + 0.14 + R() * 0.1, c = cols2[i % 4];
      for (let k = 0; k < 4; k++) V(u, SP(0.022, 6, 4), c, lx + Math.cos(k * 1.6) * 0.022, ly + (k % 2) * 0.015, lz + Math.sin(k * 1.6) * 0.022);
    }
  }
  return u;
}

/* ------------------------------------------------------------------ props */
function adirondack(p, x, y, z, ry, col) {
  const g = group(p, x, y, z, ry);
  for (const s of [-1, 1]) V(g, RB(0.05, 0.58, 0.09, 0.01, 1), col, s * 0.31, 0.29, 0.26);
  for (const s of [-1, 1]) V(g, RB(0.05, 0.1, 0.9, 0.01, 1), col, s * 0.28, 0.2, -0.06, -0.42, 0, 0);
  for (let i = 0; i < 6; i++) { const zz = 0.27 - i * 0.1; V(g, RB(0.6, 0.022, 0.085, 0.008, 1), col, 0, 0.4 - (0.27 - zz) * 0.42 + 0.02, zz, -0.4, 0, 0); }
  for (const s of [-1, 1]) V(g, RB(0.14, 0.028, 0.74, 0.012, 1), col, s * 0.36, 0.6, -0.02);
  const b = group(g, 0, 0.3, -0.3, 0); b.rotation.x = -0.42;
  for (let i = 0; i < 5; i++) { const hh = 0.88 - Math.abs(i - 2) * 0.07; V(b, RB(0.088, hh, 0.022, 0.03, 2), col, (i - 2) * 0.106, hh / 2 + 0.05, 0, 0, 0, -(i - 2) * 0.03); }
  for (const yy of [0.25, 0.62]) V(b, RB(0.6, 0.06, 0.028, 0.01, 1), col, 0, yy, -0.026);
  return g;
}
function juiceGlass(p, x, y, z, col) {
  D(p, lathe([[0, 0], [0.03, 0], [0.034, 0.11], [0.031, 0.11], [0.027, 0.006], [0, 0.006]], 14), mat('glass'), x, y, z);
  V(p, CY(0.027, 0.025, 0.075, 12), col, x, y + 0.045, z, 0, 0, 0, vcGloss());
}
function kettle(p, x, y, z, col) {
  const g = group(p, x, y, z, 0.6);
  V(g, lathe([[0, 0], [0.085, 0], [0.096, 0.03], [0.09, 0.14], [0.06, 0.19], [0.028, 0.2], [0, 0.2]], 20), col, 0, 0, 0, 0, 0, 0, vcGloss());
  V(g, torus(0.07, 0.011, 6, 14, PI), 0x2b2b2b, 0, 0.165, 0);
  V(g, CY(0.012, 0.02, 0.13, 8), col, 0.105, 0.12, 0, 0, 0, -0.85, vcGloss());
  V(g, SP(0.018, 8, 6), 0x2b2b2b, 0, 0.205, 0);
}
function stringLight(ctx, a, b, sag, step = 0.38) {
  const { g, M } = ctx;
  const pt = (t) => new THREE.Vector3(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t);
  const pts = []; for (let i = 0; i <= 16; i++) pts.push(pt(i / 16));
  V(g, tube(new THREE.CatmullRomCurve3(pts), 0.005, 32, 4), 0x2b2b2b);
  const len = new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b));
  const n = Math.max(2, Math.round(len / step));
  for (let i = 1; i < n; i++) {
    const q = pt(i / n);
    V(g, CY(0.012, 0.012, 0.04, 6), 0x2b2b2b, q.x, q.y - 0.03, q.z);
    D(g, SP(0.034, 10, 8), M.bulb, q.x, q.y - 0.075, q.z);
  }
}
function towel(ctx, x, y, z, alongX, len, m) {
  const { g } = ctx;
  const ry = alongX ? 0 : PI / 2;
  const t = group(g, x, y, z, ry);
  put(t, CY(0.03, 0.03, len, 10), m, 0, 0.0, 0, 0, 0, PI / 2);
  for (const s of [-1, 1]) put(t, RB(len, 0.48 + (s > 0 ? 0.0 : 0.08), 0.014, 0.006, 1), m, 0, -0.24 - (s > 0 ? 0 : 0.04), s * 0.035, s * 0.04, 0, 0);
}
function flipflops(p, x, y, z, ry, col) {
  const g = group(p, x, y, z, ry);
  for (const s of [-1, 1]) {
    V(g, cyl(0.045, 0.045, 0.016, 14).scale(1, 1, 2.6), col, s * 0.065, 0.008, s * 0.02);
    V(g, torus(0.035, 0.005, 4, 10, PI), 0xf7f2e8, s * 0.065, 0.016, s * 0.02 - 0.03, -PI / 2, 0, 0);
  }
}
function surfboard(p, x, y, z, ry) {
  const geo = sphere(1, 28, 14).scale(0.27, 1.0, 0.035);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), py = pos.getY(i);
    c.set(Math.abs(px) < 0.03 ? 0x2f7f86 : py > 0.86 ? 0xe8735a : Math.abs(py + 0.35) < 0.04 ? 0x2f7f86 : 0xf6f2ea);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const g = group(p, x, y, z, ry);
  const m = put(g, geo, vcGloss(), 0, 1.0, 0); m.rotation.set(-0.12, 0, 0.04);
  V(g, box(0.012, 0.09, 0.1), 0x2b2b2b, 0, 0.12, -0.06, -0.12, 0, 0);
  return g;
}
function grassClump(p, x, y, z, seed, h = 0.55) {
  const R = rng(seed * 17 + 3);
  for (let i = 0; i < 16; i++) {
    const az = R() * PI * 2, r0 = R() * 0.08;
    const l = leafGeo(h * (0.6 + R() * 0.5), 0.012 + R() * 0.006, 0.35, 0.1, 3);
    l.rotateX(-(0.95 + R() * 0.45)); l.rotateY(az); l.translate(x + Math.sin(az) * r0, y, z + Math.cos(az) * r0);
    put(p, tint(l, [0x9aa063, 0x7f8f4e, 0xb3b075, 0x8c9a58][i % 4]), vcLeaf());
  }
}
function parasol(p, x, y, z, r = 1.2, h = 2.25) {
  const g = group(p, x, y, z, 0.2);
  V(g, CY(0.022, 0.022, h + 0.12, 8), 0xf2efe8, 0, (h + 0.12) / 2, 0);
  const n = 8, apex = [0, h + 0.28, 0];
  const pos = [], cols = [], cA = new THREE.Color(0x2f8f98), cB = new THREE.Color(0xf6f1e6);
  const rim = (i) => { const a = (i / n) * PI * 2; return [Math.cos(a) * r, h - 0.08, Math.sin(a) * r]; };
  for (let i = 0; i < n; i++) {
    const a = rim(i), b = rim(i + 1), am = ((i + 0.5) / n) * PI * 2;
    const m = [Math.cos(am) * r * 0.96, h - 0.02, Math.sin(am) * r * 0.96];
    const col = i % 2 ? cA : cB;
    const add = (...vs) => vs.forEach((v) => { pos.push(...v); cols.push(col.r, col.g, col.b); });
    add(apex, b, m, apex, m, a);
    const ad = [a[0], a[1] - 0.12, a[2]], bd = [b[0], b[1] - 0.12, b[2]], md = [m[0], m[1] - 0.16, m[2]];
    add(a, m, md, a, md, ad, m, b, bd, m, bd, md);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  put(g, prep(geo), vcMat());
  for (let i = 0; i < n; i++) { const a = (i / n) * PI * 2; V(g, box(0.012, 0.012, r), 0xe8e4dc, Math.cos(a) * r / 2, h + 0.08, Math.sin(a) * r / 2, 0, -a + PI / 2, 0.3); }
  V(g, SP(0.04, 8, 6), 0xf2efe8, 0, h + 0.32, 0);
  return g;
}
function bbq(p, x, y, z) {
  const g = group(p, x, y, z, 0.4);
  const k = 0x26272b;
  V(g, lathe([[0, 0.5], [0.12, 0.505], [0.24, 0.56], [0.29, 0.66], [0.3, 0.74], [0.29, 0.74], [0.27, 0.66], [0.22, 0.58], [0, 0.53]], 24), k, 0, 0, 0, 0, 0, 0, vcGloss());
  V(g, lathe([[0.3, 0.745], [0.29, 0.83], [0.24, 0.92], [0.13, 0.98], [0, 0.995]], 24), k, 0, 0, 0, 0, 0, 0, vcGloss());
  V(g, torus(0.05, 0.01, 6, 12, PI), 0xb8bcc0, 0, 0.99, 0);
  V(g, CY(0.03, 0.03, 0.02, 10), 0xb8bcc0, 0, 1.0, 0);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * PI * 2; V(g, CY(0.013, 0.013, 0.56, 6), k, Math.cos(a) * 0.17, 0.27, Math.sin(a) * 0.17, Math.sin(a) * 0.22, 0, -Math.cos(a) * 0.22); }
  V(g, CY(0.16, 0.16, 0.02, 20), 0x55595e, 0, 0.2, 0);
  for (const s of [-1, 1]) V(g, CY(0.05, 0.05, 0.03, 12), 0x1a1a1c, s * 0.24, 0.05, -0.12, 0, 0, PI / 2);
  for (const s of [-1, 1]) V(g, box(0.14, 0.012, 0.025), 0xb8bcc0, s * 0.33, 0.7, 0, 0, 0, 0);
}

/* ------------------------------------------------------------------ build */
export function buildPension() {
  const site = makeSite('pension', 12, 10);
  const g = site.group;
  const M = pmats();
  const A = pensionAtlas();
  const ctx = { g, site, M };
  const oak = mat('oak');

  /* --- cabin base, floor, walls --- */
  put(g, RB(9.38, 0.4, 5.18, 0.03, 2), mat('stone'), 0, 0.2, (ZF + ZB) / 2);
  solid(site, 0, FY / 2, (ZF + ZB) / 2, 9.32, FY, 5.12);
  put(g, plane(9.08, 4.88), mat('oakFloor'), 0, FY + 0.001, (ZF + ZB) / 2);
  // skirt trim
  put(g, RB(9.36, 0.14, 0.03, 0.006, 1), M.trim, 0, 0.45, ZF + T / 2 + 0.015);
  put(g, RB(9.36, 0.14, 0.03, 0.006, 1), M.trim, 0, 0.45, ZB - T / 2 - 0.015);
  for (const s of [-1, 1]) put(g, RB(0.03, 0.14, 5.16, 0.006, 1), M.trim, s * (WX + T / 2 + 0.015), 0.45, (ZF + ZB) / 2);
  const front = [[-3.45, -2.05, 1.4, 2.6], [-0.42, 0.62, 0.5, 2.62], [1.25, 3.85, 1.0, 2.6]];
  wallX(ctx, ZF, -WX - T / 2, WX + T / 2, front, -1);
  wallX(ctx, ZB, -WX - T / 2, WX + T / 2, [[1.0, 2.1, 1.75, 2.55]], 1);
  wallZ(ctx, -WX, ZB + T / 2, ZF - T / 2, [[-3.5, -2.7, 1.55, 2.45]], 1);
  wallZ(ctx, WX, ZB + T / 2, ZF - T / 2, [[-1.9, -0.7, 1.4, 2.6]], -1);
  // gables (outside siding + inner lining) with porthole windows
  const gz0 = ZF + T / 2, gz1 = ZB - T / 2;
  for (const s of [-1, 1]) {
    put(g, prism(s * WX - T / 2, s * WX + T / 2, [[gz0, WTOP - 0.01], [gz1, WTOP - 0.01], [RIDGE_Z, RIDGE_Y + 0.08]]), M.siding);
    const xi = s * (WX - T / 2 - 0.006);
    put(g, prism(xi - 0.005, xi + 0.005, [[ZF - T / 2, 3.055], [ZB + T / 2, 3.055], [RIDGE_Z, RIDGE_Y - 0.03]]), M.lining);
    const px = s * (WX + T / 2 + 0.005);
    V(g, CY(0.21, 0.21, 0.012, 24), 0x26394a, px, 3.75, RIDGE_Z, 0, 0, PI / 2);
    D(g, CY(0.21, 0.21, 0.004, 24), mat('glass'), px + s * 0.012, 3.75, RIDGE_Z, 0, 0, PI / 2);
    put(g, torus(0.235, 0.035, 8, 28), M.trim, px + s * 0.01, 3.75, RIDGE_Z, 0, PI / 2, 0);
    for (const k of [0, 1]) put(g, box(0.02, k ? 0.42 : 0.025, k ? 0.025 : 0.42), M.trim, px + s * 0.014, 3.75, RIDGE_Z);
  }
  // corner boards
  for (const sx of [-1, 1]) for (const zc of [ZF + T / 2, ZB - T / 2]) put(g, RB(0.16, 2.7, 0.16, 0.01, 1), M.trim, sx * (WX + T / 2 - 0.04), 1.73, zc + (zc > 0 ? -0.04 : 0.04));
  site.indoor.push(aabb(-WX + T / 2, FY, ZB + T / 2, WX - T / 2, RIDGE_Y, ZF - T / 2));

  /* --- roof --- */
  const ca = Math.cos(PITCH), sa = Math.sin(PITCH);
  const LS = Math.hypot(2.56, 1.6) + 0.55 + 0.06;
  for (const s of [1, -1]) {
    const dz = s * ca, dy = -sa, nz = s * sa, ny = ca, mid = LS / 2 - 0.06;
    const bz = RIDGE_Z + dz * mid, by = RIDGE_Y + dy * mid;
    put(g, RB(10.0, 0.05, LS, 0.01, 1), M.trim, 0, by + ny * 0.025, bz + nz * 0.025, s * PITCH, 0, 0);
    put(g, RB(10.0, 0.11, LS, 0.02, 2), M.roof, 0, by + ny * 0.105, bz + nz * 0.105, s * PITCH, 0, 0);
    for (const sx of [-1, 1]) put(g, RB(0.04, 0.22, LS + 0.02, 0.008, 1), M.trim, sx * 5.02, by + ny * 0.07, bz + nz * 0.07, s * PITCH, 0, 0);
    const ez = RIDGE_Z + dz * (LS - 0.06), ey = RIDGE_Y + dy * (LS - 0.06);
    put(g, RB(10.06, 0.2, 0.035, 0.008, 1), M.trim, 0, ey + 0.07, ez + s * 0.03);
    if (s > 0) {
      V(g, cyl(0.06, 0.06, 10.0, 12, true), 0xc9ccce, 0, ey - 0.02, ez + 0.11, 0, 0, PI / 2);
      for (const sx of [-1, 1]) V(g, CY(0.032, 0.032, ey - 0.3, 10), 0xc9ccce, sx * 4.9, (ey + 0.3) / 2 - 0.02, ez + 0.11);
    }
  }
  V(g, RB(10.06, 0.07, 0.36, 0.02, 1), 0x3f4950, 0, RIDGE_Y + 0.2, RIDGE_Z);
  // stove pipe on the back slope
  V(g, CY(0.07, 0.07, 1.2, 14), 0x2f3338, 3.2, 4.45, -3.0);
  V(g, CY(0.12, 0.09, 0.08, 14), 0x2f3338, 3.2, 5.08, -3.0);

  /* --- vaulted interior: boards, beams, crown trim --- */
  const LV = Math.hypot(ZF - T / 2 - RIDGE_Z, (RIDGE_Y - 0.02) - 3.055);
  for (const s of [1, -1]) {
    const zc = RIDGE_Z + s * (ZF - T / 2 - RIDGE_Z) / 2;
    put(g, RB(9.08, 0.012, LV + 0.02, 0.003, 1), M.lining, 0, vaultY(zc) - 0.008, zc, s * PITCH, 0, 0);
  }
  for (const bx of [-3.0, 0.9, 3.25]) put(g, RB(0.11, 0.16, 4.88, 0.012, 1), oak, bx, 3.0, (ZF + ZB) / 2);
  put(g, RB(9.08, 0.2, 0.14, 0.015, 1), oak, 0, RIDGE_Y - 0.12, RIDGE_Z);
  for (const zc of [ZF - T / 2 - 0.02, ZB + T / 2 + 0.02]) put(g, RB(9.08, 0.07, 0.04, 0.01, 1), M.trim, 0, 3.02, zc);

  /* --- windows + door --- */
  windowUnit(ctx, -2.75, 2.0, ZF, 0, 1.4, 1.2, { cols: 2, rows: 2, curtain: 0xf4efe6, curtain2: 0xe7dfd0, shutters: true, flowers: true });
  windowUnit(ctx, 2.55, 1.8, ZF, 0, 2.6, 1.6, { cols: 4, rows: 1, curtain: 0xcfe0e6, curtain2: 0xb9d2db });
  windowUnit(ctx, 1.55, 2.15, ZB, PI, 1.1, 0.8, { cols: 2, rows: 1, stool: false });
  windowUnit(ctx, -WX, 2.0, -3.1, -PI / 2, 0.8, 0.9, { cols: 1, rows: 2, curtain: 0xf4efe6, shutters: true });
  windowUnit(ctx, WX, 2.0, -1.3, PI / 2, 1.2, 1.2, { cols: 2, rows: 2, curtain: 0xcfe0e6, curtain2: 0xb9d2db, shutters: true });
  // door casing (outside + inside) and threshold
  const dg = group(g, 0.1, FY, ZF, 0);
  put(dg, RB(1.3, 0.12, 0.026, 0.006, 1), M.trim, 0, 2.18, T / 2 + 0.013);
  put(dg, RB(1.38, 0.035, 0.07, 0.008, 1), M.trim, 0, 2.255, T / 2 + 0.03);
  for (const s of [-1, 1]) { put(dg, RB(0.12, 2.12, 0.026, 0.006, 1), M.trim, s * 0.58, 1.06, T / 2 + 0.013); put(dg, RB(0.09, 2.12, 0.024, 0.006, 1), M.trim, s * 0.565, 1.06, -T / 2 - 0.018); }
  put(dg, RB(1.22, 0.09, 0.024, 0.006, 1), M.trim, 0, 2.165, -T / 2 - 0.018);
  for (const s of [-1, 1]) put(dg, RB(0.03, 2.12, T + 0.004, 0.004, 1), M.trim, s * 0.505, 1.06, 0);
  put(dg, RB(1.04, 0.03, T + 0.004, 0.004, 1), M.trim, 0, 2.105, 0);
  put(dg, RB(1.04, 0.02, T + 0.06, 0.006, 1), oak, 0, 0.01, 0.02);
  // hinged entry door (pivot at x = 0.6, swings inwards)
  const piv = group(g, 0.58, FY + 0.016, ZF, 0);
  piv.userData.dynamic = true;
  const LW = 0.96, LH = 2.08;
  for (const sx of [-0.05, -LW + 0.05]) put(piv, RB(0.1, LH, 0.05, 0.008, 1), M.teal, sx, LH / 2, 0);
  put(piv, RB(LW - 0.2, 0.2, 0.05, 0.008, 1), M.teal, -LW / 2, 0.1, 0);
  put(piv, RB(LW - 0.2, 0.14, 0.05, 0.008, 1), M.teal, -LW / 2, 0.98, 0);
  put(piv, RB(LW - 0.2, 0.13, 0.05, 0.008, 1), M.teal, -LW / 2, LH - 0.065, 0);
  put(piv, RB(LW - 0.2, 0.72, 0.03, 0.006, 1), M.teal, -LW / 2, 0.55, 0);
  for (const s of [-1, 1]) put(piv, RB(LW - 0.34, 0.5, 0.012, 0.01, 2), M.teal, -LW / 2, 0.55, s * 0.018);
  D(piv, quad(LW - 0.2, 0.86), M.winGlass, -LW / 2, 1.48, 0);
  put(piv, box(0.024, 0.86, 0.034), M.trim, -LW / 2, 1.48, 0);
  for (const yy of [1.2, 1.48, 1.76]) put(piv, box(LW - 0.2, 0.022, 0.034), M.trim, -LW / 2, yy, 0);
  for (const s of [-1, 1]) { V(piv, SP(0.028, 12, 8), 0xc9a24a, -LW + 0.1, 1.0, s * 0.05, 0, 0, 0, vcGloss()); V(piv, CY(0.03, 0.03, 0.012, 12), 0xc9a24a, -LW + 0.1, 1.0, s * 0.03, PI / 2, 0, 0, vcGloss()); }
  // starfish
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * PI * 2 + PI / 2, rr2 = i % 2 ? 0.035 : 0.09; i ? star.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2) : star.moveTo(Math.cos(a) * rr2, Math.sin(a) * rr2); }
  V(piv, prep(new THREE.ExtrudeGeometry(star, { depth: 0.015, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 })), 0xe8835a, -LW / 2, 0.58, 0.035);
  bake(piv);
  site.doors.push({ pivot: piv, openAngle: -1.45, auto: true, collider: aabb(-0.42, FY, ZF - 0.05, 0.62, FY + 2.12, ZF + 0.05) });

  /* --- interior partition with doorway --- */
  const px0 = -1.05, px1 = -0.95, dz0 = -1.6, dz1 = -0.65;
  for (const [a, b] of [[ZB + T / 2, dz0], [dz1, ZF - T / 2]]) { put(g, wbox(-1.0, (FY + 3.06) / 2, (a + b) / 2, 0.1, 3.06 - FY, b - a), M.lining); solid(site, -1.0, 1.8, (a + b) / 2, 0.1, 2.6, b - a); }
  put(g, wbox(-1.0, (2.55 + 3.06) / 2, (dz0 + dz1) / 2, 0.1, 3.06 - 2.55, dz1 - dz0), M.lining);
  put(g, prism(px0, px1, [[ZF - T / 2, 3.055], [ZB + T / 2, 3.055], [RIDGE_Z, RIDGE_Y - 0.03]]), M.lining);
  for (const sx of [-1, 1]) {
    const fx = -1.0 + sx * 0.062;
    put(g, RB(0.024, 0.09, dz1 - dz0 + 0.18, 0.006, 1), M.trim, fx, 2.595, (dz0 + dz1) / 2);
    for (const zz of [dz0 - 0.045, dz1 + 0.045]) put(g, RB(0.024, 2.05, 0.09, 0.006, 1), M.trim, fx, FY + 1.025, zz);
  }
  for (const zz of [dz0 + 0.015, dz1 - 0.015]) put(g, RB(0.104, 2.05, 0.03, 0.004, 1), M.trim, -1.0, FY + 1.025, zz);
  put(g, RB(0.104, 0.03, dz1 - dz0, 0.004, 1), M.trim, -1.0, 2.535, (dz0 + dz1) / 2);
  // baseboards
  for (const [x0, x1, zz] of [[-4.54, 4.54, ZF - T / 2 - 0.01], [-4.54, 4.54, ZB + T / 2 + 0.01]]) put(g, box(x1 - x0, 0.09, 0.016), M.trim, (x0 + x1) / 2, FY + 0.045, zz);
  for (const xx of [-WX + T / 2 + 0.01, WX - T / 2 - 0.01]) put(g, box(0.016, 0.09, 4.86), M.trim, xx, FY + 0.045, (ZF + ZB) / 2);

  /* ================= bedroom (x -4.54..-1.05) ================= */
  const bed = group(g, -2.8, FY, -3.25, 0);
  for (const s of [-1, 1]) put(bed, RB(0.07, 0.26, 2.08, 0.012, 1), oak, s * 0.8, 0.2, 0);
  put(bed, RB(1.68, 0.42, 0.07, 0.015, 2), oak, 0, 0.21, 1.04);
  put(bed, RB(1.74, 1.08, 0.07, 0.015, 2), oak, 0, 0.54, -1.04);
  put(bed, RB(1.6, 0.6, 0.02, 0.01, 2), M.seafoam, 0, 0.68, -1.0);
  put(bed, RB(1.82, 0.05, 0.1, 0.012, 1), oak, 0, 1.1, -1.04);
  // sea-blue quilted duvet over the footboard, turned-down cover, two pillows, teal + coral velvet cushions (soft.js)
  dressBed(bed, { bw: 1.56, ml: 2.0, mz: 0, mb: 0.31, mh: 0.22, duvet: 0xc9dde6, out: 0.08, hang: 0.15, pillows: [{ x: -0.37 }, { x: 0.37, hex: 0xf6f3ec }], seed: 11 });
  put(bed, painted(throwPillow(0.42, 0.32, 0.15, 2), 0x3f8f96), velvetMat(), -0.12, 0.75, -0.5, -0.3, 0.1, 0);
  put(bed, painted(throwPillow(0.36, 0.28, 0.14, 3), 0xe8735a), velvetMat(), 0.22, 0.73, -0.45, -0.25, -0.15, 0.05);
  // folded towel set + welcome shell on the duvet
  // folded terry towels for the guests
  put(bed, painted(foldedBlanket(0.42, 0.3, 2, 0.032, 4), 0xffffff), towelMat(), 0.3, 0.585, 0.72, 0, 0.12, 0);
  put(bed, painted(foldedBlanket(0.36, 0.26, 2, 0.028, 5), 0x9cd0cf), towelMat(), 0.3, 0.65, 0.72, 0, 0.1, 0);
  put(bed, painted(foldedBlanket(0.28, 0.19, 1, 0.03, 6), 0xffffff), towelMat(), 0.3, 0.708, 0.72, 0, 0.16, 0);
  V(bed, sphere(0.05, 12, 8).scale(1, 0.45, 0.8), 0xf3d9c4, 0.3, 0.76, 0.72, 0, 0.4, 0, vcGloss());
  for (const s of [-1, 1]) for (const t of [-1, 1]) put(bed, RB(0.06, 0.12, 0.06, 0.01, 1), oak, s * 0.8, 0.06, t * 1.0);
  solid(site, -2.8, FY + 0.3, -3.25, 1.76, 0.6, 2.12);
  site.interactables.push({ id: 'hotelBed', label: '펜션에서 자기', pos: [-2.8, 1.25, -2.05], radius: 1.6, seat: { pos: [-2.8, 1.55, -3.62], yaw: PI, pitch: -0.1 } });
  // nightstands, lamp, book, plant
  for (const nx of [-4.08, -1.55]) {
    const ns = group(g, nx, FY, -4.03, 0);
    put(ns, RB(0.44, 0.52, 0.38, 0.015, 2), oak, 0, 0.26, 0);
    V(ns, box(0.4, 0.004, 0.004), 0x6b4a2e, 0, 0.36, 0.191);
    V(ns, SP(0.018, 8, 6), 0xc9a24a, 0, 0.44, 0.2, 0, 0, 0, vcGloss());
    solid(site, nx, FY + 0.26, -4.03, 0.44, 0.52, 0.38);
  }
  const lampB = group(g, -4.12, FY + 0.52, -4.08, 0);
  put(lampB, lathe([[0, 0], [0.07, 0], [0.09, 0.08], [0.06, 0.2], [0.02, 0.24], [0, 0.24]], 20), mat('ceramic'));
  V(lampB, CY(0.006, 0.006, 0.12, 6), 0xc9a24a, 0, 0.29, 0);
  D(lampB, lathe([[0.14, 0], [0.1, 0.2]], 24), M.shade, 0, 0.27, 0);
  V(g, RB(0.16, 0.03, 0.22, 0.006, 1), 0x2a6f8e, -3.95, FY + 0.535, -3.93, 0, 0.3, 0);
  D(g, A.quad('book0', 0.15, 0.21).rotateX(-PI / 2), A.mat, -3.95, FY + 0.552, -3.93, 0, 0.3, 0);
  pottedPlant(g, -1.62, FY + 0.52, -4.1, { kind: 'bush', h: 0.3, potR: 0.07, potH: 0.11, pot: 0x9fc3c0, seed: 81 });
  juiceGlass(g, -1.45, FY + 0.52, -3.95, 0xdaf0f4);
  // art above the bed
  const art2 = group(g, -2.8, 2.25, ZB + T / 2 + 0.006, 0);
  put(art2, RB(0.5, 0.64, 0.03, 0.006, 1), oak, 0, 0, 0.015);
  D(art2, A.quad('lighthouse', 0.42, 0.56), A.mat, 0, 0, 0.031);
  // rug, clothes rack, suitcase, straw hat
  put(g, RB(1.9, 0.012, 1.0, 0.004, 1), M.rug, -2.8, FY + 0.006, -1.62);
  const rack = group(g, -4.18, FY, -1.0, 0);
  for (const zz of [-0.55, 0.55]) V(rack, CY(0.012, 0.012, 1.55, 8), 0x2b2b2b, 0, 0.78, zz);
  V(rack, CY(0.012, 0.012, 1.12, 8), 0x2b2b2b, 0, 1.55, 0, PI / 2, 0, 0);
  V(rack, CY(0.012, 0.012, 1.12, 8), 0x2b2b2b, 0, 0.12, 0, PI / 2, 0, 0);
  for (const zz of [-0.55, 0.55]) V(rack, box(0.4, 0.02, 0.03), 0x2b2b2b, 0, 0.01, zz);
  [[-0.32, 0xf6f3ec, 0.68], [-0.08, 0xf2c14e, 0.95], [0.18, 0x3f8f96, 0.7], [0.4, 0xe8735a, 0.6]].forEach(([zz, col, hh]) => {
    V(rack, torus(0.03, 0.004, 4, 8, PI), 0x8a6a4a, 0, 1.58, zz, 0, PI / 2, 0);
    V(rack, box(0.4, 0.015, 0.012), 0x8a6a4a, 0, 1.5, zz, 0, PI / 2, 0);
    V(rack, RB(0.05, hh, 0.38, 0.02, 2), col, 0, 1.5 - hh / 2, zz, 0, 0, 0, vcSoft());
  });
  solid(site, -4.18, FY + 0.8, -1.0, 0.42, 1.6, 1.15);
  const suit = group(g, -3.85, FY, 0.18, 0.25);
  V(suit, RB(0.44, 0.62, 0.26, 0.05, 2), 0x2f7f86, 0, 0.36, 0, 0, 0, 0, vcGloss());
  for (const s of [-1, 1]) V(suit, box(0.44, 0.012, 0.27), 0x245f64, 0, 0.36 + s * 0.15, 0);
  V(suit, RB(0.16, 0.025, 0.04, 0.01, 1), 0x2b2b2b, 0, 0.69, 0);
  for (const s of [-1, 1]) V(suit, CY(0.025, 0.025, 0.02, 10), 0x1a1a1c, s * 0.17, 0.03, -0.09, 0, 0, PI / 2);
  solid(site, -3.85, FY + 0.35, 0.18, 0.5, 0.7, 0.35);
  const hat = group(g, -3.3, FY + 0.618, -2.55, 0.4);
  V(hat, lathe([[0, 0], [0.21, 0], [0.22, 0.012], [0.11, 0.02], [0.105, 0.1], [0.06, 0.125], [0, 0.128]], 24), 0xe2c98f, 0, 0, 0, -0.08, 0, 0.05, vcSoft());
  V(hat, CY(0.108, 0.108, 0.025, 24, true), 0x2f7f86, 0, 0.035, 0, -0.08, 0, 0.05);
  site.lamps.push({ pos: [-2.8, 2.5, -2.3], color: 0xffd9a8, intensity: 6, range: 6 });
  site.lamps.push({ pos: [-4.12, FY + 0.95, -3.9], color: 0xffcf96, intensity: 3, range: 3.5 });

  /* ================= living + kitchenette (x -0.95..4.54) ================= */
  // kitchen counter along the back wall
  const kc = group(g, 1.2, FY, ZB + T / 2 + 0.3, 0);
  put(kc, RB(3.0, 0.84, 0.58, 0.015, 2), M.seafoam, 0, 0.44, 0);
  V(kc, box(2.96, 0.08, 0.5), 0x3a3b3d, 0, 0.04, -0.02);
  for (let i = 0; i < 5; i++) {
    const cx = -1.5 + (i + 0.5) * 0.6;
    V(kc, box(0.004, 0.72, 0.004), 0x7aa39d, cx + 0.3, 0.46, 0.291);
    V(kc, RB(0.1, 0.018, 0.022, 0.006, 1), 0xc9a24a, cx + (i % 2 ? -0.2 : 0.2), 0.74, 0.3, 0, 0, 0, vcGloss());
  }
  put(kc, RB(3.06, 0.04, 0.62, 0.01, 2), oak, 0, 0.88, 0.01);
  put(kc, RB(0.52, 0.02, 0.38, 0.006, 1), mat('steel'), 0.35, 0.893, 0.02);
  V(kc, box(0.46, 0.012, 0.32), 0x8e9396, 0.35, 0.89, 0.02);
  const fau = tube(new THREE.CatmullRomCurve3([new THREE.Vector3(0.35, 0.9, -0.2), new THREE.Vector3(0.35, 1.18, -0.18), new THREE.Vector3(0.35, 1.2, -0.06), new THREE.Vector3(0.35, 1.1, 0.0)]), 0.012, 16, 8);
  put(kc, fau, mat('chrome'));
  put(kc, RB(0.56, 0.012, 0.44, 0.004, 1), blackPl(), -0.9, 0.906, 0.0);
  for (const zz of [-0.09, 0.1]) V(kc, torus(0.08, 0.004, 4, 24), 0x6a6e73, -0.9, 0.913, zz, PI / 2, 0, 0);
  kettle(kc, -0.9, 0.912, -0.09, 0xf6f2ea);
  V(kc, RB(0.36, 0.02, 0.24, 0.006, 1), 0xc49a6c, 1.05, 0.91, 0.06, 0, 0.2, 0);
  V(kc, sphere(0.04, 12, 8).scale(1, 0.8, 1), 0xf2d34a, 1.1, 0.95, 0.06);
  const fb = group(kc, 1.3, 0.9, -0.12, 0);
  put(fb, lathe([[0, 0], [0.08, 0], [0.14, 0.07], [0.135, 0.075], [0.075, 0.008], [0, 0.008]], 20), mat('ceramic'));
  for (let i = 0; i < 4; i++) V(fb, SP(0.04, 10, 8), i === 3 ? 0x8cc04a : 0xf29a2e, Math.cos(i * 1.9) * 0.05, 0.06 + (i === 3 ? 0.04 : 0), Math.sin(i * 1.9) * 0.05);
  mug(kc, -0.45, 0.9, 0.12, 0x3f8f96, 0.4, false);
  mug(kc, -0.3, 0.9, 0.05, 0xf6f2ea, 2.0, false);
  put(g, box(3.0, 0.3, 0.012), mat('wallTile'), 1.2, FY + 1.06, ZB + T / 2 + 0.012);
  // open shelf with plates, mugs and jars
  const sh = group(g, 0.25, FY + 1.65, ZB + T / 2 + 0.14, 0);
  put(sh, RB(1.1, 0.035, 0.26, 0.008, 1), oak, 0, 0, 0);
  for (const s of [-1, 1]) put(sh, RB(0.03, 0.14, 0.2, 0.006, 1), blackPl(), s * 0.42, -0.08, -0.02);
  for (let i = 0; i < 5; i++) put(sh, CY(0.11, 0.08, 0.016, 24), mat('ceramic'), -0.32, 0.026 + i * 0.018, 0.0);
  mug(sh, 0.0, 0.0175, 0.02, 0xe8735a, 1.2, false);
  mug(sh, 0.13, 0.0175, 0.0, 0xf2c14e, 0.8, false);
  for (const [jx, col] of [[0.3, 0xd9b26a], [0.42, 0x6b3f22]]) {
    D(sh, CY(0.045, 0.045, 0.16, 16), mat('glass'), jx, 0.098, 0);
    V(sh, CY(0.04, 0.04, 0.1, 14), col, jx, 0.068, 0);
    V(sh, CY(0.047, 0.047, 0.02, 16), 0x8a6a4a, jx, 0.188, 0);
  }
  solid(site, 1.2, FY + 0.45, ZB + T / 2 + 0.3, 3.06, 0.9, 0.62);
  // retro fridge
  const fr = group(g, 3.13, FY, ZB + T / 2 + 0.33, 0);
  V(fr, RB(0.64, 1.42, 0.62, 0.07, 3), 0xa9dccd, 0, 0.73, 0, 0, 0, 0, vcGloss());
  V(fr, box(0.64, 0.008, 0.01), 0x7fb3a4, 0, 1.08, 0.312);
  for (const yy of [1.25, 0.8]) put(fr, RB(0.035, 0.22, 0.05, 0.012, 1), mat('chrome'), 0.25, yy, 0.33);
  D(fr, A.quad('note', 0.09, 0.09), A.mat, -0.12, 1.22, 0.311, 0, 0, 0.06);
  V(fr, CY(0.02, 0.02, 0.012, 12), 0xe8735a, -0.05, 1.29, 0.312, PI / 2, 0, 0);
  for (let i = 0; i < 3; i++) V(fr, RB(0.12, 0.08, 0.08, 0.01, 1), [0xe8735a, 0xf2c14e, 0x3f8f96][i], -0.15 + i * 0.14, 1.48, 0, 0, i * 0.3, 0);
  solid(site, 3.13, FY + 0.72, ZB + T / 2 + 0.33, 0.64, 1.44, 0.62);
  site.lamps.push({ pos: [1.2, 2.5, -3.7], color: 0xffe2b8, intensity: 5, range: 5 });
  // sofa, rug, coffee table with welcome note
  put(g, RB(2.7, 0.012, 1.9, 0.004, 1), M.rug, 1.9, FY + 0.006, -1.5);
  sofa(g, 1.9, FY, -2.32, 0, { w: 2.1, fabric: mat('fabricBeige'), legs: oak, pillows: [0x3f8f96, 0xe8735a, 0xf4efe6] });
  V(g, RB(0.36, 0.06, 0.95, 0.03, 2), 0x2f7f86, 2.82, FY + 0.76, -2.32, 0, 0, 0.1, vcSoft());
  solid(site, 1.9, FY + 0.4, -2.32, 2.1, 0.8, 0.92);
  const ct = group(g, 1.9, FY, -1.12, 0);
  put(ct, RB(1.05, 0.045, 0.56, 0.015, 2), oak, 0, 0.42, 0);
  put(ct, RB(0.95, 0.025, 0.46, 0.008, 1), oak, 0, 0.1, 0);
  for (const sx of [-0.46, 0.46]) for (const sz of [-0.22, 0.22]) put(ct, CY(0.02, 0.016, 0.42, 8), oak, sx, 0.21, sz);
  V(ct, box(0.21, 0.004, 0.155), 0xfbf7ee, -0.18, 0.445, 0.05, 0, 0.25, 0);
  D(ct, A.quad('welcome', 0.2, 0.147).rotateX(-PI / 2), A.mat, -0.18, 0.448, 0.05, 0, 0.25, 0);
  const sb = group(ct, 0.22, 0.4425, -0.05, 0);
  put(sb, lathe([[0, 0], [0.07, 0], [0.12, 0.05], [0.115, 0.055], [0.065, 0.008], [0, 0.008]], 20), mat('ceramic'));
  for (let i = 0; i < 6; i++) V(sb, sphere(0.03, 10, 6).scale(1, 0.5, 1.3), [0xf3d9c4, 0xe9c0a8, 0xfbf3e8][i % 3], Math.cos(i * 1.1) * 0.05, 0.035, Math.sin(i * 1.1) * 0.05, 0, i, 0, vcGloss());
  V(ct, RB(0.16, 0.03, 0.22, 0.006, 1), 0xe8735a, 0.36, 0.4575, 0.12, 0, -0.2, 0);
  D(ct, A.quad('book1', 0.15, 0.21).rotateX(-PI / 2), A.mat, 0.36, 0.4735, 0.12, 0, -0.2, 0);
  V(ct, RB(0.2, 0.012, 0.28, 0.004, 1), 0x3f8f96, 0.0, 0.11 + 0.0185, 0.0, 0, 0.3, 0);
  solid(site, 1.9, FY + 0.22, -1.12, 1.05, 0.45, 0.56);
  // floor lamp (glowing shade) beside the sofa
  const fl = group(g, 0.55, FY, -2.55, 0);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * PI * 2; put(fl, CY(0.012, 0.012, 1.45, 6), oak, Math.cos(a) * 0.1, 0.72, Math.sin(a) * 0.1, Math.sin(a) * 0.14, 0, -Math.cos(a) * 0.14); }
  D(fl, lathe([[0.2, 0], [0.18, 0.3]], 28), M.shade, 0, 1.38, 0);
  site.lamps.push({ pos: [0.55, FY + 1.5, -2.55], color: 0xffd5a0, intensity: 5, range: 5 });
  // ceiling fan with light from the ridge beam
  const fanY = 3.45;
  V(g, CY(0.012, 0.012, RIDGE_Y - 0.22 - fanY, 6), 0xf2efe8, 1.9, (RIDGE_Y - 0.22 + fanY) / 2, RIDGE_Z);
  put(g, CY(0.11, 0.12, 0.12, 20), whitePl(), 1.9, fanY, RIDGE_Z);
  D(g, lathe([[0.0, -0.09], [0.06, -0.08], [0.1, -0.03], [0.105, 0]], 20), mat('lampGlow'), 1.9, fanY - 0.06, RIDGE_Z);
  for (let i = 0; i < 5; i++) { const fg = group(g, 1.9, fanY + 0.02, RIDGE_Z, (i / 5) * PI * 2 + 0.3); put(fg, RB(0.6, 0.012, 0.13, 0.005, 1), oak, 0.42, 0, 0, 0.12, 0, 0); V(fg, box(0.16, 0.012, 0.03), 0xd9d6cf, 0.1, 0, 0); }
  site.lamps.push({ pos: [1.9, fanY - 0.25, RIDGE_Z], color: 0xffe6c4, intensity: 8, range: 7 });
  // bistro table by the side window
  const bt = group(g, 3.9, FY, -1.28, 0);
  put(bt, CY(0.34, 0.34, 0.03, 32), whitePl(), 0, 0.73, 0);
  put(bt, CY(0.025, 0.025, 0.7, 10), blackPl(), 0, 0.37, 0);
  put(bt, CY(0.22, 0.24, 0.025, 24), blackPl(), 0, 0.012, 0);
  const pit = group(bt, -0.1, 0.745, -0.05, 0);
  D(pit, lathe([[0, 0], [0.06, 0], [0.065, 0.16], [0.05, 0.22], [0.0, 0.22]], 18), mat('glass'));
  V(pit, CY(0.055, 0.058, 0.14, 16), 0xf6e27a, 0, 0.075, 0, 0, 0, 0, vcGloss());
  juiceGlass(bt, 0.13, 0.745, 0.08, 0xf6e27a);
  juiceGlass(bt, 0.12, 0.745, -0.14, 0xf6e27a);
  cafeChair(g, 3.9, FY, -0.64, PI, 1);
  cafeChair(g, 3.9, FY, -1.92, 0.1, 0);
  solid(site, 3.9, FY + 0.38, -1.28, 0.7, 0.76, 0.7);
  // sideboard with radio and board games
  const sbd = group(g, 4.27, FY, -3.0, -PI / 2);
  put(sbd, RB(1.0, 0.66, 0.42, 0.015, 2), oak, 0, 0.33, 0);
  for (const s of [-1, 1]) V(sbd, box(0.004, 0.56, 0.004), 0x6b4a2e, s * 0.0, 0.34, 0.211);
  for (const s of [-1, 1]) V(sbd, SP(0.016, 8, 6), 0xc9a24a, s * 0.06, 0.4, 0.22, 0, 0, 0, vcGloss());
  const rad = group(sbd, -0.25, 0.66, 0.02, 0.2);
  V(rad, RB(0.3, 0.17, 0.12, 0.03, 2), 0xe8735a, 0, 0.085, 0, 0, 0, 0, vcGloss());
  V(rad, CY(0.045, 0.045, 0.01, 16), 0xf2efe8, -0.07, 0.085, 0.06, PI / 2, 0, 0);
  V(rad, box(0.09, 0.05, 0.01), 0x2b2b2b, 0.07, 0.085, 0.06);
  V(rad, torus(0.07, 0.006, 4, 12, PI), 0x2b2b2b, 0, 0.17, 0);
  for (let i = 0; i < 3; i++) V(sbd, RB(0.34, 0.05, 0.26, 0.008, 1), [0x2a6f8e, 0xf2c14e, 0xe8735a][i], 0.22, 0.685 + i * 0.052, 0.0, 0, (i - 1) * 0.12, 0);
  solid(site, 4.27, FY + 0.33, -3.0, 0.42, 0.66, 1.0);
  // sea painting on the partition (living side)
  const art = group(g, -0.948, 1.95, -2.55, PI / 2);
  put(art, RB(1.08, 0.78, 0.035, 0.008, 1), oak, 0, 0, 0.0175);
  D(art, A.quad('seaArt', 1.0, 0.703), A.mat, 0, 0, 0.0355);
  // coat hooks by the entry with a beach bag and a cap
  const hk = group(g, -0.948, FY + 1.6, -0.05, PI / 2);
  put(hk, RB(0.8, 0.09, 0.025, 0.006, 1), oak, 0, 0, 0.0125);
  for (let i = 0; i < 3; i++) V(hk, CY(0.01, 0.01, 0.07, 8), 0x2b2b2b, -0.26 + i * 0.26, 0, 0.055, PI / 2, 0, 0);
  V(hk, RB(0.34, 0.38, 0.1, 0.04, 2), 0xe2cfa6, -0.26, -0.25, 0.08, 0.06, 0, 0, vcSoft());
  V(hk, box(0.345, 0.06, 0.102), 0x2f7f86, -0.26, -0.2, 0.08, 0.06, 0, 0);
  V(hk, torus(0.1, 0.012, 6, 12, PI), 0xe2cfa6, -0.26, -0.06, 0.08, 0, 0, 0);
  V(hk, RB(0.28, 0.6, 0.03, 0.012, 1), 0x9cd0cf, 0.26, -0.27, 0.06, 0, 0, 0, vcSoft());
  // shoe mat + sneakers inside the door
  V(g, RB(0.7, 0.012, 0.45, 0.004, 1), 0x5a4a3a, 1.0, FY + 0.006, 0.22, 0, 0, 0, vcSoft());
  for (const s of [-1, 1]) {
    const sn = group(g, 1.0 + s * 0.09, FY + 0.012, 0.2, 0.1 * s);
    V(sn, RB(0.09, 0.025, 0.26, 0.012, 1), 0xf4f1ea, 0, 0.0125, 0);
    V(sn, RB(0.085, 0.07, 0.2, 0.035, 2), 0x3f8f96, 0, 0.055, -0.02, 0, 0, 0, vcSoft());
  }
  pottedPlant(g, 4.15, FY, 0.12, { kind: 'fig', h: 1.3, potR: 0.19, potH: 0.38, pot: 'white', seed: 91 });
  solid(site, 4.15, FY + 0.5, 0.12, 0.42, 1.0, 0.42);

  /* ================= deck ================= */
  const DX = 5.9, DZ0 = ZF + T / 2, DZ1 = 4.2;
  V(g, plane(DX * 2, DZ1 - DZ0), 0x2a241e, 0, 0.44, (DZ0 + DZ1) / 2);
  for (let z = DZ0 + 0.1; z < DZ1 - 0.05; z += 0.15) put(g, RB(DX * 2 - 0.04, 0.035, 0.135, 0.008, 1), M.deck, 0, FY - 0.0175, z);
  put(g, RB(DX * 2 + 0.06, 0.22, 0.04, 0.008, 1), M.deck, 0, 0.39, DZ1 + 0.02);
  for (const s of [-1, 1]) put(g, RB(0.04, 0.22, DZ1 - DZ0, 0.008, 1), M.deck, s * (DX + 0.02), 0.39, (DZ0 + DZ1) / 2);
  V(g, plane(DX * 2, 0.29).rotateX(PI / 2), 0x2a241e, 0, 0.145, DZ1 - 0.04);
  for (let x = -DX + 0.06; x < DX; x += 0.14) if (Math.abs(x) > 1.05) put(g, box(0.09, 0.29, 0.02), M.deck, x, 0.145, DZ1 + 0.01);
  for (const s of [-1, 1]) for (let z = DZ0 + 0.08; z < DZ1; z += 0.14) put(g, box(0.02, 0.29, 0.09), M.deck, s * (DX + 0.01), 0.145, z);
  solid(site, 0, FY / 2, (DZ0 + DZ1) / 2, DX * 2 + 0.08, FY, DZ1 - DZ0);
  // steps
  for (const [top, z0, z1] of [[0.335, 4.2, 4.55], [0.17, 4.55, 4.9]]) {
    put(g, RB(2.0, 0.04, z1 - z0 + 0.02, 0.008, 1), M.deck, 0, top - 0.02, (z0 + z1) / 2);
    put(g, box(1.96, top - 0.04, 0.025), M.deck, 0, (top - 0.04) / 2, z1 - 0.02);
    solid(site, 0, top / 2, (z0 + z1) / 2, 2.0, top, z1 - z0);
  }
  V(g, box(1.96, 0.16, 0.02), 0x2a241e, 0, 0.42, DZ1 + 0.005);
  for (const s of [-1, 1]) put(g, RB(0.05, 0.36, 0.72, 0.008, 1), M.deck, s * 1.02, 0.17, 4.55);
  // railing (front split by the steps, both sides) + tall posts for the string lights
  const RY = FY + 0.95, rz = DZ1 - 0.06, rx = DX - 0.04;
  const railRun = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az), cx = (ax + bx) / 2, cz = (az + bz) / 2, alongX = Math.abs(bx - ax) > Math.abs(bz - az);
    const ry = alongX ? 0 : PI / 2;
    put(g, RB(len + 0.1, 0.045, 0.14, 0.01, 1), M.deck, cx, RY, cz, 0, ry, 0);
    put(g, RB(len, 0.04, 0.06, 0.008, 1), M.trim, cx, FY + 0.1, cz, 0, ry, 0);
    const n = Math.floor(len / 0.12);
    for (let i = 1; i < n; i++) { const t = i / n; put(g, box(0.034, 0.83, 0.034), M.trim, ax + (bx - ax) * t, FY + 0.535, az + (bz - az) * t); }
    solid(site, cx, FY + 0.5, cz, alongX ? len : 0.1, 1.0, alongX ? 0.1 : len);
  };
  railRun(-rx, rz, -1.04, rz); railRun(1.04, rz, rx, rz);
  railRun(-rx, DZ0 + 0.1, -rx, rz); railRun(rx, DZ0 + 0.1, rx, rz);
  const posts = [[-rx, rz, true], [-1.04, rz, true], [1.04, rz, true], [rx, rz, true], [-rx, DZ0 + 0.1, false], [rx, DZ0 + 0.1, false], [-rx, 2.4, false], [rx, 2.4, false], [-3.4, rz, false], [3.4, rz, false]];
  for (const [x, z, tall] of posts) {
    const h = tall ? 2.45 : 1.0;
    put(g, RB(0.1, h, 0.1, 0.012, 1), M.trim, x, FY + h / 2, z);
    put(g, RB(0.14, 0.04, 0.14, 0.01, 1), M.trim, x, FY + h + 0.02, z);
    if (tall) V(g, SP(0.045, 10, 8), 0xf2efe8, x, FY + h + 0.08, z);
  }
  // string lights: along the front and back to the eave
  const eaveY = 2.7, eaveZ = 1.02, top = FY + 2.33;
  stringLight(ctx, [-rx, top, rz], [-1.04, top, rz], 0.32);
  stringLight(ctx, [-1.04, top, rz], [1.04, top, rz], 0.16);
  stringLight(ctx, [1.04, top, rz], [rx, top, rz], 0.32);
  for (const [px, ex] of [[-rx, -4.8], [-1.04, -1.7], [1.04, 1.9], [rx, 4.8]]) stringLight(ctx, [px, top, rz], [ex, eaveY, eaveZ], 0.28);
  site.nightGlow.push(M.bulb, M.curtain, M.shade, M.winGlass);
  site.lamps.push({ pos: [-3.3, 2.3, 2.6], color: 0xffcf8a, intensity: 5, range: 6 });
  site.lamps.push({ pos: [3.3, 2.3, 2.6], color: 0xffcf8a, intensity: 5, range: 6 });

  /* --- deck life: chairs, side table, parasol set, bbq, towels, surfboard, plants --- */
  adirondack(g, -4.35, FY, 2.95, 0.18, 0xf2c14e);
  adirondack(g, -2.85, FY, 2.95, -0.15, 0x3f8f96);
  for (const [cx, cz] of [[-4.35, 2.95], [-2.85, 2.95]]) solid(site, cx, FY + 0.35, cz, 0.8, 0.7, 0.9);
  site.npcSpots.push({ pos: [-4.35, FY, 2.95], yaw: PI - 0.18, pose: 'sit', role: 'friend' });
  site.npcSpots.push({ pos: [-2.85, FY, 2.95], yaw: PI + 0.15, pose: 'sit', role: 'friend' });
  const st = group(g, -3.6, FY, 3.3, 0.3);
  put(st, RB(0.42, 0.03, 0.42, 0.01, 1), M.deck, 0, 0.45, 0);
  for (const sx of [-0.17, 0.17]) for (const sz of [-0.17, 0.17]) put(st, RB(0.04, 0.44, 0.04, 0.008, 1), M.deck, sx, 0.22, sz);
  juiceGlass(st, -0.08, 0.465, 0.06, 0xf5a524);
  juiceGlass(st, 0.07, 0.465, -0.08, 0xf5a524);
  bottle(st, 0.1, 0.465, 0.1, 0x6fbf73);
  const sg2 = group(st, -0.08, 0.47, -0.1, 0.5);
  for (const s of [-1, 1]) V(sg2, CY(0.028, 0.028, 0.006, 14), 0x1d2a33, s * 0.035, 0.004, 0, 0, 0, 0, vcGloss());
  V(sg2, box(0.025, 0.006, 0.006), 0x1d2a33, 0, 0.006, 0);
  parasol(g, 3.3, FY, 2.65, 1.25, 2.2);
  const pt = group(g, 3.3, FY, 2.65, 0);
  put(pt, CY(0.4, 0.4, 0.03, 32), whitePl(), 0, 0.72, 0);
  put(pt, CY(0.22, 0.24, 0.025, 24), blackPl(), 0, 0.012, 0);
  put(pt, CY(0.03, 0.03, 0.7, 10), blackPl(), 0, 0.36, 0);
  const wm = group(pt, 0.16, 0.735, 0.1, 0);
  put(wm, CY(0.15, 0.12, 0.02, 24), mat('ceramic'), 0, 0.01, 0);
  for (let i = 0; i < 4; i++) {
    const sl = new THREE.Shape(); sl.moveTo(0, 0); sl.absarc(0, 0, 0.09, 0, PI, false); sl.lineTo(0, 0);
    const wg = prep(new THREE.ExtrudeGeometry(sl, { depth: 0.022, bevelEnabled: false, curveSegments: 10 }));
    const pos = wg.attributes.position, cc = new Float32Array(pos.count * 3), c = new THREE.Color();
    for (let k = 0; k < pos.count; k++) { const r = Math.hypot(pos.getX(k), pos.getY(k)); c.set(r > 0.078 ? 0x3f7f2e : r > 0.07 ? 0xeef3d2 : 0xe8505b); cc[k * 3] = c.r; cc[k * 3 + 1] = c.g; cc[k * 3 + 2] = c.b; }
    wg.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    put(wm, wg, vcGloss(), Math.cos(i * 1.6) * 0.04, 0.03, Math.sin(i * 1.6) * 0.04, -PI / 2 + 0.25, i * 1.6, 0);
  }
  juiceGlass(pt, -0.15, 0.735, -0.1, 0xf5a524);
  cafeChair(g, 2.62, FY, 2.65, PI / 2, 1);
  cafeChair(g, 3.98, FY, 2.65, -PI / 2, 0);
  solid(site, 3.3, FY + 0.38, 2.65, 0.8, 0.76, 0.8);
  site.npcSpots.push({ pos: [2.62, FY, 2.65], yaw: -PI / 2, pose: 'sit', role: 'friend' });
  site.npcSpots.push({ pos: [3.98, FY, 2.65], yaw: PI / 2, pose: 'sit', role: 'friend' });
  bbq(g, 5.15, FY, 1.35);
  solid(site, 5.15, FY + 0.5, 1.35, 0.62, 1.0, 0.62);
  towel(ctx, -rx, RY + 0.03, 1.75, false, 0.75, M.towel);
  towel(ctx, rx, RY + 0.03, 3.3, false, 0.7, M.towel);
  towel(ctx, -2.3, RY + 0.03, rz, true, 0.7, vcSoftTinted(0x3f9aa6));
  surfboard(g, 4.3, FY, 0.86, 0);
  pottedPlant(g, -1.0, FY, 1.3, { kind: 'palm', h: 0.95, potR: 0.2, potH: 0.38, pot: 'terracotta', seed: 92 });
  const hy = pottedPlant(g, 0.92, FY, 0.95, { kind: 'bush', h: 0.45, potR: 0.17, potH: 0.32, pot: 0xf1ece4, seed: 93 });
  for (let i = 0; i < 5; i++) { const a = i * 1.26; for (let k = 0; k < 7; k++) V(hy, SP(0.026, 6, 4), i % 2 ? 0x8fb3e8 : 0xb7a3e0, Math.cos(a) * 0.12 + Math.cos(k * 2.1) * 0.04, 0.5 + Math.sin(k) * 0.03, Math.sin(a) * 0.12 + Math.sin(k * 2.1) * 0.04); }
  for (const [px, pz] of [[-1.0, 1.3], [0.92, 0.95]]) solid(site, px, FY + 0.4, pz, 0.4, 0.8, 0.4);
  V(g, RB(0.9, 0.014, 0.5, 0.004, 1), 0x9c7a4a, 0.1, FY + 0.007, 1.0, 0, 0, 0, vcSoft());
  flipflops(g, -0.45, FY, 1.2, 0.4, 0xe8735a);
  flipflops(g, 0.55, 0.17, 4.72, -0.3, 0x3f8f96);
  // life ring, wall lantern, plaque
  for (let k = 0; k < 4; k++) V(g, torus(0.23, 0.055, 8, 10, PI / 2), k % 2 ? 0xf7f2e8 : 0xf06a2a, -1.45, 1.9, ZF + T / 2 + 0.07, 0, 0, k * PI / 2, vcGloss());
  V(g, CY(0.012, 0.012, 0.08, 6), 0x2b2b2b, -1.45, 2.16, ZF + T / 2 + 0.04, PI / 2, 0, 0);
  const ln = group(g, -0.72, 2.32, ZF + T / 2 + 0.13, 0);
  V(ln, RB(0.06, 0.12, 0.12, 0.01, 1), 0x2b2b2b, 0, 0, -0.07);
  V(ln, RB(0.2, 0.04, 0.2, 0.01, 1), 0x2b2b2b, 0, 0.16, 0.0);
  V(ln, RB(0.16, 0.025, 0.16, 0.008, 1), 0x2b2b2b, 0, -0.13, 0.0);
  for (const sx of [-0.075, 0.075]) for (const sz of [-0.075, 0.075]) V(ln, box(0.012, 0.26, 0.012), 0x2b2b2b, sx, 0.015, sz);
  D(ln, CY(0.035, 0.035, 0.11, 12), mat('lampGlow'), 0, 0.0, 0);
  for (let k = 0; k < 4; k++) D(ln, quad(0.14, 0.24), mat('glass'), Math.sin(k * PI / 2) * 0.075, 0.015, Math.cos(k * PI / 2) * 0.075, 0, k * PI / 2, 0);
  site.lamps.push({ pos: [-0.72, 2.25, 0.95], color: 0xffcf8a, intensity: 4, range: 4 });
  const pq = group(g, 0.93, 1.95, ZF + T / 2 + 0.01, 0);
  put(pq, RB(0.32, 0.13, 0.025, 0.008, 1), oak, 0, 0, 0.0125);
  D(pq, A.quad('plaque', 0.3, 0.12), A.mat, 0, 0, 0.026);
  // outdoor AC unit at the back
  const ac = group(g, 3.0, 0.0, ZB - T / 2 - 0.27, PI);
  put(ac, RB(0.8, 0.62, 0.28, 0.02, 2), whitePl(), 0, 0.33, 0);
  V(ac, CY(0.2, 0.2, 0.01, 24), 0x3a3d42, -0.12, 0.34, 0.141, PI / 2, 0, 0);
  V(ac, torus(0.2, 0.012, 4, 24), 0x9aa0a6, -0.12, 0.34, 0.145);
  for (const s of [-1, 1]) V(ac, CY(0.015, 0.015, 0.7, 8), 0xd9d6cf, 0.3 + s * 0.04, 0.95, -0.14);
  solid(site, 3.0, 0.33, ZB - T / 2 - 0.27, 0.8, 0.66, 0.3);

  /* --- outdoor beach shower on the left wall --- */
  const sw = group(g, -WX - T / 2, 0, -1.0, 0);
  for (let i = 0; i < 6; i++) put(sw, RB(0.11, 0.035, 0.8, 0.008, 1), M.deck, -0.12 - i * 0.13, 0.1, 0);
  for (const zz of [-0.32, 0.32]) put(sw, RB(0.78, 0.08, 0.06, 0.008, 1), M.deck, -0.43, 0.04, zz);
  put(sw, CY(0.016, 0.016, 2.05, 10), mat('chrome'), -0.06, 1.16, 0);
  put(sw, CY(0.016, 0.016, 0.3, 10), mat('chrome'), -0.2, 2.18, 0, 0, 0, PI / 2);
  put(sw, CY(0.1, 0.03, 0.05, 18), mat('chrome'), -0.36, 2.15, 0);
  for (const zz of [-0.06, 0.06]) put(sw, SP(0.03, 10, 8), mat('chrome'), -0.08, 1.05, zz);
  V(sw, RB(0.04, 0.06, 0.4, 0.01, 1), 0x8a6a4a, -0.04, 1.45, 0.3);
  put(sw, RB(0.26, 0.5, 0.012, 0.006, 1), M.towel, -0.07, 1.18, 0.32, 0, PI / 2, 0);
  solid(site, -WX - T / 2 - 0.4, 0.06, -1.0, 0.8, 0.12, 0.8);

  /* --- sign post at the steps (lit letters, both faces) --- */
  const sp = group(g, 1.5, 0, 4.62, 0);
  put(sp, RB(0.12, 2.5, 0.12, 0.012, 1), M.deck, 0, 1.25, 0);
  put(sp, RB(1.25, 0.08, 0.08, 0.01, 1), M.deck, 0.6, 2.38, 0);
  put(sp, RB(0.05, 0.36, 0.04, 0.008, 1), M.deck, 0.2, 2.2, 0, 0, 0, 0.75);
  for (const cx of [0.32, 1.08]) V(sp, CY(0.006, 0.006, 0.2, 4), 0x2b2b2b, cx, 2.25, 0);
  put(sp, RB(1.3, 0.42, 0.05, 0.015, 2), mat('walnut'), 0.7, 1.94, 0);
  for (const s of [1, -1]) D(sp, A.quad('sign', 1.2, 0.387), A.sign, 0.7, 1.94, s * 0.0265, 0, s > 0 ? 0 : PI, 0);
  solid(site, 1.5, 1.2, 4.62, 0.15, 2.4, 0.15);
  site.nightGlow.push(A.sign);
  site.lamps.push({ pos: [2.2, 2.6, 4.75], color: 0xffd9a8, intensity: 3, range: 4 });

  /* --- sand details: beach grass, bucket + spade, stones --- */
  for (const [x, z, sd, h] of [[-5.4, 4.62, 1, 0.6], [-3.5, 4.75, 2, 0.45], [-2.0, 4.55, 3, 0.4], [3.4, 4.7, 4, 0.5], [5.35, 4.5, 5, 0.65], [-5.65, -4.55, 6, 0.6], [5.6, -3.9, 7, 0.55], [5.6, -0.6, 8, 0.45], [-5.55, 0.1, 9, 0.5], [-5.6, -2.4, 10, 0.4]]) grassClump(g, x, 0, z, sd, h);
  const bk = group(g, -1.55, 0, 4.62, 0.3);
  V(bk, lathe([[0, 0], [0.09, 0], [0.11, 0.17], [0.105, 0.17], [0.085, 0.01], [0, 0.01]], 18), 0xe8505b, 0, 0, 0, 0, 0, 0, vcGloss());
  V(bk, torus(0.105, 0.004, 4, 14, PI), 0xf2c14e, 0, 0.17, 0, 0.6, 0, 0);
  V(bk, RB(0.07, 0.012, 0.1, 0.005, 1), 0xf2c14e, 0.22, 0.02, 0.05, 0.1, 0.4, 0.2);
  V(bk, CY(0.008, 0.008, 0.22, 6), 0xf2c14e, 0.28, 0.06, 0.15, 1.3, 0.4, 0);
  for (const [x, z, s] of [[-4.6, 4.8, 0.14], [4.6, 4.75, 0.11], [-5.75, -1.3, 0.12]]) V(g, sphere(1, 10, 8).scale(s * 1.4, s * 0.7, s), 0x9a958b, x, s * 0.35, z, 0, x, 0);

  site.spawn = { pos: [0, FY, 3.0], yaw: 0 };
  bake(g);
  return site;
}

/** vcSoft-coloured material stand-in for towel(): a towel in one flat colour. */
function vcSoftTinted(hex) {
  return cached('pensionTowel' + hex, () => { const m = mat('linen').clone(); m.color.set(hex); m.name = 'pensionTowel'; return m; });
}
