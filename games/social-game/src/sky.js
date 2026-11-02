// Sky dome (gradient, sun, clouds, stars), sun/moon light with a shadow box that follows the
// player, hemisphere fill, fog and image-based lighting, all driven by the hour of the day.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const skyVert = `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w; // far plane
}`;

const skyFrag = `
uniform vec3 uSun, uZenith, uHorizon, uGround, uSunColor, uCloudLit, uCloudShade;
uniform float uNight, uTime, uCloud, uDisc;
varying vec3 vDir;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0., a=0.5; for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.03; a*=0.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.45));
  col = mix(col, uGround, smoothstep(0.0, -0.25, h));
  float sd = max(dot(d, uSun), 0.0);
  // sun glow and disc (the disc is HDR so bloom picks it up)
  col += uSunColor * (pow(sd, 8.0) * 0.25 + pow(sd, 64.0) * 0.6) * (1.0 - uNight * 0.85);
  col += uDisc * uSunColor * smoothstep(0.9993, 0.9997, sd) * 12.0 * step(0.0, uSun.y + 0.04) * (1.0 - uNight);
  // clouds on a flat layer above
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.12) * 0.9 + vec2(uTime * 0.004, uTime * 0.0015);
    float c = fbm(uv * 1.6);
    float cov = smoothstep(0.58 - uCloud * 0.25, 0.85, c);
    float shade = fbm(uv * 1.6 + uSun.xz * 0.08);
    vec3 cc = mix(uCloudLit, uCloudShade, smoothstep(0.45, 0.85, shade));
    cc += uSunColor * pow(sd, 6.0) * 0.6;
    col = mix(col, cc, cov * smoothstep(0.0, 0.18, h) * 0.92);
  }
  // stars
  if (uNight > 0.01 && h > 0.0) {
    vec2 g = floor(d.xz / (h + 0.3) * 260.0 + d.y * 41.0);
    float s = step(0.9965, hash(g)) * (0.5 + 0.5 * sin(uTime * 2.0 + hash(g + 3.0) * 30.0));
    col += vec3(s) * uNight * smoothstep(0.05, 0.4, h) * 1.4;
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const C = (h) => new THREE.Color(h);
// Moods keyed by sun elevation (degrees). Colours are linear-ish, picked by eye.
const MOODS = [
  { el: -18, zenith: C(0x050a1c), horizon: C(0x16213f), ground: C(0x0b0e16), sun: C(0x8fa8ff), sunI: 0.35, hemiSky: C(0x34446e), hemiGround: C(0x141418), hemiI: 0.55, fog: C(0x141c33), fogD: 0.0026, exposure: 1.25, cloudLit: C(0x2a3350), cloudShade: C(0x121828), env: 0.25 },
  { el: -4, zenith: C(0x1b2a5c), horizon: C(0xc9706a), ground: C(0x2a2228), sun: C(0xff8a5c), sunI: 0.6, hemiSky: C(0x6c6fa0), hemiGround: C(0x3a2c28), hemiI: 0.6, fog: C(0x8a6a7a), fogD: 0.0024, exposure: 1.15, cloudLit: C(0xf09a80), cloudShade: C(0x4a3a5a), env: 0.45 },
  { el: 6, zenith: C(0x4a78c0), horizon: C(0xffc49a), ground: C(0x6a5a4a), sun: C(0xffb070), sunI: 2.4, hemiSky: C(0xa8b8e0), hemiGround: C(0x6a5040), hemiI: 0.75, fog: C(0xe8c4a8), fogD: 0.0021, exposure: 1.0, cloudLit: C(0xffd2b0), cloudShade: C(0x9a8aa0), env: 0.8 },
  { el: 25, zenith: C(0x3f7fd6), horizon: C(0xbfdcf2), ground: C(0x7a7466), sun: C(0xfff0dc), sunI: 3.4, hemiSky: C(0xbcd6f5), hemiGround: C(0x7c6c58), hemiI: 0.85, fog: C(0xc2d8ea), fogD: 0.0017, exposure: 1.0, cloudLit: C(0xffffff), cloudShade: C(0xb4bfcc), env: 1.0 },
  { el: 70, zenith: C(0x2f6fd0), horizon: C(0xb8d6f0), ground: C(0x7a7466), sun: C(0xfffaf0), sunI: 3.6, hemiSky: C(0xc0d8f6), hemiGround: C(0x807060), hemiI: 0.9, fog: C(0xbdd5ea), fogD: 0.0015, exposure: 1.0, cloudLit: C(0xffffff), cloudShade: C(0xb8c2d0), env: 1.0 },
];

function moodAt(el) {
  if (el <= MOODS[0].el) return MOODS[0];
  for (let i = 0; i < MOODS.length - 1; i++) {
    const a = MOODS[i], b = MOODS[i + 1];
    if (el <= b.el) {
      const t = (el - a.el) / (b.el - a.el);
      const out = {};
      for (const k of Object.keys(a)) out[k] = a[k].isColor ? a[k].clone().lerp(b[k], t) : a[k] + (b[k] - a[k]) * t;
      return out;
    }
  }
  return MOODS[MOODS.length - 1];
}

/** Sun direction for an hour (0..24). Sunrise ~6:00, sunset ~19:00, highest ~12:30. */
export function sunDirection(hour, out = new THREE.Vector3()) {
  const h = ((hour % 24) + 24) % 24;
  let el, az;
  if (h >= 6 && h <= 19) {
    const day = (h - 6) / 13; // 0 sunrise .. 1 sunset
    el = Math.sin(Math.PI * day) * 62;
    az = Math.PI * (0.08 + day * 0.84); // east (+X) → south (+Z) → west (-X)
  } else {
    const n = ((h - 19 + 24) % 24) / 11; // 0 sunset .. 1 sunrise
    el = -Math.sin(Math.PI * n) * 35;
    az = Math.PI * (0.92 + n * 1.16);
  }
  const e = THREE.MathUtils.degToRad(el);
  out.set(Math.cos(az) * Math.cos(e), Math.sin(e), Math.sin(az) * Math.cos(e) * 0.85);
  return { dir: out.normalize(), elevation: el };
}

export class Sky {
  constructor(engine, { shadowSize } = {}) {
    this.engine = engine;
    const scene = engine.scene;
    this.uniforms = {
      uSun: { value: new THREE.Vector3(0, 1, 0) }, uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
      uGround: { value: new THREE.Color() }, uSunColor: { value: new THREE.Color() }, uNight: { value: 0 }, uTime: { value: 0 },
      uCloud: { value: 0.45 }, uDisc: { value: 1 }, uCloudLit: { value: new THREE.Color() }, uCloudShade: { value: new THREE.Color() },
    };
    const domeMat = new THREE.ShaderMaterial({ vertexShader: skyVert, fragmentShader: skyFrag, uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), domeMat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    scene.add(this.dome);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    const ss = shadowSize ?? (engine.quality === 'high' ? 4096 : 2048);
    this.sun.shadow.mapSize.set(ss, ss);
    const sc = this.sun.shadow.camera;
    this.shadowHalf = 42;
    sc.left = -this.shadowHalf; sc.right = this.shadowHalf; sc.top = this.shadowHalf; sc.bottom = -this.shadowHalf;
    sc.near = 1; sc.far = 400;
    sc.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.radius = 2.5;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbcd6f5, 0x7c6c58, 0.8);
    scene.add(this.hemi);
    scene.fog = new THREE.FogExp2(0xc2d8ea, 0.0017);

    // image based lighting: the sky (outdoors) and a neutral room (indoors)
    this.pmrem = new THREE.PMREMGenerator(engine.renderer);
    this.envScene = new THREE.Scene();
    const envMat = domeMat.clone();
    envMat.uniforms = { ...this.uniforms, uDisc: { value: 0 } };
    this.envDome = new THREE.Mesh(this.dome.geometry, envMat);
    this.envScene.add(this.envDome);
    this.skyEnv = null;
    this.roomEnv = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.indoor = 0; // 0 outdoors .. 1 indoors (blended by caller)
    this.hour = 10;
    this.lastEnvHour = -99;
    this.focus = new THREE.Vector3();
    this.mood = moodAt(30);
    this.setHour(10, true);
  }

  /** Daylight 0 (night) .. 1 (full day), handy for lamps and windows. */
  get daylight() { return THREE.MathUtils.clamp((this.elevation + 4) / 14, 0, 1); }

  setHour(hour, forceEnv = false) {
    this.hour = ((hour % 24) + 24) % 24;
    const { dir, elevation } = sunDirection(this.hour);
    this.elevation = elevation;
    const m = moodAt(elevation);
    this.mood = m;
    const u = this.uniforms;
    u.uSun.value.copy(dir);
    u.uZenith.value.copy(m.zenith); u.uHorizon.value.copy(m.horizon); u.uGround.value.copy(m.ground);
    u.uSunColor.value.copy(m.sun); u.uCloudLit.value.copy(m.cloudLit); u.uCloudShade.value.copy(m.cloudShade);
    u.uNight.value = THREE.MathUtils.clamp((-elevation + 2) / 14, 0, 1);
    // below the horizon the "sun" light becomes moonlight from the opposite side
    const night = elevation < -2;
    this.lightDir = night ? new THREE.Vector3(-dir.x, 0.8, -dir.z).normalize() : dir.clone();
    if (!night && elevation < 4) this.lightDir.y = Math.max(this.lightDir.y, 0.07);
    this.sun.color.copy(m.sun);
    this.sun.intensity = m.sunI;
    this.hemi.color.copy(m.hemiSky); this.hemi.groundColor.copy(m.hemiGround); this.hemi.intensity = m.hemiI;
    const scene = this.engine.scene;
    scene.fog.color.copy(m.fog); scene.fog.density = m.fogD * (this.fogScale ?? 1);
    this.engine.renderer.toneMappingExposure = m.exposure;
    if (forceEnv || Math.abs(this.hour - this.lastEnvHour) > 0.2) this.refreshEnv();
    this.applyEnv();
  }

  refreshEnv() {
    this.lastEnvHour = this.hour;
    const old = this.skyEnv;
    this.envDome.position.set(0, 0, 0);
    this.skyEnv = this.pmrem.fromScene(this.envScene, 0, 1, 1200).texture;
    old?.dispose();
  }

  applyEnv() {
    const scene = this.engine.scene;
    const inside = this.indoor > 0.5;
    scene.environment = inside ? this.roomEnv : this.skyEnv;
    scene.environmentIntensity = inside ? 0.22 + 0.33 * this.daylight : this.mood.env;
    // the hemisphere light has no occlusion, so it would light rooms as if they had no roof
    this.hemi.intensity = this.mood.hemiI * (inside ? 0.35 : 1);
  }

  /** Keep the dome on the camera and the shadow box on `focus` (snapped to shadow texels). */
  update(dt, elapsed) {
    this.uniforms.uTime.value = elapsed;
    const cam = this.engine.camera;
    this.dome.position.copy(cam.position);
    const half = this.shadowHalf;
    const texel = (half * 2) / this.sun.shadow.mapSize.x;
    const f = this.focus;
    const L = this.lightDir;
    // snap in light space to avoid shimmering
    const lightMat = new THREE.Matrix4().lookAt(new THREE.Vector3(), L.clone().negate(), new THREE.Vector3(0, 1, 0));
    const inv = lightMat.clone().invert();
    const p = f.clone().applyMatrix4(inv);
    p.x = Math.round(p.x / texel) * texel; p.y = Math.round(p.y / texel) * texel;
    p.applyMatrix4(lightMat);
    this.sun.target.position.copy(p);
    this.sun.position.copy(p).addScaledVector(L, 180);
    this.sun.target.updateMatrixWorld();
  }
}
