// SEONN AIR passenger jet (parked prop) and a cabin section around the player's window seat (flight).
// buildAirplane(): origin on the ground under the fuselage centre, nose towards -Z, ~34 m long.
// buildCabin(): origin at the cabin floor centre, forward = -Z, the player sits in the left window seat.
import * as THREE from 'three';
import { mat, paint, textured, glow } from '../mat.js';
import { box, lathe, quad, plane, prep, extrude, put, group, bake } from '../geom.js';
import { canvasTex, FONT } from '../tex.js';
import { rng } from '../noise.js';
import { PI, RB, CY, SP, V, D, cached, vcMat, vcGloss, vcSoft, Atlas, txt, rr, drawMark } from '../sites/office.js';

const JFONT = '"Jua", "Hiragino Sans", "Noto Sans JP", "Apple SD Gothic Neo", sans-serif';
const NAVY = 0x1d3557, TEAL = 0x2a9d8f, SUN = 0xffb34d;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Smooth monotone cubic through [[x, y], ...] sorted by x. */
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

/** Grid of points rows[i][k] → indexed smooth geometry, optional uv(i, k) → [u, v]. */
function gridGeo(rows, { closed = false, uv = null, flip = false } = {}) {
  const nr = rows.length, nc = rows[0].length;
  const pos = new Float32Array(nr * nc * 3), uvs = uv ? new Float32Array(nr * nc * 2) : null;
  rows.forEach((r, i) => r.forEach((p, k) => { pos.set(p, (i * nc + k) * 3); if (uv) uvs.set(uv(i, k), (i * nc + k) * 2); }));
  const idx = [];
  const segs = closed ? nc : nc - 1;
  for (let i = 0; i < nr - 1; i++) for (let k = 0; k < segs; k++) {
    const k1 = (k + 1) % nc, a = i * nc + k, b = (i + 1) * nc + k, c = (i + 1) * nc + k1, d = i * nc + k1;
    if (flip) idx.push(a, d, c, a, c, b); else idx.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (uvs) g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ======================================================================================== fuselage */
const ZN = -16.9, ZT = 16.75;
const FTOP = curve([[-16.9, 3.0], [-16.78, 3.38], [-16.5, 3.76], [-16.05, 4.12], [-15.45, 4.5], [-14.75, 4.9], [-14.0, 5.17], [-13.0, 5.33], [-11.6, 5.39], [8, 5.39], [11, 5.33], [13.5, 5.21], [15.5, 5.07], [16.75, 4.96]]);
const FBOT = curve([[-16.9, 3.0], [-16.78, 2.68], [-16.5, 2.38], [-16.05, 2.08], [-15.3, 1.76], [-14.3, 1.52], [-13.0, 1.36], [-11.6, 1.31], [5, 1.31], [7, 1.39], [9, 1.66], [11, 2.15], [13, 2.86], [15, 3.6], [16.75, 4.38]]);
const FHW = curve([[-16.9, 0], [-16.78, 0.56], [-16.5, 0.98], [-16.05, 1.34], [-15.3, 1.7], [-14.3, 1.9], [-13.0, 1.97], [-11.6, 1.98], [6, 1.98], [8, 1.95], [10, 1.83], [12, 1.6], [14, 1.2], [15.6, 0.8], [16.75, 0.4]]);
const sect = (z) => { const t = FTOP(z), b = FBOT(z); return { yc: (t + b) / 2, b: (t - b) / 2, a: FHW(z) }; };
const fusPt = (z, th) => { const s = sect(z); return [s.a * Math.sin(th), s.yc + s.b * Math.cos(th), z]; };
function fusNormal(z, th) {
  const e = 0.01, zz = Math.max(z, ZN + 0.02);
  const p1 = fusPt(zz, th + e), p0 = fusPt(zz, th - e), q1 = fusPt(Math.min(zz + e, ZT), th), q0 = fusPt(zz - e, th);
  const dt = new THREE.Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
  const dz = new THREE.Vector3(q1[0] - q0[0], q1[1] - q0[1], q1[2] - q0[2]);
  const n = dz.cross(dt);
  if (n.lengthSq() < 1e-12) return new THREE.Vector3(0, 0, -1);
  return n.normalize();
}

/** Canvas livery wrapped on the fuselage: u = along z (nose..tail), v = angle from the crown towards +X. */
function liveryTex() {
  return cached('seonnLivery', () => canvasTex(4096, 1024, (c, W, H) => {
    const X = (z) => ((z - ZN) / (ZT - ZN)) * W;
    // δ = angle above the side mid-line; left side lives in the top half of the canvas, right side in the bottom half (flipped)
    const YL = (d) => H * (0.25 - d / (2 * PI)), YR = (d) => H * (0.75 + d / (2 * PI));
    c.fillStyle = '#f4f5f1'; c.fillRect(0, 0, W, H);
    const band = (f0, f1, col, z0 = ZN, z1 = ZT) => {
      for (const Y of [YL, YR]) {
        c.beginPath();
        for (let z = z0; z <= z1 + 1e-6; z += 0.1) { const x = X(z); z === z0 ? c.moveTo(x, Y(f0(z))) : c.lineTo(x, Y(f0(z))); }
        for (let z = z1; z >= z0 - 1e-6; z -= 0.1) c.lineTo(X(z), Y(f1(z)));
        c.closePath(); c.fillStyle = col; c.fill();
      }
    };
    const belly = (z) => -0.62 + 1.25 * sstep(1, 15.5, z) + 0.08 * sstep(-12, -16.5, z);
    const taper = (z) => sstep(-14.5, -9.5, z);
    band(() => -PI / 2 - 0.01, belly, '#1d3557');
    band((z) => belly(z) + 0.035 * taper(z), (z) => belly(z) + 0.17 * taper(z), '#2a9d8f');
    band((z) => belly(z) + 0.2 * taper(z), (z) => belly(z) + 0.235 * taper(z), '#ffb34d');
    // cockpit windows: painted with soft edges where the 3D point falls inside pane polygons (front and side views)
    const img = c.getImageData(0, 0, Math.ceil(X(-13.4)), H), px = img.data, iw = img.width;
    const panesF = [[[0.06, 4.24], [0.7, 4.27], [0.66, 4.62], [0.06, 4.68]]];
    const panesS = [[[-15.5, 4.3], [-14.78, 4.3], [-14.72, 4.66], [-15.06, 4.66]], [[-14.62, 4.31], [-14.0, 4.33], [-14.12, 4.62], [-14.58, 4.66]]];
    const sdf = (poly, x, y) => { let d = -1e9; for (let i = 0; i < poly.length; i++) { const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length]; const ex = bx - ax, ey = by - ay, l = Math.hypot(ex, ey); d = Math.max(d, ((x - ax) * ey - (y - ay) * ex) / l); } return d; };
    for (let ix = 0; ix < iw; ix++) {
      const z = ZN + ((ix + 0.5) / W) * (ZT - ZN), s = sect(z);
      for (let iy = 0; iy < H; iy++) {
        const v = 1 - (iy + 0.5) / H, th = v * 2 * PI;
        const x = Math.abs(s.a * Math.sin(th)), y = s.yc + s.b * Math.cos(th);
        let d = 1e9;
        for (const p of panesF) d = Math.min(d, sdf(p, x, y));
        if (x > 0.55) for (const p of panesS) d = Math.min(d, sdf(p, z, y));
        // outward winding check: polygons are counter-clockwise in their own (u, v) → sdf negative inside
        const mask = clamp(0.5 - (d - 0.045) / 0.012, 0, 1), pane = clamp(0.5 - d / 0.012, 0, 1);
        if (mask <= 0) continue;
        const j = (iy * iw + ix) * 4, g = 0.5 + 0.5 * clamp((y - 4.25) / 0.45, 0, 1);
        const pr = 22 + 28 * g, pg = 32 + 34 * g, pb = 44 + 40 * g;
        let r = px[j] * (1 - mask) + 20 * mask, gg = px[j + 1] * (1 - mask) + 22 * mask, b = px[j + 2] * (1 - mask) + 26 * mask;
        r = r * (1 - pane) + pr * pane; gg = gg * (1 - pane) + pg * pane; b = b * (1 - pane) + pb * pane;
        px[j] = r; px[j + 1] = gg; px[j + 2] = b;
      }
    }
    c.putImageData(img, 0, 0);
    // titles: letters are 0.68x as tall in canvas pixels as they are wide (texel aspect)
    const sy = (H / (2 * PI * 2.0)) / (W / (ZT - ZN));
    const label = (s, z, d, hM, col, font = FONT) => {
      const pxh = hM * (W / (ZT - ZN));
      for (const right of [false, true]) {
        c.save();
        c.translate(X(z), right ? YR(d) : YL(d));
        c.scale(1, sy);
        if (right) c.rotate(PI);
        c.font = `${pxh}px ${font}`; c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(s, 0, 0);
        c.restore();
      }
    };
    label('SEONN AIR', -7.6, 0.5, 1.0, '#1d3557');
    label('세온항공', -2.4, 0.5, 0.62, '#2a9d8f');
    label('HL7702', 9.2, 0.36, 0.3, '#1d3557');
    // small sun mark before the title
    for (const right of [false, true]) {
      c.save(); c.translate(X(-12.6), right ? YR(0.5) : YL(0.5)); c.scale(1, sy); if (right) c.rotate(PI);
      drawMark(c, 0, 0, 55, '#2a9d8f', '#ffb34d'); c.restore();
    }
  }));
}

function finTex() {
  return cached('seonnFin', () => canvasTex(1024, 1024, (c, W, H) => {
    const g = c.createLinearGradient(0, H, W, 0); g.addColorStop(0, '#16294a'); g.addColorStop(1, '#1d3557');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = '#2a9d8f';
    c.beginPath(); c.moveTo(0, H); c.bezierCurveTo(W * 0.35, H * 0.75, W * 0.55, H * 0.55, W, H * 0.12); c.lineTo(W, H * 0.3); c.bezierCurveTo(W * 0.6, H * 0.68, W * 0.4, H * 0.86, W * 0.12, H); c.closePath(); c.fill();
    c.fillStyle = '#3cc4bd';
    c.beginPath(); c.moveTo(W * 0.12, H); c.bezierCurveTo(W * 0.4, H * 0.86, W * 0.6, H * 0.68, W, H * 0.3); c.lineTo(W, H * 0.36); c.bezierCurveTo(W * 0.62, H * 0.74, W * 0.42, H * 0.9, W * 0.2, H); c.closePath(); c.fill();
    // logo: sun over a wave, facing forward
    const cx = W * 0.62, cy = H * 0.42, r = H * 0.17;
    c.fillStyle = '#ffb34d'; c.beginPath(); c.arc(cx, cy, r, 0, PI * 2); c.fill();
    c.strokeStyle = '#ffffff'; c.lineWidth = r * 0.22; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx - r * 1.25, cy + r * 0.25); c.bezierCurveTo(cx - r * 0.5, cy - r * 0.35, cx + 0.1 * r, cy + r * 0.75, cx + r * 1.25, cy - r * 0.05); c.stroke();
    // rudder hinge line
    c.strokeStyle = 'rgba(8,16,30,0.55)'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(W * 0.86, H); c.lineTo(W * 0.955, 0); c.stroke();
  }));
}

function planeMats() {
  return cached('planeMats', () => {
    const livery = new THREE.MeshPhysicalMaterial({ map: liveryTex(), roughness: 0.3, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05 }); livery.name = 'seonnLivery';
    const fin = new THREE.MeshPhysicalMaterial({ map: finTex(), roughness: 0.3, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05 }); fin.name = 'seonnFin';
    const win = new THREE.MeshPhysicalMaterial({ color: 0x18222e, roughness: 0.05, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.03, side: THREE.DoubleSide }); win.name = 'planeWindow';
    const two = (m, n) => { const c = m.clone(); c.side = THREE.DoubleSide; c.name = n; return c; };
    return {
      livery, fin, win,
      wing: paint(0xc9ced4, 0.36, 0.3, { clearcoat: 0.6 }),
      navy: paint(NAVY, 0.3, 0.1, { clearcoat: 1 }),
      lip: paint(0xdfe3e8, 0.16, 1),
      dark: two(paint(0x1b1d21, 0.62, 0.3), 'planeDark'),
      metal: paint(0x8f959c, 0.34, 0.85),
      chrome: mat('chrome'),
      tyre: mat('rubber'),
      seam: two(paint(0x7d858e, 0.5, 0.3), 'planeSeam'),
      red: glow(0xff2a2a, 3), green: glow(0x2aff7a, 3), white: glow(0xffffff, 3),
    };
  });
}

/** Airfoil loop (upper TE → LE → lower TE) as [x, y] in chord units. */
function airfoil(t, camber = 0.02, n = 12) {
  const yt = (x) => 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
  const yc = (x) => (x < 0.4 ? camber / 0.16 * (0.8 * x - x * x) : camber / 0.36 * (0.2 + 0.8 * x - x * x));
  const xs = []; for (let i = 0; i <= n; i++) xs.push((1 - Math.cos(PI * i / n)) / 2);
  const pts = [];
  for (let i = n; i >= 0; i--) pts.push([xs[i], yc(xs[i]) + yt(xs[i])]);
  for (let i = 1; i <= n; i++) pts.push([xs[i], yc(xs[i]) - yt(xs[i])]);
  return pts;
}
/** Loft airfoil stations {O (LE), c, t, N (thickness dir), camber}; chord runs along +Z. Returns geometry + cap. */
function loftFoil(st, { camber = 0.02, uv = null } = {}) {
  const rows = st.map((s) => airfoil(s.t, s.camber ?? camber).map(([u, w]) => [s.O[0] + s.N[0] * w * s.c, s.O[1] + s.N[1] * w * s.c, s.O[2] + u * s.c + s.N[2] * w * s.c]));
  const g = gridGeo(rows, { uv: uv ? (i, k) => uv(rows[i][k]) : null });
  // tip cap
  const last = rows[rows.length - 1], ctr = last.reduce((a, p) => [a[0] + p[0] / last.length, a[1] + p[1] / last.length, a[2] + p[2] / last.length], [0, 0, 0]);
  const cp = [];
  for (let k = 0; k < last.length - 1; k++) cp.push(...ctr, ...last[k + 1], ...last[k]);
  const cap = new THREE.BufferGeometry(); cap.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3)); cap.computeVertexNormals();
  return { g, cap, rows };
}

/* ---------------------------------------------------------------- wing (right side; mirror for left) */
const DIH = 0.096, ZLE0 = -4.4, YR0 = 2.3;
const chordAt = curve([[0, 6.6], [2, 6.35], [6, 4.4], [16.2, 1.5]]);
function wingStations() {
  const st = [];
  for (const x of [0, 1, 2, 3.2, 4.5, 6, 7.5, 9, 10.5, 12, 13.5, 15, 16.2]) {
    st.push({ O: [x, YR0 + x * DIH, ZLE0 + x * 0.51], c: chordAt(x), t: 0.15 - 0.045 * (x / 16.2), N: [-DIH, 1, 0] });
  }
  // blended winglet: the span direction turns up
  const tip = st[st.length - 1], r = 0.7, S0 = new THREE.Vector3(1, DIH, 0).normalize(), N0 = new THREE.Vector3(-DIH, 1, 0).normalize();
  const ctr = new THREE.Vector3(...tip.O).addScaledVector(N0, r), bm = PI / 2 - 0.14 - Math.atan(DIH);
  let last;
  for (let i = 1; i <= 5; i++) {
    const b = (bm * i) / 5, f = i / 5;
    const P = ctr.clone().addScaledVector(S0, r * Math.sin(b)).addScaledVector(N0, -r * Math.cos(b));
    const N = N0.clone().multiplyScalar(Math.cos(b)).addScaledVector(S0, -Math.sin(b));
    last = { O: [P.x, P.y, tip.O[2] + 0.4 * f], c: 1.5 - 0.25 * f, t: 0.1, N: N.toArray(), camber: 0.01 };
    st.push(last);
  }
  const Sw = new THREE.Vector3(Math.sin(0.14), Math.cos(0.14), 0);
  for (const f of [0.5, 1]) {
    const P = new THREE.Vector3(...last.O).addScaledVector(Sw, 2.0 * f);
    st.push({ O: [P.x, P.y, last.O[2] + 1.0 * f], c: 1.25 - 0.62 * f, t: 0.09, N: last.N, camber: 0.0 });
  }
  return st;
}
/** Point on the main wing's upper surface at span x and chord fraction f. */
function wingTop(x, f, lift = 0.004) {
  const c = chordAt(x), t = 0.15 - 0.045 * (x / 16.2);
  const yt = 5 * t * (0.2969 * Math.sqrt(f) - 0.126 * f - 0.3516 * f * f + 0.2843 * f ** 3 - 0.1036 * f ** 4);
  const yc = f < 0.4 ? 0.02 / 0.16 * (0.8 * f - f * f) : 0.02 / 0.36 * (0.2 + 0.8 * f - f * f);
  const w = (yc + yt) * c + lift;
  return [x - DIH * w, YR0 + x * DIH + w, ZLE0 + x * 0.51 + f * c];
}
/** Thin strip on the wing top from (x0, f0) to (x1, f1). */
function wingLine(x0, f0, x1, f1, wdt = 0.03) {
  const rows = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, x = x0 + (x1 - x0) * t, f = f0 + (f1 - f0) * t;
    const p = wingTop(x, f), q = wingTop(x + 0.01 * (f1 - f0 !== 0 ? 1 : 0), f + 0.01 * (f1 - f0 === 0 ? 1 : 0));
    const along = Math.abs(x1 - x0) > Math.abs(f1 - f0) * 3;
    const off = along ? [0, 0, wdt / 2] : [wdt / 2, 0, 0];
    void q;
    rows.push([[p[0] - off[0], p[1], p[2] - off[2]], [p[0] + off[0], p[1], p[2] + off[2]]]);
  }
  return gridGeo(rows, { flip: Math.abs(x1 - x0) <= Math.abs(f1 - f0) * 3 });
}
function mirrorGeo(g) {
  const h = g.clone(); h.scale(-1, 1, 1);
  const idx = h.index;
  if (idx) { const a = idx.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } idx.needsUpdate = true; }
  else { const p = h.attributes.position.array; for (let i = 0; i < p.length; i += 9) for (let j = 0; j < 3; j++) { const t = p[i + 3 + j]; p[i + 3 + j] = p[i + 6 + j]; p[i + 6 + j] = t; } }
  h.computeVertexNormals();
  return h;
}

/** Wing, winglet, engine, pylon, flap fairings and lines for one side into parent (side = 1 right, -1 left). */
function addWing(parent, M, side, { root = 0 } = {}) {
  const sg = (g) => (side > 0 ? g : mirrorGeo(g));
  const st = wingStations().filter((s, i) => i === 0 ? true : s.O[0] >= root - 1e-6 || i > 12);
  if (root > 0) st[0] = { ...st[0], O: [root, YR0 + root * DIH, ZLE0 + root * 0.51], c: chordAt(root) };
  const nMain = st.findIndex((s) => s.O[0] >= 16.19) + 1;
  const main = loftFoil(st.slice(0, nMain)), tipw = loftFoil(st.slice(nMain - 1), { camber: 0.01 });
  put(parent, prep(sg(main.g)), M.wing);
  put(parent, prep(sg(tipw.g)), M.navy);
  put(parent, prep(sg(tipw.cap)), M.navy);
  // hinge and panel lines on the upper surface
  const lines = [[Math.max(root, 2.4), 0.74, 11.2, 0.74], [11.5, 0.73, 15.6, 0.73], [Math.max(root, 3), 0.6, 10.8, 0.6], [Math.max(root, 1.6), 0.13, 15.8, 0.13], [6.1, 0.6, 6.1, 1.0], [11.3, 0.6, 11.3, 1.0], [8.5, 0.6, 8.5, 0.74]];
  for (const [x0, f0, x1, f1] of lines) if (x0 >= root) put(parent, prep(sg(wingLine(x0, f0, x1, f1, 0.028))), M.seam);
  // flap-track fairings
  for (const x of [4.2, 8.2, 11.8]) {
    if (x < root) continue;
    const te = ZLE0 + x * 0.51 + chordAt(x);
    put(parent, SP(1, 18, 10).clone().scale(0.15, 0.2, 1.15), M.wing, side * x, YR0 + x * DIH - 0.18, te - 0.25);
  }
  // nav light
  const tipO = st[nMain - 1].O;
  put(parent, SP(0.07, 10, 8), side > 0 ? M.green : M.red, side * (tipO[0] + 0.15), tipO[1] + 0.05, tipO[2] + 0.2);
  // engine
  const ex = 5.7 * side, ey = 1.95, ez = -7.0;
  const lp = (pts) => lathe(pts.map(([s, r]) => [r, -s]), 40).rotateX(-PI / 2);
  put(parent, lp([[3.65, 0.8], [3.0, 0.93], [2.0, 1.0], [1.1, 1.01], [0.45, 0.975]]), M.navy, ex, ey, ez);
  put(parent, lp([[0.45, 0.975], [0.15, 0.93], [0.03, 0.885], [0.0, 0.84], [0.04, 0.8], [0.18, 0.775]]), M.lip, ex, ey, ez);
  put(parent, lp([[0.18, 0.775], [0.66, 0.775]].reverse().reverse()), M.dark, ex, ey, ez).material = M.dark;
  put(parent, CY(0.776, 0.776, 0.02, 40), M.dark, ex, ey, ez + 0.66, PI / 2, 0, 0);
  put(parent, lp([[0.66, 0.29], [0.5, 0.25], [0.34, 0.17], [0.23, 0.07], [0.2, 0.0]]), M.lip, ex, ey, ez);
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * PI * 2;
    put(parent, box(0.11, 0.48, 0.016), M.metal, ex + Math.cos(a) * 0.52, ey + Math.sin(a) * 0.52, ez + 0.6, 0, 0.55, a - PI / 2).rotation.order = 'ZYX';
  }
  put(parent, lp([[4.6, 0.43], [4.1, 0.52], [3.55, 0.6], [3.5, 0.0]].reverse().reverse()), M.metal, ex, ey, ez);
  put(parent, CY(0.8, 0.8, 0.02, 40, true), M.dark, ex, ey, ez + 3.6, PI / 2, 0, 0);
  put(parent, lp([[5.25, 0.0], [4.9, 0.18], [4.45, 0.33], [4.3, 0.36]]), M.metal, ex, ey, ez);
  // pylon (side profile in z/y, extruded across x)
  const s = new THREE.Shape();
  [[-6.3, 2.75], [-5.6, 3.05], [-3.4, 3.18], [-1.6, 3.05], [-0.4, 2.7], [1.3, 2.52], [1.3, 2.36], [-0.6, 2.36], [-2.4, 2.42], [-3.7, 2.62], [-6.0, 2.68]].forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)));
  const pg = extrude(s, 0.26, 0.03); pg.rotateY(-PI / 2); pg.translate(0.13, 0, 0);
  put(parent, pg, M.wing, ex, 0, 0);
}

/* ======================================================================================== airplane */
/** buildAirplane() → {group}: SEONN AIR jet, nose -Z, wheels on y = 0. */
export function buildAirplane() {
  const M = planeMats();
  const root = new THREE.Group();
  root.name = 'airplane';
  // fuselage loft with livery UVs
  const zs = [];
  for (let i = 0; i <= 24; i++) zs.push(ZN + 2.4 * (i / 24) ** 2);
  for (let z = -14.25; z < -11; z += 0.25) zs.push(z);
  for (let z = -11; z < 6; z += 0.5) zs.push(z);
  for (let z = 6; z < 14; z += 0.3) zs.push(z);
  for (let z = 14; z < ZT; z += 0.15) zs.push(z);
  zs.push(ZT);
  const NR = 56;
  const rows = zs.map((z) => { const r = []; for (let k = 0; k <= NR; k++) r.push(fusPt(z, (k / NR) * PI * 2)); return r; });
  const fg = gridGeo(rows, { uv: (i, k) => [(zs[i] - ZN) / (ZT - ZN), k / NR] });
  // analytic normals (seam and nose tip safe)
  const nor = fg.attributes.normal;
  zs.forEach((z, i) => { for (let k = 0; k <= NR; k++) { const n = fusNormal(z, (k / NR) * PI * 2); nor.setXYZ(i * (NR + 1) + k, n.x, n.y, n.z); } });
  put(root, prep(fg, true), M.livery);
  // tail cap + APU exhaust
  const s = sect(ZT);
  put(root, SP(1, 24, 12).clone().scale(s.a, s.b, 0.3), M.livery, 0, s.yc, ZT);
  put(root, CY(0.17, 0.2, 0.3, 18), M.dark, 0, s.yc, ZT + 0.22, PI / 2, 0, 0);
  // belly fairing
  put(root, SP(1, 32, 16).clone().scale(1.95, 0.85, 6.3), M.navy, 0, 1.92, 0.2);
  // passenger windows, doors (conformed onto the skin)
  const conform = (z0, s0, sd, outline, off) => {
    const pts = outline.map(([dz, ds]) => {
      const z = z0 + dz, r = (sect(z).a + sect(z).b) / 2, th = sd > 0 ? PI / 2 - (s0 + ds) / r : 1.5 * PI + (s0 + ds) / r;
      const p = fusPt(z, th), n = fusNormal(z, th);
      return [p[0] + n.x * off, p[1] + n.y * off, p[2] + n.z * off];
    });
    return pts;
  };
  const rrect = (w, h, r, n = 5) => {
    const o = [];
    const cs = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, PI / 2], [-w / 2 + r, -h / 2 + r, PI], [w / 2 - r, -h / 2 + r, 1.5 * PI]];
    for (const [cx, cy, a0] of cs) for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * PI / 2; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return o;
  };
  const fan = (pts, sd) => {
    const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length, a[2] + p[2] / pts.length], [0, 0, 0]);
    const out = [];
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if (sd > 0) out.push(...c, ...b, ...a); else out.push(...c, ...a, ...b); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3)); g.computeVertexNormals();
    return prep(g);
  };
  const ring = (outer, inner, sd) => {
    const out = [];
    for (let i = 0; i < outer.length; i++) {
      const j = (i + 1) % outer.length, a = outer[i], b = outer[j], c = inner[i], d = inner[j];
      if (sd > 0) out.push(...a, ...c, ...b, ...b, ...c, ...d); else out.push(...a, ...b, ...c, ...b, ...d, ...c);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3)); g.computeVertexNormals();
    return prep(g);
  };
  const winShape = rrect(0.23, 0.33, 0.1);
  const doors = [[-12.1, -0.12, 0.84, 1.86], [10.6, -0.12, 0.8, 1.82], [0.55, -0.12, 0.5, 0.95], [1.2, -0.12, 0.5, 0.95]];
  for (const sd of [1, -1]) {
    for (let z = -11.25; z < 9.9; z += 0.53) {
      if (z > -0.05 && z < 0.3) continue;
      put(root, fan(conform(z, -0.02, sd, winShape, 0.008), sd), M.win);
    }
    for (const [z, s0, w, h] of doors) {
      const o = rrect(w, h, 0.12, 4), inn = rrect(w - 0.04, h - 0.04, 0.1, 4);
      put(root, ring(conform(z, s0, sd, o, 0.006), conform(z, s0, sd, inn, 0.006), sd), M.seam);
      if (h > 1.5) put(root, fan(conform(z, 0.3, sd, rrect(0.2, 0.28, 0.08), 0.008), sd), M.win);
    }
    if (sd > 0) for (const z of [-8.4, 6.6]) {
      const o = rrect(1.7, 1.25, 0.1, 3), inn = rrect(1.66, 1.21, 0.08, 3);
      put(root, ring(conform(z, -1.55, sd, o, 0.006), conform(z, -1.55, sd, inn, 0.006), sd), M.seam);
    }
  }
  // wings, engines
  addWing(root, M, 1);
  addWing(root, M, -1);
  // vertical fin
  const finSt = [];
  for (const [y, zl, zt, t] of [[4.85, 7.4, 15.9, 0.07], [5.35, 9.0, 15.95, 0.09], [5.85, 9.85, 16.0, 0.1], [6.4, 10.35, 16.08, 0.11], [7.6, 11.2, 16.25, 0.11], [8.8, 12.05, 16.45, 0.11], [10.0, 12.9, 16.65, 0.11], [11.0, 13.6, 16.85, 0.1], [11.4, 13.9, 16.92, 0.1]]) {
    finSt.push({ O: [0, y, zl], c: zt - zl, t, N: [1, 0, 0], camber: 0 });
  }
  const fin = loftFoil(finSt, { camber: 0, uv: (p) => [(p[2] - 7.4) / 9.6, (p[1] - 4.85) / 6.6] });
  put(root, prep(mirrorGeo(fin.g), true), M.fin);
  put(root, prep(mirrorGeo(fin.cap)), M.navy);
  // horizontal stabilisers
  for (const sd of [1, -1]) {
    const hs = [];
    for (const x of [0.4, 1.5, 3, 4.6, 6.1]) hs.push({ O: [x, 4.3 + x * 0.1, 12.5 + x * 0.5], c: 3.6 - (x / 6.1) * 2.25, t: 0.1, N: [-0.1, 1, 0], camber: 0 });
    const h = loftFoil(hs, { camber: 0 });
    put(root, prep(sd > 0 ? h.g : mirrorGeo(h.g)), M.wing);
    put(root, prep(sd > 0 ? h.cap : mirrorGeo(h.cap)), M.wing);
  }
  // landing gear
  const tyre = lathe([[0.36, -0.17], [0.5, -0.18], [0.55, -0.15], [0.57, -0.08], [0.57, 0.08], [0.55, 0.15], [0.5, 0.18], [0.36, 0.17]], 32).rotateZ(PI / 2);
  for (const sd of [1, -1]) {
    const gx = 3.6 * sd, gz = 1.4;
    put(root, CY(0.12, 0.12, 1.2, 16), M.metal, gx, 1.9, gz);
    put(root, CY(0.085, 0.085, 0.75, 16), M.chrome, gx, 1.0, gz);
    put(root, RB(0.9, 0.16, 0.2, 0.05, 1), M.metal, gx, 0.57, gz);
    for (const dx of [-0.34, 0.34]) {
      put(root, tyre, M.tyre, gx + dx, 0.57, gz);
      put(root, CY(0.36, 0.36, 0.3, 24), M.lip, gx + dx, 0.57, gz, 0, 0, PI / 2);
      put(root, CY(0.12, 0.12, 0.32, 12), M.dark, gx + dx, 0.57, gz, 0, 0, PI / 2);
    }
    put(root, CY(0.05, 0.05, 2.2, 8), M.metal, gx - sd * 0.9, 1.75, gz, 0, 0, sd * 0.85);
    put(root, RB(0.05, 1.3, 1.0, 0.02, 1), M.wing, gx + sd * 0.62, 1.75, gz);
  }
  const nz = -13.3;
  put(root, CY(0.09, 0.09, 0.7, 14), M.metal, 0, 1.15, nz);
  put(root, CY(0.065, 0.065, 0.55, 14), M.chrome, 0, 0.62, nz);
  put(root, RB(0.5, 0.1, 0.12, 0.03, 1), M.metal, 0, 0.38, nz);
  const ntyre = lathe([[0.22, -0.1], [0.32, -0.11], [0.37, -0.08], [0.38, 0], [0.37, 0.08], [0.32, 0.11], [0.22, 0.1]], 28).rotateZ(PI / 2);
  for (const dx of [-0.21, 0.21]) { put(root, ntyre, M.tyre, dx, 0.38, nz); put(root, CY(0.22, 0.22, 0.18, 18), M.lip, dx, 0.38, nz, 0, 0, PI / 2); }
  for (const dx of [-0.36, 0.36]) put(root, RB(0.03, 0.55, 1.3, 0.01, 1), M.livery, dx, 1.12, nz + 0.2);
  put(root, SP(0.05, 8, 6), M.white, 0, 0.95, nz - 0.1);
  // beacons, antennas, probes
  put(root, SP(0.09, 10, 8).scale(1, 0.6, 1), M.red, 0, 5.42, -1.0);
  put(root, SP(0.09, 10, 8).scale(1, 0.6, 1), M.red, 0, 1.08, 2.4);
  put(root, SP(0.06, 8, 6), M.white, 0, 4.67, ZT + 0.32);
  for (const z of [-8, 3.5]) put(root, RB(0.04, 0.32, 0.4, 0.015, 1), M.dark, 0, 5.52, z, 0.25, 0, 0);
  for (const sd of [1, -1]) put(root, CY(0.012, 0.012, 0.25, 6), M.chrome, sd * 1.62, 3.75, -14.6, 0, 0, sd * PI / 2);
  bake(root);
  return { group: root };
}

/* ======================================================================================== cabin */
const RL = 1.86, CYC = 1.05, ZF = -3.05, ZB = 2.45;
const ROWS = [-2.37, -1.58, -0.79, 0, 0.79, 1.58];
const SEATX = [-1.485, -0.99, -0.495, 0.495, 0.99, 1.485];
const WIN_Z = (k) => -0.24 + k * 0.79;

function cabinAtlas() {
  return cached('cabinAtlas', () => {
    const G = new Atlas(1024), A = new Atlas(1024);
    const map = (c, w, h, seed) => {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#163a5c'); g.addColorStop(1, '#0d2238');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = '#2f6b4f';
      c.beginPath(); c.ellipse(w * 0.22, h * 0.6, w * 0.16, h * 0.32, -0.4, 0, PI * 2); c.fill();
      c.beginPath(); c.ellipse(w * 0.78, h * 0.5, w * 0.12, h * 0.36, 0.7, 0, PI * 2); c.fill();
      c.strokeStyle = '#ffd27a'; c.lineWidth = Math.max(2, h * 0.02); c.setLineDash([h * 0.04, h * 0.03]);
      c.beginPath(); c.moveTo(w * 0.25, h * 0.55); c.quadraticCurveTo(w * 0.5, h * 0.25, w * 0.76, h * 0.45); c.stroke(); c.setLineDash([]);
      c.save(); c.translate(w * (0.42 + seed * 0.02), h * 0.36); c.rotate(0.35); c.fillStyle = '#ffffff';
      c.beginPath(); c.moveTo(h * 0.07, 0); c.lineTo(-h * 0.05, -h * 0.02); c.lineTo(-h * 0.05, h * 0.02); c.fill(); c.fillRect(-h * 0.02, -h * 0.07, h * 0.025, h * 0.14); c.restore();
      txt(c, '서울', w * 0.13, h * 0.9, h * 0.08, '#d9ecff'); txt(c, '도쿄', w * 0.72, h * 0.9, h * 0.08, '#d9ecff');
      rr(c, w * 0.04, h * 0.05, w * 0.5, h * 0.13, 6, 'rgba(0,0,0,0.35)');
      txt(c, '도착까지 1시간 20분', w * 0.06, h * 0.14, h * 0.07, '#ffffff');
    };
    G.add('map', 384, 224, (c, w, h) => map(c, w, h, 0));
    G.add('mapWide', 640, 360, (c, w, h) => { map(c, w, h, 1); txt(c, '고도 10,400 m · 시속 840 km', w * 0.06, h * 0.26, h * 0.05, '#bfe3ff'); });
    G.add('movie', 384, 224, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#ffb36b'); g.addColorStop(1, '#e05a7a');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(w * 0.7, h * 0.35, h * 0.16, 0, PI * 2); c.fill();
      c.fillStyle = '#4a2a5a'; c.beginPath(); c.moveTo(0, h); c.lineTo(w * 0.3, h * 0.55); c.lineTo(w * 0.55, h * 0.8); c.lineTo(w * 0.8, h * 0.5); c.lineTo(w, h * 0.75); c.lineTo(w, h); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, h * 0.88, w, h * 0.12); c.fillStyle = '#3cc4bd'; c.fillRect(w * 0.04, h * 0.93, w * 0.5, h * 0.025);
    });
    G.add('menu', 384, 224, (c, w, h) => {
      c.fillStyle = '#10243c'; c.fillRect(0, 0, w, h);
      drawMark(c, 40, 38, 22, '#3cc4bd', '#ffb34d'); txt(c, 'SEONN AIR', 72, 50, 30, '#ffffff');
      ['영화', '음악', '게임', '지도'].forEach((s, i) => { rr(c, 20 + i * 90, 90, 80, 100, 10, ['#2a9d8f', '#e76f51', '#f4a261', '#457b9d'][i]); txt(c, s, 60 + i * 90, 170, 26, '#ffffff', 'center'); });
    });
    G.add('belt', 256, 96, (c, w, h) => {
      c.fillStyle = '#1b1e22'; c.fillRect(0, 0, w, h);
      txt(c, '좌석벨트', w * 0.28, h * 0.62, 30, '#ffd27a', 'center');
      c.strokeStyle = '#ffd27a'; c.lineWidth = 4; c.beginPath(); c.arc(w * 0.75, h * 0.5, 22, 0, PI * 2); c.stroke(); c.beginPath(); c.moveTo(w * 0.75 - 16, h * 0.5 + 16); c.lineTo(w * 0.75 + 16, h * 0.5 - 16); c.stroke();
    });
    G.add('exit', 256, 96, (c, w, h) => { c.fillStyle = '#16a34a'; c.fillRect(0, 0, w, h); txt(c, '비상구 EXIT', w / 2, h * 0.68, 46, '#ffffff', 'center'); });
    G.add('lav', 160, 64, (c, w, h) => { c.fillStyle = '#1b1e22'; c.fillRect(0, 0, w, h); txt(c, '화장실', w / 2, 44, 30, '#7fe3a0', 'center'); });
    G.build();
    G.mat = G.lit(1.0);
    A.add('cover', 256, 160, (c, w, h) => { c.fillStyle = '#f4f2ec'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a9d8f'; c.fillRect(0, h * 0.78, w, h * 0.08); drawMark(c, w / 2, h * 0.4, 30, '#2a9d8f', '#ffb34d'); txt(c, 'SEONN AIR', w / 2, h * 0.68, 22, '#1d3557', 'center'); });
    A.add('mag', 160, 220, (c, w, h) => { c.fillStyle = '#2a9d8f'; c.fillRect(0, 0, w, h); txt(c, '하늘길', 12, 50, 40, '#ffffff'); c.fillStyle = '#ffd27a'; c.beginPath(); c.arc(110, 140, 40, 0, PI * 2); c.fill(); txt(c, '11월호', 12, 205, 22, '#e9fbfa'); });
    A.add('card', 160, 220, (c, w, h) => { c.fillStyle = '#f1e9d2'; c.fillRect(0, 0, w, h); c.fillStyle = '#c0392b'; c.fillRect(0, 0, w, 36); txt(c, '안전 안내', 10, 27, 22, '#ffffff'); for (let i = 0; i < 4; i++) rr(c, 12 + (i % 2) * 72, 50 + Math.floor(i / 2) * 80, 64, 70, 6, '#ffffff', '#8a7d62'); });
    A.add('door', 256, 512, (c, w, h) => { c.fillStyle = '#e7e4dd'; c.fillRect(0, 0, w, h); c.strokeStyle = '#b9b4aa'; c.lineWidth = 6; c.strokeRect(8, 8, w - 16, h - 16); rr(c, w * 0.3, h * 0.2, w * 0.4, 50, 8, '#2f3a45'); txt(c, '화장실', w / 2, h * 0.2 + 36, 30, '#ffffff', 'center'); c.fillStyle = '#9aa0a6'; c.fillRect(w * 0.72, h * 0.5, 40, 12); });
    A.build();
    A.mat = A.printed(0.7);
    return { G, A };
  });
}

function cabinMats() {
  return cached('cabinMats', () => {
    const lining = paint(0xeeece6, 0.48).clone(); lining.side = THREE.DoubleSide; lining.name = 'cabinLining';
    const skin = paint(0xf2f3f0, 0.35).clone(); skin.side = THREE.DoubleSide; skin.name = 'cabinSkin';
    const pane = new THREE.MeshPhysicalMaterial({ color: 0xe8f4ff, roughness: 0.02, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide }); pane.name = 'cabinPane';
    const mood = new THREE.MeshStandardMaterial({ color: 0xf6eefc, emissive: 0xe6dcff, emissiveIntensity: 1.6, roughness: 0.4 }); mood.name = 'cabinMood';
    return {
      lining, skin, pane, mood,
      fabric: textured('fabric', { color: 0x2c4a6e, seed: 14 }, 0.5, { normal: 0.7, physical: true, sheen: 0.6, sheenColor: 0x9fc0e0 }),
      shell: paint(0xd9d8d3, 0.42),
      dark: paint(0x34373c, 0.5),
      carpet: mat('carpet'),
      aisle: textured('stripes', { color: 0x24395a, color2: 0x2e4a70, count: 10, ratio: 0.15 }, 0.8, { normal: 0.6 }),
      metal: paint(0xb9bec4, 0.3, 0.85),
      lamp: mat('lampGlow'),
      cool: mat('coolGlow'),
    };
  });
}

/** Economy seat (sitter faces -Z), cushion centre at (x, 0, z). */
function cabinSeat(g, M, A, G, x, z, { table = true, screen = 'map', cover = true, R }) {
  put(g, RB(0.44, 0.11, 0.47, 0.045, 2), M.fabric, x, 0.42, z - 0.01);
  const b = group(g, x, 0.47, z + 0.25, 0);
  b.rotation.x = 0.2;
  put(b, RB(0.44, 0.6, 0.11, 0.045, 2), M.fabric, 0, 0.32, 0);
  put(b, RB(0.46, 0.68, 0.06, 0.028, 2), M.shell, 0, 0.32, 0.075);
  put(b, RB(0.46, 0.34, 0.07, 0.025, 2), M.shell, 0, -0.17, 0.02);
  put(b, RB(0.41, 0.19, 0.12, 0.05, 2), M.fabric, 0, 0.6, -0.015);
  if (cover) {
    V(b, RB(0.35, 0.17, 0.13, 0.03, 1), 0xf4f2ec, 0, 0.64, -0.015, 0, 0, 0, vcSoft());
    D(b, A.quad('cover', 0.3, 0.15), A.mat, 0, 0.64, 0.0515);
  }
  V(b, RB(0.27, 0.17, 0.014, 0.01, 1), 0x15171a, 0, 0.47, 0.108, 0, 0, 0, vcGloss());
  D(b, G.quad(screen, 0.235, 0.135), G.mat, 0, 0.47, 0.1155);
  if (table) {
    put(b, RB(0.38, 0.25, 0.014, 0.01, 1), M.shell, 0, 0.18, 0.11);
    V(b, RB(0.05, 0.022, 0.016, 0.006, 1), 0x6e737a, 0, 0.315, 0.116);
  }
  V(b, RB(0.36, 0.16, 0.03, 0.012, 1), 0x2b2f35, 0, -0.17, 0.065, 0, 0, 0, vcSoft());
  if (R() < 0.6) D(b, A.quad(R() < 0.5 ? 'mag' : 'card', 0.1, 0.14), A.mat, -0.08 + R() * 0.16, -0.07, 0.07, 0, 0, (R() - 0.5) * 0.2);
  // belt straps
  for (const s of [-1, 1]) V(g, box(0.045, 0.006, 0.2), 0x3d4148, x + s * 0.06, 0.478, z + 0.08, 0, s * 0.3, 0);
  V(g, RB(0.07, 0.012, 0.05, 0.004, 1), 0xc9ccd1, x, 0.482, z - 0.02, 0, 0, 0, vcGloss());
}

/** buildCabin() → {group, seat, window, meal, interactables, npcSpots, lamps, extra}. Origin at the cabin floor centre. */
export function buildCabin(args = {}) {
  const M = cabinMats(), PM = planeMats();
  const { G, A } = cabinAtlas();
  const R = rng(17);
  const root = new THREE.Group();
  root.name = 'cabin';
  const lift = args.lift ?? 0;
  const g = group(root, 0, lift, 0, 0);
  const th0 = Math.acos((0 - CYC) / RL);
  const P = (z, th, r) => [r * Math.sin(th), CYC + r * Math.cos(th), z];
  // windows on both sides at the seat rows: θ centre at y = 1.0
  const thW = Math.acos((1.0 - CYC) / RL);
  const wins = [];
  for (const sd of [-1, 1]) for (let k = -3; k <= 2; k++) wins.push({ z: WIN_Z(k), th: sd * thW, sd, k });
  const inWin = (z, th, a, b, n = 2.6) => wins.some((w) => Math.abs(w.th - th) < 0.5 && (Math.abs((z - w.z) / a) ** n + Math.abs(((th - w.th) * RL) / b) ** n) <= 1);
  // lining and outer skin: grids with the window cells left out
  const shell = (r, step, a, b, m) => {
    const pos = [];
    const nz = Math.round((ZB - ZF) / 0.05), nt = Math.round((2 * th0) / step);
    for (let i = 0; i < nz; i++) for (let k = 0; k < nt; k++) {
      const z0 = ZF + (i / nz) * (ZB - ZF), z1 = ZF + ((i + 1) / nz) * (ZB - ZF), t0 = -th0 + (k / nt) * 2 * th0, t1 = -th0 + ((k + 1) / nt) * 2 * th0;
      if (inWin((z0 + z1) / 2, (t0 + t1) / 2, a, b)) continue;
      const p00 = P(z0, t0, r), p01 = P(z0, t1, r), p10 = P(z1, t0, r), p11 = P(z1, t1, r);
      pos.push(...p00, ...p10, ...p11, ...p00, ...p11, ...p01);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const n = new Float32Array(pos.length);
    for (let i = 0; i < pos.length; i += 3) { const dx = pos[i], dy = pos[i + 1] - CYC, l = Math.hypot(dx, dy); n[i] = -dx / l; n[i + 1] = -dy / l; }
    geo.setAttribute('normal', new THREE.BufferAttribute(n, 3));
    put(g, prep(geo), m);
  };
  shell(RL, 0.03, 0.19, 0.27, M.lining);
  const skin = new THREE.Group(); g.add(skin);
  shell(RL + 0.13, 0.04, 0.14, 0.2, M.skin);
  // windows: bezel ring, reveal tunnel, faint pane, shades
  const oval = (a, b, n, K = 32) => { const o = []; for (let i = 0; i < K; i++) { const t = (i / K) * PI * 2, c = Math.cos(t), s = Math.sin(t); o.push([a * Math.sign(c) * Math.abs(c) ** (2 / n), b * Math.sign(s) * Math.abs(s) ** (2 / n)]); } return o; };
  const onCyl = (w, pts, r) => pts.map(([dz, ds]) => P(w.z + dz, w.th + ds / RL, r));
  const strip = (A0, B0) => { const pos = []; for (let i = 0; i < A0.length; i++) { const j = (i + 1) % A0.length; pos.push(...A0[i], ...B0[i], ...A0[j], ...A0[j], ...B0[i], ...B0[j]); } const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); return prep(geo); };
  const fanG = (pts) => { const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length, a[2] + p[2] / pts.length], [0, 0, 0]); const pos = []; for (let i = 0; i < pts.length; i++) pos.push(...c, ...pts[i], ...pts[(i + 1) % pts.length]); const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); return prep(geo); };
  const bezOut = oval(0.235, 0.32, 4.5), bezIn = oval(0.15, 0.215, 2.6), revOut = oval(0.12, 0.18, 2.6);
  for (const w of wins) {
    put(g, strip(onCyl(w, bezOut, RL - 0.004), onCyl(w, bezIn, RL - 0.02)), M.lining);
    put(g, strip(onCyl(w, bezIn, RL - 0.02), onCyl(w, revOut, RL + 0.13)), M.lining);
    D(g, fanG(onCyl(w, revOut, RL + 0.12)), M.pane);
    const mine = w.sd < 0 && w.k === 0;
    const shade = mine ? 0 : [0, 0.35, 0.7, 1][(R() * 4) | 0];
    if (shade > 0) {
      const cut = 0.2 - shade * 0.42;
      const pts = oval(0.135, 0.2, 2.6, 40).filter(([, s]) => s >= cut);
      pts.sort((p, q) => Math.atan2(p[1] - cut, p[0]) - Math.atan2(q[1] - cut, q[0]));
      pts.push([0.135 * 0.98, cut], [-0.135 * 0.98, cut]);
      pts.sort((p, q) => Math.atan2(p[1] - cut + 0.001, p[0]) - Math.atan2(q[1] - cut + 0.001, q[0]));
      V(g, fanG(onCyl(w, pts, RL + 0.05)), 0xdedbd3);
    } else V(g, fanG(onCyl(w, oval(0.13, 0.03, 2.4, 16).map(([a, b]) => [a, b + 0.19]), RL + 0.05)), 0xdedbd3);
  }
  // floor, aisle runner, seat tracks
  const fw = 2 * Math.sqrt(RL * RL - CYC * CYC);
  put(g, box(fw + 0.1, 0.1, ZB - ZF), M.carpet, 0, -0.05, (ZF + ZB) / 2);
  put(g, plane(0.5, ZB - ZF - 0.02), M.aisle, 0, 0.003, (ZF + ZB) / 2);
  for (const x of [-1.6, -0.6, 0.6, 1.6]) V(g, box(0.035, 0.012, ZB - ZF - 0.04), 0x8b9097, x * 0.85, 0.006, (ZF + ZB) / 2, 0, 0, 0, vcGloss());
  // seats
  for (const z of ROWS) {
    for (const side of [-1, 1]) {
      const xs = SEATX.filter((x) => Math.sign(x) === side);
      for (const x of xs) {
        const front = side < 0 && Math.abs(x + 1.485) < 1e-3 && Math.abs(z + 0.79) < 1e-3;
        cabinSeat(g, M, A, G, x, z, { table: !front, screen: front ? 'mapWide' : ['map', 'movie', 'menu', 'map'][(R() * 4) | 0], R });
      }
      // armrests, legs, spar for the triple
      const x0 = side * 0.245, x1 = side * 1.73;
      for (let i = 0; i < 4; i++) {
        const ax = x0 + (x1 - x0) * (i / 3);
        put(g, RB(0.05, 0.055, 0.4, 0.02, 1), M.dark, ax, 0.66, z + 0.02);
        put(g, RB(0.04, 0.2, 0.07, 0.015, 1), M.dark, ax, 0.55, z + 0.19);
      }
      put(g, CY(0.025, 0.025, 1.4, 10), M.metal, side * 0.99, 0.33, z + 0.12, 0, 0, PI / 2);
      for (const lx of [side * 0.65, side * 1.4]) {
        put(g, RB(0.04, 0.34, 0.05, 0.012, 1), M.metal, lx, 0.18, z - 0.12);
        put(g, RB(0.04, 0.34, 0.05, 0.012, 1), M.metal, lx, 0.18, z + 0.18);
        put(g, RB(0.04, 0.03, 0.5, 0.01, 1), M.metal, lx, 0.02, z + 0.03);
      }
      V(g, RB(0.3, 0.07, 0.14, 0.02, 1), 0xd9a53a, side * 0.99, 0.29, z - 0.05, 0, 0, 0, vcSoft());
    }
  }
  // overhead bins + PSU + lights
  for (const side of [-1, 1]) {
    const s = new THREE.Shape();
    [[-1.7, 1.66], [-0.8, 1.66], [-0.72, 1.78], [-0.69, 1.98], [-0.72, 2.17], [-0.8, 2.29], [-1.32, 2.4], [-1.6, 2.14], [-1.74, 1.86]].forEach(([x, y], i) => { const xx = x * -side * -1; i ? s.lineTo(side < 0 ? x : -x, y) : s.moveTo(side < 0 ? x : -x, y); void xx; });
    for (let z0 = ZF + 0.08; z0 < ZB - 0.3; z0 += 1.6) {
      const L = Math.min(1.56, ZB - 0.06 - z0);
      put(g, extrude(s, L, 0.012), M.lining, 0, 0, z0);
      V(g, RB(0.05, 0.03, 0.28, 0.01, 1), 0x8b9097, side * 0.735, 2.2, z0 + L / 2, 0, 0, side * 0.5, vcGloss());
    }
    D(g, box(0.03, 0.012, ZB - ZF - 0.1), M.cool, side * 0.79, 1.648, (ZF + ZB) / 2);
    D(g, box(0.05, 0.012, ZB - ZF - 0.1), M.mood, side * 0.86, 2.37, (ZF + ZB) / 2);
    for (const z of ROWS) {
      put(g, RB(0.84, 0.03, 0.62, 0.01, 1), M.shell, side * 1.22, 1.645, z - 0.25);
      for (let i = 0; i < 3; i++) {
        const lx = side * (0.99 + (i - 1) * 0.3), on = side < 0 && z === -1.58 && i === 1;
        D(g, CY(0.025, 0.025, 0.01, 12), on ? M.lamp : M.metal, lx, 1.628, z - 0.38);
        V(g, CY(0.018, 0.022, 0.025, 10), 0x5a5e64, lx, 1.62, z - 0.18);
      }
      D(g, G.quad('belt', 0.12, 0.045).rotateX(PI / 2), G.mat, side * 1.22, 1.628, z - 0.5);
    }
  }
  // ceiling panel and light panels
  const crows = [];
  for (const z of [ZF, ZB]) { const r = []; for (let i = 0; i <= 12; i++) { const x = -0.88 + (i / 12) * 1.76; r.push([x, 2.36 + 0.14 * (1 - (x / 0.88) ** 2), z]); } crows.push(r); }
  put(g, prep(gridGeo(crows, { flip: true })), M.lining);
  for (let z = ZF + 0.45; z < ZB - 0.2; z += 0.79) D(g, RB(0.5, 0.012, 0.16, 0.005, 1), M.cool, 0, 2.493, z);
  // bulkheads
  const bh = (z, hole) => {
    const s = new THREE.Shape();
    for (let i = 0; i <= 40; i++) { const t = -th0 + (i / 40) * 2 * th0; const [x, y] = P(0, t, RL + 0.01); i ? s.lineTo(x, y) : s.moveTo(x, y); }
    s.closePath();
    if (hole) { const h = new THREE.Path(); h.moveTo(-0.32, 0); h.lineTo(0.32, 0); h.lineTo(0.32, 1.95); h.lineTo(-0.32, 1.95); h.closePath(); s.holes.push(h); }
    put(g, extrude(s, 0.06, 0), M.lining, 0, 0, z - 0.03);
  };
  bh(ZF, true);
  bh(ZB, false);
  for (let i = 0; i < 9; i++) V(g, RB(0.085, 1.9, 0.05, 0.02, 1), i % 2 ? 0x223a5a : 0x28446a, -0.3 + i * 0.075, 0.97, ZF + (i % 2 ? 0.0 : 0.025), 0, 0, 0, vcSoft());
  V(g, CY(0.012, 0.012, 0.7, 8), 0xb9bec4, 0, 1.94, ZF + 0.02, 0, 0, PI / 2);
  D(g, G.quad('exit', 0.3, 0.11), G.mat, 0, 2.08, ZF + 0.032);
  for (const s of [-1, 1]) { V(g, RB(0.66, 0.4, 0.03, 0.01, 1), 0x15171a, s * 1.0, 1.75, ZF + 0.045, 0, 0, 0, vcGloss()); D(g, G.quad('mapWide', 0.62, 0.35), G.mat, s * 1.0, 1.75, ZF + 0.062); }
  D(g, A.quad('door', 0.6, 1.2), A.mat, 0.85, 1.0, ZB - 0.032, 0, PI, 0);
  D(g, A.quad('door', 0.6, 1.2), A.mat, -0.85, 1.0, ZB - 0.032, 0, PI, 0);
  D(g, G.quad('lav', 0.2, 0.08), G.mat, 0, 2.05, ZB - 0.034, 0, PI, 0);
  void skin; void PM;
  bake(g);
  // the player's tray table: stowed on the seat in front unless the meal is out
  const fz = -0.79, fx = -1.485;
  const stowed = group(g, fx, 0.47, fz + 0.25, 0);
  stowed.rotation.x = 0.2;
  stowed.userData.dynamic = true;
  put(stowed, RB(0.38, 0.25, 0.014, 0.01, 1), M.shell, 0, 0.18, 0.11);
  V(stowed, RB(0.05, 0.022, 0.016, 0.006, 1), 0x6e737a, 0, 0.315, 0.116);
  bake(stowed);
  const meal = group(g, fx, 0, -0.3, 0);
  meal.userData.dynamic = true;
  const T = 0.72;
  put(meal, RB(0.4, 0.022, 0.28, 0.01, 1), M.shell, 0, T, 0);
  for (const s of [-1, 1]) put(meal, RB(0.018, 0.03, 0.2, 0.006, 1), M.metal, s * 0.205, T + 0.005, -0.1);
  const y0 = T + 0.011;
  V(meal, RB(0.36, 0.016, 0.25, 0.008, 1), 0x34506e, 0, y0 + 0.008, 0, 0, 0, 0, vcGloss());
  const y1 = y0 + 0.016;
  // 불고기 덮밥 in a white dish
  put(meal, RB(0.17, 0.045, 0.12, 0.012, 2), mat('ceramic'), -0.07, y1 + 0.0225, 0.03);
  V(meal, RB(0.15, 0.012, 0.1, 0.01, 1), 0xf6f2e8, -0.07, y1 + 0.04, 0.03, 0, 0, 0, vcSoft());
  for (let i = 0; i < 14; i++) V(meal, RB(0.03 + R() * 0.02, 0.012, 0.018, 0.005, 1), R() < 0.7 ? 0x6b3a1f : 0x8a4b26, -0.1 + R() * 0.07, y1 + 0.05, 0.0 + R() * 0.06, 0, R() * PI, 0, vcGloss());
  for (let i = 0; i < 8; i++) V(meal, CY(0.004, 0.004, 0.02, 6), 0x5fa04a, -0.04 + R() * 0.035, y1 + 0.056, 0.0 + R() * 0.06, PI / 2, 0, R() * PI);
  for (let i = 0; i < 6; i++) V(meal, RB(0.012, 0.008, 0.012, 0.003, 1), 0xf08a3c, -0.12 + R() * 0.03, y1 + 0.052, 0.05 + R() * 0.03, 0, R(), 0, vcGloss());
  // salad bowl, bread + butter, water cup, dessert, cutlery roll, gochujang tube
  put(meal, lathe([[0, 0], [0.03, 0], [0.045, 0.035], [0.043, 0.037], [0.028, 0.004], [0, 0.004]], 18), mat('ceramic'), 0.09, y1, 0.06);
  for (let i = 0; i < 7; i++) V(meal, SP(0.012, 6, 4), [0x6fae4a, 0x8cc65a, 0xd9443a][i % 3], 0.09 + (R() - 0.5) * 0.04, y1 + 0.03, 0.06 + (R() - 0.5) * 0.04);
  V(meal, SP(0.034, 12, 8).scale(1.2, 0.75, 1), 0xd9a56a, 0.1, y1 + 0.024, -0.035, 0, 0, 0, vcSoft());
  V(meal, RB(0.03, 0.012, 0.02, 0.004, 1), 0xf3e2a0, 0.05, y1 + 0.006, -0.06, 0, 0, 0, vcGloss());
  put(meal, CY(0.028, 0.024, 0.075, 16), mat('glass'), 0.14, y1 + 0.0375, 0.075).castShadow = false;
  V(meal, CY(0.022, 0.022, 0.06, 14), 0xcfe8f6, 0.14, y1 + 0.03, 0.075);
  V(meal, CY(0.029, 0.029, 0.003, 16), 0xd9dde2, 0.14, y1 + 0.076, 0.075, 0, 0, 0, vcGloss());
  V(meal, CY(0.03, 0.025, 0.04, 16), 0xf2d6e4, 0.0, y1 + 0.02, -0.075, 0, 0, 0, vcGloss());
  V(meal, CY(0.028, 0.028, 0.004, 16), 0xe76f9a, 0.0, y1 + 0.041, -0.075);
  V(meal, RB(0.2, 0.025, 0.035, 0.012, 1), 0xf7f6f1, -0.06, y1 + 0.013, -0.09, 0, 0.05, 0, vcSoft());
  V(meal, RB(0.06, 0.016, 0.022, 0.008, 1), 0xc0392b, 0.15, y1 + 0.008, -0.02, 0, 0.6, 0, vcGloss());
  bake(meal);
  meal.visible = true;
  stowed.visible = false;
  let mv = true;
  Object.defineProperty(meal, 'visible', { configurable: true, get: () => mv, set: (v) => { mv = !!v; stowed.visible = !mv; } });
  if (args.meal === false) meal.visible = false;
  // exterior wings + engines seen from the windows (cabin z 0 = plane z +1.6, floor = plane y 2.3)
  if (args.wing !== false) {
    const wg = group(root, 0, lift - 2.3, -1.6, 0);
    addWing(wg, PM, -1, { root: 1.85 });
    addWing(wg, PM, 1, { root: 1.85 });
    bake(wg);
  }
  const eye = [-1.44, 1.18, 0.17];
  const out = {
    group: root,
    seat: { pos: [eye[0], eye[1] + lift, eye[2]], yaw: 0.5, pitch: -0.12 },
    window: { center: [-Math.sqrt(RL * RL - 0.05 * 0.05), 1.0 + lift, WIN_Z(0)] },
    meal,
    interactables: [{ id: 'meal', label: '기내식 먹기', pos: [fx, 0.85 + lift, -0.3], radius: 1.2 }],
    npcSpots: [[-0.495, 0], [-0.99, -1.58], [0.495, -0.79], [1.485, -2.37], [0.99, 0.79]].map(([x, z]) => ({ pos: [x, lift, z], yaw: 0, pose: 'sit', role: 'guest' })),
    lamps: [-2.0, -0.4, 1.2].map((z) => ({ pos: [0, 2.3 + lift, z], color: 0xfff1e0, intensity: 3, range: 4 })),
    extra: { stowedTable: stowed },
  };
  out.cabinPeopleSpots = out.npcSpots;
  return out;
}
