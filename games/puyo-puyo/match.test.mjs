import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from './match.mjs';
import { rng, parseField, W, H } from './core.mjs';
import { think, AI_LEVELS, potential, moves, reachable } from './ai.mjs';

function runUntil(m, pred, max = 60 * 60 * 6, inputs = () => []) {
  for (let i = 0; i < max; i++) {
    if (pred(m)) return i;
    m.step(inputs(m));
  }
  throw new Error('시간 초과');
}

test('대전 시작: 준비 → 3 → 2 → 1 → 시작, 두 사람이 같은 순서', () => {
  const m = new Match({ seed: 5, specs: [{ kind: 'human' }, { kind: 'human' }] });
  const counts = [];
  runUntil(m, x => x.phase === 'play', 400, () => []);
  for (const e of m.events) if (e.type === 'count') counts.push(e.n);
  assert.deepEqual(counts, [3, 2, 1]);
  assert.ok(m.events.some(e => e.type === 'go'));
  assert.deepEqual(m.players[0].next, m.players[1].next);
});

test('연쇄로 만든 방해뿌요는 상대에게 가고, 상대 연쇄가 끝나야 떨어진다', () => {
  const m = new Match({ seed: 9, specs: [{ kind: 'human' }, { kind: 'human' }] });
  runUntil(m, x => x.phase === 'play', 400);
  runUntil(m, x => x.players[0].state === 'control', 50);
  // 1P 필드에 불붙은 3연쇄 계단을 깔고 짝을 옆에 떨어뜨린다
  m.players[0].cells.set(parseField(['GB....', 'RGB...', 'RGB...', 'RRGB..']));
  m.players[0].refreshHeights();
  m.step([{ right: true }, {}]); m.step([{ right: true }, {}]); m.step([{ right: true }, {}]);
  m.step([{ drop: true }, {}]);
  runUntil(m, x => x.players[0].chaining, 200);
  runUntil(m, x => x.players[1].incoming > 0, 400);
  assert.equal(m.players[1].incoming > 0, true);
  // 1P가 연쇄 중인 동안 2P가 짝을 놓아도 방해뿌요가 떨어지지 않는다
  m.step([{}, { drop: true }]);
  runUntil(m, x => x.players[1].state === 'control' || !x.players[0].chaining, 200);
  if (m.players[0].chaining) assert.ok(m.players[1].incoming > 0);
  runUntil(m, x => !x.players[0].chaining, 400);
  const pending = m.players[1].incoming;
  assert.ok(pending >= 14);
  runUntil(m, x => x.players[1].state === 'control', 200);
  m.step([{}, { drop: true }]);
  runUntil(m, x => x.events.some(e => e.p === 1 && e.type === 'garbage'), 300);
  assert.equal(m.players[1].incoming, Math.max(0, pending - 30));
});

test('누가 먼저 쓰러지면 상대가 1승, 선취를 채우면 끝', () => {
  const m = new Match({ seed: 3, specs: [{ kind: 'human' }, { kind: 'human' }], firstTo: 2 });
  for (let round = 1; round <= 2; round++) {
    runUntil(m, x => x.phase === 'play', 400);
    for (let y = 0; y < 12; y++) m.players[1].cells[y * W + 2] = 6;
    runUntil(m, x => x.phase !== 'play', 400, () => [{}, { drop: true }]);
    assert.deepEqual(m.wins, [round, 0]);
    assert.equal(m.winner(), 0);
    runUntil(m, x => x.phase === 'countdown' || x.over, 400);
  }
  assert.equal(m.over, true);
  assert.ok(m.totals(0).pieces >= 0);
});

test('온라인 손님은 스스로 판정하지 않고 방장의 결과를 따른다', () => {
  const remote = { cells: new Uint8Array(W * H), h: new Int8Array(W), dead: false, state: 'control', score: 0, incoming: 0, stats: {}, events: [], chaining: false, next: [[1, 1], [1, 1]] };
  const g = new Match({ seed: 4, online: 'guest', specs: [{ kind: 'human' }, { kind: 'remote' }], firstTo: 2, makeRemote: () => remote });
  runUntil(g, x => x.phase === 'play', 400);
  for (let y = 0; y < 12; y++) g.players[0].cells[y * W + 2] = 6;
  runUntil(g, x => x.events.some(e => e.type === 'waitResult'), 400, () => [{ drop: true }]);
  assert.equal(g.phase, 'play');
  g.applyResult(1, [0, 1], false);
  assert.equal(g.phase, 'roundEnd');
  assert.deepEqual(g.wins, [0, 1]);
  for (let i = 0; i < 400; i++) g.step();
  assert.equal(g.phase, 'roundEnd');   // 방장이 “다음”을 보낼 때까지 기다린다
  g.nextRound();
  assert.equal(g.round, 2);
  assert.equal(g.phase, 'countdown');
});

test('AI: 22가지 자리, 13단 열은 넘지 못함, 잠재 연쇄를 찾는다', () => {
  const h = new Int8Array(W);
  assert.equal(moves(h, 1, 2).length, 22);
  assert.equal(moves(h, 1, 1).length, 11);
  h[1] = 12;
  assert.deepEqual(reachable(h), [false, false, true, true, true, true]);
  // 빨강 하나만 더 놓으면 3연쇄가 터지는 필드
  const cells = parseField(['GB....', 'RGB...', 'RGB...', '.RGB..']);
  const hh = new Int8Array(W);
  for (let x = 0; x < W; x++) { let y = 0; while (y < H && cells[y * W + x]) y++; hh[x] = y; }
  const pot = potential(cells, hh, [1, 2, 3, 4]);
  assert.ok(pot.chain >= 2);
  const plan = think({ cells, pairs: [[1, 1], [2, 3], [4, 4]], palette: [1, 2, 3, 4], incoming: 0 }, { ...AI_LEVELS[6], fire: 2 }, rng(1));
  assert.ok(plan.chain >= 2, JSON.stringify(plan));
});

test('타워 AI는 층이 높을수록 세다 (5층이 1층을 이긴다)', () => {
  let high = 0;
  for (let g = 0; g < 3; g++) {
    const m = new Match({ seed: 100 + g, specs: [{ kind: 'ai', level: 1 }, { kind: 'ai', level: 5 }], random: rng(7 + g) });
    runUntil(m, x => x.over, 60 * 60 * 8);
    if (m.winner() === 1) high++;
  }
  assert.equal(high, 3);
});
