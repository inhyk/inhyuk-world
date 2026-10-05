import test from 'node:test';
import assert from 'node:assert/strict';
import { Room, normaliseCode, roomCode, ALPHABET, PING, MESSAGES } from './index.mjs';

// 서버 흉내를 내는 가짜 WebSocket
class FakeSocket {
  constructor(url) { this.url = url; this.readyState = 1; this.sent = []; this.listeners = {}; this.closedWith = null; }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  send(text) { this.sent.push(JSON.parse(text)); }
  close(code) { this.readyState = 3; this.closedWith = code ?? 1000; }
  serve(message) { for (const fn of this.listeners.message ?? []) fn({ data: JSON.stringify(message) }); }
  drop() { this.readyState = 3; for (const fn of this.listeners.close ?? []) fn({ code: 1006 }); }
}

function setup({ maxPlayers, created = { code: 'ABCDEF', maxPlayers: 2 } } = {}) {
  const log = { status: [], join: [], depart: [], message: [], host: [], error: [], fetch: [], sockets: [] };
  const hooks = {
    status: (s, m) => log.status.push([s, m]),
    join: id => log.join.push(id),
    depart: id => log.depart.push(id),
    message: (data, from) => log.message.push([data, from]),
    host: id => log.host.push(id),
    error: code => log.error.push(code),
  };
  const room = new Room(hooks, {
    game: 'test-game', server: 'ws://local.test', maxPlayers,
    fetch: async (url, init) => { log.fetch.push([url, JSON.parse(init.body)]); return { ok: true, json: async () => created }; },
    connect: url => { const s = new FakeSocket(url); log.sockets.push(s); return s; },
  });
  return { room, log };
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('normaliseCode and roomCode', () => {
  assert.equal(normaliseCode(' ab-c d1 2345'), 'ABCD12');
  assert.equal(normaliseCode(null), '');
  const code = roomCode();
  assert.equal(code.length, 6);
  for (const ch of code) assert.ok(ALPHABET.includes(ch));
});

test('room needs a game name', () => {
  assert.throws(() => new Room({}, {}), /game/);
});

test('host creates a room over http, then waits, then sees a friend', async () => {
  const { room, log } = setup({ maxPlayers: 4, created: { code: 'QWERTY', maxPlayers: 4 } });
  const opening = room.open();
  await tick();
  assert.deepEqual(log.fetch, [['http://local.test/rooms/test-game', { maxPlayers: 4 }]]);
  const socket = log.sockets[0];
  assert.equal(socket.url, 'ws://local.test/rooms/test-game/QWERTY');
  socket.serve({ t: 'welcome', id: 'p1', host: 'p1', max: 4, peers: [] });
  await opening;
  assert.equal(room.host, true);
  assert.equal(room.code, 'QWERTY');
  assert.equal(room.maxPlayers, 4);
  assert.equal(room.status, 'waiting');

  socket.serve({ t: 'join', id: 'p2' });
  assert.equal(room.status, 'connected');
  assert.deepEqual(room.peers, ['p2']);
  assert.deepEqual(log.join, ['p2']);

  room.send({ t: 'move', x: 1 });
  room.sendTo('p2', { t: 'secret' });
  assert.deepEqual(socket.sent, [{ t: 'send', data: { t: 'move', x: 1 } }, { t: 'send', to: 'p2', data: { t: 'secret' } }]);

  socket.serve({ t: 'msg', from: 'p2', data: { t: 'hello' } });
  assert.deepEqual(log.message, [[{ t: 'hello' }, 'p2']]);

  socket.serve({ t: 'leave', id: 'p2' });
  assert.deepEqual(log.depart, ['p2']);
  assert.deepEqual(room.status, 'waiting');
  assert.equal(log.status.at(-1)[1], MESSAGES.left);
  room.leave();
});

test('guest joins with a typed code and meets everyone already there', async () => {
  const { room, log } = setup();
  const opening = room.open('abc-def');
  await tick();
  assert.equal(log.fetch.length, 0);
  const socket = log.sockets[0];
  assert.equal(socket.url, 'ws://local.test/rooms/test-game/ABCDEF');
  socket.serve({ t: 'welcome', id: 'p3', host: 'p1', max: 3, peers: ['p1', 'p2'] });
  await opening;
  assert.equal(room.guest, true);
  assert.equal(room.status, 'connected');
  assert.deepEqual(log.join, ['p1', 'p2']);

  socket.serve({ t: 'host', id: 'p3' });
  assert.equal(room.host, true);
  assert.deepEqual(log.host, ['p3']);
  room.leave();
});

test('short code is refused before connecting', async () => {
  const { room, log } = setup();
  await assert.rejects(room.open('AB'), { message: MESSAGES.code });
  assert.equal(log.sockets.length, 0);
});

test('unknown and full rooms give child-friendly errors', async () => {
  for (const [frame, message] of [
    [{ t: 'error', code: 'not-found' }, MESSAGES.notFound],
    [{ t: 'error', code: 'full', max: 4 }, '이 방은 벌써 4명이야. 다른 방을 만들어 줘.'],
  ]) {
    const { room, log } = setup();
    const opening = room.open('ABCDEF');
    await tick();
    log.sockets[0].serve(frame);
    await assert.rejects(opening, { message });
    assert.deepEqual(log.status.at(-1), ['error', message]);
    assert.equal(room.active, false);
  }
});

test('losing the server after connecting reports an error', async () => {
  const { room, log } = setup();
  const opening = room.open('ABCDEF');
  await tick();
  log.sockets[0].serve({ t: 'welcome', id: 'p2', host: 'p1', max: 2, peers: ['p1'] });
  await opening;
  log.sockets[0].drop();
  assert.deepEqual(log.status.at(-1), ['error', MESSAGES.lost]);
  assert.equal(room.active, false);
});

test('leave sends bye, closes and goes offline; leaving while connecting resolves quietly', async () => {
  const { room, log } = setup();
  const opening = room.open('ABCDEF');
  await tick();
  room.leave();
  await opening;
  assert.equal(room.status, 'offline');

  const second = room.open('ABCDEF');
  await tick();
  const socket = log.sockets[1];
  socket.serve({ t: 'welcome', id: 'p2', host: 'p1', max: 2, peers: ['p1'] });
  await second;
  room.leave();
  assert.deepEqual(socket.sent.at(-1), { t: 'bye' });
  assert.equal(socket.closedWith, 1000);
  assert.equal(room.status, 'offline');
  assert.equal(room.send({ t: 'x' }), false);
});

test('keepalive pings with the exact auto-response text and gives up on silence', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'] });
  const { room, log } = setup();
  const opening = room.open('ABCDEF');
  await Promise.resolve(); await Promise.resolve();
  const socket = log.sockets[0];
  const raw = [];
  socket.send = text => raw.push(text);
  socket.serve({ t: 'welcome', id: 'p2', host: 'p1', max: 2, peers: ['p1'] });
  await opening;
  t.mock.timers.tick(4000);
  assert.deepEqual(raw, [PING]);
  t.mock.timers.tick(8000);
  socket.serve({ t: 'pong' });
  t.mock.timers.tick(8000);
  assert.equal(room.status, 'connected');
  t.mock.timers.tick(8000);
  assert.deepEqual(log.status.at(-1), ['error', MESSAGES.lost]);
});

test('server warnings go to the error hook', async () => {
  const { room, log } = setup();
  const opening = room.open('ABCDEF');
  await tick();
  log.sockets[0].serve({ t: 'welcome', id: 'p2', host: 'p1', max: 2, peers: ['p1'] });
  await opening;
  log.sockets[0].serve({ t: 'error', code: 'too-big' });
  assert.deepEqual(log.error, ['too-big']);
  assert.equal(room.status, 'connected');
  room.leave();
});
