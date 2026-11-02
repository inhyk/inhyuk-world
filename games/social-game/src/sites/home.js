// The player's house: a cozy one-storey Korean suburban home (14 x 12 footprint, door on +Z).
// Rooms: bedroom (back right), bathroom (front right), kitchen + dining (back left), living (front
// left), entry (front middle). Floor top y = 0.45, ceiling 2.7 m above it.
//
// buildHome(opts?) → Site. opts.glow (0..1, default 1) scales the night-glow materials so the
// viewer can preview day (glow 0) and night (glow 1); every nightGlow material carries
// userData.glowMax (its full night emissiveIntensity) for the game to scale by darkness.
import * as THREE from 'three';
import { makeSite } from '../site.js';
import { mat, paint, textured, glow } from '../mat.js';
import { rbox, cyl, sphere, capsule, torus, lathe, tube, prep, displace, put, group, bake } from '../geom.js';
import { canvasTex, FONT } from '../tex.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ------------------------------------------------------------------ layout constants
const FL = 0.45;            // finished floor top
const CL = FL + 2.7;        // ceiling (3.15)
const WX = 6.5, WZ0 = -5.5, WZ1 = 3.3;          // exterior wall outer faces
const IX = 6.28, IZ0 = -5.28, IZ1 = 3.08;       // interior faces
const SKIN = 0.1;           // exterior skin thickness (outer plaster layer)
const AX = 2.2;             // partition A (living | bedroom+bath) centre x, 0.12 thick
const BZ = -0.4;            // partition B (bedroom | bath) centre z, 0.12 thick
const RIDGE_Z = -1.1;
const SLOPE = 0.5;          // main roof pitch (rise / run)
const RY = 3.5;             // roof top height at the wall line
const DOOR = { x0: 0.5, x1: 1.5, h: 2.15 };      // front door opening
const BED_DOOR = { z0: -2.1, z1: -0.9 };          // doorway in partition A to the bedroom
const BATH_DOOR = { z0: 0.1, z1: 1.2 };           // doorway in partition A to the bathroom

/** Top of the main roof surface above (x, z) inside the wall lines. */
const roofY = (x, z) => RY + SLOPE * Math.min(WX - Math.abs(x), z - WZ0, WZ1 - z);

// ------------------------------------------------------------------ small helpers
/** Box from min/max corners with world-continuous metric UVs. */
function slab(parent, m, x0, y0, z0, x1, y1, z1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return put(parent, prep(g), m);
}
/** Rounded box by size and centre. */
function rb(parent, m, w, h, d, x, y, z, r = 0.012, seg = 2, rx = 0, ry = 0, rz = 0) {
  return put(parent, rbox(w, h, d, r, r <= 0.012 ? 1 : seg), m, x, y, z, rx, ry, rz); // tiny bevels need one segment
}
/** Rounded box with a vertex colour (for the shared vertex-colour materials). */
function vrb(parent, m, color, w, h, d, x, y, z, r = 0.012, seg = 2, rx = 0, ry = 0, rz = 0) {
  return put(parent, vcol(rbox(w, h, d, r, seg), color), m, x, y, z, rx, ry, rz);
}
/** Fill a geometry with one vertex colour (sRGB hex). */
function vcol(geo, hex) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
/** Cylinder between two points. */
function rod(parent, m, a, b, r, seg = 10) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const d = B.clone().sub(A), len = d.length();
  const g = cyl(r, r, len, seg);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  g.applyQuaternion(q);
  const mid = A.add(B).multiplyScalar(0.5);
  return put(parent, g, m, mid.x, mid.y, mid.z);
}
const noShadow = (o) => { o.castShadow = false; return o; };
/** Geometry of a cylinder between two points (already in place). */
function rodGeo(a, b, r, seg = 10) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const d = B.clone().sub(A), len = d.length();
  const g = cyl(r, r, len, seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  const mid = A.add(B).multiplyScalar(0.5);
  return g.translate(mid.x, mid.y, mid.z);
}
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();
/** Transform a geometry in place: scale, then Euler XYZ rotation, then translation. */
function xf(geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _e.set(rx, ry, rz); _q.setFromEuler(_e); _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
  return geo.applyMatrix4(_m);
}
/** One mesh from many prepared geometries that share a material (saves bake work). */
function merged(parent, m, geos) {
  if (!geos.length) return null;
  const g = mergeGeometries(geos, false);
  for (const x of geos) x.dispose();
  return put(parent, g, m);
}
/** Flattened round cap (ridge / hip) between two points: width w across, thickness t up. */
function capStrip(parent, m, a, b, w, t) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const D = B.clone().sub(A); const len = D.length(); D.normalize();
  const W = new THREE.Vector3().crossVectors(D, new THREE.Vector3(0, 1, 0)).normalize();
  const U = new THREE.Vector3().crossVectors(W, D).normalize();
  const g = cyl(1, 1, len, 14);
  g.scale(w / 2, 1, t / 2);
  g.applyMatrix4(new THREE.Matrix4().makeBasis(W, D, U));
  const mid = A.add(B).multiplyScalar(0.5);
  return put(parent, g, m, mid.x, mid.y, mid.z);
}
/** Pieces of a wall run [a0,a1] x [y0,y1] with rectangular holes {a, b, lo, hi}. */
function wallPieces(a0, a1, y0, y1, holes) {
  const out = [];
  const hs = holes.filter((h) => h.b > a0 && h.a < a1).sort((p, q) => p.a - q.a);
  let cur = a0;
  for (const h of hs) {
    const ha = Math.max(h.a, a0), hb = Math.min(h.b, a1);
    if (ha > cur) out.push([cur, ha, y0, y1]);
    if (h.lo > y0) out.push([ha, hb, y0, Math.min(h.lo, y1)]);
    if (h.hi < y1) out.push([ha, hb, Math.max(h.hi, y0), y1]);
    cur = Math.max(cur, hb);
  }
  if (cur < a1) out.push([cur, a1, y0, y1]);
  return out.filter(([p0, p1, q0, q1]) => p1 - p0 > 1e-3 && q1 - q0 > 1e-3);
}
/** Wall run along X (axis 'x', occupying z ∈ [t0,t1]) or along Z (axis 'z', occupying x ∈ [t0,t1]). */
function wallRun(parent, m, axis, a0, a1, t0, t1, y0, y1, holes = []) {
  for (const [p0, p1, q0, q1] of wallPieces(a0, a1, y0, y1, holes)) {
    if (axis === 'x') slab(parent, m, p0, q0, t0, p1, q1, t1);
    else slab(parent, m, t0, q0, p0, t1, q1, p1);
  }
}
function wallCollide(site, axis, a0, a1, t0, t1, y0, y1, holes = []) {
  for (const [p0, p1, q0, q1] of wallPieces(a0, a1, y0, y1, holes)) {
    if (axis === 'x') site.colliders.push({ min: [p0, q0, t0], max: [p1, q1, t1] });
    else site.colliders.push({ min: [t0, q0, p0], max: [t1, q1, p1] });
  }
}
const box3 = (site, x0, y0, z0, x1, y1, z1) => site.colliders.push({ min: [x0, y0, z0], max: [x1, y1, z1] });

/** Soft (displaced) rounded box for cushions, pillows, duvets. */
function softBox(w, h, d, r, puff = 0.02, wob = 0.006, seed = 1) {
  const sg = (v) => Math.max(2, Math.min(22, Math.round(v / 0.06)));
  const raw = new THREE.BoxGeometry(w, h, d, sg(w), sg(h), sg(d));
  // round the corners like a RoundedBox by pulling vertices towards an inner box
  const p = raw.attributes.position, iw = w / 2 - r, ih = h / 2 - r, id = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const cx = Math.max(-iw, Math.min(iw, x)), cy = Math.max(-ih, Math.min(ih, y)), cz = Math.max(-id, Math.min(id, z));
    const dx = x - cx, dy = y - cy, dz = z - cz, len = Math.hypot(dx, dy, dz) || 1;
    const k = Math.min(1, r / len);
    p.setXYZ(i, cx + dx * (len > r ? k : 1), cy + dy * (len > r ? k : 1), cz + dz * (len > r ? k : 1));
  }
  return displace(raw, (x, y, z) => {
    const fx = 1 - (2 * x / w) ** 2, fz = 1 - (2 * z / d) ** 2;
    const s = Math.sin(x * 23 + seed) * Math.sin(z * 19 + seed * 2) + Math.sin(x * 41 + z * 37 + seed) * 0.5;
    return puff * Math.max(0, fx) * Math.max(0, fz) * Math.sign(y || 1) * (y > 0 ? 1 : 0.3) + wob * s;
  });
}

// ------------------------------------------------------------------ canvas art (one atlas)
const AW = 2048, AH = 1024;
const CELLS = {
  poster1: [0, 0, 384, 512], poster2: [384, 0, 384, 512], art: [768, 0, 512, 384], calendar: [1280, 0, 256, 352],
  clock: [1536, 0, 256, 256], number: [1792, 0, 256, 128], note: [1792, 128, 128, 128], drawing: [1536, 256, 256, 256],
  photo1: [0, 512, 256, 192], photo2: [256, 512, 256, 192], photo3: [512, 512, 256, 192], photo4: [768, 512, 256, 192],
  magazine: [1024, 512, 192, 256], cereal: [1216, 512, 192, 256], milk: [1408, 512, 192, 256], game: [1600, 512, 256, 160],
  book: [768, 384, 512, 128],
};
function drawAtlas(ctx) {
  const C = CELLS;
  const at = (cell, fn) => { const [x, y, w, h] = cell; ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip(); fn(w, h); ctx.restore(); };
  const grad = (y0, y1, stops) => { const g = ctx.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
  const hills = (w, base, amp, col, seed) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, 2000);
    for (let x = 0; x <= w; x += 4) ctx.lineTo(x, base - amp * (0.55 * Math.sin(x * 0.012 + seed) + 0.3 * Math.sin(x * 0.031 + seed * 2) + 0.15 * Math.sin(x * 0.07 + seed * 3)));
    ctx.lineTo(w, 2000); ctx.closePath(); ctx.fill();
  };
  ctx.fillStyle = '#e9e4da'; ctx.fillRect(0, 0, AW, AH);
  // poster1: kid's space adventure poster
  at(C.poster1, (w, h) => {
    ctx.fillStyle = grad(0, h, [[0, '#14193d'], [0.6, '#2b2f6e'], [1, '#6a3f86']]); ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) { const s = (i * 7919) % 997 / 997; ctx.fillStyle = `rgba(255,255,255,${0.3 + s * 0.7})`; ctx.fillRect((i * 151) % w, (i * 263) % (h * 0.8), 2, 2); }
    ctx.fillStyle = '#f2a65a'; ctx.beginPath(); ctx.arc(w * 0.68, h * 0.36, 70, 0, 7); ctx.fill();
    ctx.strokeStyle = '#ffd9a8'; ctx.lineWidth = 9; ctx.beginPath(); ctx.ellipse(w * 0.68, h * 0.36, 118, 26, -0.35, 0, 7); ctx.stroke();
    ctx.fillStyle = '#7fd1c7'; ctx.beginPath(); ctx.arc(w * 0.22, h * 0.2, 28, 0, 7); ctx.fill();
    // rocket
    ctx.save(); ctx.translate(w * 0.3, h * 0.58); ctx.rotate(-0.5);
    ctx.fillStyle = '#f4f1ea'; ctx.beginPath(); ctx.ellipse(0, 0, 26, 70, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#e2574c'; ctx.beginPath(); ctx.moveTo(-26, 30); ctx.lineTo(-48, 75); ctx.lineTo(-14, 55); ctx.fill(); ctx.beginPath(); ctx.moveTo(26, 30); ctx.lineTo(48, 75); ctx.lineTo(14, 55); ctx.fill();
    ctx.fillStyle = '#4aa3df'; ctx.beginPath(); ctx.arc(0, -15, 12, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(-14, 66); ctx.lineTo(0, 120); ctx.lineTo(14, 66); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffd25e'; ctx.font = `72px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('우주 탐험대', w / 2, h - 70);
    ctx.fillStyle = '#c9c4f0'; ctx.font = `26px ${FONT}`; ctx.fillText('SPACE CREW · 2026', w / 2, h - 30);
  });
  // poster2: mountain print
  at(C.poster2, (w, h) => {
    ctx.fillStyle = '#f3ede1'; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.translate(30, 30); const iw = w - 60, ih = h - 130;
    ctx.beginPath(); ctx.rect(0, 0, iw, ih); ctx.clip();
    ctx.fillStyle = grad(0, ih, [[0, '#f6c79a'], [0.5, '#f3dcc0'], [1, '#e9e1d0']]); ctx.fillRect(0, 0, iw, ih);
    ctx.fillStyle = '#e8805a'; ctx.beginPath(); ctx.arc(iw * 0.66, ih * 0.38, 40, 0, 7); ctx.fill();
    hills(iw, ih * 0.55, 60, '#8fa9a3', 1); hills(iw, ih * 0.68, 50, '#5f8582', 2.5); hills(iw, ih * 0.82, 40, '#355f62', 4); hills(iw, ih * 0.95, 30, '#21424a', 6);
    ctx.restore();
    ctx.fillStyle = '#2e3b3f'; ctx.font = `40px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('한라산의 아침', w / 2, h - 52);
    ctx.font = `18px ${FONT}`; ctx.fillStyle = '#7b7f7a'; ctx.fillText('JEJU · HALLASAN', w / 2, h - 24);
  });
  // art: soft abstract shapes
  at(C.art, (w, h) => {
    ctx.fillStyle = '#efe6d6'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d9825b'; ctx.beginPath(); ctx.arc(w * 0.3, h * 0.55, 110, 0, 7); ctx.fill();
    ctx.fillStyle = '#86a08a'; ctx.beginPath(); ctx.ellipse(w * 0.62, h * 0.42, 120, 150, 0.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#e7b851'; ctx.fillRect(w * 0.5, h * 0.62, 170, 90);
    ctx.fillStyle = '#2f4858'; ctx.beginPath(); ctx.arc(w * 0.8, h * 0.25, 34, 0, 7); ctx.fill();
    ctx.strokeStyle = '#2f4858'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(40, h * 0.85); ctx.bezierCurveTo(w * 0.3, h * 0.6, w * 0.5, h, w - 40, h * 0.8); ctx.stroke();
  });
  // calendar: November with plans
  at(C.calendar, (w, h) => {
    ctx.fillStyle = '#fbfaf6'; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, 150); ctx.clip();
    ctx.fillStyle = grad(0, 150, [[0, '#9cc9e8'], [1, '#e7f1f5']]); ctx.fillRect(0, 0, w, 150);
    hills(w, 120, 25, '#7fae6e', 1.3); hills(w, 145, 18, '#4f8a55', 3);
    ctx.restore();
    ctx.fillStyle = '#333'; ctx.font = `40px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText('11월', 14, 196);
    ctx.font = `16px ${FONT}`; ctx.fillStyle = '#888'; ctx.fillText('NOVEMBER 2026', 110, 192);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    ctx.font = `13px ${FONT}`; ctx.textAlign = 'center';
    days.forEach((d, i) => { ctx.fillStyle = i === 0 ? '#d2453b' : '#555'; ctx.fillText(d, 22 + i * 35, 222); });
    for (let d = 1; d <= 30; d++) {
      const i = d - 1, col = i % 7, row = Math.floor(i / 7), x = 22 + col * 35, y = 246 + row * 24;
      ctx.fillStyle = col === 0 ? '#d2453b' : '#444'; ctx.fillText(String(d), x, y);
      if (d === 6) { ctx.strokeStyle = '#e0543a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 5, 11, 0, 7); ctx.stroke(); }
      if (d === 13) { ctx.strokeStyle = '#2f7fd0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 5, 11, 0, 7); ctx.stroke(); }
      if (d === 21) { ctx.fillStyle = 'rgba(255,200,60,0.45)'; ctx.fillRect(x - 14, y - 16, 28, 20); ctx.fillStyle = '#444'; ctx.fillText(String(d), x, y); }
    }
    ctx.font = `14px ${FONT}`; ctx.fillStyle = '#e0543a'; ctx.textAlign = 'left'; ctx.fillText('회식!', 150, 236 + 24 * 0 + 2);
    ctx.fillStyle = '#2f7fd0'; ctx.fillText('출장', 150, 262 + 24 * 0 + 6);
    ctx.fillStyle = '#c78a10'; ctx.fillText('바다 가는 날', 10, 342);
  });
  // wall clock face
  at(C.clock, (w, h) => {
    ctx.fillStyle = '#fbfaf5'; ctx.fillRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2);
    for (let i = 0; i < 60; i++) { ctx.save(); ctx.rotate(i * Math.PI / 30); ctx.fillStyle = '#333'; const big = i % 5 === 0; ctx.fillRect(-(big ? 3 : 1), -118, big ? 6 : 2, big ? 18 : 8); ctx.restore(); }
    ctx.font = `30px ${FONT}`; ctx.fillStyle = '#333'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) { const a = i * Math.PI / 6; ctx.fillText(String(i), Math.sin(a) * 82, -Math.cos(a) * 82); }
    const hand = (a, l, wd, c) => { ctx.save(); ctx.rotate(a); ctx.fillStyle = c; ctx.fillRect(-wd / 2, -l, wd, l + 14); ctx.restore(); };
    hand((7 + 10 / 60) * Math.PI / 6, 58, 8, '#222'); hand(10 * Math.PI / 30, 92, 5, '#222'); hand(40 * Math.PI / 30, 98, 2, '#d2453b');
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill();
  });
  // house number plate
  at(C.number, (w, h) => {
    ctx.fillStyle = '#2c3036'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f4efe6'; ctx.font = `76px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('17', w * 0.3, h * 0.54);
    ctx.font = `22px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText('세온로', w * 0.55, h * 0.4); ctx.fillText('햇살길 17', w * 0.55, h * 0.7);
  });
  // sticky note
  at(C.note, (w, h) => {
    ctx.fillStyle = '#ffe680'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3a3a3a'; ctx.font = `30px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('숙제!', w / 2, 52); ctx.font = `20px ${FONT}`; ctx.fillText('우유 사기', w / 2, 92);
  });
  // child's crayon drawing
  at(C.drawing, (w, h) => {
    ctx.fillStyle = '#fffdf7'; ctx.fillRect(0, 0, w, h);
    const crayon = (c, wd, pts) => { ctx.strokeStyle = c; ctx.lineWidth = wd; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); };
    ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(200, 52, 28, 0, 7); ctx.fill();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; crayon('#f2b41c', 5, [[200 + Math.cos(a) * 36, 52 + Math.sin(a) * 36], [200 + Math.cos(a) * 52, 52 + Math.sin(a) * 52]]); }
    crayon('#7bbf4b', 10, [[0, 220], [70, 212], [140, 222], [256, 214]]);
    crayon('#e0543a', 6, [[40, 150], [95, 100], [150, 150]]);
    crayon('#4a7fd0', 6, [[50, 150], [50, 215], [140, 215], [140, 150], [50, 150]]);
    crayon('#8a5a2b', 6, [[85, 215], [85, 180], [105, 180], [105, 215]]);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(195, 150, 13, 0, 7); ctx.stroke();
    crayon('#333', 4, [[195, 163], [195, 195]]); crayon('#333', 4, [[180, 175], [210, 175]]); crayon('#333', 4, [[195, 195], [183, 214]]); crayon('#333', 4, [[195, 195], [207, 214]]);
    ctx.fillStyle = '#d2453b'; ctx.font = `26px ${FONT}`; ctx.fillText('우리집', 18, 40);
  });
  // photos
  at(C.photo1, (w, h) => { // beach sunset
    ctx.fillStyle = grad(0, h, [[0, '#f7b27a'], [0.55, '#fbd9b0'], [0.56, '#3d7fa6'], [1, '#2a5f86']]); ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff1c9'; ctx.beginPath(); ctx.arc(w * 0.5, h * 0.52, 24, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8d2a6'; ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, h * 0.82); ctx.quadraticCurveTo(w * 0.5, h * 0.72, w, h * 0.86); ctx.lineTo(w, h); ctx.fill();
    ctx.fillStyle = '#2b2b33'; [[0.3, 1], [0.37, 0.8], [0.43, 0.62]].forEach(([x, s]) => { ctx.beginPath(); ctx.arc(w * x, h * 0.78 - 34 * s, 6 * s, 0, 7); ctx.fill(); ctx.fillRect(w * x - 5 * s, h * 0.78 - 28 * s, 10 * s, 28 * s); });
  });
  at(C.photo2, (w, h) => { // green forest valley
    ctx.fillStyle = grad(0, h, [[0, '#bfe0f2'], [1, '#e8f3ea']]); ctx.fillRect(0, 0, w, h);
    hills(w, h * 0.55, 30, '#8fbf7a', 0.5); hills(w, h * 0.75, 30, '#5f9a58', 2); hills(w, h * 0.95, 26, '#3e7444', 3.5);
  });
  at(C.photo3, (w, h) => { // cat portrait
    ctx.fillStyle = '#d8cfc0'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e39a52'; ctx.beginPath(); ctx.ellipse(w / 2, h * 0.62, 62, 54, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(w / 2 - 58, h * 0.48); ctx.lineTo(w / 2 - 44, h * 0.16); ctx.lineTo(w / 2 - 14, h * 0.4); ctx.fill();
    ctx.beginPath(); ctx.moveTo(w / 2 + 58, h * 0.48); ctx.lineTo(w / 2 + 44, h * 0.16); ctx.lineTo(w / 2 + 14, h * 0.4); ctx.fill();
    ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(w / 2 - 22, h * 0.58, 6, 0, 7); ctx.arc(w / 2 + 22, h * 0.58, 6, 0, 7); ctx.fill();
    ctx.fillStyle = '#f08a8a'; ctx.beginPath(); ctx.arc(w / 2, h * 0.68, 5, 0, 7); ctx.fill();
  });
  at(C.photo4, (w, h) => { // city night
    ctx.fillStyle = grad(0, h, [[0, '#1d2550'], [1, '#4a3a6a']]); ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 12; i++) { const bw = 18 + (i * 37) % 20, bh = 40 + (i * 53) % 90, x = i * 22; ctx.fillStyle = '#141a33'; ctx.fillRect(x, h - bh, bw, bh); ctx.fillStyle = '#ffd77a'; for (let k = 0; k < 6; k++) ctx.fillRect(x + 3 + (k % 2) * 8, h - bh + 6 + Math.floor(k / 2) * 12, 4, 5); }
  });
  at(C.magazine, (w, h) => {
    ctx.fillStyle = '#f5efe6'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = grad(40, h, [[0, '#9cc0a8'], [1, '#5e8a74']]); ctx.fillRect(0, 50, w, h - 50);
    ctx.fillStyle = '#efe0c8'; ctx.beginPath(); ctx.arc(w * 0.55, h * 0.65, 50, 0, 7); ctx.fill();
    ctx.fillStyle = '#c4553e'; ctx.font = `40px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('LIVING', w / 2, 42);
    ctx.fillStyle = '#fff'; ctx.font = `18px ${FONT}`; ctx.fillText('가을 집 꾸미기', w / 2, h - 18);
  });
  at(C.cereal, (w, h) => {
    ctx.fillStyle = grad(0, h, [[0, '#ffb43a'], [1, '#f07f1e']]); ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff'; ctx.font = `34px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('바삭', w / 2, 46); ctx.fillText('콘플레이크', w / 2, 84);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(w / 2, h * 0.72, 66, 30, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8b04a'; for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.ellipse(w / 2 - 50 + (i * 23) % 100, h * 0.67 + (i * 7) % 12, 12, 7, i, 0, 7); ctx.fill(); }
  });
  at(C.milk, (w, h) => {
    ctx.fillStyle = '#f7f9fb'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2f6fb7'; ctx.fillRect(0, h * 0.62, w, h * 0.38);
    ctx.fillStyle = '#2f6fb7'; ctx.font = `56px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('우유', w / 2, h * 0.36);
    ctx.font = `20px ${FONT}`; ctx.fillText('신선한 1급A', w / 2, h * 0.5);
    ctx.fillStyle = '#fff'; ctx.font = `22px ${FONT}`; ctx.fillText('900mL', w / 2, h * 0.85);
  });
  at(C.game, (w, h) => { // console game box art
    ctx.fillStyle = grad(0, h, [[0, '#3ac0e8'], [1, '#2860c8']]); ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffde59'; ctx.beginPath(); ctx.arc(w * 0.3, h * 0.55, 34, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `30px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText('젤리 점프', w * 0.48, h * 0.6);
  });
  at(C.book, (w, h) => { // generic open-book pages
    ctx.fillStyle = '#f7f2e6'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#b9b2a2';
    for (let side = 0; side < 2; side++) for (let i = 0; i < 9; i++) ctx.fillRect(20 + side * w / 2, 14 + i * 12, w / 2 - 40 - ((i * 37) % 50), 4);
  });
}
let atlasCache = null;
function atlas() {
  if (atlasCache) return atlasCache;
  const t = canvasTex(AW, AH, drawAtlas);
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.62 });
  m.name = 'homeAtlas';
  atlasCache = m;
  return m;
}
/** Map a geometry's own 0..1 UVs into an atlas cell. */
function toCell(geo, cell) {
  const [x, y, w, h] = CELLS[cell], uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (x + uv.getX(i) * w) / AW, 1 - (y + (1 - uv.getY(i)) * h) / AH);
  return geo;
}
/** Picture plane (faces +Z) showing an atlas cell. */
const cellQuad = (cell, w, h) => prep(toCell(new THREE.PlaneGeometry(w, h), cell), true);
/** Box whose front (+Z) and back faces show an atlas cell, other faces a sliver of its left edge. */
function cellBox(cell, w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) if (f < 4) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, 0.01 + uv.getX(i) * 0.04, uv.getY(i)); }
  toCell(g, cell);
  return prep(g, true);
}

function tvTexture() {
  return canvasTex(512, 288, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5fb3f0'); g.addColorStop(1, '#bfe6ff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(w * 0.22, h * 0.36, 44, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; [[0.5, 0.26, 40], [0.58, 0.24, 30], [0.66, 0.28, 34]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(w * x, h * y, r, 0, 7); ctx.fill(); });
    ctx.fillStyle = '#6cbf5a'; ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, h * 0.7); ctx.quadraticCurveTo(w * 0.4, h * 0.52, w, h * 0.72); ctx.lineTo(w, h); ctx.fill();
    ctx.fillStyle = 'rgba(20,40,80,0.82)'; ctx.fillRect(0, h * 0.78, w, h * 0.22);
    ctx.fillStyle = '#fff'; ctx.font = `30px ${FONT}`; ctx.fillText('오늘의 날씨  맑음 18°', 22, h * 0.92);
    ctx.fillStyle = '#e2574c'; ctx.fillRect(w - 92, 14, 78, 30); ctx.fillStyle = '#fff'; ctx.font = `20px ${FONT}`; ctx.fillText('LIVE', w - 76, 36);
  });
}

// ------------------------------------------------------------------ materials
function materials(glowK) {
  const M = {
    plaster: mat('plaster'), sage: mat('plasterSage'), stone: mat('stone'), bathTile: mat('bathTile'),
    entryTile: textured('tiles', { color: 0xd3cec5, grout: 0x8e8a82, count: 3, rough: 0.3 }, 1.2, { normal: 0.5 }),
    oakFloor: textured('planks', { color: 0xb68558 }, 1.5, { normal: 0.6 }),
    brickS: textured('brick', {}, 0.75, { normal: 1.2 }), pavers: mat('pavers2'),
    wallTile: mat('wallTile'), floorTile: mat('floorTile'), marble: mat('marble'), oak: mat('oak'), walnut: mat('walnut'),
    white: mat('whiteWood'), linen: mat('linen'), fabGray: mat('fabricGray'), fabBeige: mat('fabricBeige'), fabGreen: mat('fabricGreen'),
    ceramic: mat('ceramic'), chrome: mat('chrome'), steel: mat('steel'), black: mat('blackPlastic'), whitePl: mat('whitePlastic'),
    rubber: mat('rubber'), mirror: mat('mirror'), leaves: mat('leaves'), dirt: mat('dirt'), brick: mat('brick'), lamp: mat('lampGlow'),
    rug: mat('carpetWarm'), rug2: mat('carpet'), glass: mat('glass'), gold: mat('gold'),
    roof: textured('shingles', { color: 0x4f565f, seed: 4 }, 2, { normal: 1.2 }),
    mustard: textured('fabric', { color: 0xd4a043, seed: 12 }, 0.5, { normal: 0.7, physical: true, sheen: 0.6 }),
    towel: textured('stripes', { color: 0x86aec4, color2: 0xf4f2ec, count: 5, ratio: 0.3 }, 0.6, { normal: 0.6 }),
    charcoal: paint(0x34383e, 0.45, 0.35),
    ridge: paint(0x454b53, 0.7, 0.1),
    doorPaint: paint(0x34503f, 0.42, 0, { clearcoat: 0.4 }),
    atlas: atlas(),
  };
  const vc = paint(0xffffff, 0.55).clone(); vc.vertexColors = true; vc.name = 'homeVC'; M.vc = vc;
  const vcg = paint(0xffffff, 0.22).clone(); vcg.vertexColors = true; vcg.name = 'homeVCgloss'; M.vcg = vcg;
  const mirrorTex = canvasTex(256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#c9d6dc'); g.addColorStop(0.45, '#e8eff2'); g.addColorStop(0.5, '#f6fafb'); g.addColorStop(0.56, '#dfe8ec'); g.addColorStop(1, '#aebdc4');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(w * 0.62, 0); ctx.lineTo(w * 0.72, 0); ctx.lineTo(w * 0.32, h); ctx.lineTo(w * 0.22, h); ctx.fill();
  });
  const mirror = new THREE.MeshStandardMaterial({ map: mirrorTex, metalness: 0.35, roughness: 0.08, envMapIntensity: 1.2 });
  mirror.name = 'homeMirror'; M.mirror = mirror;
  const frosted = mat('glass').clone(); frosted.opacity = 0.72; frosted.roughness = 0.55; frosted.color.set(0xeef4f5); frosted.name = 'homeFrosted'; M.frosted = frosted;
  // night glow: dark tint pane that darkens windows by day and glows warm at night (outside only)
  const win = new THREE.MeshStandardMaterial({ color: 0x0c0e12, emissive: 0xffbf73, emissiveIntensity: 2.4 * glowK, transparent: true, opacity: 0.42, depthWrite: false, roughness: 0.3 });
  win.name = 'homeWindowGlow'; win.userData.glowMax = 2.4; M.winGlow = win;
  const porch = glow(0xffd29a, 3.2 * glowK + 0.15); porch.name = 'homePorchGlow'; porch.userData.glowMax = 3.2; M.porchGlow = porch;
  const poolTex = canvasTex(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(150,150,150,1)'); g.addColorStop(0.7, 'rgba(40,40,40,1)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
  const pool = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffc488, emissiveMap: poolTex, emissiveIntensity: 0.55 * glowK, roughness: 1, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, envMapIntensity: 0 });
  pool.name = 'homeLightPool'; pool.userData.glowMax = 0.55; M.pool = pool;
  const tv = new THREE.MeshStandardMaterial({ color: 0x0b0c0f, roughness: 0.16, metalness: 0.4, emissive: 0xffffff, emissiveMap: tvTexture(), emissiveIntensity: 0 });
  tv.name = 'homeTVScreen'; tv.userData.onIntensity = 1.3; M.tv = tv;
  return M;
}

// ------------------------------------------------------------------ windows and doors
/**
 * Window in an exterior wall. (cx, cz) = centre of the opening on the wall's outer face line, ry turns
 * local +Z (outwards) to the wall normal. Local x runs along the wall, y is world height.
 */
function windowUnit(root, M, cx, cz, ry, w, y0, y1, panes, { frosted = false, box = null } = {}) {
  const g = group(root, cx, 0, cz, ry);
  const T = 0.22, h = y1 - y0, ym = (y0 + y1) / 2, L = 0.02;
  // reveal lining
  slab(g, M.white, -w / 2, y0, -T, -w / 2 + L, y1, 0.0);
  slab(g, M.white, w / 2 - L, y0, -T, w / 2, y1, 0.0);
  slab(g, M.white, -w / 2, y1 - L, -T, w / 2, y1, 0.0);
  // frame (charcoal aluminium) at the middle of the wall
  const fz = -0.09, fw = 0.06, fd = 0.07;
  rb(g, M.charcoal, w - 2 * L, fw, fd, 0, y1 - L - fw / 2, fz, 0.008, 1);
  rb(g, M.charcoal, w - 2 * L, fw, fd, 0, y0 + fw / 2, fz, 0.008, 1);
  rb(g, M.charcoal, fw, h - L, fd, -w / 2 + L + fw / 2, ym - L / 2, fz, 0.008, 1);
  rb(g, M.charcoal, fw, h - L, fd, w / 2 - L - fw / 2, ym - L / 2, fz, 0.008, 1);
  const inner = w - 2 * L - 2 * fw;
  for (let i = 1; i < panes; i++) rb(g, M.charcoal, 0.05, h - L - 2 * fw, fd * 0.9, -inner / 2 + (inner * i) / panes, ym - L / 2, fz, 0.006, 1);
  if (panes >= 3 || h > 1.6) { // transom bar
    rb(g, M.charcoal, inner, 0.045, fd * 0.9, 0, y1 - L - fw - 0.36, fz, 0.006, 1);
  }
  const gl = slab(g, frosted ? M.frosted : M.glass, -w / 2 + L + fw * 0.5, y0 + fw * 0.5, fz - 0.005, w / 2 - L - fw * 0.5, y1 - L - fw * 0.5, fz + 0.005);
  noShadow(gl);
  // night pane just outside the glass (front side faces out)
  const q = put(g, prep(new THREE.PlaneGeometry(w - 2 * L - 0.02, h - L - 0.02)), M.winGlow, 0, ym - L / 2, fz + 0.04);
  noShadow(q);
  // exterior sill and interior stool
  rb(g, M.white, w + 0.14, 0.05, 0.16, 0, y0 - 0.025, 0.05, 0.01, 2);
  rb(g, M.white, w + 0.1, 0.03, 0.09, 0, y0 - 0.015, -T - 0.03, 0.008, 2);
  // interior casing (sides + head)
  const ci = -T - 0.008;
  rb(g, M.white, 0.06, h + 0.06, 0.016, -w / 2 - 0.03, ym + 0.03, ci, 0.004, 1);
  rb(g, M.white, 0.06, h + 0.06, 0.016, w / 2 + 0.03, ym + 0.03, ci, 0.004, 1);
  rb(g, M.white, w + 0.12, 0.06, 0.016, 0, y1 + 0.03, ci, 0.004, 1);
  if (box) box(g, w);
  return g;
}

/** Curtains (two gathered panels + rod) in front of a window, in the window's local frame. */
function curtains(g, M, w, top, bottom, m, T = 0.22) {
  const z = -T - 0.12;
  rod(g, M.charcoal, [-w / 2 - 0.25, top + 0.12, z], [w / 2 + 0.25, top + 0.12, z], 0.012);
  for (const s of [-1, 1]) {
    for (const e of [w / 2 + 0.26]) put(g, sphere(0.022, 10, 8), M.charcoal, s * e, top + 0.12, z);
    const pw = 0.42, h = top + 0.08 - bottom;
    const geo = new THREE.PlaneGeometry(pw, h, 24, 6);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      const gather = 1 - 0.25 * ((y + h / 2) / h); // a bit narrower near the floor
      p.setX(i, x * gather);
      p.setZ(i, Math.sin((x / pw) * Math.PI * 7) * 0.035);
    }
    geo.computeVertexNormals();
    // two sides so it reads from both directions
    const a = prep(geo);
    const b = a.clone(); b.translate(0, 0, -0.004);
    const idx = b.attributes.position;
    for (let i = 0; i < idx.count; i += 3) { // flip winding
      const tx = idx.getX(i + 1), ty = idx.getY(i + 1), tz = idx.getZ(i + 1);
      idx.setXYZ(i + 1, idx.getX(i + 2), idx.getY(i + 2), idx.getZ(i + 2)); idx.setXYZ(i + 2, tx, ty, tz);
    }
    b.computeVertexNormals();
    put(g, a, m, s * (w / 2 + 0.06), bottom + h / 2, z + 0.03);
    put(g, b, m, s * (w / 2 + 0.06), bottom + h / 2, z + 0.03);
  }
}

// ------------------------------------------------------------------ plants
let leafCache = null;
function leafGeo(len, wid, droop) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(wid * 0.62, len * 0.12, wid * 0.58, len * 0.72, 0, len);
  s.bezierCurveTo(-wid * 0.58, len * 0.72, -wid * 0.62, len * 0.12, 0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.002, bevelEnabled: false, curveSegments: 5 });
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, p.getZ(i) - droop * (y / len) ** 2 * len + 0.35 * wid * (x / wid) ** 2);
  }
  g.computeVertexNormals();
  return prep(g);
}
function leaves() {
  if (!leafCache) leafCache = { big: leafGeo(0.32, 0.17, 0.35), mid: leafGeo(0.16, 0.08, 0.3), small: leafGeo(0.07, 0.04, 0.2), blade: leafGeo(0.45, 0.04, 0.5) };
  return leafCache;
}
/** Potted plant. kind: 'fig' (tall), 'bush' (round), 'trail' (shelf), 'snake' (upright blades). */
function plant(parent, M, x, y, z, kind = 'bush', s = 1, potColor = 0xe9e4da, seed = 1, noPot = false) {
  const g = group(parent, x, y, z, seed * 1.7);
  const L = leaves();
  const potH = kind === 'fig' ? 0.42 : kind === 'trail' ? 0.12 : 0.22;
  const potR = kind === 'fig' ? 0.2 : kind === 'trail' ? 0.075 : 0.12;
  const pg = lathe([[0.0, 0], [potR * 0.78, 0], [potR * 0.85, 0.01], [potR, potH * 0.9], [potR * 1.04, potH], [potR * 0.92, potH], [potR * 0.88, potH * 0.9], [0, potH * 0.9]], 24);
  if (!noPot) {
    put(g, vcol(pg, potColor), M.vcg, 0, 0, 0).scale.setScalar(s);
    put(g, cyl(potR * 0.86 * s, potR * 0.86 * s, 0.01, 18), M.dirt, 0, potH * 0.88 * s, 0);
  }
  const R = (k) => { const v = Math.sin(seed * 91.7 + k * 12.9898) * 43758.5453; return v - Math.floor(v); };
  const lv = [];
  // leaf geometry: scale, tilt (rx, rz), turn about the stem (az), then move to (px, py, pz)
  const leaf = (geo, px, py, pz, az, rx, rz, sx, sy = sx, sz = sx) => lv.push(xf(xf(geo.clone(), 0, 0, 0, rx, 0, rz, sx, sy, sz), px, py, pz, 0, az, 0));
  if (kind === 'fig') {
    put(g, vcol(rodGeo([0, potH * s, 0], [0.02, 1.3 * s, 0.01], 0.018 * s, 8), 0x6b5236), M.vc);
    for (let i = 0; i < 26; i++) {
      const t = i / 26, h = (0.55 + t * 0.85) * s, az = i * 2.4 + R(i), tilt = 0.5 + R(i + 9) * 0.7;
      leaf(L.big, Math.cos(az) * 0.04 * s, h, Math.sin(az) * 0.04 * s, az, -tilt, (R(i + 3) - 0.5) * 0.6, s * (0.75 + R(i + 5) * 0.45));
    }
  } else if (kind === 'snake') {
    for (let i = 0; i < 11; i++) {
      const az = i * 2.4, tilt = 0.08 + R(i) * 0.25;
      leaf(L.blade, Math.cos(az) * 0.05 * s, potH * 0.85 * s, Math.sin(az) * 0.05 * s, az, -tilt, 0, s * 1.4, s * (0.8 + R(i + 4) * 0.6), s);
    }
  } else if (kind === 'trail') {
    for (let i = 0; i < 12; i++) {
      const az = i * 2.4, tilt = 0.9 + R(i) * 1.1;
      leaf(L.mid, Math.cos(az) * 0.05 * s, potH * s + 0.01, Math.sin(az) * 0.05 * s, az, -tilt, 0, s * (0.7 + R(i + 2) * 0.5));
    }
    for (let k = 0; k < 2; k++) { // trailing vines
      const az = k * 2.5 + 0.6;
      for (let j = 0; j < 5; j++) leaf(L.small, Math.cos(az) * (0.09 + j * 0.012) * s, (potH - 0.03 - j * 0.045) * s, Math.sin(az) * (0.09 + j * 0.012) * s, az + j, -1.9, 0, s * 1.3);
    }
  } else {
    for (let i = 0; i < 22; i++) {
      const t = i / 22, az = i * 2.4 + R(i), tilt = 0.3 + t * 1.0;
      leaf(L.mid, Math.cos(az) * 0.03 * s, (potH + 0.02 + (1 - t) * 0.12) * s, Math.sin(az) * 0.03 * s, az, -tilt, 0, s * (1.1 + R(i + 1) * 0.6));
    }
  }
  merged(g, M.leaves, lv);
  return g;
}
/** A cluster of small flowers + leaves on a soil bed (flower boxes). */
function flowerBed(parent, M, x0, x1, y, z, seed = 3) {
  const L = leaves();
  const cols = [0xe8546b, 0xf7c548, 0xf4f1ea, 0xc86bd6, 0xff8c5a];
  let k = seed;
  const R = () => { k = (k * 16807) % 2147483647; return k / 2147483647; };
  const lv = [], fl = [];
  for (let x = x0; x < x1; x += 0.05) {
    for (let k2 = 0; k2 < 1 + (R() < 0.4 ? 1 : 0); k2++) {
      const px = x + R() * 0.03, pz = z + (R() - 0.5) * 0.14, ry = R() * 6, rx = -0.5 - R() * 0.7, sc = 0.8 + R() * 0.4;
      lv.push(xf(xf(L.mid.clone(), 0, 0, 0, rx, 0, 0, sc), px, y, pz, 0, ry, 0));
    }
    if (R() < 0.8) {
      const fy = y + 0.08 + R() * 0.1, fx = x + (R() - 0.5) * 0.05, fz = z + (R() - 0.5) * 0.12;
      fl.push(vcol(rodGeo([fx, y, fz], [fx, fy, fz], 0.004, 5), 0x4f7a3a));
      const c = cols[Math.floor(R() * cols.length)];
      for (let pi = 0; pi < 4; pi++) {
        const a = pi * 1.5708 + R();
        fl.push(xf(vcol(sphere(0.024, 6, 3), c), fx + Math.cos(a) * 0.022, fy, fz + Math.sin(a) * 0.022, 0, 0, 0, 1, 0.45, 1));
      }
      fl.push(xf(vcol(sphere(0.012, 5, 3), 0xf3c03a), fx, fy + 0.008, fz));
    }
  }
  merged(parent, M.leaves, lv);
  merged(parent, M.vc, fl);
}

/** Clipped boxwood ball. */
function topiary(r, seed = 1) {
  return displace(new THREE.IcosahedronGeometry(r, 4), (x, y, z) => {
    const n = Math.sin(x * 41 + seed) * Math.sin(y * 37 + seed * 2) * Math.sin(z * 43 + seed * 3);
    return 0.018 * n + 0.012 * Math.sin(x * 90 + y * 70 + z * 80);
  });
}

// ------------------------------------------------------------------ small props
/** Geometries of one book (vertex coloured), placed like book(). */
function bookGeos(out, x, y, z, w, h, d, color, ry = 0, rz = 0) {
  out.push(xf(vcol(prep(new THREE.BoxGeometry(w, h, d)).translate(0, h / 2, 0), color), x, y, z, 0, ry, rz));
  out.push(xf(vcol(prep(new THREE.BoxGeometry(w * 0.9, h * 0.1, 0.002)).translate(0, h * 0.74, d / 2 + 0.001), 0xf2e9d0), x, y, z, 0, ry, rz));
  out.push(xf(vcol(prep(new THREE.BoxGeometry(w * 0.9, h * 0.04, 0.002)).translate(0, h * 0.2, d / 2 + 0.001), 0xf2e9d0), x, y, z, 0, ry, rz));
}
function book(parent, M, x, y, z, w, h, d, color, ry = 0, rz = 0) {
  const g = group(parent, x, y, z, ry);
  g.rotation.z = rz;
  put(g, vcol(prep(new THREE.BoxGeometry(w, h, d)), color), M.vc, 0, h / 2, 0);
  put(g, vcol(prep(new THREE.BoxGeometry(w * 0.9, h * 0.1, 0.002)), 0xf2e9d0), M.vc, 0, h * 0.74, d / 2 + 0.001);
  put(g, vcol(prep(new THREE.BoxGeometry(w * 0.9, h * 0.04, 0.002)), 0xf2e9d0), M.vc, 0, h * 0.2, d / 2 + 0.001);
  return g;
}
/** Row of books along local +X starting at x, standing on y; facing +Z (spines). */
function bookRow(parent, M, x, y, z, len, seed = 1, depth = 0.17) {
  const cols = [0x2f4858, 0xc4553e, 0xe7b851, 0x86a08a, 0x8a5a7a, 0x3d6aa8, 0xd9825b, 0xefe6d6, 0x55606e, 0x9b3b3b];
  let cx = x, i = 0;
  const out = [];
  while (cx < x + len - 0.03) {
    const w = 0.022 + ((seed * 7 + i * 13) % 5) * 0.008, h = 0.19 + ((seed * 3 + i * 11) % 6) * 0.018;
    bookGeos(out, cx + w / 2, y, z, w, h, depth, cols[(seed + i * 3) % cols.length]);
    cx += w + 0.002; i++;
    if (i % 9 === 8 && cx < x + len - 0.25) { // a leaning one
      bookGeos(out, cx + 0.07, y, z, 0.03, 0.21, depth, cols[(i + 2) % cols.length], 0, -0.32); cx += 0.12;
    }
  }
  merged(parent, M.vc, out);
}
function mug(parent, M, x, y, z, color, ry = 0) {
  const g = group(parent, x, y, z, ry);
  put(g, vcol(lathe([[0, 0], [0.038, 0], [0.04, 0.005], [0.041, 0.09], [0.036, 0.09], [0.034, 0.012], [0, 0.012]], 20), color), M.vcg, 0, 0, 0);
  put(g, vcol(torus(0.022, 0.006, 8, 16), color), M.vcg, 0.045, 0.048, 0, 0, 0, 0).rotation.set(0, 0, Math.PI / 2 * 0);
  put(g, vcol(cyl(0.034, 0.034, 0.004, 16), 0x5a3a24), M.vcg, 0, 0.07, 0);
  return g;
}
function picture(parent, M, cell, x, y, z, w, h, ry = 0, frame = 0x2b2b2b, matBorder = 0.04) {
  const g = group(parent, x, y, z, ry);
  put(g, vcol(rbox(w, h, 0.025, 0.006, 1), frame), M.vc, 0, 0, 0.0125);
  put(g, vcol(rbox(w - 0.03, h - 0.03, 0.004, 0.002, 1), 0xf6f3ec), M.vc, 0, 0, 0.026);
  put(g, cellQuad(cell, w - 0.03 - matBorder * 2, h - 0.03 - matBorder * 2), M.atlas, 0, 0, 0.0285);
  return g;
}
function shoe(parent, M, x, y, z, ry, color, sole = 0xf2f0ea, s = 1) {
  const g = group(parent, x, y, z, ry);
  const body = displace(new THREE.SphereGeometry(1, 16, 10), (px, py) => (py < -0.2 ? -0.05 : 0));
  body.scale(0.045 * s, 0.035 * s, 0.13 * s);
  put(g, vcol(body, color), M.vc, 0, 0.04 * s, 0);
  put(g, vcol(rbox(0.092 * s, 0.022 * s, 0.27 * s, 0.01, 1), sole), M.vc, 0, 0.011 * s, 0);
  put(g, vcol(cyl(0.032 * s, 0.035 * s, 0.03 * s, 12), 0x2a2a2a), M.vc, 0, 0.06 * s, -0.06 * s).scale.set(1, 1, 1.3);
  return g;
}
function slipper(parent, M, x, y, z, ry, color) {
  const g = group(parent, x, y, z, ry);
  put(g, vcol(rbox(0.1, 0.025, 0.26, 0.012, 2), color), M.vc, 0, 0.0125, 0);
  const strap = displace(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), () => 0);
  strap.scale(0.05, 0.04, 0.07);
  put(g, vcol(strap, color), M.vc, 0, 0.024, 0.05);
  return g;
}
function cushion(parent, M, m, x, y, z, w, h, ry, rx = 0, seed = 1) {
  const g = softBox(w, 0.13, h, 0.05, 0.035, 0.004, seed);
  return put(parent, g, m, x, y, z, rx + Math.PI / 2, ry, 0);
}

// ------------------------------------------------------------------ the shell: walls, floors, roof
function buildShell(site, root, M) {
  const S = site;
  const Y_TOP = RY - 0.13; // just under the roof slab at the wall line
  // --- foundation slab and floor finishes
  slab(root, M.stone, -WX + 0.06, 0, WZ0 + 0.06, WX - 0.06, FL - 0.02, WZ1 - 0.06);
  box3(S, -WX, 0, WZ0, WX, FL, WZ1);
  slab(root, M.oakFloor, -IX - 0.12, FL - 0.02, IZ0 - 0.12, IX + 0.12, FL, BZ);                  // back half (kitchen + bedroom)
  slab(root, M.oakFloor, -IX - 0.12, FL - 0.02, BZ, AX + 0.06, FL, 1.85);                       // living front
  slab(root, M.oakFloor, -IX - 0.12, FL - 0.02, 1.85, -0.2, FL, IZ1 + 0.12);
  slab(root, M.entryTile, -0.2, FL - 0.02, 1.85, AX - 0.06, FL - 0.002, IZ1 + 0.12);           // entry
  rb(root, M.oak, AX - 0.06 + 0.2, 0.014, 0.05, (-0.2 + AX - 0.06) / 2, FL - 0.002, 1.85, 0.004, 1); // nosing
  slab(root, M.bathTile, AX + 0.06, FL - 0.02, BZ, IX + 0.12, FL + 0.0, IZ1 + 0.12);            // bathroom
  slab(root, M.marble, AX - 0.06, FL - 0.02, BATH_DOOR.z0, AX + 0.06, FL + 0.012, BATH_DOOR.z1); // threshold
  // --- ceiling
  slab(root, M.plaster, -WX + SKIN, CL, WZ0 + SKIN, WX - SKIN, CL + 0.06, WZ1 - SKIN);

  // --- exterior walls: outer plaster skin with stone base, inner skins per room
  const front = [
    { a: -5.0, b: -1.9, lo: FL + 0.5, hi: FL + 2.25 },
    { a: DOOR.x0, b: DOOR.x1, lo: FL, hi: FL + DOOR.h },
    { a: 3.9, b: 5.3, lo: FL + 1.3, hi: FL + 2.2 },
  ];
  const back = [{ a: -3.1, b: -1.7, lo: FL + 1.1, hi: FL + 2.2 }];
  const west = [{ a: -3.3, b: -1.9, lo: FL + 0.5, hi: FL + 2.25 }];
  const east = [{ a: -3.4, b: -1.8, lo: FL + 0.85, hi: FL + 2.25 }, { a: 1.4, b: 2.2, lo: FL + 1.45, hi: FL + 2.15 }];
  const SB = 0.62; // stone base height
  // outer skin
  wallRun(root, M.plaster, 'x', -WX, -0.7, WZ1 - SKIN, WZ1, SB, Y_TOP, front);
  wallRun(root, M.plaster, 'x', -0.7, 2.7, WZ1 - SKIN, WZ1, FL - 0.03, Y_TOP, front);
  wallRun(root, M.plaster, 'x', 2.7, WX, WZ1 - SKIN, WZ1, SB, Y_TOP, front);
  wallRun(root, M.plaster, 'x', -WX, WX, WZ0, WZ0 + SKIN, SB, Y_TOP, back);
  wallRun(root, M.plaster, 'z', WZ0 + SKIN, WZ1 - SKIN, -WX, -WX + SKIN, SB, Y_TOP, west);
  wallRun(root, M.plaster, 'z', WZ0 + SKIN, WZ1 - SKIN, WX - SKIN, WX, SB, Y_TOP, east);
  // stone base (proud by 4 cm) with a cap
  const P = 0.04;
  wallRun(root, M.brickS, 'x', -WX - P, -0.7, WZ1 - SKIN, WZ1 + P, 0, SB, []);
  wallRun(root, M.brickS, 'x', 2.7, WX + P, WZ1 - SKIN, WZ1 + P, 0, SB, []);
  wallRun(root, M.brickS, 'x', -WX - P, WX + P, WZ0 - P, WZ0 + SKIN, 0, SB, []);
  wallRun(root, M.brickS, 'z', WZ0 + SKIN, WZ1 - SKIN, -WX - P, -WX + SKIN, 0, SB, []);
  wallRun(root, M.brickS, 'z', WZ0 + SKIN, WZ1 - SKIN, WX - SKIN, WX + P, 0, SB, []);
  const capC = 0xcfcac0;
  for (const [x0, x1] of [[-WX - P - 0.02, DOOR.x0 - 1.2], [DOOR.x1 + 1.2, WX + P + 0.02]]) {
    vrb(root, M.vc, capC, x1 - x0, 0.04, P + 0.06, (x0 + x1) / 2, SB + 0.02, WZ1 + (P + 0.06) / 2 - 0.04, 0.008, 1);
  }
  vrb(root, M.vc, capC, 2 * (WX + P + 0.02), 0.04, P + 0.06, 0, SB + 0.02, WZ0 - (P + 0.06) / 2 + 0.04, 0.008, 1);
  for (const s of [-1, 1]) vrb(root, M.vc, capC, P + 0.06, 0.04, WZ1 - WZ0 + 2 * P, s * (WX + (P + 0.06) / 2 - 0.04), SB + 0.02, (WZ0 + WZ1) / 2, 0.008, 1);
  // inner skins (per room materials)
  const iy0 = FL, iy1 = CL;
  const it = WZ1 - SKIN; // front inner skin z range [IZ1, it]
  wallRun(root, M.plaster, 'x', -WX + SKIN, AX, IZ1, it, iy0, iy1, front);
  wallRun(root, M.wallTile, 'x', AX, WX - SKIN, IZ1, it, iy0, iy1, front);
  wallRun(root, M.plaster, 'x', -WX + SKIN, AX, WZ0 + SKIN, IZ0, iy0, iy1, back);
  wallRun(root, M.sage, 'x', AX, WX - SKIN, WZ0 + SKIN, IZ0, iy0, iy1, back);
  wallRun(root, M.plaster, 'z', IZ0, IZ1, -WX + SKIN, -IX, iy0, iy1, west);
  wallRun(root, M.sage, 'z', IZ0, BZ, IX, WX - SKIN, iy0, iy1, east);
  wallRun(root, M.wallTile, 'z', BZ, IZ1, IX, WX - SKIN, iy0, iy1, east);
  // colliders (windows treated as solid)
  wallCollide(S, 'x', -WX, WX, IZ1, WZ1, 0, Y_TOP, [{ a: DOOR.x0, b: DOOR.x1, lo: FL, hi: FL + DOOR.h }]);
  wallCollide(S, 'x', -WX, WX, WZ0, IZ0, 0, Y_TOP);
  wallCollide(S, 'z', IZ0, IZ1, -WX, -IX, 0, Y_TOP);
  wallCollide(S, 'z', IZ0, IZ1, IX, WX, 0, Y_TOP);

  // --- partitions
  const dA = [{ a: BED_DOOR.z0, b: BED_DOOR.z1, lo: FL, hi: FL + 2.1 }, { a: BATH_DOOR.z0, b: BATH_DOOR.z1, lo: FL, hi: FL + 2.1 }];
  wallRun(root, M.plaster, 'z', IZ0, IZ1, AX - 0.06, AX, FL, CL, dA);
  wallRun(root, M.sage, 'z', IZ0, BZ, AX, AX + 0.06, FL, CL, dA);
  wallRun(root, M.wallTile, 'z', BZ, IZ1, AX, AX + 0.06, FL, CL, dA);
  slab(root, M.sage, AX + 0.06, FL, BZ - 0.06, IX, CL, BZ);
  slab(root, M.wallTile, AX + 0.06, FL, BZ, IX, CL, BZ + 0.06);
  wallCollide(S, 'z', IZ0, IZ1, AX - 0.06, AX + 0.06, FL, CL, dA);
  box3(S, AX + 0.06, FL, BZ - 0.06, IX, CL, BZ + 0.06);
  // doorway linings and casings
  for (const d of [BED_DOOR, BATH_DOOR]) {
    const h = FL + 2.1;
    slab(root, M.white, AX - 0.075, FL, d.z0, AX + 0.075, h, d.z0 + 0.02);
    slab(root, M.white, AX - 0.075, FL, d.z1 - 0.02, AX + 0.075, h, d.z1);
    slab(root, M.white, AX - 0.075, h - 0.02, d.z0, AX + 0.075, h, d.z1);
    for (const s of [-1, 1]) {
      const x = AX + s * 0.068;
      rb(root, M.white, 0.016, 2.1 + 0.07, 0.07, x, FL + (2.1 + 0.07) / 2, d.z0 - 0.035, 0.004, 1);
      rb(root, M.white, 0.016, 2.1 + 0.07, 0.07, x, FL + (2.1 + 0.07) / 2, d.z1 + 0.035, 0.004, 1);
      rb(root, M.white, 0.016, 0.07, d.z1 - d.z0 + 0.14, x, h + 0.035, (d.z0 + d.z1) / 2, 0.004, 1);
    }
  }
  // baseboards
  const bb = (x0, z0, x1, z1) => slab(root, M.white, x0, FL, z0, x1, FL + 0.08, z1);
  const t = 0.012;
  bb(-IX, IZ1 - t, DOOR.x0, IZ1); bb(DOOR.x1, IZ1 - t, AX - 0.06, IZ1);
  bb(-IX, -4.5, -IX + t, IZ1 - t);
  bb(-0.4, IZ0, AX - 0.06, IZ0 + t);
  for (const [z0, z1] of [[IZ0, BED_DOOR.z0 - 0.07], [BED_DOOR.z1 + 0.07, BATH_DOOR.z0 - 0.07], [BATH_DOOR.z1 + 0.07, IZ1 - t]]) bb(AX - 0.06 - t, z0, AX - 0.06, z1);
  for (const [z0, z1] of [[IZ0 + t, BED_DOOR.z0 - 0.07], [BED_DOOR.z1 + 0.07, BZ - 0.06]]) bb(AX + 0.06, z0, AX + 0.06 + t, z1);
  bb(AX + 0.06, BZ - 0.06 - t, IX, BZ - 0.06);
  bb(IX - t, IZ0 + t, IX, BZ - 0.06 - t);
  bb(AX + 0.06, IZ0, IX, IZ0 + t);
  // crown molding (living/kitchen and bedroom)
  const crown = (x0, z0, x1, z1) => {
    const w = x1 - x0, d = z1 - z0, c = 0.045;
    rb(root, M.white, w, 0.06, c, (x0 + x1) / 2, CL - 0.03, z0 + c / 2, 0.01, 1);
    rb(root, M.white, w, 0.06, c, (x0 + x1) / 2, CL - 0.03, z1 - c / 2, 0.01, 1);
    rb(root, M.white, c, 0.06, d - 2 * c, x0 + c / 2, CL - 0.03, (z0 + z1) / 2, 0.01, 1);
    rb(root, M.white, c, 0.06, d - 2 * c, x1 - c / 2, CL - 0.03, (z0 + z1) / 2, 0.01, 1);
  };
  crown(-IX, IZ0, AX - 0.06, IZ1);
  crown(AX + 0.06, IZ0, IX, BZ - 0.06);
  // recessed downlights
  for (const [x, z] of [[-5.2, -0.3], [-5.2, 2.3], [-1.9, -0.3], [-1.9, 2.3], [-4.9, -4.55], [-3.6, -4.55], [-2.4, -4.55], [-1.2, -4.55], [3.2, 2.4], [5.6, -4.6]]) {
    put(root, torus(0.05, 0.008, 6, 20), M.whitePl, x, CL - 0.004, z, Math.PI / 2, 0, 0);
    noShadow(put(root, cyl(0.045, 0.045, 0.006, 18), M.lamp, x, CL - 0.003, z));
  }
  // --- windows
  const living = windowUnit(root, M, -3.45, WZ1, 0, 3.1, FL + 0.5, FL + 2.25, 3, { box: (g, w) => flowerBox(g, M, w, FL + 0.5) });
  windowUnit(root, M, 4.6, WZ1, 0, 1.4, FL + 1.3, FL + 2.2, 2, { frosted: true });
  windowUnit(root, M, -2.4, WZ0, Math.PI, 1.4, FL + 1.1, FL + 2.2, 2);
  const dining = windowUnit(root, M, -WX, -2.6, -Math.PI / 2, 1.4, FL + 0.5, FL + 2.25, 2, { box: (g, w) => flowerBox(g, M, w, FL + 0.5) });
  const bedWin = windowUnit(root, M, WX, -2.6, Math.PI / 2, 1.6, FL + 0.85, FL + 2.25, 2, { box: (g, w) => flowerBox(g, M, w, FL + 0.85) });
  windowUnit(root, M, WX, 1.8, Math.PI / 2, 0.8, FL + 1.45, FL + 2.15, 1, { frosted: true });
  curtains(living, M, 3.1, FL + 2.25, FL + 0.03, M.fabBeige);
  curtains(bedWin, M, 1.6, FL + 2.25, FL + 0.8, M.linen);
  curtains(dining, M, 1.4, FL + 2.25, FL + 0.03, M.linen);

  buildRoof(site, root, M);
  buildPorch(site, root, M);
}

function flowerBox(g, M, w, sill) {
  const bw = w - 0.2, y = sill - 0.06;
  rb(g, M.walnut, bw, 0.2, 0.22, 0, y - 0.1, 0.17, 0.015, 2);
  slab(g, M.dirt, -bw / 2 + 0.02, y - 0.02, 0.07, bw / 2 - 0.02, y - 0.005, 0.27);
  for (const s of [-0.35, 0.35]) rb(g, M.charcoal, 0.03, 0.12, 0.2, s * bw, y - 0.24, 0.1, 0.005, 1);
  flowerBed(g, M, -bw / 2 + 0.05, bw / 2 - 0.05, y - 0.01, 0.17, 11);
}

/** Hip roof with shingles, ridge caps, fascia, soffit, gutters, downpipes and a chimney. */
function buildRoof(site, root, M) {
  const OV = 0.4;                                  // roof edge overhang
  const ex = WX + OV, ez0 = WZ0 - OV, ez1 = WZ1 + OV;
  const ye = RY - OV * SLOPE;                      // 3.3
  const hd = (ez1 - ez0) / 2, rz = RIDGE_Z, rx = ex - hd, yr = ye + hd * SLOPE;
  const TH = 0.12;
  // faces: [eave a, eave b, ridge b, ridge a] (counter-clockwise from above-outside)
  const faces = [
    [[-ex, ye, ez1], [ex, ye, ez1], [rx, yr, rz], [-rx, yr, rz]],     // front
    [[ex, ye, ez0], [-ex, ye, ez0], [-rx, yr, rz], [rx, yr, rz]],     // back
    [[ex, ye, ez1], [ex, ye, ez0], [rx, yr, rz], [rx, yr, rz]],       // east (triangle)
    [[-ex, ye, ez0], [-ex, ye, ez1], [-rx, yr, rz], [-rx, yr, rz]],   // west
  ];
  const pos = [], uv = [], under = [];
  const V = (p) => new THREE.Vector3(...p);
  for (const f of faces) {
    const a = V(f[0]), b = V(f[1]);
    const ax = b.clone().sub(a).normalize();      // along the eave
    const tri = (p, q, r) => {
      for (const v of [p, q, r]) {
        pos.push(v.x, v.y, v.z);
        const rel = v.clone().sub(a);
        const along = rel.dot(ax);
        const horiz = Math.hypot(rel.x - ax.x * along, rel.z - ax.z * along);
        const sl = Math.hypot(horiz, rel.y);
        uv.push(along, -sl);
      }
      for (const v of [p, r, q]) under.push(v.x, v.y - TH, v.z);
    };
    const c = V(f[2]), d = V(f[3]);
    tri(a, b, c);
    if (f[2][0] !== f[3][0] || f[2][2] !== f[3][2]) tri(a, c, d);
  }
  const top = new THREE.BufferGeometry();
  top.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  top.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  top.computeVertexNormals();
  put(root, prep(top, true), M.roof);
  const bot = new THREE.BufferGeometry();
  bot.setAttribute('position', new THREE.Float32BufferAttribute(under, 3));
  bot.computeVertexNormals();
  put(root, prep(bot), M.charcoal);
  // roof edge strips
  for (const [a, b] of [[[-ex, ez1], [ex, ez1]], [[ex, ez0], [-ex, ez0]], [[ex, ez0], [ex, ez1]], [[-ex, ez1], [-ex, ez0]]]) {
    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), z0 = Math.min(a[1], b[1]), z1 = Math.max(a[1], b[1]);
    slab(root, M.charcoal, x0 - (x0 === x1 ? 0.005 : 0), ye - TH, z0 - (z0 === z1 ? 0.005 : 0), x1 + (x0 === x1 ? 0.005 : 0), ye, z1 + (z0 === z1 ? 0.005 : 0));
  }
  // ridge and hip caps
  const capM = M.ridge;
  capStrip(root, capM, [-rx - 0.06, yr + 0.004, rz], [rx + 0.06, yr + 0.004, rz], 0.2, 0.06);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const ez = sz > 0 ? ez1 : ez0, t = 0.04; // stop just short of the corner
    capStrip(root, capM, [sx * rx, yr + 0.004, rz], [sx * (ex - (ex - rx) * t), ye + (yr - ye) * t + 0.008, ez + (rz - ez) * t], 0.15, 0.05);
  }
  // fascia, soffit, gutters (front run is interrupted by the porch roof)
  const FO = 0.35, F0 = ye - 0.3, F1 = ye - 0.01, GT = 0.1;
  const fascia = (x0, z0, x1, z1) => slab(root, M.white, x0, F0, z0, x1, F1, z1);
  const soffit = (x0, z0, x1, z1) => slab(root, M.oak, x0, F0, z0, x1, F0 + 0.02, z1);
  const gutter = (x0, z0, x1, z1) => rb(root, M.charcoal, x1 - x0, 0.12, z1 - z0, (x0 + x1) / 2, F1 - 0.1, (z0 + z1) / 2, 0.02, 2);
  const fx = WX + FO, fz0 = WZ0 - FO, fz1 = WZ1 + FO, FT = 0.035;
  const porchX0 = -0.85, porchX1 = 2.85;
  for (const [x0, x1] of [[-fx - FT, porchX0], [porchX1, fx + FT]]) {
    fascia(x0, fz1, x1, fz1 + FT);
    gutter(x0, fz1 + FT, x1, fz1 + FT + GT);
    soffit(Math.max(x0, -fx), WZ1, Math.min(x1, fx), fz1);
  }
  soffit(porchX0, WZ1, porchX1, fz1);
  fascia(-fx - FT, fz0 - FT, fx + FT, fz0);
  gutter(-fx - FT, fz0 - FT - GT, fx + FT, fz0 - FT);
  soffit(-fx, fz0, fx, WZ0);
  for (const s of [-1, 1]) {
    const x0 = s > 0 ? fx : -fx - FT, x1 = s > 0 ? fx + FT : -fx;
    fascia(x0, fz0, x1, fz1);
    const gx0 = s > 0 ? fx + FT : -fx - FT - GT, gx1 = gx0 + GT;
    gutter(gx0, fz0 - FT, gx1, fz1 + FT);
    soffit(s > 0 ? WX : -fx, WZ0, s > 0 ? fx : -WX, WZ1);
  }
  // downpipes: front corners and back corners, hugging the wall
  for (const [x, zs] of [[-6.2, 1], [6.2, 1], [-6.2, -1], [6.2, -1]]) {
    const zw = zs > 0 ? WZ1 + 0.09 : WZ0 - 0.09, zg = zs > 0 ? fz1 + FT + GT / 2 : fz0 - FT - GT / 2;
    const r = 0.035;
    rod(root, M.charcoal, [x, 0.12, zw], [x, F0 - 0.25, zw], r, 12);
    rod(root, M.charcoal, [x, F0 - 0.25, zw], [x, F0 + 0.02, zg], r, 12);
    rod(root, M.charcoal, [x, F0 + 0.02, zg], [x, F1 - 0.12, zg], r, 12);
    put(root, sphere(r, 12, 8), M.charcoal, x, F0 - 0.25, zw);
    put(root, sphere(r, 12, 8), M.charcoal, x, F0 + 0.02, zg);
    rod(root, M.charcoal, [x, 0.12, zw], [x, 0.03, zw + zs * 0.12], r, 12);
    put(root, sphere(r, 12, 8), M.charcoal, x, 0.12, zw);
    for (const y of [0.9, 2.1]) rb(root, M.charcoal, 0.09, 0.025, 0.07, x, y, zw - zs * 0.03, 0.006, 1);
    rb(root, M.stone, 0.22, 0.04, 0.32, x, 0.02, zw + zs * 0.2, 0.01, 1);
  }
  // chimney on the back slope (brick with a concrete cap and a clay pot)
  const chx = -4.2, chz = -3.7, cw = 0.62;
  slab(root, M.brickS, chx - cw / 2, RY - 0.1, chz - cw / 2, chx + cw / 2, yr + 0.55, chz + cw / 2);
  vrb(root, M.vc, 0xbdb8ae, cw + 0.12, 0.08, cw + 0.12, chx, yr + 0.59, chz, 0.012, 2);
  put(root, vcol(cyl(0.09, 0.11, 0.26, 16), 0xa65a3c), M.vc, chx + 0.08, yr + 0.76, chz);
  put(root, vcol(cyl(0.07, 0.08, 0.2, 16), 0xa65a3c), M.vc, chx - 0.12, yr + 0.73, chz + 0.05);
  // flashing collar where it meets the roof
  const yAt = (z) => RY + (z - WZ0) * SLOPE;
  for (const [z, s] of [[chz - cw / 2, -1], [chz + cw / 2, 1]]) rb(root, M.charcoal, cw + 0.08, 0.06, 0.05, chx, yAt(z) + 0.02, z + s * 0.02, 0.01, 1);
  // services on the back wall: AC condenser, gas meter with the yellow gas pipe, kitchen exhaust hood
  const acx = 0.9, acz = WZ0 - 0.04 - 0.17;
  vrb(root, M.vc, 0xbdb8ae, 1.0, 0.06, 0.45, acx, 0.03, acz - 0.03, 0.01, 1);
  const ac = group(root, acx, 0.06, acz, Math.PI);
  vrb(ac, M.vcg, 0xe4e3df, 0.84, 0.62, 0.3, 0, 0.31, 0, 0.025, 2);
  put(ac, vcol(cyl(0.21, 0.21, 0.02, 32), 0x2f3236), M.vcg, -0.12, 0.33, 0.151, Math.PI / 2, 0, 0);
  for (const r of [0.07, 0.12, 0.17, 0.205]) put(ac, vcol(torus(r, 0.005, 4, 32), 0x8d9095), M.vcg, -0.12, 0.33, 0.162);
  put(ac, vcol(cyl(0.035, 0.035, 0.02, 16), 0x8d9095), M.vcg, -0.12, 0.33, 0.165, Math.PI / 2, 0, 0);
  for (let i = 0; i < 6; i++) vrb(ac, M.vcg, 0xcfcdc8, 0.2, 0.012, 0.01, 0.27, 0.16 + i * 0.07, 0.152, 0.003, 1);
  for (const sx2 of [-0.3, 0.3]) vrb(ac, M.vcg, 0x8d9095, 0.06, 0.04, 0.32, sx2, -0.02, 0, 0.006, 1);
  rod(root, M.whitePl, [acx + 0.35, 0.45, acz + 0.1], [acx + 0.35, 1.1, acz + 0.1], 0.03, 10);
  rod(root, M.whitePl, [acx + 0.35, 1.1, acz + 0.1], [acx + 0.35, 1.1, WZ0], 0.03, 10);
  put(root, sphere(0.03, 10, 8), M.whitePl, acx + 0.35, 1.1, acz + 0.1);
  box3(site, acx - 0.5, 0, acz - 0.25, acx + 0.5, 0.7, WZ0);
  const gx = -4.9;
  vrb(root, M.vcg, 0xd8d8d4, 0.28, 0.34, 0.16, gx, 1.35, WZ0 - 0.1, 0.02, 2);
  vrb(root, M.vcg, 0x2f3236, 0.16, 0.08, 0.01, gx, 1.4, WZ0 - 0.181, 0.004, 1);
  const yel = (a, b) => rod(root, M.vcg, a, b, 0.016, 8).geometry.setAttribute('color', vcol(cyl(1, 1, 1, 8), 0xf2c230).attributes.color);
  yel([gx, 0.0, WZ0 - 0.06], [gx, 1.18, WZ0 - 0.06]);
  yel([gx, 1.52, WZ0 - 0.06], [gx, 2.3, WZ0 - 0.06]);
  yel([gx, 2.3, WZ0 - 0.06], [-4.35, 2.3, WZ0 - 0.06]);
  yel([-4.35, 2.3, WZ0 - 0.06], [-4.35, 2.3, WZ0]);
  for (const [x, y] of [[gx, 0.6], [gx, 1.9], [-4.6, 2.3]]) vrb(root, M.charcoal, 0.05, 0.05, 0.05, x, y, WZ0 - 0.03, 0.006, 1);
  const eh = group(root, -3.7, 2.75, WZ0, Math.PI);
  rb(eh, M.charcoal, 0.24, 0.2, 0.14, 0, 0, 0.07, 0.015, 2);
  for (let i = 0; i < 3; i++) rb(eh, M.charcoal, 0.22, 0.012, 0.1, 0, -0.07 + i * 0.06, 0.12, 0.003, 1, 0.5);
  // a slim plumbing vent on the front slope
  put(root, cyl(0.045, 0.045, 0.5, 14), M.charcoal, 3.5, roofY(3.5, 1.5) + 0.12, 1.5);
  put(root, cyl(0.06, 0.06, 0.03, 14), M.charcoal, 3.5, roofY(3.5, 1.5) + 0.37, 1.5);
}

/** Covered porch: deck, steps, posts, gable roof, cladding, door, lamp, plate. */
function buildPorch(site, root, M) {
  const S = site;
  const px0 = -0.7, px1 = 2.7, pz1 = 5.35;
  // deck and steps (stone with tile top)
  slab(root, M.stone, px0, 0, WZ1, px1, FL - 0.03, pz1);
  slab(root, M.pavers, px0 + 0.02, FL - 0.03, WZ1, px1 - 0.02, FL, pz1 - 0.02);
  vrb(root, M.vc, 0xcfcac0, px1 - px0, 0.04, 0.06, (px0 + px1) / 2, FL - 0.02, pz1 - 0.02, 0.01, 2);
  box3(S, px0, 0, WZ1, px1, FL, pz1);
  const sx0 = -0.35, sx1 = 2.35;
  const steps = [[pz1, pz1 + 0.3, 0.3], [pz1 + 0.3, pz1 + 0.6, 0.15]];
  for (const [z0, z1, top] of steps) {
    slab(root, M.stone, sx0, 0, z0, sx1, top - 0.03, z1);
    vrb(root, M.vc, 0xcfcac0, sx1 - sx0 + 0.02, 0.035, z1 - z0 + 0.02, (sx0 + sx1) / 2, top - 0.0175, (z0 + z1) / 2, 0.008, 2);
    box3(S, sx0, 0, z0, sx1, top, z1);
  }
  // door mat
  put(root, vcol(rbox(1.0, 0.015, 0.6, 0.006, 1), 0x6b5a48), M.vc, 1.0, FL + 0.0075, WZ1 + 0.55);
  // posts and beam
  const postM = M.white, py1 = 2.8;
  for (const x of [px0 + 0.15, px1 - 0.15]) {
    rb(root, postM, 0.16, py1 - FL, 0.16, x, (FL + py1) / 2, pz1 - 0.15, 0.015, 2);
    rb(root, M.stone, 0.24, 0.12, 0.24, x, FL + 0.06, pz1 - 0.15, 0.01, 1);
    rb(root, postM, 0.2, 0.06, 0.2, x, py1 - 0.03, pz1 - 0.15, 0.01, 1);
    box3(S, x - 0.1, FL, pz1 - 0.27, x + 0.1, py1, pz1 - 0.03);
  }
  rb(root, postM, px1 - px0 + 0.1, 0.2, 0.18, (px0 + px1) / 2, py1 + 0.08, pz1 - 0.15, 0.015, 2);
  for (const x of [px0 + 0.15, px1 - 0.15]) rb(root, postM, 0.14, 0.18, pz1 - WZ1 - 0.2, x, py1 + 0.08, (WZ1 + pz1 - 0.2) / 2, 0.012, 2);
  // porch ceiling (wood) with a downlight
  slab(root, M.oak, px0 - 0.1, py1 + 0.17, WZ1, px1 + 0.1, py1 + 0.2, pz1 + 0.12);
  put(root, cyl(0.09, 0.09, 0.02, 20), M.white, 1.0, py1 + 0.165, 4.3);
  noShadow(put(root, cyl(0.07, 0.07, 0.02, 20), M.porchGlow, 1.0, py1 + 0.158, 4.3));
  // gable roof over the porch
  const cx = 1.0, half = 1.85, ype = 3.05, pitch = 0.6, yr = ype + half * pitch, zb = 1.9, zf = pz1 + 0.3, TH = 0.1;
  const pos = [], uv = [], under = [];
  for (const s of [-1, 1]) {
    const e0 = [cx + s * half, ype, zf], e1 = [cx + s * half, ype, zb], r1 = [cx, yr, zb], r0 = [cx, yr, zf];
    const quadv = s > 0 ? [e0, e1, r1, e0, r1, r0] : [e1, e0, r0, e1, r0, r1];
    for (const v of quadv) {
      pos.push(...v);
      const sl = Math.hypot(v[0] - (cx + s * half), v[1] - ype);
      uv.push(v[2], -sl);
    }
    const ord = s > 0 ? [e0, r1, e1, e0, r0, r1] : [e1, r0, e0, e1, r1, r0];
    for (const v of ord) under.push(v[0], v[1] - TH, v[2]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  put(root, prep(g, true), M.roof);
  const gu = new THREE.BufferGeometry();
  gu.setAttribute('position', new THREE.Float32BufferAttribute(under, 3));
  gu.computeVertexNormals();
  put(root, prep(gu), M.charcoal);
  capStrip(root, M.ridge, [cx, yr + 0.004, zb + 0.2], [cx, yr + 0.004, zf + 0.02], 0.2, 0.06);
  // pediment (gable triangle) clad in wood, with rake boards
  const ped = new THREE.Shape();
  const pb = py1 + 0.18, pw = half - 0.12;
  ped.moveTo(-pw, 0); ped.lineTo(pw, 0); ped.lineTo(0, pw * pitch); ped.closePath();
  put(root, prep(new THREE.ExtrudeGeometry(ped, { depth: 0.02, bevelEnabled: false })), M.charcoal, cx, pb, zf - 0.33);
  for (let y = 0.012; y < pw * pitch - 0.05; y += 0.125) {
    const y1 = Math.min(y + 0.112, pw * pitch - 0.01), h0 = pw - y / pitch - 0.01, h1 = Math.max(0.005, pw - y1 / pitch - 0.01);
    const sh = new THREE.Shape();
    sh.moveTo(-h0, 0); sh.lineTo(h0, 0); sh.lineTo(h1, y1 - y); sh.lineTo(-h1, y1 - y); sh.closePath();
    put(root, prep(new THREE.ExtrudeGeometry(sh, { depth: 0.022, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 1 })), M.oak, cx, pb + y, zf - 0.31);
  }
  // round louvred vent near the apex
  const vy = pb + pw * pitch * 0.62;
  put(root, torus(0.13, 0.02, 8, 28), M.white, cx, vy, zf - 0.28);
  put(root, cyl(0.125, 0.125, 0.01, 28), M.charcoal, cx, vy, zf - 0.29, Math.PI / 2, 0, 0);
  for (let i = -2; i <= 2; i++) rb(root, M.white, Math.sqrt(0.125 ** 2 - (i * 0.045) ** 2) * 2, 0.012, 0.02, cx, vy + i * 0.045, zf - 0.28, 0.003, 1, 0.5);
  const rakeLen = Math.hypot(half, half * pitch) + 0.05, ang = Math.atan(pitch);
  for (const s of [-1, 1]) {
    rb(root, M.white, rakeLen, 0.18, 0.04, cx + s * half / 2, ype + half * pitch / 2 - 0.09, zf + 0.0, 0.01, 2, 0, 0, -s * ang);
    rb(root, M.white, 0.04, 0.18, zf - 3.72, cx + s * (half + 0.0), ype - 0.09, (zf + 3.72) / 2, 0.01, 2);
  }
  // wood cladding on the wall behind the porch (horizontal slats on a dark backing)
  const cy0 = FL, cy1 = py1 + 0.17;
  wallRun(root, M.charcoal, 'x', px0, px1, WZ1, WZ1 + 0.012, cy0, cy1, [{ a: DOOR.x0, b: DOOR.x1, lo: FL, hi: FL + DOOR.h }]);
  for (let y = cy0 + 0.01; y < cy1 - 0.05; y += 0.125) {
    const y1 = Math.min(y + 0.112, cy1 - 0.005);
    for (const [a, b] of [[px0, DOOR.x0 - 0.06], [DOOR.x1 + 0.06, px1]]) rb(root, M.oak, b - a, y1 - y, 0.022, (a + b) / 2, (y + y1) / 2, WZ1 + 0.023, 0.004, 1);
    if (y > FL + DOOR.h + 0.06) rb(root, M.oak, DOOR.x1 - DOOR.x0 + 0.12, y1 - y, 0.022, (DOOR.x0 + DOOR.x1) / 2, (y + y1) / 2, WZ1 + 0.023, 0.004, 1);
  }
  // front door frame (charcoal) and threshold
  const dz = WZ1 + 0.035, dh = FL + DOOR.h;
  rb(root, M.charcoal, 0.07, DOOR.h + 0.07, 0.06, DOOR.x0 - 0.035, FL + (DOOR.h + 0.07) / 2, dz, 0.006, 1);
  rb(root, M.charcoal, 0.07, DOOR.h + 0.07, 0.06, DOOR.x1 + 0.035, FL + (DOOR.h + 0.07) / 2, dz, 0.006, 1);
  rb(root, M.charcoal, DOOR.x1 - DOOR.x0 + 0.14, 0.07, 0.06, (DOOR.x0 + DOOR.x1) / 2, dh + 0.035, dz, 0.006, 1);
  slab(root, M.white, DOOR.x0, FL, IZ1, DOOR.x0 + 0.02, dh, WZ1);
  slab(root, M.white, DOOR.x1 - 0.02, FL, IZ1, DOOR.x1, dh, WZ1);
  slab(root, M.white, DOOR.x0, dh - 0.02, IZ1, DOOR.x1, dh, WZ1);
  rb(root, M.marble, DOOR.x1 - DOOR.x0, 0.02, WZ1 - IZ1 + 0.04, (DOOR.x0 + DOOR.x1) / 2, FL + 0.005, (IZ1 + WZ1) / 2, 0.004, 1);
  // interior casing around the door
  for (const x of [DOOR.x0 - 0.035, DOOR.x1 + 0.035]) rb(root, M.white, 0.07, DOOR.h + 0.07, 0.016, x, FL + (DOOR.h + 0.07) / 2, IZ1 - 0.008, 0.004, 1);
  rb(root, M.white, DOOR.x1 - DOOR.x0 + 0.14, 0.07, 0.016, (DOOR.x0 + DOOR.x1) / 2, dh + 0.035, IZ1 - 0.008, 0.004, 1);

  // the door leaf (hinged at x1, swings inward)
  const pivot = new THREE.Object3D();
  pivot.position.set(DOOR.x1 - 0.025, FL + 0.012, IZ1 + 0.06);
  pivot.userData.dynamic = true;
  root.add(pivot);
  const leaf = new THREE.Group();
  pivot.add(leaf);
  const LW = DOOR.x1 - DOOR.x0 - 0.05, LH = DOOR.h - 0.02, LT = 0.05;
  const wood = M.doorPaint;
  rb(leaf, wood, 0.6, LH, LT, -0.3, LH / 2, 0, 0.006, 1);
  rb(leaf, wood, 0.14, LH, LT, -LW + 0.07, LH / 2, 0, 0.006, 1);
  const wx0 = -LW + 0.14, wx1 = -0.6;
  rb(leaf, wood, wx1 - wx0, 0.9, LT, (wx0 + wx1) / 2, 0.45, 0, 0.004, 1);
  rb(leaf, wood, wx1 - wx0, LH - 1.95, LT, (wx0 + wx1) / 2, (1.95 + LH) / 2, 0, 0.004, 1);
  noShadow(put(leaf, rbox(wx1 - wx0, 1.05, 0.012, 0.002, 1), M.frosted, (wx0 + wx1) / 2, 1.425, 0));
  for (const y of [0.9, 1.95]) rb(leaf, M.charcoal, wx1 - wx0 + 0.01, 0.015, LT + 0.006, (wx0 + wx1) / 2, y, 0, 0.003, 1);
  // grooves on the outside face
  for (const [y0, y1] of [[0.12, 0.95], [1.1, 1.98]]) { // raised panel moulding on the outside
    const ph = y1 - y0, pcx = -0.31;
    rb(leaf, wood, 0.46, 0.018, 0.012, pcx, y0, LT / 2 + 0.004, 0.004, 1);
    rb(leaf, wood, 0.46, 0.018, 0.012, pcx, y1, LT / 2 + 0.004, 0.004, 1);
    rb(leaf, wood, 0.018, ph, 0.012, pcx - 0.22, (y0 + y1) / 2, LT / 2 + 0.004, 0.004, 1);
    rb(leaf, wood, 0.018, ph, 0.012, pcx + 0.22, (y0 + y1) / 2, LT / 2 + 0.004, 0.004, 1);
  }
  // pull bar outside + digital lock, lever inside
  const hx = -LW + 0.07;
  rod(leaf, M.gold, [hx, 0.75, LT / 2 + 0.055], [hx, 1.45, LT / 2 + 0.055], 0.014, 10);
  for (const y of [0.85, 1.35]) rod(leaf, M.gold, [hx, y, LT / 2], [hx, y, LT / 2 + 0.055], 0.009, 8);
  rb(leaf, M.black, 0.07, 0.2, 0.03, hx + 0.0, 1.62, LT / 2 + 0.015, 0.01, 2);
  rb(leaf, paint(0x7fd4ff, 0.3, 0, { emissive: 0x4fb8ff, emissiveIntensity: 0.6 }), 0.045, 0.07, 0.004, hx, 1.64, LT / 2 + 0.031, 0.002, 1);
  rod(leaf, M.chrome, [hx, 1.0, -LT / 2], [hx, 1.0, -LT / 2 - 0.05], 0.01, 8);
  rod(leaf, M.chrome, [hx, 1.0, -LT / 2 - 0.05], [hx + 0.12, 1.0, -LT / 2 - 0.05], 0.009, 8);
  for (const y of [0.25, LH - 0.25]) rod(leaf, M.chrome, [-0.005, y - 0.05, 0], [-0.005, y + 0.05, 0], 0.008, 8);
  bake(leaf);
  S.doors.push({ pivot, openAngle: -1.6, collider: { min: [DOOR.x0, FL, IZ1 + 0.03], max: [DOOR.x1, FL + DOOR.h, IZ1 + 0.09] }, auto: false });

  // wall lamp left of the door, house number right, intercom
  const lx = -0.05, ly = FL + 1.95, lz = WZ1 + 0.035;
  rb(root, M.charcoal, 0.12, 0.3, 0.03, lx, ly, lz + 0.015, 0.008, 2);
  rb(root, M.charcoal, 0.15, 0.025, 0.16, lx, ly + 0.14, lz + 0.09, 0.006, 1);
  rb(root, M.charcoal, 0.15, 0.025, 0.16, lx, ly - 0.14, lz + 0.09, 0.006, 1);
  for (const [sx, sz] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) rod(root, M.charcoal, [lx + sx * 0.068, ly - 0.13, lz + 0.02 + sz * 0.14], [lx + sx * 0.068, ly + 0.13, lz + 0.02 + sz * 0.14], 0.006, 6);
  noShadow(put(root, rbox(0.115, 0.245, 0.115, 0.008, 1), M.porchGlow, lx, ly, lz + 0.09));
  const poolQ = (w, h) => prep(new THREE.PlaneGeometry(w, h), true);
  noShadow(put(root, poolQ(1.3, 1.7), M.pool, lx, ly - 0.1, WZ1 + 0.037));
  noShadow(put(root, poolQ(2.6, 2.2), M.pool, 1.0, FL + 0.004, 4.35, -Math.PI / 2, 0, 0));
  S.lamps.push({ pos: [lx, ly, lz + 0.35], color: 0xffcf96, intensity: 5, range: 6 });
  const plate = group(root, 2.12, FL + 1.75, WZ1 + 0.036);
  put(plate, vcol(rbox(0.36, 0.19, 0.02, 0.008, 1), 0x2c3036), M.vc, 0, 0, 0.01);
  put(plate, cellQuad('number', 0.34, 0.17), M.atlas, 0, 0, 0.0205);
  rb(root, M.whitePl, 0.11, 0.17, 0.03, 1.75, FL + 1.1, WZ1 + 0.05, 0.01, 2);
  rb(root, M.black, 0.07, 0.06, 0.004, 1.75, FL + 1.14, WZ1 + 0.066, 0.004, 1);
  put(root, cyl(0.012, 0.012, 0.01, 12), M.charcoal, 1.75, FL + 1.06, WZ1 + 0.066, Math.PI / 2, 0, 0);
  // porch planters with small shrubs, umbrella of daily life: a bike helmet on the bench? keep a bench
  for (const x of [px0 + 0.35, px1 - 0.35]) {
    rb(root, M.charcoal, 0.42, 0.42, 0.42, x, FL + 0.21, WZ1 + 0.5, 0.02, 2);
    slab(root, M.dirt, x - 0.18, FL + 0.38, WZ1 + 0.32, x + 0.18, FL + 0.4, WZ1 + 0.68);
    put(root, topiary(0.27, x > 1 ? 4 : 2), M.leaves, x, FL + 0.64, WZ1 + 0.5);
  }
  box3(S, px0 + 0.14, FL, WZ1 + 0.29, px0 + 0.56, FL + 0.42, WZ1 + 0.71);
  box3(S, px1 - 0.56, FL, WZ1 + 0.29, px1 - 0.14, FL + 0.42, WZ1 + 0.71);
}

// ------------------------------------------------------------------ rooms
function ceilingLight(root, M, x, z, r = 0.22) {
  put(root, cyl(r, r * 0.94, 0.05, 32), M.whitePl, x, CL - 0.025, z);
  noShadow(put(root, cyl(r * 0.86, r * 0.86, 0.012, 32), M.lamp, x, CL - 0.052, z));
}

function buildBedroom(site, root, M) {
  const S = site;
  // bed: head against the back wall
  const bx = 4.6, bw = 1.55, bl = 2.1, bz0 = IZ0, bz1 = IZ0 + bl;
  const bg = group(root, bx, FL, (bz0 + bz1) / 2);
  rb(bg, M.oak, bw + 0.1, 0.24, bl - 0.08, 0, 0.2, 0.04, 0.02, 2);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rb(bg, M.oak, 0.06, 0.1, 0.06, sx * (bw / 2 - 0.02), 0.05, sz * (bl / 2 - 0.08), 0.01, 1);
  put(bg, softBox(1.68, 1.0, 0.12, 0.05, 0.02, 0.002, 2), M.fabBeige, 0, 0.62, -bl / 2 + 0.07);
  rb(bg, M.linen, bw, 0.24, bl - 0.16, 0, 0.44, 0.06, 0.06, 3);            // mattress (sheet)
  // duvet: top + hanging sides + turned-down edge
  const dg = softBox(bw + 0.1, 0.09, 1.45, 0.04, 0.03, 0.007, 5);
  put(bg, dg, M.fabGreen, 0, 0.58, 0.36);
  for (const s of [-1, 1]) put(bg, softBox(0.05, 0.28, 1.42, 0.02, 0.0, 0.006, 6 + s), M.fabGreen, s * (bw / 2 + 0.06), 0.46, 0.36);
  put(bg, softBox(bw + 0.14, 0.28, 0.05, 0.02, 0.0, 0.006, 9), M.fabGreen, 0, 0.46, 0.36 + 0.73);
  put(bg, softBox(bw + 0.06, 0.06, 0.3, 0.03, 0.01, 0.004, 3), M.linen, 0, 0.6, -0.42);
  // pillows
  put(bg, softBox(0.62, 0.15, 0.4, 0.06, 0.05, 0.005, 1), M.linen, -0.36, 0.66, -0.78, 0.25, 0, 0).rotation.x = -0.35;
  put(bg, softBox(0.62, 0.15, 0.4, 0.06, 0.05, 0.005, 2), M.linen, 0.36, 0.66, -0.78).rotation.x = -0.3;
  put(bg, softBox(0.4, 0.12, 0.3, 0.05, 0.04, 0.004, 3), M.mustard, 0.1, 0.72, -0.56).rotation.set(-0.9, 0.2, 0);
  // folded blanket at the foot
  for (let i = 0; i < 3; i++) put(bg, softBox(1.25, 0.035, 0.42, 0.017, 0.004, 0.002, 7 + i), M.mustard, 0.02, 0.645 + i * 0.033, 0.68 + i * 0.006);
  box3(S, bx - bw / 2 - 0.06, FL, bz0, bx + bw / 2 + 0.06, FL + 0.66, bz1);
  // nightstands with clock, lamp, books, phone
  for (const s of [-1, 1]) {
    const nx = bx + s * (bw / 2 + 0.34), nz = IZ0 + 0.24;
    const ng = group(root, nx, FL, nz);
    rb(ng, M.oak, 0.46, 0.5, 0.42, 0, 0.29, 0, 0.015, 2);
    rb(ng, M.oak, 0.42, 0.18, 0.02, 0, 0.42, 0.21, 0.006, 1);
    rb(ng, M.oak, 0.42, 0.18, 0.02, 0, 0.22, 0.21, 0.006, 1);
    for (const y of [0.42, 0.22]) put(ng, sphere(0.013, 10, 8), M.charcoal, 0, y, 0.232);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rb(ng, M.oak, 0.03, 0.05, 0.03, sx * 0.2, 0.025, sz * 0.18, 0.006, 1);
    box3(S, nx - 0.23, FL, nz - 0.21, nx + 0.23, FL + 0.55, nz + 0.21);
    // lamp
    const lg = group(ng, s * 0.08 * -1 + 0.0, 0.54, -0.06);
    put(lg, lathe([[0, 0], [0.07, 0], [0.075, 0.02], [0.06, 0.12], [0.03, 0.2], [0.012, 0.22], [0, 0.22]], 24), M.ceramic, 0, 0, 0);
    put(lg, cyl(0.1, 0.13, 0.17, 28, true), M.linen, 0, 0.3, 0);
    noShadow(put(lg, sphere(0.04, 12, 8), M.lamp, 0, 0.26, 0));
    if (s < 0) {
      // twin-bell alarm clock
      const cg = group(ng, 0.1, 0.54, 0.06, 0.3);
      put(cg, vcol(cyl(0.065, 0.065, 0.045, 28), 0x6fbfae), M.vcg, 0, 0.075, 0, Math.PI / 2, 0, 0);
      put(cg, cellQuadCircle(), M.atlas, 0, 0.075, 0.0235);
      for (const b of [-1, 1]) { put(cg, sphere(0.03, 14, 8, ), M.chrome, b * 0.04, 0.14, 0).scale.set(1, 0.7, 1); rod(cg, M.chrome, [b * 0.045, 0.01, 0.01], [b * 0.03, 0.04, 0.0], 0.005, 6); }
      rod(cg, M.chrome, [-0.04, 0.165, 0], [0.04, 0.165, 0], 0.004, 6);
      book(ng, M, -0.08, 0.54, 0.05, 0.16, 0.025, 0.22, 0x3d6aa8, 0.2).rotation.set(0, 0.2, Math.PI / 2);
    } else {
      book(ng, M, 0.08, 0.54, 0.06, 0.17, 0.03, 0.23, 0xc4553e).rotation.set(0, -0.3, Math.PI / 2);
      rb(ng, M.black, 0.075, 0.009, 0.155, 0.08, 0.578, 0.06, 0.006, 1).rotation.y = -0.15;
      mug(ng, M, 0.14, 0.54, -0.12, 0xf2efe8, 1);
    }
  }
  // picture above the bed
  picture(root, M, 'art', bx, FL + 1.55, IZ0 + 0.0, 1.0, 0.75, 0, 0xc09060, 0.05);
  // slippers by the bed
  slipper(root, M, bx - bw / 2 - 0.32, FL, -4.3, 1.9, 0x8fa9c9);
  slipper(root, M, bx - bw / 2 - 0.28, FL, -4.05, 1.6, 0x8fa9c9);
  // rug
  put(root, rbox(2.4, 0.012, 1.7, 0.005, 1), M.rug2, bx, FL + 0.006, -2.35);
  // wardrobe against partition B (faces -Z)
  const wx = 5.15, ww = 1.9, wd = 0.6, wh = 2.25, wz = BZ - 0.06 - wd / 2;
  const wg = group(root, wx, FL, wz, Math.PI);
  rb(wg, M.white, ww, wh, wd, 0, wh / 2 + 0.05, 0, 0.012, 2);
  rb(wg, M.white, ww - 0.02, 0.05, wd - 0.04, 0, 0.025, 0.0, 0.006, 1);
  for (let i = 0; i < 3; i++) {
    const dw = (ww - 0.02) / 3, x = -ww / 2 + 0.01 + dw * (i + 0.5);
    rb(wg, M.oak, dw - 0.008, wh - 0.02, 0.022, x, wh / 2 + 0.05, wd / 2 + 0.011, 0.006, 1);
    const iw = dw - 0.16, ih = wh - 0.2, fz2 = wd / 2 + 0.026;
    for (const yy of [0.15, wh - 0.05]) rb(wg, M.oak, iw, 0.02, 0.01, x, yy, fz2, 0.004, 1);
    for (const xx of [-iw / 2, iw / 2]) rb(wg, M.oak, 0.02, ih, 0.01, x + xx, wh / 2 + 0.05, fz2, 0.004, 1);
    rb(wg, M.oak, iw, 0.02, 0.01, x, 1.42, fz2, 0.004, 1);
    const hx = x + (i === 1 ? -1 : 1) * (dw / 2 - 0.05) * (i === 0 ? 1 : 1);
    rb(wg, M.charcoal, 0.018, 0.32, 0.02, hx, 1.15, wd / 2 + 0.032, 0.006, 1);
  }
  box3(S, wx - ww / 2, FL, wz - wd / 2 - 0.03, wx + ww / 2, FL + wh + 0.05, BZ - 0.06);
  // laundry basket (half full) next to the wardrobe, by the doorway side
  const lb = group(root, 3.05, FL, -0.95);
  put(lb, lathe([[0, 0], [0.2, 0], [0.22, 0.02], [0.24, 0.42], [0.245, 0.44], [0.23, 0.44], [0.22, 0.03], [0, 0.03]], 28), M.oak, 0, 0, 0);
  for (let i = 0; i < 18; i++) rod(lb, M.walnut, [Math.cos(i * 0.35) * 0.215, 0.03, Math.sin(i * 0.35) * 0.215], [Math.cos(i * 0.35) * 0.238, 0.42, Math.sin(i * 0.35) * 0.238], 0.006, 4);
  put(lb, softBox(0.4, 0.14, 0.38, 0.06, 0.05, 0.02, 4), M.towel, 0, 0.3, 0);
  put(lb, softBox(0.3, 0.06, 0.24, 0.03, 0.01, 0.015, 6), M.fabGray, 0.06, 0.38, -0.03, 0.4, 0.5, 0.2);
  put(lb, softBox(0.42, 0.04, 0.16, 0.02, 0.0, 0.01, 7), M.mustard, 0.1, 0.4, 0.2, 0.2, 0.3, -0.9).rotation.set(0.1, 0.3, -1.1);
  box3(S, 2.8, FL, -1.2, 3.3, FL + 0.45, -0.7);
  // desk under the east window with chair, lamp, books, laptop
  const dx = IX - 0.32, dz = -2.6;
  const dg2 = group(root, dx, FL, dz, -Math.PI / 2); // faces -X (local +Z → -X)
  rb(dg2, M.oak, 1.3, 0.035, 0.6, 0, 0.74, 0, 0.008, 2);
  for (const sx of [-1, 1]) rb(dg2, M.white, 0.035, 0.72, 0.56, sx * 0.62, 0.36, 0, 0.006, 1);
  rb(dg2, M.white, 0.42, 0.16, 0.5, 0.38, 0.62, 0.0, 0.008, 1);
  rb(dg2, M.oak, 0.38, 0.12, 0.012, 0.38, 0.62, 0.252, 0.004, 1);
  bookRow(dg2, M, -0.62, 0.7575, -0.2, 0.32, 3, 0.16);
  vrb(dg2, M.vcg, 0xb0b4ba, 0.34, 0.015, 0.24, -0.05, 0.765, 0.05, 0.006, 1);                     // laptop base
  const lid = vrb(dg2, M.vcg, 0xb0b4ba, 0.34, 0.24, 0.012, -0.05, 0.88, -0.07, 0.006, 1); lid.rotation.x = -0.25;
  // desk lamp
  const dl = group(dg2, 0.45, 0.7575, -0.15);
  put(dl, cyl(0.07, 0.075, 0.02, 24), M.charcoal, 0, 0.01, 0);
  rod(dl, M.charcoal, [0, 0.02, 0], [0.02, 0.36, 0.05], 0.008);
  rod(dl, M.charcoal, [0.02, 0.36, 0.05], [-0.08, 0.42, 0.18], 0.008);
  put(dl, cyl(0.03, 0.075, 0.1, 20, true), M.charcoal, -0.09, 0.4, 0.2, 0.7, 0, 0);
  noShadow(put(dl, sphere(0.025, 10, 8), M.lamp, -0.09, 0.38, 0.2));
  put(dg2, cellQuad('note', 0.07, 0.07), M.atlas, 0.2, 0.76, 0.05, -Math.PI / 2, 0, 0);
  mug(dg2, M, 0.2, 0.7575, 0.18, 0xe7b851);
  box3(S, dx - 0.3, FL, dz - 0.65, IX, FL + 0.78, dz + 0.65);
  // chair with a jacket over it
  const ch = group(root, dx - 0.62, FL, dz + 0.05, Math.PI / 2 + 0.25);
  chair(ch, M, M.oak, M.fabGray);
  const jm = textured('fabric', { color: 0x3b4f73, seed: 21 }, 0.5, { normal: 0.7 });
  const jk = group(ch, 0, 0, -0.2);
  put(jk, softBox(0.46, 0.07, 0.1, 0.03, 0.0, 0.004, 3), jm, 0, 0.875, 0);
  put(jk, softBox(0.47, 0.52, 0.035, 0.015, 0.0, 0.01, 4), jm, 0, 0.6, -0.048);
  put(jk, softBox(0.42, 0.3, 0.03, 0.015, 0.0, 0.008, 5), jm, 0, 0.72, 0.035);
  for (const s of [-1, 1]) put(jk, capsule(0.04, 0.4, 4, 10), jm, s * 0.26, 0.6, -0.03, 0, 0, s * 0.06);
  box3(S, dx - 0.9, FL, dz - 0.25, dx - 0.35, FL + 0.5, dz + 0.3);
  // backpack by the desk
  const bp = group(root, IX - 0.25, FL, -1.6, -2.2);
  put(bp, vcol(softBox(0.3, 0.4, 0.17, 0.06, 0.02, 0.006, 2), 0xd9534f), M.vc, 0, 0.2, 0);
  put(bp, vcol(softBox(0.22, 0.16, 0.05, 0.03, 0.01, 0.004, 3), 0xb84540), M.vc, 0, 0.14, 0.1);
  for (const s of [-1, 1]) put(bp, vcol(torus(0.12, 0.016, 6, 16, Math.PI), 0x333333), M.vc, s * 0.08, 0.28, -0.1, 0, Math.PI / 2, 0).rotation.set(0, Math.PI / 2, Math.PI / 2 + 0.4);
  // chest of drawers on partition A with treasures, a poster above, a floating shelf
  const dr = group(root, AX + 0.06 + 0.23, FL, -4.55, Math.PI / 2); // faces +X
  rb(dr, M.white, 1.0, 0.82, 0.44, 0, 0.45, 0, 0.012, 2);
  for (let i = 0; i < 3; i++) {
    rb(dr, M.oak, 0.96, 0.25, 0.02, 0, 0.18 + i * 0.27, 0.22, 0.006, 1);
    rb(dr, M.charcoal, 0.2, 0.014, 0.02, 0, 0.26 + i * 0.27, 0.24, 0.005, 1);
  }
  rb(dr, M.oak, 1.02, 0.03, 0.46, 0, 0.875, 0, 0.008, 2);
  for (const [sx2, sz2] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rb(dr, M.oak, 0.04, 0.05, 0.04, sx2 * 0.46, 0.025, sz2 * 0.18, 0.006, 1);
  picture(dr, M, 'photo4', -0.3, 0.99, -0.12, 0.2, 0.16, 0, 0x2b2b2b, 0.012).rotation.x = -0.12;
  const tr = group(dr, 0.05, 0.89, -0.08);
  put(tr, cyl(0.05, 0.055, 0.04, 6), M.walnut, 0, 0.02, 0);
  put(tr, lathe([[0, 0], [0.012, 0], [0.012, 0.06], [0.04, 0.1], [0.05, 0.16], [0.045, 0.16], [0.035, 0.1], [0, 0.085]], 20), M.gold, 0, 0.04, 0);
  for (const s2 of [-1, 1]) put(tr, torus(0.025, 0.004, 6, 12, Math.PI), M.gold, s2 * 0.048, 0.17, 0, 0, 0, s2 * Math.PI / 2);
  plant(dr, M, 0.32, 0.89, -0.05, 'bush', 0.45, 0xc8724a, 12);
  book(dr, M, -0.05, 0.89, 0.1, 0.2, 0.02, 0.28, 0xe7b851).rotation.set(0, 0.3, Math.PI / 2);
  book(dr, M, -0.04, 0.91, 0.1, 0.19, 0.02, 0.27, 0x3d6aa8).rotation.set(0, 0.1, Math.PI / 2);
  box3(S, AX + 0.06, FL, -5.05, AX + 0.53, FL + 0.9, -4.05);
  picture(root, M, 'poster1', AX + 0.06, FL + 1.65, -4.55, 0.6, 0.8, Math.PI / 2, 0xf2efe8, 0.0);
  const shelf = group(root, AX + 0.06, FL + 1.45, -3.05, Math.PI / 2);
  rb(shelf, M.oak, 1.1, 0.03, 0.22, 0, 0, 0.11, 0.006, 2);
  bookRow(shelf, M, -0.52, 0.015, 0.1, 0.45, 6, 0.16);
  plant(shelf, M, 0.2, 0.015, 0.1, 'trail', 0.8, 0xf2efe8, 13);
  put(shelf, vcol(rbox(0.12, 0.05, 0.07, 0.015, 2), 0xe2574c), M.vcg, 0.42, 0.04, 0.12);
  for (const wx2 of [0.38, 0.46]) put(shelf, vcol(cyl(0.016, 0.016, 0.012, 12), 0x222222), M.vcg, wx2, 0.031, 0.155, Math.PI / 2, 0, 0);
  picture(root, M, 'photo2', AX + 0.06, FL + 1.05, -3.25, 0.32, 0.24, Math.PI / 2, 0x2b2b2b, 0.02);
  picture(root, M, 'photo3', AX + 0.06, FL + 1.05, -2.8, 0.24, 0.32, Math.PI / 2, 0xc09060, 0.02);
  // a basketball by the drawers
  const ball = group(root, AX + 0.25, FL + 0.12, -3.85);
  put(ball, vcol(sphere(0.12, 24, 16), 0xe0752d), M.vc, 0, 0, 0);
  put(ball, torus(0.1205, 0.003, 4, 40), M.rubber, 0, 0, 0);
  put(ball, torus(0.1205, 0.003, 4, 40), M.rubber, 0, 0, 0, Math.PI / 2, 0, 0);
  // ceiling light
  ceilingLight(root, M, bx - 0.4, -2.85);
  S.lamps.push({ pos: [bx - 0.4, CL - 0.3, -2.85], color: 0xffe2b8, intensity: 12, range: 7 });
  S.interactables.push({ id: 'bed', label: '잠자기', pos: [bx - bw / 2 - 0.15, FL + 0.75, -3.9], radius: 1.6, seat: { pos: [bx, FL + 0.95, IZ0 + 0.55], yaw: Math.PI, pitch: 0.55 } });
  S.interactables.push({ id: 'wardrobe', label: '옷 입기', pos: [wx, FL + 1.3, wz - wd / 2 - 0.1], radius: 1.5 });
}

let clockFaceGeo = null;
function cellQuadCircle() {
  if (!clockFaceGeo) clockFaceGeo = prep(toCell(new THREE.CircleGeometry(0.055, 28), 'clock'), true);
  return clockFaceGeo;
}

/** Simple wooden chair in local frame, facing +Z (seat front towards +Z). */
function chair(g, M, wood, seatM) {
  rb(g, wood, 0.44, 0.04, 0.42, 0, 0.45, 0, 0.01, 2);
  if (seatM) put(g, softBox(0.4, 0.04, 0.38, 0.015, 0.01, 0.002, 2), seatM, 0, 0.485, 0.0);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rb(g, wood, 0.035, 0.45, 0.035, sx * 0.19, 0.225, sz * 0.18, 0.008, 1);
  for (const sx of [-1, 1]) rb(g, wood, 0.035, 0.45, 0.035, sx * 0.19, 0.69, -0.19, 0.008, 1);
  rb(g, wood, 0.42, 0.14, 0.025, 0, 0.82, -0.195, 0.008, 2);
  rb(g, wood, 0.38, 0.03, 0.02, 0, 0.62, -0.195, 0.006, 1);
}

function buildBathroom(site, root, M) {
  const S = site;
  // vanity against partition B (faces +Z)
  const vx = 3.55, vw = 1.2, vd = 0.52, vz = BZ + 0.06 + vd / 2;
  const vg = group(root, vx, FL, vz);
  rb(vg, M.walnut, vw, 0.6, vd - 0.02, 0, 0.42, -0.01, 0.01, 2);
  for (const s of [-1, 1]) {
    rb(vg, M.walnut, vw / 2 - 0.01, 0.56, 0.02, s * vw / 4, 0.42, vd / 2 - 0.01, 0.006, 1);
    rb(vg, M.charcoal, 0.16, 0.014, 0.02, s * 0.12, 0.66, vd / 2 + 0.005, 0.005, 1);
  }
  rb(vg, M.marble, vw + 0.02, 0.04, vd + 0.02, 0, 0.74, 0, 0.008, 2);
  // vessel basin
  put(vg, lathe([[0, 0], [0.12, 0], [0.18, 0.04], [0.215, 0.1], [0.22, 0.13], [0.205, 0.13], [0.195, 0.1], [0.165, 0.05], [0.1, 0.02], [0, 0.02]], 32), M.ceramic, 0, 0.76, 0.03).scale.set(1.15, 1, 0.9);
  // faucet
  rod(vg, M.chrome, [0, 0.76, -0.17], [0, 1.0, -0.17], 0.017, 14);
  rod(vg, M.chrome, [0, 1.0, -0.17], [0, 0.99, -0.03], 0.013, 12);
  put(vg, sphere(0.017, 12, 8), M.chrome, 0, 1.0, -0.17);
  rod(vg, M.chrome, [0.06, 0.96, -0.17], [0.06, 0.99, -0.12], 0.007, 8);
  // toothbrush cup, soap
  put(vg, vcol(cyl(0.035, 0.03, 0.1, 16), 0xb8d8d0), M.vcg, -0.42, 0.81, -0.08);
  for (const [c, a] of [[0x3d9be9, 0.18], [0xff7a8a, -0.15]]) rod(vg, M.vc, [-0.42, 0.79, -0.08], [-0.42 + Math.sin(a) * 0.05, 0.98, -0.08 + a * 0.08], 0.006, 6).geometry.setAttribute('color', vcol(cyl(1, 1, 1, 6), c).attributes.color);
  put(vg, vcol(lathe([[0, 0], [0.035, 0], [0.035, 0.12], [0.012, 0.135], [0.012, 0.16], [0, 0.16]], 16), 0xf2efe8), M.vcg, 0.42, 0.76, -0.1);
  rod(vg, M.chrome, [0.42, 0.92, -0.1], [0.42, 0.93, -0.06], 0.006, 6);
  put(vg, vcol(softBox(0.1, 0.04, 0.07, 0.015, 0.0, 0.002, 1), 0xf6d3a8), M.vc, 0.28, 0.785, -0.15);
  // mirror cabinet
  rb(vg, M.walnut, 0.9, 0.72, 0.13, 0, 1.55, -vd / 2 + 0.065 - 0.0, 0.01, 2);
  put(vg, prep(new THREE.PlaneGeometry(0.86, 0.68), true), M.mirror, 0, 1.55, -vd / 2 + 0.131);
  noShadow(rb(vg, M.lamp, 0.7, 0.025, 0.04, 0, 1.92, -vd / 2 + 0.08, 0.01, 1));
  box3(S, vx - vw / 2, FL, BZ + 0.06, vx + vw / 2, FL + 0.76, BZ + 0.06 + vd);
  // shower booth in the back-east corner
  const sx0 = 5.05, sz1 = 0.85, sx1 = IX, sz0 = BZ + 0.06;
  rb(root, M.ceramic, sx1 - sx0, 0.06, sz1 - sz0, (sx0 + sx1) / 2, FL + 0.03, (sz0 + sz1) / 2, 0.015, 2);
  put(root, cyl(0.04, 0.04, 0.004, 20), M.chrome, (sx0 + sx1) / 2, FL + 0.062, (sz0 + sz1) / 2);
  const gh = 2.0;
  noShadow(slab(root, M.glass, sx0, FL + 0.06, sz0, sx0 + 0.01, FL + 0.06 + gh, sz1));
  noShadow(slab(root, M.glass, sx0, FL + 0.06, sz1 - 0.01, sx1, FL + 0.06 + gh, sz1));
  rod(root, M.chrome, [sx0, FL + 0.06 + gh, sz0], [sx0, FL + 0.06 + gh, sz1], 0.012, 8);
  rod(root, M.chrome, [sx0, FL + 0.06 + gh, sz1], [sx1, FL + 0.06 + gh, sz1], 0.012, 8);
  rod(root, M.chrome, [sx0, FL + 0.06, sz1], [sx0, FL + 0.06 + gh, sz1], 0.012, 8);
  rod(root, M.chrome, [sx0 + 0.55, FL + 0.95, sz1 + 0.01], [sx0 + 0.55, FL + 1.25, sz1 + 0.01], 0.01, 8);
  // shower head and mixer on the east wall
  rod(root, M.chrome, [IX, FL + 2.05, 0.25], [IX - 0.32, FL + 2.08, 0.25], 0.012, 10);
  put(root, cyl(0.11, 0.11, 0.015, 28), M.chrome, IX - 0.34, FL + 2.065, 0.25);
  rod(root, M.chrome, [IX - 0.03, FL + 1.0, 0.25], [IX - 0.03, FL + 2.05, 0.25], 0.012, 10);
  rb(root, M.chrome, 0.05, 0.16, 0.09, IX - 0.025, FL + 1.1, 0.25, 0.015, 2);
  rod(root, M.chrome, [IX - 0.06, FL + 1.12, 0.25], [IX - 0.12, FL + 1.12, 0.25], 0.012, 8);
  // niche shelf with bottles
  rb(root, M.marble, 0.08, 0.02, 0.4, IX - 0.04, FL + 1.25, -0.08, 0.004, 1);
  [[0xf2c14e, 0.0], [0x7ac0a8, 0.1], [0xe86f8a, -0.11]].forEach(([c, dz], i) => put(root, vcol(lathe([[0, 0], [0.026, 0], [0.028, 0.15 - i * 0.02], [0.012, 0.165 - i * 0.02], [0.012, 0.19 - i * 0.02], [0, 0.19 - i * 0.02]], 14), c), M.vcg, IX - 0.045, FL + 1.26, -0.08 + dz));
  box3(S, sx0, FL, sz0, sx1, FL + 2.1, sz1);
  // bath mat in front of the shower
  put(root, softBox(0.7, 0.02, 0.45, 0.008, 0.0, 0.002, 4), M.towel, 5.6, FL + 0.01, sz1 + 0.35);
  // toilet against the east wall facing -X
  const tg = group(root, IX, FL, 2.0, -Math.PI / 2);
  rb(tg, M.ceramic, 0.42, 0.38, 0.18, 0, 0.62, 0.09, 0.03, 3);
  rb(tg, M.ceramic, 0.44, 0.04, 0.2, 0, 0.82, 0.09, 0.015, 2);
  rb(tg, M.chrome, 0.05, 0.015, 0.03, 0, 0.845, 0.09, 0.006, 1);
  const bowl = lathe([[0, 0], [0.12, 0], [0.16, 0.12], [0.19, 0.3], [0.2, 0.4], [0.17, 0.4], [0.15, 0.3], [0, 0.28]], 28);
  bowl.scale(0.95, 1, 1.25);
  put(tg, bowl, M.ceramic, 0, 0, 0.42);
  put(tg, torus(0.165, 0.025, 10, 28), M.ceramic, 0, 0.415, 0.42, Math.PI / 2, 0, 0).scale.set(0.95, 1.25, 1);
  rb(tg, M.ceramic, 0.38, 0.03, 0.06, 0, 0.43, 0.2, 0.01, 1);
  box3(S, IX - 0.72, FL, 1.78, IX, FL + 0.8, 2.22);
  // toilet paper holder
  rod(root, M.chrome, [IX, FL + 0.75, 2.45], [IX - 0.12, FL + 0.75, 2.45], 0.006, 8);
  put(root, cyl(0.055, 0.055, 0.1, 18), M.whitePl, IX - 0.08, FL + 0.69, 2.45, 0, 0, Math.PI / 2);
  // heated towel ladder with towels on partition A (bathroom side)
  const tx = AX + 0.06, tz = 2.25;
  for (const s of [-1, 1]) rod(root, M.chrome, [tx + 0.06, FL + 0.35, tz + s * 0.25], [tx + 0.06, FL + 1.55, tz + s * 0.25], 0.014, 10);
  for (let i = 0; i < 7; i++) rod(root, M.chrome, [tx + 0.06, FL + 0.42 + i * 0.18, tz - 0.25], [tx + 0.06, FL + 0.42 + i * 0.18, tz + 0.25], 0.009, 8);
  put(root, softBox(0.05, 0.62, 0.48, 0.02, 0.0, 0.004, 2), M.towel, tx + 0.09, FL + 1.12, tz);
  put(root, softBox(0.045, 0.32, 0.36, 0.02, 0.0, 0.004, 3), M.towel, tx + 0.09, FL + 0.62, tz + 0.03);
  box3(S, AX + 0.06, FL, tz - 0.3, AX + 0.2, FL + 1.6, tz + 0.3);
  // laundry hamper + plant on the window sill + stool
  plant(root, M, 4.25, FL + 1.3, IZ1 - 0.03, 'snake', 0.55, 0xf2efe8, 6);
  const stool = group(root, 2.75, FL, 2.7);
  put(stool, cyl(0.16, 0.16, 0.035, 24), M.oak, 0, 0.45, 0);
  for (let i = 0; i < 3; i++) { const a = i * 2.094; rod(stool, M.oak, [Math.cos(a) * 0.1, 0.44, Math.sin(a) * 0.1], [Math.cos(a) * 0.16, 0.0, Math.sin(a) * 0.16], 0.014, 8); }
  for (let i = 0; i < 3; i++) put(stool, softBox(0.26, 0.03, 0.18, 0.012, 0.004, 0.003, i), M.towel, 0, 0.485 + i * 0.03, 0, 0, 0.15 * i, 0);
  box3(S, 2.58, FL, 2.53, 2.92, FL + 0.55, 2.87);
  // slim mosaic border around the room at hand height (skips the openings)
  const bandY = FL + 1.18, bandH = 0.06, bc2 = 0x5f7f8e;
  const band = (x0, z0, x1, z1) => vrb(root, M.vcg, bc2, Math.max(0.006, x1 - x0), bandH, Math.max(0.006, z1 - z0), (x0 + x1) / 2, bandY, (z0 + z1) / 2, 0.002, 1);
  band(AX + 0.06, IZ1 - 0.006, IX, IZ1);
  band(IX - 0.006, 0.85, IX, IZ1);
  band(AX + 0.06, BZ + 0.06, 5.05, BZ + 0.066);
  band(AX + 0.06, BZ + 0.066, AX + 0.066, BATH_DOOR.z0 - 0.07);
  band(AX + 0.06, BATH_DOOR.z1 + 0.07, AX + 0.066, 1.95); band(AX + 0.06, 2.55, AX + 0.066, IZ1 - 0.006);
  // little shelf above the toilet: spare rolls, a candle, a plant
  const sh2 = group(root, IX - 0.11, FL + 1.3, 2.0, -Math.PI / 2);
  rb(sh2, M.walnut, 0.6, 0.03, 0.2, 0, 0, 0, 0.006, 2);
  for (const x of [-0.2, -0.08]) put(sh2, cyl(0.055, 0.055, 0.1, 18), M.whitePl, x, 0.065, 0);
  put(sh2, vcol(cyl(0.035, 0.035, 0.07, 16), 0xe9dcc6), M.vcg, 0.08, 0.05, 0);
  put(sh2, vcol(cyl(0.004, 0.004, 0.015, 6), 0x222222), M.vcg, 0.08, 0.092, 0);
  plant(sh2, M, 0.2, 0.015, 0, 'bush', 0.45, 0xf2efe8, 16);
  ceilingLight(root, M, 4.27, 1.35, 0.18);
  S.lamps.push({ pos: [4.27, CL - 0.3, 1.35], color: 0xfff0d8, intensity: 10, range: 6 });
  S.interactables.push({ id: 'sink', label: '세수하기', pos: [vx, FL + 1.0, vz + 0.35], radius: 1.2 });
  S.interactables.push({ id: 'shower', label: '씻기', pos: [(sx0 + sx1) / 2, FL + 1.2, sz1 + 0.2], radius: 1.3 });
}

function buildKitchen(site, root, M) {
  const S = site;
  const cz0 = IZ0, cd = 0.6, cz1 = cz0 + cd, top = FL + 0.9;
  const kx0 = -5.3, kx1 = -0.4, sink = { x0: -2.8, x1: -2.0, z0: cz0 + 0.12, z1: cz0 + 0.5 };
  // base cabinets
  slab(root, M.white, kx0, FL + 0.1, cz0, kx1, top - 0.04, cz1 - 0.02);
  slab(root, M.charcoal, kx0 + 0.02, FL, cz0, kx1 - 0.02, FL + 0.1, cz1 - 0.07);
  const nDoors = Math.round((kx1 - kx0) / 0.6);
  const dw = (kx1 - kx0) / nDoors;
  for (let i = 0; i < nDoors; i++) {
    const x = kx0 + dw * (i + 0.5);
    const isOven = x > -4.65 && x < -3.95;
    if (isOven) {
      rb(root, M.black, dw - 0.008, 0.62, 0.022, x, FL + 0.43, cz1 - 0.009, 0.008, 2);
      rb(root, M.steel, dw - 0.1, 0.02, 0.03, x, FL + 0.68, cz1 + 0.02, 0.008, 1);
      rb(root, M.black, dw - 0.008, 0.1, 0.022, x, FL + 0.81, cz1 - 0.009, 0.006, 1);
      continue;
    }
    rb(root, M.white, dw - 0.008, 0.48, 0.022, x, FL + 0.36, cz1 - 0.009, 0.006, 1);
    rb(root, M.white, dw - 0.008, 0.2, 0.022, x, FL + 0.73, cz1 - 0.009, 0.006, 1);
    rb(root, M.charcoal, 0.22, 0.014, 0.02, x, FL + 0.8, cz1 + 0.009, 0.006, 1);
    rb(root, M.charcoal, 0.014, 0.16, 0.02, x + dw / 2 - 0.06, FL + 0.5, cz1 + 0.009, 0.006, 1);
  }
  // countertop with a sink hole
  const ct = (x0, z0, x1, z1) => slab(root, M.marble, x0, top - 0.04, z0, x1, top, z1);
  ct(kx0, cz0, sink.x0, cz1 + 0.02); ct(sink.x1, cz0, kx1, cz1 + 0.02);
  ct(sink.x0, cz0, sink.x1, sink.z0); ct(sink.x0, sink.z1, sink.x1, cz1 + 0.02);
  // sink basin (steel) and faucet
  slab(root, M.steel, sink.x0, top - 0.22, sink.z0, sink.x1, top - 0.2, sink.z1);
  slab(root, M.steel, sink.x0, top - 0.22, sink.z0, sink.x0 + 0.01, top - 0.002, sink.z1);
  slab(root, M.steel, sink.x1 - 0.01, top - 0.22, sink.z0, sink.x1, top - 0.002, sink.z1);
  slab(root, M.steel, sink.x0, top - 0.22, sink.z0, sink.x1, top - 0.002, sink.z0 + 0.01);
  slab(root, M.steel, sink.x0, top - 0.22, sink.z1 - 0.01, sink.x1, top - 0.002, sink.z1);
  put(root, cyl(0.035, 0.035, 0.004, 16), M.chrome, (sink.x0 + sink.x1) / 2, top - 0.197, (sink.z0 + sink.z1) / 2);
  const fx = (sink.x0 + sink.x1) / 2, fz = cz0 + 0.06;
  rod(root, M.chrome, [fx, top, fz], [fx, top + 0.32, fz], 0.016, 12);
  const neck = new THREE.QuadraticBezierCurve3(new THREE.Vector3(fx, top + 0.32, fz), new THREE.Vector3(fx, top + 0.42, fz + 0.12), new THREE.Vector3(fx, top + 0.24, fz + 0.22));
  put(root, tube(neck, 0.012, 16, 10), M.chrome);
  rod(root, M.chrome, [fx + 0.05, top + 0.1, fz], [fx + 0.05, top + 0.16, fz + 0.06], 0.008, 8);
  // cooktop (black glass) with burner rings + pan
  const kx = -4.3;
  vrb(root, M.vcg, 0x111214, 0.62, 0.012, 0.5, kx, top + 0.006, cz0 + 0.3, 0.006, 1);
  for (const [dx, dz, r] of [[-0.15, 0.1, 0.09], [0.15, 0.1, 0.07], [-0.15, -0.12, 0.07], [0.15, -0.12, 0.09]]) put(root, vcol(torus(r, 0.003, 4, 32), 0x6a6c70), M.vcg, kx + dx, top + 0.0125, cz0 + 0.3 + dz, Math.PI / 2, 0, 0);
  const pan = group(root, kx - 0.15, top + 0.012, cz0 + 0.4);
  put(pan, lathe([[0, 0], [0.11, 0], [0.12, 0.01], [0.125, 0.045], [0.118, 0.045], [0.112, 0.012], [0, 0.008]], 28), M.black, 0, 0, 0);
  rod(pan, M.black, [0.12, 0.04, 0], [0.32, 0.06, 0.05], 0.012, 8);
  // range hood
  const hy = FL + 1.6;
  const hood = lathe([[0.0, 0], [0.42, 0], [0.42, 0.06], [0.16, 0.28], [0.0, 0.28]], 4);
  hood.rotateY(Math.PI / 4);
  hood.scale(1.05, 1, 0.75);
  put(root, hood, M.steel, kx, hy, cz0 + 0.3);
  slab(root, M.steel, kx - 0.14, hy + 0.27, cz0, kx + 0.14, CL, cz0 + 0.24);
  noShadow(put(root, cyl(0.03, 0.03, 0.004, 12), M.lamp, kx + 0.15, hy - 0.002, cz0 + 0.3));
  noShadow(put(root, cyl(0.03, 0.03, 0.004, 12), M.lamp, kx - 0.15, hy - 0.002, cz0 + 0.3));
  // backsplash tile
  wallRun(root, M.wallTile, 'x', kx0, kx1, cz0, cz0 + 0.012, top, FL + 1.45, [{ a: -3.1, b: -1.7, lo: FL + 1.1, hi: 9 }]);
  // upper cabinets (around hood and window)
  const uy0 = FL + 1.45, uy1 = FL + 2.25, ud = 0.34;
  for (const [x0, x1] of [[kx0, -4.68], [-3.92, -3.18], [-1.62, kx1]]) {
    slab(root, M.white, x0, uy0, cz0, x1, uy1, cz0 + ud - 0.022);
    const n = Math.max(1, Math.round((x1 - x0) / 0.45)), w = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const x = x0 + w * (i + 0.5);
      rb(root, M.white, w - 0.008, uy1 - uy0 - 0.008, 0.022, x, (uy0 + uy1) / 2, cz0 + ud - 0.011, 0.006, 1);
      rb(root, M.charcoal, 0.014, 0.14, 0.02, x + (i % 2 ? -1 : 1) * (w / 2 - 0.05), uy0 + 0.12, cz0 + ud + 0.009, 0.005, 1);
    }
    noShadow(slab(root, M.lamp, x0 + 0.05, uy0 - 0.01, cz0 + ud - 0.08, x1 - 0.05, uy0, cz0 + ud - 0.05));
  }
  // counter clutter: kettle, dish rack, cutting board, utensils, oil, knife block, toaster
  const kt = group(root, -1.0, top, cz0 + 0.28);
  put(kt, vcol(lathe([[0, 0], [0.09, 0], [0.095, 0.02], [0.085, 0.16], [0.05, 0.2], [0, 0.2]], 24), 0xe9dcc6), M.vcg, 0, 0, 0);
  put(kt, torus(0.07, 0.012, 8, 16, Math.PI), M.black, 0, 0.19, 0, 0, Math.PI / 2, 0);
  rod(kt, M.vcg, [0.08, 0.1, 0], [0.13, 0.17, 0], 0.012, 8).geometry.setAttribute('color', vcol(cyl(1, 1, 1, 8), 0xe9dcc6).attributes.color);
  put(kt, cyl(0.11, 0.11, 0.015, 24), M.black, 0, -0.005, 0);
  const rack = group(root, -1.6, top, cz0 + 0.3);
  rb(rack, M.steel, 0.42, 0.012, 0.32, 0, 0.006, 0, 0.004, 1);
  for (let i = 0; i < 6; i++) rod(rack, M.steel, [-0.18 + i * 0.07, 0.01, -0.14], [-0.18 + i * 0.07, 0.12, -0.14], 0.003, 4);
  for (let i = 0; i < 3; i++) put(rack, cyl(0.12, 0.08, 0.012, 24), M.ceramic, -0.12 + i * 0.06, 0.13, -0.05, 1.25, 0, 0);
  mug(rack, M, 0.14, 0.012, 0.08, 0x86a08a, 0.6);
  const cb = group(root, -3.5, top, cz0 + 0.33, 0.12);
  rb(cb, M.oak, 0.42, 0.022, 0.28, 0, 0.011, 0, 0.01, 2);
  for (let i = 0; i < 4; i++) put(cb, vcol(cyl(0.022, 0.022, 0.01, 14), 0xf08a3c), M.vcg, -0.12 + i * 0.03, 0.026, 0.05);
  put(cb, vcol(sphere(0.04, 14, 10), 0xe94b3c), M.vcg, 0.12, 0.06, -0.06);
  rb(cb, M.steel, 0.2, 0.004, 0.035, -0.02, 0.025, -0.07, 0.002, 1).rotation.y = 0.3;
  rb(cb, M.black, 0.1, 0.018, 0.022, -0.16, 0.03, -0.1, 0.006, 1).rotation.y = 0.3;
  const ut = group(root, -4.95, top, cz0 + 0.2);
  put(ut, cyl(0.06, 0.055, 0.15, 20), M.ceramic, 0, 0.075, 0);
  for (let i = 0; i < 4; i++) rod(ut, i % 2 ? M.oak : M.black, [0, 0.03, 0], [Math.cos(i * 1.7) * 0.05, 0.3, Math.sin(i * 1.7) * 0.04], 0.008, 6);
  for (const [x, c, h] of [[-5.15, 0xd8b04a, 0.24], [-5.08, 0x4f7a3a, 0.2]]) put(root, vcol(lathe([[0, 0], [0.03, 0], [0.03, h * 0.7], [0.012, h * 0.85], [0.012, h], [0, h]], 14), c), M.vcg, x, top, cz0 + 0.42);
  const kb = group(root, -3.75, top, cz0 + 0.12, -0.2);
  rb(kb, M.walnut, 0.12, 0.2, 0.1, 0, 0.1, 0, 0.01, 2).rotation.x = -0.25;
  for (let i = 0; i < 3; i++) rb(kb, M.black, 0.02, 0.07, 0.03, -0.03 + i * 0.03, 0.24, -0.02, 0.006, 1);
  box3(S, kx0, FL, cz0, kx1, top, cz1 + 0.02);
  // window sill herbs
  for (let i = 0; i < 3; i++) plant(root, M, -2.85 + i * 0.45, FL + 1.1, IZ0 + 0.03, i === 1 ? 'trail' : 'bush', 0.55, [0xc8724a, 0xf2efe8, 0x86a08a][i], 7 + i);
  // fridge in the back-west corner with magnets and a drawing
  const fg = group(root, -5.82, FL, cz0 + 0.38);
  rb(fg, M.steel, 0.86, 1.86, 0.74, 0, 0.93, 0, 0.02, 2);
  rb(fg, M.steel, 0.42, 1.1, 0.03, -0.215, 1.31, 0.38, 0.01, 2);
  rb(fg, M.steel, 0.42, 1.1, 0.03, 0.215, 1.31, 0.38, 0.01, 2);
  rb(fg, M.steel, 0.85, 0.68, 0.03, 0, 0.38, 0.38, 0.01, 2);
  for (const s of [-1, 1]) rb(fg, M.charcoal, 0.025, 0.5, 0.03, s * 0.03, 1.1, 0.41, 0.008, 1);
  rb(fg, M.charcoal, 0.5, 0.025, 0.03, 0, 0.66, 0.41, 0.008, 1);
  const dr = group(fg, 0.2, 1.42, 0.397, 0.05);
  put(dr, cellQuad('drawing', 0.24, 0.24), M.atlas, 0, 0, 0);
  for (const [x, y, c] of [[-0.1, 0.1, 0xe94b3c], [0.1, 0.1, 0x3d9be9]]) put(dr, vcol(cyl(0.015, 0.015, 0.01, 12), c), M.vcg, x, y, 0.006, Math.PI / 2, 0, 0);
  put(fg, cellQuad('note', 0.09, 0.09), M.atlas, -0.22, 1.55, 0.397);
  put(fg, vcol(cyl(0.012, 0.012, 0.01, 12), 0xf7c548), M.vcg, -0.22, 1.59, 0.402, Math.PI / 2, 0, 0);
  box3(S, -IX, FL, cz0, -5.38, FL + 1.86, cz0 + 0.76);
  // sideboard + coffee machine + toaster + fruit + calendar + clock on the back wall
  const sg = group(root, 0.85, FL, IZ0 + 0.23);
  rb(sg, M.walnut, 1.6, 0.7, 0.45, 0, 0.42, 0, 0.012, 2);
  for (let i = 0; i < 4; i++) rb(sg, M.oak, 0.39, 0.62, 0.02, -0.6 + i * 0.4, 0.42, 0.226, 0.006, 1);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) rb(sg, M.charcoal, 0.03, 0.08, 0.03, sx * 0.74, 0.04, sz * 0.18, 0.006, 1);
  // coffee machine
  const cm = group(sg, -0.45, 0.77, -0.02);
  rb(cm, M.black, 0.24, 0.34, 0.3, 0, 0.17, 0, 0.02, 2);
  rb(cm, M.steel, 0.2, 0.05, 0.12, 0, 0.27, 0.12, 0.01, 1);
  rb(cm, M.steel, 0.16, 0.02, 0.12, 0, 0.03, 0.12, 0.006, 1);
  mug(cm, M, 0, 0.04, 0.12, 0xf2efe8);
  // toaster
  const ts = group(sg, -0.05, 0.77, 0.0);
  vrb(ts, M.vcg, 0xe7b8a0, 0.26, 0.18, 0.15, 0, 0.09, 0, 0.035, 3);
  for (const s of [-1, 1]) rb(ts, M.black, 0.18, 0.01, 0.025, 0, 0.181, s * 0.03, 0.004, 1);
  rb(ts, M.chrome, 0.02, 0.03, 0.03, 0.14, 0.12, 0, 0.006, 1);
  // fruit bowl
  const fb = group(sg, 0.45, 0.77, 0.02);
  put(fb, lathe([[0, 0], [0.08, 0], [0.16, 0.06], [0.17, 0.08], [0.16, 0.08], [0.08, 0.015], [0, 0.015]], 28), M.ceramic, 0, 0, 0);
  [[0, 0.05, 0, 0xe94b3c, 0.045], [0.06, 0.05, 0.03, 0xf2a03a, 0.042], [-0.06, 0.05, 0.02, 0x9ac84a, 0.04], [0.02, 0.09, -0.04, 0xe94b3c, 0.042]].forEach(([x, y, z, c, r]) => put(fb, vcol(sphere(r, 14, 10), c), M.vcg, x, y, z));
  put(fb, vcol(capsule(0.025, 0.14, 4, 10), 0xf3d34a), M.vcg, -0.03, 0.1, 0.05, 0, 0.4, Math.PI / 2 - 0.3);
  plant(sg, M, 0.68, 0.77, -0.08, 'trail', 0.9, 0xf2efe8, 3);
  put(root, cellBox('calendar', 0.36, 0.5, 0.005), M.atlas, 0.95, FL + 1.55, IZ0 + 0.003);
  rod(root, M.charcoal, [0.95, FL + 1.82, IZ0], [0.95, FL + 1.82, IZ0 + 0.02], 0.004, 6);
  const clk = group(root, 0.1, FL + 1.75, IZ0);
  put(clk, cyl(0.17, 0.17, 0.04, 40), M.oak, 0, 0, 0.02, Math.PI / 2, 0, 0);
  put(clk, prep(toCell(new THREE.CircleGeometry(0.15, 40), 'clock'), true), M.atlas, 0, 0, 0.0405);
  box3(S, 0.05, FL, IZ0, 1.65, FL + 0.8, IZ0 + 0.46);
  // tall bookcase on partition A facing the dining table
  const bc = group(root, AX - 0.06 - 0.18, FL, -3.75, -Math.PI / 2);
  const bcw = 1.8, bch = 2.1, bcd = 0.34;
  for (const x of [-bcw / 2 + 0.015, bcw / 2 - 0.015, 0]) rb(bc, M.walnut, 0.03, bch, bcd, x, bch / 2, 0, 0.006, 1);
  for (let i = 0; i < 6; i++) rb(bc, M.walnut, bcw, 0.03, bcd, 0, 0.06 + i * 0.4, 0, 0.006, 1);
  rb(bc, M.walnut, bcw, bch - 0.04, 0.012, 0, bch / 2, -bcd / 2 + 0.006, 0.004, 1);
  bookRow(bc, M, -0.87, 0.075, 0.02, 0.85, 11, 0.24);
  bookRow(bc, M, 0.02, 0.075, 0.02, 0.5, 12, 0.24);
  vrb(bc, M.vc, 0xd9cdb8, 0.26, 0.2, 0.26, 0.7, 0.175, 0.0, 0.02, 2);
  bookRow(bc, M, -0.87, 0.475, 0.02, 0.55, 13, 0.24);
  plant(bc, M, -0.15, 0.475, 0.0, 'trail', 1.0, 0xf2efe8, 14);
  picture(bc, M, 'photo1', 0.45, 0.6, -0.06, 0.26, 0.2, 0, 0xc09060, 0.015).rotation.x = -0.08;
  bookRow(bc, M, 0.02, 0.875, 0.02, 0.85, 15, 0.24);
  for (let i = 0; i < 3; i++) vrb(bc, M.vc, [0x86a08a, 0xd9825b, 0xefe6d6][i], 0.2, 0.16, 0.24, -0.7 + i * 0.25, 0.97, 0.02, 0.02, 2);
  bookRow(bc, M, -0.87, 1.275, 0.02, 0.4, 16, 0.24);
  put(bc, vcol(sphere(0.1, 20, 14), 0x3d6aa8), M.vcg, -0.2, 1.39, 0.0);
  put(bc, cyl(0.03, 0.05, 0.02, 16), M.walnut, -0.2, 1.285, 0.0);
  bookRow(bc, M, 0.02, 1.275, 0.02, 0.6, 17, 0.24);
  plant(bc, M, 0.75, 1.675, 0.0, 'bush', 0.6, 0xc8724a, 15);
  bookRow(bc, M, -0.87, 1.675, 0.02, 0.7, 18, 0.24);
  picture(bc, M, 'photo3', 0.3, 1.82, -0.06, 0.24, 0.2, 0, 0x2b2b2b, 0.015).rotation.x = -0.08;
  box3(S, AX - 0.06 - 0.36, FL, -3.75 - bcw / 2, AX - 0.06, FL + bch, -3.75 + bcw / 2);
  // trash bins
  for (const [x, c] of [[-0.2, 0xf2efe8], [-0.2 + 0.0, 0xf2efe8]].slice(0, 1)) {
    put(root, vcol(rbox(0.26, 0.5, 0.32, 0.04, 2), c), M.vcg, x - 0.02, FL + 0.25, IZ0 + 0.2);
    rb(root, M.steel, 0.2, 0.02, 0.03, x - 0.02, FL + 0.44, IZ0 + 0.37, 0.006, 1);
  }
  ceilingLight(root, M, -3.0, -4.05, 0.2);

  // dining table + chairs + pendant + breakfast
  const tx = -2.4, tz = -2.5, tw = 1.4, td = 0.85, th = FL + 0.75;
  const tg = group(root, tx, FL, tz);
  rb(tg, M.oak, tw, 0.045, td, 0, 0.7275, 0, 0.012, 2);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    rod(tg, M.oak, [sx * (tw / 2 - 0.12), 0, sz * (td / 2 - 0.1)], [sx * (tw / 2 - 0.14), 0.705, sz * (td / 2 - 0.12)], 0.022, 10);
  }
  rb(tg, M.oak, tw - 0.3, 0.06, 0.03, 0, 0.67, td / 2 - 0.12, 0.008, 1);
  rb(tg, M.oak, tw - 0.3, 0.06, 0.03, 0, 0.67, -td / 2 + 0.12, 0.008, 1);
  box3(S, tx - tw / 2, FL, tz - td / 2, tx + tw / 2, th, tz + td / 2);
  const chairs = [[-0.35, 1], [0.35, 1], [-0.35, -1], [0.35, -1]];
  for (const [cx, side] of chairs) {
    const cg = group(root, tx + cx + (side < 0 ? 0.03 : -0.02), FL, tz + side * 0.62, side > 0 ? Math.PI : 0);
    if (side > 0 && cx < 0) cg.position.z += 0.08; // the player's chair, pulled out
    chair(cg, M, M.oak, M.fabBeige);
    const p = cg.position;
    box3(S, p.x - 0.22, FL, p.z - 0.22, p.x + 0.22, FL + 0.5, p.z + 0.22);
  }
  // placemats, napkin holder, vase with flowers, salt & pepper
  for (const [x, z] of [[-0.35, 0.22], [0.35, -0.22]]) put(tg, vcol(rbox(0.4, 0.004, 0.28, 0.002, 1), 0xb9a88c), M.vc, x, 0.752, z);
  const vase = group(tg, 0.05, 0.75, 0.0);
  noShadow(put(vase, lathe([[0, 0], [0.04, 0], [0.05, 0.05], [0.03, 0.14], [0.02, 0.18], [0, 0.18]], 20), M.glass, 0, 0, 0));
  for (let i = 0; i < 5; i++) {
    const a = i * 1.26, tip = [Math.cos(a) * 0.08, 0.32 + (i % 2) * 0.05, Math.sin(a) * 0.06];
    rod(vase, M.vc, [0, 0.05, 0], tip, 0.003, 4).geometry.setAttribute('color', vcol(cyl(1, 1, 1, 4), 0x5f8a3a).attributes.color);
    put(vase, vcol(sphere(0.026, 10, 8), [0xf4f1ea, 0xf7c548, 0xe8546b][i % 3]), M.vc, ...tip).scale.set(1, 0.7, 1);
  }
  for (const [x, c] of [[0.3, 0xf2efe8], [0.36, 0x333333]]) put(tg, vcol(lathe([[0, 0], [0.018, 0], [0.02, 0.06], [0.012, 0.075], [0, 0.075]], 12), c), M.vcg, x, 0.75, 0.05);
  // the breakfast (dynamic: hidden after eating)
  const food = new THREE.Group();
  food.userData.dynamic = true;
  food.position.set(tx - 0.35, th, tz + 0.2);
  root.add(food);
  put(food, lathe([[0, 0], [0.08, 0], [0.12, 0.012], [0.13, 0.02], [0.12, 0.02], [0.08, 0.008], [0, 0.008]], 32), M.ceramic, 0, 0.004, 0);
  for (const [x, y, z, ry, rx] of [[-0.03, 0.022, 0.0, 0.3, 0], [0.01, 0.046, 0.02, 0.75, 0.12]]) {
    const tg2 = group(food, x, y, z, ry); tg2.rotation.x = rx;
    put(tg2, vcol(softBox(0.115, 0.024, 0.11, 0.011, 0.0, 0.001, 3), 0xa8692e), M.vc, 0, 0, 0);
    put(tg2, vcol(softBox(0.098, 0.006, 0.093, 0.003, 0.0, 0.0015, 4), 0xe5b468), M.vc, 0, 0.0115, 0);
    put(tg2, vcol(softBox(0.06, 0.003, 0.05, 0.002, 0.0, 0.001, 5), 0xf6d77a), M.vc, 0.01, 0.0148, -0.01);
  }
  // fried egg on its own small plate
  const eg = group(food, 0.2, 0.004, -0.05);
  put(eg, lathe([[0, 0], [0.06, 0], [0.09, 0.01], [0.095, 0.016], [0.088, 0.016], [0.06, 0.006], [0, 0.006]], 28), M.ceramic, 0, 0, 0);
  const white = displace(new THREE.CircleGeometry(0.065, 24).rotateX(-Math.PI / 2), (x, y, z) => 0.004 * Math.sin(x * 70) * Math.cos(z * 60));
  put(eg, vcol(white, 0xfbf8f0), M.vcg, 0, 0.012, 0);
  put(eg, vcol(sphere(0.022, 16, 10), 0xf6b21b), M.vcg, 0.01, 0.014, 0.005).scale.set(1, 0.5, 1);
  // milk glass + spoon + fork + jam
  noShadow(put(food, lathe([[0, 0], [0.032, 0], [0.036, 0.13], [0.033, 0.13], [0.029, 0.006], [0, 0.006]], 24), M.glass, -0.17, 0, -0.08));
  put(food, vcol(cyl(0.029, 0.03, 0.1, 20), 0xf8f6f0), M.vcg, -0.17, 0.056, -0.08);
  rb(food, M.chrome, 0.012, 0.004, 0.14, 0.15, 0.003, 0.08, 0.002, 1);
  put(food, sphere(0.018, 12, 8), M.chrome, 0.15, 0.004, 0.0).scale.set(1, 0.3, 1.4);
  const jam = group(food, 0.1, 0, 0.12);
  put(jam, vcol(cyl(0.025, 0.025, 0.05, 16), 0xb0303a), M.vcg, 0, 0.025, 0);
  put(jam, vcol(cyl(0.027, 0.027, 0.012, 16), 0xf2efe8), M.vcg, 0, 0.055, 0);
  bake(food);
  S.extra.breakfastFood = food;
  // milk carton and cereal box stay on the table
  put(tg, cellBox('milk', 0.07, 0.19, 0.07), M.atlas, -0.62, 0.845, -0.12, 0, 0.5, 0);
  put(tg, cellBox('cereal', 0.19, 0.27, 0.06), M.atlas, -0.15, 0.885, -0.3, 0, 0.15, 0);
  // pendant lamp
  rod(root, M.charcoal, [tx, CL, tz], [tx, FL + 2.08, tz], 0.004, 6);
  put(root, lathe([[0.015, 0], [0.04, 0.0], [0.15, -0.14], [0.16, -0.16], [0.15, -0.16], [0.03, -0.012], [0.015, -0.012]], 32), M.doorPaint, tx, FL + 2.09, tz);
  noShadow(put(root, sphere(0.045, 16, 10), M.lamp, tx, FL + 1.98, tz));
  put(root, cyl(0.06, 0.06, 0.02, 20), M.charcoal, tx, CL - 0.01, tz);
  S.lamps.push({ pos: [tx, FL + 1.85, tz], color: 0xffd9a8, intensity: 10, range: 6 });
  S.lamps.push({ pos: [-3.0, CL - 0.3, -4.05], color: 0xfff0d8, intensity: 10, range: 6 });
  S.interactables.push({ id: 'fridge', label: '간식 먹기', pos: [-5.82, FL + 1.3, cz0 + 0.95], radius: 1.3 });
  S.interactables.push({ id: 'breakfast', label: '아침 먹기', pos: [tx - 0.35, th + 0.2, tz + 0.35], radius: 1.3, seat: { pos: [tx - 0.35, FL + 1.18, tz + 0.75], yaw: 0, pitch: -0.5 } });
}

function buildLiving(site, root, M) {
  const S = site;
  // 아트월: vertical oak slats on a dark backing behind the TV
  const aw0 = -0.35, aw1 = 2.35, ay0 = FL + 0.08, ay1 = CL - 0.06;
  slab(root, M.charcoal, -IX, ay0, aw0, -IX + 0.015, ay1, aw1);
  for (let z = aw0 + 0.012; z < aw1 - 0.03; z += 0.062) rb(root, M.oak, 0.03, ay1 - ay0, 0.034, -IX + 0.03, (ay0 + ay1) / 2, z + 0.017, 0.005, 1);
  rb(root, M.oak, 0.045, 0.04, aw1 - aw0, -IX + 0.0225, ay1 - 0.02, (aw0 + aw1) / 2, 0.006, 1);
  // media console + TV on the west wall
  const cx = -IX + 0.28, cz = 1.0;
  const cg = group(root, cx, FL, cz, Math.PI / 2); // local +Z → +X
  rb(cg, M.walnut, 1.9, 0.42, 0.44, 0, 0.29, 0, 0.012, 2);
  for (let i = 0; i < 3; i++) rb(cg, M.oak, 0.62, 0.36, 0.02, -0.63 + i * 0.63, 0.29, 0.221, 0.006, 1);
  for (const sx of [-1, 1]) rb(cg, M.charcoal, 0.03, 0.08, 0.3, sx * 0.85, 0.04, 0, 0.006, 1);
  // game console + controller + speaker + plant + photo
  rb(cg, M.whitePl, 0.28, 0.06, 0.2, 0.55, 0.53, -0.02, 0.015, 2);
  rb(cg, M.black, 0.27, 0.004, 0.19, 0.55, 0.562, -0.02, 0.004, 1);
  const pad = group(cg, 0.1, 0.5, 0.1, 0.4);
  put(pad, vcol(capsule(0.03, 0.1, 4, 10), 0x2b2f36), M.vcg, 0, 0.03, 0, 0, 0, Math.PI / 2);
  for (const [x, c] of [[0.04, 0xe94b3c], [0.06, 0x3d9be9]]) put(pad, vcol(sphere(0.008, 8, 6), c), M.vcg, x, 0.06, 0.01);
  rb(cg, M.fabGray, 0.14, 0.22, 0.14, -0.78, 0.61, -0.05, 0.03, 2);
  put(cg, cellBox('game', 0.17, 0.11, 0.015), M.atlas, 0.3, 0.505, 0.05, -Math.PI / 2, 0, 0.2);
  plant(cg, M, -0.5, 0.5, 0.02, 'bush', 0.9, 0x86a08a, 5);
  picture(cg, M, 'photo1', 0.82, 0.5 + 0.12, -0.1, 0.22, 0.17, 0, 0xf2efe8, 0.015).rotation.x = -0.12;
  box3(S, -IX, FL, cz - 0.95, -IX + 0.51, FL + 0.5, cz + 0.95);
  // TV mounted on the slat wall
  const tv = group(root, -IX + 0.05, FL + 1.3, cz, Math.PI / 2);
  rb(tv, M.black, 1.3, 0.76, 0.045, 0, 0, 0.0225, 0.008, 2);
  put(tv, prep(new THREE.PlaneGeometry(1.26, 0.71), true), M.tv, 0, 0, 0.0455);
  S.extra.tvScreen = M.tv;
  // rug, sofa, cushions, throw
  put(root, rbox(3.4, 0.014, 2.6, 0.006, 1), M.rug, -3.6, FL + 0.007, 1.0);
  const sx = -2.3, sz = 1.0;
  const sg = group(root, sx, FL, sz, -Math.PI / 2); // local +Z (front) → -X
  rb(sg, M.fabGray, 2.3, 0.22, 0.92, 0, 0.21, 0, 0.04, 2);
  for (const s of [-1, 1]) put(sg, softBox(0.18, 0.62, 0.92, 0.07, 0.0, 0.003, 3 + s), M.fabGray, s * 1.06, 0.36, 0);
  put(sg, softBox(2.2, 0.62, 0.22, 0.08, 0.0, 0.003, 9), M.fabGray, 0, 0.5, -0.36);
  for (let i = 0; i < 3; i++) {
    put(sg, softBox(0.62, 0.17, 0.66, 0.07, 0.03, 0.004, i), M.fabGray, -0.64 + i * 0.64, 0.41, 0.08);
    put(sg, softBox(0.62, 0.48, 0.2, 0.08, 0.02, 0.005, i + 4), M.fabGray, -0.64 + i * 0.64, 0.7, -0.2, -0.12, 0, 0);
  }
  for (const [sx2, sz2] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rb(sg, M.walnut, 0.05, 0.1, 0.05, sx2 * 1.05, 0.05, sz2 * 0.38, 0.01, 1);
  cushion(sg, M, M.mustard, -0.85, 0.72, -0.05, 0.42, 0.42, 0.25, -0.35, 1);
  cushion(sg, M, M.fabGreen, 0.82, 0.72, -0.06, 0.42, 0.42, -0.3, -0.3, 2);
  cushion(sg, M, M.linen, 0.45, 0.68, -0.02, 0.36, 0.36, 0.15, -0.4, 3);
  // throw draped over the right arm
  put(sg, softBox(0.3, 0.03, 0.7, 0.012, 0.004, 0.006, 4), M.fabBeige, 1.0, 0.68, 0.05, 0, 0, -0.12);
  put(sg, softBox(0.03, 0.42, 0.7, 0.012, 0.0, 0.008, 5), M.fabBeige, 1.17, 0.47, 0.05, 0, 0, 0.05);
  box3(S, sx - 0.46, FL, sz - 1.15, sx + 0.46, FL + 0.8, sz + 1.15);
  // coffee table with mug, remote, magazines
  const ctg = group(root, -3.75, FL, 1.0);
  rb(ctg, M.oak, 0.6, 0.04, 1.1, 0, 0.42, 0, 0.015, 2);
  rb(ctg, M.oak, 0.54, 0.025, 1.0, 0, 0.13, 0, 0.01, 1);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rb(ctg, M.walnut, 0.04, 0.42, 0.04, a * 0.26, 0.21, b * 0.5, 0.008, 1);
  mug(ctg, M, 0.1, 0.44, 0.25, 0xc4553e, 2);
  put(ctg, cellBox('magazine', 0.21, 0.28, 0.008), M.atlas, -0.08, 0.444, -0.2, -Math.PI / 2, 0, 0.3);
  put(ctg, cellBox('magazine', 0.21, 0.28, 0.008), M.atlas, -0.06, 0.452, -0.22, -Math.PI / 2, 0, 0.1);
  rb(ctg, M.black, 0.045, 0.015, 0.16, 0.12, 0.448, -0.05, 0.006, 1).rotation.y = 0.5;
  bookRow(ctg, M, -0.22, 0.155, 0.0, 0.42, 5, 0.14);
  box3(S, -4.05, FL, 0.45, -3.45, FL + 0.44, 1.55);
  // low bookshelf behind the sofa with frames and a plant
  const bs = group(root, -1.55, FL, 1.0, Math.PI / 2);
  rb(bs, M.oak, 2.0, 0.03, 0.34, 0, 0.75, 0, 0.008, 2);
  rb(bs, M.oak, 2.0, 0.03, 0.34, 0, 0.38, 0, 0.008, 1);
  rb(bs, M.oak, 2.0, 0.03, 0.34, 0, 0.03, 0, 0.008, 1);
  for (const x of [-0.985, 0, 0.985]) rb(bs, M.oak, 0.03, 0.75, 0.34, x, 0.39, 0, 0.006, 1);
  rb(bs, M.oak, 1.96, 0.72, 0.012, 0, 0.39, -0.165, 0.004, 1);
  bookRow(bs, M, -0.96, 0.045, 0.0, 0.9, 2, 0.24);
  bookRow(bs, M, 0.02, 0.045, 0.0, 0.6, 7, 0.24);
  bookRow(bs, M, -0.96, 0.395, 0.0, 0.5, 4, 0.24);
  put(bs, vcol(rbox(0.2, 0.2, 0.2, 0.03, 2), 0xd9cdb8), M.vc, 0.5, 0.495, 0.0);
  put(bs, vcol(sphere(0.07, 16, 10), 0x2f4858), M.vcg, 0.8, 0.465, 0.02);
  picture(bs, M, 'photo3', -0.5, 0.88, 0.0, 0.24, 0.2, 0, 0x2b2b2b, 0.015).rotation.x = -0.1;
  picture(bs, M, 'photo4', -0.2, 0.86, 0.02, 0.2, 0.16, 0, 0xc09060, 0.01).rotation.x = -0.1;
  plant(bs, M, 0.65, 0.765, 0.0, 'trail', 1.1, 0xe9e4da, 9);
  put(bs, vcol(lathe([[0, 0], [0.05, 0], [0.06, 0.08], [0.03, 0.22], [0.025, 0.26], [0, 0.26]], 18), 0x86a08a), M.vcg, 0.15, 0.765, 0.02);
  box3(S, -1.72, FL, 0.0, -1.38, FL + 0.8, 2.0);
  // floor lamp next to the sofa (arc)
  const fl = group(root, -2.5, FL, 2.6);
  put(fl, cyl(0.16, 0.17, 0.03, 28), M.charcoal, 0, 0.015, 0);
  rod(fl, M.charcoal, [0, 0.03, 0], [0, 1.45, 0], 0.012);
  put(fl, cyl(0.17, 0.2, 0.28, 28, true), M.linen, 0, 1.52, 0);
  noShadow(put(fl, sphere(0.05, 12, 8), M.lamp, 0, 1.47, 0));
  box3(S, -2.7, FL, 2.4, -2.3, FL + 1.7, 2.8);
  // armchair by the front window
  const ac = group(root, -5.4, FL, 2.45, Math.PI * 0.82);
  rb(ac, M.oak, 0.72, 0.06, 0.72, 0, 0.2, 0, 0.015, 2);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rb(ac, M.oak, 0.04, 0.2, 0.04, a * 0.32, 0.1, b * 0.32, 0.008, 1);
  put(ac, softBox(0.64, 0.16, 0.6, 0.05, 0.03, 0.004, 2), M.fabGreen, 0, 0.3, 0.04);
  put(ac, softBox(0.64, 0.55, 0.16, 0.06, 0.02, 0.004, 3), M.fabGreen, 0, 0.58, -0.28, -0.15, 0, 0);
  for (const s of [-1, 1]) put(ac, softBox(0.1, 0.3, 0.66, 0.04, 0.0, 0.003, 4), M.fabGreen, s * 0.33, 0.4, 0.0);
  book(ac, M, 0.05, 0.38, 0.1, 0.15, 0.03, 0.21, 0x3d6aa8).rotation.set(0, 0.6, Math.PI / 2);
  box3(S, -5.8, FL, 2.05, -5.0, FL + 0.8, 2.85);
  // big plant in the corner, plant by the TV
  plant(root, M, -5.95, FL, -0.35, 'fig', 1.0, 0xe9e4da, 2);
  box3(S, -6.2, FL, -0.6, -5.7, FL + 0.45, -0.1);
  plant(root, M, -1.35, FL, 2.7, 'snake', 1.1, 0x34383e, 4);
  // picture over the sofa side: poster on the front wall left of the window
  picture(root, M, 'poster2', -5.75, FL + 1.55, IZ1, 0.5, 0.66, Math.PI, 0xf2efe8, 0.0);
  ceilingLight(root, M, -3.6, 1.0, 0.26);
  S.lamps.push({ pos: [-3.6, CL - 0.3, 1.0], color: 0xffe2b8, intensity: 14, range: 8 });
  S.interactables.push({ id: 'tv', label: 'TV 보기', pos: [sx - 0.45, FL + 0.9, sz], radius: 1.6, seat: { pos: [sx - 0.05, FL + 1.12, sz], yaw: Math.PI / 2, pitch: -0.04 }, screen: { center: [-IX + 0.096, FL + 1.3, cz], w: 1.26, h: 0.71, yaw: -Math.PI / 2 } });
}

function buildEntry(site, root, M) {
  const S = site;
  // shoe cabinet against partition A (faces -X)
  const sx = AX - 0.06 - 0.19, z0 = 1.95, z1 = 3.0;
  const sg = group(root, sx, FL, (z0 + z1) / 2, -Math.PI / 2);
  rb(sg, M.white, z1 - z0, 0.84, 0.38, 0, 0.5, 0, 0.012, 2);
  for (let i = 0; i < 3; i++) {
    const w = (z1 - z0) / 3, x = -(z1 - z0) / 2 + w * (i + 0.5);
    rb(sg, M.oak, w - 0.008, 0.78, 0.02, x, 0.5, 0.19, 0.006, 1);
    rb(sg, M.charcoal, 0.014, 0.14, 0.02, x + w / 2 - 0.05, 0.62, 0.205, 0.004, 1);
  }
  rb(sg, M.oak, z1 - z0 + 0.02, 0.03, 0.4, 0, 0.935, 0, 0.008, 2);
  // things on top: key bowl, small plant, mail
  put(sg, lathe([[0, 0], [0.05, 0], [0.09, 0.03], [0.095, 0.035], [0.088, 0.035], [0.045, 0.006], [0, 0.006]], 24), M.ceramic, -0.25, 0.95, 0.0);
  rod(sg, M.gold ?? M.chrome, [-0.27, 0.962, 0.0], [-0.22, 0.962, 0.02], 0.004, 6);
  plant(sg, M, 0.35, 0.95, -0.05, 'snake', 0.55, 0xc8724a, 8);
  put(sg, vcol(rbox(0.22, 0.004, 0.11, 0.002, 1), 0xf3efe6), M.vc, 0.05, 0.952, 0.05).rotation.y = 0.2;
  box3(S, sx - 0.2, FL, z0, AX - 0.06, FL + 0.95, z1);
  // mirror above
  rb(root, M.oak, 0.03, 0.9, 0.55, AX - 0.075, FL + 1.55, 2.25, 0.01, 2);
  put(root, prep(new THREE.PlaneGeometry(0.49, 0.84), true), M.mirror, AX - 0.091, FL + 1.55, 2.25, 0, -Math.PI / 2, 0);
  // coat hooks with a coat and a bag (on the front wall left of the door)
  const hz = IZ1, hx0 = -0.32;
  rb(root, M.oak, 0.6, 0.08, 0.025, hx0 + 0.3, FL + 1.75, hz - 0.0125, 0.006, 1);
  for (let i = 0; i < 3; i++) rod(root, M.charcoal, [hx0 + 0.1 + i * 0.2, FL + 1.75, hz - 0.025], [hx0 + 0.1 + i * 0.2, FL + 1.8, hz - 0.1], 0.008, 6);
  const cm = textured('fabric', { color: 0x8a6a4e, seed: 22 }, 0.5, { normal: 0.7 });
  const coat = group(root, hx0 + 0.1, FL + 1.78, hz - 0.11);
  const body = softBox(0.4, 0.82, 0.1, 0.04, 0.0, 0.008, 2);
  { const p = body.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); const k = 1 + Math.max(0, -y) * 0.25; p.setX(i, p.getX(i) * k); } }
  put(coat, body, cm, 0, -0.5, 0.0);
  put(coat, softBox(0.42, 0.1, 0.12, 0.045, 0.0, 0.004, 3), cm, 0, -0.1, 0.0);
  put(coat, softBox(0.2, 0.09, 0.08, 0.03, 0.0, 0.004, 4), cm, 0, -0.04, 0.03, 0.3, 0, 0);
  for (const s2 of [-1, 1]) put(coat, capsule(0.045, 0.55, 4, 10), cm, s2 * 0.21, -0.45, 0.03, 0, 0, s2 * 0.05);
  for (let i = 0; i < 3; i++) put(coat, sphere(0.012, 8, 6), M.walnut, 0.02, -0.3 - i * 0.18, 0.06);
  const bag = group(root, hx0 + 0.5, FL + 1.78, hz - 0.1);
  put(bag, vcol(torus(0.09, 0.008, 6, 20, Math.PI), 0x2a2a2a), M.vc, 0, -0.08, 0, 0, 0, Math.PI);
  put(bag, vcol(softBox(0.32, 0.3, 0.1, 0.04, 0.01, 0.004, 5), 0x3b4f73), M.vc, 0, -0.32, 0.0);
  // shoes on the entry floor, umbrella stand
  shoe(root, M, 0.75, FL, 2.55, 0.2, 0xf2efe8, 0xd9d4ca);
  shoe(root, M, 0.88, FL, 2.5, 0.1, 0xf2efe8, 0xd9d4ca);
  shoe(root, M, 0.05, FL, 2.65, -0.3, 0x3b4f73, 0xf2efe8, 0.9);
  shoe(root, M, 0.17, FL, 2.7, -0.15, 0x3b4f73, 0xf2efe8, 0.9);
  shoe(root, M, 1.22, FL, 2.3, 1.6, 0xd9534f, 0xf2efe8, 0.85);
  const um = group(root, -0.05, FL, 2.25);
  put(um, cyl(0.1, 0.09, 0.45, 20, true), M.charcoal, 0, 0.225, 0);
  put(um, cyl(0.09, 0.09, 0.01, 20), M.charcoal, 0, 0.005, 0);
  const ub = group(um, 0.02, 0.03, 0.0); ub.rotation.z = -0.06;
  rod(ub, M.chrome, [0, 0, 0], [0, 0.1, 0], 0.005, 6);
  put(ub, vcol(displace(new THREE.LatheGeometry([[0.004, 0.08], [0.045, 0.2], [0.05, 0.4], [0.042, 0.62], [0.012, 0.72], [0.006, 0.74]].map(([r, y]) => new THREE.Vector2(r, y)), 10), (x, y, z) => 0.006 * Math.sin(Math.atan2(z, x) * 5)), 0x2f6fb7), M.vc, 0, 0, 0);
  rod(ub, M.black, [0, 0.74, 0], [0, 0.86, 0], 0.008, 6);
  put(ub, vcol(torus(0.035, 0.01, 6, 12, Math.PI), 0x6b4529), M.vcg, 0.035, 0.86, 0, 0, 0, 0);
  box3(S, -0.16, FL, 2.14, 0.06, FL + 0.5, 2.36);
  // entry mat inside the door
  put(root, vcol(rbox(0.9, 0.012, 0.55, 0.006, 1), 0x8a7a64), M.vc, 1.0, FL + 0.006, 2.7);
  // hallway pictures between the doorways (living side of partition A)
  picture(root, M, 'photo2', AX - 0.06, FL + 1.55, -0.6, 0.32, 0.24, -Math.PI / 2, 0x2b2b2b, 0.03);
  picture(root, M, 'photo1', AX - 0.06, FL + 1.55, -0.2, 0.32, 0.24, -Math.PI / 2, 0xc09060, 0.03);
  ceilingLight(root, M, 1.0, 1.0, 0.16);
  ceilingLight(root, M, 1.0, -2.6, 0.16);
  S.lamps.push({ pos: [1.0, CL - 0.3, 1.0], color: 0xffe2b8, intensity: 8, range: 6 });
}

// ------------------------------------------------------------------ entry point
export function buildHome(opts = {}) {
  const glowK = opts.glow ?? 1;
  const site = makeSite('home', 14, 12);
  const root = site.group;
  const M = materials(glowK);
  const T = [['start', performance.now()]];
  const mark = (n) => T.push([n, performance.now()]);
  buildShell(site, root, M); mark('shell');
  buildBedroom(site, root, M); mark('bedroom');
  buildBathroom(site, root, M); mark('bathroom');
  buildKitchen(site, root, M); mark('kitchen');
  buildLiving(site, root, M); mark('living');
  buildEntry(site, root, M); mark('entry');
  bake(root); mark('bake');
  site.extra.buildTiming = T.slice(1).map(([n, t], i) => `${n} ${(t - T[i][1]).toFixed(0)}ms`).join(', ');
  site.nightGlow.push(M.winGlow, M.porchGlow, M.pool);
  site.indoor.push({ min: [-IX, FL, IZ0], max: [IX, CL, IZ1] });
  site.spawn = { pos: [3.15, FL, -3.7], yaw: -2.0 };
  site.extra.floorY = FL;
  return site;
}
