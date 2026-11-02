// Nature props: trees (round, pine, cherry, maple, palm), bushes, flower patches, rocks, sea shells
// and an instanced grass tuft. Everything is procedural; origin at the ground under the object, y up.
//
// Wind: windUniform.value is a time-like number the game advances (e.g. += dt * strength). Canopies,
// fronds, flowers and grass bend in the vertex shader (onBeforeCompile); the bend grows with the
// square of the height above the object's origin, so trunk bases stay put.
//
// Results are cached by their arguments and returned as clones that SHARE geometry and materials:
// never dispose() the geometry or materials of something returned from here.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat, paint, textured } from '../mat.js';
import { prep, put, bake } from '../geom.js';
import { rng } from '../noise.js';

const TAU = Math.PI * 2;
const V3 = THREE.Vector3;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ 3D value noise
function h3(x, y, z, s) {
  let h = (x * 374761393 + y * 668265263 + z * 1440662683 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function noise3(x, y, z, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => h3(xi + dx, yi + dy, zi + dz, s);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
export function fbm3(x, y, z, oct = 3, s = 0) {
  let sum = 0, a = 1, n = 0, f = 1;
  for (let i = 0; i < oct; i++) { sum += a * noise3(x * f, y * f, z * f, s + i * 19); n += a; a *= 0.5; f *= 2.03; }
  return sum / n;
}

// ------------------------------------------------------------------ wind
export const windUniform = { value: 0 };

const WIND_VERT = /* glsl */`
{
  mat3 wM = mat3(modelMatrix);
  vec3 wO = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#ifdef USE_INSTANCING
  wM = wM * mat3(instanceMatrix);
  wO = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#endif
  float wh = max(transformed.y, 0.0);
  float wb = uBend * wh * wh;
  float wp = dot(wO.xz, vec2(0.31, 0.23));
  float wt = uWind;
  vec3 wOff = vec3(
    (sin(wt * 1.05 + wp) * 0.65 + sin(wt * 2.45 + wp * 1.9) * 0.35 + 0.3) * wb,
    0.0,
    sin(wt * 0.83 + wp * 1.3 + 1.7) * 0.45 * wb);
  wOff.y = -0.15 * abs(wOff.x);
  transformed += inverse(wM) * wOff;
  transformed += normal * sin(wt * 7.0 + dot(position, vec3(5.1, 4.3, 6.7))) * uFlutter * min(wh, 1.5);
}`;

/** Clone `base` into a wind-swayed material. bend: metres of sway per m^2 of height; flutter: leaf jitter. */
export function windify(base, bend, flutter = 0, extra = null) {
  const m = base.clone();
  if (extra) Object.assign(m, extra);
  const uB = { value: bend }, uF = { value: flutter };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = windUniform;
    sh.uniforms.uBend = uB;
    sh.uniforms.uFlutter = uF;
    sh.vertexShader = 'uniform float uWind;\nuniform float uBend;\nuniform float uFlutter;\n'
      + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + WIND_VERT);
  };
  m.customProgramCacheKey = () => 'nature-wind-1';
  m.userData.wind = { bend: uB, flutter: uF };
  return m;
}

// ------------------------------------------------------------------ materials
const M = {};
function leafBase() {
  if (!M.leafBase) {
    const m = textured('leaves', { color: 0x8e8e8e, color2: 0xffffff }, 0.8, { normal: 1.1, roughness: 0.9 }).clone();
    m.vertexColors = true;
    m.roughnessMap = null; // matte: leaves must not mirror the blue sky
    m.roughness = 0.92;
    m.envMapIntensity = 0.8;
    M.leafBase = m;
  }
  return M.leafBase;
}
/** Shared foliage materials (vertex-coloured, wind). kind: tree | frond | bush | low */
export function foliageMat(kind = 'tree') {
  const k = 'fol_' + kind;
  if (!M[k]) {
    if (kind === 'tree') M[k] = windify(leafBase(), 0.0022, 0.01);
    else if (kind === 'frond') M[k] = windify(leafBase(), 0.0026, 0.006, { side: THREE.DoubleSide });
    else if (kind === 'bush') M[k] = windify(leafBase(), 0.02, 0.006);
    else M[k] = windify(leafBase(), 0.18, 0.004, { side: THREE.DoubleSide });
    M[k].name = 'foliage-' + kind;
  }
  return M[k];
}
/** Petal material (vertex colours, slight sheen-free satin), sways like low plants. */
export function petalMat() {
  if (!M.petal) {
    const b = paint(0xffffff, 0.55).clone();
    b.vertexColors = true;
    M.petal = windify(b, 0.18, 0.004, { side: THREE.DoubleSide });
    M.petal.name = 'petals';
  }
  return M.petal;
}
function barkMat(tint = 0xffffff, sway = true) {
  const k = 'bark_' + tint + sway;
  if (!M[k]) {
    const b = mat('bark').clone();
    if (Array.isArray(tint)) b.color.setRGB(...tint); else b.color.set(tint);
    M[k] = sway ? windify(b, 0.0022, 0) : b;
    M[k].name = 'bark-' + tint.toString(16);
  }
  return M[k];
}
/** Neutral porous stone (shared texture with the blocks' clay), coloured per vertex. */
export function rockMat() {
  if (!M.stone) {
    M.stone = textured('concrete', { color: 0xe2ddd6, seed: 5 }, 0.9, { normal: 0.9 }).clone();
    M.stone.vertexColors = true;
    M.stone.name = 'rock';
  }
  return M.stone;
}
const stoneMat = rockMat;
function shellMat() {
  if (!M.shell) { M.shell = paint(0xffffff, 0.38, 0, { clearcoat: 0.6 }).clone(); M.shell.vertexColors = true; M.shell.name = 'shell'; }
  return M.shell;
}

// ------------------------------------------------------------------ colour helpers
const col = (h) => new THREE.Color(h);
function ramp(pal, t, out) {
  t = clamp01(t);
  if (t < 0.5) out.copy(pal.dark).lerp(pal.mid, t * 2);
  else out.copy(pal.mid).lerp(pal.light, (t - 0.5) * 2);
  return out;
}
function setColors(geo, fn) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const arr = new Float32Array(p.count * 3), c = new THREE.Color(), P = new V3(), N = new V3();
  for (let i = 0; i < p.count; i++) {
    P.fromBufferAttribute(p, i); N.fromBufferAttribute(n, i);
    fn(P, N, c, i);
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
const PAL = {
  round: { dark: col(0x284a1c), mid: col(0x4f8a2e), light: col(0x9cc457), accent: col(0xb9c95a), accent2: col(0x2f6a46) },
  maple: { dark: col(0x7a1d14), mid: col(0xcc4221), light: col(0xf39a3c), accent: col(0xf2c14a), accent2: col(0x9b2a2a) },
  cherry: { dark: col(0xa83e6c), mid: col(0xec82ad), light: col(0xfab8d0), accent: col(0xffe6ef), accent2: col(0xd2507f) },
  pine: { dark: col(0x15301a), mid: col(0x2c5a2a), light: col(0x5c9440), accent: col(0x7aa64a), accent2: col(0x234e38) },
  palm: { dark: col(0x2f5a22), mid: col(0x63973a), light: col(0xb8cf68), accent: col(0xc9b15e), accent2: col(0x3e7a3a) },
};
function tonePal(base) {
  const c = col(base);
  const hsl = {}; c.getHSL(hsl);
  const mk = (s, l) => new THREE.Color().setHSL(hsl.h, clamp01(hsl.s * s), clamp01(l));
  return { dark: mk(1.05, hsl.l * 0.45), mid: c.clone(), light: mk(0.95, Math.min(0.8, hsl.l * 1.6 + 0.08)), accent: new THREE.Color().setHSL((hsl.h + 0.04) % 1, hsl.s * 0.9, Math.min(0.75, hsl.l * 1.35)), accent2: new THREE.Color().setHSL((hsl.h + 0.97) % 1, hsl.s, hsl.l * 0.8) };
}

// ------------------------------------------------------------------ geometry builders
function weld(geo) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  return mergeVertices(g, 1e-4);
}

/**
 * Tapered branch/trunk tube along a curve with bark UVs in metres (u around, v along).
 * flare: root buttress at the base; rings: palm ring ridges.
 */
function limb(curve, r0, r1, { seg = 10, radial = 10, flare = 0, lobes = 5, seed = 0, rings = 0, knot = 0.06 } = {}) {
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  const pos = g.attributes.position, uv = g.attributes.uv;
  const L = curve.getLength(), P = new V3();
  const circ = Math.PI * (r0 + r1);
  const uR = circ < 0.6 ? circ : 1.2 * Math.max(1, Math.round(circ / 1.2));
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    curve.getPointAt(t, P);
    const hgt = t * L;
    const r = r0 + (r1 - r0) * t;
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j, a = (j % radial) / radial * TAU;
      let rr = r;
      if (flare) {
        const lobe = Math.pow(Math.max(0, Math.cos(a * lobes + seed)), 2);
        rr *= 1 + flare * Math.exp(-hgt / 0.3) * (0.3 + 0.7 * lobe);
      }
      if (rings) { const f = (hgt / 0.24) % 1; rr *= 1 + rings * (Math.pow(f, 5) - 0.15); }
      rr *= 1 + knot * (noise3(Math.cos(a) * 1.6, hgt * 2.2, Math.sin(a) * 1.6, seed) - 0.5) * 2;
      pos.setXYZ(k, P.x + (pos.getX(k) - P.x) * rr, P.y + (pos.getY(k) - P.y) * rr, P.z + (pos.getZ(k) - P.z) * rr);
      uv.setXY(k, j / radial * uR, hgt);
    }
  }
  g.computeVertexNormals();
  const n = g.attributes.normal, A = new V3(), B = new V3();
  for (let i = 0; i <= seg; i++) {
    const a = i * (radial + 1), b = a + radial;
    A.fromBufferAttribute(n, a).add(B.fromBufferAttribute(n, b)).normalize();
    n.setXYZ(a, A.x, A.y, A.z); n.setXYZ(b, A.x, A.y, A.z);
  }
  return prep(g, true);
}

/** Lumpy leaf cluster (cauliflower of soft bumps) centred at origin, radii rx, ry, rz. */
function leafBlob(rx, ry, rz, seed, detail = 3, lump = 0.32) {
  const R = rng(seed * 7919 + 13);
  const bumps = [];
  const nb = 9 + Math.floor(R() * 6);
  for (let i = 0; i < nb; i++) {
    const v = new V3(R() * 2 - 1, R() * 1.6 - 0.5, R() * 2 - 1).normalize();
    bumps.push([v, 0.6 + R() * 0.5, 5 + R() * 6]);
  }
  const g = weld(new THREE.IcosahedronGeometry(1, detail));
  const p = g.attributes.position, d = new V3();
  for (let i = 0; i < p.count; i++) {
    d.fromBufferAttribute(p, i).normalize();
    let f = 0;
    for (const [b, s, k] of bumps) f += s * Math.pow(Math.max(0, d.dot(b)), k);
    f = 1 - Math.exp(-f * 1.4);
    let r = 1 - lump * 0.55 + lump * f + 0.1 * (fbm3(d.x * 2.6 + seed, d.y * 2.6, d.z * 2.6, 2, seed) - 0.5);
    r += 0.035 * (noise3(d.x * 9, d.y * 9, d.z * 9, seed + 3) - 0.5);
    let y = d.y * r * ry;
    if (d.y < -0.2) y *= 0.82; // flatter underside
    p.setXYZ(i, d.x * r * rx, y, d.z * r * rz);
  }
  g.computeVertexNormals();
  return g;
}

/** Colour a canopy geometry (in tree space). env = {cx, cy, cz, ex, ey}. */
function paintCanopy(g, pal, env, seed, jitter = 0, accentAmt = 0.35, shade = 1) {
  const c2 = new THREE.Color(), c3 = new THREE.Color();
  return setColors(g, (P, N, c) => {
    const rel = (P.y - env.cy) / env.ey;
    const dx = (P.x - env.cx) / env.ex, dy = (P.y - env.cy) / env.ey, dz = (P.z - env.cz) / env.ex;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const nz = fbm3(P.x * 1.1 + seed, P.y * 1.1, P.z * 1.1, 3, seed);
    const t = 0.42 + 0.32 * N.y + 0.18 * rel + 0.45 * (nz - 0.5) + jitter;
    ramp(pal, t, c);
    const a = sstep(0.56, 0.74, fbm3(P.x * 0.7 - seed, P.y * 0.7, P.z * 0.7, 2, seed + 5));
    c.lerp(c2.copy(pal.accent), a * accentAmt);
    const b = sstep(0.6, 0.78, fbm3(P.x * 0.9 + 4, P.y * 0.9 - seed, P.z * 0.9, 2, seed + 9));
    c.lerp(c3.copy(pal.accent2), b * 0.45);
    const ao = 0.4 + 0.6 * sstep(0.3, 1.0, dist) * (0.75 + 0.25 * clamp01(N.y + 0.6));
    c.multiplyScalar(ao * shade);
  });
}

/** n random points [P, N] on the blobs' surfaces (area-weighted), skipping spots buried in another blob. */
function surfacePoints(blobs, n, R, minNy = -2) {
  const tris = [];
  let total = 0;
  const A = new V3(), B = new V3(), C = new V3(), E1 = new V3(), E2 = new V3();
  blobs.forEach((b, bi) => {
    const p = b.geo.attributes.position, idx = b.geo.index;
    for (let t = 0; t < idx.count; t += 3) {
      A.fromBufferAttribute(p, idx.getX(t)); B.fromBufferAttribute(p, idx.getX(t + 1)); C.fromBufferAttribute(p, idx.getX(t + 2));
      E1.subVectors(B, A).cross(E2.subVectors(C, A));
      const len = E1.length();
      if (E1.y / (len || 1) < minNy) continue;
      total += len * 0.5;
      tris.push(total, bi, idx.getX(t), idx.getX(t + 1), idx.getX(t + 2));
    }
  });
  const out = [], nT = tris.length / 5;
  for (let k = 0; k < n * 4 && out.length < n; k++) {
    const r = R() * total;
    let lo = 0, hi = nT - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (tris[m * 5] < r) lo = m + 1; else hi = m; }
    const b = blobs[tris[lo * 5 + 1]], p = b.geo.attributes.position, nr = b.geo.attributes.normal;
    let u = R(), v = R();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const ia = tris[lo * 5 + 2], ib = tris[lo * 5 + 3], ic = tris[lo * 5 + 4];
    const P = new V3().fromBufferAttribute(p, ia).multiplyScalar(1 - u - v).addScaledVector(A.fromBufferAttribute(p, ib), u).addScaledVector(B.fromBufferAttribute(p, ic), v);
    const N = new V3().fromBufferAttribute(nr, ia).multiplyScalar(1 - u - v).addScaledVector(A.fromBufferAttribute(nr, ib), u).addScaledVector(B.fromBufferAttribute(nr, ic), v).normalize();
    const buried = blobs.some((o) => o !== b && ((P.x - o.p.x) / o.rx) ** 2 + ((P.y - o.p.y) / o.ry) ** 2 + ((P.z - o.p.z) / (o.rz ?? o.rx)) ** 2 < 0.85);
    if (!buried) out.push([P, N]);
  }
  return out;
}

/**
 * Scatter small solid leaf cards over the surface of the blobs (skipping spots buried inside another
 * blob). Leaves tilt out of the surface so the silhouette turns leafy; their shading normals follow
 * the blob so the canopy still reads as soft volumes. Returns one coloured geometry.
 */
function leafShell(blobs, { count, L, w, pal, env, seed, alt = null, altAmt = 0, lift = [0.2, 0.95], bury = true, minNy = -2, aoMin = 0.45 }) {
  const R = rng(seed * 4099 + 11);
  const tris = [];
  let total = 0;
  const A = new V3(), B = new V3(), Cc = new V3(), E1 = new V3(), E2 = new V3();
  blobs.forEach((b, bi) => {
    const g = b.geo, p = g.attributes.position, idx = g.index;
    for (let t = 0; t < idx.count; t += 3) {
      const ia = idx.getX(t), ib = idx.getX(t + 1), ic = idx.getX(t + 2);
      A.fromBufferAttribute(p, ia); B.fromBufferAttribute(p, ib); Cc.fromBufferAttribute(p, ic);
      E1.subVectors(B, A).cross(E2.subVectors(Cc, A));
      const len = E1.length();
      if (E1.y / (len || 1) < minNy) continue;
      total += len * 0.5;
      tris.push(total, bi, ia, ib, ic);
    }
  });
  const nT = tris.length / 5;
  const pos = [], nor = [], cols = [];
  const P = new V3(), N = new V3(), nA = new V3(), nB = new V3(), nC = new V3();
  const cBase = new THREE.Color(), cTip = new THREE.Color(), tmp = new THREE.Color();
  const up = new V3(0, 1, 0), side = new V3(1, 0, 0);
  let placed = 0;
  for (let k = 0; k < count * 2 && placed < count; k++) {
    const r = R() * total;
    let lo = 0, hi = nT - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (tris[m * 5] < r) lo = m + 1; else hi = m; }
    const bi = tris[lo * 5 + 1], ia = tris[lo * 5 + 2], ib = tris[lo * 5 + 3], ic = tris[lo * 5 + 4];
    const b = blobs[bi], p = b.geo.attributes.position, n = b.geo.attributes.normal;
    let u = R(), v = R();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    A.fromBufferAttribute(p, ia); B.fromBufferAttribute(p, ib); Cc.fromBufferAttribute(p, ic);
    P.copy(A).multiplyScalar(1 - u - v).addScaledVector(B, u).addScaledVector(Cc, v);
    nA.fromBufferAttribute(n, ia); nB.fromBufferAttribute(n, ib); nC.fromBufferAttribute(n, ic);
    N.copy(nA).multiplyScalar(1 - u - v).addScaledVector(nB, u).addScaledVector(nC, v).normalize();
    let buried = false;
    for (let j = 0; bury && j < blobs.length && !buried; j++) {
      if (j === bi) continue;
      const o = blobs[j];
      const dx = (P.x - o.p.x) / o.rx, dy = (P.y - o.p.y) / o.ry, dz = (P.z - o.p.z) / (o.rz ?? o.rx);
      if (dx * dx + dy * dy + dz * dz < 0.8) buried = true;
    }
    if (buried) continue;
    placed++;
    const t0 = Math.abs(N.y) < 0.9 ? up : side;
    const T1 = new V3().crossVectors(N, t0).normalize(), T2 = new V3().crossVectors(N, T1);
    const ang = R() * TAU;
    const tdir = T1.multiplyScalar(Math.cos(ang)).addScaledVector(T2, Math.sin(ang));
    const phi = lift[0] + R() * (lift[1] - lift[0]);
    const a = tdir.multiplyScalar(Math.cos(phi)).addScaledVector(N, Math.sin(phi)).normalize();
    const pn = N.clone().addScaledVector(a, -N.dot(a)).normalize();
    const s = new V3().crossVectors(a, pn);
    const Ls = L * (0.7 + R() * 0.6), ws = w * (0.75 + R() * 0.5) * Ls / L;
    const base = P.clone().addScaledVector(N, -0.02);
    const mid = base.clone().addScaledVector(a, Ls * 0.45);
    const left = mid.clone().addScaledVector(s, -ws).addScaledVector(pn, -ws * 0.35);
    const right = mid.clone().addScaledVector(s, ws).addScaledVector(pn, -ws * 0.35);
    const tip = base.clone().addScaledVector(a, Ls).addScaledVector(pn, -Ls * 0.1);
    // colour from the same canopy ramp, with per-leaf jitter
    const rel = (P.y - env.cy) / env.ey;
    const nz = fbm3(P.x * 1.1 + seed, P.y * 1.1, P.z * 1.1, 3, seed);
    const useAlt = alt && R() < altAmt;
    const pl = useAlt ? alt : pal;
    ramp(pl, 0.44 + 0.32 * N.y + 0.18 * rel + 0.45 * (nz - 0.5) + (R() - 0.5) * 0.2, cBase);
    const ac = sstep(0.56, 0.74, fbm3(P.x * 0.7 - seed, P.y * 0.7, P.z * 0.7, 2, seed + 5));
    cBase.lerp(tmp.copy(pl.accent), ac * 0.4 + (R() < 0.05 ? 0.3 : 0));
    const bc = sstep(0.6, 0.78, fbm3(P.x * 0.9 + 4, P.y * 0.9 - seed, P.z * 0.9, 2, seed + 9));
    cBase.lerp(tmp.copy(pl.accent2), bc * 0.45);
    const dx = (P.x - env.cx) / env.ex, dy = (P.y - env.cy) / env.ey, dz = (P.z - env.cz) / env.ex;
    const ao = aoMin + (1 - aoMin) * sstep(0.3, 1.0, Math.sqrt(dx * dx + dy * dy + dz * dz)) * (0.75 + 0.25 * clamp01(N.y + 0.6));
    cBase.multiplyScalar(ao * (0.92 + R() * 0.14));
    cTip.copy(cBase).lerp(tmp.copy(pl.light), 0.12);
    const cRoot = cBase.clone().multiplyScalar(0.8);
    const sn = N.clone().multiplyScalar(0.8).addScaledVector(pn, 0.2).normalize();
    const tipN = N.clone().multiplyScalar(0.6).addScaledVector(pn, 0.4).normalize();
    const quad = [[base, right, tip], [base, tip, left]];
    for (const [q0, q1, q2] of quad) {
      E1.subVectors(q1, q0).cross(E2.subVectors(q2, q0));
      const tri = E1.dot(pn) >= 0 ? [q0, q1, q2] : [q0, q2, q1];
      for (const q of tri) {
        pos.push(q.x, q.y, q.z);
        const isTip = q === tip, isBase = q === base;
        const nn = isTip ? tipN : sn;
        nor.push(nn.x, nn.y, nn.z);
        const cc = isTip ? cTip : isBase ? cRoot : cBase;
        cols.push(cc.r, cc.g, cc.b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  return g;
}

// ------------------------------------------------------------------ trees
const SPEC = {
  round: { H: 5.6, fork: 0.3, spread: 0.42, trunk: 0.034, tint: 0xffffff, nMain: [4, 6], blobs: 1.15 },
  maple: { H: 5.4, fork: 0.28, spread: 0.41, trunk: 0.033, tint: 0xd6c3b4, nMain: [4, 6], blobs: 1.15 },
  cherry: { H: 4.6, fork: 0.26, spread: 0.5, trunk: 0.04, tint: 0x9a7066, nMain: [4, 5], blobs: 1.05 },
};

function broadleaf(kind, H, seed) {
  const sp = SPEC[kind], R = rng(seed * 131 + kind.length);
  const pal = PAL[kind];
  const g = new THREE.Group();
  const bark = barkMat(sp.tint), leaves = foliageMat('tree');
  const forkH = H * (sp.fork + (R() - 0.5) * 0.06);
  const rT = sp.trunk * H + 0.05;
  const la = R() * TAU, ll = H * 0.05 * R();
  const lx = Math.cos(la) * ll, lz = Math.sin(la) * ll;
  const trunk = new THREE.CatmullRomCurve3([
    new V3(0, -0.25, 0), new V3(lx * 0.25, forkH * 0.35, lz * 0.25), new V3(lx * 0.7 + (R() - 0.5) * 0.08, forkH * 0.72, lz * 0.7), new V3(lx, forkH * 1.05, lz),
  ]);
  put(g, limb(trunk, rT * 1.05, rT * 0.72, { seg: 14, radial: 16, flare: 1.1, lobes: 5, seed: seed % 7 }), bark);

  // roots that dive into the ground
  const nRoot = 4 + Math.floor(R() * 3);
  for (let i = 0; i < nRoot; i++) {
    const a = i / nRoot * TAU + R() * 0.5, len = rT * (3 + R() * 2.5);
    const c = new THREE.CatmullRomCurve3([
      new V3(Math.cos(a) * rT * 0.3, 0.35, Math.sin(a) * rT * 0.3),
      new V3(Math.cos(a) * rT * 1.1, 0.1, Math.sin(a) * rT * 1.1),
      new V3(Math.cos(a) * len * 0.65, 0.02, Math.sin(a) * len * 0.65),
      new V3(Math.cos(a + 0.2) * len, -0.12, Math.sin(a + 0.2) * len),
    ]);
    put(g, limb(c, rT * 0.42, rT * 0.08, { seg: 8, radial: 8, seed: i }), bark);
  }

  const env = { cx: lx, cy: forkH + (H - forkH) * 0.5, cz: lz, ex: sp.spread * H, ey: (H - forkH) * 0.5 };
  const tips = [];
  const nMain = sp.nMain[0] + Math.floor(R() * (sp.nMain[1] - sp.nMain[0] + 1));
  const a0 = R() * TAU;
  for (let i = 0; i < nMain; i++) {
    const a = a0 + i / nMain * TAU + (R() - 0.5) * 0.7;
    const start = trunk.getPointAt(0.8 + R() * 0.2);
    const reach = 0.5 + R() * 0.35;
    const end = new V3(env.cx + Math.cos(a) * env.ex * reach, env.cy + (R() * 0.9 - 0.25) * env.ey, env.cz + Math.sin(a) * env.ex * reach);
    const out = new V3(Math.cos(a), 0, Math.sin(a));
    const early = start.clone().addScaledVector(out, rT * 1.4 + 0.12); early.y += 0.35;
    const mid = start.clone().lerp(end, 0.5).addScaledVector(out, 0.15);
    mid.y += env.ey * 0.2;
    const curve = new THREE.CatmullRomCurve3([start, early, mid, end]);
    put(g, limb(curve, rT * 0.6, rT * 0.2, { seg: 9, radial: 9, seed: i + 3 }), bark);
    tips.push({ p: end, r: 0.95 });
    const nSub = 1 + Math.floor(R() * 2);
    for (let s = 0; s < nSub; s++) {
      const from = curve.getPointAt(0.4 + R() * 0.3);
      const sa = a + (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.6);
      const e2 = new V3(env.cx + Math.cos(sa) * env.ex * (0.55 + R() * 0.3), from.y + env.ey * (0.4 + R() * 0.6), env.cz + Math.sin(sa) * env.ex * (0.55 + R() * 0.3));
      const m2 = from.clone().lerp(e2, 0.5); m2.y += 0.2;
      const c2 = new THREE.CatmullRomCurve3([from, m2, e2]);
      put(g, limb(c2, rT * 0.3, rT * 0.09, { seg: 6, radial: 7, seed: i * 5 + s }), bark);
      tips.push({ p: e2, r: 0.8 });
    }
  }
  // canopy: a darker core plus a lumpy cluster on every branch tip and a few fillers on top
  const blobs = [];
  blobs.push({ p: new V3(env.cx, env.cy + env.ey * 0.05, env.cz), rx: env.ex * 0.8, ry: env.ey * 0.82, d: 5 });
  for (const t of tips) {
    const s = env.ex * (0.38 + R() * 0.12) * t.r * sp.blobs;
    blobs.push({ p: t.p, rx: s, ry: s * (0.8 + R() * 0.2), d: 3 });
  }
  // fillers spread over the canopy envelope (golden-angle spiral), skipping spots a tip already covers
  const nFill = 12;
  for (let i = 0; i < nFill; i++) {
    const yN = 0.85 - (i + 0.5) / nFill * 1.25;
    const rr = Math.sqrt(Math.max(0, 1 - yN * yN)), a = i * 2.39996 + seed;
    const p = new V3(env.cx + Math.cos(a) * rr * env.ex * 0.66, env.cy + yN * env.ey * 0.66, env.cz + Math.sin(a) * rr * env.ex * 0.66);
    if (blobs.some((b, j) => j > 0 && b.p.distanceTo(p) < env.ex * 0.42)) continue;
    const s = env.ex * (0.32 + R() * 0.12) * sp.blobs;
    blobs.push({ p, rx: s, ry: s * 0.85, d: 3 });
  }
  const geos = [];
  blobs.forEach((b, i) => {
    // keep everything under the requested height
    b.p.y = Math.min(b.p.y, H - b.ry * 0.95);
    b.rz = b.rx * (0.9 + R() * 0.2);
    const geo = leafBlob(b.rx, b.ry, b.rz, seed * 31 + i, b.d, i === 0 ? 0.18 : 0.3);
    geo.rotateY(R() * TAU);
    geo.translate(b.p.x, b.p.y, b.p.z);
    paintCanopy(geo, pal, env, seed + i, (R() - 0.5) * 0.1 - 0.08, kind === 'cherry' ? 0.6 : 0.4, 0.8);
    b.geo = geo;
    geos.push(geo);
  });
  const LEAF = { round: [0.19, 0.075, 6000], maple: [0.2, 0.1, 5600], cherry: [0.13, 0.085, 6400] }[kind];
  const shell = leafShell(blobs, {
    count: Math.round(LEAF[2] * Math.min(1.15, (env.ex * env.ex) / 4.2)), L: LEAF[0], w: LEAF[1], pal, env, seed,
    alt: kind === 'cherry' ? { dark: col(0x3f6a2a), mid: col(0x76a040), light: col(0xb4d070), accent: col(0x9bbf5a), accent2: col(0x4f7a2c) } : null,
    altAmt: kind === 'cherry' ? 0.12 : 0,
  });
  geos.push(shell);
  for (const geo of geos) put(g, prep(geo), leaves);
  g.userData.trunkRadius = rT * 1.1;
  g.userData.canopy = { center: [env.cx, env.cy, env.cz], radius: env.ex, height: H };
  return g;
}

function pineSkirt(Rr, h, seed, lobes) {
  const prof = [
    [0.002, h], [Rr * 0.3, h * 0.86], [Rr * 0.6, h * 0.58], [Rr * 0.85, h * 0.28], [Rr * 0.98, 0.04],
    [Rr, -h * 0.04], [Rr * 0.85, -h * 0.05], [Rr * 0.45, h * 0.1], [Rr * 0.15, h * 0.3], [0.002, h * 0.42],
  ];
  const g = weld(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 52));
  const p = g.attributes.position, off = seed * 1.7;
  const w8 = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const r = Math.hypot(x, z), th = Math.atan2(z, x);
    const w = clamp01(r / Rr);
    const warp = 0.5 * Math.sin(th * 3 + off) + 0.8 * (noise3(Math.cos(th) * 2, Math.sin(th) * 2, seed, seed) - 0.5);
    const lobe = Math.pow(0.5 + 0.5 * Math.cos(th * lobes + warp * 2), 1.6);
    const needle = Math.sin(th * 44 + off) * 0.5 + Math.sin(th * 97 + off * 3) * 0.5;
    const k = 1 + w * w * (0.26 * lobe - 0.12) + 0.035 * w * needle + 0.07 * w * (noise3(x * 2, y * 2, z * 2, seed) - 0.5);
    const droop = -w * w * h * (0.22 * lobe + 0.05);
    p.setXYZ(i, x * k, y + droop + 0.03 * w * needle * h, z * k);
    w8[i] = w * (0.4 + 0.6 * lobe);
  }
  g.computeVertexNormals();
  g.userData.tip = w8;
  return g;
}

function pine(H, seed) {
  const R = rng(seed * 977 + 5), pal = PAL.pine;
  const g = new THREE.Group();
  const rT = 0.03 * H + 0.06;
  const trunk = new THREE.CatmullRomCurve3([new V3(0, -0.25, 0), new V3((R() - 0.5) * 0.06, H * 0.4, (R() - 0.5) * 0.06), new V3(0, H * 0.94, 0)]);
  put(g, limb(trunk, rT * 1.1, rT * 0.25, { seg: 14, radial: 14, flare: 1.0, lobes: 5, seed }), barkMat(0xb69a88));
  const nRoot = 5;
  for (let i = 0; i < nRoot; i++) {
    const a = i / nRoot * TAU + R() * 0.6, len = rT * (3 + R() * 2);
    const c = new THREE.CatmullRomCurve3([
      new V3(Math.cos(a) * rT * 0.3, 0.3, Math.sin(a) * rT * 0.3), new V3(Math.cos(a) * rT * 1.1, 0.08, Math.sin(a) * rT * 1.1),
      new V3(Math.cos(a) * len * 0.7, 0.0, Math.sin(a) * len * 0.7), new V3(Math.cos(a) * len, -0.12, Math.sin(a) * len),
    ]);
    put(g, limb(c, rT * 0.4, rT * 0.08, { seg: 7, radial: 7, seed: i }), barkMat(0xb69a88));
  }
  const n = 8 + Math.floor(R() * 2);
  const y0 = H * 0.17, top = H * 0.93;
  const env = { cx: 0, cy: H * 0.55, cz: 0, ex: H * 0.3, ey: H * 0.45 };
  const c2 = new THREE.Color(), skirts = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const yb = y0 + (top - y0 - H * 0.08) * Math.pow(t, 0.95);
    const Rr = H * 0.29 * Math.pow(1 - t, 1.05) + 0.22;
    const h = H * 0.27 * (1 - t * 0.4);
    const geo = pineSkirt(Rr, h, seed * 11 + i, 7 + ((seed + i) % 4));
    geo.rotateY(R() * TAU);
    geo.translate((R() - 0.5) * 0.06, yb, (R() - 0.5) * 0.06);
    const tip = geo.userData.tip, jit = (R() - 0.5) * 0.12;
    setColors(geo, (P, N, cc, idx) => {
      const nz = fbm3(P.x * 1.4, P.y * 1.4, P.z * 1.4, 2, seed);
      ramp(pal, 0.2 + 0.55 * tip[idx] + 0.25 * N.y + 0.3 * (nz - 0.5) + jit + t * 0.12, cc);
      cc.lerp(c2.copy(pal.accent2), sstep(0.55, 0.75, nz) * 0.4);
      cc.multiplyScalar((0.5 + 0.5 * tip[idx]) * (N.y < -0.2 ? 0.8 : 1));
    });
    skirts.push({ geo, p: new V3(0, yb, 0), rx: Rr, ry: h });
  }
  // needle tufts on the upper faces of every tier make the silhouette bristly
  const needles = leafShell(skirts, { count: 4600, L: 0.3, w: 0.03, lift: [0.05, 0.5], bury: false, minNy: 0.15, pal, env, seed, aoMin: 0.55 });
  for (const s of skirts) put(g, prep(s.geo), foliageMat('tree'));
  put(g, prep(needles), foliageMat('tree'));
  // leader tip
  const tipGeo = pineSkirt(0.22, H * 0.12, seed + 99, 5);
  tipGeo.translate(0, top - H * 0.05, 0);
  setColors(tipGeo, (P, N, cc) => { ramp(pal, 0.55 + 0.3 * N.y, cc); });
  put(g, prep(tipGeo), foliageMat('tree'));
  g.userData.trunkRadius = rT * 1.1;
  g.userData.canopy = { center: [0, env.cy, 0], radius: H * 0.3 + 0.22, height: H };
  return g;
}

function palm(H, seed) {
  const R = rng(seed * 313 + 9), pal = PAL.palm;
  const g = new THREE.Group();
  const la = R() * TAU, lean = H * (0.1 + R() * 0.08);
  const dx = Math.cos(la) * lean, dz = Math.sin(la) * lean;
  const trunk = new THREE.CatmullRomCurve3([
    new V3(0, -0.2, 0), new V3(dx * 0.08, H * 0.3, dz * 0.08), new V3(dx * 0.4, H * 0.64, dz * 0.4), new V3(dx, H * 0.95, dz),
  ]);
  const bark = barkMat([1.45, 1.25, 1.02]);
  put(g, limb(trunk, 0.26, 0.17, { seg: Math.round(H / 0.06), radial: 16, flare: 0.55, lobes: 7, seed, rings: 0.1, knot: 0.03 }), bark);
  const T = trunk.getPointAt(1), tan = trunk.getTangentAt(1);
  // crown boot: fibrous leaf bases
  const boot = leafBlob(0.3, 0.26, 0.3, seed + 5, 5, 0.4);
  boot.translate(T.x, T.y + 0.06, T.z);
  put(g, prep(boot), bark);
  // coconuts
  const nuts = paint(0x5d4a2a, 0.55);
  const nn = 3 + Math.floor(R() * 3);
  for (let i = 0; i < nn; i++) {
    const a = i / nn * TAU + R();
    const nut = weld(new THREE.SphereGeometry(0.1, 14, 10));
    nut.scale(1, 1.12, 1);
    nut.computeVertexNormals();
    put(g, prep(nut), nuts, T.x + Math.cos(a) * 0.2, T.y - 0.1 - R() * 0.06, T.z + Math.sin(a) * 0.2);
  }
  // fronds
  const pos = [], colA = [];
  const nf = 14 + Math.floor(R() * 3);
  const up = new V3(0, 1, 0);
  const pushTri = (a, b, c, ca, cb, cc2) => { pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); colA.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc2.r, cc2.g, cc2.b); };
  for (let f = 0; f < nf; f++) {
    const az = f / nf * TAU + (R() - 0.5) * 0.4;
    const young = f % 5 === 0;
    const e0 = (young ? 58 : 12 + R() * 26) * Math.PI / 180;
    const Lf = (young ? 2.4 : 3.3 + R() * 0.8) * H / 6.2;
    const droop = (young ? 0.7 : 1.3 + R() * 0.5);
    const old = !young && R() < 0.25;
    const steps = 26;
    const spine = [];
    const P = new V3(T.x, T.y + 0.12, T.z).addScaledVector(tan, 0.05);
    const hd = new V3(Math.cos(az), 0, Math.sin(az));
    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      const el = e0 - Math.pow(u, 2.3) * droop;
      const dir = hd.clone().multiplyScalar(Math.cos(el)).add(new V3(0, Math.sin(el), 0));
      spine.push(P.clone());
      P.addScaledVector(dir, Lf / steps);
    }
    const tint = old ? 0.35 : 0;
    // rachis
    const curve = new THREE.CatmullRomCurve3(spine);
    const rach = limb(curve, 0.028, 0.006, { seg: 16, radial: 5, knot: 0 });
    const rc = new THREE.Color().copy(pal.light).lerp(pal.accent, 0.5);
    setColors(rach, (Pp, N, c) => c.copy(rc));
    pos.push(...rach.attributes.position.array);
    colA.push(...rach.attributes.color.array);
    // leaflets
    for (let s = 2; s < steps; s++) {
      const u = s / steps;
      const S = spine[s], D = spine[s + 1].clone().sub(S).normalize();
      const side0 = new V3().crossVectors(D, up).normalize();
      const len = Lf * 0.3 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.05 + 0.04)), 0.65) + 0.05;
      for (const sd of [-1, 1]) {
        for (const sub of [0, 0.5]) {
          const Sb = S.clone().lerp(spine[s + 1], sub);
          const dir = side0.clone().multiplyScalar(sd).addScaledVector(D, 0.55).addScaledVector(up, -0.25 - 0.4 * u).normalize();
          const wv = D.clone().multiplyScalar(0.022 + 0.01 * (1 - u));
          const mid = Sb.clone().addScaledVector(dir, len * 0.55); mid.y -= len * 0.12;
          const tipP = Sb.clone().addScaledVector(dir, len); tipP.y -= len * 0.38;
          const b0 = Sb.clone().sub(wv), b1 = Sb.clone().add(wv);
          const m0 = mid.clone().sub(wv.clone().multiplyScalar(0.9)), m1 = mid.clone().add(wv.clone().multiplyScalar(0.9));
          const cBase = ramp(pal, 0.25 + R() * 0.1 - tint * 0.3, new THREE.Color());
          const cMid = ramp(pal, 0.55 + R() * 0.15, new THREE.Color());
          const cTip = ramp(pal, 0.8 + R() * 0.15, new THREE.Color());
          if (old) { cMid.lerp(pal.accent, 0.55); cTip.lerp(pal.accent, 0.8); }
          else if (u > 0.8) cTip.lerp(pal.accent, 0.35);
          pushTri(b0, m0, b1, cBase, cMid, cBase);
          pushTri(b1, m0, m1, cBase, cMid, cMid);
          pushTri(m0, tipP, m1, cMid, cTip, cMid);
        }
      }
    }
  }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  fg.setAttribute('color', new THREE.Float32BufferAttribute(colA, 3));
  fg.computeVertexNormals();
  put(g, prep(fg), foliageMat('frond'));
  g.userData.trunkRadius = 0.24;
  g.userData.canopy = { center: [T.x, T.y, T.z], radius: 2.6 * H / 6.5, height: H };
  return g;
}

const DEF_H = { round: 5.6, pine: 7.2, cherry: 4.6, maple: 5.4, palm: 6.2 };
const treeCache = new Map();

/**
 * tree({kind, seed, height}) → baked THREE.Group, origin at the trunk base, about `height` m tall.
 * userData: {kind, height, trunkRadius, canopy:{center, radius, height}} (use trunkRadius for a collider).
 */
export function tree({ kind = 'round', seed = 1, height } = {}) {
  const H = height ?? DEF_H[kind] ?? 5.5;
  const key = `${kind}:${seed}:${H}`;
  if (!treeCache.has(key)) {
    let g;
    if (kind === 'pine') g = pine(H, seed);
    else if (kind === 'palm') g = palm(H, seed);
    else g = broadleaf(SPEC[kind] ? kind : 'round', H, seed);
    g.name = 'tree-' + kind;
    g.userData.kind = kind;
    g.userData.height = H;
    bake(g);
    treeCache.set(key, g);
  }
  const out = treeCache.get(key).clone();
  return out;
}

// ------------------------------------------------------------------ bush
const bushCache = new Map();
/** bush({seed, color, size, flowers}) → baked Group about 0.9 m tall and 1.2 m wide (scaled by size). */
export function bush({ seed = 1, color = 0x4f8a2e, size = 1, flowers = 0 } = {}) {
  const key = `${seed}:${color}:${size}:${flowers}`;
  if (bushCache.has(key)) return bushCache.get(key).clone();
  const R = rng(seed * 59 + 3);
  const g = new THREE.Group();
  const pal = tonePal(color);
  const n = 5 + Math.floor(R() * 3);
  const env = { cx: 0, cy: 0.42 * size, cz: 0, ex: 0.62 * size, ey: 0.45 * size };
  const blobs = [{ x: 0, z: 0, r: 0.46, y: 0.42 }];
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU + R() * 0.6, d = 0.28 + R() * 0.18;
    blobs.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, r: 0.27 + R() * 0.12, y: 0.24 + R() * 0.2 });
  }
  const bl = blobs.map((b, i) => {
    const r = b.r * size;
    const geo = leafBlob(r, r * 0.9, r, seed * 13 + i, i === 0 ? 5 : 3, 0.36);
    const p = new V3(b.x * size, Math.max(b.y * size, r * 0.72), b.z * size);
    geo.translate(p.x, p.y, p.z);
    paintCanopy(geo, pal, env, seed + i, (R() - 0.5) * 0.1 - 0.08, 0.3, 0.8);
    return { geo, p, rx: r, ry: r * 0.9, rz: r };
  });
  const leaves = leafShell(bl, { count: Math.round(1500 * size * size), L: 0.1 * Math.sqrt(size), w: 0.042 * Math.sqrt(size), pal, env, seed, lift: [0.25, 0.9] });
  for (const b of bl) put(g, prep(b.geo), foliageMat('bush'));
  put(g, prep(leaves), foliageMat('bush'));
  const fl = [];
  if (flowers) {
    const cols = Array.isArray(flowers) ? flowers : [0xf3a6c4, 0xffffff, 0xf7d36a];
    // flower heads sit on the real leaf surface, facing out and a little up
    const pts = surfacePoints(bl, Math.round(44 * size), R, -0.1);
    pts.forEach(([P, N], i) => {
      if (P.y < 0.1 * size) return;
      const nn = N.clone().add(new V3(0, 0.6, 0)).normalize();
      P.addScaledVector(N, 0.015);
      fl.push(flowerHead(0.07 * Math.sqrt(size) * (0.75 + R() * 0.45), cols[i % cols.length], seed + i, P, nn));
    });
    for (const f of fl) put(g, f, petalMat());
  }
  g.name = 'bush';
  bake(g);
  bushCache.set(key, g);
  return g.clone();
}

// ------------------------------------------------------------------ flowers
/** Cupped five-petal flower head with a centre dome, oriented along `normal`, at `at`. */
function flowerHead(r, color, seed, at = new V3(), normal = new V3(0, 1, 0), petals = 5) {
  const R = rng(seed * 7 + 1);
  const rings = 2, segs = petals * 6;
  const pos = [], cols = [];
  const pc = col(color), dark = pc.clone().multiplyScalar(0.7), centre = col(R() < 0.5 ? 0xf2b632 : 0xe08a2a), deep = col(0x8a5a1a);
  const pt = (ri, si) => {
    const th = si / segs * TAU;
    const shape = 0.55 + 0.45 * Math.pow(Math.abs(Math.cos(th * petals / 2)), 0.6);
    const rr = r * (0.22 + 0.78 * ri / rings) * (ri === 0 ? 1 : shape);
    const y = r * 0.45 * Math.pow(ri / rings, 1.6) * (0.6 + 0.4 * shape);
    return new V3(Math.cos(th) * rr, y, Math.sin(th) * rr);
  };
  const cl = (ri) => (ri === 0 ? dark : pc.clone().lerp(col(0xffffff), 0.12 * ri / rings));
  for (let ri = 0; ri < rings; ri++) {
    for (let si = 0; si < segs; si++) {
      const a = pt(ri, si), b = pt(ri, si + 1), c = pt(ri + 1, si + 1), d = pt(ri + 1, si);
      const ca = cl(ri), cb = cl(ri + 1);
      pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z, a.x, a.y, a.z, d.x, d.y, d.z, c.x, c.y, c.z);
      cols.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, ca.r, ca.g, ca.b, ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cb.r, cb.g, cb.b);
    }
  }
  // centre dome
  const cs = 8, cr = r * 0.26;
  for (let si = 0; si < cs; si++) {
    const t0 = si / cs * TAU, t1 = (si + 1) / cs * TAU;
    const a = new V3(Math.cos(t0) * cr, r * 0.06, Math.sin(t0) * cr), b = new V3(Math.cos(t1) * cr, r * 0.06, Math.sin(t1) * cr), c = new V3(0, r * 0.2, 0);
    pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
    cols.push(deep.r, deep.g, deep.b, centre.r, centre.g, centre.b, deep.r, deep.g, deep.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), normal.clone().normalize());
  g.applyQuaternion(q);
  g.rotateY(0); // keep
  g.translate(at.x, at.y, at.z);
  return prep(g);
}

/** Strap leaves (like a lily/grass rosette) as coloured triangles. */
function strapLeaves(n, len, width, seed, pal, at = new V3(), spread = 1) {
  const R = rng(seed * 41 + 7);
  const pos = [], cols = [], c0 = new THREE.Color(), c1 = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, L = len * (0.6 + R() * 0.5), lean = (0.35 + R() * 0.5) * spread;
    const dir = new V3(Math.cos(a), 0, Math.sin(a));
    const side = new V3(-dir.z, 0, dir.x);
    const segs = 5;
    let prevL = null, prevR = null, prevC = null;
    for (let s = 0; s <= segs; s++) {
      const u = s / segs;
      const out = Math.sin(u * lean * 1.6) * L * 0.8, up = L * (u - u * u * lean * 0.6);
      const P = at.clone().addScaledVector(dir, out + 0.01); P.y += up;
      const w = width * Math.sin(Math.PI * Math.min(1, 0.15 + u * 0.95)) * (s === segs ? 0 : 1);
      const twist = side.clone().multiplyScalar(w / 2);
      const L0 = P.clone().sub(twist), R0 = P.clone().add(twist);
      ramp(pal, 0.15 + u * 0.75 + (R() - 0.5) * 0.1, c0);
      if (prevL) {
        pos.push(prevL.x, prevL.y, prevL.z, L0.x, L0.y, L0.z, prevR.x, prevR.y, prevR.z, prevR.x, prevR.y, prevR.z, L0.x, L0.y, L0.z, R0.x, R0.y, R0.z);
        cols.push(prevC.r, prevC.g, prevC.b, c0.r, c0.g, c0.b, prevC.r, prevC.g, prevC.b, prevC.r, prevC.g, prevC.b, c0.r, c0.g, c0.b, c0.r, c0.g, c0.b);
      }
      prevL = L0; prevR = R0; prevC = c1.copy(c0).clone();
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  // bias normals upward so thin blades light like the ground they grow from
  const nr = g.attributes.normal;
  for (let i = 0; i < nr.count; i++) {
    const x = nr.getX(i), y = nr.getY(i), z = nr.getZ(i), s = y < 0 ? -1 : 1;
    const v = new V3(x * s * 0.5, Math.abs(y) * 0.5 + 0.6, z * s * 0.5).normalize().multiplyScalar(s);
    nr.setXYZ(i, v.x, v.y, v.z);
  }
  return prep(g);
}

function stemGeo(from, to, r, color, seed) {
  const mid = from.clone().lerp(to, 0.5);
  mid.x += (noise3(seed, 0.5, 1) - 0.5) * 0.05; mid.z += (noise3(0.5, seed, 2) - 0.5) * 0.05;
  const c = new THREE.CatmullRomCurve3([from, mid, to]);
  const g = new THREE.TubeGeometry(c, 5, r, 4, false);
  const pg = prep(g);
  const cc = col(color);
  setColors(pg, (P, N, out) => out.copy(cc).multiplyScalar(0.7 + 0.3 * clamp01((P.y - from.y) / Math.max(0.01, to.y - from.y))));
  return pg;
}

const FLOWER_COLS = [[0xf38bb0, 0xffd1e0], [0xfff6ee, 0xf7d36a], [0xf7c843, 0xff9d3a], [0xb98ae8, 0xf3a6c4], [0xff7f6a, 0xffffff], [0x7fb0ff, 0xffffff]];
const flowerCache = new Map();
/** flowerPatch({seed, radius}) → baked Group: leafy rosettes with 8-12 flowers, about 0.7 m across, 0.45 m tall. */
export function flowerPatch({ seed = 1, radius = 0.35 } = {}) {
  const key = `${seed}:${radius}`;
  if (flowerCache.has(key)) return flowerCache.get(key).clone();
  const R = rng(seed * 101 + 17);
  const g = new THREE.Group();
  const green = { dark: col(0x2c4f1f), mid: col(0x4f8a34), light: col(0x93c260), accent: col(0x9bbf5a), accent2: col(0x2f6a46) };
  const cols = FLOWER_COLS[seed % FLOWER_COLS.length];
  const nClumps = 4 + Math.floor(R() * 3);
  for (let i = 0; i < nClumps; i++) {
    const a = R() * TAU, d = Math.sqrt(R()) * radius * 0.8;
    put(g, strapLeaves(7, 0.2 + R() * 0.1, 0.05, seed * 5 + i, green, new V3(Math.cos(a) * d, 0, Math.sin(a) * d), 1.3), foliageMat('low'));
  }
  const nF = 8 + Math.floor(R() * 5);
  for (let i = 0; i < nF; i++) {
    const a = R() * TAU, d = Math.sqrt(R()) * radius;
    const base = new V3(Math.cos(a) * d * 0.7, 0, Math.sin(a) * d * 0.7);
    const h = 0.22 + R() * 0.2;
    const top = new V3(Math.cos(a) * d, h, Math.sin(a) * d);
    put(g, stemGeo(base, top, 0.0055, 0x4f8a34, seed + i), foliageMat('low'));
    const nrm = new V3(Math.cos(a) * 0.35 + (R() - 0.5) * 0.3, 1, Math.sin(a) * 0.35 + (R() - 0.5) * 0.3);
    put(g, flowerHead(0.055 + R() * 0.025, cols[i % 2 === 0 ? 0 : (R() < 0.7 ? 0 : 1)], seed * 3 + i, top, nrm, R() < 0.3 ? 6 : 5), petalMat());
  }
  g.name = 'flowerPatch';
  bake(g);
  flowerCache.set(key, g);
  return g.clone();
}

// ------------------------------------------------------------------ rock
const rockCache = new Map();
/** rock({seed, size}) → baked Mesh group. size ≈ width in metres; sits slightly sunk into the ground. */
export function rock({ seed = 1, size = 0.7, moss = true } = {}) {
  const key = `${seed}:${size}:${moss}`;
  if (rockCache.has(key)) return rockCache.get(key).clone();
  const R = rng(seed * 211 + 1);
  const geo = weld(new THREE.IcosahedronGeometry(1, size > 0.9 ? 16 : 11));
  const p = geo.attributes.position, d = new V3();
  const cuts = [];
  for (let i = 0; i < 6; i++) cuts.push([new V3(R() * 2 - 1, R() * 1.4 - 0.2, R() * 2 - 1).normalize(), 0.62 + R() * 0.2]);
  const sx = 1, sy = 0.55 + R() * 0.25, sz = 0.75 + R() * 0.25;
  for (let i = 0; i < p.count; i++) {
    d.fromBufferAttribute(p, i).normalize();
    const v = d.clone().multiplyScalar(1 + 0.22 * (fbm3(d.x * 1.8, d.y * 1.8, d.z * 1.8, 4, seed) - 0.5));
    for (const [n, k] of cuts) { const s = v.dot(n); if (s > k) v.addScaledVector(n, -(s - k) * 0.6); }
    v.multiplyScalar(1 + 0.05 * (fbm3(d.x * 5, d.y * 5, d.z * 5, 2, seed + 2) - 0.5) + 0.02 * (noise3(d.x * 14, d.y * 14, d.z * 14, seed) - 0.5));
    p.setXYZ(i, v.x * sx * size * 0.5, v.y * sy * size * 0.5, v.z * sz * size * 0.5);
  }
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.min.y - size * 0.07, 0);
  const base = col(0xa9a397).multiplyScalar(0.85), mossC = col(0x7d9a45).multiplyScalar(1.05), dry = col(0xcfc6b2).multiplyScalar(0.9);
  setColors(geo, (P, N, c) => {
    const n = fbm3(P.x * 3 + seed, P.y * 3, P.z * 3, 3, seed);
    c.copy(base).multiplyScalar(0.8 + 0.35 * n).lerp(dry, sstep(0.55, 0.8, n) * 0.4);
    if (moss) c.lerp(mossC, sstep(0.4, 0.9, N.y) * sstep(0.48, 0.64, fbm3(P.x * 3.5, P.y * 3.5, P.z * 3.5, 3, seed + 7)) * 0.75);
    c.multiplyScalar(0.75 + 0.25 * clamp01(P.y / (size * 0.3)));
  });
  const g = new THREE.Group();
  put(g, prep(geo), stoneMat());
  g.name = 'rock';
  bake(g);
  rockCache.set(key, g);
  return g.clone();
}

// ------------------------------------------------------------------ shell
const shellCache = new Map();
/** shell({seed}) → small scallop shell (about 0.12 m), lying on the ground, hinge towards -Z. */
export function shell({ seed = 1 } = {}) {
  const key = `${seed}`;
  if (shellCache.has(key)) return shellCache.get(key).clone();
  const R = rng(seed * 17 + 3);
  const L = 0.1 + R() * 0.04, Hh = L * 0.28, ribs = 14 + Math.floor(R() * 6);
  const pals = [[0xf4dcc4, 0xd9684a], [0xf6e2cc, 0xc97b3e], [0xf5d8e2, 0xcc5f86], [0xeadccb, 0x9c7354]];
  const [ca, cb] = pals[seed % pals.length].map(col);
  const nu = 26, nv = 9;
  const top = [], cols = [];
  const pt = (i, j, bottom) => {
    const u = i / nu * 2 - 1, v = j / nv;
    const th = u * 1.05;
    const rad = L * v * (1 - 0.08 * u * u);
    const rib = Math.pow(Math.abs(Math.cos(u * ribs * Math.PI / 2)), 0.7);
    const dome = Math.pow(Math.max(0, 1 - u * u), 0.55) * Math.sin(Math.PI * (0.12 + 0.88 * Math.pow(v, 0.85)));
    const y = bottom ? 0.0012 + dome * Hh * 0.2 : 0.0018 + Hh * dome + rib * 0.0035 * v * Math.sin(Math.PI * Math.min(1, v * 1.1));
    return new V3(Math.sin(th) * rad, y, -L * 0.45 + Math.cos(th) * rad);
  };
  const colorAt = (i, j) => {
    const u = i / nu * 2 - 1, v = j / nv;
    const rib = Math.pow(Math.abs(Math.cos(u * ribs * Math.PI / 2)), 0.7);
    const band = 0.5 + 0.5 * Math.sin(v * 30 + seed);
    const c = ca.clone().lerp(cb, clamp01(Math.pow(v, 0.8) * (0.45 + 0.55 * band)));
    return c.multiplyScalar(0.78 + 0.22 * rib);
  };
  for (const bottom of [false, true]) {
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = pt(i, j, bottom), b = pt(i + 1, j, bottom), c = pt(i + 1, j + 1, bottom), d = pt(i, j + 1, bottom);
      const A = colorAt(i, j), B = colorAt(i + 1, j), Cc = colorAt(i + 1, j + 1), D = colorAt(i, j + 1);
      const quad = bottom ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
      const qc = bottom ? [A, B, Cc, A, Cc, D] : [A, Cc, B, A, D, Cc];
      for (const q of quad) top.push(q.x, q.y, q.z);
      for (const q of qc) cols.push(q.r * (bottom ? 0.8 : 1), q.g * (bottom ? 0.8 : 1), q.b * (bottom ? 0.8 : 1));
    }
  }
  // hinge ears
  const ear = (sx) => {
    const a = new V3(0, 0.004, -L * 0.45), b = new V3(sx * L * 0.22, 0.003, -L * 0.47), c = new V3(sx * L * 0.16, 0.004, -L * 0.3);
    const tri = sx > 0 ? [a, b, c] : [a, c, b];
    for (const q of tri) top.push(q.x, q.y, q.z);
    for (let k = 0; k < 3; k++) cols.push(ca.r * 0.9, ca.g * 0.9, ca.b * 0.9);
  };
  ear(1); ear(-1);
  const g0 = new THREE.BufferGeometry();
  g0.setAttribute('position', new THREE.Float32BufferAttribute(top, 3));
  g0.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const g1 = mergeVertices(g0, 1e-6);
  g1.computeVertexNormals();
  const g = new THREE.Group();
  const m = put(g, prep(g1), shellMat());
  m.rotation.y = R() * TAU;
  g.name = 'shell';
  bake(g);
  shellCache.set(key, g);
  return g.clone();
}

// ------------------------------------------------------------------ grass
let grassCacheObj = null;
/**
 * grassTuft() → {geometry, material} for an InstancedMesh. One tuft: 9 curved solid blades,
 * about 0.25 m tall, vertex colours dark root → light tip, origin at the root. Sways with windUniform
 * (instance-aware: neighbouring tufts move in a travelling gust wave).
 */
export function grassTuft() {
  if (grassCacheObj) return grassCacheObj;
  const R = rng(4242);
  const pos = [], cols = [];
  const root = col(0x2c4a1c), mid = col(0x5a8f32), tip = col(0xb9d470), dry = col(0xc9c27a);
  const blades = 9;
  for (let b = 0; b < blades; b++) {
    const a = b / blades * TAU + R() * 0.6;
    const r0 = 0.012 + R() * 0.03;
    const ox = Math.cos(a) * r0, oz = Math.sin(a) * r0;
    const H = 0.16 + R() * 0.11, lean = 0.25 + R() * 0.55, w0 = 0.014 + R() * 0.008;
    const dir = new V3(Math.cos(a), 0, Math.sin(a));
    const side = new V3(-dir.z, 0, dir.x).applyAxisAngle(new V3(0, 1, 0), (R() - 0.5) * 0.8);
    const hueTip = tip.clone().lerp(dry, R() < 0.2 ? 0.6 : R() * 0.15);
    const segs = 4;
    const ring = [];
    for (let s = 0; s <= segs; s++) {
      const u = s / segs;
      const P = new V3(ox, 0, oz).addScaledVector(dir, lean * H * u * u * 0.9);
      P.y = H * (u - lean * 0.3 * u * u);
      const w = s === segs ? 0 : w0 * (1 - u * 0.75);
      const c = u < 0.5 ? root.clone().lerp(mid, u * 2) : mid.clone().lerp(hueTip, (u - 0.5) * 2);
      ring.push([P.clone().addScaledVector(side, -w / 2), P.clone().addScaledVector(side, w / 2), c]);
    }
    for (let s = 0; s < segs; s++) {
      const [l0, r0p, c0] = ring[s], [l1, r1, c1] = ring[s + 1];
      pos.push(l0.x, l0.y, l0.z, l1.x, l1.y, l1.z, r0p.x, r0p.y, r0p.z);
      cols.push(c0.r, c0.g, c0.b, c1.r, c1.g, c1.b, c0.r, c0.g, c0.b);
      if (s < segs - 1) {
        pos.push(r0p.x, r0p.y, r0p.z, l1.x, l1.y, l1.z, r1.x, r1.y, r1.z);
        cols.push(c0.r, c0.g, c0.b, c1.r, c1.g, c1.b, c1.r, c1.g, c1.b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  // normals: mostly up, so blades are lit like the lawn under them from every side
  const nrm = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    const v = new V3(pos[i] * 4, 1, pos[i + 2] * 4).normalize();
    nrm[i] = v.x; nrm[i + 1] = v.y; nrm[i + 2] = v.z;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  const geometry = prep(g);
  geometry.computeBoundingSphere();
  const base = paint(0xffffff, 0.75).clone();
  base.vertexColors = true;
  const material = windify(base, 1.1, 0, { side: THREE.DoubleSide });
  material.name = 'grass-tuft';
  grassCacheObj = { geometry, material };
  return grassCacheObj;
}

/** Viewer/test helper: an InstancedMesh field of grass tufts. */
export function grassField({ count = 400, radius = 3, seed = 3 } = {}) {
  const { geometry, material } = grassTuft();
  const im = new THREE.InstancedMesh(geometry, material, count);
  const R = rng(seed), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3(), p = new V3();
  for (let i = 0; i < count; i++) {
    const a = R() * TAU, d = Math.sqrt(R()) * radius;
    p.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    q.setFromAxisAngle(new V3(0, 1, 0), R() * TAU);
    const k = 0.75 + R() * 0.6;
    s.set(k, k * (0.8 + R() * 0.4), k);
    im.setMatrixAt(i, m4.compose(p, q, s));
  }
  im.receiveShadow = true;
  im.castShadow = false;
  const g = new THREE.Group();
  g.add(im);
  return g;
}

/** Viewer helper: every tree kind in a row plus bushes, flowers, rocks, shells and grass. */
export function natureGallery({ seed = 1 } = {}) {
  const g = new THREE.Group();
  const kinds = ['round', 'pine', 'cherry', 'maple', 'palm'];
  kinds.forEach((k, i) => { const t = tree({ kind: k, seed: seed + i }); t.position.set((i - 2) * 7, 0, 0); g.add(t); });
  for (let i = 0; i < 3; i++) { const b = bush({ seed: seed + i, color: [0x4f8a2e, 0x3f7a4a, 0x6a8f2e][i], flowers: i === 2 ? 1 : 0 }); b.position.set(-6 + i * 2.2, 0, 5); g.add(b); }
  for (let i = 0; i < 3; i++) { const f = flowerPatch({ seed: seed + i }); f.position.set(1.5 + i * 1.1, 0, 5.5); g.add(f); }
  for (let i = 0; i < 2; i++) { const r = rock({ seed: seed + i, size: 0.6 + i * 0.5 }); r.position.set(6 + i * 1.5, 0, 5); g.add(r); }
  for (let i = 0; i < 4; i++) { const s = shell({ seed: seed + i }); s.position.set(5 + i * 0.25, 0, 6.8); g.add(s); }
  const gf = grassField({ count: 500, radius: 2.5 });
  gf.position.set(-1, 0, 7.5);
  g.add(gf);
  return g;
}

/** Viewer helper: one small showcase of the low stuff, for close-ups. */
export function groundSet({ seed = 1 } = {}) {
  const g = new THREE.Group();
  const b = bush({ seed, color: 0x4f8a2e }); b.position.set(-1.2, 0, 0); g.add(b);
  const b2 = bush({ seed: seed + 1, color: 0x3f7a4a, flowers: 1, size: 0.8 }); b2.position.set(0.3, 0, -0.6); g.add(b2);
  const f = flowerPatch({ seed }); f.position.set(0.9, 0, 0.7); g.add(f);
  const f2 = flowerPatch({ seed: seed + 3 }); f2.position.set(-0.3, 0, 1.0); g.add(f2);
  const r = rock({ seed, size: 0.8 }); r.position.set(1.8, 0, -0.4); g.add(r);
  const r2 = rock({ seed: seed + 2, size: 0.35 }); r2.position.set(1.4, 0, 0.5); g.add(r2);
  for (let i = 0; i < 4; i++) { const s = shell({ seed: seed + i }); s.position.set(-0.6 + i * 0.22, 0, 1.7); g.add(s); }
  const gf = grassField({ count: 260, radius: 1.6, seed: seed + 9 }); gf.position.set(0, 0, 0.4); g.add(gf);
  return g;
}

/** Viewer helper: a few shells and pebbles on a beach patch, for close-ups. */
export function shellSet({ seed = 1 } = {}) {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) { const s = shell({ seed: seed + i }); s.position.set((i % 3) * 0.2 - 0.2, 0, Math.floor(i / 3) * 0.2 - 0.1); g.add(s); }
  const r = rock({ seed: seed + 5, size: 0.25 }); r.position.set(0.4, 0, -0.15); g.add(r);
  return g;
}
