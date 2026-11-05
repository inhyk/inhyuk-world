import test from 'node:test';
import assert from 'node:assert/strict';
import { World, WORLD_MESSAGES } from './world.mjs';

// 서버 흉내를 내는 가짜 WebSocket
class FakeSocket {
  constructor(url) { this.url = url; this.readyState = 1; this.sent = []; this.listeners = {}; this.closedWith = null; }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  send(text) { this.sent.push(JSON.parse(text)); }
  close(code) { this.readyState = 3; this.closedWith = code ?? 1000; }
  serve(message) { for (const fn of this.listeners.message ?? []) fn({ data: JSON.stringify(message) }); }
  drop() { this.readyState = 3; for (const fn of this.listeners.close ?? []) fn({ code: 1006 }); }
}

function setup({ probeStatus = 426, connect } = {}) {
  const log = { status: [], welcome: 0, ready: 0, cell: [], join: [], leave: [], pose: [], message: [], error: [], sockets: [], fetch: [] };
  const hooks = {
    status: (s, m) => log.status.push([s, m]),
    welcome: () => log.welcome++,
    ready: () => log.ready++,
    cell: (k, e) => log.cell.push([k, e]),
    join: (id, user) => log.join.push([id, user]),
    leave: id => log.leave.push(id),
    pose: (id, d) => log.pose.push([id, d]),
    message: (d, from) => log.message.push([d, from]),
    error: (code, k) => log.error.push(k === undefined ? [code] : [code, k]),
  };
  const world = new World(hooks, {
    game: 'social-game', world: 'town', server: 'ws://local.test',
    fetch: async url => { log.fetch.push(url); return { status: probeStatus, ok: false }; },
    connect: connect ?? (url => { const s = new FakeSocket(url); log.sockets.push(s); return s; }),
  });
  return { world, log };
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const me = { id: 7, nickname: '인혁' }, friend = { id: 9, nickname: '친구' };

async function opened(extra) {
  const { world, log } = setup(extra);
  const opening = world.open('ticket-123');
  await tick();
  const socket = log.sockets[0];
  socket.serve({ t: 'welcome', id: 'p1', user: me, max: 12, peers: [{ id: 'p2', user: friend }] });
  socket.serve({ t: 'cells', list: [{ k: 'a', v: 1, owner: friend }], done: false });
  socket.serve({ t: 'cells', list: [{ k: 'b', v: { c: 2 }, owner: me, exp: Date.now() + 60_000 }], done: true });
  await opening;
  return { world, log, socket };
}

test('world needs a game and a good world name', () => {
  assert.throws(() => new World({}, { world: 'town' }), /game/);
  assert.throws(() => new World({}, { game: 'g' }), /world/);
  assert.throws(() => new World({}, { game: 'g', world: 'Town!' }), /world/);
});

test('opens with the ticket, gets peers and cells in chunks, then is ready', async () => {
  const { world, log, socket } = await opened();
  assert.equal(socket.url, 'ws://local.test/worlds/social-game/town?ticket=ticket-123');
  assert.equal(world.id, 'p1');
  assert.deepEqual(world.user, me);
  assert.equal(world.status, 'connected');
  assert.equal(world.ready, true);
  assert.equal(log.welcome, 1);
  assert.equal(log.ready, 1);
  assert.deepEqual([...world.peers], [['p2', friend]]);
  assert.deepEqual(log.join, [['p2', friend]]);
  assert.deepEqual([...world.cells.keys()], ['a', 'b']);
  assert.deepEqual(world.cells.get('a'), { v: 1, owner: friend });
  assert.deepEqual(log.cell.map(([k]) => k), ['a', 'b']);
  world.close();
});

test('keeps cells in sync and sends set, del, send, sendTo, chat', async () => {
  const { world, log, socket } = await opened();
  world.set('1|2|3', { b: 'stone' });
  world.set('tree', 'stump', { ttl: 600 });
  world.del('a');
  world.send({ t: 'wave' });
  world.sendTo('p2', [1]);
  world.chat('안녕');
  assert.deepEqual(socket.sent, [
    { t: 'set', k: '1|2|3', v: { b: 'stone' } },
    { t: 'set', k: 'tree', v: 'stump', ttl: 600 },
    { t: 'del', k: 'a' },
    { t: 'send', data: { t: 'wave' } },
    { t: 'send', to: 'p2', data: [1] },
    { t: 'send', data: { chat: '안녕' } },
  ]);
  socket.serve({ t: 'cell', k: '1|2|3', v: { b: 'stone' }, owner: me });
  socket.serve({ t: 'cell', k: 'a', v: null });
  assert.deepEqual(world.cells.get('1|2|3'), { v: { b: 'stone' }, owner: me });
  assert.equal(world.cells.has('a'), false);
  assert.deepEqual(log.cell.slice(-2), [['1|2|3', { v: { b: 'stone' }, owner: me }], ['a', null]]);
  socket.serve({ t: 'error', code: 'taken', k: 'x' });
  assert.deepEqual(log.error, [['taken', 'x']]);
  socket.serve({ t: 'join', id: 'p3', user: { id: 3, nickname: '셋' } });
  socket.serve({ t: 'pose', id: 'p3', d: { x: 1 } });
  socket.serve({ t: 'msg', from: 'p3', data: { chat: '하이' } });
  socket.serve({ t: 'leave', id: 'p3' });
  assert.deepEqual(log.join.at(-1), ['p3', { id: 3, nickname: '셋' }]);
  assert.deepEqual(log.pose, [['p3', { x: 1 }]]);
  assert.deepEqual(log.message, [[{ chat: '하이' }, 'p3']]);
  assert.deepEqual(log.leave, ['p3']);
  assert.equal(world.peers.has('p3'), false);
  world.close();
  assert.deepEqual(socket.sent.at(-1), { t: 'bye' });
  assert.equal(world.status, 'offline');
  assert.equal(world.cells.size, 0);
});

test('ttl cells expire on the client using exp', async () => {
  const { world, log, socket } = await opened();
  socket.serve({ t: 'cell', k: 'soon', v: 1, owner: me, exp: Date.now() + 5 });
  assert.equal(world.cells.has('soon'), true);
  world.expire(Date.now() + 10);
  assert.equal(world.cells.has('soon'), false);
  assert.deepEqual(log.cell.at(-1), ['soon', null]);
  assert.equal(world.cells.has('b'), true); // 1분 남은 것은 그대로
  world.expire(Date.now() + 61_000);
  assert.equal(world.cells.has('b'), false);
  // 이미 지난 칸은 받자마자 버린다
  socket.serve({ t: 'cell', k: 'old', v: 1, owner: me, exp: Date.now() - 1 });
  assert.equal(world.cells.has('old'), false);
  world.close();
});

test('pose is throttled to 15 a second and the last value wins', async () => {
  const { world, socket } = await opened();
  world.pose({ x: 1 });
  world.pose({ x: 2 });
  world.pose({ x: 3 });
  assert.deepEqual(socket.sent, [{ t: 'pose', d: { x: 1 } }]);
  await new Promise(resolve => setTimeout(resolve, 90));
  assert.deepEqual(socket.sent, [{ t: 'pose', d: { x: 1 } }, { t: 'pose', d: { x: 3 } }]);
  world.close();
});

test('a full world rejects open with a Korean message', async () => {
  const { world, log } = setup();
  const opening = world.open('t');
  await tick();
  log.sockets[0].serve({ t: 'error', code: 'full', max: 12 });
  await assert.rejects(opening, error => error.code === 'full' && error.message === WORLD_MESSAGES.full(12));
  assert.equal(world.status, 'error');
  assert.deepEqual(log.error, [['full']]);
});

test('an old server without /worlds says not-deployed', async () => {
  const { world, log } = setup({ probeStatus: 404, connect: async () => { throw Error('no websocket (404)'); } });
  await assert.rejects(world.open('t'), error => error.code === 'not-deployed');
  assert.deepEqual(log.fetch, ['http://local.test/worlds/social-game/town']);
  assert.deepEqual(log.status.at(-1), ['error', WORLD_MESSAGES['not-deployed']]);
  assert.deepEqual(log.error, [['not-deployed']]);
});

test('a browser socket that closes before welcome is checked the same way', async () => {
  const { world, log } = setup({ probeStatus: 404 });
  const opening = world.open('t');
  await tick();
  log.sockets[0].drop();
  await assert.rejects(opening, error => error.code === 'not-deployed');
  // 새 서버(426)면 그냥 연결 문제
  const other = setup({ probeStatus: 426 });
  const again = other.world.open('t');
  await tick();
  other.log.sockets[0].drop();
  await assert.rejects(again, error => error.code === 'network');
});

test('replaced and lost connections end with an error status', async () => {
  const { world, log, socket } = await opened();
  socket.serve({ t: 'error', code: 'replaced' });
  assert.deepEqual(log.status.at(-1), ['error', WORLD_MESSAGES.replaced]);
  assert.equal(world.id, '');
  const second = await opened();
  second.socket.drop();
  assert.deepEqual(second.log.status.at(-1), ['error', WORLD_MESSAGES.lost]);
});

test('no ticket means login-required', async () => {
  const { world, log } = setup();
  await assert.rejects(world.open(''), error => error.code === 'login-required');
  assert.equal(log.sockets.length, 0);
});
