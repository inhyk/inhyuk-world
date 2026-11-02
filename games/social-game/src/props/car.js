// Cars. The body is lofted from smooth side/plan profiles (filleted cross-sections, real wheel arches,
// open cabin), the glass house is a second loft whose cells are split into glass, pillars, roof and trim
// along grid lines, and small parts (lamps, grille, plates, seams) are shrink-wrapped onto the body.
// Origin at the ground centre, forward = -Z, driver on the left (-X). One template per style is built
// once and cloned (shared geometry); paint, lamp and plate materials are per car.
import * as THREE from 'three';
import { mergeVertices, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat, paint, glow } from '../mat.js';
import { canvasTex, FONT } from '../tex.js';
import { rbox, cyl, sphere, torus, lathe, tube, quad, prep, put, group, bake } from '../geom.js';
import { rng } from '../noise.js';

const PI = Math.PI;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const se = (t, n) => Math.pow(1 - Math.pow(1 - clamp(t, 0, 1), n), 1 / n);
const bez = (a, c, b, t) => { const u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; };

/** Smooth monotone cubic through [[x, y], ...] (sorted by x). */
function curve(pts) {
  const n = pts.length, xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// ------------------------------------------------------------------------------------------ styles
// top: hull top-centre height along z (hood, belt, deck). bot: underside. rp/np: plan rounding of
// nose/tail. cab: glass house (z0..z1 base, zRF/zRR roof edges, top: roof line, 0 = sits on the belt).
// seat: front H-point [z, y]. driverX: seat centre.
const STYLES = {
  sedan: {
    L: 4.62, W: 1.82, R: 0.335, tyreW: 0.215, axles: [-1.4, 1.36], waist: 0.6, tumble: 0.05, tuck: 0.04, crown: 0.03, rs: 0.075,
    top: [[-2.31, 0.64], [-2.26, 0.71], [-2.12, 0.765], [-1.75, 0.82], [-1.2, 0.87], [-0.95, 0.9], [-0.5, 0.95], [0.6, 0.975], [1.55, 1.0], [1.95, 0.995], [2.2, 0.96], [2.31, 0.88]],
    bot: [[-2.31, 0.4], [-2.2, 0.3], [-1.95, 0.25], [1.95, 0.25], [2.18, 0.32], [2.31, 0.44]],
    rp: [0.6, 0.5], np: [2.4, 2.6],
    cab: { z0: -0.95, z1: 1.55, zRF: -0.2, zRR: 0.92, roofHW: 0.64, crown: 0.045, rc: 0.1, tumble: 0.26,
      top: [[-0.95, 0], [-0.58, 1.18], [-0.2, 1.425], [0.36, 1.455], [0.92, 1.425], [1.24, 1.25], [1.55, 0]],
      sideEnd: 1.2, pillars: [[0.2, 0.31, 'trim']] },
    seat: [0.18, 0.5], rear: [0.98, 0.5], floor: 0.31, driverX: 0.37,
  },
  hatch: {
    L: 4.14, W: 1.78, R: 0.325, tyreW: 0.205, axles: [-1.27, 1.33], waist: 0.6, tumble: 0.05, tuck: 0.04, crown: 0.03, rs: 0.075,
    top: [[-2.07, 0.6], [-2.02, 0.69], [-1.88, 0.755], [-1.5, 0.82], [-1.0, 0.875], [-0.78, 0.905], [0, 0.96], [1.0, 0.99], [1.7, 1.0], [1.95, 0.97], [2.07, 0.87]],
    bot: [[-2.07, 0.44], [-1.96, 0.32], [-1.72, 0.25], [1.72, 0.25], [1.94, 0.33], [2.07, 0.48]],
    rp: [0.55, 0.32], np: [2.4, 3.4],
    cab: { z0: -0.78, z1: 1.9, zRF: 0.0, zRR: 1.5, roofHW: 0.62, crown: 0.045, rc: 0.1, tumble: 0.26,
      top: [[-0.78, 0], [-0.4, 1.22], [0.0, 1.455], [0.8, 1.49], [1.5, 1.46], [1.74, 1.3], [1.9, 0]],
      sideEnd: 1.6, pillars: [[0.32, 0.43, 'trim'], [1.2, 1.3, 'paint']] },
    seat: [0.2, 0.52], rear: [1.0, 0.52], floor: 0.31, driverX: 0.36,
  },
  suv: {
    L: 4.72, W: 1.9, R: 0.37, tyreW: 0.235, axles: [-1.42, 1.43], waist: 0.7, tumble: 0.05, tuck: 0.04, crown: 0.03, rs: 0.08,
    top: [[-2.36, 0.74], [-2.31, 0.84], [-2.17, 0.92], [-1.8, 0.99], [-1.2, 1.05], [-0.9, 1.08], [0, 1.12], [1.2, 1.14], [2.05, 1.15], [2.26, 1.1], [2.36, 1.0]],
    bot: [[-2.36, 0.54], [-2.22, 0.4], [-1.95, 0.32], [1.95, 0.32], [2.2, 0.41], [2.36, 0.56]],
    rp: [0.55, 0.4], np: [2.6, 3.2],
    cab: { z0: -0.9, z1: 2.17, zRF: -0.12, zRR: 1.86, roofHW: 0.7, crown: 0.04, rc: 0.1, tumble: 0.2,
      top: [[-0.9, 0], [-0.52, 1.43], [-0.12, 1.665], [0.8, 1.7], [1.86, 1.68], [2.04, 1.5], [2.17, 0]],
      sideEnd: 2.0, pillars: [[0.3, 0.43, 'trim'], [1.38, 1.5, 'trim']] },
    seat: [0.1, 0.66], rear: [0.95, 0.66], floor: 0.42, driverX: 0.38, cladding: true, rails: true, lampH: 0.1,
  },
  van: {
    L: 4.96, W: 1.92, R: 0.345, tyreW: 0.225, axles: [-1.56, 1.5], waist: 0.66, tumble: 0.04, tuck: 0.04, crown: 0.03, rs: 0.08,
    top: [[-2.48, 0.72], [-2.43, 0.83], [-2.32, 0.93], [-2.12, 1.0], [-1.95, 1.04], [-1.6, 1.07], [0, 1.1], [2.2, 1.12], [2.4, 1.08], [2.48, 0.98]],
    bot: [[-2.48, 0.5], [-2.36, 0.36], [-2.12, 0.27], [2.1, 0.27], [2.34, 0.36], [2.48, 0.5]],
    rp: [0.5, 0.3], np: [2.6, 3.6],
    cab: { z0: -1.95, z1: 2.44, zRF: -1.18, zRR: 2.3, roofHW: 0.77, crown: 0.04, rc: 0.11, tumble: 0.12,
      top: [[-1.95, 0], [-1.58, 1.47], [-1.18, 1.86], [0.5, 1.95], [2.3, 1.93], [2.38, 1.62], [2.44, 0]],
      sideEnd: 2.32, pillars: [[-0.72, -0.6, 'trim'], [0.62, 0.74, 'trim'], [1.66, 1.78, 'trim']] },
    seat: [-0.74, 0.7], rear: [0.3, 0.7], floor: 0.42, driverX: 0.4, slide: true, lampH: 0.11, tailH: 0.17,
  },
};
STYLES.taxi = { ...STYLES.sedan, taxi: true };

// ------------------------------------------------------------------------------------------ shape
/** Analytic body description for a style: hull and glass-house cross sections plus surface solvers. */
function makeShape(S) {
  const top = curve(S.top), bot = curve(S.bot);
  const zF = -S.L / 2, zR = S.L / 2, W2 = S.W / 2;
  const trackHalf = W2 - S.tyreW / 2 - 0.035;
  const xWell0 = trackHalf - S.tyreW / 2 - 0.05;
  const Ra = S.R + 0.05, yw = S.R + 0.012;
  const hw = (z) => {
    let k = 1;
    const dF = z - zF, dR = zR - z;
    if (dF < S.rp[0]) k = Math.min(k, se(dF / S.rp[0], S.np[0]));
    if (dR < S.rp[1]) k = Math.min(k, se(dR / S.rp[1], S.np[1]));
    return W2 * k;
  };
  const yLow = (z) => {
    let y = bot(z);
    for (const a of S.axles) {
      const dz = z - a;
      if (Math.abs(dz) < Ra) y = Math.max(y, yw + Math.sqrt(Ra * Ra - dz * dz));
    }
    return y;
  };
  const archy = (z) => yLow(z) > bot(z) + 1e-4;
  // half contour of the hull at z, from the bottom centre round the right side to the top centre.
  // labels per segment: L liner, P paint, O open top (removed inside the cabin), A top-outer paint
  function hull(z) {
    const yb = bot(z), yt = top(z), h = hw(z), s = h / W2;
    const yl = yLow(z);
    const crown = S.crown * s;
    const topY = (x) => yt - crown * (x / Math.max(h, 1e-3)) ** 2;
    const yW = Math.min(S.waist, lerp(yb, yt, 0.55));
    const ySh0 = yt - crown;
    const xSide = (y) => {
      if (y >= yW) return h - S.tumble * s * ((y - yW) / Math.max(ySh0 - yW, 1e-3)) ** 2;
      return h - S.tuck * s * ((yW - y) / Math.max(yW - yb, 1e-3)) ** 2;
    };
    const rb = lerp(0.06, 0.022, sstep(0, 0.04, yl - yb)) * Math.min(1, s * 1.5);
    const rs = Math.min(S.rs, (ySh0 - yl) * 0.45) * Math.min(1, s * 1.5 + 0.2);
    const xS = xSide(ySh0), ySh = topY(xS);
    const xC = Math.max(xSide(yl) - rb, 0);
    const xW = Math.min(xWell0 * Math.min(1, s * 1.2), xC * 0.96);
    const pts = [], lab = [];
    const add = (p, l) => { pts.push(p); if (l) lab.push(l); };
    add([0, yb]);
    add([xW * 0.5, yb], 'L'); add([xW, yb], 'L');
    add([xW, lerp(yb, yl, 0.5)], 'L'); add([xW, yl], 'L');
    add([lerp(xW, xC, 0.5), yl], 'L'); add([xC, yl], 'L');
    const a = [xC, yl], c = [xSide(yl), yl], b = [xSide(yl + rb), yl + rb];
    for (let i = 1; i <= 3; i++) add(bez(a, c, b, i / 3), 'P');
    const y0 = yl + rb, y1 = Math.max(ySh - rs, y0 + 0.002);
    for (let i = 1; i <= 7; i++) { const y = lerp(y0, y1, i / 7); add([xSide(y), y], 'P'); }
    const xe = Math.max(xS - rs * 1.25, 0.02);
    const fa = [xSide(y1), y1], fc = [xS, ySh], fb = [xe, topY(xe)];
    for (let i = 1; i <= 4; i++) add(bez(fa, fc, fb, i / 4), 'P');
    const xL = Math.max(xe - 0.012, 0.01);
    add([xL, topY(xL)], 'A');
    for (let i = 1; i <= 5; i++) { const x = xL * (1 - i / 5); add([x, topY(x)], 'O'); }
    return { pts, lab, xL, yB: topY(xL), xSide, topY, yl, yb, yt, xW, h };
  }
  // glass house half contour at z (inside z0..z1), from the right base up to the roof centre.
  const C = S.cab;
  const roofLine = curve(C.top.map(([z, y]) => [z, y || hull(z).yB]));
  function house(z) {
    const H = hull(z);
    const xB = H.xL, yB = H.yB - 0.004;
    const yT = Math.max(roofLine(z), yB + 1e-3);
    const h = yT - yB;
    const crown = C.crown * sstep(0, 0.22, h);
    const xK = xB - C.tumble * h;
    const yK = Math.max(yT - crown * (xK / C.roofHW) ** 2, yB + 1e-3);
    const sideLen = Math.hypot(xB - xK, yK - yB);
    const rc = Math.min(C.rc, sideLen * 0.45, xK * 0.3);
    const dir = [(xK - xB) / (sideLen || 1), (yK - yB) / (sideLen || 1)];
    const p1 = [xK - dir[0] * rc, yK - dir[1] * rc];
    const x2 = xK - rc * 1.1, p2 = [x2, Math.max(yT - crown * (x2 / C.roofHW) ** 2, yB + 1e-3)];
    const pts = [], lab = [];
    const ts = [0, 0.045, 0.36, 0.68, 0.94, 1];
    for (let i = 0; i < ts.length; i++) {
      pts.push([lerp(xB, p1[0], ts[i]), lerp(yB, p1[1], ts[i])]);
      if (i) lab.push(i === 1 ? 'S0' : i === ts.length - 1 ? 'S9' : 'S');
    }
    for (let i = 1; i <= 4; i++) { pts.push(bez(p1, [xK, yK], p2, i / 4)); lab.push(i <= 2 ? 'C' : 'Cb'); }
    for (let i = 1; i <= 6; i++) { const x = x2 * (1 - i / 6); pts.push([x, Math.max(yT - crown * (x / C.roofHW) ** 2, yB + 1e-3)]); lab.push('T'); }
    return { pts, lab, yT, yB, xB };
  }
  // surface solvers (right side; callers mirror x)
  const sideX = (z, y) => { // outer x of the hull at height y, or -1
    const { pts, lab } = hull(z);
    for (let i = 6; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (lab[i] === 'O') break;
      if ((y - a[1]) * (y - b[1]) <= 0 && a[1] !== b[1]) return lerp(a[0], b[0], (y - a[1]) / (b[1] - a[1]));
    }
    return -1;
  };
  const topY = (x, z) => hull(z).topY(Math.abs(x));
  const solveEnd = (front, x, y) => {
    let lo = front ? zF : zR, hi = front ? S.axles[0] - Ra - 0.02 : S.axles[1] + Ra + 0.02;
    for (let i = 0; i < 18; i++) {
      const m = (lo + hi) / 2;
      if (sideX(m, y) >= Math.abs(x)) hi = m; else lo = m;
    }
    return (lo + hi) / 2;
  };
  return { S, C, top, bot, hw, yLow, archy, hull, house, roofLine, sideX, topY, solveEnd, zF, zR, W2, trackHalf, xWell0, Ra, yw };
}

// ------------------------------------------------------------------------------------------ geometry tools
/** Loft rows (arrays of [x,y,z]) into a grid; cellMat(i, k) → material key or null; returns {key: geometry}. */
function loft(rows, cellMat, { flip = false, closed = false, offset = 0 } = {}) {
  const nr = rows.length, nc = rows[0].length;
  const pos = new Float32Array(nr * nc * 3);
  rows.forEach((r, i) => r.forEach((p, k) => pos.set(p, (i * nc + k) * 3)));
  const idxAll = [], cells = new Map();
  const segs = closed ? nc : nc - 1;
  for (let i = 0; i < nr - 1; i++) {
    for (let k = 0; k < segs; k++) {
      const k1 = (k + 1) % nc;
      const a = i * nc + k, b = (i + 1) * nc + k, c = (i + 1) * nc + k1, d = i * nc + k1;
      const tri = flip ? [a, d, c, a, c, b] : [a, b, c, a, c, d];
      idxAll.push(...tri);
      const key = cellMat(i, k);
      if (key) { if (!cells.has(key)) cells.set(key, []); cells.get(key).push(...tri); }
    }
  }
  const base = new THREE.BufferGeometry();
  base.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  base.setIndex(idxAll);
  base.computeVertexNormals();
  const nor = base.attributes.normal;
  if (offset) for (let i = 0; i < pos.length / 3; i++) for (let j = 0; j < 3; j++) pos[i * 3 + j] += nor.array[i * 3 + j] * offset;
  const out = {};
  for (const [key, idx] of cells) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor.array.slice(), 3));
    g.setIndex(idx);
    out[key] = prep(g);
  }
  return out;
}

/** Longest-edge bisection until every edge is shorter than maxLen (non-indexed, position + optional uv). */
function subdivide(g, maxLen) {
  const P = g.attributes.position.array, U = g.attributes.uv?.array;
  const outP = [], outU = [];
  const stack = [];
  for (let t = 0; t < P.length / 9; t++) {
    const tri = [], uv = [];
    for (let v = 0; v < 3; v++) { tri.push([P[t * 9 + v * 3], P[t * 9 + v * 3 + 1], P[t * 9 + v * 3 + 2]]); if (U) uv.push([U[t * 6 + v * 2], U[t * 6 + v * 2 + 1]]); }
    stack.push([tri, uv]);
  }
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2; // in-plane only (z is the extrude depth)
  const mid = (a, b) => a.map((x, i) => (x + b[i]) / 2);
  let guard = 0;
  while (stack.length && guard++ < 200000) {
    const [t, u] = stack.pop();
    const e = [d2(t[0], t[1]), d2(t[1], t[2]), d2(t[2], t[0])];
    const m = e[0] >= e[1] && e[0] >= e[2] ? 0 : e[1] >= e[2] ? 1 : 2;
    if (e[m] <= maxLen * maxLen) { for (let v = 0; v < 3; v++) { outP.push(...t[v]); if (U) outU.push(...u[v]); } continue; }
    const i0 = m, i1 = (m + 1) % 3, i2 = (m + 2) % 3;
    const pm = mid(t[i0], t[i1]), um = U ? mid(u[i0], u[i1]) : null;
    stack.push([[t[i0], pm, t[i2]], U ? [u[i0], um, u[i2]] : []]);
    stack.push([[pm, t[i1], t[i2]], U ? [um, u[i1], u[i2]] : []]);
  }
  const o = new THREE.BufferGeometry();
  o.setAttribute('position', new THREE.Float32BufferAttribute(outP, 3));
  if (U) o.setAttribute('uv', new THREE.Float32BufferAttribute(outU, 2));
  return o;
}

/**
 * Shrink-wrap a flat 2D shape onto the body. proj(u, v) → {p, n} (surface point and outward normal).
 * The shape is extruded with depth 1; local z 0..1 maps to an offset lo..hi along the normal.
 */
function conform(shape, proj, lo, hi, { maxLen = 0.05, uvRect = null, crease = 0.75, curveSegments = 4 } = {}) {
  let g = shape.isBufferGeometry ? shape : new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments });
  if (g.index) g = g.toNonIndexed();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (!g.attributes.normal) g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
  g.deleteAttribute('normal');
  if (uvRect) {
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - uvRect[0]) / uvRect[2], (p.getY(i) - uvRect[1]) / uvRect[3]);
  } else g.deleteAttribute('uv');
  // drop the hidden back cap (local z = 0 on all three corners)
  {
    const p = g.attributes.position.array, U = g.attributes.uv?.array, keepP = [], keepU = [];
    for (let t = 0; t < p.length / 9; t++) {
      if (p[t * 9 + 2] < 1e-6 && p[t * 9 + 5] < 1e-6 && p[t * 9 + 8] < 1e-6) continue;
      for (let j = 0; j < 9; j++) keepP.push(p[t * 9 + j]);
      if (U) for (let j = 0; j < 6; j++) keepU.push(U[t * 6 + j]);
    }
    const h = new THREE.BufferGeometry();
    h.setAttribute('position', new THREE.Float32BufferAttribute(keepP, 3));
    if (U) h.setAttribute('uv', new THREE.Float32BufferAttribute(keepU, 2));
    g = h;
  }
  g = subdivide(g, maxLen);
  const p = g.attributes.position, cache = new Map(), ts = new Float32Array(p.count), ns = [];
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i), v = p.getY(i), t = p.getZ(i);
    const key = u.toFixed(5) + ',' + v.toFixed(5);
    let s = cache.get(key);
    if (!s) { s = proj(u, v); cache.set(key, s); }
    const o = lerp(lo, hi, t);
    ts[i] = t; ns.push(s.n);
    p.setXYZ(i, s.p[0] + s.n[0] * o, s.p[1] + s.n[1] * o, s.p[2] + s.n[2] * o);
  }
  // the (u, v, normal) frame can be left-handed: make the top cap face outwards
  let dot = 0;
  const A = new THREE.Vector3(), Bv = new THREE.Vector3(), Cv = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    if (ts[i] < 0.999 || ts[i + 1] < 0.999 || ts[i + 2] < 0.999) continue;
    A.fromBufferAttribute(p, i); Bv.fromBufferAttribute(p, i + 1).sub(A); Cv.fromBufferAttribute(p, i + 2).sub(A);
    Bv.cross(Cv);
    dot += Bv.x * ns[i][0] + Bv.y * ns[i][1] + Bv.z * ns[i][2];
  }
  if (dot < 0) flipWinding(g);
  g = toCreasedNormals(g, crease);
  return prep(g, !!uvRect);
}

/** Projectors onto the hull: front/rear (u = x, v = y), side (u = z, v = y, sign = ±1), top (u = x, v = z). */
function projectors(B) {
  const e = 0.004;
  const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const make = (fn, out) => { const cache = new Map(); return (u, v) => {
    const key = u.toFixed(5) + ',' + v.toFixed(5);
    const hit = cache.get(key);
    if (hit) return hit;
    const p = fn(u, v), pu = fn(u + e, v), pv = fn(u, v + e);
    let n = norm3(cross([pu[0] - p[0], pu[1] - p[1], pu[2] - p[2]], [pv[0] - p[0], pv[1] - p[1], pv[2] - p[2]]));
    if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) n = n.map((x) => -x);
    const r = { p, n };
    cache.set(key, r);
    return r;
  }; };
  return {
    front: make((x, y) => [x, y, B.solveEnd(true, x, y)], [0, 0, -1]),
    rear: make((x, y) => [x, y, B.solveEnd(false, x, y)], [0, 0, 1]),
    side: (() => { const L = make((z, y) => [-Math.max(B.sideX(z, y), 0), y, z], [-1, 0, 0]), R = make((z, y) => [Math.max(B.sideX(z, y), 0), y, z], [1, 0, 0]); return (sg) => (sg < 0 ? L : R); })(),
    top: make((x, z) => [x, B.topY(x, z), z], [0, 1, 0]),
  };
}

/**
 * Thin raised strip along a 2D polyline (u, v), in conform's (u, v, t) space: top at t = 1, walls and
 * end caps down to t = 0. Use with conform() for seams, bars and light strips (no sliver triangles).
 */
function ribbon(pts, width, { step = 0.05, across = 0 } = {}) {
  // resample the polyline so no segment is longer than step
  const P = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 1; k <= n; k++) P.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)]);
  }
  const Wd = typeof width === 'function' ? width : () => width;
  const L = [], R = [];
  P.forEach((p, i) => {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const w = Wd(i / (P.length - 1)) / 2;
    L.push([p[0] - dy * w, p[1] + dx * w]); R.push([p[0] + dy * w, p[1] - dx * w]);
  });
  const out = [];
  const tri = (a, b, c, o) => {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    if (n[0] * o[0] + n[1] * o[1] + n[2] * o[2] < 0) out.push(...a, ...c, ...b); else out.push(...a, ...b, ...c);
  };
  const q = (a, b, c, d, o) => { tri(a, b, c, o); tri(a, c, d, o); };
  const at = (p, t) => [p[0], p[1], t];
  const K = across || Math.max(1, Math.ceil((typeof width === 'number' ? width : 0.02) / 0.022));
  const mixLR = (i, k) => [lerp(L[i][0], R[i][0], k / K), lerp(L[i][1], R[i][1], k / K)];
  for (let i = 0; i < P.length - 1; i++) {
    const mx = (P[i][0] + P[i + 1][0]) / 2, my = (P[i][1] + P[i + 1][1]) / 2;
    for (let k = 0; k < K; k++) q(at(mixLR(i, k), 1), at(mixLR(i, k + 1), 1), at(mixLR(i + 1, k + 1), 1), at(mixLR(i + 1, k), 1), [0, 0, 1]);
    q(at(L[i], 0), at(L[i + 1], 0), at(L[i + 1], 1), at(L[i], 1), [L[i][0] - mx, L[i][1] - my, 0]);
    q(at(R[i], 0), at(R[i + 1], 0), at(R[i + 1], 1), at(R[i], 1), [R[i][0] - mx, R[i][1] - my, 0]);
  }
  const n = P.length - 1;
  q(at(L[0], 0), at(R[0], 0), at(R[0], 1), at(L[0], 1), [P[0][0] - P[1][0], P[0][1] - P[1][1], 0]);
  q(at(L[n], 0), at(R[n], 0), at(R[n], 1), at(L[n], 1), [P[n][0] - P[n - 1][0], P[n][1] - P[n - 1][1], 0]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  return g;
}

function flipWinding(g) {
  for (const a of Object.values(g.attributes)) {
    const n = a.itemSize, arr = a.array;
    for (let i = 0; i < a.count; i += 3) for (let j = 0; j < n; j++) { const t = arr[(i + 1) * n + j]; arr[(i + 1) * n + j] = arr[(i + 2) * n + j]; arr[(i + 2) * n + j] = t; }
    a.needsUpdate = true;
  }
  return g;
}
/** Smooth-shade any raw geometry (normals averaged under the crease angle) and make it mergeable. */
function smoothGeo(g, crease = 0.6, keepUV = false) {
  if (!keepUV && g.attributes.uv) g.deleteAttribute('uv');
  if (g.attributes.normal) g.deleteAttribute('normal');
  return prep(toCreasedNormals(g, crease), keepUV);
}
const rrShape = (x, y, w, h, r) => {
  const s = new THREE.Shape();
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
};
const polyShape = (pts) => { const s = new THREE.Shape(); pts.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]))); s.closePath(); return s; };
const mirrorX = (g) => { const h = g.clone(); h.scale(-1, 1, 1); return flipWinding(h); };

// ------------------------------------------------------------------------------------------ textures
let ATLAS = null, TREAD = null;
function atlasTex() {
  if (ATLAS) return ATLAS;
  ATLAS = canvasTex(1024, 512, (c, w, h) => {
    c.fillStyle = '#07090d'; c.fillRect(0, 0, w, h);
    // --- cluster (0,0)-(640,256)
    const dial = (cx, cy, r, max, step, label, unit, red) => {
      const g = c.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
      g.addColorStop(0, '#141a24'); g.addColorStop(1, '#0a0d13');
      c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, PI * 2); c.fill();
      c.strokeStyle = '#4a5a70'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, r - 2, 0, PI * 2); c.stroke();
      const a0 = PI * 0.75, a1 = PI * 2.25;
      c.lineWidth = 6; c.strokeStyle = '#1f6fd0'; c.beginPath(); c.arc(cx, cy, r - 14, a0, lerp(a0, a1, 0.18)); c.stroke();
      if (red) { c.strokeStyle = '#d23a2a'; c.beginPath(); c.arc(cx, cy, r - 14, lerp(a0, a1, red), a1); c.stroke(); }
      for (let v = 0; v <= max; v += step / 2) {
        const a = lerp(a0, a1, v / max), big = v % step === 0;
        c.strokeStyle = big ? '#e8eef8' : '#8a96a8'; c.lineWidth = big ? 3 : 1.5;
        c.beginPath(); c.moveTo(cx + Math.cos(a) * (r - 22), cy + Math.sin(a) * (r - 22));
        c.lineTo(cx + Math.cos(a) * (r - (big ? 38 : 30)), cy + Math.sin(a) * (r - (big ? 38 : 30))); c.stroke();
        if (big) { c.fillStyle = '#dfe6f2'; c.font = `bold ${r * 0.15}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(String(v / (max > 100 ? 1 : 1)), cx + Math.cos(a) * (r - 56), cy + Math.sin(a) * (r - 56)); }
      }
      c.fillStyle = '#9fb0c8'; c.font = `${r * 0.13}px ${FONT}`; c.fillText(unit, cx, cy + r * 0.42);
      c.fillStyle = '#ffffff'; c.font = `bold ${r * 0.3}px ${FONT}`; c.fillText(label, cx, cy + r * 0.12);
      const na = lerp(a0, a1, 0.04);
      c.strokeStyle = '#ff6a2a'; c.lineWidth = 5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(cx - Math.cos(na) * 12, cy - Math.sin(na) * 12); c.lineTo(cx + Math.cos(na) * (r - 26), cy + Math.sin(na) * (r - 26)); c.stroke();
      c.fillStyle = '#2a3242'; c.beginPath(); c.arc(cx, cy, 11, 0, PI * 2); c.fill();
    };
    dial(128, 128, 118, 240, 40, '0', 'km/h', 0);
    dial(512, 128, 118, 8, 1, '0', 'x1000 rpm', 0.78);
    c.fillStyle = '#0e1420'; c.fillRect(262, 40, 116, 176);
    c.strokeStyle = '#2b3a52'; c.lineWidth = 2; c.strokeRect(262, 40, 116, 176);
    c.textAlign = 'center'; c.fillStyle = '#7fd0ff'; c.font = `bold 46px ${FONT}`; c.fillText('D', 320, 92);
    c.fillStyle = '#c9d6ea'; c.font = `20px ${FONT}`; c.fillText('12°C  맑음', 320, 136);
    c.fillText('08:42', 320, 166);
    c.fillStyle = '#2b3a52'; c.fillRect(280, 186, 80, 10); c.fillStyle = '#5fd18a'; c.fillRect(280, 186, 58, 10);
    // --- navigation screen (0,256)-(512,512)
    c.save(); c.translate(0, 256);
    c.fillStyle = '#1c2430'; c.fillRect(0, 0, 512, 256);
    const R = rng(7);
    c.fillStyle = '#21402f'; c.fillRect(300, 150, 140, 90); c.fillStyle = '#1d3a5a'; c.beginPath(); c.ellipse(70, 210, 90, 40, 0.2, 0, PI * 2); c.fill();
    c.fillStyle = '#26303e'; for (let i = 0; i < 16; i++) c.fillRect(R() * 470, R() * 220, 20 + R() * 40, 14 + R() * 30);
    c.lineCap = 'round';
    const road = (pts, wdt) => { c.lineWidth = wdt + 4; c.strokeStyle = '#3a4656'; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
      c.lineWidth = wdt; c.strokeStyle = '#6a7686'; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); };
    road([[0, 120], [512, 100]], 14); road([[200, 0], [230, 256]], 12); road([[380, 0], [360, 256]], 10); road([[0, 40], [512, 30]], 8); road([[60, 256], [140, 0]], 8);
    c.lineWidth = 9; c.strokeStyle = '#3d9bff'; c.beginPath(); c.moveTo(215, 256); c.lineTo(212, 112); c.lineTo(370, 102); c.lineTo(378, 20); c.stroke();
    c.fillStyle = '#ff5a3a'; c.beginPath(); c.arc(378, 20, 9, 0, PI * 2); c.fill();
    c.fillStyle = '#1d4fa0'; c.beginPath(); c.moveTo(216, 196); c.lineTo(202, 230); c.lineTo(216, 222); c.lineTo(230, 230); c.closePath(); c.fill();
    c.fillStyle = 'rgba(20,28,40,0.88)'; c.fillRect(0, 0, 512, 44);
    c.fillStyle = '#ffffff'; c.font = `26px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('↱ 300m  회사 방향', 14, 23);
    c.textAlign = 'right'; c.fillStyle = '#9fd3ff'; c.fillText('도착 08:55', 500, 23);
    c.restore();
    // --- climate / radio strip (512,256)-(1024,384)
    c.save(); c.translate(512, 256);
    c.fillStyle = '#0d1118'; c.fillRect(0, 0, 512, 128);
    c.fillStyle = '#e4ecf8'; c.font = `bold 44px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('22.5°', 90, 64); c.fillText('22.5°', 422, 64);
    c.fillStyle = '#6fb6ff'; c.font = `24px ${FONT}`; c.fillText('AUTO  ❄', 256, 40); c.fillStyle = '#9aa8bc'; c.fillText('FM 95.9 우리동네 라디오', 256, 88);
    c.restore();
  });
  return ATLAS;
}
function treadTex() {
  if (TREAD) return TREAD;
  TREAD = canvasTex(512, 64, (c, w, h) => {
    c.fillStyle = '#9a9a9a'; c.fillRect(0, 0, w, h);
    const v0 = h * 0.33, v1 = h * 0.67;
    c.fillStyle = '#d8d8d8'; c.fillRect(0, v0, w, v1 - v0);
    c.fillStyle = '#202020';
    c.fillRect(0, lerp(v0, v1, 0.33) - 1.5, w, 3); c.fillRect(0, lerp(v0, v1, 0.67) - 1.5, w, 3);
    for (let i = 0; i < 64; i++) {
      const x = (i / 64) * w;
      c.save(); c.translate(x, 0); c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, v0); c.lineTo(3, lerp(v0, v1, 0.3)); c.stroke();
      c.beginPath(); c.moveTo(2, lerp(v0, v1, 0.36)); c.lineTo(5, lerp(v0, v1, 0.64)); c.stroke();
      c.beginPath(); c.moveTo(5, lerp(v0, v1, 0.7)); c.lineTo(8, v1); c.stroke();
      c.restore();
    }
    c.strokeStyle = '#202020';
    for (let i = 0; i < 64; i++) { const x = (i / 64) * w + 4; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x, v0); c.lineTo(x + 3, lerp(v0, v1, 0.3)); c.stroke();
      c.beginPath(); c.moveTo(x + 2, lerp(v0, v1, 0.36)); c.lineTo(x + 5, lerp(v0, v1, 0.64)); c.stroke();
      c.beginPath(); c.moveTo(x + 5, lerp(v0, v1, 0.7)); c.lineTo(x + 8, v1); c.stroke(); }
    c.fillStyle = '#8c8c8c'; c.fillRect(0, h * 0.12, w, 2); c.fillRect(0, h * 0.88, w, 2);
  }, { color: false });
  TREAD.wrapS = THREE.RepeatWrapping;
  return TREAD;
}
function plateTex(seed) {
  const R = rng(seed * 977 + 13);
  const han = '가나다라마거너더러머버서어저고노도로모보소오조구누두루무부수우주'.split('');
  const txt = `${10 + Math.floor(R() * 89)}${Math.floor(R() * 10)}${han[Math.floor(R() * han.length)]} ${String(1000 + Math.floor(R() * 8999))}`;
  return canvasTex(512, 112, (c, w, h) => {
    c.fillStyle = '#f7f8f6'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#1b1e22'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
    c.fillStyle = '#16191d'; c.font = `bold 84px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(txt, w / 2 + 6, h / 2 + 4);
    c.fillStyle = '#7f858c'; c.beginPath(); c.arc(30, h / 2, 6, 0, PI * 2); c.arc(w - 30, h / 2, 6, 0, PI * 2); c.fill();
  });
}
let TAXITEX = null;
function taxiTex() {
  if (TAXITEX) return TAXITEX;
  TAXITEX = canvasTex(512, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#fff7d6'); g.addColorStop(1, '#ffe08a');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#1f2c4a'; c.font = `bold 78px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('TAXI 택시', w / 2, h / 2 + 4);
  });
  return TAXITEX;
}

// ------------------------------------------------------------------------------------------ materials
let M = null;
function mats() {
  if (M) return M;
  // side/rear glass: dark tint both ways; windscreen: reflective from outside, invisible from the driver's seat
  const tint = mat('tintedGlass').clone(); tint.side = THREE.DoubleSide; tint.color.set(0x18222a); tint.opacity = 0.8; tint.envMapIntensity = 1.7; tint.name = 'carTint';
  const wind = mat('tintedGlass').clone(); wind.side = THREE.FrontSide; wind.color.set(0x2a3842); wind.opacity = 0.5; wind.envMapIntensity = 1.8; wind.name = 'carWind';
  const redLens = new THREE.MeshPhysicalMaterial({ color: 0x9a1016, roughness: 0.12, transparent: true, opacity: 0.55, depthWrite: false, envMapIntensity: 1.4, name: 'carRedLens' });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x232325, roughness: 0.9, bumpMap: treadTex(), bumpScale: 3, name: 'carTyre' });
  tyre.bumpMap = tyre.bumpMap.clone(); tyre.bumpMap.repeat.set(1, 1); tyre.bumpMap.needsUpdate = true;
  M = {
    tint, wind, redLens, tyre,
    trim: paint(0x121315, 0.32, 0, { clearcoat: 1 }),
    matte: mat('blackPlastic'),
    chrome: mat('chrome'),
    rim: paint(0xc3c7cc, 0.26, 1),
    dash: paint(0x2a2b2f, 0.66),
    dashSoft: paint(0x3b3a38, 0.72),
    carpet: mat('carpet'),
    seat: mat('fabricGray'),
    screens: glow(0xffffff, 0.7, atlasTex()),
    placeholderPaint: paint(0x777777, 0.35, 0.1, { clearcoat: 1 }),
  };
  return M;
}

// ------------------------------------------------------------------------------------------ template
const TEMPLATES = new Map();

function buildTemplate(style) {
  const S = STYLES[style] ?? STYLES.sedan;
  const B = makeShape(S);
  const MT = mats();
  const C = S.cab;
  const headMat = new THREE.MeshStandardMaterial({ color: 0xf2f5fa, emissive: 0xfff3dc, emissiveIntensity: 0.25, roughness: 0.25, metalness: 0.2, name: 'carHead' });
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x8c1016, emissive: 0xff1a1a, emissiveIntensity: 0.35, roughness: 0.3, name: 'carBrake' });
  const signMat = S.taxi ? new THREE.MeshStandardMaterial({ map: taxiTex(), emissive: 0xffffff, emissiveMap: taxiTex(), emissiveIntensity: 0.25, roughness: 0.4, name: 'carSign' }) : null;
  const plateMat = new THREE.MeshStandardMaterial({ map: plateTex(1), roughness: 0.35, metalness: 0.1, name: 'carPlate' });
  const PAINT = MT.placeholderPaint;

  const root = new THREE.Group();
  root.name = 'car';
  const bodyY = 0.45;
  const body = group(root, 0, bodyY, 0);
  body.name = 'body';
  body.userData.dynamic = true;
  const inner = group(body, 0, -bodyY, 0); // body content in car space

  // ---------------------------------------------------------------- stations
  const zs = new Set();
  const NT = 12;
  for (let k = 0; k <= NT; k++) { zs.add(B.zF + S.rp[0] * (k / NT) ** 2.2); zs.add(B.zR - S.rp[1] * (k / NT) ** 2.2); }
  for (let z = B.zF + S.rp[0]; z < B.zR - S.rp[1]; z += 0.075) zs.add(z);
  for (const a of S.axles) {
    const yb = B.bot(a), b0 = Math.asin(clamp((yb - B.yw) / B.Ra, -1, 1));
    for (const z of [...zs]) if (Math.abs(z - a) < B.Ra * 1.02) zs.delete(z);
    const N = 22;
    for (let j = 0; j <= N; j++) { const b = lerp(b0 - 0.02, PI - b0 + 0.02, j / N); zs.add(a - B.Ra * Math.cos(b)); }
  }
  for (const z of [C.z0, C.z1]) zs.add(z);
  const st = [...zs].sort((a, b) => a - b).filter((z, i, arr) => i === 0 || z - arr[i - 1] > 0.004);
  st[0] = B.zF; st[st.length - 1] = B.zR;

  // ---------------------------------------------------------------- hull
  const halves = st.map((z) => B.hull(z));
  const nh = halves[0].pts.length;
  const ringOf = (H, z) => { const r = []; for (let k = nh - 1; k >= 1; k--) r.push([-H.pts[k][0], H.pts[k][1], z]); for (let k = 0; k < nh - 1; k++) r.push([H.pts[k][0], H.pts[k][1], z]); return r; };
  const rows = halves.map((H, i) => ringOf(H, st[i]));
  const segLab = (() => { const L = halves[0].lab; const r = []; for (let k = nh - 2; k >= 0; k--) r.push(L[k]); for (let k = 0; k < nh - 2; k++) r.push(L[k]); r.push(L[nh - 2]); return r; })();
  const hullParts = loft(rows, (i, k) => {
    const zm = (st[i] + st[i + 1]) / 2, l = segLab[k];
    if (l === 'O' && zm > C.z0 && zm < C.z1) return null;
    if (l === 'L') return 'liner';
    return 'paint';
  }, { closed: true, flip: true });
  put(inner, hullParts.paint, PAINT);
  put(inner, hullParts.liner, MT.matte);

  // ---------------------------------------------------------------- glass house
  const gz = new Set([C.z0, C.z1, C.zRF, C.zRR, C.sideEnd, ...C.pillars.flat().filter((x) => typeof x === 'number')]);
  const NG = 8;
  for (let k = 1; k < NG; k++) { gz.add(C.z0 + (C.zRF - C.z0) * (k / NG) ** 1.3); gz.add(C.z1 - (C.z1 - C.zRR) * (k / NG) ** 1.3); }
  for (let z = C.zRF; z < C.zRR; z += 0.09) gz.add(z);
  const gst = [...gz].filter((z) => z >= C.z0 && z <= C.z1).sort((a, b) => a - b).filter((z, i, arr) => i === 0 || z - arr[i - 1] > 0.006);
  const houses = gst.map((z) => B.house(z));
  const ng = houses[0].pts.length;
  const grows = houses.map((H, i) => { const r = []; for (let k = 0; k < ng; k++) r.push([H.pts[k][0], H.pts[k][1], gst[i]]); for (let k = ng - 2; k >= 0; k--) r.push([-H.pts[k][0], H.pts[k][1], gst[i]]); return r; });
  const glab = (() => { const L = houses[0].lab, r = [...L]; for (let k = L.length - 1; k >= 0; k--) r.push(L[k]); return r; })();
  const inPillar = (zm) => C.pillars.find(([a, b]) => zm > a && zm < b);
  const houseMat = (i, k) => {
    const zm = (gst[i] + gst[i + 1]) / 2, l = glab[k];
    if (l === 'T') return zm < C.zRF ? 'wind' : zm > C.zRR ? 'tint' : 'paint';
    if (l === 'Cb') return zm < C.zRF - 0.03 ? 'wind' : zm > C.zRR + 0.03 ? 'tint' : 'paint';
    if (l === 'C') return 'paint';
    const pil = inPillar(zm);
    if (zm > C.sideEnd) return 'paint';
    if (pil) return pil[2];
    if (l === 'S0') return 'chrome';
    if (l === 'S9') return 'trim';
    return 'tint';
  };
  const gh = loft(grows, houseMat, { flip: true });
  put(inner, gh.paint, PAINT);
  put(inner, gh.wind, MT.wind).castShadow = false;
  put(inner, gh.tint, MT.tint).castShadow = false;
  if (gh.trim) put(inner, gh.trim, MT.trim);
  if (gh.chrome) put(inner, gh.chrome, MT.chrome);
  // headliner and pillar trims seen from inside
  const ghIn = loft(grows, (i, k) => {
    const m = houseMat(i, k);
    if (m === 'wind' || m === 'tint') return null;
    const zm = (gst[i] + gst[i + 1]) / 2;
    return glab[k] === 'T' && zm > C.zRF && zm < C.zRR ? 'roof' : 'pillar';
  }, { offset: 0.03 });
  put(inner, ghIn.roof, MT.seat);
  put(inner, ghIn.pillar, MT.dash);

  const P = projectors(B);
  const addPart = (geo, material, cast = true) => { const m = put(inner, geo, material); m.castShadow = cast; return m; };
  const both = (geo, material, cast = true) => { addPart(geo, material, cast); addPart(mirrorX(geo), material, cast); };

  // ---------------------------------------------------------------- front: lamps, grille, plate
  const W2 = B.W2, kx = W2 / 0.91;
  const line = (pts, w, proj, lo, hi, material, opt = {}) => addPart(conform(ribbon(pts, w, { step: Math.min(0.08, Math.max(0.03, w * 0.8)), ...opt }), proj, lo, hi, { maxLen: 1 }), material);
  const circle = (cx, cy, r, n = 24) => { const pts = []; for (let i = 0; i <= n; i++) pts.push([cx + Math.cos((i / n) * PI * 2) * r, cy + Math.sin((i / n) * PI * 2) * r]); return pts; };
  {
    const yNose = B.top(B.zF + 0.3), yBot = B.bot(B.zF + 0.3);
    const y1 = yNose - 0.05, y0 = y1 - (S.lampH ?? 0.09);
    const x0 = 0.36 * kx, x1 = W2 - 0.07;
    const eye = polyShape([[x0, y0 + 0.045], [x0 + 0.07, y0 + 0.01], [x1 - 0.14, y0], [x1 - 0.03, y0 + 0.018], [x1 + 0.01, y1 - 0.025], [x1 - 0.04, y1], [x0 + 0.06, y1 - 0.008], [x0, y1 - 0.022]]);
    both(conform(eye, P.front, -0.012, 0.003), MT.trim);
    both(conform(rrShape(x0 + 0.075, y0 + 0.024, x1 - x0 - 0.16, 0.038, 0.018), P.front, -0.01, 0.0065), headMat);
    const drl = [[x0 + 0.01, y1 - 0.02], [x0 + 0.16, y1 - 0.012], [x1 - 0.06, y1 - 0.009], [x1 - 0.005, y1 - 0.028]];
    line(drl, 0.011, P.front, -0.004, 0.009, headMat); line(drl.map(([x, y]) => [-x, y]), 0.011, P.front, -0.004, 0.009, headMat);
    for (const px of [x0 + 0.14, x0 + 0.24, x0 + 0.34]) {
      const cy = y0 + 0.043;
      line(circle(px, cy, 0.017, 18), 0.006, P.front, -0.004, 0.0095, MT.chrome);
      line(circle(-px, cy, 0.017, 18), 0.006, P.front, -0.004, 0.0095, MT.chrome);
    }
    // thin light bar joining the lamps across the nose
    line([[-x0 + 0.005, y1 - 0.024], [0, y1 - 0.021], [x0 - 0.005, y1 - 0.024]], 0.007, P.front, -0.004, 0.006, headMat);
    // grille: trapezoid with a chrome surround and bars
    const gy0 = yBot + 0.08, gy1 = Math.min(y0 - 0.03, gy0 + 0.25), gt = 0.36 * kx, gb = 0.47 * kx;
    const gs = polyShape([[-gb, gy0 + 0.03], [-gb + 0.03, gy0], [gb - 0.03, gy0], [gb, gy0 + 0.03], [gt, gy1 - 0.01], [gt - 0.02, gy1], [-gt + 0.02, gy1], [-gt, gy1 - 0.01]]);
    addPart(conform(gs, P.front, -0.016, 0.0005, { maxLen: 0.08 }), MT.matte);
    line([[-gb, gy0 + 0.03], [-gb + 0.03, gy0], [gb - 0.03, gy0], [gb, gy0 + 0.03], [gt, gy1 - 0.01], [gt - 0.02, gy1], [-gt + 0.02, gy1], [-gt, gy1 - 0.01], [-gb, gy0 + 0.03]], 0.012, P.front, -0.004, 0.006, MT.chrome);
    for (let i = 1; i <= 4; i++) {
      const y = lerp(gy0, gy1, i / 5), hw2 = lerp(gb, gt, i / 5) - 0.03;
      line([[-hw2, y], [hw2, y]], 0.01, P.front, -0.012, -0.002, MT.chrome);
    }
    // badge on the nose, plate on the grille, lower lip and fog lamps
    const badge = new THREE.Shape(); badge.absellipse(0, y1 - 0.055, 0.05, 0.028, 0, PI * 2);
    addPart(conform(badge, P.front, -0.004, 0.008, { maxLen: 0.02 }), MT.chrome);
    const pw = 0.52, ph = 0.11, py = gy0 + 0.02;
    addPart(conform(rrShape(-pw / 2, py, pw, ph, 0.012), P.front, -0.003, 0.012, { uvRect: [pw / 2, py, -pw, ph], maxLen: 0.12 }), plateMat);
    line([[-W2 + 0.2, yBot + 0.03], [-gb, yBot + 0.025], [gb, yBot + 0.025], [W2 - 0.2, yBot + 0.03]], 0.045, P.front, -0.004, 0.006, MT.matte);
    for (const sg of [-1, 1]) {
      const cx = sg * (gb + 0.13);
      const pocket = new THREE.Shape(); pocket.absellipse(cx, gy0 + 0.045, 0.075, 0.032, 0, PI * 2);
      addPart(conform(pocket, P.front, -0.008, 0.002, { maxLen: 0.03 }), MT.matte);
      line([[cx - 0.05, gy0 + 0.045], [cx + 0.05, gy0 + 0.045]], 0.016, P.front, -0.004, 0.006, headMat);
    }
  }
  // ---------------------------------------------------------------- rear: lamps, plate, diffuser
  {
    const yt = B.top(B.zR - 0.3), yb = B.bot(B.zR - 0.3);
    const y1 = yt - 0.045, y0 = y1 - (S.tailH ?? 0.11);
    const x0 = 0.4 * kx, x1 = W2 - 0.05;
    const tail = polyShape([[x0, y0 + 0.05], [x0 + 0.05, y0 + 0.02], [x1 - 0.12, y0], [x1 - 0.02, y0 + 0.02], [x1 + 0.01, y1 - 0.02], [x1 - 0.05, y1], [x0 + 0.04, y1 - 0.004], [x0, y1 - 0.02]]);
    both(conform(tail, P.rear, -0.012, 0.004), brakeMat);
    both(conform(tail, P.rear, 0.004, 0.0085, { maxLen: 0.05 }), MT.redLens, false);
    const tl = [[x0 + 0.03, y1 - 0.03], [x1 - 0.06, y1 - 0.022], [x1 - 0.02, y0 + 0.03]];
    line(tl, 0.012, P.rear, 0.0, 0.0095, MT.chrome); line(tl.map(([x, y]) => [-x, y]), 0.012, P.rear, 0.0, 0.0095, MT.chrome);
    line([[-x0 + 0.005, y1 - 0.03], [0, y1 - 0.027], [x0 - 0.005, y1 - 0.03]], 0.014, P.rear, -0.004, 0.006, brakeMat);
    // boot lid seam under the lamps, badge, plate recess, diffuser with reflectors and exhaust
    line([[-x0, y0 - 0.02], [x0, y0 - 0.02]], 0.005, P.rear, -0.002, 0.0012, MT.trim);
    const badge = new THREE.Shape(); badge.absellipse(0, y1 - 0.075, 0.05, 0.028, 0, PI * 2);
    addPart(conform(badge, P.rear, -0.004, 0.008, { maxLen: 0.02 }), MT.chrome);
    const pw = 0.52, ph = 0.11, py = Math.max(yb + 0.16, y0 - 0.25);
    addPart(conform(rrShape(-pw / 2 - 0.035, py - 0.035, pw + 0.07, ph + 0.07, 0.035), P.rear, -0.012, 0.0005, { maxLen: 0.1 }), MT.matte);
    addPart(conform(rrShape(-pw / 2, py, pw, ph, 0.012), P.rear, -0.004, 0.006, { uvRect: [-pw / 2, py, pw, ph], maxLen: 0.12 }), plateMat);
    line([[-W2 + 0.18, yb + 0.05], [-0.6 * kx, yb + 0.035], [0.6 * kx, yb + 0.035], [W2 - 0.18, yb + 0.05]], 0.07, P.rear, -0.004, 0.007, MT.matte);
    for (const sg of [-1, 1]) line([[sg * (W2 - 0.3), yb + 0.065], [sg * (W2 - 0.18), yb + 0.07]], 0.016, P.rear, 0.004, 0.011, brakeMat);
    const ez = B.zR - 0.16, ey = B.bot(ez) + 0.035;
    for (const ex of [-W2 * 0.42, -W2 * 0.42 + 0.09]) put(inner, lathe([[0.026, -0.08], [0.031, -0.08], [0.033, 0.06], [0.029, 0.07], [0.024, 0.06], [0.022, -0.08]], 18), MT.chrome, ex, ey, ez, PI / 2, 0, 0);
  }
  // ---------------------------------------------------------------- sides: seams, rocker, handles, mirrors
  {
    const yBelt = (z) => B.hull(z).yB - 0.03;
    const za = S.axles[0] + B.Ra + 0.04, zb = S.axles[1] - B.Ra - 0.04;
    const rear = Math.min(zb + 0.04, C.sideEnd - 0.02);
    const doors = S.slide ? [C.z0 + 0.06, -0.66, 0.68] : [C.z0 + 0.03, (C.pillars[0][0] + C.pillars[0][1]) / 2, rear];
    const yDoorBot = B.bot(0) + 0.1;
    for (const sg of [-1, 1]) {
      const sp = P.side(sg);
      for (const z of doors) {
        const ya = Math.max(yDoorBot, B.yLow(z) + 0.035), yb = yBelt(z);
        line([[z, ya], [z + 0.004, (ya + yb) / 2], [z, yb]], 0.0055, sp, -0.002, 0.0012, MT.trim);
      }
      line([[doors[0], yDoorBot], [doors[doors.length - 1], yDoorBot]], 0.0055, sp, -0.002, 0.0012, MT.trim);
      // rocker skirt, and wheel-arch flares on the SUV
      line([[za, B.bot(za) + (S.cladding ? 0.07 : 0.05)], [zb, B.bot(zb) + (S.cladding ? 0.07 : 0.05)]], S.cladding ? 0.12 : 0.07, sp, -0.003, 0.007, MT.matte);
      if (S.cladding) for (const a of S.axles) {
        const pts = [], r = B.Ra + 0.035, b0 = Math.asin(clamp((B.bot(a) + 0.03 - B.yw) / r, -1, 1));
        for (let i = 0; i <= 24; i++) { const b = lerp(PI - b0, b0, i / 24); pts.push([a + Math.cos(b) * r, B.yw + Math.sin(b) * r]); }
        line(pts, 0.07, sp, -0.003, 0.008, MT.matte, { step: 0.06 });
      }
      // handles with a recess
      const hz = S.slide ? [C.z0 + 0.5, 0.45] : [(doors[0] + doors[1]) / 2 + 0.2, (doors[1] + doors[2]) / 2 + 0.16];
      for (const z of hz) {
        const y = yBelt(z) - 0.075;
        addPart(conform(rrShape(z - 0.09, y - 0.022, 0.18, 0.044, 0.022), sp, -0.004, 0.0008, { maxLen: 0.09, curveSegments: 3 }), MT.trim);
        addPart(conform(rrShape(z - 0.075, y - 0.012, 0.15, 0.024, 0.012), sp, -0.002, 0.012, { maxLen: 0.08, curveSegments: 3 }), MT.chrome);
      }
      // side repeater on the front fender
      const fz = S.axles[0] + B.Ra + 0.12, fy = yBelt(fz) - 0.06;
      line([[fz - 0.035, fy], [fz + 0.035, fy + 0.004]], 0.012, sp, -0.002, 0.006, headMat);
    }
    // fuel door (right rear)
    { const z = S.axles[1] - 0.04, y = yBelt(z) - 0.12; line(circle(z, y, 0.07, 28), 0.005, P.side(1), -0.002, 0.0012, MT.trim); }
    // hood seams and cowl
    const zh0 = B.zF + 0.3, zh1 = C.z0 - 0.08;
    const hx = (z) => B.hw(z) - 0.17;
    for (const sg of [-1, 1]) {
      const pts = []; for (let i = 0; i <= 8; i++) { const z = lerp(zh0, zh1, i / 8); pts.push([sg * hx(z), z]); }
      line(pts, 0.0055, P.top, -0.002, 0.0012, MT.trim);
    }
    { const pts = []; for (let i = 0; i <= 10; i++) { const x = lerp(-hx(zh0), hx(zh0), i / 10); pts.push([x, zh0 - 0.02 * (1 - (x / hx(zh0)) ** 2)]); } line(pts, 0.0055, P.top, -0.002, 0.0012, MT.trim); }
    const cw = B.hull(C.z0).xL - 0.06;
    line([[-cw, C.z0 - 0.042], [0, C.z0 - 0.045], [cw, C.z0 - 0.042]], 0.07, P.top, -0.004, 0.003, MT.matte, { step: 0.12 });
    // boot lid seams (sedan)
    if (C.z1 < B.zR - 0.35) {
      const z0 = C.z1 + 0.04, z1 = B.zR - 0.16;
      for (const sg of [-1, 1]) { const pts = []; for (let i = 0; i <= 5; i++) { const z = lerp(z0, z1, i / 5); pts.push([sg * (B.hull(z).xL - 0.03), z]); } line(pts, 0.0055, P.top, -0.002, 0.0012, MT.trim); }
      line([[-(B.hull(z0).xL - 0.03), z0], [B.hull(z0).xL - 0.03, z0]], 0.0055, P.top, -0.002, 0.0012, MT.trim);
    }
    // wipers resting at the base of the windscreen
    for (const x of [-0.4, 0.14]) {
      const z = C.z0 + 0.045, y = B.house(z).yT + 0.012;
      const w = put(inner, rbox(0.6 * kx, 0.012, 0.02, 0.005, 1), MT.matte, x * kx, y, z);
      w.rotation.set(0.62, -0.05, 0.03, 'YXZ');
    }
    // side mirrors on the door corner
    for (const sg of [-1, 1]) {
      const z = C.z0 + 0.22, y = B.hull(z).yB + 0.07, x = sg * (B.sideX(z, y - 0.07) + 0.05);
      const mg = group(inner, x, y, z, 0);
      const housing = sphere(1, 22, 12); housing.scale(0.1, 0.062, 0.058);
      put(mg, housing, PAINT, sg * 0.06, 0.02, 0.01, 0, sg * 0.18, 0);
      const glassG = sphere(1, 18, 8); glassG.scale(0.088, 0.052, 0.012);
      put(mg, glassG, MT.chrome, sg * 0.062, 0.02, 0.056, 0, sg * 0.18, 0);
      put(mg, rbox(0.1, 0.03, 0.05, 0.014, 2), MT.matte, -sg * 0.015, -0.02, 0.0, 0, 0, sg * 0.25);
      put(mg, rbox(0.06, 0.008, 0.012, 0.004, 1), headMat, sg * 0.095, 0.0, -0.038, 0, sg * 0.5, 0);
    }
    // rear wiper on hatchbacks
    if (C.z1 > B.zR - 0.3) {
      const z = C.z1 - 0.07, y = B.house(z).yT + 0.015;
      const w = put(inner, rbox(0.42 * kx, 0.012, 0.02, 0.005, 1), MT.matte, 0.05, y, z);
      w.rotation.set(-1.0, 0, 0.12, 'YXZ');
      put(inner, cyl(0.018, 0.022, 0.025, 12), MT.matte, -0.16, y - 0.005, z + 0.01, -1.0, 0, 0);
    }
    // shark-fin antenna
    { const z = C.zRR - 0.08, y = B.roofLine(z) - 0.004; const fin = new THREE.Shape();
      fin.moveTo(-0.09, 0); fin.quadraticCurveTo(0.02, 0.0, 0.07, 0.06); fin.quadraticCurveTo(0.09, 0.07, 0.1, 0.02); fin.lineTo(0.1, 0); fin.closePath();
      const g = new THREE.ExtrudeGeometry(fin, { depth: 0.04, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 3, curveSegments: 8 });
      g.translate(0, 0, -0.02); g.rotateY(-PI / 2); put(inner, smoothGeo(g, 0.7), MT.trim, 0, y, z); }
  }
  // ---------------------------------------------------------------- roof extras
  if (S.rails) {
    for (const sg of [-1, 1]) {
      const pts = [];
      for (let z = C.zRF + 0.12; z <= C.zRR - 0.08; z += 0.12) pts.push(new THREE.Vector3(sg * (C.roofHW - 0.08), B.roofLine(z) + 0.055, z));
      put(inner, tube(new THREE.CatmullRomCurve3(pts), 0.018, 24, 6), MT.matte);
      for (const z of [C.zRF + 0.14, C.zRR - 0.1]) put(inner, rbox(0.05, 0.07, 0.12, 0.02, 2), MT.matte, sg * (C.roofHW - 0.08), B.roofLine(z) + 0.02, z);
    }
  }
  if (S.taxi && signMat) {
    const z = (C.zRF + C.zRR) / 2 - 0.05, y = B.roofLine(z) - 0.01;
    const sg = group(inner, 0, y, z);
    put(sg, rbox(0.34, 0.03, 0.14, 0.01), MT.matte, 0, 0.015, 0);
    const sh = new THREE.Shape(); sh.moveTo(-0.3, 0); sh.lineTo(0.3, 0); sh.quadraticCurveTo(0.29, 0.13, 0.22, 0.15); sh.lineTo(-0.22, 0.15); sh.quadraticCurveTo(-0.29, 0.13, -0.3, 0); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 3, curveSegments: 8 });
    g.translate(0, 0, -0.06);
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getZ(i) > 0 ? 1 : -1) * (pos.getX(i) + 0.3) / 0.6 + (pos.getZ(i) > 0 ? 0 : 1), pos.getY(i) / 0.15);
    put(sg, smoothGeo(g, 0.7, true), signMat, 0, 0.028, 0);
  }

  // ---------------------------------------------------------------- interior
  buildInterior(inner, B, S, MT);

  // ---------------------------------------------------------------- steering wheel (dynamic)
  const dx = -S.driverX, hip = S.seat;
  const hub = [dx, hip[1] + 0.34, hip[0] - 0.58];
  const tilt = 0.42;
  const sw = new THREE.Group();
  sw.name = 'steering';
  sw.position.set(hub[0], hub[1], hub[2]);
  sw.rotation.x = -tilt; // local Z points back towards the driver and up
  sw.userData.dynamic = true;
  inner.add(sw);
  {
    const rim = torus(0.182, 0.016, 12, 56); // in local XY plane
    put(sw, rim, MT.dash, 0, 0, 0);
    put(sw, lathe([[0, 0.05], [0.045, 0.048], [0.066, 0.036], [0.074, 0.012], [0.07, -0.01], [0.05, -0.02], [0, -0.02]], 28), MT.dash, 0, -0.012, 0.012, PI / 2, 0, 0);
    for (const sg of [-1, 1]) put(sw, rbox(0.12, 0.032, 0.018, 0.009, 2), MT.dash, sg * 0.115, -0.008, 0.008, 0, 0, sg * -0.1);
    put(sw, rbox(0.03, 0.11, 0.018, 0.009, 2), MT.dash, 0, -0.115, 0.008);
    bake(sw);
  }
  // column
  put(inner, cyl(0.04, 0.05, 0.3, 16), MT.dash, hub[0], hub[1] - Math.sin(tilt) * 0.17 + 0.0, hub[2] - Math.cos(tilt) * 0.17, PI / 2 - tilt, 0, 0);

  // ---------------------------------------------------------------- wheels (dynamic pivots)
  const wheels = [];
  const wheelGeo = wheelGeometry(S);
  S.axles.forEach((az, ai) => {
    for (const sg of [-1, 1]) {
      const pv = group(root, sg * B.trackHalf, S.R, az);
      pv.name = 'wheel';
      pv.rotation.order = 'YXZ';
      pv.userData.dynamic = true;
      const flip = group(pv, 0, 0, 0, sg > 0 ? 0 : PI);
      put(flip, wheelGeo.tyre, MT.tyre);
      put(flip, wheelGeo.rim, MT.rim);
      wheels.push({ pivot: pv, steer: ai === 0, radius: S.R });
    }
  });

  bake(inner);
  inner.userData.bakedInner = true;

  const eye = [dx, hip[1] + 0.66, hip[0] - 0.1];
  return { root, S, B, headMat, brakeMat, signMat, plateMat, eye, bodyY };
}

function wheelGeometry(S) {
  const R = S.R, w = S.tyreW, rr = R * 0.66;
  const h = w / 2;
  const prof = [
    [rr - 0.004, -h * 0.84], [rr + 0.012, -h * 0.95], [lerp(rr, R, 0.4), -h], [lerp(rr, R, 0.72), -h * 0.99], [R - 0.016, -h * 0.9], [R - 0.004, -h * 0.72], [R, -h * 0.5],
    [R + 0.001, 0], [R, h * 0.5], [R - 0.004, h * 0.72], [R - 0.016, h * 0.9], [lerp(rr, R, 0.72), h * 0.99], [lerp(rr, R, 0.4), h], [rr + 0.012, h * 0.95], [rr - 0.004, h * 0.84],
  ];
  const tyreRaw = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 32);
  // u around, v along the profile: tread band in the middle third of the texture
  const uv = tyreRaw.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i));
  tyreRaw.rotateZ(-PI / 2);
  const tyre = prep(tyreRaw, true);
  // rim: barrel + spokes + hub, face towards +X
  const parts = [];
  const barrel = new THREE.LatheGeometry([[rr - 0.012, -h * 0.8], [rr - 0.004, -h * 0.84], [rr - 0.014, -h * 0.6], [rr - 0.016, h * 0.55], [rr + 0.004, h * 0.8], [rr + 0.006, h * 0.92], [rr - 0.008, h * 0.95], [rr - 0.02, h * 0.78]].map(([r, y]) => new THREE.Vector2(r, y)), 32);
  barrel.rotateZ(-PI / 2);
  parts.push(barrel);
  const faceX = h * 0.72;
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Shape();
    void 0;
    const r0 = 0.05, r1 = rr - 0.02;
    s.moveTo(r0, -0.026); s.quadraticCurveTo((r0 + r1) / 2, -0.02, r1, -0.034); s.lineTo(r1, 0.034); s.quadraticCurveTo((r0 + r1) / 2, 0.02, r0, 0.026); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 4 });
    // (radial, across, depth) → (x = depth, y = radial, z = across), then dish and spin to the slot
    g.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));
    g.rotateZ(-0.12);
    g.translate(faceX - 0.034, 0, 0);
    g.rotateX((i / 5) * PI * 2);
    parts.push(g);
  }
  const hubG = new THREE.LatheGeometry([[0, 0.012], [0.05, 0.012], [0.062, 0.0], [0.065, -0.03], [0.07, -0.05]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
  hubG.rotateZ(-PI / 2); hubG.translate(faceX - 0.012, 0, 0);
  parts.push(hubG);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2 + PI / 5;
    const n = new THREE.CylinderGeometry(0.009, 0.01, 0.02, 8); n.rotateZ(PI / 2); n.translate(faceX + 0.004, Math.cos(a) * 0.04, Math.sin(a) * 0.04);
    parts.push(n);
  }
  const disc = new THREE.CylinderGeometry(rr - 0.05, rr - 0.05, 0.02, 24); disc.rotateZ(PI / 2); disc.translate(-0.01, 0, 0);
  parts.push(disc);
  const rim = mergeAll(parts);
  return { tyre, rim };
}

function mergeAll(geos) {
  const list = geos.map((g) => {
    let n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (k !== 'position') n.deleteAttribute(k);
    n = mergeVertices(n, 1e-5);
    n.computeVertexNormals();
    n = toCreasedNormals(n, 0.6);
    return prep(n);
  });
  const total = list.reduce((s, g) => s + g.attributes.position.count, 0);
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  let o = 0;
  for (const g of list) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

// ------------------------------------------------------------------------------------------ interior
function buildInterior(inner, B, S, MT) {
  const C = S.cab;
  const cast = (m) => m;
  const add = (geo, material, ...tr) => cast(put(inner, geo, material, ...tr));
  const floorY = S.floor;
  // door cards and floor: lofted along the cabin
  const zs = [];
  for (let z = C.z0 + 0.02; z <= C.z1 - 0.02; z += 0.06) zs.push(z);
  zs.push(C.z1 - 0.02);
  const doorZ0 = C.z0 + 0.3;
  const rows = zs.map((z) => {
    const H = B.hull(z);
    const xIn = (y) => {
      let x = Math.max(B.sideX(z, y), 0.3) - 0.055;
      if (y < H.yl + 0.06 && B.archy(z)) x = Math.min(x, H.xW - 0.03);
      return Math.min(x, H.xL - 0.02);
    };
    const yB = H.yB;
    const arm = sstep(doorZ0 - 0.1, doorZ0 + 0.1, z) * (1 - sstep(C.z1 - 0.5, C.z1 - 0.3, z));
    const half = [
      [0, floorY], [xIn(floorY + 0.06) - 0.05, floorY], [xIn(floorY + 0.06), floorY + 0.05],
      [xIn(0.56), 0.56], [xIn(0.66) - 0.07 * arm, 0.64 + 0.02 * arm], [xIn(0.7) - 0.08 * arm, 0.7], [xIn(0.74) - 0.02 * arm, 0.74],
      [xIn(yB - 0.1), yB - 0.1], [H.xL - 0.06, yB - 0.012], [H.xL - 0.005, yB - 0.006],
    ];
    const r = [];
    for (let k = half.length - 1; k >= 1; k--) r.push([-half[k][0], half[k][1], z]);
    for (let k = 0; k < half.length; k++) r.push([half[k][0], half[k][1], z]);
    return r;
  });
  const nh = 10;
  const tub = loft(rows, (i, k) => {
    const kk = k < nh - 1 ? nh - 2 - k : k - (nh - 1);
    return kk <= 1 ? 'carpet' : kk === 4 || kk === 3 ? 'soft' : 'card';
  }, { flip: true });
  add(tub.carpet, MT.carpet); add(tub.card, MT.dash); add(tub.soft, MT.seat);
  // rear wall of the cabin / boot
  const zr = C.z1 - 0.02, Hr = B.hull(zr);
  add(rbox(Hr.xL * 2 - 0.08, Hr.yB - floorY, 0.03, 0.01, 2), MT.dash, 0, (Hr.yB + floorY) / 2, zr);

  // dashboard: side-profile extruded across the cabin
  const hip = S.seat;
  const zFace = hip[0] - 0.74;
  const H0 = B.hull(C.z0);
  const yTop = H0.yB + 0.06;
  const dashW = Math.min(B.hull(zFace).xL, H0.xL + 0.05) * 2 - 0.1;
  const prof = new THREE.Shape();
  prof.moveTo(C.z0 + 0.01, H0.yB - 0.02);
  prof.lineTo(C.z0 + 0.04, H0.yB - 0.004);
  prof.quadraticCurveTo((C.z0 + zFace) / 2, yTop + 0.005, zFace + 0.07, yTop);
  prof.quadraticCurveTo(zFace - 0.005, yTop - 0.005, zFace, yTop - 0.06);
  prof.lineTo(zFace + 0.02, yTop - 0.2);
  prof.quadraticCurveTo(zFace + 0.06, yTop - 0.27, zFace - 0.06, yTop - 0.33);
  prof.lineTo(C.z0 + 0.01, floorY + 0.12);
  prof.closePath();
  const dg = new THREE.ExtrudeGeometry(prof, { depth: dashW, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 6 });
  dg.translate(0, 0, -dashW / 2);
  dg.rotateY(-PI / 2); // (shape x, shape y, depth) → (-depth, y, shape x): shape x is car z
  add(smoothGeo(dg, 0.7), MT.dash);
  // soft top pad
  // instrument cluster hood in front of the driver
  const dx = -S.driverX;
  const cl = group(inner, dx, yTop - 0.035, zFace + 0.05, 0);
  cast(put(cl, rbox(0.42, 0.05, 0.16, 0.024, 3), MT.dash, 0, 0.035, 0.0));
  const face = quad(0.36, 0.144);
  const uvA = face.attributes.uv;
  for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) * (640 / 1024), 0.5 + uvA.getY(i) * 0.5);
  cast(put(cl, face, MT.screens, 0, -0.035, -0.02, -0.28, 0, 0));
  // centre screen and climate strip
  const nav = quad(0.25, 0.125);
  const uvN = nav.attributes.uv;
  for (let i = 0; i < uvN.count; i++) uvN.setXY(i, uvN.getX(i) * 0.5, uvN.getY(i) * 0.5);
  const ny = yTop + 0.02;
  add(rbox(0.28, 0.15, 0.025, 0.012, 2), MT.trim, 0, ny, zFace + 0.03, -0.2, 0, 0);
  add(nav, MT.screens, 0, ny, zFace + 0.044, -0.2, 0, 0);
  const clim = quad(0.2, 0.05);
  const uvC = clim.attributes.uv;
  for (let i = 0; i < uvC.count; i++) uvC.setXY(i, 0.5 + uvC.getX(i) * 0.5, 0.25 + uvC.getY(i) * 0.25);
  add(clim, MT.screens, 0, yTop - 0.17, zFace + 0.035, 0.12, 0, 0);
  // piano-black band with a chrome edge across the passenger side, glovebox seam
  const bandW = dashW / 2 - 0.12;
  add(rbox(bandW, 0.05, 0.02, 0.01, 2), MT.trim, 0.12 + bandW / 2, yTop - 0.1, zFace - 0.002);
  add(rbox(bandW, 0.005, 0.012, 0.002, 1), MT.chrome, 0.12 + bandW / 2, yTop - 0.072, zFace + 0.003);
  add(rbox(0.36, 0.004, 0.01, 0.002, 1), MT.trim, -dx, yTop - 0.215, zFace + 0.02);
  // vents
  for (const x of [-0.12, 0.12, dx - 0.27, -dx + 0.27]) {
    add(rbox(0.1, 0.045, 0.02, 0.01, 2), MT.trim, x, yTop - 0.09, zFace + 0.01);
    for (let i = 0; i < 3; i++) add(rbox(0.088, 0.004, 0.012, 0.002, 1), MT.chrome, x, yTop - 0.105 + i * 0.015, zFace + 0.0);
  }
  // centre console with gear selector
  const cz0 = zFace + 0.05, cz1 = hip[0] + 0.12;
  add(rbox(0.22, 0.18, cz1 - cz0, 0.05, 3), MT.dash, 0, floorY + 0.09 + 0.12, (cz0 + cz1) / 2);
  add(rbox(0.2, 0.05, 0.3, 0.025, 2), MT.seat, 0, floorY + 0.33, hip[0] - 0.02);
  add(sphere(0.026, 16, 12), MT.chrome, 0, floorY + 0.38, hip[0] - 0.28);
  add(cyl(0.012, 0.016, 0.06, 12), MT.trim, 0, floorY + 0.35, hip[0] - 0.28);
  for (const x of [-0.045, 0.045]) add(cyl(0.035, 0.035, 0.012, 20), MT.trim, x, floorY + 0.336, hip[0] - 0.17);
  // seats
  const seat = (x, z, y, w = 0.5) => {
    const g = group(inner, x, y, z, 0);
    cast(put(g, rbox(w, 0.13, 0.5, 0.06, 2), MT.seat, 0, 0, 0, 0.08, 0, 0));
    for (const sg of [-1, 1]) cast(put(g, rbox(0.08, 0.14, 0.46, 0.04, 1), MT.seat, sg * (w / 2 - 0.02), 0.04, 0.01, 0.08, 0, 0));
    const back = group(g, 0, 0.04, 0.24, 0); back.rotation.x = 0.24;
    cast(put(back, rbox(w - 0.02, 0.62, 0.12, 0.06, 2), MT.seat, 0, 0.32, 0.02));
    for (const sg of [-1, 1]) cast(put(back, rbox(0.08, 0.5, 0.15, 0.04, 1), MT.seat, sg * (w / 2 - 0.03), 0.3, 0.0, 0, 0, sg * 0.06));
    for (const sg of [-1, 1]) cast(put(back, cyl(0.007, 0.007, 0.1, 8), MT.chrome, sg * 0.07, 0.68, 0.03));
    cast(put(back, rbox(0.26, 0.17, 0.1, 0.045, 2), MT.seat, 0, 0.76, 0.04));
    cast(put(g, rbox(w - 0.1, 0.2, 0.42, 0.02, 1), MT.dash, 0, -0.15, 0.0));
  };
  seat(-S.driverX, hip[0] + 0.02, hip[1] - 0.04);
  seat(S.driverX, hip[0] + 0.02, hip[1] - 0.04);
  // rear bench
  const rz = S.rear[0], ry = S.rear[1];
  const bw = Math.min(B.hull(rz).xL * 2 - 0.2, 1.3);
  const bench = group(inner, 0, ry - 0.06, rz, 0);
  cast(put(bench, rbox(bw, 0.14, 0.5, 0.06, 2), MT.seat, 0, 0, 0, 0.06, 0, 0));
  const bb = group(bench, 0, 0.03, 0.26, 0); bb.rotation.x = 0.22;
  cast(put(bb, rbox(bw, 0.54, 0.13, 0.06, 2), MT.seat, 0, 0.27, 0.02));
  for (const x of [-bw / 3, bw / 3]) cast(put(bb, rbox(0.24, 0.13, 0.08, 0.04, 2), MT.seat, x, 0.6, 0.04));
  cast(put(bench, rbox(bw - 0.06, 0.24, 0.46, 0.02, 1), MT.dash, 0, -0.17, 0.0));
  // parcel shelf behind the rear bench (sedan) or boot floor
  const shelfZ0 = rz + 0.38;
  if (shelfZ0 < C.z1 - 0.05) {
    const Hs = B.hull((shelfZ0 + C.z1) / 2);
    add(rbox(Hs.xL * 2 - 0.1, 0.03, C.z1 - shelfZ0, 0.01, 2), MT.dash, 0, Math.min(Hs.yB - 0.01, ry + 0.55), (shelfZ0 + C.z1) / 2);
  }
  // rear-view mirror and visors
  const zm = C.zRF + 0.06, ym = B.roofLine(zm) - 0.1;
  add(rbox(0.25, 0.07, 0.03, 0.02, 2), MT.trim, 0, ym, zm, 0.12, 0, 0);
  add(rbox(0.235, 0.058, 0.004, 0.01, 2), MT.chrome, 0, ym, zm + 0.016, 0.12, 0, 0);
  add(cyl(0.008, 0.008, 0.08, 8), MT.trim, 0, ym + 0.06, zm - 0.01);
  for (const sg of [-1, 1]) add(rbox(0.38, 0.016, 0.17, 0.008, 2), MT.seat, sg * 0.3, B.roofLine(zm + 0.08) - 0.05, zm + 0.1, 0.12, 0, 0);
  // inner door handles and speakers (front doors)
  for (const sg of [-1, 1]) {
    const z = doorZ0 + 0.12;
    const xin = (zz, y) => Math.min(B.sideX(zz, y) - 0.055, B.hull(zz).xL - 0.02);
    add(rbox(0.02, 0.03, 0.12, 0.008, 2), MT.chrome, sg * (xin(z, 0.82) - 0.01), 0.82, z);
    const sp = new THREE.CylinderGeometry(0.06, 0.06, 0.01, 20); sp.rotateZ(PI / 2);
    add(smoothGeo(sp), MT.trim, sg * (xin(z + 0.1, 0.47) - 0.004), 0.47, z + 0.1);
  }
  void prof;
}


// ------------------------------------------------------------------------------------------ public
let plateCounter = 0;
/**
 * buildCar({color, style}) → {group, body, wheels, steeringWheel, driverEye, size, headMats, brakeMats}
 * style: 'sedan' | 'hatch' | 'suv' | 'taxi' | 'van'. Forward = -Z, origin at ground centre.
 */
export function buildCar(opts = {}) {
  const style = STYLES[opts.style] ? opts.style : 'sedan';
  const color = opts.color ?? (style === 'taxi' ? 0xf2c12e : 0x4f8fd8);
  if (!TEMPLATES.has(style)) TEMPLATES.set(style, buildTemplate(style));
  const T = TEMPLATES.get(style);
  const MT = mats();
  const group0 = T.root.clone(true);
  const paintMat = paint(color, 0.35, 0.1, { clearcoat: 1 });
  const headMat = T.headMat.clone(), brakeMat = T.brakeMat.clone(), signMat = T.signMat?.clone();
  const plateMat = T.plateMat.clone(); plateMat.map = plateTex(++plateCounter);
  if (opts.lights) { headMat.emissiveIntensity = 3.2; brakeMat.emissiveIntensity = 2.2; if (signMat) signMat.emissiveIntensity = 1.4; }
  const swap = new Map([[MT.placeholderPaint, paintMat], [T.headMat, headMat], [T.brakeMat, brakeMat], [T.plateMat, plateMat]]);
  if (signMat) swap.set(T.signMat, signMat);
  const wheels = [];
  let body = null, steeringWheel = null;
  group0.traverse((o) => {
    if (o.isMesh && swap.has(o.material)) o.material = swap.get(o.material);
    if (o.name === 'body') body = o;
    if (o.name === 'steering') steeringWheel = o;
    if (o.name === 'wheel') wheels.push({ pivot: o, steer: o.position.z < 0, radius: T.S.R });
  });
  const S = T.S;
  const roof = Math.max(...S.cab.top.map((p) => p[1]));
  return {
    group: group0,
    body,
    wheels,
    steeringWheel,
    driverEye: T.eye.slice(),
    size: { w: S.W + 0.16, l: S.L, h: roof + (S.taxi ? 0.18 : S.rails ? 0.07 : 0) },
    headMats: [headMat, ...(signMat ? [signMat] : [])],
    brakeMats: [brakeMat],
    style,
  };
}

/** Viewer helper: all five styles side by side. */
export function carLineup(args = {}) {
  const g = new THREE.Group();
  const list = [['sedan', 0x4f8fd8], ['hatch', 0xd2453a], ['suv', 0x2f4a3a], ['taxi', null], ['van', 0xeeeeea]];
  list.forEach(([style, color], i) => {
    const c = buildCar(color == null ? { style, lights: args.lights } : { style, color, lights: args.lights });
    c.group.position.x = (i - 2) * 2.5;
    g.add(c.group);
  });
  return g;
}

/** Viewer helper: a car posed like the game drives it (front wheels yawed, wheels spun, wheel turned, body rolled). */
export function carPose(args = {}) {
  const c = buildCar(args);
  const steer = args.steer ?? 0.45;
  for (const w of c.wheels) { w.pivot.rotation.x = 0.7; if (w.steer) w.pivot.rotation.y = steer; }
  c.steeringWheel.rotation.z = steer * 3;
  c.body.rotation.z = args.roll ?? 0.03;
  return c;
}

