// Seeded random and periodic value noise for procedural textures and world scatter.

export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/** Value noise in [0,1], periodic with period px, py (integers) so textures tile. */
export function vnoise(x, y, px = 256, py = 256, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py;
  const x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
  const u = fade(xf), v = fade(yf);
  const a = hash2(x0, y0, seed), b = hash2(x1, y0, seed);
  const c = hash2(x0, y1, seed), d = hash2(x1, y1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Fractal value noise in about [0,1]. (u,v) in [0,1) texture space; freq = lattice cells per tile. */
export function fbm(u, v, freq = 4, oct = 4, seed = 0, gain = 0.5) {
  let sum = 0, amp = 1, norm = 0, f = freq;
  for (let i = 0; i < oct; i++) {
    sum += amp * vnoise(u * f, v * f, f, f, seed + i * 17);
    norm += amp;
    amp *= gain;
    f *= 2;
  }
  return sum / norm;
}

/** Anisotropic fbm (different cell counts on u and v), still periodic. */
export function fbm2(u, v, fu, fv, oct = 4, seed = 0) {
  let sum = 0, amp = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * vnoise(u * fu, v * fv, fu, fv, seed + i * 31);
    norm += amp;
    amp *= 0.5;
    fu *= 2;
    fv *= 2;
  }
  return sum / norm;
}

/** Non-periodic 2D noise for world placement (meters in, about [0,1] out). */
export function worldNoise(x, z, scale = 0.05, oct = 3, seed = 7) {
  let sum = 0, amp = 1, norm = 0, f = scale;
  for (let i = 0; i < oct; i++) {
    sum += amp * vnoise(x * f, z * f, 1 << 20, 1 << 20, seed + i * 13);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}
