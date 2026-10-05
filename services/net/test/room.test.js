// 로컬 Workers 런타임(workerd)에서 진짜 Worker와 Durable Object를 띄워 여러 사람이 접속해 본다.
import { describe, it, expect } from 'vitest';
import { SELF, env, runInDurableObject, runDurableObjectAlarm } from 'cloudflare:test';
import { CODE_RE, MAX_MESSAGE_BYTES, PING, PONG } from '../src/rooms.js';
import { Room as Client } from '../../../packages/net/index.mjs';

const ORIGIN = 'https://seonn.dev';
const BASE = 'https://net.test';

async function create(game = 'test-game', body = {}, origin = ORIGIN) {
  return SELF.fetch(`${BASE}/rooms/${game}`, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
async function newCode(game = 'test-game', maxPlayers) {
  const res = await create(game, maxPlayers ? { maxPlayers } : {});
  expect(res.status).toBe(200);
  return (await res.json()).code;
}

// 받은 메시지를 줄 세워 두고 하나씩 꺼내 보는 접속자
async function connect(code, { game = 'test-game', origin = ORIGIN } = {}) {
  const res = await SELF.fetch(`${BASE}/rooms/${game}/${code}`, { headers: { Upgrade: 'websocket', Origin: origin } });
  const ws = res.webSocket;
  if (!ws) return { res };
  const inbox = [], waiters = [];
  let closed = null;
  const push = item => { const w = waiters.shift(); if (w) w(item); else inbox.push(item); };
  ws.addEventListener('message', e => push(JSON.parse(e.data)));
  ws.addEventListener('close', e => { closed = { code: e.code }; push({ t: '__closed', code: e.code }); });
  ws.accept();
  const next = (ms = 2000) => inbox.length ? Promise.resolve(inbox.shift()) : new Promise((resolve, reject) => {
    const waiter = item => { clearTimeout(timer); resolve(item); };
    const timer = setTimeout(() => { waiters.splice(waiters.indexOf(waiter), 1); reject(new Error('no message')); }, ms);
    waiters.push(waiter);
  });
  const until = async (pred, ms = 2000) => { for (;;) { const m = await next(ms); if (pred(m)) return m; } };
  const quiet = async (ms = 150) => { try { return await next(ms); } catch { return null; } };
  return {
    res, ws, next, until, quiet, get closed() { return closed; }, inbox,
    send: obj => ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj)),
  };
}

describe('http', () => {
  it('answers health checks', async () => {
    const res = await SELF.fetch(`${BASE}/`);
    expect(res.status).toBe(200);
  });

  it('creates rooms with a valid code and clamps maxPlayers', async () => {
    let res = await create();
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    let body = await res.json();
    expect(body.code).toMatch(CODE_RE);
    expect(body.code).toHaveLength(6);
    expect(body.maxPlayers).toBe(2);
    body = await (await create('test-game', { maxPlayers: 99 })).json();
    expect(body.maxPlayers).toBe(8);
    body = await (await create('test-game', { maxPlayers: 4 })).json();
    expect(body.maxPlayers).toBe(4);
  });

  it('allows seonn.dev, localhost and the Capacitor app; rejects other origins', async () => {
    for (const origin of ['https://seonn.dev', 'http://localhost:5173', 'http://127.0.0.1:3000', 'capacitor://localhost', 'https://localhost']) {
      expect((await create('test-game', {}, origin)).status, origin).toBe(200);
    }
    for (const origin of ['https://evil.example', 'https://seonn.dev.evil.example', 'http://localhost.evil.example', '']) {
      expect((await create('test-game', {}, origin)).status, origin).toBe(403);
    }
    const preflight = await SELF.fetch(`${BASE}/rooms/test-game`, { method: 'OPTIONS', headers: { Origin: 'capacitor://localhost' } });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('capacitor://localhost');
  });

  it('rejects a websocket from a bad origin before it reaches the room', async () => {
    const code = await newCode();
    const bad = await connect(code, { origin: 'https://evil.example' });
    expect(bad.ws).toBeFalsy();
    expect(bad.res.status).toBe(403);
  });

  it('validates game names and codes', async () => {
    expect((await create('Bad_Game')).status).toBe(400);
    expect((await create('a'.repeat(40))).status).toBe(400);
    const bad = await connect('ABC0EF'); // 0은 코드에 쓰지 않는 글자
    expect(bad.res.status).toBe(400);
    const plain = await SELF.fetch(`${BASE}/rooms/test-game/ABCDEF`, { headers: { Origin: ORIGIN } });
    expect(plain.status).toBe(426);
  });
});

describe('rooms', () => {
  it('joins two players and relays messages both ways', async () => {
    const code = await newCode();
    const host = await connect(code);
    expect(await host.next()).toEqual({ t: 'welcome', id: 'p1', host: 'p1', max: 2, peers: [] });
    const guest = await connect(code);
    expect(await guest.next()).toEqual({ t: 'welcome', id: 'p2', host: 'p1', max: 2, peers: ['p1'] });
    expect(await host.next()).toEqual({ t: 'join', id: 'p2' });

    guest.send({ t: 'send', data: { t: 'move', x: 3 } });
    expect(await host.next()).toEqual({ t: 'msg', from: 'p2', data: { t: 'move', x: 3 } });
    host.send({ t: 'send', data: [1, 2, 3] });
    expect(await guest.next()).toEqual({ t: 'msg', from: 'p1', data: [1, 2, 3] });
    expect(await host.quiet()).toBeNull(); // 보낸 사람에게는 되돌아오지 않는다
  });

  it('sends to one peer with sendTo-style messages', async () => {
    const code = await newCode('test-game', 3);
    const a = await connect(code); await a.next();
    const b = await connect(code); await b.next(); await a.next();
    const c = await connect(code); await c.next(); await a.next(); await b.next();
    a.send({ t: 'send', to: 'p3', data: 'only-you' });
    expect(await c.next()).toEqual({ t: 'msg', from: 'p1', data: 'only-you' });
    expect(await b.quiet()).toBeNull();
  });

  it('refuses a player when the room is full', async () => {
    const code = await newCode();
    const a = await connect(code); await a.next();
    const b = await connect(code); await b.next();
    const c = await connect(code);
    expect(await c.next()).toEqual({ t: 'error', code: 'full', max: 2 });
    expect(await c.next()).toEqual({ t: '__closed', code: 4403 });
    expect(await a.until(m => m.t === 'join')).toEqual({ t: 'join', id: 'p2' });
    expect(await a.quiet()).toBeNull(); // 거절된 사람은 들어온 것으로 치지 않는다
  });

  it('says not-found for a code nobody made', async () => {
    const c = await connect('ZZZZZZ');
    expect(await c.next()).toEqual({ t: 'error', code: 'not-found' });
    expect(await c.next()).toEqual({ t: '__closed', code: 4404 });
  });

  it('keeps one room per game: the same code in another game is a different room', async () => {
    const code = await newCode('game-a');
    const other = await connect(code, { game: 'game-b' });
    expect((await other.next()).code).toBe('not-found');
  });

  it('promotes the earliest remaining player when the host leaves', async () => {
    const code = await newCode('test-game', 3);
    const a = await connect(code); await a.next();
    const b = await connect(code); await b.next();
    const c = await connect(code); await c.next();
    a.ws.close(1000, 'bye');
    expect(await b.until(m => m.t === 'leave')).toEqual({ t: 'leave', id: 'p1' });
    expect(await b.next()).toEqual({ t: 'host', id: 'p2' });
    expect(await c.until(m => m.t === 'host')).toEqual({ t: 'host', id: 'p2' });
    const d = await connect(code);
    expect(await d.next()).toEqual({ t: 'welcome', id: 'p4', host: 'p2', max: 3, peers: ['p2', 'p3'] });
  });

  it('a bye message leaves the room like closing does', async () => {
    const code = await newCode();
    const a = await connect(code); await a.next();
    const b = await connect(code); await b.next(); await a.next();
    b.send({ t: 'bye' });
    expect(await a.next()).toEqual({ t: 'leave', id: 'p2' });
  });

  it('rejects oversized messages without relaying them', async () => {
    const code = await newCode();
    const a = await connect(code); await a.next();
    const b = await connect(code); await b.next(); await a.next();
    b.send({ t: 'send', data: 'x'.repeat(MAX_MESSAGE_BYTES) });
    expect(await b.next()).toEqual({ t: 'error', code: 'too-big' });
    b.send({ t: 'send', data: '한'.repeat(Math.ceil(MAX_MESSAGE_BYTES / 3) + 10) }); // 글자 수는 작아도 바이트로 크다
    expect(await b.next()).toEqual({ t: 'error', code: 'too-big' });
    expect(await a.quiet()).toBeNull();
    b.send({ t: 'send', data: 'small' });
    expect(await a.next()).toEqual({ t: 'msg', from: 'p2', data: 'small' });
  });

  it('rejects malformed messages', async () => {
    const code = await newCode();
    const a = await connect(code); await a.next();
    a.send('not json');
    expect(await a.next()).toEqual({ t: 'error', code: 'bad' });
    a.send({ t: 'chat', text: 'hi' });
    expect(await a.next()).toEqual({ t: 'error', code: 'bad' });
  });

  it('rate-limits a flooding connection', async () => {
    const code = await newCode();
    const a = await connect(code); await a.next();
    const b = await connect(code); await b.next(); await a.next();
    for (let i = 0; i < 150; i++) b.send({ t: 'send', data: i });
    expect(await b.until(m => m.t === 'error')).toEqual({ t: 'error', code: 'rate' });
    let relayed = 0;
    while (await a.quiet(200)) relayed++;
    expect(relayed).toBeGreaterThan(0);
    expect(relayed).toBeLessThan(150);
  });

  it('answers keepalive pings', async () => {
    const code = await newCode();
    const a = await connect(code); await a.next();
    a.send(PING);
    expect(await a.next()).toEqual(JSON.parse(PONG));
    a.send({ t: 'ping', n: 1 }); // 글자가 조금 달라도 대답한다
    expect(await a.next()).toEqual(JSON.parse(PONG));
  });
});

describe('cleanup', () => {
  const stub = (game, code) => env.ROOMS.get(env.ROOMS.idFromName(`${game}:${code}`));

  it('forgets a room once everyone has left', async () => {
    const code = await newCode();
    const a = await connect(code); await a.next();
    a.ws.close(1000, 'bye');
    await new Promise(r => setTimeout(r, 100));
    const again = await connect(code);
    expect((await again.next()).code).toBe('not-found');
  });

  it('removes a reserved room nobody joined after two minutes', async () => {
    const code = await newCode();
    const room = stub('test-game', code);
    expect(await runDurableObjectAlarm(room)).toBe(true); // 아직 2분이 안 지나서 남아 있다
    expect((await connect(code)).ws).toBeTruthy();
  });

  it('removes a stale reservation when its alarm fires', async () => {
    const code = await newCode();
    const room = stub('test-game', code);
    await runInDurableObject(room, async (_instance, state) => {
      const saved = await state.storage.get('room');
      await state.storage.put('room', { ...saved, reservedAt: Date.now() - 10 * 60 * 1000 });
    });
    await runDurableObjectAlarm(room);
    expect((await (await connect(code)).next()).code).toBe('not-found');
  });

  it('drops players who went silent', async () => {
    const code = await newCode();
    const a = await connect(code); await a.next();
    const b = await connect(code); await b.next(); await a.next();
    const room = stub('test-game', code);
    // b가 오래전에 들어와서 그 뒤로 아무 소식이 없는 것처럼 만든다
    await runInDurableObject(room, async instance => {
      for (const ws of instance.ctx.getWebSockets()) {
        const me = ws.deserializeAttachment();
        if (me.id === 'p2') { ws.serializeAttachment({ ...me, joined: 0 }); instance.buckets.delete(ws); }
        else instance.lastHeard(ws, true);
      }
    });
    await runDurableObjectAlarm(room);
    expect(await a.next()).toEqual({ t: 'leave', id: 'p2' });
    expect(await b.until(m => m.t === '__closed')).toEqual({ t: '__closed', code: 4408 });
  });
});

describe('@inhyuk/net client against the real worker', () => {
  const options = extra => ({
    game: 'client-test', server: 'wss://net.test', ...extra,
    fetch: (url, init) => SELF.fetch(url, { ...init, headers: { ...init.headers, Origin: ORIGIN } }),
    connect: async url => {
      const res = await SELF.fetch(url.replace(/^wss:/, 'https:'), { headers: { Upgrade: 'websocket', Origin: ORIGIN } });
      if (!res.webSocket) throw new Error(`no websocket (${res.status})`);
      return res.webSocket;
    },
  });
  const recorder = () => {
    const log = { status: [], join: [], depart: [], message: [], host: [] };
    return {
      log, hooks: {
        status: (s, m) => log.status.push([s, m]), join: id => log.join.push(id), depart: id => log.depart.push(id),
        message: (d, f) => log.message.push([d, f]), host: id => log.host.push(id),
      },
    };
  };
  const waitFor = async (check, ms = 2000) => {
    const end = Date.now() + ms;
    while (!check()) { if (Date.now() > end) throw new Error('timed out'); await new Promise(r => setTimeout(r, 10)); }
  };

  it('host and guest find each other, talk, and the guest becomes host when the host leaves', async () => {
    const h = recorder(), g = recorder();
    const host = new Client(h.hooks, options({ maxPlayers: 3 }));
    const guest = new Client(g.hooks, options());
    await host.open();
    expect(host.status).toBe('waiting');
    expect(host.code).toMatch(CODE_RE);
    expect(host.maxPlayers).toBe(3);
    await guest.open(host.code.toLowerCase());
    expect(guest.status).toBe('connected');
    expect(guest.maxPlayers).toBe(3);
    await waitFor(() => host.status === 'connected');
    expect(host.peers).toEqual([guest.id]);
    expect(g.log.join).toEqual([host.id]);

    guest.send({ t: 'move', x: 1 });
    await waitFor(() => h.log.message.length === 1);
    expect(h.log.message[0]).toEqual([{ t: 'move', x: 1 }, guest.id]);
    host.sendTo(guest.id, { t: 'board' });
    await waitFor(() => g.log.message.length === 1);
    expect(g.log.message[0]).toEqual([{ t: 'board' }, host.id]);

    const hostId = host.id;
    host.leave();
    await waitFor(() => guest.status === 'waiting');
    expect(g.log.depart).toEqual([hostId]);
    expect(guest.host).toBe(true);
    guest.leave();
  });

  it('a third player is told the room is full', async () => {
    const a = new Client({}, options()), b = new Client({}, options());
    const c = recorder(), third = new Client(c.hooks, options());
    await a.open();
    await b.open(a.code);
    await expect(third.open(a.code)).rejects.toThrow('이 방은 벌써 2명이야. 다른 방을 만들어 줘.');
    expect(third.status).toBe('error');
    a.leave(); b.leave();
  });

  it('a wrong code says the room was not found', async () => {
    const lost = new Client({}, options());
    await expect(lost.open('ZZZZZZ')).rejects.toThrow('그 코드의 방을 찾을 수 없어.');
  });
});
