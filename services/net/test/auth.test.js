// 계정: 가입, 로그인, 정지, 횟수 제한
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { api, signup, befriend, uniqueNick, randomIp } from './helpers.js';
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

// POST /auth/delete: 내 계정 지우기 (비밀번호 확인, 모든 기록 삭제, 닉네임은 다시 쓸 수 있음)
describe('deleting my account', () => {
  const del = (user, password) => api('/auth/delete', { method: 'POST', token: user.token, body: password === undefined ? {} : { password } });
  const count = async (sql, ...binds) => (await env.DB.prepare(sql).bind(...binds).first()).n;

  it('needs a login and the right password, and leaves the account alone otherwise', async () => {
    const a = await signup(uniqueNick('Del'), 'abcd');
    expect((await api('/auth/delete', { method: 'POST', body: { password: 'abcd' } })).status).toBe(401);
    expect((await del(a)).status).toBe(400);
    const wrong = await del(a, 'nope');
    expect(wrong.status).toBe(403);
    expect(wrong.data.error).toBe('wrong-password');
    expect((await api('/me', { token: a.token })).status).toBe(200); // 틀려도 로그인은 그대로
    expect(await count('SELECT COUNT(*) AS n FROM users WHERE id = ?', a.id)).toBe(1);
  });

  it('removes the account and everything that belongs to it, on every device', async () => {
    const a = await signup(uniqueNick('Bye'), 'abcd'), b = await signup(), c = await signup();
    const other = await api('/auth/login', { method: 'POST', body: { nickname: a.nickname, password: 'abcd' }, ip: randomIp() });
    await befriend(a, b);
    await api('/friends/requests', { method: 'POST', token: c.token, body: { id: a.id } });
    await api(`/dm/${b.id}`, { method: 'POST', token: a.token, body: { body: '안녕' } });
    await api(`/dm/${a.id}`, { method: 'POST', token: b.token, body: { body: '잘 가' } });
    await api('/saves/jelly-tower', { method: 'PUT', token: a.token, body: { data: { level: 9 }, baseRevision: 0 } });
    await api('/stats/jelly-tower', { method: 'PUT', token: a.token, body: { level: 9, xp: 10, trophies: 3 } });
    await api('/reports', { method: 'POST', token: b.token, body: { target: a.id, context: { kind: 'profile' }, reason: 'test' } });
    await api(`/blocks/${a.id}`, { method: 'POST', token: c.token });

    const done = await del(a, 'abcd');
    expect(done.status).toBe(200);
    expect(done.data).toEqual({ ok: true });
    // 어느 기기에서도 로그인이 풀렸고, 같은 비밀번호로 다시 들어갈 수 없다
    expect((await api('/me', { token: a.token })).status).toBe(401);
    expect((await api('/me', { token: other.data.token })).status).toBe(401);
    expect((await api('/auth/login', { method: 'POST', body: { nickname: a.nickname, password: 'abcd' }, ip: randomIp() })).status).toBe(401);
    // 그 계정에 딸린 것이 하나도 남지 않는다
    for (const [table, where] of [['users', 'id = ?1'], ['sessions', 'user_id = ?1'], ['friends', 'user_id = ?1 OR friend_id = ?1'],
      ['friend_requests', 'from_id = ?1 OR to_id = ?1'], ['blocks', 'blocker_id = ?1 OR blocked_id = ?1'], ['dms', 'from_id = ?1 OR to_id = ?1'],
      ['reports', 'reporter_id = ?1 OR target_id = ?1'], ['saves', 'user_id = ?1'], ['player_stats', 'user_id = ?1']]) {
      expect(await count(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`, a.id), table).toBe(0);
    }
    // 친구였던 사람의 목록과 대화에서도 사라진다. 다른 사람의 계정은 그대로다.
    expect((await api('/friends', { token: b.token })).data.friends).toEqual([]);
    expect((await api('/dm', { token: b.token })).data.unread).toEqual([]);
    expect((await api('/me', { token: b.token })).status).toBe(200);
    expect((await api('/friends/requests', { token: c.token })).data.outgoing).toEqual([]);
    // 누가 지웠는지와 열려 있던 신고 수가 관리 기록에 남는다
    const log = await env.DB.prepare("SELECT * FROM admin_actions WHERE action = 'self-delete' AND target_id = ?").bind(a.id).first();
    expect(log.actor).toBe('user');
    expect(log.detail).toBe(`${a.nickname} (열려 있던 신고 1건)`);
    // 닉네임은 다시 쓸 수 있고, 새 계정은 빈 기록으로 시작한다
    const again = await signup(a.nickname, 'efgh');
    expect(again.id).not.toBe(a.id);
    expect((await api('/saves/jelly-tower', { token: again.token })).status).toBe(404);
    expect((await api('/friends', { token: again.token })).data.friends).toEqual([]);
  });

  it('cannot be used to escape a suspension, and wrong guesses are limited', async () => {
    const a = await signup(uniqueNick('Sus'), 'abcd');
    await env.DB.prepare('UPDATE users SET suspended_at = 1, suspended_reason = ? WHERE id = ?').bind('test', a.id).run();
    expect((await del(a, 'abcd')).status).toBe(403);
    expect(await count('SELECT COUNT(*) AS n FROM users WHERE id = ?', a.id)).toBe(1); // 정지된 계정은 그대로 남는다

    const b = await signup(uniqueNick('Lim'), 'abcd');
    for (let i = 0; i < 5; i++) expect((await del(b, 'wrong')).status).toBe(403);
    expect((await del(b, 'abcd')).status).toBe(429); // 5번 틀리면 잠깐 막힌다 (맞는 비밀번호도)
    expect(await count('SELECT COUNT(*) AS n FROM users WHERE id = ?', b.id)).toBe(1);
  });
});
