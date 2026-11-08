// 곤충 모델 (인혁이 계획: "곤충을 채집할 수 있게 해줘."): small procedural Korean insects and the bug net.
// Every model is authored with its body about 1 unit long (head at -Z, the surface it stands on at y = 0,
// up +Y) and scaled to its size by the game. Bodies are merged ellipsoids, lathes and leg tubes with the
// colour pattern painted into vertex colours (ladybug spots, cicada markings, dragonfly segments...).
// Butterfly, dragonfly and cicada wings are cut out of painted canvases (veins, scales, eyespots) and
// hinge on pivots so they can flap, close over the back or fold like a roof. Geometry and materials are
// built once per species and shared by every copy (one body draw call, plus two wing calls when it has
// wings). buildNet() is the 잠자리채 for the first-person hand.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const PI = Math.PI, TAU = PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const col = (h) => (h?.isColor ? h.clone() : new THREE.Color(h));
const mix = (a, b, t) => new THREE.Color().lerpColors(col(a), col(b), Math.max(0, Math.min(1, t)));
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };

// ------------------------------------------------------------------ geometry builder
function paint(geo, color) {
  const p = geo.attributes.position, n = p.count, a = new Float32Array(n * 3), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const v = typeof color === 'function' ? color(x, y, z) : color;
    if (v?.isColor) c.copy(v); else c.setHex(v);
    a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
const clean = (g) => { g.deleteAttribute('uv'); return g; };

class Parts {
  constructor() { this.geos = []; }
  /** Ellipsoid; colour fn gets unit-sphere coordinates. opts: rot [x,y,z], ws, hs, squash (lower half y scale), fn(v) shape tweak. */
  ell(c, r, color, { rot = [0, 0, 0], ws = 18, hs = 12, squash = 1 } = {}) {
    const g = new THREE.SphereGeometry(1, ws, hs);
    paint(g, color);
    if (squash !== 1) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, p.getY(i) * squash); g.computeVertexNormals(); }
    g.applyMatrix4(new THREE.Matrix4().compose(V(...c), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), V(...r)));
    this.geos.push(clean(g));
    return this;
  }
  /** Tapered tube from a to b; colour fn gets model coordinates. */
  tube(a, b, r0, r1, color, radial = 7) {
    const A = V(...a), B = V(...b), d = B.clone().sub(A), len = d.length();
    if (len < 1e-5) return this;
    const g = new THREE.CylinderGeometry(r1, r0, len, radial, 1, false);
    g.applyMatrix4(new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()), V(1, 1, 1)));
    paint(g, color);
    this.geos.push(clean(g));
    return this;
  }
  /** Jointed leg through points with knuckle balls. */
  leg(pts, r, color, taper = 0.55) {
    for (let i = 0; i < pts.length - 1; i++) {
      const k0 = 1 - (i / (pts.length - 1)) * (1 - taper), k1 = 1 - ((i + 1) / (pts.length - 1)) * (1 - taper);
      this.tube(pts[i], pts[i + 1], r * k0, r * k1, color, 6);
      if (i > 0) this.ell(pts[i], [r * k0 * 1.15, r * k0 * 1.15, r * k0 * 1.15], color, { ws: 6, hs: 4 });
    }
    return this;
  }
  /** Same leg on both sides (points given for the right side, +X). */
  legs(pts, r, color, taper) { this.leg(pts, r, color, taper); this.leg(pts.map(([x, y, z]) => [-x, y, z]), r, color, taper); return this; }
  /** Body of revolution along +Z: profile [[z, r], ...]; sx/sy flatten; colour fn gets model coordinates. */
  lathe(profile, color, { sx = 1, sy = 1, y = 0, seg = 16 } = {}) {
    const g = new THREE.LatheGeometry(profile.map(([z, r]) => new THREE.Vector2(Math.max(1e-4, r), z)), seg);
    g.rotateX(PI / 2);
    g.scale(sx, sy, 1);
    g.translate(0, y, 0);
    paint(g, color);
    this.geos.push(clean(g));
    return this;
  }
  build() {
    const m = mergeGeometries(this.geos, false);
    m.computeBoundingSphere();
    return m;
  }
}

// ------------------------------------------------------------------ materials (shared)
let M = null;
function mats() {
  if (M) return M;
  M = {
    matte: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 }),
    fuzz: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.85, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.25, 0.22, 0.16) }),
    gloss: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }),
    jewel: new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: 0.65, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, iridescence: 1, iridescenceIOR: 1.7, iridescenceThicknessRange: [220, 620] }),
    lantern: new THREE.MeshStandardMaterial({ color: 0xf2ffc0, emissive: 0xc8ff40, emissiveIntensity: 2.4, roughness: 0.4 }),
  };
  for (const m of Object.values(M)) m.name = 'insect';
  return M;
}

// ------------------------------------------------------------------ painted wings
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
/** Swallowtail-type wing outline paths on a 256 canvas: hinge at x = 0, front of the insect at the top. */
function swallowFore(x) {
  x.beginPath(); x.moveTo(4, 74);
  x.bezierCurveTo(60, 40, 150, 22, 236, 30); // costa to the apex
  x.bezierCurveTo(226, 70, 214, 104, 198, 128); // outer margin
  x.bezierCurveTo(140, 128, 60, 120, 6, 118); // inner margin back to the body
  x.closePath();
}
function swallowHind(x) {
  x.beginPath(); x.moveTo(6, 112);
  x.bezierCurveTo(70, 104, 150, 108, 186, 126);
  // scalloped outer margin
  const sc = [[186, 126], [182, 148], [172, 168], [160, 186], [146, 200], [128, 210]];
  for (let i = 1; i < sc.length; i++) { const [ax, ay] = sc[i - 1], [bx, by] = sc[i]; x.quadraticCurveTo((ax + bx) / 2 + 7, (ay + by) / 2 + 5, bx, by); }
  x.lineTo(124, 246); x.quadraticCurveTo(116, 252, 110, 244); x.lineTo(110, 212); // the tail
  x.bezierCurveTo(80, 214, 46, 206, 22, 196);
  x.bezierCurveTo(10, 170, 6, 140, 6, 112);
  x.closePath();
}
const WING_DRAW = {
  swallowtail(x) {
    const Y = '#f2d455', K = '#1c1712';
    // forewing: pale yellow with black base streaks, bars and a black margin with yellow crescents
    x.save(); swallowFore(x); x.clip();
    x.fillStyle = Y; x.fillRect(0, 0, 256, 256);
    x.fillStyle = K; x.fillRect(0, 0, 40, 256);
    x.strokeStyle = Y; x.lineWidth = 3; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(4, 82 + i * 9); x.lineTo(40, 80 + i * 8); x.stroke(); }
    x.fillStyle = K;
    for (const [a, b, w] of [[64, 34, 12], [96, 30, 12], [132, 28, 10]]) { x.beginPath(); x.moveTo(a, b); x.lineTo(a + w, b - 2); x.lineTo(a + w - 18, 120); x.lineTo(a - 22, 122); x.closePath(); x.fill(); }
    x.beginPath(); x.moveTo(176, 20); x.bezierCurveTo(200, 70, 190, 100, 168, 132); x.lineTo(260, 140); x.lineTo(260, 10); x.closePath(); x.fill();
    x.fillStyle = Y; for (let i = 0; i < 7; i++) { const t = i / 6; x.beginPath(); x.ellipse(206 - t * 22 + 6, 42 + t * 76, 6, 4, 0.6, 0, TAU); x.fill(); }
    x.strokeStyle = 'rgba(28,23,18,0.85)'; x.lineWidth = 1.6;
    for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(10, 98); x.quadraticCurveTo(110, 70 + i * 6, 236 - i * 6, 34 + i * 12); x.stroke(); }
    x.restore();
    // hindwing: yellow, black veins and margin, a blue row and the red-orange eyespot by the body
    x.save(); swallowHind(x); x.clip();
    x.fillStyle = Y; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = K; x.lineWidth = 2.2;
    for (let i = 0; i < 7; i++) { x.beginPath(); x.moveTo(14, 124); x.quadraticCurveTo(80, 130 + i * 8, 186 - i * 12, 130 + i * 13); x.stroke(); }
    x.fillStyle = K; x.beginPath(); x.moveTo(110, 120); x.bezierCurveTo(130, 150, 120, 175, 90, 200); x.lineTo(260, 260); x.lineTo(260, 110); x.closePath(); x.fill();
    x.fillStyle = K; x.fillRect(100, 200, 40, 60);
    x.beginPath(); x.moveTo(6, 150); x.lineTo(40, 140); x.lineTo(50, 210); x.lineTo(0, 210); x.closePath(); x.fill();
    x.fillStyle = '#5a8ad8'; for (let i = 0; i < 5; i++) { const t = i / 4; x.beginPath(); x.ellipse(150 - t * 40, 140 + t * 52, 6, 4, -0.7, 0, TAU); x.fill(); }
    x.fillStyle = Y; for (let i = 0; i < 6; i++) { const t = i / 5; x.beginPath(); x.ellipse(176 - t * 44, 150 + t * 50, 6, 3, -0.8, 0, TAU); x.fill(); }
    x.fillStyle = '#e0552a'; x.beginPath(); x.ellipse(34, 196, 11, 9, 0, 0, TAU); x.fill();
    x.fillStyle = K; x.beginPath(); x.ellipse(36, 198, 4.5, 4, 0, 0, TAU); x.fill();
    x.fillStyle = '#5a8ad8'; x.beginPath(); x.ellipse(30, 188, 3, 2, 0, 0, TAU); x.fill();
    x.restore();
    // fine scale shading at the base
    x.save(); x.globalCompositeOperation = 'source-atop'; const g = x.createRadialGradient(0, 110, 4, 0, 110, 120); g.addColorStop(0, 'rgba(40,30,20,0.5)'); g.addColorStop(1, 'rgba(40,30,20,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); x.restore();
    // a thin dark rim
    x.strokeStyle = 'rgba(20,16,12,0.9)'; x.lineWidth = 2; swallowFore(x); x.stroke(); swallowHind(x); x.stroke();
  },
  cabbage(x) {
    const W = '#f6f4ec';
    const fore = () => { x.beginPath(); x.moveTo(4, 70); x.bezierCurveTo(70, 34, 160, 26, 222, 40); x.bezierCurveTo(228, 80, 214, 110, 190, 132); x.bezierCurveTo(130, 134, 60, 126, 6, 122); x.closePath(); };
    const hind = () => { x.beginPath(); x.moveTo(6, 112); x.bezierCurveTo(80, 104, 160, 112, 196, 134); x.bezierCurveTo(204, 170, 176, 212, 120, 226); x.bezierCurveTo(70, 232, 30, 214, 14, 190); x.bezierCurveTo(6, 160, 4, 136, 6, 112); x.closePath(); };
    x.save(); hind(); x.clip(); x.fillStyle = '#efecd6'; x.fillRect(0, 0, 256, 256);
    x.fillStyle = '#2a2622'; x.beginPath(); x.ellipse(120, 120, 7, 6, 0, 0, TAU); x.fill();
    const gh = x.createLinearGradient(0, 0, 70, 0); gh.addColorStop(0, 'rgba(70,70,60,0.55)'); gh.addColorStop(1, 'rgba(70,70,60,0)'); x.fillStyle = gh; x.fillRect(0, 100, 80, 140);
    x.restore();
    x.save(); fore(); x.clip(); x.fillStyle = W; x.fillRect(0, 0, 256, 256);
    // grey-black wing tip and the two black spots
    x.fillStyle = '#3a3632'; x.beginPath(); x.moveTo(170, 20); x.bezierCurveTo(196, 50, 214, 64, 230, 90); x.lineTo(260, 90); x.lineTo(260, 0); x.closePath(); x.fill();
    x.beginPath(); x.ellipse(150, 80, 9, 8, 0, 0, TAU); x.fill(); x.beginPath(); x.ellipse(146, 116, 8, 7, 0, 0, TAU); x.fill();
    const g = x.createLinearGradient(0, 0, 60, 0); g.addColorStop(0, 'rgba(70,70,64,0.7)'); g.addColorStop(1, 'rgba(70,70,64,0)'); x.fillStyle = g; x.fillRect(0, 40, 70, 100);
    x.strokeStyle = 'rgba(120,115,100,0.35)'; x.lineWidth = 1; for (let i = 0; i < 7; i++) { x.beginPath(); x.moveTo(8, 96); x.quadraticCurveTo(100, 70 + i * 6, 220 - i * 5, 40 + i * 14); x.stroke(); }
    x.restore();
    x.strokeStyle = 'rgba(80,76,66,0.6)'; x.lineWidth = 1.5; fore(); x.stroke(); hind(); x.stroke();
  },
  dragonfly(x) {
    // two long clear wings (fore above, hind below) with an amber base, a vein net and a dark pterostigma
    const wing = (y0, y1, base) => {
      x.save(); x.beginPath(); x.moveTo(2, y0); x.bezierCurveTo(80, y0 - 10, 200, y0 - 8, 250, (y0 + y1) / 2 - 2); x.bezierCurveTo(240, y1 + 2, 120, y1 + base, 2, y1 + base * 0.6); x.closePath();
      x.clip();
      x.fillStyle = 'rgba(232,236,240,0.22)'; x.fillRect(0, 0, 256, 256);
      const g = x.createLinearGradient(0, 0, 70, 0); g.addColorStop(0, 'rgba(220,120,40,0.75)'); g.addColorStop(1, 'rgba(220,120,40,0)'); x.fillStyle = g; x.fillRect(0, 0, 90, 256);
      x.strokeStyle = 'rgba(40,24,18,0.75)'; x.lineWidth = 1.4;
      for (let i = 0; i < 6; i++) { const t = i / 5; x.beginPath(); x.moveTo(2, y0 + (y1 - y0) * t * 0.9); x.bezierCurveTo(90, y0 + (y1 - y0) * t, 190, y0 + (y1 - y0) * t * 0.7, 250, (y0 + y1) / 2); x.stroke(); }
      x.lineWidth = 0.7; x.strokeStyle = 'rgba(40,24,18,0.5)';
      for (let k = 6; k < 250; k += 7) { x.beginPath(); x.moveTo(k, y0 - 12); x.lineTo(k + 3, y1 + base + 4); x.stroke(); }
      x.fillStyle = 'rgba(120,30,20,0.95)'; x.fillRect(206, y0 - 4, 18, 7);
      x.restore();
      x.strokeStyle = 'rgba(40,24,18,0.9)'; x.lineWidth = 2; x.beginPath(); x.moveTo(2, y0); x.bezierCurveTo(80, y0 - 10, 200, y0 - 8, 250, (y0 + y1) / 2 - 2); x.stroke();
    };
    wing(40, 70, 4); wing(140, 168, 26);
  },
  cicada(x) {
    // big forewing over a smaller hindwing, clear with dark brown veins and a green-brown base
    const wing = (len, w0, y0) => {
      x.save(); x.beginPath(); x.moveTo(2, y0); x.bezierCurveTo(len * 0.4, y0 - w0 * 0.5, len * 0.85, y0 - w0 * 0.35, len, y0 + w0 * 0.15); x.bezierCurveTo(len * 0.9, y0 + w0 * 0.75, len * 0.4, y0 + w0 * 0.9, 2, y0 + w0 * 0.3); x.closePath();
      x.clip(); x.fillStyle = 'rgba(225,232,226,0.2)'; x.fillRect(0, 0, 256, 256);
      const g = x.createLinearGradient(0, 0, len * 0.3, 0); g.addColorStop(0, 'rgba(70,90,50,0.95)'); g.addColorStop(1, 'rgba(70,90,50,0)'); x.fillStyle = g; x.fillRect(0, 0, len * 0.35, 256);
      x.strokeStyle = 'rgba(48,34,22,0.95)'; x.lineWidth = 2;
      for (let i = 0; i < 5; i++) { const t = i / 4; x.beginPath(); x.moveTo(4, y0 + w0 * 0.1); x.quadraticCurveTo(len * 0.5, y0 - w0 * 0.3 + w0 * t, len * (0.95 - t * 0.12), y0 - w0 * 0.1 + w0 * t * 0.8); x.stroke(); }
      x.lineWidth = 1.4; for (let k = 0.55; k < 0.95; k += 0.09) { x.beginPath(); x.moveTo(len * k, y0 - w0 * 0.35); x.lineTo(len * (k + 0.02), y0 + w0 * 0.75); x.stroke(); }
      x.restore();
      x.strokeStyle = 'rgba(48,34,22,0.95)'; x.lineWidth = 2.6; x.beginPath(); x.moveTo(2, y0); x.bezierCurveTo(len * 0.4, y0 - w0 * 0.5, len * 0.85, y0 - w0 * 0.35, len, y0 + w0 * 0.15); x.bezierCurveTo(len * 0.9, y0 + w0 * 0.75, len * 0.4, y0 + w0 * 0.9, 2, y0 + w0 * 0.3); x.stroke();
    };
    wing(150, 56, 112); wing(250, 84, 92);
  },
};
const wingTex = new Map();
function wingMaterial(kind) {
  if (!wingTex.has(kind)) {
    const t = canvasTex(256, 256, (x) => WING_DRAW[kind](x));
    const clear = kind === 'dragonfly' || kind === 'cicada';
    const m = clear
      ? new THREE.MeshPhysicalMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.12, metalness: 0, iridescence: 0.6, iridescenceIOR: 1.4, iridescenceThicknessRange: [300, 500] })
      : new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75 });
    m.name = 'insect-wing';
    wingTex.set(kind, m);
  }
  return wingTex.get(kind);
}
/** Wing plane: the canvas spans W (out from the hinge) by H (front to back); hinge at x = 0. */
function wingGeo(W, H, zoff = 0) {
  const g = new THREE.PlaneGeometry(W, H);
  g.rotateX(-PI / 2);
  g.translate(W / 2, 0, zoff);
  return g;
}

// ------------------------------------------------------------------ species bodies
const K = 0x16120f;
/** Butterfly body: furry thorax, segmented abdomen, big eyes, clubbed antennae, thin legs. */
function butterflyBody(P, { body, belly, stripe }) {
  P.ell([0, 0.13, -0.34], [0.065, 0.065, 0.06], body);
  for (const s of [-1, 1]) P.ell([s * 0.05, 0.14, -0.37], [0.04, 0.045, 0.04], (x, y) => mix(0x2a2016, 0x4a3a20, 0.5 + 0.5 * y));
  P.ell([0, 0.14, -0.17], [0.085, 0.085, 0.14], (x, y, z) => mix(belly, body, 0.5 + 0.5 * y + 0.15 * hash(x * 9, y * 9, z * 9)));
  P.lathe([[-0.05, 0.02], [0.0, 0.055], [0.12, 0.06], [0.3, 0.048], [0.42, 0.028], [0.47, 0.004]], (x, y, z) => {
    const ring = 0.5 + 0.5 * Math.cos(z * 70);
    return mix(mix(belly, body, sstep(-0.045, 0.0, y - 0.13)), stripe, stripe == null ? 0 : sstep(0.4, 0.9, ring) * sstep(0.02, 0.05, Math.abs(x)) * 0.7);
  }, { y: 0.13, sx: 0.95, sy: 0.9 });
  for (const s of [-1, 1]) {
    P.tube([s * 0.02, 0.17, -0.38], [s * 0.2, 0.38, -0.86], 0.006, 0.005, K, 5);
    P.ell([s * 0.2, 0.38, -0.86], [0.016, 0.016, 0.04], K, { rot: [0.5, s * 0.4, 0], ws: 8, hs: 6 });
  }
  P.legs([[0.05, 0.1, -0.24], [0.14, 0.1, -0.34], [0.17, 0.0, -0.4]], 0.009, 0x2a2420);
  P.legs([[0.05, 0.1, -0.16], [0.18, 0.12, -0.14], [0.22, 0.0, -0.08]], 0.009, 0x2a2420);
  P.legs([[0.05, 0.1, -0.09], [0.17, 0.12, 0.02], [0.2, 0.0, 0.12]], 0.009, 0x2a2420);
}

const BUILD = {
  swallowtail() {
    const P = new Parts(); butterflyBody(P, { body: 0x1c1712, belly: 0xd8c070, stripe: 0xe8d070 });
    return { body: P.build(), mat: 'fuzz', wings: { kind: 'swallowtail', W: 1.42, H: 1.42, zoff: 0.11, at: [0.05, 0.17, -0.17] } };
  },
  cabbage() {
    const P = new Parts(); butterflyBody(P, { body: 0x2a2a2a, belly: 0xd8d4c4, stripe: null });
    return { body: P.build(), mat: 'fuzz', wings: { kind: 'cabbage', W: 1.15, H: 1.15, zoff: 0.1, at: [0.05, 0.17, -0.17] } };
  },
  dragonfly() {
    const P = new Parts();
    const red = 0xd42c18;
    // huge eyes, face, thorax with dark side stripes, long red segmented abdomen
    for (const s of [-1, 1]) P.ell([s * 0.045, 0.12, -0.47], [0.055, 0.058, 0.055], (x, y, z) => mix(0x7a2014, 0xc04a2a, 0.5 + 0.5 * y + 0.1 * Math.sin(z * 40) * Math.sin(x * 40)));
    P.ell([0, 0.085, -0.5], [0.04, 0.035, 0.03], 0xb0603a);
    P.ell([0, 0.1, -0.33], [0.055, 0.07, 0.085], (x, y, z) => mix(0x8a3420, 0x2a1810, sstep(0.55, 0.75, Math.abs(Math.sin(z * 18 + y * 6))) * 0.8), { rot: [-0.25, 0, 0] });
    P.lathe([[-0.26, 0.03], [-0.22, 0.034], [-0.17, 0.024], [0.0, 0.02], [0.3, 0.019], [0.46, 0.016], [0.5, 0.008], [0.52, 0.001]], (x, y, z) => {
      const seg = (z + 0.26) / 0.074, f = seg - Math.floor(seg);
      const c = mix(red, 0x6a1408, sstep(0.86, 0.98, f) * 0.85);
      return mix(c, 0x2a0a06, z > 0.3 && y > 0.105 ? 0.6 * sstep(0.3, 0.5, z) : 0);
    }, { y: 0.1 });
    P.legs([[0.02, 0.06, -0.38], [0.07, 0.03, -0.42], [0.08, 0.0, -0.36]], 0.008, 0x2a1c16);
    P.legs([[0.02, 0.06, -0.33], [0.08, 0.03, -0.32], [0.1, 0.0, -0.26]], 0.008, 0x2a1c16);
    P.legs([[0.02, 0.06, -0.28], [0.08, 0.03, -0.24], [0.1, 0.0, -0.16]], 0.008, 0x2a1c16);
    return { body: P.build(), mat: 'gloss', wings: { kind: 'dragonfly', W: 0.74, H: 0.74, zoff: 0.06, at: [0.02, 0.15, -0.36] } };
  },
  ladybug() {
    const P = new Parts();
    const spots = [[0, 0.62, -0.78], [0.62, 0.58, -0.2], [0.45, 0.6, 0.45], [0.82, 0.25, 0.25]];
    P.ell([0, 0.1, 0.07], [0.4, 0.3, 0.43], (x, y, z) => {
      let s = 0; for (const [a, b, c] of spots) for (const sx of a ? [-1, 1] : [1]) { const d = Math.hypot(x - sx * a, y - b, z - c); s = Math.max(s, 1 - sstep(0.17, 0.24, d)); }
      const seam = 1 - sstep(0.012, 0.03, Math.abs(x));
      const red = mix(0xe0401e, 0xb8200e, 0.4 + 0.4 * z);
      return mix(mix(red, 0x120c0a, s), 0x200a06, seam * (y > 0 ? 0.8 : 0));
    }, { ws: 112, hs: 72, squash: 0.3 });
    P.ell([0, 0.12, -0.35], [0.29, 0.15, 0.15], (x, y, z) => mix(0x14100e, 0xf2eee0, sstep(0.5, 0.65, Math.abs(x)) * sstep(-0.2, 0.3, -z)), { ws: 24, hs: 14 });
    P.ell([0, 0.08, -0.47], [0.14, 0.09, 0.08], (x, y) => mix(0x14100e, 0xf2eee0, sstep(0.45, 0.6, Math.abs(x)) * sstep(0, 0.4, y)), { ws: 14, hs: 10 });
    for (const z of [-0.26, -0.08, 0.1]) P.legs([[0.12, 0.05, z], [0.3, 0.05, z - 0.03], [0.37, 0, z + 0.05]], 0.018, 0x120c0a);
    for (const s of [-1, 1]) P.tube([s * 0.06, 0.1, -0.52], [s * 0.14, 0.14, -0.62], 0.012, 0.016, 0x120c0a, 5);
    return { body: P.build(), mat: 'gloss' };
  },
  grasshopper() {
    const P = new Parts(); const G = 0x7cab3c, D = 0x5a7a2a, B = 0x7a5a32;
    P.ell([0, 0.17, -0.42], [0.075, 0.1, 0.085], (x, y, z) => mix(G, B, sstep(0.3, 0.6, Math.abs(x)) * sstep(-0.2, 0.3, y) * 0.8), { rot: [0.5, 0, 0] });
    for (const s of [-1, 1]) {
      P.ell([s * 0.06, 0.21, -0.45], [0.03, 0.04, 0.035], 0x6a5a3a);
      P.tube([s * 0.03, 0.24, -0.48], [s * 0.1, 0.36, -0.72], 0.008, 0.005, B, 5);
    }
    P.ell([0, 0.19, -0.26], [0.085, 0.09, 0.13], (x, y, z) => mix(G, 0x3a2a18, sstep(0.75, 0.85, Math.abs(x)) * 0.8));
    P.lathe([[-0.16, 0.06], [-0.05, 0.075], [0.15, 0.07], [0.35, 0.055], [0.47, 0.03], [0.5, 0.005]], (x, y, z) => mix(mix(0xa8c068, G, sstep(0.1, 0.17, y)), D, 0.3 + 0.3 * Math.cos(z * 60)), { y: 0.16, sy: 1.05 });
    P.ell([0, 0.235, 0.12], [0.06, 0.018, 0.36], (x, y, z) => mix(0x8a9a58, B, 0.3 + 0.4 * sstep(-0.2, 1, z)), { rot: [-0.06, 0, 0] });
    P.legs([[0.06, 0.12, -0.32], [0.1, 0.08, -0.38], [0.11, 0.0, -0.33]], 0.012, G);
    P.legs([[0.06, 0.12, -0.2], [0.12, 0.08, -0.18], [0.14, 0.0, -0.1]], 0.012, G);
    // big hind legs: drumstick femur up to the knee, thin tibia back down
    P.legs([[0.07, 0.15, -0.1], [0.12, 0.31, 0.3]], 0.045, (x, y, z) => mix(G, 0xa0b860, sstep(0.18, 0.26, y)), 0.45);
    P.legs([[0.12, 0.31, 0.3], [0.13, 0.03, 0.02], [0.15, 0.0, 0.12]], 0.016, 0x8a9a4a);
    return { body: P.build(), mat: 'matte' };
  },
  acrida() {
    const P = new Parts(); const G = 0x8cc04a, L = 0xb8d878;
    // pointed cone head angled up, sword antennae, long thin body, very long hind legs
    P.lathe([[-0.56, 0.002], [-0.5, 0.025], [-0.42, 0.04], [-0.33, 0.045]], (x, y, z) => mix(L, G, sstep(0.06, 0.1, y)), { y: 0.1 });
    for (const s of [-1, 1]) {
      P.ell([s * 0.035, 0.13, -0.46], [0.018, 0.03, 0.03], 0x9a8a5a);
      P.ell([s * 0.03, 0.135, -0.62], [0.008, 0.012, 0.08], G, { rot: [-0.15, s * 0.15, 0] });
    }
    P.lathe([[-0.34, 0.045], [-0.2, 0.05], [-0.1, 0.045]], G, { y: 0.1 });
    P.lathe([[-0.11, 0.04], [0.1, 0.045], [0.35, 0.035], [0.5, 0.012], [0.53, 0.002]], (x, y, z) => mix(G, 0xd88a9a, sstep(0.04, 0.05, Math.abs(x)) * 0.25), { y: 0.1 });
    P.ell([0, 0.15, 0.17], [0.04, 0.012, 0.42], (x, y, z) => mix(G, 0x6a9a3a, 0.4), { rot: [-0.03, 0, 0] });
    P.legs([[0.03, 0.07, -0.26], [0.07, 0.06, -0.3], [0.09, 0.0, -0.26]], 0.008, G);
    P.legs([[0.03, 0.07, -0.17], [0.08, 0.06, -0.14], [0.1, 0.0, -0.08]], 0.008, G);
    P.legs([[0.04, 0.08, -0.08], [0.1, 0.24, 0.42], [0.11, 0.0, 0.02], [0.12, 0.0, 0.1]], 0.016, G, 0.4);
    return { body: P.build(), mat: 'matte' };
  },
  cicada() {
    const P = new Parts(); const KK = 0x1a1a14, Gm = 0x4a7a3a;
    P.ell([0, 0.14, -0.43], [0.13, 0.07, 0.07], (x, y, z) => mix(KK, Gm, sstep(0.3, 0.6, y) * sstep(0.3, 0.1, Math.abs(x)) * 0.7));
    for (const s of [-1, 1]) P.ell([s * 0.13, 0.155, -0.42], [0.045, 0.05, 0.045], (x, y) => mix(0x5a4030, 0x9a7050, 0.5 + 0.5 * y));
    P.ell([0, 0.16, -0.31], [0.15, 0.09, 0.09], (x, y, z) => mix(KK, Gm, sstep(0.6, 0.85, Math.abs(Math.sin(x * 6 + z * 3))) * 0.8));
    P.ell([0, 0.17, -0.15], [0.14, 0.11, 0.13], (x, y, z) => {
      const w = sstep(0.3, 0.45, Math.abs(Math.abs(x) - 0.35 + z * 0.3)); // W-shaped mark
      return mix(Gm, KK, w * 0.85 + 0.1);
    });
    P.lathe([[-0.06, 0.08], [0.02, 0.12], [0.15, 0.12], [0.3, 0.09], [0.4, 0.04], [0.43, 0.005]], (x, y, z) => mix(KK, 0xb8b8a8, sstep(0.75, 1, 0.5 + 0.5 * Math.cos(z * 50)) * 0.45 * sstep(0.12, 0.18, y)), { y: 0.13, sy: 0.85 });
    P.legs([[0.06, 0.1, -0.3], [0.14, 0.06, -0.4], [0.17, 0.0, -0.46]], 0.016, 0x3a3020);
    P.legs([[0.06, 0.1, -0.2], [0.18, 0.06, -0.2], [0.22, 0.0, -0.14]], 0.014, 0x3a3020);
    P.legs([[0.06, 0.1, -0.1], [0.18, 0.06, 0.0], [0.22, 0.0, 0.1]], 0.014, 0x3a3020);
    return { body: P.build(), mat: 'gloss', wings: { kind: 'cicada', W: 1.2, H: 1.2, zoff: 0.09, at: [0.06, 0.25, -0.22], fold: true } };
  },
  beetle() {
    const P = new Parts(); const BR = 0x4a2214, DK = 0x1e100a;
    P.ell([0, 0.17, 0.13], [0.21, 0.16, 0.28], (x, y, z) => mix(mix(BR, 0x6a3420, 0.4 + 0.4 * y), DK, (1 - sstep(0.01, 0.04, Math.abs(x))) * (y > 0 ? 0.9 : 0)), { ws: 28, hs: 18, squash: 0.35 });
    P.ell([0, 0.17, -0.17], [0.18, 0.12, 0.13], (x, y) => mix(DK, 0x3a1c10, 0.5 + 0.5 * y), { ws: 22, hs: 14 });
    P.tube([0, 0.25, -0.2], [0, 0.28, -0.34], 0.03, 0.012, DK, 7); // small horn on the pronotum
    P.ell([0, 0.11, -0.32], [0.08, 0.06, 0.07], DK);
    // long forked head horn
    const H = [[0, 0.1, -0.36], [0, 0.13, -0.45], [0, 0.19, -0.53], [0, 0.28, -0.59], [0, 0.38, -0.61], [0, 0.45, -0.58]];
    for (let i = 0; i < H.length - 1; i++) { const r0 = 0.05 - i * 0.008, r1 = 0.05 - (i + 1) * 0.008; P.tube(H[i], H[i + 1], r0, r1, (x, y) => mix(DK, 0x2a140a, sstep(0.2, 0.45, y)), 10); if (i) P.ell(H[i], [r0, r0, r0], DK, { ws: 10, hs: 6 }); }
    for (const s of [-1, 1]) { P.tube([0, 0.44, -0.58], [s * 0.06, 0.52, -0.55], 0.016, 0.006, DK, 6); P.tube([0, 0.44, -0.58], [s * 0.035, 0.46, -0.64], 0.012, 0.005, DK, 6); }
    for (const s of [-1, 1]) P.tube([s * 0.04, 0.11, -0.38], [s * 0.1, 0.13, -0.44], 0.006, 0.004, 0x5a3020, 4);
    P.legs([[0.12, 0.09, -0.22], [0.22, 0.11, -0.3], [0.27, 0.0, -0.4], [0.3, 0.0, -0.45]], 0.034, DK, 0.4);
    P.legs([[0.14, 0.08, -0.02], [0.27, 0.11, -0.02], [0.33, 0.0, 0.05], [0.36, 0.0, 0.1]], 0.034, DK, 0.4);
    P.legs([[0.13, 0.08, 0.12], [0.25, 0.11, 0.24], [0.3, 0.0, 0.34], [0.32, 0.0, 0.41]], 0.034, DK, 0.4);
    return { body: P.build(), mat: 'gloss' };
  },
  stag() {
    const P = new Parts(); const KB = 0x120d0b, KB2 = 0x2a1e18;
    P.ell([0, 0.11, 0.16], [0.17, 0.085, 0.25], (x, y, z) => mix(mix(KB, KB2, 0.3 + 0.3 * y), 0x000000, (1 - sstep(0.01, 0.035, Math.abs(x))) * 0.8), { ws: 26, hs: 14, squash: 0.4 });
    P.ell([0, 0.11, -0.12], [0.17, 0.07, 0.1], KB2, { ws: 20, hs: 12 });
    P.ell([0, 0.1, -0.27], [0.16, 0.055, 0.085], KB);
    for (const s of [-1, 1]) {
      // the big jaws: thick base, curve in, inner tooth
      const J = [[s * 0.08, 0.1, -0.33], [s * 0.12, 0.11, -0.43], [s * 0.1, 0.12, -0.55], [s * 0.035, 0.12, -0.63]];
      P.leg(J, 0.045, (x, y, z) => mix(KB, 0x3a2a20, sstep(-0.4, -0.63, z) * 0.6), 0.3);
      P.tube([s * 0.11, 0.11, -0.47], [s * 0.065, 0.115, -0.49], 0.014, 0.004, KB, 5);
      P.ell([s * 0.15, 0.11, -0.3], [0.025, 0.025, 0.025], 0x3a2a20);
      P.tube([s * 0.13, 0.1, -0.33], [s * 0.2, 0.12, -0.42], 0.006, 0.006, KB, 4);
    }
    P.legs([[0.1, 0.07, -0.16], [0.24, 0.1, -0.26], [0.32, 0.0, -0.36], [0.36, 0.0, -0.42]], 0.02, KB, 0.5);
    P.legs([[0.12, 0.07, 0.0], [0.28, 0.1, 0.0], [0.38, 0.0, 0.06], [0.42, 0.0, 0.1]], 0.02, KB, 0.5);
    P.legs([[0.12, 0.07, 0.12], [0.26, 0.1, 0.26], [0.32, 0.0, 0.38], [0.34, 0.0, 0.46]], 0.02, KB, 0.5);
    return { body: P.build(), mat: 'gloss' };
  },
  firefly() {
    const P = new Parts();
    P.ell([0, 0.12, 0.05], [0.17, 0.075, 0.32], (x, y) => mix(0x1a1a1c, 0x2e2e32, 0.5 + 0.5 * y), { ws: 18, hs: 12, squash: 0.5 });
    P.ell([0, 0.12, -0.3], [0.17, 0.055, 0.12], (x, y, z) => mix(0xe0602a, 0x1a1210, (1 - sstep(0.15, 0.3, Math.hypot(x, z + 0.1))) * 0.9), { ws: 18, hs: 10 });
    P.ell([0, 0.08, -0.4], [0.07, 0.05, 0.05], 0x1a1614);
    for (const s of [-1, 1]) P.tube([s * 0.04, 0.09, -0.43], [s * 0.15, 0.13, -0.68], 0.01, 0.008, 0x1a1614, 4);
    for (const z of [-0.25, -0.1, 0.05]) P.legs([[0.06, 0.06, z], [0.16, 0.06, z - 0.02], [0.2, 0.0, z + 0.04]], 0.014, 0x1a1614);
    const L = new Parts(); L.ell([0, 0.085, 0.3], [0.11, 0.035, 0.09], 0xffffff, { ws: 12, hs: 8 });
    return { body: P.build(), mat: 'matte', lantern: L.build() };
  },
  ant() {
    const P = new Parts(); const A = 0x16120f, A2 = 0x2e2420;
    P.ell([0, 0.17, -0.36], [0.12, 0.1, 0.11], (x, y) => mix(A, A2, 0.5 + 0.5 * y));
    for (const s of [-1, 1]) {
      P.ell([s * 0.1, 0.19, -0.39], [0.025, 0.03, 0.03], 0x080606);
      P.tube([s * 0.04, 0.13, -0.46], [s * 0.015, 0.12, -0.5], 0.015, 0.006, A2, 5); // jaws
      P.leg([[s * 0.04, 0.24, -0.42], [s * 0.1, 0.33, -0.5], [s * 0.14, 0.26, -0.68], [s * 0.15, 0.2, -0.76]], 0.012, A, 0.6); // elbowed antennae
    }
    P.ell([0, 0.18, -0.15], [0.07, 0.075, 0.15], (x, y) => mix(A, A2, 0.5 + 0.5 * y), { rot: [0.25, 0, 0] });
    P.ell([0, 0.17, 0.02], [0.04, 0.06, 0.035], A);
    P.ell([0, 0.19, 0.22], [0.14, 0.12, 0.18], (x, y, z) => mix(mix(A, A2, 0.5 + 0.5 * y), 0x5a4a40, sstep(0.82, 1, 0.5 + 0.5 * Math.cos(z * 9 + 1)) * 0.5), { ws: 20, hs: 14 });
    P.legs([[0.04, 0.13, -0.2], [0.2, 0.22, -0.32], [0.3, 0.0, -0.44]], 0.014, A, 0.5);
    P.legs([[0.04, 0.13, -0.13], [0.24, 0.22, -0.1], [0.36, 0.0, -0.02]], 0.014, A, 0.5);
    P.legs([[0.04, 0.13, -0.07], [0.22, 0.22, 0.12], [0.34, 0.0, 0.3]], 0.014, A, 0.5);
    return { body: P.build(), mat: 'gloss' };
  },
  mantis() {
    const P = new Parts(); const G = 0x8ab44a, G2 = 0x6a9438, LG = 0xb8d07a;
    // triangular head with big eyes on a long neck, folded raptorial arms, leafy wings over a broad abdomen
    P.ell([0, 0.31, -0.45], [0.05, 0.045, 0.03], G, { rot: [0.4, 0, 0] });
    for (const s of [-1, 1]) {
      P.ell([s * 0.06, 0.33, -0.45], [0.03, 0.035, 0.03], (x, y) => mix(0x9ab860, 0x3a4a2a, sstep(0.3, 0.9, -x * s) * 0.4));
      P.tube([s * 0.02, 0.35, -0.47], [s * 0.12, 0.5, -0.72], 0.004, 0.003, G2, 4);
    }
    P.tube([0, 0.17, -0.12], [0, 0.29, -0.42], 0.022, 0.018, G, 8);
    for (const s of [-1, 1]) {
      // coxa down, femur with spines folded back up, tibia hooked
      P.leg([[s * 0.025, 0.26, -0.36], [s * 0.04, 0.12, -0.44], [s * 0.035, 0.24, -0.5], [s * 0.03, 0.18, -0.54]], 0.018, (x, y) => mix(G, LG, sstep(0.15, 0.25, y)), 0.6);
      for (let i = 0; i < 4; i++) P.tube([s * 0.04, 0.14 + i * 0.025, -0.455 - i * 0.012], [s * 0.04, 0.14 + i * 0.025, -0.43 - i * 0.012], 0.004, 0.001, 0x3a4a22, 3);
    }
    P.lathe([[-0.12, 0.03], [0.0, 0.055], [0.2, 0.065], [0.42, 0.04], [0.52, 0.01]], (x, y, z) => mix(G2, LG, sstep(0.1, 0.05, y)), { y: 0.14, sx: 1.2, sy: 0.8 });
    P.ell([0, 0.18, 0.18], [0.07, 0.014, 0.36], (x, y, z) => mix(G, 0x7a6a3a, (1 - sstep(0.06, 0.12, Math.hypot(x - 0.25, z + 0.3))) * 0.8), { rot: [-0.05, 0, 0] });
    P.legs([[0.03, 0.14, -0.1], [0.16, 0.18, -0.12], [0.22, 0.0, -0.06]], 0.01, G2);
    P.legs([[0.03, 0.14, 0.0], [0.18, 0.2, 0.08], [0.24, 0.0, 0.2]], 0.01, G2);
    return { body: P.build(), mat: 'matte' };
  },
  jewel() {
    const P = new Parts();
    const paintJ = (x, y, z) => {
      const st = 1 - sstep(0.06, 0.12, Math.abs(Math.abs(x) - 0.55)); // two red-purple stripes
      return mix(mix(0x2a9a5a, 0x50c060, 0.5 + 0.5 * y), 0xa02a5a, st * 0.85);
    };
    P.lathe([[-0.1, 0.1], [0.05, 0.12], [0.25, 0.1], [0.4, 0.06], [0.5, 0.01]], (x, y, z) => paintJ(x / 0.12, (y - 0.12) / 0.08, z), { y: 0.12, sy: 0.7 });
    P.ell([0, 0.12, -0.2], [0.1, 0.07, 0.09], (x, y, z) => paintJ(x * 0.9, y, z), { ws: 20, hs: 12 });
    P.ell([0, 0.1, -0.31], [0.065, 0.055, 0.05], 0x2a8a5a);
    for (const s of [-1, 1]) { P.ell([s * 0.05, 0.12, -0.32], [0.02, 0.025, 0.025], 0x3a2a2a); P.tube([s * 0.03, 0.12, -0.35], [s * 0.1, 0.14, -0.46], 0.006, 0.004, 0x2a6a4a, 4); }
    P.legs([[0.06, 0.07, -0.18], [0.14, 0.07, -0.24], [0.17, 0.0, -0.3]], 0.012, 0x2a7a50);
    P.legs([[0.06, 0.07, -0.05], [0.16, 0.07, -0.04], [0.2, 0.0, 0.02]], 0.012, 0x2a7a50);
    P.legs([[0.06, 0.07, 0.06], [0.15, 0.07, 0.14], [0.18, 0.0, 0.22]], 0.012, 0x2a7a50);
    return { body: P.build(), mat: 'jewel' };
  },
};

const cache = new Map();
function protoFor(id) {
  if (!cache.has(id)) {
    const p = BUILD[id]();
    if (p.wings) p.wingGeo = wingGeo(p.wings.W, p.wings.H, p.wings.zoff);
    cache.set(id, p);
  }
  return cache.get(id);
}

/**
 * buildInsect(id) → {id, group, wings: [right, left] pivots or null, lantern, pose(mode, t, k)}.
 * group: put it where the insect is, scaled to its size (body about 1 unit long, faces -Z).
 * pose modes: 'fly', 'rest', 'open' (wings spread flat, for pictures), 'walk'.
 */
export function buildInsect(id) {
  const p = protoFor(id), m = mats();
  const group = new THREE.Group();
  group.name = 'insect-' + id;
  const body = new THREE.Mesh(p.body, m[p.mat]);
  group.add(body);
  let wings = null, lantern = null;
  if (p.wings) {
    const wm = wingMaterial(p.wings.kind);
    wings = [1, -1].map((s) => {
      const piv = new THREE.Group();
      piv.position.set(s * p.wings.at[0], p.wings.at[1], p.wings.at[2]);
      piv.rotation.order = 'YZX';
      const w = new THREE.Mesh(p.wingGeo, wm);
      w.scale.x = s;
      w.renderOrder = 2;
      piv.add(w);
      group.add(piv);
      return piv;
    });
  }
  if (p.lantern) { lantern = new THREE.Mesh(p.lantern, m.lantern); group.add(lantern); }
  for (const o of [body, lantern, ...(wings ?? []).map((w) => w.children[0])]) if (o) { o.castShadow = false; o.receiveShadow = false; }
  const fam = p.wings?.kind;
  const setWing = (rx, ry, rz) => { if (!wings) return; wings[0].rotation.set(rx, ry, rz); wings[1].rotation.set(rx, -ry, -rz); };
  function pose(mode, t = 0, k = 0) {
    if (!wings) return;
    if (fam === 'swallowtail' || fam === 'cabbage') {
      const f = fam === 'swallowtail' ? 6.5 : 9;
      if (mode === 'fly') setWing(0, 0, 0.5 + 0.95 * Math.sin(t * TAU * f));
      else if (mode === 'open') setWing(0, 0, 0.08);
      else setWing(0, 0, 1.45 - k * 1.25 - 0.06 * Math.sin(t * 2)); // closed above the back, k: basking open
    } else if (fam === 'dragonfly') {
      if (mode === 'fly') setWing(0, 0, 0.1 + 0.55 * Math.sin(t * TAU * 23 + Math.sin(t * 7) * 2));
      else setWing(0, 0, -0.06);
    } else if (fam === 'cicada') {
      if (mode === 'fly') setWing(0, -0.2, 0.25 + 0.6 * Math.sin(t * TAU * 26));
      else if (mode === 'open') setWing(0, -0.55, 0.05);
      else setWing(-0.6, -1.4, -0.06); // folded back like a roof over the abdomen
    }
  }
  pose('rest', 0, 0);
  return { id, group, body, wings, lantern, pose };
}

/** Species with model builders (the game checks this against the species table). */
export const MODEL_IDS = Object.keys(BUILD);

// ------------------------------------------------------------------ the bug net (잠자리채)
/**
 * buildNet() → {group, bag, hoop}. Origin at the hand grip, handle along +Y (about 1.1 m), the hoop
 * at the top with its opening facing -X (the way it sweeps) and the green mesh bag trailing +X.
 */
export function buildNet() {
  const g = new THREE.Group(); g.name = 'bugNet';
  // bamboo pole with nodes and a rubber grip
  const bam = new THREE.MeshStandardMaterial({ color: 0xc8a868, roughness: 0.55 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 1.12, 10), bam);
  pole.position.y = 0.3; g.add(pole);
  const nodeM = new THREE.MeshStandardMaterial({ color: 0xa88848, roughness: 0.5 });
  for (let i = 0; i < 4; i++) { const n = new THREE.Mesh(new THREE.TorusGeometry(0.0125, 0.0028, 6, 14), nodeM); n.rotation.x = PI / 2; n.position.y = -0.05 + i * 0.26; g.add(n); }
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.2, 10), new THREE.MeshStandardMaterial({ color: 0x2a3a2a, roughness: 0.9 }));
  grip.position.y = -0.08; g.add(grip);
  // steel hoop and ferrule
  const steel = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.3, metalness: 0.9 });
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.012, 0.06, 8), steel); ferrule.position.y = 0.88; g.add(ferrule);
  const R = 0.19;
  const hoop = new THREE.Group(); hoop.position.y = 0.9 + R; g.add(hoop);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.0042, 6, 40), steel); ring.rotation.y = PI / 2; hoop.add(ring);
  // net bag: a soft rounded cone along +X with a knotted mesh texture
  const tex = canvasTex(64, 64, (x) => {
    x.clearRect(0, 0, 64, 64); x.strokeStyle = 'rgba(255,255,255,1)'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(0, 0); x.lineTo(64, 64); x.moveTo(64, 0); x.lineTo(0, 64); x.stroke();
    x.fillStyle = '#fff'; for (const [a, b] of [[0, 0], [64, 0], [0, 64], [64, 64], [32, 32]]) { x.beginPath(); x.arc(a, b, 3, 0, TAU); x.fill(); }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(14, 6);
  const netM = new THREE.MeshStandardMaterial({ color: 0xbfe0a8, map: tex, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.9 });
  const prof = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; prof.push(new THREE.Vector2(R * (1 - 0.55 * t * t) * (t > 0.9 ? Math.sqrt(Math.max(0, (1 - t) / 0.1)) * 0.98 + 0.02 : 1), t * 0.42)); }
  const bagGeo = new THREE.LatheGeometry(prof, 28);
  bagGeo.rotateZ(-PI / 2); // lathe axis +Y → +X
  const bag = new THREE.Group(); hoop.add(bag);
  const bagMesh = new THREE.Mesh(bagGeo, netM); bag.add(bagMesh);
  // a rim band where the net is sewn to the hoop
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.002, R + 0.002, 0.025, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0xe8f0e0, roughness: 0.9, side: THREE.DoubleSide }));
  band.rotation.z = PI / 2; band.position.x = 0.012; hoop.add(band);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return { group: g, bag, hoop, radius: R };
}

// ------------------------------------------------------------------ viewer helpers
/** All insects in a row, magnified (args.scale, default 8) so they can be looked at: viewer.html?mod=props/insects&fn=insectLineup */
export function insectLineup(args = {}) {
  const g = new THREE.Group();
  const ids = args.ids ?? MODEL_IDS;
  const s = args.scale ?? 1;
  ids.forEach((id, i) => {
    const m = buildInsect(id);
    m.pose(args.mode ?? 'rest', 0.37, args.k ?? 0);
    m.group.scale.setScalar(s);
    if (ids.length > 1) m.group.position.set((i % 5 - 2) * 1.4 * s, 0, Math.floor(i / 5) * 1.5 * s);
    m.group.rotation.y = args.ry ?? 0.6;
    g.add(m.group);
  });
  return g;
}
export function netView() { const n = buildNet(); n.group.rotation.z = -0.3; return n.group; }
