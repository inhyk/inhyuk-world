import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from '../../public/play/chess/vendor/chess.mjs';
import { perft, chooseMove, Position } from '../../public/play/chess/fast-engine.mjs';
import { BOTS } from '../../public/play/chess/bots.mjs';
import { expected, nextRating, loadRatings, saveRatings, applyResult, recordRush, START } from '../../public/play/chess/rating.mjs';
import { RushRun, targetRating, STRIKES } from '../../public/play/chess/rush.mjs';
import { indexForRating, parseRecord } from '../../public/play/chess/puzzle-bank.mjs';
import { positionKey } from '../../public/play/chess/board.mjs';

const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const seeded = seed => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

test('fast engine move generation matches known perft counts', () => {
  assert.equal(perft('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 3), 8902);
  assert.equal(perft('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 2), 2039);
  assert.equal(perft('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', 3), 2812);
  assert.equal(perft('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', 2), 264);
  assert.equal(perft('rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', 2), 1486);
});

test('fast engine position key matches chess.js FEN for repetition checks', () => {
  const g = new Chess();
  for (const m of ['e4', 'c5', 'e5', 'd5']) g.move(m);
  assert.equal(new Position(g.fen()).key(), positionKey(g.fen()));
});

test('fast engine finds mate in one and wins a hanging queen', () => {
  assert.equal(chooseMove('6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1', { depth: 3 }).uci, 'e1e8');
  assert.equal(chooseMove('7k/8/8/8/8/8/q7/R6K w - - 0 1', { depth: 3 }).uci, 'a1a2');
  assert.equal(chooseMove('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3', { depth: 2 }), null);
});

test('fast engine avoids repeating a position when it is winning', () => {
  const fen = '6k1/5ppp/8/8/8/8/5PPP/3QR1K1 w - - 0 1';
  const pick = chooseMove(fen, { depth: 3 });
  assert.ok(pick.uci);
  const after = new Chess(fen); after.move({ from: pick.uci.slice(0, 2), to: pick.uci.slice(2, 4) });
  const again = chooseMove(fen, { depth: 3, history: [positionKey(after.fen())] });
  assert.ok(again.uci);
});

test('every character always plays a legal move', () => {
  const g = new Chess();
  for (const m of ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']) g.move(m);
  for (const bot of BOTS) {
    const pick = chooseMove(g.fen(), { ...bot.engine, timeMs: 300, rng: seeded(7) });
    const legal = g.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));
    assert.ok(legal.includes(pick.uci), `${bot.name} played ${pick.uci}`);
  }
  assert.equal(new Set(BOTS.map(b => b.id)).size, BOTS.length);
  assert.deepEqual(BOTS.map(b => b.rating), [...BOTS.map(b => b.rating)].sort((a, b) => a - b));
});

test('elo ratings move toward the result and stay in range', () => {
  assert.equal(expected(800, 800), 0.5);
  assert.equal(nextRating(800, 800, 1, 0), 820);
  assert.equal(nextRating(800, 800, 0, 50), 790);
  assert.ok(nextRating(800, 2000, 1, 0) > 835);
  assert.equal(nextRating(100, 3000, 0, 0), 100);
  const store = memory(), r = loadRatings(store);
  assert.equal(r.bot.r, START);
  const change = applyResult(r, 'bot', 1100, 1);
  assert.ok(change.delta > 20);
  assert.equal(r.bot.games, 1);
  assert.ok(recordRush(r, '180', 12));
  assert.ok(!recordRush(r, '180', 9));
  saveRatings(r, store);
  const back = loadRatings(store);
  assert.equal(back.bot.r, r.bot.r);
  assert.equal(back.rush[180], 12);
  store.setItem('green-chess-ratings-v1', '{"bot":{"r":"lots","games":-1},"rush":{"180":99999}}');
  assert.equal(loadRatings(store).bot.r, START);
  assert.equal(loadRatings(store).rush[180], 0);
});

test('puzzle rush gets harder, ends at three strikes or when time runs out', () => {
  assert.ok(targetRating(0) < targetRating(10) && targetRating(10) < targetRating(30));
  assert.ok(targetRating(500) <= 2900);
  const run = new RushRun('180', 0);
  run.record({ rating: 600, id: 'a' }, true, 1000);
  for (let i = 0; i < STRIKES; i++) run.record({ rating: 700, id: `x${i}` }, false, 2000);
  assert.equal(run.score, 1);
  assert.ok(run.over);
  assert.equal(run.reason, 'strikes');
  const timed = new RushRun('180', 0);
  assert.ok(!timed.check(179000));
  assert.ok(timed.check(180001));
  assert.equal(timed.reason, 'time');
  assert.equal(timed.record({ rating: 600, id: 'late' }, true, 181000), false);
  const survival = new RushRun('survival', 0);
  assert.equal(survival.timeLeft(1e9), Infinity);
});

test('puzzle index follows rating bands and records turn into playable puzzles', () => {
  const bands = [{ min: 500, max: 700, count: 1000 }, { min: 700, max: 900, count: 1000 }, { min: 900, max: 1100, count: 1000 }];
  const mid = () => 0.5;
  assert.ok(indexForRating(bands, 500, mid) < 1000);
  assert.ok(indexForRating(bands, 800, mid) >= 1000 && indexForRating(bands, 800, mid) < 2000);
  assert.ok(indexForRating(bands, 5000, mid) <= 2999);
  assert.ok(indexForRating(bands, 0, () => 0) >= 0);
  const p = parseRecord(['1S1TJ', '5Qk1/1p1r2bp/pq2p1pB/8/3p4/P6P/1P4P1/5R1K b - - 3 34', 'g7f8 f1f8', 500, 'endgame mate mateIn1 oneMove', '']);
  assert.equal(p.goal, 'mate');
  assert.deepEqual(p.line, ['Rxf8#']);
  assert.equal(new Chess(p.fen).turn(), 'w');
});
