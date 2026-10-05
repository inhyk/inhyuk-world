// 관리 페이지: Cloudflare Access JWT 검사, 신고 보기, 정지
import { describe, it, expect, vi } from 'vitest';
import { SELF, env } from 'cloudflare:test';
import worker from '../src/index.js';
import { api, signup, befriend, live, connect, ticketFor, randomIp } from './helpers.js';
import { createRoom } from '../src/rooms.js';
import { verifyAccessJwt } from '../src/admin.js';

const TEAM = 'test-team.cloudflareaccess.com';
const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const text = obj => b64url(new TextEncoder().encode(JSON.stringify(obj)));

async function jwt(claims = {}, { kid = 'test-kid', alg = 'RS256', jwk = env.TEST_ACCESS_PRIVATE_JWK } = {}) {
  const t = Math.floor(Date.now() / 1000);
  const payload = { iss: `https://${TEAM}`, aud: ['test-aud'], email: 'kubony@gmail.com', iat: t, nbf: t, exp: t + 600, ...claims };
  const head = `${text({ alg, kid, typ: 'JWT' })}.${text(payload)}`;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  return `${head}.${b64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(head)))}`;
}

const admin = (path, { token, method = 'GET', body, origin = 'https://net.test' } = {}) => SELF.fetch(`https://net.test/admin${path}`, {
  method,
  headers: { ...(token ? { 'Cf-Access-Jwt-Assertion': token } : {}), ...(method !== 'GET' ? { Origin: origin, 'Content-Type': 'application/json' } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body),
});

describe('admin access', () => {
  it('is closed without a valid Access JWT', async () => {
    expect((await admin('')).status).toBe(403);
    expect((await admin('/api/reports')).status).toBe(403);
    expect((await admin('/api/reports', { token: 'not.a.jwt' })).status).toBe(403);
    // 다른 키로 서명, 잘못된 aud, iss, 만료, 관리자 아닌 이메일, 다른 알고리즘
    const other = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign']);
    const forged = await jwt({}, { jwk: await crypto.subtle.exportKey('jwk', other.privateKey) });
    for (const token of [
      forged,
      await jwt({ aud: ['other-aud'] }),
      await jwt({ iss: 'https://evil.cloudflareaccess.com' }),
      await jwt({ exp: Math.floor(Date.now() / 1000) - 10 }),
      await jwt({ email: 'someone@example.com' }),
      await jwt({}, { kid: 'unknown-kid' }),
      await jwt({}, { alg: 'HS256' }),
    ]) {
      expect((await admin('/api/reports', { token })).status).toBe(403);
    }
  });

  it('stays closed when the Access settings are missing, even with a good token', async () => {
    const token = await jwt();
    for (const missing of ['ACCESS_TEAM_DOMAIN', 'ACCESS_AUD', 'ADMIN_EMAILS']) {
      const res = await worker.fetch(new Request('https://net.test/admin/api/reports', { headers: { 'Cf-Access-Jwt-Assertion': token } }), { ...env, [missing]: '' });
      expect(res.status, missing).toBe(403);
    }
    const ok = await worker.fetch(new Request('https://net.test/admin/api/reports', { headers: { 'Cf-Access-Jwt-Assertion': token } }), env);
    expect(ok.status).toBe(200);
  });

  it('serves the page and refuses cross-site writes', async () => {
    const token = await jwt();
    const page = await admin('', { token });
    expect(page.status).toBe(200);
    expect(page.headers.get('Content-Type')).toContain('text/html');
    expect(await page.text()).toContain('net 관리');
    expect(page.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect((await admin('/api/users/1/suspend', { token, method: 'POST', body: {}, origin: 'https://seonn.dev' })).status).toBe(403);
  });
});

describe('admin actions', () => {
  it('lists reports with evidence, suspends (kicking sessions and live sockets), unsuspends and dismisses', async () => {
    const token = await jwt();
    const a = await signup(), b = await signup(), c = await signup();
    await befriend(a, b);
    await api(`/dm/${a.id}`, { method: 'POST', token: b.token, body: { body: '바보 멍청이' } });
    const r1 = await api('/reports', { method: 'POST', token: a.token, body: { target: b.id, context: { kind: 'dm' }, reason: '나빠요' } });
    const r2 = await api('/reports', { method: 'POST', token: a.token, body: { target: c.id, context: { kind: 'profile' } } });

    const list = await (await admin('/api/reports', { token })).json();
    expect(list.email).toBe('kubony@gmail.com');
    const report = list.reports.find(r => r.id === r1.data.id);
    expect(report).toMatchObject({ reporter: { id: a.id }, target: { id: b.id, suspended: false }, context: { kind: 'dm' }, reason: '나빠요' });
    expect(report.evidence.messages.map(m => m.body)).toEqual(['바보 멍청이']);

    const users = await (await admin(`/api/users?q=${b.nickname}`, { token })).json();
    expect(users.users[0]).toMatchObject({ id: b.id, reports: 1 });

    const bLive = await live(b);
    const aLive = await live(a);
    expect((await admin(`/api/users/${b.id}/suspend`, { token, method: 'POST', body: { reason: '욕설' } })).status).toBe(200);
    expect(await bLive.until(m => m.t === 'kicked')).toEqual({ t: 'kicked', reason: 'suspended' });
    expect(await bLive.until(m => m.t === '__closed')).toEqual({ t: '__closed', code: 4403 });
    expect(await aLive.until(m => m.t === 'offline')).toEqual({ t: 'offline', id: b.id });
    expect((await api('/me', { token: b.token })).status).toBe(401); // 로그인이 모두 풀렸다
    const login = await api('/auth/login', { method: 'POST', body: { nickname: b.nickname, password: b.password }, ip: randomIp() });
    expect(login.data).toEqual({ error: 'suspended', reason: '욕설' });
    expect((await api(`/users/search?q=${b.nickname}`, { token: a.token })).data.users).toEqual([]);

    const actioned = await (await admin('/api/reports?status=actioned', { token })).json();
    expect(actioned.reports.map(r => r.id)).toContain(r1.data.id);

    await admin(`/api/reports/${r2.data.id}/dismiss`, { token, method: 'POST', body: {} });
    const open = await (await admin('/api/reports', { token })).json();
    expect(open.reports.map(r => r.id)).not.toContain(r2.data.id);

    expect((await admin(`/api/users/${b.id}/unsuspend`, { token, method: 'POST', body: {} })).status).toBe(200);
    expect((await api('/auth/login', { method: 'POST', body: { nickname: b.nickname, password: b.password }, ip: randomIp() })).status).toBe(200);
    const audit = await env.DB.prepare('SELECT action FROM admin_actions WHERE target_id = ? ORDER BY id').bind(b.id).all();
    expect(audit.results.map(r => r.action)).toEqual(['suspend', 'unsuspend']);
  });
});

describe('suspension reaches every connection', () => {
  it('closes the suspended user\'s live, room and match-queue sockets, and a room cannot be rejoined', async () => {
    const token = await jwt();
    const bad = await signup(), friend = await signup();
    const g = 'suspend-room';
    const code = await createRoom(env, g, { maxPlayers: 2, members: [bad.id, friend.id] });
    const badLive = await live(bad);
    const roomBad = await connect(`/rooms/${g}/${code}?ticket=${await ticketFor(bad)}`); await roomBad.next();
    const roomFriend = await connect(`/rooms/${g}/${code}?ticket=${await ticketFor(friend)}`); await roomFriend.next();
    const queue = await connect(`/match/suspend-queue?ticket=${await ticketFor(bad)}`);
    expect(await queue.next()).toEqual({ t: 'queued', game: 'suspend-queue' });
    const spare = await ticketFor(bad); // 정지 전에 받아 둔 표

    expect((await admin(`/api/users/${bad.id}/suspend`, { token, method: 'POST', body: { reason: '욕설' } })).status).toBe(200);
    expect(await badLive.until(m => m.t === '__closed')).toEqual({ t: '__closed', code: 4403 });
    expect(await roomBad.until(m => m.t === 'error')).toEqual({ t: 'error', code: 'suspended' });
    expect(await roomBad.until(m => m.t === '__closed')).toEqual({ t: '__closed', code: 4403 });
    expect(await roomFriend.until(m => m.t === 'leave')).toEqual({ t: 'leave', id: 'p1' });
    expect(await queue.until(m => m.t === 'error')).toEqual({ t: 'error', code: 'suspended' });
    expect(await queue.until(m => m.t === '__closed')).toEqual({ t: '__closed', code: 4403 });
    // 다시 들어올 수 없다: 받아 둔 표는 지워졌고, 새 표는 받을 수 없다
    expect((await connect(`/rooms/${g}/${code}?ticket=${spare}`)).res.status).toBe(401);
    expect((await api('/auth/ticket', { method: 'POST', token: bad.token })).status).toBe(401);
    await admin(`/api/users/${bad.id}/unsuspend`, { token, method: 'POST', body: {} });
  });
});

describe('Access public keys', () => {
  it('refetches the keys at most once a minute for unknown key ids', async () => {
    expect(await verifyAccessJwt(await jwt(), env)).toBe('kubony@gmail.com'); // 키를 받아 둔다
    const spy = vi.spyOn(globalThis, 'fetch');
    try {
      for (let i = 0; i < 5; i++) expect(await verifyAccessJwt(await jwt({}, { kid: `unknown-${i}` }), env)).toBe('');
      expect(spy.mock.calls.length).toBeLessThanOrEqual(1);
    } finally { spy.mockRestore(); }
  });
});
