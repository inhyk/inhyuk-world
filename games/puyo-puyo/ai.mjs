// 뿌요 AI. 놓을 수 있는 자리를 모두 해 보고, "뿌요 한두 개만 더 놓으면 몇 연쇄가 터질까"를
// 세어서 더 큰 연쇄를 쌓을 수 있는 자리를 고른다. 층이 올라갈수록 더 멀리 내다보고,
// 더 큰 연쇄를 참았다가 터뜨리고, 손이 빨라지고, 실수가 줄어든다.
import { W, H, VISIBLE, GARBAGE, EMPTY, CHAIN_POWER, COLOR_BONUS, GROUP_BONUS, SPAWN_X } from './core.mjs';

const N = W * H, VIS = W * VISIBLE, TOP = 13;

// 층별 AI. think=처음 고민하는 프레임, interval=조작 사이 프레임
export const AI_LEVELS = [
  null,
  { id: 1, name: '작은 젤리', depth: 1, think: 40, interval: 12, soft: 0.07, drop: false, fire: 1, mistake: 0.45, potential: 0.2, counter: false, kill: false, danger: 9 },
  { id: 2, name: '큰 젤리', depth: 1, think: 36, interval: 10, soft: 0.12, drop: false, fire: 2, mistake: 0.22, potential: 0.6, counter: false, kill: false, danger: 9 },
  { id: 3, name: '운석', depth: 2, think: 36, interval: 10, soft: 0.16, drop: false, fire: 4, mistake: 0.1, potential: 1, counter: true, kill: false, danger: 9 },
  { id: 4, name: '별', depth: 2, think: 30, interval: 8, soft: 0.3, drop: false, fire: 5, mistake: 0.05, potential: 1, counter: true, kill: false, danger: 9 },
  { id: 5, name: '달', depth: 3, think: 24, interval: 7, soft: 0.5, drop: false, fire: 7, mistake: 0.02, potential: 1, counter: true, kill: true, danger: 10 },
  { id: 6, name: '왕관', depth: 3, think: 18, interval: 6, soft: 0.8, drop: false, fire: 8, mistake: 0, potential: 1, counter: true, kill: true, danger: 10 },
  { id: 7, name: '혜성', depth: 3, think: 10, interval: 4, soft: 1, drop: true, fire: 10, mistake: 0, potential: 1, counter: true, kill: true, danger: 10 },
  { id: 8, name: '초신성', depth: 3, think: 6, interval: 2, soft: 1, drop: true, fire: 11, mistake: 0, potential: 1.15, counter: true, kill: true, danger: 10 },
];

// ---------- 빠른 필드 계산 ----------
const visit = new Uint32Array(N);
let stamp = 1;
const stack = new Int16Array(N), group = new Int16Array(N), clear = new Int16Array(N);

function heightsOf(cells, h) {
  for (let x = 0; x < W; x++) {
    let y = 0;
    while (y < H && cells[y * W + x] !== EMPTY) y++;
    h[x] = y;
  }
}

// start 칸과 이어진 같은 색 개수 (보이는 줄 안에서)
function groupSize(cells, start) {
  const c = cells[start];
  if (c === EMPTY || c === GARBAGE || start >= VIS) return 0;
  stamp++;
  let top = 0, n = 0;
  stack[top++] = start; visit[start] = stamp;
  while (top) {
    const j = stack[--top];
    n++;
    const x = j % W;
    if (x > 0 && visit[j - 1] !== stamp && cells[j - 1] === c) { visit[j - 1] = stamp; stack[top++] = j - 1; }
    if (x < W - 1 && visit[j + 1] !== stamp && cells[j + 1] === c) { visit[j + 1] = stamp; stack[top++] = j + 1; }
    if (j >= W && visit[j - W] !== stamp && cells[j - W] === c) { visit[j - W] = stamp; stack[top++] = j - W; }
    if (j + W < VIS && visit[j + W] !== stamp && cells[j + W] === c) { visit[j + W] = stamp; stack[top++] = j + W; }
  }
  return n;
}

// 연쇄를 끝까지 돌린다 (cells를 바꾼다). 결과는 [연쇄 수, 점수]
function runChain(cells, out) {
  let chain = 0, score = 0;
  for (;;) {
    stamp++;
    let cleared = 0, puyos = 0, colors = 0, bonus = 0;
    for (let i = 0; i < VIS; i++) {
      const c = cells[i];
      if (c === EMPTY || c === GARBAGE || visit[i] === stamp) continue;
      let top = 0, n = 0;
      stack[top++] = i; visit[i] = stamp;
      while (top) {
        const j = stack[--top];
        group[n++] = j;
        const x = j % W;
        if (x > 0 && visit[j - 1] !== stamp && cells[j - 1] === c) { visit[j - 1] = stamp; stack[top++] = j - 1; }
        if (x < W - 1 && visit[j + 1] !== stamp && cells[j + 1] === c) { visit[j + 1] = stamp; stack[top++] = j + 1; }
        if (j >= W && visit[j - W] !== stamp && cells[j - W] === c) { visit[j - W] = stamp; stack[top++] = j - W; }
        if (j + W < VIS && visit[j + W] !== stamp && cells[j + W] === c) { visit[j + W] = stamp; stack[top++] = j + W; }
      }
      if (n >= 4) {
        for (let k = 0; k < n; k++) clear[cleared++] = group[k];
        puyos += n;
        colors |= 1 << c;
        bonus += GROUP_BONUS[n > 11 ? 11 : n];
      }
    }
    if (!puyos) break;
    chain++;
    let colorCount = 0;
    for (let c = 1; c <= 5; c++) if (colors & (1 << c)) colorCount++;
    const mult = Math.min(999, Math.max(1, CHAIN_POWER[Math.min(chain, 19)] + COLOR_BONUS[colorCount] + bonus));
    score += 10 * puyos * mult;
    for (let k = 0; k < cleared; k++) {
      const j = clear[k], x = j % W;
      cells[j] = EMPTY;
      if (x > 0 && cells[j - 1] === GARBAGE) cells[j - 1] = EMPTY;
      if (x < W - 1 && cells[j + 1] === GARBAGE) cells[j + 1] = EMPTY;
      if (j >= W && cells[j - W] === GARBAGE) cells[j - W] = EMPTY;
      if (j + W < VIS && cells[j + W] === GARBAGE) cells[j + W] = EMPTY;
    }
    for (let x = 0; x < W; x++) {
      let w = x;
      for (let j = x; j < N; j += W) {
        const v = cells[j];
        if (!v) continue;
        if (j !== w) { cells[w] = v; cells[j] = EMPTY; }
        w += W;
      }
    }
  }
  out[0] = chain; out[1] = score;
  return out;
}

// ---------- 놓을 자리 ----------
// 짝 [축, 자식]을 (x, rot)로 놓는다. 놓은 칸 번호를 placed에 적는다. 3열이 막히면 false.
const DXR = [0, 1, 0, -1];
function place(cells, h, x, rot, a, c, placed) {
  let n = 0;
  if (rot === 0 || rot === 2) {
    const lo = rot === 0 ? a : c, hi = rot === 0 ? c : a;
    const y = h[x];
    if (y < TOP) { cells[y * W + x] = lo; placed[n++] = y * W + x; }
    if (y + 1 < TOP) { cells[(y + 1) * W + x] = hi; placed[n++] = (y + 1) * W + x; }
  } else {
    const cx = x + DXR[rot];
    if (h[x] < TOP) { cells[h[x] * W + x] = a; placed[n++] = h[x] * W + x; }
    if (h[cx] < TOP) { cells[h[cx] * W + cx] = c; placed[n++] = h[cx] * W + cx; }
  }
  return n;
}

// 나오는 자리(3열 12단)에서 옆으로 옮길 수 있는지: 13·14단까지 쌓인 열은 넘을 수 없다
export function reachable(h) {
  const ok = new Array(W).fill(false);
  ok[SPAWN_X] = h[SPAWN_X] < 12;
  for (let x = SPAWN_X - 1; x >= 0 && ok[x + 1] && h[x] < 12; x--) ok[x] = true;
  for (let x = SPAWN_X + 1; x < W && ok[x - 1] && h[x] < 12; x++) ok[x] = true;
  return ok;
}

export function moves(h, a, c) {
  const ok = reachable(h), list = [];
  for (let x = 0; x < W; x++) {
    if (!ok[x]) continue;
    list.push({ x, rot: 0 });
    if (a !== c) list.push({ x, rot: 2 });
    if (x + 1 < W && ok[x + 1]) list.push({ x, rot: 1 });
    if (a !== c && x - 1 >= 0 && ok[x - 1]) list.push({ x, rot: 3 });
  }
  return list;
}

// ---------- 평가 ----------
const potBuf = new Uint8Array(N), chainOut = [0, 0];

// 뿌요를 1~2개 더 놓아서 터지는 가장 큰 연쇄
export function potential(cells, h, palette) {
  let bestChain = 0, bestScore = 0, bestNeed = 3;
  for (let x = 0; x < W; x++) {
    const y = h[x];
    if (y >= VISIBLE) continue;
    for (const k of palette) {
      // 옆에 같은 색이 없으면 해 볼 필요도 없다
      const i = y * W + x;
      const touch = (x > 0 && cells[i - 1] === k) || (x < W - 1 && cells[i + 1] === k) || (y > 0 && cells[i - W] === k);
      if (!touch) continue;
      for (let need = 1; need <= 2; need++) {
        if (y + need > VISIBLE) break;
        potBuf.set(cells);
        for (let d = 0; d < need; d++) potBuf[i + d * W] = k;
        if (groupSize(potBuf, i) < 4) continue;
        runChain(potBuf, chainOut);
        const chain = chainOut[0];
        if (chain > bestChain || (chain === bestChain && (need < bestNeed || (need === bestNeed && chainOut[1] > bestScore)))) {
          bestChain = chain; bestScore = chainOut[1]; bestNeed = need;
        }
        break;
      }
    }
  }
  return { chain: bestChain, score: bestScore, need: bestNeed };
}

// 같은 색끼리 붙어 있는 정도 (2개·3개 무리를 좋아한다)
function connection(cells) {
  let v = 0;
  stamp++;
  for (let i = 0; i < VIS; i++) {
    const c = cells[i];
    if (c === EMPTY || c === GARBAGE || visit[i] === stamp) continue;
    let top = 0, n = 0;
    stack[top++] = i; visit[i] = stamp;
    while (top) {
      const j = stack[--top];
      n++;
      const x = j % W;
      if (x > 0 && visit[j - 1] !== stamp && cells[j - 1] === c) { visit[j - 1] = stamp; stack[top++] = j - 1; }
      if (x < W - 1 && visit[j + 1] !== stamp && cells[j + 1] === c) { visit[j + 1] = stamp; stack[top++] = j + 1; }
      if (j >= W && visit[j - W] !== stamp && cells[j - W] === c) { visit[j - W] = stamp; stack[top++] = j - W; }
      if (j + W < VIS && visit[j + W] !== stamp && cells[j + W] === c) { visit[j + W] = stamp; stack[top++] = j + W; }
    }
    v += n === 1 ? -1 : n === 2 ? 2 : 5;
  }
  return v;
}

const U_SHAPE = [2, 1, 0, 0, 1, 2];
export function evaluate(cells, h, palette, cfg) {
  if (h[SPAWN_X] >= 12) return -1e9;
  let v = 0;
  const pot = potential(cells, h, palette);
  v += cfg.potential * (pot.chain * 1000 + Math.min(pot.score, 300000) / 200 - pot.need * 150);
  v += connection(cells) * 18;
  // U자 모양: 가장자리가 조금 높고 가운데가 낮으면 연쇄를 쌓기 좋다
  let avg = 0;
  for (let x = 0; x < W; x++) avg += h[x];
  avg /= W;
  for (let x = 0; x < W; x++) {
    const d = h[x] - avg - U_SHAPE[x] * Math.min(1, avg / 4);
    v -= d * d * 12;
    if (x < W - 1) { const cliff = Math.abs(h[x] - h[x + 1]); if (cliff > 2) v -= (cliff - 2) * 60; }
  }
  // 3열이 높으면 위험, 13단에 놓는 건 낭비
  if (h[2] > 8) v -= (h[2] - 8) * (h[2] - 8) * 900;
  if (h[3] > 9) v -= (h[3] - 9) * (h[3] - 9) * 500;
  if (h[1] > 9) v -= (h[1] - 9) * (h[1] - 9) * 400;
  for (let x = 0; x < W; x++) if (h[x] > VISIBLE) v -= 700;
  // 방해뿌요가 깔려 있으면 조금 감점
  let garbage = 0;
  for (let i = 0; i < VIS; i++) if (cells[i] === GARBAGE) garbage++;
  v -= garbage * 12;
  return v;
}

// ---------- 생각하기 ----------
const bufs = [new Uint8Array(N), new Uint8Array(N), new Uint8Array(N), new Uint8Array(N)];
const hs = [new Int8Array(W), new Int8Array(W), new Int8Array(W), new Int8Array(W)];
const placedBuf = new Int16Array(2);

// cells에 수를 두고 연쇄까지 끝낸다. 결과: {chain, score}
function apply(src, h, mv, a, c, dst, dh) {
  dst.set(src);
  const n = place(dst, h, mv.x, mv.rot, a, c, placedBuf);
  let fired = false;
  for (let k = 0; k < n; k++) if (groupSize(dst, placedBuf[k]) >= 4) { fired = true; break; }
  let chain = 0, score = 0;
  if (fired) { runChain(dst, chainOut); chain = chainOut[0]; score = chainOut[1]; }
  heightsOf(dst, dh);
  return { chain, score };
}

// 상대를 끝낼 수 있는 방해뿌요 수 (상대 3열이 꼭대기까지 차는 양)
export function killAmount(oppHeights) {
  if (!oppHeights) return Infinity;
  const need = (12 - oppHeights[2]) * 6;
  return Math.max(12, Math.min(90, need));
}

// state: { cells, pairs:[[a,c],[a,c],[a,c]], palette, incoming, target, oppHeights, oppBusy }
export function think(state, cfg, random = Math.random) {
  const { cells, pairs, palette } = state;
  const target = state.target || 70;
  const h0 = hs[0];
  heightsOf(cells, h0);
  const [a, c] = pairs[0];
  const first = moves(h0, a, c);
  if (!first.length) return { x: SPAWN_X, rot: 0, chain: 0 };

  // 1) 지금 바로 터지는 연쇄들
  const options = first.map(mv => {
    const r = apply(cells, h0, mv, a, c, bufs[1], hs[1]);
    return { mv, chain: r.chain, score: r.score, garbage: Math.floor(r.score / target), after: bufs[1].slice(), h: Int8Array.from(hs[1]) };
  });
  const firing = options.filter(o => o.chain > 0).sort((p, q) => q.chain - p.chain || q.score - p.score);
  const bestFire = firing[0];
  const incoming = state.incoming || 0;
  let maxH = 0;
  for (let x = 1; x < 5; x++) maxH = Math.max(maxH, h0[x]);

  if (bestFire) {
    const lethal = cfg.kill && bestFire.garbage >= killAmount(state.oppHeights) + incoming && !state.oppBusy;
    const counter = cfg.counter && incoming >= 6 && (bestFire.garbage >= incoming * 0.7 || incoming >= (12 - h0[2]) * 6 * 0.6);
    const danger = maxH >= cfg.danger || h0[2] >= cfg.danger - 1;
    if (bestFire.chain >= cfg.fire || lethal || counter || danger) {
      return { x: bestFire.mv.x, rot: bestFire.mv.rot, chain: bestFire.chain, reason: bestFire.chain >= cfg.fire ? 'fire' : lethal ? 'kill' : counter ? 'counter' : 'danger' };
    }
  }

  // 2) 연쇄 쌓기: 몇 수 앞까지 내다보고 평가
  const depth = Math.min(cfg.depth, pairs.length);
  const scored = options.map(o => {
    let value;
    if (o.chain > 0) {
      // 너무 작은 연쇄로 재료를 날리면 손해
      value = evaluate(o.after, o.h, palette, cfg) - (cfg.fire - o.chain) * 900 - 1500;
    } else if (depth >= 2) {
      value = lookahead(o.after, o.h, pairs, 1, depth, palette, cfg);
    } else {
      value = evaluate(o.after, o.h, palette, cfg);
    }
    return { o, value };
  }).sort((p, q) => q.value - p.value);

  let pick = scored[0];
  if (cfg.mistake && random() < cfg.mistake) {
    const pool = scored.slice(0, Math.min(scored.length, 6));
    pick = pool[Math.floor(random() * pool.length)];
  }
  return { x: pick.o.mv.x, rot: pick.o.mv.rot, chain: pick.o.chain, reason: 'build', value: pick.value };
}

function lookahead(cells, h, pairs, d, depth, palette, cfg) {
  const [a, c] = pairs[d];
  const list = moves(h, a, c);
  if (!list.length) return -1e9;
  const dst = bufs[d + 1], dh = hs[d + 1];
  if (d + 1 >= depth) {
    let best = -1e9;
    for (const mv of list) {
      const r = apply(cells, h, mv, a, c, dst, dh);
      let v = evaluate(dst, dh, palette, cfg);
      if (r.chain > 0) v += r.chain >= cfg.fire ? r.chain * 800 : -(cfg.fire - r.chain) * 700 - 1200;
      if (v > best) best = v;
    }
    return best;
  }
  // 깊이 3: 다음 수 후보를 빠르게 줄인 뒤(빔) 그다음 수까지 본다
  const beam = [];
  for (const mv of list) {
    const r = apply(cells, h, mv, a, c, dst, dh);
    let v = evaluate(dst, dh, palette, cfg);
    if (r.chain > 0) v += r.chain >= cfg.fire ? r.chain * 800 : -(cfg.fire - r.chain) * 700 - 1200;
    beam.push({ v, cells: dst.slice(), h: Int8Array.from(dh), chain: r.chain });
  }
  beam.sort((p, q) => q.v - p.v);
  let best = -1e9;
  for (const b of beam.slice(0, 6)) {
    const v = b.chain > 0 ? b.v : Math.max(b.v, lookahead(b.cells, b.h, pairs, d + 1, depth, palette, cfg));
    if (v > best) best = v;
  }
  return best;
}

// ---------- 손 움직이기 ----------
// AI가 정한 자리로 한 프레임씩 버튼을 누른다.
// brain(state, level)이 있으면 생각을 따로(웹 워커) 시키고 답이 올 때까지 기다린다.
export class AIController {
  constructor(level, random = Math.random, brain = null) {
    this.level = AI_LEVELS[level] ? level : 1;
    this.cfg = AI_LEVELS[this.level];
    this.random = random;
    this.brain = brain;
    this.plan = null;
    this.wait = 0;
    this.pieceRef = null;
    this.tries = 0;
    this.ask = 0;
    this.slow = 1;   // 도움 모드: 1보다 크면 손이 느려진다
  }
  input(player, view) {
    const p = player.piece;
    if (!p || player.state !== 'control') { this.pieceRef = null; return {}; }
    if (p !== this.pieceRef) {
      this.pieceRef = p;
      const state = {
        cells: player.cells, pairs: [[p.a, p.c], ...player.next], palette: player.seq.palette, incoming: player.incoming,
        target: view?.target, oppHeights: view?.oppHeights ? Array.from(view.oppHeights) : null, oppBusy: view?.oppBusy,
      };
      this.wait = Math.round(this.cfg.think * this.slow * (0.8 + this.random() * 0.4));
      this.tries = 0;
      this.plan = null;
      const ask = ++this.ask;
      if (this.brain) {
        this.brain({ ...state, cells: Array.from(player.cells) }, this.level)
          .then(plan => { if (ask === this.ask && this.pieceRef === p) this.plan = plan; })
          .catch(() => { if (ask === this.ask && this.pieceRef === p) this.plan = think(state, this.cfg, this.random); });
      } else this.plan = think(state, this.cfg, this.random);
      return {};
    }
    if (this.wait > 0) { this.wait--; return {}; }
    const plan = this.plan, cfg = this.cfg;
    if (!plan) return {};   // 아직 생각 중
    this.wait = Math.max(1, Math.round(cfg.interval * this.slow));
    if (p.rot !== plan.rot && this.tries < 6) {
      this.tries++;
      const diff = (plan.rot - p.rot + 4) % 4;
      return diff === 3 ? { rotL: true } : { rotR: true };
    }
    if (p.x !== plan.x && this.tries < 14) {
      this.tries++;
      return p.x < plan.x ? { right: true } : { left: true };
    }
    this.wait = 0;
    if (cfg.drop) return { drop: true };
    return { down: this.random() < cfg.soft };
  }
}

// 웹 워커 두뇌 만들기 (브라우저에서만). 실패하면 null → 그 자리에서 생각
export function createBrain(makeWorker) {
  let worker;
  try { worker = makeWorker(); } catch { return null; }
  let id = 0;
  const waiting = new Map();
  worker.onmessage = e => {
    const { id: key, plan, error } = e.data || {};
    const cb = waiting.get(key);
    if (!cb) return;
    waiting.delete(key);
    if (error) cb.reject(new Error(error));
    else cb.resolve(plan);
  };
  worker.onerror = () => { for (const cb of waiting.values()) cb.reject(new Error('worker')); waiting.clear(); };
  return (state, level) => new Promise((resolve, reject) => {
    const key = ++id;
    waiting.set(key, { resolve, reject });
    worker.postMessage({ id: key, state, level });
    setTimeout(() => { if (waiting.has(key)) { waiting.delete(key); reject(new Error('timeout')); } }, 1500);
  });
}
