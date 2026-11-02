// Street furniture for the town and the beach: street light, traffic light, bench, hydrant, bin,
// post box, fence, bus stop, signpost, parasol, deck chair, bollard and planter.
// Conventions: metres, y up, origin at the ground centre of the footprint, the side people use or
// read faces +Z. Every builder returns a baked Group, or {group, ...} when the game needs handles.
// group.userData.colliders = [{min, max}] in local space (solid parts only), userData.footprint = {w, d}.
import * as THREE from 'three';
import { mat, paint, textured, glow } from '../mat.js';
import { rbox, cyl, sphere, torus, lathe, extrude, tube, quad, plane, prep, put, bake, displace } from '../geom.js';
import { canvasTex, FONT } from '../tex.js';
import { rng } from '../noise.js';

const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const once = (fn) => { let v; return () => (v ??= fn()); };

// ------------------------------------------------------------------ palette (shared, cached by mat.js)
const POLE = () => paint(0x404347, 0.5, 0.3); // powder-coated warm charcoal
const SILVER = () => paint(0xb7bdc4, 0.3, 0.85); // anodised aluminium
const BOLT = () => mat('darkSteel');
const signMat = (t, o = {}) => new THREE.MeshStandardMaterial({ map: t, roughness: o.rough ?? 0.45, metalness: 0, ...(o.alpha ? { alphaTest: 0.45 } : {}), ...(o.side ? { side: o.side } : {}) });

// ------------------------------------------------------------------ helpers
/** Curve through samples, one tube ring per sample (keeps tight bends round, straight runs cheap). */
class Poly extends THREE.Curve {
  constructor(pts) { super(); this.pts = pts; }
  getPoint(t, out = new THREE.Vector3()) {
    const n = this.pts.length - 1, f = Math.min(n - 1e-6, Math.max(0, t * n)), i = Math.floor(f);
    return out.copy(this.pts[i]).lerp(this.pts[i + 1], f - i);
  }
  getPointAt(u, out) { return this.getPoint(u, out); }
  getTangent(t, out = new THREE.Vector3()) {
    const n = this.pts.length - 1, i = Math.round(Math.min(1, Math.max(0, t)) * n);
    return out.copy(this.pts[Math.min(n, i + 1)]).sub(this.pts[Math.max(0, i - 1)]).normalize();
  }
  getTangentAt(u, out) { return this.getTangent(u, out); }
}
/** Polyline with rounded corners (bent steel tube). */
function bentTube(pts, r, bend = 0.07, rs = 10, k = 6) {
  const P = pts.map((p) => V(...p)), s = [P[0].clone()];
  for (let i = 1; i < P.length - 1; i++) {
    const a = P[i - 1], b = P[i], c = P[i + 1];
    const r1 = Math.min(bend, a.distanceTo(b) * 0.45), r2 = Math.min(bend, b.distanceTo(c) * 0.45);
    const p1 = b.clone().add(a.clone().sub(b).normalize().multiplyScalar(r1));
    const p2 = b.clone().add(c.clone().sub(b).normalize().multiplyScalar(r2));
    const q = new THREE.QuadraticBezierCurve3(p1, b, p2);
    for (let j = 0; j <= k; j++) s.push(q.getPoint(j / k));
  }
  s.push(P[P.length - 1].clone());
  return tube(new Poly(s), r, s.length - 1, rs);
}
const curveTube = (curve, r, seg = 24, rs = 10) => tube(curve, r, seg, rs);
/** Straight rod between two points. */
function rod(parent, a, b, r, material, rs = 10) {
  return put(parent, tube(new THREE.LineCurve3(V(...a), V(...b)), r, 1, rs), material);
}
/** Planar 0..1 UVs over (w, h) centred on (cu, cv) using position components ax, ay. */
function planarUV(geo, ax, ay, cu, cv, w, h, flip = false) {
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const a = (p.getComponent(i, ax) - cu) / w, b = (p.getComponent(i, ay) - cv) / h;
    uv.setXY(i, (flip ? -a : a) + 0.5, b + 0.5);
  }
  uv.needsUpdate = true;
  return geo;
}
/** Wood grain along local axis (0 x, 1 y, 2 z): u runs along it on every face (tex grain follows u). */
function grain(geo, axis) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const na = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2;
    if (na === axis) continue;
    const other = 3 - na - axis;
    uv.setXY(i, p.getComponent(i, axis), p.getComponent(i, other));
  }
  uv.needsUpdate = true;
  return geo;
}
/** quad(w, h) showing pixel rect [x, y, w, h] of a W x H canvas atlas. */
function atlasQuad(w, h, [px, py, pw, ph], W, H) {
  const g = quad(w, h), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (px + uv.getX(i) * pw) / W, 1 - (py + (1 - uv.getY(i)) * ph) / H);
  }
  return g;
}
/** Curved label wrapped on a pole of radius r, centred on +Z, showing an atlas rect. */
function wrapLabel(r, arcLen, h, rect, W, H) {
  const th = arcLen / r;
  const g = prep(new THREE.CylinderGeometry(r, r, h, 12, 1, true, -th / 2, th), true), uv = g.attributes.uv;
  const [px, py, pw, ph] = rect;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (px + uv.getX(i) * pw) / W, 1 - (py + (1 - uv.getY(i)) * ph) / H);
  return g;
}
/** Hex nut + stud. */
function nut(parent, x, y, z, s = 0.014, rx = 0, rz = 0) {
  const m = put(parent, cyl(s, s, s * 0.9, 6), BOLT(), x, y, z, rx, 0.3, rz);
  put(parent, cyl(s * 0.55, s * 0.55, s * 1.6, 10), BOLT(), x, y, z, rx, 0, rz);
  return m;
}
/** Concrete collar, base flange and four anchor bolts (pole foot). */
function poleFoot(g, collarR = 0.3, plate = 0.32) {
  put(g, lathe([[0, 0], [collarR, 0], [collarR, 0.022], [collarR - 0.016, 0.04], [0, 0.04]], 40), mat('concrete'));
  put(g, rbox(plate, 0.024, plate, 0.008, 2), BOLT(), 0, 0.052, 0);
  const o = plate / 2 - 0.035;
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) nut(g, x * o, 0.071, z * o);
  return 0.064; // top of plate
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function text(ctx, s, x, y, size, color, align = 'center', weight = '') {
  ctx.font = `${weight}${size}px ${FONT}`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}
/** Seamless canvas noise wash so printed surfaces are never perfectly flat. */
function grime(ctx, x, y, w, h, a = 0.05, seed = 1) {
  const R = rng(seed);
  for (let i = 0; i < (w * h) / 900; i++) {
    ctx.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${a * R()})`;
    const s = 2 + R() * 10;
    ctx.fillRect(x + R() * w, y + R() * h, s, s * (0.3 + R()));
  }
}

// ------------------------------------------------------------------ canvases (made once)
const lightTags = once(() => canvasTex(256, 256, (c) => {
  // ID plate (top) + a lost-cat poster (bottom)
  c.fillStyle = '#f2c534'; rr(c, 4, 4, 248, 92, 10); c.fill();
  c.strokeStyle = '#1d1d1d'; c.lineWidth = 4; rr(c, 10, 10, 236, 80, 8); c.stroke();
  text(c, '가로등', 128, 34, 28, '#1d1d1d');
  text(c, '행복 12-07', 128, 68, 30, '#1d1d1d');
  c.fillStyle = '#fbf8ef'; c.fillRect(0, 104, 256, 152);
  grime(c, 0, 104, 256, 152, 0.06, 4);
  text(c, '고양이를 찾아요', 128, 128, 30, '#c0392b');
  // cat drawing
  c.fillStyle = '#e39a3b';
  c.beginPath(); c.arc(128, 182, 30, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(102, 168); c.lineTo(106, 140); c.lineTo(124, 156); c.fill();
  c.beginPath(); c.moveTo(154, 168); c.lineTo(150, 140); c.lineTo(132, 156); c.fill();
  c.fillStyle = '#222'; c.beginPath(); c.arc(117, 180, 4, 0, TAU); c.arc(139, 180, 4, 0, TAU); c.fill();
  c.strokeStyle = '#222'; c.lineWidth = 2; c.beginPath(); c.moveTo(122, 194); c.quadraticCurveTo(128, 199, 134, 194); c.stroke();
  text(c, '이름: 치즈 · 노란 줄무늬', 128, 226, 17, '#333');
  c.strokeStyle = '#bbb'; c.lineWidth = 1;
  for (let i = 0; i < 9; i++) { const x = 6 + i * 27.5; c.beginPath(); c.moveTo(x, 240); c.lineTo(x, 256); c.stroke(); }
}));
const ledPanel = once(() => canvasTex(128, 256, (c) => {
  c.fillStyle = '#8a8478'; c.fillRect(0, 0, 128, 256);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) {
    const cx = 18 + x * 30.7, cy = 18 + y * 31.4;
    const gr = c.createRadialGradient(cx, cy, 1, cx, cy, 13);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, '#fff3dc'); gr.addColorStop(1, '#a39b8c');
    c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, 13, 0, TAU); c.fill();
  }
}));
const lensDots = once(() => canvasTex(128, 128, (c) => {
  c.fillStyle = '#5a5a5a'; c.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
    const cx = 8 + x * 14 + (y % 2) * 7, cy = 8 + y * 14;
    if (Math.hypot(cx - 64, cy - 64) > 60) continue;
    const gr = c.createRadialGradient(cx, cy, 0, cx, cy, 6.5);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#6a6a6a');
    c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, 6.5, 0, TAU); c.fill();
  }
}));
const signalSigns = once(() => canvasTex(512, 256, (c) => {
  // road name sign (blue)
  c.fillStyle = '#1d4f9c'; c.fillRect(0, 0, 512, 128);
  c.strokeStyle = '#fff'; c.lineWidth = 5; rr(c, 8, 8, 496, 112, 10); c.stroke();
  text(c, '행복로', 190, 56, 62, '#fff');
  text(c, 'Haengbok-ro', 190, 100, 22, '#dfe8f7');
  c.fillStyle = '#fff'; c.fillRect(352, 22, 4, 84);
  text(c, '1→99', 430, 64, 38, '#fff');
  // push button label
  c.fillStyle = '#f3c623'; rr(c, 0, 140, 168, 108, 14); c.fill();
  text(c, '보행자', 84, 176, 30, '#222');
  text(c, '누르세요', 84, 216, 32, '#222');
}));
const binLabels = once(() => canvasTex(512, 64, (c) => {
  c.fillStyle = '#5d646b'; c.fillRect(0, 0, 252, 64);
  c.fillStyle = '#2f8a57'; c.fillRect(260, 0, 252, 64);
  // bin icon
  c.fillStyle = '#fff'; c.fillRect(22, 22, 26, 30); c.fillRect(18, 16, 34, 5); c.fillRect(30, 11, 10, 5);
  text(c, '일반쓰레기', 150, 34, 32, '#fff');
  // recycle arrows
  c.strokeStyle = '#fff'; c.lineWidth = 5;
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3 - Math.PI / 2;
    c.beginPath(); c.arc(300, 32, 17, a + 0.25, a + 1.7); c.stroke();
    const ex = 300 + Math.cos(a + 1.85) * 17, ey = 32 + Math.sin(a + 1.85) * 17;
    c.fillStyle = '#fff'; c.beginPath(); c.arc(ex, ey, 5, 0, TAU); c.fill();
  }
  text(c, '재활용', 410, 34, 34, '#fff');
}));
const postLabels = once(() => {
  const t = canvasTex(512, 512, (c) => {
    c.clearRect(0, 0, 512, 512);
    // slot labels (opaque)
    c.fillStyle = '#fbf7ee'; rr(c, 0, 0, 512, 90, 12); c.fill();
    text(c, '일반우편', 128, 46, 44, '#c8201c');
    text(c, '빠른우편', 384, 46, 44, '#c8201c');
    c.fillStyle = '#c8201c'; c.fillRect(254, 14, 4, 62);
    // "우체통" white lettering (transparent background)
    text(c, '우체통', 256, 170, 104, '#ffffff');
    c.fillStyle = '#fff'; c.fillRect(96, 236, 320, 8);
    // collection time plate (opaque)
    c.fillStyle = '#f5f3ee'; rr(c, 40, 280, 432, 200, 16); c.fill();
    c.strokeStyle = '#c8201c'; c.lineWidth = 6; rr(c, 52, 292, 408, 176, 10); c.stroke();
    text(c, '우편물 수거 시간', 256, 334, 40, '#c8201c');
    text(c, '평일  15:00', 256, 392, 38, '#333');
    text(c, '토요일  11:00', 256, 440, 38, '#333');
  });
  return signMat(t, { alpha: true, rough: 0.35 });
});

// ------------------------------------------------------------------ street light
/**
 * streetLight({height, reach}) → {group, lampPos, glowMat}
 * Pole at the origin, the arm reaches towards +Z (over the road). lampPos = local centre just under
 * the LED lens; glowMat = the lens material (emissive, raise or lower its emissiveIntensity by time).
 */
export function streetLight({ height = 6.2, reach = 1.35 } = {}) {
  const g = new THREE.Group();
  g.name = 'streetLight';
  const pole = POLE();
  const top = poleFoot(g);
  // decorative base shroud
  put(g, lathe([[0.15, top], [0.156, top + 0.03], [0.15, top + 0.06], [0.126, top + 0.09], [0.116, top + 0.25], [0.11, top + 0.56], [0.118, top + 0.575], [0.118, top + 0.615], [0.1, top + 0.635], [0.084, top + 0.65]], 40), pole);
  // access door with keyhole
  put(g, rbox(0.075, 0.22, 0.03, 0.008, 2), pole, 0, 1.0, 0.07);
  put(g, cyl(0.007, 0.007, 0.012, 10), mat('chrome'), 0, 1.06, 0.086, Math.PI / 2);
  const poleTop = height - 0.65;
  const shaftY0 = top + 0.64;
  put(g, cyl(0.058, 0.084, poleTop - shaftY0, 32), pole, 0, (poleTop + shaftY0) / 2, 0);
  // ring detail at 2.6 m and the top collar
  put(g, torus(0.077, 0.008, 8, 32), pole, 0, 2.6, 0, Math.PI / 2);
  put(g, lathe([[0.062, poleTop - 0.04], [0.07, poleTop - 0.02], [0.07, poleTop + 0.05], [0.056, poleTop + 0.09], [0.045, poleTop + 0.1]], 32), pole);
  // curved arm
  const armEnd = V(0, height - 0.12, reach);
  const arm = new THREE.CubicBezierCurve3(V(0, poleTop - 0.05, 0), V(0, poleTop + 0.45, 0), V(0, height - 0.08, reach * 0.3), armEnd);
  put(g, curveTube(arm, 0.04, 28, 12), pole);
  // LED head: a flattened elongated dome
  const hy = height - 0.12, hz = reach + 0.2;
  const head = lathe([[0, -0.035], [0.16, -0.035], [0.185, -0.028], [0.197, -0.012], [0.198, 0.005], [0.185, 0.03], [0.15, 0.055], [0.09, 0.072], [0, 0.078]], 40);
  head.scale(1, 1, 1.75);
  put(g, head, pole, 0, hy, hz);
  // cooling fins on top
  for (let i = -2; i <= 2; i++) put(g, rbox(0.012, 0.025, 0.36, 0.005, 2), pole, i * 0.04, hy + 0.07 - Math.abs(i) * 0.006, hz - 0.02);
  put(g, cyl(0.022, 0.026, 0.03, 16), pole, 0, hy + 0.085, hz - 0.22);
  put(g, sphere(0.02, 12, 8), mat('blackPlastic'), 0, hy + 0.1, hz - 0.22);
  // lens with LED grid
  const glowMat = glow(0xfff1d6, 2.4, ledPanel());
  const lens = cyl(0.15, 0.15, 0.012, 40);
  lens.scale(1, 1, 1.72);
  planarUV(lens, 0, 2, 0, 0, 0.3, 0.52);
  put(g, lens, glowMat, 0, hy - 0.038, hz);
  // bezel around the lens
  const bezel = torus(0.152, 0.008, 6, 40);
  bezel.rotateX(Math.PI / 2); bezel.scale(1, 1, 1.72);
  put(g, bezel, mat('darkSteel'), 0, hy - 0.036, hz);
  // tags: ID plate and a lost-cat poster
  const tm = signMat(lightTags(), { rough: 0.55 });
  const rAt = (y) => 0.084 + (0.058 - 0.084) * (y - shaftY0) / (poleTop - shaftY0);
  put(g, wrapLabel(rAt(2.15) + 0.002, 0.11, 0.045, [0, 0, 256, 96], 256, 256), tm, 0, 2.15, 0);
  put(g, wrapLabel(rAt(1.5) + 0.0015, 0.15, 0.09, [0, 104, 256, 152], 256, 256), tm, 0, 1.5, 0, 0, 0.5, 0);
  bake(g);
  const lampPos = [0, hy - 0.09, hz];
  g.userData.colliders = [{ min: [-0.16, 0, -0.16], max: [0.16, height - 0.6, 0.16] }];
  g.userData.footprint = { w: 0.6, d: 0.6 };
  g.userData.lamp = { pos: lampPos, color: 0xffe2b0, intensity: 1, range: 14 };
  return { group: g, lampPos, glowMat };
}

// ------------------------------------------------------------------ traffic light
/**
 * trafficLight({arm, road, roadEn}) → {group, setState(name), lenses}
 * Pole at the origin, arm along +X (length `arm`), lenses face +Z. Korean horizontal 3-lamp head
 * (red, yellow, green from left to right as seen from +Z) and a blue road-name sign on the arm.
 * setState('red'|'yellow'|'green') lights one lens (each traffic light has its own lens materials).
 */
export function trafficLight({ arm = 3.2 } = {}) {
  arm = Math.max(2.8, arm);
  const g = new THREE.Group();
  g.name = 'trafficLight';
  const pole = POLE();
  const top = poleFoot(g, 0.32, 0.34);
  const H = 5.6, armY = 5.25;
  put(g, lathe([[0.13, top], [0.13, top + 0.05], [0.11, top + 0.08], [0.1, top + 0.12]], 32), pole);
  put(g, cyl(0.075, 0.1, H - top - 0.12, 32), pole, 0, (H + top + 0.12) / 2, 0);
  put(g, lathe([[0.078, H - 0.02], [0.085, H], [0.07, H + 0.045], [0.03, H + 0.065], [0, H + 0.068]], 24), pole);
  // arm, brace and clamp collars
  put(g, cyl(0.045, 0.06, arm, 24), pole, arm / 2, armY, 0, 0, 0, -Math.PI / 2);
  put(g, sphere(0.046, 16, 10), pole, arm, armY, 0);
  rod(g, [0, armY - 0.5, -0.02], [0.52, armY - 0.035, -0.02], 0.022, pole);
  for (const y of [armY, armY - 0.5]) put(g, cyl(0.098, 0.098, 0.1, 24), pole, 0, y, 0);
  for (const y of [armY + 0.03, armY - 0.03]) for (const s of [-1, 1]) nut(g, 0.06 * s, y, 0.09, 0.011, Math.PI / 2);
  // signal head
  const hx = arm - 0.72, hy = armY - 0.36;
  const house = paint(0x23272c, 0.48, 0.25);
  put(g, rbox(1.14, 0.36, 0.24, 0.07, 3), house, hx, hy, 0);
  put(g, rbox(1.05, 0.3, 0.06, 0.04, 2), house, hx, hy, -0.13);
  for (const s of [-1, 1]) put(g, rbox(0.06, 0.16, 0.06, 0.015, 2), pole, hx + s * 0.38, armY - 0.12, 0);
  for (const s of [-1, 1]) put(g, cyl(0.062, 0.062, 0.05, 20), pole, hx + s * 0.38, armY, 0, 0, 0, Math.PI / 2);
  const dots = lensDots();
  const defs = { red: [0xff2a18, 0x4a120c], yellow: [0xffb000, 0x4a3608], green: [0x10e080, 0x0a3d26] };
  const lenses = {};
  const visor = new THREE.Shape();
  visor.absarc(0, 0, 0.152, -0.35, Math.PI + 0.35, false);
  visor.absarc(0, 0, 0.142, Math.PI + 0.35, -0.35, true);
  const visorGeo = extrude(visor, 0.2, 0.003);
  ['red', 'yellow', 'green'].forEach((name, i) => {
    const x = hx + (i - 1) * 0.36;
    const m = new THREE.MeshPhysicalMaterial({ color: defs[name][1], emissive: defs[name][0], emissiveMap: dots, emissiveIntensity: 0.02, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
    m.name = 'lens-' + name;
    lenses[name] = m;
    const lg = lathe([[0.126, 0], [0.124, 0.003], [0.1, 0.013], [0.06, 0.019], [0, 0.021]], 32);
    lg.rotateX(Math.PI / 2);
    planarUV(lg, 0, 1, 0, 0, 0.26, 0.26);
    put(g, lg, m, x, hy, 0.121);
    put(g, torus(0.13, 0.011, 8, 32), house, x, hy, 0.122);
    put(g, visorGeo, house, x, hy, 0.115);
  });
  // road-name sign hanging from the arm
  const atlas = signMat(signalSigns(), { rough: 0.4 });
  const sx = 0.62 + 0.47;
  put(g, rbox(0.94, 0.25, 0.03, 0.012, 2), paint(0x1d4f9c, 0.4, 0.2), sx, armY - 0.26, 0);
  put(g, atlasQuad(0.91, 0.23, [0, 0, 512, 128], 512, 256), atlas, sx, armY - 0.26, 0.0155);
  for (const s of [-1, 1]) {
    put(g, rbox(0.03, 0.12, 0.03, 0.008, 2), BOLT(), sx + s * 0.33, armY - 0.09, 0);
    put(g, cyl(0.064, 0.064, 0.035, 20), BOLT(), sx + s * 0.33, armY, 0, 0, 0, Math.PI / 2);
  }
  // pedestrian push button on the pole
  put(g, rbox(0.12, 0.17, 0.07, 0.02, 2), paint(0xe9bd1f, 0.45, 0.1), 0, 1.15, 0.1);
  put(g, atlasQuad(0.1, 0.064, [0, 140, 168, 108], 512, 256), atlas, 0, 1.19, 0.1355);
  put(g, cyl(0.022, 0.022, 0.02, 20), mat('chrome'), 0, 1.115, 0.135, Math.PI / 2);
  bake(g);
  function setState(name) {
    for (const [k, m] of Object.entries(lenses)) {
      const on = k === name;
      m.emissiveIntensity = on ? 4.2 : 0.02;
      m.color.set(on ? defs[k][0] : defs[k][1]);
    }
    api.state = name;
  }
  const api = { group: g, setState, lenses, state: 'red' };
  setState('red');
  g.userData.colliders = [{ min: [-0.18, 0, -0.18], max: [0.18, H, 0.18] }];
  g.userData.footprint = { w: 0.7, d: 0.7 };
  return api;
}

// ------------------------------------------------------------------ bench
/** bench({length}) → Group. Seat faces +Z, backrest at -Z, seat top y 0.45, length along X. */
export function bench({ length = 1.8 } = {}) {
  const g = new THREE.Group();
  g.name = 'bench';
  const frame = POLE(), wood = mat('oak'), L = length, fx = L / 2 - 0.17;
  // back line (z, y) from seat back to the top
  const b0 = [-0.17, 0.4], b1 = [-0.3, 0.86];
  for (const s of [-1, 1]) {
    const x = s * fx;
    put(g, bentTube([[x, 0.012, 0.25], [x, 0.41, 0.235], [x, 0.395, -0.17], [x, 0.86, -0.3]], 0.021, 0.07, 10, 6), frame);
    put(g, bentTube([[x, 0.012, -0.25], [x, 0.4, -0.165]], 0.021), frame);
    put(g, bentTube([[x, 0.41, 0.19], [x, 0.63, 0.19], [x, 0.63, -0.21], [x, 0.57, -0.235]], 0.017, 0.06, 10, 6), frame);
    put(g, sphere(0.021, 12, 8), frame, x, 0.86, -0.3);
    put(g, grain(rbox(0.06, 0.032, 0.4, 0.013, 2), 2), wood, x, 0.662, -0.01);
    for (const z of [0.25, -0.25]) {
      put(g, rbox(0.075, 0.012, 0.1, 0.004, 2), BOLT(), x, 0.006, z);
      for (const d of [-1, 1]) put(g, cyl(0.009, 0.009, 0.008, 6), BOLT(), x, 0.016, z + d * 0.035);
    }
  }
  // longitudinal rails under the seat
  for (const z of [0.2, -0.12]) put(g, rbox(2 * fx, 0.03, 0.025, 0.008, 2), frame, 0, 0.375, z);
  // seat slats
  const screws = mat('chrome');
  for (let i = 0; i < 5; i++) {
    const z = 0.21 - i * 0.087, y = 0.42 + 0.003 * Math.sin(i * 1.3);
    put(g, rbox(L, 0.03, 0.076, 0.011, 2), wood, 0, y + 0.015, z);
    for (const s of [-1, 1]) put(g, cyl(0.006, 0.006, 0.004, 8), screws, s * fx, y + 0.031, z);
  }
  // back slats, tilted along the back line
  const dz = b1[0] - b0[0], dy = b1[1] - b0[1], len = Math.hypot(dz, dy);
  const d = [dz / len, dy / len], n = [d[1], -d[0]], ang = Math.atan2(d[0], d[1]);
  for (const t of [0.42, 0.62, 0.82]) {
    const z = b0[0] + d[0] * len * t + n[0] * 0.037, y = b0[1] + d[1] * len * t + n[1] * 0.037;
    put(g, rbox(L, 0.085, 0.03, 0.011, 2), wood, 0, y, z, ang);
    for (const s of [-1, 1]) put(g, cyl(0.006, 0.006, 0.004, 8), screws, s * fx, y + n[1] * 0.016, z + n[0] * 0.016, Math.PI / 2 + ang);
  }
  bake(g);
  g.userData.colliders = [{ min: [-L / 2, 0, -0.3], max: [L / 2, 0.45, 0.27] }, { min: [-L / 2, 0.45, -0.34], max: [L / 2, 0.88, -0.2] }];
  g.userData.seats = [[-L / 4, 0.45, 0.05], [L / 4, 0.45, 0.05]];
  g.userData.footprint = { w: L, d: 0.6 };
  return g;
}

// ------------------------------------------------------------------ hydrant
/** hydrant() → Group. Korean red street hydrant with two side outlets (±X). */
export function hydrant() {
  const g = new THREE.Group();
  g.name = 'hydrant';
  const red = paint(0xb51912, 0.34, 0.05, { clearcoat: 0.7 });
  put(g, lathe([[0, 0], [0.175, 0], [0.175, 0.028], [0.16, 0.04], [0.124, 0.05], [0.118, 0.08], [0.114, 0.12], [0.114, 0.56], [0.124, 0.575], [0.126, 0.62], [0.116, 0.635], [0.132, 0.655], [0.132, 0.69], [0.115, 0.73], [0.08, 0.775], [0.04, 0.795], [0, 0.8]], 40), red);
  // flange bolts
  for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * TAU; nut(g, Math.cos(a) * 0.15, 0.034, Math.sin(a) * 0.15, 0.011); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; put(g, cyl(0.009, 0.009, 0.014, 6), BOLT(), Math.cos(a) * 0.124, 0.645, Math.sin(a) * 0.124); }
  // reflective band
  put(g, cyl(0.1165, 0.1165, 0.05, 40, true), paint(0xf2f2ea, 0.22, 0.3), 0, 0.3, 0);
  // operating nut on top
  put(g, cyl(0.026, 0.03, 0.045, 5), mat('steel'), 0, 0.82, 0);
  put(g, cyl(0.038, 0.038, 0.012, 24), red, 0, 0.8, 0);
  // two side outlets with caps and chains
  for (const s of [-1, 1]) {
    put(g, lathe([[0.058, 0], [0.058, 0.02], [0.046, 0.03], [0.044, 0.09], [0.05, 0.1], [0.05, 0.11]], 24), red, s * 0.1, 0.46, 0, 0, 0, -s * Math.PI / 2);
    put(g, lathe([[0.056, 0], [0.058, 0.01], [0.058, 0.045], [0.05, 0.055], [0, 0.056]], 24), red, s * 0.21, 0.46, 0, 0, 0, -s * Math.PI / 2);
    put(g, cyl(0.022, 0.022, 0.03, 5), mat('steel'), s * 0.275, 0.46, 0, 0, 0, Math.PI / 2);
    // chain from cap lug to the body
    const a = V(s * 0.235, 0.398, 0.012), b = V(s * 0.12, 0.395, 0.052);
    for (let i = 0; i < 7; i++) {
      const t = i / 6, p = a.clone().lerp(b, t);
      p.y -= Math.sin(Math.PI * t) * 0.045;
      put(g, torus(0.008, 0.0024, 5, 10), mat('steel'), p.x, p.y, p.z, i % 2 ? Math.PI / 2 : 0, s * 0.33, Math.PI / 2);
    }
    put(g, rbox(0.022, 0.018, 0.014, 0.005, 1), red, s * 0.235, 0.404, 0.012);
    put(g, rbox(0.014, 0.022, 0.022, 0.005, 1), red, s * 0.115, 0.398, 0.048);
  }
  bake(g);
  g.userData.colliders = [{ min: [-0.3, 0, -0.18], max: [0.3, 0.85, 0.18] }];
  g.userData.footprint = { w: 0.6, d: 0.36 };
  return g;
}

// ------------------------------------------------------------------ trash can
/** trashCan() → Group. Two-slot stainless street bin (일반쓰레기 / 재활용) with walnut cladding, slots face +Z. */
export function trashCan() {
  const g = new THREE.Group();
  g.name = 'trashCan';
  const steel = mat('steel'), dark = POLE(), wood = mat('walnut');
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) put(g, cyl(0.022, 0.026, 0.05, 12), BOLT(), x * 0.34, 0.025, z * 0.17);
  put(g, rbox(0.8, 0.05, 0.42, 0.015, 2), BOLT(), 0, 0.075, 0);
  put(g, rbox(0.78, 0.82, 0.4, 0.045, 3), steel, 0, 0.51, 0);
  // crowned lid
  put(g, rbox(0.82, 0.07, 0.44, 0.03, 3), dark, 0, 0.945, 0);
  put(g, rbox(0.72, 0.04, 0.34, 0.02, 2), dark, 0, 0.985, 0);
  // slots with hoods
  const hole = paint(0x0c0c0d, 0.95, 0);
  for (const s of [-1, 1]) {
    put(g, rbox(0.3, 0.15, 0.03, 0.03, 2), dark, s * 0.19, 0.79, 0.198);
    put(g, rbox(0.25, 0.1, 0.03, 0.025, 2), hole, s * 0.19, 0.79, 0.204);
    put(g, rbox(0.33, 0.018, 0.07, 0.008, 2), dark, s * 0.19, 0.872, 0.225);
  }
  // label strip
  put(g, atlasQuad(0.72, 0.09, [0, 0, 512, 64], 512, 64), signMat(binLabels(), { rough: 0.4 }), 0, 0.665, 0.2005);
  // walnut slats front, back and sides
  for (let i = 0; i < 7; i++) {
    const x = (i - 3) * 0.104;
    put(g, grain(rbox(0.09, 0.44, 0.02, 0.007, 2), 1), wood, x, 0.38, 0.209);
    put(g, grain(rbox(0.09, 0.44, 0.02, 0.007, 2), 1), wood, x, 0.38, -0.209);
  }
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) put(g, grain(rbox(0.02, 0.6, 0.095, 0.007, 2), 1), wood, s * 0.389, 0.46, (i - 1) * 0.11);
  bake(g);
  g.userData.colliders = [{ min: [-0.41, 0, -0.22], max: [0.41, 1.0, 0.22] }];
  g.userData.footprint = { w: 0.82, d: 0.44 };
  return g;
}

// ------------------------------------------------------------------ post box
/** mailbox() → Group. Red Korean post box (우체통) with two slots on the +Z face. */
export function mailbox() {
  const g = new THREE.Group();
  g.name = 'mailbox';
  const red = paint(0xc8201c, 0.3, 0.05, { clearcoat: 1 });
  const lab = postLabels();
  put(g, rbox(0.56, 0.1, 0.46, 0.025, 2), POLE(), 0, 0.05, 0);
  put(g, rbox(0.5, 0.98, 0.4, 0.035, 3), red, 0, 0.6, 0);
  // white band
  put(g, rbox(0.508, 0.035, 0.408, 0.038, 3), paint(0xf4f1ea, 0.3, 0), 0, 0.76, 0);
  // arched roof
  const arch = new THREE.Shape();
  arch.moveTo(-0.235, 0); arch.lineTo(0.235, 0); arch.quadraticCurveTo(0, 0.17, -0.235, 0);
  const roof = extrude(arch, 0.52, 0.012);
  roof.rotateY(-Math.PI / 2);
  put(g, roof, red, 0.26, 1.098, 0);
  // slots with rain lips
  for (const s of [-1, 1]) {
    put(g, rbox(0.17, 0.034, 0.02, 0.012, 2), mat('blackPlastic'), s * 0.11, 0.93, 0.196);
    put(g, rbox(0.2, 0.018, 0.05, 0.008, 2), red, s * 0.11, 0.958, 0.215);
  }
  put(g, atlasQuad(0.42, 0.074, [0, 0, 512, 90], 512, 512), lab, 0, 0.855, 0.2012);
  // collection door with keyhole and the 우체통 lettering
  put(g, rbox(0.42, 0.5, 0.012, 0.01, 2), red, 0, 0.4, 0.2);
  put(g, cyl(0.012, 0.012, 0.012, 16), mat('chrome'), 0.16, 0.6, 0.209, Math.PI / 2);
  put(g, rbox(0.004, 0.014, 0.004, 0.001, 1), mat('blackPlastic'), 0.16, 0.6, 0.215);
  put(g, atlasQuad(0.34, 0.15, [80, 104, 352, 152], 512, 512), lab, 0, 0.53, 0.2065);
  put(g, atlasQuad(0.2, 0.093, [40, 280, 432, 200], 512, 512), lab, 0, 0.29, 0.2065);
  for (const s of [-1, 1]) put(g, atlasQuad(0.3, 0.13, [80, 104, 352, 152], 512, 512), lab, s * 0.2512, 0.5, 0, 0, s * Math.PI / 2, 0);
  bake(g);
  g.userData.colliders = [{ min: [-0.28, 0, -0.23], max: [0.28, 1.2, 0.23] }];
  g.userData.footprint = { w: 0.56, d: 0.46 };
  return g;
}

// ------------------------------------------------------------------ fence
/**
 * fence(length = 4, {style}) → Group, running along X from -length/2 to +length/2, 1 m tall.
 * style 'picket' (white wooden pickets, default) or 'rail' (charcoal steel sidewalk railing).
 */
export function fence(length = 4, { style = 'picket' } = {}) {
  const g = new THREE.Group();
  g.name = 'fence';
  const L = Math.max(0.6, length), bays = Math.max(1, Math.ceil(L / 2)), bay = L / bays;
  if (style === 'rail') {
    const pole = POLE();
    for (let i = 0; i <= bays; i++) {
      const x = -L / 2 + i * bay;
      put(g, rbox(0.06, 1.0, 0.06, 0.015, 2), pole, x, 0.5, 0);
      put(g, sphere(0.04, 14, 8), pole, x, 1.0, 0);
      put(g, rbox(0.1, 0.012, 0.1, 0.004, 1), BOLT(), x, 0.006, 0);
      put(g, rbox(0.004, 0.08, 0.04, 0.002, 1), paint(0xf0d23a, 0.35, 0.1), x, 0.82, 0.03);
    }
    put(g, cyl(0.022, 0.022, L, 16), pole, 0, 0.94, 0, 0, 0, Math.PI / 2);
    put(g, rbox(L, 0.04, 0.03, 0.01, 2), pole, 0, 0.16, 0);
    put(g, rbox(L, 0.03, 0.025, 0.008, 2), pole, 0, 0.78, 0);
    const n = Math.round(L / 0.12);
    for (let i = 1; i < n; i++) {
      const x = -L / 2 + i * (L / n);
      if (Math.abs(((x + L / 2) / bay) - Math.round((x + L / 2) / bay)) * bay < 0.05) continue;
      put(g, cyl(0.009, 0.009, 0.6, 8), pole, x, 0.47, 0);
    }
  } else {
    const white = mat('whiteWood');
    const pw = 0.075, ph = 0.92, pt = 0.022;
    const s = new THREE.Shape();
    s.moveTo(-pw / 2, 0); s.lineTo(pw / 2, 0); s.lineTo(pw / 2, ph - pw / 2); s.absarc(0, ph - pw / 2, pw / 2, 0, Math.PI, false); s.lineTo(-pw / 2, 0);
    const pg = prep(new THREE.ExtrudeGeometry(s, { depth: pt, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1, curveSegments: 5 }).translate(0, 0, -pt / 2));
    const R = rng(Math.round(L * 100));
    for (let i = 0; i <= bays; i++) {
      const x = -L / 2 + i * bay;
      put(g, rbox(0.09, 1.0, 0.09, 0.012, 2), white, x, 0.5, -0.035);
      put(g, cyl(0, 0.07, 0.06, 4), white, x, 1.03, -0.035, 0, Math.PI / 4, 0);
      put(g, rbox(0.11, 0.02, 0.11, 0.006, 2), white, x, 1.0, -0.035);
    }
    for (const y of [0.26, 0.74]) put(g, rbox(L, 0.07, 0.028, 0.008, 2), white, 0, y, -0.038);
    const n = Math.max(2, Math.round(L / 0.13));
    for (let i = 0; i < n; i++) {
      const x = -L / 2 + (i + 0.5) * (L / n);
      if (Math.abs(((x + L / 2) / bay) - Math.round((x + L / 2) / bay)) * bay < 0.07) continue;
      put(g, pg, white, x, 0.05 + R() * 0.012, 0, 0, 0, (R() - 0.5) * 0.012);
    }
  }
  bake(g);
  g.userData.colliders = [{ min: [-L / 2, 0, -0.08], max: [L / 2, 1.0, 0.04] }];
  g.userData.footprint = { w: L, d: 0.12 };
  return g;
}

// ------------------------------------------------------------------ bus stop
const busPrint = once(() => canvasTex(1024, 1024, (c) => {
  // route map (0,0,640,480)
  c.fillStyle = '#fbfaf6'; c.fillRect(0, 0, 640, 480);
  c.fillStyle = '#1d4f9c'; c.fillRect(0, 0, 640, 64);
  text(c, '노선 안내도', 320, 34, 38, '#fff');
  const stops = ['행복마을', '꽃길초교', '중앙시장', '시청', '바다공원', '해변'];
  const line = (y, col, num, skip) => {
    c.strokeStyle = col; c.lineWidth = 12; c.lineCap = 'round';
    c.beginPath(); c.moveTo(60, y); c.lineTo(590, y); c.stroke();
    c.fillStyle = col; rr(c, 14, y - 22, 40, 44, 8); c.fill();
    text(c, num, 34, y + 1, 24, '#fff');
    stops.forEach((s, i) => {
      if (skip.includes(i)) return;
      const x = 80 + i * 100;
      c.fillStyle = '#fff'; c.strokeStyle = col; c.lineWidth = 6;
      c.beginPath(); c.arc(x, y, 12, 0, TAU); c.fill(); c.stroke();
    });
  };
  line(150, '#3aa655', '7', []);
  line(290, '#2f6fd0', '12', [1]);
  line(420, '#e2752c', '720', [1, 2]);
  stops.forEach((s, i) => text(c, s, 80 + i * 100, i % 2 ? 228 : 205, 22, '#333'));
  c.fillStyle = '#d23a2a'; c.beginPath(); c.arc(80, 150, 18, 0, TAU); c.fill();
  text(c, '여기', 80, 108, 24, '#d23a2a');
  text(c, '해변 방향 →', 520, 360, 22, '#777');
  // timetable (0,500,640,400)
  c.fillStyle = '#fbfaf6'; c.fillRect(0, 500, 640, 400);
  c.fillStyle = '#3a3f46'; c.fillRect(0, 500, 640, 60);
  text(c, '첫차 · 막차 시간', 320, 531, 34, '#fff');
  [['7', '05:30', '23:40', '#3aa655'], ['12', '05:50', '23:10', '#2f6fd0'], ['720', '06:00', '22:30', '#e2752c']].forEach(([n, a, b, col], i) => {
    const y = 610 + i * 90;
    c.fillStyle = col; rr(c, 40, y - 30, 110, 60, 10); c.fill();
    text(c, n, 95, y + 2, 34, '#fff');
    text(c, `첫차 ${a}`, 290, y, 34, '#333');
    text(c, `막차 ${b}`, 500, y, 34, '#333');
  });
  c.fillStyle = '#ddd'; for (let i = 0; i < 2; i++) c.fillRect(30, 655 + i * 90, 580, 2);
  // stop totem panel (660,0,364,720)
  c.fillStyle = '#1d4f9c'; c.fillRect(660, 0, 364, 720);
  c.fillStyle = '#fff'; rr(c, 690, 30, 304, 150, 18); c.fill();
  // bus pictogram
  c.fillStyle = '#1d4f9c'; rr(c, 782, 52, 120, 84, 14); c.fill();
  c.fillStyle = '#fff'; c.fillRect(796, 64, 42, 30); c.fillRect(846, 64, 42, 30);
  c.fillStyle = '#1d4f9c'; c.beginPath(); c.arc(804, 140, 12, 0, TAU); c.arc(880, 140, 12, 0, TAU); c.fill();
  text(c, '버스', 842, 165, 26, '#1d4f9c');
  text(c, '행복마을', 842, 240, 64, '#fff');
  text(c, 'Haengbok Village', 842, 296, 28, '#cfdcf2');
  text(c, '12-345', 842, 340, 30, '#9fb6e0');
  [['7', '#3aa655'], ['12', '#2f6fd0'], ['720', '#e2752c']].forEach(([n, col], i) => {
    const y = 420 + i * 92;
    c.fillStyle = col; rr(c, 700, y - 36, 284, 72, 12); c.fill();
    text(c, n, 842, y + 2, 44, '#fff');
  });
  // tactile paving strip (0,920,1024,104)
  c.fillStyle = '#e8b524'; c.fillRect(0, 920, 1024, 104);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 80; x++) {
    const cx = 6 + x * 12.8, cy = 928 + y * 12.6;
    const gr = c.createRadialGradient(cx - 1.5, cy - 1.5, 0.5, cx, cy, 5);
    gr.addColorStop(0, '#fff2b0'); gr.addColorStop(0.7, '#e2ad1c'); gr.addColorStop(1, '#b8860e');
    c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, 4.5, 0, TAU); c.fill();
  }
}));
const busGlow = once(() => canvasTex(1024, 1024, (c) => {
  // fascia sign (0,0,1024,160)
  const gr = c.createLinearGradient(0, 0, 0, 160);
  gr.addColorStop(0, '#22406e'); gr.addColorStop(1, '#173257');
  c.fillStyle = gr; c.fillRect(0, 0, 1024, 160);
  c.fillStyle = '#fff'; rr(c, 30, 30, 120, 100, 18); c.fill();
  c.fillStyle = '#1d4f9c'; rr(c, 48, 50, 84, 56, 10); c.fill();
  c.fillStyle = '#fff'; c.fillRect(56, 58, 30, 22); c.fillRect(92, 58, 32, 22);
  c.fillStyle = '#1d4f9c'; c.beginPath(); c.arc(64, 110, 9, 0, TAU); c.arc(116, 110, 9, 0, TAU); c.fill();
  text(c, '버스 정류장', 430, 84, 84, '#ffffff');
  c.fillStyle = '#ffffff55'; c.fillRect(700, 36, 3, 92);
  text(c, '행복마을', 860, 70, 50, '#ffe9a8');
  text(c, '12-345', 860, 120, 28, '#bcd0ee');
  // arrival board (0,176,640,176)
  c.fillStyle = '#0b0c0e'; c.fillRect(0, 176, 640, 176);
  const led = (s, x, y, col, size = 40, align = 'left') => {
    c.font = `${size}px ${FONT}`; c.textAlign = align; c.textBaseline = 'middle';
    c.shadowColor = col; c.shadowBlur = 8; c.fillStyle = col; c.fillText(s, x, y); c.shadowBlur = 0;
  };
  led('7', 30, 222, '#7dffa0'); led('시청 방면', 110, 222, '#ffb43a', 36); led('곧 도착', 610, 222, '#ff6a3a', 40, 'right');
  led('720', 30, 300, '#ffd27a'); led('해변 방면', 140, 300, '#ffb43a', 36); led('7분', 610, 300, '#ffb43a', 40, 'right');
  c.fillStyle = '#ffffff10'; for (let y = 176; y < 352; y += 4) c.fillRect(0, y, 640, 1);
  // backlit poster (656,176,368,568)
  const pg = c.createLinearGradient(0, 176, 0, 744);
  pg.addColorStop(0, '#ffd9a0'); pg.addColorStop(1, '#f39a6b');
  c.fillStyle = pg; c.fillRect(656, 176, 368, 568);
  c.fillStyle = '#fff6e4'; c.beginPath(); c.arc(840, 330, 70, 0, TAU); c.fill();
  // little tree and a book
  c.fillStyle = '#7a4a2a'; c.fillRect(740, 470, 14, 90);
  c.fillStyle = '#5c9a48'; c.beginPath(); c.arc(747, 450, 44, 0, TAU); c.arc(720, 480, 30, 0, TAU); c.arc(776, 482, 30, 0, TAU); c.fill();
  c.fillStyle = '#2f6fd0'; c.beginPath(); c.moveTo(810, 560); c.lineTo(880, 540); c.lineTo(950, 560); c.lineTo(950, 600); c.lineTo(880, 580); c.lineTo(810, 600); c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.moveTo(880, 540); c.lineTo(880, 580); c.stroke();
  text(c, '책 읽는 가을', 840, 225, 46, '#5a2e1c');
  text(c, '행복마을 도서관', 840, 650, 36, '#5a2e1c');
  text(c, '매일 09:00 - 21:00', 840, 698, 24, '#7a4a32');
}));
const fritMat = once(() => {
  const t = canvasTex(256, 64, (c) => {
    c.clearRect(0, 0, 256, 64);
    c.fillStyle = 'rgba(255,255,255,0.95)';
    for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) { c.beginPath(); c.arc(8 + x * 16 + (y % 2) * 8, 8 + y * 16, 4.2, 0, TAU); c.fill(); }
  });
  t.wrapS = THREE.RepeatWrapping;
  return new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, roughness: 0.6, side: THREE.DoubleSide });
});

/**
 * busStop({name}) → Group. Shelter 3.6 m (X) x 1.5 m (Z), open side +Z (towards the road), bench
 * inside along the back, lit sign "버스 정류장" on the front fascia, arrival board, route map,
 * lit poster on the +X end and a stop totem at the -X front corner.
 * userData.glowMats: emissive materials to brighten at night. userData.seats: sit positions.
 */
export function busStop() {
  const g = new THREE.Group();
  g.name = 'busStop';
  const W = 3.6, frame = SILVER(), glass = mat('glass');
  const pz = -0.62; // back post line
  const print = signMat(busPrint(), { rough: 0.5 });
  const glowM = glow(0xffffff, 0.75, busGlow());
  // pad and tactile strip
  put(g, rbox(W + 0.6, 0.05, 1.9, 0.02, 2), mat('concrete'), 0, 0.025, -0.02);
  put(g, atlasQuad(W + 0.5, 0.3, [0, 920, 1024, 104], 1024, 1024), print, 0, 0.0515, 0.74, -Math.PI / 2);
  // posts and cantilever beams
  const prof = new THREE.Shape();
  prof.moveTo(-0.08, 0); prof.lineTo(1.45, 0.06); prof.lineTo(1.45, 0.12); prof.lineTo(-0.08, 0.18); prof.closePath();
  const beam = extrude(prof, 0.07, 0.008);
  beam.rotateY(-Math.PI / 2);
  for (const x of [-W / 2 + 0.05, 0, W / 2 - 0.05]) {
    put(g, rbox(0.09, 2.5, 0.09, 0.02, 2), frame, x, 0.05 + 1.25, pz);
    put(g, beam, frame, x + 0.035, 2.4, pz - 0.0);
    put(g, rbox(0.16, 0.012, 0.16, 0.004, 1), BOLT(), x, 0.056, pz);
    for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) put(g, cyl(0.008, 0.008, 0.012, 6), BOLT(), x + a * 0.06, 0.066, pz + b * 0.06);
  }
  // roof slab, gutter lip and fascia
  put(g, rbox(W + 0.3, 0.09, 1.62, 0.035, 3), frame, 0, 2.62, pz + 0.72);
  put(g, rbox(W + 0.34, 0.26, 0.07, 0.03, 3), frame, 0, 2.6, pz + 1.55);
  put(g, atlasQuad(3.2, 0.2, [0, 0, 1024, 160], 1024, 1024), glowM, 0, 2.6, pz + 1.5855);
  // under-roof light strips
  for (const z of [pz + 0.35, pz + 1.15]) {
    put(g, rbox(W - 0.5, 0.03, 0.08, 0.012, 2), frame, 0, 2.56, z);
    put(g, rbox(W - 0.56, 0.012, 0.05, 0.005, 1), mat('lampGlow'), 0, 2.543, z);
  }
  // back glass between posts, rails, frit band
  for (const s of [-1, 1]) {
    const cx = s * (W / 4), w = W / 2 - 0.12;
    put(g, rbox(w, 2.18, 0.012, 0.004, 1), glass, cx, 1.27, pz);
    put(g, atlasQuad(w, 0.12, [0, 0, 256, 64], 256, 64), fritMat(), cx, 1.15, pz + 0.008);
  }
  for (const y of [0.17, 2.37]) put(g, rbox(W - 0.06, 0.05, 0.05, 0.012, 2), frame, 0, y, pz);
  // left end: glass side panel; right end: lit poster box
  const sz = pz + 0.4, sd = 0.72;
  put(g, rbox(0.012, 2.18, sd, 0.004, 1), glass, -W / 2 + 0.05, 1.27, sz);
  put(g, atlasQuad(sd, 0.12, [0, 0, 160, 64], 256, 64), fritMat(), -W / 2 + 0.058, 1.15, sz, 0, Math.PI / 2, 0);
  for (const y of [0.17, 2.37]) put(g, rbox(0.05, 0.05, sd + 0.05, 0.012, 2), frame, -W / 2 + 0.05, y, sz);
  put(g, rbox(0.06, 2.3, 0.06, 0.015, 2), frame, -W / 2 + 0.05, 1.27, sz + sd / 2);
  put(g, rbox(0.14, 1.95, 0.84, 0.03, 3), frame, W / 2 - 0.05, 1.2, sz);
  for (const s of [-1, 1]) put(g, atlasQuad(0.68, 1.05, [656, 176, 368, 568], 1024, 1024), glowM, W / 2 - 0.05 + s * 0.0705, 1.3, sz, 0, s * Math.PI / 2, 0);
  // route map and timetable on the back glass (inside)
  put(g, rbox(1.05, 1.2, 0.03, 0.012, 2), paint(0xf4f2ec, 0.5, 0), -W / 4, 1.42, pz + 0.03);
  put(g, atlasQuad(0.96, 0.72, [0, 0, 640, 480], 1024, 1024), print, -W / 4, 1.62, pz + 0.0455);
  put(g, atlasQuad(0.6, 0.375, [0, 500, 640, 400], 1024, 1024), print, -W / 4, 1.03, pz + 0.0455);
  // arrival board hanging from the roof
  put(g, rbox(1.0, 0.3, 0.1, 0.025, 2), BOLT(), 0.75, 2.2, pz + 1.0);
  for (const s of [-1, 1]) {
    put(g, atlasQuad(0.92, 0.25, [0, 176, 640, 176], 1024, 1024), glowM, 0.75, 2.2, pz + 1.0 + s * 0.0505, 0, s > 0 ? 0 : Math.PI, 0);
    put(g, cyl(0.012, 0.012, 0.2, 8), BOLT(), 0.75 + s * 0.4, 2.45, pz + 1.0);
  }
  // bench inside
  const wood = mat('oak');
  for (let i = 0; i < 3; i++) put(g, rbox(2.1, 0.035, 0.1, 0.012, 2), wood, -0.35, 0.47, pz + 0.17 + i * 0.115);
  for (const x of [-1.3, -0.35, 0.6]) {
    put(g, rbox(0.05, 0.44, 0.05, 0.012, 2), BOLT(), x, 0.27, pz + 0.38);
    put(g, rbox(0.05, 0.04, 0.4, 0.012, 2), BOLT(), x, 0.435, pz + 0.27);
    put(g, rbox(0.05, 0.3, 0.04, 0.012, 2), BOLT(), x, 0.3, pz + 0.07);
  }
  // stop totem at the front left corner, faces ±X (towards approaching buses)
  const tx = -W / 2 - 0.15, tz = pz + 1.35;
  put(g, rbox(0.08, 2.0, 0.08, 0.02, 2), frame, tx, 1.05, tz);
  put(g, rbox(0.08, 0.92, 0.42, 0.03, 3), frame, tx, 2.35, tz);
  for (const s of [-1, 1]) put(g, atlasQuad(0.36, 0.71, [660, 0, 364, 720], 1024, 1024), print, tx + s * 0.0405, 2.35, tz, 0, s * Math.PI / 2, 0);
  put(g, sphere(0.05, 16, 10), frame, tx, 2.83, tz);
  bake(g);
  g.userData.glowMats = [glowM];
  g.userData.seats = [[-1.0, 0.47, pz + 0.3], [-0.35, 0.47, pz + 0.3], [0.3, 0.47, pz + 0.3]];
  g.userData.lamps = [{ pos: [0, 2.4, pz + 0.75], color: 0xfff1d6, intensity: 0.8, range: 6 }];
  g.userData.colliders = [
    { min: [-W / 2, 0, pz - 0.05], max: [W / 2, 2.6, pz + 0.05] },
    { min: [-W / 2 + 0.02, 0, sz - sd / 2], max: [-W / 2 + 0.08, 2.4, sz + sd / 2] },
    { min: [W / 2 - 0.12, 0, sz - 0.42], max: [W / 2 + 0.02, 2.2, sz + 0.42] },
    { min: [-1.42, 0, pz + 0.05], max: [0.72, 0.49, pz + 0.48] },
    { min: [tx - 0.06, 0, tz - 0.22], max: [tx + 0.06, 2.8, tz + 0.22] },
  ];
  g.userData.footprint = { w: W + 0.7, d: 1.9 };
  return g;
}

// ------------------------------------------------------------------ signpost
const signTex = new Map();
/**
 * signpost(text, {color, arrow}) → Group. Wayfinding board on aluminium post(s); text on both faces.
 * arrow: 'right' | 'left' | 'none'. Board top at 2.45 m, centred on X, faces +Z.
 */
export function signpost(label = '행복마을', { color = 0x1f6b52, arrow = 'right' } = {}) {
  const g = new THREE.Group();
  g.name = 'signpost';
  const ppm = 420, bh = 0.4;
  const meas = document.createElement('canvas').getContext('2d');
  meas.font = `110px ${FONT}`;
  const tw = meas.measureText(label).width / ppm;
  const bw = Math.max(0.8, tw + (arrow === 'none' ? 0.3 : 0.62));
  const key = `${label}|${color}|${arrow}`;
  if (!signTex.has(key)) {
    const W = Math.round(bw * ppm), H = Math.round(bh * ppm);
    const css = '#' + color.toString(16).padStart(6, '0');
    signTex.set(key, signMat(canvasTex(W, H, (c) => {
      c.fillStyle = css; c.fillRect(0, 0, W, H);
      grime(c, 0, 0, W, H, 0.035, 7);
      c.strokeStyle = '#ffffff'; c.lineWidth = 7; rr(c, 12, 12, W - 24, H - 24, 14); c.stroke();
      const ax = arrow === 'left' ? 90 : W - 90;
      const tx = arrow === 'none' ? W / 2 : arrow === 'left' ? (W + 150) / 2 : (W - 150) / 2;
      text(c, label, tx, H / 2 + 4, 110, '#ffffff');
      if (arrow !== 'none') {
        const d = arrow === 'left' ? -1 : 1;
        c.fillStyle = '#fff'; c.beginPath();
        c.moveTo(ax + d * 46, H / 2); c.lineTo(ax - d * 6, H / 2 - 44); c.lineTo(ax - d * 6, H / 2 - 18); c.lineTo(ax - d * 50, H / 2 - 18);
        c.lineTo(ax - d * 50, H / 2 + 18); c.lineTo(ax - d * 6, H / 2 + 18); c.lineTo(ax - d * 6, H / 2 + 44); c.closePath(); c.fill();
      }
    }), { rough: 0.38 }));
  }
  const face = signTex.get(key);
  const by = 2.25, frame = SILVER();
  const posts = bw > 1.15 ? [-(bw / 2 - 0.16), bw / 2 - 0.16] : [0];
  for (const x of posts) {
    put(g, cyl(0.036, 0.04, 2.5, 20), frame, x, 1.25, -0.06);
    put(g, sphere(0.037, 14, 8), frame, x, 2.5, -0.06);
    put(g, rbox(0.16, 0.014, 0.16, 0.005, 1), BOLT(), x, 0.007, -0.06);
    for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) put(g, cyl(0.008, 0.008, 0.012, 6), BOLT(), x + a * 0.055, 0.018, -0.06 + b * 0.055);
    for (const dy of [-0.12, 0.12]) {
      put(g, torus(0.043, 0.008, 6, 20), BOLT(), x, by + dy, -0.06, Math.PI / 2);
      put(g, rbox(0.04, 0.03, 0.05, 0.006, 1), BOLT(), x, by + dy, -0.025);
    }
  }
  put(g, rbox(bw, bh, 0.03, 0.012, 2), paint(color, 0.4, 0.15), 0, by, 0);
  put(g, quad(bw - 0.01, bh - 0.01), face, 0, by, 0.0155);
  put(g, quad(bw - 0.01, bh - 0.01), face, 0, by, -0.0155, 0, Math.PI, 0);
  bake(g);
  g.userData.colliders = posts.map((x) => ({ min: [x - 0.05, 0, -0.11], max: [x + 0.05, 2.5, -0.01] }));
  g.userData.footprint = { w: bw, d: 0.2 };
  return g;
}

// ------------------------------------------------------------------ parasol
function canopyPanel(R, top, drop, a0, a1, under) {
  const rings = 10, segs = 8, pos = [], idx = [];
  for (let j = 0; j <= segs; j++) {
    const t = j / segs, a = a0 + (a1 - a0) * t, s = Math.sin(Math.PI * t);
    for (let i = 0; i <= rings; i++) {
      const u = i / rings, r = R * u * (1 - 0.04 * s);
      const y = top - drop * Math.pow(u, 1.2) - 0.04 * s * Math.sin(Math.PI * Math.min(1, u * 1.2)) - (under ? 0.006 : 0);
      pos.push(Math.sin(a) * r, y, Math.cos(a) * r);
    }
  }
  for (let j = 0; j < segs; j++) for (let i = 0; i < rings; i++) {
    const a = j * (rings + 1) + i, b = a + 1, c = a + rings + 1, d = c + 1;
    if (under) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return prep(geo);
}
function valance(R, rimY, a0, a1, inner) {
  const segs = 8, pos = [], idx = [];
  for (let j = 0; j <= segs; j++) {
    const t = j / segs, a = a0 + (a1 - a0) * t, s = Math.sin(Math.PI * t), r = R * (1 - 0.04 * s) - (inner ? 0.004 : 0);
    const yTop = rimY + 0.003, yBot = rimY - 0.05 - 0.075 * s;
    pos.push(Math.sin(a) * r, yTop, Math.cos(a) * r, Math.sin(a) * (r + 0.012), yBot, Math.cos(a) * (r + 0.012));
  }
  for (let j = 0; j < segs; j++) {
    const a = j * 2, b = a + 1, c = a + 2, d = a + 3;
    if (inner) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return prep(geo);
}
/**
 * parasol(color, {base}) → Group. Striped beach/cafe umbrella, canopy radius 1.1 m, top at 2.3 m.
 * base: true = round weighted base on the ground; false = pole pushed 0.3 m into sand.
 */
export function parasol(color = 0xe0574a, { base = true } = {}) {
  const g = new THREE.Group();
  g.name = 'parasol';
  const R = 1.12, top = 2.4, drop = 0.5, ribs = 8;
  const cA = paint(color, 0.82, 0, { sheen: 0.6 }), cB = paint(0xf6f1e6, 0.82, 0, { sheen: 0.6 });
  const wood = mat('oak');
  for (let k = 0; k < ribs; k++) {
    const a0 = (k / ribs) * TAU, a1 = ((k + 1) / ribs) * TAU, m = k % 2 ? cB : cA;
    put(g, canopyPanel(R, top, drop, a0, a1, false), m);
    put(g, canopyPanel(R, top, drop, a0, a1, true), m);
    put(g, valance(R, top - drop, a0, a1, false), m);
    put(g, valance(R, top - drop, a0, a1, true), m);
    // rib under the seam and its stretcher
    const pts = [];
    for (let i = 1; i <= 8; i++) {
      const u = i / 8;
      pts.push(V(Math.sin(a0) * R * u * 0.99, top - drop * Math.pow(u, 1.2) - 0.014, Math.cos(a0) * R * u * 0.99));
    }
    put(g, tube(new Poly(pts), 0.0065, pts.length - 1, 6), mat('whitePlastic'));
    put(g, sphere(0.012, 8, 6), wood, pts[7].x, pts[7].y - 0.004, pts[7].z);
    const mid = pts[3];
    rod(g, [0, top - 0.62, 0], [mid.x, mid.y - 0.006, mid.z], 0.005, mat('whitePlastic'), 6);
  }
  // pole, hub, runner, finial
  const y0 = base ? 0.1 : -0.3;
  put(g, grain(cyl(0.022, 0.022, top - y0 + 0.02, 16), 1), wood, 0, (top + y0) / 2, 0);
  put(g, cyl(0.026, 0.026, 0.04, 16), mat('chrome'), 0, 1.15, 0);
  put(g, cyl(0.034, 0.03, 0.1, 16), mat('whitePlastic'), 0, top - 0.62, 0);
  put(g, cyl(0.04, 0.03, 0.05, 16), mat('whitePlastic'), 0, top - 0.04, 0);
  put(g, lathe([[0.012, 0], [0.03, 0.01], [0.032, 0.04], [0.018, 0.07], [0.006, 0.09], [0, 0.095]], 16), wood, 0, top + 0.03, 0);
  put(g, lathe([[0.16, -0.05], [0.165, -0.045], [0.1, -0.012], [0.04, 0.02], [0, 0.03]], 32), cA, 0, top + 0.02, 0);
  if (base) {
    put(g, lathe([[0, 0], [0.27, 0], [0.28, 0.018], [0.27, 0.05], [0.2, 0.08], [0.08, 0.1], [0.045, 0.11], [0.045, 0.2], [0.03, 0.21], [0, 0.21]], 40), mat('grayPlastic'));
    put(g, cyl(0.03, 0.03, 0.03, 6), mat('chrome'), 0.05, 0.17, 0, 0, 0, Math.PI / 2);
  }
  bake(g);
  g.userData.colliders = [{ min: [-0.05, 0, -0.05], max: [0.05, top, 0.05] }];
  g.userData.footprint = { w: 2.3, d: 2.3 };
  return g;
}

// ------------------------------------------------------------------ beach deck chair
function slingGeo(S, T, width, sag) {
  const n = 16, m = 4, pos = [], uvs = [], idx = [];
  const dz = T[0] - S[0], dy = T[1] - S[1], L = Math.hypot(dz, dy), pz = -dy / L, py = dz / L;
  // perpendicular pointing down-back
  const sgn = py < 0 ? 1 : -1;
  let acc = 0, prev = null;
  for (let i = 0; i <= n; i++) {
    const t = i / n, w = Math.sin(Math.PI * Math.pow(t, 0.85)) * sag;
    const z = S[0] + dz * t + sgn * pz * w, y = S[1] + dy * t + sgn * py * w;
    if (prev) acc += Math.hypot(z - prev[0], y - prev[1]);
    prev = [z, y];
    for (let j = 0; j <= m; j++) {
      const x = (j / m - 0.5) * width;
      pos.push(x, y - 0.012 * Math.sin(Math.PI * j / m) * Math.sin(Math.PI * t), z);
      uvs.push(x, acc);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const a = i * (m + 1) + j, b = a + 1, c = a + m + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const make = (flip) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(flip ? idx.map((_, k) => idx[k - (k % 3) + (2 - (k % 3))]) : idx);
    geo.computeVertexNormals();
    return prep(geo, true);
  };
  return [make(false), make(true)];
}
/** beachChair() → Group. Wooden folding deck chair with a striped canvas sling; the sitter faces +Z. */
export function beachChair() {
  const g = new THREE.Group();
  g.name = 'beachChair';
  const wood = mat('oak'), steel = mat('chrome');
  const canvas = textured('stripes', { color: 0x2f6db5, color2: 0xf4efe3, count: 4, ratio: 0.5 }, 0.6, { normal: 0.6, roughness: 1 });
  const rail = (x, a, b, w = 0.045, t = 0.024) => {
    const dz = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dz, dy);
    put(g, grain(rbox(t, len, w, 0.009, 2), 1), wood, x, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2, Math.atan2(dz, dy));
  };
  // (z, y) key points
  const F = [0.42, 0.0], T = [-0.4, 0.96]; // outer frame: front foot to top
  const B = [-0.54, 0.0], P = [0.1, 0.6]; // back legs
  const S = [0.38, 0.42], Rr = [-0.33, 0.175]; // seat frame: front bar to rest bar
  const xo = 0.3, xs = 0.272, xi = 0.244;
  for (const s of [-1, 1]) {
    rail(s * xo, F, T);
    rail(s * xi, B, P);
    rail(s * xs, Rr, S, 0.04, 0.02);
  }
  // cross bars
  const bar = (x0, x1, p, r = 0.016) => put(g, grain(cyl(r, r, x1 - x0, 16), 1), wood, (x0 + x1) / 2, p[1], p[0], 0, 0, Math.PI / 2);
  bar(-xo - 0.015, xo + 0.015, [T[0] + 0.012, T[1] - 0.035], 0.018);
  bar(-xs - 0.012, xs + 0.012, [S[0] - 0.005, S[1] + 0.008], 0.017);
  bar(-xi - 0.012, xi + 0.012, [B[0] + 0.64 * 0.32, 0.6 * 0.32]);
  bar(-xi - 0.012, xi + 0.012, [Rr[0] + 0.005, Rr[1] - 0.006], 0.013);
  bar(-xo - 0.012, xo + 0.012, [F[0] - 0.82 * 0.12, 0.96 * 0.12], 0.013);
  // pivot bolts (outer/back-leg crossing and seat pivot)
  for (const s of [-1, 1]) {
    put(g, cyl(0.011, 0.011, 0.09, 10), steel, s * 0.272, 0.476, 0.0, 0, 0, Math.PI / 2);
    put(g, cyl(0.011, 0.011, 0.06, 10), steel, s * 0.286, 0.338, 0.125, 0, 0, Math.PI / 2);
  }
  // sling from the top bar to the front seat bar
  const [top, bot] = slingGeo([S[0] - 0.02, S[1] + 0.025], [T[0] + 0.03, T[1] - 0.02], 0.46, 0.27);
  put(g, top, canvas);
  put(g, bot, canvas);
  bake(g);
  g.userData.colliders = [{ min: [-0.32, 0, -0.56], max: [0.32, 0.5, 0.44] }];
  g.userData.seat = [0, 0.42, -0.08];
  g.userData.footprint = { w: 0.66, d: 1.0 };
  return g;
}

// ------------------------------------------------------------------ bollard
/** bollard() → Group. Charcoal steel sidewalk bollard with reflective bands, 0.86 m tall. */
export function bollard() {
  const g = new THREE.Group();
  g.name = 'bollard';
  const pole = POLE();
  put(g, lathe([[0, 0], [0.13, 0], [0.132, 0.012], [0.12, 0.022], [0, 0.022]], 32), BOLT());
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.5; nut(g, Math.cos(a) * 0.11, 0.026, Math.sin(a) * 0.11, 0.01); }
  put(g, lathe([[0.1, 0.02], [0.104, 0.04], [0.1, 0.06], [0.096, 0.08], [0.094, 0.7], [0.092, 0.75], [0.084, 0.8], [0.062, 0.838], [0.032, 0.856], [0, 0.862]], 36), pole);
  for (const y of [0.63, 0.7]) put(g, cyl(0.0948, 0.0948, 0.035, 36, true), paint(0xeeeee6, 0.22, 0.25), 0, y, 0);
  put(g, torus(0.097, 0.005, 6, 36), mat('steel'), 0, 0.08, 0, Math.PI / 2);
  put(g, torus(0.0935, 0.004, 6, 36), mat('steel'), 0, 0.775, 0, Math.PI / 2);
  bake(g);
  g.userData.colliders = [{ min: [-0.11, 0, -0.11], max: [0.11, 0.86, 0.11] }];
  g.userData.footprint = { w: 0.26, d: 0.26 };
  return g;
}

// ------------------------------------------------------------------ planter
/** Foliage atlas: left half a sprig of leaves, right half a five-petal flower (tinted by vertex colour). */
const foliageMat = once(() => {
  const t = canvasTex(256, 128, (c) => {
    c.clearRect(0, 0, 256, 128);
    const R = rng(5);
    c.strokeStyle = '#4a3a22'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(64, 120); c.quadraticCurveTo(60, 70, 66, 20); c.stroke();
    for (let i = 0; i < 11; i++) {
      const t = i / 10, y = 112 - t * 92, side = i % 2 ? 1 : -1, x = 64 + Math.sin(t * 3) * 3;
      const a = side * (0.7 + R() * 0.4) - Math.PI / 2, L = 30 - t * 8 + R() * 6, W = L * 0.42;
      c.save(); c.translate(x, y); c.rotate(a + Math.PI / 2);
      const gr = c.createLinearGradient(0, 0, 0, -L);
      gr.addColorStop(0, '#5f8f3c'); gr.addColorStop(1, `hsl(${92 + R() * 18},${45 + R() * 10}%,${50 + R() * 10}%)`);
      c.fillStyle = gr;
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(W, -L * 0.45, 0, -L); c.quadraticCurveTo(-W, -L * 0.45, 0, 0); c.fill();
      c.strokeStyle = 'rgba(40,70,25,0.6)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -L * 0.9); c.stroke();
      c.restore();
    }
    // flower
    c.save(); c.translate(192, 64);
    for (let i = 0; i < 5; i++) {
      c.rotate(TAU / 5);
      const gr = c.createRadialGradient(0, -26, 2, 0, -22, 30);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#dcdcdc');
      c.fillStyle = gr;
      c.beginPath(); c.ellipse(0, -28, 20, 30, 0, 0, TAU); c.fill();
    }
    c.fillStyle = '#f2c230'; c.beginPath(); c.arc(0, 0, 12, 0, TAU); c.fill();
    c.fillStyle = '#c98a16'; for (let i = 0; i < 8; i++) { c.beginPath(); c.arc(Math.cos(i) * 6, Math.sin(i * 1.7) * 6, 2, 0, TAU); c.fill(); }
    c.restore();
  });
  const m = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 0.75 });
  m.name = 'foliageCards';
  return m;
});
const leafCoreMat = once(() => { const m = mat('leaves').clone(); m.vertexColors = true; m.name = 'leavesVC'; return m; });
const bladeMat = once(() => { const m = paint(0xffffff, 0.7, 0).clone(); m.vertexColors = true; m.side = THREE.DoubleSide; m.name = 'bladeVC'; return m; });
function tint(geo, fn) {
  const p = geo.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const [r, g2, b] = fn(p.getX(i), p.getY(i), p.getZ(i)); c[i * 3] = r; c[i * 3 + 1] = g2; c[i * 3 + 2] = b; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
/**
 * Leaf cards around an ellipsoid (rx, ry, rz) centred at (cx, cy, cz). kind 0 = leaves, 1 = flowers.
 * Normals point out of the ellipsoid so the clump lights softly like a real shrub.
 */
function cards(n, [cx, cy, cz], [rx, ry, rz], size, seed, kind = 0, colorFn) {
  const R = rng(seed), pos = [], nor = [], uv = [], col = [];
  const u0 = kind ? 0.5 : 0, u1 = kind ? 1 : 0.5;
  const up = V(0, 1, 0), d = V(), t1 = V(), t2 = V(), nn = V();
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, y = kind ? 0.55 + R() * 0.45 : -0.35 + R() * 1.35, h = Math.sqrt(Math.max(0, 1 - y * y));
    d.set(Math.cos(a) * h, y, Math.sin(a) * h);
    const k = 0.72 + R() * 0.32;
    const p = V(cx + d.x * rx * k, cy + d.y * ry * k, cz + d.z * rz * k);
    nn.set(d.x / rx, d.y / ry, d.z / rz).normalize();
    t1.crossVectors(Math.abs(nn.y) > 0.95 ? V(1, 0, 0) : up, nn).normalize();
    t2.crossVectors(nn, t1).normalize();
    const roll = R() * TAU, s = size * (0.75 + R() * 0.5), c = Math.cos(roll), sn = Math.sin(roll);
    const e1 = t1.clone().multiplyScalar(c).addScaledVector(t2, sn).multiplyScalar(s / 2);
    const e2 = t2.clone().multiplyScalar(c).addScaledVector(t1, -sn).multiplyScalar(s / 2);
    // lift the card off the surface a little so sprigs stick out
    e2.addScaledVector(nn, s * 0.25);
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
    const shade = colorFn(d.y, R);
    const ln = nn.clone().lerp(up, 0.35).normalize();
    for (const [a1, a2] of corners) {
      pos.push(p.x + e1.x * a1 + e2.x * a2, p.y + e1.y * a1 + e2.y * a2, p.z + e1.z * a1 + e2.z * a2);
      nor.push(ln.x, ln.y, ln.z);
      uv.push(a1 < 0 ? u0 : u1, a2 < 0 ? 0 : 1);
      col.push(...shade);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return prep(geo, true);
}
const greenShade = (dy, R) => { const k = 0.55 + 0.35 * (dy + 1) / 2 + R() * 0.15; return [k * (0.9 + R() * 0.15), k, k * (0.85 + R() * 0.1)]; };
/** Clipped boxwood: a dark core plus leaf sprigs. */
function boxwood(g, [x, y, z], r, seed, ry = r) {
  const core = displace(new THREE.IcosahedronGeometry(1, 2), (px, py, pz) => 0.06 * Math.sin(px * 5 + seed) * Math.sin(pz * 4 + py * 3));
  core.scale(r * 0.82, ry * 0.82, r * 0.82);
  put(g, tint(core, () => [0.42, 0.5, 0.4]), leafCoreMat(), x, y, z);
  put(g, cards(Math.round(260 * r / 0.2 * r / 0.2) + 40, [x, y, z], [r, ry, r], 0.11 * Math.sqrt(r / 0.2), seed, 0, greenShade), foliageMat());
}
function grassClump(seed, n = 34, hgt = 0.42) {
  const R = rng(seed), pos = [], col = [];
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, lean = 0.15 + R() * 0.5, h = hgt * (0.6 + R() * 0.5), w = 0.012 + R() * 0.006;
    const ox = Math.cos(a) * 0.03 * R(), oz = Math.sin(a) * 0.03 * R(), dx = Math.cos(a), dz = Math.sin(a);
    const px = -dz, pz = dx;
    let last = null;
    for (let k = 0; k <= 4; k++) {
      const t = k / 4, ww = w * (1 - t * 0.85);
      const x = ox + dx * lean * h * t * t, z = oz + dz * lean * h * t * t, y = h * t - lean * h * 0.35 * t * t * t;
      const cur = [[x - px * ww, y, z - pz * ww], [x + px * ww, y, z + pz * ww]];
      const c0 = [0.32 + 0.4 * t, 0.42 + 0.35 * t, 0.2 + 0.18 * t];
      if (last) {
        const [l0, l1] = last.p, [c0p, c1p] = cur;
        pos.push(...l0, ...c0p, ...l1, ...l1, ...c0p, ...c1p);
        col.push(...last.c, ...c0, ...last.c, ...last.c, ...c0, ...c0);
      }
      last = { p: cur, c: c0 };
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return prep(geo);
}
/**
 * planter() → Group. Walnut-clad street planter 1.4 x 0.56 x 0.5 m (steel rim and plinth) with two
 * clipped boxwoods, ornamental grass and a row of flowers along the +Z edge.
 */
export function planter() {
  const g = new THREE.Group();
  g.name = 'planter';
  const W = 1.4, D = 0.56, H = 0.5, steel = POLE(), wood = mat('walnut');
  const ring = (w, d, r, hw, hd, hr) => {
    const rect = (p, w2, d2, r2) => {
      p.moveTo(-w2 / 2 + r2, -d2 / 2); p.lineTo(w2 / 2 - r2, -d2 / 2); p.absarc(w2 / 2 - r2, -d2 / 2 + r2, r2, -Math.PI / 2, 0, false);
      p.lineTo(w2 / 2, d2 / 2 - r2); p.absarc(w2 / 2 - r2, d2 / 2 - r2, r2, 0, Math.PI / 2, false);
      p.lineTo(-w2 / 2 + r2, d2 / 2); p.absarc(-w2 / 2 + r2, d2 / 2 - r2, r2, Math.PI / 2, Math.PI, false);
      p.lineTo(-w2 / 2, -d2 / 2 + r2); p.absarc(-w2 / 2 + r2, -d2 / 2 + r2, r2, Math.PI, Math.PI * 1.5, false);
    };
    const s = new THREE.Shape(), hole = new THREE.Path();
    rect(s, w, d, r); rect(hole, hw, hd, hr); s.holes.push(hole);
    return s;
  };
  // plinth, inner box, slats, rim
  put(g, rbox(W - 0.08, 0.06, D - 0.08, 0.015, 2), steel, 0, 0.03, 0);
  put(g, rbox(W - 0.05, H - 0.16, D - 0.05, 0.02, 2), steel, 0, 0.06 + (H - 0.16) / 2, 0);
  const sw = 0.082, gap = 0.012, nF = Math.floor((W - 0.06) / (sw + gap)), nS = Math.floor((D - 0.06) / (sw + gap));
  const sh = H - 0.12;
  for (let i = 0; i < nF; i++) {
    const x = (i - (nF - 1) / 2) * (sw + gap);
    for (const s of [-1, 1]) put(g, grain(rbox(sw, sh, 0.022, 0.006, 1), 1), wood, x, 0.07 + sh / 2, s * (D / 2 - 0.011));
  }
  for (let i = 0; i < nS; i++) {
    const z = (i - (nS - 1) / 2) * (sw + gap);
    for (const s of [-1, 1]) put(g, grain(rbox(0.022, sh, sw, 0.006, 1), 1), wood, s * (W / 2 - 0.011), 0.07 + sh / 2, z);
  }
  const rim = extrude(ring(W + 0.02, D + 0.02, 0.03, W - 0.1, D - 0.1, 0.02), 0.04, 0.006);
  rim.rotateX(-Math.PI / 2);
  put(g, rim, steel, 0, H - 0.05, 0);
  // soil and plants
  put(g, plane(W - 0.1, D - 0.1), mat('dirt'), 0, H - 0.06, 0);
  const top = H - 0.06;
  boxwood(g, [-0.42, top + 0.17, -0.02], 0.2, 3, 0.19);
  boxwood(g, [0.44, top + 0.15, -0.03], 0.17, 7, 0.17);
  put(g, grassClump(11), bladeMat(), 0.06, top, -0.08);
  put(g, grassClump(12, 26, 0.32), bladeMat(), -0.14, top, -0.12);
  // low leafy mound with flowers along the front
  const fm = foliageMat();
  put(g, cards(70, [0.05, top + 0.02, 0.12], [0.32, 0.07, 0.09], 0.09, 31, 0, greenShade), fm);
  const tints = [[1, 1, 1], [0.78, 0.6, 1], [1, 0.62, 0.78]];
  put(g, cards(30, [0.05, top + 0.06, 0.12], [0.3, 0.07, 0.08], 0.055, 33, 1, (dy, R) => tints[Math.floor(R() * 3)]), fm);
  bake(g);
  g.userData.colliders = [{ min: [-W / 2, 0, -D / 2], max: [W / 2, H, D / 2] }];
  g.userData.footprint = { w: W + 0.02, d: D + 0.02 };
  return g;
}

// ------------------------------------------------------------------ test row
/** streetSet() → Group with every prop in a row along X (viewer only). */
export function streetSet() {
  const g = new THREE.Group();
  const place = (o, x, z = 0, ry = 0) => { o.position.set(x, 0, z); o.rotation.y = ry; g.add(o); };
  place(streetLight().group, -11, -1);
  const tl = trafficLight({ arm: 2.2 }); tl.setState('green'); place(tl.group, -9.4, -1.2);
  place(busStop(), -4.2, -0.6);
  place(bench(), 0.3, 0);
  place(hydrant(), 1.9, 0.2);
  place(trashCan(), 2.9, 0);
  place(mailbox(), 3.9, 0);
  place(bollard(), 4.7, 0.4);
  place(bollard(), 5.2, 0.4);
  place(planter(), 6.4, 0);
  place(signpost('행복마을'), 8.2, -0.3);
  place(fence(3), 10.6, -0.4);
  place(fence(3, { style: 'rail' }), 10.6, 0.8);
  place(parasol(0xe0574a), 13.6, -0.6);
  place(beachChair(), 13.4, 0.5, -0.3);
  return g;
}
