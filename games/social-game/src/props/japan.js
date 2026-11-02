// Japanese small-town street props for the Japan trip: paper lantern, stone lantern, street lamp,
// vending machine, bamboo fence, round post box, city bicycle, standing sign and the Fuji backdrop.
// Conventions as in street.js: metres, y up, origin at the ground centre, the side people use or read
// faces +Z. Builders return a baked Group (or {group, ...} with handles);
// group.userData.colliders = [{min, max}] (local, solid parts), group.userData.footprint = {w, d}.
// Also exports the small Japan kit (materials, text, sweep, polyLathe) that ../sites/japan.js shares.
import * as THREE from 'three';
import { mat, paint, textured, glow } from '../mat.js';
import { rbox, box, cyl, sphere, torus, lathe, extrude, tube, quad, plane, prep, put, group, bake } from '../geom.js';
import { canvasTex } from '../tex.js';
import { rng } from '../noise.js';
import { RB, CY, SP, V, D, tint, vcMat, vcGloss, vcSoft, cached } from '../sites/office.js';
import { noise3 } from './nature.js';

export const PI = Math.PI, TAU = PI * 2;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/* ================================================================== kit: text */
/** Korean first (Jua), kana and kanji fall back to a rounded Japanese face. */
export const JFONT = '"Jua", "Hiragino Maru Gothic ProN", "Hiragino Sans", "Noto Sans JP", "Apple SD Gothic Neo", sans-serif';
export function jtxt(c, s, x, y, px, color, align = 'center', base = 'middle') {
  c.font = `${px}px ${JFONT}`; c.fillStyle = color; c.textAlign = align; c.textBaseline = base; c.fillText(s, x, y);
}
/** Vertical text (one glyph under the other); the long-vowel bar is turned upright. */
export function vtxt(c, s, x, y0, px, color, step = px * 1.06) {
  [...s].forEach((ch, i) => {
    const y = y0 + i * step;
    if (ch === 'ー' || ch === '-') { c.save(); c.translate(x, y); c.rotate(PI / 2); jtxt(c, 'ー', 0, 0, px, color); c.restore(); } else jtxt(c, ch, x, y, px, color);
  });
}
export function rrect(c, x, y, w, h, r, fill, stroke, lw = 2) {
  c.beginPath(); c.roundRect(x, y, w, h, r);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
/** Speckle wash so printed surfaces are never perfectly flat. */
export function grime(c, x, y, w, h, a = 0.05, seed = 1) {
  const R = rng(seed);
  for (let i = 0; i < (w * h) / 700; i++) {
    c.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${a * R()})`;
    const s = 2 + R() * 8;
    c.fillRect(x + R() * w, y + R() * h, s, s * (0.3 + R()));
  }
}

/* ================================================================== kit: materials */
/** Shared Japan-town materials (cached; textures shared with the restaurant where possible). */
export const JM = () => cached('jpMats', () => {
  const washi = paint(0xf6efdd, 0.85, 0, { emissive: 0xffd096, emissiveIntensity: 0.85 }).clone();
  washi.side = THREE.DoubleSide; washi.name = 'jpWashi';
  const bamboo = mat('birch').clone(); bamboo.vertexColors = true; bamboo.name = 'jpBamboo';
  const tatami = textured('stripes', { color: 0xcfc490, color2: 0xbcb077, count: 40, ratio: 0.55 }, 0.6, { normal: 0.6 }).clone();
  tatami.vertexColors = true; tatami.name = 'jpTatami';
  return {
    timber: textured('wood', { color: 0x4f3221, seed: 21 }, 1.4, { normal: 0.5 }),
    tile: textured('shingles', { color: 0x3c4046, seed: 6 }, 1.1, { normal: 1.3 }),
    gravel: textured('dirt', { color: 0xb2aa9b, seed: 12 }, 1.6, { normal: 1.6 }),
    tatami,
    stone: mat('stone'),
    moss: mat('mossStone'),
    plaster: mat('plaster'),
    oak: mat('oak'),
    walnut: mat('walnut'),
    vermilion: paint(0xcc4128, 0.46, 0, { clearcoat: 0.25 }),
    lacquer: paint(0x1f1c1a, 0.34),
    washi,
    bamboo,
    water: mat('water'),
    glass: mat('glass'),
    steel: mat('steel'),
    dsteel: mat('darkSteel'),
    chrome: mat('chrome'),
    rubber: mat('rubber'),
    charcoal: paint(0x2c2b2a, 0.5, 0.35),
  };
});

/* ================================================================== kit: geometry */
/** Flip triangle winding of a non-indexed geometry in place. */
function flip(g) {
  for (const k of ['position', 'normal', 'uv', 'color']) {
    const a = g.attributes[k]; if (!a) continue;
    const s = a.itemSize, arr = a.array;
    for (let t = 0; t < arr.length; t += s * 3) for (let j = 0; j < s; j++) { const x = arr[t + s + j]; arr[t + s + j] = arr[t + s * 2 + j]; arr[t + s * 2 + j] = x; }
    a.needsUpdate = true;
  }
  if (g.attributes.normal) { const n = g.attributes.normal.array; for (let i = 0; i < n.length; i++) n[i] = -n[i]; }
}
/** Make sure triangles face `out(p)` (a function giving the wanted outward vector at a point). */
function orientTo(g, out) {
  const p = g.attributes.position, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let vote = 0;
  for (let t = 0; t < p.count; t += 3 * Math.max(1, Math.floor(p.count / 300))) {
    a.fromBufferAttribute(p, t); b.fromBufferAttribute(p, t + 1); c.fromBufferAttribute(p, t + 2);
    const n = b.clone().sub(a).cross(c.clone().sub(a));
    if (n.lengthSq() < 1e-14) continue;
    const ctr = a.clone().add(b).add(c).multiplyScalar(1 / 3);
    vote += Math.sign(n.dot(out(ctr)));
  }
  if (vote < 0) flip(g);
  return g;
}

/** Rounded-rectangle section [[x, y], ...] (counter-clockwise), centred. */
export function rsec(w, h, r = 0.02, k = 3) {
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4);
  const out = [];
  const cs = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, PI / 2], [-w / 2 + r, -h / 2 + r, PI], [w / 2 - r, -h / 2 + r, PI * 1.5]];
  for (const [cx, cy, a0] of cs) for (let i = 0; i <= k; i++) { const a = a0 + (i / k) * (PI / 2); out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return out;
}

/**
 * Sweep a closed 2D section along a 3D path (array of Vector3). Section x goes to the side
 * (up x tangent), section y to the frame's up. Smooth along the section, capped at both ends.
 */
export function sweep(section, path, up = V3(0, 1, 0), caps = true) {
  const n = section.length, m = path.length;
  const P = [], frames = [];
  const T = new THREE.Vector3(), S = new THREE.Vector3(), N = new THREE.Vector3();
  for (let j = 0; j < m; j++) {
    T.subVectors(path[Math.min(m - 1, j + 1)], path[Math.max(0, j - 1)]).normalize();
    S.crossVectors(up, T).normalize();
    N.crossVectors(T, S).normalize();
    frames.push([T.clone(), S.clone(), N.clone()]);
    for (const [sx, sy] of section) P.push(path[j].clone().addScaledVector(S, sx).addScaledVector(N, sy));
  }
  const pos = new Float32Array(P.length * 3);
  P.forEach((p, i) => p.toArray(pos, i * 3));
  const idx = [];
  for (let j = 0; j < m - 1; j++) for (let i = 0; i < n; i++) {
    const a = j * n + i, b = j * n + ((i + 1) % n), c = (j + 1) * n + ((i + 1) % n), d = (j + 1) * n + i;
    idx.push(a, b, c, a, c, d);
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g = g.toNonIndexed();
  // outward = away from the path point of the ring
  const ringOf = (p) => { let best = 0, bd = 1e9; for (let j = 0; j < m; j++) { const d = path[j].distanceToSquared(p); if (d < bd) { bd = d; best = j; } } return path[best]; };
  orientTo(g, (p) => p.clone().sub(ringOf(p)));
  // make normals agree with the winding after a possible flip
  const parts = [g];
  if (caps) {
    for (const [j, sgn] of [[0, -1], [m - 1, 1]]) {
      const cp = [], c0 = path[j];
      for (let i = 0; i < n; i++) cp.push(P[j * n + i], P[j * n + ((i + 1) % n)], c0);
      const cg = new THREE.BufferGeometry();
      cg.setAttribute('position', new THREE.Float32BufferAttribute(cp.flatMap((p) => p.toArray()), 3));
      cg.computeVertexNormals();
      const t = frames[j][0].clone().multiplyScalar(sgn);
      orientTo(cg, () => t);
      cg.computeVertexNormals();
      parts.push(cg);
    }
  }
  return prep(parts.length > 1 ? merge(parts) : g);
}
function merge(list) {
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  return g;
}

/**
 * Polygonal lathe: like lathe() but with n flat sides (hexagonal stone lanterns, square roofs).
 * pts [[r, y], ...] give the circumradius along the profile. Faces are flat across, smooth along the
 * profile where it bends less than ~35 degrees. phase rotates the polygon (0 = a corner on +X).
 */
export function polyLathe(pts, n = 6, phase = 0) {
  const cosA = Math.cos(PI / n);
  const segN = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const dr = (pts[i + 1][0] - pts[i][0]) * cosA, dy = pts[i + 1][1] - pts[i][1];
    const l = Math.hypot(dr, dy) || 1;
    segN.push([dy / l, -dr / l]);
  }
  const vn = (s, end) => {
    const a = segN[s], o = end ? segN[s + 1] : segN[s - 1];
    if (!o || a[0] * o[0] + a[1] * o[1] < 0.82) return a;
    const x = a[0] + o[0], y = a[1] + o[1], l = Math.hypot(x, y);
    return [x / l, y / l];
  };
  const pos = [], nor = [];
  for (let k = 0; k < n; k++) {
    const a0 = phase + (k / n) * TAU, a1 = phase + ((k + 1) / n) * TAU, am = (a0 + a1) / 2;
    const cx = Math.cos(am), cz = Math.sin(am);
    for (let s = 0; s < pts.length - 1; s++) {
      const [r0, y0] = pts[s], [r1, y1] = pts[s + 1];
      if (r0 < 1e-6 && r1 < 1e-6) continue;
      const n0 = vn(s, false), n1 = vn(s, true);
      const A = [r0 * Math.cos(a0), y0, r0 * Math.sin(a0)], B = [r0 * Math.cos(a1), y0, r0 * Math.sin(a1)];
      const C = [r1 * Math.cos(a1), y1, r1 * Math.sin(a1)], Dd = [r1 * Math.cos(a0), y1, r1 * Math.sin(a0)];
      const N0 = [n0[0] * cx, n0[1], n0[0] * cz], N1 = [n1[0] * cx, n1[1], n1[0] * cz];
      pos.push(...A, ...C, ...B, ...A, ...Dd, ...C);
      nor.push(...N0, ...N1, ...N0, ...N0, ...N1, ...N1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  // fix winding against the given normals
  const p = g.attributes.position, nn = g.attributes.normal;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), w = new THREE.Vector3();
  let vote = 0;
  for (let t = 0; t < p.count; t += 3) {
    a.fromBufferAttribute(p, t); b.fromBufferAttribute(p, t + 1); c.fromBufferAttribute(p, t + 2);
    const f = b.sub(a).cross(c.sub(a));
    if (f.lengthSq() < 1e-14) continue;
    w.fromBufferAttribute(nn, t);
    vote += Math.sign(f.dot(w));
  }
  if (vote < 0) { flip(g); const arr = g.attributes.normal.array; for (let i = 0; i < arr.length; i++) arr[i] = -arr[i]; }
  return prep(g);
}

/** Bamboo culm along Y (length L, radius r) with node rings, as two geometries {culm, nodes}. */
function culm(L, r, nodeEvery = 0.32, seg = 10) {
  const c = cyl(r, r, L, seg, true);
  const nodes = [];
  for (let y = -L / 2 + nodeEvery * 0.6; y < L / 2 - 0.05; y += nodeEvery) nodes.push(torus(r * 1.0, r * 0.16, 3, 6).rotateX(PI / 2).translate(0, y, 0));
  return { c, nodes };
}

/* ================================================================== paper lantern */
const lanternCache = new Map();
/**
 * paperLantern(color, {text, h}) → Group. A hanging red paper lantern (akachochin). Origin = the hook
 * point; the body hangs below it (top of body at y = -0.12, bottom at -0.12 - h).
 * userData.glowMat (emissive, put it in nightGlow), userData.lamp = {pos, color} (body centre).
 */
export function paperLantern(color = 0xcf3326, { text = '祭', h = 0.6, r = 0.2 } = {}) {
  const key = `${color}|${text}|${h}|${r}`;
  if (lanternCache.has(key)) return cloneProp(lanternCache.get(key));
  const col = new THREE.Color(color);
  const css = (k) => `#${col.clone().multiplyScalar(k).getHexString()}`;
  const ink = col.getHSL({}).l > 0.6 ? '#3a2416' : '#1d1513';
  const t = canvasTex(1024, 512, (c, w, hh) => {
    const g = c.createLinearGradient(0, 0, 0, hh);
    g.addColorStop(0, css(0.72)); g.addColorStop(0.18, css(1.0)); g.addColorStop(0.5, css(1.12)); g.addColorStop(0.82, css(1.0)); g.addColorStop(1, css(0.72));
    c.fillStyle = g; c.fillRect(0, 0, w, hh);
    grime(c, 0, 0, w, hh, 0.06, 7);
    // bamboo ribs seen through the paper
    for (let i = 1; i < 26; i++) { const y = (i / 26) * hh; c.fillStyle = 'rgba(60,10,0,0.18)'; c.fillRect(0, y - 1.5, w, 3); c.fillStyle = 'rgba(255,230,190,0.08)'; c.fillRect(0, y + 2, w, 2); }
    if (text) {
      const glyphs = [...text];
      const px = Math.min(190, (hh * 0.74) / Math.max(1, glyphs.length) / 1.04);
      for (const x0 of [w * 0.5, 0, w]) {
        c.save(); c.translate(x0, 0);
        c.shadowColor = 'rgba(0,0,0,0.25)'; c.shadowBlur = 4;
        vtxt(c, text, 0, hh * 0.5 - ((glyphs.length - 1) * px * 1.04) / 2, px, ink, px * 1.04);
        c.restore();
      }
    }
  });
  t.wrapS = THREE.RepeatWrapping;
  const glowMat = glow(0xffffff, 1.5, t);
  glowMat.color.set(0xffffff);
  glowMat.roughness = 0.75;
  glowMat.name = 'jpLantern' + color.toString(16);
  const g = new THREE.Group();
  g.name = 'paperLantern';
  const top = -0.12, N = 72, prof = [];
  for (let i = 0; i <= N; i++) {
    const v = i / N, y = top - h + v * h;
    const base = Math.pow(Math.sin(PI * (0.1 + v * 0.8)), 0.55) * r;
    const rib = 1 + 0.018 * Math.cos(v * 26 * TAU);
    prof.push(new THREE.Vector2(Math.max(0.045, base * rib), y));
  }
  const body = prep(new THREE.LatheGeometry(prof, 28, PI), true);
  const bm = put(g, body, glowMat);
  bm.castShadow = false;
  // lacquered wooden caps
  const capR = Math.pow(Math.sin(PI * 0.1), 0.55) * r;
  const lac = JM().lacquer;
  put(g, lathe([[0, 0], [capR + 0.012, 0], [capR + 0.016, 0.008], [capR + 0.016, 0.03], [capR + 0.006, 0.038], [0, 0.038]], 24), lac, 0, top - 0.018, 0);
  put(g, lathe([[0, 0], [capR + 0.016, 0], [capR + 0.016, 0.03], [capR + 0.006, 0.04], [0, 0.04]], 24), lac, 0, top - h - 0.02, 0);
  // hanger wire + cord
  put(g, torus(0.03, 0.004, 6, 16), JM().dsteel, 0, top + 0.05, 0);
  put(g, cyl(0.004, 0.004, 0.08, 6), JM().dsteel, 0, top + 0.1 - 0.02, 0);
  put(g, cyl(0.025, 0.025, 0.012, 12), JM().dsteel, 0, -0.004, 0);
  // tassel under the bottom cap
  V(g, cyl(0.006, 0.006, 0.05, 6), 0x2a1a12, 0, top - h - 0.05, 0);
  bake(g);
  g.userData.glowMat = glowMat;
  g.userData.lamp = { pos: [0, top - h / 2, 0], color: 0xffa070 };
  g.userData.colliders = [];
  g.userData.footprint = { w: r * 2, d: r * 2 };
  lanternCache.set(key, g);
  return cloneProp(g);
}
function cloneProp(src) {
  const c = src.clone();
  c.userData = { ...src.userData };
  return c;
}

/* ================================================================== stone lantern */
/**
 * stoneLantern({h}) → Group. Kasuga-style hexagonal granite lantern about 1.95 m tall (h scales it).
 * userData.glowMat: the soft light inside the fire box (nightGlow); userData.lamp = {pos}.
 */
export function stoneLantern({ h = 1.95 } = {}) {
  return cached('stoneLantern' + h, () => {
    const g = new THREE.Group();
    g.name = 'stoneLantern';
    const s = h / 1.95;
    const M = JM();
    const st = M.stone, ms = M.moss;
    const fire = glow(0xffc98a, 1.6); fire.name = 'jpStoneLanternFire';
    const ph = PI / 2 + PI / 6; // a flat face towards +Z
    const P = (pts, n = 6, m = st) => put(g, polyLathe(pts.map(([r, y]) => [r * s, y * s]), n, ph), m);
    // plinth (two stacked hex slabs) and base with a lotus ring
    P([[0, 0], [0.42, 0], [0.42, 0.1], [0.405, 0.115], [0, 0.115]], 6, ms);
    P([[0, 0.115], [0.35, 0.115], [0.35, 0.2], [0.33, 0.235], [0.24, 0.29], [0.17, 0.31], [0, 0.31]]);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const pet = sphere(0.06 * s, 10, 6).scale(1, 0.45, 1.5);
      put(g, pet, st, Math.cos(a) * 0.25 * s, 0.27 * s, Math.sin(a) * 0.25 * s, 0.35 * Math.cos(a + PI / 2), -a + PI / 2, 0);
    }
    // round shaft with a middle band
    put(g, lathe([[0.12, 0.31], [0.115, 0.36], [0.1, 0.42], [0.095, 0.66], [0.1, 0.665], [0.11, 0.67], [0.11, 0.7], [0.1, 0.705], [0.095, 0.71], [0.09, 0.95], [0.1, 0.99], [0.12, 1.0]].map(([r, y]) => [r * s, y * s]), 20), st);
    // middle platform
    P([[0, 1.0], [0.15, 1.0], [0.24, 1.06], [0.28, 1.1], [0.28, 1.16], [0.265, 1.175], [0, 1.175]]);
    // fire box: floor + roof plates, six corner posts, four solid side panels with sun / moon windows
    P([[0, 1.175], [0.215, 1.175], [0.215, 1.2], [0, 1.2]]);
    const fb0 = 1.2, fb1 = 1.5, R0 = 0.2;
    for (let k = 0; k < 6; k++) {
      const a = ph + (k / 6) * TAU;
      put(g, RB(0.045 * s, (fb1 - fb0) * s, 0.045 * s, 0.008, 1), st, Math.cos(a) * R0 * s, ((fb0 + fb1) / 2) * s, Math.sin(a) * R0 * s, 0, -a, 0);
    }
    const ap = R0 * Math.cos(PI / 6) - 0.012;
    for (let k = 0; k < 6; k++) {
      const am = ph + ((k + 0.5) / 6) * TAU;
      const front = Math.abs(Math.sin(am) - 1) < 0.01 || Math.abs(Math.sin(am) + 1) < 0.01;
      if (front) continue; // open windows to the front and back
      const pg = group(g, Math.cos(am) * ap * s, ((fb0 + fb1) / 2) * s, Math.sin(am) * ap * s, -am + PI / 2);
      put(pg, RB(R0 * s - 0.02, (fb1 - fb0) * s - 0.01, 0.03 * s, 0.006, 1), st, 0, 0, 0);
      if (k % 2) V(pg, cyl(0.045 * s, 0.045 * s, 0.032 * s, 18), 0x26211c, 0, 0.01, 0.002, PI / 2, 0, 0);
      else {
        const moon = new THREE.Shape();
        moon.absarc(0, 0, 0.048 * s, 0, TAU, false);
        const hole = new THREE.Path(); hole.absarc(0.022 * s, 0.012 * s, 0.042 * s, 0, TAU, true); moon.holes.push(hole);
        V(pg, extrude(moon, 0.032 * s), 0x26211c, 0, 0.01, -0.016 * s);
      }
    }
    // inner light: a small paper box with the glow
    const fl = put(g, RB(0.16 * s, 0.17 * s, 0.16 * s, 0.01, 1), fire, 0, 1.33 * s, 0, 0, PI / 6, 0);
    fl.castShadow = false;
    P([[0, 1.5], [0.24, 1.5], [0.24, 1.52], [0, 1.52]]);
    // roof (kasa): concave hexagonal pyramid with curled corners
    P([[0, 1.52], [0.45, 1.52], [0.47, 1.545], [0.455, 1.565], [0.38, 1.6], [0.28, 1.66], [0.2, 1.715], [0.15, 1.755], [0.13, 1.775], [0, 1.78]], 6, ms);
    for (let k = 0; k < 6; k++) {
      const a = ph + (k / 6) * TAU;
      const cg = group(g, Math.cos(a) * 0.465 * s, 1.56 * s, Math.sin(a) * 0.465 * s, -a);
      put(cg, torus(0.03 * s, 0.014 * s, 6, 12, PI * 1.3), ms, 0, 0.03 * s, 0, 0, PI / 2, -0.3);
    }
    // jewel finial on a lotus collar
    put(g, lathe([[0, 1.775], [0.1, 1.775], [0.11, 1.79], [0.08, 1.81], [0.055, 1.825], [0, 1.83]].map(([r, y]) => [r * s, y * s]), 18), st);
    put(g, lathe([[0, 1.825], [0.06, 1.835], [0.072, 1.87], [0.058, 1.91], [0.03, 1.94], [0.008, 1.955], [0, 1.955]].map(([r, y]) => [r * s, y * s]), 18), st);
    bake(g);
    g.userData.glowMat = fire;
    g.userData.lamp = { pos: [0, 1.33 * s, 0], color: 0xffc98a };
    g.userData.colliders = [{ min: [-0.36 * s, 0, -0.36 * s], max: [0.36 * s, h, 0.36 * s] }];
    g.userData.footprint = { w: 0.84 * s, d: 0.84 * s };
    return g;
  }).clone();
}

/* ================================================================== street lamp */
const bannerTex = () => cached('jpBannerTex', () => canvasTex(256, 768, (c, w, h) => {
  c.fillStyle = '#f7d9e0'; c.fillRect(0, 0, w, h);
  grime(c, 0, 0, w, h, 0.05, 3);
  c.fillStyle = '#d9486a'; c.fillRect(0, 0, w, 54); c.fillRect(0, h - 40, w, 40);
  // blossoms
  const R = rng(5);
  for (let i = 0; i < 9; i++) {
    const x = 30 + R() * (w - 60), y = 80 + R() * (h - 160), r = 10 + R() * 14;
    c.fillStyle = i % 2 ? '#f08aa6' : '#ffffff';
    for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; c.beginPath(); c.ellipse(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.5, r * 0.36, a, 0, TAU); c.fill(); }
    c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(x, y, r * 0.2, 0, TAU); c.fill();
  }
  vtxt(c, '벚꽃축제', w / 2, 150, 92, '#b3223f', 104);
  jtxt(c, 'さくらまつり', w / 2, h - 96, 34, '#b3223f');
}));
/**
 * japaneseStreetLamp() → {group, lampPos, glowMat}. A charcoal post (3.5 m) carrying a square
 * lantern head with frosted panes and a little curved roof, plus a pink festival banner on an arm.
 */
export function japaneseStreetLamp({ banner = true } = {}) {
  const src = cached('jpStreetLamp' + banner, () => {
    const g = new THREE.Group();
    g.name = 'japaneseStreetLamp';
    const M = JM(), pole = M.charcoal;
    const gm = glow(0xfff0d8, 2.2); gm.name = 'jpStreetLampGlow';
    // granite foot + flared cast base
    put(g, RB(0.42, 0.14, 0.42, 0.03, 2), M.stone, 0, 0.07, 0);
    put(g, lathe([[0, 0.14], [0.15, 0.14], [0.15, 0.17], [0.12, 0.2], [0.1, 0.32], [0.085, 0.36], [0.075, 0.42], [0.08, 0.44], [0, 0.44]], 6), pole, 0, 0, 0, 0, PI / 6, 0);
    put(g, cyl(0.055, 0.065, 3.0, 24), pole, 0, 1.94, 0);
    for (const y of [0.9, 3.0]) put(g, torus(0.065, 0.01, 6, 24), pole, 0, y, 0, PI / 2);
    // head bracket
    put(g, lathe([[0.06, 3.42], [0.1, 3.44], [0.14, 3.47], [0.14, 3.49], [0, 3.49]], 4), pole, 0, 0, 0, 0, PI / 4, 0);
    // lantern box: frosted panes (glow) inside a slim frame
    const y0 = 3.49, y1 = 3.93, hw = 0.16;
    const pane = put(g, RB(hw * 2 - 0.02, y1 - y0 - 0.02, hw * 2 - 0.02, 0.01, 1), gm, 0, (y0 + y1) / 2, 0);
    pane.castShadow = false;
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) put(g, RB(0.03, y1 - y0, 0.03, 0.006, 1), pole, sx * hw, (y0 + y1) / 2, sz * hw);
    for (const y of [y0 + 0.012, y1 - 0.012, (y0 + y1) / 2]) for (const [w, d] of [[hw * 2 + 0.03, 0.022], [0.022, hw * 2 + 0.03]]) for (const s of [-1, 1]) {
      if (y === (y0 + y1) / 2 && w > 0.1) put(g, box(w - 0.04, 0.012, 0.012), pole, 0, y, s * hw);
      else if (y === (y0 + y1) / 2) put(g, box(0.012, 0.012, d - 0.04), pole, s * hw, y, 0);
      else put(g, RB(w, 0.022, d, 0.005, 1), pole, w > 0.1 ? 0 : s * hw, y, w > 0.1 ? s * hw : 0);
    }
    // little curved hip roof + finial
    put(g, polyLathe([[0, y1], [0.3, y1], [0.31, y1 + 0.025], [0.29, y1 + 0.04], [0.2, y1 + 0.08], [0.12, y1 + 0.13], [0.06, y1 + 0.175], [0, y1 + 0.18]], 4, PI / 4), pole);
    put(g, lathe([[0, y1 + 0.17], [0.03, y1 + 0.18], [0.04, y1 + 0.22], [0.025, y1 + 0.255], [0, y1 + 0.27]], 14), M.gold ?? mat('gold'));
    for (let k = 0; k < 4; k++) { const a = PI / 4 + (k / 4) * TAU; put(g, sphere(0.018, 8, 6), pole, Math.cos(a) * 0.3, y1 + 0.035, Math.sin(a) * 0.3); }
    // festival banner on a side arm
    if (banner) {
      put(g, cyl(0.014, 0.014, 0.62, 10), pole, 0.31, 2.95, 0, 0, 0, PI / 2);
      put(g, cyl(0.012, 0.012, 0.56, 10), pole, 0.31, 1.95, 0, 0, 0, PI / 2);
      put(g, sphere(0.022, 10, 8), pole, 0.62, 2.95, 0);
      const bt = bannerTex();
      const bmat = new THREE.MeshStandardMaterial({ map: bt, roughness: 0.85, side: THREE.DoubleSide });
      bmat.name = 'jpBanner';
      const bg = new THREE.PlaneGeometry(0.5, 0.96, 6, 10);
      const p = bg.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 9 + p.getY(i) * 2) * 0.018 + p.getY(i) * p.getY(i) * 0.02);
      bg.computeVertexNormals();
      put(g, prep(bg, true), bmat, 0.34, 2.46, 0.0);
    }
    bake(g);
    g.userData.glowMat = gm;
    g.userData.colliders = [{ min: [-0.21, 0, -0.21], max: [0.21, 3.4, 0.21] }];
    g.userData.footprint = { w: 0.7, d: 0.42 };
    g.userData.lampPos = [0, (y0 + y1) / 2, 0];
    return g;
  });
  const group = cloneProp(src);
  return { group, lampPos: src.userData.lampPos, glowMat: src.userData.glowMat };
}

/* ================================================================== vending machine */
const vmTex = () => cached('jpVmTex', () => canvasTex(1024, 1024, (c, w, h) => {
  // top half: lit back panel with three rows of price tags + buttons; bottom: header, panel labels
  const bg = c.createLinearGradient(0, 0, 0, 640);
  bg.addColorStop(0, '#f4fbff'); bg.addColorStop(1, '#d8ecfa');
  c.fillStyle = bg; c.fillRect(0, 0, w, 640);
  const R = rng(4);
  for (let row = 0; row < 3; row++) {
    const y = 160 + row * 210;
    c.fillStyle = '#0f3f78'; c.fillRect(0, y, w, 46);
    for (let i = 0; i < 8; i++) {
      const x = 22 + i * 125;
      const price = [100, 120, 130, 150, 160][(R() * 5) | 0];
      rrect(c, x + 4, y + 6, 76, 30, 5, '#ffffff');
      jtxt(c, String(price), x + 42, y + 22, 24, '#1a1a1a');
      const hot = row === 2 && i > 4;
      rrect(c, x + 88, y + 8, 26, 26, 6, hot ? '#ff4d3a' : '#3aa0ff');
      c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(x + 92, y + 12, 18, 5);
    }
    jtxt(c, row === 2 ? 'あったか~い  /  つめた~い' : 'つめた~い', w / 2, y - 18, 22, 'rgba(15,63,120,0.55)');
  }
  // header band (y 650..770)
  const hg = c.createLinearGradient(0, 650, 0, 770); hg.addColorStop(0, '#1c6fd1'); hg.addColorStop(1, '#0f4b9a');
  c.fillStyle = hg; c.fillRect(0, 650, w, 120);
  jtxt(c, '시원한 음료  つめたい', w / 2, 712, 64, '#ffffff');
  // coin panel LED + labels (y 790..1010)
  c.fillStyle = '#16191d'; c.fillRect(0, 790, 300, 110);
  c.shadowColor = '#ff5b3a'; c.shadowBlur = 14;
  jtxt(c, '0120', 150, 846, 64, '#ff6a4a');
  c.shadowBlur = 0;
  rrect(c, 320, 790, 300, 110, 10, '#ffffff');
  jtxt(c, '동전  硬貨', 470, 830, 34, '#0f3f78');
  jtxt(c, '10 · 50 · 100 · 500', 470, 872, 26, '#333');
  rrect(c, 640, 790, 370, 110, 10, '#ffd43b');
  jtxt(c, '하나 더! もう1本!', 825, 846, 40, '#b3261e');
  // side band art (y 910..1024)
  const sg = c.createLinearGradient(0, 910, w, 1024); sg.addColorStop(0, '#2b86e8'); sg.addColorStop(1, '#73c7ff');
  c.fillStyle = sg; c.fillRect(0, 910, w, 114);
  for (let i = 0; i < 14; i++) { c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(40 + i * 72, 950 + (i % 3) * 20, 8 + (i % 4) * 4, 0, TAU); c.fill(); }
  jtxt(c, '냉 COLD', 860, 968, 40, '#ffffff');
}));
/** atlas sub-rect quad of the vending-machine canvas (pixels of 1024 x 1024). */
function vmQuad(w, h, [px, py, pw, ph]) {
  const g = quad(w, h), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (px + uv.getX(i) * pw) / 1024, 1 - (py + (1 - uv.getY(i)) * ph) / 1024);
  return g;
}
/**
 * vendingMachine({bin}) → {group, glowMat}. A white drink machine (1.0 x 1.83 x 0.72) with a lit
 * display of 24 cans and bottles behind glass, coin unit, pick-up bay and a recycling box on its right.
 */
export function vendingMachine({ bin = true } = {}) {
  const src = cached('jpVending' + bin, () => {
    const g = new THREE.Group();
    g.name = 'vendingMachine';
    const M = JM(), t = vmTex();
    const glowMat = glow(0xffffff, 1.25, t); glowMat.name = 'jpVendingGlow';
    const print = new THREE.MeshStandardMaterial({ map: t, roughness: 0.4 }); print.name = 'jpVendingPrint';
    const white = paint(0xeff1f0, 0.32, 0, { clearcoat: 0.5 });
    const blue = paint(0x1d5fb4, 0.35, 0, { clearcoat: 0.5 });
    const dark = paint(0x23262b, 0.45);
    const W = 1.0, H = 1.83, Dp = 0.72, zf = Dp / 2;
    put(g, RB(W + 0.04, 0.08, Dp + 0.02, 0.015, 1), dark, 0, 0.04, 0);
    // display: recessed lit box, drinks on three shelves, glass
    const dx0 = -0.45, dx1 = 0.45, dy0 = 0.98, dy1 = 1.72, FD = 0.17;
    put(g, RB(W, H - 0.08, Dp - FD + 0.02, 0.03, 3), white, 0, 0.08 + (H - 0.08) / 2, -FD / 2 + 0.01);
    put(g, RB(W, dy0 - 0.03 - 0.08, FD, 0.03, 2), white, 0, 0.08 + (dy0 - 0.11) / 2, zf - FD / 2);
    put(g, RB(W, H - 0.04 - dy1 - 0.03, FD, 0.03, 2), white, 0, (H - 0.04 + dy1 + 0.03) / 2, zf - FD / 2);
    for (const sx of [-1, 1]) put(g, RB(0.05, dy1 - dy0 + 0.1, FD, 0.012, 2), white, sx * (W / 2 - 0.025), (dy0 + dy1) / 2, zf - FD / 2);
    put(g, RB(W + 0.03, 0.07, Dp + 0.04, 0.03, 2), blue, 0, H - 0.01, 0.01);
    for (const sx of [-1, 1]) put(g, RB(0.012, 0.42, Dp - 0.1, 0.006, 1), blue, sx * (W / 2 + 0.003), 1.4, 0);
    for (const sy of [-1, 1]) put(g, RB(dx1 - dx0 + 0.06, 0.03, 0.03, 0.01, 1), dark, 0, (dy0 + dy1) / 2 + sy * ((dy1 - dy0) / 2 + 0.015), zf + 0.004);
    for (const sx of [-1, 1]) put(g, RB(0.03, dy1 - dy0 + 0.06, 0.03, 0.01, 1), dark, sx * ((dx1 - dx0) / 2 + 0.015), (dy0 + dy1) / 2, zf + 0.004);
    D(g, vmQuad(dx1 - dx0, dy1 - dy0, [0, 0, 1024, 640]), glowMat, 0, (dy0 + dy1) / 2, zf - 0.14);
    for (const sx of [-1, 1]) D(g, box(0.01, dy1 - dy0, 0.15), glowMat, sx * 0.45, (dy0 + dy1) / 2, zf - 0.07);
    const R = rng(11);
    const cans = [0xd23b2f, 0x2e7dd1, 0xf2c230, 0x2fa864, 0xf28a2e, 0x7a4a2a, 0xe9e2d0, 0x9a3fb5, 0x37b6c9];
    for (let row = 0; row < 3; row++) {
      const shelfY = dy1 - 0.02 - (row + 1) * ((dy1 - dy0) / 3) + 0.04;
      put(g, RB(0.9, 0.012, 0.13, 0.004, 1), white, 0, shelfY - 0.006, zf - 0.07);
      for (let i = 0; i < 8; i++) {
        const x = dx0 + 0.06 + i * 0.1225, col = cans[(R() * cans.length) | 0], z = zf - 0.07;
        if (R() < 0.45) {
          // PET bottle
          V(g, lathe([[0, 0], [0.032, 0], [0.034, 0.01], [0.033, 0.1], [0.03, 0.12], [0.032, 0.14], [0.022, 0.175], [0.013, 0.19], [0, 0.19]], 14), R() < 0.5 ? 0xd8e9ee : col, x, shelfY, z, 0, 0, 0, vcGloss());
          V(g, cyl(0.0345, 0.0345, 0.06, 14, true), col, x, shelfY + 0.07, z);
          V(g, cyl(0.0345, 0.0345, 0.012, 14, true), 0xffffff, x, shelfY + 0.07, z);
          V(g, cyl(0.014, 0.014, 0.02, 10), R() < 0.5 ? 0xffffff : col, x, shelfY + 0.198, z);
        } else {
          V(g, lathe([[0, 0], [0.026, 0], [0.032, 0.012], [0.032, 0.11], [0.027, 0.125], [0.024, 0.128], [0, 0.128]], 14), col, x, shelfY, z, 0, 0, 0, vcGloss());
          V(g, cyl(0.0325, 0.0325, 0.03, 14, true), R() < 0.5 ? 0xffffff : 0x222222, x, shelfY + 0.06, z, 0, 0, 0, vcGloss());
          V(g, cyl(0.022, 0.022, 0.004, 12), 0xc9ccce, x, shelfY + 0.128, z, 0, 0, 0, vcGloss());
        }
      }
    }
    D(g, quad(dx1 - dx0 + 0.02, dy1 - dy0 + 0.02), M.glass, 0, (dy0 + dy1) / 2, zf + 0.022);
    // header band (lit), coin unit, labels
    D(g, vmQuad(0.96, 0.11, [0, 650, 1024, 120]), glowMat, 0, 0.89, zf + 0.002);
    const cu = group(g, 0.3, 0.64, zf, 0);
    put(cu, RB(0.3, 0.3, 0.04, 0.01, 2), dark, 0, 0, 0.012);
    D(cu, vmQuad(0.12, 0.045, [0, 790, 300, 110]), glowMat, -0.06, 0.09, 0.033);
    put(cu, RB(0.012, 0.05, 0.012, 0.004, 1), M.chrome, 0.08, 0.09, 0.035);
    put(cu, RB(0.1, 0.012, 0.012, 0.004, 1), M.chrome, -0.04, 0.02, 0.035);
    put(cu, RB(0.05, 0.05, 0.02, 0.01, 1), M.chrome, 0.08, -0.05, 0.035);
    put(cu, RB(0.08, 0.035, 0.02, 0.008, 1), dark, -0.06, -0.08, 0.04);
    D(g, vmQuad(0.26, 0.095, [320, 790, 300, 110]), print, -0.12, 0.66, zf + 0.002);
    D(g, vmQuad(0.3, 0.09, [640, 790, 370, 110]), print, -0.12, 0.54, zf + 0.002);
    // pick-up bay
    put(g, RB(0.72, 0.28, 0.04, 0.02, 2), dark, -0.05, 0.28, zf + 0.005);
    V(g, RB(0.64, 0.2, 0.012, 0.01, 1), 0x3b4148, -0.05, 0.29, zf + 0.026, -0.12, 0, 0, vcGloss());
    put(g, RB(0.12, 0.022, 0.02, 0.008, 1), M.chrome, -0.05, 0.37, zf + 0.035);
    // side art + vents + power cable
    for (const sx of [-1, 1]) D(g, vmQuad(0.6, 0.066, [0, 910, 1024, 114]), print, sx * (W / 2 + 0.002), 0.18, 0, 0, sx * PI / 2, 0);
    for (let i = 0; i < 6; i++) put(g, RB(0.5, 0.012, 0.012, 0.004, 1), dark, 0, 0.12 + i * 0.03, -zf - 0.002);
    V(g, tube(new THREE.CatmullRomCurve3([V3(0.42, 0.12, -zf), V3(0.45, 0.04, -zf - 0.06), V3(0.6, 0.01, -zf - 0.1)]), 0.008, 12, 6), 0x1c1c1c, 0, 0, 0);
    let wTot = W;
    if (bin) {
      const b = group(g, W / 2 + 0.26, 0, 0.12, 0);
      put(b, RB(0.4, 0.82, 0.4, 0.03, 2), blue, 0, 0.42, 0);
      put(b, RB(0.42, 0.06, 0.42, 0.03, 2), white, 0, 0.84, 0);
      for (const hx of [-0.09, 0.09]) { V(b, cyl(0.055, 0.055, 0.02, 20), 0x16191d, hx, 0.66, 0.196, PI / 2, 0, 0); put(b, torus(0.058, 0.008, 6, 20), white, hx, 0.66, 0.205); }
      const lab = canvasTex(256, 128, (c, w, h) => { rrect(c, 0, 0, w, h, 14, '#ffffff'); jtxt(c, '빈 캔 · 병', w / 2, 44, 38, '#1d5fb4'); jtxt(c, 'あきかん', w / 2, 94, 32, '#1d5fb4'); });
      const lm = new THREE.MeshStandardMaterial({ map: lab, roughness: 0.5 }); lm.name = 'jpBinLabel';
      D(b, quad(0.3, 0.15), lm, 0, 0.45, 0.203);
      wTot += 0.52;
    }
    bake(g);
    g.userData.colliders = [{ min: [-W / 2, 0, -zf], max: [W / 2, H, zf] }];
    if (bin) g.userData.colliders.push({ min: [W / 2 + 0.06, 0, -0.08], max: [W / 2 + 0.46, 0.87, 0.32] });
    g.userData.footprint = { w: wTot + 0.04, d: Dp + 0.04 };
    g.userData.glowMat = glowMat;
    g.userData.lamp = { pos: [0, 1.3, zf + 0.3], color: 0xe8f4ff };
    return g;
  });
  return { group: cloneProp(src), glowMat: src.userData.glowMat };
}

/* ================================================================== bamboo fence */
/**
 * bambooFence(length) → Group. A kenninji-style fence 1.8 m tall running along X from -L/2 to +L/2:
 * close-set split bamboo, bundled rails tied with black palm rope, a capped top and timber posts.
 */
export function bambooFence(length = 4, { height = 1.8 } = {}) {
  const L = Math.max(0.8, length), H = height;
  const g = new THREE.Group();
  g.name = 'bambooFence';
  const M = JM(), bm = M.bamboo;
  const R = rng(Math.round(L * 100) + 7);
  const tones = [0xc9b17a, 0xbca46c, 0xd4bf8c, 0xb5a473, 0xc4b07f, 0xa9a06c];
  const pitch = 0.064, n = Math.floor((L - 0.1) / pitch);
  const x0 = -((n - 1) * pitch) / 2;
  const slat = RB(H - 0.1, 0.06, 0.022, 0.01, 1);
  for (let i = 0; i < n; i++) {
    const hh = H - 0.12 + (R() - 0.5) * 0.02;
    put(g, tint(slat, tones[(R() * tones.length) | 0]), bm, x0 + i * pitch, 0.06 + hh / 2, (R() - 0.5) * 0.006, 0, 0, PI / 2);
  }
  // rails: bundles of three thin culms on both faces, palm-rope ties
  for (const ry of [0.32, 0.86, 1.4]) for (const sz of [-1, 1]) {
    for (let k = 0; k < 2; k++) {
      const { c, nodes } = culm(L, 0.016, 0.62, 8);
      const yy = ry + (k - 0.5) * 0.034;
      put(g, tint(c, tones[(k + 2) % tones.length]), bm, 0, yy, sz * 0.03, 0, 0, PI / 2);
      for (const nd of nodes) put(g, tint(nd, 0x9a8a5a), bm, 0, yy, sz * 0.03, 0, 0, PI / 2);
    }
    for (let x = -L / 2 + 0.2; x < L / 2 - 0.1; x += 0.42) {
      V(g, box(0.02, 0.1, 0.018), 0x1d1915, x, ry, sz * 0.048, 0, 0, 0.6);
      V(g, box(0.02, 0.1, 0.018), 0x1d1915, x, ry, sz * 0.048, 0, 0, -0.6);
    }
  }
  // top cap (split culm) and timber posts at the ends / every ~2 m
  put(g, tint(cyl(0.035, 0.035, L, 12), 0xb19a62), bm, 0, H - 0.02, 0, 0, 0, PI / 2);
  put(g, tint(box(L, 0.03, 0.05), 0x8f7c4c), bm, 0, H - 0.05, 0);
  const posts = Math.max(1, Math.round(L / 2));
  for (let i = 0; i <= posts; i++) {
    const x = -L / 2 + 0.05 + (i / posts) * (L - 0.1);
    put(g, RB(H + 0.08, 0.09, 0.09, 0.012, 1), M.timber, x, (H + 0.08) / 2, 0, 0, 0, PI / 2);
    put(g, RB(0.13, 0.03, 0.13, 0.01, 1), M.timber, x, H + 0.095, 0);
  }
  put(g, RB(L + 0.04, 0.06, 0.12, 0.02, 1), M.stone, 0, 0.03, 0);
  bake(g);
  g.userData.colliders = [{ min: [-L / 2, 0, -0.08], max: [L / 2, H, 0.08] }];
  g.userData.footprint = { w: L, d: 0.16 };
  return g;
}

/* ================================================================== post box */
const postTex = () => cached('jpPostTex', () => canvasTex(512, 256, (c, w, h) => {
  rrect(c, 0, 0, 512, 110, 12, '#fbf7ee');
  jtxt(c, '손편지 · てがみ', 128, 56, 34, '#c8201c');
  jtxt(c, '엽서 · はがき', 384, 56, 34, '#c8201c');
  c.fillStyle = '#c8201c'; c.fillRect(254, 14, 4, 82);
  rrect(c, 20, 126, 472, 120, 12, '#f5f3ee', '#c8201c', 6);
  jtxt(c, '우편  ゆうびん', 256, 164, 40, '#c8201c');
  jtxt(c, '수거 9:30 · 15:00', 256, 216, 32, '#333');
}));
/** postBox() → Group. A red round Japanese post box (1.45 m) on a granite foot, two slots facing +Z. */
export function postBox() {
  return cached('jpPostBox', () => {
    const g = new THREE.Group();
    g.name = 'postBox';
    const M = JM();
    const red = paint(0xc8201c, 0.3, 0.05, { clearcoat: 1 });
    const dark = paint(0x7a1410, 0.4, 0.05, { clearcoat: 0.6 });
    const lab = new THREE.MeshStandardMaterial({ map: postTex(), roughness: 0.4 }); lab.name = 'jpPostLabel';
    put(g, RB(0.5, 0.1, 0.5, 0.03, 2), M.stone, 0, 0.05, 0);
    put(g, lathe([[0, 0.1], [0.215, 0.1], [0.22, 0.115], [0.21, 0.135], [0.2, 0.14], [0.2, 1.2], [0.212, 1.21], [0.24, 1.215], [0.245, 1.235], [0.232, 1.25], [0.2, 1.27], [0.16, 1.33], [0.1, 1.37], [0, 1.385]], 40), red);
    put(g, torus(0.203, 0.008, 6, 40), dark, 0, 0.3, 0, PI / 2);
    put(g, torus(0.203, 0.008, 6, 40), dark, 0, 1.05, 0, PI / 2);
    put(g, lathe([[0, 1.37], [0.03, 1.375], [0.035, 1.395], [0.022, 1.41], [0, 1.415]], 16), dark);
    // slots with hoods
    for (const s of [-1, 1]) {
      const a = s * 0.33;
      const sg = group(g, Math.sin(a) * 0.2, 1.0, Math.cos(a) * 0.2, a);
      put(sg, RB(0.1, 0.022, 0.03, 0.008, 1), mat('blackPlastic'), 0, 0, 0);
      put(sg, RB(0.13, 0.016, 0.06, 0.007, 1), red, 0, 0.032, 0.012, 0.15, 0, 0);
    }
    // curved label + plate wrapped on the body
    const wrap = (r, a0, a1, y, h, rect) => {
      const geo = prep(new THREE.CylinderGeometry(r, r, h, 16, 1, true, a0, a1 - a0), true), uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (rect[0] + uv.getX(i) * rect[2]) / 512, 1 - (rect[1] + (1 - uv.getY(i)) * rect[3]) / 256);
      return put(g, geo, lab, 0, y, 0);
    };
    wrap(0.2015, -0.75, 0.75, 0.9, 0.07, [0, 0, 512, 110]);
    wrap(0.2015, -0.55, 0.55, 0.62, 0.13, [20, 126, 472, 120]);
    // collection door at the back
    put(g, prep(new THREE.CylinderGeometry(0.205, 0.205, 0.5, 16, 1, true, PI - 0.5, 1.0)), red, 0, 0.62, 0);
    put(g, cyl(0.012, 0.012, 0.012, 12), mat('chrome'), 0.06, 0.75, -0.205, PI / 2);
    bake(g);
    g.userData.colliders = [{ min: [-0.25, 0, -0.25], max: [0.25, 1.4, 0.25] }];
    g.userData.footprint = { w: 0.5, d: 0.5 };
    return g;
  }).clone();
}

/* ================================================================== bicycle */
/**
 * bicycle({color}) → Group. A step-through city bike (mamachari) on its centre stand, wheels along X
 * (front wheel at +X) so its side faces +Z. Front wire basket, rear rack, chain case, bell, lamp.
 */
export function bicycle({ color = 0x8fcab9, seed = 1 } = {}) {
  return cached('jpBike' + color + seed, () => {
    const g = new THREE.Group();
    g.name = 'bicycle';
    const M = JM();
    const frame = paint(color, 0.3, 0.1, { clearcoat: 0.8 });
    const chrome = M.chrome, rub = M.rubber, blk = paint(0x26272b, 0.45);
    const WR = 0.33, xr = -0.52, xf = 0.54;
    const T = (pts, r, m = frame, seg = 24) => put(g, tube(new THREE.CatmullRomCurve3(pts.map((p) => V3(...p))), r, seg, 10), m);
    // wheels: tyre, rim, hub, spokes
    for (const x of [xr, xf]) {
      put(g, torus(WR - 0.02, 0.021, 10, 40), rub, x, WR, 0);
      put(g, torus(WR - 0.045, 0.008, 6, 40), chrome, x, WR, 0);
      put(g, cyl(0.022, 0.022, 0.1, 12), chrome, x, WR, 0, PI / 2);
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU, side = i % 2 ? 1 : -1;
        const p0 = V3(x, WR, side * 0.035), p1 = V3(x + Math.cos(a) * (WR - 0.05), WR + Math.sin(a) * (WR - 0.05), side * 0.006);
        const d = p1.clone().sub(p0), len = d.length();
        const sp = cyl(0.0016, 0.0016, len, 4);
        const m = put(g, sp, chrome, (p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2);
        m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
      }
      // mudguard
      put(g, torus(WR + 0.03, 0.022, 6, 28, PI * 0.95), chrome, x, WR, 0, 0, 0, x < 0 ? 0.1 : 0.0).scale.set(1, 1, 1.6);
    }
    // frame: step-through down tube, seat tube, chain/seat stays, head tube, fork
    const bb = [-0.05, 0.3, 0], head = [0.36, 0.86, 0], seatTop = [-0.2, 0.86, 0];
    T([[head[0] - 0.02, 0.82, 0], [0.28, 0.6, 0], [0.12, 0.36, 0], bb], 0.022);
    T([[0.33, 0.7, 0], [0.18, 0.5, 0], [0.02, 0.4, 0], [-0.12, 0.62, 0]], 0.016);
    T([bb, [-0.12, 0.55, 0], seatTop], 0.019);
    for (const s of [-1, 1]) {
      T([bb, [xr * 0.5, 0.31, s * 0.03], [xr, WR, s * 0.05]], 0.011);
      T([[-0.18, 0.78, s * 0.012], [-0.35, 0.56, s * 0.04], [xr, WR, s * 0.05]], 0.011);
      T([[0.37, 0.8, s * 0.015], [0.43, 0.6, s * 0.04], [xf + 0.01, WR, s * 0.05]], 0.013, chrome);
    }
    put(g, cyl(0.026, 0.026, 0.16, 16), frame, head[0], 0.84, 0, 0, 0, -0.33);
    // stem, swept-back bar, grips, bell
    put(g, cyl(0.014, 0.014, 0.22, 10), chrome, 0.32, 1.0, 0, 0, 0, -0.33);
    T([[0.12, 1.06, -0.28], [0.22, 1.1, -0.24], [0.29, 1.1, -0.1], [0.29, 1.1, 0], [0.29, 1.1, 0.1], [0.22, 1.1, 0.24], [0.12, 1.06, 0.28]], 0.011, chrome, 30);
    for (const s of [-1, 1]) put(g, capsule(0.017, 0.08), blk, 0.1, 1.055, s * 0.29, PI / 2, 0, 0.1);
    put(g, sphere(0.026, 14, 8).scale(1, 0.7, 1), chrome, 0.24, 1.12, 0.17);
    // saddle on a chrome post
    put(g, cyl(0.012, 0.012, 0.14, 10), chrome, -0.22, 0.92, 0, 0, 0, 0.3);
    const sh = new THREE.Shape();
    sh.moveTo(0.13, 0); sh.bezierCurveTo(0.13, 0.03, 0.04, 0.035, -0.02, 0.075); sh.bezierCurveTo(-0.08, 0.1, -0.13, 0.09, -0.13, 0);
    sh.bezierCurveTo(-0.13, -0.09, -0.08, -0.1, -0.02, -0.075); sh.bezierCurveTo(0.04, -0.035, 0.13, -0.03, 0.13, 0);
    const sad = extrude(sh, 0.035, 0.015);
    put(g, sad, blk, -0.23, 0.975, 0, PI / 2, 0, 0);
    // chain case, crank, pedals
    const cs = new THREE.Shape();
    cs.absarc(0, 0, 0.11, PI / 2, PI * 1.5, false); cs.lineTo(xr + 0.05 - bb[0], -0.05); cs.absarc(xr + 0.05 - bb[0], 0, 0.05, -PI / 2, PI / 2, false); cs.lineTo(0, 0.11);
    put(g, extrude(cs, 0.03, 0.008), frame, bb[0], bb[1], 0.055);
    put(g, cyl(0.035, 0.035, 0.012, 16), chrome, bb[0], bb[1], 0.1, PI / 2);
    for (const s of [-1, 1]) {
      const cg = group(g, bb[0], bb[1], s * 0.1, 0);
      cg.rotation.z = s > 0 ? -1.0 : PI - 1.0;
      put(cg, RB(0.17, 0.022, 0.012, 0.006, 1), chrome, 0.08, 0, 0);
      put(cg, RB(0.05, 0.022, 0.1, 0.006, 1), blk, 0.165, 0, s * 0.05, 0, 0, -cg.rotation.z);
    }
    // rear rack + reflector, centre stand
    for (const s of [-1, 1]) T([[xr, WR, s * 0.06], [xr + 0.02, 0.6, s * 0.08], [xr + 0.04, 0.72, s * 0.08]], 0.006, chrome, 8);
    for (let i = 0; i < 4; i++) put(g, cyl(0.006, 0.006, 0.17, 6), chrome, xr - 0.15 + i * 0.1, 0.72, 0, PI / 2, 0, 0);
    for (const s of [-1, 1]) put(g, cyl(0.007, 0.007, 0.4, 6), chrome, xr + 0.0, 0.72, s * 0.08, 0, 0, PI / 2);
    V(g, RB(0.012, 0.04, 0.08, 0.006, 1), 0xd42a20, xr - 0.36, 0.62, 0, 0, 0, 0, vcGloss());
    for (const s of [-1, 1]) T([[xr, WR, s * 0.06], [xr - 0.02, 0.15, s * 0.14], [xr - 0.03, 0.01, s * 0.17]], 0.008, chrome, 8);
    put(g, cyl(0.007, 0.007, 0.34, 6), chrome, xr - 0.03, 0.015, 0, PI / 2);
    // wheel lock (ring) on the rear stays + front dynamo lamp
    V(g, RB(0.07, 0.09, 0.03, 0.01, 1), 0xd8d8d8, xr + 0.13, 0.42, 0.05, 0, 0, 0.6, vcGloss());
    put(g, cyl(0.028, 0.032, 0.07, 14), chrome, xf - 0.06, 0.7, 0, 0, 0, PI / 2);
    V(g, cyl(0.026, 0.026, 0.004, 14), 0xfff2c0, xf - 0.024, 0.7, 0, 0, 0, PI / 2, vcGloss());
    // front basket
    const bk = group(g, xf - 0.02, 0.9, 0, 0);
    const bw = 0.24, bdz = 0.34, bh = 0.24;
    for (const y of [0, bh * 0.5, bh]) {
      const pts = [];
      const ex = bw / 2 + y * 0.08, ez = bdz / 2 + y * 0.06;
      for (const [x, z] of [[ex, ez], [-ex, ez], [-ex, -ez], [ex, -ez], [ex, ez]]) pts.push(V3(x, y, z));
      put(bk, tube(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.02), y === bh ? 0.006 : 0.0035, 48, 6), chrome);
    }
    for (let i = 0; i <= 6; i++) for (const s of [-1, 1]) {
      const z = -bdz / 2 + (i / 6) * bdz;
      const a = V3(s * bw / 2, 0, z), b = V3(s * (bw / 2 + bh * 0.08), bh, z * (1 + bh * 0.35));
      const d = b.clone().sub(a);
      const m = put(bk, cyl(0.0025, 0.0025, d.length(), 4), chrome, (a.x + b.x) / 2, bh / 2, (a.z + b.z) / 2);
      m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
    }
    for (let i = 0; i <= 4; i++) for (const s of [-1, 1]) {
      const x = -bw / 2 + (i / 4) * bw;
      const a = V3(x, 0, s * bdz / 2), b = V3(x * 1.1, bh, s * (bdz / 2 + bh * 0.06));
      const d = b.clone().sub(a);
      const m = put(bk, cyl(0.0025, 0.0025, d.length(), 4), chrome, (a.x + b.x) / 2, bh / 2, (a.z + b.z) / 2);
      m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
    }
    for (let i = 0; i < 5; i++) put(bk, cyl(0.003, 0.003, bdz, 4), chrome, -bw / 2 + (i + 0.5) * bw / 5, 0, 0, PI / 2);
    // a shopping bag in the basket
    V(bk, RB(0.16, 0.16, 0.26, 0.03, 2), 0xf4efe4, 0, 0.09, 0, 0, 0.1, 0.05, vcSoft());
    V(bk, torus(0.05, 0.006, 4, 12, PI), 0xf4efe4, 0, 0.17, 0.05, 0, PI / 2, 0, vcSoft());
    V(bk, capsule(0.03, 0.12), 0x2f8f3a, 0.03, 0.2, -0.06, 0.3, 0, 0.4, vcSoft());
    T([[xf - 0.04, 0.9, -0.08], [0.33, 1.0, -0.03]], 0.006, chrome, 4);
    T([[xf - 0.04, 0.9, 0.08], [0.33, 1.0, 0.03]], 0.006, chrome, 4);
    bake(g);
    g.userData.colliders = [{ min: [-0.88, 0, -0.3], max: [0.9, 1.15, 0.3] }];
    g.userData.footprint = { w: 1.8, d: 0.6 };
    return g;
  }).clone();
}
function capsule(r, len) { return prep(new THREE.CapsuleGeometry(r, len, 4, 10)); }

/* ================================================================== sign board */
const signCache = new Map();
/**
 * signBoard(text, {color}) → Group. A standing lit shop sign (andon kanban): paper faces with vertical
 * text front and back, in a dark timber frame with a small tiled roof, 1.45 m tall.
 * userData.glowMat (nightGlow).
 */
export function signBoard(text = '라멘 ラーメン', { color = 0xb3261e } = {}) {
  const key = text + color;
  if (signCache.has(key)) return cloneProp(signCache.get(key));
  const M = JM();
  const parts = text.split(' ');
  const col = '#' + new THREE.Color(color).getHexString();
  const t = canvasTex(256, 640, (c, w, h) => {
    c.fillStyle = '#f8f1e2'; c.fillRect(0, 0, w, h);
    grime(c, 0, 0, w, h, 0.05, 9);
    c.fillStyle = col; c.fillRect(0, 0, w, 26); c.fillRect(0, h - 26, w, 26);
    const big = parts[0] ?? '', small = parts.slice(1).join(' ');
    const n = [...big].length;
    const px = Math.min(150, 380 / Math.max(1, n));
    vtxt(c, big, small ? w * 0.6 : w / 2, 60 + px * 0.5, px, col, px * 1.04);
    if (small) vtxt(c, small, w * 0.2, 80, Math.min(56, 470 / [...small].length), '#2b1a10', Math.min(60, 480 / [...small].length));
  });
  const gm = glow(0xffffff, 1.3, t); gm.name = 'jpSignGlow';
  const g = new THREE.Group();
  g.name = 'signBoard';
  const W = 0.4, H = 1.0, Dd = 0.26, y0 = 0.3;
  for (const s of [-1, 1]) D(g, quad(W - 0.04, H - 0.04), gm, 0, y0 + H / 2, s * (Dd / 2 - 0.01), 0, s > 0 ? 0 : PI, 0);
  D(g, box(0.004, H - 0.04, Dd - 0.04), gm, W / 2 - 0.02, y0 + H / 2, 0);
  D(g, box(0.004, H - 0.04, Dd - 0.04), gm, -W / 2 + 0.02, y0 + H / 2, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, RB(H + y0 + 0.02, 0.04, 0.04, 0.008, 1), M.timber, sx * W / 2, (H + y0) / 2 + 0.01, sz * Dd / 2, 0, 0, PI / 2);
  for (const y of [y0, y0 + H]) for (const sz of [-1, 1]) put(g, RB(W + 0.03, 0.04, 0.035, 0.008, 1), M.timber, 0, y, sz * Dd / 2);
  for (const y of [y0, y0 + H]) for (const sx of [-1, 1]) put(g, RB(0.035, 0.04, Dd, 0.008, 1), M.timber, sx * W / 2, y, 0);
  put(g, RB(W + 0.08, 0.06, Dd + 0.08, 0.015, 1), M.timber, 0, 0.03, 0);
  // little roof
  put(g, polyLathe([[0, y0 + H + 0.02], [0.37, y0 + H + 0.02], [0.37, y0 + H + 0.045], [0.25, y0 + H + 0.1], [0.12, y0 + H + 0.15], [0, y0 + H + 0.16]], 4, PI / 4).scale(1, 1, Dd / W + 0.15), M.tile, 0, 0, 0);
  put(g, RB(0.5, 0.04, 0.05, 0.015, 1), M.lacquer, 0, y0 + H + 0.16, 0);
  bake(g);
  g.userData.glowMat = gm;
  g.userData.colliders = [{ min: [-0.25, 0, -0.18], max: [0.25, 1.45, 0.18] }];
  g.userData.footprint = { w: 0.5, d: 0.36 };
  signCache.set(key, g);
  return cloneProp(g);
}

/* ================================================================== Fuji backdrop */
/**
 * fujiBackdrop({height, radius}) → {group, material}. A snow-capped volcano for the horizon: base on
 * y = 0 (slopes ease into the ground), about 280 m tall and 1400 m across, flat crater top, concave
 * slopes, radial gullies with snow running down them. Vertex coloured MeshStandardMaterial, no
 * shadows; the game sets material.fog = false and tints it for distance. ~38k triangles.
 */
export function fujiBackdrop({ height = 280, radius = 700, seed = 3 } = {}) {
  const H = height, Rr = radius;
  const NS = 176, NR = 106;
  const rc = 0.042; // crater rim (fraction of the radius)
  const pos = new Float32Array((NR + 1) * NS * 3 + 3), col = new Float32Array((NR + 1) * NS * 3 + 3);
  const cSnow = new THREE.Color(0xf3f6fa), cSnowB = new THREE.Color(0xdfe7f0), cRock = new THREE.Color(0x5e6577), cRock2 = new THREE.Color(0x6e6870);
  const cForest = new THREE.Color(0x48604f), cFoot = new THREE.Color(0x5d7258), c = new THREE.Color();
  const ridge = (th, s, f, sd) => {
    const n = noise3(Math.cos(th) * f, Math.sin(th) * f, s * 2.4 + sd * 0.37, seed + sd);
    return 1 - Math.abs(2 * n - 1);
  };
  const hAt = (th, t) => {
    // t: 0 at the centre .. 1 at the foot
    if (t <= rc) {
      const k = t / rc;
      return H * (0.992 - 0.012 * (1 - k * k)) + H * 0.006 * (noise3(Math.cos(th) * 3, Math.sin(th) * 3, 0, seed) - 0.5);
    }
    const s = (t - rc) / (1 - rc);
    let h = H * Math.pow(1 - s, 1.8);
    // rounded rim
    h -= H * 0.008 * Math.exp(-s * 60);
    // a shoulder on one flank (old side crater)
    const dth = Math.atan2(Math.sin(th - 0.7), Math.cos(th - 0.7));
    h += H * 0.03 * Math.exp(-(dth * dth) / 0.03 - ((s - 0.42) * (s - 0.42)) / 0.006);
    // radial gullies, strongest mid-slope
    const amp = sstep(0.03, 0.22, s) * (1 - sstep(0.55, 0.95, s));
    const g1 = ridge(th, s, 9, 1), g2 = ridge(th, s, 23, 2);
    h -= H * amp * (0.024 * (g1 - 0.35) + 0.01 * (g2 - 0.35)); // thin channels cut into broad slopes
    // gentle undulation at the foot
    h += H * 0.012 * (1 - sstep(0.7, 1, s)) * sstep(0.45, 0.8, s) * (noise3(Math.cos(th) * 4, Math.sin(th) * 4, s * 3, seed + 5) - 0.5);
    return Math.max(0, h);
  };
  let o = 0;
  const tOf = (i) => rc + (1 - rc) * Math.pow(i / NR, 1.32);
  for (let i = 0; i <= NR; i++) {
    const t = i === 0 ? rc * 0.999 : tOf(i);
    for (let j = 0; j < NS; j++) {
      const th = (j / NS) * TAU;
      const h = hAt(th, t);
      pos[o] = Math.cos(th) * t * Rr; pos[o + 1] = h; pos[o + 2] = Math.sin(th) * t * Rr;
      const s = (t - rc) / (1 - rc), hf = h / H;
      const ch1 = ridge(th, s, 9, 1), ch2 = ridge(th, s, 23, 2); // 1 inside a gully channel
      // snow line: ragged by noise, running further down inside the gullies
      const line = 0.6 + 0.07 * (noise3(Math.cos(th) * 5, Math.sin(th) * 5, 1.3, seed + 9) - 0.5) - 0.16 * sstep(0.55, 0.95, ch1) - 0.07 * sstep(0.6, 0.95, ch2);
      const sn = sstep(line - 0.01, line + 0.01, hf);
      const rockMix = noise3(Math.cos(th) * 7, Math.sin(th) * 7, s * 4, seed + 3);
      c.copy(cRock).lerp(cRock2, rockMix);
      c.lerp(cForest, sstep(0.36, 0.2, hf));
      c.lerp(cFoot, sstep(0.12, 0.02, hf));
      c.multiplyScalar(1.02 - 0.16 * ch1);
      const sc = cSnowB.clone().lerp(cSnow, 1 - 0.6 * ch1);
      c.lerp(sc, sn);
      col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
      o += 3;
    }
  }
  const top = (NR + 1) * NS;
  pos[o] = 0; pos[o + 1] = hAt(0, 0) - H * 0.006; pos[o + 2] = 0;
  c.copy(cSnowB); col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
  const idx = [];
  for (let i = 0; i < NR; i++) for (let j = 0; j < NS; j++) {
    const a = i * NS + j, b = i * NS + ((j + 1) % NS), cc = (i + 1) * NS + ((j + 1) % NS), d = (i + 1) * NS + j;
    idx.push(a, cc, b, a, d, cc);
  }
  for (let j = 0; j < NS; j++) idx.push(top, j, (j + 1) % NS);
  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // make sure the outside faces up / out
  const n0 = geo.attributes.normal;
  let up = 0; for (let i = 0; i < n0.count; i += 97) up += n0.getY(i);
  if (up < 0) { const ix = geo.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } geo.computeVertexNormals(); }
  geo = prep(geo);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, envMapIntensity: 0.6 });
  material.name = 'fuji';
  const m = new THREE.Mesh(geo, material);
  m.castShadow = false; m.receiveShadow = false;
  m.frustumCulled = true;
  const g = new THREE.Group();
  g.name = 'fujiBackdrop';
  g.add(m);
  g.userData.footprint = { w: Rr * 2, d: Rr * 2 };
  g.userData.colliders = [];
  return { group: g, material };
}

/* ================================================================== viewer lineup */
/** japanProps() → Group with every prop in a row along X (viewer only). */
export function japanProps() {
  const g = new THREE.Group();
  const place = (o, x, z = 0, y = 0, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; g.add(o); };
  place(japaneseStreetLamp().group, -6.2, -0.4);
  place(stoneLantern(), -4.6, 0);
  place(vendingMachine().group, -2.6, -0.2);
  place(postBox(), -0.9, 0.2);
  place(bicycle(), 0.7, 0.3);
  place(signBoard('라멘 ラーメン'), 2.3, 0.2);
  place(bambooFence(3.2), 4.6, -0.5);
  // two lanterns hanging from a little gate beam
  const beam = new THREE.Group();
  put(beam, RB(2.0, 0.12, 0.12, 0.02, 1), JM().timber, 0, 2.4, 0);
  for (const s of [-1, 1]) put(beam, RB(2.46, 0.12, 0.12, 0.02, 1), JM().timber, s * 0.95, 1.23, 0, 0, 0, PI / 2);
  bake(beam);
  place(beam, 7.6, 0.2);
  place(paperLantern(0xcf3326, { text: '라멘' }), 7.15, 0.2, 2.34);
  place(paperLantern(0xf2ead6, { text: 'ラーメン' }), 8.05, 0.2, 2.34);
  return g;
}
