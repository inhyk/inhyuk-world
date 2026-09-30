// 온라인 대전. 각자 자기 필드를 계산하고, 상대에게는 필드 모습(초당 20번)과
// 방해뿌요·연쇄 시작/끝·쓰러짐만 보낸다. 판정(누가 이겼나)은 방장이 한다.
import { PuyoRoom, normaliseCode } from './room.mjs';
import { W, H, heights } from './core.mjs';
import { emptyTotals } from './match.mjs';

const SEND_EVERY = 3;   // 3프레임마다 (초당 20번)

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
    if (typeof s.c === 'string' && s.c.length === W * H) {
      for (let i = 0; i < W * H; i++) { const v = s.c.charCodeAt(i) - 48; this.cells[i] = v >= 0 && v <= 6 ? v : 0; }
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
    this.falling = Array.isArray(s.fl) ? s.fl.slice(0, 90).map(f => ({ x: n(f[0]), to: n(f[1]), y: n(f[2]), color: n(f[3]) })) : [];
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
});

export function createOnline(api) {
  const { $, toast, sound } = api;
  let peer = null, firstTo = 2, remote = null, clock = 0, last = '', lastRound = 0;
  let wantAgain = false, peerAgain = false, inGame = false;
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
    room.send({ t: 'hello', ...api.me() });
    sound.sfx('coin');
  }
  function depart() {
    const was = peer;
    peer = null; wantAgain = false; peerAgain = false;
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
  }
  function begin(seed, role) {
    wantAgain = false; peerAgain = false; inGame = true; lastRound = 1; clock = 0; last = '';
    api.start({ seed, firstTo, peer, role, makeRemote: seq => (remote = new RemoteView(seq)) });
  }

  function message(m) {
    const match = api.match();
    switch (m.t) {
      case 'hello':
        peer = cleanPeer(m);
        if (!m.re) room.send({ t: 'hello', re: 1, ...api.me() });
        if (room.host) room.send({ t: 'first', n: firstTo });
        lobby();
        toast(`🌐 ${peer.name}와 연결됐어!`);
        break;
      case 'first':
        if (!room.host) { firstTo = Math.max(1, Math.min(5, Number(m.n) | 0)); lobby(); }
        break;
      case 'start':
        if (!room.host && Number.isFinite(m.seed)) { firstTo = Math.max(1, Math.min(5, Number(m.first) | 0)); begin(m.seed >>> 0, 'guest'); }
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
    room.send({ t: 'start', seed, first: firstTo });
    begin(seed, 'host');
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
  $('online-start').onclick = () => {
    if (!room.host || !peer) return;
    sound.sfx('click');
    restart();
  };
  addEventListener('pagehide', () => room.leave());

  return {
    get active() { return room.active; },
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
      if (text !== last) { last = text; room.send(snap); }
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
    peerName: () => peer?.name || '친구',
    leave() { inGame = false; room.leave(); },
    state: () => ({ role: room.role, code: room.code, status: room.status, peer }),
  };
}
