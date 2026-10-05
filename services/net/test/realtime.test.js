// 실시간: 접속 상태, 알림, 친구 초대, 랜덤 매칭, 방 채팅 거르기, 방 채팅 신고
import { describe, it, expect } from 'vitest';
import { SELF, env } from 'cloudflare:test';
import { api, signup, befriend, live, connect, ticketFor, ORIGIN } from './helpers.js';
import { Account, Social, memoryStorage } from '../../../packages/net/index.mjs';

const game = 'jelly-test';

describe('live presence and notifications', () => {
  it('needs a valid one-time ticket and an allowed origin', async () => {
    expect((await connect('/live')).res.status).toBe(401);
    expect((await connect('/live?ticket=' + 'x'.repeat(32))).res.status).toBe(401);
    const a = await signup();
    const ticket = await ticketFor(a);
    expect((await connect(`/live?ticket=${ticket}`, { origin: 'https://evil.example' })).res.status).toBe(403);
    const first = await connect(`/live?ticket=${ticket}`);
    expect((await first.next()).t).toBe('hello');
    expect((await connect(`/live?ticket=${ticket}`)).res.status).toBe(401); // 한 번만 쓴다
    expect((await SELF.fetch('https://net.test/live', { headers: { Origin: ORIGIN } })).status).toBe(426);
  });

  it('tells friends when someone comes online and goes offline, and lists online friends', async () => {
    const a = await signup(), b = await signup();
    await befriend(a, b);
    const aLive = await live(a);
    expect(aLive.hello.online).toEqual([]);
    const bLive = await live(b);
    expect(bLive.hello.online).toEqual([a.id]);
    expect(bLive.hello.user).toEqual({ id: b.id, nickname: b.nickname });
    expect(await aLive.until(m => m.t === 'online')).toEqual({ t: 'online', id: b.id });
    expect((await api('/friends', { token: a.token })).data.friends).toMatchObject([{ id: b.id, online: true }]);

    // 두 번째 기기는 다시 알리지 않고, 마지막 연결이 끊길 때만 offline
    const bPhone = await live(b);
    expect(await aLive.quiet()).toBeNull();
    bLive.close();
    expect(await aLive.quiet(200)).toBeNull();
    bPhone.close();
    expect(await aLive.until(m => m.t === 'offline')).toEqual({ t: 'offline', id: b.id });
    expect((await api('/friends', { token: a.token })).data.friends[0].online).toBe(false);
  });

  it('pushes friend requests and acceptances', async () => {
    const a = await signup(), b = await signup();
    const aLive = await live(a), bLive = await live(b);
    await api('/friends/requests', { method: 'POST', token: a.token, body: { nickname: b.nickname } });
    expect(await bLive.until(m => m.t === 'friend-request')).toEqual({ t: 'friend-request', from: { id: a.id, nickname: a.nickname } });
    await api(`/friends/requests/${a.id}/accept`, { method: 'POST', token: b.token });
    expect(await aLive.until(m => m.t === 'friend-accepted')).toEqual({ t: 'friend-accepted', friend: { id: b.id, nickname: b.nickname, online: true } });
    await api(`/friends/${a.id}`, { method: 'DELETE', token: b.token });
    expect(await aLive.until(m => m.t === 'friend-removed')).toEqual({ t: 'friend-removed', id: b.id });
  });
});

describe('game invites', () => {
  it('invite → both get the same hidden room code → both join that room and play', async () => {
    const a = await signup(), b = await signup();
    await befriend(a, b);
    const aLive = await live(a), bLive = await live(b);
    const sent = await api('/invites', { method: 'POST', token: a.token, body: { to: b.id, game } });
    expect(sent.status).toBe(201);
    const { invite } = await bLive.until(m => m.t === 'invite');
    expect(invite).toMatchObject({ id: sent.data.invite.id, from: { id: a.id, nickname: a.nickname }, game });
    expect(invite.expires - Date.now()).toBeGreaterThan(50_000);

    const accepted = await api(`/invites/${invite.id}/accept`, { method: 'POST', token: b.token });
    expect(accepted.status).toBe(200);
    const aRoom = await aLive.until(m => m.t === 'room');
    const bRoom = await bLive.until(m => m.t === 'room');
    expect(aRoom.code).toBe(bRoom.code);
    expect(accepted.data.code).toBe(aRoom.code);
    expect(aRoom).toMatchObject({ via: 'invite', invite: invite.id, game, opponent: { id: b.id } });
    expect(bRoom.opponent).toEqual({ id: a.id, nickname: a.nickname });

    // 초대로 만든 방은 두 사람만 (표가 있어야) 들어간다
    const outsider = await connect(`/rooms/${game}/${aRoom.code}`);
    expect(await outsider.next()).toEqual({ t: 'error', code: 'not-member', max: 2 });
    expect(await outsider.next()).toEqual({ t: '__closed', code: 4401 });
    const stranger = await signup();
    const intruder = await connect(`/rooms/${game}/${aRoom.code}?ticket=${await ticketFor(stranger)}`);
    expect((await intruder.next()).code).toBe('not-member');

    const p1 = await connect(`/rooms/${game}/${aRoom.code}?ticket=${await ticketFor(a)}`);
    expect((await p1.next()).t).toBe('welcome');
    const p2 = await connect(`/rooms/${game}/${aRoom.code}?ticket=${await ticketFor(b)}`);
    expect((await p2.next()).t).toBe('welcome');
    p2.send({ t: 'send', data: { t: 'drop', col: 3 } });
    expect(await p1.until(m => m.t === 'msg')).toEqual({ t: 'msg', from: 'p2', data: { t: 'drop', col: 3 } });
    // 같은 초대를 또 수락할 수는 없다
    expect((await api(`/invites/${invite.id}/accept`, { method: 'POST', token: b.token })).status).toBe(404);
  });

  it('decline, cancel, offline friend, non-friend and expiry', async () => {
    const a = await signup(), b = await signup(), c = await signup();
    await befriend(a, b);
    expect((await api('/invites', { method: 'POST', token: a.token, body: { to: b.id, game } })).data.error).toBe('offline');
    const aLive = await live(a), bLive = await live(b);
    await live(c);
    expect((await api('/invites', { method: 'POST', token: a.token, body: { to: c.id, game } })).data.error).toBe('not-friends');
    expect((await api('/invites', { method: 'POST', token: a.token, body: { to: b.id, game: 'Bad Game' } })).data.error).toBe('bad-game');

    let sent = await api('/invites', { method: 'POST', token: a.token, body: { to: b.id, game } });
    await bLive.until(m => m.t === 'invite');
    expect((await api(`/invites/${sent.data.invite.id}/accept`, { method: 'POST', token: c.token })).status).toBe(404); // 남의 초대
    await api(`/invites/${sent.data.invite.id}/decline`, { method: 'POST', token: b.token });
    expect(await aLive.until(m => m.t === 'invite-declined')).toMatchObject({ invite: sent.data.invite.id, by: { id: b.id } });

    sent = await api('/invites', { method: 'POST', token: a.token, body: { to: b.id, game } });
    await bLive.until(m => m.t === 'invite');
    await api(`/invites/${sent.data.invite.id}`, { method: 'DELETE', token: a.token });
    expect(await bLive.until(m => m.t === 'invite-canceled')).toEqual({ t: 'invite-canceled', invite: sent.data.invite.id });

    // 60초가 지난 초대
    sent = await api('/invites', { method: 'POST', token: a.token, body: { to: b.id, game } });
    const { runInDurableObject } = await import('cloudflare:test');
    await runInDurableObject(env.LOBBY.get(env.LOBBY.idFromName('lobby')), async (_i, state) => {
      const key = `invite:${sent.data.invite.id}`;
      await state.storage.put(key, { ...(await state.storage.get(key)), expires: Date.now() - 1 });
    });
    expect((await api(`/invites/${sent.data.invite.id}/accept`, { method: 'POST', token: b.token })).data.error).toBe('expired');
  });
});

describe('random matching', () => {
  const queue = async (user, g = game) => {
    const c = await connect(`/match/${g}?ticket=${await ticketFor(user)}`);
    return c;
  };

  it('pairs the first two people in line and gives both the same room and each other\'s profile', async () => {
    const g = 'match-fifo';
    const a = await signup(), b = await signup(), c = await signup();
    const qa = await queue(a, g);
    expect(await qa.next()).toEqual({ t: 'queued', game: g });
    const qb = await queue(b, g);
    const ma = await qa.until(m => m.t === 'matched');
    const mb = await qb.until(m => m.t === 'matched');
    expect(ma.code).toBe(mb.code);
    expect(ma.opponent).toEqual({ id: b.id, nickname: b.nickname });
    expect(mb.opponent).toEqual({ id: a.id, nickname: a.nickname });
    expect(await qa.until(m => m.t === '__closed')).toEqual({ t: '__closed', code: 1000 });
    // 세 번째 사람은 혼자 기다린다
    const qc = await queue(c, g);
    expect(await qc.next()).toEqual({ t: 'queued', game: g });
    // 둘 다 그 방에 들어가 논다
    const p1 = await connect(`/rooms/${g}/${ma.code}?ticket=${await ticketFor(a)}`); await p1.next();
    const p2 = await connect(`/rooms/${g}/${ma.code}?ticket=${await ticketFor(b)}`); await p2.next();
    p1.send({ t: 'send', data: { hi: 1 } });
    expect(await p2.until(m => m.t === 'msg')).toMatchObject({ data: { hi: 1 } });
    qc.close();
  });

  it('also tells /live about the match', async () => {
    const g = 'match-live';
    const a = await signup(), b = await signup();
    const aLive = await live(a);
    await queue(a, g);
    await queue(b, g);
    expect(await aLive.until(m => m.t === 'match')).toMatchObject({ game: g, opponent: { id: b.id } });
  });

  it('never pairs people who blocked each other, and skips suspended people', async () => {
    const g = 'match-block';
    const a = await signup(), b = await signup(), c = await signup(), s = await signup();
    await api(`/blocks/${a.id}`, { method: 'POST', token: b.token });
    const qa = await queue(a, g);
    await qa.next();
    const qb = await queue(b, g);
    expect(await qb.next()).toEqual({ t: 'queued', game: g }); // a 와 b 는 짝이 안 된다
    expect(await qa.quiet()).toBeNull();
    const qc = await queue(c, g); // c 는 먼저 온 a 와 짝
    expect((await qc.next()).opponent.id).toBe(a.id);
    expect((await qa.until(m => m.t === 'matched')).opponent.id).toBe(c.id);
    // 기다리는 사이 정지된 b 는 건너뛰고 내보낸다
    await env.DB.prepare('UPDATE users SET suspended_at = ? WHERE id = ?').bind(Date.now(), b.id).run();
    const qs = await queue(s, g);
    expect(await qs.next()).toEqual({ t: 'queued', game: g });
    expect(await qb.until(m => m.t === 'error')).toEqual({ t: 'error', code: 'suspended' });
    qs.close();
  });

  it('cancel and disconnect take you out of the line', async () => {
    const g = 'match-cancel';
    const a = await signup(), b = await signup(), c = await signup();
    const qa = await queue(a, g); await qa.next();
    qa.send({ t: 'cancel' });
    expect(await qa.next()).toEqual({ t: 'canceled' });
    const qb = await queue(b, g); await qb.next();
    qb.close();
    await new Promise(r => setTimeout(r, 50));
    const qc = await queue(c, g);
    expect(await qc.next()).toEqual({ t: 'queued', game: g });
    qc.close();
  });

  it('needs login', async () => {
    expect((await connect(`/match/${game}`)).res.status).toBe(401);
    expect((await connect('/match/Bad_Game?ticket=x')).res.status).toBe(400);
  });
});

describe('room chat', () => {
  it('masks bad words, phone numbers and links in data.chat, and leaves game data alone', async () => {
    const { data } = await api(`/rooms/${game}`, { method: 'POST', body: {} });
    const a = await connect(`/rooms/${game}/${data.code}`); await a.next();
    const b = await connect(`/rooms/${game}/${data.code}`); await b.next(); await a.next();
    b.send({ t: 'send', data: { chat: '야 시1발 010 1234 5678 www.evil.kr 와 ㅋㅋ', emoji: 3 } });
    expect(await a.next()).toEqual({ t: 'msg', from: 'p2', data: { chat: '야 *** *** **** **** *********** 와 ㅋㅋ', emoji: 3 } });
    // 채팅이 아닌 게임 데이터는 그대로 (욕처럼 보이는 글자가 있어도)
    b.send({ t: 'send', data: { t: 'board', cells: 'sibal010-1234-5678' } });
    expect(await a.next()).toEqual({ t: 'msg', from: 'p2', data: { t: 'board', cells: 'sibal010-1234-5678' } });
    b.send({ t: 'send', data: { chat: 42 } });
    expect(await b.next()).toEqual({ t: 'error', code: 'bad' });
    for (let i = 0; i < 8; i++) b.send({ t: 'send', data: { chat: `hi ${i}` } });
    expect(await b.until(m => m.t === 'error')).toEqual({ t: 'error', code: 'chat-rate' });
  });

  it('a report with the room code copies the room\'s own chat buffer, even after everyone left', async () => {
    const a = await signup(), b = await signup(), outsider = await signup();
    const g = 'chat-report';
    const qa = await connect(`/match/${g}?ticket=${await ticketFor(a)}`); await qa.next();
    const qb = await connect(`/match/${g}?ticket=${await ticketFor(b)}`);
    const { code } = await qb.until(m => m.t === 'matched');
    const p1 = await connect(`/rooms/${g}/${code}?ticket=${await ticketFor(a)}`); await p1.next();
    const p2 = await connect(`/rooms/${g}/${code}?ticket=${await ticketFor(b)}`); await p2.next();
    p2.send({ t: 'send', data: { chat: '병신아' } });
    await p1.until(m => m.t === 'msg');
    p1.send({ t: 'send', data: { chat: '그러지 마' } });
    await p2.until(m => m.t === 'msg');
    p1.close(); p2.close();
    await new Promise(r => setTimeout(r, 100));

    const res = await api('/reports', { method: 'POST', token: a.token, body: { target: b.id, context: { kind: 'room', game: g, room: code }, messages: [{ text: '아무 말' }] } });
    expect(res.status).toBe(201);
    const row = await env.DB.prepare('SELECT * FROM reports WHERE id = ?').bind(res.data.id).first();
    const evidence = JSON.parse(row.evidence);
    expect(evidence.lines.map(l => [l.uid, l.text])).toEqual([[b.id, '**아'], [a.id, '그러지 마']]);
    expect(evidence.targetWasThere).toBe(true);
    expect(JSON.parse(row.context)).toEqual({ kind: 'room', game: g, room: code });
    expect(JSON.parse(row.client_messages)).toEqual([{ text: '아무 말' }]);

    // 그 방에 없던 사람은 방 기록을 가져갈 수 없다
    const other = await api('/reports', { method: 'POST', token: outsider.token, body: { target: b.id, context: { kind: 'room', game: g, room: code } } });
    const otherRow = await env.DB.prepare('SELECT evidence FROM reports WHERE id = ?').bind(other.data.id).first();
    expect(JSON.parse(otherRow.evidence)).toEqual({ error: 'not-in-room' });
  });
});

describe('@inhyuk/net Account + Social against the real worker', () => {
  const options = () => ({
    server: 'wss://net.test', storage: memoryStorage(),
    fetch: (url, init) => SELF.fetch(url, { ...init, headers: { ...init.headers, Origin: ORIGIN, 'CF-Connecting-IP': `10.9.${(Math.random() * 255) | 0}.${(Math.random() * 255) | 0}` } }),
    connect: async url => {
      const res = await SELF.fetch(url.replace(/^wss:/, 'https:'), { headers: { Upgrade: 'websocket', Origin: ORIGIN } });
      if (!res.webSocket) throw new Error(`no websocket (${res.status})`);
      return res.webSocket;
    },
  });
  const waitFor = async (check, ms = 2000) => {
    const end = Date.now() + ms;
    while (!check()) { if (Date.now() > end) throw new Error('timed out'); await new Promise(r => setTimeout(r, 10)); }
  };
  const nick = p => `${p}${Math.random().toString(36).slice(2, 8)}`;

  it('signs up, befriends, chats, invites and finds a match without any room code', async () => {
    const accA = new Account(options()), accB = new Account(options());
    const userA = await accA.signup(nick('ca'), 'pass'), userB = await accB.signup(nick('cb'), 'pass');
    const seen = { a: [], b: [] };
    const a = new Social(accA, { event: m => seen.a.push(m) });
    const b = new Social(accB, { event: m => seen.b.push(m), invite: inv => b.pending = inv });
    await a.live(); await b.live();
    expect(a.status).toBe('online');

    expect((await a.search(userB.nickname)).map(u => u.id)).toEqual([userB.id]);
    await a.requestFriend(userB.nickname);
    await waitFor(() => seen.b.some(m => m.t === 'friend-request'));
    await b.acceptFriend(userA.id);
    await waitFor(() => a.onlineFriends.has(userB.id) || seen.a.some(m => m.t === 'friend-accepted'));
    expect((await a.friends()).map(f => [f.id, f.online])).toEqual([[userB.id, true]]);

    await a.sendDm(userB.id, '안녕 ㅅㅂ');
    await waitFor(() => seen.b.some(m => m.t === 'dm'));
    expect(seen.b.find(m => m.t === 'dm').message.body).toBe('안녕 **');

    // 초대: a 가 초대하고 b 가 수락하면 둘 다 같은 방에 들어가 있다
    const got = { a: [], b: [] };
    const inviting = a.invite(userB.id, 'client-social', { message: d => got.a.push(d) });
    await waitFor(() => b.pending);
    const joinedB = await b.acceptInvite(b.pending.id, { message: d => got.b.push(d) });
    const joinedA = await inviting;
    expect(joinedA.opponent.id).toBe(userB.id);
    expect(joinedB.opponent.id).toBe(userA.id);
    await waitFor(() => joinedA.room.status === 'connected');
    joinedB.room.chat('잘 부탁해 010-1111-2222');
    await waitFor(() => got.a.length === 1);
    expect(got.a[0]).toEqual({ chat: '잘 부탁해 *************' });
    joinedA.room.leave(); joinedB.room.leave();

    // 랜덤 매칭
    const queued = [];
    const findA = a.findMatch('client-match', {}, {}, { onQueued: () => queued.push('a') });
    await waitFor(() => queued.length === 1);
    const [ma, mb] = await Promise.all([findA, b.findMatch('client-match')]);
    expect(ma.opponent.id).toBe(userB.id);
    expect(mb.opponent.id).toBe(userA.id);
    expect(ma.room.code).toBe(mb.room.code);
    ma.room.leave(); mb.room.leave();

    // 취소하면 null
    const lonely = a.findMatch('client-lonely', {}, {}, { onQueued: () => a.cancelMatch() });
    expect(await lonely).toBeNull();
    a.close(); b.close();
    expect(a.status).toBe('offline');
  });

  it('remembers the login in storage and forgets it on logout', async () => {
    const opts = options();
    const acc = new Account(opts);
    const user = await acc.signup(nick('cs'), 'pass');
    const again = new Account(opts);
    expect(again.user).toEqual(user);
    expect((await again.me()).id).toBe(user.id);
    await again.logout();
    expect(new Account(opts).loggedIn).toBe(false);
    await expect(acc.me()).rejects.toMatchObject({ code: 'login-required' });
  });
});
