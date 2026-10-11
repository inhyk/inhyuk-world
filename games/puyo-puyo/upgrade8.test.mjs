// 인혁이 기획서 「뿌요뿌요 (업그레이드)」(2026-10-11) 3번 직접 놓아 보는 배우기의 규칙:
// "예를 들어 파랑뿌요랑 빨강 뿌요 등을 놓아 연쇄할 수 있게 놓고 실행하면 하나씩 터지며 연쇄가 되면서 배우는 거야!"
// 놓는 동안에는 터지지 않고(hold), 실행(fire)하면 그때 연쇄가 시작된다. 꽉 차도 지지 않는다(sandbox).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Player, parseField, fieldRows, idx, SPAWN_X, SPAWN_Y, TIMING } from './core.mjs';
import { Match } from './match.mjs';
import { computeLayout } from './render.mjs';

const seqOf = (...pairs) => ({ seed: 0, colors: 4, palette: [1, 2, 3, 4], puyos: pairs.flat() });
function run(p, until, max = 4000, input = {}, ctx = {}) {
  for (let i = 0; i < max; i++) {
    if (until(p)) return i;
    p.step(typeof input === 'function' ? input(p) : input, ctx);
  }
  throw new Error(`시간 초과: ${p.state}`);
}
const events = (p, type) => p.events.filter(e => e.type === type);
// 손에 든 짝을 고른 색으로 바꿔 x 번째 줄에 세워서 떨어뜨린다 (화면에서 색을 고르는 것과 같다)
function place(p, x, bottom, top) {
  run(p, q => q.state === 'control');
  p.piece.a = bottom; p.piece.c = top; p.piece.x = x;
  p.step({ drop: true });
  run(p, q => q.state === 'control' || q.state === 'full');
}
function lab() {
  const p = new Player({ seq: seqOf([1, 1], [2, 2]), timing: { popFrames: 58, chainPause: 26 } });
  p.sandbox = true; p.hold = true;
  p.start();
  return p;
}
const R = 1, G = 2, B = 3;

test('놓는 동안에는 같은 색이 4개 넘게 붙어도 터지지 않는다', () => {
  const p = lab();
  place(p, 0, R, R); place(p, 0, R, R); place(p, 1, R, R);
  assert.deepEqual(fieldRows(p.cells, 3), ['R.....', 'R.....', 'RR....', 'RR....']);
  assert.equal(events(p, 'pop').length, 0);
  assert.equal(events(p, 'chainEnd').length, 0);
  assert.equal(p.hold, true);
  assert.equal(p.score > 0, true); // 떨어뜨린 점수는 그대로
});

test('실행하면 그때 터진다: 빨강이 터지고 떨어진 파랑이 붙어서 2연쇄, 끝나면 다시 잡아 둔다', () => {
  const p = lab();
  // 맨 왼쪽 줄에 아래부터 파랑 파랑 / 파랑 빨강 / 빨강 빨강 / 빨강 파랑
  for (const [bottom, top] of [[B, B], [B, R], [R, R], [R, B]]) place(p, 0, bottom, top);
  assert.deepEqual(fieldRows(p.cells, 7).map(r => r[0]).join(''), 'BRRRRBBB');
  assert.equal(p.fire(), true);
  assert.equal(p.piece, null); // 손에 든 짝은 내려놓지 않고 치운다
  assert.equal(p.hold, false); assert.equal(p.fired, true);
  const frames = run(p, q => events(q, 'fireEnd').length > 0);
  assert.deepEqual(events(p, 'pop').map(e => [e.chain, e.colors, e.puyos]), [[1, [R], 4], [2, [B], 4]]);
  assert.deepEqual(events(p, 'fireEnd'), [{ type: 'fireEnd', chain: 2 }]);
  assert.deepEqual(events(p, 'chainEnd').map(e => e.chain), [2]);
  assert.equal(p.cells.some(Boolean), false);
  assert.equal(p.hold, true); assert.equal(p.fired, false);
  // 하나씩 터지는 것이 보이게 천천히: 한 번 터지는 데 58프레임, 다음 연쇄까지 26프레임을 더 쉰다
  assert.ok(frames >= 58 * 2 + 26, `${frames}프레임`);
  assert.ok(TIMING.popFrames < 58 && TIMING.chainPause < 26);
  // 그 뒤에 다시 놓는 것도 터지지 않는다
  p.events.length = 0;
  for (let i = 0; i < 2; i++) place(p, 4, G, G);
  assert.equal(events(p, 'pop').length, 0);
  assert.deepEqual(fieldRows(p.cells, 3).map(r => r[4]).join(''), 'GGGG');
});

test('터질 것이 없을 때 실행하면 0연쇄로 끝나고 필드는 그대로', () => {
  const p = lab();
  place(p, 0, R, G); place(p, 1, B, R);
  const before = p.cells.slice();
  assert.equal(p.fire(), true);
  run(p, q => events(q, 'fireEnd').length > 0);
  assert.deepEqual(events(p, 'fireEnd'), [{ type: 'fireEnd', chain: 0 }]);
  assert.deepEqual(p.cells, before);
  assert.equal(events(p, 'pop').length, 0);
  assert.equal(p.hold, true);
  run(p, q => q.state === 'control'); // 새 짝이 나온다
});

test('실행은 짝을 들고 있을 때(또는 꽉 찼을 때)만 된다', () => {
  const p = lab();
  assert.equal(p.fire(), false); // 아직 짝이 나오기 전
  run(p, q => q.state === 'control');
  p.piece.x = 0; p.step({ drop: true }); // 떨어지는 중
  assert.notEqual(p.state, 'control');
  assert.equal(p.fire(), false);
  run(p, q => q.state === 'control');
  assert.equal(p.fire(), true);
  assert.equal(p.fire(), false); // 터지는 중에 또 누름
});

test('필드가 꽉 차도 지지 않고 기다린다. 그대로 실행하면 터지고 다시 놓을 수 있다', () => {
  const p = lab();
  // 뿌요가 나오는 셋째 줄을 꼭대기까지 채운다 (같은 색 4개가 이어지지 않게 두 색을 번갈아)
  for (let i = 0; i < 6; i++) place(p, SPAWN_X, i % 2 ? G : R, i % 2 ? G : R);
  assert.equal(p.state, 'full');
  assert.equal(p.dead, false);
  assert.equal(events(p, 'dead').length, 0);
  assert.equal(events(p, 'full').length, 1);
  assert.notEqual(p.cells[idx(SPAWN_X, SPAWN_Y)], 0);
  for (let i = 0; i < 30; i++) p.step({ drop: true, left: true }); // 기다리는 동안에는 아무것도 움직이지 않는다
  assert.equal(p.state, 'full');
  // 보통 판(sandbox 가 아님)에서는 예전처럼 진다
  const normal = new Player({ seq: seqOf([1, 2]) });
  normal.cells.set(p.cells); normal.refreshHeights(); normal.start();
  run(normal, q => q.dead);
  assert.equal(events(normal, 'dead').length, 1);
  // 꽉 찬 채로 실행: 터질 것이 없으면 그대로 꽉 차 있다
  assert.equal(p.fire(), true);
  run(p, q => events(q, 'fireEnd').length > 0);
  run(p, q => q.state === 'full' || q.state === 'control');
  assert.equal(p.state, 'full');
});

test('보통 판은 그대로: hold 가 아니면 놓자마자 터진다', () => {
  const p = new Player({ seq: seqOf([1, 1], [1, 1], [2, 2]) });
  p.start();
  for (let i = 0; i < 2; i++) { run(p, q => q.state === 'control'); p.piece.x = 0; p.step({ drop: true }); }
  run(p, q => q.state === 'control');
  assert.equal(events(p, 'pop').length, 1);
  assert.equal(events(p, 'fireEnd').length, 0);
  assert.equal(p.cells.some(Boolean), false);
});

test('직접 놓아 보는 배우기는 많이 놓아도 떨어지는 속도가 빨라지지 않는다', () => {
  const steady = new Match({ specs: [{ kind: 'human' }], solo: true, gravityScale: 0.6, steady: true });
  const endless = new Match({ specs: [{ kind: 'human' }], solo: true, gravityScale: 0.6 });
  const base = steady.gravity();
  assert.equal(endless.gravity(), base);
  steady.players[0].stats.pieces = 200; endless.players[0].stats.pieces = 200;
  assert.equal(steady.gravity(), base);
  assert.ok(endless.gravity() > base * 2);
});

test('필드 옆 칸(놓을 뿌요, 단추)이 들어갈 자리: 혼자 하는 배치의 오른쪽 3.9칸이 화면 안에 있다', () => {
  for (const [w, h, top, bottom] of [[1280, 720, 150, 8], [390, 844, 140, 104], [844, 390, 110, 6], [768, 1024, 150, 104]]) {
    const l = computeLayout(w, h, { solo: true, insets: { top, bottom, left: 8, right: 8 } });
    const f = l.fields[0], c = f.cell;
    assert.ok(f.x + c * 6.4 + c * 3.9 <= w - 4, `${w}x${h} 오른쪽`);
    assert.ok(f.y - c * 0.3 >= top - c, `${w}x${h} 위`);
  }
});

test('parseField 로 만든 모양도 실행하면 연쇄 수가 맞다 (3연쇄 계단)', () => {
  const p = lab();
  run(p, q => q.state === 'control');
  p.cells.set(parseField(['GB....', 'RGB...', 'RGB...', 'RRGB..']));
  p.refreshHeights();
  assert.equal(p.fire(), true);
  run(p, q => events(q, 'fireEnd').length > 0);
  assert.deepEqual(events(p, 'fireEnd'), [{ type: 'fireEnd', chain: 3 }]);
  assert.deepEqual(events(p, 'pop').map(e => e.chain), [1, 2, 3]);
  assert.equal(events(p, 'allClear').length, 1);
});
