// 랜덤 매칭: 게임마다 줄 하나 (Durable Object, idFromName(게임 이름)).
// 들어오면 먼저 기다리던 사람부터 살펴서(먼저 온 순서), 서로 차단하지 않았고 정지되지 않은 사람과 바로 짝짓는다.
// 짝이 되면 두 사람만 들어올 수 있는 방을 만들어 코드를 보내고 줄 연결을 닫는다. 연결이 끊기면 줄에서 빠진다.
import { DurableObject } from 'cloudflare:workers';
import { createRoom } from './rooms.js';
import { PING, PONG } from './lobby.js';

const SWEEP_MS = 15 * 1000;
const STALE_MS = 30 * 1000; // 클라이언트는 줄에 있는 동안 10초마다 핑을 보낸다

function safeSend(ws, text) { try { ws.send(text); } catch { /* 닫히는 중 */ } }
function close(ws, code, reason) { try { ws.close(code, reason); } catch { /* 이미 닫힘 */ } }

export class Matchmaker extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
    this.lock = Promise.resolve();
  }

  // 줄에서 기다리는 사람들 (먼저 온 순서)
  waiting() {
    const list = [];
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const a = ws.deserializeAttachment();
      if (a?.uid && !a.done) list.push({ ws, ...a });
    }
    return list.sort((a, b) => a.at - b.at || a.seq - b.seq);
  }

  heard(entry) {
    return Math.max(entry.at, this.ctx.getWebSocketAutoResponseTimestamp(entry.ws)?.getTime() ?? 0);
  }

  async fetch(request) {
    const uid = Number(request.headers.get('X-Net-User'));
    const nickname = decodeURIComponent(request.headers.get('X-Net-Nick') ?? '');
    const game = request.headers.get('X-Net-Game');
    const [client, server] = Object.values(new WebSocketPair());
    // 같은 사람이 다른 기기에서 또 줄을 서면 예전 것은 뺀다.
    for (const old of this.waiting()) if (old.uid === uid) this.finish(old.ws, { t: 'replaced' }, 4409, 'replaced');
    this.ctx.acceptWebSocket(server);
    this.seq = (this.seq ?? 0) + 1;
    server.serializeAttachment({ uid, nickname, game, at: Date.now(), seq: this.seq });
    // 동시에 두 사람이 들어와도 한 사람이 두 번 짝지어지지 않게 한 번에 하나씩 처리한다.
    this.lock = this.lock.then(() => this.pair(server)).catch(error => console.error('match error', error?.stack ?? error));
    if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + SWEEP_MS);
    return new Response(null, { status: 101, webSocket: client });
  }

  finish(ws, message, code, reason) {
    try { ws.serializeAttachment({ ...ws.deserializeAttachment(), done: true }); } catch { /* 이미 닫힘 */ }
    if (message) safeSend(ws, JSON.stringify(message));
    close(ws, code, reason);
  }

  async blocked(a, b) {
    const row = await this.env.DB.prepare(
      'SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?) LIMIT 1',
    ).bind(a, b, b, a).first();
    return !!row;
  }

  async suspended(uid) {
    const row = await this.env.DB.prepare('SELECT suspended_at FROM users WHERE id = ?').bind(uid).first();
    return !row || !!row.suspended_at;
  }

  async pair(ws) {
    const me = ws.readyState === WebSocket.OPEN ? ws.deserializeAttachment() : null;
    if (!me || me.done) return;
    const now = Date.now();
    for (const other of this.waiting()) {
      if (other.ws === ws || other.uid === me.uid) continue;
      if (now - this.heard(other) > STALE_MS) { this.finish(other.ws, null, 4408, 'timeout'); continue; }
      if (await this.blocked(me.uid, other.uid)) continue;
      if (await this.suspended(other.uid)) { this.finish(other.ws, { t: 'error', code: 'suspended' }, 4403, 'suspended'); continue; }
      if (ws.readyState !== WebSocket.OPEN || other.ws.readyState !== WebSocket.OPEN) continue;
      const code = await createRoom(this.env, me.game, { maxPlayers: 2, members: [other.uid, me.uid] });
      if (!code) { this.finish(ws, { t: 'error', code: 'busy' }, 1011, 'busy'); return; }
      const base = { t: 'matched', code, game: me.game };
      const meProfile = { id: me.uid, nickname: me.nickname };
      const otherProfile = { id: other.uid, nickname: other.nickname };
      // 접속 알림(/live)에도 같은 소식을 보낸다.
      try {
        const lobby = this.env.LOBBY.get(this.env.LOBBY.idFromName('lobby'));
        await lobby.push(other.uid, { ...base, t: 'match', opponent: meProfile });
        await lobby.push(me.uid, { ...base, t: 'match', opponent: otherProfile });
      } catch (error) { console.error('lobby push failed', error?.message); }
      this.finish(other.ws, { ...base, opponent: meProfile }, 1000, 'matched');
      this.finish(ws, { ...base, opponent: otherProfile }, 1000, 'matched');
      return;
    }
    safeSend(ws, JSON.stringify({ t: 'queued', game: me.game }));
  }

  async webSocketMessage(ws, message) {
    if (typeof message !== 'string') return;
    if (message.includes('"cancel"')) { this.finish(ws, { t: 'canceled' }, 1000, 'cancel'); return; }
    if (message.includes('"ping"')) safeSend(ws, PONG);
  }

  async webSocketClose(ws) { this.finish(ws, null, 1000, 'closed'); }
  async webSocketError(ws) { this.finish(ws, null, 1000, 'closed'); }

  async alarm() {
    const now = Date.now();
    for (const entry of this.waiting()) if (now - this.heard(entry) > STALE_MS) this.finish(entry.ws, null, 4408, 'timeout');
    if (this.waiting().length) await this.ctx.storage.setAlarm(now + SWEEP_MS);
  }
}
