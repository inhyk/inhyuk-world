// 모든 게임이 같이 쓰는 멀티플레이 방 (@inhyuk/net).
// 서버(services/net)가 메시지를 중계한다. 쓰는 법은 PuyoRoom과 같다: open(code) / send / leave / hooks.
//
// hooks
//   status(status, message)  offline | connecting | waiting | connected | error
//   join(peerId)             친구가 들어옴 (내가 들어갔을 때는 이미 있던 친구마다 한 번씩)
//   depart(peerId)           친구가 나감 (peerId 없이 불리면 내가 방을 나간 것)
//   message(data, fromId)    친구가 보낸 메시지
//   host(peerId)             방장이 바뀜 (방장이 나가면 가장 먼저 들어온 사람이 방장)
//   error(code)              too-big | rate | chat-rate | bad  (메시지가 너무 크거나 너무 자주 보냄)
//
// 채팅 약속: 사람이 쓴 글은 room.chat('안녕') 또는 send({ chat: '안녕', ... }) 처럼 data.chat 에만 넣는다.
// 서버가 욕설, 전화번호, 링크를 가려서 보낸다(200글자까지, 1초에 1줄). 다른 칸은 그대로 전달된다.
// 계정, 친구, 1:1 대화, 초대, 랜덤 매칭은 social.mjs (Account, Social).
export const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const DEFAULT_SERVER = 'wss://net.seonn.workers.dev';
export const PING = '{"t":"ping"}';
const CODE_LENGTH = 6;
const CONNECT_MS = 15000, PING_MS = 4000, SILENT_MS = 12000;

export const normaliseCode = value => String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
export function roomCode() {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return [...bytes].map(n => ALPHABET[n % ALPHABET.length]).join('');
}

export const MESSAGES = {
  code: '방 코드 여섯 글자를 적어 줘.',
  create: '방을 만들지 못했어. 다시 해 볼래?',
  network: '방 서버에 연결하지 못했어. 인터넷을 확인해 줘.',
  timeout: '연결 시간이 너무 오래 걸려. 인터넷을 확인해 줘.',
  notFound: '그 코드의 방을 찾을 수 없어.',
  notMember: '이 방에는 들어갈 수 없어.',
  full: max => `이 방은 벌써 ${max ?? 2}명이야. 다른 방을 만들어 줘.`,
  lost: '방 서버와 연결이 끊겼어. 다시 해 볼래?',
  left: '친구가 나갔어. 새 친구가 같은 코드로 들어올 수 있어.',
};

export const httpBase = server => server.replace(/^ws(s?):\/\//, 'http$1://').replace(/\/+$/, '');
export const wsBase = server => server.replace(/^http(s?):\/\//, 'ws$1://').replace(/\/+$/, '');

export class Room {
  // options: game(필수, 예 'puyo-tower'), maxPlayers(2~8, 방장만), server, fetch, connect(url) → WebSocket
  constructor(hooks = {}, options = {}) {
    if (!options.game) throw Error('Room needs options.game');
    this.hooks = hooks; this.options = options;
    this.generation = 0; this.role = ''; this.code = ''; this.status = 'offline';
    this.id = ''; this.hostId = ''; this.list = []; this.max = options.maxPlayers ?? 2;
    this.socket = null; this.ready = false; this.lastSeen = 0; this.settle = null;
  }
  get host() { return this.role === 'host'; }
  get guest() { return this.role === 'guest'; }
  get active() { return !!this.role; }
  get peers() { return [...this.list]; }
  get maxPlayers() { return this.max; }
  get server() { return this.options.server ?? DEFAULT_SERVER; }
  statusChanged(status, message = '') { this.status = status; this.hooks.status?.(status, message); }

  // extra.ticket: 로그인한 사람의 한 번짜리 표 (랜덤 매칭, 초대로 만든 방은 이게 있어야 들어간다)
  async open(code, extra = {}) {
    this.leave();
    const generation = this.generation;
    this.role = code ? 'guest' : 'host';
    this.code = code ? normaliseCode(code) : '';
    if (code && this.code.length !== CODE_LENGTH) { this.leave(); throw Error(MESSAGES.code); }
    this.statusChanged('connecting');
    try {
      if (this.host) await this.create();
      if (generation !== this.generation) return;
      const query = extra?.ticket ? `?ticket=${encodeURIComponent(extra.ticket)}` : '';
      const url = `${wsBase(this.server)}/rooms/${this.options.game}/${this.code}${query}`;
      let socket;
      try { socket = await (this.options.connect ?? defaultConnect)(url); } catch { throw Error(MESSAGES.network); }
      if (generation !== this.generation) { try { socket.close(); } catch { /* 무시 */ } return; }
      this.socket = socket;
      const welcomed = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error(MESSAGES.timeout)), CONNECT_MS);
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
      await welcomed;
      if (generation !== this.generation) return;
      this.timer = setInterval(() => {
        if (Date.now() - this.lastSeen > SILENT_MS) { this.fail(MESSAGES.lost); return; }
        this.raw(PING);
      }, PING_MS);
    } catch (error) {
      if (generation === this.generation) { this.leave(); this.statusChanged('error', error.message); }
      throw error;
    }
  }

  async create() {
    let response;
    try {
      response = await (this.options.fetch ?? globalThis.fetch)(`${httpBase(this.server)}/rooms/${this.options.game}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxPlayers: this.max }),
      });
    } catch { throw Error(MESSAGES.network); }
    if (!response.ok) throw Error(MESSAGES.create);
    const body = await response.json();
    this.code = body.code; this.max = body.maxPlayers;
  }

  received(socket, text) {
    if (socket !== this.socket || typeof text !== 'string') return;
    this.lastSeen = Date.now();
    let msg;
    try { msg = JSON.parse(text); } catch { return; }
    if (!msg || typeof msg !== 'object') return;
    switch (msg.t) {
      case 'welcome':
        this.id = msg.id; this.hostId = msg.host; this.max = msg.max; this.list = [...msg.peers];
        this.role = this.hostId === this.id ? 'host' : 'guest';
        this.ready = true;
        this.statusChanged(this.list.length ? 'connected' : 'waiting');
        this.settle?.resolve();
        for (const id of this.list) this.hooks.join?.(id);
        return;
      case 'join':
        if (this.list.includes(msg.id)) return;
        this.list.push(msg.id);
        if (this.list.length === 1) this.statusChanged('connected');
        this.hooks.join?.(msg.id);
        return;
      case 'leave':
        if (!this.list.includes(msg.id)) return;
        this.list = this.list.filter(id => id !== msg.id);
        this.hooks.depart?.(msg.id);
        if (!this.list.length) this.statusChanged('waiting', MESSAGES.left);
        return;
      case 'host':
        this.hostId = msg.id;
        this.role = msg.id === this.id ? 'host' : 'guest';
        this.hooks.host?.(msg.id);
        return;
      case 'msg':
        if (this.ready) this.hooks.message?.(msg.data, msg.from);
        return;
      case 'error':
        if (this.settle && (msg.code === 'not-found' || msg.code === 'full' || msg.code === 'not-member')) {
          this.settle.reject(Error(msg.code === 'full' ? MESSAGES.full(msg.max) : msg.code === 'not-member' ? MESSAGES.notMember : MESSAGES.notFound));
        } else this.hooks.error?.(msg.code);
        return;
      default:
    }
  }

  closed(socket) {
    if (socket !== this.socket) return;
    if (this.settle) this.settle.reject(Error(MESSAGES.network));
    else this.fail(MESSAGES.lost);
  }

  raw(text) {
    if (this.socket?.readyState !== 1) return false;
    try { this.socket.send(text); return true; } catch { return false; }
  }
  send(message) { return this.ready && this.raw(JSON.stringify({ t: 'send', data: message })); }
  // 채팅 한 줄 (서버가 걸러서 보낸다). 받는 쪽은 message hook 의 data.chat 으로 받는다.
  chat(text, extra = {}) { return this.send({ ...extra, chat: String(text ?? '') }); }
  sendTo(peerId, message) { return this.ready && this.raw(JSON.stringify({ t: 'send', to: peerId, data: message })); }
  fail(message) { this.leave(); this.statusChanged('error', message); }

  leave() {
    this.generation++;
    clearInterval(this.timer);
    const socket = this.socket, wasActive = this.active;
    if (this.ready) this.raw('{"t":"bye"}');
    const settle = this.settle;
    this.socket = null; this.ready = false; this.settle = null;
    settle?.resolve(); // 연결 중에 나가면 open()은 조용히 끝난다
    this.role = ''; this.code = ''; this.id = ''; this.hostId = ''; this.list = [];
    try { socket?.close(1000, 'bye'); } catch { /* 이미 닫힘 */ }
    if (wasActive) this.hooks.depart?.();
    if (this.status !== 'offline') this.statusChanged('offline');
  }
}

export function defaultConnect(url) {
  const WS = globalThis.WebSocket;
  if (!WS) throw Error('WebSocket not available');
  return new WS(url);
}

export { Account, Social, NetError, memoryStorage, SOCIAL_MESSAGES } from './social.mjs';
