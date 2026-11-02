// 별빛테크 (Starlight Tech): the client company for business trips. A 4-storey dark-brick loft with
// tall arched steel windows, warm oak at street level, a lit sign, and a glass meeting room inside.
// Site contract: see ../site.js. Local space: origin = footprint centre (24 x 18), entrance faces +Z.
import * as THREE from 'three';
import { mat, paint, textured } from '../mat.js';
import { box, quad, plane, prep, extrude, put, group, bake, aabb, sphere } from '../geom.js';
import { makeSite, solid } from '../site.js';
import { rng } from '../noise.js';
import {
  PI, RB, CY, V, D, tint, cached, vcMat, vcGloss, vcSoft, vcLeaf, leafGeo, leafyCrown, Atlas, txt, rr, lines, drawScreen, pottedPlant, shrub, officeChair,
  meetingTable, wallScreen, pendant, sofa, bookshelf, mug, laptop, blackPl, whitePl, frameWhite, sharedOfficeAtlas, cafeChair,
} from './office.js';

const FLOOR = 0.15, CEIL = 3.75;
const FL = (k) => 4.4 + (k - 1) * 3.6; // upper floors 1..3
const ROOF = 15.2;
const T = 0.4; // brick wall thickness

/* ------------------------------------------------------------------ atlases */
function drawStar(c, cx, cy, r, fill, inner = 0.45) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -PI / 2 + (i * PI) / 5, rr2 = i % 2 ? r * inner : r;
    i ? c.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2) : c.moveTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2);
  }
  c.closePath(); c.fillStyle = fill; c.fill();
}
function starAtlas() {
  return cached('starAtlas', () => {
    const G = new Atlas(2048), A = new Atlas(1024);
    G.add('sign', 1600, 260, (c, w, h) => {
      drawStar(c, 120, 132, 96, '#ffd36b');
      drawStar(c, 204, 56, 24, '#fff1c2');
      txt(c, '별빛테크', 250, 186, 160, '#fff4dc');
      c.font = `160px ${'"Jua", sans-serif'}`;
      const x2 = 250 + c.measureText('별빛테크').width + 50;
      c.font = `72px ${'"Jua", sans-serif'}`;
      const s2 = 'STARLIGHT TECH', k = Math.min(1, (w - 30 - x2) / c.measureText(s2).width);
      txt(c, s2, x2, 172, Math.floor(72 * k), '#ffd9a0');
    });
    G.add('logoWall', 1100, 420, (c, w, h) => {
      drawStar(c, 170, 200, 140, '#ffcf5c');
      drawStar(c, 300, 70, 34, '#fff1c2');
      drawStar(c, 60, 360, 22, '#fff1c2');
      txt(c, '별빛테크', 340, 250, 190, '#fff6e2');
      txt(c, 'STARLIGHT TECH', 352, 350, 70, '#ffd9a0');
    });
    G.add('present', 1280, 720, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#141b33'); gr.addColorStop(1, '#283a6b');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      const R = rng(5);
      for (let i = 0; i < 120; i++) { c.fillStyle = `rgba(255,255,255,${0.2 + R() * 0.6})`; c.fillRect(R() * w, R() * h, 2 + R() * 2, 2 + R() * 2); }
      drawStar(c, 90, 90, 40, '#ffd36b');
      txt(c, '별빛테크 × 세온 컴퍼니', 150, 112, 64, '#ffffff');
      txt(c, '협업 제안 · 2026', 154, 172, 36, '#ffd9a0');
      ['1. 함께 만들 서비스', '2. 일정과 역할', '3. 다음 단계'].forEach((s, i) => { rr(c, 90, 250 + i * 110, 520, 84, 14, 'rgba(255,255,255,0.1)'); txt(c, s, 120, 304 + i * 110, 40, '#eef2ff'); });
      rr(c, 700, 250, 490, 390, 16, 'rgba(255,255,255,0.08)');
      for (let i = 0; i < 6; i++) { const bh = 60 + i * 45 + R() * 20; c.fillStyle = i === 5 ? '#ffd36b' : '#7fb8ff'; c.fillRect(750 + i * 70, 600 - bh, 44, bh); }
      txt(c, '사용자 수', 740, 300, 30, '#cfd8ff');
    });
    G.add('cafeMenu', 520, 300, (c, w, h) => {
      c.fillStyle = '#1d1f22'; c.fillRect(0, 0, w, h);
      txt(c, 'STAR CAFÉ', 30, 62, 46, '#ffd36b');
      [['아메리카노', '무료'], ['카페라테', '무료'], ['유자차', '무료'], ['오늘의 쿠키', '1개']].forEach(([a, b], i) => { txt(c, a, 34, 122 + i * 44, 32, '#f3efe6'); txt(c, b, w - 34, 122 + i * 44, 30, '#ffd9a0', 'right'); });
    });
    G.add('scr2', 384, 216, drawScreen('dash', 21));
    G.add('scr3', 384, 216, drawScreen('code', 22));
    G.add('scr4', 384, 216, drawScreen('mail', 23));
    G.add('exit', 220, 90, (c, w, h) => { c.fillStyle = '#1b9e55'; c.fillRect(0, 0, w, h); txt(c, '비상구', w / 2, 62, 44, '#ffffff', 'center'); });
    G.build();
    G.mat = G.lit(0.95);
    G.signMat = G.lit(2.4, 0xffffff); G.signMat.name = 'starSignGlow';
    G.logoMat = G.lit(1.6, 0xffffff); G.logoMat.name = 'starLogoGlow';

    A.add('roomSign', 360, 90, (c, w, h) => { rr(c, 0, 0, w, h, 10, '#1f2125'); drawStar(c, 46, 45, 24, '#ffd36b'); txt(c, '회의실 은하수', 200, 60, 40, '#ffffff', 'center'); });
    A.add('starmap', 360, 500, (c, w, h) => {
      c.fillStyle = '#0f1630'; c.fillRect(0, 0, w, h);
      const R = rng(8);
      for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(255,255,255,${0.3 + R() * 0.7})`; c.beginPath(); c.arc(R() * w, R() * h * 0.8, R() * 2.2, 0, PI * 2); c.fill(); }
      c.strokeStyle = 'rgba(255,214,120,0.8)'; c.lineWidth = 2; c.beginPath();
      [[60, 120], [120, 90], [180, 130], [240, 110], [290, 170], [250, 240], [200, 210]].forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
      txt(c, '북두칠성', w / 2, 440, 40, '#ffd36b', 'center');
    });
    A.add('photoTeam', 300, 200, (c, w, h) => {
      c.fillStyle = '#e9e0d0'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) { c.fillStyle = '#f1c9a5'; c.beginPath(); c.arc(40 + i * 45, 80, 15, 0, PI * 2); c.fill(); c.fillStyle = ['#2a6f6a', '#c0504d', '#1d3557', '#e2b04a', '#7a5c3e', '#5b7fa6'][i]; c.fillRect(24 + i * 45, 98, 32, 70); }
      txt(c, '별빛테크 10주년', w / 2, 190, 22, '#3a2f28', 'center');
    });
    for (let i = 0; i < 3; i++) A.add('doc' + i, 180, 254, (c, w, h) => {
      const R = rng(i + 31);
      c.fillStyle = '#fdfdfb'; c.fillRect(0, 0, w, h);
      drawStar(c, 26, 26, 12, '#e2a93b');
      c.fillStyle = '#2b2f33'; c.fillRect(46, 20, 110, 9);
      lines(c, 14, 58, w - 28, 12, 14, '#a3a8ad', R, 4);
    });
    A.add('book', 200, 270, (c, w, h) => { c.fillStyle = '#1d2a4a'; c.fillRect(0, 0, w, h); drawStar(c, 100, 110, 50, '#ffd36b'); txt(c, '우주 이야기', w / 2, 220, 30, '#ffffff', 'center'); });
    A.build();
    A.mat = A.printed(0.6);
    return { G, A };
  });
}

function starMats() {
  return cached('starMats', () => ({
    brick: textured('brick', { color: 0x5e3127, mortar: 0x8f877c, seed: 4 }, 0.8, { normal: 1.1 }),
    steel: paint(0x1e2023, 0.38, 0.6),
    sill: paint(0xcdc4b2, 0.6),
    glass: (() => { const m = new THREE.MeshPhysicalMaterial({ color: 0x6a8690, metalness: 0.15, roughness: 0.04, transparent: true, opacity: 0.55, envMapIntensity: 2.2, depthWrite: false, side: THREE.DoubleSide }); m.name = 'archGlass'; return m; })(),
    concreteFloor: textured('concrete', { color: 0xb3aa9c, seed: 21 }, 4, { normal: 0.25, roughness: 0.6 }),
    ceil: paint(0x34363a, 0.85),
    frost: (() => { const m = new THREE.MeshStandardMaterial({ color: 0xf4f6f6, roughness: 0.5, transparent: true, opacity: 0.6, depthWrite: false }); m.name = 'frost'; return m; })(),
    ceilLit: paint(0x8f8b85, 0.9, 0, { emissive: 0xffe9c8, emissiveIntensity: 0.32 }),
    warmGlow: (() => { const m = mat('lampGlow').clone(); m.name = 'starWarmGlow'; return m; })(),
  }));
}

/* ------------------------------------------------------------------ shapes */
function archPath(P, cx, y0, w, h) {
  const r = w / 2, ys = y0 + h - r;
  P.moveTo(cx - r, y0); P.lineTo(cx + r, y0); P.lineTo(cx + r, ys); P.absarc(cx, ys, r, 0, PI, false); P.lineTo(cx - r, y0);
  return P;
}
function rectPath(P, x0, y0, x1, y1) { P.moveTo(x0, y0); P.lineTo(x1, y0); P.lineTo(x1, y1); P.lineTo(x0, y1); P.lineTo(x0, y0); return P; }

/** Arched steel window (frame, mullions, glass) in local XY at z (front face), bottom at y0. */
function archWindow(g, M, cx, y0, w, h, z) {
  const t = 0.07, r = w / 2, ys = y0 + h - r;
  const ring = archPath(new THREE.Shape(), cx, y0, w, h);
  ring.holes.push(archPath(new THREE.Path(), cx, y0 + t, w - 2 * t, h - 2 * t));
  put(g, extrude(ring, 0.07), M.steel, 0, 0, z - 0.07);
  D(g, prep(new THREE.ShapeGeometry(archPath(new THREE.Shape(), cx, y0 + t, w - 2 * t, h - 2 * t), 16)), M.glass, 0, 0, z - 0.045);
  put(g, box(0.04, ys - y0 + r - t, 0.05), M.steel, cx, (y0 + ys + r - t) / 2, z - 0.035);
  for (const ty of [ys, y0 + (ys - y0) * 0.5]) put(g, box(w - 2 * t, 0.04, 0.05), M.steel, cx, ty, z - 0.035);
  for (const a of [PI / 4, (3 * PI) / 4]) put(g, box(0.035, r - t, 0.045), M.steel, cx + Math.cos(a) * (r - t) / 2, ys + Math.sin(a) * (r - t) / 2, z - 0.035, 0, 0, a - PI / 2);
  put(g, RB(w + 0.22, 0.08, 0.26, 0.015, 1), M.sill, cx, y0 - 0.04, z + 0.05);
}

/** One upper-floor brick side: wall with arched holes, windows, lit interior behind, floor bands. */
function brickSide(root, M, OG, { x, z, ry, len, nb, seed, withSign }) {
  const g = group(root, x, 0, z, ry);
  const R = rng(seed);
  const bw = len / nb, w = 1.62, h = 2.65, DEP = 2.4;
  const wall = rectPath(new THREE.Shape(), -len / 2, 4.2, len / 2, ROOF + 1.2);
  const wins = [];
  for (let k = 1; k <= 3; k++) for (let b = 0; b < nb; b++) {
    const cx = -len / 2 + (b + 0.5) * bw, y0 = FL(k) + 0.55;
    wall.holes.push(archPath(new THREE.Path(), cx, y0, w, h));
    wins.push([cx, y0, k, b]);
  }
  put(g, extrude(wall, T), M.brick, 0, 0, -T);
  for (const [cx, y0] of wins) archWindow(g, M, cx, y0, w, h, -0.12);
  // floor bands + cornice
  for (let k = 1; k <= 3; k++) put(g, RB(len + 0.02, 0.22, 0.08, 0.01, 1), M.brick, 0, FL(k) + 0.2, 0.03);
  for (const [dy, dz, hh] of [[ROOF - 0.1, 0.06, 0.2], [ROOF + 0.12, 0.13, 0.24], [ROOF + 0.38, 0.2, 0.28]]) put(g, RB(len + dz * 2, hh, 0.1 + dz, 0.01, 1), M.brick, 0, dy, dz / 2 - 0.02);
  put(g, RB(len + 0.5, 0.08, 0.6, 0.02, 1), M.steel, 0, ROOF + 1.24, -0.05);
  // interior behind the windows
  for (let k = 1; k <= 3; k++) {
    const F = FL(k);
    V(g, plane(len, DEP), 0x5a4a3e, 0, F + 0.002, -T - DEP / 2);
    let lit = true;
    for (let b = 0; b < nb; b++) {
      if (b % 2 === 0) lit = R() < 0.8;
      const xb = -len / 2 + (b + 0.5) * bw, q = (b + k * 3) % 4;
      put(g, OG.mapSub(quad(bw, 3.2), 'bdWall', q / 4, (q + 1) / 4), lit ? OG.bdLit : OG.bdDark, xb, F + 1.6, -T - DEP);
      if (lit) put(g, plane(bw, DEP).rotateX(PI), M.ceilLit, xb, F + 3.2, -T - DEP / 2);
      else V(g, plane(bw, DEP).rotateX(PI), 0x6a6560, xb, F + 3.2, -T - DEP / 2);
      if (lit) { D(g, CY(0.004, 0.004, 0.6, 4), blackPl(), xb, F + 2.9, -T - 1.0); D(g, CY(0.16, 0.2, 0.14, 12), M.warmGlow, xb, F + 2.56, -T - 1.0); }
      const r = R();
      if (r < 0.55) {
        V(g, box(1.3, 0.04, 0.7), 0xb98d5f, xb, F + 0.74, -T - 1.3);
        V(g, box(0.52, 0.32, 0.03), 0x23262b, xb + (R() - 0.5) * 0.3, F + 1.06, -T - 1.55);
        V(g, box(0.44, 0.06, 0.44), 0x30343a, xb, F + 0.47, -T - 0.85);
        V(g, box(0.42, 0.5, 0.05), 0x30343a, xb, F + 0.78, -T - 0.65);
      } else if (r < 0.7) V(g, box(bw * 0.8, 1.9, 0.4), 0x7a5a3e, xb, F + 0.95, -T - DEP + 0.22);
      else if (r < 0.85) { V(g, CY(0.2, 0.16, 0.42, 10), 0xd8cfc0, xb, F + 0.21, -T - 0.7); V(g, sphere(0.36, 10, 8).scale(1, 1.5, 1), 0x3f6b33, xb, F + 0.95, -T - 0.7); }
      if (R() < 0.35) { const bh = 0.3 + R() * 1.2; V(g, quad(w - 0.2, bh), 0xe7dcc6, xb, F + 0.55 + h - w / 2 - bh / 2, -T + 0.08); }
    }
  }
  if (withSign) withSign(g);
}

/* ------------------------------------------------------------------ build */
export function buildOtherCompany() {
  const site = makeSite('othercompany', 24, 18);
  const g = site.group;
  const M = starMats();
  const { G, A } = starAtlas();
  const OG = sharedOfficeAtlas().G;
  const F = FLOOR;

  // plaza + slab
  put(g, box(24, 0.04, 18), mat('pavers'), 0, 0.02, 0);
  put(g, box(21.4, 0.11, 15.4), mat('concrete'), 0, 0.095, 0);
  solid(site, 0, 0.075, 0, 22, 0.15, 16);

  // upper floors
  brickSide(g, M, OG, { x: 0, z: 8, ry: 0, len: 22, nb: 8, seed: 11 });
  brickSide(g, M, OG, { x: 0, z: -8, ry: PI, len: 22, nb: 8, seed: 12 });
  brickSide(g, M, OG, { x: 11, z: 0, ry: PI / 2, len: 16, nb: 6, seed: 13 });
  brickSide(g, M, OG, { x: -11, z: 0, ry: -PI / 2, len: 16, nb: 6, seed: 14 });
  // corner quoins cover the brick seams
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, RB(0.5, ROOF + 1.6, 0.5, 0.02, 1), M.brick, sx * 10.93, (ROOF + 1.6) / 2, sz * 7.93);
  put(g, plane(21.2, 15.2), mat('concrete'), 0, ROOF + 0.01, 0);
  // rooftop: timber water tower (a loft landmark) + pergola terrace with planters
  const wt = group(g, 7.2, ROOF, 4.0, 0.3);
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(wt, RB(0.14, 2.6, 0.14, 0.02, 1), M.steel, lx, 1.3, lz);
  for (const ly of [0.9, 2.0]) { put(wt, box(2.1, 0.08, 0.08), M.steel, 0, ly, -1); put(wt, box(2.1, 0.08, 0.08), M.steel, 0, ly, 1); put(wt, box(0.08, 0.08, 2.1), M.steel, -1, ly, 0); put(wt, box(0.08, 0.08, 2.1), M.steel, 1, ly, 0); }
  put(wt, CY(1.55, 1.55, 0.14, 28), mat('walnut'), 0, 2.67, 0);
  put(wt, CY(1.45, 1.5, 2.6, 28), mat('walnut'), 0, 4.0, 0);
  for (const ly of [3.0, 3.8, 4.6, 5.2]) put(wt, prep(new THREE.TorusGeometry(1.49, 0.03, 6, 36).rotateX(PI / 2)), M.steel, 0, ly, 0);
  put(wt, prep(new THREE.ConeGeometry(1.62, 1.1, 28, 1)), M.steel, 0, 5.85, 0);
  put(wt, CY(0.06, 0.06, 0.35, 8), M.steel, 0, 6.5, 0);
  for (let i = 0; i < 12; i++) put(wt, box(0.035, 2.4, 0.05), M.steel, Math.cos(i * 0.4) * 1.51, 4.0, Math.sin(i * 0.4) * 1.51, 0, -i * 0.4, 0);
  const pg = group(g, -5.8, ROOF, 4.6, 0);
  for (const [lx, lz] of [[-2.4, -1.4], [2.4, -1.4], [-2.4, 1.4], [2.4, 1.4]]) put(pg, RB(0.16, 2.5, 0.16, 0.02, 1), mat('oak'), lx, 1.25, lz);
  for (const lz of [-1.4, 1.4]) put(pg, RB(5.2, 0.2, 0.1, 0.02, 1), mat('oak'), 0, 2.45, lz);
  for (let i = 0; i < 11; i++) put(pg, RB(0.07, 0.14, 3.3, 0.01, 1), mat('oak'), -2.5 + i * 0.5, 2.62, 0);
  for (const lx of [-2.6, 2.6]) { put(pg, RB(0.5, 0.5, 2.6, 0.02, 1), mat('oak'), lx, 0.25, 0); for (let k = 0; k < 3; k++) shrub(pg, lx, 0.45, -0.8 + k * 0.8, 0.3, 40 + k + (lx > 0 ? 3 : 0), 6); }

  // ------------------------------------------------------------ ground floor walls
  const gfFront = rectPath(new THREE.Shape(), -11, 0, 11, 4.4);
  const openings = [[-10.3, -7.9], [-7.4, -5.0], [-4.5, -2.4], [2.4, 4.5], [5.0, 7.4], [7.9, 10.3]];
  for (const [a, b] of openings) gfFront.holes.push(rectPath(new THREE.Path(), a, 0.45, b, 3.55));
  gfFront.holes.push(rectPath(new THREE.Path(), -1.8, 0.0, 1.8, 3.3));
  put(g, extrude(gfFront, T), M.brick, 0, 0, 8 - T);
  const gfSide = (sx) => {
    const sh = rectPath(new THREE.Shape(), -8, 0, 8, 4.4);
    const ops = sx < 0 ? [[-6.6, -4.4], [-3.6, -1.4], [0.6, 2.8], [3.6, 5.8]] : [[-6.1, -3.9], [-3.2, -1.0]];
    for (const [a, b] of ops) sh.holes.push(rectPath(new THREE.Path(), a, 0.9, b, 3.4));
    const sg = group(g, sx * 11, 0, 0, sx * PI / 2);
    put(sg, extrude(sh, T), M.brick, 0, 0, -T);
    for (const [a, b] of ops) storefront(sg, M, a, b, 0.9, 3.4, -0.12);
    solid(site, sx * (11 - T / 2), 2.2, 0, T, 4.4, 16);
  };
  gfSide(-1); gfSide(1);
  const gfBack = rectPath(new THREE.Shape(), -11, 0, 11, 4.4);
  gfBack.holes.push(rectPath(new THREE.Path(), 4.0, 0.0, 5.2, 2.4));
  const bg = group(g, 0, 0, -8, PI);
  put(bg, extrude(gfBack, T), M.brick, 0, 0, -T);
  put(bg, RB(1.2, 2.4, 0.06, 0.01, 1), M.steel, 4.6, 1.2, -0.2);
  put(bg, RB(0.04, 0.3, 0.05, 0.01, 1), mat('chrome'), 4.2, 1.1, -0.15);
  put(bg, RB(1.6, 0.12, 0.6, 0.02, 1), M.steel, 4.6, 2.62, 0.25);
  put(bg, RB(1.6, 0.15, 0.9, 0.02, 1), mat('concrete'), 4.6, 0.075, 0.45);
  D(bg, CY(0.08, 0.08, 0.02, 12), M.warmGlow, 4.6, 2.55, 0.3);
  solid(site, 0, 2.2, -8 + T / 2, 22, 4.4, T);
  for (const [a, b] of openings) { storefront(g, M, a, b, 0.45, 3.55, 8 - 0.12); solid(site, (a + b) / 2, 2.2, 8 - T / 2, b - a, 4.4, T); }
  for (const [a, b] of [[-11, -10.3], [-7.9, -7.4], [-5.0, -4.5], [-2.4, -1.8], [1.8, 2.4], [4.5, 5.0], [7.4, 7.9], [10.3, 11]]) solid(site, (a + b) / 2, 2.2, 8 - T / 2, b - a, 4.4, T);
  // oak base panels under the storefronts and soldier course over them
  for (const [a, b] of openings) {
    put(g, RB(b - a, 0.4, 0.06, 0.01, 1), mat('oak'), (a + b) / 2, 0.24, 8.02);
    put(g, RB(b - a + 0.3, 0.2, 0.1, 0.01, 1), M.steel, (a + b) / 2, 3.65, 8.03);
  }
  // sign band over the ground floor + lit sign
  put(g, RB(12.4, 0.76, 0.12, 0.02, 1), M.steel, 0, 4.03, 8.07);
  D(g, G.quad('sign', 0.7 * 1600 / 260, 0.7), G.signMat, 0, 4.03, 8.134);
  site.nightGlow.push(G.signMat);

  // entrance recess (oak lined) + canopy + sliding doors
  put(g, RB(0.1, 3.3, 1.0, 0.01, 1), mat('oak'), -1.75, 1.65, 7.5);
  put(g, RB(0.1, 3.3, 1.0, 0.01, 1), mat('oak'), 1.75, 1.65, 7.5);
  for (let i = 0; i < 9; i++) put(g, RB(0.04, 0.06, 1.2, 0.01, 1), mat('walnut'), -1.6 + i * 0.4, 3.27, 7.4);
  put(g, box(3.6, 0.02, 1.2), mat('oak'), 0, 3.3, 7.4);
  solid(site, -1.75, 1.65, 7.5, 0.1, 3.3, 1.0);
  solid(site, 1.75, 1.65, 7.5, 0.1, 3.3, 1.0);
  put(g, RB(3.6, 0.5, 0.12, 0.01, 1), M.steel, 0, 3.05, 6.86);
  for (const s of [-1, 1]) {
    put(g, RB(0.08, 2.8, 0.12, 0.01, 1), M.steel, s * 1.66, 1.55, 6.86);
    const piv = group(g, s * 0.8, F, 6.76, 0);
    piv.userData.dynamic = true;
    D(piv, quad(1.5, 2.55), mat('glass'), 0, 1.35, 0);
    put(piv, RB(1.6, 0.08, 0.05, 0.01, 1), M.steel, 0, 2.62, 0);
    put(piv, RB(1.6, 0.1, 0.05, 0.01, 1), M.steel, 0, 0.06, 0);
    for (const e of [-1, 1]) put(piv, RB(0.05, 2.66, 0.05, 0.01, 1), M.steel, e * 0.775, 1.33, 0);
    put(piv, RB(0.035, 1.1, 0.04, 0.01, 1), mat('oak'), -s * 0.66, 1.15, 0.05);
    bake(piv);
    site.doors.push({ pivot: piv, openAngle: 0, slide: [s * 1.45, 0, 0], auto: true, collider: aabb(s < 0 ? -1.6 : 0, F, 6.7, s < 0 ? 0 : 1.6, 2.8, 6.82) });
  }
  // canopy
  put(g, RB(5.0, 0.14, 0.95, 0.02, 1), M.steel, 0, 3.27, 8.47);
  put(g, box(4.8, 0.02, 0.85), mat('oak'), 0, 3.195, 8.47);
  for (const cx of [-1.6, 0, 1.6]) D(g, CY(0.06, 0.06, 0.02, 12), M.warmGlow, cx, 3.182, 8.5);
  for (const sx of [-2.2, 2.2]) put(g, CY(0.02, 0.02, 1.05, 6), M.steel, sx, 3.7, 8.4, -0.9, 0, 0);
  site.lamps.push({ pos: [0, 3.0, 8.4], color: 0xffd9a8, intensity: 8, range: 8 });
  site.nightGlow.push(M.warmGlow);

  // street furniture: oak planters with grasses + lavender, bench, bike rack, wall lamps
  for (const sx of [-1, 1]) {
    const px = sx * 4.4;
    put(g, RB(3.2, 0.5, 0.75, 0.02, 2), mat('oak'), px, 0.25, 8.55);
    V(g, box(3.05, 0.02, 0.62), 0x4a3726, px, 0.48, 8.55);
    const R = rng(sx + 9);
    for (let i = 0; i < 6; i++) {
      const gx = px - 1.3 + i * 0.52;
      if (i % 2) shrub(g, gx, 0.46, 8.55, 0.22, 20 + i + sx, 0);
      else grass(g, gx, 0.47, 8.55, R);
    }
    for (let i = 0; i < 18; i++) V(g, CY(0.008, 0.008, 0.25, 4), 0x8a7ad0, px - 1.4 + R() * 2.8, 0.6, 8.35 + R() * 0.4, (R() - 0.5) * 0.3, 0, (R() - 0.5) * 0.3);
    solid(site, px, 0.3, 8.55, 3.2, 0.6, 0.75);
  }
  for (const sx of [-1, 1]) for (const lx of [6.15, 9.1]) {
    const lg = group(g, sx * lx, 2.6, 8.02, 0);
    put(lg, RB(0.16, 0.3, 0.08, 0.02, 1), M.steel, 0, 0, 0.04);
    put(lg, CY(0.09, 0.07, 0.22, 14), M.steel, 0, 0.12, 0.18, 0, 0, 0);
    D(lg, CY(0.065, 0.065, 0.01, 14), M.warmGlow, 0, 0.005, 0.18);
  }
  site.lamps.push({ pos: [-7.6, 2.4, 8.4], color: 0xffd9a8, intensity: 5, range: 6 });
  site.lamps.push({ pos: [7.6, 2.4, 8.4], color: 0xffd9a8, intensity: 5, range: 6 });
  const br = group(g, -9.2, 0.04, 8.55, 0);
  for (let i = 0; i < 4; i++) put(br, tubeU(0.36, 0.7), M.steel, -0.6 + i * 0.4, 0, 0);
  solid(site, -9.2, 0.4, 8.55, 1.6, 0.8, 0.2);

  buildInterior(site, g, M, G, A);

  site.indoor.push(aabb(-10.6, 0, -7.6, 10.6, CEIL, 6.9));
  site.nightGlow.push(OG.bdLit, M.ceilLit);
  site.spawn = { pos: [0, 0.04, 8.6], yaw: 0 };
  bake(g);
  return site;
}

/** Inverted-U bike stand. */
function tubeU(w, h) {
  const c = new THREE.CurvePath();
  c.add(new THREE.LineCurve3(new THREE.Vector3(-w / 2, 0, 0), new THREE.Vector3(-w / 2, h - w / 2, 0)));
  c.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(-w / 2, h - w / 2, 0), new THREE.Vector3(0, h + w * 0.15, 0), new THREE.Vector3(w / 2, h - w / 2, 0)));
  c.add(new THREE.LineCurve3(new THREE.Vector3(w / 2, h - w / 2, 0), new THREE.Vector3(w / 2, 0, 0)));
  return prep(new THREE.TubeGeometry(c, 24, 0.022, 8, false));
}

/** Ornamental grass tuft. */
function grass(g, x, y, z, R) {
  for (let i = 0; i < 14; i++) {
    const a = R() * PI * 2, lean = 0.15 + R() * 0.35;
    V(g, CY(0.004, 0.012, 0.42 + R() * 0.2, 4), R() < 0.5 ? 0x9aa65a : 0xc2b47a, x + Math.cos(a) * 0.04, y + 0.22, z + Math.sin(a) * 0.04, Math.sin(a) * lean, 0, -Math.cos(a) * lean);
  }
}

/** Steel storefront in an opening [a, b] x [y0, y1] (local XY), glass plane at z. */
function storefront(g, M, a, b, y0, y1, z) {
  const w = b - a, n = Math.max(2, Math.round(w / 0.85));
  D(g, quad(w, y1 - y0), M.glass, (a + b) / 2, (y0 + y1) / 2, z);
  for (let i = 0; i <= n; i++) put(g, box(0.05, y1 - y0, 0.09), M.steel, a + (i * w) / n, (y0 + y1) / 2, z);
  for (const ty of [y0 + 0.03, y1 - 0.03, y0 + (y1 - y0) * 0.72]) put(g, box(w, 0.05, 0.09), M.steel, (a + b) / 2, ty, z);
}

/* ------------------------------------------------------------------ interior */
function buildInterior(site, g, M, G, A) {
  const F = FLOOR;
  // floors, ceiling, exposed services
  put(g, plane(21.2, 14.6), M.concreteFloor, 0, F + 0.001, -0.5);
  put(g, plane(5.6, 5.8), mat('oakFloor'), -7.75, F + 0.003, 3.85);
  put(g, plane(8.4, 6.1), mat('darkFloor'), 6.4, F + 0.003, -4.55);
  put(g, plane(21.2, 14.6).rotateX(PI), M.ceil, 0, CEIL, -0.5);
  for (const dz of [2.4, -4.4]) { put(g, CY(0.28, 0.28, 20.6, 20), mat('steel'), 0, CEIL - 0.45, dz, 0, 0, PI / 2); for (let i = -4; i <= 4; i++) put(g, CY(0.3, 0.3, 0.06, 20), mat('steel'), i * 2.3, CEIL - 0.45, dz, 0, 0, PI / 2); }
  for (const dx of [-6, 0, 6]) { put(g, CY(0.018, 0.018, 0.35, 6), M.steel, dx, CEIL - 0.6 - 0.01, 2.4); }
  // timber beams across the ceiling + steel posts
  for (let i = 0; i < 7; i++) { const bx = -9 + i * 3; put(g, RB(0.24, 0.32, 15.16, 0.02, 2), mat('walnut'), bx, CEIL - 0.16, 0); }
  put(g, RB(4.2, 0.012, 2.8, 0.004, 1), mat('carpetWarm'), 0, F + 0.008, 4.0);
  // track lights
  for (const tz of [4.8, 0.4]) {
    put(g, RB(14, 0.04, 0.06, 0.01, 1), M.steel, -1.5, CEIL - 0.03, tz);
    for (let i = 0; i < 9; i++) {
      const tx = -8 + i * 1.6;
      put(g, CY(0.045, 0.04, 0.16, 12), M.steel, tx, CEIL - 0.13, tz, 0.5, 0, 0);
      D(g, CY(0.035, 0.035, 0.01, 12), M.warmGlow, tx, CEIL - 0.21, tz + 0.04, 0.5, 0, 0);
    }
  }
  // inner back wall feature: brick is the extruded wall; add a lit logo on it (above the café)
  D(g, G.quad('logoWall', 3.6, 1.375), G.logoMat, -6.6, 2.85, -7.6 + 0.012);

  /* ---- reception ---- */
  const rc = group(g, 0, F, 1.4, 0);
  put(rc, RB(2.8, 1.02, 0.7, 0.03, 2), mat('concrete'), 0, 0.51, 0);
  for (let i = 0; i < 14; i++) put(rc, RB(0.12, 0.98, 0.04, 0.01, 1), mat('oak'), -1.3 + i * 0.2, 0.5, 0.36);
  put(rc, RB(2.95, 0.05, 0.8, 0.02, 2), mat('walnut'), 0, 1.045, 0);
  laptop(rc, -0.4, 1.07, -0.12, PI + 0.2, G, 'scr4');
  pottedPlant(rc, 1.05, 1.07, -0.1, { kind: 'herb', h: 0.25, potR: 0.07, potH: 0.11, pot: 0xd8cfc0, seed: 5 });
  V(rc, CY(0.09, 0.07, 0.03, 18), 0xd8b25a, 0.55, 1.085, 0.1, 0, 0, 0, vcGloss());
  for (let i = 0; i < 4; i++) V(rc, box(0.09, 0.003, 0.055), [0xffd36b, 0x7fb8ff, 0xffffff, 0xffd36b][i], 0.5 + (i % 2) * 0.1, 1.105, 0.08 + (i > 1 ? 0.07 : 0), 0, i * 0.2, 0);
  solid(site, 0, 0.55, 1.4, 2.95, 1.1, 0.8);
  site.npcSpots.push({ pos: [0.3, F, 0.6], yaw: PI, pose: 'stand', role: 'receptionist' });
  site.lamps.push({ pos: pendant(g, -0.7, 2.3, 1.4, CEIL, { r: 0.18, shade: 0xc9a25a }), color: 0xffd9a8, intensity: 6, range: 7 });
  pendant(g, 0.7, 2.3, 1.4, CEIL, { r: 0.18, shade: 0xc9a25a });

  /* ---- lounge (front-left) ---- */
  put(g, RB(3.6, 0.012, 2.6, 0.004, 1), mat('carpetWarm'), -7.6, F + 0.008, 4.2);
  sofa(g, -9.85, F, 4.2, PI / 2, { w: 2.4, fabric: mat('leatherBrown'), legs: mat('walnut'), pillows: [0xe0b25a, 0x2f4a6a, 0xf1ece4] });
  solid(site, -9.85, 0.45, 4.2, 0.9, 0.9, 2.4);
  for (const az of [3.4, 5.0]) armchair(g, -5.4, F, az, -PI / 2 + (az > 4 ? 0.2 : -0.2));
  solid(site, -5.4, 0.4, 4.2, 0.8, 0.8, 2.6);
  const ct = group(g, -7.6, F, 4.2, 0);
  put(ct, CY(0.55, 0.55, 0.05, 32), mat('walnut'), 0, 0.42, 0);
  put(ct, CY(0.06, 0.08, 0.4, 12), M.steel, 0, 0.2, 0);
  put(ct, CY(0.3, 0.3, 0.02, 24), M.steel, 0, 0.01, 0);
  D(ct, A.quad('book', 0.2, 0.27).rotateX(-PI / 2), A.mat, -0.15, 0.448, 0.1, 0, 0.4, 0);
  V(ct, box(0.2, 0.004, 0.27), 0xffffff, -0.15, 0.4465, 0.1, 0, 0.4, 0);
  mug(ct, 0.2, 0.445, -0.1, 0xf2c14e, 0.5);
  mug(ct, 0.28, 0.445, 0.12, 0xffffff, 2.0);
  solid(site, -7.6, 0.3, 4.2, 1.1, 0.6, 1.1);
  floorLamp(g, M, -9.9, F, 6.0);
  floorLamp(g, M, -9.9, F, 2.3);
  site.lamps.push({ pos: [-9.6, 1.7, 6.0], color: 0xffd9a8, intensity: 4, range: 5 });
  bookshelf(g, -6.6, F, 7.38, PI, { w: 1.8, h: 2.1, seed: 31, wood: mat('walnut') });
  solid(site, -6.6, 1.05, 7.38, 1.8, 2.1, 0.4);
  pottedPlant(g, -4.9, F, 7.2, { kind: 'fig', h: 1.8, potR: 0.24, potH: 0.45, pot: 'terracotta', seed: 7 });
  pottedPlant(g, -10.1, F, 0.9, { kind: 'palm', h: 1.5, potR: 0.22, potH: 0.42, pot: 'charcoal', seed: 8 });
  solid(site, -4.9, 0.5, 7.2, 0.5, 1.0, 0.5);
  solid(site, -10.1, 0.5, 0.9, 0.5, 1.0, 0.5);
  site.npcSpots.push({ pos: [-9.75, F, 4.6], yaw: -PI / 2, pose: 'sit', role: 'visitor' });

  /* ---- café bar (back-left) ---- */
  const cb = group(g, -6.6, F, -6.95, 0);
  put(cb, RB(5.6, 0.9, 0.62, 0.015, 2), mat('walnut'), 0, 0.45, 0);
  put(cb, RB(5.7, 0.04, 0.66, 0.012, 2), mat('concrete'), 0, 0.92, 0);
  const cm = group(cb, -1.2, 0.94, -0.05, 0);
  put(cm, RB(0.5, 0.46, 0.42, 0.03, 2), mat('steel'), 0, 0.23, 0);
  put(cm, RB(0.48, 0.08, 0.4, 0.02, 1), blackPl(), 0, 0.5, 0);
  for (const sx of [-0.12, 0.12]) put(cm, CY(0.03, 0.03, 0.08, 10), blackPl(), sx, 0.12, 0.24, PI / 2, 0, 0);
  mug(cm, -0.12, 0.0, 0.18, 0xffffff, 0, false);
  for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) mug(cb, 0.4 + i * 0.13, 0.94 + k * 0.1, -0.1, [0xffffff, 0x2f4a6a, 0xe2b04a, 0xffffff][i], 0.3, false);
  V(cb, CY(0.1, 0.1, 0.24, 18), 0xf3efe6, 1.6, 1.06, 0, 0, 0, 0, vcGloss());
  for (let i = 0; i < 6; i++) V(cb, SPc(), [0xc98f52, 0xe0b25a][i % 2], 1.55 + (i % 3) * 0.05, 1.19 + Math.floor(i / 3) * 0.03, -0.02 + (i % 2) * 0.04);
  // open shelves on the brick above the back counter
  for (const sy of [1.55, 2.0]) {
    put(g, RB(2.4, 0.04, 0.26, 0.01, 1), mat('oak'), -4.6, sy, -7.45);
    for (let i = 0; i < 8; i++) {
      const sx = -5.6 + i * 0.28;
      if (i % 3 === 0) V(g, CY(0.05, 0.05, 0.16, 14), [0xe9e2d0, 0xc9805a, 0x2f6f73][i % 3], sx, sy + 0.1, -7.45, 0, 0, 0, vcGloss());
      else mug(g, sx, sy + 0.02, -7.45, [0xffffff, 0xe2b04a, 0x2f4a6a][i % 3], 0.4, false);
    }
  }
  D(g, G.quad('cafeMenu', 1.3, 0.75), G.mat, -9.0, 1.9, -7.6 + 0.012);
  solid(site, -6.6, 0.5, -6.95, 5.7, 1.0, 0.66);
  // island bar + stools
  const ib = group(g, -6.6, F, -4.9, 0);
  put(ib, RB(4.2, 1.02, 0.55, 0.02, 2), mat('oak'), 0, 0.51, 0);
  put(ib, RB(4.4, 0.05, 0.7, 0.015, 2), mat('walnut'), 0, 1.045, 0);
  for (let i = 0; i < 4; i++) stool(ib, -1.5 + i * 1.0, 0, 0.75, M);
  mug(ib, -1.4, 1.07, 0.15, 0xffffff, 0.4);
  laptop(ib, 0.6, 1.07, 0.1, PI, G, 'scr3');
  solid(site, -6.6, 0.55, -4.9, 4.4, 1.1, 0.7);
  for (const px of [-8.6, -6.6, -4.6]) site.lamps.push({ pos: pendant(g, px, 2.25, -4.9, CEIL, { r: 0.16, shade: 0x1f2125 }), color: 0xffd9a8, intensity: 5, range: 6 });
  site.npcSpots.push({ pos: [-7.8, F, -6.3], yaw: PI, pose: 'stand', role: 'barista' });
  site.npcSpots.push({ pos: [-5.1, F, -4.15], yaw: 0, pose: 'sit', role: 'worker' });

  /* ---- indoor tree with bench (front-right) ---- */
  const tr = group(g, 6.2, F, 3.4, 0);
  put(tr, CY(1.1, 1.15, 0.45, 32), mat('oak'), 0, 0.225, 0);
  put(tr, CY(1.16, 1.16, 0.04, 32), mat('walnut'), 0, 0.47, 0);
  V(tr, CY(0.95, 0.95, 0.02, 28), 0x3a2a1e, 0, 0.49, 0);
  V(tr, CY(0.06, 0.1, 2.2, 10), 0x6b5137, 0, 1.55, 0);
  for (let i = 0; i < 3; i++) V(tr, CY(0.03, 0.05, 1.0, 8), 0x6b5137, Math.cos(i * 2.1) * 0.3, 2.3, Math.sin(i * 2.1) * 0.3, Math.sin(i * 2.1) * 0.6, 0, -Math.cos(i * 2.1) * 0.6);
  const TR = rng(41);
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9 + TR() * 0.4, rad = i === 0 ? 0 : 0.45 + TR() * 0.25;
    leafyCrown(tr, Math.cos(a) * rad, 2.75 + (i === 0 ? 0.45 : TR() * 0.4), Math.sin(a) * rad, 0.5 + TR() * 0.15, 55, TR);
  }
  for (let i = 0; i < 6; i++) pottedPlant(tr, Math.cos(i * 1.05) * 0.7, 0.49, Math.sin(i * 1.05) * 0.7, { kind: 'bush', h: 0.35, potR: 0.001, potH: 0.001, pot: 0x3a2a1e, seed: 80 + i });
  solid(site, 6.2, 0.3, 3.4, 2.2, 0.6, 2.2);
  site.lamps.push({ pos: [6.2, 3.3, 3.4], color: 0xfff1dc, intensity: 6, range: 7 });
  // telescope by the window + star map posters on the brick
  const ts = group(g, 9.3, F, 6.4, -0.6);
  for (let i = 0; i < 3; i++) put(ts, CY(0.012, 0.012, 1.25, 6), M.steel, Math.cos(i * 2.1) * 0.22, 0.6, Math.sin(i * 2.1) * 0.22, Math.sin(i * 2.1) * 0.33, 0, -Math.cos(i * 2.1) * 0.33);
  put(ts, CY(0.07, 0.06, 0.9, 18), whitePl(), 0, 1.35, 0.1, 1.1, 0, 0);
  put(ts, CY(0.075, 0.075, 0.08, 18), blackPl(), 0, 1.53, 0.5, 1.1, 0, 0);
  solid(site, 9.3, 0.6, 6.4, 0.6, 1.2, 0.6);
  D(g, A.quad('starmap', 0.72, 1.0), A.mat, 10.6 - 0.012, 1.9, 0.0, 0, -PI / 2, 0);
  D(g, A.quad('photoTeam', 0.75, 0.5), A.mat, 10.6 - 0.012, 1.8, -0.9, 0, -PI / 2, 0);
  pottedPlant(g, 2.6, F, 7.2, { kind: 'snake', h: 0.9, potR: 0.2, potH: 0.4, pot: 'charcoal', seed: 9 });
  solid(site, 2.6, 0.5, 7.2, 0.45, 1.0, 0.45);
  // bench along the right wall front
  const bn = group(g, 9.9, F, 3.6, -PI / 2);
  put(bn, RB(2.2, 0.06, 0.45, 0.015, 2), mat('oak'), 0, 0.45, 0);
  for (const s of [-0.9, 0.9]) put(bn, RB(0.06, 0.42, 0.4, 0.01, 1), M.steel, s, 0.21, 0);
  solid(site, 9.9, 0.25, 3.6, 0.5, 0.5, 2.2);

  // product display: star projector on an oak plinth with brochures
  const pd = group(g, 0.4, F, -3.6, 0);
  put(pd, RB(1.0, 0.85, 1.0, 0.02, 2), mat('oak'), 0, 0.425, 0);
  put(pd, RB(1.04, 0.03, 1.04, 0.01, 1), mat('walnut'), 0, 0.865, 0);
  V(pd, sphere(0.2, 24, 16), 0x1d2235, 0, 1.08, 0, 0, 0, 0, vcGloss());
  put(pd, CY(0.16, 0.2, 0.08, 20), blackPl(), 0, 0.92, 0);
  const PR = rng(77);
  for (let i = 0; i < 26; i++) { const u = PR() * 0.9 + 0.05, th = PR() * PI * 2, sr = Math.sqrt(1 - u * u); D(pd, CY(0.008, 0.008, 0.004, 6), M.warmGlow, Math.cos(th) * sr * 0.2, 1.08 + u * 0.2, Math.sin(th) * sr * 0.2, Math.atan2(Math.hypot(Math.cos(th) * sr, Math.sin(th) * sr), u) * 0, 0, 0); }
  for (let i = 0; i < 3; i++) { D(pd, A.quad('book', 0.15, 0.2).rotateX(-PI / 2), A.mat, -0.3 + i * 0.05, 0.884 + i * 0.002, 0.3, 0, 0.3 - i * 0.3, 0); }
  solid(site, 0.4, 0.45, -3.6, 1.04, 0.9, 1.04);
  site.lamps.push({ pos: [0.4, 3.2, -3.6], color: 0xfff1dc, intensity: 5, range: 6 });

  /* ---- glass meeting room (back-right) x 2..10.6, z -7.6..-1.4 ---- */
  const mx0 = 2.0, mz1 = -1.4;
  // glass walls with black steel grid and a frosted star band
  const gw = (x0, z0, x1, z1, door) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(-(z1 - z0), x1 - x0);
    const wg = group(g, (x0 + x1) / 2, F, (z0 + z1) / 2, ry);
    const segs = door ? [[-len / 2, door[0]], [door[1], len / 2]] : [[-len / 2, len / 2]];
    for (const [a, b] of segs) {
      D(wg, quad(b - a, CEIL - F), mat('glass'), (a + b) / 2, (CEIL - F) / 2, 0);
      D(wg, box(b - a, 0.16, 0.012), M.frost, (a + b) / 2, 1.3, 0);
      const n = Math.max(1, Math.round((b - a) / 1.2));
      for (let i = 0; i <= n; i++) put(wg, box(0.05, CEIL - F, 0.07), M.steel, a + ((b - a) * i) / n, (CEIL - F) / 2, 0);
      put(wg, box(b - a, 0.06, 0.08), M.steel, (a + b) / 2, 0.03, 0);
      const cx = (a + b) / 2;
      const wp = new THREE.Vector3(cx, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
      solid(site, (x0 + x1) / 2 + wp.x, 1.9, (z0 + z1) / 2 + wp.z, Math.abs(Math.cos(ry)) * (b - a) + 0.1, 3.6, Math.abs(Math.sin(ry)) * (b - a) + 0.1);
    }
    if (door) put(wg, box(door[1] - door[0], CEIL - F - 2.3, 0.07), M.steel, (door[0] + door[1]) / 2, CEIL - F - (CEIL - F - 2.3) / 2, 0);
    return wg;
  };
  const front = gw(mx0, mz1, 10.6, mz1, [-3.6, -2.5]);
  D(front, A.quad('roomSign', 0.5, 0.125), A.mat, -1.9, 1.75, 0.04);
  gw(mx0, -7.6, mx0, mz1, null);
  // table, chairs, screen
  const mt = meetingTable(g, 7.7, F, -4.5, { len: 3.4, wid: 1.3, A, G, chairs: 3, seed: 3, laptops: 2, client: true, top: mat('walnut') });
  solid(site, 7.7, 0.4, -4.5, 3.4, 0.8, 1.3);
  for (const sp of mt.spots) site.npcSpots.push({ pos: sp.pos, yaw: sp.yaw, pose: 'sit', role: 'client' });
  officeChair(g, 5.55, F, -4.5, PI / 2);
  officeChair(g, 9.9, F, -5.9, -PI / 2 - 0.5);
  const scrW = 3.2, scrH = 1.8, scrY = 1.85, scrX = 10.6 - 0.012;
  wallScreen(g, scrX, scrY, -4.5, -PI / 2, G, 'present', scrW, scrH);
  const faceX = scrX - 0.0505;
  const eye = [5.62, F + 1.2, -4.5];
  site.interactables.push({
    id: 'meeting', label: '회의하기', pos: [5.4, 1.2, -4.5], radius: 1.4,
    seat: { pos: eye, yaw: -PI / 2, pitch: Math.atan2(scrY - eye[1], faceX - eye[0]) },
    screen: { center: [faceX, scrY, -4.5], w: scrW, h: scrH, yaw: -PI / 2 },
  });
  // credenza with water + cups behind the head chair, plant, whiteboard on the back brick wall
  const cr = group(g, 2.45, F, -4.5, PI / 2);
  put(cr, RB(2.6, 0.75, 0.45, 0.015, 2), mat('walnut'), 0, 0.375, 0);
  for (let i = 0; i < 5; i++) V(cr, cyl2(), 0xf6f3ec, -0.9 + i * 0.12, 0.79, 0.05, 0, 0, 0, vcGloss());
  V(cr, CY(0.08, 0.08, 0.3, 18), 0xd6eef5, 0.4, 0.9, 0, 0, 0, 0, vcGloss());
  pottedPlant(cr, 1.0, 0.75, 0, { kind: 'bush', h: 0.4, potR: 0.1, potH: 0.15, pot: 'white', seed: 12 });
  solid(site, 2.45, 0.4, -4.5, 0.45, 0.8, 2.6);
  pottedPlant(g, 10.1, F, -2.0, { kind: 'fig', h: 1.6, potR: 0.22, potH: 0.42, pot: 'stone', seed: 13 });
  pottedPlant(g, 10.1, F, -7.1, { kind: 'snake', h: 0.9, potR: 0.2, potH: 0.4, pot: 'charcoal', seed: 14 });
  solid(site, 10.1, 0.5, -2.0, 0.45, 1.0, 0.45);
  solid(site, 10.1, 0.5, -7.1, 0.45, 1.0, 0.45);
  for (const px of [6.6, 8.8]) {
    for (const s of [-0.5, 0.5]) put(g, CY(0.003, 0.003, 0.7, 4), blackPl(), px + s, CEIL - 0.35, -4.5);
    put(g, RB(1.3, 0.05, 0.12, 0.02, 1), M.steel, px, CEIL - 0.72, -4.5);
    D(g, box(1.24, 0.006, 0.07), M.warmGlow, px, CEIL - 0.746, -4.5);
  }
  site.lamps.push({ pos: [7.7, 2.5, -4.5], color: 0xfff1dc, intensity: 8, range: 7 });
  D(g, A.quad('starmap', 0.6, 0.83), A.mat, 4.6, 1.9, -7.6 + 0.012);
  D(g, G.quad('exit', 0.36, 0.147), G.mat, 4.6, 2.65, -7.6 + 0.012);
}

/* small props */
function SPc() { return CY(0.025, 0.025, 0.012, 10); }
function cyl2() { return CY(0.035, 0.03, 0.1, 12); }
function armchair(g, x, y, z, ry) {
  const a = group(g, x, y, z, ry);
  const lth = mat('leatherBrown');
  put(a, RB(0.8, 0.22, 0.78, 0.05, 2), lth, 0, 0.3, 0);
  put(a, RB(0.62, 0.14, 0.6, 0.05, 2), lth, 0, 0.47, 0.06);
  const b = group(a, 0, 0.66, -0.3, 0); b.rotation.x = -0.2;
  put(b, RB(0.8, 0.5, 0.16, 0.06, 2), lth, 0, 0, 0);
  for (const s of [-1, 1]) put(a, RB(0.12, 0.3, 0.74, 0.04, 2), lth, s * 0.36, 0.52, 0.02);
  for (const s of [-1, 1]) for (const t of [-1, 1]) put(a, CY(0.018, 0.014, 0.2, 8), mat('walnut'), s * 0.33, 0.1, t * 0.3);
  V(a, RB(0.36, 0.34, 0.12, 0.06, 2), 0x2f4a6a, 0, 0.66, -0.16, -0.25, 0, 0, vcSoft());
}
function floorLamp(g, M, x, y, z) {
  const l = group(g, x, y, z, 0);
  put(l, CY(0.16, 0.18, 0.03, 20), M.steel, 0, 0.015, 0);
  put(l, CY(0.012, 0.012, 1.55, 8), M.steel, 0, 0.8, 0);
  V(l, CY(0.2, 0.26, 0.3, 24, true), 0xe8dcc6, 0, 1.6, 0, 0, 0, 0, vcSoft());
  D(l, CY(0.19, 0.19, 0.01, 20), M.warmGlow, 0, 1.47, 0);
}
function stool(g, x, y, z, M) {
  const s = group(g, x, y, z, 0);
  put(s, CY(0.19, 0.19, 0.05, 20), mat('oak'), 0, 0.76, 0);
  for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; put(s, CY(0.012, 0.012, 0.78, 6), M.steel, Math.cos(a) * 0.14, 0.38, Math.sin(a) * 0.14, Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12); }
  put(s, prep(new THREE.TorusGeometry(0.15, 0.01, 6, 20).rotateX(PI / 2)), M.steel, 0, 0.3, 0);
}
