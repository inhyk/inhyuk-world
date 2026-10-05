// 로비: 로그인한 사람의 실시간 연결(/live)을 모두 들고 있는 Durable Object 하나.
// 누가 접속 중인지 알고, 친구 요청, 1:1 대화, 초대, 매칭 소식을 바로 보내 준다.
// 사람이 아주 많아지면 사람별로 나누면 되지만, 지금 규모에서는 하나로 충분하다 (README "구조").
import { DurableObject } from 'cloudflare:workers';
import { createRoom, roomStub } from './rooms.js';

export const PING = '{"t":"ping"}';
export const PONG = '{"t":"pong"}';
export const INVITE_MS = 60 * 1000;
const SWEEP_MS = 30 * 1000;
const STALE_MS = 90 * 1000; // 클라이언트는 25초마다 핑을 보낸다
// 사람마다 최근에 들어간 방과 매칭 줄 (정지할 때 끊을 곳). 하루 지난 것은 버리고 20곳까지만.
const TRACK_MS = 24 * 60 * 60 * 1000, TRACK_MAX = 20;

function safeSend(ws, text) { try { ws.send(text); } catch { /* 닫히는 중 */ } }
function randomId() {
  const a = new Uint8Array(9);
  crypto.getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
}

export class Lobby extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  // 지금 열려 있는 연결들 [{ ws, uid, nick, at }]
  sockets(uid) {
    const list = [];
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const a = ws.deserializeAttachment();
      if (!a?.uid || a.gone) continue;
      if (uid === undefined || a.uid === uid) list.push({ ws, ...a });
    }
    return list;
  }

  async friendsOf(uid) {
    const { results } = await this.env.DB.prepare('SELECT friend_id FROM friends WHERE user_id = ?').bind(uid).all();
    return results.map(r => r.friend_id);
  }

  async fetch(request) {
    const uid = Number(request.headers.get('X-Net-User'));
    const nickname = decodeURIComponent(request.headers.get('X-Net-Nick') ?? '');
    const [client, server] = Object.values(new WebSocketPair());
    const wasOnline = this.sockets(uid).length > 0;
    this.ctx.acceptWebSocket(server, [`u${uid}`]);
    server.serializeAttachment({ uid, nickname, at: Date.now() });
    const friends = await this.friendsOf(uid);
    const online = new Set(this.sockets().map(s => s.uid));
    const invites = (await this.openInvites()).filter(i => i.to.id === uid).map(i => ({ id: i.id, from: i.from, game: i.game, expires: i.expires }));
    safeSend(server, JSON.stringify({ t: 'hello', user: { id: uid, nickname }, online: friends.filter(id => online.has(id)), invites }));
    if (!wasOnline) for (const id of friends) this.send(id, { t: 'online', id: uid });
    if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + SWEEP_MS);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    // 클라이언트가 보내는 것은 핑뿐이다. 글자가 조금 다른 핑에도 대답한다.
    if (typeof message === 'string' && message.includes('"ping"')) safeSend(ws, PONG);
  }

  async webSocketClose(ws) { await this.gone(ws); }
  async webSocketError(ws) { await this.gone(ws); }

  async gone(ws) {
    const me = ws.deserializeAttachment();
    if (!me?.uid || me.gone) return;
    try { ws.serializeAttachment({ ...me, gone: true }); } catch { /* 이미 닫힘 */ }
    try { ws.close(1000, 'bye'); } catch { /* 이미 닫힘 */ }
    if (this.sockets(me.uid).length) return; // 다른 기기로 아직 접속 중
    for (const id of await this.friendsOf(me.uid)) this.send(id, { t: 'offline', id: me.uid });
  }

  async alarm() {
    const now = Date.now();
    for (const s of this.sockets()) {
      const heard = Math.max(s.at, this.ctx.getWebSocketAutoResponseTimestamp(s.ws)?.getTime() ?? 0);
      if (now - heard > STALE_MS) await this.gone(s.ws);
    }
    const invites = await this.openInvites(true);
    if (Math.random() < 0.02) await this.pruneTracks();
    if (this.sockets().length || invites.length) await this.ctx.storage.setAlarm(now + SWEEP_MS);
  }

  send(uid, event) {
    const text = JSON.stringify(event);
    let delivered = 0;
    for (const s of this.sockets(uid)) { safeSend(s.ws, text); delivered++; }
    return delivered;
  }

  // ---- Worker 가 부르는 함수 (RPC) ----

  // 이 중에 접속 중인 사람 번호들
  online(ids) {
    const on = new Set(this.sockets().map(s => s.uid));
    return ids.filter(id => on.has(id));
  }

  push(uid, event) { return this.send(uid, event); }

  // uid 가 방(kind 'room', name '<게임>:<코드>') 이나 매칭 줄(kind 'match', name 게임)에 들어갔다.
  async track(uid, kind, name) {
    const key = `track:${uid}`;
    const now = Date.now();
    const list = ((await this.ctx.storage.get(key)) ?? []).filter(e => now - e.at < TRACK_MS && !(e.kind === kind && e.name === name));
    list.push({ kind, name, at: now });
    await this.ctx.storage.put(key, list.slice(-TRACK_MAX));
  }

  async pruneTracks() {
    const now = Date.now();
    for (const [key, list] of await this.ctx.storage.list({ prefix: 'track:' })) {
      if (!list.some(e => now - e.at < TRACK_MS)) await this.ctx.storage.delete(key);
    }
  }

  // 정지된 계정: /live 연결, 들어가 있는 방, 매칭 줄을 모두 끊는다.
  async kick(uid, reason = 'suspended') {
    const tracked = (await this.ctx.storage.get(`track:${uid}`)) ?? [];
    await this.ctx.storage.delete(`track:${uid}`);
    for (const { kind, name } of tracked) {
      try {
        if (kind === 'room') { const [game, code] = name.split(':'); await roomStub(this.env, game, code).kickUser(uid); }
        else if (kind === 'match') await this.env.MATCH.get(this.env.MATCH.idFromName(name)).kickUser(uid);
      } catch (error) { console.error('kick failed', kind, name, error?.message); }
    }
    for (const s of this.sockets(uid)) {
      safeSend(s.ws, JSON.stringify({ t: 'kicked', reason }));
      try { s.ws.serializeAttachment({ ...s.ws.deserializeAttachment(), gone: true }); s.ws.close(4403, reason); } catch { /* 이미 닫힘 */ }
    }
    for (const id of await this.friendsOf(uid)) this.send(id, { t: 'offline', id: uid });
    for (const invite of await this.openInvites()) {
      if (invite.from.id === uid || invite.to.id === uid) await this.ctx.storage.delete(`invite:${invite.id}`);
    }
  }

  async openInvites(prune = false) {
    const now = Date.now();
    const list = [];
    for (const [key, invite] of await this.ctx.storage.list({ prefix: 'invite:' })) {
      if (invite.expires <= now) { if (prune) await this.ctx.storage.delete(key); continue; }
      list.push(invite);
    }
    return list;
  }

  // 초대 보내기. from, to 는 { id, nickname }. 받는 사람이 접속해 있어야 한다.
  async createInvite(from, to, game) {
    if (!this.sockets(to.id).length) return { error: 'offline' };
    for (const old of await this.openInvites()) {
      if (old.from.id === from.id && old.to.id === to.id) await this.ctx.storage.delete(`invite:${old.id}`);
    }
    const invite = { id: randomId(), from, to, game, expires: Date.now() + INVITE_MS };
    await this.ctx.storage.put(`invite:${invite.id}`, invite);
    this.send(to.id, { t: 'invite', invite: { id: invite.id, from, game, expires: invite.expires } });
    if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + SWEEP_MS);
    return { id: invite.id, expires: invite.expires };
  }

  // 초대 받은 사람이 수락(accept=true) 또는 거절. 수락하면 두 사람만 들어올 수 있는 방을 만들어 둘에게 코드를 보낸다.
  async answerInvite(id, user, accept) {
    const invite = await this.ctx.storage.get(`invite:${id}`);
    if (!invite || invite.to.id !== user.id) return { error: 'not-found' };
    await this.ctx.storage.delete(`invite:${id}`);
    if (invite.expires <= Date.now()) return { error: 'expired' };
    if (!accept) {
      this.send(invite.from.id, { t: 'invite-declined', invite: id, by: invite.to });
      return { ok: true };
    }
    const friends = await this.env.DB.prepare('SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?').bind(invite.from.id, invite.to.id).first();
    if (!friends) return { error: 'not-friends' };
    if (!this.sockets(invite.from.id).length) return { error: 'offline' };
    const code = await createRoom(this.env, invite.game, { maxPlayers: 2, members: [invite.from.id, invite.to.id] });
    if (!code) return { error: 'busy' };
    const room = { t: 'room', via: 'invite', invite: id, code, game: invite.game };
    this.send(invite.from.id, { ...room, opponent: invite.to });
    this.send(invite.to.id, { ...room, opponent: invite.from });
    return { code, game: invite.game, opponent: invite.from };
  }

  // 보낸 사람이 초대를 취소
  async cancelInvite(id, user) {
    const invite = await this.ctx.storage.get(`invite:${id}`);
    if (!invite || invite.from.id !== user.id) return { error: 'not-found' };
    await this.ctx.storage.delete(`invite:${id}`);
    this.send(invite.to.id, { t: 'invite-canceled', invite: id });
    return { ok: true };
  }
}
