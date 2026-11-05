// 모두가 같이 쓰는 세계 (@inhyuk/net 의 World). 서버는 services/net 의 World (README "같이 쓰는 세계").
// 누가 놓은 블록처럼, 모두가 나가도 남아야 하는 것을 칸(cell)으로 저장한다. 로그인한 사람만 들어온다.
//
//   const world = new World(hooks, { game: 'social-game', world: 'town' });
//   await world.open(await account.ticket());   // 칸을 다 받으면 끝난다 (world.cells 에 들어 있다)
//   world.set('3|0|5', { b: 'stone' });          // 칸 놓기. 처음 놓은 사람만 바꾸거나 지울 수 있다
//   world.set('tree|7', 'stump', { ttl: 600 });  // 600초 뒤 저절로 사라지는 칸
//   world.pose({ x, y, z, ry });                 // 내 위치 (1초에 15번까지만 보낸다. 마지막 것이 간다)
//   world.chat('안녕');                          // 채팅 (서버가 거른다)
//
// hooks
//   status(status, message)  offline | connecting | connected | error  (message 는 아이에게 보여 줄 한국어)
//   welcome()                들어왔다 (world.id, world.user, world.peers 가 채워짐. 칸은 아직 오는 중)
//   ready()                  칸을 모두 받았다
//   cell(k, entry | null)    칸이 생기거나 바뀜({ v, owner: { id, nickname }, exp? }), 또는 없어짐(null).
//                            들어올 때 받는 칸마다, 그리고 ttl 칸이 시간이 지나 사라질 때도 불린다.
//   join(id, user)           다른 사람이 들어옴 (내가 들어갔을 때는 이미 있던 사람마다 한 번씩). user 는 서버가 준 { id, nickname }
//   leave(id)                다른 사람이 나감
//   pose(id, d)              다른 사람의 위치
//   message(data, from)      다른 사람이 보낸 메시지 (채팅은 data.chat)
//   error(code, k)           taken(남의 칸) | not-owner | missing | limit(내 칸 400개) | world-full | bad | rate | chat-rate | too-big
//                            | full | replaced | suspended | not-deployed(서버가 아직 World 를 모름) | login-required
//
// 서로 차단한 사이에는 위치와 메시지가 오지 않는다 (칸은 같이 본다).
import { DEFAULT_SERVER, httpBase, wsBase, defaultConnect, PING } from './index.mjs';

export const WORLD_NAME_RE = /^[a-z0-9-]{1,16}$/;
const GAME_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;
const CONNECT_MS = 15000, PING_MS = 4000, SILENT_MS = 12000;
const POSE_MS = 1000 / 15;   // 위치는 1초에 15번까지
const EXPIRE_MS = 1000;      // ttl 칸이 지났는지 1초마다 본다

export const WORLD_MESSAGES = {
  network: '세계 서버에 연결하지 못했어. 인터넷을 확인해 줘.',
  timeout: '연결 시간이 너무 오래 걸려. 인터넷을 확인해 줘.',
  full: max => `이 세계는 벌써 ${max ?? 12}명이야. 조금 뒤에 다시 와 줘.`,
  lost: '세계 서버와 연결이 끊겼어. 다시 해 볼래?',
  replaced: '다른 곳에서 이 세계에 다시 들어갔어.',
  suspended: '이 계정은 정지됐어.',
  'login-required': '로그인해야 들어갈 수 있어.',
  'not-deployed': '같이 노는 세계는 아직 준비 중이야.',
};

function worldError(code, message) {
  const error = Error(message ?? WORLD_MESSAGES[code] ?? WORLD_MESSAGES.network);
  error.code = code;
  return error;
}

export class World {
  // options: game(필수), world(필수, 영어 소문자, 숫자, '-' 16글자까지), server, fetch, connect(url) → WebSocket
  constructor(hooks = {}, options = {}) {
    if (!GAME_RE.test(options.game ?? '')) throw Error('World needs options.game');
    if (!WORLD_NAME_RE.test(options.world ?? '')) throw Error('World needs options.world (a-z, 0-9, -, 16 letters)');
    this.hooks = hooks; this.options = options;
    this.generation = 0; this.status = 'offline';
    this.socket = null; this.settle = null; this.lastSeen = 0;
    this.id = ''; this.user = null; this.max = 12; this.ready = false;
    this.cells = new Map(); this.peers = new Map(); this.expiring = new Set();
    this.poseAt = 0; this.posePending = undefined; this.poseTimer = null;
  }
  get server() { return this.options.server ?? DEFAULT_SERVER; }
  statusChanged(status, message = '') { this.status = status; this.hooks.status?.(status, message); }

  // ticket: account.ticket() 으로 받은 한 번짜리 표. 칸을 모두 받으면 끝난다.
  // 실패하면 Error(아이에게 보여 줄 문장)를 던지고, error.code 에 까닭(full, not-deployed, network ...)이 있다.
  async open(ticket) {
    this.close();
    const generation = this.generation;
    this.statusChanged('connecting');
    try {
      if (!ticket) throw worldError('login-required');
      const url = `${wsBase(this.server)}/worlds/${this.options.game}/${this.options.world}?ticket=${encodeURIComponent(ticket)}`;
      let socket;
      try { socket = await (this.options.connect ?? defaultConnect)(url); } catch { throw await this.whyFailed(); }
      if (generation !== this.generation) { try { socket.close(); } catch { /* 무시 */ } return; }
      this.socket = socket;
      const loaded = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(worldError('timeout')), CONNECT_MS);
        this.settle = {
          resolve: () => { clearTimeout(timer); this.settle = null; resolve(); },
          reject: error => {
            clearTimeout(timer); this.settle = null;
            const failed = this.socket; this.socket = null;
            try { failed?.close(); } catch { /* 이미 닫힘 */ }
            reject(error);
          },
        };
      });
      socket.addEventListener('message', event => this.received(socket, event.data));
      socket.addEventListener('close', () => this.closed(socket));
      socket.addEventListener('error', () => this.closed(socket));
      socket.accept?.(); // Workers 런타임의 WebSocket (테스트용). 브라우저에는 없다.
      this.lastSeen = Date.now();
      await loaded;
      if (generation !== this.generation) return;
      this.timer = setInterval(() => {
        if (Date.now() - this.lastSeen > SILENT_MS) { this.fail(WORLD_MESSAGES.lost); return; }
        this.raw(PING);
      }, PING_MS);
      this.expirer = setInterval(() => this.expire(), EXPIRE_MS);
    } catch (error) {
      if (generation === this.generation) {
        this.close();
        this.statusChanged('error', error.message);
        if (error.code) this.hooks.error?.(error.code);
      }
      throw error;
    }
  }

  // 연결이 안 됐을 때 까닭을 알아본다. 예전 서버는 /worlds 를 몰라서 404 (그때는 'not-deployed').
  // 브라우저 WebSocket 은 거절된 까닭(상태 번호)을 알려 주지 않아서 같은 주소를 HTTP 로 한 번 물어본다.
  async whyFailed() {
    try {
      const response = await (this.options.fetch ?? globalThis.fetch)(`${httpBase(this.server)}/worlds/${this.options.game}/${this.options.world}`);
      if (response.status === 404) return worldError('not-deployed');
    } catch { /* 인터넷 문제 */ }
    return worldError('network');
  }

  received(socket, text) {
    if (socket !== this.socket || typeof text !== 'string') return;
    this.lastSeen = Date.now();
    let msg;
    try { msg = JSON.parse(text); } catch { return; }
    if (!msg || typeof msg !== 'object') return;
    switch (msg.t) {
      case 'welcome':
        this.id = msg.id; this.user = msg.user ?? null; this.max = msg.max ?? this.max;
        this.peers = new Map((msg.peers ?? []).map(p => [p.id, p.user]));
        this.cells = new Map(); this.expiring = new Set(); this.ready = false;
        this.statusChanged('connected');
        this.hooks.welcome?.();
        for (const [id, user] of this.peers) this.hooks.join?.(id, user);
        return;
      case 'cells':
        for (const cell of msg.list ?? []) this.put(cell);
        if (msg.done && !this.ready) {
          this.ready = true;
          this.hooks.ready?.();
          this.settle?.resolve();
        }
        return;
      case 'cell':
        if (msg.v === null) this.remove(msg.k);
        else this.put(msg);
        return;
      case 'join':
        if (this.peers.has(msg.id)) { this.peers.set(msg.id, msg.user); return; }
        this.peers.set(msg.id, msg.user);
        this.hooks.join?.(msg.id, msg.user);
        return;
      case 'leave':
        if (!this.peers.delete(msg.id)) return;
        this.hooks.leave?.(msg.id);
        return;
      case 'pose':
        this.hooks.pose?.(msg.id, msg.d);
        return;
      case 'msg':
        this.hooks.message?.(msg.data, msg.from);
        return;
      case 'error':
        if (this.settle && ['full', 'suspended', 'login-required'].includes(msg.code)) {
          this.settle.reject(worldError(msg.code, msg.code === 'full' ? WORLD_MESSAGES.full(msg.max) : undefined));
        } else if (msg.code === 'replaced' || msg.code === 'suspended') {
          this.hooks.error?.(msg.code);
          this.fail(WORLD_MESSAGES[msg.code]);
        } else this.hooks.error?.(msg.code, msg.k);
        return;
      default:
    }
  }

  put(cell) {
    if (typeof cell?.k !== 'string') return;
    const entry = { v: cell.v, owner: cell.owner };
    if (typeof cell.exp === 'number') {
      if (cell.exp <= Date.now()) { this.remove(cell.k); return; }
      entry.exp = cell.exp; this.expiring.add(cell.k);
    } else this.expiring.delete(cell.k);
    this.cells.set(cell.k, entry);
    this.hooks.cell?.(cell.k, entry);
  }

  remove(k) {
    this.expiring.delete(k);
    if (this.cells.delete(k)) this.hooks.cell?.(k, null);
  }

  // 시간이 지난 ttl 칸을 지운다 (서버는 알려 주지 않는다)
  expire(now = Date.now()) {
    for (const k of [...this.expiring]) if ((this.cells.get(k)?.exp ?? 0) <= now) this.remove(k);
  }

  closed(socket) {
    if (socket !== this.socket) return;
    if (this.settle) {
      // 칸을 다 받기 전에 닫혔다: 예전 서버(404)인지 알아본다. 그 사이 close() 했으면 아무것도 안 한다.
      const settle = this.settle;
      this.socket = null;
      this.whyFailed().then(error => { if (this.settle === settle) settle.reject(error); });
    } else this.fail(WORLD_MESSAGES.lost);
  }

  raw(text) {
    if (this.socket?.readyState !== 1) return false;
    try { this.socket.send(text); return true; } catch { return false; }
  }
  sendMsg(message) { return !!this.id && this.raw(JSON.stringify(message)); }

  // 칸 놓기. 결과는 cell hook 으로 (내 것도 서버를 거쳐 돌아온다). 남의 칸이면 error('taken', k).
  // ttl: 60~3600초. 주면 그 시간 뒤에 사라지는 칸 (내 칸 400개에 세지 않는다).
  set(k, v, { ttl } = {}) { return this.sendMsg(ttl === undefined ? { t: 'set', k, v } : { t: 'set', k, v, ttl }); }
  del(k) { return this.sendMsg({ t: 'del', k }); }

  // 내 위치. 1초에 15번보다 자주 부르면 모아 두었다가 마지막 것만 보낸다.
  pose(d) {
    if (!this.id) return false;
    const wait = this.poseAt + POSE_MS - Date.now();
    if (wait <= 0 && this.poseTimer === null) { this.poseAt = Date.now(); return this.sendMsg({ t: 'pose', d }); }
    this.posePending = d;
    this.poseTimer ??= setTimeout(() => {
      this.poseTimer = null;
      const pending = this.posePending; this.posePending = undefined;
      if (pending !== undefined) { this.poseAt = Date.now(); this.sendMsg({ t: 'pose', d: pending }); }
    }, Math.max(0, wait));
    return true;
  }

  // 게임 메시지 (모두에게, 또는 한 사람(id)에게). 안의 글자열은 서버가 거른다.
  send(data) { return this.sendMsg({ t: 'send', data }); }
  sendTo(id, data) { return this.sendMsg({ t: 'send', to: id, data }); }
  // 채팅 한 줄 (서버가 걸러서 보낸다). 받는 쪽은 message hook 의 data.chat
  chat(text) { return this.send({ chat: String(text ?? '') }); }

  fail(message) { this.close(); this.statusChanged('error', message); }

  close() {
    this.generation++;
    clearInterval(this.timer); clearInterval(this.expirer);
    clearTimeout(this.poseTimer); this.poseTimer = null; this.posePending = undefined;
    const socket = this.socket;
    if (this.id) this.raw('{"t":"bye"}');
    const settle = this.settle;
    this.socket = null; this.settle = null;
    settle?.resolve(); // 연결 중에 닫으면 open() 은 조용히 끝난다
    this.id = ''; this.user = null; this.ready = false;
    this.cells = new Map(); this.peers = new Map(); this.expiring = new Set();
    try { socket?.close(1000, 'bye'); } catch { /* 이미 닫힘 */ }
    if (this.status !== 'offline') this.statusChanged('offline');
  }
}
