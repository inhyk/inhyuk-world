// 모두의 광장: 로그인하면 방 코드 없이 같은 광장 세계(packages/net/world.mjs 의 World)에 모인다.
// - 세계는 brickverse:plaza-1 ~ plaza-4 (12명씩). 언제나 plaza-1 부터 들어가 보고 꽉 찼으면 다음 번호로 간다.
// - 보내는 것은 방과 같은 hi(별명 번호, 옷, 있는 세계, 펫), 위치(pose), say(정해 둔 말 번호)뿐이다.
//   사람이 쓴 글, 타이쿤 돈 주기, 타워 블록, 미니게임 메시지는 보내지 않고 받아도 버린다.
// - 칸(world.set, world.del)은 브릭 광장의 🧱 모두의 공터 블록만 쓴다 (src/commons.js). 칸 이름 'b|i|j|k', 값은 블록 번호 하나.
//   언제나 ttl(COMMONS.TTL, 7일)을 붙여 놓아서, 모두 나가도 서버에 남다가 놓은 지 7일 뒤 저절로 사라진다 (다시 들어와도
//   늘어나지 않는다). 처음 놓은 사람만 바꾸거나 지운다. 사람이 쓴 글은 칸에 넣지 않는다.
// - 미니게임(타이쿤, 바닥이 사라져요, 하늘 타워, 배틀 로얄, 술래잡기)은 game.net(방)과 game.remotes 만 본다.
//   광장은 그것과 따로 있어서, 광장에만 연결돼 있으면 미니게임은 혼자 하기와 똑같다.
// DOM 도 three.js 도 쓰지 않아서 node 에서도 쓴다 (plaza.test.mjs, plaza-check.mjs).
import { World } from '../../../packages/net/world.mjs';
import { GAME, PHRASES, COMMONS, COMMONS_DAYS } from '../core.mjs';

export const PLAZA_WORLDS = ['plaza-1', 'plaza-2', 'plaza-3', 'plaza-4'];
export const PLAZA_AWAY_MS = 5 * 60 * 1000; // 탭이 이만큼 가려져 있으면 광장에서 나간다 (12자리를 아끼려고)
export const PLAZA_SHOWN = [0, 1];          // 광장 사람이 보이는 세계: 브릭 광장, 무지개 점프 탑
const RETRY_FIRST = 3000, RETRY_FULL = 30000, RETRY_MAX = 120000, RETRY_JOIN_RATE = 65000;
// 다시 해 보지 않는 까닭. 서버가 아직 광장을 모르면(배포 전) 다음에 다시 로그인하거나 새로 열 때까지 혼자 한다.
const STOP = new Set(['replaced', 'suspended', 'login-required', 'no-world', 'not-deployed']);

export const PLAZA_TEXT = {
  loggedOut: '로그인하면 방 코드 없이도 모두의 광장에서 다른 사람을 만나.',
  off: '방에 있는 동안은 모두의 광장에서 나와 있어.',
  connecting: '모두의 광장에 들어가는 중…',
  connected: n => `🌍 모두의 광장 ${n}에 있어. 브릭 광장과 점프 탑에서 다른 사람이 보여.`,
  hello: (n, count) => `🌍 모두의 광장 ${n}에 왔어! ${count > 0 ? `${count}명이 같이 있어` : '아직 나 혼자야'}`,
  lost: '광장과 연결이 끊겼어. 조금 뒤에 다시 들어갈게.',
  'all-full': '모두의 광장이 다 꽉 찼어. 혼자 놀다가 자리가 나면 들어갈게.',
  network: '인터넷이 안 돼서 지금은 혼자 놀아. 조금 뒤에 다시 해 볼게.',
  'not-deployed': '모두의 광장은 아직 준비 중이야. 지금은 혼자 놀아.',
  'no-world': '모두의 광장은 아직 준비 중이야. 지금은 혼자 놀아.',
  'join-rate': '너무 자주 들어왔어. 1분 뒤에 다시 들어갈게.',
  replaced: '다른 기기에서 광장에 들어가서 여기서는 혼자 놀아.',
  suspended: '이 계정은 정지돼서 광장에 못 들어가.',
  'login-required': '다시 로그인하면 광장에 들어갈 수 있어.',
};
// 아이에게 알림으로 한 번 보여 주는 까닭 (나머지는 친구 화면의 글로만 보인다)
const NOTICE = new Set(['all-full', 'replaced', 'suspended']);
const NO_CELLS = new Map();

// 🧱 모두의 공터에서 아이에게 한 줄로 알리는 말. 서버 오류(taken, not-owner, limit ...)와 놓기 전에 막는 까닭.
export const COMMONS_TEXT = {
  taken: '다른 친구가 먼저 놓았어',
  'not-owner': '다른 친구가 놓은 블록은 못 부숴',
  limit: `내 블록은 ${COMMONS.LIMIT}개까지야. 내 블록을 부수고 다시 놓아 봐`,
  expiry: `블록은 ${COMMONS_DAYS}일 뒤에 사라져`,
  'world-full': '광장에 블록이 꽉 찼어. 내 블록을 부수면 다시 놓을 수 있어',
  rate: '너무 빨라! 천천히 놓아 봐',
  'limit-day': '오늘은 블록을 너무 많이 바꿨어. 내일 또 놓자',
  bad: '그 블록은 못 놓아',
  loggedOut: '로그인하면 여기에 같이 블록을 놓을 수 있어',
  room: '방에 있는 동안은 공터에 블록을 못 놓아. 방에서 나오면 돼',
  waiting: '모두의 광장에 들어가면 여기에 블록을 놓을 수 있어',
  outside: '공터(주황 테두리) 안에만 놓을 수 있어',
  top: `${COMMONS.TOP + 1}층이 끝이야!`,
  exists: '이미 블록이 있어',
  far: '너무 멀어! 가까이 가서 놓아',
  self: '내 자리에는 못 놓아',
};
// 칸 놓기, 지우기에서 온 서버 오류 중 공터가 받는 것 (missing 은 이미 없어진 칸이라 알리지 않는다)
const CELL_ERRORS = new Set(['taken', 'not-owner', 'missing', 'limit', 'world-full', 'rate', 'limit-day', 'bad']);
export const commonsError = code => (code === 'missing' ? '' : COMMONS_TEXT[code] ?? '');

// 같은 알림이 연달아 쏟아지지 않게: 같은 글은 ms 안에 한 번만 true.
export function quietNotice(ms) {
  let last = '', at = -Infinity;
  return (text, now) => {
    if (!text || (text === last && now - at < ms)) return false;
    last = text; at = now;
    return true;
  };
}

// 다음에 들어가 볼 광장 번호 (0부터). 더 없으면 -1.
export function nextPlaza(index) { return index + 1 < PLAZA_WORLDS.length ? index + 1 : -1; }

// 실패한 까닭(code)과 이제까지 다시 해 본 횟수(attempt)로, 다시 해 볼 때까지 기다릴 ms. 다시 하지 않으면 null.
// 서버는 한 사람이 1분에 20번 넘게 들어오면 막는다(join-rate). 한 번에 광장 4개까지 들어가 보므로 간격을 늘린다.
export function retryDelay(code, attempt = 0) {
  if (STOP.has(code)) return null;
  if (code === 'join-rate') return RETRY_JOIN_RATE;
  const base = code === 'all-full' ? RETRY_FULL : RETRY_FIRST;
  return Math.min(RETRY_MAX, base * 2 ** Math.max(0, attempt | 0));
}

// 광장에서 만난 사람이 지금 내 화면에 보이나: 같은 세계에 있고 그 세계가 브릭 광장이나 점프 탑일 때만.
export function plazaShows(myWorld, theirWorld) { return myWorld === theirWorld && PLAZA_SHOWN.includes(myWorld); }

// 방으로 보내는 hi 에서 광장으로 보낼 것만 (타이쿤 물건 목록 o 는 뺀다)
export function plazaHi(hi) {
  const out = { t: 'hi', v: hi.v, n: hi.n, l: hi.l, w: hi.w };
  if (hi.pt) out.pt = hi.pt;
  return out;
}
export function plazaSay(i) { return { t: 'say', i }; }

// 광장에서 받은 메시지 중 쓰는 것만 돌려준다 (hi, say). 나머지(gift, tw, ty, br, sv, tg, 채팅 ...)는 null.
export function acceptPlaza(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (data.t === 'hi') {
    if (!Array.isArray(data.n) || !Array.isArray(data.l)) return null;
    return plazaHi(data);
  }
  if (data.t === 'say') return Number.isInteger(data.i) && data.i >= 0 && data.i < PHRASES.length ? plazaSay(data.i) : null;
  return null;
}

export class Plaza {
  // hooks
  //   status(state, text)  off | connecting | connected | waiting(다시 해 볼 때를 기다림) | stopped
  //   opened({ again })    광장에 들어왔다 (again: 끊겼다가 다시 들어옴)
  //   join(id)             다른 사람이 들어옴 (들어온 뒤에만. 이미 있던 사람은 opened 뒤 hi 로 알게 된다)
  //   leave(id)            다른 사람이 나감
  //   reset()              광장에서 나왔다 (광장에서 만난 사람을 모두 지운다)
  //   pose(id, d)          다른 사람의 위치 (방의 'p' 와 같은 숫자 배열)
  //   message(data, from)  acceptPlaza 를 지난 메시지 (hi, say)
  //   notice(text)         아이에게 한 줄로 알릴 것
  //   cell(k, entry | null) 들어온 뒤에 칸이 생기거나 바뀌거나 없어짐 (들어올 때 받은 칸은 opened 뒤 plaza.cells 로 본다).
  //                         7일이 지나 사라지는 칸도 World 가 1초마다 null 로 알려 준다.
  //   cellError(code, k)   칸 놓기, 지우기가 거절됨 (taken, not-owner, missing, limit, world-full, rate, limit-day, bad)
  // options: ticket() → 한 번짜리 표 (account.ticket()), server, connect, fetch,
  //          World(시험용 가짜), timers({ setTimeout, clearTimeout }, 시험용)
  constructor(hooks = {}, options = {}) {
    this.hooks = hooks; this.options = options;
    this.timers = options.timers ?? globalThis;
    this.wanted = false; this.world = null; this.joined = false; this.everJoined = false;
    this.index = -1; this.attempt = 0; this.timer = null; this.gen = 0; this.lastCode = '';
    this.state = 'off'; this.statusText = PLAZA_TEXT.off; this.code = '';
  }
  get live() { return this.joined && !!this.world?.id; }
  get id() { return this.live ? this.world.id : ''; }
  get name() { return this.live ? PLAZA_WORLDS[this.index] : ''; }
  get number() { return this.live ? this.index + 1 : 0; }
  get count() { return this.live ? this.world.peers.size : 0; }
  // 받은 칸 (칸 이름 → { v, owner: { id, nickname }, exp? }). 광장에 없으면 빈 Map
  get cells() { return this.live ? this.world.cells : NO_CELLS; }
  // 내 계정 번호 (칸 주인과 견준다). 광장에 없으면 null
  get userId() { return this.live ? this.world.user?.id ?? null : null; }

  setState(state, text) { this.state = state; this.statusText = text; this.hooks.status?.(state, text); }

  // 광장에 있고 싶은가. 게임이 로그인, 방, 탭 상태가 바뀔 때마다 부른다. 바뀌었을 때만 무언가 한다.
  want(on) {
    on = !!on;
    if (on === this.wanted) return;
    this.wanted = on;
    if (on) { this.attempt = 0; this.everJoined = false; this.join(); } else this.leave();
  }

  async join() {
    this.clearTimer();
    this.drop();
    const gen = ++this.gen;
    this.code = '';
    this.setState('connecting', PLAZA_TEXT.connecting);
    for (let i = 0; i >= 0; i = nextPlaza(i)) {
      let ticket;
      try { ticket = await this.options.ticket(); } catch (error) {
        if (gen !== this.gen) return;
        const code = error?.code === 'suspended' ? 'suspended' : error?.code === 'login-required' || error?.status === 401 ? 'login-required' : 'network';
        this.failed(code);
        return;
      }
      if (gen !== this.gen) return;
      const world = this.makeWorld(i);
      this.world = world; this.index = i;
      try { await world.open(ticket); } catch (error) {
        if (gen !== this.gen) return;
        this.world = null;
        if (error?.code === 'full') continue;
        this.failed(error?.code ?? 'network');
        return;
      }
      if (gen !== this.gen || this.world !== world) return; // 그 사이 나왔다
      if (!world.id) { this.world = null; this.failed('lost'); return; }
      const again = this.everJoined;
      this.joined = true; this.everJoined = true; this.attempt = 0;
      this.setState('connected', PLAZA_TEXT.connected(i + 1));
      this.hooks.opened?.({ again });
      return;
    }
    if (gen === this.gen) this.failed('all-full');
  }

  makeWorld(index) {
    const Ctor = this.options.World ?? World;
    const mine = () => this.world === world;
    const world = new Ctor({
      status: s => { if (mine() && this.joined && (s === 'offline' || s === 'error')) this.lost(); },
      error: (code, k) => {
        if (!mine()) return;
        if (code === 'replaced' || code === 'suspended') this.lastCode = code;
        else if (this.joined && CELL_ERRORS.has(code)) this.hooks.cellError?.(code, k);
      },
      cell: (k, entry) => { if (mine() && this.joined) this.hooks.cell?.(k, entry); },
      join: id => { if (mine() && this.joined) this.hooks.join?.(id); },
      leave: id => { if (mine() && this.joined) this.hooks.leave?.(id); },
      pose: (id, d) => { if (mine()) this.hooks.pose?.(id, d); },
      message: (data, from) => {
        if (!mine()) return;
        const msg = acceptPlaza(data);
        if (msg) this.hooks.message?.(msg, from);
      },
    }, { game: GAME, world: PLAZA_WORLDS[index], server: this.options.server, connect: this.options.connect, fetch: this.options.fetch });
    return world;
  }

  // 들어와 있다가 끊겼다 (인터넷, 서버, 다른 기기에서 들어감, 정지)
  lost() {
    const code = this.lastCode || 'lost';
    this.lastCode = '';
    this.joined = false; this.world = null;
    this.hooks.reset?.();
    this.failed(code);
  }

  failed(code) {
    if (!this.wanted) return;
    this.code = code;
    const delay = retryDelay(code, this.attempt);
    const text = PLAZA_TEXT[code] ?? PLAZA_TEXT.network;
    if (NOTICE.has(code) && (code !== 'all-full' || this.attempt === 0)) this.hooks.notice?.(text);
    if (delay === null) { this.setState('stopped', text); return; }
    this.attempt++;
    this.setState('waiting', text);
    this.timer = this.timers.setTimeout(() => { this.timer = null; if (this.wanted) this.join(); }, delay);
  }

  clearTimer() { if (this.timer !== null) { this.timers.clearTimeout(this.timer); this.timer = null; } }

  // 지금 세계에서 나온다 (조용히)
  drop() {
    const world = this.world, was = this.joined;
    this.world = null; this.joined = false;
    world?.close();
    if (was) this.hooks.reset?.();
  }

  leave() {
    this.gen++;
    this.clearTimer();
    this.drop();
    this.code = '';
    this.setState('off', PLAZA_TEXT.off);
  }

  // 보내기 (들어와 있을 때만). 위치는 World 가 1초에 15번으로 줄인다.
  pose(d) { return this.live && this.world.pose(d); }
  send(data) { return this.live && this.world.send(data); }
  sendTo(id, data) { return this.live && this.world.sendTo(id, data); }
  // 칸 놓기, 지우기. 결과는 cell 이나 cellError 로 돌아온다 (내가 놓은 것도 서버를 거쳐서 온다)
  // 놓는 칸은 언제나 COMMONS.TTL 뒤에 사라진다. 한도를 넓히기 전의 서버는 3600초 넘는 ttl 을 bad 로 거절한다
  // (공터는 한 줄 알림만 띄운다). 그래서 서버를 먼저 다시 배포한다.
  setCell(k, v) { return this.live && this.world.set(k, v, { ttl: COMMONS.TTL }); }
  delCell(k) { return this.live && this.world.del(k); }
}
