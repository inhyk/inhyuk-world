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
  townMin: [-300, -90], townMax: [320, 80],
  beachX: -286,         // land ends here, sand slopes to the sea
  seaY: -0.75,
  // Japan: a small island town far to the east, reached by plane
  jx: 2200,
  jMin: [2040, -70], jMax: [2340, 45],
  jRoadHalf: 3.5, jWalk: 2.5,
};
const JX = LAYOUT.jx;

/** Buildings: module under src/sites, builder, world position (feet level), yaw, map label. */
export const SITES = [
  { key: 'home', mod: 'home', fn: 'buildHome', pos: [-150, 0, -28], yaw: 0, label: '우리 집', color: '#f2a65a' },
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
  home: [-138.5, -16.5, Math.PI],
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
  return Math.abs(z - LAYOUT.roadZ) < LAYOUT.roadHalf + 0.3 && x > LAYOUT.roadX[0] - 1 && x < LAYOUT.roadX[1] + 1;
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
  return h;
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

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

function heightMesh(minX, maxX, minZ, maxZ, step, material) {
  const nx = Math.round((maxX - minX) / step), nz = Math.round((maxZ - minZ) / step);
  const g = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ, nx, nz).rotateX(-Math.PI / 2);
  g.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, groundAt(x, z));
    uv.setXY(i, x, z);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material);
  m.receiveShadow = true;
  return m;
}

export function buildWorld(scene) {
  const L = LAYOUT;
  const root = new THREE.Group();
  root.name = 'world';
  scene.add(root);
  const colliders = [];

  // terrain: grass for the land, sand for the beach
  root.add(heightMesh(L.beachX, 760, -560, 560, 4, mat('grass')));
  root.add(heightMesh(-900, L.beachX, -560, 560, 4, mat('sand')));
  // Japan island
  root.add(heightMesh(JX - 420, JX + 420, -520, L.jMax[1] + 22, 4, mat('grass')));
  root.add(heightMesh(JX - 420, JX + 420, L.jMax[1] + 22, 420, 4, mat('sand')));
  const jsea = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat('water'));
  { const g = new THREE.PlaneGeometry(2800, 2600).rotateX(-Math.PI / 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2800, uv.getY(i) * 2600); jsea.geometry = g; }
  jsea.position.set(JX - 560, L.seaY - 0.05, 100);
  root.add(jsea);

  // sea
  const seaGeo = new THREE.PlaneGeometry(2400, 2400, 1, 1).rotateX(-Math.PI / 2);
  const uvs = seaGeo.attributes.uv; for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getX(i) * 2400, uvs.getY(i) * 2400);
  const sea = new THREE.Mesh(seaGeo, mat('water'));
  sea.position.set(L.beachX - 1200 - 20, L.seaY, 0);
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
  for (const s of [-1, 1]) {
    const zc = L.roadZ + s * (L.roadHalf + L.walk / 2);
    put(roads, rbox(len, 0.16, L.walk, 0.03), mat('pavers'), cx, 0.08, zc);
    put(roads, rbox(len, 0.18, 0.28, 0.05), mat('concrete'), cx, 0.09, L.roadZ + s * (L.roadHalf + 0.14));
    colliders.push({ min: [x0, 0, Math.min(zc - L.walk / 2, zc + L.walk / 2)], max: [x1, 0.16, Math.max(zc - L.walk / 2, zc + L.walk / 2)], tag: 'curb' });
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
