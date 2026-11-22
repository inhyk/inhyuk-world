// 잡기 화면과 도장 싸움이 같이 쓰는 무대 (땅, 하늘, 나무, 반짝이)
import * as THREE from 'three';
import { rng } from '../core.mjs';

const SKY = { day: ['#3d9eff', '#d4f0ff', '#fff3d4', 3.0, '#e6f4ff', '#c2cf96', 1.25], dusk: ['#5566cc', '#ffc59a', '#ffac6a', 2.3, '#ffd9c4', '#b9a58c', 1.0], night: ['#070b26', '#27367a', '#a9c0ff', 1.3, '#8a9cff', '#3a4470', 0.95] };
const GROUND = { park: ['#8fd66b', '#6fbf5a'], forest: ['#6fbf5a', '#4fa648'], house: ['#9bdc7a', '#7cc963'], shop: ['#dcd4c6', '#c9bfae'], lake: ['#ecdba6', '#d8c58c'], plaza: ['#ead9bd', '#d9c6a4'] };
const ico = new THREE.IcosahedronGeometry(1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 8).translate(0, 0.5, 0), cone = new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0), rock = new THREE.DodecahedronGeometry(1, 0);

export function makeSky() {
  return new THREE.Mesh(new THREE.SphereGeometry(700, 24, 14), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() } }, vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }', fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y*1.6+0.05,0.0,1.0); gl_FragColor = vec4(mix(hor, top, pow(h,0.7)),1.0);\n#include <colorspace_fragment>\n }' }));
}

export function buildStage(biome, mood, seed = 1, arena = null) {
  const scene = new THREE.Scene(), k = SKY[mood] || SKY.day, gc = GROUND[biome] || GROUND.park, r = rng(seed + 11);
  const sky = makeSky(); sky.material.uniforms.top.value.set(k[0]); sky.material.uniforms.hor.value.set(k[1]); scene.add(sky); scene.fog = new THREE.Fog(k[1], 30, 95);
  scene.add(new THREE.HemisphereLight(k[4], k[5], k[6]));
  const sun = new THREE.DirectionalLight(k[2], k[3]); sun.position.set(8, 16, 9); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const c = sun.shadow.camera; c.left = c.bottom = -14; c.right = c.top = 14; c.near = 1; c.far = 60; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04; scene.add(sun);
  const flat = (col, o = {}) => new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, flatShading: true, ...o });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(120, 48).rotateX(-Math.PI / 2), flat(gc[0])); ground.receiveShadow = true; scene.add(ground);
  const patch = new THREE.Mesh(new THREE.CircleGeometry(4.2, 40).rotateX(-Math.PI / 2), flat(arena || gc[1], arena ? { emissive: arena, emissiveIntensity: 0.25 } : {})); patch.position.y = 0.01; patch.receiveShadow = true; scene.add(patch);
  const add = (geo, mat, x, y, z, sx, sy, sz, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.y = ry; m.castShadow = true; scene.add(m); return m; };
  // 풀과 꽃 (한 번에 그리기)
  const grassy = biome !== 'shop' && biome !== 'plaza';
  const n = grassy ? 420 : 60, tuft = new THREE.InstancedMesh(cone, flat(grassy ? gc[1] : '#8fd66b'), n), mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < n; i++) { const a = r() * 6.28, d = 1.5 + r() * 26; e.set((r() - 0.5) * 0.4, r() * 3, (r() - 0.5) * 0.4); q.setFromEuler(e); const s = 0.04 + r() * 0.04, near = Math.sin(a) * d > -4 && Math.abs(Math.cos(a) * d) < 6 ? 0 : 1; mm.compose(new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d), q, new THREE.Vector3(s, (0.14 + r() * 0.2) * near, s)); tuft.setMatrixAt(i, mm); }
  scene.add(tuft);
  const fl = new THREE.InstancedMesh(ico, flat('#ffffff'), 90); const fc = new THREE.Color(), FC = ['#ff7aa8', '#ffd84a', '#ffffff', '#b98aff', '#ff9a4a'];
  for (let i = 0; i < 90; i++) { const a = r() * 6.28, d = 2 + r() * 22; mm.compose(new THREE.Vector3(Math.cos(a) * d, 0.22, Math.sin(a) * d - 3), q, new THREE.Vector3(0.07, 0.07, 0.07)); fl.setMatrixAt(i, mm); fl.setColorAt(i, fc.set(FC[i % 5])); }
  if (grassy) scene.add(fl);
  // 둘레 풍경
  const trunk = flat('#8a6240');
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * 6.28 + r() * 0.2, d = 15 + r() * 22, x = Math.cos(a) * d, z = Math.sin(a) * d, s = 1 + r() * 0.9;
    if (z > 2 && Math.abs(x) < 9) continue;
    if (biome === 'forest' || (biome !== 'park' && r() < 0.35)) { add(cyl, trunk, x, 0, z, 0.25 * s, 1.2 * s, 0.25 * s); const g = flat(i % 2 ? '#2f8f5a' : '#38a065'); for (let t = 0; t < 3; t++) add(cone, g, x, (0.9 + t * 1.0) * s, z, (1.5 - t * 0.38) * s, 1.7 * s, (1.5 - t * 0.38) * s, r() * 3); }
    else if (biome === 'shop' || biome === 'plaza') { { add(cyl, trunk, x, 0, z, 0.25 * s, 1.5 * s, 0.25 * s); add(ico, flat(i % 2 ? '#ffb3d0' : '#4fb85f'), x, 2.5 * s, z, 1.6 * s, 1.4 * s, 1.6 * s, r() * 3); } }
    else { add(cyl, trunk, x, 0, z, 0.25 * s, 1.5 * s, 0.25 * s); const g = flat(['#4fb85f', '#6fd070', '#ffb3d0', '#f0a03c'][biome === 'house' ? (i % 3) : (i % 7 === 0 ? 3 : i % 2)]); add(ico, g, x, 2.5 * s, z, 1.6 * s, 1.4 * s, 1.6 * s, r() * 3); add(ico, g, x + 0.8 * s, 3.1 * s, z, 1.0 * s, 1.0 * s, 1.0 * s, r() * 3); }
  }
  for (let i = 0; i < 12; i++) { const a = r() * 6.28, d = 6 + r() * 16, s = 0.3 + r() * 0.6; add(rock, flat('#a3a3a8'), Math.cos(a) * d, s * 0.3, Math.sin(a) * d, s, s * 0.7, s, r() * 3); }
  if (biome === 'lake') { const w = new THREE.Mesh(new THREE.CircleGeometry(30, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#49b8f0', roughness: 0.1, metalness: 0.15 })); w.position.set(0, 0.03, -44); scene.add(w); }
  // 먼 언덕
  for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.28 + 0.3, d = 70 + r() * 15; const m = new THREE.Mesh(ico, flat(grassy ? '#7cc963' : '#b9c7a0')); m.position.set(Math.cos(a) * d, -4, Math.sin(a) * d); m.scale.set(22 + r() * 14, 12 + r() * 8, 22); scene.add(m); }
  if (mood === 'night') { const sp = new Float32Array(600); for (let i = 0; i < 200; i++) { const a = r() * 6.28, y = 0.1 + r() * 0.9, rr = Math.sqrt(1 - y * y); sp.set([Math.cos(a) * rr * 500, y * 500, Math.sin(a) * rr * 500], i * 3); } scene.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(sp, 3)), new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, fog: false }))); }
  return { scene, sun, patch };
}

// 튀는 반짝이 조각
const starGeo = (() => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, rr = i % 2 ? 0.45 : 1; i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } return new THREE.ShapeGeometry(s); })();
const dotGeo = new THREE.SphereGeometry(1, 8, 6), heartGeo = (() => { const s = new THREE.Shape(); s.moveTo(0, -0.9); s.bezierCurveTo(-1.6, 0.1, -0.9, 1.3, 0, 0.5); s.bezierCurveTo(0.9, 1.3, 1.6, 0.1, 0, -0.9); return new THREE.ShapeGeometry(s); })();
export class Sparks {
  constructor(scene, n = 90) { this.scene = scene; this.list = []; for (let i = 0; i < n; i++) { const m = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide })); m.visible = false; m.userData = { life: 0 }; scene.add(m); this.list.push(m); } this.k = 0; }
  one(pos, color, o = {}) {
    const m = this.list[this.k++ % this.list.length], u = m.userData; m.geometry = o.shape === 'star' ? starGeo : o.shape === 'heart' ? heartGeo : dotGeo; m.material.color.set(color); m.material.opacity = 1; m.visible = true; m.position.copy(pos);
    const sp = o.speed ?? 4, a = Math.random() * 6.28, up = o.up ?? 1; u.v = new THREE.Vector3(Math.cos(a) * sp * (0.4 + Math.random()), (Math.random() * 0.8 + 0.4) * sp * up, Math.sin(a) * sp * (0.4 + Math.random()) * (o.flat ? 0.15 : 1)); u.g = o.gravity ?? 9; u.life = u.max = (o.life ?? 0.9) * (0.7 + Math.random() * 0.6); u.size = (o.size ?? 0.12) * (0.6 + Math.random() * 0.8); u.spin = (Math.random() - 0.5) * 8; m.scale.setScalar(u.size);
  }
  burst(pos, color, n = 14, o = {}) { const cols = Array.isArray(color) ? color : [color]; for (let i = 0; i < n; i++) this.one(pos, cols[i % cols.length], o); }
  update(dt, camera) { for (const m of this.list) { const u = m.userData; if (u.life <= 0) continue; u.life -= dt; if (u.life <= 0) { m.visible = false; continue; } u.v.y -= u.g * dt; m.position.addScaledVector(u.v, dt); const k = u.life / u.max; m.material.opacity = Math.min(1, k * 2); m.scale.setScalar(u.size * (0.5 + k * 0.5)); if (camera && m.geometry !== dotGeo) { m.quaternion.copy(camera.quaternion); m.rotateZ(u.spin * u.life); } } }
}
