// Soft furnishings kit (인혁: "베개 같은 거 다 퀄리티 올려줘"): pillows sewn from two pieces (thick in the
// middle, pinched to a seam, wrinkled at the corners, dented where a head lies), piped box cushions
// that sag where you sit, duvets that drape over the mattress edge with folds at the corners and
// quilted puffs on top, futons, folded blankets and pleated curtains. Fabric materials have a weave
// normal map and sheen.
//
// Every shape is made once per size (memo) and shared, never mutated (tint() in office.js copies a
// shared geometry before colouring it). Rooms bake() into one mesh per material, so the plain cloth
// (vertex coloured) costs one draw call per room and each printed fabric one more.
import * as THREE from 'three';
import { prep } from './geom.js';
import { textured } from './mat.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const PI = Math.PI;
const GEO = new Map();
const memo = (name, fn) => (...a) => {
  const k = name + JSON.stringify(a);
  let g = GEO.get(k);
  if (!g) { g = fn(...a); g.userData.shared = true; GEO.set(k, g); }
  return g;
};
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* ============================================================== materials */
const MATS = new Map();
const once = (k, f) => { if (!MATS.has(k)) MATS.set(k, f()); return MATS.get(k); };
function vc(m, name) { const c = m.clone(); c.vertexColors = true; c.color.set(0xffffff); c.name = name; return c; }
/** Plain cotton with a visible weave and sheen, coloured per vertex (V(..., clothMat())). */
export const clothMat = () => once('cloth', () => vc(textured('cotton', { weave: 96, seed: 21 }, 0.2, { normal: 1.1, physical: true, sheen: 0.55 }), 'softCloth'));
/** Soft velvet-ish upholstery for throw pillows: deeper sheen. */
export const velvetMat = () => once('velvet', () => { const m = vc(textured('cotton', { weave: 160, seed: 33 }, 0.15, { normal: 0.6, physical: true, sheen: 1 }), 'softVelvet'); m.sheenRoughness = 0.35; return m; });
/** Printed / woven pattern fabrics (they carry their own colours). */
export const printMat = (gen, params, tile = 0.4, sheen = 0.5) => textured(gen, params, tile, { normal: 0.9, physical: true, sheen });
export const terryMat = (color, band) => textured('terry', { color, band }, 0.35, { normal: 1.4 });
/** Terry towels, coloured per vertex. */
export const towelMat = () => once('towel', () => vc(textured('terry', { color: 0xffffff }, 0.3, { normal: 1.4 }), 'softTowel'));
export const knitMat = (color) => textured('knit', { color }, 0.28, { normal: 1.6, physical: true, sheen: 0.4 });

/* ============================================================== pillow */
/**
 * Pillow lying flat: w along X, thickness h along Y, d along Z. Two cloth panels meet at a crisp seam;
 * the sides draw in a little so the corners poke out; creases fan out from the corners; `dent` presses
 * the top where a head rests. Bottom panel flatter (it lies on something).
 */
function pillowRaw(w, h, d, seed = 1, dent = 0, nu = 18, nv = 14) {
  const pos = [], uv = [], idx = [];
  const R = (k) => { const t = Math.sin(seed * 91.7 + k * 37.3) * 4375.85; return t - Math.floor(t); };
  const ph = [R(1) * 6, R(2) * 6, R(3) * 6, R(4) * 6];
  const panel = (top) => {
    const base = pos.length / 3;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = -1 + 2 * i / nu, v = -1 + 2 * j / nv;
      // outline: sides drawn in at their middles, corners poke out
      const x = (w / 2) * u * (1 - 0.07 * (1 - v * v)), z = (d / 2) * v * (1 - 0.07 * (1 - u * u));
      const au = Math.abs(u), av = Math.abs(v);
      let t = Math.pow(Math.max(0, 1 - au ** 2.6), 0.55) * Math.pow(Math.max(0, 1 - av ** 2.6), 0.55);
      // wrinkles: soft folds over the top, creases fanning from each corner, ripples along the seam
      const corner = sstep(0.45, 1, au) * sstep(0.45, 1, av);
      const fan = Math.sin(Math.atan2(v * Math.sign(v || 1), u * Math.sign(u || 1)) * 9 + ph[0] + Math.sign(u) * 1.7 + Math.sign(v) * 0.9);
      const edge = Math.max(sstep(0.7, 1, au), sstep(0.7, 1, av));
      t += corner * fan * 0.09 + edge * Math.sin((u + v) * 7 + ph[1]) * 0.05 * (1 - corner);
      t += 0.05 * Math.sin(u * 4.1 + ph[2]) * Math.sin(v * 3.3 + ph[3]) * (1 - edge);
      if (top && dent) t *= 1 - dent * Math.exp(-((u - 0.08) ** 2 / 0.22 + (v + 0.05) ** 2 / 0.3));
      t = Math.max(0, t) * (top ? 1 : 0.78);
      const y = (h / 2) * t * (top ? 1 : -1);
      pos.push(x, y, z); uv.push(x, z);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = base + j * (nu + 1) + i, b = a + 1, c = a + nu + 1, e = c + 1;
      if (top) idx.push(a, c, b, b, c, e); else idx.push(a, b, c, b, e, c);
    }
  };
  panel(true); panel(false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();          // the panels do not share seam vertices: a crisp seam line
  return g;
}
/** Bed pillow lying flat (thickness along Y). */
export const pillow = memo('pillow', (w, h, d, seed = 1, dent = 0.3) => prep(pillowRaw(w, h, d, seed, dent, 14, 10), true));
/** Throw pillow standing up: w along X, h along Y, thickness t along Z. */
export const throwPillow = memo('throw', (w, h, t, seed = 1) => prep(pillowRaw(w, t, h, seed, 0, 12, 12).rotateX(PI / 2), true));
/** Round bolster / Japanese pillow (soba-gara makura): a pillow with a fat round middle, along X. */
export const bolster = memo('bolster', (len, r, seed = 1) => prep(pillowRaw(len, r * 2, r * 2.1, seed, 0, 16, 10), true));

/* ============================================================== box cushion */
/**
 * Box cushion (sofa seats and backs, mattresses, zabuton): rounded box with welted piping along the
 * top and bottom edges, puffed faces, a dip where you sit (`sag`), small creases near the edges and an
 * optional button tuft in the middle of the top and bottom (`tuft`).
 */
function cushionRaw(w, h, d, r, puff, sag, seed, tuft, pipe, tg = 0) {
  const sg = (v) => clamp(Math.round(v / 0.08) + 3, 4, 12);
  const raw = new THREE.BoxGeometry(w, h, d, sg(w), sg(h), sg(d));
  const p = raw.attributes.position;
  // vertices crowd towards the edges so the rounding and the piping get enough of them
  const crowd = (x, half) => { const t = clamp(x / half, -1, 1); return Math.sign(t) * (1 - (1 - Math.abs(t)) ** 1.8) * half; };
  const iw = w / 2 - r, ih = h / 2 - r, id = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    const x = crowd(p.getX(i), w / 2), y = crowd(p.getY(i), h / 2), z = crowd(p.getZ(i), d / 2);
    const cx = clamp(x, -iw, iw), cy = clamp(y, -ih, ih), cz = clamp(z, -id, id);
    const dx = x - cx, dy = y - cy, dz = z - cz, len = Math.hypot(dx, dy, dz) || 1;
    const k = len > r ? r / len : 1;
    p.setXYZ(i, cx + dx * k, cy + dy * k, cz + dz * k);
  }
  const ph = seed * 1.7;
  const g = displaceKeepUV(raw, (x, y, z) => {
    const fx = Math.max(0, 1 - (2 * x / w) ** 2), fz = Math.max(0, 1 - (2 * z / d) ** 2), fy = Math.max(0, 1 - (2 * y / h) ** 2);
    const cx = clamp(x, -iw, iw), cy = clamp(y, -ih, ih), cz = clamp(z, -id, id);
    const hx = Math.hypot(x - cx, z - cz), vy = Math.abs(y - cy);
    // piping: a ridge where the top/bottom panel meets the side band (45 degrees round the edge)
    let off = 0;
    if (hx > 1e-4 && vy > 1e-4) off += pipe * Math.exp(-(((Math.atan2(vy, hx) - PI / 4) / 0.2) ** 2));
    const topF = y > 0 ? 1 : 0.45;
    off += puff * fx * fz * topF + puff * 0.35 * fy * (fx + fz) * 0.5;
    off -= sag * Math.exp(-((x / (w * 0.32)) ** 2 + ((z - d * 0.06) / (d * 0.34)) ** 2)) * (y > 0 ? 1 : 0);
    if (tuft && Math.abs(y) > ih) {
      // one button in the middle, or a diamond grid of buttons (tufted headboards)
      let gx = 0, gz = 0;
      if (tg) { const row = Math.round(z / tg); gz = row * tg; gx = (Math.round(x / tg - (row % 2) * 0.5) + (row % 2) * 0.5) * tg; if (Math.abs(gx) > w / 2 - tg * 0.4 || Math.abs(gz) > d / 2 - tg * 0.4) gx = 1e3; }
      off -= tuft * Math.exp(-((x - gx) ** 2 + (z - gz) ** 2) / (tg ? 0.0009 : 0.0016));
    }
    // creases near the edges of the top, fading to the middle
    const edge = 1 - fx * fz;
    off += 0.0035 * edge * Math.sin(x * 31 + z * 23 + ph) * Math.sin(x * 13 - z * 17 + ph * 2) + 0.0015 * Math.sin(x * 57 + ph) * Math.sin(z * 49 + ph);
    return off;
  });
  return g;
}
const cr = (w, h, d, r) => Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
/** Box cushion with its panels on top and bottom (seats, mattresses, zabuton): w x h x d along X, Y, Z. */
export const cushion = memo('cushion', (w, h, d, r = 0.05, puff = 0.02, sag = 0, seed = 1, tuft = 0, pipe = 0.005, tg = 0) => cushionRaw(w, h, d, cr(w, h, d, r), puff, sag, seed, tuft, pipe, tg));
/** Same with its panels facing front and back (back cushions, headboards): thickness d along Z. */
export const cushionZ = memo('cushionZ', (w, h, d, r = 0.05, puff = 0.02, seed = 1, tuft = 0, pipe = 0.005, tg = 0) => cushionRaw(w, d, h, cr(w, d, h, r), puff, 0, seed, tuft, pipe, tg).rotateX(PI / 2));
/** Same with its panels facing the sides (sofa arms): thickness w along X. */
export const cushionX = memo('cushionX', (w, h, d, r = 0.05, puff = 0.01, seed = 1, pipe = 0.005) => cushionRaw(h, w, d, cr(h, w, d, r), puff, 0, seed, 0, pipe).rotateZ(PI / 2));

/** geom.js displace() but with metric box UVs computed afterwards (kept separate so prints line up). */
function displaceKeepUV(geo, fn) {
  let g = geo.clone();
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVerts(g);
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const dd = fn(p.getX(i), p.getY(i), p.getZ(i));
    p.setXYZ(i, p.getX(i) + n.getX(i) * dd, p.getY(i) + n.getY(i) * dd, p.getZ(i) + n.getZ(i) * dd);
  }
  g.computeVertexNormals();
  return prep(g);
}
function mergeVerts(g) {
  // BoxGeometry faces share edges but not vertices: weld them so the rounded box shades smoothly
  const p = g.attributes.position, map = new Map(), out = [], remap = new Int32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const k = `${Math.round(p.getX(i) * 1e4)},${Math.round(p.getY(i) * 1e4)},${Math.round(p.getZ(i) * 1e4)}`;
    let j = map.get(k);
    if (j === undefined) { j = out.length / 3; map.set(k, j); out.push(p.getX(i), p.getY(i), p.getZ(i)); }
    remap[i] = j;
  }
  const src = g.index ? g.index.array : [...Array(p.count).keys()];
  const idx = []; for (let i = 0; i < src.length; i += 3) { const a = remap[src[i]], b = remap[src[i + 1]], c = remap[src[i + 2]]; if (a !== b && b !== c && a !== c) idx.push(a, b, c); }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  m.setIndex(idx);
  return m;
}

/* ============================================================== duvet / blanket drape */
/**
 * A cloth laid over a mattress top and falling over its sides (and foot): w x len is the mattress top
 * (centred on X, from z0 towards +Z), r its edge rounding, drop how far the cloth hangs, th its
 * thickness. The flat sheet is wrapped round the nearest point of the top rectangle, so the corners
 * fall as soft cones; the spare cloth there and along the hem makes folds. quilt > 0 puffs squares of
 * that size on top (stitched duvet). headFold: the edge at z0 rolls over (turned-down cover).
 * UVs are the flat cloth coordinates in metres, so prints follow the drape.
 */
function drapeRaw({ w, len, drop, z0 = 0, r = 0.06, th = 0.03, foot = true, footDrop = drop, quilt = 0, puff = 0.02, seed = 1, nx = 32, nz = 28 }) {
  const a = Math.max(0.01, w / 2 - r), zb = z0 + len - (foot ? r : 0), q = PI * r / 2;
  const sx0 = -(a + q + drop), sx1 = a + q + drop, sz1 = foot ? zb + q + footDrop : z0 + len;
  const ph = seed * 2.3;
  const P = [], N = [], UV = [];
  const pt = (sx, sz) => {
    const cx = clamp(sx, -a, a), cz = clamp(sz, z0, zb);
    const ddx = sx - cx, ddz = sz - cz, L = Math.hypot(ddx, ddz);
    let x = cx, y = 0, z = cz, nx0 = 0, ny = 1, nz0 = 0, t = 0;
    if (L > 1e-6) {
      const ux = ddx / L, uz = ddz / L;
      let hor, n2;
      if (L < q) { const th2 = L / r; hor = r * Math.sin(th2); y = -r * (1 - Math.cos(th2)); n2 = [ux * Math.sin(th2), Math.cos(th2), uz * Math.sin(th2)]; }
      else { t = clamp((L - q) / Math.max(0.05, ux * ux > 0.5 ? drop : footDrop), 0, 1); hor = r + 0.035 * t * t; y = -r - (L - q); n2 = [ux, 0, uz]; }
      // folds: along the hem, stronger at the corners where the cloth has nowhere to go
      const cornerK = Math.min(Math.abs(ddx), Math.abs(ddz)) > 1e-4 ? 1 : 0;
      const along = cornerK ? Math.atan2(uz, ux) * 0.45 : (Math.abs(ux) > 0.5 ? sz : sx);
      // folds only bulge outwards, so the mattress and the bed frame never poke through the cloth
      const fold = t ** 1.3 * ((0.016 + 0.03 * cornerK) * (0.5 + 0.5 * Math.sin(along * (cornerK ? 22 : 9) + ph)) + 0.006 * (0.5 + 0.5 * Math.sin(along * 23 + ph * 3)));
      hor += fold;
      x = cx + ux * hor; z = cz + uz * hor; [nx0, ny, nz0] = n2;
    }
    // quilted puffs on top (fading over the edge) and big soft wrinkles
    let off = 0;
    if (quilt > 0) {
      const b = Math.sin(PI * sx / quilt) ** 2 * Math.sin(PI * (sz - z0) / quilt) ** 2;
      off += puff * (0.35 + 0.65 * b) * (1 - 0.7 * t);
    }
    off += 0.006 * Math.sin(sx * 5.3 + ph) * Math.sin(sz * 3.7 + ph * 1.3) * (1 - t);
    return { p: [x + nx0 * off, y + ny * off, z + nz0 * off], n: [nx0, ny, nz0] };
  };
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    // more columns over the edges where the cloth bends
    const s = i / nx, sx = sx0 + (sx1 - sx0) * s;
    const sz = z0 + (sz1 - z0) * (j / nz);
    const { p, n } = pt(sx, sz);
    P.push(p); N.push(n); UV.push([sx, sz]);
  }
  const row = nx + 1, pos = [], uv = [], idx = [];
  for (const p of P) pos.push(...p);
  for (const u of UV) uv.push(...u);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const A = j * row + i, B = A + 1, C = A + row, D = C + 1; idx.push(A, C, B, B, C, D); }
  const top = new THREE.BufferGeometry();
  top.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  top.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  top.setIndex(idx);
  top.computeVertexNormals();
  // hem band: the cloth's thickness all round its edge (outer surface → offset inwards by th)
  const nrm = top.attributes.normal;
  const loop = [];
  for (let i = 0; i <= nx; i++) loop.push(i);                               // head edge (z0)
  for (let j = 1; j <= nz; j++) loop.push(j * row + nx);                    // right edge
  for (let i = nx - 1; i >= 0; i--) loop.push(nz * row + i);                // foot edge
  for (let j = nz - 1; j >= 1; j--) loop.push(j * row);                     // left edge
  const bp = [], buv = [];
  const V3 = (k) => new THREE.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
  const Nn = (k) => new THREE.Vector3(nrm.getX(k), nrm.getY(k), nrm.getZ(k));
  const centre = new THREE.Vector3(0, -0.2, z0 + len / 2);
  for (let k = 0; k < loop.length; k++) {
    const i0 = loop[k], i1 = loop[(k + 1) % loop.length];
    const a0 = V3(i0), a1 = V3(i1), b0 = a0.clone().addScaledVector(Nn(i0), -th), b1 = a1.clone().addScaledVector(Nn(i1), -th);
    // face outwards (away from the middle of the bed)
    const out = a0.clone().add(a1).multiplyScalar(0.5).sub(centre); out.y = Math.min(out.y, 0) * 0.3;
    const fn = new THREE.Vector3().subVectors(b0, a0).cross(new THREE.Vector3().subVectors(a1, a0));
    const tri = fn.dot(out) >= 0 ? [a0, b0, a1, a1, b0, b1] : [a0, a1, b0, a1, b1, b0];
    for (const v of tri) { bp.push(v.x, v.y, v.z); buv.push(v.x + v.z, v.y); }
  }
  const band = new THREE.BufferGeometry();
  band.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
  band.setAttribute('uv', new THREE.Float32BufferAttribute(buv, 2));
  band.computeVertexNormals();
  const t2 = top.toNonIndexed();
  return mergeGeometries([t2, band], false);
}
export const drape = memo('drape', (o) => prep(drapeRaw(o), true));

/** Folded blanket: n layers of a thin cushion, each a touch narrower, with a rolled fold on one side. */
export const foldedBlanket = memo('folded', (w, d, n = 3, th = 0.03, seed = 1) => {
  const parts = [];
  for (let i = 0; i < n; i++) {
    const g = cushionRaw(w - i * 0.012, th, d - i * 0.014, th * 0.49, 0.006, 0, seed + i, 0, 0).clone();
    g.translate((i % 2 ? 0.006 : -0.004), th * (i + 0.5) * 0.96, i * 0.004);
    parts.push(g);
  }
  return mergeGeometries(parts, false);
});

/* ============================================================== curtain */
/**
 * Curtain panel facing +Z: width pw, height h, centred at x = 0 with its top at y = h. Pinch-pleat
 * heading (pleats bunched at the top, opening out towards the floor), uneven folds, a heavier hem.
 * Two sided (the back is a reversed copy, so it shades right from both sides).
 */
export const curtain = memo('curtain', (pw, h, seed = 1, folds = 7, depth = 0.045) => {
  const nu = folds * 6, nv = 10, pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const s = i / nu, t = j / nv;                      // t = 0 at the hem, 1 at the top
    const ph = s * PI * 2 * folds + seed;
    const amp = depth * (0.75 + 0.25 * Math.sin(s * 13 + seed * 3)) * (0.75 + 0.35 * (1 - t));
    // sharper crest at the front, rounder at the back (a pleat, not a sine wave)
    const c = Math.sin(ph), wave = Math.sign(c) * Math.abs(c) ** 0.7;
    const spread = 1 - 0.12 * t;                        // gathered at the heading, opening out below
    const x = (s - 0.5) * pw * spread, y = t * h + (j === 0 ? 0 : 0);
    const hem = j <= 1 ? 0.004 : 0;
    pos.push(x, y, wave * amp + hem); uv.push(s * pw * 1.6, y);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const A = j * (nu + 1) + i, B = A + 1, C = A + nu + 1, D = C + 1; idx.push(A, B, C, B, D, C); }
  const f = new THREE.BufferGeometry();
  f.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  f.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  f.setIndex(idx);
  f.computeVertexNormals();
  const front = f.toNonIndexed();
  const back = front.clone();
  const bp = back.attributes.position, bn = back.attributes.normal;
  for (let i = 0; i < bp.count; i += 3) {             // reverse winding, flip normals, push back a hair
    for (const at of [bp, bn, back.attributes.uv]) { const s2 = at.itemSize; for (let c = 0; c < s2; c++) { const t = at.array[(i + 1) * s2 + c]; at.array[(i + 1) * s2 + c] = at.array[(i + 2) * s2 + c]; at.array[(i + 2) * s2 + c] = t; } }
  }
  for (let i = 0; i < bp.count; i++) { bp.setZ(i, bp.getZ(i) - 0.004); bn.setXYZ(i, -bn.getX(i), -bn.getY(i), -bn.getZ(i)); }
  return prep(mergeGeometries([front, back], false), true);
});

/* ============================================================== dressed bed */
const _c = new THREE.Color();
/** Copy of a shared geometry with a flat vertex colour (sRGB hex). */
export function painted(geo, hex) {
  const g = geo.clone(); g.userData = {};
  _c.set(hex);
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function add(parent, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; o.receiveShadow = true;
  parent.add(o);
  return o;
}
const cloth = (parent, geo, hexOrMat, x, y, z, rx = 0, ry = 0, rz = 0) => (typeof hexOrMat === 'number' ? add(parent, painted(geo, hexOrMat), clothMat(), x, y, z, rx, ry, rz) : add(parent, geo, hexOrMat, x, y, z, rx, ry, rz));
/**
 * Mattress, fitted sheet, duvet with a turned-down top, pillows (and an optional throw pillow and knitted
 * blanket) in a bed group whose head is at -Z. o: { bw, ml (mattress length), mz (its centre z), mb (its
 * bottom y), mh, sheet, duvet (hex or material), fold (turn-down hex), hang (how far the duvet falls
 * past the mattress top), out (how far it stands off the mattress sides), pillows: [{ x, hex }],
 * accent: { x, hex }, blanket: material (a throw across the foot), seed }.
 */
export function dressBed(bg, o) {
  const { bw, ml, mz = 0, mb, mh = 0.24, sheet = 0xf7f5f0, duvet, fold = 0xfbfaf6, hang = 0.26, out = 0.06, seed = 1 } = o;
  const py = mb + mh + 0.09;
  const top = mb + mh, z0 = mz - ml / 2, z1 = mz + ml / 2;
  cloth(bg, cushion(bw, mh, ml, 0.06, 0.012, 0.004, seed, 0.006, 0.006, 0.36), sheet, 0, mb + mh / 2, mz);
  const dz0 = z0 + (o.duvetStart ?? 0.55), r = 0.08, len = z1 + out - dz0;
  const dw = bw + out * 2, th = 0.035;
  cloth(bg, drape({ w: dw, len, drop: hang, z0: dz0, r, th, foot: true, quilt: 0.3, puff: 0.02, seed }), duvet, 0, top + 0.02, 0);
  // turned-down top: the cover's other side folded back over the duvet
  cloth(bg, drape({ w: dw + 0.05, len: 0.3, drop: hang - 0.03, z0: dz0 - 0.02, r: r + 0.02, th: 0.025, foot: false, seed: seed + 3, nx: 32, nz: 6 }), o.foldMat ?? fold, 0, top + 0.056, 0);
  // pillows lean back against the headboard (back edge up), so their dented tops face the room
  for (const [i, pl] of (o.pillows ?? []).entries()) cloth(bg, pillow(0.66, 0.22, 0.44, seed + i, 0.22), pl.hex ?? 0xfbfaf6, pl.x, py + 0.02 + (pl.y ?? 0), z0 + 0.27 + (pl.z ?? 0), 0.32 - i * 0.06, (pl.ry ?? 0) + (i ? -0.04 : 0.05), 0);
  if (o.accent) add(bg, painted(throwPillow(0.4, 0.34, 0.15, seed + 7), o.accent.hex), velvetMat(), o.accent.x, top + 0.24, z0 + 0.52, -0.3, o.accent.ry ?? 0.2, 0);
  // knitted throw laid across the foot, falling over the sides and the end with the duvet
  if (o.blanket) add(bg, drape({ w: dw + 0.05, len: 0.52, drop: hang - 0.04, z0: z1 + out - 0.5, r: r + 0.02, th: 0.03, foot: true, footDrop: hang - 0.06, seed: seed + 9, nx: 32, nz: 12 }), o.blanket, 0, top + 0.058, 0);
  return bg;
}
