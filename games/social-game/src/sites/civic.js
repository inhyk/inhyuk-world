// Civic buildings and bigger shops for the town (인혁: "건물을 더 만들어줘", 2026-11-05):
// fire station, police station, cinema, supermarket, bank, post office, fried-chicken shop, pizza shop.
// buildCivic({kind}) → Site (see ../site.js), entrance faces +Z. Exterior only (not walkable inside):
// colliders wrap the masses, shallow dressed interiors sit behind the glass, signs and windows glow at night.
// The fire truck and patrol car are static models baked into the site.
import * as THREE from 'three';
import { mat, paint, textured } from '../mat.js';
import { box, quad, put, group, bake, torus, lathe, extrude, prep, aabb, displace } from '../geom.js';
import { FONT, canvasTex } from '../tex.js';
import { makeSite, solid } from '../site.js';
import { rng } from '../noise.js';
import { buildCar } from '../props/car.js';
import { hydrant, bench } from '../props/street.js';
import { PI, RB, CY, SP, V, D, Atlas, txt, rr, pottedPlant, vcMat, vcGloss, vcSoft, officeChair, sofa, pendant, cached } from './office.js';

/** Footprints (X x Z, metres) and names. */
export const CIVIC = {
  fire: { w: 18, d: 14, name: '세온 소방서' },
  police: { w: 16, d: 12, name: '세온 경찰서' },
  cinema: { w: 24, d: 18, name: '세온 시네마' },
  mart: { w: 30, d: 20, name: '세온 마트' },
  bank: { w: 12, d: 10, name: '세온 은행' },
  post: { w: 12, d: 10, name: '세온 우체국' },
  chicken: { w: 10, d: 9, name: '바삭 치킨' },
  pizza: { w: 10, d: 9, name: '피자 하우스' },
  gallery: { w: 20, d: 16, name: '세온 갤러리' },
};
export const CIVIC_KINDS = Object.keys(CIVIC);

const FR = 0x2b2d31;
const _up = new THREE.Vector3(0, 1, 0);
function rod(p, a, b, r, hex, m = vcMat(), seg = 8) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
  const o = V(p, CY(r, r, d.length(), seg), hex, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2, 0, 0, 0, m);
  o.quaternion.setFromUnitVectors(_up, d.normalize());
  return o;
}
const redGlow = () => paint(0xff3a30, 0.4, 0, { emissive: 0xff1a12, emissiveIntensity: 2.2 });
const blueGlow = () => paint(0x3a7bff, 0.4, 0, { emissive: 0x2a64ff, emissiveIntensity: 2.4 });
const amberGlow = () => paint(0xffb347, 0.4, 0, { emissive: 0xff8a1a, emissiveIntensity: 2.4 });

/* ------------------------------------------------------------------ canvas helpers */
function fit(c, s, x, y, px, maxW, color, align = 'center', base = 'middle') {
  c.font = `${px}px ${FONT}`;
  const m = c.measureText(s).width;
  txt(c, s, x, y, m > maxW ? px * maxW / m : px, color, align, base);
}
function grad(c, w, h, a, b) { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(0, 0, w, h); }
function glowSpot(c, x, y, r, col = 'rgba(255,236,190,0.85)') {
  const g = c.createRadialGradient(x, y, 2, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,236,190,0)');
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
}
function rooms(A, cols) {
  for (let i = 0; i < 3; i++) A.add('room' + i, 200, 150, (c, w, h) => {
    grad(c, w, h, '#fffaf0', cols[i % cols.length]);
    c.fillStyle = 'rgba(80,70,60,0.35)'; c.fillRect(0, h * 0.72, w, h * 0.28);
    glowSpot(c, w * (0.3 + 0.2 * i), 0, w * 0.6);
    c.fillStyle = '#f7f5ef'; c.fillRect(w * 0.15, 4, w * 0.7, 5);
    c.fillStyle = '#6f5a46'; c.fillRect(w * 0.12, h * 0.66, w * 0.5, 8); c.fillRect(w * 0.15, h * 0.66, 6, h * 0.34); c.fillRect(w * 0.56, h * 0.66, 6, h * 0.34);
    c.fillStyle = '#2b2d31'; c.fillRect(w * 0.26, h * 0.48, w * 0.17, h * 0.18); c.fillStyle = '#a9cce6'; c.fillRect(w * 0.27, h * 0.5, w * 0.15, h * 0.13);
    c.fillStyle = '#c9cdd2'; c.fillRect(w * 0.72, h * 0.36, w * 0.2, h * 0.64); c.fillStyle = '#aeb3b9'; for (let k = 1; k < 4; k++) c.fillRect(w * 0.72, h * (0.36 + k * 0.16), w * 0.2, 2);
    c.fillStyle = 'rgba(246,246,242,0.93)'; for (let y = 0; y < h * (0.16 + 0.14 * i); y += 7) c.fillRect(0, y, w, 5);
  });
}

/* ------------------------------------------------------------------ building kit */
function makeKit(site, A, seed) {
  const C = { site, g: site.group, colliders: site.colliders, A, R: rng(seed), glass: mat('glass'), tinted: mat('tintedGlass'), lamp: mat('lampGlow'), cool: mat('coolGlow') };
  C.sign = A.lit(1.6, 0xffffff); C.sign.name = 'civicSign';
  C.win = A.lit(0.85, 0xffffff); C.win.name = 'civicWin';
  C.print = A.printed(0.6);
  site.nightGlow.push(C.sign, C.win, C.lamp, C.cool);
  return C;
}
/** Glazed bay x0..x1, y0..y1, glass at zf, shallow lit interior `depth` deep showing atlas item `back`. */
function glazing(C, x0, x1, y0, y1, zf, o = {}) {
  const { g, A } = C, bw = x1 - x0, cx = (x0 + x1) / 2, h = y1 - y0, fr = o.frame ?? FR;
  const n = Math.max(1, Math.round(bw / (o.pane ?? 2)));
  for (let i = 0; i <= n; i++) V(g, RB(0.07, h, 0.12, 0.01, 1), fr, x0 + 0.035 + (bw - 0.07) * i / n, y0 + h / 2, zf);
  V(g, RB(bw, 0.08, 0.14, 0.01, 1), fr, cx, y0, zf);
  V(g, RB(bw, 0.08, 0.14, 0.01, 1), fr, cx, y1, zf);
  if (o.transom) V(g, RB(bw, 0.05, 0.1, 0.01, 1), fr, cx, o.transom, zf);
  D(g, quad(bw, h), C.glass, cx, y0 + h / 2, zf - 0.01);
  if (o.back) {
    const depth = o.depth ?? 0.8, zb = zf - depth;
    D(g, A.quad(o.back, bw, h), C.win, cx, y0 + h / 2, zb);
    V(g, RB(bw, 0.05, depth, 0.01, 1), o.floor ?? 0xb9b2a6, cx, y0 - 0.02, zb + depth / 2);
    V(g, RB(bw, 0.04, depth, 0.01, 1), 0xf2f0ea, cx, y1 + 0.02, zb + depth / 2);
    D(g, RB(bw - 0.3, 0.02, 0.06, 0.005, 1), C.lamp, cx, y1 - 0.01, zb + depth * 0.55);
    for (const x of [x0, x1]) V(g, RB(0.05, h, depth, 0.01, 1), o.side ?? 0xece8e0, x, y0 + h / 2, zb + depth / 2);
  }
}
/** Punched windows with lit rooms. */
function windows(C, xs, y, zf, ww, wh, fr, sillM, see = false) {
  const { g, A } = C;
  xs.forEach((x, i) => {
    if (!see) D(g, A.quad('room' + ((i + Math.round(y)) % 3), ww, wh), C.win, x, y + wh / 2, zf + 0.012);
    D(g, quad(ww, wh), C.glass, x, y + wh / 2, zf + 0.07);
    V(g, RB(ww + 0.16, 0.08, 0.16, 0.015, 1), fr, x, y + wh + 0.04, zf + 0.07);
    V(g, RB(ww + 0.16, 0.08, 0.16, 0.015, 1), fr, x, y - 0.04, zf + 0.07);
    for (const s of [-1, 1]) V(g, RB(0.08, wh, 0.16, 0.015, 1), fr, x + s * (ww / 2 + 0.04), y + wh / 2, zf + 0.07);
    V(g, RB(0.05, wh, 0.07, 0.01, 1), fr, x, y + wh / 2, zf + 0.08);
    if (sillM) put(g, RB(ww + 0.34, 0.07, 0.24, 0.02, 1), sillM, x, y - 0.115, zf + 0.12);
  });
}
/** Glass door (single or double leaf) in a frame, front face at zf. */
function glassDoor(C, x, zf, w, h, fr, back) {
  const { g } = C;
  V(g, RB(w + 0.16, 0.1, 0.14, 0.01, 1), fr, x, h + 0.05, zf);
  for (const s of [-1, 1]) V(g, RB(0.08, h, 0.14, 0.01, 1), fr, x + s * (w / 2 + 0.04), h / 2, zf);
  const leaves = w > 1.5 ? [[-w / 4, w / 2], [w / 4, w / 2]] : [[0, w]];
  for (const [lx, lw] of leaves) {
    for (const s of [-1, 1]) V(g, RB(0.06, h - 0.05, 0.05, 0.01, 1), fr, x + lx + s * (lw / 2 - 0.03), (h - 0.05) / 2, zf + 0.01);
    V(g, RB(lw, 0.14, 0.05, 0.01, 1), fr, x + lx, 0.07, zf + 0.01);
    D(g, quad(lw - 0.1, h - 0.2), C.glass, x + lx, h / 2, zf + 0.01);
    const hx = x + lx + (w > 1.5 ? -Math.sign(lx) * (lw / 2 - 0.12) : lw / 2 - 0.12);
    rod(g, [hx, 0.85, zf + 0.08], [hx, 1.35, zf + 0.08], 0.014, 0xc9ced3, mat('steel'));
  }
  if (back) {
    D(g, C.A.quad(back, w, h), C.win, x, h / 2, zf - 0.7);
    V(g, RB(w, 0.04, 0.7, 0.01, 1), 0x9a958c, x, 0.02, zf - 0.35);
    for (const s of [-1, 1]) V(g, RB(0.05, h, 0.7, 0.01, 1), 0xece8e0, x + s * w / 2, h / 2, zf - 0.35);
  }
}
/* ------------------------------------------------------------------ enterable shell (walls with holes, floor, doors) */
const FL = 0.15; // interior floor top
/** Rectangles covering u0..u1 x v0..v1 minus holes [[a0, a1, b0, b1]] (holes must not overlap along u). */
function rects(u0, u1, v0, v1, holes = []) {
  const out = [];
  let u = u0;
  for (const [a0, a1, b0, b1] of [...holes].sort((a, b) => a[0] - b[0])) {
    if (a0 > u + 1e-3) out.push([u, a0, v0, v1]);
    if (b0 > v0 + 1e-3) out.push([a0, a1, v0, b0]);
    if (b1 < v1 - 1e-3) out.push([a0, a1, b1, v1]);
    u = a1;
  }
  if (u1 > u + 1e-3) out.push([u, u1, v0, v1]);
  return out;
}
/**
 * Wall with holes. axis 'x': runs along X (u = x) with its outer face at z = o; axis 'z': runs along Z (u = z),
 * outer face at x = o. dir (+1/-1) points into the room. outM = outer skin, inM = 2 cm inner lining (optional).
 * T is anything with {g, colliders}.
 */
function wall(T, axis, o, dir, u0, u1, v0, v1, t, outM, inM, holes = [], collide = true) {
  for (const [a, b, c, d] of rects(u0, u1, v0, v1, holes)) {
    const w = b - a, h = d - c, cu = (a + b) / 2, cv = (c + d) / 2, to = inM ? t - 0.02 : t;
    const co = o + dir * to / 2, ci = o + dir * (t - 0.01), lo = Math.min(o, o + dir * t), hi = Math.max(o, o + dir * t);
    if (axis === 'x') {
      if (outM) put(T.g, box(w, h, to), outM, cu, cv, co);
      if (inM) put(T.g, box(w, h, 0.02), inM, cu, cv, ci);
      if (collide) T.colliders.push(aabb(a, c, lo, b, d, hi));
    } else {
      if (outM) put(T.g, box(to, h, w), outM, co, cv, cu);
      if (inM) put(T.g, box(0.02, h, w), inM, ci, cv, cu);
      if (collide) T.colliders.push(aabb(lo, c, a, hi, d, b));
    }
  }
}
/** Floor slab (top at y) with collider. */
function slab(T, x0, x1, z0, z1, m, y = FL) {
  put(T.g, box(x1 - x0, y, z1 - z0), m, (x0 + x1) / 2, y / 2, (z0 + z1) / 2);
  T.colliders.push(aabb(x0, 0, z0, x1, y, z1));
}
/** Ceiling board (bottom at y) and a grid of light panels. */
function ceilingWithLights(T, x0, x1, z0, z1, y, m, lightM, nx, nz, lw = 1.2, ld = 0.3) {
  put(T.g, box(x1 - x0, 0.06, z1 - z0), m, (x0 + x1) / 2, y + 0.03, (z0 + z1) / 2).castShadow = false;
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
    const x = x0 + (x1 - x0) * (i + 0.5) / nx, z = z0 + (z1 - z0) * (k + 0.5) / nz;
    V(T.g, RB(lw + 0.06, 0.03, ld + 0.06, 0.01, 1), 0xe6e6e2, x, y - 0.01, z);
    D(T.g, RB(lw, 0.02, ld, 0.008, 1), lightM, x, y - 0.03, z);
  }
}
/** Automatic sliding glass door (one or two leaves) in the wall plane z, centred at x, standing on y. */
function slideDoor(C, x, z, w, h, y, fr = FR, stripe = 0xffffff) {
  const g = C.g, n = w > 1.25 ? 2 : 1, lw = w / n;
  V(g, RB(w + 0.22, 0.14, 0.22, 0.01, 1), fr, x, y + h + 0.07, z);
  for (const s of [-1, 1]) V(g, RB(0.11, h, 0.22, 0.01, 1), fr, x + s * (w / 2 + 0.055), y + h / 2, z);
  V(g, RB(0.36, 0.08, 0.08, 0.02, 1), 0x2b2d31, x, y + h + 0.2, z + 0.13);
  D(g, RB(0.05, 0.02, 0.01, 0.005, 1), redGlow(), x + 0.11, y + h + 0.2, z + 0.172);
  put(g, RB(w + 0.1, 0.02, 0.26, 0.005, 1), mat('steel'), x, y + 0.01, z);
  for (let i = 0; i < n; i++) {
    const s = n === 1 ? 1 : i ? 1 : -1, cx = n === 1 ? x : x + s * lw / 2;
    const piv = group(g, cx, y, z); piv.userData.dynamic = true;
    for (const [px, py, sx, sy] of [[0, h - 0.04, lw, 0.08], [0, 0.06, lw, 0.12], [-lw / 2 + 0.03, h / 2, 0.06, h], [lw / 2 - 0.03, h / 2, 0.06, h]]) V(piv, RB(sx, sy, 0.05, 0.01, 1), fr, px, py, 0);
    D(piv, box(lw - 0.06, h - 0.16, 0.012), C.glass, 0, h / 2 + 0.02, 0).renderOrder = 2;
    V(piv, box(lw - 0.1, 0.05, 0.018), stripe, 0, 1.45, 0);
    const hx = n === 1 ? -lw / 2 + 0.13 : -s * (lw / 2 - 0.11);
    for (const e of [-1, 1]) V(piv, RB(0.03, 0.55, 0.03, 0.01, 1), 0xc9ced3, hx, 1.05, e * 0.045, 0, 0, 0, vcGloss());
    bake(piv);
    C.site.doors.push({ pivot: piv, openAngle: 0, slide: [s * (lw - 0.1), 0, 0], auto: true, collider: aabb(cx - lw / 2, y, z - 0.05, cx + lw / 2, y + h, z + 0.05) });
  }
}

/** Box sign with a lit face. */
function signBox(C, key, x, y, z, w, h, col = FR, depth = 0.16) {
  put(C.g, RB(w + 0.14, h + 0.14, depth, 0.03, 2), paint(col, 0.4, 0.3), x, y, z);
  D(C.g, C.A.quad(key, w, h), C.sign, x, y, z + depth / 2 + 0.006);
}
/** Parapet, coping and roof deck over the box x0..x1, z0..z1 with roof at H. */
function roofEdge(C, x0, x1, z0, z1, H, ph, wallM, trimM) {
  const { g } = C, w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  put(g, RB(w, ph, 0.28, 0.02, 1), wallM, cx, H + ph / 2, z1 - 0.14);
  put(g, RB(w, ph, 0.28, 0.02, 1), wallM, cx, H + ph / 2, z0 + 0.14);
  for (const x of [x0 + 0.14, x1 - 0.14]) put(g, RB(0.28, ph, d - 0.56, 0.02, 1), wallM, x, H + ph / 2, cz);
  put(g, RB(w + 0.1, 0.08, 0.38, 0.02, 1), trimM, cx, H + ph + 0.04, z1 - 0.14);
  put(g, RB(w + 0.1, 0.08, 0.34, 0.02, 1), trimM, cx, H + ph + 0.04, z0 + 0.14);
  for (const x of [x0 + 0.12, x1 - 0.12]) put(g, RB(0.36, 0.08, d, 0.02, 1), trimM, x, H + ph + 0.04, cz);
  put(g, RB(w - 0.5, 0.06, d - 0.5, 0.02, 1), mat('concrete'), cx, H + 0.03, cz);
}
function acUnit(C, x, y, z) {
  V(C.g, RB(1.0, 0.7, 0.6, 0.04, 2), 0xd9dcdd, x, y + 0.35, z, 0, 0, 0, vcGloss());
  V(C.g, CY(0.22, 0.22, 0.02, 20), 0x55595e, x, y + 0.37, z + 0.31, PI / 2);
}
function sconce(C, x, y, z) {
  V(C.g, RB(0.14, 0.24, 0.04, 0.01, 1), FR, x, y, z + 0.02);
  V(C.g, CY(0.07, 0.05, 0.16, 16), FR, x, y, z + 0.14, 0, 0, 0, vcGloss());
  D(C.g, CY(0.045, 0.045, 0.01, 14), C.lamp, x, y - 0.09, z + 0.14);
}
function wheel(p, x, y, z, r, w, rim = 0xd8d8d8) {
  V(p, CY(r, r, w, 22), 0x1b1b1d, x, y, z, 0, 0, PI / 2);
  V(p, CY(r * 0.62, r * 0.62, w + 0.02, 18), rim, x, y, z, 0, 0, PI / 2, vcGloss());
  V(p, CY(r * 0.22, r * 0.22, w + 0.06, 10), 0x55585c, x, y, z, 0, 0, PI / 2, vcGloss());
}
/** Delivery scooter, forward +X, with a box showing atlas item `boxKey` on its sides. */
function scooter(C, x, z, ry, col, boxCol, boxKey) {
  const g = group(C.g, x, 0, z, ry), gl = vcGloss();
  for (const wx of [-0.56, 0.6]) {
    V(g, torus(0.2, 0.065, 8, 22), 0x1b1b1d, wx, 0.25, 0);
    V(g, CY(0.13, 0.13, 0.1, 16), 0xc9ced3, wx, 0.25, 0, PI / 2, 0, 0, gl);
  }
  V(g, RB(0.8, 0.42, 0.42, 0.16, 2), col, -0.3, 0.58, 0, 0, 0, 0, gl);
  V(g, RB(0.55, 0.08, 0.34, 0.03, 1), 0x2b2d31, 0.18, 0.36, 0);
  V(g, RB(0.13, 0.78, 0.42, 0.06, 2), col, 0.48, 0.66, 0, 0, 0, -0.28, gl);
  V(g, RB(0.42, 0.06, 0.18, 0.03, 1), col, 0.66, 0.5, 0, 0, 0, 0.2, gl);
  rod(g, [0.62, 0.3, 0], [0.5, 1.0, 0], 0.03, 0x9aa0a6, gl);
  rod(g, [0.5, 1.06, -0.32], [0.5, 1.06, 0.32], 0.018, 0x3a3b3d);
  V(g, RB(0.14, 0.14, 0.24, 0.04, 2), col, 0.52, 1.02, 0, 0, 0, 0, gl);
  D(g, CY(0.06, 0.06, 0.02, 16), C.lamp, 0.6, 1.02, 0, 0, 0, PI / 2);
  for (const s of [-1, 1]) { rod(g, [0.5, 1.06, s * 0.22], [0.46, 1.25, s * 0.28], 0.008, 0x2b2d31); V(g, RB(0.03, 0.06, 0.1, 0.01, 1), 0x2b2d31, 0.46, 1.27, s * 0.29); }
  V(g, RB(0.62, 0.11, 0.32, 0.05, 2), 0x1f1f22, -0.22, 0.83, 0, 0, 0, 0, vcSoft());
  V(g, RB(0.12, 0.06, 0.3, 0.02, 1), 0xb02020, -0.72, 0.62, 0, 0, 0, 0, gl);
  // delivery box on a rack
  V(g, RB(0.5, 0.04, 0.36, 0.01, 1), 0x3a3b3d, -0.6, 0.9, 0);
  V(g, RB(0.52, 0.46, 0.46, 0.04, 2), boxCol, -0.6, 1.15, 0, 0, 0, 0, gl);
  for (const s of [-1, 1]) D(g, C.A.quad(boxKey, 0.44, 0.3), C.print, -0.6, 1.15, s * 0.235, 0, s > 0 ? 0 : PI, 0);
  D(g, C.A.quad(boxKey, 0.4, 0.27), C.print, -0.865, 1.15, 0, 0, -PI / 2, 0);
  rod(g, [-0.15, 0.3, 0.12], [-0.25, 0.02, 0.28], 0.012, 0x55585c);
  return g;
}

/* ================================================================== 소방서 (fire station) */
function fireTruck(C, x, z) {
  const g = group(C.g, x, 0, z), gl = vcGloss(), RED = 0xc4161c, W = 2.45;
  const chrome = mat('chrome');
  V(g, RB(1.0, 0.3, 6.4, 0.02, 1), 0x1f2023, 0, 0.62, -0.2);
  for (const az of [2.25, -1.75, -2.85]) for (const s of [-1, 1]) wheel(g, s * (W / 2 - 0.22), 0.52, az, 0.52, 0.4);
  for (const [az, l] of [[2.25, 1.25], [-2.3, 2.35]]) for (const s of [-1, 1]) V(g, RB(0.5, 0.08, l, 0.03, 2), 0x1b1b1d, s * (W / 2 - 0.2), 1.1, az);
  // cab: hollow shell (lower block, walls around the windows, roof) with seats, dash and wheel inside
  V(g, RB(W, 0.56, 2.2, 0.1, 2), RED, 0, 1.2, 2.4, 0, 0, 0, gl);
  V(g, RB(W, 0.56, 0.12, 0.04, 2), RED, 0, 1.76, 3.44, 0, 0, 0, gl);
  V(g, RB(W, 0.14, 2.2, 0.06, 2), RED, 0, 3.0, 2.4, 0, 0, 0, gl);
  V(g, RB(W, 1.6, 0.12, 0.04, 2), RED, 0, 2.27, 1.36, 0, 0, 0, gl);
  for (const s of [-1, 1]) {
    V(g, RB(0.2, 1.0, 0.12, 0.04, 2), RED, s * (W / 2 - 0.1), 2.48, 3.44, 0, 0, 0, gl);
    V(g, RB(0.1, 0.62, 2.2, 0.04, 2), RED, s * (W / 2 - 0.05), 1.79, 2.4, 0, 0, 0, gl);
    V(g, RB(0.1, 0.12, 2.2, 0.04, 2), RED, s * (W / 2 - 0.05), 2.93, 2.4, 0, 0, 0, gl);
    V(g, RB(0.1, 0.84, 0.66, 0.04, 2), RED, s * (W / 2 - 0.05), 2.5, 1.63, 0, 0, 0, gl);
    V(g, RB(0.1, 0.84, 0.36, 0.04, 2), RED, s * (W / 2 - 0.05), 2.5, 3.32, 0, 0, 0, gl);
    // seats
    V(g, RB(0.52, 0.16, 0.5, 0.05, 2), 0x2b2d31, s * 0.55, 1.66, 2.0, 0, 0, 0, vcSoft());
    V(g, RB(0.52, 0.8, 0.14, 0.05, 2), 0x2b2d31, s * 0.55, 2.12, 1.66, -0.14, 0, 0, vcSoft());
    V(g, RB(0.3, 0.16, 0.1, 0.04, 1), 0x2b2d31, s * 0.55, 2.62, 1.6, -0.14, 0, 0, vcSoft());
  }
  V(g, RB(W - 0.2, 0.34, 0.46, 0.05, 2), 0x2b2d31, 0, 2.08, 3.15, 0, 0, 0, vcSoft());
  V(g, RB(W - 0.25, 0.04, 0.3, 0.01, 1), 0x1b1b1d, 0, 2.27, 3.2);
  D(g, C.A.quad('gauges', 0.5, 0.16), C.sign, 0.55, 2.2, 2.915, -0.35, 0, 0);
  V(g, torus(0.2, 0.025, 8, 24), 0x1b1b1d, 0.55, 2.3, 2.78, -1.0, 0, 0);
  rod(g, [0.55, 2.3, 2.78], [0.55, 2.12, 3.05], 0.03, 0x2b2d31);
  for (const a of [0, 2.1, 4.2]) rod(g, [0.55, 2.3, 2.78], [0.55 + Math.cos(a) * 0.19, 2.3 + Math.sin(a) * 0.19 * 0.54, 2.78 + Math.sin(a) * 0.19 * 0.84], 0.012, 0x2b2d31);
  V(g, RB(0.22, 0.3, 0.3, 0.03, 1), 0x3a3b3d, 0, 1.75, 2.6);
  D(g, RB(0.12, 0.04, 0.01, 0.005, 1), redGlow(), 0, 1.86, 2.76);
  V(g, RB(W - 0.02, 0.14, 2.1, 0.05, 2), 0xf4f4f2, 0, 3.12, 2.4, 0, 0, 0, gl);
  D(g, quad(W - 0.36, 0.95), C.tinted, 0, 2.48, 3.505);
  V(g, RB(W - 0.3, 0.06, 0.04, 0.01, 1), 0x1b1b1d, 0, 1.98, 3.51);
  for (const s of [-1, 1]) {
    D(g, quad(1.2, 0.8), C.tinted, s * (W / 2 + 0.005), 2.5, 2.55, 0, s * PI / 2, 0);
    D(g, C.A.quad('truckDoor', 0.95, 0.5), C.print, s * (W / 2 + 0.006), 1.62, 2.45, 0, s * PI / 2, 0);
    V(g, RB(0.04, 0.03, 0.18, 0.01, 1), 0xd0d4d8, s * (W / 2 + 0.02), 1.95, 1.9, 0, 0, 0, gl);
    rod(g, [s * (W / 2), 2.7, 3.2], [s * (W / 2 + 0.3), 2.6, 3.3], 0.02, 0x2b2d31);
    V(g, RB(0.08, 0.36, 0.2, 0.03, 2), 0x2b2d31, s * (W / 2 + 0.32), 2.45, 3.3);
    V(g, RB(0.5, 0.05, 0.4, 0.01, 1), 0xc9ced3, s * (W / 2 - 0.1), 0.62, 2.0, 0, 0, 0, gl);
  }
  put(g, RB(1.4, 0.62, 0.06, 0.02, 1), chrome, 0, 1.3, 3.52);
  for (let k = 0; k < 5; k++) V(g, RB(1.25, 0.04, 0.02, 0.005, 1), 0x1b1b1d, 0, 1.08 + k * 0.11, 3.555);
  for (const s of [-1, 1]) {
    D(g, CY(0.13, 0.13, 0.04, 18), C.lamp, s * 0.92, 1.3, 3.52, PI / 2);
    D(g, RB(0.18, 0.08, 0.03, 0.01, 1), amberGlow(), s * 0.92, 1.05, 3.52);
  }
  put(g, RB(W + 0.12, 0.26, 0.28, 0.06, 2), chrome, 0, 0.78, 3.6);
  D(g, C.A.quad('n119', 0.8, 0.3), C.print, 0, 1.8, 3.512);
  // light bar
  V(g, RB(1.9, 0.08, 0.34, 0.02, 1), 0x2b2d31, 0, 3.23, 2.8);
  for (const s of [-1, 0, 1]) D(g, RB(0.55, 0.16, 0.3, 0.05, 2), s === 0 ? C.cool : redGlow(), s * 0.62, 3.35, 2.8);
  // body with roller-shutter lockers and a white stripe
  V(g, RB(W, 2.0, 4.7, 0.08, 2), RED, 0, 2.05, -1.15, 0, 0, 0, gl);
  V(g, RB(W + 0.03, 0.16, 4.7, 0.03, 1), 0xf4f4f2, 0, 1.38, -1.15, 0, 0, 0, gl);
  const shutter = textured('siding', { color: 0xd8dadc, count: 16 }, 1.2, { metalness: 0.8, roughness: 0.4, normal: 1 });
  for (const s of [-1, 1]) for (const zc of [-2.95, -1.55, -0.15]) {
    put(g, box(0.03, 1.05, 1.25), shutter, s * (W / 2 + 0.012), 2.2, zc);
    V(g, RB(0.05, 0.05, 1.3, 0.01, 1), 0x9aa0a6, s * (W / 2 + 0.03), 1.66, zc, 0, 0, 0, gl);
  }
  // pump panel between cab and body
  for (const s of [-1, 1]) {
    put(g, RB(0.05, 1.2, 0.5, 0.01, 1), chrome, s * (W / 2 + 0.01), 1.9, 1.0);
    for (let k = 0; k < 3; k++) V(g, CY(0.07, 0.07, 0.04, 14), 0xf4f4f2, s * (W / 2 + 0.04), 2.25 - k * 0.25, 1.0, 0, 0, PI / 2);
    V(g, torus(0.28, 0.06, 8, 20), 0xe8c24a, s * (W / 2 + 0.1), 1.8, -3.0, 0, PI / 2, 0, vcSoft());
  }
  // ladder on top
  const ly = 3.3;
  V(g, CY(0.55, 0.6, 0.25, 24), 0xd0d4d8, 0, 3.17, -2.9, 0, 0, 0, gl);
  for (const s of [-1, 1]) V(g, RB(0.08, 0.14, 6.2, 0.02, 1), 0xe6e8ea, s * 0.45, ly, -0.3, 0, 0, 0, gl);
  for (let k = 0; k < 20; k++) V(g, CY(0.025, 0.025, 0.9, 8), 0xc9ced3, 0, ly, -3.3 + k * 0.31, 0, 0, PI / 2, gl);
  V(g, RB(1.0, 0.25, 0.2, 0.02, 1), 0x2b2d31, 0, 3.13, 1.15);
  for (const s of [-1, 1]) {
    D(g, SP(0.09, 10, 8), redGlow(), s * (W / 2 - 0.12), 3.1, -3.4);
    D(g, RB(0.22, 0.3, 0.03, 0.02, 1), redGlow(), s * (W / 2 - 0.2), 1.3, -3.52);
  }
  V(g, RB(W - 0.2, 0.08, 0.4, 0.02, 1), 0xc9ced3, 0, 0.55, -3.65, 0, 0, 0, gl);
  return g;
}

function buildFire(C) {
  const { g, site, A } = C;
  const red = textured('brick', { color: 0xb8352b, mortar: 0xddd3c6, seed: 7 }, 1.6, { normal: 1.1 });
  const white = mat('plaster'), trim = paint(0xf4f2ee, 0.5, 0.05), redP = paint(0xc4221c, 0.4, 0.2);
  const F = 2.5, BZ = -6.8, X0 = -6.2, X1 = 8.8, G = 5.0, H = 7.6, PH = 1.3, DW = 3.6, DH = 4.3;
  const p = (X1 - X0 - 3 * DW) / 4, bays = [0, 1, 2].map((i) => X0 + p + DW / 2 + i * (p + DW));
  const ob = bays[0], ox0 = ob - DW / 2, ox1 = ob + DW / 2, IB = -5.6;
  const lin = mat('plasterGray'), FZ = F - 0.36, FF = 0.08;
  // apron with no-parking boxes
  put(g, RB(18, 0.06, 7 - F + 0.3, 0.02, 1), mat('concrete'), 0, 0.03, (F - 0.3 + 7) / 2);
  for (const bx of bays) {
    for (const s of [-1, 1]) V(g, RB(0.14, 0.012, 4.2, 0.005, 1), 0xf2c230, bx + s * 1.75, 0.066, F + 2.2);
    V(g, RB(3.64, 0.012, 0.14, 0.005, 1), 0xf2c230, bx, 0.066, F + 4.25);
    D(g, C.A.quad('floorTxt', 2.4, 0.6), C.print, bx, 0.068, F + 3.4, -PI / 2, 0, 0);
  }
  // masses: hollow garage storey (walls, epoxy floor, ceiling with light strips), upper storey
  wall(C, 'x', BZ, 1, X0, X1, 0, G, 0.3, white, lin);
  wall(C, 'z', X0, 1, BZ + 0.3, FZ, 0, G, 0.3, white, lin);
  wall(C, 'z', X1, -1, BZ + 0.3, FZ, 0, G, 0.3, white, lin);
  slab(C, X0 + 0.3, X1 - 0.3, BZ + 0.3, F - 0.02, textured('concrete', { color: 0x9a9c9e, seed: 5 }, 3, { normal: 0.3, roughness: 0.55 }), FF);
  ceilingWithLights(C, X0 + 0.3, X1 - 0.3, BZ + 0.3, FZ, G - 0.08, paint(0xeceae5, 0.6), C.cool, 4, 3, 1.6, 0.18);
  put(g, box(X1 - X0, H - G, F - BZ), red, (X0 + X1) / 2, G + (H - G) / 2, (F + BZ) / 2);
  put(g, RB(X1 - X0 + 0.06, 0.22, 0.2, 0.02, 1), trim, (X0 + X1) / 2, G + 0.11, F + 0.06);
  // piers and header
  for (let i = 0; i < 4; i++) {
    const px = X0 + p / 2 + i * (p + DW);
    put(g, RB(p, G, 0.36, 0.02, 1), white, px, G / 2, F - 0.18);
    put(g, RB(p + 0.06, 0.3, 0.42, 0.02, 1), mat('concrete'), px, 0.15, F - 0.18);
  }
  put(g, RB(X1 - X0, G - DH, 0.36, 0.02, 1), white, (X0 + X1) / 2, DH + (G - DH) / 2, F - 0.18);
  put(g, RB(X1 - X0 + 0.04, 0.12, 0.42, 0.02, 1), redP, (X0 + X1) / 2, DH + 0.06, F - 0.16);
  // closed sectional doors with a window row
  const doorM = textured('siding', { color: 0xf0efea, count: 6 }, DH, { normal: 0.9 });
  for (const bx of bays.slice(2)) {
    put(g, box(DW, DH, 0.08), doorM, bx, DH / 2, F - 0.32);
    site.colliders.push(aabb(bx - DW / 2, 0, F - 0.4, bx + DW / 2, DH, F - 0.24));
    for (let k = 0; k < 5; k++) D(g, quad(0.55, 0.36), C.tinted, bx - 1.4 + k * 0.7, 3.2, F - 0.275);
    for (const s of [-1, 1]) V(g, RB(0.14, DH, 0.2, 0.01, 1), 0xc4221c, bx + s * (DW / 2 + 0.05), DH / 2, F - 0.3, 0, 0, 0, vcGloss());
    V(g, RB(0.24, 0.12, 0.06, 0.02, 1), 0x9aa0a6, bx, 0.4, F - 0.26);
  }
  // two open bays (rolled-up doors): the truck in the first, the second is the way in
  for (const bx of bays.slice(0, 2)) {
    V(g, CY(0.32, 0.32, DW + 0.1, 18), 0xd6d8da, bx, DH + 0.25, F - 0.6, 0, 0, PI / 2, vcGloss());
    put(g, box(DW, 0.25, 0.08), doorM, bx, DH - 0.05, F - 0.42);
    for (const s of [-1, 1]) V(g, RB(0.14, DH, 0.2, 0.01, 1), 0xc4221c, bx + s * (DW / 2 + 0.05), DH / 2, F - 0.3, 0, 0, 0, vcGloss());
    for (const s of [-1, 1]) V(g, RB(0.12, 0.01, F - IB - 0.6, 0.005, 1), 0xf2c230, bx + s * 1.55, FF + 0.006, (F + IB) / 2);
    put(g, RB(DW, 0.03, 0.3, 0.01, 1), mat('steel'), bx, FF + 0.005, F - 0.2);
  }
  const tr = fireTruck(C, ob, -1.4); tr.position.y = FF;
  site.colliders.push(aabb(ob - 1.27, 0, -5.1, ob + 1.27, 3.4, 2.38));
  site.lamps.push({ pos: [ob, 4.2, -1.5], color: 0xfff1d6, intensity: 1.4, range: 8 });
  for (let i = 0; i < 4; i++) { const px = X0 + p / 2 + i * (p + DW); site.colliders.push(aabb(px - p / 2, 0, FZ, px + p / 2, G, F)); }
  site.colliders.push(aabb(X0, DH, FZ, X1, G, F), aabb(X0, G, BZ, X1, H + PH, F));
  // upper storey windows and the station sign
  windows(C, [0, 1, 2, 3, 4].map((i) => X0 + 1.5 + i * (X1 - X0 - 3) / 4), 5.6, F, 1.5, 1.3, 0xf4f2ee, trim);
  put(g, RB(X1 - X0, PH, 0.32, 0.02, 1), white, (X0 + X1) / 2, H + PH / 2, F - 0.12);
  roofEdge(C, X0, X1, BZ, F - 0.3, H, PH, white, trim);
  signBox(C, 'sign', (X0 + X1) / 2, H + PH / 2 + 0.02, F + 0.08, 7.2, 0.95, 0xf4f2ee, 0.14);
  for (const bx of bays) sconce(C, bx, DH + 0.3, F);
  for (const bx of bays) site.lamps.push({ pos: [bx, DH, F + 1.2], color: 0xffe2b8, intensity: 1.2, range: 7 });
  // hose-drying tower with a hanging hose behind louvres
  const TX0 = -8.9, TX1 = -6.2, TZ0 = -4.6, TZ1 = 0.8, TH = 14.6, tx = (TX0 + TX1) / 2, tz = (TZ0 + TZ1) / 2;
  put(g, box(TX1 - TX0, 12.2, TZ1 - TZ0), red, tx, 6.1, tz);
  for (const x of [TX0 + 0.12, TX1 - 0.12]) put(g, RB(0.26, 12.2, 0.26, 0.02, 1), trim, x, 6.1, TZ1 - 0.1);
  put(g, RB(TX1 - TX0 + 0.12, 0.25, TZ1 - TZ0 + 0.12, 0.03, 1), trim, tx, 12.3, tz);
  V(g, RB(TX1 - TX0 - 0.4, 1.9, TZ1 - TZ0 - 0.4, 0.02, 1), 0x2a2622, tx, 13.35, tz);
  for (const [cx, cz] of [[TX0 + 0.1, TZ0 + 0.1], [TX1 - 0.1, TZ0 + 0.1], [TX0 + 0.1, TZ1 - 0.1], [TX1 - 0.1, TZ1 - 0.1]]) put(g, RB(0.24, 2.1, 0.24, 0.02, 1), trim, cx, 13.4, cz);
  for (let k = 0; k < 8; k++) {
    const y = 12.6 + k * 0.23;
    V(g, RB(TX1 - TX0 - 0.2, 0.05, 0.16, 0.01, 1), 0xf4f2ee, tx, y, TZ1 - 0.05, -0.5, 0, 0);
    for (const x of [TX0 + 0.05, TX1 - 0.05]) V(g, RB(0.16, 0.05, TZ1 - TZ0 - 0.2, 0.01, 1), 0xf4f2ee, x, y, tz, 0, 0, x < tx ? 0.5 : -0.5);
  }
  for (let k = 0; k < 3; k++) V(g, CY(0.05, 0.05, 2.0, 10), 0xe9dcc0, tx - 0.5 + k * 0.5, 13.0, tz + 0.6, 0, 0, 0, vcSoft());
  put(g, RB(TX1 - TX0 + 0.3, 0.3, TZ1 - TZ0 + 0.3, 0.05, 2), trim, tx, TH - 0.15, tz);
  V(g, CY(0.03, 0.03, 1.4, 8), 0x9aa0a6, tx, TH + 0.7, tz);
  D(g, SP(0.12, 12, 8), redGlow(), tx, TH + 1.45, tz);
  signBox(C, 'tower', tx, 8.4, TZ1 + 0.04, 1.4, 3.6, 0xc4221c, 0.12);
  for (const y of [2.6, 5.4]) {
    D(g, A.quad('room' + (y > 3 ? 1 : 2), 0.7, 1.3), C.win, tx, y + 0.65, TZ1 + 0.012);
    V(g, RB(0.86, 0.08, 0.14, 0.01, 1), 0xf4f2ee, tx, y + 1.34, TZ1 + 0.05); V(g, RB(0.86, 0.08, 0.14, 0.01, 1), 0xf4f2ee, tx, y - 0.04, TZ1 + 0.05);
    D(g, quad(0.7, 1.3), C.glass, tx, y + 0.65, TZ1 + 0.06);
  }
  // side entrance (민원실) at the tower foot
  glassDoor(C, tx, TZ1 + 0.02, 1.2, 2.3, 0x2b2d31, 'lobby');
  put(g, RB(2.4, 0.14, 1.3, 0.03, 2), trim, tx, 2.6, TZ1 + 0.6);
  D(g, RB(1.6, 0.02, 0.8, 0.01, 1), C.lamp, tx, 2.52, TZ1 + 0.6);
  site.lamps.push({ pos: [tx, 2.4, TZ1 + 1.0], color: 0xfff1d6, intensity: 1.1, range: 6 });
  // roof: siren and antenna
  V(g, CY(0.06, 0.06, 1.6, 10), 0x9aa0a6, 5.5, H + 0.8, -3.0);
  for (let k = 0; k < 4; k++) V(g, lathe([[0.03, 0], [0.06, 0.15], [0.16, 0.36], [0.17, 0.37]], 14), 0xe6e8ea, 5.5 + Math.cos(k * PI / 2) * 0.2, H + 1.6, -3.0 + Math.sin(k * PI / 2) * 0.2, PI / 2, 0, -k * PI / 2 + PI / 2, vcGloss());
  acUnit(C, 1.0, H, -5.0); acUnit(C, -2.0, H, -5.0);
  // hydrant and a plant
  const hy = hydrant(); hy.position.set(-7.6, 0.06, 4.6); g.add(hy);
  pottedPlant(g, -5.4, 0.06, F + 0.4, { kind: 'bush', h: 0.8, seed: 5, pot: 'charcoal', potR: 0.22, potH: 0.45 });
  solid(site, tx, TH / 2, tz, TX1 - TX0, TH, TZ1 - TZ0);
  solid(site, -7.6, 0.4, 4.6, 0.6, 0.8, 0.4);
  site.extra.height = TH;
}

/* ================================================================== 경찰서 (police station) */
function patrolCar(C, x, z, ry) {
  const col = 0xf6f7f8;
  const c = buildCar({ style: 'sedan', color: col });
  const paintMat = paint(col, 0.35, 0.1, { clearcoat: 1 });
  const stripe = paintMat.clone();
  stripe.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSP; varying vec3 vSN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSP = position; vSN = normal;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSP; varying vec3 vSN;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float sideF = step(0.55, abs(vSN.z));
        float band = step(0.56, vSP.y) * step(vSP.y, 0.74) * sideF;
        float thin = step(0.78, vSP.y) * step(vSP.y, 0.81) * sideF;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.03, 0.12, 0.42), max(band, thin));`);
  };
  stripe.customProgramCacheKey = () => 'civicPoliceStripe';
  stripe.name = 'policeStripe';
  c.group.traverse((o) => { delete o.userData.dynamic; if (o.isMesh && o.material === paintMat) o.material = stripe; });
  c.group.position.set(x, 0.06, z);
  c.group.rotation.y = ry;
  C.g.add(c.group);
  // light bar on the roof
  const lb = group(C.g, x, 0.06 + c.size.h, z, ry);
  V(lb, RB(0.34, 0.06, 1.25, 0.02, 1), 0x1b1b1d, 0, 0.03, 0);
  D(lb, RB(0.3, 0.13, 0.5, 0.05, 2), redGlow(), 0, 0.12, -0.33);
  D(lb, RB(0.3, 0.13, 0.5, 0.05, 2), blueGlow(), 0, 0.12, 0.33);
  V(lb, RB(0.31, 0.135, 0.14, 0.03, 1), 0xf4f4f2, 0, 0.12, 0, 0, 0, 0, vcGloss());
  C.site.nightGlow.push(blueGlow());
  return c;
}

function buildPolice(C) {
  const { g, site, A } = C;
  const white = mat('plaster'), blue = paint(0x1f4f9a, 0.45, 0.25), trim = paint(0xf4f4f2, 0.45, 0.1);
  const F = 2.4, BZ = -5.8, X0 = -7.8, X1 = 7.8, G = 3.8, H = 7.2, PH = 0.6, TW = 2.7, TH = 9.4;
  put(g, RB(16, 0.06, 6 - F + 0.3, 0.02, 1), mat('pavers2'), 0, 0.03, (F - 0.3 + 6) / 2);
  // wings: hollow ground floor (front wall with the entrance and real windows), solid upper floor
  const lin = mat('plaster'), wins = [-6.4, -4.2, 4.2, 6.4].map((x) => [x - 0.75, x + 0.75, 0.95, 2.65]);
  put(g, box(X1 - X0, H - G, F - BZ), white, 0, G + (H - G) / 2, (F + BZ) / 2);
  wall(C, 'x', BZ, 1, X0, X1, 0, G, 0.25, white, lin);
  wall(C, 'z', X0, 1, BZ + 0.25, F - 0.25, 0, G, 0.25, white, lin);
  wall(C, 'z', X1, -1, BZ + 0.25, F - 0.25, 0, G, 0.25, white, lin);
  wall(C, 'x', F, -1, X0, X1, 0, G, 0.25, white, lin, [[-2.3, 2.3, 0, 2.6], ...wins]);
  slab(C, X0 + 0.25, X1 - 0.25, BZ + 0.25, F, textured('tiles', { color: 0xd9d6cf, grout: 0xa8a49c, count: 3, rough: 0.35 }, 1.2, { normal: 0.4 }));
  slab(C, -2.3, 2.3, F, F + 0.62, mat('floorTile'));
  ceilingWithLights(C, X0 + 0.25, X1 - 0.25, BZ + 0.25, F - 0.25, 3.3, paint(0xf2f1ec, 0.7), C.cool, 4, 2, 1.2, 0.6);
  put(g, RB(X1 - X0 + 0.06, 0.5, 0.18, 0.02, 1), blue, 0, G - 0.1, F + 0.06);
  for (const s of [-1, 1]) put(g, RB(X1 - 2.3 + 0.03, 0.3, 0.3, 0.02, 1), mat('concrete'), s * (2.3 + (X1 - 2.3) / 2), 0.15, F);
  roofEdge(C, X0, X1, BZ, F, H, PH, white, blue);
  for (const s of [-1, 1]) {
    const xs = [s * 4.2, s * 6.4];
    windows(C, xs, 0.95, F, 1.5, 1.7, 0xf4f4f2, trim, true);
    windows(C, xs, 4.5, F, 1.5, 1.5, 0xf4f4f2, trim);
    V(g, RB(0.18, H - 0.2, 0.2, 0.02, 1), 0x1f4f9a, s * (X1 - 0.09), H / 2, F + 0.02);
  }
  // central tower: blue glass, entrance canopy, emblem on top
  put(g, RB(TW * 2, TH - 2.6, 0.6, 0.03, 2), trim, 0, (TH + 2.6) / 2, F + 0.3);
  for (const s of [-1, 1]) put(g, RB(0.4, 2.6, 0.6, 0.02, 1), trim, s * 2.5, 1.3, F + 0.3);
  D(g, quad(TW * 2 - 0.6, 3.6), C.tinted, 0, 5.6, F + 0.61);
  D(g, A.quad('room1', TW * 2 - 0.6, 3.6), C.win, 0, 5.6, F + 0.56);
  for (let i = 0; i <= 5; i++) V(g, RB(0.08, 3.6, 0.12, 0.01, 1), 0x1f4f9a, -TW + 0.3 + i * (TW * 2 - 0.6) / 5, 5.6, F + 0.64);
  for (const y of [3.8, 5.6, 7.4]) V(g, RB(TW * 2 - 0.6, 0.08, 0.12, 0.01, 1), 0x1f4f9a, 0, y, F + 0.64);
  const sh = new THREE.Shape();
  sh.moveTo(-0.8, 0.9); sh.lineTo(0.8, 0.9); sh.lineTo(0.8, 0.15); sh.quadraticCurveTo(0.72, -0.62, 0, -1.0); sh.quadraticCurveTo(-0.72, -0.62, -0.8, 0.15); sh.closePath();
  put(g, extrude(sh, 0.12, 0.03), blue, 0, TH - 0.85, F + 0.6);
  D(g, A.quad('emblem', 1.5, 1.8), C.sign, 0, TH - 0.85, F + 0.78);
  // entrance
  slideDoor(C, 0, F + 0.56, 2.0, 2.4, FL, 0x1f4f9a, 0x8fb4ff);
  for (const s of [-1, 1]) { D(g, quad(1.16, 2.45), C.glass, s * 1.68, FL + 1.225, F + 0.56); V(g, RB(0.08, 2.6, 0.14, 0.01, 1), 0x1f4f9a, s * 2.26, 1.3, F + 0.56); V(g, RB(1.2, 0.08, 0.14, 0.01, 1), 0x1f4f9a, s * 1.68, 2.56, F + 0.56); }
  put(g, RB(6.2, 0.22, 2.0, 0.04, 2), trim, 0, 3.0, F + 1.5);
  D(g, RB(5.0, 0.02, 1.4, 0.01, 1), C.lamp, 0, 2.88, F + 1.5);
  signBox(C, 'sign', 0, 3.38, F + 2.48, 5.6, 0.62, 0x1f4f9a, 0.14);
  for (const s of [-1, 1]) {
    V(g, CY(0.05, 0.05, 2.9, 12), 0xd0d4d8, s * 2.9, 1.45, F + 2.3, 0, 0, 0, vcGloss());
    // blue police lanterns
    V(g, RB(0.34, 0.08, 0.34, 0.02, 1), 0x1b1b1d, s * 1.6, 2.72, F + 0.85);
    put(g, RB(0.3, 0.42, 0.3, 0.03, 2), blueGlow(), s * 1.6, 2.45, F + 0.85);
    D(g, A.quad('lantern', 0.22, 0.3), C.sign, s * 1.6, 2.45, F + 1.006);
    V(g, RB(0.06, 0.2, 0.2, 0.01, 1), 0x1b1b1d, s * 1.6, 2.2, F + 0.72);
  }
  site.lamps.push({ pos: [0, 2.7, F + 1.6], color: 0xf4f6ff, intensity: 1.3, range: 8 });
  site.lamps.push({ pos: [0, 3.3, F + 3.2], color: 0x8fb4ff, intensity: 0.8, range: 6 });
  signBox(C, 'name', -4.9, H - 0.95, F + 0.08, 3.6, 0.7, 0x1f4f9a, 0.12);
  // flagpole and flag
  const fx = -6.6, fz = 4.9;
  V(g, CY(0.3, 0.36, 0.3, 20), 0xbdb8ae, fx, 0.2, fz);
  V(g, CY(0.045, 0.06, 8.6, 14), 0xd8dadc, fx, 4.6, fz, 0, 0, 0, vcGloss());
  V(g, SP(0.08, 12, 8), 0xd8b25a, fx, 8.95, fz, 0, 0, 0, vcGloss());
  const fg = prep(new THREE.PlaneGeometry(1.5, 1.0, 12, 1), true);
  const fp = fg.attributes.position;
  for (let i = 0; i < fp.count; i++) fp.setZ(i, Math.sin((fp.getX(i) + 0.75) * 3.2) * 0.09 * (fp.getX(i) + 0.75));
  fg.computeVertexNormals();
  const flagM = A.printed(0.75); flagM.side = THREE.DoubleSide;
  put(g, A.mapUV(fg, 'flag'), flagM, fx + 0.8, 8.25, fz);
  // patrol car, bollards, planters
  patrolCar(C, 3.4, 4.55, PI / 2);
  for (const x of [-4.2, -3.0]) { V(g, CY(0.1, 0.1, 0.8, 14), 0x2b2d31, x, 0.46, 5.4, 0, 0, 0, vcGloss()); V(g, CY(0.105, 0.105, 0.08, 14), 0xf2f2f2, x, 0.7, 5.4); }
  for (const x of [-3.5, 3.5]) pottedPlant(g, x, 0.06, F + 0.45, { kind: 'snake', h: 0.9, seed: 7 + x, pot: 'charcoal', potR: 0.24, potH: 0.5 });
  acUnit(C, -4.0, H, -3.5); acUnit(C, 4.5, H, -3.5);
  site.colliders.push(aabb(X0, G, BZ, X1, H + PH, F), aabb(-TW, 2.6, F, TW, TH, F + 0.6));
  for (const s of [-1, 1]) site.colliders.push(aabb(s < 0 ? -TW : 2.3, 0, F, s < 0 ? -2.3 : TW, 2.6, F + 0.6), aabb(s < 0 ? -2.3 : 1.08, 0, F + 0.5, s < 0 ? -1.08 : 2.3, 2.6, F + 0.62));
  solid(site, fx, 2, fz, 0.7, 4, 0.7);
  solid(site, 3.4, 0.75, 4.55, 4.7, 1.5, 1.9);
  for (const s of [-1, 1]) solid(site, s * 2.9, 1.5, F + 2.3, 0.2, 3, 0.2);
  site.extra.height = TH + 0.1;
}

/* ================================================================== 세온 시네마 (cinema) */
function popcornMachine(C, x, y, z) {
  const g = group(C.g, x, y, z), gl = vcGloss(), R = C.R;
  V(g, RB(0.9, 0.85, 0.6, 0.04, 2), 0xc8202a, 0, 0.425, 0, 0, 0, 0, gl);
  V(g, RB(0.94, 0.06, 0.64, 0.02, 1), 0xe8c24a, 0, 0.88, 0, 0, 0, 0, gl);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) V(g, RB(0.05, 0.75, 0.05, 0.01, 1), 0xc8202a, sx * 0.43, 1.28, sz * 0.28, 0, 0, 0, gl);
  for (let k = 0; k < 150; k++) {
    const px = (R() - 0.5) * 0.78, pz = (R() - 0.5) * 0.48, py = 0.95 + R() * (0.36 - Math.abs(px) * 0.25);
    V(g, SP(0.038, 6, 4), R() < 0.8 ? 0xf6e7b0 : 0xf0cf6a, px, py, pz, 0, 0, 0, vcSoft());
  }
  D(g, quad(0.84, 0.72), C.glass, 0, 1.28, 0.3);
  D(g, quad(0.84, 0.72), C.glass, 0, 1.28, -0.3);
  for (const s of [-1, 1]) D(g, quad(0.56, 0.72), C.glass, s * 0.43, 1.28, 0, 0, PI / 2, 0);
  V(g, CY(0.12, 0.1, 0.12, 16), 0xb9bec4, 0.1, 1.5, 0, 0, 0, 0, gl);
  V(g, RB(1.0, 0.26, 0.7, 0.04, 2), 0xc8202a, 0, 1.78, 0, 0, 0, 0, gl);
  D(g, C.A.quad('popSign', 0.8, 0.2), C.sign, 0, 1.78, 0.355);
  for (const s of [-1, 1]) V(g, CY(0.07, 0.07, 0.05, 12), 0x2b2d31, s * 0.35, 0.04, 0.22, PI / 2);
}

function buildCinema(C) {
  const { g, site, A } = C;
  const dark = textured('concrete', { color: 0x4a4c55, seed: 3 }, 4, { normal: 0.5 }), side = mat('plasterGray');
  const accent = paint(0xb8232c, 0.4, 0.2), trim = paint(0x1d1f24, 0.4, 0.4);
  const F = 3.0, BZ = -8.8, X0 = -11.9, X1 = 11.9, H = 12.4, GZ = 1.6;
  put(g, RB(24, 0.06, 9 - F + 0.3, 0.02, 1), mat('pavers'), 0, 0.03, (F - 0.3 + 9) / 2);
  // box: hollow up to HH (lobby + auditorium shell), solid above; lobby recess in the middle of the front
  const HH = CIN.HH + 0.1, lin = textured('plaster', { color: 0x6a2a2e, seed: 12 }, 3, { normal: 0.3 }), dk = paint(0x22181c, 0.85);
  put(g, box(X1 - X0, H - HH, F - BZ), dark, 0, HH + (H - HH) / 2, (F + BZ) / 2);
  wall(C, 'x', F, -1, X0, X1, 4.2, HH, 0.3, dark, null);
  wall(C, 'x', BZ, 1, X0, X1, 0, HH, 0.25, dark, dk);
  for (const s of [-1, 1]) {
    wall(C, 'z', s * X1, -s, BZ + 0.25, -1.45, 0, HH, 0.25, dark, dk);
    wall(C, 'z', s * X1, -s, -1.45, F - GZ, 0, HH, 0.25, dark, lin);
  }
  for (const [a, b] of [[X0, -5.2], [5.2, X1]]) { put(g, box(b - a, 4.2, GZ), dark, (a + b) / 2, 2.1, F - GZ / 2); put(g, box(b - a - 0.25, 3.9, 0.02), lin, (a + b) / 2 - Math.sign(a) * 0.125, 2.0, F - GZ - 0.01); site.colliders.push(aabb(a, 0, F - GZ, b, 4.2, F)); }
  wall(C, 'x', -1.2, -1, X0 + 0.25, X1 - 0.25, 0, HH, 0.25, lin, dk, [[-10.6, -9.2, 0, 2.4]]);
  const carpetL = textured('carpet', { color: 0x5a1f28, seed: 4 }, 2, { normal: 0.8 });
  slab(C, X0 + 0.25, X1 - 0.25, -1.2, F - GZ, carpetL);
  slab(C, -5.2, 5.2, F - GZ, F - 0.04, carpetL);
  slab(C, X0 + 0.25, X1 - 0.25, BZ + 0.25, -1.2, textured('carpet', { color: 0x2a1418, seed: 9 }, 2, { normal: 0.8 }));
  ceilingWithLights(C, X0 + 0.25, X1 - 0.25, -1.2, F - 0.04, 3.95, paint(0x2b1a1c, 0.7), C.lamp, 6, 2, 0.5, 0.5);
  put(g, box(X1 - X0 - 0.5, 0.06, CIN.AZ1 - CIN.AZ0), dk, 0, CIN.HH + 0.03, (CIN.AZ0 + CIN.AZ1) / 2);
  for (let x = -9; x < 5; x += 3) D(g, CY(0.12, 0.12, 0.02, 14), C.lamp, x, CIN.HH - 0.01, -5.0);
  for (const s of [-1, 1]) {
    put(g, box(0.1, H - 0.4, F - BZ - 1.0), side, s * (X1 + 0.03), H / 2 - 0.2, (F + BZ) / 2 - 0.3);
    for (let k = 0; k < 5; k++) V(g, RB(0.12, H - 0.6, 0.12, 0.02, 1), 0xb8232c, s * (X1 + 0.05), H / 2 - 0.2, BZ + 1.2 + k * 2.2, 0, 0, 0, vcGloss());
  }
  roofEdge(C, X0, X1, BZ, F, H, 0.5, dark, trim);
  for (const x of [X0 + 0.25, X1 - 0.25]) put(g, RB(0.5, H + 0.5, 0.4, 0.03, 2), accent, x, (H + 0.5) / 2, F + 0.1);
  D(g, RB(X1 - X0 - 0.6, 0.14, 0.06, 0.02, 1), redGlow(), 0, H + 0.2, F + 0.06);
  // lobby: glass front with doors, popcorn machine and a concession counter behind
  for (const [a, b] of [[-5.2, -3.5], [-1.7, 1.7], [3.5, 5.2]]) { glazing(C, a, b, 0.06, 3.9, F - 0.04, { pane: 1.75, frame: 0x1d1f24, transom: 2.7 }); site.colliders.push(aabb(a, 0, F - 0.12, b, 3.9, F)); }
  for (const dx of [-2.6, 2.6]) { glazing(C, dx - 0.9, dx + 0.9, 2.82, 3.9, F - 0.04, { pane: 1.8, frame: 0x1d1f24 }); slideDoor(C, dx, F - 0.04, 1.8, 2.6, FL, 0x1d1f24, 0xd8b25a); }
  popcornMachine(C, -4.55, FL, F - 0.75);
  site.colliders.push(aabb(-5.05, 0, F - 1.1, -4.05, 2, F - 0.4));
  // marquee with bulbs and lit board
  const MW = 14, MZ = F + 2.5, MY = 4.45;
  put(g, RB(MW, 0.9, 2.5, 0.05, 2), trim, 0, MY, F + 1.25);
  D(g, RB(MW - 0.4, 0.02, 2.1, 0.01, 1), C.lamp, 0, MY - 0.46, F + 1.25);
  D(g, A.quad('marquee', MW - 0.6, 0.62), C.sign, 0, MY, MZ + 0.006);
  for (const y of [MY + 0.4, MY - 0.4]) for (let x = -MW / 2 + 0.2; x <= MW / 2 - 0.19; x += 0.3) D(g, SP(0.045, 8, 6), C.lamp, x, y, MZ + 0.03);
  for (const s of [-1, 1]) for (let z = F + 0.2; z < MZ; z += 0.3) D(g, SP(0.045, 8, 6), C.lamp, s * (MW / 2 + 0.02), MY + 0.4, z);
  site.lamps.push({ pos: [0, 3.8, F + 1.5], color: 0xffe2b0, intensity: 1.6, range: 10 });
  site.lamps.push({ pos: [-7, 3.5, F + 2], color: 0xffe2b0, intensity: 0.9, range: 7 });
  // huge lit lettering with depth layers, English line, blade sign
  const sideM = new THREE.MeshStandardMaterial({ map: A.tex, color: 0x6a1a1e, alphaTest: 0.5, roughness: 0.5 }); sideM.name = 'civicLetterSide';
  for (let k = 0; k < 6; k++) D(g, A.quad('letters', 15, 2.8), sideM, 0.0, 8.4, F + 0.03 + k * 0.035);
  D(g, A.quad('letters', 15, 2.8), C.sign, 0, 8.4, F + 0.24);
  D(g, A.quad('en', 6.5, 0.6), C.sign, 0, 6.35, F + 0.03);
  const bx = 10.6, by = 8.0;
  put(g, RB(0.5, 6.4, 1.2, 0.05, 2), accent, bx, by, F + 0.65);
  for (const s of [-1, 1]) D(g, A.quad('blade', 1.0, 6.0), C.sign, bx + s * 0.255, by, F + 0.65, 0, s * PI / 2, 0);
  // three movie posters in lightboxes
  for (const [i, px] of [[0, -9.4], [1, -7.0], [2, 7.2]]) {
    put(g, RB(1.9, 2.7, 0.16, 0.03, 2), trim, px, 1.9, F + 0.08);
    D(g, A.quad('poster' + i, 1.7, 2.5), C.sign, px, 1.9, F + 0.165);
    D(g, quad(1.72, 2.52), C.glass, px, 1.9, F + 0.19);
    site.lamps.push({ pos: [px, 2.0, F + 0.8], color: 0xfff1d6, intensity: 0.6, range: 4 });
  }
  // ticket booth on the plaza
  const tb = group(g, 9.2, 0.06, 5.8);
  V(tb, RB(1.8, 1.05, 1.5, 0.08, 2), 0xb8232c, 0, 0.52, 0, 0, 0, 0, vcGloss());
  V(tb, RB(1.9, 0.06, 1.6, 0.02, 1), 0xd8b25a, 0, 1.08, 0, 0, 0, 0, vcGloss());
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) V(tb, RB(0.1, 1.2, 0.1, 0.02, 1), 0xd8b25a, sx * 0.85, 1.7, sz * 0.7, 0, 0, 0, vcGloss());
  D(tb, A.quad('booth', 1.6, 1.15), C.win, 0, 1.68, -0.6);
  D(tb, quad(1.6, 1.15), C.glass, 0, 1.68, 0.72);
  for (const s of [-1, 1]) D(tb, quad(1.3, 1.15), C.glass, s * 0.86, 1.68, 0, 0, PI / 2, 0);
  V(tb, RB(1.9, 0.12, 1.6, 0.02, 1), 0xb8232c, 0, 2.33, 0, 0, 0, 0, vcGloss());
  V(tb, SP(0.75, 20, 10), 0xd8b25a, 0, 2.39, 0, 0, 0, 0, vcGloss()).scale.set(1.15, 0.55, 0.95);
  put(tb, RB(1.5, 0.36, 0.1, 0.02, 1), trim, 0, 2.62, 0.75);
  D(tb, A.quad('ticket', 1.36, 0.3), C.sign, 0, 2.62, 0.806);
  site.lamps.push({ pos: [9.2, 2.2, 6.8], color: 0xffe2b0, intensity: 0.8, range: 5 });
  // queue stanchions with red ropes
  const posts = [[-1.4, 4.2], [-0.3, 4.2], [0.8, 4.2], [1.9, 4.2], [-1.4, 5.3], [1.9, 5.3]];
  for (const [x, z] of posts) { V(g, CY(0.025, 0.025, 0.95, 10), 0xd8b25a, x, 0.53, z, 0, 0, 0, vcGloss()); V(g, CY(0.14, 0.16, 0.04, 16), 0xd8b25a, x, 0.08, z, 0, 0, 0, vcGloss()); V(g, SP(0.04, 10, 6), 0xd8b25a, x, 1.02, z, 0, 0, 0, vcGloss()); }
  for (const [a, b] of [[0, 1], [1, 2], [2, 3], [0, 4], [3, 5]]) {
    const [x0, z0] = posts[a], [x1, z1] = posts[b], mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    rod(g, [x0, 0.95, z0], [mx, 0.8, mz], 0.018, 0xb8232c, vcSoft());
    rod(g, [mx, 0.8, mz], [x1, 0.95, z1], 0.018, 0xb8232c, vcSoft());
  }
  const b1 = bench({ length: 1.8 }); b1.position.set(-7.5, 0.06, 6.6); g.add(b1);
  for (const x of [-10.6, 5.6]) pottedPlant(g, x, 0.06, F + 0.5, { kind: 'snake', h: 1.0, seed: 3 + x, pot: 'charcoal', potR: 0.25, potH: 0.55 });
  acUnit(C, -6, H, -6); acUnit(C, -4.4, H, -6); acUnit(C, 6, H, -5);
  site.colliders.push(aabb(X0, HH, BZ, X1, H + 0.5, F));
  solid(site, 9.2, 1.4, 5.8, 1.9, 2.8, 1.6);
  solid(site, -7.5, 0.25, 6.6, 1.8, 0.5, 0.6);
  site.extra.height = H + 0.5;
}

/* ================================================================== 세온 마트 (supermarket) */
function cart(C, x, z, ry, wireM) {
  const g = group(C.g, x, 0.06, z, ry), A = C.A, gl = vcGloss(), M = 0xb9bec4;
  // basket: forward +X, 0.86 long, 0.52 wide
  for (const s of [-1, 1]) D(g, A.quad('wire', 0.86, 0.44), wireM, 0, 0.73, s * 0.26);
  D(g, A.quad('wire', 0.52, 0.44), wireM, 0.43, 0.73, 0, 0, PI / 2, 0);
  D(g, A.quad('wire', 0.52, 0.44), wireM, -0.43, 0.73, 0, 0, PI / 2, 0);
  D(g, A.quad('wire', 0.86, 0.52), wireM, 0, 0.51, 0, -PI / 2, 0, 0);
  for (const s of [-1, 1]) rod(g, [-0.43, 0.95, s * 0.26], [0.43, 0.95, s * 0.26], 0.012, M, gl, 6);
  for (const e of [-1, 1]) rod(g, [e * 0.43, 0.95, -0.26], [e * 0.43, 0.95, 0.26], 0.012, M, gl, 6);
  rod(g, [-0.55, 1.05, -0.24], [-0.55, 1.05, 0.24], 0.022, 0xd8302a, gl, 8);
  for (const s of [-1, 1]) {
    rod(g, [-0.43, 0.95, s * 0.24], [-0.55, 1.05, s * 0.24], 0.012, M, gl, 6);
    rod(g, [-0.4, 0.5, s * 0.22], [-0.42, 0.1, s * 0.22], 0.014, M, gl, 6);
    rod(g, [0.4, 0.5, s * 0.2], [0.38, 0.1, s * 0.2], 0.014, M, gl, 6);
    rod(g, [-0.42, 0.1, s * 0.22], [0.38, 0.1, s * 0.2], 0.014, M, gl, 6);
    for (const wx of [-0.4, 0.36]) V(g, CY(0.05, 0.05, 0.035, 12), 0x2b2d31, wx, 0.05, s * 0.21, PI / 2);
  }
  V(g, RB(0.75, 0.02, 0.4, 0.01, 1), 0xaab0b6, -0.02, 0.2, 0, 0, 0, 0, gl);
}

function buildMart(C) {
  const { g, site, A } = C;
  const wallM = mat('plasterGray'), white = paint(0xf6f6f3, 0.45, 0.05), green = paint(0x1f8a4c, 0.45, 0.15), orange = paint(0xf28a1e, 0.45, 0.1);
  const F = 1.5, BZ = -9.8, X0 = -14.85, X1 = 14.85, H = 7.0, GY = 4.3, IZ = 3.2;
  // sidewalk, curb, parking
  put(g, RB(30, 0.08, 4.4 - F + 0.3, 0.02, 1), mat('pavers2'), 0, 0.04, (F - 0.3 + 4.4) / 2);
  put(g, RB(30, 0.12, 0.2, 0.02, 1), mat('concrete'), 0, 0.06, 4.5);
  put(g, RB(30, 0.04, 10 - 4.6, 0.01, 1), mat('asphalt'), 0, 0.02, (4.6 + 10) / 2);
  for (let x = -14.4; x <= 14.41; x += 2.6) V(g, RB(0.12, 0.012, 4.8, 0.005, 1), 0xf4f4f2, x, 0.046, 7.45);
  for (let x = -13.1; x < 14; x += 2.6) V(g, RB(1.5, 0.12, 0.18, 0.03, 1), 0xb9b6ae, x, 0.08, 9.5);
  D(g, A.quad('floorTxt', 2.2, 0.55), C.print, 0, 0.048, 5.6, -PI / 2, 0, 0);
  // building masses: hollow sales floor behind the glass (walls, tiled floor, light grid), solid upper floor
  const lin = paint(0xf2f2ee, 0.6);
  put(g, box(X1 - X0, H - GY, F - BZ), white, 0, GY + (H - GY) / 2, (F + BZ) / 2);
  wall(C, 'x', BZ, 1, X0, X1, 0, GY, 0.25, wallM, lin);
  for (const s of [-1, 1]) wall(C, 'z', s * X1, -s, BZ + 0.25, F - IZ, 0, GY, 0.25, wallM, lin);
  for (const x of [X0 + 0.4, X1 - 0.4]) { put(g, RB(0.8, GY, IZ, 0.02, 1), white, x, GY / 2, F - IZ / 2); site.colliders.push(aabb(x - 0.4, 0, F - IZ, x + 0.4, GY, F)); }
  slab(C, X0 + 0.25, X1 - 0.25, BZ + 0.25, F - 0.02, mat('floorTile'));
  ceilingWithLights(C, X0 + 0.25, X1 - 0.25, BZ + 0.25, F - 0.1, GY - 0.1, paint(0xf4f4f0, 0.7), C.cool, 7, 4, 2.4, 0.16);
  roofEdge(C, X0, X1, BZ, F, H, 0.9, white, green);
  put(g, RB(X1 - X0 + 0.04, 0.4, 0.1, 0.02, 1), green, 0, GY + 0.25, F + 0.04);
  put(g, RB(X1 - X0 + 0.04, 0.12, 0.1, 0.02, 1), orange, 0, GY + 0.55, F + 0.04);
  // glass front with two automatic doors
  const doors = [-4.5, 4.5], gx0 = X0 + 0.8, gx1 = X1 - 0.8;
  const segs = [[gx0, -6.1], [-2.9, 2.9], [6.1, gx1]];
  for (const [a, b] of segs) { glazing(C, a, b, 0.08, GY - 0.1, F - 0.02, { frame: 0x26302a, pane: 2.2 }); site.colliders.push(aabb(a, 0, F - 0.1, b, GY, F + 0.05), aabb(a + 0.1, 0, F - 2.85, b - 0.1, 1.9, F - 0.25)); }
  for (const dx of doors) {
    slideDoor(C, dx, F - 0.02, 3.0, 2.45, FL, 0x26302a, 0x1f8a4c);
    glazing(C, dx - 1.6, dx + 1.6, 2.75, GY - 0.1, F - 0.02, { frame: 0x26302a, pane: 1.6 });
    put(g, RB(3.4, 0.5, 0.2, 0.02, 1), green, dx, 2.9, F);
    D(g, A.quad(dx < 0 ? 'in' : 'out', 1.2, 0.36), C.sign, dx, 2.9, F + 0.106);
  }
  // interior: fruit crates by the glass, two gondola rows with goods, hanging aisle signs
  const R = C.R, fruitCols = [0xd8302a, 0xf28a1e, 0xf2d03a, 0x6aa83a, 0x9b2a5a];
  for (const [a, b] of segs) {
    const bw = b - a - 0.4, cx = (a + b) / 2;
    for (let x = a + 0.5; x < b - 0.4; x += 0.9) {
      V(g, RB(0.8, 0.5, 0.55, 0.02, 1), 0xa8774a, x, 0.33, F - 0.55, 0, 0, 0, vcMat());
      const col = fruitCols[(R() * fruitCols.length) | 0];
      for (let i = 0; i < 10; i++) V(g, SP(0.055, 8, 6), col, x - 0.3 + (i % 5) * 0.15, 0.62, F - 0.68 + Math.floor(i / 5) * 0.2, 0, 0, 0, vcGloss());
    }
    for (const [z, sh] of [[F - 1.55, 3], [F - 2.6, 4]]) {
      V(g, RB(bw, 0.4 * sh + 0.3, 0.06, 0.01, 1), 0xe9ecee, cx, (0.4 * sh + 0.3) / 2 + 0.08, z - 0.2);
      for (let k = 0; k < sh; k++) {
        const y = 0.25 + k * 0.42;
        V(g, RB(bw, 0.03, 0.4, 0.01, 1), 0xd6dadd, cx, y, z);
        for (let x = a + 0.35; x < b - 0.35;) {
          const w = 0.12 + R() * 0.16, h = 0.14 + R() * 0.2;
          V(g, box(w, h, 0.26), [0xd8302a, 0xf2d03a, 0x2f6fc0, 0xf4f4f2, 0x3a9a5a, 0xf28a1e, 0x8a4ab0, 0xe86aa0][(R() * 8) | 0], x + w / 2, y + 0.015 + h / 2, z);
          x += w + 0.02;
        }
      }
    }
  }
  ['fruit', 'snack', 'ramen', 'drink'].forEach((k, i) => {
    const x = -10.5 + i * 7;
    for (const s of [-1, 1]) rod(g, [x + s * 0.6, GY - 0.08, F - 1.9], [x + s * 0.6, 3.75, F - 1.9], 0.006, 0x2b2d31);
    D(g, A.quad('aisle_' + k, 1.5, 0.42), C.sign, x, 3.55, F - 1.9);
  });
  // canopy over the sidewalk
  const CZ = 2.7, CY0 = 4.55;
  put(g, RB(X1 - X0, 0.32, CZ, 0.03, 2), white, 0, CY0, F + CZ / 2);
  put(g, RB(X1 - X0 + 0.04, 0.34, 0.12, 0.02, 1), green, 0, CY0, F + CZ);
  for (let x = -13.5; x <= 13.6; x += 2.7) D(g, CY(0.12, 0.12, 0.02, 16), C.lamp, x, CY0 - 0.165, F + CZ / 2);
  for (const x of [-13.5, -8, 0, 8, 13.5]) { V(g, CY(0.07, 0.07, CY0, 12), 0x26302a, x, CY0 / 2, F + CZ - 0.2, 0, 0, 0, vcGloss()); solid(site, x, CY0 / 2, F + CZ - 0.2, 0.2, CY0, 0.2); }
  for (const x of [-9, 0, 9]) site.lamps.push({ pos: [x, 4.1, F + 1.3], color: 0xfff1d6, intensity: 1.2, range: 9 });
  // big sign
  signBox(C, 'sign', 0, 6.25, F + 0.08, 12, 1.5, 0xf6f6f3, 0.14);
  for (const s of [-1, 1]) signBox(C, 'sale', s * 10.6, 6.2, F + 0.06, 4.6, 1.0, 0xf28a1e, 0.1);
  // cart corral and carts
  const wireM = new THREE.MeshStandardMaterial({ map: A.tex, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.35 }); wireM.name = 'civicWire';
  const cx0 = 8.6, cz = 3.0;
  for (let i = 0; i < 9; i++) cart(C, cx0 + i * 0.36, cz, PI, wireM);
  for (const s of [-1, 1]) rod(C.g, [cx0 - 0.7, 0.9, cz + s * 0.42], [cx0 + 3.8, 0.9, cz + s * 0.42], 0.03, 0x26302a, vcGloss());
  for (const x of [cx0 - 0.7, cx0 + 3.8]) for (const s of [-1, 1]) V(g, CY(0.03, 0.03, 0.9, 8), 0x26302a, x, 0.5, cz + s * 0.42);
  put(g, RB(1.4, 0.4, 0.06, 0.02, 1), green, cx0 - 0.7, 1.35, cz, 0, PI / 2, 0);
  for (const s of [-1, 1]) D(g, A.quad('cartSign', 1.3, 0.34), C.sign, cx0 - 0.7 + s * 0.035, 1.35, cz, 0, s * PI / 2, 0);
  cart(C, -9.5, 3.4, 0.5, wireM);
  for (const x of [-12.4, -7.6, 2.0]) pottedPlant(g, x, 0.08, F + 0.45, { kind: 'bush', h: 0.8, seed: 9 + x, pot: 'charcoal', potR: 0.24, potH: 0.5 });
  for (let k = 0; k < 3; k++) acUnit(C, -8 + k * 6, H, -6.5);
  site.colliders.push(aabb(X0, GY, BZ, X1, H + 0.9, F));
  solid(site, cx0 + 1.55, 0.5, cz, 4.7, 1.0, 0.95);
  site.parking = { pos: [-11.7, 0, 7.4], yaw: 0 };
  site.extra.height = H + 0.9;
}

/* ================================================================== 세온 은행 (bank) */
function buildBank(C) {
  const { g, site, A } = C;
  const stone = textured('tiles', { color: 0xddd5c4, grout: 0xbcb3a0, count: 4, groutWidth: 0.012, rough: 0.7 }, 2.4, { normal: 0.6 });
  const stoneP = paint(0xe6dfd0, 0.6, 0), dark = paint(0x2a3a52, 0.45, 0.3);
  const F = 2.0, BZ = -4.8, X0 = -5.85, X1 = 5.85, H = 8.0, PZ = 3.8;
  put(g, RB(12, 0.06, 5 - F + 0.3, 0.02, 1), mat('pavers2'), 0, 0.03, (F - 0.3 + 5) / 2);
  // hollow banking hall (floor at the top step), solid upper floor
  const HB = 4.3, lin = mat('plasterWarm'), wins = [[-4.3, -3.1, 1.1, 3.3], [2.3, 3.5, 1.1, 3.3]];
  put(g, box(X1 - X0, H - HB, F - BZ), stone, 0, HB + (H - HB) / 2, (F + BZ) / 2);
  wall(C, 'x', BZ, 1, X0, X1, 0, HB, 0.25, stone, lin);
  for (const s of [-1, 1]) wall(C, 'z', s * X1, -s, BZ + 0.25, F - 0.25, 0, HB, 0.25, stone, lin);
  wall(C, 'x', F, -1, X0, X1, 0, HB, 0.25, stone, lin, [[-1.75, 0.75, 0, 4.1], ...wins]);
  slab(C, X0 + 0.25, X1 - 0.25, BZ + 0.25, F + 0.02, mat('marble'), BF);
  ceilingWithLights(C, X0 + 0.25, X1 - 0.25, BZ + 0.25, F - 0.25, 4.2, paint(0xf4efe4, 0.7), C.lamp, 0, 0);
  roofEdge(C, X0, X1, BZ, F, H, 0.7, stone, stoneP);
  for (const [a, b] of [[X0 - 0.05, -1.75], [0.75, X1 + 0.05]]) put(g, RB(b - a, 0.5, 0.3, 0.02, 1), stoneP, (a + b) / 2, 0.25, F + 0.05);
  // stylobate steps and portico
  for (let k = 0; k < 3; k++) put(g, RB(8.8 - k * 0.3, 0.15, PZ + 0.6 - F - k * 0.35, 0.01, 1), stoneP, -0.5, 0.075 + k * 0.15, F + (PZ + 0.6 - F - k * 0.35) / 2);
  const top = 0.45, colH = 5.5, xs = [-3.8, -1.6, 0.6, 2.8];
  for (const x of xs) {
    put(g, RB(0.75, 0.2, 0.75, 0.02, 1), stoneP, x, top + 0.1, PZ);
    put(g, lathe([[0, 0], [0.32, 0], [0.32, 0.08], [0.28, 0.14], [0.27, colH - 0.5], [0.3, colH - 0.42], [0.36, colH - 0.3], [0, colH - 0.3]], 20), stoneP, x, top + 0.2, PZ);
    put(g, RB(0.82, 0.18, 0.82, 0.02, 1), stoneP, x, top + 0.2 + colH - 0.2, PZ);
    solid(site, x, (top + colH) / 2 + 0.1, PZ, 0.7, top + colH, 0.7);
  }
  const ey = top + colH + 0.1;
  put(g, RB(8.4, 0.9, PZ - F + 0.8, 0.02, 1), stoneP, -0.5, ey + 0.45, (F + PZ + 0.4) / 2);
  put(g, RB(8.6, 0.12, PZ - F + 1.0, 0.02, 1), stoneP, -0.5, ey + 0.96, (F + PZ + 0.5) / 2);
  D(g, A.quad('frieze', 6.2, 0.6), C.sign, -0.5, ey + 0.45, PZ + 0.405);
  const tri = new THREE.Shape(); tri.moveTo(-4.3, 0); tri.lineTo(4.3, 0); tri.lineTo(0, 1.35); tri.closePath();
  put(g, extrude(tri, PZ - F + 0.6, 0.02), stoneP, -0.5, ey + 1.02, F - 0.2);
  D(g, A.quad('coin', 0.95, 0.95), C.sign, -0.5, ey + 1.5, PZ + 0.43);
  // entrance and windows behind the columns
  for (const [a, b] of [[-1.75, -1.3], [0.3, 0.75]]) { glazing(C, a, b, top, 4.1, F + 0.01, { pane: 0.45, frame: 0x8a6a2a, transom: 3.0 }); site.colliders.push(aabb(a, 0, F - 0.1, b, 4.1, F + 0.1)); }
  glazing(C, -1.3, 0.3, 3.05, 4.1, F + 0.01, { pane: 1.6, frame: 0x8a6a2a });
  slideDoor(C, -0.5, F + 0.01, 1.6, 2.5, BF, 0x8a6a2a, 0xd8b25a);
  for (const x of [-4.4, 2.2]) {
    windows(C, [x + 0.7], 1.1, F, 1.2, 2.2, 0x2a3a52, stoneP, true);
    windows(C, [x + 0.7], 4.4, F, 1.2, 1.3, 0x2a3a52, stoneP);
  }
  for (const s of [-1, 1]) sconce(C, -0.5 + s * 1.65, 3.2, F);
  site.lamps.push({ pos: [-0.5, 4.0, F + 1.2], color: 0xffe2b0, intensity: 1.3, range: 8 });
  // ATM booth at the right front corner
  const ax = 5.05, az0 = F, az1 = F + 1.9, ah = 2.6, aw = 1.5;
  V(g, RB(aw, 0.1, az1 - az0, 0.01, 1), 0x8f8c86, ax, 0.05, (az0 + az1) / 2);
  put(g, RB(aw + 0.12, 0.42, az1 - az0 + 0.12, 0.03, 2), dark, ax, ah + 0.21, (az0 + az1) / 2);
  D(g, A.quad('atm', aw - 0.1, 0.3), C.sign, ax, ah + 0.21, az1 + 0.066);
  for (const s of [-1, 1]) for (const z of [az0 + 0.05, az1]) V(g, RB(0.07, ah, 0.07, 0.01, 1), 0x2a3a52, ax + s * (aw / 2 - 0.035), ah / 2, z);
  for (const s of [-1, 1]) D(g, quad(az1 - az0, ah - 0.2), C.glass, ax + s * (aw / 2 - 0.02), ah / 2, (az0 + az1) / 2, 0, PI / 2, 0);
  D(g, quad(aw - 0.1, ah - 0.2), C.glass, ax, ah / 2, az1);
  V(g, RB(0.8, 1.6, 0.55, 0.04, 2), 0xd8dde2, ax, 0.85, az0 + 0.32, 0, 0, 0, vcGloss());
  V(g, RB(0.8, 0.3, 0.6, 0.04, 2), 0x2a3a52, ax, 1.75, az0 + 0.32, 0, 0, 0, vcGloss());
  D(g, A.quad('atmScreen', 0.42, 0.3), C.sign, ax, 1.32, az0 + 0.6, -0.3, 0, 0);
  V(g, RB(0.5, 0.04, 0.2, 0.01, 1), 0x3a3b3d, ax, 1.0, az0 + 0.65);
  D(g, RB(aw - 0.2, 0.02, 0.5, 0.01, 1), C.cool, ax, ah - 0.02, (az0 + az1) / 2);
  site.lamps.push({ pos: [ax, 2.2, az1 + 0.4], color: 0xeaf2ff, intensity: 0.9, range: 5 });
  for (const x of [-5.3]) pottedPlant(g, x, 0.06, F + 0.6, { kind: 'fig', h: 1.4, seed: 4, pot: 'stone', potR: 0.3, potH: 0.55 });
  acUnit(C, -3, H, -3.5);
  site.colliders.push(aabb(X0, HB, BZ, X1, H + 0.7, F));
  for (let k = 0; k < 3; k++) site.colliders.push(aabb(-4.9 + k * 0.15, 0, F, 3.9 - k * 0.15, 0.15 * (k + 1), F + PZ + 0.6 - F - k * 0.35));
  solid(site, ax, ah / 2, (az0 + az1) / 2, aw, ah, az1 - az0);
  solid(site, -0.5, ey + 1, (F + PZ + 0.4) / 2, 8.6, 2.6, PZ - F + 0.8);
  site.extra.height = H + 0.7;
}

/* ================================================================== 우체국 (post office) */
function postbox(C, x, z) {
  const g = group(C.g, x, 0.06, z), gl = vcGloss(), O = 0xe4452a;
  V(g, RB(0.5, 0.12, 0.42, 0.02, 1), 0x3a3b3d, 0, 0.06, 0);
  V(g, RB(0.6, 1.0, 0.5, 0.05, 2), O, 0, 0.62, 0, 0, 0, 0, gl);
  V(g, CY(0.25, 0.25, 0.6, 24, false), O, 0, 1.12, 0, 0, 0, PI / 2, gl).scale.set(1, 1, 1);
  V(g, RB(0.4, 0.04, 0.06, 0.01, 1), 0x2b2d31, 0, 1.0, 0.26);
  V(g, RB(0.44, 0.04, 0.08, 0.01, 1), O, 0, 1.03, 0.27, 0, 0, 0, gl);
  D(g, C.A.quad('pbLabel', 0.42, 0.38), C.print, 0, 0.6, 0.256);
  V(g, RB(0.62, 0.05, 0.52, 0.02, 1), 0xf4f2ee, 0, 0.82, 0, 0, 0, 0, gl);
  C.site.colliders.push({ min: [x - 0.35, 0, z - 0.3], max: [x + 0.35, 1.4, z + 0.3] });
}

function buildPost(C) {
  const { g, site, A } = C;
  const cream = mat('plasterWarm'), O = paint(0xe4552a, 0.42, 0.15), trim = paint(0xf6efe2, 0.5, 0.05);
  const F = 2.3, BZ = -4.8, X0 = -5.85, X1 = 5.85, G = 3.6, H = 6.7, D0 = 1.0;
  put(g, RB(12, 0.06, 5 - F + 0.3, 0.02, 1), mat('pavers2'), 0, 0.03, (F - 0.3 + 5) / 2);
  // hollow ground floor: walls, floor, ceiling at 3.1 (front recess becomes part of the hall)
  const lin = mat('plaster');
  put(g, box(X1 - X0, H - G, F - BZ), cream, 0, G + (H - G) / 2, (F + BZ) / 2);
  wall(C, 'x', BZ, 1, X0, X1, 0, G, 0.25, cream, lin);
  for (const s of [-1, 1]) wall(C, 'z', s * X1, -s, BZ + 0.25, F - D0, 0, G, 0.25, cream, lin);
  slab(C, X0 + 0.25, X1 - 0.25, BZ + 0.25, F - D0, textured('tiles', { color: 0xe6ddcc, grout: 0xb8ad98, count: 3, rough: 0.4 }, 1.2, { normal: 0.4 }));
  slab(C, X0 + 0.3, 4.4, F - D0, F - 0.02, textured('tiles', { color: 0xe6ddcc, grout: 0xb8ad98, count: 3, rough: 0.4 }, 1.2, { normal: 0.4 }));
  ceilingWithLights(C, X0 + 0.25, X1 - 0.25, BZ + 0.25, F - 0.1, 3.1, paint(0xf6f2ea, 0.7), C.cool, 3, 3, 1.2, 0.5);
  put(g, box(X1 - X0, G - 3.1, D0), cream, 0, 3.1 + (G - 3.1) / 2, F - D0 / 2);
  roofEdge(C, X0, X1, BZ, F, H, 0.55, cream, O);
  put(g, RB(X1 - X0 + 0.06, 0.62, 0.3, 0.02, 1), O, 0, G - 0.25, F + 0.05);
  signBox(C, 'sign', -0.8, G - 0.25, F + 0.22, 7.2, 0.5, 0xe4552a, 0.06);
  // glass front, door at the right, parcels behind the glass
  const dX = 3.6, dW = 1.4;
  put(g, RB(X1 - (dX + dW / 2 + 0.1), G - 0.56, D0, 0.02, 1), cream, (X1 + dX + dW / 2 + 0.1) / 2, (G - 0.56) / 2, F - D0 / 2);
  put(g, RB(0.3, G - 0.56, D0, 0.02, 1), cream, X0 + 0.15, (G - 0.56) / 2, F - D0 / 2);
  glazing(C, X0 + 0.3, dX - dW / 2 - 0.1, 0.5, G - 0.6, F - 0.05, { pane: 2.2, frame: 0xe4552a });
  V(g, RB(dX - dW / 2 - 0.1 - X0 - 0.3, 0.4, 0.95, 0.01, 1), 0xa8a29a, (X0 + 0.3 + dX - dW / 2 - 0.1) / 2, FL + 0.2, F - 0.55);
  site.colliders.push(aabb(X0, 0, F - D0, X0 + 0.3, G, F), aabb(dX + dW / 2 + 0.1, 0, F - D0, X1, G, F), aabb(X0 + 0.3, 0, F - 1.05, dX - dW / 2 - 0.1, G - 0.6, F));
  put(g, RB(dX - dW / 2 - 0.1 - X0 - 0.3, 0.45, 0.2, 0.02, 1), cream, (X0 + 0.3 + dX - dW / 2 - 0.1) / 2, 0.25, F - 0.06);
  const R = C.R;
  for (let x = X0 + 0.7; x < dX - dW / 2 - 0.6;) {
    const w = 0.35 + R() * 0.35;
    let y = 0.55;
    for (let k = 0; k < 1 + ((R() * 3) | 0); k++) {
      const bw = w - k * 0.05, h = 0.2 + R() * 0.2, d = 0.3 + R() * 0.15;
      V(g, RB(bw, h, d, 0.01, 1), [0xc4935a, 0xb88850, 0xd2a46a][(R() * 3) | 0], x + w / 2, y + h / 2, F - 0.55, 0, (R() - 0.5) * 0.3, 0, vcMat());
      V(g, RB(bw + 0.004, 0.05, 0.06, 0.005, 1), 0xd8c8a0, x + w / 2, y + h / 2, F - 0.55 + d / 2 - 0.02, 0, 0, 0, vcMat());
      y += h;
    }
    x += w + 0.08;
  }
  slideDoor(C, dX, F - 0.05, dW, 2.4, FL, 0xe4552a);
  V(g, BX(dW + 0.3, 0.42, 0.12), 0xe4552a, dX, 2.9, F - 0.05, 0, 0, 0, vcGloss());
  D(g, A.quad('hours', 0.8, 0.24), C.print, X0 + 1.2, 1.0, F - 0.03);
  windows(C, [-4.0, -1.4, 1.2], G + 0.75, F, 1.6, 1.5, 0xe4552a, trim);
  // corner pylon with the logo
  const px = 4.65;
  put(g, RB(1.5, H + 1.6, 0.6, 0.04, 2), O, px, (H + 1.6) / 2 + G - 0.1 - 0.5, F + 0.2);
  D(g, A.quad('logoV', 1.2, 2.8), C.sign, px, H - 0.2, F + 0.505);
  site.lamps.push({ pos: [0, 3.0, F + 1.0], color: 0xfff1d6, intensity: 1.1, range: 7 });
  for (const x of [-2.5, 1.8]) sconce(C, x, 2.6, F + 0.0);
  postbox(C, -4.2, 4.0);
  scooter(C, 0.8, 4.0, 0, 0xe4552a, 0xe4552a, 'pbox');
  site.colliders.push({ min: [-0.1, 0, 3.7], max: [1.7, 1.3, 4.3] });
  pottedPlant(g, -2.6, 0.06, F + 0.45, { kind: 'bush', h: 0.8, seed: 12, pot: 'terracotta', potR: 0.22, potH: 0.45 });
  acUnit(C, -3, H, -3);
  site.colliders.push(aabb(X0, 3.1, BZ, X1, H + 0.55, F));
  site.extra.height = H + 1.6 + G - 0.6;
}

/* ================================================================== 바삭 치킨 / 피자 하우스 (small shops) */
function buildSmallShop(C, kind) {
  const { g, site, A } = C;
  const chicken = kind === 'chicken';
  const wallM = chicken ? textured('plaster', { color: 0xf6c84a, seed: 11 }, 3, { normal: 0.25 }) : mat('brick');
  const trim = chicken ? paint(0xd8352a, 0.45, 0.1) : paint(0xf1e6cf, 0.5, 0.05);
  const fr = chicken ? 0xd8352a : 0x3b2a20;
  const F = 2.2, BZ = -4.3, X0 = -4.9, X1 = 4.9, G = 3.7, PH = 0.9, D0 = chicken ? 1.0 : 1.7;
  const dX = chicken ? -3.4 : 3.2, dW = 1.2;
  const gx0 = chicken ? dX + dW / 2 + 0.15 : X0 + 0.4, gx1 = chicken ? X1 - 0.4 : dX - dW / 2 - 0.15;
  put(g, RB(10, 0.06, 4.5 - F + 0.3, 0.02, 1), mat(chicken ? 'pavers2' : 'pavers'), 0, 0.03, (F - 0.3 + 4.5) / 2);
  // hollow shop: walls, floor, ceiling at 2.85, roof slab; front fascia over the recess
  const lin = chicken ? textured('plaster', { color: 0xfff1d8, seed: 14 }, 3, { normal: 0.25 }) : mat('plasterWarm');
  wall(C, 'x', BZ, 1, X0, X1, 0, G, 0.25, wallM, lin);
  for (const s of [-1, 1]) wall(C, 'z', s * X1, -s, BZ + 0.25, F - D0, 0, G, 0.25, wallM, lin);
  put(g, box(X1 - X0, G - 2.93, F - D0 - BZ), wallM, 0, (G + 2.93) / 2, (F - D0 + BZ) / 2);
  const flo = chicken ? textured('tiles', { color: 0xf2ece0, grout: 0xc8bca8, count: 4, rough: 0.35 }, 1.2, { normal: 0.4 }) : mat('oakFloor');
  slab(C, X0 + 0.25, X1 - 0.25, BZ + 0.25, F - D0, flo);
  slab(C, Math.min(gx0, dX - dW / 2 - 0.1), Math.max(gx1, dX + dW / 2 + 0.1), F - D0, F - 0.03, flo);
  ceilingWithLights(C, X0 + 0.25, X1 - 0.25, BZ + 0.25, F - 0.1, 2.85, paint(0xf6f2ea, 0.7), C.lamp, 0, 0);
  put(g, box(X1 - X0, G - 2.92, D0), wallM, 0, (G + 2.92) / 2, F - D0 / 2);
  put(g, box(X1 - X0, 0.14, 0.25), wallM, 0, 2.85, F - 0.125);
  site.colliders.push(aabb(X0, 2.8, BZ, X1, G + PH, F), aabb(gx0, 0, F - 0.16, gx1, 2.8, F));
  for (const [a, b] of [[X0, Math.min(gx0, dX - dW / 2 - 0.1)], [Math.max(gx1, dX + dW / 2 + 0.1), X1]]) if (b - a > 0.05) { put(g, box(b - a, G - 0.9, D0), wallM, (a + b) / 2, (G - 0.9) / 2, F - D0 / 2); site.colliders.push(aabb(a, 0, F - D0, b, G, F)); }
  if (!chicken) put(g, box(dX - dW / 2 - 0.1 - gx1, G - 0.9, 0.3), wallM, (gx1 + dX - dW / 2 - 0.1) / 2, (G - 0.9) / 2, F - 0.15);
  else put(g, box(gx0 - (dX + dW / 2 + 0.1), G - 0.9, 0.3), wallM, (gx0 + dX + dW / 2 + 0.1) / 2, (G - 0.9) / 2, F - 0.15);
  roofEdge(C, X0, X1, BZ, F, G, PH, wallM, trim);
  put(g, RB(X1 - X0 + 0.06, 0.25, 0.3, 0.02, 1), mat('concrete'), 0, 0.125, F);
  glazing(C, gx0, gx1, 0.5, G - 0.95, F - 0.05, { pane: 1.8, frame: fr });
  put(g, RB(gx1 - gx0, 0.45, 0.2, 0.02, 1), trim, (gx0 + gx1) / 2, 0.27, F - 0.06);
  slideDoor(C, dX, F - 0.05, dW, 2.4, FL, fr);
  D(g, A.quad('open', 0.36, 0.13), C.sign, chicken ? gx0 + 0.35 : gx1 - 0.35, 1.75, F - 0.07);
  // sign board on the fascia
  signBox(C, 'sign', 0, G + 0.2, F + 0.1, 8.4, 0.9, chicken ? 0xd8352a : 0x2f7d46, 0.14);
  site.lamps.push({ pos: [0, G - 0.2, F + 1.0], color: 0xfff1d6, intensity: 1.0, range: 6 });
  // awning over the glass
  const am = chicken ? textured('stripes', { color: 0xd8352a, color2: 0xfff4d6, count: 5 }, 1.6, { normal: 0.5 }) : textured('stripes', { color: 0x2f7d46, color2: 0xf4efe4, count: 5 }, 1.6, { normal: 0.5 });
  const L = 1.1, drop = 0.45, aw = gx1 - gx0 + 0.2, acx = (gx0 + gx1) / 2;
  put(g, RB(aw, 0.03, Math.hypot(L, drop), 0.01, 1), am, acx, G - 0.85 - drop / 2, F + L / 2, Math.atan2(drop, L));
  put(g, RB(aw, 0.24, 0.03, 0.01, 1), am, acx, G - 0.85 - drop - 0.11, F + L);
  if (chicken) {
    // rooftop mascot disc
    const my = G + PH + 1.7, mz = F - 0.6;
    for (const s of [-1, 1]) V(g, RB(0.12, 1.9, 0.12, 0.02, 1), 0x3a3b3d, s * 0.7, G + PH + 0.5, mz);
    V(g, CY(1.32, 1.32, 0.18, 48), 0xd8352a, 0, my, mz, PI / 2, 0, 0, vcGloss());
    for (const s of [-1, 1]) D(g, A.quad('mascot', 2.4, 2.4), C.sign, 0, my, mz + s * 0.095, 0, s > 0 ? 0 : PI, 0);
    site.lamps.push({ pos: [0, my, mz + 1.5], color: 0xffd28a, intensity: 0.8, range: 5 });
    scooter(C, 2.6, 3.7, 0, 0xd8352a, 0xf6c84a, 'dbox');
    site.colliders.push({ min: [1.7, 0, 3.4], max: [3.5, 1.4, 4.0] });
    // A-board
    const bg = group(g, -1.3, 0.06, 3.4, 0.25);
    const fb = group(bg, 0, 0.42, 0.07); fb.rotation.x = -0.17;
    V(fb, RB(0.56, 0.84, 0.03, 0.01, 1), 0xd8352a); D(fb, A.quad('menu', 0.46, 0.68), C.print, 0, 0, 0.017);
    const bb = group(bg, 0, 0.42, -0.07); bb.rotation.x = 0.17; V(bb, RB(0.56, 0.84, 0.03, 0.01, 1), 0xd8352a);
    site.extra.height = my + 1.32;
  } else {
    // gable parapet with lit PIZZA letters, chimney
    const tri = new THREE.Shape(); tri.moveTo(-4.95, 0); tri.lineTo(4.95, 0); tri.lineTo(1.6, 1.5); tri.lineTo(-1.6, 1.5); tri.closePath();
    put(g, extrude(tri, 0.3, 0.02), trim, 0, G + PH, F - 0.32);
    put(g, RB(3.4, 0.1, 0.4, 0.02, 1), paint(0xb8282a, 0.45, 0.1), 0, G + PH + 1.55, F - 0.17);
    D(g, A.quad('gable', 3.6, 1.1), C.sign, 0, G + PH + 0.72, F + 0.02);
    put(g, RB(0.8, 3.2, 0.8, 0.02, 1), mat('brick'), -3.3, G + 1.3, -2.4);
    V(g, RB(0.95, 0.12, 0.95, 0.02, 1), 0x6b4a3a, -3.3, G + 2.95, -2.4);
    scooter(C, -1.6, 3.7, PI, 0x2f7d46, 0xf4efe4, 'dbox');
    site.colliders.push({ min: [-2.5, 0, 3.4], max: [-0.7, 1.4, 4.0] });
    pottedPlant(g, X1 - 0.6, 0.06, F + 0.45, { kind: 'bush', h: 0.9, seed: 21, pot: 'terracotta', potR: 0.22, potH: 0.45 });
    // bistro table
    V(g, CY(0.32, 0.32, 0.03, 24), 0xf1ece4, 1.0, 0.78, 3.5, 0, 0, 0, vcGloss());
    V(g, CY(0.025, 0.025, 0.72, 8), 0x2b2d31, 1.0, 0.42, 3.5);
    V(g, CY(0.2, 0.22, 0.03, 16), 0x2b2d31, 1.0, 0.07, 3.5);
    site.colliders.push({ min: [0.6, 0, 3.1], max: [1.4, 0.8, 3.9] });
    site.extra.height = G + PH + 1.6;
  }
  for (const s of [-1, 1]) sconce(C, dX + s * (dW / 2 + 0.3), 2.5, F - 0.0);
  pottedPlant(g, chicken ? X0 + 0.5 : -4.3, 0.06, F + 0.4, { kind: 'snake', h: 0.8, seed: 5, pot: 'charcoal', potR: 0.2, potH: 0.45 });
  acUnit(C, 2.5, G, -2.8);
}

/* ================================================================== interior kit (built lazily) */
function IK(C, seed) {
  return { C, A: C.A, g: new THREE.Group(), colliders: [], interactables: [], npcSpots: [], lamps: [], indoor: [], R: rng(seed) };
}
function done(I) {
  bake(I.g);
  const out = { group: I.g, colliders: I.colliders, interactables: I.interactables, npcSpots: I.npcSpots, lamps: I.lamps, indoor: I.indoor };
  if (I.frames) out.frames = I.frames;
  return out;
}
/** Collider for a w x d footprint centred at x, z (rotated by a multiple of PI/2), h tall from y. */
function foot(I, x, z, w, d, h, ry = 0, y = 0) {
  const sw = Math.abs(Math.sin(ry)) > 0.5, hw = (sw ? d : w) / 2, hd = (sw ? w : d) / 2;
  I.colliders.push(aabb(x - hw, y, z - hd, x + hw, y + h, z + hd));
}
function seatPose(eye, look) {
  const dx = look[0] - eye[0], dy = look[1] - eye[1], dz = look[2] - eye[2];
  return { pos: eye, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}
const BXC = new Map();
/** Cached plain box (12 triangles) for small clutter. */
function BX(w, h, d) {
  const k = `${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)}`;
  let g = BXC.get(k);
  if (!g) { g = box(+w.toFixed(3), +h.toFixed(3), +d.toFixed(3)); g.userData.shared = true; BXC.set(k, g); }
  return g;
}
const GOODS = [0xd8302a, 0xf2d03a, 0x2f6fc0, 0xf4f4f2, 0x3a9a5a, 0xf28a1e, 0x8a4ab0, 0xe86aa0, 0x5ac8d8, 0x8a5a3a, 0x1f8a4c, 0xffffff];
/** Products along local X from x0..x1 standing on y at depth z. mode: 'mix' | 'drinks' | 'boxes'. */
function goodsRow(p, x0, x1, y, z, dmax, hmax, R, mode = 'mix', cols = GOODS) {
  for (let x = x0; x < x1 - 0.06;) {
    const k = mode === 'drinks' ? R() * 0.4 : mode === 'boxes' ? 0.5 + R() * 0.5 : R();
    const col = cols[(R() * cols.length) | 0];
    if (k < 0.22) {
      const h = Math.min(hmax, 0.2 + R() * 0.12), n = 2 + ((R() * 3) | 0);
      for (let i = 0; i < n && x < x1 - 0.06; i++, x += 0.075) {
        V(p, CY(0.032, 0.032, h * 0.72, 7), col, x + 0.035, y + h * 0.36, z, 0, 0, 0, vcGloss());
        V(p, CY(0.013, 0.03, h * 0.26, 6), i % 2 ? 0xf4f4f2 : col, x + 0.035, y + h * 0.85, z, 0, 0, 0, vcGloss());
      }
      x += 0.015;
    } else if (k < 0.4) {
      const h = Math.min(hmax, 0.16 + R() * 0.08), n = 2 + ((R() * 3) | 0);
      for (let i = 0; i < n && x < x1 - 0.06; i++, x += 0.072) V(p, BX(0.065, h, 0.065), col, x + 0.035, y + h / 2, z);
      x += 0.015;
    } else {
      const w = 0.09 + R() * 0.14, h = Math.min(hmax, 0.1 + R() * 0.2), d = dmax * (0.65 + R() * 0.35);
      if (x + w > x1) break;
      V(p, BX(w, h, d), col, x + w / 2, y + h / 2, z);
      if (R() < 0.6) V(p, BX(w * 0.7, h * 0.3, 0.004), R() < 0.5 ? 0xffffff : 0x2b2d31, x + w / 2, y + h * 0.6, z + d / 2 + 0.002);
      x += w + 0.012;
    }
  }
}
/** Double-sided shop shelf along local X (length len), rotated ry, centred at x, z; goods on both sides. */
function gondola(I, x, z, len, ry, h = 1.75, mode = 'mix', cols) {
  const p = group(I.g, x, FL, z, ry), R = I.R, A = I.A, C = I.C;
  V(p, BX(len, 0.12, 0.9), 0x3a3d42, 0, 0.06, 0);
  V(p, BX(len, h, 0.05), 0xdfe3e6, 0, h / 2, 0);
  const n = 4, gap = (h - 0.2) / n;
  for (const s of [-1, 1]) for (let k = 0; k < n; k++) {
    const y = 0.14 + k * gap;
    V(p, BX(len, 0.025, 0.42), 0xd6dadd, 0, y, s * 0.235);
    D(p, A.quad('price', len, 0.045), C.print, 0, y - 0.01, s * 0.448, 0, s > 0 ? 0 : PI, 0);
    goodsRow(p, -len / 2 + 0.04, len / 2 - 0.02, y + 0.013, s * 0.235, 0.36, gap - 0.06, R, mode, cols);
  }
  for (const e of [-1, 1]) V(p, BX(0.04, h + 0.06, 0.94), 0xc9ced3, e * len / 2, (h + 0.06) / 2, 0, 0, 0, 0, vcGloss());
  V(p, BX(len + 0.04, 0.05, 0.3), 0x1f8a4c, 0, h + 0.05, 0);
  foot(I, x, z, len + 0.05, 0.94, h, ry);
  return p;
}
/** Upright glass-door cooler row (width w) with its back at the wall, facing +Z after rotation ry. */
function coolerRow(I, x, z, w, ry, mode = 'drinks', cols) {
  const C = I.C, A = I.A, R = I.R, h = 2.1, d = 0.75;
  const p = group(I.g, x, FL, z, ry);
  V(p, BX(w, 0.22, d), 0x2b2d31, 0, 0.11, 0);
  V(p, BX(w, 0.32, d), 0xeef0f2, 0, h - 0.16, 0, 0, 0, 0, vcGloss());
  D(p, A.quad('cool', w - 0.12, 0.2), C.sign, 0, h - 0.16, d / 2 + 0.004);
  V(p, BX(w, h, 0.04), 0xf2f4f6, 0, h / 2, -d / 2 + 0.02);
  D(p, BX(w - 0.1, 0.02, 0.04), C.cool, 0, h - 0.34, d / 2 - 0.08);
  for (const e of [-1, 1]) V(p, BX(0.05, h, d), 0xdfe3e6, e * (w / 2 - 0.025), h / 2, 0);
  for (let k = 0; k < 5; k++) {
    const y = 0.24 + k * 0.33;
    V(p, BX(w - 0.1, 0.02, d - 0.18), 0xcfd4d8, 0, y, -0.05);
    goodsRow(p, -w / 2 + 0.07, w / 2 - 0.06, y + 0.01, -0.02, 0.3, 0.28, R, mode, cols);
  }
  const nd = Math.max(1, Math.round(w / 0.75));
  for (let i = 0; i <= nd; i++) V(p, BX(0.045, h - 0.52, 0.05), 0x9aa0a6, -w / 2 + 0.025 + (w - 0.05) * i / nd, 0.22 + (h - 0.52) / 2, d / 2 - 0.02, 0, 0, 0, vcGloss());
  for (let i = 0; i < nd; i++) V(p, BX(0.025, 0.55, 0.035), 0xc9ced3, -w / 2 + (w * (i + 1)) / nd - 0.09, 1.15, d / 2 + 0.015, 0, 0, 0, vcGloss());
  D(p, quad(w - 0.05, h - 0.52), C.glass, 0, 0.22 + (h - 0.52) / 2, d / 2);
  foot(I, x, z, w, d, h, ry);
  return p;
}
/** Café chair, sitter faces +Z before rotation ry; seat top 0.47. */
function chair(p, x, y, z, ry, hex, leg = 0x2b2d31) {
  const g = group(p, x, y, z, ry);
  V(g, RB(0.42, 0.045, 0.42, 0.015, 1), hex, 0, 0.45, 0, 0, 0, 0, vcGloss());
  V(g, RB(0.42, 0.34, 0.035, 0.015, 1), hex, 0, 0.74, -0.2, -0.1, 0, 0, vcGloss());
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) V(g, CY(0.014, 0.012, 0.44, 6), leg, sx * 0.18, 0.22, sz * 0.18);
  return g;
}
/** Table (top w x d at 0.75) on a pedestal, with chairs on the given sides ('n' = -Z, 's' = +Z, 'e', 'w'). */
function cafeTable(I, x, z, w, d, topHex, chairHex, sides = 'ns', y = FL) {
  const p = group(I.g, x, y, z);
  V(p, RB(w, 0.04, d, 0.012, 1), topHex, 0, 0.74, 0, 0, 0, 0, vcGloss());
  V(p, CY(0.035, 0.035, 0.7, 10), 0x2b2d31, 0, 0.37, 0, 0, 0, 0, vcGloss());
  V(p, CY(0.22, 0.25, 0.03, 18), 0x2b2d31, 0, 0.015, 0, 0, 0, 0, vcGloss());
  const spots = [];
  for (const sd of sides) {
    const [cx, cz, ry] = sd === 'n' ? [0, -d / 2 - 0.22, 0] : sd === 's' ? [0, d / 2 + 0.22, PI] : sd === 'e' ? [w / 2 + 0.22, 0, -PI / 2] : [-w / 2 - 0.22, 0, PI / 2];
    chair(p, cx, 0, cz, ry, chairHex);
    spots.push({ pos: [x + cx, y, z + cz], yaw: ry + PI });
  }
  foot(I, x, z, w, d, 0.76, 0, y);
  return spots;
}
/** Framed print or lightbox facing +Z after rotation ry. */
function framed(I, key, x, y, z, w, h, ry = 0, lit = false, frame = 0x2b2d31) {
  const p = group(I.g, x, y, z, ry);
  V(p, RB(w + 0.08, h + 0.08, lit ? 0.1 : 0.035, 0.012, 1), frame, 0, 0, lit ? 0.05 : 0.0175, 0, 0, 0, vcGloss());
  D(p, I.A.quad(key, w, h), lit ? I.C.sign : I.C.print, 0, 0, lit ? 0.102 : 0.037);
  return p;
}
/** Black monitor with a lit atlas screen, face towards +Z after ry, standing on y. */
function screenOn(I, x, y, z, ry, key, w = 0.52, h = 0.32) {
  const p = group(I.g, x, y, z, ry);
  V(p, RB(w + 0.03, h + 0.03, 0.03, 0.006, 1), 0x1b1b1d, 0, 0.12 + h / 2, 0);
  V(p, RB(0.05, 0.14, 0.03, 0.006, 1), 0x2b2d31, 0, 0.07, -0.03);
  V(p, RB(0.2, 0.012, 0.15, 0.004, 1), 0x2b2d31, 0, 0.006, -0.02);
  D(p, I.A.quad(key, w, h), I.C.sign, 0, 0.12 + h / 2, 0.016);
  return p;
}
/** Wall clock facing +Z after ry. */
function clockOn(I, x, y, z, ry, r = 0.18) {
  const p = group(I.g, x, y, z, ry);
  V(p, CY(r, r, 0.045, 28), 0x2b2d31, 0, 0, 0.022, PI / 2, 0, 0, vcGloss());
  D(p, I.A.quad('clock', r * 1.8, r * 1.8), I.C.print, 0, 0, 0.046);
  return p;
}
/** Service counter along local X: body, top, kick; customer side +Z. Collider included. */
function counterAt(I, x, z, len, dep, h, ry, bodyHex, topHex, y = FL) {
  const p = group(I.g, x, y, z, ry);
  V(p, RB(len, h - 0.05, dep, 0.02, 1), bodyHex, 0, (h - 0.05) / 2, 0, 0, 0, 0, vcGloss());
  V(p, RB(len + 0.06, 0.05, dep + 0.08, 0.012, 1), topHex, 0, h - 0.025, 0.02, 0, 0, 0, vcGloss());
  V(p, BX(len - 0.04, 0.1, 0.02), 0x2b2d31, 0, 0.05, dep / 2 + 0.002);
  foot(I, x, z, len + 0.06, dep + 0.1, h, ry, 0);
  return p;
}
/** Row of linked waiting chairs (n seats), sitters face +Z after ry. Returns sitter spots. */
function linkedSeats(I, x, z, n, ry, hex, y = FL) {
  const p = group(I.g, x, y, z, ry), L = n * 0.56;
  V(p, BX(L, 0.05, 0.08), 0x3a3d42, 0, 0.32, -0.05, 0, 0, 0, vcGloss());
  for (const e of [-1, 1]) { V(p, BX(0.05, 0.32, 0.05), 0x3a3d42, e * (L / 2 - 0.1), 0.16, -0.05); V(p, BX(0.06, 0.03, 0.5), 0x3a3d42, e * (L / 2 - 0.1), 0.015, -0.05); }
  const spots = [];
  for (let i = 0; i < n; i++) {
    const cx = -L / 2 + 0.28 + i * 0.56;
    V(p, RB(0.48, 0.07, 0.44, 0.03, 1), hex, cx, 0.42, 0, 0, 0, 0, vcSoft());
    V(p, RB(0.48, 0.42, 0.06, 0.03, 1), hex, cx, 0.7, -0.23, -0.12, 0, 0, vcSoft());
    if (i) V(p, RB(0.05, 0.04, 0.36, 0.01, 1), 0x2b2d31, cx - 0.28, 0.6, -0.02);
    const c = Math.cos(ry), s = Math.sin(ry);
    spots.push({ pos: [x + cx * c, y, z - cx * s], yaw: ry + PI });
  }
  foot(I, x, z, L, 0.55, 0.9, ry, 0);
  return spots;
}
const npc = (I, x, y, z, yaw, pose, role) => I.npcSpots.push({ pos: [x, y, z], yaw, pose, role });
/** Potted plant without collider fuss. */
function plant(I, x, z, kind = 'fig', h = 1.4, seed = 1, y = FL) {
  pottedPlant(I.g, x, y, z, { kind, h, seed, pot: kind === 'fig' ? 'white' : 'charcoal', potR: 0.24, potH: 0.45 });
  foot(I, x, z, 0.5, 0.5, 1.0, 0, 0);
}

/* ------------------------------------------------------------------ 소방서 interior */
function fireInterior(C) {
  const I = IK(C, 501), g = I.g, A = I.A, FF = 0.08, RED = 0xc4161c, TAN = 0xb89a5a;
  // gear lockers along the back wall: coat, helmet, boots and pants in each
  const LZ = -6.5 + 0.28;
  for (let i = 0; i < 10; i++) {
    const p = group(g, -0.55 + i * 0.5, FF, LZ), hc = i % 4 === 3 ? 0xf4f4f2 : i % 2 ? 0xe8b830 : 0xd03a22;
    V(p, BX(0.5, 0.1, 0.55), 0x2b2d31, 0, 0.05, 0);
    V(p, BX(0.03, 2.0, 0.55), RED, -0.235, 1.0, 0, 0, 0, 0, vcGloss());
    if (i === 9) V(p, BX(0.03, 2.0, 0.55), RED, 0.235, 1.0, 0, 0, 0, 0, vcGloss());
    V(p, BX(0.5, 0.05, 0.56), RED, 0, 2.02, 0, 0, 0, 0, vcGloss());
    V(p, BX(0.47, 0.025, 0.5), 0x9aa0a6, 0, 1.62, 0);
    V(p, BX(0.47, 1.9, 0.02), 0x8a9096, 0, 1.0, -0.265);
    V(p, SP(0.15, 14, 10), hc, 0, 1.74, 0.02, 0, 0, 0, vcGloss()).scale.set(1, 0.8, 1.15);
    V(p, CY(0.19, 0.21, 0.02, 18), hc, 0, 1.655, 0.03, 0, 0, 0, vcGloss());
    V(p, BX(0.16, 0.04, 0.01), 0xd8e04a, 0, 1.78, 0.19, -0.5, 0, 0, vcGloss());
    V(p, CY(0.008, 0.008, 0.36, 6), 0x9aa0a6, 0, 1.55, 0, 0, 0, PI / 2);
    V(p, RB(0.4, 0.82, 0.2, 0.06, 2), TAN, 0, 1.1, 0.02, 0, 0, 0, vcSoft());
    for (const s of [-1, 1]) V(p, RB(0.1, 0.7, 0.12, 0.04, 1), TAN, s * 0.19, 1.07, 0.03, 0, 0, s * 0.06, vcSoft());
    V(p, RB(0.3, 0.08, 0.18, 0.03, 1), 0x2b2d31, 0, 1.5, 0.02, 0, 0, 0, vcSoft());
    for (const y of [0.86, 1.22]) { V(p, BX(0.405, 0.05, 0.205), 0xd8e04a, 0, y, 0.02, 0, 0, 0, vcGloss()); V(p, BX(0.41, 0.018, 0.21), 0xd9dcde, 0, y, 0.02, 0, 0, 0, vcGloss()); }
    for (const s of [-1, 1]) { V(p, CY(0.07, 0.075, 0.36, 12), 0x1b1b1d, s * 0.09, 0.28, 0.06, 0, 0, 0, vcGloss()); V(p, BX(0.12, 0.06, 0.24), 0x1b1b1d, s * 0.09, 0.13, 0.1); }
    V(p, RB(0.38, 0.22, 0.26, 0.06, 1), TAN, 0, 0.5, 0.05, 0, 0, 0, vcSoft());
    V(p, BX(0.2, 0.05, 0.005), 0xffffff, 0, 1.93, 0.28);
  }
  I.colliders.push(aabb(-0.82, 0, -6.5, 4.22, 2.1, LZ + 0.29));
  V(g, RB(4.4, 0.06, 0.36, 0.015, 1), 0x8a6a4a, 1.7, FF + 0.45, -5.45, 0, 0, 0, vcGloss());
  for (const x of [-0.3, 1.7, 3.7]) V(g, BX(0.06, 0.42, 0.3), 0x3a3d42, x, FF + 0.21, -5.45);
  foot(I, 1.7, -5.45, 4.4, 0.36, 0.48);
  framed(I, 'motto', 1.7, FF + 3.0, -6.48, 3.6, 0.72, 0, true, RED);
  D(g, A.quad('wall119', 4.6, 1.0), C.print, -5.87, 3.7, -2.4, 0, PI / 2, 0);
  clockOn(I, -3.4, 3.2, -6.48, 0, 0.22);
  // duty room: low wall + glass, its own ceiling, desks with dispatch screens, sofa, coffee corner
  const DX0 = 4.7, DX1 = 8.5, DZ0 = -6.5, DZ1 = -2.3, DH = 2.7, part = paint(0xf2f0ea, 0.5);
  wall(I, 'x', DZ1, -1, DX0, DX1, 0, FF + 0.95, 0.12, part, null, [[5.05, 6.05, 0, FF + 0.95]]);
  wall(I, 'z', DX0, 1, DZ0, DZ1 - 0.12, 0, FF + 0.95, 0.12, part, null);
  const gy0 = FF + 0.95, gh = DH - 0.95;
  for (const [a, b] of [[DX0, 5.05], [6.05, DX1]]) D(g, quad(b - a, gh), C.glass, (a + b) / 2, gy0 + gh / 2, DZ1 - 0.06);
  D(g, quad(DZ1 - DZ0, gh), C.glass, DX0 + 0.06, gy0 + gh / 2, (DZ0 + DZ1) / 2, 0, PI / 2, 0);
  for (const x of [DX0 + 0.04, 5.05, 6.05, 7.3, DX1 - 0.04]) V(g, BX(0.05, DH + 0.1, 0.14), 0x2b2d31, x, FF + (DH + 0.1) / 2, DZ1 - 0.06);
  for (const z of [DZ0 + 0.04, -5.1, -3.7]) V(g, BX(0.14, gh, 0.05), 0x2b2d31, DX0 + 0.06, gy0 + gh / 2, z);
  V(g, BX(DX1 - DX0 + 0.1, 0.14, DZ1 - DZ0 + 0.1), 0xf2f0ea, (DX0 + DX1) / 2, FF + DH + 0.07, (DZ0 + DZ1) / 2);
  D(g, RB(1.4, 0.02, 0.5, 0.008, 1), C.cool, 6.6, FF + DH - 0.01, -4.4);
  V(g, BX(0.04, 2.1, 0.92), 0xe8e6e0, 5.1, FF + 1.05, -2.85, 0, 0, 0, vcGloss());
  framed(I, 'dutySign', 5.55, FF + 2.45, DZ1 + 0.01, 0.9, 0.24, 0, true, RED);
  for (const [x, k] of [[5.9, 0], [7.5, 1]]) {
    V(g, RB(1.5, 0.035, 0.72, 0.01, 1), 0xdcc6a2, x, FF + 0.74, -6.08, 0, 0, 0, vcGloss());
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) V(g, BX(0.05, 0.72, 0.05), 0x8a9096, x + sx * 0.7, FF + 0.36, -6.08 + sz * 0.3);
    screenOn(I, x - 0.32, FF + 0.76, -6.25, 0, k ? 'cad' : 'map', 0.5, 0.3);
    screenOn(I, x + 0.32, FF + 0.76, -6.25, -0.2, k ? 'map' : 'cad', 0.5, 0.3);
    V(g, BX(0.42, 0.02, 0.14), 0x2b2d31, x, FF + 0.765, -5.9);
    V(g, RB(0.2, 0.06, 0.16, 0.02, 1), 0x2b2d31, x + 0.55, FF + 0.79, -5.95);
    V(g, CY(0.04, 0.035, 0.09, 12), k ? 0xf2c14e : 0xffffff, x - 0.6, FF + 0.8, -5.9, 0, 0, 0, vcGloss());
    officeChair(g, x, FF, -5.35, PI);
  }
  I.colliders.push(aabb(5.1, 0, -6.5, 8.3, 0.8, -5.7));
  framed(I, 'map', 8.45, FF + 1.75, -4.3, 2.0, 1.12, -PI / 2, true, 0x1b1b1d);
  framed(I, 'roster', 8.47, FF + 1.55, -5.95, 0.8, 0.6, -PI / 2, false, 0xc9ced3);
  clockOn(I, 6.7, FF + 2.3, -6.48, 0);
  sofa(g, 5.25, FF, -3.55, PI / 2, { w: 1.8, fabric: mat('fabricBlue'), pillows: [0xc4161c, 0xe8c24a] });
  foot(I, 5.25, -3.55, 1.8, 0.9, 0.8, PI / 2);
  V(g, RB(0.9, 0.04, 0.5, 0.01, 1), 0x8a6a4a, 6.4, FF + 0.42, -3.55, 0, 0, 0, vcGloss());
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) V(g, BX(0.04, 0.4, 0.04), 0x2b2d31, 6.4 + sx * 0.4, FF + 0.2, -3.55 + sz * 0.2);
  V(g, CY(0.04, 0.035, 0.09, 12), 0xc4161c, 6.3, FF + 0.485, -3.5, 0, 0, 0, vcGloss());
  foot(I, 6.4, -3.55, 0.9, 0.5, 0.45);
  counterAt(I, 8.18, -2.95, 1.0, 0.6, 0.9, -PI / 2, 0xe8e6e0, 0x9aa0a6, FF);
  V(g, RB(0.3, 0.38, 0.3, 0.03, 2), 0x1b1b1d, 8.2, FF + 1.09, -3.15, 0, 0, 0, vcGloss());
  D(g, RB(0.08, 0.04, 0.01, 0.005, 1), C.cool, 8.05, FF + 1.18, -3.15, 0, -PI / 2, 0);
  for (let k = 0; k < 3; k++) V(g, CY(0.04, 0.035, 0.09, 12), [0xffffff, 0xc4161c, 0x2f6fc0][k], 8.2, FF + 0.945, -2.75 + k * 0.1, 0, 0, 0, vcGloss());
  // fire pole down from the upper floor
  V(g, CY(0.045, 0.045, 4.84, 16), 0xd8b25a, 3.4, FF + 2.42, -1.6, 0, 0, 0, vcGloss());
  V(g, torus(0.5, 0.05, 8, 28), RED, 3.4, 4.86, -1.6, PI / 2, 0, 0, vcGloss());
  V(g, CY(0.46, 0.46, 0.01, 28), 0x1b1b1d, 3.4, 4.875, -1.6);
  V(g, CY(0.75, 0.75, 0.04, 28), 0x8a1a22, 3.4, FF + 0.02, -1.6, 0, 0, 0, vcSoft());
  I.colliders.push(aabb(3.3, 0, -1.7, 3.5, 4.9, -1.5));
  // equipment rack on the right wall: hoses, air tanks, boxes, ropes
  const rk = group(g, 8.2, FF, 0.0, -PI / 2);
  for (const x of [-1.65, -0.55, 0.55, 1.65]) for (const z of [-0.26, 0.26]) V(rk, BX(0.05, 2.15, 0.05), 0x5a6068, x, 1.075, z);
  for (const y of [0.12, 0.78, 1.42, 2.05]) V(rk, BX(3.35, 0.03, 0.58), 0x9aa0a6, 0, y, 0);
  for (let k = 0; k < 9; k++) { V(rk, CY(0.085, 0.085, 0.55, 14), 0xe8c24a, -1.5 + k * 0.37, 0.41, 0.05, 0, 0, 0, vcGloss()); V(rk, CY(0.03, 0.03, 0.08, 8), 0x2b2d31, -1.5 + k * 0.37, 0.72, 0.05); }
  for (let k = 0; k < 6; k++) { V(rk, CY(0.25, 0.25, 0.13, 22), k % 2 ? 0xe9dcc0 : 0xc4161c, -1.3 + k * 0.52, 1.05, 0.05, PI / 2, 0, 0, vcSoft()); V(rk, CY(0.07, 0.07, 0.14, 12), 0x3a3b3d, -1.3 + k * 0.52, 1.05, 0.05, PI / 2); }
  goodsRow(rk, -1.6, 1.6, 1.435, 0.0, 0.45, 0.4, I.R, 'boxes', [0xc4935a, 0xd2a46a, 0xc4161c, 0x2b2d31, 0xe8c24a]);
  for (let k = 0; k < 4; k++) V(rk, torus(0.16, 0.035, 8, 20), [0xe8c24a, 0x2f6fc0][k % 2], -1.2 + k * 0.8, 2.1, 0.0, PI / 2, 0, 0, vcSoft());
  foot(I, 8.2, 0.0, 3.4, 0.6, 2.2, -PI / 2);
  // hose reel cart
  const hc = group(g, 1.3, FF, -3.2, 0.3);
  for (const s of [-1, 1]) { V(hc, BX(0.05, 0.9, 0.05), RED, s * 0.32, 0.55, 0); V(hc, torus(0.16, 0.05, 8, 18), 0x1b1b1d, s * 0.38, 0.17, 0.15, 0, PI / 2, 0); }
  V(hc, CY(0.42, 0.42, 0.55, 26), 0xe9dcc0, 0, 0.6, 0, 0, 0, PI / 2, vcSoft());
  for (const s of [-1, 1]) V(hc, CY(0.46, 0.46, 0.03, 26), RED, s * 0.29, 0.6, 0, 0, 0, PI / 2, vcGloss());
  V(hc, CY(0.02, 0.02, 0.9, 8), 0x9aa0a6, 0, 1.0, -0.35, 0.5, 0, PI / 2);
  foot(I, 1.3, -3.2, 1.0, 0.9, 1.1);
  // cones and extinguishers
  for (const x of [5.2, 6.1, 7.0]) {
    V(g, lathe([[0, 0], [0.2, 0], [0.2, 0.03], [0.05, 0.7], [0, 0.72]], 16), 0xf27a1e, x, FF, 1.45, 0, 0, 0, vcGloss());
    V(g, BX(0.42, 0.03, 0.42), 0xf27a1e, x, FF + 0.015, 1.45, 0, 0, 0, vcGloss());
    V(g, CY(0.112, 0.13, 0.09, 16), 0xf4f4f2, x, FF + 0.4, 1.45, 0, 0, 0, vcGloss());
  }
  for (const [x, z] of [[-1.15, -6.38], [4.5, -2.1]]) {
    V(g, CY(0.08, 0.08, 0.5, 14), RED, x, FF + 0.3, z, 0, 0, 0, vcGloss());
    V(g, CY(0.03, 0.05, 0.08, 10), 0x2b2d31, x, FF + 0.59, z);
    V(g, BX(0.12, 0.03, 0.04), 0x2b2d31, x + 0.04, FF + 0.64, z);
  }
  // people, lamps, the truck seat
  npc(I, 1.6, FF, -4.95, PI, 'stand', 'staff');
  npc(I, -1.65, FF, -2.6, PI / 2, 'stand', 'staff');
  npc(I, 5.9, FF, -5.35, 0, 'sit', 'staff');
  npc(I, 6.6, FF, 0.4, -PI / 2, 'stand', 'staff');
  I.lamps.push({ pos: [-3.4, 4.4, -2.5], color: 0xfff1d6, intensity: 1.4, range: 11 }, { pos: [2.0, 4.4, -2.5], color: 0xfff1d6, intensity: 1.4, range: 11 },
    { pos: [6.6, 2.5, -4.4], color: 0xf4f8ff, intensity: 1.0, range: 6 }, { pos: [6.6, 4.4, 0.4], color: 0xfff1d6, intensity: 1.0, range: 8 });
  I.indoor.push(aabb(-5.9, 0, -6.5, 8.5, 4.9, 2.14));
  I.interactables.push({ id: 'firetruck', label: '소방차 타 보기', pos: [-1.75, 1.5, 0.9], radius: 1.4, seat: { pos: [-2.8, 2.6, 0.85], yaw: PI, pitch: -0.06 } });
  return done(I);
}

/* ------------------------------------------------------------------ 경찰서 interior */
function policeInterior(C) {
  const I = IK(C, 502), g = I.g, A = I.A, NAVY = 0x1f4f9a;
  // front desk (customer side +Z) with a staff work top behind
  counterAt(I, 0, -0.95, 6.0, 0.55, 1.1, 0, 0x2a3a52, 0xc09060);
  D(g, A.quad('emblem', 0.5, 0.6), C.sign, 0, FL + 0.55, -0.67);
  V(g, BX(6.0, 0.06, 0.012), 0x3a7bff, 0, FL + 0.92, -0.67, 0, 0, 0, vcGloss());
  for (const x of [-1.8, 1.8]) { D(g, quad(1.1, 0.5), C.glass, x, FL + 1.38, -0.95); V(g, BX(1.12, 0.03, 0.04), 0xc9ced3, x, FL + 1.64, -0.95, 0, 0, 0, vcGloss()); for (const s of [-1, 1]) V(g, BX(0.03, 0.52, 0.04), 0xc9ced3, x + s * 0.56, FL + 1.38, -0.95, 0, 0, 0, vcGloss()); }
  V(g, RB(6.0, 0.04, 0.6, 0.01, 1), 0xeceae5, 0, FL + 0.74, -1.55, 0, 0, 0, vcGloss());
  for (const x of [-2.4, 0, 2.4]) V(g, BX(0.5, 0.72, 0.5), 0xdcdad4, x, FL + 0.36, -1.6);
  foot(I, 0, -1.55, 6.0, 0.6, 0.78);
  for (const x of [-1.6, 0.6]) screenOn(I, x, FL + 0.76, -1.45, PI, 'pc', 0.5, 0.3);
  V(g, CY(0.06, 0.07, 0.03, 16), 0xd8b25a, 0.5, FL + 1.115, -0.85, 0, 0, 0, vcGloss()); V(g, SP(0.045, 12, 8), 0xd8b25a, 0.5, FL + 1.14, -0.85, 0, 0, 0, vcGloss());
  for (let k = 0; k < 6; k++) V(g, BX(0.21, 0.004, 0.3), 0xfbf9f2, -0.6, FL + 1.105 + k * 0.004, -0.85, 0, k * 0.05, 0);
  V(g, CY(0.006, 0.006, 0.15, 6), 0x1b1b1d, -0.3, FL + 1.11, -0.8, PI / 2, 0.4, 0);
  for (const s of [-1, 1]) {
    for (let x = 3.2; x <= 6.4; x += 0.8) V(g, CY(0.025, 0.025, 0.95, 10), 0xc09060, s * x, FL + 0.475, -0.98, 0, 0, 0, vcGloss());
    V(g, BX(3.3, 0.05, 0.07), 0xc09060, s * 4.8, FL + 0.95, -0.98, 0, 0, 0, vcGloss());
    V(g, BX(3.3, 0.04, 0.03), 0xc09060, s * 4.8, FL + 0.5, -0.98, 0, 0, 0, vcGloss());
    I.colliders.push(aabb(s < 0 ? -6.45 : 3.0, 0, -1.03, s < 0 ? -3.0 : 6.45, 1.0, -0.93));
    V(g, CY(0.008, 0.008, 0.5, 6), 0x2b2d31, s * 1.2, 3.05, -0.95);
  }
  V(g, RB(3.0, 0.42, 0.1, 0.02, 1), NAVY, 0, 2.6, -0.95, 0, 0, 0, vcGloss());
  for (const r of [0, PI]) D(g, A.quad('minwon', 2.85, 0.33), C.sign, 0, 2.6, -0.95 + (r ? -0.052 : 0.052), 0, r, 0);
  // office: four desks facing the lobby, cabinets, emblem wall, a door to the back rooms
  for (const x of [-5.2, -2.6, 2.6, 5.2]) {
    const z = -3.75;
    V(g, RB(1.5, 0.035, 0.75, 0.01, 1), 0xeceae5, x, FL + 0.74, z, 0, 0, 0, vcGloss());
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) V(g, BX(0.05, 0.72, 0.05), 0x8a9096, x + sx * 0.7, FL + 0.36, z + sz * 0.32);
    V(g, BX(0.42, 0.6, 0.5), 0xdcdad4, x + 0.45, FL + 0.32, z);
    screenOn(I, x - 0.1, FL + 0.76, z + 0.15, PI, 'pc', 0.5, 0.3);
    V(g, BX(0.42, 0.02, 0.14), 0x2b2d31, x - 0.1, FL + 0.765, z - 0.15);
    for (let k = 0; k < 4; k++) V(g, BX(0.21, 0.004, 0.3), 0xfbf9f2, x + 0.5, FL + 0.76 + k * 0.004, z - 0.05, 0, k * 0.07, 0);
    V(g, CY(0.04, 0.035, 0.09, 12), [0xffffff, 0x2f6f73, 0xf2c14e, 0xd9534f][(x + 6) % 4 | 0], x - 0.6, FL + 0.8, z - 0.1, 0, 0, 0, vcGloss());
    officeChair(g, x - 0.1, FL, z - 0.7, 0);
    foot(I, x, z, 1.5, 0.75, 0.78);
  }
  for (let k = 0; k < 6; k++) {
    const x = -6.9 + k * 0.55, z = -5.25;
    V(g, RB(0.5, 1.32, 0.6, 0.01, 1), 0xb9bec4, x, FL + 0.66, z, 0, 0, 0, vcGloss());
    for (let d = 0; d < 4; d++) { V(g, BX(0.46, 0.006, 0.006), 0x8a9096, x, FL + 0.33 * d + 0.33, z + 0.302); V(g, BX(0.14, 0.02, 0.03), 0x5a5d62, x, FL + 0.33 * d + 0.2, z + 0.31); V(g, BX(0.08, 0.04, 0.004), 0xffffff, x - 0.14, FL + 0.33 * d + 0.24, z + 0.302); }
  }
  I.colliders.push(aabb(-7.2, 0, -5.55, -3.6, 1.35, -4.95));
  const bs = group(g, 5.4, FL, -5.3);
  V(bs, BX(2.2, 2.0, 0.04), 0x8a9096, 0, 1.0, -0.2); for (const e of [-1, 1]) V(bs, BX(0.04, 2.0, 0.42), 0x8a9096, e * 1.1, 1.0, 0);
  for (let k = 0; k < 4; k++) { V(bs, BX(2.2, 0.03, 0.42), 0x9aa0a6, 0, 0.1 + k * 0.5, 0); for (let x = -1.05; x < 1.0; x += 0.065) V(bs, BX(0.055, 0.32, 0.28), [NAVY, 0x9b2c2c, 0x5a6068, 0xe8e2d0, 0x2a6f6a][(Math.abs(x * 31 + k * 7) | 0) % 5], x, 0.28 + k * 0.5, 0.02); }
  foot(I, 5.4, -5.3, 2.3, 0.5, 2.0);
  V(g, RB(1.8, 1.6, 0.04, 0.02, 1), NAVY, 0, 2.05, -5.53, 0, 0, 0, vcGloss());
  D(g, A.quad('emblem', 1.0, 1.2), C.sign, 0, 2.05, -5.505);
  framed(I, 'duty', -2.4, 1.9, -5.53, 1.4, 0.9, 0, false, 0xc9ced3);
  const dr = group(g, 2.7, FL, -5.52);
  V(dr, RB(1.1, 2.25, 0.06, 0.01, 1), 0x6b4529, 0, 1.125, 0); V(dr, RB(0.95, 2.15, 0.04, 0.01, 1), 0xdcd6c8, 0, 1.075, 0.02);
  V(dr, BX(0.14, 0.03, 0.04), 0x9aa0a6, 0.35, 1.0, 0.06, 0, 0, 0, vcGloss());
  clockOn(I, -7.53, 2.4, -3.0, PI / 2);
  // lobby: waiting seats, notice board, water, plants, door mat
  const ws = linkedSeats(I, -7.2, 0.6, 4, PI / 2, 0x2a5aa0);
  framed(I, 'notice', 7.52, FL + 1.55, 0.4, 2.2, 1.1, -PI / 2, false, 0x8a6444);
  framed(I, 'poster117', 7.52, FL + 1.6, -2.4, 0.6, 0.84, -PI / 2, false, 0xffffff);
  const pr = group(g, 7.3, FL, -0.9, -PI / 2);
  V(pr, RB(0.6, 1.1, 0.25, 0.01, 1), 0xb9bec4, 0, 0.55, 0, 0, 0, 0, vcGloss());
  for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) V(pr, BX(0.22, 0.28, 0.02), [0x3a7bff, 0xf2c14e, 0x3a9a5a, 0xe86aa0, 0xffffff, 0xd8302a][k * 2 + j], -0.14 + j * 0.28, 0.4 + k * 0.3, 0.14, -0.15, 0, 0);
  foot(I, 7.3, -0.9, 0.6, 0.3, 1.1, -PI / 2);
  V(g, RB(0.32, 1.0, 0.32, 0.02, 1), 0xeef0f2, 7.2, FL + 0.5, 1.65, 0, 0, 0, vcGloss());
  V(g, CY(0.13, 0.13, 0.38, 18), 0x8fc8e8, 7.2, FL + 1.2, 1.65, 0, 0, 0, vcGloss());
  foot(I, 7.2, 1.65, 0.35, 0.35, 1.4);
  plant(I, -7.0, 1.85, 'fig', 1.5, 3);
  plant(I, 3.1, 1.85, 'snake', 0.9, 8);
  V(g, BX(2.4, 0.012, 1.4), 0x2b2d31, 0, FL + 0.006, 1.4, 0, 0, 0, vcSoft());
  // people
  npc(I, 0, FL, -2.05, PI, 'stand', 'staff');
  npc(I, -2.7, FL, -4.45, PI, 'sit', 'staff');
  npc(I, 5.1, FL, -4.45, PI, 'sit', 'staff');
  npc(I, -5.6, FL, -4.55, 0, 'stand', 'staff');
  npc(I, ...ws[1].pos, ws[1].yaw, 'sit', 'guest');
  I.lamps.push({ pos: [0, 3.0, 0.6], color: 0xf4f8ff, intensity: 1.2, range: 9 }, { pos: [-4.5, 3.0, -3.5], color: 0xf4f8ff, intensity: 1.0, range: 8 }, { pos: [4.5, 3.0, -3.5], color: 0xf4f8ff, intensity: 1.0, range: 8 });
  I.indoor.push(aabb(-7.55, 0, -5.55, 7.55, 3.3, 3.02));
  I.interactables.push({ id: 'officer', label: '경찰관이랑 이야기하기', pos: [0, 1.35, -0.35], radius: 1.6 });
  return done(I);
}

/* ------------------------------------------------------------------ 세온 시네마 interior */
const CIN = { AX1: 5.2, AZ0: -8.55, AZ1: -1.45, HH: 6.1, SC: [-11.5, 3.35, -5.5], SW: 5.2, SH: 2.6 };
const rowX = (r) => -5.9 + r * 1.2, rowY = (r) => FL + r * 0.22, seatZ = (i) => -7.9 + i * 0.6;
function cinemaInterior(C) {
  const I = IK(C, 503), g = I.g, A = I.A, RED = 0xb3202a, GOLD = 0xd8b25a, DARK = 0x2b1a1c;
  const { AX1, AZ0, AZ1, HH, SC, SW, SH } = CIN;
  // lobby: ticket counter (left), snack bar (right), both against the auditorium wall
  for (const s of [-1, 1]) {
    const x = s * 6.3;
    counterAt(I, x, -0.15, 4.0, 0.6, 1.05, 0, DARK, GOLD);
    V(g, BX(4.0, 0.05, 0.012), GOLD, x, FL + 0.9, 0.152, 0, 0, 0, vcGloss());
    D(g, A.quad(s < 0 ? 'tkFront' : 'snFront', 3.6, 0.3), C.sign, x, FL + 0.6, 0.156);
    framed(I, s < 0 ? 'showtimes' : 'menu', x, FL + 2.55, -1.18, 3.6, 1.0, 0, true, 0x111114);
    npc(I, x - 0.6, FL, -0.85, PI, 'stand', 'staff');
  }
  for (const x of [-7.4, -5.2]) screenOn(I, x, FL + 1.05, -0.25, 0, 'tkScreen', 0.42, 0.26);
  // snack bar: popcorn warmer, drink fountain, cups
  V(g, RB(0.9, 0.06, 0.5, 0.01, 1), RED, 5.0, FL + 1.08, -0.25, 0, 0, 0, vcGloss());
  D(g, BX(0.88, 0.42, 0.48), C.glass, 5.0, FL + 1.32, -0.25);
  V(g, BX(0.9, 0.06, 0.5), RED, 5.0, FL + 1.56, -0.25, 0, 0, 0, vcGloss());
  for (let k = 0; k < 70; k++) V(g, SP(0.035, 6, 4), k % 5 ? 0xf6e7b0 : 0xf0cf6a, 5.0 + (I.R() - 0.5) * 0.78, FL + 1.13 + I.R() * 0.16, -0.25 + (I.R() - 0.5) * 0.4, 0, 0, 0, vcSoft());
  V(g, RB(0.7, 0.62, 0.45, 0.03, 2), 0x1b1b1d, 6.5, FL + 1.36, -0.3, 0, 0, 0, vcGloss());
  D(g, A.quad('soda', 0.62, 0.3), C.sign, 6.5, FL + 1.5, -0.074);
  for (let k = 0; k < 4; k++) V(g, BX(0.04, 0.08, 0.05), 0x9aa0a6, 6.26 + k * 0.16, FL + 1.18, -0.06, 0, 0, 0, vcGloss());
  for (let k = 0; k < 6; k++) for (let j = 0; j < 4; j++) V(g, lathe([[0, 0], [0.045, 0], [0.06, 0.16], [0, 0.16]], 12), k % 2 ? RED : 0x2f5fb0, 7.3 + k * 0.17, FL + 1.075 + j * 0.13, -0.25, 0, 0, 0, vcGloss());
  // kiosks, posters, hall sign, ottoman, standee, queue ropes, plants
  for (const x of [-3.5, -2.7]) {
    V(g, RB(0.55, 1.5, 0.35, 0.03, 2), 0xf4f4f2, x, FL + 0.75, -0.95, 0, 0, 0, vcGloss());
    V(g, RB(0.56, 0.14, 0.36, 0.03, 2), RED, x, FL + 1.45, -0.95, 0, 0, 0, vcGloss());
    D(g, A.quad('kiosk', 0.42, 0.6), C.sign, x, FL + 1.0, -0.774);
    foot(I, x, -0.95, 0.55, 0.35, 1.5);
  }
  for (const [i, x] of [[0, -1.3], [1, 0.1], [2, 1.5]]) framed(I, 'poster' + i, x, FL + 1.55, -1.18, 1.1, 1.6, 0, true, 0x1d1f24);
  for (const s of [-1, 1]) framed(I, 'poster' + (s < 0 ? 1 : 0), s * 11.6, FL + 1.6, 0.1, 1.2, 1.75, s < 0 ? PI / 2 : -PI / 2, true, 0x1d1f24);
  framed(I, 'hall1', -9.9, FL + 2.65, -1.18, 1.3, 0.4, 0, true, 0x111114);
  V(g, CY(0.62, 0.62, 0.42, 30), RED, 0, FL + 0.21, 0.6, 0, 0, 0, vcSoft());
  V(g, CY(0.64, 0.64, 0.05, 30), GOLD, 0, FL + 0.02, 0.6, 0, 0, 0, vcGloss());
  foot(I, 0, 0.6, 1.2, 1.2, 0.45);
  const st = group(g, 4.4, FL, 2.1, -0.3);
  V(st, BX(0.92, 1.32, 0.02), 0x1b1b1d, 0, 0.9, -0.012); D(st, A.quad('poster1', 0.9, 1.3), C.print, 0, 0.9, 0.0);
  V(st, BX(0.04, 0.5, 0.3), 0x1b1b1d, 0, 0.25, -0.15, 0.5, 0, 0);
  const posts = [[-8.2, 0.9], [-7.0, 0.9], [-5.8, 0.9], [-4.6, 0.9]];
  for (const [x, z] of posts) { V(g, CY(0.025, 0.025, 0.95, 10), GOLD, x, FL + 0.48, z, 0, 0, 0, vcGloss()); V(g, CY(0.14, 0.16, 0.04, 16), GOLD, x, FL + 0.02, z, 0, 0, 0, vcGloss()); V(g, SP(0.04, 10, 6), GOLD, x, FL + 0.97, z, 0, 0, 0, vcGloss()); }
  for (let k = 0; k < 3; k++) { const [x0, z0] = posts[k], [x1] = posts[k + 1], mx = (x0 + x1) / 2; rod(g, [x0, FL + 0.92, z0], [mx, FL + 0.78, z0], 0.018, RED, vcSoft()); rod(g, [mx, FL + 0.78, z0], [x1, FL + 0.92, z0], 0.018, RED, vcSoft()); }
  for (const x of [-11.1, 11.1]) plant(I, x, 1.0, 'palm', 1.4, x > 0 ? 4 : 5);
  // auditorium: screen, stage, curtains, wall panels, stepped rows of red seats, projection wall
  wall(I, 'z', AX1 + 0.2, -1, AZ0, AZ1, 0, HH, 0.2, paint(0x22181c, 0.85), null);
  D(g, quad(0.5, 0.3), C.cool, AX1 - 0.01, 4.5, -5.5, 0, -PI / 2, 0);
  V(g, RB(0.12, SH + 0.3, SW + 0.3, 0.02, 1), 0x0e0e10, SC[0] - 0.08, SC[1], SC[2]);
  D(g, A.quad('movie', SW, SH), C.win, SC[0], SC[1], SC[2], 0, PI / 2, 0);
  V(g, BX(1.2, 0.45, AZ1 - AZ0), 0x1b1b1d, -11.05, FL + 0.225, (AZ0 + AZ1) / 2);
  I.colliders.push(aabb(-11.65, 0, AZ0, -10.45, FL + 0.45, AZ1));
  for (const [z0, z1] of [[AZ0, SC[2] - SW / 2 - 0.15], [SC[2] + SW / 2 + 0.15, AZ1]]) for (let z = z0 + 0.08, k = 0; z < z1; z += 0.15, k++) V(g, RB(0.18, 4.6, 0.2, 0.08, 1), 0x8a1a22, -11.45 + (k % 2) * 0.07, FL + 0.45 + 2.3, z, 0, 0, 0, vcSoft());
  V(g, RB(0.3, 0.55, AZ1 - AZ0, 0.06, 1), 0x8a1a22, -11.4, 5.15, (AZ0 + AZ1) / 2, 0, 0, 0, vcSoft());
  for (let x = -9.4; x < AX1 - 0.6; x += 1.5) for (const [z, s] of [[AZ0, 1], [AZ1, -1]]) {
    V(g, RB(1.25, 2.4, 0.06, 0.03, 1), 0x24141a, x, 3.4, z + s * 0.04, 0, 0, 0, vcSoft());
    D(g, RB(0.16, 0.07, 0.05, 0.01, 1), C.lamp, x + 0.75, 2.3, z + s * 0.04);
  }
  const carpet = textured('carpet', { color: 0x3a1a22, seed: 11 }, 2, { normal: 0.8 });
  for (let r = 1; r < 9; r++) {
    const x0 = rowX(r) - 0.6, w = AX1 - x0, y1 = rowY(r);
    put(g, box(w, 0.22, AZ1 - AZ0), carpet, x0 + w / 2, y1 - 0.11, (AZ0 + AZ1) / 2);
    I.colliders.push(aabb(x0, 0, AZ0, AX1, y1, AZ1));
    D(g, BX(0.03, 0.025, 1.25), C.lamp, x0 + 0.02, y1 - 0.03, -2.15);
  }
  for (let r = 0; r < 9; r++) for (let i = 0; i < 9; i++) {
    const p = group(g, rowX(r), rowY(r), seatZ(i), -PI / 2);
    V(p, RB(0.5, 0.13, 0.46, 0.04, 1), RED, 0, 0.42, 0.04, 0, 0, 0, vcSoft());
    V(p, RB(0.52, 0.66, 0.11, 0.04, 1), RED, 0, 0.8, -0.24, -0.14, 0, 0, vcSoft());
    V(p, BX(0.5, 0.62, 0.03), 0x1b1b1d, 0, 0.78, -0.31, -0.14, 0, 0);
    V(p, BX(0.4, 0.34, 0.3), 0x1b1b1d, 0, 0.17, -0.05);
    for (const e of i ? [1] : [-1, 1]) { V(p, BX(0.07, 0.06, 0.5), 0x1b1b1d, e * 0.29, 0.62, 0); V(p, BX(0.05, 0.6, 0.06), 0x1b1b1d, e * 0.29, 0.3, -0.15); }
    V(p, CY(0.045, 0.04, 0.06, 10), 0x1b1b1d, 0.29, 0.66, 0.2);
  }
  framed(I, 'exit', -9.9, FL + 2.65, AZ1 - 0.01, 0.6, 0.22, PI, true, 0x111114);
  const beamM = cached('civicBeam', () => { const m = new THREE.MeshBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.018, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); m.name = 'civicBeam'; return m; });
  const a = new THREE.Vector3(AX1 - 0.05, 4.5, -5.5), b = new THREE.Vector3(SC[0] + 0.1, SC[1], SC[2]);
  const beam = D(g, prep(new THREE.CylinderGeometry(1.5, 0.1, a.distanceTo(b), 20, 1, true)), beamM, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  beam.quaternion.setFromUnitVectors(_up, b.clone().sub(a).normalize()); beam.receiveShadow = false;
  // moviegoers, lamps, the movie seat (middle row, middle seat)
  for (const [r, i] of [[2, 2], [2, 3], [3, 6], [5, 1], [6, 5], [6, 6], [7, 3]]) npc(I, rowX(r), rowY(r), seatZ(i), PI / 2, 'sit', 'guest');
  I.lamps.push({ pos: [-6, 3.7, 0.2], color: 0xffe2b0, intensity: 1.2, range: 9 }, { pos: [6, 3.7, 0.2], color: 0xffe2b0, intensity: 1.2, range: 9 },
    { pos: [0, 3.7, 1.8], color: 0xffe2b0, intensity: 1.0, range: 8 }, { pos: [-3, 5.6, -5], color: 0xffc89a, intensity: 0.5, range: 12 });
  I.indoor.push(aabb(-11.65, 0, -1.2, 11.65, 3.95, 2.96), aabb(-11.65, 0, AZ0, AX1, HH, AZ1));
  const eye = [rowX(4), rowY(4) + 1.17, seatZ(4)];
  I.interactables.push({ id: 'movie', label: '영화 보기', pos: [rowX(4), rowY(4) + 1.2, -3.4], radius: 1.8, seat: seatPose(eye, SC), screen: { center: [SC[0] + 0.01, SC[1], SC[2]], w: SW, h: SH, yaw: PI / 2 } });
  return done(I);
}

/* ------------------------------------------------------------------ 세온 마트 interior */
function checkoutLane(I, x, z, n) {
  const C = I.C, A = I.A, p = group(I.g, x, FL, z);
  V(p, RB(0.8, 0.88, 2.4, 0.03, 1), 0xf6f6f3, 0, 0.44, 0, 0, 0, 0, vcGloss());
  V(p, BX(0.81, 0.08, 2.41), 0x1f8a4c, 0, 0.62, 0);
  V(p, BX(0.84, 0.04, 2.44), 0xb9bec4, 0, 0.9, 0, 0, 0, 0, vcGloss());
  V(p, BX(0.5, 0.02, 1.4), 0x1b1b1d, -0.08, 0.93, -0.45, 0, 0, 0, vcSoft());
  for (let k = 0; k < 4; k++) V(p, BX(0.12 + k * 0.03, 0.08 + (k % 2) * 0.1, 0.12), GOODS[(n * 3 + k) % GOODS.length], -0.1, 0.98 + (k % 2) * 0.05, -0.9 + k * 0.25);
  V(p, BX(0.04, 0.04, 0.4), 0x2b2d31, -0.08, 0.96, 0.15);
  V(p, BX(0.36, 0.02, 0.36), 0x2b2d31, -0.05, 0.925, 0.55); D(p, BX(0.24, 0.006, 0.24), redGlow(), -0.05, 0.937, 0.55);
  V(p, BX(0.09, 0.13, 0.15), 0x2b2d31, -0.3, 0.98, 0.9);
  V(p, BX(0.8, 0.03, 0.45), 0x9aa0a6, 0, 0.9, 1.4);
  V(p, CY(0.025, 0.025, 1.45, 8), 0x9aa0a6, 0.33, 1.6, -1.1, 0, 0, 0, vcGloss());
  V(p, RB(0.36, 0.36, 0.12, 0.03, 1), 0x1f8a4c, 0.33, 2.45, -1.1, 0, 0, 0, vcGloss());
  for (const r of [0, PI]) D(p, A.quad('lane' + n, 0.28, 0.28), C.sign, 0.33, 2.45, -1.1 + (r ? -0.062 : 0.062), 0, r, 0);
  screenOn(I, x + 0.22, FL + 0.92, z + 0.75, PI / 2, 'pos', 0.3, 0.2);
  screenOn(I, x - 0.25, FL + 0.92, z + 1.0, -PI / 2, 'cust', 0.2, 0.13);
  foot(I, x, z, 0.85, 2.9, 0.95);
}
function martInterior(C) {
  const I = IK(C, 504), g = I.g, A = I.A, R = I.R;
  const xs = [-12.4, -9.6, -6.8, -4.0, -1.2, 1.6], modes = ['boxes', 'mix', 'mix', 'boxes', 'mix', 'drinks'];
  xs.forEach((x, i) => gondola(I, x, -5.3, 5.4, PI / 2, 1.75, modes[i]));
  ['snack', 'ramen', 'home', 'drink', 'bread'].forEach((k, i) => {
    const x = (xs[i] + xs[i + 1]) / 2;
    for (const s of [-1, 1]) V(g, CY(0.006, 0.006, 0.6, 6), 0x2b2d31, x + s * 0.6, 3.9, -5.3);
    V(g, RB(1.6, 0.46, 0.06, 0.02, 1), 0x1f8a4c, x, 3.38, -5.3, 0, 0, 0, vcGloss());
    for (const r of [0, PI]) D(g, A.quad('aisle_' + k, 1.5, 0.42), C.sign, x, 3.38, -5.3 + (r ? -0.032 : 0.032), 0, r, 0);
  });
  for (let k = 0; k < 6; k++) coolerRow(I, -12.65 + k * 3.05, -9.55 + 0.4, 3.0, 0, k < 2 ? 'mix' : 'drinks', k === 2 ? [0xffffff, 0xf4f4f2, 0x5ac8d8, 0xf2d03a] : undefined);
  D(g, A.quad('sign', 7.2, 0.9), C.sign, -5.0, 3.25, -9.53);
  // produce tables at the right back
  const fr = [0xd8302a, 0xf28a1e, 0xf2d03a, 0x6aa83a, 0x9b2a5a, 0x3a8a3a];
  for (const [tx, tz, s] of [[8.4, -7.7, 0], [11.8, -7.7, 3]]) {
    const p = group(g, tx, FL, tz);
    V(p, RB(2.6, 0.72, 1.6, 0.03, 1), 0x8a6a4a, 0, 0.36, 0, 0, 0, 0, vcMat());
    V(p, BX(2.62, 0.06, 1.62), 0x5a3e28, 0, 0.75, 0);
    for (let b = 0; b < 6; b++) {
      const bx = -0.85 + (b % 3) * 0.85, bz = b < 3 ? -0.4 : 0.4, col = fr[(b + s) % fr.length];
      V(p, BX(0.8, 0.12, 0.76), 0x6b4529, bx, 0.84, bz);
      for (let L = 0; L < 3; L++) for (let ix = 0; ix < 5 - L; ix++) for (let iz = 0; iz < 4 - L; iz++) V(p, SP(0.068, 6, 4), col, bx - 0.28 + (ix + L * 0.5) * 0.14, 0.97 + L * 0.11, bz - 0.21 + (iz + L * 0.5) * 0.14, 0, 0, 0, vcGloss());
      D(p, A.quad('price', 0.5, 0.06), C.print, bx, 0.8, bz + (b < 3 ? -0.385 : 0.385), 0, b < 3 ? PI : 0, 0);
    }
    foot(I, tx, tz, 2.6, 1.6, 1.0);
  }
  // bakery rack on the right wall
  const bk = group(g, 14.27, FL, -3.9, -PI / 2);
  V(bk, BX(3.0, 1.9, 0.04), 0x8a6a4a, 0, 0.95, -0.28); for (const e of [-1, 1]) V(bk, BX(0.04, 1.9, 0.6), 0x8a6a4a, e * 1.5, 0.95, 0);
  for (let k = 0; k < 4; k++) {
    V(bk, BX(3.0, 0.03, 0.58), 0xb08a5a, 0, 0.15 + k * 0.45, 0);
    for (let x = -1.35; x < 1.4; x += 0.3) V(bk, RB(0.26, 0.11, 0.15, 0.05, 1), [0xc8883a, 0xb06a2a, 0xe0b070, 0x8a5020][(k + Math.round(x * 10)) & 3], x, 0.23 + k * 0.45, 0.05 - (k % 2) * 0.1, 0, R() * 0.4, 0, vcSoft());
  }
  D(g, A.quad('aisle_bread', 1.5, 0.42), C.sign, 14.57, 2.35, -3.9, 0, -PI / 2, 0);
  foot(I, 14.27, -3.9, 3.0, 0.62, 1.9, -PI / 2);
  // checkouts
  [7.2, 9.6, 12.0].forEach((x, i) => checkoutLane(I, x, -3.8, i + 1));
  // basket stack and promo posters
  for (let k = 0; k < 6; k++) V(g, RB(0.5, 0.2, 0.34, 0.03, 1), 0xd8302a, -6.4, FL + 0.1 + k * 0.06, -1.9, 0, 0, 0, vcGloss());
  foot(I, -6.4, -1.9, 0.5, 0.34, 0.5);
  framed(I, 'sale', -14.57, 2.6, -4.0, 2.8, 0.6, PI / 2, true, 0xf28a1e);
  framed(I, 'sale', 14.57, 2.9, -7.0, 2.8, 0.6, -PI / 2, true, 0xf28a1e);
  // people
  npc(I, 7.9, FL, -3.6, PI / 2, 'stand', 'clerk');
  npc(I, 10.3, FL, -3.6, PI / 2, 'stand', 'clerk');
  npc(I, -8.2, FL, -6.0, -PI / 2, 'stand', 'customer');
  npc(I, -2.6, FL, -4.4, PI / 2, 'stand', 'customer');
  npc(I, -5.0, FL, -8.25, 0, 'stand', 'customer');
  npc(I, 8.85, FL, -4.4, PI, 'stand', 'customer');
  for (const x of [-9, 0, 9]) for (const z of [-7, -2.8]) I.lamps.push({ pos: [x, 3.95, z], color: 0xf4f8ff, intensity: 1.0, range: 10 });
  I.indoor.push(aabb(-14.6, 0, -9.55, 14.6, 4.2, 1.48));
  I.interactables.push({ id: 'martBuy', label: '장보기 (5,000원)', pos: [6.45, 1.2, -3.6], radius: 1.4 });
  return done(I);
}

/* ------------------------------------------------------------------ 세온 은행 interior */
const BF = 0.45; // bank floor (top of the front steps)
function bankInterior(C) {
  const I = IK(C, 505), g = I.g, A = I.A, NAVY = 0x2a3a52, GOLD = 0xd8b25a;
  // teller counter with glass, three windows, staff work top behind
  counterAt(I, -1.2, -2.3, 8.8, 0.7, 1.05, 0, 0x6b4529, 0xe8e2d4, BF);
  V(g, BX(8.8, 0.05, 0.012), GOLD, -1.2, BF + 0.88, -1.948, 0, 0, 0, vcGloss());
  D(g, quad(8.8, 0.75), C.glass, -1.2, BF + 1.45, -2.38);
  V(g, BX(8.8, 0.04, 0.06), GOLD, -1.2, BF + 1.84, -2.38, 0, 0, 0, vcGloss());
  for (const x of [-5.55, -2.6, -0.2, 2.2, 3.15]) V(g, BX(0.04, 0.78, 0.06), GOLD, x, BF + 1.45, -2.38, 0, 0, 0, vcGloss());
  V(g, RB(8.8, 0.04, 0.55, 0.01, 1), 0xeceae5, -1.2, BF + 0.74, -2.95, 0, 0, 0, vcGloss());
  foot(I, -1.2, -2.95, 8.8, 0.55, 0.8);
  [-3.8, -1.4, 1.0].forEach((x, i) => {
    V(g, BX(0.32, 0.03, 0.08), 0x1b1b1d, x, BF + 1.1, -2.38);
    for (const s of [-1, 1]) V(g, CY(0.006, 0.006, 0.9, 6), 0x2b2d31, x + s * 0.2, 3.75, -2.3);
    framed(I, 'tw' + (i + 1), x, 3.15, -2.3, 0.5, 0.3, 0, true, NAVY);
    screenOn(I, x + 0.3, BF + 0.76, -2.8, PI, 'pc', 0.46, 0.28);
    V(g, BX(0.3, 0.1, 0.25), 0xd9dcde, x - 0.35, BF + 0.81, -2.9, 0, 0, 0, vcGloss());
    officeChair(g, x, BF, -3.1, 0);
    chair(g, x, BF, -1.45, PI, 0x2a5aa0);
    for (let k = 0; k < 3; k++) V(g, BX(0.21, 0.004, 0.3), 0xfbf9f2, x + 0.3, BF + 1.055 + k * 0.004, -2.1, 0, k * 0.1, 0);
    npc(I, x, BF, -3.1, PI, 'sit', 'staff');
  });
  I.colliders.push(aabb(-4.2, 0, -1.7, 1.4, 0.5, -1.25));
  // low partition to the back office, the vault door
  V(g, RB(1.4, 1.05, 0.12, 0.02, 1), 0x6b4529, 3.9, BF + 0.525, -2.3, 0, 0, 0, vcGloss());
  foot(I, 3.9, -2.3, 1.4, 0.12, 1.05);
  const vx = 4.4, vz = -4.55, vy = BF + 1.25;
  V(g, RB(2.2, 2.3, 0.1, 0.03, 1), 0x8a9096, vx, vy, vz + 0.05, 0, 0, 0, vcGloss());
  put(g, CY(1.0, 1.0, 0.22, 40), mat('steel'), vx, vy, vz + 0.18, PI / 2, 0, 0);
  V(g, CY(0.85, 0.85, 0.04, 40), 0xb9bec4, vx, vy, vz + 0.3, PI / 2, 0, 0, vcGloss());
  V(g, torus(0.32, 0.03, 8, 28), GOLD, vx, vy, vz + 0.36, 0, 0, 0, vcGloss());
  for (let k = 0; k < 3; k++) rod(g, [vx, vy, vz + 0.36], [vx + Math.cos(k * PI * 2 / 3) * 0.32, vy + Math.sin(k * PI * 2 / 3) * 0.32, vz + 0.36], 0.02, GOLD, vcGloss());
  V(g, CY(0.08, 0.08, 0.1, 16), GOLD, vx, vy, vz + 0.37, PI / 2, 0, 0, vcGloss());
  for (let k = 0; k < 12; k++) V(g, CY(0.05, 0.05, 0.06, 10), 0xd9dcde, vx + Math.cos(k * PI / 6) * 0.92, vy + Math.sin(k * PI / 6) * 0.92, vz + 0.3, PI / 2, 0, 0, vcGloss());
  for (const y of [-0.5, 0.5]) V(g, RB(0.2, 0.3, 0.2, 0.02, 1), 0x6a6e74, vx - 1.0, vy + y, vz + 0.2, 0, 0, 0, vcGloss());
  foot(I, vx, vz + 0.2, 2.2, 0.5, 2.6);
  // number board, rate board, ticket machine, forms desk, brochures
  V(g, RB(3.8, 0.75, 0.08, 0.02, 1), 0x1b1b1d, -1.2, 3.15, -4.5, 0, 0, 0, vcGloss());
  D(g, A.quad('numBoard', 3.6, 0.6), C.sign, -1.2, 3.15, -4.455);
  framed(I, 'rate', -5.58, BF + 1.9, -0.6, 1.4, 1.0, PI / 2, true, NAVY);
  const tm = group(g, -5.25, BF, 0.8, PI / 2);
  V(tm, RB(0.5, 1.25, 0.4, 0.04, 2), 0xf4f4f2, 0, 0.625, 0, 0, 0, 0, vcGloss());
  V(tm, RB(0.52, 0.14, 0.42, 0.04, 2), 0x1f5fb0, 0, 1.3, 0, 0, 0, 0, vcGloss());
  D(tm, A.quad('ticketM', 0.36, 0.28), C.sign, 0, 1.0, 0.205);
  V(tm, BX(0.2, 0.02, 0.02), 0x1b1b1d, 0, 0.78, 0.205); V(tm, BX(0.06, 0.08, 0.005), 0xffffff, 0.02, 0.73, 0.215);
  foot(I, -5.25, 0.8, 0.5, 0.4, 1.4, PI / 2);
  const fd = group(g, 2.3, BF, -0.4);
  V(fd, RB(1.5, 0.95, 0.5, 0.02, 1), 0x6b4529, 0, 0.475, 0, 0, 0, 0, vcGloss());
  V(fd, RB(1.6, 0.05, 0.62, 0.01, 1), 0xe8e2d4, 0, 0.975, 0, 0, 0, 0, vcGloss());
  for (let k = 0; k < 4; k++) { V(fd, BX(0.24, 0.12, 0.08), 0xb9bec4, -0.55 + k * 0.36, 1.06, -0.24); V(fd, BX(0.2, 0.15, 0.004), [0xffffff, 0xfff3c0, 0xd8eaff, 0xffffff][k], -0.55 + k * 0.36, 1.09, -0.22); }
  for (const x of [-0.4, 0.4]) { V(fd, CY(0.006, 0.006, 0.14, 6), 0x1b1b1d, x, 1.01, 0.1, PI / 2, 0.5, 0); V(fd, BX(0.21, 0.003, 0.29), 0xfbf9f2, x + 0.1, 1.003, 0.05, 0, 0.2, 0); }
  foot(I, 2.3, -0.4, 1.6, 0.62, 1.0);
  const ws = linkedSeats(I, -3.3, -0.3, 5, PI, 0x2a5aa0, BF);
  const ws2 = linkedSeats(I, -3.3, 0.85, 5, PI, 0x2a5aa0, BF);
  V(g, BX(1.5, 0.012, 3.4), 0x8a2a2e, -0.5, BF + 0.006, 0.0, 0, 0, 0, vcSoft());
  for (const [x, z, k] of [[5.1, 1.3, 2], [-5.1, -1.7, 6]]) plant(I, x, z, 'fig', 1.6, k, BF);
  for (const x of [-3.5, 1.5]) for (const z of [-0.4, -3.4]) { V(g, CY(0.42, 0.42, 0.03, 28), GOLD, x, 4.17, z, 0, 0, 0, vcGloss()); D(g, CY(0.36, 0.36, 0.02, 28), C.lamp, x, 4.15, z); }
  // people
  npc(I, ...ws[1].pos, ws[1].yaw, 'sit', 'customer');
  npc(I, ...ws2[3].pos, ws2[3].yaw, 'sit', 'customer');
  npc(I, 1.0, BF, -1.6, 0, 'stand', 'customer');
  npc(I, 1.1, BF, 1.2, PI / 2, 'stand', 'staff');
  I.lamps.push({ pos: [-2.5, 3.9, -1.0], color: 0xffe2b8, intensity: 1.1, range: 8 }, { pos: [2.5, 3.9, -1.0], color: 0xffe2b8, intensity: 1.1, range: 8 }, { pos: [0, 3.9, -3.6], color: 0xfff1d6, intensity: 0.9, range: 7 });
  I.indoor.push(aabb(-5.6, 0, -4.55, 5.6, 4.2, 2.0));
  I.interactables.push({ id: 'bank', label: '은행 창구 (잔액 보기)', pos: [-1.4, BF + 1.3, -1.55], radius: 1.4 });
  return done(I);
}

/* ------------------------------------------------------------------ 우체국 interior */
function postInterior(C) {
  const I = IK(C, 506), g = I.g, A = I.A, R = I.R, O = 0xe4552a;
  counterAt(I, 0, -1.9, 6.0, 0.65, 1.05, 0, 0xf6efe2, 0xd8d2c4);
  V(g, BX(6.0, 0.12, 0.012), O, 0, FL + 0.82, -1.567, 0, 0, 0, vcGloss());
  for (const x of [-2.4, 0, 2.4]) D(g, A.quad('pbLabel', 0.36, 0.33), C.print, x, FL + 0.48, -1.565);
  D(g, quad(6.0, 0.6), C.glass, 0, FL + 1.38, -1.95);
  V(g, BX(6.0, 0.03, 0.04), 0xc9ced3, 0, FL + 1.69, -1.95, 0, 0, 0, vcGloss());
  for (const x of [-3.0, -0.1, 3.0]) V(g, BX(0.03, 0.62, 0.04), 0xc9ced3, x, FL + 1.38, -1.95, 0, 0, 0, vcGloss());
  V(g, RB(6.0, 0.04, 0.55, 0.01, 1), 0xeceae5, 0, FL + 0.74, -2.5, 0, 0, 0, vcGloss());
  foot(I, 0, -2.5, 6.0, 0.55, 0.8);
  [-1.6, 1.4].forEach((x, i) => {
    V(g, BX(0.32, 0.03, 0.08), 0x1b1b1d, x, FL + 1.1, -1.95);
    for (const s of [-1, 1]) V(g, CY(0.006, 0.006, 0.6, 6), 0x2b2d31, x + s * 0.2, 2.8, -1.9);
    framed(I, 'pw' + (i + 1), x, 2.35, -1.9, 0.5, 0.3, 0, true, O);
    screenOn(I, x + 0.35, FL + 0.76, -2.4, PI, 'pc', 0.46, 0.28);
    npc(I, x, FL, -2.65, PI, 'stand', 'clerk');
  });
  // parcel scale, stamps, label printer, envelopes on the counter
  V(g, RB(0.45, 0.05, 0.4, 0.01, 1), 0xb9bec4, 2.4, FL + 1.075, -1.85, 0, 0, 0, vcGloss());
  V(g, RB(0.2, 0.12, 0.05, 0.01, 1), 0x2b2d31, 2.4, FL + 1.12, -1.6); D(g, A.quad('scale', 0.16, 0.06), C.sign, 2.4, FL + 1.13, -1.574);
  V(g, RB(0.34, 0.24, 0.24, 0.01, 1), 0xc4935a, 2.4, FL + 1.22, -1.88, 0, 0, 0, vcMat());
  V(g, RB(0.26, 0.16, 0.3, 0.02, 1), 0xeef0f2, 0.5, FL + 0.84, -2.55, 0, 0, 0, vcGloss());
  for (let k = 0; k < 8; k++) V(g, BX(0.22, 0.004, 0.11), k % 2 ? 0xfbf9f2 : 0xe8d8b0, -0.6, FL + 1.055 + k * 0.004, -1.75, 0, k * 0.06, 0);
  // parcel shelving on the back wall, roll cage
  for (const sx of [-3.0, 0.0, 3.0]) {
    for (const e of [-1, 1]) for (const z of [-4.5, -4.0]) V(g, BX(0.05, 2.2, 0.05), 0x5a6068, sx + e * 1.27, FL + 1.1, z);
    for (const y of [0.1, 0.75, 1.4, 2.05]) {
      V(g, BX(2.6, 0.03, 0.56), 0x9aa0a6, sx, FL + y, -4.25);
      if (y > 2) continue;
      for (let x = sx - 1.2; x < sx + 1.1;) {
        const w = 0.25 + R() * 0.3, h = 0.18 + R() * 0.3, d = 0.3 + R() * 0.18;
        if (x + w > sx + 1.22) break;
        V(g, RB(w, h, d, 0.01, 1), [0xc4935a, 0xb88850, 0xd2a46a][(R() * 3) | 0], x + w / 2, FL + y + 0.015 + h / 2, -4.25, 0, (R() - 0.5) * 0.1, 0, vcMat());
        V(g, BX(0.05, 0.004, d + 0.004), 0xd8c8a0, x + w / 2, FL + y + 0.017 + h, -4.25);
        V(g, BX(w * 0.45, h * 0.3, 0.004), 0xffffff, x + w / 2, FL + y + 0.015 + h * 0.55, -4.25 + d / 2 + 0.003);
        x += w + 0.05;
      }
    }
  }
  I.colliders.push(aabb(-4.35, 0, -4.55, 4.35, 2.25, -3.95));
  const rc = group(g, 4.75, FL, -3.0, 0.2);
  V(rc, BX(0.8, 0.06, 0.7), 0x5a6068, 0, 0.12, 0);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { V(rc, CY(0.015, 0.015, 1.6, 6), 0x9aa0a6, sx * 0.38, 0.92, sz * 0.33); V(rc, CY(0.05, 0.05, 0.04, 10), 0x1b1b1d, sx * 0.33, 0.05, sz * 0.28, 0, 0, PI / 2); }
  for (const y of [0.6, 1.1, 1.7]) for (const sz of [-1, 1]) V(rc, BX(0.78, 0.015, 0.015), 0x9aa0a6, 0, y, sz * 0.33);
  for (let k = 0; k < 6; k++) V(rc, RB(0.32, 0.22, 0.28, 0.01, 1), [0xc4935a, 0xd2a46a, 0xb88850][k % 3], -0.18 + (k % 2) * 0.36, 0.26 + Math.floor(k / 2) * 0.24, (k % 3 - 1) * 0.05, 0, k * 0.2, 0, vcMat());
  foot(I, 4.75, -3.0, 0.9, 0.8, 1.7);
  // letter-writing desk on the left wall
  counterAt(I, -5.2, 0.1, 2.2, 0.6, 1.0, PI / 2, 0x8a6a4a, 0xe8e2d4);
  for (let k = 0; k < 3; k++) {
    const z = -0.6 + k * 0.7;
    V(g, BX(0.12, 0.2, 0.3), 0xb9bec4, -5.42, FL + 1.1, z, 0, 0, 0, vcGloss());
    for (let j = 0; j < 4; j++) V(g, BX(0.1, 0.16, 0.004), [0xffffff, 0xfff3c0, 0xe8d8b0, 0xffd8d0][j], -5.4, FL + 1.12, z - 0.12 + j * 0.08, 0, PI / 2, 0);
    V(g, CY(0.006, 0.006, 0.15, 6), 0x1b1b1d, -5.05, FL + 1.01, z + 0.2, PI / 2, 0.3, 0);
    V(g, CY(0.003, 0.003, 0.25, 4), 0x9aa0a6, -5.25, FL + 1.01, z + 0.2, 0, 0, PI / 2);
    V(g, BX(0.21, 0.003, 0.29), 0xfbf9f2, -5.0, FL + 1.003, z, 0, 0.3, 0);
  }
  D(g, A.quad('stamps', 0.3, 0.22).rotateX(-PI / 2), C.print, -5.25, FL + 1.003, 0.75);
  V(g, CY(0.04, 0.045, 0.08, 12), 0xf2c14e, -5.35, FL + 1.04, 1.0, 0, 0, 0, vcGloss());
  framed(I, 'stampPoster', -5.58, FL + 1.85, 0.1, 1.2, 0.8, PI / 2, false, 0x8a6a4a);
  framed(I, 'mailPoster', -5.58, FL + 1.55, -2.7, 0.7, 1.0, PI / 2, false, 0xffffff);
  // box shop shelf on the right wall
  const bx = group(g, 5.3, FL, -0.4, -PI / 2);
  V(bx, BX(1.8, 1.3, 0.04), 0x8a6a4a, 0, 0.65, -0.2);
  for (const e of [-1, 1]) V(bx, BX(0.04, 1.3, 0.42), 0x8a6a4a, e * 0.9, 0.65, 0);
  V(bx, BX(1.8, 0.03, 0.42), 0x8a6a4a, 0, 0.65, 0); V(bx, BX(1.8, 0.05, 0.42), 0x8a6a4a, 0, 0.03, 0);
  for (let k = 0; k < 5; k++) { const s = 0.3 + k * 0.1; V(bx, BX(s, s * 0.9, 0.05), 0xc4935a, -0.7 + k * 0.33, 0.68 + s * 0.45, -0.1 + k * 0.012, -0.08, 0, 0); V(bx, BX(s * 1.1, 0.05 + k * 0.01, s), 0xd2a46a, -0.65 + k * 0.32, 0.08 + k * 0.02, 0.0); }
  foot(I, 5.3, -0.4, 1.85, 0.45, 1.3, -PI / 2);
  framed(I, 'boxSizes', 5.58, FL + 1.9, -0.4, 1.4, 0.7, -PI / 2, false, 0xe4552a);
  const ws = linkedSeats(I, -1.6, 0.4, 4, PI, O);
  const tk = group(g, 1.6, FL, 0.6);
  V(tk, RB(0.45, 1.2, 0.35, 0.04, 2), 0xf4f4f2, 0, 0.6, 0, 0, 0, 0, vcGloss()); V(tk, RB(0.47, 0.12, 0.37, 0.04, 2), O, 0, 1.25, 0, 0, 0, 0, vcGloss());
  D(tk, A.quad('ticketP', 0.32, 0.24), C.sign, 0, 0.98, 0.18);
  foot(I, 1.6, 0.6, 0.45, 0.35, 1.3);
  clockOn(I, 0, 2.75, -4.53, 0);
  plant(I, -5.1, -3.9, 'snake', 1.0, 7);
  npc(I, -4.55, FL, 0.5, PI / 2, 'stand', 'customer');
  npc(I, ...ws[0].pos, ws[0].yaw, 'sit', 'customer');
  I.lamps.push({ pos: [0, 2.9, -0.4], color: 0xfff1d6, intensity: 1.1, range: 8 }, { pos: [0, 2.9, -3.3], color: 0xf4f8ff, intensity: 0.9, range: 7 });
  I.indoor.push(aabb(-5.6, 0, -4.55, 5.6, 3.1, 2.25));
  I.interactables.push({ id: 'mail', label: '편지 보내기', pos: [1.4, 1.3, -1.3], radius: 1.4 });
  return done(I);
}

/* ------------------------------------------------------------------ 바삭 치킨 / 피자 하우스 interior */
function shopInterior(C, kind) {
  const ck = kind === 'chicken', I = IK(C, ck ? 507 : 508), g = I.g, A = I.A, R = I.R;
  const F = 2.2, cx = ck ? 1.9 : 0.2, cz = ck ? -1.35 : -1.45, cl = ck ? 4.6 : 4.0;
  const body = ck ? 0xd8352a : 0x2f5a3a, top = ck ? 0xf4f2ee : 0xc09060, chairHex = ck ? 0xf6c84a : 0x8a3a2a, tHex = ck ? 0xf4efe4 : 0x6b4529;
  counterAt(I, cx, cz, cl, 0.65, 1.05, 0, body, top);
  D(g, A.quad(ck ? 'ckPanel' : 'pzPanel', 1.6, 0.6), C.print, cx - 0.4, FL + 0.55, cz + 0.329);
  screenOn(I, cx + cl / 2 - 0.55, FL + 1.05, cz - 0.05, PI, 'pos', 0.3, 0.2);
  V(g, RB(0.34, 0.1, 0.26, 0.02, 1), 0x2b2d31, cx + cl / 2 - 0.55, FL + 1.1, cz + 0.15, 0, 0, 0, vcGloss());
  for (const s of [-1, 1]) V(g, CY(0.006, 0.006, 0.55, 6), 0x2b2d31, cx + s * 1.3, 2.58, cz - 0.6);
  framed(I, 'menuBoard', cx, 2.15, cz - 0.6, 3.0, 0.7, 0, true, 0x2b2d31);
  if (ck) {
    // fryers under a hood, prep table, sink, fridge, sauce shelf, warmer with chicken on the counter
    for (const x of [0.3, 1.0]) {
      V(g, RB(0.65, 0.9, 0.7, 0.02, 1), 0xb9bec4, x, FL + 0.45, -3.65, 0, 0, 0, vcGloss());
      V(g, BX(0.5, 0.01, 0.42), 0xb8801e, x, FL + 0.905, -3.65, 0, 0, 0, vcGloss());
      for (const s of [-1, 1]) { V(g, BX(0.22, 0.14, 0.3), 0x8a9096, x + s * 0.13, FL + 0.98, -3.6); rod(g, [x + s * 0.13, FL + 1.0, -3.42], [x + s * 0.13, FL + 1.12, -3.25], 0.012, 0x2b2d31); }
    }
    put(g, RB(2.0, 0.45, 0.9, 0.02, 1), mat('steel'), 0.65, 2.28, -3.6);
    put(g, CY(0.18, 0.18, 0.35, 16), mat('steel'), 0.65, 2.68, -3.7);
    const pt = group(g, 2.5, FL, -3.7);
    put(pt, RB(1.4, 0.04, 0.65, 0.01, 1), mat('steel'), 0, 0.9, 0); V(pt, BX(1.35, 0.03, 0.6), 0x9aa0a6, 0, 0.25, 0);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) V(pt, BX(0.04, 0.9, 0.04), 0x9aa0a6, sx * 0.65, 0.45, sz * 0.28);
    V(pt, lathe([[0, 0], [0.16, 0], [0.2, 0.12], [0.19, 0.12], [0.15, 0.01], [0, 0.01]], 20), 0xeef0f2, -0.35, 0.92, 0, 0, 0, 0, vcGloss());
    V(pt, CY(0.17, 0.17, 0.01, 18), 0xe8c890, -0.35, 1.01, 0, 0, 0, 0, vcSoft());
    V(pt, RB(0.5, 0.04, 0.35, 0.01, 1), 0x9aa0a6, 0.3, 0.94, 0, 0, 0, 0, vcGloss());
    for (let k = 0; k < 6; k++) V(pt, SP(0.06, 8, 6), 0xf0c8a8, 0.15 + (k % 3) * 0.14, 0.98, -0.07 + Math.floor(k / 3) * 0.14, 0, 0, 0, vcSoft()).scale.set(1.3, 0.6, 1);
    V(pt, RB(0.3, 0.4, 0.2, 0.05, 1), 0xf4efe4, 0.5, 0.35 + 0.2, 0, 0, 0, 0, vcSoft());
    const sk = group(g, 3.95, FL, -3.7);
    put(sk, RB(0.9, 0.9, 0.65, 0.01, 1), mat('steel'), 0, 0.45, 0); V(sk, BX(0.6, 0.02, 0.4), 0x3a3d42, 0, 0.905, 0);
    rod(sk, [0, 0.9, -0.28], [0, 1.25, -0.28], 0.015, 0xc9ced3, vcGloss()); rod(sk, [0, 1.25, -0.28], [0, 1.2, -0.08], 0.015, 0xc9ced3, vcGloss());
    I.colliders.push(aabb(-0.05, 0, -4.05, 4.65, 1.0, -3.3));
    V(g, RB(0.75, 2.0, 0.7, 0.02, 1), 0xc9ced3, -0.6, FL + 1.0, -3.65, 0, 0, 0, vcGloss());
    V(g, BX(0.03, 0.6, 0.04), 0x5a5d62, -0.33, FL + 1.2, -3.29); V(g, BX(0.72, 0.01, 0.01), 0x8a9096, -0.6, FL + 1.35, -3.299);
    foot(I, -0.6, -3.65, 0.75, 0.7, 2.0);
    V(g, BX(1.6, 0.03, 0.3), 0x9aa0a6, 2.6, 1.9, -3.9);
    goodsRow(g, 1.85, 3.35, 1.915, -3.9, 0.22, 0.25, R, 'drinks', [0xc8282a, 0x8a3a1a, 0xf2c14e, 0xf4f4f2]);
    V(g, RB(0.9, 0.05, 0.45, 0.01, 1), 0x2b2d31, cx - 1.1, FL + 1.075, cz);
    D(g, BX(0.88, 0.32, 0.44), C.glass, cx - 1.1, FL + 1.26, cz);
    D(g, BX(0.8, 0.02, 0.04), C.lamp, cx - 1.1, FL + 1.41, cz);
    for (let k = 0; k < 14; k++) V(g, SP(0.06, 8, 6), [0xb8681e, 0xc8782a, 0xa85a18][k % 3], cx - 1.45 + (k % 7) * 0.11, FL + 1.14, cz - 0.1 + Math.floor(k / 7) * 0.18, 0, k, 0, vcSoft()).scale.set(1.3, 0.75, 1);
    for (let k = 0; k < 5; k++) V(g, RB(0.32, 0.1, 0.32, 0.01, 1), [0xd8352a, 0xf6c84a][k % 2], cx + 0.4, FL + 1.1 + k * 0.1, cz + 0.05, 0, k * 0.12, 0, vcMat());
  } else {
    // brick oven with fire at the back left, prep table with dough and toppings, flour shelf, pizza boxes
    const ox = -3.25, oz = -3.15;
    put(g, RB(1.7, 0.95, 1.3, 0.03, 2), mat('brickDark'), ox, FL + 0.48, oz);
    put(g, lathe([[0, 0], [0.8, 0], [0.78, 0.25], [0.66, 0.55], [0.42, 0.78], [0.0, 0.86]], 24), mat('brickDark'), ox, FL + 0.95, oz);
    put(g, CY(0.14, 0.14, 1.0, 14), mat('brick'), ox + 0.2, 2.35, oz - 0.25);
    put(g, RB(0.95, 0.5, 0.16, 0.03, 1), mat('brick'), ox, FL + 1.2, oz + 0.68);
    D(g, A.quad('fire', 0.62, 0.38), C.sign, ox, FL + 1.18, oz + 0.765);
    V(g, RB(1.0, 0.05, 0.3, 0.01, 1), 0x3a3b3d, ox, FL + 0.97, oz + 0.82);
    for (let k = 0; k < 9; k++) V(g, CY(0.06, 0.065, 0.42, 10), [0x8a5a3a, 0x7a4a2a, 0x9a6a42][k % 3], -4.25, FL + 0.07 + Math.floor(k / 3) * 0.12, -1.85 + (k % 3) * 0.13 + (Math.floor(k / 3) % 2) * 0.06, PI / 2, 0, 0, vcMat());
    V(g, CY(0.025, 0.025, 1.4, 8), 0xc09060, ox + 1.05, FL + 0.75, oz + 0.85, 0.3, 0, -0.35);
    V(g, CY(0.17, 0.17, 0.02, 20), 0xc09060, ox + 1.3, FL + 0.12, oz + 0.85, PI / 2 - 0.3, 0, -0.35);
    foot(I, ox, oz, 1.8, 1.45, 1.9);
    I.colliders.push(aabb(-4.65, 0, -2.0, -4.0, 0.4, -1.6));
    const pt = group(g, 0.9, FL, -3.7);
    V(pt, RB(2.6, 0.05, 0.68, 0.01, 1), 0xc09060, 0, 0.9, 0, 0, 0, 0, vcGloss());
    put(pt, RB(2.5, 0.85, 0.6, 0.01, 1), mat('steel'), 0, 0.43, 0);
    for (let k = 0; k < 6; k++) V(pt, SP(0.09, 12, 8), 0xf2e6c8, -1.1 + k * 0.14, 0.95, -0.12, 0, 0, 0, vcSoft()).scale.set(1, 0.55, 1);
    const tops = [0xc8282a, 0xf6f0d8, 0x3a8a3a, 0x8a6a4a, 0xe8a0a0, 0xf2d03a];
    for (let k = 0; k < 6; k++) { V(pt, BX(0.2, 0.08, 0.16), 0xd9dcde, 0.0 + (k % 3) * 0.24, 0.965, -0.1 + Math.floor(k / 3) * 0.2, 0, 0, 0, vcGloss()); V(pt, BX(0.17, 0.01, 0.13), tops[k], 0.0 + (k % 3) * 0.24, 1.005, -0.1 + Math.floor(k / 3) * 0.2, 0, 0, 0, vcSoft()); }
    V(pt, CY(0.27, 0.27, 0.02, 24), 0xf2e6c8, 0.95, 0.935, 0.05, 0, 0, 0, vcSoft()); V(pt, CY(0.24, 0.24, 0.006, 24), 0xc8282a, 0.95, 0.947, 0.05, 0, 0, 0, vcGloss());
    V(pt, CY(0.03, 0.03, 0.45, 10), 0xd8b890, 0.6, 0.94, 0.22, 0, 0.4, PI / 2);
    I.colliders.push(aabb(-0.45, 0, -4.05, 2.25, 1.0, -3.35));
    V(g, BX(2.4, 0.03, 0.3), 0x8a6a4a, 0.9, 1.95, -3.9);
    for (let k = 0; k < 4; k++) V(g, RB(0.32, 0.4, 0.22, 0.06, 1), k % 2 ? 0xf4efe4 : 0xe8dcc0, -0.0 + k * 0.4, 2.17, -3.9, 0, 0, 0, vcSoft());
    goodsRow(g, 1.6, 2.05, 1.965, -3.9, 0.2, 0.2, R, 'boxes', [0xc8282a, 0x3a8a3a]);
    for (let k = 0; k < 8; k++) V(g, RB(0.42, 0.05, 0.42, 0.01, 1), k % 3 ? 0xf4efe4 : 0xd2b48a, 3.7, FL + 0.03 + k * 0.052, -3.6, 0, k * 0.06, 0, vcMat());
    foot(I, 3.7, -3.6, 0.5, 0.5, 0.5);
    put(g, box(9.26, 2.68, 0.03), mat('brick'), 0, FL + 1.34, -4.03);
    for (let k = 0; k < 3; k++) {
      const px = cx - 1.0 + k * 1.0;
      V(g, CY(0.27, 0.27, 0.03, 28), 0xd89a4a, px, FL + 1.09, cz, 0, 0, 0, vcSoft());
      V(g, CY(0.24, 0.24, 0.01, 28), [0xe8b04a, 0xd8602a, 0xf0d070][k], px, FL + 1.11, cz, 0, 0, 0, vcGloss());
      for (let i = 0; i < 7; i++) V(g, CY(0.03, 0.03, 0.012, 10), k === 1 ? 0x2a6a2a : 0xb8282a, px + Math.cos(i * 0.9 + k) * 0.13, FL + 1.12, cz + Math.sin(i * 0.9 + k) * 0.13);
    }
    D(g, BX(2.9, 0.012, 0.5), C.glass, cx - 0.5, FL + 1.42, cz + 0.05);
    for (const s of [-1, 1]) V(g, BX(0.02, 0.36, 0.02), 0xc9ced3, cx - 0.5 + s * 1.45, FL + 1.24, cz + 0.28, 0, 0, 0, vcGloss());
  }
  // dining tables, pendants, wall decor, a self-service corner
  const tables = ck ? [[0.1, 0.35], [1.95, 0.35], [3.8, 0.35]] : [[-3.6, 1.25], [-1.7, 1.25], [0.2, 1.25]];
  const spots = [];
  for (const [x, z] of tables) {
    spots.push(...cafeTable(I, x, z, 0.75, 0.7, tHex, chairHex, 'ns'));
    if (!ck) D(g, A.quad('check', 0.72, 0.66).rotateX(-PI / 2), C.print, x, FL + 0.762, z);
    pendant(g, x, 2.15, z, 2.85, { r: 0.17, shade: ck ? 0xd8352a : 0x2f5a3a, gl: C.lamp });
  }
  const big = ck ? cafeTable(I, -3.4, -2.4, 0.9, 0.9, tHex, chairHex, 'nsew') : cafeTable(I, -3.7, -0.9, 0.75, 0.7, tHex, chairHex, 'ns');
  if (!ck) D(g, A.quad('check', 0.72, 0.66).rotateX(-PI / 2), C.print, -3.7, FL + 0.762, -0.9);
  if (ck) {
    framed(I, 'mascot', -4.63, 1.7, -0.6, 1.0, 1.0, PI / 2, false, 0xd8352a);
    framed(I, 'tv', 4.6, 2.05, 0.2, 1.2, 0.68, -PI / 2, true, 0x1b1b1d);
    counterAt(I, -4.35, 0.6, 0.9, 0.5, 0.9, PI / 2, 0xf4f2ee, 0xd8352a);
    V(g, RB(0.3, 0.45, 0.3, 0.02, 1), 0xeef0f2, -4.4, FL + 1.12, 0.85, 0, 0, 0, vcGloss()); V(g, CY(0.11, 0.11, 0.3, 16), 0x8fc8e8, -4.4, FL + 1.5, 0.85, 0, 0, 0, vcGloss());
    for (let k = 0; k < 4; k++) V(g, CY(0.035, 0.03, 0.09, 10), 0xffffff, -4.25, FL + 0.945 + k * 0.012, 0.35, 0, 0, 0, vcGloss());
    V(g, RB(0.18, 0.1, 0.12, 0.02, 1), 0xf4f4f2, -4.45, FL + 0.95, 0.35);
  } else {
    framed(I, 'chalk', -4.63, 1.75, 0.2, 0.75, 1.0, PI / 2, false, 0x6b4529);
    framed(I, 'pzPoster', 4.63, 1.75, -0.6, 0.7, 0.95, -PI / 2, false, 0x2f5a3a);
    const sh = group(g, 4.45, FL, 0.8, -PI / 2);
    for (const y of [1.2, 1.6]) { V(sh, BX(1.2, 0.03, 0.25), 0x8a6a4a, 0, y, 0); goodsRow(sh, -0.55, 0.55, y + 0.015, 0, 0.18, 0.25, R, 'drinks', [0x6a7a2a, 0xc8282a, 0xd8b25a]); }
  }
  // people
  npc(I, cx, FL, cz - 0.75, PI, 'stand', 'chef');
  if (ck) npc(I, 0.65, FL, -2.85, 0, 'stand', 'chef');
  npc(I, ...spots[0].pos, spots[0].yaw, 'sit', 'customer');
  npc(I, ...big[0].pos, big[0].yaw, 'sit', 'customer');
  npc(I, ...big[1].pos, big[1].yaw, 'sit', 'customer');
  I.lamps.push({ pos: [0, 2.6, -0.3], color: 0xffe2b8, intensity: 1.0, range: 7 }, { pos: [1, 2.6, -3.0], color: 0xfff1d6, intensity: 0.8, range: 6 });
  I.indoor.push(aabb(-4.65, 0, -4.05, 4.65, 2.85, F - 0.05));
  I.interactables.push(ck ? { id: 'chicken', label: '치킨 사 먹기 (8,000원)', pos: [cx - 0.4, 1.3, cz + 0.7], radius: 1.4 }
    : { id: 'pizza', label: '피자 사 먹기 (7,000원)', pos: [cx, 1.3, cz + 0.7], radius: 1.4 });
  return done(I);
}

/** Drawings used only inside (signs, screens, posters). */
function clockFace(c, w, h) {
  const r = w / 2 - 2;
  c.fillStyle = '#fbfaf6'; c.beginPath(); c.arc(w / 2, h / 2, r, 0, PI * 2); c.fill();
  c.fillStyle = '#2b2d31';
  for (let i = 0; i < 12; i++) { const a = i * PI / 6; c.save(); c.translate(w / 2 + Math.sin(a) * r * 0.82, h / 2 - Math.cos(a) * r * 0.82); c.rotate(a); c.fillRect(-2, -8, 4, i % 3 ? 10 : 16); c.restore(); }
  c.strokeStyle = '#2b2d31'; c.lineCap = 'round';
  for (const [a, l, lw] of [[2.1, 0.5, 7], [-0.9, 0.72, 4]]) { c.lineWidth = lw; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + Math.sin(a) * r * l, h / 2 - Math.cos(a) * r * l); c.stroke(); }
  c.strokeStyle = '#d8302a'; c.lineWidth = 2; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + Math.sin(4) * r * 0.78, h / 2 - Math.cos(4) * r * 0.78); c.stroke();
}
function pcScreen(c, w, h, top = '#1f4f9a') {
  grad(c, w, h, '#f4f6f8', '#dfe5ec'); c.fillStyle = top; c.fillRect(0, 0, w, h * 0.12);
  const R = rng(w + h); c.fillStyle = '#c9d2dc'; c.fillRect(8, h * 0.18, w * 0.25, h * 0.76);
  for (let i = 0; i < 9; i++) { c.fillStyle = i % 3 ? '#9aa6b4' : '#5a6a7a'; c.fillRect(w * 0.3 + 4, h * 0.2 + i * h * 0.085, (w * 0.6) * (0.4 + R() * 0.6), 5); }
}
function bigText(c, w, h, bg, fg, s, sub, subCol = '#ffffff') {
  c.fillStyle = bg; c.fillRect(0, 0, w, h);
  if (sub) { fit(c, s, w / 2, h * 0.4, h * 0.5, w * 0.92, fg); fit(c, sub, w / 2, h * 0.8, h * 0.22, w * 0.92, subCol); } else fit(c, s, w / 2, h * 0.54, h * 0.62, w * 0.92, fg);
}
function interiorAtlas(A, kind) {
  const add = (k, w, h, f) => A.add(k, w, h, f);
  add('clock', 128, 128, clockFace);
  add('pc', 256, 160, (c, w, h) => pcScreen(c, w, h));
  if (kind === 'fire') {
    add('motto', 720, 144, (c, w, h) => { bigText(c, w, h, '#c4161c', '#ffffff', '출동! 안전 제일', '세온 소방서 119 구조대', '#ffe9a0'); iconFlame(c, 60, h / 2, 40); iconFlame(c, w - 60, h / 2, 40); });
    add('wall119', 900, 200, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#c4161c'; c.fillRect(0, h * 0.12, w, h * 0.76); c.fillStyle = '#ffffff'; c.fillRect(0, h * 0.18, w, 6); c.fillRect(0, h * 0.82 - 6, w, 6); fit(c, '119', 130, h / 2 + 6, 120, 220, '#ffffff'); fit(c, '우리 마을을 지키는 소방관', w * 0.62, h / 2 + 4, 62, w * 0.6, '#ffffff'); });
    add('map', 480, 270, (c, w, h) => {
      c.fillStyle = '#0f1a24'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2a4a5a'; c.lineWidth = 2;
      for (let x = 0; x < w; x += 30) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 40, h); c.stroke(); } for (let y = 0; y < h; y += 28) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y - 20); c.stroke(); }
      c.strokeStyle = '#e8c24a'; c.lineWidth = 6; c.beginPath(); c.moveTo(20, h * 0.7); c.lineTo(w * 0.4, h * 0.55); c.lineTo(w * 0.7, h * 0.62); c.lineTo(w - 20, h * 0.3); c.stroke();
      c.fillStyle = '#ff3a30'; c.beginPath(); c.arc(w * 0.7, h * 0.62, 12, 0, PI * 2); c.fill(); c.fillStyle = '#5ad87a'; c.beginPath(); c.arc(w * 0.25, h * 0.62, 9, 0, PI * 2); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, 0, w, 34); txt(c, '상황판 · 출동 대기 중', 12, 25, 22, '#ffffff');
    });
    add('cad', 320, 200, (c, w, h) => { pcScreen(c, w, h, '#c4161c'); c.fillStyle = '#c4161c'; c.fillRect(w * 0.3, h * 0.82, w * 0.3, h * 0.12); txt(c, '출동', w * 0.45, h * 0.91, 18, '#ffffff', 'center', 'middle'); });
    add('roster', 240, 180, (c, w, h) => { c.fillStyle = '#fbfbf7'; c.fillRect(0, 0, w, h); txt(c, '근무표', w / 2, 26, 24, '#c4161c', 'center', 'middle'); c.strokeStyle = '#9aa0a6'; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(10, 50 + i * 26); c.lineTo(w - 10, 50 + i * 26); c.stroke(); txt(c, ['1팀', '2팀', '3팀', '구급', '구조'][i], 16, 70 + i * 26, 16, '#2b2d31'); } });
    add('dutySign', 240, 64, (c, w, h) => bigText(c, w, h, '#c4161c', '#ffffff', '상황실'));
    add('gauges', 200, 64, (c, w, h) => { c.fillStyle = '#111114'; c.fillRect(0, 0, w, h); for (let i = 0; i < 3; i++) { const x = 36 + i * 64; c.strokeStyle = '#e8e8e8'; c.lineWidth = 3; c.beginPath(); c.arc(x, 36, 24, PI * 0.8, PI * 2.2); c.stroke(); c.strokeStyle = '#ff5a3a'; c.beginPath(); c.moveTo(x, 36); c.lineTo(x + Math.cos(PI * (1.2 + i * 0.3)) * 20, 36 + Math.sin(PI * (1.2 + i * 0.3)) * 20); c.stroke(); } });
  } else if (kind === 'police') {
    add('minwon', 760, 88, (c, w, h) => { bigText(c, w, h, '#1f4f9a', '#ffffff', '민원실 · 무엇이든 물어보세요'); drawShield(c, 40, h / 2 - 2, 26, '#ffffff'); });
    add('duty', 280, 180, (c, w, h) => { c.fillStyle = '#fbfbf7'; c.fillRect(0, 0, w, h); txt(c, '오늘의 순찰', w / 2, 26, 24, '#1f4f9a', 'center', 'middle'); ['학교 앞 08:00', '공원 13:00', '시장 17:00', '마을 한 바퀴 21:00'].forEach((s, i) => txt(c, '· ' + s, 20, 70 + i * 28, 18, '#2b2d31')); });
    add('notice', 480, 240, (c, w, h) => {
      c.fillStyle = '#c8a070'; c.fillRect(0, 0, w, h); const R = rng(5);
      const notes = [['길을 잃었어요?', '#fff3c0'], ['자전거 안전모!', '#d8eaff'], ['횡단보도 손 들기', '#ffd8d0'], ['분실물 찾아가세요', '#ffffff'], ['학교폭력 117', '#d8f5d0'], ['어린이 보호구역', '#fff3c0']];
      notes.forEach(([s, col], i) => { const x = 20 + (i % 3) * 152, y = 20 + Math.floor(i / 3) * 110; c.save(); c.translate(x + 65, y + 45); c.rotate((R() - 0.5) * 0.12); c.fillStyle = col; c.fillRect(-65, -45, 130, 92); fit(c, s, 0, -8, 20, 120, '#2b2d31'); c.fillStyle = '#9aa6b4'; c.fillRect(-50, 18, 100, 4); c.fillRect(-50, 28, 70, 4); c.fillStyle = '#d8302a'; c.beginPath(); c.arc(0, -38, 6, 0, PI * 2); c.fill(); c.restore(); });
    });
    add('poster117', 200, 280, (c, w, h) => { grad(c, w, h, '#ffe9a0', '#ffb35a'); drawShield(c, w / 2, 80, 50, '#1f4f9a'); star(c, w / 2, 70, 22, '#ffffff'); fit(c, '도움이 필요하면', w / 2, 170, 24, w * 0.9, '#2b2d31'); fit(c, '112 · 117', w / 2, 220, 44, w * 0.9, '#c8282a'); });
  } else if (kind === 'cinema') {
    add('showtimes', 720, 200, (c, w, h) => { c.fillStyle = '#111114'; c.fillRect(0, 0, w, h); txt(c, '오늘 상영 · 1관', 20, 40, 32, '#ffe9a0'); ['햄찌 대모험', '우주 고양이', '젤리 타워 더 무비'].forEach((s, i) => { txt(c, s, 20, 92 + i * 40, 28, '#ffffff'); txt(c, ['13:00  16:10', '15:20  18:30', '17:40  20:50'][i], w - 20, 92 + i * 40, 28, '#f2c84a', 'right'); }); });
    add('menu', 720, 200, (c, w, h) => { c.fillStyle = '#111114'; c.fillRect(0, 0, w, h); for (let i = 0; i < 3; i++) { const x = 20 + i * 235; rr(c, x, 20, 215, 160, 8, '#2a0f12', '#d8b25a', 3); txt(c, ['팝콘', '음료', '나초'][i], x + 107, 70, 40, '#ffe9a0', 'center', 'middle'); txt(c, ['5,000원', '2,500원', '4,500원'][i], x + 107, 130, 32, '#ffffff', 'center', 'middle'); } });
    add('tkFront', 720, 60, (c, w, h) => bigText(c, w, h, '#2b1a1c', '#f2c84a', '매표소 · TICKET'));
    add('snFront', 720, 60, (c, w, h) => bigText(c, w, h, '#2b1a1c', '#f2c84a', '팝콘 · 음료 · SNACK'));
    add('tkScreen', 200, 124, (c, w, h) => { grad(c, w, h, '#2a2a4a', '#111114'); txt(c, '1관 17:40', w / 2, 40, 26, '#ffe9a0', 'center', 'middle'); rr(c, 30, 70, 140, 34, 6, '#b8232c'); txt(c, '표 사기', w / 2, 88, 20, '#ffffff', 'center', 'middle'); });
    add('kiosk', 150, 214, (c, w, h) => { grad(c, w, h, '#3a1a4a', '#111114'); txt(c, '무인 발권', w / 2, 30, 22, '#ffffff', 'center', 'middle'); for (let i = 0; i < 3; i++) rr(c, 15, 60 + i * 48, 120, 38, 6, ['#b8232c', '#2f5fb0', '#3a9a5a'][i]); });
    add('hall1', 260, 80, (c, w, h) => bigText(c, w, h, '#111114', '#ffe9a0', '1관 →'));
    add('exit', 180, 66, (c, w, h) => bigText(c, w, h, '#1a8a4a', '#ffffff', '비상구 EXIT'));
    add('soda', 200, 96, (c, w, h) => { grad(c, w, h, '#2f5fb0', '#1a2a5a'); fit(c, '시원한 음료', w / 2, h / 2, 34, w * 0.9, '#ffffff'); });
    add('movie', 640, 320, (c, w, h) => {
      grad(c, w, h, '#5ab8f0', '#f0d8a0'); c.fillStyle = '#ffe9a0'; c.beginPath(); c.arc(w * 0.78, h * 0.25, 40, 0, PI * 2); c.fill();
      c.fillStyle = '#6aa83a'; c.beginPath(); c.moveTo(0, h * 0.72); c.quadraticCurveTo(w * 0.3, h * 0.55, w * 0.6, h * 0.7); c.quadraticCurveTo(w * 0.85, h * 0.8, w, h * 0.66); c.lineTo(w, h); c.lineTo(0, h); c.fill();
      const x = w * 0.42, y = h * 0.62, r = 50; c.fillStyle = '#e8a060'; c.beginPath(); c.ellipse(x, y, r, r * 0.85, 0, 0, PI * 2); c.fill();
      c.fillStyle = '#fff3e0'; c.beginPath(); c.ellipse(x, y + r * 0.25, r * 0.6, r * 0.5, 0, 0, PI * 2); c.fill();
      for (const s of [-1, 1]) { c.fillStyle = '#e8a060'; c.beginPath(); c.arc(x + s * r * 0.65, y - r * 0.7, r * 0.25, 0, PI * 2); c.fill(); c.fillStyle = '#1b1210'; c.beginPath(); c.arc(x + s * r * 0.3, y - r * 0.15, r * 0.1, 0, PI * 2); c.fill(); }
      fit(c, '햄찌 대모험', w / 2, 40, 40, w * 0.6, '#ffffff');
    });
  } else if (kind === 'mart') {
    add('price', 512, 24, (c, w, h) => { c.fillStyle = '#f6f6f2'; c.fillRect(0, 0, w, h); for (let x = 4; x < w; x += 64) { c.fillStyle = (x / 64) % 3 < 1 ? '#f2d03a' : '#ffffff'; c.fillRect(x, 2, 56, h - 4); txt(c, ((x * 37) % 9 + 1) * 1000 + '원', x + 28, h / 2 + 1, 13, '#c8282a', 'center', 'middle'); } });
    add('cool', 400, 40, (c, w, h) => bigText(c, w, h, '#1f5fb0', '#ffffff', '시원한 음료 · 우유 · 주스'));
    for (const [k, s] of [['home', '생활용품'], ['milk', '우유 · 냉장'], ['bread', '빵 · 베이커리']]) add('aisle_' + k, 240, 68, (c, w, h) => { c.fillStyle = '#1f8a4c'; c.fillRect(0, 0, w, h); c.fillStyle = '#f28a1e'; c.fillRect(0, h - 8, w, 8); fit(c, s, w / 2, h / 2 - 2, 42, w * 0.9, '#ffffff'); });
    for (let n = 1; n <= 3; n++) add('lane' + n, 80, 80, (c, w, h) => { c.fillStyle = '#1f8a4c'; c.fillRect(0, 0, w, h); txt(c, String(n), w / 2, h / 2 + 3, 60, '#ffffff', 'center', 'middle'); });
    add('pos', 200, 130, (c, w, h) => { pcScreen(c, w, h, '#1f8a4c'); txt(c, '합계 5,000원', w * 0.62, h * 0.88, 18, '#c8282a', 'center', 'middle'); });
    add('cust', 120, 78, (c, w, h) => { grad(c, w, h, '#1f8a4c', '#0f4a2a'); txt(c, '5,000원', w / 2, h / 2, 26, '#ffffff', 'center', 'middle'); });
  } else if (kind === 'bank') {
    for (let n = 1; n <= 3; n++) add('tw' + n, 160, 96, (c, w, h) => { c.fillStyle = '#2a3a52'; c.fillRect(0, 0, w, h); txt(c, n + '번 창구', w / 2, h / 2 + 2, 34, '#ffffff', 'center', 'middle'); });
    add('numBoard', 720, 120, (c, w, h) => { c.fillStyle = '#0a0a0c'; c.fillRect(0, 0, w, h); for (let i = 0; i < 3; i++) { const x = 20 + i * 235; txt(c, (i + 1) + '번', x + 40, h / 2, 30, '#ffd84a', 'center', 'middle'); txt(c, ['0 2 6', '0 2 7', '0 2 5'][i], x + 140, h / 2 + 2, 60, '#ff5a4a', 'center', 'middle'); } });
    add('rate', 300, 210, (c, w, h) => { c.fillStyle = '#0f1a2a'; c.fillRect(0, 0, w, h); txt(c, '오늘의 이자', w / 2, 30, 26, '#ffd84a', 'center', 'middle'); [['어린이 저금', '3.0%'], ['정기 예금', '2.5%'], ['자유 저금', '1.5%']].forEach(([a, b], i) => { txt(c, a, 20, 86 + i * 44, 22, '#ffffff'); txt(c, b, w - 20, 86 + i * 44, 24, '#5ad87a', 'right'); }); });
    add('ticketM', 150, 116, (c, w, h) => { grad(c, w, h, '#3a8ad8', '#1a4a8a'); txt(c, '번호표', w / 2, 30, 24, '#ffffff', 'center', 'middle'); rr(c, 20, 56, 110, 40, 6, '#ffd84a'); txt(c, '누르세요', w / 2, 76, 20, '#1a2a4a', 'center', 'middle'); });
  } else if (kind === 'post') {
    for (let n = 1; n <= 2; n++) add('pw' + n, 160, 96, (c, w, h) => { c.fillStyle = '#e4552a'; c.fillRect(0, 0, w, h); txt(c, n === 1 ? '우편 · 편지' : '택배 · 소포', w / 2, h / 2 + 2, 28, '#ffffff', 'center', 'middle'); });
    add('stampPoster', 300, 200, (c, w, h) => { c.fillStyle = '#fbf6ee'; c.fillRect(0, 0, w, h); txt(c, '새 우표가 나왔어요', w / 2, 28, 24, '#e4552a', 'center', 'middle'); for (let i = 0; i < 3; i++) { const x = 25 + i * 88; c.fillStyle = '#ffffff'; c.fillRect(x, 60, 76, 100); c.fillStyle = ['#5ab8f0', '#f6a0b0', '#7ad87a'][i]; c.fillRect(x + 6, 66, 64, 88); if (i === 0) chick(c, x + 38, 110, 20); else if (i === 1) envelopeWings(c, x + 38, 110, 26, '#ffffff'); else star(c, x + 38, 110, 26, '#ffd84a'); } });
    add('boxSizes', 300, 150, (c, w, h) => { c.fillStyle = '#fbf6ee'; c.fillRect(0, 0, w, h); txt(c, '상자 팔아요', w / 2, 24, 22, '#e4552a', 'center', 'middle'); for (let i = 0; i < 5; i++) { const s = 18 + i * 8, x = 18 + i * 56; c.fillStyle = '#c4935a'; c.fillRect(x, 120 - s, s + 10, s); txt(c, (i + 1) + '호', x + 18, 138, 16, '#2b2d31', 'center', 'middle'); } });
    add('mailPoster', 200, 280, (c, w, h) => { grad(c, w, h, '#ffd8c8', '#e4552a'); envelopeWings(c, w / 2, 90, 60); fit(c, '마음을 담아', w / 2, 180, 30, w * 0.9, '#ffffff'); fit(c, '편지를 보내요', w / 2, 220, 30, w * 0.9, '#ffffff'); });
    add('stamps', 200, 150, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { c.fillStyle = ['#5ab8f0', '#f6a0b0', '#7ad87a', '#ffd84a'][(i + j) % 4]; c.fillRect(8 + i * 48, 8 + j * 46, 40, 38); } });
    add('scale', 100, 40, (c, w, h) => { c.fillStyle = '#0a1a0a'; c.fillRect(0, 0, w, h); txt(c, '1.25kg', w / 2, h / 2 + 2, 26, '#7aff7a', 'center', 'middle'); });
    add('ticketP', 128, 96, (c, w, h) => { grad(c, w, h, '#ff8a5a', '#c43a1a'); txt(c, '번호표', w / 2, 30, 22, '#ffffff', 'center', 'middle'); rr(c, 18, 52, 92, 32, 6, '#ffffff'); txt(c, '누르세요', w / 2, 68, 16, '#c43a1a', 'center', 'middle'); });
  } else if (kind === 'gallery') {
    add('title', 760, 152, (c, w, h) => { c.clearRect(0, 0, w, h); fit(c, '나의 사진전', w / 2, h * 0.38, 84, w * 0.9, '#2b2d31'); fit(c, '내가 찍은 사진이 작품이 되는 곳', w / 2, h * 0.82, 34, w * 0.9, '#8a6a42'); });
    for (let i = 0; i < 10; i++) add('label' + i, 220, 70, (c, w, h) => { c.fillStyle = '#f6f5f1'; c.fillRect(0, 0, w, h); txt(c, 'No.' + (i + 1), 12, 30, 24, '#2b2d31'); txt(c, '나의 사진', 12, 58, 20, '#6a6a6a'); });
    add('deskFront', 540, 108, (c, w, h) => { c.clearRect(0, 0, w, h); fit(c, '안내 · INFORMATION', w / 2, h / 2, 52, w * 0.95, '#8a6a42'); });
    add('galLogo', 480, 120, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); fit(c, '세온 갤러리', w / 2, h * 0.45, 62, w * 0.9, '#2b2d31'); fit(c, 'SEON GALLERY', w / 2, h * 0.82, 24, w * 0.9, '#8a6a42'); });
    add('galPc', 200, 124, (c, w, h) => pcScreen(c, w, h, '#8a6a42'));
  } else {
    const ck = kind === 'chicken';
    add('pos', 200, 130, (c, w, h) => pcScreen(c, w, h, ck ? '#d8352a' : '#2f5a3a'));
    add('menuBoard', 800, 186, (c, w, h) => {
      c.fillStyle = '#1f1f22'; c.fillRect(0, 0, w, h);
      const items = ck ? [['후라이드', '8,000'], ['양념', '8,500'], ['간장', '8,500'], ['반반', '9,000']] : [['페퍼로니', '7,000'], ['불고기', '7,500'], ['고구마', '7,500'], ['치즈', '7,000']];
      items.forEach(([a, b], i) => { const x = 20 + i * 195; rr(c, x, 18, 180, 150, 8, ck ? '#d8352a' : '#2f5a3a'); if (ck) chick(c, x + 90, 70, 34); else pizzaSlice(c, x + 90, 70, 36); txt(c, a, x + 90, 128, 24, '#ffffff', 'center', 'middle'); txt(c, b + '원', x + 90, 155, 20, '#ffd84a', 'center', 'middle'); });
    });
    if (ck) {
      add('ckPanel', 480, 180, (c, w, h) => { c.fillStyle = '#f6c84a'; c.fillRect(0, 0, w, h); chick(c, 90, h / 2 + 6, 62); fit(c, '바삭바삭!', w * 0.64, h * 0.42, 70, w * 0.6, '#d8352a'); fit(c, '갓 튀긴 치킨', w * 0.64, h * 0.78, 34, w * 0.6, '#5a2a1a'); });
      add('tv', 320, 180, (c, w, h) => { grad(c, w, h, '#3a8a3a', '#2a6a2a'); c.fillStyle = '#c8a070'; c.beginPath(); c.moveTo(w / 2, h * 0.35); c.lineTo(w * 0.75, h * 0.6); c.lineTo(w / 2, h * 0.85); c.lineTo(w * 0.25, h * 0.6); c.fill(); c.fillStyle = '#ffffff'; for (const [x, y] of [[0.5, 0.36], [0.74, 0.6], [0.5, 0.84], [0.26, 0.6]]) c.fillRect(w * x - 5, h * y - 5, 10, 10); c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, 0, w, 30); txt(c, '세온 곰  3 : 2  바삭 독수리', w / 2, 16, 18, '#ffffff', 'center', 'middle'); });
    } else {
      add('pzPanel', 480, 180, (c, w, h) => { c.fillStyle = '#f4efe4'; c.fillRect(0, 0, w, h); c.fillStyle = '#b8282a'; c.fillRect(0, h - 16, w, 16); pizzaSlice(c, 90, h / 2, 64); fit(c, '화덕에서 구워요', w * 0.64, h * 0.42, 50, w * 0.6, '#b8282a'); fit(c, 'PIZZA HOUSE', w * 0.64, h * 0.74, 36, w * 0.6, '#2f7d46'); });
      add('check', 128, 128, (c, w, h) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { c.fillStyle = (i + j) % 2 ? '#f4efe4' : '#c8282a'; c.fillRect(i * 16, j * 16, 16, 16); } });
      add('chalk', 240, 320, (c, w, h) => { c.fillStyle = '#2a2e2a'; c.fillRect(0, 0, w, h); txt(c, '오늘의 추천', w / 2, 40, 28, '#ffffff', 'center', 'middle'); ['고구마 피자', '감자 피자', '치즈 듬뿍'].forEach((s, i) => txt(c, '· ' + s, 24, 110 + i * 50, 24, ['#ffd84a', '#ffffff', '#ffb0a0'][i])); pizzaSlice(c, w / 2, 280, 28); });
      add('pzPoster', 220, 300, (c, w, h) => { grad(c, w, h, '#f6d36a', '#e8a64a'); pizzaSlice(c, w / 2, 120, 80); fit(c, '피자 하우스', w / 2, 240, 34, w * 0.9, '#b8282a'); fit(c, '반죽부터 직접!', w / 2, 278, 22, w * 0.9, '#2f7d46'); });
    }
  }
}

/* ================================================================== 세온 갤러리 (art gallery) */
const GAL = { F: 3.6, BZ: -7.8, X0: -9.8, X1: 9.8, HH: 5.0, H: 7.0, CEIL: 4.6 };
/** Original abstract painting number i on a w x h canvas (used until the game puts a photo in). */
function painting(c, w, h, i) {
  const R = rng(900 + i * 37);
  const pal = [['#f4efe4', '#e8553a', '#2f5fb0', '#f2c84a', '#1b1b1d'], ['#1a2a3a', '#5ab8f0', '#f0d8a0', '#e86aa0', '#ffffff'], ['#efe6d2', '#3a8a5a', '#c8502a', '#2b2d31', '#f2c84a'],
    ['#f6e7d0', '#d8302a', '#f28a1e', '#8a4ab0', '#2f6fc0'], ['#203040', '#f2c84a', '#e8e0d0', '#5a9a8a', '#c8282a']][i % 5];
  c.fillStyle = pal[0]; c.fillRect(0, 0, w, h);
  const kind = i % 4;
  if (kind === 0) { // colour fields
    for (let k = 0; k < 4; k++) { c.fillStyle = pal[1 + k]; c.globalAlpha = 0.85; c.fillRect(w * (0.08 + R() * 0.5), h * (0.08 + R() * 0.5), w * (0.2 + R() * 0.35), h * (0.15 + R() * 0.4)); }
  } else if (kind === 1) { // circles and orbits
    for (let k = 0; k < 7; k++) { c.fillStyle = pal[1 + (k % 4)]; c.globalAlpha = 0.75; c.beginPath(); c.arc(w * R(), h * R(), h * (0.06 + R() * 0.28), 0, PI * 2); c.fill(); }
    c.globalAlpha = 1; c.strokeStyle = pal[4]; c.lineWidth = 4; c.beginPath(); c.ellipse(w / 2, h / 2, w * 0.36, h * 0.2, -0.3, 0, PI * 2); c.stroke();
  } else if (kind === 2) { // waves
    for (let k = 0; k < 9; k++) { c.strokeStyle = pal[1 + (k % 4)]; c.lineWidth = 6 + R() * 18; c.globalAlpha = 0.85; c.beginPath(); for (let x = 0; x <= w; x += 8) c.lineTo(x, h * (0.1 + k * 0.1) + Math.sin(x * 0.02 + k) * h * 0.06); c.stroke(); }
  } else { // landscape of shapes
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, pal[2]); g.addColorStop(1, pal[0]); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = pal[3]; c.beginPath(); c.arc(w * (0.2 + R() * 0.6), h * 0.3, h * 0.12, 0, PI * 2); c.fill();
    for (let k = 0; k < 3; k++) { c.fillStyle = pal[[1, 4, 2][k]]; c.globalAlpha = 0.9; c.beginPath(); c.moveTo(0, h); c.lineTo(0, h * (0.6 + k * 0.1)); for (let x = 0; x <= w; x += w / 6) c.lineTo(x, h * (0.55 + k * 0.12 + R() * 0.1)); c.lineTo(w, h); c.fill(); }
  }
  c.globalAlpha = 1;
  for (let k = 0; k < 900; k++) { c.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '0,0,0'},0.05)`; c.fillRect(R() * w, R() * h, 2 + R() * 3, 1 + R() * 2); }
}
/** Original abstract sculptures: 0 = gilded knot, 1 = stacked pebbles. */
function sculpture(I, x, z, kind) {
  const g = I.g;
  put(g, RB(0.7, 0.95, 0.7, 0.01, 1), paint(0xf6f5f1, 0.6), x, FL + 0.475, z);
  V(g, RB(0.26, 0.08, 0.005, 0.004, 1), 0x2b2d31, x, FL + 0.75, z + 0.353);
  if (kind === 0) {
    put(g, prep(new THREE.TorusKnotGeometry(0.3, 0.08, 160, 18, 2, 3)), mat('gold'), x, FL + 1.38, z, 0.3, 0.5, 0);
    V(g, CY(0.03, 0.03, 0.12, 10), 0x2b2d31, x, FL + 1.0, z);
  } else {
    const cols = [0x3a8a7a, 0xe8b04a, 0xd8553a, 0xf4efe4];
    let y = FL + 0.95;
    for (let k = 0; k < 4; k++) {
      const r = 0.24 - k * 0.04, sy = 0.55;
      const geo = displace(new THREE.IcosahedronGeometry(r, 3), (px, py, pz) => Math.sin(px * 9 + k) * 0.012 + Math.cos(pz * 7) * 0.01);
      const m = V(g, geo, cols[k], x + (k % 2 ? 0.04 : -0.03), y + r * sy, z, 0, k * 0.7, 0, vcGloss());
      m.scale.set(1, sy, 1);
      y += r * sy * 2 - 0.01;
    }
  }
  foot(I, x, z, 0.75, 0.75, 1.9);
}
function galleryBench(I, x, z, ry) {
  const p = group(I.g, x, FL, z, ry);
  put(p, RB(2.2, 0.08, 0.5, 0.02, 1), mat('walnut'), 0, 0.44, 0);
  for (const e of [-1, 1]) { put(p, RB(0.06, 0.42, 0.44, 0.01, 1), mat('darkSteel'), e * 0.9, 0.2, 0); }
  foot(I, x, z, 2.2, 0.5, 0.48, ry);
}
function buildGallery(C) {
  const { g, site, A } = C;
  const { F, BZ, X0, X1, HH, H, CEIL } = GAL;
  const white = textured('smooth', { color: 0xf4f2ec, rough: 0.6 }, 2, { normal: 0.2 }), lin = paint(0xfbfaf6, 0.7);
  const wood = textured('siding', { color: 0x9a6a42, count: 10 }, 1.6, { normal: 0.8 }), trim = paint(0x2b2d31, 0.4, 0.3);
  put(g, RB(20, 0.06, 8 - F + 0.3, 0.02, 1), mat('pavers2'), 0, 0.03, (F - 0.3 + 8) / 2);
  // hollow exhibition storey, solid top, wood-clad box at the top right
  put(g, box(X1 - X0, H - HH, F - BZ), white, 0, HH + (H - HH) / 2, (F + BZ) / 2);
  wall(C, 'x', BZ, 1, X0, X1, 0, HH, 0.25, white, lin);
  for (const s of [-1, 1]) wall(C, 'z', s * X1, -s, BZ + 0.25, F - 0.25, 0, HH, 0.25, white, lin);
  wall(C, 'x', F, -1, X0, X1, 0, HH, 0.25, white, lin, [[-3.6, 3.6, 0, 3.7]]);
  slab(C, X0 + 0.25, X1 - 0.25, BZ + 0.25, F + 0.02, textured('planks', { color: 0xc8a070, seed: 6 }, 2.4, { normal: 0.5 }));
  ceilingWithLights(C, X0 + 0.25, X1 - 0.25, BZ + 0.25, F - 0.25, CEIL, paint(0xfbfaf6, 0.75), C.cool, 0, 0);
  put(g, box(X1 - X0 - 0.5, HH - CEIL - 0.1, F - BZ - 0.5), white, 0, (CEIL + 0.06 + HH) / 2, (F + BZ) / 2).castShadow = false;
  put(g, box(7.8, H + 0.6 - 4.4, 1.0), wood, 5.6, (H + 0.6 + 4.4) / 2, F - 0.3);
  put(g, RB(7.9, 0.12, 1.1, 0.02, 1), trim, 5.6, 4.38, F - 0.3);
  roofEdge(C, X0, X1, BZ, F, H, 0.5, white, paint(0xe8e6e0, 0.5));
  // glass front with an automatic door, canopy, sign letters, banner
  for (const [a, b] of [[-3.5, -1.05], [1.05, 3.5]]) { glazing(C, a, b, FL, 3.6, F - 0.06, { pane: 1.25, frame: 0x2b2d31, transom: 2.55 }); site.colliders.push(aabb(a, 0, F - 0.15, b, 3.7, F)); }
  glazing(C, -1.05, 1.05, 2.65, 3.6, F - 0.06, { pane: 2.1, frame: 0x2b2d31 });
  slideDoor(C, 0, F - 0.06, 2.0, 2.4, FL, 0x2b2d31, 0xd8b25a);
  put(g, RB(8.4, 0.18, 2.4, 0.03, 2), trim, 0, 3.85, F + 1.1);
  for (let x = -3.5; x <= 3.6; x += 1.75) D(g, CY(0.1, 0.1, 0.02, 14), C.lamp, x, 3.75, F + 1.2);
  site.lamps.push({ pos: [0, 3.4, F + 1.4], color: 0xfff1d6, intensity: 1.2, range: 8 });
  D(g, A.quad('letters', 7.0, 1.0), C.print, -4.4, 5.6, F + 0.02);
  D(g, A.quad('en', 4.2, 0.36), C.print, -4.4, 4.85, F + 0.02);
  for (const s of [-1, 1]) V(g, CY(0.015, 0.015, 4.0, 8), 0x9aa0a6, -8.0 + s * 0.75, 3.0, F + 0.25, 0, 0, 0, vcGloss());
  D(g, A.quad('banner', 1.5, 3.6), C.print, -8.0, 3.1, F + 0.26);
  D(g, A.quad('banner', 1.5, 3.6), C.print, -8.0, 3.1, F + 0.255, 0, PI, 0);
  // plaza: steps, planters with grasses, an outdoor sculpture, benches
  put(g, RB(8.0, 0.09, 0.6, 0.01, 1), mat('concrete'), 0, 0.045, F + 0.3);
  for (const x of [-6.2, 6.2]) {
    put(g, RB(2.6, 0.5, 1.0, 0.03, 2), mat('concrete'), x, 0.25, 6.3);
    pottedPlant(g, x - 0.6, 0.45, 6.3, { kind: 'snake', h: 0.7, seed: 30 + x, pot: 0x3a2a1e, potR: 0.3, potH: 0.08 });
    pottedPlant(g, x + 0.6, 0.45, 6.3, { kind: 'bush', h: 0.7, seed: 40 + x, pot: 0x3a2a1e, potR: 0.3, potH: 0.08 });
    solid(site, x, 0.25, 6.3, 2.6, 0.5, 1.0);
  }
  const og = group(g, 0, 0.06, 6.4);
  put(og, RB(1.2, 0.5, 1.2, 0.02, 1), mat('concrete'), 0, 0.25, 0);
  for (let k = 0; k < 3; k++) put(og, torus(0.55 - k * 0.12, 0.06, 10, 40), paint([0xd8553a, 0xe8b04a, 0x3a8a7a][k], 0.35, 0.2, { clearcoat: 1 }), 0, 1.15 + k * 0.08, 0, PI / 2 - 0.3 + k * 0.35, k * 0.9, 0);
  solid(site, 0, 0.8, 6.4, 1.2, 1.6, 1.2);
  site.lamps.push({ pos: [0, 2.0, 7.2], color: 0xffe2b8, intensity: 0.6, range: 5 });
  acUnit(C, -6, H, -5.5); acUnit(C, -4.4, H, -5.5);
  site.colliders.push(aabb(X0, HH, BZ, X1, H + 0.6, F));
  site.extra.height = H + 0.6;
}
function galleryInterior(C) {
  const I = IK(C, 509), g = I.g, A = I.A, { CEIL } = GAL;
  // free-standing wall between the front and back halls
  const pw = paint(0xfbfaf6, 0.7);
  put(g, RB(8.0, 3.4, 0.3, 0.02, 1), pw, 0, FL + 1.7, -2.15);
  foot(I, 0, -2.15, 8.0, 0.3, 3.4);
  D(g, A.quad('title', 5.0, 1.0), C.print, 0, FL + 1.9, -2.305, 0, PI, 0);
  // ten frames at eye height: picture planes stay separate (the game swaps their maps), label plate under each
  const spots = [[-9.55, 0.8, PI / 2], [-9.55, -4.6, PI / 2], [-6.5, -7.55, 0], [-2.2, -7.55, 0], [2.2, -7.55, 0], [6.5, -7.55, 0], [9.55, -4.6, -PI / 2], [9.55, -1.2, -PI / 2], [-2.0, -2.0, 0], [2.0, -2.0, 0]];
  const W = 1.0, Hh = 0.7, cy = FL + 1.5;
  I.frames = [];
  spots.forEach(([x, z, ry], i) => {
    const p = group(g, x, cy, z, ry);
    V(p, RB(W + 0.14, Hh + 0.14, 0.05, 0.01, 1), i % 2 ? 0x1b1b1d : 0x6b4529, 0, 0, 0.025, 0, 0, 0, vcGloss());
    V(p, BX(W + 0.02, Hh + 0.02, 0.004), 0xf6f5f1, 0, 0, 0.051);
    const tex = canvasTex(512, 358, (c, w, h) => painting(c, w, h, i));
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0 }); m.name = 'galleryPicture' + i;
    const pic = new THREE.Mesh(quad(W, Hh), m);
    pic.position.set(0, 0, 0.056); pic.userData.dynamic = true; pic.receiveShadow = true; pic.name = 'galleryPicture' + i;
    p.add(pic);
    I.frames.push({ mesh: pic, w: W, h: Hh });
    V(p, RB(0.24, 0.08, 0.012, 0.003, 1), 0xd8b25a, 0, -Hh / 2 - 0.2, 0.006, 0, 0, 0, vcGloss());
    D(p, A.quad('label' + i, 0.22, 0.07), C.print, 0, -Hh / 2 - 0.2, 0.0125);
    // a track spot aimed at the frame
    const c = Math.cos(ry), s = Math.sin(ry), sx = x + s * 1.3, sz = z + c * 1.3;
    V(g, BX(0.06, 0.04, 0.06), 0x1b1b1d, sx, CEIL - 0.03, sz);
    const head = group(g, sx, CEIL - 0.12, sz, ry);
    V(head, CY(0.05, 0.06, 0.18, 12), 0x1b1b1d, 0, 0, 0, 0.7, 0, 0, vcGloss());
    D(head, CY(0.045, 0.045, 0.01, 12), C.lamp, 0, -0.065, -0.06, 0.7, 0, 0);
  });
  for (const z of [1.5, -1.0, -5.2]) V(g, BX(17.0, 0.035, 0.05), 0x1b1b1d, 0, CEIL - 0.02, z);
  for (const [z, n] of [[1.5, 6], [-5.2, 6]]) for (let k = 0; k < n; k++) { const x = -7 + k * 2.8; const head = group(g, x, CEIL - 0.12, z, k % 2 ? PI : 0); V(head, CY(0.05, 0.06, 0.18, 12), 0x1b1b1d, 0, 0, 0, 0.5, 0, 0, vcGloss()); D(head, CY(0.045, 0.045, 0.01, 12), C.lamp, 0, -0.07, -0.045, 0.5, 0, 0); }
  // reception desk with the logo wall, brochures, a tablet, flowers
  counterAt(I, 4.3, 1.6, 2.6, 0.7, 1.05, 0, 0xf4f4f2, 0x6b4529);
  D(g, A.quad('deskFront', 1.8, 0.36), C.print, 4.3, FL + 0.62, 1.956);
  framed(I, 'galLogo', 9.53, 2.7, 1.4, 2.4, 0.6, -PI / 2, true, 0xf4f4f2);
  for (let k = 0; k < 6; k++) V(g, BX(0.15, 0.004, 0.21), k % 2 ? 0xffffff : 0xe8b04a, 3.5, FL + 1.055 + k * 0.004, 1.75, 0, k * 0.05, 0);
  screenOn(I, 4.6, FL + 1.05, 1.5, PI, 'galPc', 0.36, 0.22);
  V(g, lathe([[0, 0], [0.06, 0], [0.07, 0.12], [0.04, 0.22], [0, 0.22]], 16), 0x9fc3c0, 5.2, FL + 1.05, 1.55, 0, 0, 0, vcGloss());
  for (let k = 0; k < 5; k++) V(g, SP(0.035, 8, 6), [0xe86aa0, 0xf2d03a, 0xffffff][k % 3], 5.2 + Math.cos(k * 1.3) * 0.05, FL + 1.32 + (k % 2) * 0.04, 1.55 + Math.sin(k * 1.3) * 0.05, 0, 0, 0, vcSoft());
  // sculptures, benches, plants
  sculpture(I, -5.8, -0.6, 0);
  sculpture(I, 6.0, -4.9, 1);
  galleryBench(I, 0, -5.0, 0);
  galleryBench(I, -7.6, -1.9, PI / 2);
  plant(I, -9.0, 2.9, 'fig', 1.7, 11);
  plant(I, 9.0, 2.9, 'fig', 1.6, 12);
  // people
  npc(I, 4.3, FL, 0.95, PI, 'stand', 'staff');
  npc(I, -8.1, FL, 0.8, PI / 2, 'stand', 'guest');
  npc(I, 0.5, FL, -5.0, 0, 'sit', 'guest');
  I.lamps.push({ pos: [-5, 4.2, -1], color: 0xfff6e8, intensity: 1.1, range: 9 }, { pos: [5, 4.2, -1], color: 0xfff6e8, intensity: 1.1, range: 9 },
    { pos: [0, 4.2, -5.6], color: 0xfff6e8, intensity: 1.1, range: 9 }, { pos: [0, 4.2, 2.0], color: 0xfff6e8, intensity: 1.0, range: 8 });
  I.indoor.push(aabb(-9.55, 0, -7.55, 9.55, CEIL, 3.35));
  I.interactables.push({ id: 'gallery', label: '내 사진 보기 (갤러리)', pos: [4.3, 1.3, 2.35], radius: 1.5 });
  C.site.extra.frames = I.frames;
  return done(I);
}

/* ================================================================== atlases */
function iconFlame(c, x, y, r) {
  c.fillStyle = '#ffb02e'; c.beginPath(); c.moveTo(x, y - r); c.bezierCurveTo(x + r * 0.9, y - r * 0.2, x + r * 0.8, y + r, x, y + r); c.bezierCurveTo(x - r * 0.8, y + r, x - r * 0.9, y - r * 0.1, x - r * 0.2, y - r * 0.5); c.bezierCurveTo(x - r * 0.1, y - r * 0.1, x + r * 0.1, y - r * 0.4, x, y - r); c.fill();
  c.fillStyle = '#ffe9a0'; c.beginPath(); c.ellipse(x, y + r * 0.45, r * 0.32, r * 0.45, 0, 0, PI * 2); c.fill();
}
function drawShield(c, cx, cy, s, fill, stroke) {
  c.beginPath(); c.moveTo(cx - 0.8 * s, cy - 0.9 * s); c.lineTo(cx + 0.8 * s, cy - 0.9 * s); c.lineTo(cx + 0.8 * s, cy - 0.15 * s);
  c.quadraticCurveTo(cx + 0.72 * s, cy + 0.62 * s, cx, cy + 1.0 * s); c.quadraticCurveTo(cx - 0.72 * s, cy + 0.62 * s, cx - 0.8 * s, cy - 0.15 * s); c.closePath();
  c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = s * 0.08; c.stroke(); }
}
function star(c, x, y, r, col) {
  c.fillStyle = col; c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, rr0 = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr0, y + Math.sin(a) * rr0); }
  c.closePath(); c.fill();
}
function coin(c, x, y, r) {
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, '#fff2b0'); g.addColorStop(1, '#c8962a');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, PI * 2); c.fill();
  c.strokeStyle = '#8a6418'; c.lineWidth = r * 0.08; c.beginPath(); c.arc(x, y, r * 0.78, 0, PI * 2); c.stroke();
  c.fillStyle = '#5a8a2a'; c.beginPath(); c.ellipse(x - r * 0.2, y - r * 0.05, r * 0.22, r * 0.12, -0.6, 0, PI * 2); c.fill(); c.beginPath(); c.ellipse(x + r * 0.2, y - r * 0.15, r * 0.24, r * 0.12, 0.6, 0, PI * 2); c.fill();
  c.strokeStyle = '#5a8a2a'; c.lineWidth = r * 0.07; c.beginPath(); c.moveTo(x, y + r * 0.4); c.lineTo(x, y - r * 0.1); c.stroke();
}
function envelopeWings(c, x, y, r, col = '#ffffff') {
  c.fillStyle = col; c.strokeStyle = col; c.lineWidth = r * 0.08;
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x + s * r * 0.45, y - r * 0.1); c.quadraticCurveTo(x + s * r * 1.05, y - r * 0.7, x + s * r * 1.2, y - r * 0.2); c.quadraticCurveTo(x + s * r * 0.9, y - r * 0.15, x + s * r * 0.45, y + r * 0.15); c.fill(); }
  c.fillRect(x - r * 0.55, y - r * 0.35, r * 1.1, r * 0.75);
  c.strokeStyle = '#e4552a'; c.beginPath(); c.moveTo(x - r * 0.55, y - r * 0.35); c.lineTo(x, y + r * 0.1); c.lineTo(x + r * 0.55, y - r * 0.35); c.stroke();
}
function chick(c, x, y, r) {
  // original mascot: round fried-golden chick with a red comb, winking, holding a drumstick
  c.fillStyle = '#f0a43a'; c.beginPath(); c.arc(x, y + r * 0.1, r, 0, PI * 2); c.fill();
  c.fillStyle = '#ffd36a'; c.beginPath(); c.ellipse(x, y + r * 0.35, r * 0.62, r * 0.55, 0, 0, PI * 2); c.fill();
  c.fillStyle = '#e8352a'; for (const [dx, rr0] of [[-0.25, 0.2], [0, 0.26], [0.25, 0.2]]) { c.beginPath(); c.arc(x + dx * r, y - r * 0.92, rr0 * r, 0, PI * 2); c.fill(); }
  c.fillStyle = '#2b1a12'; c.beginPath(); c.arc(x - r * 0.35, y - r * 0.15, r * 0.11, 0, PI * 2); c.fill();
  c.strokeStyle = '#2b1a12'; c.lineWidth = r * 0.07; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + r * 0.22, y - r * 0.15); c.quadraticCurveTo(x + r * 0.35, y - r * 0.25, x + r * 0.48, y - r * 0.15); c.stroke();
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x - r * 0.38, y - r * 0.19, r * 0.035, 0, PI * 2); c.fill();
  c.fillStyle = '#f7801e'; c.beginPath(); c.moveTo(x - r * 0.12, y + r * 0.02); c.lineTo(x + r * 0.14, y + r * 0.02); c.lineTo(x, y + r * 0.22); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,110,110,0.55)'; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(x + s * r * 0.52, y + r * 0.12, r * 0.13, r * 0.08, 0, 0, PI * 2); c.fill(); }
  c.fillStyle = '#b8681e'; c.beginPath(); c.ellipse(x + r * 0.78, y + r * 0.3, r * 0.26, r * 0.2, -0.7, 0, PI * 2); c.fill();
  c.fillStyle = '#f6efe2'; c.fillRect(x + r * 0.88, y + r * 0.38, r * 0.2, r * 0.07); c.beginPath(); c.arc(x + r * 1.1, y + r * 0.37, r * 0.06, 0, PI * 2); c.arc(x + r * 1.1, y + r * 0.47, r * 0.06, 0, PI * 2); c.fill();
}
function pizzaSlice(c, x, y, r) {
  c.fillStyle = '#e8a64a'; c.beginPath(); c.moveTo(x, y + r); c.lineTo(x - r * 0.8, y - r * 0.6); c.quadraticCurveTo(x, y - r * 1.0, x + r * 0.8, y - r * 0.6); c.closePath(); c.fill();
  c.fillStyle = '#f6d36a'; c.beginPath(); c.moveTo(x, y + r * 0.85); c.lineTo(x - r * 0.65, y - r * 0.45); c.quadraticCurveTo(x, y - r * 0.8, x + r * 0.65, y - r * 0.45); c.closePath(); c.fill();
  c.fillStyle = '#c8282a'; for (const [dx, dy] of [[-0.25, -0.35], [0.25, -0.3], [0, 0.1], [-0.05, -0.55]]) { c.beginPath(); c.arc(x + dx * r, y + dy * r, r * 0.12, 0, PI * 2); c.fill(); }
}
function poster(c, w, h, i) {
  if (i === 0) { // 햄찌 대모험
    grad(c, w, h, '#ffb35a', '#c8502a');
    c.fillStyle = '#5a3a2a'; c.beginPath(); c.moveTo(0, h * 0.75); c.lineTo(w * 0.35, h * 0.42); c.lineTo(w * 0.6, h * 0.62); c.lineTo(w * 0.8, h * 0.5); c.lineTo(w, h * 0.7); c.lineTo(w, h); c.lineTo(0, h); c.fill();
    c.fillStyle = '#fff3d0'; c.beginPath(); c.arc(w * 0.75, h * 0.22, w * 0.12, 0, PI * 2); c.fill();
    const x = w * 0.45, y = h * 0.58, r = w * 0.2;
    c.fillStyle = '#e8a060'; c.beginPath(); c.ellipse(x, y, r, r * 0.85, 0, 0, PI * 2); c.fill();
    c.fillStyle = '#fff3e0'; c.beginPath(); c.ellipse(x, y + r * 0.25, r * 0.6, r * 0.5, 0, 0, PI * 2); c.fill();
    for (const s of [-1, 1]) { c.fillStyle = '#e8a060'; c.beginPath(); c.arc(x + s * r * 0.65, y - r * 0.7, r * 0.25, 0, PI * 2); c.fill(); c.fillStyle = '#f6a0a0'; c.beginPath(); c.arc(x + s * r * 0.65, y - r * 0.7, r * 0.13, 0, PI * 2); c.fill(); c.fillStyle = '#1b1210'; c.beginPath(); c.arc(x + s * r * 0.3, y - r * 0.15, r * 0.1, 0, PI * 2); c.fill(); }
    c.fillStyle = '#3a6ab8'; rr(c, x + r * 0.55, y - r * 0.2, r * 0.6, r * 0.8, r * 0.12, '#3a6ab8');
    c.fillStyle = '#c8282a'; c.fillRect(x - r * 1.1, y - r * 1.25, r * 2.2, r * 0.18);
    fit(c, '햄찌 대모험', w / 2, h * 0.12, 54, w * 0.9, '#ffffff'); fit(c, '작은 발, 큰 모험!', w / 2, h * 0.88, 26, w * 0.8, '#fff3d0'); fit(c, '전체 관람가', w / 2, h * 0.95, 18, w * 0.8, '#ffe0b0');
  } else if (i === 1) { // 우주 고양이
    grad(c, w, h, '#1a1446', '#4a2a8a');
    const R = rng(77); c.fillStyle = '#ffffff'; for (let k = 0; k < 70; k++) c.fillRect(R() * w, R() * h, 2, 2);
    c.fillStyle = '#e86aa0'; c.beginPath(); c.arc(w * 0.82, h * 0.78, w * 0.22, 0, PI * 2); c.fill(); c.strokeStyle = '#ffc0d8'; c.lineWidth = 5; c.beginPath(); c.ellipse(w * 0.82, h * 0.78, w * 0.34, w * 0.07, -0.3, 0, PI * 2); c.stroke();
    const x = w * 0.45, y = h * 0.5, r = w * 0.2;
    c.fillStyle = 'rgba(190,230,255,0.35)'; c.beginPath(); c.arc(x, y, r * 1.35, 0, PI * 2); c.fill(); c.strokeStyle = '#d8e8f8'; c.lineWidth = 6; c.stroke();
    c.fillStyle = '#9a9aa8'; c.beginPath(); c.arc(x, y + r * 0.1, r * 0.8, 0, PI * 2); c.fill();
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x + s * r * 0.75, y - r * 0.2); c.lineTo(x + s * r * 0.55, y - r * 0.95); c.lineTo(x + s * r * 0.15, y - r * 0.6); c.fill(); }
    c.fillStyle = '#7ad87a'; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(x + s * r * 0.3, y, r * 0.14, r * 0.18, 0, 0, PI * 2); c.fill(); }
    c.fillStyle = '#f6a0b0'; c.beginPath(); c.arc(x, y + r * 0.25, r * 0.07, 0, PI * 2); c.fill();
    fit(c, '우주 고양이', w / 2, h * 0.12, 54, w * 0.9, '#ffe96a'); fit(c, '별을 쫓는 냥이의 여행', w / 2, h * 0.9, 24, w * 0.85, '#ffffff');
  } else { // 젤리 타워 더 무비
    grad(c, w, h, '#7ad8f0', '#f08ac8');
    const cols = ['#ff5a6a', '#ffc83a', '#5ad87a', '#5aa8ff', '#c87aff'];
    for (let k = 0; k < 7; k++) {
      const jx = w * (0.32 + (k % 2) * 0.36), jy = h * (0.82 - Math.floor(k / 2) * 0.15), r = w * 0.15;
      c.fillStyle = cols[k % 5]; c.beginPath(); c.ellipse(jx, jy, r, r * 0.85, 0, 0, PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.ellipse(jx - r * 0.35, jy - r * 0.35, r * 0.25, r * 0.15, -0.5, 0, PI * 2); c.fill();
      c.fillStyle = '#1b1210'; for (const s of [-1, 1]) { c.beginPath(); c.arc(jx + s * r * 0.3, jy, r * 0.1, 0, PI * 2); c.fill(); }
    }
    fit(c, '젤리 타워', w / 2, h * 0.1, 58, w * 0.9, '#ffffff'); fit(c, '더 무비', w / 2, h * 0.19, 40, w * 0.6, '#fff36a');
  }
  c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 4; c.strokeRect(6, 6, w - 12, h - 12);
}

function makeAtlas(kind) {
  const big = kind === 'cinema' || kind === 'mart' || kind === 'fire';
  const A = new Atlas(big ? 2048 : 1024, 6);
  const add = (k, w, h, f) => A.add(k, w, h, f);
  if (kind === 'fire') {
    rooms(A, ['#eef0f2', '#f3ece0', '#e9eef0']);
    add('sign', 1100, 145, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = '#c4161c'; c.fillRect(0, h - 14, w, 14); iconFlame(c, 70, h / 2 - 6, 46); fit(c, '세온 소방서', w * 0.47, h * 0.47, 96, w * 0.62, '#c4161c'); fit(c, 'SEON FIRE STATION', w - 30, h * 0.47, 28, 240, '#2b2d31', 'right'); });
    add('tower', 180, 460, (c, w, h) => { c.fillStyle = '#c4161c'; c.fillRect(0, 0, w, h); c.strokeStyle = '#ffffff'; c.lineWidth = 5; c.strokeRect(8, 8, w - 16, h - 16); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(w / 2, 72, 52, 0, PI * 2); c.fill(); iconFlame(c, w / 2, 72, 36); ['소', '방', '서'].forEach((ch, i) => txt(c, ch, w / 2, 190 + i * 90, 84, '#ffffff', 'center', 'middle')); });
    add('gear', 400, 520, (c, w, h) => {
      grad(c, w, h, '#f4f2ec', '#bdb8ae');
      for (let i = 0; i < 5; i++) { const x = 12 + i * 77; rr(c, x, 120, 70, 300, 4, '#9aa3ab'); c.fillStyle = '#e8c24a'; c.beginPath(); c.moveTo(x + 12, 150); c.lineTo(x + 58, 150); c.lineTo(x + 62, 280); c.lineTo(x + 8, 280); c.fill(); c.fillStyle = '#d8d8d0'; c.fillRect(x + 10, 230, 50, 8); c.fillRect(x + 10, 260, 50, 8); c.fillStyle = '#c4161c'; c.beginPath(); c.arc(x + 35, 132, 16, PI, 0); c.fill(); c.fillStyle = '#2b2d31'; c.fillRect(x + 14, 330, 18, 70); c.fillRect(x + 38, 330, 18, 70); }
      rr(c, 40, 20, 320, 70, 6, '#c4161c'); txt(c, '출동! 안전 제일', w / 2, 56, 34, '#ffffff', 'center', 'middle');
      c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(0, h - 40, w, 40);
    });
    add('lobby', 160, 300, (c, w, h) => { grad(c, w, h, '#f6f3ec', '#c9c2b4'); rr(c, 20, 40, 120, 40, 6, '#c4161c'); txt(c, '민원실', w / 2, 61, 26, '#ffffff', 'center', 'middle'); c.fillStyle = '#8a8478'; c.fillRect(10, 200, 140, 60); });
    add('truckDoor', 300, 160, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(60, h / 2, 48, 0, PI * 2); c.fill(); iconFlame(c, 60, h / 2, 34); txt(c, '세온 소방서', 120, h * 0.42, 40, '#ffffff', 'left', 'middle'); txt(c, '119', 120, h * 0.78, 40, '#ffe9a0', 'left', 'middle'); });
    add('n119', 240, 90, (c, w, h) => { c.clearRect(0, 0, w, h); txt(c, '119', w / 2, h / 2 + 4, 80, '#ffffff', 'center', 'middle'); });
    add('floorTxt', 400, 100, (c, w, h) => { c.clearRect(0, 0, w, h); fit(c, '소방차 전용', w / 2, h / 2, 76, w * 0.95, '#f2c230'); });
  } else if (kind === 'police') {
    rooms(A, ['#eef2f6', '#e6edf5', '#f2f0ea']);
    add('sign', 900, 100, (c, w, h) => { grad(c, w, h, '#2a64c8', '#1a3f8a'); drawShield(c, 60, h / 2 - 2, 38, '#ffffff'); star(c, 60, h / 2 - 8, 20, '#1f4f9a'); fit(c, '세온 경찰서', w * 0.47, h * 0.54, 72, w * 0.6, '#ffffff'); fit(c, 'POLICE', w - 24, h * 0.54, 40, 190, '#bfe0ff', 'right'); });
    add('name', 520, 100, (c, w, h) => { c.fillStyle = '#1f4f9a'; c.fillRect(0, 0, w, h); fit(c, '경찰서', w * 0.36, h * 0.54, 78, w * 0.6, '#ffffff'); fit(c, '112', w - 26, h * 0.54, 52, 140, '#ffd84a', 'right'); });
    add('emblem', 300, 360, (c, w, h) => { c.clearRect(0, 0, w, h); const s = 160; drawShield(c, w / 2, h / 2 - 4, s, '#1f4f9a', '#e8c24a'); drawShield(c, w / 2, h / 2 - 4, s * 0.8, '#2a64c8'); star(c, w / 2, h / 2 - 30, 62, '#ffffff'); c.strokeStyle = '#e8c24a'; c.lineWidth = 6; c.beginPath(); c.arc(w / 2, h / 2 - 30, 82, 0, PI * 2); c.stroke(); txt(c, 'POLICE', w / 2, h / 2 + 90, 40, '#ffffff', 'center', 'middle'); });
    add('flag', 300, 200, (c, w, h) => { c.fillStyle = '#1f4f9a'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffffff'; c.fillRect(0, h * 0.78, w, h * 0.08); drawShield(c, w / 2, h * 0.42, 62, '#ffffff'); star(c, w / 2, h * 0.36, 28, '#1f4f9a'); });
    add('lantern', 90, 120, (c, w, h) => { c.fillStyle = '#5a9aff'; c.fillRect(0, 0, w, h); ['경', '찰'].forEach((ch, i) => txt(c, ch, w / 2, 32 + i * 56, 50, '#ffffff', 'center', 'middle')); });
    add('lobby', 200, 260, (c, w, h) => { grad(c, w, h, '#f4f6f8', '#b8c0c8'); glowSpot(c, w / 2, 0, 160); rr(c, 20, 30, 160, 40, 6, '#1f4f9a'); txt(c, '민원 안내', w / 2, 51, 26, '#ffffff', 'center', 'middle'); c.fillStyle = '#5a6a7a'; c.fillRect(0, 170, w, 50); c.fillStyle = '#e8ecf0'; c.fillRect(0, 165, w, 8); drawShield(c, w / 2, 115, 22, '#2a64c8'); });
  } else if (kind === 'cinema') {
    add('letters', 1600, 300, (c, w, h) => { c.clearRect(0, 0, w, h); fit(c, '세온 시네마', w / 2, h * 0.55, 270, w * 0.97, '#fff4d6'); });
    add('en', 900, 84, (c, w, h) => { c.clearRect(0, 0, w, h); fit(c, 'S E O N   C I N E M A', w / 2, h / 2, 64, w * 0.95, '#f2c84a'); });
    add('blade', 150, 900, (c, w, h) => { c.fillStyle = '#b8232c'; c.fillRect(0, 0, w, h); c.strokeStyle = '#f2c84a'; c.lineWidth = 6; c.strokeRect(10, 10, w - 20, h - 20); ['C', 'I', 'N', 'E', 'M', 'A'].forEach((ch, i) => txt(c, ch, w / 2, 90 + i * 145, 120, '#fff4d6', 'center', 'middle')); });
    add('marquee', 1600, 72, (c, w, h) => { c.fillStyle = '#141418'; c.fillRect(0, 0, w, h); fit(c, '지금 상영중   ★ 햄찌 대모험   ★ 우주 고양이   ★ 젤리 타워 더 무비', w / 2, h / 2 + 2, 50, w * 0.95, '#ffe9a0'); });
    for (let i = 0; i < 3; i++) add('poster' + i, 340, 500, (c, w, h) => poster(c, w, h, i));
    add('lobby', 700, 260, (c, w, h) => {
      grad(c, w, h, '#5a1f24', '#2a0f12'); glowSpot(c, w * 0.3, 0, 260, 'rgba(255,200,140,0.6)'); glowSpot(c, w * 0.75, 0, 260, 'rgba(255,200,140,0.6)');
      for (let i = 0; i < 3; i++) { const x = 230 + i * 150; rr(c, x, 30, 135, 80, 4, '#111114', '#d8b25a', 3); txt(c, ['팝콘', '음료', '나초'][i], x + 67, 55, 26, '#ffe9a0', 'center', 'middle'); txt(c, ['5,000원', '2,500원', '4,500원'][i], x + 67, 88, 22, '#ffffff', 'center', 'middle'); }
      rr(c, 20, 30, 190, 140, 4, '#111114', '#d8b25a', 3); txt(c, '상영 시간표', 115, 52, 22, '#ffe9a0', 'center', 'middle');
      ['햄찌 대모험 13:00', '우주 고양이 15:20', '젤리 타워 17:40'].forEach((s, i) => fit(c, s, 115, 85 + i * 28, 19, 170, '#ffffff'));
      c.fillStyle = '#7a2a2e'; c.fillRect(0, 200, w, 60);
    });
    add('popSign', 260, 64, (c, w, h) => { c.fillStyle = '#f2c84a'; c.fillRect(0, 0, w, h); fit(c, 'POPCORN', w / 2, h / 2 + 2, 44, w * 0.9, '#b8232c'); });
    add('booth', 240, 170, (c, w, h) => { grad(c, w, h, '#fff1d8', '#c8a888'); glowSpot(c, w / 2, 0, 140); c.fillStyle = '#6a2a2e'; c.fillRect(0, h * 0.62, w, h * 0.38); rr(c, 70, 40, 100, 50, 4, '#111114'); txt(c, '13:00', w / 2, 65, 26, '#ffe9a0', 'center', 'middle'); });
    add('ticket', 300, 66, (c, w, h) => { c.fillStyle = '#141418'; c.fillRect(0, 0, w, h); fit(c, '🎟 매표소', w / 2, h / 2 + 2, 46, w * 0.9, '#ffe9a0'); });
  } else if (kind === 'mart') {
    add('sign', 1400, 175, (c, w, h) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = '#1f8a4c'; c.fillRect(0, h - 22, w, 22); c.fillStyle = '#f28a1e'; c.fillRect(0, h - 30, w, 8);
      const x = 120, y = h / 2 - 10; c.fillStyle = '#f28a1e'; c.beginPath(); c.moveTo(x - 70, y - 30); c.lineTo(x + 70, y - 30); c.lineTo(x + 50, y + 40); c.lineTo(x - 50, y + 40); c.closePath(); c.fill();
      c.strokeStyle = '#1f8a4c'; c.lineWidth = 10; c.beginPath(); c.arc(x, y - 30, 45, PI, 0); c.stroke(); c.strokeStyle = '#ffffff'; c.lineWidth = 7; c.beginPath(); c.arc(x, y, 26, 0.2, PI - 0.2); c.stroke();
      fit(c, '세온 마트', w * 0.53, h * 0.44, 140, w * 0.6, '#1f8a4c'); fit(c, 'SEON MART', w - 40, h * 0.44, 40, 260, '#f28a1e', 'right');
    });
    add('sale', 560, 120, (c, w, h) => { c.fillStyle = '#f28a1e'; c.fillRect(0, 0, w, h); fit(c, '오늘의 특가', w / 2, h * 0.38, 56, w * 0.9, '#ffffff'); fit(c, '과일 · 채소 · 우유', w / 2, h * 0.76, 34, w * 0.9, '#fff3c0'); });
    add('aisle', 1500, 220, (c, w, h) => {
      grad(c, w, h, '#fbfbf7', '#c9cbc4'); const R = rng(41);
      for (let r = 0; r < 4; r++) { const y = 50 + r * 42; c.fillStyle = '#b9bcbf'; c.fillRect(0, y, w, 4); for (let x = 4; x < w;) { const bw = 6 + R() * 12, bh = 12 + R() * 22; c.fillStyle = ['#d8302a', '#f2d03a', '#2f6fc0', '#ffffff', '#3a9a5a', '#f28a1e', '#8a4ab0'][(R() * 7) | 0]; c.fillRect(x, y - bh, bw, bh); x += bw + 2; } }
      for (let i = 0; i < 6; i++) glowSpot(c, 120 + i * 250, 0, 140, 'rgba(255,255,255,0.7)');
      c.fillStyle = '#e8eaec'; c.fillRect(0, h - 40, w, 40);
    });
    for (const [k, s] of [['fruit', '과일 · 채소'], ['snack', '과자'], ['ramen', '라면'], ['drink', '음료']]) add('aisle_' + k, 240, 68, (c, w, h) => { c.fillStyle = '#1f8a4c'; c.fillRect(0, 0, w, h); c.fillStyle = '#f28a1e'; c.fillRect(0, h - 8, w, 8); fit(c, s, w / 2, h / 2 - 2, 42, w * 0.9, '#ffffff'); });
    add('in', 160, 48, (c, w, h) => { c.fillStyle = '#1f8a4c'; c.fillRect(0, 0, w, h); txt(c, '입구 →', w / 2, h / 2 + 2, 32, '#ffffff', 'center', 'middle'); });
    add('out', 160, 48, (c, w, h) => { c.fillStyle = '#1f8a4c'; c.fillRect(0, 0, w, h); txt(c, '← 출구', w / 2, h / 2 + 2, 32, '#ffffff', 'center', 'middle'); });
    add('cartSign', 240, 64, (c, w, h) => { c.fillStyle = '#1f8a4c'; c.fillRect(0, 0, w, h); fit(c, '🛒 카트 보관소', w / 2, h / 2 + 2, 36, w * 0.9, '#ffffff'); });
    add('wire', 128, 96, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = '#c8cdd2'; c.lineWidth = 2.5; for (let x = 2; x < w; x += 10) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 2; y < h; y += 14) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } c.lineWidth = 5; c.strokeRect(2, 2, w - 4, h - 4); });
    add('floorTxt', 400, 100, (c, w, h) => { c.clearRect(0, 0, w, h); fit(c, '천천히', w / 2, h / 2, 76, w * 0.9, '#f4f4f2'); });
  } else if (kind === 'bank') {
    rooms(A, ['#f2ede2', '#eef0f2', '#ece6da']);
    add('frieze', 900, 88, (c, w, h) => { c.fillStyle = '#e6dfd0'; c.fillRect(0, 0, w, h); fit(c, '세 온 은 행', w * 0.42, h * 0.55, 72, w * 0.6, '#8a6418'); fit(c, 'SEON BANK', w - 20, h * 0.55, 34, 210, '#2a3a52', 'right'); });
    add('coin', 200, 200, (c, w, h) => { c.clearRect(0, 0, w, h); coin(c, w / 2, h / 2, 94); });
    add('atm', 300, 64, (c, w, h) => { c.fillStyle = '#1f5fb0'; c.fillRect(0, 0, w, h); fit(c, 'ATM 24시간', w / 2, h / 2 + 2, 42, w * 0.9, '#ffffff'); });
    add('atmScreen', 120, 90, (c, w, h) => { grad(c, w, h, '#3a8ad8', '#1a4a8a'); txt(c, '어서오세요', w / 2, 30, 18, '#ffffff', 'center', 'middle'); rr(c, 14, 50, 40, 26, 4, '#ffffff'); rr(c, 66, 50, 40, 26, 4, '#ffd84a'); });
    add('hall', 300, 380, (c, w, h) => { grad(c, w, h, '#f6efe0', '#b8a888'); glowSpot(c, w / 2, 0, 220); c.fillStyle = '#6b4529'; c.fillRect(0, 250, w, 70); c.fillStyle = '#e8e2d4'; c.fillRect(0, 244, w, 10); rr(c, 90, 60, 120, 60, 6, '#111114'); txt(c, '0 2 7', w / 2, 92, 40, '#ff5a4a', 'center', 'middle'); coin(c, w / 2, 180, 36); });
  } else if (kind === 'post') {
    rooms(A, ['#f4ede0', '#eef0ec', '#f2e8dc']);
    add('sign', 1000, 70, (c, w, h) => { c.fillStyle = '#e4552a'; c.fillRect(0, 0, w, h); envelopeWings(c, 60, h / 2 + 4, 30); fit(c, '세온 우체국', w * 0.45, h * 0.56, 56, w * 0.55, '#ffffff'); fit(c, 'POST OFFICE · 택배 · 우편', w - 20, h * 0.56, 28, 330, '#ffe9d8', 'right'); });
    add('logoV', 180, 420, (c, w, h) => { c.fillStyle = '#e4552a'; c.fillRect(0, 0, w, h); envelopeWings(c, w / 2, 80, 60); ['우', '체', '국'].forEach((ch, i) => txt(c, ch, w / 2, 200 + i * 80, 74, '#ffffff', 'center', 'middle')); });
    add('parcels', 420, 300, (c, w, h) => {
      grad(c, w, h, '#fbf6ee', '#c8bba8'); glowSpot(c, w / 2, 0, 240);
      rr(c, 30, 20, 360, 46, 6, '#e4552a'); txt(c, '택배 접수 · 우편 보내기', w / 2, 44, 28, '#ffffff', 'center', 'middle');
      const R = rng(9); for (let r = 0; r < 3; r++) { const y = 130 + r * 55; c.fillStyle = '#8a8478'; c.fillRect(0, y, w, 5); for (let x = 6; x < w - 30;) { const bw = 26 + R() * 40, bh = 20 + R() * 26; c.fillStyle = ['#c4935a', '#b88850', '#d2a46a'][(R() * 3) | 0]; c.fillRect(x, y - bh, bw, bh); c.fillStyle = '#e8d8b0'; c.fillRect(x + bw / 2 - 3, y - bh, 6, bh); x += bw + 4; } }
      c.fillStyle = '#7a7266'; c.fillRect(0, h - 40, w, 40);
    });
    add('hours', 200, 60, (c, w, h) => { c.clearRect(0, 0, w, h); txt(c, '평일 09:00 - 18:00', w / 2, h / 2, 22, '#ffffff', 'center', 'middle'); });
    add('pbLabel', 120, 110, (c, w, h) => { c.fillStyle = '#e4452a'; c.fillRect(0, 0, w, h); envelopeWings(c, w / 2, 34, 22); txt(c, '우편', w / 2, 84, 34, '#ffffff', 'center', 'middle'); });
    add('pbox', 150, 100, (c, w, h) => { c.fillStyle = '#e4552a'; c.fillRect(0, 0, w, h); envelopeWings(c, w / 2, 36, 24); txt(c, '우체국', w / 2, 80, 30, '#ffffff', 'center', 'middle'); });
  } else if (kind === 'gallery') {
    add('letters', 1400, 200, (c, w, h) => { c.clearRect(0, 0, w, h); fit(c, '세온 갤러리', w / 2, h * 0.55, 170, w * 0.97, '#2b2d31'); });
    add('en', 840, 72, (c, w, h) => { c.clearRect(0, 0, w, h); fit(c, 'S E O N   G A L L E R Y', w / 2, h / 2, 50, w * 0.95, '#8a6a42'); });
    add('banner', 300, 720, (c, w, h) => { c.fillStyle = '#f4efe4'; c.fillRect(0, 0, w, h); c.save(); c.translate(20, 60); painting(c, w - 40, 420, 3); c.restore(); fit(c, '나의 사진전', w / 2, 560, 52, w * 0.9, '#2b2d31'); fit(c, '세온 갤러리 · 입장 무료', w / 2, 630, 24, w * 0.9, '#8a6a42'); });
  } else {
    const ck = kind === 'chicken';
    add('sign', 920, 100, (c, w, h) => {
      if (ck) { c.fillStyle = '#d8352a'; c.fillRect(0, 0, w, h); chick(c, 62, h / 2 + 4, 36); fit(c, '바삭 치킨', w * 0.46, h * 0.55, 80, w * 0.5, '#ffd84a'); fit(c, 'FRIED CHICKEN', w - 20, h * 0.55, 34, 260, '#ffffff', 'right'); }
      else { c.fillStyle = '#f4efe4'; c.fillRect(0, 0, w, h); c.fillStyle = '#2f7d46'; c.fillRect(0, 0, w, 8); c.fillStyle = '#b8282a'; c.fillRect(0, h - 8, w, 8); pizzaSlice(c, 62, h / 2, 38); fit(c, '피자 하우스', w * 0.46, h * 0.55, 78, w * 0.52, '#b8282a'); fit(c, 'PIZZA HOUSE', w - 20, h * 0.55, 34, 230, '#2f7d46', 'right'); }
    });
    add('back', 340, 260, (c, w, h) => {
      if (ck) { grad(c, w, h, '#fff6e0', '#d8c098'); glowSpot(c, w / 2, 0, 200); for (let i = 0; i < 3; i++) { rr(c, 20 + i * 106, 24, 96, 70, 4, '#2b2d31', '#d8352a', 3); chick(c, 48 + i * 106, 58, 16); txt(c, ['후라이드', '양념', '반반'][i], 90 + i * 106, 50, 15, '#ffd84a', 'center', 'middle'); txt(c, ['18,000', '19,000', '19,000'][i], 90 + i * 106, 76, 14, '#ffffff', 'center', 'middle'); } c.fillStyle = '#c9cdd2'; c.fillRect(0, 160, w, 100); c.fillStyle = '#9aa0a6'; for (let i = 0; i < 4; i++) c.fillRect(20 + i * 80, 175, 60, 70); }
      else { grad(c, w, h, '#f2e6d0', '#a88868'); glowSpot(c, w / 2, 0, 200, 'rgba(255,200,140,0.7)'); rr(c, 60, 20, 220, 120, 6, '#2a2a28', '#8a6444', 6); txt(c, '오늘의 피자', w / 2, 46, 24, '#f4efe4', 'center', 'middle'); ['페퍼로니 16,000', '불고기 18,000', '고구마 17,000'].forEach((s, i) => fit(c, s, w / 2, 76 + i * 22, 18, 190, '#e8e0c8')); c.fillStyle = '#8a4a32'; for (let y = 160; y < h; y += 16) for (let x = (y / 16) % 2 ? 0 : -15; x < w; x += 30) c.fillRect(x + 1, y + 1, 28, 14); }
    });
    add('open', 120, 44, (c, w, h) => { rr(c, 2, 2, w - 4, h - 4, 10, '#2b2d31', '#ffd84a', 3); txt(c, '영업중', w / 2, h / 2 + 1, 24, '#ffe9a8', 'center', 'middle'); });
    add('dbox', 150, 100, (c, w, h) => { if (ck) { c.fillStyle = '#f6c84a'; c.fillRect(0, 0, w, h); chick(c, 40, 52, 26); fit(c, '바삭 치킨', 104, 52, 26, 86, '#d8352a'); } else { c.fillStyle = '#f4efe4'; c.fillRect(0, 0, w, h); pizzaSlice(c, 36, 50, 24); fit(c, 'PIZZA', 102, 52, 34, 86, '#b8282a'); } });
    if (ck) {
      add('mascot', 400, 400, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#fff4d6'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 4, 0, PI * 2); c.fill(); c.strokeStyle = '#d8352a'; c.lineWidth = 14; c.stroke(); chick(c, w / 2 - 20, h / 2 - 20, 105); fit(c, '바삭바삭!', w / 2, h - 66, 46, w * 0.6, '#d8352a'); });
      add('menu', 150, 220, (c, w, h) => { c.fillStyle = '#fff4d6'; c.fillRect(0, 0, w, h); chick(c, w / 2, 55, 30); txt(c, '오늘의 치킨', w / 2, 110, 20, '#d8352a', 'center', 'middle'); ['후라이드', '양념', '간장'].forEach((s, i) => txt(c, s, w / 2, 145 + i * 26, 18, '#3a3330', 'center', 'middle')); });
    } else {
      add('gable', 420, 128, (c, w, h) => { c.clearRect(0, 0, w, h); fit(c, 'PIZZA', w / 2, h * 0.56, 110, w * 0.9, '#b8282a'); });
      add('fire', 140, 84, (c, w, h) => { c.fillStyle = '#1a0a06'; c.fillRect(0, 0, w, h); c.fillStyle = '#1a0a06'; const g = c.createRadialGradient(w / 2, h, 4, w / 2, h, h); g.addColorStop(0, '#fff0a0'); g.addColorStop(0.35, '#ff9a2a'); g.addColorStop(0.8, '#a83a10'); g.addColorStop(1, '#1a0a06'); c.fillStyle = g; c.beginPath(); c.moveTo(0, h); c.lineTo(0, h * 0.5); c.quadraticCurveTo(w / 2, -h * 0.3, w, h * 0.5); c.lineTo(w, h); c.fill(); });
    }
  }
  interiorAtlas(A, kind);
  for (const size of [A.size, 1536, 2048]) {
    A.size = Math.max(A.size, size); A.items.clear();
    try { A.build(); break; } catch (e) { if (size === 2048) throw e; }
  }
  return A;
}

/* ================================================================== public */
export function buildCivic({ kind = 'fire' } = {}) {
  const K = CIVIC[kind] ? kind : 'fire';
  const { w, d, name } = CIVIC[K];
  const site = makeSite('civic-' + K, w, d);
  const A = makeAtlas(K);
  const C = makeKit(site, A, K.length * 131 + 17);
  site.nightGlow.push(redGlow(), amberGlow());
  if (K === 'fire') buildFire(C);
  else if (K === 'police') buildPolice(C);
  else if (K === 'cinema') buildCinema(C);
  else if (K === 'mart') buildMart(C);
  else if (K === 'bank') buildBank(C);
  else if (K === 'post') buildPost(C);
  else if (K === 'gallery') buildGallery(C);
  else buildSmallShop(C, K);
  bake(site.group);
  site.extra.kind = K;
  site.extra.name = name;
  const make = { fire: fireInterior, police: policeInterior, cinema: cinemaInterior, mart: martInterior, bank: bankInterior, post: postInterior, gallery: galleryInterior }[K];
  site.extra.interior = { build: () => (make ? make(C) : shopInterior(C, K)) };
  return site;
}

/** Viewer helper: one civic building with its interior already built and added. */
export function withInterior({ kind = 'fire' } = {}) {
  const site = buildCivic({ kind });
  const t0 = performance.now();
  const inn = site.extra.interior.build();
  const ms = performance.now() - t0;
  site.group.add(inn.group);
  let meshes = 0, tris = 0;
  inn.group.traverse((o) => { if (o.isMesh) { meshes++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
  site.extra.interiorStats = { ms: Math.round(ms), meshes, tris: Math.round(tris) };
  if (typeof window !== 'undefined') window.__interiorStats = site.extra.interiorStats;
  return { ...site, colliders: [...site.colliders, ...inn.colliders], interactables: [...site.interactables, ...inn.interactables], npcSpots: inn.npcSpots, inner: inn };
}

/** Viewer helper: all eight side by side along X, fronts aligned at z = 0 (each moved back by d/2). */
export function civicRow() {
  const group0 = new THREE.Group();
  let x = 0;
  const sites = CIVIC_KINDS.map((k) => buildCivic({ kind: k }));
  const total = sites.reduce((s, st) => s + st.footprint.w + 2, -2);
  x = -total / 2;
  for (const st of sites) {
    st.group.position.set(x + st.footprint.w / 2, 0, -st.footprint.d / 2);
    group0.add(st.group);
    x += st.footprint.w + 2;
  }
  return { group: group0, colliders: [] };
}
