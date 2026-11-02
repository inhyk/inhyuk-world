// Procedural PBR textures drawn on canvases: colour (sRGB), normal (from a height field) and
// roughness (green channel, as three.js reads it). Every texture tiles seamlessly and is made once.
import * as THREE from 'three';
import { fbm, fbm2, vnoise, rng } from './noise.js';

const cache = new Map();
let maxAniso = 8;
export function setAnisotropy(n) { maxAniso = n; }

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const mix = (a, b, t) => a + (b - a) * t;
const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

function finish(canvas, color) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

/**
 * Runs fn(u, v, o) for every pixel; fn writes o.r, o.g, o.b (0..1 sRGB), o.h (height 0..1),
 * o.ro (roughness 0..1). Returns { map, normalMap, roughnessMap }.
 */
function generate(size, fn, normalStrength = 2) {
  const n = size * size;
  const col = new Uint8ClampedArray(n * 4);
  const rough = new Uint8ClampedArray(n * 4);
  const height = new Float32Array(n);
  const o = { r: 0.5, g: 0.5, b: 0.5, h: 0.5, ro: 0.6 };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      o.h = 0.5; o.ro = 0.6;
      fn((x + 0.5) / size, (y + 0.5) / size, o, x, y);
      const i = y * size + x, j = i * 4;
      col[j] = clamp01(o.r) * 255; col[j + 1] = clamp01(o.g) * 255; col[j + 2] = clamp01(o.b) * 255; col[j + 3] = 255;
      const rr = clamp01(o.ro) * 255;
      rough[j] = rr; rough[j + 1] = rr; rough[j + 2] = rr; rough[j + 3] = 255;
      height[i] = o.h;
    }
  }
  const nor = new Uint8ClampedArray(n * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const xl = (x - 1 + size) % size, xr = (x + 1) % size;
      const yu = (y - 1 + size) % size, yd = (y + 1) % size;
      const dx = (height[y * size + xr] - height[y * size + xl]) * normalStrength;
      const dy = (height[yd * size + x] - height[yu * size + x]) * normalStrength;
      const len = Math.hypot(dx, dy, 1);
      const j = (y * size + x) * 4;
      nor[j] = (-dx / len * 0.5 + 0.5) * 255;
      nor[j + 1] = (dy / len * 0.5 + 0.5) * 255;
      nor[j + 2] = (1 / len * 0.5 + 0.5) * 255;
      nor[j + 3] = 255;
    }
  }
  const mk = (data) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    c.getContext('2d').putImageData(new ImageData(data, size, size), 0, 0);
    return c;
  };
  return { map: finish(mk(col), true), normalMap: finish(mk(nor), false), roughnessMap: finish(mk(rough), false) };
}

function setCol(o, c, k = 1) { o.r = c[0] * k; o.g = c[1] * k; o.b = c[2] * k; }

// ---------------------------------------------------------------- generators
const GEN = {
  /** Oak floor planks, 6 boards across. */
  planks(p) {
    const base = hex(p.color ?? 0xb98a5a), R = rng(p.seed ?? 3);
    const rows = 6, tones = [], offs = [];
    for (let i = 0; i < rows * 4; i++) { tones.push(0.82 + R() * 0.3); offs.push(R()); }
    return (u, v, o) => {
      const row = Math.floor(v * rows), lv = v * rows - row;
      const seg = Math.floor(u * 2 + offs[row]) % 2, k = tones[row * 2 + seg];
      const grain = fbm2(u + offs[row], v, 2, 64, 4, row * 7 + seg);
      const ring = Math.abs(Math.sin((grain * 9 + u * 3) * Math.PI));
      const t = k * (0.86 + 0.14 * ring) * (0.9 + 0.2 * fbm(u, v, 8, 3, 4));
      setCol(o, base, t);
      const lu = (u * 2 + offs[row]) % 1;
      const gap = Math.min(lv, 1 - lv) < 0.025 || Math.min(lu, 1 - lu) < 0.006;
      o.h = gap ? 0.2 : 0.6 + ring * 0.05;
      if (gap) setCol(o, base, 0.35);
      o.ro = 0.48 + 0.12 * grain;
    };
  },
  /** Fine furniture wood grain, no boards. */
  wood(p) {
    const base = hex(p.color ?? 0x7a4e2d);
    return (u, v, o) => {
      const g = fbm2(u, v, 3, 48, 4, p.seed ?? 11);
      const ring = Math.abs(Math.sin((g * 12 + u * 2) * Math.PI));
      setCol(o, base, 0.8 + 0.25 * ring * (0.85 + 0.3 * fbm(u, v, 6, 2, 9)));
      o.h = 0.5 + ring * 0.08;
      o.ro = 0.42 + 0.15 * g;
    };
  },
  /** Square tiles with grout. */
  tiles(p) {
    const base = hex(p.color ?? 0xf1f1ec), grout = hex(p.grout ?? 0xb9b6ae), n = p.count ?? 4, R = rng(p.seed ?? 5);
    const tone = []; for (let i = 0; i < n * n; i++) tone.push(0.95 + R() * 0.07);
    const gw = p.groutWidth ?? 0.018;
    return (u, v, o) => {
      const cx = Math.floor(u * n), cy = Math.floor(v * n);
      const lu = u * n - cx, lv = v * n - cy;
      const e = Math.min(lu, 1 - lu, lv, 1 - lv);
      if (e < gw) { setCol(o, grout, 0.95 + 0.1 * fbm(u, v, 32, 2, 3)); o.h = 0.25; o.ro = 0.85; return; }
      const marble = p.marble ? Math.pow(Math.abs(Math.sin((u * 3 + v * 2 + fbm(u, v, 4, 5, 8) * 4) * Math.PI)), 6) : 0;
      setCol(o, base, tone[cy * n + cx] * (1 - marble * 0.25) * (0.97 + 0.05 * fbm(u, v, 16, 3, 2)));
      o.h = 0.6 - Math.max(0, 0.06 - e) * 2 + fbm(u, v, 24, 2, 4) * 0.02;
      o.ro = p.rough ?? 0.18;
    };
  },
  /** Polished stone with veins. */
  marble(p) {
    const base = hex(p.color ?? 0xeeeae4), vein = hex(p.vein ?? 0x8f8a86);
    return (u, v, o) => {
      const w = fbm(u, v, 3, 6, p.seed ?? 21);
      const t = Math.pow(1 - Math.abs(Math.sin((u * 2 + v + w * 5) * Math.PI)), 14);
      const c = [mix(base[0], vein[0], t), mix(base[1], vein[1], t), mix(base[2], vein[2], t)];
      setCol(o, c, 0.96 + 0.06 * fbm(u, v, 8, 3, 5));
      o.h = 0.5; o.ro = 0.12 + t * 0.2;
    };
  },
  /** Carpet tiles: fibres plus a faint 2x2 tile seam. */
  carpet(p) {
    const base = hex(p.color ?? 0x5d6878);
    return (u, v, o) => {
      const f = fbm(u, v, 64, 3, p.seed ?? 31);
      const lu = (u * 2) % 1, lv = (v * 2) % 1;
      const seam = Math.min(lu, 1 - lu, lv, 1 - lv) < 0.004 ? 0.85 : 1;
      const dir = (Math.floor(u * 2) + Math.floor(v * 2)) % 2 ? 0.96 : 1.03;
      setCol(o, base, (0.8 + 0.35 * f) * seam * dir);
      o.h = f; o.ro = 0.95;
    };
  },
  /** Woven fabric. */
  fabric(p) {
    const base = hex(p.color ?? 0x8899aa), n = p.weave ?? 160;
    return (u, v, o) => {
      const a = Math.sin(u * n * Math.PI * 2), b = Math.sin(v * n * Math.PI * 2);
      const w = (a * b > 0 ? 0.5 + 0.5 * Math.abs(a) : 0.5 + 0.5 * Math.abs(b));
      const slub = fbm2(u, v, 8, 64, 3, p.seed ?? 41);
      setCol(o, base, 0.82 + 0.12 * w + 0.12 * slub);
      o.h = w * 0.5 + slub * 0.2; o.ro = 0.9;
    };
  },
  /** Striped cloth (pajamas, towels, awnings). */
  stripes(p) {
    const a = hex(p.color ?? 0x7ea6d8), b = hex(p.color2 ?? 0xf3f3f3), n = p.count ?? 8;
    return (u, v, o) => {
      const s = ((u * n) % 1) < (p.ratio ?? 0.5);
      const w = Math.sin(u * 300) * Math.sin(v * 300);
      setCol(o, s ? a : b, 0.92 + 0.06 * w + 0.06 * fbm(u, v, 16, 2, 6));
      o.h = 0.5 + w * 0.1; o.ro = 0.9;
    };
  },
  /** Painted plaster wall. */
  plaster(p) {
    const base = hex(p.color ?? 0xefe9df);
    return (u, v, o) => {
      const f = fbm(u, v, 12, 5, p.seed ?? 51);
      setCol(o, base, 0.95 + 0.07 * f);
      o.h = f; o.ro = 0.88;
    };
  },
  concrete(p) {
    const base = hex(p.color ?? 0xa7a49d);
    return (u, v, o) => {
      const f = fbm(u, v, 6, 5, p.seed ?? 61);
      const pore = vnoise(u * 200, v * 200, 200, 200, 3) > 0.93 ? 0.75 : 1;
      setCol(o, base, (0.86 + 0.24 * f) * pore);
      o.h = f * 0.6 + (pore < 1 ? 0 : 0.2); o.ro = 0.85;
    };
  },
  asphalt(p) {
    const base = hex(p.color ?? 0x3d3f42);
    return (u, v, o) => {
      const f = fbm(u, v, 8, 5, p.seed ?? 71);
      const s = vnoise(u * 300, v * 300, 300, 300, 9);
      const agg = s > 0.8 ? 1.35 : s < 0.15 ? 0.7 : 1;
      const patch = fbm(u, v, 2, 3, 77) > 0.62 ? 0.85 : 1;
      setCol(o, base, (0.82 + 0.3 * f) * agg * patch);
      o.h = s * 0.5 + f * 0.3; o.ro = 0.88 - (agg > 1 ? 0.15 : 0);
    };
  },
  /** Square concrete pavers for sidewalks and plazas. */
  pavers(p) {
    const base = hex(p.color ?? 0xb7b2a8), n = p.count ?? 4, R = rng(p.seed ?? 81);
    const tone = []; for (let i = 0; i < n * n; i++) tone.push(0.88 + R() * 0.18);
    return (u, v, o) => {
      const cx = Math.floor(u * n), cy = Math.floor(v * n);
      const lu = u * n - cx, lv = v * n - cy, e = Math.min(lu, 1 - lu, lv, 1 - lv);
      const f = fbm(u, v, 16, 4, 83);
      if (e < 0.03) { setCol(o, base, 0.55); o.h = 0.1; o.ro = 0.95; return; }
      setCol(o, base, tone[cy * n + cx] * (0.9 + 0.18 * f));
      o.h = 0.6 + f * 0.15 - Math.max(0, 0.08 - e); o.ro = 0.8;
    };
  },
  /** Lawn seen from above: clumps, fine blades, a little soil. */
  grass(p) {
    const a = hex(p.color ?? 0x55803a), b = hex(p.color2 ?? 0x8faa4c), soil = hex(0x6b5a3e);
    return (u, v, o) => {
      const big = fbm(u, v, 3, 3, p.seed ?? 91);
      const clump = fbm(u, v, 12, 3, 92);
      const fine = vnoise(u * 180, v * 180, 180, 180, 93) * 0.6 + vnoise(u * 330, v * 330, 330, 330, 94) * 0.4;
      const t = clamp01(big * 1.3 - 0.15 + (clump - 0.5) * 0.4);
      const c = [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
      const bare = clamp01((fbm(u, v, 6, 3, 97) - 0.7) * 6) * 0.6;
      const k = 0.62 + 0.55 * fine * (0.8 + 0.4 * clump);
      o.r = mix(c[0] * k, soil[0], bare); o.g = mix(c[1] * k, soil[1], bare); o.b = mix(c[2] * k, soil[2], bare);
      o.h = fine * 0.7 + clump * 0.3; o.ro = 0.95;
    };
  },
  dirt(p) {
    const base = hex(p.color ?? 0x7a6247);
    return (u, v, o) => {
      const f = fbm(u, v, 8, 5, p.seed ?? 101), s = vnoise(u * 120, v * 120, 120, 120, 5);
      setCol(o, base, 0.8 + 0.3 * f + (s > 0.85 ? 0.15 : 0));
      o.h = f * 0.7 + s * 0.3; o.ro = 0.95;
    };
  },
  sand(p) {
    const base = hex(p.color ?? 0xe3cfa2);
    return (u, v, o) => {
      const w = fbm(u, v, 4, 3, 111);
      const rip = 0.5 + 0.5 * Math.sin((v * 18 + w * 4) * Math.PI * 2);
      const grain = vnoise(u * 256, v * 256, 256, 256, 113);
      setCol(o, base, 0.9 + 0.08 * rip + 0.1 * (grain - 0.5));
      o.h = rip * 0.6 + grain * 0.2; o.ro = 0.92;
    };
  },
  /** Running-bond brick with mortar. */
  brick(p) {
    const base = hex(p.color ?? 0xa3523a), mortar = hex(p.mortar ?? 0xcfc6b8), R = rng(p.seed ?? 121);
    const rows = 8, cols = 4, tone = [];
    for (let i = 0; i < rows * cols * 2; i++) tone.push(0.78 + R() * 0.32);
    return (u, v, o) => {
      const row = Math.floor(v * rows), lv = v * rows - row;
      const su = u * cols + (row % 2) * 0.5, col = Math.floor(su), lu = su - col;
      const e = Math.min(lu * 2.1, (1 - lu) * 2.1, lv, 1 - lv);
      const f = fbm(u, v, 24, 3, 123);
      if (e < 0.09) { setCol(o, mortar, 0.85 + 0.2 * f); o.h = 0.15; o.ro = 0.95; return; }
      setCol(o, base, tone[(row * cols + (col % cols)) % tone.length] * (0.85 + 0.25 * f));
      o.h = 0.6 + f * 0.2; o.ro = 0.85;
    };
  },
  /** Horizontal lap siding for houses. */
  siding(p) {
    const base = hex(p.color ?? 0xe8e2d4), n = p.count ?? 8;
    return (u, v, o) => {
      const lv = (v * n) % 1;
      const g = fbm2(u, v, 4, 32, 3, 131);
      setCol(o, base, (0.9 + 0.08 * g) * (0.82 + 0.18 * lv));
      o.h = lv; o.ro = 0.7;
    };
  },
  /** Overlapping roof shingles. */
  shingles(p) {
    const base = hex(p.color ?? 0x5a4a44), R = rng(p.seed ?? 141), rows = 8, cols = 6, tone = [];
    for (let i = 0; i < rows * cols * 2; i++) tone.push(0.75 + R() * 0.4);
    return (u, v, o) => {
      const row = Math.floor(v * rows), lv = v * rows - row;
      const su = u * cols + (row % 2) * 0.5, col = Math.floor(su), lu = su - col;
      const edge = Math.min(lu, 1 - lu) < 0.03;
      const f = fbm(u, v, 32, 3, 143);
      setCol(o, base, tone[(row * cols + (col % cols)) % tone.length] * (0.6 + 0.4 * lv) * (0.9 + 0.2 * f) * (edge ? 0.6 : 1));
      o.h = lv * 0.8 + f * 0.1 - (edge ? 0.3 : 0); o.ro = 0.8;
    };
  },
  bark(p) {
    const base = hex(p.color ?? 0x5c4633);
    return (u, v, o) => {
      const f = fbm2(u, v, 12, 3, 5, p.seed ?? 151);
      const ridge = Math.pow(Math.abs(Math.sin((u * 10 + f * 3) * Math.PI)), 0.6);
      setCol(o, base, 0.6 + 0.5 * ridge * (0.8 + 0.4 * fbm(u, v, 16, 2, 153)));
      o.h = ridge; o.ro = 0.95;
    };
  },
  /** Rough natural stone (rocks, stone blocks). */
  stone(p) {
    const base = hex(p.color ?? 0x8d8b85), moss = hex(0x6f7f4a);
    return (u, v, o) => {
      const f = fbm(u, v, 5, 6, p.seed ?? 161);
      const c = fbm(u, v, 24, 3, 163);
      const m = p.moss ? clamp01((fbm(u, v, 4, 3, 167) - 0.62) * 5) : 0;
      const k = 0.72 + 0.45 * f + (c - 0.5) * 0.25;
      o.r = mix(base[0] * k, moss[0], m); o.g = mix(base[1] * k, moss[1], m); o.b = mix(base[2] * k, moss[2], m);
      o.h = f * 0.8 + c * 0.2; o.ro = 0.85;
    };
  },
  /** Brushed metal: colour plus anisotropic streaks in roughness. */
  brushed(p) {
    const base = hex(p.color ?? 0xc4c7cb);
    return (u, v, o) => {
      const s = fbm2(u, v, 2, 220, 3, p.seed ?? 171);
      setCol(o, base, 0.92 + 0.1 * s);
      o.h = 0.5 + s * 0.05; o.ro = 0.28 + 0.15 * s;
    };
  },
  leather(p) {
    const base = hex(p.color ?? 0x2b2b2e);
    return (u, v, o) => {
      const c = vnoise(u * 90, v * 90, 90, 90, 181), f = fbm(u, v, 8, 3, 183);
      setCol(o, base, 0.9 + 0.15 * f + 0.06 * c);
      o.h = c * 0.6; o.ro = 0.5 + 0.2 * c;
    };
  },
  /** Very subtle noise, for plastics, ceramic and car paint so they are never perfectly flat. */
  smooth(p) {
    const base = hex(p.color ?? 0xffffff);
    return (u, v, o) => {
      const f = fbm(u, v, 16, 3, p.seed ?? 191);
      setCol(o, base, 0.97 + 0.04 * f);
      o.h = f * 0.15; o.ro = (p.rough ?? 0.35) + (f - 0.5) * 0.08;
    };
  },
  /** Leaf canopy colour noise (used on foliage blobs). */
  leaves(p) {
    const a = hex(p.color ?? 0x3f6b2a), b = hex(p.color2 ?? 0x7aa040);
    return (u, v, o) => {
      const cell = vnoise(u * 48, v * 48, 48, 48, 201), big = fbm(u, v, 4, 3, 203);
      const t = clamp01(cell * 0.7 + big * 0.5 - 0.1);
      o.r = mix(a[0], b[0], t); o.g = mix(a[1], b[1], t); o.b = mix(a[2], b[2], t);
      o.h = cell; o.ro = 0.8;
    };
  },
  /** Normal-only ripple field for water. */
  water() {
    return (u, v, o) => {
      const f = fbm(u, v, 6, 5, 211);
      setCol(o, [0.2, 0.4, 0.5]);
      o.h = f; o.ro = 0.05;
    };
  },
};

/**
 * tex('planks', {color: 0xb98a5a}) → { map, normalMap, roughnessMap }, cached by name+params.
 * size defaults to 512. Generators: planks wood tiles marble carpet fabric stripes plaster concrete
 * asphalt pavers grass dirt sand brick siding shingles bark stone brushed leather smooth leaves water.
 */
export function tex(name, params = {}) {
  const key = name + JSON.stringify(params);
  if (cache.has(key)) return cache.get(key);
  const gen = GEN[name];
  if (!gen) throw new Error('unknown texture ' + name);
  const size = params.size ?? 512;
  const t = generate(size, gen(params), params.bump ?? 3);
  cache.set(key, t);
  return t;
}

/** Text or drawing on a canvas, for signs, screens, posters. draw(ctx, w, h). */
export function canvasTex(w, h, draw, { color = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = finish(c, color);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export const FONT = '"Jua", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';
