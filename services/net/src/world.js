// 같이 쓰는 세계(World): 모두가 나가도 남는 칸(cell)을 가진 방. `<게임>:<세계 이름>` 하나에 Durable Object 하나.
// 블록을 놓는 마을처럼, 누가 놓은 것이 계속 남아야 하는 게임이 쓴다. 서버는 게임 내용을 모른다.
// - 칸: 이름(k) → 값(v, 아무 JSON). 칸마다 처음 놓은 사람(주인)만 바꾸거나 지울 수 있다. 이 DO 의 SQLite 에 저장한다.
//   v 안의 글자열은 24글자까지이고 모두 거르개를 거친다 (칸에 글을 숨겨 보내지 못하게). 여러 글자열에 나눠 넣은
//   전화번호나 링크도 찾아서 거절한다.
// - SQLite 쓰기는 무료 요금제에서 모든 게임 합쳐 하루 10만 행이라, 칸 놓기와 지우기는 따로 1초에 4번(몰아서 20번),
//   한 사람이 한 세계에서 하루 2,000번까지다. 값이 그대로인 칸 놓기는 쓰지 않는다.
// - 들어올 때 보내는 칸은 깨어 있는 동안 메모리에 들고 있어서, 여러 사람이 들어와도 SQLite 를 한 번만 읽는다.
//   ttl(초)을 주면 그 시간이 지나면 사라지는 칸이 된다 (부순 나무가 10분 뒤 다시 자라기 같은 것). 사라질 때 서버는 알리지 않고,
//   클라이언트가 exp 를 보고 스스로 지운다.
// - 위치(pose)와 메시지(send)는 저장하지 않고 다른 사람에게 전하기만 한다. 서로 차단한 사이에는 전하지 않는다 (칸은 같이 본다).
//   차단은 들어올 때 D1 에서 확인하고, 같이 있는 동안 차단하거나 풀면 로비가 알려 준다 (blocksChanged).
// - 채팅(data.chat)은 방(Room)과 같은 거르개, 같은 횟수 제한을 거치고, 신고에 쓰려고 마지막 50줄을 기억한다.
// - 로그인한 사람만 들어온다 (Worker 가 표를 확인하고 X-Net-User, X-Net-Nick, X-Net-World 를 붙여 준다).
//   세계는 wrangler.jsonc 의 WORLD_NAMES 에 적힌 것만 있다 (rooms.js worldOpen).
import { DurableObject } from 'cloudflare:workers';
import {
  PING, PONG, SWEEP_MS, STALE_MS, CHAT_KEEP_MS, safeSend, closeSocket, tooBig, lastHeard, allowMessage, allowChatLine,
  recentLinesOf, pushLine, takeToken,
} from './rooms.js';
import { filterText, maskSplitPhone, cleanData, hasSplitContact, maskSplitContact } from './filter.js';
import * as social from './social.js';

export const WORLD_MAX = 12;           // 한 세계에 같이 있을 수 있는 사람
export const CELL_KEY_RE = /^[A-Za-z0-9|._:-]{1,64}$/;
export const CELL_VALUE_MAX = 256;     // JSON.stringify(v) 글자 수
export const CELL_STRING_MAX = 24;     // v 안의 글자열 하나의 글자 수
export const CELLS_PER_USER = 400;     // 한 사람이 한 세계에 놓을 수 있는 ttl 없는 칸
export const TTL_CELLS_PER_USER = 100; // 한 사람이 한 세계에 놓을 수 있는, 아직 안 사라진 ttl 칸
export const CELLS_PER_WORLD = 20000;  // 한 세계의 칸 (ttl 칸 포함)
export const WRITES_PER_SECOND = 4, WRITE_BURST = 20; // 칸 놓기와 지우기 (한 사람마다, 아니면 'rate')
export const WRITES_PER_DAY = 2000;    // 한 사람이 한 세계에서 하루(UTC)에 칸을 바꾸는 횟수 (아니면 'limit-day')
const DAY_FLUSH = 20;                  // 하루 횟수는 메모리에 모았다가 20번마다 (나갈 때도) 적는다
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
    this.writes = new Map();   // 사용자 번호 → 칸 놓기, 지우기 횟수 통 (다시 들어와도 새로 차지 않게 연결이 아니라 사람마다)
    this.daily = new Map();    // 사용자 번호 → { key, base, pending } 오늘 칸을 바꾼 횟수
    this.snapshot = null;      // 칸 이름 → SQLite 줄. 처음 들어올 때 한 번 읽고, 바꿀 때마다 같이 고친다
    this.joins = Promise.resolve(); // 들어오기와 차단 바꾸기를 하나씩 (D1 을 기다리는 사이 다른 사람이 끼어들지 않게)
    this.sql = ctx.storage.sql;
    // cells: 칸. owner 는 사용자 번호, nick 은 놓을 때의 닉네임, exp 는 사라질 때(ms, 없으면 계속 남음).
    // counts: 다시 세지 않으려고 적어 두는 수. 'total' = cells 의 줄 수, 'u<번호>' = 그 사람의 ttl 없는 칸 수,
    // 't<번호>' = 그 사람의 ttl 칸 수(시간이 지났지만 아직 안 지운 것 포함), 'd<날짜>:<번호>' = 그날 칸을 바꾼 횟수.
    // (COUNT(*) 는 줄을 모두 읽어서 읽기 한도를 빨리 쓴다.)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS cells (k TEXT PRIMARY KEY, v TEXT NOT NULL, owner INTEGER NOT NULL, nick TEXT NOT NULL, updated INTEGER NOT NULL, exp INTEGER);
      CREATE INDEX IF NOT EXISTS cells_exp ON cells (exp) WHERE exp IS NOT NULL;
      CREATE TABLE IF NOT EXISTS counts (key TEXT PRIMARY KEY, n INTEGER NOT NULL);
    `);
  }

  // ---- 들어오기 ----

  async fetch(request) {
    const { response, uid, name } = await this.serial(() => this.join(request));
    // 정지할 때 이 세계의 연결도 끊을 수 있게 로비에 적어 둔다.
    if (uid && name) await social.track(this.env, uid, 'world', name);
    return response;
  }

  // 한 번에 하나씩 (앞의 것이 실패해도 다음 것은 한다)
  serial(fn) {
    const run = this.joins.then(fn);
    this.joins = run.catch(() => {});
    return run;
  }

  async join(request) {
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
      return { response: new Response(null, { status: 101, webSocket: client }) };
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
    // D1 을 기다리는 사이 나간 사람이 있을 수 있어서 다시 본다. 들어오기는 하나씩 하므로 새로 들어온 사람은 없다.
    const present = this.peers().filter(p => p.ws !== seat?.ws);
    for (const p of present) {
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
      peers: present.map(p => ({ id: p.id, user: { id: p.uid, nickname: p.nick } })),
    }));
    // 칸은 500개씩 나눠 보낸다. 하나도 없어도 done 이 붙은 묶음 하나는 꼭 보낸다.
    let list = [];
    for (const row of this.cellsNow(now).values()) {
      if (row.exp !== null && row.exp <= now) continue;
      list.push(cellOf(row));
      if (list.length === CHUNK) { server.send(JSON.stringify({ t: 'cells', list, done: false })); list = []; }
    }
    server.send(JSON.stringify({ t: 'cells', list, done: true }));
    if (!seat) {
      const text = JSON.stringify({ t: 'join', id, user: { id: uid, nickname: nick } });
      for (const p of present) safeSend(p.ws, text);
    }
    // 살펴보기 알람은 없거나 너무 멀 때만 맞춘다 (자주 다시 들어와도 미뤄지지 않게. 10분 뒤 채팅 지우기 알람은 당긴다).
    const at = await this.ctx.storage.getAlarm();
    if (at === null || at > Date.now() + SWEEP_MS) await this.ctx.storage.setAlarm(Date.now() + SWEEP_MS);
    return { response: new Response(null, { status: 101, webSocket: client }), uid, name };
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
    const now = Date.now();
    if (!this.allowWrite(ws, me.uid, k, now)) return;
    const result = this.store(me.uid, me.nick, k, v, ttl ?? null, now);
    if (result.error) return this.warn(ws, result.error, k);
    const text = JSON.stringify({ t: 'cell', ...cellOf(result.row) });
    // 그대로인 칸: 쓰지 않았고 다른 사람은 이미 같은 칸을 갖고 있으니 보낸 사람에게만 돌려준다.
    if (result.unchanged) return safeSend(ws, text);
    this.chargeDay(me.uid, now);
    this.everyone(text);
  }

  // 칸 하나를 놓거나 바꾼다. 결과 { row, unchanged? } 또는 { error: 'taken' | 'limit' | 'world-full' }.
  // SQLite 호출은 기다리지 않고 바로 끝나므로, 사이에 다른 메시지가 끼어들지 않는다.
  // 쓰는 줄: 새 칸은 cells 1줄과 수 2줄(ttl 칸은 exp 색인 1줄 더), 내 칸 바꾸기는 cells 1줄, 그대로면 0줄.
  store(uid, nick, k, v, ttl = null, now = Date.now()) {
    const text = JSON.stringify(v);
    return this.ctx.storage.transactionSync(() => {
      let old = this.row(k);
      // 시간이 지난 칸은 먼저 치운다 (없는 칸으로 친다).
      if (old && old.exp !== null && old.exp <= now) { this.purgeExpired(now); old = this.row(k); }
      if (old && old.owner !== uid) return { error: 'taken' };
      const permanent = ttl === null;
      const exp = permanent ? null : now + ttl * 1000;
      const row = { k, v: text, owner: uid, nick, exp };
      // 값도 닉네임도 그대로인 ttl 없는 칸은 쓰지 않는다. (ttl 칸을 다시 놓는 것은 사라질 때를 미루는 것이라 쓴다.)
      if (old && permanent && old.exp === null && old.v === text && old.nick === nick) return { row, unchanged: true };
      // 한 사람의 칸 수: ttl 없는 칸은 'u<번호>' 400개, ttl 칸은 't<번호>' 100개까지.
      const key = `${permanent ? 'u' : 't'}${uid}`;
      const oldKey = old ? `${old.exp === null ? 'u' : 't'}${uid}` : '';
      if (key !== oldKey) {
        const cap = permanent ? CELLS_PER_USER : TTL_CELLS_PER_USER;
        if (this.count(key) >= cap) {
          this.purgeExpired(now); // 't<번호>' 에는 시간이 지났지만 아직 안 지운 칸도 들어 있다
          if (this.count(key) >= cap) return { error: 'limit' };
        }
      }
      if (!old && this.count('total') >= CELLS_PER_WORLD) {
        this.purgeExpired(now);
        if (this.count('total') >= CELLS_PER_WORLD) return { error: 'world-full' };
      }
      if (key !== oldKey) { if (oldKey) this.add(oldKey, -1); this.add(key, 1); }
      if (old) {
        this.sql.exec('UPDATE cells SET v = ?, nick = ?, updated = ?, exp = ? WHERE k = ?', text, nick, now, exp, k);
      } else {
        this.add('total', 1);
        this.sql.exec('INSERT INTO cells (k, v, owner, nick, updated, exp) VALUES (?, ?, ?, ?, ?, ?)', k, text, uid, nick, now, exp);
      }
      this.snapshot?.set(k, row);
      return { row };
    });
  }

  onDel(ws, me, msg) {
    const { k } = msg;
    if (typeof k !== 'string' || !CELL_KEY_RE.test(k)) return this.warn(ws, 'bad');
    const now = Date.now();
    if (!this.allowWrite(ws, me.uid, k, now)) return;
    const error = this.ctx.storage.transactionSync(() => {
      const old = this.row(k);
      if (!old || (old.exp !== null && old.exp <= now)) return 'missing';
      if (old.owner !== me.uid) return 'not-owner';
      this.sql.exec('DELETE FROM cells WHERE k = ?', k);
      this.add('total', -1);
      this.add(`${old.exp === null ? 'u' : 't'}${old.owner}`, -1);
      return '';
    });
    if (error) return this.warn(ws, error, k);
    this.snapshot?.delete(k);
    this.chargeDay(me.uid, now);
    this.everyone(JSON.stringify({ t: 'cell', k, v: null }));
  }

  // 칸 놓기, 지우기를 해도 되나: 1초에 4번(몰아서 20번)이면 'rate', 오늘 2,000번을 넘으면 'limit-day'.
  allowWrite(ws, uid, k, now = Date.now()) {
    let bucket = this.writes.get(uid);
    if (!bucket) { bucket = { tokens: WRITE_BURST, at: now }; this.writes.set(uid, bucket); }
    if (!takeToken(bucket, WRITES_PER_SECOND, WRITE_BURST, now)) { this.warn(ws, 'rate', k); return false; }
    const day = this.dayOf(uid, now);
    if (day.base + day.pending >= WRITES_PER_DAY) { this.warn(ws, 'limit-day', k); return false; }
    return true;
  }

  // 오늘(UTC) 이 사람이 칸을 바꾼 횟수. 날마다 'd<YYYYMMDD>:<번호>' 줄 하나.
  dayOf(uid, now = Date.now()) {
    const key = `d${new Date(now).toISOString().slice(0, 10).replace(/-/g, '')}:${uid}`;
    let day = this.daily.get(uid);
    if (!day || day.key !== key) {
      if (day) this.flushDay(uid);
      day = { key, base: this.count(key), pending: 0 };
      this.daily.set(uid, day);
    }
    return day;
  }

  chargeDay(uid, now = Date.now()) {
    const day = this.dayOf(uid, now);
    day.pending++;
    if (day.pending >= DAY_FLUSH) this.flushDay(uid);
  }

  // 모아 둔 횟수를 적는다. 잠들었다 깨면 적지 못한 것(20번 아래)은 사라진다.
  flushDay(uid) {
    const day = this.daily.get(uid);
    if (!day?.pending) return;
    this.add(day.key, day.pending);
    day.base += day.pending;
    day.pending = 0;
  }

  // 위치: 저장하지 않고 다른 사람에게 전한다 (512글자까지, 글자열은 거른다).
  onPose(ws, me, msg) {
    if (msg.d === undefined) return this.warn(ws, 'bad');
    let d;
    try {
      d = cleanData(msg.d);
      if (JSON.stringify(d).length > POSE_MAX || hasSplitContact(d)) bad();
    } catch { return this.warn(ws, 'bad'); }
    this.relay(ws, me, JSON.stringify({ t: 'pose', id: me.id, d }));
  }

  // 게임 메시지: 관계자 방(Room 의 members)처럼 data 안의 모든 글자열을 거른다. 사람이 쓴 글은 data.chat 에만.
  // 여러 글자열에 나눠 넣은 전화번호, 링크는 그 부분만 가린다 (칸, 위치와 달리 거절하지 않는다).
  async onSend(ws, me, msg) {
    if (msg.data === undefined) return this.warn(ws, 'bad');
    const raw = msg.data;
    const hasChat = !!raw && typeof raw === 'object' && !Array.isArray(raw) && 'chat' in raw;
    if (hasChat && typeof raw.chat !== 'string') return this.warn(ws, 'bad');
    // 거르기가 실패할 메시지(너무 깊음)는 채팅 횟수를 쓰거나 기록에 남기기 전에 버린다.
    let data;
    try { data = cleanData(raw); } catch { return this.warn(ws, 'bad'); }
    if (hasChat) {
      if (!allowChatLine(this.buckets, ws, (w, code) => this.warn(w, code))) return;
      let { text } = filterText(raw.chat);
      if (!text) return;
      const chat = await this.chat();
      data.chat = maskSplitPhone(recentLinesOf(chat, me.id), text);
      data = maskSplitContact(data);
      await this.ctx.storage.put('chat', pushLine(chat, { from: me.id, uid: me.uid, text: data.chat, at: Date.now() }));
    } else data = maskSplitContact(data);
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
    this.flushDay(me.uid);
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
    this.pruneDays(now);
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

  // 정지된 사람의 연결을 끊는다. 놓은 칸은 그대로 둔다 (지우는 것은 관리 페이지의 purgeUser).
  async kickUser(uid) {
    for (const p of this.peers()) {
      if (p.uid !== uid) continue;
      safeSend(p.ws, JSON.stringify({ t: 'error', code: 'suspended' }));
      await this.departed(p.ws);
      closeSocket(p.ws, 4403, 'suspended');
    }
  }

  // a 와 b 사이 차단이 바뀌었다 (로비가 부른다). 둘 다 지금 있으면 D1 에서 다시 확인해 양쪽 연결에 적는다.
  async blocksChanged(a, b) {
    return this.serial(async () => {
      const here = new Set(this.peers().map(p => p.uid));
      if (!here.has(a) || !here.has(b)) return;
      const blocked = await social.blockedEither(this.env, a, b);
      for (const p of this.peers()) {
        if (p.uid !== a && p.uid !== b) continue;
        const other = p.uid === a ? b : a;
        const att = p.ws.deserializeAttachment();
        const list = (att.blocked ?? []).filter(u => u !== other);
        if (blocked) list.push(other);
        try { p.ws.serializeAttachment({ ...att, blocked: list }); } catch { /* 닫히는 중 */ }
      }
    });
  }

  // ---- 관리 (admin.js 가 부른다) ----

  stats() { return { cells: this.count('total'), peers: this.peers().length }; }

  // 칸을 많이 놓은 사람들 [{ id, lasting, ttl }] (counts 표만 읽는다)
  owners(max = 20) {
    const by = new Map();
    for (const { key, n } of this.sql.exec("SELECT key, n FROM counts WHERE n > 0 AND (key GLOB 'u[0-9]*' OR key GLOB 't[0-9]*')")) {
      const id = Number(key.slice(1));
      const o = by.get(id) ?? { id, lasting: 0, ttl: 0 };
      o[key[0] === 'u' ? 'lasting' : 'ttl'] = n;
      by.set(id, o);
    }
    return [...by.values()].sort((a, b) => b.lasting + b.ttl - a.lasting - a.ttl).slice(0, max);
  }

  // 한 사람이 놓은 칸을 모두 지운다 (장난으로 지은 것 치우기, 정지할 때). cells 를 모두 훑는다 (owner 색인은
  // 칸을 놓을 때마다 쓰기가 늘어서 두지 않았다). 결과 { removed }.
  purgeUser(uid) {
    const keys = this.ctx.storage.transactionSync(() => {
      const rows = this.sql.exec('DELETE FROM cells WHERE owner = ? RETURNING k', uid).toArray();
      if (rows.length) this.add('total', -rows.length);
      this.sql.exec('DELETE FROM counts WHERE key IN (?, ?)', `u${uid}`, `t${uid}`);
      return rows.map(r => r.k);
    });
    this.removed(keys);
    return { removed: keys.length };
  }

  // 세계의 칸을 모두 지운다 (칸 수 기록도. 오늘 바꾼 횟수와 채팅 기록은 남긴다). 결과 { removed }.
  clearCells() {
    const keys = this.ctx.storage.transactionSync(() => {
      const rows = this.sql.exec('DELETE FROM cells RETURNING k').toArray();
      this.sql.exec("DELETE FROM counts WHERE substr(key, 1, 1) IN ('t', 'u')");
      return rows.map(r => r.k);
    });
    this.removed(keys);
    return { removed: keys.length };
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

  // 시간이 지난 ttl 칸을 지운다 (주인마다 't<번호>' 도 줄인다). 지운 수를 돌려준다.
  purgeExpired(now = Date.now()) {
    const rows = this.sql.exec('DELETE FROM cells WHERE exp IS NOT NULL AND exp <= ? RETURNING k, owner', now).toArray();
    if (!rows.length) return 0;
    this.add('total', -rows.length);
    const by = new Map();
    for (const r of rows) { by.set(r.owner, (by.get(r.owner) ?? 0) + 1); this.snapshot?.delete(r.k); }
    for (const [owner, n] of by) this.add(`t${owner}`, -n);
    return rows.length;
  }

  // 지난날의 'd<날짜>:<번호>' 줄을 하루에 한 번 지운다.
  pruneDays(now = Date.now()) {
    const today = `d${new Date(now).toISOString().slice(0, 10).replace(/-/g, '')}`;
    if (this.prunedDay === today) return;
    this.sql.exec("DELETE FROM counts WHERE key >= 'd' AND key < ?", today);
    this.prunedDay = today;
  }

  // 지운 칸을 메모리에서도 빼고 지금 있는 사람들에게 알린다 ({"t":"cell","k","v":null}, 칸마다 하나)
  removed(keys) {
    const peers = this.peers();
    for (const k of keys) {
      this.snapshot?.delete(k);
      const text = JSON.stringify({ t: 'cell', k, v: null });
      for (const p of peers) safeSend(p.ws, text);
    }
  }

  // 지금 있는 칸 (깨어 있는 동안 메모리에 들고 있는다. 처음 한 번만 SQLite 에서 모두 읽는다)
  cellsNow(now = Date.now()) {
    if (!this.snapshot) {
      this.snapshot = new Map();
      for (const r of this.sql.exec('SELECT k, v, owner, nick, exp FROM cells WHERE exp IS NULL OR exp > ?', now)) {
        this.snapshot.set(r.k, { k: r.k, v: r.v, owner: r.owner, nick: r.nick, exp: r.exp });
      }
    }
    return this.snapshot;
  }

  row(k) { return this.sql.exec('SELECT owner, nick, v, exp FROM cells WHERE k = ?', k).toArray()[0]; }

  count(key) {
    return this.sql.exec('SELECT n FROM counts WHERE key = ?', key).toArray()[0]?.n ?? 0;
  }

  add(key, delta) {
    this.sql.exec('INSERT INTO counts (key, n) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET n = MAX(0, n + excluded.n)', key, delta);
  }

  lastHeard(ws, touch = false) { return lastHeard(this.ctx, this.buckets, ws, touch); }

  warn(ws, code, k) { safeSend(ws, JSON.stringify(k === undefined ? { t: 'error', code } : { t: 'error', code, k })); }
}

// 칸 값: JSON 으로 256글자까지, 안의 글자열(칸 이름 포함)은 24글자까지, 모두 거른다.
// 여러 글자열에 나눠 넣은 전화번호나 링크가 있어도 던진다 (→ 'bad').
export function cleanValue(v) {
  if (v === undefined || v === null) bad();
  const text = JSON.stringify(v);
  if (text === undefined || text.length > CELL_VALUE_MAX) bad();
  const out = cleanData(v, s => { if (s.length > CELL_STRING_MAX) bad(); });
  if (JSON.stringify(out).length > CELL_VALUE_MAX || hasSplitContact(out)) bad();
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
