// 세온 운전면허시험장: a 2-storey licence office (front-left) and a fenced driving test course.
// Site contract: ../site.js. Footprint 64 (X) x 44 (Z), origin = footprint centre, entrance faces +Z.
// Route (all right turns): start box (x -27, heading -Z) → stop line, crosswalk, traffic light → right-angle
// turn → S-curve along the back → right turn → straight up the east side → right turn → parallel-parking
// bay on the right → finish box (x ~0, heading -X). Lanes are 4 m wide; only low kerbs (0.15 m) on the asphalt.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat, paint, glow } from '../mat.js';
import { box, lathe, torus, prep, put, group, bake, aabb, extrude } from '../geom.js';
import { canvasTex } from '../tex.js';
import { makeSite } from '../site.js';
import { rng } from '../noise.js';
import { PI, RB, CY, V, D, tint, vcGloss, vcSoft, Atlas, txt, rr, pottedPlant, shrub, blackPl, cabinetPl, metalGray } from './office.js';
import { trafficLight } from '../props/street.js';
import { tree } from '../props/nature.js';

const F = 0.15; // office floor
const CEIL = 3.6;
const NAVY = 0x1f3b63;
const WHITE = 0xf3f2ec, YELLOW = 0xf0bd2c;
const ASPH = 0.04; // asphalt top
const KW = () => paint(0xf2f1ee, 0.35); // warm white enamel (kiosk, booth, counter)
const POST = () => paint(0x2f4a3c, 0.45, 0.4); // fence, lamp and sign posts

/* ------------------------------------------------------------------ course path */
function buildPath() {
  const P = [];
  const line = (seg, x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / 0.5)), dx = (x1 - x0) / L, dz = (z1 - z0) / L;
    for (let i = 0; i < n; i++) P.push({ seg, x: x0 + (x1 - x0) * i / n, z: z0 + (z1 - z0) * i / n, dx, dz });
  };
  const arc = (seg, cx, cz, r, a0, a1) => {
    const n = Math.ceil(Math.abs(a1 - a0) * r / 0.35), s = Math.sign(a1 - a0);
    for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * i / n; P.push({ seg, x: cx + r * Math.cos(a), z: cz + r * Math.sin(a), dx: -Math.sin(a) * s, dz: Math.cos(a) * s }); }
  };
  line('L1', -27, 7.8, -27, -9);
  arc('A1', -22, -9, 5, PI, PI * 1.5);
  line('L2', -22, -14, -18, -14);
  const k = (2 * PI) / 22;
  for (let x = -18; x < 4 - 1e-6; x += 0.4) {
    const s = 1.8 * k * Math.cos(k * (x + 18)), l = Math.hypot(1, s);
    P.push({ seg: 'S', x, z: -14 + 1.8 * Math.sin(k * (x + 18)), dx: 1 / l, dz: s / l });
  }
  line('L3', 4, -14, 23, -14);
  arc('A2', 23, -9, 5, -PI / 2, 0);
  line('L4', 28, -9, 28, 8);
  arc('A3', 23, 8, 5, 0, PI / 2);
  line('L5', 23, 13, -3.2, 13);
  P.push({ seg: 'L5', x: -3.2, z: 13, dx: -1, dz: 0 });
  for (const p of P) { p.rx = -p.dz; p.rz = p.dx; }
  return P;
}

/* ------------------------------------------------------------------ geometry helpers */
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
function tri(P, N, a, b, c, na, nb, nc) {
  _a.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); _b.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]); _a.cross(_b);
  const avg = [na[0] + nb[0] + nc[0], na[1] + nb[1] + nc[1], na[2] + nb[2] + nc[2]];
  if (_a.x * avg[0] + _a.y * avg[1] + _a.z * avg[2] < 0) { [b, c] = [c, b]; [nb, nc] = [nc, nb]; }
  P.push(...a, ...b, ...c); N.push(...na, ...nb, ...nc);
}
function normals2(pts, closed) {
  const n = pts.length;
  return pts.map((p, i) => {
    let a = pts[i - 1], b = pts[i + 1];
    if (!a) a = closed ? pts[n - 1] : p;
    if (!b) b = closed ? pts[0] : p;
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    return [-dz / l, dx / l];
  });
}
/** Swept box section along a 2D polyline: top (+ sides when h > 0). */
function stripGeo(pts, w, y0, h, closed = false, sides = true) {
  const n = pts.length, NS = normals2(pts, closed), P = [], N = [];
  const L = pts.map((p, i) => [p[0] - NS[i][0] * w / 2, p[1] - NS[i][1] * w / 2]);
  const R = pts.map((p, i) => [p[0] + NS[i][0] * w / 2, p[1] + NS[i][1] * w / 2]);
  const top = y0 + h, up = [0, 1, 0];
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const j = (i + 1) % n;
    const l0 = [L[i][0], top, L[i][1]], l1 = [L[j][0], top, L[j][1]], r0 = [R[i][0], top, R[i][1]], r1 = [R[j][0], top, R[j][1]];
    tri(P, N, l0, r0, r1, up, up, up); tri(P, N, l0, r1, l1, up, up, up);
    if (sides && h > 0) {
      for (const [S, sg] of [[R, 1], [L, -1]]) {
        const a0 = [S[i][0], y0, S[i][1]], a1 = [S[j][0], y0, S[j][1]], b0 = [S[i][0], top, S[i][1]], b1 = [S[j][0], top, S[j][1]];
        const ni = [NS[i][0] * sg, 0, NS[i][1] * sg], nj = [NS[j][0] * sg, 0, NS[j][1] * sg];
        tri(P, N, a0, a1, b1, ni, nj, nj); tri(P, N, a0, b1, b0, ni, nj, ni);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  return prep(g);
}
/** Flat polygon slab from [x, z] points, y0..y0+h. */
function slabGeo(pts, h, y0 = 0) {
  const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = extrude(s, h);
  g.rotateX(-PI / 2); g.translate(0, y0, 0);
  return g;
}
/** Flat paint line between points (lines material, vertex coloured). */
function paintLine(list, pts, w, col, closed = false) { list.push(tint(stripGeo(pts, w, ASPH + 0.004, 0, closed, false), col)); }
function rectLines(list, x0, z0, x1, z1, w, col) {
  paintLine(list, [[x0, z0], [x1, z0]], w, col); paintLine(list, [[x0, z1], [x1, z1]], w, col);
  paintLine(list, [[x0, z0 - w / 2], [x0, z1 + w / 2]], w, col); paintLine(list, [[x1, z0 - w / 2], [x1, z1 + w / 2]], w, col);
}

/* ------------------------------------------------------------------ canvas atlas */
function licenseAtlas() {
  const A = new Atlas(2048);
  const wheel = (c, cx, cy, r, col) => {
    c.save(); c.strokeStyle = col; c.lineWidth = r * 0.2; c.beginPath(); c.arc(cx, cy, r * 0.85, 0, PI * 2); c.stroke();
    c.fillStyle = col; c.beginPath(); c.arc(cx, cy, r * 0.22, 0, PI * 2); c.fill();
    c.lineWidth = r * 0.16; c.lineCap = 'round';
    for (const a of [PI / 2, PI * 1.25 - PI, PI * 1.75 - PI]) { c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a + PI) * r * 0.8, cy + Math.sin(a + PI) * r * 0.8); c.stroke(); }
    c.restore();
  };
  A.add('sign', 1728, 128, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#24467a'); gr.addColorStop(1, '#1a3560'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f2b632'; c.fillRect(0, h - 8, w, 8);
    wheel(c, 120, h / 2 - 2, 46, '#ffffff');
    txt(c, '세온 운전면허시험장', 690, h / 2 + 4, 92, '#ffffff', 'center', 'middle');
    txt(c, 'SEONN DRIVER LICENSE TEST CENTER', w - 40, h / 2 + 2, 24, '#bcd0ef', 'right', 'middle');
  });
  A.add('pylon', 150, 760, (c, w, h) => {
    c.fillStyle = '#1f3b63'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f2b632'; c.fillRect(0, 0, w, 10);
    wheel(c, w / 2, 90, 50, '#ffffff');
    [...'운전면허시험장'].forEach((ch, i) => txt(c, ch, w / 2, 200 + i * 78, 70, '#ffffff', 'center', 'middle'));
  });
  const poster = (key, bg, title, sub, draw) => A.add(key, 300, 420, (c, w, h) => {
    c.fillStyle = '#fbfaf6'; c.fillRect(0, 0, w, h);
    rr(c, 14, 14, w - 28, h - 28, 10, bg);
    draw(c, w, h);
    txt(c, title, w / 2, h - 110, 40, '#ffffff', 'center', 'middle');
    txt(c, sub, w / 2, h - 62, 22, 'rgba(255,255,255,0.88)', 'center', 'middle');
    txt(c, '세온 운전면허시험장 · 교통안전 캠페인', w / 2, h - 30, 14, 'rgba(255,255,255,0.7)', 'center', 'middle');
  });
  poster('p1', '#2f6fb3', '안전띠는 생명띠', '뒷자리도 꼭 매요', (c, w) => {
    c.strokeStyle = '#fff'; c.lineWidth = 16; c.lineCap = 'round'; c.beginPath(); c.moveTo(80, 70); c.lineTo(w - 80, 230); c.stroke();
    c.fillStyle = '#ffd34d'; c.beginPath(); c.arc(w / 2, 150, 26, 0, PI * 2); c.fill();
  });
  poster('p2', '#d8453a', '어린이 보호구역', '30km 이하로 천천히', (c, w) => {
    c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2, 150, 92, 0, PI * 2); c.fill();
    c.strokeStyle = '#d8453a'; c.lineWidth = 18; c.beginPath(); c.arc(w / 2, 150, 76, 0, PI * 2); c.stroke();
    txt(c, '30', w / 2, 156, 86, '#1d1d1d', 'center', 'middle');
  });
  poster('p3', '#3a3f4b', '음주운전 NO', '한 잔도 안 돼요', (c, w) => {
    c.strokeStyle = '#ff5a4e'; c.lineWidth = 14; c.beginPath(); c.arc(w / 2, 150, 80, 0, PI * 2); c.stroke();
    c.beginPath(); c.moveTo(w / 2 - 56, 94); c.lineTo(w / 2 + 56, 206); c.stroke();
    rr(c, w / 2 - 22, 110, 44, 80, 8, '#d9e6f2');
  });
  poster('p4', '#2c8a63', '횡단보도 앞 일시정지', '사람이 먼저예요', (c, w) => {
    c.fillStyle = '#fff'; for (let i = 0; i < 6; i++) c.fillRect(48 + i * 36, 120, 20, 110);
  });
  poster('p5', '#e58a1f', '졸리면 쉬어 가요', '졸음쉼터를 이용하세요', (c, w) => {
    txt(c, 'Zz', w / 2, 150, 110, '#fff6e0', 'center', 'middle');
  });
  const floorTxt = (key, s) => A.add(key, 512, 220, (c, w, h) => { txt(c, s, w / 2, h / 2 + 8, 190, '#f4f3ee', 'center', 'middle'); });
  floorTxt('start', '출발'); floorTxt('finish', '도착');
  A.add('numboard', 640, 150, (c, w, h) => {
    c.fillStyle = '#0d0f12'; c.fillRect(0, 0, w, h);
    txt(c, '번호', 30, 52, 34, '#9fb0c4');
    txt(c, '0127', 30, 124, 78, '#ff5a3c');
    txt(c, '→', 268, 104, 60, '#ffd04a');
    txt(c, '1번 창구', w - 30, 104, 64, '#7dffa8', 'right');
  });
  A.add('c1', 256, 80, (c, w, h) => { rr(c, 0, 0, w, h, 10, '#1f3b63'); txt(c, '1번 창구', w / 2, h / 2 + 2, 42, '#fff', 'center', 'middle'); });
  A.add('c2', 256, 80, (c, w, h) => { rr(c, 0, 0, w, h, 10, '#1f3b63'); txt(c, '2번 창구', w / 2, h / 2 + 2, 42, '#fff', 'center', 'middle'); });
  A.add('ticket', 256, 110, (c, w, h) => { c.fillStyle = '#d8453a'; c.fillRect(0, 0, w, h); txt(c, '번호표', w / 2, 46, 46, '#fff', 'center', 'middle'); txt(c, '버튼을 누르세요', w / 2, 88, 22, '#ffe3df', 'center', 'middle'); });
  A.add('kscreen', 200, 150, (c, w, h) => {
    c.fillStyle = '#eaf3fb'; c.fillRect(0, 0, w, h); c.fillStyle = '#2f6fb3'; c.fillRect(0, 0, w, 34);
    txt(c, '민원 선택', w / 2, 18, 20, '#fff', 'center', 'middle');
    ['면허 시험', '적성 검사', '면허 갱신'].forEach((s, i) => { rr(c, 16, 44 + i * 34, w - 32, 28, 6, i === 0 ? '#ffd04a' : '#ffffff', '#9db5cc', 2); txt(c, s, w / 2, 59 + i * 34, 18, '#1d2a3a', 'center', 'middle'); });
  });
  A.add('photo', 420, 96, (c, w, h) => { rr(c, 0, 0, w, h, 14, '#ff7aa8'); txt(c, '즉석 증명사진', w / 2, h / 2 + 3, 50, '#fff', 'center', 'middle'); });
  A.add('tv', 640, 360, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#163a6b'); gr.addColorStop(1, '#2d6aa8'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    txt(c, '기능 시험 안내', 40, 70, 48, '#fff');
    ['1. 출발: 안전띠를 매고 출발해요', '2. 정지선과 신호를 지켜요', '3. 직각 코스, S자 코스', '4. 평행 주차 후 도착!'].forEach((s, i) => txt(c, s, 44, 140 + i * 50, 30, '#dce9fb'));
    c.fillStyle = '#ffd04a'; c.fillRect(40, 92, 120, 6);
  });
  A.add('notice', 900, 180, (c, w, h) => {
    c.fillStyle = '#f7f5ef'; c.fillRect(0, 0, w, h); c.fillStyle = '#1f3b63'; c.fillRect(0, 0, w, 60);
    txt(c, '민원 안내', 30, 42, 36, '#fff');
    ['면허 시험 접수', '적성 검사', '면허 갱신', '국제 면허'].forEach((s, i) => { rr(c, 30 + i * 215, 82, 200, 72, 10, i === 0 ? '#ffd04a' : '#e3ebf4'); txt(c, s, 130 + i * 215, 120, 30, '#1d2a3a', 'center', 'middle'); });
  });
  A.add('mon', 256, 160, (c, w, h) => {
    c.fillStyle = '#f2f6fa'; c.fillRect(0, 0, w, h); c.fillStyle = '#2f6fb3'; c.fillRect(0, 0, w, 22);
    for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#e3ebf4' : '#ffffff'; c.fillRect(10, 30 + i * 20, w - 20, 18); c.fillStyle = '#7d8a99'; c.fillRect(16, 36 + i * 20, 60 + (i * 37) % 80, 6); }
  });
  const wnd = (key, warm) => A.add(key, 256, 220, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, warm ? '#fff3d8' : '#eef3f6'); gr.addColorStop(1, warm ? '#d9b98a' : '#b9c6cf'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = warm ? '#f4e6c8' : '#e8edf0'; for (let i = 0; i < 9; i++) c.fillRect(0, i * 11, w, 8);
    c.fillStyle = 'rgba(60,50,40,0.55)'; c.fillRect(20, h - 70, 90, 6); c.fillRect(140, h - 74, 80, 6);
    c.fillStyle = 'rgba(40,40,40,0.5)'; c.fillRect(40, h - 110, 50, 34); c.fillStyle = '#5a8a3a'; c.beginPath(); c.arc(190, h - 100, 22, 0, PI * 2); c.fill();
  });
  wnd('winA', true); wnd('winB', false);
  const csign = (key, title, col) => A.add(key, 300, 150, (c, w, h) => { rr(c, 0, 0, w, h, 14, col); rr(c, 8, 8, w - 16, h - 16, 10, null, '#ffffff', 5); txt(c, title, w / 2, h / 2 + 4, 52, '#fff', 'center', 'middle'); });
  A.add('tower', 480, 100, (c, w, h) => { rr(c, 0, 0, w, h, 12, '#1f3b63'); txt(c, '관제실', 150, h / 2 + 3, 56, '#fff', 'center', 'middle'); txt(c, 'CONTROL', 350, h / 2 + 3, 34, '#f2b632', 'center', 'middle'); });
  csign('sRA', '직각 코스', '#2f6fb3'); csign('sS', 'S자 코스', '#2f6fb3'); csign('sPark', '평행 주차', '#2f6fb3');
  csign('sGate', '시험 코스 입구', '#2c8a63'); csign('sBack', '코스 출입구', '#2c8a63');
  A.add('sCross', 160, 160, (c, w, h) => {
    rr(c, 0, 0, w, h, 10, '#2f6fb3'); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(w / 2, 14); c.lineTo(w - 14, h - 22); c.lineTo(14, h - 22); c.closePath(); c.fill();
    c.fillStyle = '#1d1d1d'; c.beginPath(); c.arc(w / 2, 62, 10, 0, PI * 2); c.fill(); c.fillRect(w / 2 - 5, 74, 10, 34);
    for (let i = 0; i < 4; i++) c.fillRect(36 + i * 24, h - 34, 14, 8);
  });
  A.build();
  const printed = A.printed(0.6);
  printed.polygonOffset = true; printed.polygonOffsetFactor = -2; printed.polygonOffsetUnits = -2;
  return { A, printed, lit: A.lit(1.2, 0x303030) };
}

/* ------------------------------------------------------------------ props */
function coneGeo() {
  const parts = [];
  const r = (y) => 0.125 - (y - 0.06) * (0.09 / 0.62);
  parts.push(tint(RB(0.4, 0.045, 0.4, 0.035, 2).clone(), 0x1c1c1e).translate(0, 0.0225, 0));
  parts.push(tint(lathe([[0.135, 0.045], [0.128, 0.06], [r(0.32), 0.32], [r(0.32) - 0.001, 0.32]], 20), 0xff5f17));
  parts.push(tint(lathe([[r(0.32) + 0.002, 0.32], [r(0.44) + 0.002, 0.44]], 20), 0xf7f7f2));
  parts.push(tint(lathe([[r(0.44), 0.44], [r(0.52), 0.52]], 20), 0xff5f17));
  parts.push(tint(lathe([[r(0.52) + 0.002, 0.52], [r(0.6) + 0.002, 0.6]], 20), 0xf7f7f2));
  parts.push(tint(lathe([[r(0.6), 0.6], [0.03, 0.68], [0.018, 0.69], [0, 0.69]], 20), 0xff5f17));
  for (const p of parts) for (const k of Object.keys(p.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) p.deleteAttribute(k);
  return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false);
}

function lampPost(g, x, z, site, gl) {
  const pole = POST();
  put(g, CY(0.16, 0.19, 0.3, 20), pole, x, 0.15, z);
  put(g, CY(0.065, 0.085, 5.6, 16), pole, x, 3.0, z);
  put(g, RB(0.34, 0.14, 0.34, 0.05, 2), pole, x, 5.86, z);
  put(g, RB(0.5, 0.06, 0.5, 0.025, 2), pole, x, 5.76, z);
  D(g, RB(0.42, 0.02, 0.42, 0.008, 1), gl, x, 5.725, z);
  site.lamps.push({ pos: [x, 5.5, z], color: 0xfff0d8, intensity: 14, range: 18 });
  site.colliders.push(aabb(x - 0.12, 0, z - 0.12, x + 0.12, 5.9, z + 0.12));
}

function signPost(g, x, z, ry, A, printed, key, w = 1.0, h = 0.5) {
  const pole = POST();
  const p = group(g, x, 0, z, ry);
  put(p, CY(0.04, 0.04, 2.3, 12), pole, 0, 1.15, 0);
  put(p, RB(w + 0.06, h + 0.06, 0.04, 0.015, 1), pole, 0, 2.0, -0.01);
  D(p, A.quad(key, w, h), printed, 0, 2.0, 0.013);
}

/* ------------------------------------------------------------------ office building */
function office(site, g, A, printed, lit, ceilGlow, lampG) {
  const X0 = -30, X1 = -10, Z0 = 8, Z1 = 19, T = 0.25;
  const wallM = mat('plaster'), steel = mat('darkSteel'), glass = mat('glass'), navy = paint(NAVY, 0.4, 0.3);
  const cols = site.colliders;
  // slab, floor
  put(g, RB(20.4, F - 0.02, 11.4, 0.04, 2), mat('concrete'), -20, (F - 0.02) / 2, 13.5);
  put(g, box(19.5, 0.02, 10.5), mat('floorTile'), -20, F - 0.01, 13.5);
  cols.push(aabb(X0, -0.1, Z0, X1, F, Z1));
  // walls (ground floor) with openings
  const piece = (cx, cy, cz, sx, sy, sz) => put(g, RB(sx, sy, sz, 0.01, 1), wallM, cx, cy, cz);
  const wallX = (z, x0, x1, holes) => {
    let x = x0;
    for (const [a, b, h0, h1] of holes) {
      if (a > x) piece((x + a) / 2, (F + CEIL) / 2, z, a - x, CEIL - F, T);
      if (h0 > F) piece((a + b) / 2, (F + h0) / 2, z, b - a, h0 - F, T);
      if (h1 < CEIL) piece((a + b) / 2, (h1 + CEIL) / 2, z, b - a, CEIL - h1, T);
      x = b;
    }
    if (x1 > x) piece((x + x1) / 2, (F + CEIL) / 2, z, x1 - x, CEIL - F, T);
  };
  const wallZ = (x, z0, z1, holes) => {
    let z = z0;
    for (const [a, b, h0, h1] of holes) {
      if (a > z) piece(x, (F + CEIL) / 2, (z + a) / 2, T, CEIL - F, a - z);
      if (h0 > F) piece(x, (F + h0) / 2, (a + b) / 2, T, h0 - F, b - a);
      if (h1 < CEIL) piece(x, (h1 + CEIL) / 2, (a + b) / 2, T, CEIL - h1, b - a);
      z = b;
    }
    if (z1 > z) piece(x, (F + CEIL) / 2, (z + z1) / 2, T, CEIL - F, z1 - z);
  };
  // glazing: frame + glass (+ mullion) in an opening; axis 'x' = wall along X
  const glaze = (axis, c, u0, u1, y0, y1, mull = 0) => {
    const w = u1 - u0, h = y1 - y0, uc = (u0 + u1) / 2, yc = (y0 + y1) / 2;
    const at = (u, y, sx, sy, sz, m, o = 0) => axis === 'x' ? put(g, RB(sx, sy, sz, 0.008, 1), m, u, y, c + o) : put(g, RB(sz, sy, sx, 0.008, 1), m, c + o, y, u);
    at(uc, y1 - 0.03, w, 0.06, 0.12, steel); at(uc, y0 + 0.03, w, 0.06, 0.12, steel);
    at(u0 + 0.03, yc, 0.06, h, 0.12, steel); at(u1 - 0.03, yc, 0.06, h, 0.12, steel);
    for (let i = 1; i <= mull; i++) at(u0 + (w * i) / (mull + 1), yc, 0.05, h, 0.1, steel);
    const gm = axis === 'x' ? D(g, box(w - 0.08, h - 0.08, 0.016), glass, uc, yc, c) : D(g, box(0.016, h - 0.08, w - 0.08), glass, c, yc, uc);
    gm.renderOrder = 2;
  };
  // front wall z = 19: piers + storefront + door (x -21..-19)
  const zf = Z1 - T / 2;
  wallX(zf, X0, X1, [[-28.6, -21.2, F, 3.0], [-21.2, -18.8, F, 2.75], [-18.8, -11.4, F, 3.0]]);
  glaze('x', zf, -28.6, -21.2, F, 3.0, 3); glaze('x', zf, -18.8, -11.4, F, 3.0, 3);
  for (const s of [-1, 1]) put(g, RB(0.12, 2.6, 0.2, 0.01, 1), steel, -20 + s * 1.15, F + 1.3, zf);
  put(g, RB(2.42, 0.12, 0.22, 0.01, 1), steel, -20, 2.78, zf);
  // back wall z = 8: windows + back door (x -13.9..-12.1)
  const zb = Z0 + T / 2;
  wallX(zb, X0, X1, [[-28.6, -26.2, 1.1, 2.7], [-17.6, -15.2, 1.1, 2.7], [-13.9, -12.1, F, 2.6]]);
  glaze('x', zb, -28.6, -26.2, 1.1, 2.7, 1); glaze('x', zb, -17.6, -15.2, 1.1, 2.7, 1);
  put(g, RB(2.0, 0.12, 0.3, 0.01, 1), steel, -13, 2.62, zb);
  // right wall x = -10: windows to the course
  const xr = X1 - T / 2;
  wallZ(xr, Z0, Z1, [[9.6, 13.2, 0.95, 2.8], [14.2, 17.8, 0.95, 2.8]]);
  glaze('z', xr, 9.6, 13.2, 0.95, 2.8, 1); glaze('z', xr, 14.2, 17.8, 0.95, 2.8, 1);
  // left wall x = -30 (solid)
  wallZ(X0 + T / 2, Z0, Z1, []);
  // colliders for ground floor walls
  cols.push(aabb(X0, F, Z1 - 0.3, -21.05, CEIL, Z1), aabb(-18.95, F, Z1 - 0.3, X1, CEIL, Z1));
  cols.push(aabb(X0, F, Z0, -13.95, CEIL, Z0 + 0.3), aabb(-12.05, F, Z0, X1, CEIL, Z0 + 0.3));
  cols.push(aabb(X1 - 0.3, F, Z0, X1, CEIL, Z1), aabb(X0, F, Z0, X0 + 0.3, CEIL, Z1));
  // plinth band outside
  const plinth = mat('stone');
  put(g, RB(20.3, 0.45, 0.08, 0.02, 1), plinth, -20, 0.225, Z0 - 0.02);
  put(g, RB(0.08, 0.45, 11.3, 0.02, 1), plinth, X0 - 0.02, 0.225, 13.5);
  put(g, RB(0.08, 0.45, 11.3, 0.02, 1), plinth, X1 + 0.02, 0.225, 13.5);
  for (const [a, b] of [[-30.1, -28.6], [-11.4, -9.9]]) put(g, RB(b - a, 0.45, 0.08, 0.02, 1), plinth, (a + b) / 2, 0.225, Z1 + 0.02);
  // upper floor box + fascia + parapet
  put(g, RB(20, 3.7, 11, 0.03, 1), mat('plasterGray'), -20, CEIL + 1.85, 13.5);
  put(g, RB(20.24, 0.8, 0.14, 0.04, 2), navy, -20, CEIL + 0.4, Z1 + 0.05); put(g, RB(20.24, 0.8, 0.14, 0.04, 2), navy, -20, CEIL + 0.4, Z0 - 0.05);
  put(g, RB(0.14, 0.8, 11.0, 0.04, 2), navy, X0 - 0.05, CEIL + 0.4, 13.5); put(g, RB(0.14, 0.8, 11.0, 0.04, 2), navy, X1 + 0.05, CEIL + 0.4, 13.5);
  const cope = paint(0xe7e3da, 0.6);
  put(g, RB(20.3, 0.5, 0.3, 0.04, 2), cope, -20, 7.55, Z1 - 0.1); put(g, RB(20.3, 0.5, 0.3, 0.04, 2), cope, -20, 7.55, Z0 + 0.1);
  put(g, RB(0.3, 0.5, 10.5, 0.04, 2), cope, X0 + 0.1, 7.55, 13.5); put(g, RB(0.3, 0.5, 10.5, 0.04, 2), cope, X1 - 0.1, 7.55, 13.5);
  put(g, box(19.5, 0.04, 10.5), mat('concrete'), -20, 7.32, 13.5);
  put(g, RB(2.2, 1.0, 1.4, 0.05, 2), mat('steel'), -25, 7.8, 11.5); put(g, RB(2.2, 1.0, 1.4, 0.05, 2), mat('steel'), -22, 7.8, 11.5);
  for (const x of [-25, -22]) put(g, CY(0.5, 0.5, 0.04, 24), blackPl(), x, 8.32, 11.5);
  put(g, RB(3, 2.4, 2.6, 0.05, 2), mat('plasterGray'), -14, 8.5, 11);
  cols.push(aabb(X0, CEIL, Z0, X1, 7.8, Z1));
  // the big sign on the fascia
  D(g, A.quad('sign', 13.5, 1.0), lit, -20, CEIL + 0.42, Z1 + 0.125);
  // upper windows (surface mounted: lit interior card, glass, deep frame, sill)
  const tglass = mat('tintedGlass');
  const upWin = (axis, c, u, s) => {
    const w = 2.2, h = 1.7, y = 5.55, key = (Math.round(u * 7) & 1) ? 'winA' : 'winB';
    if (axis === 'x') {
      D(g, A.quad(key, w - 0.1, h - 0.1), lit, u, y, c + s * 0.012, 0, s < 0 ? PI : 0, 0);
      D(g, box(w - 0.1, h - 0.1, 0.02), tglass, u, y, c + s * 0.06).renderOrder = 2;
      for (const [dx, dy, sx, sy] of [[0, h / 2, w + 0.08, 0.08], [0, -h / 2, w + 0.08, 0.08], [-w / 2, 0, 0.08, h], [w / 2, 0, 0.08, h], [0, 0.12, 0.05, h]]) put(g, RB(sx, sy, 0.14, 0.01, 1), steel, u + dx, y + dy, c + s * 0.07);
      put(g, RB(w + 0.3, 0.06, 0.22, 0.02, 1), cope, u, y - h / 2 - 0.07, c + s * 0.1);
    } else {
      D(g, A.quad(key, w - 0.1, h - 0.1), lit, c + s * 0.012, y, u, 0, s * PI / 2, 0);
      D(g, box(0.02, h - 0.1, w - 0.1), tglass, c + s * 0.06, y, u).renderOrder = 2;
      for (const [dz, dy, sz, sy] of [[0, h / 2, w + 0.08, 0.08], [0, -h / 2, w + 0.08, 0.08], [-w / 2, 0, 0.08, h], [w / 2, 0, 0.08, h], [0, 0.12, 0.05, h]]) put(g, RB(0.14, sy, sz, 0.01, 1), steel, c + s * 0.07, y + dy, u + dz);
      put(g, RB(0.22, 0.06, w + 0.3, 0.02, 1), cope, c + s * 0.1, y - h / 2 - 0.07, u);
    }
  };
  for (let i = 0; i < 5; i++) { upWin('x', Z1, -27.2 + i * 3.6, 1); upWin('x', Z0, -27.2 + i * 3.6, -1); }
  for (const z of [10.3, 13.5, 16.7]) { upWin('z', X1, z, 1); upWin('z', X0, z, -1); }
  site.nightGlow.push(lit);

  // entrance canopy + doors
  put(g, RB(5.2, 0.22, 2.3, 0.05, 2), navy, -20, 3.05, Z1 + 1.1);
  V(g, RB(5.24, 0.04, 2.34, 0.02, 1), 0xf2b632, -20, 3.17, Z1 + 1.1);
  for (const s of [-1, 1]) {
    const rod = new THREE.LineCurve3(new THREE.Vector3(-20 + s * 2.2, 3.15, Z1 + 2.1), new THREE.Vector3(-20 + s * 2.2, 4.2, Z1 + 0.12));
    put(g, prep(new THREE.TubeGeometry(rod, 1, 0.025, 8)), mat('steel'));
  }
  for (const x of [-21.6, -20, -18.4]) D(g, CY(0.09, 0.09, 0.02, 16), lampG, x, 2.935, Z1 + 1.2);
  site.lamps.push({ pos: [-20, 2.7, Z1 + 1.3], color: 0xffe2b8, intensity: 8, range: 9 });
  put(g, RB(2.6, 0.012, 1.5, 0.004, 1).clone().translate(0, 0, 0), mat('carpet'), -20, F + 0.006, Z1 - 1.0);
  put(g, RB(2.6, 0.012, 1.4, 0.004, 1), mat('carpet'), -20, ASPH + 0.006, Z1 + 0.9);
  const leaf = (px, pz, w, h, slide) => {
    const piv = group(g, px, F, pz);
    piv.userData.dynamic = true;
    const fr = new THREE.Group();
    for (const [x, y, sx, sy] of [[0, h - 0.04, w, 0.08], [0, 0.05, w, 0.1], [-w / 2 + 0.03, h / 2, 0.06, h], [w / 2 - 0.03, h / 2, 0.06, h]]) put(fr, RB(sx, sy, 0.05, 0.01, 1), steel, x, y, 0);
    piv.add(fr);
    D(piv, box(w - 0.06, h - 0.1, 0.012), glass, 0, h / 2, 0).renderOrder = 2;
    bake(piv);
    return piv;
  };
  for (const s of [-1, 1]) {
    const piv = leaf(-20 + s * 0.5, Z1 - 0.12, 1.0, 2.6);
    site.doors.push({ pivot: piv, openAngle: 0, slide: [s * 1.0, 0, 0], auto: true, collider: aabb(s < 0 ? -21 : -20, F, Z1 - 0.2, s < 0 ? -20 : -19, F + 2.6, Z1 - 0.04) });
    const pb = leaf(-13 + s * 0.45, Z0 + 0.12, 0.9, 2.45);
    site.doors.push({ pivot: pb, openAngle: 0, slide: [s * 0.9, 0, 0], auto: true, collider: aabb(s < 0 ? -13.9 : -13, F, Z0 + 0.04, s < 0 ? -13 : -12.1, F + 2.45, Z0 + 0.2) });
  }
  // back door canopy + sign
  put(g, RB(2.8, 0.16, 1.3, 0.04, 2), navy, -13, 2.95, Z0 - 0.6);
  D(g, CY(0.08, 0.08, 0.02, 16), lampG, -13, 2.86, Z0 - 0.7);
  site.lamps.push({ pos: [-13, 2.6, Z0 - 0.9], color: 0xffe2b8, intensity: 6, range: 8 });
  D(g, A.quad('sBack', 1.2, 0.6), lit, -13, 3.25, Z0 - 0.02, 0, PI, 0);

  /* ---------------- interior */
  const R = rng(41);
  // ceiling light panels
  for (const x of [-27, -22.4, -17.6, -13]) for (const z of [10.4, 13.6, 16.8]) {
    put(g, RB(1.24, 0.05, 0.64, 0.015, 1), KW(), x, CEIL - 0.025, z);
    D(g, box(1.16, 0.01, 0.56), ceilGlow, x, CEIL - 0.052, z);
  }
  for (const [x, z] of [[-24.7, 12], [-17, 12], [-24.7, 16.2], [-15, 16.2]]) site.lamps.push({ pos: [x, CEIL - 0.3, z], color: 0xf4f6ff, intensity: 9, range: 9 });
  // counter (customer side faces +Z)
  const wood = mat('oak'), ww = KW();
  put(g, RB(10.4, 1.0, 0.7, 0.03, 2), ww, -21, F + 0.5, 11.0);
  put(g, RB(10.6, 0.05, 0.86, 0.02, 2), wood, -21, F + 1.025, 11.04);
  put(g, RB(10.42, 0.1, 0.02, 0.008, 1), navy, -21, F + 0.72, 11.36);
  put(g, RB(10.3, 0.08, 0.6, 0.02, 1), blackPl(), -21, F + 0.04, 11.0);
  cols.push(aabb(-26.3, F, 10.6, -15.7, F + 1.1, 11.5));
  for (const x of [-25.4, -21, -16.6]) { D(g, box(0.02, 0.62, 0.66), glass, x, F + 1.36, 11.05).renderOrder = 2; put(g, RB(0.05, 0.05, 0.7, 0.01, 1), mat('steel'), x, F + 1.69, 11.05); }
  // station plates, monitors, clutter
  for (const [x, key] of [[-23, 'c1'], [-19, 'c2']]) {
    put(g, RB(0.5, 0.17, 0.06, 0.01, 1), blackPl(), x - 0.9, F + 1.14, 11.32, -0.25, 0, 0);
    D(g, A.quad(key, 0.46, 0.14), lit, x - 0.9, F + 1.145, 11.355, -0.25, 0, 0);
    put(g, RB(0.56, 0.34, 0.03, 0.01, 1), blackPl(), x, F + 1.32, 10.9);
    D(g, A.quad('mon', 0.52, 0.3), lit, x, F + 1.32, 10.88, 0, PI, 0);
    put(g, RB(0.05, 0.22, 0.04, 0.01, 1), blackPl(), x, F + 1.12, 10.94);
    put(g, RB(0.24, 0.015, 0.18, 0.005, 1), blackPl(), x, F + 1.057, 10.95);
    V(g, RB(0.21, 0.01, 0.3, 0.003, 1), 0xf6f4ee, x + 0.6, F + 1.056, 11.2, 0, 0.1, 0);
    V(g, RB(0.21, 0.01, 0.3, 0.003, 1), 0xeef3f8, x + 0.62, F + 1.066, 11.22, 0, -0.06, 0);
    V(g, CY(0.035, 0.03, 0.1, 12), 0x2f6fb3, x + 1.1, F + 1.1, 11.3, 0, 0, 0, vcGloss());
    for (let i = 0; i < 3; i++) V(g, CY(0.004, 0.004, 0.14, 6), [0x222222, 0xd8453a, 0x2f6fb3][i], x + 1.1 + (i - 1) * 0.012, F + 1.17, 11.3, 0.15 * (i - 1), 0, 0.1);
    V(g, CY(0.045, 0.06, 0.05, 16), 0xd9d6cf, x - 0.4, F + 1.075, 11.3, 0, 0, 0, vcGloss());
  }
  site.npcSpots.push({ pos: [-23, F, 10.1], yaw: PI, pose: 'stand', role: 'staff' }, { pos: [-19, F, 10.1], yaw: PI, pose: 'stand', role: 'staff' });
  // number board hanging over the counter
  for (const s of [-1, 1]) put(g, CY(0.006, 0.006, 0.5, 6), mat('steel'), -21 + s * 1.1, CEIL - 0.25, 11.1);
  put(g, RB(2.5, 0.62, 0.1, 0.02, 1), blackPl(), -21, CEIL - 0.8, 11.1);
  D(g, A.quad('numboard', 2.4, 0.56), lit, -21, CEIL - 0.8, 11.153);
  // back wall: cabinets, binders, notice board, clock
  put(g, RB(10.4, 1.1, 0.45, 0.02, 2), cabinetPl(), -21, F + 0.55, Z0 + 0.48);
  for (let i = 1; i < 17; i++) put(g, RB(0.008, 1.02, 0.01, 0.003, 1), blackPl(), -26.2 + i * 0.6125, F + 0.55, Z0 + 0.705);
  for (let i = 0; i < 17; i++) put(g, RB(0.012, 0.16, 0.025, 0.005, 1), mat('steel'), -26.2 + (i + 0.5) * 0.6125 + (i % 2 ? -0.2 : 0.2), F + 0.82, Z0 + 0.72);
  for (let i = 0; i < 26; i++) {
    const x = -25.6 + i * 0.12 + (i > 12 ? 4.6 : 0);
    V(g, RB(0.07, 0.3, 0.26, 0.008, 1), [0x2f6fb3, 0xd8453a, 0x2c8a63, 0xe5b72f, 0x3a3f4b][(R() * 5) | 0], x, F + 1.25, Z0 + 0.45);
  }
  pottedPlant(g, -16.6, F + 1.1, Z0 + 0.45, { kind: 'bush', h: 0.35, potR: 0.1, potH: 0.16, seed: 4, pot: 0xece8e0 });
  D(g, A.quad('notice', 5.0, 1.0), printed, -21, 2.45, Z0 + T + 0.006);
  put(g, RB(5.1, 1.1, 0.03, 0.01, 1), mat('oak'), -21, 2.45, Z0 + T + 0.015 - 0.02);
  cols.push(aabb(-26.3, F, Z0, -15.7, F + 1.1, Z0 + 0.72));
  // waiting seats (two rows of beam chairs facing -Z)
  const shell = paint(0x2f6fb3, 0.35, 0, { clearcoat: 0.5 });
  for (const z of [13.8, 15.6]) for (const x0 of [-27.3, -18.6]) {
    const n = 5, pitch = 0.6, len = n * pitch;
    put(g, RB(len, 0.06, 0.08, 0.01, 1), mat('steel'), x0 + len / 2, F + 0.36, z);
    for (const s of [0.25, len - 0.25]) { put(g, RB(0.05, 0.36, 0.05, 0.01, 1), mat('steel'), x0 + s, F + 0.18, z); put(g, RB(0.05, 0.02, 0.5, 0.01, 1), mat('steel'), x0 + s, F + 0.01, z); }
    for (let i = 0; i < n; i++) {
      const x = x0 + pitch * (i + 0.5);
      put(g, RB(0.5, 0.05, 0.46, 0.03, 2), shell, x, F + 0.44, z - 0.02);
      put(g, RB(0.5, 0.46, 0.05, 0.03, 2), shell, x, F + 0.69, z + 0.22, -0.12, 0, 0);
      if (i < n - 1) put(g, RB(0.04, 0.2, 0.36, 0.01, 1), mat('steel'), x + pitch / 2, F + 0.55, z);
    }
    site.colliders.push(aabb(x0, F, z - 0.3, x0 + len, F + 0.5, z + 0.3));
  }
  // storytelling on the seats: a coat, a bag, a phone, a paper ticket
  V(g, RB(0.42, 0.06, 0.4, 0.04, 2), 0x6a4a3a, -26.1, F + 0.5, 13.8, 0, 0.2, 0, vcSoft());
  V(g, RB(0.32, 0.26, 0.14, 0.05, 2), 0x2c4a3a, -17.7, F + 0.6, 15.6, 0, -0.3, 0, vcSoft());
  V(g, RB(0.075, 0.008, 0.15, 0.006, 1), 0x1a1a1c, -19.9, F + 0.47, 13.8, 0, 0.4, 0, vcGloss());
  V(g, RB(0.06, 0.002, 0.11, 0.001, 1), 0xfbfaf4, -24.3, F + 0.468, 15.62, 0, 0.7, 0);
  // number ticket machine near the door
  const kx = -17.2, kz = 17.9;
  put(g, RB(0.56, 1.35, 0.42, 0.06, 3), KW(), kx, F + 0.675, kz);
  V(g, RB(0.58, 0.06, 0.44, 0.03, 2), 0xd8453a, kx, F + 1.38, kz);
  D(g, A.quad('kscreen', 0.38, 0.28), lit, kx, F + 1.05, kz + 0.212, -0.25, 0, 0);
  V(g, CY(0.05, 0.05, 0.03, 18), 0xd8453a, kx, F + 0.78, kz + 0.215, PI / 2, 0, 0, vcGloss());
  put(g, RB(0.16, 0.02, 0.03, 0.008, 1), blackPl(), kx, F + 0.66, kz + 0.212);
  V(g, RB(0.06, 0.002, 0.08, 0.001, 1), 0xfbfaf4, kx + 0.02, F + 0.63, kz + 0.25, 1.0, 0, 0);
  V(g, RB(0.6, 0.28, 0.04, 0.01, 1), 0xd8453a, kx, F + 1.62, kz);
  D(g, A.quad('ticket', 0.56, 0.24), lit, kx, F + 1.62, kz + 0.022);
  site.colliders.push(aabb(kx - 0.3, F, kz - 0.22, kx + 0.3, F + 1.4, kz + 0.22));
  // photo booth in the back-left corner
  const bx = -28.95, bz = 9.15;
  const boothM = KW();
  put(g, RB(1.5, 2.15, 0.06, 0.02, 1), boothM, bx, F + 1.075, bz - 0.8);
  for (const s of [-1, 1]) put(g, RB(0.06, 2.15, 1.6, 0.02, 1), boothM, bx + s * 0.72, F + 1.075, bz);
  V(g, RB(1.5, 0.08, 1.64, 0.02, 1), 0xff7aa8, bx, F + 2.19, bz);
  V(g, RB(1.5, 0.35, 0.08, 0.02, 1), 0xff7aa8, bx, F + 2.0, bz + 0.8);
  D(g, A.quad('photo', 1.36, 0.31), lit, bx, F + 2.0, bz + 0.842);
  put(g, RB(1.4, 0.04, 0.04, 0.01, 1), mat('steel'), bx, F + 1.8, bz + 0.76);
  const curtain = new THREE.Group();
  for (let i = 0; i < 7; i++) V(curtain, CY(0.06, 0.06, 1.55, 10), 0x3a4a6a, bx + 0.15 + i * 0.075, F + 1.0, bz + 0.74 + (i % 2) * 0.03, 0, 0, 0, vcSoft());
  g.add(curtain);
  put(g, RB(0.5, 0.45, 0.5, 0.04, 2), blackPl(), bx - 0.3, F + 0.225, bz - 0.3);
  put(g, RB(0.6, 0.45, 0.04, 0.02, 1), blackPl(), bx, F + 1.35, bz - 0.76);
  site.colliders.push(aabb(bx - 0.78, F, bz - 0.84, bx + 0.78, F + 2.3, bz + 0.1));
  // form-writing desk under the right window
  put(g, RB(0.62, 0.05, 1.9, 0.015, 2), wood, -10.75, F + 1.05, 16.0);
  for (const s of [-1, 1]) put(g, RB(0.06, 1.0, 0.5, 0.01, 1), mat('steel'), -10.75, F + 0.5, 16 + s * 0.8);
  for (let i = 0; i < 4; i++) V(g, RB(0.21, 0.004, 0.3, 0.002, 1), 0xf6f5f0, -10.78, F + 1.08, 15.3 + i * 0.42, 0, (R() - 0.5) * 0.3, 0);
  for (let i = 0; i < 2; i++) V(g, CY(0.005, 0.005, 0.14, 6), 0x1a1a1a, -10.66, F + 1.082, 15.6 + i * 0.84, PI / 2, 0, 0.6);
  site.colliders.push(aabb(-11.1, F, 15, -10.25, F + 1.1, 17));
  // posters, TV, clock, water cooler, plants
  const posterAt = (key, x, y, z, ry) => { D(g, A.quad(key, 0.6, 0.84), printed, x, y, z, 0, ry, 0); };
  posterAt('p1', X0 + T + 0.006, 1.75, 11.6, PI / 2); posterAt('p2', X0 + T + 0.006, 1.75, 17.4, PI / 2);
  posterAt('p3', X1 - T - 0.006, 1.75, 13.7, -PI / 2); posterAt('p4', -10.75, 1.75, Z1 - T - 0.006, PI);
  posterAt('p5', -15.0, 1.6, Z0 + T + 0.006, 0);
  put(g, RB(1.7, 1.0, 0.06, 0.02, 1), blackPl(), X0 + T + 0.03, 2.1, 14.5, 0, PI / 2, 0);
  D(g, A.quad('tv', 1.6, 0.9), lit, X0 + T + 0.065, 2.1, 14.5, 0, PI / 2, 0);
  V(g, CY(0.2, 0.2, 0.04, 28), 0xfaf9f5, -27.6, 2.95, Z0 + T + 0.02, PI / 2, 0, 0, vcGloss());
  V(g, torus(0.2, 0.018, 8, 28), 0x2a2523, -27.6, 2.95, Z0 + T + 0.03, 0, 0, 0, vcGloss());
  for (const [a, l] of [[0.6, 0.12], [2.2, 0.16]]) V(g, RB(0.012, l, 0.006, 0.003, 1), 0x1d1d1d, -27.6 + Math.sin(a) * l / 2, 2.95 + Math.cos(a) * l / 2, Z0 + T + 0.045, 0, 0, -a);
  put(g, RB(0.34, 1.0, 0.34, 0.04, 2), KW(), -29.45, F + 0.5, 12.3);
  V(g, CY(0.14, 0.14, 0.42, 20), 0x9fd2ec, -29.45, F + 1.21, 12.3, 0, 0, 0, vcGloss());
  for (const s of [-1, 1]) V(g, RB(0.04, 0.05, 0.04, 0.01, 1), s < 0 ? 0x2f6fb3 : 0xd8453a, -29.45 + s * 0.08, F + 0.78, 12.49);
  site.colliders.push(aabb(-29.75, F, 12.1, -29.25, F + 1.4, 12.5));
  pottedPlant(g, -29.2, F, 18.2, { kind: 'fig', h: 1.6, seed: 2, pot: 0xece8e0, potR: 0.24 });
  pottedPlant(g, -10.95, F, 18.2, { kind: 'snake', h: 1.0, seed: 3, pot: 'charcoal', potR: 0.2 });
  pottedPlant(g, -11.2, F, 9.0, { kind: 'palm', h: 1.3, seed: 5, pot: 'stone', potR: 0.22 });
  pottedPlant(g, -29.2, F, 13.2, { kind: 'bush', h: 0.6, seed: 6, pot: 'terracotta', potR: 0.2 });
  // brochure rack beside the kiosk
  put(g, RB(0.5, 1.2, 0.3, 0.02, 1), mat('oak'), -22.9, F + 0.6, 18.45);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) V(g, RB(0.2, 0.28, 0.01, 0.003, 1), [0x2f6fb3, 0xffd04a, 0x2c8a63][(i + j) % 3], -23.02 + j * 0.24, F + 0.45 + i * 0.32, 18.28, -0.2, 0, 0);
  site.colliders.push(aabb(-23.2, F, 18.3, -22.6, F + 1.2, 18.75));
  // interactable at the counter
  site.interactables.push({ id: 'license', label: '면허 시험 신청하기', pos: [-21, 1.45, 11.9], radius: 2.2 });
  site.indoor.push(aabb(X0 + T, 0, Z0 + T, X1 - T, CEIL, Z1 - T));
}

/* ------------------------------------------------------------------ builder */
export function buildLicenseCenter() {
  const site = makeSite('license', 64, 44);
  const g = site.group;
  const { A, printed, lit } = licenseAtlas();
  const ceilGlow = glow(0xf3f6ff, 1.6); ceilGlow.name = 'licCeil';
  const lampG = glow(0xfff1d6, 2.2); lampG.name = 'licLamp';
  site.nightGlow.push(ceilGlow, lampG);
  const PATH = buildPath();
  const off = (p, d) => [p.x + d * p.rx, p.z + d * p.rz];

  /* ground: asphalt, pavers */
  const asph = mat('asphalt');
  put(g, box(63.8, ASPH, 29.6), asph, 0, ASPH / 2, -7.0);
  put(g, box(41.9, ASPH, 8.2), asph, 10.95, ASPH / 2, 11.9);
  put(g, box(25.9, ASPH, 5.9), asph, 18.95, ASPH / 2, 18.95);
  const pv = mat('pavers2');
  put(g, box(21.9, ASPH, 2.9), pv, -20.95, ASPH / 2, 20.45);
  put(g, box(16, ASPH, 5.9), pv, -2, ASPH / 2, 18.95);
  put(g, box(1.9, ASPH, 11.2), pv, -30.95, ASPH / 2, 13.4);

  /* islands + kerbs */
  const infield = (d) => {
    const e = d - 2.4, pts = [[-27 + d, 0.6 - e]];
    for (const p of PATH) {
      if (p.seg === 'L5') continue;
      if (p.seg === 'L1' && p.z > 0.6 - e - 0.05) continue;
      pts.push(off(p, d));
    }
    pts.push([18.2 + e, 13 - d], [18.2 + e, 8.0 - e], [7.8 - e, 8.0 - e], [7.8 - e, 13 - d], [-9.4 + e, 13 - d], [-9.4 + e, 0.6 - e]);
    return pts;
  };
  const outer = (d, open = false) => {
    const pts = open ? [] : [[-31.7, 7.8], [-31.7, -21.7], [31.7, -21.7], [31.7, 15.95], [-8.6, 15.95]];
    pts.push([-8.6, 13 + d]);
    let cornered = false;
    for (const p of [...PATH].reverse()) {
      if (p.seg === 'A1') { if (!cornered) { pts.push([-27 - d, -14 - d]); cornered = true; } continue; }
      if (p.seg === 'L5' && p.x < -8.4) continue;
      if (p.seg === 'L1' && p.z > 7.7) continue;
      pts.push(off(p, -d));
    }
    pts.push([-27 - d, 7.8]);
    return pts;
  };
  const grassM = mat('grass'), kerbM = mat('concrete');
  put(g, slabGeo(infield(2.6), 0.12), grassM);
  put(g, stripGeo(infield(2.5), 0.2, 0, 0.15, true), kerbM);
  const outerPoly = outer(2.6);
  put(g, slabGeo(outerPoly, 0.12), grassM);
  put(g, stripGeo(outer(2.5, true), 0.2, 0, 0.15, false), kerbM);

  /* paint */
  const lines = [];
  const right = [], leftA = [], leftB = [];
  for (const p of PATH) {
    const r = off(p, 1.9);
    if (p.seg === 'L5' && r[0] > 7.9 && r[0] < 18.1) continue;
    if (p.seg === 'L1' && p.z > 0.6) continue;
    right.push(r);
  }
  // right white edge (split around the bay)
  const iBay = right.findIndex(([x, z]) => z > 10 && x < 18.2);
  paintLine(lines, right.slice(0, iBay).concat([[18.0, 11.1]]), 0.15, WHITE);
  paintLine(lines, [[7.9, 11.1], ...right.slice(iBay)], 0.15, WHITE);
  for (let x = 8.4; x < 17.6; x += 1.2) paintLine(lines, [[x, 11.1], [x + 0.6, 11.1]], 0.15, WHITE);
  // left yellow double line, square corner at the right-angle turn
  for (const [list, d] of [[leftA, 1.84], [leftB, 2.04]]) {
    for (const p of PATH) {
      if (p.seg === 'A1') { if (!list.cornered) { list.push([-27 - d, -14 - d]); list.cornered = true; } continue; }
      list.push(off(p, -d));
    }
    paintLine(lines, list, 0.11, YELLOW);
  }
  // start box, stop line, crosswalk
  rectLines(lines, -28.75, 2.4, -25.25, 7.4, 0.15, WHITE);
  paintLine(lines, [[-28.85, 0.8], [-25.15, 0.8]], 0.45, WHITE);
  for (let i = 0; i < 5; i++) { const x = -28.6 + i * 0.9; paintLine(lines, [[x, -0.4], [x, -3.8]], 0.48, WHITE); }
  // finish box, parking bay
  rectLines(lines, -3.0, 11.25, 2.6, 14.75, 0.15, WHITE);
  rectLines(lines, 8.0, 8.35, 18.0, 11.05, 0.15, WHITE);
  // test car stalls on the apron + pedestrian path from the back door
  for (const z of [2.0, 4.75, 7.5]) paintLine(lines, [[-24.2, z], [-18.6, z]], 0.12, WHITE);
  paintLine(lines, [[-18.6, 1.94], [-18.6, 7.56]], 0.12, WHITE);
  for (let i = 0; i < 4; i++) paintLine(lines, [[-13.9 + 0.25, 6.9 - i * 1.1], [-12.1 - 0.25, 6.9 - i * 1.1]], 0.5, 0x5fae7a);
  // visitor parking (front right)
  for (let i = 0; i <= 9; i++) paintLine(lines, [[7.2 + i * 2.6, 16.6], [7.2 + i * 2.6, 21.3]], 0.12, WHITE);
  // wheel stops
  for (let i = 0; i < 9; i++) V(g, RB(1.6, 0.12, 0.16, 0.04, 2), 0xe8e4da, 8.5 + i * 2.6, ASPH + 0.06, 17.1);
  const lineMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  lineMat.name = 'licLines';
  const lg = mergeGeometries(lines, false);
  const lm = put(g, lg, lineMat); lm.castShadow = false;
  // floor text
  const flat = (key, w, h, x, z, ry) => { const q = A.quad(key, w, h); q.rotateX(-PI / 2); q.rotateY(ry); D(g, q, printed, x, ASPH + 0.006, z); };
  flat('start', 2.6, 1.12, -27, 4.0, 0);
  flat('finish', 2.6, 1.12, 0.2, 13, PI / 2);

  /* office */
  office(site, g, A, printed, lit, ceilGlow, lampG);

  /* front plaza: pylon, planters */
  const navy = paint(NAVY, 0.4, 0.3);
  put(g, RB(1.0, 4.6, 0.42, 0.06, 2), navy, -29.0, 2.3, 20.9);
  put(g, RB(1.1, 0.25, 0.5, 0.04, 2), mat('stone'), -29.0, 0.125, 20.9);
  D(g, A.quad('pylon', 0.78, 3.95), lit, -29.0, 2.42, 21.115);
  site.colliders.push(aabb(-29.55, 0, 20.6, -28.45, 4.6, 21.2));
  site.lamps.push({ pos: [-29, 2.4, 21.6], color: 0xdde8ff, intensity: 3, range: 5 });
  for (const x of [-25.2, -14.8]) {
    put(g, RB(2.6, 0.55, 0.9, 0.05, 2), mat('concrete'), x, 0.275, 20.9);
    V(g, box(2.44, 0.02, 0.74), 0x3b2a1e, x, 0.53, 20.9);
    for (let i = 0; i < 3; i++) shrub(g, x - 0.8 + i * 0.8, 0.5, 20.9, 0.38, 7 + i + (x > -20 ? 3 : 0), 6);
    site.colliders.push(aabb(x - 1.3, 0, 20.45, x + 1.3, 0.6, 21.35));
  }
  // walkway planters by the course gate
  for (const x of [-6.5, 2.0]) {
    put(g, RB(1.8, 0.5, 0.8, 0.05, 2), mat('concrete'), x, 0.25, 17.0);
    V(g, box(1.66, 0.02, 0.66), 0x3b2a1e, x, 0.48, 17.0);
    shrub(g, x - 0.45, 0.45, 17.0, 0.36, 21 + x, 4); shrub(g, x + 0.45, 0.45, 17.0, 0.34, 25 + x, 3);
    site.colliders.push(aabb(x - 0.9, 0, 16.6, x + 0.9, 0.55, 17.4));
  }

  /* fence with a gate gap next to the building (x -10..-8.4 at z 15.8) */
  const fenceTex = canvasTex(64, 64, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.strokeStyle = '#ffffff'; c.lineWidth = 5;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(w, h); c.moveTo(w, 0); c.lineTo(0, h); c.stroke();
  });
  fenceTex.wrapS = fenceTex.wrapT = THREE.RepeatWrapping; fenceTex.repeat.set(1 / 0.16, 1 / 0.16);
  const meshM = new THREE.MeshStandardMaterial({ color: 0x3f6e52, map: fenceTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.45, metalness: 0.4 });
  meshM.name = 'licFenceMesh';
  const postM = POST();
  const FH = 1.7;
  const fence = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(-(z1 - z0), x1 - x0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const pane = prep(new THREE.PlaneGeometry(L, FH - 0.12)); pane.rotateY(ang); pane.translate(cx, 0.08 + (FH - 0.12) / 2, cz);
    D(g, pane, meshM);
    for (const y of [0.08, FH - 0.02]) put(g, RB(L, 0.05, 0.04, 0.015, 1), postM, cx, y, cz, 0, ang, 0);
    const n = Math.max(1, Math.round(L / 2.5));
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      put(g, CY(0.035, 0.035, FH + 0.06, 10), postM, x, (FH + 0.06) / 2, z);
      put(g, CY(0.045, 0.045, 0.03, 10), postM, x, FH + 0.07, z);
    }
    site.colliders.push(aabb(Math.min(x0, x1) - 0.06, 0, Math.min(z0, z1) - 0.06, Math.max(x0, x1) + 0.06, FH, Math.max(z0, z1) + 0.06));
  };
  fence(-31.6, 7.85, -31.6, -21.6); fence(-31.6, -21.6, 31.6, -21.6); fence(31.6, -21.6, 31.6, 15.8); fence(31.6, 15.8, -8.4, 15.8); fence(-31.6, 7.85, -30.15, 7.85);
  put(g, CY(0.07, 0.07, 2.2, 14), postM, -8.4, 1.1, 15.8);
  signPost(g, -7.6, 16.35, 0, A, printed, 'sGate', 1.1, 0.55);
  site.colliders.push(aabb(-7.7, 0, 16.25, -7.5, 2.3, 16.45));

  /* course furniture: traffic light, signs, lamps */
  const tl = trafficLight({ arm: 3.2 });
  tl.group.position.set(-30.4, ASPH, 0.25);
  g.add(tl.group);
  site.colliders.push(aabb(-30.6, 0, 0.05, -30.2, 5.6, 0.45));
  site.extra.trafficLight = tl;
  signPost(g, -30.3, -4.4, PI / 2 - PI / 2, A, printed, 'sCross', 0.6, 0.6);
  site.colliders.push(aabb(-30.4, 0, -4.5, -30.2, 2.3, -4.3));
  signPost(g, -30.4, -10.5, 0, A, printed, 'sRA');
  signPost(g, -16.5, -19.6, 0, A, printed, 'sS');
  signPost(g, 13, 7.3, 0, A, printed, 'sPark');
  for (const [x, z] of [[-30.4, -10.5], [-16.5, -19.6], [13, 7.3]]) site.colliders.push(aabb(x - 0.1, 0, z - 0.1, x + 0.1, 2.3, z + 0.1));
  for (const [x, z] of [[-31.0, -15], [-6, -20.6], [16, -20.6], [31.0, -14], [31.0, 3], [2, 3.5], [-18, 0.0], [20, 15.3]]) lampPost(g, x, z, site, lampG);
  // a few shrubs on the infield and verges
  for (const [x, z, r, s] of [[-5, -4, 0.6, 1], [-3.6, -3.2, 0.45, 2], [12, -3, 0.55, 3], [13.2, -2.2, 0.4, 4], [20, 4, 0.6, 5], [-30.6, -18.6, 0.55, 6], [30.9, -19.8, 0.5, 7], [4, -20.4, 0.5, 8]]) shrub(g, x, 0.12, z, r, s, 5);

  /* control tower (관제실) on the infield */
  {
    const tx = 10, tz = 0.5, navyT = paint(NAVY, 0.4, 0.3), steel = mat('darkSteel');
    put(g, RB(4.2, 0.3, 4.2, 0.05, 2), mat('concrete'), tx, 0.15, tz);
    put(g, RB(3.4, 3.2, 3.4, 0.04, 2), mat('plaster'), tx, 1.9, tz);
    put(g, RB(3.6, 0.25, 3.6, 0.04, 2), navyT, tx, 3.6, tz);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(g, RB(0.12, 2.0, 0.12, 0.02, 1), steel, tx + sx * 1.74, 4.72, tz + sz * 1.74);
    for (const s of [-1, 1]) {
      put(g, RB(3.6, 0.1, 0.1, 0.02, 1), steel, tx, 4.0, tz + s * 1.74); put(g, RB(0.1, 0.1, 3.6, 0.02, 1), steel, tx + s * 1.74, 4.0, tz);
      D(g, box(3.4, 1.9, 0.02), mat('tintedGlass'), tx, 4.75, tz + s * 1.74).renderOrder = 2;
      D(g, box(0.02, 1.9, 3.4), mat('tintedGlass'), tx + s * 1.74, 4.75, tz).renderOrder = 2;
    }
    D(g, A.quad('winB', 3.2, 1.7), lit, tx, 4.7, tz + 1.6); D(g, A.quad('winA', 3.2, 1.7), lit, tx, 4.7, tz - 1.6, 0, PI, 0);
    put(g, RB(4.0, 0.3, 4.0, 0.06, 2), navyT, tx, 5.85, tz);
    V(g, RB(4.04, 0.05, 4.04, 0.02, 1), 0xf2b632, tx, 5.7, tz);
    put(g, CY(0.03, 0.03, 1.2, 8), steel, tx + 1.4, 6.6, tz - 1.4);
    D(g, A.quad('tower', 2.4, 0.5), lit, tx, 3.18, tz + 1.71);
    put(g, RB(1.0, 2.1, 0.06, 0.02, 1), steel, tx - 0.8, 1.2, tz + 1.71);
    site.colliders.push(aabb(tx - 1.8, 0, tz - 1.8, tx + 1.8, 6.0, tz + 1.8));
    site.lamps.push({ pos: [tx, 3.0, tz + 2.4], color: 0xfff0d8, intensity: 5, range: 7 });
  }
  for (const [x, z, k, s] of [[-14, -4, 'round', 1], [-6, 4.6, 'round', 2], [19, -5, 'round', 3], [21, 3.5, 'round', 4], [-1, -7.2, 'round', 5], [-24, -20.2, 'round', 6], [10, -20.2, 'round', 7]]) {
    const t = tree({ kind: k, seed: s, height: 5.2 + (s % 3) * 0.6 });
    t.position.set(x, 0.12, z); t.rotation.y = s * 1.3; g.add(t);
    site.colliders.push(aabb(x - 0.25, 0, z - 0.25, x + 0.25, 3, z + 0.25));
  }

  /* cones (dynamic, knockable) */
  const cones = group(g, 0, 0, 0);
  cones.userData.dynamic = true;
  const cg = coneGeo(), cm = vcGloss();
  const conePos = [];
  const sPts = PATH.filter((p) => p.seg === 'S');
  for (let i = 4; i < sPts.length; i += 10) for (const d of [-2.25, 2.25]) conePos.push(off(sPts[i], d));
  conePos.push([-28.55, -15.55], [-28.55, -12.4], [-25.2, -15.55]);
  conePos.push([8.15, 8.5], [18.0 - 0.15, 8.5], [13, 8.5], [8.15, 11.0], [17.85, 11.0]);
  site.extra.cones = [];
  conePos.forEach(([x, z], i) => {
    const m = put(cones, cg, cm, x, ASPH, z, 0, i * 0.7, 0);
    m.userData.cone = true;
    site.extra.cones.push(m);
  });

  /* course data for the game */
  const Y = ASPH;
  site.extra.course = {
    start: { pos: [-27, Y, 4.9], yaw: 0 },
    checkpoints: [
      { pos: [-27, Y, -2.1], radius: 3.2 },
      { pos: [-25.54, Y, -12.54], radius: 3.2 },
      { pos: [-12.5, Y, -12.2], radius: 3.0 },
      { pos: [-1.5, Y, -15.8], radius: 3.0 },
      { pos: [26.54, Y, -12.54], radius: 3.2 },
      { pos: [28, Y, 0], radius: 3.2 },
      { pos: [26.54, Y, 11.54], radius: 3.2 },
      { pos: [13, Y, 13], radius: 3.2 },
    ],
    finish: { pos: [-0.2, Y, 13], radius: 2.6 },
    parkingBox: { center: [13, Y, 9.7], size: [10, 2.7], yaw: Math.PI / 2 },
  };
  site.extra.testParking = [{ pos: [-21.4, Y, 6.12], yaw: PI / 2 }, { pos: [-21.4, Y, 3.38], yaw: PI / 2 }];
  site.parking = { pos: [12.4, Y, 19.2], yaw: 0 };
  site.spawn = { pos: [-20, Y, 21], yaw: 0 };
  site.lamps.push({ pos: [-21, 4, 4.5], color: 0xfff0d8, intensity: 6, range: 10 });

  bake(g);
  return site;
}
