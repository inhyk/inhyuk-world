// Jobs (인혁: "직업을 더 만들어줘. 다양하게 경찰, 소방관 같은 것도 넣어."): what each job step of ../jobs.mjs does.
// The mini games, the people and things in the town for the tasks (길 잃은 아이와 엄마, 순찰 지점, 불난 집과
// 소화전, 카트, 우편함, 환자), and the job vehicles (순찰차, 소방차) that take the place of your own car for a while.
import * as THREE from 'three';
import { JOBS, REPORT, TRAFFIC, FIRE_GEAR, GEAR_CHECK, PATIENTS, DOC_TOOLS, DOC_MEDS, PIZZAS, TOPPINGS, STOCK, AISLES, CUSTOMERS, cartTotal, changeFor, changeOptions, LETTERS, SLOTS } from '../jobs.mjs';
import { WAGE, eat } from '../core.mjs';
import { xformPt } from './quests.js';
import { groundAt } from './world.js';
import { hydrant } from './props/street.js';

const $ = (id) => document.getElementById(id);
/** Status line above the hotbar for patrol and hose (the toasts stay at the top). */
function bar(html) {
  let el = $('job-bar');
  if (!el) { el = document.createElement('div'); el.id = 'job-bar'; $('hud')?.appendChild(el); }
  if (html == null) { el.classList.add('hidden'); return; }
  if (el._h !== html) { el.innerHTML = html; el._h = html; }
  el.classList.remove('hidden');
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;
const shuffle = (a, seed = 1) => { const r = [...a]; let s = seed; for (let i = r.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor((s / 233280) * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };

/** Interactables that exist only for jobs: a short line when someone else uses them. */
const IDLE = {
  policeLocker: '경찰관 사물함이에요 🔒', policeDesk: '경찰관 자리예요. 컴퓨터에 순찰 일지가 있어요', patrolCar: '순찰차는 경찰관만 탈 수 있어요 🚓',
  fireLocker: '소방관 사물함이에요. 방화복이 걸려 있어요 🧑‍🚒', gearRack: '소방 장비 선반이에요. 공기통, 호스, 로프…',
  coatRack: '의사 선생님 가운이에요 🥼', xray: '엑스레이 사진이에요. 뼈가 보여요 🦴', shot: '주사는 의사 선생님만 놓아요 💉',
  chefHook: '요리사 옷이랑 모자예요 🧑‍🍳', pizzaOven: '앗 뜨거워! 화덕은 요리사만 써요 🔥', pizzaTable: '손님이 피자를 기다려요',
  martLocker: '마트 직원 사물함이에요', stock: '물건 채우는 카트예요 📦', register: '계산대예요. 직원이 계산해 줘요 💳',
  postLocker: '우체부 사물함이에요 📮', sortRack: '편지를 동네별로 나누는 칸이에요 ✉️',
};
const PATROL = [
  { name: '세온 마트 앞', p: [-60, -3.5], r: 5.5 },
  { name: '세온 초등학교 앞 (어린이 보호구역)', p: [-150, 120], r: 6, slow: true },
  { name: '병원 앞', p: [18, 120], r: 5.5 },
];
const SCHOOL_ZONE = 8.4; // m/s, about 30 km/h
const KID_AT = [-75.4, 108.1], MOM_AT = [-55.5, -20.5], TRAFFIC_AT = [150, 12.5];
const FIRE_AT = { house: 'house2-4', hydrant: [118.6, 110.4], truck: [112, 116.5] };
// flames on the burning house (site-local: x, y, z, size)
// burning windows on the house (site-local window centre x, y, width, height, flame size) and the roof
const FLAMES = [[-2.45, 1.78, 2.3, 1.65, 1.5], [-2.5, 4.8, 1.8, 1.6, 1.45], [1.6, 4.8, 2.0, 1.6, 1.55], [3.05, 1.9, 1.1, 1.2, 1.05], [1.6, 6.15, 0, 0, 2.4]];
const FACADE_Z = 2.0; // the house's front wall (local z)
const CART_SPOTS = [[-6.2, 6.6, 0.6], [1.8, 8.8, -0.4], [-11.0, 8.4, 2.2], [5.4, 6.3, 1.2]];
const MAIL_TO = [{ site: 'school', name: '세온 초등학교', side: 3.2 }, { site: 'apt106', name: '세온 아파트 106동', side: -3.2 }, { site: 'home', name: '세온 아파트 101동', side: 3.6 }];

/* ------------------------------------------------------------------ small 3D helpers */
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
function bubble(text, w = 2.2) { // w: width in metres (before the person's scale)
  const c = document.createElement('canvas');
  c.width = 512; c.height = 150;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,250,240,0.96)'; g.strokeStyle = '#3a332b'; g.lineWidth = 6;
  g.beginPath(); g.roundRect(8, 8, 496, 108, 34); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(236, 114); g.lineTo(256, 144); g.lineTo(276, 114); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(236, 116); g.lineTo(256, 144); g.lineTo(276, 116); g.stroke();
  g.fillStyle = '#2b2620'; g.font = '46px Jua, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 64, 470);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: true }));
  sp.scale.set(w, w * 150 / 512, 1);
  sp.renderOrder = 6;
  return sp;
}
/** Glowing ring like the licence test's, for patrol points. */
function ring(color = 0x5bb0ff) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.13, 10, 44), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.2 }));
  m.rotation.x = PI / 2;
  return m;
}

// billboarded fire and smoke (instanced, one draw call each)
const NOISE = /* glsl */`
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vn(p); p *= 2.03; a *= 0.5; } return s; }`;
const BILLBOARD = /* glsl */`
  attribute float aLife; attribute float aSeed; varying vec2 vUv; varying float vLife; varying float vSeed;
  void main(){
    vUv = uv; vLife = aLife; vSeed = aSeed;
    vec4 c = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float sc = length((instanceMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 wp = c.xyz + right * position.x * sc + vec3(0.0, 1.0, 0.0) * position.y * sc;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }`;
function fireMesh(n) {
  const geo = new THREE.PlaneGeometry(1, 1.6); geo.translate(0, 0.62, 0);
  geo.setAttribute('aLife', new THREE.InstancedBufferAttribute(new Float32Array(n).fill(1), 1));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(Float32Array.from({ length: n }, (_, i) => i * 3.7 + 1), 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 } },
    vertexShader: BILLBOARD,
    fragmentShader: NOISE + /* glsl */`
      uniform float uTime; varying vec2 vUv; varying float vLife; varying float vSeed;
      void main(){
        if (vLife <= 0.0) discard;
        float t = uTime * 1.7 + vSeed, h = vUv.y;
        float n1 = fbm(vec2(vUv.x * 3.5 + vSeed, h * 2.6 - t * 1.6));
        float n2 = fbm(vec2(vUv.x * 7.0 - vSeed, h * 5.5 - t * 2.8));
        float x = (vUv.x - 0.5) * 2.0 + (n1 - 0.5) * 0.9 * h;
        float width = mix(0.9, 0.06, pow(h, 0.75));
        float body = 1.0 - smoothstep(width * 0.35, width, abs(x));
        float fade = smoothstep(1.02, 0.3, h + (n2 - 0.5) * 0.45);
        float f = body * fade * smoothstep(0.0, 0.1, h) * (0.65 + 0.7 * n2);
        f = clamp(f * clamp(vLife * 1.3, 0.0, 1.0), 0.0, 1.0);
        vec3 col = mix(vec3(0.75, 0.1, 0.0), vec3(1.0, 0.42, 0.04), smoothstep(0.12, 0.45, f));
        col = mix(col, vec3(1.0, 0.82, 0.42), smoothstep(0.62, 0.95, f));
        float a = smoothstep(0.04, 0.3, f);
        if (a < 0.01) discard;
        gl_FragColor = vec4(col * (1.0 + f * 0.8), a);
      }`,
  });
  const mesh = new THREE.InstancedMesh(geo, m, n);
  mesh.frustumCulled = false; mesh.renderOrder = 4;
  return mesh;
}
function smokeMesh(n, color = 0x3a3634) {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.setAttribute('aLife', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(Float32Array.from({ length: n }, (_, i) => i * 1.37), 1));
  const c = new THREE.Color(color);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 }, uColor: { value: c } },
    vertexShader: BILLBOARD.replace('vec3(0.0, 1.0, 0.0) * position.y', 'vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]) * position.y'),
    fragmentShader: NOISE + /* glsl */`
      uniform float uTime; uniform vec3 uColor; varying vec2 vUv; varying float vLife; varying float vSeed;
      void main(){
        vec2 p = vUv - 0.5; float r = length(p) * 2.0;
        float n = fbm(p * 2.6 + vec2(vSeed, vSeed * 0.7) + uTime * 0.12);
        float a = (1.0 - smoothstep(0.2, 1.0, r + (n - 0.5) * 0.7)) * vLife;
        if (a < 0.01) discard;
        gl_FragColor = vec4(uColor * (0.7 + n * 0.6 - p.y * 0.3), a);
      }`,
  });
  const mesh = new THREE.InstancedMesh(geo, m, n);
  mesh.frustumCulled = false; mesh.renderOrder = 3;
  return mesh;
}
/** Water jet: a translucent tube along the arc, with scrolling ripples. */
function jetMesh() {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: NOISE + `uniform float uTime; varying vec2 vUv;
      void main(){ float n = fbm(vec2(vUv.x * 30.0 - uTime * 18.0, vUv.y * 4.0)); float edge = 1.0 - abs(vUv.y - 0.5) * 2.0;
        float a = (0.55 + 0.45 * n) * smoothstep(0.0, 0.35, edge) * smoothstep(1.0, 0.8, vUv.x) * smoothstep(0.0, 0.03, vUv.x);
        gl_FragColor = vec4(mix(vec3(0.55, 0.78, 1.0), vec3(1.0), n * 0.8) * 1.1, a); }`,
  });
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), m);
  mesh.frustumCulled = false; mesh.renderOrder = 5;
  return mesh;
}
function waterPoints(n) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('aLife', new THREE.BufferAttribute(new Float32Array(n), 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'attribute float aLife; varying float vL; void main(){ vL = aLife; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aLife > 0.0 ? 70.0 / -mv.z : 0.0; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float vL; void main(){ vec2 p = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.15, length(p)) * clamp(vL * 2.0, 0.0, 1.0); if (a < 0.02) discard; gl_FragColor = vec4(mix(vec3(0.55, 0.78, 1.0), vec3(1.0), 0.35 + p.y), a * 0.85); }',
  });
  const pts = new THREE.Points(geo, m);
  pts.frustumCulled = false; pts.renderOrder = 5;
  return pts;
}
let SOOT = null;
/** Soft black soot smudge (canvas), for the wall above a window after the fire. */
function sootTex() {
  if (SOOT) return SOOT;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 14; i++) {
    const x = 64 + (Math.sin(i * 2.3) * 30), y = 80 - i * 4, r = 36 + (i % 3) * 8;
    const gr = g.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, 'rgba(18,14,12,0.62)'); gr.addColorStop(1, 'rgba(20,16,14,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }
  SOOT = new THREE.CanvasTexture(c); SOOT.colorSpace = THREE.SRGBColorSpace;
  return SOOT;
}
/** Hand-held hose nozzle for the first-person arm. */
function nozzle() {
  const g = new THREE.Group();
  const brass = std(0xd8b25a, { metalness: 0.8, roughness: 0.3 }), red = std(0xc4161c, { roughness: 0.4 }), blk = std(0x1b1b1d);
  const add = (geo, m, x, y, z, rx = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.x = rx; g.add(o); return o; };
  add(new THREE.CylinderGeometry(0.035, 0.05, 0.26, 16), brass, 0, 0.05, -0.12, PI / 2);
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 16), blk, 0, 0.05, 0.03, PI / 2);
  add(new THREE.BoxGeometry(0.05, 0.14, 0.05), red, 0, -0.03, 0.05);
  add(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 8), red, 0, 0.12, -0.02, PI / 2);
  return g;
}
/** Curbside mailbox on a post with a red flag (우편함). */
function postBox() {
  const g = new THREE.Group();
  const wood = std(0x8a6a4a, { roughness: 0.8 }), body = std(0x2f6fb0, { roughness: 0.45 }), red = std(0xd8302a, { roughness: 0.4, emissive: 0x6a0a06, emissiveIntensity: 0.4 }), white = std(0xf4f2ee);
  const add = (geo, m, x, y, z, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.z = rz; o.castShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(0.12, 1.1, 0.12), wood, 0, 0.55, 0);
  add(new THREE.BoxGeometry(0.36, 0.3, 0.52), body, 0, 1.25, 0);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.52, 18, 1, false, 0, PI), body);
  top.rotation.set(PI / 2, 0, PI / 2); top.position.set(0, 1.4, 0); g.add(top);
  add(new THREE.BoxGeometry(0.3, 0.06, 0.005), white, 0, 1.25, 0.262);
  const flag = new THREE.Group(); flag.position.set(0.12, 1.55, 0.05); g.add(flag);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 8), std(0xd9dcde, { metalness: 0.6, roughness: 0.3 })); pole.position.y = 0.31; flag.add(pole);
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.015), red); cloth.position.set(0.16, 0.5, 0); flag.add(cloth);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), std(0xf2c230, { metalness: 0.5, roughness: 0.3 })); ball.position.y = 0.63; flag.add(ball);
  g.userData.flag = flag;
  return g;
}
/** Round traffic podium with a striped skirt and cones (교통 정리 자리). */
function podium() {
  const g = new THREE.Group();
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  add(new THREE.CylinderGeometry(0.8, 0.86, 0.22, 28), std(0xf4f4f2), 0, 0.11, 0);
  add(new THREE.CylinderGeometry(0.81, 0.81, 0.08, 28), std(0x1f4f9a), 0, 0.17, 0);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * PI * 2, cone = new THREE.Group();
    cone.position.set(Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6); g.add(cone);
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 14), std(0xf27a1e, { roughness: 0.4 })); c.position.y = 0.32; cone.add(c);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.115, 0.08, 14), std(0xf4f4f2)); s.position.y = 0.36; cone.add(s);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.34), std(0xf27a1e)); b.position.y = 0.015; cone.add(b);
  }
  return g;
}

/* ------------------------------------------------------------------ the job runtime */
export class Jobs {
  constructor(day) {
    this.day = day;
    this.g = day.g;
    this.items = [];     // dynamic interactables (key 'job:<id>')
    this.objs = [];      // scene objects to clear at the end of the day
    this.people = [];    // {ch, mode, follow?}
    this.tool = null;    // 'hose' while the hose is in hand (blocks are off)
    this.ride = null;    // {kind, model, site, local, ry, box, own}
    this.scene = null;   // per-day things: {kid, mom, rings, fire, carts, mailboxes, ...}
    this.flash = 0;
  }
  get s() { return this.g.state; }
  get job() { return this.day.kind === 'job' ? this.day.plan.job : null; }
  get J() { return JOBS[this.job] ?? null; }
  get places() { return this.g.places; }
  get hud() { return this.g.hud; }
  sfx(n) { this.g.sfx(n); }
  ground(x, z) { return groundAt(x, z); }
  site(key) { return this.places.sites[key]; }
  W(siteKey, p) { const s = this.site(siteKey); return s ? V3(...xformPt(s, p)) : null; }
  count(id) { return this.s.counts[id] ?? 0; }

  // ------------------------------------------------------------------ interactables and objects
  addItem(id, label, pos, radius = 1.8, extra = {}) {
    const it = { id, label, site: 'job', key: `job:${id}`, wpos: pos.clone(), radius, seatW: null, screenW: null, ...extra };
    this.places.interactables.push(it);
    this.items.push(it);
    return it;
  }
  dropItem(it) {
    const L = this.places.interactables, i = L.indexOf(it);
    if (i >= 0) L.splice(i, 1);
    this.items = this.items.filter((x) => x !== it);
  }
  add(obj) { this.g.engine.scene.add(obj); this.objs.push(obj); return obj; }
  person(look, x, z, yaw, { kid = false, y } = {}) {
    const L = this.g.life;
    if (!L?.buildCharacter) return null;
    const ch = L.buildCharacter(look);
    ch.group.position.set(x, y ?? this.ground(x, z) + 0.02, z);
    ch.group.rotation.y = yaw;
    if (kid) ch.group.scale.setScalar(0.72);
    this.add(ch.group);
    const p = { ch, mode: 'idle', speed: 0 };
    this.people.push(p);
    return p;
  }
  say(p, text, h = 2.35, w = 2.2) {
    if (p.bubble) p.ch.group.remove(p.bubble);
    p.bubble = text ? bubble(text, w) : null;
    if (p.bubble) { p.bubble.position.y = h; p.ch.group.add(p.bubble); }
  }

  /** Where the marker and the navigation should point for job steps with moving targets. */
  target(st) {
    if (!st?.job) return null;
    const sc = this.scene, v = this.g.vehicle;
    switch (st.id) {
      case 'p-patrol': {
        if (this.ride?.kind === 'patrol' && v?.driving) { const P = PATROL[Math.min(this.count('p-patrol'), 2)]; return V3(P.p[0], 0, P.p[1]); }
        if (this.ride?.kind === 'patrol') return v.pos.clone();
        return null;
      }
      case 'p-lost': return sc?.kid ? sc.kid.ch.group.position.clone().add(V3(0, 0.6, 0)) : null;
      case 'p-mom': return sc?.mom ? sc.mom.ch.group.position.clone().add(V3(0, 1.0, 0)) : null;
      case 'p-traffic': return V3(TRAFFIC_AT[0], 0, TRAFFIC_AT[1]);
      case 'f-truck': return this.ride?.kind === 'truck' ? V3(FIRE_AT.truck[0], 0, FIRE_AT.truck[1]) : null;
      case 'f-hose': return sc?.hydrantIt ? sc.hydrantIt.wpos.clone() : null;
      case 'f-back': return this.ride?.kind === 'truck' && !v?.driving ? v.pos.clone() : null;
      case 'm-cart': {
        const left = (sc?.carts ?? []).filter((c) => !c.done);
        const from = this.g.player.pos;
        left.sort((a, b) => a.it.wpos.distanceTo(from) - b.it.wpos.distanceTo(from));
        return left[0] ? left[0].it.wpos.clone() : null;
      }
      case 'po-deliver': { const m = (sc?.mail ?? []).find((x) => !x.done); return m ? m.it.wpos.clone() : null; }
      default: return null;
    }
  }

  /** E on an interactable. true when the job runtime handled it. */
  async use(it, st, now) {
    if (now && st?.job) {
      const h = this[`do_${st.id.replace('-', '_')}`] ?? (st.id === 'job-out' ? this.out : null) ?? (/uniform|gown|apron|vest/.test(st.id) ? this.dress : null);
      if (h) { await h.call(this, it, st); return true; }
    }
    if (it.site === 'job') { this.hud.toast(it.idle ?? '지금은 할 일이 아니에요', 1800); return true; }
    if (IDLE[it.id]) { this.hud.toast(this.job && it.site === this.J.site ? `${IDLE[it.id]} · 지금 할 일: ${st?.label ?? '없음'}` : IDLE[it.id], 2200); return true; }
    return false;
  }

  /** After a step is completed (quests.js complete()). */
  completed(st) {
    if (!st.job) return;
    if (st.id === 'f-wait') this.alarm();
    if (st.id === 'p-patrol') setTimeout(() => this.hud.toast('📻 무전: “장난감 가게 앞에서 아이가 울고 있대요! 가 봐 주세요”', 4200), 1200);
    if (st.id === 'p-check') setTimeout(() => this.hud.toast('🔒 사물함은 민원실 옆으로 돌아 들어간 사무실 안쪽에 있어요', 3200), 700);
  }

  // ------------------------------------------------------------------ the day's things
  newDay() {
    this.stopHose(true);
    if (this.ride) this.returnRide(true);
    for (const it of [...this.items]) this.dropItem(it);
    for (const o of this.objs) o.removeFromParent();
    this.objs = []; this.people = []; this.scene = null;
    this.hideNpc(false);
    const mart = this.site('civic-mart');
    for (const c of mart?.extra?.strayCarts ?? []) c.visible = false;
    bar(null);
  }

  /** Make sure today's job things are in the town (also after loading a saved game mid-day). */
  ensure() {
    const job = this.job;
    if (!job) { if (this.scene) this.newDay(); return; }
    if (this.scene?.day === this.s.day && this.scene.job === job) return;
    if (this.scene) this.newDay();
    this.scene = { day: this.s.day, job };
    const sc = this.scene;
    if (job === 'police') {
      sc.rings = PATROL.map(() => this.add(ring()));
      sc.kid = this.person({ hair: 'short', outfit: 'casual', hairColor: 0x3b2a20, skin: 0xf1c9a5, seed: 61 }, KID_AT[0], KID_AT[1], 0, { kid: true });
      sc.mom = this.person({ hair: 'bob', outfit: 'casual', hairColor: 0x2a211c, skin: 0xf6d5b8, seed: 62 }, MOM_AT[0], MOM_AT[1], PI * 0.8);
      if (sc.kid) { this.say(sc.kid, '엉엉… 엄마 어디 있어요? 😢', 2.45); sc.kidIt = this.addItem('lostKid', '길 잃은 아이랑 이야기하기', sc.kid.ch.group.position.clone().add(V3(0, 1.1, 0)), 2.0, { idle: '아이가 울고 있어요… 경찰관이 도와줄 거예요' }); }
      if (sc.mom) { this.say(sc.mom, '우리 아이 못 보셨어요? 😥'); sc.momIt = this.addItem('mom', '엄마에게 아이 데려다주기', sc.mom.ch.group.position.clone().add(V3(0, 1.5, 0)), 2.2, { idle: '엄마: “우리 아이를 찾고 있어요…”' }); }
      const pd = this.add(podium());
      pd.position.set(TRAFFIC_AT[0], this.ground(TRAFFIC_AT[0], TRAFFIC_AT[1]), TRAFFIC_AT[1]);
      sc.trafficIt = this.addItem('traffic', '교통 정리 시작하기 (호루라기)', V3(TRAFFIC_AT[0], this.ground(TRAFFIC_AT[0], TRAFFIC_AT[1]) + 1.4, TRAFFIC_AT[1]), 2.4, { idle: '교통 정리하는 자리예요 🚦' });
      const i = this.day.steps.findIndex((x) => x.id === 'p-mom');
      if (this.s.step > i) this.reunite(true);
      else if (this.s.step === i && sc.kid) sc.kid.follow = true;
    }
    if (job === 'fire') this.fireScene();
    if (job === 'mart') {
      const mart = this.site('civic-mart');
      sc.carts = (mart?.extra?.strayCarts ?? []).map((g, k) => {
        const [x, z, ry] = CART_SPOTS[k % CART_SPOTS.length];
        g.position.set(x, 0.06, z); g.rotation.y = ry; g.visible = true;
        const done = k < this.count('m-cart');
        if (done) g.visible = false;
        const it = done ? null : this.addItem('cart', '카트 밀어서 보관소에 넣기', this.W('civic-mart', [x, 1.0, z]), 1.9, { idle: '주차장에 놓인 카트예요' });
        return { g, it, done };
      });
    }
    if (job === 'post') {
      sc.mail = MAIL_TO.map((m, k) => {
        const e = this.places.entrance(m.site);
        if (!e) return { done: true };
        const s = this.site(m.site), right = V3(Math.cos(s.worldYaw), 0, -Math.sin(s.worldYaw));
        const p = e.clone().addScaledVector(right, m.side);
        const box = this.add(postBox());
        box.position.set(p.x, this.ground(p.x, p.z), p.z);
        box.rotation.y = s.worldYaw;
        const done = k < this.count('po-deliver');
        if (done) { box.userData.flag.rotation.z = -PI * 0.55; box.userData.flag.position.y = 1.3; }
        return { box, done, name: m.name, it: done ? null : this.addItem('mailbox', `${m.name} 우편함에 편지 넣기`, V3(p.x, box.position.y + 1.3, p.z), 1.8, { idle: '우편함이에요 📬' }) };
      });
    }
  }

  /** The hospital's own doctor sits in the doctor's chair: on 의사 days you sit there, so that person takes the day off. */
  hideNpc(on) {
    const L = this.g.life;
    if (!L) return;
    if (!on) { if (this._docNpc) { this._docNpc.ch.group.visible = true; L.people.push(this._docNpc); this._docNpc = null; } return; }
    const hs = this.site('shop-hospital');
    if (this._docNpc || !hs?.interior) return; // the interior (and its people) is built when you come near
    const chair = V3(...xformPt(hs, [-3.05, 0.15, -3.3]));
    const i = L.people.findIndex((p) => p.site === 'shop-hospital' && p.ch.group.position.distanceTo(chair) < 0.6);
    if (i < 0) return;
    this._docNpc = L.people.splice(i, 1)[0];
    this._docNpc.ch.group.visible = false;
  }

  update(dt) {
    this.ensure();
    const st = this.day.step, sc = this.scene, v = this.g.vehicle;
    this.flash += dt;
    if (this.job === 'doctor' && !this._docNpc) this.hideNpc(true);
    if (this.tool === 'hose' && v?.driving) this.stopHose(true);
    // job vehicle lights
    if (this.ride) {
      const on = Math.floor(this.flash * 5) % 2;
      for (const [i, m] of (this.ride.model.flashMats ?? []).entries()) m.emissiveIntensity = (i % 2) === on ? 3.2 : 0.25;
      if (this.ride.kind === 'truck' && v.driving && st?.id === 'f-truck' && (this._siren = (this._siren ?? 0) - dt) <= 0) { this._siren = 1.25; this.sfx('siren'); }
      this.checkReturn(st);
    }
    // people
    for (const p of this.people) {
      if (p.follow) this.follow(p, dt);
      p.ch.update?.(dt, { speed: p.speed, mode: p.mode });
      if (p.bubble) p.bubble.material.opacity = Math.min(1, Math.max(0, 1 - (p.ch.group.position.distanceTo(this.g.engine.camera.position) - 30) / 10));
    }
    if (!sc || !st) { bar(null); return; }
    // patrol
    if (sc.rings) {
      const n = this.count('p-patrol'), patrolling = st.id === 'p-patrol' && this.ride?.kind === 'patrol';
      sc.rings.forEach((r, i) => {
        r.visible = patrolling && i === n;
        if (!r.visible) return;
        const P = PATROL[i];
        r.position.set(P.p[0], this.ground(P.p[0], P.p[1]) + 0.7 + Math.sin(this.flash * 3) * 0.12, P.p[1]);
        r.scale.setScalar(P.r / 1.6);
      });
      if (patrolling && v.driving && n < PATROL.length) {
        const P = PATROL[n], d = Math.hypot(v.pos.x - P.p[0], v.pos.z - P.p[1]), kmh = Math.round(Math.abs(v.speed) * 3.6);
        bar(`🚓 순찰 <b>${n}/${PATROL.length}</b> · 다음: <b>${P.name}</b> · ${Math.round(d)}m · 속도 <b class="${P.slow && kmh > 30 ? 'warn' : ''}">${kmh}km/h</b>${P.slow ? ' · 🐢 30km/h보다 천천히!' : ''}`);
        if (d < P.r) {
          if (P.slow && Math.abs(v.speed) > SCHOOL_ZONE) {
            if ((this._slowT = (this._slowT ?? 0) - dt) <= 0) { this._slowT = 2.2; this.sfx('wrong'); this.hud.toast('🐢 어린이 보호구역이에요! 30km/h보다 천천히 지나가요', 2000); }
          } else {
            this.s.counts['p-patrol'] = n + 1;
            this.sfx('pickup');
            this.hud.toast(`✔ 순찰 지점: ${P.name} 이상 없음! (${n + 1}/${PATROL.length})`, 2200);
            if (n + 1 >= PATROL.length) { bar(null); this.day.complete('p-patrol'); }
          }
        }
      } else if (st.id !== 'p-patrol' || !v.driving) bar(null);
    }
    // fire: flames and smoke, then the hose
    if (sc.fire) this.updateFire(dt, st);
    // fire truck arriving at the fire
    if (st.id === 'f-truck' && this.ride?.kind === 'truck' && v.driving) {
      const d = Math.hypot(v.pos.x - FIRE_AT.truck[0], v.pos.z - FIRE_AT.truck[1]);
      if (d < 16 && Math.abs(v.speed) < 3) { this.hud.toast('도착! 차에서 내려서(E) 빨간 소화전에 호스를 연결해요', 3600); this.day.complete('f-truck'); }
    }
    // mart carts rolling into the corral
    for (const c of sc.carts ?? []) if (c.roll) {
      c.roll.t = Math.min(1, c.roll.t + dt * 1.2);
      c.g.position.lerpVectors(c.roll.from, c.roll.to, c.roll.t * c.roll.t * (3 - 2 * c.roll.t));
      if (c.roll.t >= 1) { c.g.visible = false; c.roll = null; }
    }
  }

  // ------------------------------------------------------------------ job vehicles (순찰차, 소방차)
  /** Find the world collider a site made from a local box (to switch it off while the vehicle is away). */
  findBox(site, b) {
    if (!b) return null;
    const a = xformPt(site, b.min), c = xformPt(site, b.max);
    const min = [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.min(a[2], c[2])], max = [Math.max(a[0], c[0]), Math.max(a[1], c[1]), Math.max(a[2], c[2])];
    for (const box of this.g.col?.all ?? []) if (box.tag === site.key && box.min.every((v, i) => Math.abs(v - min[i]) < 0.02) && box.max.every((v, i) => Math.abs(v - max[i]) < 0.02)) return box;
    return null;
  }
  /** Get into a job vehicle parked at its station: it becomes the car you drive; your own car waits where it was. */
  board(kind) {
    const v = this.g.vehicle;
    if (!v) return false;
    const siteKey = kind === 'patrol' ? 'civic-police' : 'civic-fire', site = this.site(siteKey);
    const model = kind === 'patrol' ? site?.extra?.patrol : site?.extra?.truck;
    if (!model) { this.hud.toast('차가 준비 중이에요'); return false; }
    if (!this.ride) {
      const g = model.group, local = g.position.clone(), ry = g.rotation.y;
      const box = this.findBox(site, kind === 'patrol' ? site.extra.patrolBox : site.extra.truckBox);
      if (box) box.disabled = true;
      // your own car stays parked (with a collider) until the job vehicle is back
      const own = { m: v.m, half: { ...v.half }, pos: v.pos.clone(), yaw: v.yaw, y: v.y };
      const r = Math.max(own.half.w, own.half.l) * 0.8;
      own.box = this.g.col.add({ min: [own.pos.x - r, own.y, own.pos.z - r], max: [own.pos.x + r, own.y + 1.4, own.pos.z + r], tag: 'parked' });
      const wp = new THREE.Vector3(); g.getWorldPosition(wp);
      this.g.engine.scene.attach(g);
      this.ride = { kind, model, site, local, ry, box, own };
      v.m = model;
      v.half = { w: model.size.w / 2, l: model.size.l / 2 };
      v.park(wp.x, wp.z, ry + site.worldYaw);
    }
    v.driving = true;
    const pl = this.g.player;
    if (pl.avatar) pl.avatar.group.visible = false;
    if (pl.arm) pl.arm.group.visible = false;
    this.sfx('carDoor');
    return true;
  }
  /** Put the job vehicle back at its station and your own car back in its place. */
  returnRide(force = false) {
    const R = this.ride, v = this.g.vehicle;
    if (!R || !v || (v.driving && !force)) return;
    v.driving = false;
    R.site.group.add(R.model.group);
    R.model.group.position.copy(R.local);
    R.model.group.rotation.set(0, R.ry, 0);
    for (const m of R.model.flashMats ?? []) m.emissiveIntensity = 0.25;
    if (R.box) R.box.disabled = false;
    v.m = R.own.m; v.half = R.own.half;
    this.g.col.remove(R.own.box);
    v.park(R.own.pos.x, R.own.pos.z, R.own.yaw);
    this.ride = null;
  }
  /** Back at the station on foot with the job done: the vehicle goes back to its spot by itself. */
  checkReturn(st) {
    const R = this.ride, v = this.g.vehicle;
    if (!R || v.driving) return;
    const idx = this.day.s.step, steps = this.day.steps;
    const after = (id) => { const i = steps.findIndex((x) => x.id === id); return i < 0 || idx > i; };
    const home = new THREE.Vector3(...R.site.worldPos);
    // the vehicle is back, or you walked back (a coworker brings it home)
    const near = v.pos.distanceTo(home) < 26 || this.g.player.pos.distanceTo(home) < 16;
    const done = R.kind === 'patrol' ? after('p-patrol') : after('f-back');
    if ((done && near) || !st?.job) {
      this.returnRide();
      this.hud.toast(R.kind === 'patrol' ? '🚓 순찰차를 경찰서 앞에 세워 뒀어요' : '🚒 소방차를 차고에 넣었어요', 2400);
    }
  }

  // ------------------------------------------------------------------ mini game frame
  card(title, body, cls = '') {
    const J = this.J ?? {};
    return `<div class="mcard job-card ${cls}" style="--jc:${J.color ?? '#3a6fd8'}"><div class="jc-head"><span class="jc-icon">${J.icon ?? '⭐'}</span><h2>${title}</h2></div>${body}<button class="alt close jc-x">그만하기</button></div>`;
  }
  /** Open a mini game card; setup(el, finish) wires it and may return a cleanup. Resolves true when won. */
  mini(html, setup) {
    const d = this.day;
    return new Promise((resolve) => {
      d.busy = true;
      const el = d.overlay(html);
      let done = false, cleanup = null;
      const finish = d._miniFinish = (v) => {
        if (done) return;
        done = true; d._miniFinish = null;
        try { cleanup?.(); } catch { /* ignore */ }
        d.closeOverlay(); d.busy = false;
        resolve(!!v);
      };
      cleanup = setup(el, finish);
      el.querySelector('.jc-x')?.addEventListener('click', () => finish(false));
    });
  }
  shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); this.sfx('wrong'); }
  /** Sit at a seat pose (site-local eye position) while a card is open. */
  sitAt(siteKey, eye, yaw, pitch = -0.2) {
    const s = this.site(siteKey);
    if (!s) return;
    this.day.sit({ seatW: { pos: V3(...xformPt(s, eye)), yaw: yaw + s.worldYaw, pitch }, screenW: null });
  }

  // ------------------------------------------------------------------ shared steps
  /** Put on the work clothes (경찰 제복, 의사 가운, 요리사 옷, 마트 조끼, 우체부 옷). */
  async dress(it, st) {
    const J = this.J;
    const what = { police: '경찰 제복으로', doctor: '하얀 가운으로', chef: '요리사 옷으로', mart: '초록 조끼로', post: '우체부 옷으로' }[this.job] ?? '일하는 옷으로';
    await this.day.fadeAction(`${J.icon} ${what} 갈아입는 중…`, 'slide', 1200);
    this.day.setOutfit(J.outfit);
    this.hud.toast({ police: '👮 경찰 제복 완성! 이제 진짜 경찰관이에요', doctor: '🥼 하얀 가운 완성! 청진기도 챙겼어요', chef: '🧑‍🍳 요리사 옷 완성! 손도 깨끗이 씻었어요', mart: '🛒 초록 조끼 완성! 이름표도 달았어요', post: '📮 우체부 옷 완성! 가방에 편지가 가득' }[this.job] ?? '옷 완성!', 2800);
    this.day.complete(st.id);
  }
  /** 6 p.m.: change back, get paid, go home. */
  async out(it, st) {
    await this.day.fadeAction('👕 옷 갈아입는 중… 오늘도 수고했어요!', 'slide', 1200);
    this.day.setOutfit('casual');
    if (this.ride) this.returnRide(true);
    this.s.money += WAGE; this.sfx('coin');
    this.hud.toast(`오늘 일당 들어왔다! +${WAGE.toLocaleString('ko-KR')}원 💰 ${this.J.name} 최고!`, 3200);
    this.day.complete(st.id);
  }

  // ------------------------------------------------------------------ 👮 경찰관
  async do_p_check(it, st) {
    const ok = await this.mini(this.card('출근 체크', `<p class="jc-say">👮‍♂️ 반장님: “좋은 아침! 출근했나?”</p><div class="jc-opts" id="o"></div>`), (el, finish) => {
      const box = el.querySelector('#o');
      [['🫡 “충성! 출근했습니다!”', true], ['😴 “5분만 더 잘게요…”', false], ['🍩 “도넛 먹으러 왔어요”', false]].forEach(([t, good]) => {
        const b = document.createElement('button'); b.textContent = t;
        b.onclick = () => { if (!good) { this.shake(box); return; } this.sfx('done'); el.querySelector('.jc-say').innerHTML = '👮‍♂️ 반장님: “좋아! 오늘 순찰은 <b>마트 앞, 학교 앞, 병원 앞</b>이야. 사물함에서 제복 입고 순찰차 타고 가!”'; box.innerHTML = '<button id="go">알겠습니다! 🫡</button>'; box.querySelector('#go').onclick = () => finish(true); };
        box.appendChild(b);
      });
    });
    if (ok) this.day.complete(st.id);
  }
  async do_p_patrol() {
    if (this.ride?.kind === 'patrol') { this.board('patrol'); return; }
    await this.day.fadeAction('🚓 순찰차에 타는 중…', 'carDoor', 900);
    if (this.board('patrol')) this.hud.toast('🚓 출발! 파란 고리 순찰 지점 3곳을 돌아요. 경광등 번쩍번쩍!', 3600);
  }
  async do_p_lost(it, st) {
    const kid = this.scene?.kid;
    const ok = await this.mini(this.card('길 잃은 아이', `<p class="jc-say">🧒 “엉엉… 엄마랑 마트에 왔다가 길을 잃었어요…”</p><p class="small">경찰관은 뭐라고 말할까요?</p><div class="jc-opts" id="o"></div>`), (el, finish) => {
      const box = el.querySelector('#o');
      [['“괜찮아! 경찰관이 엄마 찾아 줄게 🤝”', true], ['“울지 마! 혼자 찾아봐”', false], ['“아이스크림 먹을래? 🍦”', false]].forEach(([t, good]) => {
        const b = document.createElement('button'); b.textContent = t;
        b.onclick = () => { if (!good) { this.shake(box); this.hud.toast('아이가 더 크게 울어요… 😭', 1200); return; } this.sfx('done'); el.querySelector('.jc-say').textContent = '🧒 “정말요? 고맙습니다! 우리 엄마는 세온 마트 앞에 있을 거예요!”'; box.innerHTML = '<button id="go">같이 가자! 손 잡아 🤝</button>'; box.querySelector('#go').onclick = () => finish(true); };
        box.appendChild(b);
      });
    });
    if (!ok) return;
    if (kid) { kid.follow = true; this.say(kid, '경찰관님 따라갈게요! 🙂', 2.45); }
    if (this.scene?.kidIt) this.dropItem(this.scene.kidIt);
    this.day.complete(st.id);
    this.hud.toast('아이가 졸졸 따라와요. 차를 타면 같이 타요. 세온 마트 앞의 엄마에게 가요!', 3600);
  }
  /** The lost child walks behind you (or rides along in the car). */
  follow(p, dt) {
    const pl = this.g.player, v = this.g.vehicle, g = p.ch.group;
    if (v?.driving) { g.visible = false; p.inCar = true; return; }
    if (p.inCar) { p.inCar = false; g.visible = true; g.position.set(pl.pos.x + 1.0, pl.pos.y, pl.pos.z + 1.0); }
    const want = pl.pos.clone().add(V3(Math.sin(pl.yaw) * 1.4, 0, Math.cos(pl.yaw) * 1.4));
    const d = V3(want.x - g.position.x, 0, want.z - g.position.z), len = d.length();
    if (len > 25) { g.position.copy(want); p.speed = 0; return; }
    const sp = len > 0.35 ? Math.min(5.5, len * 2.2) : 0;
    p.speed += (sp - p.speed) * Math.min(1, dt * 6);
    if (len > 0.01) {
      g.position.addScaledVector(d.normalize(), Math.min(len, p.speed * dt));
      g.rotation.y = Math.atan2(-d.x, -d.z);
    }
    g.position.y = Math.max(this.ground(g.position.x, g.position.z), pl.pos.y > 0.5 ? pl.pos.y : 0) + 0.02;
    p.mode = p.speed > 0.2 ? 'walk' : 'idle';
  }
  async do_p_mom(it, st) {
    const kid = this.scene?.kid;
    if (kid && kid.ch.group.position.distanceTo(it.wpos) > 7 && !kid.inCar) { this.hud.toast('아이가 아직 멀리 있어요! 같이 와요', 1800); return; }
    this.reunite();
    this.sfx('cheers');
    this.hud.toast('엄마: “고맙습니다, 경찰관님! 🙏” 아이: “경찰관님 최고! 👍”', 3600);
    this.day.complete(st.id);
  }
  reunite(quiet = false) {
    const { kid, mom } = this.scene ?? {};
    if (!kid || !mom) return;
    kid.follow = false; kid.inCar = false; kid.speed = 0; kid.mode = 'wave';
    const m = mom.ch.group.position;
    kid.ch.group.visible = true;
    kid.ch.group.position.set(m.x + 0.8, m.y, m.z + 0.5);
    kid.ch.group.rotation.y = mom.ch.group.rotation.y;
    mom.mode = 'wave';
    this.say(mom, quiet ? '고맙습니다! 😊' : '찾았다! 고마워요 경찰관님! 💕', 2.75);
    this.say(kid, '엄마! 🥰', 2.3, 1.3);
    if (this.scene.momIt) { this.dropItem(this.scene.momIt); this.scene.momIt = null; }
    if (this.scene.kidIt) { this.dropItem(this.scene.kidIt); this.scene.kidIt = null; }
  }
  async do_p_traffic(it, st) {
    if (this.g.vehicle?.driving) return;
    // up on the podium, facing the big road
    const [tx, tz] = TRAFFIC_AT;
    this.g.player.place(tx, this.ground(tx, tz) + 0.25, tz, 0);
    this.g.player.pitch = -0.05;
    await wait(350);
    const rounds = shuffle(TRAFFIC, this.s.day + 3).slice(0, 6);
    const ok = await this.mini(this.card('🚦 교통 정리', `<p class="small">상황을 보고 호루라기를 불어요! <b>✋ 멈춰요</b> 또는 <b>👉 가세요</b> (← → 키도 돼요)</p>
      <div class="jc-scene" id="sc"></div><div class="jc-timer"><i id="tm"></i></div><div class="jc-opts row"><button id="stop" class="big-btn">✋ 멈춰요!</button><button id="go" class="big-btn go">👉 가세요!</button></div><div class="jc-dots" id="dots"></div>`, 'wide'), (el, finish) => {
      let i = 0, t = 0, raf = 0, last = performance.now();
      const sc = el.querySelector('#sc'), tm = el.querySelector('#tm'), dots = el.querySelector('#dots');
      const show = () => { sc.textContent = rounds[i].what; t = 0; dots.innerHTML = rounds.map((_, k) => `<span class="${k < i ? 'on' : k === i ? 'now' : ''}"></span>`).join(''); sc.classList.remove('pop'); void sc.offsetWidth; sc.classList.add('pop'); };
      const answer = (a) => {
        this.sfx('whistle');
        if (a !== rounds[i].a) { this.shake(sc); this.hud.toast(rounds[i].a === 'stop' ? '삐익! 지금은 멈춰야 해요 ✋' : '삐익! 지금은 보내 줘야 해요 👉', 1400); t = 0; return; }
        this.sfx('pickup'); i++;
        if (i >= rounds.length) { this.sfx('done'); setTimeout(() => finish(true), 400); return; }
        show();
      };
      const loop = (now) => {
        t += (now - last) / 1000; last = now;
        tm.style.width = `${Math.max(0, 1 - t / 5) * 100}%`;
        if (t > 5) { this.hud.toast('앗, 늦었어요! 빨리 호루라기!', 1200); t = 0; this.sfx('wrong'); }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      const key = (e) => { if (e.code === 'ArrowLeft') answer('stop'); if (e.code === 'ArrowRight') answer('go'); };
      addEventListener('keydown', key);
      el.querySelector('#stop').onclick = () => answer('stop');
      el.querySelector('#go').onclick = () => answer('go');
      show();
      return () => { cancelAnimationFrame(raf); removeEventListener('keydown', key); };
    });
    if (ok) { this.hud.toast('교통 정리 완벽! 사람도 차도 안전하게 지나갔어요 🚦', 3000); this.day.complete(st.id); }
  }
  async do_p_report(it, st) {
    this.sitAt('civic-police', [2.5, 1.3, -4.6], PI, -0.32);
    await wait(600);
    const ok = await this.mini(this.card('📝 순찰 보고서', `<p class="small">오늘 한 일을 골라서 보고서를 완성해요</p><div class="jc-report" id="r"></div><button id="send" disabled>보고서 제출 📨</button>`, 'paper'), (el, finish) => {
      const r = el.querySelector('#r'), send = el.querySelector('#send'), got = REPORT.map(() => false);
      REPORT.forEach((q, k) => {
        const row = document.createElement('div'); row.className = 'jc-line';
        const [a, b] = q.line.split('___');
        row.innerHTML = `<span>${a}</span><span class="blank">?</span><span>${b}</span><div class="chips"></div>`;
        q.o.forEach((w, j) => {
          const c = document.createElement('button'); c.className = 'chip'; c.textContent = w;
          c.onclick = () => { if (j !== q.a) { this.shake(row); return; } this.sfx('click'); got[k] = true; row.querySelector('.blank').textContent = w; row.classList.add('ok'); row.querySelector('.chips').remove(); send.disabled = !got.every(Boolean); };
          row.querySelector('.chips').appendChild(c);
        });
        r.appendChild(row);
      });
      send.onclick = () => { this.sfx('done'); finish(true); };
    });
    this.day.stand();
    if (ok) { this.hud.toast('반장님: “보고서 아주 잘 썼네! 오늘 정말 수고했어” 👍', 3000); this.day.complete(st.id); }
  }

  // ------------------------------------------------------------------ 🚒 소방관
  async do_f_suit(it, st) {
    const order = FIRE_GEAR, picks = shuffle(order, this.s.day + 7);
    const t0 = performance.now();
    const ok = await this.mini(this.card('🧑‍🚒 소방복 입기', `<p class="small">출동하려면 빨리 입어야 해요! 아래부터 위로 순서대로 눌러요<br><b>바지 → 안전화 → 상의 → 공기통 → 헬멧 → 장갑</b></p>
      <div class="jc-dress"><div class="jc-body" id="body">🧍</div><div class="jc-worn" id="worn"></div></div><div class="jc-grid" id="g"></div><div class="jc-clock" id="ck">0.0초</div>`), (el, finish) => {
      let n = 0, raf = 0;
      const grid = el.querySelector('#g'), worn = el.querySelector('#worn'), ck = el.querySelector('#ck');
      const loop = () => { ck.textContent = `${((performance.now() - t0) / 1000).toFixed(1)}초`; raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
      for (const gItem of picks) {
        const b = document.createElement('button'); b.className = 'tile'; b.innerHTML = `<span>${gItem.icon}</span><small>${gItem.name}</small>`;
        b.onclick = () => {
          if (gItem.k !== order[n].k) { this.shake(grid); this.hud.toast(`순서가 틀렸어요! 다음은 ${order[n].name}`, 1300); return; }
          this.sfx('slide'); b.disabled = true; b.classList.add('on'); n++;
          worn.innerHTML += `<span>${gItem.icon}</span>`;
          if (n >= order.length) { cancelAnimationFrame(raf); setTimeout(() => finish(true), 500); }
        };
        grid.appendChild(b);
      }
      return () => cancelAnimationFrame(raf);
    });
    if (!ok) return;
    const sec = Math.max(1, Math.round((performance.now() - t0) / 1000));
    this.day.setOutfit('fire');
    this.hud.toast(`${sec}초 만에 소방복 완성! ${sec <= 60 ? '진짜 소방관처럼 1분 안에! 🔥' : '다음엔 더 빨리!'}`, 3200);
    this.day.complete(st.id);
  }
  alarm() {
    this.sfx('alarm'); setTimeout(() => this.sfx('alarm'), 900); setTimeout(() => this.sfx('siren'), 1700);
    const a = document.createElement('div'); a.id = 'job-alarm'; a.innerHTML = '<b>🚨 출동! 출동!</b><span>학교길 주택에 불이 났어요! 소방차 타고 출동!</span>';
    document.body.appendChild(a);
    setTimeout(() => a.remove(), 3600);
    if (this.scene?.fire) this.scene.fire.on = true;
  }
  async do_f_truck() {
    if (this.ride?.kind === 'truck') { this.board('truck'); return; }
    await this.day.fadeAction('🚒 소방차에 타는 중… 삐뽀삐뽀!', 'carDoor', 900);
    if (this.board('truck')) this.hud.toast('🚒 출동! 연기가 나는 학교길 집으로 가요. 사이렌 삐뽀삐뽀!', 3600);
  }
  fireScene() {
    const sc = this.scene, hs = this.site(FIRE_AT.house);
    if (!hs) return;
    const K = 3; // flames per burning spot
    const flames = this.add(fireMesh(FLAMES.length * K)), smoke = this.add(smokeMesh(64)), steam = this.add(smokeMesh(28, 0xeef2f5)), water = this.add(waterPoints(220)), jet = this.add(jetMesh());
    jet.visible = false;
    const done = this.day.steps.findIndex((x) => x.id === 'f-hose') < this.s.step;
    const spots = FLAMES.map(([x, y, w, h, size]) => {
      const win = w > 0;
      const p = V3(...xformPt(hs, [x, win ? y - h / 2 + 0.05 : y, win ? FACADE_Z + 0.12 : 0.9]));
      const spot = { p, s: size, hp: done ? 0 : 100, hit: V3(...xformPt(hs, [x, win ? y : y + 0.8, win ? FACADE_Z + 0.2 : 0.9])) };
      if (win) {
        // the room behind the glass glows orange while it burns; soot marks it afterwards
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.96, h * 0.94), new THREE.MeshBasicMaterial({ color: 0xff7a1e, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
        glow.position.copy(V3(...xformPt(hs, [x, y, FACADE_Z + 0.03]))); glow.rotation.y = hs.worldYaw;
        const soot = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.25, h * 1.1), new THREE.MeshBasicMaterial({ map: sootTex(), transparent: true, opacity: 0, depthWrite: false }));
        soot.position.copy(V3(...xformPt(hs, [x, y + h * 0.55, FACADE_Z + 0.04]))); soot.rotation.y = hs.worldYaw;
        spot.glow = this.add(glow); spot.soot = this.add(soot);
      }
      return spot;
    });
    const hy = hydrant();
    const [hx, hz] = FIRE_AT.hydrant;
    hy.position.set(hx, this.ground(hx, hz), hz); hy.rotation.y = PI / 2;
    this.add(hy);
    sc.hydrantIt = this.addItem('hydrant', '소화전에 호스 연결하기', V3(hx, hy.position.y + 0.9, hz), 1.9, { idle: '빨간 소화전이에요. 불 끌 때 써요 🧯' });
    const before = this.day.steps.findIndex((x) => x.id === 'f-wait') >= this.s.step;
    sc.fire = { flames, smoke, steam, water, jet, K, list: spots, on: !before, puffs: Array.from({ length: 64 }, (_, i) => ({ t: (i / 64) * 8, k: i % spots.length })), steamP: [], drops: Array.from({ length: 220 }, () => ({ p: V3(), v: V3(), life: 0 })), mtx: new THREE.Matrix4(), t: 0, arc: [] };
  }
  updateFire(dt, st) {
    const F = this.scene.fire, cam = this.g.engine.camera;
    F.t += dt;
    F.flames.material.uniforms.uTime.value = F.t;
    F.smoke.material.uniforms.uTime.value = F.t;
    const show = F.on;
    F.flames.visible = F.smoke.visible = show;
    // flames: three overlapping tongues per spot, smaller as the spot cools down
    const life = F.flames.geometry.attributes.aLife;
    F.list.forEach((f, i) => {
      const k = Math.max(0, f.hp / 100);
      for (let j = 0; j < F.K; j++) {
        const n = i * F.K + j, s = f.s * (0.4 + 0.6 * k) * [1, 0.78, 0.66][j] * (1 + Math.sin(F.t * 6 + n) * 0.06);
        const off = (j - 1) * f.s * 0.28;
        F.mtx.makeScale(s, s, s).setPosition(f.p.x + off, f.p.y, f.p.z + 0.03 * j);
        F.flames.setMatrixAt(n, F.mtx);
        life.array[n] = show && k > 0 ? 0.3 + 0.7 * k : 0;
      }
      if (f.glow) { f.glow.visible = show && k > 0; f.glow.material.opacity = (0.55 + 0.3 * Math.sin(F.t * 9 + i * 2) * Math.sin(F.t * 3.1 + i)) * Math.min(1, 0.4 + k); }
      if (f.soot) f.soot.material.opacity = show ? Math.min(0.95, (1 - k) * 1.1) : 0;
    });
    life.needsUpdate = true; F.flames.instanceMatrix.needsUpdate = true;
    // a tall smoke column (thin grey once the fire is out) that shows the way from far away
    const burning = F.list.filter((f) => f.hp > 0);
    const sl = F.smoke.geometry.attributes.aLife;
    F.puffs.forEach((p, i) => {
      p.t += dt;
      if (p.t > 8) { p.t = 0; p.k = burning.length ? F.list.indexOf(burning[i % burning.length]) : p.k; }
      const f = F.list[p.k], u = p.t / 8, src = burning.length ? 1 : 0.2;
      const pos = f.p.clone().add(V3(Math.sin(i * 3.1 + F.t * 0.3) * u * 3 + u * u * 6, f.s * 0.9 + u * 22, Math.cos(i * 1.7) * u * 2));
      const s = (1.4 + u * 9) * (0.7 + 0.3 * f.s);
      F.mtx.makeScale(s, s, s).setPosition(pos);
      F.smoke.setMatrixAt(i, F.mtx);
      sl.array[i] = show ? Math.min(1, u * 6) * (1 - u) * 0.95 * src : 0;
    });
    sl.needsUpdate = true; F.smoke.instanceMatrix.needsUpdate = true;
    // hose: a jet of water along its arc while the left button is held
    const H = this.tool === 'hose' ? this.hose : null;
    const spraying = !!H && (this.g.input.mouse.left || this._autoSpray);
    if (H) {
      const pl = this.g.player, hyd = this.scene.hydrantIt.wpos;
      if (Math.hypot(pl.pos.x - hyd.x, pl.pos.z - hyd.z) > 24) { this.hud.toast('호스가 짧아요! 소화전 가까이에서 뿌려요', 1500); const d = V3(pl.pos.x - hyd.x, 0, pl.pos.z - hyd.z).setLength(23); pl.pos.x = hyd.x + d.x; pl.pos.z = hyd.z + d.z; }
      this.drawHose();
    }
    const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    const side = new THREE.Vector3().crossVectors(dir, V3(0, 1, 0)).normalize();
    const nozzleAt = cam.position.clone().addScaledVector(dir, 0.55).add(V3(0, -0.26, 0)).addScaledVector(side, 0.2);
    const v0 = dir.clone().multiplyScalar(24).add(V3(0, 1.6, 0));
    F.arc.length = 0;
    if (spraying) {
      const p = nozzleAt.clone(), v = v0.clone();
      for (let i = 0; i < 26; i++) {
        F.arc.push(p.clone());
        p.addScaledVector(v, 0.05); v.y -= 9.8 * 0.05;
        if (p.y < this.ground(p.x, p.z) || F.arc.length > 2 && burning.some((f) => p.distanceTo(f.hit) < f.s * 0.5)) { F.arc.push(p.clone()); break; }
      }
      const curve = new THREE.CatmullRomCurve3(F.arc);
      F.jet.geometry.dispose();
      F.jet.geometry = new THREE.TubeGeometry(curve, 40, 0.075, 8, false);
      F.jet.material.uniforms.uTime.value = F.t;
    }
    F.jet.visible = spraying;
    let spawn = spraying ? dt * 140 : 0;
    const wl = F.water.geometry.attributes.aLife, wp = F.water.geometry.attributes.position;
    F.drops.forEach((d, i) => {
      if (d.life <= 0 && spawn >= 1 && F.arc.length > 2) {
        spawn--; d.life = 0.6 + Math.random() * 0.4;
        const a = F.arc[Math.floor(Math.random() * (F.arc.length - 1))];
        d.p.copy(a).add(V3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2));
        d.v.copy(v0).multiplyScalar(0.25).add(V3((Math.random() - 0.5) * 2.5, Math.random() * 1.5, (Math.random() - 0.5) * 2.5));
      }
      if (d.life > 0) {
        d.life -= dt; d.v.y -= 9.8 * dt; d.p.addScaledVector(d.v, dt);
        if (d.p.y < this.ground(d.p.x, d.p.z)) d.life = 0;
      }
      wl.array[i] = Math.max(0, d.life); wp.array[i * 3] = d.p.x; wp.array[i * 3 + 1] = d.p.y; wp.array[i * 3 + 2] = d.p.z;
    });
    wl.needsUpdate = true; wp.needsUpdate = true;
    // where the jet reaches a fire it cools down; steam puffs up there
    if (spraying && show) {
      if ((this._hiss = (this._hiss ?? 0) - dt) <= 0) { this._hiss = 0.5; this.sfx('water'); }
      for (const f of F.list) {
        if (f.hp <= 0) continue;
        const near = F.arc.some((a) => a.distanceTo(f.hit) < f.s * 0.75);
        if (!near) continue;
        f.hp -= dt * 50;
        if (Math.random() < dt * 14) F.steamP.push({ p: f.hit.clone().add(V3((Math.random() - 0.5) * f.s * 0.6, 0, 0.3)), t: 0 });
        if (f.hp <= 0) { this.sfx('sizzle'); this.hud.toast(`치이익… 불 하나 끔! 남은 불 ${F.list.filter((x) => x.hp > 0).length}개`, 1400); }
      }
    }
    const stl = F.steam.geometry.attributes.aLife;
    F.steamP = F.steamP.filter((p) => (p.t += dt) < 1.6).slice(-28);
    for (let i = 0; i < 28; i++) {
      const p = F.steamP[i];
      if (p) { const s = 0.8 + p.t * 2.2; F.mtx.makeScale(s, s, s).setPosition(p.p.x, p.p.y + p.t * 1.6, p.p.z); F.steam.setMatrixAt(i, F.mtx); }
      stl.array[i] = p ? Math.sin((p.t / 1.6) * PI) * 0.75 : 0;
    }
    stl.needsUpdate = true; F.steam.instanceMatrix.needsUpdate = true;
    if (H) {
      const left = F.list.filter((x) => x.hp > 0).length;
      bar(`🔥 남은 불 <b>${left}개</b> · <b>왼쪽 클릭 꾹</b> 물 뿌리기 · 마우스로 불을 겨눠요`);
      if (left === 0 && st?.id === 'f-hose') {
        this.stopHose(true);
        this.sfx('cheers');
        this.hud.toast('🎉 불을 다 껐어요! 집에 있던 사람들이 모두 무사해요. 소방관 최고!', 4000);
        this.day.complete('f-hose');
      }
    }
  }
  async do_f_hose() {
    if (this.g.vehicle?.driving) return;
    if (this.tool === 'hose') { this.stopHose(); return; }
    await this.day.fadeAction('🧯 소화전에 호스 연결 중… 철컥!', 'click', 900);
    this.tool = 'hose';
    this.hose = { line: null, t: 0 };
    const pl = this.g.player;
    if (pl.arm?.hold) { pl.arm.hold(nozzle()); pl._held = this.g.build.selectedId?.() ?? null; }
    this.hud.toast('호스 연결! 마우스로 불을 겨누고 왼쪽 클릭을 꾹 눌러 물을 뿌려요 💦', 3600);
    this.day._miniFinish = (v) => { if (!v) { this.stopHose(); return; } for (const f of this.scene?.fire?.list ?? []) f.hp = 0; };
  }
  stopHose(quiet = false) {
    if (this.tool !== 'hose') return;
    this.tool = null;
    if (this.hose?.line) { this.hose.line.removeFromParent(); this.hose.line.geometry.dispose(); }
    this.hose = null;
    this.day._miniFinish = null;
    const pl = this.g.player;
    if (pl.arm?.hold) { pl.arm.hold(null); pl._held = undefined; }
    bar(null);
    if (!quiet) this.hud.toast('호스를 내려놓았어요', 1200);
  }
  drawHose() {
    const H = this.hose;
    if ((H.t -= 1 / 60) > 0 && H.line) return;
    H.t = 0.1;
    const pl = this.g.player, hyd = this.scene.hydrantIt.wpos;
    const a = V3(hyd.x + 0.22, hyd.y - 0.45, hyd.z), end = V3(pl.pos.x, pl.pos.y + 0.95, pl.pos.z);
    const mid = a.clone().lerp(end, 0.5); mid.y = this.ground(mid.x, mid.z) + 0.06;
    const near = end.clone(); near.y = this.ground(near.x, near.z) + 0.1;
    const curve = new THREE.CatmullRomCurve3([a, V3(a.x + 0.3, a.y - 0.3, a.z), mid, near.clone().lerp(mid, 0.2), end]);
    const geo = new THREE.TubeGeometry(curve, 40, 0.055, 7, false);
    if (!H.line) { H.line = new THREE.Mesh(geo, std(0xe8c24a, { roughness: 0.55 })); H.line.castShadow = true; this.add(H.line); }
    else { H.line.geometry.dispose(); H.line.geometry = geo; }
  }
  async do_f_check(it, st) {
    const items = GEAR_CHECK;
    const ok = await this.mini(this.card('🔧 장비 점검', `<p class="small">장비를 하나씩 눌러서 점검해요. 고장 난 장비는 한 번 더 눌러서 고쳐요!</p><div class="jc-grid four" id="g"></div><p class="jc-note" id="n">점검 0 / ${items.length}</p>`), (el, finish) => {
      const grid = el.querySelector('#g'), note = el.querySelector('#n');
      const state = items.map(() => 0); // 0 not checked, 1 checked (broken shown), 2 fine
      const upd = () => {
        const checked = state.filter((x) => x > 0).length, broken = items.filter((x, k) => !x.ok && state[k] !== 2).length;
        note.textContent = `점검 ${checked} / ${items.length}${checked === items.length && broken ? ` · 고칠 장비 ${broken}개` : ''}`;
        if (checked === items.length && !broken) { this.sfx('done'); setTimeout(() => finish(true), 600); }
      };
      items.forEach((g0, k) => {
        const b = document.createElement('button'); b.className = 'tile'; b.innerHTML = `<span>${g0.icon}</span><small>${g0.name}</small><em></em>`;
        b.onclick = () => {
          if (state[k] === 0) { state[k] = g0.ok ? 2 : 1; this.sfx(g0.ok ? 'click' : 'wrong'); b.classList.add(g0.ok ? 'on' : 'bad'); b.querySelector('em').textContent = g0.ok ? '✅ 정상' : '⚠️ 고장! 눌러서 고치기'; }
          else if (state[k] === 1) { state[k] = 2; this.sfx('pickup'); b.classList.remove('bad'); b.classList.add('on'); b.querySelector('em').textContent = `🔧 ${g0.fix}`; }
          upd();
        };
        grid.appendChild(b);
      });
    });
    if (ok) { this.hud.toast('장비 점검 끝! 다음 출동도 준비 완료 🧑‍🚒', 3000); this.day.complete(st.id); }
  }

  // ------------------------------------------------------------------ 🧑‍⚕️ 의사
  async do_d_patient(it, st) {
    this.sitAt('shop-hospital', [-3.05, 1.27, -3.3], -PI / 2, -0.12);
    const n0 = this.count('d-patient');
    const patient = this.person({ hair: ['short', 'spiky', 'bob', 'short'][n0 % 4], outfit: 'casual', hairColor: 0x2a211c, seed: 70 + n0 }, 0, 0, 0, { y: 0 });
    const hs = this.site('shop-hospital');
    if (patient && hs) { patient.ch.group.position.set(...xformPt(hs, [-2.05, 0.15, -3.3])); patient.ch.group.rotation.y = PI / 2 + hs.worldYaw; patient.mode = 'sit'; }
    await wait(500);
    const list = PATIENTS;
    const ok = await this.mini(this.card('🩺 진료하기', `<div class="jc-patient" id="p"></div><p class="small" id="q"></p><div class="jc-opts" id="o"></div><div class="jc-dots" id="dots"></div>`), (el, finish) => {
      let i = n0, phase = 0;
      const P = el.querySelector('#p'), q = el.querySelector('#q'), box = el.querySelector('#o'), dots = el.querySelector('#dots');
      const show = () => {
        const pt = list[i % list.length];
        dots.innerHTML = [0, 1, 2].map((k) => `<span class="${k < i ? 'on' : k === i ? 'now' : ''}"></span>`).join('');
        P.innerHTML = `<b>${pt.who}</b><span>“${pt.say}”</span>`;
        box.innerHTML = '';
        const opts = phase === 0 ? Object.entries(DOC_TOOLS) : Object.entries(DOC_MEDS);
        q.textContent = phase === 0 ? '먼저 어떻게 살펴볼까요?' : '어떤 처방을 할까요?';
        for (const [k, t] of opts) {
          const b = document.createElement('button'); b.textContent = t;
          b.onclick = () => {
            const right = phase === 0 ? k === pt.tool : k === pt.med;
            if (!right) { this.shake(box); return; }
            this.sfx('click');
            if (phase === 0) { phase = 1; this.hud.toast({ steth: '🩺 쿵쿵… 숨소리를 들었어요', thermo: '🌡️ 38.5도! 열이 있어요', look: '🔍 상처가 조금 났어요' }[k], 1500); show(); return; }
            this.sfx('done'); i++; phase = 0; this.s.counts['d-patient'] = i;
            this.hud.toast(`환자: “고맙습니다 선생님! 😊” (${i}/3)`, 1600);
            if (patient) patient.ch.group.visible = false;
            if (i >= 3) { setTimeout(() => finish(true), 500); return; }
            setTimeout(() => { if (patient) { patient.ch.group.visible = true; } show(); }, 700);
          };
          box.appendChild(b);
        }
      };
      show();
    });
    this.day.stand();
    if (patient) { patient.ch.group.removeFromParent(); this.people = this.people.filter((x) => x !== patient); }
    if (ok || this.count('d-patient') >= 3) { this.hud.toast('오전 진료 끝! 환자 3명이 다 나았어요 🩺', 2800); this.day.complete(st.id); }
  }
  async do_d_xray(it, st) {
    const ok = await this.mini(this.card('🦴 엑스레이 보기', `<p class="small">축구하다 넘어진 형의 다리 사진이에요. 금이 간 뼈를 찾아서 눌러요!</p><canvas id="x" width="480" height="300" class="jc-xray"></canvas>`), (el, finish) => {
      const c = el.querySelector('#x'), g = c.getContext('2d');
      const crack = [338, 146];
      // a leg lying left (hip) to right (foot): thigh bone, kneecap, shin bone (cracked) and calf bone, foot
      const bone = (pts, w) => { g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = 'rgba(235,245,252,0.95)'; g.lineWidth = w; g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = w * 0.35; g.stroke(); };
      const knob = (x, y, rx, ry) => { g.fillStyle = 'rgba(240,248,253,0.96)'; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, PI * 2); g.fill(); };
      const draw = (hit) => {
        g.fillStyle = '#070a0e'; g.fillRect(0, 0, 480, 300);
        // soft tissue: the leg's outline
        g.fillStyle = 'rgba(120,165,200,0.22)'; g.beginPath();
        g.moveTo(10, 72); g.bezierCurveTo(150, 62, 220, 92, 250, 104); g.bezierCurveTo(330, 112, 400, 118, 430, 122); g.lineTo(470, 110); g.lineTo(474, 196); g.lineTo(430, 186);
        g.bezierCurveTo(360, 196, 300, 202, 250, 200); g.bezierCurveTo(200, 214, 120, 232, 10, 228); g.closePath(); g.fill();
        bone([[24, 150], [120, 147], [205, 150]], 30); knob(212, 140, 22, 18); knob(212, 162, 22, 17); // thigh bone and its knee end
        knob(236, 122, 13, 16); // kneecap
        knob(248, 150, 16, 22);
        bone([[252, 146], [340, 145], [420, 150]], 22); bone([[256, 174], [340, 172], [416, 168]], 11); // shin bone, calf bone
        knob(424, 156, 12, 16);
        for (let k = 0; k < 4; k++) bone([[436, 140 + k * 10], [462, 136 + k * 13]], 6); // foot
        g.strokeStyle = hit ? '#ff5a4a' : '#070a0e'; g.lineWidth = hit ? 4 : 3; g.lineCap = 'butt'; g.beginPath();
        g.moveTo(crack[0] - 5, crack[1] - 12); g.lineTo(crack[0] + 3, crack[1] - 3); g.lineTo(crack[0] - 3, crack[1] + 3); g.lineTo(crack[0] + 5, crack[1] + 12); g.stroke();
        if (hit) { g.strokeStyle = '#ff5a4a'; g.lineWidth = 3; g.beginPath(); g.arc(crack[0], crack[1], 28, 0, PI * 2); g.stroke(); }
        g.fillStyle = 'rgba(255,255,255,0.65)'; g.font = '16px Jua, sans-serif'; g.fillText('R  세온 병원 · 왼쪽 다리', 14, 26);
        g.fillText('허벅지뼈', 70, 118); g.fillText('정강이뼈', 300, 104); g.fillText('발', 440, 214);
      };
      draw(false);
      c.onclick = (e) => {
        const r = c.getBoundingClientRect(), x = (e.clientX - r.left) * 480 / r.width, y = (e.clientY - r.top) * 300 / r.height;
        if (Math.hypot(x - crack[0], y - crack[1]) < 34) { draw(true); this.sfx('done'); this.hud.toast('찾았다! 정강이뼈에 금이 갔어요. 깁스를 해 줘요 🦴', 2400); setTimeout(() => finish(true), 1300); }
        else { this.shake(c); this.hud.toast(y > 60 && y < 240 ? '이 뼈는 튼튼해요! 다른 곳을 봐요' : '뼈를 눌러요', 1300); }
      };
    });
    if (ok) this.day.complete(st.id);
  }
  async do_d_shot(it, st) {
    const hs = this.site('shop-hospital');
    const kid = this.person({ hair: 'long', outfit: 'casual', hairColor: 0x3b2a20, seed: 77 }, 0, 0, 0, { kid: true, y: 0 });
    if (kid && hs) { kid.ch.group.position.set(...xformPt(hs, [-3.7, 0.55, -1.97])); kid.ch.group.rotation.y = hs.worldYaw; kid.mode = 'sit'; this.say(kid, '주사 무서워요… 😣', 2.3); }
    const ok = await this.mini(this.card('💉 예방 주사', `<p class="jc-say">🧒 “주사 아파요?”</p><p class="small">주사기가 초록 칸에 올 때 누르면 하나도 안 아파요! (스페이스)</p><div class="tk jc-tk"><div class="zone"></div><div class="foot">💉</div></div><div class="big" id="n">0 / 2</div>`), (el, finish) => {
      const foot = el.querySelector('.foot'), zone = el.querySelector('.zone');
      let t = 0, ok2 = 0, raf = 0, last = performance.now(), z = 0.5;
      const place = () => { z = 0.3 + Math.random() * 0.4; zone.style.left = `${z * 100 - 7}%`; zone.style.width = '14%'; };
      place();
      const loop = (now) => { t += (now - last) / 1000; last = now; const x = (Math.sin(t * 2.0) + 1) / 2; foot.style.left = `${x * 100}%`; foot.dataset.x = x; raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
      const hit = () => {
        if (Math.abs(Number(foot.dataset.x) - z) < 0.075) { ok2++; this.sfx('pickup'); this.hud.toast(ok2 === 1 ? '소독 솜으로 쓱쓱~ 🧴' : '따끔! 하나도 안 아파요 😊', 1200); place(); }
        else { this.sfx('wrong'); this.hud.toast('아야! 살살~ 다시 해 봐요', 1000); }
        el.querySelector('#n').textContent = `${ok2} / 2`;
        if (ok2 >= 2) { cancelAnimationFrame(raf); setTimeout(() => finish(true), 600); }
      };
      const key = (e) => { if (e.code === 'Space') { e.preventDefault(); hit(); } };
      addEventListener('keydown', key);
      el.querySelector('.tk').onclick = hit;
      return () => { cancelAnimationFrame(raf); removeEventListener('keydown', key); };
    });
    if (kid) { this.say(kid, ok ? '하나도 안 아팠어요! 🍭' : '', 2.3); setTimeout(() => { kid.ch.group.removeFromParent(); this.people = this.people.filter((x) => x !== kid); }, ok ? 3500 : 0); }
    if (ok) { this.hud.toast('주사 끝! 용감한 어린이에게 사탕 하나 🍭', 2800); this.day.complete(st.id); }
  }

  // ------------------------------------------------------------------ 🧑‍🍳 요리사
  async do_c_pizza(it, st) {
    const n0 = this.count('c-pizza');
    const ok = await this.mini(this.card('🍕 피자 만들기', `<div class="jc-order" id="ord"></div><div class="jc-pizza-wrap"><canvas id="pz" width="260" height="260"></canvas><div class="jc-grid three" id="g"></div></div><div class="jc-oven hidden" id="ov"><div class="bar"><i id="heat"></i><span class="gold"></span></div><button id="take">🔥 오븐에서 꺼내기!</button></div><div class="jc-dots" id="dots"></div>`, 'wide'), (el, finish) => {
      let n = n0, need = [], k = 0, raf = 0, heat = 0, baking = false, last = 0;
      const ord = el.querySelector('#ord'), grid = el.querySelector('#g'), cv = el.querySelector('#pz'), g = cv.getContext('2d'), ov = el.querySelector('#ov'), hb = el.querySelector('#heat'), dots = el.querySelector('#dots');
      const placed = [];
      const draw = () => {
        g.clearRect(0, 0, 260, 260);
        // wooden pizza board with a handle, grain rings
        g.fillStyle = '#b07a44'; g.beginPath(); g.arc(130, 130, 122, 0, PI * 2); g.fill();
        g.strokeStyle = 'rgba(120,70,30,0.35)'; g.lineWidth = 2; for (let r = 20; r < 120; r += 14) { g.beginPath(); g.arc(128, 132, r, 0, PI * 2); g.stroke(); }
        g.strokeStyle = '#8a5a2a'; g.lineWidth = 5; g.beginPath(); g.arc(130, 130, 119, 0, PI * 2); g.stroke();
        if (!placed.includes('dough')) { g.setLineDash([10, 8]); g.strokeStyle = 'rgba(255,248,230,0.9)'; g.lineWidth = 4; g.beginPath(); g.arc(130, 130, 98, 0, PI * 2); g.stroke(); g.setLineDash([]); g.fillStyle = 'rgba(255,248,230,0.95)'; g.font = '22px Jua, sans-serif'; g.textAlign = 'center'; g.fillText('반죽부터!', 130, 138); g.textAlign = 'start'; return; }
        const bake = Math.min(1, heat);
        g.fillStyle = `rgb(${240 - bake * 40},${214 - bake * 70},${160 - bake * 90})`; g.beginPath(); g.arc(130, 130, 104, 0, PI * 2); g.fill();
        if (placed.includes('sauce')) { g.fillStyle = '#c8322a'; g.beginPath(); g.arc(130, 130, 90, 0, PI * 2); g.fill(); }
        if (placed.includes('cheese')) { g.fillStyle = `rgb(${250 - bake * 20},${222 - bake * 50},${120 - bake * 50})`; for (let i = 0; i < 26; i++) { const a = i * 2.4, r = 20 + (i * 37) % 64; g.beginPath(); g.arc(130 + Math.cos(a) * r, 130 + Math.sin(a) * r, 22, 0, PI * 2); g.fill(); } }
        const col = { pepperoni: '#a8201a', bulgogi: '#6a3a1e', onion: '#f0e6f0', pepper: '#3a9a3a', olive: '#2b2b2b' };
        placed.filter((p) => col[p]).forEach((p, j) => { g.fillStyle = col[p]; for (let i = 0; i < 9; i++) { const a = i * 0.7 + j * 1.3, r = 26 + ((i * 29 + j * 13) % 56); g.beginPath(); g.arc(130 + Math.cos(a) * r, 130 + Math.sin(a) * r, p === 'pepperoni' ? 13 : 8, 0, PI * 2); g.fill(); } });
        if (heat > 1.25) { g.fillStyle = 'rgba(20,10,5,0.55)'; g.beginPath(); g.arc(130, 130, 104, 0, PI * 2); g.fill(); }
      };
      const start = () => {
        const P = PIZZAS[n % PIZZAS.length];
        need = ['dough', 'sauce', 'cheese', ...P.top]; k = 0; placed.length = 0; heat = 0; baking = false;
        ord.innerHTML = `🧾 주문 ${n + 1}: <b>${P.name}</b> · ${need.map((x) => TOPPINGS[x].split(' ')[0]).join(' → ')}`;
        dots.innerHTML = [0, 1].map((j) => `<span class="${j < n ? 'on' : j === n ? 'now' : ''}"></span>`).join('');
        grid.innerHTML = ''; ov.classList.add('hidden'); grid.classList.remove('hidden');
        for (const [key, label] of Object.entries(TOPPINGS)) {
          const b = document.createElement('button'); b.className = 'tile'; const [ic, ...nm] = label.split(' ');
          b.innerHTML = `<span>${ic}</span><small>${nm.join(' ')}</small>`;
          b.onclick = () => {
            if (key !== need[k]) { this.shake(grid); this.hud.toast(k < 3 ? `순서대로! 다음은 ${TOPPINGS[need[k]]}` : '주문서에 없는 재료예요!', 1300); return; }
            this.sfx('click'); placed.push(key); k++; draw();
            if (k >= need.length) { grid.classList.add('hidden'); ov.classList.remove('hidden'); baking = true; last = performance.now(); this.hud.toast('오븐에 쏙! 노릇노릇해지면 꺼내요', 1600); }
          };
          grid.appendChild(b);
        }
        draw();
      };
      const loop = (now) => {
        if (baking) { heat += (now - last) / 1000 / 4.5; last = now; hb.style.width = `${Math.min(100, heat / 1.5 * 100)}%`; draw(); if (heat > 1.5) { baking = false; this.sfx('wrong'); this.hud.toast('앗, 탔다! 다시 만들어요 🔥', 1600); setTimeout(start, 900); } }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      el.querySelector('#take').onclick = () => {
        if (!baking) return;
        if (heat < 0.85) { this.hud.toast('아직 덜 익었어요! 조금만 더', 1100); this.sfx('click'); return; }
        baking = false; this.sfx('done'); n++; this.s.counts['c-pizza'] = n;
        this.hud.toast(`노릇노릇 ${PIZZAS[(n - 1) % PIZZAS.length].name} 완성! 🍕 (${n}/2)`, 1800);
        if (n >= 2) setTimeout(() => finish(true), 900); else setTimeout(start, 1100);
      };
      start();
      return () => cancelAnimationFrame(raf);
    });
    if (ok || this.count('c-pizza') >= 2) { this.hud.toast('피자 2판 완성! 이제 손님에게 갖다 줘요', 2600); this.day.complete(st.id); }
  }
  async do_c_serve(it, st) {
    await this.day.fadeAction('🍕 피자를 들고 가는 중…', 'slide', 900);
    this.sfx('cheers'); eat(this.s, 5);
    this.hud.toast('손님: “와! 진짜 맛있어요! 요리사님 최고 👍” (피자 한 조각 맛봤어요)', 3400);
    this.day.complete(st.id);
  }

  // ------------------------------------------------------------------ 🛒 마트 직원 / 📮 우체부: sorting
  sortGame(title, hint, things, bins, label) {
    return this.mini(this.card(title, `<p class="small">${hint}</p><div class="jc-now" id="now"></div><div class="jc-bins" id="b"></div><div class="jc-dots" id="dots"></div>`), (el, finish) => {
      let i = 0;
      const now = el.querySelector('#now'), b = el.querySelector('#b'), dots = el.querySelector('#dots');
      const show = () => { now.innerHTML = label(things[i]); dots.innerHTML = things.map((_, k) => `<span class="${k < i ? 'on' : k === i ? 'now' : ''}"></span>`).join(''); now.classList.remove('pop'); void now.offsetWidth; now.classList.add('pop'); };
      for (const [k, name] of Object.entries(bins)) {
        const btn = document.createElement('button'); btn.className = 'bin'; btn.textContent = name;
        btn.onclick = () => {
          if (things[i].to !== k && things[i].box !== k) { this.shake(now); return; }
          this.sfx('place'); i++;
          if (i >= things.length) { this.sfx('done'); setTimeout(() => finish(true), 500); return; }
          show();
        };
        b.appendChild(btn);
      }
      show();
    });
  }
  async do_m_stock(it, st) {
    const ok = await this.sortGame('📦 물건 채우기', '물건을 알맞은 진열대로 옮겨요', shuffle(STOCK, this.s.day), AISLES, (x) => `<span class="em">${x.icon}</span><b>${x.name}</b>`);
    if (ok) { this.hud.toast('진열대가 꽉 찼어요! 손님들이 좋아해요 🛒', 2600); this.day.complete(st.id); }
  }
  async do_po_sort(it, st) {
    const ok = await this.sortGame('✉️ 편지 나누기', '편지에 쓰인 주소를 보고 알맞은 칸에 넣어요', shuffle(LETTERS, this.s.day + 1), SLOTS, (x) => `<span class="em">✉️</span><b>${x.to}</b>`);
    if (ok) { this.hud.toast('편지 정리 끝! 이제 동네에 배달하러 가요 (빨간 깃발 우편함 3곳)', 3400); this.day.complete(st.id); }
  }
  async do_m_cashier(it, st) {
    const n0 = this.count('m-cashier');
    const ok = await this.mini(this.card('💳 계산하기', `<div class="jc-belt" id="belt"></div><p class="jc-total" id="tot">물건을 눌러서 삑! 찍어요</p><div class="jc-opts row" id="o"></div><div class="jc-dots" id="dots"></div>`, 'wide'), (el, finish) => {
      let n = n0;
      const belt = el.querySelector('#belt'), tot = el.querySelector('#tot'), box = el.querySelector('#o'), dots = el.querySelector('#dots');
      const show = () => {
        const c = CUSTOMERS[n % CUSTOMERS.length];
        let sum = 0, left = c.items.length;
        dots.innerHTML = [0, 1, 2].map((j) => `<span class="${j < n ? 'on' : j === n ? 'now' : ''}"></span>`).join('');
        belt.innerHTML = ''; box.innerHTML = ''; tot.textContent = `손님 ${n + 1}: 물건을 눌러서 삑! 찍어요`;
        for (const [name, price] of c.items) {
          const b = document.createElement('button'); b.className = 'item'; b.innerHTML = `${name}<small>${price.toLocaleString('ko-KR')}원</small>`;
          b.onclick = () => {
            if (b.disabled) return;
            b.disabled = true; b.classList.add('on'); this.sfx('pickup'); sum += price; left--;
            tot.textContent = `합계 ${sum.toLocaleString('ko-KR')}원`;
            if (!left) {
              tot.innerHTML = `합계 <b>${cartTotal(c).toLocaleString('ko-KR')}원</b> · 손님이 <b>${c.paid.toLocaleString('ko-KR')}원</b>을 냈어요. 거스름돈은?`;
              for (const v of changeOptions(c, n)) {
                const o = document.createElement('button'); o.textContent = `💵 ${v.toLocaleString('ko-KR')}원`;
                o.onclick = () => {
                  if (v !== changeFor(c)) { this.shake(box); return; }
                  this.sfx('coin'); n++; this.s.counts['m-cashier'] = n;
                  this.hud.toast(`손님: “감사합니다!” (${n}/3)`, 1400);
                  if (n >= 3) setTimeout(() => finish(true), 600); else setTimeout(show, 700);
                };
                box.appendChild(o);
              }
            }
          };
          belt.appendChild(b);
        }
      };
      show();
    });
    if (ok || this.count('m-cashier') >= 3) { this.hud.toast('계산 끝! 손님 3명 모두 웃으며 갔어요 💳', 2800); this.day.complete(st.id); }
  }
  async do_m_cart(it) {
    const c = (this.scene?.carts ?? []).find((x) => x.it === it);
    if (!c) return;
    const k = this.count('m-cart');
    c.done = true; this.dropItem(it); c.it = null;
    c.roll = { t: 0, from: c.g.position.clone(), to: V3(8.6 + 3.6 - k * 0.36, 0.06, 3.0) };
    c.g.rotation.y = PI;
    this.sfx('slide');
    const n = k + 1;
    this.s.counts['m-cart'] = n;
    this.hud.toast(n >= 4 ? '카트 4대 모두 정리 끝! 🛒' : `덜컹덜컹~ 카트 보관소에 쏙! (${n}/4)`, 1600);
    if (n >= 4) this.day.complete('m-cart');
  }
  async do_po_deliver(it) {
    const m = (this.scene?.mail ?? []).find((x) => x.it === it);
    if (!m) return;
    this.sfx('pickup');
    m.done = true; this.dropItem(it); m.it = null;
    m.box.userData.flag.rotation.z = -PI * 0.55; m.box.userData.flag.position.y = 1.3;
    const n = this.count('po-deliver') + 1;
    this.s.counts['po-deliver'] = n;
    this.hud.toast(n >= 3 ? '편지 배달 끝! 동네 사람들이 편지를 받고 좋아해요 💌' : `📬 ${m.name}에 편지 배달 완료! (${n}/3)`, 2200);
    if (n >= 3) this.day.complete('po-deliver');
  }
}
