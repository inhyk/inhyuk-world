// 온라인 대전. 모든 게임이 같이 쓰는 서버(services/net)의 방(Room)과 계정(Account, Social)을 쓴다.
// - 게임 찾기(랜덤 매칭, 로그인 필요): 10분 랭크전, 온라인 점수가 바뀐다.
// - 친구 초대(로그인 필요), 방 코드(로그인 없이): 친선전, 점수는 그대로.
// 사람이 쓴 글은 보내지 않는다. 빠른 인사말은 번호(k)만 보낸다.
import { Account, Social, DEFAULT_SERVER } from './net-client/index.mjs';

export const GAME = 'green-chess';
export const MATCH_TIME = 600;
export const TIMES = [0, 60, 180, 300, 600, 900];
export const QUICK = ['안녕! 잘 부탁해', '잘 뒀다!', '앗, 실수했다', '생각 중이야…', '대단해!', '좋은 게임이었어!', '한 판 더 할래?', '고마워!'];
export const LEAVE_WAIT_MS = 30000;
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?\/?$/;

// 주소 뒤 ?net=http://127.0.0.1:8787 은 내 컴퓨터 서버만 받는다 (비밀번호가 남의 서버로 가지 않게)
export function serverFrom(search = '') {
  let q = null;
  try { q = new URLSearchParams(search).get('net'); } catch { /* 기본값 */ }
  return q && LOOPBACK.test(q) ? q.replace(/\/+$/, '') : DEFAULT_SERVER;
}

export function createNet(search = '', storage = globalThis.localStorage) {
  const server = serverFrom(search);
  const suffix = server === DEFAULT_SERVER ? '' : `@${server}`;
  const scoped = {
    getItem: key => { try { return storage.getItem(key + suffix); } catch { return null; } },
    setItem: (key, value) => { try { storage.setItem(key + suffix, value); } catch { /* 저장 공간 */ } },
    removeItem: key => { try { storage.removeItem(key + suffix); } catch { /* 무시 */ } },
  };
  const account = new Account({ server, storage: scoped, fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(10000) }) });
  return { server, account, social: hooks => new Social(account, hooks) };
}

const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const color = v => v === 'w' || v === 'b';

// 상대가 보낸 메시지를 확인한다. 이상하면 null
export function parseMessage(d) {
  if (!d || typeof d !== 'object' || typeof d.t !== 'string') return null;
  switch (d.t) {
    case 'hello': return { t: 'hello', r: int(d.r, 100, 3500) ? d.r : null };
    case 'start': return int(d.n, 1, 1e6) && color(d.you) && TIMES.includes(d.time) ? { t: 'start', n: d.n, you: d.you, time: d.time } : null;
    case 'move': return int(d.n, 1, 1e6) && int(d.ply, 0, 2000) && typeof d.m === 'string' && UCI.test(d.m) && int(d.ms, -600000, 3600000)
      ? { t: 'move', n: d.n, ply: d.ply, m: d.m, ms: d.ms } : null;
    case 'resign': case 'draw': case 'draw-yes': case 'draw-no': case 'timeout': case 'flag': case 'rematch':
      return int(d.n, 1, 1e6) ? { t: d.t, n: d.n } : null;
    case 'say': return int(d.k, 0, QUICK.length - 1) ? { t: 'say', k: d.k } : null;
    default: return null;
  }
}

export const other = c => (c === 'w' ? 'b' : 'w');

// 방 하나에서 여러 판을 둔다. 체스 규칙과 보드는 game.mjs 가 맡고, 여기는 주고받기만 한다.
// events: status(s,msg) peer() start({color,time,n}) move({uci,ply,ms}) end({winner,reason}) offer(kind) say(k) left() back()
export class OnlineMatch {
  constructor(events, { kind = 'code', opponent = null, myRating = 800, time = MATCH_TIME } = {}) {
    this.events = events;
    this.kind = kind;               // match | invite | code
    this.rated = kind === 'match';
    this.opponent = opponent;       // 서버가 준 { id, nickname } (매칭, 초대만)
    this.myRating = myRating;
    this.time = time;
    this.room = null;
    this.peer = '';
    this.peerRating = null;
    this.n = 0;
    this.color = 'w';
    this.playing = false;
    this.over = false;
    this.wantRematch = false;
    this.peerRematch = false;
    this.drawSent = false;
    this.peerDraw = false;
    this.peerGone = false;
    this.leaveTimer = null;
    this.closed = false;
  }

  hooks() {
    return {
      status: (s, message) => { if (!this.closed) this.events.status?.(s, message); },
      // join 은 방에 들어가자마자(아직 room 을 받기 전에) 올 수 있어서 한 박자 늦춘다
      join: id => setTimeout(() => this.peerJoined(id), 0),
      rejoin: id => setTimeout(() => this.peerJoined(id), 0),
      depart: id => { if (id) this.peerLeft(id); },
      message: (data, from) => this.receive(data, from),
      error: code => this.events.error?.(code),
    };
  }

  attach(room, opponent = this.opponent) {
    this.room = room;
    this.opponent = opponent;
    for (const id of room.peers) this.peerJoined(id);
  }

  send(message) { return this.room?.send(message); }

  peerJoined(id) {
    if (this.closed || !this.room) return;
    const back = this.peerGone;
    this.peer = id;
    this.peerGone = false;
    clearTimeout(this.leaveTimer);
    this.send({ t: 'hello', r: this.myRating });
    if (back) this.events.back?.();
    if (this.room.host && !this.playing && this.n === 0) this.startGame(Math.random() < 0.5 ? 'w' : 'b');
  }

  peerLeft() {
    if (this.closed) return;
    this.peerGone = true;
    this.events.left?.();
    if (this.playing) {
      clearTimeout(this.leaveTimer);
      this.leaveTimer = setTimeout(() => { if (this.playing && this.peerGone) this.events.end?.({ winner: this.color, reason: 'abandon' }); }, LEAVE_WAIT_MS);
    }
  }

  // 방장만 판을 시작한다. hostColor: 방장(나)의 색
  startGame(hostColor) {
    const n = this.n + 1;
    this.send({ t: 'start', n, you: other(hostColor), time: this.time });
    this.begin(n, hostColor, this.time);
  }

  begin(n, myColor, time) {
    this.n = n; this.color = myColor; this.time = time;
    this.playing = true; this.over = false;
    this.wantRematch = this.peerRematch = this.drawSent = this.peerDraw = false;
    this.events.start?.({ color: myColor, time, n });
  }

  receive(data) {
    if (this.closed) return;
    const msg = parseMessage(data);
    if (!msg) return;
    const current = msg.n === this.n;
    switch (msg.t) {
      case 'hello': this.peerRating = msg.r; this.events.peer?.(); break;
      case 'start': if (msg.n > this.n || !this.playing) this.begin(msg.n, msg.you, msg.time); break;
      case 'move': if (current && this.playing) this.events.move?.({ uci: msg.m, ply: msg.ply, ms: msg.ms }); break;
      case 'resign': if (current && this.playing) this.events.end?.({ winner: this.color, reason: 'resign' }); break;
      case 'timeout': if (current && this.playing) this.events.end?.({ winner: this.color, reason: 'timeout' }); break;
      case 'flag': if (current && this.playing) this.events.flag?.(); break;
      case 'draw': if (current && this.playing) { this.peerDraw = true; this.events.offer?.('draw'); } break;
      case 'draw-yes': if (current && this.playing && this.drawSent) this.events.end?.({ winner: 'draw', reason: 'agreed' }); break;
      case 'draw-no': if (current) { this.drawSent = false; this.events.offer?.('draw-no'); } break;
      case 'rematch': if (current && this.over) { this.peerRematch = true; this.events.offer?.('rematch'); this.maybeRematch(); } break;
      case 'say': this.events.say?.(msg.k); break;
      default:
    }
  }

  // ---- 내가 보내는 것 ----
  move(uci, ply, ms) { return this.send({ t: 'move', n: this.n, ply, m: uci, ms: Math.round(ms) }); }
  resign() { this.send({ t: 'resign', n: this.n }); }
  timeout() { this.send({ t: 'timeout', n: this.n }); }
  flag() { this.send({ t: 'flag', n: this.n }); }
  offerDraw() { if (this.drawSent) return; this.drawSent = true; this.send({ t: 'draw', n: this.n }); }
  answerDraw(yes) { this.peerDraw = false; this.send({ t: yes ? 'draw-yes' : 'draw-no', n: this.n }); }
  say(k) { this.send({ t: 'say', k }); }
  rematch() {
    if (!this.over || this.peerGone) return;
    this.wantRematch = true;
    this.send({ t: 'rematch', n: this.n });
    this.maybeRematch();
  }
  maybeRematch() {
    if (this.wantRematch && this.peerRematch && this.room?.host) this.startGame(other(this.color));
  }

  // 판이 끝났다 (game.mjs 가 부른다). 매칭, 초대 방이면 서버에 결과를 알린다 (서버가 온라인 승리를 센다)
  finished(winner) {
    if (!this.playing) return;
    this.playing = false; this.over = true;
    clearTimeout(this.leaveTimer);
    if (this.kind !== 'code') this.room?.report(this.n, winner === this.color);
  }

  close() {
    this.closed = true;
    clearTimeout(this.leaveTimer);
    try { this.room?.leave(); } catch { /* 이미 나감 */ }
  }
}
