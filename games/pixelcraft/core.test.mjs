import test from 'node:test';
import assert from 'node:assert/strict';
import { B, I, BLOCKS, ITEMS, RECIPES, SMELT, FUEL, MOBS } from '../../public/play/pixelcraft/data.mjs';
import {
  W, H, SEA, generateWorld, computeLight, stepFluid, wake, moveBody, addItem, countItem, matchRecipe, canCraft,
  craftFromSlots, breakInfo, rleEncode, rleDecode, findSpawn, seedFromText, idx,
} from '../../public/play/pixelcraft/core.mjs';

const world = generateWorld(1234);

// 빈 시험장: 위는 공기, y=50 부터 돌
function flatWorld() {
  const w = generateWorld(99);
  w.tiles.fill(B.AIR);
  w.meta.fill(0);
  for (let y = 50; y < H; y++) for (let x = 0; x < W; x++) w.tiles[idx(x, y)] = B.STONE;
  computeLight(w, 0, W - 1);
  return w;
}
function runFluid(w, active, fid, steps) {
  for (let k = 0; k < steps; k++) stepFluid(w, fid, active);
}

test('같은 시드는 같은 세계, 바닥은 기반암', () => {
  const again = generateWorld(1234);
  assert.deepEqual(again.tiles, world.tiles);
  for (let x = 0; x < W; x++) assert.equal(world.tiles[idx(x, H - 1)], B.BEDROCK);
});

test('처음 서는 자리는 마른 땅 위이고 몸이 끼지 않는다', () => {
  for (const seed of [1, 7, 1234, 2026, 99999, seedFromText('인혁')]) {
    const w = generateWorld(seed);
    const sp = findSpawn(w);
    const fx = Math.floor(sp.x + 0.3), fy = Math.floor(sp.y + 1.85 + 0.1);
    assert.ok(BLOCKS[w.tiles[idx(fx, fy)]].solid, `seed ${seed}: 발밑이 땅`);
    assert.ok(!BLOCKS[w.tiles[idx(fx, fy - 1)]].solid, `seed ${seed}: 몸 자리는 비어 있음`);
    assert.ok(fy < SEA, `seed ${seed}: 바다 위가 아님`);
  }
});

test('가운데 근처에 나무가 있어서 맨손으로 시작할 수 있다', () => {
  for (const seed of [1, 7, 1234, 2026, 99999]) {
    const w = generateWorld(seed);
    let trunks = 0;
    for (let x = W / 2 - 40; x < W / 2 + 40; x++) for (let y = 0; y < SEA; y++) if ([B.OAK_TRUNK, B.BIRCH_TRUNK, B.SPRUCE_TRUNK].includes(w.tiles[idx(x, y)])) trunks++;
    assert.ok(trunks >= 8, `seed ${seed}: 줄기 ${trunks}`);
  }
});

test('광석: 다이아몬드는 깊은 곳에만, 석탄과 철은 넉넉히', () => {
  const count = {};
  let shallowDiamond = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = world.tiles[idx(x, y)];
    count[t] = (count[t] ?? 0) + 1;
    if (t === B.DIAMOND_ORE && y < 125) shallowDiamond++;
  }
  assert.equal(shallowDiamond, 0);
  assert.ok(count[B.DIAMOND_ORE] > 40);
  assert.ok(count[B.IRON_ORE] > 500);
  assert.ok(count[B.COAL_ORE] > 1000);
  assert.ok(count[B.LAVA] > 0);
});

test('하늘빛은 땅 위에서 15, 막힌 방의 횃불은 둘레를 밝힌다', () => {
  const w = flatWorld();
  assert.equal(w.sky[idx(100, 49)], 15);
  // 돌 속에 3x3 방을 파고 횃불
  for (let y = 70; y < 73; y++) for (let x = 100; x < 103; x++) w.tiles[idx(x, y)] = B.AIR;
  w.tiles[idx(101, 72)] = B.TORCH;
  computeLight(w, 80, 120);
  assert.equal(w.sky[idx(101, 71)], 0);
  assert.equal(w.blk[idx(101, 72)], 14);
  assert.equal(w.blk[idx(100, 70)], 11);
});

test('물: 샘은 평평한 바닥에서 7칸까지 퍼지고, 샘을 치우면 마른다', () => {
  const w = flatWorld();
  const active = new Set();
  w.tiles[idx(200, 49)] = B.WATER;
  w.meta[idx(200, 49)] = 8;
  wake(active, idx(200, 49));
  runFluid(w, active, B.WATER, 30);
  assert.equal(w.tiles[idx(207, 49)], B.WATER);
  assert.equal(w.tiles[idx(193, 49)], B.WATER);
  assert.equal(w.tiles[idx(208, 49)], B.AIR);
  w.tiles[idx(200, 49)] = B.AIR;
  w.meta[idx(200, 49)] = 0;
  wake(active, idx(200, 49));
  runFluid(w, active, B.WATER, 40);
  for (let x = 190; x <= 210; x++) assert.equal(w.tiles[idx(x, 49)], B.AIR, `x=${x} 말랐음`);
});

test('물은 구멍으로 떨어지고 바닥에서 다시 퍼진다', () => {
  const w = flatWorld();
  for (let y = 50; y < 54; y++) w.tiles[idx(300, y)] = B.AIR;
  for (let x = 296; x < 305; x++) w.tiles[idx(x, 54)] = B.AIR;
  const active = new Set();
  w.tiles[idx(303, 49)] = B.WATER;
  w.meta[idx(303, 49)] = 8;
  wake(active, idx(303, 49));
  runFluid(w, active, B.WATER, 40);
  assert.equal(w.tiles[idx(300, 52)], B.WATER);
  assert.equal(w.tiles[idx(297, 54)], B.WATER);
});

test('물과 용암 샘이 닿으면 흑요석', () => {
  const w = flatWorld();
  const water = new Set();
  w.tiles[idx(400, 49)] = B.LAVA;
  w.meta[idx(400, 49)] = 8;
  w.tiles[idx(402, 49)] = B.WATER;
  w.meta[idx(402, 49)] = 8;
  wake(water, idx(402, 49));
  runFluid(w, water, B.WATER, 5);
  assert.equal(w.tiles[idx(400, 49)], B.OBSIDIAN);
});

test('조합법: 원목은 아무 나무나, 모양은 칸 어디에 놓아도, 좌우를 뒤집어도 된다', () => {
  assert.equal(matchRecipe([B.BIRCH_LOG, 0, 0, 0], 2).out[0], B.PLANKS);
  const pick = [I.IRON_INGOT, I.IRON_INGOT, I.IRON_INGOT, 0, I.STICK, 0, 0, I.STICK, 0];
  assert.equal(matchRecipe(pick, 3).out[0], I.IRON_PICK);
  const axeLeft = [B.COBBLE, B.COBBLE, 0, B.COBBLE, I.STICK, 0, 0, I.STICK, 0];
  const axeRight = [0, B.COBBLE, B.COBBLE, 0, I.STICK, B.COBBLE, 0, I.STICK, 0];
  assert.equal(matchRecipe(axeLeft, 3).out[0], I.STONE_AXE);
  assert.equal(matchRecipe(axeRight, 3).out[0], I.STONE_AXE);
  const table = [0, 0, 0, 0, B.PLANKS, B.PLANKS, 0, B.PLANKS, B.PLANKS];
  assert.equal(matchRecipe(table, 3).out[0], B.CRAFTING);
  assert.equal(matchRecipe([I.FLINT, I.IRON_INGOT, 0, 0], 2).out[0], I.FLINT_STEEL);
  assert.equal(matchRecipe([B.DIRT, B.DIRT, 0, 0], 2), null);
});

test('조합법 재료와 결과는 모두 있는 아이템이다', () => {
  for (const r of RECIPES) {
    assert.ok(ITEMS[r.out[0]], `결과 ${r.out[0]}`);
    const cells = r.items ?? r.cells.flat().filter(Boolean);
    for (const opt of cells) for (const id of opt) assert.ok(ITEMS[id], `재료 ${id} (조합 ${r.index})`);
  }
  for (const [from, to] of Object.entries(SMELT)) {
    assert.ok(ITEMS[from] && ITEMS[to], `굽기 ${from}→${to}`);
  }
  for (const id of Object.keys(FUEL)) assert.ok(ITEMS[id], `연료 ${id}`);
  for (const m of Object.values(MOBS)) for (const [id] of m.drops) assert.ok(ITEMS[id], `${m.name} 떨굼 ${id}`);
});

test('가방: 같은 것끼리 64개까지 쌓이고, 도구는 하나씩, 손 줄부터 채운다', () => {
  const inv = Array(36).fill(null);
  assert.equal(addItem(inv, B.DIRT, 100), 0);
  assert.deepEqual([inv[0].count, inv[1].count], [64, 36]);
  addItem(inv, I.WOOD_PICK, 2, 59);
  assert.equal(inv[2].count, 1);
  assert.equal(inv[3].id, I.WOOD_PICK);
  assert.equal(countItem(inv, [B.DIRT]), 100);
});

test('가방 재료로 바로 만들기', () => {
  const inv = Array(36).fill(null);
  addItem(inv, B.PLANKS, 3);
  addItem(inv, I.STICK, 2);
  const rec = RECIPES.find((r) => r.out[0] === I.WOOD_PICK);
  assert.ok(canCraft(inv, rec));
  assert.ok(craftFromSlots(inv, rec));
  assert.equal(countItem(inv, [B.PLANKS, I.STICK]), 0);
  assert.equal(canCraft(inv, rec), false);
});

test('캐기: 맞는 곡괭이가 있어야 광석이 나온다', () => {
  assert.equal(breakInfo(B.STONE, 0).harvest, false);
  assert.equal(breakInfo(B.STONE, I.WOOD_PICK).harvest, true);
  assert.equal(breakInfo(B.IRON_ORE, I.WOOD_PICK).harvest, false);
  assert.equal(breakInfo(B.IRON_ORE, I.STONE_PICK).harvest, true);
  assert.equal(breakInfo(B.DIAMOND_ORE, I.STONE_PICK).harvest, false);
  assert.equal(breakInfo(B.DIAMOND_ORE, I.IRON_PICK).harvest, true);
  assert.equal(breakInfo(B.OBSIDIAN, I.IRON_PICK).harvest, false);
  assert.equal(breakInfo(B.OBSIDIAN, I.DIAMOND_PICK).harvest, true);
  assert.ok(breakInfo(B.DIRT, I.WOOD_SHOVEL).time < breakInfo(B.DIRT, 0).time);
  assert.equal(breakInfo(B.BEDROCK, I.DIAMOND_PICK).time, Infinity);
  assert.ok(Math.abs(breakInfo(B.OAK_LOG, 0).time - 3) < 1e-9);
});

test('몸: 떨어져서 땅에 서고, 한 칸 턱은 올라서고, 두 칸 벽에는 막힌다', () => {
  const w = flatWorld();
  const p = { x: 100.2, y: 40, w: 0.6, h: 1.8, vx: 0, vy: 0, step: true };
  for (let k = 0; k < 120; k++) {
    p.vy = Math.min(p.vy + 30 / 60, 28);
    moveBody(w, p, 1 / 60);
  }
  assert.ok(p.onGround);
  assert.ok(Math.abs(p.y + p.h - 50) < 1e-6);
  w.tiles[idx(103, 49)] = B.STONE;
  for (let k = 0; k < 60; k++) {
    p.vx = 4;
    p.vy = Math.min(p.vy + 0.5, 28);
    moveBody(w, p, 1 / 60);
  }
  assert.ok(p.x > 103, '턱을 넘어감');
  w.tiles[idx(108, 49)] = B.STONE;
  w.tiles[idx(108, 48)] = B.STONE;
  for (let k = 0; k < 120; k++) {
    p.vx = 4;
    p.vy = Math.min(p.vy + 0.5, 28);
    moveBody(w, p, 1 / 60);
  }
  assert.ok(p.x + p.w <= 108 + 1e-6, '두 칸 벽 앞에서 멈춤');
});

test('저장 압축은 그대로 되돌아온다', () => {
  const back = rleDecode(rleEncode(world.tiles), W * H);
  assert.deepEqual(back, world.tiles);
  assert.ok(rleEncode(world.tiles).length < W * H * 0.8);
});
