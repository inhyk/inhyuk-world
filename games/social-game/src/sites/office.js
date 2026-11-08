// 세온 컴퍼니 (SEONN) office tower, plus the small building kit (vertex-colour clutter, canvas atlases,
// plants, office furniture) that othercompany.js, restaurant.js and pension.js import.
// Site contract: see ../site.js. Local space: origin = footprint centre, entrance faces +Z.
import * as THREE from 'three';
import { mat, paint, textured, glow } from '../mat.js';
import { rbox, box, cyl, sphere, capsule, torus, lathe, tube, plane, quad, prep, put, group, bake, displace, aabb } from '../geom.js';
import { canvasTex, FONT } from '../tex.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { metricUV } from '../geom.js';
import { makeSite, solid } from '../site.js';
import { rng } from '../noise.js';
import { cushion, cushionZ, cushionX, throwPillow, painted, velvetMat } from '../soft.js';

export const PI = Math.PI;
const GEO = new Map();
const TPL = new Map();
/**
 * Same shape as geom.js rbox() (RoundedBoxGeometry: corner centres +- (half - r) plus r * normal), but built
 * from a cached unit template, ~20x faster. Metric UVs like every geom.js helper.
 */
export function fastRB(w, h, d, r = 0.02, seg = 3) {
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  let t = TPL.get(seg);
  if (!t) {
    let g0 = new RoundedBoxGeometry(2, 2, 2, seg, 0.5);
    if (g0.index) g0 = g0.toNonIndexed();
    const p = g0.attributes.position.array, n = g0.attributes.normal.array;
    const inner = new Float32Array(p.length);
    for (let i = 0; i < p.length; i++) inner[i] = (p[i] - 0.5 * n[i]) / 0.5;
    t = { inner, n: Float32Array.from(n) };
    TPL.set(seg, t);
  }
  const { inner, n } = t, hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  const pos = new Float32Array(inner.length);
  for (let i = 0; i < inner.length; i += 3) {
    pos[i] = inner[i] * hx + n[i] * r; pos[i + 1] = inner[i + 1] * hy + n[i + 1] * r; pos[i + 2] = inner[i + 2] * hz + n[i + 2] * r;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(n.slice(), 3));
  return metricUV(g);
}
const memo = (name, fn) => (...a) => { const k = name + a.join(','); let g = GEO.get(k); if (!g) { g = fn(...a); g.userData.shared = true; GEO.set(k, g); } return g; };
/** Cached geometry, shared between meshes (bake clones it). Never mutate it; tint() makes its own copy. */
export const RB = memo('rb', fastRB), CY = memo('cy', cyl), SP = memo('sp', sphere);

/* ============================================================== kit: colours and materials */
const _c = new THREE.Color();
/** Give a geometry a flat vertex colour (sRGB hex) so it can share one vertex-colour material. */
export function tint(geo, hex) {
  if (geo.userData.shared) { geo = geo.clone(); geo.userData = {}; }
  _c.set(hex);
  const n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
const CACHE = new Map();
export function cached(key, make) { if (!CACHE.has(key)) CACHE.set(key, make()); return CACHE.get(key); }
function vcOf(base, name, side) { const m = base.clone(); m.vertexColors = true; m.color.set(0xffffff); m.name = name; if (side) m.side = side; return m; }
/** Satin plastic/paint, coloured per vertex: mugs, binders, books, pens... one draw call for all. */
export const vcMat = () => cached('vc', () => vcOf(paint(0xffffff, 0.5), 'vc', THREE.DoubleSide));
/** Glossy (ceramic, lacquer) vertex-colour material. */
export const vcGloss = () => cached('vcGloss', () => vcOf(paint(0xffffff, 0.16, 0, { clearcoat: 0.6 }), 'vcGloss', THREE.DoubleSide));
/** Woven fabric, vertex coloured: jackets, cushions, bags. */
export const vcSoft = () => cached('vcSoft', () => vcOf(mat('linen'), 'vcSoft'));
/** Foliage (double sided). */
export const vcLeaf = () => cached('vcLeaf', () => vcOf(paint(0xffffff, 0.55), 'vcLeaf', THREE.DoubleSide));

/** put() with a vertex colour. */
export function V(parent, geo, hex, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, m = vcMat()) {
  return put(parent, tint(geo, hex), m, x, y, z, rx, ry, rz);
}
/** put() without shadow casting (decals, glass, glows). */
export function D(parent, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const o = put(parent, geo, m, x, y, z, rx, ry, rz);
  o.castShadow = false;
  return o;
}

/* ============================================================== kit: canvas atlas */
/** Many small canvas drawings in one texture, so all signs/screens/labels share one material. */
export class Atlas {
  constructor(size = 2048, pad = 8) { Object.assign(this, { size, pad, items: new Map(), jobs: [] }); }
  /** Register a drawing of w x h pixels; placement happens in build() (tallest first, shelf packing). */
  add(key, w, h, draw) { this.jobs.push({ key, w, h, draw }); return this; }
  build() {
    const { size, pad } = this;
    let x = pad, y = pad, rowH = 0;
    for (const j of [...this.jobs].sort((a, b) => b.h - a.h || b.w - a.w)) {
      if (x + j.w + pad > size) { x = pad; y += rowH + pad; rowH = 0; }
      if (y + j.h + pad > size) throw new Error('atlas full at ' + j.key);
      j.x = x; j.y = y; this.items.set(j.key, j);
      x += j.w + pad; rowH = Math.max(rowH, j.h);
    }
    this.tex = canvasTex(size, size, (c) => {
      for (const r of this.jobs) {
        c.save(); c.translate(r.x, r.y); c.beginPath(); c.rect(0, 0, r.w, r.h); c.clip();
        r.draw(c, r.w, r.h);
        c.restore();
      }
    });
    return this.tex;
  }
  mapUV(geo, key) {
    const r = this.items.get(key);
    if (!r) throw new Error('no atlas item ' + key);
    const S = this.size, uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      uv.setXY(i, (r.x + u * r.w) / S, 1 - (r.y + (1 - v) * r.h) / S);
    }
    uv.needsUpdate = true;
    return geo;
  }
  /** Map only the horizontal slice [u0, u1] of item `key` onto geo. */
  mapSub(geo, key, u0, u1) {
    const r = this.items.get(key), S = this.size, uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const u = u0 + uv.getX(i) * (u1 - u0), v = uv.getY(i);
      uv.setXY(i, (r.x + u * r.w) / S, 1 - (r.y + (1 - v) * r.h) / S);
    }
    uv.needsUpdate = true;
    return geo;
  }
  /** Plane facing +Z showing atlas item `key`. */
  quad(key, w, h) { return this.mapUV(quad(w, h), key); }
  /** Printed (non emissive) material. */
  printed(rough = 0.62) { const m = new THREE.MeshStandardMaterial({ map: this.tex, roughness: rough, metalness: 0, alphaTest: 0.5 }); m.name = 'atlasPrint'; return m; }
  /** Emissive material (screens, lit signs); cut-out where the canvas is transparent. */
  lit(intensity = 1, diffuse = 0x202020) { const m = glow(0xffffff, intensity, this.tex); m.color.set(diffuse); m.alphaTest = 0.5; m.name = 'atlasGlow'; return m; }
}

/* canvas drawing helpers */
export function txt(c, s, x, y, px, color, align = 'left', base = 'alphabetic') {
  c.font = `${px}px ${FONT}`; c.fillStyle = color; c.textAlign = align; c.textBaseline = base; c.fillText(s, x, y);
}
export function rr(c, x, y, w, h, r, fill, stroke, lw = 2) {
  c.beginPath(); c.roundRect(x, y, w, h, r);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
export function lines(c, x, y, w, n, gap, color, R, th = 3) {
  c.fillStyle = color;
  for (let i = 0; i < n; i++) c.fillRect(x, y + i * gap, w * (i === n - 1 ? 0.55 : 0.75 + R() * 0.25), th);
}
/** SEONN mark: a ring with a rising sun over a wave. */
export function drawMark(c, cx, cy, r, ring = '#3cc4bd', sun = '#ffb34d') {
  c.save();
  c.lineWidth = r * 0.2; c.strokeStyle = ring; c.beginPath(); c.arc(cx, cy, r * 0.9, 0, PI * 2); c.stroke();
  c.fillStyle = sun; c.beginPath(); c.arc(cx, cy + r * 0.12, r * 0.42, PI, 0); c.closePath(); c.fill();
  c.strokeStyle = ring; c.lineWidth = r * 0.16; c.lineCap = 'round';
  c.beginPath(); c.moveTo(cx - r * 0.55, cy + r * 0.36);
  c.bezierCurveTo(cx - r * 0.25, cy + r * 0.14, cx - r * 0.05, cy + r * 0.58, cx + r * 0.2, cy + r * 0.36);
  c.bezierCurveTo(cx + r * 0.32, cy + r * 0.26, cx + r * 0.45, cy + r * 0.28, cx + r * 0.55, cy + r * 0.34);
  c.stroke();
  c.restore();
}

/** Screens for monitors (opaque). kind: code | sheet | dash | chat | mail | design */
export function drawScreen(kind, seed = 1) {
  return (c, w, h) => {
    const R = rng(seed);
    if (kind === 'code') {
      c.fillStyle = '#1c222b'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#151a21'; c.fillRect(0, 0, w * 0.2, h);
      c.fillStyle = '#262e3a'; c.fillRect(0, 0, w, h * 0.07);
      c.fillStyle = '#34404f'; c.fillRect(w * 0.2, 0, w * 0.17, h * 0.07);
      for (let i = 0; i < 14; i++) { c.fillStyle = i === 3 ? '#3d5a80' : '#2c3542'; c.fillRect(w * 0.02, h * 0.11 + i * h * 0.058, w * (0.08 + R() * 0.08), h * 0.026); }
      const cols = ['#7fd1c7', '#f2c46d', '#e98a8a', '#9db8f2', '#c5a3f0', '#cfd6e0', '#cfd6e0', '#cfd6e0'];
      for (let i = 0; i < 19; i++) {
        const y = h * 0.11 + i * h * 0.044;
        c.fillStyle = '#4a5566'; c.fillRect(w * 0.215, y, w * 0.022, h * 0.02);
        let x = w * 0.26 + ((R() * 4) | 0) * w * 0.026;
        const n = 1 + ((R() * 4) | 0);
        for (let k = 0; k < n && x < w * 0.95; k++) { const ww = w * (0.03 + R() * 0.12); c.fillStyle = cols[(R() * cols.length) | 0]; c.fillRect(x, y, ww, h * 0.02); x += ww + w * 0.012; }
      }
      c.fillStyle = '#137a8a'; c.fillRect(0, h * 0.95, w, h * 0.05);
    } else if (kind === 'sheet') {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#1f7a4c'; c.fillRect(0, 0, w, h * 0.08);
      c.fillStyle = '#eef1f2'; c.fillRect(0, h * 0.08, w, h * 0.08);
      txt(c, '매출 현황.xlsx', w * 0.03, h * 0.058, h * 0.05, '#ffffff');
      const cw = w / 8, rh = h * 0.052, y0 = h * 0.17;
      c.fillStyle = '#e6f4ea'; c.fillRect(0, y0, w, rh);
      for (let r = 0; r < 15; r++) for (let k = 0; k < 8; k++) {
        if (r > 0 && R() < 0.2) continue;
        c.fillStyle = r === 0 ? '#1e4d33' : k === 0 ? '#3c4043' : R() < 0.1 ? '#d93025' : '#5f6368';
        c.fillRect(k * cw + cw * (k === 0 ? 0.1 : 0.9 - 0.5 * R()), y0 + r * rh + rh * 0.35, cw * (k === 0 ? 0.6 : 0.35 + R() * 0.3) * (k === 0 ? 1 : 0.6), rh * 0.3);
      }
      c.strokeStyle = '#dadce0'; c.lineWidth = 1;
      for (let k = 0; k <= 8; k++) { c.beginPath(); c.moveTo(k * cw, y0); c.lineTo(k * cw, h); c.stroke(); }
      for (let r = 0; r <= 16; r++) { c.beginPath(); c.moveTo(0, y0 + r * rh); c.lineTo(w, y0 + r * rh); c.stroke(); }
      c.strokeStyle = '#1a73e8'; c.lineWidth = 3; c.strokeRect(cw * 3, y0 + rh * 5, cw, rh);
    } else if (kind === 'dash') {
      c.fillStyle = '#f2f4f7'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#1d3557'; c.fillRect(0, 0, w * 0.13, h);
      for (let i = 0; i < 6; i++) { c.fillStyle = i === 1 ? '#3cc4bd' : '#46607f'; c.fillRect(w * 0.03, h * 0.12 + i * h * 0.1, w * 0.07, h * 0.04); }
      const kp = [['128', '#137a8a'], ['+18%', '#2a9d50'], ['4.8', '#e76f51']];
      kp.forEach(([s, col], i) => { rr(c, w * (0.16 + i * 0.28), h * 0.06, w * 0.25, h * 0.22, 6, '#ffffff'); txt(c, s, w * (0.19 + i * 0.28), h * 0.22, h * 0.1, col); c.fillStyle = '#c4cad3'; c.fillRect(w * (0.19 + i * 0.28), h * 0.1, w * 0.1, h * 0.025); });
      rr(c, w * 0.16, h * 0.33, w * 0.53, h * 0.6, 6, '#ffffff');
      for (let i = 0; i < 9; i++) { const bh = h * (0.12 + R() * 0.32); c.fillStyle = i === 6 ? '#e76f51' : '#2a9d8f'; c.fillRect(w * (0.19 + i * 0.054), h * 0.88 - bh, w * 0.034, bh); }
      rr(c, w * 0.72, h * 0.33, w * 0.25, h * 0.6, 6, '#ffffff');
      c.strokeStyle = '#f4a261'; c.lineWidth = 3; c.beginPath();
      for (let i = 0; i < 7; i++) { const x = w * (0.74 + i * 0.035), y = h * (0.8 - i * 0.05 - R() * 0.06); i ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.stroke();
    } else if (kind === 'chat') {
      c.fillStyle = '#b9cad8'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#a3b6c6'; c.fillRect(0, 0, w, h * 0.1);
      txt(c, '기획팀 단톡방', w * 0.04, h * 0.072, h * 0.055, '#26323d');
      const msgs = [['회의 몇 시예요?', 0], ['3시요! 회의실 A', 1], ['점심 뭐 먹어요?', 0], ['제육볶음 ㅎㅎ', 1], ['금요일 회식 고기!!', 0]];
      msgs.forEach(([s, me], i) => {
        const y = h * (0.15 + i * 0.165), bw = w * 0.07 + s.length * h * 0.045;
        const x = me ? w * 0.95 - bw : w * 0.14;
        if (!me) { c.fillStyle = '#7d93a8'; c.beginPath(); c.arc(w * 0.08, y + h * 0.05, h * 0.04, 0, PI * 2); c.fill(); }
        rr(c, x, y, bw, h * 0.11, 10, me ? '#fee500' : '#ffffff');
        txt(c, s, x + w * 0.03, y + h * 0.078, h * 0.055, '#26292d');
      });
      c.fillStyle = '#ffffff'; c.fillRect(0, h * 0.91, w, h * 0.09);
    } else if (kind === 'mail') {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#137a8a'; c.fillRect(0, 0, w, h * 0.09);
      txt(c, '받은 메일함', w * 0.03, h * 0.065, h * 0.05, '#ffffff');
      for (let i = 0; i < 8; i++) {
        const y = h * (0.12 + i * 0.105);
        if (i === 1) { c.fillStyle = '#e1f3f2'; c.fillRect(0, y - h * 0.01, w * 0.36, h * 0.1); }
        c.fillStyle = '#2b2f33'; c.fillRect(w * 0.03, y + h * 0.01, w * (0.12 + R() * 0.1), h * 0.025);
        c.fillStyle = '#9aa1a8'; c.fillRect(w * 0.03, y + h * 0.05, w * (0.2 + R() * 0.1), h * 0.02);
      }
      c.fillStyle = '#e4e7ea'; c.fillRect(w * 0.37, h * 0.09, 2, h);
      txt(c, '11월 출장 일정 안내', w * 0.41, h * 0.2, h * 0.06, '#1f2326');
      lines(c, w * 0.41, h * 0.28, w * 0.52, 9, h * 0.065, '#9aa1a8', R, h * 0.02);
    } else {
      c.fillStyle = '#2b2b2d'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#38383b'; c.fillRect(0, 0, w * 0.17, h); c.fillRect(w * 0.83, 0, w * 0.17, h);
      for (let i = 0; i < 10; i++) { c.fillStyle = i === 2 ? '#3d6fd8' : '#4a4a4f'; c.fillRect(w * 0.015, h * 0.06 + i * h * 0.08, w * 0.14, h * 0.05); }
      c.fillStyle = '#f4f1ea'; c.fillRect(w * 0.22, h * 0.1, w * 0.56, h * 0.8);
      c.fillStyle = '#ffb34d'; c.beginPath(); c.arc(w * 0.4, h * 0.42, h * 0.16, 0, PI * 2); c.fill();
      c.fillStyle = '#2a9d8f'; c.fillRect(w * 0.47, h * 0.36, w * 0.24, h * 0.32);
      txt(c, 'SEONN', w * 0.5, h * 0.82, h * 0.1, '#1d3557', 'center');
      for (let i = 0; i < 8; i++) { c.fillStyle = '#56565c'; c.fillRect(w * 0.85, h * 0.08 + i * h * 0.1, w * 0.12, h * 0.035); }
    }
  };
}

/* ============================================================== kit: plants */
/** Folded leaf pointing +Z from the origin, drooping towards -Y. ~16 triangles. */
export function leafGeo(len, wid, droop = 0.35, fold = 0.3, segs = 4) {
  const rows = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = i === segs ? 0 : wid * Math.pow(Math.sin(PI * (0.14 + t * 0.86)), 0.75);
    const z = len * t, y = -droop * len * t * t;
    rows.push([[-w, y, z], [0, y + fold * w, z], [w, y, z]]);
  }
  const p = [];
  const tri = (a, b, c) => p.push(...a, ...b, ...c);
  for (let i = 0; i < segs; i++) {
    const [L0, M0, R0] = rows[i], [L1, M1, R1] = rows[i + 1];
    tri(L0, M0, L1); tri(M0, M1, L1); tri(M0, R0, M1); tri(R0, R1, M1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return prep(g);
}
const GREENS = [0x3c6a2e, 0x4a7a33, 0x5a8a3a, 0x35602b, 0x6a9944, 0x2f5a2a];
/**
 * Potted plant. kind: 'fig' (fiddle-leaf tree), 'snake' (upright swords), 'bush' (pothos mound),
 * 'palm' (arching fronds), 'herb' (tiny desk plant). pot: 'white' | 'stone' | 'terracotta' | 'charcoal' | hex.
 */
export function pottedPlant(parent, x, y, z, o = {}) {
  const { kind = 'fig', h = 1.4, seed = 1, pot = 'white', potR = 0.2, potH = 0.38 } = o;
  const R = rng(seed * 7919 + 13);
  const g = group(parent, x, y, z, R() * PI * 2);
  const prof = [[0, 0], [potR * 0.8, 0], [potR * 0.86, 0.015], [potR, potH * 0.97], [potR * 0.98, potH], [potR * 0.9, potH], [potR * 0.88, potH * 0.9], [0, potH * 0.9]];
  const pg = lathe(prof, potR > 0.1 ? 28 : 16);
  if (pot === 'white') put(g, pg, mat('ceramic'));
  else if (pot === 'stone') put(g, pg, mat('concrete'));
  else V(g, pg, pot === 'terracotta' ? 0xb4623e : pot === 'charcoal' ? 0x3a3b3d : pot, 0, 0, 0, 0, 0, 0, vcGloss());
  V(g, CY(potR * 0.89, potR * 0.89, 0.012, potR > 0.1 ? 20 : 12), 0x3a2a1e, 0, potH * 0.87, 0);
  const top = potH * 0.88;
  const leaf = (len, wid, droop, fold, elev, az, px, py, pz, col) => {
    const l = leafGeo(len, wid, droop, fold);
    l.rotateX(-elev); l.rotateY(az); l.translate(px, py, pz);
    put(g, tint(l, col), vcLeaf());
  };
  const green = () => GREENS[(R() * GREENS.length) | 0];
  if (kind === 'fig') {
    const th = h * 0.78;
    V(g, CY(0.016, 0.028, th, 8), 0x6b5137, 0, top + th / 2, 0);
    const n = Math.round(30 * h);
    for (let i = 0; i < n; i++) {
      const t = 0.3 + 0.7 * Math.pow(i / n, 0.8);
      const az = i * 2.39996 + R() * 0.4;
      const sc = 0.75 + 0.5 * (1 - Math.abs(t - 0.7));
      leaf((0.2 + R() * 0.08) * sc * Math.max(0.8, h * 0.7), (0.1 + R() * 0.035) * sc * Math.max(0.8, h * 0.7), 0.3, 0.18, -0.15 + R() * 0.9, az,
        Math.sin(az) * 0.02, top + th * t + 0.05, Math.cos(az) * 0.02, green());
    }
  } else if (kind === 'snake') {
    const n = Math.round(10 + h * 4);
    for (let i = 0; i < n; i++) {
      const az = R() * PI * 2, r0 = R() * potR * 0.6;
      leaf(h * (0.55 + R() * 0.45), 0.035 + R() * 0.02, 0.04, 0.12, 1.2 + R() * 0.32, az, Math.sin(az) * r0, top, Math.cos(az) * r0, R() < 0.5 ? 0x2f5634 : R() < 0.5 ? 0x46703a : 0x5f8443);
    }
  } else if (kind === 'palm') {
    const n = 14;
    for (let i = 0; i < n; i++) {
      const az = i * 2.39996, r0 = R() * potR * 0.4;
      for (let k = 0; k < 2; k++) leaf(h * (0.5 + R() * 0.4), 0.05 + R() * 0.02, 0.55, 0.15, 0.9 + R() * 0.45, az + k * 0.18, Math.sin(az) * r0, top, Math.cos(az) * r0, green());
    }
  } else if (kind === 'herb') {
    const n = 9;
    for (let i = 0; i < n; i++) {
      const az = i * 2.39996;
      leaf(0.05 + R() * 0.03, 0.022 + R() * 0.01, 0.3, 0.25, 0.3 + R() * 0.8, az, Math.sin(az) * 0.01, top + 0.005, Math.cos(az) * 0.01, green());
    }
  } else {
    const n = Math.round(24 * Math.max(0.6, h));
    for (let i = 0; i < n; i++) {
      const az = i * 2.39996 + R() * 0.3, t = i / n;
      leaf((0.12 + R() * 0.06) * Math.max(0.7, h), (0.06 + R() * 0.025) * Math.max(0.7, h), 0.7, 0.22, 0.2 + (1 - t) * 0.9, az,
        Math.sin(az) * potR * 0.3, top + h * 0.25 * (1 - t), Math.cos(az) * potR * 0.3, green());
    }
  }
  return g;
}

/** Dense crown of small ficus leaves around (x, y, z). */
export function leafyCrown(g, x, y, z, r, n, R) {
  const cols = [0x3c6a2e, 0x4a7a33, 0x5a8a3a, 0x35602b, 0x6a9944];
  for (let i = 0; i < n; i++) {
    const u = R() * 2 - 1, th = R() * PI * 2, s = Math.sqrt(1 - u * u);
    const dx = s * Math.cos(th), dy = u * 0.8 + 0.1, dz = s * Math.sin(th);
    const d = r * (0.55 + R() * 0.45);
    const l = leafGeo(0.16 + R() * 0.06, 0.07 + R() * 0.02, 0.35, 0.2);
    l.rotateX(-Math.max(-0.6, Math.min(1.0, dy)) + 0.2).rotateY(Math.atan2(dx, dz)).translate(x + dx * d, y + dy * d, z + dz * d);
    put(g, tint(l, cols[(R() * cols.length) | 0]), vcLeaf());
  }
}
/** Outdoor clipped shrub (box/azalea style) with optional flowers. */
export function shrub(parent, x, y, z, r = 0.5, seed = 1, flowers = 0) {
  const R = rng(seed * 31 + 7);
  const s = seed * 1.7;
  const geo = displace(new THREE.IcosahedronGeometry(r, 3), (px, py, pz) => (Math.sin(px * 9 + s) * Math.cos(pz * 8 - s) * 0.07 + Math.sin(py * 11 + s) * 0.04 + (R() - 0.5) * 0.03) * r * 2);
  geo.scale(1, 0.72, 1);
  put(parent, geo, mat('leaves'), x, y + r * 0.62, z);
  for (let i = 0; i < flowers; i++) {
    const a = R() * PI * 2, e = R() * 1.1;
    const fx = Math.cos(a) * Math.cos(e) * r * 1.0, fz = Math.sin(a) * Math.cos(e) * r * 1.0, fy = Math.sin(e) * r * 0.72;
    V(parent, SP(0.035, 6, 4), R() < 0.5 ? 0xf2a7c0 : 0xfff3f0, x + fx, y + r * 0.62 + fy, z + fz);
  }
}

/* ============================================================== kit: desk clutter */
export function mug(p, x, y, z, col, ry = 0, coffee = true) {
  const g = group(p, x, y, z, ry);
  V(g, lathe([[0, 0], [0.034, 0], [0.039, 0.006], [0.04, 0.09], [0.036, 0.094], [0.034, 0.012], [0, 0.012]], 16), col, 0, 0, 0, 0, 0, 0, vcGloss());
  V(g, torus(0.024, 0.006, 6, 10, PI), col, 0.04, 0.048, 0, 0, 0, -PI / 2, vcGloss());
  if (coffee) V(g, CY(0.034, 0.034, 0.003, 14), 0x3b2416, 0, 0.074, 0, 0, 0, 0, vcGloss());
  return g;
}
export function penCup(p, x, y, z, col, R) {
  const g = group(p, x, y, z, R() * PI);
  V(g, lathe([[0, 0], [0.035, 0], [0.036, 0.1], [0.032, 0.1], [0.031, 0.008], [0, 0.008]], 14), col);
  const pens = [0x1f4fa8, 0x222222, 0xc0392b, 0xf1c40f, 0x2a9d8f];
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7 + R(), lean = 0.12 + R() * 0.12;
    V(g, CY(0.004, 0.004, 0.15, 6), pens[(i + ((R() * 5) | 0)) % 5], Math.sin(a) * 0.012, 0.09, Math.cos(a) * 0.012, Math.cos(a) * lean, 0, -Math.sin(a) * lean);
  }
  return g;
}
export function paperStack(p, x, y, z, ry, n, A, docKey) {
  const g = group(p, x, y, z, ry);
  const R = rng(n * 17 + (docKey ? docKey.length : 1));
  for (let i = 0; i < n; i++) V(g, box(0.21, 0.0025, 0.297), i % 3 === 2 ? 0xf3efe3 : 0xfbfbf8, (R() - 0.5) * 0.012, 0.0013 + i * 0.0026, (R() - 0.5) * 0.012, 0, (R() - 0.5) * 0.08, 0);
  if (A && docKey) D(g, A.quad(docKey, 0.205, 0.29).rotateX(-PI / 2), A.mat, 0, n * 0.0026 + 0.0006, 0);
  return g;
}
export function photoFrame(p, x, y, z, ry, A, key, col = 0x2a2523) {
  const g = group(p, x, y, z, ry);
  const f = group(g, 0, 0, 0, 0);
  f.rotation.x = -0.18;
  V(f, RB(0.15, 0.115, 0.014, 0.004, 1), col, 0, 0.0575, 0);
  D(f, A.quad(key, 0.125, 0.09), A.mat, 0, 0.0575, 0.0075);
  V(g, box(0.02, 0.1, 0.006), col, 0, 0.045, -0.035, 0.45, 0, 0);
  return g;
}
export function deskPlant(p, x, y, z, seed, pot = 0xf1ece4) {
  return pottedPlant(p, x, y, z, { kind: seed % 2 ? 'herb' : 'bush', h: 0.22, potR: 0.045, potH: 0.08, pot, seed });
}
export function binders(p, x, y, z, ry, n, R) {
  const g = group(p, x, y, z, ry);
  const cols = [0x1d3557, 0x2a9d8f, 0xe9c46a, 0xc0504d, 0x6c757d, 0xf1f1ee];
  for (let i = 0; i < n; i++) {
    const c = cols[(R() * cols.length) | 0];
    V(g, RB(0.055, 0.3, 0.25, 0.006, 1), c, i * 0.058, 0.15, 0);
    V(g, box(0.004, 0.06, 0.03), 0xfafafa, i * 0.058, 0.2, 0.126);
  }
  return g;
}
export function bottle(p, x, y, z, col) {
  const g = group(p, x, y, z, 0);
  V(g, lathe([[0, 0], [0.032, 0], [0.034, 0.01], [0.034, 0.17], [0.026, 0.2], [0.016, 0.21], [0.0, 0.21]], 16), col, 0, 0, 0, 0, 0, 0, vcGloss());
  V(g, CY(0.017, 0.017, 0.03, 12), 0x2b2b2b, 0, 0.222, 0);
  return g;
}
export function notebook(p, x, y, z, ry, col) {
  const g = group(p, x, y, z, ry);
  V(g, RB(0.15, 0.014, 0.21, 0.003, 1), col, 0, 0.007, 0);
  V(g, box(0.144, 0.01, 0.205), 0xf6f3ea, 0.004, 0.007, 0);
  V(g, CY(0.004, 0.004, 0.14, 6), 0x1a1a1a, 0.1, 0.004, 0, PI / 2, 0.3, 0);
  return g;
}
export function headphones(p, x, y, z, ry) {
  const g = group(p, x, y, z, ry);
  V(g, torus(0.08, 0.009, 6, 18, PI), 0x2b2d31, 0, 0.012, 0, -PI / 2 + 0.1, 0, 0);
  for (const s of [-1, 1]) V(g, CY(0.04, 0.04, 0.03, 16), 0x2b2d31, s * 0.08, 0.02, 0.0, 0, 0, PI / 2 + s * 0.2);
  return g;
}
export function stickyNote(p, A, key, x, y, z, ry, rz = 0, s = 0.06) { return D(p, A.quad(key, s, s), A.mat, x, y, z, 0, ry, rz); }

/* ============================================================== kit: office furniture */
export const blackPl = () => paint(0x26272b, 0.42);
export const whitePl = () => paint(0xecebe8, 0.38);
export const cabinetPl = () => paint(0xdcdad4, 0.42, 0.2);
export const frameWhite = () => paint(0xeceae5, 0.4, 0.2);
export const metalGray = () => paint(0x8a9096, 0.45, 0.5);
const chairMesh = () => cached('chairMesh', () => textured('fabric', { color: 0x3a4049, weave: 260, seed: 2 }, 0.3, { normal: 0.9 }));
/** Task chair; the sitter faces +Z, seat top 0.51 above y. jacket: hex colour of a coat hung on the back. */
export function officeChair(parent, x, y, z, ry = 0, o = {}) {
  const g = group(parent, x, y, z, ry);
  const fab = o.fabric ?? chairMesh(), blk = blackPl(), crm = mat('chrome');
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2 + 0.31;
    put(g, box(0.045, 0.035, 0.3), blk, Math.sin(a) * 0.15, 0.075, Math.cos(a) * 0.15, 0, a, 0);
    put(g, CY(0.026, 0.026, 0.022, 10), blk, Math.sin(a) * 0.29, 0.026, Math.cos(a) * 0.29, 0, a, PI / 2);
  }
  put(g, CY(0.045, 0.055, 0.06, 12), blk, 0, 0.08, 0);
  put(g, CY(0.03, 0.034, 0.14, 10), blk, 0, 0.17, 0);
  put(g, CY(0.02, 0.02, 0.16, 10), crm, 0, 0.3, 0);
  put(g, RB(0.22, 0.05, 0.24, 0.015, 1), blk, 0, 0.39, 0);
  put(g, RB(0.5, 0.08, 0.48, 0.035, 2), fab, 0, 0.46, 0.005);
  put(g, RB(0.07, 0.36, 0.035, 0.012, 1), blk, 0, 0.56, -0.27);
  const b = group(g, 0, 0.87, -0.285, 0);
  b.rotation.x = -0.1;
  put(b, RB(0.47, 0.6, 0.04, 0.03, 1), blk, 0, 0, 0);
  put(b, RB(0.43, 0.56, 0.03, 0.03, 2), fab, 0, 0, 0.014);
  for (const s of [-1, 1]) {
    put(g, box(0.05, 0.025, 0.06), blk, s * 0.24, 0.44, -0.04);
    put(g, RB(0.035, 0.2, 0.05, 0.01, 1), blk, s * 0.27, 0.55, -0.04);
    put(g, RB(0.07, 0.03, 0.25, 0.012, 1), blk, s * 0.27, 0.66, -0.02);
  }
  if (o.jacket) {
    // a coat hung over the backrest: shoulders on top, body hanging behind, sleeves at the sides, lapels in front
    const m = vcSoft(), c = o.jacket, dk = new THREE.Color(c).multiplyScalar(0.8).getHex();
    V(b, capsule(0.04, 0.38, 4, 10), c, 0, 0.3, -0.01, 0, 0, PI / 2, m);
    V(b, RB(0.44, 0.3, 0.03, 0.012, 2), c, 0, 0.16, -0.045, 0.06, 0, 0, m);
    V(b, RB(0.5, 0.42, 0.03, 0.012, 2), c, 0, -0.17, -0.075, 0.1, 0, 0, m);
    V(b, box(0.03, 0.42, 0.006), dk, 0, -0.17, -0.093, 0.1, 0, 0);
    for (const sd of [-1, 1]) {
      V(b, RB(0.14, 0.2, 0.022, 0.008, 1), dk, sd * 0.1, 0.2, 0.034, -0.05, 0, sd * 0.35, m);
      V(b, capsule(0.038, 0.4, 4, 10), c, sd * 0.235, -0.1, -0.06, 0.08, 0, sd * 0.06, m);
    }
  }
  return g;
}

/** Monitor whose face is centred `ch` above y, facing +Z. screenKey: glow atlas item. */
export function monitor(parent, x, y, z, ry, G, screenKey, { w = 0.6, h = 0.34, ch = 0.32 } = {}) {
  const g = group(parent, x, y, z, ry);
  const blk = blackPl();
  put(g, RB(w + 0.02, h + 0.024, 0.026, 0.006, 1), blk, 0, ch, 0);
  put(g, RB(w * 0.5, h * 0.55, 0.035, 0.012, 1), blk, 0, ch - 0.02, -0.028);
  put(g, RB(0.05, ch - 0.02, 0.022, 0.008, 1), blk, 0, (ch - 0.02) / 2 + 0.01, -0.05);
  put(g, RB(0.25, 0.012, 0.18, 0.005, 1), blk, 0, 0.006, -0.03);
  D(g, G.quad(screenKey, w, h), G.mat, 0, ch, 0.0135);
  return g;
}
export function keyboard(parent, x, y, z, ry, A) {
  const g = group(parent, x, y, z, ry);
  put(g, RB(0.44, 0.018, 0.14, 0.006, 1), whitePl(), 0, 0.009, 0);
  D(g, A.quad('kbd', 0.425, 0.125).rotateX(-PI / 2), A.mat, 0, 0.0185, 0);
  V(g, RB(0.24, 0.003, 0.2, 0.002, 1), 0x2e3238, 0.34, 0.0015, 0.01, 0, 0, 0, vcSoft());
  V(g, sphere(0.03, 12, 8).scale(1, 0.5, 1.6), 0xeeeeec, 0.34, 0.013, 0.02, 0, 0, 0, vcGloss());
  return g;
}

/**
 * Desk 1.6 x 0.8, top surface 0.74 above y. The sitter is on the +Z side looking at -Z.
 * o: { screen, mine, seed, A (print atlas), G (glow atlas), clutter, top (material) }
 */
export function workDesk(parent, x, y, z, ry, o) {
  const { A, G, seed = 1, mine = false } = o;
  const R = rng(seed * 101 + 9);
  const g = group(parent, x, y, z, ry);
  const frame = frameWhite();
  put(g, RB(1.6, 0.03, 0.8, 0.01, 2), o.top ?? mat('birch'), 0, 0.725, 0);
  for (const s of [-1, 1]) {
    put(g, RB(0.06, 0.03, 0.72, 0.01, 1), frame, s * 0.74, 0.015, 0);
    put(g, RB(0.06, 0.68, 0.05, 0.01, 1), frame, s * 0.74, 0.37, -0.05);
    put(g, RB(0.05, 0.035, 0.7, 0.01, 1), frame, s * 0.74, 0.69, 0);
  }
  put(g, RB(1.44, 0.05, 0.03, 0.01, 1), frame, 0, 0.66, -0.3);
  // drawer pedestal
  put(g, RB(0.4, 0.56, 0.5, 0.012, 2), cabinetPl(), 0.5, 0.31, -0.07);
  for (const hy of [0.53, 0.38, 0.2]) put(g, RB(0.14, 0.012, 0.014, 0.004, 1), mat('steel'), 0.5, hy, 0.186);
  for (const gy of [0.455, 0.3]) V(g, box(0.39, 0.005, 0.004), 0x9b9890, 0.5, gy, 0.181);
  // monitor + keyboard
  if (mine) monitor(g, 0, 0.74, -0.15, 0, G, o.screen ?? 'scrMine', { w: 0.7, h: 0.4, ch: 0.39 });
  else monitor(g, 0, 0.74, -0.2, 0, G, o.screen ?? 'scr0', { w: 0.6, h: 0.34, ch: 0.33 });
  keyboard(g, -0.03, 0.74, 0.14, 0, A);
  if (o.clutter === false) return g;
  // clutter slots (top surface y = 0.74)
  const T = 0.74;
  const mugCols = [0xffffff, 0x2f6f73, 0xf2c14e, 0xd9534f, 0x1d3557, 0xf4a6b8, 0x7c9a5e];
  if (mine || R() < 0.85) mug(g, 0.62, T, 0.1, mugCols[(R() * mugCols.length) | 0], R() * PI);
  const lf = mine ? 0 : R();
  if (lf < 0.45) paperStack(g, -0.5, T, 0.1, (R() - 0.5) * 0.4, 3 + ((R() * 6) | 0), A, 'doc' + ((R() * 3) | 0));
  else if (lf < 0.7) notebook(g, -0.48, T, 0.12, (R() - 0.5) * 0.5, [0x1d3557, 0xc0504d, 0x2a9d8f, 0x3a3a3a][(R() * 4) | 0]);
  else if (lf < 0.85) headphones(g, -0.48, T, 0.12, R() * PI);
  const lb = mine ? 0.1 : R();
  if (lb < 0.4) photoFrame(g, -0.55, T, -0.24, 0.25, A, 'photo' + ((R() * 3) | 0));
  else if (lb < 0.65) binders(g, -0.74, T, -0.25, 0, 3 + ((R() * 3) | 0), R);
  if (mine || R() < 0.55) penCup(g, -0.3, T, -0.28, [0x2b2b2b, 0xe8e6e1, 0x2f6f73][(R() * 3) | 0], R);
  const rb = mine ? 0 : R();
  if (rb < 0.45) deskPlant(g, 0.62, T, -0.25, seed, [0xf1ece4, 0xb4623e, 0x3a3b3d, 0x9fc3c0][(R() * 4) | 0]);
  else if (rb < 0.75) bottle(g, 0.6, T, -0.22, [0x6fb3d6, 0x2b2b2b, 0xe9e5dd, 0xd96c75][(R() * 4) | 0]);
  if (mine) notebook(g, -0.5, T, 0.1, -0.2, 0x2a9d8f);
  if (mine || R() < 0.5) {
    const k = 'sticky' + ((R() * 3) | 0);
    const mw = mine ? 0.36 : 0.31, my = mine ? 0.74 + 0.39 + 0.2 : 0.74 + 0.33 + 0.17;
    stickyNote(g, A, k, -mw + 0.03, my - 0.02, mine ? -0.135 : -0.185, 0, 0.08, 0.055);
  }
  return g;
}

/** Fabric privacy screen along X (centre x, z), top 1.19 above y. */
export function deskScreen(parent, x, y, z, len, fabric) {
  put(parent, RB(len, 0.45, 0.034, 0.01, 1), fabric, x, y + 0.74 + 0.225, z);
  put(parent, RB(len + 0.01, 0.016, 0.044, 0.006, 1), paint(0xc5cad0, 0.3, 0.85), x, y + 1.198, z);
}

/** Bookshelf w x h x d, open towards +Z; books are vertex coloured. */
export function bookshelf(parent, x, y, z, ry, o = {}) {
  const { w = 1.8, h = 2.0, d = 0.38, seed = 3, wood = mat('walnut'), shelves = 5 } = o;
  const R = rng(seed * 13 + 5);
  const g = group(parent, x, y, z, ry);
  put(g, RB(0.03, h, d, 0.006, 1), wood, -w / 2 + 0.015, h / 2, 0);
  put(g, RB(0.03, h, d, 0.006, 1), wood, w / 2 - 0.015, h / 2, 0);
  put(g, RB(w, 0.03, d, 0.006, 1), wood, 0, h - 0.015, 0);
  put(g, RB(w - 0.06, 0.08, d - 0.02, 0.006, 1), wood, 0, 0.04, -0.005);
  V(g, box(w - 0.06, h - 0.06, 0.012), 0xe9e4da, 0, h / 2, -d / 2 + 0.008);
  const cols = [0x1d3557, 0x9b2c2c, 0x2a6f6a, 0xe2b04a, 0xe9e2d0, 0x3a3a3a, 0x7a5c3e, 0x5b7fa6, 0xc8553d, 0x6c8f5a, 0xf2efe8, 0x8a6aa8];
  const sh = (h - 0.11) / shelves;
  for (let s = 0; s < shelves; s++) {
    const sy = 0.08 + s * sh;
    if (s > 0) put(g, RB(w - 0.06, 0.025, d - 0.03, 0.005, 1), wood, 0, sy, 0);
    let cx = -w / 2 + 0.05;
    const end = w / 2 - 0.05;
    while (cx < end - 0.05) {
      const r = R();
      if (r < 0.62) {
        const n = 4 + ((R() * 10) | 0);
        for (let i = 0; i < n && cx < end - 0.04; i++) {
          const t = 0.022 + R() * 0.03, bh = Math.min(sh - 0.04, 0.2 + R() * 0.1), bd = 0.16 + R() * 0.07;
          V(g, box(t, bh, bd), cols[(R() * cols.length) | 0], cx + t / 2, sy + 0.0125 + bh / 2, -d / 2 + 0.02 + bd / 2);
          cx += t + 0.002;
        }
        if (R() < 0.3 && cx < end - 0.2) { const bh = 0.22; V(g, box(0.03, bh, 0.2), cols[(R() * cols.length) | 0], cx + 0.08, sy + 0.0125 + bh * 0.48, -0.02, 0, 0, -0.38); cx += 0.17; }
        cx += 0.02 + R() * 0.05;
      } else if (r < 0.75) {
        const bw = 0.26 + R() * 0.08;
        V(g, RB(bw, Math.min(0.2, sh - 0.06), 0.28, 0.008, 1), [0xe8dcc6, 0x8fa3b1, 0xf1f1ee, 0xd5c2a5][(R() * 4) | 0], cx + bw / 2, sy + 0.0125 + Math.min(0.2, sh - 0.06) / 2, -0.01);
        cx += bw + 0.04;
      } else if (r < 0.86 && cx < end - 0.2) {
        const n = 3 + ((R() * 4) | 0), sx = cx + 0.12;
        for (let i = 0; i < n; i++) { const bt = 0.025 + R() * 0.03; V(g, box(0.22, bt, 0.16 + R() * 0.05), cols[(R() * cols.length) | 0], sx, sy + 0.0125 + i * bt + bt / 2 + i * 0.001, -0.02, 0, (R() - 0.5) * 0.2, 0); }
        cx += 0.27;
      } else if (r < 0.94 && cx < end - 0.2) {
        pottedPlant(g, cx + 0.09, sy + 0.0125, -0.01, { kind: R() < 0.5 ? 'bush' : 'herb', h: 0.25, potR: 0.06, potH: 0.1, pot: [0xf1ece4, 0xb4623e, 0x3a3b3d][(R() * 3) | 0], seed: (R() * 999) | 0 });
        cx += 0.2;
      } else if (cx < end - 0.18) {
        const tg = group(g, cx + 0.08, sy + 0.0125, -0.02, 0);
        put(tg, RB(0.1, 0.04, 0.08, 0.008, 1), mat('walnut'), 0, 0.02, 0);
        V(tg, CY(0.012, 0.018, 0.08, 10), 0xd8b25a, 0, 0.08, 0, 0, 0, 0, vcGloss());
        V(tg, lathe([[0.0, 0], [0.02, 0], [0.05, 0.06], [0.048, 0.065], [0.0, 0.02]], 14), 0xd8b25a, 0, 0.12, 0, 0, 0, 0, vcGloss());
        cx += 0.18;
      } else cx += 0.1;
    }
  }
  return g;
}

/** Sofa facing +Z, width w. */
export function sofa(parent, x, y, z, ry, o = {}) {
  const { w = 2.2, fabric = mat('fabricBeige'), legs = mat('walnut'), pillows = [0x2f6f73, 0xe0b25a, 0xf1ece4] } = o;
  const g = group(parent, x, y, z, ry);
  put(g, RB(w, 0.24, 0.9, 0.04, 2), fabric, 0, 0.24, 0);
  const n = w > 1.8 ? 3 : 2, cw = (w - 0.36) / n;
  for (let i = 0; i < n; i++) {
    const cx = -w / 2 + 0.18 + cw * (i + 0.5);
    // piped seat cushions with a dip, plump backs, piped arms, velvet throw pillows (soft.js)
    put(g, cushion(cw - 0.012, 0.16, 0.66, 0.06, 0.02, 0.014, i, 0, 0.006), fabric, cx, 0.43, 0.08);
    const b = group(g, cx, 0.66, -0.27, 0); b.rotation.x = -0.18;
    put(b, cushionZ(cw - 0.02, 0.44, 0.2, 0.08, 0.032, i + 4, 0, 0.006), fabric, 0, 0, 0);
  }
  put(g, RB(w, 0.62, 0.18, 0.05, 2), fabric, 0, 0.55, -0.36);
  for (const s of [-1, 1]) put(g, cushionX(0.18, 0.62, 0.9, 0.06, 0.012, 3 + s, 0.005), fabric, s * (w / 2 - 0.09), 0.42, 0);
  for (const s of [-1, 1]) for (const t of [-1, 1]) put(g, CY(0.02, 0.015, 0.12, 10), legs, s * (w / 2 - 0.12), 0.06, t * 0.35);
  pillows.slice(0, n === 3 ? 3 : 2).forEach((c, i) => {
    const px = (i - (n === 3 ? 1 : 0.5)) * (w * 0.33);
    put(g, painted(throwPillow(0.44, 0.44, 0.16, i), c), velvetMat(), px, 0.72, -0.13, -0.25, (i - 1) * 0.15, (i - 1) * 0.1);
  });
  return g;
}

/** Wall clock facing +Z (atlas 'clock'). */
export function wallClock(parent, x, y, z, ry, A, r = 0.17) {
  const g = group(parent, x, y, z, ry);
  put(g, CY(r, r, 0.04, 32), blackPl(), 0, 0, 0.02, PI / 2, 0, 0);
  D(g, A.quad('clock', r * 1.84, r * 1.84), A.mat, 0, 0, 0.0415);
  return g;
}

/** Hinged-looking static door (closed) in a wall face at z (faces +Z), with a sign. */
export function staticDoor(parent, x, y, z, ry, o = {}) {
  const { w = 0.95, h = 2.15, leaf = mat('whiteWood'), frame = mat('walnut'), A = null, sign = null } = o;
  const g = group(parent, x, y, z, ry);
  put(g, RB(w + 0.14, 0.07, 0.06, 0.01, 1), frame, 0, h + 0.035, 0.02);
  for (const s of [-1, 1]) put(g, RB(0.07, h, 0.06, 0.01, 1), frame, s * (w / 2 + 0.035), h / 2, 0.02);
  put(g, RB(w, h, 0.045, 0.006, 1), leaf, 0, h / 2, 0.012);
  put(g, RB(0.03, 0.03, 0.06, 0.01, 1), mat('steel'), w / 2 - 0.1, 1.0, 0.06);
  put(g, RB(0.14, 0.022, 0.022, 0.008, 1), mat('steel'), w / 2 - 0.15, 1.0, 0.09);
  if (A && sign) D(g, A.quad(sign, 0.2, 0.2), A.mat, 0, 1.55, 0.037);
  return g;
}

/** Pendant lamp hanging from ceiling y `cy`, shade bottom at `by`. Returns lamp anchor pos. */
export function pendant(parent, x, by, z, cy, o = {}) {
  const { r = 0.2, shade = 0x26272b, gl = mat('lampGlow') } = o;
  put(parent, CY(0.004, 0.004, cy - by - 0.2, 6), blackPl(), x, (cy + by + 0.2) / 2, z);
  put(parent, CY(0.04, 0.04, 0.02, 12), blackPl(), x, cy - 0.01, z);
  V(parent, lathe([[0.012, 0.22], [0.03, 0.21], [r * 0.6, 0.15], [r * 0.95, 0.03], [r, 0.0], [r * 0.97, 0.0], [r * 0.9, 0.025], [r * 0.56, 0.14], [0.012, 0.2]], 28), shade, x, by, z, 0, 0, 0, vcGloss());
  D(parent, CY(r * 0.88, r * 0.88, 0.006, 24), gl, x, by + 0.03, z);
  return [x, by - 0.05, z];
}

/** Long meeting table along X with chairs, bottles, notepads. Returns {chairs: [{pos, yaw}]} (sitter spots). */
export function meetingTable(parent, x, y, z, o) {
  const { len = 4.2, wid = 1.3, A, G, top = mat('walnut'), chairs = 4, seed = 5, fabric, laptops = 1, client = false } = o;
  const R = rng(seed);
  const g = group(parent, x, y, z, 0);
  put(g, RB(len, 0.045, wid, 0.015, 2), top, 0, 0.73, 0);
  for (const s of [-1, 1]) {
    put(g, RB(0.09, 0.7, wid * 0.62, 0.02, 1), mat('darkSteel'), s * (len / 2 - 0.45), 0.36, 0);
    put(g, RB(0.12, 0.02, wid * 0.7, 0.008, 1), mat('darkSteel'), s * (len / 2 - 0.45), 0.01, 0);
  }
  put(g, RB(0.5, 0.012, 0.16, 0.004, 1), mat('darkSteel'), 0, 0.756, 0);
  V(g, CY(0.09, 0.1, 0.03, 24), 0x2b2d31, -0.3 + len * 0.1, 0.767, 0);
  const spots = [];
  const step = (len - 0.6) / chairs;
  for (const side of [1, -1]) for (let i = 0; i < chairs; i++) {
    const cx = -len / 2 + 0.3 + step * (i + 0.5);
    const cz = side * (wid / 2 + 0.3);
    officeChair(g, cx + (R() - 0.5) * 0.08, 0, cz, side > 0 ? PI + (R() - 0.5) * 0.15 : (R() - 0.5) * 0.15, { fabric });
    spots.push({ pos: [x + cx, y, z + cz], yaw: side > 0 ? 0 : PI });
    const tz = side * (wid / 2 - 0.25);
    // notepad + pen, water bottle
    const np = group(g, cx - 0.08, 0.7525, tz, side > 0 ? (R() - 0.5) * 0.3 : PI + (R() - 0.5) * 0.3);
    V(np, RB(0.15, 0.008, 0.21, 0.003, 1), 0xfbf9f2, 0, 0.004, 0);
    V(np, box(0.15, 0.004, 0.03), 0x2a3a5a, 0, 0.007, -0.09);
    if (A) D(np, A.quad('doc' + (i % 3), 0.13, 0.17).rotateX(-PI / 2), A.mat, 0, 0.0087, 0.012);
    V(np, CY(0.004, 0.004, 0.14, 6), 0x1a1a1a, 0.095, 0.006, 0, PI / 2, 0.3 * side, 0);
    waterBottle(g, cx + 0.16, 0.7525, tz - side * 0.12);
  }
  for (let i = 0; i < laptops; i++) laptop(g, -len / 2 + 0.3 + step * (i * 2 + 1.5), 0.7525, (wid / 2 - 0.32), PI, G, 'scr' + (2 + i));
  if (client) { // fruit/snack plate in the middle
    V(g, CY(0.16, 0.12, 0.025, 24), 0xf6f3ec, len * 0.12, 0.765, 0, 0, 0, 0, vcGloss());
    for (let i = 0; i < 6; i++) V(g, SP(0.032, 10, 8), [0xd9534f, 0xf2c14e, 0x7cae4b][i % 3], len * 0.12 + Math.cos(i) * 0.07, 0.795, Math.sin(i * 1.3) * 0.07);
  }
  return { group: g, spots };
}
export const bottleWaterMat = () => cached('bottleWater', () => { const m = new THREE.MeshStandardMaterial({ color: 0xbfe3f0, roughness: 0.05, transparent: true, opacity: 0.45, depthWrite: false }); m.name = 'bottleWater'; return m; });
/** PET water bottle: glass shell, water core, blue cap. */
export function waterBottle(parent, x, y, z) {
  const prof = [[0, 0], [0.032, 0], [0.033, 0.01], [0.033, 0.15], [0.028, 0.175], [0.014, 0.2], [0.013, 0.215], [0, 0.215]];
  D(parent, lathe(prof, 16), mat('glass'), x, y, z);
  const w = put(parent, CY(0.03, 0.03, 0.14, 16), bottleWaterMat(), x, y + 0.075, z);
  w.castShadow = false;
  V(parent, CY(0.0145, 0.0145, 0.02, 12), 0x2b6cb0, x, y + 0.225, z);
}
/** Open laptop facing +Z rotated by ry (screen from the glow atlas). */
export function laptop(parent, x, y, z, ry, G, key) {
  const g = group(parent, x, y, z, ry);
  const al = paint(0xb9bcc0, 0.35, 0.8);
  put(g, RB(0.32, 0.014, 0.22, 0.006, 1), al, 0, 0.007, 0);
  V(g, box(0.27, 0.002, 0.1), 0x2b2d31, 0, 0.0145, -0.02);
  const s = group(g, 0, 0.014, -0.108, 0); s.rotation.x = -0.25;
  put(s, RB(0.32, 0.21, 0.008, 0.006, 1), al, 0, 0.105, 0);
  D(s, G.quad(key, 0.29, 0.18), G.mat, 0, 0.105, 0.0045);
  return g;
}
/** Wall TV facing +Z (glow atlas key), centre at y. */
export function wallScreen(parent, x, y, z, ry, G, key, w = 2.2, h = 1.24) {
  const g = group(parent, x, y, z, ry);
  put(g, RB(w + 0.05, h + 0.05, 0.05, 0.01, 1), blackPl(), 0, 0, 0.025);
  D(g, G.quad(key, w, h), G.mat, 0, 0, 0.0505);
  return g;
}

/* ============================================================== office atlases */
function officeAtlas() {
  return cached('officeAtlas', () => {
    const A = new Atlas(2048);
    const G = new Atlas(2048);
    // ---------------- glow (screens, signs)
    G.add('signTop', 1536, 256, (c, w, h) => {
      drawMark(c, 130, 128, 104, '#7fe3dc', '#ffc56b');
      txt(c, 'SEONN', 270, 206, 214, '#ffffff');
      txt(c, '세온 컴퍼니', 930, 196, 118, '#e9fbfa');
    });
    G.add('elev', 160, 64, (c, w, h) => { c.fillStyle = '#0d0d0f'; c.fillRect(0, 0, w, h); txt(c, '1', 52, 50, 46, '#ffb547', 'center'); txt(c, '▲', 112, 48, 34, '#ffb547', 'center'); });
    G.add('exit', 220, 90, (c, w, h) => {
      c.fillStyle = '#1b9e55'; c.fillRect(0, 0, w, h); c.strokeStyle = '#ffffff'; c.lineWidth = 6; c.lineCap = 'round';
      c.beginPath(); c.arc(44, 22, 8, 0, PI * 2); c.fillStyle = '#fff'; c.fill();
      c.beginPath(); c.moveTo(40, 34); c.lineTo(34, 56); c.lineTo(22, 76); c.moveTo(34, 56); c.lineTo(50, 66); c.lineTo(52, 80); c.moveTo(38, 40); c.lineTo(56, 48); c.moveTo(38, 40); c.lineTo(22, 48); c.stroke();
      txt(c, '비상구', 140, 62, 44, '#ffffff', 'center');
    });
    G.add('printerLcd', 120, 72, (c, w, h) => { c.fillStyle = '#1e5aa8'; c.fillRect(0, 0, w, h); for (let i = 0; i < 3; i++) rr(c, 10 + i * 36, 18, 28, 28, 5, '#d9e8ff'); c.fillStyle = '#9cc0f0'; c.fillRect(10, 54, 100, 6); });
    G.add('coffeeLcd', 80, 50, (c, w, h) => { c.fillStyle = '#101214'; c.fillRect(0, 0, w, h); txt(c, '☕ 준비', 40, 32, 18, '#ffd27a', 'center'); });
    G.add('logoWall', 1024, 400, (c, w, h) => {
      drawMark(c, 190, 190, 150, '#5fd6cf', '#ffbb59');
      txt(c, 'SEONN', 380, 252, 200, '#ffffff');
      txt(c, '세온 컴퍼니', 392, 352, 78, '#c9f1ee');
    });
    G.add('menuLit', 900, 540, (c, w, h) => {
      c.fillStyle = '#25272b'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#4a4d52'; c.lineWidth = 6; c.strokeRect(14, 14, w - 28, h - 28);
      txt(c, '오늘의 점심', 60, 108, 74, '#ffd27a');
      txt(c, "TODAY'S LUNCH", 520, 100, 32, '#8f9399');
      const items = [['제육볶음', '#ff8a5b'], ['된장찌개', '#e2b36b'], ['계란말이', '#ffe08a'], ['시금치나물', '#8fd18a'], ['배추김치', '#ff6b5b'], ['흰쌀밥 · 현미밥', '#f2efe8']];
      items.forEach(([s, col], i) => {
        const y = 190 + i * 52;
        c.fillStyle = col; c.beginPath(); c.arc(78, y - 13, 10, 0, PI * 2); c.fill();
        txt(c, s, 104, y, 40, '#f4f1ea');
        c.fillStyle = '#4f535a'; for (let k = 360; k < 560; k += 14) c.fillRect(k, y - 12, 6, 4);
      });
      rr(c, 600, 170, 250, 150, 16, '#33363b');
      txt(c, '5,000원', 725, 240, 50, '#ffd27a', 'center');
      txt(c, '사원증 결제', 725, 288, 28, '#b9bdc4', 'center');
      txt(c, '11:30 ~ 13:30', 725, 380, 36, '#f4f1ea', 'center');
      txt(c, '반찬 리필은 셀프예요 :)', 725, 440, 26, '#9fe0d8', 'center');
    });
    G.add('signCanopy', 1280, 112, (c, w, h) => { txt(c, '세온 컴퍼니   SEONN COMPANY', w / 2, 82, 76, '#ffffff', 'center'); });
    G.add('monument', 720, 280, (c, w, h) => {
      drawMark(c, 120, 140, 92, '#7fe3dc', '#ffc56b');
      txt(c, '세온 컴퍼니', 240, 140, 92, '#ffffff');
      txt(c, 'SEONN COMPANY', 244, 210, 46, '#bfeee9');
    });
    const kinds = ['code', 'sheet', 'dash', 'chat', 'mail', 'design'];
    kinds.forEach((k, i) => G.add('scr' + i, 384, 216, drawScreen(k, i + 3)));
    G.add('scrMine', 640, 360, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#16707a'); gr.addColorStop(1, '#16233f');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 5; i++) { c.fillStyle = `rgba(255,255,255,${0.04 + i * 0.01})`; c.beginPath(); c.arc(520 - i * 70, 80 + i * 40, 120 - i * 15, 0, PI * 2); c.fill(); }
      drawMark(c, 214, 150, 46, '#7fe3dc', '#ffc56b');
      txt(c, 'SEONN', 276, 174, 64, '#ffffff');
      txt(c, '좋은 아침이에요!', 320, 228, 28, '#d6f3f1', 'center');
      txt(c, '09:00', w - 24, 40, 30, '#ffffff', 'right');
      for (let i = 0; i < 4; i++) { rr(c, 22, 22 + i * 62, 40, 32, 5, '#f2c14e'); c.fillStyle = '#e0a92e'; c.fillRect(22, 22 + i * 62, 18, 6); }
      rr(c, 160, h - 44, 320, 36, 12, 'rgba(255,255,255,0.22)');
      ['#3cc4bd', '#f4a261', '#e76f51', '#9db8f2', '#fee500', '#ffffff'].forEach((col, i) => rr(c, 176 + i * 50, h - 38, 26, 24, 6, col));
      rr(c, w - 178, 196, 154, 100, 8, '#fff6b8'); txt(c, '오늘 할 일', w - 164, 226, 21, '#5a4a12');
      txt(c, '· 보고서 내기', w - 164, 254, 18, '#5a4a12'); txt(c, '· 회의 3시', w - 164, 278, 18, '#5a4a12');
    });
    G.add('tvMeet', 640, 360, (c, w, h) => {
      c.fillStyle = '#fbfbf9'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#137a8a'; c.fillRect(0, 0, 14, h);
      txt(c, '4분기 전략 회의', 46, 70, 46, '#1d3557');
      ['신제품 기획 일정', '별빛테크 협업 제안', '연말 워크숍 (바다 펜션)'].forEach((s, i) => { c.fillStyle = '#2a9d8f'; c.fillRect(50, 116 + i * 52, 12, 12); txt(c, s, 76, 130 + i * 52, 28, '#33393f'); });
      for (let i = 0; i < 5; i++) { const bh = 40 + i * 28; c.fillStyle = i === 4 ? '#f4a261' : '#3cc4bd'; c.fillRect(400 + i * 44, 300 - bh, 30, bh); }
      c.fillStyle = '#c5cad0'; c.fillRect(390, 300, 230, 3);
      drawMark(c, w - 40, h - 36, 18);
    });
    G.add('kiosk', 240, 340, (c, w, h) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#137a8a'; c.fillRect(0, 0, w, 64);
      txt(c, 'SEONN', w / 2, 46, 36, '#ffffff', 'center');
      txt(c, '환영합니다', w / 2, 130, 34, '#1d3557', 'center');
      txt(c, '방문 목적을 골라 주세요', w / 2, 170, 18, '#6c757d', 'center');
      rr(c, 30, 200, w - 60, 50, 12, '#2a9d8f'); txt(c, '방문 등록', w / 2, 234, 26, '#ffffff', 'center');
      rr(c, 30, 264, w - 60, 50, 12, '#eef1f3'); txt(c, '택배 · 배달', w / 2, 298, 24, '#33393f', 'center');
    });
    G.add('bdWall', 1024, 480, (c, w, h) => {
      const R = rng(77);
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#fff6e6'); gr.addColorStop(0.4, '#ece0ca'); gr.addColorStop(1, '#b3a690');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 4; i++) { const rg = c.createRadialGradient(128 + i * 256, -20, 10, 128 + i * 256, -20, 300); rg.addColorStop(0, 'rgba(255,252,240,0.7)'); rg.addColorStop(1, 'rgba(255,252,240,0)'); c.fillStyle = rg; c.fillRect(i * 256, 0, 256, h); }
      c.fillStyle = '#6b5a48'; c.fillRect(0, h - 14, w, 14);
      // 0: door
      c.fillStyle = '#8a6446'; c.fillRect(70, 150, 118, 316); c.fillStyle = '#5e4130'; c.fillRect(64, 144, 130, 8); c.fillRect(64, 144, 8, 322); c.fillRect(186, 144, 8, 322);
      c.fillStyle = '#d9d2c3'; c.fillRect(166, 306, 14, 5);
      rr(c, 98, 118, 60, 18, 3, '#2f3a45');
      // 1: cabinet with binders
      c.fillStyle = '#d6cfc2'; c.fillRect(282, 176, 206, 290); c.fillStyle = '#b9b0a2'; c.fillRect(282, 176, 206, 6);
      for (let r = 0; r < 3; r++) { let x = 292; while (x < 470) { const bw = 10 + R() * 14; c.fillStyle = ['#1d3557', '#9b2c2c', '#2a6f6a', '#e2b04a', '#f2efe8', '#5b7fa6'][(R() * 6) | 0]; c.fillRect(x, 196 + r * 88, bw, 70 - R() * 16); x += bw + 2; } c.fillStyle = '#a89f92'; c.fillRect(286, 270 + r * 88, 198, 5); }
      // 2: framed picture + plant
      c.fillStyle = '#3a2f28'; c.fillRect(560, 110, 160, 120); c.fillStyle = '#e8d9bf'; c.fillRect(570, 120, 140, 100);
      c.fillStyle = '#e09a5a'; c.beginPath(); c.arc(660, 150, 22, 0, PI * 2); c.fill(); c.fillStyle = '#2f6f73'; c.beginPath(); c.moveTo(570, 220); c.lineTo(620, 170); c.lineTo(670, 220); c.fill();
      c.fillStyle = '#e8e4dc'; c.fillRect(600, 400, 70, 66); c.fillStyle = '#3f6b33';
      for (let i = 0; i < 18; i++) { c.beginPath(); c.ellipse(635 + (R() - 0.5) * 90, 330 + R() * 70, 22, 10, R() * 3, 0, PI * 2); c.fill(); }
      // 3: whiteboard + clock
      c.fillStyle = '#9aa0a6'; c.fillRect(800, 150, 200, 130); c.fillStyle = '#f7f8f6'; c.fillRect(806, 156, 188, 118);
      c.strokeStyle = '#1f4fa8'; c.lineWidth = 3; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(820, 180 + i * 18); c.lineTo(820 + 60 + R() * 90, 180 + i * 18); c.stroke(); }
      c.fillStyle = '#fbfbf9'; c.beginPath(); c.arc(900, 90, 22, 0, PI * 2); c.fill(); c.strokeStyle = '#26272b'; c.lineWidth = 4; c.stroke();
      c.fillStyle = '#d6cfc2'; c.fillRect(820, 380, 160, 86);
    });
    G.build();
    G.mat = G.lit(0.95);
    G.logoMat = G.lit(1.7, 0xffffff); G.logoMat.name = 'officeLogoGlow';
    G.signMat = G.lit(2.2, 0xffffff); G.signMat.name = 'officeSignGlow';
    G.bdLit = new THREE.MeshStandardMaterial({ map: G.tex, emissiveMap: G.tex, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.9, color: 0x6f6b66 }); G.bdLit.name = 'towerWallLit';
    G.bdDark = new THREE.MeshStandardMaterial({ map: G.tex, color: 0x6a665f, roughness: 0.9 }); G.bdDark.name = 'towerWallDark';

    // ---------------- printed (paper, posters, boards)
    A.add('whiteboard', 1200, 580, (c, w, h) => {
      const R = rng(4);
      c.fillStyle = '#f8f9f7'; c.fillRect(0, 0, w, h);
      c.lineCap = 'round'; c.lineJoin = 'round';
      txt(c, '이번 주 할 일', 50, 86, 58, '#1f4fa8');
      const todo = [['신제품 기획 회의', true], ['별빛테크 출장 준비', false], ['회식 예약 - 맛있는 고깃집', true], ['워크숍 장소 투표', false], ['주간 보고서', false]];
      todo.forEach(([s, done], i) => {
        const y = 160 + i * 74;
        c.strokeStyle = '#2b2b2b'; c.lineWidth = 4; c.strokeRect(56, y - 34, 34, 34);
        if (done) { c.strokeStyle = '#d33a2c'; c.lineWidth = 6; c.beginPath(); c.moveTo(60, y - 18); c.lineTo(72, y - 4); c.lineTo(96, y - 44); c.stroke(); }
        txt(c, s, 112, y, 40, done ? '#7a7f86' : '#26292d');
        if (done) { c.strokeStyle = '#7a7f86'; c.lineWidth = 3; c.beginPath(); c.moveTo(110, y - 14); c.lineTo(112 + s.length * 38, y - 14); c.stroke(); }
      });
      const bx = [[640, 90, '아이디어'], [860, 90, '설계'], [640, 250, '개발'], [860, 250, '출시!']];
      bx.forEach(([x, y, s], i) => {
        c.strokeStyle = i === 3 ? '#d33a2c' : '#1f4fa8'; c.lineWidth = 5; c.strokeRect(x, y, 170, 80);
        txt(c, s, x + 85, y + 54, 36, '#26292d', 'center');
      });
      c.strokeStyle = '#2b2b2b'; c.lineWidth = 4;
      const arrow = (x1, y1, x2, y2) => { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); const a = Math.atan2(y2 - y1, x2 - x1); c.lineTo(x2 - 18 * Math.cos(a - 0.4), y2 - 18 * Math.sin(a - 0.4)); c.moveTo(x2, y2); c.lineTo(x2 - 18 * Math.cos(a + 0.4), y2 - 18 * Math.sin(a + 0.4)); c.stroke(); };
      arrow(812, 130, 856, 130); arrow(940, 172, 760, 246); arrow(812, 290, 856, 290);
      c.strokeStyle = '#2a8a4a'; c.lineWidth = 4; c.beginPath(); c.moveTo(640, 520); c.lineTo(640, 380); c.moveTo(640, 520); c.lineTo(1000, 520); c.stroke();
      c.beginPath(); c.moveTo(650, 500);
      for (let i = 0; i < 7; i++) c.lineTo(670 + i * 50, 500 - i * 16 - R() * 26);
      c.stroke();
      txt(c, '목표 120%', 900, 400, 32, '#2a8a4a');
      [['#ffe680', 1040, 380], ['#ffb3c7', 1080, 470]].forEach(([col, x, y]) => { c.save(); c.translate(x, y); c.rotate(0.06); c.fillStyle = col; c.fillRect(0, 0, 110, 100); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(14, 30, 70, 5); c.fillRect(14, 52, 56, 5); c.restore(); });
      [[52, 30, '#d33a2c'], [1150, 30, '#1f4fa8']].forEach(([x, y, col]) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, 12, 0, PI * 2); c.fill(); });
    });
    A.add('poster0', 400, 580, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#137a8a'); gr.addColorStop(1, '#0d4f5c');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      drawMark(c, w / 2, 170, 100, '#9ff0ea', '#ffc56b');
      txt(c, '함께 자라는', w / 2, 360, 52, '#ffffff', 'center');
      txt(c, '세온', w / 2, 430, 66, '#ffd27a', 'center');
      txt(c, '도전 · 배려 · 재미', w / 2, 510, 28, '#cdeeea', 'center');
    });
    A.add('poster1', 400, 580, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#7cc6f2'); gr.addColorStop(0.55, '#d8f1ff'); gr.addColorStop(0.56, '#2f8fc0'); gr.addColorStop(0.75, '#46b0d6'); gr.addColorStop(0.76, '#f3dcaa'); gr.addColorStop(1, '#e9cc90');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffd36b'; c.beginPath(); c.arc(300, 150, 52, 0, PI * 2); c.fill();
      c.fillStyle = '#ffffff'; c.fillRect(0, 336, w, 6);
      c.fillStyle = '#8a5a3b'; c.fillRect(70, 360, 120, 70); c.fillStyle = '#c0504d'; c.beginPath(); c.moveTo(56, 362); c.lineTo(130, 318); c.lineTo(204, 362); c.fill();
      txt(c, '여름 워크숍', w / 2, 90, 50, '#13405a', 'center');
      txt(c, '바다 펜션', w / 2, 520, 56, '#7a4a18', 'center');
    });
    A.add('notice', 900, 560, (c, w, h) => {
      const R = rng(9);
      c.fillStyle = '#b98d5c'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) { c.fillStyle = R() < 0.5 ? 'rgba(90,55,25,0.25)' : 'rgba(240,210,160,0.25)'; c.fillRect(R() * w, R() * h, 3, 3); }
      const card = (x, y, cw, ch, rot, bg, title, n, tc = '#26292d') => {
        c.save(); c.translate(x, y); c.rotate(rot);
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(6, 6, cw, ch);
        c.fillStyle = bg; c.fillRect(0, 0, cw, ch);
        txt(c, title, 18, 50, 34, tc);
        lines(c, 18, 74, cw - 36, n, 24, 'rgba(60,60,60,0.45)', R, 5);
        c.fillStyle = '#d33a2c'; c.beginPath(); c.arc(cw / 2, 14, 9, 0, PI * 2); c.fill();
        c.restore();
      };
      card(30, 30, 260, 230, -0.04, '#fbfaf5', '공지사항', 6);
      card(320, 24, 270, 180, 0.03, '#fff1a8', '금요일 회식!', 2);
      c.save(); c.translate(320, 24); c.rotate(0.03); txt(c, '저녁 7시', 18, 106, 30, '#7a4a18'); txt(c, '맛있는 고깃집', 18, 150, 34, '#c0392b'); c.restore();
      card(620, 40, 250, 200, -0.02, '#d9f2ef', '11월 생일', 4);
      card(40, 300, 280, 220, 0.025, '#fbfaf5', '주차 안내', 6);
      c.save(); c.translate(360, 250); c.rotate(-0.05); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(6, 6, 220, 160); c.fillStyle = '#ffffff'; c.fillRect(0, 0, 220, 160);
      const g2 = c.createLinearGradient(0, 12, 0, 148); g2.addColorStop(0, '#9fd3f2'); g2.addColorStop(1, '#2f8fc0'); c.fillStyle = g2; c.fillRect(12, 12, 196, 120);
      for (let i = 0; i < 5; i++) { c.fillStyle = ['#e76f51', '#2a9d8f', '#f4a261', '#264653', '#e9c46a'][i]; c.beginPath(); c.arc(40 + i * 36, 100, 13, 0, PI * 2); c.fill(); c.fillRect(30 + i * 36, 112, 20, 20); }
      c.restore();
      card(620, 290, 250, 230, 0.04, '#ffd9e2', '동호회 모집', 5);
    });
    A.add('art', 640, 440, (c, w, h) => {
      c.fillStyle = '#efe4d2'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f2b260'; c.beginPath(); c.arc(430, 150, 80, 0, PI * 2); c.fill();
      const hill = (y, col, amp, ph) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, h); for (let x = 0; x <= w; x += 8) c.lineTo(x, y + Math.sin(x / 90 + ph) * amp + Math.sin(x / 37 + ph * 2) * amp * 0.3); c.lineTo(w, h); c.fill(); };
      hill(270, '#c9805a', 30, 0.4); hill(320, '#2f6f73', 26, 1.6); hill(370, '#1d3a4a', 20, 2.6);
      c.strokeStyle = '#ffffff'; c.lineWidth = 18; c.strokeRect(0, 0, w, h);
    });
    A.add('calendar', 300, 380, (c, w, h) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#137a8a'; c.fillRect(0, 0, w, 74);
      txt(c, '2026  11월', w / 2, 52, 40, '#ffffff', 'center');
      const R = rng(5);
      for (let i = 0; i < 35; i++) {
        const cx = 22 + (i % 7) * 40, cy = 116 + Math.floor(i / 7) * 50, d = i - 0;
        if (d >= 0 && d < 30) txt(c, String(d + 1), cx + 8, cy, 22, i % 7 === 0 ? '#d33a2c' : '#3a3f45', 'center');
        if (d === 5 || d === 12 || d === 20) { c.strokeStyle = '#d33a2c'; c.lineWidth = 3; c.beginPath(); c.arc(cx + 8, cy - 8, 17, 0, PI * 2); c.stroke(); }
      }
      void R;
    });
    A.add('kbd', 512, 150, (c, w, h) => {
      c.fillStyle = '#cfd1d4'; c.fillRect(0, 0, w, h);
      const rows = [15, 14, 13, 12];
      rows.forEach((n, r) => {
        const kw = (w - 16) / 15, y = 8 + r * 27;
        for (let i = 0; i < n; i++) { rr(c, 8 + i * kw + r * 6, y, kw - 4, 23, 4, '#f7f7f5'); c.fillStyle = '#9a9ea4'; c.fillRect(8 + i * kw + r * 6 + 6, y + 6, 6, 4); }
      });
      rr(c, 8 + 3 * 33, 8 + 4 * 27, 33 * 7, 23, 4, '#f7f7f5');
      for (let i = 0; i < 3; i++) rr(c, 8 + i * 33, 116, 29, 23, 4, '#f7f7f5');
      for (let i = 0; i < 4; i++) rr(c, 352 + i * 38, 116, 34, 23, 4, '#f7f7f5');
    });
    for (let i = 0; i < 3; i++) A.add('doc' + i, 180, 254, (c, w, h) => {
      const R = rng(i + 11);
      c.fillStyle = '#fdfdfb'; c.fillRect(0, 0, w, h);
      c.fillStyle = ['#137a8a', '#1d3557', '#c0504d'][i]; c.fillRect(14, 14, 70, 10);
      c.fillStyle = '#2b2f33'; c.fillRect(14, 34, 120, 8);
      lines(c, 14, 58, w - 28, 6, 12, '#a3a8ad', R, 4);
      if (i === 1) { for (let k = 0; k < 6; k++) { const bh = 20 + R() * 40; c.fillStyle = '#2a9d8f'; c.fillRect(20 + k * 24, 200 - bh, 16, bh); } }
      else if (i === 2) { c.strokeStyle = '#c5cad0'; for (let k = 0; k < 5; k++) c.strokeRect(14, 140 + k * 18, w - 28, 18); }
      else lines(c, 14, 140, w - 28, 7, 12, '#a3a8ad', R, 4);
    });
    const photos = [
      (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9fd3f2'); g.addColorStop(1, '#e8f4fb'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#7cae4b'; c.fillRect(0, h * 0.7, w, h); [['#e76f51', 60], ['#2a9d8f', 100], ['#f4a261', 140]].forEach(([col, x], i) => { const s = i === 2 ? 0.7 : 1; c.fillStyle = '#f1c9a5'; c.beginPath(); c.arc(x, h * (0.42 + (1 - s) * 0.2), 13 * s, 0, PI * 2); c.fill(); c.fillStyle = col; c.fillRect(x - 15 * s, h * (0.52 + (1 - s) * 0.2), 30 * s, 50 * s); }); },
      (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ff9a6b'); g.addColorStop(0.55, '#ffd29a'); g.addColorStop(0.56, '#3a6f9a'); g.addColorStop(1, '#1d3a5a'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#fff1c4'; c.beginPath(); c.arc(w / 2, h * 0.55, 26, PI, 0); c.fill(); },
      (c, w, h) => { c.fillStyle = '#e9dccb'; c.fillRect(0, 0, w, h); c.fillStyle = '#c98f52'; c.beginPath(); c.ellipse(w / 2, h * 0.62, 50, 40, 0, 0, PI * 2); c.fill(); c.beginPath(); c.arc(w / 2, h * 0.38, 34, 0, PI * 2); c.fill(); c.fillStyle = '#8a5a30'; c.beginPath(); c.ellipse(w / 2 - 30, h * 0.3, 12, 22, -0.4, 0, PI * 2); c.fill(); c.beginPath(); c.ellipse(w / 2 + 30, h * 0.3, 12, 22, 0.4, 0, PI * 2); c.fill(); c.fillStyle = '#222'; c.beginPath(); c.arc(w / 2 - 12, h * 0.36, 4, 0, PI * 2); c.arc(w / 2 + 12, h * 0.36, 4, 0, PI * 2); c.fill(); c.beginPath(); c.arc(w / 2, h * 0.45, 6, 0, PI * 2); c.fill(); },
    ];
    photos.forEach((f, i) => A.add('photo' + i, 200, 150, f));
    A.add('nameplate', 320, 90, (c, w, h) => { c.fillStyle = '#f6f1e7'; c.fillRect(0, 0, w, h); drawMark(c, 46, 45, 26, '#2a9d8f', '#f4a261'); txt(c, '내 자리', 186, 62, 50, '#2b2b2b', 'center'); });
    A.add('clock', 256, 256, (c, w, h) => {
      c.fillStyle = '#fbfbf9'; c.beginPath(); c.arc(128, 128, 120, 0, PI * 2); c.fill();
      c.fillStyle = '#26272b';
      for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; c.save(); c.translate(128 + Math.sin(a) * 100, 128 - Math.cos(a) * 100); c.rotate(a); c.fillRect(-3, -10, 6, i % 3 ? 14 : 22); c.restore(); }
      c.lineCap = 'round'; c.strokeStyle = '#26272b'; c.lineWidth = 9; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + Math.sin(-0.95) * 58, 128 - Math.cos(-0.95) * 58); c.stroke();
      c.lineWidth = 6; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + Math.sin(1.0) * 88, 128 - Math.cos(1.0) * 88); c.stroke();
      c.fillStyle = '#d33a2c'; c.beginPath(); c.arc(128, 128, 7, 0, PI * 2); c.fill();
    });
    A.add('wc', 180, 180, (c, w, h) => {
      rr(c, 0, 0, w, h, 16, '#2f3a45');
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(56, 50, 14, 0, PI * 2); c.arc(124, 50, 14, 0, PI * 2); c.fill();
      c.fillRect(42, 70, 28, 52); c.beginPath(); c.moveTo(124, 68); c.lineTo(146, 122); c.lineTo(102, 122); c.fill();
      c.fillRect(89, 36, 3, 96);
      txt(c, '화장실', 90, 162, 30, '#ffffff', 'center');
    });
    A.add('stairs', 180, 180, (c, w, h) => {
      rr(c, 0, 0, w, h, 16, '#2f3a45');
      c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(30, 120); for (let i = 0; i < 4; i++) { c.lineTo(30 + i * 30, 120 - i * 22); c.lineTo(60 + i * 30, 120 - i * 22); } c.lineTo(150, 130); c.lineTo(30, 130); c.fill();
      txt(c, '계단', 90, 166, 32, '#ffffff', 'center');
    });
    A.add('roomA', 320, 90, (c, w, h) => { rr(c, 0, 0, w, h, 10, '#2f3a45'); txt(c, '회의실 A', w / 2, 62, 46, '#ffffff', 'center'); });
    A.add('mag0', 200, 270, (c, w, h) => { c.fillStyle = '#e76f51'; c.fillRect(0, 0, w, h); txt(c, 'DESIGN', 14, 56, 46, '#ffffff'); c.fillStyle = '#ffd27a'; c.beginPath(); c.arc(130, 170, 60, 0, PI * 2); c.fill(); lines(c, 14, 230, 120, 2, 14, '#ffffff', rng(2), 5); });
    A.add('mag1', 200, 270, (c, w, h) => { c.fillStyle = '#1d3557'; c.fillRect(0, 0, w, h); txt(c, '월간 IT', 14, 56, 40, '#ffffff'); c.fillStyle = '#3cc4bd'; c.fillRect(20, 90, 160, 110); lines(c, 14, 226, 150, 2, 14, '#cfd6e0', rng(3), 5); });
    ['#ffe680', '#ffb3c7', '#b8f0d8'].forEach((col, i) => A.add('sticky' + i, 64, 64, (c, w, h) => { c.fillStyle = col; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(40,40,40,0.55)'; c.fillRect(8, 18, 44, 3); c.fillRect(8, 30, 36, 3); c.fillRect(8, 42, 40, 3); }));
    A.add('valuesWide', 900, 300, (c, w, h) => {
      c.fillStyle = '#f6f1e7'; c.fillRect(0, 0, w, h);
      drawMark(c, 120, 150, 80, '#2a9d8f', '#f4a261');
      txt(c, '좋은 일을, 즐겁게.', 240, 140, 64, '#1d3557');
      txt(c, 'SEONN · 세온 컴퍼니', 244, 210, 34, '#2a9d8f');
    });
    A.build();
    A.mat = A.printed(0.6);
    return { A, G };
  });
}

/** The office atlases (A printed, G glow) incl. G.bdLit / G.bdDark: lit and unlit upper-floor walls ('bdWall'). */
export function sharedOfficeAtlas() { return officeAtlas(); }

/* ============================================================== office materials */
function officeMats() {
  return cached('officeMats', () => {
    const strip = mat('coolGlow').clone(); strip.name = 'towerStripGlow';
    return {
      lime: textured('concrete', { color: 0xd9d0c0, seed: 12 }, 3, { normal: 0.3 }),
      ceil: textured('tiles', { color: 0xf3f2ee, grout: 0xc9c6bf, count: 2, groutWidth: 0.01, rough: 0.85 }, 1.2, { normal: 0.3 }),
      tGlass: (() => { const m = new THREE.MeshPhysicalMaterial({ color: 0x4f7886, metalness: 0.2, roughness: 0.035, transparent: true, opacity: 0.66, envMapIntensity: 2.4, depthWrite: false, side: THREE.DoubleSide }); m.name = 'towerGlass'; return m; })(),
      glass: mat('glass'),
      mullion: paint(0x3a3f45, 0.35, 0.7),
      fin: paint(0xa88b67, 0.32, 0.8),
      spandrel: paint(0x2a2f35, 0.42, 0.55),
      alu: paint(0xc5cad0, 0.3, 0.85),
      white: frameWhite(),
      quartz: paint(0xece9e3, 0.22, 0),
      strip,
      ceilLit: paint(0x8f8b85, 0.9, 0, { emissive: 0xfff3e0, emissiveIntensity: 0.3 }),
      downGlow: (() => { const m = glow(0xffe2b0, 2.4); m.name = 'officeDownGlow'; return m; })(),
      fabricPart: textured('fabric', { color: 0x6f8a7a, weave: 140, seed: 8 }, 0.5, { normal: 0.7 }),
      backing: blackPl(),
    };
  });
}

/* ============================================================== tower exterior */
const FLOOR = 0.15, CEIL = 3.75;
const TOP = 23.6; // roof level
const FL = (k) => 4.6 + (k - 1) * 3.8; // upper floor k = 1..5

function curtainSide(root, M, G, { x, z, ry, len, nb, seed }) {
  const g = group(root, x, 0, z, ry);
  const R = rng(seed);
  const bw = len / nb, DEP = 2.6;
  for (let k = 1; k <= 5; k++) {
    const F = FL(k);
    D(g, quad(len, 2.82), M.tGlass, 0, F + 0.05 + 1.41, 0);
    put(g, RB(len, 1.0, 0.14, 0.01, 1), M.spandrel, 0, F + 2.87 + 0.5, -0.02);
    for (const hy of [F + 0.05, F + 2.86]) put(g, box(len, 0.05, 0.13), M.mullion, 0, hy, 0.03);
    V(g, plane(len, DEP), 0x4c525c, 0, F + 0.002, -DEP / 2);
    let lit = true;
    for (let b = 0; b < nb; b++) {
      if (b % 3 === 0) lit = R() < 0.76;
      const xb = -len / 2 + (b + 0.5) * bw;
      const q = (b + k) % 4;
      put(g, G.mapSub(quad(bw, 2.8), 'bdWall', q / 4, (q + 1) / 4), lit ? G.bdLit : G.bdDark, xb, F + 1.4, -DEP);
      if (lit) put(g, plane(bw, DEP).rotateX(PI), M.ceilLit, xb, F + 2.8, -DEP / 2);
      else V(g, plane(bw, DEP).rotateX(PI), 0x8d8b86, xb, F + 2.8, -DEP / 2);
      for (const sz of [-0.75, -1.85]) {
        if (lit) D(g, box(bw * 0.8, 0.02, 0.1), M.strip, xb, F + 2.785, sz);
        else V(g, box(bw * 0.8, 0.02, 0.1), 0x9da0a4, xb, F + 2.785, sz);
      }
      const r = R();
      if (r < 0.6) {
        const ox = (R() - 0.5) * 0.3;
        V(g, box(bw * 0.78, 0.035, 0.75), 0xd8d1c4, xb, F + 0.74, -1.25);
        V(g, box(0.04, 0.72, 0.65), 0xbdb6aa, xb - bw * 0.36, F + 0.37, -1.25);
        V(g, box(0.56, 0.33, 0.03), 0x23262b, xb + ox, F + 1.06, -1.52);
        V(g, box(0.44, 0.06, 0.44), 0x30343a, xb + ox, F + 0.47, -0.82);
        V(g, box(0.42, 0.5, 0.05), 0x30343a, xb + ox, F + 0.78, -0.62, -0.12, 0, 0);
      } else if (r < 0.72) {
        V(g, box(bw * 0.9, 1.9, 0.4), 0xd6cfc2, xb, F + 0.95, -DEP + 0.22);
      } else if (r < 0.84) {
        V(g, CY(0.2, 0.16, 0.42, 10), 0xe8e4dc, xb, F + 0.21, -0.7);
        V(g, sphere(0.36, 10, 8).scale(1, 1.5, 1), 0x3f6b33, xb, F + 0.95, -0.7);
      }
      if (R() < 0.45) { const bh = 0.25 + R() * 1.8; V(g, quad(bw - 0.05, bh), 0xd7cfbe, xb, F + 2.8 - bh / 2, -0.07); }
    }
  }
  const H0 = 4.4, H1 = TOP;
  for (let b = 0; b <= nb; b++) {
    const xm = -len / 2 + b * bw;
    put(g, box(0.07, H1 - H0, 0.16), M.mullion, xm, (H0 + H1) / 2, 0.06);
    if (b % 2 === 0 && b > 0 && b < nb) put(g, RB(0.06, H1 - H0, 0.42, 0.015, 1), M.fin, xm, (H0 + H1) / 2, 0.25);
  }
}

function buildExterior(site, g, M, G) {
  const { lime } = M;
  // plaza slab over the whole footprint
  put(g, box(30, 0.04, 22), mat('pavers2'), 0, 0.02, 0);
  // curtain walls on 4 sides (upper floors)
  curtainSide(g, M, G, { x: 0, z: 10, ry: 0, len: 25.8, nb: 17, seed: 1 });
  curtainSide(g, M, G, { x: 0, z: -10, ry: PI, len: 25.8, nb: 17, seed: 2 });
  curtainSide(g, M, G, { x: 14, z: 0, ry: PI / 2, len: 17.8, nb: 12, seed: 3 });
  curtainSide(g, M, G, { x: -14, z: 0, ry: -PI / 2, len: 17.8, nb: 12, seed: 4 });
  // corner piers + crown
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    put(g, RB(1.3, 25.2, 1.3, 0.05, 2), lime, sx * 13.55, 12.6, sz * 9.55);
    for (let k = 1; k <= 5; k++) put(g, box(1.32, 0.04, 1.32), M.spandrel, sx * 13.55, FL(k) + 2.85, sz * 9.55);
  }
  for (const sz of [-1, 1]) {
    put(g, RB(28.4, 1.6, 0.5, 0.03, 2), lime, 0, 24.4, sz * 9.95);
    put(g, RB(28.5, 0.07, 0.6, 0.02, 1), M.alu, 0, 25.23, sz * 9.95);
    put(g, box(28.42, 0.05, 0.52), M.spandrel, 0, 23.9, sz * 9.95);
  }
  for (const sx of [-1, 1]) {
    put(g, RB(0.5, 1.6, 19.4, 0.03, 2), lime, sx * 13.95, 24.4, 0);
    put(g, RB(0.6, 0.07, 19.5, 0.02, 1), M.alu, sx * 13.95, 25.23, 0);
    put(g, box(0.52, 0.05, 19.42), M.spandrel, sx * 13.95, 23.9, 0);
  }
  put(g, plane(27.4, 19.4), mat('concrete'), 0, TOP + 0.02, 0);
  // rooftop garden along the front parapet: planter + small trees that peek over the crown
  put(g, RB(18, 0.7, 1.2, 0.03, 1), lime, 0, TOP + 0.35, 8.6);
  V(g, box(17.8, 0.02, 1.0), 0x4a3726, 0, TOP + 0.69, 8.6);
  const TR = rng(19);
  for (const tx of [-7.5, -2.6, 2.6, 7.5]) {
    V(g, CY(0.07, 0.11, 2.8, 8), 0x6b5137, tx, TOP + 2.05, 8.6);
    for (let i = 0; i < 5; i++) { const a = i * 1.25 + TR(); leafyCrown(g, tx + Math.cos(a) * 0.45, TOP + 3.3 + TR() * 0.5, 8.6 + Math.sin(a) * 0.35, 0.55, 34, TR); }
    leafyCrown(g, tx, TOP + 3.9, 8.6, 0.5, 30, TR);
  }
  for (let i = 0; i < 9; i++) shrub(g, -8 + i * 2, TOP + 0.68, 8.6, 0.3, 90 + i, 4);
  // SEONN crown signs (front and right side)
  D(g, G.quad('signTop', 8.4, 1.4), G.signMat, 0, 24.42, 10.205);
  D(g, G.quad('signTop', 7.2, 1.2), G.signMat, 14.205, 24.42, 0, 0, PI / 2, 0);
  site.nightGlow.push(G.signMat);
  // rooftop: penthouse, HVAC, cooling tower, pipes
  put(g, RB(6.4, 4.0, 5.0, 0.04, 2), lime, -2, TOP + 2.0, -4.6);
  put(g, RB(6.6, 0.12, 5.2, 0.02, 1), M.alu, -2, TOP + 4.06, -4.6);
  for (let i = 0; i < 9; i++) put(g, box(2.4, 0.06, 0.08), M.spandrel, 2.1 - 0.8, TOP + 1.2 + i * 0.22, -2.06, 0, 0, 0);
  put(g, box(2.6, 2.2, 0.06), M.spandrel, 0.4, TOP + 2.1, -2.12);
  for (let i = 0; i < 3; i++) {
    const hx = 5 + i * 2.7, hz = 3;
    put(g, box(2.3, 0.25, 1.5), M.spandrel, hx, TOP + 0.125, hz);
    put(g, RB(2.2, 1.5, 1.4, 0.04, 2), metalGray(), hx, TOP + 1.0, hz);
    for (const fx of [-0.5, 0.5]) { put(g, CY(0.42, 0.42, 0.14, 24), M.spandrel, hx + fx, TOP + 1.82, hz); put(g, torus(0.42, 0.03, 6, 24), M.alu, hx + fx, TOP + 1.9, hz, PI / 2, 0, 0); }
    for (let k = 0; k < 6; k++) put(g, box(2.1, 0.03, 0.02), M.spandrel, hx, TOP + 0.5 + k * 0.12, hz + 0.71);
  }
  put(g, CY(1.1, 1.2, 2.8, 28), metalGray(), 9, TOP + 1.4, -5);
  put(g, CY(1.12, 1.12, 0.12, 28), M.spandrel, 9, TOP + 2.86, -5);
  put(g, CY(0.7, 0.7, 0.2, 24), M.spandrel, 9, TOP + 2.95, -5);
  for (const pz of [-6.4, -6.0]) put(g, CY(0.1, 0.1, 9, 12), M.alu, 4.5, TOP + 0.35, pz, 0, 0, PI / 2);
  put(g, CY(0.04, 0.05, 4.5, 8), M.alu, -4.5, TOP + 6.2, -6.2);
  // ---- walkable roof (옥상 정원): elevator hut, benches, colliders ----
  const hx = -8.6, hz0 = -5.9, hz1 = -3.3, hw = 2.6, hh = 3.0;
  const hutWall = (x, z, w, d, y0 = TOP, y1 = TOP + hh) => { put(g, RB(w, y1 - y0, d, 0.02, 1), lime, x, (y0 + y1) / 2, z); solid(site, x, (y0 + y1) / 2, z, w, y1 - y0, d); };
  hutWall(hx, hz0 + 0.06, hw, 0.12);                       // back
  hutWall(hx - hw / 2 + 0.06, (hz0 + hz1) / 2, 0.12, hz1 - hz0); // sides
  hutWall(hx + hw / 2 - 0.06, (hz0 + hz1) / 2, 0.12, hz1 - hz0);
  hutWall(hx - 0.95, hz1 - 0.06, 0.7, 0.12);              // front, left and right of the 1.2 m doorway
  hutWall(hx + 0.95, hz1 - 0.06, 0.7, 0.12);
  hutWall(hx, hz1 - 0.06, 1.2, 0.12, TOP + 2.3, TOP + hh);
  put(g, RB(hw + 0.3, 0.14, hz1 - hz0 + 0.5, 0.03, 1), M.alu, hx, TOP + hh + 0.07, (hz0 + hz1) / 2 + 0.1);
  for (const sx of [-1, 1]) put(g, RB(0.09, 2.38, 0.14, 0.01, 1), mat('darkSteel'), hx + sx * 0.645, TOP + 1.19, hz1 - 0.02);
  put(g, RB(1.38, 0.09, 0.14, 0.01, 1), mat('darkSteel'), hx, TOP + 2.345, hz1 - 0.02);
  D(g, G.quad('signTop', 1.6, 0.27), G.signMat, hx, TOP + 2.65, hz1 + 0.005);
  site.lamps.push({ pos: [hx, TOP + 2.6, hz1 + 1.2], color: 0xffe6c0, intensity: 5, range: 7 });
  // benches looking over the front parapet
  for (const bx of [-5.5, 0, 5.5]) {
    const b = group(g, bx, TOP, 6.6, 0);
    for (let i = 0; i < 4; i++) put(b, RB(1.8, 0.04, 0.11, 0.015, 1), mat('oak'), 0, 0.45, -0.2 + i * 0.13);
    for (let i = 0; i < 3; i++) put(b, RB(1.8, 0.1, 0.035, 0.012, 1), mat('oak'), 0, 0.62 + i * 0.13, -0.32, -0.15, 0, 0);
    for (const lx of [-0.78, 0.78]) put(b, RB(0.06, 0.45, 0.5, 0.01, 1), mat('darkSteel'), lx, 0.225, -0.07);
    solid(site, bx, TOP + 0.4, 6.53, 1.9, 0.8, 0.6);
  }
  // roof colliders: deck, crown parapet, penthouse, plant, cooling tower, front planter
  solid(site, 0, TOP - 0.15, 0, 27.6, 0.3, 19.6);
  for (const sz of [-1, 1]) solid(site, 0, 24.4, sz * 9.95, 28.4, 1.6, 0.5);
  for (const sx of [-1, 1]) solid(site, sx * 13.95, 24.4, 0, 0.5, 1.6, 19.4);
  solid(site, -2, TOP + 2.0, -4.6, 6.4, 4.0, 5.0);
  for (let i = 0; i < 3; i++) solid(site, 5 + i * 2.7, TOP + 0.9, 3, 2.3, 1.8, 1.5);
  solid(site, 9, TOP + 1.5, -5, 2.4, 3.0, 2.4);
  solid(site, 0, TOP + 0.35, 8.6, 18, 0.7, 1.2);
  solid(site, 4.5, TOP + 0.35, -6.2, 9.2, 0.5, 0.7);
  site.indoor.push({ min: [hx - hw / 2, TOP, hz0], max: [hx + hw / 2, TOP + hh, hz1] });
  // ground floor: back/side service core in stone, band above GF glass
  // (split around the elevator pocket x -2.15..-0.35, z -7.6..-5.6, up to y 2.85)
  const coreBox = (x0, x1, z0, z1, y0, y1) => {
    put(g, RB(x1 - x0, y1 - y0, z1 - z0, 0.03, 2), lime, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    for (let i = 0; i < 6; i++) { const by = 0.6 + i * 0.7; if (by > y0 && by < y1) put(g, box(x1 - x0 + 0.02, 0.03, z1 - z0 + 0.02), M.spandrel, (x0 + x1) / 2, by, (z0 + z1) / 2); }
  };
  coreBox(-13.95, -2.15, -10, -5.6, 0, 4.58);
  coreBox(-0.35, 13.95, -10, -5.6, 0, 4.58);
  coreBox(-2.15, -0.35, -10, -7.6, 0, 4.58);
  coreBox(-2.15, -0.35, -7.6, -5.6, 2.85, 4.58);
  staticDoor(g, 6, 0.04, -10.0, PI, { w: 1.2, h: 2.4, leaf: metalGray(), frame: M.spandrel });
  for (const sx of [-1, 1]) put(g, RB(0.14, 0.85, 13.8, 0.01, 1), M.spandrel, sx * 13.99, 4.175, 1.5);
  put(g, RB(27.94, 0.65, 0.16, 0.01, 1), M.spandrel, 0, 4.075, 8.4);
  // arcade soffit + front fascia + columns + downlights
  put(g, plane(28, 1.6).rotateX(PI), M.white, 0, 4.4, 9.2);
  put(g, RB(25.8, 0.3, 0.16, 0.01, 1), lime, 0, 4.45, 10.04);
  for (const cx of [-9.1, -4.6, 4.6, 9.1]) { put(g, CY(0.3, 0.3, 4.4, 28), lime, cx, 2.2, 9.5); put(g, CY(0.36, 0.36, 0.08, 28), M.spandrel, cx, 0.08, 9.5); solid(site, cx, 2.2, 9.5, 0.6, 4.4, 0.6); }
  for (const cx of [-11.4, -6.9, -2.3, 2.3, 6.9, 11.4]) { D(g, CY(0.09, 0.09, 0.02, 16), M.downGlow, cx, 4.39, 9.2); put(g, torus(0.1, 0.012, 6, 18), M.alu, cx, 4.395, 9.2, PI / 2, 0, 0); }
  site.nightGlow.push(M.downGlow);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) solid(site, sx * 13.55, 2.5, sz * 9.55, 1.3, 5, 1.3);
  // GF front glazing (z = 8.4) with the sliding door at x in [-1.05, 1.05]
  const fx = [-13.95, -12.2, -10.3, -8.4, -6.5, -4.6, -2.6, -1.05, 1.05, 2.6, 4.6, 6.5, 8.4, 10.3, 12.2, 13.95];
  for (let i = 0; i < fx.length; i++) {
    put(g, RB(0.08, 3.6, 0.14, 0.01, 1), M.mullion, fx[i], 1.95, 8.4);
    if (i === fx.length - 1) break;
    const a = fx[i], b = fx[i + 1], w = b - a, cx = (a + b) / 2;
    if (a === -1.05) { D(g, quad(w, 0.75), M.glass, cx, 3.375, 8.4); put(g, RB(w + 1.4, 0.26, 0.26, 0.02, 1), M.alu, cx, 2.87, 8.48); continue; }
    D(g, quad(w, 3.6), M.glass, cx, 1.95, 8.4);
    put(g, box(w, 0.06, 0.12), M.mullion, cx, 3.0, 8.4);
    put(g, RB(w, 0.1, 0.16, 0.01, 1), M.mullion, cx, 0.2, 8.4);
    solid(site, cx, 1.95, 8.4, w, 3.6, 0.12);
  }
  // GF side glazing x = +-14 for z in [-5.6, 8.4]
  for (const sx of [-1, 1]) {
    const n = 9, z0 = -5.6, z1 = 8.4, bw = (z1 - z0) / n;
    for (let i = 0; i <= n; i++) put(g, RB(0.14, 3.6, 0.08, 0.01, 1), M.mullion, sx * 13.97, 1.95, z0 + i * bw);
    for (let i = 0; i < n; i++) {
      const cz = z0 + (i + 0.5) * bw;
      D(g, quad(bw, 3.6), M.glass, sx * 13.97, 1.95, cz, 0, PI / 2, 0);
      put(g, box(0.12, 0.06, bw), M.mullion, sx * 13.97, 3.0, cz);
      put(g, RB(0.16, 0.1, bw, 0.01, 1), M.mullion, sx * 13.97, 0.2, cz);
    }
    solid(site, sx * 13.97, 1.95, 1.4, 0.12, 3.6, 14);
  }
  solid(site, -8.05, 2.29, -7.8, 11.8, 4.58, 4.4);
  solid(site, 6.8, 2.29, -7.8, 14.3, 4.58, 4.4);
  solid(site, -1.25, 2.29, -8.8, 1.8, 4.58, 2.4);
  solid(site, -1.25, 3.7, -6.6, 1.8, 1.7, 2.0);
  // sliding doors
  for (const s of [-1, 1]) {
    const piv = group(g, s * 0.525, FLOOR, 8.5, 0);
    piv.userData.dynamic = true;
    D(piv, quad(0.97, 2.52), M.glass, 0, 1.3, 0);
    put(piv, RB(1.05, 0.08, 0.06, 0.01, 1), M.alu, 0, 2.56, 0);
    put(piv, RB(1.05, 0.1, 0.06, 0.01, 1), M.alu, 0, 0.05, 0);
    for (const e of [-1, 1]) put(piv, RB(0.045, 2.6, 0.06, 0.01, 1), M.alu, e * 0.5025, 1.3, 0);
    put(piv, RB(0.03, 0.9, 0.04, 0.01, 1), mat('chrome'), -s * 0.44, 1.1, 0.05);
    bake(piv);
    site.doors.push({ pivot: piv, openAngle: 0, slide: [s * 1.0, 0, 0], auto: true, collider: aabb(s < 0 ? -1.05 : 0, FLOOR, 8.44, s < 0 ? 0 : 1.05, 2.75, 8.56) });
  }
  put(g, RB(2.2, 0.02, 0.3, 0.005, 1), M.alu, 0, 0.16, 8.45);
  // canopy with sign
  put(g, RB(6.8, 0.22, 2.6, 0.03, 2), M.white, 0, 3.42, 9.7);
  put(g, RB(6.84, 0.5, 0.14, 0.02, 1), M.spandrel, 0, 3.4, 10.98);
  D(g, G.quad('signCanopy', 4.8, 0.42), G.signMat, 0, 3.4, 11.052);
  for (const cx of [-2.4, -0.8, 0.8, 2.4]) { D(g, CY(0.07, 0.07, 0.02, 16), M.downGlow, cx, 3.305, 10.2); }
  for (const sx of [-1, 1]) put(g, CY(0.03, 0.03, 1.3, 8), M.alu, sx * 3.0, 3.98, 9.6, 0.9, 0, 0);
  // planters by the door, monument sign, bench, bin
  for (const sx of [-1, 1]) {
    put(g, RB(1.4, 0.55, 1.2, 0.05, 2), lime, sx * 2.55, 0.275, 9.9);
    V(g, box(1.28, 0.02, 1.08), 0x4a3726, sx * 2.55, 0.52, 9.9);
    shrub(g, sx * 2.55 - 0.25, 0.5, 9.75, 0.42, 3 + sx, 10);
    shrub(g, sx * 2.55 + 0.32, 0.5, 10.1, 0.34, 7 + sx, 6);
    solid(site, sx * 2.55, 0.4, 9.9, 1.4, 0.8, 1.2);
  }
  for (const sx of [-1, 1]) {
    for (const [z0, z1] of [[-10.6, -1.2], [0.2, 8.6]]) {
      const zc = (z0 + z1) / 2, L = z1 - z0;
      put(g, RB(0.7, 0.42, L, 0.04, 2), lime, sx * 14.62, 0.21, zc);
      V(g, box(0.58, 0.02, L - 0.12), 0x4a3726, sx * 14.62, 0.4, zc);
      const R = rng(z0 * 10 + sx * 3);
      for (let z = z0 + 0.45; z < z1 - 0.3; z += 0.75 + R() * 0.3) shrub(g, sx * 14.62 + (R() - 0.5) * 0.08, 0.38, z, 0.26 + R() * 0.08, (z * 7 + sx * 13) | 0, R() < 0.4 ? 5 : 0);
      solid(site, sx * 14.62, 0.3, zc, 0.7, 0.6, L);
    }
  }
  const mo = group(g, 8.2, 0.04, 10.35, 0);
  put(mo, RB(3.2, 1.0, 0.6, 0.04, 2), lime, 0, 0.5, 0);
  put(mo, RB(2.9, 0.62, 0.04, 0.01, 1), M.spandrel, 0, 0.55, 0.3);
  D(mo, G.quad('monument', 1.6, 0.62), G.signMat, -0.1, 0.55, 0.323);
  solid(site, 8.2, 0.5, 10.35, 3.2, 1.0, 0.6);
  const bn = group(g, -7.6, 0.04, 9.55, 0);
  for (let i = 0; i < 5; i++) put(bn, RB(1.8, 0.04, 0.08, 0.012, 1), mat('oak'), 0, 0.44, -0.18 + i * 0.09);
  for (const s of [-0.7, 0.7]) put(bn, RB(0.06, 0.42, 0.4, 0.01, 1), M.spandrel, s, 0.21, 0);
  solid(site, -7.6, 0.25, 9.55, 1.8, 0.5, 0.45);
  const bin = group(g, -11.2, 0.04, 9.6, 0);
  put(bin, CY(0.24, 0.22, 0.85, 20), mat('darkSteel'), 0, 0.425, 0);
  put(bin, CY(0.26, 0.26, 0.06, 20), mat('steel'), 0, 0.87, 0);
  solid(site, -11.2, 0.45, 9.6, 0.5, 0.9, 0.5);
  site.lamps.push({ pos: [0, 3.1, 10.2], color: 0xffe2b0, intensity: 8, range: 8 });
  site.lamps.push({ pos: [-7, 4.1, 9.2], color: 0xffe2b0, intensity: 8, range: 9 });
  site.lamps.push({ pos: [7, 4.1, 9.2], color: 0xffe2b0, intensity: 8, range: 9 });
}

/* ============================================================== interior */
function buildInterior(site, g, M, A, G) {
  const F = FLOOR, wall = mat('plaster');
  const wallBox = (x0, x1, z0, z1, y0 = F, y1 = CEIL, m = wall) => {
    put(g, RB(x1 - x0, y1 - y0, z1 - z0, 0.01, 1), m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    solid(site, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0);
  };
  const base = (x0, x1, z, dir) => put(g, box(x1 - x0, 0.08, 0.016), mat('walnut'), (x0 + x1) / 2, F + 0.04, z + dir * 0.008);
  // slab + floors + ceilings
  put(g, box(28, 0.11, 18.4), mat('concrete'), 0, 0.095, -0.8);
  solid(site, 0, 0.075, -0.8, 28, 0.15, 18.4);
  put(g, plane(27.9, 8.1), mat('carpet'), 0, F + 0.001, -1.35);
  put(g, plane(9.15, 5.4), mat('marble'), 0, F + 0.001, 5.7);
  put(g, plane(9.35, 5.4), mat('oakFloor'), -9.275, F + 0.001, 5.7);
  put(g, plane(9.35, 5.4), mat('carpetWarm'), 9.275, F + 0.001, 5.7);
  put(g, plane(3.0, 8.1), mat('carpetWarm'), 0, F + 0.004, -1.35);
  put(g, plane(27.9, 8.1).rotateX(PI), M.ceil, 0, CEIL, -1.35);
  put(g, plane(9.35, 5.4).rotateX(PI), M.ceil, -9.275, CEIL, 5.7);
  put(g, plane(9.35, 5.4).rotateX(PI), M.ceil, 9.275, CEIL, 5.7);
  put(g, plane(9.2, 5.4).rotateX(PI), mat('plaster'), 0, CEIL, 5.7);
  site.indoor.push(aabb(-13.95, 0, -5.4, 13.95, CEIL, 8.4));
  // walls
  // back wall with the elevator doorway (x -1.85..-0.65, up to F + 2.3)
  wallBox(-13.95, -1.85, -5.6, -5.4, F, CEIL, mat('plasterWarm'));
  wallBox(-0.65, 13.95, -5.6, -5.4, F, CEIL, mat('plasterWarm'));
  wallBox(-1.85, -0.65, -5.6, -5.4, F + 2.3, CEIL, mat('plasterWarm'));
  base(-13.95, -1.85, -5.4, 1);
  base(-0.65, 13.95, -5.4, 1);
  // oak wainscot + rail where the back wall is free
  for (const [a, b] of [[-8.9, -6.32], [-5.18, -2.62], [2.62, 4.06], [5.14, 9.6], [12.9, 13.95]]) {
    put(g, box(b - a, 0.92, 0.02), mat('oak'), (a + b) / 2, F + 0.54, -5.39);
    put(g, RB(b - a, 0.035, 0.045, 0.01, 1), mat('walnut'), (a + b) / 2, F + 1.0, -5.378);
  }
  // acoustic felt panels
  [[-4.7, 2.75, 0.55, 0.55, 0x2f6f73], [-4.1, 2.95, 0.5, 0.9, 0xd9a441], [-3.5, 2.6, 0.55, 0.55, 0x8fa98f], [-4.15, 2.25, 0.5, 0.3, 0xb8a99a], [-3.5, 3.15, 0.55, 0.3, 0x2f6f73], [-4.7, 3.27, 0.55, 0.42, 0x8fa98f]].forEach(([px, py, pw, phh, col]) => V(g, RB(pw, phh, 0.04, 0.015, 2), col, px, py, -5.38, 0, 0, 0, vcSoft()));
  const dz0 = 2.7, dz1 = 3.0;
  for (const [a, b] of [[-13.95, -6.3], [-4.9, -4.3], [-2.9, 2.9], [4.3, 12.4], [13.5, 13.95]]) { wallBox(a, b, dz0, dz1); base(a, b, dz0, -1); base(a, b, dz1, 1); }
  for (const [a, b] of [[-6.3, -4.9], [-4.3, -2.9], [2.9, 4.3], [12.4, 13.5]]) {
    put(g, RB(b - a, CEIL - 2.35, dz1 - dz0, 0.01, 1), wall, (a + b) / 2, (2.35 + CEIL) / 2, (dz0 + dz1) / 2);
    for (const s of [a, b]) put(g, box(0.03, 2.2, 0.32), mat('walnut'), s + (s === a ? 0.015 : -0.015), F + 1.1, (dz0 + dz1) / 2);
    put(g, box(b - a, 0.03, 0.32), mat('walnut'), (a + b) / 2, 2.335, (dz0 + dz1) / 2);
  }
  wallBox(4.55, 4.75, dz1, 8.4);
  put(g, box(0.016, 0.08, 5.4), mat('walnut'), 4.542, F + 0.04, 5.7);
  put(g, box(0.016, 0.08, 5.4), mat('walnut'), 4.758, F + 0.04, 5.7);
  // glass partition lobby | pantry (x = -4.6)
  D(g, quad(5.4, CEIL - F), M.glass, -4.6, (F + CEIL) / 2, 5.7, 0, PI / 2, 0);
  for (let i = 0; i <= 4; i++) put(g, RB(0.06, CEIL - F, 0.06, 0.01, 1), M.alu, -4.6, (F + CEIL) / 2, 3.0 + i * 1.35);
  put(g, box(0.07, 0.06, 5.4), M.alu, -4.6, F + 0.03, 5.7);
  for (const y of [1.0, 1.06]) put(g, box(0.02, 0.025, 5.4), M.alu, -4.6, F + y, 5.7);
  solid(site, -4.6, 1.95, 5.7, 0.08, 3.6, 5.4);

  /* ---- lobby ---- */
  // logo wall (walnut slats on dark backing) + glowing logo
  D(g, quad(5.8, CEIL - F), M.backing, 0, (F + CEIL) / 2, dz1 + 0.002);
  for (let i = 0; i < 29; i++) put(g, RB(0.07, CEIL - F - 0.02, 0.05, 0.008, 1), mat('walnut'), -2.8 + i * 0.2, (F + CEIL) / 2, dz1 + 0.03);
  D(g, G.quad('logoWall', 3.3, 1.29), G.logoMat, 0, 2.55, dz1 + 0.062);
  put(g, RB(2.0, 0.012, 2.6, 0.004, 1), mat('carpetWarm'), 3.25, F + 0.006, 6.0);
  // pantry backsplash
  put(g, box(5.85, 0.7, 0.012), mat('wallTile'), -9.35, F + 1.27, dz1 + 0.006);
  // lobby ceiling light slots
  for (const sx of [-2.6, 0, 2.6]) D(g, box(0.07, 0.012, 5.0), mat('lampGlow'), sx, CEIL - 0.006, 5.75);
  // reception desk
  const rc = group(g, 0, F, 4.5, 0);
  put(rc, RB(3.4, 1.0, 0.12, 0.02, 2), mat('walnut'), 0, 0.5, 0.34);
  put(rc, RB(3.6, 0.045, 0.44, 0.015, 2), M.quartz, 0, 1.025, 0.24);
  D(rc, box(3.3, 0.012, 0.012), mat('lampGlow'), 0, 0.99, 0.43);
  for (const s of [-1, 1]) put(rc, RB(0.1, 1.0, 0.82, 0.02, 2), mat('walnut'), s * 1.65, 0.5, -0.02);
  put(rc, RB(3.2, 0.035, 0.6, 0.01, 2), mat('whiteWood'), 0, 0.73, -0.06);
  for (const s of [-1, 1]) put(rc, RB(0.5, 0.7, 0.52, 0.01, 2), cabinetPl(), s * 1.2, 0.36, -0.06);
  D(rc, G.quad('logoWall', 1.15, 0.45), G.logoMat, 0, 0.6, 0.405);
  monitor(rc, -0.5, 0.75, -0.2, 0.25, G, 'scr4', { w: 0.52, h: 0.3, ch: 0.3 });
  keyboard(rc, -0.45, 0.75, 0.05, 0.2, A);
  const ph = group(rc, 0.6, 0.75, -0.1, -0.3);
  put(ph, RB(0.2, 0.05, 0.22, 0.02, 1), blackPl(), 0, 0.025, 0);
  put(ph, RB(0.06, 0.035, 0.2, 0.015, 1), blackPl(), -0.06, 0.07, 0);
  mug(rc, 0.95, 0.75, 0.0, 0xffffff, 1);
  // flowers on the ledge
  const vase = group(rc, 1.25, 1.0475, 0.25, 0);
  put(vase, lathe([[0, 0], [0.05, 0], [0.065, 0.08], [0.04, 0.2], [0.035, 0.22], [0.0, 0.2]], 18), mat('ceramic'));
  for (let i = 0; i < 7; i++) { const a = i * 0.9; V(vase, CY(0.003, 0.003, 0.25, 5), 0x4c7a33, Math.sin(a) * 0.03, 0.3, Math.cos(a) * 0.03, Math.cos(a) * 0.2, 0, -Math.sin(a) * 0.2); V(vase, SP(0.03, 8, 6), [0xf4a6b8, 0xfff3e6, 0xf2c14e][i % 3], Math.sin(a) * 0.06, 0.43 + (i % 3) * 0.02, Math.cos(a) * 0.06); }
  paperStack(rc, -1.15, 1.0475, 0.25, 0.1, 4, A, 'doc2');
  solid(site, 0, 0.6, 4.5, 3.6, 1.2, 0.9);
  site.npcSpots.push({ pos: [0.35, F, 3.6], yaw: PI, pose: 'stand', role: 'receptionist' });
  // waiting sofa, table, art, plants, bench, kiosk, mat
  sofa(g, 4.07, F, 6.0, -PI / 2, { w: 2.3, fabric: mat('fabricBlue'), pillows: [0xe0b25a, 0xf1ece4, 0xc9805a] });
  solid(site, 4.07, 0.45, 6.0, 0.9, 0.9, 2.3);
  const ct = group(g, 2.95, F, 6.0, PI / 2);
  put(ct, RB(1.2, 0.04, 0.6, 0.015, 2), mat('walnut'), 0, 0.42, 0);
  put(ct, RB(1.1, 0.02, 0.5, 0.008, 1), mat('walnut'), 0, 0.12, 0);
  for (const sx of [-0.52, 0.52]) for (const sz of [-0.24, 0.24]) put(ct, CY(0.016, 0.016, 0.42, 8), mat('darkSteel'), sx, 0.21, sz);
  D(ct, A.quad('mag0', 0.21, 0.28).rotateX(-PI / 2), A.mat, -0.3, 0.442, 0.02, 0, 0.2, 0);
  D(ct, A.quad('mag1', 0.21, 0.28).rotateX(-PI / 2), A.mat, -0.08, 0.443, -0.03, 0, -0.15, 0);
  V(ct, box(0.21, 0.004, 0.28), 0xffffff, -0.3, 0.441, 0.02, 0, 0.2, 0);
  V(ct, box(0.21, 0.004, 0.28), 0xffffff, -0.08, 0.441, -0.03, 0, -0.15, 0);
  pottedPlant(ct, 0.35, 0.44, 0, { kind: 'bush', h: 0.3, potR: 0.08, potH: 0.12, pot: 'white', seed: 31 });
  V(ct, RB(0.24, 0.03, 0.17, 0.008, 1), 0x2a6f6a, -0.3, 0.145, 0.05, 0, 0.3, 0);
  V(ct, RB(0.22, 0.025, 0.16, 0.008, 1), 0xc9805a, -0.28, 0.172, 0.04, 0, 0.1, 0);
  solid(site, 2.95, 0.3, 6.0, 0.6, 0.6, 1.2);
  const art = group(g, 4.542, 2.1, 6.0, -PI / 2);
  put(art, RB(1.7, 1.2, 0.04, 0.008, 1), mat('walnut'), 0, 0, 0.02);
  D(art, A.quad('art', 1.6, 1.1), A.mat, 0, 0, 0.0405);
  pottedPlant(g, 4.05, F, 7.9, { kind: 'fig', h: 1.7, potR: 0.24, potH: 0.45, pot: 'white', seed: 11 });
  pottedPlant(g, -4.1, F, 7.95, { kind: 'snake', h: 0.95, potR: 0.2, potH: 0.4, pot: 'stone', seed: 12 });
  pottedPlant(g, -2.45, F, 3.45, { kind: 'snake', h: 0.8, potR: 0.17, potH: 0.36, pot: 'charcoal', seed: 13 });
  pottedPlant(g, 2.45, F, 3.45, { kind: 'snake', h: 0.85, potR: 0.17, potH: 0.36, pot: 'charcoal', seed: 14 });
  for (const [px, pz] of [[4.05, 7.9], [-4.1, 7.95], [-2.45, 3.45], [2.45, 3.45]]) solid(site, px, 0.5, pz, 0.45, 1.0, 0.45);
  const bench = group(g, -4.16, F, 6.0, PI / 2);
  for (let i = 0; i < 6; i++) put(bench, RB(2.0, 0.035, 0.06, 0.01, 1), mat('oak'), 0, 0.45, -0.19 + i * 0.076);
  for (const s of [-0.85, 0.85]) put(bench, RB(0.05, 0.43, 0.42, 0.01, 1), mat('darkSteel'), s, 0.215, 0);
  solid(site, -4.16, 0.25, 6.0, 0.5, 0.5, 2.0);
  const ki = group(g, -2.2, F, 7.55, 0.35);
  put(ki, RB(0.36, 0.04, 0.3, 0.01, 1), mat('darkSteel'), 0, 0.02, 0);
  put(ki, RB(0.07, 1.0, 0.07, 0.01, 1), mat('darkSteel'), 0, 0.5, 0);
  const kh = group(ki, 0, 1.08, 0.02, 0); kh.rotation.x = -0.5;
  put(kh, RB(0.3, 0.42, 0.04, 0.015, 1), blackPl(), 0, 0, 0);
  D(kh, G.quad('kiosk', 0.25, 0.354), G.mat, 0, 0, 0.0205);
  solid(site, -2.2, 0.6, 7.55, 0.35, 1.2, 0.35);
  put(g, RB(2.2, 0.012, 1.3, 0.004, 1), mat('carpet'), 0, F + 0.006, 7.65);

  /* ---- pantry / cafeteria (x -13.95..-4.6, z 3..8.4) ---- */
  const pc = group(g, -9.9, F, 3.36, 0);
  put(pc, RB(4.6, 0.84, 0.66, 0.015, 2), mat('oak'), 0, 0.43, -0.01);
  put(pc, RB(4.6, 0.06, 0.6, 0.01, 1), M.backing, 0, 0.03, -0.03);
  for (let i = 0; i < 6; i++) V(pc, box(0.004, 0.7, 0.004), 0x6b4a2e, -2.3 + (i + 0.5) * (4.6 / 6) + 0.38, 0.45, 0.322);
  put(pc, RB(4.7, 0.04, 0.72, 0.012, 2), M.quartz, 0, 0.87, 0.01);
  put(pc, RB(2.6, 0.02, 0.5, 0.006, 1), mat('steel'), 0.35, 0.895, 0.03);
  const foods = [[0xf4f1e8, 'rice'], [0xd9532f, 'kimchi'], [0x9a5a2e, 'pork'], [0x4f7f2e, 'greens']];
  foods.forEach(([col, kind], i) => {
    const fx = -0.6 + i * 0.63;
    put(pc, RB(0.58, 0.05, 0.38, 0.008, 1), mat('steel'), fx, 0.9, 0.03);
    V(pc, RB(0.54, 0.02, 0.34, 0.008, 1), col, fx, 0.925, 0.03);
    const R = rng(i + 50);
    for (let k = 0; k < 16; k++) {
      const px = fx + (R() - 0.5) * 0.46, pz = 0.03 + (R() - 0.5) * 0.28;
      if (kind === 'rice') V(pc, SP(0.03, 6, 4), 0xfaf8f0, px, 0.935, pz);
      else if (kind === 'kimchi') V(pc, RB(0.07, 0.015, 0.04, 0.006, 1), R() < 0.5 ? 0xe2552a : 0xf0e2b6, px, 0.94, pz, 0, R() * 3, R() * 0.4);
      else if (kind === 'pork') V(pc, RB(0.06, 0.018, 0.04, 0.008, 1), R() < 0.7 ? 0xa4532a : 0x6e8f3a, px, 0.942, pz, 0.3 * R(), R() * 3, 0);
      else V(pc, leafGeo(0.07, 0.02, 0.4, 0.2), 0x3e6e2a, px, 0.94, pz, 0, R() * 6, 0);
    }
    V(pc, CY(0.004, 0.005, 0.26, 6), 0xc9ccce, fx + 0.2, 0.98, 0.1, 0.9, 0.4, 0);
  });
  // sneeze guard
  D(pc, quad(2.6, 0.32), M.glass, 0.35, 1.22, 0.32, -0.35, 0, 0);
  for (const sx of [-0.95, 1.65]) put(pc, CY(0.012, 0.012, 0.42, 8), mat('chrome'), sx, 1.1, 0.25);
  // rice cooker, soup pot, trays, plates, cutlery
  const rck = group(pc, -1.85, 0.89, 0.02, 0);
  put(rck, CY(0.17, 0.16, 0.26, 24), whitePl(), 0, 0.13, 0);
  put(rck, CY(0.15, 0.17, 0.06, 24), mat('steel'), 0, 0.29, 0);
  put(rck, RB(0.08, 0.04, 0.05, 0.01, 1), blackPl(), 0, 0.18, 0.17);
  const sp = group(pc, -1.25, 0.89, 0.03, 0);
  put(sp, lathe([[0, 0], [0.17, 0], [0.18, 0.02], [0.18, 0.22], [0.172, 0.22], [0.168, 0.03], [0, 0.03]], 24), mat('steel'));
  V(sp, CY(0.166, 0.166, 0.01, 24), 0xc7883e, 0, 0.17, 0);
  put(sp, CY(0.004, 0.004, 0.36, 6), mat('steel'), 0.06, 0.32, 0, 0, 0, -0.45);
  for (let i = 0; i < 6; i++) V(pc, RB(0.4, 0.02, 0.3, 0.008, 1), i % 2 ? 0xc9b48f : 0xb79f78, 1.95, 0.9 + i * 0.022, 0.02);
  for (let i = 0; i < 8; i++) put(pc, CY(0.11, 0.08, 0.018, 24), mat('ceramic'), 1.95, 1.04 + i * 0.019, 0.02);
  put(pc, CY(0.05, 0.05, 0.14, 14), mat('steel'), 2.25, 0.96, -0.15);
  for (let i = 0; i < 9; i++) V(pc, CY(0.003, 0.003, 0.22, 4), 0xd8d8d6, 2.25 + Math.cos(i) * 0.025, 1.06, -0.15 + Math.sin(i) * 0.025, Math.cos(i) * 0.1, 0, Math.sin(i) * 0.1);
  solid(site, -9.9, 0.55, 3.36, 4.7, 1.1, 0.72);
  site.interactables.push({ id: 'lunch', label: '점심 먹기', pos: [-9.6, 1.2, 4.1], radius: 1.6 });
  // menu board (lit) + frame
  const mb = group(g, -9.6, 2.45, dz1, 0);
  put(mb, RB(2.2, 1.3, 0.05, 0.01, 1), mat('walnut'), 0, 0, 0.025);
  D(mb, G.quad('menuLit', 2.07, 1.24), G.mat, 0, 0, 0.0505);
  // fridge
  const fr = group(g, -13.47, F, 3.4, 0);
  put(fr, RB(0.86, 1.86, 0.74, 0.02, 2), mat('steel'), 0, 0.93, 0);
  V(fr, box(0.86, 0.008, 0.01), 0x55595e, 0, 1.25, 0.372);
  for (const hy of [[1.5, 0.36], [0.75, 0.6]]) put(fr, RB(0.03, hy[1], 0.03, 0.01, 1), mat('darkSteel'), 0.36, hy[0], 0.4);
  stickyNote(fr, A, 'sticky0', -0.15, 1.5, 0.372, 0, 0.05, 0.09);
  stickyNote(fr, A, 'sticky2', 0.08, 1.42, 0.372, 0, -0.08, 0.09);
  D(fr, A.quad('photo2', 0.16, 0.12), A.mat, -0.12, 1.0, 0.372, 0, 0, 0.06);
  solid(site, -13.47, 0.93, 3.4, 0.86, 1.86, 0.74);
  // coffee station
  const cs = group(g, -6.95, F, 3.33, 0);
  put(cs, RB(0.95, 0.84, 0.6, 0.015, 2), mat('whiteWood'), 0, 0.43, 0);
  put(cs, RB(1.0, 0.04, 0.64, 0.012, 2), M.quartz, 0, 0.87, 0.01);
  const cm = group(cs, -0.15, 0.89, -0.05, 0);
  put(cm, RB(0.36, 0.48, 0.4, 0.03, 2), blackPl(), 0, 0.24, 0);
  put(cm, RB(0.3, 0.2, 0.02, 0.01, 1), mat('steel'), 0, 0.33, 0.2);
  D(cm, G.quad('coffeeLcd', 0.1, 0.0625), G.mat, 0, 0.36, 0.2115);
  put(cm, RB(0.08, 0.05, 0.06, 0.01, 1), mat('steel'), 0, 0.2, 0.2);
  put(cm, RB(0.26, 0.015, 0.14, 0.004, 1), mat('steel'), 0, 0.02, 0.18);
  mug(cm, 0, 0.028, 0.18, 0xffffff, 0.5, false);
  for (let i = 0; i < 5; i++) V(cs, lathe([[0, 0], [0.03, 0], [0.04, 0.09], [0.037, 0.09], [0.027, 0.004], [0, 0.004]], 12), 0xf5f2ea, 0.28, 0.89 + i * 0.03, -0.12);
  V(cs, CY(0.06, 0.06, 0.16, 16), 0xb8865a, 0.3, 0.97, 0.1, 0, 0, 0, vcGloss());
  V(cs, CY(0.062, 0.062, 0.02, 16), 0x2b2b2b, 0.3, 1.06, 0.1);
  solid(site, -6.95, 0.55, 3.33, 1.0, 1.1, 0.64);
  // dining tables + chairs + pendants
  const tables = [[-11.6, 5.35], [-8.4, 5.35], [-11.6, 7.25], [-8.4, 7.25]];
  tables.forEach(([tx, tz], ti) => {
    const t = group(g, tx, F, tz, 0);
    put(t, RB(1.3, 0.04, 0.78, 0.012, 2), mat('oak'), 0, 0.735, 0);
    for (const sx of [-0.56, 0.56]) { put(t, RB(0.05, 0.7, 0.05, 0.01, 1), M.spandrel, sx, 0.36, 0); put(t, RB(0.06, 0.02, 0.6, 0.008, 1), M.spandrel, sx, 0.01, 0); }
    put(t, RB(1.06, 0.04, 0.04, 0.008, 1), M.spandrel, 0, 0.68, 0);
    const R = rng(ti + 70);
    for (const [cx, cz, ry] of [[-0.3, -0.62, 0], [0.3, -0.62, 0], [-0.3, 0.62, PI], [0.3, 0.62, PI]]) cafeChair(t, cx + (R() - 0.5) * 0.06, 0, cz + (R() - 0.5) * 0.06, ry + (R() - 0.5) * 0.25, ti);
    // napkins + vase
    V(t, RB(0.1, 0.09, 0.05, 0.01, 1), 0x2b2b2b, 0.0, 0.8, 0, 0, 0.3, 0);
    V(t, box(0.085, 0.06, 0.03), 0xffffff, 0, 0.86, 0, 0, 0.3, 0);
    if (ti === 0 || ti === 3) {
      lunchTray(t, -0.3, 0.755, -0.2, 0.1 * (ti - 1));
      lunchTray(t, 0.33, 0.755, 0.18, PI + 0.15, ti === 3);
    } else if (ti === 1) {
      mug(t, -0.35, 0.755, -0.15, 0xffffff, 1.2);
      mug(t, 0.4, 0.755, 0.2, 0x2f6f73, 2);
      V(t, CY(0.035, 0.03, 0.12, 12), 0xffffff, 0.15, 0.815, -0.12, 0, 0, 0, vcGloss());
    }
    solid(site, tx, 0.4, tz, 1.3, 0.8, 0.78);
    site.lamps.push({ pos: pendant(g, tx, 2.2, tz, CEIL, { r: 0.2, shade: 0x2f6f73 }), color: 0xffd9a8, intensity: 6, range: 6 });
  });
  pottedPlant(g, -5.1, F, 7.95, { kind: 'palm', h: 1.4, potR: 0.22, potH: 0.42, pot: 'white', seed: 21 });
  pottedPlant(g, -13.45, F, 7.95, { kind: 'fig', h: 1.5, potR: 0.22, potH: 0.42, pot: 'terracotta', seed: 22 });
  solid(site, -5.1, 0.5, 7.95, 0.45, 1.0, 0.45);
  solid(site, -13.45, 0.5, 7.95, 0.45, 1.0, 0.45);
  wallClock(g, -12.3, 2.75, dz1 + 0.001, 0, A, 0.18);

  /* ---- meeting room (x 4.75..13.95, z 3..8.4) ---- */
  const mt = meetingTable(g, 9.3, F, 5.7, { len: 4.4, wid: 1.3, A, G, chairs: 4, seed: 9, laptops: 1 });
  solid(site, 9.3, 0.4, 5.7, 4.4, 0.8, 1.3);
  wallScreen(g, 4.75, 1.75, 5.7, PI / 2, G, 'tvMeet', 2.2, 1.24);
  const cr = group(g, 4.98, F, 5.7, PI / 2);
  put(cr, RB(2.4, 0.62, 0.42, 0.015, 2), mat('walnut'), 0, 0.31, 0);
  V(cr, CY(0.07, 0.07, 0.03, 18), 0x2b2b2b, 0.8, 0.635, 0);
  pottedPlant(cr, -0.85, 0.62, 0, { kind: 'bush', h: 0.35, potR: 0.08, potH: 0.12, pot: 'white', seed: 41 });
  solid(site, 4.98, 0.35, 5.7, 0.45, 0.7, 2.4);
  pottedPlant(g, 13.4, F, 7.9, { kind: 'fig', h: 1.6, potR: 0.22, potH: 0.42, pot: 'stone', seed: 42 });
  pottedPlant(g, 5.75, F, -4.9, { kind: 'fig', h: 1.5, potR: 0.2, potH: 0.4, pot: 'white', seed: 43 });
  solid(site, 5.75, 0.5, -4.9, 0.4, 1.0, 0.4);
  for (const [px, sd] of [[-12.2, 71], [-10.1, 72], [-9.3, 73], [10.0, 74], [12.6, 75]]) pottedPlant(g, px, F + 2.0, -5.2, { kind: 'bush', h: 0.5, potR: 0.1, potH: 0.16, pot: [0xf1ece4, 0xb4623e, 0x3a3b3d][sd % 3], seed: sd });
  for (const [px, col] of [[-11.1, 0xe8dcc6], [11.2, 0x8fa3b1], [11.55, 0xd5c2a5]]) V(g, RB(0.32, 0.22, 0.3, 0.01, 1), col, px, F + 2.11, -5.2, 0, 0.1, 0);
  solid(site, 13.4, 0.5, 7.9, 0.45, 1.0, 0.45);
  for (const lx of [8.1, 10.5]) {
    put(g, CY(0.003, 0.003, 1.2, 4), blackPl(), lx - 0.5, CEIL - 0.6, 5.7);
    put(g, CY(0.003, 0.003, 1.2, 4), blackPl(), lx + 0.5, CEIL - 0.6, 5.7);
    put(g, RB(1.3, 0.05, 0.1, 0.02, 1), blackPl(), lx, CEIL - 1.2, 5.7);
    D(g, box(1.24, 0.006, 0.06), mat('lampGlow'), lx, CEIL - 1.226, 5.7);
  }
  site.lamps.push({ pos: [9.3, 2.4, 5.7], color: 0xfff1dc, intensity: 8, range: 7 });
  D(g, A.quad('roomA', 0.32, 0.09), A.mat, 11.9, 1.6, dz0 - 0.001, 0, PI, 0);
  // meeting room walls: framed print, felt panels, clock
  const mart = group(g, 8.2, 1.95, dz1, 0);
  put(mart, RB(1.75, 1.22, 0.04, 0.008, 1), mat('walnut'), 0, 0, 0.02);
  D(mart, A.quad('art', 1.64, 1.12), A.mat, 0, 0, 0.0405);
  [[10.6, 2.3, 0.6, 0.6, 0x2f6f73], [11.3, 2.45, 0.6, 0.9, 0xd9a441], [12.0, 2.2, 0.6, 0.6, 0x8fa98f], [10.6, 1.6, 0.6, 0.6, 0xb8a99a], [12.0, 1.75, 0.6, 0.3, 0x2f6f73]].forEach(([px, py, pw, phh, col]) => V(g, RB(pw, phh, 0.04, 0.015, 2), col, px, py, dz1 + 0.02, 0, 0, 0, vcSoft()));
  wallClock(g, 6.3, 2.75, dz1 + 0.001, 0, A, 0.17);
  void mt;

  /* ---- open office (z -5.4..2.7) ---- */
  const fab = M.fabricPart;
  const wings = [[-11.4, -9.8, -8.2, -6.6], [6.6, 8.2, 9.8, 11.4]];
  const jackets = [0x2b3a55, 0x5a4636, 0x3d4a3a, 0x7d6a52];
  let di = 0, ji = 0;
  const screens = ['scr0', 'scr1', 'scr2', 'scr3', 'scr4', 'scr5'];
  const occupied = new Set([0, 2, 3, 5, 6, 9, 11, 12, 14, 15]);
  for (const xs of wings) {
    const cx = (xs[0] + xs[3]) / 2;
    deskScreen(g, cx, F, -1.0, 6.4, fab);
    for (const ex of [xs[0] - 0.8, xs[3] + 0.8]) put(g, RB(0.034, 1.19, 1.6, 0.01, 1), fab, ex, F + 0.595, -1.0);
    solid(site, cx, 0.6, -1.0, 6.5, 1.2, 1.6);
    for (const x of xs) for (const side of [0, 1]) {
      const mine = x === 8.2 && side === 0;
      const dz = side === 0 ? -0.6 : -1.4, ry = side === 0 ? 0 : PI;
      workDesk(g, x, F, dz, ry, { A, G, seed: di + 3, mine, screen: mine ? 'scrMine' : screens[(di * 5 + 1) % 6] });
      const R = rng(di * 7 + 1);
      const cz = side === 0 ? dz + 0.62 : dz - 0.62;
      if (mine) {
        officeChair(g, x, F, cz + 0.06, ry + PI);
        const nb = group(g, x + 0.45, F + 0.74, dz + 0.28, 0);
        put(nb, RB(0.22, 0.07, 0.035, 0.008, 1), mat('walnut'), 0, 0.035, 0, -0.12, 0, 0);
        D(nb, A.quad('nameplate', 0.2, 0.056), A.mat, 0, 0.037, 0.0185, -0.12, 0, 0);
        // seat = eye of a person sitting in the chair, screen = lit face of the 0.70 x 0.40 monitor
        const scz = dz - 0.15 + 0.0135, eyeZ = dz + 0.47, scy = F + 0.74 + 0.39;
        const dist = eyeZ - scz;
        site.interactables.push({
          id: 'desk', label: '일하기', pos: [x, F + 1.15, dz + 0.45], radius: 1.4,
          seat: { pos: [x, scy + dist * Math.tan(0.05), eyeZ], yaw: 0, pitch: -0.05 },
          screen: { center: [x, scy, scz], w: 0.7, h: 0.4, yaw: 0 },
        });
      } else if (occupied.has(di)) {
        officeChair(g, x + (R() - 0.5) * 0.06, F, cz, ry + PI + (R() - 0.5) * 0.1);
        site.npcSpots.push({ pos: [x, F, cz], yaw: ry, pose: 'type', role: 'coworker' });
      } else {
        const jacket = R() < 0.75 ? jackets[ji++ % jackets.length] : null;
        officeChair(g, x + (R() - 0.5) * 0.3, F, cz + (side === 0 ? 0.15 : -0.15) + R() * 0.1 * (side === 0 ? 1 : -1), ry + PI + (R() - 0.5) * 0.9, { jacket });
      }
      if (di % 5 === 2) V(g, CY(0.13, 0.11, 0.32, 16), 0x5c6168, x - 0.55, F + 0.16, dz + (side === 0 ? -0.15 : 0.15));
      if (di === 7) V(g, RB(0.32, 0.42, 0.18, 0.07, 2), 0x2f3d55, x - 0.45, F + 0.21, dz + 0.1, 0.2, 0.4, 0, vcSoft());
      di++;
    }
  }
  // memos on screens
  stickyNote(g, A, 'sticky1', 7.6, F + 1.05, -0.982, 0, 0.1);
  stickyNote(g, A, 'sticky0', 10.3, F + 1.08, -0.982, 0, -0.06);
  stickyNote(g, A, 'sticky2', -9.5, F + 1.02, -1.018, PI, 0.05);
  // centre island with plants
  const is = group(g, 0, F, -1.0, 0);
  put(is, RB(3.0, 0.72, 0.52, 0.015, 2), mat('whiteWood'), 0, 0.37, 0);
  put(is, RB(3.06, 0.04, 0.58, 0.012, 2), mat('oak'), 0, 0.75, 0);
  for (let i = 0; i < 3; i++) { put(is, RB(0.5, 0.06, 0.06, 0.004, 1), mat('steel'), -1.0 + i * 1.0, 0.5, 0.265); }
  for (let i = 0; i < 3; i++) pottedPlant(is, -1.0 + i * 1.0, 0.77, 0, { kind: i === 1 ? 'snake' : 'bush', h: i === 1 ? 0.7 : 0.45, potR: 0.13, potH: 0.22, pot: 'charcoal', seed: 60 + i });
  binders(is, -0.45, 0.77, 0.05, 0, 3, rng(3));
  solid(site, 0, 0.45, -1.0, 3.06, 0.9, 0.58);
  // back wall: shelves, printer, restroom, water cooler, elevators, extinguisher, stairs, whiteboard
  const bz = -5.4;
  bookshelf(g, -11.6, F, bz + 0.2, 0, { w: 1.8, seed: 3 });
  bookshelf(g, -9.78, F, bz + 0.2, 0, { w: 1.8, seed: 8 });
  solid(site, -10.7, 1.0, bz + 0.2, 3.65, 2.0, 0.4);
  bookshelf(g, 10.4, F, bz + 0.2, 0, { w: 1.6, seed: 5, wood: mat('oak') });
  bookshelf(g, 12.05, F, bz + 0.2, 0, { w: 1.6, seed: 6, wood: mat('oak') });
  solid(site, 11.22, 1.0, bz + 0.2, 3.3, 2.0, 0.4);
  printer(g, -7.7, F, bz + 0.34, A, G);
  solid(site, -7.55, 0.5, bz + 0.34, 1.3, 1.0, 0.62);
  staticDoor(g, -5.75, F, bz, 0, { A, sign: 'wc' });
  waterCooler(g, -4.05, F, bz + 0.22);
  solid(site, -4.05, 0.7, bz + 0.22, 0.4, 1.4, 0.4);
  V(g, CY(0.17, 0.15, 0.5, 18), 0x2f6fb0, -3.45, F + 0.25, bz + 0.25);
  V(g, CY(0.17, 0.15, 0.5, 18), 0x3a8a4a, -3.05, F + 0.25, bz + 0.25);
  // elevator lobby wall
  // the left elevator (x -1.25) is a real one: an opening 1.2 x 2.3 in the wall, the game adds car and doors
  put(g, RB(0.75, CEIL - F, 0.05, 0.01, 1), mat('marble'), -2.225, (F + CEIL) / 2, bz + 0.025);
  put(g, RB(3.25, CEIL - F, 0.05, 0.01, 1), mat('marble'), 0.975, (F + CEIL) / 2, bz + 0.025);
  put(g, RB(1.2, CEIL - F - 2.3, 0.05, 0.01, 1), mat('marble'), -1.25, (F + 2.3 + CEIL) / 2, bz + 0.025);
  for (const sx of [-1, 1]) put(g, RB(0.09, 2.38, 0.12, 0.01, 1), mat('darkSteel'), -1.25 + sx * 0.645, F + 1.19, bz + 0.03);
  put(g, RB(1.38, 0.09, 0.12, 0.01, 1), mat('darkSteel'), -1.25, F + 2.345, bz + 0.03);
  for (const ex of [-1.25, 1.25]) {
    if (ex > 0) {
      put(g, RB(1.36, 2.42, 0.06, 0.01, 1), mat('darkSteel'), ex, F + 1.21, bz + 0.06);
      put(g, RB(0.56, 2.25, 0.03, 0.004, 1), mat('steel'), ex - 0.282, F + 1.125, bz + 0.09);
      put(g, RB(0.56, 2.25, 0.03, 0.004, 1), mat('steel'), ex + 0.282, F + 1.125, bz + 0.09);
    }
    put(g, RB(0.34, 0.12, 0.03, 0.01, 1), blackPl(), ex, F + 2.6, bz + 0.07);
    D(g, G.quad('elev', 0.28, 0.105), G.mat, ex, F + 2.6, bz + 0.0865);
  }
  // ---- office-worker routine: badge reader, coffee, team meeting, printer, the manager ----
  const rd = group(g, -2.3, F, 6.9, 0);
  put(rd, RB(0.16, 1.05, 0.12, 0.02, 1), mat('steel'), 0, 0.525, 0);
  put(rd, RB(0.3, 0.06, 0.4, 0.02, 1), mat('darkSteel'), 0, 0.03, 0);
  put(rd, RB(0.22, 0.3, 0.06, 0.02, 1), blackPl(), 0, 1.15, 0.02, -0.5, 0, 0);
  D(rd, box(0.13, 0.13, 0.005), glow(0x3aa0ff, 2.2), 0, 1.16, 0.055, -0.5, 0, 0);
  D(rd, box(0.16, 0.02, 0.005), glow(0x5aff9a, 1.6), 0, 1.04, 0.08, -0.5, 0, 0);
  solid(site, -2.3, 0.55, 6.9, 0.3, 1.1, 0.3);
  site.interactables.push({ id: 'badge', label: '사원증 찍기 (삑!)', pos: [-2.3, 1.2, 7.2], radius: 1.5 });
  site.interactables.push({ id: 'coffee', label: '커피 타기 ☕', pos: [-7.1, 1.25, 3.8], radius: 1.4 });
  site.interactables.push({
    id: 'teamMeeting', label: '팀 회의 하기', pos: [11.6, 1.2, 5.7], radius: 1.6,
    seat: { pos: [11.9, 1.3, 5.7], yaw: PI / 2, pitch: 0.02 },
    screen: { center: [4.79, 1.75, 5.7], w: 2.2, h: 1.24, yaw: PI / 2 },
  });
  site.interactables.push({ id: 'print', label: '보고서 출력하기', pos: [-7.6, 1.2, -4.4], radius: 1.4 });
  site.npcSpots.push({ pos: [7.8, F, -4.35], yaw: PI, pose: 'stand', role: 'boss' });
  site.interactables.push({ id: 'boss', label: '부장님께 결재 받기', pos: [7.8, 1.5, -3.6], radius: 1.6 });
  site.extra.elevator = { landings: [{ name: '1층 로비', pos: [-1.25, F, bz], yaw: 0 }, { name: '옥상 정원', pos: [-8.6, TOP, -3.3], yaw: 0 }] };
  put(g, RB(0.12, 0.26, 0.03, 0.01, 1), mat('steel'), 0, F + 1.15, bz + 0.065);
  for (const by of [0.06, -0.06]) D(g, CY(0.022, 0.022, 0.012, 14), mat('lampGlow'), 0, F + 1.15 + by, bz + 0.082, PI / 2, 0, 0);
  // extinguisher, stairs door + exit sign
  const fe = group(g, 3.3, F + 0.4, bz + 0.12, 0);
  V(fe, CY(0.075, 0.075, 0.42, 18), 0xc8282a, 0, 0.21, 0, 0, 0, 0, vcGloss());
  V(fe, SP(0.075, 18, 8), 0xc8282a, 0, 0.42, 0, 0, 0, 0, vcGloss());
  put(fe, RB(0.06, 0.1, 0.05, 0.01, 1), mat('chrome'), 0, 0.52, 0);
  V(fe, tube(new THREE.CatmullRomCurve3([new THREE.Vector3(0.03, 0.55, 0.02), new THREE.Vector3(0.1, 0.45, 0.05), new THREE.Vector3(0.09, 0.15, 0.05)]), 0.01, 10, 6), 0x1a1a1a);
  put(fe, RB(0.12, 0.2, 0.04, 0.01, 1), mat('darkSteel'), 0, 0.3, -0.09);
  staticDoor(g, 4.6, F, bz, 0, { leaf: metalGray(), frame: mat('darkSteel'), A, sign: 'stairs' });
  D(g, G.quad('exit', 0.36, 0.147), G.mat, 4.6, F + 2.55, bz + 0.012);
  // whiteboard
  const wb = group(g, 7.8, F + 1.6, bz + 0.012, 0);
  put(wb, RB(2.44, 1.24, 0.03, 0.01, 1), M.alu, 0, 0, 0.015);
  D(wb, A.quad('whiteboard', 2.38, 1.15), A.mat, 0, 0, 0.0305);
  put(wb, RB(0.9, 0.025, 0.07, 0.008, 1), M.alu, 0, -0.64, 0.05);
  [0x1f4fa8, 0xd33a2c, 0x1a1a1a].forEach((c, i) => V(wb, CY(0.009, 0.009, 0.13, 8), c, -0.3 + i * 0.12, -0.616, 0.055, 0, 0, PI / 2));
  V(wb, RB(0.14, 0.04, 0.05, 0.01, 1), 0x2b2b2b, 0.25, -0.61, 0.055);
  // front aisle wall (office face of the dividing wall, z = 2.7, faces -Z)
  const nb2 = group(g, -10.2, F + 1.55, dz0, PI);
  put(nb2, RB(1.6, 1.0, 0.04, 0.01, 1), mat('walnut'), 0, 0, 0.02);
  D(nb2, A.quad('notice', 1.5, 0.933), A.mat, 0, 0, 0.0405);
  D(g, A.quad('poster1', 0.6, 0.87), A.mat, -12.6, F + 1.6, dz0 - 0.002, 0, PI, 0);
  D(g, A.quad('calendar', 0.4, 0.507), A.mat, -7.6, F + 1.6, dz0 - 0.002, 0, PI, 0);
  D(g, A.quad('valuesWide', 2.4, 0.8), A.mat, 0, F + 1.75, dz0 - 0.002, 0, PI, 0);
  wallClock(g, 0, 3.0, dz0, PI, A, 0.2);
  D(g, A.quad('poster0', 0.6, 0.87), A.mat, 10.5, F + 1.6, dz0 - 0.002, 0, PI, 0);
  // coat hooks with coats + umbrella stand
  const ch = group(g, 6.6, F + 1.75, dz0, PI);
  put(ch, RB(1.4, 0.1, 0.03, 0.01, 1), mat('walnut'), 0, 0, 0.015);
  for (let i = 0; i < 5; i++) put(ch, CY(0.012, 0.012, 0.08, 8), mat('steel'), -0.56 + i * 0.28, 0, 0.06, PI / 2, 0, 0);
  for (const [cxp, col] of [[-0.28, 0x2b3a55], [0.28, 0xb08a5f]]) {
    V(ch, RB(0.44, 0.9, 0.13, 0.06, 2), col, cxp, -0.5, 0.1, 0.04, 0, 0, vcSoft());
    V(ch, RB(0.3, 0.12, 0.16, 0.05, 2), col, cxp, -0.04, 0.1, 0, 0, 0, vcSoft());
  }
  const us = group(g, 7.65, F, 2.45, 0);
  V(us, CY(0.12, 0.11, 0.45, 18), 0x3a3b3d, 0, 0.225, 0);
  V(us, CY(0.02, 0.06, 0.75, 10), 0x1d3557, 0.03, 0.42, 0.02, 0.1, 0, 0.08, vcSoft());
  V(us, CY(0.02, 0.06, 0.72, 10), 0xc0504d, -0.04, 0.4, -0.02, -0.08, 0, -0.1, vcSoft());
  // plants near the side windows
  for (const [px, pz, k, sd] of [[-13.3, -1.0, 'fig', 51], [13.3, -1.0, 'palm', 52], [-13.3, -4.85, 'snake', 53], [13.35, -4.85, 'fig', 54], [-5.3, 2.35, 'snake', 55]]) {
    pottedPlant(g, px, F, pz, { kind: k, h: k === 'snake' ? 0.9 : 1.6, potR: 0.22, potH: 0.42, pot: k === 'fig' ? 'white' : 'stone', seed: sd });
    solid(site, px, 0.5, pz, 0.45, 1.0, 0.45);
  }
  // ceiling light panels
  for (let ix = 0; ix < 11; ix++) for (const pz of [-4.0, -1.0, 1.7]) D(g, RB(1.2, 0.02, 0.3, 0.004, 1), mat('coolGlow'), -12 + ix * 2.4, CEIL - 0.008, pz);
  for (const [px, pz] of [[-11.2, 3.9], [-8.2, 3.9]]) D(g, RB(1.2, 0.02, 0.3, 0.004, 1), mat('coolGlow'), px, CEIL - 0.008, pz);
  // lamp anchors
  for (const [lx, lz] of [[-9, -1], [9, -1], [-9, -4], [9, -4], [0, -3], [0, 1.4], [-9, 1.8], [9, 1.8]]) site.lamps.push({ pos: [lx, 3.4, lz], color: 0xf2f5ff, intensity: 9, range: 9 });
  site.lamps.push({ pos: [0, 3.4, 5.4], color: 0xffe9cc, intensity: 9, range: 9 });
  site.lamps.push({ pos: [-10.2, 3.0, 4.1], color: 0xffe2b8, intensity: 6, range: 6 });
  // standing coworkers
  site.npcSpots.push({ pos: [-7.7, F, bz + 1.05], yaw: 0, pose: 'stand', role: 'coworker' });
  site.npcSpots.push({ pos: [-3.7, F, bz + 0.95], yaw: 0.6, pose: 'stand', role: 'coworker' });
}

/** Café chair (oak shell on black legs), sitter faces +Z. */
export function cafeChair(parent, x, y, z, ry, seed = 0) {
  const g = group(parent, x, y, z, ry);
  const leg = blackPl();
  const wood = seed % 2 ? mat('oak') : mat('birch');
  put(g, RB(0.42, 0.03, 0.41, 0.012, 2), wood, 0, 0.455, 0);
  for (const sx of [-0.17, 0.17]) for (const sz of [-0.16, 0.16]) put(g, CY(0.012, 0.01, 0.45, 8), leg, sx, 0.225, sz, sz * 0.25, 0, -sx * 0.25);
  for (const sx of [-0.15, 0.15]) put(g, CY(0.01, 0.01, 0.33, 6), leg, sx, 0.62, -0.19, -0.12, 0, 0);
  const b = group(g, 0, 0.76, -0.215, 0); b.rotation.x = -0.14;
  put(b, RB(0.4, 0.17, 0.025, 0.012, 2), wood, 0, 0, 0);
  return g;
}

/** Cafeteria tray with rice, soup, side dishes, spoon and chopsticks. */
export function lunchTray(parent, x, y, z, ry, eaten = false) {
  const g = group(parent, x, y, z, ry);
  V(g, RB(0.4, 0.016, 0.3, 0.006, 1), 0xb9a07a, 0, 0.008, 0);
  const bowl = (bx, bz, r, col, fill = 0.7) => {
    put(g, lathe([[0, 0], [r * 0.6, 0], [r, r * 0.75], [r * 0.95, r * 0.78], [r * 0.56, r * 0.06], [0, r * 0.06]], 18), mat('ceramic'), bx, 0.016, bz);
    V(g, CY(r * (0.55 + fill * 0.4), r * (0.55 + fill * 0.4), 0.004, 16), col, bx, 0.016 + r * 0.75 * fill, bz);
  };
  bowl(-0.1, 0.06, 0.065, 0xf6f3ea, eaten ? 0.3 : 0.85);
  bowl(0.08, 0.06, 0.07, 0xb5793e, eaten ? 0.35 : 0.75);
  bowl(-0.12, -0.08, 0.045, 0xd9532f, 0.6);
  bowl(0.02, -0.08, 0.045, 0x4f7f2e, 0.6);
  bowl(0.13, -0.08, 0.045, 0xf2c14e, eaten ? 0.2 : 0.6);
  for (const dx of [0, 0.012]) V(g, box(0.005, 0.005, 0.22), 0xc9ccce, 0.18 + dx, 0.02, 0.0);
  V(g, box(0.02, 0.004, 0.18), 0xc9ccce, 0.16, 0.02, 0.01);
  return g;
}

/** Multifunction printer + paper reams, front at +Z. */
export function printer(parent, x, y, z, A, G) {
  const g = group(parent, x, y, z, 0);
  const lg = whitePl(), dg = paint(0x2a2f35, 0.42, 0.55);
  put(g, RB(0.64, 0.26, 0.6, 0.02, 2), dg, 0, 0.13, 0);
  put(g, RB(0.64, 0.5, 0.6, 0.02, 2), lg, 0, 0.51, 0);
  for (const gy of [0.36, 0.5, 0.64]) V(g, box(0.6, 0.006, 0.004), 0x9b9b96, 0, gy, 0.301);
  for (const gy of [0.43, 0.57]) put(g, RB(0.16, 0.02, 0.02, 0.008, 1), dg, 0, gy, 0.31);
  put(g, RB(0.6, 0.1, 0.48, 0.015, 2), lg, 0, 0.82, -0.04);
  V(g, box(0.5, 0.06, 0.4), 0x3a3d42, 0, 0.75, 0.08);
  for (let i = 0; i < 6; i++) V(g, box(0.21, 0.002, 0.297), 0xfbfbf8, 0.02, 0.73 + i * 0.003, 0.12, 0, (i - 3) * 0.02, 0);
  const cp = group(g, 0.18, 0.88, 0.22, 0); cp.rotation.x = -0.6;
  put(cp, RB(0.3, 0.03, 0.14, 0.01, 1), dg, 0, 0, 0);
  D(cp, G.quad('printerLcd', 0.12, 0.072).rotateX(-PI / 2), G.mat, -0.04, 0.0155, 0);
  for (let i = 0; i < 3; i++) { V(g, RB(0.3, 0.07, 0.22, 0.006, 1), 0xf7f6f1, 0.62, 0.035 + i * 0.072, 0.0, 0, i * 0.08, 0); V(g, box(0.302, 0.02, 0.222), 0x2a9d8f, 0.62, 0.035 + i * 0.072, 0.0, 0, i * 0.08, 0); }
  V(g, CY(0.17, 0.15, 0.48, 18), 0x2f6fb0, -0.6, 0.24, 0.05);
  return g;
}

/** Water cooler with a jug on top and a cup dispenser. */
export function waterCooler(parent, x, y, z) {
  const g = group(parent, x, y, z, 0);
  put(g, RB(0.32, 1.0, 0.34, 0.025, 2), whitePl(), 0, 0.5, 0);
  V(g, box(0.22, 0.22, 0.02), 0x3a3d42, 0, 0.82, 0.165);
  V(g, CY(0.012, 0.012, 0.05, 8), 0xd9534f, -0.05, 0.86, 0.18, PI / 2, 0, 0);
  V(g, CY(0.012, 0.012, 0.05, 8), 0x2b6cb0, 0.05, 0.86, 0.18, PI / 2, 0, 0);
  put(g, RB(0.22, 0.02, 0.1, 0.006, 1), mat('steel'), 0, 0.71, 0.17);
  const jug = put(g, lathe([[0.03, 0.0], [0.05, 0.04], [0.13, 0.08], [0.135, 0.38], [0.12, 0.44], [0.0, 0.46]], 24), bottleWaterMat(), 0, 1.0, 0);
  jug.castShadow = false;
  put(g, CY(0.025, 0.025, 0.4, 12), whitePl(), 0.21, 0.75, 0.0);
  return g;
}

/* ============================================================== entry point */
export function buildOffice() {
  const site = makeSite('office', 30, 22);
  const g = site.group;
  const M = officeMats();
  const { A, G } = officeAtlas();
  buildExterior(site, g, M, G);
  buildInterior(site, g, M, A, G);
  site.nightGlow.push(G.bdLit, M.strip, M.ceilLit);
  site.spawn = { pos: [0, 0.04, 10.6], yaw: 0 };
  site.extra.logo = 'SEONN';
  bake(g);
  return site;
}
