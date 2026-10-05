// 게임 저장(클라우드 세이브): 만들기, revision 맞춰 고치기, 충돌, importId, 크기, 남의 저장, 로그인
import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';
import { api, signup, ORIGIN, BASE } from './helpers.js';
import { Account, Social, memoryStorage } from '../../../packages/net/index.mjs';

const game = 'jelly-tower';
const put = (user, body, g = game) => api(`/saves/${g}`, { method: 'PUT', token: user.token, body });
const get = (user, g = game) => api(`/saves/${g}`, { token: user.token });

describe('cloud saves', () => {
  it('creates a save, reads it back, and updates it with the right revision', async () => {
    const a = await signup();
    expect(await get(a)).toMatchObject({ status: 404, data: { error: 'no-save' } });
    const first = await put(a, { data: { level: 3, coins: 120 }, baseRevision: 0 });
    expect(first.status).toBe(200);
    expect(first.data.revision).toBe(1);
    expect(typeof first.data.updated).toBe('number');
    expect((await get(a)).data).toEqual({ data: { level: 3, coins: 120 }, revision: 1, updated: first.data.updated });
    const second = await put(a, { data: { level: 4, coins: 80 }, baseRevision: 1 });
    expect(second.data.revision).toBe(2);
    expect((await get(a)).data.data).toEqual({ level: 4, coins: 80 });
    // null 도 "아직 없음" 으로 본다: 이미 있으므로 충돌
    expect((await put(a, { data: { level: 1 }, baseRevision: null })).status).toBe(409);
  });

  it('refuses a stale revision with 409 and the server copy, without merging', async () => {
    const a = await signup();
    await put(a, { data: { level: 5, coins: 500 }, baseRevision: 0 });
    await put(a, { data: { level: 6, coins: 10 }, baseRevision: 1 }); // 다른 기기가 먼저 고침
    const stale = await put(a, { data: { level: 5, coins: 900 }, baseRevision: 1 });
    expect(stale.status).toBe(409);
    expect(stale.data).toEqual({ error: 'conflict', data: { level: 6, coins: 10 }, revision: 2, updated: expect.any(Number) });
    expect((await get(a)).data.data).toEqual({ level: 6, coins: 10 }); // 코인을 더 큰 값으로 합치지 않는다
    // 저장이 없는데 baseRevision 이 있으면 충돌 (서버 쪽은 없음)
    const b = await signup();
    expect((await put(b, { data: { x: 1 }, baseRevision: 3 })).data).toEqual({ error: 'conflict', data: null, revision: 0, updated: null });
  });

  it('applies an importId only once', async () => {
    const a = await signup();
    const importId = 'device-local-0001';
    const first = await put(a, { data: { level: 2 }, baseRevision: 0, importId });
    expect(first.data).toEqual({ revision: 1, updated: expect.any(Number) });
    const again = await put(a, { data: { level: 2 }, baseRevision: 0, importId });
    expect(again.status).toBe(200);
    expect(again.data).toEqual({ revision: 1, updated: first.data.updated, duplicate: true });
    expect((await get(a)).data.revision).toBe(1);
    // 충돌로 쓰지 못한 importId 는 기록하지 않는다
    const b = await signup();
    await put(b, { data: { level: 9 }, baseRevision: 0 });
    expect((await put(b, { data: { level: 1 }, baseRevision: 0, importId })).status).toBe(409);
    expect((await put(b, { data: { level: 1 }, baseRevision: 1, importId })).data).toEqual({ revision: 2, updated: expect.any(Number) });
    expect((await put(a, { data: {}, baseRevision: 0, importId: 'bad id!' })).data.error).toBe('bad-import');
  });

  it('checks size, shape and game name', async () => {
    const a = await signup();
    expect((await put(a, { data: { blob: 'x'.repeat(33 * 1024) }, baseRevision: 0 })).status).toBe(413);
    expect((await put(a, { data: { blob: 'x'.repeat(31 * 1024) }, baseRevision: 0 })).status).toBe(200);
    for (const data of [[1, 2], 'text', 5, null, undefined]) {
      expect((await put(a, { data, baseRevision: 0 }, 'shape-test')).data.error, JSON.stringify(data)).toBe('bad-save');
    }
    expect((await put(a, { data: {}, baseRevision: -1 }, 'shape-test')).data.error).toBe('bad-revision');
    expect((await put(a, { data: {}, baseRevision: 0 }, 'Bad_Game')).data.error).toBe('bad-game');
    expect((await get(a, 'Bad_Game')).status).toBe(400);
  });

  it('keeps each user\'s save to themselves', async () => {
    const a = await signup(), b = await signup();
    await put(a, { data: { secret: 1 }, baseRevision: 0 });
    expect((await get(b)).status).toBe(404);
    // b 가 같은 게임에 쓰면 b 의 것이 따로 생긴다
    await put(b, { data: { mine: 2 }, baseRevision: 0 });
    expect((await get(a)).data.data).toEqual({ secret: 1 });
    expect((await get(b)).data.data).toEqual({ mine: 2 });
  });

  it('needs login, refuses suspended accounts, and limits writes to 30 a minute', async () => {
    expect((await api(`/saves/${game}`)).status).toBe(401);
    expect((await api(`/saves/${game}`, { method: 'PUT', body: { data: {}, baseRevision: 0 } })).status).toBe(401);
    const a = await signup();
    const statuses = [];
    for (let i = 0; i < 31; i++) statuses.push((await put(a, { data: { i }, baseRevision: i }, 'rate-test')).status);
    expect(statuses.slice(0, 30).every(s => s === 200)).toBe(true);
    expect(statuses[30]).toBe(429);
    const { env } = await import('cloudflare:test');
    await env.DB.prepare('UPDATE users SET suspended_at = ? WHERE id = ?').bind(Date.now(), a.id).run();
    expect((await get(a, 'rate-test')).status).toBe(403);
    // PUT 은 CORS 사전 요청에서도 허용된다
    const preflight = await SELF.fetch(`${BASE}/saves/${game}`, { method: 'OPTIONS', headers: { Origin: ORIGIN } });
    expect(preflight.headers.get('Access-Control-Allow-Methods')).toContain('PUT');
  });

  it('works through the client library', async () => {
    const options = {
      server: 'wss://net.test', storage: memoryStorage(),
      fetch: (url, init) => SELF.fetch(url, { ...init, headers: { ...init.headers, Origin: ORIGIN, 'CF-Connecting-IP': `10.8.${(Math.random() * 255) | 0}.${(Math.random() * 255) | 0}` } }),
    };
    const account = new Account(options);
    await account.signup(`sv${Math.random().toString(36).slice(2, 8)}`, 'pass');
    const social = new Social(account);
    expect(await account.loadSave(game)).toBeNull();
    const created = await account.putSave(game, { level: 1 }, 0, { importId: 'phone-import-1' });
    expect(created).toMatchObject({ ok: true, revision: 1 });
    expect(await account.putSave(game, { level: 1 }, 0, { importId: 'phone-import-1' })).toMatchObject({ ok: true, revision: 1, duplicate: true });
    expect(await social.putSave(game, { level: 2 }, 1)).toMatchObject({ ok: true, revision: 2 });
    const conflict = await account.putSave(game, { level: 9 }, 1);
    expect(conflict).toEqual({ conflict: true, server: { data: { level: 2 }, revision: 2, updated: expect.any(Number) } });
    expect(await social.loadSave(game)).toMatchObject({ data: { level: 2 }, revision: 2 });
  });
});
