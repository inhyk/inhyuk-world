// 모든 게임이 같이 쓰는 멀티플레이 서버 (Cloudflare Worker + Durable Object + D1).
// 방(Room): 서버는 게임 내용을 모른다. 방에 들어온 사람에게 번호를 주고, 들어오고 나간 걸 알리고,
// 게임이 보낸 JSON을 그대로 다른 사람에게 전해 준다. 단, 채팅 글(data.chat)만은 거르개를 거쳐 보내고
// 신고에 쓰려고 마지막 50줄을 잠깐 기억한다. 랜덤 매칭, 초대로 만든 방(members)은 data 안의 모든 글자열을 거른다.
// 게임 데이터는 저장하거나 로그로 남기지 않는다.
// 관전: 관계자 방에는 로그인한 사람이 ?watch=1 로 보기만 하러 들어올 수 있다(자리, 방장, 인원 수와 상관없음).
// 관전하는 사람은 아무것도 보낼 수 없고, 채팅 글(data.chat)은 받지 않는다. 두 사람 중 누구와든 차단한 사이면 못 들어온다.
// 결과 보고: 관계자 방의 두 사람은 대전이 끝나면 { t:'report', n, won } 을 보낸다. 둘이 같으면(한 사람만 보냈으면 방이 빌 때) 온라인 승리 1개.
// 계정, 친구, 1:1 대화, 차단, 신고는 social.js, 게임 저장은 saves.js, 랭킹과 관전 목록은 stats.js,
// 접속 상태와 초대는 lobby.js, 랜덤 매칭은 match.js, 관리 페이지는 admin.js.
import { DurableObject } from 'cloudflare:workers';
import { allowedOrigin, cors, json, HttpError, internalRequest, readJson, clientIp } from './http.js';
import { CODE_RE, GAME_RE, DEFAULT_PLAYERS, clampPlayers, createRoom, roomStub, MAX_MESSAGE_BYTES, PING, PONG, CHAT_LINES } from './rooms.js';
import { filterText, maskText, maskSplitPhone } from './filter.js';
import * as auth from './auth.js';
import * as social from './social.js';
import * as saves from './saves.js';
import * as stats from './stats.js';
import { handleAdmin } from './admin.js';

// 이 파일은 Worker 의 시작점이라 default 와 Durable Object 클래스만 내보낸다.
// 글자나 숫자를 내보내면 wrangler dev / deploy 의 workerd 가 "not of type 'function or ExportedHandler'" 로 뜨지 않는다.
// 상수는 rooms.js 에서 가져다 쓴다.
export { Lobby } from './lobby.js';
export { Matchmaker } from './match.js';

// 방을 만들고 아무도 안 들어오면 2분 뒤 지운다.
const RESERVE_MS = 2 * 60 * 1000;
// 15초마다 살펴서 30초 동안 아무 소식 없는 사람은 내보낸다.
const SWEEP_MS = 15 * 1000;
const STALE_MS = 30 * 1000;
// 한 연결이 1초에 보낼 수 있는 메시지: 평소 30개, 몰아서 60개까지.
const RATE_PER_SECOND = 30;
const RATE_BURST = 60;
// 채팅은 따로 1초에 1줄, 몰아서 5줄까지.
const CHAT_PER_SECOND = 1;
const CHAT_BURST = 5;
// 모두 나간 뒤에도 신고할 수 있게 채팅 기록은 10분 더 둔다.
const CHAT_KEEP_MS = 10 * 60 * 1000;
// 나눠 보낸 전화번호를 찾을 때 볼 같은 사람의 앞줄: 30초 안의 2줄 (이번 줄까지 3줄)
const SPLIT_LINES = 2, SPLIT_MS = 30 * 1000;
// 관계자 방에서 data 를 거를 때 들어갈 깊이
const DATA_DEPTH = 8;
// 방 만들기: IP 하나에서 1분에 60번까지
const ROOMS_PER_MINUTE = 60;
// 한 방을 같이 보는 사람은 10명까지
const WATCH_MAX = 10;
// 관전 목록에 "아직 하는 중"이라고 5분마다 적는다 (목록은 12분 소식이 없으면 뺀다)
const LIVE_TOUCH_MS = 5 * 60 * 1000;
// 관전하러 들어온 사람에게 먼저 보내 줄 메시지(send 의 keep: true): 보낸 사람과 종류(data.t)마다 마지막 것, 8개, 4KB까지
const KEEP_MAX = 8, KEEP_BYTES = 4096;

const ROUTES = [
  ['POST', 'auth/signup', (r, e) => auth.signup(r, e)],
  ['POST', 'auth/login', (r, e) => auth.login(r, e)],
  ['POST', 'auth/logout', (r, e) => auth.logout(r, e)],
  ['POST', 'auth/ticket', (r, e) => auth.ticket(r, e)],
  ['GET', 'me', (r, e) => auth.me(r, e)],
  ['GET', 'users/search', social.search],
  ['GET', 'friends', social.listFriends],
  ['DELETE', 'friends/:id', social.removeFriend],
  ['GET', 'friends/requests', social.listRequests],
  ['POST', 'friends/requests', social.sendRequest],
  ['POST', 'friends/requests/:id/accept', social.acceptRequest],
  ['POST', 'friends/requests/:id/decline', social.declineRequest],
  ['DELETE', 'friends/requests/:id', social.cancelRequest],
  ['GET', 'blocks', social.listBlocks],
  ['POST', 'blocks/:id', social.block],
  ['DELETE', 'blocks/:id', social.unblock],
  ['GET', 'dm', social.unread],
  ['GET', 'dm/:id', social.history],
  ['POST', 'dm/:id', social.sendDm],
  ['POST', 'dm/:id/read', social.markRead],
  ['POST', 'invites', social.invite],
  ['POST', 'invites/:id/accept', social.acceptInvite],
  ['POST', 'invites/:id/decline', social.declineInvite],
  ['DELETE', 'invites/:id', social.cancelInvite],
  ['POST', 'reports', social.report],
  ['GET', 'saves/:game', saves.load],
  ['PUT', 'saves/:game', saves.store],
  ['PUT', 'stats/:game', stats.putStats],
  ['GET', 'rankings/:game', stats.rankings],
  ['GET', 'matches/:game', stats.matches],
];

function route(method, parts) {
  let allowed = false;
  for (const [m, pattern, handler] of ROUTES) {
    const want = pattern.split('/');
    if (want.length !== parts.length) continue;
    const params = {};
    if (!want.every((w, i) => (w.startsWith(':') ? ((params[w.slice(1)] = parts[i]), true) : w === parts[i]))) continue;
    if (m === method) return { handler, params };
    allowed = true;
  }
  return allowed ? { method: true } : null;
}

const isWebSocket = request => request.method === 'GET' && request.headers.get('Upgrade')?.toLowerCase() === 'websocket';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') ?? '';
    const parts = url.pathname.split('/').filter(Boolean).map(p => { try { return decodeURIComponent(p); } catch { return p; } });

    if (parts.length === 0 && request.method === 'GET') return new Response('inhyuk net ok\n');
    // 관리 페이지는 관리자 비밀번호로 들어가고, 같은 주소에서만 부른다 (CORS 없음).
    if (parts[0] === 'admin') return handleAdmin(request, env, parts.slice(1));

    const special = { rooms: parts.length >= 2 && parts.length <= 3, live: parts.length === 1, match: parts.length === 2 };
    const isSpecial = Object.hasOwn(special, parts[0] ?? '');
    const api = isSpecial ? null : route(request.method, parts);
    if (isSpecial ? !special[parts[0]] : !api) return new Response('not found', { status: 404 });
    if (!allowedOrigin(origin, env)) return new Response('origin not allowed', { status: 403 });
    const headers = cors(origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });

    try {
      if (parts[0] === 'rooms') return await rooms(request, env, parts, url, headers);
      if (parts[0] === 'live' || parts[0] === 'match') return await sockets(request, env, parts, url, headers);
      if (api.method) return json({ error: 'method' }, 405, headers);
      const response = await api.handler(request, env, api.params, url);
      for (const [k, v] of Object.entries(headers)) response.headers.set(k, v);
      return response;
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.code, ...error.extra }, error.status, headers);
      console.error('net error', error?.stack ?? error);
      return json({ error: 'server' }, 500, headers);
    }
  },
};

async function rooms(request, env, parts, url, headers) {
  const game = parts[1];
  if (!GAME_RE.test(game)) return json({ error: 'bad-game' }, 400, headers);

  // POST /rooms/:game  → 아직 아무도 안 쓰는 새 방 코드를 하나 잡아 준다.
  if (parts.length === 2) {
    if (request.method !== 'POST') return json({ error: 'method' }, 405, headers);
    await auth.limit(env, `rooms:${clientIp(request)}`, 60 * 1000, ROOMS_PER_MINUTE);
    const body = await readJson(request);
    const maxPlayers = clampPlayers(body?.maxPlayers ?? DEFAULT_PLAYERS);
    const code = await createRoom(env, game, { maxPlayers });
    return code ? json({ code, maxPlayers }, 200, headers) : json({ error: 'busy' }, 503, headers);
  }

  // GET /rooms/:game/:code (WebSocket) → 그 방에 들어간다. ?ticket= 이 있으면 누가 들어왔는지 방이 안다.
  // ?watch=1 은 보기만 하러 들어간다 (관전). 로그인한 사람만.
  const code = parts[2];
  if (!CODE_RE.test(code)) return json({ error: 'bad-code' }, 400, headers);
  if (!isWebSocket(request)) return json({ error: 'websocket-only' }, 426, headers);
  let user = null;
  if (url.searchParams.has('ticket')) {
    user = await auth.useTicket(env, url.searchParams.get('ticket'));
    if (!user) return json({ error: 'bad-ticket' }, 401, headers);
  }
  const watch = url.searchParams.get('watch') === '1';
  if (watch && !user) return json({ error: 'login-required' }, 401, headers);
  return roomStub(env, game, code).fetch(internalRequest(request, { 'X-Net-User': user?.id, 'X-Net-Watch': watch ? '1' : undefined }));
}

// GET /live?ticket=  (접속 상태와 알림),  GET /match/:game?ticket=  (랜덤 매칭 줄)
async function sockets(request, env, parts, url, headers) {
  if (!isWebSocket(request)) return json({ error: 'websocket-only' }, 426, headers);
  if (parts[0] === 'match' && !GAME_RE.test(parts[1])) return json({ error: 'bad-game' }, 400, headers);
  const user = await auth.useTicket(env, url.searchParams.get('ticket'));
  if (!user) return json({ error: 'bad-ticket' }, 401, headers);
  const forwarded = internalRequest(request, { 'X-Net-User': user.id, 'X-Net-Nick': encodeURIComponent(user.nickname), 'X-Net-Game': parts[1] });
  const stub = parts[0] === 'live' ? social.lobby(env) : env.MATCH.get(env.MATCH.idFromName(parts[1]));
  return stub.fetch(forwarded);
}

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // 핑은 방을 깨우지 않고 런타임이 바로 대답한다 (잠든 방은 요금이 거의 안 든다).
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
    this.buckets = new Map();
  }

  // members: 이 사용자 번호들만 들어올 수 있다 (랜덤 매칭, 친구 초대로 만든 방). 없으면 코드를 아는 누구나.
  // name: '<게임>:<코드>' (정지할 때 이 방을 찾아오려고 기억한다)
  async reserve(maxPlayers, members = null, name = '') {
    if (this.peers().length || (await this.ctx.storage.get('room'))) return false;
    const room = { max: clampPlayers(maxPlayers), host: '', next: 1, reservedAt: Date.now(), name };
    if (Array.isArray(members) && members.length) room.members = members.map(Number);
    await this.ctx.storage.delete('chat'); // 같은 코드를 예전에 쓴 방의 채팅 기록은 버린다
    await this.ctx.storage.put('room', room);
    await this.ctx.storage.setAlarm(Date.now() + RESERVE_MS);
    return true;
  }

  async fetch(request) {
    const [client, server] = Object.values(new WebSocketPair());
    const room = await this.ctx.storage.get('room');
    const uid = Number(request.headers.get('X-Net-User')) || null;
    if (request.headers.get('X-Net-Watch') === '1') return this.watch(room, uid, server, client);
    const peers = this.peers();
    // 한 사람(사용자 번호)은 자리 하나. 같은 사람이 또 들어오면 새 자리를 주지 않고 예전 연결을 바꿔 낀다.
    const seat = uid ? peers.find(p => p.uid === uid) : null;
    const refusal = !room ? 'not-found' : room.members && !room.members.includes(uid) ? 'not-member' : !seat && peers.length >= room.max ? 'full' : '';
    if (refusal) {
      // 거절할 연결은 잠들기(hibernation) 목록에 넣지 않고 이유만 알려 주고 닫는다.
      server.accept();
      server.send(JSON.stringify({ t: 'error', code: refusal, max: room?.max }));
      server.close(refusal === 'full' ? 4403 : refusal === 'not-member' ? 4401 : 4404, refusal);
      return new Response(null, { status: 101, webSocket: client });
    }
    const member = !!room.members;
    if (seat) {
      // 번호(p1, p2)와 방장 자리는 그대로 두고 연결만 바꾼다. 남은 사람에게 rejoin 을 알려 게임이 화면을 다시 맞추게 한다.
      const old = seat.ws.deserializeAttachment();
      try { seat.ws.serializeAttachment({ ...old, gone: true }); } catch { /* 이미 닫힘 */ }
      this.buckets.delete(seat.ws);
      safeSend(seat.ws, JSON.stringify({ t: 'error', code: 'replaced' }));
      this.close(seat.ws, 4409, 'replaced');
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ id: old.id, joined: old.joined, uid, member });
      const others = peers.filter(p => p.ws !== seat.ws);
      server.send(JSON.stringify({ t: 'welcome', id: old.id, host: room.host, max: room.max, peers: others.map(p => p.id) }));
      this.broadcast({ t: 'rejoin', id: old.id }, server);
      await this.ctx.storage.setAlarm(Date.now() + SWEEP_MS);
      return new Response(null, { status: 101, webSocket: client });
    }
    const id = `p${room.next++}`;
    if (!room.host) room.host = id;
    await this.ctx.storage.put('room', room);
    if (uid) {
      // 신고할 때 "이 방에 있었던 사람"인지 확인하려고 기억한다.
      const chat = (await this.ctx.storage.get('chat')) ?? { lines: [], users: [] };
      if (!chat.users.includes(uid)) { chat.users.push(uid); await this.ctx.storage.put('chat', chat); }
    }
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id, joined: Date.now(), uid, member });
    server.send(JSON.stringify({ t: 'welcome', id, host: room.host, max: room.max, peers: peers.map(p => p.id) }));
    for (const p of peers) safeSend(p.ws, JSON.stringify({ t: 'join', id }));
    // 관전하는 사람에게는 누가 들어왔는지(사용자 번호)도 알린다
    for (const w of this.watchers()) safeSend(w.ws, JSON.stringify({ t: 'join', id, user: uid }));
    if (this.watchers().length) safeSend(server, JSON.stringify({ t: 'watchers', n: this.watchers().length }));
    await this.ctx.storage.setAlarm(Date.now() + SWEEP_MS);
    // 정지할 때 이 방의 연결도 끊을 수 있게 로비에 적어 둔다.
    if (uid && room.name) await social.track(this.env, uid, 'room', room.name);
    // 관계자 방에 두 사람이 다 들어왔으면 관전 목록에 올린다.
    if (room.members?.length === 2 && !room.listed && peers.length + 1 >= 2) await this.list(room);
    return new Response(null, { status: 101, webSocket: client });
  }

  // 관전 목록에 올린다 (방이 비면 clear 에서 내린다)
  async list(room) {
    const [game, code] = room.name.split(':');
    if (!game || !code) return;
    room.listed = room.touched = Date.now();
    await this.ctx.storage.put('room', room);
    try { await stats.liveRoomStart(this.env, game, code, room.members[0], room.members[1]); } catch (error) { console.error('live list failed', error?.message); }
  }

  // 보기만 하러 들어온 사람 (관계자 방만, 두 사람이 아닌 로그인한 사람, 둘 중 누구와도 차단한 사이가 아닐 때)
  async watch(room, uid, server, client) {
    let refusal = !room ? 'not-found' : !room.members || !uid || room.members.includes(uid) ? 'not-watchable'
      : this.watchers().length >= WATCH_MAX ? 'watch-full' : '';
    if (!refusal) {
      // 차단한 사이면 방이 없는 것처럼 (차단 사실을 알리지 않는다)
      for (const member of room.members) if (await social.blockedEither(this.env, uid, member)) { refusal = 'not-found'; break; }
    }
    if (refusal) {
      server.accept();
      server.send(JSON.stringify({ t: 'error', code: refusal, max: WATCH_MAX }));
      server.close(refusal === 'not-found' ? 4404 : 4403, refusal);
      return new Response(null, { status: 101, webSocket: client });
    }
    room.watchSeq = (room.watchSeq ?? 0) + 1;
    const id = `w${room.watchSeq}`;
    await this.ctx.storage.put('room', room);
    const players = this.peers();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id, joined: Date.now(), uid, watcher: true });
    // users: 자리마다 누구인지 (관전 목록의 닉네임과 맞춰 보려고). 두 사람의 이름은 서버가 준 닉네임만 쓴다.
    const users = Object.fromEntries(players.map(p => [p.id, p.uid]));
    server.send(JSON.stringify({ t: 'welcome', id, watch: true, host: room.host, max: room.max, peers: players.map(p => p.id), users }));
    // 두 사람이 남겨 둔 메시지(처음 인사 같은 것)를 먼저 보내 준다.
    const keep = (await this.ctx.storage.get('keep')) ?? {};
    for (const [key, data] of Object.entries(keep)) {
      const from = key.slice(0, key.indexOf(':'));
      if (players.some(p => p.id === from)) server.send(JSON.stringify({ t: 'msg', from, data }));
    }
    this.tellWatchers();
    await this.ctx.storage.setAlarm(Date.now() + SWEEP_MS);
    if (room.name) await social.track(this.env, uid, 'room', room.name);
    return new Response(null, { status: 101, webSocket: client });
  }

  // 두 사람에게 지금 몇 명이 보고 있는지 알린다
  tellWatchers() {
    const text = JSON.stringify({ t: 'watchers', n: this.watchers().length });
    for (const p of this.peers()) safeSend(p.ws, text);
  }

  async webSocketMessage(ws, message) {
    const me = ws.deserializeAttachment();
    if (!me || me.gone) return; // 바뀌어 나간 예전 연결이 보내는 것은 버린다
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
    if (me.watcher) return this.warn(ws, 'watch-only'); // 관전하는 사람은 보기만 한다
    if (msg.t === 'report') return this.report(ws, me, msg);
    if (msg.t !== 'send' || msg.data === undefined) return this.warn(ws, 'bad');
    let data = msg.data;
    const isChat = !!data && typeof data === 'object' && !Array.isArray(data) && 'chat' in data;
    // 채팅 약속: 사람이 쓴 글은 data.chat (문자열) 에 넣는다. 서버가 걸러서 보낸다.
    if (isChat) {
      if (typeof data.chat !== 'string') return this.warn(ws, 'bad');
      if (!this.allowChat(ws)) return;
      let { text } = filterText(data.chat);
      if (!text) return;
      text = maskSplitPhone(await this.recentLines(me.id), text);
      data = { ...data, chat: text };
      await this.remember({ from: me.id, uid: me.uid ?? null, text, at: Date.now() });
    }
    // 관계자 방(랜덤 매칭, 초대)에서는 이름 같은 글이 다른 칸으로 와도 거른다. 공개 방(코드 방)은 채팅만 거른다.
    if (me.member) {
      try { data = cleanData(data); } catch { return this.warn(ws, 'bad'); }
    }
    const out = JSON.stringify({ t: 'msg', from: me.id, data });
    if (typeof msg.to === 'string') {
      const target = this.peers().find(p => p.id === msg.to);
      if (target) safeSend(target.ws, out);
      return;
    }
    for (const p of this.peers()) if (p.ws !== ws) safeSend(p.ws, out);
    // 관전하는 사람에게도 보낸다. 채팅 글은 두 사람 사이의 이야기라 보내지 않는다.
    if (isChat) return;
    for (const w of this.watchers()) safeSend(w.ws, out);
    if (msg.keep === true && data && typeof data === 'object' && !Array.isArray(data) && typeof data.t === 'string' && data.t.length <= 16) {
      await this.keep(me.id, data, out.length);
    }
  }

  // 관전하러 들어온 사람에게 먼저 보내 줄 메시지를 기억한다 (보낸 사람과 종류마다 마지막 것)
  async keep(from, data, size) {
    if (size > KEEP_BYTES) return;
    const keep = (await this.ctx.storage.get('keep')) ?? {};
    const key = `${from}:${data.t}`;
    if (!(key in keep) && Object.keys(keep).length >= KEEP_MAX) return;
    keep[key] = data;
    await this.ctx.storage.put('keep', keep);
  }

  // 대전 결과 보고 { t:'report', n: 이 방에서 몇 번째 대전, won: 내가 이겼나 }. 관계자 방의 두 사람만.
  // 둘이 같은 사람을 이겼다고 하면 그 사람의 온라인 승리 1개. 서로 다르면 세지 않는다. 한 번 정한 대전은 다시 보고해도 안 바뀐다.
  async report(ws, me, msg) {
    const room = await this.ctx.storage.get('room');
    const n = Number(msg.n);
    if (!room?.members || !me.uid || !room.members.includes(me.uid) || !Number.isSafeInteger(n) || n < 1 || n > 100000 || typeof msg.won !== 'boolean') {
      return this.warn(ws, 'bad');
    }
    const other = room.members.find(u => u !== me.uid);
    if (!other) return;
    const results = (await this.ctx.storage.get('results')) ?? {};
    const r = results[n] ??= { claims: {} };
    if (r.done || String(me.uid) in r.claims) return;
    r.claims[me.uid] = msg.won ? me.uid : other;
    const claims = Object.values(r.claims);
    if (claims.length >= 2) {
      r.done = true;
      if (claims[0] === claims[1]) await this.win(room, claims[0]);
    }
    // 한 방에서 대전을 아주 많이 해도 저장이 커지지 않게 오래된 결과는 버린다 (끝난 것만)
    for (const [key, value] of Object.entries(results)) if (value.done && Number(key) < n - 20) delete results[key];
    await this.ctx.storage.put('results', results);
  }

  async win(room, uid) {
    const game = room.name?.split(':')[0];
    if (!game) return;
    try { await stats.recordWin(this.env, game, uid); } catch (error) { console.error('record win failed', error?.message); }
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
    if (!room) {
      // 방은 없어졌고 신고용 채팅 기록만 남은 경우
      const chat = await this.ctx.storage.get('chat');
      if (chat && Date.now() >= (chat.until ?? 0)) await this.ctx.storage.deleteAll();
      else if (chat) await this.ctx.storage.setAlarm(chat.until);
      return;
    }
    const now = Date.now();
    let peers = this.peers();
    for (const p of [...peers, ...this.watchers()]) {
      if (now - this.lastHeard(p.ws) > STALE_MS) {
        this.close(p.ws, 4408, 'timeout');
        await this.departed(p.ws);
      }
    }
    peers = this.peers();
    const latest = await this.ctx.storage.get('room');
    if (peers.length) {
      // 관전 목록에 "아직 하는 중"이라고 가끔 적는다
      if (latest?.listed && now - (latest.touched ?? 0) > LIVE_TOUCH_MS) {
        latest.touched = now;
        await this.ctx.storage.put('room', latest);
        const [game, code] = latest.name.split(':');
        try { await stats.liveRoomTouch(this.env, game, code); } catch (error) { console.error('live touch failed', error?.message); }
      }
      await this.ctx.storage.setAlarm(now + SWEEP_MS);
      return;
    }
    if (!latest) return;
    // 아무도 없는 방: 만든 지 2분이 지났으면 지우고, 아니면 그때 다시 본다.
    if (latest.host || now >= latest.reservedAt + RESERVE_MS) await this.clear();
    else await this.ctx.storage.setAlarm(latest.reservedAt + RESERVE_MS);
  }

  // 지금 방에 있는 사람들 (들어온 순서대로, 관전하는 사람은 빼고)
  peers() {
    const list = [];
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const a = ws.deserializeAttachment();
      if (a?.id && !a.gone && !a.watcher) list.push({ ws, id: a.id, joined: a.joined, uid: a.uid ?? null });
    }
    return list.sort((a, b) => a.joined - b.joined || Number(a.id.slice(1)) - Number(b.id.slice(1)));
  }

  // 보기만 하는 사람들
  watchers() {
    const list = [];
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const a = ws.deserializeAttachment();
      if (a?.watcher && !a.gone) list.push({ ws, id: a.id, uid: a.uid ?? null });
    }
    return list;
  }

  // 들어옴, 나감, 방장 바뀜 같은 소식은 관전하는 사람도 받는다
  broadcast(message, except) {
    const text = JSON.stringify(message);
    for (const p of [...this.peers(), ...this.watchers()]) if (p.ws !== except) safeSend(p.ws, text);
  }

  async departed(ws) {
    const me = ws.deserializeAttachment();
    if (!me?.id || me.gone) return;
    try { ws.serializeAttachment({ ...me, gone: true }); } catch { /* 이미 닫힘 */ }
    this.buckets.delete(ws);
    if (me.watcher) { this.tellWatchers(); return; }
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
    const room = await this.ctx.storage.get('room');
    if (room?.members) {
      // 한 사람만 결과를 보내고 방이 비었으면 그 보고대로 센다 (상대가 보고하기 전에 나간 경우)
      const results = (await this.ctx.storage.get('results')) ?? {};
      for (const r of Object.values(results)) {
        const claims = Object.values(r.claims ?? {});
        if (!r.done && claims.length === 1) await this.win(room, claims[0]);
      }
    }
    if (room?.listed) {
      const [game, code] = room.name.split(':');
      try { await stats.liveRoomEnd(this.env, game, code); } catch (error) { console.error('live end failed', error?.message); }
    }
    // 두 사람이 다 나갔으니 관전도 끝
    for (const w of this.watchers()) {
      try { w.ws.serializeAttachment({ ...w.ws.deserializeAttachment(), gone: true }); } catch { /* 이미 닫힘 */ }
      safeSend(w.ws, JSON.stringify({ t: 'error', code: 'ended' }));
      this.close(w.ws, 4410, 'ended');
    }
    const chat = await this.ctx.storage.get('chat');
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    if (chat?.lines?.length) {
      const until = Date.now() + CHAT_KEEP_MS;
      await this.ctx.storage.put('chat', { ...chat, until });
      await this.ctx.storage.setAlarm(until);
    }
  }

  // 채팅 줄을 마지막 CHAT_LINES 줄까지 기억한다 (거른 글만).
  async remember(line) {
    const chat = (await this.ctx.storage.get('chat')) ?? { lines: [], users: [] };
    chat.lines.push(line);
    if (chat.lines.length > CHAT_LINES) chat.lines.splice(0, chat.lines.length - CHAT_LINES);
    await this.ctx.storage.put('chat', chat);
  }

  // 같은 사람(번호 from)이 30초 안에 보낸 마지막 줄들 (나눠 보낸 전화번호 찾기용)
  async recentLines(from) {
    const chat = await this.ctx.storage.get('chat');
    const since = Date.now() - SPLIT_MS;
    return (chat?.lines ?? []).filter(l => l.from === from && l.at >= since).slice(-SPLIT_LINES).map(l => l.text);
  }

  // 정지된 사람의 연결을 끊는다 (로비가 부른다).
  async kickUser(uid) {
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (!a?.id || a.gone || a.uid !== uid) continue;
      safeSend(ws, JSON.stringify({ t: 'error', code: 'suspended' }));
      await this.departed(ws);
      this.close(ws, 4403, 'suspended');
    }
  }

  // 신고용: 이 방의 채팅 기록과 들어왔던 사용자 번호들
  async chatLog() {
    const chat = await this.ctx.storage.get('chat');
    return { lines: chat?.lines ?? [], users: chat?.users ?? [] };
  }

  allowChat(ws) {
    const bucket = this.buckets.get(ws);
    const now = Date.now();
    bucket.chat ??= { tokens: CHAT_BURST, at: now };
    bucket.chat.tokens = Math.min(CHAT_BURST, bucket.chat.tokens + ((now - bucket.chat.at) / 1000) * CHAT_PER_SECOND);
    bucket.chat.at = now;
    if (bucket.chat.tokens >= 1) { bucket.chat.tokens -= 1; return true; }
    this.warn(ws, 'chat-rate');
    return false;
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

// data 안의 모든 글자열(이름표 포함)을 거른다. 너무 깊으면 던진다(→ 'bad').
function cleanData(value, depth = 0) {
  if (typeof value === 'string') return maskText(value);
  if (!value || typeof value !== 'object') return value;
  if (depth >= DATA_DEPTH) throw Error('too deep');
  if (Array.isArray(value)) return value.map(v => cleanData(v, depth + 1));
  const out = Object.create(null);
  for (const [key, v] of Object.entries(value)) out[maskText(key)] = cleanData(v, depth + 1);
  return out;
}
