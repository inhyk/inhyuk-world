import { addEndIslands } from './expedition-world.mjs';
import { B, I, ITEMS, MOBS } from './data.mjs';
import { W, H, idx, generateWorld, computeLight, makeRng, noise1, rleDecode, rleEncode } from './core.mjs';

export const SKINS = [
  { name: '하늘 탐험가', skin: '#c69c7a', shirt: '#2fa6b4', pants: '#3a3aa8', hair: '#3b2a1a' },
  { name: '숲의 모험가', skin: '#e4b895', shirt: '#61984b', pants: '#394942', hair: '#573c24' },
  { name: '보랏빛 여행자', skin: '#93674d', shirt: '#a36bd1', pants: '#303c67', hair: '#201d2c' },
  { name: '노을 기사', skin: '#f1caa2', shirt: '#e39a43', pants: '#744451', hair: '#9c542b' },
];
export const BOSS_HP = MOBS.summoner.hp;
export const bossPhase = (hp) => hp > BOSS_HP * 2 / 3 ? 1 : hp > BOSS_HP / 3 ? 2 : 3;

// 구버전의 640칸 저장을 행 단위로 옮겨 기존 건축물과 좌표를 보존한다.
export function restoreTerrain(w, saved) {
  const width = saved.width ?? 640;
  const tiles = rleDecode(saved.tiles, width * H);
  const meta = rleDecode(saved.meta, width * H);
  for (let y = 0; y < H; y++) {
    w.tiles.set(tiles.subarray(y * width, y * width + Math.min(width, W)), y * W);
    w.meta.set(meta.subarray(y * width, y * width + Math.min(width, W)), y * W);
  }
  if (saved.surface) w.surface.set(saved.surface);
  else if (width !== W) {
    for (let x = 0; x < width; x++) {
      for (let y = 20; y < H - 1; y++) {
        if ([B.GRASS, B.SNOW_GRASS, B.DIRT, B.SAND, B.STONE, B.GRAVEL].includes(w.tiles[idx(x, y)])) { w.surface[x] = y; break; }
      }
    }
  }
  // 배경은 캐기 전의 땅을 재현하되 새 블록의 뒤가 공중으로 보이지 않게 한다.
  if (saved.bg) w.bg.set(rleDecode(saved.bg, W * H));
  computeLight(w, 0, W - 1);
}
export const terrainSave = (w) => ({ width: W, tiles: rleEncode(w.tiles), meta: rleEncode(w.meta), bg: rleEncode(w.bg), surface: [...w.surface] });
export const remapIndex = (i, width = W) => Math.floor(i / width) * W + i % width;

export function put(w, x, y, t) { if (x > 0 && x < W - 1 && y > 0 && y < H - 1) { w.tiles[idx(x, y)] = t; w.meta[idx(x, y)] = 0; } }
export function makeVillage(w, center) {
  const floor = w.surface[center];
  const villagers = [];
  for (let x = center - 25; x <= center + 25; x++) {
    w.surface[x] = floor;
    for (let y = floor - 13; y < floor + 6; y++) put(w, x, y, y < floor ? B.AIR : y === floor ? B.GRASS : B.DIRT);
  }
  for (const [n, off] of [-18, -3, 12].entries()) {
    const x = center + off;
    for (let dx = 0; dx < 9; dx++) {
      put(w, x + dx, floor - 1, B.PLANKS);
      for (let dy = 2; dy <= 6; dy++) {
        const edge = dx === 0 || dx === 8;
        put(w, x + dx, floor - dy, edge ? B.OAK_LOG : B.AIR);
        w.bg[idx(x + dx, floor - dy)] = B.PLANKS;
      }
      for (let dy = 7; dy <= 9 - Math.abs(dx - 4) / 2; dy++) put(w, x + dx, floor - dy, B.STONE_BRICKS);
    }
    put(w, x + 8, floor - 2, B.DOOR_B); put(w, x + 8, floor - 3, B.DOOR_T);
    put(w, x, floor - 4, B.GLASS); put(w, x + 8, floor - 4, B.GLASS);
    put(w, x + 3, floor - 2, n === 0 ? B.CRAFTING : n === 1 ? B.FURNACE : B.CHEST);
    put(w, x + 5, floor - 4, B.TORCH);
    put(w, x + 5, floor - 2, B.BED_FOOT); put(w, x + 6, floor - 2, B.BED_HEAD);
    villagers.push({ x: x + 9.8, y: floor - 1.8, w: 0.6, h: 1.8, shop: n });
  }
  computeLight(w, center - 40, center + 40);
  return villagers;
}
export const villageChestHasDiamonds=(seed,index)=>makeRng((seed^index^0x6d2b79f5)>>>0)()<.2;
// Seed village supplies once; existing contents and removed chests belong to the player.
export function populateVillageChests(G) {
  const a=G.adventure;
  if(a.villageLootVersion===1&&a.villageDiamondVersion===1)return;
  const d=a.dimension==='overworld'?{w:G.w,chests:G.chests,villagers:a.villagers}:a.worlds.overworld;
  if(!d)return;
  for(const v of d.villagers??[]) {
    if(v.shop!==2)continue;
    const x=Math.round(v.x-6.8),y=Math.round(v.y-.2),i=idx(x,y);
    if(d.w.tiles[i]!==B.CHEST)continue;
    if(a.villageLootVersion!==1&&!d.chests.get(i)?.some(Boolean)){
      const loot=[[I.STEAK,8],[I.APPLE,6],[B.TORCH,16],[B.PLANKS,24],[I.IRON_INGOT,3],[I.STONE_PICK,1],[I.STONE_SWORD,1]];
      const slots=Array(27).fill(null);
      loot.forEach(([id,count],k)=>{slots[k]={id,count};if(ITEMS[id].tool)slots[k].dur=ITEMS[id].tool.dur;});
      d.chests.set(i,slots);
    }
    const contents=d.chests.get(i);
    if(a.villageDiamondVersion!==1&&contents?.some(Boolean)&&!contents.some(s=>s?.id===I.DIAMOND)&&villageChestHasDiamonds(d.w.seed,i)){
      const empty=contents.findIndex(s=>!s);if(empty>=0)contents[empty]={id:I.DIAMOND,count:3};
    }
  }
  a.villageLootVersion=1; a.villageDiamondVersion=1;
}
export function makeNether(seed) {
  const w = generateWorld(seed ^ 0x7e771e);
  for (let x = 0; x < W; x++) {
    const floor = 76 + Math.round(noise1(seed + 903, x / 30) * 14);
    w.surface[x] = floor;
    for (let y = 0; y < H; y++) {
      const i = idx(x, y);
      w.meta[i] = 0;
      w.tiles[i] = y === H - 1 || y < 3 ? B.BEDROCK : y >= floor ? B.NETHERRACK : B.AIR;
      w.bg[i] = y >= floor ? B.NETHERRACK : B.AIR;
      if (y > floor + 12 && y < H - 5 && noise1(seed + y, x / 9) > 0.72) { w.tiles[i] = B.LAVA; w.meta[i] = 8; }
      if (y === 4 && x % 13 < 3) w.tiles[i] = B.GLOWSTONE;
      if (y === floor && x % 39 < 7) w.tiles[i] = B.SOUL_SAND;
      if (Math.abs(x - W / 2) > 12 && x % 87 < 9 && y >= floor && y <= floor + 2) { w.tiles[i] = B.LAVA; w.meta[i] = 8; }
      if (Math.abs(x - W / 2) > 8 && x % 31 < 2 && y === floor - 1) w.tiles[i] = B.GLOWSTONE;
    }
  }
  addNetherFortress(w);
  computeLight(w, 0, W - 1);
  w.seed = seed;
  return w;
}
export function addNetherFortress(w) {
  const cx = W / 2 + 36, floor = w.surface[cx];
  for (let x = cx - 13; x <= cx + 13; x++) {
    w.surface[x] = floor;
    for (let y = floor - 12; y < floor + 5; y++) {
      put(w, x, y, y >= floor ? B.STONE_BRICKS : B.AIR);
      if (y < floor && y >= floor - 8) w.bg[idx(x, y)] = B.NETHERRACK;
    }
    if ((x - cx) % 9 === 0) for (let y = floor - 7; y < floor; y++) put(w, x, y, B.OBSIDIAN);
    put(w, x, floor - 8, B.STONE_BRICKS);
    if (x % 5 === 0) put(w, x, floor - 7, B.GLOWSTONE);
  }
  computeLight(w, cx - 20, cx + 20);
}
export function portalFrame(w, x, floor, kind = 'nether') {
  const material = kind === 'end' ? B.END_FRAME : B.OBSIDIAN;
  for (let dx = -1; dx <= 2; dx++) for (let dy = 0; dy <= 5; dy++) {
    put(w, x + dx, floor - dy, dx === -1 || dx === 2 || dy === 0 || dy === 5 ? material : B.AIR);
  }
  const portal={ x, y: floor - 4, w: 2, h: 4 };
  openPortalSides(w,{...portal,kind});
  return portal;
}
export function openPortalSides(w,p) {
  if(!portalIntact(w,p))return;
  for(const dx of[-1,2])for(let dy=0;dy<4;dy++)w.meta[idx(p.x+dx,p.y+dy)]|=64;
}
export function openEndScenery(w) {
  for(let x=W/2-85;x<=W/2+85;x++){
    const top=w.surface[x];
    if(Math.abs(x-W/2)>25&&x%17<3)for(let y=top-14;y<top;y++){
      const i=idx(x,y);if([B.OBSIDIAN,B.GLOWSTONE].includes(w.tiles[i]))w.meta[i]|=64;
    }
    const i=idx(x,top-1);if(x>=W/2+10&&x<W/2+20&&w.tiles[i]===B.PURPUR)w.meta[i]|=64;
  }
}
export function makeEnd(seed) {
  const w = generateWorld(seed);
  w.tiles.fill(B.AIR); w.bg.fill(B.AIR); w.meta.fill(0); w.surface.fill(H - 1);
  for (let x = 0; x < W; x++) {
    w.tiles[idx(x, H - 1)] = B.BEDROCK;
    const d = Math.abs(x - W / 2);
    if (d > 85) continue;
    const top = 81 + Math.floor(noise1(seed + 333, x / 12) * 4);
    w.surface[x] = top;
    for (let y = top; y < top + 5 + Math.floor((85 - d) / 4); y++) { w.tiles[idx(x, y)] = B.END_STONE; w.bg[idx(x, y)] = B.END_STONE; }
    if (d > 25 && x % 17 < 3) for (let y = top - 14; y < top; y++) w.tiles[idx(x, y)] = y === top - 14 ? B.GLOWSTONE : B.OBSIDIAN;
  }
  addEndIslands(w);
  // 작은 중앙 유적과 발광석이 있는 탐험 목적지.
  for (let x = W / 2 + 10; x < W / 2 + 20; x++) w.tiles[idx(x, w.surface[x] - 1)] = B.PURPUR;
  openEndScenery(w);
  computeLight(w, 0, W - 1);
  return w;
}
export function findPortal(w, px, py, kind = 'nether') {
  const material = kind === 'end' ? B.END_FRAME : B.OBSIDIAN;
  for (let x = Math.floor(px) - 5; x <= px + 5; x++) for (let y = Math.floor(py) - 6; y <= py + 3; y++) {
    if (x < 2 || x > W - 4 || y < 2 || y > H - 7) continue;
    let valid = true;
    for (let dx = -1; dx <= 2; dx++) for (let dy = 0; dy <= 5; dy++) {
      const t = w.tiles[idx(x + dx, y + dy)];
      if ((dx === -1 || dx === 2 || dy === 0 || dy === 5) ? t !== material : !portalInterior(t, kind)) valid = false;
    }
    if (valid) return { x, y: y + 1, w: 2, h: 4 };
  }
  return null;
}

export function insidePortal(player, portal) {
  return player.x >= portal.x && player.x + player.w <= portal.x + portal.w && player.y + player.h > portal.y && player.y < portal.y + portal.h;
}
// A placed portal tile is part of the opening, not an obstruction.
function portalInterior(t, kind) { return t === B.AIR || (kind === 'nether' && t === B.NETHER_PORTAL); }
export function portalIntact(w, portal) {
  const material = portal.kind === 'end' ? B.END_FRAME : B.OBSIDIAN;
  for (let dx = -1; dx <= 2; dx++) for (let dy = -1; dy <= 4; dy++) {
    const x = portal.x + dx, y = portal.y + dy;
    if (x < 0 || x >= W || y < 0 || y >= H) return false;
    const t = w.tiles[idx(x, y)];
    if ((dx === -1 || dx === 2 || dy === -1 || dy === 4) ? t !== material : !portalInterior(t, portal.kind)) return false;
  }
  return true;
}
