// 관리 페이지: 관리자 비밀번호 로그인, 신고 보기, 정지
import { describe, it, expect, beforeEach } from 'vitest';
import { SELF, env } from 'cloudflare:test';
import worker from '../src/index.js';
import { api, signup, befriend, live, connect, ticketFor, randomIp } from './helpers.js';
import { createRoom } from '../src/rooms.js';

const BASE = 'https://net.test';
const PASSWORD = env.ADMIN_PASSWORD; // vitest.config.js 의 miniflare bindings
const ADMIN_IP = '10.200.0.1';
const hex = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(b => b.toString(16).padStart(2, '0')).join('');

// token 은 net_admin 쿠키 값
const admin = (path, { token, method = 'GET', body, form, origin = BASE, ip = ADMIN_IP, headers = {} } = {}) => SELF.fetch(`${BASE}/admin${path}`, {
  method,
  redirect: 'manual',
  headers: {
    'CF-Connecting-IP': ip,
    ...(token ? { Cookie: `net_admin=${token}` } : {}),
    ...(method !== 'GET' && origin ? { Origin: origin } : {}),
    ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...headers,
  },
  body: form ? new URLSearchParams(form).toString() : body === undefined ? undefined : JSON.stringify(body),
});
const cookieToken = res => /net_admin=([^;]*)/.exec(res.headers.get('Set-Cookie') ?? '')?.[1] ?? '';

async function adminLogin(ip = ADMIN_IP) {
  const res = await admin('/login', { method: 'POST', body: { password: PASSWORD }, ip });
  if (res.status !== 200) throw Error(`admin login ${res.status}`);
  return cookieToken(res);
}

// 로그인 횟수 기록은 파일 안 시험끼리 공유되므로 시험마다 지운다.
beforeEach(async () => { await env.DB.prepare("DELETE FROM throttle WHERE key LIKE 'admin-login%'").run(); });

describe('admin password', () => {
  it('is closed (403) on every /admin route when ADMIN_PASSWORD is unset or shorter than 12', async () => {
    for (const ADMIN_PASSWORD of [undefined, '', 'short-pass1']) {
      for (const [method, path] of [['GET', ''], ['GET', '/api/reports'], ['POST', '/login'], ['POST', '/logout'], ['GET', '/nothing']]) {
        const req = new Request(`${BASE}/admin${path}`, { method, headers: { Origin: BASE, 'Content-Type': 'application/json' }, body: method === 'POST' ? JSON.stringify({ password: ADMIN_PASSWORD ?? '' }) : undefined });
        const res = await worker.fetch(req, { ...env, ADMIN_PASSWORD });
        expect(res.status, `${ADMIN_PASSWORD} ${path}`).toBe(403);
        const text = await res.text();
        expect(text).toContain('관리자 비밀번호가 설정되지 않았어요');
        expect(text).not.toContain('<form');
      }
    }
  });

  it('shows the login form without a session, with the strict headers', async () => {
    const page = await admin('');
    expect(page.status).toBe(200);
    expect(page.headers.get('Content-Type')).toContain('text/html');
    const html = await page.text();
    expect(html).toContain('action="/admin/login"');
    expect(html).toContain('type="password"');
    expect(html).not.toContain('신고');
    expect(html).not.toContain(PASSWORD);
    expect(page.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    expect(page.headers.get('X-Frame-Options')).toBe('DENY');
    expect(page.headers.get('Access-Control-Allow-Origin')).toBeNull();
    // 쿠키가 없거나 엉터리면 관리 API 는 401
    expect((await admin('/api/reports')).status).toBe(401);
    expect((await admin('/api/users?q=a', { token: 'x'.repeat(43) })).status).toBe(401);
    expect((await admin('/api/reports/1/dismiss', { method: 'POST', body: {} })).status).toBe(401);
  });

  it('refuses a wrong password with 401 and counts it', async () => {
    const ip = randomIp();
    const res = await admin('/login', { method: 'POST', body: { password: 'wrong-password-123' }, ip });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'wrong-password' });
    expect(res.headers.get('Set-Cookie')).toBeNull();
    const form = await admin('/login', { method: 'POST', form: { password: 'wrong-password-123' }, ip });
    expect(form.status).toBe(401);
    expect(await form.text()).toContain('비밀번호가 틀렸어요');
    const row = await env.DB.prepare('SELECT count(*) AS n FROM throttle WHERE key = ?').bind(`admin-login-ip:${ip}`).first();
    expect(row.n).toBe(2);
    // 비밀번호 앞부분만 맞거나 더 긴 것도 틀림
    expect((await admin('/login', { method: 'POST', body: { password: PASSWORD.slice(0, -1) }, ip })).status).toBe(401);
    expect((await admin('/login', { method: 'POST', body: { password: PASSWORD + 'x' }, ip })).status).toBe(401);
  });

  it('allows 5 failures per IP in 10 minutes, then 429 even with the right password', async () => {
    const ip = randomIp();
    for (let i = 0; i < 5; i++) expect((await admin('/login', { method: 'POST', body: { password: `nope-nope-nope-${i}` }, ip })).status).toBe(401);
    const blocked = await admin('/login', { method: 'POST', body: { password: PASSWORD }, ip });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Set-Cookie')).toBeNull();
    expect((await admin('/login', { method: 'POST', form: { password: PASSWORD }, ip })).status).toBe(429);
    // 다른 IP 는 아직 된다
    expect((await admin('/login', { method: 'POST', body: { password: PASSWORD }, ip: randomIp() })).status).toBe(200);
  });

  it('allows 20 failures per hour across all IPs, then 429 for everyone', async () => {
    for (let i = 0; i < 20; i++) expect((await admin('/login', { method: 'POST', body: { password: `nope-nope-nope-${i}` }, ip: randomIp() })).status).toBe(401);
    expect((await admin('/login', { method: 'POST', body: { password: PASSWORD }, ip: randomIp() })).status).toBe(429);
  });

  it('a good login clears that IP\'s failures', async () => {
    const ip = randomIp();
    for (let i = 0; i < 4; i++) await admin('/login', { method: 'POST', body: { password: 'nope-nope-nope' }, ip });
    await adminLogin(ip);
    const row = await env.DB.prepare('SELECT count(*) AS n FROM throttle WHERE key = ?').bind(`admin-login-ip:${ip}`).first();
    expect(row.n).toBe(0);
    for (let i = 0; i < 5; i++) expect((await admin('/login', { method: 'POST', body: { password: 'nope-nope-nope' }, ip })).status).toBe(401);
  });

  it('the right password sets a strict 12-hour cookie and opens the page and API', async () => {
    const res = await admin('/login', { method: 'POST', form: { password: PASSWORD } });
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe('/admin');
    const set = res.headers.get('Set-Cookie');
    expect(set).toMatch(/^net_admin=[A-Za-z0-9_-]{43}; /);
    for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/admin', 'Max-Age=43200']) expect(set).toContain(flag);
    const token = cookieToken(res);
    // D1 에는 토큰 원문이 없고 SHA-256 만 있다
    const row = await env.DB.prepare('SELECT * FROM admin_sessions WHERE token_hash = ?').bind(await hex(token)).first();
    expect(row).toMatchObject({ ip: ADMIN_IP, fingerprint: (await hex(PASSWORD)).slice(0, 16) });
    expect(row.expires - row.created).toBe(12 * 60 * 60 * 1000);
    expect(JSON.stringify(await env.DB.prepare('SELECT * FROM admin_sessions').all())).not.toContain(token);

    const page = await admin('', { token });
    expect(await page.text()).toContain('신고');
    const reports = await admin('/api/reports', { token });
    expect(reports.status).toBe(200);
    expect(Array.isArray((await reports.json()).reports)).toBe(true);
  });

  it('rejects an expired session', async () => {
    const token = await adminLogin();
    expect((await admin('/api/reports', { token })).status).toBe(200);
    await env.DB.prepare('UPDATE admin_sessions SET expires = ? WHERE token_hash = ?').bind(Date.now() - 1, await hex(token)).run();
    expect((await admin('/api/reports', { token })).status).toBe(401);
    expect(await (await admin('', { token })).text()).toContain('action="/admin/login"');
  });

  it('logout deletes the session and clears the cookie', async () => {
    const token = await adminLogin();
    const res = await admin('/logout', { method: 'POST', form: {}, token });
    expect(res.status).toBe(303);
    expect(res.headers.get('Set-Cookie')).toMatch(/^net_admin=; .*Max-Age=0/);
    expect((await admin('/api/reports', { token })).status).toBe(401);
    expect(await env.DB.prepare('SELECT 1 FROM admin_sessions WHERE token_hash = ?').bind(await hex(token)).first()).toBeNull();
  });

  it('changing ADMIN_PASSWORD logs out existing sessions', async () => {
    const token = await adminLogin();
    const req = () => new Request(`${BASE}/admin/api/reports`, { headers: { Cookie: `net_admin=${token}` } });
    expect((await worker.fetch(req(), env)).status).toBe(200);
    expect((await worker.fetch(req(), { ...env, ADMIN_PASSWORD: 'a-brand-new-password' })).status).toBe(401);
  });

  it('refuses cross-origin POSTs (login, logout, actions)', async () => {
    const token = await adminLogin();
    for (const origin of ['https://seonn.dev', 'null', '']) {
      expect((await admin('/login', { method: 'POST', body: { password: PASSWORD }, origin })).status, origin).toBe(403);
      expect((await admin('/logout', { method: 'POST', body: {}, token, origin })).status, origin).toBe(403);
      expect((await admin('/api/users/1/suspend', { method: 'POST', body: {}, token, origin })).status, origin).toBe(403);
    }
    expect((await admin('/api/reports', { token })).status).toBe(200); // 로그아웃되지 않았다
  });
});

describe('admin actions', () => {
  it('lists reports with evidence, suspends (kicking sessions and live sockets), unsuspends and dismisses', async () => {
    const token = await adminLogin();
    const a = await signup(), b = await signup(), c = await signup();
    await befriend(a, b);
    await api(`/dm/${a.id}`, { method: 'POST', token: b.token, body: { body: '바보 멍청이' } });
    const r1 = await api('/reports', { method: 'POST', token: a.token, body: { target: b.id, context: { kind: 'dm' }, reason: '나빠요' } });
    const r2 = await api('/reports', { method: 'POST', token: a.token, body: { target: c.id, context: { kind: 'profile' } } });

    const list = await (await admin('/api/reports', { token })).json();
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
    const audit = await env.DB.prepare('SELECT actor, ip, action FROM admin_actions WHERE target_id = ? ORDER BY id').bind(b.id).all();
    expect(audit.results).toEqual([{ actor: 'admin', ip: ADMIN_IP, action: 'suspend' }, { actor: 'admin', ip: ADMIN_IP, action: 'unsuspend' }]);
  });
});

describe('suspension reaches every connection', () => {
  it('closes the suspended user\'s live, room and match-queue sockets, and a room cannot be rejoined', async () => {
    const token = await adminLogin();
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
