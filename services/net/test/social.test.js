// 친구, 검색, 차단, 1:1 대화, 신고
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { api, signup, befriend, live, uniqueNick } from './helpers.js';

describe('friends', () => {
  it('searches by nickname prefix, excluding me and people I blocked or who blocked me', async () => {
    const prefix = uniqueNick('S').slice(0, 6);
    const me = await signup(`${prefix}me`);
    const a = await signup(`${prefix}aa`);
    const b = await signup(`${prefix}bb`);
    const c = await signup(`${prefix}cc`);
    let res = await api(`/users/search?q=${prefix.toLowerCase()}`, { token: me.token });
    expect(res.status).toBe(200);
    expect(res.data.users.map(u => u.nickname).sort()).toEqual([a.nickname, b.nickname, c.nickname].sort());
    await api(`/blocks/${b.id}`, { method: 'POST', token: me.token });
    await api(`/blocks/${me.id}`, { method: 'POST', token: c.token });
    res = await api(`/users/search?q=${prefix}`, { token: me.token });
    expect(res.data.users.map(u => u.id)).toEqual([a.id]);
    // LIKE 의 _ 는 글자 그대로 찾는다
    expect((await api('/users/search?q=_', { token: me.token })).data.users.every(u => u.nickname.startsWith('_'))).toBe(true);
  });

  it('sends a request by nickname, the other accepts, and both see each other', async () => {
    const a = await signup(), b = await signup();
    const sent = await api('/friends/requests', { method: 'POST', token: a.token, body: { nickname: b.nickname.toUpperCase() } });
    expect(sent.status).toBe(201);
    expect(sent.data.status).toBe('requested');
    expect((await api('/friends/requests', { token: b.token })).data.incoming.map(r => r.id)).toEqual([a.id]);
    expect((await api('/friends/requests', { token: a.token })).data.outgoing.map(r => r.id)).toEqual([b.id]);
    const search = await api(`/users/search?q=${b.nickname}`, { token: a.token });
    expect(search.data.users[0]).toMatchObject({ id: b.id, requested: true, friend: false });

    const accepted = await api(`/friends/requests/${a.id}/accept`, { method: 'POST', token: b.token });
    expect(accepted.data).toMatchObject({ status: 'friends', friend: { id: a.id, nickname: a.nickname } });
    expect((await api('/friends', { token: a.token })).data.friends.map(f => f.id)).toEqual([b.id]);
    expect((await api('/friends', { token: b.token })).data.friends.map(f => f.id)).toEqual([a.id]);
    expect((await api('/friends/requests', { token: b.token })).data.incoming).toEqual([]);
  });

  it('auto-accepts when the other person already asked me', async () => {
    const a = await signup(), b = await signup();
    await api('/friends/requests', { method: 'POST', token: a.token, body: { id: b.id } });
    const back = await api('/friends/requests', { method: 'POST', token: b.token, body: { id: a.id } });
    expect(back.data.status).toBe('friends');
    expect((await api('/friends', { token: a.token })).data.friends.map(f => f.id)).toEqual([b.id]);
  });

  it('declines, cancels and removes', async () => {
    const a = await signup(), b = await signup(), c = await signup();
    await api('/friends/requests', { method: 'POST', token: a.token, body: { id: b.id } });
    await api(`/friends/requests/${a.id}/decline`, { method: 'POST', token: b.token });
    expect((await api('/friends/requests', { token: a.token })).data.outgoing).toEqual([]);
    await api('/friends/requests', { method: 'POST', token: a.token, body: { id: c.id } });
    await api(`/friends/requests/${c.id}`, { method: 'DELETE', token: a.token });
    expect((await api('/friends/requests', { token: c.token })).data.incoming).toEqual([]);
    await befriend(a, b);
    await api(`/friends/${b.id}`, { method: 'DELETE', token: a.token });
    expect((await api('/friends', { token: b.token })).data.friends).toEqual([]);
    expect((await api('/friends/requests', { method: 'POST', token: a.token, body: { id: a.id } })).status).toBe(400);
    expect((await api('/friends/requests', { method: 'POST', token: a.token, body: { nickname: uniqueNick('no') } })).status).toBe(404);
  });

  it('blocking removes the friendship and pending requests, and stops new requests both ways', async () => {
    const a = await signup(), b = await signup(), c = await signup();
    await befriend(a, b);
    await api('/friends/requests', { method: 'POST', token: c.token, body: { id: a.id } });
    expect((await api(`/blocks/${b.id}`, { method: 'POST', token: a.token })).status).toBe(200);
    expect((await api(`/blocks/${c.id}`, { method: 'POST', token: a.token })).status).toBe(200);
    expect((await api('/friends', { token: a.token })).data.friends).toEqual([]);
    expect((await api('/friends', { token: b.token })).data.friends).toEqual([]);
    expect((await api('/friends/requests', { token: a.token })).data.incoming).toEqual([]);
    expect((await api('/blocks', { token: a.token })).data.blocks.map(x => x.id).sort()).toEqual([b.id, c.id].sort());
    // 차단당한 쪽에서도, 차단한 쪽에서도 요청이 안 된다 (차단 사실은 "없음"으로 감춘다)
    expect((await api('/friends/requests', { method: 'POST', token: b.token, body: { id: a.id } })).data.error).toBe('not-found');
    expect((await api('/friends/requests', { method: 'POST', token: a.token, body: { id: b.id } })).data.error).toBe('not-found');
    await api(`/blocks/${b.id}`, { method: 'DELETE', token: a.token });
    expect((await api('/friends/requests', { method: 'POST', token: b.token, body: { id: a.id } })).status).toBe(201);
  });
});

describe('direct messages', () => {
  it('sends to a friend, pushes it live, keeps it for later and pages through history', async () => {
    const a = await signup(), b = await signup();
    await befriend(a, b);
    const bLive = await live(b);
    const sent = await api(`/dm/${b.id}`, { method: 'POST', token: a.token, body: { body: '안녕! 같이 하자' } });
    expect(sent.status).toBe(201);
    const pushed = await bLive.until(m => m.t === 'dm');
    expect(pushed).toMatchObject({ message: { from: a.id, to: b.id, body: '안녕! 같이 하자' }, from: { id: a.id, nickname: a.nickname } });
    bLive.close();

    // b 가 접속해 있지 않을 때 보낸 것도 다음에 받는다
    // 1분에 20개 제한이 있으므로 앞의 50개는 DB 에 바로 넣고, 마지막 5개만 API 로 보낸다.
    const old = Date.now() - 10 * 60 * 1000;
    await env.DB.batch(Array.from({ length: 50 }, (_, i) =>
      env.DB.prepare('INSERT INTO dms (from_id, to_id, body, created) VALUES (?, ?, ?, ?)').bind(b.id, a.id, `m${i}`, old + i)));
    for (let i = 50; i < 55; i++) expect((await api(`/dm/${a.id}`, { method: 'POST', token: b.token, body: { body: `m${i}` } })).status).toBe(201);
    expect((await api('/dm', { token: a.token })).data.unread).toEqual([{ id: b.id, nickname: b.nickname, count: 55 }]);
    const page1 = await api(`/dm/${b.id}`, { token: a.token });
    expect(page1.data.messages).toHaveLength(50);
    expect(page1.data.more).toBe(true);
    expect(page1.data.messages.at(-1).body).toBe('m54');
    const page2 = await api(`/dm/${b.id}?before=${page1.data.messages[0].id}`, { token: a.token });
    expect(page2.data.messages.map(m => m.body)).toEqual(['안녕! 같이 하자', 'm0', 'm1', 'm2', 'm3', 'm4']);
    expect(page2.data.more).toBe(false);
    expect((await api(`/dm/${b.id}/read`, { method: 'POST', token: a.token })).data.count).toBe(55);
    expect((await api('/dm', { token: a.token })).data.unread).toEqual([]);
  }, 20000);

  it('rate-limits to 20 messages a minute', async () => {
    const a = await signup(), b = await signup();
    await befriend(a, b);
    const results = [];
    for (let i = 0; i < 22; i++) results.push((await api(`/dm/${b.id}`, { method: 'POST', token: a.token, body: { body: `x${i}` } })).status);
    expect(results.filter(s => s === 201).length).toBe(20);
    expect(results.at(-1)).toBe(429);
  });

  it('filters bad words, phone numbers and links', async () => {
    const a = await signup(), b = await signup();
    await befriend(a, b);
    const sent = await api(`/dm/${b.id}`, { method: 'POST', token: a.token, body: { body: '시 발 내번호 010-1234-5678 naver.com' } });
    expect(sent.data.message.body).toBe('* * 내번호 ************* *********');
    expect(sent.data.filtered.sort()).toEqual(['link', 'phone', 'profanity']);
    const history = await api(`/dm/${a.id}`, { token: b.token });
    expect(history.data.messages[0].body).not.toContain('010');
  });

  it('refuses strangers, blocked people, empty and too long messages', async () => {
    const a = await signup(), b = await signup(), stranger = await signup();
    await befriend(a, b);
    expect((await api(`/dm/${stranger.id}`, { method: 'POST', token: a.token, body: { body: 'hi' } })).data.error).toBe('not-friends');
    expect((await api(`/dm/${b.id}`, { method: 'POST', token: a.token, body: { body: '   ' } })).data.error).toBe('empty');
    expect((await api(`/dm/${b.id}`, { method: 'POST', token: a.token, body: { body: '가'.repeat(301) } })).data.error).toBe('too-long');
    expect((await api(`/dm/${b.id}`, { method: 'POST', token: a.token, body: { body: '가'.repeat(300) } })).status).toBe(201);
    await api(`/blocks/${a.id}`, { method: 'POST', token: b.token });
    expect((await api(`/dm/${b.id}`, { method: 'POST', token: a.token, body: { body: 'hi' } })).data.error).toBe('blocked');
    expect((await api(`/dm/${a.id}`, { method: 'POST', token: b.token, body: { body: 'hi' } })).data.error).toBe('blocked');
  });
});

describe('reports', () => {
  it('snapshots the last 50 DMs on the server, and keeps the reporter\'s copy separately', async () => {
    const a = await signup(), b = await signup();
    await befriend(a, b);
    for (let i = 0; i < 3; i++) await api(`/dm/${a.id}`, { method: 'POST', token: b.token, body: { body: `나쁜 말 ${i}` } });
    const res = await api('/reports', { method: 'POST', token: a.token, body: { target: b.id, context: { kind: 'dm' }, reason: '욕을 해요', messages: ['가짜로 꾸민 글'] } });
    expect(res.status).toBe(201);
    const row = await env.DB.prepare('SELECT * FROM reports WHERE id = ?').bind(res.data.id).first();
    expect(row.status).toBe('open');
    expect(JSON.parse(row.evidence).messages.map(m => m.body)).toEqual(['나쁜 말 0', '나쁜 말 1', '나쁜 말 2']);
    expect(JSON.parse(row.client_messages)).toEqual(['가짜로 꾸민 글']);
    expect(JSON.parse(row.context)).toEqual({ kind: 'dm' });
  });

  it('validates the target', async () => {
    const a = await signup();
    expect((await api('/reports', { method: 'POST', token: a.token, body: { target: a.id } })).status).toBe(400);
    expect((await api('/reports', { method: 'POST', token: a.token, body: { target: 99999999 } })).status).toBe(404);
  });
});
