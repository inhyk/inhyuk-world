// 뿌요뿌요 통(通) 규칙 엔진. 화면·소리와 상관없이 60프레임 단위로 돌아가는 순수 로직이다.
// 좌표: x=0..5 (왼쪽→오른쪽), y=0..13 (아래→위).
//  y=0..11  : 보이는 12줄. 여기서만 뿌요가 이어지고 터진다.
//  y=12     : 13번째 줄(숨은 줄). 놓을 수는 있지만 터지지 않는다.
//  y=13     : 14번째 줄. 여기에 놓인 뿌요는 사라진다.
// 3번째 열 12번째 줄(x=2, y=11)이 막힌 채로 다음 뿌요가 나오면 진다.

export const W = 6, H = 14, VISIBLE = 12, HIDDEN_ROW = 12, VANISH_ROW = 13;
export const SPAWN_X = 2, SPAWN_Y = 11;
export const EMPTY = 0, GARBAGE = 6;
export const COLOR_KEYS = ['.', 'R', 'G', 'B', 'Y', 'P', 'O'];
export const COLOR_NAMES = ['', '빨강', '초록', '파랑', '노랑', '보라', '방해'];
export const idx = (x, y) => y * W + x;

// 점수 = 10 × 지운 개수 × (연쇄 보너스 + 색 보너스 + 연결 보너스), 곱하는 값은 1~999
export const CHAIN_POWER = [0, 0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512];
export const COLOR_BONUS = [0, 0, 3, 6, 12, 24];
export const GROUP_BONUS = [0, 0, 0, 0, 0, 2, 3, 4, 5, 6, 7, 10];
export const TARGET_POINTS = 70;       // 70점마다 방해뿌요 1개
export const MAX_GARBAGE_DROP = 30;    // 한 번에 떨어지는 방해뿌요는 5줄까지
export const ALL_CLEAR_BONUS = 2100;   // 전소하면 다음 연쇄에 방해뿌요 30개 추가
export const MARGIN_FRAMES = 96 * 60;  // 96초가 지나면
export const MARGIN_STEP = 16 * 60;    // 16초마다 방해뿌요가 더 잘 나온다

// 방해뿌요 예고 아이콘. 인혁이 기획서 순서: 작은 → 큰 → 운석 → 별 → 달 → 왕관 (+ 비밀의 혜성)
export const GARBAGE_ICONS = [
  { id: 'small', value: 1, name: '작은 방해 뿌요' },
  { id: 'big', value: 6, name: '큰 방해 뿌요' },
  { id: 'rock', value: 30, name: '운석' },
  { id: 'star', value: 180, name: '별' },
  { id: 'moon', value: 360, name: '달' },
  { id: 'crown', value: 720, name: '왕관' },
  { id: 'comet', value: 1440, name: '혜성' },
];

// 예고 칸에 보여 줄 아이콘들 (큰 것부터 최대 6개)
export function garbageIcons(count, max = 6) {
  const out = [];
  let left = Math.max(0, Math.floor(count));
  for (let i = GARBAGE_ICONS.length - 1; i >= 0 && out.length < max; i--) {
    const icon = GARBAGE_ICONS[i];
    while (left >= icon.value && out.length < max) { out.push(icon.id); left -= icon.value; }
  }
  return out;
}

// 마진 타임: 96초 뒤부터 16초마다 목표 점수가 3/4로 줄어 방해뿌요가 많아진다.
export function targetPoints(frame, base = TARGET_POINTS) {
  if (frame < MARGIN_FRAMES) return base;
  let target = base;
  const steps = Math.floor((frame - MARGIN_FRAMES) / MARGIN_STEP) + 1;
  for (let i = 0; i < steps && target > 1; i++) target = Math.max(1, Math.floor(target * 3 / 4));
  return target;
}

// ---------- 난수와 뿌요 순서 ----------
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle(list, random) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// 통과 같은 방식: 색마다 같은 개수가 들어간 256개 주머니를 섞고,
// 처음 두 짝(4개)은 3색 주머니에서 가져와 첫 수가 너무 어렵지 않게 한다.
// 두 사람은 언제나 같은 순서를 받는다.
export function makeSequence(seed, colors = 4) {
  const random = rng(seed);
  const palette = shuffle([1, 2, 3, 4, 5], random).slice(0, colors);
  const table = n => shuffle(Array.from({ length: 256 }, (_, i) => palette[i % n]), random);
  const puyos = table(colors);
  if (colors > 3) {
    const three = table(3);
    for (let i = 0; i < 4; i++) puyos[i] = three[i];
  }
  return { seed, colors, palette, puyos };
}
export function pairAt(seq, n) {
  const k = (n * 2) % seq.puyos.length;
  return [seq.puyos[k], seq.puyos[k + 1]];
}

// ---------- 필드 도우미 ----------
export function heights(cells, out = new Int8Array(W)) {
  for (let x = 0; x < W; x++) {
    let h = 0;
    while (h < H && cells[h * W + x] !== EMPTY) h++;
    out[x] = h;
  }
  return out;
}

// 테스트와 퍼즐용: 위쪽 줄부터 적은 문자열을 필드로 바꾼다. (. R G B Y P O)
export function parseField(rows) {
  const cells = new Uint8Array(W * H);
  rows.forEach((row, i) => {
    const y = rows.length - 1 - i;
    for (let x = 0; x < W; x++) {
      const v = COLOR_KEYS.indexOf(row[x] || '.');
      if (v > 0) cells[idx(x, y)] = v;
    }
  });
  return cells;
}
export function fieldRows(cells, top = H - 1) {
  const rows = [];
  for (let y = top; y >= 0; y--) {
    let row = '';
    for (let x = 0; x < W; x++) row += COLOR_KEYS[cells[idx(x, y)]];
    rows.push(row);
  }
  return rows;
}
export const fieldString = cells => Array.from(cells, v => v).join('');
export function isEmpty(cells) {
  for (let i = 0; i < cells.length; i++) if (cells[i]) return false;
  return true;
}

// 4개 이상 이어진 같은 색 무리 (보이는 12줄 안에서만)
const seenBuf = new Uint8Array(W * VISIBLE), stackBuf = new Int16Array(W * VISIBLE);
export function findGroups(cells, minGroup = 4) {
  seenBuf.fill(0);
  const groups = [];
  for (let i = 0; i < W * VISIBLE; i++) {
    const c = cells[i];
    if (c === EMPTY || c === GARBAGE || seenBuf[i]) continue;
    let top = 0;
    stackBuf[top++] = i; seenBuf[i] = 1;
    const group = [];
    while (top) {
      const j = stackBuf[--top];
      group.push(j);
      const x = j % W;
      if (x > 0 && !seenBuf[j - 1] && cells[j - 1] === c) { seenBuf[j - 1] = 1; stackBuf[top++] = j - 1; }
      if (x < W - 1 && !seenBuf[j + 1] && cells[j + 1] === c) { seenBuf[j + 1] = 1; stackBuf[top++] = j + 1; }
      if (j >= W && !seenBuf[j - W] && cells[j - W] === c) { seenBuf[j - W] = 1; stackBuf[top++] = j - W; }
      if (j + W < W * VISIBLE && !seenBuf[j + W] && cells[j + W] === c) { seenBuf[j + W] = 1; stackBuf[top++] = j + W; }
    }
    if (group.length >= minGroup) groups.push(group);
  }
  return groups;
}

// 터지는 뿌요 옆에 붙은 방해뿌요도 같이 사라진다
export function adjacentGarbage(cells, groups) {
  const out = new Set();
  for (const g of groups) for (const j of g) {
    const x = j % W;
    const near = [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, j >= W ? j - W : -1, j + W < W * VISIBLE ? j + W : -1];
    for (const k of near) if (k >= 0 && cells[k] === GARBAGE) out.add(k);
  }
  return [...out];
}

export function stepScore(chain, groups, cells) {
  let puyos = 0, group = 0;
  const colors = new Set();
  for (const g of groups) {
    puyos += g.length;
    group += GROUP_BONUS[Math.min(g.length, 11)];
    colors.add(cells[g[0]]);
  }
  const power = CHAIN_POWER[Math.min(chain, CHAIN_POWER.length - 1)];
  const mult = Math.min(999, Math.max(1, power + COLOR_BONUS[colors.size] + group));
  return { score: 10 * puyos * mult, puyos, colors: colors.size, mult };
}

// 빈칸 아래로 뿌요를 떨어뜨리고 움직인 목록을 돌려준다.
export function applyGravity(cells) {
  const moves = [];
  for (let x = 0; x < W; x++) {
    let write = 0;
    for (let y = 0; y < H; y++) {
      const v = cells[y * W + x];
      if (!v) continue;
      if (y !== write) { cells[write * W + x] = v; cells[y * W + x] = EMPTY; moves.push({ x, from: y, to: write, v }); }
      write++;
    }
  }
  return moves;
}

// 연쇄를 끝까지 계산한다 (AI 평가·테스트용, 애니메이션 없음)
export function resolveChain(cells, target = TARGET_POINTS, minGroup = 4) {
  let chain = 0, score = 0;
  for (;;) {
    const groups = findGroups(cells, minGroup);
    if (!groups.length) break;
    chain++;
    score += stepScore(chain, groups, cells).score;
    for (const k of adjacentGarbage(cells, groups)) cells[k] = EMPTY;
    for (const g of groups) for (const j of g) cells[j] = EMPTY;
    applyGravity(cells);
  }
  return { chain, score, garbage: Math.floor(score / target), allClear: chain > 0 && isEmpty(cells) };
}

// ---------- 조작하는 짝 ----------
// rot: 0 = 자식이 위, 1 = 오른쪽, 2 = 아래, 3 = 왼쪽 (시계 방향으로 +1)
export const DX = [0, 1, 0, -1], DY = [1, 0, -1, 0];

export const TIMING = {
  spawnDelay: 8,
  gravity: 1 / 30,       // 기본 낙하: 1초에 2칸
  softDrop: 0.5,         // 아래 키: 1초에 30칸
  lockDelay: 24,
  lockResets: 10,
  floorKicks: 8,
  popFrames: 36,         // 터지기 전에 반짝이는 시간
  chainPause: 6,
  quickTurnWindow: 20,   // 좁은 곳에서 두 번 돌리면 뒤집힌다
  landFrames: 10,
};

function canPlace(h, x, y) {
  return x >= 0 && x < W && Math.floor(y) >= h[x] && Math.ceil(y) <= VANISH_ROW;
}
export function restY(h, x, rot) {
  if (rot === 0) return h[x];
  if (rot === 2) return h[x] + 1;
  return Math.max(h[x], h[x + DX[rot]]);
}

export class Player {
  constructor({ seq, seed = 1, timing = {}, minGroup = 4 } = {}) {
    this.minGroup = minGroup;
    this.seq = seq;
    this.t = { ...TIMING, ...timing };
    this.cells = new Uint8Array(W * H);
    this.h = new Int8Array(W);
    this.pairIndex = 0;
    this.piece = null;
    this.state = 'ready';
    this.timer = 0;
    this.after = '';
    this.score = 0;
    this.leftover = 0;
    this.incoming = 0;
    this.chain = 0;
    this.chaining = false;
    this.allClearBonus = false;
    this.garbageRandom = rng((seed * 2654435761) >>> 0 || 7);
    this.falling = [];     // {x, to, y, v, color}
    this.popping = null;   // {cells:Set, garbage:[], chain}
    this.land = new Map(); // idx -> 남은 찌그러짐 프레임
    this.events = [];
    this.frame = 0;
    this.lastChain = 0;
    this.chainTotal = 0;   // 이번 연쇄에서 만든 방해뿌요 (상쇄 포함)
    this.chainSent = 0;
    this.stats = {
      pieces: 0, maxChain: 0, popped: 0, garbageSent: 0, maxAttack: 0, allClears: 0,
      offsets: 0, offsetAmount: 0, maxColors: 0, maxGroup: 0, garbageTaken: 0, chains: {},
    };
  }
  get next() { return [pairAt(this.seq, this.pairIndex), pairAt(this.seq, this.pairIndex + 1)]; }
  get dead() { return this.state === 'dead'; }
  get busy() { return this.state !== 'control' && this.state !== 'ready' && this.state !== 'dead'; }
  emit(type, data = {}) { this.events.push({ type, ...data }); }
  refreshHeights() { heights(this.cells, this.h); }

  start() { this.state = 'spawn'; this.timer = 1; }

  step(input = {}, ctx = {}) {
    this.frame++;
    for (const [k, v] of this.land) {
      if (v <= 1) this.land.delete(k);
      else this.land.set(k, v - 1);
    }
    switch (this.state) {
      case 'spawn': if (--this.timer <= 0) this.spawn(); break;
      case 'control': this.control(input, ctx); break;
      case 'settle': if (this.advanceFalling()) { this.state = 'check'; this.timer = this.after === 'lock' ? 2 : this.t.chainPause; } break;
      case 'check': if (--this.timer <= 0) this.check(ctx); break;
      case 'pop': if (--this.timer <= 0) this.clearPopped(); break;
      case 'garbage': if (this.advanceFalling()) { this.state = 'spawn'; this.timer = this.t.spawnDelay; } break;
      default: break;
    }
  }

  spawn() {
    this.refreshHeights();
    if (this.cells[idx(SPAWN_X, SPAWN_Y)] !== EMPTY) {
      this.state = 'dead';
      this.piece = null;
      this.emit('dead');
      return;
    }
    const [a, c] = pairAt(this.seq, this.pairIndex++);
    this.piece = { x: SPAWN_X, y: SPAWN_Y, rot: 0, a, c, lock: 0, resets: 0, kicks: 0, quick: 0, soft: 0 };
    this.state = 'control';
    this.emit('spawn');
  }

  control(input, ctx) {
    const p = this.piece;
    if (p.quick > 0) p.quick--;
    if (input.drop) { this.hardDrop(); return; }
    if (input.rotL) this.rotate(-1);
    if (input.rotR) this.rotate(1);
    if (input.left) this.move(-1);
    if (input.right) this.move(1);
    const rest = restY(this.h, p.x, p.rot);
    if (p.y > rest) {
      const speed = input.down ? this.t.softDrop : (ctx.gravity ?? this.t.gravity);
      const ny = Math.max(rest, p.y - speed);
      if (input.down) {
        p.soft += p.y - ny;
        while (p.soft >= 1) { p.soft -= 1; this.score += 1; this.leftover += 1; }
      }
      p.y = ny;
      p.lock = 0;
      if (p.y === rest) this.emit('touch');
    } else if (input.down) {
      this.lock();
    } else if (++p.lock >= this.t.lockDelay) {
      this.lock();
    }
  }

  grounded() { const p = this.piece; return p.y <= restY(this.h, p.x, p.rot); }
  touched() {
    const p = this.piece;
    if (this.grounded() && p.resets < this.t.lockResets) { p.lock = 0; p.resets++; }
  }

  move(dx) {
    const p = this.piece, nx = p.x + dx;
    if (canPlace(this.h, nx, p.y) && canPlace(this.h, nx + DX[p.rot], p.y + DY[p.rot])) {
      p.x = nx;
      this.touched();
      this.emit('move');
      return true;
    }
    this.emit('bump');
    return false;
  }

  rotate(dir) {
    const p = this.piece, h = this.h;
    const vertical = p.rot === 0 || p.rot === 2;
    const blockedSides = !canPlace(h, p.x - 1, p.y) && !canPlace(h, p.x + 1, p.y);
    // 좁은 틈: 한 번 누르면 준비, 한 번 더 누르면 위아래가 뒤집힌다 (퀵턴)
    if (vertical && blockedSides) {
      if (p.quick > 0) {
        const ny = p.rot === 0 ? p.y + 1 : p.y - 1;
        const nr = (p.rot + 2) % 4;
        if (canPlace(h, p.x, ny) && canPlace(h, p.x, ny + DY[nr])) {
          p.y = ny; p.rot = nr; p.quick = 0;
          this.touched();
          this.emit('rotate', { quick: true });
          return true;
        }
      }
      p.quick = this.t.quickTurnWindow;
      this.emit('bump');
      return false;
    }
    const nr = (p.rot + dir + 4) % 4;
    const cx = p.x + DX[nr], cy = p.y + DY[nr];
    if (canPlace(h, cx, cy) && canPlace(h, p.x, p.y)) {
      p.rot = nr;
      this.touched();
      this.emit('rotate');
      return true;
    }
    if (nr === 1 || nr === 3) {
      // 벽이나 뿌요에 막히면 축을 반대쪽으로 한 칸 민다
      const nx = p.x - DX[nr];
      if (canPlace(h, nx, p.y) && canPlace(h, p.x, p.y)) {
        p.x = nx; p.rot = nr;
        this.touched();
        this.emit('rotate', { kick: true });
        return true;
      }
    } else if (nr === 2 && p.kicks < this.t.floorKicks) {
      // 아래가 막히면 한 칸 들어 올린다 (바닥 차기)
      const ny = h[p.x] + 1;
      if (ny <= p.y + 1 && canPlace(h, p.x, ny) && canPlace(h, p.x, ny - 1)) {
        p.y = ny; p.rot = nr; p.kicks++;
        this.touched();
        this.emit('rotate', { kick: true });
        return true;
      }
    }
    this.emit('bump');
    return false;
  }

  // 지금 모양 그대로 떨어졌을 때 두 뿌요가 멈출 자리 (그림자 표시용)
  ghost() {
    const p = this.piece;
    if (!p) return null;
    const h = Array.from(this.h);
    const parts = [{ x: p.x, y: p.y, v: p.a }, { x: p.x + DX[p.rot], y: p.y + DY[p.rot], v: p.c }].sort((a, b) => a.y - b.y);
    return parts.map(part => ({ x: part.x, y: h[part.x]++, v: part.v }));
  }

  hardDrop() {
    const p = this.piece, rest = restY(this.h, p.x, p.rot);
    const rows = Math.floor(p.y - rest);
    if (rows > 0) { this.score += rows; this.leftover += rows; }
    p.y = rest;
    this.emit('drop', { rows });
    this.lock();
  }

  lock() {
    const p = this.piece;
    const parts = [{ x: p.x, y: p.y, v: p.a }, { x: p.x + DX[p.rot], y: p.y + DY[p.rot], v: p.c }].sort((a, b) => a.y - b.y);
    this.piece = null;
    this.falling = [];
    let split = false;
    for (const part of parts) {
      const to = this.h[part.x];
      if (to >= VANISH_ROW) { this.emit('vanish', { x: part.x }); continue; }
      this.cells[idx(part.x, to)] = part.v;
      this.h[part.x]++;
      if (part.y > to + 0.01) { this.falling.push({ x: part.x, to, y: part.y, v: 0.12, color: part.v }); split = true; }
      else this.land.set(idx(part.x, to), this.t.landFrames);
    }
    this.stats.pieces++;
    this.emit('lock', { split });
    this.state = 'settle';
    this.after = 'lock';
  }

  // 떨어지는 뿌요를 한 프레임 움직인다. 모두 닿으면 true.
  advanceFalling() {
    let moving = false;
    for (const f of this.falling) {
      if (f.y <= f.to) continue;
      f.v = Math.min(0.75, f.v + 0.045);
      f.y = Math.max(f.to, f.y - f.v);
      if (f.y <= f.to) { this.land.set(idx(f.x, f.to), this.t.landFrames); this.emit('landed', { x: f.x, garbage: f.color === GARBAGE }); }
      else moving = true;
    }
    if (!moving) this.falling = [];
    return !moving;
  }

  check(ctx) {
    const groups = findGroups(this.cells, this.minGroup);
    if (groups.length) {
      this.chain++;
      if (this.chain === 1) { this.chaining = true; this.chainTotal = 0; this.chainSent = 0; this.emit('chainStart'); }
      const s = stepScore(this.chain, groups, this.cells);
      const bonus = this.chain === 1 && this.allClearBonus ? ALL_CLEAR_BONUS : 0;
      if (bonus) this.allClearBonus = false;
      this.score += s.score + bonus;
      const target = ctx.target ?? TARGET_POINTS;
      const points = s.score + bonus + this.leftover;
      const made = Math.floor(points / target);
      this.leftover = points - made * target;
      let send = made;
      let offset = 0;
      if (send > 0 && this.incoming > 0) {
        offset = Math.min(send, this.incoming);
        this.incoming -= offset;
        send -= offset;
        this.stats.offsets++;
        this.stats.offsetAmount += offset;
      }
      this.chainTotal += made;
      this.chainSent += send;
      const cellsSet = new Set(groups.flat());
      const garbage = adjacentGarbage(this.cells, groups);
      this.popping = { cells: cellsSet, garbage, chain: this.chain };
      this.stats.popped += s.puyos;
      this.stats.maxColors = Math.max(this.stats.maxColors, s.colors);
      for (const g of groups) this.stats.maxGroup = Math.max(this.stats.maxGroup, g.length);
      this.state = 'pop';
      this.timer = this.t.popFrames;
      const colors = groups.map(g => this.cells[g[0]]);
      this.emit('pop', { chain: this.chain, score: s.score, bonus, puyos: s.puyos, colors, groups: groups.map(g => g.slice()), made, send, offset, garbage: garbage.length });
      if (send > 0) this.emit('send', { amount: send });
      if (offset > 0) this.emit('offset', { amount: offset });
      return;
    }
    if (this.chain > 0) {
      const chain = this.chain;
      this.lastChain = chain;
      this.stats.maxChain = Math.max(this.stats.maxChain, chain);
      this.stats.chains[chain] = (this.stats.chains[chain] || 0) + 1;
      this.stats.garbageSent += this.chainSent;
      this.stats.maxAttack = Math.max(this.stats.maxAttack, this.chainTotal);
      this.chain = 0;
      this.chaining = false;
      const allClear = isEmpty(this.cells);
      if (allClear) { this.allClearBonus = true; this.stats.allClears++; }
      this.emit('chainEnd', { chain, made: this.chainTotal, sent: this.chainSent, allClear });
      if (allClear) this.emit('allClear');
    }
    // 방해뿌요는 조각을 놓고 내 연쇄가 끝난 뒤, 상대 연쇄도 끝났을 때만 떨어진다
    if (this.incoming > 0 && ctx.canReceive !== false) {
      this.dropGarbage(Math.min(this.incoming, MAX_GARBAGE_DROP));
      return;
    }
    this.state = 'spawn';
    this.timer = this.t.spawnDelay;
  }

  clearPopped() {
    const { cells, garbage } = this.popping;
    for (const j of cells) this.cells[j] = EMPTY;
    for (const j of garbage) this.cells[j] = EMPTY;
    this.popping = null;
    const moves = applyGravity(this.cells);
    this.refreshHeights();
    this.falling = moves.map(m => ({ x: m.x, to: m.to, y: m.from, v: 0.1, color: m.v }));
    this.state = 'settle';
    this.after = 'chain';
  }

  dropGarbage(count) {
    this.incoming -= count;
    this.stats.garbageTaken += count;
    const rows = Math.floor(count / W), rest = count % W;
    const extra = new Set(shuffle([0, 1, 2, 3, 4, 5], this.garbageRandom).slice(0, rest));
    this.falling = [];
    for (let x = 0; x < W; x++) {
      const n = rows + (extra.has(x) ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const to = this.h[x];
        if (to >= VANISH_ROW) break;
        this.cells[idx(x, to)] = GARBAGE;
        this.h[x]++;
        this.falling.push({ x, to, y: VANISH_ROW + 1 + k, v: 0.2, color: GARBAGE });
      }
    }
    this.emit('garbage', { count });
    this.state = 'garbage';
  }

  // 방해뿌요 받기 (상쇄는 check 안에서 처리)
  receive(amount) {
    if (amount > 0) { this.incoming += amount; this.emit('incoming', { amount }); }
  }

  danger() {
    return this.h[2] >= 9 || this.h[3] >= 10 || this.h[1] >= 10;
  }
}
