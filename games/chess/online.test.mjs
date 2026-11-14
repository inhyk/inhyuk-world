import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMessage, OnlineMatch, serverFrom, QUICK, other } from '../../public/play/chess/online.mjs';
import { DEFAULT_SERVER } from '../../public/play/chess/net-client/index.mjs';

// 서버 없이 두 OnlineMatch 를 이어 주는 가짜 방
function pair({ kind = 'code' } = {}) {
  const log = [];
  const make = (id, host) => {
    const events = { start: [], move: [], end: [], offer: [], say: [], flag: 0 };
    const match = new OnlineMatch({
      start: e => events.start.push(e), move: e => events.move.push(e), end: e => events.end.push(e),
      offer: k => events.offer.push(k), say: k => events.say.push(k), flag: () => { events.flag++; },
    }, { kind, myRating: host ? 900 : 1200, time: 300 });
    const room = { id, host, peers: [], reports: [], send: msg => { log.push(msg); room.other?.receive(JSON.parse(JSON.stringify(msg))); return true; }, report: (n, won) => room.reports.push([n, won]), leave() {} };
    return { match, room, events };
  };
  const a = make('p1', true), b = make('p2', false);
  a.room.other = b.match; b.room.other = a.match;
  return { a, b, log };
}

test('messages from the other player are checked before use', () => {
  assert.deepEqual(parseMessage({ t: 'move', n: 1, ply: 0, m: 'e2e4', ms: 299000 }), { t: 'move', n: 1, ply: 0, m: 'e2e4', ms: 299000 });
  assert.deepEqual(parseMessage({ t: 'move', n: 1, ply: 6, m: 'a7a8q', ms: 1 }).m, 'a7a8q');
  assert.equal(parseMessage({ t: 'move', n: 1, ply: 0, m: 'e2e9', ms: 1 }), null);
  assert.equal(parseMessage({ t: 'move', n: 1, ply: 0, m: 'e2e4<script>', ms: 1 }), null);
  assert.equal(parseMessage({ t: 'start', n: 1, you: 'x', time: 600 }), null);
  assert.equal(parseMessage({ t: 'start', n: 1, you: 'b', time: 601 }), null);
  assert.equal(parseMessage({ t: 'say', k: QUICK.length }), null);
  assert.equal(parseMessage({ t: 'say', k: 2 }).k, 2);
  assert.equal(parseMessage({ chat: '안녕' }), null);
  assert.equal(parseMessage({ t: 'hello', r: 99999 }).r, null);
  assert.equal(parseMessage(null), null);
});

test('only a loopback server can replace the default server', () => {
  assert.equal(serverFrom('?net=http://127.0.0.1:8787'), 'http://127.0.0.1:8787');
  assert.equal(serverFrom('?net=https://evil.example.com'), DEFAULT_SERVER);
  assert.equal(serverFrom(''), DEFAULT_SERVER);
});

test('the host starts the game, colors are opposite, moves and quick messages arrive', () => {
  const { a, b } = pair();
  b.match.attach(b.room);
  a.match.attach(a.room);
  a.match.peerJoined('p2');
  assert.equal(a.events.start.length, 1);
  assert.equal(b.events.start.length, 1);
  assert.equal(b.events.start[0].color, other(a.events.start[0].color));
  assert.equal(b.events.start[0].time, 300);
  assert.equal(b.match.peerRating, 900);
  b.match.peerJoined('p1');
  assert.equal(a.match.peerRating, 1200);
  a.match.move('e2e4', 0, 299500);
  assert.deepEqual(b.events.move[0], { uci: 'e2e4', ply: 0, ms: 299500 });
  b.match.say(3);
  assert.deepEqual(a.events.say, [3]);
});

test('resign, draw offers and rematch swap colors; report only for matched rooms', () => {
  const { a, b } = pair({ kind: 'match' });
  b.match.attach(b.room); a.match.attach(a.room); a.match.peerJoined('p2'); b.match.peerJoined('p1');
  const first = a.match.color;
  b.match.offerDraw();
  assert.deepEqual(a.events.offer, ['draw']);
  a.match.answerDraw(false);
  assert.deepEqual(b.events.offer, ['draw-no']);
  b.match.resign();
  assert.deepEqual(a.events.end[0], { winner: a.match.color, reason: 'resign' });
  a.match.finished(a.match.color); b.match.finished(a.match.color);
  assert.deepEqual(a.room.reports, [[1, true]]);
  assert.deepEqual(b.room.reports, [[1, false]]);
  b.match.rematch();
  assert.equal(a.events.start.length, 1);
  a.match.rematch();
  assert.equal(a.events.start.length, 2);
  assert.equal(a.match.color, other(first));
  assert.equal(a.match.n, 2);
  assert.equal(b.match.n, 2);
  const friendly = pair({ kind: 'code' });
  friendly.a.match.attach(friendly.a.room); friendly.a.match.peerJoined('p2');
  friendly.a.match.finished('w');
  assert.deepEqual(friendly.a.room.reports, []);
});

test('messages from an old game are ignored', () => {
  const { a, b } = pair();
  a.match.attach(a.room); a.match.peerJoined('p2');
  b.match.receive({ t: 'move', n: 7, ply: 0, m: 'e2e4', ms: 1 });
  b.match.receive({ t: 'resign', n: 7 });
  assert.equal(b.events.move.length, 0);
  assert.equal(b.events.end.length, 0);
});
