// 같이 쓰는 세계(World): 로그인, 칸 주인, 남는 칸, ttl, 한도, 거르기, 채팅, 인원, 바꿔 끼기, 차단, 횟수 제한, 신고, 정지
import { describe, it, expect } from 'vitest';
import { SELF, env, runInDurableObject, runDurableObjectAlarm } from 'cloudflare:test';
import { api, signup, connect, ticketFor, ORIGIN, sleep } from './helpers.js';
import { maskText } from '../src/filter.js';
import { CELLS_PER_USER, CELLS_PER_WORLD, WORLD_MAX } from '../src/world.js';
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
