// 모든 게임이 같이 쓰는 멀티플레이 중계 서버 (Cloudflare Worker + Durable Object).
// 서버는 게임 내용을 모른다. 방에 들어온 사람에게 번호를 주고, 들어오고 나간 걸 알리고,
// 게임이 보낸 JSON을 그대로 다른 사람에게 전해 줄 뿐이다. 메시지 내용은 저장하거나 로그로 남기지 않는다.
import { DurableObject } from 'cloudflare:workers';

export const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
export const GAME_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;
export const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4,8}$/;
export const DEFAULT_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const MAX_MESSAGE_BYTES = 16 * 1024;
export const PING = '{"t":"ping"}';
export const PONG = '{"t":"pong"}';

// 방을 만들고 아무도 안 들어오면 2분 뒤 지운다.
const RESERVE_MS = 2 * 60 * 1000;
// 15초마다 살펴서 30초 동안 아무 소식 없는 사람은 내보낸다.
const SWEEP_MS = 15 * 1000;
const STALE_MS = 30 * 1000;
// 한 연결이 1초에 보낼 수 있는 메시지: 평소 30개, 몰아서 60개까지.
const RATE_PER_SECOND = 30;
const RATE_BURST = 60;

const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function allowedOrigin(origin, env) {
  if (!origin) return false;
  if (LOCAL_ORIGIN.test(origin)) return true;
  const list = String(env?.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  return list.includes(origin);
}

export function clampPlayers(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_PLAYERS;
  return Math.min(MAX_PLAYERS, Math.max(2, n));
}

function randomCode() {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return [...bytes].map(n => ALPHABET[n % ALPHABET.length]).join('');
}

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') ?? '';
    const parts = url.pathname.split('/').filter(Boolean);

    if (parts.length === 0 && request.method === 'GET') return new Response('inhyuk net ok\n');
    if (parts[0] !== 'rooms' || parts.length < 2 || parts.length > 3) return new Response('not found', { status: 404 });
    if (!allowedOrigin(origin, env)) return new Response('origin not allowed', { status: 403 });
    const headers = cors(origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });

    const game = parts[1];
    if (!GAME_RE.test(game)) return json({ error: 'bad-game' }, 400, headers);

    // POST /rooms/:game  → 아직 아무도 안 쓰는 새 방 코드를 하나 잡아 준다.
    if (parts.length === 2) {
      if (request.method !== 'POST') return json({ error: 'method' }, 405, headers);
      let body = {};
      try { body = await request.json(); } catch { /* 빈 몸이면 기본값 */ }
      const maxPlayers = clampPlayers(body?.maxPlayers ?? DEFAULT_PLAYERS);
      for (let tries = 0; tries < 5; tries++) {
        const code = randomCode();
        const stub = env.ROOMS.get(env.ROOMS.idFromName(`${game}:${code}`));
        if (await stub.reserve(maxPlayers)) return json({ code, maxPlayers }, 200, headers);
      }
      return json({ error: 'busy' }, 503, headers);
    }

    // GET /rooms/:game/:code (WebSocket) → 그 방에 들어간다.
    const code = parts[2];
    if (!CODE_RE.test(code)) return json({ error: 'bad-code' }, 400, headers);
    if (request.method !== 'GET' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return json({ error: 'websocket-only' }, 426, headers);
    }
    return env.ROOMS.get(env.ROOMS.idFromName(`${game}:${code}`)).fetch(request);
  },
};

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // 핑은 방을 깨우지 않고 런타임이 바로 대답한다 (잠든 방은 요금이 거의 안 든다).
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
    this.buckets = new Map();
  }

  async reserve(maxPlayers) {
    if (this.peers().length || (await this.ctx.storage.get('room'))) return false;
    await this.ctx.storage.put('room', { max: clampPlayers(maxPlayers), host: '', next: 1, reservedAt: Date.now() });
    await this.ctx.storage.setAlarm(Date.now() + RESERVE_MS);
    return true;
  }

  async fetch() {
    const [client, server] = Object.values(new WebSocketPair());
    const room = await this.ctx.storage.get('room');
    const peers = this.peers();
    const refusal = !room ? 'not-found' : peers.length >= room.max ? 'full' : '';
    if (refusal) {
      // 거절할 연결은 잠들기(hibernation) 목록에 넣지 않고 이유만 알려 주고 닫는다.
      server.accept();
      server.send(JSON.stringify({ t: 'error', code: refusal, max: room?.max }));
      server.close(refusal === 'full' ? 4403 : 4404, refusal);
      return new Response(null, { status: 101, webSocket: client });
    }
    const id = `p${room.next++}`;
    if (!room.host) room.host = id;
    await this.ctx.storage.put('room', room);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id, joined: Date.now() });
    server.send(JSON.stringify({ t: 'welcome', id, host: room.host, max: room.max, peers: peers.map(p => p.id) }));
    this.broadcast({ t: 'join', id }, server);
    await this.ctx.storage.setAlarm(Date.now() + SWEEP_MS);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    const me = ws.deserializeAttachment();
    if (!me) return;
    this.lastHeard(ws, true);
    if (typeof message !== 'string') return this.warn(ws, 'bad');
    if (message.length > MAX_MESSAGE_BYTES || (message.length * 3 > MAX_MESSAGE_BYTES && new TextEncoder().encode(message).length > MAX_MESSAGE_BYTES)) {
      return this.warn(ws, 'too-big');
    }
    if (!this.allow(ws)) return;
    let msg;
    try { msg = JSON.parse(message); } catch { return this.warn(ws, 'bad'); }
    if (!msg || typeof msg !== 'object') return this.warn(ws, 'bad');
    if (msg.t === 'ping') return ws.send(PONG);
    if (msg.t === 'bye') { this.close(ws, 1000, 'bye'); return this.departed(ws); }
    if (msg.t !== 'send' || msg.data === undefined) return this.warn(ws, 'bad');
    const out = JSON.stringify({ t: 'msg', from: me.id, data: msg.data });
    if (typeof msg.to === 'string') {
      const target = this.peers().find(p => p.id === msg.to);
      if (target) safeSend(target.ws, out);
      return;
    }
    for (const p of this.peers()) if (p.ws !== ws) safeSend(p.ws, out);
  }

  async webSocketClose(ws, code) {
    this.close(ws, code === 1005 || code === 1006 ? 1000 : code, 'closed');
    await this.departed(ws);
  }

  async webSocketError(ws) {
    await this.departed(ws);
  }

  async alarm() {
    const room = await this.ctx.storage.get('room');
    if (!room) return;
    const now = Date.now();
    let peers = this.peers();
    for (const p of peers) {
      if (now - this.lastHeard(p.ws) > STALE_MS) {
        this.close(p.ws, 4408, 'timeout');
        await this.departed(p.ws);
      }
    }
    peers = this.peers();
    if (peers.length) { await this.ctx.storage.setAlarm(now + SWEEP_MS); return; }
    const latest = await this.ctx.storage.get('room');
    if (!latest) return;
    // 아무도 없는 방: 만든 지 2분이 지났으면 지우고, 아니면 그때 다시 본다.
    if (latest.host || now >= latest.reservedAt + RESERVE_MS) await this.clear();
    else await this.ctx.storage.setAlarm(latest.reservedAt + RESERVE_MS);
  }

  // 지금 방에 있는 사람들 (들어온 순서대로)
  peers() {
    const list = [];
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const a = ws.deserializeAttachment();
      if (a?.id && !a.gone) list.push({ ws, id: a.id, joined: a.joined });
    }
    return list.sort((a, b) => a.joined - b.joined || Number(a.id.slice(1)) - Number(b.id.slice(1)));
  }

  broadcast(message, except) {
    const text = JSON.stringify(message);
    for (const p of this.peers()) if (p.ws !== except) safeSend(p.ws, text);
  }

  async departed(ws) {
    const me = ws.deserializeAttachment();
    if (!me?.id || me.gone) return;
    try { ws.serializeAttachment({ ...me, gone: true }); } catch { /* 이미 닫힘 */ }
    this.buckets.delete(ws);
    const room = await this.ctx.storage.get('room');
    if (!room) return;
    const rest = this.peers().filter(p => p.ws !== ws);
    if (!rest.length) { await this.clear(); return; }
    this.broadcast({ t: 'leave', id: me.id }, ws);
    // 방장이 나가면 가장 먼저 들어온 사람이 새 방장이 된다.
    if (room.host === me.id) {
      room.host = rest[0].id;
      await this.ctx.storage.put('room', room);
      this.broadcast({ t: 'host', id: room.host }, ws);
    }
  }

  async clear() {
    this.buckets.clear();
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  // 마지막으로 소식을 들은 때. 잠들었다 깨면 메모리 기록은 사라지므로 자동 핑 시각도 같이 본다.
  lastHeard(ws, touch = false) {
    let bucket = this.buckets.get(ws);
    if (!bucket) { bucket = { tokens: RATE_BURST, at: Date.now(), heard: 0 }; this.buckets.set(ws, bucket); }
    if (touch) bucket.heard = Date.now();
    const auto = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? 0;
    const joined = ws.deserializeAttachment()?.joined ?? 0;
    return Math.max(bucket.heard, auto, joined);
  }

  allow(ws) {
    const bucket = this.buckets.get(ws);
    const now = Date.now();
    bucket.tokens = Math.min(RATE_BURST, bucket.tokens + ((now - bucket.at) / 1000) * RATE_PER_SECOND);
    bucket.at = now;
    if (bucket.tokens >= 1) { bucket.tokens -= 1; return true; }
    if (!bucket.warned || now - bucket.warned > 1000) { bucket.warned = now; this.warn(ws, 'rate'); }
    return false;
  }

  warn(ws, code) { safeSend(ws, JSON.stringify({ t: 'error', code })); }

  close(ws, code, reason) { try { ws.close(code, reason); } catch { /* 이미 닫힘 */ } }
}

function safeSend(ws, text) { try { ws.send(text); } catch { /* 닫히는 중 */ } }
