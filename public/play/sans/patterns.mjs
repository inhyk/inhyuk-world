// SANS · 심판의 회랑 — 탄막 패턴 (DOM 없음)
// 패턴은 { dur, box: { w, h }, soul: 'red' | 'blue', setup?(c), tick(c) } 이고, 탄막은 함수가 없는 순수 데이터다.
// c: { t, dt, dur, B, memo, soul, rand(), spawn(탄막), fx(효과음), slam(방향, 속도), soulMode(색), place(x, y), cut(), box(w, h) }
//   B 는 상자의 목표 경계 { l, r, t, b, cx, cy, w, h }. 시간은 모두 패턴 시간(초)이며 난이도 템포가 곱해져 흐른다.

const PI = Math.PI, TAU = PI * 2;
const SIDE = { down: 'bottom', up: 'top', left: 'left', right: 'right' };
const DIRS = ['down', 'left', 'up', 'right'];

// 일정 간격으로 fn(n, 예정 시각) 을 부른다. from 부터 to 직전까지.
function every(c, key, interval, fn, from = 0, to = Infinity) {
  const k = 'e:' + key; let n = c.memo[k] || 0;
  for (;;) { const when = from + n * interval; if (when > c.t || when >= to) break; fn(n, when); n++; }
  c.memo[k] = n;
}
function at(c, key, time, fn) { const k = 'a:' + key; if (!c.memo[k] && c.t >= time) { c.memo[k] = 1; fn(); } }
// 주기 1의 삼각파. 0에서 시작해 위로 올라간다. 범위 -1 ~ 1.
const tri = x => 1 - 4 * Math.abs((((x + .25) % 1) + 1) % 1 - .5);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- 탄막 만들기 ----------
// 세로 뼈: 바닥이나 천장에 붙어 옆으로 흘러간다.
export function vbone(c, { x, len, from = 'bottom', vx = 0, color = 'white', ttl = 5 }) {
  const B = c.B;
  return c.spawn({ kind: 'bone', x, y: from === 'bottom' ? B.b - len / 2 : B.t + len / 2, w: 10, h: len, vx, color, ttl });
}
// 가로 뼈: 왼쪽이나 오른쪽 벽에 붙어 위아래로 흘러간다.
export function hbone(c, { y, len, from = 'left', vy = 0, color = 'white', ttl = 5 }) {
  const B = c.B;
  return c.spawn({ kind: 'bone', x: from === 'left' ? B.l + len / 2 : B.r - len / 2, y, w: len, h: 10, vy, color, ttl });
}
// 틈이 하나 뚫린 뼈 기둥
export function gapBones(c, { x, gapY, gap, vx, ttl = 4 }) {
  const B = c.B, top = gapY - gap / 2, bottom = gapY + gap / 2;
  if (top - B.t > 4) c.spawn({ kind: 'bone', x, y: (B.t + top) / 2, w: 10, h: top - B.t, vx, ttl });
  if (B.b - bottom > 4) c.spawn({ kind: 'bone', x, y: (bottom + B.b) / 2, w: 10, h: B.b - bottom, vx, ttl });
}
// 벽에서 솟는 뼈 가시: 빨간 경고 → 솟구침 → 잠깐 머묾 → 들어감
export function stab(c, { side, depth = 30, warn = .55, hold = .2 }) {
  return c.spawn({ kind: 'stab', side, depth, warnT: warn, hold, cur: 0, ttl: warn + hold + .4 });
}
// 가스터 블래스터: (x, y) 로 날아와 자리를 잡고 ang 방향으로 빔을 쏜 뒤 뒤로 밀려나며 사라진다.
export function blaster(c, { x, y, ang, size = 1, delay = .72, hold = .3 }) {
  const B = c.B, ox = x - B.cx, oy = y - B.cy, n = Math.hypot(ox, oy) || 1;
  c.fx('gbIn'); c.glow(delay + hold);
  return c.spawn({ kind: 'gb', x: x + ox / n * 190, y: y + oy / n * 190, tx: x, ty: y, sx: x + ox / n * 190, sy: y + oy / n * 190, ang, size, delay, hold, half: 0, ttl: delay + hold + .45 });
}
const gbV = (c, x, o = {}) => blaster(c, { x, y: o.bottom ? c.B.b + 38 : c.B.t - 38, ang: o.bottom ? -PI / 2 : PI / 2, ...o });
const gbH = (c, y, o = {}) => blaster(c, { x: o.left === false ? c.B.r + 38 : c.B.l - 38, y, ang: o.left === false ? PI : 0, ...o });
const aim = (c, x, y, tx, ty, o = {}) => blaster(c, { x, y, ang: Math.atan2(ty - y, tx - x), ...o });
// 상자 둘레의 한 점에서 상자 한가운데를 겨눈다
const ring = (c, a, o = {}) => { const B = c.B, r = B.w / 2 + 54; return blaster(c, { x: B.cx + Math.cos(a) * r, y: B.cy + Math.sin(a) * r, ang: a + PI, ...o }); };
const slamStab = (c, dir, o = {}) => { c.slam(dir, o.speed); stab(c, { side: SIDE[dir], ...o }); };
// 같은 방향이 연달아 나오지 않는 내리꽂기 순서
function slamOrder(c, count, first = null) {
  const out = []; let prev = first;
  for (let i = 0; i < count; i++) { let d; do d = DIRS[Math.floor(c.rand() * 4)]; while (d === prev); out.push(d); prev = d; }
  return out;
}
// 물결치는 틈을 가진 뼈 통로
function corridor(c, key, { from, to, right = true, speed, step, gap, wave }) {
  const B = c.B;
  every(c, key, step, (n, when) => gapBones(c, { x: right ? B.r + 14 : B.l - 14, gapY: B.cy + wave(when - from), gap, vx: right ? -speed : speed }), from, to);
}

// ---------- 공격 순서 ----------
export const ORDER = {
  p1: ['hops', 'combs', 'blueMix', 'grid', 'platforms', 'slamBox'],
  p2: ['teleCuts', 'spiral', 'platformsHard', 'juggle', 'storm', 'chase'],
  fill1: ['fillBones', 'fillGaps', 'fillBeams'],
  fill2: ['fillSlam', 'fillRush', 'fillAim'],
};

export const PATTERNS = {
  // 싸움이 시작되자마자 날아오는 첫 공격. 내리꽂기 → 물결 통로 → 블래스터 네 번.
  opening: { dur: 8.9, box: { w: 260, h: 150 }, soul: 'blue',
    tick(c) {
      const B = c.B, s = c.soul;
      at(c, 'slam', .05, () => slamStab(c, 'down', { warn: .62 }));
      at(c, 'red', 1.3, () => c.soulMode('red'));
      corridor(c, 'wave', { from: 1.45, to: 4.25, speed: 250, step: .1, gap: 50, wave: t => Math.sin(t * 3.3) * (B.h / 2 - 36) });
      at(c, 'v1', 4.75, () => { gbV(c, B.cx - 65); gbV(c, B.cx + 65); gbH(c, B.cy - 40); gbH(c, B.cy + 40, { left: false }); });
      at(c, 'v2', 5.65, () => { aim(c, B.l - 30, B.t - 30, B.cx, B.cy); aim(c, B.r + 30, B.t - 30, B.cx, B.cy); });
      at(c, 'v3', 6.55, () => { gbV(c, B.cx, { size: 2 }); gbH(c, B.cy, { size: 2 }); });
      at(c, 'v4', 7.45, () => { aim(c, B.cx, B.t - 38, s.x, s.y); aim(c, B.l - 38, B.cy, s.x, s.y); aim(c, B.r + 38, B.cy, s.x, s.y); });
    } },

  // ---------- 1막 ----------
  // 높이가 다른 뼈를 뛰어넘는다.
  hops: { dur: 7.4, box: { w: 340, h: 140 }, soul: 'blue',
    tick(c) {
      const B = c.B, heights = [24, 40, 24, 54, 30, 46, 24, 58];
      every(c, 'b', .78, n => {
        vbone(c, { x: B.r + 12, len: heights[n % heights.length], vx: -190 });
        if (n % 3 === 2) vbone(c, { x: B.r + 52, len: 22, vx: -190 });
      }, .5, c.dur - 2.2);
    } },
  // 틈 뚫린 뼈 기둥이 오른쪽에서 네 장, 왼쪽에서 네 장.
  combs: { dur: 8.3, box: { w: 280, h: 140 }, soul: 'red',
    tick(c) {
      const B = c.B, m = c.memo;
      const next = () => { if (m.y === undefined) m.y = B.cy; let y; do y = m.y + (c.rand() < .5 ? -1 : 1) * (28 + c.rand() * 32); while (y < B.t + 30 || y > B.b - 30); return (m.y = y); };
      every(c, 'r', .72, () => gapBones(c, { x: B.r + 14, gapY: next(), gap: 46, vx: -210 }), .5, .5 + .72 * 4 - .01);
      every(c, 'l', .72, () => gapBones(c, { x: B.l - 14, gapY: next(), gap: 46, vx: 210 }), 4.5, 4.5 + .72 * 4 - .01);
    } },
  // 흰 뼈는 넘고, 파란 뼈가 지나갈 때는 가만히 선다.
  blueMix: { dur: 8, box: { w: 340, h: 140 }, soul: 'blue',
    tick(c) {
      const B = c.B, plan = [[.5, 'w'], [1.35, 'b'], [2.05, 'w'], [2.8, 'w'], [3.7, 'b'], [4.3, 'b'], [5.1, 'w'], [6, 'b']];
      plan.forEach(([when, kind], i) => at(c, 'm' + i, when, () => vbone(c, kind === 'w' ? { x: B.r + 12, len: 30, vx: -200 } : { x: B.r + 12, len: B.h, vx: -200, color: 'blue' })));
    } },
  // 블래스터가 격자로 쏜다. 빔 사이 칸이 안전하다.
  grid: { dur: 7.3, box: { w: 220, h: 180 }, soul: 'red',
    tick(c) {
      const B = c.B, s = c.soul;
      at(c, 'v0', .45, () => { gbV(c, B.cx - 55); gbV(c, B.cx + 55); });
      at(c, 'v1', 1.5, () => { gbH(c, B.cy - 45); gbH(c, B.cy + 45, { left: false }); });
      at(c, 'v2', 2.55, () => { gbV(c, B.cx, { size: 2 }); gbH(c, B.cy); });
      at(c, 'v3', 3.6, () => { aim(c, B.l - 30, B.t - 30, B.cx, B.cy); aim(c, B.r + 30, B.t - 30, B.cx, B.cy); });
      at(c, 'v4', 4.65, () => { gbV(c, B.cx - 28); gbV(c, B.cx + 28); gbH(c, B.cy - 28); gbH(c, B.cy + 28, { left: false }); });
      at(c, 'v5', 5.7, () => { aim(c, B.cx, B.t - 38, s.x, s.y); aim(c, B.l - 38, B.cy, s.x, s.y); aim(c, B.r + 38, B.cy, s.x, s.y); });
    } },
  // 바닥은 뼈 바다. 왼쪽으로 흘러가는 발판을 갈아타며 버틴다.
  platforms: { dur: 9.2, box: { w: 360, h: 150 }, soul: 'blue',
    setup(c) {
      const B = c.B;
      for (let k = 0; k < 10; k++) c.spawn({ kind: 'plat', x: B.cx + k * 110, y: k % 2 ? B.b - 84 : B.b - 48, w: 66, vx: -80, ttl: 99 });
      c.spawn({ kind: 'sea', depth: 20, warnT: .9, until: c.dur - .5, cur: 0, ttl: 99 });
      c.place(B.cx, B.b - 56);
    },
    tick(c) {
      const B = c.B;
      every(c, 'top', 2.3, () => vbone(c, { x: B.r + 12, len: 36, from: 'top', vx: -150 }), 3.2, c.dur - 2.6);
    } },
  // 네 벽으로 차례차례 내리꽂힌다. 벽에 닿자마자 뛰어야 가시를 피한다.
  slamBox: { dur: 7.6, box: { w: 200, h: 200 }, soul: 'blue',
    tick(c) {
      const order = ['down', 'left', 'up', 'right', 'down'];
      every(c, 's', 1.45, n => slamStab(c, order[n], { depth: n < 2 ? 30 : 36, warn: .62 }), .35, .35 + 1.45 * 5 - .01);
    } },

  // ---------- 2막 ----------
  // 화면이 깜빡일 때마다 전혀 다른 공격으로 바뀐다.
  teleCuts: { dur: 9.4, box: { w: 240, h: 150 }, soul: 'blue',
    tick(c) {
      const B = c.B;
      at(c, 'a0', .05, () => slamStab(c, 'down', { warn: .5 }));
      at(c, 'a1', .95, () => vbone(c, { x: B.r + 12, len: 30, vx: -260 }));
      at(c, 'a2', 1.2, () => vbone(c, { x: B.l - 12, len: 30, vx: 260 }));
      at(c, 'cutB', 1.75, () => { c.cut(); c.soulMode('red'); c.place(B.cx, B.cy); });
      at(c, 'b0', 1.85, () => { aim(c, B.l - 30, B.t - 30, B.cx, B.cy, { delay: .62 }); aim(c, B.r + 30, B.t - 30, B.cx, B.cy, { delay: .62 }); });
      at(c, 'b1', 2.45, () => { gbV(c, B.cx - 50, { delay: .62 }); gbV(c, B.cx + 50, { delay: .62 }); });
      at(c, 'cutC', 3.5, () => { c.cut(); c.place(B.cx, B.cy); slamStab(c, 'left', { warn: .5 }); });
      at(c, 'c1', 4.3, () => hbone(c, { y: B.t - 12, len: 30, from: 'left', vy: 250 }));
      at(c, 'c2', 4.75, () => hbone(c, { y: B.b + 12, len: 30, from: 'left', vy: -250 }));
      at(c, 'cutD', 5.35, () => { c.cut(); c.soulMode('red'); c.place(B.cx, B.cy); });
      at(c, 'd0', 5.45, () => gapBones(c, { x: B.r + 14, gapY: B.cy - 30, gap: 46, vx: -280 }));
      at(c, 'd1', 5.95, () => gapBones(c, { x: B.l - 14, gapY: B.cy + 30, gap: 46, vx: 280 }));
      at(c, 'd2', 6.45, () => gapBones(c, { x: B.r + 14, gapY: B.cy - 10, gap: 46, vx: -280 }));
      at(c, 'cutE', 7.3, () => { c.cut(); c.place(B.cx, B.cy); c.slam('down'); });
      at(c, 'e0', 7.4, () => { vbone(c, { x: B.l - 12, len: 30, vx: 230 }); vbone(c, { x: B.r + 12, len: 30, vx: -230 }); });
      at(c, 'e1', 8.1, () => gbH(c, B.b - 14, { delay: .62, hold: .28 }));
    } },
  // 블래스터가 시곗바늘처럼 돌아가며 한가운데를 쏜다. 중간에 도는 방향이 바뀐다.
  spiral: { dur: 8.4, box: { w: 190, h: 190 }, soul: 'red',
    setup(c) { c.memo.a0 = c.rand() * TAU; c.place(c.B.cx, c.B.cy + 55); },
    tick(c) {
      every(c, 's', .34, n => ring(c, c.memo.a0 + (n < 12 ? n : 24 - n) * .56, { size: n % 5 === 4 ? 2 : 1, delay: .64, hold: .22 }), .4, .4 + .34 * 20 - .01);
    } },
  // 발판 두 줄이 서로 반대로 흐르고, 블래스터가 한 줄씩 쓸어 버린다.
  platformsHard: { dur: 9, box: { w: 360, h: 160 }, soul: 'blue',
    setup(c) {
      const B = c.B, low = B.b - 46, high = B.b - 94;
      for (let k = -1; k < 10; k++) c.spawn({ kind: 'plat', x: B.cx + k * 124, y: low, w: 62, vx: -95, ttl: 99 });
      for (let k = -1; k < 10; k++) c.spawn({ kind: 'plat', x: B.cx + 62 - k * 124, y: high, w: 62, vx: 95, ttl: 99 });
      c.spawn({ kind: 'sea', depth: 20, warnT: .9, until: c.dur - .5, cur: 0, ttl: 99 });
      c.place(B.cx, low - 8);
    },
    tick(c) {
      const B = c.B, rows = [B.b - 54, B.b - 102];
      every(c, 'beam', 2.1, n => gbH(c, rows[n % 2], { left: n % 2 === 0, delay: .95, hold: .3 }), 2.2, c.dur - 2.4);
    } },
  // 점점 빨라지는 내리꽂기 여덟 번. 방향은 매번 다르다.
  juggle: { dur: 8.2, box: { w: 200, h: 200 }, soul: 'blue',
    setup(c) { c.memo.order = slamOrder(c, 8); },
    tick(c) {
      [.35, 1.45, 2.5, 3.5, 4.45, 5.35, 6.2, 7].forEach((when, i) => at(c, 'j' + i, when, () => slamStab(c, c.memo.order[i], { warn: .46, hold: .18 })));
    } },
  // 빠른 뼈 통로. 한 번은 오른쪽에서, 한 번은 왼쪽에서.
  storm: { dur: 8.9, box: { w: 300, h: 150 }, soul: 'red',
    tick(c) {
      const amp = c.B.h / 2 - 34;
      corridor(c, 'a', { from: .4, to: 3.7, speed: 300, step: .085, gap: 46, wave: t => tri(t / 1.5) * amp });
      corridor(c, 'b', { from: 4.85, to: 7.6, right: false, speed: 300, step: .085, gap: 44, wave: t => tri(t / 1.3) * amp });
    } },
  // 블래스터가 영혼을 겨누고, 가끔은 가려는 곳까지 미리 겨눈다.
  chase: { dur: 8, box: { w: 240, h: 170 }, soul: 'red',
    setup(c) { c.memo.a0 = c.rand() * TAU; },
    tick(c) {
      const B = c.B, s = c.soul, spot = a => [B.cx + Math.cos(a) * (B.w / 2 + 48), B.cy + Math.sin(a) * (B.h / 2 + 48)];
      every(c, 'c', .52, n => {
        const a = c.memo.a0 + n * 2.4, [x, y] = spot(a), o = { size: n % 4 === 3 ? 2 : 1, delay: .62, hold: .2 };
        aim(c, x, y, s.x, s.y, o);
        if (n % 2) { const [x2, y2] = spot(a + PI / 2); aim(c, x2, y2, clamp(s.x + (s.velX || 0) * .45, B.l + 10, B.r - 10), clamp(s.y + (s.velY || 0) * .45, B.t + 10, B.b - 10), { delay: .62, hold: .2 }); }
      }, .4, 6.7);
    } },

  // ---------- 특별 공격 ----------
  // 내리꽂기 연타 → 빠른 통로 → 점점 빨라지는 블래스터 소용돌이 → 힘이 빠진 내리꽂기.
  special: { dur: 22.6, box: { w: 200, h: 200 }, soul: 'blue',
    setup(c) {
      c.memo.order = slamOrder(c, 8); c.memo.a0 = c.rand() * TAU;
      const times = []; let when = 13.15; for (let i = 0; i < 20; i++) { times.push(when); when += .34 - i * .006; }
      c.memo.times = times;
    },
    tick(c) {
      const B = c.B, m = c.memo;
      for (let i = 0; i < 8; i++) at(c, 's' + i, .35 + i * .78, () => slamStab(c, m.order[i], { warn: .42, hold: .16 }));
      at(c, 'cut2', 6.75, () => { c.cut(); c.box(300, 150); c.soulMode('red'); c.place(320, 315); });
      if (c.t >= 7 && c.t < 12.9) {
        const amp = B.h / 2 - 34;
        corridor(c, 'c1', { from: 7, to: 9.5, speed: 320, step: .08, gap: 44, wave: t => tri(t / 1.3) * amp });
        corridor(c, 'c2', { from: 10.6, to: 11.8, right: false, speed: 320, step: .08, gap: 44, wave: t => tri(t / 1.3) * amp });
      }
      at(c, 'cut3', 12.9, () => { c.cut(); c.box(200, 200); c.soulMode('red'); c.place(320, 345); });
      if (c.t >= 13.1) m.times.forEach((when, i) => at(c, 'g' + i, when, () => ring(c, m.a0 + i * PI / 6, { size: i % 6 === 5 ? 2 : 1, delay: .64, hold: .22 })));
      at(c, 'cut4', 19.9, () => { c.cut(); c.place(320, 290); c.slam('down', 700); });
      at(c, 'w1', 20.7, () => c.slam('left', 500));
      at(c, 'w2', 21.3, () => c.slam('right', 350));
      at(c, 'w3', 21.9, () => c.slam('down', 220));
    } },
  // 아무것도 하지 않는다. 그게 전부다. (끝나지 않는 차례)
  nothing: { dur: Infinity, endless: true, box: { w: 120, h: 110 }, soul: 'red', tick() {} },
  // 자비를 받아들이면 돌아오는 것.
  dunk: { dur: 6, box: { w: 200, h: 200 }, soul: 'blue',
    tick(c) {
      at(c, 'slam', .05, () => c.slam('down'));
      at(c, 'cage', .5, () => { for (const side of ['bottom', 'top', 'left', 'right']) stab(c, { side, depth: 104, warn: 0, hold: 9 }); c.fx('dunk'); });
    } },

  // ---------- 공격하지 않은 차례에 나오는 짧은 공격 ----------
  fillBones: { dur: 4.8, box: { w: 320, h: 140 }, soul: 'blue',
    tick(c) { const B = c.B; every(c, 'b', .8, n => vbone(c, { x: n % 2 ? B.l - 12 : B.r + 12, len: [26, 40, 30, 48][n % 4], vx: n % 2 ? 190 : -190 }), .45, 2.9); } },
  fillGaps: { dur: 4.9, box: { w: 280, h: 140 }, soul: 'red',
    tick(c) {
      const B = c.B, m = c.memo;
      every(c, 'g', .75, () => { if (m.y === undefined) m.y = B.cy; let y; do y = m.y + (c.rand() < .5 ? -1 : 1) * (26 + c.rand() * 30); while (y < B.t + 32 || y > B.b - 32); m.y = y; gapBones(c, { x: B.r + 14, gapY: y, gap: 50, vx: -220 }); }, .45, .45 + .75 * 4 - .01);
    } },
  fillBeams: { dur: 4.3, box: { w: 220, h: 180 }, soul: 'red',
    tick(c) {
      const B = c.B;
      at(c, 'v0', .4, () => { gbV(c, B.cx - 50); gbV(c, B.cx + 50); });
      at(c, 'v1', 1.5, () => { gbH(c, B.cy - 40); gbH(c, B.cy + 40, { left: false }); });
      at(c, 'v2', 2.6, () => { gbV(c, B.cx); gbH(c, B.cy); });
    } },
  fillSlam: { dur: 4.1, box: { w: 200, h: 200 }, soul: 'blue',
    setup(c) { c.memo.order = slamOrder(c, 3); },
    tick(c) { [.35, 1.5, 2.65].forEach((when, i) => at(c, 'f' + i, when, () => slamStab(c, c.memo.order[i], { warn: .5 }))); } },
  fillRush: { dur: 4.2, box: { w: 300, h: 150 }, soul: 'red',
    tick(c) { const amp = c.B.h / 2 - 36; corridor(c, 'r', { from: .4, to: 2.8, speed: 290, step: .09, gap: 48, wave: t => tri(t / 1.5) * amp }); } },
  fillAim: { dur: 4.1, box: { w: 240, h: 170 }, soul: 'red',
    setup(c) { c.memo.a0 = c.rand() * TAU; },
    tick(c) {
      const B = c.B, s = c.soul;
      every(c, 'a', .55, n => { const a = c.memo.a0 + n * 2.4; aim(c, B.cx + Math.cos(a) * (B.w / 2 + 48), B.cy + Math.sin(a) * (B.h / 2 + 48), s.x, s.y, { delay: .62, hold: .2 }); }, .4, .4 + .55 * 5 - .01);
    } },
};
