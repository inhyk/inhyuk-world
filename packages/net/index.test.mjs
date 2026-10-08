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
  const log = { status: [], join: [], depart: [], message: [], host: [], error: [], watchers: [], fetch: [], sockets: [] };
  const hooks = {
    status: (s, m) => log.status.push([s, m]),
    join: id => log.join.push(id),
    depart: id => log.depart.push(id),
    message: (data, from) => log.message.push([data, from]),
    host: id => log.host.push(id),
    error: code => log.error.push(code),
    watchers: n => log.watchers.push(n),
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

test('watching: opens with a ticket and watch=1, gets both players\' messages, never sends game messages, and ends with the match', async () => {
  const { room, log } = setup();
  const opening = room.open('abc-def', { ticket: 'T1', watch: true });
  await tick();
  assert.deepEqual(log.fetch, []); // 방을 만들지 않는다
  const socket = log.sockets[0];
  assert.equal(socket.url, 'ws://local.test/rooms/test-game/ABCDEF?ticket=T1&watch=1');
  socket.serve({ t: 'welcome', id: 'w1', watch: true, host: 'p1', max: 2, peers: ['p1', 'p2'], users: { p1: 12, p2: 34 } });
  await opening;
  assert.deepEqual(room.users, { p1: 12, p2: 34 });
  assert.equal(room.watcher, true);
  assert.equal(room.host, false);
  assert.equal(room.guest, false);
  assert.deepEqual(room.peers, ['p1', 'p2']);
  socket.serve({ t: 'msg', from: 'p2', data: { t: 's', sc: 10 } });
  assert.deepEqual(log.message.at(-1), [{ t: 's', sc: 10 }, 'p2']);
  assert.equal(room.send({ t: 'atk' }), false);
  assert.equal(room.sendTo('p1', { t: 'atk' }), false);
  assert.equal(room.report(1, true), false);
  assert.deepEqual(socket.sent, []);
  socket.serve({ t: 'host', id: 'p2' }); // 방장이 바뀌어도 나는 계속 관전
  assert.equal(room.watcher, true);
  socket.serve({ t: 'leave', id: 'p1' });
  socket.serve({ t: 'join', id: 'p3', user: 12 });
  assert.deepEqual(room.users, { p1: 12, p2: 34, p3: 12 });
  assert.deepEqual(room.peers, ['p2', 'p3']);
  socket.serve({ t: 'error', code: 'ended' });
  assert.deepEqual(log.error, ['ended']);
  assert.deepEqual(log.status.at(-1), ['error', MESSAGES.ended]);
  assert.equal(room.active, false);
});

test('watching: a viewer can only chat and cheer, and everyone gets viewers\' words apart from game messages', async () => {
  const { room, log } = setup();
  const seen = [];
  room.hooks.watcherMessage = (data, user, from) => seen.push([data, user, from]);
  const opening = room.open('ABCDEF', { ticket: 'T1', watch: true });
  await tick();
  const socket = log.sockets[0];
  socket.serve({ t: 'welcome', id: 'w1', watch: true, host: 'p1', max: 2, peers: ['p1', 'p2'], users: { p1: 12, p2: 34 } });
  await opening;
  assert.equal(room.chat('잘한다', { name: '가짜' }), true); // 다른 칸은 보내지 않는다
  assert.equal(room.cheer('p2', 1), true);
  assert.deepEqual(socket.sent, [{ t: 'send', data: { chat: '잘한다' } }, { t: 'send', data: { t: 'cheer', k: 1, to: 'p2' } }]);
  // 다른 관전자가 보낸 것은 게임 메시지(message)가 아니라 watcherMessage 로 온다
  socket.serve({ t: 'wmsg', from: 'w2', user: { id: 56, nickname: '보는사람' }, data: { chat: '안녕' } });
  socket.serve({ t: 'wmsg', from: 'w2', user: { id: 56, nickname: '보는사람' }, data: { t: 'cheer', k: 0, to: 'p1' } });
  socket.serve({ t: 'wmsg', from: 'w2', data: null });
  assert.deepEqual(seen, [[{ chat: '안녕' }, { id: 56, nickname: '보는사람' }, 'w2'], [{ t: 'cheer', k: 0, to: 'p1' }, { id: 56, nickname: '보는사람' }, 'w2']]);
  assert.deepEqual(log.message, []);
  socket.serve({ t: 'error', code: 'watch-only' }); // 예전 서버: 관전하는 사람은 아무것도 못 보낸다
  assert.deepEqual(log.error, ['watch-only']);
  assert.equal(room.active, true);
  room.leave();
  // 대전하는 사람은 응원을 보내지 않는다 (받기만 한다)
  const player = setup();
  const got = [];
  player.room.hooks.watcherMessage = (data, user) => got.push([data, user.nickname]);
  const joining = player.room.open('ABCDEF', { ticket: 'T' });
  await tick();
  player.log.sockets[0].serve({ t: 'welcome', id: 'p2', host: 'p1', max: 2, peers: ['p1'] });
  await joining;
  assert.equal(player.room.cheer('p1', 0), false);
  player.log.sockets[0].serve({ t: 'wmsg', from: 'w1', user: { id: 7, nickname: '응원단' }, data: { t: 'cheer', k: 1, to: 'p2' } });
  assert.deepEqual(got, [[{ t: 'cheer', k: 1, to: 'p2' }, '응원단']]);
  assert.deepEqual(player.log.message, []);
  player.room.leave();
});

test('watching a match that can not be watched fails with a kind message', async () => {
  for (const [code, text] of [['not-watchable', MESSAGES.notWatchable], ['watch-full', MESSAGES.watchFull(10)], ['not-found', MESSAGES.notFound]]) {
    const { room, log } = setup();
    const opening = room.open('ABCDEF', { ticket: 'T', watch: true });
    await tick();
    log.sockets[0].serve({ t: 'error', code, max: 10 });
    await assert.rejects(opening, { message: text });
  }
  const { room } = setup();
  await assert.rejects(room.open('', { ticket: 'T', watch: true }), { message: MESSAGES.code });
});

test('players keep a message for later viewers, report results, and hear how many are watching', async () => {
  const { room, log } = setup();
  const opening = room.open('ABCDEF', { ticket: 'T' });
  await tick();
  const socket = log.sockets[0];
  socket.serve({ t: 'welcome', id: 'p2', host: 'p1', max: 2, peers: ['p1'] });
  await opening;
  room.send({ t: 'hello', level: 3 }, { keep: true });
  room.report(2, true);
  room.report(3, 0);
  assert.deepEqual(socket.sent, [{ t: 'send', data: { t: 'hello', level: 3 }, keep: true }, { t: 'report', n: 2, won: true }, { t: 'report', n: 3, won: false }]);
  socket.serve({ t: 'watchers', n: 3 });
  assert.deepEqual(log.watchers, [3]);
  room.leave();
});
