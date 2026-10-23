import { enchantLines,enchantLevel,wearAmount,meleeDamage,gainExperience,enchantedDrop } from './enchantments.mjs';
import { makeBuildWorld,initBuildGuide,isBuildWorld } from './build-guide.mjs';
import { isBoss } from './skeleton-boss.mjs';
import { populateEnd } from './end-exploration.mjs';
import { spawnNether, tickNetherMob, updateFireballs } from './nether.mjs';
import { createCommandConsole } from './command-ui.mjs';
import { makeJumpWorld, resetJumper, newJumpState, JUMP_COURSE, jumpGrip } from './jump-world.mjs';
import { absorbDamage } from './armor.mjs';
import { account, saveKey, initAccount } from './account.mjs';
import { newAdventure, packAdventure, unpackAdventure, createAdventureController } from './adventure.mjs';
import { restoreTerrain, remapIndex } from './adventure-world.mjs';
// 픽셀크래프트: 게임 진행, 입력, 생물, 저장
import { B, I, BLOCKS, ITEMS, MOBS, HOSTILE, SMELT, SMELT_TIME, FUEL, isSolid, maxStack, durabilityOf } from './data.mjs';
import {
  W, H, BIOME_NAMES, generateWorld, computeLight, stepFluid, wake, moveBody, collides, touching, solidAt,
  addItem, countItem, breakInfo, rleEncode, findSpawn, seedFromText, makeRng, growTree, idx,
} from './core.mjs';
import { buildTextures, avgColor } from './textures.mjs';
import { render, dayFactor, isNight } from './render.mjs';
import { UI, initUI, openPanel, closePanel, renderPanel, renderHUD, hudDirty, tickPanel, newStack } from './ui.mjs';
import { sfx, sound, unlockAudio, tickMusic } from './audio.mjs';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const g = canvas.getContext('2d');
const DAY_LEN = 600;
const SLOTS = 3;
const SAVE_KEY = saveKey;
const DIFF_NAMES = ['평화로움', '보통', '어려움'];

let G = null;
let demo = null;
let zoom = 0;
let T = 48;
const keys = new Set();
const mouse = { x: 0, y: 0, left: false, right: false, inside: false, touch: false };
let touchMode = 'mine';

// ---- 저장 도우미 (사생활 창 등에서 막혀도 게임은 돌아가게) ----
function store(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
function load(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// ---- 새 게임 / 불러오기 ----
function makePlayer(sp) {
  return {
    x: sp.x, y: sp.y, w: 0.6, h: 1.8, vx: 0, vy: 0, onGround: false, step: true,
    hp: 20, xp:0, food: 20, sat: 5, exhaust: 0, air: 10, face: 1, fallTop: sp.y, hurtT: 0, invT: 0, fire: 0,
    sel: 0, inv: Array(36).fill(null), armor: Array(4).fill(null), spawn: { x: sp.x, y: sp.y }, flying: false, swing: 0, walkT: 0,
    regenT: 0, starveT: 0, hazardT: 0, drownT: 0, stepT: 0, bowT: -1, stepLift: 0,
  };
}
function baseGame(w, opts) {
  const sp = findSpawn(w);
  return {
    w, name: opts.name, mode: opts.mode, diff: opts.diff, slot: opts.slot, time: 0.03, day: 1, clock: 0, playTime: 0,
    player: makePlayer(sp), mobs: [], drops: [], arrows: [], tnts: [], falling: [], particles: [],
    chests: new Map(), furnaces: new Map(), water: new Set(), lava: new Set(),
    dirty: null, mining: null, target: null, placeAt: null, cam: { x: sp.x, y: sp.y }, spawnT: 0, saveT: 0, fluidT: 0, lavaT: 0,
    rng: makeRng((w.seed ^ 0x5bd1e995) >>> 0), dead: false, heldId: 0, view: null, shake: 0, fade: 0, hint: 0, attackT: 0, useT: 0, breakCool: 0,
    stats: { mined: 0, placed: 0 },
  };
}
function newGame(opts) {
  const w = opts.worldType==='builder'?makeBuildWorld(opts.seed):opts.worldType === 'jump' ? makeJumpWorld(opts.seed) : generateWorld(opts.seed);
  if(opts.worldType==='builder')opts={...opts,mode:'creative',diff:0};
  if (opts.worldType === 'jump') opts = { ...opts, mode: 'survival', diff: 0 };
  const game = baseGame(w, opts);
  // 처음엔 맨손. 크리에이티브는 자주 쓰는 블록을 손에 쥐여 준다
  if (opts.mode === 'creative') {
    [B.GRASS, B.DIRT, B.STONE, B.PLANKS, B.GLASS, B.TORCH, B.OAK_LOG, B.STONE_BRICKS, B.TNT].forEach((id, k) => { game.player.inv[k] = newStack(id, maxStack(id)); });
  }
  if(opts.worldType==='builder'){initBuildGuide(game);newAdventure(game,opts);return game;}
  const r = game.rng;
  if (opts.worldType === 'jump') {
    game.jump = newJumpState();
    resetJumper(game.player, 0);
    newAdventure(game, opts);
    resetJumper(game.companion, 0);
    game.cam = { x: game.player.x, y: game.player.y };
    return game;
  }
  for (let x = 12; x < W - 12; x += 14) {
    if (r() > 0.55) continue;
    const s = w.surface[x];
    if (w.tiles[idx(x, s)] !== B.GRASS) continue;
    const type = ['pig', 'cow', 'sheep', 'chicken'][Math.floor(r() * 4)];
    const n = 1 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) game.mobs.push(makeMob(type, x + k * 1.2, s - MOBS[type].h - 0.05));
  }
  newAdventure(game, opts);
  return game;
}
function serialize(game) {
  const p = game.player;
  return JSON.stringify({
    v: 2, width: W, builder:game.builder, jump: game.jump, adventure: packAdventure(game), stats: game.stats, seed: game.adventure?.seed ?? game.w.seed, name: game.name, mode: game.mode, diff: game.diff, time: game.time, day: game.day, playTime: game.playTime, hint: game.hint,
    player: { xp:p.xp??0, armor: p.armor, x: p.x, y: p.y, hp: p.hp, food: p.food, sat: p.sat, air: p.air, sel: p.sel, inv: p.inv, spawn: p.spawn, flying: p.flying, skin: p.skin },
    surface: [...game.w.surface], bg: rleEncode(game.w.bg), tiles: rleEncode(game.w.tiles), meta: rleEncode(game.w.meta),
    chests: [...game.chests], furnaces: [...game.furnaces],
    mobs: game.mobs.filter((m) => !m.dead).map((m) => ({ ...m })),
  });
}
function saveGame(quiet) {
  if (!G) return;
  const ok = store(SAVE_KEY(G.slot), serialize(G));
  if (!quiet) toast(ok ? '저장했어!' : '저장 공간이 모자라서 저장하지 못했어');
}
function loadGame(slot) {
  const raw = load(SAVE_KEY(slot));
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    const w = d.jump ? makeJumpWorld(d.seed) : generateWorld(d.seed);
    if (!d.jump) restoreTerrain(w, d);
    const game = baseGame(w, { name: d.name, mode: d.mode, diff: d.diff, slot });
    Object.assign(game.player, d.player);
    game.player.inv = Array.from({ length: 36 }, (_, k) => d.player.inv[k] ?? null);
    game.player.fallTop = game.player.y;
    game.time = d.time;
    game.day = d.day;
    game.playTime = d.playTime ?? 0;
    game.hint = d.hint ?? 0;
    game.jump = d.jump ? (d.jump.course === JUMP_COURSE ? d.jump : { ...newJumpState(), previousCourse: { elapsed: d.jump.elapsed, falls: d.jump.falls, completed: d.jump.completed, progress: d.jump.progress } }) : undefined;
    game.stats = d.stats ?? { mined: 0 };
    game.builder=d.builder;
    game.chests = new Map((d.chests ?? []).map(([i, v]) => [remapIndex(i, d.width ?? 640), v]));
    game.furnaces = new Map((d.furnaces ?? []).map(([i, v]) => [remapIndex(i, d.width ?? 640), v]));
    game.mobs = (d.mobs ?? []).map(m => Array.isArray(m) ? Object.assign(makeMob(m[0], m[1], m[2]), { hp: m[3] }) : Object.assign(makeMob(m.type, m.x, m.y), m));
    unpackAdventure(game, d.adventure);
    if (d.jump && d.jump.course !== JUMP_COURSE) {
      resetJumper(game.player, 0); resetJumper(game.companion, 0);
      game.adventure.storySeen = false;
    }
    game.cam = { x: game.player.x, y: game.player.y };
    // 흐르던 물은 불러온 뒤 다시 흐르게 깨운다
    for (let i = 0; i < W * H; i++) {
      const t = w.tiles[i];
      if ((t === B.WATER || t === B.LAVA) && w.meta[i] !== 8) wake(t === B.WATER ? game.water : game.lava, i);
    }
    return game;
  } catch (err) {
    console.error(err);
    return null;
  }
}
function slotSummary(slot) {
  const raw = load(SAVE_KEY(slot));
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    return { jump: !!d.jump, name: d.name, mode: d.mode, diff: d.diff, day: d.day, playTime: d.playTime ?? 0 };
  } catch {
    return null;
  }
}

// ---- 블록 바꾸기 ----
const tileAt = (x, y) => (x < 0 || x >= W || y >= H ? B.BEDROCK : y < 0 ? B.AIR : G.w.tiles[y * W + x]);
function markLight(x) {
  const a = x - 16, b = x + 16;
  G.dirty = G.dirty ? [Math.min(G.dirty[0], a), Math.max(G.dirty[1], b)] : [a, b];
}
function setTile(x, y, t, m = 0) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = y * W + x;
  G.w.tiles[i] = t;
  G.w.meta[i] = m;
  markLight(x);
  wake(G.water, i);
  wake(G.lava, i);
  if (y > 0) {
    checkSupport(x, y - 1);
    checkGravity(x, y - 1);
  }
  checkGravity(x, y);
  if (x > 0) checkTorch(x - 1, y);
  if (x < W - 1) checkTorch(x + 1, y);
}
const PLANTS = new Set([B.TALL_GRASS, B.POPPY, B.DANDELION, B.SAPLING_OAK, B.SAPLING_BIRCH, B.SAPLING_SPRUCE, B.DEAD_BUSH]);
const SOIL = new Set([B.GRASS, B.DIRT, B.SNOW_GRASS]);
function checkSupport(x, y) {
  const t = tileAt(x, y);
  const below = tileAt(x, y + 1);
  if (PLANTS.has(t) && !(SOIL.has(below) || (t === B.DEAD_BUSH && below === B.SAND))) breakBlock(x, y, { quiet: true });
  else if (t === B.CACTUS && below !== B.SAND && below !== B.CACTUS) breakBlock(x, y, { quiet: true });
  else if (t === B.DOOR_B && !solidAt(G.w, x, y + 1)) breakBlock(x, y, { quiet: true });
  else if ((t === B.BED_FOOT || t === B.BED_HEAD) && !solidAt(G.w, x, y + 1)) breakBlock(x, y, { quiet: true });
  else if (t === B.TORCH) checkTorch(x, y);
}
function torchSupported(x, y) {
  return solidAt(G.w, x, y + 1) || solidAt(G.w, x - 1, y) || solidAt(G.w, x + 1, y) || G.w.bg[y * W + x] !== 0;
}
function checkTorch(x, y) {
  if (tileAt(x, y) === B.TORCH && !torchSupported(x, y)) breakBlock(x, y, { quiet: true });
}
function checkGravity(x, y) {
  const t = tileAt(x, y);
  if (!BLOCKS[t].gravity) return;
  const below = tileAt(x, y + 1);
  if (!BLOCKS[below].replace) return;
  G.w.tiles[y * W + x] = B.AIR;
  markLight(x);
  G.falling.push({ id: t, x, y, vy: 0 });
  if (y > 0) checkGravity(x, y - 1);
}
function dropOf(t) {
  const d = BLOCKS[t].drop;
  if (typeof d === 'function') return d(G.rng());
  return d ? [d, 1] : null;
}
// 블록 부수기. harvest 가 false 면 아이템이 안 나온다
function breakBlock(x, y, { harvest = true, quiet = false, chance = 1 } = {}) {
  if (G.jump) return;
  const i = y * W + x;
  const t = G.w.tiles[i];
  if (t === B.AIR || BLOCKS[t].fluid) return;
  burst(x + 0.5, y + 0.5, avgColor[t] ?? '#888', quiet ? 4 : 10);
  if (harvest && G.mode !== 'creative' && G.rng() < chance) {
    let d = enchantedDrop(held(),t,dropOf(t),G.rng);
    if(BLOCKS[t].mcName?.endsWith('_ore')&&!enchantLevel(held(),'silk_touch')&&d?.[0]!==t)gainXP(3);
    if (t === B.DOOR_T) d = [I.DOOR, 1];
    if (t === B.BED_HEAD) d = [I.BED, 1];
    if (d) spawnDrop(x + 0.5, y + 0.5, d[0], d[1]);
  }
  if (t === B.CHEST) {
    for (const s of G.chests.get(i) ?? []) if (s) spawnDrop(x + 0.5, y + 0.5, s.id, s.count, s.dur, s.enchants);
    G.chests.delete(i);
  }
  if (t === B.FURNACE || t === B.FURNACE_LIT) {
    for (const s of G.furnaces.get(i)?.slots ?? []) if (s) spawnDrop(x + 0.5, y + 0.5, s.id, s.count, s.dur, s.enchants);
    G.furnaces.delete(i);
    if (UI.open === 'furnace' && UI.ref === i) closePanel();
  }
  if (UI.open === 'chest' && UI.ref === i) closePanel();
  const meta = G.w.meta[i];
  setTile(x, y, B.AIR);
  if (TRUNKS.has(t) && !quiet) fellTree(x, y - 1, t, harvest);
  if (t === B.DOOR_B && tileAt(x, y - 1) === B.DOOR_T) setTile(x, y - 1, B.AIR);
  if (t === B.DOOR_T && tileAt(x, y + 1) === B.DOOR_B) setTile(x, y + 1, B.AIR);
  if (t === B.BED_FOOT || t === B.BED_HEAD) {
    const dir = meta & 2 ? 1 : -1;
    const ox = t === B.BED_FOOT ? x + dir : x - dir;
    const other = tileAt(ox, y);
    if (other === B.BED_FOOT || other === B.BED_HEAD) setTile(ox, y, B.AIR);
  }
  if (!quiet) sfx.brk(BLOCKS[t].sound);
}

// 자연에서 자란 나무 밑동을 베면 위쪽 줄기가 다 쓰러지고 잎도 흩어진다
const TRUNKS = new Set([B.OAK_TRUNK, B.BIRCH_TRUNK, B.SPRUCE_TRUNK]);
const LEAF_OF = { [B.OAK_TRUNK]: B.OAK_LEAVES, [B.BIRCH_TRUNK]: B.BIRCH_LEAVES, [B.SPRUCE_TRUNK]: B.SPRUCE_LEAVES };
function fellTree(x, y, trunk, harvest) {
  let top = y + 1;
  while (tileAt(x, y) === trunk) {
    top = y;
    breakBlock(x, y, { harvest, quiet: true });
    y--;
  }
  const leaf = LEAF_OF[trunk];
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const lx = x + dx, ly = top + dy;
      if (tileAt(lx, ly) !== leaf) continue;
      // 다른 나무 줄기 옆에 붙은 잎은 남긴다
      let other = false;
      for (let k = -2; k <= 2 && !other; k++) for (let j = -2; j <= 2; j++) if (TRUNKS.has(tileAt(lx + k, ly + j)) && lx + k !== x) other = true;
      if (!other) breakBlock(lx, ly, { harvest, quiet: true });
    }
  }
  sfx.brk('wood');
  sfx.brk('grass');
}

// ---- 아이템, 조각 ----
function spawnDrop(x, y, id, count, dur, enchants) {
  if (!ITEMS[id] || count <= 0) return;
  if (dur === undefined && durabilityOf(id)) dur = durabilityOf(id);
  G.drops.push({ id, count, dur, enchants:enchants?{...enchants}:undefined, x: x - 0.175, y: y - 0.175, w: 0.35, h: 0.35, vx: (G.rng() - 0.5) * 3, vy: -3.5, age: 0, seed: G.rng() * 10 });
}
function burst(x, y, color, n) {
  for (let k = 0; k < n; k++) {
    G.particles.push({ x: x + (G.rng() - 0.5) * 0.6, y: y + (G.rng() - 0.5) * 0.6, vx: (G.rng() - 0.5) * 5, vy: -G.rng() * 5, life: 0.4 + G.rng() * 0.5, color, size: 0.1 + G.rng() * 0.08, grav: 18 });
  }
}
function smoke(x, y, n = 12, color = 'rgba(220,220,220,0.8)') {
  for (let k = 0; k < n; k++) G.particles.push({ x: x + (G.rng() - 0.5), y: y + (G.rng() - 0.5), vx: (G.rng() - 0.5) * 2, vy: -1 - G.rng() * 2, life: 0.6 + G.rng() * 0.6, color, size: 0.18 + G.rng() * 0.15, grav: -1 });
}
function toast(text) {
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  box.appendChild(el);
  while (box.children.length > 5) box.firstChild.remove();
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3200);
}

// ---- 생물 ----
function makeMob(type, x, y) {
  const d = MOBS[type];
  return { type, x, y, w: d.w, h: d.h, vx: 0, vy: 0, hp: d.hp, face: 1, hurtT: 0, attackT: 1, thinkT: 0, dir: 0, panicT: 0, fuse: 0, fire: 0, walkT: 0, onGround: false, step: true, stepLift: 0, dead: false, deadT: 0, hissed: false };
}
function lightAt(x, y) {
  if (x < 0 || x >= W || y < 0 || y >= H) return 15;
  const i = y * W + x;
  return Math.max(G.w.sky[i] * dayFactor(G.time), G.w.blk[i]);
}
function lineOfSight(x0, y0, x1, y1) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 3);
  for (let k = 1; k < n; k++) {
    const x = x0 + ((x1 - x0) * k) / n, y = y0 + ((y1 - y0) * k) / n;
    if (solidAt(G.w, Math.floor(x), Math.floor(y))) return false;
  }
  return true;
}
function hurtPlayer(amount, cause, fromX, opts = {}) {
  const p = opts.player ?? G.player;
  if (p === G.companion) return adventure.hurtCompanion(amount, cause);
  if (G.mode === 'creative' || G.dead) return;
  if (!opts.pierce && p.invT > 0) return;
  const mul = [0.5, 1, 1.5][G.diff];
  p.hp -= absorbDamage(p, Math.max(1, Math.round(amount * (opts.raw ? 1 : mul))), cause);
  p.invT = 0.5;
  p.hurtT = 0.4;
  p.exhaust += 0.1;
  sfx.hurt();
  if (fromX !== undefined) {
    p.vx = Math.sign(p.x + p.w / 2 - fromX || 1) * 7;
    p.vy = -5;
  }
  if (p.hp <= 0) die(cause);
  hudDirty();
}
const DEATH_TEXT = {
  fall: '높은 곳에서 떨어졌어', lava: '용암에 빠졌어', fire: '불에 타 버렸어', drown: '물에 빠졌어', starve: '배가 너무 고팠어',
  cactus: '선인장에 찔렸어', boom: '폭발에 휘말렸어', 좀비: '좀비에게 당했어', 스켈레톤: '스켈레톤 화살에 맞았어', 거미: '거미에게 당했어', 크리퍼: '크리퍼가 터졌어',
};
function die(cause) {
  G.dead = true;
  G.player.hp = 0;
  G.mining = null;
  closePanel();
  $('deathText').textContent = DEATH_TEXT[cause] ?? '쓰러졌어';
  $('death').hidden = false;
}
function respawn() {
  const p = G.player;
  Object.assign(p, { x: p.spawn.x, y: p.spawn.y, vx: 0, vy: 0, hp: 20, food: 20, sat: 5, air: 10, fire: 0, fallTop: p.spawn.y, hurtT: 0, invT: 1 });
  // 다시 태어날 곳이 막혀 있으면 처음 자리로
  if (collides(G.w, p.x, p.y, p.w, p.h)) {
    const sp = findSpawn(G.w);
    Object.assign(p, { x: sp.x, y: sp.y, fallTop: sp.y });
  }
  G.cam.x = p.x;
  G.cam.y = p.y;
  G.dead = false;
  $('death').hidden = true;
  hudDirty();
}
function gainXP(points) {
  gainExperience(G.player, points, G.adventure?.coop ? G.companion?.armor ?? [] : []);
}
function hitMob(m, dmg, fromX) {
  if (m.dead) return;
  m.hp -= dmg;
  if (m.type === 'piglin') m.provoked = true;
  m.hurtT = 0.35;
  m.vx = Math.sign(m.x + m.w / 2 - fromX || 1) * 7;
  m.vy = -4.5;
  if (!HOSTILE.has(m.type)) m.panicT = 4;
  sfx.mobHurt(m.type);
  if (m.hp <= 0) {
    m.dead = true;
    m.deadT = 0;
    gainXP(HOSTILE.has(m.type)?7:3);
    adventure.defeated(m);
    for (const [id, lo, hi] of MOBS[m.type].drops) {
      const n = lo + Math.floor(G.rng() * (hi - lo + 1));
      // 불타면서 쓰러진 동물은 고기가 익는다
      const cooked = m.fire > 0 ? SMELT[id] : undefined;
      if (n > 0) spawnDrop(m.x + m.w / 2, m.y + m.h / 2, cooked ?? id, n);
    }
  }
}
function explode(cx, cy, rad) {
  sfx.boom();
  G.shake = Math.max(G.shake, 0.6);
  smoke(cx, cy, 30, 'rgba(240,240,240,0.9)');
  for (let k = 0; k < 16; k++) G.particles.push({ x: cx, y: cy, vx: (G.rng() - 0.5) * 14, vy: (G.rng() - 0.5) * 14, life: 0.3 + G.rng() * 0.3, color: k % 2 ? '#ffd23a' : '#ff6a10', size: 0.25, grav: 0 });
  const r = Math.ceil(rad);
  for (let y = Math.floor(cy) - r; y <= Math.floor(cy) + r; y++) {
    for (let x = Math.floor(cx) - r; x <= Math.floor(cx) + r; x++) {
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > rad * (0.75 + G.rng() * 0.35)) continue;
      const t = G.w.tiles[y * W + x];
      if (t === B.AIR || t === B.BEDROCK || t === B.OBSIDIAN || BLOCKS[t].fluid) continue;
      if (t === B.TNT) {
        G.w.tiles[y * W + x] = B.AIR;
        markLight(x);
        G.tnts.push({ x, y, w: 0.98, h: 0.98, vx: (G.rng() - 0.5) * 4, vy: -4, fuse: 0.4 + G.rng() * 0.8, onGround: false });
        continue;
      }
      breakBlock(x, y, { quiet: true, chance: 0.3 });
    }
  }
  const hit = (e, dmgMul) => {
    const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
    const d = Math.hypot(ex - cx, ey - cy);
    if (d > rad * 2) return 0;
    const f = 1 - d / (rad * 2);
    e.vx += Math.sign(ex - cx || 1) * f * 14;
    e.vy -= f * 10;
    return Math.round(f * rad * 3.2 * dmgMul);
  };
  const pd = hit(G.player, 1);
  if (pd > 0) hurtPlayer(pd, 'boom', undefined, { pierce: true });
  for (const m of G.mobs) {
    const md = hit(m, 1.4);
    if (md > 0) hitMob(m, md, cx);
  }
  for (const dr of G.drops) hit(dr, 0);
}

function updateMobs(dt) {
  const p = G.player;
  const px = p.x + p.w / 2, py = p.y + p.h / 2;
  const day = dayFactor(G.time);
  for (const m of G.mobs) {
    if (m.dead) {
      m.deadT += dt;
      if (m.deadT > 0.6) {
        m.remove = true;
        smoke(m.x + m.w / 2, m.y + m.h / 2, 10);
      }
      continue;
    }
    const mx = m.x + m.w / 2, my = m.y + m.h / 2;
    const p = G.adventure?.coop && !G.companion.spectator && Math.hypot(G.companion.x - mx, G.companion.y - my) < Math.hypot(px - mx, py - my) ? G.companion : G.player;
    const dx = p.x + p.w / 2 - mx, dy = p.y + p.h / 2 - my, dist = Math.hypot(dx, dy);
    if (tickNetherMob(G,m,p,dt,{lineOfSight,shootFireball,hurtPlayer,hitMob})) continue;
    const hostile = HOSTILE.has(m.type);
    if (Math.abs(dx) > 80 && !isBoss(m)) {
      if (hostile) m.remove = true;
      continue;
    }
    if (hostile && G.diff === 0 && !isBoss(m) && !m.summoned) {
      m.remove = true;
      smoke(mx, my, 8);
      continue;
    }
    const def = MOBS[m.type];
    m.hurtT -= dt;
    m.attackT -= dt;
    m.thinkT -= dt;
    m.panicT -= dt;
    let move = 0;
    let speed = def.speed;
    const chasing = hostile && !G.dead && G.mode !== 'creative' && dist < (m.type === 'creeper' ? 18 : 22) && Math.abs(dy) < 12;
    if (chasing) {
      if (m.type === 'skeleton') {
        move = dist < 6 ? -Math.sign(dx) : dist > 10 ? Math.sign(dx) : 0;
        m.face = Math.sign(dx) || 1;
        if (m.attackT <= 0 && dist < 16 && lineOfSight(mx, m.y + 0.4, p.x + p.w / 2, p.y + 0.5)) {
          shootArrow(mx, m.y + 0.5, p.x + p.w / 2 + (G.rng() - 0.5) * 0.8, p.y + 0.6, 15, 'mob', 3);
          m.attackT = 1.8 + G.rng() * 1.2;
          sfx.bow();
        }
      } else {
        move = Math.abs(dx) > 0.4 ? Math.sign(dx) : 0;
        if (m.type === 'spider' && m.onGround && dist < 4 && dist > 1.5 && m.attackT <= 0.3) {
          m.vy = -7;
          m.vx = Math.sign(dx) * 6;
        }
      }
      if (m.type === 'creeper') {
        if (dist < 2.4) {
          move = 0;
          if (!m.hissed) {
            sfx.hiss();
            m.hissed = true;
          }
          m.fuse += dt;
          if (m.fuse >= 1.5) {
            m.remove = true;
            explode(mx, my, 3);
            continue;
          }
        } else if (m.fuse > 0) {
          m.fuse = Math.max(0, m.fuse - dt);
          if (m.fuse === 0) m.hissed = false;
        }
      } else if (def.dmg && m.attackT <= 0 && Math.abs(dx) < (m.w + p.w) / 2 + 0.3 && Math.abs(dy) < (m.h + p.h) / 2 && m.type !== 'skeleton') {
        hurtPlayer(def.dmg, def.name, mx, { player: p });
        m.attackT = 1;
      }
      if (G.rng() < dt * 0.15 && m.type === 'zombie') sfx.groan();
    } else {
      if (m.fuse > 0) m.fuse = Math.max(0, m.fuse - dt);
      if (m.thinkT <= 0) {
        m.dir = [-1, 0, 0, 1][Math.floor(G.rng() * 4)];
        m.thinkT = 2 + G.rng() * 4;
      }
      move = m.dir;
      if (m.panicT > 0) {
        move = -Math.sign(dx) || 1;
        speed *= 2;
      }
      // 낭떠러지 앞에서는 멈춘다
      if (move && m.onGround) {
        const ax = Math.floor(mx + move * (m.w / 2 + 0.3));
        let ground = false;
        for (let k = 0; k < 4; k++) if (solidAt(G.w, ax, Math.floor(m.y + m.h + 0.1) + k)) ground = true;
        if (!ground) {
          move = 0;
          m.dir = 0;
        }
      }
    }
    const inFluid = touching(G.w, m, (t) => t === B.WATER || t === B.LAVA);
    const inLava = inFluid === B.LAVA;
    if (inFluid) speed *= 0.6;
    if (m.hurtT < 0.15) m.vx += (move * speed - m.vx) * Math.min(1, dt * 8);
    if (move) m.face = move;
    if (inFluid) {
      m.vy += 10 * dt;
      m.vy = Math.min(m.vy, 2);
      if (touching(G.w, { x: m.x, y: m.y, w: m.w, h: 0.4 }, (t) => t === B.WATER || t === B.LAVA)) m.vy = Math.max(m.vy - 30 * dt, -3);
    } else {
      m.vy = Math.min(m.vy + 30 * dt, 25);
      if (m.type === 'chicken' && m.vy > 2) m.vy = 2;
    }
    moveBody(G.w, m, dt);
    if (m.hitWall && move) {
      if (m.type === 'spider') m.vy = -4;
      else if (m.onGround) m.vy = -9.2;
    }
    m.stepLift *= Math.exp(-dt * 18);
    m.walkT += dt * Math.abs(m.vx) * 0.6;
    // 해가 뜨면 좀비·스켈레톤은 불탄다
    const headI = Math.floor(m.y + 0.2) * W + Math.floor(mx);
    if (def.burns && !m.summoned && G.adventure?.dimension !== 'nether' && day > 0.85 && G.w.sky[headI] >= 14 && !inFluid) m.fire = Math.max(m.fire, 1);
    if (inLava) m.fire = 4;
    if (inFluid === B.WATER) m.fire = 0;
    if (m.fire > 0) {
      m.fire -= dt;
      m.burnT = (m.burnT ?? 0) - dt;
      if (m.burnT <= 0) {
        m.burnT = inLava ? 0.5 : 1;
        hitMob(m, inLava ? 4 : 1, mx);
        m.vx *= 0.3;
        m.vy = Math.max(m.vy, -1);
      }
    }
    if (touching(G.w, m, (t) => t === B.CACTUS) && m.hurtT <= 0) hitMob(m, 1, mx + (G.rng() - 0.5));
    if (m.y > H + 5) m.remove = true;
  }
  G.mobs = G.mobs.filter((m) => !m.remove);
}
function shootFireball(x,y,tx,ty,type) {
  const d=Math.max(.1,Math.hypot(tx-x,ty-y)),speed=type==='ghast'?7:10;
  (G.fireballs??=[]).push({x,y,vx:(tx-x)/d*speed,vy:(ty-y)/d*speed,type,life:7});
}
function shootArrow(x, y, tx, ty, speed, from, dmg) {
  const dx = tx - x, dy = ty - y;
  const d = Math.max(0.1, Math.hypot(dx, dy));
  const t = d / speed;
  // 떨어지는 만큼 조금 위로 겨눈다
  const vx = dx / t, vy = dy / t - 0.5 * 18 * t;
  const k = speed / Math.hypot(vx, vy);
  G.arrows.push({ x, y, vx: vx * Math.min(1.25, k), vy: vy * Math.min(1.25, k), from, dmg, life: 10, stuck: false });
}
function spawnTick() {
  if(isBuildWorld(G))return;
  if (G.jump) return;
  if (G.adventure?.dimension === 'nether') { spawnNether(G,makeMob); return; }
  if (['end','moon','school'].includes(G.adventure?.dimension)) return;
  const p = G.player;
  const day = dayFactor(G.time);
  const vw = G.view ? G.view.viewW / 2 + 2 : 18;
  if (G.diff > 0) {
    const cap = G.diff === 2 ? 12 : 8;
    const near = G.mobs.filter((m) => HOSTILE.has(m.type) && Math.abs(m.x - p.x) < 64).length;
    for (let tries = 0; tries < 8 && near < cap; tries++) {
      const side = G.rng() < 0.5 ? -1 : 1;
      const x = Math.floor(p.x + side * (vw + G.rng() * 22));
      const y = Math.floor(p.y + (G.rng() - 0.4) * 34);
      if (x < 2 || x >= W - 2 || y < 2 || y >= H - 2) continue;
      if (!solidAt(G.w, x, y + 1) || solidAt(G.w, x, y) || BLOCKS[G.w.tiles[y * W + x]].fluid) continue;
      if (lightAt(x, y) > 6.5) continue;
      const r = G.rng();
      const type = r < 0.36 ? 'zombie' : r < 0.6 ? 'skeleton' : r < 0.84 ? 'creeper' : 'spider';
      const d = MOBS[type];
      const mx = x + 0.5 - d.w / 2, my = y + 1 - d.h - 0.01;
      if (collides(G.w, mx, my, d.w, d.h)) continue;
      G.mobs.push(makeMob(type, mx, my));
      break;
    }
  }
  // 낮에는 풀밭에 동물이 가끔 나타난다
  const animals = G.mobs.filter((m) => !HOSTILE.has(m.type) && Math.abs(m.x - p.x) < 70).length;
  if (animals < 6 && day > 0.8 && G.rng() < 0.15) {
    const side = G.rng() < 0.5 ? -1 : 1;
    const x = Math.floor(p.x + side * (vw + 4 + G.rng() * 24));
    if (x > 2 && x < W - 2) {
      const s = G.w.surface[x];
      if (G.w.tiles[idx(x, s)] === B.GRASS && G.w.tiles[idx(x, s - 1)] !== B.WATER) {
        const type = ['pig', 'cow', 'sheep', 'chicken'][Math.floor(G.rng() * 4)];
        const d = MOBS[type];
        if (!collides(G.w, x, s - d.h - 0.05, d.w, d.h)) G.mobs.push(makeMob(type, x, s - d.h - 0.05));
      }
    }
  }
}

// ---- 플레이어 ----
const held = () => G.player.inv[G.player.sel];
function wearTool(amount) {
  if (G.mode === 'creative') return;
  const s = held();
  if (!s || s.dur === undefined) return;
  s.dur -= wearAmount(s,amount,G.rng);
  if (s.dur <= 0) {
    G.player.inv[G.player.sel] = null;
    sfx.brk('metal');
    toast(`${ITEMS[s.id].name}가 부서졌어!`);
  }
  hudDirty();
}
function consumeHeld(n = 1) {
  if (G.mode === 'creative') return;
  const s = held();
  if (!s) return;
  s.count -= n;
  if (s.count <= 0) G.player.inv[G.player.sel] = null;
  hudDirty();
}
function updatePlayer(dt) {
  const p = G.player;
  const w = G.w;
  if (G.dead) return;
  const left = keys.has('KeyA') || (!G.adventure?.coop && keys.has('ArrowLeft'));
  const right = keys.has('KeyD') || (!G.adventure?.coop && keys.has('ArrowRight'));
  const jump = keys.has('Space') || keys.has('KeyW') || (!G.adventure?.coop && keys.has('ArrowUp'));
  const down = keys.has('KeyS') || (!G.adventure?.coop && keys.has('ArrowDown'));
  const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const panel = !!UI.open;
  const move = panel ? 0 : (right ? 1 : 0) - (left ? 1 : 0);
  const fluid = touching(w, p, (t) => t === B.WATER || t === B.LAVA);
  const ladder = touching(w, p, (t) => BLOCKS[t].climb);
  let speed = p.flying ? 9 : run ? 5.6 : 4.3;
  if (fluid && !p.flying) speed *= 0.55;
  if (move) p.face = move;
  p.vx += (move * speed - p.vx) * Math.min(1, dt * jumpGrip(G, p, move, p.onGround || p.flying ? 14 : 7));
  const wasGround = p.onGround;
  if (p.flying) {
    const v = panel ? 0 : (down || run ? 1 : 0) - (jump ? 1 : 0);
    p.vy += (v * 8 - p.vy) * Math.min(1, dt * 10);
  } else if (ladder && !panel && (jump || down)) {
    p.vy = jump ? -3.6 : 3.6;
  } else if (ladder) {
    p.vy = Math.min(p.vy + 30 * dt, 1.2);
  } else if (fluid) {
    p.vy = Math.min(p.vy + 9 * dt, 2.6);
    if (jump && !panel) p.vy = Math.max(p.vy - 28 * dt, -4);
  } else {
    p.vy = Math.min(p.vy + (G.adventure?.dimension==='moon'?7:30) * dt, 28);
    if (jump && !panel && p.onGround) {
      p.vy = -9.4;
      p.exhaust += run ? 0.2 : 0.05;
    }
  }
  p.step = !p.flying;
  moveBody(w, p, dt);
  if (p.flying && p.onGround && G.mode === 'creative' && !jump) p.flying = false;
  p.stepLift *= Math.exp(-dt * 18);
  // 걸음 소리
  if (p.onGround && Math.abs(p.vx) > 1) {
    p.walkT += dt;
    p.stepT -= dt * Math.abs(p.vx);
    if (p.stepT <= 0) {
      p.stepT = 1.7;
      sfx.step(BLOCKS[tileAt(Math.floor(p.x + p.w / 2), Math.floor(p.y + p.h + 0.05))].sound);
    }
  }
  // 떨어져 다침
  if (p.onGround || fluid || ladder || p.flying) {
    if (p.onGround && !wasGround && !fluid && !ladder) {
      const fall = p.y - p.fallTop;
      if (fall > (G.adventure?.dimension==='moon'?14:3.5)) hurtPlayer(Math.floor((fall - 3)*(G.adventure?.dimension==='moon'?.25:1)), 'fall', undefined, { pierce: true, raw: true });
    }
    p.fallTop = p.y;
  } else p.fallTop = Math.min(p.fallTop, p.y);
  if (p.y > H + 2) {
    hurtPlayer(100, 'fall', undefined, { pierce: true, raw: true });
    return;
  }
  p.hurtT -= dt;
  p.invT -= dt;
  p.swing = Math.max(0, p.swing - dt * 3.5);
  if (G.mode === 'creative') {
    p.hp = 20;
    p.food = 20;
    p.air = 10;
    p.fire = 0;
    return;
  }
  // 위험한 블록
  p.hazardT -= dt;
  if (p.hazardT <= 0) {
    if (fluid === B.LAVA) {
      hurtPlayer(4, 'lava', undefined, { pierce: true });
      p.fire = 6;
      p.hazardT = 0.5;
    } else if (touching(w, p, (t) => t === B.CACTUS)) {
      hurtPlayer(1, 'cactus', undefined, { pierce: true, raw: true });
      p.hazardT = 0.5;
    }
  }
  if (fluid === B.WATER) p.fire = 0;
  if (p.fire > 0) {
    p.fire -= dt;
    p.burnT = (p.burnT ?? 1) - dt;
    if (p.burnT <= 0) {
      p.burnT = 1;
      hurtPlayer(1, 'fire', undefined, { pierce: true, raw: true });
    }
  }
  const head = tileAt(Math.floor(p.x + p.w / 2), Math.floor(p.y + 0.3));
  if (head === B.WATER) {
    p.air -= dt/(1+enchantLevel(p.armor?.[0],'respiration'));
    if (p.air <= 0) {
      p.air = 0;
      p.drownT -= dt;
      if (p.drownT <= 0) {
        p.drownT = 1;
        hurtPlayer(2, 'drown', undefined, { pierce: true, raw: true });
      }
    }
  } else p.air = Math.min(10, p.air + dt * 5);
  // 배고픔과 회복
  if (G.diff === 0) {
    p.food = 20;
    p.regenT += dt;
    if (p.regenT > 1 && p.hp < 20) {
      p.regenT = 0;
      p.hp = Math.min(20, p.hp + 1);
    }
  } else {
    p.exhaust += Math.abs(p.vx) * dt * (run && move ? 0.06 : 0.012) + dt * 0.004;
    while (p.exhaust >= 4) {
      p.exhaust -= 4;
      if (p.sat > 0) p.sat = Math.max(0, p.sat - 1);
      else p.food = Math.max(0, p.food - 1);
    }
    p.regenT += dt;
    if (p.food >= 18 && p.hp < 20 && p.regenT > 3) {
      p.regenT = 0;
      p.hp = Math.min(20, p.hp + 1);
      p.exhaust += 1.5;
    }
    if (p.food <= 0) {
      p.starveT -= dt;
      if (p.starveT <= 0) {
        p.starveT = 4;
        if (p.hp > (G.diff === 2 ? 0 : 2)) hurtPlayer(1, 'starve', undefined, { pierce: true, raw: true });
      }
    }
  }
}

// 마우스가 가리키는 블록 찾기. 몸에서 마우스까지 가는 길에 벽이 있으면 그 벽을 고른다
function mouseWorld() {
  const v = G.view;
  if (!v) return null;
  return { x: v.left + (mouse.x * devicePixelRatioSafe()) / v.T, y: v.top + (mouse.y * devicePixelRatioSafe()) / v.T };
}
function devicePixelRatioSafe() {
  return canvas.width / Math.max(1, canvas.clientWidth);
}
function updateTarget() {
  G.target = null;
  G.placeAt = null;
  if (!mouse.inside || G.dead || UI.open) return;
  const p = G.player;
  const m = mouseWorld();
  if (!m) return;
  const ex = p.x + p.w / 2, ey = p.y + 0.35;
  const reach = G.mode === 'creative' ? 8 : 5;
  const cx = Math.floor(m.x), cy = Math.floor(m.y);
  if (cx < 0 || cx >= W || cy < 0 || cy >= H) return;
  if (Math.hypot(cx + 0.5 - ex, cy + 0.5 - ey) > reach + 0.5) return;
  // 지나가는 칸을 하나씩 본다
  const n = Math.ceil(Math.hypot(m.x - ex, m.y - ey) * 4);
  let hit = null;
  for (let k = 1; k <= n; k++) {
    const x = Math.floor(ex + ((m.x - ex) * k) / n), y = Math.floor(ey + ((m.y - ey) * k) / n);
    if (x === Math.floor(ex) && y === Math.floor(ey)) continue;
    if (solidAt(G.w, x, y) && x >= 0 && x < W) {
      hit = { x, y };
      break;
    }
  }
  const t = tileAt(cx, cy);
  if (hit && (hit.x !== cx || hit.y !== cy)) G.target = { x: hit.x, y: hit.y, place: false };
  else if (t !== B.AIR && !BLOCKS[t].fluid) G.target = { x: cx, y: cy, place: false };
  if (BLOCKS[t].replace) {
    G.placeAt = { x: cx, y: cy };
    if (!G.target) G.target = { x: cx, y: cy, place: true };
  }
}
function mobUnderMouse() {
  const m = mouseWorld();
  if (!m) return null;
  const p = G.player;
  const reach = G.mode === 'creative' ? 6 : 3.8;
  let best = null;
  for (const mob of G.mobs) {
    if (mob.dead) continue;
    if (m.x < mob.x - 0.25 || m.x > mob.x + mob.w + 0.25 || m.y < mob.y - 0.25 || m.y > mob.y + mob.h + 0.25) continue;
    const d = Math.hypot(mob.x + mob.w / 2 - (p.x + p.w / 2), mob.y + mob.h / 2 - (p.y + p.h / 2));
    if (d <= reach && (!best || d < best.d)) best = { mob, d };
  }
  return best?.mob ?? null;
}
function tryAttack() {
  if (G.attackT > 0) return false;
  const mob = mobUnderMouse();
  if (!mob) return false;
  const tool = ITEMS[held()?.id]?.tool;
  const dmg = meleeDamage(held(),tool ? tool.dmg : 1);
  const p = G.player;
  hitMob(mob, dmg * (p.vy > 1 && !p.onGround ? 1.5 : 1), p.x + p.w / 2);
  if(enchantLevel(held(),'knockback'))mob.vx*=1+enchantLevel(held(),'knockback')*.5;
  p.swing = 1;
  p.exhaust += 0.1;
  G.attackT = tool?.type === 'sword' ? 0.35 : 0.5;
  if (tool) wearTool(tool.type === 'sword' ? 1 : 2);
  return true;
}
function updateMining(dt) {
  G.breakCool -= dt;
  G.attackT -= dt;
  if (!mouse.left || G.dead || UI.open) {
    G.mining = null;
    return;
  }
  if (tryAttack()) {
    G.mining = null;
    return;
  }
  const tg = G.target;
  if (!tg || tg.place) {
    G.mining = null;
    return;
  }
  const i = tg.y * W + tg.x;
  const t = G.w.tiles[i];
  const p = G.player;
  p.swing = Math.max(p.swing, 0.6);
  if (G.mode === 'creative') {
    if (G.breakCool <= 0) {
      breakBlock(tg.x, tg.y, { harvest: false });
      G.stats.mined++;
      G.breakCool = 0.2;
    }
    G.mining = null;
    return;
  }
  if (!G.mining || G.mining.i !== i) G.mining = { i, progress: 0, soundT: 0 };
  const info = breakInfo(t, held()?.id ?? 0, held()?.enchants);
  if (!Number.isFinite(info.time)) return;
  G.mining.progress += dt / info.time;
  G.mining.soundT -= dt;
  if (G.mining.soundT <= 0) {
    G.mining.soundT = 0.24;
    sfx.dig(BLOCKS[t].sound);
    burst(tg.x + 0.5, tg.y + 0.5, avgColor[t] ?? '#888', 2);
  }
  if (G.mining.progress >= 1) {
    const d = BLOCKS[t];
    breakBlock(tg.x, tg.y, { harvest: info.harvest });
    if (!info.harvest && d.tier > 0) toast(d.tier >= 3 ? '철 곡괭이 이상이 있어야 얻을 수 있어!' : d.tier === 2 ? '돌 곡괭이 이상이 있어야 얻을 수 있어!' : '곡괭이가 있어야 얻을 수 있어!');
    const tool = ITEMS[held()?.id]?.tool;
    if (tool && d.hard > 0) wearTool(tool.type === 'sword' ? 2 : 1);
    p.exhaust += 0.005;
    G.stats.mined++;
    G.mining = null;
  }
}

function canPlaceSupport(x, y) {
  return solidAt(G.w, x, y + 1) || solidAt(G.w, x, y - 1) || solidAt(G.w, x - 1, y) || solidAt(G.w, x + 1, y) || G.w.bg[y * W + x] !== 0
    || [tileAt(x, y + 1), tileAt(x - 1, y), tileAt(x + 1, y), tileAt(x, y - 1)].some((t) => t !== B.AIR && !BLOCKS[t].fluid);
}
function overlapsBody(x, y) {
  const all = [G.player, ...(G.partnerDuringPlace ? [G.partnerDuringPlace] : []), ...(G.adventure?.coop && !G.companion.spectator ? [G.companion] : []), ...G.mobs.filter((m) => !m.dead)];
  return all.some((e) => e.x < x + 1 && e.x + e.w > x && e.y < y + 1 && e.y + e.h > y);
}
function placeBlock(x, y, itemId) {
  if (G.jump) return;
  const blockId = ITEMS[itemId]?.place;
  if (blockId === undefined) return false;
  const t = tileAt(x, y);
  if (!BLOCKS[t].replace) return false;
  if (!canPlaceSupport(x, y)) return false;
  const below = tileAt(x, y + 1);
  if (PLANTS.has(blockId) && !(SOIL.has(below) || (blockId === B.DEAD_BUSH && below === B.SAND))) return false;
  if (blockId === B.CACTUS && below !== B.SAND && below !== B.CACTUS) return false;
  if (blockId === B.TORCH && !torchSupported(x, y)) return false;
  if (blockId === B.DOOR_B) {
    if (!BLOCKS[tileAt(x, y - 1)].replace || !solidAt(G.w, x, y + 1) || overlapsBody(x, y) || overlapsBody(x, y - 1)) return false;
    setTile(x, y, B.DOOR_B);
    setTile(x, y - 1, B.DOOR_T);
  } else if (blockId === B.BED_FOOT) {
    const dir = G.player.face >= 0 ? 1 : -1;
    if (!BLOCKS[tileAt(x + dir, y)].replace || !solidAt(G.w, x, y + 1) || !solidAt(G.w, x + dir, y + 1)) return false;
    const m = dir > 0 ? 2 : 0;
    setTile(x, y, B.BED_FOOT, m);
    setTile(x + dir, y, B.BED_HEAD, m);
  } else {
    if (isSolid(blockId, 0) && overlapsBody(x, y)) return false;
    setTile(x, y, blockId);
    const i = y * W + x;
    if (blockId === B.CHEST) G.chests.set(i, Array(27).fill(null));
    if (blockId === B.FURNACE) G.furnaces.set(i, { slots: [null, null, null], burn: 0, burnMax: 0, cook: 0 });
  }
  G.stats.placed=(G.stats.placed??0)+1;
  consumeHeld();
  sfx.place(BLOCKS[blockId].sound);
  G.player.swing = 1;
  if (blockId === B.CRAFTING) G.placedTable = true;
  return true;
}
function toggleDoor(x, y) {
  const by = tileAt(x, y) === B.DOOR_T ? y + 1 : y;
  const i = by * W + x;
  const open = !(G.w.meta[i] & 1);
  if (!open && (overlapsBody(x, by) || overlapsBody(x, by - 1))) return;
  const side = G.player.x + G.player.w / 2 > x + 0.5 ? 2 : 0;
  const m = open ? 1 | side : 0;
  G.w.meta[i] = m;
  if (tileAt(x, by - 1) === B.DOOR_T) G.w.meta[i - W] = m;
  sfx.door();
}
function sleepInBed(x, y) {
  if (G.adventure?.dimension !== 'overworld') return toast('침대에서는 숲 세계에서 잘 수 있어!');
  const p = G.player;
  p.spawn = { x: x + 0.2, y: y - 1.85 + 1 - 0.01 };
  // 침대 위가 막혀 있으면 침대 옆을 다시 태어날 곳으로
  if (collides(G.w, p.spawn.x, p.spawn.y, p.w, p.h)) p.spawn = { x: p.x, y: p.y };
  if (!isNight(G.time)) {
    toast('다시 태어날 곳을 여기로 정했어. 잠은 밤에만 잘 수 있어'); saveGame(true);
    return;
  }
  if (G.mobs.some((m) => HOSTILE.has(m.type) && !m.dead && Math.hypot(m.x - x, m.y - y) < 9)) {
    toast('근처에 몬스터가 있어서 잘 수 없어!');
    return;
  }
  G.fade = 1.6;
  G.time = 0.1;
  G.day++;
  G.adventure.slept=true;
  p.hp = Math.min(20,p.hp+6);
  saveGame(true);
  toast(`좋은 아침! ${G.day}일째`);
}
function doUse() {
  if (G.dead || UI.open) return;
  const p = G.player;
  const s = held();
  const id = s?.id ?? 0;
  if ((id === I.FLINT_STEEL || id === I.ENDER_EYE) && adventure.lightPortal()) return;
  if(id===I.EXPERIENCE_BOTTLE){gainXP(21);consumeHeld();hudDirty();toast('경험치를 얻었어!');return;}
  if([I.OVERWORLD_BOOK,I.NETHER_BOOK,I.END_BOOK].includes(id)&&adventure.readBook(id))return;
  const tg = G.target && !G.target.place ? G.target : null;
  if (tg) {
    const i = tg.y * W + tg.x;
    const t = G.w.tiles[i];
    if(t===B.ENCHANTING_TABLE)return openPanel('enchant',i);
    if (t === B.CRAFTING) return openPanel('table');
    if (t === B.FURNACE || t === B.FURNACE_LIT) {
      if (!G.furnaces.has(i)) G.furnaces.set(i, { slots: [null, null, null], burn: 0, burnMax: 0, cook: 0 });
      return openPanel('furnace', i);
    }
    if (t === B.CHEST) {
      if (!G.chests.has(i)) G.chests.set(i, Array(27).fill(null));
      return openPanel('chest', i);
    }
    if (t === B.DOOR_B || t === B.DOOR_T) return toggleDoor(tg.x, tg.y);
    if (t === B.BED_FOOT || t === B.BED_HEAD) return sleepInBed(tg.x, tg.y);
    if (t === B.TNT && id === I.FLINT_STEEL) {
      G.w.tiles[i] = B.AIR;
      markLight(tg.x);
      G.tnts.push({ x: tg.x, y: tg.y, w: 0.98, h: 0.98, vx: 0, vy: -2, fuse: 4, onGround: false });
      sfx.hiss();
      wearTool(1);
      return;
    }
  }
  const it = ITEMS[id];
  if (it?.food) {
    if (p.food >= 20 && !it.heal) return toast('지금은 배가 불러');
    p.food = Math.min(20, p.food + it.food);
    p.sat = Math.min(p.food, p.sat + it.food * 0.6);
    if (it.heal) p.hp = Math.min(20, p.hp + it.heal);
    sfx.eat();
    burst(p.x + p.w / 2, p.y + 0.4, '#e8b080', 6);
    consumeHeld();
    return;
  }
  if (id === I.BUCKET && G.placeAt) {
    const { x, y } = G.placeAt;
    const t = tileAt(x, y);
    if ((t === B.WATER || t === B.LAVA) && G.w.meta[y * W + x] === 8) {
      setTile(x, y, B.AIR);
      const full = t === B.WATER ? I.WATER_BUCKET : I.LAVA_BUCKET;
      if (G.mode !== 'creative') {
        if (s.count > 1) {
          s.count--;
          if (addItem(p.inv, full, 1) > 0) spawnDrop(p.x, p.y, full, 1);
        } else p.inv[p.sel] = newStack(full);
      }
      sfx.splash();
      hudDirty();
    }
    return;
  }
  if ((id === I.WATER_BUCKET || id === I.LAVA_BUCKET) && G.placeAt) {
    const { x, y } = G.placeAt;
    const fid = id === I.WATER_BUCKET ? B.WATER : B.LAVA;
    if (tileAt(x, y) === fid && G.w.meta[y * W + x] === 8) return;
    setTile(x, y, fid, 8);
    if (G.mode !== 'creative') p.inv[p.sel] = newStack(I.BUCKET);
    sfx.splash();
    p.swing = 1;
    hudDirty();
    return;
  }
  if (id === I.BOW) return;
  if (it?.place !== undefined && G.placeAt) placeBlock(G.placeAt.x, G.placeAt.y, id);
}
function releaseBow() {
  const p = G.player;
  if (p.bowT < 0) return;
  const power = Math.min(1, p.bowT / 0.9);
  p.bowT = -1;
  if (power < 0.15 || held()?.id !== I.BOW) return;
  if (G.mode !== 'creative') {
    if (countItem(p.inv, [I.ARROW]) <= 0) return toast('화살이 없어!');
    if(!enchantLevel(held(),'infinity'))for (let k = 35; k >= 0; k--) {
      const s = p.inv[k];
      if (s?.id === I.ARROW) {
        s.count--;
        if (s.count <= 0) p.inv[k] = null;
        break;
      }
    }
  }
  const m = mouseWorld();
  if (!m) return;
  const ex = p.x + p.w / 2, ey = p.y + 0.5;
  const dx = m.x - ex, dy = m.y - ey, d = Math.max(0.1, Math.hypot(dx, dy));
  const sp = 12 + power * 22;
  G.arrows.push({ x: ex, y: ey, vx: (dx / d) * sp, vy: (dy / d) * sp, from: 'player', dmg: Math.round((2 + power * 7)*(1+.25*enchantLevel(held(),'power'))), flame:!!enchantLevel(held(),'flame'),infinite:!!enchantLevel(held(),'infinity'),life: 10, stuck: false });
  sfx.bow();
  wearTool(1);
  hudDirty();
}

// ---- 세상 돌리기 ----
function updateWorld(dt) {
  const w = G.w;
  const p = G.player;
  // 떨어진 아이템
  for (const d of G.drops) {
    d.age += dt;
    const inWater = touching(w, d, (t) => t === B.WATER);
    d.vy = inWater ? Math.max(d.vy - 20 * dt, -1.5) : Math.min(d.vy + 25 * dt, 20);
    d.vx *= Math.exp(-dt * (d.onGround ? 8 : 1));
    const px = p.x + p.w / 2, py = p.y + p.h / 2;
    const dx = px - (d.x + d.w / 2), dy = py - (d.y + d.h / 2);
    const dist = Math.hypot(dx, dy);
    if (!G.dead && d.age > 0.5 && dist < 2.6) {
      d.vx += (dx / dist) * 30 * dt;
      d.vy += (dy / dist) * 30 * dt;
      if (dist < 0.9) {
        const left = addItem(p.inv, d.id, d.count, d.dur,0,p.inv.length,d);
        if (left < d.count) {
          sfx.pop();
          hudDirty();
          if (UI.open) renderPanel();
          if (d.id === I.DIAMOND) toast('다이아몬드를 찾았어! 💎');
        }
        d.count = left;
        if (left <= 0) d.remove = true;
      }
    }
    moveBody(w, d, dt);
    if (d.age > 300 || d.y > H + 4) d.remove = true;
    if (touching(w, d, (t) => t === B.LAVA)) {
      d.remove = true;
      smoke(d.x, d.y, 4, 'rgba(80,80,80,0.8)');
    }
  }
  G.drops = G.drops.filter((d) => !d.remove);
  // 화살
  for (const a of G.arrows) {
    if (a.stuck) {
      a.life -= dt;
      if (!a.infinite && a.from === 'player' && Math.hypot(a.x - (p.x + p.w / 2), a.y - (p.y + p.h / 2)) < 1.1 && G.mode !== 'creative') {
        if (addItem(p.inv, I.ARROW, 1) === 0) {
          a.life = 0;
          sfx.pop();
          hudDirty();
        }
      }
      continue;
    }
    for (let k = 0; k < 3 && !a.stuck && a.life > 0; k++) {
      const s = dt / 3;
      a.vy += 18 * s;
      a.x += a.vx * s;
      a.y += a.vy * s;
      if (solidAt(w, Math.floor(a.x), Math.floor(a.y))) {
        a.stuck = true;
        a.life = 8;
        sfx.dig('wood');
        break;
      }
      if (a.from === 'mob') {
        const target = [p, ...(G.adventure?.coop && !G.companion.spectator ? [G.companion] : [])].find(p => a.x > p.x && a.x < p.x + p.w && a.y > p.y && a.y < p.y + p.h);
        if (target) {
          hurtPlayer(a.dmg, '스켈레톤', a.x - a.vx, { player: target });
          a.life = 0;
        }
      } else {
        for (const m of G.mobs) {
          if (m.dead || a.x < m.x || a.x > m.x + m.w || a.y < m.y || a.y > m.y + m.h) continue;
          if(a.flame)m.fire=Math.max(m.fire,4);
          hitMob(m, a.dmg, a.x - a.vx);
          a.life = 0;
          break;
        }
      }
    }
    a.life -= dt;
  }
  G.arrows = G.arrows.filter((a) => a.life > 0 && a.y < H + 4);
  // TNT
  for (const t of G.tnts) {
    t.vy = Math.min(t.vy + 25 * dt, 20);
    t.vx *= Math.exp(-dt * 3);
    moveBody(w, t, dt);
    t.fuse -= dt;
    if (G.rng() < dt * 20) smoke(t.x + 0.5, t.y, 1, 'rgba(200,200,200,0.7)');
    if (t.fuse <= 0) {
      t.remove = true;
      explode(t.x + 0.5, t.y + 0.5, 4);
    }
  }
  G.tnts = G.tnts.filter((t) => !t.remove);
  // 떨어지는 모래·자갈
  for (const f of G.falling) {
    f.vy = Math.min(f.vy + 30 * dt, 25);
    const ny = f.y + f.vy * dt;
    const by = Math.floor(ny + 1);
    if (by >= H || isSolid(tileAt(f.x, by), G.w.meta[Math.min(H - 1, by) * W + f.x])) {
      const ly = by - 1;
      const at = tileAt(f.x, ly);
      if (BLOCKS[at].replace) {
        if (PLANTS.has(at)) breakBlock(f.x, ly, { quiet: true });
        setTile(f.x, ly, f.id);
        sfx.place(BLOCKS[f.id].sound);
      } else spawnDrop(f.x + 0.5, ly + 0.5, f.id, 1);
      f.remove = true;
    } else f.y = ny;
  }
  G.falling = G.falling.filter((f) => !f.remove);
  // 조각
  for (const q of G.particles) {
    q.life -= dt;
    q.vy += q.grav * dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
  }
  G.particles = G.particles.filter((q) => q.life > 0);
  if (G.particles.length > 600) G.particles.splice(0, G.particles.length - 600);
  // 물·용암
  G.fluidT += dt;
  if (G.fluidT > 0.12) {
    G.fluidT = 0;
    fluidChanges(stepFluid(w, B.WATER, G.water));
  }
  G.lavaT += dt;
  if (G.lavaT > 0.5) {
    G.lavaT = 0;
    fluidChanges(stepFluid(w, B.LAVA, G.lava));
  }
  // 화로
  for (const [i, f] of G.furnaces) {
    const [inp, fuel] = f.slots;
    const out = f.slots[2];
    const result = inp ? SMELT[inp.id] : undefined;
    const can = result !== undefined && (!out || (out.id === result && out.count < maxStack(result)));
    if (f.burn > 0) f.burn -= dt;
    if (f.burn <= 0 && can && fuel && FUEL[fuel.id]) {
      f.burn = f.burnMax = FUEL[fuel.id];
      if (fuel.id === I.LAVA_BUCKET) f.slots[1] = newStack(I.BUCKET);
      else {
        fuel.count--;
        if (fuel.count <= 0) f.slots[1] = null;
      }
    }
    if (f.burn > 0 && can) {
      f.cook += dt;
      if (f.cook >= SMELT_TIME) {
        f.cook = 0;
        inp.count--;
        if (inp.count <= 0) f.slots[0] = null;
        if (out) out.count++;
        else f.slots[2] = newStack(result);
      }
    } else f.cook = Math.max(0, f.cook - dt * 2);
    if (f.burn < 0) f.burn = 0;
    const lit = f.burn > 0;
    const t = w.tiles[i];
    if (lit && t === B.FURNACE) {
      w.tiles[i] = B.FURNACE_LIT;
      markLight(i % W);
    } else if (!lit && t === B.FURNACE_LIT) {
      w.tiles[i] = B.FURNACE;
      markLight(i % W);
    }
  }
  randomTicks();
}
function fluidChanges(list) {
  for (const [i, old] of list) {
    const x = i % W, y = (i - x) / W;
    markLight(x);
    const now = G.w.tiles[i];
    if (old !== B.AIR && old !== now && !BLOCKS[old].fluid && BLOCKS[old].replace === true) {
      const d = dropOf(old);
      if (d) spawnDrop(x + 0.5, y + 0.5, d[0], d[1]);
    }
    if (old === B.TORCH) spawnDrop(x + 0.5, y + 0.5, B.TORCH, 1);
    if (now === B.OBSIDIAN || now === B.COBBLE) {
      sfx.fizz();
      smoke(x + 0.5, y + 0.5, 6, 'rgba(230,230,230,0.8)');
    }
  }
}
// 잔디 퍼지기, 묘목 자라기
function randomTicks() {
  const w = G.w;
  const p = G.player;
  for (let k = 0; k < 50; k++) {
    const x = Math.floor(p.x + (G.rng() - 0.5) * 96);
    const y = Math.floor(G.rng() * H);
    if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) continue;
    const i = y * W + x;
    const t = w.tiles[i];
    const above = w.tiles[i - W];
    if ((t === B.GRASS || t === B.SNOW_GRASS) && BLOCKS[above].opaque) {
      w.tiles[i] = B.DIRT;
    } else if (t === B.DIRT && !BLOCKS[above].opaque && !BLOCKS[above].fluid && w.sky[i - W] >= 9) {
      for (const n of [i - 1, i + 1, i - W - 1, i - W + 1, i + W - 1, i + W + 1]) {
        if (w.tiles[n] === B.GRASS) {
          w.tiles[i] = B.GRASS;
          break;
        }
      }
    } else if (t === B.SAPLING_OAK || t === B.SAPLING_BIRCH || t === B.SAPLING_SPRUCE) {
      w.meta[i]++;
      if (w.meta[i] >= 3 && G.rng() < 0.4) {
        let room = true;
        for (let dy = 1; dy < 7 && room; dy++) for (let dx = -2; dx <= 2; dx++) if (isSolid(tileAt(x + dx, y - dy), 0)) room = false;
        if (room) {
          w.tiles[i] = B.AIR;
          const kind = t === B.SAPLING_SPRUCE ? 'spruce' : t === B.SAPLING_BIRCH ? 'birch' : 'oak';
          growTree(w, x, y, kind, G.rng, (tx, ty, tt) => {
            if (tx < 0 || tx >= W || ty < 0 || ty >= H) return;
            const ti = ty * W + tx;
            if (w.tiles[ti] === B.AIR || PLANTS.has(w.tiles[ti])) w.tiles[ti] = tt;
          });
          markLight(x);
          burst(x + 0.5, y, '#5fa83b', 10);
        }
      }
    }
  }
}

// ---- 처음 하는 사람을 위한 길잡이 ----
const TOUCH = window.matchMedia?.('(pointer: coarse)').matches ?? false;
const HINTS = [
  { text: '나무 기둥을 마우스 왼쪽으로 꾹 눌러서 캐 봐! (A·D 이동, 스페이스 점프)', touch: '⛏ 캐기 모드에서 나무 기둥을 꾹 눌러 캐 봐! (◀ ▶ 이동, ▲ 점프)', done: () => has([B.OAK_LOG, B.BIRCH_LOG, B.SPRUCE_LOG]) },
  { text: 'E를 눌러 가방을 열고, 오른쪽 "만들 수 있는 것"에서 나무 판자를 눌러 봐', touch: '가방 버튼을 누르고, 오른쪽 "만들 수 있는 것"에서 나무 판자를 눌러 봐', done: () => has([B.PLANKS]) || has([B.CRAFTING]) },
  { text: '나무 판자 4개로 제작대를 만들고, 손에 들고 마우스 오른쪽으로 땅에 놓아 봐', touch: '나무 판자 4개로 제작대를 만들고, 🧱 놓기 모드로 바꿔 땅을 눌러 놓아 봐', done: () => G.placedTable || has([I.WOOD_PICK]) },
  { text: '제작대를 오른쪽 클릭하면 막대기와 나무 곡괭이를 만들 수 있어', touch: '놓기 모드에서 제작대를 누르면 막대기와 나무 곡괭이를 만들 수 있어', done: () => has([I.WOOD_PICK, I.STONE_PICK, I.IRON_PICK, I.DIAMOND_PICK]) },
  { text: '곡괭이로 돌을 캐서 돌 곡괭이와 화로를 만들어 봐. 밤에는 몬스터가 나와!', done: () => has([I.STONE_PICK, I.IRON_PICK]) || has([B.FURNACE]) },
  { text: '석탄과 막대기로 횃불을 만들면 동굴이 밝아져. 철을 찾아 화로에 구워 봐!', done: () => has([I.IRON_INGOT, I.IRON_PICK]) },
];
function has(ids) {
  return countItem(G.player.inv, ids) > 0;
}
function updateHint() {
  if (G.jump || isBuildWorld(G) || G.mode === 'creative' || G.adventure?.dimension!=='overworld') {
    $('hint').hidden = true;
    return;
  }
  while (G.hint < HINTS.length && HINTS[G.hint].done()) {
    G.hint++;
    if (G.hint < HINTS.length) sfx.level();
  }
  const el = $('hint');
  if (G.hint >= HINTS.length || G.hintHidden) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const text = (TOUCH && HINTS[G.hint].touch) || HINTS[G.hint].text;
  if (el.dataset.text !== text) {
    el.dataset.text = text;
    el.querySelector('span').textContent = text;
  }
}

// ---- 한 프레임 ----
function update(dt) {
  G.clock += dt;
  G.playTime += dt;
  const was = G.time;
  G.time += dt / (G.adventure?.dayLength ?? DAY_LEN);
  if (G.time >= 1) {
    G.time -= 1;
    G.day++;
    toast(`${G.day}일째 아침이야`);
  }
  if (was < 0.54 && G.time >= 0.54 && G.diff > 0) toast('밤이 오고 있어. 몬스터를 조심해!');
  G.heldId = held()?.id ?? 0;
  updateTarget();
  updatePlayer(dt);
  updateMining(dt);
  // 오른쪽 버튼을 누르고 있으면 계속 놓는다
  if (mouse.right && !UI.open && !G.dead) {
    if (G.heldId === I.BOW) {
      if (G.player.bowT >= 0) G.player.bowT += dt;
    } else {
      G.useT -= dt;
      if (G.useT <= 0) {
        G.useT = 0.22;
        doUse();
      }
    }
  }
  updateMobs(dt);
  updateFireballs(G,dt,{hurtPlayer,burst});
  updateWorld(dt);
  adventure.tick(dt);
  G.spawnT -= dt;
  if (G.spawnT <= 0) {
    G.spawnT = 1;
    spawnTick();
    updateHint();
  }
  if (G.dirty) {
    computeLight(G.w, G.dirty[0], G.dirty[1]);
    G.dirty = null;
  }
  const p = G.player;
  const k = 1 - Math.exp(-dt * 9);
  const cameraX = G.adventure?.coop && !G.companion.spectator && Math.abs(G.companion.x - p.x) < 22 ? (p.x + G.companion.x) / 2 : p.x;
  G.cam.x += (cameraX + p.w / 2 - G.cam.x) * k;
  G.cam.y += (p.y + p.stepLift + p.h / 2 - 0.4 - G.cam.y) * k;
  G.shake = Math.max(0, G.shake - dt);
  G.fade = Math.max(0, G.fade - dt);
  G.saveT += dt;
  if (G.saveT > 30) {
    G.saveT = 0;
    saveGame(true);
  }
  tickMusic(isNight(G.time));
  tickPanel();
}

// ---- 화면 크기 ----
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  const base = Math.max(2, Math.round(canvas.height / (16 * 19)));
  T = 16 * Math.max(2, base + zoom);
}
window.addEventListener('resize', resize);

let fpsN = 0, fps = 0;
function draw() {
  const cw = canvas.width, ch = canvas.height;
  const shake = G.shake > 0 ? G.shake * T * 0.3 : 0;
  const cam = G.cam;
  const keep = { x: cam.x, y: cam.y };
  // 세상 끝 밖은 보이지 않게
  const drawT = T * (G.mobs.some(isBoss) ? 0.72 : G.adventure?.coop ? 0.85 : 1);
  const vw = cw / drawT, vh = ch / drawT;
  cam.x = Math.max(vw / 2, Math.min(W - vw / 2, cam.x)) + (G.rng() - 0.5) * shake / T;
  cam.y = Math.max(vh / 2 - 8, Math.min(H - vh / 2, cam.y)) + (G.rng() - 0.5) * shake / T;
  render(g, G, cw, ch, drawT);
  G.cam.x = keep.x;
  G.cam.y = keep.y;
  if (G.fade > 0) {
    g.fillStyle = `rgba(0,0,0,${Math.min(1, G.fade)})`;
    g.fillRect(0, 0, cw, ch);
  }
  renderHUD();
  adventure.hud();
  fpsN++;
  if ($('debug').hidden === false) {
    const p = G.player;
    const x = Math.floor(p.x + p.w / 2), y = Math.floor(p.y + p.h - 0.1);
    $('debug').textContent = `x ${x}  y ${y}  깊이 ${Math.max(0, y - G.w.surface[Math.max(0, Math.min(W - 1, x))])}  ${BIOME_NAMES[G.w.biome[Math.max(0, Math.min(W - 1, x))]]}\n빛 ${Math.round(lightAt(x, Math.floor(p.y + 1)))}  생물 ${G.mobs.length}  ${fps}fps  ${G.day}일째`;
  }
  const info = $('heldInfo');
  if (G.heldId === I.COMPASS) {
    const dx = Math.round(G.player.spawn.x - G.player.x);
    info.hidden = false;
    info.textContent = Math.abs(dx) < 2 ? '🧭 다시 태어나는 곳에 있어' : `🧭 다시 태어나는 곳까지 ${dx < 0 ? '←' : '→'} ${Math.abs(dx)}칸`;
  } else if (G.heldId === I.CLOCK) {
    info.hidden = false;
    const tt = G.time;
    info.textContent = `🕐 ${tt < 0.05 ? '해 뜨는 중' : tt < 0.5 ? '낮' : tt < 0.56 ? '해 지는 중' : '밤'} · ${G.day}일째`;
  } else info.hidden = true;
}
setInterval(() => {
  fps = fpsN;
  fpsN = 0;
}, 1000);

// ---- 입력 ----
const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'F3']);
window.addEventListener('keydown', (e) => {
  if (commands.isOpen() || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
  if (G && !G.paused && !G.dead && (e.code === 'KeyT' || (e.code === 'Slash' && !G.adventure?.coop))) { e.preventDefault(); commands.open(); return; }
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  if (!G) return;
  if (e.repeat && !['KeyQ'].includes(e.code)) {
    keys.add(e.code);
    return;
  }
  keys.add(e.code);
  unlockAudio();
  if (adventure.key(e)) return;
  if (e.code === 'Comma' && G.adventure?.coop && !G.companion.spectator && !G.paused && !G.dead && !UI.open) {
    const p = G.player;
    G.companion.sel = p.sel;
    G.partnerDuringPlace = p;
    try { G.player = G.companion; placeBlock(Math.floor(G.player.x + (G.player.face > 0 ? 1.4 : -0.7)), Math.floor(G.player.y + 0.8), G.player.inv[p.sel]?.id ?? 0); }
    finally { G.player = p; G.partnerDuringPlace = null; hudDirty(); }
    return;
  }
  if (e.code === 'Escape') {
    if (UI.open) closePanel();
    else togglePause();
    return;
  }
  if ($('pause').hidden === false || G.dead) return;
  if (e.code === 'KeyE') {
    if (UI.open) closePanel();
    else openPanel('inv');
    return;
  }
  if (e.code.startsWith('Digit')) {
    const n = Number(e.code.slice(5));
    if (n >= 1 && n <= 9) selectSlot(n - 1);
  }
  if (e.code === 'KeyQ' && !UI.open) dropHeld(e.ctrlKey || e.metaKey);
  if (e.code === 'KeyF' && G.mode === 'creative') {
    G.player.flying = !G.player.flying;
    toast(G.player.flying ? '날기 켬 (스페이스 위, Shift 아래)' : '날기 끔');
  }
  if (e.code === 'Space' && G.mode === 'creative' && !e.repeat) {
    const now = performance.now();
    if (now - (G.lastSpace ?? 0) < 300) G.player.flying = !G.player.flying;
    G.lastSpace = now;
  }
  if (e.code === 'F3' || e.code === 'KeyO') $('debug').hidden = !$('debug').hidden;
  if (e.code === 'KeyM') toggleSound();
  if (e.code === 'Equal' || e.code === 'NumpadAdd') { zoom = Math.min(4, zoom + 1); resize(); }
  if (e.code === 'Minus' || e.code === 'NumpadSubtract') { zoom = Math.max(-2, zoom - 1); resize(); }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => {
  keys.clear();
  mouse.left = mouse.right = false;
});
function selectSlot(n) {
  G.player.sel = n;
  G.player.bowT = -1;
  showHeldName();
  if (UI.open) renderPanel();
}
let heldNameTimer = 0;
function showHeldName() {
  const s = held();
  const el = $('heldName');
  clearTimeout(heldNameTimer);
  if (!s) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.textContent = [ITEMS[s.id].name,...enchantLines(s)].join(' · ');
  heldNameTimer = setTimeout(() => { el.hidden = true; }, 1600);
}
function dropHeld(all) {
  const s = held();
  if (!s) return;
  const p = G.player;
  const n = all ? s.count : 1;
  G.drops.push({ id: s.id, count: n, dur: s.dur, enchants:s.enchants?{...s.enchants}:undefined, x: p.x + p.w / 2 - 0.175 + p.face * 0.5, y: p.y + 0.4, w: 0.35, h: 0.35, vx: p.face * 6, vy: -3, age: -1, seed: G.rng() * 10 });
  s.count -= n;
  if (s.count <= 0) p.inv[p.sel] = null;
  hudDirty();
}
canvas.addEventListener('wheel', (e) => {
  if (!G || UI.open) return;
  e.preventDefault();
  const d = Math.sign(e.deltaY);
  selectSlot((G.player.sel + d + 9) % 9);
}, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointermove', (e) => {
  mouse.x = e.offsetX;
  mouse.y = e.offsetY;
  mouse.inside = true;
});
canvas.addEventListener('pointerleave', (e) => {
  if (e.pointerType === 'mouse') mouse.inside = false;
});
canvas.addEventListener('pointerdown', (e) => {
  if (!G) return;
  unlockAudio();
  canvas.setPointerCapture?.(e.pointerId);
  mouse.x = e.offsetX;
  mouse.y = e.offsetY;
  mouse.inside = true;
  mouse.touch = e.pointerType === 'touch';
  if (UI.open || G.dead) return;
  updateTarget();
  const isRight = e.button === 2 || (mouse.touch && touchMode === 'place');
  if (isRight) {
    mouse.right = true;
    if (held()?.id === I.BOW) G.player.bowT = 0;
    else {
      doUse();
      G.useT = 0.3;
    }
  } else if (e.button === 0) {
    mouse.left = true;
    tryAttack();
  }
});
window.addEventListener('pointerup', (e) => {
  if (!G) return;
  if (e.button === 2 || (mouse.touch && mouse.right)) {
    mouse.right = false;
    releaseBow();
  }
  if (e.button === 0) mouse.left = false;
  if (mouse.touch) mouse.inside = false;
});

// 터치 버튼
function bindTouch() {
  const box = $('touch');
  const press = (el, on) => {
    const k = el.dataset.key;
    if (k) {
      if (on) keys.add(k);
      else keys.delete(k);
      el.classList.toggle('on', on);
    }
  };
  box.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('button');
    if (!el || !G) return;
    e.preventDefault();
    unlockAudio();
    el.setPointerCapture?.(e.pointerId);
    press(el, true);
    const act = el.dataset.act;
    if (act === 'inv') { if (UI.open) closePanel(); else openPanel('inv'); }
    if (act === 'mode') {
      touchMode = touchMode === 'mine' ? 'place' : 'mine';
      el.textContent = touchMode === 'mine' ? '⛏ 캐기' : '🧱 놓기';
      el.classList.toggle('place', touchMode === 'place');
    }
    if (act === 'drop') dropHeld(false);
    if (act === 'menu') togglePause();
    if (act === 'fly' && G.mode === 'creative') G.player.flying = !G.player.flying;
  });
  const up = (e) => {
    const el = e.target.closest('button');
    if (el) press(el, false);
  };
  box.addEventListener('pointerup', up);
  box.addEventListener('pointercancel', up);
  box.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ---- 메뉴 ----
function togglePause(force) {
  if (!G) return;
  const el = $('pause');
  const show = force ?? el.hidden;
  el.hidden = !show;
  G.paused = show;
  if (show) {
    $('pauseInfo').textContent = `${G.name} · ${G.mode === 'creative' ? '크리에이티브' : `서바이벌 (${DIFF_NAMES[G.diff]})`} · ${G.day}일째 · 시드 ${G.w.seed}`;
    saveGame(true);
  }
}
function toggleSound() {
  sound.on = !sound.on;
  updateSoundButtons();
  toast(sound.on ? '소리 켬' : '소리 끔');
}
function updateSoundButtons() {
  $('btnSound').textContent = `소리: ${sound.on ? '켬' : '끔'}`;
  $('btnMusic').textContent = `음악: ${sound.music ? '켬' : '끔'}`;
  store('pixelcraft.sound', JSON.stringify(sound));
}

function startGame(game) {
  commands.reset();
  G = game;
  keys.clear(); mouse.left = mouse.right = false;
  demo = null;
  initUI(G, {
    drop: (id, count, dur, enchants) => spawnDrop(G.player.x + G.player.w / 2, G.player.y + 0.5, id, count, dur, enchants),
    onSelect: () => showHeldName(),
    onCraft: () => { hudDirty(); }, toast, save:()=>saveGame(true),
  });
  $('title').hidden = true;
  $('hud').hidden = false;
  $('touch').classList.toggle('creative', G.mode === 'creative');
  $('touch').classList.toggle('jump-world', !!G.jump);
  hudDirty();
  G.hintHidden = false;
  resize();
  if (G.day === 1 && G.playTime < 1) toast(`${G.name}에 온 걸 환영해!`);
  adventure.start();
}
function quitToTitle() {
  saveGame(true);
  closePanel();
  adventure.reset();
  commands.reset();
  G = null;
  $('pause').hidden = true;
  $('death').hidden = true;
  $('hud').hidden = true;
  $('hint').hidden = true;
  if (!demo) makeDemo();
  showTitle();
}

function showTitle() {
  $('title').hidden = false;
  $('newWorld').hidden = true;
  const list = $('slots');
  list.innerHTML = '';
  for (let k = 0; k < SLOTS; k++) {
    const s = slotSummary(k);
    const row = document.createElement('div');
    row.className = 'slotrow';
    if (s) {
      const mins = Math.floor(s.playTime / 60);
      row.innerHTML = `<div class="sinfo"><b></b><small>${s.jump ? '점프맵 세계' : s.mode === 'creative' ? '크리에이티브' : `서바이벌 · ${DIFF_NAMES[s.diff]}`} · ${s.day}일째 · ${mins}분 놀았어</small></div><button class="mc-btn play">이어 하기</button><button class="mc-btn del">지우기</button>`;
      row.querySelector('b').textContent = s.name;
      row.querySelector('.play').onclick = () => {
        unlockAudio();
        const game = loadGame(k);
        if (game) startGame(game);
        else toast('세계를 불러오지 못했어');
      };
      const del = row.querySelector('.del');
      del.onclick = () => {
        if (del.dataset.sure) {
          store(SAVE_KEY(k), null);
          showTitle();
        } else {
          del.dataset.sure = '1';
          del.textContent = '정말 지울까?';
          del.classList.add('danger');
        }
      };
    } else {
      row.innerHTML = `<div class="sinfo"><b>빈 칸 ${k + 1}</b><small>아직 세계가 없어</small></div><button class="mc-btn play">새 세계 만들기</button>`;
      row.querySelector('.play').onclick = () => openNewWorld(k);
    }
    list.appendChild(row);
  }
  const full = Array.from({ length: SLOTS }, (_, k) => !!load(SAVE_KEY(k))).every(Boolean);
  $('btnBuildWorld').disabled=full;
  $('btnJumpWorld').disabled = full;
  $('btnJumpWorld').textContent = full ? '점프맵 시작 · 저장 칸을 하나 비워 줘' : '☠ 극한 점프맵 세계로 들어가기';
}
let newSlot = 0;
function updateWorldChoice() {
  const jump = $('nwWorldType').value === 'jump',builder=$('nwWorldType').value==='builder';
  for (const id of ['modeChoice', 'diffChoice', 'dayLengthChoice']) $(id).hidden = jump||builder;
  $('buildWorldNote').hidden=!builder;
  $('jumpWorldNote').hidden = !jump;
}
function openNewWorld(k, type = 'overworld') {
  $('nwWorldType').value = type;
  updateWorldChoice();
  newSlot = k;
  $('newWorld').hidden = false;
  $('nwName').value = type === 'jump' ? '극한 점프맵' : `나의 세계 ${k + 1}`;
  $('nwSeed').value = '';
  if (account.user) $('nwPlayer').value = account.user.name;
  $('nwName').focus();
}
function createWorld() {
  unlockAudio();
  const name = $('nwName').value.trim().slice(0, 20) || `나의 세계 ${newSlot + 1}`;
  const seedText = $('nwSeed').value.trim();
  const seed = seedText ? seedFromText(seedText) : Math.floor(Math.random() * 2 ** 31);
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const diff = Number(document.querySelector('input[name="diff"]:checked').value);
  $('loading').hidden = false;
  setTimeout(() => {
    const game = newGame({ worldType: $('nwWorldType').value, name, seed, mode, diff, slot: newSlot, coop: $('nwCoop').checked, skin: Number($('nwSkin').value), playerName: $('nwPlayer').value.trim().slice(0, 16) });
    game.adventure.dayLength = Number($('nwDayLength').value);
    $('loading').hidden = true;
    startGame(game);
    saveGame(true);
  }, 30);
}

// ---- 타이틀 배경: 천천히 흘러가는 세상 ----
function makeDemo() {
  const w = generateWorld(20261018);
  const sp = findSpawn(w);
  demo = baseGame(w, { name: '', mode: 'survival', diff: 0, slot: -1 });
  demo.dead = true;
  demo.time = 0.12;
  demo.cam = { x: sp.x - 30, y: sp.y - 2 };
}
function drawDemo(dt) {
  demo.clock += dt;
  demo.time = (demo.time + dt / 240) % 1;
  demo.cam.x += dt * 2.2;
  if (demo.cam.x > W - 40) demo.cam.x = 40;
  const s = demo.w.surface[Math.floor(demo.cam.x)];
  demo.cam.y += (s - 3 - demo.cam.y) * Math.min(1, dt * 0.8);
  render(g, demo, canvas.width, canvas.height, T);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  try {
    if (G) {
      if (!G.paused) update(dt);
      draw();
    } else if (demo) drawDemo(dt);
  } catch (err) {
    console.error(err);
  }
  requestAnimationFrame(frame);
}

function boot() {
  buildTextures();
  try {
    Object.assign(sound, JSON.parse(load('pixelcraft.sound') ?? '{}'));
  } catch {
    /* 기본값 사용 */
  }
  updateSoundButtons();
  resize();
  makeDemo();
  showTitle();
  initAccount(showTitle);
  bindTouch();
  $('nwCreate').onclick = createWorld;
  $('nwWorldType').onchange = updateWorldChoice;
  $('btnBuildWorld').onclick=()=>{if($('slots').inert)return;const slot=Array.from({length:SLOTS},(_,i)=>i).find(i=>!load(SAVE_KEY(i)));if(slot===undefined)return toast('저장 칸을 하나 비워 줘.');openNewWorld(slot,'builder');};
  $('btnJumpWorld').onclick = () => {
    if ($('slots').inert) return toast('계정 확인 중이야. 잠시만 기다려 줘!');
    const slot = Array.from({ length: SLOTS }, (_, i) => i).find(i => !load(SAVE_KEY(i)));
    if (slot === undefined) return toast('저장 칸이 가득 찼어. 필요 없는 세계를 지우면 점프맵을 만들 수 있어.');
    openNewWorld(slot, 'jump');
  };
  $('nwCancel').onclick = () => { $('newWorld').hidden = true; };
  $('nwName').addEventListener('keydown', (e) => { if (e.key === 'Enter') createWorld(); });
  $('btnResume').onclick = () => togglePause(false);
  $('btnSave').onclick = () => saveGame(false);
  $('btnQuit').onclick = quitToTitle;
  $('btnSound').onclick = () => { sound.on = !sound.on; updateSoundButtons(); };
  $('btnMusic').onclick = () => { sound.music = !sound.music; updateSoundButtons(); };
  $('btnRespawn').onclick = respawn;
  $('btnDeathQuit').onclick = () => { respawn(); quitToTitle(); };
  $('hint').querySelector('button').onclick = () => { if (G) G.hintHidden = true; $('hint').hidden = true; };
  $('blockCatalogButton').onclick=()=>{if(G&&!G.jump){UI.tab=0;UI.search='';UI.page=0;openPanel('catalog');}};
  $('enchantButton').onclick=()=>{if(!G||G.jump)return;const p=G.player;for(let y=Math.max(0,Math.floor(p.y)-4);y<Math.min(H,p.y+5);y++)for(let x=Math.max(0,Math.floor(p.x)-4);x<Math.min(W,p.x+5);x++)if(tileAt(x,y)===B.ENCHANTING_TABLE)return openPanel('enchant',y*W+x);if(G.mode==='creative')return openPanel('enchant');toast('먼저 마법 부여대를 만들고 가까이 가 줘! 제작대에서 책 1개·다이아몬드 2개·흑요석 4개로 만들 수 있어.');};
  $('btnHelp').onclick = () => { $('help').hidden = !$('help').hidden; };
  $('helpClose').onclick = () => { $('help').hidden = true; };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G) saveGame(true);
  });
  window.addEventListener('pagehide', () => { if (G) saveGame(true); });
  requestAnimationFrame(frame);
  // 브라우저 확인 스크립트가 들여다볼 수 있게
  window.__pixelcraft = { adventure, W, H, get G() { return G; }, startGame, newGame, loadGame, saveGame, serialize, keys, mouse, setTile, breakBlock, placeBlock, doUse, hitMob, sleepInBed, explode, makeMob, openPanel, closePanel, UI };
}
const adventure = createAdventureController({ get: () => G, keys, UI, closePanel, toast, hudDirty, save: () => saveGame(true), makeMob, hitMob, shootArrow, hurtPlayer, sleepInBed, populateNether: () => spawnNether(G,makeMob,true), populateEnd: () => populateEnd(G,makeMob), breakInfo, breakBlock, wearTool });
const commands = createCommandConsole({ get: () => G, closePanel, clearInput: () => { keys.clear(); mouse.left = mouse.right = false; }, changed: () => { hudDirty(); if (UI.open) renderPanel(); $('touch').classList.toggle('creative', G.mode === 'creative'); }, save: () => saveGame(true) });
boot();
