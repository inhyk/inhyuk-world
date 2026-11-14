// 그린 체스 컴퓨터 캐릭터가 쓰는 빠른 엔진.
// chess.js 는 규칙 확인과 화면용이고, 수 읽기는 여기서 0x88 보드로 직접 한다.
// 결과 수는 game.mjs 가 chess.js 로 한 번 더 확인하므로, 여기서 틀린 수가 나와도 판이 망가지지 않는다.

const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6, BLACK = 8;
const VALUE = [0, 100, 320, 335, 500, 920, 0];
const MATE = 100000;
const KNIGHT = [33, 31, 18, 14, -33, -31, -18, -14];
const KING = [1, -1, 16, -16, 15, 17, -15, -17];
const DIAG = [15, 17, -15, -17];
const ORTH = [1, -1, 16, -16];
const PROMOS = [Q, R, B, N];

// 칸 0..127 중 캐슬링 권리를 지우는 칸 (a1 e1 h1 a8 e8 h8)
const CASTLE_MASK = new Uint8Array(128).fill(15);
CASTLE_MASK[0] = 13; CASTLE_MASK[4] = 12; CASTLE_MASK[7] = 14;
CASTLE_MASK[112] = 7; CASTLE_MASK[116] = 3; CASTLE_MASK[119] = 11;

// 위치 점수표: 백 기준, 8번째 줄부터 1번째 줄 순서
const PST = [
  null,
  [0, 0, 0, 0, 0, 0, 0, 0, 60, 60, 60, 60, 60, 60, 60, 60, 20, 20, 28, 36, 36, 28, 20, 20, 8, 8, 14, 26, 26, 14, 8, 8,
    2, 2, 6, 20, 20, 6, 2, 2, 4, -2, -6, 4, 4, -6, -2, 4, 4, 8, 8, -18, -18, 8, 8, 4, 0, 0, 0, 0, 0, 0, 0, 0],
  [-50, -38, -30, -30, -30, -30, -38, -50, -38, -18, 0, 2, 2, 0, -18, -38, -30, 2, 12, 16, 16, 12, 2, -30, -30, 4, 16, 22, 22, 16, 4, -30,
    -30, 2, 16, 22, 22, 16, 2, -30, -30, 4, 12, 14, 14, 12, 4, -30, -38, -18, 2, 4, 4, 2, -18, -38, -50, -36, -30, -30, -30, -30, -36, -50],
  [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 6, 10, 10, 6, 0, -10, -10, 6, 6, 12, 12, 6, 6, -10,
    -10, 0, 12, 12, 12, 12, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 6, 0, 0, 0, 0, 6, -10, -20, -10, -12, -10, -10, -12, -10, -20],
  [0, 0, 0, 0, 0, 0, 0, 0, 6, 12, 12, 12, 12, 12, 12, 6, -4, 0, 0, 0, 0, 0, 0, -4, -4, 0, 0, 0, 0, 0, 0, -4,
    -4, 0, 0, 0, 0, 0, 0, -4, -4, 0, 0, 0, 0, 0, 0, -4, -4, 0, 0, 0, 0, 0, 0, -4, 0, 0, 2, 6, 6, 2, 0, 0],
  [-20, -10, -10, -4, -4, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 4, 4, 4, 4, 0, -10, -4, 0, 4, 6, 6, 4, 0, -4,
    0, 0, 4, 6, 6, 4, 0, -4, -10, 4, 4, 4, 4, 4, 0, -10, -10, 0, 4, 0, 0, 0, 0, -10, -20, -10, -10, -4, -4, -10, -10, -20],
  [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 16, 16, 0, -6, -6, 0, 16, 16, 18, 28, 10, 0, 0, 6, 30, 18],
];
const KING_END = [-50, -36, -28, -20, -20, -28, -36, -50, -30, -18, -6, 0, 0, -6, -18, -30, -28, -6, 18, 28, 28, 18, -6, -28, -28, -6, 28, 38, 38, 28, -6, -28,
  -28, -6, 28, 38, 38, 28, -6, -28, -28, -6, 18, 28, 28, 18, -6, -28, -30, -26, 0, 0, 0, 0, -26, -30, -50, -30, -30, -30, -30, -30, -30, -50];
const PHASE = [0, 0, 1, 1, 2, 4, 0];

const valid = sq => (sq & 0x88) === 0;
export const squareName = sq => 'abcdefgh'[sq & 7] + ((sq >> 4) + 1);
const squareFrom = name => (Number(name[1]) - 1) * 16 + 'abcdefgh'.indexOf(name[0]);
const enc = (from, to, promo, flag) => from | (to << 7) | (promo << 14) | (flag << 17);
const FROM = m => m & 127, TO = m => (m >> 7) & 127, PROMO = m => (m >> 14) & 7, FLAG = m => m >> 17;
const EP = 1, CASTLE = 2, DOUBLE = 4;

export class Position {
  constructor(fen) {
    this.board = new Int8Array(128);
    this.kings = [0, 0];
    this.stack = [];
    this.load(fen);
  }

  load(fen) {
    const [placement, side = 'w', castle = '-', ep = '-', half = '0'] = String(fen).trim().split(/\s+/);
    this.board.fill(0);
    let rank = 7, file = 0;
    for (const ch of placement) {
      if (ch === '/') { rank--; file = 0; continue; }
      if (ch >= '1' && ch <= '8') { file += Number(ch); continue; }
      const lower = ch.toLowerCase(), type = 'pnbrqk'.indexOf(lower) + 1;
      if (!type) continue;
      const sq = rank * 16 + file, color = ch === lower ? BLACK : 0;
      this.board[sq] = type | color;
      if (type === K) this.kings[color ? 1 : 0] = sq;
      file++;
    }
    this.side = side === 'b' ? 1 : 0;
    this.castle = (castle.includes('K') ? 1 : 0) | (castle.includes('Q') ? 2 : 0) | (castle.includes('k') ? 4 : 0) | (castle.includes('q') ? 8 : 0);
    this.ep = ep && ep !== '-' ? squareFrom(ep) : -1;
    this.half = Number(half) || 0;
  }

  // 반복 확인용: 기물 배치, 차례, 캐슬링, 앙파상 (chess.js FEN 앞 네 칸과 같은 뜻)
  key() {
    let out = '';
    for (let rank = 7; rank >= 0; rank--) {
      let empty = 0;
      for (let file = 0; file < 8; file++) {
        const pc = this.board[rank * 16 + file];
        if (!pc) { empty++; continue; }
        if (empty) { out += empty; empty = 0; }
        const ch = '.pnbrqk'[pc & 7];
        out += pc & BLACK ? ch : ch.toUpperCase();
      }
      if (empty) out += empty;
      if (rank) out += '/';
    }
    const c = (this.castle & 1 ? 'K' : '') + (this.castle & 2 ? 'Q' : '') + (this.castle & 4 ? 'k' : '') + (this.castle & 8 ? 'q' : '');
    return `${out} ${this.side ? 'b' : 'w'} ${c || '-'} ${this.ep >= 0 ? squareName(this.ep) : '-'}`;
  }

  attacked(sq, by) {
    const b = this.board, bit = by ? BLACK : 0;
    if (by === 0) {
      if (valid(sq - 15) && b[sq - 15] === P) return true;
      if (valid(sq - 17) && b[sq - 17] === P) return true;
    } else {
      if (valid(sq + 15) && b[sq + 15] === (P | BLACK)) return true;
      if (valid(sq + 17) && b[sq + 17] === (P | BLACK)) return true;
    }
    for (const d of KNIGHT) { const t = sq + d; if (valid(t) && b[t] === (N | bit)) return true; }
    for (const d of KING) { const t = sq + d; if (valid(t) && b[t] === (K | bit)) return true; }
    for (const d of DIAG) {
      for (let t = sq + d; valid(t); t += d) {
        const pc = b[t];
        if (pc) { if (pc === (B | bit) || pc === (Q | bit)) return true; break; }
      }
    }
    for (const d of ORTH) {
      for (let t = sq + d; valid(t); t += d) {
        const pc = b[t];
        if (pc) { if (pc === (R | bit) || pc === (Q | bit)) return true; break; }
      }
    }
    return false;
  }

  inCheck() { return this.attacked(this.kings[this.side], this.side ^ 1); }
  // 방금 수를 둔 쪽의 왕이 공격받고 있으면 그 수는 반칙이다
  leftInCheck() { return this.attacked(this.kings[this.side ^ 1], this.side); }

  moves(capturesOnly = false) {
    const b = this.board, us = this.side, usBit = us ? BLACK : 0, list = [];
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const pc = b[sq];
      if (!pc || (pc & BLACK) !== usBit) continue;
      const type = pc & 7;
      if (type === P) {
        const dir = us ? -16 : 16, startRank = us ? 6 : 1, promoRank = us ? 0 : 7, one = sq + dir;
        if (valid(one) && !b[one]) {
          if ((one >> 4) === promoRank) for (const pr of PROMOS) list.push(enc(sq, one, pr, 0));
          else if (!capturesOnly) {
            list.push(enc(sq, one, 0, 0));
            const two = one + dir;
            if ((sq >> 4) === startRank && !b[two]) list.push(enc(sq, two, 0, DOUBLE));
          }
        }
        for (const d of us ? [-15, -17] : [15, 17]) {
          const t = sq + d;
          if (!valid(t)) continue;
          const target = b[t];
          if (target && (target & BLACK) !== usBit) {
            if ((t >> 4) === promoRank) for (const pr of PROMOS) list.push(enc(sq, t, pr, 0));
            else list.push(enc(sq, t, 0, 0));
          } else if (t === this.ep && !target) list.push(enc(sq, t, 0, EP));
        }
      } else if (type === N || type === K) {
        for (const d of type === N ? KNIGHT : KING) {
          const t = sq + d;
          if (!valid(t)) continue;
          const target = b[t];
          if (!target) { if (!capturesOnly) list.push(enc(sq, t, 0, 0)); } else if ((target & BLACK) !== usBit) list.push(enc(sq, t, 0, 0));
        }
        if (type === K && !capturesOnly) this.castles(sq, list);
      } else {
        const dirs = type === B ? DIAG : type === R ? ORTH : KING;
        for (const d of dirs) {
          for (let t = sq + d; valid(t); t += d) {
            const target = b[t];
            if (!target) { if (!capturesOnly) list.push(enc(sq, t, 0, 0)); continue; }
            if ((target & BLACK) !== usBit) list.push(enc(sq, t, 0, 0));
            break;
          }
        }
      }
    }
    return list;
  }

  castles(sq, list) {
    const b = this.board, them = this.side ^ 1;
    if (this.side === 0 && sq === 4) {
      if (this.castle & 1 && b[7] === R && !b[5] && !b[6] && !this.attacked(4, them) && !this.attacked(5, them) && !this.attacked(6, them)) list.push(enc(4, 6, 0, CASTLE));
      if (this.castle & 2 && b[0] === R && !b[1] && !b[2] && !b[3] && !this.attacked(4, them) && !this.attacked(3, them) && !this.attacked(2, them)) list.push(enc(4, 2, 0, CASTLE));
    } else if (this.side === 1 && sq === 116) {
      if (this.castle & 4 && b[119] === (R | BLACK) && !b[117] && !b[118] && !this.attacked(116, them) && !this.attacked(117, them) && !this.attacked(118, them)) list.push(enc(116, 118, 0, CASTLE));
      if (this.castle & 8 && b[112] === (R | BLACK) && !b[113] && !b[114] && !b[115] && !this.attacked(116, them) && !this.attacked(115, them) && !this.attacked(114, them)) list.push(enc(116, 114, 0, CASTLE));
    }
  }

  make(m) {
    const b = this.board, from = FROM(m), to = TO(m), promo = PROMO(m), flag = FLAG(m), pc = b[from];
    const capSq = flag & EP ? to + (this.side ? 16 : -16) : to;
    const captured = b[capSq];
    this.stack.push(m, captured, this.castle, this.ep, this.half);
    b[capSq] = 0;
    b[to] = promo ? promo | (pc & BLACK) : pc;
    b[from] = 0;
    if (flag & CASTLE) {
      if (to === 6) { b[5] = b[7]; b[7] = 0; } else if (to === 2) { b[3] = b[0]; b[0] = 0; } else if (to === 118) { b[117] = b[119]; b[119] = 0; } else if (to === 114) { b[115] = b[112]; b[112] = 0; }
    }
    if ((pc & 7) === K) this.kings[this.side] = to;
    this.castle &= CASTLE_MASK[from] & CASTLE_MASK[to];
    this.ep = flag & DOUBLE ? (from + to) >> 1 : -1;
    this.half = (pc & 7) === P || captured ? 0 : this.half + 1;
    this.side ^= 1;
  }

  unmake() {
    const s = this.stack, half = s.pop(), ep = s.pop(), castle = s.pop(), captured = s.pop(), m = s.pop();
    const b = this.board, from = FROM(m), to = TO(m), promo = PROMO(m), flag = FLAG(m);
    this.side ^= 1;
    const pc = b[to];
    b[from] = promo ? P | (pc & BLACK) : pc;
    b[to] = 0;
    b[flag & EP ? to + (this.side ? 16 : -16) : to] = captured;
    if (flag & CASTLE) {
      if (to === 6) { b[7] = b[5]; b[5] = 0; } else if (to === 2) { b[0] = b[3]; b[3] = 0; } else if (to === 118) { b[119] = b[117]; b[117] = 0; } else if (to === 114) { b[112] = b[115]; b[115] = 0; }
    }
    if ((b[from] & 7) === K) this.kings[this.side] = from;
    this.castle = castle; this.ep = ep; this.half = half;
  }

  legalMoves() {
    const out = [];
    for (const m of this.moves()) { this.make(m); if (!this.leftInCheck()) out.push(m); this.unmake(); }
    return out;
  }

  // 지금 차례인 쪽 기준 점수 (센티폰)
  evaluate() {
    const b = this.board;
    let mg = 0, kingMg = 0, kingEg = 0, phase = 0, bishops = [0, 0];
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const pc = b[sq];
      if (!pc) continue;
      const type = pc & 7, black = pc & BLACK, rank = sq >> 4, file = sq & 7;
      const index = black ? rank * 8 + file : (7 - rank) * 8 + file, sign = black ? -1 : 1;
      phase += PHASE[type];
      if (type === B) bishops[black ? 1 : 0]++;
      if (type === K) { kingMg += sign * PST[K][index]; kingEg += sign * KING_END[index]; continue; }
      mg += sign * (VALUE[type] + PST[type][index]);
    }
    phase = Math.min(24, phase);
    let score = mg + (kingMg * phase + kingEg * (24 - phase)) / 24;
    if (bishops[0] >= 2) score += 30;
    if (bishops[1] >= 2) score -= 30;
    return Math.round(this.side ? -score : score);
  }
}

// ---- 검색 ----

let nodes = 0, deadline = Infinity, stopped = false;
const killers = [];

function moveScore(pos, m, ply, first) {
  if (m === first) return 1e7;
  const b = pos.board, victim = FLAG(m) & EP ? P : b[TO(m)] & 7;
  let score = 0;
  if (victim) score = 1e6 + VALUE[victim] * 10 - VALUE[b[FROM(m)] & 7] / 10;
  if (PROMO(m)) score += 9e5 + VALUE[PROMO(m)];
  if (!score && killers[ply] && (killers[ply][0] === m || killers[ply][1] === m)) score = 5e5;
  return score;
}

// 가장 점수가 높은 수를 i 자리로 옮긴다 (잘리면 나머지는 정렬하지 않아도 된다)
function pickNext(moves, scores, i) {
  let best = i;
  for (let j = i + 1; j < moves.length; j++) if (scores[j] > scores[best]) best = j;
  if (best !== i) {
    [moves[i], moves[best]] = [moves[best], moves[i]];
    [scores[i], scores[best]] = [scores[best], scores[i]];
  }
}

function timeUp() {
  if ((++nodes & 1023) === 0 && Date.now() > deadline) stopped = true;
  return stopped;
}

function quiesce(pos, alpha, beta, ply) {
  if (timeUp()) return 0;
  const stand = pos.evaluate();
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  if (ply > 48) return stand;
  const moves = pos.moves(true), scores = moves.map(m => moveScore(pos, m, ply, 0));
  for (let i = 0; i < moves.length; i++) {
    pickNext(moves, scores, i);
    pos.make(moves[i]);
    if (pos.leftInCheck()) { pos.unmake(); continue; }
    const score = -quiesce(pos, -beta, -alpha, ply + 1);
    pos.unmake();
    if (stopped) return 0;
    if (score >= beta) return score;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function negamax(pos, depth, alpha, beta, ply, quiet) {
  if (timeUp()) return 0;
  if (pos.half >= 100) return 0;
  const inCheck = pos.inCheck();
  if (inCheck && ply < 24) depth++;
  if (depth <= 0) return quiet ? quiesce(pos, alpha, beta, ply) : pos.evaluate();
  const moves = pos.moves(), scores = moves.map(m => moveScore(pos, m, ply, 0));
  let legal = 0, best = -Infinity;
  for (let i = 0; i < moves.length; i++) {
    pickNext(moves, scores, i);
    const m = moves[i];
    pos.make(m);
    if (pos.leftInCheck()) { pos.unmake(); continue; }
    legal++;
    const score = -negamax(pos, depth - 1, -beta, -alpha, ply + 1, quiet);
    pos.unmake();
    if (stopped) return 0;
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) {
      if (!(pos.board[TO(m)]) && !PROMO(m)) {
        const k = killers[ply] ?? (killers[ply] = [0, 0]);
        if (k[0] !== m) { k[1] = k[0]; k[0] = m; }
      }
      break;
    }
  }
  if (!legal) return inCheck ? -MATE + ply : 0;
  return best;
}

export function uciOf(m) {
  return squareName(FROM(m)) + squareName(TO(m)) + (PROMO(m) ? '.pnbrqk'[PROMO(m)] : '');
}

function gaussian(rng) {
  let u = 0, v = 0;
  while (!u) u = rng();
  while (!v) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// fen 위치에서 둘 수를 고른다.
// depth: 최대 깊이, timeMs: 생각 시간, quiet: 잡기를 끝까지 읽기,
// noise: 점수에 섞는 흔들림(약한 캐릭터), blunder: 아무 수나 둘 확률, history: 이전 위치 key 들(반복 피하기)
export function chooseMove(fen, options = {}) {
  const { depth: maxDepth = 3, timeMs = 1500, quiet = true, noise = 0, blunder = 0, history = [], rng = Math.random } = options;
  const pos = new Position(fen);
  const legal = pos.legalMoves();
  if (!legal.length) return null;
  if (legal.length === 1) return { uci: uciOf(legal[0]), score: 0, depth: 0 };
  if (blunder && rng() < blunder) {
    const m = legal[Math.floor(rng() * legal.length)];
    return { uci: uciOf(m), score: 0, depth: 0, blunder: true };
  }
  const seen = new Set(history);
  const exact = noise > 0;  // 흔들림을 섞으려면 모든 수의 점수가 정확해야 한다
  nodes = 0; stopped = false; deadline = Date.now() + timeMs; killers.length = 0;
  let ranked = legal.map(m => ({ m, score: 0 }));
  let completed = 0;
  for (let depth = 1; depth <= maxDepth; depth++) {
    const results = [];
    let alpha = -Infinity;
    for (const { m } of ranked) {
      pos.make(m);
      const score = seen.has(pos.key()) ? 0 : -negamax(pos, depth - 1, -Infinity, exact ? Infinity : -alpha, 1, quiet);
      pos.unmake();
      if (stopped) break;
      results.push({ m, score });
      if (score > alpha) alpha = score;
    }
    if (stopped && completed) break;
    // 다 못 읽은 수는 지난번 점수 순서대로 뒤에 둔다
    const done = new Set(results.map(r => r.m));
    ranked = [...results.sort((a, b) => b.score - a.score), ...ranked.filter(r => !done.has(r.m))];
    completed = depth;
    if (stopped || Math.abs(ranked[0].score) > MATE - 200) break;
  }
  let pick = ranked[0];
  if (noise > 0) {
    let bestNoisy = -Infinity;
    for (const r of ranked) {
      const value = r.score + gaussian(rng) * noise;
      if (value > bestNoisy) { bestNoisy = value; pick = r; }
    }
  }
  return { uci: uciOf(pick.m), score: pick.score, depth: completed, nodes };
}

export function perft(fen, depth) {
  const pos = new Position(fen);
  const walk = d => {
    if (d === 0) return 1;
    let count = 0;
    for (const m of pos.moves()) {
      pos.make(m);
      if (!pos.leftInCheck()) count += walk(d - 1);
      pos.unmake();
    }
    return count;
  };
  return walk(depth);
}
