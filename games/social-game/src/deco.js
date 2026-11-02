// Dressing the town: parking lots, driveway, crosswalks, street trees and lamps, gardens, park,
// beach things and grass. Trees, bushes, rocks, flowers and shells can be broken for items.
import * as THREE from 'three';
import { mat, paint } from './mat.js';
import { box, rbox, cyl, put, bake, displace } from './geom.js';
import { Scatter } from './scatter.js';
import { LAYOUT, SITES, groundAt } from './world.js';
import { rng } from './noise.js';

const LOTS = [
  { x0: 58, x1: 90, z0: -46, z1: -11.2, label: 'office' },
  { x0: 120, x1: 136, z0: -27, z1: -11.2, label: 'restaurant' },
  { x0: 216, x1: 242, z0: 11.2, z1: 36, label: 'other' },
  { x0: -284, x1: -262, z0: -32, z1: -11.2, label: 'beach' },
];
const DRIVE = { x0: -141.2, x1: -135.8, z0: -23, z1: -11.2 };
const PATH = { x0: -151.4, x1: -148.6, z0: -22.4, z1: -11.2 };
const PLAZA = { x0: 24, x1: 56, z0: -20.5, z1: -11.2 };
const CROSSWALKS = [-80, 20, 160];

function inRect(x, z, r, m = 0) { return x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m; }

/** Is (x, z) free ground for scattering (not road, lot, building or path)? */
export function freeGround(x, z, margin = 1.5) {
  if (Math.abs(z - LAYOUT.roadZ) < LAYOUT.roadHalf + LAYOUT.walk + margin && x > LAYOUT.roadX[0] - 2) return false;
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
  put(flat, rbox(DRIVE.x1 - DRIVE.x0, 0.1, DRIVE.z1 - DRIVE.z0, 0.03), mat('concrete'), (DRIVE.x0 + DRIVE.x1) / 2, 0.03, (DRIVE.z0 + DRIVE.z1) / 2);
  put(flat, rbox(PATH.x1 - PATH.x0, 0.08, PATH.z1 - PATH.z0, 0.03), mat('pavers2'), (PATH.x0 + PATH.x1) / 2, 0.02, (PATH.z0 + PATH.z1) / 2);
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
    const e = { min: [x - b.r * s, y, z - b.r * s], max: [x + b.r * s, y + b.h * s, z + b.r * s], item: b.item, count: b.count, hardness: b.hardness, color: b.color, scatter: sc[kind], index: i, name: b.name };
    if (!b.soft) e.col = colliders.add({ min: [x - b.r * 0.6 * s, y, z - b.r * 0.6 * s], max: [x + b.r * 0.6 * s, y + b.h * s, z + b.r * 0.6 * s], tag: 'tree' });
    build?.addProp(e);
    breakables.push(e);
  };
  const [x0, x1] = LAYOUT.roadX;
  // street trees in the outer part of the sidewalks
  for (let x = x0 + 10; x < x1 - 6; x += 16) for (const s of [-1, 1]) {
    const z = s * (LAYOUT.roadHalf + LAYOUT.walk - 0.9);
    const blocked = [DRIVE, PATH, PLAZA, ...LOTS].some((r) => x > r.x0 - 3 && x < r.x1 + 3 && Math.sign(r.z0 + r.z1) === s) || CROSSWALKS.some((c) => Math.abs(x - c) < 5);
    if (!blocked) plant(Math.floor(x / 16) % 4 === 0 ? (s < 0 ? 'cherry' : 'round2') : 'round', x, z, R() * 6.28, 0.8);
  }
  // gardens, park and the hills
  const tries = (n, f) => { for (let i = 0; i < n; i++) f(); };
  const zone = (zMin, zMax, xMin = x0 + 4, xMax = x1) => [xMin + R() * (xMax - xMin), zMin + R() * (zMax - zMin)];
  tries(900, () => {
    const north = R() < 0.55;
    const [x, z] = zone(north ? -85 : 14, north ? -14 : 80);
    if (!freeGround(x, z, 1.5)) return;
    const k = R();
    const far = Math.abs(z) > 48;
    if (k < 0.18) plant(far ? (R() < 0.6 ? 'pine' : 'round') : R() < 0.7 ? 'round' : R() < 0.5 ? 'round2' : 'cherry', x, z);
    else if (k < 0.5) plant(R() < 0.5 ? 'bush' : 'bush2', x, z);
    else if (k < 0.78) plant(R() < 0.5 ? 'flower' : 'flower2', x, z);
    else if (k < 0.86) plant(R() < 0.6 ? 'rock' : 'rock2', x, z);
  });
  // hedges and flowers along the home front
  for (let x = -156; x < -143; x += 1.4) if (x < PATH.x0 - 0.6 || x > PATH.x1 + 0.6) plant(x < -150 ? 'bush' : 'bush2', x, -12.6, R() * 6.28, 0.7);
  for (let i = 0; i < 6; i++) plant(i % 2 ? 'flower' : 'flower2', -156 + i * 2.2, -19.5, R() * 6.28, 0.8);
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
    for (const [x, s] of [[-100, -1], [-40, 1], [30, 1], [130, -1], [210, 1]]) one(S.trashCan(), x, s * (LAYOUT.roadHalf + LAYOUT.walk - 0.5), 0, 0.3);
    one(S.mailbox(), -144.5, -11.9, 0, 0.25);
    for (let x = -157; x < -143; x += 2) if (x + 2 < PATH.x0 || x > PATH.x1) one(S.fence(2), x + 1, -11.6, 0, 0);
    colliders.add({ min: [-157, 0, -11.75], max: [PATH.x0, 1.1, -11.45], tag: 'fence' });
    colliders.add({ min: [PATH.x1, 0, -11.75], max: [DRIVE.x0, 1.1, -11.45], tag: 'fence' });
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
