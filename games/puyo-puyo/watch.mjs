// 관전 (인혁이 기획서 4번 그림): 다른 사람의 온라인 대전을 보기만 한다.
// 그림대로 두 필드를 나란히 두고 위에 닉네임과 레벨, 아래에 점수를 그린다 (그리기는 render.mjs 의 watch 배치).
// 서버(@inhyuk/net)의 관전 자리로 들어가서 두 사람이 서로에게 보내는 필드 모습(초당 12번), 터짐, 판 결과를 그대로 받는다.
// - 왼쪽은 방장, 오른쪽은 손님. Match 를 손님처럼(online: 'guest') 돌려서 판정은 방장이 보낸 결과(result)만 따른다.
// - 이름은 서버가 준 닉네임(관전 목록)만 쓴다. 자리(p1, p2)가 누구인지는 서버가 welcome/join 의 users 로 알려 준다.
// - 채팅 글은 서버가 보내지 않는다. 빠른 말, 뿌요 이모티콘(say)도 화면에 띄우지 않는다.
import { Match, clampFirstTo } from './match.mjs';
import { RemoteView, cleanPeer } from './online.mjs';
import { NET_GAME } from './net.mjs';

// 받은 터짐 같은 판 이벤트를 화면 이벤트로 (online.mjs 의 상대 이벤트와 같은 모양)
export function watchEvent(m, side) {
  const e = m?.e;
  if (!e || typeof e !== 'object') return null;
  const type = String(e.type);
  if (type === 'pop' && Array.isArray(e.groups) && Array.isArray(e.colors)) {
    return { p: side, type, chain: e.chain | 0, score: e.score | 0, puyos: e.puyos | 0, colors: e.colors.slice(0, 20), groups: e.groups.slice(0, 20).map(g => (Array.isArray(g) ? g.filter(Number.isInteger).slice(0, 72) : [])) };
  }
  if (type === 'allClear' || type === 'offset' || type === 'garbage') return { p: side, type, amount: e.amount | 0, count: e.count | 0 };
  return null;
}

export const newWatchMatch = firstTo => new Match({
  seed: 1, specs: [{ kind: 'remote' }, { kind: 'remote' }], firstTo, online: 'guest', makeRemote: seq => new RemoteView(seq),
});

// api: social() → Social | null, begin({ match, names, levels }) 화면 시작, restart(match) 새 대전이 시작됨,
//      peer(side, { level, skin, effect }) 꾸미기가 왔다, ended(text) 관전이 끝났다(대전이 끝남, 연결 끊김)
export function createWatch(api) {
  let room = null, match = null, entry = null, hostSeat = '', firstTo = 2, seen = false;
  let early = []; // 들어가자마자(화면을 준비하기 전에) 온 메시지 (남겨 둔 처음 인사 같은 것)

  const nameOf = seat => {
    const uid = room?.users?.[seat];
    return entry?.players?.find(p => p.id === uid) ?? null;
  };
  const sideOf = from => (from === hostSeat ? 0 : 1);

  const hooks = {
    status(state, msg = '') {
      if (state === 'error' && room) { const text = msg || '대전이 끝났어.'; stop(); api.ended(text); }
    },
    depart(id) {
      if (!id || !room) return;
      const who = nameOf(id)?.nickname || '한 사람';
      stop();
      api.ended(`${who}이(가) 나가서 대전이 끝났어.`);
    },
    message(m, from) { if (room) received(m, from); else if (entry && early.length < 20) early.push([m, from]); },
  };

  function received(m, from) {
    if (!m || typeof m !== 'object' || !match) return;
    const side = sideOf(from), host = side === 0;
    switch (m.t) {
      case 's': match.players[side]?.apply?.(m); seen = true; break;
      case 'e': { const ev = watchEvent(m, side); if (ev) match.events.push(ev); break; }
      case 'hello': api.peer(side, cleanPeer(m)); break;
      case 'first': if (host) { firstTo = clampFirstTo(m.n); match.firstTo = firstTo; } break;
      case 'start':
        if (host && Number.isFinite(m.seed)) {
          firstTo = clampFirstTo(m.first);
          match = newWatchMatch(firstTo);
          api.restart(match);
        }
        break;
      case 'result':
        if (host && match.phase !== 'over') {
          const winner = m.w === 'host' ? 0 : m.w === 'guest' ? 1 : -1;
          match.applyResult(winner, [Math.max(0, Number(m.hw) | 0), Math.max(0, Number(m.gw) | 0)], !!m.final);
        }
        break;
      case 'next': if (host) match.nextRound(); break;
      default: break;
    }
  }

  function stop() {
    const r = room;
    room = null; match = null; entry = null; seen = false; early = [];
    try { r?.leave(); } catch { /* 이미 닫힘 */ }
  }

  return {
    get active() { return !!room; },
    get match() { return match; },
    get entry() { return entry; },
    // 대전 화면의 필드 모습을 한 번이라도 받았나 (대전과 대전 사이면 아직 없다)
    get seen() { return seen; },
    // entry: 관전 목록의 한 줄 { code, players: [{ id, nickname, level }, ...] }
    async start(item) {
      const social = api.social();
      if (!social || room) return false;
      entry = item; early = [];
      let opened;
      try {
        opened = await social.watch(NET_GAME, item.code, hooks);
      } catch (error) {
        entry = null;
        throw error;
      }
      if (entry !== item) { opened.leave(); early = []; return false; } // 그사이 그만둠
      room = opened;
      hostSeat = room.hostId;
      firstTo = 2;
      match = newWatchMatch(firstTo);
      // 들어온 때는 판 한가운데일 수 있어서 3, 2, 1 없이 바로 보여 준다
      match.phase = 'play'; match.timer = 0;
      const seats = [hostSeat, room.peers.find(id => id !== hostSeat) ?? ''];
      const people = seats.map(seat => nameOf(seat));
      api.begin({
        match,
        names: people.map((p, i) => p?.nickname ?? item.players?.[i]?.nickname ?? '?'),
        levels: people.map((p, i) => p?.level ?? item.players?.[i]?.level ?? 1),
      });
      for (const [m, from] of early.splice(0)) received(m, from);
      return true;
    },
    stop,
  };
}
