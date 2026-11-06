// 세온 분수 광장 (인혁 계획 7: "어느날엔 공연도 하게 해줘. 그리고 분수를 만들고 분수에서 공연을 하게 해줘").
// buildPlaza() → Site (see ../site.js). Local space: origin = footprint centre, +Z faces the main avenue.
//   fountain   round stone basin with a carved coping, panels with shell reliefs, a two-bowl column with
//              scalloped lips and an acorn finial, rim arcs, a crown jet, 16 show jets, pool lights
//              (water itself: ../fountain.js, animated by ../show.js every frame)
//   stage      a D-shaped deck in front of the fountain, LED edge strip, steps, speaker stacks and two
//              truss towers with moving-head lights (beams are shown during the show)
//   square     fan-paved ring round the basin, granite audience carpet, planted beds with trees,
//              benches, lantern lamps with festoon strings, an advertising column with the show poster,
//              and a granite name stone
import * as THREE from 'three';
import { mat, paint, textured, glow } from '../mat.js';
import { box, rbox, cyl, sphere, torus, lathe, extrude, tube, quad, prep, put, group, bake } from '../geom.js';
import { canvasTex, FONT } from '../tex.js';
import { makeSite, solid } from '../site.js';
import { rng } from '../noise.js';
import { bench } from '../props/street.js';
import { tree, bush, flowerPatch } from '../props/nature.js';
import { FountainWater, fountainEnv, WATER_Y, CROWN_Y, RING_R, ARC_R, N_ARC, N_RING } from '../fountain.js';

const PI = Math.PI;
export const PLAZA_W = 42, PLAZA_D = 34;
export const FC = [0, 0, -3.5];          // fountain centre (local)
export const RO = 5.6, RI = 5.0;          // basin rim outer / inner radius
const RIM_Y = 0.66;
export const STAGE = { y: 0.55, z0: 2.45, zSide: 4.5, zFront: 6.1, hw: 5 };
const FLOOR_Y = 0.1;                      // plaza paving top

// ------------------------------------------------------------------ materials (cached by mat.js)
const M = {
  pave: () => mat('pavers2'),
  granite: () => textured('pavers', { color: 0xa9a59c, count: 4, seed: 21 }, 2.4, { normal: 0.9 }),
  basalt: () => textured('pavers', { color: 0x58595c, count: 8, seed: 22 }, 2.4, { normal: 0.8 }),
  lime: () => textured('stone', { color: 0xcdbfa4, seed: 31 }, 1.3, { normal: 0.9 }),
  ashlar: () => textured('pavers', { color: 0xcab99c, count: 4, seed: 33 }, 2.4, { normal: 1.1 }),
  mosaic: () => textured('tiles', { color: 0x3a93a8, grout: 0x1d4f5c, count: 12, groutWidth: 0.05, rough: 0.3 }, 1.2, { normal: 0.5 }),
  bronze: () => paint(0x8c6a3c, 0.32, 0.9),
  iron: () => paint(0x222a26, 0.45, 0.55),
  deck: () => textured('planks', { color: 0x6e4c34, seed: 4 }, 2.4, { normal: 0.6 }),
  skirt: () => paint(0x1c1d21, 0.85),
  truss: () => paint(0xc9ced4, 0.3, 0.9),
  black: () => paint(0x17181b, 0.55, 0.1),
  grille: () => textured('fabric', { color: 0x202124, weave: 160, seed: 5 }, 0.3, { normal: 0.8 }),
  soil: () => mat('dirt'),
  lawn: () => mat('grass'),
};

/** Cylindrical UVs in metres (u around the axis, v up) so block patterns wrap round curved walls. */
function cylUV(g, r, vScale = 1, v0 = 0) {
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    uv.setXY(i, Math.atan2(x, z) * r, (p.getY(i) - v0) * vScale);
  }
  return g;
}

/** Lathe with a radius modulation fn(phi, y, r) → new r (carving: scallops, flutes, gadroons). */
function carved(pts, seg, fn) {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-5) continue;
    const phi = Math.atan2(x, z);
    const out = fn(phi, y, r);
    const k = out.r / r;
    p.setXYZ(i, x * k, out.y ?? y, z * k);
  }
  g.computeVertexNormals();
  return prep(g);
}

/** Fan paving: bands of setts round a centre, staggered like real circle paving. */
function fanRing(r0, r1, bands, y, sett = 0.6) {
  const w = (r1 - r0) / bands, pos = [], uv = [], nor = [];
  for (let b = 0; b < bands; b++) {
    const ra = r0 + b * w, rb = ra + w, n = Math.max(6, Math.round(2 * PI * (ra + rb) / 2 / sett));
    const around = n * 2, off = (b % 2) * 0.5;
    for (let i = 0; i < around; i++) {
      const a0 = (i / around) * 2 * PI, a1 = ((i + 1) / around) * 2 * PI;
      const u0 = (i / 2 + off) * sett, u1 = ((i + 1) / 2 + off) * sett, v0 = b * sett, v1 = v0 + sett * 0.999;
      const P = (r, a) => [Math.sin(a) * r, y, Math.cos(a) * r];
      const q = [[P(ra, a0), u0, v0], [P(rb, a0), u0, v1], [P(rb, a1), u1, v1], [P(ra, a1), u1, v0]];
      for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(...q[k][0]); uv.push(q[k][1], q[k][2]); nor.push(0, 1, 0); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return prep(g, true);
}

function rod(parent, a, b, r, m, seg = 6) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
  const o = put(parent, cyl(r, r, d.length(), seg), m, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return o;
}

// ------------------------------------------------------------------ canvas art
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function star(c, x, y, r, col) {
  c.fillStyle = col; c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, rr2 = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
  c.closePath(); c.fill();
}
function noteGlyph(c, x, y, s, col) {
  c.fillStyle = col; c.strokeStyle = col; c.lineWidth = s * 0.12;
  c.beginPath(); c.ellipse(x, y, s * 0.32, s * 0.24, -0.4, 0, PI * 2); c.fill();
  c.beginPath(); c.moveTo(x + s * 0.28, y - s * 0.05); c.lineTo(x + s * 0.28, y - s * 1.1); c.quadraticCurveTo(x + s * 0.7, y - s * 0.9, x + s * 0.62, y - s * 0.55); c.stroke();
}
function drawFountain(c, x, y, s, jetCol = '#bfeaff') {
  c.fillStyle = '#e9e1d0';
  rr(c, x - s * 1.1, y - s * 0.1, s * 2.2, s * 0.32, s * 0.08); c.fill();
  c.fillStyle = '#5ab8d8'; c.fillRect(x - s * 1.0, y - s * 0.14, s * 2.0, s * 0.08);
  c.fillStyle = '#e9e1d0';
  c.beginPath(); c.moveTo(x - s * 0.12, y - s * 0.1); c.lineTo(x - s * 0.08, y - s * 0.55); c.lineTo(x + s * 0.08, y - s * 0.55); c.lineTo(x + s * 0.12, y - s * 0.1); c.fill();
  c.beginPath(); c.ellipse(x, y - s * 0.55, s * 0.5, s * 0.08, 0, 0, PI * 2); c.fill();
  c.beginPath(); c.ellipse(x, y - s * 0.85, s * 0.26, s * 0.05, 0, 0, PI * 2); c.fill();
  c.fillRect(x - s * 0.05, y - s * 0.85, s * 0.1, s * 0.3);
  c.strokeStyle = jetCol; c.lineWidth = s * 0.05; c.lineCap = 'round';
  for (const k of [-1, 1]) for (let i = 0; i < 3; i++) {
    c.beginPath(); c.moveTo(x + k * s * (0.95 - i * 0.18), y - s * 0.12);
    c.quadraticCurveTo(x + k * s * (0.75 - i * 0.2), y - s * (0.85 + i * 0.15), x + k * s * (0.45 - i * 0.12), y - s * 0.16); c.stroke();
  }
  c.beginPath(); c.moveTo(x, y - s * 0.9); c.lineTo(x, y - s * 1.6); c.stroke();
  for (let i = 0; i < 9; i++) { const a = -PI / 2 + (i - 4) * 0.32; c.beginPath(); c.arc(x + Math.cos(a) * s * 0.35, y - s * 1.55 + Math.sin(a) * s * 0.2 + s * 0.25, s * 0.035, 0, PI * 2); c.fillStyle = jetCol; c.fill(); }
}
/** The show poster: 금요 분수 콘서트, every Friday 7 pm at the fountain plaza. */
export function drawShowPoster(c, x, y, w, h) {
  const g = c.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#1b1446'); g.addColorStop(0.55, '#3a1d6e'); g.addColorStop(1, '#0d2a4a');
  c.fillStyle = g; rr(c, x, y, w, h, w * 0.04); c.fill();
  const R = rng(5);
  for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,255,255,${0.3 + R() * 0.6})`; c.beginPath(); c.arc(x + R() * w, y + R() * h * 0.55, 1 + R() * 2.5, 0, PI * 2); c.fill(); }
  // spotlight beams
  for (const [bx, col] of [[0.18, 'rgba(255,90,200,0.28)'], [0.82, 'rgba(90,200,255,0.28)'], [0.5, 'rgba(255,230,120,0.22)']]) {
    c.fillStyle = col; c.beginPath(); c.moveTo(x + w * bx, y + h * 0.3); c.lineTo(x + w * (bx - 0.22), y + h); c.lineTo(x + w * (bx + 0.22), y + h); c.fill();
  }
  drawFountain(c, x + w / 2, y + h * 0.78, w * 0.3);
  star(c, x + w * 0.16, y + h * 0.12, w * 0.05, '#ffd84a');
  star(c, x + w * 0.86, y + h * 0.2, w * 0.035, '#ff9ad8');
  noteGlyph(c, x + w * 0.8, y + h * 0.5, w * 0.09, '#ffe27a');
  noteGlyph(c, x + w * 0.16, y + h * 0.48, w * 0.07, '#9ae6ff');
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#ffe27a'; c.font = `${Math.round(w * 0.085)}px ${FONT}`; c.fillText('매주 금요일 밤', x + w / 2, y + h * 0.1);
  c.font = `${Math.round(w * 0.15)}px ${FONT}`; c.lineWidth = w * 0.02; c.strokeStyle = '#ff4fa0'; c.strokeText('분수 콘서트', x + w / 2, y + h * 0.24);
  c.fillStyle = '#ffffff'; c.fillText('분수 콘서트', x + w / 2, y + h * 0.24);
  c.fillStyle = '#ffffff'; c.font = `${Math.round(w * 0.075)}px ${FONT}`; c.fillText('🎤 저녁 7시 · 세온 분수 광장', x + w / 2, y + h * 0.37);
  c.fillStyle = 'rgba(255,255,255,0.85)'; c.font = `${Math.round(w * 0.055)}px ${FONT}`; c.fillText('노래 · 춤 · 음악 분수 쇼', x + w / 2, y + h * 0.45);
  c.fillStyle = '#ffd84a'; rr(c, x + w * 0.25, y + h * 0.9, w * 0.5, h * 0.065, h * 0.03); c.fill();
  c.fillStyle = '#3a1d6e'; c.font = `${Math.round(w * 0.06)}px ${FONT}`; c.fillText('누구나 무료!', x + w / 2, y + h * 0.934);
}
function posterWrap() {
  return canvasTex(1536, 896, (c, w, h) => {
    c.fillStyle = '#e8e2d2'; c.fillRect(0, 0, w, h);
    // three posters round the column, plus a pasted strip
    drawShowPoster(c, 24, 30, 480, 836);
    // 소원 분수 poster
    let x = 536;
    c.fillStyle = '#fff6df'; rr(c, x, 30, 460, 836, 18); c.fill();
    c.fillStyle = '#5ab8d8'; rr(c, x + 20, 50, 420, 330, 16); c.fill();
    drawFountain(c, x + 230, 330, 150, '#ffffff');
    c.fillStyle = '#f2b632'; c.beginPath(); c.arc(x + 330, 120, 34, 0, PI * 2); c.fill();
    c.fillStyle = '#c98a10'; c.font = `40px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('100', x + 330, 122);
    c.fillStyle = '#2a4a6a'; c.font = `66px ${FONT}`; c.fillText('소원의 분수', x + 230, 470);
    c.font = `36px ${FONT}`; c.fillStyle = '#4a6a8a';
    c.fillText('동전을 퐁당 던지고', x + 230, 560); c.fillText('소원을 빌어 보세요', x + 230, 610);
    star(c, x + 120, 720, 30, '#f2b632'); star(c, x + 230, 740, 22, '#ff9ad8'); star(c, x + 340, 720, 30, '#5ab8d8');
    c.font = `30px ${FONT}`; c.fillStyle = '#7a8a9a'; c.fillText('분수에 들어가지 마세요!', x + 230, 815);
    // 동네 사진 대회 poster
    x = 1028;
    c.fillStyle = '#ffe9e0'; rr(c, x, 30, 484, 836, 18); c.fill();
    c.fillStyle = '#ff7a5a'; c.font = `62px ${FONT}`; c.fillText('세온 동네', x + 242, 110); c.fillText('사진 대회', x + 242, 185);
    c.fillStyle = '#ffffff'; rr(c, x + 70, 240, 344, 290, 10); c.fill();
    const sky2 = c.createLinearGradient(0, 260, 0, 500); sky2.addColorStop(0, '#8ad0ff'); sky2.addColorStop(1, '#d8f0ff');
    c.fillStyle = sky2; c.fillRect(x + 86, 256, 312, 258);
    c.fillStyle = '#7ac070'; c.beginPath(); c.moveTo(x + 86, 514); c.quadraticCurveTo(x + 200, 400, x + 300, 470); c.quadraticCurveTo(x + 360, 430, x + 398, 470); c.lineTo(x + 398, 514); c.fill();
    c.fillStyle = '#ffd84a'; c.beginPath(); c.arc(x + 340, 310, 30, 0, PI * 2); c.fill();
    c.fillStyle = '#7a5a8a'; c.font = `36px ${FONT}`; c.fillText('P 키로 찍은 사진을', x + 242, 600); c.fillText('친구에게 보여 줘요', x + 242, 650);
    c.fillStyle = '#ff7a5a'; rr(c, x + 110, 720, 264, 70, 35); c.fill();
    c.fillStyle = '#ffffff'; c.font = `38px ${FONT}`; c.fillText('1등 선물: 햄찌 인형', x + 242, 757);
    // tape, wear
    c.fillStyle = 'rgba(255,255,240,0.55)';
    for (const tx of [60, 450, 580, 960, 1070, 1470]) c.fillRect(tx, 18, 46, 26);
    c.fillStyle = 'rgba(80,70,50,0.06)'; for (let i = 0; i < 400; i++) c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  });
}
function nameStone() {
  return canvasTex(1024, 320, (c, w, h) => {
    c.fillStyle = '#3d3f43'; c.fillRect(0, 0, w, h);
    const R = rng(9);
    for (let i = 0; i < 2500; i++) { c.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '0,0,0'},${0.04 + R() * 0.08})`; c.fillRect(R() * w, R() * h, 2, 2); }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `130px ${FONT}`;
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillText('세온 분수 광장', w / 2 + 3, 128 + 4);
    c.fillStyle = '#d9c9a0'; c.fillText('세온 분수 광장', w / 2, 128);
    c.font = `44px ${FONT}`; c.fillStyle = '#b8ab88'; c.fillText('SEON FOUNTAIN PLAZA', w / 2, 248);
  });
}
function plaque() {
  return canvasTex(256, 96, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#c9a25a'); g.addColorStop(1, '#8a6a32');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#5a4420'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
    c.fillStyle = '#3a2a10'; c.font = `38px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('소원의 분수', w / 2, h / 2 + 2);
  });
}

// ------------------------------------------------------------------ pieces
/** Classic lantern lamp, ~3.9 m. Returns the lantern centre height. */
function lanternLamp(p, x, z, glassM) {
  const g = group(p, x, FLOOR_Y, z);
  const iron = M.iron();
  put(g, lathe([[0.24, 0], [0.24, 0.1], [0.2, 0.14], [0.16, 0.3], [0.12, 0.48], [0.1, 0.56], [0.075, 0.62], [0, 0.62]], 24), iron);
  put(g, cyl(0.055, 0.068, 2.75, 16), iron, 0, 0.62 + 1.375, 0);
  for (const y of [1.0, 3.3]) put(g, torus(0.07, 0.016, 6, 20), iron, 0, y, 0, PI / 2);
  put(g, lathe([[0.06, 3.37], [0.12, 3.4], [0.14, 3.44], [0.0, 3.44]], 16), iron);
  // lantern: hexagonal frosted glass, iron frame, roof and finial
  const glassG = cyl(0.17, 0.12, 0.42, 6);
  put(g, glassG, glassM, 0, 3.66, 0).castShadow = false;
  for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * PI * 2 + PI / 6; rod(g, [Math.sin(a) * 0.125, 3.45, Math.cos(a) * 0.125], [Math.sin(a) * 0.175, 3.88, Math.cos(a) * 0.175], 0.01, iron, 5); }
  put(g, lathe([[0.2, 3.86], [0.24, 3.88], [0.2, 3.94], [0.1, 4.04], [0.04, 4.1], [0, 4.12]], 6), iron);
  put(g, sphere(0.035, 10, 8), iron, 0, 4.15, 0);
  return 3.66;
}

/** Square box truss tower with a top plate. */
function trussTower(p, x, z, h) {
  const g = group(p, x, FLOOR_Y, z);
  const m = M.truss(), s = 0.15;
  put(g, rbox(0.6, 0.04, 0.6, 0.01), M.black(), 0, 0.02, 0);
  const C = [[-s, -s], [s, -s], [s, s], [-s, s]];
  for (const [a, b] of C) put(g, cyl(0.024, 0.024, h, 8), m, a, h / 2 + 0.04, b);
  const step = 0.5;
  for (let y = 0.1; y < h - 0.05; y += step) for (let i = 0; i < 4; i++) {
    const [a, b] = C[i], [c, d] = C[(i + 1) % 4];
    rod(g, [a, y, b], [c, y, d], 0.011, m);
    rod(g, [a, y, b], [c, Math.min(h, y + step), d], 0.01, m);
  }
  put(g, rbox(0.42, 0.05, 0.42, 0.01), m, 0, h + 0.06, 0);
  return g;
}

/** Moving-head light: pan yoke + tilting head, lens and beam (beam shows at night during the show). */
function movingHead(p, x, y, z, beamMat) {
  const base = group(p, x, y, z);
  put(base, rbox(0.34, 0.14, 0.28, 0.03), M.black(), 0, 0.07, 0);
  const pan = group(base, 0, 0.14, 0);
  pan.userData.dynamic = true;
  put(pan, rbox(0.3, 0.04, 0.14, 0.015), M.black(), 0, 0.02, 0);
  for (const s of [-1, 1]) put(pan, rbox(0.04, 0.3, 0.12, 0.012), M.black(), s * 0.16, 0.17, 0);
  const tilt = group(pan, 0, 0.24, 0);
  put(tilt, cyl(0.12, 0.13, 0.32, 20), M.black(), 0, 0, 0, PI / 2);
  const lensM = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.2 });
  put(tilt, cyl(0.1, 0.1, 0.01, 20), lensM, 0, 0, 0.165, PI / 2).castShadow = false;
  const L = 18;
  const bg = new THREE.CylinderGeometry(0.09, 2.2, L, 28, 1, true).rotateX(-PI / 2).translate(0, 0, L / 2 + 0.17);
  const beam = new THREE.Mesh(bg, beamMat);
  beam.castShadow = false; beam.receiveShadow = false;
  beam.visible = false;
  beam.renderOrder = 6;
  beam.frustumCulled = false;
  tilt.add(beam);
  return { base, pan, tilt, lensM, beam };
}

const beamVert = /* glsl */`
varying float vV; varying vec3 vN; varying vec3 vE;
void main(){ vV = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; vN = normalize(normalMatrix * normal); vE = normalize(-mv.xyz); }`;
const beamFrag = /* glsl */`
uniform vec3 uCol; uniform float uI; uniform float uTime;
varying float vV; varying vec3 vN; varying vec3 vE;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  float e = clamp(abs(dot(normalize(vN), normalize(vE))), 0.0, 1.0);
  float edge = e * e;
  float v = clamp(vV, 0.0, 1.0);
  float fall = v * sqrt(v) * mix(1.0, v, 0.1);           // ~v^1.6, safe at the far end (no pow of a negative)
  float dust = 0.85 + 0.15 * sin(vV * 40.0 - uTime * 1.5 + h(floor(gl_FragCoord.xy * 0.25)) * 0.5);
  gl_FragColor = vec4(uCol * uI * edge * fall * dust * 0.55, 1.0);
}`;
export function makeBeamMat() {
  return new THREE.ShaderMaterial({
    vertexShader: beamVert, fragmentShader: beamFrag,
    uniforms: { uCol: { value: new THREE.Color(1, 1, 1) }, uI: { value: 0 }, uTime: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
}

/** Speaker cabinet with a grille face (+Z) and a horn. */
function speaker(p, x, y, z, w, h, d, ry = 0) {
  const g = group(p, x, y, z, ry);
  put(g, rbox(w, h, d, 0.02), M.black(), 0, h / 2, 0);
  put(g, rbox(w - 0.06, h - 0.06, 0.01, 0.005), M.grille(), 0, h / 2, d / 2 + 0.002).castShadow = false;
  put(g, rbox(w * 0.5, h * 0.18, 0.012, 0.01), M.black(), 0, h * 0.82, d / 2 + 0.008);
  return g;
}

// ------------------------------------------------------------------ builder
export function buildPlaza() {
  const site = makeSite('세온 분수 광장', PLAZA_W, PLAZA_D);
  const S = site.group;
  const W = PLAZA_W, D = PLAZA_D, hw = W / 2, hd = D / 2;
  const R = rng(77);

  // ---- paving: base slab, fan ring round the basin, borders, audience carpet
  put(S, rbox(W, FLOOR_Y, D, 0.03), M.pave(), 0, FLOOR_Y / 2, 0);
  solid(site, 0, FLOOR_Y / 2, 0, W, FLOOR_Y, D);
  const fan = put(S, fanRing(RO + 0.25, 9.6, 6, FLOOR_Y + 0.004), M.granite(), FC[0], 0, FC[2]);
  fan.castShadow = false;
  for (const [r0, r1] of [[RO, RO + 0.25], [9.6, 9.95]]) put(S, fanRing(r0, r1, 1, FLOOR_Y + 0.006, 0.3), M.basalt(), FC[0], 0, FC[2]).castShadow = false;
  // perimeter band
  for (const [x, z, w, d] of [[0, hd - 0.3, W, 0.6], [0, -hd + 0.3, W, 0.6], [hw - 0.3, 0, 0.6, D], [-hw + 0.3, 0, 0.6, D]]) put(S, box(w, 0.012, d), M.basalt(), x, FLOOR_Y + 0.006, z).castShadow = false;
  // audience carpet with a basalt frame
  put(S, box(16.4, 0.012, 9.6), M.granite(), 0, FLOOR_Y + 0.006, 11.5).castShadow = false;
  for (const [x, z, w, d] of [[0, 6.65, 17, 0.3], [0, 16.35, 17, 0.3], [-8.35, 11.5, 0.3, 9.7], [8.35, 11.5, 0.3, 9.7]]) put(S, box(w, 0.014, d), M.basalt(), x, FLOOR_Y + 0.007, z).castShadow = false;
  // radial granite spokes from the ring to the side beds
  for (const s of [-1, 1]) put(S, box(6, 0.012, 1.2), M.granite(), s * 13, FLOOR_Y + 0.006, FC[2]).castShadow = false;

  // ---- fountain basin
  const F = group(S, FC[0], FC[1], FC[2]);
  const lime = M.lime(), ashlar = M.ashlar();
  // outer wall in ashlar blocks with a plinth
  const wallG = cylUV(prep(new THREE.CylinderGeometry(5.43, 5.43, 0.44, 128, 1, true), true), 5.43, 0.6 / 0.44, -0.22);
  put(F, wallG, ashlar, 0, 0.1 + 0.22, 0);
  put(F, lathe([[5.62, FLOOR_Y], [5.62, FLOOR_Y + 0.06], [5.56, FLOOR_Y + 0.1], [5.46, FLOOR_Y + 0.12], [5.43, FLOOR_Y + 0.12]], 128), lime);
  // carved coping (ogee overhang)
  put(F, lathe([[4.97, 0.42], [4.97, 0.58], [5.0, 0.635], [5.08, RIM_Y], [5.46, RIM_Y], [5.56, 0.652], [5.63, 0.62], [5.645, 0.585], [5.62, 0.56], [5.55, 0.548], [5.52, 0.525], [5.47, 0.51], [5.43, 0.505]], 128), lime);
  // pilasters and shell reliefs on the panels
  const shell = (() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const a = PI * (i / n), r = 0.15 * (1 + 0.08 * Math.cos(i * PI));
      s.lineTo(-Math.cos(a) * r, Math.sin(a) * r * 0.9);
    }
    s.lineTo(0, 0);
    return extrude(s, 0.025, 0.006);
  })();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * PI * 2, c = Math.cos(a), sn = Math.sin(a);
    const pil = put(F, rbox(0.17, 0.4, 0.07, 0.015), lime, sn * 5.46, 0.31, c * 5.46, 0, a, 0);
    pil.castShadow = true;
    const a2 = a + PI / 16;
    put(F, shell, lime, Math.sin(a2) * 5.44, 0.22, Math.cos(a2) * 5.44, 0, a2, 0);
    put(F, sphere(0.03, 10, 8), lime, Math.sin(a2) * 5.46, 0.42, Math.cos(a2) * 5.46);
  }
  // inside: mosaic wall
  {
    const g = new THREE.CylinderGeometry(4.985, 4.985, 0.52, 96, 1, true);
    const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 2]; ix[i + 2] = t; }
    const nr = g.attributes.normal; for (let i = 0; i < nr.count; i++) nr.setXYZ(i, -nr.getX(i), -nr.getY(i), -nr.getZ(i));
    put(F, cylUV(prep(g, true), 4.985, 1, -0.26), M.mosaic(), 0, 0.27, 0).castShadow = false;
  }
  // column: pedestal, lower bowl, stem, upper bowl, acorn finial
  put(F, carved([[1.18, 0.0], [1.18, 0.12], [1.1, 0.17], [1.0, 0.3], [0.85, 0.42], [0.66, 0.52], [0.63, 0.62], [0.7, 0.66], [0.68, 0.72], [0.52, 0.78], [0.45, 0.9], [0.42, 1.05], [0.47, 1.09], [0.5, 1.12], [0.0, 1.12]], 64,
    (phi, y, r) => ({ r: y > 0.78 && y < 1.05 ? r + 0.014 * Math.cos(phi * 20) : r })), lime);
  put(F, carved([[0.44, 1.06], [0.62, 1.13], [0.95, 1.23], [1.35, 1.34], [1.7, 1.45], [1.88, 1.52], [1.95, 1.56], [1.93, 1.6], [1.86, 1.59], [1.7, 1.52], [0.5, 1.4], [0.0, 1.4]], 96,
    (phi, y, r) => {
      const k = Math.max(0, (r - 1.1) / 0.85);
      let nr = r * (1 + 0.035 * k * Math.cos(phi * 14));
      if (y < 1.5 && r > 0.6 && r < 1.88) nr += 0.012 * Math.abs(Math.cos(phi * 16)) * (1 - k * 0.5);
      return { r: nr, y: r > 1.8 ? y + 0.025 * Math.cos(phi * 14) : y };
    }), lime);
  put(F, carved([[0.3, 1.48], [0.34, 1.58], [0.3, 1.64], [0.24, 1.74], [0.22, 1.88], [0.29, 2.02], [0.33, 2.13], [0.28, 2.26], [0.2, 2.34], [0.22, 2.4], [0.28, 2.44], [0.0, 2.44]], 48,
    (phi, y, r) => ({ r: y > 1.9 && y < 2.25 ? r + 0.01 * Math.cos(phi * 12) : r })), lime);
  put(F, carved([[0.2, 2.36], [0.42, 2.41], [0.66, 2.48], [0.86, 2.55], [0.97, 2.6], [0.96, 2.64], [0.89, 2.625], [0.6, 2.56], [0.0, 2.54]], 64,
    (phi, y, r) => { const k = Math.max(0, (r - 0.5) / 0.47); return { r: r * (1 + 0.05 * k * Math.cos(phi * 10)), y: r > 0.85 ? y + 0.02 * Math.cos(phi * 10) : y }; }), lime);
  put(F, carved([[0.16, 2.52], [0.2, 2.6], [0.17, 2.7], [0.12, 2.76], [0.15, 2.82], [0.19, 2.9], [0.15, 2.98], [0.07, 3.03], [0.0, 3.04]], 32,
    (phi, y, r) => ({ r: y > 2.8 ? r * (1 + 0.08 * Math.abs(Math.sin(phi * 4 + y * 30))) : r })), lime);
  put(F, cyl(0.03, 0.04, 0.06, 12), M.bronze(), 0, CROWN_Y - 0.02, 0);
  solid(site, FC[0], 1.6, FC[2], 2.0, 3.2, 2.0);
  // nozzles: arcs on the rim, show jets just under the water
  for (let k = 0; k < N_ARC; k++) {
    const a = (k + 0.5) / N_ARC * PI * 2, c = Math.cos(a), s = Math.sin(a);
    const nz = put(F, lathe([[0.05, 0], [0.045, 0.03], [0.025, 0.06], [0.018, 0.1], [0, 0.1]], 12), M.bronze(), c * (ARC_R + 0.05), RIM_Y - 0.06, s * (ARC_R + 0.05));
    nz.rotation.set(0, 0, 0);
  }
  for (let k = 0; k < N_RING; k++) {
    const a = k / N_RING * PI * 2;
    put(F, cyl(0.05, 0.07, 0.1, 12), M.bronze(), Math.cos(a) * RING_R, WATER_Y - 0.09, Math.sin(a) * RING_R).castShadow = false;
  }
  // wish plaque on the rim (west side)
  { const pg = group(F, -5.27, RIM_Y + 0.004, 0, -PI / 2); put(pg, quad(0.5, 0.19), new THREE.MeshStandardMaterial({ map: plaque(), roughness: 0.35, metalness: 0.6 }), 0, 0, 0, -PI / 2, 0, 0).castShadow = false; }
  // basin collider: annulus approximated by slabs along z
  {
    const n = 12, z0 = -RO;
    for (let i = 0; i < n; i++) {
      const a = z0 + (i / n) * 2 * RO, b = a + (2 * RO) / n;
      const near = Math.min(Math.abs(a), Math.abs(b)) * (a * b < 0 ? 0 : 1), far = Math.max(Math.abs(a), Math.abs(b));
      const xo = Math.sqrt(Math.max(0, RO * RO - near * near));
      const xi = far < RI ? Math.sqrt(RI * RI - far * far) : 0;
      if (xi <= 0.01) solid(site, FC[0], RIM_Y / 2, FC[2] + (a + b) / 2, xo * 2, RIM_Y, b - a);
      else for (const s of [-1, 1]) solid(site, FC[0] + s * (xi + xo) / 2, RIM_Y / 2, FC[2] + (a + b) / 2, xo - xi, RIM_Y, b - a);
    }
  }

  // ---- water (dynamic, animated by show.js)
  const water = new FountainWater();
  water.group.position.set(...FC);
  S.add(water.group);
  const floorM = M.mosaic().clone();
  floorM.color.set(0x7d97a1);
  water.patchFloor(floorM);
  const floor = new THREE.Mesh(prep(new THREE.CircleGeometry(4.99, 96).rotateX(-PI / 2).translate(0, 0.02, 0)), floorM);
  floor.receiveShadow = true;
  water.group.add(floor);

  // ---- stage in front of the fountain
  const st = STAGE;
  const shape = new THREE.Shape();
  shape.moveTo(-st.hw, -st.z0); shape.lineTo(st.hw, -st.z0); shape.lineTo(st.hw, -st.zSide);
  const cz = 2 * st.zFront - st.zSide; // quadratic control so the front reaches zFront
  shape.quadraticCurveTo(0, -cz, -st.hw, -st.zSide); shape.lineTo(-st.hw, -st.z0);
  const body = extrude(shape, st.y - 0.02, 0.015);
  body.rotateX(-PI / 2);
  put(S, body, M.skirt(), 0, 0, 0);
  const top = prep(new THREE.ShapeGeometry(shape, 24).rotateX(-PI / 2));
  put(S, top, M.deck(), 0, st.y + 0.002, 0).castShadow = false;
  // LED strip along the front edge
  const ledM = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x66ccff, emissiveIntensity: 0.2, roughness: 0.3 });
  ledM.name = 'plaza-led';
  const frontCurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(st.hw, st.y - 0.06, st.zSide + 0.02), new THREE.Vector3(0, st.y - 0.06, cz + 0.04), new THREE.Vector3(-st.hw, st.y - 0.06, st.zSide + 0.02));
  put(S, tube(frontCurve, 0.022, 64, 6), ledM).castShadow = false;
  // stage colliders (D shape as slabs) and side steps
  {
    const pts = frontCurve.getPoints(60);
    for (let z = st.z0; z < st.zFront - 0.05; z += 0.4) {
      const z1 = Math.min(st.zFront, z + 0.4);
      let half = st.hw;
      if (z > st.zSide) { half = 0; for (const p of pts) if (p.z >= z - 0.05) half = Math.max(half, Math.abs(p.x)); }
      if (half > 0.2) solid(site, 0, st.y / 2, (z + z1) / 2, half * 2, st.y, z1 - z);
    }
    for (const s of [-1, 1]) {
      for (const [i, h] of [[0, 0.2], [1, 0.38]]) {
        const x = s * (st.hw + 0.55 - i * 0.3);
        put(S, rbox(0.3, h, 1.4, 0.02), M.skirt(), x, h / 2, 3.4);
        put(S, box(0.3, 0.01, 1.4), M.deck(), x, h + 0.005, 3.4).castShadow = false;
        solid(site, x, h / 2, 3.4, 0.3, h, 1.4);
      }
    }
  }
  // uplights on the stage lip (coloured by the show)
  const upM = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.3 });
  upM.name = 'plaza-uplight';
  for (const x of [-3.6, -1.2, 1.2, 3.6]) {
    const zz = st.zSide + (st.zFront - st.zSide) * (1 - (x / st.hw) ** 2) - 0.35;
    put(S, rbox(0.22, 0.14, 0.16, 0.02), M.black(), x, st.y + 0.07, zz);
    put(S, cyl(0.06, 0.06, 0.01, 14), upM, x, st.y + 0.08, zz - 0.085, PI / 2).castShadow = false;
  }
  // speaker stacks and stage monitors
  for (const s of [-1, 1]) {
    speaker(S, s * 6.0, FLOOR_Y, 5.2, 0.8, 0.62, 0.7, s * -0.15);
    speaker(S, s * 6.0, FLOOR_Y + 0.62, 5.2, 0.6, 0.95, 0.5, s * -0.15);
    solid(site, s * 6.0, 0.8, 5.2, 0.9, 1.6, 0.8);
  }
  for (const x of [-2.2, 2.2]) { const m = group(S, x, st.y, 5.15, x < 0 ? 0.2 : -0.2); put(m, rbox(0.5, 0.26, 0.36, 0.03), M.black(), 0, 0.13, 0, -0.5, 0, 0); }
  // truss towers with moving heads
  const beamMats = [];
  const heads = [];
  for (const s of [-1, 1]) {
    const tx = s * 6.7, tz = 3.1, th = 5.2;
    trussTower(S, tx, tz, th);
    solid(site, tx, th / 2, tz, 0.5, th, 0.5);
    for (const dx of [-0.13, 0.13]) {
      const bm = makeBeamMat();
      beamMats.push(bm);
      const h = movingHead(S, tx + dx, FLOOR_Y + th + 0.09, tz, bm);
      h.base.rotation.y = dx < 0 ? 0.1 : -0.1;
      heads.push({ ...h, side: s, x: tx + dx });
    }
    // PAR cans halfway up, aimed at the stage
    const parM = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.3 });
    parM.name = 'plaza-par';
    for (const y of [2.4, 3.4]) {
      const pg = group(S, tx - s * 0.2, FLOOR_Y + y, tz + 0.05, -s * 0.9);
      put(pg, cyl(0.1, 0.12, 0.26, 16), M.black(), 0, 0, 0.1, PI / 2 - 0.3);
      put(pg, cyl(0.088, 0.088, 0.012, 16), parM, 0, 0.041, 0.2305, PI / 2 - 0.3).castShadow = false;
    }
    heads.parM = heads.parM ?? [];
    heads.parM.push(parM);
  }

  // ---- lamps and festoon strings
  const glassM = glow(0xffe4b0, 2.6);
  glassM.name = 'plaza-lantern'; glassM.userData.glowMax = 2.6;
  site.nightGlow.push(glassM);
  const lampXZ = [[-9.4, 15.6], [9.4, 15.6], [-10.2, 5.2], [10.2, 5.2], [-11.2, -10.5], [11.2, -10.5]];
  for (const [x, z] of lampXZ) {
    const ly = lanternLamp(S, x, z, glassM);
    site.lamps.push({ pos: [x, FLOOR_Y + ly, z], color: 0xffd9a0, intensity: 9, range: 13 });
    solid(site, x, 1.5, z, 0.4, 3, 0.4);
  }
  const bulbM = glow(0xffd28a, 3.2);
  bulbM.name = 'plaza-festoon'; bulbM.userData.glowMax = 3.2;
  site.nightGlow.push(bulbM);
  const wireM = paint(0x1a1a1a, 0.7);
  const festoon = (a, b, sag, n) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const pts = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(A.clone().lerp(B, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0))); }
    const curve = new THREE.CatmullRomCurve3(pts);
    put(S, tube(curve, 0.008, 48, 4), wireM).castShadow = false;
    for (let i = 1; i < n; i++) {
      const p = curve.getPoint(i / n);
      put(S, cyl(0.012, 0.012, 0.05, 6), wireM, p.x, p.y - 0.03, p.z).castShadow = false;
      put(S, sphere(0.045, 10, 8), bulbM, p.x, p.y - 0.09, p.z).castShadow = false;
    }
  };
  const ly = FLOOR_Y + 3.82;
  festoon([-9.4, ly, 15.6], [9.4, ly, 15.6], 0.5, 18);
  festoon([-9.4, ly, 15.6], [-10.2, ly, 5.2], 0.7, 14);
  festoon([9.4, ly, 15.6], [10.2, ly, 5.2], 0.7, 14);
  festoon([-10.2, ly, 5.2], [-11.2, ly, -10.5], 0.8, 16);
  festoon([10.2, ly, 5.2], [11.2, ly, -10.5], 0.8, 16);

  // ---- planted beds with trees, bushes and flowers
  const curbM = M.lime();
  const bed = (x0, x1, z0, z1) => {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    put(S, box(w - 0.3, 0.02, d - 0.3), M.lawn(), cx, FLOOR_Y + 0.17, cz).castShadow = false;
    put(S, box(w - 0.3, 0.18, d - 0.3), M.soil(), cx, FLOOR_Y + 0.07, cz).castShadow = false;
    for (const [x, z, ww, dd] of [[cx, z0 + 0.15, w, 0.3], [cx, z1 - 0.15, w, 0.3], [x0 + 0.15, cz, 0.3, d], [x1 - 0.15, cz, 0.3, d]]) put(S, rbox(ww, 0.32, dd, 0.03), curbM, x, FLOOR_Y + 0.16 - 0.04, z);
    solid(site, cx, 0.2, cz, w, 0.4, d);
  };
  bed(-20.6, -15.6, -16.4, 12.5);
  bed(15.6, 20.6, -16.4, 12.5);
  bed(-15.6, 15.6, -16.4, -13.2);
  const trees = [[-18.1, -12, 'round', 7.5], [-18.1, -2, 'cherry', 6.5], [-18.1, 8.5, 'round', 7], [18.1, -12, 'round', 7.5], [18.1, -2, 'cherry', 6.5], [18.1, 8.5, 'maple', 7], [-8, -14.8, 'maple', 7.5], [8, -14.8, 'round', 7.2]];
  for (const [x, z, kind, h] of trees) {
    const t = tree({ kind, seed: Math.round(x * 3 + z), height: h });
    t.position.set(x, FLOOR_Y + 0.18, z);
    t.rotation.y = R() * PI * 2;
    S.add(t);
    solid(site, x, 1.6, z, 0.6, 3.2, 0.6);
  }
  // bushes and flowers only draw near the plaza (like the town's own planting); flowers cast no shadows
  const nearG = new THREE.Group();
  nearG.name = 'plaza-planting';
  nearG.userData.dynamic = true;
  S.add(nearG);
  const bushP = [bush({ seed: 3, color: 0x4f7a3a, flowers: 0.3 }), bush({ seed: 5, flowers: 0 })];
  const flowers = [flowerPatch({ seed: 2 }), flowerPatch({ seed: 9 })];
  const dress = (x0, x1, z0, z1, nb, nf, avoid) => {
    for (let i = 0; i < nb + nf; i++) {
      const x = x0 + 0.6 + R() * (x1 - x0 - 1.2), z = z0 + 0.6 + R() * (z1 - z0 - 1.2);
      if (avoid.some(([ax, az]) => Math.hypot(ax - x, az - z) < 1.1)) continue;
      const o = (i < nb ? bushP[i % 2] : flowers[i % 2]).clone();
      o.position.set(x, FLOOR_Y + 0.18, z);
      o.rotation.y = R() * PI * 2;
      o.scale.setScalar(i < nb ? 0.7 + R() * 0.3 : 1.0 + R() * 0.4);
      if (i >= nb) o.traverse((m) => { m.castShadow = false; });
      nearG.add(o);
    }
  };
  const treeXZ = trees.map((t) => [t[0], t[1]]);
  dress(-20.6, -15.6, -16.4, 12.5, 6, 9, treeXZ);
  dress(15.6, 20.6, -16.4, 12.5, 6, 9, treeXZ);
  dress(-15.6, 15.6, -16.4, -13.2, 5, 8, treeXZ);
  bake(nearG);

  // ---- benches: audience row, round the fountain, by the beds
  const seats = [];
  const putBench = (x, z, ry, len = 2.2) => {
    const b = bench({ length: len });
    b.position.set(x, FLOOR_Y, z); b.rotation.y = ry;
    S.add(b);
    const c = Math.cos(ry), s = Math.sin(ry);
    for (const cb of b.userData.colliders ?? []) {
      const pts = [[cb.min[0], cb.min[2]], [cb.max[0], cb.min[2]], [cb.min[0], cb.max[2]], [cb.max[0], cb.max[2]]].map(([px, pz]) => [x + px * c + pz * s, z - px * s + pz * c]);
      const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
      site.colliders.push({ min: [Math.min(...xs), FLOOR_Y + cb.min[1], Math.min(...zs)], max: [Math.max(...xs), FLOOR_Y + cb.max[1], Math.max(...zs)] });
    }
    for (const sp of b.userData.seats ?? []) seats.push({ pos: [x + sp[0] * c + sp[2] * s, FLOOR_Y + sp[1], z - sp[0] * s + sp[2] * c], yaw: ry + PI });
  };
  for (const x of [-3.2, 0, 3.2]) putBench(x, 10.6, PI, 2.4);
  for (const s of [-1, 1]) {
    putBench(s * 12.6, FC[2] - 3.2, -s * PI / 2);
    putBench(s * 12.6, FC[2] + 3.2, -s * PI / 2);
    putBench(s * 7.8, -11.6, Math.atan2(-s * 7.8 + FC[0], -(-11.6) + FC[2]) + 0);
  }

  // ---- advertising column with the show poster, and the name stone
  {
    const g = group(S, -12.8, FLOOR_Y, 14.4);
    const green = paint(0x2f4a3a, 0.45, 0.4);
    put(g, lathe([[0.74, 0], [0.74, 0.14], [0.66, 0.2], [0.62, 0.3], [0.6, 0.34], [0, 0.34]], 48), M.lime());
    const colG = prep(new THREE.CylinderGeometry(0.585, 0.585, 2.1, 64, 1, true), true);
    const cm = put(g, colG, new THREE.MeshStandardMaterial({ map: posterWrap(), roughness: 0.75 }), 0, 0.34 + 1.05, 0);
    cm.rotation.y = PI * 0.6;
    put(g, cyl(0.6, 0.6, 0.04, 48), green, 0, 0.34 + 0.02, 0);
    put(g, lathe([[0.62, 2.42], [0.7, 2.46], [0.7, 2.52], [0.64, 2.56], [0.54, 2.72], [0.36, 2.88], [0.16, 2.98], [0.08, 3.1], [0, 3.12]], 48), green);
    put(g, sphere(0.07, 14, 10), M.bronze(), 0, 3.18, 0);
    solid(site, -12.8, 1.5, 14.4, 1.4, 3, 1.4);
  }
  {
    const g = group(S, 12.4, FLOOR_Y, 15.3);
    put(g, rbox(3.4, 0.9, 0.7, 0.06), textured('stone', { color: 0x4a4c50, seed: 41 }, 1.5, { normal: 0.5 }), 0, 0.45, 0);
    put(g, quad(3.1, 0.97), new THREE.MeshStandardMaterial({ map: nameStone(), roughness: 0.55 }), 0, 0.48, 0.352).castShadow = false;
    put(g, rbox(3.6, 0.1, 0.9, 0.03), M.lime(), 0, 0.05, 0);
    solid(site, 12.4, 0.5, 15.3, 3.6, 1.0, 0.9);
  }

  // ---- interactables, people, extras
  site.interactables.push({ id: 'show', label: '공연 보기 🎤', pos: [0, 1.0, 10.3], radius: 2.3, seat: { pos: [0, FLOOR_Y + 1.2, 10.55], yaw: 0, pitch: 0.1 } });
  site.interactables.push({ id: 'fountain', label: '동전 던지고 소원 빌기 🪙', pos: [FC[0] - RO + 0.1, 0.95, FC[2]], radius: 1.9 });
  site.npcSpots.push({ pos: [12.6 - 0.05, FLOOR_Y, FC[2] - 3.2 - 0.55], yaw: -PI / 2 + PI, pose: 'sit', role: 'guest' });
  site.npcSpots.push({ pos: [-12.6 + 0.05, FLOOR_Y, FC[2] + 3.2 + 0.55], yaw: PI / 2 + PI, pose: 'sit', role: 'guest' });
  site.extra.fountain = water;
  site.extra.near = nearG;
  site.extra.fountainPos = FC;
  site.lamps.push({ pos: [FC[0], 1.4, FC[2] + 2.2], color: 0x9ad8ff, intensity: 7, range: 9 }); // pool glow on the rim at night
  site.extra.stage = { ...STAGE, ledM, upM, heads, parM: heads.parM, beamMats };
  site.extra.seats = seats;
  site.extra.posterArt = drawShowPoster;
  bake(S);
  return site;
}

/** Viewer helper: the plaza with the fountain running on its own (/viewer.html?mod=sites/plaza&fn=plazaPreview). */
export function plazaPreview() {
  const site = buildPlaza();
  const w = site.extra.fountain;
  const sun = new THREE.Vector3(), tmp = new THREE.Vector3();
  let last = performance.now();
  w.surface.onBeforeRender = (renderer, scene, camera) => {
    const now = performance.now();
    if (now - last < 4) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    let dl = null, hemi = null;
    scene.traverse((o) => { if (o.isDirectionalLight && !dl) dl = o; if (o.isHemisphereLight && !hemi) hemi = o; });
    const daylight = dl ? THREE.MathUtils.clamp((Math.asin(tmp.copy(dl.position).sub(dl.target.position).normalize().y) * 180 / PI + 4) / 14, 0, 1) : 1;
    sun.copy(dl ? tmp : new THREE.Vector3(0, 1, 0)).transformDirection(camera.matrixWorldInverse);
    w.normal(w.t, 1 - daylight);
    w.update(dt, fountainEnv({ daylight, sunDirView: sun, sun: dl, hemi, camera, renderer }));
  };
  return site;
}
