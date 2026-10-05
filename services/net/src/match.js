// 랜덤 매칭: 게임마다 줄 하나 (Durable Object, idFromName(게임 이름)).
// 들어오면 먼저 기다리던 사람부터 살펴서(먼저 온 순서), 서로 차단하지 않았고 정지되지 않은 사람과 바로 짝짓는다.
// 짝이 되면 두 사람만 들어올 수 있는 방을 만들어 코드를 보내고 줄 연결을 닫는다. 연결이 끊기면 줄에서 빠진다.
// 한 사람은 줄에 한 번만 선다: 다른 기기에서 또 서면 예전 연결은 'replaced' 로 빠진다.
import { DurableObject } from 'cloudflare:workers';
import { createRoom } from './rooms.js';
import { track } from './social.js';
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
    await track(this.env, uid, 'match', game);
    return new Response(null, { status: 101, webSocket: client });
  }

  // 아직 줄에 있는 연결인가 (취소, 끊김, 다른 기기로 바뀜이 아니면)
  alive(ws) {
    if (ws.readyState !== WebSocket.OPEN) return false;
    const a = ws.deserializeAttachment();
    return !!a && !a.done;
  }

  // 시험에서 바꿔 끼울 수 있게 방 만들기를 따로 둔다.
  makeRoom(game, members) { return createRoom(this.env, game, { maxPlayers: 2, members }); }

  // 정지된 사람을 줄에서 뺀다 (로비가 부른다).
  kickUser(uid) {
    for (const entry of this.waiting()) if (entry.uid === uid) this.finish(entry.ws, { t: 'error', code: 'suspended' }, 4403, 'suspended');
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

  // quiet: 이미 'queued' 를 받은 사람을 다시 짝지을 때는 또 알리지 않는다.
  async pair(ws, quiet = false) {
    if (!this.alive(ws)) return;
    const me = ws.deserializeAttachment();
    const now = Date.now();
    for (const other of this.waiting()) {
      if (other.ws === ws || other.uid === me.uid) continue;
      if (now - this.heard(other) > STALE_MS) { this.finish(other.ws, null, 4408, 'timeout'); continue; }
      if (await this.blocked(me.uid, other.uid)) continue;
      if (await this.suspended(other.uid)) { this.finish(other.ws, { t: 'error', code: 'suspended' }, 4403, 'suspended'); continue; }
      if (!this.alive(ws)) return;
      if (!this.alive(other.ws)) continue;
      const code = await this.makeRoom(me.game, [other.uid, me.uid]);
      if (!code) { this.finish(ws, { t: 'error', code: 'busy' }, 1011, 'busy'); return; }
      // 방을 만드는 동안 한쪽이 취소했거나 끊겼거나 다른 기기로 바뀌었으면 matched 를 보내지 않는다.
      // 남은 사람은 줄에 그대로(들어온 시각 그대로, 즉 줄 앞에) 두고 다시 짝을 찾는다. 만든 방은 2분 뒤 저절로 지워진다.
      const meAlive = this.alive(ws), otherAlive = this.alive(other.ws);
      if (!meAlive || !otherAlive) {
        if (meAlive) return this.pair(ws, quiet);
        if (otherAlive) return this.pair(other.ws, true);
        return;
      }
      const base = { t: 'matched', code, game: me.game };
      const meProfile = { id: me.uid, nickname: me.nickname };
      const otherProfile = { id: other.uid, nickname: other.nickname };
      this.finish(other.ws, { ...base, opponent: meProfile }, 1000, 'matched');
      this.finish(ws, { ...base, opponent: otherProfile }, 1000, 'matched');
      // 접속 알림(/live)에도 같은 소식을 보낸다.
      try {
        const lobby = this.env.LOBBY.get(this.env.LOBBY.idFromName('lobby'));
        await lobby.push(other.uid, { ...base, t: 'match', opponent: meProfile });
        await lobby.push(me.uid, { ...base, t: 'match', opponent: otherProfile });
      } catch (error) { console.error('lobby push failed', error?.message); }
      return;
    }
    if (!quiet) safeSend(ws, JSON.stringify({ t: 'queued', game: me.game }));
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
