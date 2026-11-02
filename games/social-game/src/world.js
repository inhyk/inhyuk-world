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
};

/** Buildings: module under src/sites, builder, world position (feet level), yaw, map label. */
export const SITES = [
  { key: 'home', mod: 'home', fn: 'buildHome', pos: [-150, 0, -28], yaw: 0, label: '우리 집', color: '#f2a65a' },
  { key: 'store', mod: 'store', fn: 'buildStore', pos: [-110, 0, -17.5], yaw: 0, label: '편의점', color: '#5ac8f2' },
  { key: 'office', mod: 'office', fn: 'buildOffice', pos: [40, 0, -31], yaw: 0, label: '세온 컴퍼니', color: '#7a9cff' },
  { key: 'restaurant', mod: 'restaurant', fn: 'buildRestaurant', pos: [112, 0, -19], yaw: 0, label: '고깃집', color: '#ff7a5a' },
  { key: 'other', mod: 'othercompany', fn: 'buildOtherCompany', pos: [205, 0, 22], yaw: Math.PI, label: '별빛테크', color: '#c98aff' },
  { key: 'pension', mod: 'pension', fn: 'buildPension', pos: [-297, -0.3, -26], yaw: -Math.PI / 2, label: '바다 펜션', color: '#f2e05a' },
];

/** Car parking spots: [x, z, yaw] (yaw 0 faces -Z). */
export const PARKING = {
  home: [-138.5, -16.5, Math.PI],
  office: [70, -22, 0],
  restaurant: [126, -16, 0],
  other: [226, 18, Math.PI],
  beach: [-274, -20, Math.PI / 2],
};

/** Flat pads under buildings on sloped ground: [minX, minZ, maxX, maxZ, height]. */
const PADS = [[-305, -35, -288, -17, -0.3]];

export function isRoad(x, z) {
  return Math.abs(z - LAYOUT.roadZ) < LAYOUT.roadHalf + 0.3 && x > LAYOUT.roadX[0] - 1 && x < LAYOUT.roadX[1] + 1;
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Terrain height at (x, z). Flat town, rolling hills around it, a beach sloping into the sea. */
export function groundAt(x, z) {
  const L = LAYOUT;
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
  root.add(bake(roads));
  return { root, colliders, sea, foam };
}
