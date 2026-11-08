// 블록 아바타: 몸, 얼굴, 모자, 셔츠 무늬, 이름표, 말풍선, 걷기/점프/감정 표현 움직임.
import { THREE } from './render.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SKINS, COLORS, HATS, FACES, EMBLEMS, HAIRS, HAIR_COLORS, P } from '../core.mjs';

const geo = {
  leg: new RoundedBoxGeometry(0.5, 0.62, 0.52, 2, 0.1),
  shoe: new RoundedBoxGeometry(0.54, 0.22, 0.6, 2, 0.08),
  torso: new RoundedBoxGeometry(1.12, 0.92, 0.62, 2, 0.14),
  sleeve: new RoundedBoxGeometry(0.44, 0.44, 0.46, 2, 0.1),
  hand: new RoundedBoxGeometry(0.4, 0.44, 0.42, 2, 0.12),
  head: new RoundedBoxGeometry(1.0, 0.92, 0.92, 3, 0.2),
  face: new THREE.PlaneGeometry(0.86, 0.8),
  emblem: new THREE.PlaneGeometry(0.62, 0.62),
};

const darker = (hex, f = 0.72) => '#' + new THREE.Color(hex).multiplyScalar(f).getHexString();

function stdMat(color, extra = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0, ...extra });
  return m;
}

// ───── 얼굴 그림 ─────
const faceCache = new Map();
export function faceTexture(id) {
  if (faceCache.has(id)) return faceCache.get(id);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.lineCap = 'round'; g.lineJoin = 'round';
  const eye = (x, y, r = 22) => {
    g.fillStyle = '#1e1f26'; g.beginPath(); g.ellipse(x, y, r * 0.78, r, 0, 0, 7); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x - r * 0.25, y - r * 0.35, r * 0.3, 0, 7); g.fill();
  };
  const cheeks = () => { g.fillStyle = 'rgba(255,120,140,0.35)'; for (const x of [52, 204]) { g.beginPath(); g.ellipse(x, 158, 22, 13, 0, 0, 7); g.fill(); } };
  g.strokeStyle = '#1e1f26'; g.lineWidth = 11;
  switch (id) {
    case 'grin':
      eye(84, 102); eye(172, 102); cheeks();
      g.fillStyle = '#3a1d22'; g.beginPath(); g.moveTo(78, 152); g.quadraticCurveTo(128, 222, 178, 152); g.closePath(); g.fill();
      g.fillStyle = '#ff7b93'; g.beginPath(); g.ellipse(128, 182, 26, 12, 0, 0, 7); g.fill();
      break;
    case 'wink':
      eye(84, 102);
      g.beginPath(); g.moveTo(152, 104); g.quadraticCurveTo(174, 88, 196, 104); g.stroke();
      cheeks(); g.beginPath(); g.moveTo(92, 160); g.quadraticCurveTo(128, 190, 164, 158); g.stroke();
      break;
    case 'surprised':
      eye(84, 100, 26); eye(172, 100, 26);
      g.fillStyle = '#3a1d22'; g.beginPath(); g.ellipse(128, 176, 18, 24, 0, 0, 7); g.fill();
      break;
    case 'sleepy':
      g.beginPath(); g.moveTo(62, 106); g.quadraticCurveTo(84, 120, 106, 106); g.stroke();
      g.beginPath(); g.moveTo(150, 106); g.quadraticCurveTo(172, 120, 194, 106); g.stroke();
      g.lineWidth = 8; g.beginPath(); g.moveTo(110, 168); g.lineTo(146, 168); g.stroke();
      g.fillStyle = '#5fa8ff'; g.font = 'bold 44px sans-serif'; g.fillText('z', 196, 70); g.font = 'bold 30px sans-serif'; g.fillText('z', 222, 44);
      break;
    case 'tongue':
      g.beginPath(); g.moveTo(62, 104); g.lineTo(104, 92); g.stroke();
      eye(172, 102);
      g.beginPath(); g.moveTo(86, 156); g.quadraticCurveTo(128, 184, 170, 156); g.stroke();
      g.fillStyle = '#ff6b8a'; g.beginPath(); g.roundRect(108, 164, 40, 42, 20); g.fill();
      break;
    case 'cool':
      g.fillStyle = '#16171d';
      g.beginPath(); g.roundRect(40, 76, 80, 50, 16); g.fill(); g.beginPath(); g.roundRect(136, 76, 80, 50, 16); g.fill();
      g.fillRect(112, 88, 32, 10);
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(54, 86, 22, 8); g.fillRect(150, 86, 22, 8);
      g.beginPath(); g.moveTo(98, 166); g.quadraticCurveTo(140, 188, 168, 156); g.stroke();
      break;
    case 'star': {
      const star = (cx, cy, r) => {
        g.fillStyle = '#ffd23f'; g.strokeStyle = '#c47a00'; g.lineWidth = 5; g.beginPath();
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
        g.closePath(); g.fill(); g.stroke();
      };
      star(84, 102, 32); star(172, 102, 32); cheeks();
      g.strokeStyle = '#1e1f26'; g.lineWidth = 11; g.beginPath(); g.moveTo(92, 160); g.quadraticCurveTo(128, 196, 164, 160); g.stroke();
      break;
    }
    default:
      eye(84, 104); eye(172, 104); cheeks();
      g.beginPath(); g.moveTo(92, 160); g.quadraticCurveTo(128, 192, 164, 160); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  faceCache.set(id, t);
  return t;
}

// ───── 셔츠 무늬 ─────
const emblemCache = new Map();
export function emblemTexture(id) {
  if (emblemCache.has(id)) return emblemCache.get(id);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.translate(64, 64);
  g.lineJoin = 'round';
  const path = (pts, fill, stroke = 'rgba(0,0,0,0.25)') => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = stroke; g.lineWidth = 5; g.stroke(); };
  switch (id) {
    case 'star': { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 22 : 50; pts.push([Math.cos(a) * r, Math.sin(a) * r]); } path(pts, '#ffffff'); break; }
    case 'heart': g.fillStyle = '#ff4d6d'; g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 44); g.bezierCurveTo(-70, -4, -34, -58, 0, -22); g.bezierCurveTo(34, -58, 70, -4, 0, 44); g.fill(); g.stroke(); break;
    case 'bolt': path([[10, -54], [-30, 6], [-4, 6], [-14, 54], [30, -8], [4, -8]], '#ffd23f'); break;
    case 'brick': for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) { g.fillStyle = '#e8553f'; g.strokeStyle = '#ffffff'; g.lineWidth = 4; const x = -48 + k * 32 + (r % 2 ? 16 : 0), y = -36 + r * 26; g.fillRect(x, y, 30, 22); g.strokeRect(x, y, 30, 22); } break;
    case 'smile': g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(0, 0, 48, 0, 7); g.fill(); g.fillStyle = '#222'; g.beginPath(); g.arc(-16, -12, 7, 0, 7); g.arc(16, -12, 7, 0, 7); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 7; g.beginPath(); g.arc(0, 4, 24, 0.2, Math.PI - 0.2); g.stroke(); break;
    case 'flame': path([[0, -56], [26, -14], [38, 14], [24, 46], [0, 56], [-24, 46], [-38, 14], [-20, -10], [-8, 4]], '#ff7a1a'); path([[0, -10], [16, 18], [10, 42], [-10, 42], [-16, 18]], '#ffd23f', 'rgba(0,0,0,0)'); break;
    case 'crown': path([[-48, 30], [-48, -26], [-24, 0], [0, -40], [24, 0], [48, -26], [48, 30]], '#ffcf33'); break;
    default: break;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  emblemCache.set(id, t);
  return t;
}

// ───── 모자 ─────
function hatGroup(id, shirtColor) {
  const g = new THREE.Group();
  const add = (geometry, color, x = 0, y = 0, z = 0, extra = {}) => {
    const m = new THREE.Mesh(geometry, stdMat(color, extra));
    m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
  };
  switch (id) {
    case 'cap': {
      add(new THREE.SphereGeometry(0.52, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), shirtColor, 0, -0.08, 0).scale.set(1.02, 0.7, 1.0);
      add(new RoundedBoxGeometry(0.8, 0.07, 0.5, 2, 0.03), darker(shirtColor), 0, -0.05, 0.5);
      add(new THREE.SphereGeometry(0.06, 10, 8), '#ffffff', 0, 0.3, 0);
      break;
    }
    case 'beanie': {
      add(new THREE.SphereGeometry(0.54, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), '#ff6b6b', 0, -0.12, 0).scale.set(1, 0.85, 1);
      add(new THREE.CylinderGeometry(0.55, 0.55, 0.2, 24), '#ffffff', 0, -0.1, 0);
      add(new THREE.SphereGeometry(0.16, 12, 10), '#ffffff', 0, 0.38, 0);
      break;
    }
    case 'party': {
      const cone = add(new THREE.ConeGeometry(0.32, 0.8, 20), '#9b5cff', 0.1, 0.36, 0); cone.rotation.z = -0.15;
      add(new THREE.SphereGeometry(0.1, 10, 8), '#ffd23f', 0.16, 0.78, 0);
      break;
    }
    case 'flower': {
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; add(new THREE.SphereGeometry(0.11, 10, 8), '#ff8fc7', 0.32 + Math.cos(a) * 0.13, 0.02 + Math.sin(a) * 0.13, 0.36); }
      add(new THREE.SphereGeometry(0.09, 10, 8), '#ffd23f', 0.32, 0.02, 0.4);
      break;
    }
    case 'antenna': {
      for (const s of [-1, 1]) {
        const stick = add(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8), '#5ad16b', s * 0.22, 0.25, 0); stick.rotation.z = -s * 0.25;
        add(new THREE.SphereGeometry(0.11, 12, 10), '#9dff6b', s * 0.3, 0.56, 0, { emissive: '#5ad16b', emissiveIntensity: 0.6 });
      }
      break;
    }
    case 'bunny': {
      for (const s of [-1, 1]) {
        const ear = add(new RoundedBoxGeometry(0.22, 0.8, 0.12, 2, 0.1), '#ffffff', s * 0.24, 0.38, 0); ear.rotation.z = -s * 0.12;
        const inner = add(new RoundedBoxGeometry(0.12, 0.6, 0.04, 2, 0.05), '#ffb3cf', s * 0.24, 0.38, 0.06); inner.rotation.z = -s * 0.12;
      }
      break;
    }
    case 'cat': {
      for (const s of [-1, 1]) {
        const ear = add(new THREE.ConeGeometry(0.2, 0.36, 4), '#4b5163', s * 0.3, 0.14, 0); ear.rotation.y = Math.PI / 4;
        const inner = add(new THREE.ConeGeometry(0.11, 0.22, 4), '#ffb3cf', s * 0.3, 0.12, 0.05); inner.rotation.y = Math.PI / 4;
      }
      break;
    }
    case 'chef': {
      add(new THREE.CylinderGeometry(0.42, 0.4, 0.4, 20), '#ffffff', 0, 0.16, 0);
      for (const [x, z] of [[-0.18, 0], [0.18, 0], [0, 0.16], [0, -0.16], [0, 0]]) add(new THREE.SphereGeometry(0.26, 14, 10), '#ffffff', x, 0.48, z);
      break;
    }
    case 'headphones': {
      const band = add(new THREE.TorusGeometry(0.56, 0.06, 8, 24, Math.PI), '#23262f', 0, -0.12, 0); band.rotation.z = 0;
      for (const s of [-1, 1]) add(new RoundedBoxGeometry(0.16, 0.38, 0.38, 2, 0.08), '#ff4d5e', s * 0.56, -0.4, 0);
      break;
    }
    case 'tophat': {
      add(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 28), '#16171d', 0, 0.01, 0);
      add(new THREE.CylinderGeometry(0.38, 0.4, 0.62, 24), '#16171d', 0, 0.33, 0);
      add(new THREE.CylinderGeometry(0.405, 0.405, 0.12, 24), '#c0283c', 0, 0.1, 0);
      break;
    }
    case 'horns': {
      for (const s of [-1, 1]) { const h = add(new THREE.ConeGeometry(0.12, 0.5, 12), '#fff4d6', s * 0.36, 0.14, 0); h.rotation.z = -s * 0.5; }
      break;
    }
    case 'viking': {
      add(new THREE.SphereGeometry(0.54, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), '#9aa3b5', 0, -0.12, 0, { metalness: 0.7, roughness: 0.3 });
      add(new THREE.CylinderGeometry(0.56, 0.56, 0.1, 24), '#b8860b', 0, -0.1, 0, { metalness: 0.8, roughness: 0.3 });
      for (const s of [-1, 1]) { const h = add(new THREE.ConeGeometry(0.11, 0.55, 12), '#fff4d6', s * 0.58, 0.16, 0); h.rotation.z = -s * 0.9; }
      break;
    }
    case 'crown': {
      add(new THREE.CylinderGeometry(0.4, 0.4, 0.24, 8, 1, true), '#ffcf33', 0, 0.1, 0, { metalness: 1, roughness: 0.2, side: THREE.DoubleSide });
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; add(new THREE.ConeGeometry(0.08, 0.2, 6), '#ffcf33', Math.cos(a) * 0.37, 0.3, Math.sin(a) * 0.37, { metalness: 1, roughness: 0.2 }); }
      add(new THREE.OctahedronGeometry(0.08), '#ff3b5c', 0, 0.12, 0.42, { emissive: '#ff3b5c', emissiveIntensity: 0.4 });
      break;
    }
    case 'wizard': {
      add(new THREE.CylinderGeometry(0.64, 0.64, 0.05, 28), '#4a2d9b', 0, 0.0, 0);
      const cone = add(new THREE.ConeGeometry(0.42, 1.0, 24), '#4a2d9b', 0, 0.52, 0); cone.rotation.z = 0.12;
      add(new THREE.OctahedronGeometry(0.1), '#ffd23f', 0.05, 0.4, 0.36, { emissive: '#ffd23f', emissiveIntensity: 0.8 });
      break;
    }
    case 'halo': {
      const ring = add(new THREE.TorusGeometry(0.38, 0.06, 10, 32), '#fff3a0', 0, 0.42, 0, { emissive: '#ffe066', emissiveIntensity: 1.4 });
      ring.rotation.x = Math.PI / 2;
      break;
    }
    default: break;
  }
  return g;
}

// ───── 머리카락 ─────
// 머리(가로 1.0, 높이 0.92, 깊이 0.92)의 가운데가 (0, 0.48, 0), 윗면이 0.94, 얼굴은 +z 쪽.
// 모자를 쓰면 위로 솟는 부분(tall)은 숨긴다.
const COVER_HATS = new Set(['cap', 'beanie', 'chef', 'tophat', 'viking', 'wizard', 'party', 'crown']);
function hairGroup(id, color, covered) {
  const g = new THREE.Group();
  const mat = stdMat(color, { roughness: 0.6 });
  const box = (w, h, d, x, y, z, r = 0.08, tall = false) => {
    if (tall && covered) return null;
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2)), mat);
    m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
  };
  const ball = (r, x, y, z, tall = false, sy = 1) => {
    if (tall && covered) return null;
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat);
    m.position.set(x, y, z); m.scale.y = sy; m.castShadow = true; g.add(m); return m;
  };
  const cone = (r, h, x, y, z, rx = 0, rz = 0) => {
    if (covered) return null;
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), mat);
    m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; g.add(m); return m;
  };
  const cap = () => { box(1.08, 0.2, 1.0, 0, 0.96, -0.02, 0.09, true); box(1.08, 0.5, 0.16, 0, 0.66, -0.48); };
  const fringe = () => box(1.04, 0.16, 0.12, 0, 0.86, 0.47, 0.05);
  switch (id) {
    case 'short': cap(); fringe(); for (const s of [-1, 1]) box(0.1, 0.34, 0.5, s * 0.53, 0.72, -0.16, 0.04); break;
    case 'bangs':
      cap(); for (const s of [-1, 1]) box(0.1, 0.42, 0.7, s * 0.53, 0.68, -0.08, 0.04);
      for (const x of [-0.33, 0, 0.33]) box(0.34, 0.26, 0.12, x, 0.8, 0.48, 0.06);
      break;
    case 'spiky':
      cap(); fringe();
      for (const [x, z, rx, rz] of [[0, 0.15, 0.3, 0], [-0.3, 0, 0.1, 0.45], [0.3, 0, 0.1, -0.45], [0, -0.25, -0.3, 0], [-0.25, -0.3, -0.2, 0.3], [0.25, -0.3, -0.2, -0.3]]) cone(0.17, 0.5, x, 1.18, z, rx, rz);
      break;
    case 'bob':
      cap(); fringe(); box(1.12, 0.78, 0.2, 0, 0.5, -0.47);
      for (const s of [-1, 1]) box(0.14, 0.78, 0.86, s * 0.56, 0.5, -0.04, 0.06);
      break;
    case 'long':
      cap(); fringe(); box(1.1, 1.55, 0.18, 0, 0.18, -0.5, 0.08);
      for (const s of [-1, 1]) box(0.14, 1.1, 0.5, s * 0.56, 0.38, -0.2, 0.06);
      break;
    case 'pony':
      cap(); fringe(); box(0.2, 0.2, 0.2, 0, 0.82, -0.56, 0.06);
      box(0.3, 0.8, 0.28, 0, 0.42, -0.66, 0.12);
      break;
    case 'pigtails':
      cap(); fringe();
      for (const s of [-1, 1]) { ball(0.18, s * 0.6, 0.72, -0.12); box(0.24, 0.62, 0.24, s * 0.7, 0.36, -0.12, 0.1); }
      break;
    case 'bun': cap(); fringe(); ball(0.27, 0, 1.12, -0.1, true); break;
    case 'curly':
      for (const [x, y, z, r] of [[0, 0.98, 0, 0.36], [-0.35, 0.92, 0.12, 0.25], [0.35, 0.92, 0.12, 0.25], [-0.38, 0.86, -0.25, 0.28], [0.38, 0.86, -0.25, 0.28], [0, 0.9, -0.38, 0.3], [-0.5, 0.62, -0.1, 0.2], [0.5, 0.62, -0.1, 0.2], [0, 0.66, -0.5, 0.26]]) ball(r, x, y, z, y > 0.85);
      box(1.0, 0.14, 0.12, 0, 0.88, 0.47, 0.06);
      break;
    case 'mohawk':
      box(1.06, 0.08, 0.96, 0, 0.95, -0.02, 0.03);
      for (let k = 0; k < 5; k++) box(0.16, 0.3 + (k === 1 || k === 2 ? 0.1 : 0), 0.18, 0, 1.12 + (k === 1 || k === 2 ? 0.05 : 0), 0.34 - k * 0.2, 0.05, true);
      break;
    case 'swoop':
      cap(); box(1.12, 0.5, 0.16, 0, 0.66, -0.48);
      { const top = box(0.9, 0.28, 0.42, 0.12, 1.06, 0.2, 0.12, true); if (top) top.rotation.z = -0.25; } // 모자를 쓰면 없음 (null)
      { const side = box(0.62, 0.22, 0.14, 0.2, 0.84, 0.47, 0.06); if (side) side.rotation.z = -0.3; }
      break;
    default: break;
  }
  return g;
}

// 꾸미기 창에 보여 줄 작은 그림
const hairIconCache = new Map();
export function hairIcon(id, color) {
  const key = `${id}|${color}`;
  if (hairIconCache.has(key)) return hairIconCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#ffdcb5'; g.beginPath(); g.roundRect(22, 26, 52, 52, 12); g.fill();
  g.fillStyle = '#1e1f26'; g.fillRect(36, 50, 6, 9); g.fillRect(54, 50, 6, 9);
  g.fillStyle = color;
  const rr = (x, y, w, h, r = 6) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
  const top = () => rr(19, 18, 58, 16, 8);
  switch (id) {
    case 'short': top(); rr(19, 26, 8, 16, 3); rr(69, 26, 8, 16, 3); break;
    case 'bangs': top(); rr(22, 28, 52, 12, 5); break;
    case 'spiky': top(); for (const x of [26, 40, 54, 66]) { g.beginPath(); g.moveTo(x - 7, 22); g.lineTo(x, 4); g.lineTo(x + 7, 22); g.fill(); } break;
    case 'bob': top(); rr(16, 24, 12, 46, 5); rr(68, 24, 12, 46, 5); break;
    case 'long': top(); rr(14, 24, 13, 66, 6); rr(69, 24, 13, 66, 6); break;
    case 'pony': top(); rr(70, 24, 16, 40, 8); break;
    case 'pigtails': top(); g.beginPath(); g.arc(14, 46, 10, 0, 7); g.arc(82, 46, 10, 0, 7); g.fill(); rr(8, 50, 12, 30, 6); rr(76, 50, 12, 30, 6); break;
    case 'bun': top(); g.beginPath(); g.arc(48, 12, 12, 0, 7); g.fill(); break;
    case 'curly': for (const [x, y, r] of [[30, 22, 13], [48, 16, 15], [66, 22, 13], [20, 38, 10], [76, 38, 10]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } break;
    case 'mohawk': rr(40, 2, 16, 30, 6); break;
    case 'swoop': top(); g.beginPath(); g.moveTo(20, 30); g.quadraticCurveTo(50, 6, 80, 22); g.lineTo(76, 34); g.quadraticCurveTo(50, 22, 26, 38); g.fill(); break;
    default: g.strokeStyle = '#ff4d5e'; g.lineWidth = 6; g.beginPath(); g.arc(48, 48, 34, 0, 7); g.moveTo(24, 72); g.lineTo(72, 24); g.stroke(); break;
  }
  const url = c.toDataURL();
  hairIconCache.set(key, url);
  return url;
}

// ───── 이름표, 말풍선 ─────
function labelSprite(text, { bg = 'rgba(20,22,30,0.62)', fg = '#ffffff', size = 40, pad = 18, maxW = 460, tail = false } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const font = `${size}px Jua, "Apple SD Gothic Neo", sans-serif`;
  g.font = font;
  const w = Math.min(maxW, Math.ceil(g.measureText(text).width) + pad * 2);
  const h = size + pad * 1.2 + (tail ? 16 : 0);
  c.width = w; c.height = h;
  g.font = font;
  g.fillStyle = bg;
  g.beginPath(); g.roundRect(0, 0, w, h - (tail ? 16 : 0), (h - (tail ? 16 : 0)) / 2.4); g.fill();
  if (tail) { g.beginPath(); g.moveTo(w / 2 - 14, h - 17); g.lineTo(w / 2, h); g.lineTo(w / 2 + 14, h - 17); g.fill(); }
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, (h - (tail ? 16 : 0)) / 2 + 2, w - pad);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true });
  const s = new THREE.Sprite(mat);
  const k = 0.0085;
  s.scale.set(w * k, h * k, 1);
  s.center.set(0.5, 0);
  return s;
}

export class Avatar {
  constructor(look, name = '', { local = false } = {}) {
    this.root = new THREE.Group();
    this.body = new THREE.Group();          // 앉기와 통통 튀기용
    this.root.add(this.body);
    this.local = local;
    this.mats = {
      skin: stdMat('#ffffff'), shirt: stdMat('#ffffff'), pants: stdMat('#ffffff'), shoe: stdMat('#2a2d36'),
      face: new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
      emblem: new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.5, depthWrite: false }),
    };
    const mesh = (g, m, x, y, z, parent) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };

    // 다리
    this.legs = [-1, 1].map(s => {
      const pivot = new THREE.Group(); pivot.position.set(s * 0.27, 0.82, 0);
      mesh(geo.leg, this.mats.pants, 0, -0.31, 0, pivot);
      mesh(geo.shoe, this.mats.shoe, 0, -0.71, 0.04, pivot);
      this.body.add(pivot); return pivot;
    });
    // 몸통
    this.torso = new THREE.Group(); this.torso.position.y = 0.82; this.body.add(this.torso);
    mesh(geo.torso, this.mats.shirt, 0, 0.46, 0, this.torso);
    this.emblem = new THREE.Mesh(geo.emblem, this.mats.emblem);
    this.emblem.position.set(0, 0.48, 0.315); this.torso.add(this.emblem);
    // 팔
    this.arms = [-1, 1].map(s => {
      const pivot = new THREE.Group(); pivot.position.set(s * 0.79, 0.86, 0);
      mesh(geo.sleeve, this.mats.shirt, 0, -0.2, 0, pivot);
      mesh(geo.hand, this.mats.skin, 0, -0.6, 0, pivot);
      this.torso.add(pivot); return pivot;
    });
    // 머리
    this.head = new THREE.Group(); this.head.position.y = 0.96; this.torso.add(this.head);
    mesh(geo.head, this.mats.skin, 0, 0.48, 0, this.head);
    this.face = new THREE.Mesh(geo.face, this.mats.face);
    this.face.position.set(0, 0.46, 0.462); this.head.add(this.face);
    this.hatSlot = new THREE.Group(); this.hatSlot.position.y = 0.94; this.head.add(this.hatSlot);
    this.hairSlot = new THREE.Group(); this.head.add(this.hairSlot);

    this.tag = null; this.bubble = null; this.bubbleTime = 0;
    this.phase = 0; this.t = 0; this.emote = 0; this.visualY = null;
    this.setLook(look);
    if (name && !local) this.setName(name);
  }

  setLook(look) {
    this.look = { ...look };
    this.mats.skin.color.set(SKINS[look.skin]);
    this.mats.shirt.color.set(COLORS[look.shirt]);
    this.mats.pants.color.set(COLORS[look.pants]);
    this.mats.shoe.color.set(darker(COLORS[look.pants], 0.45));
    this.mats.face.map = faceTexture(FACES[look.face].id); this.mats.face.needsUpdate = true;
    const em = EMBLEMS[look.emblem].id;
    this.emblem.visible = em !== 'none';
    if (this.emblem.visible) { this.mats.emblem.map = emblemTexture(em); this.mats.emblem.needsUpdate = true; }
    this.hatSlot.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    this.hatSlot.clear();
    this.hatSlot.add(hatGroup(HATS[look.hat].id, COLORS[look.shirt]));
    this.hairSlot.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    this.hairSlot.clear();
    const hair = HAIRS[look.hair ?? 1] ?? HAIRS[1];
    this.hairSlot.add(hairGroup(hair.id, HAIR_COLORS[look.hairColor ?? 1] ?? HAIR_COLORS[1], COVER_HATS.has(HATS[look.hat]?.id)));
  }

  setName(text, color) {
    if (this.tag) { this.root.remove(this.tag); this.tag.material.map.dispose(); this.tag.material.dispose(); }
    this.tag = labelSprite(text, color ? { bg: color } : {});
    this.tag.position.y = P.H + 0.55;
    this.root.add(this.tag);
  }

  say(text) {
    if (this.bubble) { this.root.remove(this.bubble); this.bubble.material.map.dispose(); this.bubble.material.dispose(); }
    this.bubble = labelSprite(text, { bg: 'rgba(255,255,255,0.96)', fg: '#1e2130', size: 44, tail: true });
    this.bubble.position.y = P.H + (this.tag ? 1.05 : 0.55);
    this.root.add(this.bubble);
    this.bubbleTime = 4.5;
  }

  // state: { speed, grounded, vy, climb, emote }
  animate(dt, s) {
    this.t += dt;
    const k = 1 - Math.exp(-dt * 14);
    const lerp = (o, key, v) => { o[key] += (v - o[key]) * k; };
    const run = Math.min(1, s.speed / P.SPEED);
    this.phase += dt * (4 + s.speed * 1.15);
    const sw = Math.sin(this.phase);
    let la = 0, ra = 0, lz = 0, rz = 0, ll = 0, rl = 0, bob = 0, sit = 0, spin = 0, headX = 0;
    if (s.climb) {
      la = -2.7 + sw * 0.45; ra = -2.7 - sw * 0.45; ll = -0.5 - sw * 0.4; rl = -0.5 + sw * 0.4;
    } else if (!s.grounded) {
      if (s.vy > 0) { la = -0.5; ra = -0.5; lz = 0.55; rz = -0.55; ll = -0.5; rl = 0.25; }
      else { la = -0.3 + Math.sin(this.t * 18) * 0.25; ra = -0.3 - Math.sin(this.t * 18) * 0.25; lz = 2.2; rz = -2.2; ll = 0.2; rl = -0.2; }
    } else if (run > 0.05) {
      ll = sw * 0.85 * run; rl = -sw * 0.85 * run; la = -sw * 0.75 * run; ra = sw * 0.75 * run;
      lz = 0.06; rz = -0.06; bob = Math.abs(Math.cos(this.phase)) * 0.09 * run; headX = 0.05 * run;
    } else {
      const br = Math.sin(this.t * 2.2);
      la = br * 0.04; ra = -br * 0.04; lz = 0.08; rz = -0.08; bob = br * 0.012;
      switch (s.emote) {
        case 1: ra = 0; rz = -2.75 + Math.sin(this.t * 11) * 0.35; break; // 인사
        case 2: { const b = Math.sin(this.t * 9); la = -2.6 + b * 0.5; ra = -2.6 - b * 0.5; ll = b * 0.3; rl = -b * 0.3; bob = Math.abs(b) * 0.25; spin = this.t * 3.2; break; } // 춤
        case 3: { lz = 2.6 + Math.sin(this.t * 10) * 0.15; rz = -2.6 - Math.sin(this.t * 10) * 0.15; bob = Math.abs(Math.sin(this.t * 6)) * 0.45; break; } // 만세
        case 4: ll = -1.5; rl = -1.5; la = -0.6; ra = -0.6; sit = -0.5; break; // 앉기
        default: break;
      }
    }
    if (this.aim && !s.climb && s.emote !== 4) { la = -1.5; ra = -1.32; lz = 0.12; rz = -0.5; } // 블래스터를 두 손으로 앞으로
    lerp(this.arms[0].rotation, 'x', la); lerp(this.arms[1].rotation, 'x', ra);
    lerp(this.arms[0].rotation, 'z', lz); lerp(this.arms[1].rotation, 'z', rz);
    lerp(this.legs[0].rotation, 'x', ll); lerp(this.legs[1].rotation, 'x', rl);
    lerp(this.body.position, 'y', bob + sit);
    lerp(this.head.rotation, 'x', headX);
    this.body.rotation.y = s.emote === 2 && run <= 0.05 && s.grounded ? spin : this.body.rotation.y * (1 - k);
    if (this.bubble) {
      this.bubbleTime -= dt;
      this.bubble.material.opacity = Math.min(1, this.bubbleTime * 2);
      if (this.bubbleTime <= 0) { this.root.remove(this.bubble); this.bubble.material.map.dispose(); this.bubble.material.dispose(); this.bubble = null; }
    }
  }

  // 계단을 올라설 때 몸이 툭 튀지 않게 화면 위치만 부드럽게
  place(x, y, z, yaw, dt) {
    if (this.visualY === null || Math.abs(y - this.visualY) > 1.2) this.visualY = y;
    else this.visualY += (y - this.visualY) * (1 - Math.exp(-dt * 22));
    this.root.position.set(x, this.visualY, z);
    this.root.rotation.y = yaw;
  }

  dispose() {
    this.root.removeFromParent();
    for (const m of Object.values(this.mats)) m.dispose();
    this.hatSlot.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    this.hairSlot.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    for (const s of [this.tag, this.bubble]) if (s) { s.material.map.dispose(); s.material.dispose(); }
  }
}
