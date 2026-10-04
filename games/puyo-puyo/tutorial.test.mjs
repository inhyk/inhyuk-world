import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS, lessonCells, lessonSeq, newJudge, judge } from './tutorial.mjs';
import { resolveChain, makeSequence, pairAt, W } from './core.mjs';
import { newProgress, sanitize } from './profile.mjs';

const lesson = id => LESSONS.find(l => l.id === id);
// (x, y)에 색 c를 놓은 새 필드 (y=0이 바닥)
function place(cells, puts) { const out = cells.slice(); for (const [x, y, c] of puts) out[y * W + x] = c; return out; }

test('연습 2: 빨강 짝을 옆에 붙여도, 위에 쌓아도 4개가 이어져 터진다', () => {
  const cells = lessonCells(lesson('pop'));
  assert.equal(resolveChain(cells.slice()).chain, 0); // 처음에는 아무것도 안 터진다
  assert.equal(resolveChain(place(cells, [[2, 0, 1], [3, 0, 1]])).chain, 1); // 가로로 옆에
  assert.equal(resolveChain(place(cells, [[2, 0, 1], [2, 1, 1]])).chain, 1); // 그냥 바로 떨어뜨리기(3번째 줄 세로)
  assert.equal(resolveChain(place(cells, [[5, 0, 1], [5, 1, 1]])).chain, 0); // 멀리 놓으면 안 터진다
});

test('연습 3: 빨강을 맨 왼쪽 줄에 세로로도, 가로로도 놓으면 2연쇄', () => {
  const cells = lessonCells(lesson('chain'));
  assert.equal(resolveChain(cells.slice()).chain, 0);
  assert.equal(resolveChain(place(cells, [[0, 1, 1], [0, 2, 1]])).chain, 2); // 세로로 맨 왼쪽
  assert.equal(resolveChain(place(cells, [[0, 1, 1], [1, 3, 1]])).chain, 2); // 가로 짝이 갈라져 왼쪽 두 줄에
  assert.equal(resolveChain(place(cells, [[4, 0, 1], [4, 1, 1]])).chain, 0);
});

test('연습 짝 순서는 정해 둔 대로 되풀이된다', () => {
  const seq = lessonSeq(lesson('chain'), makeSequence(5));
  assert.deepEqual(pairAt(seq, 0), [1, 1]);
  assert.deepEqual(pairAt(seq, 3), [1, 1]);
  const moveSeq = lessonSeq(lesson('move'), makeSequence(5));
  assert.deepEqual([0, 1, 2, 3, 4].map(n => pairAt(moveSeq, n)), [[1, 2], [3, 3], [4, 1], [2, 3], [1, 2]]);
});

test('연습 판정: 3번 내려놓기 / 터뜨리기 / 2연쇄, 두 번 놓치면 다시', () => {
  let s = newJudge();
  assert.equal(judge(lesson('move'), s, { type: 'lock' }), null);
  assert.equal(judge(lesson('move'), s, { type: 'spawn' }), null);
  assert.equal(judge(lesson('move'), s, { type: 'lock' }), null);
  assert.equal(judge(lesson('move'), s, { type: 'lock' }), 'done');

  s = newJudge();
  assert.equal(judge(lesson('pop'), s, { type: 'spawn' }), null); // 첫 짝이 나올 때는 놓친 게 아니다
  assert.equal(judge(lesson('pop'), s, { type: 'lock' }), null);
  assert.equal(judge(lesson('pop'), s, { type: 'spawn' }), null); // 한 번 놓침
  assert.equal(judge(lesson('pop'), s, { type: 'lock' }), null);
  assert.equal(judge(lesson('pop'), s, { type: 'chainEnd', chain: 1 }), 'done'); // 두 번째에 터뜨림

  s = newJudge();
  judge(lesson('pop'), s, { type: 'lock' }); judge(lesson('pop'), s, { type: 'spawn' });
  judge(lesson('pop'), s, { type: 'lock' });
  assert.equal(judge(lesson('pop'), s, { type: 'spawn' }), 'retry'); // 두 번 놓치면 처음부터

  s = newJudge();
  judge(lesson('chain'), s, { type: 'lock' });
  assert.equal(judge(lesson('chain'), s, { type: 'chainEnd', chain: 1 }), 'retry'); // 한 번만 터지면 아깝다
  s = newJudge();
  judge(lesson('chain'), s, { type: 'lock' });
  assert.equal(judge(lesson('chain'), s, { type: 'chainEnd', chain: 2 }), 'done');
});

test('연습을 끝냈는지는 저장되고, 이상한 값은 끝내지 않은 것으로', () => {
  assert.equal(newProgress().tutorial, false);
  assert.equal(sanitize({ tutorial: true }).tutorial, true);
  assert.equal(sanitize({ tutorial: 'yes' }).tutorial, false);
  assert.equal(sanitize({}).tutorial, false);
});
