// 모아몬 3D 모양: 모든 몬스터를 코드로 직접 빚는다 (그림 파일 없음)
import * as THREE from 'three';

// ---------- 공용 모양 ----------
const G = {
  sph: new THREE.SphereGeometry(1, 28, 20),
  low: new THREE.IcosahedronGeometry(1, 1),
  rock: new THREE.DodecahedronGeometry(1, 0),
  pet: new THREE.SphereGeometry(1, 16, 12).translate(0, 1, 0), // 밑이 원점인 길쭉한 잎/귀/꽃잎
  cone: new THREE.ConeGeometry(1, 2, 14).translate(0, 1, 0),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  cap: new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
  drop: new THREE.LatheGeometry([[0, 0], [0.42, 0.12], [0.6, 0.45], [0.52, 0.85], [0.3, 1.35], [0.1, 1.8], [0, 2]].map((p) => new THREE.Vector2(p[0], p[1])), 16),
  arc: new THREE.TorusGeometry(1, 0.22, 8, 14, Math.PI),
  ring: new THREE.TorusGeometry(1, 0.12, 8, 28),
};
function extrude(pts, depth) { const s = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1]))); const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 }); g.translate(0, 0, -depth / 2); return g; }
G.bolt = extrude([[0.1, 0], [0.55, 0.9], [0.2, 0.9], [0.6, 2], [-0.35, 0.75], [0.05, 0.75], [-0.3, 0]], 0.22);
G.star = extrude(Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.45 : 1; return [Math.cos(a) * r, Math.sin(a) * r]; }), 0.28);
G.moon = (() => { const pts = []; const c2 = 0.45, r2 = 0.82; for (let i = 0; i <= 60; i++) { const a = (i / 60) * Math.PI * 2; const x = Math.cos(a), y = Math.sin(a); if (Math.hypot(x - c2, y) > r2) pts.push([x, y]); } const inner = []; for (let i = 0; i <= 60; i++) { const a = (i / 60) * Math.PI * 2; const x = c2 + Math.cos(a) * r2, y = Math.sin(a) * r2; if (Math.hypot(x, y) < 1) inner.push([x, y, a]); } inner.sort((p, q) => q[2] - p[2]); return extrude(pts.concat(inner), 0.25); })();

const mats = new Map();
function mat(color, o = {}) {
  const key = color + '|' + (o.glow || 0) + '|' + (o.flat ? 1 : 0) + '|' + (o.op || 1) + '|' + (o.rough ?? 0.62);
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.62, metalness: 0, flatShading: !!o.flat });
    if (o.glow) { m.emissive = new THREE.Color(color); m.emissiveIntensity = o.glow; }
    if (o.op) { m.transparent = true; m.opacity = o.op; }
    mats.set(key, m);
  }
  return m;
}
function shiftColor(c) { const col = new THREE.Color(c); const h = {}; col.getHSL(h); if (h.s < 0.12) col.setHSL(0.12, 0.75, Math.max(0.45, h.l * 0.9)); else col.setHSL((h.h + 0.42) % 1, Math.min(1, h.s * 1.1), h.l); return '#' + col.getHexString(); }

// ---------- 생김새 표 ----------
const PINK = '#ff9db0';
export const LOOKS = {
  ipsae: { sc: 0.8, b: [0.5, 0.46, 0.46], col: '#9ad96b', belly: '#eefad0', cheeks: PINK, top: { t: 'sprout', col: '#3fae4a' }, tail: { t: 'stub' }, feet: '#6fbf55' },
  ipsagwi: { sc: 1.0, b: [0.48, 0.44, 0.44], col: '#6cc45a', belly: '#e6f7c4', head: 0.42, cheeks: PINK, ears: { t: 'leaf', col: '#3f9a45' }, top: { t: 'leaf', col: '#3f9a45' }, tail: { t: 'leaf', col: '#3f9a45' }, arms: 1, feet: '#4fa648' },
  supimgeum: { sc: 1.38, b: [0.6, 0.58, 0.54], col: '#3f9a53', belly: '#dcf0b4', head: 0.46, ears: { t: 'horn', col: '#8a5a2b' }, top: { t: 'flower', col: '#ff8ac4' }, tail: { t: 'leaf', col: '#2c7a3c' }, ruff: { t: 'leaf', col: '#7fd35f' }, arms: 1, feet: '#2c7a3c', eye: 'calm' },
  bulssi: { sc: 0.8, b: [0.46, 0.44, 0.48], col: '#ff9a4a', belly: '#ffe9c0', cheeks: '#ff7a6a', ears: { t: 'point', col: '#ff7a2a', in: '#ffe0a8' }, tail: { t: 'flame' }, feet: '#d9651e', mouth: 'cat' },
  bulkkori: { sc: 1.02, b: [0.46, 0.44, 0.46], col: '#ff8433', belly: '#ffe3b0', head: 0.41, cheeks: '#ff6a5a', ears: { t: 'point', col: '#f2641c', in: '#ffe0a8' }, top: { t: 'flame', s: 0.5 }, tail: { t: 'flame', s: 1.35 }, arms: 1, feet: '#c9551a', mouth: 'cat' },
  hwareureuk: { sc: 1.4, b: [0.58, 0.56, 0.6], col: '#e8552a', belly: '#ffdca6', head: 0.47, ears: { t: 'point', col: '#c43c18', in: '#ffd08a' }, ruff: { t: 'flame' }, tail: { t: 'flame', s: 1.8 }, arms: 1, feet: '#a8300f', eye: 'fierce', mouth: 'fang' },
  mulbang: { sc: 0.8, b: [0.48, 0.44, 0.46], col: '#6cc8ff', belly: '#e2f6ff', rough: 0.25, cheeks: '#ffb3c6', top: { t: 'drop', col: '#6cc8ff' }, tail: { t: 'fin', col: '#3fa0ee' }, feet: '#3fa0ee', mouth: 'open' },
  mulbora: { sc: 1.02, b: [0.5, 0.46, 0.54], col: '#3fa7ff', belly: '#e3f5ff', rough: 0.3, cheeks: '#ffb3c6', ears: { t: 'fin', col: '#1f7fe0' }, top: { t: 'drop', col: '#8fd4ff' }, tail: { t: 'fin', col: '#1f7fe0', s: 1.4 }, arms: 1, feet: '#1f7fe0', mouth: 'open' },
  padowang: { sc: 1.42, b: [0.66, 0.58, 0.68], col: '#2b7fd9', belly: '#e0f2ff', rough: 0.3, head: 0.46, ears: { t: 'fin', col: '#1a5cb0' }, top: { t: 'crown', col: '#ffd24a' }, tail: { t: 'fin', col: '#1a5cb0', s: 1.9 }, ruff: { t: 'fluff', col: '#ffffff' }, arms: 1, feet: '#1a5cb0', eye: 'calm' },
  jjirityang: { sc: 0.86, b: [0.5, 0.46, 0.52], col: '#fff6d8', fluff: '#fffbe8', head: 0.31, headCol: '#6b5a4a', headZ: 0.42, headY: -0.08, ears: { t: 'drop', col: '#6b5a4a' }, top: { t: 'bolt', col: '#f6c21c', s: 0.5 }, tail: { t: 'fluff', col: '#fffbe8' }, feet: '#5a4a3c', eyeCol: '#fff' },
  cheondungyang: { sc: 1.32, b: [0.58, 0.54, 0.6], col: '#ffe680', fluff: '#fff0a0', head: 0.36, headCol: '#4a3f38', headZ: 0.48, headY: -0.05, ears: { t: 'bolt', col: '#f6a81c' }, tail: { t: 'bolt', col: '#f6a81c' }, feet: '#3c322c', eye: 'fierce', eyeCol: '#fff', spark: 1 },
  joyak: { sc: 0.72, b: [0.5, 0.4, 0.46], col: '#b9a58c', flat: 1, cheeks: '#e8a0a0', feet: '#8f7d68', eye: 'dot', bumps: { col: '#a3907a', n: 3 } },
  bawidol: { sc: 1.02, b: [0.54, 0.5, 0.5], col: '#9c8870', flat: 1, top: { t: 'crystal', col: '#7fe0ff' }, arms: '#86745f', feet: '#7a6955', bumps: { col: '#86745f', n: 5 }, eye: 'dot' },
  sandeongi: { sc: 1.5, b: [0.72, 0.56, 0.66], col: '#8a7860', flat: 1, head: 0.4, headZ: 0.45, headY: -0.2, top: { t: 'grass', col: '#5fbf4f' }, arms: '#75644f', feet: '#685846', bumps: { col: '#7fe0ff', n: 4, glow: 0.5 }, eye: 'calm', bodyTop: 1 },
  sandeul: { sc: 0.76, b: [0.44, 0.42, 0.42], col: '#bfeee6', belly: '#ffffff', cheeks: PINK, ears: { t: 'wing', col: '#8fdcd2' }, tail: { t: 'fluff', col: '#ffffff' }, float: 1, mouth: 'beak' },
  hoeori: { sc: 1.16, b: [0.46, 0.5, 0.44], col: '#7fd6d0', belly: '#ffffff', ears: { t: 'wing', col: '#4fbcb4', s: 1.5 }, top: { t: 'swirl', col: '#ffffff' }, tail: { t: 'long', col: '#4fbcb4', tip: '#ffffff' }, float: 1, mouth: 'beak', eye: 'fierce' },
  byeolbam: { sc: 0.8, b: [0.44, 0.44, 0.42], col: '#5a4bb5', belly: '#d6ceff', cheeks: '#ff9dd0', ears: { t: 'long', col: '#5a4bb5', in: '#d6ceff', tip: '#ffe98a' }, tail: { t: 'fluff', col: '#ffffff' }, feet: '#4a3d9c' },
  daltokki: { sc: 1.26, b: [0.5, 0.5, 0.46], col: '#7d6be0', belly: '#efeaff', head: 0.43, cheeks: '#ff9dd0', ears: { t: 'long', col: '#7d6be0', in: '#efeaff', tip: '#ffe98a', s: 1.35 }, top: { t: 'moon', col: '#ffe98a' }, tail: { t: 'fluff', col: '#ffffff' }, ruff: { t: 'fluff', col: '#ffffff' }, arms: 1, feet: '#6452c4' },
  beoseosi: { sc: 0.76, b: [0.38, 0.4, 0.38], col: '#fff1d6', cheeks: PINK, top: { t: 'cap', col: '#e8543f', spot: '#ffffff' }, feet: '#f0d8b0', eye: 'dot' },
  beoseotwang: { sc: 1.28, b: [0.5, 0.52, 0.48], col: '#ffeccc', cheeks: PINK, top: { t: 'cap', col: '#8b5bd6', spot: '#bff7ff', s: 1.25, glow: 0.6 }, arms: '#f5dcb4', feet: '#ecd0a4', eye: 'calm', minis: 1 },
  sutdeong: { sc: 0.8, b: [0.46, 0.44, 0.44], col: '#3b3540', flat: 1, top: { t: 'flame', s: 0.45 }, feet: '#2a252e', cracks: '#ff8a2a', eyeCol: '#ffb347' },
  yongamdung: { sc: 1.32, b: [0.6, 0.56, 0.56], col: '#4a3a3a', flat: 1, head: 0.42, ears: { t: 'horn', col: '#2a2224' }, top: { t: 'flame', s: 0.6 }, tail: { t: 'flame', s: 0.9 }, arms: '#3a2c2c', feet: '#2e2424', cracks: '#ff6a1a', eye: 'fierce', eyeCol: '#ffb347' },
  gaegul: { sc: 0.76, b: [0.5, 0.4, 0.46], col: '#7ed957', belly: '#f5ffd6', cheeks: PINK, frog: 1, feet: '#58b53a', mouth: 'wide' },
  yeonmotjang: { sc: 1.22, b: [0.6, 0.5, 0.54], col: '#4fae4a', belly: '#ecffc8', frog: 1, top: { t: 'lily', col: '#3c9a3c' }, arms: 1, feet: '#3a8f38', mouth: 'wide', eye: 'fierce' },
  kkomagureum: { sc: 0.8, b: [0.46, 0.4, 0.42], col: '#ffffff', cloud: 1, cheeks: PINK, float: 1 },
  meokgureum: { sc: 1.32, b: [0.56, 0.46, 0.5], col: '#6f7896', cloud: 1, float: 1, eye: 'fierce', rain: '#6cc8ff', eyeCol: '#fff' },
  bandi: { sc: 0.66, b: [0.36, 0.36, 0.4], col: '#4a4f6a', belly: '#8088a8', ears: { t: 'antenna', col: '#4a4f6a', tip: '#fff07a' }, tail: { t: 'glow', col: '#fff07a' }, wings: { t: 'bug', col: '#dff4ff' }, float: 1, eyeCol: '#fff' },
  deungbul: { sc: 1.12, b: [0.32, 0.42, 0.32], col: '#5a4a7a', belly: '#8a78b0', ears: { t: 'antenna', col: '#5a4a7a', tip: '#ffd24a' }, tail: { t: 'glow', col: '#ffd24a' }, wings: { t: 'butter', col: '#ffcf5a', col2: '#ff8a3a', glow: 0.35 }, float: 1, eyeCol: '#fff' },
  somteol: { sc: 0.7, b: [0.46, 0.46, 0.46], col: '#fdfdf5', fuzz: '#ffffff', cheeks: PINK, feet: '#f0c090', eye: 'dot' },
  kkomul: { sc: 0.7, b: [0.36, 0.36, 0.36], col: '#b6e36a', cheeks: PINK, ears: { t: 'antenna', col: '#7fb83a', tip: '#ffd24a' }, segs: { n: 3, cols: ['#9ad04f', '#b6e36a', '#9ad04f'] }, feet: '#7fb83a' },
  napul: { sc: 1.06, b: [0.28, 0.4, 0.28], col: '#7a5ad0', belly: '#b9a4f0', cheeks: PINK, ears: { t: 'antenna', col: '#5a3fb0', tip: '#ff8ac4' }, wings: { t: 'butter', col: '#ff8ac4', col2: '#7fe0ff' }, float: 1, eyeCol: '#fff' },
  haenimi: { sc: 1.46, b: [0.56, 0.56, 0.54], col: '#ffc83a', belly: '#fff5b8', glow: 0.25, cheeks: '#ff8a5a', ruff: { t: 'rays', col: '#ff8a2a' }, tail: { t: 'flame', s: 1.1 }, arms: 1, feet: '#f29a1a', float: 1, mouth: 'open' },
  dalnimi: { sc: 1.46, b: [0.52, 0.54, 0.5], col: '#cfd6ff', belly: '#ffffff', glow: 0.15, cheeks: '#c8a8ff', ears: { t: 'long', col: '#aab4ff', in: '#ffffff', tip: '#fff3a0', s: 1.2, droop: 1 }, top: { t: 'star', col: '#fff3a0' }, back: { t: 'moon', col: '#fff3a0' }, tail: { t: 'cloud', col: '#ffffff' }, float: 1, eye: 'sleepy' },
  mujigaeyong: { sc: 1.5, b: [0.4, 0.4, 0.42], col: '#ff6a6a', belly: '#fff3d0', ears: { t: 'horn', col: '#ffffff' }, ruff: { t: 'fluff', col: '#ffffff' }, segs: { n: 7, cols: ['#ff9a3d', '#ffd84a', '#6fdc6a', '#4bc4ff', '#5a7dff', '#a56bff', '#ff8ac4'], dragon: 1 }, wings: { t: 'bug', col: '#ffffff' }, float: 1, eye: 'calm' },
};

// ---------- 빚기 ----------
function add(parent, geo, material, pos, scale, rot) {
  const m = new THREE.Mesh(geo, material);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (scale !== undefined) typeof scale === 'number' ? m.scale.setScalar(scale) : m.scale.set(scale[0], scale[1], scale[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = true; parent.add(m); return m;
}
const Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0);
// 타원체 겉면의 한 점과 바깥 방향
function surf(host, yaw, pitch, out = 1) {
  const d = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const p = new THREE.Vector3(host.c[0] + d.x * host.r[0] * out, host.c[1] + d.y * host.r[1] * out, host.c[2] + d.z * host.r[2] * out);
  const n = new THREE.Vector3(d.x / host.r[0], d.y / host.r[1], d.z / host.r[2]).normalize();
  return { p, n };
}
function stick(mesh, s, axis = Z) { mesh.position.copy(s.p); mesh.quaternion.setFromUnitVectors(axis, s.n); return mesh; }
function flame(parent, s, C, anims, phase = 0) {
  const g = new THREE.Group(); parent.add(g);
  add(g, G.drop, mat(C('#ff7a1a'), { glow: 0.9 }), [0, 0, 0], [0.34 * s, 0.34 * s, 0.34 * s]);
  add(g, G.drop, mat(C('#ffd84a'), { glow: 1.2 }), [0, 0.02 * s, 0.03 * s], [0.2 * s, 0.24 * s, 0.2 * s]);
  anims.push((t) => { const k = 1 + Math.sin(t * 11 + phase) * 0.08 + Math.sin(t * 17 + phase) * 0.05; g.scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k)); g.rotation.z = Math.sin(t * 7 + phase) * 0.12; });
  return g;
}

export function buildMon(id, shiny = false) {
  const L = LOOKS[id] || LOOKS.somteol;
  const C = (c) => (shiny ? shiftColor(c) : c);
  const out = new THREE.Group(), root = new THREE.Group(); out.add(root);
  const anims = [];
  const b = L.b, legH = L.float ? 0.22 : L.feet ? 0.07 : 0.0;
  const by = legH + b[1];
  const body = { c: [0, by, 0], r: b };
  const bodyMat = mat(C(L.col), { flat: L.flat, rough: L.rough, glow: L.glow });
  const bodyG = new THREE.Group(); root.add(bodyG);

  if (L.cloud) {
    for (const [x, y, z, r] of [[0, 0, 0, 1], [-0.62, -0.12, 0, 0.72], [0.62, -0.12, 0, 0.72], [-0.3, 0.42, -0.05, 0.66], [0.32, 0.4, -0.05, 0.7], [0, -0.1, -0.5, 0.75], [0, -0.3, 0.2, 0.8]]) add(bodyG, G.sph, bodyMat, [x * b[0], by + y * b[1], z * b[2]], [r * b[0], r * b[1], r * b[2]]);
  } else add(bodyG, L.flat ? G.low : G.sph, bodyMat, body.c, b);
  if (L.belly) { const s = surf(body, 0, L.head ? -0.3 : -0.62, 0.8); add(bodyG, G.sph, mat(C(L.belly), { rough: L.rough }), [s.p.x, s.p.y, s.p.z], L.head ? [b[0] * 0.64, b[1] * 0.6, b[2] * 0.3] : [b[0] * 0.6, b[1] * 0.42, b[2] * 0.36]); }

  // 머리 (없으면 몸이 얼굴)
  let face = body;
  const headG = new THREE.Group(); root.add(headG);
  if (L.head) {
    const hr = L.head; const hc = [0, by + b[1] * 0.72 + hr * 0.5 + (L.headY || 0) * 1, L.headZ ?? b[2] * 0.22];
    if (L.headY) hc[1] = by + b[1] * 0.3 + L.headY;
    face = { c: hc, r: [hr, hr * 0.94, hr * 0.94] };
    add(headG, L.flat ? G.low : G.sph, mat(C(L.headCol || L.col), { flat: L.flat, rough: L.rough }), hc, face.r);
  }
  const top = L.bodyTop ? body : face;

  // 눈
  const er = (L.head ? face.r[0] : Math.min(b[0], b[1])) * (L.eye === 'dot' ? 0.13 : 0.2);
  const eyeYaw = L.head ? 0.5 : 0.44, eyePitch = L.frog ? 0.95 : 0.16;
  for (const sd of [-1, 1]) {
    const s = surf(face, sd * (L.frog ? 0.6 : eyeYaw), eyePitch, L.frog ? 1.0 : 0.97);
    const eg = new THREE.Group(); stick(eg, s); headG.add(eg);
    if (L.frog) { add(eg, G.sph, bodyMat, [0, 0, -er * 0.5], er * 1.5); eg.quaternion.setFromUnitVectors(Z, new THREE.Vector3(sd * 0.25, 0.25, 1).normalize()); eg.position.y += er * 0.4; }
    const zf = L.frog ? er * 0.7 : 0;
    if (L.eyeCol) add(eg, G.sph, mat(L.eyeCol, { rough: 0.3 }), [0, 0, zf - er * 0.1], [er * 1.15, er * 1.32, er * 0.4]);
    const h = L.eye === 'sleepy' ? 0.35 : L.eye === 'calm' ? 0.9 : 1.22;
    add(eg, G.sph, mat('#1b1626', { rough: 0.15 }), [0, 0, zf], [er * (L.eyeCol ? 0.8 : 1), er * h * (L.eyeCol ? 0.85 : 1), er * 0.5]).castShadow = false;
    if (L.eye !== 'sleepy') { add(eg, G.sph, mat('#ffffff', { glow: 0.6 }), [sd * -er * 0.28 + er * 0.1, er * 0.42, zf + er * 0.42], er * 0.3).castShadow = false; add(eg, G.sph, mat('#ffffff', { glow: 0.4 }), [er * 0.25, -er * 0.4, zf + er * 0.42], er * 0.14).castShadow = false; }
    if (L.eye === 'fierce') add(eg, G.cyl, mat('#2a2030'), [0, er * 1.25, zf + er * 0.3], [er * 1.2, er * 0.3, er * 0.3], [0, 0, sd * -0.45 + Math.PI / 2]);
    anims.push((t) => { const k = (t * 0.37 + (id.length % 5) * 0.3) % 3.4; eg.scale.y = k < 0.12 ? 0.12 : 1; });
  }
  // 입
  const mth = surf(face, 0, L.frog ? 0.05 : -0.14, 0.99); const mg = new THREE.Group(); stick(mg, mth); headG.add(mg);
  const dark = mat('#5a2a35');
  const mr = er * (L.eye === 'dot' ? 1.4 : 1);
  if (L.mouth === 'open') { add(mg, G.sph, dark, [0, 0, 0], [mr * 0.75, mr * 0.7, mr * 0.2]); add(mg, G.sph, mat('#ff8a9a'), [0, -mr * 0.28, mr * 0.08], [mr * 0.45, mr * 0.3, mr * 0.15]); }
  else if (L.mouth === 'beak') add(mg, G.cone, mat(C('#ffb23a')), [0, mr * 0.2, 0], [mr * 0.55, mr * 0.55, mr * 0.45], [Math.PI / 2, 0, 0]);
  else if (L.mouth === 'wide') add(mg, G.arc, dark, [0, mr * 0.3, 0], [mr * 2.2, mr * 0.9, mr * 0.5], [0, 0, Math.PI]);
  else if (L.mouth === 'cat') { for (const sd of [-1, 1]) add(mg, G.arc, dark, [sd * mr * 0.36, mr * 0.15, 0], [mr * 0.36, mr * 0.3, mr * 0.4], [0, 0, Math.PI]); }
  else if (L.mouth === 'fang') { add(mg, G.arc, dark, [0, mr * 0.2, 0], [mr * 0.9, mr * 0.45, mr * 0.4], [0, 0, Math.PI]); for (const sd of [-1, 1]) add(mg, G.cone, mat('#ffffff'), [sd * mr * 0.55, mr * 0.05, 0], [mr * 0.16, mr * 0.2, mr * 0.16], [Math.PI, 0, 0]); }
  else add(mg, G.arc, dark, [0, mr * 0.25, 0], [mr * 0.55, mr * 0.4, mr * 0.4], [0, 0, Math.PI]);
  if (L.cheeks) for (const sd of [-1, 1]) { const s = surf(face, sd * 0.85, -0.12, 0.98); const c = add(headG, G.sph, mat(L.cheeks, { rough: 0.9 }), null, [er * 0.85, er * 0.6, er * 0.2]); stick(c, s); c.castShadow = false; }

  // 귀
  if (L.ears) {
    const E = L.ears, s0 = E.s || 1, fr = face.r[0];
    for (const sd of [-1, 1]) {
      const eg = new THREE.Group(); headG.add(eg);
      const yaw = sd * (E.t === 'wing' ? 1.5 : E.t === 'fin' ? 1.45 : 0.62), pitch = E.t === 'wing' || E.t === 'fin' ? 0.15 : E.t === 'drop' ? 0.35 : 0.85;
      const s = surf(face, yaw, pitch, 0.9); eg.position.copy(s.p);
      const tilt = new THREE.Vector3(sd * (E.droop ? 1.6 : E.t === 'wing' || E.t === 'fin' ? 1.4 : E.t === 'drop' ? 1.2 : 0.42), E.droop ? -0.3 : E.t === 'drop' ? -0.5 : 1, E.t === 'wing' ? -0.3 : -0.08).normalize();
      eg.quaternion.setFromUnitVectors(Y, tilt);
      const col = mat(C(E.col), { flat: L.flat });
      if (E.t === 'round') { add(eg, G.sph, col, [0, fr * 0.2, 0], [fr * 0.34, fr * 0.34, fr * 0.14]); }
      else if (E.t === 'point') { add(eg, G.cone, col, [0, -fr * 0.05, 0], [fr * 0.3, fr * 0.36 * s0, fr * 0.16]); if (E.in) add(eg, G.cone, mat(C(E.in)), [0, -fr * 0.02, fr * 0.06], [fr * 0.18, fr * 0.26 * s0, fr * 0.1]); }
      else if (E.t === 'long') { add(eg, G.pet, col, [0, -fr * 0.1, 0], [fr * 0.2, fr * 0.72 * s0, fr * 0.1]); if (E.in) add(eg, G.pet, mat(C(E.in)), [0, 0, fr * 0.05], [fr * 0.11, fr * 0.6 * s0, fr * 0.07]); if (E.tip) add(eg, G.star, mat(C(E.tip), { glow: 0.8 }), [0, fr * 1.38 * s0, 0], fr * 0.2); }
      else if (E.t === 'leaf') add(eg, G.pet, col, [0, -fr * 0.05, 0], [fr * 0.26, fr * 0.5 * s0, fr * 0.06]);
      else if (E.t === 'horn') { add(eg, G.cone, col, [0, -fr * 0.05, 0], [fr * 0.13, fr * 0.42 * s0, fr * 0.13]); if (id === 'supimgeum') add(eg, G.cone, col, [sd * fr * 0.05, fr * 0.3, 0], [fr * 0.08, fr * 0.24, fr * 0.08], [0, 0, sd * -0.9]); }
      else if (E.t === 'bolt') add(eg, G.bolt, mat(C(E.col), { glow: 0.7 }), [0, -fr * 0.1, 0], fr * 0.5 * s0, [0, sd > 0 ? 0 : Math.PI, 0]);
      else if (E.t === 'fin') add(eg, G.pet, col, [0, -fr * 0.1, 0], [fr * 0.3, fr * 0.42 * s0, fr * 0.06]);
      else if (E.t === 'drop') add(eg, G.pet, col, [0, -fr * 0.1, 0], [fr * 0.22, fr * 0.36, fr * 0.12]);
      else if (E.t === 'antenna') { add(eg, G.cyl, col, [0, fr * 0.4, 0], [fr * 0.045, fr * 0.8, fr * 0.045]); add(eg, G.sph, mat(C(E.tip), { glow: 0.9 }), [0, fr * 0.85, 0], fr * 0.15); }
      else if (E.t === 'wing') { add(eg, G.pet, col, [0, -fr * 0.1, 0], [fr * 0.42 * s0, fr * 0.72 * s0, fr * 0.07]); add(eg, G.pet, mat('#ffffff'), [0, -fr * 0.05, fr * 0.04], [fr * 0.26 * s0, fr * 0.5 * s0, fr * 0.06]); }
      const base = eg.quaternion.clone(), ax = new THREE.Vector3(0, 0, 1), q = new THREE.Quaternion();
      const amp = E.t === 'wing' ? 0.55 : E.t === 'long' ? 0.12 : 0.06, sp = E.t === 'wing' ? 9 : 2.2;
      anims.push((t) => { q.setFromAxisAngle(ax, Math.sin(t * sp + sd) * amp * sd); eg.quaternion.copy(base).multiply(q); });
    }
  }

  // 머리 위
  if (L.top) {
    const T = L.top, s0 = T.s || 1, tr = top.r[0], tg = new THREE.Group(); (L.bodyTop ? bodyG : headG).add(tg);
    tg.position.set(top.c[0], top.c[1] + top.r[1] * 0.93, top.c[2]);
    const col = mat(C(T.col || '#ffffff'));
    if (T.t === 'sprout') { add(tg, G.cyl, col, [0, tr * 0.18, 0], [tr * 0.05, tr * 0.4, tr * 0.05]); for (const sd of [-1, 1]) add(tg, G.pet, col, [0, tr * 0.36, 0], [tr * 0.2, tr * 0.3, tr * 0.05], [0, 0, sd * -1.0]); anims.push((t) => { tg.rotation.z = Math.sin(t * 2.4) * 0.14; }); }
    else if (T.t === 'leaf') { add(tg, G.pet, col, [0, -tr * 0.05, 0], [tr * 0.3, tr * 0.5, tr * 0.06], [-0.5, 0, 0.2]); anims.push((t) => { tg.rotation.z = Math.sin(t * 2.2) * 0.12; }); }
    else if (T.t === 'flame') flame(tg, tr * 2.2 * s0, C, anims, 1);
    else if (T.t === 'drop') add(tg, G.drop, col, [0, -tr * 0.2, 0], [tr * 0.42, tr * 0.38, tr * 0.42]);
    else if (T.t === 'cap') { const cm = mat(C(T.col), { glow: T.glow ? 0.12 : 0 }); tg.position.y -= top.r[1] * 0.42; add(tg, G.cap, cm, [0, 0, 0], [tr * 1.75 * s0, tr * 1.15 * s0, tr * 1.75 * s0]); add(tg, G.cyl, mat('#fff4dc'), [0, 0, 0], [tr * 1.7 * s0, 0.02, tr * 1.7 * s0]); const sm = mat(T.spot, { glow: T.glow || 0 }); for (let i = 0; i < 7; i++) { const a = (i / 6) * Math.PI * 2, r = i === 6 ? 0 : 0.6, h = i === 6 ? 1 : 0.72; add(tg, G.sph, sm, [Math.cos(a) * r * tr * 1.7 * s0, h * tr * 1.12 * s0, Math.sin(a) * r * tr * 1.7 * s0], [tr * 0.24, tr * 0.1, tr * 0.24]).castShadow = false; } }
    else if (T.t === 'crown') { const gm = mat(T.col, { rough: 0.3, glow: 0.25 }); add(tg, G.cyl, gm, [0, tr * 0.08, 0], [tr * 0.42, tr * 0.2, tr * 0.42]); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; add(tg, G.cone, gm, [Math.cos(a) * tr * 0.36, tr * 0.15, Math.sin(a) * tr * 0.36], [tr * 0.11, tr * 0.2, tr * 0.11]); } }
    else if (T.t === 'crystal') { for (const [x, z, s, rz] of [[0, 0, 1, 0], [0.3, 0.05, 0.6, -0.5], [-0.28, -0.05, 0.7, 0.45]]) add(tg, G.rock, mat(C(T.col), { glow: 0.55, rough: 0.2, flat: 1 }), [x * tr, tr * 0.1 * s, z * tr], [tr * 0.2 * s, tr * 0.5 * s, tr * 0.2 * s], [0, 0, rz]); }
    else if (T.t === 'star') { const st = add(tg, G.star, mat(C(T.col), { glow: 0.9 }), [0, tr * 0.5, 0], tr * 0.34); anims.push((t) => { st.rotation.y = t * 1.5; st.position.y = tr * 0.5 + Math.sin(t * 2) * tr * 0.08; }); }
    else if (T.t === 'moon') { const st = add(tg, G.moon, mat(C(T.col), { glow: 0.9 }), [0, tr * 0.62, -tr * 0.3], tr * 0.42, [0, 0, 0.5]); anims.push((t) => { st.position.y = tr * 0.62 + Math.sin(t * 1.6) * tr * 0.06; }); }
    else if (T.t === 'bolt') add(tg, G.bolt, mat(C(T.col), { glow: 0.7 }), [0, -tr * 0.1, 0], tr * 0.5 * s0);
    else if (T.t === 'flower') { const pm = mat(C(T.col)); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const p = add(tg, G.pet, pm, [0, tr * 0.12, 0], [tr * 0.2, tr * 0.3, tr * 0.06]); p.rotation.set(0, a, 0); p.rotateZ(-1.15); } add(tg, G.sph, mat('#ffd84a', { glow: 0.3 }), [0, tr * 0.16, 0], tr * 0.17); }
    else if (T.t === 'grass') { tg.position.y = top.c[1] + top.r[1] * 0.55; add(tg, G.cap, mat(C(T.col)), [0, 0, -tr * 0.1], [tr * 0.86, tr * 0.5, tr * 0.8]); const gm = mat(C('#3f9a45')); for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 0.2 + (i % 3) * 0.2; add(tg, G.cone, gm, [Math.cos(a) * r * tr, tr * 0.36, Math.sin(a) * r * tr - tr * 0.1], [tr * 0.05, tr * 0.16, tr * 0.05]); } for (const [x, z, c] of [[0.3, 0.1, '#ff8ac4'], [-0.35, -0.2, '#ffd84a'], [0.05, -0.4, '#ffffff']]) add(tg, G.sph, mat(c), [x * tr, tr * 0.5, z * tr], tr * 0.08); }
    else if (T.t === 'swirl') { const sw = new THREE.Group(); tg.add(sw); for (let i = 0; i < 3; i++) add(sw, G.ring, col, [0, tr * (0.1 + i * 0.22), 0], tr * (0.42 - i * 0.12), [Math.PI / 2, 0, 0]); anims.push((t) => { sw.rotation.y = t * 5; sw.children.forEach((c, i) => { c.position.x = Math.sin(t * 5 + i) * tr * 0.06; }); }); }
    else if (T.t === 'lily') { add(tg, G.cyl, col, [0, tr * 0.02, 0], [tr * 0.9, tr * 0.06, tr * 0.9]); const pm = mat('#ff9ad0'); for (let i = 0; i < 6; i++) { const p = add(tg, G.pet, pm, [0, tr * 0.06, 0], [tr * 0.14, tr * 0.2, tr * 0.05]); p.rotation.set(0, (i / 6) * Math.PI * 2, 0); p.rotateZ(-0.7); } add(tg, G.sph, mat('#ffd84a'), [0, tr * 0.12, 0], tr * 0.1); }
  }

  // 목도리/갈기
  if (L.ruff) {
    const R = L.ruff, host = L.head ? face : body, rr = host.r[0], rg = new THREE.Group(); root.add(rg);
    if (R.t === 'rays') { rg.position.set(body.c[0], body.c[1], body.c[2] - b[2] * 0.25); const rm = mat(C(R.col), { glow: 0.5 }); for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; add(rg, G.cone, rm, [Math.cos(a) * rr * 0.85, Math.sin(a) * rr * 0.85, 0], [rr * 0.2, rr * (i % 2 ? 0.34 : 0.46), rr * 0.12], [0, 0, a - Math.PI / 2]); } anims.push((t) => { rg.rotation.z = t * 0.5; }); }
    else {
      rg.position.set(host.c[0], host.c[1] - host.r[1] * (L.head ? 0.72 : 0), host.c[2] - (L.head ? 0.05 : 0));
      const n = R.t === 'flame' ? 9 : 10;
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const x = Math.sin(a) * rr * 0.88, z = Math.cos(a) * rr * 0.8;
        if (R.t === 'fluff') add(rg, G.sph, mat(C(R.col), { rough: 0.9 }), [x, 0, z], rr * 0.3);
        else if (R.t === 'leaf') { const p = add(rg, G.pet, mat(C(R.col)), [x * 0.8, 0, z * 0.8], [rr * 0.2, rr * 0.3, rr * 0.06]); p.rotation.set(0, a, 0); p.rotateX(1.9); }
        else if (R.t === 'flame' && Math.abs(a - 0) > 0.9 && Math.abs(a - Math.PI * 2) > 0.9) { const f = flame(rg, rr * 1.5, C, anims, i); f.position.set(x * 0.95, rr * 0.5, z * 0.95 - rr * 0.1); f.rotation.x = -0.5 * Math.cos(a); f.rotation.z = -0.6 * Math.sin(a); const bq = f.rotation.clone(); anims.push(() => { f.rotation.x = bq.x; }); }
      }
    }
  }

  // 꼬리
  if (L.tail) {
    const T = L.tail, s0 = T.s || 1, tg = new THREE.Group(); root.add(tg);
    const s = surf(body, Math.PI, -0.25, 0.92); tg.position.copy(s.p);
    const col = mat(C(T.col || L.col), { flat: L.flat });
    const br = b[0];
    if (T.t === 'stub') add(tg, G.sph, col, [0, 0, 0], br * 0.2);
    else if (T.t === 'fluff') add(tg, G.sph, mat(C(T.col), { rough: 0.95 }), [0, 0, -br * 0.1], br * 0.3);
    else if (T.t === 'flame') { add(tg, G.cyl, mat(C(L.col)), [0, br * 0.1, -br * 0.22], [br * 0.09, br * 0.5, br * 0.09], [1.0, 0, 0]); const f = flame(tg, br * 1.9 * s0, C, anims); f.position.set(0, br * 0.2, -br * 0.5); }
    else if (T.t === 'leaf') { const p = add(tg, G.pet, col, [0, 0, 0], [br * 0.4, br * 0.6, br * 0.07], [-1.0, 0, 0]); anims.push((t) => { p.rotation.z = Math.sin(t * 3) * 0.3; }); }
    else if (T.t === 'fin') { const p = new THREE.Group(); tg.add(p); add(p, G.pet, col, [0, 0, 0], [br * 0.12, br * 0.42 * s0, br * 0.3], [-1.9, 0, 0]); add(p, G.pet, col, [0, 0, -br * 0.3 * s0], [br * 0.06, br * 0.4 * s0, br * 0.34], [-1.1, 0, 0]); anims.push((t) => { p.rotation.y = Math.sin(t * 4) * 0.4; }); }
    else if (T.t === 'bolt') add(tg, G.bolt, mat(C(T.col), { glow: 0.7 }), [0, -br * 0.1, -br * 0.1], br * 0.55, [-0.9, 0, 0]);
    else if (T.t === 'glow') { const gl = add(tg, G.sph, mat(C(T.col), { glow: 1.6 }), [0, br * 0.1, -br * 0.15], br * 0.55); gl.castShadow = false; anims.push((t) => { gl.material.emissiveIntensity = 1.1 + Math.sin(t * 3) * 0.6; }); }
    else if (T.t === 'cloud') { for (const [x, y, z, r] of [[0, 0, -0.2, 0.36], [0.2, 0.15, -0.45, 0.28], [-0.15, 0.3, -0.7, 0.2]]) add(tg, G.sph, col, [x * br, y * br, z * br], br * r); }
    else if (T.t === 'long') { const segs = []; for (let i = 0; i < 6; i++) segs.push(add(tg, G.sph, i === 5 ? mat(C(T.tip)) : col, [0, 0, 0], br * (i === 5 ? 0.26 : 0.16 - i * 0.012))); anims.push((t) => { segs.forEach((m, i) => { m.position.set(Math.sin(t * 3 + i * 0.7) * br * 0.12 * i, -i * br * 0.12 + Math.sin(i * 0.8) * br * 0.1, -i * br * 0.2); }); }); }
  }
  if (L.back) add(root, G.moon, mat(C(L.back.col), { glow: 0.8 }), [0, by + b[1] * 0.2, -b[2] * 1.15], b[0] * 1.45, [0, 0, 0.35]);

  // 날개
  if (L.wings) {
    const W = L.wings;
    for (const sd of [-1, 1]) {
      const wg = new THREE.Group(); root.add(wg); wg.position.set(sd * b[0] * 0.3, by + b[1] * 0.35, -b[2] * 0.7);
      if (W.t === 'butter') {
        const m1 = mat(C(W.col), { glow: W.glow || 0.08 }), m2 = mat(C(W.col2), { glow: W.glow || 0.08 });
        add(wg, G.sph, m1, [sd * b[0] * 1.5, b[1] * 0.75, 0], [b[0] * 1.5, b[1] * 1.15, 0.03]);
        add(wg, G.sph, m2, [sd * b[0] * 1.2, -b[1] * 0.75, 0], [b[0] * 1.05, b[1] * 0.8, 0.03]);
        add(wg, G.sph, mat('#ffffff', { glow: 0.3 }), [sd * b[0] * 1.6, b[1] * 0.85, 0.02], [b[0] * 0.5, b[1] * 0.4, 0.03]);
        add(wg, G.sph, m1, [sd * b[0] * 1.25, -b[1] * 0.8, 0.02], [b[0] * 0.4, b[1] * 0.3, 0.03]);
        anims.push((t) => { wg.rotation.y = sd * (0.25 + Math.sin(t * 7) * 0.6); });
      } else { add(wg, G.pet, mat(C(W.col), { op: 0.7, rough: 0.2 }), [0, 0, 0], [b[0] * 0.5, b[1] * 1.0, 0.03], [0, 0, sd * -1.1]); anims.push((t) => { wg.rotation.z = sd * Math.sin(t * 38) * 0.5; }); }
    }
  }

  // 팔다리
  const limbCol = (v, d) => mat(C(typeof v === 'string' ? v : d), { flat: L.flat });
  if (L.feet) for (const sd of [-1, 1]) add(root, L.flat ? G.low : G.sph, limbCol(L.feet, L.col), [sd * b[0] * 0.48, 0.09, b[2] * 0.28], [b[0] * 0.3, 0.1, b[0] * 0.4]);
  const armsG = [];
  if (L.arms) for (const sd of [-1, 1]) { const ag = new THREE.Group(); root.add(ag); ag.position.set(sd * b[0] * 0.92, by + b[1] * 0.12, b[2] * 0.25); add(ag, L.flat ? G.low : G.sph, limbCol(L.arms, L.col), [sd * b[0] * 0.08, -b[1] * 0.2, 0], L.flat ? [b[0] * 0.3, b[1] * 0.38, b[0] * 0.3] : [b[0] * 0.2, b[1] * 0.36, b[0] * 0.22]); armsG.push(ag); anims.push((t) => { ag.rotation.z = sd * (0.25 + Math.sin(t * 2.6 + sd) * 0.12); }); }

  // 꾸밈
  if (L.fluff) { const fm = mat(C(L.fluff), { rough: 0.95 }); for (let i = 0; i < 26; i++) { const a = i * 2.39996, y = 1 - (i / 25) * 1.7; const r = Math.sqrt(Math.max(0, 1 - y * y)); const d = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r); if (d.z > 0.55 && d.y < 0.5) continue; add(bodyG, G.sph, fm, [d.x * b[0] * 0.92, by + d.y * b[1] * 0.92, d.z * b[2] * 0.92], b[0] * 0.33); } }
  if (L.fuzz) { const fm = mat(L.fuzz, { rough: 1 }); for (let i = 0; i < 40; i++) { const a = i * 2.39996, y = 1 - (i / 39) * 2; const r = Math.sqrt(Math.max(0, 1 - y * y)); const d = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r); if (d.z > 0.6 && Math.abs(d.y) < 0.55) continue; add(bodyG, G.cone, fm, [d.x * b[0] * 0.9, by + d.y * b[1] * 0.9, d.z * b[2] * 0.9], [b[0] * 0.1, b[0] * 0.16, b[0] * 0.1]).quaternion.setFromUnitVectors(Y, d); } }
  if (L.bumps) { const bm = mat(C(L.bumps.col), { flat: 1, glow: L.bumps.glow || 0 }); for (let i = 0; i < L.bumps.n; i++) { const s = surf(body, 1.2 + i * 1.5, 0.5 - (i % 3) * 0.35, 0.92); add(bodyG, G.rock, bm, [s.p.x, s.p.y, s.p.z], b[0] * (0.2 + (i % 2) * 0.08), [i, i * 2, 0]); } }
  if (L.cracks) { const cm = mat(L.cracks, { glow: 1.6 }); for (let i = 0; i < 7; i++) { const s = surf(body, 0.9 + i * 0.83, -0.5 + (i % 3) * 0.45, 0.985); const c = add(bodyG, G.cyl, cm, null, [b[0] * 0.035, b[0] * (0.3 + (i % 2) * 0.15), b[0] * 0.035]); stick(c, s); c.rotateX(Math.PI / 2); c.rotateZ(i * 1.3); c.castShadow = false; } anims.push((t) => { cm.emissiveIntensity = 1.3 + Math.sin(t * 2.5) * 0.5; }); }
  if (L.rain) { const rm = mat(L.rain, { glow: 0.4, rough: 0.2 }); const drops = []; for (let i = 0; i < 5; i++) drops.push(add(root, G.drop, rm, [(i - 2) * b[0] * 0.36, 0, 0], [0.05, 0.05, 0.05])); anims.push((t) => { drops.forEach((d, i) => { const k = (t * 1.3 + i * 0.37) % 1; d.position.y = by - b[1] * 0.6 - k * (by - b[1] * 0.5); d.visible = k < 0.9; }); }); }
  if (L.minis) for (const [x, z, s] of [[0.5, 0.25, 0.3], [-0.48, 0.3, 0.22]]) { add(root, G.cyl, mat('#fff1d6'), [x, 0.08 * s * 3, z], [0.05 * s * 3, 0.16 * s * 3, 0.05 * s * 3]); add(root, G.cap, mat(C(L.top.col)), [x, 0.14 * s * 3, z], [0.14 * s * 3, 0.1 * s * 3, 0.14 * s * 3]); }
  if (L.spark) { const sm = mat('#fff7a8', { glow: 2 }); const sp = []; for (let i = 0; i < 4; i++) { const m = add(root, G.bolt, sm, [0, 0, 0], 0.1); m.castShadow = false; sp.push(m); } anims.push((t) => { sp.forEach((m, i) => { const k = Math.floor(t * 6 + i * 1.7); const a = k * 2.1 + i; m.position.set(Math.cos(a) * b[0] * 1.15, by + Math.sin(k * 1.3) * b[1] * 0.8, Math.sin(a) * b[2] * 1.15); m.rotation.z = k; m.visible = (k + i) % 3 !== 0; }); }); }

  // 몸마디 (애벌레, 용)
  if (L.segs) {
    const S = L.segs, parts = [];
    for (let i = 0; i < S.n; i++) { const k = S.dragon ? 0.92 - i * 0.07 : 0.9 - i * 0.06; const m = add(root, G.sph, mat(C(S.cols[i % S.cols.length])), [0, by, 0], [b[0] * k, b[1] * k, b[2] * k]); parts.push(m); if (!S.dragon) for (const sd of [-1, 1]) add(m, G.sph, mat(C(L.feet)), [sd * 0.55, -0.85, 0], [0.22, 0.2, 0.26]); else if (i < S.n - 1) add(m, G.cone, mat('#ffffff', { glow: 0.2 }), [0, 0.8, 0], [0.2, 0.3, 0.12]); }
    anims.push((t) => { parts.forEach((m, i) => { const j = i + 1; if (S.dragon) m.position.set(Math.sin(t * 2.2 - j * 0.7) * b[0] * 0.75, by + Math.sin(t * 2.8 - j * 0.8) * b[1] * 0.45 - j * 0.02, -j * b[2] * 1.05); else m.position.set(0, legH + b[1] * (0.9 - i * 0.06) + Math.max(0, Math.sin(t * 5 - j * 1.1)) * b[1] * 0.35, -j * b[2] * 1.25); }); });
  }

  const sc = L.sc; out.scale.setScalar(sc);
  const topY = (L.head ? face.c[1] + face.r[1] : by + b[1]) + (L.top ? face.r[0] * 0.6 : 0);
  out.userData = {
    id, height: topY * sc, radius: Math.max(b[0], b[2]) * sc * (L.wings?.t === 'butter' ? 1.8 : 1.15), center: by * sc, float: !!L.float,
    update(t) {
      for (const f of anims) f(t);
      const k = Math.sin(t * 3.1) * 0.025; root.scale.set(1 - k, 1 + k, 1 - k);
      root.position.y = L.float ? Math.sin(t * 2.1) * 0.07 : 0;
      headG.rotation.z = Math.sin(t * 1.3) * 0.03;
    },
  };
  return out;
}

// ---------- 도감 그림 (3D 모델을 작은 사진으로) ----------
let shot = null; const shots = new Map();
export function portrait(id, shiny = false) {
  const key = id + (shiny ? '*' : '');
  if (shots.has(key)) return shots.get(key);
  if (!shot) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setSize(192, 192, false); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15;
    const scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight(0xffffff, 0xb0a090, 1.5)); const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(2, 4, 5); scene.add(d);
    shot = { r, scene, cam: new THREE.PerspectiveCamera(28, 1, 0.1, 50) };
  }
  const m = buildMon(id, shiny); m.userData.update(0.6); m.rotation.y = 0.45; shot.scene.add(m);
  const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  const dist = Math.max(sz.x, sz.y, sz.z * 0.8) * 2.35 + 0.4;
  shot.cam.position.set(c.x, c.y + sz.y * 0.12, c.z + dist); shot.cam.lookAt(c);
  shot.r.render(shot.scene, shot.cam); const url = shot.r.domElement.toDataURL('image/png');
  shot.scene.remove(m); shots.set(key, url); return url;
}
