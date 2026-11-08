// Town layout: terrain, roads, sidewalks, sea. Sites and props are placed by main.js through place().
import * as THREE from 'three';
import { mat, paint } from './mat.js';
import { rbox, box, put, bake } from './geom.js';
import { worldNoise } from './noise.js';

export const LAYOUT = {
  roadZ: 0,
  roadHalf: 7,          // asphalt half width (2 lanes each way)
  walk: 4,              // sidewalk width
  roadX: [-286, 300],   // avenue extent
  townMin: [-300, -90], townMax: [320, 215],
  beachX: -286,         // land ends here, sand slopes to the sea
  seaY: -0.75,
  // Japan: a small island town far to the east, reached by plane
  jx: 2200,
  jMin: [2040, -70], jMax: [2340, 45],
  jRoadHalf: 3.5, jWalk: 2.5,
};
const JX = LAYOUT.jx;

/** Second avenue (school street) and the two cross streets that join it to the main avenue (인혁: "맵을 더 키워 줘"). */
export const ROADS2 = {
  avenue2: { z: 120, x0: -262, x1: 300, half: 7, walk: 4 },
  cross: [{ x: -40, z0: 7, z1: 113, half: 6, walk: 3 }, { x: 150, z0: 7, z1: 113, half: 6, walk: 3 }],
};
/** Road graph for car navigation: nodes [x, z] and edges between node indices. */
export const NAV = {
  nodes: [[-284, 0], [-40, 0], [150, 0], [298, 0], [-260, 120], [-40, 120], [150, 120], [298, 120]],
  edges: [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7], [1, 5], [2, 6]],
};

/** Buildings: module under src/sites, builder, world position (feet level), yaw, map label. */
export const SITES = [
  // 우리 집 = 세온 아파트 101동 802호 (인혁: "집을 아파트로 바꿔줘"); the old house is the fallback
  { key: 'home', mod: 'apartment', fn: 'buildApartment', args: { main: true, dong: '101동', seed: 1 }, pos: [-150, 0, -33], yaw: 0, label: '우리 아파트', color: '#f2a65a', fallback: { mod: 'home', fn: 'buildHome', pos: [-150, 0, -28] } },
  // more homes (인혁: "집을 더 만들어줘")
  { key: 'apt102', mod: 'apartment', fn: 'buildApartment', args: { main: false, dong: '102동', seed: 2 }, pos: [-185, 0, -36], yaw: 0, label: '102동', color: '#e8c08a' },
  { key: 'apt103', mod: 'apartment', fn: 'buildApartment', args: { main: false, dong: '103동', seed: 3 }, pos: [-218, 0, -36], yaw: 0, label: '103동', color: '#e8c08a' },
  { key: 'apt104', mod: 'apartment', fn: 'buildApartment', args: { main: false, dong: '104동', seed: 4 }, pos: [-150, 0, -62], yaw: 0, label: '104동', color: '#e8c08a' },
  { key: 'apt105', mod: 'apartment', fn: 'buildApartment', args: { main: false, dong: '105동', seed: 5 }, pos: [-200, 0, -64], yaw: 0, label: '105동', color: '#e8c08a' },
  // school street district (plan 3): licence test centre, school, academy, shops, more homes
  { key: 'license', mod: 'license', fn: 'buildLicenseCenter', pos: [60, 0, 155], yaw: Math.PI, label: '운전면허시험장', color: '#7ad0a0' },
  { key: 'school', mod: 'school', fn: 'buildSchool', pos: [-150, 0, 152], yaw: Math.PI, label: '세온 초등학교', color: '#ffb35a' },
  { key: 'academy', mod: 'school', fn: 'buildAcademy', pos: [-90, 0, 139.5], yaw: Math.PI, label: '세온 학원 빌딩', color: '#ff8ab0' },
  ...[['bakery', -212], ['cafe', -192], ['bookstore', -172], ['pharmacy', -100], ['toy', -78], ['hospital', 18]].map(([kind, x]) => ({ key: `shop-${kind}`, mod: 'town', fn: 'buildShop', args: { kind }, pos: [x, 0, 100], yaw: 0, label: { bakery: '빵집', cafe: '카페', bookstore: '서점', pharmacy: '약국', toy: '장난감', hospital: '병원' }[kind], color: '#9ad08a', small: true })),
  { key: 'apt106', mod: 'apartment', fn: 'buildApartment', args: { main: false, dong: '106동', seed: 6 }, pos: [190, 0, 152], yaw: Math.PI, label: '106동', color: '#e8c08a' },
  { key: 'apt107', mod: 'apartment', fn: 'buildApartment', args: { main: false, dong: '107동', seed: 7 }, pos: [225, 0, 152], yaw: Math.PI, label: '107동', color: '#e8c08a' },
  ...[40, 58, 76, 94, 112, 130].map((x, i) => ({ key: `house2-${i}`, mod: 'apartment', fn: 'buildHouse', args: { variant: (i + 2) % 4 }, pos: [x, 0, 100], yaw: 0, label: '', color: '#d8b48a', small: true })),
  ...[-232, -214, -196, -178, -160, -142, -124].map((x, i) => ({ key: `house${i}`, mod: 'apartment', fn: 'buildHouse', args: { variant: i % 4 }, pos: [x, 0, 22.5], yaw: Math.PI, label: '', color: '#d8b48a', small: true })),
  // more buildings (인혁: "건물을 더 만들어줘", 2026-11-05)
  ...[
    ['mart', -60, -28, 0, '세온 마트'], ['cinema', -15, -27, 0, '영화관'], ['fire', 160, -20, 0, '소방서'], ['police', 190, -19, 0, '경찰서'],
    ['gallery', -12, 24, Math.PI, '세온 갤러리'], ['bank', -95, 18, Math.PI, '은행'], ['post', -75, 18, Math.PI, '우체국'], ['chicken', -150, 100, 0, '치킨'], ['pizza', -132, 100, 0, '피자'],
  ].map(([kind, x, z, yaw, label]) => ({ key: `civic-${kind}`, mod: 'civic', fn: 'buildCivic', args: { kind }, pos: [x, 0, z], yaw, label, color: '#a8c4ff', small: kind === 'chicken' || kind === 'pizza' })),
  { key: 'apt108', mod: 'apartment', fn: 'buildApartment', args: { main: false, dong: '108동', seed: 8 }, pos: [60, 0, 55], yaw: Math.PI, label: '108동', color: '#e8c08a' },
  { key: 'apt109', mod: 'apartment', fn: 'buildApartment', args: { main: false, dong: '109동', seed: 9 }, pos: [100, 0, 55], yaw: Math.PI, label: '109동', color: '#e8c08a' },
  // 분수 광장: fountain, stage and the Friday-night show (인혁 계획 7: "분수를 만들고 분수에서 공연을 하게 해줘")
  { key: 'plaza', mod: 'plaza', fn: 'buildPlaza', pos: [22, 0, 28.5], yaw: Math.PI, label: '분수 광장', color: '#6ad0f0' },
  { key: 'store', mod: 'store', fn: 'buildStore', pos: [-110, 0, -17.5], yaw: 0, label: '편의점', color: '#5ac8f2' },
  { key: 'office', mod: 'office', fn: 'buildOffice', pos: [40, 0, -31], yaw: 0, label: '세온 컴퍼니', color: '#7a9cff' },
  { key: 'restaurant', mod: 'restaurant', fn: 'buildRestaurant', pos: [112, 0, -19], yaw: 0, label: '고깃집', color: '#ff7a5a' },
  { key: 'other', mod: 'othercompany', fn: 'buildOtherCompany', pos: [205, 0, 22], yaw: Math.PI, label: '별빛테크', color: '#c98aff' },
  { key: 'pension', mod: 'pension', fn: 'buildPension', pos: [-297, -0.3, -26], yaw: -Math.PI / 2, label: '바다 펜션', color: '#f2e05a' },
  { key: 'airport', mod: 'airport', fn: 'buildAirport', args: { name: '세온 국제공항' }, pos: [262, 0, -33], yaw: 0, label: '세온 국제공항', color: '#9ad0e8' },
  // Japan
  { key: 'jpAirport', mod: 'airport', fn: 'buildAirport', args: { name: '사쿠라 공항', japan: true }, pos: [JX - 92, 0, -26], yaw: 0, label: '사쿠라 공항', color: '#9ad0e8', japan: true },
  { key: 'ramen', mod: 'japan', fn: 'buildRamenShop', pos: [JX - 38, 0, -11.2], yaw: 0, label: '라멘 가게', color: '#ff9a5a', japan: true },
  { key: 'souvenir', mod: 'japan', fn: 'buildSouvenirShop', pos: [JX - 22, 0, -10.8], yaw: 0, label: '기념품 가게', color: '#ffd05a', japan: true },
  { key: 'shrine', mod: 'japan', fn: 'buildShrine', pos: [JX + 40, 0, -22], yaw: 0, label: '신사', color: '#e8503a', japan: true },
  { key: 'ryokan', mod: 'japan', fn: 'buildRyokan', pos: [JX + 2, 0, 16.5], yaw: Math.PI, label: '료칸', color: '#c9a07a', japan: true },
];

/** Car parking spots: [x, z, yaw] (yaw 0 faces -Z). */
export const PARKING = {
  home: [-140.7, -17.5, Math.PI],
  office: [70, -22, 0],
  restaurant: [126, -16, 0],
  other: [226, 18, Math.PI],
  beach: [-274, -20, Math.PI / 2],
  airport: [233, -24, Math.PI],
};

/** Flat pads under buildings on sloped ground: [minX, minZ, maxX, maxZ, height]. */
const PADS = [[-305, -35, -288, -17, -0.3], [190, -140, 340, -40, 0]];

export function isRoad(x, z) {
  if (x > 1500) return Math.abs(z) < LAYOUT.jRoadHalf + 0.2 && x > LAYOUT.jMin[0] && x < LAYOUT.jMax[0];
  if (Math.abs(z - LAYOUT.roadZ) < LAYOUT.roadHalf + 0.3 && x > LAYOUT.roadX[0] - 1 && x < LAYOUT.roadX[1] + 1) return true;
  const a = ROADS2.avenue2;
  if (Math.abs(z - a.z) < a.half + 0.3 && x > a.x0 - 1 && x < a.x1 + 1) return true;
  for (const c of ROADS2.cross) if (Math.abs(x - c.x) < c.half + 0.3 && z > c.z0 - 1 && z < c.z1 + 1) return true;
  return false;
}
export const inJapan = (x) => x > 1500;

/** Japan island: flat town, wooded hills to the north, a beach and the sea to the south. */
function japanGround(x, z) {
  const L = LAYOUT;
  const ox = Math.max(L.jMin[0] - x, 0, x - L.jMax[0]);
  const on = Math.max(L.jMin[1] - z, 0);
  const os = Math.max(z - L.jMax[1], 0);
  let h = 0;
  const hills = Math.hypot(ox, on);
  if (hills > 0) h += smooth(0, 140, hills) * (18 + 26 * worldNoise(x, z, 0.009, 3, 21)) + smooth(0, 50, hills) * 3 * worldNoise(x, z, 0.03, 2, 23);
  if (os > 0) h = h * smooth(25, 0, os) - Math.min(os, 35) * 0.03 - Math.max(0, os - 35) * 0.15;
  // far past the fence the island's hills go down into the sea (to the north they reach on under Mt Fuji)
  const c = EDGE.japan.coast, cd = Math.hypot(ox, on * 0.7);
  if (cd > c[0]) h = h * smooth(c[1], c[0], cd) - smooth(c[0], c[1], cd) * 14;
  return h;
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * How far you can go (인혁 계획 6: "언덕 같은 데 계속 가면 나무도 없고 땅도 없어져. 나무랑 땅이 보이게 해 줘").
 * The land goes on past the fence: the hills climb into a ring of wooded mountains and past them slope
 * down into the sea, so from anywhere you can stand there is ground all the way to the fog. A wooden
 * fence on the hills (buoys in the sea) marks the edge: `play` metres outside the town rectangle.
 *   home: the beach side (west) is open, the sea stops at x = sea
 *   japan: the sea is to the south (z = sea)
 * mount: where the mountains rise (metres outside the town), coast: where the land goes under the sea.
 */
export const EDGE = {
  home: { min: LAYOUT.townMin, max: LAYOUT.townMax, play: 330, open: 'w', sea: -400, mount: [350, 720], coast: [800, 920] },
  japan: { min: LAYOUT.jMin, max: LAYOUT.jMax, play: 200, open: 's', sea: 130, mount: null, coast: [400, 520] },
};
export const edgeOf = (x) => (x > 1500 ? EDGE.japan : EDGE.home);

/** Nearest point of the land's town rectangle (the open side reaches out forever) and the distance to it. */
function nearTown(E, x, z) {
  const rx = E.open === 'w' && x <= LAYOUT.beachX ? x : Math.min(Math.max(x, E.min[0]), E.max[0]);
  const rz = E.open === 's' && z >= E.max[1] ? z : Math.min(Math.max(z, E.min[1]), E.max[1]);
  return { rx, rz, out: Math.hypot(x - rx, z - rz) };
}
/** Metres outside the town rectangle (0 inside), the way the hills are measured. */
export function townOut(x, z) { return nearTown(edgeOf(x), x, z).out; }
/** The same for one land (EDGE.home or EDGE.japan) wherever (x, z) is. */
export function landOut(E, x, z) { return nearTown(E, x, z).out; }

/**
 * Keep a body (player p.x/p.z, or a car's centre) inside the fence, `pad` metres short of it.
 * Returns true when it had to be pushed back.
 */
export function keepIn(p, pad = 0.6) {
  const E = edgeOf(p.x);
  let hit = false;
  const lim = E.play - pad;
  const { rx, rz, out } = nearTown(E, p.x, p.z);
  if (out > lim) { const k = lim / out; p.x = rx + (p.x - rx) * k; p.z = rz + (p.z - rz) * k; hit = true; }
  if (E.open === 'w' && p.x < E.sea + pad) { p.x = E.sea + pad; hit = true; }
  if (E.open === 's' && p.z > E.sea - pad) { p.z = E.sea - pad; hit = true; }
  return hit;
}

/**
 * The fence line as points about `step` metres apart: [{x, z, nx, nz}] with (nx, nz) pointing into the
 * land. Goes around the town on the hills and comes back along the sea limit.
 */
export function edgePath(E, step = 2.5) {
  const pts = [];
  const line = (x0, z0, x1, z1) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / step));
    for (let i = 0; i < n; i++) { const t = i / n; pts.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]); }
  };
  const arc = (cx, cz, a0, a1) => {
    const n = Math.max(2, Math.round(Math.abs(a1 - a0) * E.play / step));
    for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * (i / n); pts.push([cx + Math.cos(a) * E.play, cz + Math.sin(a) * E.play]); }
  };
  const [x0, z0] = E.min, [x1, z1] = E.max, P = E.play, H = Math.PI / 2;
  if (E.open === 'w') {
    line(E.sea, z0 - P, x1, z0 - P); arc(x1, z0, -H, 0); line(x1 + P, z0, x1 + P, z1); arc(x1, z1, 0, H);
    line(x1, z1 + P, E.sea, z1 + P); line(E.sea, z1 + P, E.sea, z0 - P);
  } else {
    line(x0 - P, E.sea, x0 - P, z0); arc(x0, z0, Math.PI, Math.PI + H); line(x0, z0 - P, x1, z0 - P); arc(x1, z0, -H, 0);
    line(x1 + P, z0, x1 + P, E.sea); line(x1 + P, E.sea, x0 - P, E.sea);
  }
  return pts.map(([x, z]) => {
    const r = nearTown(E, x, z);
    let nx = r.rx - x, nz = r.rz - z;
    if (E.open === 'w' && x <= E.sea + 0.01) { nx = 1; nz = 0; }
    if (E.open === 's' && z >= E.sea - 0.01) { nx = 0; nz = -1; }
    const l = Math.hypot(nx, nz) || 1;
    return { x, z, nx: nx / l, nz: nz / l };
  });
}

/** Terrain height at (x, z). Flat town, rolling hills around it, a beach sloping into the sea. */
export function groundAt(x, z) {
  const L = LAYOUT;
  if (x > 1500) return japanGround(x, z);
  // distance outside the town rectangle
  const ox = Math.max(L.townMin[0] - x, 0, x - L.townMax[0]);
  const oz = Math.max(L.townMin[1] - z, 0, z - L.townMax[1]);
  let h = 0;
  const out = Math.hypot(x > L.beachX ? ox : 0, oz);
  if (out > 0) h += smooth(0, 160, out) * (14 + 30 * worldNoise(x, z, 0.008, 3, 3)) + smooth(0, 60, out) * 4 * worldNoise(x, z, 0.03, 2, 5);
  // past the fence (EDGE): wooded mountains, then the land slopes down into the sea. Inside the fence
  // nothing changes, so the trees, the 곰 숲 and the roads stay where they were.
  const E = EDGE.home;
  if (out > E.mount[0]) {
    const k = smooth(E.mount[0], E.mount[1], out) * smooth(L.beachX + 40, L.beachX + 300, x);
    if (k > 0) h += k * (55 + 115 * worldNoise(x, z, 0.0032, 4, 31) + 28 * worldNoise(x, z, 0.012, 3, 37));
  }
  if (out > E.coast[0]) h = h * smooth(E.coast[1], E.coast[0], out) - smooth(E.coast[0], E.coast[1], out) * 14;
  if (x < L.beachX) {
    const t = L.beachX - x; // metres from the end of the town
    const dune = Math.max(0, 1 - Math.abs(t - 6) / 6) * 0.35 * worldNoise(x, z, 0.08, 2, 9);
    h = h * smooth(30, 0, t) - Math.min(t, 40) * 0.028 - Math.max(0, t - 40) * 0.12 + dune;
  }
  for (const [a, b, c, d, ph] of PADS) {
    const e = Math.max(a - x, 0, x - c, b - z, 0, z - d);
    if (e < 6) h = ph + (h - ph) * smooth(0, 6, e);
  }
  return h;
}

/**
 * Ground as square tiles, merged per material in 512 m blocks: 4 m cells near where you can walk, 8 m and
 * 16 m farther out (인혁 계획 6: the land goes on to the fog). Tiles all under the sea are left out.
 * Heights are sampled one cell past every tile edge so the normals match across tiles, and a skirt
 * hangs under every tile edge so a fine tile next to a coarse one never shows a crack.
 * xs, zs: tile edges; stepOf(x0, z0, x1, z1) -> cell size; matOf(x0, z0) -> material name.
 */
function groundTiles(xs, zs, stepOf, matOf) {
  const parts = new Map();
  for (let a = 0; a + 1 < xs.length; a++) for (let b = 0; b + 1 < zs.length; b++) {
    const x0 = xs[a], x1 = xs[a + 1], z0 = zs[b], z1 = zs[b + 1];
    const step = stepOf(x0, z0, x1, z1);
    const nx = Math.round((x1 - x0) / step), nz = Math.round((z1 - z0) / step), W = nx + 3;
    const H = new Float32Array(W * (nz + 3));
    let top = -Infinity;
    for (let j = 0; j < nz + 3; j++) for (let i = 0; i < W; i++) {
      const h = groundAt(x0 + (i - 1) * step, z0 + (j - 1) * step);
      H[j * W + i] = h;
      if (i > 0 && j > 0 && i <= nx + 1 && j <= nz + 1 && h > top) top = h;
    }
    if (top < LAYOUT.seaY - 3) continue; // under the sea
    // tiles are merged per material in blocks of 2 x 2, so each block can be left out when it is
    // behind the camera or deep in the fog (the far island)
    const key = `${matOf(x0, z0)}:${a >> 1},${b >> 1}`;
    if (!parts.has(key)) parts.set(key, { pos: [], nor: [], idx: [] });
    const P = parts.get(key), base = P.pos.length / 3;
    const at = (i, j) => H[(j + 1) * W + i + 1];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const gx = at(i - 1, j) - at(i + 1, j), gz = at(i, j - 1) - at(i, j + 1), l = Math.hypot(gx, 2 * step, gz);
      P.pos.push(x0 + i * step, at(i, j), z0 + j * step);
      P.nor.push(gx / l, (2 * step) / l, gz / l);
    }
    const v = (i, j) => base + j * (nx + 1) + i;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) P.idx.push(v(i, j), v(i, j + 1), v(i + 1, j), v(i + 1, j), v(i, j + 1), v(i + 1, j + 1));
    // skirts: a strip hanging down from each edge, both faces
    const drop = step * 0.8 + 2;
    const edge = [];
    for (let i = 0; i <= nx; i++) edge.push([i, 0]);
    for (let j = 1; j <= nz; j++) edge.push([nx, j]);
    for (let i = nx - 1; i >= 0; i--) edge.push([i, nz]);
    for (let j = nz - 1; j >= 0; j--) edge.push([0, j]);
    const sb = P.pos.length / 3;
    for (const [i, j] of edge) {
      const k = v(i, j) * 3;
      P.pos.push(P.pos[k], P.pos[k + 1] - drop, P.pos[k + 2]);
      P.nor.push(P.nor[k], P.nor[k + 1], P.nor[k + 2]);
    }
    for (let e = 0; e < edge.length; e++) {
      const e2 = (e + 1) % edge.length;
      const t0 = v(...edge[e]), t1 = v(...edge[e2]), b0 = sb + e, b1 = sb + e2;
      P.idx.push(t0, b0, t1, t1, b0, b1, t0, t1, b0, t1, b1, b0);
    }
  }
  const out = [];
  for (const [key, P] of parts) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(P.nor, 3));
    const uv = new Float32Array((P.pos.length / 3) * 2);
    for (let i = 0, n = P.pos.length / 3; i < n; i++) { uv[i * 2] = P.pos[i * 3]; uv[i * 2 + 1] = P.pos[i * 3 + 2]; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(P.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(P.idx, 1) : new THREE.Uint16BufferAttribute(P.idx, 1));
    g.computeBoundingBox(); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat(key.split(':')[0]));
    m.receiveShadow = true;
    m.name = `ground-${key}`;
    out.push(m);
  }
  return out;
}

/** Smallest distance outside the town over a tile (sampled every 32 m). */
function tileOut(x0, z0, x1, z1) {
  let best = Infinity;
  for (let x = x0; x <= x1 + 0.1; x += (x1 - x0) / 8) for (let z = z0; z <= z1 + 0.1; z += (z1 - z0) / 8) best = Math.min(best, townOut(x, z));
  return best;
}
const edges = (a, n, size = 256) => Array.from({ length: n + 1 }, (_, i) => a + i * size);

export function buildWorld(scene) {
  const L = LAYOUT;
  const root = new THREE.Group();
  root.name = 'world';
  scene.add(root);
  const colliders = [];

  // terrain: grass for the land, sand for the beach. Fine tiles where you can walk (EDGE), coarser
  // ones for the mountains past the fence, all the way down to the sea around the island.
  const homeE = EDGE.home, jE = EDGE.japan;
  const stepHome = (x0, z0, x1, z1) => { const o = tileOut(x0, z0, x1, z1); return o <= homeE.play + 80 ? 4 : o <= homeE.play + 400 ? 8 : 16; };
  for (const m of groundTiles(edges(L.beachX - 256, 7), edges(-1152, 9), stepHome, (x0) => (x0 < L.beachX ? 'sand' : 'grass'))) root.add(m);
  // Japan island: hills to the north (under Mt Fuji), the beach and the sea to the south
  const jz = L.jMax[1] + 22;
  const stepJp = (x0, z0, x1, z1) => { const o = tileOut(x0, z0, x1, z1); return o <= jE.play + 80 ? 4 : o <= jE.play + 300 ? 8 : 16; };
  for (const m of groundTiles(edges(JX - 128 - 256 * 3, 7), edges(jz - 256 * 4, 5), stepJp, (x0, z0) => (z0 >= jz ? 'sand' : 'grass'))) root.add(m);
  const jsea = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat('water'));
  { const g = new THREE.PlaneGeometry(2800, 3400).rotateX(-Math.PI / 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2800, uv.getY(i) * 3400); jsea.geometry = g; }
  jsea.position.set(JX - 560, L.seaY - 0.05, 0);
  root.add(jsea);

  // sea: west of the beach and all around the island up to the Japan sea (x 240), which it meets edge to edge
  const SW = 240 - (L.beachX - 2420), SD = 3400;
  const seaGeo = new THREE.PlaneGeometry(SW, SD, 1, 1).rotateX(-Math.PI / 2);
  const uvs = seaGeo.attributes.uv; for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getX(i) * SW, uvs.getY(i) * SD);
  const sea = new THREE.Mesh(seaGeo, mat('water'));
  sea.position.set(240 - SW / 2, L.seaY, 0);
  sea.receiveShadow = true;
  root.add(sea);
  // foam where the waves meet the sand
  const foamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, roughness: 0.6, depthWrite: false });
  const shoreX = L.beachX - 27.2;
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1200, 1, 1).rotateX(-Math.PI / 2), foamMat);
  foam.position.set(shoreX, L.seaY + 0.02, 0);
  root.add(foam);

  // avenue
  const roads = new THREE.Group();
  const [x0, x1] = L.roadX, len = x1 - x0, cx = (x0 + x1) / 2;
  put(roads, box(len, 0.06, L.roadHalf * 2), mat('asphalt'), cx, 0.0, L.roadZ).castShadow = false;
  const white = paint(0xf2f0ea, 0.6), yellow = paint(0xf2c230, 0.6);
  // centre double yellow
  for (const dz of [-0.12, 0.12]) put(roads, box(len, 0.012, 0.12), yellow, cx, 0.035, L.roadZ + dz).castShadow = false;
  // dashed lane lines
  for (let x = x0 + 2; x < x1 - 2; x += 9) for (const dz of [-3.5, 3.5]) put(roads, box(4.5, 0.012, 0.13), white, x + 2.25, 0.035, L.roadZ + dz).castShadow = false;
  // edge lines
  for (const dz of [-L.roadHalf + 0.3, L.roadHalf - 0.3]) put(roads, box(len, 0.012, 0.13), white, cx, 0.035, L.roadZ + dz).castShadow = false;
  // sidewalks with curbs
  // sidewalks with curbs; the south ones (and both sides of the school street) leave gaps where the cross streets meet
  const walkRun = (ax0, ax1, zRoad, half, walk, side, gaps) => {
    const cuts = gaps.map((c) => [c.x - c.half, c.x + c.half]).sort((p, q) => p[0] - q[0]);
    let a = ax0;
    const pieces = [];
    for (const [g0, g1] of cuts) { if (g0 > a) pieces.push([a, g0]); a = Math.max(a, g1); }
    if (a < ax1) pieces.push([a, ax1]);
    const zc = zRoad + side * (half + walk / 2);
    for (const [p0, p1] of pieces) {
      const plen = p1 - p0, pcx = (p0 + p1) / 2;
      put(roads, rbox(plen, 0.16, walk, 0.03), mat('pavers'), pcx, 0.08, zc);
      put(roads, rbox(plen, 0.18, 0.28, 0.05), mat('concrete'), pcx, 0.09, zRoad + side * (half + 0.14));
      colliders.push({ min: [p0, 0, Math.min(zc - walk / 2, zc + walk / 2)], max: [p1, 0.16, Math.max(zc - walk / 2, zc + walk / 2)], tag: 'curb' });
    }
  };
  walkRun(x0, x1, L.roadZ, L.roadHalf, L.walk, -1, []);
  walkRun(x0, x1, L.roadZ, L.roadHalf, L.walk, 1, ROADS2.cross);
  // school street
  const A2 = ROADS2.avenue2, len2 = A2.x1 - A2.x0, cx2 = (A2.x0 + A2.x1) / 2;
  put(roads, box(len2, 0.06, A2.half * 2), mat('asphalt'), cx2, 0.0, A2.z).castShadow = false;
  for (const dz of [-0.12, 0.12]) put(roads, box(len2, 0.012, 0.12), yellow, cx2, 0.035, A2.z + dz).castShadow = false;
  for (let x = A2.x0 + 2; x < A2.x1 - 2; x += 9) for (const dz of [-3.5, 3.5]) put(roads, box(4.5, 0.012, 0.13), white, x + 2.25, 0.035, A2.z + dz).castShadow = false;
  for (const dz of [-A2.half + 0.3, A2.half - 0.3]) put(roads, box(len2, 0.012, 0.13), white, cx2, 0.035, A2.z + dz).castShadow = false;
  walkRun(A2.x0, A2.x1, A2.z, A2.half, A2.walk, -1, ROADS2.cross);
  walkRun(A2.x0, A2.x1, A2.z, A2.half, A2.walk, 1, []);
  // cross streets
  for (const c of ROADS2.cross) {
    const clen = c.z1 - c.z0, cz = (c.z0 + c.z1) / 2;
    put(roads, box(c.half * 2, 0.06, clen), mat('asphalt'), c.x, 0.002, cz).castShadow = false;
    for (const dx of [-0.12, 0.12]) put(roads, box(0.12, 0.012, clen - 8), yellow, c.x + dx, 0.037, cz).castShadow = false;
    for (const dx of [-c.half + 0.3, c.half - 0.3]) put(roads, box(0.13, 0.012, clen - 8), white, c.x + dx, 0.037, cz).castShadow = false;
    for (const side of [-1, 1]) {
      const xc = c.x + side * (c.half + c.walk / 2);
      const zA = c.z0 + 4, zB = c.z1 - 4;
      put(roads, rbox(c.walk, 0.16, zB - zA, 0.03), mat('pavers'), xc, 0.08, (zA + zB) / 2);
      put(roads, rbox(0.28, 0.18, zB - zA, 0.05), mat('concrete'), c.x + side * (c.half + 0.14), 0.09, (zA + zB) / 2);
      colliders.push({ min: [Math.min(xc - c.walk / 2, xc + c.walk / 2), 0, zA], max: [Math.max(xc - c.walk / 2, xc + c.walk / 2), 0.16, zB], tag: 'curb' });
    }
  }
  // Japan street: narrow two-lane road with sidewalks
  const [jx0, jx1] = [L.jMin[0], L.jMax[0]], jlen = jx1 - jx0, jcx = (jx0 + jx1) / 2;
  put(roads, box(jlen, 0.06, L.jRoadHalf * 2), mat('asphalt'), jcx, 0.0, 0).castShadow = false;
  for (let x = jx0 + 2; x < jx1 - 2; x += 6) put(roads, box(3, 0.012, 0.12), white, x + 1.5, 0.035, 0).castShadow = false;
  for (const dz of [-L.jRoadHalf + 0.25, L.jRoadHalf - 0.25]) put(roads, box(jlen, 0.012, 0.1), white, jcx, 0.035, dz).castShadow = false;
  for (const sgn of [-1, 1]) {
    const zc = sgn * (L.jRoadHalf + L.jWalk / 2);
    put(roads, rbox(jlen, 0.14, L.jWalk, 0.03), mat('pavers2'), jcx, 0.07, zc);
    put(roads, rbox(jlen, 0.16, 0.22, 0.04), mat('concrete'), jcx, 0.08, sgn * (L.jRoadHalf + 0.11));
    colliders.push({ min: [jx0, 0, Math.min(zc - L.jWalk / 2, zc + L.jWalk / 2)], max: [jx1, 0.14, Math.max(zc - L.jWalk / 2, zc + L.jWalk / 2)], tag: 'curb' });
  }
  root.add(bake(roads));
  return { root, colliders, sea, foam, jsea };
}
