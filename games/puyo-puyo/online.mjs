// 온라인 대전. 방 코드 없이 "게임 찾기"(랜덤 매칭)나 친구 초대로 같은 방(@inhyuk/net Room)에 들어간다.
// 각자 자기 필드를 계산하고, 상대에게는 필드 모습(초당 12번)과 방해 뿌요, 연쇄 시작/끝, 쓰러짐만 보낸다.
// 판정(누가 이겼나)은 방장(먼저 들어온 사람)이 한다.
// - 상대 이름은 서버가 준 opponent.nickname 만 쓴다. 상대가 보낸 글자는 이름으로 쓰지 않는다 (hello 에 이름을 넣지도 않는다).
// - 매칭, 초대 방에서는 서버가 data 안의 모든 글자열을 거르고 숫자 8개 이상을 가린다.
//   그래서 필드 모습은 글자열이 아니라 숫자 배열로 보낸다.
// - 서버는 한 연결에서 1초에 30개(몰아서 60개)까지만 전한다. 필드 모습을 초당 12번으로 줄여 공격 메시지가 버려지지 않게 한다.
// - 직접 쓴 채팅은 room.chat(text) (data.chat) 으로만 보낸다. 빠른 말과 뿌요 이모티콘은 번호만 보낸다
//   ({ t: 'say', quick: n } / { t: 'say', sticker: n }). 번호라서 거를 글자가 없고, 받는 쪽이 정해진 말과 그림으로 바꾼다.
// - 다시 접속(rejoin): 상대 계정이 다른 연결로 다시 들어오면 판을 맞추지 않고 이번 대전을 끝낸다(둘 다 온라인 화면으로).
//   필드를 다시 맞추려면 양쪽 뿌요 순서와 방해 뿌요 수를 모두 다시 보내야 해서, 끝내는 쪽이 간단하고 어긋나지 않는다.
//   내 연결이 끊기거나(lost) 다른 기기에서 같은 계정이 들어오면(replaced) 지금처럼 대전을 끝내고 온라인 화면으로 돌아간다.
// - 관전: 다른 사람이 보기만 하러 들어올 수 있다(서버가 채팅 글은 보내지 않는다). 처음 인사(hello)와 판 수(first)는
//   keep 으로 보내서 나중에 들어온 사람도 받는다. 지금 몇 명이 보는지는 watchers 로 알려 준다.
// - 대전이 끝나면 몇 번째 대전인지(n)와 내가 이겼는지를 서버에 보고한다(report). 두 사람 보고가 같으면 온라인 승리 1개.
// - 맵 투표 (인혁이 기획서 「뿌요뿌요 (업그레이드)」 4번): 두 사람이 하고 싶은 맵에 표를 던진다({ t: 'vote', m: 맵 번호 }).
//   방장이 시작할 때 표가 더 많은 맵(둘이 다르면 둘 중에서 뽑기)을 정해서 start 에 번호(m)로 같이 보낸다.
//   맵 이름은 글자열이라 서버가 거를 수 있어서 번호만 보낸다. 표를 보내지 않는 예전 버전 상대와는 기본 맵(뿌요 정원)으로 한다.
import { clampFirstTo, emptyTotals } from './match.mjs';
import { W, H, heights } from './core.mjs';
import { NET_GAME } from './net.mjs';
import { QUICK, STICKERS, validSticker } from './chat.mjs';
import { MAPS, cleanMapIndex, voteResult } from './maps.mjs';

const SEND_EVERY = 5;        // 5프레임마다 (초당 12번)
export const CHAT_MAX = 60;  // 짧은 말만 (서버는 200글자까지)
const LINES_KEEP = 50;

// 상대 필드: 받은 모습 그대로 그리기만 한다
export class RemoteView {
  constructor(seq) {
    this.seq = seq;
    this.cells = new Uint8Array(W * H);
    this.h = new Int8Array(W);
    this.piece = null; this.state = 'ready'; this.score = 0; this.incoming = 0;
    this.popping = null; this.timer = 0; this.falling = []; this.land = new Map();
    this.chaining = false; this.dead = false; this.events = []; this.nextPairs = [[1, 1], [1, 1]];
    this.stats = emptyTotals();
  }
  get next() { return this.nextPairs; }
  ghost() { return null; }
  apply(s) {
    if (Array.isArray(s.c) && s.c.length === W * H) {
      for (let i = 0; i < W * H; i++) { const v = s.c[i]; this.cells[i] = Number.isInteger(v) && v >= 0 && v <= 6 ? v : 0; }
      heights(this.cells, this.h);
    }
    const n = v => (Number.isFinite(v) ? v : 0);
    this.piece = Array.isArray(s.p) ? { x: n(s.p[0]), y: n(s.p[1]), rot: n(s.p[2]) & 3, a: n(s.p[3]), c: n(s.p[4]) } : null;
    if (this.piece && (this.piece.x < 0 || this.piece.x > 5)) this.piece = null;
    if (Array.isArray(s.n) && s.n.length === 4) this.nextPairs = [[n(s.n[0]), n(s.n[1])], [n(s.n[2]), n(s.n[3])]];
    this.score = Math.max(0, n(s.sc));
    this.incoming = Math.max(0, n(s.in));
    this.state = typeof s.st === 'string' ? s.st.slice(0, 10) : 'control';
    this.timer = n(s.pt);
    this.popping = Array.isArray(s.pop) ? { cells: new Set(s.pop.filter(Number.isInteger)), garbage: Array.isArray(s.pg) ? s.pg.filter(Number.isInteger) : [] } : null;
    this.falling = Array.isArray(s.fl) ? s.fl.slice(0, 90).map(f => ({ x: n(f?.[0]), to: n(f?.[1]), y: n(f?.[2]), color: n(f?.[3]) })) : [];
    this.chaining = !!s.ch;
    this.dead = !!s.d;
    if (this.dead) this.state = 'dead';
    if (s.ms && typeof s.ms === 'object') { this.stats.maxChain = n(s.ms.mc); this.stats.popped = n(s.ms.po); }
  }
}

// 필드 모습. 칸은 숫자 배열로 보낸다 (관계자 방에서 숫자 8개 넘는 글자열은 가려짐).
export function snapshot(p) {
  const r = v => Math.round(v * 100) / 100;
  return {
    t: 's',
    c: Array.from(p.cells),
    p: p.piece && p.state === 'control' ? [p.piece.x, r(p.piece.y), p.piece.rot, p.piece.a, p.piece.c] : 0,
    n: p.next.flat(),
    sc: p.score, in: p.incoming, st: p.state, pt: p.timer,
    pop: p.popping ? [...p.popping.cells] : 0, pg: p.popping ? p.popping.garbage : 0,
    fl: p.falling.length ? p.falling.map(f => [f.x, f.to, r(f.y), f.color]) : 0,
    ch: p.chaining ? 1 : 0, d: p.dead ? 1 : 0,
    ms: { mc: p.stats.maxChain, po: p.stats.popped },
  };
}

// 메시지 안의 글자열(칸 이름 포함)에 숫자가 8개 이상 들어 있는지. 들어 있으면 서버가 가려 버린다 (테스트에서 확인).
export function hasLongDigits(value, depth = 0) {
  if (typeof value === 'string') return (value.match(/\d/g)?.length ?? 0) >= 8;
  if (depth > 8 || !value || typeof value !== 'object') return false;
  return Object.entries(value).some(([k, v]) => hasLongDigits(k) || hasLongDigits(v, depth + 1));
}

// 상대가 보낸 hello: 레벨과 꾸미기만 (이름은 서버가 준 것을 쓴다)
export const cleanPeer = m => ({
  level: Math.max(1, Math.min(99, Number(m?.level) | 0)),
  skin: typeof m?.skin === 'string' ? m.skin.slice(0, 20) : 'classic',
  effect: typeof m?.effect === 'string' ? m.effect.slice(0, 20) : 'sparkle',
});

// 판 이벤트 → 보내는 메시지 (글자열은 종류 이름만)
export function eventMessage(e) {
  if (e.type === 'pop') return { t: 'e', e: { type: 'pop', chain: e.chain, score: e.score, puyos: e.puyos, colors: e.colors, groups: e.groups } };
  return { t: 'e', e: { type: e.type, amount: e.amount || 0, count: e.count || 0 } };
}

// api: $, toast, sound, social() → Social | null, me() → { level, skin, effect }, start({ seed, firstTo, opponent, peer, role, makeRemote }),
//      match() → 지금 판, isFinished() → 결과가 나왔는지, quit() → 판을 접고 온라인 화면으로,
//      render() 온라인 화면 다시 그리기, chatLine(entry) 대화 한 줄({ who, text } 또는 { who, sticker }), chatReset(),
//      vote() → 내가 고른 맵 번호 (저장해 둔 것), start 에는 map(맵 이름)과 tie(뽑기로 정했는지)도 같이 준다
export function createOnline(api) {
  const { toast, sound } = api;
  let room = null, opponent = null, peer = null, firstTo = 2, remote = null, clock = 0, last = '', lastRound = 0;
  let wantAgain = false, peerAgain = false, inGame = false, searching = false, inviting = null, helloPending = false;
  let matchNo = 0, reported = 0, watchers = 0; // 이 방에서 몇 번째 대전인지, 결과를 보고한 대전, 보고 있는 사람 수
  let lines = [], recent = null; // recent: 방금 같이 한 사람 { id, nickname, room } (방을 나간 뒤에도 친구 요청, 신고에 씀)
  let myVote = 0, peerVote = null; // 맵 투표: 내 표, 상대 표(아직 안 왔으면 null)
  const random = api.random || Math.random;

  const hooks = {
    status(state, msg = '') {
      if (state === 'error' && msg && room) { toast(msg); endRoom(); }
    },
    join() { if (room) hello(); else helloPending = true; sound.sfx('coin'); },
    depart(id) {
      if (!id || !room) return; // 내가 나감
      const name = opponent?.nickname || '친구';
      toast(`${name}와 연결이 끊겼어.`);
      endRoom();
    },
    rejoin() {
      if (!room) return;
      toast(`${opponent?.nickname || '친구'}가 다시 접속해서 이번 대전은 끝났어.`);
      endRoom();
    },
    error(code) {
      if (code === 'chat-rate') toast('채팅은 천천히! 1초에 한 줄씩 보낼 수 있어.');
    },
    message(m) { received(m); },
    watchers(n) { watchers = n; api.watchersChanged?.(n); },
  };

  const render = () => api.render?.();

  function hello() {
    helloPending = false;
    room?.send({ t: 'hello', ...api.me() }, { keep: true });
    sendVote();
  }
  function sendVote() { room?.send({ t: 'vote', m: myVote }); }

  function enter(result) {
    searching = false; inviting = null;
    room = result.room;
    opponent = { id: Number(result.opponent?.id) || 0, nickname: String(result.opponent?.nickname || '친구') };
    recent = { ...opponent, room: room.code };
    lines = [];
    peer = null; wantAgain = false; peerAgain = false; firstTo = 2;
    matchNo = 0; reported = 0; watchers = 0;
    myVote = cleanMapIndex(api.vote?.()) ?? 0; peerVote = null;
    api.chatReset?.();
    if (helloPending || room.peers.length) hello();
    sound.sfx('coin');
    render();
  }

  // 방을 나간다. 판이 진행 중이면 접고(결과가 이미 나왔으면 결과 화면은 그대로) 온라인 화면으로.
  function endRoom() {
    const playing = inGame && !api.isFinished();
    const r = room;
    room = null; peer = null; inGame = false; wantAgain = false; peerAgain = false; helloPending = false;
    if (watchers) { watchers = 0; api.watchersChanged?.(0); }
    try { r?.leave(); } catch { /* 이미 닫힘 */ }
    if (playing) api.quit();
    render();
  }

  function begin(seed, role, map = 0, tie = false) {
    wantAgain = false; peerAgain = false; inGame = true; lastRound = 1; clock = 0; last = '';
    matchNo++;
    api.start({ seed, firstTo, opponent, peer: peer || cleanPeer({}), role, map: MAPS[map].id, tie, makeRemote: seq => (remote = new RemoteView(seq)) });
  }

  function line(who, text, sticker) {
    const entry = validSticker(sticker) ? { who, sticker, at: Date.now() } : { who, text: String(text).slice(0, 200), at: Date.now() };
    lines.push(entry);
    if (lines.length > LINES_KEEP) lines.shift();
    api.chatLine?.(entry);
  }

  function received(m) {
    if (!m || typeof m !== 'object') return;
    if (typeof m.chat === 'string') { if (m.chat) line('them', m.chat); return; }
    if (m.t === 'say') {
      if (validSticker(m.sticker)) line('them', '', m.sticker);
      else if (Number.isInteger(m.quick) && QUICK[m.quick]) line('them', QUICK[m.quick]);
      return;
    }
    const match = api.match();
    switch (m.t) {
      case 'hello':
        peer = cleanPeer(m);
        if (!m.re) { room?.send({ t: 'hello', re: 1, ...api.me() }, { keep: true }); sendVote(); }
        if (room?.host) room.send({ t: 'first', n: firstTo }, { keep: true });
        render();
        break;
      case 'vote': {
        const v = cleanMapIndex(m.m);
        if (v !== null) { peerVote = v; render(); }
        break;
      }
      case 'first':
        if (!room?.host) { firstTo = clampFirstTo(m.n); render(); }
        break;
      case 'start':
        if (!room?.host && Number.isFinite(m.seed)) { firstTo = clampFirstTo(m.first); begin(m.seed >>> 0, 'guest', cleanMapIndex(m.m) ?? 0, !!m.tie); }
        break;
      case 'atk':
        if (match && inGame && match.phase === 'play') { const n = Math.max(0, Math.min(2000, Number(m.n) | 0)); match.players[0].receive(n); match.remoteChaining = true; }
        break;
      case 'cs': if (match && inGame) match.remoteChaining = true; break;
      case 'ce': if (match && inGame) match.remoteChaining = false; break;
      case 's': if (remote && inGame) remote.apply(m); break;
      case 'e':
        if (match && inGame && m.e && typeof m.e === 'object') {
          const e = m.e, type = String(e.type);
          if (type === 'pop' && Array.isArray(e.groups) && Array.isArray(e.colors)) match.events.push({ p: 1, type, chain: e.chain | 0, score: e.score | 0, puyos: e.puyos | 0, colors: e.colors.slice(0, 20), groups: e.groups.slice(0, 20).map(g => (Array.isArray(g) ? g.filter(Number.isInteger).slice(0, 72) : [])) });
          else if (type === 'allClear' || type === 'offset' || type === 'garbage') match.events.push({ p: 1, type, amount: e.amount | 0, count: e.count | 0 });
        }
        break;
      case 'dead':
        if (room?.host && match && inGame) match.remoteDead();
        break;
      case 'result':
        if (!room?.host && match && inGame) {
          const winner = m.w === 'guest' ? 0 : m.w === 'host' ? 1 : -1;
          match.applyResult(winner, [Number(m.gw) | 0, Number(m.hw) | 0], !!m.final);
        }
        break;
      case 'next':
        if (!room?.host && match && inGame) match.nextRound();
        break;
      case 'again':
        peerAgain = true;
        if (wantAgain && room?.host) restart();
        else toast(`${opponent?.nickname || '친구'}가 한 판 더 하고 싶대!`);
        break;
      default: break;
    }
  }
  function restart() {
    const seed = (Math.random() * 2 ** 31) >>> 0;
    // 상대 표가 없으면(예전 버전) 맵 규칙을 모르는 것이니 기본 맵으로 한다
    const { map, tie } = peerVote === null ? { map: 0, tie: false } : voteResult([myVote, peerVote], random);
    room.send({ t: 'start', seed, first: firstTo, m: map, tie: tie ? 1 : 0 });
    begin(seed, 'host', map, tie);
  }

  return {
    hooks,
    get active() { return !!room; },
    get searching() { return searching; },
    get inviting() { return inviting; },
    get opponent() { return opponent; },
    get recent() { return recent; },
    get peer() { return peer; },
    get host() { return !!room?.host; },
    get firstTo() { return firstTo; },
    get lines() { return lines.slice(); },
    get inGame() { return inGame; },

    // "게임 찾기": 먼저 기다린 사람과 바로 붙는다
    async find() {
      const social = api.social();
      if (!social || searching || room || inviting) return;
      searching = true; render();
      try {
        const result = await social.findMatch(NET_GAME, hooks, undefined, { onQueued: render });
        if (!result) { searching = false; render(); return; }
        if (!searching) { result.room.leave(); return; } // 그사이 그만 찾기를 누름
        enter(result);
      } catch (error) {
        searching = false; render();
        toast(error.message || '게임을 찾지 못했어. 다시 해 볼래?');
      }
    },
    cancelFind() { searching = false; api.social()?.cancelMatch(); render(); },

    // 친구 초대: 친구가 수락하면 같은 방에 들어간다
    async invite(friend) {
      const social = api.social();
      if (!social || room || inviting || searching) return;
      const mine = inviting = { id: friend.id, nickname: friend.nickname, until: Date.now() + 60000 };
      render();
      try {
        const result = await social.invite(friend.id, NET_GAME, hooks);
        if (inviting !== mine) { result.room.leave(); return; } // 취소한 뒤에 수락됨
        enter(result);
      } catch (error) {
        if (inviting !== mine) return;
        inviting = null; render();
        toast(error.message || '초대하지 못했어.');
      }
    },
    async cancelInvite() {
      if (!inviting) return;
      inviting = null; render();
      try { await api.social()?.cancelInvite(); } catch { /* 이미 끝남 */ }
    },
    async accept(inv) {
      const social = api.social();
      if (!social) return false;
      if (searching) this.cancelFind();
      if (inviting) await this.cancelInvite();
      if (room) endRoom();
      try { enter(await social.acceptInvite(inv.id, hooks)); return true; } catch (error) { toast(error.message || '들어가지 못했어.'); return false; }
    },

    leave() { inGame = false; endRoom(); }, // 부르는 쪽이 판을 접는다 (quitGame)
    start() {
      if (!room?.host || !peer) return;
      restart();
    },
    setFirstTo(n) { firstTo = clampFirstTo(n); if (room?.host) room.send({ t: 'first', n: firstTo }, { keep: true }); },
    // 맵 투표: 내 표를 바꾼다 (방에 있으면 상대에게도 알린다)
    setVote(n) { const v = cleanMapIndex(n); if (v === null) return; myVote = v; sendVote(); render(); },
    // 대전이 끝났다: 내가 이겼는지 서버에 한 번만 알린다 (온라인 승리 세기)
    report(won) {
      if (!room?.ready || !matchNo || reported === matchNo) return false;
      reported = matchNo;
      return room.report(matchNo, !!won);
    },
    get watchers() { return watchers; },

    chat(text) {
      const t = String(text ?? '').trim().slice(0, CHAT_MAX);
      if (!t || !room) return false;
      if (!room.chat(t)) return false;
      line('me', t);
      return true;
    },
    // 빠른 말(quick)과 뿌요 이모티콘(sticker)은 번호만 보낸다
    say({ quick, sticker }) {
      if (!room?.ready) return false;
      if (validSticker(sticker)) { if (!room.send({ t: 'say', sticker })) return false; line('me', '', sticker); return true; }
      if (Number.isInteger(quick) && QUICK[quick]) { if (!room.send({ t: 'say', quick })) return false; line('me', QUICK[quick]); return true; }
      return false;
    },
    get connected() { return !!room?.ready; },
    // 신고할 때 같이 보내는 대화 (서버도 그 방의 거른 채팅을 따로 모은다)
    reportPayload(reason) {
      const who = recent;
      if (!who?.id) return null;
      return { target: who.id, context: { kind: 'room', game: NET_GAME, room: who.room }, reason, messages: lines.map(l => ({ text: `${l.who === 'me' ? '나' : '상대'}: ${validSticker(l.sticker) ? `[뿌요 이모티콘: ${STICKERS[l.sticker].text}]` : l.text}` })) };
    },

    send: m => room?.send(m),
    event(e) { room?.send(eventMessage(e)); },
    tick(match) {
      if (!inGame || !room?.ready) return;
      if (room.host && match.round > lastRound) { lastRound = match.round; room.send({ t: 'next', r: match.round }); }
      if (++clock % SEND_EVERY) return;
      const snap = snapshot(match.players[0]);
      const text = JSON.stringify(snap);
      if (text !== last) { last = text; room.send(snap); }
    },
    roundOver(e, match) {
      if (!room?.host) return;
      const final = match.wins.some(w => w >= match.firstTo);
      room.send({ t: 'result', w: e.winner === 0 ? 'host' : e.winner === 1 ? 'guest' : 'draw', hw: match.wins[0], gw: match.wins[1], final });
    },
    rematch() {
      if (!room?.ready) { toast('친구와 연결이 끊겼어.'); api.quit(); return; }
      wantAgain = true;
      room.send({ t: 'again' });
      if (peerAgain && room.host) restart();
      else toast('친구를 기다리는 중… 친구도 “한 번 더!”를 누르면 시작해.');
    },
    peerName: () => opponent?.nickname || '친구',
    state: () => ({ active: !!room, searching, inviting: inviting?.nickname ?? null, host: !!room?.host, opponent, peer, inGame, firstTo, vote: myVote, peerVote }),
  };
}
