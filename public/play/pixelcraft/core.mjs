// 화면과 상관없는 계산: 난수, 지형 만들기, 빛, 물·용암 흐름, 몸 충돌, 가방, 조합법, 저장 압축.
// 브라우저 없이 node 로도 돌아가야 한다 (games/pixelcraft/core.test.mjs).
import { B, BLOCKS, ITEMS, RECIPES, isSolid, maxStack } from './data.mjs';

export const W = 1280;
export const H = 160;
export const SEA = 70;
export const BIOME = { PLAINS: 0, FOREST: 1, DESERT: 2, SNOW: 3, OCEAN: 4 };
export const BIOME_NAMES = ['초원', '숲', '사막', '눈 덮인 숲', '바다'];

// ---- 난수와 노이즈 ----
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(seed, x, y) {
  let h = (seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const fade = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
export function noise1(seed, x) {
  const i = Math.floor(x);
  return lerp(hash2(seed, i, 0), hash2(seed, i + 1, 0), fade(x - i));
}
export function noise2(seed, x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = fade(x - ix), fy = fade(y - iy);
  const a = lerp(hash2(seed, ix, iy), hash2(seed, ix + 1, iy), fx);
  const b = lerp(hash2(seed, ix, iy + 1), hash2(seed, ix + 1, iy + 1), fx);
  return lerp(a, b, fy);
}
function fbm1(seed, x, oct) {
  let sum = 0, amp = 1, norm = 0, f = 1;
  for (let o = 0; o < oct; o++) {
    sum += noise1(seed + o * 101, x * f) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}
export function seedFromText(text) {
  const s = String(text ?? '').trim();
  if (/^-?\d+$/.test(s)) return Number(s) >>> 0;
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}

// ---- 지형 ----
export const idx = (x, y) => y * W + x;

export function generateWorld(seed) {
  const tiles = new Uint16Array(W * H);
  const bg = new Uint16Array(W * H);
  const meta = new Uint8Array(W * H);
  const surface = new Int16Array(W);
  const biome = new Uint8Array(W);
  const r = makeRng(seed ^ 0x9e3779b9);

  for (let x = 0; x < W; x++) {
    const t = fbm1(seed + 11, x / 110, 3);
    const m = fbm1(seed + 23, x / 60, 2);
    let b = t > 0.61 ? BIOME.DESERT : t < 0.37 ? BIOME.SNOW : m > 0.5 ? BIOME.FOREST : BIOME.PLAINS;
    // 처음 서는 가운데는 나무가 있는 곳이어야 한다
    if (Math.abs(x - W / 2) < 36) b = m > 0.45 ? BIOME.FOREST : BIOME.PLAINS;
    biome[x] = b;
    let h = 59 + (fbm1(seed + 1, x / 95, 4) - 0.5) * 46 + (noise1(seed + 5, x / 13) - 0.5) * 5;
    const mount = fbm1(seed + 7, x / 130, 2);
    if (mount > 0.6) h -= (mount - 0.6) * 90;
    if (b === BIOME.DESERT) h = lerp(h, 64, 0.45);
    surface[x] = Math.round(Math.max(26, Math.min(96, h)));
  }
  // 서쪽의 넓은 바다: 모래 해변에서 깊은 해저까지 부드럽게 낮아진다.
  for(let x=95;x<=235;x++){
    const depth=Math.min(x-95,235-x,26);
    surface[x]=SEA+Math.round(depth*.65);biome[x]=BIOME.OCEAN;
  }
  // 다른 바이옴 안에는 드문 작은 물웅덩이가 있다. 수면 높이는 장소마다 다르다.
  const ponds=[];
  for(const center of [300,530,965]){
    const water=surface[center]+1,half=4+Math.floor(noise1(seed+819,center)*4);
    ponds.push({center,water,half});
    for(let x=center-half;x<=center+half;x++)surface[x]=water+Math.max(1,Math.round((1-Math.abs(x-center)/(half+1))*3));
  }
  // 처음 서는 곳(가운데)은 물에 잠기지 않게 살짝 들어 올린다
  for (let x = W / 2 - 14; x < W / 2 + 14; x++) surface[x] = Math.min(surface[x], SEA - 4 + Math.round(Math.abs(x - W / 2) / 6));

  for (let x = 0; x < W; x++) {
    const s = surface[x], b = biome[x];
    const dirt = 3 + Math.floor(noise1(seed + 9, x / 6) * 3);
    const wet = s >= SEA - 1;
    for (let y = s; y < H; y++) {
      const i = idx(x, y);
      let t;
      if (y === s) t = wet ? (noise1(seed + 13, x / 9) > 0.6 ? B.GRAVEL : B.SAND) : b === BIOME.DESERT ? B.SAND : b === BIOME.SNOW ? B.SNOW_GRASS : B.GRASS;
      else if (y < s + dirt) t = b === BIOME.DESERT || wet ? B.SAND : B.DIRT;
      else if (b === BIOME.DESERT && y < s + dirt + 4) t = B.SANDSTONE;
      else t = B.STONE;
      if (y >= H - 1 || (y >= H - 5 && r() < (y - (H - 6)) / 5)) t = B.BEDROCK;
      tiles[i] = t;
      bg[i] = t === B.GRASS || t === B.SNOW_GRASS ? B.DIRT : t === B.GRAVEL ? B.SAND : t === B.BEDROCK ? B.STONE : t;
    }
  }

  // 동굴: 구불구불 파고 들어가는 벌레 굴 + 깊은 곳의 넓은 방
  const carve = (cx, cy, rad) => {
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++) {
      for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
        if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) continue;
        if ((x - cx) ** 2 + ((y - cy) * 1.15) ** 2 > rad * rad) continue;
        const i = idx(x, y);
        if (tiles[i] === B.BEDROCK || y < surface[x]) continue;
        if (surface[x] >= SEA - 1 && y < surface[x] + 9) continue;
        if (y >= H - 11) {
          tiles[i] = B.LAVA;
          meta[i] = 8;
        } else tiles[i] = B.AIR;
      }
    }
  };
  const worms = Math.round(W / 14);
  for (let k = 0; k < worms; k++) {
    let x = 4 + r() * (W - 8);
    const fromTop = r() < 0.18 && Math.abs(x - W / 2) > 20;
    let y = fromTop ? surface[Math.floor(x)] : surface[Math.floor(x)] + 8 + r() * (H - 20 - surface[Math.floor(x)]);
    let a = fromTop ? Math.PI / 2 + (r() - 0.5) * 1.2 : r() * Math.PI * 2;
    const len = 35 + r() * 90;
    for (let step = 0; step < len; step++) {
      const rad = 1 + noise1(seed + 47 + k, step / 9) * 1.4 + (y > 110 ? 0.4 : 0);
      carve(x, y, rad);
      x += Math.cos(a);
      y += Math.sin(a) * 0.7;
      a += (r() - 0.5) * 0.55;
      // 너무 위·아래로만 가지 않게 옆으로 끌어 준다
      a += (Math.cos(a) >= 0 ? -Math.sin(a) : Math.sin(a)) * 0.04;
      if (x < 2 || x > W - 3 || y > H - 4) break;
      if (y < surface[Math.floor(x)] - 1 && step > 6) break;
    }
  }
  for (let k = 0; k < W / 60; k++) {
    const cx = 10 + r() * (W - 20), cy = 95 + r() * (H - 108), rad = 3.5 + r() * 3.5;
    for (let j = 0; j < 4; j++) carve(cx + (r() - 0.5) * rad * 2.4, cy + (r() - 0.5) * rad, rad * (0.6 + r() * 0.5));
  }

  // 광석과 흙·자갈 덩어리 (돌만 바꾼다)
  const vein = (id, count, size, ymin, ymax) => {
    for (let k = 0; k < count; k++) {
      let x = Math.floor(r() * W), y = Math.floor(ymin + r() * (ymax - ymin));
      const n = Math.round(size * (0.6 + r() * 0.7));
      for (let j = 0; j < n; j++) {
        if (x > 0 && x < W && y > 0 && y < H && tiles[idx(x, y)] === B.STONE) tiles[idx(x, y)] = id;
        x += Math.floor(r() * 3) - 1;
        y += Math.floor(r() * 3) - 1;
      }
    }
  };
  vein(B.DIRT, W * 0.25, 14, 55, 115);
  vein(B.GRAVEL, W * 0.22, 12, 55, H - 12);
  vein(B.COAL_ORE, W * 0.9, 9, 40, H - 6);
  vein(B.IRON_ORE, W * 0.6, 6, 66, H - 6);
  vein(B.GOLD_ORE, W * 0.16, 5, 108, H - 6);
  vein(B.REDSTONE_ORE, W * 0.18, 6, 122, H - 5);
  vein(B.DIAMOND_ORE, W * 0.09, 4, 132, H - 5);

  // 바다와 호수. 눈 덮인 곳은 물 위가 언다
  for (let x = 0; x < W; x++) {
    for (let y = SEA; y < surface[x]; y++) {
      const i = idx(x, y);
      if (tiles[i] !== B.AIR) continue;
      tiles[i] = y === SEA && biome[x] === BIOME.SNOW ? B.ICE : B.WATER;
      meta[i] = tiles[i] === B.WATER ? 8 : 0;
    }
  }

  for(const {center,water,half} of ponds)for(let x=center-half;x<=center+half;x++)for(let y=water;y<surface[x];y++){tiles[idx(x,y)]=B.WATER;meta[idx(x,y)]=8;}

  // 나무와 풀
  const put = (x, y, t) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = idx(x, y);
    if (tiles[i] === B.AIR || BLOCKS[tiles[i]].plant) tiles[i] = t;
  };
  for (let x = 2; x < W - 2; x++) {
    const s = surface[x], b = biome[x];
    const top = tiles[idx(x, s)];
    if (tiles[idx(x, s - 1)] !== B.AIR) continue;
    if (top === B.GRASS || top === B.SNOW_GRASS) {
      const dens = b === BIOME.FOREST ? 0.36 : b === BIOME.SNOW ? 0.2 : 0.06;
      if (Math.abs(x - W / 2) > 3 && r() < dens) {
        const kind = b === BIOME.SNOW ? 'spruce' : b === BIOME.FOREST && r() < 0.35 ? 'birch' : 'oak';
        growTree({ tiles }, x, s - 1, kind, r, put);
        x += 2;
        continue;
      }
      if (top === B.GRASS) {
        const p = r();
        if (p < 0.28) put(x, s - 1, B.TALL_GRASS);
        else if (p < 0.33) put(x, s - 1, B.POPPY);
        else if (p < 0.38) put(x, s - 1, B.DANDELION);
        else if (p < 0.39) put(x, s - 1, B.PUMPKIN);
      }
    } else if (top === B.SAND && b === BIOME.DESERT) {
      const p = r();
      if (p < 0.05 && Math.abs(x - W / 2) > 3) {
        const hgt = 1 + Math.floor(r() * 3);
        for (let k = 1; k <= hgt; k++) put(x, s - k, B.CACTUS);
        x += 1;
      } else if (p < 0.09) put(x, s - 1, B.DEAD_BUSH);
    }
  }

  // Cane on water banks makes paper and books obtainable in new survival worlds.
  for(let x=3;x<W-3;x++)for(let y=SEA-6;y<=SEA+8;y++){
    if([B.GRASS,B.DIRT,B.SAND].includes(tiles[idx(x,y)])&&tiles[idx(x,y-1)]===B.AIR&&[tiles[idx(x-1,y)],tiles[idx(x+1,y)]].includes(B.WATER)&&hash2(seed+1001,x,y)>.35){
      for(let k=1;k<=1+Math.floor(hash2(seed+1002,x,y)*3);k++)if(tiles[idx(x,y-k)]===B.AIR)tiles[idx(x,y-k)]=B.SUGAR_CANE;
      break;
    }
  }
  for(let x=5;x<W-5;x+=7)for(let y=90;y<H-5;y+=7)if(tiles[idx(x,y)]===B.STONE&&hash2(seed+999,x,y)>.78)tiles[idx(x,y)]=B.LAPIS_ORE;
  const w = { seed, tiles, bg, meta, surface, biome, sky: new Uint8Array(W * H), blk: new Uint8Array(W * H) };
  computeLight(w, 0, W - 1);
  return w;
}

// 땅 위 (x, groundY 바로 위칸 = baseY) 에 나무를 세운다. put 은 빈 칸에만 놓는다
export function growTree(w, x, baseY, kind, r, put) {
  const trunk = kind === 'spruce' ? B.SPRUCE_TRUNK : kind === 'birch' ? B.BIRCH_TRUNK : B.OAK_TRUNK;
  const leaf = kind === 'spruce' ? B.SPRUCE_LEAVES : kind === 'birch' ? B.BIRCH_LEAVES : B.OAK_LEAVES;
  const h = kind === 'spruce' ? 6 + Math.floor(r() * 3) : kind === 'birch' ? 5 + Math.floor(r() * 3) : 4 + Math.floor(r() * 3);
  const topY = baseY - h + 1;
  for (let y = baseY; y >= topY; y--) put(x, y, trunk);
  if (kind === 'spruce') {
    put(x, topY - 1, leaf);
    put(x, topY - 2, leaf);
    for (let d = 0; d <= h - 3; d++) {
      const rad = d === 0 ? 1 : 1 + (d % 2) + (d > 3 ? 1 : 0);
      for (let dx = -rad; dx <= rad; dx++) if (dx) put(x + dx, topY + d, leaf);
    }
  } else {
    const wide = kind === 'birch' ? 1 : 2;
    for (let dy = -1; dy <= 2; dy++) {
      const rad = dy === -1 ? 1 : dy === 2 ? wide : 2;
      for (let dx = -rad; dx <= rad; dx++) {
        if (dx === 0 && dy >= 0) continue;
        if (Math.abs(dx) === rad && (dy === -1 || dy === 2) && r() < 0.5) continue;
        put(x + dx, topY + dy, leaf);
      }
    }
    put(x, topY - 1, leaf);
  }
}

// ---- 빛 ----
// sky: 하늘빛(0~15), blk: 횃불·용암 같은 블록 빛(0~15). 벽(불투명)은 0.
// x0~x1 열만 다시 계산하고, 바깥 열의 값은 그대로 믿는다.
const buckets = Array.from({ length: 16 }, () => []);
export function computeLight(w, x0, x1) {
  x0 = Math.max(0, x0);
  x1 = Math.min(W - 1, x1);
  const { tiles, sky, blk } = w;
  for (let x = x0; x <= x1; x++) {
    let l = 15;
    for (let y = 0; y < H; y++) {
      const i = y * W + x;
      const d = BLOCKS[tiles[i]];
      if (d.opaque) l = 0;
      else if (l > 0 && d.atten) l = Math.max(0, l - d.atten);
      sky[i] = d.opaque ? 0 : l;
      blk[i] = d.light;
    }
  }
  spread(w, sky, x0, x1);
  spread(w, blk, x0, x1);
}
function spread(w, arr, x0, x1) {
  const { tiles } = w;
  for (const b of buckets) b.length = 0;
  for (let x = x0; x <= x1; x++) {
    for (let y = 0; y < H; y++) {
      const v = arr[y * W + x];
      if (v > 1) buckets[v].push(y * W + x);
    }
  }
  // 경계 바깥 열에서 들어오는 빛
  const edge = (xo, xin) => {
    if (xo < 0 || xo >= W) return;
    for (let y = 0; y < H; y++) {
      const v = arr[y * W + xo];
      if (v <= 1) continue;
      const n = y * W + xin;
      const d = BLOCKS[tiles[n]];
      if (d.opaque) continue;
      const nv = v - 1 - d.atten;
      if (nv > arr[n]) {
        arr[n] = nv;
        if (nv > 1) buckets[nv].push(n);
      }
    }
  };
  edge(x0 - 1, x0);
  edge(x1 + 1, x1);
  for (let v = 15; v > 1; v--) {
    const list = buckets[v];
    for (let k = 0; k < list.length; k++) {
      const i = list[k];
      if (arr[i] !== v) continue;
      const x = i % W, y = (i - x) / W;
      for (let q = 0; q < 4; q++) {
        let n;
        if (q === 0) { if (x <= x0) continue; n = i - 1; }
        else if (q === 1) { if (x >= x1) continue; n = i + 1; }
        else if (q === 2) { if (y <= 0) continue; n = i - W; }
        else { if (y >= H - 1) continue; n = i + W; }
        const d = BLOCKS[tiles[n]];
        if (d.opaque) continue;
        const nv = v - 1 - d.atten;
        if (nv > arr[n]) {
          arr[n] = nv;
          if (nv > 1) buckets[nv].push(n);
        }
      }
    }
  }
}

// ---- 물과 용암 ----
// meta 8 = 샘(줄지 않음), 1~7 = 흐르는 물. 물은 한 칸마다 1, 용암은 2씩 약해진다.
const DECAY = { [B.WATER]: 1, [B.LAVA]: 2 };
function canHold(t) {
  return t === B.AIR || (BLOCKS[t].replace && !BLOCKS[t].fluid);
}
function supports(w, i) {
  const y = (i / W) | 0;
  if (y >= H - 1) return true;
  const below = w.tiles[i + W];
  if (isSolid(below, w.meta[i + W])) return true;
  return BLOCKS[below].fluid && w.meta[i + W] === 8;
}
function desiredLevel(w, i, fid) {
  const { tiles, meta } = w;
  if (tiles[i] === fid && meta[i] === 8) return 8;
  const x = i % W, y = (i / W) | 0;
  if (y > 0 && tiles[i - W] === fid) return 7;
  let best = 0;
  for (const n of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1]) {
    if (n < 0 || tiles[n] !== fid) continue;
    if (!supports(w, n)) continue;
    best = Math.max(best, meta[n] - DECAY[fid]);
  }
  return best;
}
// active: 바뀔 수도 있는 칸 Set. 바뀐 칸 [번호, 예전 블록] 목록을 돌려준다 (빛 다시 계산·식물 부서짐용)
export function stepFluid(w, fid, active) {
  const { tiles, meta } = w;
  const changed = [];
  const list = [...active];
  active.clear();
  for (const i of list) {
    const t = tiles[i];
    // 용암이 물에 닿으면 굳는다: 용암 샘은 흑요석, 흐르는 용암은 조약돌
    if (t === B.LAVA && touches(w, i, B.WATER)) {
      tiles[i] = meta[i] === 8 ? B.OBSIDIAN : B.COBBLE;
      meta[i] = 0;
      changed.push([i, t]);
      wake(active, i);
      continue;
    }
    if (t !== fid && !canHold(t)) continue;
    if (t === fid && meta[i] === 8) continue;
    const want = desiredLevel(w, i, fid);
    const cur = t === fid ? meta[i] : 0;
    if (want === cur) continue;
    if (want <= 0) {
      if (t !== fid) continue;
      tiles[i] = B.AIR;
      meta[i] = 0;
    } else {
      tiles[i] = fid;
      meta[i] = want;
    }
    changed.push([i, t]);
    wake(active, i);
  }
  return changed;
}
function touches(w, i, t) {
  const x = i % W;
  return (x > 0 && w.tiles[i - 1] === t) || (x < W - 1 && w.tiles[i + 1] === t) || (i >= W && w.tiles[i - W] === t) || (i + W < W * H && w.tiles[i + W] === t);
}
export function wake(active, i) {
  active.add(i);
  const x = i % W;
  if (x > 0) active.add(i - 1);
  if (x < W - 1) active.add(i + 1);
  if (i >= W) active.add(i - W);
  if (i + W < W * H) active.add(i + W);
}

// ---- 몸 충돌 ----
export function solidAt(w, x, y) {
  if (x < 0 || x >= W) return true;
  if (y < 0) return false;
  if (y >= H) return true;
  const i = y * W + x;
  return isSolid(w.tiles[i], w.meta[i]);
}
export function collides(w, x, y, bw, bh) {
  const x0 = Math.floor(x), x1 = Math.floor(x + bw - 1e-6);
  const y0 = Math.floor(y), y1 = Math.floor(y + bh - 1e-6);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solidAt(w, tx, ty)) return true;
  return false;
}
// e: { x, y, w, h, vx, vy } (왼쪽 위 기준, 블록 단위). 벽에 막히면 1칸짜리 턱은 올라선다(step)
export function moveBody(w, e, dt) {
  e.hitWall = false;
  const dx = e.vx * dt;
  const sx = Math.max(1, Math.ceil(Math.abs(dx) / 0.4));
  for (let k = 0; k < sx; k++) {
    const nx = e.x + dx / sx;
    if (!collides(w, nx, e.y, e.w, e.h)) {
      e.x = nx;
      continue;
    }
    if (e.step && e.onGround && !collides(w, nx, e.y - 1, e.w, e.h) && !collides(w, e.x, e.y - 1, e.w, e.h)) {
      e.y -= 1;
      e.x = nx;
      e.stepLift = (e.stepLift ?? 0) + 1;
      continue;
    }
    e.x = dx > 0 ? Math.floor(nx + e.w - 1e-6) - e.w : Math.floor(nx) + 1;
    e.vx = 0;
    e.hitWall = true;
    break;
  }
  const dy = e.vy * dt;
  const sy = Math.max(1, Math.ceil(Math.abs(dy) / 0.4));
  e.onGround = false;
  for (let k = 0; k < sy; k++) {
    const ny = e.y + dy / sy;
    if (!collides(w, e.x, ny, e.w, e.h)) {
      e.y = ny;
      continue;
    }
    if (dy > 0) {
      e.y = Math.floor(ny + e.h - 1e-6) - e.h;
      e.onGround = true;
    } else e.y = Math.floor(ny) + 1;
    e.vy = 0;
    break;
  }
  // 바닥 바로 위에 서 있는지 (vy 가 0 일 때도)
  if (!e.onGround && e.vy >= 0 && collides(w, e.x, e.y + 0.02, e.w, e.h)) e.onGround = true;
}
// 몸이 닿아 있는 칸 중 조건에 맞는 블록이 있는지
export function touching(w, e, test) {
  const x0 = Math.floor(e.x), x1 = Math.floor(e.x + e.w - 1e-6);
  const y0 = Math.floor(e.y), y1 = Math.floor(e.y + e.h - 1e-6);
  for (let ty = Math.max(0, y0); ty <= Math.min(H - 1, y1); ty++) {
    for (let tx = Math.max(0, x0); tx <= Math.min(W - 1, x1); tx++) {
      const t = w.tiles[ty * W + tx];
      if (test(t, tx, ty)) return t;
    }
  }
  return 0;
}

// ---- 가방 ----
// slots[0..8] 은 손에 드는 줄(핫바), [9..35] 는 가방
export const stackOf = (id, count = 1, dur) => {
  const s = { id, count };
  if (dur !== undefined) s.dur = dur;
  return s;
};
export function addItem(slots, id, count, dur, from = 0, to = slots.length, metadata = null) {
  const cap = maxStack(id);
  let left = count;
  if (cap > 1) {
    for (let k = from; k < to && left > 0; k++) {
      const s = slots[k];
      if (s && s.id === id && s.count < cap) {
        const n = Math.min(cap - s.count, left);
        s.count += n;
        left -= n;
      }
    }
  }
  for (let k = from; k < to && left > 0; k++) {
    if (slots[k]) continue;
    const n = Math.min(cap, left);
    slots[k] = stackOf(id, n, dur);
    if(metadata?.enchants)slots[k].enchants={...metadata.enchants};
    left -= n;
  }
  return left;
}
export function countItem(slots, ids) {
  let n = 0;
  for (const s of slots) if (s && ids.includes(s.id)) n += s.count;
  return n;
}
export function removeItem(slots, ids, count) {
  let left = count;
  for (let k = slots.length - 1; k >= 0 && left > 0; k--) {
    const s = slots[k];
    if (!s || !ids.includes(s.id)) continue;
    const n = Math.min(s.count, left);
    s.count -= n;
    left -= n;
    if (s.count <= 0) slots[k] = null;
  }
  return count - left;
}

// ---- 조합법 ----
// grid: size*size 칸의 아이템 ID (0 은 빈 칸)
export function matchRecipe(grid, size) {
  let r0 = size, r1 = -1, c0 = size, c1 = -1;
  const ids = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = grid[r * size + c];
      if (!v) continue;
      ids.push(v);
      r0 = Math.min(r0, r); r1 = Math.max(r1, r);
      c0 = Math.min(c0, c); c1 = Math.max(c1, c);
    }
  }
  if (!ids.length) return null;
  const h = r1 - r0 + 1, w = c1 - c0 + 1;
  const at = (r, c) => grid[(r0 + r) * size + c0 + c];
  for (const rec of RECIPES) {
    if (rec.items) {
      if (ids.length !== rec.items.length) continue;
      const left = rec.items.slice();
      let ok = true;
      for (const v of ids) {
        const k = left.findIndex((opt) => opt.includes(v));
        if (k < 0) { ok = false; break; }
        left.splice(k, 1);
      }
      if (ok) return rec;
      continue;
    }
    if (rec.w !== w || rec.h !== h) continue;
    for (const mirror of [false, true]) {
      let ok = true;
      for (let r = 0; r < h && ok; r++) {
        for (let c = 0; c < w && ok; c++) {
          const want = rec.cells[r][mirror ? w - 1 - c : c];
          const v = at(r, c);
          if (want ? !want.includes(v) : v) ok = false;
        }
      }
      if (ok) return rec;
    }
  }
  return null;
}
// 조합법 하나에 필요한 재료 묶음: [{ ids, n }]
export function recipeNeeds(rec) {
  const groups = [];
  const cells = rec.items ?? rec.cells.flat().filter(Boolean);
  for (const opt of cells) {
    const g = groups.find((x) => x.ids === opt || x.ids.join() === opt.join());
    if (g) g.n++;
    else groups.push({ ids: opt, n: 1 });
  }
  return groups;
}
export function canCraft(slots, rec) {
  return recipeNeeds(rec).every((g) => countItem(slots, g.ids) >= g.n);
}
export function craftFromSlots(slots, rec) {
  if (!canCraft(slots, rec)) return false;
  for (const g of recipeNeeds(rec)) removeItem(slots, g.ids, g.n);
  return true;
}

// ---- 캐는 시간 ----
// 맞는 도구면 빠르고, 필요한 등급보다 약하면 오래 걸리고 아무것도 안 나온다
export function breakInfo(blockId, heldId, enchant={}) {
  const b = BLOCKS[blockId];
  const tool = ITEMS[heldId]?.tool;
  const right = Boolean(tool && b.tool && tool.type === b.tool);
  const harvest = b.tier === 0 || (right && tool.tier >= b.tier);
  if (b.hard === 0) return { time: 0.05, harvest: true, right };
  if (!Number.isFinite(b.hard)) return { time: Infinity, harvest: false, right };
  let time = b.hard * (harvest ? 1.5 : 5);
  if (right) time /= tool.speed + (enchant.efficiency ? enchant.efficiency**2+1 : 0);
  if (tool?.type === 'sword' && (b.id === B.OAK_LEAVES || b.id === B.BIRCH_LEAVES || b.id === B.SPRUCE_LEAVES || b.id === B.CACTUS)) time /= 1.5;
  return { time: Math.max(0.05, time), harvest, right };
}

// ---- 저장 압축 (같은 값이 이어지는 구간을 [값, 길이] 로) ----
export function rleEncode(bytes) {
  const wide=bytes instanceof Uint16Array;
  const out = [];
  let k = 0;
  while (k < bytes.length) {
    const v = bytes[k];
    let n = 1;
    while (n < 255 && k + n < bytes.length && bytes[k + n] === v) n++;
    if(wide)out.push(v&255,v>>>8,n);else out.push(v,n);
    k += n;
  }
  return (wide?'u16:':'')+toBase64(Uint8Array.from(out));
}
export function rleDecode(text, length) {
  const wide=text.startsWith('u16:');
  const data = fromBase64(wide?text.slice(4):text);
  const out = wide?new Uint16Array(length):new Uint8Array(length);
  let o = 0;
  for (let k = 0; k + (wide?2:1) < data.length && o < length; k += wide?3:2) {
    const value=wide?data[k]|(data[k+1]<<8):data[k],n=data[k+(wide?2:1)];
    out.fill(value,o,Math.min(length,o+n));
    o+=n;
  }
  return out;
}
function toBase64(bytes) {
  let s = '';
  for (let k = 0; k < bytes.length; k += 0x8000) s += String.fromCharCode(...bytes.subarray(k, k + 0x8000));
  return btoa(s);
}
function fromBase64(text) {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let k = 0; k < s.length; k++) out[k] = s.charCodeAt(k);
  return out;
}

// 처음 서는 자리: 가운데에서 가장 가까운 마른 땅
export function findSpawn(w) {
  for (let d = 0; d < W / 2; d++) {
    for (const x of [W / 2 + d, W / 2 - d]) {
      if (x < 2 || x >= W - 2) continue;
      for (let y = 1; y < H - 2; y++) {
        const t = w.tiles[idx(x, y)];
        if (BLOCKS[t].fluid) break;
        if (isSolid(t, 0)) return { x: x + 0.2, y: y - 1.85 };
      }
    }
  }
  return { x: W / 2, y: 10 };
}
