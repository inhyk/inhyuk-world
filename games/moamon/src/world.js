// 모아몬 마을: 끝없이 이어지는 블록 마을, 하늘과 날씨, 탐험가, 별샘과 도장
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, hash2, ELEMENTS } from '../core.mjs';

export const S = 44, LAND = 36; // 블록 한 칸 크기와 그 안의 땅 크기 (m)
const VIEW = 4;

// ---------- 합쳐 그리기용 기본 모양 ----------
const prep = (g) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); return n; };
const B = {
  box: prep(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)),
  cyl: prep(new THREE.CylinderGeometry(1, 1, 1, 10).translate(0, 0.5, 0)),
  cone: prep(new THREE.ConeGeometry(1, 1, 8).translate(0, 0.5, 0)),
  pyr: prep(new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0)),
  ico: prep(new THREE.IcosahedronGeometry(1, 1)),
  rock: prep(new THREE.DodecahedronGeometry(1, 0)),
  disc: prep(new THREE.CylinderGeometry(1, 1, 1, 28).translate(0, 0.5, 0)),
  roof: (() => { const p = [-1, 0, 1, 1, 0, 1, 1, 1, 0, -1, 0, 1, 1, 1, 0, -1, 1, 0, 1, 0, -1, -1, 0, -1, -1, 1, 0, 1, 0, -1, -1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, -1, 1, 1, 0, -1, 0, -1, -1, 0, 1, -1, 1, 0]; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); return g; })(),
};
const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), ee = new THREE.Euler(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), cc = new THREE.Color();
class Batch {
  constructor() { this.geos = []; }
  add(geo, color, p, s, ry = 0, rx = 0, rz = 0) {
    const g = geo.clone(); ee.set(rx, ry, rz); qq.setFromEuler(ee);
    m4.compose(v1.set(p[0], p[1], p[2]), qq, typeof s === 'number' ? v2.set(s, s, s) : v2.set(s[0], s[1], s[2])); g.applyMatrix4(m4);
    cc.set(color); const n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); this.geos.push(g);
  }
  mesh(material) { if (!this.geos.length) return null; const g = mergeGeometries(this.geos, false); for (const x of this.geos) x.dispose(); const m = new THREE.Mesh(g, material); return m; }
}
function tint(color, r, amt = 0.06) { cc.set(color); const h = {}; cc.getHSL(h); cc.setHSL(h.h + (r() - 0.5) * amt * 0.5, h.s, Math.max(0, Math.min(1, h.l + (r() - 0.5) * amt * 2))); return '#' + cc.getHexString(); }

// ---------- 블록 종류 ----------
export function blockType(i, j) {
  if (i === 0 && j === 0) return 'plaza';
  if (i === 1 && j === -1) return 'arena';
  if (i === 0 && j === 1) return 'park';
  if (i === -1 && j === 0) return 'lake';
  if (i === 1 && j === 0) return 'house';
  if (hash2(i, j, 5) % 12 === 0) return 'arena';
  const r = hash2(i, j, 1) % 100;
  return r < 22 ? 'park' : r < 38 ? 'forest' : r < 58 ? 'house' : r < 72 ? 'shop' : r < 85 ? 'lake' : 'plaza';
}
export const biomeOf = (t) => (t === 'arena' ? 'plaza' : t);
const STOP_NAMES = ['무지개 분수', '시계탑 광장', '고양이 동상', '오래된 우체통', '별빛 벤치', '솜사탕 가게 간판', '꼬마 도서관', '바람개비 언덕', '소원 나무', '종이배 연못', '달팽이 놀이터', '햇살 정자', '도토리 조각상', '풍선 가로등', '노래하는 계단', '숨바꼭질 담장'];
const ARENA_NAMES = ['새벽', '은하수', '솔바람', '무지개', '도토리', '반딧불', '파랑새', '해바라기', '구름다리', '별똥별'];
export const stopName = (i, j) => STOP_NAMES[hash2(i, j, 21) % STOP_NAMES.length];
export const arenaName = (i, j) => ARENA_NAMES[hash2(i, j, 22) % ARENA_NAMES.length] + ' 도장';
export const hasStop = (i, j, t) => t === 'plaza' || (t === 'park' && hash2(i, j, 9) % 100 < 55) || (t === 'shop' && hash2(i, j, 9) % 100 < 35);

const HOUSE_WALL = ['#fff3dc', '#ffe1d0', '#e3f1ff', '#f3e6ff', '#e4f7e1', '#fff0b8'];
const HOUSE_ROOF = ['#e8604a', '#4a8fd9', '#f0a030', '#7a5ad0', '#3fae7a', '#d9507a'];
const SHOP_COL = ['#ffd9a0', '#bfe3ff', '#ffc4d6', '#c9f0c0', '#e6d4ff'];
const FLOWER = ['#ff7aa8', '#ffd84a', '#ffffff', '#b98aff', '#ff9a4a'];

function tree(b, r, x, z, kind, solids) {
  const s = 0.8 + r() * 0.6;
  if (kind === 'pine') { b.add(B.cyl, '#7a5638', [x, 0, z], [0.22 * s, 1.1 * s, 0.22 * s]); const g = tint('#2f8f5a', r); for (let i = 0; i < 3; i++) b.add(B.cone, g, [x, (0.9 + i * 1.0) * s, z], [(1.5 - i * 0.38) * s, 1.7 * s, (1.5 - i * 0.38) * s], r() * 3); }
  else if (kind === 'blossom') { b.add(B.cyl, '#8a5a40', [x, 0, z], [0.2 * s, 1.6 * s, 0.2 * s]); const g = tint('#ffb3d0', r); b.add(B.ico, g, [x, 2.5 * s, z], [1.5 * s, 1.25 * s, 1.5 * s], r() * 3); b.add(B.ico, tint('#ffc9de', r), [x + 0.8 * s, 2.0 * s, z + 0.3 * s], 0.9 * s, r() * 3); b.add(B.ico, g, [x - 0.7 * s, 2.1 * s, z - 0.4 * s], 0.85 * s, r() * 3); }
  else { b.add(B.cyl, '#8a6240', [x, 0, z], [0.24 * s, 1.5 * s, 0.24 * s]); const g = tint(kind === 'autumn' ? '#f0a03c' : '#4fb85f', r, 0.08); b.add(B.ico, g, [x, 2.5 * s, z], [1.6 * s, 1.4 * s, 1.6 * s], r() * 3); b.add(B.ico, tint(kind === 'autumn' ? '#f5b85a' : '#6fd070', r), [x + 0.7 * s, 3.2 * s, z + 0.2 * s], 1.0 * s, r() * 3); b.add(B.ico, g, [x - 0.8 * s, 2.0 * s, z - 0.3 * s], 0.9 * s, r() * 3); }
  solids.push({ x, z, r: 0.45 * s });
}
function lamp(b, glow, x, z) { glow.pool.add(B.disc, '#ffffff', [x, 0.2, z], [3.2, 0.01, 3.2]); b.add(B.cyl, '#4a5568', [x, 0, z], [0.09, 3.2, 0.09]); b.add(B.cyl, '#4a5568', [x, 3.2, z], [0.32, 0.1, 0.32]); glow.add(B.ico, '#ffffff', [x, 3.0, z], 0.24); }
function bench(b, x, z, ry) { b.add(B.box, '#b9824f', [x, 0.38, z], [1.7, 0.1, 0.5], ry); b.add(B.box, '#b9824f', [x - Math.sin(ry) * 0.22, 0.5, z - Math.cos(ry) * 0.22], [1.7, 0.42, 0.08], ry); b.add(B.box, '#5a6270', [x, 0, z], [1.5, 0.38, 0.1], ry); }
function flowers(b, r, x, z, n = 6, rad = 1.4) { for (let i = 0; i < n; i++) { const a = r() * 6.28, d = r() * rad; const fx = x + Math.cos(a) * d, fz = z + Math.sin(a) * d; b.add(B.cyl, '#4fa648', [fx, 0, fz], [0.03, 0.3, 0.03]); b.add(B.ico, FLOWER[Math.floor(r() * FLOWER.length)], [fx, 0.34, fz], 0.13); } }
function bush(b, r, x, z) { const s = 0.5 + r() * 0.35; b.add(B.ico, tint('#3fa858', r), [x, 0.35 * s, z], [s * 1.2, s * 0.8, s * 1.2], r() * 3); }

function house(b, win, r, x, z, ry, solids) {
  const w = 4.2 + r() * 1.2, d = 3.8 + r() * 0.8, h = 2.5 + r() * 0.5 + (r() < 0.3 ? 2.2 : 0);
  const wall = HOUSE_WALL[Math.floor(r() * HOUSE_WALL.length)], roof = HOUSE_ROOF[Math.floor(r() * HOUSE_ROOF.length)];
  b.add(B.box, '#b0a394', [x, 0, z], [w + 0.2, 0.25, d + 0.2], ry); b.add(B.box, wall, [x, 0.2, z], [w, h, d], ry);
  b.add(B.roof, roof, [x, h + 0.2, z], [w / 2 + 0.35, 1.5, d / 2 + 0.35], ry);
  const fx = Math.sin(ry), fz = Math.cos(ry), sx = Math.cos(ry), sz = -Math.sin(ry);
  b.add(B.box, '#8a5a3c', [x + fx * (d / 2 + 0.02), 0.2, z + fz * (d / 2 + 0.02)], [0.9, 1.7, 0.1], ry);
  b.add(B.box, '#d9d0c0', [x + fx * (d / 2 + 0.5), 0, z + fz * (d / 2 + 0.5)], [1.3, 0.14, 0.9], ry);
  for (let f = 0; f < Math.floor(h / 2.3); f++) for (const k of [-1, 1]) { win.add(B.box, '#ffffff', [x + fx * (d / 2 + 0.03) + sx * k * w * 0.3, 1.0 + f * 2.2 + (f ? 0.3 : 0), z + fz * (d / 2 + 0.03) + sz * k * w * 0.3], [0.85, 0.85, 0.08], ry); win.add(B.box, '#ffffff', [x + sx * k * (w / 2 + 0.03), 1.0 + f * 2.2 + (f ? 0.3 : 0), z + sz * k * (w / 2 + 0.03)], [0.08, 0.85, 0.9], ry); }
  b.add(B.box, '#9c6f5a', [x + sx * w * 0.25, h + 0.6, z + sz * w * 0.25], [0.5, 1.5, 0.5], ry);
  solids.push({ x, z, hw: (Math.abs(sx) > 0.5 ? w : d) / 2 + 0.2, hd: (Math.abs(sx) > 0.5 ? d : w) / 2 + 0.2 });
}
function shop(b, win, glow, r, x, z, ry, solids) {
  const w = 7 + r() * 3, d = 6 + r() * 2, floors = 1 + Math.floor(r() * 3), h = floors * 2.7 + 0.6;
  const col = SHOP_COL[Math.floor(r() * SHOP_COL.length)], aw = HOUSE_ROOF[Math.floor(r() * HOUSE_ROOF.length)];
  b.add(B.box, tint(col, r), [x, 0, z], [w, h, d], ry); b.add(B.box, '#f4efe6', [x, h, z], [w + 0.4, 0.3, d + 0.4], ry); b.add(B.box, '#c9c0b0', [x, h + 0.3, z], [w * 0.3, 0.6, d * 0.3], ry);
  const fx = Math.sin(ry), fz = Math.cos(ry), sx = Math.cos(ry), sz = -Math.sin(ry);
  for (let k = -2; k <= 2; k++) b.add(B.box, k % 2 ? '#ffffff' : aw, [x + fx * (d / 2 + 0.5) + sx * k * w * 0.18, 2.3, z + fz * (d / 2 + 0.5) + sz * k * w * 0.18], [w * 0.18, 0.14, 1.1], ry, 0.3);
  win.add(B.box, '#ffffff', [x + fx * (d / 2 + 0.03), 0.4, z + fz * (d / 2 + 0.03)], [w * 0.8, 1.7, 0.08], ry);
  for (let f = 1; f < floors; f++) for (let k = -1; k <= 1; k++) win.add(B.box, '#ffffff', [x + fx * (d / 2 + 0.03) + sx * k * w * 0.28, 0.9 + f * 2.7, z + fz * (d / 2 + 0.03) + sz * k * w * 0.28], [1.2, 1.2, 0.08], ry);
  glow.add(B.box, '#ffffff', [x + fx * (d / 2 + 0.1), h - 0.75, z + fz * (d / 2 + 0.1)], [w * 0.5, 0.5, 0.12], ry);
  solids.push({ x, z, hw: (Math.abs(sx) > 0.5 ? w : d) / 2 + 0.2, hd: (Math.abs(sx) > 0.5 ? d : w) / 2 + 0.2 });
}

// 블록 한 칸을 만든다
function makeBlock(i, j, M) {
  const type = blockType(i, j), r = rng(hash2(i, j, 77)), g = new THREE.Group(); g.position.set(i * S, 0, j * S);
  const b = new Batch(), win = new Batch(), glow = new Batch(), solids = [], H = LAND / 2; glow.pool = new Batch();
  const ground = { park: '#8fd66b', forest: '#6fbf5a', house: '#9bdc7a', shop: '#dcd4c6', lake: '#ecdba6', plaza: '#ead9bd', arena: '#d9cdb8' }[type];
  b.add(B.box, '#f1eadc', [0, 0, 0], [LAND + 1.6, 0.14, LAND + 1.6]); b.add(B.box, ground, [0, 0.06, 0], [LAND - 0.6, 0.14, LAND - 0.6]);
  for (let k = -2; k <= 2; k++) { b.add(B.box, '#f6f8fb', [S / 2, 0.005, k * 7.4], [0.22, 0.02, 3]); b.add(B.box, '#f6f8fb', [k * 7.4, 0.005, S / 2], [3, 0.02, 0.22]); }
  for (let k = -3; k <= 3; k++) { b.add(B.box, '#f6f8fb', [S / 2 + k * 0.9, 0.006, H + 1.3], [0.45, 0.02, 1.6]); b.add(B.box, '#f6f8fb', [H + 1.3, 0.006, S / 2 + k * 0.9], [1.6, 0.02, 0.45]); }
  const poi = hasStop(i, j, type) ? { type: 'stop', x: i * S, z: j * S, key: i + ',' + j, name: stopName(i, j) } : type === 'arena' ? { type: 'arena', x: i * S, z: j * S, key: i + ',' + j, name: arenaName(i, j), seed: hash2(i, j, 3) } : null;
  const free = (x, z, rad) => !solids.some((s) => (s.r ? Math.hypot(s.x - x, s.z - z) < s.r + rad : Math.abs(s.x - x) < s.hw + rad && Math.abs(s.z - z) < s.hd + rad)) && (!poi || Math.hypot(x, z) > 3.5 + rad);
  const scatter = (n, rad, fn, range = H - 1.5) => { for (let k = 0, t = 0; k < n && t < n * 8; t++) { const x = (r() * 2 - 1) * range, z = (r() * 2 - 1) * range; if (free(x, z, rad)) { fn(x, z); k++; } } };
  let water = null;

  if (type === 'park') {
    b.add(B.box, '#f0e2c0', [0, 0.08, 0], [LAND - 1, 0.14, 2.2]); b.add(B.box, '#f0e2c0', [0, 0.08, 0], [2.2, 0.14, LAND - 1]); b.add(B.disc, '#f0e2c0', [0, 0.08, 0], [4.6, 0.14, 4.6]);
    const kinds = ['round', 'round', 'blossom', 'autumn'], kind = kinds[hash2(i, j, 4) % 4];
    scatter(7 + Math.floor(r() * 4), 1.6, (x, z) => { if (Math.abs(x) > 2.4 && Math.abs(z) > 2.4) tree(b, r, x, z, r() < 0.7 ? kind : 'round', solids); });
    scatter(8, 0.5, (x, z) => { if (Math.abs(x) > 1.6 && Math.abs(z) > 1.6) flowers(b, r, x, z); });
    scatter(6, 0.8, (x, z) => { if (Math.abs(x) > 1.8 && Math.abs(z) > 1.8) bush(b, r, x, z); });
    for (const [x, z, ry] of [[5.6, 2, Math.PI / 2], [-5.6, -2, -Math.PI / 2], [2, -5.6, 0]]) bench(b, x, z, ry);
    for (const [x, z] of [[4, 4], [-4, -4], [4, -4], [-4, 4]]) lamp(b, glow, x, z);
  } else if (type === 'forest') {
    scatter(20, 1.3, (x, z) => tree(b, r, x, z, r() < 0.6 ? 'pine' : 'round', solids));
    scatter(8, 0.5, (x, z) => { const s = 0.3 + r() * 0.5; b.add(B.rock, tint('#9a9a9a', r), [x, s * 0.3, z], [s, s * 0.7, s], r() * 3); });
    scatter(8, 0.4, (x, z) => { b.add(B.cyl, '#fff1d6', [x, 0, z], [0.07, 0.25, 0.07]); b.add(B.cone, r() < 0.5 ? '#e8543f' : '#f0a03c', [x, 0.22, z], [0.22, 0.18, 0.22]); });
    scatter(10, 0.6, (x, z) => bush(b, r, x, z)); scatter(5, 0.5, (x, z) => flowers(b, r, x, z, 4, 1));
    scatter(2, 1, (x, z) => { b.add(B.cyl, '#8a6240', [x, 0.3, z], [0.32, 2.2, 0.32], r() * 3, Math.PI / 2); });
  } else if (type === 'house') {
    const q = 8.6; for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) house(b, win, r, sx * q + (r() - 0.5) * 2, sz * q + (r() - 0.5) * 2, sz > 0 ? 0 : Math.PI, solids);
    b.add(B.box, '#e4d8c2', [0, 0.08, 0], [LAND - 1, 0.14, 2]);
    for (let k = -4; k <= 4; k++) if (k) { b.add(B.box, '#ffffff', [k * 3.8, 0.1, H - 0.9], [0.1, 0.7, 0.1]); b.add(B.box, '#ffffff', [k * 3.8, 0.1, -H + 0.9], [0.1, 0.7, 0.1]); }
    b.add(B.box, '#ffffff', [0, 0.55, H - 0.9], [LAND - 5, 0.1, 0.06]); b.add(B.box, '#ffffff', [0, 0.55, -H + 0.9], [LAND - 5, 0.1, 0.06]);
    scatter(5, 1.4, (x, z) => { if (Math.abs(z) > 2) tree(b, r, x, z, r() < 0.4 ? 'blossom' : 'round', solids); });
    scatter(6, 0.5, (x, z) => { if (Math.abs(z) > 1.5) flowers(b, r, x, z, 5, 0.9); }); scatter(5, 0.7, (x, z) => { if (Math.abs(z) > 1.5) bush(b, r, x, z); });
    lamp(b, glow, 15, 1.6); lamp(b, glow, -15, -1.6);
  } else if (type === 'shop') {
    shop(b, win, glow, r, -8.5, -8, 0, solids); shop(b, win, glow, r, 8.5, -8.5, 0, solids); shop(b, win, glow, r, hasStop(i, j, type) ? -9 : 0, 9.5, Math.PI, solids);
    if (hasStop(i, j, type)) shop(b, win, glow, r, 9.5, 9.5, Math.PI, solids);
    for (const [x, z] of [[-15, 0], [-5, 0.8], [5, -0.8], [15, 0]]) { lamp(b, glow, x, z); }
    scatter(4, 1.2, (x, z) => { b.add(B.box, '#b98a5a', [x, 0, z], [1.1, 0.6, 1.1]); b.add(B.ico, tint('#4fb85f', r), [x, 1.2, z], 0.75, r() * 3); solids.push({ x, z, r: 0.7 }); });
  } else if (type === 'lake') {
    b.add(B.disc, '#d8c58c', [0, 0.1, 0], [15.4, 0.12, 15.4]);
    water = new THREE.Mesh(M.waterGeo, M.water); water.position.set(0, 0.24, 0); water.scale.set(14, 1, 14); g.add(water); solids.push({ x: 0, z: 0, r: 13.4, water: 1 });
    for (let k = 0; k < 9; k++) { const a = r() * 6.28, d = r() * 11; b.add(B.disc, tint('#4fb85f', r), [Math.cos(a) * d, 0.25, Math.sin(a) * d], [0.5 + r() * 0.4, 0.04, 0.5 + r() * 0.4]); if (r() < 0.4) b.add(B.ico, '#ff9ad0', [Math.cos(a) * d, 0.36, Math.sin(a) * d], 0.16); }
    for (let k = 0; k < 16; k++) { const a = r() * 6.28, d = 13.2 + r() * 1.2, x = Math.cos(a) * d, z = Math.sin(a) * d; for (let q = 0; q < 3; q++) b.add(B.cyl, tint('#5aa84a', r), [x + q * 0.14, 0.1, z + (q % 2) * 0.12], [0.035, 0.9 + r() * 0.7, 0.035]); if (r() < 0.5) b.add(B.cyl, '#7a5234', [x, 1.0, z], [0.07, 0.4, 0.07]); }
    for (let k = 0; k < 7; k++) { const a = r() * 6.28, s = 0.4 + r() * 0.6; b.add(B.rock, tint('#a3a3a8', r), [Math.cos(a) * 14.2, 0.2, Math.sin(a) * 14.2], [s, s * 0.7, s], r() * 3); }
    b.add(B.box, '#b9824f', [0, 0.3, 14.5], [2.2, 0.14, 6]); for (const sx of [-1, 1]) for (const z of [12, 14.5, 17]) b.add(B.cyl, '#8a6240', [sx * 1.05, 0, z], [0.12, 0.7, 0.12]);
    for (const [x, z] of [[16, 16], [-16, 16], [16, -16], [-16, -16]]) tree(b, r, x, z, 'round', solids);
    scatter(5, 0.5, (x, z) => { if (Math.hypot(x, z) > 15.6) flowers(b, r, x, z, 4, 0.8); });
  } else {
    // 광장과 도장 바닥
    const c1 = type === 'arena' ? '#cbbfa8' : '#f4e6cc';
    for (let k = 0; k < 4; k++) b.add(B.disc, k % 2 ? c1 : type === 'arena' ? '#b9ad96' : '#e0cda8', [0, 0.1 + k * 0.012, 0], [13 - k * 3, 0.1, 13 - k * 3]);
    for (const [x, z] of [[14, 14], [-14, 14], [14, -14], [-14, -14]]) { b.add(B.box, '#b98a5a', [x, 0, z], [3, 0.6, 3]); tree(b, r, x, z, type === 'arena' ? 'pine' : 'blossom', solids); flowers(b, r, x, z, 6, 1.2); }
    for (const [x, z] of [[9, 0], [-9, 0], [0, 9], [0, -9]]) lamp(b, glow, x * 1.25, z * 1.25);
    if (type === 'plaza') for (const [x, z, ry] of [[7.5, 7.5, -0.78], [-7.5, 7.5, 0.78], [7.5, -7.5, -2.36], [-7.5, -7.5, 2.36]]) bench(b, x, z, ry);
  }
  if (poi) solids.push({ x: 0, z: 0, r: poi.type === 'arena' ? 4.2 : 1.3 });
  const mesh = b.mesh(M.land); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
  const wm = win.mesh(M.window); if (wm) g.add(wm);
  const gm = glow.mesh(M.glow); if (gm) g.add(gm); const pm = glow.pool.mesh(M.pool); if (pm) { pm.renderOrder = 2; g.add(pm); }
  for (const s of solids) { s.x += i * S; s.z += j * S; }
  return { i, j, type, group: g, solids, poi, water };
}

// ---------- 별샘과 도장 ----------
const PG = { sph: new THREE.SphereGeometry(1, 20, 14), cyl: new THREE.CylinderGeometry(1, 1, 1, 24), ring: new THREE.TorusGeometry(1, 0.08, 8, 40), oct: new THREE.OctahedronGeometry(1, 0), cone: new THREE.ConeGeometry(1, 1, 6), hit: new THREE.SphereGeometry(1, 8, 6) };
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
function buildStop(poi) {
  const g = new THREE.Group(); g.position.set(poi.x, 0, poi.z);
  const stone = new THREE.MeshStandardMaterial({ color: '#f4f0ea', roughness: 0.7 });
  const m = (geo, mat, p, s) => { const x = new THREE.Mesh(geo, mat); x.position.set(...p); typeof s === 'number' ? x.scale.setScalar(s) : x.scale.set(...s); x.castShadow = true; g.add(x); return x; };
  m(PG.cyl, stone, [0, 0.2, 0], [1.5, 0.4, 1.5]); m(PG.cyl, stone, [0, 0.55, 0], [1.1, 0.3, 1.1]); m(PG.cyl, stone, [0, 1.7, 0], [0.16, 2.2, 0.16]);
  const live = new THREE.MeshStandardMaterial({ color: '#3fd8e8', emissive: '#19b8d8', emissiveIntensity: 0.9, roughness: 0.25 });
  const basin = m(PG.cyl, live, [0, 0.72, 0], [0.9, 0.06, 0.9]);
  const star = m(PG.oct, live, [0, 3.6, 0], [0.6, 0.85, 0.6]); const r1 = m(PG.ring, live, [0, 3.6, 0], 1.0); const r2 = m(PG.ring, live, [0, 3.6, 0], 1.25);
  const hit = new THREE.Mesh(PG.hit, hitMat); hit.position.y = 2.2; hit.scale.set(2, 3, 2); hit.userData.pick = { type: 'stop', poi }; g.add(hit);
  g.userData = { poi, hit, ready: true, spin: 0, update(t, dt) { this.spin = Math.max(0, this.spin - dt); const sp = 0.8 + this.spin * 14; star.rotation.y += dt * sp; r1.rotation.x = Math.PI / 2 + Math.sin(t) * 0.3; r1.rotation.y += dt * sp * 0.6; r2.rotation.x = t * 0.7; r2.rotation.z += dt * sp * 0.4; star.position.y = 3.6 + Math.sin(t * 1.7) * 0.15; basin.scale.x = basin.scale.z = 0.9 + Math.sin(t * 2) * 0.03; }, setReady(v) { if (v === this.ready) return; this.ready = v; live.color.set(v ? '#3fd8e8' : '#c79aff'); live.emissive.set(v ? '#19b8d8' : '#8a5ad0'); live.emissiveIntensity = v ? 0.9 : 0.5; } };
  return g;
}
function buildArena(poi, el) {
  const g = new THREE.Group(); g.position.set(poi.x, 0, poi.z); const col = ELEMENTS[el].color;
  const stone = new THREE.MeshStandardMaterial({ color: '#efe9df', roughness: 0.75, flatShading: true }), dark = new THREE.MeshStandardMaterial({ color: '#5a5f78', roughness: 0.6 });
  const live = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.55, roughness: 0.3 });
  const m = (geo, mat, p, s, parent = g) => { const x = new THREE.Mesh(geo, mat); x.position.set(...p); typeof s === 'number' ? x.scale.setScalar(s) : x.scale.set(...s); x.castShadow = true; x.receiveShadow = true; parent.add(x); return x; };
  m(PG.cyl, stone, [0, 0.3, 0], [4.2, 0.6, 4.2]); m(PG.cyl, dark, [0, 0.75, 0], [3.4, 0.3, 3.4]); m(PG.cyl, live, [0, 0.92, 0], [3.0, 0.06, 3.0]); m(PG.cyl, stone, [0, 3.2, 0], [1.3, 4.6, 1.3]); m(PG.cyl, dark, [0, 5.7, 0], [1.7, 0.4, 1.7]);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; m(PG.cyl, stone, [Math.cos(a) * 3.3, 2.2, Math.sin(a) * 3.3], [0.28, 3.4, 0.28]); m(PG.cone, live, [Math.cos(a) * 3.3, 4.3, Math.sin(a) * 3.3], [0.45, 0.9, 0.45]); }
  m(PG.cone, dark, [0, 6.9, 0], [2.0, 2.0, 2.0]);
  const gem = m(PG.oct, live, [0, 9.2, 0], [0.9, 1.3, 0.9]); const ring = m(PG.ring, live, [0, 9.2, 0], 1.7);
  const hit = new THREE.Mesh(PG.hit, hitMat); hit.position.y = 4; hit.scale.set(4.5, 6, 4.5); hit.userData.pick = { type: 'arena', poi }; g.add(hit);
  g.userData = { poi, hit, update(t, dt) { gem.rotation.y += dt * 1.2; gem.position.y = 9.2 + Math.sin(t * 1.5) * 0.25; ring.rotation.x = Math.PI / 2 + Math.sin(t * 0.8) * 0.4; ring.rotation.y += dt * 0.8; } };
  return g;
}

// ---------- 탐험가 ----------
export function buildAvatar() {
  const g = new THREE.Group(); const mk = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
  const skin = mk('#ffd9b8'), coat = mk('#ff6b5a'), pants = mk('#3d4f8f'), shoe = mk('#ffffff'), hair = mk('#4a3324'), hat = mk('#3fb8e8'), pack = mk('#ffc83a');
  const sph = PG.sph, cyl = PG.cyl;
  const m = (geo, mat, p, s, parent = g) => { const x = new THREE.Mesh(geo, mat); x.position.set(...p); typeof s === 'number' ? x.scale.setScalar(s) : x.scale.set(...s); x.castShadow = true; parent.add(x); return x; };
  const hips = new THREE.Group(); g.add(hips);
  const legs = [-1, 1].map((sd) => { const l = new THREE.Group(); l.position.set(sd * 0.16, 0.72, 0); hips.add(l); m(cyl, pants, [0, -0.3, 0], [0.13, 0.6, 0.13], l); m(sph, shoe, [0, -0.64, 0.06], [0.15, 0.1, 0.22], l); return l; });
  const torso = new THREE.Group(); torso.position.y = 0.72; hips.add(torso);
  m(sph, coat, [0, 0.36, 0], [0.33, 0.42, 0.25], torso); m(cyl, mk('#ffffff'), [0, 0.08, 0], [0.31, 0.1, 0.24], torso); m(sph, pack, [0, 0.4, -0.27], [0.24, 0.28, 0.14], torso); m(sph, mk('#f29a1a'), [0, 0.36, -0.39], [0.13, 0.11, 0.05], torso);
  const arms = [-1, 1].map((sd) => { const a = new THREE.Group(); a.position.set(sd * 0.36, 0.62, 0); torso.add(a); m(cyl, coat, [0, -0.2, 0], [0.09, 0.42, 0.09], a); m(sph, skin, [0, -0.45, 0], 0.1, a); return a; });
  const head = new THREE.Group(); head.position.y = 0.98; torso.add(head);
  m(sph, skin, [0, 0.3, 0], [0.34, 0.33, 0.32], head); m(sph, hair, [0, 0.36, -0.06], [0.36, 0.32, 0.33], head); m(sph, hat, [0, 0.48, 0], [0.36, 0.22, 0.35], head); m(cyl, hat, [0, 0.43, 0.3], [0.24, 0.04, 0.2], head); m(sph, mk('#ffffff'), [0, 0.52, 0.3], [0.1, 0.08, 0.05], head);
  const eye = mk('#2a2030', { roughness: 0.2 }); for (const sd of [-1, 1]) { m(sph, eye, [sd * 0.13, 0.29, 0.29], [0.045, 0.07, 0.03], head); m(sph, mk('#ff9db0'), [sd * 0.22, 0.2, 0.25], [0.06, 0.04, 0.02], head); }
  let phase = 0, blend = 0;
  g.userData.update = (dt, speed) => { blend += ((speed > 0.3 ? 1 : 0) - blend) * Math.min(1, dt * 10); phase += dt * (5 + speed * 1.3); const s = Math.sin(phase) * blend; legs[0].rotation.x = s * 0.9; legs[1].rotation.x = -s * 0.9; arms[0].rotation.x = -s * 0.8; arms[1].rotation.x = s * 0.8; arms[0].rotation.z = -0.12; arms[1].rotation.z = 0.12; hips.position.y = Math.abs(Math.cos(phase)) * 0.06 * blend + Math.sin(phase * 0.2) * 0.008; torso.rotation.x = 0.1 * blend; head.rotation.y = Math.sin(phase * 0.13) * 0.2 * (1 - blend); };
  return g;
}

// ---------- 마을 ----------
const MOODS = {
  day: { top: '#3d9eff', hor: '#d4f0ff', sun: '#fff3d4', si: 3.0, hemi: '#e6f4ff', gnd: '#c2cf96', hi: 1.25, road: '#8d99ab', win: '#5d7ea8', wi: 0, expo: 1.0 },
  dusk: { top: '#5566cc', hor: '#ffc59a', sun: '#ffac6a', si: 2.3, hemi: '#ffd9c4', gnd: '#b9a58c', hi: 0.95, road: '#8a8a9c', win: '#ffd27a', wi: 0.9, expo: 1.0 },
  night: { top: '#0a1036', hor: '#33469a', sun: '#b9ccff', si: 1.5, hemi: '#93a6ff', gnd: '#4a5690', hi: 1.15, road: '#5a6690', win: '#ffd27a', wi: 1.6, expo: 1.05 },
};
export function moodAt(ms) { const h = new Date(ms).getHours(); return h >= 19 || h < 5 ? 'night' : h >= 17 || h < 7 ? 'dusk' : 'day'; }

export class World {
  constructor() {
    const sc = (this.scene = new THREE.Scene());
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 900);
    this.M = {
      land: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }),
      window: new THREE.MeshStandardMaterial({ color: '#5d7ea8', roughness: 0.2, emissive: '#ffd27a', emissiveIntensity: 0 }),
      glow: new THREE.MeshStandardMaterial({ color: '#fffbe8', roughness: 0.4, emissive: '#ffe9a8', emissiveIntensity: 0 }),
      pool: new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
      water: new THREE.MeshStandardMaterial({ color: '#49b8f0', roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.9 }),
      waterGeo: new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2),
    };
    this.M.water.onBeforeCompile = (s) => { s.uniforms.uT = this.uT; s.vertexShader = 'uniform float uT;\n' + s.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = vec3(position); transformed.y += sin(position.x*9.0+uT*1.6)*0.04 + cos(position.z*11.0+uT*1.2)*0.04;'); s.fragmentShader = 'uniform float uT;\n' + s.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n float w = sin(vViewPosition.x*1.3+uT*1.4)*sin(vViewPosition.z*1.7-uT)*0.5+0.5; diffuseColor.rgb += vec3(0.10,0.12,0.12)*smoothstep(0.75,1.0,w);'); };
    this.uT = { value: 0 };
    // 하늘
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(700, 24, 14), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() } }, vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }', fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y*1.6+0.05,0.0,1.0); gl_FragColor = vec4(mix(hor, top, pow(h,0.7)),1.0);\n#include <colorspace_fragment>\n }' }));
    sc.add(this.sky); sc.fog = new THREE.Fog('#d4f0ff', 70, 185);
    const sp = new Float32Array(900); for (let k = 0; k < 300; k++) { const a = Math.random() * 6.28, y = 0.15 + Math.random() * 0.85, rr = Math.sqrt(1 - y * y); sp.set([Math.cos(a) * rr * 600, y * 600, Math.sin(a) * rr * 600], k * 3); }
    this.stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(sp, 3)), new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0 })); sc.add(this.stars);
    this.hemi = new THREE.HemisphereLight('#e6f4ff', '#c2cf96', 1.2); sc.add(this.hemi);
    const sun = (this.sun = new THREE.DirectionalLight('#fff3d4', 3)); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const c = sun.shadow.camera; c.left = c.bottom = -55; c.right = c.top = 55; c.near = 1; c.far = 220; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.06; sc.add(sun, sun.target);
    // 길 바닥
    this.road = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#8d99ab', roughness: 0.95 })); this.road.receiveShadow = true; sc.add(this.road);
    // 구름
    this.clouds = new THREE.Group(); sc.add(this.clouds); const cm = (this.cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true, fog: false, transparent: true, opacity: 0.95 }));
    for (let k = 0; k < 14; k++) { const cg = new THREE.Group(); for (let q = 0; q < 5; q++) { const m = new THREE.Mesh(B.ico, cm); m.position.set((q - 2) * 7 + Math.random() * 3, Math.random() * 3, Math.random() * 6); m.scale.set(7 + Math.random() * 5, 4 + Math.random() * 2, 6 + Math.random() * 3); cg.add(m); } cg.position.set((Math.random() - 0.5) * 500, 70 + Math.random() * 30, (Math.random() - 0.5) * 500); this.clouds.add(cg); }
    // 비
    const rp = new Float32Array(1500 * 3); for (let k = 0; k < 1500; k++) rp.set([(Math.random() - 0.5) * 60, Math.random() * 30, (Math.random() - 0.5) * 60], k * 3);
    this.rain = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(rp, 3)), new THREE.PointsMaterial({ color: '#cfe8ff', size: 0.16, transparent: true, opacity: 0.75 })); this.rain.visible = false; this.rain.frustumCulled = false; sc.add(this.rain);
    // 탐험가와 표시
    this.player = buildAvatar(); sc.add(this.player); this.pos = this.player.position; this.heading = 0; this.speed = 0;
    this.pulse = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false })); sc.add(this.pulse);
    this.base = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false })); sc.add(this.base);
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.55, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffe04b', transparent: true, opacity: 0.9, depthWrite: false })); this.marker.visible = false; sc.add(this.marker);
    this.blocks = new Map(); this.pois = new Map(); this.pickables = []; this.actors = [];
    this.cam = { yaw: 0.5, pitch: 0.62, dist: 17, tx: 0, tz: 0 }; this.target = null; this.ray = new THREE.Raycaster(); this.t = 0;
    this.setMood('day', 'sunny');
  }
  setMood(mood, weather) {
    if (this.mood === mood && this.weather === weather) return; this.mood = mood; this.weather = weather;
    const m = MOODS[mood], gray = weather === 'rain' ? 0.5 : weather === 'cloudy' ? 0.3 : 0, g = new THREE.Color(mood === 'night' ? '#1a2038' : '#a9b4c2');
    const u = this.sky.material.uniforms; u.top.value.set(m.top).lerp(g, gray); u.hor.value.set(m.hor).lerp(g, gray * 0.7); this.scene.fog.color.copy(u.hor.value);
    this.sun.color.set(m.sun); this.sun.intensity = m.si * (1 - gray * 0.55); this.hemi.color.set(m.hemi); this.hemi.groundColor.set(m.gnd); this.hemi.intensity = m.hi * (1 + gray * 0.15);
    this.road.material.color.set(m.road); this.M.window.color.set(m.win); this.M.window.emissiveIntensity = m.wi; this.M.glow.emissiveIntensity = mood === 'day' ? 0 : 2.2; this.M.pool.opacity = mood === 'night' ? 0.1 : mood === 'dusk' ? 0.05 : 0; this.M.pool.visible = mood !== 'day';
    this.stars.material.opacity = mood === 'night' && !gray ? 0.9 : 0; this.rain.visible = weather === 'rain'; this.cloudMat.color.set(mood === 'night' ? '#3a4470' : mood === 'dusk' ? '#ffd9c4' : '#ffffff').lerp(g, gray);
    this.sunDir = mood === 'dusk' ? new THREE.Vector3(60, 28, 30) : mood === 'night' ? new THREE.Vector3(-30, 60, 25) : new THREE.Vector3(35, 70, 28);
    this.exposure = m.expo;
  }
  block(i, j) { return this.blocks.get(i + ',' + j); }
  ensureBlocks(limit = 2) {
    const bi = Math.round(this.pos.x / S), bj = Math.round(this.pos.z / S); let made = 0;
    for (let ring = 0; ring <= VIEW && made < limit; ring++) for (let i = bi - ring; i <= bi + ring && made < limit; i++) for (let j = bj - ring; j <= bj + ring && made < limit; j++) {
      const k = i + ',' + j; if (this.blocks.has(k)) continue;
      const b = makeBlock(i, j, this.M); this.blocks.set(k, b); this.scene.add(b.group); made++;
      if (b.poi) { const pg = b.poi.type === 'stop' ? buildStop(b.poi) : buildArena(b.poi, this.arenaEl ? this.arenaEl(b.poi) : 'leaf'); b.poiGroup = pg; this.scene.add(pg); this.pois.set(k, pg); this.pickables.push(pg.userData.hit); }
    }
    for (const [k, b] of this.blocks) if (Math.abs(b.i - bi) > VIEW + 1 || Math.abs(b.j - bj) > VIEW + 1) {
      this.scene.remove(b.group); b.group.traverse((o) => { if (o.geometry && o.geometry !== this.M.waterGeo) o.geometry.dispose(); }); this.blocks.delete(k);
      if (b.poiGroup) { this.scene.remove(b.poiGroup); this.pois.delete(k); this.pickables.splice(this.pickables.indexOf(b.poiGroup.userData.hit), 1); }
    }
    return made;
  }
  biomeAt(x, z) { return biomeOf(blockType(Math.round(x / S), Math.round(z / S))); }
  // 벽과 나무, 물에 막히게 밀어낸다
  resolve(p, rad) {
    const bi = Math.round(p.x / S), bj = Math.round(p.z / S);
    for (let i = bi - 1; i <= bi + 1; i++) for (let j = bj - 1; j <= bj + 1; j++) { const b = this.block(i, j); if (!b) continue; for (const s of b.solids) {
      if (s.r) { const dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz), min = s.r + rad; if (d < min && d > 1e-4) { p.x = s.x + (dx / d) * min; p.z = s.z + (dz / d) * min; } }
      else { const dx = p.x - s.x, dz = p.z - s.z, ox = s.hw + rad - Math.abs(dx), oz = s.hd + rad - Math.abs(dz); if (ox > 0 && oz > 0) { if (ox < oz) p.x += Math.sign(dx || 1) * ox; else p.z += Math.sign(dz || 1) * oz; } }
    } }
  }
  isFree(x, z, rad) { const p = { x, z }; this.resolve(p, rad); return Math.abs(p.x - x) < 1e-3 && Math.abs(p.z - z) < 1e-3; }
  addActor(a) { this.actors.push(a); this.scene.add(a.group); if (a.hit) this.pickables.push(a.hit); }
  removeActor(a) { const k = this.actors.indexOf(a); if (k >= 0) this.actors.splice(k, 1); this.scene.remove(a.group); if (a.hit) { const q = this.pickables.indexOf(a.hit); if (q >= 0) this.pickables.splice(q, 1); } }
  pick(nx, ny) {
    this.ray.setFromCamera({ x: nx, y: ny }, this.camera);
    const hits = this.ray.intersectObjects(this.pickables, false);
    if (hits.length) return hits[0].object.userData.pick;
    const o = this.ray.ray.origin, d = this.ray.ray.direction; if (d.y >= -0.01) return null; const k = -o.y / d.y;
    return { type: 'ground', x: o.x + d.x * k, z: o.z + d.z * k };
  }
  walkTo(x, z) { this.target = { x, z, stuck: 0 }; this.marker.position.set(x, 0.3, z); this.marker.visible = true; }
  // input: 화면 기준 이동 방향 (x 오른쪽, y 앞)
  update(dt, input) {
    const t = (this.t += dt); this.uT.value = t; const p = this.pos; let mx = 0, mz = 0;
    if (input && (input.x || input.y)) { const sy = Math.sin(this.cam.yaw), cy = Math.cos(this.cam.yaw); mx = input.x * cy - input.y * sy; mz = -input.x * sy - input.y * cy; this.target = null; this.marker.visible = false; }
    else if (this.target) { const dx = this.target.x - p.x, dz = this.target.z - p.z, d = Math.hypot(dx, dz); if (d < 0.4 || this.target.stuck > 0.6) { this.target = null; this.marker.visible = false; } else { mx = dx / d; mz = dz / d; } }
    const len = Math.hypot(mx, mz); let moved = 0;
    if (len > 0.05) {
      const sp = 7 * Math.min(1, len), ox = p.x, oz = p.z; p.x += (mx / len) * sp * dt; p.z += (mz / len) * sp * dt; this.resolve(p, 0.45);
      moved = Math.hypot(p.x - ox, p.z - oz); if (this.target) this.target.stuck += moved < sp * dt * 0.3 ? dt : -this.target.stuck;
      const want = Math.atan2(mx, mz); let da = want - this.heading; da = Math.atan2(Math.sin(da), Math.cos(da)); this.heading += da * Math.min(1, dt * 12);
    }
    this.speed = moved / Math.max(dt, 1e-4); this.player.rotation.y = this.heading; this.player.userData.update(dt, this.speed);
    const k = (t % 2.6) / 2.6; this.pulse.position.set(p.x, 0.22, p.z); this.pulse.scale.setScalar(1 + k * 13); this.pulse.material.opacity = 0.5 * (1 - k); this.base.position.set(p.x, 0.23, p.z); this.marker.rotation.y = t * 2;
    // 카메라
    const c = this.cam; c.tx += (p.x - c.tx) * Math.min(1, dt * 8); c.tz += (p.z - c.tz) * Math.min(1, dt * 8);
    const cp = Math.cos(c.pitch), ty = 1.4 + c.dist * 0.05;
    this.camera.position.set(c.tx + Math.sin(c.yaw) * cp * c.dist, ty + Math.sin(c.pitch) * c.dist, c.tz + Math.cos(c.yaw) * cp * c.dist); this.camera.lookAt(c.tx, ty, c.tz);
    this.sky.position.copy(this.camera.position); this.stars.position.copy(this.camera.position);
    this.road.position.set(Math.round(p.x / S) * S, -0.02, Math.round(p.z / S) * S);
    this.sun.target.position.set(p.x, 0, p.z); this.sun.position.copy(this.sun.target.position).add(this.sunDir);
    for (const cg of this.clouds.children) { cg.position.x += dt * 1.6 * (this.weather === 'windy' ? 4 : 1); if (cg.position.x - p.x > 260) cg.position.x -= 520; if (cg.position.x - p.x < -260) cg.position.x += 520; if (cg.position.z - p.z > 260) cg.position.z -= 520; if (cg.position.z - p.z < -260) cg.position.z += 520; }
    if (this.rain.visible) { const a = this.rain.geometry.attributes.position; for (let q = 0; q < a.count; q++) { let y = a.getY(q) - dt * 26; if (y < 0) y += 30; a.setY(q, y); } a.needsUpdate = true; this.rain.position.set(p.x, 0, p.z); }
    for (const pg of this.pois.values()) pg.userData.update(t, dt);
    this.ensureBlocks(1);
    return moved;
  }
  resize(w, h) { this.camera.aspect = w / h; this.camera.fov = w < h ? 62 : 50; this.camera.updateProjectionMatrix(); }
}
