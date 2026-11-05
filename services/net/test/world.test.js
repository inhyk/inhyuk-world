// 같이 쓰는 세계(World): 로그인, 칸 주인, 남는 칸, ttl, 한도, 거르기, 채팅, 인원, 바꿔 끼기, 차단, 횟수 제한, 신고, 정지
import { describe, it, expect } from 'vitest';
import { SELF, env, runInDurableObject, runDurableObjectAlarm } from 'cloudflare:test';
import { api, signup, connect, ticketFor, ORIGIN, sleep } from './helpers.js';
import { maskText } from '../src/filter.js';
import { CELLS_PER_USER, CELLS_PER_WORLD, WORLD_MAX, TTL_CELLS_PER_USER, WRITE_BURST, WRITES_PER_DAY } from '../src/world.js';
import { SWEEP_MS } from '../src/rooms.js';
import { World as Client } from '../../../packages/net/world.mjs';

const game = 'world-test';
let seq = 0;
const newWorld = () => `w${Date.now().toString(36).slice(-6)}${(seq++).toString(36)}`;
const stub = world => env.WORLDS.get(env.WORLDS.idFromName(`${game}:${world}`));

// 세계에 들어가서 welcome 과 칸 묶음(done 까지)을 받는다. c.welcome, c.cells(받은 칸 목록), c.chunks(묶음 수)
async function join(user, world) {
  const c = await connect(`/worlds/${game}/${world}?ticket=${await ticketFor(user)}`);
  const welcome = await c.next();
  if (welcome.t !== 'welcome') throw Error(`join ${JSON.stringify(welcome)}`);
  c.welcome = welcome; c.cells = []; c.chunks = 0;
  for (;;) {
    const m = await c.next();
    expect(m.t).toBe('cells');
    c.chunks++; c.cells.push(...m.list);
    if (m.done) break;
  }
  return c;
}

describe('world: joining', () => {
  it('needs login, a websocket, a good name and an allowed origin', async () => {
    const world = newWorld();
    expect((await connect(`/worlds/${game}/${world}`)).res.status).toBe(401);
    expect((await connect(`/worlds/${game}/${world}?ticket=${'x'.repeat(32)}`)).res.status).toBe(401);
    const a = await signup();
    expect((await connect(`/worlds/${game}/Bad_World?ticket=${await ticketFor(a)}`)).res.status).toBe(400);
    expect((await connect(`/worlds/${game}/${'a'.repeat(17)}?ticket=${await ticketFor(a)}`)).res.status).toBe(400);
    expect((await connect(`/worlds/Bad_Game/${world}?ticket=${await ticketFor(a)}`)).res.status).toBe(400);
    expect((await connect(`/worlds/${game}/${world}?ticket=${await ticketFor(a)}`, { origin: 'https://evil.example' })).res.status).toBe(403);
    expect((await SELF.fetch(`https://net.test/worlds/${game}/${world}`, { headers: { Origin: ORIGIN } })).status).toBe(426);
    const ok = await join(a, world);
    expect(ok.welcome).toEqual({ t: 'welcome', id: 'p1', user: { id: a.id, nickname: a.nickname }, max: WORLD_MAX, peers: [] });
    expect(ok.cells).toEqual([]);
    expect(ok.chunks).toBe(1); // 비어 있어도 done 묶음 하나
  });

  it('tells others who joined and left', async () => {
    const world = newWorld();
    const a = await signup(), b = await signup();
    const ca = await join(a, world);
    const cb = await join(b, world);
    expect(cb.welcome.peers).toEqual([{ id: 'p1', user: { id: a.id, nickname: a.nickname } }]);
    expect(await ca.next()).toEqual({ t: 'join', id: 'p2', user: { id: b.id, nickname: b.nickname } });
    cb.send({ t: 'bye' });
    expect(await ca.next()).toEqual({ t: 'leave', id: 'p2' });
  });

  it('refuses the 13th player', async () => {
    const world = newWorld();
    const users = await Promise.all(Array.from({ length: WORLD_MAX + 1 }, () => signup()));
    const conns = [];
    for (const u of users.slice(0, WORLD_MAX)) conns.push(await join(u, world));
    const last = await connect(`/worlds/${game}/${world}?ticket=${await ticketFor(users[WORLD_MAX])}`);
    expect(await last.next()).toEqual({ t: 'error', code: 'full', max: 12 });
    expect(await last.next()).toEqual({ t: '__closed', code: 4403 });
    // 한 사람이 나가면 들어올 수 있다
    conns[0].close();
    await conns[1].until(m => m.t === 'leave');
    const again = await join(users[WORLD_MAX], world);
    expect(again.welcome.peers).toHaveLength(WORLD_MAX - 1);
  });

  it('the same account joining again replaces the old connection and keeps its seat', async () => {
    const world = newWorld();
    const a = await signup(), b = await signup();
    const first = await join(a, world);
    const cb = await join(b, world); await first.next(); // join
    const second = await join(a, world);
    expect(second.welcome.id).toBe('p1');
    expect(second.welcome.peers.map(p => p.id)).toEqual(['p2']);
    expect(await first.next()).toEqual({ t: 'error', code: 'replaced' });
    expect(await first.next()).toEqual({ t: '__closed', code: 4409 });
    expect(await cb.quiet()).toBeNull(); // 자리는 그대로라 leave, join 이 없다
    second.send({ t: 'pose', d: [1, 2, 3] });
    expect(await cb.next()).toEqual({ t: 'pose', id: 'p1', d: [1, 2, 3] });
  });
});

describe('world: cells', () => {
  it('only the owner can change or delete a cell; everyone sees changes', async () => {
    const world = newWorld();
    const a = await signup(), b = await signup();
    const ca = await join(a, world);
    const cb = await join(b, world); await ca.next();
    ca.send({ t: 'set', k: '1|2|3', v: { b: 'stone' } });
    const cell = { t: 'cell', k: '1|2|3', v: { b: 'stone' }, owner: { id: a.id, nickname: a.nickname } };
    expect(await ca.next()).toEqual(cell); // 보낸 사람도 받는다
    expect(await cb.next()).toEqual(cell);
    cb.send({ t: 'set', k: '1|2|3', v: { b: 'dirt' } });
    expect(await cb.next()).toEqual({ t: 'error', code: 'taken', k: '1|2|3' });
    expect(await ca.quiet()).toBeNull();
    cb.send({ t: 'del', k: '1|2|3' });
    expect(await cb.next()).toEqual({ t: 'error', code: 'not-owner', k: '1|2|3' });
    cb.send({ t: 'del', k: 'nothing' });
    expect(await cb.next()).toEqual({ t: 'error', code: 'missing', k: 'nothing' });
    ca.send({ t: 'set', k: '1|2|3', v: { b: 'glass' } });
    expect((await cb.next()).v).toEqual({ b: 'glass' });
    await ca.next();
    ca.send({ t: 'del', k: '1|2|3' });
    expect(await cb.next()).toEqual({ t: 'cell', k: '1|2|3', v: null });
    expect(await ca.next()).toEqual({ t: 'cell', k: '1|2|3', v: null });
    // 지운 뒤에는 누구나 놓을 수 있다
    cb.send({ t: 'set', k: '1|2|3', v: 7 });
    expect((await cb.next()).owner).toEqual({ id: b.id, nickname: b.nickname });
  });

  it('rejects bad keys and values', async () => {
    const world = newWorld();
    const a = await signup();
    const ca = await join(a, world);
    for (const k of ['', 'a'.repeat(65), 'a b', '한글', 5, undefined]) {
      ca.send({ t: 'set', k, v: 1 });
      expect(await ca.next(), String(k)).toEqual({ t: 'error', code: 'bad' });
    }
    const bads = [null, undefined, 'x'.repeat(25), { ['y'.repeat(25)]: 1 }, Array(200).fill(1)];
    for (const v of bads) {
      ca.send({ t: 'set', k: 'k', v });
      expect(await ca.next()).toEqual({ t: 'error', code: 'bad', k: 'k' });
    }
    for (const ttl of [59, 3601, 1.5, '60']) {
      ca.send({ t: 'set', k: 'k', v: 1, ttl });
      expect(await ca.next()).toEqual({ t: 'error', code: 'bad', k: 'k' });
    }
    ca.send({ t: 'set', k: 'Aa0|._:-', v: 'x'.repeat(24) });
    expect((await ca.next()).v).toBe('x'.repeat(24));
  });

  it('cells stay after everyone leaves and come back in welcome chunks', async () => {
    const world = newWorld();
    const a = await signup(), b = await signup();
    const ca = await join(a, world);
    ca.send({ t: 'set', k: 'house', v: { color: 3 } });
    await ca.next();
    ca.close();
    await sleep(100);
    // 1200칸을 더 놓는다 (시험이라 횟수 제한을 거치지 않고 바로 넣는다)
    await runInDurableObject(stub(world), instance => {
      for (let i = 0; i < 1200; i++) expect(instance.store(9_100_000 + Math.floor(i / 400), 'filler', `c${i}`, i).row).toBeTruthy();
    });
    const cb = await join(b, world);
    expect(cb.chunks).toBe(3); // 500 + 500 + 201
    expect(cb.cells).toHaveLength(1201);
    expect(cb.cells.find(c => c.k === 'house')).toEqual({ k: 'house', v: { color: 3 }, owner: { id: a.id, nickname: a.nickname } });
    expect(cb.welcome.id).toBe('p2'); // 번호는 이어서 준다
  });

  it('ttl cells expire, are not sent on join, can then be taken, and do not count toward the limit', async () => {
    const world = newWorld();
    const a = await signup(), b = await signup();
    const ca = await join(a, world);
    const before = Date.now();
    ca.send({ t: 'set', k: 'tree', v: 'stump', ttl: 600 });
    const cell = await ca.next();
    expect(cell.exp).toBeGreaterThanOrEqual(before + 600_000);
    expect(cell.exp).toBeLessThan(Date.now() + 600_000 + 1000);
    const cb = await join(b, world); await ca.next();
    expect(cb.cells.map(c => c.k)).toEqual(['tree']);
    cb.send({ t: 'set', k: 'tree', v: 'x' });
    expect(await cb.next()).toEqual({ t: 'error', code: 'taken', k: 'tree' });
    // 시간이 지난 것처럼 만든다
    await runInDurableObject(stub(world), instance => { instance.sql.exec("UPDATE cells SET exp = ? WHERE k = 'tree'", Date.now() - 1); });
    const late = await join(await signup(), world);
    expect(late.cells).toEqual([]);
    await ca.next(); await cb.next(); // join
    cb.send({ t: 'del', k: 'tree' });
    expect(await cb.next()).toEqual({ t: 'error', code: 'missing', k: 'tree' });
    cb.send({ t: 'set', k: 'tree', v: 'mine' });
    expect((await cb.next()).owner.id).toBe(b.id);
    // 알람이 지난 ttl 칸을 지운다
    await runInDurableObject(stub(world), instance => {
      instance.store(a.id, a.nickname, 'old', 1, 60, Date.now() - 120_000);
      expect(instance.sql.exec("SELECT COUNT(*) n FROM cells WHERE k = 'old'").one().n).toBe(1);
    });
    await runDurableObjectAlarm(stub(world));
    await runInDurableObject(stub(world), instance => {
      expect(instance.sql.exec("SELECT COUNT(*) n FROM cells WHERE k = 'old'").one().n).toBe(0);
      expect(instance.count('total')).toBe(1);
      expect(instance.count(`u${a.id}`)).toBe(0); // ttl 칸은 세지 않는다
    });
  });

  it('limits each account to 400 lasting cells and a world to 20,000 cells', async () => {
    const world = newWorld();
    const a = await signup(), b = await signup();
    await runInDurableObject(stub(world), instance => {
      for (let i = 0; i < CELLS_PER_USER - 1; i++) instance.store(a.id, a.nickname, `a${i}`, 1);
    });
    const ca = await join(a, world);
    ca.send({ t: 'set', k: 'last', v: 1 });
    expect((await ca.next()).k).toBe('last');
    ca.send({ t: 'set', k: 'over', v: 1 });
    expect(await ca.next()).toEqual({ t: 'error', code: 'limit', k: 'over' });
    ca.send({ t: 'set', k: 'last', v: 2 }); // 내 칸을 바꾸는 것은 된다
    expect((await ca.next()).v).toBe(2);
    ca.send({ t: 'set', k: 'over', v: 1, ttl: 60 }); // ttl 칸은 세지 않는다
    expect((await ca.next()).exp).toBeTruthy();
    ca.send({ t: 'del', k: 'last' });
    await ca.next();
    ca.send({ t: 'set', k: 'again', v: 1 }); // 하나 지우면 다시 놓을 수 있다
    expect((await ca.next()).k).toBe('again');

    // 세계 전체 한도
    await runInDurableObject(stub(world), instance => {
      const left = CELLS_PER_WORLD - instance.count('total');
      for (let i = 0; i < left; i++) instance.store(9_000_000 + Math.floor(i / 300), 'filler', `f${i}`, 0);
      expect(instance.count('total')).toBe(CELLS_PER_WORLD);
    });
    const cb = await join(b, world); await ca.next();
    expect(cb.cells).toHaveLength(CELLS_PER_WORLD);
    expect(cb.chunks).toBe(CELLS_PER_WORLD / 500 + 1);
    cb.send({ t: 'set', k: 'one-more', v: 1 });
    expect(await cb.next()).toEqual({ t: 'error', code: 'world-full', k: 'one-more' });
  }, 60_000);
});

describe('world: filtering, chat, relays', () => {
  it('filters every string in cell values, poses and messages', async () => {
    const world = newWorld();
    const a = await signup(), b = await signup();
    const ca = await join(a, world);
    const cb = await join(b, world); await ca.next();
    const phone = '010-1234-5678';
    expect(maskText(phone)).not.toBe(phone);
    ca.send({ t: 'set', k: 'sign', v: { text: phone, [phone]: 1 } });
    const cell = await cb.next();
    expect(cell.v).toEqual({ text: maskText(phone), [maskText(phone)]: 1 });
    await ca.next();
    ca.send({ t: 'pose', d: { x: 1, name: 'sibal' } });
    expect(await cb.next()).toEqual({ t: 'pose', id: 'p1', d: { x: 1, name: maskText('sibal') } });
    expect(maskText('sibal')).not.toBe('sibal');
    ca.send({ t: 'pose', d: 'x'.repeat(600) });
    expect(await ca.next()).toEqual({ t: 'error', code: 'bad' });
    ca.send({ t: 'send', data: { t: 'wave', note: phone } });
    expect(await cb.next()).toEqual({ t: 'msg', from: 'p1', data: { t: 'wave', note: maskText(phone) } });
    ca.send({ t: 'send', to: 'p2', data: [phone] });
    expect(await cb.next()).toEqual({ t: 'msg', from: 'p1', data: [maskText(phone)] });
    expect(await ca.quiet()).toBeNull(); // 위치와 메시지는 보낸 사람에게 돌아오지 않는다
  });

  it('chat is filtered, rate-limited and kept for reports', async () => {
    const world = newWorld();
    const a = await signup(), b = await signup(), outsider = await signup();
    const ca = await join(a, world);
    const cb = await join(b, world); await ca.next();
    cb.send({ t: 'send', data: { chat: '병신아' } });
    expect(await ca.next()).toEqual({ t: 'msg', from: 'p2', data: { chat: '**아' } });
    cb.send({ t: 'send', data: { chat: 42 } });
    expect(await cb.next()).toEqual({ t: 'error', code: 'bad' });
    for (let i = 0; i < 8; i++) cb.send({ t: 'send', data: { chat: `hi ${i}` } });
    expect(await cb.until(m => m.t === 'error')).toEqual({ t: 'error', code: 'chat-rate' });
    ca.close(); cb.close();
    await sleep(100);

    const res = await api('/reports', { method: 'POST', token: a.token, body: { target: b.id, context: { kind: 'world', game, world }, messages: ['아무 말'] } });
    expect(res.status).toBe(201);
    const row = await env.DB.prepare('SELECT * FROM reports WHERE id = ?').bind(res.data.id).first();
    const evidence = JSON.parse(row.evidence);
    expect(evidence.lines[0]).toMatchObject({ uid: b.id, text: '**아' });
    expect(evidence.targetWasThere).toBe(true);
    expect(JSON.parse(row.context)).toEqual({ kind: 'world', game, world });
    const other = await api('/reports', { method: 'POST', token: outsider.token, body: { target: b.id, context: { kind: 'world', game, world } } });
    const otherRow = await env.DB.prepare('SELECT evidence FROM reports WHERE id = ?').bind(other.data.id).first();
    expect(JSON.parse(otherRow.evidence)).toEqual({ error: 'not-in-world' });
    expect((await api('/reports', { method: 'POST', token: a.token, body: { target: b.id, context: { kind: 'world', game, world: 'Bad!' } } })).status).toBe(400);

    // 모두 나가고 10분이 지나면 채팅 기록을 지운다 (칸은 남는다)
    await runInDurableObject(stub(world), async (_i, state) => {
      const chat = await state.storage.get('chat');
      expect(chat.until).toBeGreaterThan(Date.now());
      await state.storage.put('chat', { ...chat, until: Date.now() - 1 });
    });
    await runDurableObjectAlarm(stub(world));
    await runInDurableObject(stub(world), async (_i, state) => { expect(await state.storage.get('chat')).toBeUndefined(); });
  });

  it('people who blocked each other do not get each other\'s poses and messages, but share cells', async () => {
    const world = newWorld();
    const a = await signup(), b = await signup(), c = await signup();
    await api(`/blocks/${b.id}`, { method: 'POST', token: a.token });
    const ca = await join(a, world);
    const cb = await join(b, world); await ca.next();
    const cc = await join(c, world); await ca.next(); await cb.next();
    ca.send({ t: 'pose', d: 1 });
    expect(await cc.next()).toEqual({ t: 'pose', id: 'p1', d: 1 });
    cb.send({ t: 'send', data: { chat: '안녕' } });
    expect(await cc.next()).toEqual({ t: 'msg', from: 'p2', data: { chat: '안녕' } });
    cb.send({ t: 'send', to: 'p1', data: 'psst' });
    cb.send({ t: 'set', k: 'wall', v: 1 });
    expect((await ca.next()).k).toBe('wall'); // 칸은 받는다, 위치와 채팅은 아니다
    expect(await ca.quiet()).toBeNull();
    expect(await cb.until(m => m.t === 'cell')).toMatchObject({ k: 'wall' });
    expect(await cb.quiet()).toBeNull(); // a 의 위치도 b 에게 가지 않는다
  });

  it('rate-limits a flooding connection and rejects oversized or unknown messages', async () => {
    const world = newWorld();
    const a = await signup(), b = await signup();
    const ca = await join(a, world);
    const cb = await join(b, world); await ca.next();
    cb.send({ t: 'send', data: 'x'.repeat(16 * 1024) });
    expect(await cb.next()).toEqual({ t: 'error', code: 'too-big' });
    cb.send({ t: 'jump' });
    expect(await cb.next()).toEqual({ t: 'error', code: 'bad' });
    cb.send({ t: 'ping' });
    expect(await cb.next()).toEqual({ t: 'pong' });
    for (let i = 0; i < 150; i++) cb.send({ t: 'pose', d: i });
    expect(await cb.until(m => m.t === 'error')).toEqual({ t: 'error', code: 'rate' });
    let relayed = 0;
    while (await ca.quiet(200)) relayed++;
    expect(relayed).toBeGreaterThan(0);
    expect(relayed).toBeLessThan(150);
  });

  it('drops players who went silent', async () => {
    const world = newWorld();
    const a = await signup(), b = await signup();
    const ca = await join(a, world);
    const cb = await join(b, world); await ca.next();
    await runInDurableObject(stub(world), instance => {
      for (const ws of instance.ctx.getWebSockets()) {
        const me = ws.deserializeAttachment();
        if (me.id === 'p2') { ws.serializeAttachment({ ...me, joined: 0 }); instance.buckets.delete(ws); }
        else instance.lastHeard(ws, true);
      }
    });
    await runDurableObjectAlarm(stub(world));
    expect(await ca.next()).toEqual({ t: 'leave', id: 'p2' });
    expect(await cb.until(m => m.t === '__closed')).toEqual({ t: '__closed', code: 4408 });
  });

  it('suspension closes the world connection', async () => {
    const world = newWorld();
    const bad = await signup(), friend = await signup();
    const cBad = await join(bad, world);
    const cFriend = await join(friend, world); await cBad.next();
    await env.LOBBY.get(env.LOBBY.idFromName('lobby')).kick(bad.id);
    expect(await cBad.until(m => m.t === 'error')).toEqual({ t: 'error', code: 'suspended' });
    expect(await cBad.until(m => m.t === '__closed')).toEqual({ t: '__closed', code: 4403 });
    expect(await cFriend.next()).toEqual({ t: 'leave', id: 'p1' });
  });
});

// 들어올 때의 차단 찾기(D1)를 100ms 늦춰서, 같이 들어오는 두 사람이 확실히 겹치게 한다
const slowBlocks = world => runInDurableObject(stub(world), instance => {
  const db = instance.env.DB;
  const slow = { prepare: sql => {
    const st = db.prepare(sql);
    if (!sql.includes('FROM blocks')) return st;
    return { bind: (...args) => ({ all: async () => { await sleep(100); return st.bind(...args).all(); } }) };
  } };
  instance.env = Object.assign(Object.create(instance.env), { DB: slow });
});

describe('world: limits against abuse', () => {
  it('only listed worlds exist (404 no-world before upgrade or ticket)', async () => {
    const a = await signup();
    for (const path of ['/worlds/other-game/town-1', `/worlds/other-game/town-1?ticket=${await ticketFor(a)}`, '/worlds/social-game/town-9']) {
      const res = await SELF.fetch(`https://net.test${path}`, { headers: { Origin: ORIGIN, Upgrade: 'websocket' } });
      expect(res.status, path).toBe(404);
      expect(await res.json()).toEqual({ error: 'no-world' });
    }
    const plain = await SELF.fetch('https://net.test/worlds/other-game/town-1', { headers: { Origin: ORIGIN } });
    expect(plain.status).toBe(404); // 클라이언트의 whyFailed 가 표 없이 묻는 것
    expect((await SELF.fetch('https://net.test/worlds/social-game/town-1', { headers: { Origin: ORIGIN } })).status).toBe(426);
    const c = await connect(`/worlds/social-game/town-2?ticket=${await ticketFor(a)}`);
    expect((await c.next()).t).toBe('welcome');
    c.close();
    const report = await api('/reports', { method: 'POST', token: a.token, body: { target: a.id, context: { kind: 'world', game: 'other-game', world: 'town-1' } } });
    expect(report.status).toBe(400);
  });

  it('one account can join a world 20 times a minute', async () => {
    const world = newWorld();
    const a = await signup();
    for (let i = 0; i < 20; i++) (await join(a, world)).close();
    const c = await connect(`/worlds/${game}/${world}?ticket=${await ticketFor(a)}`);
    expect(await c.next()).toEqual({ t: 'error', code: 'rate' });
    expect(await c.next()).toEqual({ t: '__closed', code: 4429 });
  });

  it('keeps the cells in memory so a second join does not read SQLite again', async () => {
    const world = newWorld();
    const a = await signup(), b = await signup();
    const ca = await join(a, world);
    ca.send({ t: 'set', k: 'one', v: 1 });
    await ca.next();
    // SQLite 에만 몰래 넣은 칸은 메모리 사본에 없으니 다음 사람에게 가지 않는다 (= 다시 읽지 않았다)
    await runInDurableObject(stub(world), instance => {
      expect(instance.snapshot.size).toBe(1);
      instance.sql.exec("INSERT INTO cells (k, v, owner, nick, updated, exp) VALUES ('sneaky', '1', 1, 'x', 0, NULL)");
    });
    const cb = await join(b, world);
    expect(cb.cells.map(c => c.k)).toEqual(['one']);
    // 지우기와 ttl 이 지난 칸도 메모리 사본에 들어간다
    ca.send({ t: 'set', k: 'two', v: 2, ttl: 60 }); await ca.next(); await cb.next();
    ca.send({ t: 'del', k: 'one' }); await ca.next(); await cb.next();
    await runInDurableObject(stub(world), instance => {
      expect([...instance.snapshot.keys()]).toEqual(['two']);
      instance.sql.exec("UPDATE cells SET exp = ? WHERE k = 'two'", Date.now() - 1);
    });
    const late = await join(await signup(), world);
    expect(late.cells).toEqual([]);
    await runInDurableObject(stub(world), instance => { expect(instance.snapshot.size).toBe(0); });
  });

  it('caps live ttl cells per account at 100 (renewing does not get around it)', async () => {
    const world = newWorld();
    const a = await signup(), b = await signup();
    await runInDurableObject(stub(world), instance => {
      for (let i = 0; i < TTL_CELLS_PER_USER - 1; i++) expect(instance.store(a.id, a.nickname, `t${i}`, 1, 3600).row).toBeTruthy();
    });
    const ca = await join(a, world);
    ca.send({ t: 'set', k: 'last', v: 1, ttl: 3600 });
    expect((await ca.next()).k).toBe('last');
    ca.send({ t: 'set', k: 'over', v: 1, ttl: 3600 });
    expect(await ca.next()).toEqual({ t: 'error', code: 'limit', k: 'over' });
    ca.send({ t: 'set', k: 'last', v: 2, ttl: 3600 }); // 내 ttl 칸을 다시 놓는 것은 된다
    expect((await ca.next()).v).toBe(2);
    ca.send({ t: 'set', k: 'last', v: 3 }); // ttl 칸을 남는 칸으로 바꾸면 ttl 칸 자리가 하나 빈다
    expect((await ca.next()).exp).toBeUndefined();
    ca.send({ t: 'set', k: 'over', v: 1, ttl: 3600 });
    expect((await ca.next()).k).toBe('over');
    ca.send({ t: 'set', k: 'over2', v: 1, ttl: 3600 });
    expect(await ca.next()).toEqual({ t: 'error', code: 'limit', k: 'over2' });
    // 시간이 지난 ttl 칸은 세지 않는다 (한도에 닿으면 먼저 치운다)
    await runInDurableObject(stub(world), instance => { instance.sql.exec("UPDATE cells SET exp = ? WHERE k IN ('t0', 't1')", Date.now() - 1); });
    ca.send({ t: 'set', k: 'over2', v: 1, ttl: 3600 });
    expect((await ca.next()).k).toBe('over2');
    await runInDurableObject(stub(world), instance => {
      expect(instance.count(`t${a.id}`)).toBe(TTL_CELLS_PER_USER - 1); // t1 은 치웠고 아직 한 자리 남음
      expect(instance.count(`u${a.id}`)).toBe(1);
      expect(instance.count('total')).toBe(TTL_CELLS_PER_USER);
      instance.sql.exec('UPDATE cells SET exp = ? WHERE exp IS NOT NULL', Date.now() - 1);
    });
    await runDurableObjectAlarm(stub(world));
    await runInDurableObject(stub(world), instance => {
      expect(instance.count(`t${a.id}`)).toBe(0); // 알람이 치우면서 주인의 ttl 칸 수도 줄인다
      expect(instance.count('total')).toBe(1);
    });
    expect(b).toBeTruthy();
  });

  it('cell writes have their own rate (4/s, burst 20), skip unchanged values and stop at 2,000 a day', async () => {
    const world = newWorld();
    const a = await signup(), b = await signup();
    const ca = await join(a, world);
    const cb = await join(b, world); await ca.next();
    for (let i = 0; i < WRITE_BURST + 5; i++) ca.send({ t: 'set', k: `r${i}`, v: i });
    const got = [];
    for (let i = 0; i < WRITE_BURST + 5; i++) got.push(await ca.next());
    const errors = got.filter(m => m.t === 'error');
    expect(errors.length).toBeGreaterThanOrEqual(4);
    expect(errors[0]).toMatchObject({ code: 'rate' });
    expect(errors[0].k).toMatch(/^r\d+$/);
    expect(got.filter(m => m.t === 'cell').length).toBeLessThanOrEqual(WRITE_BURST + 1);
    while (await cb.quiet(100)) { /* 받은 칸 비우기 */ }
    await sleep(1500);

    // 값이 그대로면 쓰지 않고, 보낸 사람에게만 돌려준다
    const before = await runInDurableObject(stub(world), instance => instance.sql.exec("SELECT updated FROM cells WHERE k = 'r0'").one().updated);
    await sleep(5);
    ca.send({ t: 'set', k: 'r0', v: 0 });
    expect(await ca.next()).toMatchObject({ t: 'cell', k: 'r0', v: 0 });
    expect(await cb.quiet()).toBeNull();
    await runInDurableObject(stub(world), instance => {
      expect(instance.sql.exec("SELECT updated FROM cells WHERE k = 'r0'").one().updated).toBe(before);
      expect(instance.count(`u${a.id}`)).toBe(got.filter(m => m.t === 'cell').length); // 바꾸기는 칸 수를 건드리지 않는다
    });
    ca.send({ t: 'set', k: 'r0', v: 'changed' });
    expect((await cb.next()).v).toBe('changed');
    await ca.next();

    // 하루 한도: 오늘 1,999번 바꾼 것으로 해 둔다
    await runInDurableObject(stub(world), instance => {
      instance.flushDay(a.id);
      const day = instance.dayOf(a.id);
      instance.add(day.key, WRITES_PER_DAY - 1 - day.base);
      day.base = WRITES_PER_DAY - 1;
    });
    ca.send({ t: 'set', k: 'r0', v: 'last' });
    expect((await ca.next()).v).toBe('last');
    ca.send({ t: 'del', k: 'r0' });
    expect(await ca.next()).toEqual({ t: 'error', code: 'limit-day', k: 'r0' });
    // 나가면 모아 둔 횟수를 적는다
    ca.close();
    await cb.until(m => m.t === 'leave');
    await runInDurableObject(stub(world), instance => {
      const key = `d${new Date().toISOString().slice(0, 10).replace(/-/g, '')}:${a.id}`;
      expect(instance.count(key)).toBe(WRITES_PER_DAY);
      instance.add(`d20000101:${a.id}`, 5);
      instance.prunedDay = '';
      instance.pruneDays();
      expect(instance.count(`d20000101:${a.id}`)).toBe(0); // 지난날 횟수는 지운다
      expect(instance.count(key)).toBe(WRITES_PER_DAY);
    });
  });

  it('rejects phone numbers split across strings in cells and poses, and masks them in messages', async () => {
    const world = newWorld();
    const a = await signup(), b = await signup();
    const ca = await join(a, world);
    const cb = await join(b, world); await ca.next();
    const split = [['010', '1234', '5678'], { '010': '1234', x: '5678' }];
    for (const v of split) {
      ca.send({ t: 'set', k: 'sign', v });
      expect(await ca.next(), JSON.stringify(v)).toEqual({ t: 'error', code: 'bad', k: 'sign' });
      ca.send({ t: 'pose', d: v });
      expect(await ca.next(), JSON.stringify(v)).toEqual({ t: 'error', code: 'bad' });
    }
    ca.send({ t: 'set', k: 'sign', v: ['naver', '.com'] });
    expect(await ca.next()).toEqual({ t: 'error', code: 'bad', k: 'sign' });
    expect(await cb.quiet()).toBeNull();
    ca.send({ t: 'send', data: split[0] });
    expect(await cb.next()).toEqual({ t: 'msg', from: 'p1', data: ['***', '****', '****'] });
    ca.send({ t: 'send', data: split[1] });
    expect(await cb.next()).toEqual({ t: 'msg', from: 'p1', data: { '***': '****', x: '****' } });
    // 보통 게임 데이터는 그대로
    ca.send({ t: 'set', k: 'ok', v: { b: 'stone', c: 'red', n: ['12', '5', '30'] } });
    expect((await cb.next()).v).toEqual({ b: 'stone', c: 'red', n: ['12', '5', '30'] });
    ca.send({ t: 'pose', d: { anim: 'run', id: 'p12', x: 1 } });
    await ca.next();
    expect(await cb.next()).toEqual({ t: 'pose', id: 'p1', d: { anim: 'run', id: 'p12', x: 1 } });
  });

  it('a message that fails filtering does not use the chat budget or reach the chat log', async () => {
    const world = newWorld();
    const a = await signup(), b = await signup();
    const ca = await join(a, world);
    const cb = await join(b, world); await ca.next();
    let deep = 1;
    for (let i = 0; i < 10; i++) deep = [deep];
    for (let i = 0; i < 8; i++) ca.send({ t: 'send', data: { chat: `secret ${i}`, deep } });
    for (let i = 0; i < 8; i++) expect(await ca.next()).toEqual({ t: 'error', code: 'bad' });
    expect(await cb.quiet()).toBeNull();
    expect((await stub(world).chatLog()).lines).toEqual([]);
    ca.send({ t: 'send', data: { chat: 'hi' } }); // 채팅 횟수(몰아서 5줄)는 그대로
    expect(await cb.next()).toEqual({ t: 'msg', from: 'p1', data: { chat: 'hi' } });
  });

  it('rejoining does not push the sweep alarm back, and a far alarm is pulled in', async () => {
    const world = newWorld();
    const a = await signup(), b = await signup();
    await join(a, world);
    const first = await runInDurableObject(stub(world), (_i, state) => state.storage.getAlarm());
    expect(first).toBeLessThanOrEqual(Date.now() + SWEEP_MS);
    await sleep(30);
    await join(a, world); // 다시 들어오기 (바꿔 끼기)
    expect(await runInDurableObject(stub(world), (_i, state) => state.storage.getAlarm())).toBe(first);
    // 모두 나간 뒤의 채팅 지우기 알람(10분 뒤)처럼 먼 알람은 사람이 들어오면 당긴다
    await runInDurableObject(stub(world), (_i, state) => state.storage.setAlarm(Date.now() + 10 * 60 * 1000));
    await join(b, world);
    expect(await runInDurableObject(stub(world), (_i, state) => state.storage.getAlarm())).toBeLessThanOrEqual(Date.now() + SWEEP_MS);
  });

  it('two people who blocked each other joining at the same time still do not see each other', async () => {
    const world = newWorld();
    const a = await signup(), b = await signup(), c = await signup();
    await api(`/blocks/${b.id}`, { method: 'POST', token: a.token });
    const cc = await join(c, world);
    await slowBlocks(world);
    const [ca, cb] = await Promise.all([join(a, world), join(b, world)]);
    await cc.next(); await cc.next(); // join 두 번
    ca.send({ t: 'pose', d: 'a' });
    expect(await cc.next()).toEqual({ t: 'pose', id: ca.welcome.id, d: 'a' });
    cb.send({ t: 'pose', d: 'b' });
    expect(await cc.next()).toEqual({ t: 'pose', id: cb.welcome.id, d: 'b' });
    const seen = [];
    for (const m of [await ca.quiet(), await ca.quiet(), await cb.quiet(), await cb.quiet()]) if (m?.t === 'pose') seen.push(m);
    expect(seen).toEqual([]);
  });

  it('two people joining the 12th seat at the same time: only one gets in', async () => {
    const crowd = newWorld();
    const users = await Promise.all(Array.from({ length: WORLD_MAX + 1 }, () => signup()));
    for (const u of users.slice(0, WORLD_MAX - 1)) await join(u, crowd);
    await slowBlocks(crowd);
    const tickets = [await ticketFor(users[WORLD_MAX - 1]), await ticketFor(users[WORLD_MAX])];
    const both = await Promise.all(tickets.map(t => connect(`/worlds/${game}/${crowd}?ticket=${t}`)));
    const firsts = await Promise.all(both.map(x => x.next()));
    expect(firsts.map(m => m.t).sort()).toEqual(['error', 'welcome']);
    expect(firsts.find(m => m.t === 'error')).toEqual({ t: 'error', code: 'full', max: WORLD_MAX });
  });

  it('blocking or unblocking while both are in the world takes effect right away', async () => {
    const world = newWorld();
    const a = await signup(), b = await signup(), c = await signup();
    const ca = await join(a, world);
    const cb = await join(b, world); await ca.next();
    const cc = await join(c, world); await ca.next(); await cb.next();
    expect((await api(`/blocks/${b.id}`, { method: 'POST', token: a.token })).status).toBe(200);
    cb.send({ t: 'pose', d: 1 });
    expect(await cc.next()).toEqual({ t: 'pose', id: 'p2', d: 1 });
    expect(await ca.quiet()).toBeNull();
    ca.send({ t: 'send', to: 'p2', data: 'hi' });
    expect(await cb.quiet()).toBeNull();
    expect((await api(`/blocks/${b.id}`, { method: 'DELETE', token: a.token })).status).toBe(200);
    cb.send({ t: 'pose', d: 2 });
    expect(await ca.next()).toEqual({ t: 'pose', id: 'p2', d: 2 });
  });
});

describe('@inhyuk/net World client against the real worker', () => {
  const options = world => ({
    game, world, server: 'wss://net.test',
    fetch: (url, init = {}) => SELF.fetch(url, { ...init, headers: { ...init.headers, Origin: ORIGIN } }),
    connect: async url => {
      const res = await SELF.fetch(url.replace(/^wss:/, 'https:'), { headers: { Upgrade: 'websocket', Origin: ORIGIN } });
      if (!res.webSocket) throw new Error(`no websocket (${res.status})`);
      return res.webSocket;
    },
  });
  const waitFor = async (check, ms = 2000) => {
    const end = Date.now() + ms;
    while (!check()) { if (Date.now() > end) throw new Error('timed out'); await sleep(10); }
  };

  it('two players share cells, poses and chat; cells stay after both leave', async () => {
    const world = newWorld();
    const a = await signup(), b = await signup();
    const got = { pose: [], message: [], cell: [] };
    const wa = new Client({ cell: (k, e) => got.cell.push([k, e]) }, options(world));
    const wb = new Client({ pose: (id, d) => got.pose.push([id, d]), message: (d, f) => got.message.push([d, f]) }, options(world));
    await wa.open(await ticketFor(a));
    expect(wa.ready).toBe(true);
    await wb.open(await ticketFor(b));
    await waitFor(() => wa.peers.size === 1);
    expect(wa.peers.get(wb.id)).toEqual({ id: b.id, nickname: b.nickname });
    wa.set('0|0|0', { b: 1 });
    await waitFor(() => wb.cells.has('0|0|0'));
    expect(wb.cells.get('0|0|0')).toEqual({ v: { b: 1 }, owner: { id: a.id, nickname: a.nickname } });
    wa.pose({ x: 1 });
    await waitFor(() => got.pose.length === 1);
    expect(got.pose[0]).toEqual([wa.id, { x: 1 }]);
    wa.chat('안녕');
    await waitFor(() => got.message.length === 1);
    expect(got.message[0]).toEqual([{ chat: '안녕' }, wa.id]);
    wa.close(); wb.close();
    await sleep(100);
    const wc = new Client({}, options(world));
    await wc.open(await ticketFor(b));
    expect([...wc.cells.keys()]).toEqual(['0|0|0']);
    wc.close();
  });
});
