// Dressing the town: parking lots, driveway, crosswalks, street trees and lamps, gardens, park,
// beach things and grass. Trees, bushes, rocks, flowers and shells can be broken for items.
import * as THREE from 'three';
import { mat, paint } from './mat.js';
import { box, rbox, cyl, put, bake, displace } from './geom.js';
import { Scatter } from './scatter.js';
import { LAYOUT, SITES, ROADS2, groundAt } from './world.js';
import { rng } from './noise.js';
import { scatterKey } from '../online.mjs';

const LOTS = [
  { x0: -168, x1: -132, z0: -24.5, z1: -11.2, label: 'home' },
  { x0: 58, x1: 90, z0: -46, z1: -11.2, label: 'office' },
  { x0: 120, x1: 136, z0: -27, z1: -11.2, label: 'restaurant' },
  { x0: 216, x1: 242, z0: 11.2, z1: 36, label: 'other' },
  { x0: -284, x1: -262, z0: -32, z1: -11.2, label: 'beach' },
];
// the apartment parking lot replaced the old driveway and front path (kept empty so code stays simple)
const DRIVE = { x0: 0, x1: 0, z0: 0, z1: 0 };
const PATH = { x0: 0, x1: 0, z0: 0, z1: 0 };
const PLAZA = { x0: 24, x1: 56, z0: -20.5, z1: -11.2 };
const CROSSWALKS = [-80, 20, 160];

function inRect(x, z, r, m = 0) { return x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m; }

/** Is (x, z) free ground for scattering (not road, lot, building or path)? */
export function freeGround(x, z, margin = 1.5) {
  if (Math.abs(z - LAYOUT.roadZ) < LAYOUT.roadHalf + LAYOUT.walk + margin && x > LAYOUT.roadX[0] - 2) return false;
  const A2 = ROADS2.avenue2;
  if (Math.abs(z - A2.z) < A2.half + A2.walk + margin && x > A2.x0 - 2 && x < A2.x1 + 2) return false;
  for (const c of ROADS2.cross) if (Math.abs(x - c.x) < c.half + c.walk + margin && z > c.z0 - 2 && z < c.z1 + 2) return false;
  for (const r of [...LOTS, DRIVE, PATH, PLAZA]) if (inRect(x, z, r, margin)) return false;
  for (const s of SITES) {
    const fp = s.footprint ?? { w: 20, d: 20 };
    const rot = Math.abs(Math.sin(s.yaw)) > 0.5;
    const hw = (rot ? fp.d : fp.w) / 2 + margin + 1.5, hd = (rot ? fp.w : fp.d) / 2 + margin + 1.5;
    if (Math.abs(x - s.pos[0]) < hw && Math.abs(z - s.pos[2]) < hd) return false;
  }
  return true;
}

/** Cheap far-away tree (a few hundred triangles) to swap in beyond the near range. */
function farTree(kind, h) {
  const g = new THREE.Group();
  const leaf = kind === 'cherry' ? paint(0xe9a6bd, 0.85) : kind === 'maple' ? paint(0xc65a2a, 0.85) : kind === 'pine' ? paint(0x2f4a2c, 0.9) : paint(0x4f7a34, 0.9);
  put(g, cyl(0.14, 0.24, h * 0.5, 7), mat('bark'), 0, h * 0.25, 0);
  if (kind === 'pine') {
    for (let i = 0; i < 3; i++) put(g, cyl(0, 1.9 - i * 0.45, h * 0.38, 9), leaf, 0, h * (0.35 + i * 0.2), 0);
    return bake(g);
  } else {
    const blob = (r, x, y, z) => put(g, displace(new THREE.IcosahedronGeometry(r, 1), (a, b, c) => Math.sin(a * 3.1 + c * 2.3) * r * 0.12), leaf, x, y, z);
    blob(h * 0.3, 0, h * 0.68, 0); blob(h * 0.2, h * 0.17, h * 0.6, h * 0.08); blob(h * 0.2, -h * 0.15, h * 0.62, -h * 0.08);
  }
  return bake(g);
}

export function dressTown({ scene, props, build, colliders, lights, quality }) {
  const root = new THREE.Group();
  root.name = 'deco';
  scene.add(root);
  const flat = new THREE.Group();
  const R = rng(2026);
  const white = paint(0xf2f0ea, 0.6), yellow = paint(0xf2c230, 0.6);

  // parking lots with stall lines
  for (const l of LOTS) {
    const w = l.x1 - l.x0, d = l.z1 - l.z0, cx = (l.x0 + l.x1) / 2, cz = (l.z0 + l.z1) / 2;
    const y = groundAt(cx, cz);
    put(flat, box(w, 0.08, d), mat('asphalt'), cx, y + 0.0, cz).castShadow = false;
    const vertical = d > w;
    if (vertical) for (let z = l.z0 + 3; z < l.z1 - 3; z += 2.7) for (const x of [l.x0 + 2.5, l.x1 - 2.5]) put(flat, box(5, 0.012, 0.12), white, x, y + 0.045, z).castShadow = false;
    else for (let x = l.x0 + 2; x < l.x1 - 2; x += 2.7) put(flat, box(0.12, 0.012, 5), white, x, y + 0.045, l.z1 - 4).castShadow = false;
    // concrete wheel stops and a curb ring
    for (const s of [-1, 1]) {
      put(flat, rbox(w, 0.14, 0.25, 0.05), mat('concrete'), cx, y + 0.07, s < 0 ? l.z0 : l.z1 - 0.2).castShadow = false;
    }
  }
  // driveway and front path at home
  // apartment complex walk from the lot to the 101동 entrance
  put(flat, rbox(4, 0.08, 1.6, 0.03), mat('pavers2'), -150, 0.02, -25.2);
  // office plaza
  put(flat, rbox(PLAZA.x1 - PLAZA.x0, 0.12, PLAZA.z1 - PLAZA.z0, 0.03), mat('pavers2'), (PLAZA.x0 + PLAZA.x1) / 2, 0.05, (PLAZA.z0 + PLAZA.z1) / 2);
  // crosswalks
  for (const cx of CROSSWALKS) for (let z = -LAYOUT.roadHalf + 0.9; z < LAYOUT.roadHalf - 0.6; z += 1.2) put(flat, box(4, 0.014, 0.6), white, cx, 0.036, z).castShadow = false;
  // stop lines
  for (const cx of CROSSWALKS) for (const s of [-1, 1]) put(flat, box(0.35, 0.014, LAYOUT.roadHalf - 0.4), white, cx + s * 3, 0.036, s * -(LAYOUT.roadHalf / 2)).castShadow = false;
  void yellow;
  root.add(bake(flat));

  const N = props.nature, S = props.street;
  const breakables = [];
  if (!N) return { root, breakables, scatters: [] };

  // ---- instanced vegetation
  const protos = {
    round: N.tree({ kind: 'round', seed: 1, height: 7 }),
    round2: N.tree({ kind: 'maple', seed: 2, height: 7.5 }),
    cherry: N.tree({ kind: 'cherry', seed: 3, height: 6 }),
    pine: N.tree({ kind: 'pine', seed: 4, height: 9 }),
    palm: N.tree({ kind: 'palm', seed: 5, height: 8 }),
    bush: N.bush({ seed: 1 }),
    bush2: N.bush({ seed: 2, color: 0x4f7a3a }),
    flower: N.flowerPatch({ seed: 1 }),
    flower2: N.flowerPatch({ seed: 7 }),
    rock: N.rock({ seed: 1, size: 0.9 }),
    rock2: N.rock({ seed: 4, size: 1.4 }),
    shell: N.shell({ seed: 1 }),
    shell2: N.shell({ seed: 2 }),
  };
  const sc = {};
  const cap = { round: 140, round2: 100, cherry: 60, pine: 120, palm: 24, bush: 240, bush2: 200, flower: 160, flower2: 160, rock: 80, rock2: 50, shell: 30, shell2: 30 };
  const FAR = { round: farTree('round', 7), round2: farTree('maple', 7.5), cherry: farTree('cherry', 6), pine: farTree('pine', 9) };
  const RANGE = { round: 70, round2: 70, cherry: 70, pine: 70, palm: 400, bush: 45, bush2: 45, flower: 30, flower2: 30, rock: 70, rock2: 70, shell: 40, shell2: 40 };
  for (const [k, p] of Object.entries(protos)) sc[k] = new Scatter(root, p, cap[k] * 4, { far: FAR[k] ?? null, range: RANGE[k], maxRange: FAR[k] ? 900 : RANGE[k] });
  const BREAK = {
    round: { item: 'log', count: 3, hardness: 2.4, color: 0x6a4a30, h: 3.2, r: 0.35, name: '나무' },
    round2: { item: 'log', count: 3, hardness: 2.4, color: 0x6a4a30, h: 3.2, r: 0.35, name: '나무' },
    cherry: { item: 'log', count: 2, hardness: 2.2, color: 0x5a3a2a, h: 2.8, r: 0.3, name: '벚나무' },
    pine: { item: 'log', count: 3, hardness: 2.6, color: 0x5a4030, h: 3.5, r: 0.35, name: '소나무' },
    palm: { item: 'log', count: 2, hardness: 2.2, color: 0x8a6a40, h: 4, r: 0.3, name: '야자수' },
    bush: { item: 'turf', count: 1, hardness: 0.6, color: 0x4f7a3a, h: 1.0, r: 0.6, soft: true, name: '덤불' },
    bush2: { item: 'turf', count: 1, hardness: 0.6, color: 0x4f7a3a, h: 1.0, r: 0.6, soft: true, name: '덤불' },
    flower: { item: 'flower', count: 1, hardness: 0.3, color: 0xe86a8a, h: 0.5, r: 0.45, soft: true, name: '꽃' },
    flower2: { item: 'flower', count: 1, hardness: 0.3, color: 0xf2c84a, h: 0.5, r: 0.45, soft: true, name: '꽃' },
    rock: { item: 'stone', count: 2, hardness: 1.6, color: 0x8d8b85, h: 0.7, r: 0.5, name: '바위' },
    rock2: { item: 'stone', count: 3, hardness: 2.0, color: 0x8d8b85, h: 1.0, r: 0.75, name: '바위' },
    shell: { item: 'shell', count: 1, hardness: 0.25, color: 0xf3e2d0, h: 0.15, r: 0.25, soft: true, name: '조개' },
    shell2: { item: 'shell', count: 1, hardness: 0.25, color: 0xf0c8b8, h: 0.15, r: 0.25, soft: true, name: '조개' },
  };
  const plant = (kind, x, z, ry = R() * 6.28, s = 0.85 + R() * 0.35) => {
    const y = groundAt(x, z);
    const i = sc[kind].add(x, y - 0.03, z, ry, s);
    if (i < 0) return;
    const b = BREAK[kind];
    // key: same on every computer (seeded placement), so the shared town can name it
    const e = { min: [x - b.r * s, y, z - b.r * s], max: [x + b.r * s, y + b.h * s, z + b.r * s], item: b.item, count: b.count, hardness: b.hardness, color: b.color, scatter: sc[kind], index: i, name: b.name, key: scatterKey(kind, i) };
    if (!b.soft) e.col = colliders.add({ min: [x - b.r * 0.6 * s, y, z - b.r * 0.6 * s], max: [x + b.r * 0.6 * s, y + b.h * s, z + b.r * 0.6 * s], tag: 'tree' });
    build?.addProp(e);
    breakables.push(e);
  };
  const [x0, x1] = LAYOUT.roadX;
  // street trees in the outer part of the sidewalks
  for (let x = x0 + 10; x < x1 - 6; x += 16) for (const s of [-1, 1]) {
    const z = s * (LAYOUT.roadHalf + LAYOUT.walk - 0.9);
    const blocked = [DRIVE, PATH, PLAZA, ...LOTS].some((r) => x > r.x0 - 3 && x < r.x1 + 3 && Math.sign(r.z0 + r.z1) === s) || CROSSWALKS.some((c) => Math.abs(x - c) < 5) || (s > 0 && ROADS2.cross.some((c) => Math.abs(x - c.x) < c.half + c.walk + 2));
    if (!blocked) plant(Math.floor(x / 16) % 4 === 0 ? (s < 0 ? 'cherry' : 'round2') : 'round', x, z, R() * 6.28, 0.8);
  }
  // street trees along the school street
  { const A2 = ROADS2.avenue2;
    for (let x = A2.x0 + 8; x < A2.x1 - 6; x += 14) for (const sd of [-1, 1]) {
      if (ROADS2.cross.some((c) => Math.abs(x - c.x) < c.half + c.walk + 2)) continue;
      plant(Math.floor(x / 14) % 3 === 0 ? 'cherry' : 'round', x, A2.z + sd * (A2.half + A2.walk - 0.9), R() * 6.28, 0.8);
    } }
  // gardens, park and the hills
  const tries = (n, f) => { for (let i = 0; i < n; i++) f(); };
  const zone = (zMin, zMax, xMin = x0 + 4, xMax = x1) => [xMin + R() * (xMax - xMin), zMin + R() * (zMax - zMin)];
  tries(1400, () => {
    const north = R() < 0.55;
    const [x, z] = zone(north ? -85 : 14, north ? -14 : 205);
    if (!freeGround(x, z, 1.5)) return;
    const k = R();
    const far = Math.abs(z) > 48;
    if (k < 0.18) plant(far ? (R() < 0.6 ? 'pine' : 'round') : R() < 0.7 ? 'round' : R() < 0.5 ? 'round2' : 'cherry', x, z);
    else if (k < 0.5) plant(R() < 0.5 ? 'bush' : 'bush2', x, z);
    else if (k < 0.78) plant(R() < 0.5 ? 'flower' : 'flower2', x, z);
    else if (k < 0.86) plant(R() < 0.6 ? 'rock' : 'rock2', x, z);
  });
  // hedges and flowers along the home front
  // hedge and flower beds around the apartment lot
  for (let x = -167; x < -133; x += 1.5) if (Math.abs(x + 150) > 3) plant(x < -150 ? 'bush' : 'bush2', x, -25.6, R() * 6.28, 0.7);
  for (let z = -23.5; z < -12.5; z += 1.6) { plant('bush', -169, z, R() * 6.28, 0.75); plant('bush2', -131, z, R() * 6.28, 0.75); }
  for (let i = 0; i < 8; i++) plant(i % 2 ? 'flower' : 'flower2', -170 + (i % 4) * 0.9, -27 - Math.floor(i / 4) * 1.1, R() * 6.28, 0.8);
  // forest ring on the hills
  tries(500, () => {
    const a = R() * Math.PI * 2, rr = 1;
    const x = -40 + Math.cos(a) * (360 + R() * 140) * rr, z = Math.sin(a) * (130 + R() * 120);
    if (x < LAYOUT.beachX + 10) return;
    plant(R() < 0.7 ? 'pine' : 'round', x, z, R() * 6.28, 1 + R() * 0.5);
  });
  // beach
  for (let i = 0; i < 16; i++) plant('palm', LAYOUT.beachX - 2 - R() * 8, -60 + i * 8 + R() * 3, R() * 6.28, 0.9 + R() * 0.3);
  for (let i = 0; i < 40; i++) {
    const x = LAYOUT.beachX - 6 - R() * 20, z = -70 + R() * 140;
    if (x < -303 && Math.abs(z + 26) < 9) continue;
    plant(R() < 0.5 ? 'shell' : 'shell2', x, z);
  }
  for (let i = 0; i < 10; i++) plant(R() < 0.5 ? 'rock' : 'rock2', LAYOUT.beachX - 20 - R() * 12, -80 + R() * 160);
  for (const s of Object.values(sc)) s.finish();
  const scatters = Object.values(sc);

  // ---- grass tufts (chunked, only drawn near the camera)
  if (N.grassTuft) {
    const { geometry, material } = N.grassTuft();
    const proto = new THREE.Mesh(geometry, material);
    proto.castShadow = false;
    const grass = new Scatter(root, proto, 1e6, { range: 22, maxRange: 22, cast: false });
    const n = quality === 'high' ? 30000 : 9000;
    let c = 0;
    for (let i = 0; i < n * 3 && c < n; i++) {
      const x = -200 + R() * 470, z = (R() < 0.5 ? -1 : 1) * (11.5 + Math.pow(R(), 1.6) * 60);
      if (!freeGround(x, z, 0.4)) continue;
      const s = 0.7 + R() * 0.7;
      grass.add(x, groundAt(x, z) - 0.02, z, R() * 6.28, s, s * (0.8 + R() * 0.5));
      c++;
    }
    grass.finish();
    scatters.push(grass);
  }

  // ---- street furniture
  if (S) {
    const lampP = S.streetLight();
    if (lampP.glowMat) lights.addGlow(lampP.glowMat);
    const lamps = new Scatter(root, lampP.group, 80, { range: 400, maxRange: 400 });
    scatters.push(lamps);
    for (let x = x0 + 18; x < x1 - 4; x += 32) for (const s of [-1, 1]) {
      const xx = x + (s > 0 ? 16 : 0), z = s * (LAYOUT.roadHalf + 0.7);
      const ry = s < 0 ? 0 : Math.PI;
      lamps.add(xx, 0.16, z, ry);
      const lp = new THREE.Vector3(...(lampP.lampPos ?? [0, 6, 0])).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry).add(new THREE.Vector3(xx, 0.16, z));
      lights.add({ pos: lp, intensity: 18, range: 18, color: 0xffd9a0, when: 'night' });
      colliders.add({ min: [xx - 0.15, 0, z - 0.15], max: [xx + 0.15, 6, z + 0.15], tag: 'lamp' });
    }
    { const A2 = ROADS2.avenue2;
      for (let x = A2.x0 + 12; x < A2.x1 - 4; x += 30) for (const sd of [-1, 1]) {
        const xx = x + (sd > 0 ? 15 : 0);
        if (ROADS2.cross.some((c) => Math.abs(xx - c.x) < c.half + c.walk + 1)) continue;
        const z = A2.z + sd * (A2.half + 0.7), ry = sd < 0 ? 0 : Math.PI;
        lamps.add(xx, 0.16, z, ry);
        const lp = new THREE.Vector3(...(lampP.lampPos ?? [0, 6, 0])).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry).add(new THREE.Vector3(xx, 0.16, z));
        lights.add({ pos: lp, intensity: 18, range: 18, color: 0xffd9a0, when: 'night' });
        colliders.add({ min: [xx - 0.15, 0, z - 0.15], max: [xx + 0.15, 6, z + 0.15], tag: 'lamp' });
      }
      for (const c of ROADS2.cross) for (let z = c.z0 + 16; z < c.z1 - 8; z += 26) {
        const x = c.x + c.half + 0.6;
        lamps.add(x, 0.16, z, -Math.PI / 2);
        const lp = new THREE.Vector3(...(lampP.lampPos ?? [0, 6, 0])).applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2).add(new THREE.Vector3(x, 0.16, z));
        lights.add({ pos: lp, intensity: 18, range: 18, color: 0xffd9a0, when: 'night' });
      }
    }
    lamps.finish();
    const furniture = new THREE.Group();
    const one = (obj, x, z, ry = 0, solid = 0.3, keep = false) => {
      const o = obj.group ?? obj; o.position.set(x, groundAt(x, z) + (Math.abs(z) < 11.3 && Math.abs(z) > 7 ? 0.16 : 0), z); o.rotation.y = ry; (keep ? root : furniture).add(o);
      if (solid) colliders.add({ min: [x - solid, o.position.y, z - solid], max: [x + solid, o.position.y + 1.1, z + solid], tag: 'prop' });
      return o;
    };
    for (const cx of CROSSWALKS) for (const s of [-1, 1]) {
      const t = S.trafficLight(); one(t, cx + s * 2.6, s * (LAYOUT.roadHalf + 0.6), s < 0 ? 0 : Math.PI, 0.2, true);
      t.setState?.('green');
    }
    const bus = one(S.busStop(), -60, LAYOUT.roadHalf + 2.4, Math.PI, 0);
    for (const m of bus.userData?.glowMats ?? []) lights.addGlow(m);
    colliders.add({ min: [-62.2, 0, 9.9], max: [-57.8, 2.6, 10.9], tag: 'prop' });
    for (const [x, s] of [[-128, -1], [-30, 1], [95, -1], [180, 1], [8, -1]]) one(S.bench(), x, s * (LAYOUT.roadHalf + LAYOUT.walk - 0.6), s < 0 ? 0 : Math.PI, 0.6);
    for (const [x, s] of [[-140, 1], [-20, -1], [60, 1], [150, -1], [240, -1]]) one(S.hydrant(), x, s * (LAYOUT.roadHalf + 0.9), 0, 0.2);
    for (const [x, s] of [[-100, -1], [-52, 1], [30, 1], [130, -1], [210, 1]]) one(S.trashCan(), x, s * (LAYOUT.roadHalf + LAYOUT.walk - 0.5), 0, 0.3);
    one(S.signpost('세온 아파트'), -167, -12.2, 0, 0.1);
    for (const [x, z] of [[26, -12], [54, -12], [-112, -12.2], [-106, -12.2]]) one(S.planter(), x, z, 0, 0.5);
    for (let i = 0; i < 4; i++) one(S.bollard(), 58 + i * 1.2 - 2, -11.6, 0, 0.12);
    one(S.signpost('← 바다'), -262, 11.4, Math.PI, 0.1);
    one(S.signpost('세온 컴퍼니 →'), -90, 11.4, Math.PI, 0.1);
    // beach things
    const ch = [[0xe85a4a, -300, 6], [0x3a8ad8, -302, -8], [0xf2c230, -299, 20], [0x5ab878, -301, 34]];
    for (const [c, x, z] of ch) {
      one(S.parasol(c), x, z, R() * 6, 0.12);
      one(S.beachChair(), x - 1.2, z + 1.2, Math.PI / 2 + 0.3, 0);
      one(S.beachChair(), x - 1.2, z - 1.0, Math.PI / 2 - 0.2, 0);
    }
    root.add(bake(furniture));
  }
  return { root, breakables, scatters };
}

/** Japan island dressing: Fuji on the horizon, airplanes on the aprons, street lamps, vending
 * machines, cherry trees and wooded hills. */
export function dressJapan({ scene, props, build, colliders, lights, quality, places }) {
  const root = new THREE.Group();
  root.name = 'japan-deco';
  scene.add(root);
  const out = { scatters: [], breakables: [], fuji: null };
  const R = rng(81);
  const L = LAYOUT, JX = L.jx;
  const J = props.japan, N = props.nature, A = props.airplane;
  // parked airplanes behind both terminals
  if (A?.buildAirplane) {
    for (const key of ['airport', 'jpAirport']) {
      const s = places.sites[key];
      const ap = s?.extra?.apron;
      if (!ap) continue;
      const plane = A.buildAirplane().group;
      const c = Math.cos(s.worldYaw), sn = Math.sin(s.worldYaw);
      const [x, y, z] = [s.worldPos[0] + ap.pos[0] * c + ap.pos[2] * sn, s.worldPos[1] + ap.pos[1], s.worldPos[2] - ap.pos[0] * sn + ap.pos[2] * c];
      plane.position.set(x, groundAt(x, z) + y, z);
      plane.rotation.y = (ap.yaw ?? 0) + s.worldYaw;
      root.add(plane);
      colliders.add({ min: [x - 3, 0, z - 17], max: [x + 3, 6, z + 17], tag: 'plane' });
    }
    // runway and apron paving at home
    const fl = new THREE.Group();
    put(fl, box(150, 0.06, 26), mat('asphalt'), 262, 0.01, -78).castShadow = false;
    for (let x = 192; x < 334; x += 10) put(fl, box(5, 0.012, 0.35), paint(0xf2f0ea, 0.6), x, 0.045, -78).castShadow = false;
    put(fl, box(60, 0.05, 22), mat('concrete'), 262, 0.005, -55).castShadow = false;
    const jx = places.sites.jpAirport?.worldPos[0] ?? JX - 92;
    put(fl, box(120, 0.05, 30), mat('concrete'), jx, 0.005, -60).castShadow = false;
    root.add(bake(fl));
  }
  if (J?.fujiBackdrop) {
    const f = J.fujiBackdrop();
    f.group.position.set(JX + 60, -2, -760);
    f.material.fog = false;
    f.material.needsUpdate = true;
    f.group.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
    root.add(f.group);
    out.fuji = f;
  }
  const sites = Object.values(places.sites).filter((s) => s.def?.japan);
  const free = (x, z, m = 2) => {
    if (Math.abs(z) < L.jRoadHalf + L.jWalk + m && x > L.jMin[0] - 2 && x < L.jMax[0] + 2) return false;
    if (z > L.jMax[1] + 12) return false;
    for (const s of sites) {
      const rot = Math.abs(Math.sin(s.worldYaw)) > 0.5, fp = s.footprint;
      const hw = (rot ? fp.d : fp.w) / 2 + m, hd = (rot ? fp.w : fp.d) / 2 + m;
      if (Math.abs(x - s.worldPos[0]) < hw && Math.abs(z - s.worldPos[2]) < hd) return false;
    }
    if (x > JX - 140 && x < JX - 40 && z < -10 && z > -100) return false; // airport and apron
    return true;
  };
  if (N) {
    const cherry = new Scatter(root, N.tree({ kind: 'cherry', seed: 11, height: 6 }), 400, { range: 80, maxRange: 80 });
    const pine = new Scatter(root, N.tree({ kind: 'pine', seed: 12, height: 9 }), 600, { far: farTree('pine', 9), range: 80, maxRange: 900 });
    const maple = new Scatter(root, N.tree({ kind: 'maple', seed: 13, height: 7 }), 300, { far: farTree('maple', 7), range: 80, maxRange: 900 });
    const bush = new Scatter(root, N.bush({ seed: 14 }), 300, { range: 45, maxRange: 45 });
    // cherry trees just behind the sidewalks
    for (let x = L.jMin[0] + 8; x < L.jMax[0] - 6; x += 9) for (const s of [-1, 1]) {
      const z = s * (L.jRoadHalf + L.jWalk + 1.6);
      if (!free(x, z, -1.2)) continue;
      cherry.add(x, groundAt(x, z), z, R() * 6.28, 0.8 + R() * 0.2);
      colliders.add({ min: [x - 0.25, 0, z - 0.25], max: [x + 0.25, 3, z + 0.25], tag: 'tree' });
    }
    for (let i = 0; i < 700; i++) {
      const x = JX - 300 + R() * 600, z = -260 + R() * 300;
      if (!free(x, z, 3)) continue;
      const hill = z < L.jMin[1] || x < L.jMin[0] || x > L.jMax[0];
      const k = R();
      if (hill) (k < 0.65 ? pine : maple).add(x, groundAt(x, z) - 0.05, z, R() * 6.28, 0.9 + R() * 0.5);
      else if (k < 0.3) cherry.add(x, groundAt(x, z), z, R() * 6.28, 0.8 + R() * 0.3);
      else if (k < 0.7) bush.add(x, groundAt(x, z), z, R() * 6.28, 0.8);
    }
    for (const sc of [cherry, pine, maple, bush]) { sc.finish(); out.scatters.push(sc); }
    if (N.grassTuft) {
      const { geometry, material } = N.grassTuft();
      const proto = new THREE.Mesh(geometry, material);
      const grass = new Scatter(root, proto, 1e6, { range: 22, maxRange: 22, cast: false });
      for (let i = 0, c = 0; i < 30000 && c < (quality === 'high' ? 9000 : 3000); i++) {
        const x = L.jMin[0] + R() * (L.jMax[0] - L.jMin[0]), z = -40 + R() * 80;
        if (!free(x, z, 0.3)) continue;
        const s = 0.7 + R() * 0.6;
        grass.add(x, groundAt(x, z) - 0.02, z, R() * 6.28, s, s);
        c++;
      }
      grass.finish();
      out.scatters.push(grass);
    }
  }
  if (J) {
    const furn = new THREE.Group();
    const one = (obj, x, z, ry = 0, solid = 0.3, y = 0.14) => {
      const o = obj.group ?? obj;
      o.position.set(x, y, z); o.rotation.y = ry; furn.add(o);
      if (solid) colliders.add({ min: [x - solid, 0, z - solid], max: [x + solid, 1.8, z + solid], tag: 'prop' });
      return obj;
    };
    for (let x = L.jMin[0] + 12; x < L.jMax[0] - 6; x += 24) {
      const lamp = J.japaneseStreetLamp();
      one(lamp, x, L.jRoadHalf + 0.5, Math.PI, 0.15);
      const lp = new THREE.Vector3(...(lamp.lampPos ?? [0, 4.5, 0.4])).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI).add(new THREE.Vector3(x, 0.14, L.jRoadHalf + 0.5));
      lights.add({ pos: lp, intensity: 12, range: 14, color: 0xffd9a8, when: 'night' });
      if (lamp.glowMat) lights.addGlow(lamp.glowMat);
    }
    const vm = (x, z, ry) => { const v = J.vendingMachine(); one(v, x, z, ry, 0.5); if (v.glowMat) lights.addGlow(v.glowMat, 'always'); };
    vm(2153.3 - 2200 + JX, -L.jRoadHalf - L.jWalk + 0.5, 0);
    vm(2188 - 2200 + JX, L.jRoadHalf + L.jWalk - 0.5, Math.PI);
    vm(2224 - 2200 + JX, -L.jRoadHalf - L.jWalk + 0.5, 0);
    one(J.postBox(), JX - 48, -L.jRoadHalf - 0.6, 0, 0.25);
    for (let i = 0; i < 3; i++) one(J.bicycle(), JX - 12 + i * 0.7, -L.jRoadHalf - L.jWalk + 0.4, -Math.PI / 2 + 0.2, 0);
    for (const [x, z, ry, t] of [[JX - 60, L.jRoadHalf + 1.2, Math.PI, '← 사쿠라 공항'], [JX + 18, -L.jRoadHalf - 1.2, 0, '신사 →'], [JX - 6, L.jRoadHalf + 1.2, Math.PI, '료칸 ↓']]) one(J.signBoard(t), x, z, ry, 0.1);
    for (const [x, z] of [[JX + 25, -L.jRoadHalf - L.jWalk - 0.3], [JX + 60, -L.jRoadHalf - L.jWalk - 0.3]]) one(J.stoneLantern(), x, z, 0, 0.35);
    for (const x of [JX + 14, JX + 70, JX + 90]) one(J.bambooFence(6), x, L.jRoadHalf + L.jWalk + 0.8, 0, 0);
    root.add(bake(furn));
  }
  return out;
}
