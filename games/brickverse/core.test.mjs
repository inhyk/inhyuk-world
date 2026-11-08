import test from 'node:test';
import assert from 'node:assert/strict';
import {
  P, makeBox, newPlayer, stepPlayer, clearMotion, placeBox, cleanSave, defaultSave, rayBoxes, segmentDistance,
  TYCOON, tycoonIncome, tycoonAvailable, tycoonAwayEarnings, TYCOON_START_DROP, packPose, unpackPose, lookToArray, lookFromArray, DEFAULT_LOOK,
  OBBY_STAGES, HATS, HAIRS, FREE_HAIRS, tileAt, WEAPONS, applyDamage, zonePhases, zoneAt, outsideZone, rayBody, battleCoins, BATTLE, freshAmmo, reloadAmmo, ammoBox, SURVIVAL, validGift, halfOf, GIFT_MAX, TOWER, BLOCKS, cleanTowerBlocks, packBlocks, unpackBlocks, towerFloor, inTower,
} from './core.mjs';
import { buildHub, buildObby, buildTycoon, buildSurvival, tycoonBase, tycoonItem, PLOT_SLOTS } from './worlds.mjs';

const floor = (x, z, w, d, top = 0, k) => makeBox({ x, y: top - 0.5, z, w, h: 1, d, k });
function run(pl, boxes, seconds, input = () => ({ mx: 0, mz: 0, jump: false })) {
  const dt = 1 / 60;
  let last = null;
  for (let t = 0; t < seconds; t += dt) { clearMotion(boxes); last = stepPlayer(pl, input(t), boxes, dt); if (last.kill) return { kill: true }; }
  return last;
}

test('서 있으면 바닥 위에 멈춘다', () => {
  const boxes = [floor(0, 0, 10, 10)];
  const pl = newPlayer(0, 2, 0);
  run(pl, boxes, 1.5);
  assert.ok(Math.abs(pl.y) < 1e-6, `y=${pl.y}`);
  assert.equal(pl.ground, boxes[0]);
});

test('점프 높이는 2.3~2.6', () => {
  const boxes = [floor(0, 0, 10, 10)];
  const pl = newPlayer(0, 0, 0);
  run(pl, boxes, 0.2);
  let top = 0;
  run(pl, boxes, 1.2, t => { top = Math.max(top, pl.y); return { mx: 0, mz: 0, jump: t < 0.02 }; });
  assert.ok(top > 2.3 && top < 2.6, `top=${top}`);
});

test('달려서 4.5칸 틈을 뛰어넘는다', () => {
  const boxes = [floor(0, -7, 6, 20), floor(0, 3 + 4.5 + 3, 6, 6)];
  const pl = newPlayer(0, 0, -8);
  run(pl, boxes, 0.1);
  run(pl, boxes, 2.4, () => ({ mx: 0, mz: pl.z < 10.5 ? 1 : 0, jump: pl.z > 2.6 && pl.ground === boxes[0] }));
  assert.equal(pl.ground, boxes[1]);
});

test('0.6 높이 계단은 걸어서 올라간다', () => {
  const boxes = [floor(0, 0, 4, 40)];
  for (let i = 0; i < 5; i++) boxes.push(floor(0, 4 + i * 1.3, 4, 1.3, (i + 1) * 0.55));
  const pl = newPlayer(0, 0, -6);
  run(pl, boxes, 3, () => ({ mx: 0, mz: pl.z < 9 ? 1 : 0, jump: false }));
  assert.ok(pl.y > 2.7, `y=${pl.y}`);
});

test('벽은 못 지나간다', () => {
  const boxes = [floor(0, 0, 20, 20), makeBox({ x: 0, y: 2, z: 3, w: 10, h: 4, d: 1 })];
  const pl = newPlayer(0, 0, 0);
  run(pl, boxes, 2, () => ({ mx: 0, mz: 1, jump: false }));
  assert.ok(pl.z < 2.5 - P.R + 0.01, `z=${pl.z}`);
});

test('용암에 닿으면 kill', () => {
  const boxes = [floor(0, 0, 4, 4), floor(0, 4, 4, 4, 0, 'kill')];
  const pl = newPlayer(0, 0, 0);
  const ev = run(pl, boxes, 1.5, () => ({ mx: 0, mz: 1, jump: false }));
  assert.equal(ev.kill, true);
});

test('사다리를 밀면 올라간다', () => {
  const boxes = [floor(0, 0, 10, 10), makeBox({ x: 0, y: 4, z: 2, w: 3, h: 8, d: 0.6, k: 'ladder' }), makeBox({ x: 0, y: 7.5, z: 5.3, w: 6, h: 1, d: 6 })];
  const pl = newPlayer(0, 0, 0);
  run(pl, boxes, 3, () => ({ mx: 0, mz: pl.z < 4 ? 1 : 0, jump: false }));
  assert.ok(pl.y >= 7.99, `y=${pl.y}`);
});

test('움직이는 발판은 탄 사람을 같이 옮긴다', () => {
  const plat = makeBox({ x: 0, y: -0.5, z: 0, w: 4, h: 1, d: 4 });
  const pl = newPlayer(0, 0, 0);
  const dt = 1 / 60;
  stepPlayer(pl, { mx: 0, mz: 0 }, [plat], dt);
  for (let i = 1; i < 120; i++) {
    clearMotion([plat]);
    placeBox(plat, Math.sin(i * dt) * 3, -0.5, 0);
    stepPlayer(pl, { mx: 0, mz: 0 }, [plat], dt);
  }
  assert.ok(Math.abs(pl.x - Math.sin(119 * dt) * 3) < 0.05, `x=${pl.x}`);
});

test('벨트는 서 있는 사람을 민다', () => {
  const boxes = [makeBox({ x: 0, y: -0.5, z: 0, w: 4, h: 1, d: 40, k: 'conveyor', cv: [0, 3] })];
  const pl = newPlayer(0, 0, 0);
  run(pl, boxes, 1);
  assert.ok(pl.z > 2.5, `z=${pl.z}`);
});

test('점프대는 높이 튕긴다', () => {
  const boxes = [floor(0, 0, 4, 4, 0, 'bounce')];
  const pl = newPlayer(0, 0.5, 0);
  let top = 0;
  run(pl, boxes, 1.2, () => { top = Math.max(top, pl.y); return { mx: 0, mz: 0 }; });
  assert.ok(top > 7.5, `top=${top}`);
});

test('카메라 광선은 벽에서 멈춘다', () => {
  const boxes = [makeBox({ x: 0, y: 0, z: 5, w: 10, h: 10, d: 1 })];
  const t = rayBoxes(0, 0, 0, 0, 0, 1, boxes, 20);
  assert.ok(Math.abs(t - 4.5) < 1e-6);
  assert.ok(Math.abs(segmentDistance(0, 0, -1, 1, 1, 1) - 1) < 1e-9);
});

test('저장 정리: 이상한 값은 기본값, 안 산 모자는 못 쓴다', () => {
  const s = cleanSave({ coins: -5, look: { hat: 15, skin: 99 }, owned: { hat: [999, 'x'] }, obby: { cp: 400 }, tycoon: { items: ['roof', 'floor'], cash: 'a' }, name: [3, 999] });
  assert.equal(s.coins, 0);
  assert.equal(s.look.hat, DEFAULT_LOOK.hat);
  assert.equal(s.look.skin, DEFAULT_LOOK.skin);
  assert.equal(s.obby.cp, OBBY_STAGES);
  assert.deepEqual(s.tycoon.items, ['floor']);
  assert.equal(s.tycoon.cash, 0);
  assert.equal(s.name[0], 3);
  const ok = cleanSave({ coins: 500, owned: { hat: [13] }, look: { hat: 13 } });
  assert.equal(ok.look.hat, 13);
  assert.equal(HATS[13].id, 'crown');
  assert.deepEqual(cleanSave(JSON.parse(JSON.stringify(defaultSave(() => 0.5)))).name, defaultSave(() => 0.5).name);
});

test('타이쿤: 모두 사면 40~80분 걸린다 (발판 왕복 시간 포함 추정)', () => {
  const owned = [];
  let cash = 0, time = 0;
  while (owned.length < TYCOON.length) {
    const next = tycoonAvailable(owned).sort((a, b) => a.price - b.price)[0];
    const rate = tycoonIncome(owned);
    const wait = Math.max(0, (next.price - cash) / rate);
    time += wait + 6;
    cash += rate * (wait + 6) - next.price;
    owned.push(next.id);
  }
  assert.ok(time > 40 * 60 && time < 80 * 60, `${Math.round(time / 60)}분`);
  assert.ok(tycoonIncome([]) === TYCOON_START_DROP.value / TYCOON_START_DROP.every);
});

test('위치 묶기는 숫자만 쓴다', () => {
  const q = packPose({ x: 1.234, y: 2, z: -3.456 }, 1.5, 2, 1, 3);
  assert.ok(q.every(v => typeof v === 'number'));
  assert.deepEqual(unpackPose(q), { w: 2, x: 1.23, y: 2, z: -3.46, yaw: 1.5, anim: 1, emote: 3 });
  assert.equal(unpackPose([0, 'a', 2, 3, 4, 5, 6]), null);
  assert.deepEqual(lookFromArray(lookToArray(DEFAULT_LOOK)), { ...DEFAULT_LOOK });
});

test('세계 부품은 모두 크기와 위치가 정상', () => {
  const all = [buildHub(), buildObby(), buildTycoon(), buildSurvival()];
  const tycoon = [];
  for (let slot = 0; slot < PLOT_SLOTS.length; slot++) { tycoonBase(tycoon, slot); for (const it of TYCOON) tycoonItem(tycoon, slot, it.id); }
  for (const parts of [...all.map(w => w.parts), tycoon]) {
    for (const p of parts) {
      assert.ok([p.x, p.y, p.z, p.w, p.h, p.d].every(Number.isFinite), JSON.stringify(p));
      assert.ok(p.w > 0 && p.h > 0 && p.d > 0, JSON.stringify(p));
    }
  }
});

// 점프 탑: 체크포인트 사이 발판을 순서대로 이으면, 다음 발판까지는 점프로 닿는 거리여야 한다.
function reach(rise, bounce) {
  const v = bounce ? P.BOUNCE : P.JUMP, g = P.GRAVITY;
  const disc = v * v - 2 * g * rise;
  if (disc < 0) return -1;
  const t = (v + Math.sqrt(disc)) / g;
  return P.SPEED * (t + P.COYOTE * 0.5);
}
function gap(a, b) {
  const dx = Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1));
  const dz = Math.max(0, Math.max(a.z0, b.z0) - Math.min(a.z1, b.z1));
  return Math.hypot(dx, dz);
}
function extent(p) {
  const b = { x0: p.x - p.w / 2, x1: p.x + p.w / 2, z0: p.z - p.d / 2, z1: p.z + p.d / 2, top: p.y + p.h / 2, low: p.y + p.h / 2, high: p.y + p.h / 2 };
  if (p.move) {
    const a = Math.abs(p.move.amp);
    if (p.move.ax === 'x') { b.x0 -= a; b.x1 += a; }
    if (p.move.ax === 'z') { b.z0 -= a; b.z1 += a; }
    if (p.move.ax === 'y') { b.low -= a; b.high += a; }
  }
  return b;
}

test('점프 탑 30단계는 모두 점프로 이어진다', () => {
  const { parts, checkpoints } = buildObby();
  assert.equal(checkpoints.length, OBBY_STAGES + 1);
  const path = parts.filter(p => !p.deco && !p.hidden && p.k !== 'kill' && p.k !== 'ladder' && !(p.shape === 'cyl' && p.w < 1.2) && p.w >= 0.8 && p.d >= 0.8 || p.k === 'check');
  const start = parts[0];
  let prev = extent(start), prevPart = start, problems = [];
  let stage = 0;
  for (const p of path.slice(1)) {
    const e = extent(p);
    if (p.y < -20 && p.m === 'cloud') continue;
    const d = gap(prev, e);
    // 위로 가장 유리한 때: 앞 발판은 높을 때, 다음 발판은 낮을 때
    const rise = e.low - prev.high;
    const bounce = prevPart.k === 'bounce';
    const r = reach(rise, bounce);
    const ladderStage = parts.some(q => q.k === 'ladder' && Math.abs(q.x - p.x) < 8 && Math.abs(q.z - p.z) < 8 && q.y + q.h / 2 >= e.top - 1);
    if (!(d <= r || (d < 0.01 && rise <= P.STEP) || ladderStage)) problems.push(`stage ${stage + 1}: gap ${d.toFixed(2)} rise ${rise.toFixed(2)} reach ${r.toFixed(2)}`);
    if (p.k === 'check') stage = p.cp;
    if (stage >= OBBY_STAGES) break;
    prev = e; prevPart = p;
  }
  assert.deepEqual(problems, []);
});

test('바닥 칸 번호', () => {
  const half = SURVIVAL.N * SURVIVAL.TILE / 2;
  assert.deepEqual(tileAt(-half + 0.1, -half + 0.1), [0, 0]);
  assert.equal(tileAt(half + 1, 0), null);
});

test('타이쿤 밖에 있으면 0.001%로 쌓인다 (소수점 그대로)', () => {
  const rate = tycoonIncome(['floor', 'drop2']);
  assert.ok(Math.abs(tycoonAwayEarnings(['floor', 'drop2'], 3_600_000) - rate * 0.00001 * 3600) < 1e-9);
  assert.equal(tycoonAwayEarnings([], -5000), 0);
  assert.equal(tycoonAwayEarnings([], NaN), 0);
  assert.ok(Math.abs(tycoonAwayEarnings([], 30 * 24 * 3600 * 1000) - tycoonIncome([]) * 0.00001 * 7 * 24 * 3600) < 1e-9);
  // 다 지은 공장은 1시간에 200달러 넘게, 처음 공장은 1달러도 안 된다
  assert.ok(tycoonAwayEarnings(TYCOON.map(it => it.id), 3_600_000) > 200);
  assert.ok(tycoonAwayEarnings([], 3_600_000) < 1);
  assert.equal(cleanSave({ tycoon: { away: 1700000000000, bank: 0.5 } }).tycoon.bank, 0.5);
  assert.equal(cleanSave({ tycoon: { away: 'x', bank: 7 } }).tycoon.away, 0);
  assert.equal(cleanSave({ tycoon: { bank: 7 } }).tycoon.bank, 1);
});

test('타이쿤 목록: 먼저 사야 하는 것은 앞에 있고, 끝판은 둘', () => {
  const seen = new Set();
  for (const it of TYCOON) { assert.ok(!it.need || seen.has(it.need), it.id); seen.add(it.id); }
  assert.equal(TYCOON.length, 45);
  assert.deepEqual(TYCOON.filter(it => it.finale).map(it => [it.id, it.reward]), [['statue', 200], ['rocket', 300], ['crown', 500]]);
  assert.equal(TYCOON.find(it => it.id === 'floor').price, 50);
  assert.equal(TYCOON.find(it => it.id === 'crown').price, 20_000_000);
  const all = TYCOON.map(it => it.id);
  assert.deepEqual(cleanSave({ tycoon: { items: all } }).tycoon.items, all);
});

test('타워 블록 정리: 칸 밖, 겹침, 이상한 종류는 빼고 500개까지', () => {
  const list = cleanTowerBlocks([[0, 0, 0, 1], [0, 0, 0, 2], [12, 0, 0, 1], [0, 100, 0, 1], [0, 1, 0, BLOCKS.length], [0, 1, 0, 3], ['a', 0, 0, 1], [1.5, 0, 0, 1]]);
  assert.deepEqual(list, [[0, 0, 0, 1], [0, 1, 0, 3]]);
  const many = [];
  for (let j = 0; j < 100; j++) for (let i = 0; i < 6; i++) many.push([i, j, 0, 0]);
  assert.equal(cleanTowerBlocks(many).length, TOWER.LIMIT);
  assert.deepEqual(unpackBlocks(packBlocks(list)), list);
  assert.ok(packBlocks(list).every(v => typeof v === 'number'));
  assert.deepEqual(unpackBlocks([1, 2, 3]), []);
  assert.equal(towerFloor(0), 0);
  assert.equal(towerFloor(20), 10);
  assert.ok(inTower(-12, 0, 11) && !inTower(-13, 0, 0) && !inTower(0, -1, 0));
  const s = cleanSave({ tower: { blocks: [[0, 0, 0, 1], [0, 0, 0, 1]], best: 1000 } });
  assert.deepEqual(s.tower.blocks, [[0, 0, 0, 1]]);
  assert.equal(s.tower.best, TOWER.TOP + 1);
});

test('타워 블록 위로 점프해서 올라간다 (한 칸 = 2, 점프 높이 2.45)', () => {
  const boxes = [makeBox({ x: 0, y: -0.5, z: 0, w: 20, h: 1, d: 20 }), makeBox({ x: 0, y: 1, z: 3, w: 2, h: 2, d: 2 })];
  const pl = newPlayer(0, 0, 0);
  run(pl, boxes, 1.5, t => ({ mx: 0, mz: pl.z < 3 ? 1 : 0, jump: t > 0.05 && t < 0.1 }));
  assert.ok(Math.abs(pl.y - 2) < 1e-6, `y=${pl.y}`);
});

test('타이쿤 돈 주기: 정수 금액만, 반은 내림', () => {
  assert.ok(validGift({ amt: 1000, n: 5 }));
  for (const bad of [{ amt: 0, n: 1 }, { amt: -5, n: 1 }, { amt: 1.5, n: 1 }, { amt: '100', n: 1 }, { amt: GIFT_MAX + 1, n: 1 }, { amt: 100 }, null]) assert.ok(!validGift(bad), JSON.stringify(bad));
  assert.equal(halfOf(1001), 500);
  assert.equal(halfOf(0), 0);
});

test('머리카락: 공짜 머리는 늘 가지고, 안 산 머리는 못 쓰고, 예전 6칸 옷 배열도 읽힌다', () => {
  const s = cleanSave({ look: { hair: 9 }, owned: { hair: [] } });
  assert.ok(FREE_HAIRS.every(i => s.owned.hair.includes(i)));
  assert.equal(s.look.hair, DEFAULT_LOOK.hair);
  const bought = cleanSave({ coins: 100, look: { hair: 9, hairColor: 4 }, owned: { hair: [9] } });
  assert.equal(bought.look.hair, 9);
  assert.equal(HAIRS[9].id, 'curly');
  assert.equal(bought.look.hairColor, 4);
  const old = lookFromArray([1, 5, 15, 1, 0, 1]);
  assert.equal(old.hair, DEFAULT_LOOK.hair);
  assert.equal(lookToArray(DEFAULT_LOOK).length, 8);
});

test('배틀: 방패가 먼저 줄고, 체력은 0 아래로 안 간다', () => {
  assert.deepEqual(applyDamage({ hp: 100, armor: 0 }, 30), { hp: 70, armor: 0 });
  const a = applyDamage({ hp: 100, armor: 50 }, 20);
  assert.ok(Math.abs(a.armor - 36) < 1e-9 && Math.abs(a.hp - 94) < 1e-9);
  assert.equal(applyDamage({ hp: 10, armor: 0 }, 70).hp, 0);
  assert.ok(WEAPONS.every(w => w.dmg > 0 && w.rate > 0 && w.range > 0));
});

test('배틀: 안전 구역은 점점 작아지고 다음 원은 앞 원 안에 있다', () => {
  const ph = zonePhases(42);
  assert.equal(ph.length, 6);
  for (const p of ph) {
    assert.ok(p.to.r < p.from.r);
    assert.ok(Math.hypot(p.to.x - p.from.x, p.to.z - p.from.z) + p.to.r <= p.from.r + 1e-6);
  }
  const z0 = zoneAt(ph, 0), mid = zoneAt(ph, (ph[0].start + ph[0].end) / 2), last = zoneAt(ph, 1e6);
  assert.equal(z0.r, BATTLE.R0);
  assert.ok(mid.r < z0.r && mid.r > ph[0].to.r && mid.shrinking);
  assert.equal(last.r, 0);
  assert.ok(outsideZone(z0, BATTLE.R0 + 10, 0) && !outsideZone(z0, 0, 0));
});

test('배틀: 광선이 몸에 맞는다, 코인 계산', () => {
  assert.ok(Math.abs(rayBody(0, 1, -10, 0, 0, 1, 0, 0, 0) - 9.5) < 1e-9);
  assert.equal(rayBody(0, 1, -10, 0, 0, 1, 5, 0, 0), Infinity);
  assert.equal(battleCoins(1, 3), 15 + 24 + 30);
  assert.equal(battleCoins(12, 0), 2);
});

test('배틀: 탄창과 재장전, 총알 상자', () => {
  assert.deepEqual(freshAmmo('rifle'), { mag: 30, res: 60 });
  assert.deepEqual(reloadAmmo({ mag: 4, res: 60 }, 'rifle'), { mag: 30, res: 34 });
  assert.deepEqual(reloadAmmo({ mag: 0, res: 10 }, 'rifle'), { mag: 10, res: 0 });
  assert.deepEqual(reloadAmmo({ mag: 0, res: Infinity }, 'pistol'), { mag: 12, res: Infinity });
  assert.equal(ammoBox('pistol'), 0);
  assert.equal(ammoBox('shotgun'), 9);
  assert.ok(WEAPONS.every(w => w.mag > 0 && w.reload > 0));
});
