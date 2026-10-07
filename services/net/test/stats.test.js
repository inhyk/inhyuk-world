// 게임 기록과 온라인 랭킹, 관전(보기만 하기), 대전 결과 보고(온라인 승리)
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { api, signup, befriend, connect, ticketFor, sleep } from './helpers.js';
import { createRoom } from '../src/rooms.js';

// 시험마다 다른 게임 이름 (랭킹은 게임마다 따로라서 서로 섞이지 않는다)
const newGame = (prefix = 'g') => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const memberRoom = (game, ...users) => createRoom(env, game, { maxPlayers: 2, members: users.map(u => u.id) });
const enter = async (game, code, user) => {
  const c = await connect(`/rooms/${game}/${code}?ticket=${await ticketFor(user)}`);
  c.welcome = await c.next();
  return c;
};
const watchRoom = async (game, code, user) => {
  const c = await connect(`/rooms/${game}/${code}?ticket=${await ticketFor(user)}&watch=1`);
  c.welcome = await c.next();
  return c;
};
const putStats = (user, game, body) => api(`/stats/${game}`, { method: 'PUT', token: user.token, body });
const board = (user, game, by) => api(`/rankings/${game}?by=${by}`, { token: user.token });
const suspend = id => env.DB.prepare('UPDATE users SET suspended_at = ? WHERE id = ?').bind(Date.now(), id).run();

describe('stats and rankings', () => {
  it('checks the numbers it gets', async () => {
    const a = await signup(), g = newGame();
    expect((await putStats(a, g, { level: 3, xp: 10, trophies: 2 })).data).toEqual({ ok: true });
    for (const bad of [{ level: 0, xp: 0, trophies: 0 }, { level: 100, xp: 0, trophies: 0 }, { level: 2, xp: -1, trophies: 0 },
      { level: 2, xp: 1.5, trophies: 0 }, { level: 2, xp: 0, trophies: '9' }, { level: 2, xp: 0 }]) {
      expect((await putStats(a, g, bad)).data, JSON.stringify(bad)).toEqual({ error: 'bad-stats' });
    }
    expect((await api(`/stats/${g}`, { method: 'PUT', body: { level: 1, xp: 0, trophies: 0 } })).status).toBe(401);
    expect((await putStats(a, 'Bad Game', { level: 1, xp: 0, trophies: 0 })).data).toEqual({ error: 'bad-game' });
    expect((await board(a, g, 'coins')).data).toEqual({ error: 'bad-board' });
  });

  it('ranks by trophies, level and online wins; ties share a rank; suspended people and empty boards are left out', async () => {
    const g = newGame();
    const [a, b, c, d, e, newbie] = await Promise.all([signup(), signup(), signup(), signup(), signup(), signup()]);
    await putStats(newbie, g, { level: 1, xp: 90, trophies: 0 }); // 갓 만든 계정(레벨 1)은 어느 랭킹에도 없다
    await putStats(a, g, { level: 10, xp: 5, trophies: 7 });
    await putStats(b, g, { level: 30, xp: 0, trophies: 7 });
    await putStats(c, g, { level: 30, xp: 50, trophies: 2 });
    await putStats(d, g, { level: 2, xp: 0, trophies: 0 });
    await putStats(e, g, { level: 99, xp: 0, trophies: 99 });
    await suspend(e.id);

    const t = (await board(a, g, 'trophies')).data;
    expect(t.by).toBe('trophies');
    // 같은 트로피면 같은 등수 (줄은 레벨 높은 사람이 먼저). 트로피 0개(d)와 정지된 사람(e)은 없다.
    expect(t.list.map(r => [r.rank, r.nickname, r.trophies])).toEqual([[1, b.nickname, 7], [1, a.nickname, 7], [3, c.nickname, 2]]);
    expect(t.list[0]).toEqual({ rank: 1, id: b.id, nickname: b.nickname, level: 30, xp: 0, trophies: 7, wins: 0 });
    expect(t.me).toMatchObject({ rank: 1, ranks: { trophies: 1, level: 3, wins: null }, level: 10, trophies: 7, wins: 0, top5: true });

    const l = (await board(d, g, 'level')).data;
    expect(l.list.map(r => [r.rank, r.nickname])).toEqual([[1, c.nickname], [2, b.nickname], [3, a.nickname], [4, d.nickname]]);
    expect(l.me).toMatchObject({ rank: 4, ranks: { trophies: null, level: 4, wins: null } });
    expect((await board(newbie, g, 'level')).data.me).toMatchObject({ rank: null, ranks: { trophies: null, level: null, wins: null }, level: 1, top5: false });

    expect((await board(a, g, 'wins')).data.list).toEqual([]);
    // 기록을 안 올린 사람은 등수가 없다
    const f = await signup();
    expect((await board(f, g, 'trophies')).data.me).toEqual({ rank: null, ranks: { trophies: null, level: null, wins: null }, level: null, trophies: 0, wins: 0, top5: false });
  });

  it('remembers a top-5 place for good, even after falling out of the top 5', async () => {
    const g = newGame();
    const me = await signup();
    await putStats(me, g, { level: 1, xp: 0, trophies: 1 });
    expect((await board(me, g, 'trophies')).data.me.top5).toBe(true); // 혼자라 1등
    const others = await Promise.all(Array.from({ length: 6 }, () => signup()));
    for (const [i, o] of others.entries()) await putStats(o, g, { level: 50, xp: i, trophies: 50 + i });
    const after = (await board(me, g, 'trophies')).data.me;
    expect(after.rank).toBe(7);
    expect(after.ranks.level).toBeNull(); // 레벨 1은 레벨 랭킹에 없다
    expect(after.top5).toBe(true);
    // 처음부터 5등 밖이면 받지 못한다
    const late = await signup();
    await putStats(late, g, { level: 1, xp: 0, trophies: 1 });
    expect((await board(late, g, 'trophies')).data.me).toMatchObject({ rank: 7, top5: false });
    // 사람이 적어도 갓 만든 계정(레벨 1, 트로피 0)은 5등 보상을 받지 않는다
    const g2 = newGame(), alone = await signup();
    await putStats(alone, g2, { level: 1, xp: 0, trophies: 0 });
    expect((await board(alone, g2, 'level')).data).toMatchObject({ list: [], me: { rank: null, top5: false } });
    await putStats(alone, g2, { level: 2, xp: 0, trophies: 0 });
    expect((await board(alone, g2, 'level')).data.me).toMatchObject({ rank: 1, top5: true });
  });
});

describe('watching a match', () => {
  it('a logged-in third person sees both players, gets their game messages but not their chat, and can not send', async () => {
    const g = newGame('w');
    const a = await signup(), b = await signup(), viewer = await signup();
    const code = await memberRoom(g, a, b);
    const p1 = await enter(g, code, a), p2 = await enter(g, code, b);
    // 처음 인사는 keep 으로 남겨 두면 나중에 들어온 사람도 받는다
    p1.send({ t: 'send', data: { t: 'hello', level: 12, skin: 'cat' }, keep: true });
    expect(await p2.until(m => m.t === 'msg')).toMatchObject({ from: 'p1', data: { t: 'hello', level: 12 } });

    const w = await watchRoom(g, code, viewer);
    expect(w.welcome).toEqual({ t: 'welcome', id: 'w1', watch: true, host: 'p1', max: 2, peers: ['p1', 'p2'], users: { p1: a.id, p2: b.id } });
    expect(await w.next()).toEqual({ t: 'msg', from: 'p1', data: { t: 'hello', level: 12, skin: 'cat' } });
    expect(await p1.until(m => m.t === 'watchers')).toEqual({ t: 'watchers', n: 1 });
    expect(await p2.until(m => m.t === 'watchers')).toEqual({ t: 'watchers', n: 1 });

    p2.send({ t: 'send', data: { t: 's', c: [1, 2, 3], sc: 400 } });
    expect(await w.next()).toEqual({ t: 'msg', from: 'p2', data: { t: 's', c: [1, 2, 3], sc: 400 } });
    expect(await p1.until(m => m.t === 'msg')).toMatchObject({ from: 'p2', data: { sc: 400 } });

    p1.send({ t: 'send', data: { chat: '안녕' } });
    expect(await p2.until(m => m.t === 'msg')).toMatchObject({ data: { chat: '안녕' } });
    expect(await w.quiet()).toBeNull(); // 채팅은 관전하는 사람에게 가지 않는다

    w.send({ t: 'send', data: { t: 'atk', n: 99 } });
    expect(await w.next()).toEqual({ t: 'error', code: 'watch-only' });
    w.send({ t: 'report', n: 1, won: true });
    expect(await w.next()).toEqual({ t: 'error', code: 'watch-only' });
    expect(await p1.quiet()).toBeNull();

    // 관전하는 사람은 자리를 차지하지 않는다: 방장, 인원은 그대로이고 두 사람이 나가면 끝난다
    w.close();
    expect(await p1.until(m => m.t === 'watchers')).toEqual({ t: 'watchers', n: 0 });
    const w2 = await watchRoom(g, code, viewer);
    expect(w2.welcome.id).toBe('w2');
    p1.close();
    expect(await w2.until(m => m.t === 'leave')).toEqual({ t: 'leave', id: 'p1' });
    expect(await w2.until(m => m.t === 'host')).toEqual({ t: 'host', id: 'p2' });
    // 나간 사람이 다시 들어오면 관전하는 사람은 누가 들어왔는지(사용자 번호)도 받는다. 남은 사람은 예전처럼 번호만.
    const back = await enter(g, code, a);
    expect(back.welcome).toMatchObject({ t: 'welcome', id: 'p3', host: 'p2', peers: ['p2'] });
    expect(await w2.until(m => m.t === 'join')).toEqual({ t: 'join', id: 'p3', user: a.id });
    expect(await p2.until(m => m.t === 'join')).toEqual({ t: 'join', id: 'p3' });
    back.close();
    await w2.until(m => m.t === 'leave');
    p2.close();
    expect(await w2.until(m => m.t === 'error')).toEqual({ t: 'error', code: 'ended' });
    expect(await w2.until(m => m.t === '__closed')).toEqual({ t: '__closed', code: 4410 });
  });

  it('refuses players, guests, code rooms, people who blocked a player, and too many viewers', async () => {
    const g = newGame('w');
    const a = await signup(), b = await signup(), c = await signup();
    const code = await memberRoom(g, a, b);
    const p1 = await enter(g, code, a);
    expect((await watchRoom(g, code, a)).welcome).toEqual({ t: 'error', code: 'not-watchable', max: 10 }); // 자기 대전은 못 본다
    expect((await connect(`/rooms/${g}/${code}?watch=1`)).res.status).toBe(401); // 로그인 해야 본다
    const open = (await api(`/rooms/${g}`, { method: 'POST', body: {} })).data.code;
    expect((await watchRoom(g, open, c)).welcome.code).toBe('not-watchable'); // 코드 방은 관전 없음
    expect((await watchRoom(g, 'ZZZZZZ', c)).welcome.code).toBe('not-found');
    await api(`/blocks/${c.id}`, { method: 'POST', token: b.token }); // b 가 c 를 차단
    const blocked = await watchRoom(g, code, c);
    expect(blocked.welcome).toEqual({ t: 'error', code: 'not-found', max: 10 }); // 차단 사실은 알리지 않는다
    expect(await blocked.until(m => m.t === '__closed')).toEqual({ t: '__closed', code: 4404 });
    const viewers = await Promise.all(Array.from({ length: 11 }, () => signup()));
    const seen = [];
    for (const v of viewers) seen.push((await watchRoom(g, code, v)).welcome);
    expect(seen.slice(0, 10).every(m => m.t === 'welcome' && m.watch)).toBe(true);
    expect(seen[10]).toEqual({ t: 'error', code: 'watch-full', max: 10 });
    p1.close();
  });

  it('lists live matches with both players and levels, friends first, without my own, blocked or suspended people', async () => {
    const g = newGame('l');
    const [a, b, c, d, me, f] = await Promise.all([signup(), signup(), signup(), signup(), signup(), signup()]);
    await putStats(a, g, { level: 21, xp: 0, trophies: 3 });
    await befriend(me, d);
    const ab = await memberRoom(g, a, b), cd = await memberRoom(g, c, d);
    // 한 사람만 들어온 방은 아직 목록에 없다
    const pa = await enter(g, ab, a);
    expect((await api(`/matches/${g}`, { token: me.token })).data.matches).toEqual([]);
    const pb = await enter(g, ab, b);
    const pc = await enter(g, cd, c), pd = await enter(g, cd, d);
    const list = (await api(`/matches/${g}`, { token: me.token })).data.matches;
    expect(list.map(m => m.code)).toEqual([cd, ab]); // 친구(d)의 대전이 먼저
    expect(list[0]).toMatchObject({ code: cd, friend: true, players: [{ id: c.id, nickname: c.nickname, level: 1 }, { id: d.id, nickname: d.nickname, level: 1 }] });
    expect(list[1]).toMatchObject({ friend: false, players: [{ id: a.id, level: 21 }, { id: b.id, level: 1 }] });
    expect((await api(`/matches/${g}`, { token: a.token })).data.matches.map(m => m.code)).toEqual([cd]); // 내 대전은 빼고
    await api(`/blocks/${f.id}`, { method: 'POST', token: c.token });
    expect((await api(`/matches/${g}`, { token: f.token })).data.matches.map(m => m.code)).toEqual([ab]);
    await suspend(b.id);
    expect((await api(`/matches/${g}`, { token: me.token })).data.matches.map(m => m.code)).toEqual([cd]);
    // 두 사람이 다 나가면 목록에서 빠진다
    pc.close(); pd.close();
    await sleep(100);
    expect((await api(`/matches/${g}`, { token: f.token })).data.matches.map(m => m.code)).toEqual([]);
    pa.close(); pb.close();
  });
});

describe('match results (online wins)', () => {
  const wins = async (user, game) => (await board(user, game, 'wins')).data.me.wins;

  it('counts a win when both players agree, once per match, and not when they disagree', async () => {
    const g = newGame('r');
    const a = await signup(), b = await signup();
    const code = await memberRoom(g, a, b);
    const p1 = await enter(g, code, a), p2 = await enter(g, code, b);
    p1.send({ t: 'report', n: 1, won: true });
    p2.send({ t: 'report', n: 1, won: false });
    p1.send({ t: 'report', n: 1, won: true }); // 같은 대전을 또 보내도 한 번만
    await sleep(50);
    expect(await wins(a, g)).toBe(1);
    expect(await wins(b, g)).toBe(0);
    // 두 번째 대전: 서로 이겼다고 하면 세지 않는다
    p1.send({ t: 'report', n: 2, won: true });
    p2.send({ t: 'report', n: 2, won: true });
    // 세 번째 대전: b 가 이김
    p2.send({ t: 'report', n: 3, won: true });
    p1.send({ t: 'report', n: 3, won: false });
    await sleep(50);
    expect([await wins(a, g), await wins(b, g)]).toEqual([1, 1]);
    // 잘못된 보고는 거절
    p1.send({ t: 'report', n: 0, won: true });
    expect(await p1.until(m => m.t === 'error')).toEqual({ t: 'error', code: 'bad' });
    p1.send({ t: 'report', n: 4, won: 'yes' });
    expect(await p1.until(m => m.t === 'error')).toEqual({ t: 'error', code: 'bad' });
    // 온라인 승리 랭킹: 1승씩이라 둘 다 1등 (레벨, 경험치도 같아서 먼저 가입한 a 가 위)
    const list = (await board(a, g, 'wins')).data.list;
    expect(list.map(r => [r.rank, r.id, r.wins])).toEqual([[1, a.id, 1], [1, b.id, 1]]);
    p1.close(); p2.close();
  });

  it('counts a lone report when the room empties (the other player left before reporting)', async () => {
    const g = newGame('r');
    const a = await signup(), b = await signup();
    const code = await memberRoom(g, a, b);
    const p1 = await enter(g, code, a), p2 = await enter(g, code, b);
    p2.close(); // b 는 결과를 보내기 전에 나감
    await p1.until(m => m.t === 'leave');
    p1.send({ t: 'report', n: 1, won: true });
    await sleep(50);
    expect(await wins(a, g)).toBe(0); // 아직 방에 있는 동안은 기다린다
    p1.close();
    await sleep(100);
    expect(await wins(a, g)).toBe(1);
  });

  it('does not count reports from code rooms', async () => {
    const g = newGame('r');
    const a = await signup(), b = await signup();
    const code = (await api(`/rooms/${g}`, { method: 'POST', body: {} })).data.code;
    const p1 = await enter(g, code, a), p2 = await enter(g, code, b);
    p1.send({ t: 'report', n: 1, won: true });
    expect(await p1.until(m => m.t === 'error')).toEqual({ t: 'error', code: 'bad' });
    p2.send({ t: 'report', n: 1, won: false });
    p1.close(); p2.close();
    await sleep(100);
    expect(await wins(a, g)).toBe(0);
  });
});
