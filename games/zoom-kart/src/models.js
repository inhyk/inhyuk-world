// 카트, 선수, 아이템 모양과 반짝이 효과. 전부 코드로 만든 도형.
import * as THREE from 'three';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1, ...o });
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; };

function makeDriver(racer) {
  const g = new THREE.Group(), skin = std(racer.color, { roughness: 0.6 }), white = std(0xffffff), black = std(0x1a1a22);
  g.add(mesh(new THREE.CapsuleGeometry(0.3, 0.3, 4, 10), skin, 0, 0.35, 0));
  const head = new THREE.Group(); head.position.y = 0.98; g.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.46, 18, 14), skin));
  for (const s of [-1, 1]) {
    head.add(mesh(new THREE.SphereGeometry(0.11, 10, 8), white, s * 0.17, 0.08, 0.39));
    head.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), black, s * 0.17, 0.08, 0.48));
  }
  const dark = std(new THREE.Color(racer.color).multiplyScalar(0.72));
  if (racer.ears === 'round') for (const s of [-1, 1]) head.add(mesh(new THREE.SphereGeometry(0.17, 10, 8), dark, s * 0.34, 0.36, 0));
  else if (racer.ears === 'point') for (const s of [-1, 1]) head.add(mesh(new THREE.ConeGeometry(0.16, 0.3, 4), dark, s * 0.28, 0.46, 0));
  else if (racer.ears === 'long') for (const s of [-1, 1]) { const e = mesh(new THREE.CapsuleGeometry(0.09, 0.5, 4, 8), skin, s * 0.2, 0.7, -0.05); e.rotation.z = -s * 0.2; head.add(e); }
  else if (racer.ears === 'antenna') { head.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), black, 0, 0.62, 0)); head.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), std(0xff4d5e, { emissive: 0xff2244, emissiveIntensity: 1 }), 0, 0.84, 0)); }
  else if (racer.ears === 'spike') for (let i = 0; i < 3; i++) head.add(mesh(new THREE.ConeGeometry(0.1, 0.26, 4), dark, 0, 0.5 - i * 0.05, -0.05 - i * 0.2));
  else if (racer.ears === 'drop') { const d = mesh(new THREE.ConeGeometry(0.2, 0.36, 12), skin, 0, 0.56, 0); head.add(d); }
  if (racer.id === 'pengu') { head.add(mesh(new THREE.SphereGeometry(0.3, 12, 10), white, 0, -0.06, 0.2)); head.add(mesh(new THREE.ConeGeometry(0.09, 0.22, 6).rotateX(Math.PI / 2), std(0xffa23e), 0, -0.02, 0.5)); }
  if (racer.id === 'ham' || racer.id === 'bear' || racer.id === 'cat' || racer.id === 'bunny') head.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), std(0xff8fa3), 0, -0.04, 0.45));
  return { group: g, head };
}

export function makeKart(racer, kart) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const paint = std(kart.color, { roughness: 0.3, metalness: 0.25 }), dark = std(0x23262f, { roughness: 0.7 }), chrome = std(0xd9dee8, { metalness: 0.8, roughness: 0.25 });
  // 차체
  const hull = new THREE.SphereGeometry(1, 20, 12); hull.scale(0.82, 0.34, 1.5);
  body.add(mesh(hull, paint, 0, 0.5, 0.1));
  const nose = new THREE.SphereGeometry(1, 16, 10); nose.scale(0.5, 0.26, 0.7);
  body.add(mesh(nose, paint, 0, 0.5, 1.25));
  body.add(mesh(new THREE.BoxGeometry(1.5, 0.14, 0.5), std(0xffffff), 0, 0.42, 1.75)); // 앞날개
  for (const s of [-1, 1]) body.add(mesh(new THREE.BoxGeometry(0.34, 0.3, 1.3), paint, s * 0.86, 0.42, -0.1)); // 옆 통
  body.add(mesh(new THREE.BoxGeometry(0.9, 0.5, 0.24), dark, 0, 0.82, -0.62)); // 등받이
  // 뒷날개
  for (const s of [-1, 1]) body.add(mesh(new THREE.BoxGeometry(0.08, 0.55, 0.3), dark, s * 0.6, 0.98, -1.25));
  body.add(mesh(new THREE.BoxGeometry(1.7, 0.1, 0.48), std(0xffffff), 0, 1.28, -1.28));
  body.add(mesh(new THREE.BoxGeometry(1.7, 0.04, 0.5), paint, 0, 1.34, -1.28));
  // 배기구와 불꽃
  const flames = [];
  for (const s of [-1, 1]) {
    body.add(mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.5, 10).rotateX(Math.PI / 2), chrome, s * 0.36, 0.5, -1.5));
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.3, 10).rotateX(-Math.PI / 2).translate(0, 0, -0.65), new THREE.MeshBasicMaterial({ color: 0x66d9ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    f.position.set(s * 0.36, 0.5, -1.72); f.visible = false; body.add(f); flames.push(f);
  }
  // 핸들
  const wheelRing = mesh(new THREE.TorusGeometry(0.2, 0.045, 6, 14), dark, 0, 0.92, 0.42); wheelRing.rotation.x = -0.9; body.add(wheelRing);
  // 선수
  const driver = makeDriver(racer); driver.group.position.set(0, 0.52, -0.22); body.add(driver.group);
  // 바퀴
  const wheels = [], front = [];
  const tire = new THREE.CylinderGeometry(0.42, 0.42, 0.38, 16).rotateZ(Math.PI / 2), hub = new THREE.CylinderGeometry(0.2, 0.2, 0.4, 10).rotateZ(Math.PI / 2);
  for (const [x, z, isFront] of [[-0.95, 1.05, 1], [0.95, 1.05, 1], [-1.0, -0.95, 0], [1.0, -0.95, 0]]) {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.42, z);
    const spin = new THREE.Group(); pivot.add(spin);
    spin.add(mesh(tire, dark)); spin.add(mesh(hub, std(0xffd23e, { metalness: 0.5 })));
    spin.add(mesh(new THREE.BoxGeometry(0.42, 0.1, 0.1), chrome));
    if (!isFront) spin.scale.setScalar(1.12);
    g.add(pivot); wheels.push(spin); if (isFront) front.push(pivot);
  }
  // 방패 방울
  const shield = new THREE.Mesh(new THREE.SphereGeometry(2.0, 20, 14), new THREE.MeshBasicMaterial({ color: 0x8fe9ff, transparent: true, opacity: 0.32, depthWrite: false }));
  shield.position.y = 0.9; shield.visible = false; g.add(shield);
  // 머리 위 구름 (먹구름에 맞았을 때)
  const cloud = new THREE.Group(); cloud.position.y = 3; cloud.visible = false;
  const cm = new THREE.MeshLambertMaterial({ color: 0x59607a });
  for (const [x, s] of [[0, 0.7], [0.6, 0.5], [-0.6, 0.5]]) { const p = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), cm); p.position.x = x; cloud.add(p); }
  g.add(cloud);
  return { group: g, body, wheels, front, flames, shield, cloud, head: driver.head };
}

export function makeItemBox() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 128, 128); ['#ff6b8b', '#ffd23e', '#6ee08a', '#5fc8ff', '#b48cff'].forEach((col, i) => gr.addColorStop(i / 4, col));
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#fff'; x.lineWidth = 10; x.strokeRect(5, 5, 118, 118);
  x.fillStyle = '#fff'; x.font = '900 92px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.92 }));
  return m;
}
export function makeTrap() {
  const g = new THREE.Group(), geo = new THREE.SphereGeometry(0.9, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffc23e, roughness: 0.15, transparent: true, opacity: 0.9 })));
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), new THREE.MeshStandardMaterial({ color: 0x8a4b1e, roughness: 0.2 })); top.position.y = 0.72; top.scale.y = 0.5; g.add(top);
  return g;
}
export function makeShot(type) {
  const g = new THREE.Group();
  if (type === 'snow') g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 1), new THREE.MeshStandardMaterial({ color: 0xf2fbff, roughness: 0.8 })));
  else if (type === 'bee') {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffd23e })); b.scale.z = 1.4; g.add(b);
    for (const z of [-0.25, 0.2]) { const s = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.09, 6, 14), new THREE.MeshStandardMaterial({ color: 0x23262f })); s.position.z = z; g.add(s); }
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })); w.scale.set(1, 0.15, 0.6); w.position.set(s * 0.5, 0.45, 0); g.add(w); }
  } else {
    const cm = new THREE.MeshLambertMaterial({ color: 0x4b5270 });
    for (const [x, s] of [[0, 1.3], [1.2, 0.95], [-1.2, 0.95]]) { const p = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), cm); p.position.set(x, 4.2, 0); g.add(p); }
    const bolt = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.6, 4), new THREE.MeshBasicMaterial({ color: 0xffe14d })); bolt.position.y = 2.4; bolt.rotation.x = Math.PI; g.add(bolt);
  }
  return g;
}

// ── 반짝이: 한꺼번에 그리는 점들 ──
export class Particles {
  constructor(scene, max = 700) {
    this.max = max; this.n = 0; this.cursor = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.grow = new Float32Array(max); this.grav = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 4)); g.setAttribute('psize', new THREE.BufferAttribute(this.size, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { scale: { value: 600 } },
      vertexShader: 'attribute vec4 pcolor; attribute float psize; varying vec4 vc; uniform float scale; void main(){ vc=pcolor; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=psize*scale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying vec4 vc; void main(){ float d=length(gl_PointCoord-0.5); if(d>0.5) discard; gl_FragColor=vec4(vc.rgb, vc.a*smoothstep(0.5,0.15,d)); }',
    });
    this.points = new THREE.Points(g, mat); this.points.frustumCulled = false; this.mat = mat;
    scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, color, size, life, grow = 0, grav = 0, alpha = 1) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.max;
    this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3);
    const c = Particles.c.set(color); this.col.set([c.r, c.g, c.b, alpha], i * 4);
    this.size[i] = size; this.life[i] = this.maxLife[i] = life; this.grow[i] = grow; this.grav[i] = grav;
  }
  update(dt) {
    const { pos, vel, life, col, size, max } = this;
    for (let i = 0; i < max; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) { col[i * 4 + 3] = 0; size[i] = 0; continue; }
      vel[i * 3 + 1] -= this.grav[i] * dt;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      size[i] += this.grow[i] * dt;
      col[i * 4 + 3] = Math.min(col[i * 4 + 3], life[i] / this.maxLife[i] * 1.4);
    }
    const a = this.points.geometry.attributes; a.position.needsUpdate = a.pcolor.needsUpdate = a.psize.needsUpdate = true;
  }
  clear() { this.life.fill(0); this.size.fill(0); for (let i = 3; i < this.col.length; i += 4) this.col[i] = 0; }
}
Particles.c = new THREE.Color();
