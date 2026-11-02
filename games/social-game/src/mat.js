// Shared material library. Geometry made with geom.js has metric UVs (1 uv unit = 1 metre), so
// each material sets its texture repeat from `tile` (metres per texture) and every surface gets the
// same texel density. Use mat('oakFloor'), or paint(0xff8800) / textured('fabric', {...}) for one-offs.
import * as THREE from 'three';
import { tex } from './tex.js';

const cache = new Map();

function withTex(gen, params, tile, opts = {}) {
  const t = tex(gen, params);
  const rep = 1 / tile;
  const clone = (x) => { const c = x.clone(); c.repeat.set(rep, rep); c.needsUpdate = true; return c; };
  const Mat = opts.physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const m = new Mat({
    map: clone(t.map),
    normalMap: clone(t.normalMap),
    roughnessMap: clone(t.roughnessMap),
    roughness: opts.roughness ?? 1,
    metalness: opts.metalness ?? 0,
    color: opts.tint ?? 0xffffff,
  });
  m.normalScale.set(opts.normal ?? 1, opts.normal ?? 1);
  if (opts.physical) {
    if (opts.clearcoat) { m.clearcoat = opts.clearcoat; m.clearcoatRoughness = opts.clearcoatRoughness ?? 0.08; }
    if (opts.sheen) { m.sheen = opts.sheen; m.sheenRoughness = 0.6; m.sheenColor = new THREE.Color(opts.sheenColor ?? 0xffffff); }
  }
  if (opts.envMapIntensity != null) m.envMapIntensity = opts.envMapIntensity;
  return m;
}

/** Named materials. tile = metres covered by one texture repeat. */
const DEFS = {
  // floors
  oakFloor: () => withTex('planks', { color: 0xb68558 }, 2.4, { normal: 0.6 }),
  darkFloor: () => withTex('planks', { color: 0x6e4a33, seed: 9 }, 2.4, { normal: 0.6 }),
  bathTile: () => withTex('tiles', { color: 0xf3f2ee, count: 6 }, 1.2, { normal: 0.5 }),
  wallTile: () => withTex('tiles', { color: 0xdfe9ec, count: 8, groutWidth: 0.025 }, 1.2, { normal: 0.4 }),
  floorTile: () => withTex('tiles', { color: 0xc9c5bd, grout: 0x8e8a82, count: 2, marble: true, rough: 0.28 }, 1.2, { normal: 0.5 }),
  marble: () => withTex('marble', {}, 3, { normal: 0.2 }),
  carpet: () => withTex('carpet', { color: 0x56606e }, 2, { normal: 0.8 }),
  carpetWarm: () => withTex('carpet', { color: 0x8a6f5a, seed: 7 }, 2, { normal: 0.8 }),
  // walls
  plaster: () => withTex('plaster', { color: 0xf1ece2 }, 3, { normal: 0.25 }),
  plasterWarm: () => withTex('plaster', { color: 0xead8bf, seed: 3 }, 3, { normal: 0.25 }),
  plasterSage: () => withTex('plaster', { color: 0xc9d4c0, seed: 5 }, 3, { normal: 0.25 }),
  plasterBlue: () => withTex('plaster', { color: 0xc3d3e3, seed: 6 }, 3, { normal: 0.25 }),
  plasterGray: () => withTex('plaster', { color: 0xd9d8d4, seed: 8 }, 3, { normal: 0.25 }),
  concrete: () => withTex('concrete', {}, 4, { normal: 0.6 }),
  brick: () => withTex('brick', {}, 1.6, { normal: 1.2 }),
  brickDark: () => withTex('brick', { color: 0x6d3b2f, mortar: 0x9c958b, seed: 4 }, 1.6, { normal: 1.2 }),
  sidingWhite: () => withTex('siding', { color: 0xeee8da }, 1.6, { normal: 0.8 }),
  sidingBlue: () => withTex('siding', { color: 0x8fb0c8 }, 1.6, { normal: 0.8 }),
  roof: () => withTex('shingles', {}, 2, { normal: 1.2 }),
  roofRed: () => withTex('shingles', { color: 0x9b4a36, seed: 2 }, 2, { normal: 1.2 }),
  // outdoors
  asphalt: () => withTex('asphalt', {}, 6, { normal: 0.7 }),
  pavers: () => withTex('pavers', {}, 2.4, { normal: 0.8 }),
  pavers2: () => withTex('pavers', { color: 0xc9b9a0, count: 6, seed: 3 }, 2.4, { normal: 0.8 }),
  grass: () => withTex('grass', {}, 5, { normal: 0.9 }),
  dirt: () => withTex('dirt', {}, 3, { normal: 1 }),
  sand: () => withTex('sand', {}, 4, { normal: 0.6 }),
  bark: () => withTex('bark', {}, 1.2, { normal: 1.4 }),
  stone: () => withTex('stone', {}, 1.5, { normal: 1.2 }),
  mossStone: () => withTex('stone', { moss: true, seed: 3 }, 1.5, { normal: 1.2 }),
  leaves: () => withTex('leaves', {}, 1.5, { normal: 0.8, roughness: 1 }),
  // furniture
  walnut: () => withTex('wood', { color: 0x6b4529 }, 1.2, { normal: 0.4 }),
  oak: () => withTex('wood', { color: 0xc09060, seed: 5 }, 1.2, { normal: 0.4 }),
  birch: () => withTex('wood', { color: 0xdcc6a2, seed: 8 }, 1.2, { normal: 0.35 }),
  whiteWood: () => withTex('smooth', { color: 0xf2efe8, rough: 0.45 }, 1, { normal: 0.2 }),
  fabricBlue: () => withTex('fabric', { color: 0x5874a0 }, 0.5, { normal: 0.7, physical: true, sheen: 0.6 }),
  fabricGray: () => withTex('fabric', { color: 0x8c8c8a, seed: 3 }, 0.5, { normal: 0.7, physical: true, sheen: 0.6 }),
  fabricBeige: () => withTex('fabric', { color: 0xcdbb9c, seed: 4 }, 0.5, { normal: 0.7, physical: true, sheen: 0.6 }),
  fabricGreen: () => withTex('fabric', { color: 0x5f7d5a, seed: 6 }, 0.5, { normal: 0.7, physical: true, sheen: 0.6 }),
  linen: () => withTex('fabric', { color: 0xf3f0ea, weave: 220, seed: 9 }, 0.5, { normal: 0.5, physical: true, sheen: 0.5 }),
  leather: () => withTex('leather', {}, 0.6, { normal: 0.6 }),
  leatherBrown: () => withTex('leather', { color: 0x6a4027 }, 0.6, { normal: 0.6 }),
  steel: () => withTex('brushed', {}, 0.8, { metalness: 1, normal: 0.2 }),
  darkSteel: () => withTex('brushed', { color: 0x4a4d52 }, 0.8, { metalness: 1, normal: 0.2 }),
  chrome: () => new THREE.MeshStandardMaterial({ color: 0xe8e8ea, metalness: 1, roughness: 0.08 }),
  gold: () => new THREE.MeshStandardMaterial({ color: 0xd8b25a, metalness: 1, roughness: 0.25 }),
  ceramic: () => withTex('smooth', { color: 0xf8f8f6, rough: 0.12 }, 1, { normal: 0.1, physical: true, clearcoat: 0.6 }),
  whitePlastic: () => withTex('smooth', { color: 0xf0f0ee, rough: 0.38 }, 1, { normal: 0.15 }),
  blackPlastic: () => withTex('smooth', { color: 0x222326, rough: 0.42 }, 1, { normal: 0.15 }),
  grayPlastic: () => withTex('smooth', { color: 0x8d9095, rough: 0.45 }, 1, { normal: 0.15 }),
  rubber: () => new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.92 }),
  glass: () => new THREE.MeshPhysicalMaterial({ color: 0xdbeef2, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.22, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide }),
  tintedGlass: () => new THREE.MeshPhysicalMaterial({ color: 0x6f8f9a, metalness: 0.2, roughness: 0.06, transparent: true, opacity: 0.55, envMapIntensity: 2, depthWrite: false }),
  mirror: () => new THREE.MeshStandardMaterial({ color: 0xdfe6ea, metalness: 1, roughness: 0.02 }),
  water: () => {
    const t = tex('water', { size: 512 });
    const n = t.normalMap.clone(); n.repeat.set(1 / 9, 1 / 9); n.needsUpdate = true;
    const m = new THREE.MeshPhysicalMaterial({ color: 0x1d6a86, metalness: 0, roughness: 0.16, normalMap: n, envMapIntensity: 0.75, transparent: true, opacity: 0.93, clearcoat: 0.4, clearcoatRoughness: 0.1 });
    m.normalScale.set(0.6, 0.6);
    return m;
  },
  skin: () => withTex('smooth', { color: 0xf1c9a5, rough: 0.55 }, 1, { normal: 0.1, physical: true, sheen: 0.3, sheenColor: 0xffd8c0 }),
  hair: () => withTex('fabric', { color: 0x2b2420, weave: 300 }, 0.3, { normal: 0.8, roughness: 0.75 }),
  lampGlow: () => new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffe2b0, emissiveIntensity: 2.2, roughness: 0.4 }),
  coolGlow: () => new THREE.MeshStandardMaterial({ color: 0xf4f8ff, emissive: 0xeaf2ff, emissiveIntensity: 2.4, roughness: 0.4 }),
};

/** mat('oakFloor') → shared material (do not mutate; use paint() or .clone() for variants). */
export function mat(name) {
  if (cache.has(name)) return cache.get(name);
  const def = DEFS[name];
  if (!def) throw new Error('unknown material ' + name);
  const m = def();
  m.name = name;
  cache.set(name, m);
  return m;
}

/** Plain painted surface with micro-noise (never perfectly flat). Cached by args. */
export function paint(color, roughness = 0.5, metalness = 0, extra = {}) {
  const key = `paint:${color}:${roughness}:${metalness}:${JSON.stringify(extra)}`;
  if (cache.has(key)) return cache.get(key);
  const m = withTex('smooth', { color: 0xffffff, rough: 1 }, 1, { normal: 0.12, physical: !!(extra.clearcoat || extra.sheen), clearcoat: extra.clearcoat, sheen: extra.sheen });
  m.color.set(color);
  m.roughness = roughness;
  m.metalness = metalness;
  if (extra.emissive != null) { m.emissive.set(extra.emissive); m.emissiveIntensity = extra.emissiveIntensity ?? 1; }
  m.name = key;
  cache.set(key, m);
  return m;
}

/** One-off textured material from any tex.js generator: textured('fabric', {color: 0xaa3344}, 0.5). */
export function textured(gen, params, tile = 1, opts = {}) {
  const key = `tex:${gen}:${JSON.stringify(params)}:${tile}:${JSON.stringify(opts)}`;
  if (cache.has(key)) return cache.get(key);
  const m = withTex(gen, params, tile, opts);
  m.name = key;
  cache.set(key, m);
  return m;
}

/** Emissive material for lamps, screens, signs; registered so the day cycle can dim it. */
export function glow(color = 0xfff1d6, intensity = 2, map = null) {
  const m = new THREE.MeshStandardMaterial({ color: map ? 0xffffff : color, emissive: map ? 0xffffff : color, emissiveIntensity: intensity, emissiveMap: map, map, roughness: 0.4 });
  return m;
}

export const MATERIAL_NAMES = Object.keys(DEFS);
