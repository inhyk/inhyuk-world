// 월드 두 개의 땅, 꾸밈, 음식 테이블, 업그레이드 발판, 저울, 문을 만든다.
import * as THREE from 'three';
import { mat, part, makeFood } from './foods.js';
import { makeJudge } from './character.js';
import { STAGES, UPGRADES } from '../core.mjs';

export const LIMIT = 24;
const polar = (deg, r) => [Math.sin((deg * Math.PI) / 180) * r, Math.cos((deg * Math.PI) / 180) * r];
export const LAYOUT = {
  spawn: [0, 7.5],
  scale: [0, -3],
  judge: [3.1, -4.2],
  portal: [0, -22.3],
  tables: Array.from({ length: 10 }, (_, i) => polar(162 - i * 36, 19)),
  pads: UPGRADES.map((_, i) => polar(30 + i * 60, 10.5)),
  tramps: [[-5.6, 1.6], [5.6, 1.6]],
  home: [0, 23.2],
};

export const THEMES = {
  1: { top: '#2f8fff', bottom: '#d6f3ff', fog: '#cdeeff', fogNear: 55, fogFar: 190, sun: '#fff4d6', sunI: 2.6, hemiSky: '#cfeaff', hemiGround: '#8fd16a', hemiI: 1.25, exposure: 1.0, env: 0.45,
    grass: '#7edb58', dirt: '#b98a56', plazaA: '#fff1d0', plazaB: '#ffd9a0', path: '#f0d9a2', sea: '#35b6f0', wood: '#c98a4b', kind: 'day' },
  2: { top: '#0b0a2a', bottom: '#5a2a7a', fog: '#3a2466', fogNear: 45, fogFar: 170, sun: '#d6dcff', sunI: 2.0, hemiSky: '#b9a8ff', hemiGround: '#5a4a9a', hemiI: 1.7, exposure: 1.25, env: 0.5,
    grass: '#3f7a6a', dirt: '#2a2350', plazaA: '#4a3f8a', plazaB: '#6a55b8', path: '#c98ad6', sea: '#1d2a6e', wood: '#b0643f', night: true, kind: 'night' },
  3: { top: '#4a9cff', bottom: '#eef8ff', fog: '#e6f3ff', fogNear: 55, fogFar: 190, sun: '#ffffff', sunI: 2.3, hemiSky: '#eaf5ff', hemiGround: '#b8d8f0', hemiI: 1.25, exposure: 0.95, env: 0.5,
    grass: '#f2f9ff', dirt: '#9fc4e0', plazaA: '#dff2ff', plazaB: '#a8d8f5', path: '#c2e4fa', sea: '#2a7fc0', wood: '#6fa8d6', kind: 'ice',
    trunk: '#7a5a44', leaves: ['#eaf7ff', '#bfe6ff', '#ffffff'], flowers: ['#ffffff', '#bfe6ff', '#9fd8ff'], hills: ['#ffffff', '#e3f1ff', '#cfe6fa'], beach: '#e9f6ff' },
  4: { top: '#020208', bottom: '#131c40', fog: '#0b1026', fogNear: 60, fogFar: 230, sun: '#ffffff', sunI: 2.4, hemiSky: '#a8bcff', hemiGround: '#5a6078', hemiI: 1.6, exposure: 1.2, env: 0.6,
    grass: '#8a8f9c', dirt: '#4a4e5c', plazaA: '#2a3350', plazaB: '#3a4870', path: '#5f6a8a', sea: '#04050c', wood: '#8a93a8', night: true, kind: 'space',
    trunk: '#9aa3b8', leaves: ['#7dffea', '#9d8bff', '#ff8fd0'], flowers: ['#7dffea', '#ffe066', '#ff8fd0'], beach: '#6a7080' },
  5: { top: '#ff8fc4', bottom: '#fff1c9', fog: '#ffe6d6', fogNear: 55, fogFar: 200, sun: '#fff0c2', sunI: 2.6, hemiSky: '#ffe9f3', hemiGround: '#ffd98a', hemiI: 1.3, exposure: 1.0, env: 0.6,
    grass: '#fff8ee', dirt: '#ffd6e8', plazaA: '#ffe9a8', plazaB: '#ffd24d', path: '#ffdcee', sea: '#ffe6f2', wood: '#e6b422', kind: 'gold',
    trunk: '#e6b422', leaves: ['#ff9ad5', '#ffc2e2', '#ffd43b'], flowers: ['#ffd43b', '#ff9ad5', '#ffffff', '#9be7ff'], beach: '#fff6fb' },
};

const labels = new Set();
let sprites = [];
export function redrawLabels() { labels.forEach((l) => l.userData.draw(true)); }
export function makeLabel(text, o = {}) {
  const c = document.createElement('canvas'); c.width = 512; c.height = o.tall ? 192 : 112;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  const w = o.width ?? 3.4; sp.scale.set(w, (w * c.height) / c.width, 1); sp.renderOrder = 5;
  let shown = null, style = o;
  sp.userData.draw = (force) => {
    const key = `${sp.userData.text}|${style.bg}|${style.color}`;
    if (!force && key === shown) return; shown = key;
    const x = c.getContext('2d'), lines = String(sp.userData.text).split('\n');
    x.clearRect(0, 0, c.width, c.height);
    if (style.bg !== 'none') {
      x.fillStyle = style.bg ?? 'rgba(255,255,255,.94)'; x.strokeStyle = style.line ?? 'rgba(40,30,60,.85)'; x.lineWidth = 7;
      x.beginPath(); x.roundRect(6, 6, c.width - 12, c.height - 12, 34); x.fill(); x.stroke();
    }
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = style.color ?? '#2a2140';
    lines.forEach((ln, i) => {
      let size = lines.length > 1 ? (i ? 44 : 50) : 58;
      x.font = `${size}px Jua, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
      while (x.measureText(ln).width > c.width - 50 && size > 20) { size -= 3; x.font = x.font.replace(/^\d+px/, `${size}px`); }
      const y = (c.height * (i + 0.5)) / lines.length + (lines.length > 1 ? (i ? -6 : 6) : 3);
      if (ln.includes('🪙')) { // 코인은 직접 그린다 (글꼴마다 모양이 달라서)
        const txt = ln.replace('🪙', '').trim(), w = x.measureText(txt).width, r = size * 0.42, left = c.width / 2 - (w + r * 2 + 12) / 2;
        x.save(); x.fillStyle = '#ffc21a'; x.strokeStyle = '#2a2140'; x.lineWidth = 4; x.beginPath(); x.arc(left + r, y - 2, r, 0, 6.3); x.fill(); x.stroke(); x.fillStyle = '#fff3a8'; x.beginPath(); x.arc(left + r * 0.75, y - 2 - r * 0.25, r * 0.35, 0, 6.3); x.fill(); x.restore();
        x.textAlign = 'left'; x.fillText(txt, left + r * 2 + 12, y); x.textAlign = 'center';
      } else x.fillText(ln, c.width / 2, y);
    });
    tex.needsUpdate = true;
  };
  sp.userData.set = (t, s) => { sp.userData.text = t; if (s) style = { ...style, ...s }; sp.userData.draw(); };
  sp.userData.set(text); labels.add(sp); sprites.push(sp);
  return sp;
}
export function makeEmoji(e, size = 1.4) {
  const c = document.createElement('canvas'); c.width = c.height = 160;
  const x = c.getContext('2d'); x.font = '120px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(e, 80, 90);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); sp.scale.set(size, size, 1); sp.renderOrder = 5; sprites.push(sp);
  return sp;
}

export function tileTexture(a, b, glow) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  for (let i = 0; i < 4; i += 1) for (let j = 0; j < 4; j += 1) { x.fillStyle = (i + j) % 2 ? a : b; x.fillRect(i * 64, j * 64, 64, 64); }
  x.strokeStyle = glow || 'rgba(120,80,40,.25)'; x.lineWidth = glow ? 4 : 3;
  for (let i = 0; i <= 4; i += 1) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 256); x.moveTo(0, i * 64); x.lineTo(256, i * 64); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(7, 7); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
export const flat = (g, m, y) => { const o = new THREE.Mesh(g, m); o.rotation.x = -Math.PI / 2; o.position.y = y; o.receiveShadow = true; return o; };
const seeded = (seed) => { let t = seed; return () => { t = (t * 16807) % 2147483647; return t / 2147483647; }; };

function tree(th, r) {
  const night = !!th.night;
  const g = new THREE.Group(), h = 1.6 + r() * 1.2;
  g.add(part(new THREE.CylinderGeometry(0.22, 0.32, h, 8), mat(th.trunk ?? (night ? '#4a3a6e' : '#8a5a34'), { rough: 0.9, metal: th.kind === 'gold' || th.kind === 'space' ? 0.7 : 0 }), 0, h / 2, 0));
  const cols = th.leaves ?? (night ? ['#ff8fd0', '#ffb3e6', '#c79bff'] : ['#3fae49', '#58c043', '#2f9e44']);
  [[0, h + 0.7, 0, 1.5], [0.8, h + 0.3, 0.2, 1.0], [-0.7, h + 0.4, -0.3, 1.1], [0.1, h + 1.6, -0.1, 1.0]].forEach(([x, y, z, s], i) => {
    g.add(part(new THREE.IcosahedronGeometry(s, 1), mat(cols[i % 3], { rough: 0.9, flat: true, ...(night ? { emissive: cols[i % 3], glow: 0.25 } : {}) }), x, y, z));
  });
  g.scale.setScalar(0.9 + r() * 0.6);
  return g;
}
function house(r, i) {
  const g = new THREE.Group(), w = 4 + r() * 1.5, h = 2.8 + r() * 1.4, cols = ['#ffe3b0', '#ffd0d8', '#cfe8ff', '#e3f7c4', '#fff0a8'], roofs = ['#e8553d', '#3b7ddd', '#f29f3a', '#8a5bd6', '#2fa37a'];
  g.add(part(new THREE.BoxGeometry(w, h, 3.6), mat(cols[i % 5], { rough: 0.85 }), 0, h / 2, 0));
  const roof = part(new THREE.ConeGeometry(w * 0.82, 1.9, 4), mat(roofs[i % 5], { rough: 0.7, flat: true }), 0, h + 0.95, 0); roof.rotation.y = Math.PI / 4; roof.scale.z = 0.8; g.add(roof);
  g.add(part(new THREE.BoxGeometry(0.9, 1.6, 0.1), mat('#8a5a34'), 0, 0.8, 1.82), part(new THREE.BoxGeometry(0.5, 1.2, 0.5), mat('#b5651d'), w * 0.25, h + 1.3, 0));
  for (const s of [1, -1]) g.add(part(new THREE.BoxGeometry(0.9, 0.9, 0.1), mat('#aee4ff', { rough: 0.2, emissive: '#5ab8ff', glow: 0.25 }), s * w * 0.3, h * 0.62, 1.82));
  return g;
}
function stall(r, i) {
  const g = new THREE.Group(), cols = ['#ff5e7e', '#ffd43b', '#3fd0ff', '#7bff8a', '#ff9f43', '#c79bff'], c = cols[i % 6];
  g.add(part(new THREE.BoxGeometry(4, 1.1, 2), mat('#3a2f70', { rough: 0.8 }), 0, 0.55, 0));
  for (const s of [1, -1]) g.add(part(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 8), mat('#d9d9ff'), 1.9 * s, 1.6, 0.9), part(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 8), mat('#d9d9ff'), 1.9 * s, 1.6, -0.9));
  for (let k = 0; k < 8; k += 1) { const s = part(new THREE.BoxGeometry(0.55, 0.12, 2.8), mat(k % 2 ? '#ffffff' : c, { rough: 0.7, emissive: k % 2 ? '#ffffff' : c, glow: 0.3 }), -1.93 + k * 0.55, 3.25, 0.2); s.rotation.x = 0.22; g.add(s); }
  for (let k = 0; k < 7; k += 1) g.add(part(new THREE.SphereGeometry(0.12, 8, 6), mat(cols[(i + k) % 6], { emissive: cols[(i + k) % 6], glow: 1.6 }), -1.8 + k * 0.6, 2.85, 1.55));
  g.add(part(new THREE.BoxGeometry(2.2, 0.7, 0.12), mat(c, { emissive: c, glow: 0.9 }), 0, 4.1, 0.6));
  return g;
}

function igloo(r, i) {
  const g = new THREE.Group(), s = 2.2 + r() * 0.8;
  g.add(part(new THREE.SphereGeometry(s, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(i % 2 ? '#ffffff' : '#e3f3ff', { rough: 0.6, flat: true }), 0, 0, 0), part(new THREE.CylinderGeometry(0.9, 0.9, 1.4, 12, 1, false, 0, Math.PI), mat('#cfe8fa', { rough: 0.6 }), 0, 0.2, s * 0.9), part(new THREE.CircleGeometry(0.62, 12), mat('#27415a'), 0, 0.55, s * 0.9 + 0.71));
  g.children[1].rotation.set(0, 0, Math.PI / 2); g.children[1].rotation.order = 'YXZ'; g.children[1].rotation.set(Math.PI / 2, 0, Math.PI / 2);
  for (let k = 0; k < 3; k += 1) g.add(part(new THREE.ConeGeometry(0.5 + k * 0.1, 1.6 + k * 0.5, 5), mat('#bfe9ff', { rough: 0.15, emissive: '#7fd0ff', glow: 0.25, flat: true }), -s - 0.6 + k * 0.5, 0.8 + k * 0.25, -0.5 + k * 0.6));
  return g;
}
function rocket(r, i) {
  const g = new THREE.Group(), c = ['#ff5e7e', '#3fd0ff', '#ffd43b', '#7bff8a'][i % 4], h = 5 + r() * 2;
  g.add(part(new THREE.CylinderGeometry(1.1, 1.3, h, 16), mat('#e9edf5', { metal: 0.6, rough: 0.3 }), 0, h / 2 + 0.8, 0), part(new THREE.ConeGeometry(1.1, 2, 16), mat(c, { rough: 0.4 }), 0, h + 1.8, 0),
    part(new THREE.SphereGeometry(0.5, 14, 10), mat('#9be7ff', { emissive: '#3fd0ff', glow: 0.9, rough: 0.1 }), 0, h * 0.7, 1.0), part(new THREE.CylinderGeometry(0.7, 1.0, 0.8, 12), mat('#5b6275', { metal: 0.7 }), 0, 0.4, 0));
  for (let k = 0; k < 3; k += 1) { const a = (k / 3) * 6.28 + 0.5, f = part(new THREE.BoxGeometry(0.15, 2.2, 1.3), mat(c, { rough: 0.4 }), Math.sin(a) * 1.5, 1.4, Math.cos(a) * 1.5); f.rotation.y = a + Math.PI / 2; g.add(f); }
  g.add(part(new THREE.SphereGeometry(2.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#9be7ff', transparent: true, opacity: 0.28, roughness: 0.1 }), 4.2, 0, 0.5));
  return g;
}
function palace(r, i) {
  const g = new THREE.Group(), gold = mat('#ffcf33', { metal: 0.9, rough: 0.25 }), h = 5 + r() * 3, wall = ['#fff6fb', '#ffe9f3', '#fffbe6'][i % 3];
  g.add(part(new THREE.CylinderGeometry(1.5, 1.7, h, 16), mat(wall, { rough: 0.7 }), 0, h / 2, 0), part(new THREE.ConeGeometry(1.9, 2.6, 16), gold, 0, h + 1.3, 0), part(new THREE.SphereGeometry(0.3, 10, 8), mat('#ffe066', { emissive: '#ffd43b', glow: 1 }), 0, h + 2.8, 0), part(new THREE.TorusGeometry(1.6, 0.14, 8, 24), gold, 0, h * 0.55, 0), part(new THREE.BoxGeometry(0.9, 1.7, 0.1), mat('#b8860b'), 0, 0.85, 1.62));
  g.children[3].rotation.x = Math.PI / 2;
  for (const s of [1, -1]) g.add(part(new THREE.CylinderGeometry(0.7, 0.8, h * 0.6, 12), mat(wall, { rough: 0.7 }), 2.3 * s, h * 0.3, 0), part(new THREE.ConeGeometry(0.95, 1.4, 12), mat('#ff9ad5', { rough: 0.5 }), 2.3 * s, h * 0.6 + 0.7, 0));
  for (let k = 0; k < 5; k += 1) g.add(part(new THREE.SphereGeometry(1.1 + r() * 0.6, 10, 8), mat('#ffffff', { rough: 1 }), -3 + k * 1.5, 0.2, 1.2 + r(), [1, 0.55, 1]));
  return g;
}

export function makeTrampoline(color, anim) {
  const g = new THREE.Group(), bed = part(new THREE.CylinderGeometry(1.45, 1.45, 0.06, 32), mat('#2b2f4a', { rough: 0.6 }), 0, 0.27, 0), state = { t: 0 };
  const frame = part(new THREE.TorusGeometry(1.6, 0.14, 10, 36), mat(color, { rough: 0.4 }), 0, 0.3, 0); frame.rotation.x = Math.PI / 2;
  const star = part(new THREE.CylinderGeometry(0.5, 0.5, 0.065, 5), mat('#ffd43b', { emissive: '#ffb300', glow: 0.4 }), 0, 0.275, 0);
  g.add(bed, frame, star);
  for (let i = 0; i < 6; i += 1) { const a = (i / 6) * 6.28; g.add(part(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 8), mat('#ced4da', { metal: 0.6, rough: 0.3 }), Math.sin(a) * 1.6, 0.15, Math.cos(a) * 1.6)); }
  const label = makeLabel('트램폴린\n점프력 +0.02', { width: 2.8, tall: true }); label.position.y = 3.0; g.add(label);
  anim.push((t) => { const k = Math.max(0, state.t - t); bed.position.y = star.position.y = 0.27 - Math.sin(k * 12) * k * 0.5; star.rotation.y = t; });
  return { group: g, bounce: (t) => { state.t = t + 0.5; } };
}
export function homeHouse() {
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(5.2, 3.4, 4), mat('#fff3d6', { rough: 0.85 }), 0, 1.7, 0));
  const roof = part(new THREE.ConeGeometry(4.3, 2.2, 4), mat('#ff7a59', { rough: 0.7, flat: true }), 0, 4.5, 0); roof.rotation.y = Math.PI / 4; roof.scale.z = 0.82; g.add(roof);
  g.add(part(new THREE.BoxGeometry(1.3, 2.2, 0.14), mat('#8a5a34', { rough: 0.6 }), 0, 1.1, 2.02), part(new THREE.SphereGeometry(0.08, 8, 6), mat('#ffd43b', { metal: 0.8, rough: 0.3 }), 0.42, 1.1, 2.12), part(new THREE.BoxGeometry(1.7, 0.16, 0.9), mat('#ced4da'), 0, 0.08, 2.4),
    part(new THREE.BoxGeometry(0.5, 1.3, 0.5), mat('#b5651d'), 1.4, 5.0, 0), part(new THREE.SphereGeometry(0.22, 10, 8), mat('#ff5e7e', { emissive: '#ff5e7e', glow: 0.6 }), 0, 2.75, 2.06));
  for (const s of [1, -1]) g.add(part(new THREE.BoxGeometry(1.0, 1.0, 0.1), mat('#aee4ff', { rough: 0.2, emissive: '#5ab8ff', glow: 0.3 }), 1.7 * s, 2.0, 2.02), part(new THREE.BoxGeometry(1.2, 0.2, 0.3), mat('#ff8fb3'), 1.7 * s, 1.35, 2.12));
  return g;
}

function foodTable(theme, stage, night) {
  const g = new THREE.Group(), stripe = ['#ff5e5e', '#ff9f43', '#ffd43b', '#51cf66', '#3fa7ff', '#9b5cff', '#ff6fb5', '#21c7b8', '#ff8a3d', '#e63946'][stage.level - 1];
  g.add(part(new THREE.BoxGeometry(3.2, 1.0, 1.5), mat(theme.wood, { rough: 0.8 }), 0, 0.5, 0), part(new THREE.BoxGeometry(3.4, 0.12, 1.7), mat('#fff8ea', { rough: 0.5 }), 0, 1.06, 0),
    part(new THREE.BoxGeometry(3.22, 0.3, 1.52), mat(stripe, { rough: 0.7 }), 0, 0.82, 0));
  for (const s of [1, -1]) g.add(part(new THREE.CylinderGeometry(0.07, 0.07, 3.3, 8), mat('#ffffff'), 1.6 * s, 1.65, -0.65));
  for (let k = 0; k < 8; k += 1) { const s = part(new THREE.BoxGeometry(0.45, 0.1, 2.3), mat(k % 2 ? '#ffffff' : stripe, { rough: 0.75, ...(night ? { emissive: k % 2 ? '#ffffff' : stripe, glow: 0.25 } : {}) }), -1.575 + k * 0.45, 3.35, 0.1); s.rotation.x = 0.28; g.add(s); }
  for (let k = 0; k < 8; k += 1) g.add(part(new THREE.SphereGeometry(0.225, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(k % 2 ? '#ffffff' : stripe), -1.575 + k * 0.45, 3.02, 1.2));
  const big = stage.level === 10;
  const food = makeFood(stage.id, big ? 2.6 : stage.level >= 8 ? 2.0 : 1.5); food.position.set(0, 1.12, 0.05); g.add(food);
  const label = makeLabel('', { width: 3.6, tall: true }); label.position.set(0, big ? 5.6 : 4.5, 0); g.add(label);
  const lock = makeEmoji('🔒', 1.3); lock.position.set(0, 2.2, 0.9); g.add(lock);
  return { group: g, food, label, lock };
}

export function buildWorld(worldId) {
  const th = THEMES[worldId], night = !!th.night, kind = th.kind, root = new THREE.Group(), r = seeded(worldId * 977 + 13), anim = [], solids = [], interact = [];
  sprites = [];
  // 땅
  const island = part(new THREE.CylinderGeometry(31, 29.5, 3, 64), mat(th.dirt, { rough: 0.95 }), 0, -1.52, 0); island.castShadow = false; root.add(island);
  root.add(flat(new THREE.CircleGeometry(31, 64), mat(th.grass, { rough: 0.95 }), -0.01));
  root.add(flat(new THREE.RingGeometry(16.2, 22.2, 64), mat(th.path, { rough: 0.9 }), 0.0));
  const plaza = flat(new THREE.CircleGeometry(13.6, 64), new THREE.MeshStandardMaterial({ map: tileTexture(th.plazaA, th.plazaB, night ? 'rgba(140,200,255,.55)' : null), roughness: 0.8 }), 0.01); root.add(plaza);
  const rim = flat(new THREE.RingGeometry(13.6, 14.1, 64), mat(night ? '#8fd0ff' : '#ffffff', night ? { emissive: '#6fb8ff', glow: 0.8 } : {}), 0.015); root.add(rim);
  const sea = flat(new THREE.CircleGeometry(400, 48), new THREE.MeshStandardMaterial({ color: th.sea, roughness: 0.15, metalness: 0.2 }), -1.6); sea.receiveShadow = false; root.add(sea);
  root.add(flat(new THREE.RingGeometry(30.5, 35, 64), mat(th.beach ?? (night ? '#4a3d8a' : '#ffe9b8'), { rough: 1 }), -1.3));
  // 꽃이나 빛나는 버섯
  const N = 260, dummy = new THREE.Object3D(), fcol = th.flowers ?? (night ? ['#7dffea', '#ff8fd0', '#ffe066'] : ['#ff6b8b', '#ffffff', '#ffd43b', '#b197fc']);
  fcol.forEach((c, k) => {
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 6, 5), mat(c, night ? { emissive: c, glow: 1.2 } : { rough: 0.6 }), N / fcol.length | 0);
    for (let i = 0; i < im.count; i += 1) { const a = r() * 6.28, d = r() < 0.3 ? 14.4 + r() * 1.5 : 22.6 + r() * 7.5; dummy.position.set(Math.sin(a) * d, 0.12 + (night ? 0.1 : 0), Math.cos(a) * d); dummy.scale.set(1, 0.7, 1); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); }
    root.add(im); if (night) anim.push((t) => { im.material.emissiveIntensity = 0.9 + Math.sin(t * 2 + k * 2) * 0.5; });
  });
  // 나무와 집(또는 가게)
  for (let i = 0; i < 30; i += 1) {
    const deg = i * 12 + r() * 5; if (Math.abs((deg % 360) - 180) < 10 || deg % 360 < 15 || deg % 360 > 345) continue;
    const building = i % 4 === 1, [x, z] = polar(deg, building ? 27.6 : 25.6 + r() * 3.6);
    const o = building ? ({ night: stall, ice: igloo, space: rocket, gold: palace }[kind] ?? house)(r, i) : tree(th, r);
    o.position.set(x, 0, z); o.rotation.y = building ? Math.atan2(-x, -z) : r() * 6; root.add(o);
  }
  // 등불 기둥과 풍선
  for (let i = 0; i < 8; i += 1) {
    const [x, z] = polar(i * 45 + 22.5, 14.9), g = new THREE.Group(), c = ['#ff5e7e', '#ffd43b', '#3fd0ff', '#7bff8a'][i % 4];
    g.add(part(new THREE.CylinderGeometry(0.09, 0.13, 3.6, 8), mat(night ? '#d9d9ff' : '#5b6275', { metal: 0.4, rough: 0.5 }), 0, 1.8, 0),
      part(new THREE.SphereGeometry(0.34, 14, 10), mat(night ? c : '#fff6d6', { emissive: night ? c : '#ffe9a8', glow: night ? 2.2 : 0.5 }), 0, 3.75, 0));
    if (!night) { const b = part(new THREE.SphereGeometry(0.42, 14, 10), mat(c, { rough: 0.3 }), 0.5, 5.0, 0, [1, 1.2, 1]); g.add(b, part(new THREE.CylinderGeometry(0.01, 0.01, 1.2, 4), mat('#ffffff'), 0.26, 4.3, 0)); g.children.at(-1).rotation.z = -0.4; anim.push((t) => { b.position.y = 5.0 + Math.sin(t * 1.5 + i) * 0.12; }); }
    g.position.set(x, 0, z); root.add(g); solids.push([x, z, 0.35]);
    if (night && i % 2 === 0) { const pl = new THREE.PointLight(c, 26, 18, 1.8); pl.position.set(x, 3.6, z); root.add(pl); }
  }
  // 멀리 보이는 것
  if (night) {
    const n = 900, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) { const a = r() * 6.28, e = 0.08 + r() * 1.4, d = 330; pos.set([Math.sin(a) * Math.cos(e) * d, Math.sin(e) * d, Math.cos(a) * Math.cos(e) * d], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    root.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, fog: false })));
    if (kind === 'space') {
      [['#ff9f43', 34, -170, 120, -220, true], ['#4dabf7', 20, 190, 90, -120, false], ['#ff8fd0', 12, 60, 170, 210, false], ['#7bff8a', 16, -210, 60, 110, true]].forEach(([c, s, x, y, z, ringed]) => {
        const pl = new THREE.Mesh(new THREE.SphereGeometry(s, 24, 16), new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, emissive: c, emissiveIntensity: 0.25, fog: false })); pl.position.set(x, y, z); root.add(pl);
        if (ringed) { const rg = new THREE.Mesh(new THREE.TorusGeometry(s * 1.7, s * 0.12, 4, 48), new THREE.MeshBasicMaterial({ color: '#ffe9c2', fog: false })); rg.position.copy(pl.position); rg.rotation.set(1.2, 0.3, 0); rg.scale.z = 0.1; root.add(rg); }
        anim.push((t) => { pl.rotation.y = t * 0.03; });
      });
    }
    const moon = new THREE.Mesh(new THREE.SphereGeometry(22, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff3c4', fog: false })); moon.position.set(-150, 150, -230); if (kind !== 'space') root.add(moon);
    for (let i = 0; i < (kind === 'space' ? 0 : 14); i += 1) { const [x, z] = polar(i * 26 + r() * 10, 150 + r() * 60), h = 14 + r() * 40; const b = new THREE.Mesh(new THREE.BoxGeometry(12 + r() * 10, h, 12), mat(['#3d2f80', '#5a3a9a', '#2c2a6a'][i % 3], { emissive: ['#ff8fd0', '#7dffea', '#ffe066'][i % 3], glow: 0.35 })); b.position.set(x, h / 2 - 2, z); root.add(b); }
  } else {
    const hc = th.hills ?? ['#7fd87a', '#62c46a', '#93e08a'];
    for (let i = 0; i < (kind === 'gold' ? 0 : 9); i += 1) { const [x, z] = polar(i * 40 + r() * 20, 150 + r() * 70); const m = new THREE.Mesh(new THREE.SphereGeometry(40 + r() * 30, 16, 10), mat(hc[i % 3], { rough: 1, flat: true })); m.position.set(x, -14, z); m.scale.y = 0.6; root.add(m); }
    const clouds = new THREE.Group();
    for (let i = 0; i < 12; i += 1) { const g = new THREE.Group(), [x, z] = polar(i * 30 + r() * 20, 50 + r() * 80); for (let k = 0; k < 5; k += 1) { const s = new THREE.Mesh(new THREE.SphereGeometry(3 + r() * 3, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false })); s.position.set((k - 2) * 3.5, r() * 2, r() * 3); s.scale.y = 0.6; g.add(s); } g.position.set(x, 26 + r() * 22, z); clouds.add(g); }
    root.add(clouds); anim.push((t) => { clouds.rotation.y = t * 0.008; });
    if (kind === 'ice') {
      const n = 700, sp = new Float32Array(n * 3); for (let i = 0; i < n; i += 1) sp.set([(r() - 0.5) * 90, r() * 40, (r() - 0.5) * 90], i * 3);
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
      const snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 0.22, transparent: true, opacity: 0.9 })); root.add(snow);
      anim.push((t) => { const a = sg.attributes.position; for (let i = 0; i < n; i += 1) a.setY(i, (sp[i * 3 + 1] + 40 - ((t * 2.2 + i) % 40)) % 40); a.needsUpdate = true; snow.rotation.y = Math.sin(t * 0.1) * 0.2; });
      for (let i = 0; i < 3; i += 1) { const [x, z] = polar(60 + i * 120, 23.4), sm = new THREE.Group(); sm.add(part(new THREE.SphereGeometry(0.7, 14, 10), mat('#ffffff', { rough: 0.9 }), 0, 0.6, 0), part(new THREE.SphereGeometry(0.5, 14, 10), mat('#ffffff', { rough: 0.9 }), 0, 1.5, 0), part(new THREE.SphereGeometry(0.36, 14, 10), mat('#ffffff', { rough: 0.9 }), 0, 2.15, 0), part(new THREE.ConeGeometry(0.07, 0.3, 8), mat('#ff922b'), 0, 2.15, 0.45), part(new THREE.SphereGeometry(0.045, 6, 5), mat('#20232a'), 0.12, 2.25, 0.32), part(new THREE.SphereGeometry(0.045, 6, 5), mat('#20232a'), -0.12, 2.25, 0.32), part(new THREE.CylinderGeometry(0.25, 0.25, 0.3, 12), mat('#e63946'), 0, 2.6, 0)); sm.children[3].rotation.x = Math.PI / 2; sm.position.set(x, 0, z); sm.rotation.y = Math.atan2(-x, -z); root.add(sm); solids.push([x, z, 0.8]); }
    }
    if (kind === 'gold') {
      ['#ff5e7e', '#ff922b', '#ffd43b', '#51cf66', '#4dabf7', '#b197fc'].forEach((c, i) => { const arc = new THREE.Mesh(new THREE.TorusGeometry(120 - i * 5, 2.6, 6, 60, Math.PI), new THREE.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0.85 })); arc.position.set(0, -6, -170); root.add(arc); });
      for (let i = 0; i < 26; i += 1) { const [x, z] = polar(i * 14 + r() * 8, 36 + r() * 60), c = new THREE.Mesh(new THREE.SphereGeometry(5 + r() * 6, 10, 8), mat('#ffffff', { rough: 1 })); c.position.set(x, -3 + r() * 2, z); c.scale.y = 0.5; root.add(c); }
    }
  }

  // 음식 테이블 10개
  const tables = LAYOUT.tables.map(([x, z], i) => {
    const stage = STAGES[(worldId - 1) * 10 + i], t = foodTable(th, stage, night);
    t.group.position.set(x, 0, z); t.group.rotation.y = Math.atan2(-x, -z); root.add(t.group);
    solids.push([x, z, 1.9]);
    const it = { type: 'table', stage, x: x * 0.86, z: z * 0.86, r: 3.1, top: stage.level === 10 ? 7.2 : 5.7, at: [x, z], ...t }; interact.push(it);
    anim.push((tm) => { t.food.rotation.y = tm * 0.5; t.lock.position.y = 2.2 + Math.sin(tm * 2 + i) * 0.1; });
    return it;
  });
  // 업그레이드 발판 6개
  const pcol = ['#ff6b8b', '#4dabf7', '#ffd43b', '#51cf66', '#ff922b', '#b197fc'];
  const pads = LAYOUT.pads.map(([x, z], i) => {
    const g = new THREE.Group(), c = pcol[i];
    g.add(part(new THREE.CylinderGeometry(1.5, 1.65, 0.16, 28), mat(c, { rough: 0.5, emissive: c, glow: night ? 0.5 : 0.12 }), 0, 0.08, 0), part(new THREE.CylinderGeometry(1.15, 1.15, 0.18, 28), mat('#ffffff', { rough: 0.4 }), 0, 0.09, 0));
    const ring = part(new THREE.TorusGeometry(1.3, 0.06, 8, 32), mat(c, { emissive: c, glow: 1.2 }), 0, 0.5, 0); ring.rotation.x = Math.PI / 2; ring.castShadow = false; g.add(ring);
    const icon = makeEmoji(UPGRADES[i].emoji, 1.5); icon.position.y = 1.9; g.add(icon);
    const label = makeLabel('', { width: 3.3, tall: true }); label.position.y = 3.35; g.add(label);
    g.position.set(x, 0, z); root.add(g);
    anim.push((t) => { icon.position.y = 1.9 + Math.sin(t * 2.2 + i) * 0.15; ring.position.y = 0.35 + (Math.sin(t * 1.6 + i) * 0.5 + 0.5) * 0.5; });
    const it = { type: 'pad', up: UPGRADES[i], x, z, r: 2.1, top: 4.4, label, group: g }; interact.push(it);
    return it;
  });
  // 계획 2: 트램폴린 두 개 (위에서 튈 때마다 점프력 +0.02)
  const platforms = LAYOUT.tramps.map(([x, z], i) => { const tr = makeTrampoline(i ? '#ff7a59' : '#3fa7ff', anim); tr.group.position.set(x, 0, z); root.add(tr.group); interact.push({ type: 'tramp', x, z, r: 2.4, top: 3.6 }); return { kind: 'tramp', x, z, r: 1.45, top: 0.3, tramp: tr }; });
  // 계획 2: 우리 집
  const hg = homeHouse(); hg.position.set(LAYOUT.home[0], 0, LAYOUT.home[1] + 2.6); hg.rotation.y = Math.PI; root.add(hg);
  const hlabel = makeLabel('🏠 우리 집', { width: 3 }); hlabel.position.set(LAYOUT.home[0], 6.6, LAYOUT.home[1] + 2.6); root.add(hlabel);
  interact.push({ type: 'home', x: LAYOUT.home[0], z: LAYOUT.home[1] - 0.4, r: 2.3, top: 7 });
  solids.push([LAYOUT.home[0], LAYOUT.home[1] + 2.6, 2.3]);
  // 기네스 저울과 심사위원
  const sg = new THREE.Group(), [sx, sz] = LAYOUT.scale;
  sg.add(part(new THREE.CylinderGeometry(2.5, 2.7, 0.22, 36), mat('#f1f3f5', { rough: 0.35 }), 0, 0.11, 0), part(new THREE.CylinderGeometry(2.1, 2.1, 0.24, 36), mat(night ? '#3fd0ff' : '#ff8fb3', { rough: 0.5, emissive: night ? '#3fd0ff' : '#ff8fb3', glow: 0.2 }), 0, 0.12, 0),
    part(new THREE.CylinderGeometry(0.16, 0.2, 3.2, 10), mat('#ced4da', { metal: 0.6, rough: 0.3 }), 0, 1.6, -2.9), part(new THREE.CylinderGeometry(1.15, 1.15, 0.22, 32), mat('#ffffff', { rough: 0.3 }), 0, 3.7, -2.9), part(new THREE.TorusGeometry(1.15, 0.1, 8, 32), mat('#ffd43b', { metal: 0.7, rough: 0.3 }), 0, 3.7, -2.78));
  sg.children[3].rotation.x = Math.PI / 2;
  for (let i = 0; i < 9; i += 1) { const a = -2.1 + (i / 8) * 4.2; sg.add(part(new THREE.BoxGeometry(0.05, 0.18, 0.03), mat('#343a40'), Math.sin(a) * 0.92, 3.7 + Math.cos(a) * 0.92, -2.76)); sg.children.at(-1).rotation.z = -a; }
  const needle = new THREE.Group(); needle.add(part(new THREE.BoxGeometry(0.07, 0.85, 0.04), mat('#e63946', { emissive: '#e63946', glow: 0.4 }), 0, 0.4, 0)); needle.position.set(0, 3.7, -2.74); sg.add(needle, part(new THREE.SphereGeometry(0.1, 10, 8), mat('#343a40'), 0, 3.7, -2.72));
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 9, 28, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })); beam.position.y = 4.5; beam.visible = false; sg.add(beam);
  const slabel = makeLabel('기네스 저울', { width: 3.4 }); slabel.position.set(0, 5.5, -2.9); sg.add(slabel);
  sg.position.set(sx, 0, sz); root.add(sg);
  const judge = makeJudge(), [jx, jz] = LAYOUT.judge; judge.position.set(jx, 0, jz); judge.rotation.y = -0.5; judge.scale.setScalar(1.15); root.add(judge); solids.push([jx, jz, 0.7], [sx, sz - 2.9, 0.5]);
  anim.push((t) => { judge.position.y = Math.abs(Math.sin(t * 1.5)) * 0.05; beam.rotation.y = t; beam.material.opacity = 0.16 + Math.sin(t * 4) * 0.07; });
  const scale = { type: 'scale', x: sx, z: sz, r: 3.0, top: 6.6, needle, beam, label: slabel }; interact.push(scale);
  // 다른 월드로 가는 문
  const pg = new THREE.Group(), [px, pz] = LAYOUT.portal, pc = night ? '#7bff8a' : '#b197fc';
  const pring = part(new THREE.TorusGeometry(2.1, 0.28, 12, 40), mat(pc, { emissive: pc, glow: 1.3, rough: 0.3 }), 0, 2.5, 0); pring.castShadow = false;
  const swirl = new THREE.Mesh(new THREE.CircleGeometry(1.95, 40), new THREE.MeshBasicMaterial({ color: night ? '#9dffb0' : '#d6c2ff', transparent: true, opacity: 0.75, side: THREE.DoubleSide })); swirl.position.y = 2.5;
  const stars = new THREE.Group(); for (let i = 0; i < 10; i += 1) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), new THREE.MeshBasicMaterial({ color: '#ffffff' })); s.position.set(Math.sin(i * 0.63) * (0.5 + (i % 4) * 0.4), Math.cos(i * 0.63) * (0.5 + (i % 4) * 0.4), 0.05); stars.add(s); } stars.position.y = 2.5;
  pg.add(pring, swirl, stars, part(new THREE.BoxGeometry(5.4, 0.3, 2), mat('#ced4da', { rough: 0.5 }), 0, 0.15, 0));
  const plabel = makeLabel('', { width: 4.2, tall: true }); plabel.position.y = 5.7; pg.add(plabel);
  pg.position.set(px, 0, pz); root.add(pg);
  anim.push((t) => { stars.rotation.z = t * 1.2; swirl.material.opacity = portal.open ? 0.6 + Math.sin(t * 3) * 0.2 : 0.12; pring.material.emissiveIntensity = portal.open ? 1.3 : 0.15; stars.visible = portal.open; });
  const portal = { type: 'portal', x: px, z: pz + 1.2, r: 3.2, top: 6.8, label: plabel, open: false }; interact.push(portal);

  return { root, theme: th, night, sprites, interact, tables, pads, scale, portal, solids, platforms, flat: true, id: worldId, update: (t) => anim.forEach((f) => f(t)) };
}
