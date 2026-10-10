// 방 코드 온라인 대전 (PeerJS). 이 기기 계정(온라인 계정으로 옮기지 않은 계정)과 손님이 쓴다.
// 온라인 계정은 online.mjs(net 서버의 게임 찾기, 친구 초대)를 쓴다. 예전 버전 게임과 같이 할 수 있게 주고받는 모양은 바꾸지 않는다.
// 각자 자기 필드를 계산하고, 상대에게는 필드 모습(초당 20번)과
// 방해뿌요·연쇄 시작/끝·쓰러짐만 보낸다. 판정(누가 이겼나)은 방장이 한다.
// 맵 투표(online.mjs 와 같은 모양): 서로 { t: 'vote', m: 맵 번호 } 를 보내고, 방장이 정한 맵 번호를 start 의 m 에 싣는다.
// 예전 버전 게임은 vote 를 보내지도 읽지도 않으므로, 상대 표가 없으면 기본 맵(뿌요 정원 = 예전 규칙)으로 한다.
import { PuyoRoom, normaliseCode } from './room.mjs';
import { clampFirstTo } from './match.mjs';
import { QUICK, cleanChat, rateLimiter, validSticker } from './chat.mjs';
import { W, H, heights } from './core.mjs';
import { emptyTotals } from './match.mjs';
import { MAPS, cleanMapIndex, voteResult } from './maps.mjs';
import { cleanFighter } from './fighters.mjs';
import { setPiece, setFalling, tickView } from './remote-smooth.mjs';

const SEND_EVERY = 3;   // 3프레임마다 (초당 20번)

// 상대 필드: 받은 모습 그대로 그리기만 한다
export class RemoteView {
  constructor(seq) {
    this.seq = seq;
    this.cells = new Uint8Array(W * H);
    this.h = new Int8Array(W);
    this.piece = null; this.state = 'ready'; this.score = 0; this.incoming = 0;
    this.popping = null; this.timer = 0; this.falling = []; this.land = new Map(); this.pace = null;
    this.chaining = false; this.dead = false; this.events = []; this.nextPairs = [[1, 1], [1, 1]];
    this.stats = emptyTotals();
  }
  get next() { return this.nextPairs; }
  ghost() { return null; }
  // 매 프레임: 받은 모습 사이를 이어서 움직인다 (match.mjs 가 부른다)
  tick() { tickView(this); }
  apply(s) {
    if (typeof s.c === 'string' && s.c.length === W * H) {
      for (let i = 0; i < W * H; i++) { const v = s.c.charCodeAt(i) - 48; this.cells[i] = v >= 0 && v <= 6 ? v : 0; }
      heights(this.cells, this.h);
    }
    const n = v => (Number.isFinite(v) ? v : 0);
    let piece = Array.isArray(s.p) ? { x: n(s.p[0]), y: n(s.p[1]), rot: n(s.p[2]) & 3, a: n(s.p[3]), c: n(s.p[4]) } : null;
    if (piece && (piece.x < 0 || piece.x > 5)) piece = null;
    setPiece(this, piece, s.f); // 같은 짝이면 자리만 고쳐서 부드럽게 잇는다 (remote-smooth.mjs)
    if (Array.isArray(s.n) && s.n.length === 4) this.nextPairs = [[n(s.n[0]), n(s.n[1])], [n(s.n[2]), n(s.n[3])]];
    this.score = Math.max(0, n(s.sc));
    this.incoming = Math.max(0, n(s.in));
    const wasPop = this.state === 'pop';
    this.state = typeof s.st === 'string' ? s.st.slice(0, 10) : 'control';
    this.timer = wasPop && this.state === 'pop' ? Math.min(this.timer, n(s.pt)) : n(s.pt); // 반짝임이 뒤로 돌아가지 않게
    this.popping = Array.isArray(s.pop) ? { cells: new Set(s.pop.filter(Number.isInteger)), garbage: Array.isArray(s.pg) ? s.pg.filter(Number.isInteger) : [] } : null;
    setFalling(this, Array.isArray(s.fl) ? s.fl.slice(0, 90).map(f => ({ x: n(f?.[0]), to: n(f?.[1]), y: n(f?.[2]), color: n(f?.[3]) })) : []);
    this.chaining = !!s.ch;
    this.dead = !!s.d;
    if (this.dead) this.state = 'dead';
    if (s.ms && typeof s.ms === 'object') { this.stats.maxChain = n(s.ms.mc); this.stats.popped = n(s.ms.po); }
  }
}

function snapshot(p) {
  const r = v => Math.round(v * 100) / 100;
  return {
    t: 's',
    c: Array.from(p.cells, v => String.fromCharCode(48 + v)).join(''),
    p: p.piece && p.state === 'control' ? [p.piece.x, r(p.piece.y), p.piece.rot, p.piece.a, p.piece.c] : 0,
    n: p.next.flat(),
    sc: p.score, in: p.incoming, st: p.state, pt: p.timer,
    pop: p.popping ? [...p.popping.cells] : 0, pg: p.popping ? p.popping.garbage : 0,
    fl: p.falling.length ? p.falling.map(f => [f.x, f.to, r(f.y), f.color]) : 0,
    ch: p.chaining ? 1 : 0, d: p.dead ? 1 : 0,
    ms: { mc: p.stats.maxChain, po: p.stats.popped },
  };
}

const cleanPeer = m => ({
  name: String(m?.name || '친구').replace(/[<>]/g, '').slice(0, 10),
  level: Math.max(1, Math.min(99, Number(m?.level) | 0)),
  skin: typeof m?.skin === 'string' ? m.skin.slice(0, 20) : 'classic',
  effect: typeof m?.effect === 'string' ? m.effect.slice(0, 20) : 'sparkle',
  char: cleanFighter(m?.ch),
});

export function createPeerOnline(api) {
  const { $, toast, sound } = api;
  let peer = null, firstTo = 2, remote = null, clock = 0, last = '', lastRound = 0;
  let wantAgain = false, peerAgain = false, inGame = false;
  let myVote = 0, peerVote = null; // 맵 투표: 내 표, 상대 표(예전 버전이면 끝까지 null)
  let chatIn = rateLimiter(6, 5000); // 상대가 너무 빨리 보내면 넘친 건 버린다
  const options = import.meta.env?.DEV && new URLSearchParams(location.search).has('localPeer') ? { host: location.hostname, port: 9003, path: '/puyo', secure: false } : {};
  const room = new PuyoRoom({ status, join, depart, message }, options);

  function status(state, msg = '') {
    const label = {
      offline: '각자 기기에서 같은 방 코드로 들어와. 방을 만들면 코드가 나와!',
      connecting: '방에 연결하는 중…',
      waiting: `방 코드 ${room.code} · 친구를 기다리는 중 (1/2)`,
      connected: `방 코드 ${room.code} · 친구가 들어왔어! (2/2)`,
      error: '연결을 확인하고 다시 해 봐.',
    }[state];
    $('online-status').textContent = msg || label;
    $('room-code').textContent = room.code || '------';
    $('room-host').hidden = room.active;
    $('room-join').hidden = room.active;
    $('room-leave').hidden = !room.active;
    $('room-copy').hidden = !room.code || !room.host;
    if (state !== 'connected') { $('online-lobby').hidden = true; }
    if (msg && state === 'error') { toast(msg); if (inGame) api.quit(); inGame = false; }
  }
  function join() {
    chatIn = rateLimiter(6, 5000);
    api.roomJoined?.();
    myVote = cleanMapIndex(api.vote?.()) ?? 0; peerVote = null;
    room.send({ t: 'hello', ...api.me() });
    room.send({ t: 'vote', m: myVote });
    sound.sfx('coin');
  }
  function depart() {
    const was = peer;
    api.roomLeft?.();
    peer = null; wantAgain = false; peerAgain = false; peerVote = null;
    $('online-lobby').hidden = true;
    if (inGame) { toast(`${was?.name || '친구'}와 연결이 끊겼어.`); inGame = false; api.quit(); }
  }
  function lobby() {
    $('online-lobby').hidden = false;
    const me = api.me();
    $('lobby-me').textContent = `${me.name} Lv.${me.level}`;
    $('lobby-you').textContent = peer ? `${peer.name} Lv.${peer.level}` : '…';
    $('online-first-row').hidden = !room.host;
    $('online-start').hidden = !room.host;
    $('online-wait').hidden = room.host;
    if (!room.host) $('online-wait').textContent = `방장이 시작하기를 기다리는 중… (${firstTo}판 먼저 이기면 승리)`;
    api.lobbyChanged?.();
  }
  function begin(seed, role, map = 0, tie = false) {
    wantAgain = false; peerAgain = false; inGame = true; lastRound = 1; clock = 0; last = '';
    api.start({ seed, firstTo, peer, role, map: MAPS[map].id, tie, makeRemote: seq => (remote = new RemoteView(seq)) });
  }

  function message(m) {
    const match = api.match();
    switch (m.t) {
      case 'hello':
        peer = cleanPeer(m);
        if (!m.re) { room.send({ t: 'hello', re: 1, ...api.me() }); room.send({ t: 'vote', m: myVote }); }
        if (room.host) room.send({ t: 'first', n: firstTo });
        lobby();
        toast(`🌐 ${peer.name}와 연결됐어!`);
        break;
      case 'vote': {
        const v = cleanMapIndex(m.m);
        if (v !== null) { peerVote = v; api.lobbyChanged?.(); }
        break;
      }
      // 상대가 로비에서 캐릭터를 바꿈 (online.mjs 와 같은 모양)
      case 'char':
        if (peer) { peer.char = cleanFighter(m.c); api.lobbyChanged?.(); }
        break;
      case 'first':
        if (!room.host) { firstTo = clampFirstTo(m.n); lobby(); }
        break;
      case 'start':
        if (!room.host && Number.isFinite(m.seed)) { firstTo = clampFirstTo(m.first); begin(m.seed >>> 0, 'guest', cleanMapIndex(m.m) ?? 0, !!m.tie); }
        break;
      case 'atk':
        if (match && inGame && match.phase === 'play') { const n = Math.max(0, Math.min(2000, Number(m.n) | 0)); match.players[0].receive(n); match.remoteChaining = true; }
        break;
      case 'cs': if (match) match.remoteChaining = true; break;
      case 'ce': if (match) match.remoteChaining = false; break;
      case 's': if (remote && inGame) remote.apply(m); break;
      case 'e':
        if (match && inGame && m.e && typeof m.e === 'object') {
          const e = m.e, type = String(e.type);
          if (type === 'pop' && Array.isArray(e.groups) && Array.isArray(e.colors)) match.events.push({ p: 1, type, chain: e.chain | 0, score: e.score | 0, puyos: e.puyos | 0, colors: e.colors.slice(0, 20), groups: e.groups.slice(0, 20).map(g => (Array.isArray(g) ? g.filter(Number.isInteger).slice(0, 72) : [])) });
          else if (type === 'allClear' || type === 'offset' || type === 'garbage') match.events.push({ p: 1, type, amount: e.amount | 0, count: e.count | 0 });
        }
        break;
      case 'dead':
        if (room.host && match && inGame) match.remoteDead();
        break;
      case 'result':
        if (!room.host && match && inGame) {
          const winner = m.w === 'guest' ? 0 : m.w === 'host' ? 1 : -1;
          match.applyResult(winner, [Number(m.gw) | 0, Number(m.hw) | 0], !!m.final);
        }
        break;
      case 'next':
        if (!room.host && match && inGame) match.nextRound();
        break;
      case 'chat': {
        // 방 채팅: 빠른 말은 번호로 오고, 직접 쓴 말은 받을 때도 나쁜 말을 다시 가린다
        if (!chatIn()) break;
        if (validSticker(m.st)) { api.roomChat?.({ name: peer?.name || '친구', sticker: m.st }); break; } // 뿌요 이모티콘
        const text = Number.isInteger(m.q) && QUICK[m.q] ? QUICK[m.q] : cleanChat(m.text);
        if (text) api.roomChat?.({ name: peer?.name || '친구', text });
        break;
      }
      case 'again':
        peerAgain = true;
        if (wantAgain && room.host) restart();
        else toast(`${peer?.name || '친구'}가 한 판 더 하고 싶대!`);
        break;
      default: break;
    }
  }
  function restart() {
    const seed = (Math.random() * 2 ** 31) >>> 0;
    const { map, tie } = peerVote === null ? { map: 0, tie: false } : voteResult([myVote, peerVote]);
    room.send({ t: 'start', seed, first: firstTo, m: map, tie: tie ? 1 : 0 });
    begin(seed, 'host', map, tie);
  }

  $('room-host').onclick = async () => { sound.sfx('click'); try { await room.open(); } catch { /* 상태 글자로 알려 줌 */ } };
  $('room-join').onsubmit = async e => {
    e.preventDefault();
    sound.sfx('click');
    try { await room.open($('room-input').value); } catch { /* 상태 글자로 알려 줌 */ }
  };
  $('room-input').oninput = e => { e.target.value = normaliseCode(e.target.value); };
  $('room-leave').onclick = () => { room.leave(); toast('방에서 나왔어.'); };
  $('room-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(room.code); toast('📋 방 코드를 복사했어! 친구에게 알려 줘.'); } catch { toast(`친구에게 방 코드 ${room.code}를 알려 줘.`); }
  };
  addEventListener('pagehide', () => room.leave());

  return {
    get active() { return room.active; },
    // 시작 단추 (main.js 가 계정 종류에 맞는 쪽을 부른다)
    start() { if (room.host && peer) restart(); },
    // 온라인 화면을 다시 그린다 (다른 계정으로 바뀐 뒤 화면에 들어올 때)
    refresh() { status(room.status); if (room.ready && peer) lobby(); },
    send: m => room.send(m),
    event(e) {
      if (e.type === 'pop') room.send({ t: 'e', e: { type: 'pop', chain: e.chain, score: e.score, puyos: e.puyos, colors: e.colors, groups: e.groups } });
      else room.send({ t: 'e', e: { type: e.type, amount: e.amount || 0, count: e.count || 0 } });
    },
    tick(match) {
      if (!inGame || !room.ready) return;
      if (room.host && match.round > lastRound) { lastRound = match.round; room.send({ t: 'next', r: match.round }); }
      if (++clock % SEND_EVERY) return;
      const snap = snapshot(match.players[0]);
      const text = JSON.stringify(snap);
      if (text !== last) { last = text; room.send({ ...snap, f: clock }); } // f: 프레임 번호 (받는 쪽이 내려오는 빠르기를 잰다)
    },
    roundOver(e, match) {
      if (!room.host) return;
      const final = match.wins.some(w => w >= match.firstTo);
      room.send({ t: 'result', w: e.winner === 0 ? 'host' : e.winner === 1 ? 'guest' : 'draw', hw: match.wins[0], gw: match.wins[1], final });
    },
    rematch() {
      if (!room.ready) { toast('친구와 연결이 끊겼어.'); api.quit(); return; }
      wantAgain = true;
      room.send({ t: 'again' });
      if (peerAgain && room.host) restart();
      else toast('친구를 기다리는 중… 친구도 “한 번 더!”를 누르면 시작해.');
    },
    setFirstTo(n) { firstTo = n; if (room.host) room.send({ t: 'first', n }); },
    // 맵 투표: 내 표를 바꾸고 상대에게 알린다
    setVote(n) { const v = cleanMapIndex(n); if (v === null) return; myVote = v; if (room.ready) room.send({ t: 'vote', m: v }); api.lobbyChanged?.(); },
    // 캐릭터 고르기: 바꾼 캐릭터 번호를 상대에게 알린다
    setChar(n) { if (room.ready) room.send({ t: 'char', c: cleanFighter(n) }); api.lobbyChanged?.(); },
    // 방 채팅 보내기: 빠른 말 번호(q), 뿌요 이모티콘 번호(sticker) 또는 직접 쓴 말(text)
    say({ q, text, sticker }) {
      if (!room.ready) return false;
      if (validSticker(sticker)) room.send({ t: 'chat', st: sticker });
      else if (Number.isInteger(q) && QUICK[q]) room.send({ t: 'chat', q });
      else if (text) room.send({ t: 'chat', text: cleanChat(text) });
      else return false;
      return true;
    },
    get connected() { return room.ready; },
    // 친구 초대: 방을 만들어 코드를 돌려주거나, 받은 코드로 들어간다
    async host() { try { await room.open(); } catch { /* 상태 글자로 알려 줌 */ } return room.code; },
    async join(code) { try { await room.open(code); } catch { /* 상태 글자로 알려 줌 */ } return room.active; },
    peerName: () => peer?.name || '친구',
    leave() { inGame = false; room.leave(); },
    state: () => ({ role: room.role, code: room.code, status: room.status, peer, vote: myVote, peerVote }),
  };
}
