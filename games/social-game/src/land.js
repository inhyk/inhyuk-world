// 인혁 계획 6: "언덕 같은 데 계속 가면 나무도 없고 땅도 없어져. 나무랑 땅이 보이게 해 줘."
// Nature all the way to the edge of the land (the ground itself is in world.js, EDGE):
//  - more trees, bushes and rocks on the hills inside the fence (they break like the others)
//  - a thick wood just past the fence (same detailed trees, but scenery: no breaking, no colliders)
//  - a wooden fence with "더 이상 갈 수 없어요" signs on the hills, buoys in the sea
//  - forests on the mountains beyond: cheap instanced trees in big blocks that never change, so
//    nothing has to be updated per frame (the fog hides the far ones)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EDGE, LAYOUT, edgePath, groundAt, landOut } from './world.js';
import { rng, worldNoise } from './noise.js';
import { paint } from './mat.js';

/** The 곰 숲 (wildlife.js BEAR_WOOD) is thick already: no new trees there, so the bears' home stays put. */
const BEAR_WOOD = [400, 0, 120];
const AIRPORT = [180, -152, 352, -28]; // airport, runway and apron (as in wildlife.js)

/** Is (x, z) wild land of this land where trees may grow (not town, beach, sea or airport)? */
function wild(E, x, z, h) {
  if (h < LAYOUT.seaY + 1.2) return false;
  if (E === EDGE.home) {
    if (x < LAYOUT.beachX + 12) return false;
    if (x > AIRPORT[0] && x < AIRPORT[2] && z > AIRPORT[1] && z < AIRPORT[3]) return false;
  } else if (z > LAYOUT.jMax[1] + 10) return false;
  return true;
}

/**
 * Trees for the hills (deco.js plants them): [{kind, x, z, ry, s, solid}]. solid = inside the fence
 * (breakable, with a trunk collider); the others make the wood just past the fence. Seeded, so every
 * computer gets the same trees (the shared town names broken ones by their place in the list).
 */
export function landTrees(E = EDGE.home, free = () => true) {
  const R = rng(E === EDGE.home ? 6061 : 6062);
  const out = [];
  const [x0, z0] = E.min, [x1, z1] = E.max, P = E.play;
  const kinds = E === EDGE.home ? ['pine', 'pine', 'round', 'round2'] : ['pine', 'pine', 'maple'];
  // inside the fence, past the old forest ring: clumps of wood with meadows between
  if (E === EDGE.home) {
    const C = 13;
    for (let x = x0 - 20; x < x1 + P; x += C) for (let z = z0 - P; z < z1 + P; z += C) {
      const px = x + R() * C, pz = z + R() * C, r1 = R(), r2 = R(), ry = R() * 6.28, sc = R();
      const o = landOut(E, px, pz);
      if (o < 16 || o > P - 5) continue;
      if (Math.hypot(px - BEAR_WOOD[0], pz - BEAR_WOOD[1]) < BEAR_WOOD[2]) continue;
      const h = groundAt(px, pz);
      if (!wild(E, px, pz, h) || !free(px, pz)) continue;
      const n = worldNoise(px, pz, 0.011, 3, 41);
      const wood = n > 0.52;
      const pTree = (wood ? 0.5 : 0.06) * Math.min(1, o / 60);
      if (r1 < pTree) out.push({ kind: kinds[Math.floor(r2 * kinds.length)], x: px, z: pz, ry, s: 0.95 + sc * 0.5, solid: true });
      else if (r1 < pTree + 0.07) out.push({ kind: r2 < 0.5 ? 'bush' : 'bush2', x: px, z: pz, ry, s: 0.8 + sc * 0.4, solid: true });
      else if (r1 < pTree + 0.1) out.push({ kind: r2 < 0.6 ? 'rock' : 'rock2', x: px, z: pz, ry, s: 0.8 + sc * 0.6, solid: true });
      else if (!wood && r1 < pTree + 0.13) out.push({ kind: r2 < 0.5 ? 'flower' : 'flower2', x: px, z: pz, ry, s: 0.8, solid: true });
    }
  }
  // just past the fence: a thick wood
  for (const p of edgePath(E, 6)) {
    for (let k = 0; k < 4; k++) {
      const d = 6 + R() * 40, side = (R() - 0.5) * 6, ry = R() * 6.28, sc = R(), r2 = R();
      const px = p.x - p.nx * d - p.nz * side, pz = p.z - p.nz * d + p.nx * side;
      if (landOut(E, px, pz) < P + 2.5) continue;
      const h = groundAt(px, pz);
      if (!wild(E, px, pz, h)) continue;
      if (R() > 0.35) continue;
      out.push({ kind: kinds[Math.floor(r2 * kinds.length)], x: px, z: pz, ry, s: 1 + sc * 0.6, solid: false });
    }
  }
  return out;
}

/** Tiny trees for the mountain forests (about 40 triangles), vertex coloured. */
function tinyTree(kind) {
  const parts = [];
  const add = (g, color, y) => {
    if (g.index) g = g.toNonIndexed();
    g.translate(0, y, 0);
    const c = new THREE.Color(color), n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    parts.push(g);
  };
  // leaves are white here: each copy gets its own green (instance colour), the trunk just darkens
  add(new THREE.CylinderGeometry(0.14, 0.24, 3, 5, 1, true), 0xb08a60, 1.5);
  if (kind === 'pine') {
    add(new THREE.ConeGeometry(2.0, 4.6, 7), 0xffffff, 4.6);
    add(new THREE.ConeGeometry(1.45, 3.6, 7), 0xffffff, 6.9);
  } else {
    const ico = new THREE.IcosahedronGeometry(2.5, 0);
    ico.scale(1, 0.92, 1);
    add(ico, 0xffffff, 5.4);
  }
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}

/** Wooden fence board with the sign text. */
function signTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#d8b07a'; x.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 9; i++) { x.fillStyle = `rgba(90,55,25,${0.07 + (i % 3) * 0.04})`; x.fillRect(0, 10 + i * 28, 512, 3); }
  x.strokeStyle = '#6a4220'; x.lineWidth = 14; x.strokeRect(7, 7, 498, 242);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '700 60px Jua, "Apple SD Gothic Neo", sans-serif'; x.fillStyle = '#c0392b'; x.fillText('🚧 멈춰요!', 256, 82);
  x.font = '700 50px Jua, "Apple SD Gothic Neo", sans-serif'; x.fillStyle = '#2b1a0c'; x.fillText('더 이상 갈 수 없어요', 256, 170);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sv = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
function instanced(geo, material, list, parent, { cast = false } = {}) {
  if (!list.length) return null;
  const im = new THREE.InstancedMesh(geo, material, list.length);
  list.forEach((m, i) => im.setMatrixAt(i, m));
  im.castShadow = cast; im.receiveShadow = true;
  im.computeBoundingSphere();
  parent.add(im);
  return im;
}

/**
 * Fence, signs and buoys for one land, plus its mountain forests. Returns the group (static: its
 * matrices are worked out once; places.cullFar hides it when the fog covers it).
 */
function dressLand(E, scene, places, name) {
  const root = new THREE.Group();
  root.name = name;
  scene.add(root);
  const R = rng(E === EDGE.home ? 7071 : 7072);
  const sea = LAYOUT.seaY;
  // ---- fence: posts every 2.5 m and two rails, following the ground; buoys where it is sea
  const path = edgePath(E, 2.5);
  const posts = [], rails = [], buoys = [], signs = [];
  const onLand = (p) => groundAt(p.x, p.z) > sea + 0.15;
  let sinceSign = 60;
  for (let i = 0; i < path.length; i++) {
    const a = path[i], b = path[(i + 1) % path.length];
    const ha = groundAt(a.x, a.z), hb = groundAt(b.x, b.z);
    if (ha > sea + 0.15) {
      posts.push(m4.compose(v.set(a.x, ha + 0.55, a.z), q.identity(), sv.set(1, 1, 1)).clone());
      if (hb > sea + 0.15 && Math.hypot(b.x - a.x, b.z - a.z) < 4) {
        const len = Math.hypot(b.x - a.x, b.z - a.z, hb - ha);
        const dir = new THREE.Vector3(b.x - a.x, hb - ha, b.z - a.z).normalize();
        q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
        for (const y of [0.42, 0.9]) rails.push(m4.compose(v.set((a.x + b.x) / 2, (ha + hb) / 2 + y, (a.z + b.z) / 2), q, sv.set(len, 1, 1)).clone());
      }
      sinceSign += 2.5;
      if (sinceSign > 110 && onLand(path[Math.max(0, i - 2)]) && onLand(b)) {
        sinceSign = 0;
        const yaw = Math.atan2(a.nx, a.nz); // the board faces the town
        signs.push({ x: a.x + a.nx * 0.9, z: a.z + a.nz * 0.9, yaw });
      }
    } else if (ha < sea - 0.3 && i % 3 === 0) {
      buoys.push(m4.compose(v.set(a.x, sea + 0.05, a.z), q.identity(), sv.set(1, 1, 1)).clone());
    }
  }
  const wood = paint(0x8a6440, 0.85), dark = paint(0x6a4a2e, 0.9);
  instanced(new THREE.BoxGeometry(0.16, 1.15, 0.16), dark, posts, root, { cast: true });
  instanced(new THREE.BoxGeometry(1, 0.1, 0.06), wood, rails, root, { cast: true });
  instanced(new THREE.SphereGeometry(0.45, 10, 6), paint(0xff7a2a, 0.5), buoys, root);
  // ---- signs: two posts, a board and its face
  const sPost = [], sBoard = [], sFace = [];
  for (const s of signs) {
    const h = groundAt(s.x, s.z);
    q.setFromAxisAngle(up, s.yaw);
    const c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
    for (const dx of [-0.95, 0.95]) sPost.push(m4.compose(v.set(s.x + c * dx, h + 1.05, s.z - sn * dx), q, sv.set(1, 1, 1)).clone());
    sBoard.push(m4.compose(v.set(s.x, h + 1.75, s.z), q, sv.set(1, 1, 1)).clone());
    sFace.push(m4.compose(v.set(s.x + sn * 0.045, h + 1.75, s.z + c * 0.045), q, sv.set(1, 1, 1)).clone());
  }
  instanced(new THREE.CylinderGeometry(0.07, 0.08, 2.1, 8), dark, sPost, root, { cast: true });
  instanced(new THREE.BoxGeometry(2.2, 1.1, 0.08), wood, sBoard, root, { cast: true });
  instanced(new THREE.PlaneGeometry(2.1, 1.0), new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.8 }), sFace, root);

  // ---- mountain forests: past the wood by the fence out to the coast, in big blocks
  const BLOCK = 640, C = 10;
  const blocks = new Map();
  const reach = E.coast[0];
  const [x0, z0] = E.min, [x1, z1] = E.max;
  for (let x = x0 - reach; x < x1 + reach; x += C) for (let z = z0 - reach; z < z1 + reach; z += C) {
    const px = x + R() * C, pz = z + R() * C, r1 = R(), r2 = R(), ry = R() * 6.28, sc = R(), tint = R();
    const o = landOut(E, px, pz);
    if (o < E.play + 40 || o > reach) continue;
    if (E === EDGE.home ? px > 1480 : px < 1520) continue;
    const h = groundAt(px, pz);
    if (!wild(E, px, pz, h)) continue;
    const n = worldNoise(px, pz, 0.006, 3, 43);
    let p = n > 0.45 ? 0.85 : 0.1;
    if (h > 140) p *= 0.45; // bare rocky tops
    if (r1 > p) continue;
    const key = `${Math.floor(px / BLOCK)},${Math.floor(pz / BLOCK)}`;
    if (!blocks.has(key)) blocks.set(key, { pine: [], round: [] });
    const kind = r2 < 0.68 ? 'pine' : 'round';
    const s = 1.1 + sc * 1.0;
    blocks.get(key)[kind].push({ m: m4.compose(v.set(px, h - 0.2, pz), q.setFromAxisAngle(up, ry), sv.set(s, s * (0.9 + tint * 0.3), s)).clone(), tint });
  }
  const geo = { pine: tinyTree('pine'), round: tinyTree('round') };
  const tm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  const col = new THREE.Color();
  const shades = { pine: [0x2f4a2c, 0x38552f, 0x2a4530], round: [0x4f7a34, 0x5a8236, 0x6a8a3a] };
  let forest = 0;
  for (const b of blocks.values()) for (const kind of ['pine', 'round']) {
    const list = b[kind];
    const im = instanced(geo[kind], tm, list.map((t) => t.m), root);
    if (!im) continue;
    list.forEach((t, i) => im.setColorAt(i, col.setHex(shades[kind][Math.floor(t.tint * 3) % 3])));
    im.instanceColor.needsUpdate = true;
    im.name = 'mountain-forest';
    forest += list.length;
  }
  root.userData.forest = forest;
  root.userData.signs = signs.length;
  root.updateMatrixWorld(true);
  root.traverse((o) => { o.matrixAutoUpdate = false; });
  // the fog hides each land from the other one
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  places?.cullable(root, cx, cz, Math.hypot(x1 - x0, z1 - z0) / 2 + reach);
  places?.aoSkip.push(root);
  return root;
}

/** Fences, signs, buoys and mountain forests around the town and around the Japan island. */
export function dressEdges({ scene, places }) {
  return { home: dressLand(EDGE.home, scene, places, 'edge-home'), japan: dressLand(EDGE.japan, scene, places, 'edge-japan') };
}
