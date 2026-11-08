// A small Japanese town street for the Japan trip: shrine, ramen shop, ryokan (with an outdoor onsen)
// and a souvenir shop. Site contract: ../site.js (origin = footprint centre at ground level, entrance
// faces +Z). Shared Japan kit (materials, text, sweep, polyLathe) and street props: ../props/japan.js.
import * as THREE from 'three';
import { mat, paint, glow } from '../mat.js';
import { box, cyl, sphere, torus, lathe, extrude, tube, plane, quad, prep, put, group, bake, aabb } from '../geom.js';
import { canvasTex } from '../tex.js';
import { makeSite, solid } from '../site.js';
import { cushion, drape, bolster, painted, clothMat, printMat } from '../soft.js';
import { rng } from '../noise.js';
import { RB, CY, SP, V, D, tint, vcMat, vcGloss, vcSoft, vcLeaf, cached, leafGeo } from './office.js';
import { JM, JFONT, jtxt, vtxt, rrect, grime, rsec, sweep, polyLathe, stoneLantern, paperLantern, bambooFence, signBoard, bicycle, vendingMachine } from '../props/japan.js';
import { tree, rock } from '../props/nature.js';

const PI = Math.PI, TAU = PI * 2;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/* ================================================================== shared helpers */
/** Vertical timber post with the grain running up it. */
function post(g, m, x, y0, y1, z, w = 0.2, d = w) { return put(g, RB(y1 - y0, w, d, 0.02, 1), m, x, (y0 + y1) / 2, z, 0, 0, PI / 2); }
/** Box from extents (+ collider). */
function blk(site, g, m, x0, x1, y0, y1, z0, z1, col = true, r = 0.02) {
  put(g, RB(x1 - x0, y1 - y0, z1 - z0, r, 1), m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  if (col && site) solid(site, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0);
}
function gridGeo(nx, nd, fn, wantUp = 1) {
  const pos = new Float32Array((nx + 1) * (nd + 1) * 3);
  let o = 0;
  for (let j = 0; j <= nd; j++) for (let i = 0; i <= nx; i++) { const p = fn(i / nx, j / nd); pos[o++] = p[0]; pos[o++] = p[1]; pos[o++] = p[2]; }
  const idx = [];
  for (let j = 0; j < nd; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 2, d = a + nx + 1;
    idx.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  let v = 0; const n = g.attributes.normal; for (let i = 0; i < n.count; i += 7) v += n.getY(i);
  if (Math.sign(v) !== Math.sign(wantUp)) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
  return prep(g);
}
/**
 * Japanese tiled roof with concave slopes and lifted corners, ridge along X.
 * o: {x0, x1, ridgeY, ridgeZ, front (run to the +Z eave), back (run to the -Z eave, 0 = lean-to), slope, sag, lift, ridge}
 * Returns yAt(x, z) of the tile surface.
 */
function curvedRoof(g, o) {
  const M = JM();
  const { x0, x1, ridgeY, ridgeZ, front, back = 0, slope = 0.6, sag = 0.04, lift = 0.3, th = 0.16, ridge = true } = o;
  const hw = (x1 - x0) / 2, cx = (x0 + x1) / 2;
  const base = (x, d, run) => ridgeY - slope * d + sag * d * d + lift * Math.pow(Math.abs(x - cx) / hw, 4) * Math.pow(d / run, 2);
  const P = 0.27, bump = (x) => { const u = (((x - x0) / P) % 1 + 1) % 1, t = (u - 0.5) / 0.24; return Math.abs(t) < 1 ? 0.05 * Math.sqrt(1 - t * t) : -0.006; };
  const per = Math.round((x1 - x0) / P);
  for (const [run, s] of [[front, 1], [back, -1]]) {
    if (run <= 0) continue;
    const nd = Math.max(6, Math.round(run * 3));
    put(g, gridGeo(per * 6, nd, (u, v) => { const x = x0 + u * (x1 - x0), d = v * run; return [x, base(x, d, run) + bump(x), ridgeZ + s * d]; }, 1), M.tile);
    put(g, gridGeo(16, nd, (u, v) => { const x = x0 + u * (x1 - x0), d = v * run; return [x, base(x, d, run) - th, ridgeZ + s * d]; }, -1), M.timber);
    // eave fascia + round end tiles
    const ep = [];
    for (let i = 0; i <= 24; i++) { const x = x0 - 0.02 + (i / 24) * (x1 - x0 + 0.04); ep.push(V3(x, base(x, run, run) - th * 0.55, ridgeZ + s * (run + 0.02))); }
    put(g, sweep(rsec(0.09, th + 0.08, 0.02), ep), M.timber);
    for (let k = 0; k < per; k++) {
      const x = x0 + (k + 0.5) * P;
      V(g, CY(0.052, 0.052, 0.035, 12), 0x3a3e44, x, base(x, run, run) + 0.03, ridgeZ + s * (run + 0.03), PI / 2, 0, 0, vcGloss());
    }
    // gable barge boards
    for (const xe of [x0 - 0.04, x1 + 0.04]) {
      const bp = [];
      for (let j = 0; j <= 10; j++) { const d = (j / 10) * (run + 0.04); bp.push(V3(xe, base(xe, d, run) - th * 0.3, ridgeZ + s * d)); }
      put(g, sweep(rsec(0.08, th + 0.16, 0.02), bp, V3(1, 0, 0)), M.timber);
    }
  }
  if (ridge) {
    const k = Math.min(1, Math.max(0.45, (x1 - x0) / 10));
    const rp = [];
    for (let i = 0; i <= 20; i++) { const u = i / 20, x = x0 - 0.15 * k + u * (x1 - x0 + 0.3 * k); const e = Math.pow(Math.abs(u - 0.5) * 2, 6); rp.push(V3(x, ridgeY + 0.12 * k + e * 0.32 * k, ridgeZ)); }
    put(g, sweep(rsec(0.34 * k, 0.3 * k, 0.08 * k), rp), M.tile);
    put(g, sweep(rsec(0.38 * k, 0.06 * k, 0.02 * k), rp.map((p) => p.clone().setY(p.y - 0.16 * k))), paint(0xe8e4dc, 0.6));
    for (const xe of [x0 - 0.2 * k, x1 + 0.2 * k]) put(g, RB(0.16 * k, 0.62 * k, 0.5 * k, 0.06 * k, 2), M.tile, xe, ridgeY + 0.5 * k, ridgeZ);
  }
  return (x, z) => { const d = Math.abs(z - ridgeZ), run = z > ridgeZ ? front : back; return base(x, Math.min(d, run), run); };
}
/** Plaster gable infill whose top follows the roof underside (yAt from curvedRoof), at x (thickness t towards -x). */
function gable(g, m, x, zA, zB, yBot, yAt, drop, t = 0.14) {
  const sh = new THREE.Shape();
  sh.moveTo(zA, yBot); sh.lineTo(zB, yBot);
  for (let i = 0; i <= 24; i++) { const z = zB + (zA - zB) * (i / 24); sh.lineTo(z, Math.max(yBot, yAt(x, z) - drop)); }
  sh.closePath();
  const mm = put(g, extrude(sh, t), m, 0, 0, 0, 0, -PI / 2, 0);
  mm.position.x = x;
  return mm;
}
/** Plaster wall panel framed in timber between two posts (x0..x1), with optional lattice window. */
function framedWall(site, g, M, x0, x1, y0, y1, z, t = 0.14, rot = false) {
  const p = rot ? (a, b, c, d, e, f) => [c, d, a, b, e, f] : (a, b, c, d, e, f) => [a, b, c, d, e, f];
  const [ax0, ax1, , , az0, az1] = p(x0, x1, y0, y1, z - t / 2, z + t / 2);
  void ax0; void ax1; void az0; void az1;
  if (!rot) {
    blk(site, g, M.plaster, x0, x1, y0, y1, z - t / 2, z + t / 2);
    put(g, RB(x1 - x0, 0.12, t + 0.04, 0.015, 1), M.timber, (x0 + x1) / 2, y0 + 0.06, z);
    put(g, RB(x1 - x0, 0.1, t + 0.04, 0.015, 1), M.timber, (x0 + x1) / 2, y1 - 0.05, z);
  } else {
    blk(site, g, M.plaster, z - t / 2, z + t / 2, y0, y1, x0, x1);
    put(g, RB(t + 0.04, 0.12, x1 - x0, 0.015, 1), M.timber, z, y0 + 0.06, (x0 + x1) / 2);
    put(g, RB(t + 0.04, 0.1, x1 - x0, 0.015, 1), M.timber, z, y1 - 0.05, (x0 + x1) / 2);
  }
}
/** Shoji / lattice panel in the XY plane (w x h) centred at (x, y, z): glowing washi behind a kumiko grid. */
function shoji(g, M, x, y, z, w, h, ry = 0, nx = 4, ny = 6) {
  const s = group(g, x, y, z, ry);
  put(s, plane(w - 0.06, h - 0.06).rotateX(PI / 2), M.washi, 0, 0, -0.005).castShadow = false;
  for (const sx of [-1, 1]) put(s, RB(h, 0.04, 0.05, 0.008, 1), M.oak, sx * (w / 2 - 0.02), 0, 0, 0, 0, PI / 2);
  for (const sy of [-1, 1]) put(s, RB(w, 0.045, 0.05, 0.008, 1), M.oak, 0, sy * (h / 2 - 0.022), 0);
  for (let i = 1; i < nx; i++) put(s, box(0.014, h - 0.06, 0.024), M.oak, -w / 2 + (i * w) / nx, 0, 0.004);
  for (let j = 1; j < ny; j++) put(s, box(w - 0.06, 0.014, 0.024), M.oak, 0, -h / 2 + (j * h) / ny, 0.004);
  return s;
}
/** Sliding door leaf group (dynamic) for site.doors. */
function slideDoor(site, g, M, x, y, z, w, h, dx, glassy = true) {
  const piv = group(g, x, y, z, 0);
  piv.userData.dynamic = true;
  for (const sx of [-1, 1]) put(piv, RB(h, 0.06, 0.05, 0.01, 1), M.timber, sx * (w / 2 - 0.03), h / 2, 0, 0, 0, PI / 2);
  for (const yy of [0.05, 0.95, h - 0.04]) put(piv, RB(w, 0.07, 0.05, 0.01, 1), M.timber, 0, yy, 0);
  put(piv, RB(w - 0.1, 0.84, 0.03, 0.006, 1), M.oak, 0, 0.5, 0);
  if (glassy) D(piv, quad(w - 0.1, h - 1.04), M.glass, 0, (h + 0.95) / 2, 0.005);
  for (let i = 1; i < 4; i++) put(piv, box(0.016, h - 1.04, 0.035), M.timber, -w / 2 + (i * w) / 4, (h + 0.95) / 2, 0);
  for (let j = 1; j < 4; j++) put(piv, box(w - 0.1, 0.016, 0.035), M.timber, 0, 0.95 + (j * (h - 0.99)) / 4, 0);
  bake(piv);
  site.doors.push({ pivot: piv, openAngle: 0, slide: [dx, 0, 0], auto: true, collider: aabb(x - w / 2, y, z - 0.05, x + w / 2, y + h, z + 0.05) });
  return piv;
}
/** Hanging noren curtain (3 strips) under a rod, centred at x, top at y, facing +Z. */
function noren(g, A, x, y, z, w, h, key) {
  put(g, CY(0.015, 0.015, w + 0.2, 8), JM().timber, x, y + 0.02, z, 0, 0, PI / 2);
  const n = 3, sw = (w - 0.04 * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const geo = new THREE.PlaneGeometry(sw, h, 2, 4);
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) p.setZ(k, Math.sin(p.getY(k) * 3 + i) * 0.012 * (0.5 - p.getY(k) / h));
    geo.computeVertexNormals();
    const pg = prep(geo, true);
    A.mapSub(pg, key, i / n, (i + 1) / n);
    const m = put(g, pg, A.cloth, x - w / 2 + sw / 2 + i * (sw + 0.04), y - h / 2, z);
    m.castShadow = true;
  }
}

/* ================================================================== atlases */
class JAtlas {
  constructor(size) { this.size = size; this.jobs = []; this.items = new Map(); }
  add(key, w, h, draw) { this.jobs.push({ key, w, h, draw }); return this; }
  build() {
    const S = this.size, pad = 6;
    let x = pad, y = pad, rowH = 0;
    for (const j of [...this.jobs].sort((a, b) => b.h - a.h)) {
      if (x + j.w + pad > S) { x = pad; y += rowH + pad; rowH = 0; }
      j.x = x; j.y = y; this.items.set(j.key, j); x += j.w + pad; rowH = Math.max(rowH, j.h);
    }
    this.tex = canvasTex(S, S, (c) => { for (const r of this.jobs) { c.save(); c.translate(r.x, r.y); c.beginPath(); c.rect(0, 0, r.w, r.h); c.clip(); r.draw(c, r.w, r.h); c.restore(); } });
    return this;
  }
  mapSub(geo, key, u0 = 0, u1 = 1) {
    const r = this.items.get(key), S = this.size, uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) { const u = u0 + uv.getX(i) * (u1 - u0), v = uv.getY(i); uv.setXY(i, (r.x + u * r.w) / S, 1 - (r.y + (1 - v) * r.h) / S); }
    uv.needsUpdate = true; return geo;
  }
  quad(key, w, h) { return this.mapSub(quad(w, h), key); }
}
function wood(c, x, y, w, h, base, R) {
  c.fillStyle = base; c.fillRect(x, y, w, h);
  for (let i = 0; i < w / 3; i++) { c.fillStyle = `rgba(60,35,15,${0.04 + R() * 0.1})`; c.fillRect(x + R() * w, y, 1 + R() * 2, h); }
}
function fujiPic(c, x, y, w, h, sky = '#9fd0f0') {
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, sky); g.addColorStop(1, '#fbe6d6');
  c.fillStyle = g; c.fillRect(x, y, w, h);
  c.fillStyle = '#4b6a9a'; c.beginPath(); c.moveTo(x, y + h); c.lineTo(x + w * 0.42, y + h * 0.28); c.lineTo(x + w * 0.58, y + h * 0.28); c.lineTo(x + w, y + h); c.fill();
  c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(x + w * 0.42, y + h * 0.28); c.lineTo(x + w * 0.58, y + h * 0.28); c.lineTo(x + w * 0.66, y + h * 0.48);
  for (let i = 0; i < 6; i++) c.lineTo(x + w * (0.64 - i * 0.05), y + h * (i % 2 ? 0.43 : 0.5));
  c.lineTo(x + w * 0.34, y + h * 0.48); c.fill();
  c.fillStyle = '#e8546a'; c.beginPath(); c.arc(x + w * 0.8, y + h * 0.2, h * 0.08, 0, TAU); c.fill();
}
const atlas = () => cached('jpAtlas', () => {
  const A = new JAtlas(2048), R = rng(17);
  A.add('norenRamen', 600, 300, (c, w, h) => { c.fillStyle = '#1f2f4f'; c.fillRect(0, 0, w, h); grime(c, 0, 0, w, h, 0.05, 2); c.fillStyle = '#f2ead8'; c.beginPath(); c.arc(w / 2, h * 0.52, 92, 0, TAU); c.fill(); jtxt(c, '라멘', w / 2, h * 0.5, 82, '#1f2f4f'); jtxt(c, 'ラーメン', w / 2, h * 0.86, 34, '#f2ead8'); });
  A.add('norenYu', 600, 300, (c, w, h) => { c.fillStyle = '#6b2a2e'; c.fillRect(0, 0, w, h); grime(c, 0, 0, w, h, 0.05, 3); jtxt(c, '♨', w / 2, h * 0.38, 120, '#f6eee0'); jtxt(c, '온천 ゆ', w / 2, h * 0.8, 56, '#f6eee0'); });
  A.add('norenInn', 600, 300, (c, w, h) => { c.fillStyle = '#2d3b2f'; c.fillRect(0, 0, w, h); grime(c, 0, 0, w, h, 0.05, 4); jtxt(c, '어서 오세요', w / 2, h * 0.42, 64, '#efe6d2'); jtxt(c, 'いらっしゃいませ', w / 2, h * 0.78, 38, '#d9c7a0'); });
  A.add('signRamen', 1000, 220, (c, w, h) => { wood(c, 0, 0, w, h, '#3a2618', R); c.strokeStyle = '#c99a55'; c.lineWidth = 8; c.strokeRect(10, 10, w - 20, h - 20); jtxt(c, '라멘', 330, h / 2 + 6, 140, '#f4e2c0'); jtxt(c, 'ラーメン', 710, h / 2 + 8, 92, '#f0b85a'); });
  A.add('signInn', 900, 220, (c, w, h) => { wood(c, 0, 0, w, h, '#4a3220', R); c.strokeStyle = '#2a1a10'; c.lineWidth = 10; c.strokeRect(8, 8, w - 16, h - 16); jtxt(c, '료칸 하나', 300, h / 2 + 4, 104, '#f2e6cc'); jtxt(c, '旅館 はな', 690, h / 2 + 6, 78, '#e8c890'); });
  A.add('signShop', 1000, 220, (c, w, h) => { c.fillStyle = '#f4ead6'; c.fillRect(0, 0, w, h); c.fillStyle = '#c8402a'; c.fillRect(0, 0, w, 24); c.fillRect(0, h - 24, w, 24); jtxt(c, '기념품', 300, h / 2 + 4, 120, '#2b1a10'); jtxt(c, 'お土産', 700, h / 2 + 6, 104, '#c8402a'); });
  A.add('menu', 1100, 300, (c, w, h) => {
    const items = [['라멘', '850'], ['미소라멘', '900'], ['차슈멘', '1100'], ['교자', '400'], ['볶음밥', '600'], ['맥주', '500'], ['계란', '100'], ['곱빼기', '150']];
    items.forEach(([n, p], i) => { const x = 8 + i * 136; wood(c, x, 6, 124, 288, ['#d6b07a', '#cfa66e', '#dcb886'][i % 3], R); c.strokeStyle = '#6b4626'; c.lineWidth = 3; c.strokeRect(x + 4, 10, 116, 280); vtxt(c, n, x + 62, 60, n.length > 3 ? 34 : 40, '#24160d', n.length > 3 ? 37 : 46); jtxt(c, p + '엔', x + 62, 270, 24, '#a3261c'); });
  });
  A.add('kitchen', 360, 240, (c, w, h) => { c.fillStyle = '#fbf6e8'; c.fillRect(0, 0, w, h); c.strokeStyle = '#b3261e'; c.lineWidth = 8; c.strokeRect(6, 6, w - 12, h - 12); jtxt(c, '진한 돈코츠', w / 2, 74, 40, '#2b1a10'); jtxt(c, '12시간 끓인 국물', w / 2, 130, 30, '#6b4626'); jtxt(c, 'とんこつ', w / 2, 190, 40, '#b3261e'); });
  A.add('offer', 400, 120, (c, w, h) => { wood(c, 0, 0, w, h, '#5a3a22', R); jtxt(c, '소원  奉納', w / 2, h / 2 + 4, 66, '#f0d9a0'); });
  A.add('plaque', 260, 360, (c, w, h) => { c.fillStyle = '#1e1c1a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#d8b25a'; c.lineWidth = 10; c.strokeRect(10, 10, w - 20, h - 20); vtxt(c, '하나신사', w / 2, 70, 66, '#d8b25a', 74); });
  A.add('pillar', 200, 900, (c, w, h) => { c.fillStyle = '#9a9890'; c.fillRect(0, 0, w, h); grime(c, 0, 0, w, h, 0.08, 6); vtxt(c, '하나신사', w / 2, 120, 150, '#3a3834', 190); });
  A.add('scroll', 300, 820, (c, w, h) => { c.fillStyle = '#5a4a3a'; c.fillRect(0, 0, w, h); c.fillStyle = '#f2ead8'; c.fillRect(24, 90, w - 48, h - 180); fujiPic(c, 34, 140, w - 68, 380, '#f2ead8'); c.fillStyle = '#2b2b2b'; vtxt(c, '一期一会', w * 0.5, 600, 44, '#2b2b2b', 48); c.fillStyle = '#b3261e'; c.fillRect(w * 0.7, 720, 26, 26); });
  A.add('fujiCard', 320, 220, (c, w, h) => { fujiPic(c, 0, 0, w, h); jtxt(c, 'FUJI', w * 0.18, h * 0.88, 30, '#ffffff'); });
  A.add('fujiCard2', 320, 220, (c, w, h) => { fujiPic(c, 0, 0, w, h, '#f5b8a0'); c.fillStyle = '#f7a8c0'; for (let i = 0; i < 30; i++) { c.beginPath(); c.arc(R() * w, h * 0.7 + R() * h * 0.3, 6 + R() * 10, 0, TAU); c.fill(); } });
  A.add('fujiCard3', 320, 220, (c, w, h) => { fujiPic(c, 0, 0, w, h, '#2b3b6a'); c.fillStyle = '#fff'; for (let i = 0; i < 20; i++) c.fillRect(R() * w, R() * h * 0.3, 2, 2); });
  A.add('fans', 900, 300, (c, w, h) => {
    const cols = [['#d8394a', '#f6e7d0'], ['#2d5aa8', '#f2f2ee'], ['#f2a7c0', '#ffffff'], ['#2f7a55', '#f0e6c8']];
    cols.forEach(([a, b], i) => { const cx = 112 + i * 225, cy = 270; for (let k = 0; k < 14; k++) { c.fillStyle = k % 2 ? a : b; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, 210, PI + (k / 14) * PI, PI + ((k + 1) / 14) * PI); c.fill(); } c.fillStyle = '#ffffff'; c.beginPath(); c.arc(cx, cy, 40, PI, 0); c.fill(); if (i === 1) { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(cx - 90, cy - 40); c.lineTo(cx, cy - 170); c.lineTo(cx + 90, cy - 40); c.fill(); } });
  });
  A.add('snacks', 1000, 200, (c, w, h) => {
    const pal = [['#e8546a', '모찌'], ['#f2c14e', '센베'], ['#5aa86a', '말차'], ['#7a4a2a', '양갱'], ['#4b7ad8', '사탕'], ['#f28a2e', '쿠키'], ['#d9c7a0', '만주'], ['#9a3fb5', '고구마']];
    pal.forEach(([col, n], i) => { const x = i * 125; c.fillStyle = col; c.fillRect(x, 0, 122, h); c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.arc(x + 61, 80, 40, 0, TAU); c.fill(); jtxt(c, n, x + 61, 84, 28, col); jtxt(c, 'おみやげ', x + 61, 160, 20, '#ffffff'); });
  });
  A.add('ema', 640, 240, (c, w, h) => {
    const wishes = ['시험 합격!', '가족 건강', '게임 1등', '친구랑 또', '키 크게', '행복하게', '여행 최고', '고양이♥'];
    wishes.forEach((s, i) => { const x = (i % 4) * 160, y = Math.floor(i / 4) * 120; wood(c, x, y, 156, 116, '#d9b884', R); c.fillStyle = ['#c8402a', '#2d5aa8', '#2f7a55', '#e8a020'][i % 4]; c.beginPath(); c.arc(x + 40, y + 52, 22, 0, TAU); c.fill(); jtxt(c, s, x + 100, y + 60, 22, '#2b1a10'); });
  });
  A.add('price', 300, 80, (c, w, h) => { rrect(c, 0, 0, w, h, 10, '#ffffff', '#c8402a', 5); jtxt(c, '500엔~', w / 2, h / 2 + 2, 44, '#c8402a'); });
  A.add('hours', 300, 160, (c, w, h) => { rrect(c, 0, 0, w, h, 10, '#2b1a10'); jtxt(c, '영업 중', w / 2, 52, 40, '#ffd27a'); jtxt(c, '11:00 ~ 21:00', w / 2, 112, 34, '#ffffff'); });
  A.build();
  const print = new THREE.MeshStandardMaterial({ map: A.tex, roughness: 0.62, alphaTest: 0.5 }); print.name = 'jpAtlasPrint';
  const lit = glow(0xffffff, 1.6, A.tex); lit.color.set(0xffffff); lit.name = 'jpAtlasLit';
  const cloth = new THREE.MeshStandardMaterial({ map: A.tex, roughness: 0.9, side: THREE.DoubleSide }); cloth.name = 'jpAtlasCloth';
  A.print = print; A.lit = lit; A.cloth = cloth;
  return A;
});

/* ================================================================== small things */
function bowlGeo(r, h) { return lathe([[0, 0], [r * 0.45, 0], [r * 0.47, 0.012], [r * 0.8, h * 0.45], [r, h], [r * 0.95, h], [r * 0.76, h * 0.45], [r * 0.4, 0.02], [0, 0.02]], 24); }
/** The ramen bowl (group, its own origin at the bowl foot). */
function ramenBowl(parent, x, y, z) {
  const b = group(parent, x, y, z, 0);
  b.userData.dynamic = true;
  const R = rng(5);
  V(b, bowlGeo(0.11, 0.085), 0x1d1b1d, 0, 0, 0, 0, 0, 0, vcGloss());
  V(b, torus(0.104, 0.004, 4, 32), 0xb3261e, 0, 0.072, 0, PI / 2, 0, 0, vcGloss());
  V(b, cyl(0.098, 0.098, 0.004, 28), 0xd9a45a, 0, 0.073, 0, 0, 0, 0, vcGloss());
  for (let i = 0; i < 26; i++) { const a = R() * TAU, d = R() * 0.07; V(b, torus(0.012 + R() * 0.012, 0.0028, 4, 10, PI * (0.8 + R())), 0xf2d98a, Math.cos(a) * d, 0.077, Math.sin(a) * d, PI / 2 + (R() - 0.5) * 0.4, 0, R() * TAU); }
  for (const [cx, cz, r] of [[-0.04, -0.03, 0.035], [-0.005, -0.045, 0.033]]) { V(b, cyl(r, r, 0.008, 18), 0xb9774a, cx, 0.081, cz, 0.15, 0, 0.1); V(b, torus(r, 0.004, 4, 18), 0x8a4a28, cx, 0.081, cz, PI / 2 + 0.15, 0, 0.1); }
  const egg = group(b, 0.045, 0.08, -0.01, 0.4);
  V(egg, sphere(0.024, 14, 10).scale(1, 0.55, 1.3), 0xf6efe2, 0, 0.004, 0);
  V(egg, sphere(0.014, 12, 8).scale(1, 0.4, 1.2), 0xf0a028, 0, 0.012, 0, 0, 0, 0, vcGloss());
  const egg2 = group(b, 0.05, 0.08, 0.035, -0.3);
  V(egg2, sphere(0.024, 14, 10).scale(1, 0.55, 1.3), 0xf6efe2, 0, 0.004, 0);
  V(egg2, sphere(0.014, 12, 8).scale(1, 0.4, 1.2), 0xf0a028, 0, 0.012, 0, 0, 0, 0, vcGloss());
  for (let i = 0; i < 2; i++) V(b, box(0.07, 0.1, 0.002), 0x1e2a1e, -0.06 + i * 0.018, 0.12, -0.06 + i * 0.008, -0.25, 0.5, 0);
  for (let i = 0; i < 22; i++) { const a = R() * TAU, d = 0.02 + R() * 0.05; V(b, cyl(0.005, 0.005, 0.004, 8), R() < 0.7 ? 0x5fae3c : 0xd6e9a0, 0.015 + Math.cos(a) * d * 0.6, 0.083, 0.03 + Math.sin(a) * d * 0.5); }
  V(b, RB(0.03, 0.012, 0.025, 0.004, 1), 0xf0e6d0, -0.03, 0.082, 0.05, 0, 0.3, 0);
  V(b, RB(0.028, 0.008, 0.06, 0.003, 1), 0xd9c27a, 0.0, 0.082, 0.06, 0, 1.0, 0);
  bake(b);
  return b;
}
function stool(g, M, x, y, z, h = 0.62) {
  const s = group(g, x, y, z, 0);
  put(s, CY(0.03, 0.03, h - 0.06, 10), M.dsteel, 0, (h - 0.06) / 2, 0);
  put(s, CY(0.2, 0.22, 0.03, 20), M.dsteel, 0, 0.015, 0);
  V(s, CY(0.18, 0.17, 0.07, 22), 0x8a2a22, 0, h - 0.03, 0, 0, 0, 0, vcSoft());
  V(s, torus(0.12, 0.012, 6, 18), 0x5a5d62, 0, 0.26, 0, PI / 2, 0, 0, vcGloss());
}
/** Zabuton: a plump square floor cushion, piped, with a button tuft in the middle (soft.js). */
function zabuton(g, x, y, z, col, ry = 0, seed = 1) { put(g, painted(cushion(0.56, 0.085, 0.6, 0.04, 0.028, 0, seed, 0.022, 0.004), col), clothMat(), x, y + 0.045, z, 0, ry, 0); }
function teaSet(g, x, y, z) {
  V(g, lathe([[0, 0], [0.05, 0], [0.065, 0.04], [0.06, 0.08], [0.03, 0.095], [0, 0.1]], 16), 0x5a3b2a, x, y, z, 0, 0, 0, vcGloss());
  V(g, cyl(0.007, 0.007, 0.07, 6), 0x5a3b2a, x + 0.07, y + 0.05, z, 0, 0, -0.9, vcGloss());
  V(g, torus(0.035, 0.006, 4, 12, PI), 0x2a1a10, x, y + 0.1, z, 0, 0, 0);
  for (const [dx, dz] of [[0.16, 0.08], [-0.15, 0.1], [0.12, -0.12]]) { V(g, lathe([[0, 0], [0.025, 0], [0.032, 0.055], [0.029, 0.056], [0.022, 0.006], [0, 0.006]], 14), 0xe8e0d0, x + dx, y, z + dz, 0, 0, 0, vcGloss()); V(g, cyl(0.026, 0.026, 0.003, 12), 0x8aa040, x + dx, y + 0.04, z + dz); }
  V(g, RB(0.18, 0.012, 0.12, 0.004, 1), 0x3a2416, x - 0.04, y + 0.006, z - 0.16);
  for (let i = 0; i < 3; i++) V(g, sphere(0.022, 10, 6).scale(1, 0.6, 1), [0xf4b8c8, 0xf2f2e8, 0x8ab050][i], x - 0.1 + i * 0.05, y + 0.02, z - 0.16);
}
/** Beckoning cat (maneki-neko) standing on y, facing +Z; s = height in metres. */
function manekiNeko(g, x, y, z, s, col = 0xf6f3ec, ry = 0) {
  const k = s / 0.3, c = group(g, x, y, z, ry);
  const gold = col === 0xd8b25a;
  const m = gold ? vcGloss() : vcGloss();
  V(c, sphere(0.085 * k, 14, 10).scale(1, 1.05, 0.9), col, 0, 0.09 * k, 0, 0, 0, 0, m);
  V(c, sphere(0.08 * k, 14, 10).scale(1.1, 0.95, 0.95), col, 0, 0.215 * k, 0.005 * k, 0, 0, 0, m);
  for (const sx of [-1, 1]) {
    V(c, prep(new THREE.ConeGeometry(0.03 * k, 0.05 * k, 8)), col, sx * 0.05 * k, 0.29 * k, 0, 0, 0, -sx * 0.3, m);
    V(c, sphere(0.009 * k, 8, 6).scale(1.3, 0.5, 0.6), 0x1d1b1a, sx * 0.03 * k, 0.225 * k, 0.07 * k);
    V(c, sphere(0.012 * k, 8, 6), 0xf2a0a8, sx * 0.045 * k, 0.2 * k, 0.065 * k);
  }
  V(c, sphere(0.008 * k, 8, 6), 0xe0707a, 0, 0.205 * k, 0.081 * k);
  V(c, capsule(0.026 * k, 0.06 * k), col, 0.075 * k, 0.27 * k, 0.02 * k, 0, 0, -0.25, m);
  V(c, capsule(0.026 * k, 0.04 * k), col, -0.05 * k, 0.1 * k, 0.07 * k, PI / 2, 0, 0, m);
  V(c, torus(0.06 * k, 0.01 * k, 6, 16), 0xc8201c, 0, 0.155 * k, 0.005 * k, PI / 2 - 0.2, 0, 0);
  V(c, sphere(0.018 * k, 10, 8), 0xe8c050, 0, 0.14 * k, 0.07 * k, 0, 0, 0, vcGloss());
  V(c, RB(0.07 * k, 0.05 * k, 0.012 * k, 0.004, 1), 0xe8c050, -0.04 * k, 0.07 * k, 0.078 * k, 0, 0, 0.1, vcGloss());
}
function capsule(r, len) { return prep(new THREE.CapsuleGeometry(r, len, 4, 10)); }

/* ================================================================== 1) shrine */
export function buildShrine() {
  const site = makeSite('shrine', 26, 30);
  const g = site.group, M = JM(), A = atlas();
  const R = rng(3);
  // ground: raked gravel, stone approach
  put(g, plane(26, 30), M.gravel, 0, 0.012, 0);
  for (let z = 14.7; z > -3.3; z -= 0.6) {
    const w = z > 9.4 ? 5.8 : 2.4;
    const n = z > 9.4 ? 5 : 2;
    for (let i = 0; i < n; i++) {
      const sw = w / n - 0.04, x = -w / 2 + (i + 0.5) * (w / n) + (((z * 10) | 0) % 2 ? 0.1 : -0.1) * (n > 2 ? 0 : 1);
      put(g, RB(sw, 0.1, 0.56, 0.025, 1), M.stone, x, 0.03, z, 0, (R() - 0.5) * 0.01, 0);
    }
  }
  for (const sx of [-1, 1]) put(g, RB(0.16, 0.08, 12.2, 0.03, 1), M.moss, sx * 1.3, 0.03, 3.1);
  // ---- torii (z = 9)
  const TZ = 9, TX = 2.55, TH = 5.3;
  for (const sx of [-1, 1]) {
    put(g, cyl(0.21, 0.24, TH, 28), M.vermilion, sx * TX, TH / 2, TZ, 0, 0, sx * 0.025);
    put(g, cyl(0.27, 0.27, 0.5, 28), M.lacquer, sx * (TX + 0.003), 0.25, TZ);
    put(g, lathe([[0.27, 0.5], [0.24, 0.56], [0, 0.56]], 28), M.lacquer, sx * TX, 0, TZ);
    put(g, RB(0.9, 0.12, 0.9, 0.04, 2), M.stone, sx * TX, 0.06, TZ);
    put(g, torus(0.235, 0.02, 6, 28), M.lacquer, sx * TX, 4.0, TZ, PI / 2);
  }
  const kp = [];
  for (let i = 0; i <= 24; i++) { const u = i / 24, x = -4.1 + u * 8.2, e = Math.pow(Math.abs(u - 0.5) * 2, 2.5); kp.push(V3(x, TH + 0.35 + e * 0.38, TZ)); }
  put(g, sweep(rsec(0.42, 0.24, 0.05), kp), M.lacquer);
  put(g, sweep(rsec(0.36, 0.26, 0.04), kp.map((p) => p.clone().setY(p.y - 0.25))), M.vermilion);
  put(g, RB(7.4, 0.3, 0.2, 0.03, 2), M.vermilion, 0, 4.25, TZ);
  put(g, RB(0.2, 0.75, 0.18, 0.02, 1), M.vermilion, 0, 4.78, TZ);
  put(g, RB(0.62, 0.86, 0.08, 0.02, 1), M.lacquer, 0, 4.78, TZ + 0.1);
  D(g, A.quad('plaque', 0.52, 0.72), A.print, 0, 4.78, TZ + 0.145);
  for (const sx of [-1, 1]) put(g, RB(0.12, 0.34, 0.26, 0.02, 1), M.lacquer, sx * (TX + 0.3), 4.25, TZ);
  for (const sx of [-1, 1]) solid(site, sx * TX, TH / 2, TZ, 0.55, TH, 0.55);
  // shrine name pillar
  put(g, RB(0.42, 2.2, 0.42, 0.03, 2), M.stone, -3.9, 1.1, 12.8);
  D(g, A.quad('pillar', 0.3, 1.35), A.print, -3.9, 1.35, 13.012);
  put(g, RB(0.7, 0.2, 0.7, 0.03, 2), M.stone, -3.9, 0.1, 12.8);
  solid(site, -3.9, 1.1, 12.8, 0.7, 2.2, 0.7);
  // stone lanterns along the approach
  const lanterns = [];
  for (const z of [6.2, 1.6]) for (const sx of [-1, 1]) {
    const l = stoneLantern(); l.position.set(sx * 2.35, 0.02, z); g.add(l); lanterns.push(l);
    solid(site, sx * 2.35, 1.0, z, 0.72, 2.0, 0.72);
    site.lamps.push({ pos: [sx * 2.35, 1.35, z], color: 0xffc98a, intensity: 2.5, range: 4 });
  }
  site.nightGlow.push(lanterns[0].userData.glowMat);
  // nobori banners
  const bt = canvasTex(160, 640, (c, w, h) => { c.fillStyle = '#c8402a'; c.fillRect(0, 0, w, h); grime(c, 0, 0, w, h, 0.06, 5); c.fillStyle = '#f6eee0'; c.fillRect(0, 0, w, 30); vtxt(c, '하나신사', w / 2, 120, 84, '#f6eee0', 98); vtxt(c, '奉納', w / 2, 520, 50, '#f6e3a0', 58); });
  const bm = new THREE.MeshStandardMaterial({ map: bt, roughness: 0.85, side: THREE.DoubleSide }); bm.name = 'jpNobori';
  for (const [x, z] of [[-3.5, 4.2], [3.5, 4.2], [-3.5, -0.6], [3.5, -0.6]]) {
    put(g, cyl(0.025, 0.03, 4.3, 10), M.timber, x, 2.15, z);
    put(g, cyl(0.015, 0.015, 0.62, 8), M.timber, x + Math.sign(-x) * 0.3, 4.15, z, 0, 0, PI / 2);
    const geo = new THREE.PlaneGeometry(0.56, 2.4, 2, 8); const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getY(i) * 2.2 + x) * 0.04);
    geo.computeVertexNormals();
    put(g, prep(geo, true), bm, x + Math.sign(-x) * 0.31, 2.9, z, 0, Math.sign(x) * 0.3, 0);
  }
  // ---- chozuya (purification pavilion) at the left
  const cx = -7.2, cz = 3.4;
  put(g, RB(3.4, 0.12, 2.6, 0.03, 2), M.stone, cx, 0.06, cz);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) post(g, M.vermilion, cx + sx * 1.3, 0.12, 2.75, cz + sz * 0.9, 0.17);
  for (const sz of [-1, 1]) put(g, RB(3.0, 0.16, 0.16, 0.02, 1), M.vermilion, cx, 2.68, cz + sz * 0.9);
  for (const sx of [-1, 1]) put(g, RB(0.16, 0.16, 2.0, 0.02, 1), M.vermilion, cx + sx * 1.3, 2.68, cz);
  curvedRoof(g, { x0: cx - 2.0, x1: cx + 2.0, ridgeY: 3.65, ridgeZ: cz, front: 1.75, back: 1.75, slope: 0.58, sag: 0.05, lift: 0.18 });
  put(g, RB(2.0, 0.7, 0.9, 0.06, 2), M.stone, cx, 0.47, cz);
  D(g, plane(1.8, 0.7), M.water, cx, 0.74, cz);
  solid(site, cx, 0.45, cz, 2.0, 0.9, 0.9);
  for (const sx of [-1, 1]) solid(site, cx + sx * 1.3, 1.4, cz, 0.25, 2.8, 2.0);
  // bamboo spout + ladles on a rack
  const bamb = (geo, col) => put(g, tint(geo, col), M.bamboo);
  bamb(cyl(0.03, 0.03, 0.7, 10).rotateX(PI / 2 - 0.2), 0x9aa65a).position.set(cx - 0.6, 1.05, cz - 0.25);
  bamb(cyl(0.03, 0.03, 0.9, 10), 0x9aa65a).position.set(cx - 0.6, 0.5, cz - 0.62);
  D(g, cyl(0.012, 0.004, 0.3, 8), M.glass, cx - 0.6, 0.85, cz + 0.09);
  for (const sz of [-0.12, 0.12]) put(g, cyl(0.012, 0.012, 1.9, 8), M.bamboo, cx, 0.86, cz + 0.3 + sz, 0, 0, PI / 2);
  for (let i = 0; i < 6; i++) {
    const lx = cx - 0.75 + i * 0.3;
    V(g, cyl(0.04, 0.035, 0.07, 14, false), 0xc9a670, lx, 0.92, cz + 0.36, 0, 0, 0);
    V(g, cyl(0.007, 0.007, 0.42, 6), 0xd2b582, lx, 0.89, cz + 0.12, PI / 2 + 0.12, 0, 0);
  }
  // ---- main hall
  const HX = 5.4, HZ0 = -12.6, HZ1 = -5.4, FL = 1.0;
  put(g, RB(13.2, 0.3, 11.4, 0.04, 2), M.stone, 0, 0.15, -8.0);
  solid(site, 0, 0.15, -8.0, 13.2, 0.3, 11.4);
  put(g, RB(2.4, 0.15, 0.5, 0.03, 1), M.stone, 0, 0.075, -2.15);
  put(g, RB(HX * 2 + 0.6, 0.3, HZ1 - HZ0 + 0.6, 0.03, 1), M.timber, 0, FL - 0.15, (HZ0 + HZ1) / 2);
  solid(site, 0, (FL + 0.3) / 2, (HZ0 + HZ1) / 2, HX * 2 + 0.6, FL - 0.3, HZ1 - HZ0 + 0.6);
  for (let i = 0; i < 9; i++) put(g, RB(0.18, FL - 0.3, 0.18, 0.02, 1), M.timber, -HX + i * (HX * 2 / 8), (FL + 0.3) / 2 - 0.15, HZ1 + 0.1);
  // wooden steps to the veranda (front, centre)
  for (let i = 0; i < 2; i++) { const y = 0.3 + (i + 1) * 0.233; put(g, RB(2.6, 0.06, 0.34, 0.015, 1), M.oak, 0, y - 0.03, HZ1 + 0.95 - i * 0.34); solid(site, 0, (0.3 + y) / 2, HZ1 + 0.95 - i * 0.34, 2.6, y - 0.3, 0.34); }
  for (const sx of [-1, 1]) put(g, RB(0.08, 0.8, 0.9, 0.02, 1), M.timber, sx * 1.33, 0.75, HZ1 + 0.75);
  // posts, walls, lattice doors
  const posts = [-HX, -2.2, 2.2, HX];
  for (const px of posts) for (const pz of [HZ0, (HZ0 + HZ1) / 2, HZ1]) post(g, M.vermilion, px, FL, FL + 3.4, pz, 0.26);
  for (const pz of [HZ0, HZ1]) for (const y of [FL + 3.25, FL + 0.05]) put(g, RB(HX * 2 + 0.3, 0.22, 0.24, 0.02, 1), M.vermilion, 0, y, pz);
  for (const sx of [-1, 1]) for (const y of [FL + 3.25, FL + 0.05]) put(g, RB(0.24, 0.22, HZ1 - HZ0, 0.02, 1), M.vermilion, sx * HX, y, (HZ0 + HZ1) / 2);
  blk(site, g, M.plaster, -HX, HX, FL, FL + 3.15, HZ0 - 0.07, HZ0 + 0.07);
  for (const sx of [-1, 1]) blk(site, g, M.plaster, sx * HX - 0.07, sx * HX + 0.07, FL, FL + 3.15, HZ0, HZ1);
  // front: side bays plaster with high windows, centre lattice doors
  for (const sx of [-1, 1]) {
    blk(site, g, M.plaster, sx > 0 ? 2.2 : -HX, sx > 0 ? HX : -2.2, FL, FL + 3.15, HZ1 - 0.07, HZ1 + 0.07);
    shoji(g, M, sx * 3.8, FL + 2.3, HZ1 + 0.09, 2.2, 0.9, 0, 10, 3);
  }
  for (let i = 0; i < 4; i++) shoji(g, M, -1.65 + i * 1.1, FL + 1.55, HZ1, 1.08, 2.9, 0, 6, 10);
  solid(site, 0, FL + 1.5, HZ1, 4.4, 3.0, 0.14);
  // veranda floor and railing
  put(g, RB(HX * 2 + 1.4, 0.08, 1.2, 0.02, 1), M.oak, 0, FL - 0.04, HZ1 + 0.55);
  for (const sx of [-1, 1]) {
    put(g, RB(HX - 1.4, 0.06, 0.08, 0.02, 1), M.vermilion, sx * (HX / 2 + 1.05), FL + 0.7, HZ1 + 1.1);
    for (let i = 0; i <= 4; i++) put(g, RB(0.07, 0.7, 0.07, 0.01, 1), M.vermilion, sx * (1.45 + i * (HX - 1.4) / 4), FL + 0.35, HZ1 + 1.1);
  }
  // roof: long front slope over the steps (nagare style)
  const hy = curvedRoof(g, { x0: -HX - 1.3, x1: HX + 1.3, ridgeY: FL + 6.1, ridgeZ: -9.6, front: 7.0, back: 4.3, slope: 0.72, sag: 0.042, lift: 0.45, th: 0.22 });
  for (const sx of [-1, 1]) {
    gable(g, M.plaster, sx * HX + 0.06, HZ0, HZ1, FL + 3.3, hy, 0.3, 0.12);
    post(g, M.vermilion, sx * (HX + 0.02), FL + 3.35, hy(sx * HX, -9.6) - 0.3, -9.6, 0.2);
  }
  // shimenawa rope with paper streamers, bell and its rope, offering box
  const rp = []; for (let i = 0; i <= 20; i++) { const u = i / 20; rp.push(V3(-2.3 + u * 4.6, FL + 3.0 - Math.sin(u * PI) * 0.35, HZ1 + 0.35)); }
  put(g, tube(new THREE.CatmullRomCurve3(rp), 0.11, 40, 12), paint(0xd9c48a, 0.9));
  for (let i = 0; i < 5; i++) { const u = (i + 0.5) / 5, x = -2.3 + u * 4.6, y = FL + 3.0 - Math.sin(u * PI) * 0.35; for (let k = 0; k < 3; k++) V(g, box(0.09, 0.12, 0.005), 0xffffff, x + (k % 2 ? 0.03 : -0.03), y - 0.2 - k * 0.12, HZ1 + 0.42, 0, 0, k % 2 ? 0.2 : -0.2); }
  put(g, sphere(0.2, 20, 14), mat('gold'), 0, FL + 2.6, HZ1 + 1.4);
  put(g, torus(0.2, 0.025, 6, 20), mat('gold'), 0, FL + 2.6, HZ1 + 1.4, PI / 2);
  put(g, cyl(0.01, 0.01, 0.6, 6), M.dsteel, 0, FL + 3.0, HZ1 + 1.4);
  for (const [col, ph] of [[0xc8301e, 0], [0xf4f0e6, PI]]) {
    const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24, a = ph + t * 18; pts.push(V3(Math.cos(a) * 0.035, FL + 2.4 - t * 2.05, HZ1 + 1.4 + Math.sin(a) * 0.035)); }
    V(g, tube(new THREE.CatmullRomCurve3(pts), 0.03, 72, 6), col, 0, 0, 0, 0, 0, 0, vcSoft());
  }
  const ob = group(g, 0, 0.3, HZ1 + 2.0, 0);
  put(ob, RB(1.6, 0.62, 0.75, 0.03, 2), M.timber, 0, 0.31, 0);
  for (let i = 0; i < 8; i++) put(ob, prep(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 3)), M.oak, 0, 0.66, -0.3 + i * 0.086, 0, 0, PI / 2);
  D(ob, A.quad('offer', 0.9, 0.27), A.print, 0, 0.36, 0.378);
  for (const sx of [-1, 1]) put(ob, RB(0.04, 0.5, 0.04, 0.01, 1), mat('gold'), sx * 0.78, 0.36, 0.37);
  solid(site, 0, 0.3 + 0.35, HZ1 + 2.0, 1.6, 0.7, 0.75);
  site.interactables.push({ id: 'pray', label: '소원 빌기', pos: [0, 1.25, HZ1 + 2.6], radius: 1.7, seat: { pos: [0, 0.3 + 1.6, HZ1 + 3.05], yaw: 0, pitch: 0.12 } });
  // ema rack
  const er = group(g, 6.6, 0.02, -1.4, -PI / 2 + 0.25);
  for (const sx of [-1, 1]) post(er, M.timber, sx * 1.1, 0, 2.1, 0, 0.1);
  for (const y of [1.0, 1.5]) put(er, RB(2.3, 0.05, 0.05, 0.01, 1), M.timber, 0, y, 0);
  put(er, RB(2.7, 0.06, 0.6, 0.02, 1), M.tile, 0, 2.15, 0, 0.0, 0, 0);
  put(er, RB(2.8, 0.1, 0.12, 0.02, 1), M.timber, 0, 2.08, 0);
  const emaShape = new THREE.Shape(); emaShape.moveTo(-0.075, 0); emaShape.lineTo(0.075, 0); emaShape.lineTo(0.075, 0.075); emaShape.lineTo(0, 0.11); emaShape.lineTo(-0.075, 0.075); emaShape.closePath();
  const er2 = rng(9);
  for (let row = 0; row < 2; row++) for (let i = 0; i < 12; i++) {
    const x = -1.0 + i * 0.18 + (er2() - 0.5) * 0.03, y = (row ? 1.5 : 1.0) - 0.16, rz = (er2() - 0.5) * 0.15;
    const e = put(er, extrude(emaShape, 0.008), M.oak, x, y, 0.03 + er2() * 0.01, -0.06, 0, rz);
    void e;
    const k = (row * 12 + i) % 8;
    const q = A.mapSub(quad(0.13, 0.08), 'ema', (k % 4) / 4, ((k % 4) + 1) / 4);
    const uv = q.attributes.uv; const r = A.items.get('ema'); const S = 2048;
    for (let j = 0; j < uv.count; j++) { const vy = 1 - uv.getY(j); const local = ((r.y + vy * 0) / S); void local; }
    void uv;
    D(er, q, A.print, x, y + 0.04, 0.042 + 0.01, -0.06, 0, rz);
  }
  solid(site, 6.6, 1.0, -1.4, 0.6, 2.0, 2.4);
  // trees and low stone fence
  for (const [x, z, k, s] of [[-9.6, -9.0, 'cherry', 2], [9.8, -9.6, 'cherry', 5], [-10.4, 9.5, 'cherry', 7], [9.9, 8.2, 'cherry', 3], [-11.0, -2.0, 'pine', 4], [10.6, 1.5, 'pine', 6], [-6.0, -13.6, 'pine', 8], [7.0, -13.8, 'round', 9]]) {
    const t = tree({ kind: k, seed: s }); t.position.set(x, 0, z); g.add(t);
    const tr = t.userData.trunkRadius ?? 0.25; solid(site, x, 1.2, z, tr * 2, 2.4, tr * 2);
  }
  for (const [x0, z0, x1, z1] of [[-12.7, 14.6, -4.3, 14.6], [4.3, 14.6, 12.7, 14.6], [-12.7, 14.6, -12.7, -14.6], [12.7, 14.6, 12.7, -14.6], [-12.7, -14.6, 12.7, -14.6]]) {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 1.8)), ry = Math.atan2(-(z1 - z0), x1 - x0);
    for (let i = 0; i <= n; i++) { const t = i / n; put(g, RB(0.2, 0.9, 0.2, 0.03, 1), M.stone, x0 + (x1 - x0) * t, 0.45, z0 + (z1 - z0) * t); }
    for (const y of [0.78, 0.4]) put(g, RB(L, 0.1, 0.1, 0.02, 1), M.stone, (x0 + x1) / 2, y, (z0 + z1) / 2, 0, ry, 0);
    const cxm = (x0 + x1) / 2, czm = (z0 + z1) / 2;
    solid(site, cxm, 0.45, czm, Math.abs(x1 - x0) + 0.2, 0.9, Math.abs(z1 - z0) + 0.2);
  }
  // lamps, glow, photo spot
  site.lamps.push({ pos: [0, FL + 2.6, HZ1 + 1.0], color: 0xffd9a8, intensity: 6, range: 8 });
  site.lamps.push({ pos: [cx, 2.4, cz], color: 0xffd9a8, intensity: 3, range: 5 });
  site.nightGlow.push(M.washi);
  site.extra.photoSpot = { pos: [0, 0.08, 14.3], yaw: 0, pitch: 0.16, eye: [0, 1.68, 14.3] };
  site.spawn = { pos: [0, 0.08, 14.3], yaw: 0 };
  site.parking = { pos: [8.5, 0, 13.0], yaw: 0 };
  bake(g);
  return site;
}

/* ================================================================== 2) ramen shop */
export function buildRamenShop() {
  const site = makeSite('ramenShop', 10, 9);
  const g = site.group, M = JM(), A = atlas();
  const FY = 0.12, X0 = -4.7, X1 = 4.7, Z0 = -4.3, ZF = 3.2, CL = 2.75;
  put(g, plane(10, 9), mat('pavers2'), 0, 0.006, 0);
  blk(site, g, M.stone, X0 - 0.05, X1 + 0.05, 0, FY, Z0 - 0.05, ZF + 0.1, true, 0.02);
  put(g, plane(X1 - X0 - 0.2, ZF - Z0 - 0.2), mat('darkFloor'), 0, FY + 0.002, (Z0 + ZF) / 2);
  put(g, plane(X1 - X0, ZF - Z0).rotateX(PI), M.oak, 0, CL, (Z0 + ZF) / 2);
  for (let x = -4.2; x < 4.3; x += 0.7) put(g, RB(0.08, 0.1, ZF - Z0, 0.01, 1), M.timber, x, CL - 0.05, (Z0 + ZF) / 2);
  site.indoor.push(aabb(X0, FY, Z0, X1, CL, ZF));
  // walls: back, sides (plaster over timber wainscot), second storey above
  blk(site, g, M.plaster, X0, X1, FY, 5.6, Z0 - 0.15, Z0);
  for (const sx of [-1, 1]) blk(site, g, M.plaster, sx > 0 ? X1 : X0 - 0.15, sx > 0 ? X1 + 0.15 : X0, FY, 5.6, Z0 - 0.15, ZF + 0.15);
  for (const sx of [-1, 1]) put(g, box(0.02, 0.9, ZF - Z0), M.timber, sx * (X1 - 0.01), FY + 0.45, (Z0 + ZF) / 2);
  put(g, box(X1 - X0, 0.9, 0.02), M.timber, 0, FY + 0.45, Z0 + 0.01);
  // front: storefront frame
  for (const px of [X0 - 0.05, -1.55, 0.55, X1 + 0.05]) post(g, M.timber, px, FY, 3.0, ZF + 0.05, 0.18);
  put(g, RB(X1 - X0 + 0.4, 0.26, 0.24, 0.02, 1), M.timber, 0, 2.95, ZF + 0.05);
  blk(site, g, M.plaster, X0 - 0.15, X1 + 0.15, 3.08, 5.6, ZF, ZF + 0.15);
  // left: food sample window
  blk(site, g, M.timber, X0, -1.64, FY, 0.95, ZF - 0.1, ZF + 0.12);
  D(g, quad(2.9, 1.5), M.glass, -3.1, 1.75, ZF + 0.12);
  solid(site, -3.1, 1.5, ZF, 3.0, 3.0, 0.2);
  put(g, RB(3.0, 0.05, 0.55, 0.01, 1), M.oak, -3.12, 0.97, ZF - 0.15);
  put(g, RB(3.0, 0.05, 0.3, 0.01, 1), M.oak, -3.12, 1.6, ZF - 0.05);
  const sR = rng(21);
  for (let i = 0; i < 5; i++) {
    const x = -4.3 + i * 0.6;
    V(g, bowlGeo(0.1, 0.07), [0x1d1b1d, 0xb3261e, 0xf2eee6][i % 3], x, 1.0, ZF - 0.18, 0, 0, 0, vcGloss());
    V(g, cyl(0.088, 0.088, 0.004, 20), [0xd9a45a, 0xc87a3a, 0xe8d8b0][i % 3], x, 1.06, ZF - 0.18, 0, 0, 0, vcGloss());
    V(g, cyl(0.03, 0.03, 0.01, 12), 0xb9774a, x - 0.03, 1.066, ZF - 0.2);
    V(g, sphere(0.02, 10, 8).scale(1, 0.6, 1.2), 0xf0a028, x + 0.03, 1.07, ZF - 0.16);
    V(g, cyl(0.004, 0.004, 0.25, 6), 0x6b4a2e, x + 0.02, 1.1, ZF - 0.24, 0, 0, PI / 2 - 0.2);
    V(g, RB(0.16, 0.01, 0.07, 0.004, 1), 0xffffff, x, 1.005, ZF - 0.02);
    if (i < 4) { for (let k = 0; k < 4; k++) V(g, sphere(0.025, 10, 6).scale(1.6, 0.6, 0.9), 0xe8c088, -4.0 + i * 0.6 + k * 0.05 - 0.07, 1.65, ZF - 0.08, 0, 0.4, 0); V(g, RB(0.24, 0.012, 0.12, 0.004, 1), 0xf4f2ec, -4.0 + i * 0.6, 1.63, ZF - 0.08); }
    void sR;
  }
  // centre: sliding door with noren; right: lattice window
  slideDoor(site, g, M, -0.5, FY, ZF, 1.0, 2.15, -1.0);
  put(g, RB(2.1, 0.03, 0.2, 0.01, 1), M.dsteel, -0.5, FY + 0.01, ZF);
  noren(g, A, -0.5, 2.78, ZF + 0.18, 1.6, 0.85, 'norenRamen');
  blk(site, g, M.timber, 0.64, X1, FY, 0.95, ZF - 0.1, ZF + 0.12);
  shoji(g, M, 2.6, 1.85, ZF + 0.04, 3.8, 1.75, 0, 12, 6);
  solid(site, 2.6, 1.5, ZF, 3.9, 3.0, 0.2);
  // awning roof + big sign + upper floor window
  curvedRoof(g, { x0: X0 - 0.3, x1: X1 + 0.3, ridgeY: 3.3, ridgeZ: ZF + 0.15, front: 1.15, back: 0, slope: 0.5, sag: 0.05, lift: 0.12, ridge: false, th: 0.12 });
  put(g, RB(4.2, 0.95, 0.12, 0.03, 2), M.timber, -0.4, 4.15, ZF + 0.2);
  D(g, A.quad('signRamen', 4.0, 0.88), A.lit, -0.4, 4.15, ZF + 0.262);
  shoji(g, M, 3.2, 4.3, ZF + 0.16, 1.6, 1.0, 0, 6, 3);
  put(g, RB(1.8, 0.08, 0.3, 0.02, 1), M.timber, 3.2, 3.75, ZF + 0.25);
  V(g, RB(0.7, 0.5, 0.25, 0.03, 2), 0xe8e6e0, -3.6, 4.0, ZF + 0.3);
  V(g, cyl(0.17, 0.17, 0.02, 20), 0x55585e, -3.6, 4.0, ZF + 0.43, PI / 2, 0, 0);
  const ry = curvedRoof(g, { x0: X0 - 0.5, x1: X1 + 0.5, ridgeY: 7.1, ridgeZ: (Z0 + ZF) / 2, front: 4.5, back: 4.5, slope: 0.4, sag: 0.016, lift: 0.18, th: 0.16 });
  for (const sx of [-1, 1]) gable(g, M.plaster, sx > 0 ? X1 + 0.15 : X0, Z0 - 0.15, ZF + 0.15, 5.55, ry, 0.2, 0.15);
  // lanterns either side of the door
  const la = paperLantern(0xcf3326, { text: '라멘' }); la.position.set(-1.75, 2.9, ZF + 0.6); g.add(la);
  const lb = paperLantern(0xcf3326, { text: 'ラーメン' }); lb.position.set(0.75, 2.9, ZF + 0.6); g.add(lb);
  site.nightGlow.push(la.userData.glowMat, lb.userData.glowMat, A.lit, M.washi);
  const sb = signBoard('라멘 ラーメン'); sb.position.set(1.6, 0.012, 4.05); sb.rotation.y = -0.3; g.add(sb);
  solid(site, 1.6, 0.7, 4.05, 0.5, 1.4, 0.4);
  site.nightGlow.push(sb.userData.glowMat);
  const bk = bicycle({ color: 0xe9e2cf }); bk.position.set(3.6, 0.006, 4.05); bk.rotation.y = 0.05; g.add(bk);
  solid(site, 3.6, 0.55, 4.05, 1.8, 1.1, 0.5);
  // ---- inside: counter, stools, open kitchen
  const CZ = -0.95, CT = FY + 0.92;
  blk(site, g, M.timber, -4.1, 3.4, FY, CT - 0.05, CZ - 0.3, CZ + 0.05);
  put(g, RB(7.6, 0.06, 0.62, 0.02, 2), M.oak, -0.35, CT - 0.03, CZ - 0.05);
  put(g, RB(7.6, 0.06, 0.25, 0.015, 1), M.oak, -0.35, CT + 0.27, CZ - 0.42);
  put(g, RB(7.6, 0.3, 0.06, 0.015, 1), M.timber, -0.35, CT + 0.12, CZ - 0.32);
  const seatsX = [-3.3, -2.2, -1.1, 0.0, 1.1, 2.2];
  for (const x of seatsX) stool(g, M, x, FY, -0.15);
  // condiments per pair of seats, water pitcher, cups
  for (const x of [-2.75, -0.55, 1.65]) {
    V(g, RB(0.2, 0.08, 0.1, 0.01, 1), 0x3a2416, x, CT + 0.04, CZ - 0.15);
    for (let k = 0; k < 3; k++) V(g, lathe([[0, 0], [0.022, 0], [0.024, 0.07], [0.012, 0.09], [0, 0.09]], 10), [0xb3261e, 0xf2eee6, 0x3a2a1e][k], x - 0.06 + k * 0.06, CT + 0.08, CZ - 0.15, 0, 0, 0, vcGloss());
    V(g, RB(0.1, 0.12, 0.08, 0.01, 1), 0x8a5a2e, x + 0.2, CT + 0.06, CZ - 0.18);
  }
  for (const x of [-3.3, -2.2, 1.1]) { V(g, cyl(0.035, 0.03, 0.09, 12), 0xd0e4ea, x + 0.2, CT + 0.045, CZ + 0.05, 0, 0, 0, vcGloss()); }
  V(g, lathe([[0, 0], [0.06, 0], [0.065, 0.18], [0.04, 0.24], [0, 0.24]], 14), 0xc9ccce, 2.75, CT, CZ - 0.1, 0, 0, 0, vcGloss());
  // our seat: bowl, spoon, chopsticks
  const bowl = ramenBowl(g, 0, CT, CZ + 0.07);
  V(g, RB(0.05, 0.008, 0.24, 0.003, 1), 0xd9b884, 0.17, CT + 0.004, CZ - 0.02, 0, 0.1, 0);
  for (const dx of [0.0, 0.014]) V(g, box(0.006, 0.006, 0.23), 0xc9a670, 0.21 + dx, CT + 0.012, CZ - 0.02, 0, 0.1, 0);
  V(g, lathe([[0, 0], [0.025, 0], [0.03, 0.02], [0, 0.02]], 10).scale(1, 1, 1.6), 0xf4f0e6, -0.17, CT, CZ - 0.0, 0, 0, 0, vcGloss());
  // the neighbours are mid-meal
  ramenBowl(g, -2.2, CT, CZ - 0.05);
  ramenBowl(g, 2.2, CT, CZ - 0.05);
  // kitchen
  const KZ = -3.3;
  blk(site, g, M.steel, -4.5, 4.5, FY, FY + 0.88, KZ - 0.5, KZ + 0.5);
  blk(site, g, M.steel, -4.5, 4.5, FY, FY + 0.82, CZ - 0.9, CZ - 0.35, false);
  solid(site, 0, FY + 0.45, CZ - 0.62, 9.0, 0.9, 0.6);
  for (const [x, r, h] of [[-2.6, 0.26, 0.5], [-1.8, 0.22, 0.38], [0.4, 0.2, 0.32], [1.1, 0.2, 0.3]]) {
    put(g, cyl(0.24, 0.24, 0.05, 20), M.dsteel, x, FY + 0.91, KZ);
    put(g, lathe([[0, 0], [r, 0], [r, h], [r + 0.015, h + 0.01], [r - 0.01, h + 0.01], [r - 0.01, 0.01], [0, 0.01]], 24), M.steel, x, FY + 0.94, KZ);
    V(g, cyl(r - 0.012, r - 0.012, 0.004, 20), x < 0 ? 0xd9b47a : 0xe9e0c8, x, FY + 0.94 + h - 0.04, KZ, 0, 0, 0, vcGloss());
    for (let k = 0; k < 3; k++) { const st = put(g, sphere(0.12 + k * 0.05, 12, 8), steamMat(), x + (k - 1) * 0.04, FY + 1.05 + h + k * 0.22, KZ + k * 0.03); st.castShadow = false; }
  }
  for (let i = 0; i < 4; i++) V(g, lathe([[0, 0], [0.12, 0], [0.13, 0.05], [0.12, 0.052], [0, 0.04]], 16), 0x2a2a2c, 2.6 + (i % 2) * 0.3, FY + 0.89 + Math.floor(i / 2) * 0.0, KZ + (i < 2 ? -0.15 : 0.15), 0, 0, 0, vcGloss());
  // stacked bowls on the back shelf, ladles hanging, menu board
  put(g, RB(6.0, 0.05, 0.35, 0.015, 1), M.oak, 0, 1.75, Z0 + 0.2);
  for (let s = 0; s < 6; s++) for (let k = 0; k < 4; k++) V(g, bowlGeo(0.1, 0.075), s % 2 ? 0x1d1b1d : 0xf2eee6, -2.6 + s * 0.45, 1.775 + k * 0.03, Z0 + 0.2, 0, 0, 0, vcGloss());
  put(g, cyl(0.012, 0.012, 2.4, 8), M.steel, 0.6, 1.52, Z0 + 0.12, 0, 0, PI / 2);
  for (let i = 0; i < 6; i++) { const x = -0.4 + i * 0.4; put(g, cyl(0.006, 0.006, 0.42, 6), M.steel, x, 1.31, Z0 + 0.13); put(g, lathe([[0, 0], [0.045, 0], [0.05, 0.04], [0.046, 0.042], [0.04, 0.006], [0, 0.006]], 12), M.steel, x, 1.06, Z0 + 0.13); }
  D(g, A.quad('menu', 4.6, 1.25), A.print, 0, 2.3, Z0 + 0.02);
  D(g, A.quad('kitchen', 0.9, 0.6), A.print, 3.4, 1.4, Z0 + 0.02);
  D(g, A.quad('hours', 0.5, 0.27), A.print, 0.2, 1.9, ZF + 0.18);
  // noren to the back room + towels
  noren(g, A, -3.9, 2.4, -1.35, 0.9, 0.6, 'norenInn');
  // pendant lamps over the counter
  for (const x of [-2.75, -0.55, 1.65]) {
    put(g, cyl(0.005, 0.005, 0.6, 4), M.dsteel, x, CL - 0.3, CZ - 0.1);
    put(g, lathe([[0.02, 0], [0.06, -0.02], [0.17, -0.18], [0.18, -0.2], [0.16, -0.2], [0.05, -0.04], [0.02, -0.02]], 20), paint(0x8a3a24, 0.5), x, CL - 0.6, CZ - 0.1);
    D(g, sphere(0.06, 12, 8), mat('lampGlow'), x, CL - 0.76, CZ - 0.1);
    site.lamps.push({ pos: [x, CL - 0.8, CZ], color: 0xffcf96, intensity: 5, range: 5 });
  }
  site.lamps.push({ pos: [-0.5, 2.5, ZF + 0.8], color: 0xffa070, intensity: 4, range: 5 });
  // interactable: our counter seat (x 0)
  const eye = [0, FY + 0.62 + 0.78, -0.2];
  const bt = [0, CT + 0.09, CZ + 0.07];
  site.interactables.push({ id: 'ramen', label: '라멘 먹기', pos: [0, 1.2, 0.0], radius: 1.3, seat: { pos: eye, yaw: 0, pitch: -Math.atan2(eye[1] - bt[1], eye[2] - bt[2]) } });
  site.extra.bowl = bowl;
  site.npcSpots.push({ pos: [0.3, FY, -2.15], yaw: PI, pose: 'stand', role: 'chef' });
  site.npcSpots.push({ pos: [-2.2, FY, -0.15], yaw: 0, pose: 'sit', role: 'customer' });
  site.npcSpots.push({ pos: [2.2, FY, -0.15], yaw: 0, pose: 'sit', role: 'customer' });
  site.spawn = { pos: [-0.5, 0.01, 4.0], yaw: 0 };
  bake(g);
  return site;
}
const steamMat = () => cached('jpSteam', () => { const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.07, depthWrite: false }); m.name = 'jpSteam'; return m; });

/* ================================================================== 3) ryokan */
export function buildRyokan() {
  const site = makeSite('ryokan', 22, 18);
  const g = site.group, M = JM(), A = atlas();
  const FY = 0.5, X0 = -10.6, X1 = 1.6, Z0 = -8.6, ZF = 1.0, CL = FY + 2.5;
  put(g, plane(22, 18), M.gravel, 0, 0.01, 0);
  // floor platform + genkan
  const GX0 = -2.6, GX1 = 1.5, GZ = -0.6;
  put(g, RB(X1 - X0, FY, ZF - Z0, 0.02, 1), M.stone, (X0 + X1) / 2, FY / 2 - 0.02, (Z0 + ZF) / 2);
  solid(site, (X0 + GX0) / 2, FY / 2, (Z0 + ZF) / 2, GX0 - X0, FY, ZF - Z0);
  solid(site, (GX0 + X1) / 2, FY / 2, (Z0 + GZ) / 2, X1 - GX0, FY, GZ - Z0);
  put(g, RB(GX1 - GX0, 0.14, ZF - GZ, 0.02, 1), mat('floorTile'), (GX0 + GX1) / 2, 0.07 + FY - 0.48, (GZ + ZF) / 2);
  solid(site, (GX0 + GX1) / 2, 0.07, (GZ + ZF) / 2, GX1 - GX0, 0.14, ZF - GZ);
  put(g, RB(1.4, 0.3, 0.4, 0.04, 2), M.stone, -0.5, 0.15, GZ + 0.25);
  solid(site, -0.5, 0.15, GZ + 0.25, 1.4, 0.3, 0.4);
  put(g, RB(GX1 - GX0, 0.12, 0.2, 0.02, 1), M.walnut, (GX0 + GX1) / 2, FY - 0.06, GZ - 0.1);
  put(g, plane(GX1 - GX0, GZ - Z0 - 0.2), mat('darkFloor'), (GX0 + GX1) / 2, FY + 0.002, (Z0 + GZ) / 2);
  // shoe shelves + slippers
  put(g, RB(0.4, 1.0, 1.4, 0.02, 1), M.walnut, GX1 - 0.25, 0.64, 0.2);
  for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) put(g, RB(0.36, 0.015, 0.4, 0.004, 1), M.oak, GX1 - 0.27, 0.3 + k * 0.3, -0.25 + i * 0.36);
  solid(site, GX1 - 0.25, 0.64, 0.2, 0.42, 1.0, 1.4);
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) V(g, RB(0.11, 0.035, 0.26, 0.04, 2), [0xb3261e, 0x2d3b6a, 0x7a5a3a][i], -1.4 + i * 0.4 + s * 0.065, FY + 0.018, GZ - 0.3, 0, 0, 0, vcSoft());
  // walls: back, left, right, front (with entrance), partition genkan | room
  const wallT = 0.16;
  blk(site, g, M.plaster, X0, X1, FY, CL, Z0, Z0 + wallT);
  blk(site, g, M.plaster, X0, X0 + wallT, FY, CL, Z0, ZF);
  blk(site, g, M.plaster, X1 - wallT, X1, FY, CL, Z0, ZF);
  blk(site, g, M.plaster, -1.7 + 1.25, X1, 0, CL, ZF - wallT, ZF);
  blk(site, g, M.plaster, GX0 - 0.1, -1.95, 0, CL, ZF - wallT, ZF);
  blk(site, g, M.plaster, -1.95, -0.45, 2.4, CL, ZF - wallT, ZF, false);
  slideDoor(site, g, M, -1.2, 0.14, ZF - 0.08, 0.75, 2.2, 0.72);
  noren(g, A, -1.2, 2.6, ZF + 0.12, 1.4, 0.7, 'norenInn');
  // room front: shoji screens facing the garden (x X0..GX0), engawa outside
  for (let i = 0; i < 8; i++) shoji(g, M, X0 + 0.5 + i * 0.97, FY + 1.1, ZF - 0.05, 0.96, 2.0, 0, 3, 8);
  solid(site, (X0 + GX0) / 2, FY + 1.2, ZF - 0.05, GX0 - X0, 2.4, 0.1);
  put(g, RB(GX0 - X0, 0.4, 0.14, 0.02, 1), M.plaster, (X0 + GX0) / 2, CL - 0.2, ZF - 0.05);
  put(g, RB(GX0 - X0 + 0.2, 0.08, 1.0, 0.02, 1), M.oak, (X0 + GX0) / 2, FY - 0.04, ZF + 0.5);
  solid(site, (X0 + GX0) / 2, FY / 2, ZF + 0.5, GX0 - X0 + 0.2, FY, 1.0);
  // partition between genkan corridor and room
  blk(site, g, M.plaster, GX0 - 0.08, GX0 + 0.08, FY, CL, Z0, -5.4);
  for (let i = 0; i < 4; i++) shoji(g, M, GX0, FY + 1.05, -5.0 + i * 0.95 + 0.47, 0.94, 2.1, PI / 2, 3, 8);
  solid(site, GX0, FY + 1.1, -3.2, 0.12, 2.2, 1.2);
  // posts and beams (dark timber) all round
  for (const x of [X0, -6.6, GX0, X1]) for (const z of [Z0, ZF]) post(g, M.timber, x, 0, CL + 0.15, z, 0.2);
  for (const z of [Z0, ZF]) put(g, RB(X1 - X0 + 0.3, 0.2, 0.22, 0.02, 1), M.timber, (X0 + X1) / 2, CL + 0.05, z);
  for (const x of [X0, X1]) put(g, RB(0.22, 0.2, ZF - Z0 + 0.2, 0.02, 1), M.timber, x, CL + 0.05, (Z0 + ZF) / 2);
  put(g, RB(X1 - X0, 0.08, 0.2, 0.02, 1), M.timber, (X0 + X1) / 2, FY + 0.03, ZF + 0.02);
  // ceiling with battens
  put(g, plane(X1 - X0, ZF - Z0).rotateX(PI), M.oak, (X0 + X1) / 2, CL, (Z0 + ZF) / 2);
  for (let x = X0 + 0.45; x < X1; x += 0.45) put(g, box(0.035, 0.03, ZF - Z0), M.timber, x, CL - 0.015, (Z0 + ZF) / 2);
  site.indoor.push(aabb(X0, FY, Z0, X1, CL, ZF));
  // tatami (1.8 x 0.9) with dark borders
  const tR = rng(4);
  for (let iz = 0; iz < 10; iz++) for (let ix = 0; ix < 4; ix++) {
    const x = X0 + 0.16 + 0.9 + ix * 1.82 + (iz % 2) * 0.45, z = Z0 + 0.16 + 0.46 + iz * 0.92;
    if (x + 0.9 > GX0 - 0.08) continue;
    const tone = [0xffffff, 0xf4f0e2, 0xeef2dc][(tR() * 3) | 0];
    put(g, tint(RB(1.8, 0.04, 0.9, 0.008, 1), tone), M.tatami, x, FY + 0.02, z);
    for (const s of [-1, 1]) V(g, box(1.8, 0.042, 0.035), 0x2d2a26, x, FY + 0.021, z + s * 0.43, 0, 0, 0, vcSoft());
  }
  put(g, tint(plane(GX0 - X0, ZF - Z0 - 0.2), 0xe6e2c8), M.tatami, (X0 + GX0) / 2, FY + 0.001, (Z0 + ZF) / 2);
  for (let x = X0 + 2.2; x < GX0 - 0.5; x += 1.82) post(g, M.timber, x, FY, CL, Z0 + 0.2, 0.14, 0.08);
  for (let z = Z0 + 1.8; z < ZF - 0.5; z += 1.82) post(g, M.timber, X0 + 0.2, FY, CL, z, 0.08, 0.14);
  put(g, RB(GX0 - X0 - 0.3, 0.06, 0.04, 0.01, 1), M.timber, (X0 + GX0) / 2, FY + 1.95, Z0 + 0.18);
  // tokonoma alcove with scroll and ikebana
  put(g, RB(1.9, 0.14, 0.75, 0.02, 1), M.walnut, X0 + 1.2, FY + 0.07, Z0 + 0.55);
  post(g, M.walnut, X0 + 2.2, FY, CL, Z0 + 0.9, 0.14);
  put(g, RB(1.9, 0.3, 0.08, 0.02, 1), M.plaster, X0 + 1.2, CL - 0.35, Z0 + 0.9);
  D(g, A.quad('scroll', 0.5, 1.37), A.print, X0 + 1.2, FY + 1.25, Z0 + 0.18);
  V(g, lathe([[0, 0], [0.09, 0], [0.11, 0.12], [0.06, 0.24], [0.04, 0.28], [0, 0.28]], 18), 0x3a4a5a, X0 + 1.65, FY + 0.14, Z0 + 0.5, 0, 0, 0, vcGloss());
  for (let i = 0; i < 5; i++) { const a = i * 1.3; V(g, cyl(0.004, 0.004, 0.45, 5), 0x4a6a30, X0 + 1.65 + Math.cos(a) * 0.04, FY + 0.6, Z0 + 0.5 + Math.sin(a) * 0.04, Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3); V(g, sphere(0.03, 8, 6), [0xf2a7c0, 0xffffff, 0xe8546a][i % 3], X0 + 1.65 + Math.cos(a) * 0.12, FY + 0.82, Z0 + 0.5 + Math.sin(a) * 0.1); }
  solid(site, X0 + 1.2, FY + 0.5, Z0 + 0.55, 1.9, 1.0, 0.75);
  // low table, cushions, tea set
  const TX = -6.4, TZ = -1.9;
  put(g, RB(1.5, 0.06, 0.9, 0.02, 2), M.walnut, TX, FY + 0.33, TZ);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, RB(0.08, 0.3, 0.08, 0.01, 1), M.walnut, TX + sx * 0.65, FY + 0.15, TZ + sz * 0.35);
  solid(site, TX, FY + 0.18, TZ, 1.5, 0.36, 0.9);
  for (const [i, [dx, dz]] of [[0, 0.8], [0, -0.8], [-1.1, 0], [1.1, 0]].entries()) zabuton(g, TX + dx, FY, TZ + dz, 0x7a3a3e, (i % 2) * PI / 2 + i * 0.05, i);
  teaSet(g, TX, FY + 0.36, TZ);
  // futon laid out (head towards -X), andon lamp beside it
  const FX = -8.0, FZ = -5.3;
  // shikibuton (piped, a little tufted), indigo kakebuton with a flower print falling to the tatami,
  // white cover turned down at the head, round buckwheat pillow (soft.js). Local +Z of fg = world +X.
  const fg = group(g, FX, FY, FZ, PI / 2);
  put(fg, painted(cushion(1.05, 0.12, 2.1, 0.05, 0.016, 0.004, 2, 0.008, 0.005), 0xf4f0e8), clothMat(), 0, 0.06, 0);
  put(fg, drape({ w: 1.12, len: 1.5, drop: 0.07, z0: -0.47, r: 0.05, th: 0.04, foot: true, footDrop: 0.07, quilt: 0.36, puff: 0.024, seed: 4 }), printMat('floral', { color: 0x2f3f6e, flowers: [0xf2a7c0, 0xfbf6ec, 0xe8c24a], leaf: 0x6f9a7a, count: 5, seed: 8 }, 0.5), 0, 0.14, 0);
  put(fg, painted(drape({ w: 1.16, len: 0.26, drop: 0.05, z0: -0.5, r: 0.06, th: 0.03, foot: false, seed: 6, nx: 28, nz: 5 }), 0xf2eee6), clothMat(), 0, 0.176, 0);
  put(fg, painted(bolster(0.48, 0.085, 3), 0xf6f2ea), clothMat(), 0, 0.2, -0.84, 0.1, 0, 0);
  V(g, RB(0.4, 0.03, 0.3, 0.01, 1), 0x2d3b6a, FX + 1.25, FY + 0.016, FZ - 0.6, 0, 0.2, 0, vcSoft());
  solid(site, FX, FY + 0.1, FZ, 2.1, 0.2, 1.05);
  const an = group(g, FX - 1.1, FY, FZ + 0.9, 0.3);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(an, RB(0.025, 0.55, 0.025, 0.005, 1), M.walnut, sx * 0.13, 0.275, sz * 0.13);
  put(an, RB(0.24, 0.38, 0.24, 0.01, 1), M.washi, 0, 0.32, 0).castShadow = false;
  put(an, RB(0.3, 0.025, 0.3, 0.01, 1), M.walnut, 0, 0.55, 0);
  site.lamps.push({ pos: [FX - 1.1, FY + 0.4, FZ + 0.9], color: 0xffc98a, intensity: 3, range: 4 });
  site.lamps.push({ pos: [TX, CL - 0.4, TZ], color: 0xffe0b8, intensity: 6, range: 7 });
  site.lamps.push({ pos: [-0.5, CL - 0.4, -0.2], color: 0xffe0b8, intensity: 4, range: 5 });
  // ceiling paper lamp
  put(g, CY(0.3, 0.3, 0.2, 20), M.washi, TX, CL - 0.2, TZ).castShadow = false;
  put(g, torus(0.3, 0.01, 4, 20), M.timber, TX, CL - 0.1, TZ, PI / 2);
  put(g, torus(0.3, 0.01, 4, 20), M.timber, TX, CL - 0.3, TZ, PI / 2);
  site.interactables.push({ id: 'futon', label: '료칸에서 자기', pos: [FX, FY + 0.6, FZ + 0.7], radius: 1.6, seat: { pos: [FX - 0.75, FY + 0.35, FZ], yaw: -PI / 2, pitch: 0.45 } });
  site.spawn = { pos: [FX + 0.2, FY, FZ + 1.0], yaw: PI };
  // ---- roof
  const ry = curvedRoof(g, { x0: X0 - 1.0, x1: X1 + 1.0, ridgeY: CL + 2.6, ridgeZ: (Z0 + ZF) / 2, front: 5.85, back: 5.85, slope: 0.6, sag: 0.03, lift: 0.4, th: 0.2 });
  for (const sx of [-1, 1]) gable(g, M.plaster, sx > 0 ? X1 : X0 + 0.14, Z0, ZF, CL + 0.12, ry, 0.26, 0.14);
  // sign at the entrance
  put(g, RB(2.6, 0.62, 0.1, 0.02, 1), M.timber, -1.0, CL + 0.55, ZF + 0.15);
  D(g, A.quad('signInn', 2.5, 0.6), A.lit, -1.0, CL + 0.55, ZF + 0.205);
  site.nightGlow.push(A.lit, M.washi);
  // ---- garden in front: pond, stepping stones, pine, lantern, fence + gate
  const pond = new THREE.Shape(); pond.absellipse(0, 0, 2.2, 1.4, 0, TAU, false);
  put(g, extrude(pond, 0.02).rotateX(PI / 2), M.water, -6.0, 0.06, 4.8);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; const r = rock({ seed: 30 + (i % 4), size: 0.62 + (i % 3) * 0.1 }); r.position.set(-6.0 + Math.cos(a) * 2.35, 0, 4.8 + Math.sin(a) * 1.5); r.rotation.y = a; g.add(r); }
  solid(site, -6.0, 0.25, 4.8, 4.8, 0.5, 3.1);
  for (let i = 0; i < 7; i++) { const t = i / 6; V(g, RB(0.55, 0.08, 0.45, 0.15, 2), 0x9a958a, -1.0 + Math.sin(t * 3) * 0.3, 0.04, 8.3 - t * 6.6, 0, t * 2, 0); }
  const pn = tree({ kind: 'pine', seed: 11, height: 5.2 }); pn.position.set(-9.6, 0, 6.6); g.add(pn); solid(site, -9.6, 1.2, 6.6, 0.5, 2.4, 0.5);
  const mp = tree({ kind: 'maple', seed: 4, height: 4.6 }); mp.position.set(3.0, 0, 6.2); g.add(mp); solid(site, 3.0, 1.2, 6.2, 0.5, 2.4, 0.5);
  const sl = stoneLantern({ h: 1.6 }); sl.position.set(-3.4, 0.01, 5.6); g.add(sl); solid(site, -3.4, 0.8, 5.6, 0.6, 1.6, 0.6);
  site.nightGlow.push(sl.userData.glowMat);
  for (const [x, z, s] of [[-8.6, 3.2, 0.85], [-4.0, 3.0, 0.7], [-7.8, 7.6, 0.8]]) { const r = rock({ seed: x * 3 | 0, size: s }); r.position.set(x, 0, z); g.add(r); }
  const f1 = bambooFence(8.6); f1.position.set(-6.7, 0, 8.75); g.add(f1);
  const f2 = bambooFence(8.6); f2.position.set(6.7, 0, 8.75); g.add(f2);
  solid(site, -6.7, 0.9, 8.75, 8.6, 1.8, 0.16); solid(site, 6.7, 0.9, 8.75, 8.6, 1.8, 0.16);
  for (const sx of [-2.4, 0.4]) post(g, M.timber, sx, 0, 2.6, 8.75, 0.2);
  curvedRoof(g, { x0: -2.9, x1: 0.9, ridgeY: 3.1, ridgeZ: 8.75, front: 0.75, back: 0.75, slope: 0.55, sag: 0.05, lift: 0.1, th: 0.1 });
  put(g, RB(3.0, 0.16, 0.2, 0.02, 1), M.timber, -1.0, 2.55, 8.75);
  // ---- onsen (outdoor stone bath) at the back right, bamboo fence round it
  const OX = 6.4, OZ = -4.6;
  put(g, RB(8.8, 0.12, 8.2, 0.03, 1), M.stone, OX, 0.06, OZ);
  const pool = new THREE.Shape(); pool.absellipse(0, 0, 2.9, 2.3, 0, TAU, false);
  put(g, extrude(pool, 0.4).rotateX(PI / 2), paint(0x3a4a48, 0.8), OX, 0.1, OZ);
  put(g, extrude(pool, 0.02).rotateX(PI / 2), M.water, OX, 0.42, OZ);
  for (let i = 0; i < 13; i++) { const a = (i / 13) * TAU; const r = rock({ seed: 60 + (i % 5), size: 0.8 + (i % 3) * 0.04, moss: i % 3 === 0 }); r.position.set(OX + Math.cos(a) * 3.05, 0.1, OZ + Math.sin(a) * 2.45); r.rotation.y = a * 2; g.add(r); }
  for (const [x, z, s] of [[OX - 1.6, OZ - 2.6, 0.88], [OX + 2.4, OZ - 2.0, 0.85], [OX + 3.0, OZ + 0.6, 0.8]]) { const r = rock({ seed: x * 7 | 0, size: s }); r.position.set(x, 0.1, z); g.add(r); }
  for (const [dx, dz, k] of [[0.6, -1.4, 0], [1.4, -1.0, 1], [1.9, -0.2, 2], [0.2, -1.7, 1]]) for (let j = 0; j < 3; j++) { const st = put(g, sphere(0.16 + j * 0.06, 10, 6).scale(1, 1.6, 1), steamMat(), OX + dx + j * 0.06, 0.62 + j * 0.32 + k * 0.05, OZ + dz - j * 0.04); st.castShadow = false; }
  solid(site, OX, 0.3, OZ - 2.45, 6.0, 0.6, 0.5);
  solid(site, OX + 3.0, 0.3, OZ, 0.5, 0.6, 4.6);
  const fb = bambooFence(8.6); fb.position.set(OX, 0, Z0 - 0.0); g.add(fb);
  const fr = bambooFence(8.0); fr.position.set(10.7, 0, OZ); fr.rotation.y = PI / 2; g.add(fr);
  const ff = bambooFence(5.4); ff.position.set(OX + 1.6, 0, -0.3); g.add(ff);
  solid(site, OX, 0.9, Z0, 8.6, 1.8, 0.16); solid(site, 10.7, 0.9, OZ, 0.16, 1.8, 8.0); solid(site, OX + 1.6, 0.9, -0.3, 5.4, 1.8, 0.16);
  // wooden deck from the building to the bath, wash stools + buckets
  put(g, RB(1.8, 0.1, 6.0, 0.02, 1), M.oak, 2.5, 0.17, OZ + 0.3);
  for (let i = 0; i < 2; i++) { const bx = 2.4, bz = -6.6 + i * 1.1; put(g, lathe([[0, 0], [0.13, 0], [0.15, 0.18], [0.14, 0.19], [0.12, 0.02], [0, 0.02]], 18), M.oak, bx, 0.22, bz); put(g, RB(0.32, 0.2, 0.22, 0.02, 1), M.oak, bx + 0.4, 0.32, bz); }
  noren(g, A, X1 + 0.02, 2.4, -5.6, 1.0, 0.7, 'norenYu');
  site.interactables.push({ id: 'onsen', label: '온천 하기', pos: [OX - 2.6, 1.2, OZ + 0.8], radius: 2.2, seat: { pos: [OX - 1.2, 0.95, OZ + 0.9], yaw: -0.5, pitch: -0.08 } });
  site.lamps.push({ pos: [OX, 2.2, OZ], color: 0xffd9a8, intensity: 4, range: 7 });
  site.parking = { pos: [7.5, 0, 6.5], yaw: 0 };
  bake(g);
  return site;
}

/* ================================================================== 4) souvenir shop */
export function buildSouvenirShop() {
  const site = makeSite('souvenirShop', 9, 8);
  const g = site.group, M = JM(), A = atlas();
  const FY = 0.1, X0 = -4.2, X1 = 4.2, Z0 = -3.6, ZF = 2.8, CL = 2.9;
  put(g, plane(9, 8), mat('pavers2'), 0, 0.006, 0);
  blk(site, g, M.stone, X0 - 0.1, X1 + 0.1, 0, FY, Z0 - 0.1, ZF + 0.2);
  put(g, plane(X1 - X0, ZF - Z0), mat('oakFloor'), 0, FY + 0.002, (Z0 + ZF) / 2);
  put(g, plane(X1 - X0, ZF - Z0).rotateX(PI), M.plaster, 0, CL, (Z0 + ZF) / 2);
  site.indoor.push(aabb(X0, FY, Z0, X1, CL, ZF));
  blk(site, g, M.plaster, X0, X1, FY, 4.4, Z0 - 0.15, Z0);
  for (const sx of [-1, 1]) blk(site, g, M.plaster, sx > 0 ? X1 : X0 - 0.15, sx > 0 ? X1 + 0.15 : X0, FY, 4.4, Z0 - 0.15, ZF + 0.15);
  for (const px of [X0 - 0.05, -1.0, 1.0, X1 + 0.05]) post(g, M.timber, px, FY, 3.0, ZF + 0.05, 0.18);
  put(g, RB(X1 - X0 + 0.4, 0.24, 0.24, 0.02, 1), M.timber, 0, 2.95, ZF + 0.05);
  blk(site, g, mat('plasterWarm'), X0 - 0.15, X1 + 0.15, 3.07, 4.4, ZF, ZF + 0.15);
  for (const sx of [-1, 1]) {
    const cx = sx * 2.6;
    blk(site, g, M.timber, sx > 0 ? 1.09 : X0, sx > 0 ? X1 : -1.09, FY, 0.8, ZF - 0.1, ZF + 0.12);
    D(g, quad(3.0, 1.9), M.glass, cx, 1.8, ZF + 0.1);
    solid(site, cx, 1.5, ZF, 3.1, 3.0, 0.2);
    for (let i = 1; i < 3; i++) put(g, box(0.05, 1.9, 0.06), M.timber, cx - 1.5 + i, 1.8, ZF + 0.1);
  }
  slideDoor(site, g, M, -0.5, FY, ZF + 0.02, 1.0, 2.6, -0.95);
  slideDoor(site, g, M, 0.5, FY, ZF - 0.04, 1.0, 2.6, 0.95);
  // awning + sign
  curvedRoof(g, { x0: X0 - 0.3, x1: X1 + 0.3, ridgeY: 3.25, ridgeZ: ZF + 0.15, front: 1.1, back: 0, slope: 0.5, sag: 0.05, lift: 0.12, ridge: false, th: 0.12 });
  put(g, RB(4.4, 0.95, 0.12, 0.03, 2), M.timber, 0, 3.95, ZF + 0.2);
  D(g, A.quad('signShop', 4.2, 0.9), A.lit, 0, 3.95, ZF + 0.262);
  put(g, polyLathe([[0, 0], [5.0, 0], [5.0, 0.1], [0, 0.1]], 4, PI / 4).scale(0.9, 1, 0.21), M.tile, 0, 4.4, (Z0 + ZF) / 2);
  site.nightGlow.push(A.lit);
  // big beckoning cat by the door, display table outside
  manekiNeko(g, -1.55, 0.006 + 0.3, ZF + 0.55, 0.62, 0xf6f3ec, 0.2);
  put(g, RB(0.5, 0.3, 0.45, 0.04, 2), M.stone, -1.55, 0.15, ZF + 0.55);
  solid(site, -1.55, 0.5, ZF + 0.55, 0.5, 1.0, 0.45);
  put(g, RB(1.3, 0.06, 0.6, 0.02, 1), M.oak, 2.6, 0.75, ZF + 0.7);
  for (const sx of [-1, 1]) put(g, RB(0.05, 0.72, 0.5, 0.01, 1), M.timber, 2.6 + sx * 0.6, 0.36, ZF + 0.7);
  solid(site, 2.6, 0.4, ZF + 0.7, 1.3, 0.8, 0.6);
  const snack = (x, y, z, k, ry = 0, s = 1) => { const q = A.mapSub(prep(new THREE.BoxGeometry(0.22 * s, 0.07 * s, 0.16 * s), true), 'snacks', k / 8, (k + 1) / 8); put(g, q, A.print, x, y + 0.035 * s, z, 0, ry, 0); };
  for (let i = 0; i < 5; i++) for (let k = 0; k < 2; k++) snack(2.1 + i * 0.24, 0.78 + k * 0.07, ZF + 0.7, (i + k * 3) % 8, (i % 2) * 0.1);
  D(g, A.quad('price', 0.3, 0.08), A.print, 2.6, 0.75, ZF + 1.005);
  // shelves along both side walls: cats, snack boxes
  const shelfR = rng(31);
  const cats = [0xf6f3ec, 0xd8b25a, 0x2a2a2c, 0xc8301e, 0xf2a7c0, 0xf6f3ec];
  for (const sx of [-1, 1]) {
    const x = sx * (X1 - 0.35);
    put(g, RB(0.5, 2.1, 4.6, 0.02, 1), M.walnut, x + sx * 0.2, FY + 1.05, -0.7);
    solid(site, x, FY + 1.05, -0.7, 0.62, 2.1, 4.6);
    for (let k = 0; k < 4; k++) {
      const y = FY + 0.3 + k * 0.5;
      put(g, RB(0.5, 0.04, 4.5, 0.01, 1), M.oak, x, y, -0.7);
      for (let i = 0; i < 9; i++) {
        const z = -2.8 + i * 0.5;
        if ((k + (sx > 0 ? 1 : 0)) % 2 === 0) manekiNeko(g, x, y + 0.02, z, 0.12 + shelfR() * 0.16, cats[(shelfR() * cats.length) | 0], sx > 0 ? -PI / 2 : PI / 2);
        else { snack(x, y + 0.02, z - 0.1, (i + k) % 8, PI / 2 * sx, 1); snack(x, y + 0.09, z - 0.08, (i + k + 2) % 8, PI / 2 * sx + 0.1, 1); snack(x, y + 0.02, z + 0.14, (i + 5) % 8, PI / 2 * sx, 1); }
      }
    }
  }
  // back wall: fans and keychain pegboard
  D(g, A.quad('fans', 2.6, 0.87), A.print, -1.2, 2.25, Z0 + 0.01);
  put(g, RB(1.8, 1.2, 0.04, 0.01, 1), mat('whiteWood'), 1.8, 1.6, Z0 + 0.02);
  for (let i = 0; i < 6; i++) for (let k = 0; k < 4; k++) {
    const x = 1.1 + i * 0.27, y = 2.05 - k * 0.3;
    put(g, cyl(0.004, 0.004, 0.08, 4), M.steel, x, y, Z0 + 0.08, PI / 2, 0, 0);
    V(g, torus(0.012, 0.0025, 4, 10), 0xc9ccce, x, y - 0.03, Z0 + 0.11, 0, 0, 0, vcGloss());
    const kind = (i + k) % 3;
    if (kind === 0) manekiNeko(g, x, y - 0.12, Z0 + 0.11, 0.07, cats[(i + k) % 6]);
    else if (kind === 1) V(g, sphere(0.03, 10, 8), [0xf2a7c0, 0x8ab050, 0x4b7ad8][k % 3], x, y - 0.08, Z0 + 0.11, 0, 0, 0, vcGloss());
    else V(g, prep(new THREE.ConeGeometry(0.035, 0.05, 12)), 0x4b6a9a, x, y - 0.09, Z0 + 0.11, 0, 0, 0, vcGloss());
  }
  // postcard spinner in the middle
  const pc = group(g, 0.4, FY, -0.2, 0.3);
  put(pc, cyl(0.02, 0.02, 1.7, 10), M.steel, 0, 0.85, 0);
  put(pc, cyl(0.25, 0.28, 0.04, 20), M.dsteel, 0, 0.02, 0);
  for (let k = 0; k < 3; k++) for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU, y = 0.75 + k * 0.33;
    const card = group(pc, Math.sin(a) * 0.14, y, Math.cos(a) * 0.14, a);
    put(card, RB(0.3, 0.012, 0.05, 0.004, 1), M.steel, 0, -0.1, 0.02);
    D(card, A.quad(['fujiCard', 'fujiCard2', 'fujiCard3'][(i + k) % 3], 0.22, 0.15), A.print, 0, 0, 0.03, -0.15, 0, 0);
  }
  solid(site, 0.4, FY + 0.85, -0.2, 0.6, 1.7, 0.6);
  // counter, register, shopkeeper
  const KX = 1.6, KZ = -2.4;
  put(g, RB(2.0, 0.95, 0.6, 0.02, 2), M.walnut, KX, FY + 0.475, KZ);
  put(g, RB(2.1, 0.05, 0.7, 0.02, 1), M.oak, KX, FY + 0.97, KZ);
  solid(site, KX, FY + 0.5, KZ, 2.1, 1.0, 0.7);
  V(g, RB(0.32, 0.12, 0.28, 0.02, 2), 0x3a3d42, KX + 0.4, FY + 1.06, KZ - 0.05, 0, 0, 0, vcGloss());
  V(g, RB(0.24, 0.14, 0.02, 0.01, 1), 0x2a2c30, KX + 0.4, FY + 1.18, KZ - 0.12, -0.3, 0, 0);
  D(g, quad(0.2, 0.1), glowScreen(), KX + 0.4, FY + 1.18, KZ - 0.108, -0.3, 0, 0);
  manekiNeko(g, KX - 0.6, FY + 1.0, KZ, 0.22, 0xd8b25a);
  for (let i = 0; i < 3; i++) V(g, RB(0.18, 0.12, 0.12, 0.01, 1), [0xc8402a, 0x2d5aa8, 0xf2c14e][i], KX - 0.15 + i * 0.05, FY + 1.06 + i * 0.12, KZ + 0.1, 0, i * 0.2, 0);
  site.interactables.push({ id: 'souvenir', label: '기념품 사기', pos: [KX, 1.3, KZ + 0.6], radius: 1.5 });
  site.npcSpots.push({ pos: [KX, FY, KZ - 0.7], yaw: PI, pose: 'stand', role: 'shopkeeper' });
  // lamps: paper pendants
  for (const [x, z] of [[-1.5, -0.6], [1.5, -0.6], [0, 1.5]]) {
    put(g, cyl(0.005, 0.005, 0.5, 4), M.dsteel, x, CL - 0.25, z);
    put(g, sphere(0.2, 16, 10).scale(1, 0.8, 1), M.washi, x, CL - 0.6, z).castShadow = false;
    site.lamps.push({ pos: [x, CL - 0.7, z], color: 0xffe2b8, intensity: 5, range: 6 });
  }
  site.nightGlow.push(M.washi);
  const lt = paperLantern(0xcf3326, { text: '土産' }); lt.position.set(1.6, 2.75, ZF + 0.95); g.add(lt);
  site.nightGlow.push(lt.userData.glowMat);
  site.spawn = { pos: [0, 0.01, 3.6], yaw: 0 };
  bake(g);
  return site;
}
const glowScreen = () => cached('jpRegScreen', () => { const m = glow(0x9ad8ff, 1.2); m.name = 'jpRegScreen'; return m; });

/* ================================================================== viewer helpers */
export function japanStreetView() {
  const g = new THREE.Group();
  const add = (s, x, z) => { s.group.position.set(x, 0, z); g.add(s.group); };
  add(buildRamenShop(), -6, 0); add(buildSouvenirShop(), 4, 0);
  return g;
}
void vcMat; void vcLeaf; void leafGeo; void JFONT; void rrect; void SP; void vendingMachine;
