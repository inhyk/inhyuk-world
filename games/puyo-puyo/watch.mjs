// 관전 (인혁이 기획서 4번 그림): 다른 사람의 온라인 대전을 보기만 한다.
// 그림대로 두 필드를 나란히 두고 위에 닉네임과 레벨, 아래에 점수를 그린다 (그리기는 render.mjs 의 watch 배치).
// 서버(@inhyuk/net)의 관전 자리로 들어가서 두 사람이 서로에게 보내는 필드 모습(초당 20번), 터짐, 판 결과를 그대로 받는다.
// - 왼쪽은 방장, 오른쪽은 손님. Match 를 손님처럼(online: 'guest') 돌려서 판정은 방장이 보낸 결과(result)만 따른다.
// - 이름은 서버가 준 닉네임(관전 목록)만 쓴다. 자리(p1, p2)가 누구인지는 서버가 welcome/join 의 users 로 알려 준다.
// - 두 사람끼리의 채팅 글은 서버가 보내지 않는다. 빠른 말, 뿌요 이모티콘(say)도 화면에 띄우지 않는다.
// - 관전 채팅과 응원 (인혁이 기획서 「뿌요뿌요 (업그레이드)」 3번): 관전하는 사람은 관전 채팅(chat)과 응원(cheer: 화이팅, 좋아요 …)을
//   보낼 수 있다. 대전하는 두 사람과 같이 보는 사람들이 받는다. 이름은 서버가 붙인 닉네임, 응원은 번호만 오간다.
//   서버가 예전 버전이면 보낼 때 'watch-only' 가 돌아온다 (talkOff 로 알린다).
import { Match, clampFirstTo } from './match.mjs';
import { RemoteView, cleanPeer, CHAT_MAX } from './online.mjs';
import { NET_GAME } from './net.mjs';
import { validCheer } from './chat.mjs';

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
//      peer(side, { level, skin, effect }) 꾸미기가 왔다, ended(text) 관전이 끝났다(대전이 끝남, 연결 끊김),
//      line({ id, name, text } | { id, name, cheer, side }) 다른 관전자의 말과 응원, talkOff() 서버가 아직 관전 채팅을 모른다, slow() 너무 빨리 보냄
export function createWatch(api) {
  let room = null, match = null, entry = null, hostSeat = '', firstTo = 2, seen = false;
  let early = []; // 들어가자마자(화면을 준비하기 전에) 온 메시지 (남겨 둔 처음 인사 같은 것)

  const nameOf = seat => {
    const uid = room?.users?.[seat];
    return entry?.players?.find(p => p.id === uid) ?? null;
  };
  const sideOf = from => (from === hostSeat ? 0 : 1);
  const seatOf = side => (side === 0 ? hostSeat : side === 1 ? room?.peers.find(id => id !== hostSeat) ?? '' : '');

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
    // 같이 보는 다른 사람이 한 말과 응원
    watcherMessage(data, user) {
      if (!room || !user?.id) return;
      const who = { id: user.id, name: String(user.nickname || '관전자').slice(0, 20) };
      if (typeof data.chat === 'string') { if (data.chat) api.line?.({ ...who, text: data.chat.slice(0, 200) }); }
      else if (data.t === 'cheer' && validCheer(data.k) && room.peers.includes(data.to)) api.line?.({ ...who, cheer: data.k, side: sideOf(data.to) });
    },
    error(code) {
      if (!room) return;
      if (code === 'watch-only') api.talkOff?.();
      else if (code === 'chat-rate') api.slow?.();
    },
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
    get code() { return entry?.code ?? ''; },
    // 대전하는 두 사람 (왼쪽, 오른쪽): { id, nickname, level } | null
    players() { return [0, 1].map(side => nameOf(seatOf(side)) ?? entry?.players?.[side] ?? null); },
    // 관전 채팅 한 줄 (서버가 걸러서 두 사람과 다른 관전자에게 보낸다)
    chat(text) {
      const t = String(text ?? '').trim().slice(0, CHAT_MAX);
      return !!(t && room?.chat(t));
    },
    // 응원: side(0 왼쪽, 1 오른쪽) 사람에게 k 번 응원
    cheer(side, k) {
      const seat = seatOf(side);
      return !!(seat && validCheer(k) && room?.cheer(seat, k));
    },
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
