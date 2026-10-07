import test from 'node:test';
import assert from 'node:assert/strict';
import { Account, Social, NetError, memoryStorage, SOCIAL_MESSAGES, Room } from './index.mjs';

// 서버 흉내를 내는 가짜 WebSocket
class FakeSocket {
  constructor(url) { this.url = url; this.readyState = 1; this.sent = []; this.listeners = {}; this.closedWith = null; }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  send(text) { this.sent.push(text); }
  close(code) { this.readyState = 3; this.closedWith = code ?? 1000; }
  serve(message) { for (const fn of this.listeners.message ?? []) fn({ data: JSON.stringify(message) }); }
  drop() { this.readyState = 3; for (const fn of this.listeners.close ?? []) fn({ code: 1006 }); }
}

// 길(path)마다 정한 답을 주는 가짜 fetch
function setup(routes = {}) {
  const calls = [], sockets = [];
  let tickets = 0;
  const all = {
    'POST /auth/login': () => [200, { token: 'tok-1', user: { id: 1, nickname: '인혁' } }],
    'POST /auth/signup': () => [201, { token: 'tok-1', user: { id: 1, nickname: '인혁' } }],
    'POST /auth/logout': () => [200, { ok: true }],
    'POST /auth/ticket': () => [200, { ticket: `ticket-${++tickets}`, expires: Date.now() + 60000 }],
    ...routes,
  };
  const fetch = async (url, init) => {
    const path = url.replace('https://net.test', '');
    calls.push({ method: init.method, path, body: init.body ? JSON.parse(init.body) : undefined, auth: init.headers.Authorization });
    const handler = all[`${init.method} ${path.split('?')[0]}`];
    if (!handler) return { ok: false, status: 404, json: async () => ({ error: 'not-found' }) };
    const [status, body] = handler(path, init);
    return { ok: status < 400, status, json: async () => body };
  };
  const connect = url => { const s = new FakeSocket(url); sockets.push(s); return s; };
  const storage = memoryStorage();
  const options = { server: 'wss://net.test', fetch, connect, storage };
  return { calls, sockets, options, storage };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
// 가짜 시계를 쓰는 시험에서는 setTimeout 을 못 쓰므로 마이크로태스크만 비운다
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const until = async (check, ms = 1000) => { const end = Date.now() + ms; while (!check()) { if (Date.now() > end) throw Error('timed out'); await tick(); } };

test('login keeps the token in storage, sends it as a Bearer header, and logout forgets it', async () => {
  const { options, calls, storage } = setup({ 'GET /me': () => [200, { user: { id: 1, nickname: '인혁', created: 5 } }] });
  const account = new Account(options);
  assert.equal(account.loggedIn, false);
  assert.deepEqual(await account.login('인혁', '1234'), { id: 1, nickname: '인혁' });
  assert.deepEqual(calls[0].body, { nickname: '인혁', password: '1234' });
  assert.ok(storage.getItem('inhyuk-net-session').includes('tok-1'));
  const again = new Account(options); // 앱을 다시 열어도 로그인 상태
  assert.equal(again.token, 'tok-1');
  await again.me();
  assert.equal(calls.at(-1).auth, 'Bearer tok-1');
  await again.logout();
  assert.equal(storage.getItem('inhyuk-net-session'), null);
  assert.equal(new Account(options).loggedIn, false);
});

test('server errors become NetError with a child-friendly message', async () => {
  const { options, storage } = setup({
    'POST /auth/signup': () => [409, { error: 'nickname-taken' }],
    'POST /auth/login': () => [403, { error: 'suspended', reason: '욕설' }],
  });
  const account = new Account(options);
  await assert.rejects(account.signup('인혁', '1234'), e => e instanceof NetError && e.code === 'nickname-taken' && e.message === SOCIAL_MESSAGES['nickname-taken'] && e.status === 409);
  storage.setItem('inhyuk-net-session', JSON.stringify({ token: 'old', user: null }));
  const saved = new Account(options);
  await assert.rejects(saved.login('인혁', '1234'), { code: 'suspended', reason: '욕설' });
  assert.equal(saved.loggedIn, false);
  const offline = new Account({ ...options, fetch: async () => { throw Error('down'); } });
  await assert.rejects(offline.login('a', 'b'), { code: 'network', message: SOCIAL_MESSAGES.network });
});

test('friend, block, dm and report calls hit the right endpoints', async () => {
  const seen = [];
  const any = (path, init) => { seen.push(`${init.method} ${path}`); return [200, { users: [], friends: [], blocks: [], unread: [], message: { id: 1 } }]; };
  const { options } = setup({
    'GET /users/search': any, 'GET /friends': any, 'POST /friends/requests': any, 'POST /friends/requests/7/accept': any,
    'POST /friends/requests/7/decline': any, 'DELETE /friends/requests/7': any, 'DELETE /friends/7': any, 'GET /blocks': any,
    'POST /blocks/7': any, 'DELETE /blocks/7': any, 'GET /dm': any, 'GET /dm/7': any, 'POST /dm/7': any, 'POST /dm/7/read': any, 'POST /reports': any,
  });
  const account = new Account(options);
  await account.login('a', 'bcde');
  const social = new Social(account);
  await social.search('인 혁');
  await social.friends();
  await social.requestFriend('철수'); await social.requestFriend(7);
  await social.acceptFriend(7); await social.declineFriend(7); await social.cancelRequest(7); await social.removeFriend(7);
  await social.blocks(); await social.block(7); await social.unblock(7);
  await social.unread(); await social.history(7, 30); await social.sendDm(7, '안녕'); await social.markRead(7);
  await social.report({ target: 7, context: { kind: 'dm' } });
  assert.deepEqual(seen, [
    'GET /users/search?q=%EC%9D%B8%20%ED%98%81', 'GET /friends', 'POST /friends/requests', 'POST /friends/requests',
    'POST /friends/requests/7/accept', 'POST /friends/requests/7/decline', 'DELETE /friends/requests/7', 'DELETE /friends/7',
    'GET /blocks', 'POST /blocks/7', 'DELETE /blocks/7', 'GET /dm', 'GET /dm/7?before=30', 'POST /dm/7', 'POST /dm/7/read', 'POST /reports',
  ]);
});

test('live connects with a ticket, dispatches hooks and tracks online friends', async () => {
  const { options, sockets } = setup();
  const account = new Account(options);
  await account.login('a', 'bcde');
  const log = [];
  const social = new Social(account, {
    status: s => log.push(['status', s]), online: id => log.push(['online', id]), offline: id => log.push(['offline', id]),
    dm: m => log.push(['dm', m.message.body]), invite: i => log.push(['invite', i.id]), friendRequest: f => log.push(['request', f.id]),
  });
  const opening = social.live();
  await until(() => sockets.length === 1);
  assert.equal(sockets[0].url, 'wss://net.test/live?ticket=ticket-1');
  sockets[0].serve({ t: 'hello', user: { id: 1 }, online: [2], invites: [] });
  await opening;
  assert.equal(social.status, 'online');
  assert.deepEqual([...social.onlineFriends], [2]);
  sockets[0].serve({ t: 'online', id: 3 });
  sockets[0].serve({ t: 'offline', id: 2 });
  sockets[0].serve({ t: 'dm', message: { body: '안녕' } });
  sockets[0].serve({ t: 'invite', invite: { id: 'abc' } });
  sockets[0].serve({ t: 'friend-request', from: { id: 9 } });
  assert.deepEqual([...social.onlineFriends], [3]);
  assert.deepEqual(log, [['status', 'connecting'], ['status', 'online'], ['online', 3], ['offline', 2], ['dm', '안녕'], ['invite', 'abc'], ['request', 9]]);
  social.close();
  assert.equal(sockets[0].closedWith, 1000);
  assert.equal(social.status, 'offline');
});

test('live reconnects with growing backoff after a drop', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const { options, sockets } = setup();
  const account = new Account(options);
  await account.login('a', 'bcde');
  const social = new Social(account);
  social.live();
  await flush();
  assert.equal(sockets.length, 1);
  sockets[0].serve({ t: 'hello', online: [] });
  sockets[0].drop();
  assert.equal(social.status, 'connecting');
  t.mock.timers.tick(700); // 1초 ± 25% 보다 짧으면 아직
  assert.equal(sockets.length, 1);
  t.mock.timers.tick(700);
  await flush();
  assert.equal(sockets.length, 2);
  sockets[1].drop(); // hello 전에 또 끊김 → 이번에는 2초쯤
  t.mock.timers.tick(1400);
  await flush();
  assert.equal(sockets.length, 2);
  t.mock.timers.tick(1200);
  await flush();
  assert.equal(sockets.length, 3);
  sockets[2].serve({ t: 'kicked', reason: 'suspended' });
  sockets[2].drop();
  t.mock.timers.tick(60000);
  await flush();
  assert.equal(sockets.length, 3); // 정지되면 다시 붙지 않는다
  assert.equal(account.loggedIn, false);
});

test('findMatch waits in line, then joins the matched room with a fresh ticket', async () => {
  const { options, sockets } = setup();
  const account = new Account(options);
  await account.login('a', 'bcde');
  const social = new Social(account);
  let queued = 0;
  const finding = social.findMatch('jelly', { message: () => {} }, {}, { onQueued: () => queued++ });
  await until(() => sockets.length === 1);
  assert.equal(sockets[0].url, 'wss://net.test/match/jelly?ticket=ticket-1');
  sockets[0].serve({ t: 'queued', game: 'jelly' });
  assert.equal(queued, 1);
  sockets[0].serve({ t: 'matched', code: 'ABCDEF', game: 'jelly', opponent: { id: 2, nickname: '철수' } });
  await until(() => sockets.length === 2);
  assert.equal(sockets[1].url, 'wss://net.test/rooms/jelly/ABCDEF?ticket=ticket-2');
  sockets[1].serve({ t: 'welcome', id: 'p2', host: 'p1', max: 2, peers: ['p1'] });
  const { room, opponent } = await finding;
  assert.ok(room instanceof Room);
  assert.equal(room.status, 'connected');
  assert.deepEqual(opponent, { id: 2, nickname: '철수' });
  room.chat('안녕');
  assert.deepEqual(JSON.parse(sockets[1].sent.at(-1)), { t: 'send', data: { chat: '안녕' } });
  room.leave();
});

test('cancelMatch ends findMatch with null', async () => {
  const { options, sockets } = setup();
  const account = new Account(options);
  await account.login('a', 'bcde');
  const social = new Social(account);
  const finding = social.findMatch('jelly');
  await until(() => sockets.length === 1);
  social.cancelMatch();
  assert.equal(await finding, null);
  assert.deepEqual(sockets[0].sent, ['{"t":"cancel"}']);
});

test('invite resolves into a room when the friend accepts, and rejects when declined', async () => {
  const { options, sockets } = setup({ 'POST /invites': (_p, init) => [201, { invite: { id: `inv-${JSON.parse(init.body).to}`, expires: Date.now() + 60000 } }] });
  const account = new Account(options);
  await account.login('a', 'bcde');
  const social = new Social(account);
  const opening = social.live();
  await until(() => sockets.length === 1);
  sockets[0].serve({ t: 'hello', online: [5] });
  await opening;

  const inviting = social.invite(5, 'jelly');
  await tick(); await tick();
  sockets[0].serve({ t: 'room', via: 'invite', invite: 'inv-5', code: 'QWERTY', game: 'jelly', opponent: { id: 5, nickname: '친구' } });
  await until(() => sockets.length === 2);
  assert.equal(sockets[1].url, 'wss://net.test/rooms/jelly/QWERTY?ticket=ticket-2');
  sockets[1].serve({ t: 'welcome', id: 'p1', host: 'p1', max: 2, peers: [] });
  const { room, opponent } = await inviting;
  assert.equal(opponent.id, 5);
  room.leave();

  const refused = social.invite(6, 'jelly');
  await tick(); await tick();
  sockets[0].serve({ t: 'invite-declined', invite: 'inv-6', by: { id: 6 } });
  await assert.rejects(refused, { code: 'declined', message: SOCIAL_MESSAGES.declined });
  social.close();
});

test('room refuses non-members with a clear message', async () => {
  const { options, sockets } = setup();
  const room = new Room({}, { ...options, game: 'jelly' });
  const opening = room.open('ABCDEF', { ticket: 'tt' });
  await tick();
  assert.equal(sockets[0].url, 'wss://net.test/rooms/jelly/ABCDEF?ticket=tt');
  sockets[0].serve({ t: 'error', code: 'not-member', max: 2 });
  await assert.rejects(opening, { message: '이 방에는 들어갈 수 없어.' });
});

test('live() and invite() do not hang when the socket drops before hello', async () => {
  const { options, sockets, calls } = setup({ 'POST /invites': () => [409, { error: 'offline' }] });
  const account = new Account(options);
  await account.login('인혁', '1234');
  const social = new Social(account);
  const first = social.live();
  await until(() => sockets.length === 1);
  sockets[0].drop(); // hello 전에 끊김
  await first; // 끝나야 한다 (예전에는 영원히 기다림)
  assert.equal(social.status, 'connecting');
  social.close();

  const again = new Social(account);
  const pending = again.live();
  await until(() => sockets.length === 2);
  again.close(); // close() 도 기다리던 live() 를 끝낸다
  await pending;
  assert.equal(again.status, 'offline');

  const inviter = new Social(account);
  const inviting = inviter.invite(7, 'jelly-tower');
  await until(() => sockets.length === 3);
  sockets[2].drop();
  await assert.rejects(inviting, { code: 'offline' }); // live() 가 끝나 초대 요청까지 가서 서버 답으로 끝난다
  assert.ok(calls.some(c => c.path === '/invites'));
  inviter.close();
});

test('Room handles rejoin and being replaced by another connection', async () => {
  const sockets = [];
  const seen = { rejoin: [], status: [], error: [] };
  const room = new Room({ rejoin: id => seen.rejoin.push(id), status: (s, m) => seen.status.push([s, m]), error: c => seen.error.push(c) }, {
    game: 'g', server: 'wss://net.test', connect: url => { const s = new FakeSocket(url); sockets.push(s); return s; },
  });
  const opening = room.open('ABCDEF');
  await until(() => sockets.length === 1);
  sockets[0].serve({ t: 'welcome', id: 'p1', host: 'p1', max: 2, peers: ['p2'] });
  await opening;
  sockets[0].serve({ t: 'rejoin', id: 'p2' });
  assert.deepEqual(seen.rejoin, ['p2']);
  sockets[0].serve({ t: 'error', code: 'replaced' });
  assert.deepEqual(seen.error, ['replaced']);
  assert.equal(room.status, 'error');
  assert.equal(seen.status.at(-1)[1], '다른 곳에서 이 방에 다시 들어갔어.');
});

test('loadSave and putSave return plain results, and a conflict carries the server copy', async () => {
  let revision = 0;
  const { options, calls } = setup({
    'GET /saves/jelly-tower': () => (revision ? [200, { data: { level: 2 }, revision, updated: 5 }] : [404, { error: 'no-save' }]),
    'PUT /saves/jelly-tower': (_path, init) => {
      const body = JSON.parse(init.body);
      if (body.baseRevision !== revision) return [409, { error: 'conflict', data: { level: 2 }, revision, updated: 5 }];
      revision++;
      return [200, { revision, updated: 6 }];
    },
  });
  const account = new Account(options);
  await account.login('인혁', '1234');
  assert.equal(await account.loadSave('jelly-tower'), null);
  assert.deepEqual(await account.putSave('jelly-tower', { level: 2 }, 0, { importId: 'abcdefgh' }), { ok: true, revision: 1, updated: 6 });
  assert.deepEqual(calls.at(-1).body, { data: { level: 2 }, baseRevision: 0, importId: 'abcdefgh' });
  assert.deepEqual(await account.putSave('jelly-tower', { level: 3 }, 0), { conflict: true, server: { data: { level: 2 }, revision: 1, updated: 5 } });
  assert.deepEqual(await new Social(account).loadSave('jelly-tower'), { data: { level: 2 }, revision: 1, updated: 5 });
});

test('stats, rankings, live matches and watching hit the right endpoints', async () => {
  const ranking = { by: 'level', list: [{ rank: 1, id: 2, nickname: '민준', level: 30, trophies: 4, wins: 1 }], me: { rank: 3, ranks: { trophies: 2, level: 3, wins: null }, top5: true } };
  const live = [{ code: 'QWERTY', started: 1, friend: true, players: [{ id: 2, nickname: '민준', level: 30 }, { id: 3, nickname: '지우', level: 4 }] }];
  const { options, calls, sockets } = setup({
    'PUT /stats/jelly-tower': () => [200, { ok: true }],
    'GET /rankings/jelly-tower': () => [200, ranking],
    'GET /matches/jelly-tower': () => [200, { matches: live }],
  });
  const account = new Account(options);
  await account.login('인혁', '1234');
  const social = new Social(account, {}, { connect: options.connect });
  assert.deepEqual(await social.putStats('jelly-tower', { level: 12, xp: 30, trophies: 5, coins: 999 }), { ok: true });
  assert.deepEqual(calls.at(-1), { method: 'PUT', path: '/stats/jelly-tower', body: { level: 12, xp: 30, trophies: 5 }, auth: 'Bearer tok-1' });
  assert.deepEqual(await social.rankings('jelly-tower', 'level'), ranking);
  assert.equal(calls.at(-1).path, '/rankings/jelly-tower?by=level');
  await social.rankings('jelly-tower');
  assert.equal(calls.at(-1).path, '/rankings/jelly-tower?by=trophies');
  assert.deepEqual(await social.matches('jelly-tower'), live);

  const messages = [];
  const watching = social.watch('jelly-tower', 'QWERTY', { message: (data, from) => messages.push([data, from]) });
  await until(() => sockets.length === 1);
  assert.equal(sockets[0].url, 'wss://net.test/rooms/jelly-tower/QWERTY?ticket=ticket-1&watch=1');
  sockets[0].serve({ t: 'welcome', id: 'w1', watch: true, host: 'p1', max: 2, peers: ['p1', 'p2'] });
  const room = await watching;
  assert.ok(room instanceof Room);
  assert.equal(room.watcher, true);
  sockets[0].serve({ t: 'msg', from: 'p1', data: { t: 's', sc: 5 } });
  assert.deepEqual(messages, [[{ t: 's', sc: 5 }, 'p1']]);
  room.leave();
});

test('deleteAccount sends the password, forgets the login only when the server really deleted it', async () => {
  let answer = [403, { error: 'wrong-password' }];
  const { options, calls, storage } = setup({ 'POST /auth/delete': () => answer });
  const account = new Account(options);
  await account.login('인혁', '1234');
  await assert.rejects(() => account.deleteAccount('nope'), error => error instanceof NetError && error.code === 'wrong-password' && error.status === 403 && error.message === SOCIAL_MESSAGES['wrong-password']);
  assert.deepEqual(calls.at(-1), { method: 'POST', path: '/auth/delete', body: { password: 'nope' }, auth: 'Bearer tok-1' });
  assert.equal(account.loggedIn, true); // 틀리면 로그인은 그대로
  assert.ok(storage.getItem('inhyuk-net-session').includes('tok-1'));
  answer = [200, { ok: true }];
  await account.deleteAccount('1234');
  assert.equal(account.loggedIn, false);
  assert.equal(storage.getItem('inhyuk-net-session'), null);
});

test('deleteAccount on a server that does not know it yet fails with 404 and keeps the login', async () => {
  const { options } = setup(); // 예전 서버: /auth/delete 가 없다
  const account = new Account(options);
  await account.login('인혁', '1234');
  await assert.rejects(() => account.deleteAccount('1234'), error => error.status === 404);
  assert.equal(account.loggedIn, true);
});
