// 반짝이는 것들: 포털, 분수, 코인, 폭죽, 터지는 조각.
import { THREE } from './render.js';

const portalVS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const portalFS = `uniform float time; uniform vec3 color; varying vec2 vUv;
  void main(){
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p * vec2(1.0, 0.92));
    float a = atan(p.y, p.x);
    float swirl = sin(a * 5.0 + r * 9.0 - time * 3.2) * 0.5 + 0.5;
    float ring = smoothstep(1.0, 0.82, r);
    float core = smoothstep(0.75, 0.0, r);
    vec3 col = mix(color, vec3(1.0), swirl * 0.45 + core * 0.55);
    float alpha = ring * (0.55 + swirl * 0.3 + core * 0.15);
    gl_FragColor = vec4(col * 1.25, alpha);
    #include <colorspace_fragment>
  }`;

const coinGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.14, 24);
coinGeo.rotateX(Math.PI / 2);
const coinMat = new THREE.MeshStandardMaterial({ color: '#ffd23f', metalness: 0.55, roughness: 0.28, emissive: '#c98a00', emissiveIntensity: 0.55 });
const bitGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
const confettiGeo = new THREE.PlaneGeometry(0.22, 0.32);

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.portals = []; this.fountains = []; this.sparkles = [];
    this.coins = null; this.coinData = [];
    this.bits = [];
    this.bitMesh = new THREE.InstancedMesh(bitGeo, new THREE.MeshStandardMaterial({ roughness: 0.5 }), 260);
    this.bitMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bitMesh.count = 0; this.bitMesh.frustumCulled = false;
    this.confMesh = new THREE.InstancedMesh(confettiGeo, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6 }), 400);
    this.confMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.confMesh.count = 0; this.confMesh.frustumCulled = false;
    this.conf = [];
    scene.add(this.bitMesh, this.confMesh);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3(); this.c = new THREE.Color();
  }

  clear() {
    this.group.traverse(o => { if (o.isMesh || o.isPoints) { if (o.geometry !== coinGeo) o.geometry.dispose(); if (o.material !== coinMat) o.material.dispose(); } });
    this.group.clear();
    this.portals = []; this.fountains = []; this.sparkles = []; this.coins = null; this.coinData = [];
    this.bits = []; this.conf = []; this.bitMesh.count = 0; this.confMesh.count = 0;
  }

  add(spec) {
    if (spec.type === 'portal') this.portal(spec);
    else if (spec.type === 'fountain') this.fountain(spec);
    else if (spec.type === 'sparkle') this.sparkle(spec);
  }

  portal({ x, y, z, w, h, color, ry = 0 }) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { time: { value: Math.random() * 10 }, color: { value: new THREE.Color(color) } },
      vertexShader: portalVS, fragmentShader: portalFS, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z); mesh.rotation.y = ry;
    this.group.add(mesh);
    this.portals.push(mat);
  }

  fountain({ x, y, z }) {
    const n = 220;
    const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3), life = new Float32Array(n);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: '#bfeaff', size: 0.32, transparent: true, opacity: 0.85, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.group.add(pts);
    for (let i = 0; i < n; i++) life[i] = -Math.random() * 1.6;
    this.fountains.push({ x, y, z, pos, vel, life, geo, n });
  }

  sparkle({ x, y, z }) {
    const g = new THREE.Group(); g.position.set(x, y, z);
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), new THREE.MeshBasicMaterial({ color: i % 2 ? '#fff6b0' : '#ffffff' }));
      const a = (i / 10) * Math.PI * 2;
      m.position.set(Math.cos(a) * 2.2, Math.sin(i * 1.7) * 0.8, Math.sin(a) * 2.2);
      g.add(m);
    }
    this.group.add(g);
    this.sparkles.push(g);
  }

  setCoins(list) {
    this.coinData = list.map(([x, y, z], i) => ({ x, y, z, taken: false, phase: i * 0.7 }));
    if (!list.length) return;
    this.coins = new THREE.InstancedMesh(coinGeo, coinMat, list.length);
    this.coins.castShadow = true;
    this.coins.frustumCulled = false;
    this.group.add(this.coins);
  }

  // 주인공 가까이 있는 코인 → 번호들
  takeCoins(px, py, pz) {
    const got = [];
    this.coinData.forEach((c, i) => {
      if (c.taken) return;
      const dx = c.x - px, dy = c.y - (py + 1.3), dz = c.z - pz;
      if (dx * dx + dz * dz < 1.6 && Math.abs(dy) < 1.8) { c.taken = true; got.push(i); this.burst(c.x, c.y, c.z, ['#ffd23f', '#fff1a8'], 10, 4); }
    });
    return got;
  }

  resetCoins() { for (const c of this.coinData) c.taken = false; }

  burst(x, y, z, colors, n = 18, power = 6) {
    for (let i = 0; i < n && this.bits.length < 260; i++) {
      const a = Math.random() * Math.PI * 2, up = 0.4 + Math.random();
      this.bits.push({ x, y, z, vx: Math.cos(a) * power * Math.random(), vy: power * up, vz: Math.sin(a) * power * Math.random(), life: 0.7 + Math.random() * 0.5, rx: Math.random() * 6, color: new THREE.Color(colors[i % colors.length]) });
    }
  }

  confetti(x, y, z, n = 160) {
    const cols = ['#ff4d5e', '#ffd23f', '#5ad16b', '#3fa7ff', '#9b5cff', '#ff8fc7'];
    for (let i = 0; i < n && this.conf.length < 400; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 3;
      this.conf.push({ x: x + Math.cos(a) * r, y: y + Math.random() * 2, z: z + Math.sin(a) * r, vx: Math.cos(a) * (2 + Math.random() * 5), vy: 8 + Math.random() * 9, vz: Math.sin(a) * (2 + Math.random() * 5), life: 3 + Math.random() * 2, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 12, color: new THREE.Color(cols[i % cols.length]) });
    }
  }

  update(dt, t) {
    for (const m of this.portals) m.uniforms.time.value += dt;
    for (const g of this.sparkles) { g.rotation.y += dt * 0.8; g.children.forEach((c, i) => { c.rotation.y += dt * 3; c.position.y = Math.sin(t * 2 + i * 1.7) * 0.8; }); }
    for (const f of this.fountains) {
      for (let i = 0; i < f.n; i++) {
        f.life[i] -= dt;
        const k = i * 3;
        if (f.life[i] <= 0) {
          if (f.life[i] > -0.02 || f.life[i] < -2) {
            const a = Math.random() * Math.PI * 2, s = 1.2 + Math.random() * 1.6;
            f.pos[k] = f.x; f.pos[k + 1] = f.y; f.pos[k + 2] = f.z;
            f.vel[k] = Math.cos(a) * s; f.vel[k + 1] = 5.5 + Math.random() * 2.5; f.vel[k + 2] = Math.sin(a) * s;
            f.life[i] = 1.2 + Math.random() * 0.4;
          } else { f.pos[k + 1] = -100; continue; }
        }
        f.vel[k + 1] -= 14 * dt;
        f.pos[k] += f.vel[k] * dt; f.pos[k + 1] += f.vel[k + 1] * dt; f.pos[k + 2] += f.vel[k + 2] * dt;
        if (f.pos[k + 1] < 0.6) f.life[i] = 0;
      }
      f.geo.attributes.position.needsUpdate = true;
    }
    if (this.coins) {
      this.coinData.forEach((c, i) => {
        const s = c.taken ? 0 : 1;
        this.e.set(0, t * 2.4 + c.phase, 0); this.q.setFromEuler(this.e);
        this.v.set(c.x, c.y + Math.sin(t * 2.5 + c.phase) * 0.18, c.z); this.s.set(s, s, s);
        this.m.compose(this.v, this.q, this.s);
        this.coins.setMatrixAt(i, this.m);
      });
      this.coins.instanceMatrix.needsUpdate = true;
    }
    // 조각
    let n = 0;
    this.bits = this.bits.filter(b => (b.life -= dt) > 0);
    for (const b of this.bits) {
      b.vy -= 22 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.rx += dt * 8;
      const s = Math.min(1, b.life * 2);
      this.e.set(b.rx, b.rx * 0.7, 0); this.q.setFromEuler(this.e); this.v.set(b.x, b.y, b.z); this.s.set(s, s, s);
      this.m.compose(this.v, this.q, this.s);
      this.bitMesh.setMatrixAt(n, this.m); this.bitMesh.setColorAt(n, b.color); n++;
    }
    this.bitMesh.count = n;
    this.bitMesh.instanceMatrix.needsUpdate = true;
    if (this.bitMesh.instanceColor) this.bitMesh.instanceColor.needsUpdate = true;
    n = 0;
    this.conf = this.conf.filter(c => (c.life -= dt) > 0);
    for (const c of this.conf) {
      c.vy = Math.max(c.vy - 14 * dt, -3); c.vx *= 1 - dt * 1.5; c.vz *= 1 - dt * 1.5;
      c.x += c.vx * dt + Math.sin(c.life * 4 + c.rot) * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.rot += c.spin * dt;
      this.e.set(c.rot, c.rot * 0.6, c.rot * 0.3); this.q.setFromEuler(this.e); this.v.set(c.x, c.y, c.z);
      const s = Math.min(1, c.life); this.s.set(s, s, s);
      this.m.compose(this.v, this.q, this.s);
      this.confMesh.setMatrixAt(n, this.m); this.confMesh.setColorAt(n, c.color); n++;
    }
    this.confMesh.count = n;
    this.confMesh.instanceMatrix.needsUpdate = true;
    if (this.confMesh.instanceColor) this.confMesh.instanceColor.needsUpdate = true;
  }
}
