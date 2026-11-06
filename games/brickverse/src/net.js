// 공용 서버(services/net)의 방 코드로 친구와 같이 놀기. 로그인 없이 방 코드만 쓴다.
// 사람이 쓴 글은 보내지 않는다: 별명, 말, 옷은 모두 번호로 보낸다.
import { Room, DEFAULT_SERVER } from '../../../packages/net/index.mjs';
import { GAME, MAX_PLAYERS } from '../core.mjs';

const LOOPBACK = /^(https?|wss?):\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?\/?$/;
export function serverUrl(search = location.search) {
  let q = null;
  try { q = new URLSearchParams(search).get('net'); } catch { /* 기본값 */ }
  if (q && LOOPBACK.test(q)) return q.replace(/\/+$/, '');
  return DEFAULT_SERVER;
}

export class Net {
  constructor(hooks) {
    this.hooks = hooks;
    this.statusText = '친구와 같은 방 코드로 들어오면 같은 세계에서 놀 수 있어.';
    this.state = 'offline';
    this.room = new Room({
      status: (s, msg) => {
        this.state = s;
        this.statusText = {
          offline: '친구와 같은 방 코드로 들어오면 같은 세계에서 놀 수 있어.',
          connecting: '연결하는 중…',
          waiting: '방을 만들었어! 친구에게 코드를 알려 줘.',
          connected: '친구와 연결됐어! 같은 문으로 들어가면 같이 놀 수 있어.',
          error: msg || '연결이 끊겼어.',
        }[s] ?? msg ?? '';
        if (s === 'waiting' && msg) this.statusText = msg;
        hooks.status?.(s, this.statusText);
      },
      join: id => hooks.join?.(id),
      depart: id => hooks.depart?.(id),
      host: id => hooks.host?.(id),
      rejoin: id => hooks.join?.(id),
      message: (data, from) => { if (data && typeof data === 'object' && !Array.isArray(data)) hooks.message?.(data, from); },
      error: code => hooks.error?.(code),
    }, { game: GAME, maxPlayers: MAX_PLAYERS, server: serverUrl() });
  }
  get active() { return this.room.active; }
  get live() { return this.room.ready && this.room.peers.length > 0; }
  get code() { return this.room.code; }
  get id() { return this.room.id; }
  get host() { return this.room.host || !this.room.active; }
  get peers() { return this.room.peers; }
  // p1 → 0, p2 → 1 ... (타이쿤 땅 번호)
  get slot() { const n = parseInt(String(this.room.id).replace(/\D/g, ''), 10); return Number.isFinite(n) && n > 0 ? (n - 1) % MAX_PLAYERS : 0; }

  async create() {
    try { await this.room.open(); this.hooks.opened?.(); } catch (e) { this.hooks.status?.('error', e.message); }
  }
  async join(code) {
    try { await this.room.open(code); this.hooks.opened?.(); } catch (e) { this.statusText = e.message; this.hooks.status?.('error', e.message); }
  }
  leave() { this.room.leave(); this.hooks.closed?.(); }
  send(data) { return this.live && this.room.send(data); }
  sendTo(id, data) { return this.room.ready && this.room.sendTo(id, data); }
}
