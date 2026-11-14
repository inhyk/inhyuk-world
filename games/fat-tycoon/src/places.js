// 계획 2: 월드가 아닌 곳 두 군데. 우리 집(부엌, 먹방 카메라, 러닝머신)과 점프맵.
// buildWorld 와 같은 모양을 돌려준다 (tables, pads 는 비어 있고 scale, portal 은 없다).
import * as THREE from 'three';
import { mat, part, makeFood } from './foods.js';
import { makeLabel, makeEmoji, makeTrampoline, flat } from './world.js';
import { JUMP_SECTIONS, INGREDIENTS } from '../core.mjs';

const box = (w, h, d, c, x, y, z, o) => part(new THREE.BoxGeometry(w, h, d), mat(c, o), x, y, z);

function plankTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  for (let i = 0; i < 8; i += 1) { x.fillStyle = ['#e0b07a', '#d6a56e', '#e6b984', '#d9aa74'][i % 4]; x.fillRect(0, i * 32, 256, 32); x.fillStyle = 'rgba(90,50,20,.35)'; x.fillRect(0, i * 32, 256, 2); x.fillRect((i * 97) % 256, i * 32, 2, 32); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 3); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export const HOME = { minX: -7.2, maxX: 7.2, minZ: -4.9, maxZ: 5.4, spawn: [0, 3.4], gym: [5.4, 2.6] };

export function buildHome() {
  const root = new THREE.Group(), anim = [], solids = [], interact = [], sprites0 = [];
  const theme = { top: '#bfe3ff', bottom: '#fff4e0', fog: '#fff4e0', fogNear: 80, fogFar: 300, sun: '#fff1d6', sunI: 1.9, hemiSky: '#fff6e8', hemiGround: '#e0b07a', hemiI: 1.5, exposure: 1.0, env: 0.5, indoor: true };
  // 바닥과 벽
  root.add(flat(new THREE.PlaneGeometry(16, 12), new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.7 }), 0));
  root.add(flat(new THREE.PlaneGeometry(60, 60), mat('#8fd16a', { rough: 1 }), -0.05));
  const wall = '#ffe9d2';
  root.add(box(16.4, 4.6, 0.3, wall, 0, 2.3, -6.1), box(0.3, 4.6, 12, wall, -8.1, 2.3, 0), box(0.3, 4.6, 12, wall, 8.1, 2.3, 0), box(16.4, 0.35, 0.34, '#ff9f7a', 0, 0.18, -6.05), box(16.4, 0.3, 0.36, '#ffffff', 0, 4.6, -6.1));
  root.add(box(3.2, 2.0, 0.1, '#9be7ff', 2.2, 2.7, -5.92, { emissive: '#7fd0ff', glow: 0.5, rough: 0.2 }), box(3.4, 0.14, 0.2, '#ffffff', 2.2, 1.65, -5.9), box(0.12, 2.0, 0.14, '#ffffff', 2.2, 2.7, -5.9));
  root.add(flat(new THREE.CircleGeometry(2.6, 40), mat('#ff9ec4', { rough: 1 }), 0.01), flat(new THREE.RingGeometry(2.6, 2.9, 40), mat('#fff3c9', { rough: 1 }), 0.012));
  // 부엌 (요리)
  const k = new THREE.Group();
  k.add(box(5.2, 1.0, 1.1, '#ffffff', -3.6, 0.5, -5.3), box(5.3, 0.1, 1.2, '#8a5a34', -3.6, 1.05, -5.3, { rough: 0.5 }), box(1.3, 2.6, 1.1, '#d6ecff', -7.0, 1.3, -5.3, { rough: 0.3, metal: 0.3 }), box(0.06, 0.7, 0.06, '#9aa3b8', -6.5, 1.6, -4.72, { metal: 0.8 }),
    box(1.2, 0.06, 0.9, '#2b2f4a', -2.2, 1.12, -5.3), part(new THREE.CylinderGeometry(0.4, 0.34, 0.14, 20), mat('#343a40', { metal: 0.6, rough: 0.4 }), -2.2, 1.22, -5.3), box(0.5, 0.05, 0.08, '#343a40', -1.6, 1.24, -5.3),
    box(5.2, 0.9, 0.5, '#ffd9a0', -3.6, 3.3, -5.7), box(1.2, 0.5, 0.5, '#ced4da', -2.2, 2.55, -5.6, { metal: 0.5 }));
  const cols = { tomato: '#e8372d', meat: '#c2604f', onion: '#f3e3c0', choco: '#5a2d12' };
  INGREDIENTS.forEach((ing, i) => {
    const x = -5.6 + i * 0.85; k.add(part(new THREE.CylinderGeometry(0.34, 0.28, 0.22, 14), mat('#d9a25c', { rough: 0.9 }), x, 1.2, -5.25));
    for (let n = 0; n < 4; n += 1) k.add(ing.id === 'choco' ? box(0.2, 0.08, 0.14, cols.choco, x + (n % 2 ? 0.1 : -0.1), 1.34 + (n > 1 ? 0.08 : 0), -5.25 + (n % 2 ? 0.06 : -0.06), { rough: 0.3 })
      : part(new THREE.SphereGeometry(0.12, 10, 8), mat(cols[ing.id], { rough: ing.id === 'meat' ? 0.8 : 0.3, flat: ing.id === 'meat' }), x + (n % 2 ? 0.11 : -0.11), 1.36 + (n > 1 ? 0.14 : 0), -5.25 + (n > 1 ? 0 : (n ? 0.1 : -0.1))));
  });
  const klabel = makeLabel('🍳 부엌\n재료로 요리하기', { width: 3.2, tall: true }); klabel.position.set(-3.6, 4.4, -5.0); k.add(klabel);
  root.add(k); solids.push([-5.6, -5.3, 1.0], [-4.2, -5.3, 1.0], [-2.8, -5.3, 1.0], [-1.6, -5.3, 1.0], [-7.0, -5.3, 1.0]);
  interact.push({ type: 'cook', x: -3.6, z: -3.9, r: 2.3, top: 5 });
  // 먹방 카메라
  const v = new THREE.Group(), vx = 4.6, vz = -3.2;
  for (let i = 0; i < 3; i += 1) { const a = (i / 3) * 6.28, leg = part(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), mat('#343a40', { metal: 0.6 }), Math.sin(a) * 0.3, 0.7, Math.cos(a) * 0.3); leg.rotation.set(Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4); v.add(leg); }
  v.add(box(0.5, 0.34, 0.3, '#20232a', 0, 1.55, 0, { rough: 0.4 }), part(new THREE.CylinderGeometry(0.13, 0.15, 0.24, 14), mat('#343a40', { metal: 0.6, rough: 0.3 }), 0, 1.55, 0.26), part(new THREE.CircleGeometry(0.1, 14), mat('#9be7ff', { emissive: '#3fd0ff', glow: 0.8, rough: 0.1 }), 0, 1.55, 0.385));
  v.children[4].rotation.x = Math.PI / 2;
  const led = part(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3b4e' }), 0.18, 1.76, 0.1); v.add(led);
  const ringLight = part(new THREE.TorusGeometry(0.55, 0.07, 10, 28), mat('#ffffff', { emissive: '#fff3c9', glow: 1.6 }), 0, 2.3, -0.1); v.add(ringLight, part(new THREE.CylinderGeometry(0.03, 0.03, 2.3, 6), mat('#343a40'), 0, 1.15, -0.1));
  v.position.set(vx, 0, vz); v.rotation.y = Math.PI + 0.5; root.add(v);
  const vlabel = makeLabel('🎬 먹방 카메라\n찍고 돈 벌기', { width: 3.2, tall: true }); vlabel.position.set(vx, 3.8, vz); root.add(vlabel);
  solids.push([vx, vz, 0.6]);
  const video = { type: 'video', x: vx - 1.2, z: vz + 1.6, r: 2.3, top: 4.4, led, recording: false }; interact.push(video);
  anim.push((t) => { led.visible = video.recording ? Math.sin(t * 8) > 0 : false; ringLight.material.emissiveIntensity = video.recording ? 2.6 : 1.0; });
  // 러닝머신 (운동)
  const g = new THREE.Group(), [gx, gz] = HOME.gym;
  const belt = box(1.3, 0.16, 2.6, '#2b2f4a', 0, 0.2, 0, { rough: 0.8 });
  g.add(belt, box(1.5, 0.14, 2.8, '#ced4da', 0, 0.1, 0, { metal: 0.5, rough: 0.4 }), box(0.08, 1.3, 0.08, '#ced4da', 0.66, 0.9, -1.2, { metal: 0.6 }), box(0.08, 1.3, 0.08, '#ced4da', -0.66, 0.9, -1.2, { metal: 0.6 }), box(1.4, 0.5, 0.12, '#343a40', 0, 1.6, -1.25), box(1.0, 0.3, 0.02, '#7bff8a', 0, 1.62, -1.18, { emissive: '#7bff8a', glow: 0.8 }));
  const stripes = []; for (let i = 0; i < 5; i += 1) { const s = box(1.2, 0.01, 0.1, '#ffd43b', 0, 0.285, -1.1 + i * 0.52); stripes.push(s); g.add(s); }
  g.position.set(gx, 0, gz); g.rotation.y = Math.PI / 2; root.add(g);
  const glabel = makeLabel('🏃 러닝머신\n운동해서 살 빼기', { width: 3.2, tall: true }); glabel.position.set(gx, 3.6, gz); root.add(glabel);
  const gym = { type: 'gym', x: gx - 0.6, z: gz, r: 2.2, top: 4.2, running: false }; interact.push(gym);
  anim.push((t) => { if (gym.running) stripes.forEach((s, i) => { s.position.z = -1.1 + ((i * 0.52 + t * 3) % 2.6); }); });
  // 침대, TV, 화분, 나가는 문
  root.add(box(2.6, 0.5, 4.2, '#ffffff', -6.3, 0.45, 3.0), box(2.7, 0.3, 4.3, '#8a5a34', -6.3, 0.15, 3.0), box(2.6, 0.2, 2.9, '#6fb8ff', -6.3, 0.78, 3.6, { rough: 0.9 }), box(1.8, 0.3, 0.9, '#fff3c9', -6.3, 0.85, 1.4), box(2.7, 1.3, 0.2, '#8a5a34', -6.3, 0.9, 0.85));
  root.add(box(3.0, 1.7, 0.12, '#20232a', -0.1, 2.7, -5.9, { rough: 0.3 }), box(2.8, 1.5, 0.02, '#3d6fd6', -0.1, 2.7, -5.82, { emissive: '#3d6fd6', glow: 0.7 }), box(3.2, 0.6, 0.8, '#b98a56', -0.1, 0.3, -5.5));
  const tvFood = makeFood('malatang', 0.9); tvFood.position.set(-0.1, 2.3, -5.78); tvFood.scale.z *= 0.05; root.add(tvFood); anim.push((t) => { tvFood.rotation.z = Math.sin(t) * 0.1; });
  root.add(part(new THREE.CylinderGeometry(0.4, 0.3, 0.6, 12), mat('#ff7a59'), 7.1, 0.3, -5.0), part(new THREE.IcosahedronGeometry(0.7, 1), mat('#3fae49', { flat: true }), 7.1, 1.3, -5.0), part(new THREE.IcosahedronGeometry(0.5, 1), mat('#58c043', { flat: true }), 6.9, 1.9, -4.9));
  solids.push([-6.3, 2.0, 1.5], [-6.3, 3.8, 1.5], [7.1, -5.0, 0.7], [-0.1, -5.5, 1.3]);
  const door = new THREE.Group(); door.add(box(0.22, 3.0, 0.3, '#8a5a34', -1.0, 1.5, 0), box(0.22, 3.0, 0.3, '#8a5a34', 1.0, 1.5, 0), box(2.3, 0.26, 0.3, '#8a5a34', 0, 3.1, 0), box(1.8, 0.04, 1.0, '#7bd65a', 0, 0.03, -0.5));
  door.position.set(0, 0, 5.75); root.add(door);
  const dlabel = makeLabel('🚪 밖으로 나가기', { width: 3 }); dlabel.position.set(0, 3.9, 5.75); root.add(dlabel);
  interact.push({ type: 'exit', x: 0, z: 5.0, r: 1.7, top: 4.4 });
  root.traverse((o) => { if (o.isSprite) sprites0.push(o); });
  return { root, theme, night: false, sprites: sprites0, interact, tables: [], pads: [], scale: null, portal: null, solids, platforms: [], flat: true, id: 'home', video, gym, bounds: HOME, spawn: HOME.spawn, update: (t) => anim.forEach((f) => f(t)) };
}

// 점프맵: 가운데 출발 마당에서 시작해 소용돌이 모양으로 올라간다. 구간이 끝날 때마다 깃발이 있다.
export function jumpLayout() {
  const list = [], flags = []; let a = Math.PI, R = 9.5, y = 0;
  JUMP_SECTIONS.forEach((sec, si) => {
    for (let k = 0; k < sec.steps; k += 1) {
      const last = k === sec.steps - 1, size = last ? 4.2 : 2.7 - si * 0.2, spacing = 3.5 + (last ? 0.9 : 0);
      a += spacing / R; R += 0.35; y += sec.rise;
      const p = { x: Math.sin(a) * R, z: Math.cos(a) * R, w: size, d: size, top: Math.round(y * 100) / 100, section: si, flag: last ? si + 1 : 0, ry: a };
      list.push(p); if (last) flags.push(p);
    }
  });
  return { list, flags };
}

export function buildJump() {
  const root = new THREE.Group(), anim = [], interact = [], sprites0 = [], platforms = [];
  const theme = { top: '#3f8fff', bottom: '#e6f7ff', fog: '#d9f0ff', fogNear: 90, fogFar: 320, sun: '#fff4d6', sunI: 2.6, hemiSky: '#d6eeff', hemiGround: '#9fd0ff', hemiI: 1.3, exposure: 1.0, env: 0.5 };
  // 출발 마당
  root.add(part(new THREE.CylinderGeometry(8, 7.2, 1.6, 40), mat('#7edb58', { rough: 0.9 }), 0, -0.8, 0), flat(new THREE.CircleGeometry(5.5, 40), mat('#fff1d0', { rough: 0.9 }), 0.01), flat(new THREE.RingGeometry(5.5, 5.8, 40), mat('#ffffff'), 0.012));
  platforms.push({ kind: 'disc', x: 0, z: 0, r: 8, top: 0 });
  const tr = makeTrampoline('#b197fc', anim); tr.group.position.set(-4.4, 0, 2.6); root.add(tr.group); platforms.push({ kind: 'tramp', x: -4.4, z: 2.6, r: 1.45, top: 0.3, tramp: tr });
  const start = makeLabel('🏔️ 점프맵\n스페이스로 뛰어서 꼭대기까지!', { width: 5, tall: true }); start.position.set(0, 5.2, -3); root.add(start);
  const door = new THREE.Group(); door.add(part(new THREE.TorusGeometry(1.5, 0.2, 10, 32), mat('#ffd43b', { emissive: '#ffb300', glow: 0.8 }), 0, 1.7, 0));
  const dl = makeLabel('🚪 돌아가기', { width: 2.6 }); dl.position.y = 4; door.add(dl); door.position.set(4.6, 0, 3.4); door.rotation.y = -0.9; root.add(door);
  interact.push({ type: 'exit', x: 4.6, z: 3.4, r: 2.0, top: 4.6 });
  // 발판
  const { list, flags } = jumpLayout(), cols = ['#51cf66', '#ffd43b', '#ff922b', '#ff5e7e', '#b197fc'];
  list.forEach((p, i) => {
    const c = cols[p.section], g = new THREE.Group(), h = p.flag ? 0.7 : 0.5;
    g.add(part(new THREE.BoxGeometry(p.w, h, p.d), mat(p.flag ? '#ffffff' : c, { rough: 0.6 }), 0, -h / 2, 0), part(new THREE.BoxGeometry(p.w + 0.12, 0.12, p.d + 0.12), mat(p.flag ? c : '#ffffff', { rough: 0.5 }), 0, -h - 0.02, 0));
    if (p.flag) {
      const pole = part(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8), mat('#ffffff'), -p.w / 2 + 0.4, 1.3, -p.d / 2 + 0.4), cloth = part(new THREE.BoxGeometry(1.0, 0.6, 0.04), mat(c, { emissive: c, glow: 0.4 }), -p.w / 2 + 0.95, 2.25, -p.d / 2 + 0.4);
      g.add(pole, cloth); anim.push((t) => { cloth.rotation.y = Math.sin(t * 3 + i) * 0.25; });
      const next = JUMP_SECTIONS[p.flag];
      const lb = makeLabel(next ? `🚩 ${p.flag}구간 끝!\n다음 구간 점프력 ${next.need.toFixed(1)}` : '🏆 꼭대기!\n점프맵을 다 올랐어요', { width: 4, tall: true }); lb.position.y = 4.2; g.add(lb);
      if (!next) { const tro = makeEmoji('🏆', 2.2); tro.position.y = 2.2; g.add(tro); anim.push((t) => { tro.position.y = 2.2 + Math.sin(t * 2) * 0.2; }); }
    }
    g.position.set(p.x, p.top, p.z); g.rotation.y = p.ry; root.add(g);
    platforms.push({ kind: 'box', x: p.x, z: p.z, w: p.w, d: p.d, top: p.top, ry: p.ry, flag: p.flag, section: p.section });
  });
  const need1 = makeLabel(`첫 구간 점프력 ${JUMP_SECTIONS[0].need.toFixed(1)}\n트램폴린에서 점프력을 키워요`, { width: 4.4, tall: true }); need1.position.set(list[0].x * 0.72, 3.4, list[0].z * 0.72); root.add(need1);
  // 구름과 바다
  const sea = flat(new THREE.CircleGeometry(500, 40), new THREE.MeshStandardMaterial({ color: '#35b6f0', roughness: 0.15, metalness: 0.2 }), -14); sea.receiveShadow = false; root.add(sea);
  const clouds = new THREE.Group();
  for (let i = 0; i < 40; i += 1) { const a = i * 2.4, d = 26 + (i * 37) % 70, c = new THREE.Mesh(new THREE.SphereGeometry(3 + (i % 5), 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false })); c.position.set(Math.sin(a) * d, -6 + (i * 13) % 100, Math.cos(a) * d); c.scale.y = 0.5; clouds.add(c); }
  root.add(clouds); anim.push((t) => { clouds.rotation.y = t * 0.01; });
  root.traverse((o) => { if (o.isSprite) sprites0.push(o); });
  return { root, theme, night: false, sprites: sprites0, interact, tables: [], pads: [], scale: null, portal: null, solids: [], platforms, flags, flat: false, id: 'jump', spawn: [0, 3], update: (t) => anim.forEach((f) => f(t)) };
}
