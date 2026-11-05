// 같이 쓰는 세계(World): 모두가 나가도 남는 칸(cell)을 가진 방. `<게임>:<세계 이름>` 하나에 Durable Object 하나.
// 블록을 놓는 마을처럼, 누가 놓은 것이 계속 남아야 하는 게임이 쓴다. 서버는 게임 내용을 모른다.
// - 칸: 이름(k) → 값(v, 아무 JSON). 칸마다 처음 놓은 사람(주인)만 바꾸거나 지울 수 있다. 이 DO 의 SQLite 에 저장한다.
//   v 안의 글자열은 24글자까지이고 모두 거르개를 거친다 (칸에 글을 숨겨 보내지 못하게).
//   ttl(초)을 주면 그 시간이 지나면 사라지는 칸이 된다 (부순 나무가 10분 뒤 다시 자라기 같은 것). 사라질 때 서버는 알리지 않고,
//   클라이언트가 exp 를 보고 스스로 지운다.
// - 위치(pose)와 메시지(send)는 저장하지 않고 다른 사람에게 전하기만 한다. 서로 차단한 사이에는 전하지 않는다 (칸은 같이 본다).
// - 채팅(data.chat)은 방(Room)과 같은 거르개, 같은 횟수 제한을 거치고, 신고에 쓰려고 마지막 50줄을 기억한다.
// - 로그인한 사람만 들어온다 (Worker 가 표를 확인하고 X-Net-User, X-Net-Nick, X-Net-World 를 붙여 준다).
import { DurableObject } from 'cloudflare:workers';
import {
  PING, PONG, SWEEP_MS, STALE_MS, CHAT_KEEP_MS, safeSend, closeSocket, tooBig, lastHeard, allowMessage, allowChatLine,
  recentLinesOf, pushLine,
} from './rooms.js';
import { filterText, maskSplitPhone, cleanData } from './filter.js';
import * as social from './social.js';

export const WORLD_MAX = 12;           // 한 세계에 같이 있을 수 있는 사람
export const CELL_KEY_RE = /^[A-Za-z0-9|._:-]{1,64}$/;
export const CELL_VALUE_MAX = 256;     // JSON.stringify(v) 글자 수
export const CELL_STRING_MAX = 24;     // v 안의 글자열 하나의 글자 수
export const CELLS_PER_USER = 400;     // 한 사람이 한 세계에 놓을 수 있는 칸 (ttl 칸은 세지 않는다)
export const CELLS_PER_WORLD = 20000;  // 한 세계의 칸 (ttl 칸 포함)
export const TTL_MIN = 60, TTL_MAX = 3600;
export const POSE_MAX = 512;           // JSON.stringify(d) 글자 수
export const CHUNK = 500;              // 들어올 때 칸을 몇 개씩 나눠 보내나
const USERS_MAX = 500;                 // 신고용으로 기억하는 "이 세계에 있었던 사람" 수

const bad = () => { throw Error('bad'); };

export class World extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // 핑은 세계를 깨우지 않고 런타임이 바로 대답한다.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
    this.buckets = new Map();
    this.sql = ctx.storage.sql;
    // cells: 칸. owner 는 사용자 번호, nick 은 놓을 때의 닉네임, exp 는 사라질 때(ms, 없으면 계속 남음).
    // counts: 다시 세지 않으려고 적어 두는 수. 'total' = cells 의 줄 수, 'u<번호>' = 그 사람의 ttl 없는 칸 수.
    // (COUNT(*) 는 줄을 모두 읽어서 읽기 한도를 빨리 쓴다.)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS cells (k TEXT PRIMARY KEY, v TEXT NOT NULL, owner INTEGER NOT NULL, nick TEXT NOT NULL, updated INTEGER NOT NULL, exp INTEGER);
      CREATE INDEX IF NOT EXISTS cells_exp ON cells (exp) WHERE exp IS NOT NULL;
      CREATE TABLE IF NOT EXISTS counts (key TEXT PRIMARY KEY, n INTEGER NOT NULL);
    `);
  }

  // ---- 들어오기 ----

  async fetch(request) {
    const [client, server] = Object.values(new WebSocketPair());
    const uid = Number(request.headers.get('X-Net-User')) || null;
    const nick = nickOf(request);
    const name = request.headers.get('X-Net-World') ?? '';
    const peers = this.peers();
    // 한 사람(사용자 번호)은 자리 하나. 같은 사람이 또 들어오면 예전 연결을 닫고 같은 번호를 새 연결에 준다.
    const seat = uid ? peers.find(p => p.uid === uid) : null;
    const refusal = !uid ? 'login-required' : !seat && peers.length >= WORLD_MAX ? 'full' : '';
    if (refusal) {
      server.accept();
      server.send(JSON.stringify({ t: 'error', code: refusal, max: WORLD_MAX }));
      server.close(refusal === 'full' ? 4403 : 4401, refusal);
      return new Response(null, { status: 101, webSocket: client });
    }
    let id;
    const others = peers.filter(p => p.ws !== seat?.ws);
    if (seat) {
      id = seat.id;
      try { seat.ws.serializeAttachment({ ...seat.ws.deserializeAttachment(), gone: true }); } catch { /* 이미 닫힘 */ }
      this.buckets.delete(seat.ws);
      safeSend(seat.ws, JSON.stringify({ t: 'error', code: 'replaced' }));
      closeSocket(seat.ws, 4409, 'replaced');
    } else {
      const next = (await this.ctx.storage.get('next')) ?? 1;
      await this.ctx.storage.put('next', next + 1);
      id = `p${next}`;
    }
    // 서로 차단한 사이인 사람들 (위치와 메시지를 전하지 않는다). 들어올 때 한 번 D1 에서 찾아 연결마다 적어 둔다.
    const blocked = await social.blockedAmong(this.env, uid, others.map(p => p.uid));
    for (const p of others) {
      const a = p.ws.deserializeAttachment();
      const list = (a.blocked ?? []).filter(u => u !== uid);
      if (blocked.has(p.uid)) list.push(uid);
      try { p.ws.serializeAttachment({ ...a, blocked: list }); } catch { /* 닫히는 중 */ }
    }
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id, uid, nick, joined: Date.now(), blocked: [...blocked] });
    await this.rememberUser(uid);

    const now = Date.now();
    this.purgeExpired(now);
    server.send(JSON.stringify({
      t: 'welcome', id, user: { id: uid, nickname: nick }, max: WORLD_MAX,
      peers: others.map(p => ({ id: p.id, user: { id: p.uid, nickname: p.nick } })),
    }));
    // 칸은 500개씩 나눠 보낸다. 하나도 없어도 done 이 붙은 묶음 하나는 꼭 보낸다.
    let list = [];
    for (const row of this.sql.exec('SELECT k, v, owner, nick, exp FROM cells WHERE exp IS NULL OR exp > ?', now)) {
      list.push(cellOf(row));
      if (list.length === CHUNK) { server.send(JSON.stringify({ t: 'cells', list, done: false })); list = []; }
    }
    server.send(JSON.stringify({ t: 'cells', list, done: true }));
    if (!seat) {
      const text = JSON.stringify({ t: 'join', id, user: { id: uid, nickname: nick } });
      for (const p of others) safeSend(p.ws, text);
    }
    await this.ctx.storage.setAlarm(Date.now() + SWEEP_MS);
    // 정지할 때 이 세계의 연결도 끊을 수 있게 로비에 적어 둔다.
    if (name) await social.track(this.env, uid, 'world', name);
    return new Response(null, { status: 101, webSocket: client });
  }

  // ---- 받기 ----

  async webSocketMessage(ws, message) {
    const me = ws.deserializeAttachment();
    if (!me || me.gone) return; // 바뀌어 나간 예전 연결이 보내는 것은 버린다
    this.lastHeard(ws, true);
    if (typeof message !== 'string') return this.warn(ws, 'bad');
    if (tooBig(message)) return this.warn(ws, 'too-big');
    if (!allowMessage(this.buckets, ws, (w, code) => this.warn(w, code))) return;
    let msg;
    try { msg = JSON.parse(message); } catch { return this.warn(ws, 'bad'); }
    if (!msg || typeof msg !== 'object') return this.warn(ws, 'bad');
    switch (msg.t) {
      case 'ping': return ws.send(PONG);
      case 'bye': closeSocket(ws, 1000, 'bye'); return this.departed(ws);
      case 'set': return this.onSet(ws, me, msg);
      case 'del': return this.onDel(ws, me, msg);
      case 'pose': return this.onPose(ws, me, msg);
      case 'send': return this.onSend(ws, me, msg);
      default: return this.warn(ws, 'bad');
    }
  }

  onSet(ws, me, msg) {
    const { k } = msg;
    if (typeof k !== 'string' || !CELL_KEY_RE.test(k)) return this.warn(ws, 'bad');
    const ttl = msg.ttl;
    if (ttl !== undefined && ttl !== null && (!Number.isInteger(ttl) || ttl < TTL_MIN || ttl > TTL_MAX)) return this.warn(ws, 'bad', k);
    let v;
    try { v = cleanValue(msg.v); } catch { return this.warn(ws, 'bad', k); }
    const result = this.store(me.uid, me.nick, k, v, ttl ?? null);
    if (result.error) return this.warn(ws, result.error, k);
    this.everyone(JSON.stringify({ t: 'cell', ...cellOf(result.row) }));
  }

  // 칸 하나를 놓거나 바꾼다. 결과 { row } 또는 { error: 'taken' | 'limit' | 'world-full' }.
  // SQLite 호출은 기다리지 않고 바로 끝나므로, 사이에 다른 메시지가 끼어들지 않는다.
  store(uid, nick, k, v, ttl = null, now = Date.now()) {
    const text = JSON.stringify(v);
    return this.ctx.storage.transactionSync(() => {
      const old = this.sql.exec('SELECT owner, exp FROM cells WHERE k = ?', k).toArray()[0];
      const live = old && (old.exp === null || old.exp > now);
      if (live && old.owner !== uid) return { error: 'taken' };
      const permanent = ttl === null;
      // ttl 없는 칸은 사라지지 않으므로 old.exp === null 이면 내 칸이다.
      if (permanent && !(old && old.exp === null) && this.count(`u${uid}`) >= CELLS_PER_USER) return { error: 'limit' };
      if (!old && this.count('total') >= CELLS_PER_WORLD) {
        this.purgeExpired(now);
        if (this.count('total') >= CELLS_PER_WORLD) return { error: 'world-full' };
      }
      if (old && old.exp === null) this.add(`u${old.owner}`, -1);
      if (permanent) this.add(`u${uid}`, 1);
      if (!old) this.add('total', 1);
      const exp = permanent ? null : now + ttl * 1000;
      this.sql.exec('INSERT OR REPLACE INTO cells (k, v, owner, nick, updated, exp) VALUES (?, ?, ?, ?, ?, ?)', k, text, uid, nick, now, exp);
      return { row: { k, v: text, owner: uid, nick, exp } };
    });
  }

  onDel(ws, me, msg) {
    const { k } = msg;
    if (typeof k !== 'string' || !CELL_KEY_RE.test(k)) return this.warn(ws, 'bad');
    const now = Date.now();
    const error = this.ctx.storage.transactionSync(() => {
      const old = this.sql.exec('SELECT owner, exp FROM cells WHERE k = ?', k).toArray()[0];
      if (!old || (old.exp !== null && old.exp <= now)) return 'missing';
      if (old.owner !== me.uid) return 'not-owner';
      this.sql.exec('DELETE FROM cells WHERE k = ?', k);
      this.add('total', -1);
      if (old.exp === null) this.add(`u${old.owner}`, -1);
      return '';
    });
    if (error) return this.warn(ws, error, k);
    this.everyone(JSON.stringify({ t: 'cell', k, v: null }));
  }

  // 위치: 저장하지 않고 다른 사람에게 전한다 (512글자까지, 글자열은 거른다).
  onPose(ws, me, msg) {
    if (msg.d === undefined) return this.warn(ws, 'bad');
    let d;
    try {
      d = cleanData(msg.d);
      if (JSON.stringify(d).length > POSE_MAX) bad();
    } catch { return this.warn(ws, 'bad'); }
    this.relay(ws, me, JSON.stringify({ t: 'pose', id: me.id, d }));
  }

  // 게임 메시지: 관계자 방(Room 의 members)처럼 data 안의 모든 글자열을 거른다. 사람이 쓴 글은 data.chat 에만.
  async onSend(ws, me, msg) {
    if (msg.data === undefined) return this.warn(ws, 'bad');
    let data = msg.data;
    if (!!data && typeof data === 'object' && !Array.isArray(data) && 'chat' in data) {
      if (typeof data.chat !== 'string') return this.warn(ws, 'bad');
      if (!allowChatLine(this.buckets, ws, (w, code) => this.warn(w, code))) return;
      let { text } = filterText(data.chat);
      if (!text) return;
      const chat = await this.chat();
      text = maskSplitPhone(recentLinesOf(chat, me.id), text);
      data = { ...data, chat: text };
      await this.ctx.storage.put('chat', pushLine(chat, { from: me.id, uid: me.uid, text, at: Date.now() }));
    }
    try { data = cleanData(data); } catch { return this.warn(ws, 'bad'); }
    const out = JSON.stringify({ t: 'msg', from: me.id, data });
    if (typeof msg.to === 'string') {
      const target = this.peers().find(p => p.id === msg.to);
      if (target && target.ws !== ws && canSee(me, target)) safeSend(target.ws, out);
      return;
    }
    this.relay(ws, me, out);
  }

  // 나를 뺀, 나와 차단한 사이가 아닌 사람들에게
  relay(ws, me, text) {
    for (const p of this.peers()) if (p.ws !== ws && canSee(me, p)) safeSend(p.ws, text);
  }

  // 칸 소식은 차단과 상관없이 모두에게 (보낸 사람 포함)
  everyone(text) {
    for (const p of this.peers()) safeSend(p.ws, text);
  }

  // ---- 나가기, 알람 ----

  async webSocketClose(ws, code) {
    closeSocket(ws, code === 1005 || code === 1006 ? 1000 : code, 'closed');
    await this.departed(ws);
  }

  async webSocketError(ws) { await this.departed(ws); }

  async departed(ws) {
    const me = ws.deserializeAttachment();
    if (!me?.id || me.gone) return;
    try { ws.serializeAttachment({ ...me, gone: true }); } catch { /* 이미 닫힘 */ }
    this.buckets.delete(ws);
    const rest = this.peers().filter(p => p.ws !== ws);
    const text = JSON.stringify({ t: 'leave', id: me.id });
    for (const p of rest) safeSend(p.ws, text);
    if (!rest.length) {
      // 모두 나갔다. 칸은 그대로 두고, 채팅 기록은 신고할 수 있게 10분 더 둔 뒤 지운다.
      this.buckets.clear();
      const chat = await this.ctx.storage.get('chat');
      if (chat) {
        const until = Date.now() + CHAT_KEEP_MS;
        await this.ctx.storage.put('chat', { ...chat, until });
        await this.ctx.storage.setAlarm(until);
      } else await this.ctx.storage.deleteAlarm();
    }
  }

  async alarm() {
    const now = Date.now();
    for (const p of this.peers()) {
      if (now - this.lastHeard(p.ws) > STALE_MS) {
        closeSocket(p.ws, 4408, 'timeout');
        await this.departed(p.ws);
      }
    }
    this.purgeExpired(now);
    if (this.peers().length) { await this.ctx.storage.setAlarm(now + SWEEP_MS); return; }
    const chat = await this.ctx.storage.get('chat');
    if (!chat) return;
    if (chat.until && now >= chat.until) await this.ctx.storage.delete('chat');
    else await this.ctx.storage.setAlarm(chat.until ?? now + CHAT_KEEP_MS);
  }

  // ---- 신고, 정지 (Worker 와 로비가 부른다) ----

  // 신고용: 이 세계의 채팅 기록과 들어왔던 사용자 번호들
  async chatLog() {
    const chat = await this.ctx.storage.get('chat');
    return { lines: chat?.lines ?? [], users: chat?.users ?? [] };
  }

  // 정지된 사람의 연결을 끊는다. 놓은 칸은 그대로 둔다.
  async kickUser(uid) {
    for (const p of this.peers()) {
      if (p.uid !== uid) continue;
      safeSend(p.ws, JSON.stringify({ t: 'error', code: 'suspended' }));
      await this.departed(p.ws);
      closeSocket(p.ws, 4403, 'suspended');
    }
  }

  // ---- 도우미 ----

  // 지금 세계에 있는 사람들 (들어온 순서대로)
  peers() {
    const list = [];
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const a = ws.deserializeAttachment();
      if (a?.id && !a.gone) list.push({ ws, id: a.id, uid: a.uid, nick: a.nick ?? '', joined: a.joined, blocked: a.blocked ?? [] });
    }
    return list.sort((a, b) => a.joined - b.joined || Number(a.id.slice(1)) - Number(b.id.slice(1)));
  }

  async chat() {
    const chat = (await this.ctx.storage.get('chat')) ?? { lines: [], users: [] };
    delete chat.until; // 누가 있는 동안에는 지우지 않는다
    return chat;
  }

  // 신고할 때 "이 세계에 있었던 사람"인지 확인하려고 기억한다 (마지막 500명).
  async rememberUser(uid) {
    const chat = await this.chat();
    chat.users = chat.users.filter(u => u !== uid);
    chat.users.push(uid);
    if (chat.users.length > USERS_MAX) chat.users.splice(0, chat.users.length - USERS_MAX);
    await this.ctx.storage.put('chat', chat);
  }

  // 시간이 지난 ttl 칸을 지운다.
  purgeExpired(now = Date.now()) {
    const gone = this.sql.exec('DELETE FROM cells WHERE exp IS NOT NULL AND exp <= ? RETURNING k', now).toArray().length;
    if (gone) this.add('total', -gone);
  }

  count(key) {
    return this.sql.exec('SELECT n FROM counts WHERE key = ?', key).toArray()[0]?.n ?? 0;
  }

  add(key, delta) {
    this.sql.exec('INSERT INTO counts (key, n) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET n = MAX(0, n + excluded.n)', key, delta);
  }

  lastHeard(ws, touch = false) { return lastHeard(this.ctx, this.buckets, ws, touch); }

  warn(ws, code, k) { safeSend(ws, JSON.stringify(k === undefined ? { t: 'error', code } : { t: 'error', code, k })); }
}

// 칸 값: JSON 으로 256글자까지, 안의 글자열(칸 이름 포함)은 24글자까지, 모두 거른다. 아니면 던진다.
export function cleanValue(v) {
  if (v === undefined || v === null) bad();
  const text = JSON.stringify(v);
  if (text === undefined || text.length > CELL_VALUE_MAX) bad();
  const out = cleanData(v, s => { if (s.length > CELL_STRING_MAX) bad(); });
  if (JSON.stringify(out).length > CELL_VALUE_MAX) bad();
  return out;
}

// SQLite 줄 → { k, v, owner: { id, nickname }, exp? }
const cellOf = row => {
  const cell = { k: row.k, v: JSON.parse(row.v), owner: { id: row.owner, nickname: row.nick } };
  if (row.exp !== null && row.exp !== undefined) cell.exp = row.exp;
  return cell;
};

// 서로 차단한 사이가 아니면 true (들어올 때 양쪽 연결에 적어 둔 것)
const canSee = (a, b) => !(a.blocked ?? []).includes(b.uid) && !(b.blocked ?? []).includes(a.uid);

function nickOf(request) {
  try { return decodeURIComponent(request.headers.get('X-Net-Nick') ?? '').slice(0, 20); } catch { return ''; }
}
