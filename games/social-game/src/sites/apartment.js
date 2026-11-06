// 세온 아파트: apartment towers (the player's home is unit 802호 in the main tower) and the small
// neighbourhood houses that line the streets around them.
//
// buildApartment({ main = true, dong = '101동', floors = 15, seed = 1 }) → Site (footprint 26 x 14, entrance +Z).
//   Floor k (0 = ground) has its slab top at y = 0.3 + 3.0 k. Tower body x -12.8..12.8, z -6.2..3.6,
//   balconies to z 5.15, entrance porch + steps to z 6.95. Two units per floor around a central core.
//   main = true: walkable ground lobby, 8th floor landing + corridor, unit 802호 (x 2.6..12.6) with
//   the quest interactables; site.extra.elevator describes the two landings (the game builds the car).
// buildHouse({ variant = 0 }) → Site (footprint 12 x 11), exterior only, variants 0..3.
import * as THREE from 'three';
import { makeSite } from '../site.js';
import { mat, paint, textured, glow } from '../mat.js';
import { rbox, box, cyl, sphere, capsule, torus, lathe, quad, plane, prep, put, group, bake, displace } from '../geom.js';
import { canvasTex, FONT } from '../tex.js';
import { rng } from '../noise.js';
import { RB, CY, SP, tint, V, D, vcMat, vcGloss, vcSoft, cached, txt, rr, pottedPlant, mug, bookshelf, staticDoor, pendant, laptop, officeChair, Atlas } from './office.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const PI = Math.PI;
// ------------------------------------------------------------------ layout
const FH = 3.0, F0 = 0.3;
const FLR = (k) => F0 + k * FH;
const BX = 12.8, IX = 12.6, BZ0 = -6.2, IZ0 = -6.0, IZ1 = 3.4, BZ1 = 3.6, BAL = 5.15;
const CW = 2.4;               // core interior half width (core walls at |x| 2.4..2.6)
const WG = 2.65;              // inner wing walls occupy |x| 2.4..2.65 in front of the core
const ME = 7;                 // the player's floor index (8층)
const UCL = 2.5;              // unit ceiling height above the floor
const LZ = -3.73;             // elevator doorway centre z (both landings)
const LW0 = -3.85, LW1 = -3.65; // elevator front wall
const SHAFT = { x0: -1.05, x1: 1.05, z0: IZ0, z1: LW0 }; // empty pocket (car lives here)
// unit window openings for the east unit (x mirrored for the west unit); lo/hi above the floor
const FRONT_WIN = [{ key: 'liv', x0: 2.7, x1: 8.4, lo: 0, hi: 2.4, panes: 4 }, { key: 'bed', x0: 8.65, x1: 12.5, lo: 0.45, hi: 2.4, panes: 3 }];
const BACK_WIN = [{ key: 'util', x0: 3.0, x1: 4.0, lo: 1.2, hi: 2.2, panes: 1 }, { key: 'kit', x0: 6.0, x1: 7.6, lo: 1.05, hi: 2.25, panes: 2 }, { key: 'frost', x0: 10.0, x1: 11.0, lo: 1.4, hi: 2.2, panes: 1, frosted: true }];
const ACCENTS = [0x4f7391, 0xb36a46, 0x5f8a6a, 0x8e7a5a, 0x6d6a9a];

// ------------------------------------------------------------------ small helpers
function slab(parent, m, x0, y0, z0, x1, y1, z1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return put(parent, prep(g), m);
}
const box3 = (S, x0, y0, z0, x1, y1, z1) => S.colliders.push({ min: [x0, y0, z0], max: [x1, y1, z1] });
/** Pieces of a wall run [a0,a1] x [y0,y1] with rectangular holes {a, b, lo, hi} (holes must not stack). */
function pieces(a0, a1, y0, y1, holes) {
  const out = [];
  const hs = holes.filter((h) => h.b > a0 && h.a < a1).sort((p, q) => p.a - q.a);
  let cur = a0;
  for (const h of hs) {
    const ha = Math.max(h.a, a0), hb = Math.min(h.b, a1);
    if (ha > cur) out.push([cur, ha, y0, y1]);
    if (h.lo > y0) out.push([ha, hb, y0, Math.min(h.lo, y1)]);
    if (h.hi < y1) out.push([ha, hb, Math.max(h.hi, y0), y1]);
    cur = Math.max(cur, hb);
  }
  if (cur < a1) out.push([cur, a1, y0, y1]);
  return out.filter(([p0, p1, q0, q1]) => p1 - p0 > 1e-3 && q1 - q0 > 1e-3);
}
/** Wall along X (z in [z0,z1]) with holes; optional colliders. */
function wallX(p, m, a0, a1, z0, z1, y0, y1, holes = [], S = null) {
  for (const [p0, p1, q0, q1] of pieces(a0, a1, y0, y1, holes)) { slab(p, m, p0, q0, z0, p1, q1, z1); if (S) box3(S, p0, q0, z0, p1, q1, z1); }
}
/** Wall along Z (x in [x0,x1]) with holes; optional colliders. */
function wallZ(p, m, a0, a1, x0, x1, y0, y1, holes = [], S = null) {
  for (const [p0, p1, q0, q1] of pieces(a0, a1, y0, y1, holes)) { slab(p, m, x0, q0, p0, x1, q1, p1); if (S) box3(S, x0, q0, p0, x1, q1, p1); }
}
const mir = (holes, s) => (s > 0 ? holes : holes.map((h) => ({ ...h, a: -h.b, b: -h.a })));
/** Cylinder between two points. */
function rod(parent, m, a, b, r, seg = 8) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const d = B.clone().sub(A), len = d.length();
  const g = cyl(r, r, len, seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  const mid = A.add(B).multiplyScalar(0.5);
  return put(parent, g, m, mid.x, mid.y, mid.z);
}
function vrod(parent, hex, a, b, r, seg = 6, m = vcMat()) { const o = rod(parent, m, a, b, r, seg); tint(o.geometry, hex); return o; }
/** Map a quad's own 0..1 UVs into a sub-rectangle of atlas item `key`. */
function mapRect(A, geo, key, u0 = 0, u1 = 1, v0 = 0, v1 = 1) {
  const r = A.items.get(key), S = A.size, uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = u0 + uv.getX(i) * (u1 - u0), v = v0 + uv.getY(i) * (v1 - v0);
    uv.setXY(i, (r.x + u * r.w) / S, 1 - (r.y + (1 - v) * r.h) / S);
  }
  return geo;
}
/** Soft (displaced) rounded box for cushions, pillows, duvets, towels. */
// cushions and mattresses repeat in every flat and house: each shape is made once and copied
const softCache = new Map();
function softBox(w, h, d, r, puff = 0.02, wob = 0.006, seed = 1) {
  const k = [w, h, d, r, puff, wob, seed].join(',');
  if (!softCache.has(k)) softCache.set(k, softBoxGeo(w, h, d, r, puff, wob, seed));
  return softCache.get(k).clone();
}
function softBoxGeo(w, h, d, r, puff, wob, seed) {
  const sg = (v) => Math.max(2, Math.min(18, Math.round(v / 0.07)));
  const raw = new THREE.BoxGeometry(w, h, d, sg(w), sg(h), sg(d));
  const p = raw.attributes.position, iw = w / 2 - r, ih = h / 2 - r, id = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const cx = Math.max(-iw, Math.min(iw, x)), cy = Math.max(-ih, Math.min(ih, y)), cz = Math.max(-id, Math.min(id, z));
    const dx = x - cx, dy = y - cy, dz = z - cz, len = Math.hypot(dx, dy, dz) || 1;
    const k = len > r ? r / len : 1;
    p.setXYZ(i, cx + dx * k, cy + dy * k, cz + dz * k);
  }
  return displace(raw, (x, y, z) => {
    const fx = 1 - (2 * x / w) ** 2, fz = 1 - (2 * z / d) ** 2;
    const s = Math.sin(x * 23 + seed) * Math.sin(z * 19 + seed * 2) + Math.sin(x * 41 + z * 37 + seed) * 0.5;
    return puff * Math.max(0, fx) * Math.max(0, fz) * (y > 0 ? 1 : 0.3) + wob * s;
  });
}
const noShadow = (o) => { o.castShadow = false; return o; };

// ------------------------------------------------------------------ canvas helpers
function sh(col, k) {
  const n = typeof col === 'number' ? col : parseInt(col.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
const hx = (n) => '#' + n.toString(16).padStart(6, '0');
function poly(c, pts, fill) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.fillStyle = fill; c.fill(); }
/** Original 세온 mark: a roof chevron over a rising sun. */
function aptMark(c, cx, cy, r, roof, sun) {
  c.save();
  c.fillStyle = sun; c.beginPath(); c.arc(cx, cy + r * 0.2, r * 0.38, 0, PI * 2); c.fill();
  c.strokeStyle = roof; c.lineWidth = r * 0.22; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(cx - r * 0.95, cy + r * 0.1); c.lineTo(cx, cy - r * 0.72); c.lineTo(cx + r * 0.95, cy + r * 0.1); c.stroke();
  c.beginPath(); c.moveTo(cx - r * 0.7, cy + r * 0.85); c.lineTo(cx + r * 0.7, cy + r * 0.85); c.stroke();
  c.restore();
}

// ------------------------------------------------------------------ window backdrops (rooms seen from outside)
function curtainsArt(c, w, h, amt, col, R, T) {
  for (const side of [0, 1]) {
    const cw = w * amt, x0 = side ? w - cw : 0;
    c.fillStyle = col; c.fillRect(x0, T * 0.4, cw, h);
    for (let x = x0 + 4; x < x0 + cw; x += 9 + R() * 6) { c.fillStyle = 'rgba(120,100,80,0.10)'; c.fillRect(x, T * 0.4, 3, h); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(x + 4, T * 0.4, 2, h); }
  }
}
function drawRoom(kind, seed, o = {}) {
  return (c, w, h) => {
    const R = rng(seed * 101 + 7);
    const wall = o.wall ?? '#efe6d6', floor = o.floor ?? '#b48858';
    const L = w * 0.14, Rt = w * 0.86, T = h * 0.13, B = h * 0.77;
    poly(c, [[0, 0], [w, 0], [Rt, T], [L, T]], sh(wall, 1.05));
    poly(c, [[0, 0], [L, T], [L, B], [0, h]], sh(wall, 0.84));
    poly(c, [[w, 0], [Rt, T], [Rt, B], [w, h]], sh(wall, 0.9));
    c.fillStyle = wall; c.fillRect(L, T, Rt - L, B - T);
    poly(c, [[L, B], [Rt, B], [w, h], [0, h]], floor);
    c.strokeStyle = 'rgba(60,35,20,0.16)'; c.lineWidth = 1;
    for (let i = 0; i <= 10; i++) { const x = L + (Rt - L) * i / 10; c.beginPath(); c.moveTo(x, B); c.lineTo(w / 2 + (x - w / 2) * (w / (Rt - L)), h); c.stroke(); }
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(L, B - 3, Rt - L, 3); // baseboard shadow
    if (kind === 'liv') {
      // rug
      poly(c, [[w * 0.3, B + h * 0.06], [w * 0.7, B + h * 0.06], [w * 0.82, h * 0.97], [w * 0.18, h * 0.97]], o.rug ?? '#c9b79a');
      // sofa
      const sx = w * (0.3 + R() * 0.08), sw = w * 0.36, sy = B - h * 0.2, scol = o.sofa ?? '#8b9196';
      rr(c, sx, sy, sw, h * 0.13, 6, sh(scol, 0.9)); rr(c, sx - 6, sy + h * 0.06, sw + 12, h * 0.15, 6, scol);
      rr(c, sx - 10, sy + h * 0.03, 14, h * 0.17, 5, sh(scol, 0.8)); rr(c, sx + sw - 4, sy + h * 0.03, 14, h * 0.17, 5, sh(scol, 0.8));
      for (let i = 0; i < 2; i++) rr(c, sx + sw * (0.12 + i * 0.55), sy + h * 0.02, sw * 0.18, h * 0.08, 5, ['#e0b25a', '#f2efe8', '#5f8a6a'][(seed + i) % 3]);
      // picture above the sofa
      c.fillStyle = '#3a3330'; c.fillRect(sx + sw * 0.3, T + h * 0.1, sw * 0.4, h * 0.2);
      c.fillStyle = ['#9fc3d8', '#e8c39a', '#b7cfa8'][seed % 3]; c.fillRect(sx + sw * 0.3 + 4, T + h * 0.1 + 4, sw * 0.4 - 8, h * 0.2 - 8);
      // floor lamp with glow
      const lx = sx + sw + w * 0.07;
      c.fillStyle = '#2b2b2b'; c.fillRect(lx, B - h * 0.45, 3, h * 0.45);
      const g2 = c.createRadialGradient(lx, B - h * 0.47, 2, lx, B - h * 0.47, h * 0.35); g2.addColorStop(0, 'rgba(255,214,150,0.85)'); g2.addColorStop(1, 'rgba(255,214,150,0)');
      c.fillStyle = g2; c.fillRect(lx - h * 0.4, B - h * 0.85, h * 0.8, h * 0.8);
      poly(c, [[lx - 12, B - h * 0.43], [lx + 15, B - h * 0.43], [lx + 10, B - h * 0.55], [lx - 7, B - h * 0.55]], '#f5ead2');
      // plant on the left
      const px = L + w * 0.05;
      c.fillStyle = '#e9e4da'; c.fillRect(px - 10, B - h * 0.1, 20, h * 0.1);
      for (let i = 0; i < 14; i++) { c.fillStyle = ['#3c6a2e', '#4a7a33', '#5a8a3a'][i % 3]; c.beginPath(); c.ellipse(px + (R() - 0.5) * 34, B - h * (0.14 + R() * 0.3), 9, 5, R() * 3, 0, PI * 2); c.fill(); }
      // TV on the left side wall
      poly(c, [[L * 0.25, T + h * 0.2], [L * 0.85, T + h * 0.26], [L * 0.85, T + h * 0.46], [L * 0.25, T + h * 0.5]], '#15171b');
      if (o.tvOn) poly(c, [[L * 0.28, T + h * 0.215], [L * 0.82, T + h * 0.27], [L * 0.82, T + h * 0.45], [L * 0.28, T + h * 0.48]], '#4f8fc4');
    } else if (kind === 'bed') {
      const bx = w * (0.3 + R() * 0.1), bw = w * 0.38, by = B - h * 0.22, duv = o.duvet ?? '#9db4c8';
      rr(c, bx, by - h * 0.12, bw, h * 0.2, 6, o.head ?? '#8a6a4e');
      poly(c, [[bx, by + h * 0.05], [bx + bw, by + h * 0.05], [bx + bw + w * 0.08, h * 0.98], [bx - w * 0.08, h * 0.98]], duv);
      poly(c, [[bx, by + h * 0.05], [bx + bw, by + h * 0.05], [bx + bw + w * 0.02, by + h * 0.12], [bx - w * 0.02, by + h * 0.12]], sh(duv, 1.12));
      rr(c, bx + bw * 0.08, by - h * 0.02, bw * 0.36, h * 0.08, 6, '#f6f2ea'); rr(c, bx + bw * 0.56, by - h * 0.02, bw * 0.36, h * 0.08, 6, '#f6f2ea');
      // nightstand + lamp glow
      const nx = bx - w * 0.1;
      c.fillStyle = '#a78560'; c.fillRect(nx, B - h * 0.13, w * 0.07, h * 0.13);
      const g2 = c.createRadialGradient(nx + w * 0.035, B - h * 0.2, 2, nx + w * 0.035, B - h * 0.2, h * 0.3); g2.addColorStop(0, 'rgba(255,210,140,0.9)'); g2.addColorStop(1, 'rgba(255,210,140,0)');
      c.fillStyle = g2; c.fillRect(nx - h * 0.3, B - h * 0.5, h * 0.7, h * 0.6);
      poly(c, [[nx + 4, B - h * 0.16], [nx + w * 0.07 - 4, B - h * 0.16], [nx + w * 0.06 - 4, B - h * 0.24], [nx + 8, B - h * 0.24]], '#f5ead2');
      // wardrobe on the right side wall
      poly(c, [[Rt, T + h * 0.05], [w * 0.97, T * 0.25], [w * 0.97, h * 0.95], [Rt, B]], o.ward ?? '#e9e3d8');
      c.strokeStyle = 'rgba(0,0,0,0.15)'; c.lineWidth = 2; for (const t of [0.35, 0.68]) { const x = Rt + (w * 0.97 - Rt) * t; c.beginPath(); c.moveTo(x, T + h * 0.05 - (T + h * 0.05 - T * 0.25) * t); c.lineTo(x, B + (h * 0.95 - B) * t); c.stroke(); }
      // poster
      c.fillStyle = '#f6f2ea'; c.fillRect(bx + bw + w * 0.05, T + h * 0.12, w * 0.08, h * 0.22);
      c.fillStyle = ['#e07a5f', '#3d6aa8', '#81b29a'][seed % 3]; c.fillRect(bx + bw + w * 0.055, T + h * 0.13, w * 0.07, h * 0.12);
    } else if (kind === 'kit') {
      c.fillStyle = '#f4f2ec'; c.fillRect(L, T, Rt - L, h * 0.2);
      c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 2; for (let i = 1; i < 5; i++) { const x = L + (Rt - L) * i / 5; c.beginPath(); c.moveTo(x, T); c.lineTo(x, T + h * 0.2); c.stroke(); }
      c.fillStyle = '#dfe9ec'; c.fillRect(L, T + h * 0.2, Rt - L, h * 0.2);
      c.fillStyle = '#c8c4bd'; c.fillRect(L, T + h * 0.4, Rt - L, 6);
      c.fillStyle = '#f2efe8'; c.fillRect(L, T + h * 0.4 + 6, Rt - L, B - T - h * 0.4 - 6);
      c.fillStyle = '#9aa0a6'; poly(c, [[w * 0.45, T + h * 0.02], [w * 0.6, T + h * 0.02], [w * 0.64, T + h * 0.18], [w * 0.41, T + h * 0.18]], '#a7adb3');
      c.fillStyle = '#c0c4c8'; c.fillRect(Rt - w * 0.12, T + h * 0.02, w * 0.11, B - T - h * 0.02);
      const g2 = c.createRadialGradient(w * 0.5, T, 2, w * 0.5, T, h * 0.6); g2.addColorStop(0, 'rgba(255,240,215,0.5)'); g2.addColorStop(1, 'rgba(255,240,215,0)'); c.fillStyle = g2; c.fillRect(0, 0, w, h);
    } else if (kind === 'util') {
      c.fillStyle = '#e6e2da'; c.fillRect(L, T, Rt - L, B - T);
      for (let i = 0; i < 3; i++) { c.fillStyle = '#b9a68c'; c.fillRect(L, T + h * (0.12 + i * 0.16), (Rt - L) * 0.5, 4); for (let k = 0; k < 4; k++) { c.fillStyle = ['#d9c7a8', '#8fb0c8', '#e0b25a', '#f2efe8'][(i + k) % 4]; c.fillRect(L + 4 + k * 12, T + h * (0.12 + i * 0.16) - 12, 10, 12); } }
      c.fillStyle = '#f4f4f2'; c.fillRect(w * 0.55, B - h * 0.38, w * 0.28, h * 0.38);
      c.strokeStyle = '#8f969c'; c.lineWidth = 4; c.beginPath(); c.arc(w * 0.69, B - h * 0.2, h * 0.11, 0, PI * 2); c.stroke();
    } else if (kind === 'stair') {
      c.fillStyle = '#d9d6cf'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#c5c1b8'; for (let i = 0; i < 9; i++) c.fillRect(w * 0.1 + i * w * 0.09, h * 0.85 - i * h * 0.08, w * 0.12, h * 0.15 + i * h * 0.08);
      c.strokeStyle = '#6b6f75'; c.lineWidth = 4; c.beginPath(); c.moveTo(w * 0.08, h * 0.62); c.lineTo(w * 0.95, h * 0.0); c.stroke();
      rr(c, w * 0.62, h * 0.12, w * 0.26, h * 0.08, 3, '#2f9e5b'); c.fillStyle = '#ffffff'; c.fillRect(w * 0.66, h * 0.145, w * 0.07, h * 0.03);
      const g2 = c.createRadialGradient(w * 0.5, h * 0.06, 2, w * 0.5, h * 0.06, h * 0.7); g2.addColorStop(0, 'rgba(255,248,230,0.7)'); g2.addColorStop(1, 'rgba(255,248,230,0)'); c.fillStyle = g2; c.fillRect(0, 0, w, h);
    } else if (kind === 'lobby') {
      poly(c, [[L, B], [Rt, B], [w, h], [0, h]], '#d8d2c6');
      c.fillStyle = '#c7b9a2'; c.fillRect(L, T, Rt - L, B - T);
      c.fillStyle = '#9ea4aa'; c.fillRect(w * 0.42, T + h * 0.12, w * 0.16, B - T - h * 0.12);
      c.fillStyle = '#5a5f66'; c.fillRect(w * 0.497, T + h * 0.12, 3, B - T - h * 0.12);
      c.fillStyle = '#ff9a3c'; c.fillRect(w * 0.48, T + h * 0.04, w * 0.04, h * 0.05);
      poly(c, [[L * 0.2, T + h * 0.15], [L * 0.9, T + h * 0.2], [L * 0.9, T + h * 0.5], [L * 0.2, T + h * 0.56]], '#b9bec4');
      c.fillStyle = '#4a7a33'; c.beginPath(); c.ellipse(Rt - w * 0.05, B - h * 0.25, 22, 40, 0, 0, PI * 2); c.fill();
      for (const x of [0.3, 0.5, 0.7]) { const g2 = c.createRadialGradient(w * x, T, 1, w * x, T, h * 0.35); g2.addColorStop(0, 'rgba(255,236,200,0.8)'); g2.addColorStop(1, 'rgba(255,236,200,0)'); c.fillStyle = g2; c.fillRect(0, 0, w, h); }
    }
    if (kind !== 'stair' && kind !== 'lobby') {
      const cx = w * (0.42 + R() * 0.16);
      const gl = c.createRadialGradient(cx, T * 0.5, 1, cx, T * 0.5, w * 0.45); gl.addColorStop(0, 'rgba(255,238,205,0.45)'); gl.addColorStop(1, 'rgba(255,238,205,0)');
      c.fillStyle = gl; c.fillRect(0, 0, w, h);
      c.fillStyle = '#fffaf0'; c.beginPath(); c.ellipse(cx, T * 0.55, w * 0.05, h * 0.018, 0, 0, PI * 2); c.fill();
    }
    if (o.cur) curtainsArt(c, w, h, o.cur, o.curCol ?? 'rgba(250,247,240,0.86)', R, T);
    if (o.blind) { c.fillStyle = 'rgba(236,228,212,0.95)'; c.fillRect(0, 0, w, h * o.blind); c.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = 6; y < h * o.blind; y += 8) c.fillRect(0, y, w, 2); }
    const vg = c.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(25,15,5,0.4)');
    c.fillStyle = vg; c.fillRect(0, 0, w, h);
  };
}
function backdrops() {
  return cached('aptBackdrops', () => {
    const A = new Atlas(1024, 4);
    A.add('liv0', 480, 196, drawRoom('liv', 1, { wall: '#efe6d6', sofa: '#8b9196', cur: 0.1 }));
    A.add('liv1', 480, 196, drawRoom('liv', 2, { wall: '#e4ead9', sofa: '#c4a27a', floor: '#c49a6a', cur: 0.2, curCol: 'rgba(214,196,168,0.92)', tvOn: true }));
    A.add('liv2', 480, 196, drawRoom('liv', 3, { wall: '#f2ece4', sofa: '#5f7a8c', floor: '#9c7451', cur: 0.32, rug: '#b8a48a' }));
    A.add('bed0', 448, 224, drawRoom('bed', 4, { wall: '#e6ecef', duvet: '#9db4c8', cur: 0.14 }));
    A.add('bed1', 448, 224, drawRoom('bed', 5, { wall: '#f1e7da', duvet: '#e3c08f', head: '#6b4a33', blind: 0.42 }));
    A.add('lobby', 448, 256, drawRoom('lobby', 6, {}));
    A.add('kit', 240, 180, drawRoom('kit', 7, { wall: '#efece6' }));
    A.add('stair', 160, 224, drawRoom('stair', 8, {}));
    A.add('util', 128, 128, drawRoom('util', 9, { wall: '#e6e2da' }));
    A.build();
    A.day = new THREE.MeshStandardMaterial({ map: A.tex, roughness: 0.92, color: 0xa6a29c }); A.day.name = 'aptBackdropDay';
    A.dark = new THREE.MeshStandardMaterial({ map: A.tex, roughness: 0.92, color: 0x726f6a }); A.dark.name = 'aptBackdropDark';
    A.lit = new THREE.MeshStandardMaterial({ map: A.tex, color: 0x8d8984, emissive: 0xffffff, emissiveMap: A.tex, emissiveIntensity: 0.85, roughness: 0.9 });
    A.lit.name = 'aptBackdropLit'; A.lit.userData.glowMax = 0.85;
    return A;
  });
}

// ------------------------------------------------------------------ signs (one small atlas per dong)
function signAtlas(dong, accent) {
  return cached('aptSign' + dong + accent, () => {
    const A = new Atlas(1024, 6);
    const num = String(dong).replace(/[^0-9]/g, '') || '101';
    const acc = hx(accent);
    A.add('side', 1000, 640, (c, w, h) => {
      aptMark(c, 140, 120, 92, acc, '#f2a65a');
      txt(c, '세온 아파트', 270, 168, 140, acc);
      txt(c, num, w / 2 - 40, 590, 400, sh(accent, 0.7), 'center');
      txt(c, '동', w / 2 + 330, 588, 170, sh(accent, 0.7), 'center');
    });
    A.add('crown', 1000, 220, (c, w, h) => {
      aptMark(c, 120, 110, 80, '#ffffff', '#ffc56b');
      txt(c, '세온 아파트', 230, 152, 118, '#ffffff');
      txt(c, num + '동', w - 30, 150, 96, '#ffe2a8', 'right');
    });
    A.add('canopy', 760, 120, (c, w, h) => {
      c.fillStyle = '#2d3238'; c.fillRect(0, 0, w, h);
      aptMark(c, 64, 58, 40, '#ffffff', '#ffc56b');
      txt(c, '세온 아파트', 128, 80, 54, '#ffffff');
      txt(c, num + '동', w - 26, 84, 66, '#ffd68a', 'right');
    });
    A.build();
    const side = new THREE.MeshStandardMaterial({ map: A.tex, roughness: 0.7, alphaTest: 0.5, emissive: 0xffffff, emissiveMap: A.tex, emissiveIntensity: 0.35 });
    side.name = 'aptSignSide'; side.userData.glowMax = 0.35;
    const lit = new THREE.MeshStandardMaterial({ map: A.tex, color: 0x404040, roughness: 0.5, alphaTest: 0.5, emissive: 0xffffff, emissiveMap: A.tex, emissiveIntensity: 1.6 });
    lit.name = 'aptSignLit'; lit.userData.glowMax = 1.6;
    A.side = side; A.litM = lit;
    return A;
  });
}

// ------------------------------------------------------------------ materials
function aptMats(accent) {
  return cached('aptMats' + accent, () => {
    const winGlass = new THREE.MeshPhysicalMaterial({ color: 0xa8c3cc, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.34, envMapIntensity: 2.2, depthWrite: false, side: THREE.DoubleSide });
    winGlass.name = 'aptWinGlass';
    const railGlass = new THREE.MeshPhysicalMaterial({ color: 0xc6e2df, metalness: 0, roughness: 0.06, transparent: true, opacity: 0.26, envMapIntensity: 1.8, depthWrite: false, side: THREE.DoubleSide });
    railGlass.name = 'aptRailGlass';
    const frost = new THREE.MeshStandardMaterial({ color: 0xe4ecee, roughness: 0.3, transparent: true, opacity: 0.88, emissive: 0xfff0d8, emissiveIntensity: 0.4 });
    frost.name = 'aptFrost'; frost.userData.glowMax = 0.4;
    const down = glow(0xffe2b0, 2.4); down.name = 'aptDownGlow'; down.userData.glowMax = 2.4;
    return {
      wall: mat('plaster'), wall2: mat('plasterGray'), conc: mat('concrete'), stone: mat('stone'),
      accent: paint(accent, 0.72), accentDk: paint(new THREE.Color(accent).multiplyScalar(0.62).getHex(), 0.6),
      frame: paint(0x3b4047, 0.4, 0.55), alu: paint(0xc8ccd0, 0.32, 0.8), white: paint(0xf1efea, 0.5),
      winGlass, railGlass, frost, down,
      leaves: mat('leaves'), dirt: mat('dirt'), pavers: mat('pavers2'), oak: mat('oak'),
    };
  });
}

// ------------------------------------------------------------------ facade pieces
/** Shallow room box behind a window (local frame: window plane z = zf, room towards -Z). */
function tray(g, B, key, m, w, y0, y1, zf, dep) {
  const W = w + 0.06, ym = (y0 + y1) / 2, hh = y1 - y0 + 0.06, zb = zf - dep;
  D(g, mapRect(B, quad(W, hh), key), m, 0, ym, zb);
  D(g, mapRect(B, quad(dep, hh), key, 0, 0.05), m, -W / 2, ym, zb + dep / 2, 0, PI / 2, 0);
  D(g, mapRect(B, quad(dep, hh), key, 0.95, 1), m, W / 2, ym, zb + dep / 2, 0, -PI / 2, 0);
  D(g, mapRect(B, quad(W, dep), key, 0, 1, 0, 0.04), m, 0, y0 - 0.03, zb + dep / 2, -PI / 2, 0, 0);
  D(g, mapRect(B, quad(W, dep), key, 0, 1, 0.96, 1), m, 0, y1 + 0.03, zb + dep / 2, PI / 2, 0, 0);
}
/**
 * Window in an exterior wall: (cx, z) = centre of the opening on the outer face, ry turns local +Z to the
 * outside. o.cell = backdrop key (null = real room behind), o.m = backdrop material.
 */
function facadeWindow(root, M, B, cx, z, ry, w, y0, y1, o = {}) {
  const { cell = null, m = null, frosted = false, panes = 2, T = 0.2, dep = 0.5, fine = false } = o;
  const g = group(root, cx, 0, z, ry);
  const fw = 0.06, fz = -0.07, h = y1 - y0, ym = (y0 + y1) / 2;
  const bx = fine ? (a, b, c) => RB(a, b, c, 0.008, 1) : box;
  put(g, bx(w, fw, 0.08), M.frame, 0, y1 - fw / 2, fz);
  put(g, bx(w, fw, 0.08), M.frame, 0, y0 + fw / 2, fz);
  put(g, bx(fw, h - 2 * fw, 0.08), M.frame, -w / 2 + fw / 2, ym, fz);
  put(g, bx(fw, h - 2 * fw, 0.08), M.frame, w / 2 - fw / 2, ym, fz);
  for (let i = 1; i < panes; i++) put(g, bx(0.05, h - 2 * fw, 0.07), M.frame, -w / 2 + (w * i) / panes, ym, fz + (i % 2 ? 0.014 : -0.014));
  D(g, quad(w - fw, h - fw), frosted ? M.frost : M.winGlass, 0, ym, fz - 0.004);
  if (y0 > F0 + 0.01 && (y0 - F0) % FH > 0.2) put(g, RB(w + 0.08, 0.04, 0.1, 0.01, 1), M.alu, 0, y0 - 0.02, 0.035);
  if (cell && !frosted) tray(g, B, cell, m, w - 0.02, y0, y1, -T, dep);
  return g;
}

// ------------------------------------------------------------------ balcony life
function acUnit(p, x, y, z, ry) {
  const g = group(p, x, y, z, ry);
  V(g, RB(0.82, 0.6, 0.3, 0.025, 1), 0xebe9e4, 0, 0.32, 0);
  V(g, CY(0.21, 0.21, 0.012, 20), 0x3a3d42, -0.12, 0.33, 0.151, PI / 2, 0, 0);
  V(g, torus(0.2, 0.012, 4, 20), 0xd6d4cf, -0.12, 0.33, 0.158);
  for (let i = 0; i < 4; i++) V(g, box(0.4, 0.008, 0.01), 0xd6d4cf, -0.12, 0.2 + i * 0.085, 0.162);
  V(g, box(0.16, 0.36, 0.01), 0xd8d5cf, 0.27, 0.32, 0.152);
  V(g, box(0.06, 0.02, 0.26), 0x55595e, -0.3, 0.01, 0); V(g, box(0.06, 0.02, 0.26), 0x55595e, 0.3, 0.01, 0);
  return g;
}
function dryingRack(p, x, y, z, ry, R) {
  const g = group(p, x, y, z, ry);
  for (const s of [-0.55, 0.55]) { vrod(g, 0xdcdcdc, [s, 0, -0.32], [s, 1.0, 0.0], 0.012); vrod(g, 0xdcdcdc, [s, 0, 0.32], [s, 1.0, 0.0], 0.012); }
  for (const zz of [-0.12, 0.0, 0.12]) vrod(g, 0xe8e8e8, [-0.58, 0.96 - Math.abs(zz) * 1.2, zz], [0.58, 0.96 - Math.abs(zz) * 1.2, zz], 0.008, 5);
  const cols = [0xf2efe8, 0x8fb0c8, 0xe8b4b8, 0xf2c14e, 0x5f7f9a, 0xffffff, 0x9bc49a];
  let cx = -0.45;
  while (cx < 0.42) {
    const cw = 0.14 + R() * 0.2, ch = 0.25 + R() * 0.35, zz = [-0.12, 0, 0.12][(R() * 3) | 0];
    V(g, box(cw, ch, 0.012), cols[(R() * cols.length) | 0], cx + cw / 2, 0.96 - Math.abs(zz) * 1.2 - ch / 2, zz, 0, 0, (R() - 0.5) * 0.05, vcSoft());
    cx += cw + 0.04;
  }
  return g;
}
function patioSet(p, x, y, z, R) {
  const g = group(p, x, y, z, 0);
  V(g, CY(0.28, 0.28, 0.025, 20), 0xf2efe8, 0, 0.68, 0);
  vrod(g, 0x3b4047, [0, 0.02, 0], [0, 0.67, 0], 0.02);
  V(g, CY(0.18, 0.2, 0.02, 16), 0x3b4047, 0, 0.01, 0);
  V(g, CY(0.04, 0.04, 0.08, 10), 0xc4553e, 0.08, 0.73, 0.05, 0, 0, 0, vcGloss());
  for (const s of [-1, 1]) {
    const c = group(g, s * 0.5, 0, 0.05, s * 0.5 + (R() - 0.5) * 0.4);
    V(c, RB(0.42, 0.04, 0.4, 0.012, 1), 0x8a6a4e, 0, 0.44, 0);
    V(c, RB(0.42, 0.34, 0.03, 0.012, 1), 0x8a6a4e, 0, 0.68, -0.19, -0.1, 0, 0);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) vrod(c, 0x3b4047, [a * 0.18, 0, b * 0.17], [a * 0.18, 0.43, b * 0.17], 0.012, 5);
  }
  return g;
}
function boxes(p, x, y, z, R) {
  const g = group(p, x, y, z, (R() - 0.5) * 0.3);
  let yy = 0;
  for (let i = 0; i < 2 + ((R() * 2) | 0); i++) { const w = 0.4 + R() * 0.2, hh = 0.22 + R() * 0.15; V(g, RB(w, hh, 0.35, 0.01, 1), [0xc9a77a, 0xd8be94, 0x6f8fa8, 0xe9e4da][(R() * 4) | 0], (R() - 0.5) * 0.06, yy + hh / 2, 0, 0, (R() - 0.5) * 0.2, 0); yy += hh; }
  return g;
}
/** Things people keep on a balcony (s = side, F = floor slab top). */
function balconyLife(root, R, s, F, rich = false) {
  const y = F - 0.05, zr = 4.72;
  acUnit(root, s * 11.95, y, 4.45, 0);
  const n = rich ? 3 : (R() < 0.75 ? 1 + ((R() * 2) | 0) : 0);
  const kinds = ['bush', 'snake', 'palm', 'fig'];
  for (let i = 0; i < n; i++) {
    const x = s * (3.2 + R() * 2.2 + i * 1.3);
    const kind = kinds[(R() * 4) | 0];
    pottedPlant(root, x, y, zr, { kind, h: kind === 'fig' ? 1.1 : 0.5 + R() * 0.4, potR: kind === 'fig' ? 0.17 : 0.12, potH: kind === 'fig' ? 0.32 : 0.22, pot: ['white', 'terracotta', 'charcoal', 0xd9cdb8][(R() * 4) | 0], seed: (R() * 999) | 0 });
  }
  const r = R();
  if (rich || r < 0.45) dryingRack(root, s * (7.4 + R() * 1.4), y, 4.25, (R() - 0.5) * 0.2, R);
  if (rich || (r > 0.45 && r < 0.75)) patioSet(root, s * (9.9 - R() * 0.5), y, 4.2, R);
  if (!rich && R() < 0.3) boxes(root, s * 11.15, y, 3.9, R);
}

// ------------------------------------------------------------------ the tower
function buildTower(S, root, o) {
  const { main, floors, seed, accent, dong } = o;
  const M = aptMats(accent), B = backdrops(), SA = signAtlas(dong, accent);
  const R = rng(seed * 977 + 31);
  const TOP = floors * FH;           // underside of the roof slab
  const lit = () => (R() < 0.5 ? B.lit : R() < 0.5 ? B.day : B.dark);
  const livKeys = ['liv0', 'liv1', 'liv2'], bedKeys = ['bed0', 'bed1'];
  // ---- front: per unit and floor, wall strip with holes, windows, balcony
  for (const s of [-1, 1]) {
    for (let k = 0; k < floors; k++) {
      const F = FLR(k), real = main && k === ME && s > 0;
      const holes = mir(FRONT_WIN.map((h) => ({ a: h.x0, b: h.x1, lo: F + h.lo, hi: F + h.hi })), s);
      wallX(root, M.wall, s > 0 ? WG : -IX - 0.05 + 0.0, s > 0 ? IX + 0.05 - 0.0 : -WG, IZ1, BZ1, F - 0.3, F + 2.7, holes);
      for (const h of FRONT_WIN) {
        const w = h.x1 - h.x0, cx = s * (h.x0 + h.x1) / 2;
        const key = h.key === 'liv' ? livKeys[(R() * 3) | 0] : bedKeys[(R() * 2) | 0];
        facadeWindow(root, M, B, cx, BZ1, 0, w, F + h.lo, F + h.hi, { panes: h.panes, cell: real ? null : key, m: lit(), fine: real, dep: h.key === 'liv' ? 0.7 : 0.55 });
      }
      // balcony slab, edge band, glass rail, handrail, posts
      const x0 = s > 0 ? WG : -IX + 0.05, x1 = s > 0 ? IX - 0.05 : -WG, bw = x1 - x0, bx = (x0 + x1) / 2;
      slab(root, M.wall2, x0, F - 0.25, BZ1, x1, F - 0.05, 4.98);
      put(root, RB(bw, 0.42, 0.18, 0.02, 1), M.wall, bx, F - 0.09, 5.06);
      D(root, box(bw - 0.04, 0.96, 0.014), M.railGlass, bx, F + 0.12 + 0.48, 5.03);
      put(root, RB(bw, 0.045, 0.075, 0.015, 1), M.frame, bx, F + 1.1, 5.03);
      for (let i = 0; i <= 6; i++) put(root, box(0.035, 0.98, 0.045), M.frame, x0 + 0.05 + (bw - 0.1) * i / 6, F + 0.61, 5.03);
      balconyLife(root, R, s, F, real);
    }
  }
  // wing walls: inner pair in the accent colour (frames the core recess), outer pair white
  for (const s of [-1, 1]) {
    put(root, RB(0.25, TOP + 0.6, BAL - IZ1, 0.03, 1), M.accent, s * (CW + 0.125), (TOP + 0.6) / 2, (IZ1 + BAL) / 2);
    put(root, RB(0.25, TOP + 0.4, BAL - IZ1, 0.03, 1), M.wall, s * (BX - 0.125), (TOP + 0.4) / 2, (IZ1 + BAL) / 2);
  }
  // ---- core front (stairwell windows above, entrance at the ground)
  for (let k = 1; k < floors; k++) {
    const F = FLR(k);
    wallX(root, M.accentDk, -CW, CW, IZ1, BZ1, F - 0.3, F + 2.7, [{ a: -0.7, b: 0.7, lo: F + 1.0, hi: F + 2.45 }]);
    const open = !main && k === nbK(floors);     // neighbour towers: the real corridor is behind this window
    facadeWindow(root, M, B, 0, BZ1, 0, 1.4, F + 1.0, F + 2.45, { panes: 2, cell: open ? null : 'stair', m: B.lit, dep: 0.4 });
  }
  // ---- back: full-width strips per floor with both units' windows
  for (let k = 0; k < floors; k++) {
    const F = FLR(k);
    const holes = [];
    for (const s of [-1, 1]) holes.push(...mir(BACK_WIN.map((h) => ({ a: h.x0, b: h.x1, lo: F + h.lo, hi: F + h.hi })), s));
    wallX(root, M.wall, -BX, BX, BZ0, IZ0, F - 0.3, F + 2.7, holes);
    for (const s of [-1, 1]) for (const h of BACK_WIN) {
      const real = main && k === ME && s > 0 && h.key !== 'util';
      facadeWindow(root, M, B, s * (h.x0 + h.x1) / 2, BZ0, PI, h.x1 - h.x0, F + h.lo, F + h.hi, { panes: h.panes, frosted: h.frosted, cell: real ? null : h.key, m: lit(), fine: real, dep: 0.45 });
    }
    // floor line on the back face
    put(root, box(2 * BX + 0.02, 0.06, 0.03), M.wall2, 0, F - 0.3, BZ0 - 0.012);
  }
  // back core accent stripe (lift shaft)
  slab(root, M.accent, -1.6, 0.4, BZ0 - 0.03, 1.6, TOP, BZ0);
  // ---- sides: solid walls, floor grooves, accent stripes, the big painted brand
  for (const s of [-1, 1]) {
    slab(root, M.wall, s > 0 ? IX : -BX, 0, BZ0, s > 0 ? BX : -IX, TOP, IZ1);
    const fx = s * (BX + 0.012);
    for (let k = 1; k < floors; k++) D(root, box(0.03, 0.05, IZ1 - BZ0 + BAL - IZ1), M.wall2, fx, FLR(k) - 0.3, (BZ0 + BAL) / 2);
    slab(root, M.accent, s > 0 ? BX : -BX - 0.025, 0.4, -4.6, s > 0 ? BX + 0.025 : -BX, TOP - 10.2, -3.9);
    slab(root, M.accent, s > 0 ? BX : -BX - 0.025, 0.4, -3.6, s > 0 ? BX + 0.025 : -BX, TOP - 10.2, -3.35);
    const sg = SA.quad('side', 10.4, 6.66);
    D(root, sg, SA.side, s * (BX + 0.03), TOP - 4.6, (BZ0 + BAL) / 2 - 0.15, 0, s * PI / 2, 0);
  }
  // ---- roof: slab, parapets with caps, crown frame + lit sign over the core, machine room, tanks, solar
  slab(root, M.wall, -BX, TOP, BZ0, BX, TOP + 0.3, BAL);
  const PH = 1.1;
  for (const [x0, z0, x1, z1] of [[-BX, BAL - 0.2, BX, BAL], [-BX, BZ0, BX, BZ0 + 0.2], [-BX, BZ0, -BX + 0.2, BAL], [BX - 0.2, BZ0, BX, BAL]]) {
    slab(root, M.wall, x0, TOP + 0.3, z0, x1, TOP + 0.3 + PH, z1);
    put(root, RB(x1 - x0 + 0.06, 0.06, z1 - z0 + 0.06, 0.015, 1), M.alu, (x0 + x1) / 2, TOP + 0.33 + PH, (z0 + z1) / 2);
  }
  put(root, RB(2 * BX + 0.04, 0.12, 0.06, 0.02, 1), M.accent, 0, TOP - 0.15, BAL + 0.02);
  // crown: the accent wing walls continue up and carry a lit sign
  const CH = 4.2;
  put(root, RB(2 * WG + 0.2, 0.5, 1.9, 0.04, 2), M.accent, 0, TOP + CH, (IZ1 + BAL) / 2);
  D(root, SA.quad('crown', 4.6, 1.01), SA.litM, 0, TOP + 2.65, BAL - 0.02);
  slab(root, M.accentDk, -CW, TOP + 0.3, IZ1, CW, TOP + CH - 0.25, IZ1 + 0.2);
  put(root, RB(4.9, 1.3, 0.12, 0.02, 1), M.frame, 0, TOP + 2.65, BAL - 0.1);
  S.nightGlow.push(SA.litM, SA.side);
  // machine room over the lift
  slab(root, M.wall, -CW, TOP + 0.3, -5.6, CW, TOP + 3.4, -0.4);
  put(root, RB(2 * CW + 0.2, 0.12, 5.4, 0.02, 1), M.alu, 0, TOP + 3.46, -3.0);
  for (let i = 0; i < 6; i++) put(root, box(1.2, 0.03, 0.05), M.frame, 1.1, TOP + 1.4 + i * 0.16, -0.38);
  staticDoor(root, -1.0, TOP + 0.3, -0.39, 0, { w: 0.9, h: 2.0, leaf: paint(0x8a9096, 0.45, 0.5), frame: M.frame });
  // water tanks, solar panels, vents, antenna
  for (const tx of [-8.5, -6.4]) { put(root, CY(0.9, 0.9, 1.9, 24), M.white, tx, TOP + 1.3, -3.6); put(root, CY(0.95, 0.95, 0.08, 24), M.frame, tx, TOP + 2.28, -3.6); put(root, box(1.9, 0.35, 1.9), M.conc, tx, TOP + 0.47, -3.6); }
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    const pg = group(root, 5.2 + i * 1.75, TOP + 0.95, -3.9 + j * 2.2, 0);
    pg.rotation.x = -0.45;
    put(pg, RB(1.65, 0.05, 1.0, 0.01, 1), M.alu, 0, 0, 0);
    put(pg, box(1.58, 0.012, 0.94), paint(0x22324a, 0.18, 0.6), 0, 0.03, 0);
    put(root, box(0.05, 0.6, 0.05), M.frame, 5.2 + i * 1.75, TOP + 0.6, -3.9 + j * 2.2 - 0.3);
  }
  for (const [vx, vz] of [[-9.8, 1.2], [-4.2, 2.6], [9.6, 2.4], [3.6, 1.0]]) { put(root, CY(0.18, 0.18, 0.6, 12), M.alu, vx, TOP + 0.6, vz); put(root, CY(0.26, 0.26, 0.05, 12), M.frame, vx, TOP + 0.92, vz); }
  put(root, CY(0.04, 0.05, 5.5, 8), M.alu, 1.8, TOP + 3.4 + 2.75, -4.8);
  // ---- ground: plinth band, entrance porch, canopy, steps, planters
  slab(root, M.stone, -BX - 0.03, 0, BZ0 - 0.03, BX + 0.03, 0.45, BZ0 + 0.02);
  for (const s of [-1, 1]) slab(root, M.stone, s > 0 ? BX - 0.02 : -BX - 0.03, 0, BZ0, s > 0 ? BX + 0.03 : -BX + 0.02, 0.45, BAL);
  // porch
  slab(root, M.pavers, -CW, 0, BZ1, CW, F0, 6.6);
  put(root, RB(2 * CW, 0.15, 0.36, 0.02, 1), M.stone, 0, 0.075, 6.78);
  put(root, RB(2 * CW + 0.04, 0.05, 0.08, 0.01, 1), M.stone, 0, F0 - 0.02, 6.58);
  box3(S, -CW, 0, BZ1, CW, F0, 6.6);
  box3(S, -CW, 0, 6.6, CW, 0.15, 6.96);
  // canopy with wood soffit, downlights and the lit name board
  const cy0 = 3.05;
  put(root, RB(2 * CW + 0.6, 0.22, 3.25, 0.03, 2), M.frame, 0, cy0 + 0.11, (BZ1 + 6.85) / 2);
  slab(root, M.oak, -CW - 0.25, cy0 - 0.02, BZ1 + 0.05, CW + 0.25, cy0, 6.8);
  for (const [dx, dz] of [[-1.3, 4.6], [1.3, 4.6], [-1.3, 6.0], [1.3, 6.0], [0, 5.3]]) D(root, CY(0.08, 0.08, 0.012, 16), M.down, dx, cy0 - 0.026, dz);
  D(root, SA.quad('canopy', 3.8, 0.6), SA.litM, 0, cy0 + 0.11, 6.861);
  for (const s of [-1, 1]) { put(root, CY(0.07, 0.07, cy0, 16), M.frame, s * (CW - 0.15), cy0 / 2, 6.45); box3(S, s * (CW - 0.15) - 0.1, 0, 6.35, s * (CW - 0.15) + 0.1, cy0, 6.55); }
  S.nightGlow.push(M.down, M.frost, B.lit);
  S.lamps.push({ pos: [0, cy0 - 0.4, 5.6], color: 0xffd9a8, intensity: 6, range: 8 });
  // planters + hedges in front of the ground floor units
  for (const s of [-1, 1]) {
    const x0 = s > 0 ? CW + 0.35 : -IX, x1 = s > 0 ? IX : -CW - 0.35, w = x1 - x0, xc = (x0 + x1) / 2;
    put(root, RB(w, 0.5, 1.05, 0.03, 2), M.stone, xc, 0.25, 5.85);
    slab(root, M.dirt, x0 + 0.08, 0.44, 5.4, x1 - 0.08, 0.47, 6.3);
    const hg = new THREE.BoxGeometry(w - 0.3, 0.6, 0.72, Math.round(w * 5), 4, 4);
    const sd = seed * 3 + (s > 0 ? 1 : 2);
    put(root, displace(hg, (x, y, z) => 0.035 * Math.sin(x * 9 + sd) * Math.cos(z * 11) + 0.02 * Math.sin(x * 23 + y * 19 + sd) + (y > 0.2 ? -0.02 : 0)), M.leaves, xc, 0.78, 5.85);
    for (let i = 0; i < 4; i++) {
      const fx = x0 + 0.6 + (w - 1.2) * (i + 0.5) / 4;
      for (let j = 0; j < 6; j++) V(root, SP(0.04, 6, 4), [0xf2a7c0, 0xfff3f0, 0xe8546b][(i + j) % 3], fx + Math.cos(j * 1.7) * 0.25, 1.1 + Math.sin(j * 2.3) * 0.05, 5.85 + Math.sin(j * 1.3) * 0.25);
    }
    box3(S, x0, 0, 5.32, x1, 1.0, 6.38);
  }
  // ---- entrance storefront (the lobby glass) on the core front at ground level
  const gw = M.winGlass;
  for (const s of [-1, 1]) {
    put(root, RB(0.08, 2.75, 0.14, 0.01, 1), M.frame, s * (CW - 0.04), F0 + 1.375, 3.5);
    put(root, RB(0.08, 2.75, 0.14, 0.01, 1), M.frame, s * 0.95, F0 + 1.375, 3.5);
    D(root, quad(1.37, 2.65), gw, s * 1.67, F0 + 1.375, 3.48);
    put(root, RB(1.45, 0.1, 0.14, 0.01, 1), M.frame, s * 1.67, F0 + 0.05, 3.5);
  }
  put(root, RB(2 * CW, 0.12, 0.16, 0.01, 1), M.frame, 0, F0 + 2.72, 3.5);
  put(root, RB(1.9, 0.08, 0.14, 0.01, 1), M.frame, 0, F0 + 2.25, 3.5);
  D(root, quad(1.82, 0.4), gw, 0, F0 + 2.49, 3.48);
  slab(root, M.accentDk, -CW, F0 + 2.78, IZ1, CW, 3.0, BZ1);
  // ground floor colliders (the two ground units + wings are solid)
  for (const s of [-1, 1]) box3(S, s > 0 ? CW : -BX, 0, BZ0, s > 0 ? BX : -CW, 3.3, BAL);
  // lift shaft block behind the lobby (the pocket itself stays empty)
  for (const s of [-1, 1]) box3(S, s > 0 ? SHAFT.x1 : -CW, 0, BZ0, s > 0 ? CW : SHAFT.x0, 3.3, LW0);
  box3(S, SHAFT.x0, 0, BZ0, SHAFT.x1, 3.3, IZ0);
  if (!main) nbShell(S, root, M, TOP, floors);   // walkable lobby + one upper corridor (shell, lift portals, colliders)
  return { M, B, SA, TOP };
}

// ------------------------------------------------------------------ entry point
export function buildApartment({ main = true, dong = '101동', floors = 15, seed = 1 } = {}) {
  floors = Math.max(main ? ME + 2 : 3, floors | 0);
  const S = makeSite(main ? 'apartment' : 'apartment' + seed, 26, 14);
  const root = S.group;
  const accent = main ? ACCENTS[0] : ACCENTS[(seed * 7 + 3) % ACCENTS.length];
  const t0 = performance.now();
  const T = buildTower(S, root, { main, floors, seed, accent, dong });
  if (main) buildInterior(S, root, T);
  else {
    const K = nbK(floors);
    S.extra.elevator = { landings: [
      { name: '1층 로비', pos: [0, F0, LZ], yaw: 0 },
      { name: `${K + 1}층`, pos: [0, FLR(K), LZ], yaw: 0 },
    ] };
    S.extra.interior = { build: () => nbInterior(T, floors, seed) };
  }
  const t1 = performance.now();
  bake(root);
  S.extra.buildMs = Math.round(performance.now() - t0);
  if (typeof location !== 'undefined' && location.search.includes('aptstats')) console.warn('APTSTATS', JSON.stringify(stats(root)), 'geo', Math.round(t1 - t0), 'bake', Math.round(performance.now() - t1));
  S.extra.floors = floors;
  S.extra.floorAt = (k) => FLR(k);
  if (!main) S.extra.floorY = F0;
  return S;
}

/** Draw calls (meshes incl. dynamic ones) and triangles under root (dev stats). */
function stats(root) {
  let draws = 0, tris = 0;
  root.traverse((o) => { if (o.isMesh) { draws++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
  return { draws, tris: Math.round(tris) };
}


// ------------------------------------------------------------------ interiors (main tower only)
function intAtlas() {
  return cached('aptIntAtlas', () => {
    const A = new Atlas(2048, 6);
    A.add('mail', 720, 480, (c, w, h) => {
      c.fillStyle = '#9aa1a8'; c.fillRect(0, 0, w, h);
      const cols = 6, rows = 5, cw = w / cols, rh = h / rows;
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
        const x = k * cw + 5, y = r * rh + 5, fl = 15 - (r * 3 + Math.floor(k / 2)), unit = fl * 100 + 1 + (k % 2);
        rr(c, x, y, cw - 10, rh - 10, 4, '#c9ced3', '#7d848b', 2);
        c.fillStyle = '#3b4046'; c.fillRect(x + 12, y + 16, cw - 34, 7);
        rr(c, x + 12, y + rh - 46, 62, 26, 3, '#f6f4ee'); txt(c, String(unit), x + 43, y + rh - 26, 20, '#2b2f33', 'center');
        c.fillStyle = '#5a6168'; c.beginPath(); c.arc(x + cw - 26, y + rh - 33, 6, 0, PI * 2); c.fill();
        if ((r * 7 + k * 3) % 5 === 0) { c.fillStyle = '#f3efe3'; c.fillRect(x + 20, y + 8, 40, 10); }
      }
    });
    A.add('notice', 640, 400, (c, w, h) => {
      c.fillStyle = '#b98d5c'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(${90 + (i * 37) % 60},${60 + (i * 13) % 40},30,0.25)`; c.fillRect((i * 97) % w, (i * 61) % h, 3, 3); }
      const notes = [[20, 24, 190, 160, '#ffffff', '엘리베이터 점검', '11월 5일 10시~12시'], [230, 30, 170, 130, '#fff3b0', '분리수거 요일', '화 · 금 저녁'], [420, 20, 196, 170, '#ffffff', '주차 안내', '방문 차량 등록'], [40, 210, 170, 160, '#d8f0e0', '놀이터 새단장', '11월 말 완공 예정'], [240, 190, 180, 180, '#ffffff', '관리비 안내', '자동이체 할인'], [440, 215, 170, 150, '#ffe0e6', '반상회', '토요일 오후 3시']];
      for (const [x, y, nw, nh, col, t1, t2] of notes) {
        c.save(); c.translate(x + nw / 2, y + nh / 2); c.rotate(((x * 7) % 9 - 4) * 0.008); c.translate(-nw / 2, -nh / 2);
        c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(4, 5, nw, nh);
        c.fillStyle = col; c.fillRect(0, 0, nw, nh);
        txt(c, t1, nw / 2, 42, 26, '#1f2a36', 'center'); txt(c, t2, nw / 2, 82, 17, '#4a5560', 'center');
        c.fillStyle = '#c3c8cd'; for (let l = 0; l < 3; l++) c.fillRect(18, 104 + l * 16, nw - 36 - l * 20, 5);
        c.fillStyle = '#d33a2c'; c.beginPath(); c.arc(nw / 2, 10, 7, 0, PI * 2); c.fill();
        c.restore();
      }
    });
    for (const n of ['801', '802']) A.add('p' + n, 256, 96, (c, w, h) => { rr(c, 0, 0, w, h, 10, '#2d3238'); txt(c, n + '호', w / 2, 66, 54, '#f2e6c8', 'center'); });
    A.add('f8', 256, 256, (c, w, h) => { c.fillStyle = '#f2efe8'; c.fillRect(0, 0, w, h); txt(c, '8', 118, 200, 210, '#4f7391', 'center'); txt(c, '층', 214, 214, 54, '#4f7391', 'center'); c.fillStyle = '#f2a65a'; c.fillRect(24, 224, 208, 10); });
    A.add('f1', 256, 256, (c, w, h) => { c.fillStyle = '#f2efe8'; c.fillRect(0, 0, w, h); txt(c, '1', 118, 200, 210, '#4f7391', 'center'); txt(c, '층', 214, 214, 54, '#4f7391', 'center'); c.fillStyle = '#f2a65a'; c.fillRect(24, 224, 208, 10); });
    A.add('stairs', 256, 96, (c, w, h) => { rr(c, 0, 0, w, h, 8, '#2f3a45'); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(20, 76); for (let i = 0; i < 4; i++) { c.lineTo(20 + i * 14, 76 - i * 12); c.lineTo(34 + i * 14, 76 - i * 12); } c.lineTo(76, 80); c.lineTo(20, 80); c.fill(); txt(c, '계단', 166, 64, 44, '#ffffff', 'center'); });
    A.add('hydrant', 220, 110, (c, w, h) => { c.fillStyle = '#c8302a'; c.fillRect(0, 0, w, h); txt(c, '소화전', w / 2, 70, 52, '#ffffff', 'center'); });
    A.add('parcel', 200, 140, (c, w, h) => { c.fillStyle = '#c9a77a'; c.fillRect(0, 0, w, h); c.fillStyle = '#f4f1ea'; c.fillRect(20, 30, 160, 80); txt(c, '801호 택배', 100, 70, 26, '#2b2f33', 'center'); c.fillStyle = '#2b2f33'; for (let i = 0; i < 14; i++) c.fillRect(34 + i * 9, 82, i % 3 ? 3 : 5, 20); });
    A.add('guard', 400, 100, (c, w, h) => { rr(c, 0, 0, w, h, 10, '#2d3238'); aptMark(c, 52, 50, 32, '#ffffff', '#ffc56b'); txt(c, '경비실 · 안내', 236, 66, 46, '#ffffff', 'center'); });
    A.add('welcome', 512, 128, (c, w, h) => { c.fillStyle = '#3e4a52'; c.fillRect(0, 0, w, h); txt(c, '어서 오세요 · 세온 아파트', w / 2, 80, 42, '#d7dde2', 'center'); });
    A.add('cal', 300, 380, (c, w, h) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = '#4f7391'; c.fillRect(0, 0, w, 74);
      txt(c, '2026  11월', w / 2, 52, 40, '#ffffff', 'center');
      for (let i = 0; i < 30; i++) { const cx = 30 + (i % 7) * 40, cy = 116 + Math.floor(i / 7) * 50; txt(c, String(i + 1), cx, cy, 22, i % 7 === 0 ? '#d33a2c' : '#3a3f45', 'center'); if (i === 7 || i === 14) { c.strokeStyle = '#f2a65a'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy - 8, 17, 0, PI * 2); c.stroke(); } }
    });
    A.add('draw', 256, 256, (c, w, h) => {
      c.fillStyle = '#fbfaf5'; c.fillRect(0, 0, w, h); c.lineWidth = 6; c.lineCap = 'round';
      c.strokeStyle = '#f2b03c'; c.beginPath(); c.arc(200, 54, 26, 0, PI * 2); c.stroke();
      c.strokeStyle = '#4f7391'; c.strokeRect(40, 110, 110, 96); c.beginPath(); c.moveTo(30, 112); c.lineTo(95, 60); c.lineTo(160, 112); c.stroke();
      c.strokeStyle = '#e8546b'; for (const x of [178, 214]) { c.beginPath(); c.arc(x, 150, 12, 0, PI * 2); c.moveTo(x, 162); c.lineTo(x, 200); c.moveTo(x - 14, 176); c.lineTo(x + 14, 176); c.stroke(); }
      c.strokeStyle = '#5f8a3a'; c.beginPath(); c.moveTo(10, 226); c.lineTo(246, 226); c.stroke(); txt(c, '우리집', 70, 246, 22, '#2b2f33', 'center');
    });
    const photos = [['#9fd3f2', '#7cae4b'], ['#ffb38a', '#3a6f9a'], ['#e9dccb', '#c98f52']];
    photos.forEach(([a, b], i) => A.add('photo' + i, 200, 150, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, a); g.addColorStop(1, '#ffffff'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = b; c.fillRect(0, h * 0.68, w, h); for (let k = 0; k < 3; k++) { c.fillStyle = '#f1c9a5'; c.beginPath(); c.arc(60 + k * 40, h * 0.42, 12 - k * 2, 0, PI * 2); c.fill(); c.fillStyle = ['#e76f51', '#2a9d8f', '#f4a261'][k]; c.fillRect(48 + k * 40, h * 0.5, 24 - k * 3, 36); } }));
    A.add('art', 400, 300, (c, w, h) => { c.fillStyle = '#efe7da'; c.fillRect(0, 0, w, h); c.fillStyle = '#d98b5f'; c.beginPath(); c.arc(140, 150, 90, 0, PI * 2); c.fill(); c.fillStyle = '#4f7391'; c.fillRect(200, 60, 120, 180); c.fillStyle = '#e8c96a'; c.beginPath(); c.arc(300, 90, 34, 0, PI * 2); c.fill(); });
    // lit items
    A.add('call', 96, 192, (c, w, h) => { c.fillStyle = '#1d2024'; c.fillRect(0, 0, w, h); for (const [y, up] of [[60, 1], [132, 0]]) { c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(48, y, 26, 0, PI * 2); c.fill(); c.fillStyle = '#5a4210'; c.beginPath(); if (up) { c.moveTo(48, y - 12); c.lineTo(60, y + 8); c.lineTo(36, y + 8); } else { c.moveTo(48, y + 12); c.lineTo(60, y - 8); c.lineTo(36, y - 8); } c.fill(); } });
    for (const n of ['1', '8']) A.add('ind' + n, 192, 72, (c, w, h) => { c.fillStyle = '#0d0f12'; c.fillRect(0, 0, w, h); txt(c, n, 120, 60, 58, '#ff9a3c', 'center'); c.fillStyle = '#ff9a3c'; c.beginPath(); c.moveTo(40, 18); c.lineTo(56, 40); c.lineTo(24, 40); c.fill(); });
    A.add('cctv', 320, 200, (c, w, h) => { c.fillStyle = '#0b0d10'; c.fillRect(0, 0, w, h); const t = ['#4b5d6e', '#5d6b52', '#6a5c4e', '#4e5a6a']; for (let i = 0; i < 4; i++) { const x = (i % 2) * 160 + 4, y = Math.floor(i / 2) * 100 + 4; c.fillStyle = t[i]; c.fillRect(x, y, 152, 92); c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(x + 20, y + 50, 110, 30); c.fillStyle = '#e6eef5'; c.font = `14px ${FONT}`; c.fillText('CAM ' + (i + 1), x + 6, y + 16); } });
    A.add('lock', 96, 160, (c, w, h) => { c.fillStyle = '#15171a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 12; i++) { c.fillStyle = '#7fd6ff'; c.font = `20px ${FONT}`; c.textAlign = 'center'; c.fillText(String((i + 1) % 10), 22 + (i % 3) * 26, 34 + Math.floor(i / 3) * 32); } });
    A.add('exit', 256, 96, (c, w, h) => { c.fillStyle = '#1f9a55'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffffff'; c.fillRect(22, 18, 56, 60); c.fillStyle = '#1f9a55'; c.fillRect(32, 26, 30, 52); txt(c, '비상구', 168, 64, 44, '#ffffff', 'center'); });
    A.build();
    A.mat = A.printed(0.6);
    A.glowM = A.lit(1.15);
    return A;
  });
}
function tvScreen() {
  const t = canvasTex(512, 288, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5fb3f0'); g.addColorStop(1, '#bfe6ff'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffd34d'; c.beginPath(); c.arc(w * 0.22, h * 0.36, 44, 0, 7); c.fill();
    c.fillStyle = '#6cbf5a'; c.beginPath(); c.moveTo(0, h); c.lineTo(0, h * 0.7); c.quadraticCurveTo(w * 0.4, h * 0.52, w, h * 0.72); c.lineTo(w, h); c.fill();
    c.fillStyle = 'rgba(20,40,80,0.82)'; c.fillRect(0, h * 0.78, w, h * 0.22);
    c.fillStyle = '#fff'; c.font = `30px ${FONT}`; c.fillText('오늘의 날씨  맑음 18°', 22, h * 0.92);
    c.fillStyle = '#e2574c'; c.fillRect(w - 92, 14, 78, 30); c.fillStyle = '#fff'; c.font = `20px ${FONT}`; c.fillText('LIVE', w - 76, 36);
  });
  const m = new THREE.MeshStandardMaterial({ color: 0x0b0c0f, roughness: 0.16, metalness: 0.4, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0 });
  m.name = 'aptTVScreen'; m.userData.onIntensity = 1.3;
  return m;
}
function intMats() {
  return {
    oakFloor: textured('planks', { color: 0xb68558 }, 1.5, { normal: 0.6 }), floorTile: mat('floorTile'), marble: mat('marble'),
    bathTile: mat('bathTile'), wallTile: mat('wallTile'), plasterW: mat('plasterWarm'), sage: mat('plasterSage'), ceil: paint(0xf6f4ef, 0.92),
    white: mat('whiteWood'), oak: mat('oak'), walnut: mat('walnut'), linen: mat('linen'), fabGray: mat('fabricGray'), fabBeige: mat('fabricBeige'),
    fabGreen: mat('fabricGreen'), ceramic: mat('ceramic'), chrome: mat('chrome'), steel: mat('steel'), black: mat('blackPlastic'),
    whitePl: mat('whitePlastic'), mirror: mat('mirror'), glass: mat('glass'), lamp: mat('lampGlow'), rug: mat('carpetWarm'), rug2: mat('carpet'),
    door: paint(0x4e5357, 0.38, 0.35, { clearcoat: 0.4 }), dark: paint(0x2b2f33, 0.5, 0.3),
    A: intAtlas(), tv: tvScreen(),
  };
}

// ------------------------------------------------------------------ the lift portal (shared by both landings)
function liftPortal(S, root, M, IM, F, top, ind) {
  const A = IM.A;
  // front wall with the 1.2 x 2.3 doorway
  wallX(root, M.wall, -CW, CW, LW0, LW1, F, top, [{ a: -0.6, b: 0.6, lo: F, hi: F + 2.3 }], S);
  // steel jambs, head, returns and sill
  for (const s of [-1, 1]) {
    put(root, RB(0.12, 2.42, 0.05, 0.01, 1), IM.steel, s * 0.66, F + 1.21, LW1 + 0.024);
    put(root, box(0.012, 2.3, LW1 - LW0), IM.steel, s * 0.594, F + 1.15, (LW0 + LW1) / 2);
  }
  put(root, RB(1.44, 0.12, 0.05, 0.01, 1), IM.steel, 0, F + 2.36, LW1 + 0.024);
  put(root, box(1.2, 0.012, LW1 - LW0), IM.steel, 0, F + 2.294, (LW0 + LW1) / 2);
  put(root, box(1.2, 0.008, LW1 - LW0 + 0.06), IM.steel, 0, F + 0.004, (LW0 + LW1) / 2 + 0.03);
  // call buttons and floor indicator
  put(root, RB(0.14, 0.28, 0.02, 0.006, 1), IM.steel, 0.9, F + 1.1, LW1 + 0.01);
  D(root, A.quad('call', 0.07, 0.14), A.glowM, 0.9, F + 1.1, LW1 + 0.021);
  put(root, RB(0.4, 0.16, 0.03, 0.008, 1), IM.dark, 0, F + 2.56, LW1 + 0.015);
  D(root, A.quad(ind, 0.32, 0.12), A.glowM, 0, F + 2.56, LW1 + 0.031);
  // shaft walls (pocket sides and back) and the solid pipe shafts beside it
  for (const s of [-1, 1]) {
    slab(root, M.conc, s > 0 ? SHAFT.x1 : SHAFT.x0 - 0.2, F - 0.3, IZ0, s > 0 ? SHAFT.x1 + 0.2 : SHAFT.x0, top, LW0);
    box3(S, s > 0 ? SHAFT.x1 : -CW, F, IZ0, s > 0 ? CW : SHAFT.x0, top, LW0);
  }
  slab(root, M.conc, SHAFT.x0, F - 0.3, IZ0 - 0.01, SHAFT.x1, top, IZ0);
  slab(root, IM.dark, SHAFT.x0, Math.max(0.004, F - 0.34), IZ0, SHAFT.x1, Math.max(0.02, F - 0.32), LW0);   // pit floor (visual only, no collider)
}

// ------------------------------------------------------------------ ground lobby
function buildLobby(S, root, T, IM) {
  const { M } = T, A = IM.A;
  const F = F0, C = F0 + 2.9;
  // floor (incl. the lift threshold and the door track), ceiling
  slab(root, IM.floorTile, -CW, F - 0.03, LW1, CW, F, BZ1);
  box3(S, -CW, 0, LW0, CW, F, BZ1);
  slab(root, IM.ceil, -CW, C, LW1, CW, C + 0.1, IZ1);
  for (const [x, z] of [[-1.2, 2.2], [1.2, 2.2], [-1.2, -0.4], [1.2, -0.4], [-1.2, -2.6], [1.2, -2.6]]) { D(root, CY(0.09, 0.09, 0.012, 16), M.down, x, C - 0.006, z); put(root, torus(0.1, 0.012, 6, 18), IM.steel, x, C - 0.004, z, PI / 2, 0, 0); }
  S.lamps.push({ pos: [0, C - 0.35, 1.6], color: 0xffe2b8, intensity: 10, range: 8 }, { pos: [0, C - 0.35, -2.2], color: 0xffe2b8, intensity: 10, range: 7 });
  // side walls with a marble wainscot and wood slat panels
  for (const s of [-1, 1]) {
    slab(root, IM.plasterW, s > 0 ? CW : -CW - 0.2, F, LW1, s > 0 ? CW + 0.2 : -CW, C, IZ1);
    box3(S, s > 0 ? CW : -CW - 0.2, F, LW1, s > 0 ? CW + 0.2 : -CW, C, IZ1);
    const xi = s * CW;
    slab(root, IM.marble, s > 0 ? xi - 0.02 : xi, F, LW1, s > 0 ? xi : xi + 0.02, F + 1.15, IZ1 - 0.02);
    put(root, RB(0.03, 0.04, IZ1 - LW1 - 0.04, 0.008, 1), IM.walnut, xi - s * 0.025, F + 1.17, (LW1 + IZ1) / 2);
  }
  // lift wall clad in oak slats around the steel portal
  liftPortal(S, root, M, IM, F, C, 'ind1');
  for (let x = -CW + 0.06; x < CW - 0.03; x += 0.09) if (Math.abs(x) > 0.82) put(root, RB(0.05, C - F - 0.02, 0.03, 0.006, 1), IM.oak, x, (F + C) / 2, LW1 + 0.015);
  put(root, RB(2 * CW, 0.06, 0.05, 0.01, 1), IM.walnut, 0, C - 0.03, LW1 + 0.025);
  D(root, A.quad('f1', 0.42, 0.42), A.mat, -1.45, F + 1.6, LW1 + 0.035);
  // mailboxes on the west wall
  const mx = -CW + 0.18;
  put(root, RB(0.36, 1.58, 2.24, 0.012, 1), IM.steel, mx, F + 1.36, 1.9);
  D(root, A.quad('mail', 2.16, 1.44), A.mat, mx + 0.181, F + 1.36, 1.9, 0, PI / 2, 0);
  put(root, RB(0.4, 0.08, 2.3, 0.01, 1), IM.dark, mx + 0.02, F + 0.53, 1.9);
  box3(S, -CW, F, 0.75, -CW + 0.4, F + 2.2, 3.05);
  // bench + stair door on the west wall
  const bg = group(root, -CW + 0.3, F, -0.7, PI / 2);
  put(bg, RB(1.5, 0.05, 0.42, 0.012, 2), IM.oak, 0, 0.45, 0);
  for (const s of [-1, 1]) put(bg, RB(0.05, 0.43, 0.38, 0.01, 1), IM.dark, s * 0.65, 0.215, 0);
  box3(S, -CW, F, -1.5, -CW + 0.55, F + 0.5, 0.1);
  staticDoor(root, -CW, F, -2.75, PI / 2, { w: 0.95, h: 2.1, leaf: paint(0x8a9096, 0.45, 0.5), frame: IM.dark });
  D(root, A.quad('stairs', 0.42, 0.16), A.mat, -CW + 0.04, F + 2.42, -2.75, 0, PI / 2, 0);
  // security desk (guard stands behind it, looking at the door)
  const dg = group(root, 1.55, F, 1.45, -PI / 2);
  put(dg, RB(1.7, 1.06, 0.08, 0.015, 2), IM.walnut, 0, 0.53, 0.28);
  put(dg, RB(1.8, 0.05, 0.36, 0.012, 2), IM.marble, 0, 1.085, 0.22);
  put(dg, RB(1.7, 0.04, 0.62, 0.01, 1), IM.oak, 0, 0.74, -0.04);
  for (const s of [-1, 1]) put(dg, RB(0.06, 0.74, 0.6, 0.01, 1), IM.walnut, s * 0.82, 0.37, -0.04);
  D(dg, A.quad('guard', 0.8, 0.2), A.mat, 0, 0.78, 0.322);
  const mon = group(dg, -0.35, 0.76, -0.18, PI);
  put(mon, RB(0.5, 0.32, 0.03, 0.008, 1), IM.black, 0, 0.3, 0);
  D(mon, A.quad('cctv', 0.46, 0.28), A.glowM, 0, 0.3, -0.016, 0, PI, 0);
  put(mon, box(0.04, 0.14, 0.04), IM.black, 0, 0.08, 0.02);
  V(dg, RB(0.18, 0.06, 0.14, 0.015, 1), 0x2b2f33, 0.3, 0.79, -0.1);
  V(dg, RB(0.24, 0.02, 0.32, 0.004, 1), 0x1d3557, 0.5, 0.77, 0.0);
  mug(dg, 0.12, 0.76, 0.0, 0xf2efe8, 0.4);
  box3(S, 1.15, F, 0.6, 1.95, F + 1.1, 2.3);
  S.npcSpots.push({ pos: [2.05, F, 1.45], yaw: PI / 2, pose: 'stand', role: 'guard' });
  officeChair(root, 2.05, F, 2.75, PI / 2 + 0.4);
  // notice board on the east wall
  put(root, RB(0.04, 1.06, 1.66, 0.01, 1), IM.oak, CW - 0.02, F + 1.62, -1.95);
  D(root, A.quad('notice', 1.56, 0.97), A.mat, CW - 0.042, F + 1.62, -1.95, 0, -PI / 2, 0);
  // plants, entry mat
  pottedPlant(root, 1.85, F, -3.15, { kind: 'fig', h: 1.5, seed: 11, pot: 'charcoal', potR: 0.22, potH: 0.42 });
  box3(S, 1.6, F, -3.4, 2.1, F + 0.5, -2.9);
  pottedPlant(root, 1.95, F, 3.0, { kind: 'snake', h: 0.9, seed: 4, pot: 'white', potR: 0.17, potH: 0.36 });
  box3(S, 1.75, F, 2.8, 2.15, F + 0.5, 3.2);
  put(root, RB(2.0, 0.012, 1.1, 0.005, 1), IM.rug2, 0, F + 0.006, 2.7);
  D(root, A.quad('welcome', 1.6, 0.4), A.mat, 0, F + 0.013, 2.7, -PI / 2, 0, 0);
  // sliding glass entrance doors (auto)
  for (const s of [-1, 1]) {
    const pv = group(root, s * 0.47, F, 3.5, 0);
    pv.userData.dynamic = true;
    put(pv, RB(0.94, 0.08, 0.05, 0.01, 1), M.frame, 0, 2.16, 0);
    put(pv, RB(0.94, 0.1, 0.05, 0.01, 1), M.frame, 0, 0.05, 0);
    for (const t of [-1, 1]) put(pv, RB(0.05, 2.2, 0.05, 0.01, 1), M.frame, t * 0.445, 1.1, 0);
    D(pv, quad(0.86, 2.02), M.winGlass, 0, 1.11, 0);
    put(pv, RB(0.025, 0.7, 0.04, 0.01, 1), IM.chrome, -s * 0.36, 1.05, 0.05);
    bake(pv);
    S.doors.push({ pivot: pv, slide: [s * 0.9, 0, 0], collider: { min: [s * 0.47 - 0.47, F, 3.44], max: [s * 0.47 + 0.47, F + 2.2, 3.56] }, auto: true });
  }
  for (const s of [-1, 1]) box3(S, s > 0 ? 0.94 : -CW, F, 3.42, s > 0 ? CW : -0.94, C, 3.58);
  S.indoor.push({ min: [-CW, F, LW1], max: [CW, C, IZ1] });
}

// ------------------------------------------------------------------ 8th floor landing + corridor
function buildHall(S, root, T, IM) {
  const { M } = T, A = IM.A;
  const F = FLR(ME), C = F + 2.6;
  slab(root, M.conc, -CW, F - 0.3, LW0, CW, F - 0.03, 0.6);
  slab(root, IM.floorTile, -CW, F - 0.03, LW1, CW, F, 0.4);
  box3(S, -CW, F - 0.3, LW0, CW, F, 0.6);
  slab(root, IM.ceil, -CW, C, LW1, CW, C + 0.1, 0.4);
  liftPortal(S, root, M, IM, F, C + 0.1, 'ind8');
  // west wall (801) and front wall (stairs)
  slab(root, IM.plasterW, -CW - 0.2, F, LW1, -CW, C + 0.1, 0.6); box3(S, -CW - 0.2, F, LW1, -CW, C, 0.6);
  slab(root, IM.plasterW, -CW, F, 0.4, CW, C + 0.1, 0.6); box3(S, -CW, F, 0.4, CW, C, 0.6);
  // wainscot / baseboards
  for (const [x0, z0, x1, z1] of [[-CW, LW1, -CW + 0.012, 0.4], [-CW, 0.388, CW, 0.4]]) slab(root, IM.walnut, x0, F, z0, x1, F + 0.1, z1);
  // ceiling light
  D(root, CY(0.2, 0.2, 0.04, 28), IM.lamp, 0, C - 0.02, -1.6);
  put(root, CY(0.23, 0.23, 0.03, 28), IM.whitePl, 0, C - 0.012, -1.6);
  S.lamps.push({ pos: [0, C - 0.4, -1.6], color: 0xfff0d8, intensity: 9, range: 7 });
  // the big floor number, 801 door + plate + parcel, stair fire door + exit sign, hydrant
  D(root, A.quad('f8', 0.5, 0.5), A.mat, -1.5, F + 1.55, LW1 + 0.012);
  staticDoor(root, -CW, F, -1.5, PI / 2, { w: 0.95, h: 2.1, leaf: IM.door, frame: IM.dark });
  D(root, A.quad('p801', 0.2, 0.075), A.mat, -CW + 0.085, F + 1.55, -1.5, 0, PI / 2, 0);
  put(root, RB(0.07, 0.16, 0.12, 0.01, 1), IM.black, -CW + 0.09, F + 1.0, -1.18);
  const pc = group(root, -1.75, F, -0.5, 0.35);
  V(pc, RB(0.46, 0.3, 0.34, 0.012, 1), 0xc9a77a, 0, 0.15, 0);
  V(pc, box(0.47, 0.04, 0.06), 0xb38b5a, 0, 0.29, 0);
  D(pc, A.quad('parcel', 0.2, 0.14), A.mat, 0, 0.18, 0.172);
  box3(S, -2.05, F, -0.8, -1.45, F + 0.32, -0.2);
  staticDoor(root, -1.15, F, 0.4, PI, { w: 0.95, h: 2.1, leaf: paint(0x8a9096, 0.45, 0.5), frame: IM.dark });
  put(root, RB(0.4, 0.16, 0.05, 0.008, 1), IM.dark, -1.15, F + 2.33, 0.37);
  D(root, A.quad('exit', 0.36, 0.13), A.glowM, -1.15, F + 2.33, 0.343, 0, PI, 0);
  put(root, RB(0.7, 0.9, 0.14, 0.02, 1), paint(0xc8302a, 0.45, 0.1), 1.35, F + 1.05, 0.33);
  D(root, A.quad('hydrant', 0.3, 0.15), A.mat, 1.35, F + 1.32, 0.258, 0, PI, 0);
  put(root, CY(0.05, 0.05, 0.02, 16), IM.lamp, 1.35, F + 0.85, 0.255, PI / 2, 0, 0);
  box3(S, 0.95, F, 0.22, 1.75, F + 1.5, 0.4);
  pottedPlant(root, 1.95, F, -0.35, { kind: 'bush', h: 0.7, seed: 21, pot: 'terracotta', potR: 0.16, potH: 0.32 });
  box3(S, 1.75, F, -0.55, 2.15, F + 0.5, -0.15);
  // kid's kick scooter leaning by our door
  const sc = group(root, 2.15, F, -2.85, 0);
  sc.rotation.z = 0.12;
  V(sc, RB(0.12, 0.03, 0.62, 0.01, 1), 0x4f7391, 0, 0.09, 0);
  vrod(sc, 0xd0d0d0, [0, 0.1, -0.3], [0, 0.82, -0.36], 0.014);
  vrod(sc, 0x222222, [-0.18, 0.82, -0.36], [0.18, 0.82, -0.36], 0.016);
  for (const zz of [-0.32, 0.3]) V(sc, CY(0.06, 0.06, 0.03, 16), 0xe8546b, 0, 0.06, zz, 0, 0, PI / 2);
  box3(S, 1.95, F, -3.25, CW, F + 0.9, -2.45);
}

// ------------------------------------------------------------------ unit 802호 (x 2.6..12.6, floor y 21.3)
const DOOR = { z0: -2.05, z1: -1.0 };          // front door opening in the core wall (x 2.4..2.6)
function chairGeo(g, wood, seat) {
  put(g, RB(0.44, 0.04, 0.42, 0.01, 2), wood, 0, 0.45, 0);
  put(g, softBox(0.4, 0.04, 0.38, 0.015, 0.01, 0.002, 2), seat, 0, 0.485, 0);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(g, RB(0.035, 0.45, 0.035, 0.008, 1), wood, a * 0.19, 0.225, b * 0.18);
  for (const a of [-1, 1]) put(g, RB(0.035, 0.45, 0.035, 0.008, 1), wood, a * 0.19, 0.69, -0.19);
  put(g, RB(0.42, 0.14, 0.025, 0.008, 2), wood, 0, 0.82, -0.195);
}
function cabinetRun(p, x, y, z, ry, w, h, d, n, body, front, handleM, opt = {}) {
  const g = group(p, x, y, z, ry);
  put(g, RB(w, h, d - 0.02, 0.01, 1), body, 0, h / 2, -0.01);
  const dw = w / n;
  for (let i = 0; i < n; i++) {
    const cx = -w / 2 + dw * (i + 0.5);
    put(g, RB(dw - 0.008, h - (opt.kick ?? 0) - 0.01, 0.02, 0.005, 1), front, cx, (h + (opt.kick ?? 0)) / 2, d / 2 - 0.01);
    if (handleM) put(g, RB(opt.hw ?? 0.018, opt.hh ?? 0.22, 0.02, 0.006, 1), handleM, cx + (i % 2 ? -1 : 1) * (dw / 2 - 0.06), opt.hy ?? h * 0.55, d / 2 + 0.01);
  }
  if (opt.kick) put(g, box(w - 0.04, opt.kick, 0.02), mat('blackPlastic'), 0, opt.kick / 2, d / 2 - 0.06);
  return g;
}
function curtainPanel(p, m, x, top, bottom, z, pw, seed = 1) {
  const h = top - bottom;
  const geo = new THREE.PlaneGeometry(pw, h, 20, 4);
  const pp = geo.attributes.position;
  for (let i = 0; i < pp.count; i++) { const xx = pp.getX(i), yy = pp.getY(i); pp.setZ(i, Math.sin((xx / pw) * PI * 7 + seed) * 0.035); pp.setX(i, xx * (1 - 0.15 * ((h / 2 - yy) / h))); }
  geo.computeVertexNormals();
  const a = prep(geo);
  const o = put(p, a, m, x, bottom + h / 2, z);
  o.material = m;
  const b = a.clone(); b.rotateY(PI);
  put(p, b, m, x, bottom + h / 2, z - 0.003);
}
function buildUnit(S, root, T, IM) {
  const { M } = T, A = IM.A;
  const F = FLR(ME), C = F + UCL;
  const vc = vcMat(), vg = vcGloss();
  // ---- slab, floors, ceiling
  slab(root, M.conc, CW, F - 0.3, IZ0, IX, F - 0.03, IZ1);
  box3(S, CW, F - 0.3, IZ0, IX, F, IZ1);
  slab(root, IM.oakFloor, 3.7, F - 0.03, IZ0, 8.5, F, IZ1);
  slab(root, IM.oakFloor, 2.6, F - 0.03, -0.4, 3.7, F, IZ1);
  slab(root, IM.oakFloor, 2.6, F - 0.03, IZ0, 3.7, F, -2.6);
  slab(root, IM.floorTile, 2.6, F - 0.03, -2.6, 3.7, F - 0.005, -0.4);       // 현관 tiles
  put(root, RB(0.06, 0.035, 2.2, 0.01, 1), IM.walnut, 3.7, F - 0.005, -1.5);   // 마루 edge
  slab(root, IM.oakFloor, 8.5, F - 0.03, -3.14, IX, F, IZ1);
  slab(root, IM.bathTile, 8.5, F - 0.03, IZ0, IX, F - 0.01, -3.14);
  slab(root, IM.ceil, 2.6, C, IZ0, IX, C + 0.08, IZ1);
  // ---- walls (core wall with the door hole, partitions) + colliders for the shell
  wallZ(root, M.wall, IZ0, IZ1, CW, CW + 0.2, F, F + 2.7, [{ a: DOOR.z0, b: DOOR.z1, lo: F, hi: F + 2.1 }], S);
  box3(S, IX, F, IZ0, BX, C, IZ1); box3(S, CW, F, IZ1, IX, C, BZ1); box3(S, CW, F, BZ0, IX, C, IZ0);
  wallX(root, M.wall, 2.6, 4.52, -2.66, -2.54, F, C, [], S);                 // utility | entry
  wallZ(root, M.wall, IZ0, -2.54, 4.4, 4.52, F, C, [], S);                   // utility | kitchen
  wallX(root, M.wall, 2.6, 3.9, -0.46, -0.34, F, C, [], S);                  // entry | living
  wallZ(root, M.wall, IZ0, IZ1, 8.44, 8.56, F, C, [{ a: -4.6, b: -3.7, lo: F, hi: F + 2.1 }, { a: -2.6, b: -1.7, lo: F, hi: F + 2.1 }], S);
  wallX(root, M.wall, 8.56, IX, -3.2, -3.08, F, C, [], S);                    // bath | bedroom
  // door casings for the two inner doorways + open leaves
  for (const [z0, z1, into] of [[-4.6, -3.7, 1], [-2.6, -1.7, 1]]) {
    for (const z of [z0 - 0.03, z1 + 0.03]) put(root, RB(0.16, 2.14, 0.06, 0.008, 1), IM.white, 8.5, F + 1.07, z);
    put(root, RB(0.16, 0.06, z1 - z0 + 0.12, 0.008, 1), IM.white, 8.5, F + 2.13, (z0 + z1) / 2);
    const hz = into && z1 > -2 ? z1 + 0.03 : z0 - 0.03;   // bedroom leaf hinged at its +Z jamb, bath leaf at its -Z jamb
    put(root, RB(z1 - z0 - 0.04, 2.08, 0.04, 0.006, 1), IM.white, 8.58 + (z1 - z0) / 2, F + 1.04, hz);
    put(root, RB(0.1, 0.02, 0.02, 0.006, 1), IM.chrome, 8.58 + (z1 - z0) - 0.1, F + 1.0, hz + (z1 > -2 ? -0.03 : 0.03));
    box3(S, 8.56, F, hz - 0.03, 8.56 + (z1 - z0), F + 2.08, hz + 0.03);
  }
  // baseboards
  for (const [x0, z0, x1, z1] of [[2.6, -0.34, 2.612, 3.38], [3.9, -0.34, 8.44, -0.328], [4.52, IZ0, 4.532, -2.54], [8.428, -1.7, 8.44, 3.38], [8.56, -3.08, 8.572, -2.6], [8.56, -1.7, 8.572, 3.38], [12.588, -3.08, IX, 3.38]]) slab(root, IM.white, x0, F, z0, x1, F + 0.08, z1);

  // ================= entry (현관)
  const sg = cabinetRun(root, 3.51, F, -2.35, 0, 1.78, 2.3, 0.38, 4, IM.white, IM.oak, null);
  slab(root, IM.walnut, 2.64, F + 0.95, -2.53, 4.38, F + 1.22, -2.18);            // open niche
  put(root, RB(1.76, 0.03, 0.36, 0.008, 1), IM.oak, 3.51, F + 0.95, -2.36);
  put(root, lathe([[0, 0], [0.06, 0], [0.09, 0.03], [0.085, 0.035], [0.05, 0.008], [0, 0.008]], 20), IM.ceramic, 3.2, F + 0.965, -2.33);
  V(root, RB(0.05, 0.01, 0.02, 0.003, 1), 0xd8b25a, 3.2, F + 0.98, -2.33);
  pottedPlant(root, 3.95, F + 0.965, -2.36, { kind: 'herb', h: 0.2, potR: 0.05, potH: 0.08, seed: 3, pot: 'terracotta' });
  void sg;
  box3(S, 2.6, F, -2.54, 4.4, F + 2.3, -2.16);
  // mirror on the entry side of the living partition
  put(root, RB(0.6, 1.4, 0.03, 0.01, 1), IM.oak, 3.2, F + 1.2, -0.48);
  D(root, quad(0.54, 1.34), IM.mirror, 3.2, F + 1.2, -0.496, 0, PI, 0);
  // shoes, umbrella, mat
  const shoe = (x, z, ry, col, s2 = 1) => { const g = group(root, x, F, z, ry); V(g, RB(0.1 * s2, 0.07 * s2, 0.26 * s2, 0.03, 2), col, 0, 0.045 * s2, 0); V(g, RB(0.104 * s2, 0.02, 0.27 * s2, 0.008, 1), 0xf2f0ea, 0, 0.01, 0); };
  shoe(2.95, -1.75, 1.45, 0x3b4f73); shoe(2.97, -1.6, 1.6, 0x3b4f73); shoe(3.3, -0.85, 1.7, 0xd9534f, 0.85); shoe(3.32, -0.72, 1.5, 0xd9534f, 0.85); shoe(3.45, -2.0, 1.3, 0xf2efe8);
  V(root, CY(0.09, 0.08, 0.42, 16, true), 0x3b4047, 2.82, F + 0.21, -0.65);
  vrod(root, 0x2f6fb7, [2.82, F + 0.1, -0.65], [2.86, F + 0.85, -0.66], 0.035, 8);
  ceilingDisc(root, IM, 3.4, C, -1.5, 0.14);
  S.lamps.push({ pos: [3.4, C - 0.3, -1.5], color: 0xffe2b8, intensity: 6, range: 5 });

  // ================= the front door (hinged at the +Z jamb, swings into the entry)
  for (const z of [DOOR.z0 - 0.04, DOOR.z1 + 0.04]) put(root, RB(0.24, 2.16, 0.08, 0.01, 1), IM.dark, 2.5, F + 1.08, z);
  put(root, RB(0.24, 0.08, DOOR.z1 - DOOR.z0 + 0.16, 0.01, 1), IM.dark, 2.5, F + 2.14, (DOOR.z0 + DOOR.z1) / 2);
  const piv = group(root, 2.5, F, DOOR.z1 - 0.01, 0);
  piv.userData.dynamic = true;
  const lw = DOOR.z1 - DOOR.z0 - 0.03;
  put(piv, RB(0.06, 2.08, lw, 0.008, 2), IM.door, 0, 1.04, -lw / 2);
  for (const sx of [-1, 1]) {
    put(piv, RB(0.02, 0.34, 0.025, 0.006, 1), IM.chrome, sx * 0.045, 1.0, -lw + 0.1);
    put(piv, RB(0.02, 0.02, 0.14, 0.006, 1), IM.chrome, sx * 0.055, 1.0, -lw + 0.15);
  }
  put(piv, RB(0.035, 0.24, 0.1, 0.01, 1), IM.black, -0.045, 1.25, -lw + 0.1);
  D(piv, A.quad('lock', 0.06, 0.1), A.glowM, -0.063, 1.25, -lw + 0.1, 0, -PI / 2, 0);
  D(piv, A.quad('p802', 0.22, 0.08), A.mat, -0.031, 1.6, -lw / 2, 0, -PI / 2, 0);
  put(piv, CY(0.012, 0.012, 0.07, 10), IM.chrome, 0, 1.55, -lw / 2 + 0.25, 0, 0, PI / 2);
  bake(piv);
  S.doors.push({ pivot: piv, openAngle: -1.6, collider: { min: [2.45, F, DOOR.z0], max: [2.56, F + 2.1, DOOR.z1] }, auto: false });

  // ================= living room (x 2.6..8.44, z -0.4..3.4)
  slab(root, IM.marble, 2.6, F, 0.25, 2.625, C, 2.75);                        // marble 아트월
  for (let z = -0.3; z < 3.3; z += 0.075) if (z < 0.2 || z > 2.78) put(root, RB(0.03, C - F - 0.02, 0.04, 0.006, 1), IM.oak, 2.62, (F + C) / 2, z + 0.02);
  const cg = group(root, 2.85, F, 1.5, PI / 2);
  put(cg, RB(2.2, 0.36, 0.44, 0.012, 2), IM.walnut, 0, 0.22, 0);
  for (let i = 0; i < 3; i++) put(cg, RB(0.72, 0.3, 0.02, 0.006, 1), IM.oak, -0.73 + i * 0.73, 0.22, 0.221);
  V(cg, RB(0.3, 0.06, 0.2, 0.015, 1), 0xf0f0ee, 0.55, 0.43, -0.02);
  V(cg, RB(0.14, 0.24, 0.14, 0.03, 2), 0x8c8c8a, -0.85, 0.52, -0.05, 0, 0, 0, vcSoft());
  pottedPlant(cg, -0.45, 0.4, 0.0, { kind: 'bush', h: 0.35, potR: 0.09, potH: 0.14, seed: 12, pot: 0x86a08a });
  box3(S, 2.6, F, 0.4, 3.08, F + 0.42, 2.6);
  const tv = group(root, 2.66, F + 1.35, 1.5, PI / 2);
  put(tv, RB(1.66, 0.95, 0.04, 0.008, 2), IM.black, 0, 0, 0);
  put(tv, quad(1.62, 0.91), IM.tv, 0, 0, 0.0205);
  S.extra.tvScreen = IM.tv;
  // rug, sofa (back to the partition), cushions, throw
  put(root, RB(2.7, 0.012, 3.1, 0.006, 1), IM.rug, 6.1, F + 0.006, 1.5);
  const sx = 7.9, sz = 1.5;
  const so = sofa(root, sx, F, sz, -PI / 2, { w: 2.5, fabric: IM.fabGray, legs: IM.walnut, pillows: [0xd4a043, 0x5f8a6a, 0xf1ece4] });
  void so;
  put(root, softBox(0.7, 0.03, 0.34, 0.012, 0.004, 0.006, 4), IM.fabBeige, sx + 0.02, F + 0.66, sz + 1.02, 0, 0, 0);
  box3(S, sx - 0.46, F, sz - 1.27, sx + 0.46, F + 0.8, sz + 1.27);
  // coffee table + things
  const ctg = group(root, 6.35, F, 1.5);
  put(ctg, RB(0.7, 0.045, 1.2, 0.02, 2), IM.oak, 0, 0.4, 0);
  put(ctg, RB(0.62, 0.025, 1.1, 0.01, 1), IM.oak, 0, 0.12, 0);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(ctg, RB(0.045, 0.4, 0.045, 0.008, 1), IM.walnut, a * 0.3, 0.2, b * 0.54);
  mug(ctg, 0.12, 0.4225, 0.28, 0xc4553e, 1.2);
  V(ctg, RB(0.05, 0.016, 0.17, 0.006, 1), 0x222326, -0.1, 0.43, -0.05, 0, 0.5, 0);
  V(ctg, CY(0.16, 0.11, 0.06, 20), 0xf2efe8, 0.05, 0.45, -0.32, 0, 0, 0, vg);
  for (let i = 0; i < 5; i++) V(ctg, SP(0.04, 10, 8), [0xd9534f, 0xf2c14e, 0xe0752d][i % 3], 0.05 + Math.cos(i * 1.3) * 0.06, 0.5, -0.32 + Math.sin(i * 1.3) * 0.06);
  for (let i = 0; i < 3; i++) V(ctg, RB(0.2, 0.025, 0.27, 0.004, 1), [0x3d6aa8, 0xe7b851, 0xc4553e][i], -0.05, 0.155 + i * 0.026, 0.2, 0, 0.1 * i, 0);
  box3(S, 6.0, F, 0.9, 6.7, F + 0.44, 2.1);
  // standing aircon in the corner, floor lamp, plants, wall art, curtains
  const ac = group(root, 8.15, F, -0.08, 0);
  V(ac, RB(0.38, 1.75, 0.3, 0.05, 2), 0xf4f4f2, 0, 0.875, 0, 0, 0, 0, vg);
  V(ac, RB(0.3, 0.5, 0.01, 0.01, 1), 0x2a2d31, 0, 1.4, 0.152);
  for (let i = 0; i < 6; i++) V(ac, box(0.28, 0.008, 0.01), 0xc9ccd0, 0, 0.5 + i * 0.07, 0.153);
  D(ac, CY(0.012, 0.012, 0.004, 8), IM.lamp, 0.1, 1.2, 0.152, PI / 2, 0, 0);
  box3(S, 7.95, F, -0.26, 8.35, F + 1.75, 0.1);
  const fl = group(root, 7.95, F, 3.0);
  put(fl, CY(0.15, 0.16, 0.03, 24), IM.dark, 0, 0.015, 0);
  rod(fl, IM.dark, [0, 0.03, 0], [0, 1.45, 0], 0.012);
  put(fl, CY(0.16, 0.2, 0.28, 24, true), IM.linen, 0, 1.52, 0);
  noShadow(put(fl, SP(0.05, 10, 8), IM.lamp, 0, 1.47, 0));
  box3(S, 7.75, F, 2.8, 8.15, F + 1.7, 3.2);
  pottedPlant(root, 3.3, F, 2.95, { kind: 'fig', h: 1.6, seed: 2, pot: 'white', potR: 0.22, potH: 0.42 });
  box3(S, 3.05, F, 2.7, 3.55, F + 0.5, 3.2);
  pottedPlant(root, 5.3, F, 3.05, { kind: 'palm', h: 0.9, seed: 8, pot: 'terracotta', potR: 0.17, potH: 0.34 });
  put(root, RB(1.04, 0.79, 0.03, 0.01, 1), IM.walnut, 8.42, F + 1.55, 1.5, 0, PI / 2, 0);
  D(root, A.quad('art', 0.98, 0.73), A.mat, 8.4, F + 1.55, 1.5, 0, -PI / 2, 0);
  slab(root, IM.white, 2.6, C - 0.18, 3.08, 8.44, C, 3.4);                         // curtain box
  for (const [x, s2] of [[2.95, 1], [7.85, 2], [8.85, 3], [12.2, 4]]) curtainPanel(root, IM.linen, x, C - 0.2, F + 0.02, 3.18, 0.62, s2);
  ceilingDisc(root, IM, 5.5, C, 1.5, 0.3);
  for (const [x, z] of [[3.6, 0.2], [3.6, 2.8], [7.4, 0.2], [7.4, 2.8]]) D(root, CY(0.05, 0.05, 0.01, 12), M.down, x, C - 0.006, z);
  S.lamps.push({ pos: [5.5, C - 0.3, 1.5], color: 0xffe2b8, intensity: 14, range: 8 });
  S.interactables.push({ id: 'tv', label: 'TV 보기', pos: [sx - 0.5, F + 0.9, sz], radius: 1.6, seat: { pos: [sx - 0.1, F + 1.12, sz], yaw: PI / 2, pitch: -0.04 }, screen: { center: [2.6805, F + 1.35, 1.5], w: 1.62, h: 0.91, yaw: -PI / 2 } });

  // ================= kitchen + dining (x 4.52..8.44, z -6.0..-0.4)
  // fridge in the back-west corner
  const fg = group(root, 5.0, F, -5.6, 0);
  put(fg, RB(0.9, 1.85, 0.74, 0.02, 2), IM.steel, 0, 0.925, 0);
  put(fg, box(0.006, 1.8, 0.01), IM.dark, 0, 0.93, 0.371);
  for (const s2 of [-1, 1]) put(fg, RB(0.025, 0.5, 0.04, 0.01, 1), IM.chrome, s2 * 0.04, 1.15, 0.39);
  D(fg, A.quad('draw', 0.22, 0.22), A.mat, -0.22, 1.32, 0.372);
  D(fg, A.quad('photo1', 0.14, 0.105), A.mat, 0.25, 1.45, 0.372);
  for (const [x, y, c] of [[-0.22, 1.45, 0xe8546b], [0.25, 1.52, 0x3d9be9], [0.2, 0.95, 0xf2c14e]]) V(fg, CY(0.018, 0.018, 0.012, 10), c, x, y, 0.378, PI / 2, 0, 0, vg);
  cabinetRun(root, 5.0, F + 1.88, -5.62, 0, 0.9, C - F - 1.9, 0.6, 2, IM.white, IM.white, null);
  box3(S, 4.55, F, IZ0, 5.45, F + 1.85, -5.23);
  // base run with marble top, sink under the window, cooktop + hood near the partition
  cabinetRun(root, 6.95, F, -5.7, 0, 2.9, 0.86, 0.6, 5, IM.white, IM.oak, IM.dark, { kick: 0.08, hw: 0.2, hh: 0.016, hy: 0.78 });
  put(root, RB(2.92, 0.04, 0.62, 0.008, 2), IM.marble, 6.95, F + 0.88, -5.69);
  box3(S, 5.5, F, IZ0, 8.44, F + 0.9, -5.38);
  put(root, RB(0.7, 0.012, 0.42, 0.006, 1), IM.steel, 6.8, F + 0.903, -5.7);
  put(root, box(0.62, 0.012, 0.34), IM.dark, 6.8, F + 0.906, -5.7);
  rod(root, IM.chrome, [6.8, F + 0.9, -5.94], [6.8, F + 1.2, -5.94], 0.016, 12);
  rod(root, IM.chrome, [6.8, F + 1.2, -5.94], [6.8, F + 1.17, -5.76], 0.012, 10);
  put(root, RB(0.6, 0.012, 0.5, 0.006, 1), IM.black, 7.95, F + 0.905, -5.7);
  for (const [dx, dz] of [[-0.14, -0.1], [0.14, 0.1], [-0.14, 0.12], [0.14, -0.12]]) put(root, torus(0.07, 0.004, 4, 20), IM.dark, 7.95 + dx, F + 0.913, -5.7 + dz, PI / 2, 0, 0);
  const pan = group(root, 7.81, F + 0.915, -5.6, 0.4);
  put(pan, CY(0.13, 0.12, 0.05, 20, true), IM.dark, 0, 0.03, 0);
  put(pan, CY(0.12, 0.12, 0.006, 20), IM.dark, 0, 0.006, 0);
  rod(pan, IM.walnut, [0.13, 0.05, 0], [0.34, 0.07, 0], 0.012, 8);
  put(root, RB(0.66, 0.2, 0.5, 0.02, 2), IM.steel, 7.95, F + 1.72, -5.73);
  put(root, RB(0.3, C - F - 1.82, 0.3, 0.01, 1), IM.steel, 7.95, (F + 1.82 + C) / 2, -5.85);
  noShadow(put(root, box(0.4, 0.004, 0.06), IM.lamp, 7.95, F + 1.618, -5.6));
  cabinetRun(root, 5.74, F + 1.5, -5.83, 0, 0.48, C - F - 1.52, 0.34, 1, IM.white, IM.white, IM.dark, { hw: 0.016, hh: 0.16, hy: 0.12 });
  // backsplash tile around the window
  wallX(root, IM.wallTile, 5.5, 8.44, IZ0, IZ0 + 0.012, F + 0.9, F + 1.5, [{ a: 6.0, b: 7.6, lo: F + 1.05, hi: F + 2.25 }]);
  // counter life: rice cooker, kettle, dish rack, board, bottles, window herbs
  const rc = group(root, 5.85, F + 0.9, -5.72, 0.3);
  V(rc, lathe([[0, 0], [0.15, 0], [0.16, 0.02], [0.16, 0.2], [0.13, 0.25], [0, 0.26]], 24), 0xf3f1ec, 0, 0, 0, 0, 0, 0, vg);
  V(rc, box(0.1, 0.05, 0.02), 0x2b2f33, 0, 0.12, 0.155);
  V(rc, RB(0.12, 0.03, 0.05, 0.01, 1), 0xc4553e, 0, 0.255, 0.06);
  const kt = group(root, 7.45, F + 0.9, -5.8, -0.6);
  V(kt, lathe([[0, 0], [0.08, 0], [0.09, 0.1], [0.07, 0.19], [0.03, 0.21], [0, 0.21]], 20), 0xd9dcdf, 0, 0, 0, 0, 0, 0, vg);
  V(kt, torus(0.06, 0.01, 6, 14, PI), 0x2b2f33, -0.07, 0.15, 0, 0, 0, PI / 2);
  const dr = group(root, 6.25, F + 0.9, -5.66, 0);
  V(dr, RB(0.4, 0.03, 0.3, 0.008, 1), 0xd9dcdf, 0, 0.015, 0);
  for (let i = 0; i < 4; i++) V(dr, CY(0.1, 0.1, 0.012, 20), [0xf6f3ec, 0xf6f3ec, 0x86a0b8, 0xf6f3ec][i], -0.12 + i * 0.07, 0.12, 0, 0, 0, PI / 2 - 0.12, vg);
  V(root, RB(0.35, 0.02, 0.24, 0.006, 1), 0xc09060, 7.2, F + 0.91, -5.62, 0, 0.2, 0);
  for (const [x, c] of [[5.6, 0xc8a24a], [5.68, 0x3a5a2a]]) V(root, lathe([[0, 0], [0.03, 0], [0.03, 0.17], [0.012, 0.21], [0.012, 0.25], [0, 0.25]], 12), c, x, F + 0.9, -5.9, 0, 0, 0, vg);
  for (const x of [6.4, 6.8, 7.2]) pottedPlant(root, x, F + 1.05, -5.94, { kind: 'herb', h: 0.2, potR: 0.05, potH: 0.08, seed: (x * 10) | 0, pot: 'terracotta' });
  // calendar, clock, recycling bins by the utility door
  D(root, A.quad('cal', 0.3, 0.38), A.mat, 4.525, F + 1.55, -4.6, 0, PI / 2, 0);
  const ck = group(root, 4.53, F + 1.95, -3.9, PI / 2);
  put(ck, CY(0.15, 0.15, 0.035, 28), IM.dark, 0, 0, 0.018, PI / 2, 0, 0);
  V(ck, CY(0.13, 0.13, 0.004, 28), 0xfbfbf9, 0, 0, 0.037, PI / 2, 0, 0);
  V(ck, box(0.012, 0.09, 0.004), 0x26272b, 0.02, 0.03, 0.04, 0, 0, -0.6);
  V(ck, box(0.01, 0.06, 0.004), 0x26272b, -0.02, 0.01, 0.041, 0, 0, 1.1);
  staticDoor(root, 4.52, F, -3.3, PI / 2, { w: 0.85, h: 2.1, leaf: IM.white, frame: IM.white });
  for (let i = 0; i < 3; i++) { V(root, RB(0.26, 0.42, 0.3, 0.02, 1), [0x4f7391, 0xf2c14e, 0x5f8a6a][i], 4.72, F + 0.21, -4.95 + i * 0.29); }
  box3(S, 4.52, F, -5.1, 4.88, F + 0.45, -4.2);
  // dining table, chairs, pendant, breakfast
  const tx = 6.45, tz = -2.85, tw = 1.6, td = 0.9, th = F + 0.75;
  const tg = group(root, tx, F, tz);
  put(tg, RB(tw, 0.045, td, 0.012, 2), IM.oak, 0, 0.7275, 0);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(tg, RB(0.05, 0.705, 0.05, 0.01, 1), IM.oak, a * (tw / 2 - 0.12), 0.3525, b * (td / 2 - 0.1));
  box3(S, tx - tw / 2, F, tz - td / 2, tx + tw / 2, th, tz + td / 2);
  for (const [cx, side] of [[-0.4, 1], [0.4, 1], [-0.4, -1], [0.4, -1]]) {
    const ch = group(root, tx + cx, F, tz + side * (cx < 0 && side > 0 ? 0.72 : 0.62), side > 0 ? PI : 0);
    chairGeo(ch, IM.oak, IM.fabBeige);
    const p = ch.position; box3(S, p.x - 0.22, F, p.z - 0.22, p.x + 0.22, F + 0.5, p.z + 0.22);
  }
  for (const [x, z] of [[-0.4, 0.24], [0.4, -0.24]]) V(tg, RB(0.42, 0.004, 0.3, 0.002, 1), 0xb9a88c, x, 0.752, z);
  V(tg, lathe([[0, 0], [0.04, 0], [0.05, 0.05], [0.03, 0.14], [0.02, 0.18], [0, 0.18]], 16), 0x86a0b8, 0.15, 0.75, 0.0, 0, 0, 0, vg);
  for (let i = 0; i < 5; i++) { const a = i * 1.26; vrod(tg, 0x5f8a3a, [0.15, 0.85, 0], [0.15 + Math.cos(a) * 0.07, 1.02 + (i % 2) * 0.04, Math.sin(a) * 0.05], 0.003, 4); V(tg, SP(0.025, 8, 6), [0xf4f1ea, 0xf7c548, 0xe8546b][i % 3], 0.15 + Math.cos(a) * 0.07, 1.02 + (i % 2) * 0.04, Math.sin(a) * 0.05); }
  pendant(root, tx, F + 1.85, tz, C, { r: 0.24, shade: 0x2f4f4f });
  S.lamps.push({ pos: [tx, F + 1.75, tz], color: 0xffd9a8, intensity: 10, range: 6 });
  ceilingDisc(root, IM, 6.6, C, -4.9, 0.2);
  S.lamps.push({ pos: [6.6, C - 0.3, -4.9], color: 0xfff0d8, intensity: 10, range: 6 });
  // Korean breakfast (dynamic: the game hides it after eating)
  const food = new THREE.Group();
  food.userData.dynamic = true;
  food.position.set(tx - 0.4, th + 0.005, tz + 0.22);
  root.add(food);
  const bowl = (x, z, r, hgt, col, fill, fillY) => { V(food, lathe([[0, 0], [r * 0.55, 0], [r * 0.95, hgt * 0.6], [r, hgt], [r * 0.93, hgt], [r * 0.85, hgt * 0.6], [0, hgt * 0.15]], 20), col, x, 0, z, 0, 0, 0, vg); if (fill != null) V(food, CY(r * 0.9, r * 0.9, 0.006, 18), fill, x, fillY ?? hgt * 0.8, z, 0, 0, 0, vg); };
  bowl(-0.08, 0.06, 0.065, 0.07, 0xf3f1ec, null);
  V(food, SP(0.058, 14, 10, ), 0xfbfaf4, -0.08, 0.06, 0.06).scale.set(1, 0.55, 1);
  bowl(0.08, 0.06, 0.07, 0.065, 0x6b4529, 0xc8803c, 0.052);
  for (const [x, c] of [[-0.12, 0xc8402e], [0.0, 0x4f8a3a], [0.12, 0xf2c14e]]) { bowl(x, -0.08, 0.045, 0.025, 0xf3f1ec, null); for (let i = 0; i < 4; i++) V(food, RB(0.025, 0.012, 0.018, 0.004, 1), c, x + Math.cos(i * 1.6) * 0.015, 0.024, -0.08 + Math.sin(i * 1.6) * 0.015, 0, i, 0); }
  V(food, RB(0.012, 0.004, 0.2, 0.002, 1), 0xd8d8d8, 0.17, 0.004, 0.03, 0, 0, 0, vg);
  V(food, RB(0.006, 0.004, 0.21, 0.002, 1), 0xd8d8d8, 0.19, 0.004, 0.03, 0, 0, 0, vg);
  V(food, RB(0.006, 0.004, 0.21, 0.002, 1), 0xd8d8d8, 0.2, 0.004, 0.03, 0, 0, 0, vg);
  const eg = group(food, -0.22, 0, -0.02);
  V(eg, lathe([[0, 0], [0.05, 0], [0.075, 0.01], [0.08, 0.014], [0.072, 0.014], [0.05, 0.005], [0, 0.005]], 20), 0xf3f1ec, 0, 0, 0, 0, 0, 0, vg);
  V(eg, CY(0.05, 0.052, 0.006, 20), 0xfbf8f0, 0, 0.014, 0, 0, 0, 0, vg);
  V(eg, SP(0.018, 12, 8), 0xf6b21b, 0.01, 0.016, 0.005, 0, 0, 0, vg).scale.set(1, 0.5, 1);
  noShadow(put(food, lathe([[0, 0], [0.032, 0], [0.036, 0.12], [0.033, 0.12], [0.029, 0.006], [0, 0.006]], 18), IM.glass, 0.24, 0, -0.1));
  V(food, CY(0.029, 0.03, 0.09, 16), 0xf8f6f0, 0.24, 0.05, -0.1, 0, 0, 0, vg);
  bake(food);
  S.extra.breakfastFood = food;
  S.interactables.push({ id: 'breakfast', label: '아침 먹기', pos: [tx - 0.4, th + 0.2, tz + 0.3], radius: 1.3, seat: { pos: [tx - 0.4, F + 1.18, tz + 0.75], yaw: 0, pitch: -0.5 } });
  S.interactables.push({ id: 'fridge', label: '간식 먹기', pos: [5.0, F + 1.3, -4.95], radius: 1.3 });

  // ================= bathroom (x 8.56..12.6, z -6.0..-3.2)
  wallZ(root, IM.wallTile, IZ0, -3.2, 8.56, 8.572, F, C, [{ a: -4.6, b: -3.7, lo: F, hi: F + 2.1 }]);
  slab(root, IM.wallTile, 8.56, F, -3.212, IX, C, -3.2);
  slab(root, IM.wallTile, IX - 0.012, F, IZ0, IX, C, -3.2);
  wallX(root, IM.wallTile, 8.56, IX, IZ0, IZ0 + 0.012, F, C, [{ a: 10.0, b: 11.0, lo: F + 1.4, hi: F + 2.2 }]);
  // vanity on the bedroom partition (faces -Z), mirror cabinet, basin, faucet, cup, soap
  const vx = 10.0, vz = -3.2 - 0.27;
  const vgp = group(root, vx, F, vz, PI);
  put(vgp, RB(1.2, 0.6, 0.5, 0.01, 2), IM.walnut, 0, 0.42, 0);
  for (const s2 of [-1, 1]) put(vgp, RB(0.59, 0.56, 0.02, 0.006, 1), IM.walnut, s2 * 0.3, 0.42, 0.25);
  put(vgp, RB(1.22, 0.04, 0.54, 0.008, 2), IM.marble, 0, 0.74, 0);
  put(vgp, lathe([[0, 0], [0.12, 0], [0.18, 0.04], [0.215, 0.1], [0.22, 0.13], [0.205, 0.13], [0.195, 0.1], [0.165, 0.05], [0.1, 0.02], [0, 0.02]], 28), IM.ceramic, 0, 0.76, 0.03).scale.set(1.1, 1, 0.9);
  rod(vgp, IM.chrome, [0, 0.76, -0.18], [0, 1.0, -0.18], 0.016, 12);
  rod(vgp, IM.chrome, [0, 1.0, -0.18], [0, 0.98, -0.04], 0.012, 10);
  V(vgp, CY(0.035, 0.03, 0.1, 14), 0xb8d8d0, -0.42, 0.81, -0.1, 0, 0, 0, vg);
  vrod(vgp, 0x3d9be9, [-0.42, 0.8, -0.1], [-0.4, 0.98, -0.11], 0.006); vrod(vgp, 0xff7a8a, [-0.43, 0.8, -0.1], [-0.46, 0.97, -0.08], 0.006);
  V(vgp, lathe([[0, 0], [0.035, 0], [0.035, 0.12], [0.012, 0.135], [0.012, 0.16], [0, 0.16]], 14), 0xf2efe8, 0.42, 0.76, -0.1, 0, 0, 0, vg);
  put(vgp, RB(0.9, 0.72, 0.13, 0.01, 2), IM.walnut, 0, 1.55, -0.2);
  D(vgp, quad(0.86, 0.68), IM.mirror, 0, 1.55, -0.133);
  noShadow(put(vgp, RB(0.7, 0.025, 0.04, 0.01, 1), IM.lamp, 0, 1.93, -0.17));
  box3(S, vx - 0.6, F, -3.75, vx + 0.6, F + 0.8, -3.2);
  S.interactables.push({ id: 'sink', label: '세수하기', pos: [vx, F + 1.0, -3.85], radius: 1.2 });
  // shower booth in the north-east corner
  const sx0 = 11.4, sz0 = -4.6;
  put(root, RB(IX - sx0, 0.06, -3.2 - sz0, 0.015, 2), IM.ceramic, (sx0 + IX) / 2, F + 0.03, (sz0 - 3.2) / 2);
  noShadow(slab(root, IM.glass, sx0, F + 0.06, sz0, sx0 + 0.01, F + 2.06, -3.2));
  noShadow(slab(root, IM.glass, sx0, F + 0.06, sz0, IX, F + 2.06, sz0 + 0.01));
  rod(root, IM.chrome, [sx0, F + 2.06, sz0], [sx0, F + 2.06, -3.2], 0.012);
  rod(root, IM.chrome, [sx0, F + 2.06, sz0], [IX, F + 2.06, sz0], 0.012);
  rod(root, IM.chrome, [sx0, F + 0.06, sz0], [sx0, F + 2.06, sz0], 0.012);
  rod(root, IM.chrome, [IX, F + 2.05, -3.9], [IX - 0.32, F + 2.08, -3.9], 0.012);
  put(root, CY(0.11, 0.11, 0.015, 24), IM.chrome, IX - 0.34, F + 2.065, -3.9);
  rod(root, IM.chrome, [IX - 0.03, F + 1.0, -3.9], [IX - 0.03, F + 2.05, -3.9], 0.012);
  put(root, RB(0.05, 0.16, 0.09, 0.015, 1), IM.chrome, IX - 0.025, F + 1.1, -3.9);
  [[0xf2c14e, 0.0], [0x7ac0a8, 0.1], [0xe86f8a, -0.1]].forEach(([c, dz], i) => V(root, lathe([[0, 0], [0.026, 0], [0.028, 0.15 - i * 0.02], [0.012, 0.165 - i * 0.02], [0, 0.17 - i * 0.02]], 12), c, IX - 0.06, F + 1.27, -3.55 + dz, 0, 0, 0, vg));
  put(root, RB(0.1, 0.02, 0.42, 0.004, 1), IM.marble, IX - 0.05, F + 1.26, -3.55);
  box3(S, sx0, F, sz0, IX, F + 2.1, -3.2);
  S.interactables.push({ id: 'shower', label: '씻기', pos: [11.05, F + 1.2, -3.95], radius: 1.3 });
  // toilet on the back wall facing +Z, paper, towels, basket, mat
  const tgp = group(root, 9.3, F, IZ0, 0);
  put(tgp, RB(0.42, 0.38, 0.18, 0.03, 3), IM.ceramic, 0, 0.62, 0.09);
  put(tgp, RB(0.44, 0.04, 0.2, 0.015, 2), IM.ceramic, 0, 0.82, 0.09);
  const bowlG = lathe([[0, 0], [0.12, 0], [0.16, 0.12], [0.19, 0.3], [0.2, 0.4], [0.17, 0.4], [0.15, 0.3], [0, 0.28]], 24); bowlG.scale(0.95, 1, 1.25);
  put(tgp, bowlG, IM.ceramic, 0, 0, 0.42);
  put(tgp, torus(0.165, 0.025, 8, 24), IM.ceramic, 0, 0.415, 0.42, PI / 2, 0, 0).scale.set(0.95, 1.25, 1);
  box3(S, 9.08, F, IZ0, 9.52, F + 0.8, -5.3);
  put(root, CY(0.055, 0.055, 0.1, 16), IM.whitePl, 9.85, F + 0.7, IZ0 + 0.08, 0, 0, PI / 2);
  rod(root, IM.chrome, [9.78, F + 0.75, IZ0], [9.78, F + 0.75, IZ0 + 0.1], 0.006);
  for (const s2 of [-1, 1]) rod(root, IM.chrome, [IX - 0.06, F + 0.35, -5.3 + s2 * 0.25], [IX - 0.06, F + 1.55, -5.3 + s2 * 0.25], 0.014);
  for (let i = 0; i < 6; i++) rod(root, IM.chrome, [IX - 0.06, F + 0.45 + i * 0.2, -5.55], [IX - 0.06, F + 0.45 + i * 0.2, -5.05], 0.009);
  V(root, softBox(0.05, 0.62, 0.46, 0.02, 0.0, 0.004, 2), 0x86aec4, IX - 0.1, F + 1.15, -5.3, 0, 0, 0, vcSoft());
  V(root, softBox(0.05, 0.34, 0.36, 0.02, 0.0, 0.004, 3), 0xf4f2ec, IX - 0.1, F + 0.7, -5.28, 0, 0, 0, vcSoft());
  box3(S, IX - 0.2, F, -5.6, IX, F + 1.6, -5.0);
  V(root, softBox(0.7, 0.02, 0.45, 0.008, 0.0, 0.002, 4), 0x86aec4, 10.9, F + 0.01, -4.25, 0, 0, 0, vcSoft());
  ceilingDisc(root, IM, 10.4, C, -4.6, 0.18);
  S.lamps.push({ pos: [10.4, C - 0.3, -4.6], color: 0xfff0d8, intensity: 9, range: 5 });

  // ================= bedroom (x 8.56..12.6, z -3.08..3.4)
  slab(root, IM.sage, IX - 0.012, F, -0.55, IX, C, 2.15);
  const bw = 1.6, bl = 2.1, bcx = IX - bl / 2 - 0.02, bcz = 0.8;
  const bg = group(root, bcx, F, bcz, -PI / 2);
  put(bg, RB(bw + 0.1, 0.24, bl - 0.08, 0.02, 2), IM.oak, 0, 0.2, 0.04);
  put(bg, softBox(1.72, 1.0, 0.12, 0.05, 0.02, 0.002, 2), IM.fabBeige, 0, 0.62, -bl / 2 + 0.07);
  put(bg, RB(bw, 0.24, bl - 0.16, 0.06, 3), IM.linen, 0, 0.44, 0.06);
  put(bg, softBox(bw + 0.1, 0.09, 1.45, 0.04, 0.03, 0.007, 5), IM.fabGreen, 0, 0.58, 0.36);
  for (const s2 of [-1, 1]) put(bg, softBox(0.05, 0.28, 1.42, 0.02, 0.0, 0.006, 6 + s2), IM.fabGreen, s2 * (bw / 2 + 0.06), 0.46, 0.36);
  put(bg, softBox(bw + 0.14, 0.28, 0.05, 0.02, 0.0, 0.006, 9), IM.fabGreen, 0, 0.46, 1.09);
  put(bg, softBox(bw + 0.06, 0.06, 0.3, 0.03, 0.01, 0.004, 3), IM.linen, 0, 0.6, -0.42);
  put(bg, softBox(0.62, 0.15, 0.4, 0.06, 0.05, 0.005, 1), IM.linen, -0.36, 0.66, -0.78).rotation.x = -0.35;
  put(bg, softBox(0.62, 0.15, 0.4, 0.06, 0.05, 0.005, 2), IM.linen, 0.36, 0.66, -0.78).rotation.x = -0.3;
  V(bg, softBox(0.36, 0.3, 0.28, 0.08, 0.04, 0.004, 3), 0xc8a27a, 0.1, 0.78, -0.55, -0.6, 0.2, 0, vcSoft());
  box3(S, bcx - bl / 2, F, bcz - bw / 2 - 0.06, IX, F + 0.66, bcz + bw / 2 + 0.06);
  for (const s2 of [-1, 1]) {
    const nz = bcz + s2 * (bw / 2 + 0.32), ng = group(root, IX - 0.25, F, nz, -PI / 2);
    put(ng, RB(0.46, 0.5, 0.42, 0.015, 2), IM.oak, 0, 0.29, 0);
    put(ng, RB(0.42, 0.18, 0.02, 0.006, 1), IM.oak, 0, 0.42, 0.21);
    put(ng, RB(0.42, 0.18, 0.02, 0.006, 1), IM.oak, 0, 0.22, 0.21);
    for (const y of [0.42, 0.22]) put(ng, SP(0.013, 8, 6), IM.dark, 0, y, 0.232);
    const lg = group(ng, 0, 0.54, -0.05);
    put(lg, lathe([[0, 0], [0.07, 0], [0.075, 0.02], [0.06, 0.12], [0.03, 0.2], [0.012, 0.22], [0, 0.22]], 20), IM.ceramic, 0, 0, 0);
    put(lg, CY(0.1, 0.13, 0.17, 24, true), IM.linen, 0, 0.3, 0);
    noShadow(put(lg, SP(0.04, 10, 8), IM.lamp, 0, 0.26, 0));
    if (s2 < 0) { V(ng, RB(0.075, 0.009, 0.155, 0.006, 1), 0x222326, 0.12, 0.545, 0.1, 0, 0.3, 0); V(ng, RB(0.16, 0.03, 0.22, 0.004, 1), 0x3d6aa8, -0.1, 0.555, 0.1, 0, 0.2, 0); }
    else { mug(ng, 0.13, 0.54, 0.1, 0xe7b851, 0.5); V(ng, RB(0.12, 0.08, 0.05, 0.015, 1), 0x6fbfae, -0.1, 0.58, 0.1, 0, 0, 0, vg); }
    box3(S, IX - 0.48, F, nz - 0.23, IX, F + 0.55, nz + 0.23);
  }
  put(root, RB(1.1, 0.75, 0.03, 0.01, 1), IM.oak, IX - 0.03, F + 1.6, bcz, 0, PI / 2, 0);
  D(root, A.quad('photo0', 1.0, 0.66), A.mat, IX - 0.047, F + 1.6, bcz, 0, -PI / 2, 0);
  put(root, RB(2.6, 0.012, 2.4, 0.005, 1), IM.rug2, 11.2, F + 0.006, 0.8);
  // built-in wardrobe on the partition (faces +Z)
  const wx = 10.75, ww = 3.4, wd = 0.6, wh = 2.36;
  cabinetRun(root, wx, F, -3.08 + wd / 2, 0, ww, wh, wd, 4, IM.white, IM.white, IM.oak, { hw: 0.02, hh: 0.5, hy: 1.1 });
  for (let i = 1; i < 4; i++) put(root, box(0.006, wh - 0.04, 0.012), IM.dark, wx - ww / 2 + ww * i / 4, F + wh / 2, -3.08 + wd + 0.002);
  box3(S, wx - ww / 2, F, -3.08, wx + ww / 2, F + wh, -3.08 + wd);
  S.interactables.push({ id: 'wardrobe', label: '옷 입기', pos: [wx, F + 1.3, -3.08 + wd + 0.25], radius: 1.5 });
  // desk against the partition (faces +X) with chair, laptop, lamp, books
  const dg = group(root, 8.56 + 0.3, F, 1.4, PI / 2);
  put(dg, RB(1.3, 0.035, 0.6, 0.008, 2), IM.oak, 0, 0.74, 0);
  for (const s2 of [-1, 1]) put(dg, RB(0.035, 0.72, 0.56, 0.006, 1), IM.white, s2 * 0.62, 0.36, 0);
  for (let i = 0; i < 9; i++) V(dg, box(0.03, 0.2 + (i % 3) * 0.03, 0.16), [0x3d6aa8, 0xc4553e, 0xe7b851, 0x86a08a, 0x8a5a7a][i % 5], -0.6 + i * 0.033, 0.857 + (i % 3) * 0.015, -0.18);
  const lap = group(dg, 0.0, 0.7575, 0.05, 0);
  V(lap, RB(0.34, 0.015, 0.24, 0.006, 1), 0xb0b4ba, 0, 0.0075, 0, 0, 0, 0, vg);
  const lid = V(lap, RB(0.34, 0.24, 0.012, 0.006, 1), 0xb0b4ba, 0, 0.12, -0.12, 0, 0, 0, vg); lid.rotation.x = -0.25;
  mug(dg, 0.35, 0.7575, 0.15, 0xf2efe8, 1);
  const dl = group(dg, 0.48, 0.7575, -0.18);
  put(dl, CY(0.07, 0.075, 0.02, 20), IM.dark, 0, 0.01, 0);
  rod(dl, IM.dark, [0, 0.02, 0], [0.02, 0.36, 0.05], 0.008);
  rod(dl, IM.dark, [0.02, 0.36, 0.05], [-0.08, 0.42, 0.18], 0.008);
  put(dl, CY(0.03, 0.075, 0.1, 18, true), IM.dark, -0.09, 0.4, 0.2, 0.7, 0, 0);
  noShadow(put(dl, SP(0.025, 8, 6), IM.lamp, -0.09, 0.38, 0.2));
  box3(S, 8.56, F, 0.75, 9.2, F + 0.78, 2.05);
  officeChair(root, 9.45, F, 1.35, -PI / 2 + 0.3, { jacket: 0x3b4f73 });
  box3(S, 9.2, F, 1.1, 9.7, F + 0.5, 1.6);
  const bp = group(root, 9.0, F, 2.55, 0.6);
  V(bp, softBox(0.3, 0.4, 0.17, 0.06, 0.02, 0.006, 2), 0xd9534f, 0, 0.2, 0, 0, 0, 0, vcSoft());
  V(bp, softBox(0.22, 0.16, 0.05, 0.03, 0.01, 0.004, 3), 0xb84540, 0, 0.14, 0.1, 0, 0, 0, vcSoft());
  for (const [x, z, r] of [[10.15, -0.35, 1.9], [10.2, -0.1, 1.6]]) { const g = group(root, x, F, z, r); V(g, RB(0.1, 0.025, 0.26, 0.012, 2), 0x8fa9c9, 0, 0.0125, 0, 0, 0, 0, vcSoft()); }
  ceilingDisc(root, IM, 10.6, C, 0.2, 0.26);
  S.lamps.push({ pos: [10.6, C - 0.3, 0.2], color: 0xffe2b8, intensity: 12, range: 7 });
  S.interactables.push({ id: 'bed', label: '잠자기', pos: [10.9, F + 0.75, -0.25], radius: 1.6, seat: { pos: [IX - 0.5, F + 0.95, bcz], yaw: PI / 2, pitch: 0.55 } });

  // ================= bookkeeping
  S.spawn = { pos: [10.9, F, -0.95], yaw: 2.3 };
  S.indoor.push({ min: [-CW, F, IZ0], max: [IX, C + 0.1, IZ1] });
  S.extra.floorY = F;
  S.extra.unit = { name: '802호', min: [2.6, F, IZ0], max: [IX, C, IZ1] };
}
function ceilingDisc(root, IM, x, C, z, r) {
  put(root, CY(r, r * 0.94, 0.05, 28), IM.whitePl, x, C - 0.025, z);
  noShadow(put(root, CY(r * 0.86, r * 0.86, 0.012, 28), IM.lamp, x, C - 0.052, z));
}
function sofa(parent, x, y, z, ry, o = {}) {
  const { w = 2.2, fabric = mat('fabricBeige'), legs = mat('walnut'), pillows = [0x2f6f73, 0xe0b25a, 0xf1ece4] } = o;
  const g = group(parent, x, y, z, ry);
  put(g, RB(w, 0.24, 0.9, 0.04, 2), fabric, 0, 0.24, 0);
  const n = 3, cw = (w - 0.36) / n;
  for (let i = 0; i < n; i++) {
    const cx = -w / 2 + 0.18 + cw * (i + 0.5);
    put(g, softBox(cw - 0.015, 0.15, 0.66, 0.06, 0.03, 0.004, i), fabric, cx, 0.43, 0.08);
    const b = group(g, cx, 0.66, -0.27, 0); b.rotation.x = -0.18;
    put(b, softBox(cw - 0.02, 0.44, 0.2, 0.08, 0.02, 0.004, i + 4), fabric, 0, 0, 0);
  }
  put(g, RB(w, 0.62, 0.18, 0.05, 2), fabric, 0, 0.55, -0.36);
  for (const s of [-1, 1]) put(g, softBox(0.18, 0.62, 0.9, 0.06, 0.0, 0.003, 3 + s), fabric, s * (w / 2 - 0.09), 0.42, 0);
  for (const s of [-1, 1]) for (const t of [-1, 1]) put(g, CY(0.02, 0.015, 0.12, 10), legs, s * (w / 2 - 0.12), 0.06, t * 0.35);
  pillows.forEach((c, i) => V(g, softBox(0.42, 0.42, 0.13, 0.08, 0.03, 0.004, i), c, (i - 1) * (w * 0.3), 0.72, -0.14, -0.25, (i - 1) * 0.15, (i - 1) * 0.1, vcSoft()));
  return g;
}

function buildInterior(S, root, T) {
  const IM = intMats();
  buildLobby(S, root, T, IM);
  buildHall(S, root, T, IM);
  if (typeof buildUnit === 'function') buildUnit(S, root, T, IM);
  S.extra.elevator = { landings: [
    { name: '1층 로비', pos: [0, F0, LZ], yaw: 0 },
    { name: '8층 우리 집', pos: [0, FLR(ME), LZ], yaw: 0 },
  ] };
}

// ------------------------------------------------------------------ neighbour towers (102~109동)
// main = false: the ground lobby is walkable (auto glass doors, mailboxes, guard desk, lift) and the lift
// also stops at one upper corridor (5층) whose four unit doors stay locked. Lift portals, floor slabs,
// shell walls and all shell colliders are in the base site (the game builds the lift car at load); the
// furniture, finishes, lights and people come from site.extra.interior.build().
const NBK = 4;                                         // floor index of the corridor (5층)
const nbK = (floors) => Math.min(NBK, floors - 1);
const NB_DOORS = [{ s: -1, z: -1.9, n: 1 }, { s: -1, z: 0.75, n: 2 }, { s: 1, z: -1.9, n: 3 }, { s: 1, z: 0.75, n: 4 }];
const LOCKED = '남의 집이에요 (잠겨 있음)';
const drawCall = (c) => { c.fillStyle = '#1d2024'; c.fillRect(0, 0, 96, 192); for (const [y, up] of [[60, 1], [132, 0]]) { c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(48, y, 26, 0, PI * 2); c.fill(); c.fillStyle = '#5a4210'; c.beginPath(); if (up) { c.moveTo(48, y - 12); c.lineTo(60, y + 8); c.lineTo(36, y + 8); } else { c.moveTo(48, y + 12); c.lineTo(60, y - 8); c.lineTo(36, y - 8); } c.fill(); } };
const drawInd = (n) => (c, w, h) => { c.fillStyle = '#0d0f12'; c.fillRect(0, 0, w, h); txt(c, n, 120, 60, 58, '#ff9a3c', 'center'); c.fillStyle = '#ff9a3c'; c.beginPath(); c.moveTo(40, 18); c.lineTo(56, 40); c.lineTo(24, 40); c.fill(); };
/** Signs for a neighbour tower's corridor floor `fl` (also the house clock, bath sign and drawings). */
function nbAtlas(fl) {
  return cached('aptNbAtlas' + fl, () => {
    const A = new Atlas(1024, 6);
    A.add('call', 96, 192, drawCall);
    A.add('ind1', 192, 72, drawInd('1'));
    A.add('indN', 192, 72, drawInd(String(fl)));
    A.add('fN', 256, 256, (c, w, h) => { c.fillStyle = '#f2efe8'; c.fillRect(0, 0, w, h); txt(c, String(fl), 118, 200, 210, '#4f7391', 'center'); txt(c, '층', 214, 214, 54, '#4f7391', 'center'); c.fillStyle = '#f2a65a'; c.fillRect(24, 224, 208, 10); });
    for (let i = 1; i <= 4; i++) A.add('p' + i, 256, 96, (c, w, h) => { rr(c, 0, 0, w, h, 10, '#2d3238'); txt(c, `${fl}0${i}호`, w / 2, 66, 50, '#f2e6c8', 'center'); });
    A.add('parcel', 200, 140, (c, w, h) => { c.fillStyle = '#c9a77a'; c.fillRect(0, 0, w, h); c.fillStyle = '#f4f1ea'; c.fillRect(20, 30, 160, 80); txt(c, `${fl}03호 택배`, 100, 70, 26, '#2b2f33', 'center'); c.fillStyle = '#2b2f33'; for (let i = 0; i < 14; i++) c.fillRect(34 + i * 9, 82, i % 3 ? 3 : 5, 20); });
    A.add('clock', 128, 128, (c) => {
      c.fillStyle = '#fbfaf5'; c.beginPath(); c.arc(64, 64, 62, 0, PI * 2); c.fill();
      c.strokeStyle = '#2b2f33'; c.lineCap = 'round';
      for (let i = 0; i < 12; i++) { const a = i * PI / 6, r0 = i % 3 ? 50 : 43; c.lineWidth = i % 3 ? 3 : 5; c.beginPath(); c.moveTo(64 + Math.sin(a) * r0, 64 - Math.cos(a) * r0); c.lineTo(64 + Math.sin(a) * 57, 64 - Math.cos(a) * 57); c.stroke(); }
      c.lineWidth = 6; c.beginPath(); c.moveTo(64, 64); c.lineTo(88, 52); c.stroke();
      c.lineWidth = 4; c.beginPath(); c.moveTo(64, 64); c.lineTo(57, 21); c.stroke();
      c.fillStyle = '#e8546b'; c.beginPath(); c.arc(64, 64, 5, 0, PI * 2); c.fill();
    });
    A.add('bath', 160, 160, (c, w, h) => {
      rr(c, 4, 4, w - 8, h - 8, 18, '#e9f1f4', '#8fb0c8', 4);
      txt(c, '욕실', w / 2, 52, 34, '#2b2f33', 'center');
      rr(c, 30, 92, 100, 32, 12, '#4f7391'); c.fillStyle = '#4f7391'; c.fillRect(42, 120, 8, 16); c.fillRect(110, 120, 8, 16);
      c.beginPath(); c.arc(62, 82, 11, 0, PI * 2); c.fill();
      for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(88 + i * 13, 80 - i * 7, 5, 0, PI * 2); c.fill(); }
    });
    A.add('kids', 256, 192, (c, w, h) => {
      c.fillStyle = '#fffdf6'; c.fillRect(0, 0, w, h); c.lineWidth = 7; c.lineCap = 'round';
      ['#e8546b', '#f2a65a', '#f2c14e', '#5f8a3a', '#4f7391'].forEach((col, i) => { c.strokeStyle = col; c.beginPath(); c.arc(128, 150, 100 - i * 9, PI, 0); c.stroke(); });
      c.fillStyle = '#7a5c3e'; c.beginPath(); c.arc(70, 150, 22, 0, PI * 2); c.fill();
      c.beginPath(); c.moveTo(52, 140); c.lineTo(55, 114); c.lineTo(68, 131); c.moveTo(88, 140); c.lineTo(85, 114); c.lineTo(72, 131); c.fill();
      txt(c, '우리 고양이', 176, 184, 22, '#2b2f33', 'center');
    });
    A.add('note', 128, 128, (c, w, h) => { c.fillStyle = '#fff3b0'; c.fillRect(0, 0, w, h); txt(c, '장보기', w / 2, 34, 24, '#c4553e', 'center'); for (const [i, s] of ['우유', '계란', '사과'].entries()) txt(c, '· ' + s, 22, 66 + i * 24, 20, '#2b2f33'); });
    A.build();
    A.mat = A.printed(0.6);
    A.glowM = A.lit(1.15);
    return A;
  });
}
function nbIM() {
  return {
    floorTile: mat('floorTile'), marble: mat('marble'), walnut: mat('walnut'), oak: mat('oak'), plasterW: mat('plasterWarm'),
    steel: mat('steel'), chrome: mat('chrome'), black: mat('blackPlastic'), whitePl: mat('whitePlastic'), lamp: mat('lampGlow'),
    rug2: mat('carpet'), dark: paint(0x2b2f33, 0.5, 0.3), door: paint(0x4e5357, 0.38, 0.35, { clearcoat: 0.4 }),
    door2: paint(0x6b5a4a, 0.42, 0.2, { clearcoat: 0.4 }), fire: paint(0x8a9096, 0.45, 0.5), red: paint(0xc8302a, 0.45, 0.1),
  };
}
/** Base part of a neighbour tower: lobby + corridor shells, both lift portals, entrance doors, colliders. */
function nbShell(S, root, M, TOP, floors) {
  const K = nbK(floors), FN = FLR(K), CN = FN + 2.6, C1 = F0 + 2.9;
  const IMb = { steel: mat('steel'), dark: paint(0x2b2f33, 0.5, 0.3), A: nbAtlas(K + 1) };
  // ---- ground lobby: floor, side walls, ceiling, lift portal
  slab(root, M.stone, -CW, F0 - 0.06, LW1, CW, F0 - 0.005, BZ1);
  box3(S, -CW, 0, LW0, CW, F0, BZ1);
  for (const s of [-1, 1]) slab(root, M.wall, s > 0 ? CW : -CW - 0.2, F0, LW1, s > 0 ? CW + 0.2 : -CW, C1, IZ1);
  slab(root, M.white, -CW, C1, LW1, CW, C1 + 0.1, IZ1);
  liftPortal(S, root, M, IMb, F0, C1, 'ind1');
  // sliding glass entrance doors (auto) and the fixed glass beside them
  for (const s of [-1, 1]) {
    const pv = group(root, s * 0.47, F0, 3.5, 0);
    pv.userData.dynamic = true;
    put(pv, RB(0.94, 0.08, 0.05, 0.01, 1), M.frame, 0, 2.16, 0);
    put(pv, RB(0.94, 0.1, 0.05, 0.01, 1), M.frame, 0, 0.05, 0);
    for (const t of [-1, 1]) put(pv, RB(0.05, 2.2, 0.05, 0.01, 1), M.frame, t * 0.445, 1.1, 0);
    D(pv, quad(0.86, 2.02), M.winGlass, 0, 1.11, 0);
    put(pv, RB(0.025, 0.7, 0.04, 0.01, 1), mat('chrome'), -s * 0.36, 1.05, 0.05);
    bake(pv);
    S.doors.push({ pivot: pv, slide: [s * 0.9, 0, 0], collider: { min: [s * 0.47 - 0.47, F0, 3.44], max: [s * 0.47 + 0.47, F0 + 2.2, 3.56] }, auto: true });
    box3(S, s > 0 ? 0.94 : -CW, F0, 3.42, s > 0 ? CW : -0.94, C1, 3.58);
  }
  // ---- upper floors: solid, except the corridor on floor K (x -CW..CW, z LW0..IZ1) and the lift pocket
  box3(S, -BX, 3.3, BZ0, BX, FN - 0.3, BAL);
  box3(S, -BX, FN + 2.7, BZ0, BX, TOP + 0.3, BAL);
  for (const s of [-1, 1]) box3(S, s > 0 ? CW : -BX, FN - 0.3, BZ0, s > 0 ? BX : -CW, FN + 2.7, BAL);
  box3(S, -CW, FN - 0.3, BZ0, CW, FN + 2.7, IZ0);
  box3(S, -CW, FN - 0.3, IZ1, CW, FN + 2.7, BAL);
  slab(root, M.conc, -CW, FN - 0.3, LW0, CW, FN - 0.005, IZ1);
  box3(S, -CW, FN - 0.3, LW0, CW, FN, IZ1);
  for (const s of [-1, 1]) slab(root, M.wall, s > 0 ? CW : -CW - 0.2, FN, LW1, s > 0 ? CW + 0.2 : -CW, CN + 0.1, IZ1);
  slab(root, M.white, -CW, CN, LW1, CW, CN + 0.1, IZ1);
  liftPortal(S, root, M, IMb, FN, CN + 0.1, 'indN');
}
/** Lazy part of a neighbour tower: lobby furniture + the corridor's doors and clutter. */
function nbInterior(T, floors, seed) {
  const P = { group: new THREE.Group(), colliders: [], interactables: [], npcSpots: [], lamps: [], indoor: [] };
  const K = nbK(floors), IM = nbIM(), IA = intAtlas(), NA = nbAtlas(K + 1);
  nbLobby(P, T.M, IM, IA, NA, seed % 2 ? 1 : -1, seed);
  nbHall(P, T.M, IM, IA, NA, K, seed);
  bake(P.group);
  return P;
}
function umbrellaStand(p, x, y, z) {
  const g = group(p, x, y, z, 0);
  V(g, CY(0.13, 0.12, 0.45, 18, true), 0x3b4047, 0, 0.225, 0);
  V(g, CY(0.12, 0.12, 0.012, 18), 0x2b2f33, 0, 0.02, 0);
  [[0x2f6fb7, 0.04, 0.03], [0xe8546b, -0.05, 0.02], [0x2b2f33, 0.0, -0.05]].forEach(([c, dx, dz], i) => {
    vrod(g, c, [dx, 0.05, dz], [dx * 2.2, 0.92 - i * 0.07, dz * 2.2], 0.03, 8);
    vrod(g, 0x6b4529, [dx * 2.2, 0.92 - i * 0.07, dz * 2.2], [dx * 2.6 + 0.04, 1.0 - i * 0.07, dz * 2.6], 0.011, 6);
  });
  return g;
}
function wallClock2(p, A, x, y, z, ry, r = 0.16) {
  const g = group(p, x, y, z, ry);
  V(g, CY(r, r, 0.04, 32), 0x2b2f33, 0, 0, 0.02, PI / 2, 0, 0);
  D(g, A.quad('clock', r * 1.84, r * 1.84), A.mat, 0, 0, 0.041);
  return g;
}
function nbLobby(P, M, IM, IA, NA, q, seed) {
  const g = P.group, F = F0, C = F0 + 2.9;
  const X = (x) => q * x, Y = (ry) => q * ry;
  const bx = (x0, y0, z0, x1, y1, z1) => box3(P, Math.min(q * x0, q * x1), y0, z0, Math.max(q * x0, q * x1), y1, z1);
  // floor tiles over the base slab, downlights
  slab(g, IM.floorTile, -CW, F - 0.004, LW1, CW, F, BZ1);
  for (const [x, z] of [[-1.2, 2.2], [1.2, 2.2], [-1.2, -0.4], [1.2, -0.4], [-1.2, -2.6], [1.2, -2.6]]) { D(g, CY(0.09, 0.09, 0.012, 16), M.down, x, C - 0.006, z); put(g, torus(0.1, 0.012, 6, 18), IM.steel, x, C - 0.004, z, PI / 2, 0, 0); }
  P.lamps.push({ pos: [0, C - 0.35, 1.6], color: 0xffe2b8, intensity: 10, range: 8 }, { pos: [0, C - 0.35, -2.2], color: 0xffe2b8, intensity: 10, range: 7 });
  // marble wainscot + walnut rail, warm plaster above
  for (const s of [-1, 1]) {
    const xi = s * CW;
    slab(g, IM.marble, s > 0 ? xi - 0.02 : xi, F, LW1, s > 0 ? xi : xi + 0.02, F + 1.15, IZ1 - 0.02);
    slab(g, IM.plasterW, s > 0 ? xi - 0.012 : xi, F + 1.15, LW1, s > 0 ? xi : xi + 0.012, C, IZ1);
    put(g, RB(0.03, 0.04, IZ1 - LW1 - 0.04, 0.008, 1), IM.walnut, xi - s * 0.025, F + 1.17, (LW1 + IZ1) / 2);
  }
  // lift wall clad in oak slats (gap for the call buttons), floor sign
  for (let x = -CW + 0.06; x < CW - 0.03; x += 0.09) if (Math.abs(x) > 0.82 && Math.abs(x - 0.9) > 0.14) put(g, RB(0.05, C - F - 0.02, 0.03, 0.006, 1), IM.oak, x, (F + C) / 2, LW1 + 0.015);
  put(g, RB(2 * CW, 0.06, 0.05, 0.01, 1), IM.walnut, 0, C - 0.03, LW1 + 0.025);
  D(g, IA.quad('f1', 0.42, 0.42), IA.mat, -1.45, F + 1.6, LW1 + 0.035);
  // mailboxes
  const mx = X(-CW + 0.18);
  put(g, RB(0.36, 1.58, 2.24, 0.012, 1), IM.steel, mx, F + 1.36, 1.9);
  D(g, IA.quad('mail', 2.16, 1.44), IA.mat, mx + q * 0.181, F + 1.36, 1.9, 0, Y(PI / 2), 0);
  put(g, RB(0.4, 0.08, 2.3, 0.01, 1), IM.dark, mx + q * 0.02, F + 0.53, 1.9);
  for (const [z, c] of [[1.2, 0xf3efe3], [2.4, 0xd8e6f0]]) V(g, RB(0.012, 0.12, 0.2, 0.003, 1), c, mx + q * 0.19, F + 1.0 + (z > 2 ? 0.58 : 0), z, 0, 0, q * 0.1);
  bx(-CW, F, 0.75, -CW + 0.4, F + 2.2, 3.05);
  // bench with a tote bag and a newspaper, stair door
  const bg = group(g, X(-CW + 0.3), F, -0.7, Y(PI / 2));
  put(bg, RB(1.5, 0.05, 0.42, 0.012, 2), IM.oak, 0, 0.45, 0);
  for (const s of [-1, 1]) put(bg, RB(0.05, 0.43, 0.38, 0.01, 1), IM.dark, s * 0.65, 0.215, 0);
  V(bg, softBox(0.36, 0.3, 0.14, 0.04, 0.02, 0.004, seed), [0xc4553e, 0x5f8a6a, 0xe0b25a][seed % 3], -0.4, 0.62, 0.02, 0, 0.2, 0, vcSoft());
  V(bg, RB(0.32, 0.012, 0.24, 0.003, 1), 0xe9e6dc, 0.35, 0.48, 0.0, 0, -0.3, 0);
  bx(-CW, F, -1.5, -CW + 0.55, F + 0.5, 0.1);
  staticDoor(g, X(-CW), F, -2.75, Y(PI / 2), { w: 0.95, h: 2.1, leaf: IM.fire, frame: IM.dark });
  D(g, IA.quad('stairs', 0.42, 0.16), IA.mat, X(-CW + 0.04), F + 2.42, -2.75, 0, Y(PI / 2), 0);
  // security desk, guard, chair, clock above
  const dg = group(g, X(1.55), F, 1.45, Y(-PI / 2));
  put(dg, RB(1.7, 1.06, 0.08, 0.015, 2), IM.walnut, 0, 0.53, 0.28);
  put(dg, RB(1.8, 0.05, 0.36, 0.012, 2), IM.marble, 0, 1.085, 0.22);
  put(dg, RB(1.7, 0.04, 0.62, 0.01, 1), IM.oak, 0, 0.74, -0.04);
  for (const s of [-1, 1]) put(dg, RB(0.06, 0.74, 0.6, 0.01, 1), IM.walnut, s * 0.82, 0.37, -0.04);
  D(dg, IA.quad('guard', 0.8, 0.2), IA.mat, 0, 0.78, 0.322);
  const mon = group(dg, -0.35, 0.76, -0.18, PI);
  put(mon, RB(0.5, 0.32, 0.03, 0.008, 1), IM.black, 0, 0.3, 0);
  D(mon, IA.quad('cctv', 0.46, 0.28), IA.glowM, 0, 0.3, -0.016, 0, PI, 0);
  put(mon, box(0.04, 0.14, 0.04), IM.black, 0, 0.08, 0.02);
  V(dg, RB(0.18, 0.06, 0.14, 0.015, 1), 0x2b2f33, 0.3, 0.79, -0.1);
  V(dg, RB(0.24, 0.02, 0.32, 0.004, 1), 0x1d3557, 0.5, 0.77, 0.0);
  mug(dg, 0.12, 0.76, 0.0, 0xf2efe8, 0.4);
  pottedPlant(dg, 0.72, 1.11, 0.22, { kind: 'herb', h: 0.2, potR: 0.05, potH: 0.08, seed: seed + 3, pot: 'terracotta' });
  bx(1.15, F, 0.6, 1.95, F + 1.1, 2.3);
  P.npcSpots.push({ pos: [X(2.05), F, 1.45], yaw: Y(PI / 2), pose: 'stand', role: 'guard' });
  officeChair(g, X(2.05), F, 2.75, Y(PI / 2 + 0.4));
  wallClock2(g, NA, X(CW - 0.02), F + 2.35, 1.45, Y(-PI / 2));
  // parcel rack (택배 보관) on the guard's wall
  const pr = group(g, X(2.18), F, -0.1, Y(-PI / 2));
  for (const s of [-1, 1]) put(pr, RB(0.03, 1.3, 0.4, 0.006, 1), IM.dark, s * 0.6, 0.65, 0);
  for (const y of [0.08, 0.52, 0.96, 1.3]) put(pr, RB(1.22, 0.025, 0.4, 0.006, 1), IM.dark, 0, y, 0);
  const R = rng(seed * 31 + 7);
  for (const y of [0.08, 0.52, 0.96]) {
    let cx = -0.55;
    while (cx < 0.4) { const w = 0.22 + R() * 0.2, h = 0.16 + R() * 0.2; V(pr, RB(w, h, 0.3, 0.008, 1), [0xc9a77a, 0xd8be94, 0xb8955f, 0xe9e4da][(R() * 4) | 0], cx + w / 2, y + 0.0125 + h / 2, 0.02, 0, (R() - 0.5) * 0.15, 0); cx += w + 0.05; }
  }
  bx(1.98, F, -0.72, CW, F + 1.32, 0.52);
  // notice board, plants, umbrella stand, entry mat, ceiling camera
  put(g, RB(0.04, 1.06, 1.66, 0.01, 1), IM.oak, X(CW - 0.02), F + 1.62, -1.95);
  D(g, IA.quad('notice', 1.56, 0.97), IA.mat, X(CW - 0.042), F + 1.62, -1.95, 0, Y(-PI / 2), 0);
  pottedPlant(g, X(1.85), F, -3.15, { kind: 'fig', h: 1.5, seed: 11 + seed, pot: 'charcoal', potR: 0.22, potH: 0.42 });
  bx(1.6, F, -3.4, 2.1, F + 0.5, -2.9);
  umbrellaStand(g, X(1.3), F, 3.12);
  bx(1.15, F, 2.97, 1.45, F + 0.5, 3.27);
  put(g, RB(2.0, 0.012, 1.1, 0.005, 1), IM.rug2, 0, F + 0.006, 2.7);
  D(g, IA.quad('welcome', 1.6, 0.4), IA.mat, 0, F + 0.013, 2.7, -PI / 2, 0, 0);
  V(g, SP(0.07, 14, 10), 0x2b2f33, X(-1.7), C - 0.03, 3.0, 0, 0, 0, vcGloss());
  // a neighbour waiting for the lift
  P.npcSpots.push({ pos: [X(-0.85), F, -2.45], yaw: Y(0.25), pose: 'stand', role: 'guest' });
  P.indoor.push({ min: [-CW, F, IZ0], max: [CW, C, IZ1] });
}
function nbHall(P, M, IM, IA, NA, K, seed) {
  const g = P.group, F = FLR(K), C = F + 2.6, R = rng(seed * 17 + 5);
  // floor tiles, wall linings (marble dado, walnut rail, warm plaster), window wall with stool
  slab(g, IM.floorTile, -CW, F - 0.004, LW1, CW, F, IZ1);
  for (const s of [-1, 1]) {
    const xi = s * CW;
    slab(g, IM.marble, s > 0 ? xi - 0.016 : xi, F, LW1, s > 0 ? xi : xi + 0.016, F + 0.9, IZ1 - 0.012);
    slab(g, IM.plasterW, s > 0 ? xi - 0.012 : xi, F + 0.9, LW1, s > 0 ? xi : xi + 0.012, C, IZ1 - 0.012);
    put(g, RB(0.03, 0.045, IZ1 - LW1 - 0.03, 0.008, 1), IM.walnut, xi - s * 0.022, F + 0.92, (LW1 + IZ1) / 2);
  }
  wallX(g, IM.plasterW, -CW, CW, IZ1 - 0.012, IZ1, F, C, [{ a: -0.7, b: 0.7, lo: F + 1.0, hi: F + 2.45 }]);
  put(g, RB(1.56, 0.04, 0.2, 0.01, 1), IM.marble, 0, F + 0.98, IZ1 - 0.07);
  slab(g, IM.walnut, -CW, F, IZ1 - 0.024, CW, F + 0.1, IZ1 - 0.012);
  // ceiling lights
  for (const z of [-1.7, 1.5]) { put(g, CY(0.23, 0.23, 0.03, 28), IM.whitePl, 0, C - 0.015, z); noShadow(put(g, CY(0.2, 0.2, 0.012, 28), IM.lamp, 0, C - 0.034, z)); P.lamps.push({ pos: [0, C - 0.4, z], color: 0xfff0d8, intensity: 9, range: 7 }); }
  // floor sign + evacuation notice on the lift wall
  D(g, NA.quad('fN', 0.5, 0.5), NA.mat, -1.5, F + 1.55, LW1 + 0.012);
  put(g, RB(0.66, 0.46, 0.02, 0.006, 1), IM.oak, 1.65, F + 1.5, LW1 + 0.01);
  D(g, IA.quad('notice', 0.6, 0.4), IA.mat, 1.65, F + 1.5, LW1 + 0.021);
  // the four unit doors: plate, keypad lock, peephole, doormat; each one is locked
  const mats = [0x8a6f5a, 0x56606e, 0x7a8a6a, 0x9a6a5a];
  for (const d of NB_DOORS) {
    const x = d.s * CW, ry = -d.s * PI / 2;
    const dg = staticDoor(g, x, F, d.z, ry, { w: 0.95, h: 2.1, leaf: d.n % 2 ? IM.door : IM.door2, frame: IM.dark });
    D(dg, NA.quad('p' + d.n, 0.22, 0.08), NA.mat, 0, 1.62, 0.04);
    put(dg, RB(0.07, 0.2, 0.03, 0.01, 1), IM.black, 0.33, 1.25, 0.05);
    D(dg, IA.quad('lock', 0.05, 0.09), IA.glowM, 0.33, 1.25, 0.066);
    put(dg, CY(0.012, 0.012, 0.03, 10), IM.chrome, 0, 1.5, 0.04, PI / 2, 0, 0);
    V(g, RB(0.5, 0.012, 0.8, 0.004, 1), mats[d.n - 1], x - d.s * 0.32, F + 0.006, d.z);
    P.interactables.push({ id: 'locked', label: LOCKED, pos: [x - d.s * 0.45, F + 1.4, d.z], radius: 1.0 });
  }
  // life by the doors: shoes (1), umbrella (2), parcel (3), scooter (4)
  const shoe = (x, z, ry, col, s2 = 1) => { const sg = group(g, x, F, z, ry); V(sg, RB(0.1 * s2, 0.07 * s2, 0.26 * s2, 0.03, 2), col, 0, 0.045 * s2, 0); V(sg, RB(0.104 * s2, 0.02, 0.27 * s2, 0.008, 1), 0xf2f0ea, 0, 0.01, 0); };
  shoe(-CW + 0.3, -1.25, 0.2, 0x3b4f73); shoe(-CW + 0.42, -1.2, -0.1, 0x3b4f73); shoe(-CW + 0.35, -2.55, 1.2, 0xd9534f, 0.8);
  vrod(g, 0xe8546b, [-CW + 0.06, F + 0.02, 1.35], [-CW + 0.04, F + 0.85, 1.42], 0.032, 8);
  vrod(g, 0x6b4529, [-CW + 0.04, F + 0.85, 1.42], [-CW + 0.09, F + 0.92, 1.42], 0.011, 6);
  const pc = group(g, CW - 0.45, F, -1.3, -0.3);
  V(pc, RB(0.46, 0.3, 0.34, 0.012, 1), 0xc9a77a, 0, 0.15, 0);
  V(pc, box(0.47, 0.04, 0.06), 0xb38b5a, 0, 0.29, 0);
  D(pc, NA.quad('parcel', 0.2, 0.14), NA.mat, 0, 0.18, 0.172);
  box3(P, CW - 0.72, F, -1.58, CW - 0.18, F + 0.32, -1.02);
  const sc = group(g, CW - 0.12, F, 1.6, 0);
  sc.rotation.z = -0.12;
  V(sc, RB(0.12, 0.03, 0.62, 0.01, 1), [0x4f7391, 0xe8546b, 0x5f8a6a][seed % 3], 0, 0.09, 0);
  vrod(sc, 0xd0d0d0, [0, 0.1, -0.3], [0, 0.82, -0.36], 0.014);
  vrod(sc, 0x222222, [-0.18, 0.82, -0.36], [0.18, 0.82, -0.36], 0.016);
  for (const zz of [-0.32, 0.3]) V(sc, CY(0.06, 0.06, 0.03, 16), 0xf2c14e, 0, 0.06, zz, 0, 0, PI / 2);
  box3(P, CW - 0.3, F, 1.25, CW, F + 0.9, 1.95);
  // stair fire door + exit sign, hydrant cabinet, plants by the window
  staticDoor(g, -CW, F, 2.6, PI / 2, { w: 0.95, h: 2.1, leaf: IM.fire, frame: IM.dark });
  put(g, RB(0.05, 0.16, 0.4, 0.008, 1), IM.dark, -CW + 0.03, F + 2.33, 2.6);
  D(g, IA.quad('exit', 0.36, 0.13), IA.glowM, -CW + 0.056, F + 2.33, 2.6, 0, PI / 2, 0);
  put(g, RB(0.14, 0.9, 0.7, 0.02, 1), IM.red, CW - 0.07, F + 1.05, 2.5);
  D(g, IA.quad('hydrant', 0.3, 0.15), IA.mat, CW - 0.141, F + 1.32, 2.5, 0, -PI / 2, 0);
  put(g, CY(0.05, 0.05, 0.02, 16), IM.lamp, CW - 0.145, F + 0.85, 2.5, 0, 0, PI / 2);
  box3(P, CW - 0.15, F, 2.15, CW, F + 1.5, 2.85);
  for (const [x, kind, pot] of [[-1.15, 'bush', 'terracotta'], [1.15, 'snake', 'white']]) {
    pottedPlant(g, x, F, 3.08, { kind, h: kind === 'snake' ? 0.85 : 0.6, seed: (R() * 99) | 0, pot, potR: 0.16, potH: 0.32 });
    box3(P, x - 0.2, F, 2.88, x + 0.2, F + 0.5, IZ1);
  }
  // a neighbour on the corridor
  P.npcSpots.push({ pos: [1.25, F, 0.2], yaw: -PI / 2 + 0.4, pose: 'stand', role: 'guest' });
  P.indoor.push({ min: [-CW, F, IZ0], max: [CW, C + 0.1, IZ1] });
}

// ------------------------------------------------------------------ neighbourhood houses
const HOUSES = [
  { roof: 'gable', wall: 'plaster', roofM: 'roof', trim: 0x3b4047, band: 0xb68558, door: 0x34503f, chimney: true },
  { roof: 'hip', wall: 'brick', roofM: 'roofRed', trim: 0xf1efea, band: 0xf1efea, door: 0x6b4529, chimney: true },
  { roof: 'flat', wall: 'plasterGray', roofM: null, trim: 0x2d3238, band: 0xa87a50, door: 0x2d3238 },
  { roof: 'shed', wall: 'sidingWhite', roofM: null, trim: 0x4f7391, band: 0x4f7391, door: 0xc4553e },
];
// house shell (local): body x -4.2..4.2, z -4.6..2.0, walls 0.2, ground floor y 0.3; front door x 0.55..1.65
const HOUSE = { X: 4.2, Z0: -4.6, Z1: 2.0, G: 0.3, T: 0.2, D0: 0.55, D1: 1.65, DH: 2.15 };
/** Extruded flat shape (points in the wall plane, u along the wall, v up) as a wall piece of thickness t. */
function shapeWall(pts, t) {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  return prep(new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false }));
}
/** Triangles (each [a, b, c]) as one geometry; each is flipped so its normal points up/outwards. */
function triGeo(tris, down = false) {
  const p = [];
  for (const [a, b, c] of tris) {
    const n = new THREE.Vector3().subVectors(new THREE.Vector3(...b), new THREE.Vector3(...a)).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...c), new THREE.Vector3(...a)));
    if ((n.y < 0) !== down) p.push(...a, ...c, ...b); else p.push(...a, ...b, ...c);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals();
  return prep(g);
}
function blobTree(p, x, z, h, R, M) {
  const g = group(p, x, 0, z, R() * 6);
  put(g, CY(0.07, 0.12, h * 0.6, 10), mat('bark'), 0, h * 0.3, 0);
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7 + R(), r = h * (0.2 + R() * 0.07), sd = R() * 9;
    const geo = displace(new THREE.IcosahedronGeometry(r, 2), (px, py, pz) => (Math.sin(px * 9 + sd) * Math.cos(pz * 8 - sd) * 0.08 + Math.sin(py * 11 + sd) * 0.05) * r);
    put(g, geo, M.leaves, Math.cos(a) * r * 0.7 * (i ? 1 : 0), h * (0.68 + (i ? 0 : 0.12)) + R() * 0.15, Math.sin(a) * r * 0.7 * (i ? 1 : 0));
  }
  return g;
}

export function buildHouse({ variant = 0 } = {}) {
  const vi = (((variant | 0) % 4) + 4) % 4, v = HOUSES[vi];
  const S = makeSite('house' + vi, 12, 11);
  const root = S.group, B = backdrops(), M = aptMats(ACCENTS[vi]);
  const R = rng(vi * 53 + 9);
  const X = 4.2, Z0 = -4.6, Z1 = 2.0, G = 0.3, H1 = 3.2, TOPW = 6.2, T = 0.2;
  const wallM = mat(v.wall), trim = paint(v.trim, 0.45, 0.2), band = paint(v.band, 0.55);
  const lit = () => (R() < 0.45 ? B.lit : R() < 0.6 ? B.day : B.dark);
  const rooms = ['liv0', 'liv1', 'liv2', 'bed0', 'bed1', 'kit'];
  // ---- windows: [x0, x1, lo, hi] on the front/back, [z0, z1, lo, hi] on the sides
  const front = [[[-3.6, -1.3, 0.95, 2.6], [2.5, 3.6, 1.3, 2.5]], [[-3.4, -1.6, 4.0, 5.6], [0.6, 2.6, 4.0, 5.6]]];
  const back = [[[-3.2, -1.8, 1.3, 2.5], [1.4, 3.0, 1.3, 2.5]], [[-3.2, -1.8, 4.1, 5.4], [1.4, 3.0, 4.1, 5.4]]];
  const side = [[[-2.2, -1.0, 1.3, 2.5]], [[-2.8, -1.4, 4.1, 5.4]]];
  const door = [HOUSE.D0, HOUSE.D1, G, G + HOUSE.DH];
  // ground floor windows look into the real rooms (no backdrop); the bathroom one is frosted
  const win = (f, o) => { const cell = rooms[(R() * 6) | 0], m = lit(); return { ...o, cell: f ? cell : null, m, dep: 0.45 }; };
  for (let f = 0; f < 2; f++) {
    const y0 = f ? H1 : 0, y1 = f ? TOPW : H1;
    const fh = front[f].map(([a, b, lo, hi]) => ({ a, b, lo, hi }));
    if (!f) fh.push({ a: door[0], b: door[1], lo: door[2], hi: door[3] });
    wallX(root, wallM, -X, X, Z1 - T, Z1, y0, y1, fh);
    wallX(root, wallM, -X, X, Z0, Z0 + T, y0, y1, back[f].map(([a, b, lo, hi]) => ({ a, b, lo, hi })));
    for (const s of [-1, 1]) wallZ(root, wallM, Z0 + T, Z1 - T, s > 0 ? X - T : -X, s > 0 ? X : -X + T, y0, y1, side[f].map(([a, b, lo, hi]) => ({ a, b, lo, hi })));
    for (const [a, b, lo, hi] of front[f]) facadeWindow(root, M, B, (a + b) / 2, Z1, 0, b - a, lo, hi, win(f, { panes: b - a > 1.6 ? 3 : 2 }));
    for (const [a, b, lo, hi] of back[f]) facadeWindow(root, M, B, (a + b) / 2, Z0, PI, b - a, lo, hi, win(f, { panes: 2, frosted: !f && a > 0 }));
    for (const s of [-1, 1]) for (const [a, b, lo, hi] of side[f]) facadeWindow(root, M, B, s * X, (a + b) / 2, s * PI / 2, b - a, lo, hi, win(f, { panes: 2 }));
    // flower boxes under the upper front windows
    if (f) for (const [a, b, lo] of front[f]) { put(root, RB(b - a, 0.2, 0.22, 0.02, 1), band, (a + b) / 2, lo - 0.14, Z1 + 0.12); for (let i = 0; i < 8; i++) V(root, SP(0.05, 6, 4), [0xe8546b, 0xf7c548, 0xf4f1ea, 0xc86bd6][(i + vi) % 4], a + 0.1 + (b - a - 0.2) * i / 7, lo + 0.02, Z1 + 0.12 + (i % 2 ? 0.04 : -0.04)); }
  }
  // inner backdrop for the closed front door's sidelight is not needed: the door is solid
  // plinth: a band round the walls (open at the front door so the floor inside stays level)
  for (const [x0, z0, x1, z1] of [[-X - 0.03, Z1 - T, HOUSE.D0, Z1 + 0.03], [HOUSE.D1, Z1 - T, X + 0.03, Z1 + 0.03], [-X - 0.03, Z0 - 0.03, X + 0.03, Z0 + T],
    [-X - 0.03, Z0 + T, -X + T, Z1 - T], [X - T, Z0 + T, X + 0.03, Z1 - T]]) slab(root, M.stone, x0, 0, z0, x1, 0.42, z1);
  put(root, RB(2 * X + 0.08, 0.14, Z1 - Z0 + 0.08, 0.02, 1), band, 0, H1 - 0.02, (Z0 + Z1) / 2);   // floor band
  slab(root, trim, -X + T, G - 0.05, Z0 + T, X - T, G, Z1 - T);
  slab(root, M.stone, door[0], G - 0.03, Z1 - T, door[1], G + 0.008, Z1 + 0.02);                // threshold
  // colliders: floor, ground storey walls (door hole free), solid upper storey
  const D0 = door[0], D1 = door[1], DT = door[3];
  box3(S, -X, 0, Z0, X, G, Z1);
  box3(S, -X, G, Z1 - T, D0, H1, Z1); box3(S, D1, G, Z1 - T, X, H1, Z1); box3(S, D0, DT, Z1 - T, D1, H1, Z1);
  box3(S, -X, G, Z0, X, H1, Z0 + T);
  box3(S, -X, G, Z0 + T, -X + T, H1, Z1 - T); box3(S, X - T, G, Z0 + T, X, H1, Z1 - T);
  box3(S, -X, H1, Z0, X, TOPW, Z1);
  // ---- roof
  const ov = 0.45, zc = (Z0 + Z1) / 2, hd = (Z1 - Z0) / 2;
  if (v.roof === 'gable' || v.roof === 'hip') {
    const pitch = v.roof === 'gable' ? 0.62 : 0.5, run = hd + ov, rise = hd * pitch, eY = TOPW - ov * pitch, top = TOPW + rise;
    const rm = mat(v.roofM);
    if (v.roof === 'gable') {
      const a = Math.atan(pitch), L = run / Math.cos(a);
      for (const s of [-1, 1]) put(root, RB(2 * X + 2 * ov, 0.14, L, 0.03, 1), rm, 0, (top + eY) / 2 + 0.07, zc + s * run / 2, s * a, 0, 0);
      for (const s of [-1, 1]) put(root, shapeWall([[-hd, 0], [hd, 0], [0, rise]], T), wallM, s > 0 ? X - T : -X, TOPW, zc, 0, PI / 2, 0);
      put(root, CY(0.09, 0.09, 2 * X + 2 * ov, 12), trim, 0, top + 0.16, zc, 0, 0, PI / 2);
      for (const s of [-1, 1]) for (const t of [-1, 1]) put(root, RB(0.06, 0.2, L + 0.02, 0.01, 1), trim, s * (X + ov), (top + eY) / 2 + 0.02, zc + t * run / 2, t * a, 0, 0);
    } else {
      const ex = X + ov, z0 = Z0 - ov, z1 = Z1 + ov, rx = ex - run;
      const P = (x, y, z) => [x, y, z];
      const tris = [
        [P(-ex, eY, z1), P(ex, eY, z1), P(rx, top, zc)], [P(-ex, eY, z1), P(rx, top, zc), P(-rx, top, zc)],
        [P(ex, eY, z0), P(-ex, eY, z0), P(-rx, top, zc)], [P(ex, eY, z0), P(-rx, top, zc), P(rx, top, zc)],
        [P(ex, eY, z1), P(ex, eY, z0), P(rx, top, zc)], [P(-ex, eY, z0), P(-ex, eY, z1), P(-rx, top, zc)],
      ];
      put(root, triGeo(tris), rm);
      put(root, triGeo([[P(-ex, eY - 0.02, z0), P(ex, eY - 0.02, z0), P(ex, eY - 0.02, z1)], [P(-ex, eY - 0.02, z0), P(ex, eY - 0.02, z1), P(-ex, eY - 0.02, z1)]], true), trim);
      put(root, CY(0.07, 0.07, 2 * rx, 10), trim, 0, top + 0.05, zc, 0, 0, PI / 2);
      for (const s of [-1, 1]) put(root, RB(2 * ex + 0.04, 0.18, 0.06, 0.01, 1), trim, 0, eY - 0.06, s > 0 ? z1 : z0);
      for (const s of [-1, 1]) put(root, RB(0.06, 0.18, z1 - z0, 0.01, 1), trim, s * ex, eY - 0.06, zc);
    }
    // gutters + downpipes
    for (const s of [-1, 1]) { put(root, CY(0.06, 0.06, 2 * X + 2 * ov, 10), trim, 0, eY - 0.1, zc + s * (hd + ov + 0.04), 0, 0, PI / 2); put(root, CY(0.04, 0.04, eY, 8), trim, s * (X + 0.08), eY / 2, s > 0 ? Z1 + 0.08 : Z0 - 0.08); }
    if (v.chimney) { put(root, RB(0.6, 1.6, 0.6, 0.02, 1), mat('brickDark'), -2.4, top - 0.3, zc - 1.0); put(root, RB(0.7, 0.08, 0.7, 0.01, 1), M.conc, -2.4, top + 0.52, zc - 1.0); }
  } else if (v.roof === 'flat') {
    put(root, RB(2 * X + 0.5, 0.3, Z1 - Z0 + 0.5, 0.03, 2), band, 0, TOPW + 0.15, zc);
    for (const [x0, z0, x1, z1] of [[-X, Z1 - 0.2, X, Z1], [-X, Z0, X, Z0 + 0.2], [-X, Z0, -X + 0.2, Z1], [X - 0.2, Z0, X, Z1]]) { slab(root, wallM, x0, TOPW + 0.3, z0, x1, TOPW + 1.1, z1); }
    put(root, RB(2 * X + 0.06, 0.06, 0.26, 0.01, 1), trim, 0, TOPW + 1.13, Z1 - 0.1);
    put(root, RB(2 * X + 0.06, 0.06, 0.26, 0.01, 1), trim, 0, TOPW + 1.13, Z0 + 0.1);
    for (const s of [-1, 1]) put(root, RB(0.26, 0.06, Z1 - Z0, 0.01, 1), trim, s * (X - 0.1), TOPW + 1.13, zc);
    slab(root, M.conc, -X + 0.2, TOPW + 0.3, Z0 + 0.2, X - 0.2, TOPW + 0.32, Z1 - 0.2);
    // roof terrace: pergola, planters, solar panel
    for (const [px, pz] of [[-3.6, 1.4], [-0.6, 1.4], [-3.6, -0.8], [-0.6, -0.8]]) put(root, RB(0.1, 2.2, 0.1, 0.01, 1), M.oak, px, TOPW + 1.4, pz);
    for (let i = 0; i < 9; i++) put(root, RB(3.3, 0.08, 0.06, 0.01, 1), M.oak, -2.1, TOPW + 2.52, -0.9 + i * 0.29);
    pottedPlant(root, 2.6, TOPW + 0.32, 1.3, { kind: 'palm', h: 1.0, seed: 3, pot: 'charcoal', potR: 0.2, potH: 0.36 });
    const sp = group(root, 2.2, TOPW + 0.9, -2.6, 0); sp.rotation.x = -0.45;
    put(sp, RB(2.4, 0.05, 1.2, 0.01, 1), M.alu, 0, 0, 0); put(sp, box(2.32, 0.012, 1.12), paint(0x22324a, 0.18, 0.6), 0, 0.03, 0);
  } else {
    // shed roof: low at the front, high at the back
    const lowY = TOPW, highY = TOPW + 1.5, run = Z1 - Z0 + 2 * ov, a = Math.atan((highY - lowY) / (Z1 - Z0));
    put(root, RB(2 * X + 2 * ov, 0.16, run / Math.cos(a), 0.03, 1), paint(0x3a3f45, 0.45, 0.5), 0, (lowY + highY) / 2 + 0.1, zc, a, 0, 0);
    for (const s of [-1, 1]) put(root, shapeWall([[-hd, 0], [hd, 0], [hd, highY - lowY], [-hd, 0.02]], T), wallM, s > 0 ? X - T : -X, TOPW, zc, 0, PI / 2, 0);
    for (const s of [-1, 1]) put(root, RB(0.06, 0.2, run / Math.cos(a), 0.01, 1), trim, s * (X + ov), (lowY + highY) / 2 + 0.06, zc, a, 0, 0);
    put(root, RB(2 * X + 0.1, 0.5, 0.06, 0.01, 1), band, 0, TOPW - 0.4, Z1 + 0.03);
    put(root, CY(0.06, 0.06, 2 * X + 2 * ov, 10), trim, 0, lowY - 0.05, Z1 + ov + 0.04, 0, 0, PI / 2);
    put(root, CY(0.04, 0.04, lowY, 8), trim, X + 0.08, lowY / 2, Z1 + 0.08);
  }
  // ---- porch: slab, step, canopy on two posts, door, lamp, number
  slab(root, M.stone, -0.3, 0, Z1, 2.5, G, 3.4);
  put(root, RB(2.8, 0.15, 0.36, 0.02, 1), M.stone, 1.1, 0.075, 3.58);
  box3(S, -0.3, 0, Z1, 2.5, G, 3.4); box3(S, -0.3, 0, 3.4, 2.5, 0.15, 3.76);
  put(root, RB(3.0, 0.16, 1.55, 0.02, 2), v.roof === 'hip' ? trim : band, 1.1, 2.92, Z1 + 0.72);
  slab(root, M.oak, -0.35, 2.82, Z1 + 0.02, 2.55, 2.84, Z1 + 1.45);
  for (const px of [-0.15, 2.35]) { put(root, RB(0.12, 2.6, 0.12, 0.015, 1), M.oak, px, G + 1.3, Z1 + 1.3); box3(S, px - 0.08, 0, Z1 + 1.22, px + 0.08, 2.9, Z1 + 1.38); }
  // front door: frame on the outer face, hinged leaf (E to open) swinging into the hall
  {
    const D0 = door[0], D1 = door[1], DH = HOUSE.DH, dw = D1 - D0;
    put(root, RB(dw + 0.14, 0.07, 0.06, 0.01, 1), trim, (D0 + D1) / 2, G + DH + 0.035, Z1 + 0.02);
    for (const x of [D0 - 0.035, D1 + 0.035]) put(root, RB(0.07, DH, 0.06, 0.01, 1), trim, x, G + DH / 2, Z1 + 0.02);
    const piv = group(root, D0 + 0.03, G, Z1 - 0.05, 0);
    piv.userData.dynamic = true;
    const lw = dw - 0.05, leafM = paint(v.door, 0.4, 0.1, { clearcoat: 0.4 }), st = mat('steel');
    put(piv, RB(lw, DH - 0.01, 0.05, 0.006, 1), leafM, lw / 2, (DH - 0.01) / 2, 0);
    for (const zf of [-1, 1]) {
      for (const [py, ph] of [[0.55, 0.72], [1.5, 0.9]]) put(piv, RB(lw - 0.3, ph, 0.012, 0.004, 1), leafM, lw / 2, py, zf * 0.027);
      put(piv, RB(0.05, 0.05, 0.03, 0.012, 1), st, lw - 0.1, 1.0, zf * 0.035);
      put(piv, RB(0.14, 0.022, 0.022, 0.008, 1), st, lw - 0.15, 1.0, zf * 0.06);
    }
    put(piv, CY(0.012, 0.012, 0.06, 10), mat('chrome'), lw / 2, 1.52, 0, PI / 2, 0, 0);
    bake(piv);
    S.doors.push({ pivot: piv, openAngle: 1.6, collider: { min: [D0, G, Z1 - T], max: [D1, G + DH, Z1] }, auto: false });
  }
  const lampM = glow(0xffd29a, 2.6); lampM.name = 'houseLamp'; lampM.userData.glowMax = 2.6;
  put(root, RB(0.14, 0.24, 0.12, 0.02, 1), trim, -0.05 + 0.0, G + 1.95, Z1 + 0.06);
  D(root, RB(0.09, 0.15, 0.04, 0.01, 1), lampM, -0.05, G + 1.95, Z1 + 0.13);
  D(root, CY(0.07, 0.07, 0.01, 14), lampM, 1.1, 2.82 - 0.006, Z1 + 0.7);
  S.lamps.push({ pos: [1.1, 2.4, Z1 + 0.9], color: 0xffcf96, intensity: 5, range: 6 });
  S.nightGlow.push(lampM, B.lit);
  V(root, RB(0.34, 0.16, 0.02, 0.01, 1), 0xf2efe8, 2.0, G + 1.7, Z1 + 0.01);
  V(root, box(0.2, 0.05, 0.005), 0x2b2f33, 2.0, G + 1.7, Z1 + 0.022);
  // services: AC condenser on the side, gas meter, downpipe at the back
  acUnit(root, X + 0.45, 0, -2.6, PI / 2);
  box3(S, X + 0.25, 0, -3.1, X + 0.65, 0.7, -2.1);
  V(root, RB(0.25, 0.3, 0.15, 0.02, 1), 0xd9d6cf, -X - 0.08, 1.2, -3.6);
  vrod(root, 0xf2c14e, [-X - 0.06, 0.3, -3.3], [-X - 0.06, 1.05, -3.3], 0.02);
  // ---- garden: path, fence with gate gap, hedge, flower bed, tree, mailbox, variant extras
  for (let i = 0; i < 4; i++) put(root, RB(0.7, 0.05, 0.42, 0.02, 1), M.pavers, 1.1 + (R() - 0.5) * 0.12, 0.025, 4.05 + i * 0.4, 0, (R() - 0.5) * 0.2, 0);
  const fz = 5.3, fenceM = vi === 1 ? M.white : M.oak;
  for (const [x0, x1] of [[-5.85, 0.35], [1.85, 5.85]]) {
    const n = Math.round((x1 - x0) / 0.16);
    for (let i = 0; i <= n; i++) put(root, box(0.07, 0.8, 0.025), fenceM, x0 + (x1 - x0) * i / n, 0.4, fz);
    for (const y of [0.2, 0.62]) put(root, box(x1 - x0, 0.06, 0.03), fenceM, (x0 + x1) / 2, y, fz - 0.03);
    for (const x of [x0, x1]) put(root, RB(0.11, 0.95, 0.11, 0.015, 1), fenceM, x, 0.475, fz);
    box3(S, x0, 0, fz - 0.06, x1, 0.9, fz + 0.04);
  }
  // mailbox at the gate
  const mb = group(root, 2.15, 0, fz + 0.2, 0);
  put(mb, RB(0.08, 1.0, 0.08, 0.01, 1), trim, 0, 0.5, 0);
  V(mb, RB(0.32, 0.26, 0.2, 0.04, 2), [0xc4553e, 0x4f7391, 0x2d3238, 0x5f8a6a][vi], 0, 1.1, 0);
  // hedge along the left fence, flower bed under the big window
  const hw = 5.2;
  const hg = new THREE.BoxGeometry(hw, 0.7, 0.55, 26, 4, 4);
  put(root, displace(hg, (x, y, z) => 0.035 * Math.sin(x * 9 + vi) * Math.cos(z * 11) + 0.02 * Math.sin(x * 23 + y * 19)), M.leaves, -3.1, 0.38, fz - 0.42);
  box3(S, -5.7, 0, fz - 0.7, -0.5, 0.8, fz - 0.14);
  put(root, RB(2.6, 0.22, 0.6, 0.03, 1), M.stone, -2.45, 0.11, Z1 + 0.45);
  slab(root, M.dirt, -3.65, 0.2, Z1 + 0.2, -1.25, 0.23, Z1 + 0.7);
  for (let i = 0; i < 22; i++) { const x = -3.55 + R() * 2.2, z = Z1 + 0.25 + R() * 0.4, hh = 0.15 + R() * 0.2; vrod(root, 0x4f7a3a, [x, 0.22, z], [x, 0.22 + hh, z], 0.006, 4); V(root, SP(0.04, 6, 4), [0xe8546b, 0xf7c548, 0xf4f1ea, 0xc86bd6, 0xff8c5a][(R() * 5) | 0], x, 0.24 + hh, z); }
  for (let i = 0; i < 4; i++) { const sx = -3.4 + i * 0.7; put(root, displace(new THREE.IcosahedronGeometry(0.2, 2), (px, py, pz) => 0.02 * Math.sin(px * 30 + i) * Math.cos(pz * 27)), M.leaves, sx, 0.36, Z1 + 0.45); }
  box3(S, -3.75, 0, Z1, -1.15, 0.5, Z1 + 0.75);
  const tx = vi % 2 ? -4.6 : 4.4, tzz = 3.9;
  blobTree(root, tx, tzz, 3.6 + R() * 0.8, R, M);
  box3(S, tx - 0.15, 0, tzz - 0.15, tx + 0.15, 2.4, tzz + 0.15);
  if (vi === 1 || vi === 3) {     // garden bench
    const bg = group(root, vi === 1 ? 3.9 : -4.4, 0, 3.9, vi === 1 ? -0.4 : 0.4);
    put(bg, RB(1.3, 0.05, 0.42, 0.012, 2), M.oak, 0, 0.45, 0);
    put(bg, RB(1.3, 0.3, 0.04, 0.012, 2), M.oak, 0, 0.72, -0.19, -0.12, 0, 0);
    for (const s of [-1, 1]) put(bg, RB(0.05, 0.45, 0.4, 0.01, 1), trim, s * 0.58, 0.225, 0);
    box3(S, bg.position.x - 0.7, 0, 3.6, bg.position.x + 0.7, 0.8, 4.2);
  }
  if (vi === 2) for (const [px, pz] of [[3.4, 3.2], [4.4, 4.4]]) { put(root, RB(0.7, 0.55, 0.7, 0.03, 2), M.conc, px, 0.275, pz); pottedPlant(root, px, 0.55, pz, { kind: 'snake', h: 0.9, seed: (px * 9) | 0, pot: 'stone', potR: 0.01, potH: 0.0 }); box3(S, px - 0.35, 0, pz - 0.35, px + 0.35, 0.6, pz + 0.35); }
  if (vi === 0) { // a kid's bike by the porch
    const bk = group(root, 3.0, 0, 3.0, 0.5);
    for (const zz of [-0.42, 0.42]) V(bk, torus(0.24, 0.025, 6, 22), 0x222326, 0, 0.26, zz, 0, PI / 2, 0);
    vrod(bk, 0xe8546b, [0, 0.26, -0.42], [0, 0.55, 0.0]); vrod(bk, 0xe8546b, [0, 0.55, 0.0], [0, 0.26, 0.42]); vrod(bk, 0xe8546b, [0, 0.55, 0.0], [0, 0.62, -0.38]); vrod(bk, 0xe8546b, [0, 0.26, -0.42], [0, 0.3, 0.0]);
    vrod(bk, 0x222326, [-0.22, 0.75, -0.38], [0.22, 0.75, -0.38], 0.015); V(bk, RB(0.1, 0.04, 0.2, 0.015, 1), 0x222326, 0, 0.66, 0.08);
  }
  bake(root);
  S.extra.variant = vi;
  S.extra.door = { pos: [1.1, G, Z1 + 0.8], yaw: 0 };
  S.extra.interior = { build: () => houseInterior(vi) };
  if (typeof location !== 'undefined' && location.search.includes('aptstats')) console.warn('HOUSESTATS', vi, JSON.stringify(stats(root)));
  return S;
}
/** All four house variants side by side (viewer helper). */
export function houseRow() {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) { const s = buildHouse({ variant: i }); s.group.position.x = (i - 1.5) * 13; g.add(s.group); }
  return g;
}

// ------------------------------------------------------------------ house interiors (lazy)
// One floor plan for all four variants (colours and accents differ). Inside x -4.0..4.0, z -4.4..1.8,
// floor y 0.3, ceiling y 2.9. Living room front-left (TV on the west wall, sofa facing it), kitchen +
// dining front-right, bedroom back-left (door from the hall), laundry hall in the middle, closed bathroom
// back-right.
const HOUSE_IN = [
  { wall: 'plasterWarm', floor: 'oakFloor', sofa: 'fabricGray', rug: 'carpetWarm', front: 0x6f8f72, pillows: [0xd4a043, 0x5f8a6a, 0xf1ece4], duvet: 0x9db4c8, shade: 0x2f4f4f, family: 'sofa' },
  { wall: 'plasterSage', floor: 'darkFloor', sofa: 'fabricBeige', rug: 'carpet', front: 0xeeeae2, pillows: [0x2f6f73, 0xe0b25a, 0xc4553e], duvet: 0xe3c08f, shade: 0xc4553e, family: null },
  { wall: 'plaster', floor: 'birch', sofa: 'fabricBlue', rug: 'carpetWarm', front: 0x4f7391, pillows: [0xf2c14e, 0xf1ece4, 0xe8546b], duvet: 0xe8b4b8, shade: 0xe0b25a, family: 'table' },
  { wall: 'plasterBlue', floor: 'oakFloor', sofa: 'fabricGreen', rug: 'carpet', front: 0xb5654a, pillows: [0xf1ece4, 0xd4a043, 0x3d6aa8], duvet: 0xf2efe8, shade: 0x26272b, family: null },
];
const houseTV = () => cached('houseTV', () => { const m = tvScreen(); m.name = 'houseTV'; m.emissiveIntensity = 1.0; return m; });
/** Window/door casing on a wall face: local x along the wall, local +Z into the room. */
function casing(p, m, cx, cz, ry, w, lo, hi, door = false) {
  const k = group(p, cx, 0, cz, ry);
  for (const s of [-1, 1]) put(k, RB(0.07, hi - lo, 0.025, 0.006, 1), m, s * (w / 2 + 0.035), (lo + hi) / 2, 0.0125);
  put(k, RB(w + 0.14, 0.07, 0.025, 0.006, 1), m, 0, hi + 0.035, 0.0125);
  if (!door) put(k, RB(w + 0.16, 0.03, 0.15, 0.006, 1), m, 0, lo - 0.015, 0.045);
  return k;
}
function houseInterior(vi) {
  const H = HOUSE, X = H.X - H.T, Z0 = H.Z0 + H.T, Z1 = H.Z1 - H.T, G = H.G, C = G + 2.6;
  const hv = HOUSE_IN[vi], R = rng(vi * 71 + 5);
  const P = { group: new THREE.Group(), colliders: [], interactables: [], npcSpots: [], lamps: [], indoor: [] };
  const g = P.group, IA = intAtlas(), NA = nbAtlas(NBK + 1), vg = vcGloss();
  const W = {
    wall: mat(hv.wall), floor: hv.floor === 'birch' ? textured('planks', { color: 0xd6bd96, seed: 4 }, 2.4, { normal: 0.6 }) : mat(hv.floor),
    white: mat('whiteWood'), oak: mat('oak'), walnut: mat('walnut'), linen: mat('linen'), fab: mat(hv.sofa), rug: mat(hv.rug),
    steel: mat('steel'), chrome: mat('chrome'), ceramic: mat('ceramic'), black: mat('blackPlastic'), whitePl: mat('whitePlastic'),
    lamp: mat('lampGlow'), marble: mat('marble'), tile: mat('wallTile'), dark: paint(0x2b2f33, 0.5, 0.3), ceil: paint(0xf6f4ef, 0.92),
    front: paint(hv.front, 0.45),
  };
  const bx = (x0, y0, z0, x1, y1, z1) => box3(P, x0, y0, z0, x1, y1, z1);
  // ================= shell: floor, ceiling, wall linings with the holes, casings, partitions, baseboards
  slab(g, W.floor, -X, G - 0.01, Z0, X, G + 0.003, Z1);
  slab(g, W.ceil, -X, C, Z0, X, C + 0.05, Z1);
  const FW = [[-3.6, -1.3, 0.95, 2.6], [2.5, 3.6, 1.3, 2.5]], BWn = [-3.2, -1.8, 1.3, 2.5], SW = [-2.2, -1.0, 1.3, 2.5];
  const hole = ([a, b, lo, hi]) => ({ a, b, lo, hi });
  wallX(g, W.wall, -X, X, Z1 - 0.012, Z1, G, C, [...FW.map(hole), { a: H.D0, b: H.D1, lo: G, hi: G + H.DH }]);
  wallX(g, W.wall, -X, X, Z0, Z0 + 0.012, G, C, [hole(BWn), hole([1.4, 3.0, 1.3, 2.5])]);
  for (const s of [-1, 1]) wallZ(g, W.wall, Z0, Z1, s > 0 ? X - 0.012 : -X, s > 0 ? X : -X + 0.012, G, C, [hole(SW)]);
  for (const [a, b, lo, hi] of FW) casing(g, W.white, (a + b) / 2, Z1 - 0.012, PI, b - a, lo, hi);
  casing(g, W.white, (BWn[0] + BWn[1]) / 2, Z0 + 0.012, 0, BWn[1] - BWn[0], BWn[2], BWn[3]);
  for (const s of [-1, 1]) casing(g, W.white, s * (X - 0.012), (SW[0] + SW[1]) / 2, -s * PI / 2, SW[1] - SW[0], SW[2], SW[3]);
  casing(g, W.white, (H.D0 + H.D1) / 2, Z1 - 0.012, PI, H.D1 - H.D0, G, G + H.DH, true);
  // partitions: A bedroom|living (z -1.0..-0.88), B bedroom|hall (x -0.6..-0.48, doorway z -2.05..-1.0),
  // C bath|kitchen (z -2.4..-2.28), D bath|hall (x 1.2..1.32)
  wallX(g, W.wall, -X, -0.48, -1.0, -0.88, G, C, [], P);
  wallZ(g, W.wall, Z0, -1.0, -0.6, -0.48, G, C, [{ a: -2.05, b: -1.0, lo: G, hi: G + 2.1 }], P);
  wallX(g, W.wall, 1.2, X, -2.4, -2.28, G, C, [], P);
  wallZ(g, W.wall, Z0, -2.28, 1.2, 1.32, G, C, [], P);
  for (const s of [-1, 1]) casing(g, W.white, s > 0 ? -0.48 : -0.6, -1.525, s * PI / 2, 1.05, G, G + 2.1, true);
  for (const [x0, z0, x1, z1] of [[-X, Z1 - 0.024, H.D0 - 0.07, Z1 - 0.012], [H.D1 + 0.07, Z1 - 0.024, X, Z1 - 0.012], [-X, Z0 + 0.012, X, Z0 + 0.024], [-X + 0.012, Z0, -X + 0.024, Z1], [X - 0.024, -2.28, X - 0.012, Z1],
    [-X, -0.88, -0.48, -0.868], [-X, -1.012, -0.6, -1.0], [-0.48, Z0, -0.468, -2.12], [1.188, Z0, 1.2, -2.28], [1.2, -2.28, X, -2.268]]) slab(g, W.white, x0, G, z0, x1, G + 0.08, z1);
  P.indoor.push({ min: [-X, G, Z0], max: [X, C, Z1] });

  // ================= living room (x -4.0..-0.48, z -0.88..1.8)
  const tvz = 0.55;
  cabinetRun(g, -X + 0.21, G, tvz, PI / 2, 1.7, 0.45, 0.42, 3, W.walnut, W.oak, null);
  bx(-X, G, tvz - 0.86, -X + 0.44, G + 0.47, tvz + 0.86);
  const tv = group(g, -X + 0.03, G + 1.3, tvz, PI / 2);
  put(tv, RB(1.3, 0.76, 0.04, 0.008, 2), W.black, 0, 0, 0);
  D(tv, quad(1.26, 0.72), houseTV(), 0, 0, 0.0205);
  V(g, RB(0.12, 0.08, 0.9, 0.02, 1), 0x2b2d31, -X + 0.24, G + 0.49, tvz);                         // sound bar
  V(g, RB(0.28, 0.05, 0.2, 0.01, 1), 0xf0f0ee, -X + 0.2, G + 0.475, tvz + 0.62, 0, 0.2, 0, vg);        // console
  pottedPlant(g, -X + 0.2, G + 0.45, tvz - 0.65, { kind: 'herb', h: 0.25, potR: 0.07, potH: 0.12, seed: 3 + vi, pot: 'white' });
  // sofa facing the TV, throw, rug, coffee table + things
  const sx = -1.25, sz = 0.6;
  sofa(g, sx, G, sz, -PI / 2, { w: 2.0, fabric: W.fab, legs: W.walnut, pillows: hv.pillows });
  V(g, softBox(0.62, 0.03, 0.36, 0.012, 0.004, 0.006, vi), [0xe9e2d0, 0x8a6f5a, 0xf1ece4, 0xd9b48a][vi], sx + 0.12, G + 0.66, sz - 0.75, 0, 0.3, 0, vcSoft());
  bx(sx - 0.47, G, sz - 1.02, sx + 0.47, G + 0.8, sz + 1.02);
  put(g, RB(2.3, 0.012, 2.2, 0.006, 1), W.rug, -2.45, G + 0.009, sz);
  const ct = group(g, -2.55, G, sz);
  put(ct, RB(0.62, 0.045, 1.05, 0.02, 2), W.oak, 0, 0.4, 0);
  put(ct, RB(0.56, 0.025, 0.95, 0.01, 1), W.oak, 0, 0.12, 0);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(ct, RB(0.045, 0.4, 0.045, 0.008, 1), W.walnut, a * 0.26, 0.2, b * 0.46);
  mug(ct, 0.1, 0.4225, 0.25, [0xc4553e, 0x4f7391, 0xf2c14e, 0x5f8a6a][vi], 1.2);
  V(ct, RB(0.05, 0.016, 0.17, 0.006, 1), 0x222326, -0.12, 0.43, -0.02, 0, 0.5, 0);
  V(ct, CY(0.15, 0.1, 0.06, 20), 0xf2efe8, 0.05, 0.45, -0.3, 0, 0, 0, vg);
  for (let i = 0; i < 5; i++) V(ct, SP(0.04, 10, 8), [0xd9534f, 0xf2c14e, 0xe0752d][i % 3], 0.05 + Math.cos(i * 1.3) * 0.055, 0.5, -0.3 + Math.sin(i * 1.3) * 0.055);
  for (let i = 0; i < 3; i++) V(ct, RB(0.2, 0.025, 0.27, 0.004, 1), [0x3d6aa8, 0xe7b851, 0xc4553e][i], -0.04, 0.155 + i * 0.026, 0.2, 0, 0.1 * i, 0);
  bx(-2.86, G, sz - 0.53, -2.24, G + 0.44, sz + 0.53);
  // bookshelf on the bedroom partition, floor lamp, plants, art, curtains, ceiling light
  bookshelf(g, -2.6, G, -0.88 + 0.19, 0, { w: 1.4, h: 1.9, seed: 3 + vi, wood: vi % 2 ? W.oak : W.walnut, shelves: 5 });
  bx(-3.3, G, -0.88, -1.9, G + 1.9, -0.5);
  for (let i = 0; i < 3; i++) { put(g, RB(0.3, 0.24, 0.025, 0.006, 1), W.walnut, -3.1 + i * 0.5, G + 2.2 + (i % 2) * 0.08, -0.86); D(g, IA.quad('photo' + ((i + vi) % 3), 0.26, 0.2), IA.mat, -3.1 + i * 0.5, G + 2.2 + (i % 2) * 0.08, -0.846); }
  const fl = group(g, -1.0, G, -0.66);
  put(fl, CY(0.14, 0.15, 0.03, 24), W.dark, 0, 0.015, 0);
  rod(fl, W.dark, [0, 0.03, 0], [0, 1.45, 0], 0.012);
  put(fl, CY(0.16, 0.2, 0.28, 24, true), W.linen, 0, 1.52, 0);
  noShadow(put(fl, SP(0.05, 10, 8), W.lamp, 0, 1.47, 0));
  bx(-1.16, G, -0.86, -0.84, G + 1.7, -0.5);
  pottedPlant(g, -3.66, G, -0.6, { kind: vi % 2 ? 'palm' : 'fig', h: 1.5, seed: 7 + vi, pot: ['white', 'terracotta', 'charcoal', 0xd9cdb8][vi], potR: 0.2, potH: 0.4 });
  bx(-3.9, G, -0.84, -3.42, G + 0.5, -0.36);
  pottedPlant(g, -0.62, G, 1.5, { kind: 'snake', h: 0.9, seed: 5 + vi, pot: 'white', potR: 0.15, potH: 0.32 });
  bx(-0.8, G, 1.32, -0.44, G + 0.5, 1.68);
  put(g, RB(0.84, 0.64, 0.03, 0.01, 1), W.walnut, -0.4, G + 1.55, Z1 - 0.027);
  D(g, IA.quad(vi % 2 ? 'art' : 'draw', 0.78, 0.58), IA.mat, -0.4, G + 1.55, Z1 - 0.043, 0, PI, 0);
  rod(g, W.dark, [-3.95, C - 0.12, Z1 - 0.19], [-0.95, C - 0.12, Z1 - 0.19], 0.012);
  for (const [x, s2] of [[-3.72, 1], [-1.18, 2]]) curtainPanel(g, W.linen, x, C - 0.14, G + 0.03, Z1 - 0.19, 0.5, s2 + vi);
  ceilingDisc(g, W, -2.3, C, 0.45, 0.28);
  P.lamps.push({ pos: [-2.3, C - 0.3, 0.45], color: 0xffe2b8, intensity: 12, range: 7 });
  P.interactables.push({ id: 'houseRest', label: '소파에서 쉬기', pos: [sx - 0.35, G + 0.9, 0.35], radius: 1.6, seat: { pos: [sx - 0.05, G + 1.12, 0.35], yaw: PI / 2, pitch: -0.05 } });
  if (hv.family === 'sofa') P.npcSpots.push({ pos: [sx - 0.18, G, sz + 0.55], yaw: PI / 2, pose: 'sit', role: 'guest' });

  // ================= kitchen + dining (x 1.32..4.0, z -2.28..1.8) and the entry
  const fz = -2.28 + 0.35;
  const fg = group(g, 1.7, G, fz, 0);
  put(fg, RB(0.74, 1.85, 0.68, 0.02, 2), W.steel, 0, 0.925, 0);
  put(fg, box(0.006, 1.8, 0.01), W.dark, 0, 0.93, 0.341);
  for (const s2 of [-1, 1]) put(fg, RB(0.025, 0.5, 0.04, 0.01, 1), W.chrome, s2 * 0.04, 1.15, 0.36);
  D(fg, IA.quad('draw', 0.2, 0.2), IA.mat, -0.2, 1.32, 0.342);
  D(fg, NA.quad('note', 0.12, 0.12), NA.mat, 0.2, 1.42, 0.342);
  D(fg, IA.quad('photo' + (vi % 3), 0.14, 0.105), IA.mat, 0.22, 0.95, 0.342);
  for (const [x, y, c] of [[-0.2, 1.44, 0xe8546b], [0.2, 1.49, 0x3d9be9], [0.22, 1.02, 0xf2c14e]]) V(fg, CY(0.016, 0.016, 0.012, 10), c, x, y, 0.348, PI / 2, 0, 0, vg);
  cabinetRun(g, 1.7, G + 1.88, -2.03, 0, 0.74, C - G - 1.9, 0.5, 2, W.white, W.white, null);
  bx(1.32, G, -2.28, 2.08, G + 1.86, -1.56);
  P.interactables.push({ id: 'houseFridge', label: '물 마시기', pos: [1.7, G + 1.3, -1.3], radius: 1.3 });
  // base run with a marble top: cooktop, sink by the east window; hood, upper cabinets, tiles
  const kx = (2.1 + X) / 2, kw = X - 2.1;
  cabinetRun(g, kx, G, -1.98, 0, kw, 0.86, 0.6, 4, W.white, W.front, W.dark, { kick: 0.08, hw: 0.2, hh: 0.016, hy: 0.78 });
  put(g, RB(kw + 0.02, 0.04, 0.62, 0.008, 2), W.marble, kx, G + 0.88, -1.97);
  bx(2.08, G, -2.28, X, G + 0.92, -1.66);
  slab(g, W.tile, 2.1, G + 0.9, -2.28, X - 0.012, G + 1.5, -2.268);
  put(g, RB(0.6, 0.012, 0.42, 0.006, 1), W.steel, 3.45, G + 0.903, -1.98);
  put(g, box(0.52, 0.012, 0.34), W.dark, 3.45, G + 0.906, -1.98);
  rod(g, W.chrome, [3.45, G + 0.9, -2.22], [3.45, G + 1.2, -2.22], 0.016, 12);
  rod(g, W.chrome, [3.45, G + 1.2, -2.22], [3.45, G + 1.17, -2.04], 0.012, 10);
  put(g, RB(0.56, 0.012, 0.48, 0.006, 1), W.black, 2.55, G + 0.905, -1.98);
  for (const [dx, dz] of [[-0.13, -0.1], [0.13, 0.1], [-0.13, 0.12], [0.13, -0.12]]) put(g, torus(0.065, 0.004, 4, 20), W.dark, 2.55 + dx, G + 0.913, -1.98 + dz, PI / 2, 0, 0);
  const pot = group(g, 2.42, G + 0.915, -1.86, 0);
  V(pot, CY(0.12, 0.11, 0.15, 20, true), [0xc4553e, 0xd9dcdf, 0x4f7391, 0xf2efe8][vi], 0, 0.075, 0, 0, 0, 0, vg);
  V(pot, CY(0.115, 0.115, 0.012, 20), 0xd9dcdf, 0, 0.15, 0, 0, 0, 0, vg);
  put(g, RB(0.62, 0.18, 0.45, 0.02, 2), W.steel, 2.55, G + 1.72, -2.05);
  put(g, RB(0.28, C - G - 1.81, 0.26, 0.01, 1), W.steel, 2.55, (G + 1.81 + C) / 2, -2.14);
  noShadow(put(g, box(0.36, 0.004, 0.06), W.lamp, 2.55, G + 1.628, -1.92));
  cabinetRun(g, 3.45, G + 1.5, -2.11, 0, 1.1, C - G - 1.52, 0.34, 2, W.white, W.front, W.dark, { hw: 0.016, hh: 0.16, hy: 0.12 });
  const rc = group(g, 3.0, G + 0.9, -2.1, 0.3);
  V(rc, lathe([[0, 0], [0.13, 0], [0.14, 0.02], [0.14, 0.18], [0.11, 0.22], [0, 0.23]], 24), 0xf3f1ec, 0, 0, 0, 0, 0, 0, vg);
  V(rc, RB(0.1, 0.03, 0.05, 0.01, 1), 0xc4553e, 0, 0.225, 0.05);
  const kt = group(g, 2.68, G + 0.915, -2.08, -0.6);
  V(kt, lathe([[0, 0], [0.08, 0], [0.09, 0.1], [0.07, 0.19], [0.03, 0.21], [0, 0.21]], 20), 0xd9dcdf, 0, 0, 0, 0, 0, 0, vg);
  V(kt, torus(0.06, 0.01, 6, 14, PI), 0x2b2f33, -0.07, 0.15, 0, 0, 0, PI / 2);
  const dr = group(g, 3.85, G + 0.9, -1.85, PI / 2);
  V(dr, RB(0.36, 0.03, 0.26, 0.008, 1), 0xd9dcdf, 0, 0.015, 0);
  for (let i = 0; i < 3; i++) V(dr, CY(0.09, 0.09, 0.012, 20), [0xf6f3ec, 0x86a0b8, 0xf6f3ec][i], -0.1 + i * 0.07, 0.11, 0, 0, 0, PI / 2 - 0.12, vg);
  for (const z of [-1.75, -1.45]) pottedPlant(g, X - 0.08, 1.3, z, { kind: 'herb', h: 0.2, potR: 0.05, potH: 0.08, seed: (z * -10) | 0, pot: 'terracotta' });
  // dining table, four chairs, pendant, flowers, fruit, place mats
  const tx = 2.8, tz = -0.1;
  const tg = group(g, tx, G, tz);
  put(tg, RB(1.3, 0.045, 0.82, 0.012, 2), W.oak, 0, 0.7275, 0);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(tg, RB(0.05, 0.705, 0.05, 0.01, 1), W.oak, a * 0.55, 0.3525, b * 0.31);
  for (const [x, z] of [[-0.3, 0.2], [0.3, -0.2], [0.3, 0.2]]) V(tg, RB(0.36, 0.004, 0.26, 0.002, 1), [0xb9a88c, 0x9fb4c0, 0xd8b4a0, 0xb7c9a8][vi], x, 0.752, z);
  V(tg, lathe([[0, 0], [0.04, 0], [0.05, 0.05], [0.03, 0.14], [0.02, 0.18], [0, 0.18]], 16), 0x86a0b8, 0.0, 0.75, 0.0, 0, 0, 0, vg);
  for (let i = 0; i < 5; i++) { const a = i * 1.26; vrod(tg, 0x5f8a3a, [0, 0.85, 0], [Math.cos(a) * 0.07, 1.02 + (i % 2) * 0.04, Math.sin(a) * 0.05], 0.003, 4); V(tg, SP(0.025, 8, 6), [0xf4f1ea, 0xf7c548, 0xe8546b][i % 3], Math.cos(a) * 0.07, 1.02 + (i % 2) * 0.04, Math.sin(a) * 0.05); }
  mug(tg, 0.32, 0.75, 0.18, 0xf2efe8, 2.0);
  bx(tx - 0.65, G, tz - 0.41, tx + 0.65, G + 0.75, tz + 0.41);
  for (const [cx, side] of [[-0.33, 1], [0.33, 1], [-0.33, -1], [0.33, -1]]) {
    const ch = group(g, tx + cx, G, tz + side * 0.6, side > 0 ? PI : 0);
    chairGeo(ch, W.oak, W.fab);
    const p = ch.position; bx(p.x - 0.22, G, p.z - 0.22, p.x + 0.22, G + 0.5, p.z + 0.22);
  }
  pendant(g, tx, G + 1.78, tz, C, { r: 0.22, shade: hv.shade });
  P.lamps.push({ pos: [tx, G + 1.68, tz], color: 0xffd9a8, intensity: 9, range: 6 });
  if (hv.family === 'table') P.npcSpots.push({ pos: [tx - 0.33, G, tz + 0.5], yaw: 0, pose: 'sit', role: 'guest' });
  wallClock2(g, NA, X - 0.012, G + 2.1, -0.1, -PI / 2, 0.15);
  put(g, RB(0.02, 0.4, 0.32, 0.004, 1), W.white, X - 0.02, G + 1.55, 0.95);
  D(g, IA.quad('cal', 0.3, 0.38), IA.mat, X - 0.031, G + 1.55, 0.95, 0, -PI / 2, 0);
  ceilingDisc(g, W, 2.8, C, -1.2, 0.2);
  P.lamps.push({ pos: [2.8, C - 0.3, -1.4], color: 0xfff0d8, intensity: 8, range: 6 });
  // entry: shoe cabinet with keys and a plant, shoes, mat, umbrella
  cabinetRun(g, 2.1, G, Z1 - 0.17, PI, 0.7, 0.95, 0.34, 2, W.white, W.oak, W.dark, { hw: 0.016, hh: 0.14, hy: 0.8 });
  put(g, RB(0.72, 0.03, 0.36, 0.006, 1), W.walnut, 2.1, G + 0.965, Z1 - 0.17);
  V(g, lathe([[0, 0], [0.08, 0], [0.1, 0.03], [0.095, 0.035], [0.06, 0.008], [0, 0.008]], 20), 0xf3f1ec, 1.95, G + 0.98, Z1 - 0.18, 0, 0, 0, vg);
  V(g, RB(0.05, 0.01, 0.02, 0.003, 1), 0xd8b25a, 1.95, G + 0.995, Z1 - 0.18);
  pottedPlant(g, 2.3, G + 0.98, Z1 - 0.17, { kind: 'bush', h: 0.3, potR: 0.07, potH: 0.12, seed: 9 + vi, pot: 'terracotta' });
  bx(1.75, G, Z1 - 0.36, 2.45, G + 0.97, Z1);
  const shoe = (x, z, ry, col, s2 = 1) => { const sg = group(g, x, G, z, ry); V(sg, RB(0.1 * s2, 0.07 * s2, 0.26 * s2, 0.03, 2), col, 0, 0.045 * s2, 0); V(sg, RB(0.104 * s2, 0.02, 0.27 * s2, 0.008, 1), 0xf2f0ea, 0, 0.01, 0); };
  shoe(1.85, 1.2, 0.1, 0x3b4f73); shoe(1.98, 1.22, -0.1, 0x3b4f73); shoe(2.2, 1.18, 0.3, 0xd9534f, 0.8); shoe(2.32, 1.2, 0.2, 0xd9534f, 0.8);
  V(g, RB(1.0, 0.012, 0.55, 0.004, 1), [0x8a6f5a, 0x56606e, 0x7a8a6a, 0x9a6a5a][vi], H.D0 + 0.55, G + 0.009, Z1 - 0.4);
  umbrellaStand(g, 2.65, G, Z1 - 0.2);
  bx(2.5, G, Z1 - 0.35, 2.8, G + 0.5, Z1);

  // ================= hall (x -0.48..1.2, z -4.4..-0.88): laundry corner, bathroom door, family photos
  const wm = group(g, 0.62, G, Z0 + 0.32, 0);
  V(wm, RB(0.6, 0.85, 0.6, 0.03, 2), 0xf4f4f2, 0, 0.425, 0, 0, 0, 0, vg);
  V(wm, torus(0.2, 0.03, 8, 28), 0xd6d8da, 0, 0.42, 0.3, 0, 0, 0, vg);
  noShadow(put(wm, CY(0.18, 0.18, 0.01, 28), mat('glass'), 0, 0.42, 0.302, PI / 2, 0, 0));
  V(wm, CY(0.17, 0.17, 0.01, 28), 0x3a4a5a, 0, 0.42, 0.296, PI / 2, 0, 0);
  V(wm, RB(0.56, 0.1, 0.02, 0.006, 1), 0xdcdcda, 0, 0.78, 0.3);
  V(wm, CY(0.03, 0.03, 0.02, 14), 0x8a9096, 0.18, 0.78, 0.31, PI / 2, 0, 0);
  bx(0.3, G, Z0, 0.94, G + 0.86, Z0 + 0.64);
  const lb = group(g, -0.05, G, Z0 + 0.35, 0.3);
  V(lb, lathe([[0, 0], [0.18, 0], [0.21, 0.36], [0.2, 0.37], [0, 0.02]], 20), 0xd8c4a0, 0, 0, 0, 0, 0, 0, vcSoft());
  for (let i = 0; i < 4; i++) V(lb, softBox(0.22, 0.06, 0.18, 0.025, 0.02, 0.006, i), [0xf2efe8, 0x8fb0c8, 0xe8b4b8, 0xf2c14e][i], (R() - 0.5) * 0.1, 0.33 + i * 0.03, (R() - 0.5) * 0.1, 0, R() * 3, 0.2, vcSoft());
  bx(-0.3, G, Z0 + 0.1, 0.2, G + 0.4, Z0 + 0.6);
  put(g, RB(1.1, 0.03, 0.28, 0.006, 1), W.oak, 0.38, G + 1.55, Z0 + 0.14);
  for (const [x, c, h] of [[0.05, 0x3d9be9, 0.24], [0.2, 0xf2efe8, 0.2], [0.55, 0x7ac0a8, 0.26], [0.72, 0xe86f8a, 0.18]]) V(g, RB(0.1, h, 0.08, 0.02, 2), c, x, G + 1.565 + h / 2, Z0 + 0.14, 0, 0, 0, vg);
  staticDoor(g, 1.2, G, -3.3, -PI / 2, { w: 0.8, h: 2.05, leaf: W.white, frame: W.white });
  D(g, NA.quad('bath', 0.16, 0.16), NA.mat, 1.2 - 0.04, G + 1.55, -3.3, 0, -PI / 2, 0);
  for (let i = 0; i < 3; i++) { const z = -3.6 + i * 0.5, y = G + 1.5 + (i % 2) * 0.12; put(g, RB(0.025, 0.24, 0.3, 0.006, 1), W.walnut, -0.48 + 0.013, y, z); D(g, IA.quad('photo' + i, 0.26, 0.2), IA.mat, -0.48 + 0.027, y, z, 0, PI / 2, 0); }
  ceilingDisc(g, W, 0.36, C, -2.6, 0.17);
  P.lamps.push({ pos: [0.36, C - 0.3, -2.6], color: 0xfff0d8, intensity: 6, range: 5 });

  // ================= bedroom (x -4.0..-0.6, z -4.4..-1.0)
  const bcx = -2.5, bw = 1.5, bl = 2.05, bcz = Z0 + bl / 2;
  const bg = group(g, bcx, G, bcz, 0);
  put(bg, RB(bw + 0.1, 0.24, bl - 0.08, 0.02, 2), W.oak, 0, 0.2, 0.04);
  put(bg, softBox(bw + 0.12, 0.95, 0.1, 0.05, 0.02, 0.002, 2 + vi), W.fab, 0, 0.6, -bl / 2 + 0.06);
  put(bg, RB(bw, 0.22, bl - 0.16, 0.06, 3), W.linen, 0, 0.43, 0.06);
  V(bg, softBox(bw + 0.08, 0.08, 1.4, 0.04, 0.03, 0.007, 5 + vi), hv.duvet, 0, 0.57, 0.3, 0, 0, 0, vcSoft());
  for (const s2 of [-1, 1]) V(bg, softBox(0.05, 0.26, 1.36, 0.02, 0.0, 0.006, 6 + s2), hv.duvet, s2 * (bw / 2 + 0.05), 0.45, 0.3, 0, 0, 0, vcSoft());
  put(bg, softBox(0.58, 0.14, 0.38, 0.06, 0.05, 0.005, 1), W.linen, -0.34, 0.64, -0.72).rotation.x = -0.35;
  put(bg, softBox(0.58, 0.14, 0.38, 0.06, 0.05, 0.005, 2), W.linen, 0.34, 0.64, -0.72).rotation.x = -0.3;
  const bear = group(bg, 0.42, 0.62, -0.38, -0.4);
  const fur = [0xc8a27a, 0xe9e2d0, 0x8a6a4e, 0xe8b4b8][vi];
  V(bear, SP(0.11, 14, 10), fur, 0, 0.1, 0, 0, 0, 0, vcSoft()); V(bear, SP(0.085, 14, 10), fur, 0, 0.26, 0.02, 0, 0, 0, vcSoft());
  for (const s2 of [-1, 1]) { V(bear, SP(0.035, 10, 8), fur, s2 * 0.06, 0.34, 0.0, 0, 0, 0, vcSoft()); V(bear, SP(0.04, 10, 8), fur, s2 * 0.08, 0.03, 0.07, 0, 0, 0, vcSoft()); }
  V(bear, SP(0.012, 8, 6), 0x222326, 0, 0.255, 0.1);
  bx(bcx - bw / 2 - 0.06, G, Z0, bcx + bw / 2 + 0.06, G + 0.66, Z0 + bl);
  for (const s2 of [-1, 1]) {
    const nx = bcx + s2 * (bw / 2 + 0.3), ng = group(g, nx, G, Z0 + 0.25, 0);
    put(ng, RB(0.4, 0.5, 0.4, 0.015, 2), W.oak, 0, 0.29, 0);
    put(ng, RB(0.36, 0.18, 0.02, 0.006, 1), W.oak, 0, 0.42, 0.2);
    put(ng, SP(0.013, 8, 6), W.dark, 0, 0.42, 0.215);
    if (s2 < 0) {
      const lg = group(ng, 0, 0.54, -0.04);
      put(lg, lathe([[0, 0], [0.07, 0], [0.075, 0.02], [0.06, 0.12], [0.03, 0.2], [0.012, 0.22], [0, 0.22]], 20), W.ceramic, 0, 0, 0);
      put(lg, CY(0.1, 0.13, 0.17, 24, true), W.linen, 0, 0.3, 0);
      noShadow(put(lg, SP(0.04, 10, 8), W.lamp, 0, 0.26, 0));
    } else { mug(ng, 0.1, 0.54, 0.06, 0xe7b851, 0.5); V(ng, RB(0.16, 0.03, 0.22, 0.004, 1), 0x3d6aa8, -0.06, 0.555, 0.04, 0, 0.2, 0); }
    bx(nx - 0.2, G, Z0, nx + 0.2, G + 0.55, Z0 + 0.45);
  }
  cabinetRun(g, -0.9, G, (Z0 - 2.45) / 2, -PI / 2, -2.45 - Z0, 2.3, 0.6, 3, W.white, W.white, W.oak, { hw: 0.02, hh: 0.5, hy: 1.1 });
  bx(-1.2, G, Z0, -0.6, G + 2.3, -2.45);
  // desk under the west window with chair, laptop, books, lamp
  const dg = group(g, -X + 0.28, G, -1.6, PI / 2);
  put(dg, RB(1.1, 0.035, 0.55, 0.008, 2), W.oak, 0, 0.74, 0);
  for (const s2 of [-1, 1]) put(dg, RB(0.035, 0.72, 0.5, 0.006, 1), W.white, s2 * 0.52, 0.36, 0);
  for (let i = 0; i < 7; i++) V(dg, box(0.03, 0.2 + (i % 3) * 0.03, 0.16), [0x3d6aa8, 0xc4553e, 0xe7b851, 0x86a08a, 0x8a5a7a][i % 5], -0.5 + i * 0.033, 0.857 + (i % 3) * 0.015, -0.16);
  const lap = group(dg, 0.05, 0.7575, 0.04, 0);
  V(lap, RB(0.34, 0.015, 0.24, 0.006, 1), 0xb0b4ba, 0, 0.0075, 0, 0, 0, 0, vg);
  const lid = V(lap, RB(0.34, 0.24, 0.012, 0.006, 1), 0xb0b4ba, 0, 0.12, -0.12, 0, 0, 0, vg); lid.rotation.x = -0.25;
  const dl = group(dg, 0.4, 0.7575, -0.15);
  put(dl, CY(0.07, 0.075, 0.02, 20), W.dark, 0, 0.01, 0);
  rod(dl, W.dark, [0, 0.02, 0], [0.02, 0.36, 0.05], 0.008);
  rod(dl, W.dark, [0.02, 0.36, 0.05], [-0.08, 0.42, 0.18], 0.008);
  put(dl, CY(0.03, 0.075, 0.1, 18, true), W.dark, -0.09, 0.4, 0.2, 0.7, 0, 0);
  noShadow(put(dl, SP(0.025, 8, 6), W.lamp, -0.09, 0.38, 0.2));
  bx(-X, G, -2.15, -X + 0.56, G + 0.78, -1.05);
  const dc = group(g, -X + 0.85, G, -1.55, -PI / 2 + 0.25);
  chairGeo(dc, W.white, W.fab);
  bx(-X + 0.62, G, -1.78, -X + 1.08, G + 0.5, -1.32);
  put(g, RB(1.7, 0.012, 1.2, 0.006, 1), W.rug, -2.4, G + 0.009, -1.75);
  put(g, RB(0.6, 0.46, 0.025, 0.006, 1), W.white, -2.2, G + 1.6, -1.0 - 0.025);
  D(g, NA.quad('kids', 0.56, 0.42), NA.mat, -2.2, G + 1.6, -1.0 - 0.039, 0, PI, 0);
  ceilingDisc(g, W, -2.3, C, -2.7, 0.22);
  P.lamps.push({ pos: [-2.3, C - 0.3, -2.7], color: 0xffe2b8, intensity: 8, range: 6 });
  bake(g);
  return P;
}

/** Viewer helpers: the site plus its lazily built interior (and counts in the console). */
function withInterior(S) {
  const t0 = performance.now();
  const cold = S.extra.interior.build();
  const t1 = performance.now();
  const P = S.extra.interior.build();
  const t2 = performance.now();
  cold.group.traverse((o) => o.geometry?.dispose?.());
  S.group.add(P.group);
  S.colliders.push(...P.colliders);
  S.interactables.push(...P.interactables);
  S.extra.interiorStats = { ...stats(P.group), coldMs: Math.round(t1 - t0), warmMs: Math.round(t2 - t1), colliders: P.colliders.length, lamps: P.lamps.length, npc: P.npcSpots.length };
  console.warn('INTERIOR', S.name, JSON.stringify(S.extra.interiorStats));
  return S;
}
export function neighborWithInterior({ seed = 2 } = {}) { return withInterior(buildApartment({ main: false, dong: `10${seed}동`, seed })); }
export function houseWithInterior({ variant = 0 } = {}) { return withInterior(buildHouse({ variant })); }
