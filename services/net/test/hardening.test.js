// 리뷰에서 나온 문제들의 회귀 시험: 자리 하나, 거르개 우회, 몸 크기, 로그인 횟수, 닉네임, 정지, 매칭 경쟁, 검색, 차단
import { describe, it, expect } from 'vitest';
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { api, signup, befriend, live, connect, ticketFor, uniqueNick, randomIp, ORIGIN, BASE } from './helpers.js';
import { createRoom } from '../src/rooms.js';
import { pruneThrottle } from '../src/auth.js';

const memberRoom = (game, ...users) => createRoom(env, game, { maxPlayers: 2, members: users.map(u => u.id) });
const enter = async (game, code, user) => {
  const c = await connect(`/rooms/${game}/${code}?ticket=${await ticketFor(user)}`);
  c.welcome = await c.next();
  return c;
};
const matchStub = game => env.MATCH.get(env.MATCH.idFromName(game));

describe('1. one seat per account in a room', () => {
  it('a second connection from the same user replaces the first and keeps its peer id and host role', async () => {
    const g = 'seat-test';
    const a = await signup(), b = await signup();
    const code = await memberRoom(g, a, b);
    const first = await enter(g, code, a);
    expect(first.welcome).toMatchObject({ t: 'welcome', id: 'p1', host: 'p1' });
    const second = await enter(g, code, a);
    expect(second.welcome).toEqual({ t: 'welcome', id: 'p1', host: 'p1', max: 2, peers: [] });
    expect(await first.next()).toEqual({ t: 'error', code: 'replaced' });
    expect(await first.until(m => m.t === '__closed')).toEqual({ t: '__closed', code: 4409 });
    // 진짜 상대는 자리가 남아 있어 들어간다 (예전에는 'full')
    const other = await enter(g, code, b);
    expect(other.welcome).toEqual({ t: 'welcome', id: 'p2', host: 'p1', max: 2, peers: ['p1'] });
    expect(await second.next()).toEqual({ t: 'join', id: 'p2' });
    // 또 바꿔 끼우면 남은 사람은 rejoin 을 받고, 주고받기는 새 연결로 된다
    const third = await enter(g, code, a);
    expect(third.welcome).toMatchObject({ id: 'p1', peers: ['p2'] });
    expect(await other.next()).toEqual({ t: 'rejoin', id: 'p1' });
    third.send({ t: 'send', data: { t: 'sync' } });
    expect(await other.next()).toEqual({ t: 'msg', from: 'p1', data: { t: 'sync' } });
    expect(await second.until(m => m.t === '__closed')).toEqual({ t: '__closed', code: 4409 });
  });
});

describe('2. split phone numbers in room chat', () => {
  it('masks the later line that completes a phone number sent in pieces', async () => {
    const g = 'split-test';
    const a = await signup(), b = await signup();
    const code = await memberRoom(g, a, b);
    const p1 = await enter(g, code, a), p2 = await enter(g, code, b);
    await p1.next();
    const got = [];
    for (const line of ['010', '1234', '5678']) {
      p2.send({ t: 'send', data: { chat: line } });
      got.push((await p1.until(m => m.t === 'msg')).data.chat);
    }
    expect(got).toEqual(['010', '1234', '****']);
  });
});

describe('3. request body cap', () => {
  it('counts the bytes actually read, not Content-Length', async () => {
    const big = new TextEncoder().encode(JSON.stringify({ nickname: 'abc', password: 'x'.repeat(70 * 1024) }));
    const body = new ReadableStream({ start(c) { for (let i = 0; i < big.length; i += 8192) c.enqueue(big.slice(i, i + 8192)); c.close(); } });
    const res = await SELF.fetch(`${BASE}/auth/signup`, { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'too-big' });
  });

  it('keeps only {text} strings from the reporter\'s messages', async () => {
    const a = await signup(), b = await signup();
    const res = await api('/reports', { method: 'POST', token: a.token, body: {
      target: b.id, context: { kind: 'profile' },
      messages: ['plain', { text: '글', uid: 99, evil: { deep: 'x'.repeat(5000) } }, { nope: 1 }, 42, null, { text: '가'.repeat(400) }],
    } });
    expect(res.status).toBe(201);
    const row = await env.DB.prepare('SELECT client_messages FROM reports WHERE id = ?').bind(res.data.id).first();
    expect(JSON.parse(row.client_messages)).toEqual([{ text: 'plain' }, { text: '글' }, { text: '가'.repeat(300) }]);
  });
});

describe('4. every string a peer relays in a member room is filtered', () => {
  it('masks names and other strings anywhere in data, keys included; numbers stay', async () => {
    const g = 'peer-strings';
    const a = await signup(), b = await signup();
    const code = await memberRoom(g, a, b);
    const p1 = await enter(g, code, a), p2 = await enter(g, code, b);
    await p1.next();
    p2.send({ t: 'send', data: { t: 'hello', name: '시발', deep: { list: ['010-1234-5678', 7], 'naver.com': true }, score: 12345678 } });
    expect((await p1.until(m => m.t === 'msg')).data).toEqual({ t: 'hello', name: '**', deep: { list: ['*************', 7], '*********': true }, score: 12345678 });
    p2.send({ t: 'send', data: ['카톡 아이디 abc123'] });
    expect((await p1.until(m => m.t === 'msg')).data).toEqual(['** *** ******']);
    // 너무 깊은 것은 거절
    let deep = 'x';
    for (let i = 0; i < 12; i++) deep = [deep];
    p2.send({ t: 'send', data: deep });
    expect(await p2.until(m => m.t === 'error')).toEqual({ t: 'error', code: 'bad' });
  });
});

describe('5. login and rate limits count before the work', () => {
  it('parallel wrong logins from one nickname+IP: at most 10 get to check the password', async () => {
    const a = await signup();
    const ip = randomIp();
    const results = await Promise.all(Array.from({ length: 16 }, (_, i) =>
      api('/auth/login', { method: 'POST', body: { nickname: a.nickname, password: `bad${i}` }, ip })));
    const statuses = results.map(r => r.status);
    expect(statuses.filter(s => s === 401).length).toBeLessThanOrEqual(10);
    expect(statuses.filter(s => s === 429).length).toBeGreaterThanOrEqual(6);
  });

  it('caps failures per nickname across all IPs (30 an hour)', async () => {
    const a = await signup();
    for (let i = 0; i < 30; i++) {
      expect((await api('/auth/login', { method: 'POST', body: { nickname: a.nickname, password: `bad${i}` }, ip: randomIp() })).status).toBe(401);
    }
    const locked = await api('/auth/login', { method: 'POST', body: { nickname: a.nickname, password: a.password }, ip: randomIp() });
    expect(locked.status).toBe(429);
  }, 20000);

  it('a successful login does not count as a failure', async () => {
    const a = await signup();
    const ip = randomIp();
    for (let i = 0; i < 12; i++) expect((await api('/auth/login', { method: 'POST', body: { nickname: a.nickname, password: a.password }, ip })).status).toBe(200);
  });

  it('old throttle rows are cleaned up', async () => {
    const key = `old-test:${Math.random()}`;
    await env.DB.prepare('INSERT INTO throttle (key, at) VALUES (?, ?), (?, ?)').bind(key, Date.now() - 2 * 24 * 60 * 60 * 1000, key, Date.now()).run();
    await pruneThrottle(env);
    const { n } = await env.DB.prepare('SELECT count(*) AS n FROM throttle WHERE key = ?').bind(key).first();
    expect(n).toBe(1);
  });
});

describe('6. nicknames cannot carry contact details', () => {
  it('rejects phone numbers, messenger ids, links and 7+ digits', async () => {
    for (const nickname of ['카톡abc123', '공일공일이삼사오육', 'a1234567', '0101234567', '인스타_kid']) {
      const res = await api('/auth/signup', { method: 'POST', body: { nickname, password: 'pass' }, ip: randomIp() });
      expect(res.status, nickname).toBe(400);
      expect(res.data.error, nickname).toBe('bad-nickname-word');
    }
  });
});

describe('8. random matching races', () => {
  it('if one side cancels while the room is being made, the other is not told "matched" and stays first in line', async () => {
    const g = 'race-cancel';
    const a = await signup(), b = await signup(), c = await signup();
    const qa = await connect(`/match/${g}?ticket=${await ticketFor(a)}`);
    expect(await qa.next()).toEqual({ t: 'queued', game: g });
    // 방을 만드는 사이에 a 가 취소한 것처럼 만든다
    await runInDurableObject(matchStub(g), instance => {
      const original = instance.makeRoom.bind(instance);
      instance.makeRoom = async (...args) => {
        for (const ws of instance.ctx.getWebSockets()) if (ws.deserializeAttachment()?.uid === a.id) instance.finish(ws, { t: 'canceled' }, 1000, 'cancel');
        instance.makeRoom = original;
        return original(...args);
      };
    });
    const qb = await connect(`/match/${g}?ticket=${await ticketFor(b)}`);
    expect(await qb.next()).toEqual({ t: 'queued', game: g }); // matched 가 아니다
    expect(await qa.next()).toEqual({ t: 'canceled' });
    expect(await qa.until(m => m.t !== 'matched')).toEqual({ t: '__closed', code: 1000 });
    const qc = await connect(`/match/${g}?ticket=${await ticketFor(c)}`);
    expect((await qc.next()).opponent.id).toBe(b.id);
    expect((await qb.next()).opponent.id).toBe(c.id);
  });

  it('if the newcomer leaves while the room is being made, the waiting person keeps waiting', async () => {
    const g = 'race-leave';
    const a = await signup(), b = await signup(), c = await signup();
    const qa = await connect(`/match/${g}?ticket=${await ticketFor(a)}`);
    await qa.next();
    await runInDurableObject(matchStub(g), instance => {
      const original = instance.makeRoom.bind(instance);
      instance.makeRoom = async (...args) => {
        for (const ws of instance.ctx.getWebSockets()) if (ws.deserializeAttachment()?.uid === b.id) instance.finish(ws, null, 1000, 'closed');
        instance.makeRoom = original;
        return original(...args);
      };
    });
    await connect(`/match/${g}?ticket=${await ticketFor(b)}`);
    expect(await qa.quiet(300)).toBeNull();
    const qc = await connect(`/match/${g}?ticket=${await ticketFor(c)}`);
    expect((await qc.next()).opponent.id).toBe(a.id);
    expect((await qa.next()).opponent.id).toBe(c.id);
  });

  it('the same user on two devices is in line once and never matched with themselves', async () => {
    const g = 'race-devices';
    const a = await signup(), b = await signup();
    const phone = await connect(`/match/${g}?ticket=${await ticketFor(a)}`);
    expect(await phone.next()).toEqual({ t: 'queued', game: g });
    const tablet = await connect(`/match/${g}?ticket=${await ticketFor(a)}`);
    expect(await phone.next()).toEqual({ t: 'replaced' });
    expect(await tablet.next()).toEqual({ t: 'queued', game: g });
    const qb = await connect(`/match/${g}?ticket=${await ticketFor(b)}`);
    const mb = await qb.next();
    expect(mb.opponent.id).toBe(a.id);
    expect((await tablet.next()).opponent.id).toBe(b.id);
    expect(await phone.until(m => m.t === '__closed')).toEqual({ t: '__closed', code: 4409 });
    const waiting = await runInDurableObject(matchStub(g), instance => instance.waiting().length);
    expect(waiting).toBe(0);
  });
});

describe('10. search', () => {
  it('needs two characters and is limited to 30 a minute', async () => {
    const me = await signup();
    expect((await api('/users/search?q=a', { token: me.token })).data).toEqual({ users: [] });
    const statuses = [];
    for (let i = 0; i < 31; i++) statuses.push((await api('/users/search?q=zz', { token: me.token })).status);
    expect(statuses.slice(0, 30).every(s => s === 200)).toBe(true);
    expect(statuses[30]).toBe(429);
  });
});

describe('11. smaller fixes', () => {
  it('limits room creation per IP', async () => {
    const ip = randomIp();
    const statuses = [];
    for (let i = 0; i < 61; i++) statuses.push((await api('/rooms/limit-test', { method: 'POST', body: {}, ip })).status);
    expect(statuses.filter(s => s === 200).length).toBe(60);
    expect(statuses.at(-1)).toBe(429);
    expect((await api('/rooms/limit-test', { method: 'POST', body: {}, ip: randomIp() })).status).toBe(200);
  }, 20000);

  it('stores the report reason as written (only admins see it)', async () => {
    const a = await signup(), b = await signup();
    const res = await api('/reports', { method: 'POST', token: a.token, body: { target: b.id, reason: '010-1234-5678 로 연락하래요 시발' } });
    const row = await env.DB.prepare('SELECT reason FROM reports WHERE id = ?').bind(res.data.id).first();
    expect(row.reason).toBe('010-1234-5678 로 연락하래요 시발');
  });
});

describe('12. block, admin scope', () => {
  it('DM and invite right after a block are refused both ways', async () => {
    const a = await signup(), b = await signup();
    await befriend(a, b);
    await live(a); await live(b);
    await api(`/blocks/${a.id}`, { method: 'POST', token: b.token });
    expect((await api(`/dm/${b.id}`, { method: 'POST', token: a.token, body: { body: 'hi' } })).data.error).toBe('not-friends');
    expect((await api(`/dm/${a.id}`, { method: 'POST', token: b.token, body: { body: 'hi' } })).data.error).toBe('blocked');
    const inviteAB = await api('/invites', { method: 'POST', token: a.token, body: { to: b.id, game: 'block-test' } });
    const inviteBA = await api('/invites', { method: 'POST', token: b.token, body: { to: a.id, game: 'block-test' } });
    expect([inviteAB.status, inviteAB.data.error]).toEqual([404, 'not-found']);
    expect([inviteBA.status, inviteBA.data.error]).toEqual([404, 'not-found']);
  });

  it('game APIs work without any admin password or cookie; only /admin needs it', async () => {
    const res = await SELF.fetch(`${BASE}/auth/signup`, { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: uniqueNick('acc'), password: 'pass' }) });
    expect(res.status).toBe(201);
    const { token } = await res.json();
    expect((await SELF.fetch(`${BASE}/me`, { headers: { Origin: ORIGIN, Authorization: `Bearer ${token}` } })).status).toBe(200);
    expect((await SELF.fetch(`${BASE}/rooms/access-test`, { method: 'POST', headers: { Origin: ORIGIN } })).status).toBe(200);
    expect((await SELF.fetch(`${BASE}/`)).status).toBe(200);
    // 관리 페이지는 로그인 화면만 보이고, 관리 API 는 401
    for (const path of ['/admin', '/admin/']) {
      const page = await SELF.fetch(`${BASE}${path}`, { headers: { Origin: ORIGIN } });
      expect(page.status, path).toBe(200);
      expect(await page.text(), path).toContain('action="/admin/login"');
    }
    for (const path of ['/admin/api/reports', '/admin/api/users?q=a']) {
      expect((await SELF.fetch(`${BASE}${path}`, { headers: { Origin: ORIGIN } })).status, path).toBe(401);
    }
  });
});
