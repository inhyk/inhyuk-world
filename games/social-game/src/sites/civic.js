// Civic buildings and bigger shops for the town (인혁: "건물을 더 만들어줘", 2026-11-05):
// fire station, police station, cinema, supermarket, bank, post office, fried-chicken shop, pizza shop.
// buildCivic({kind}) → Site (see ../site.js), entrance faces +Z. Exterior only (not walkable inside):
// colliders wrap the masses, shallow dressed interiors sit behind the glass, signs and windows glow at night.
// The fire truck and patrol car are static models baked into the site.
import * as THREE from 'three';
import { mat, paint, textured } from '../mat.js';
import { box, quad, put, group, bake, torus, lathe, extrude, prep } from '../geom.js';
import { FONT } from '../tex.js';
import { makeSite, solid } from '../site.js';
import { rng } from '../noise.js';
import { buildCar } from '../props/car.js';
import { hydrant, bench } from '../props/street.js';
import { PI, RB, CY, SP, V, D, Atlas, txt, rr, pottedPlant, vcMat, vcGloss, vcSoft } from './office.js';

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
  const C = { site, g: site.group, A, R: rng(seed), glass: mat('glass'), tinted: mat('tintedGlass'), lamp: mat('lampGlow'), cool: mat('coolGlow') };
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
function windows(C, xs, y, zf, ww, wh, fr, sillM) {
  const { g, A } = C;
  xs.forEach((x, i) => {
    D(g, A.quad('room' + ((i + Math.round(y)) % 3), ww, wh), C.win, x, y + wh / 2, zf + 0.012);
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
  // cab
  V(g, RB(W, 2.15, 2.2, 0.14, 3), RED, 0, 2.0, 2.4, 0, 0, 0, gl);
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
  // apron with no-parking boxes
  put(g, RB(18, 0.06, 7 - F + 0.3, 0.02, 1), mat('concrete'), 0, 0.03, (F - 0.3 + 7) / 2);
  for (const bx of bays) {
    for (const s of [-1, 1]) V(g, RB(0.14, 0.012, 4.2, 0.005, 1), 0xf2c230, bx + s * 1.75, 0.066, F + 2.2);
    V(g, RB(3.64, 0.012, 0.14, 0.005, 1), 0xf2c230, bx, 0.066, F + 4.25);
    D(g, C.A.quad('floorTxt', 2.4, 0.6), C.print, bx, 0.068, F + 3.4, -PI / 2, 0, 0);
  }
  // masses: ground storey (hollow behind the open bay), upper storey
  put(g, box(X1 - ox1, G, F - 0.3 - BZ), white, (ox1 + X1) / 2, G / 2, (F - 0.3 + BZ) / 2);
  put(g, box(ox0 - X0, G, F - 0.3 - BZ), white, (X0 + ox0) / 2, G / 2, (F - 0.3 + BZ) / 2);
  put(g, box(DW, G, IB - BZ), white, ob, G / 2, (IB + BZ) / 2);
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
  for (const bx of bays.slice(1)) {
    put(g, box(DW, DH, 0.08), doorM, bx, DH / 2, F - 0.32);
    for (let k = 0; k < 5; k++) D(g, quad(0.55, 0.36), C.tinted, bx - 1.4 + k * 0.7, 3.2, F - 0.275);
    for (const s of [-1, 1]) V(g, RB(0.14, DH, 0.2, 0.01, 1), 0xc4221c, bx + s * (DW / 2 + 0.05), DH / 2, F - 0.3, 0, 0, 0, vcGloss());
    V(g, RB(0.24, 0.12, 0.06, 0.02, 1), 0x9aa0a6, bx, 0.4, F - 0.26);
  }
  // open bay: rolled-up door, interior with gear lockers, the truck
  V(g, CY(0.32, 0.32, DW + 0.1, 18), 0xd6d8da, ob, DH + 0.25, F - 0.6, 0, 0, PI / 2, vcGloss());
  put(g, box(DW, 0.25, 0.08), doorM, ob, DH - 0.05, F - 0.42);
  for (const s of [-1, 1]) V(g, RB(0.14, DH, 0.2, 0.01, 1), 0xc4221c, ob + s * (DW / 2 + 0.05), DH / 2, F - 0.3, 0, 0, 0, vcGloss());
  V(g, RB(DW, 0.04, F - IB, 0.01, 1), 0x8f8d88, ob, 0.02, (F + IB) / 2, 0, 0, 0, vcGloss());
  for (const s of [-1, 1]) V(g, RB(0.12, 0.01, F - IB - 0.6, 0.005, 1), 0xf2c230, ob + s * 1.55, 0.045, (F + IB) / 2);
  for (const s of [-1, 1]) V(g, RB(0.06, DH + 0.5, F - 0.3 - IB, 0.01, 1), 0xe9e6df, ob + s * (DW / 2 - 0.03), (DH + 0.5) / 2, (F - 0.3 + IB) / 2);
  V(g, RB(DW, 0.06, F - 0.3 - IB, 0.01, 1), 0xe9e6df, ob, DH + 0.5, (F - 0.3 + IB) / 2);
  D(g, A.quad('gear', DW, DH + 0.4), C.win, ob, (DH + 0.4) / 2, IB + 0.01);
  for (const zz of [-4.4, -2.2, 0]) D(g, RB(0.12, 0.03, 1.4, 0.01, 1), C.lamp, ob, DH + 0.45, zz);
  fireTruck(C, ob, -1.4);
  site.lamps.push({ pos: [ob, 4.2, -1.5], color: 0xfff1d6, intensity: 1.4, range: 8 });
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
  solid(site, (X0 + X1) / 2, (H + PH) / 2, (BZ + F) / 2, X1 - X0, H + PH, F - BZ);
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
  // wings
  put(g, box(X1 - X0, H, F - BZ), white, 0, H / 2, (F + BZ) / 2);
  put(g, RB(X1 - X0 + 0.06, 0.5, 0.18, 0.02, 1), blue, 0, G - 0.1, F + 0.06);
  put(g, RB(X1 - X0 + 0.06, 0.3, 0.3, 0.02, 1), mat('concrete'), 0, 0.15, F);
  roofEdge(C, X0, X1, BZ, F, H, PH, white, blue);
  for (const s of [-1, 1]) {
    const xs = [s * 4.2, s * 6.4];
    windows(C, xs, 0.95, F, 1.5, 1.7, 0xf4f4f2, trim);
    windows(C, xs, 4.5, F, 1.5, 1.5, 0xf4f4f2, trim);
    V(g, RB(0.18, H - 0.2, 0.2, 0.02, 1), 0x1f4f9a, s * (X1 - 0.09), H / 2, F + 0.02);
  }
  // central tower: blue glass, entrance canopy, emblem on top
  put(g, RB(TW * 2, TH, 0.6, 0.03, 2), trim, 0, TH / 2, F + 0.3);
  D(g, quad(TW * 2 - 0.6, 3.6), C.tinted, 0, 5.6, F + 0.61);
  D(g, A.quad('room1', TW * 2 - 0.6, 3.6), C.win, 0, 5.6, F + 0.56);
  for (let i = 0; i <= 5; i++) V(g, RB(0.08, 3.6, 0.12, 0.01, 1), 0x1f4f9a, -TW + 0.3 + i * (TW * 2 - 0.6) / 5, 5.6, F + 0.64);
  for (const y of [3.8, 5.6, 7.4]) V(g, RB(TW * 2 - 0.6, 0.08, 0.12, 0.01, 1), 0x1f4f9a, 0, y, F + 0.64);
  const sh = new THREE.Shape();
  sh.moveTo(-0.8, 0.9); sh.lineTo(0.8, 0.9); sh.lineTo(0.8, 0.15); sh.quadraticCurveTo(0.72, -0.62, 0, -1.0); sh.quadraticCurveTo(-0.72, -0.62, -0.8, 0.15); sh.closePath();
  put(g, extrude(sh, 0.12, 0.03), blue, 0, TH - 0.85, F + 0.6);
  D(g, A.quad('emblem', 1.5, 1.8), C.sign, 0, TH - 0.85, F + 0.78);
  // entrance
  glassDoor(C, 0, F + 0.62, 2.0, 2.5, 0x1f4f9a, 'lobby');
  for (const s of [-1, 1]) D(g, A.quad('room2', 1.0, 2.5), C.win, s * 1.75, 1.3, F + 0.1);
  for (const s of [-1, 1]) { D(g, quad(1.0, 2.5), C.glass, s * 1.75, 1.3, F + 0.62); V(g, RB(0.08, 2.6, 0.14, 0.01, 1), 0x1f4f9a, s * 2.3, 1.3, F + 0.62); }
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
  solid(site, 0, (H + PH) / 2, (BZ + F) / 2, X1 - X0, H + PH, F - BZ);
  solid(site, 0, TH / 2, F + 0.3, TW * 2, TH, 0.6);
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
  // box: lobby recess in the middle, solid elsewhere
  put(g, box(X1 - X0, H - 4.2, F - BZ), dark, 0, 4.2 + (H - 4.2) / 2, (F + BZ) / 2);
  put(g, box(X1 - X0, 4.2, F - GZ - BZ), dark, 0, 2.1, (F - GZ + BZ) / 2);
  for (const [a, b] of [[X0, -5.2], [5.2, X1]]) put(g, box(b - a, 4.2, GZ), dark, (a + b) / 2, 2.1, F - GZ / 2);
  for (const s of [-1, 1]) {
    put(g, box(0.1, H - 0.4, F - BZ - 1.0), side, s * (X1 + 0.03), H / 2 - 0.2, (F + BZ) / 2 - 0.3);
    for (let k = 0; k < 5; k++) V(g, RB(0.12, H - 0.6, 0.12, 0.02, 1), 0xb8232c, s * (X1 + 0.05), H / 2 - 0.2, BZ + 1.2 + k * 2.2, 0, 0, 0, vcGloss());
  }
  roofEdge(C, X0, X1, BZ, F, H, 0.5, dark, trim);
  for (const x of [X0 + 0.25, X1 - 0.25]) put(g, RB(0.5, H + 0.5, 0.4, 0.03, 2), accent, x, (H + 0.5) / 2, F + 0.1);
  D(g, RB(X1 - X0 - 0.6, 0.14, 0.06, 0.02, 1), redGlow(), 0, H + 0.2, F + 0.06);
  // lobby: glass front with doors, popcorn machine and a concession counter behind
  glazing(C, -5.2, 5.2, 0.06, 3.9, F - 0.04, { back: 'lobby', depth: GZ - 0.06, pane: 1.75, frame: 0x1d1f24, floor: 0x7a2a2e, side: 0x5a1f24, transom: 2.7 });
  for (const dx of [-2.6, 2.6]) for (const s of [-1, 1]) rod(g, [dx + s * 0.18, 0.9, F + 0.04], [dx + s * 0.18, 1.6, F + 0.04], 0.016, 0xd8b25a, mat('gold'));
  popcornMachine(C, -3.6, 0.06, F - 0.75);
  V(g, RB(3.2, 1.0, 0.55, 0.03, 2), 0x2b1a1c, 1.4, 0.56, F - 1.15, 0, 0, 0, vcGloss());
  V(g, RB(3.3, 0.05, 0.62, 0.02, 1), 0xd8b25a, 1.4, 1.08, F - 1.15, 0, 0, 0, vcGloss());
  for (let k = 0; k < 6; k++) {
    const cx = 0.2 + k * 0.42;
    V(g, lathe([[0, 0], [0.06, 0], [0.085, 0.24], [0, 0.24]], 14), k % 2 ? 0xc8202a : 0x2f5fb0, cx, 1.11, F - 1.05, 0, 0, 0, vcGloss());
    V(g, CY(0.075, 0.07, 0.05, 12), 0xf6e7b0, cx, 1.37, F - 1.05, 0, 0, 0, vcSoft());
  }
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
  solid(site, 0, (H + 0.5) / 2, (BZ + F) / 2, X1 - X0, H + 0.5, F - BZ);
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
  // building masses: interior recess behind the glass
  put(g, box(X1 - X0, GY + 0.1, F - IZ - BZ), wallM, 0, (GY + 0.1) / 2, (F - IZ + BZ) / 2);
  put(g, box(X1 - X0, H - GY, F - BZ), white, 0, GY + (H - GY) / 2, (F + BZ) / 2);
  for (const x of [X0 + 0.4, X1 - 0.4]) put(g, RB(0.8, GY, IZ, 0.02, 1), white, x, GY / 2, F - IZ / 2);
  roofEdge(C, X0, X1, BZ, F, H, 0.9, white, green);
  put(g, RB(X1 - X0 + 0.04, 0.4, 0.1, 0.02, 1), green, 0, GY + 0.25, F + 0.04);
  put(g, RB(X1 - X0 + 0.04, 0.12, 0.1, 0.02, 1), orange, 0, GY + 0.55, F + 0.04);
  // glass front with two automatic doors
  const doors = [-4.5, 4.5], gx0 = X0 + 0.8, gx1 = X1 - 0.8;
  const segs = [[gx0, -6.1], [-2.9, 2.9], [6.1, gx1]];
  for (const [a, b] of segs) glazing(C, a, b, 0.08, GY - 0.1, F - 0.02, { frame: 0x26302a, pane: 2.2 });
  D(g, A.quad('aisle', gx1 - gx0, GY - 0.2), C.win, 0, GY / 2, F - IZ + 0.01);
  V(g, RB(gx1 - gx0, 0.05, IZ, 0.01, 1), 0xd8d6cf, 0, 0.06, F - IZ / 2);
  V(g, RB(gx1 - gx0, 0.05, IZ, 0.01, 1), 0xf2f0ea, 0, GY - 0.05, F - IZ / 2);
  for (const z of [F - 0.8, F - 2.2]) D(g, RB(gx1 - gx0 - 1, 0.03, 0.12, 0.01, 1), C.cool, 0, GY - 0.09, z);
  for (const dx of doors) {
    glassDoor(C, dx, F - 0.02, 3.0, 2.6, 0x26302a);
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
  solid(site, 0, (H + 0.9) / 2, (BZ + F) / 2, X1 - X0, H + 0.9, F - BZ);
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
  put(g, box(X1 - X0, H, F - BZ), stone, 0, H / 2, (F + BZ) / 2);
  roofEdge(C, X0, X1, BZ, F, H, 0.7, stone, stoneP);
  put(g, RB(X1 - X0 + 0.1, 0.5, 0.3, 0.02, 1), stoneP, 0, 0.25, F + 0.05);
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
  glazing(C, -1.75, 0.75, top, 4.1, F + 0.01, { back: 'hall', depth: 0.8, pane: 1.25, frame: 0x8a6a2a, transom: 3.0 });
  for (const x of [-4.4, 2.2]) {
    windows(C, [x + 0.7], 1.1, F, 1.2, 2.2, 0x2a3a52, stoneP);
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
  solid(site, 0, (H + 0.7) / 2, (BZ + F) / 2, X1 - X0, H + 0.7, F - BZ);
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
  put(g, box(X1 - X0, G, F - D0 - BZ), cream, 0, G / 2, (F - D0 + BZ) / 2);
  put(g, box(X1 - X0, H - G, F - BZ), cream, 0, G + (H - G) / 2, (F + BZ) / 2);
  roofEdge(C, X0, X1, BZ, F, H, 0.55, cream, O);
  put(g, RB(X1 - X0 + 0.06, 0.62, 0.3, 0.02, 1), O, 0, G - 0.25, F + 0.05);
  signBox(C, 'sign', -0.8, G - 0.25, F + 0.22, 7.2, 0.5, 0xe4552a, 0.06);
  // glass front, door at the right, parcels behind the glass
  const dX = 3.6, dW = 1.4;
  put(g, RB(X1 - (dX + dW / 2 + 0.1), G - 0.56, D0, 0.02, 1), cream, (X1 + dX + dW / 2 + 0.1) / 2, (G - 0.56) / 2, F - D0 / 2);
  put(g, RB(0.3, G - 0.56, D0, 0.02, 1), cream, X0 + 0.15, (G - 0.56) / 2, F - D0 / 2);
  glazing(C, X0 + 0.3, dX - dW / 2 - 0.1, 0.5, G - 0.6, F - 0.05, { back: 'parcels', depth: D0 - 0.05, pane: 2.2, frame: 0xe4552a, floor: 0xa8a29a });
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
  glassDoor(C, dX, F - 0.05, dW, 2.5, 0xe4552a, 'parcels');
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
  solid(site, 0, (H + 0.55) / 2, (BZ + F) / 2, X1 - X0, H + 0.55, F - BZ);
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
  put(g, box(X1 - X0, G, F - D0 - BZ), wallM, 0, G / 2, (F - D0 + BZ) / 2);
  put(g, box(X1 - X0, 0.9, D0), wallM, 0, G - 0.45, F - D0 / 2);
  for (const [a, b] of [[X0, Math.min(gx0, dX - dW / 2 - 0.1)], [Math.max(gx1, dX + dW / 2 + 0.1), X1]]) if (b - a > 0.05) put(g, box(b - a, G - 0.9, D0), wallM, (a + b) / 2, (G - 0.9) / 2, F - D0 / 2);
  if (!chicken) put(g, box(dX - dW / 2 - 0.1 - gx1, G - 0.9, D0), wallM, (gx1 + dX - dW / 2 - 0.1) / 2, (G - 0.9) / 2, F - D0 / 2);
  else put(g, box(gx0 - (dX + dW / 2 + 0.1), G - 0.9, D0), wallM, (gx0 + dX + dW / 2 + 0.1) / 2, (G - 0.9) / 2, F - D0 / 2);
  roofEdge(C, X0, X1, BZ, F, G, PH, wallM, trim);
  put(g, RB(X1 - X0 + 0.06, 0.25, 0.3, 0.02, 1), mat('concrete'), 0, 0.125, F);
  glazing(C, gx0, gx1, 0.5, G - 0.95, F - 0.05, { back: 'back', depth: D0 - 0.05, pane: 1.8, frame: fr, floor: chicken ? 0xd8c8a8 : 0x8a6a4a });
  put(g, RB(gx1 - gx0, 0.45, 0.2, 0.02, 1), trim, (gx0 + gx1) / 2, 0.27, F - 0.06);
  glassDoor(C, dX, F - 0.05, dW, 2.5, fr, 'back');
  D(g, A.quad('open', 0.36, 0.13), C.sign, dX - 0.15, 1.75, F + 0.0);
  // sign board on the fascia
  signBox(C, 'sign', 0, G + 0.2, F + 0.1, 8.4, 0.9, chicken ? 0xd8352a : 0x2f7d46, 0.14);
  site.lamps.push({ pos: [0, G - 0.2, F + 1.0], color: 0xfff1d6, intensity: 1.0, range: 6 });
  // awning over the glass
  const am = chicken ? textured('stripes', { color: 0xd8352a, color2: 0xfff4d6, count: 5 }, 1.6, { normal: 0.5 }) : textured('stripes', { color: 0x2f7d46, color2: 0xf4efe4, count: 5 }, 1.6, { normal: 0.5 });
  const L = 1.1, drop = 0.45, aw = gx1 - gx0 + 0.2, acx = (gx0 + gx1) / 2;
  put(g, RB(aw, 0.03, Math.hypot(L, drop), 0.01, 1), am, acx, G - 0.85 - drop / 2, F + L / 2, Math.atan2(drop, L));
  put(g, RB(aw, 0.24, 0.03, 0.01, 1), am, acx, G - 0.85 - drop - 0.11, F + L);
  if (chicken) {
    // kitchen counter with fryers, chicken boxes, a menu screen
    V(g, RB(gx1 - gx0 - 0.3, 0.9, 0.5, 0.02, 1), 0xe9ecee, (gx0 + gx1) / 2, 0.95, F - 0.65, 0, 0, 0, vcGloss());
    for (let k = 0; k < 2; k++) {
      const x = gx0 + 0.9 + k * 1.1;
      put(g, RB(0.9, 0.12, 0.45, 0.02, 1), mat('steel'), x, 1.46, F - 0.7);
      V(g, RB(0.8, 0.03, 0.38, 0.01, 1), 0xc98a2a, x, 1.52, F - 0.7, 0, 0, 0, vcGloss());
      for (const s of [-1, 1]) rod(g, [x + s * 0.2, 1.55, F - 0.8], [x + s * 0.2, 1.75, F - 0.95], 0.012, 0x2b2d31);
    }
    for (let k = 0; k < 4; k++) V(g, RB(0.32, 0.12, 0.32, 0.01, 1), [0xd8352a, 0xf6c84a][k % 2], gx1 - 0.6, 1.46 + k * 0.12, F - 0.6, 0, k * 0.15, 0, vcMat());
    for (let k = 0; k < 8; k++) V(g, SP(0.06, 8, 6), 0xb8681e, gx0 + 2.9 + (k % 4) * 0.12, 1.47, F - 0.62 + Math.floor(k / 4) * 0.12, 0, 0, 0, vcSoft()).scale.set(1.3, 0.8, 1);
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
    // brick oven with fire, counter with pizzas, pizza boxes, peel
    const ox = gx0 + 1.2, oz = F - D0 + 0.75;
    put(g, RB(1.7, 0.95, 1.3, 0.03, 2), mat('brickDark'), ox, 0.5, oz);
    put(g, lathe([[0, 0], [0.8, 0], [0.78, 0.25], [0.66, 0.55], [0.42, 0.78], [0.0, 0.86]], 24), mat('brickDark'), ox, 0.97, oz);
    V(g, CY(0.12, 0.14, 1.5, 14), 0x6a3a2a, ox + 0.25, 1.9, oz - 0.2);
    put(g, RB(0.9, 0.08, 0.2, 0.02, 1), mat('brick'), ox, 0.98, oz + 0.62);
    D(g, A.quad('fire', 0.7, 0.42), C.sign, ox, 1.2, oz + 0.66);
    site.lamps.push({ pos: [ox, 1.3, oz + 1.0], color: 0xff9a4a, intensity: 0.8, range: 4 });
    V(g, RB(1.0, 0.04, 0.3, 0.01, 1), 0xc09060, ox + 0.5, 0.97, oz + 0.75, 0, 0.3, 0);
    V(g, CY(0.025, 0.025, 1.4, 8), 0xc09060, ox + 1.05, 0.75, oz + 0.85, 0.3, 0, -0.35);
    V(g, CY(0.17, 0.17, 0.02, 20), 0xc09060, ox + 1.3, 0.12, oz + 0.85, PI / 2 - 0.3, 0, -0.35);
    const cx = gx1 - 1.2;
    V(g, RB(2.0, 0.95, 0.6, 0.02, 1), 0x6b4529, cx, 0.98, F - 0.55);
    V(g, RB(2.1, 0.05, 0.66, 0.02, 1), 0xe9e4da, cx, 1.47, F - 0.55, 0, 0, 0, vcGloss());
    for (let k = 0; k < 3; k++) {
      const px = cx - 0.65 + k * 0.65;
      V(g, CY(0.27, 0.27, 0.03, 28), 0xd89a4a, px, 1.51, F - 0.55, 0, 0, 0, vcSoft());
      V(g, CY(0.24, 0.24, 0.01, 28), [0xe8b04a, 0xd8602a, 0xf0d070][k], px, 1.53, F - 0.55, 0, 0, 0, vcGloss());
      for (let i = 0; i < 7; i++) V(g, CY(0.03, 0.03, 0.012, 10), k === 1 ? 0x2a6a2a : 0xb8282a, px + Math.cos(i * 0.9 + k) * 0.13, 1.54, F - 0.55 + Math.sin(i * 0.9 + k) * 0.13);
    }
    for (let k = 0; k < 5; k++) V(g, RB(0.42, 0.05, 0.42, 0.01, 1), 0xf4efe4, gx1 - 0.35, 0.6 + k * 0.055, F - 1.25, 0, k * 0.08, 0, vcMat());
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
  solid(site, 0, (G + PH) / 2, (BZ + F) / 2, X1 - X0, G + PH, F - BZ);
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
  A.build();
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
  else buildSmallShop(C, K);
  bake(site.group);
  site.extra.kind = K;
  site.extra.name = name;
  return site;
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
