import test from 'node:test';
import assert from 'node:assert/strict';
import {
  W, H, idx, parseField, fieldRows, findGroups, stepScore, resolveChain, garbageIcons, targetPoints,
  makeSequence, pairAt, Player, GARBAGE, SPAWN_X, SPAWN_Y, MARGIN_FRAMES, MARGIN_STEP, heights,
} from './core.mjs';

const seqOf = (...pairs) => ({ seed: 0, colors: 4, palette: [1, 2, 3, 4], puyos: pairs.flat() });
function run(p, until, max = 3000, input = {}, ctx = {}) {
  for (let i = 0; i < max; i++) {
    if (until(p)) return i;
    p.step(typeof input === 'function' ? input(p) : input, ctx);
  }
  throw new Error(`시간 초과: ${p.state}`);
}
const events = (p, type) => p.events.filter(e => e.type === type);

test('통 점수 공식: 4개 40점, 2연쇄 360점, 연결·색 보너스', () => {
  let cells = parseField(['RRRR..']);
  assert.equal(stepScore(1, findGroups(cells), cells).score, 40);
  cells = parseField(['RRRRR.']);
  assert.equal(stepScore(1, findGroups(cells), cells).score, 10 * 5 * 2);
  cells = parseField(['RRRRGG', '....GG']);
  assert.equal(stepScore(1, findGroups(cells), cells).score, 10 * 8 * 3);
  // 빨강 4개가 터지면 초록이 떨어져 이어진다 → 2연쇄
  cells = parseField(['G.....', 'R.....', 'R.....', 'RGGG..', 'R.....']);
  const r = resolveChain(cells);
  assert.equal(r.chain, 2);
  assert.equal(r.score, 40 + 320);
});

test('3연쇄 계단: 40 + 320 + 640 = 1000점, 방해 뿌요 14개', () => {
  const cells = parseField([
    'GB....',
    'RGB...',
    'RGB...',
    'RRGB..',
  ]);
  const r = resolveChain(cells);
  assert.equal(r.chain, 3);
  assert.equal(r.score, 1000);
  assert.equal(r.garbage, 14);
  assert.equal(r.allClear, true);
});

test('방해 뿌요는 터지는 뿌요 옆에서만 사라지고 13번째 줄은 터지지 않는다', () => {
  const cells = parseField(['O.....', 'O.....', 'RRRR.O']);
  resolveChain(cells);
  assert.deepEqual(fieldRows(cells, 1), ['......', 'O....O']);
  const hidden = new Uint8Array(W * H);
  for (let y = 9; y <= 12; y++) hidden[idx(0, y)] = 1;   // 10~13번째 줄: 13번째 줄 뿌요는 세지 않는다
  for (let y = 0; y < 9; y++) hidden[idx(0, y)] = 2 + (y % 2);
  assert.equal(findGroups(hidden).length, 0);
});

test('방해 뿌요 예고 아이콘은 작은·큰·운석·별·달·왕관 순서로 커진다', () => {
  assert.deepEqual(garbageIcons(0), []);
  assert.deepEqual(garbageIcons(45), ['rock', 'big', 'big', 'small', 'small', 'small']);
  assert.deepEqual(garbageIcons(720 + 360 + 180 + 30 + 6 + 1), ['crown', 'moon', 'star', 'rock', 'big', 'small']);
  assert.equal(garbageIcons(10000).length, 6);
});

test('마진 타임이 지나면 목표 점수가 줄어든다', () => {
  assert.equal(targetPoints(0), 70);
  assert.equal(targetPoints(MARGIN_FRAMES - 1), 70);
  assert.equal(targetPoints(MARGIN_FRAMES), 52);
  assert.equal(targetPoints(MARGIN_FRAMES + MARGIN_STEP), 39);
  assert.equal(targetPoints(MARGIN_FRAMES + MARGIN_STEP * 40), 1);
});

test('뿌요 순서: 같은 씨앗이면 같고, 첫 두 짝은 3색 이하, 색은 고르게', () => {
  for (let seed = 1; seed < 40; seed++) {
    const a = makeSequence(seed), b = makeSequence(seed);
    assert.deepEqual(a.puyos, b.puyos);
    assert.ok(new Set(a.puyos.slice(0, 4)).size <= 3);
    const count = new Map();
    for (const c of a.puyos.slice(4)) count.set(c, (count.get(c) || 0) + 1);
    assert.equal(count.size, 4);
    for (const n of count.values()) assert.ok(n >= 58 && n <= 64);
  }
  const s = makeSequence(5);
  assert.deepEqual(pairAt(s, 128), pairAt(s, 0));
});

test('벽 차기: 오른쪽 벽에서 돌리면 한 칸 밀려난다', () => {
  const p = new Player({ seq: seqOf([1, 2], [3, 4], [1, 1]) });
  p.start();
  run(p, q => q.state === 'control');
  for (let i = 0; i < 4; i++) p.step({ right: true });
  assert.equal(p.piece.x, 5);
  p.step({ rotR: true });
  assert.equal(p.piece.rot, 1);
  assert.equal(p.piece.x, 4);
  p.step({ rotL: true }); p.step({ rotL: true });
  assert.equal(p.piece.rot, 3);
  assert.equal(p.piece.x, 4);
});

test('좁은 틈에서 두 번 돌리면 위아래가 뒤집힌다 (퀵턴)', () => {
  const p = new Player({ seq: seqOf([1, 2], [3, 4]) });
  p.cells = parseField(['OO.OOO', 'OO.OOO', 'OO.OOO', 'OO.OOO']);
  p.start();
  run(p, q => q.state === 'control');
  run(p, q => q.piece.y <= 2.5, 400);
  const before = [p.piece.a, p.piece.c, p.piece.y];
  p.step({ rotR: true });
  assert.equal(p.piece.rot, 0);
  p.step({ rotR: true });
  assert.equal(p.piece.rot, 2);
  assert.ok(Math.abs(p.piece.y - (before[2] + 1)) < 0.2);
  assert.ok(events(p, 'rotate').some(e => e.quick));
});

test('바닥 차기: 바닥에서 아래로 돌리면 한 칸 올라간다', () => {
  const p = new Player({ seq: seqOf([1, 2], [3, 4]) });
  p.start();
  run(p, q => q.state === 'control');
  run(p, q => q.piece.y === 0, 800);
  p.step({ rotR: true }); p.step({ rotR: true });
  assert.equal(p.piece.rot, 2);
  assert.equal(p.piece.y, 1);
});

test('놓고, 흩어지고, 14번째 줄에 놓인 뿌요는 사라진다', () => {
  const p = new Player({ seq: seqOf([1, 2], [3, 4], [1, 2]) });
  p.cells = parseField(['.O....', '.O....', '.O....', '.O....', '.O....']);
  p.start();
  run(p, q => q.state === 'control');
  p.step({ rotL: true });            // 자식을 왼쪽(열 1)으로
  p.step({ drop: true });
  run(p, q => q.state === 'control' || q.state === 'spawn');
  // 축(열 2)은 바닥, 자식은 열 1의 방해뿌요 위
  assert.equal(p.cells[idx(2, 0)], 1);
  assert.equal(p.cells[idx(1, 5)], 2);

  const q = new Player({ seq: seqOf([1, 2], [3, 4]) });
  for (let y = 0; y < 13; y++) q.cells[idx(0, y)] = GARBAGE;   // 열 0이 13번째 줄까지 가득
  q.start();
  run(q, r => r.state === 'control');
  q.step({ left: true });
  q.step({ rotL: true });            // 자식이 열 1 → 열 0 위로 갈 수는 없다(막힘) → 축 밀기
  q.step({ drop: true });
  run(q, r => r.state === 'control' || r.state === 'spawn');
  assert.equal(heights(q.cells)[0], 13);
});

test('13번째 줄 위에 놓인 뿌요는 사라진다', () => {
  const q = new Player({ seq: seqOf([1, 2], [3, 4]) });
  for (let y = 0; y < 12; y++) q.cells[idx(1, y)] = y % 2 ? 3 : 4;
  q.cells[idx(1, 12)] = GARBAGE;   // 열 1이 13칸 가득
  q.start();
  run(q, r => r.state === 'control');
  q.piece.x = 1; q.piece.rot = 0; q.piece.y = 13;   // 억지로 올려 두고 굳힌다
  q.refreshHeights();
  q.lock();
  assert.ok(events(q, 'vanish').length >= 1);
  assert.equal(heights(q.cells)[1], 13);
});

test('방해 뿌요 8개: 한 줄 가득 + 서로 다른 두 열에 하나씩, 최대 30개씩', () => {
  const p = new Player({ seq: seqOf([1, 2], [3, 4]), seed: 9 });
  p.receive(38);
  p.start();
  run(p, q => q.state === 'control');
  p.step({ drop: true });
  run(p, q => q.state === 'control');
  assert.equal(p.incoming, 8);
  const garbage = [...p.cells].filter(v => v === GARBAGE).length;
  assert.equal(garbage, 30);
  p.step({ drop: true });
  run(p, q => q.state === 'control' || q.dead);
  const h = heights(p.cells);
  const count = [...p.cells].filter(v => v === GARBAGE).length;
  assert.equal(count, 38);
  // 두 번째 떨어짐(8개): 모든 열 +1, 두 열은 +2
  assert.ok(h.every(v => v >= 6));
});

test('3열 12번째 줄이 막히면 진다', () => {
  const p = new Player({ seq: seqOf([1, 2], [3, 4]) });
  for (let y = 0; y < 12; y++) p.cells[idx(SPAWN_X, y)] = GARBAGE;
  p.start();
  run(p, q => q.dead, 50);
  assert.equal(events(p, 'dead').length, 1);
  assert.equal(p.cells[idx(SPAWN_X, SPAWN_Y)], GARBAGE);
});

test('연쇄를 터뜨리면 점수·방해 뿌요·상쇄가 계산된다', () => {
  // 이미 불이 붙은 3연쇄 계단 옆(열 5)에 노랑 짝을 떨어뜨린다
  const p = new Player({ seq: seqOf([4, 4], [2, 2], [1, 1]) });
  p.cells = parseField(['GB....', 'RGB...', 'RGB...', 'RRGB..']);
  p.receive(4);
  p.start();
  run(p, q => q.state === 'control');
  for (let i = 0; i < 3; i++) p.step({ right: true });
  p.step({ drop: true });
  run(p, q => events(q, 'chainEnd').length > 0);
  const end = events(p, 'chainEnd')[0];
  assert.equal(end.chain, 3);
  assert.equal(p.stats.maxChain, 3);
  // 1000점 + 한 번에 내리기(1칸에 1점) → 방해뿌요 14개, 그중 4개는 상쇄
  const rows = events(p, 'drop')[0].rows;
  assert.ok(rows >= 10);
  assert.equal(p.score, 1000 + rows);
  assert.equal(end.made, 14);
  assert.equal(end.sent, 10);
  assert.equal(p.incoming, 0);
  assert.equal(events(p, 'offset')[0].amount, 4);
  assert.equal(end.allClear, false);
  assert.deepEqual(events(p, 'pop').map(e => e.chain), [1, 2, 3]);
});

test('전소하면 다음 연쇄에 2100점(방해 뿌요 30개)이 더해진다', () => {
  const p = new Player({ seq: seqOf([1, 1], [2, 2], [3, 3]) });
  p.cells = parseField(['RR....']);
  p.start();
  run(p, q => q.state === 'control');
  p.step({ rotR: true });
  p.step({ drop: true });
  run(p, q => events(q, 'chainEnd').length > 0);
  assert.equal(events(p, 'chainEnd')[0].allClear, true);
  assert.equal(p.allClearBonus, true);
  run(p, q => q.state === 'control');
  p.cells.set(parseField(['GG....']));
  p.refreshHeights();
  p.events = [];
  p.step({ rotR: true });
  p.step({ drop: true });
  run(p, q => events(q, 'chainEnd').length > 0);
  assert.equal(events(p, 'pop')[0].bonus, 2100);
  assert.ok(events(p, 'chainEnd')[0].made >= 30);
  // 이번에도 모두 지워서 전소가 두 번
  assert.equal(p.stats.allClears, 2);
});

test('상대가 연쇄 중이면 방해 뿌요가 떨어지지 않는다', () => {
  const p = new Player({ seq: seqOf([1, 2], [3, 4], [1, 2]) });
  p.receive(12);
  p.start();
  run(p, q => q.state === 'control');
  p.step({ drop: true });
  run(p, q => q.state === 'control', 500, {}, { canReceive: false });
  assert.equal(p.incoming, 12);
  p.step({ drop: true });
  run(p, q => q.state === 'control', 500, {}, { canReceive: true });
  assert.equal(p.incoming, 0);
});

test('아래 키를 누르면 빨리 떨어지고 1칸에 1점', () => {
  const p = new Player({ seq: seqOf([1, 2], [3, 4]) });
  p.start();
  run(p, q => q.state === 'control');
  const frames = run(p, q => q.state !== 'control', 200, { down: true });
  assert.ok(frames < 40);
  assert.equal(p.score, 11);
});
