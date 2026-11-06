// Fountain water for the plaza (인혁 계획 7: "분수를 만들고 분수에서 공연을 하게 해줘").
// Everything is in fountain-local space (origin = basin centre on the ground, y up) and animated on the
// GPU from a few numbers per jet, so the show can make jets dance without rebuilding geometry:
//   jets      one instanced tube per jet, bent along its ballistic path (1 draw call)
//   spray     droplets, landing splashes and night mist as GPU particles (1 draw call)
//   curtains  water sheets falling over the two bowl lips (1 draw call)
//   surface   basin and bowl water: ripples, foam rings where jets land, glow of the pool lights
//   floor     mosaic pool floor with caustics and the coloured light pools (material from the plaza)
//   lamps     the pool light lenses (instanced, 1 draw call)
// Jet i: {kind: 'arc'|'ring'|'crown', origin:[x,y,z], dir:[x,z], H (apex height), R (horizontal reach),
// drop (how far below the nozzle it lands), r0 (nozzle radius), spread, on (0..1), color (THREE.Color)}.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const WATER_Y = 0.5;            // basin water level
export const BOWL1 = { r: 1.9, y: 1.55, water: 1.5 };   // lower bowl lip
export const BOWL2 = { r: 0.95, y: 2.6, water: 2.56 };  // upper bowl lip
export const CROWN_Y = 3.08;           // top nozzle
export const RING_R = 3.45;            // show jets
export const ARC_R = 4.82;             // arc nozzles on the rim
export const N_ARC = 12, N_RING = 16;
const MAXE = 32;                       // particle emitters (jets + curtain splashes + coin)
const NIMP = 30;                       // ripple sources on the water

const G = 9.8;
/** Ballistic numbers for a jet that rises H, travels R and lands `drop` below its nozzle. */
export function jetPath(H, R, drop = 0) {
  const vy = Math.sqrt(2 * G * Math.max(H, 0.01));
  const tEnd = (vy + Math.sqrt(vy * vy + 2 * G * Math.max(drop, 0))) / G;
  return { vy, tEnd, vh: R / tEnd, tApex: vy / G };
}

const NOISE = /* glsl */`
float fhash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fhash(i), fhash(i + vec2(1, 0)), f.x), mix(fhash(i + vec2(0, 1)), fhash(i + vec2(1, 1)), f.x), f.y); }
`;
const LIT = /* glsl */`
uniform vec3 uAmb; uniform vec3 uSunCol; uniform vec3 uSunDir; uniform float uGlow; uniform float uTime;
`;

// ------------------------------------------------------------------ jets
const jetVert = /* glsl */`
attribute vec4 iA; attribute vec4 iB; attribute vec4 iC; attribute vec4 iD;
varying float vS; varying float vU; varying vec3 vN; varying vec3 vV; varying vec3 vCol; varying float vOn; varying float vSeed; varying float vKind; varying float vLen;
#include <fog_pars_vertex>
void main(){
  float H = max(iA.w, 0.01);
  float vy = sqrt(19.6 * H);
  float tEnd = (vy + sqrt(vy * vy + 19.6 * max(iD.x, 0.0))) / 9.8;
  float vh = iB.z / tEnd;
  float s = position.y;
  float sp = s * iD.z;                     // fraction of the whole flight
  float t = sp * tEnd;
  vec3 dir = vec3(iB.x, 0.0, iB.y);
  vec3 P = iA.xyz + dir * (vh * t) + vec3(0.0, vy * t - 4.9 * t * t, 0.0);
  vec3 T = normalize(dir * vh + vec3(0.0, vy - 9.8 * t + 1e-4, 0.0));
  vec3 ref = abs(T.y) > 0.95 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 side = normalize(cross(T, ref));
  vec3 bin = normalize(cross(side, T));
  float r = iB.w * (1.0 + 1.4 * sp + 2.5 * sp * sp);
  if (iD.w > 0.5) r *= 1.0 + 1.6 * smoothstep(0.55, 1.0, s);   // vertical: foamy head
  else r *= 1.0 - 0.75 * smoothstep(0.82, 1.0, s);             // arc: thins out into drops
  r *= step(0.02, iC.w);
  vec3 nrm = side * position.x + bin * position.z;
  vec4 mvPosition = modelViewMatrix * vec4(P + nrm * r, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  vN = normalize(normalMatrix * nrm);
  vV = normalize(-mvPosition.xyz);
  vS = s; vU = atan(position.z, position.x); vCol = iC.rgb; vOn = iC.w; vSeed = iD.y; vKind = iD.w;
  vLen = H * (iD.w > 0.5 ? 1.0 : 2.0) + iB.z;
  #include <fog_vertex>
}`;
const jetFrag = /* glsl */`
${LIT}
varying float vS; varying float vU; varying vec3 vN; varying vec3 vV; varying vec3 vCol; varying float vOn; varying float vSeed; varying float vKind; varying float vLen;
#include <fog_pars_fragment>
${NOISE}
void main(){
  if (vOn < 0.02) discard;
  vec3 N = normalize(vN), V = normalize(vV);
  float ndv = abs(dot(N, V));
  float u = vU * 0.6366;
  float flow = vS * vLen * 2.4 - uTime * (vKind > 0.5 ? 7.0 : 5.0);
  float st = fnoise(vec2(u * 2.0 + vSeed * 13.0, flow)) * 0.6 + fnoise(vec2(u * 5.0 + 3.0, flow * 2.3 + 7.0)) * 0.4;
  float a = (0.42 + 0.5 * st) * smoothstep(0.0, 0.5, ndv);
  a *= mix(0.6, 1.0, smoothstep(0.0, 0.2, vS));                  // clear at the nozzle, aerated later
  float br = smoothstep(vKind > 0.5 ? 0.78 : 0.72, 1.0, vS);       // breaks into drops near the end
  a *= 1.0 - br * smoothstep(0.25, 0.75, fnoise(vec2(u * 3.0 + 1.7, flow * 1.7)) + br * 0.6);
  a *= clamp(vOn * 1.3, 0.0, 1.0);
  float diff = 0.6 + 0.4 * max(dot(N, uSunDir), 0.0);
  vec3 col = uAmb * (0.9 + 0.35 * st) + uSunCol * diff * 0.32;
  col += uSunCol * pow(max(dot(reflect(-uSunDir, N), V), 0.0), 28.0) * 0.8;
  col += vCol * uGlow * (3.6 - 1.6 * vS) * (0.7 + 0.6 * st);
  gl_FragColor = vec4(col, a);
  #include <fog_fragment>
}`;

function tubeGeo(radial = 8, seg = 30) {
  const pos = [], idx = [];
  for (let j = 0; j <= seg; j++) {
    const s = j / seg;
    for (let i = 0; i <= radial; i++) { const a = (i / radial) * Math.PI * 2; pos.push(Math.cos(a), s, Math.sin(a)); }
  }
  for (let j = 0; j < seg; j++) for (let i = 0; i < radial; i++) {
    const a = j * (radial + 1) + i, b = a + radial + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

// ------------------------------------------------------------------ spray particles
const sprayVert = /* glsl */`
uniform vec4 uEA[${MAXE}]; uniform vec4 uEB[${MAXE}]; uniform vec4 uEC[${MAXE}]; uniform vec4 uED[${MAXE}];
uniform float uTime; uniform float uPx; uniform float uWater;
attribute float aE; attribute vec4 aR; attribute float aK;
varying vec3 vCol; varying float vA; varying float vK;
#include <fog_pars_vertex>
void main(){
  int e = int(aE + 0.5);
  vec4 A = uEA[e], B = uEB[e], C = uEC[e], D = uED[e];
  float H = max(A.w, 0.01);
  float vy = sqrt(19.6 * H);
  float tEnd = (vy + sqrt(vy * vy + 19.6 * max(D.x, 0.0))) / 9.8;
  vec3 dir = vec3(B.x, 0.0, B.y);
  float vh = B.z / tEnd;
  vec3 rnd = aR.yzw - 0.5;
  vec3 pos; float size; float a;
  if (aK < 0.5) {            // droplets that follow the jet and scatter
    float life = tEnd * (0.95 + 0.25 * aR.y);
    float f = fract(uTime / life + aR.x);
    float t = f * life;
    vec3 v = dir * vh + vec3(0.0, vy, 0.0) + rnd * vec3(1.0, 0.5, 1.0) * vy * D.z;
    pos = A.xyz + v * t + vec3(0.0, -4.9 * t * t, 0.0);
    a = smoothstep(0.18, 0.5, f) * (1.0 - smoothstep(0.9, 1.0, f));
    a *= step(D.y - 0.02, pos.y) * 0.8;
    size = 0.016 + 0.026 * aR.w;
  } else if (aK < 1.5) {     // splash where the water lands
    float life = 0.45 + 0.35 * aR.y;
    float f = fract(uTime / life + aR.x);
    float t = f * life;
    vec3 L = A.xyz + dir * (vh * tEnd) + vec3(0.0, vy * tEnd - 4.9 * tEnd * tEnd, 0.0);
    vec2 ang = normalize(rnd.xz + vec2(1e-3, 0.0));
    L.xz += ang * D.w * (0.82 + 0.25 * aR.z);
    L.y = D.y;
    float k = sqrt(clamp(H, 0.15, 3.0)) * 0.6 + 0.25;
    vec3 v = vec3(ang.x * (0.3 + 0.7 * aR.w), 0.9 + 1.5 * aR.y, ang.y * (0.3 + 0.7 * aR.w)) * k;
    pos = L + v * t + vec3(0.0, -4.9 * t * t, 0.0);
    a = (1.0 - f) * step(D.y - 0.01, pos.y);
    size = 0.02 + 0.032 * aR.z;
  } else {                   // mist drifting around the top of tall jets
    float life = 2.4 + 1.2 * aR.y;
    float f = fract(uTime / life + aR.x);
    vec3 top = A.xyz + dir * (vh * vy / 9.8) + vec3(0.0, H, 0.0);
    pos = top + rnd * (0.5 + 1.8 * f) * vec3(1.6, 0.9, 1.6) + vec3(0.3, -1.1 * f, 0.15) * f;
    a = sin(3.14159 * f) * 0.045 * smoothstep(3.0, 6.5, H);
    size = 0.45 + 0.8 * f;
  }
  a *= clamp(C.w * 1.4, 0.0, 1.0);
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = clamp(size * uPx / max(0.1, -mvPosition.z), 0.0, 64.0) * step(0.004, a);
  vCol = C.rgb; vA = a; vK = aK;
  #include <fog_vertex>
}`;
const sprayFrag = /* glsl */`
${LIT}
varying vec3 vCol; varying float vA; varying float vK;
#include <fog_pars_fragment>
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float soft = vK > 1.5 ? (1.0 - d) * (1.0 - d) : smoothstep(1.0, 0.35, d);
  vec3 col = uAmb * 1.05 + uSunCol * 0.35 + vCol * uGlow * (vK > 1.5 ? 2.2 : 3.2);
  col += (vK < 1.5 ? 1.0 : 0.0) * smoothstep(0.5, 0.0, length(c + vec2(0.12, 0.12))) * (uSunCol * 0.5 + vCol * uGlow * 0.6);
  gl_FragColor = vec4(col, vA * soft);
  #include <fog_fragment>
}`;

// ------------------------------------------------------------------ curtains over the bowl lips
const curtainVert = /* glsl */`
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
#include <fog_pars_vertex>
uniform float uTime;
void main(){
  vUv = uv;
  vec3 p = position;
  float w = sin(uv.x * 37.7 + uTime * 3.1 + uv.y * 4.0) * 0.012 * uv.y;
  p.xz += normalize(p.xz + 1e-4) * w;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mvPosition.xyz);
  #include <fog_vertex>
}`;
const curtainFrag = /* glsl */`
${LIT}
uniform vec3 uCol; uniform float uFlow;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
#include <fog_pars_fragment>
${NOISE}
void main(){
  vec3 N = normalize(vN), V = normalize(vV);
  if (!gl_FrontFacing) N = -N;
  float ndv = abs(dot(N, V));
  float y = vUv.y;
  float st = fnoise(vec2(vUv.x * 120.0, y * 3.0 - uTime * 2.6));
  float st2 = fnoise(vec2(vUv.x * 300.0 + 5.0, y * 7.0 - uTime * 4.2));
  float gaps = smoothstep(0.18, 0.5, fnoise(vec2(vUv.x * 30.0 + sin(uTime * 0.21) * 2.0, y * 0.8 - uTime * 0.7)));
  float a = (0.2 + 0.55 * st * (0.6 + 0.4 * st2)) * mix(1.0, gaps, smoothstep(0.1, 0.6, y));
  a *= mix(0.55, 1.0, smoothstep(0.0, 0.5, ndv));
  a *= 1.0 - smoothstep(0.7, 1.0, y) * (0.45 + 0.55 * st2);
  a *= uFlow;
  float rim = clamp(1.0 - ndv, 0.0, 1.0);
  vec3 col = uAmb * (0.9 + 0.3 * st) + uSunCol * 0.3 + uSunCol * rim * rim * rim * 0.4;
  col += uCol * uGlow * (2.6 + 1.2 * st);
  gl_FragColor = vec4(col, a);
  #include <fog_fragment>
}`;

/** Water sheet falling from a circular lip: r grows with the horizontal speed, y drops with gravity. */
function curtainGeo(rLip, yLip, yEnd, vh, around = 96, down = 14) {
  const tFall = Math.sqrt(2 * (yLip - yEnd) / G);
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= down; j++) {
    const t = (j / down) * tFall, r = rLip + vh * t, y = yLip - 0.5 * G * t * t;
    for (let i = 0; i <= around; i++) { const a = (i / around) * Math.PI * 2; pos.push(Math.cos(a) * r, y, Math.sin(a) * r); uv.push(i / around * 6, j / down); }
  }
  for (let j = 0; j < down; j++) for (let i = 0; i < around; i++) { const a = j * (around + 1) + i, b = a + around + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return { geo: g.toNonIndexed(), landR: rLip + vh * tFall };
}

// ------------------------------------------------------------------ water surface and pool floor (patched standard materials)
const SURF_PARS = /* glsl */`
uniform float uTime; uniform float uGlow; uniform float uSun; uniform vec4 uImp[${NIMP}]; uniform vec4 uLP[20]; uniform vec3 uLC[20]; uniform vec4 uRing;
varying vec3 vFL;
${NOISE}
vec3 poolGlow(vec2 P){
  vec3 g = vec3(0.0);
  for (int i = 0; i < 20; i++) { vec2 d = P - uLP[i].xy; g += uLC[i] * exp(-dot(d, d) * uLP[i].z); }
  return g;
}
float caustic(vec2 p, float t){
  vec2 q = p * 1.7;
  float c = 0.0;
  for (int i = 0; i < 3; i++) {
    q += vec2(sin(q.y * 1.37 + t * 0.9 + float(i)), cos(q.x * 1.21 - t * 0.77 + float(i) * 2.0)) * 0.9;
    c += abs(sin(q.x + q.y * 0.4) * sin(q.y - q.x * 0.3));
  }
  return pow(clamp(1.0 - c * 0.42, 0.0, 1.0), 3.0);
}
`;

function patchSurface(m, U) {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFL; varying vec3 vTX; varying vec3 vTZ;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvFL = position; vTX = normalize(normalMatrix * vec3(1.0, 0.0, 0.0)); vTZ = normalize(normalMatrix * vec3(0.0, 0.0, 1.0));');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${SURF_PARS}\nvarying vec3 vTX; varying vec3 vTZ;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 P = vFL.xz;
        vec2 grad = vec2(sin(P.x * 6.0 + uTime * 1.6 + sin(P.y * 2.9)), sin(P.y * 5.4 - uTime * 1.8 + sin(P.x * 2.3))) * 0.03;
        grad += (vec2(fnoise(P * 3.2 + uTime * 0.45), fnoise(P * 3.2 - uTime * 0.41 + 11.0)) - 0.5) * 0.26;
        grad += (vec2(fnoise(P * 9.0 - uTime * 0.9), fnoise(P * 9.0 + uTime * 0.8 + 5.0)) - 0.5) * 0.12;
        float foam = 0.0;
        for (int i = 0; i < ${NIMP}; i++) {
          vec4 im = uImp[i];
          if (im.z <= 0.001) continue;
          vec2 d = P - im.xy; float r = length(d) + 1e-3;
          float w = exp(-r * 1.4 / im.w) * im.z;
          grad += d / r * cos(r * 17.0 - uTime * 9.0 + float(i) * 1.7) * w * 0.45;
          foam += exp(-r * r / (im.w * im.w * 0.3)) * im.z;
        }
        float rr = length(P);
        float ringD = rr - uRing.x;
        grad += normalize(P + 1e-3) * cos(ringD * 20.0 - uTime * 8.0) * exp(-abs(ringD) * 2.2) * uRing.y * 0.35;
        foam += exp(-ringD * ringD * 40.0) * uRing.y * 0.7;
        foam = clamp(foam * (0.6 + 0.6 * fnoise(P * 9.0 + uTime * 1.3)), 0.0, 0.9);
        vec3 pg = poolGlow(P);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.93, 0.95), foam);
        diffuseColor.a = mix(diffuseColor.a, 0.95, foam);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.55, foam);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(normal - vTX * grad.x - vTZ * grad.y);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += pg * uGlow * (1.1 + 1.2 * caustic(P * 1.3, uTime * 1.2)) + foam * pg * uGlow * 3.0;`);
  };
  m.customProgramCacheKey = () => 'fountain-surface';
}

function patchFloor(m, U) {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFL;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvFL = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${SURF_PARS}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float cs = caustic(vFL.xz, uTime * 1.1);
        vec3 pg2 = poolGlow(vFL.xz);
        totalEmissiveRadiance += diffuseColor.rgb * cs * uSun * 1.4 + pg2 * uGlow * (2.0 + 3.0 * cs) * smoothstep(0.6, 0.0, vFL.y);`);
  };
  m.customProgramCacheKey = () => 'fountain-floor';
}

// ------------------------------------------------------------------ pool light lenses
const lensVert = /* glsl */`
attribute vec3 iCol; varying vec3 vCol;
void main(){ vCol = iCol; vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; }`;
const lensFrag = /* glsl */`
uniform float uGlow; varying vec3 vCol;
void main(){ gl_FragColor = vec4(vCol * (0.4 + uGlow * 5.0) + 0.05, 1.0); }`;

export class FountainWater {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'fountain-water';
    this.group.userData.dynamic = true;
    this.t = 0;
    const U = this.U = {
      uTime: { value: 0 }, uAmb: { value: new THREE.Color(0.8, 0.85, 0.9) }, uSunCol: { value: new THREE.Color(1, 1, 1) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uGlow: { value: 0 }, uSun: { value: 1 },
      uPx: { value: 400 },
    };
    // ---- jets
    this.jets = [];
    const add = (j) => { this.jets.push({ on: 1, color: new THREE.Color(0xffffff), spread: 0.15, drop: 0, r0: 0.03, ...j }); };
    for (let k = 0; k < N_ARC; k++) {
      const a = (k + 0.5) / N_ARC * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      add({ kind: 'arc', origin: [c * ARC_R, 0.62, s * ARC_R], dir: [-c, -s], H: 1.55, R: 2.2, drop: 0.12, r0: 0.024, spread: 0.1 });
    }
    for (let k = 0; k < N_RING; k++) {
      const a = k / N_RING * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      add({ kind: 'ring', origin: [c * RING_R, WATER_Y - 0.02, s * RING_R], dir: [c, s], H: 0.35, R: 0, drop: 0, r0: 0.04, spread: 0.18, base: [c, s] });
    }
    add({ kind: 'crown', origin: [0, CROWN_Y, 0], dir: [1, 0], H: 2.6, R: 0, drop: CROWN_Y - BOWL2.water, r0: 0.045, spread: 0.2 });
    const n = this.jets.length;
    const geo = tubeGeo();
    this.iA = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    this.iB = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    this.iC = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    this.iD = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    for (const a of [this.iA, this.iB, this.iC, this.iD]) a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iA', this.iA); geo.setAttribute('iB', this.iB); geo.setAttribute('iC', this.iC); geo.setAttribute('iD', this.iD);
    geo.instanceCount = n;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 4, 0), 12);
    const fogU = THREE.UniformsLib.fog;
    const shaderMat = (vertexShader, fragmentShader, extra = {}, opts = {}) => new THREE.ShaderMaterial({
      vertexShader, fragmentShader, uniforms: { ...THREE.UniformsUtils.clone(fogU), ...U, ...extra },
      transparent: true, depthWrite: false, fog: true, ...opts,
    });
    this.jetMesh = new THREE.Mesh(geo, shaderMat(jetVert, jetFrag, {}, { side: THREE.DoubleSide }));
    this.jetMesh.renderOrder = 3;
    this.jetMesh.frustumCulled = true;
    this.group.add(this.jetMesh);

    // ---- curtains
    const c1 = curtainGeo(BOWL1.r + 0.02, BOWL1.y - 0.01, WATER_Y, 0.55);
    const c2 = curtainGeo(BOWL2.r + 0.02, BOWL2.y - 0.01, BOWL1.water, 0.42);
    this.curtainLand = [c1.landR, c2.landR];
    const cg = mergeGeometries([c1.geo, c2.geo]);
    cg.computeBoundingSphere();
    this.curtainMat = shaderMat(curtainVert, curtainFrag, { uCol: { value: new THREE.Color(0x66ccff) }, uFlow: { value: 1 } }, { side: THREE.DoubleSide });
    this.curtains = new THREE.Mesh(cg, this.curtainMat);
    this.curtains.renderOrder = 2;
    this.group.add(this.curtains);

    // ---- spray particles: per emitter [kind, count]
    const plan = [];
    this.jets.forEach((j, i) => {
      if (j.kind === 'arc') plan.push([i, 0, 34], [i, 1, 12]);
      else if (j.kind === 'ring') plan.push([i, 0, 64], [i, 1, 18], [i, 2, 8]);
      else plan.push([i, 0, 170], [i, 1, 36], [i, 2, 18]);
    });
    this.eCurtain = [n, n + 1];
    this.eCoin = n + 2;
    plan.push([n, 1, 90], [n + 1, 1, 50], [n + 2, 1, 40]);
    const total = plan.reduce((s, p) => s + p[2], 0);
    const aE = new Float32Array(total), aK = new Float32Array(total), aR = new Float32Array(total * 4), pos = new Float32Array(total * 3);
    let q = 0, seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    for (const [e, k, c] of plan) for (let i = 0; i < c; i++, q++) { aE[q] = e; aK[q] = k; for (let r = 0; r < 4; r++) aR[q * 4 + r] = rnd(); }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pg.setAttribute('aE', new THREE.BufferAttribute(aE, 1));
    pg.setAttribute('aK', new THREE.BufferAttribute(aK, 1));
    pg.setAttribute('aR', new THREE.BufferAttribute(aR, 4));
    pg.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 4, 0), 13);
    const arr = () => ({ value: Array.from({ length: MAXE }, () => new THREE.Vector4()) });
    this.E = { uEA: arr(), uEB: arr(), uEC: arr(), uED: arr() };
    this.sprayMat = shaderMat(sprayVert, sprayFrag, { ...this.E, uWater: { value: WATER_Y } });
    this.spray = new THREE.Points(pg, this.sprayMat);
    this.spray.renderOrder = 4;
    this.group.add(this.spray);
    this.particleCount = total;

    // ---- water surfaces (basin + both bowls) and the shared uniforms for the floor
    this.S = {
      uTime: U.uTime, uGlow: U.uGlow, uSun: U.uSun,
      uImp: { value: Array.from({ length: NIMP }, () => new THREE.Vector4()) },
      uLP: { value: Array.from({ length: 20 }, () => new THREE.Vector4()) },
      uLC: { value: Array.from({ length: 20 }, () => new THREE.Color()) },
      uRing: { value: new THREE.Vector4(this.curtainLand[0], 1, 0, 0) },
    };
    const disc = (r, y, seg) => new THREE.CircleGeometry(r, seg).rotateX(-Math.PI / 2).translate(0, y, 0);
    const sg = mergeGeometries([disc(5.0, WATER_Y, 96), disc(BOWL1.r - 0.1, BOWL1.water, 48), disc(BOWL2.r - 0.08, BOWL2.water, 32)]);
    this.surfaceMat = new THREE.MeshPhysicalMaterial({ color: 0x072a33, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.78, envMapIntensity: 0.85, specularIntensity: 1, depthWrite: false });
    patchSurface(this.surfaceMat, this.S);
    this.surface = new THREE.Mesh(sg, this.surfaceMat);
    this.surface.receiveShadow = true;
    this.surface.renderOrder = 1;
    this.group.add(this.surface);

    // ---- pool lights: 16 under the ring jets, 4 at the pedestal
    this.lightPos = [];
    for (let k = 0; k < N_RING; k++) { const a = k / N_RING * Math.PI * 2; this.lightPos.push([Math.cos(a) * (RING_R + 0.18), Math.sin(a) * (RING_R + 0.18), 1.6]); }
    for (let k = 0; k < 4; k++) { const a = (k + 0.5) / 4 * Math.PI * 2; this.lightPos.push([Math.cos(a) * 1.35, Math.sin(a) * 1.35, 1.2]); }
    this.lightCol = this.lightPos.map(() => new THREE.Color(0x66ccff));
    this.lightPos.forEach((p, i) => this.S.uLP.value[i].set(p[0], p[1], p[2], 0));
    const lensGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.05, 20);
    const lens = new THREE.InstancedMesh(lensGeo, new THREE.ShaderMaterial({ vertexShader: lensVert, fragmentShader: lensFrag, uniforms: { uGlow: U.uGlow } }), this.lightPos.length);
    const iCol = new THREE.InstancedBufferAttribute(new Float32Array(this.lightPos.length * 3), 3);
    iCol.setUsage(THREE.DynamicDrawUsage);
    lensGeo.setAttribute('iCol', iCol);
    this.lensCol = iCol;
    const m4 = new THREE.Matrix4();
    this.lightPos.forEach((p, i) => { const r = Math.hypot(p[0], p[1]); lens.setMatrixAt(i, m4.makeTranslation(p[0], 0.07 + (r < 2 ? 0.03 : 0), p[1])); });
    lens.computeBoundingSphere();
    this.lens = lens;
    this.group.add(lens);

    this.floorUniforms = this.S;
    this.splashes = []; // {x, z, t}
    this.normal(0, 0);
  }

  /** Material patch for the pool floor (the plaza builder owns the mesh). */
  patchFloor(m) { patchFloor(m, this.S); }

  /** The everyday pattern: rim arcs, crown jet, bubblers, slowly turning colours at night. */
  normal(t, night) {
    for (const j of this.jets) {
      if (j.kind === 'arc') { j.on = 1; j.H = 1.55 + 0.05 * Math.sin(t * 0.7 + j.origin[0]); j.R = 2.2; }
      else if (j.kind === 'ring') { j.on = 1; j.H = 0.3 + 0.08 * Math.sin(t * 1.3 + j.origin[2] * 2); j.R = 0; j.dir[0] = j.base[0]; j.dir[1] = j.base[1]; }
      else { j.on = 1; j.H = 2.7 + 0.2 * Math.sin(t * 0.5); }
    }
    this.flow = 1;
    // colours: a rainbow ring that slowly turns (night only matters)
    void night;
    this.jets.forEach((j, i) => {
      const a = j.kind === 'ring' ? (i - N_ARC) / N_RING : j.kind === 'arc' ? (i + 0.5) / N_ARC : 0;
      j.color.setHSL((a * 0.35 + t * 0.02 + 0.5) % 1, 0.75, 0.55);
    });
    this.lightCol.forEach((c, i) => c.setHSL((i / 16 * 0.35 + t * 0.02 + 0.5) % 1, 0.8, 0.55));
    this.curtainMat.uniforms.uCol.value.setHSL((t * 0.02 + 0.55) % 1, 0.7, 0.55);
  }

  /** A little splash where a coin lands. */
  splash(x, z) { this.splashes.push({ x, z, t: 0 }); }

  /** Upload the jet state; env = {daylight, sunDirView, sunCol, amb, glow, px}. */
  update(dt, env) {
    this.t += dt;
    const U = this.U;
    U.uTime.value = this.t;
    U.uAmb.value.copy(env.amb);
    U.uSunCol.value.copy(env.sunCol);
    U.uSunDir.value.copy(env.sunDirView);
    U.uGlow.value = env.glow;
    U.uSun.value = env.daylight;
    U.uPx.value = env.px;
    const A = this.iA.array, B = this.iB.array, C = this.iC.array, D = this.iD.array;
    const imp = this.S.uImp.value;
    let ni = 0;
    this.jets.forEach((j, i) => {
      const o = i * 4;
      A[o] = j.origin[0]; A[o + 1] = j.origin[1]; A[o + 2] = j.origin[2]; A[o + 3] = Math.max(0.01, j.H);
      const dl = Math.hypot(j.dir[0], j.dir[1]) || 1;
      B[o] = j.dir[0] / dl; B[o + 1] = j.dir[1] / dl; B[o + 2] = j.R; B[o + 3] = j.r0;
      C[o] = j.color.r; C[o + 1] = j.color.g; C[o + 2] = j.color.b; C[o + 3] = j.on;
      const p = jetPath(j.H, j.R, j.drop);
      const vertical = j.kind !== 'arc' && j.R < 0.6;
      D[o] = j.drop; D[o + 1] = i * 0.37; D[o + 2] = vertical ? p.tApex / p.tEnd : 1; D[o + 3] = vertical ? 1 : 0;
      // particles share the jet numbers
      this.E.uEA.value[i].set(A[o], A[o + 1], A[o + 2], A[o + 3]);
      this.E.uEB.value[i].set(B[o], B[o + 1], j.R, 0);
      this.E.uEC.value[i].set(j.color.r, j.color.g, j.color.b, j.on);
      const water = j.kind === 'crown' ? BOWL2.water : WATER_Y;
      this.E.uED.value[i].set(j.drop, water, j.spread, j.kind === 'arc' ? 0.1 : 0.12 + 0.1 * Math.min(j.H, 8));
      // ripples where the water lands
      if (j.kind !== 'crown' && ni < NIMP - 2) {
        const lx = j.origin[0] + B[o] * j.R, lz = j.origin[2] + B[o + 1] * j.R;
        imp[ni++].set(lx, lz, j.on * Math.min(1, 0.35 + j.H * 0.12), j.kind === 'arc' ? 0.35 : 0.3 + j.H * 0.05);
      }
    });
    for (const a of [this.iA, this.iB, this.iC, this.iD]) a.needsUpdate = true;
    // curtain splashes (ring emitters) and the coin splash
    const flow = this.flow ?? 1;
    const ec = this.E;
    ec.uEA.value[this.eCurtain[0]].set(0, WATER_Y, 0, 0.18); ec.uEB.value[this.eCurtain[0]].set(1, 0, 0, 0); ec.uEC.value[this.eCurtain[0]].set(this.curtainMat.uniforms.uCol.value.r, this.curtainMat.uniforms.uCol.value.g, this.curtainMat.uniforms.uCol.value.b, flow); ec.uED.value[this.eCurtain[0]].set(0, WATER_Y, 0, this.curtainLand[0]);
    ec.uEA.value[this.eCurtain[1]].set(0, BOWL1.water, 0, 0.14); ec.uEB.value[this.eCurtain[1]].set(1, 0, 0, 0); ec.uEC.value[this.eCurtain[1]].copy(ec.uEC.value[this.eCurtain[0]]); ec.uED.value[this.eCurtain[1]].set(0, BOWL1.water, 0, this.curtainLand[1]);
    this.S.uRing.value.set(this.curtainLand[0], flow, 0, 0);
    this.curtainMat.uniforms.uFlow.value = flow;
    let coin = null;
    for (const s of this.splashes) s.t += dt;
    this.splashes = this.splashes.filter((s) => s.t < 1.2);
    for (const s of this.splashes) { coin = s; imp[ni++]?.set(s.x, s.z, (1.2 - s.t) * 1.2, 0.35); }
    ec.uEA.value[this.eCoin].set(coin?.x ?? 0, WATER_Y, coin?.z ?? 0, 0.5);
    ec.uEB.value[this.eCoin].set(1, 0, 0, 0);
    ec.uEC.value[this.eCoin].set(1, 1, 1, coin ? Math.max(0, 1 - coin.t * 1.2) : 0);
    ec.uED.value[this.eCoin].set(0, WATER_Y, 0, 0.05);
    for (; ni < NIMP; ni++) imp[ni].set(0, 0, 0, 1);
    // pool lights
    const lc = this.lensCol.array;
    this.lightCol.forEach((c, i) => { this.S.uLC.value[i].copy(c); lc[i * 3] = c.r; lc[i * 3 + 1] = c.g; lc[i * 3 + 2] = c.b; });
    this.lensCol.needsUpdate = true;
  }
}

/** Light numbers for the water shaders from the scene's sun and sky lights. */
export function fountainEnv({ daylight, sunDirView, sun, hemi, camera, renderer, night = 1 - daylight }) {
  const amb = new THREE.Color(0.6, 0.7, 0.8);
  if (hemi) amb.copy(hemi.color).multiplyScalar(hemi.intensity * 0.8).lerp(hemi.groundColor.clone().multiplyScalar(hemi.intensity), 0.12);
  const sunCol = sun ? sun.color.clone().multiplyScalar(sun.intensity * (0.15 + 0.85 * daylight)) : new THREE.Color(1, 1, 1);
  const h = renderer.getDrawingBufferSize(new THREE.Vector2()).y;
  const px = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  return { daylight, night, sunDirView, sunCol, amb, glow: 0.06 + 0.94 * night, px };
}
