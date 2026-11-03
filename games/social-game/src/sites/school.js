// 세온 초등학교 (school) and 세온 학원 빌딩 (after-school academy, drawn by 인혁: 태권도 2층, 수학 1층, 건물 입구).
// Site contract: ../site.js (origin = footprint centre at ground level, entrance faces +Z, metres).
import * as THREE from 'three';
import { mat, paint, textured, glow } from '../mat.js';
import { box, cyl, sphere, torus, lathe, extrude, plane, quad, prep, put, group, bake, aabb } from '../geom.js';
import { makeSite, solid } from '../site.js';
import { rng } from '../noise.js';
import { RB, CY, SP, V, D, vcMat, vcGloss, vcSoft, cached, Atlas, txt, rr, lines, pottedPlant, shrub, blackPl, lunchTray } from './office.js';
import { tree } from '../props/nature.js';
import { bicycle } from '../props/japan.js';

const PI = Math.PI;

/* ================================================================== helpers */
function blk(S, g, m, x0, x1, y0, y1, z0, z1, col = true, r = 0.01) {
  if (x1 - x0 < 1e-3 || y1 - y0 < 1e-3 || z1 - z0 < 1e-3) return;
  put(g, RB(x1 - x0, y1 - y0, z1 - z0, r, 1), m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  if (col && S) solid(S, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0);
}
/** Wall running along X (x0..x1, z0..z1) with holes [[a, b, lo, hi]]. */
function wallX(S, g, m, x0, x1, z0, z1, y0, y1, holes = [], col = true) {
  let x = x0;
  for (const [a, b, lo, hi] of [...holes].sort((p, q) => p[0] - q[0])) {
    blk(S, g, m, x, a, y0, y1, z0, z1, col);
    blk(S, g, m, a, b, y0, lo, z0, z1, col);
    blk(S, g, m, a, b, hi, y1, z0, z1, col);
    x = b;
  }
  blk(S, g, m, x, x1, y0, y1, z0, z1, col);
}
/** Wall running along Z (z0..z1, x0..x1) with holes [[a, b, lo, hi]] along z. */
function wallZ(S, g, m, z0, z1, x0, x1, y0, y1, holes = [], col = true) {
  let z = z0;
  for (const [a, b, lo, hi] of [...holes].sort((p, q) => p[0] - q[0])) {
    blk(S, g, m, x0, x1, y0, y1, z, a, col);
    blk(S, g, m, x0, x1, y0, lo, a, b, col);
    blk(S, g, m, x0, x1, hi, y1, a, b, col);
    z = b;
  }
  blk(S, g, m, x0, x1, y0, y1, z, z1, col);
}
const frameM = () => paint(0xeef0ef, 0.38, 0.25);
/** Glazed opening in a wall facing ±Z (centre plane z) from a..b, lo..hi, with mullions. */
function glazeX(g, a, b, lo, hi, z, n = 1, fm = frameM()) {
  D(g, quad(b - a, hi - lo), mat('glass'), (a + b) / 2, (lo + hi) / 2, z);
  put(g, RB(b - a + 0.1, 0.07, 0.14, 0.01, 1), fm, (a + b) / 2, lo, z);
  put(g, RB(b - a + 0.1, 0.07, 0.14, 0.01, 1), fm, (a + b) / 2, hi, z);
  for (let i = 0; i <= n; i++) put(g, RB(0.06, hi - lo, 0.14, 0.01, 1), fm, a + (b - a) * i / n, (lo + hi) / 2, z);
}
function glazeZ(g, a, b, lo, hi, x, n = 1, fm = frameM()) {
  D(g, quad(b - a, hi - lo), mat('glass'), x, (lo + hi) / 2, (a + b) / 2, 0, PI / 2, 0);
  for (const y of [lo, hi]) put(g, RB(0.14, 0.07, b - a + 0.1, 0.01, 1), fm, x, y, (a + b) / 2);
  for (let i = 0; i <= n; i++) put(g, RB(0.14, hi - lo, 0.06, 0.01, 1), fm, x, (lo + hi) / 2, a + (b - a) * i / n);
}
/** Picture window (frame, sill, image of the room behind) on a wall face; ry turns it from facing +Z. */
function picWin(g, A, key, x, y, z, w, h, ry = 0, fm = frameM()) {
  const p = group(g, x, y, z, ry);
  D(p, A.quad(key, w, h), A.win, 0, 0, 0.02);
  for (const s of [-1, 1]) put(p, RB(0.08, h + 0.08, 0.1, 0.01, 1), fm, s * (w / 2 + 0.02), 0, 0.03);
  put(p, RB(w + 0.12, 0.08, 0.1, 0.01, 1), fm, 0, h / 2 + 0.02, 0.03);
  put(p, RB(0.05, h, 0.06, 0.01, 1), fm, 0, 0, 0.05);
  put(p, RB(w + 0.3, 0.06, 0.22, 0.015, 1), paint(0xdcd8cf, 0.6), 0, -h / 2 - 0.05, 0.08);
}
/** Sign panel: rounded box with a canvas face (lit or printed). */
function sign(g, A, key, m, x, y, z, w, h, ry = 0, body = 0xf4f2ec, dep = 0.12) {
  const p = group(g, x, y, z, ry);
  V(p, RB(w + 0.1, h + 0.1, dep, 0.03, 2), body, 0, 0, -dep / 2);
  D(p, A.quad(key, w, h), m, 0, 0, 0.004);
  return p;
}
function stadiumShape(L, r, hole) {
  const s = hole ? new THREE.Path() : new THREE.Shape();
  s.moveTo(-L / 2, -r); s.lineTo(L / 2, -r);
  s.absarc(L / 2, 0, r, -PI / 2, PI / 2, false);
  s.lineTo(-L / 2, r);
  s.absarc(-L / 2, 0, r, PI / 2, PI * 1.5, false);
  return s;
}
function ringGeo(L, r0, r1, h) {
  const s = stadiumShape(L, r1, false);
  s.holes.push(stadiumShape(L, r0, true));
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 24 });
  g.rotateX(-PI / 2);
  return prep(g);
}
function seat(eye, look) {
  const dx = look[0] - eye[0], dy = look[1] - eye[1], dz = look[2] - eye[2];
  return { pos: eye, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}
/** Kid's school backpack, front at +Z. */
function backpack(g, x, y, z, ry, col, s = 1) {
  const p = group(g, x, y, z, ry);
  V(p, RB(0.28 * s, 0.32 * s, 0.13 * s, 0.06 * s, 2), col, 0, 0.16 * s, 0, 0, 0, 0, vcSoft());
  V(p, RB(0.2 * s, 0.13 * s, 0.05 * s, 0.025 * s, 2), new THREE.Color(col).multiplyScalar(0.8).getHex(), 0, 0.1 * s, 0.075 * s, 0, 0, 0, vcSoft());
  V(p, torus(0.05 * s, 0.008, 6, 12, PI), 0x3a3a3c, 0, 0.32 * s, 0);
  V(p, SP(0.018, 10, 8), 0xffd34d, 0.08 * s, 0.25 * s, 0.07 * s);
  return p;
}
/** Small classroom desk + chair. Student sits at local +Z facing -Z. Returns the group. */
function kidDesk(g, x, y, z, ry, R, o = {}) {
  const p = group(g, x, y, z, ry);
  const fr = o.frame ?? 0x5d86a8, seatCol = o.seat ?? 0x5d86a8;
  put(p, RB(0.64, 0.028, 0.46, 0.008, 2), mat('birch'), 0, 0.64, 0);
  V(p, RB(0.6, 0.012, 0.36, 0.004, 1), 0x8a9aa6, 0, 0.53, -0.02);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) V(p, CY(0.013, 0.013, 0.62, 8), fr, sx * 0.28, 0.31, sz * 0.19);
    V(p, RB(0.02, 0.02, 0.4, 0.006, 1), fr, sx * 0.28, 0.08, 0);
    V(p, RB(0.02, 0.09, 0.36, 0.006, 1), 0x8a9aa6, sx * 0.29, 0.58, -0.02);
  }
  // chair
  const cz = 0.42;
  V(p, RB(0.38, 0.022, 0.36, 0.01, 2), seatCol, 0, 0.37, cz, 0, 0, 0, vcGloss());
  V(p, RB(0.36, 0.2, 0.022, 0.01, 2), seatCol, 0, 0.62, cz + 0.17, -0.08, 0, 0, vcGloss());
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) V(p, CY(0.011, 0.011, 0.36, 6), 0x9aa3ab, sx * 0.16, 0.18, cz + sz * 0.15);
    V(p, CY(0.011, 0.011, 0.32, 6), 0x9aa3ab, sx * 0.15, 0.6, cz + 0.175);
  }
  // things on and in the desk
  if (!o.bare) {
    if (R() < 0.8) V(p, RB(0.17, 0.012, 0.24, 0.004, 1), [0xe8604c, 0x4c8be8, 0x58b368, 0xf2c14e][Math.floor(R() * 4)], -0.12 + R() * 0.05, 0.66, 0.02, 0, R() * 0.4 - 0.2, 0);
    if (R() < 0.6) V(p, RB(0.19, 0.03, 0.06, 0.02, 2), [0xff9eb5, 0x7fc8f8, 0xffd166, 0x9b8cf2][Math.floor(R() * 4)], 0.16, 0.67, -0.1, 0, R() * 0.6, 0, vcSoft());
    if (R() < 0.5) V(p, CY(0.004, 0.004, 0.16, 6), 0xf2c14e, 0.1, 0.66, 0.08, PI / 2, 0, R() * 2);
    V(p, RB(0.5, 0.05, 0.2, 0.004, 1), 0xd8d2c6, 0, 0.555, -0.08);
    V(p, RB(0.1, 0.03, 0.002, 0.001, 1), 0xffffff, 0, 0.6, 0.231);
  }
  if (o.bag) backpack(p, 0.33, 0.26, 0, PI / 2, o.bag, 0.9);
  return p;
}
/** Upright piano, back at local z 0, keys at +Z. Returns { keysLocal: [0, 0.725, 0.525] }. */
function piano(g, x, y, z, ry, body) {
  const p = group(g, x, y, z, ry);
  const W = 1.46;
  put(p, RB(W, 0.64, 0.44, 0.015, 2), body, 0, 0.32, 0.22);
  put(p, RB(W, 0.54, 0.31, 0.015, 2), body, 0, 0.97, 0.155);
  put(p, RB(W + 0.04, 0.035, 0.34, 0.012, 2), body, 0, 1.255, 0.17);
  put(p, RB(W, 0.05, 0.3, 0.01, 2), body, 0, 0.665, 0.47);
  for (const s of [-1, 1]) {
    put(p, RB(0.11, 0.16, 0.34, 0.02, 2), body, s * (W / 2 - 0.055), 0.73, 0.45);
    put(p, RB(0.08, 0.64, 0.08, 0.02, 2), body, s * (W / 2 - 0.08), 0.32, 0.58);
    put(p, RB(0.09, 0.05, 0.12, 0.01, 1), body, s * (W / 2 - 0.08), 0.025, 0.6);
  }
  put(p, RB(1.24, 0.1, 0.03, 0.01, 2), body, 0, 0.8, 0.33, -0.25, 0, 0);
  put(p, RB(0.7, 0.03, 0.05, 0.01, 1), body, 0, 0.9, 0.34);
  const wk = paint(0xf7f4ec, 0.28, 0, { clearcoat: 0.5 }), bk = paint(0x111113, 0.3);
  for (let i = 0; i < 52; i++) put(p, RB(0.0222, 0.02, 0.15, 0.002, 1), wk, -0.61 + 0.0235 * (i + 0.5), 0.712, 0.525);
  for (let i = 0; i < 51; i++) { const n = (i + 5) % 7; if (n === 2 || n === 6) continue; put(p, RB(0.012, 0.014, 0.09, 0.002, 1), bk, -0.61 + 0.0235 * (i + 1), 0.727, 0.495); }
  V(p, RB(1.22, 0.012, 0.02, 0.004, 1), 0x8a1c24, 0, 0.705, 0.605);
  for (const s of [-1, 0, 1]) put(p, RB(0.035, 0.012, 0.09, 0.004, 1), mat('gold'), s * 0.06, 0.05, 0.47);
  return p;
}

/* ================================================================== school atlas */
function drawKid(c, w, h, seed) {
  const R = rng(seed);
  c.fillStyle = '#fbf8f0'; c.fillRect(0, 0, w, h);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const sky = ['#bfe3ff', '#ffe9b0', '#d9f2c8'][seed % 3];
  c.fillStyle = sky; c.fillRect(8, 8, w - 16, h * 0.6);
  c.fillStyle = '#7cc56b'; c.fillRect(8, h * 0.62, w - 16, h * 0.34);
  c.fillStyle = '#ffb300'; c.beginPath(); c.arc(w * 0.8, h * 0.2, 20, 0, PI * 2); c.fill();
  c.strokeStyle = '#ffb300'; c.lineWidth = 4;
  for (let i = 0; i < 8; i++) { const a = i * PI / 4; c.beginPath(); c.moveTo(w * 0.8 + Math.cos(a) * 26, h * 0.2 + Math.sin(a) * 26); c.lineTo(w * 0.8 + Math.cos(a) * 36, h * 0.2 + Math.sin(a) * 36); c.stroke(); }
  const kind = seed % 3;
  if (kind === 0) { // house
    c.fillStyle = '#f08a5d'; c.fillRect(w * 0.18, h * 0.42, w * 0.3, h * 0.3);
    c.fillStyle = '#c0392b'; c.beginPath(); c.moveTo(w * 0.14, h * 0.44); c.lineTo(w * 0.33, h * 0.24); c.lineTo(w * 0.52, h * 0.44); c.fill();
    c.fillStyle = '#6d4c41'; c.fillRect(w * 0.29, h * 0.56, w * 0.07, h * 0.16);
  } else if (kind === 1) { // rainbow
    ['#ff5a5a', '#ffa64d', '#ffe14d', '#5ad15a', '#4da6ff', '#8c6bff'].forEach((col, i) => { c.strokeStyle = col; c.lineWidth = 7; c.beginPath(); c.arc(w * 0.45, h * 0.66, w * 0.34 - i * 7, PI, 0); c.stroke(); });
  } else { // family
    for (let i = 0; i < 3; i++) { const fx = w * (0.22 + i * 0.2), s = i === 2 ? 0.7 : 1; c.strokeStyle = '#333'; c.lineWidth = 3; c.beginPath(); c.arc(fx, h * (0.42 + (1 - s) * 0.2), 11 * s, 0, PI * 2); c.stroke(); c.beginPath(); c.moveTo(fx, h * (0.48 + (1 - s) * 0.18)); c.lineTo(fx, h * 0.75); c.moveTo(fx - 14 * s, h * 0.58); c.lineTo(fx + 14 * s, h * 0.58); c.moveTo(fx, h * 0.75); c.lineTo(fx - 9, h * 0.86); c.moveTo(fx, h * 0.75); c.lineTo(fx + 9, h * 0.86); c.stroke(); }
  }
  for (let i = 0; i < 5; i++) { const fx = 20 + R() * (w - 40), fy = h * 0.8 + R() * h * 0.12; c.fillStyle = ['#ff6fa1', '#ffd23f', '#ff7b3f'][i % 3]; c.beginPath(); c.arc(fx, fy, 5, 0, PI * 2); c.fill(); }
  txt(c, ['우리 집', '무지개', '우리 가족', '학교 가는 길', '봄 소풍', '내 꿈'][seed % 6], 14, h - 10, 18, '#444');
}
function drawClock(c, w) {
  c.fillStyle = '#fffdf6'; c.beginPath(); c.arc(w / 2, w / 2, w / 2 - 4, 0, PI * 2); c.fill();
  c.strokeStyle = '#1f4f8f'; c.lineWidth = 10; c.stroke();
  for (let i = 0; i < 12; i++) { const a = i * PI / 6; txt(c, String(i === 0 ? 12 : i), w / 2 + Math.sin(a) * 92, w / 2 - Math.cos(a) * 92 + 2, 30, '#1f2a3a', 'center', 'middle'); }
  c.strokeStyle = '#1f2a3a'; c.lineCap = 'round';
  c.lineWidth = 9; c.beginPath(); c.moveTo(w / 2, w / 2); c.lineTo(w / 2 + 40, w / 2 - 34); c.stroke();
  c.lineWidth = 6; c.beginPath(); c.moveTo(w / 2, w / 2); c.lineTo(w / 2 - 8, w / 2 - 80); c.stroke();
  c.fillStyle = '#e5533d'; c.beginPath(); c.arc(w / 2, w / 2, 9, 0, PI * 2); c.fill();
}
function drawWin(c, w, h, k) {
  const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#fff3dc'); gr.addColorStop(1, '#f0d9b5');
  c.fillStyle = gr; c.fillRect(0, 0, w, h);
  c.fillStyle = '#e8e4da'; c.fillRect(0, 0, w, h * 0.12);
  c.fillStyle = '#fffbea'; c.fillRect(w * 0.2, h * 0.03, w * 0.6, h * 0.04);
  c.fillStyle = '#2f5a45'; if (k === 0) c.fillRect(w * 0.12, h * 0.3, w * 0.5, h * 0.25);
  if (k === 1) { for (let i = 0; i < 6; i++) { c.fillStyle = ['#ffd1dc', '#cde8ff', '#fff2b3'][i % 3]; c.fillRect(w * (0.08 + i * 0.15), h * 0.3, w * 0.11, h * 0.14); } }
  c.fillStyle = '#c9a77a'; for (let i = 0; i < 3; i++) c.fillRect(w * (0.12 + i * 0.28), h * 0.72, w * 0.2, h * 0.05);
  c.fillStyle = '#b8935f'; for (let i = 0; i < 3; i++) c.fillRect(w * (0.14 + i * 0.28), h * 0.77, w * 0.03, h * 0.23);
  // blinds pulled half way
  const bl = k === 2 ? 0.62 : 0.32 + k * 0.1;
  c.fillStyle = '#eef0ee'; c.fillRect(0, 0, w, h * bl);
  c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 2;
  for (let y = 6; y < h * bl; y += 9) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  c.fillStyle = '#9fb2c0'; c.fillRect(0, h * bl - 4, w, 5);
  const sh = c.createLinearGradient(0, 0, w, h); sh.addColorStop(0, 'rgba(255,255,255,0.28)'); sh.addColorStop(0.45, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(120,160,190,0.18)');
  c.fillStyle = sh; c.fillRect(0, 0, w, h);
}
function flag(c, w, h) {
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, r = h * 0.25;
  c.save(); c.translate(cx, cy); c.rotate(Math.atan2(2, 3));
  c.fillStyle = '#cd2e3a'; c.beginPath(); c.arc(0, 0, r, PI, 0); c.fill();
  c.fillStyle = '#0047a0'; c.beginPath(); c.arc(0, 0, r, 0, PI); c.fill();
  c.fillStyle = '#cd2e3a'; c.beginPath(); c.arc(-r / 2, 0, r / 2, 0, PI * 2); c.fill();
  c.fillStyle = '#0047a0'; c.beginPath(); c.arc(r / 2, 0, r / 2, 0, PI * 2); c.fill();
  c.restore();
  c.fillStyle = '#111';
  const tri = (a, pat) => { c.save(); c.translate(cx, cy); c.rotate(a); for (let i = 0; i < 3; i++) { const y = -h * 0.42 + i * h * 0.055; if (pat[i]) c.fillRect(-h * 0.11, y, h * 0.22, h * 0.035); else { c.fillRect(-h * 0.11, y, h * 0.1, h * 0.035); c.fillRect(h * 0.01, y, h * 0.1, h * 0.035); } } c.restore(); };
  const a = Math.atan2(2, 3);
  tri(-PI / 2 + a - PI / 2 + PI / 2 - a * 2 + a, [1, 1, 1]); tri(PI / 2 + a, [0, 0, 0]); tri(-a + PI / 2 - PI, [1, 0, 1]); tri(-a + PI / 2, [0, 1, 0]);
}
function schoolAtlas() {
  return cached('schoolAtlas', () => {
    const A = new Atlas(2048);
    A.add('sName', 1400, 230, (c, w, h) => {
      rr(c, 0, 0, w, h, 30, '#fbfaf6'); rr(c, 10, 10, w - 20, h - 20, 24, null, '#2f6db3', 8);
      c.fillStyle = '#ffb703'; c.beginPath(); c.arc(130, h / 2, 62, 0, PI * 2); c.fill();
      c.fillStyle = '#4caf50'; c.beginPath(); c.ellipse(112, h / 2 - 10, 30, 14, -0.6, 0, PI * 2); c.fill(); c.beginPath(); c.ellipse(150, h / 2 - 10, 30, 14, 0.6, 0, PI * 2); c.fill();
      c.fillStyle = '#2e7d32'; c.fillRect(127, h / 2 - 6, 7, 50);
      txt(c, '세온 초등학교', w / 2 + 70, h / 2 + 8, 150, '#1f4f8f', 'center', 'middle');
    });
    A.add('gName', 1000, 170, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a5da3'); gr.addColorStop(1, '#1f4a86');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#f2d16b'; c.lineWidth = 6; c.strokeRect(10, 10, w - 20, h - 20);
      txt(c, '세온 초등학교', w / 2, h / 2 + 4, 104, '#ffffff', 'center', 'middle');
    });
    A.add('plate', 420, 170, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#c9a35a'); gr.addColorStop(0.5, '#e6c983'); gr.addColorStop(1, '#a8823e');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#7a5a26'; c.lineWidth = 6; c.strokeRect(8, 8, w - 16, h - 16);
      txt(c, '세온 초등학교', w / 2, 76, 58, '#4a3414', 'center', 'middle');
      txt(c, 'SEON ELEMENTARY SCHOOL', w / 2, 128, 26, '#4a3414', 'center', 'middle');
    });
    A.add('clock', 256, 256, drawClock);
    A.add('board', 1024, 308, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#2f5d48'); gr.addColorStop(1, '#2a5240');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      const R = rng(5);
      for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,255,255,${0.02 + R() * 0.03})`; c.beginPath(); c.ellipse(R() * w, R() * h, 30 + R() * 90, 8 + R() * 20, R() * 3, 0, PI * 2); c.fill(); }
      txt(c, '오늘도 즐겁게!', w - 20, 40, 30, 'rgba(255,255,240,0.85)', 'right');
      txt(c, '주번: 하늘, 도윤', w - 20, h - 22, 24, 'rgba(255,255,240,0.75)', 'right');
      txt(c, '★ 받아쓰기 연습', 22, h - 22, 24, 'rgba(255,240,170,0.7)');
    });
    A.add('flag', 300, 200, flag);
    A.add('motto', 640, 150, (c, w, h) => {
      rr(c, 0, 0, w, h, 6, '#6b4529'); rr(c, 12, 12, w - 24, h - 24, 4, '#fbf6ea');
      txt(c, '급훈', w / 2, 52, 34, '#a33a2a', 'center', 'middle');
      txt(c, '서로 돕고 함께 웃자', w / 2, 102, 46, '#2b2620', 'center', 'middle');
    });
    A.add('tt', 360, 470, (c, w, h) => {
      rr(c, 0, 0, w, h, 14, '#fff7e0'); txt(c, '시간표', w / 2, 46, 40, '#c2410c', 'center', 'middle');
      const days = ['월', '화', '수', '목', '금'], subj = ['국어', '수학', '통합', '체육', '음악', '미술', '안전'];
      const R = rng(3);
      days.forEach((d, i) => { rr(c, 30 + i * 62, 80, 54, 40, 6, '#ffd166'); txt(c, d, 57 + i * 62, 101, 26, '#3a2a10', 'center', 'middle'); for (let k = 0; k < 5; k++) { rr(c, 30 + i * 62, 130 + k * 64, 54, 56, 6, ['#cde8ff', '#d9f2c8', '#ffd1dc', '#ece0ff'][(i + k) % 4]); txt(c, subj[Math.floor(R() * subj.length)], 57 + i * 62, 159 + k * 64, 19, '#2b2620', 'center', 'middle'); } });
    });
    for (let i = 0; i < 6; i++) A.add('d' + i, 240, 180, (c, w, h) => drawKid(c, w, h, i + 1));
    for (let k = 0; k < 3; k++) A.add('win' + k, 256, 256, (c, w, h) => drawWin(c, w, h, k));
    A.add('winB', 256, 256, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9cc9ec'); gr.addColorStop(1, '#dcefff');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.fillStyle = '#6aa257'; for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(i * 44, h * 0.78, 40, 0, PI * 2); c.fill(); }
      c.fillStyle = '#4f8a3e'; c.fillRect(0, h * 0.82, w, h);
      c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(0, 0, w, h);
    });
    A.add('menu', 400, 520, (c, w, h) => {
      rr(c, 0, 0, w, h, 16, '#2f5d48'); rr(c, 14, 14, w - 28, h - 28, 10, null, '#d8c7a0', 5);
      txt(c, '오늘의 급식', w / 2, 70, 46, '#ffe08a', 'center', 'middle');
      ['잡곡밥', '미역국', '불고기', '배추김치', '사과', '우유'].forEach((s, i) => txt(c, '· ' + s, 70, 150 + i * 56, 38, '#fbf6ea'));
      txt(c, '골고루 먹어요!', w / 2, h - 36, 26, '#ffd1dc', 'center', 'middle');
    });
    A.add('cafe', 360, 110, (c, w, h) => { rr(c, 0, 0, w, h, 14, '#e8f4e8'); rr(c, 6, 6, w - 12, h - 12, 10, null, '#3f8f5a', 5); txt(c, '급식실', w / 2, h / 2 + 4, 58, '#2e6b40', 'center', 'middle'); });
    A.add('cls', 300, 110, (c, w, h) => { rr(c, 0, 0, w, h, 12, '#fffaf0'); rr(c, 5, 5, w - 10, h - 10, 9, null, '#e07a3a', 5); txt(c, '1학년 1반', w / 2, h / 2 + 4, 52, '#3a2a1a', 'center', 'middle'); });
    A.add('hall', 700, 150, (c, w, h) => {
      rr(c, 0, 0, w, h, 20, '#ffe9a8');
      for (let i = 0; i < 10; i++) { c.fillStyle = ['#ff8fa3', '#7fc8f8', '#9be37f', '#c39bff'][i % 4]; c.beginPath(); c.arc(40 + i * 69, 22, 12, 0, PI * 2); c.fill(); }
      txt(c, '어서 오세요! 세온 초등학교', w / 2, h / 2 + 18, 54, '#7a3b0c', 'center', 'middle');
    });
    A.add('net', 256, 256, (c, w, h) => {
      c.clearRect(0, 0, w, h); c.strokeStyle = '#f4f4f0'; c.lineWidth = 3;
      for (let i = 0; i <= 16; i++) { c.beginPath(); c.moveTo(i * 16, 0); c.lineTo(i * 16, h); c.stroke(); c.beginPath(); c.moveTo(0, i * 16); c.lineTo(w, i * 16); c.stroke(); }
    });
    A.add('cork', 512, 200, (c, w, h) => {
      c.fillStyle = '#c99a62'; c.fillRect(0, 0, w, h);
      const R = rng(9); for (let i = 0; i < 900; i++) { c.fillStyle = R() < 0.5 ? 'rgba(90,50,20,0.18)' : 'rgba(255,235,200,0.18)'; c.fillRect(R() * w, R() * h, 2, 2); }
    });
    A.add('shoeTag', 256, 64, (c, w, h) => { c.fillStyle = '#f7f3e8'; c.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { rr(c, 4 + i * 32, 10, 26, 44, 4, '#fff', '#c7bda8', 2); txt(c, String(i + 1), 17 + i * 32, 34, 20, '#555', 'center', 'middle'); } });
    A.build();
    A.pm = A.printed(0.6);
    A.pm2 = A.printed(0.7); A.pm2.side = THREE.DoubleSide; A.pm2.name = 'schoolNet';
    A.gm = A.lit(1.5, 0x303030);
    A.win = glow(0xffffff, 0.55, A.tex); A.win.roughness = 0.2; A.win.name = 'schoolWin';
    return A;
  });
}

/* ================================================================== 1) 세온 초등학교 */
export function buildSchool() {
  const S = makeSite('school', 60, 40);
  const g = S.group, A = schoolAtlas(), R = rng(17);
  const F = 0.15, CL = 3.45, FH = 3.6, TOP = 10.95;
  const BX0 = -25, BX1 = 19, BZ0 = -19.5, BZ1 = -8.5;
  const brick = mat('brick'), wallUp = mat('plasterWarm'), inner = mat('plaster'), band = paint(0xf3f1ea, 0.6), blue = paint(0x3d7fb8, 0.5);
  const trackM = textured('asphalt', { color: 0xa9503c, seed: 12 }, 4, { roughness: 0.95 });
  const fieldM = textured('sand', { color: 0xcfae7f }, 4);
  const lineM = paint(0xf6f4ee, 0.8);
  // ---------------------------------------------------------------- ground
  put(g, plane(60, 40), mat('grass'), 0, 0.004, 0);
  put(g, plane(BX1 - BX0 + 6.5, 3.2), mat('pavers2'), (BX0 + 25.5) / 2, 0.01, -7.0);
  put(g, plane(10, 25.2), mat('pavers2'), 24.5, 0.01, 7.0);
  put(g, plane(46.5, 23.3), fieldM, -4.75, 0.012, 6.15);
  for (const [x, z, w, d] of [[-4.75, -5.45, 46.6, 0.16], [-4.75, 17.75, 46.6, 0.16], [-28.0, 6.15, 0.16, 23.4], [18.5, 6.15, 0.16, 23.4]]) put(g, RB(w, 0.1, d, 0.02, 1), mat('concrete'), x, 0.05, z);
  // running track (stadium ring) with lane lines
  const TX = -5, TZ = 6.3, TL = 15;
  put(g, ringGeo(TL, 5.0, 7.4, 0.02), trackM, TX, 0.012, TZ);
  for (const r of [5.0, 6.2, 7.4]) put(g, ringGeo(TL, r - 0.03, r + 0.03, 0.004), lineM, TX, 0.033, TZ);
  for (let i = 0; i < 2; i++) put(g, box(0.08, 0.004, 1.15), lineM, TX - 1, 0.034, TZ + 5.6 + i * 1.2);
  put(g, ringGeo(0, 1.9, 1.98, 0.004), lineM, TX, 0.016, TZ);
  put(g, box(0.06, 0.004, 9.6), lineM, TX, 0.016, TZ);
  // mini goals at both ends of the field
  for (const s of [-1, 1]) {
    const gp = group(g, TX + s * 10.9, 0, TZ, s > 0 ? -PI / 2 : PI / 2);
    for (const x of [-1.5, 1.5]) { put(gp, CY(0.045, 0.045, 1.8, 12), lineM, x, 0.9, 0); put(gp, CY(0.03, 0.03, 1.1, 8), lineM, x, 0.95, -0.55, 0.85, 0, 0); }
    put(gp, CY(0.045, 0.045, 3.05, 12), lineM, 0, 1.8, 0, 0, 0, PI / 2);
    put(gp, CY(0.03, 0.03, 3.0, 8), lineM, 0, 0.03, -1.0, 0, 0, PI / 2);
    D(gp, A.quad('net', 3.0, 1.8), A.pm2, 0, 0.9, -0.5, -0.5, 0, 0);
    for (const x of [-1.5, 1.5]) { const q = D(gp, A.quad('net', 1.0, 1.8), A.pm2, x, 0.9, -0.5, 0, PI / 2, 0); q.scale.set(1, 1, 1); }
  }
  const balls = [[TX + 2, TZ + 1.5], [TX - 6.5, TZ - 2.2]];
  for (const [x, z] of balls) { V(g, SP(0.11, 16, 12), 0xf5f5f0, x, 0.12, z, 0, 0, 0, vcGloss()); V(g, SP(0.112, 6, 4), 0x222222, x, 0.12, z, 0.3, 0.3, 0, vcMat()); }
  // swings (right side)
  {
    const sw = group(g, 14.6, 0, 1.5, 0), red = paint(0xd9483b, 0.4, 0.3), steelM = mat('steel');
    for (const x of [-2.4, 2.4]) for (const s of [-1, 1]) put(sw, CY(0.06, 0.06, 2.75, 12), red, x, 1.3, s * 0.55, s * 0.4, 0, 0);
    put(sw, CY(0.07, 0.07, 5.0, 14), red, 0, 2.55, 0, 0, 0, PI / 2);
    for (const x of [-1.2, 0, 1.2]) {
      for (const dx of [-0.2, 0.2]) put(sw, CY(0.008, 0.008, 2.05, 6), steelM, x + dx, 1.5, 0);
      V(sw, RB(0.5, 0.05, 0.2, 0.02, 2), [0xf2c14e, 0x4c8be8, 0x58b368][Math.round(x / 1.2) + 1], x, 0.47, 0, 0, 0, 0, vcGloss());
    }
    put(g, plane(5.6, 2.6), paint(0x6b8f4a, 0.95), 14.6, 0.016, 1.5);
    solid(S, 14.6, 1.3, 1.5, 5.2, 2.6, 1.4);
  }
  // jungle gym with slide (right side)
  {
    const jg = group(g, 14.6, 0, 10.5, 0);
    const cols = [0xe4573d, 0xf2b632, 0x3f86c6, 0x4fae5c];
    const n = 4, sp = 0.8, half = (n - 1) * sp / 2;
    for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) V(jg, CY(0.035, 0.035, 2.0, 10), cols[(i + k) % 4], -half + i * sp, 1.0, -half + k * sp, 0, 0, 0, vcGloss());
    for (let lv = 1; lv <= 3; lv++) for (let i = 0; i < n; i++) {
      V(jg, CY(0.03, 0.03, half * 2, 8), cols[(lv + i) % 4], -half + i * sp, lv * 0.65, 0, PI / 2, 0, 0, vcGloss());
      V(jg, CY(0.03, 0.03, half * 2, 8), cols[(lv + i + 1) % 4], 0, lv * 0.65, -half + i * sp, 0, 0, PI / 2, vcGloss());
    }
    V(jg, RB(sp * 2, 0.06, sp * 2, 0.02, 2), 0x3f86c6, -half + sp, 1.97, -half + sp, 0, 0, 0, vcGloss());
    const sl = group(jg, half + 0.05, 1.95, 0, 0);
    V(sl, RB(2.6, 0.04, 0.6, 0.02, 2), 0xf2b632, 1.15, -0.95, 0, 0, 0, -0.72, vcGloss());
    for (const s of [-1, 1]) V(sl, RB(2.6, 0.18, 0.04, 0.02, 2), 0xe4573d, 1.15, -0.87, s * 0.3, 0, 0, -0.72, vcGloss());
    put(g, plane(6.4, 4.2), paint(0x6b8f4a, 0.95), 15.4, 0.016, 10.5);
    solid(S, 14.6, 1.0, 10.5, 2.6, 2.0, 2.6);
    solid(S, 16.3, 0.5, 10.5, 1.9, 1.0, 0.7);
  }
  // pull-up bars + benches (left side)
  for (let i = 0; i < 3; i++) {
    const x = -24.6, z = 2 + i * 1.3, h = 1.1 + i * 0.35;
    for (const s of [-1, 1]) put(g, CY(0.05, 0.05, h, 12), paint(0x3f86c6, 0.4, 0.3), x, h / 2, z + s * 0.6);
    put(g, CY(0.025, 0.025, 1.2, 8), mat('steel'), x, h - 0.05, z, PI / 2, 0, 0);
  }
  solid(S, -24.6, 0.9, 3.3, 0.3, 1.8, 3.9);
  for (const [x, z, ry] of [[-25.5, 11.5, PI / 2], [-25.5, 14.8, PI / 2], [6, 16.6, PI]]) {
    const b = group(g, x, 0, z, ry);
    put(b, RB(1.8, 0.06, 0.42, 0.02, 2), mat('oak'), 0, 0.45, 0);
    put(b, RB(1.8, 0.32, 0.05, 0.02, 2), mat('oak'), 0, 0.72, -0.2, -0.12, 0, 0);
    for (const s of [-0.75, 0.75]) put(b, RB(0.06, 0.45, 0.4, 0.02, 1), paint(0x3a3c40, 0.5, 0.4), s, 0.225, 0);
    solid(S, x, 0.45, z, ry ? 0.5 : 1.8, 0.9, ry ? 1.8 : 0.5);
  }
  // ---------------------------------------------------------------- fence, gate
  const GX0 = 19.5, GX1 = 25.5, FZ = 19.6;
  const rail = paint(0x2f6b4f, 0.45, 0.4);
  const fenceRun = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(-(z1 - z0), x1 - x0);
    const fg = group(g, (x0 + x1) / 2, 0, (z0 + z1) / 2, ry);
    put(fg, RB(L, 0.5, 0.3, 0.02, 1), brick, 0, 0.25, 0);
    put(fg, RB(L + 0.04, 0.06, 0.36, 0.02, 1), mat('concrete'), 0, 0.53, 0);
    for (const y of [0.68, 1.48]) put(fg, RB(L, 0.04, 0.04, 0.01, 1), rail, 0, y, 0);
    for (let u = -L / 2 + 0.08; u < L / 2; u += 0.15) put(fg, box(0.022, 1.0, 0.022), rail, u, 1.06, 0);
    for (let u = -L / 2; u <= L / 2 + 0.01; u += L / Math.max(1, Math.round(L / 3))) put(fg, RB(0.07, 1.1, 0.07, 0.01, 1), rail, u, 1.1, 0);
    if (Math.abs(z1 - z0) < 0.01) solid(S, (x0 + x1) / 2, 0.8, z0, L, 1.6, 0.3); else solid(S, x0, 0.8, (z0 + z1) / 2, 0.3, 1.6, L);
  };
  fenceRun(-29.7, FZ, GX0 - 0.5, FZ);
  fenceRun(GX1 + 0.5, FZ, 29.7, FZ);
  fenceRun(-29.7, -8.2, -29.7, FZ);
  fenceRun(29.7, -8.2, 29.7, FZ);
  for (const x of [GX0 - 0.45, GX1 + 0.45]) {
    blk(S, g, brick, x - 0.45, x + 0.45, 0, 3.6, FZ - 0.45, FZ + 0.45, true, 0.03);
    put(g, RB(1.0, 0.12, 1.0, 0.03, 2), mat('concrete'), x, 3.64, FZ);
  }
  put(g, RB(GX1 - GX0 + 2.0, 0.85, 0.5, 0.05, 2), band, (GX0 + GX1) / 2, 4.12, FZ);
  D(g, A.quad('gName', 5.4, 0.62), A.gm, (GX0 + GX1) / 2, 4.12, FZ + 0.255);
  D(g, A.quad('gName', 5.4, 0.62), A.gm, (GX0 + GX1) / 2, 4.12, FZ - 0.255, 0, PI, 0);
  D(g, A.quad('plate', 0.72, 0.29), A.pm, GX0 - 0.45, 1.75, FZ + 0.452);
  put(g, RB(0.8, 0.36, 0.03, 0.01, 1), paint(0x6a4c22, 0.4, 0.6), GX0 - 0.45, 1.75, FZ + 0.44);
  S.nightGlow.push(A.gm);
  // ---------------------------------------------------------------- trees, flower beds, bikes, lamps
  const trees = [[-27.6, -4.5, 1], [-27.4, 16.8, 2], [-12, 18.2, 3], [28.0, 1.0, 5], [28.0, -5.5, 6]];
  for (const [x, z, s] of trees) { const t = tree({ kind: 'round', seed: s }); t.position.set(x, 0, z); t.rotation.y = s; g.add(t); solid(S, x, 1.5, z, 0.5, 3, 0.5); }
  for (let i = 0; i < 7; i++) {
    const x0 = -24.3 + i * 3.3;
    blk(S, g, brick, x0, x0 + 2.8, 0, 0.32, BZ1 + 0.05, BZ1 + 0.95, true, 0.02);
    put(g, plane(2.7, 0.8), mat('dirt'), x0 + 1.4, 0.325, BZ1 + 0.5);
    for (let k = 0; k < 2; k++) shrub(g, x0 + 0.75 + k * 1.3, 0.3, BZ1 + 0.5, 0.42, i * 3 + k + 1, 6);
  }
  for (const x of [14.3, 16.8]) { blk(S, g, brick, x - 0.9, x + 0.9, 0, 0.32, BZ1 + 0.05, BZ1 + 0.95, true, 0.02); put(g, plane(1.7, 0.8), mat('dirt'), x, 0.325, BZ1 + 0.5); shrub(g, x - 0.4, 0.3, BZ1 + 0.5, 0.36, Math.round(x * 3), 6); shrub(g, x + 0.45, 0.3, BZ1 + 0.5, 0.34, Math.round(x * 5), 4); }
  // bike rack by the building corner
  for (let i = 0; i < 5; i++) put(g, torus(0.38, 0.025, 8, 20, PI), mat('steel'), 26.5, 0.02, -3.6 + i * 0.7, 0, PI / 2, 0);
  for (const [z, col] of [[-3.25, 0x5aa9e6], [-1.85, 0xf2a7c3]]) { const b = bicycle({ color: col }).clone(); b.position.set(26.45, 0, z); b.rotation.y = PI / 2; g.add(b); }
  solid(S, 26.5, 0.5, -2.2, 1.8, 1.0, 3.4);
  const warm = mat('lampGlow').clone(); warm.name = 'schoolWarm';
  for (const [x, z] of [[19.2, 12.5], [19.2, 2.5], [9.0, -6.2], [-8.0, -6.2]]) {
    put(g, CY(0.07, 0.09, 4.2, 12), paint(0x2d3036, 0.5, 0.5), x, 2.1, z);
    put(g, lathe([[0.03, 0], [0.24, -0.05], [0.28, -0.16], [0.03, -0.12]], 20), paint(0x2d3036, 0.5, 0.5), x, 4.35, z);
    D(g, SP(0.13, 16, 10), warm, x, 4.18, z);
    solid(S, x, 2.1, z, 0.2, 4.2, 0.2);
    S.lamps.push({ pos: [x, 4.0, z], color: 0xffd9a0, intensity: 6, range: 12 });
  }
  S.nightGlow.push(warm);
  // parking strip for the school car (inside the gate, right)
  for (const x of [25.8, 28.4]) put(g, box(0.1, 0.004, 4.8), lineM, x, 0.016, 13.6);
  S.parking = { pos: [27.1, 0, 13.6], yaw: 0 };
  // ---------------------------------------------------------------- building shell
  blk(S, g, mat('concrete'), BX0, BX1, 0, F, BZ0, BZ1, true, 0.02);
  // outer walls: ground floor brick, upper floors plaster
  const T = 0.25;
  const classWin = [[-0.7, 8.7, 0.95, 3.0]], hallOpen = [[10.2, 12.8, 0, 2.95]], cafeWin = [[14.4, 18.4, 1.0, 2.9]];
  wallX(S, g, brick, BX0, BX1, BZ1 - T, BZ1, 0, FH, [...classWin, ...hallOpen, ...cafeWin]);
  wallX(S, g, brick, BX0, BX1, BZ0, BZ0 + T, 0, FH);
  wallZ(S, g, brick, BZ0, BZ1, BX0, BX0 + T, 0, FH);
  wallZ(S, g, brick, BZ0, BZ1, BX1 - T, BX1, 0, FH, [[-15.4, -10.0, 1.0, 2.9]]);
  blk(S, g, wallUp, BX0, BX1, FH, TOP, BZ1 - T, BZ1, true);
  blk(S, g, wallUp, BX0, BX1, FH, TOP, BZ0, BZ0 + T, true);
  blk(S, g, wallUp, BX0, BX0 + T, FH, TOP, BZ0, BZ1, true);
  blk(S, g, wallUp, BX1 - T, BX1, FH, TOP, BZ0, BZ1, true);
  blk(S, g, mat('concrete'), BX0, BX1, TOP - 0.2, TOP, BZ0, BZ1, false);
  // parapet, bands, accent stripe
  for (const [x0, x1, z0, z1] of [[BX0 - 0.05, BX1 + 0.05, BZ1 - 0.25, BZ1 + 0.05], [BX0 - 0.05, BX1 + 0.05, BZ0 - 0.05, BZ0 + 0.25], [BX0 - 0.05, BX0 + 0.25, BZ0, BZ1], [BX1 - 0.25, BX1 + 0.05, BZ0, BZ1]]) blk(null, g, band, x0, x1, TOP, TOP + 0.55, z0, z1, false, 0.03);
  for (const y of [FH, FH * 2]) {
    put(g, RB(BX1 - BX0 + 0.16, 0.3, 0.16, 0.03, 2), band, (BX0 + BX1) / 2, y, BZ1 + 0.05);
    put(g, RB(0.16, 0.3, BZ1 - BZ0 + 0.16, 0.03, 2), band, BX1 + 0.05, y, (BZ0 + BZ1) / 2);
    put(g, RB(0.16, 0.3, BZ1 - BZ0 + 0.16, 0.03, 2), band, BX0 - 0.05, y, (BZ0 + BZ1) / 2);
  }
  put(g, RB(BX1 - BX0 + 0.12, 0.12, 0.1, 0.02, 1), blue, (BX0 + BX1) / 2, TOP - 0.35, BZ1 + 0.05);
  put(g, RB(0.1, 0.12, BZ1 - BZ0 + 0.12, 0.02, 1), blue, BX1 + 0.05, TOP - 0.35, (BZ0 + BZ1) / 2);
  // upper-floor windows (front, sides) and ground floor of the closed left block
  for (let fl = 1; fl <= 2; fl++) {
    const y = fl * FH + 1.85;
    for (let x = -23.4; x < BX1 - 1; x += 3.0) { if (x > 8.8 && x < 14.2) continue; picWin(g, A, 'win' + ((Math.round(x) + fl) % 3 + 3) % 3, x, y, BZ1, 2.5, 1.9); }
    for (const z of [-16.5, -11.5]) { picWin(g, A, 'win' + fl % 3, BX1, y, z, 2.6, 1.65, PI / 2); picWin(g, A, 'win' + (fl + 1) % 3, BX0, y, z, 2.6, 1.65, -PI / 2); }
  }
  for (let x = -23.4; x < -2; x += 3.0) picWin(g, A, 'win2', x, 1.95, BZ1, 2.2, 1.6);
  for (const z of [-16.5, -11.5]) picWin(g, A, 'win1', BX0, 1.95, z, 2.6, 1.6, -PI / 2);
  // entrance tower with the clock
  const TW0 = 9.4, TW1 = 13.6;
  blk(S, g, band, TW0, TW1, FH, TOP + 2.0, BZ1 - 0.2, BZ1 + 0.9, true, 0.04);
  put(g, RB(TW1 - TW0 + 0.3, 0.25, 1.4, 0.04, 2), blue, (TW0 + TW1) / 2, TOP + 2.1, BZ1 + 0.35);
  put(g, CY(0.95, 0.95, 0.18, 40), paint(0x1f4f8f, 0.4, 0.2), (TW0 + TW1) / 2, TOP + 0.75, BZ1 + 0.95, PI / 2, 0, 0);
  D(g, A.quad('clock', 1.7, 1.7), A.pm, (TW0 + TW1) / 2, TOP + 0.75, BZ1 + 1.045);
  D(g, A.quad('winB', 2.4, 5.6), A.win, (TW0 + TW1) / 2, FH + 3.6, BZ1 + 0.905);
  for (let i = 0; i <= 3; i++) put(g, RB(0.07, 5.7, 0.08, 0.01, 1), frameM(), TW0 + 0.9 + i * 0.8, FH + 3.6, BZ1 + 0.93);
  for (let i = 0; i <= 3; i++) put(g, RB(2.5, 0.07, 0.08, 0.01, 1), frameM(), (TW0 + TW1) / 2, FH + 0.8 + i * 1.86, BZ1 + 0.93);
  // rooftop name sign
  {
    const sg = group(g, -9, TOP + 0.55, BZ1 + 0.25, 0);
    for (const x of [-5.5, -2, 2, 5.5]) put(sg, RB(0.1, 1.3, 0.1, 0.01, 1), paint(0x8a9096, 0.45, 0.6), x, 0.65, -0.25);
    sign(sg, A, 'sName', A.gm, 0, 0.82, 0, 12.6, 2.07, 0, 0xf4f2ec, 0.16);
  }
  // entrance canopy
  put(g, RB(5.2, 0.22, 2.6, 0.04, 2), band, 11.5, 3.1, BZ1 + 1.25);
  for (const x of [9.2, 13.8]) put(g, CY(0.09, 0.09, 3.0, 16), band, x, 1.5, BZ1 + 2.35);
  D(g, CY(0.25, 0.25, 0.02, 20), warm, 11.5, 2.985, BZ1 + 1.2);
  S.lamps.push({ pos: [11.5, 2.7, BZ1 + 1.2], color: 0xffd9a0, intensity: 5, range: 8 });
  blk(S, g, mat('concrete'), 9.0, 14.0, 0, F, BZ1, BZ1 + 2.6, true, 0.02);
  // ---------------------------------------------------------------- ground floor interior
  const CX0 = -1.0, CX1 = 9.0, CZ0 = -16.25, CZ1 = BZ1 - T; // classroom
  const KX0 = 14.0, KX1 = BX1 - T;                           // cafeteria
  // floors + ceiling
  put(g, plane(CX1 - CX0, CZ1 - CZ0), mat('oakFloor'), (CX0 + CX1) / 2, F + 0.002, (CZ0 + CZ1) / 2);
  put(g, plane(KX1 - CX0, CZ0 - BZ0 - T), mat('floorTile'), (CX0 + KX1) / 2, F + 0.002, (BZ0 + T + CZ0) / 2);
  put(g, plane(KX1 - CX1, CZ1 - CZ0), mat('floorTile'), (CX1 + KX1) / 2, F + 0.002, (CZ0 + CZ1) / 2);
  put(g, plane(KX1 - CX0 + 0.3, BZ1 - BZ0).rotateX(PI), paint(0xf4f3ef, 0.9), (CX0 + KX1) / 2, CL - 0.003, (BZ0 + BZ1) / 2);
  blk(null, g, mat('concrete'), CX0 - 0.3, KX1, CL, FH, BZ0, BZ1, false, 0.01);
  S.indoor.push(aabb(CX0, F, BZ0 + T, KX1, CL, BZ1 - T + 0.05));
  // walls: classroom left end, classroom/현관, 현관/cafeteria, corridor partition
  wallZ(S, g, inner, BZ0 + T, BZ1 - T, CX0 - 0.25, CX0, F, CL);
  wallZ(S, g, inner, CZ0, CZ1, CX1, CX1 + 0.25, F, CL);
  wallZ(S, g, inner, CZ0, CZ1, 13.75, 14.0, F, CL, [[-12.9, -11.3, F, 2.4]]);
  wallX(S, g, inner, CX0, CX1, CZ0 - 0.25, CZ0, F, CL, [[0.0, 1.2, F, 2.2], [7.3, 8.5, F, 2.2], [1.6, 6.9, 2.45, 3.1]]);
  glazeX(g, 1.6, 6.9, 2.45, 3.1, CZ0 - 0.125, 4);
  wallX(S, g, inner, 14.0, KX1, CZ0 - 0.25, CZ0, F, CL, [[15.0, 16.5, F, 2.3]]);
  // interior linings on the brick walls
  wallX(null, g, inner, CX0, KX1, BZ1 - T - 0.02, BZ1 - T, F, CL, [...classWin, [9.25, 13.75, F, CL], ...cafeWin], false);
  wallX(null, g, inner, CX0, KX1, BZ0 + T, BZ0 + T + 0.02, F, CL, [], false);
  wallZ(null, g, inner, BZ0, BZ1, KX1 - 0.02, KX1, F, CL, [[-15.4, -10.0, 1.0, 2.9]], false);
  glazeX(g, -0.7, 8.7, 0.95, 3.0, BZ1 - T / 2, 6);
  glazeX(g, 14.4, 18.4, 1.0, 2.9, BZ1 - T / 2, 3);
  glazeZ(g, -15.4, -10.0, 1.0, 2.9, BX1 - T / 2, 4);
  // 현관 opening: side glass + threshold
  put(g, RB(2.7, 0.06, 0.3, 0.01, 1), mat('steel'), 11.5, F + 0.01, BZ1 - T / 2);
  for (const x of [10.15, 12.85]) put(g, RB(0.12, 2.95, 0.3, 0.02, 1), frameM(), x, 1.5, BZ1 - T / 2);
  // wainscots
  const wain = paint(0x8db8a2, 0.55), wood = mat('birch');
  wallX(null, g, wood, CX0, CX1, CZ0 + 0.0, CZ0 + 0.03, F, F + 1.0, [[0.0, 1.2, F, 2.2], [7.3, 8.5, F, 2.2]], false);
  wallX(null, g, wain, CX0, KX1, BZ0 + T + 0.02, BZ0 + T + 0.05, F, F + 1.1, [], false);
  wallX(null, g, wain, CX0, CX1, CZ0 - 0.28, CZ0 - 0.25, F, F + 1.1, [[0.0, 1.2, F, 2.2], [7.3, 8.5, F, 2.2]], false);
  // ceiling light panels
  const lightPanel = (x, z, ry = 0) => { D(g, RB(1.25, 0.04, 0.32, 0.01, 1), frameM(), x, CL - 0.02, z, 0, ry, 0); D(g, box(1.15, 0.01, 0.24), mat('coolGlow'), x, CL - 0.045, z, 0, ry, 0); };
  for (const x of [1.5, 5.5]) for (const z of [-14.3, -10.7]) { lightPanel(x, z, PI / 2); S.lamps.push({ pos: [x, CL - 0.3, z], color: 0xf4f6ff, intensity: 4, range: 7 }); }
  for (const x of [2, 8, 15]) { lightPanel(x, -17.9); S.lamps.push({ pos: [x, CL - 0.3, -17.9], color: 0xf4f6ff, intensity: 3, range: 6 }); }
  lightPanel(11.5, -12.5, PI / 2); S.lamps.push({ pos: [11.5, CL - 0.3, -12.5], color: 0xfff1d8, intensity: 4, range: 7 });
  for (const z of [-14.2, -10.8]) { lightPanel(16.4, z, PI / 2); S.lamps.push({ pos: [16.4, CL - 0.3, z], color: 0xfff1d8, intensity: 4, range: 6 }); }
  // ---------------------------------------------------------------- classroom 1학년 1반
  const BC = [CX0 + 0.066, 1.65, (CZ0 + CZ1) / 2]; // chalkboard face centre
  put(g, RB(0.06, 1.36, 4.16, 0.015, 2), paint(0xb8bcc0, 0.35, 0.7), CX0 + 0.03, BC[1], BC[2]);
  D(g, A.quad('board', 4.0, 1.2), A.pm, BC[0], BC[1], BC[2], 0, PI / 2, 0);
  put(g, RB(0.12, 0.03, 4.1, 0.01, 1), paint(0xb8bcc0, 0.35, 0.7), CX0 + 0.08, BC[1] - 0.66, BC[2]);
  for (let i = 0; i < 6; i++) V(g, CY(0.006, 0.006, 0.07, 6), [0xffffff, 0xffe14d, 0xff8fa3][i % 3], CX0 + 0.09, BC[1] - 0.635, BC[2] - 1.6 + i * 0.12 + (i > 2 ? 2.2 : 0), PI / 2, 0, 0);
  V(g, RB(0.05, 0.05, 0.13, 0.01, 1), 0x6b4a2e, CX0 + 0.09, BC[1] - 0.62, BC[2] + 1.2);
  D(g, A.quad('flag', 0.6, 0.4), A.pm, CX0 + 0.03, 2.75, BC[2], 0, PI / 2, 0);
  put(g, RB(0.03, 0.46, 0.66, 0.01, 1), mat('walnut'), CX0 + 0.012, 2.75, BC[2]);
  D(g, A.quad('motto', 1.3, 0.3), A.pm, CX0 + 0.02, 2.75, BC[2] - 1.55, 0, PI / 2, 0);
  D(g, A.quad('tt', 0.6, 0.78), A.pm, CX0 + 0.02, 1.6, BC[2] - 2.95, 0, PI / 2, 0);
  { const ck = group(g, CX0 + 0.02, 2.75, BC[2] + 1.45, PI / 2); put(ck, CY(0.2, 0.2, 0.04, 32), blackPl(), 0, 0, 0.02, PI / 2, 0, 0); D(ck, A.quad('clock', 0.36, 0.36), A.pm, 0, 0, 0.042); }
  // TV on the wall by the window side
  put(g, RB(0.07, 0.72, 1.24, 0.02, 2), blackPl(), CX0 + 0.06, 1.75, BC[2] + 2.85);
  D(g, quad(1.16, 0.64), paint(0x1a1d22, 0.2), CX0 + 0.1, 1.75, BC[2] + 2.85, 0, PI / 2, 0);
  // teacher's desk
  {
    const td = group(g, 0.85, F, -9.8, PI);
    put(td, RB(1.4, 0.04, 0.72, 0.01, 2), mat('oak'), 0, 0.74, 0);
    put(td, RB(0.45, 0.7, 0.68, 0.01, 2), paint(0xd8dbd6, 0.5, 0.2), -0.45, 0.36, 0);
    put(td, RB(1.36, 0.6, 0.02, 0.01, 1), paint(0xd8dbd6, 0.5, 0.2), 0, 0.42, -0.34);
    put(td, RB(0.04, 0.7, 0.66, 0.01, 1), paint(0xd8dbd6, 0.5, 0.2), 0.66, 0.36, 0);
    put(td, RB(0.5, 0.3, 0.03, 0.01, 2), blackPl(), 0.25, 1.0, -0.2, 0, 0.5, 0);
    put(td, CY(0.02, 0.02, 0.15, 8), blackPl(), 0.25, 0.83, -0.2);
    V(td, RB(0.28, 0.02, 0.2, 0.004, 1), 0x2f6db3, -0.25, 0.77, 0.12, 0, 0.2, 0);
    for (let i = 0; i < 4; i++) V(td, RB(0.22, 0.012, 0.3, 0.003, 1), 0xf6f3ea, -0.45, 0.77 + i * 0.013, -0.1, 0, i * 0.08, 0);
    V(td, CY(0.04, 0.035, 0.11, 14), 0xe8604c, 0.55, 0.81, 0.15, 0, 0, 0, vcGloss());
    V(td, SP(0.045, 14, 10), 0xd23a2a, 0.0, 0.81, 0.2, 0, 0, 0, vcGloss());
    solid(S, 0.85, F + 0.4, -9.8, 1.4, 0.8, 0.72);
  }
  // 16 desks: 4 rows (x) x 4 (z), students face -X (the board)
  const rowsX = [3.0, 4.4, 5.8, 7.2], colsZ = [-14.3, -13.6, -11.4, -10.7];
  const PX = 4.4, PZ = -11.4; // the player's desk
  const bagCols = [0xe8604c, 0x4c8be8, 0xf2c14e, 0x58b368, 0xff9eb5, 0x9b8cf2, 0x45b5aa];
  const seatCols = [0x5d86a8, 0xe0874a, 0x58a36e, 0xd9b44a];
  const kidSeats = [];
  rowsX.forEach((x, ri) => colsZ.forEach((z, ci) => {
    const mine = x === PX && z === PZ;
    kidDesk(g, x, F, z, PI / 2, R, { seat: seatCols[(ri + ci) % 4], frame: 0x6f8fa8, bag: mine ? null : bagCols[(ri * 4 + ci) % 7], bare: false });
    solid(S, x, F + 0.35, z, 0.46, 0.7, 0.64);
    if (!mine) kidSeats.push([x + 0.42, z]);
  }));
  // my desk: name tag, open notebook, pencil
  V(g, RB(0.32, 0.006, 0.22, 0.002, 1), 0xfbfaf4, PX, F + 0.658, PZ, 0, 0.1, 0);
  V(g, box(0.004, 0.007, 0.21), 0xd0c8b8, PX, F + 0.66, PZ, 0, 0.1, 0);
  // cubbies with backpacks on the back wall
  {
    const cb = group(g, CX1 - 0.2, F, (CZ0 + CZ1) / 2, -PI / 2);
    const W = 5.8, H = 1.05, Dp = 0.4, n = 9;
    put(cb, RB(W, 0.03, Dp, 0.01, 1), wood, 0, H, 0);
    put(cb, RB(W, 0.03, Dp, 0.01, 1), wood, 0, 0.06, 0);
    put(cb, RB(W, 0.03, Dp, 0.01, 1), wood, 0, H / 2 + 0.03, 0);
    put(cb, RB(W, H, 0.02, 0.005, 1), paint(0xf3eadb, 0.6), 0, H / 2, -Dp / 2);
    for (let i = 0; i <= n; i++) put(cb, RB(0.03, H, Dp, 0.008, 1), wood, -W / 2 + i * W / n, H / 2, 0);
    for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) {
      const x = -W / 2 + (i + 0.5) * W / n, y = 0.08 + k * 0.5;
      if (R() < 0.7) backpack(cb, x, y, -0.02, 0, bagCols[(i * 2 + k) % 7], 0.85);
      else { V(cb, RB(0.18, 0.24, 0.03, 0.004, 1), [0xe8604c, 0x4c8be8, 0x58b368][i % 3], x - 0.08, y + 0.12, -0.1, 0, 0, 0.12); V(cb, RB(0.2, 0.12, 0.26, 0.04, 2), 0xf4f4f0, x + 0.05, y + 0.06, 0, 0, 0, 0, vcSoft()); }
    }
    solid(S, CX1 - 0.2, F + 0.55, (CZ0 + CZ1) / 2, 0.42, 1.1, 5.8);
    // drawings board above
    D(cb, A.quad('cork', 5.2, 1.15), A.pm, 0, 2.05, -0.17);
    put(cb, RB(5.3, 1.25, 0.03, 0.01, 1), wood, 0, 2.05, -0.19);
    for (let i = 0; i < 7; i++) D(cb, A.quad('d' + (i % 6), 0.56, 0.42), A.pm, -2.1 + i * 0.7, 2.05 + (i % 2 ? 0.25 : -0.22), -0.155, 0, 0, (R() - 0.5) * 0.08);
  }
  // window wall: curtains, plants on the sill, umbrella
  for (const [x, col] of [[-0.55, 0xf4e6c8], [8.55, 0xf4e6c8], [4.0, 0xf4e6c8]]) for (let k = 0; k < 4; k++) V(g, CY(0.07, 0.09, 2.05, 10), col, x + (k - 1.5) * 0.09, 1.95, CZ1 - 0.12, 0, 0, 0, vcSoft());
  put(g, CY(0.015, 0.015, 9.6, 8), mat('steel'), 4.0, 3.05, CZ1 - 0.12, 0, 0, PI / 2);
  put(g, RB(9.4, 0.04, 0.26, 0.01, 1), wood, 4.0, 0.95, CZ1 - 0.13);
  for (const x of [0.6, 2.4, 6.0, 7.6]) pottedPlant(g, x, 0.97, CZ1 - 0.14, { kind: 'fig', h: 0.35, seed: Math.round(x * 3), potR: 0.07, potH: 0.12, pot: 'terracotta' });
  // shelves near the door with books and a globe
  {
    const sh = group(g, CX1 - 0.25, F, -15.8, -PI / 2);
    put(sh, RB(0.8, 1.4, 0.35, 0.01, 2), wood, 0, 0.7, 0);
    put(sh, RB(0.84, 0.02, 0.3, 0.005, 1), paint(0xf3eadb, 0.6), 0, 0.7, 0.03);
    for (let i = 0; i < 11; i++) V(sh, RB(0.05, 0.22 + R() * 0.06, 0.2, 0.004, 1), [0xe8604c, 0x4c8be8, 0x58b368, 0xf2c14e, 0x9b8cf2][i % 5], -0.33 + i * 0.065, 0.84, 0.03);
    V(sh, SP(0.16, 20, 14), 0x4c8be8, 0, 1.6, 0, 0, 0, 0, vcGloss());
    solid(S, CX1 - 0.25, F + 0.7, -15.8, 0.36, 1.4, 0.8);
  }
  // sliding door leaves (parked open) and door signs
  for (const x of [0.6, 7.9]) {
    put(g, RB(1.16, 2.1, 0.04, 0.01, 1), mat('oak'), x + 1.0, F + 1.05, CZ0 - 0.3);
    D(g, quad(0.5, 0.6), mat('glass'), x + 1.0, F + 1.5, CZ0 - 0.325, 0, PI, 0);
  }
  {
    const p = group(g, 0.6, 2.75, CZ0 - 0.6, PI / 2);
    put(p, RB(0.66, 0.24, 0.04, 0.01, 1), paint(0xfffaf0, 0.5), 0, 0, 0);
    D(p, A.quad('cls', 0.6, 0.22), A.pm, 0, 0, 0.021); D(p, A.quad('cls', 0.6, 0.22), A.pm, 0, 0, -0.021, 0, PI, 0);
    put(g, RB(0.04, 0.04, 0.3, 0.01, 1), mat('steel'), 0.6, 2.9, CZ0 - 0.4);
  }
  // corridor: drawings, shoe lockers by the entrance
  for (const [x0, x1] of [[1.4, 7.1], [-0.8, -0.1]]) {
    if (x1 - x0 < 1) continue;
    D(g, A.quad('cork', x1 - x0, 1.0), A.pm, (x0 + x1) / 2, 1.85, CZ0 - 0.265, 0, PI, 0);
    for (let i = 0; i < 7; i++) D(g, A.quad('d' + ((i + 2) % 6), 0.6, 0.45), A.pm, x0 + 0.45 + i * 0.8, 1.85 + (i % 2 ? 0.18 : -0.16), CZ0 - 0.27, 0, PI, (R() - 0.5) * 0.08);
  }
  for (let i = 0; i < 6; i++) D(g, A.quad('d' + i, 0.6, 0.45), A.pm, 1.6 + i * 2.3, 1.85, BZ0 + T + 0.06, 0, 0, (R() - 0.5) * 0.06);
  for (let i = 0; i < 6; i++) { const x = 1.6 + i * 2.3 + 1.15; if (x > 9.5 && x < 13.5) continue; picWin(g, A, 'winB', x, 2.6, BZ0 + T + 0.02, 1.0, 0.6); }
  const shoeLocker = (x, z0, z1, side) => {
    const L = z1 - z0, p = group(g, x, F, (z0 + z1) / 2, side > 0 ? PI / 2 : -PI / 2);
    const cols = Math.round(L / 0.36), rows = 4;
    put(p, RB(L, 1.3, 0.36, 0.01, 2), wood, 0, 0.65, 0);
    for (let i = 0; i < cols; i++) for (let k = 0; k < rows; k++) {
      const cx = -L / 2 + (i + 0.5) * L / cols, cy = 0.12 + k * 0.3;
      V(p, RB(L / cols - 0.04, 0.26, 0.02, 0.006, 1), 0xf3ede0, cx, cy + 0.12, 0.17);
      if (R() < 0.75) for (const dx of [-0.05, 0.05]) { V(p, RB(0.08, 0.06, 0.2, 0.03, 1), 0xf7f7f4, cx + dx, cy + 0.04, 0.23, 0, 0, 0, vcGloss()); V(p, box(0.07, 0.012, 0.08), [0x4c8be8, 0xe8604c][k % 2], cx + dx, cy + 0.075, 0.25); }
    }
    for (let k = 0; k <= rows; k++) put(p, RB(L, 0.02, 0.36, 0.005, 1), paint(0xd8c6a4, 0.6), 0, 0.02 + k * 0.3, 0.02);
    solid(S, x + side * 0.18, F + 0.65, (z0 + z1) / 2, 0.36, 1.3, L);
  };
  shoeLocker(CX1 + 0.45, -15.9, -9.3, 1);
  shoeLocker(13.55, -15.9, -13.1, -1);
  shoeLocker(13.55, -11.1, -9.3, -1);
  D(g, A.quad('hall', 3.2, 0.69), A.pm, 11.5, 2.72, BZ0 + T + 0.03);
  D(g, A.quad('hall', 3.2, 0.69), A.pm, 11.5, 2.95, BZ1 - T - 0.03, 0, PI, 0);
  V(g, RB(2.6, 0.012, 1.2, 0.01, 1), 0x4a5a6a, 11.5, F + 0.006, BZ1 - 1.0, 0, 0, 0, vcSoft());
  V(g, CY(0.16, 0.14, 0.55, 18), 0x3f86c6, 10.0, F + 0.275, -9.25, 0, 0, 0, vcGloss());
  for (let i = 0; i < 3; i++) V(g, CY(0.012, 0.012, 0.85, 6), [0xf2c14e, 0xe8604c, 0x58b368][i], 10.0 + (i - 1) * 0.05, F + 0.55, -9.25 + (i - 1) * 0.04, 0.1 * (i - 1), 0, 0.08);
  // ---------------------------------------------------------------- cafeteria (급식실)
  D(g, A.quad('cafe', 1.4, 0.43), A.pm, 13.73, 2.75, -12.1, 0, -PI / 2, 0);
  {
    const ct = group(g, KX1 - 0.42, F, -13.0, -PI / 2); // counter faces -X
    put(ct, RB(5.0, 0.86, 0.7, 0.015, 2), mat('steel'), 0, 0.43, 0);
    put(ct, RB(5.1, 0.04, 0.3, 0.01, 1), mat('steel'), 0, 0.88, 0.48);
    for (const s of [-1, 0, 1]) put(ct, CY(0.012, 0.012, 0.42, 8), mat('chrome'), s * 2.4, 1.1, 0.12);
    D(ct, quad(5.0, 0.4), mat('glass'), 0, 1.25, 0.12, -0.5, 0, 0);
    put(ct, RB(5.0, 0.03, 0.42, 0.01, 1), mat('steel'), 0, 1.33, -0.05);
    const foods = [0xf6f3ea, 0xb5793e, 0x8a4a2a, 0xd9532f, 0x4f7f2e, 0xf2c14e];
    for (let i = 0; i < 6; i++) {
      put(ct, RB(0.6, 0.12, 0.42, 0.02, 2), mat('steel'), -2.0 + i * 0.8, 0.84, -0.05);
      V(ct, RB(0.54, 0.03, 0.36, 0.08, 2), foods[i], -2.0 + i * 0.8, 0.9, -0.05, 0, 0, 0, vcGloss());
      put(ct, CY(0.01, 0.01, 0.32, 6), mat('steel'), -2.0 + i * 0.8 + 0.15, 1.0, -0.05, 0.8, 0, 0);
    }
    for (let k = 0; k < 10; k++) V(ct, RB(0.4, 0.016, 0.3, 0.006, 1), 0xb9a07a, -2.95, 0.9 + k * 0.018, 0.35);
    solid(S, KX1 - 0.42, F + 0.45, -13.0, 0.75, 0.9, 5.1);
  }
  D(g, A.quad('menu', 0.8, 1.04), A.pm, KX0 + 0.02, 1.75, -15.1, 0, PI / 2, 0);
  for (const z of [-14.9, -10.1]) {
    const tb = group(g, 15.8, F, z, 0);
    put(tb, RB(2.4, 0.04, 0.8, 0.01, 2), paint(0xe9eef0, 0.4), 0, 0.62, 0);
    for (const sx of [-1, 1]) put(tb, RB(0.05, 0.6, 0.6, 0.01, 1), paint(0x8a9096, 0.45, 0.5), sx * 1.05, 0.3, 0);
    for (const sz of [-1, 1]) { put(tb, RB(2.3, 0.04, 0.3, 0.01, 2), paint(0x3f86c6, 0.45), 0, 0.36, sz * 0.62); put(tb, RB(0.05, 0.36, 0.05, 0.01, 1), paint(0x8a9096, 0.45, 0.5), 0, 0.18, sz * 0.62); }
    for (const [dx, dz, e] of [[-0.6, -0.2, false], [0.6, 0.2, true], [0.0, -0.2, false]]) lunchTray(tb, dx, 0.64, dz, dz > 0 ? PI : 0, e);
    solid(S, 15.8, F + 0.4, z, 2.4, 0.8, 1.6);
  }
  // ---------------------------------------------------------------- interactables, NPCs, spawn
  const eye = [PX + 0.45, F + 1.1, PZ];
  S.interactables.push({ id: 'class', label: '수업 듣기', pos: [PX + 0.2, 1.2, PZ], radius: 1.2, seat: seat(eye, BC), screen: { center: BC, w: 4.0, h: 1.2, yaw: PI / 2 } });
  S.interactables.push({ id: 'schoolLunch', label: '급식 먹기', pos: [KX1 - 1.1, 1.3, -13.0], radius: 1.6 });
  S.extra.lunchSeat = seat([15.8, F + 1.15, -10.75], [15.8, F + 0.64, -10.3]);
  S.extra.lunchSeat.pitch = -0.7;
  S.npcSpots.push({ pos: [-0.2, F, BC[2] - 0.6], yaw: -PI / 2, pose: 'stand', role: 'teacher' });
  for (const [x, z] of kidSeats.filter((_, i) => i % 3 !== 2).slice(0, 9)) S.npcSpots.push({ pos: [x, F, z], yaw: PI / 2, pose: 'sit', role: 'kid' });
  S.npcSpots.push({ pos: [KX1 - 1.0, F, -14.2], yaw: -PI / 2, pose: 'stand', role: 'cook' });
  S.spawn = { pos: [(GX0 + GX1) / 2, 0.02, 17.4], yaw: 0 };
  S.extra.board = { center: BC, w: 4.0, h: 1.2, yaw: PI / 2 };
  bake(g);
  return S;
}

/* ================================================================== academy atlas */
function academyAtlas() {
  return cached('academyAtlas', () => {
    const A = new Atlas(2048);
    const bigSign = (name, floor, bg1, bg2, fg, icon) => (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, bg1); gr.addColorStop(1, bg2);
      rr(c, 0, 0, w, h, 26, null); c.fillStyle = gr; c.fill();
      rr(c, 10, 10, w - 20, h - 20, 20, null, 'rgba(255,255,255,0.75)', 6);
      icon(c, 120, h / 2);
      txt(c, name, 230, h / 2 + 6, 128, fg, 'left', 'middle');
      rr(c, w - 250, 40, 200, h - 80, 30, '#ffffff');
      txt(c, floor, w - 150, h / 2 + 4, 92, bg2, 'center', 'middle');
    };
    A.add('aTkd', 1200, 230, bigSign('반짝 태권도', '2층', '#e23d3d', '#1f4fa8', '#ffffff', (c, x, y) => {
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, 70, 0, PI * 2); c.fill();
      c.fillStyle = '#e23d3d'; c.beginPath(); c.arc(x, y, 58, PI, 0); c.fill(); c.fillStyle = '#1f4fa8'; c.beginPath(); c.arc(x, y, 58, 0, PI); c.fill();
      c.fillStyle = '#ffd23f'; for (let i = 0; i < 5; i++) { const a = -PI / 2 + i * PI * 0.4; c.beginPath(); c.arc(x + Math.cos(a) * 82, y + Math.sin(a) * 82, 9, 0, PI * 2); c.fill(); }
    }));
    A.add('aMath', 1200, 230, bigSign('쑥쑥 수학', '1층', '#46b06a', '#1f7a52', '#ffffff', (c, x, y) => {
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, 70, 0, PI * 2); c.fill();
      txt(c, '+', x - 22, y - 14, 70, '#1f7a52', 'center', 'middle'); txt(c, '×', x + 24, y - 14, 60, '#e2843d', 'center', 'middle');
      txt(c, '−', x - 22, y + 30, 70, '#3d7fe2', 'center', 'middle'); txt(c, '÷', x + 24, y + 30, 60, '#e23d6d', 'center', 'middle');
    }));
    A.add('aBldg', 700, 150, (c, w, h) => { rr(c, 0, 0, w, h, 18, '#22262c'); txt(c, '세온 학원 빌딩', w / 2, h / 2 + 6, 86, '#ffe7a8', 'center', 'middle'); });
    A.add('aEntr', 420, 120, (c, w, h) => { rr(c, 0, 0, w, h, 14, '#f7f4ec'); txt(c, '건물 입구', w / 2 + 22, h / 2 + 4, 64, '#22262c', 'center', 'middle'); c.fillStyle = '#e2843d'; c.beginPath(); c.moveTo(30, 40); c.lineTo(70, 60); c.lineTo(30, 80); c.fill(); });
    A.add('aPiano', 560, 130, (c, w, h) => {
      rr(c, 0, 0, w, h, 16, '#fff6fb'); rr(c, 6, 6, w - 12, h - 12, 12, null, '#c2569b', 5);
      for (let i = 0; i < 7; i++) { c.fillStyle = '#ffffff'; c.fillRect(26 + i * 14, 28, 13, 74); c.strokeStyle = '#333'; c.lineWidth = 1; c.strokeRect(26 + i * 14, 28, 13, 74); if (i % 7 !== 2 && i < 6) { c.fillStyle = '#222'; c.fillRect(35 + i * 14, 28, 8, 44); } }
      txt(c, '도레미 피아노', 340, h / 2 + 6, 60, '#9b2f75', 'center', 'middle');
    });
    A.add('aEng', 560, 130, (c, w, h) => {
      rr(c, 0, 0, w, h, 16, '#eef6ff'); rr(c, 6, 6, w - 12, h - 12, 12, null, '#2f6db3', 5);
      rr(c, 22, 26, 100, 70, 20, '#ffd23f'); txt(c, 'Hi!', 72, 64, 40, '#2f2a10', 'center', 'middle');
      txt(c, '헬로 영어', 340, h / 2 + 6, 64, '#1f4f8f', 'center', 'middle');
    });
    A.add('wb', 900, 360, (c, w, h) => {
      c.fillStyle = '#fbfcfc'; c.fillRect(0, 0, w, h);
      txt(c, '오늘의 문제', 30, 56, 40, '#1f6db3');
      txt(c, '12 + 7 = 19', 40, 130, 54, '#222'); txt(c, '35 − 18 = ?', 40, 205, 54, '#c23030'); txt(c, '6 × 7 = 42', 40, 280, 54, '#222');
      txt(c, '★ 구구단 7단 외우기', 500, 130, 38, '#2e7d32');
      c.strokeStyle = '#1f6db3'; c.lineWidth = 4; c.strokeRect(520, 170, 300, 150);
      for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(520 + i * 75, 170); c.lineTo(520 + i * 75, 320); c.stroke(); }
      txt(c, '1/4', 557, 255, 34, '#e2843d', 'center', 'middle');
      c.fillStyle = 'rgba(30,60,90,0.05)'; for (let i = 0; i < 6; i++) c.fillRect(i * 150, 0, 60, h);
    });
    A.add('eng', 640, 360, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#7cc6ff'); gr.addColorStop(1, '#bfe6ff');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      [['A', '#e23d3d', 'apple'], ['B', '#2f6db3', 'ball'], ['C', '#e2843d', 'cat']].forEach(([L, col, word], i) => {
        const x = 110 + i * 210; rr(c, x - 85, 50, 170, 230, 24, '#ffffff');
        txt(c, L, x, 130, 110, col, 'center', 'middle'); txt(c, word, x, 240, 40, '#333', 'center', 'middle');
      });
      txt(c, "Let's say it!", w / 2, h - 28, 34, '#1f3a5f', 'center', 'middle');
    });
    A.add('pAbc', 300, 420, (c, w, h) => { rr(c, 0, 0, w, h, 12, '#fffaf0'); txt(c, 'ABC', w / 2, 52, 56, '#e23d3d', 'center', 'middle'); const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; for (let i = 0; i < 26; i++) txt(c, L[i], 40 + (i % 5) * 55, 120 + Math.floor(i / 5) * 55, 40, ['#2f6db3', '#e2843d', '#46b06a', '#9b2f75'][i % 4], 'center', 'middle'); });
    A.add('pGugu', 360, 470, (c, w, h) => { rr(c, 0, 0, w, h, 12, '#f2fff4'); txt(c, '구구단 7단', w / 2, 48, 44, '#1f7a52', 'center', 'middle'); for (let i = 1; i <= 9; i++) txt(c, `7 × ${i} = ${7 * i}`, w / 2, 60 + i * 44, 34, '#333', 'center', 'middle'); });
    A.add('pNote', 300, 420, (c, w, h) => {
      rr(c, 0, 0, w, h, 12, '#fff3fa'); txt(c, '도레미파솔', w / 2, 50, 40, '#9b2f75', 'center', 'middle');
      for (let s = 0; s < 3; s++) { for (let l = 0; l < 5; l++) c.fillRect(20, 110 + s * 100 + l * 12, w - 40, 2); for (let n = 0; n < 5; n++) { const x = 50 + n * 50, y = 160 + s * 100 - n * 6; c.fillStyle = '#222'; c.beginPath(); c.ellipse(x, y, 9, 7, -0.4, 0, PI * 2); c.fill(); c.fillRect(x + 7, y - 40, 2.5, 40); } }
    });
    A.add('pTkd', 360, 470, (c, w, h) => {
      rr(c, 0, 0, w, h, 12, '#ffffff'); c.fillStyle = '#1f4fa8'; c.fillRect(0, 0, w, 90);
      txt(c, '태권도 정신', w / 2, 48, 46, '#ffffff', 'center', 'middle');
      ['예의', '염치', '인내', '극기', '백절불굴'].forEach((s, i) => txt(c, s, w / 2, 145 + i * 66, 48, i % 2 ? '#e23d3d' : '#1f4fa8', 'center', 'middle'));
    });
    A.add('tFlag', 480, 300, (c, w, h) => {
      c.fillStyle = '#1f4fa8'; c.fillRect(0, 0, w, h); c.fillStyle = '#e23d3d'; c.fillRect(0, h * 0.72, w, h * 0.28);
      txt(c, '반짝 태권도', w / 2, h * 0.38, 80, '#ffffff', 'center', 'middle');
      txt(c, '바른 마음 · 튼튼한 몸', w / 2, h * 0.86, 36, '#ffffff', 'center', 'middle');
    });
    A.add('flag', 300, 200, flag);
    A.add('dir', 360, 470, (c, w, h) => {
      rr(c, 0, 0, w, h, 14, '#2a2e35'); txt(c, '층별 안내', w / 2, 52, 44, '#ffe7a8', 'center', 'middle');
      [['2층', '반짝 태권도', '#e23d3d'], ['2층', '헬로 영어', '#2f6db3'], ['1층', '쑥쑥 수학', '#46b06a'], ['1층', '도레미 피아노', '#c2569b']].forEach(([f, n, col], i) => {
        rr(c, 24, 100 + i * 88, w - 48, 72, 10, '#3a3f48'); rr(c, 34, 112 + i * 88, 74, 48, 8, col); txt(c, f, 71, 137 + i * 88, 30, '#fff', 'center', 'middle'); txt(c, n, 124, 138 + i * 88, 34, '#f4f4f4', 'left', 'middle');
      });
    });
    A.add('ind', 240, 90, (c, w, h) => { rr(c, 0, 0, w, h, 10, '#15171a'); txt(c, '▲ 1 2 ▼', w / 2, h / 2 + 3, 44, '#ff9a3d', 'center', 'middle'); });
    A.add('mDoor', 300, 300, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,0.92)'; c.beginPath(); c.arc(w / 2, h / 2, 140, 0, PI * 2); c.fill(); txt(c, '쑥쑥 수학', w / 2, 120, 56, '#1f7a52', 'center', 'middle'); txt(c, '어서 오세요', w / 2, 190, 36, '#333', 'center', 'middle'); });
    A.add('clock', 256, 256, drawClock);
    A.add('stair', 200, 80, (c, w, h) => { rr(c, 0, 0, w, h, 8, '#2f9d63'); txt(c, '계단', w / 2, h / 2 + 3, 40, '#fff', 'center', 'middle'); });
    A.add('cork', 512, 200, (c, w, h) => { c.fillStyle = '#c99a62'; c.fillRect(0, 0, w, h); const R = rng(9); for (let i = 0; i < 900; i++) { c.fillStyle = R() < 0.5 ? 'rgba(90,50,20,0.18)' : 'rgba(255,235,200,0.18)'; c.fillRect(R() * w, R() * h, 2, 2); } });
    for (let i = 0; i < 4; i++) A.add('k' + i, 240, 180, (c, w, h) => drawKid(c, w, h, i + 2));
    A.add('winS', 256, 512, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#fbe9cf'); gr.addColorStop(1, '#e9d2ad'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.fillStyle = '#b9a07a'; for (let i = 0; i < 14; i++) { c.fillRect(0, h - i * 36 - 20, w * (0.3 + (i % 7) * 0.1), 6); }
      c.fillStyle = '#7d8790'; c.save(); c.translate(0, h); c.rotate(-0.45); c.fillRect(0, -100, w * 2, 5); c.restore();
      const sh = c.createLinearGradient(0, 0, w, h); sh.addColorStop(0, 'rgba(255,255,255,0.3)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(110,150,180,0.2)'); c.fillStyle = sh; c.fillRect(0, 0, w, h);
    });
    A.build();
    A.pm = A.printed(0.55);
    A.gm = A.lit(1.6, 0x303030);
    A.win = glow(0xffffff, 0.55, A.tex); A.win.roughness = 0.2; A.win.name = 'academyWin';
    return A;
  });
}

/* ================================================================== 2) 세온 학원 빌딩 */
export function buildAcademy() {
  const S = makeSite('academy', 22, 14);
  const g = S.group, A = academyAtlas(), R = rng(23);
  const F1 = 0.15, F2 = 3.75, C1 = 3.45, C2 = 7.0, TOPL = 7.3, TOPC = 10.4;
  const X0 = -10.5, X1 = 10.5, Z0 = -6.3, Z1 = 5.0, T = 0.2, IX0 = X0 + T, IX1 = X1 - T, IZ0 = Z0 + T, IZ1 = Z1 - T;
  const CXA = 5.5; // left part / entrance column split
  const wallL = mat('plasterWarm'), wallC = mat('brickDark'), inner = mat('plaster'), trim = paint(0xf3f1ea, 0.55), dark = paint(0x2c3036, 0.5, 0.3);
  // elevator (doorway centre x EX, wall z EZ), pocket behind it
  const EX = 8.05, EZ = -1.85, SH = { x0: 7.0, x1: 9.1, z0: -4.1, z1: -1.95 };
  // ---------------------------------------------------------------- ground + slabs
  put(g, plane(22, 14), mat('pavers'), 0, 0.004, 0);
  put(g, RB(22, 0.12, 1.9, 0.02, 1), mat('concrete'), 0, 0.06, 6.05);
  for (const x of [-10.2, -4.2, 1.8]) { const p = group(g, x + 1.1, 0.12, 6.0, 0); put(p, RB(1.7, 0.5, 0.6, 0.04, 2), mat('concrete'), 0, 0.25, 0); for (let k = 0; k < 3; k++) shrub(p, -0.5 + k * 0.5, 0.45, 0, 0.26, Math.round(Math.abs(x) * 7) + k, 4); solid(S, x + 1.1, 0.4, 6.0, 1.7, 0.8, 0.6); }
  blk(S, g, mat('concrete'), X0, X1, 0, F1, Z0, Z1, true, 0.02);
  // 2층 slab with the shaft left open
  const slab = (x0, x1, z0, z1) => blk(S, g, mat('concrete'), x0, x1, C1, F2, z0, z1, true, 0.005);
  slab(IX0, SH.x0, IZ0, IZ1); slab(SH.x1, IX1, IZ0, IZ1); slab(SH.x0, SH.x1, SH.z1, IZ1); slab(SH.x0, SH.x1, IZ0, SH.z0);
  blk(S, g, mat('concrete'), X0, CXA, C2, TOPL, Z0, Z1, true, 0.02);
  blk(S, g, mat('concrete'), CXA, X1, C2, C2 + 0.3, Z0, Z1, true, 0.02);
  blk(null, g, mat('concrete'), CXA, X1, TOPC - 0.3, TOPC, Z0, Z1, false, 0.02);
  // floors and ceilings
  const ceilM = paint(0xf4f3ef, 0.9);
  for (const [F, C] of [[F1, C1], [F2, C2]]) {
    for (const [x0, x1, z0] of [[IX0, SH.x0 - 0.15, IZ0], [SH.x1 + 0.15, IX1, IZ0], [SH.x0 - 0.15, SH.x1 + 0.15, EZ + 0.1]]) put(g, plane(x1 - x0, IZ1 - z0).rotateX(PI), ceilM, (x0 + x1) / 2, C - 0.002, (z0 + IZ1) / 2);
    S.indoor.push(aabb(IX0, F, IZ0, IX1, C, IZ1));
  }
  put(g, plane(CXA - IX0, IZ1 - IZ0), mat('oakFloor'), (IX0 + CXA) / 2, F1 + 0.003, (IZ0 + IZ1) / 2);
  put(g, plane(IX1 - CXA, IZ1 - EZ), mat('floorTile'), (CXA + IX1) / 2, F1 + 0.003, (EZ + IZ1) / 2);
  put(g, plane(CXA - 0.7, IZ1 - IZ0), mat('oakFloor'), (0.7 + CXA) / 2, F2 + 0.003, (IZ0 + IZ1) / 2);
  put(g, plane(IX1 - CXA, IZ1 - EZ), mat('floorTile'), (CXA + IX1) / 2, F2 + 0.003, (EZ + IZ1) / 2);
  put(g, plane(0.5 - IX0, IZ1 - IZ0), paint(0x6b7a8a, 0.8), (IX0 + 0.5) / 2, F2 + 0.003, (IZ0 + IZ1) / 2);
  // ---------------------------------------------------------------- outer walls
  // front, left part: 1층 storefront (math) + hall window; 2층 windows
  const mathFront = [-10.2, 0.4, F1, 2.5], hallWin1 = [0.9, 5.2, 1.0, 2.5], tkdWin = [-10.0, 0.2, F2 + 0.55, F2 + 2.35], engWin = [0.9, 5.2, F2 + 0.7, F2 + 2.35];
  wallX(S, g, wallL, X0, CXA, IZ1, Z1, 0, F2, [mathFront, hallWin1]);
  wallX(S, g, wallL, X0, CXA, IZ1, Z1, F2, TOPL, [tkdWin, engWin]);
  glazeX(g, -10.2, 0.4, F1 + 0.05, 2.5, Z1 - T / 2, 5, dark);
  glazeX(g, 0.9, 5.2, 1.0, 2.5, Z1 - T / 2, 3, dark);
  glazeX(g, -10.0, 0.2, F2 + 0.55, F2 + 2.35, Z1 - T / 2, 6, dark);
  glazeX(g, 0.9, 5.2, F2 + 0.7, F2 + 2.35, Z1 - T / 2, 3, dark);
  // math glass door (decorative, closed)
  {
    const d = group(g, -4.9, F1, Z1 - 0.06, 0);
    put(d, RB(1.3, 2.3, 0.06, 0.01, 1), dark, 0, 1.15, 0.03);
    D(d, quad(1.1, 2.1), mat('tintedGlass'), 0, 1.15, 0.07);
    put(d, RB(0.04, 0.9, 0.06, 0.015, 1), mat('chrome'), 0.42, 1.1, 0.13);
    D(d, A.quad('mDoor', 0.6, 0.6), A.pm, 0, 1.55, 0.075);
  }
  // back + sides
  wallX(S, g, wallL, X0, CXA, Z0, IZ0, 0, TOPL);
  wallX(S, g, wallC, CXA, X1, Z0, IZ0, 0, TOPC);
  wallZ(S, g, wallL, Z0, Z1, X0, IX0, 0, TOPL, [[-4.6, -1.2, F2 + 0.7, F2 + 2.3]]);
  glazeZ(g, -4.6, -1.2, F2 + 0.7, F2 + 2.3, X0 + T / 2, 2, dark);
  wallZ(S, g, wallC, Z0, Z1 + 0.3, IX1, X1, 0, TOPC);
  // entrance column front (protrudes 0.3) with door, stair window, signs
  const DX0 = 7.05, DX1 = 9.05, DH = F1 + 2.45;
  wallX(S, g, wallC, CXA, IX1, IZ1, Z1 + 0.3, 0, F2, [[DX0, DX1, F1, DH]]);
  wallX(S, g, wallC, CXA, IX1, IZ1, Z1 + 0.3, F2, TOPC, [[7.35, 8.75, 4.0, 9.0]]);
  put(g, RB(X1 - CXA + 0.06, 0.24, 0.1, 0.02, 1), mat('concrete'), (CXA + X1) / 2, F2, Z1 + 0.33);
  blk(S, g, wallC, CXA, CXA + 0.2, C2, TOPC, Z0, IZ1);
  D(g, A.quad('winS', 1.4, 5.0), A.win, 8.05, 6.5, Z1 + 0.18);
  for (let i = 0; i <= 2; i++) put(g, RB(0.07, 5.0, 0.1, 0.01, 1), dark, 7.35 + i * 0.7, 6.5, Z1 + 0.24);
  for (let i = 0; i <= 4; i++) put(g, RB(1.47, 0.07, 0.1, 0.01, 1), dark, 8.05, 4.0 + i * 1.25, Z1 + 0.24);
  for (const s of [-1, 1]) {
    const piv = group(g, 8.05 + s * 0.5, F1, Z1 + 0.15, 0); piv.userData.dynamic = true;
    put(piv, RB(1.0, 2.4, 0.05, 0.01, 1), dark, 0, 1.2, 0);
    D(piv, quad(0.86, 2.24), mat('glass'), 0, 1.2, 0.03);
    put(piv, RB(0.03, 0.8, 0.04, 0.01, 1), mat('chrome'), -s * 0.4, 1.1, 0.05);
    S.doors.push({ pivot: piv, openAngle: 0, slide: [s * 0.95, 0, 0], auto: true, collider: aabb(s < 0 ? DX0 : 8.05, F1, Z1 + 0.08, s < 0 ? 8.05 : DX1, DH, Z1 + 0.22) });
  }
  put(g, RB(2.2, 0.08, 0.3, 0.01, 1), mat('steel'), 8.05, F1 + 0.01, Z1 + 0.15);
  sign(g, A, 'aEntr', A.gm, 8.05, F1 + 3.2, Z1 + 0.32, 1.9, 0.54, 0, 0x22262c, 0.1);
  sign(g, A, 'aBldg', A.gm, 8.0, TOPC - 0.65, Z1 + 0.34, 4.0, 0.86, 0, 0x22262c, 0.14);
  put(g, RB(X1 - CXA + 0.2, 0.3, Z1 - Z0 + 0.6, 0.03, 2), trim, (CXA + X1) / 2, TOPC + 0.15, (Z0 + Z1 + 0.3) / 2);
  // left part parapet, floor band, signs
  put(g, RB(CXA - X0 + 0.2, 0.45, 0.3, 0.03, 2), trim, (X0 + CXA) / 2, TOPL + 0.22, Z1 + 0.02);
  put(g, RB(0.3, 0.45, Z1 - Z0, 0.03, 2), trim, X0 + 0.1, TOPL + 0.22, (Z0 + Z1) / 2);
  put(g, RB(CXA - X0 + 0.1, 0.25, 0.16, 0.03, 2), trim, (X0 + CXA) / 2, F2, Z1 + 0.06);
  sign(g, A, 'aMath', A.gm, -4.9, 3.05, Z1 + 0.16, 5.4, 0.9, 0, 0xf4f2ec, 0.14);
  sign(g, A, 'aPiano', A.gm, 3.05, 3.05, Z1 + 0.16, 2.6, 0.6, 0, 0xf4f2ec, 0.1);
  sign(g, A, 'aTkd', A.gm, -4.9, 6.7, Z1 + 0.16, 6.2, 1.04, 0, 0xf4f2ec, 0.16);
  sign(g, A, 'aEng', A.gm, 3.05, 6.6, Z1 + 0.16, 2.6, 0.6, 0, 0xf4f2ec, 0.1);
  S.nightGlow.push(A.gm, A.win);
  const warm = mat('lampGlow').clone(); warm.name = 'academyWarm';
  for (const x of [-7.5, -2.3]) { put(g, CY(0.015, 0.015, 0.5, 6), dark, x, 3.85, Z1 + 0.4, PI / 2, 0, 0); put(g, lathe([[0.02, 0], [0.12, -0.06], [0.13, -0.1], [0.02, -0.08]], 16), dark, x, 3.88, Z1 + 0.62); D(g, SP(0.05, 10, 8), warm, x, 3.8, Z1 + 0.62); S.lamps.push({ pos: [x, 3.6, Z1 + 0.8], color: 0xffd9a0, intensity: 4, range: 6 }); }
  D(g, CY(0.3, 0.3, 0.03, 20), warm, 8.05, F1 + 2.62, Z1 + 0.6);
  put(g, RB(2.6, 0.12, 1.1, 0.03, 2), dark, 8.05, F1 + 2.7, Z1 + 0.75);
  S.lamps.push({ pos: [8.05, 2.4, Z1 + 0.9], color: 0xffd9a0, intensity: 5, range: 7 });
  S.nightGlow.push(warm);
  // ---------------------------------------------------------------- partitions (both floors)
  for (const [F, C] of [[F1, C1], [F2, C2]]) {
    wallZ(S, g, inner, IZ0, IZ1, CXA, CXA + 0.2, F, C, [[1.0, 2.6, F, F + 2.3]]);
    wallX(S, g, inner, 0.7, CXA, -0.6, -0.4, F, C, [[2.5, 3.7, F, F + 2.2]]);
  }
  wallZ(S, g, inner, -0.4, IZ1, 0.5, 0.7, F1, C1, [[1.3, 2.7, F1, F1 + 2.2]]);
  wallZ(S, g, inner, IZ0, -0.6, 0.5, 0.7, F1, C1);
  wallX(S, g, inner, IX0, 0.7, -0.6, -0.4, F1, C1);
  wallZ(S, g, inner, IZ0, IZ1, 0.5, 0.7, F2, C2, [[1.3, 2.7, F2, F2 + 2.2]]);
  // elevator core: front wall with two doorways, shaft side and back walls
  for (const [F, C] of [[F1, C1], [F2, C2]]) wallX(S, g, inner, CXA + 0.2, IX1, EZ - 0.1, EZ + 0.1, F, C, [[EX - 0.6, EX + 0.6, F, F + 2.3]]);
  wallX(S, g, inner, CXA + 0.2, IX1, EZ - 0.1, EZ + 0.1, C1, F2);
  wallZ(S, g, dark, SH.z0 - 0.2, SH.z1, SH.x0 - 0.15, SH.x0, 0, TOPC - 0.3);
  wallZ(S, g, dark, SH.z0 - 0.2, SH.z1, SH.x1, SH.x1 + 0.15, 0, TOPC - 0.3);
  wallX(S, g, dark, SH.x0 - 0.15, SH.x1 + 0.15, SH.z0 - 0.2, SH.z0, 0, TOPC - 0.3);
  for (const [F, nm] of [[F1, '1층'], [F2, '2층']]) {
    for (const s of [-1, 1]) put(g, RB(0.1, 2.4, 0.06, 0.01, 1), mat('steel'), EX + s * 0.65, F + 1.2, EZ + 0.13);
    put(g, RB(1.4, 0.1, 0.06, 0.01, 1), mat('steel'), EX, F + 2.35, EZ + 0.13);
    D(g, A.quad('ind', 0.5, 0.19), A.gm, EX, F + 2.6, EZ + 0.105);
    put(g, RB(0.12, 0.26, 0.03, 0.01, 1), mat('steel'), EX + 1.0, F + 1.1, EZ + 0.115);
    for (const dy of [0.05, -0.05]) D(g, CY(0.022, 0.022, 0.01, 12), warm, EX + 1.0, F + 1.1 + dy, EZ + 0.135, PI / 2, 0, 0);
    // stairs door (closed) to the left of the lift
    const sd = group(g, 6.35, F, EZ + 0.1, 0);
    put(sd, RB(0.98, 2.15, 0.05, 0.01, 1), paint(0x7f8a92, 0.4, 0.5), 0, 1.075, 0.03);
    put(sd, RB(0.12, 0.03, 0.05, 0.01, 1), mat('steel'), 0.35, 1.0, 0.07);
    D(sd, A.quad('stair', 0.4, 0.16), A.gm, 0, 1.75, 0.058);
    void nm;
  }
  // ---------------------------------------------------------------- 1층 lobby
  for (const [F, C, holes] of [[F1, C1, [[DX0, DX1, F1, DH]]], [F2, C2, [[7.35, 8.75, 4.0, 9.0]]]]) {
    blk(null, g, inner, IX1 - 0.02, IX1, F, C, EZ + 0.1, IZ1, false);
    wallX(null, g, inner, CXA + 0.2, IX1, IZ1 - 0.02, IZ1, F, C, holes, false);
  }
  D(g, quad(1.4, 3.25), mat('glass'), 8.05, F2 + 1.625, IZ1 - 0.01, 0, PI, 0);
  D(g, A.quad('dir', 0.72, 0.94), A.pm, IX1 - 0.056, F1 + 1.6, 1.4, 0, -PI / 2, 0);
  put(g, RB(0.03, 1.04, 0.82, 0.01, 1), dark, IX1 - 0.036, F1 + 1.6, 1.4);
  {
    const mb = group(g, IX1 - 0.15, F1, 3.4, -PI / 2);
    put(mb, RB(1.2, 0.6, 0.28, 0.01, 2), mat('steel'), 0, 1.3, 0);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) put(mb, RB(0.26, 0.24, 0.02, 0.005, 1), paint(0xb8bcc0, 0.35, 0.7), -0.45 + i * 0.3, 1.16 + k * 0.28, 0.145);
    solid(S, IX1 - 0.15, F1 + 1.3, 3.4, 0.3, 0.6, 1.2);
  }
  pottedPlant(g, 6.1, F1, 4.2, { kind: 'fig', h: 1.5, seed: 4, pot: 'charcoal' });
  solid(S, 6.1, F1 + 0.6, 4.2, 0.5, 1.2, 0.5);
  V(g, RB(1.8, 0.012, 1.0, 0.01, 1), 0x3a4652, 8.05, F1 + 0.006, 4.0, 0, 0, 0, vcSoft());
  const panel = (x, y, z, ry) => { D(g, RB(1.2, 0.04, 0.3, 0.01, 1), trim, x, y - 0.02, z, 0, ry, 0); D(g, box(1.1, 0.01, 0.22), mat('coolGlow'), x, y - 0.045, z, 0, ry, 0); };
  panel(8.05, C1, 1.5, PI / 2); S.lamps.push({ pos: [8.05, C1 - 0.3, 1.5], color: 0xfff1d8, intensity: 4, range: 6 });
  panel(8.05, C2, 1.5, PI / 2); S.lamps.push({ pos: [8.05, C2 - 0.3, 1.5], color: 0xfff1d8, intensity: 4, range: 6 });
  // ---------------------------------------------------------------- 1층 hall (대기실)
  {
    const b = group(g, 2.9, F1, IZ1 - 0.42, PI);
    put(b, RB(2.2, 0.08, 0.45, 0.03, 2), mat('oak'), 0, 0.45, 0.05);
    for (const s of [-1, 1]) put(b, RB(0.06, 0.45, 0.4, 0.02, 1), dark, s * 1.0, 0.22, 0.05);
    backpack(b, -0.6, 0.49, 0.05, 0.3, 0xe8604c, 0.9);
    solid(S, 2.9, F1 + 0.25, IZ1 - 0.47, 2.2, 0.5, 0.45);
    const sr = group(g, 5.2, F1, 3.6, -PI / 2);
    put(sr, RB(1.6, 0.9, 0.32, 0.01, 2), mat('birch'), 0, 0.45, 0);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) if (R() < 0.7) V(sr, RB(0.1, 0.07, 0.24, 0.035, 2), [0xf7f7f4, 0xff7f7f, 0x4c8be8][(i + k) % 3], -0.6 + i * 0.4, 0.06 + k * 0.42, 0.04, 0, 0, 0, vcGloss());
    solid(S, 5.2, F1 + 0.45, 3.6, 0.32, 0.9, 1.6);
    D(g, A.quad('cork', 1.55, 0.9), A.pm, 1.6, F1 + 1.65, -0.38);
    for (let i = 0; i < 2; i++) D(g, A.quad('k' + i, 0.5, 0.37), A.pm, 1.27 + i * 0.66, F1 + 1.65, -0.37, 0, 0, (R() - 0.5) * 0.1);
    pottedPlant(g, 1.1, F1, 4.2, { kind: 'fig', h: 1.2, seed: 7 });
    panel(3.1, C1, 2.2, 0); S.lamps.push({ pos: [3.1, C1 - 0.3, 2.2], color: 0xfff1d8, intensity: 4, range: 6 });
  }
  // ---------------------------------------------------------------- 1층 쑥쑥 수학
  const WB = [-4.9, F1 + 1.45, -0.4 + 0.045];
  put(g, RB(3.24, 1.34, 0.04, 0.01, 2), paint(0xb8bcc0, 0.35, 0.7), WB[0], WB[1], -0.38);
  D(g, A.quad('wb', 3.0, 1.2), A.pm, WB[0], WB[1], WB[2]);
  put(g, RB(3.0, 0.03, 0.1, 0.01, 1), paint(0xb8bcc0, 0.35, 0.7), WB[0], WB[1] - 0.64, -0.33);
  for (let i = 0; i < 3; i++) V(g, CY(0.012, 0.012, 0.13, 8), [0x1f6db3, 0xc23030, 0x222222][i], WB[0] - 1.2 + i * 0.16, WB[1] - 0.61, -0.33, 0, 0, PI / 2);
  D(g, A.quad('pGugu', 0.6, 0.78), A.pm, -8.3, F1 + 1.6, -0.375);
  D(g, A.quad('k3', 0.6, 0.45), A.pm, -1.6, F1 + 1.7, -0.375);
  const mathDesks = [[-7.1, 1.5], [-4.9, 1.5], [-2.7, 1.5], [-7.1, 3.0], [-4.9, 3.0], [-2.7, 3.0]];
  const mathKids = [];
  for (const [x, z] of mathDesks) {
    const mine = x === -4.9 && z === 1.5;
    kidDesk(g, x, F1, z, 0, R, { seat: [0x58a36e, 0xe0874a, 0x5d86a8][Math.abs(Math.round(x)) % 3], frame: 0x46b06a, bag: mine ? null : bagOf(R) });
    solid(S, x, F1 + 0.35, z, 0.64, 0.7, 0.46);
    if (!mine) mathKids.push([x, z + 0.42]);
  }
  for (const [x, z] of mathDesks) if (!(x === -4.9 && z === 1.5)) V(g, RB(0.2, 0.004, 0.28, 0.002, 1), 0xfbfaf4, x - 0.05, F1 + 0.658, z, 0, 0.15, 0);
  {
    const tdk = group(g, -9.2, F1, 3.6, PI / 2);
    put(tdk, RB(1.3, 0.04, 0.65, 0.01, 2), mat('oak'), 0, 0.74, 0);
    for (const s of [-1, 1]) put(tdk, RB(0.05, 0.72, 0.6, 0.01, 1), dark, s * 0.62, 0.36, 0);
    for (let i = 0; i < 5; i++) V(tdk, RB(0.22, 0.012, 0.3, 0.003, 1), 0xf6f3ea, -0.3, 0.77 + i * 0.013, 0, 0, i * 0.1, 0);
    V(tdk, CY(0.04, 0.035, 0.11, 14), 0x46b06a, 0.4, 0.81, 0.1, 0, 0, 0, vcGloss());
    solid(S, -9.2, F1 + 0.4, 3.6, 0.65, 0.8, 1.3);
    const bs = group(g, IX0 + 0.18, F1, 1.3, PI / 2);
    put(bs, RB(1.4, 1.6, 0.34, 0.01, 2), mat('birch'), 0, 0.8, 0);
    for (let k = 0; k < 3; k++) { put(bs, RB(1.34, 0.02, 0.3, 0.005, 1), paint(0xf3eadb, 0.6), 0, 0.3 + k * 0.48, 0.03); for (let i = 0; i < 14; i++) if (R() < 0.85) V(bs, RB(0.05, 0.24 + R() * 0.06, 0.22, 0.004, 1), [0x46b06a, 0xf2c14e, 0x4c8be8, 0xe8604c][i % 4], -0.6 + i * 0.09, 0.44 + k * 0.48, 0.04); }
    solid(S, IX0 + 0.18, F1 + 0.8, 1.3, 0.34, 1.6, 1.4);
  }
  { const ck = group(g, -8.3, F1 + 2.6, -0.4, 0); put(ck, CY(0.17, 0.17, 0.04, 28), blackPl(), 0, 0, 0.02, PI / 2, 0, 0); D(ck, A.quad('clock', 0.31, 0.31), A.pm, 0, 0, 0.042); }
  for (const x of [-7.6, -2.2]) { panel(x, C1, 2.2, 0); S.lamps.push({ pos: [x, C1 - 0.3, 2.2], color: 0xf4f6ff, intensity: 4, range: 6 }); }
  // ---------------------------------------------------------------- 1층 도레미 피아노
  const pianos = [[1.95, 0x141416], [4.35, 0x3a2418]];
  let keys = null;
  for (const [x, col] of pianos) {
    piano(g, x, F1, IZ0 + 0.02, 0, paint(col, 0.14, 0, { clearcoat: 1 }));
    solid(S, x, F1 + 0.62, IZ0 + 0.32, 1.48, 1.24, 0.62);
    const bn = group(g, x, F1, IZ0 + 1.14, 0);
    put(bn, RB(0.8, 0.07, 0.36, 0.02, 2), paint(col, 0.2, 0, { clearcoat: 0.8 }), 0, 0.47, 0);
    V(bn, RB(0.76, 0.04, 0.32, 0.02, 2), 0x2a2a2e, 0, 0.52, 0, 0, 0, 0, vcSoft());
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(bn, RB(0.045, 0.44, 0.045, 0.01, 1), paint(col, 0.2), sx * 0.34, 0.22, sz * 0.14);
    if (!keys) keys = { center: [x, F1 + 0.722, IZ0 + 0.02 + 0.525], w: 1.22, yaw: 0 };
    for (const dx of [-0.13, 0.13]) { V(g, RB(0.25, 0.33, 0.008, 0.003, 1), 0xfbfaf4, x + dx, F1 + 0.98, IZ0 + 0.34, -0.2, 0, 0); D(g, A.quad('pNote', 0.23, 0.31), A.pm, x + dx, F1 + 0.98 + 0.001, IZ0 + 0.345 + 0.001, -0.2, 0, 0); }
  }
  V(g, lathe([[0, 0], [0.07, 0], [0.025, 0.2], [0, 0.2]], 4), 0x6b4529, 4.35 + 0.5, F1 + 1.27, IZ0 + 0.17, 0, PI / 4, 0, vcGloss());
  {
    const ms = group(g, 4.6, F1, -2.3, -0.4);
    put(ms, CY(0.012, 0.012, 1.1, 8), blackPl(), 0, 0.55, 0);
    for (let i = 0; i < 3; i++) put(ms, CY(0.008, 0.008, 0.35, 6), blackPl(), Math.cos(i * 2.1) * 0.12, 0.08, Math.sin(i * 2.1) * 0.12, Math.sin(i * 2.1) * 0.9, 0, -Math.cos(i * 2.1) * 0.9);
    put(ms, RB(0.48, 0.32, 0.015, 0.005, 1), blackPl(), 0, 1.2, 0, -0.25, 0, 0);
    V(ms, RB(0.42, 0.28, 0.004, 0.002, 1), 0xfbfaf4, 0, 1.21, 0.015, -0.25, 0, 0);
    solid(S, 4.6, F1 + 0.6, -2.3, 0.45, 1.2, 0.45);
  }
  D(g, A.quad('pNote', 0.6, 0.84), A.pm, 0.72, F1 + 1.6, -3.3, 0, PI / 2, 0);
  D(g, A.quad('pNote', 0.6, 0.84), A.pm, IX1 - CXA > 0 ? CXA - 0.02 : 0, F1 + 1.6, -3.3, 0, -PI / 2, 0);
  V(g, RB(0.6, 0.012, 0.9, 0.01, 1), 0x9b2f75, 1.95, F1 + 0.006, IZ0 + 1.25, 0, 0, 0, vcSoft());
  panel(3.1, C1, -3.3, 0); S.lamps.push({ pos: [3.1, C1 - 0.3, -3.3], color: 0xfff1d8, intensity: 4, range: 6 });
  const pEye = [1.95, F1 + 1.12, IZ0 + 0.02 + 1.2];
  const pSeat = seat(pEye, keys.center);
  // ---------------------------------------------------------------- 2층 반짝 태권도
  {
    const n = 10, ts = 0.98;
    for (let i = 0; i < n; i++) for (let k = 0; k < 10; k++) {
      const edge = i === 0 || i === n - 1 || k === 0 || k === 9;
      V(g, RB(ts, 0.03, ts, 0.008, 1), edge ? 0xd23b3b : 0x2f5fb8, -9.8 + 0.5 + i * 1.0, F2 + 0.015, -5.6 + 0.5 + k * 0.99, 0, 0, 0, vcSoft());
    }
    put(g, RB(10.0, 2.1, 0.03, 0.01, 1), paint(0xd4dde2, 0.06, 0.35, { clearcoat: 1 }), -4.95, F2 + 1.45, IZ0 + 0.03);
    put(g, RB(10.1, 0.06, 0.06, 0.01, 1), mat('steel'), -4.95, F2 + 2.53, IZ0 + 0.05);
    put(g, RB(10.0, 0.04, 0.04, 0.01, 1), mat('walnut'), -4.95, F2 + 1.0, IZ0 + 0.18);
    for (const x of [-9.0, -4.95, -0.9]) put(g, RB(0.04, 0.04, 0.16, 0.01, 1), mat('steel'), x, F2 + 1.0, IZ0 + 0.1);
    D(g, A.quad('tFlag', 0.96, 0.6), A.pm, -4.95, F2 + 2.88, IZ0 + 0.02);
    D(g, A.quad('flag', 1.05, 0.7), A.pm, IX0 + 0.02, F2 + 2.45, -2.6, 0, PI / 2, 0);
    D(g, A.quad('pTkd', 0.75, 0.98), A.pm, IX0 + 0.02, F2 + 1.7, 1.5, 0, PI / 2, 0);
    // belts on the right wall
    const belts = [0xf7f7f2, 0xf2d13a, 0xf08a2a, 0x3faa4f, 0x2f6db3, 0x7a3fb0, 0xd23b3b, 0x8a5a2e, 0x1a1a1c];
    put(g, RB(0.04, 0.12, 3.6, 0.01, 1), mat('walnut'), 0.47, F2 + 1.95, -3.2);
    belts.forEach((col, i) => {
      const z = -4.8 + i * 0.4;
      put(g, CY(0.012, 0.012, 0.08, 6), mat('steel'), 0.42, F2 + 1.95, z, 0, 0, PI / 2);
      for (const dz of [-0.035, 0.035]) V(g, RB(0.012, 0.75 + (i % 3) * 0.05, 0.045, 0.004, 1), col, 0.44, F2 + 1.55 - (i % 3) * 0.02, z + dz, dz * 2, 0, 0, vcSoft());
    });
    // kick pads: rack and a few on the floor
    for (let i = 0; i < 5; i++) { V(g, RB(0.26, 0.55, 0.09, 0.04, 2), i % 2 ? 0xd23b3b : 0x2f5fb8, -9.6 + i * 0.3, F2 + 0.32, IZ0 + 0.6, -0.25, 0, 0, vcGloss()); }
    put(g, RB(1.6, 0.04, 0.4, 0.01, 1), mat('walnut'), -9.0, F2 + 0.05, IZ0 + 0.55);
    for (const [x, z, r] of [[-1.6, -4.4, 0.4], [-2.2, -4.7, 1.2]]) V(g, RB(0.26, 0.09, 0.55, 0.04, 2), r > 1 ? 0x2f5fb8 : 0xd23b3b, x, F2 + 0.08, z, 0, r, 0, vcGloss());
    // standing bag
    put(g, lathe([[0, 0], [0.28, 0], [0.28, 0.18], [0.12, 0.22], [0, 0.22]], 24), paint(0x2a2a2e, 0.6), -1.0, F2 + 0.03, 3.6);
    V(g, CY(0.16, 0.16, 1.1, 20), 0xd23b3b, -1.0, F2 + 0.82, 3.6, 0, 0, 0, vcSoft());
    solid(S, -1.0, F2 + 0.7, 3.6, 0.56, 1.4, 0.56);
    // shoe shelf by the dojang door
    const ss = group(g, 0.25, F2, 3.7, -PI / 2);
    put(ss, RB(1.2, 0.7, 0.32, 0.01, 2), mat('birch'), 0, 0.35, 0);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) V(ss, RB(0.1, 0.07, 0.24, 0.035, 2), [0xf7f7f4, 0x222226, 0xff7f7f][(i + k) % 3], -0.45 + i * 0.3, 0.06 + k * 0.33, 0.03, 0, 0, 0, vcGloss());
    solid(S, 0.25, F2 + 0.35, 3.7, 0.32, 0.7, 1.2);
    for (const x of [-8.0, -4.95, -1.9]) for (const z of [-3.4, 1.4]) { panel(x, C2, z, 0); }
    for (const [x, z] of [[-7.5, -2.6], [-2.4, -2.6], [-4.95, 2.0]]) S.lamps.push({ pos: [x, C2 - 0.3, z], color: 0xf4f6ff, intensity: 5, range: 7 });
  }
  // ---------------------------------------------------------------- 2층 hall + 헬로 영어
  {
    const tc = group(g, CXA - 0.2, F2, 3.8, -PI / 2);
    put(tc, RB(1.6, 1.0, 0.4, 0.01, 2), mat('walnut'), 0, 0.5, 0);
    put(tc, RB(1.56, 0.8, 0.36, 0.01, 1), mat('glass'), 0, 1.4, 0);
    for (let i = 0; i < 4; i++) { put(tc, CY(0.05, 0.07, 0.1, 12), mat('walnut'), -0.55 + i * 0.37, 1.05, 0); put(tc, lathe([[0, 0], [0.03, 0], [0.012, 0.08], [0.08, 0.2], [0, 0.22]], 16), mat('gold'), -0.55 + i * 0.37, 1.1, 0); }
    solid(S, CXA - 0.2, F2 + 0.9, 3.8, 0.4, 1.8, 1.6);
    D(g, A.quad('cork', 1.55, 0.9), A.pm, 1.6, F2 + 1.65, -0.38);
    for (let i = 0; i < 2; i++) D(g, A.quad('k' + (i + 1) % 4, 0.5, 0.37), A.pm, 1.27 + i * 0.66, F2 + 1.65, -0.37, 0, 0, (R() - 0.5) * 0.1);
    pottedPlant(g, 1.1, F2, 4.2, { kind: 'fig', h: 1.3, seed: 9 });
    panel(3.1, C2, 2.2, 0); S.lamps.push({ pos: [3.1, C2 - 0.3, 2.2], color: 0xfff1d8, intensity: 4, range: 6 });
  }
  const ES = [3.1, F2 + 1.6, IZ0 + 0.07];
  put(g, RB(2.14, 1.26, 0.06, 0.02, 2), blackPl(), ES[0], ES[1], IZ0 + 0.03);
  D(g, A.quad('eng', 2.0, 1.125), glowEng(A), ES[0], ES[1], ES[2]);
  D(g, A.quad('pAbc', 0.6, 0.84), A.pm, 0.72, F2 + 1.6, -3.3, 0, PI / 2, 0);
  D(g, A.quad('k0', 0.6, 0.45), A.pm, CXA - 0.02, F2 + 1.6, -3.3, 0, -PI / 2, 0);
  const engDesks = [[2.2, -3.9], [4.0, -3.9], [2.2, -2.5], [4.0, -2.5]];
  for (const [x, z] of engDesks) {
    kidDesk(g, x, F2, z, 0, R, { seat: [0x5d86a8, 0xe0874a][Math.round(x) % 2], frame: 0x2f6db3 });
    solid(S, x, F2 + 0.35, z, 0.64, 0.7, 0.46);
  }
  panel(3.1, C2, -3.3, 0); S.lamps.push({ pos: [3.1, C2 - 0.3, -3.3], color: 0xf4f6ff, intensity: 4, range: 6 });
  // ---------------------------------------------------------------- interactables, NPCs, elevator
  const mEye = [-4.9, F1 + 1.1, 1.5 + 0.45];
  S.interactables.push({ id: 'math', label: '수학 공부하기', pos: [-4.9, 1.2, 1.75], radius: 1.1, seat: seat(mEye, WB), screen: { center: WB, w: 3.0, h: 1.2, yaw: 0 } });
  S.interactables.push({ id: 'piano', label: '피아노 치기', pos: [1.95, 1.2, IZ0 + 1.1], radius: 1.1, seat: pSeat, extra: { pianoKeys: keys } });
  S.interactables.push({ id: 'taekwondo', label: '태권도 하기', pos: [-4.95, F2 + 1.0, -0.6], radius: 2.0, seat: { pos: [-4.95, F2 + 1.55, 0.6], yaw: 0, pitch: -0.05 } });
  const eEye = [2.2, F2 + 1.1, -3.9 + 0.45];
  S.interactables.push({ id: 'english', label: '영어 공부하기', pos: [2.2, F2 + 1.05, -3.6], radius: 1.1, seat: seat(eEye, ES), screen: { center: ES, w: 2.0, h: 1.125, yaw: 0 } });
  S.npcSpots.push({ pos: [-3.2, F1, 0.25], yaw: PI, pose: 'stand', role: 'teacher' });
  for (const p of mathKids.slice(0, 3)) S.npcSpots.push({ pos: [p[0], F1, p[1]], yaw: 0, pose: 'sit', role: 'kid' });
  S.npcSpots.push({ pos: [3.15, F1, -4.4], yaw: PI / 2 + 0.3, pose: 'stand', role: 'teacher' });
  S.npcSpots.push({ pos: [-4.95, F2 + 0.03, -3.8], yaw: PI, pose: 'stand', role: 'teacher' });
  for (const [x, z] of [[-7.0, -0.6], [-2.9, -0.6], [-6.0, 1.6]]) S.npcSpots.push({ pos: [x, F2 + 0.03, z], yaw: 0, pose: 'stand', role: 'kid' });
  S.npcSpots.push({ pos: [4.7, F2, -5.2], yaw: PI, pose: 'stand', role: 'teacher' });
  S.npcSpots.push({ pos: [4.0, F2, -2.5 + 0.42], yaw: 0, pose: 'sit', role: 'kid' });
  S.extra.elevator = { landings: [{ name: '1층', pos: [EX, F1, EZ], yaw: 0 }, { name: '2층', pos: [EX, F2, EZ], yaw: 0 }] };
  S.extra.pianoKeys = keys;
  S.spawn = { pos: [8.05, 0.02, 6.4], yaw: 0 };
  bake(g);
  return S;
}
function bagOf(R) { return [0xe8604c, 0x4c8be8, 0xf2c14e, 0x58b368, 0xff9eb5, 0x9b8cf2][Math.floor(R() * 6)]; }
function glowEng(A) { if (!A.eng) { A.eng = glow(0xffffff, 0.9, A.tex); A.eng.name = 'academyScreen'; } return A.eng; }
