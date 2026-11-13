// 공용 서버(services/net)의 방 코드로 친구와 같이 먹기. 로그인 없이 방 코드만 쓴다.
// 사람이 쓴 글은 보내지 않는다: 위치, 몸무게, 옷 번호 같은 숫자만 보낸다.
import { Room, DEFAULT_SERVER } from '../../../packages/net/index.mjs';
import { GAME, MAX_PLAYERS } from '../core.mjs';

const LOOPBACK = /^(https?|wss?):\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?\/?$/;
export function serverUrl(search = location.search) {
  let q = null;
  try { q = new URLSearchParams(search).get('net'); } catch { /* 기본값 */ }
  if (q && LOOPBACK.test(q)) return q.replace(/\/+$/, '');
  return DEFAULT_SERVER;
}
const TEXT = {
  offline: '방을 만들고 코드를 친구에게 알려 줘. 4명까지 같이 먹을 수 있어.',
  connecting: '연결하는 중…',
  waiting: '방을 만들었어! 친구에게 코드를 알려 줘.',
  connected: '친구와 연결됐어! 같이 먹으면 코인을 20% 더 받아.',
};

export class Net {
  constructor(hooks) {
    this.hooks = hooks; this.state = 'offline'; this.text = TEXT.offline;
    this.room = new Room({
      status: (s, msg) => { this.state = s; this.text = s === 'error' ? (msg || '연결이 끊겼어.') : (TEXT[s] ?? msg ?? ''); hooks.status?.(s, this.text); },
      join: (id) => hooks.join?.(id),
      depart: (id) => hooks.depart?.(id),
      rejoin: (id) => hooks.join?.(id),
      message: (data, from) => { if (data && typeof data === 'object' && !Array.isArray(data)) hooks.message?.(data, from); },
    }, { game: GAME, maxPlayers: MAX_PLAYERS, server: serverUrl() });
  }
  get active() { return this.room.active; }
  get live() { return this.room.ready && this.room.peers.length > 0; }
  get code() { return this.room.code; }
  get id() { return this.room.id; }
  get peers() { return this.room.peers; }
  async create() { try { await this.room.open(); } catch (e) { this.state = 'error'; this.text = e.message; this.hooks.status?.('error', e.message); } }
  async join(code) { try { await this.room.open(code); } catch (e) { this.state = 'error'; this.text = e.message; this.hooks.status?.('error', e.message); } }
  leave() { this.room.leave(); this.state = 'offline'; this.text = TEXT.offline; this.hooks.status?.('offline', this.text); }
  send(data) { return this.live && this.room.send(data); }
}
