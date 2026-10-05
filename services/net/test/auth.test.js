// 계정: 가입, 로그인, 정지, 횟수 제한
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { api, signup, uniqueNick, randomIp } from './helpers.js';
import { hashPassword, PBKDF2_ITERATIONS } from '../src/auth.js';

describe('accounts', () => {
  it('signs up, reads /me, logs in from another device, logs out', async () => {
    const nick = uniqueNick('Kid');
    const a = await signup(nick, 'abcd');
    expect(a.nickname).toBe(nick);
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const me = await api('/me', { token: a.token });
    expect(me.status).toBe(200);
    expect(me.data.user).toMatchObject({ id: a.id, nickname: nick });

    const second = await api('/auth/login', { method: 'POST', body: { nickname: nick.toLowerCase(), password: 'abcd' }, ip: randomIp() });
    expect(second.status).toBe(200);
    expect(second.data.user.id).toBe(a.id);
    expect(second.data.token).not.toBe(a.token);

    expect((await api('/auth/logout', { method: 'POST', token: a.token })).status).toBe(200);
    expect((await api('/me', { token: a.token })).status).toBe(401);
    expect((await api('/me', { token: second.data.token })).status).toBe(200); // 다른 기기는 그대로
  });

  it('stores only a salted PBKDF2 hash, never the password or the token', async () => {
    const a = await signup(uniqueNick(), 'secret12');
    const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(a.id).first();
    expect(row.iterations).toBe(PBKDF2_ITERATIONS);
    expect(JSON.stringify(row)).not.toContain('secret12');
    expect(row.pass_hash).toBe(await hashPassword('secret12', row.salt));
    const sessions = await env.DB.prepare('SELECT token_hash FROM sessions WHERE user_id = ?').bind(a.id).all();
    expect(sessions.results.map(s => s.token_hash)).not.toContain(a.token);
  });

  it('refuses a nickname that is already taken, ignoring upper/lower case', async () => {
    const nick = uniqueNick('Abc');
    await signup(nick);
    for (const other of [nick, nick.toUpperCase(), nick.toLowerCase()]) {
      const res = await api('/auth/signup', { method: 'POST', body: { nickname: other, password: 'pass' }, ip: randomIp() });
      expect(res.status, other).toBe(409);
      expect(res.data.error).toBe('nickname-taken');
    }
  });

  it('checks nickname and password rules', async () => {
    const cases = [
      [{ nickname: 'a', password: 'pass' }, 'bad-nickname'],
      [{ nickname: 'abcdefghijk', password: 'pass' }, 'bad-nickname'],
      [{ nickname: 'hi there', password: 'pass' }, 'bad-nickname'],
      [{ nickname: '<b>x</b>', password: 'pass' }, 'bad-nickname'],
      [{ nickname: '시발이', password: 'pass' }, 'bad-nickname-word'],
      [{ nickname: 'fuckboy', password: 'pass' }, 'bad-nickname-word'],
      [{ nickname: uniqueNick(), password: 'abc' }, 'bad-password'],
      [{ nickname: uniqueNick(), password: 'a'.repeat(17) }, 'bad-password'],
      [{ nickname: uniqueNick(), password: 1234 }, 'bad-password'],
    ];
    for (const [body, error] of cases) {
      const res = await api('/auth/signup', { method: 'POST', body, ip: randomIp() });
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.data.error).toBe(error);
    }
    // 한글, 영어, 숫자, 밑줄은 된다
    expect((await api('/auth/signup', { method: 'POST', body: { nickname: `인혁_${uniqueNick('').slice(0, 5)}`, password: 'pass' }, ip: randomIp() })).status).toBe(201);
  });

  it('rejects a wrong password and an unknown nickname the same way', async () => {
    const a = await signup();
    const wrong = await api('/auth/login', { method: 'POST', body: { nickname: a.nickname, password: 'nope' }, ip: randomIp() });
    const unknown = await api('/auth/login', { method: 'POST', body: { nickname: uniqueNick('zz'), password: 'nope' }, ip: randomIp() });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.data).toEqual(unknown.data);
  });

  it('locks out a nickname+IP after 10 failures in 10 minutes', async () => {
    const a = await signup();
    const ip = randomIp();
    for (let i = 0; i < 10; i++) {
      expect((await api('/auth/login', { method: 'POST', body: { nickname: a.nickname, password: `bad${i}` }, ip })).status).toBe(401);
    }
    const locked = await api('/auth/login', { method: 'POST', body: { nickname: a.nickname, password: a.password }, ip });
    expect(locked.status).toBe(429);
    // 다른 곳(IP)에서는 여전히 로그인된다
    expect((await api('/auth/login', { method: 'POST', body: { nickname: a.nickname, password: a.password }, ip: randomIp() })).status).toBe(200);
  });

  it('refuses login and every call for a suspended account', async () => {
    const a = await signup();
    await env.DB.prepare('UPDATE users SET suspended_at = ?, suspended_reason = ? WHERE id = ?').bind(Date.now(), '욕설', a.id).run();
    const login = await api('/auth/login', { method: 'POST', body: { nickname: a.nickname, password: a.password }, ip: randomIp() });
    expect(login.status).toBe(403);
    expect(login.data).toEqual({ error: 'suspended', reason: '욕설' });
    expect((await api('/me', { token: a.token })).status).toBe(403);
    expect((await api('/friends', { token: a.token })).status).toBe(403);
    expect((await api('/auth/ticket', { method: 'POST', token: a.token })).status).toBe(403);
  });

  it('needs a token, and the allowed origins, for the new endpoints', async () => {
    expect((await api('/me')).status).toBe(401);
    expect((await api('/me', { token: 'x'.repeat(43) })).status).toBe(401);
    expect((await api('/me', { origin: 'https://evil.example' })).status).toBe(403);
    expect((await api('/auth/signup', { method: 'POST', body: { nickname: uniqueNick(), password: 'pass' }, origin: '' })).status).toBe(403);
    const preflight = await api('/friends/requests/3/accept', { method: 'OPTIONS', origin: 'capacitor://localhost' });
    expect(preflight.status).toBe(204);
    expect(preflight.res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    expect((await api('/nope')).status).toBe(404);
    expect((await api('/me', { method: 'POST' })).status).toBe(405);
  });
});
