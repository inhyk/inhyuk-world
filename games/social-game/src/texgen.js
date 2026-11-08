// Procedural PBR texture pixels (no DOM, no three.js): colour (sRGB), normal (from a height field)
// and roughness (green channel, as three.js reads it). Every texture tiles seamlessly. tex.js turns
// them into textures; texworker.js runs this same code on other CPU cores while the game loads.
import { fbm, fbm2, vnoise, rng } from './noise.js';

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const mix = (a, b, t) => a + (b - a) * t;
const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

/**
 * Runs fn(u, v, o) for every pixel; fn writes o.r, o.g, o.b (0..1 sRGB), o.h (height 0..1),
 * o.ro (roughness 0..1). Returns RGBA bytes { size, col, nor, rough }.
 */
function pixels(size, fn, normalStrength = 2) {
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
  return { size, col, nor, rough };
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
  /** Cotton weave for bedding and cushions: fine plain weave, slub threads, a little fuzz. */
  cotton(p) {
    const base = hex(p.color ?? 0xffffff), n = p.weave ?? 128;
    return (u, v, o) => {
      const a = Math.sin(u * n * Math.PI * 2), b = Math.sin(v * n * Math.PI * 2);
      const w = a * b > 0 ? Math.abs(a) : Math.abs(b);
      const slub = fbm2(u, v, 6, 96, 3, p.seed ?? 17), fuzz = fbm(u, v, 64, 2, (p.seed ?? 17) + 3);
      setCol(o, base, 0.86 + 0.07 * w + 0.08 * slub + 0.05 * fuzz);
      o.h = w * 0.55 + slub * 0.25 + fuzz * 0.15; o.ro = 0.92;
    };
  },
  /** Gingham check (bedding, picnic): two crossing stripe sets, darker where they cross. */
  gingham(p) {
    const a = hex(p.color ?? 0x5f86b8), b = hex(p.color2 ?? 0xf6f3ec), n = p.count ?? 8, wv = p.weave ?? 160;
    return (u, v, o) => {
      const su = ((u * n) % 1) < 0.5 ? 1 : 0, sv = ((v * n) % 1) < 0.5 ? 1 : 0, k = (su + sv) / 2;
      const ta = Math.sin(u * wv * Math.PI * 2), tb = Math.sin(v * wv * Math.PI * 2), w = ta * tb > 0 ? Math.abs(ta) : Math.abs(tb);
      const f = 0.9 + 0.07 * w + 0.05 * fbm(u, v, 16, 2, 9);
      o.r = mix(b[0], a[0], k) * f; o.g = mix(b[1], a[1], k) * f; o.b = mix(b[2], a[2], k) * f;
      o.h = w * 0.5; o.ro = 0.9;
    };
  },
  /** Small flower print on cotton: jittered five-petal flowers with a centre dot and two leaves. */
  floral(p) {
    const base = hex(p.color ?? 0xf6efe4), cols = (p.flowers ?? [0xe58a9a, 0xf2c14e, 0x8fb0d8]).map(hex), leaf = hex(p.leaf ?? 0x7fa36a);
    const n = p.count ?? 6, wv = p.weave ?? 140, seed = p.seed ?? 5;
    const h1 = (x, y, s) => { const t = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return t - Math.floor(t); };
    return (u, v, o) => {
      let col = base, hgt = 0;
      const cu = u * n, cv = v * n, ix = Math.floor(cu), iy = Math.floor(cv);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const gx = ix + dx, gy = iy + dy, mx = ((gx % n) + n) % n, my = ((gy % n) + n) % n;
        const fx = gx + 0.2 + 0.6 * h1(mx, my, seed), fy = gy + 0.2 + 0.6 * h1(my, mx, seed + 1);
        const ex = cu - fx, ey = cv - fy, r = Math.hypot(ex, ey), ang = Math.atan2(ey, ex) + h1(mx, my, seed + 2) * 6.28;
        const R = 0.2 + 0.06 * h1(mx, my, seed + 3);
        // leaves first (under the petals)
        for (const la of [0.9, 3.6]) {
          const lx = ex, ly = ey;
          const ca = Math.cos(la + h1(mx, my, seed + 4) * 3), sa = Math.sin(la + h1(mx, my, seed + 4) * 3);
          const px = (lx * ca + ly * sa) - R * 1.25, py = -lx * sa + ly * ca;
          if ((px / (R * 0.75)) ** 2 + (py / (R * 0.32)) ** 2 < 1) { col = leaf; hgt = 0.4; }
        }
        if (r < R * (0.55 + 0.45 * Math.abs(Math.cos(2.5 * ang)))) { col = cols[Math.floor(h1(mx, my, seed + 5) * cols.length)]; hgt = 0.7; }
        if (r < R * 0.22) { col = [1, 0.93, 0.62]; hgt = 0.8; }
      }
      const ta = Math.sin(u * wv * Math.PI * 2), tb = Math.sin(v * wv * Math.PI * 2), w = ta * tb > 0 ? Math.abs(ta) : Math.abs(tb);
      setCol(o, col, 0.9 + 0.07 * w + 0.05 * fbm(u, v, 16, 2, 4));
      o.h = w * 0.45 + hgt * 0.15; o.ro = 0.9;
    };
  },
  /** Terry towel: dense cotton loops (noisy height) and a woven band across. */
  terry(p) {
    const base = hex(p.color ?? 0xffffff), band = p.band;
    return (u, v, o) => {
      const loops = vnoise(u * 180, v * 180, 180, 180, 7), f = fbm(u, v, 24, 3, 8);
      const inBand = band != null && Math.abs(((v * 2) % 1) - 0.5) < band;
      const k = inBand ? 0.8 + 0.1 * Math.abs(Math.sin(u * 220 * Math.PI)) : 0.8 + 0.18 * loops + 0.08 * f;
      setCol(o, base, k);
      o.h = inBand ? 0.35 : loops * 0.8 + f * 0.2; o.ro = 0.97;
    };
  },
  /** Chunky knit for throws: columns of V stitches. */
  knit(p) {
    const base = hex(p.color ?? 0xd8c7a8), cols = p.cols ?? 10, rows = p.rows ?? 14;
    return (u, v, o) => {
      const cu = (u * cols) % 1, cv = (v * rows) % 1;
      const x = (cu < 0.5 ? cu : 1 - cu) * 2;          // 0 at the column edge, 1 at the middle: mirrored halves make the V
      const lob = 1 - Math.min(1, Math.hypot((x - 0.55) * 1.6, ((cv + x * 0.45) % 1 - 0.5) * 1.3));
      const hgt = Math.max(0, lob) ** 0.7;
      const f = fbm(u, v, 32, 2, 12);
      setCol(o, base, 0.7 + 0.32 * hgt + 0.06 * f);
      o.h = hgt * 0.9 + f * 0.1; o.ro = 0.95;
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

export const GENERATORS = Object.keys(GEN);

/** Pixels of texture `name` with `params` (size defaults to 512). */
export function texPixels(name, params = {}) {
  const gen = GEN[name];
  if (!gen) throw new Error('unknown texture ' + name);
  return pixels(params.size ?? 512, gen(params), params.bump ?? 3);
}
