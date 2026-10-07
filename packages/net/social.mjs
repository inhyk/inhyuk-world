// 계정, 친구, 1:1 대화, 차단, 신고, 실시간 알림, 친구 초대, 랜덤 매칭 (@inhyuk/net)
// 쓰는 법은 services/net/README.md "계정과 친구".
//
//   const account = new Account();               // 토큰은 localStorage 에 저장 (options.storage 로 바꿀 수 있음)
//   await account.login('인혁', '1234');
//   const social = new Social(account, { dm: msg => ..., invite: inv => ..., online: id => ... });
//   social.live();                               // 접속 상태와 알림 받기 (끊기면 다시 붙음)
//   const { room, opponent } = await social.findMatch('puyo-tower', roomHooks);
//   const save = await account.loadSave('jelly-tower');      // 게임 저장 (다른 기기에서 이어 하기)
import { Room, DEFAULT_SERVER, httpBase, wsBase, defaultConnect, PING } from './index.mjs';

const STORAGE_KEY = 'inhyuk-net-session';
const LIVE_PING_MS = 25000, QUEUE_PING_MS = 10000;
const BACKOFF_MIN_MS = 1000, BACKOFF_MAX_MS = 30000;

// 서버 오류 코드 → 아이에게 보여 줄 문장
export const SOCIAL_MESSAGES = {
  network: '서버에 연결하지 못했어. 인터넷을 확인해 줘.',
  server: '서버에 문제가 생겼어. 조금 뒤에 다시 해 줘.',
  'bad-nickname': '닉네임은 2~10글자, 한글, 영어, 숫자, _ 만 쓸 수 있어.',
  'bad-nickname-word': '그 닉네임에는 쓸 수 없는 말이 들어 있어.',
  'bad-password': '비밀번호는 4~16글자로 해 줘.',
  'nickname-taken': '이미 있는 닉네임이야. 다른 이름을 골라 줘.',
  'wrong-login': '닉네임이나 비밀번호가 달라.',
  'bad-login': '닉네임과 비밀번호를 적어 줘.',
  'login-required': '다시 로그인해 줘.',
  'wrong-password': '비밀번호가 달라. 다시 적어 줘.',
  suspended: '이 계정은 정지됐어.',
  rate: '너무 빨라! 조금 쉬었다가 해 줘.',
  'not-found': '찾을 수 없어.',
  self: '나 자신에게는 할 수 없어.',
  'not-friends': '친구에게만 할 수 있어.',
  blocked: '차단된 사이라서 할 수 없어.',
  offline: '친구가 지금 접속해 있지 않아.',
  expired: '초대 시간이 지났어.',
  declined: '친구가 초대를 거절했어.',
  canceled: '초대가 취소됐어.',
  empty: '할 말을 적어 줘.',
  'too-long': '글이 너무 길어.',
  busy: '방을 만들지 못했어. 다시 해 볼래?',
  conflict: '다른 기기에서 먼저 저장했어.',
  'too-big': '저장할 내용이 너무 커.',
  'bad-save': '저장할 내용이 잘못됐어.',
  'bad-game': '게임 이름이 잘못됐어.',
  'bad-stats': '기록이 이상해.',
  'bad-board': '랭킹 종류가 잘못됐어.',
};
const message = code => SOCIAL_MESSAGES[code] ?? SOCIAL_MESSAGES.server;

export class NetError extends Error {
  constructor(code, status = 0, extra = {}) { super(message(code)); this.code = code; this.status = status; Object.assign(this, extra); }
}

// 저장소가 없는 곳(테스트, 서버)에서 쓰는 메모리 저장소
export function memoryStorage() {
  const map = new Map();
  return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) };
}
function defaultStorage() {
  try { return globalThis.localStorage ?? memoryStorage(); } catch { return memoryStorage(); }
}

export class Account {
  // options: server, fetch, storage({getItem,setItem,removeItem}), connect(url) → WebSocket
  constructor(options = {}) {
    this.options = options;
    this.storage = options.storage ?? defaultStorage();
    this.token = ''; this.user = null;
    try {
      const saved = JSON.parse(this.storage.getItem(STORAGE_KEY) ?? 'null');
      if (saved?.token) { this.token = saved.token; this.user = saved.user ?? null; }
    } catch { /* 망가진 저장값은 무시 */ }
  }
  get server() { return this.options.server ?? DEFAULT_SERVER; }
  get loggedIn() { return !!this.token; }

  save(token, user) {
    this.token = token; this.user = user;
    try {
      if (token) this.storage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
      else this.storage.removeItem(STORAGE_KEY);
    } catch { /* 저장 못 해도 이번 실행 동안은 쓴다 */ }
  }

  async request(method, path, body) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    let response;
    try {
      response = await (this.options.fetch ?? globalThis.fetch)(`${httpBase(this.server)}${path}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch { throw new NetError('network'); }
    let data = {};
    try { data = await response.json(); } catch { /* 빈 몸 */ }
    if (!response.ok) {
      const code = data?.error ?? 'server';
      if (code === 'login-required' || code === 'suspended') this.save('', null);
      const extra = code === 'suspended' ? { reason: data.reason ?? '' }
        : code === 'conflict' ? { server: { data: data.data ?? null, revision: data.revision ?? 0, updated: data.updated ?? null } } : {};
      throw new NetError(code, response.status, extra);
    }
    return data;
  }

  async signup(nickname, password) {
    const data = await this.request('POST', '/auth/signup', { nickname, password });
    this.save(data.token, data.user);
    return data.user;
  }
  async login(nickname, password) {
    const data = await this.request('POST', '/auth/login', { nickname, password });
    this.save(data.token, data.user);
    return data.user;
  }
  async logout() {
    try { if (this.token) await this.request('POST', '/auth/logout'); } finally { this.save('', null); }
  }
  // 내 계정을 서버에서 지운다 (비밀번호를 한 번 더 확인). 친구, 대화, 모든 게임의 저장까지 지워지고 되돌릴 수 없다.
  // 비밀번호가 틀리면 NetError 'wrong-password', 서버가 아직 이 기능을 모르면 status 404.
  async deleteAccount(password) {
    await this.request('POST', '/auth/delete', { password });
    this.save('', null);
  }
  async me() {
    const data = await this.request('GET', '/me');
    this.save(this.token, { id: data.user.id, nickname: data.user.nickname });
    return data.user;
  }
  // WebSocket 에 들어갈 한 번짜리 표 (60초)
  async ticket() { return (await this.request('POST', '/auth/ticket')).ticket; }

  // ---- 게임 저장 (클라우드 세이브) ----
  // 서버에 있는 저장 { data, revision, updated }. 없으면 null.
  async loadSave(game) {
    try { return await this.request('GET', `/saves/${game}`); } catch (error) {
      if (error instanceof NetError && error.code === 'no-save') return null;
      throw error;
    }
  }
  // baseRevision: 마지막으로 읽거나 쓴 revision (처음이면 0). 맞으면 { ok: true, revision, updated },
  // 그 사이 다른 기기가 먼저 썼으면 { conflict: true, server: { data, revision, updated } }. 합치지 않는다:
  // 게임별 adapter 가 충돌 시 어떤 값을 쓸지 정한 뒤 server.revision 으로 다시 putSave 한다.
  // importId: 기기에 있던 저장을 처음 올릴 때 한 번 (같은 것을 또 보내면 { ok, duplicate: true }).
  async putSave(game, data, baseRevision = 0, { importId } = {}) {
    try {
      const result = await this.request('PUT', `/saves/${game}`, { data, baseRevision, ...(importId ? { importId } : {}) });
      return { ok: true, ...result };
    } catch (error) {
      if (error instanceof NetError && error.code === 'conflict') return { conflict: true, server: error.server };
      throw error;
    }
  }
}

const camel = type => type.replace(/-(\w)/g, (_, c) => c.toUpperCase());

// hooks: status(s) 'offline'|'connecting'|'online', hello(msg), friendRequest, friendAccepted, friendRemoved,
//        online(id), offline(id), dm(msg), invite(invite), inviteDeclined, inviteCanceled, room, match, kicked(reason),
//        event(msg) (모든 알림). 이름은 서버 알림 t 를 camelCase 로 바꾼 것.
export class Social {
  constructor(account, hooks = {}, options = {}) {
    this.account = account; this.hooks = hooks; this.options = options;
    this.socket = null; this.wanted = false; this.attempt = 0; this.status = 'offline';
    this.onlineFriends = new Set();
    this.waiters = new Set();
    this.queue = null;
  }
  get connectFn() { return this.options.connect ?? this.account.options.connect ?? defaultConnect; }
  req(method, path, body) { return this.account.request(method, path, body); }

  // ---- 친구, 검색, 차단 ----
  async search(q) { return (await this.req('GET', `/users/search?q=${encodeURIComponent(q)}`)).users; }
  async friends() { return (await this.req('GET', '/friends')).friends; }
  requests() { return this.req('GET', '/friends/requests'); }
  // who: 닉네임(문자열) 또는 사용자 번호(숫자). 결과 { status: 'requested'|'friends' }
  requestFriend(who) { return this.req('POST', '/friends/requests', typeof who === 'number' ? { id: who } : { nickname: who }); }
  acceptFriend(id) { return this.req('POST', `/friends/requests/${id}/accept`); }
  declineFriend(id) { return this.req('POST', `/friends/requests/${id}/decline`); }
  cancelRequest(id) { return this.req('DELETE', `/friends/requests/${id}`); }
  removeFriend(id) { return this.req('DELETE', `/friends/${id}`); }
  async blocks() { return (await this.req('GET', '/blocks')).blocks; }
  block(id) { return this.req('POST', `/blocks/${id}`); }
  unblock(id) { return this.req('DELETE', `/blocks/${id}`); }

  // ---- 1:1 대화 ----
  async unread() { return (await this.req('GET', '/dm')).unread; }
  history(id, before) { return this.req('GET', `/dm/${id}${before ? `?before=${before}` : ''}`); }
  async sendDm(id, body) { return (await this.req('POST', `/dm/${id}`, { body })).message; }
  markRead(id) { return this.req('POST', `/dm/${id}/read`); }

  // ---- 게임 저장 (Account 와 같음) ----
  loadSave(game) { return this.account.loadSave(game); }
  putSave(game, data, baseRevision, options) { return this.account.putSave(game, data, baseRevision, options); }

  // ---- 기록과 온라인 랭킹 ----
  // 레벨, 경험치, 트로피를 올린다 (온라인 승리는 서버가 방의 결과 보고로 센다)
  putStats(game, { level, xp, trophies }) { return this.req('PUT', `/stats/${game}`, { level, xp, trophies }); }
  // by: 'trophies' | 'level' | 'wins' → { by, list: [{ rank, id, nickname, level, xp, trophies, wins }], me: { rank, ranks, level, trophies, wins, top5 } }
  rankings(game, by = 'trophies') { return this.req('GET', `/rankings/${game}?by=${encodeURIComponent(by)}`); }

  // ---- 관전 ----
  // 지금 하는 대전 [{ code, started, friend, players: [{ id, nickname, level }, ...] }] (내 대전, 차단한 사이는 빠짐)
  async matches(game) { return (await this.req('GET', `/matches/${game}`)).matches; }
  // 그 대전을 보러 들어간다 (보기만 한다). 두 사람의 메시지는 roomHooks.message(data, 'p1' | 'p2') 로 온다.
  async watch(game, code, roomHooks = {}, roomOptions = {}) {
    const room = new Room(roomHooks, {
      server: this.account.server, fetch: this.account.options.fetch, connect: this.connectFn, ...roomOptions, game, maxPlayers: 2,
    });
    await room.open(code, { ticket: await this.account.ticket(), watch: true });
    return room;
  }

  // ---- 신고 ----  context: { kind: 'dm' } 또는 { kind: 'room', game, room: 방 코드 }
  report({ target, context, reason, messages }) { return this.req('POST', '/reports', { target, context, reason, messages }); }

  // ---- 실시간 알림 (/live) ----
  setStatus(status) { if (this.status !== status) { this.status = status; this.hooks.status?.(status); } }

  // 연결한다. 끊기면 1초, 2초, 4초 ... 30초 간격으로 다시 붙는다. 첫 hello 를 받으면 끝난다.
  live() {
    this.wanted = true;
    if (this.socket || this.connecting) return this.connecting ?? Promise.resolve();
    this.connecting = this.openLive().finally(() => { this.connecting = null; });
    return this.connecting;
  }

  async openLive() {
    this.setStatus('connecting');
    let socket;
    try {
      const ticket = await this.account.ticket();
      if (!this.wanted) return;
      socket = await this.connectFn(`${wsBase(this.account.server)}/live?ticket=${encodeURIComponent(ticket)}`);
    } catch (error) {
      if (error instanceof NetError && (error.code === 'login-required' || error.code === 'suspended')) {
        this.wanted = false; this.setStatus('offline'); this.hooks.kicked?.(error.code); throw error;
      }
      this.retry();
      return;
    }
    if (!this.wanted) { try { socket.close(); } catch { /* 무시 */ } return; }
    this.socket = socket;
    // hello 를 받거나, 그 전에 끊기거나 close() 하면 끝난다 (끊기면 뒤에서 다시 붙고, await live() 는 기다리지 않는다).
    this.settleHello();
    const hello = new Promise(resolve => { this.helloed = resolve; });
    socket.addEventListener('message', event => this.received(socket, event.data));
    socket.addEventListener('close', () => this.dropped(socket));
    socket.addEventListener('error', () => this.dropped(socket));
    socket.accept?.();
    clearInterval(this.pinger);
    this.pinger = setInterval(() => { try { socket.send(PING); } catch { /* 닫힘 */ } }, LIVE_PING_MS);
    await hello;
  }

  retry() {
    this.socket = null;
    clearInterval(this.pinger);
    if (!this.wanted) { this.setStatus('offline'); return; }
    this.setStatus('connecting');
    const wait = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** this.attempt++) * (0.75 + Math.random() * 0.5);
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => { if (this.wanted && !this.socket) { this.connecting = null; this.live(); } }, wait);
  }

  settleHello() { const settle = this.helloed; this.helloed = null; settle?.(); }

  dropped(socket) {
    if (socket !== this.socket) return;
    this.onlineFriends.clear();
    this.settleHello();
    this.retry();
  }

  close() {
    this.wanted = false;
    this.settleHello();
    clearTimeout(this.retryTimer); clearInterval(this.pinger);
    const socket = this.socket; this.socket = null;
    try { socket?.close(1000, 'bye'); } catch { /* 이미 닫힘 */ }
    this.setStatus('offline');
  }

  received(socket, text) {
    if (socket !== this.socket || typeof text !== 'string') return;
    let msg;
    try { msg = JSON.parse(text); } catch { return; }
    if (!msg?.t || msg.t === 'pong') return;
    if (msg.t === 'hello') {
      this.attempt = 0;
      this.onlineFriends = new Set(msg.online ?? []);
      this.setStatus('online');
      this.settleHello();
    } else if (msg.t === 'online') this.onlineFriends.add(msg.id);
    else if (msg.t === 'offline') this.onlineFriends.delete(msg.id);
    else if (msg.t === 'kicked') { this.wanted = false; this.account.save('', null); }
    for (const waiter of [...this.waiters]) waiter(msg);
    const hook = this.hooks[camel(msg.t)];
    if (msg.t === 'online' || msg.t === 'offline' || msg.t === 'friend-removed') hook?.(msg.id);
    else if (msg.t === 'kicked') hook?.(msg.reason);
    else if (msg.t === 'invite') hook?.(msg.invite);
    else if (msg.t === 'friend-request') hook?.(msg.from);
    else if (msg.t === 'friend-accepted') hook?.(msg.friend);
    else hook?.(msg);
    this.hooks.event?.(msg);
  }

  // live 알림 중 pred 에 맞는 것을 기다린다
  waitFor(pred, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.waiters.delete(waiter); reject(new NetError('expired')); }, ms);
      const waiter = msg => { if (pred(msg)) { clearTimeout(timer); this.waiters.delete(waiter); resolve(msg); } };
      this.waiters.add(waiter);
    });
  }

  // ---- 방 들어가기 (코드는 사람에게 보이지 않는다) ----
  async joinRoom(game, code, roomHooks = {}, roomOptions = {}) {
    const room = new Room(roomHooks, {
      server: this.account.server, fetch: this.account.options.fetch, connect: this.connectFn, ...roomOptions, game, maxPlayers: 2,
    });
    await room.open(code, { ticket: await this.account.ticket() });
    return room;
  }

  // 접속 중인 친구를 초대한다. 친구가 수락하면 같은 방에 들어간 { room, opponent } 로 끝난다.
  // 친구가 거절하면 NetError('declined'), 60초가 지나면 NetError('expired').
  async invite(friendId, game, roomHooks, roomOptions) {
    await this.live();
    const { invite } = await this.req('POST', '/invites', { to: friendId, game });
    this.lastInvite = invite.id;
    const answer = await this.waitFor(m => (m.t === 'room' || m.t === 'invite-declined') && m.invite === invite.id, Math.max(1000, invite.expires - Date.now() + 2000));
    if (answer.t === 'invite-declined') throw new NetError('declined');
    return { room: await this.joinRoom(answer.game, answer.code, roomHooks, roomOptions), opponent: answer.opponent };
  }
  cancelInvite(inviteId = this.lastInvite) { return this.req('DELETE', `/invites/${inviteId}`); }

  // 받은 초대를 수락하면 바로 그 방에 들어간다.
  async acceptInvite(inviteId, roomHooks, roomOptions) {
    const answer = await this.req('POST', `/invites/${inviteId}/accept`);
    return { room: await this.joinRoom(answer.game, answer.code, roomHooks, roomOptions), opponent: answer.opponent };
  }
  declineInvite(inviteId) { return this.req('POST', `/invites/${inviteId}/decline`); }

  // 랜덤 매칭: "게임 찾기". 짝이 생기면 { room, opponent }, cancelMatch() 하면 null 로 끝난다.
  // onQueued(): 줄에 섰을 때 (기다리는 중 화면을 보여 줄 때)
  async findMatch(game, roomHooks, roomOptions, { onQueued } = {}) {
    this.cancelMatch();
    const ticket = await this.account.ticket();
    let socket;
    try { socket = await this.connectFn(`${wsBase(this.account.server)}/match/${game}?ticket=${encodeURIComponent(ticket)}`); } catch { throw new NetError('network'); }
    const queue = { socket, canceled: false };
    this.queue = queue;
    const result = await new Promise((resolve, reject) => {
      queue.finish = value => { clearInterval(queue.pinger); queue.finish = () => {}; value instanceof Error ? reject(value) : resolve(value); };
      socket.addEventListener('message', event => {
        let msg; try { msg = JSON.parse(event.data); } catch { return; }
        if (msg.t === 'queued') onQueued?.();
        else if (msg.t === 'matched') queue.finish(msg);
        else if (msg.t === 'canceled' || msg.t === 'replaced') queue.finish(null);
        else if (msg.t === 'error') queue.finish(new NetError(msg.code));
      });
      const closed = () => queue.finish(queue.canceled ? null : new NetError('network'));
      socket.addEventListener('close', closed);
      socket.addEventListener('error', closed);
      socket.accept?.();
      queue.pinger = setInterval(() => { try { socket.send(PING); } catch { /* 닫힘 */ } }, QUEUE_PING_MS);
    });
    if (this.queue === queue) this.queue = null;
    try { socket.close(1000, 'done'); } catch { /* 이미 닫힘 */ }
    if (!result) return null;
    return { room: await this.joinRoom(result.game, result.code, roomHooks, roomOptions), opponent: result.opponent };
  }

  cancelMatch() {
    const queue = this.queue;
    if (!queue) return;
    this.queue = null;
    queue.canceled = true;
    try { queue.socket.send('{"t":"cancel"}'); } catch { /* 닫힘 */ }
    try { queue.socket.close(1000, 'cancel'); } catch { /* 이미 닫힘 */ }
    queue.finish?.(null);
  }
}
