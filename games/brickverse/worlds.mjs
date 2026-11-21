// 세계 모양(부품 목록)을 만든다. three.js 없이 숫자만 만들어서 node 로 시험할 수 있다.
// 부품: { x, y, z (가운데), w, h, d (크기), c (색), k (종류), m (재질), shape, move, spin, cp, deco (안 부딪힘), hidden (안 그림) }
import { OBBY_STAGES, seeded, SURVIVAL, TOWER, EGG_ZONES, EGG_TREADS } from './core.mjs';

export function hsl(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  const hex = x => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

const FWD = [[0, 1], [1, 0], [0, -1], [-1, 0]];

// 방향(heading)을 가진 작은 건축가. f = 앞, r = 오른쪽, 높이는 원점 기준.
export class Builder {
  constructor(out, o = [0, 0, 0], heading = 0) {
    this.out = out; this.o = o; this.h = ((heading % 4) + 4) % 4;
    const [fx, fz] = FWD[this.h];
    this.F = [fx, fz]; this.R = [-fz, fx];
  }
  pt(f, r) { return [this.o[0] + this.F[0] * f + this.R[0] * r, this.o[2] + this.F[1] * f + this.R[1] * r]; }
  vec([cf, cr]) { return [this.F[0] * cf + this.R[0] * cr, this.F[1] * cf + this.R[1] * cr]; }
  box(f, r, yc, w, h, d, extra = {}) {
    const [x, z] = this.pt(f, r);
    const odd = this.h % 2 === 1;
    const p = { ...extra, x, y: this.o[1] + yc, z, w: odd ? d : w, h, d: odd ? w : d };
    if (extra.move) p.move = this.mv(extra.move);
    if (extra.cv) p.cv = this.vec(extra.cv);
    if (extra.ry !== undefined) p.ry = extra.ry + this.yaw();
    this.out.push(p);
    return p;
  }
  // 윗면이 t 인 발판
  plat(f, r, t, w, d, extra = {}) { const h = extra.h ?? 1; return this.box(f, r, t - h / 2, w, h, d, extra); }
  mv({ ax, amp, spd, ph = 0 }) {
    if (ax === 'y') return { ax: 'y', amp, spd, ph };
    const v = ax === 'f' ? this.F : this.R;
    return { ax: v[0] !== 0 ? 'x' : 'z', amp: amp * (v[0] || v[1]), spd, ph };
  }
  yaw() { return Math.atan2(this.F[0], this.F[1]); }
  world(f, r, t) { const [x, z] = this.pt(f, r); return [x, this.o[1] + t, z]; }
}

// ───────────────────────── 광장 ─────────────────────────

export const PORTALS = [
  { id: 'obby', world: 1, name: '무지개 점프 탑', sub: '30 스테이지 점프맵', color: '#ff5e7e', icon: '🌈' },
  { id: 'tycoon', world: 2, name: '블록 공장 타이쿤', sub: '돈 모아서 집 짓기', color: '#ffb820', icon: '🏭' },
  { id: 'survival', world: 3, name: '바닥이 사라져요', sub: '끝까지 살아남기', color: '#9b5cff', icon: '🔥' },
  { id: 'tower', world: 4, name: '하늘 타워 짓기', sub: '블록으로 높이높이', color: '#21c7b8', icon: '🏗️' },
  { id: 'battle', world: 5, name: '블록 배틀 로얄', sub: '블래스터로 끝까지', color: '#ff5e3a', icon: '🎯' },
  { id: 'tag', world: 6, name: '술래잡기', sub: '술래잡기 · 숨바꼭질', color: '#ff8fc7', icon: '🏃' },
  { id: 'egg', world: 7, name: '달걀 도둑', sub: '알 훔쳐서 부화시키기', color: '#ffcf33', icon: '🥚' },
  { id: 'camp', world: 8, name: '모닥불 캠프', sub: '99일 동안 살아남기', color: '#ff7a3d', icon: '🔥' },
];

function tree(out, x, z, rnd, scale = 1, y0 = 0) {
  const type = Math.floor(rnd() * 3);
  const s = scale * (0.85 + rnd() * 0.4);
  const start = out.length;
  out.push({ x, y: 1.6 * s, z, w: 0.9 * s, h: 3.2 * s, d: 0.9 * s, c: '#8b5a3c', m: 'wood' });
  const leaf = ['#4fbf5a', '#3faa55', '#6ccf4f', '#2f9d63'][Math.floor(rnd() * 4)];
  if (type === 0) {
    out.push({ x, y: 4.2 * s, z, w: 3.6 * s, h: 2.4 * s, d: 3.6 * s, c: leaf, deco: true, round: 0.5 * s });
    out.push({ x: x + 0.3 * s, y: 5.7 * s, z: z - 0.2 * s, w: 2.4 * s, h: 1.6 * s, d: 2.4 * s, c: leaf, deco: true, round: 0.4 * s });
  } else if (type === 1) {
    out.push({ x, y: 4.4 * s, z, w: 4 * s, h: 3.4 * s, d: 4 * s, c: leaf, shape: 'sphere', deco: true });
    out.push({ x: x + 0.9 * s, y: 5.6 * s, z: z + 0.5 * s, w: 2.4 * s, h: 2.2 * s, d: 2.4 * s, c: leaf, shape: 'sphere', deco: true });
  } else {
    const pine = '#2f8f5a';
    out.push({ x, y: 4.0 * s, z, w: 4 * s, h: 3 * s, d: 4 * s, c: pine, shape: 'cone', deco: true });
    out.push({ x, y: 5.6 * s, z, w: 3 * s, h: 2.6 * s, d: 3 * s, c: pine, shape: 'cone', deco: true });
    out.push({ x, y: 7.0 * s, z, w: 2 * s, h: 2 * s, d: 2 * s, c: pine, shape: 'cone', deco: true });
  }
  if (y0) for (let i = start; i < out.length; i++) out[i].y += y0;
}

function flowers(out, x, z, w, d, rnd, y0 = 0) {
  const start = out.length;
  out.push({ x, y: 0.2, z, w: w + 0.6, h: 0.4, d: d + 0.6, c: '#9c6b46', m: 'wood' });
  out.push({ x, y: 0.42, z, w, h: 0.1, d, c: '#6b4a2f', m: 'matte', deco: true });
  const cols = ['#ff5e7e', '#ffd23f', '#ff9de0', '#ffffff', '#b38cff', '#ff8a3d'];
  for (let i = 0; i < w * d * 0.9; i++) {
    const fx = x + (rnd() - 0.5) * (w - 0.4), fz = z + (rnd() - 0.5) * (d - 0.4);
    out.push({ x: fx, y: 0.75, z: fz, w: 0.07, h: 0.6, d: 0.07, c: '#3e9a48', deco: true, shadow: false, round: 0 });
    out.push({ x: fx, y: 1.08, z: fz, w: 0.34, h: 0.26, d: 0.34, c: cols[Math.floor(rnd() * cols.length)], shape: 'sphere', deco: true, shadow: false });
  }
  if (y0) for (let i = start; i < out.length; i++) out[i].y += y0;
}

function lamp(out, x, z, y0 = 0) {
  const start = out.length;
  out.push({ x, y: 2.2, z, w: 0.26, h: 4.4, d: 0.26, c: '#3a3f4b', m: 'metal', shape: 'cyl' });
  out.push({ x, y: 0.15, z, w: 0.8, h: 0.3, d: 0.8, c: '#3a3f4b', m: 'metal', shape: 'cyl', deco: true });
  out.push({ x, y: 4.6, z, w: 0.7, h: 0.7, d: 0.7, c: '#fff1b8', m: 'neon', shape: 'sphere', deco: true, shadow: false });
  out.push({ x, y: 5.0, z, w: 0.9, h: 0.16, d: 0.9, c: '#3a3f4b', m: 'metal', shape: 'cyl', deco: true });
  if (y0) for (let i = start; i < out.length; i++) out[i].y += y0;
}

function bench(out, x, z, alongX) {
  const w = alongX ? 3.4 : 1.1, d = alongX ? 1.1 : 3.4;
  out.push({ x, y: 0.75, z, w, h: 0.22, d, c: '#c98a4b', m: 'wood' });
  for (const s of [-1, 1]) out.push({ x: x + (alongX ? s * 1.4 : 0), y: 0.32, z: z + (alongX ? 0 : s * 1.4), w: alongX ? 0.2 : 0.9, h: 0.64, d: alongX ? 0.9 : 0.2, c: '#3a3f4b', m: 'metal', deco: true });
}

// 크리스마스 트리: 둥근 눈 받침 + 빙 둘러싼 지팡이 사탕 울타리, 줄기, 뾰족뾰족한 잎 6층, 장식 공, 불빛, 꼭대기 별, 선물
export const XMAS = { top: 33.5, ring: 9.4 };
function xmasTree(out, effects, x, z) {
  out.push({ x, y: 0.3, z, w: 20, h: 0.36, d: 20, c: '#ffffff', m: 'matte', shape: 'cyl' });
  out.push({ x, y: 0.5, z, w: 18.2, h: 0.06, d: 18.2, c: '#eef6ff', m: 'cloud', shape: 'cyl', deco: true, shadow: false });
  const R = XMAS.ring, N = 32;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, b = ((i + 0.5) / N) * Math.PI * 2;
    out.push({ x: x + Math.cos(a) * R, y: 1.05, z: z + Math.sin(a) * R, w: 0.34, h: 1.1, d: 0.34, c: i % 2 ? '#ff3b4e' : '#ffffff', shape: 'cyl', deco: true });
    out.push({ x: x + Math.cos(a) * R, y: 1.68, z: z + Math.sin(a) * R, w: 0.42, h: 0.42, d: 0.42, c: '#ffd23f', m: 'gold', shape: 'sphere', deco: true, shadow: false });
    out.push({ x: x + Math.cos(b) * R, y: 1.3, z: z + Math.sin(b) * R, w: 0.16, h: 0.16, d: (2 * Math.PI * R) / N, c: i % 2 ? '#ffffff' : '#ff3b4e', ry: -b, deco: true, shadow: false });
  }
  out.push({ x, y: 3.4, z, w: 2.6, h: 6, d: 2.6, c: '#7a4a2a', m: 'wood', shape: 'cyl' });
  const layers = 6, y0 = 5.6, top = XMAS.top - 3;
  const greens = ['#2f8f5a', '#277a4d', '#2f9d63', '#26804f', '#33a16a', '#2a8a55'];
  const balls = ['#ff3b4e', '#ffd23f', '#3fa7ff', '#ff8fc7', '#ffffff', '#b38cff'];
  for (let i = 0; i < layers; i++) {
    const k = i / (layers - 1);
    const w = 18 - k * 13, h = 7.2 - k * 2.2, yb = y0 + k * (top - y0 - 5);
    out.push({ x, y: yb + h / 2, z, w, h, d: w, c: greens[i], shape: 'fir', deco: true });
    // 층마다 아래 끝에 동그란 장식
    const n = 9 - i, r = (w / 2) * 0.82;
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2 + i * 0.7, c = balls[(i + j) % balls.length];
      out.push({ x: x + Math.cos(a) * r, y: yb + 0.15, z: z + Math.sin(a) * r, w: 0.95, h: 0.95, d: 0.95, c, m: c === '#ffd23f' ? 'gold' : 'plastic', shape: 'sphere', deco: true, shadow: false });
      out.push({ x: x + Math.cos(a) * r, y: yb + 0.72, z: z + Math.sin(a) * r, w: 0.08, h: 0.5, d: 0.08, c: '#d9d9d9', deco: true, shadow: false });
    }
  }
  // 빙글빙글 감긴 불빛
  for (let t = 0; t < 1; t += 1 / 90) {
    const yy = y0 + 0.8 + t * (top - y0 - 2), a = t * Math.PI * 2 * 6;
    const r = Math.max(0.6, 8.6 * (1 - (yy - y0) / (top - y0 + 3)));
    out.push({ x: x + Math.cos(a) * r, y: yy, z: z + Math.sin(a) * r, w: 0.36, h: 0.36, d: 0.36, c: ['#fff1b8', '#ff8fc7', '#7df9ff', '#ffd23f'][Math.floor(t * 90) % 4], m: 'neon', shape: 'sphere', deco: true, shadow: false });
  }
  // 꼭대기 별 (천천히 돈다)
  out.push({ x, y: XMAS.top, z, w: 4.2, h: 4.2, d: 1.2, c: '#ffd23f', m: 'neon', shape: 'star', deco: true, turn: { ax: 'y', spd: 0.6 } });
  effects.push({ type: 'sparkle', x, y: XMAS.top, z });
  // 트리 밑 선물
  const gifts = [[3.6, 1.2, 2.2, '#ff3b4e', '#ffd23f'], [-3.4, 2.4, 1.8, '#3fa7ff', '#ffffff'], [1.6, -3.8, 2.0, '#5ad16b', '#ff3b4e'], [-2.6, -3.2, 1.5, '#ffd23f', '#ff3b4e'], [4.6, -2.2, 1.6, '#b38cff', '#ffd23f'], [-4.8, -0.6, 1.4, '#ff8fc7', '#ffffff'], [0.4, 4.6, 1.7, '#ffffff', '#ff3b4e'], [-1.2, 5.6, 1.2, '#21c7b8', '#ffd23f']];
  for (const [dx, dz, s, c, rib] of gifts) {
    const gx = x + dx, gz = z + dz, gy = 0.48 + s / 2;
    out.push({ x: gx, y: gy, z: gz, w: s, h: s, d: s, c, round: 0.08 });
    out.push({ x: gx, y: gy, z: gz, w: s + 0.04, h: s + 0.04, d: s * 0.2, c: rib, deco: true, round: 0.02 });
    out.push({ x: gx, y: gy, z: gz, w: s * 0.2, h: s + 0.04, d: s + 0.04, c: rib, deco: true, round: 0.02 });
    for (const sx of [-1, 1]) out.push({ x: gx + sx * s * 0.16, y: gy + s / 2 + 0.16, z: gz, w: s * 0.3, h: s * 0.22, d: s * 0.18, c: rib, shape: 'sphere', deco: true, shadow: false });
  }
}

// 알 판매: 큰 알이 올라간 가게. 앞에 서면 알 까기 창이 열린다 (src/pets.js)
export const EGG_STAND = { x: 15, z: 22 };
function eggStand(out, zones, effects, x, z) {
  out.push({ x, y: 0.15, z, w: 8, h: 0.3, d: 5.2, c: '#fff6e8', m: 'stone', round: 0.1 });
  out.push({ x, y: 1.2, z: z + 0.6, w: 6.4, h: 1.8, d: 2.2, c: '#ffd9a0', m: 'wood' });
  out.push({ x, y: 2.22, z: z + 0.6, w: 6.8, h: 0.25, d: 2.6, c: '#ffffff', round: 0.08 });
  for (const sx of [-1, 1]) {
    out.push({ x: x + sx * 3.5, y: 3.0, z: z + 1.9, w: 0.3, h: 5.6, d: 0.3, c: '#ffffff', shape: 'cyl' });
  }
  out.push({ x, y: 5.9, z: z + 1.1, w: 7.8, h: 0.3, d: 3.4, c: '#ffb347', m: 'stripes', rx: -0.3, deco: true });
  // 큰 알과 무늬
  out.push({ x, y: 3.85, z: z + 0.6, w: 2.3, h: 3.0, d: 2.3, c: '#fff6e0', shape: 'sphere' });
  for (const [dx, dy, dz, c] of [[-0.9, 0.4, -0.55, '#ff8fc7'], [0.75, 0.9, -0.7, '#7df9ff'], [0.1, -0.2, -1.08, '#ffd23f'], [-0.4, 1.25, -0.6, '#5ad16b'], [0.95, -0.25, -0.3, '#b38cff']]) {
    out.push({ x: x + dx, y: 3.85 + dy, z: z + 0.6 + dz, w: 0.55, h: 0.55, d: 0.3, c, shape: 'sphere', deco: true, shadow: false });
  }
  effects.push({ type: 'sparkle', x, y: 4.2, z: z + 0.6 });
  zones.push({ x0: x - 3.2, x1: x + 3.2, y0: 0, y1: 4, z0: z - 2.6, z1: z - 0.4, eggs: true });
}

export function buildHub() {
  const parts = [], coins = [], zones = [], signs = [], effects = [], npcs = [];
  const rnd = seeded(20261106);
  // 섬, 모래, 바다
  parts.push({ x: 0, y: -3, z: 0, w: 150, h: 6, d: 150, c: '#79c85a', m: 'grass', round: 1.2, shadow: false });
  parts.push({ x: 0, y: -2.85, z: 0, w: 166, h: 5.2, d: 166, c: '#f5dfa6', m: 'sand', round: 2, shadow: false });
  parts.push({ x: 0, y: -1.1, z: 0, w: 1600, h: 0.2, d: 1600, c: '#33a6ff', m: 'water', deco: true, shadow: false, round: 0 });
  for (const [x, z, w, d] of [[0, -84, 170, 2], [0, 84, 170, 2], [-84, 0, 2, 170], [84, 0, 2, 170]]) parts.push({ x, y: 4, z, w, h: 12, d, hidden: true });
  // 광장 바닥
  parts.push({ x: 0, y: 0, z: 0, w: 46, h: 0.24, d: 46, c: '#efe6d8', m: 'stone', round: 0.1 });
  parts.push({ x: 0, y: 0.02, z: 0, w: 22, h: 0.26, d: 22, c: '#e0d0bb', m: 'stone', round: 0.1 });
  // 광장 가운데: 분수 대신 엄청 큰 크리스마스 트리 (2026-11-21 인혁 그림: 꼭대기 별, 동그란 장식, 둥근 울타리, 선물)
  xmasTree(parts, effects, 0, 0);
  // 알 판매 (펫 알 까기, 코인 100)
  eggStand(parts, zones, effects, EGG_STAND.x, EGG_STAND.z);
  // 시작 발판
  parts.push({ x: 0, y: 0.15, z: 18, w: 6, h: 0.3, d: 6, c: '#ffffff', round: 0.12 });
  parts.push({ x: 0, y: 0.32, z: 18, w: 4.4, h: 0.06, d: 4.4, c: '#3fa7ff', m: 'neon', deco: true, shadow: false, round: 0.02 });
  // 문 (포털)
  PORTALS.forEach((p, i) => {
    const x = (i - (PORTALS.length - 1) / 2) * 18, z = -32;
    parts.push({ x, y: 0.3, z, w: 14, h: 0.6, d: 7, c: '#f4efe6', m: 'stone' });
    parts.push({ x, y: 0.3, z: z + 4.6, w: 10, h: 0.3, d: 2.4, c: '#f4efe6', m: 'stone' });
    for (const s of [-1, 1]) {
      parts.push({ x: x + s * 5.4, y: 5.1, z, w: 1.6, h: 9, d: 1.6, c: p.color });
      parts.push({ x: x + s * 5.4, y: 9.9, z, w: 2.1, h: 0.6, d: 2.1, c: '#ffffff' });
      parts.push({ x: x + s * 5.4, y: 0.9, z, w: 2.1, h: 0.6, d: 2.1, c: '#ffffff' });
    }
    parts.push({ x, y: 10.7, z, w: 13.4, h: 1.4, d: 2, c: p.color });
    zones.push({ x0: x - 4.6, x1: x + 4.6, y0: 0.4, y1: 9.4, z0: z - 0.7, z1: z + 0.7, portal: p.world });
    effects.push({ type: 'portal', x, y: 5.0, z, w: 9.2, h: 8.6, color: p.color });
    signs.push({ x, y: 13.2, z: z + 0.2, ry: 0, w: 12, h: 2.6, lines: [`${p.icon} ${p.name}`, p.sub], bg: '#ffffff', fg: '#222533', accent: p.color, sizes: [118, 70] });
    // 문까지 길
    parts.push({ x: x * 0.62, y: 0.06, z: -26, w: 7, h: 0.12, d: 6, c: '#e9dfcf', m: 'stone', round: 0.05 });
    lamp(parts, x - 7.6, z + 3);
    lamp(parts, x + 7.6, z + 3);
  });
  // 옷가게
  {
    const x = -34, z = 6;
    parts.push({ x, y: 0.2, z, w: 12, h: 0.4, d: 9, c: '#fff4f8', m: 'stone' });
    parts.push({ x: x - 5.7, y: 3.2, z, w: 0.6, h: 5.6, d: 9, c: '#ffd0e4' });
    parts.push({ x, y: 3.2, z: z - 4.2, w: 12, h: 5.6, d: 0.6, c: '#ffd0e4' });
    parts.push({ x: x + 5.7, y: 3.2, z: z - 2.6, w: 0.6, h: 5.6, d: 3.8, c: '#ffd0e4' });
    parts.push({ x, y: 6.3, z: z - 0.2, w: 12.8, h: 0.6, d: 9.6, c: '#ffffff' });
    parts.push({ x, y: 6.0, z: z + 5.2, w: 13, h: 0.3, d: 2.6, c: '#ff5e7e', m: 'stripes', rx: 0.35, deco: true });
    parts.push({ x: x + 2, y: 1.0, z: z + 1.6, w: 5, h: 1.2, d: 1.2, c: '#c98a4b', m: 'wood' });
    for (let i = 0; i < 4; i++) parts.push({ x: x - 3.5 + i * 1.4, y: 4.6, z: z - 3.7, w: 1.1, h: 1.3, d: 0.3, c: ['#ff4d5e', '#3fa7ff', '#ffd23f', '#5ad16b'][i], deco: true });
    signs.push({ x, y: 7.4, z: z + 4.6, ry: 0, w: 7, h: 1.6, lines: ['👕 옷가게'], bg: '#ffffff', fg: '#ff4d7a', accent: '#ff5e7e' });
    zones.push({ x0: x - 3, x1: x + 3, y0: 0, y1: 4, z0: z + 2.6, z1: z + 5.2, wardrobe: true });
    npcs.push({ x: x + 2, z: z - 1, yaw: 0, still: true, name: '옷가게 주인 리본', look: { skin: 8, shirt: 8, pants: 9, hat: 4, face: 1, emblem: 2, hair: 7, hairColor: 5 } });
    npcs.push({ x: x - 3.5, z: z - 1.5, yaw: 0.4, still: true, mannequin: true, look: { skin: 9, shirt: 1, pants: 12, hat: 10, face: 6, emblem: 6, hair: 4, hairColor: 0 } });
  }
  // 안내판
  signs.push({ x: 30, y: 3.4, z: 8, ry: -Math.PI / 2, w: 8, h: 4.6, lines: ['브릭버스에 온 걸 환영해!', 'WASD 이동 · Space 점프', '마우스 끌기: 시점 · 휠: 확대', '빛나는 문으로 게임에 들어가!', '🥚 알 판매: 펫이 달리기를 빠르게 · 📱 P 핸드폰'], bg: '#ffffff', fg: '#2a2d3a', accent: '#3fa7ff', sizes: [86, 62, 62, 62, 62] });
  parts.push({ x: 30.3, y: 1.6, z: 8, w: 0.5, h: 3.2, d: 0.5, c: '#8b5a3c', m: 'wood', deco: true });
  // 점프대 공원
  {
    const ox = 42, oz = -6;
    parts.push({ x: ox, y: 0.05, z: oz, w: 22, h: 0.1, d: 22, c: '#ffe7f2', round: 0.05 });
    const pads = [[-6, -6], [6, -6], [-6, 6], [6, 6], [0, 0]];
    pads.forEach(([dx, dz]) => parts.push({ x: ox + dx, y: 0.3, z: oz + dz, w: 3.4, h: 0.5, d: 3.4, k: 'bounce', c: '#ff5ec4' }));
    const highs = [[-6, -6, 9], [6, 6, 10], [0, -10, 13], [10, -2, 15]];
    highs.forEach(([dx, dz, y], i) => {
      parts.push({ x: ox + dx, y: y - 0.4, z: oz + dz + (i < 2 ? 0 : 0), w: 4, h: 0.8, d: 4, c: hsl(300 + i * 25, 85, 70) });
      coins.push([ox + dx, y + 1.4, oz + dz]);
    });
    signs.push({ x: ox, y: 3, z: oz + 11.4, ry: 0, w: 6, h: 1.4, lines: ['🦘 통통 점프 공원'], bg: '#ffffff', fg: '#d6338f', accent: '#ff5ec4' });
  }
  // 전망대 (나선 계단)
  {
    const ox = -42, oz = 40;
    parts.push({ x: ox, y: 8, z: oz, w: 5, h: 16, d: 5, c: '#c7ccd6', m: 'stone' });
    const steps = 26;
    for (let i = 0; i < steps; i++) {
      const side = Math.floor(i / 6.5) % 4, k = (i % 6.5) / 6.5;
      const t = 0.6 * (i + 1);
      const along = -3 + k * 6 + 0.5;
      const [dx, dz] = [[along, 3.6], [3.6, -along], [-along, -3.6], [-3.6, along]][side];
      parts.push({ x: ox + dx, y: t - 0.3, z: oz + dz, w: side % 2 ? 2.2 : 1.4, h: 0.6, d: side % 2 ? 1.4 : 2.2, c: hsl(190 + i * 6, 70, 68) });
    }
    parts.push({ x: ox, y: 16.2, z: oz, w: 9, h: 0.6, d: 9, c: '#ffffff' });
    for (const [dx, dz, w, d] of [[0, -4.4, 9, 0.3], [0, 4.4, 9, 0.3], [-4.4, 0, 0.3, 9], [4.4, 0, 0.3, 9]]) parts.push({ x: ox + dx, y: 17.2, z: oz + dz, w, h: 1.4, d, c: '#9fe0ff', k: 'glass' });
    parts.push({ x: ox, y: 17.3, z: oz, w: 1.6, h: 1.2, d: 1.2, c: '#a0612f', m: 'wood' });
    parts.push({ x: ox, y: 18.0, z: oz, w: 1.7, h: 0.3, d: 1.3, c: '#ffd23f', m: 'gold', deco: true });
    for (let i = 0; i < 5; i++) coins.push([ox - 2 + i, 18.6, oz + 2.5]);
    signs.push({ x: ox, y: 2.4, z: oz + 2.55, ry: 0, w: 4.4, h: 1.2, lines: ['🗼 전망대'], bg: '#ffffff', fg: '#2a6fb3', accent: '#3fa7ff' });
  }
  // 작은 점프길
  {
    const ox = 36, oz = 34;
    for (let i = 0; i < 8; i++) {
      const a = i * 0.7;
      parts.push({ x: ox + Math.cos(a) * 8, y: 0.8 + i * 1.3 - 0.4, z: oz + Math.sin(a) * 8, w: 2.6, h: 0.8, d: 2.6, c: hsl(i * 40, 80, 64) });
    }
    coins.push([ox + Math.cos(4.9) * 8, 0.8 + 7 * 1.3 + 1.4, oz + Math.sin(4.9) * 8]);
    parts.push({ x: ox, y: 6, z: oz, w: 1.2, h: 12, d: 1.2, c: '#ffffff', shape: 'cyl' });
    parts.push({ x: ox, y: 12.4, z: oz, w: 3, h: 0.8, d: 3, c: '#ffd23f' });
    coins.push([ox, 14, oz]);
  }
  // 벤치, 가로등, 꽃밭
  for (const [x, z, a] of [[-14, 12, true], [14, 12, true], [-14, -12, true], [14, -12, true], [-19, 0, false], [19, 0, false]]) bench(parts, x, z, a);
  for (const [x, z] of [[-21, 21], [21, 21], [-21, -21], [21, -21], [-6, 28], [6, 28], [-12, 40], [12, 40]]) lamp(parts, x, z);
  for (const [x, z, w, d] of [[-9, 9, 3, 3], [9, 9, 3, 3], [-9, -9, 3, 3], [9, -9, 3, 3], [-28, 24, 6, 3], [26, 24, 6, 3], [-50, -20, 4, 8]]) flowers(parts, x, z, w, d, rnd);
  // 나무
  const avoid = (x, z) => Math.abs(x) < 27 && Math.abs(z) < 27 || (z < -22 && z > -44 && Math.abs(x) < 74) || (Math.abs(x + 34) < 9 && Math.abs(z - 6) < 9)
    || (Math.abs(x - 42) < 14 && Math.abs(z + 6) < 15) || (Math.abs(x + 42) < 8 && Math.abs(z - 40) < 8) || (Math.abs(x - 36) < 12 && Math.abs(z - 34) < 12)
    || (Math.abs(x - 30) < 4 && Math.abs(z - 8) < 6) || (Math.abs(x) < 5 && z > 20 && z < 60);
  let placed = 0;
  for (let tries = 0; tries < 400 && placed < 44; tries++) {
    const x = (rnd() - 0.5) * 140, z = (rnd() - 0.5) * 140;
    if (avoid(x, z)) continue;
    tree(parts, x, z, rnd);
    placed++;
  }
  // 바닷가 바위
  for (let i = 0; i < 18; i++) {
    const a = rnd() * Math.PI * 2, r = 79 + rnd() * 3;
    const s = 1.5 + rnd() * 2.5;
    parts.push({ x: Math.cos(a) * r, y: -0.6 + s * 0.3, z: Math.sin(a) * r, w: s * 1.3, h: s, d: s, c: '#a7a9b4', m: 'stone', ry: rnd() * 3, round: 0.4 });
  }
  // 광장 코인
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; coins.push([Math.cos(a) * 16, 1.4, Math.sin(a) * 16]); }
  for (const [x, z] of [[-60, -50], [60, -50], [-60, 60], [55, 62], [0, 66], [-66, 0], [66, 0], [-24, -58], [24, -58]]) coins.push([x, 1.4, z]);
  // 돌아다니는 주민
  npcs.push({ x: 8, z: 22, wander: true, name: '브릭 주민 단단이', look: { skin: 0, shirt: 3, pants: 12, hat: 0, face: 2, emblem: 4, hair: 3, hairColor: 4 } });
  npcs.push({ x: -16, z: -16, wander: true, name: '브릭 주민 몽글이', look: { skin: 7, shirt: 9, pants: 5, hat: 6, face: 0, emblem: 2, hair: 5, hairColor: 3 } });
  npcs.push({ x: 22, z: -20, wander: true, name: '브릭 주민 반짝이', look: { skin: 5, shirt: 7, pants: 11, hat: 15, face: 7, emblem: 1, hair: 9, hairColor: 7 } });
  return { parts, coins, zones, signs, effects, npcs, spawn: { x: 0, y: 0.3, z: 18, yaw: Math.PI }, killY: -20, sky: 'hub' };
}

// ───────────────────────── 무지개 점프 탑 ─────────────────────────

export const OBBY_NAMES = [
  '첫 점프', '계단 오르기', '용암 징검다리', '흔들 발판', '빙글빙글 막대',
  '사라지는 블록', '통통 점프대', '외나무다리', '거꾸로 벨트', '사다리 타기',
  '넓어지는 틈', '미끄러운 얼음', '엘리베이터', '용암 벽 피하기', '용암 위 발판',
  '기둥 건너기', '쌍둥이 막대', '옆으로 미는 벨트', '빨리 사라지는 블록', '두 번 점프대',
  '작은 징검다리', '빠른 발판', '용암 사다리', '빠른 막대', '높은 기둥',
  '얼음 틈', '움직이는 용암 막대', '빠른 엘리베이터', '사라지는 발판 섞기', '마지막 점프',
];

const rainbow = i => hsl((i * 23) % 360, 82, 62);
const rainbowLight = i => hsl((i * 23) % 360, 90, 78);

function lavaFloor(b, f0, f1, width = 12) {
  b.plat((f0 + f1) / 2, 0, -1.1, width, f1 - f0, { k: 'kill', h: 0.6, round: 0.05 });
}

const STAGE = {
  jumps(b, s, n, gap, size, dy, zig = 0) {
    let f = s.f0, t = 0;
    for (let i = 0; i < n; i++) {
      f += gap; t += dy;
      b.plat(f + size / 2, zig ? (i % 2 ? zig : -zig) : 0, t, size, size, { c: s.c2 });
      if (i === Math.floor(n / 2)) b.coin(f + size / 2, zig ? (i % 2 ? zig : -zig) : 0, t + 1.5);
      f += size;
    }
    return { f: f + gap, t: t + dy };
  },
  stairs(b, s, n, rise, gap, size) {
    let f = s.f0, t = 0;
    for (let i = 0; i < n; i++) {
      f += gap; t += rise;
      b.plat(f + size / 2, (i % 2 ? 1 : -1) * 1.4, t, size, size, { c: hsl((s.i * 23 + i * 12) % 360, 85, 70) });
      f += size;
    }
    b.coin(f - size / 2, (n % 2 ? -1 : 1) * 1.4, t + 1.5);
    return { f: f + gap, t: t + rise * 0.5 };
  },
  lava(b, s, n, size, gap, side) {
    let f = s.f0;
    for (let i = 0; i < n; i++) {
      f += gap;
      b.plat(f + size / 2, (i % 2 ? 1 : -1) * side, 0, size, size, { c: s.c2 });
      f += size;
    }
    lavaFloor(b, s.f0 - 0.5, f + gap + 0.5);
    b.coin(s.f0 + (f - s.f0) / 2, 0, 1.4);
    return { f: f + gap, t: 0 };
  },
  movers(b, s, n, amp, spd, gap = 2.4, lava = false, ax = 'r') {
    let f = s.f0;
    for (let i = 0; i < n; i++) {
      f += gap;
      const extra = ax === 'f' ? amp : 0;
      b.plat(f + 2 + extra, 0, 0, 4, 4, { c: '#ffcc33', move: { ax, amp, spd, ph: i * 1.9 } });
      f += 4 + extra * 2;
    }
    if (lava) lavaFloor(b, s.f0 - 0.5, f + gap + 0.5, 14);
    return { f: f + gap, t: 0 };
  },
  spin(b, s, count, spd, bridge = 5) {
    let f = s.f0;
    for (let i = 0; i < count; i++) {
      b.plat(f + bridge / 2, 0, 0, 3, bridge, { c: s.c2 });
      f += bridge;
      b.plat(f + 3.5, 0, 0, 7, 7, { c: s.c, shape: 'box' });
      const [x, y, z] = b.world(f + 3.5, 0, 0);
      b.out.push({ x, y: y + 0.75, z, w: 0.5, h: 0.5, d: 7.8, spin: { spd: (i % 2 ? -1 : 1) * spd, len: 7.8 }, c: '#ff3b3b', deco: true });
      b.out.push({ x, y: y + 0.55, z, w: 0.9, h: 1.1, d: 0.9, c: '#3a3f4b', m: 'metal', shape: 'cyl' });
      f += 7;
    }
    b.plat(f + bridge / 2, 0, 0, 3, bridge, { c: s.c2 });
    return { f: f + bridge, t: 0 };
  },
  fade(b, s, n, gap, size, dy = 0) {
    let f = s.f0, t = 0;
    for (let i = 0; i < n; i++) {
      f += gap; t += dy;
      b.plat(f + size / 2, (i % 2 ? 1 : -1) * 0.8, t, size, size, { k: 'fade', c: '#66e0ff' });
      f += size;
    }
    return { f: f + gap, t: t + dy };
  },
  bounce(b, s, height, pads = 1) {
    let f = s.f0, t = 0;
    for (let i = 0; i < pads; i++) {
      f += 2.2;
      b.plat(f + 1.6, 0, t, 3.2, 3.2, { k: 'bounce', c: '#40ff8a', h: 0.6 });
      f += 3.2;
      if (i < pads - 1) { t += height * 0.55; f += 2.2; b.plat(f + 2, 0, t, 4, 4, { c: s.c2 }); f += 4; }
    }
    return { f: f + 2.4, t: t + height };
  },
  beams(b, s, n, len, width, gap = 1.4) {
    let f = s.f0;
    for (let i = 0; i < n; i++) {
      f += gap;
      b.plat(f + len / 2, (i % 2 ? 1 : -1) * 1.2, 0, width, len, { c: s.c2, h: 0.6 });
      f += len;
    }
    b.coin(s.f0 + (f - s.f0) * 0.5, 0, 1.6);
    return { f: f + gap, t: 0 };
  },
  belt(b, s, len, spd, side = false) {
    const half = len / 2 - 1.1;
    const cv = side ? [0, spd] : [-spd, 0];
    b.plat(s.f0 + half / 2, 0, 0, 4, half, { k: 'conveyor', cv, h: 0.8 });
    b.plat(s.f0 + half + 2.2 + half / 2, 0, 0, 4, half, { k: 'conveyor', cv, h: 0.8 });
    return { f: s.f0 + len, t: 0 };
  },
  ladder(b, s, height, lava = false) {
    const f = s.f0 + 3;
    b.plat(s.f0 + 1.5, 0, 0, 4, 3, { c: s.c2 });
    b.box(f + 0.3, 0, height / 2, 3, height, 0.6, { k: 'ladder', c: '#c98a4b', m: 'wood' });
    for (let y = 0.5; y < height; y += 0.7) {
      const [x, yy, z] = b.world(f - 0.05, 0, y);
      b.out.push({ x, y: yy, z, w: b.h % 2 ? 0.16 : 3.1, h: 0.16, d: b.h % 2 ? 3.1 : 0.16, c: '#8b5a3c', m: 'wood', deco: true, round: 0.03 });
    }
    b.box(f + 0.6 + 3, 0, (height - 0.8 - 6) / 2, 6, height - 0.8 + 6, 6, { c: s.c, m: 'stone' });
    if (lava) lavaFloor(b, s.f0, f + 0.6, 8);
    return { f: f + 0.6, t: height };
  },
  lifts(b, s, n, step, spd) {
    let f = s.f0;
    for (let i = 0; i < n; i++) {
      f += 2.2;
      b.plat(f + 2, 0, (i + 0.5) * step, 4, 4, { c: '#ffcc33', move: { ax: 'y', amp: step * 0.65, spd, ph: i * 1.4 } });
      f += 4;
    }
    return { f: f + 2.2, t: n * step };
  },
  walls(b, s, n, moving = 0) {
    const len = n * 6 + 2;
    b.plat(s.f0 + len / 2, 0, 0, 6, len, { c: s.c2 });
    for (let i = 0; i < n; i++) {
      const f = s.f0 + 4 + i * 6;
      if (i % 2 === 0) b.plat(f, 0, 0.75, 6, 0.5, { k: 'kill', h: 0.75, move: moving ? { ax: 'f', amp: 1.5, spd: moving, ph: i } : undefined });
      else {
        const gapSide = (i % 4 === 1) ? 1 : -1;
        b.plat(f, -gapSide * 1, 3.2, 4, 0.5, { k: 'kill', h: 3.2 });
      }
    }
    return { f: s.f0 + len, t: 0 };
  },
  pillars(b, s, n, gap, size) {
    let f = s.f0, t = 0;
    for (let i = 0; i < n; i++) {
      f += gap;
      t = Math.round((i * 0.7 + (i % 2) * 0.9) * 10) / 10;
      b.box(f + size / 2, (i % 3 - 1) * 1.2, t - 6, size, 12, size, { c: hsl((s.i * 23 + i * 30) % 360, 70, 66), shape: 'box' });
      f += size;
    }
    b.coin(f - size / 2, ((n - 1) % 3 - 1) * 1.2, t + 1.5);
    return { f: f + gap, t: t + 0.4 };
  },
};

function obbyStage(i, b, s) {
  const L = s.lvl;
  const gap = 2.2 + L * 1.6;
  const size = 3.2 - L * 1.2;
  switch (i) {
    case 0: return STAGE.jumps(b, s, 4, 2.0, 3.4, 0.5);
    case 1: return STAGE.stairs(b, s, 6, 1.2, 1.4, 2.6);
    case 2: return STAGE.lava(b, s, 5, 3, 1.8, 1.6);
    case 3: return STAGE.movers(b, s, 2, 3, 1.2);
    case 4: return STAGE.spin(b, s, 1, 1.6);
    case 5: return STAGE.fade(b, s, 4, 2.0, 3.2);
    case 6: return STAGE.bounce(b, s, 6.5);
    case 7: return STAGE.beams(b, s, 3, 6, 1.0);
    case 8: return STAGE.belt(b, s, 18, 3.5);
    case 9: return STAGE.ladder(b, s, 7);
    case 10: return STAGE.jumps(b, s, 5, gap, size, 0.4, 0.8);
    case 11: { const r = STAGE.jumps(b, s, 1, 2.0, 3, 0); b.out.at(-1).k = 'ice'; b.out.at(-1).c = '#bdefff'; const s2 = { ...s, f0: r.f }; b.plat(s2.f0 + 6, 0, 0, 3.4, 12, { k: 'ice', c: '#bdefff' }); b.plat(s2.f0 + 12 + 2.6 + 5, 1.6, 0, 3.4, 10, { k: 'ice', c: '#bdefff' }); return { f: s2.f0 + 12 + 2.6 + 10 + 0.6, t: 0 }; }
    case 12: return STAGE.lifts(b, s, 3, 2.2, 1.3);
    case 13: return STAGE.walls(b, s, 5);
    case 14: return STAGE.movers(b, s, 3, 2, 1.4, 2.0, true, 'f');
    case 15: return STAGE.pillars(b, s, 6, gap - 0.4, 2.2);
    case 16: return STAGE.spin(b, s, 2, 2.0);
    case 17: return STAGE.belt(b, s, 20, 3.2, true);
    case 18: return STAGE.fade(b, s, 6, gap - 0.2, 2.6, 0.3);
    case 19: return STAGE.bounce(b, s, 7.5, 2);
    case 20: return STAGE.lava(b, s, 7, 2.2, gap - 0.6, 1.8);
    case 21: return STAGE.movers(b, s, 3, 3.5, 2.0);
    case 22: return STAGE.ladder(b, s, 9, true);
    case 23: return STAGE.spin(b, s, 2, 2.8, 4);
    case 24: return STAGE.pillars(b, s, 7, gap - 0.6, 1.8);
    case 25: { b.plat(s.f0 + 4, 0, 0, 3, 8, { k: 'ice', c: '#bdefff' }); b.plat(s.f0 + 8 + 3.2 + 3, 0, 0.6, 3, 6, { k: 'ice', c: '#bdefff' }); b.plat(s.f0 + 8 + 3.2 + 6 + 3.2 + 3, -1.2, 1.2, 2.6, 6, { k: 'ice', c: '#bdefff' }); return { f: s.f0 + 8 + 3.2 + 6 + 3.2 + 6 + 2, t: 1.6 }; }
    case 26: return STAGE.walls(b, s, 6, 1.8);
    case 27: return STAGE.lifts(b, s, 4, 2.3, 1.9);
    case 28: { const r1 = STAGE.fade(b, s, 3, 2.8, 2.4); return STAGE.movers(b, { ...s, f0: r1.f - 2.4 }, 2, 3, 2.2); }
    default: return STAGE.jumps(b, s, 6, 3.8, 1.8, 0.6, 0.6);
  }
}

export function buildObby() {
  const parts = [], coins = [], signs = [], effects = [], checkpoints = [];
  const rnd = seeded(30);
  // 시작 섬
  parts.push({ x: 0, y: -1.5, z: 0, w: 18, h: 3, d: 18, c: '#9be87a', m: 'grass', round: 0.6 });
  parts.push({ x: 0, y: -4.5, z: 0, w: 15, h: 3.2, d: 15, c: '#c79a6b', m: 'stone', round: 0.8, deco: true });
  parts.push({ x: 0, y: 0.1, z: 0, w: 5, h: 0.2, d: 5, c: '#ffffff', round: 0.06 });
  parts.push({ x: 0, y: 0.22, z: 0, w: 3.8, h: 0.05, d: 3.8, c: '#ff5e7e', m: 'neon', deco: true, shadow: false, round: 0.02 });
  signs.push({ x: 6.6, y: 3.6, z: 1.5, ry: -Math.PI / 2, w: 8, h: 3, lines: ['🌈 무지개 점프 탑', '30 스테이지 · 꼭대기에 황금 트로피!', '빨간 것과 용암에 닿으면 체크포인트로'], bg: '#ffffff', fg: '#2a2d3a', accent: '#ff5e7e', sizes: [74, 44, 40] });
  parts.push({ x: 6.98, y: 1.6, z: 1.5, w: 0.5, h: 3.2, d: 0.5, c: '#8b5a3c', m: 'wood', deco: true });
  checkpoints.push({ x: 0, y: 0.2, z: 0, yaw: 0, stage: 0 });
  // 돌아가는 문 (광장으로)
  parts.push({ x: -6.5, y: 0.15, z: 5, w: 4, h: 0.3, d: 4, c: '#ffffff' });
  signs.push({ x: -6.5, y: 4.7, z: 5.2, ry: Math.PI / 2, w: 3.6, h: 1, lines: ['🏠 광장으로'], bg: '#ffffff', fg: '#2a6fb3', accent: '#3fa7ff' });
  effects.push({ type: 'portal', x: -6.5, y: 2.2, z: 5, w: 3, h: 3.6, color: '#3fa7ff', ry: Math.PI / 2 });
  const zones = [{ x0: -7.1, x1: -5.9, y0: 0.3, y1: 4, z0: 3.4, z1: 6.6, portal: 0 }];

  let o = [0, 0, 0], heading = 0, half = 9;
  for (let i = 0; i < OBBY_STAGES; i++) {
    const b = new Builder(parts, o, heading);
    b.coin = (f, r, t) => coins.push(b.world(f, r, t));
    const s = { f0: half, lvl: i / (OBBY_STAGES - 1), c: rainbow(i), c2: rainbowLight(i), i };
    const end = obbyStage(i, b, s);
    const final = i === OBBY_STAGES - 1;
    const pw = final ? 16 : 6;
    const pad = b.plat(end.f + pw / 2, 0, end.t, pw, pw, { k: 'check', cp: i + 1, c: final ? '#ffd23f' : s.c, m: final ? 'gold' : undefined, h: 0.8 });
    const next = final ? heading : (heading + 1) % 2;
    const F = FWD[next];
    checkpoints.push({ x: pad.x, y: pad.y + 0.4, z: pad.z, yaw: Math.atan2(F[0], F[1]), stage: i + 1 });
    // 번호 깃발
    const [fx, fy, fz] = b.world(end.f + 0.6, pw / 2 - 0.6, end.t);
    parts.push({ x: fx, y: fy + 1.6, z: fz, w: 0.18, h: 3.2, d: 0.18, c: '#ffffff', shape: 'cyl', deco: true });
    signs.push({ x: fx, y: fy + 2.6, z: fz, ry: b.yaw() + Math.PI, w: 1.6, h: 1.2, lines: [final ? '🏆' : `${i + 1}`], bg: s.c, fg: '#ffffff', sizes: [100], double: true });
    if (final) {
      const [tx, ty, tz] = b.world(end.f + pw / 2, 0, end.t);
      parts.push({ x: tx, y: ty + 0.5, z: tz, w: 3, h: 1, d: 3, c: '#ffffff', m: 'stone' });
      parts.push({ x: tx, y: ty + 1.4, z: tz, w: 0.7, h: 0.8, d: 0.7, c: '#ffd23f', m: 'gold', shape: 'cyl' });
      parts.push({ x: tx, y: ty + 2.6, z: tz, w: 2.6, w2: 1.0, h: 1.8, d: 2.6, c: '#ffd23f', m: 'gold', shape: 'cyl' });
      zones.push({ x0: tx - 7, x1: tx + 7, y0: ty, y1: ty + 6, z0: tz - 7, z1: tz + 7, finish: true });
      effects.push({ type: 'sparkle', x: tx, y: ty + 3.6, z: tz });
      // 꼭대기에서 광장으로
      const [px, py, pz] = b.world(end.f + pw - 1.5, -5, end.t);
      effects.push({ type: 'portal', x: px, y: py + 2.0, z: pz, w: 3, h: 3.6, color: '#3fa7ff', ry: b.yaw() + Math.PI / 2 });
      zones.push({ x0: px - 1.6, x1: px + 1.6, y0: py, y1: py + 4, z0: pz - 1.6, z1: pz + 1.6, portal: 0 });
      signs.push({ x: px, y: py + 4.4, z: pz, ry: b.yaw() + Math.PI, w: 3.6, h: 1, lines: ['🏠 광장으로'], bg: '#ffffff', fg: '#2a6fb3', accent: '#3fa7ff', double: true });
    }
    o = [pad.x, end.t + o[1], pad.z];
    heading = next; half = pw / 2;
  }
  // 아래에 떠 있는 구름
  const top = checkpoints.at(-1);
  for (let i = 0; i < 70; i++) {
    const t = rnd();
    const x = top.x * t + (rnd() - 0.5) * 90, z = top.z * t + (rnd() - 0.5) * 90;
    const y = top.y * t - 18 - rnd() * 14;
    const s = 4 + rnd() * 6;
    for (let k = 0; k < 3; k++) parts.push({ x: x + (k - 1) * s * 0.7, y: y + (k === 1 ? s * 0.25 : 0), z: z + (rnd() - 0.5) * 2, w: s, h: s * 0.7, d: s, c: '#ffffff', m: 'cloud', shape: 'sphere', deco: true, shadow: false });
  }
  return { parts, coins, zones, signs, effects, checkpoints, npcs: [], spawn: { ...checkpoints[0] }, sky: 'obby' };
}

// ───────────────────────── 블록 공장 타이쿤 ─────────────────────────

export const PLOT_SLOTS = [
  { x: 0, z: -30, heading: 0 }, { x: 0, z: 30, heading: 2 },
  { x: -48, z: -30, heading: 0 }, { x: -48, z: 30, heading: 2 },
  { x: 48, z: -30, heading: 0 }, { x: 48, z: 30, heading: 2 },
];
export const PLOT_COLORS = ['#3fa7ff', '#ff5e7e', '#5ad16b', '#ffb820', '#9b5cff', '#21c7b8'];

export const DROPPERS = { drop5: -17, start: -14, drop2: -10, drop3: -6, drop4: -2, gold: 2 };
export const DROP_COLOR = { start: '#c7ccd6', drop2: '#3fa7ff', drop3: '#5ad16b', drop4: '#ff8a3d', gold: '#ffd23f', drop5: '#7df9ff' };
export const BELT = { f: -12, r0: -18.6, r1: 10, top: 1.4, speed: 3.2 };
export const UPGRADERS = { up1: 5, up2: 7.6, up3: 9.3 };
export const UPGRADE_COLOR = { up1: '#4dfffc', up2: '#ff6bf1', up3: '#ff3b3b' };
export const COLLECTOR = { f: -12, r: 12.6 };
export const COLLECT_PAD = { f: -7.2, r: 12.6 };
export const BUY_SPOTS = [[15, -14], [15, -7], [15, 0], [15, 7], [15, 14]];
export const SKY = 20; // 하늘 섬 윗면 높이 (땅 위)

export function plotBuilder(out, slot) {
  const s = PLOT_SLOTS[slot];
  return new Builder(out, [s.x, 0.3, s.z], s.heading);
}

function dropperParts(b, id) {
  const r = DROPPERS[id], col = DROP_COLOR[id];
  const metal = id === 'gold' ? 'gold' : id === 'drop5' ? 'ice' : 'plastic';
  b.box(-14.4, r, 2.8, 0.7, 5.6, 0.7, { c: '#4b5163', m: 'metal' });
  b.box(-13.2, r, 5.3, 0.6, 0.5, 2.6, { c: '#4b5163', m: 'metal', deco: true });
  b.box(BELT.f, r, 5.0, 2.2, 1.6, 2.2, { c: col, m: metal });
  b.box(BELT.f, r, 4.0, 1.0, 0.6, 1.0, { c: '#2a2d36', shape: 'cyl', deco: true });
  b.box(BELT.f, r, 5.9, 1.4, 0.2, 1.4, { c: '#ffffff', deco: true });
}

export function tycoonBase(out, slot) {
  const b = plotBuilder(out, slot);
  const col = PLOT_COLORS[slot];
  b.plat(0, 0, 0, 41, 41, { c: col, h: 0.4, round: 0.15 });
  b.plat(0, 0, 0.05, 39, 39, { c: '#f2f0ea', h: 0.4, m: 'stone', round: 0.1 });
  // 벨트
  const len = BELT.r1 - BELT.r0;
  // 벨트는 오른쪽(r) 방향으로 길다: plat(f, r, 윗면, r쪽 길이, f쪽 길이)
  b.plat(BELT.f, (BELT.r0 + BELT.r1) / 2, BELT.top, len, 2.4, { k: 'conveyor', cv: [0, BELT.speed], h: 0.4 });
  for (const s of [-1, 1]) b.plat(BELT.f + s * 1.35, (BELT.r0 + BELT.r1) / 2, BELT.top + 0.35, len, 0.3, { c: '#4b5163', m: 'metal', h: 0.5 });
  for (let r = BELT.r0 + 1; r < BELT.r1; r += 4) b.box(BELT.f, r, 0.6, 0.5, 1.2, 1.6, { c: '#4b5163', m: 'metal' });
  dropperParts(b, 'start');
  // 녹이는 기계
  b.box(COLLECTOR.f, COLLECTOR.r, 1.9, 3.6, 3.6, 3.6, { c: '#5b6275', m: 'metal' });
  b.box(COLLECTOR.f, COLLECTOR.r, 3.95, 3.0, 0.5, 3.0, { c: '#3a3f4b', m: 'metal' });
  b.box(COLLECTOR.f, COLLECTOR.r - 1.82, 1.9, 0.06, 1.4, 2.0, { c: '#ff7a1a', m: 'neon', deco: true });
  b.box(COLLECTOR.f + 1, COLLECTOR.r, 5.5, 0.6, 3.2, 0.6, { c: '#3a3f4b', m: 'metal', shape: 'cyl' });
  // 돈 받는 발판
  b.plat(COLLECT_PAD.f, COLLECT_PAD.r, 0.45, 3.4, 3.4, { c: '#5ad16b', h: 0.4, collect: true });
  return b;
}

// 산 물건의 부품. has(id): 이 땅 주인이 그것을 샀나 (지붕이 3층 위로 올라가는 것처럼 서로 맞추려고)
export function tycoonItem(out, slot, id, has = () => false) {
  const b = plotBuilder(out, slot);
  const wall = '#fff7ea', trim = '#c98a4b';
  switch (id) {
    case 'floor': b.plat(1, -7, 0.35, 20, 14, { h: 0.3, m: 'wood', c: '#e8c39a' }); break;
    case 'drop2': case 'drop3': case 'drop4': case 'gold': case 'drop5': dropperParts(b, id); break;
    case 'fence': {
      // 뒷마당이 있으면 뒤 울타리에 문(r 13.5~18.5)을 낸다
      const back = has('yard') ? [[-19.6, -3.25, 33.5, 0.4], [-19.6, 19.25, 1.5, 0.4]] : [[-19.6, 0, 40, 0.4]];
      for (const [f, r, w, d] of [...back, [0, -19.6, 0.4, 40], [0, 19.6, 0.4, 40], [19.6, -18, 3.6, 0.4], [19.6, 18, 3.6, 0.4]]) b.plat(f, r, 1.3, w, d, { c: '#ffffff', h: 1.1 });
      for (let k = -19.6; k <= 19.6; k += 4.9) for (const [f, r] of [[-19.6, k], [k, -19.6], [k, 19.6]]) {
        if (has('yard') && f === -19.6 && r > 13 && r < 19) continue;
        b.plat(f, r, 1.6, 0.6, 0.6, { c: trim, h: 1.5, deco: true });
      }
      break;
    }
    case 'up1': case 'up2': case 'up3': {
      const r = UPGRADERS[id];
      const c = UPGRADE_COLOR[id];
      for (const s of [-1, 1]) b.box(BELT.f + s * 1.6, r, 2.4, 0.5, 2.4, 0.5, { c: '#3a3f4b', m: 'metal' });
      b.box(BELT.f, r, 3.75, 0.7, 0.5, 3.7, { c, m: 'neon' });
      b.box(BELT.f, r, 2.6, 0.12, 1.8, 2.7, { c, k: 'glass', deco: true });
      break;
    }
    case 'walls': {
      const h = 4.6, y = 0.35 + h / 2;
      b.box(-6 + 0.25, -7, y, 20, h, 0.5, { c: wall });
      b.box(1, -17 + 0.25, y, 0.5, h, 14, { c: wall });
      b.box(1, 3 - 0.25, y, 0.5, h, 14, { c: wall });
      b.box(8 - 0.25, -13, y, 8, h, 0.5, { c: wall });
      b.box(8 - 0.25, 0, y, 6, h, 0.5, { c: wall });
      b.box(8 - 0.25, -7, 0.35 + h - 0.6, 6, 1.2, 0.5, { c: wall });
      break;
    }
    case 'door': {
      for (const r of [-13, 0]) b.box(8 + 0.02, r, 2.9, 3.2, 1.8, 0.1, { c: '#bfe9ff', k: 'glass', deco: true });
      for (const f of [-2, 4]) for (const r of [-17.05, 3.05]) b.box(f, r, 2.9, 0.1, 1.8, 3.2, { c: '#bfe9ff', k: 'glass', deco: true });
      for (const s of [-1, 1]) b.box(8 + 0.05, -7 + s * 1.6, 2.2, 0.3, 3.4, 0.3, { c: trim, m: 'wood', deco: true });
      b.plat(9.4, -7, 0.4, 3, 1.6, { c: '#ff5e7e', h: 0.12 });
      break;
    }
    case 'lamp': {
      for (const r of [-12, -2]) { const [x, y, z] = b.world(10.5, r, 0.05); lamp(out, x, z, y); }
      const rnd = seeded(slot * 9 + 3);
      for (const r of [-14.5, 0.5]) { const [x, y, z] = b.world(12, r, 0.05); flowers(out, x, z, 3, 3, rnd, y); }
      break;
    }
    case 'stairs':
      for (let i = 0; i < 8; i++) b.plat(6.3 - i * 1.3, -15.2, 0.35 + (i + 1) * 0.55, 2.6, 1.3, { c: trim, m: 'wood', h: 0.55 });
      break;
    case 'floor2': {
      b.plat(1, -5.45, 5.3, 16.9, 14, { h: 0.3, m: 'wood', c: '#e8c39a' });
      b.plat(-4.725, -15.2, 5.3, 2.6, 2.55, { h: 0.3, m: 'wood', c: '#e8c39a' });
      break;
    }
    case 'walls2': {
      const h = 3.8, y = 5.3 + h / 2;
      b.box(-6 + 0.25, -7, y, 20, h, 0.5, { c: '#ffe3c2' });
      b.box(1, -17 + 0.25, y, 0.5, h, 14, { c: '#ffe3c2' });
      b.box(-2.5, 3 - 0.25, y, 0.5, h, 7, { c: '#ffe3c2' });
      b.box(6.5, 3 - 0.25, y, 0.5, h, 3, { c: '#ffe3c2' });
      b.box(8 - 0.25, -12, y, 10, h, 0.5, { c: '#ffe3c2' });
      b.box(8 - 0.25, 0.5, y, 5, h, 0.5, { c: '#ffe3c2' });
      b.box(8 - 0.25, -5, 5.3 + 0.6, 5, 1.2, 0.5, { c: '#ffe3c2' });
      b.box(8 + 0.02, -5, 7.6, 4.6, 2.2, 0.1, { c: '#bfe9ff', k: 'glass', deco: true });
      break;
    }
    case 'roof': {
      const up = has('walls3') ? 3.9 : 0; // 3층이 있으면 그 위로
      const cols = ['#e8553f', '#d9452f', '#c9381f'];
      [[21, 15.6], [17, 11.6], [12, 7.4], [6, 3.4]].forEach(([w, d], i) => b.plat(1, -7, 9.6 + up + i * 1.1, w, d, { c: cols[i % 3], h: 1.1 }));
      b.box(1, -10, 14.6 + up, 1.2, 2.4, 1.2, { c: '#a7a9b4', m: 'stone' });
      break;
    }
    case 'walls3': {
      // 3층 바닥 (사다리 구멍만 비움), 벽, 창문, 2층에서 올라가는 사다리
      const floor = { h: 0.3, m: 'wood', c: '#e8c39a' };
      b.plat(1, -2.75, 9.4, 11.5, 14, floor);
      b.plat(1, -14.25, 9.4, 5.5, 14, floor);
      b.plat(2.3, -10, 9.4, 3, 11.4, floor);
      const h = 3.6, y = 9.4 + h / 2, c = '#ffd6e0';
      b.box(-6 + 0.25, -7, y, 20, h, 0.5, { c });
      b.box(1, -17 + 0.25, y, 0.5, h, 14, { c });
      b.box(1, 3 - 0.25, y, 0.5, h, 14, { c });
      b.box(8 - 0.25, -12, y, 10, h, 0.5, { c });
      b.box(8 - 0.25, 0.5, y, 5, h, 0.5, { c });
      b.box(8 - 0.25, -5, 9.4 + 0.6, 5, 1.2, 0.5, { c });
      b.box(8 + 0.02, -5, 11.7, 4.6, 2.2, 0.1, { c: '#bfe9ff', k: 'glass', deco: true });
      for (const f of [-2, 4]) for (const r of [-17.05, 3.05]) b.box(f, r, 11.4, 0.1, 1.6, 3, { c: '#bfe9ff', k: 'glass', deco: true });
      b.box(-5.2, -10, (5.3 + 9.4) / 2, 2.4, 9.4 - 5.3, 0.6, { k: 'ladder', c: '#c98a4b', m: 'wood' });
      for (let t = 5.8; t < 9.4; t += 0.7) b.box(-4.85, -10, t, 2.5, 0.14, 0.14, { c: '#8b5a3c', m: 'wood', deco: true, round: 0.03 });
      break;
    }
    case 'mailbox': {
      b.box(17.6, -17.6, 0.65, 0.22, 1.2, 0.22, { c: '#4b5163', m: 'metal' });
      b.box(17.6, -17.6, 1.45, 0.6, 0.55, 0.9, { c: '#ff4d5e', round: 0.2 });
      b.box(17.6, -17.25, 1.75, 0.06, 0.45, 0.12, { c: '#ffd23f', deco: true });
      break;
    }
    case 'bench': {
      b.plat(10.6, 14, 0.85, 3.2, 1, { c: '#c98a4b', m: 'wood', h: 0.2 });
      b.box(10.15, 14, 1.3, 3.2, 0.8, 0.15, { c: '#c98a4b', m: 'wood', deco: true });
      for (const r of [12.8, 15.2]) b.box(10.6, r, 0.45, 0.2, 0.75, 0.8, { c: '#3a3f4b', m: 'metal', deco: true });
      for (const r of [16.9, 11.4]) {
        b.box(10.6, r, 0.55, 0.8, 0.8, 0.8, { c: '#d9774b', shape: 'cyl', w2: 0.6 });
        b.box(10.6, r, 1.25, 1.0, 0.8, 1.0, { c: r > 15 ? '#ff8fc7' : '#ffd23f', shape: 'sphere', deco: true });
      }
      break;
    }
    case 'balcony': {
      b.plat(9.1, -7.5, 5.3, 12, 2.2, { h: 0.3, m: 'wood', c: '#e8c39a' });
      b.box(10.15, -7.5, 5.9, 12, 1.2, 0.1, { c: '#bfe9ff', k: 'glass' });
      for (const r of [-13.45, -1.55]) b.box(9.1, r, 5.9, 0.1, 1.2, 2.2, { c: '#bfe9ff', k: 'glass' });
      b.box(10.15, -7.5, 6.55, 12.1, 0.12, 0.2, { c: '#ffffff', deco: true });
      for (const r of [-13.2, -1.8]) b.box(9.9, r, 2.55, 0.3, 5.0, 0.3, { c: trim, m: 'wood' });
      break;
    }
    case 'yard': {
      b.plat(-26, 0, 0, 41, 11, { c: PLOT_COLORS[slot], h: 0.4, round: 0.15 });
      b.plat(-25.75, 0, 0.05, 39, 10.5, { c: '#e7efe0', h: 0.4, m: 'grass', round: 0.05 });
      for (const [f, r, w, d] of [[-31.1, 0, 40, 0.4], [-25.8, -19.6, 0.4, 10.6], [-25.8, 19.6, 0.4, 10.6]]) b.plat(f, r, 1.3, w, d, { c: '#ffffff', h: 1.1 });
      for (let k = -19.6; k <= 19.6; k += 4.9) b.plat(-31.1, k, 1.6, 0.6, 0.6, { c: trim, h: 1.5, deco: true });
      break;
    }
    case 'garage': {
      b.plat(-26.5, -15.5, 4.3, 7.6, 8.4, { c: '#4b5163', m: 'metal', h: 0.3 });
      for (const f of [-30.3, -22.7]) for (const r of [-18.9, -12.1]) b.box(f, r, 2.1, 0.35, 4.0, 0.35, { c: '#ffffff' });
      b.plat(-26.5, -15.5, 0.12, 6.4, 7.6, { c: '#c7ccd6', m: 'stone', h: 0.1 });
      // 자동차 (앞이 큰 땅 쪽)
      b.box(-26, -15.5, 0.95, 2.5, 0.9, 4.4, { c: '#ff4d5e' });
      b.box(-26.4, -15.5, 1.8, 2.1, 0.85, 2.4, { c: '#ff4d5e' });
      b.box(-26.4, -15.5, 1.8, 2.16, 0.6, 1.9, { c: '#bfe9ff', k: 'glass', deco: true });
      for (const f of [-27.4, -24.6]) for (const r of [-16.8, -14.2]) b.box(f, r, 0.42, 0.84, 0.36, 0.84, { c: '#23262f', shape: 'cyl', rz: Math.PI / 2, deco: true });
      for (const r of [-16.4, -14.6]) b.box(-23.78, r, 1.05, 0.45, 0.25, 0.06, { c: '#fff6c2', m: 'neon', deco: true });
      break;
    }
    case 'trampoline': {
      const f = -27, r = -8;
      for (const [df, dr, w, d] of [[-2.15, 0, 4.6, 0.3], [2.15, 0, 4.6, 0.3], [0, -2.15, 0.3, 4.0], [0, 2.15, 0.3, 4.0]]) b.plat(f + df, r + dr, 0.75, w, d, { c: '#3fa7ff', h: 0.25 });
      b.plat(f, r, 0.7, 4.0, 4.0, { k: 'bounce', c: '#2a2d36', m: 'matte', h: 0.15 });
      for (const df of [-2, 2]) for (const dr of [-2, 2]) b.box(f + df, r + dr, 0.32, 0.18, 0.6, 0.18, { c: '#4b5163', m: 'metal', deco: true });
      break;
    }
    case 'swing': {
      const f = -23.6;
      for (const r of [2.2, 6.8]) b.box(f, r, 2.1, 0.3, 4.1, 0.3, { c: '#ff8a3d' });
      b.box(f, 4.5, 4.2, 5.0, 0.3, 0.3, { c: '#ff8a3d' });
      for (const r of [3.4, 5.6]) {
        for (const dr of [-0.38, 0.38]) b.box(f, r + dr, 2.6, 0.05, 3.0, 0.05, { c: '#c7ccd6', deco: true, round: 0 });
        b.box(f, r, 1.05, 0.9, 0.12, 0.55, { c: '#ffd23f', deco: true });
      }
      break;
    }
    case 'pond': {
      const f = -27, r = 10.5;
      for (const [df, dr, w, d] of [[-3.2, 0, 5.6, 0.6], [3.2, 0, 5.6, 0.6], [0, -2.8, 0.6, 7.0], [0, 2.8, 0.6, 7.0]]) b.plat(f + df, r + dr, 0.6, w, d, { c: '#a7a9b4', m: 'stone', h: 0.5 });
      b.plat(f, r, 0.4, 5.0, 5.8, { c: '#3fc8ff', m: 'water', h: 0.1, deco: true, shadow: false });
      b.plat(f, r, 0.2, 5.0, 5.8, { c: '#2f8fbf', h: 0.1 });
      for (const [df, dr] of [[-1.2, -0.8], [1.3, 0.9]]) {
        b.box(f + df, r + dr, 0.65, 0.7, 0.45, 0.9, { c: '#ffd23f', shape: 'sphere', deco: true });
        b.box(f + df + 0.35, r + dr, 1.0, 0.42, 0.42, 0.42, { c: '#ffd23f', shape: 'sphere', deco: true });
        b.box(f + df + 0.62, r + dr, 0.98, 0.16, 0.12, 0.2, { c: '#ff8a3d', deco: true });
      }
      break;
    }
    case 'greenhouse': {
      const f0 = -31, f1 = -26.6, r0 = 14.4, r1 = 19.2, fm = (f0 + f1) / 2, rm = (r0 + r1) / 2;
      for (const f of [f0, f1]) for (const r of [r0, r1]) b.box(f, r, 1.5, 0.2, 3.0, 0.2, { c: '#ffffff' });
      b.box(f0, rm, 1.5, r1 - r0, 3.0, 0.1, { c: '#bfe9ff', k: 'glass' });
      b.box(fm, r1, 1.5, 0.1, 3.0, f1 - f0, { c: '#bfe9ff', k: 'glass' });
      b.box(fm, r0, 1.5, 0.1, 3.0, f1 - f0, { c: '#bfe9ff', k: 'glass' });
      b.box(f1, r1 - 0.9, 1.5, 1.8, 3.0, 0.1, { c: '#bfe9ff', k: 'glass' });
      b.box(fm, rm, 3.1, r1 - r0 + 0.2, 0.15, f1 - f0 + 0.2, { c: '#bfe9ff', k: 'glass' });
      for (const [df, dr, col] of [[-1.2, -1.2, '#ff5e7e'], [-1.2, 0.6, '#ffd23f'], [0.6, -1.2, '#9b5cff']]) {
        b.box(fm + df, rm + dr, 0.45, 0.7, 0.7, 0.7, { c: '#d9774b', shape: 'cyl', w2: 0.55 });
        b.box(fm + df, rm + dr, 1.15, 0.9, 0.9, 0.9, { c: '#4fbf5a', shape: 'sphere', deco: true });
        b.box(fm + df, rm + dr, 1.6, 0.35, 0.3, 0.35, { c: col, shape: 'sphere', deco: true });
      }
      break;
    }
    case 'soccer': {
      const f = -30.3, r = 4.5;
      for (const dr of [-2.4, 2.4]) b.box(f, r + dr, 1.25, 0.2, 2.5, 0.2, { c: '#ffffff' });
      b.box(f, r, 2.5, 5.0, 0.2, 0.2, { c: '#ffffff' });
      b.box(f - 0.5, r, 1.25, 4.8, 2.4, 0.05, { c: '#ffffff', k: 'glass', deco: true });
      b.box(-26.6, r, 0.6, 0.85, 0.85, 0.85, { c: '#ffffff', m: 'checker', shape: 'sphere', deco: true });
      b.plat(-27, r, 0.08, 0.15, 6.2, { c: '#ffffff', h: 0.04, deco: true, shadow: false, round: 0 });
      break;
    }
    // ───── 3단계: 하늘 섬 (뒷마당 위, 윗면 높이 SKY) ─────
    case 'skyisland': {
      const T = SKY;
      b.plat(-34, 0, T, 36, 20, { c: '#8fe07a', m: 'grass', h: 1.2, round: 0.4 });
      b.plat(-34, 0, T - 1.2, 34, 18, { c: '#c79a6b', m: 'stone', h: 1.6, round: 0.5, deco: true });
      const rnd = seeded(slot * 13 + 5);
      for (let k = 0; k < 14; k++) {
        const f = -42 + rnd() * 16, r = -15 + rnd() * 30, h = 2 + rnd() * 4, w = 2.5 + rnd() * 4;
        b.box(f, r, T - 2.8 - h / 2, w, h, w, { c: k % 3 ? '#a7835a' : '#8f6d4a', m: 'stone', shape: 'cone', rx: Math.PI, deco: true });
      }
      for (const [f, r, w, d] of [[-24.2, -9.5, 0.3, 17], [-24.2, 9.5, 0.3, 17], [-43.8, 0, 0.3, 36], [-34, -17.8, 20, 0.3], [-34, 17.8, 20, 0.3]]) b.plat(f, r, T + 1, w, d, { c: '#ffffff', h: 1.0 });
      // 엘리베이터: 뒷마당 땅(0.5)과 섬(T) 사이를 오르내린다
      b.plat(-22.2, -1.5, (T + 0.5) / 2, 3, 3, { c: '#ffd23f', h: 0.4, move: { ax: 'y', amp: (T - 0.5) / 2, spd: 0.35, ph: 0 } });
      for (const r of [-3.3, 0.3]) b.box(-22.2, r, T / 2 + 1, 0.25, T + 2, 0.25, { c: '#c7ccd6', m: 'metal' });
      b.box(-22.2, -1.5, T + 2.6, 4.0, 0.3, 0.6, { c: '#c7ccd6', m: 'metal', deco: true });
      break;
    }
    case 'windmill': {
      const f = -40, r = -13, T = SKY;
      b.box(f, r, T + 3.6, 2.8, 7.2, 2.8, { c: '#ffffff', shape: 'cyl', w2: 3.4 });
      b.box(f, r, T + 7.9, 3.3, 1.6, 3.3, { c: '#ff5e7e', shape: 'cone' });
      b.box(f + 1.7, r, T + 6.0, 0.7, 0.7, 0.6, { c: '#4b5163', m: 'metal', shape: 'sphere', deco: true });
      for (const base of [0, Math.PI / 2]) b.box(f + 2.0, r, T + 6.0, 0.6, 8.4, 0.12, { c: '#fff4d6', deco: true, turn: { ax: 'z', spd: 1.2, base } });
      b.box(f + 1.45, r, T + 1.1, 0.1, 2.0, 1.2, { c: '#8b5a3c', m: 'wood', deco: true });
      break;
    }
    case 'cloudgarden': {
      const T = SKY;
      for (const [f, r, sz] of [[-28, 13, 3.4], [-30, 15.5, 2.6], [-26.5, 15.8, 2.2], [-31.5, 12, 2.2]]) b.box(f, r, T + sz * 0.35, sz, sz * 0.7, sz, { c: '#ffffff', m: 'cloud', shape: 'sphere' });
      const rnd = seeded(slot * 17 + 11);
      const cols = ['#ff8fc7', '#b38cff', '#7fd6ff', '#ffd23f'];
      for (let k = 0; k < 18; k++) {
        const f = -36 + rnd() * 6, r = 6 + rnd() * 10;
        b.box(f, r, T + 0.35, 0.08, 0.7, 0.08, { c: '#3e9a48', deco: true, shadow: false, round: 0 });
        b.box(f, r, T + 0.75, 0.4, 0.3, 0.4, { c: cols[k % 4], shape: 'sphere', deco: true, shadow: false });
      }
      b.plat(-27, 9, T + 0.85, 3, 1, { c: '#c98a4b', m: 'wood', h: 0.2 });
      break;
    }
    case 'skybank': {
      const f = -40, r = 10, T = SKY;
      b.plat(f, r, T + 0.6, 7, 6, { c: '#f4efe6', m: 'stone', h: 0.6 });
      for (const dr of [-2.6, -0.9, 0.9, 2.6]) b.box(f + 2.4, r + dr, T + 2.8, 0.7, 4.2, 0.7, { c: '#ffffff', shape: 'cyl' });
      b.box(f - 0.6, r, T + 2.8, 6.2, 4.2, 3.6, { c: '#e9dfcf', m: 'stone' });
      b.box(f, r, T + 5.2, 7.2, 0.6, 6.2, { c: '#f4efe6', m: 'stone' });
      b.box(f, r, T + 6.1, 7.4, 1.2, 6.4, { c: '#e9dfcf', m: 'stone', shape: 'cone' });
      b.box(f + 2.8, r, T + 6.0, 1.6, 1.6, 0.2, { c: '#ffd23f', m: 'gold', shape: 'cyl', rx: Math.PI / 2, deco: true });
      break;
    }
    case 'balloon': {
      const f = -28.5, r = -13.5, T = SKY;
      const bob = { ax: 'y', amp: 0.7, spd: 0.8, ph: slot };
      b.box(f, r, T + 8.5, 5.4, 6.0, 5.4, { c: '#ff8a3d', shape: 'sphere', deco: true, move: bob });
      b.box(f, r, T + 9.2, 5.5, 2.0, 5.5, { c: '#ffd23f', shape: 'cyl', deco: true, move: bob });
      b.box(f, r, T + 5.0, 1.6, 1.4, 1.6, { c: '#ff5e7e', shape: 'cone', rx: Math.PI, deco: true, move: bob });
      b.box(f, r, T + 3.3, 1.6, 1.0, 1.6, { c: '#a0612f', m: 'wood', deco: true, move: bob });
      for (const [df, dr] of [[-0.7, -0.7], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7]]) b.box(f + df, r + dr, T + 4.4, 0.05, 1.4, 0.05, { c: '#4b5163', deco: true, round: 0, move: bob });
      b.plat(f, r, T + 0.1, 3.4, 3.4, { c: '#ff5e7e', h: 0.1, round: 0.04 });
      break;
    }
    case 'rainbow': {
      const T = SKY, cols = ['#ff4d5e', '#ff8a3d', '#ffd23f', '#5ad16b', '#3fa7ff', '#4a5cff', '#9b5cff'];
      cols.forEach((c, k) => {
        const R = 10 - k * 0.55;
        for (let a = 0; a <= 16; a++) {
          const ang = Math.PI * (a / 16);
          b.box(-43, Math.cos(ang) * R, T + Math.sin(ang) * R, 0.6, 0.55, 0.5, { c, m: 'neon', deco: true, shadow: false, round: 0.08 });
        }
      });
      break;
    }
    case 'skyfountain': {
      const f = -30, r = 2, T = SKY;
      b.plat(f, r, T + 0.7, 5, 5, { c: '#e9dfcf', m: 'stone', h: 0.7, shape: 'cyl' });
      b.plat(f, r, T + 0.75, 4.2, 4.2, { c: '#4cc3ff', m: 'water', h: 0.08, shape: 'cyl', deco: true, shadow: false });
      b.box(f, r, T + 1.8, 0.8, 2.2, 0.8, { c: '#e9dfcf', m: 'stone', shape: 'cyl' });
      b.box(f, r, T + 2.95, 2.4, 0.3, 2.4, { c: '#e9dfcf', m: 'stone', shape: 'cyl', deco: true });
      b.box(f, r, T + 3.9, 0.5, 2.0, 0.5, { c: '#9fe8ff', m: 'neon', shape: 'cyl', deco: true, shadow: false });
      b.box(f, r, T + 5.0, 1.0, 1.0, 1.0, { c: '#ffffff', m: 'neon', shape: 'sphere', deco: true, shadow: false });
      break;
    }
    case 'castle': {
      const f = -38.5, r = 0, T = SKY, c = '#d9d3ea', c2 = '#bdb3dc';
      b.box(f - 4.6, r, T + 2.5, 11, 5, 0.8, { c, m: 'stone' });
      b.box(f, r - 5.1, T + 2.5, 0.8, 5, 9.2, { c, m: 'stone' });
      b.box(f, r + 5.1, T + 2.5, 0.8, 5, 9.2, { c, m: 'stone' });
      b.box(f + 4.6, r - 3.4, T + 2.5, 4.2, 5, 0.8, { c, m: 'stone' });
      b.box(f + 4.6, r + 3.4, T + 2.5, 4.2, 5, 0.8, { c, m: 'stone' });
      b.box(f + 4.6, r, T + 4.4, 2.6, 1.2, 0.8, { c, m: 'stone' });
      for (let k = -5; k <= 5; k += 1.25) b.box(f - 4.6, r + k, T + 5.35, 0.6, 0.7, 0.9, { c: c2, deco: true });
      for (const [df, dr] of [[-4.6, -5.1], [-4.6, 5.1], [4.6, -5.1], [4.6, 5.1]]) {
        b.box(f + df, r + dr, T + 3.6, 2.6, 7.2, 2.6, { c: c2, m: 'stone', shape: 'cyl' });
        b.box(f + df, r + dr, T + 8.3, 3.2, 2.4, 3.2, { c: '#6c5ce7', shape: 'cone', deco: true });
        b.box(f + df, r + dr, T + 10.3, 0.08, 1.6, 0.08, { c: '#ffffff', deco: true, round: 0 });
        b.box(f + df, r + dr + 0.45, T + 10.7, 0.05, 0.6, 0.9, { c: '#ff5e7e', deco: true, flag: true });
      }
      b.plat(f, r, T + 0.06, 8.4, 9.4, { c: '#efe6d8', m: 'stone', h: 0.06, deco: true, shadow: false });
      break;
    }
    case 'starfactory': {
      const f = -29, r = 9.5, T = SKY;
      b.box(f, r, T + 2.0, 5, 4, 4.4, { c: '#4a5cff' });
      b.box(f, r, T + 4.25, 5.4, 0.5, 4.8, { c: '#2f3fbf' });
      b.box(f - 1.2, r + 1.4, T + 5.5, 0.8, 2.0, 0.8, { c: '#4b5163', m: 'metal', shape: 'cyl' });
      b.box(f + 2.22, r, T + 1.4, 0.06, 2.4, 1.6, { c: '#ffe066', m: 'neon', deco: true });
      b.box(f, r, T + 6.6, 1.3, 1.3, 1.3, { c: '#ffd23f', m: 'gold', shape: 'sphere', deco: true, turn: { ax: 'y', spd: 1.5 } });
      for (const [rx, rz] of [[0, 0], [Math.PI, 0], [Math.PI / 2, 0], [-Math.PI / 2, 0], [0, Math.PI / 2], [0, -Math.PI / 2]]) b.box(f, r, T + 6.6, 0.55, 2.6, 0.55, { c: '#ffd23f', m: 'gold', shape: 'cone', rx, rz, deco: true });
      break;
    }
    case 'ufo': {
      const f = -28.5, r = -4.5, T = SKY;
      const hover = { ax: 'y', amp: 0.5, spd: 1.3, ph: 1 };
      b.plat(f, r, T + 0.1, 6, 6, { c: '#3a3f4b', m: 'metal', h: 0.1, shape: 'cyl' });
      b.plat(f, r, T + 0.13, 4.4, 4.4, { c: '#7dff8a', m: 'neon', h: 0.05, shape: 'cyl', deco: true, shadow: false });
      b.box(f, r, T + 4.2, 6.4, 0.7, 6.4, { c: '#c7ccd6', m: 'metal', shape: 'cyl', w2: 4.4, deco: true, move: hover });
      b.box(f, r, T + 4.9, 3.0, 2.2, 3.0, { c: '#9fe8ff', k: 'glass', shape: 'sphere', deco: true, move: hover });
      b.box(f, r, T + 3.7, 2.0, 0.4, 2.0, { c: '#7dff8a', m: 'neon', shape: 'cyl', deco: true, move: hover, shadow: false });
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        b.box(f + Math.cos(a) * 2.9, r + Math.sin(a) * 2.9, T + 4.2, 0.4, 0.4, 0.4, { c: k % 2 ? '#ffe066' : '#ff6bf1', m: 'neon', shape: 'sphere', deco: true, move: hover, shadow: false });
      }
      break;
    }
    case 'crown': {
      const f = -38.5, r = 0, T = SKY;
      b.box(f, r, T + 4.5, 3.2, 9, 3.2, { c: '#ffd23f', m: 'gold', shape: 'cyl' });
      b.box(f, r, T + 9.4, 4.4, 0.8, 4.4, { c: '#ffd23f', m: 'gold', shape: 'cyl' });
      b.box(f, r, T + 10.6, 4.0, 1.6, 4.0, { c: '#ffd23f', m: 'gold', shape: 'cyl', w2: 3.4, deco: true });
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        b.box(f + Math.cos(a) * 1.8, r + Math.sin(a) * 1.8, T + 12.1, 0.6, 1.4, 0.6, { c: '#ffd23f', m: 'gold', shape: 'cone', deco: true });
        b.box(f + Math.cos(a) * 1.85, r + Math.sin(a) * 1.85, T + 10.7, 0.45, 0.45, 0.45, { c: ['#ff3b5c', '#3fa7ff', '#5ad16b', '#9b5cff'][k % 4], m: 'neon', shape: 'sphere', deco: true, shadow: false });
      }
      b.box(f, r, T + 12.4, 1.0, 1.0, 1.0, { c: '#ffffff', m: 'neon', shape: 'sphere', deco: true, shadow: false, turn: { ax: 'y', spd: 2 } });
      break;
    }
    case 'rocket': {
      const f = -27.6, r = -1.5;
      b.plat(f, r, 0.55, 5.6, 5.6, { c: '#4b5163', m: 'metal', h: 0.5 });
      b.box(f, r, 5.3, 2.2, 8.6, 2.2, { c: '#ffffff', shape: 'cyl' });
      for (const t of [3.0, 7.6]) b.box(f, r, t, 2.3, 0.5, 2.3, { c: '#ff4d5e', shape: 'cyl', deco: true });
      b.box(f, r, 10.9, 2.2, 2.6, 2.2, { c: '#ff4d5e', shape: 'cone', deco: true });
      b.box(f + 1.05, r, 6.4, 0.7, 0.7, 0.2, { c: '#3fa7ff', shape: 'sphere', deco: true });
      for (const [df, dr, w, d] of [[1.35, 0, 0.18, 1.0], [-1.35, 0, 0.18, 1.0], [0, 1.35, 1.0, 0.18], [0, -1.35, 1.0, 0.18]]) b.box(f + df, r + dr, 1.6, w, 1.6, d, { c: '#ff4d5e', deco: true });
      b.box(f, r, 0.75, 1.4, 0.5, 1.4, { c: '#ff9a3d', m: 'neon', shape: 'cone', rx: Math.PI, deco: true });
      b.box(f, r + 3.4, 5.0, 0.5, 9.0, 0.5, { c: '#c7ccd6', m: 'metal' });
      for (const t of [3.5, 7.0]) b.box(f, r + 2.5, t, 1.6, 0.2, 0.3, { c: '#c7ccd6', m: 'metal', deco: true });
      break;
    }
    case 'garden': {
      const rnd = seeded(slot * 31 + 7);
      for (const [f, r] of [[-3, 16], [9, 16.5], [3, 17]]) { const [x, y, z] = b.world(f, r, 0.05); tree(out, x, z, rnd, 0.9, y); }
      b.plat(-4, 8, 0.9, 1.2, 6, { c: '#3f9d4f', h: 0.9, round: 0.3 });
      break;
    }
    case 'pool': {
      const f0 = 3, r0 = 11.5;
      for (const [df, dr, w, d] of [[-4.3, 0, 7.6, 0.6], [4.3, 0, 7.6, 0.6], [0, -3.5, 0.6, 9.2], [0, 3.5, 0.6, 9.2]]) b.plat(f0 + df, r0 + dr, 1.3, w, d, { c: '#ffffff', h: 1.0 });
      b.plat(f0, r0, 1.05, 6.4, 8, { c: '#3fc8ff', m: 'water', h: 0.1, deco: true, shadow: false });
      b.plat(f0, r0, 0.4, 6.4, 8, { c: '#7fd6ff', h: 0.1 });
      b.plat(f0 - 5.5, r0, 0.4, 1.8, 6, { c: '#ffd23f', h: 0.12, round: 0.04 });
      break;
    }
    case 'slide': {
      for (let i = 0; i < 20; i++) b.plat(4.2, 3.4 + i * 0.5, 5.3 - i * 0.25, 0.5, 2.4, { k: 'conveyor', cv: [0, 6], h: 0.25, hidden: true });
      const [x0, y0, z0] = b.world(4.2, 3.15, 5.3), [x1, y1, z1] = b.world(4.2, 13.65, 0.3);
      const flat = Math.hypot(x1 - x0, z1 - z0), len = Math.hypot(flat, y1 - y0);
      const ry = Math.atan2(x1 - x0, z1 - z0), rx = Math.atan2(y0 - y1, flat);
      out.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 - 0.12, z: (z0 + z1) / 2, w: 2.6, h: 0.2, d: len, ry, rx, c: '#ff5ec4', deco: true });
      for (const s of [-1, 1]) {
        const [ax, , az] = b.world(4.2 + s * 1.3, 3.15, 0), [bx, , bz] = b.world(4.2 + s * 1.3, 13.65, 0);
        out.push({ x: (ax + bx) / 2, y: (y0 + y1) / 2 + 0.2, z: (az + bz) / 2, w: 0.2, h: 0.6, d: len, ry, rx, c: '#ffd23f', deco: true });
      }
      break;
    }
    case 'tower': {
      b.box(16.5, 16.5, 6.3, 3, 12.6, 3, { c: '#a7a9b4', m: 'stone' });
      b.box(14.7, 16.5, 6.6, 2.4, 13.2, 0.6, { k: 'ladder', c: '#c98a4b', m: 'wood' });
      b.plat(16.6, 16.5, 13.2, 3.6, 3.4, { c: '#ffffff', h: 0.6 });
      b.box(16.5, 16.5, 15.6, 0.2, 4.2, 0.2, { c: '#ffffff', shape: 'cyl', deco: true });
      b.box(16.5, 17.6, 16.8, 0.1, 1.3, 2.0, { c: PLOT_COLORS[slot], deco: true, flag: true });
      break;
    }
    case 'statue': {
      b.plat(10.5, 9, 1.35, 3.4, 3.4, { c: '#ffffff', m: 'stone', h: 1.3 });
      b.box(10.5, 9, 1.75, 0.7, 0.8, 0.7, { c: '#ffd23f', m: 'gold', shape: 'cyl' });
      b.box(10.5, 9, 3.05, 2.6, 1.8, 2.6, { c: '#ffd23f', m: 'gold', shape: 'cyl', w2: 1.0 });
      break;
    }
    default: break;
  }
}

export function buildTycoon() {
  const parts = [], signs = [], effects = [], coins = [];
  parts.push({ x: 0, y: -3, z: 0, w: 170, h: 6, d: 176, c: '#86cf5f', m: 'grass', round: 1.2, shadow: false });
  parts.push({ x: 0, y: -1.1, z: 0, w: 1600, h: 0.2, d: 1600, c: '#33a6ff', m: 'water', deco: true, shadow: false, round: 0 });
  for (const [x, z, w, d] of [[0, -89, 172, 2], [0, 89, 172, 2], [-86, 0, 2, 178], [86, 0, 2, 178]]) parts.push({ x, y: 4, z, w, h: 12, d, hidden: true });
  parts.push({ x: 0, y: 0.04, z: 0, w: 150, h: 0.12, d: 12, c: '#c7ccd6', m: 'stone', round: 0.05 });
  for (let x = -70; x <= 70; x += 7) parts.push({ x, y: 0.12, z: 0, w: 3, h: 0.04, d: 0.4, c: '#ffffff', deco: true, shadow: false, round: 0 });
  const rnd = seeded(77);
  for (let i = 0; i < 26; i++) {
    const x = (rnd() - 0.5) * 160, z = (rnd() > 0.5 ? 1 : -1) * (77 + rnd() * 8);
    tree(parts, x, z, rnd);
  }
  for (const x of [-74, 74]) for (const z of [-30, 30]) tree(parts, x, z, rnd);
  // 광장으로 가는 문
  effects.push({ type: 'portal', x: -68, y: 2.6, z: 0, w: 4, h: 4.4, color: '#3fa7ff', ry: Math.PI / 2 });
  parts.push({ x: -68, y: 0.15, z: 0, w: 4, h: 0.3, d: 6, c: '#ffffff' });
  for (const s of [-1, 1]) parts.push({ x: -68, y: 2.6, z: s * 2.6, w: 0.8, h: 5.2, d: 0.8, c: '#3fa7ff' });
  signs.push({ x: -67.6, y: 6.0, z: 0, ry: Math.PI / 2, w: 4.4, h: 1.1, lines: ['🏠 광장으로'], bg: '#ffffff', fg: '#2a6fb3', accent: '#3fa7ff', double: true });
  const zones = [{ x0: -69, x1: -67, y0: 0.3, y1: 5, z0: -2.2, z1: 2.2, portal: 0 }];
  return { parts, signs, effects, zones, coins, npcs: [], spawn: { x: 0, y: 0.2, z: -6, yaw: Math.PI }, sky: 'tycoon', killY: -15 };
}

// ───────────────────────── 바닥이 사라져요 ─────────────────────────

export const LAYER_COLORS = ['#ff7ab6', '#47d6ff', '#ffd84d'];

export function buildSurvival() {
  const parts = [], signs = [], effects = [], coins = [];
  const { LOBBY, LAVA } = SURVIVAL;
  parts.push({ x: 0, y: LAVA - 1, z: 0, w: 400, h: 2, d: 400, k: 'kill', round: 0, shadow: false });
  // 대기실
  parts.push({ x: 0, y: LOBBY - 0.4, z: 0, w: 22, h: 0.8, d: 22, c: '#d9f3ff', k: 'glass' });
  parts.push({ x: 0, y: LOBBY - 0.85, z: 0, w: 22.4, h: 0.1, d: 22.4, c: '#ffffff', deco: true, shadow: false });
  for (const [x, z, w, d] of [[0, -11, 22, 0.6], [0, 11, 22, 0.6], [-11, 0, 0.6, 22], [11, 0, 0.6, 22]]) parts.push({ x, y: LOBBY + 0.7, z, w, h: 1.4, d, c: '#9b5cff' });
  signs.push({ x: 0, y: LOBBY + 4.2, z: -11, ry: 0, w: 10, h: 2.8, lines: ['🔥 바닥이 사라져요', '밟은 바닥은 곧 떨어져요!', '마지막까지 남으면 승리!'], bg: '#2a1b4e', fg: '#ffffff', accent: '#ff5e7e', sizes: [60, 40, 40] });
  parts.push({ x: 0, y: LOBBY + 1.4, z: -11.2, w: 0.5, h: 2.6, d: 0.5, c: '#3a3f4b', m: 'metal', deco: true });
  // 광장 문
  effects.push({ type: 'portal', x: 8.5, y: LOBBY + 2, z: 8.5, w: 2.6, h: 3.4, color: '#3fa7ff', ry: -3 * Math.PI / 4 });
  signs.push({ x: 8.5, y: LOBBY + 4.3, z: 8.5, ry: -3 * Math.PI / 4, w: 3.4, h: 0.9, lines: ['🏠 광장으로'], bg: '#ffffff', fg: '#2a6fb3', accent: '#3fa7ff', double: true });
  const zones = [{ x0: 7.4, x1: 9.6, y0: LOBBY, y1: LOBBY + 3.5, z0: 7.4, z1: 9.6, portal: 0 }];
  // 기둥과 횃불
  const half = (SURVIVAL.N * SURVIVAL.TILE) / 2 + 3;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    parts.push({ x: sx * half, y: (LAVA + 4) / 2, z: sz * half, w: 2.6, h: 4 - LAVA + 2, d: 2.6, c: '#4a3a6b', m: 'stone' });
    parts.push({ x: sx * half, y: 5.4, z: sz * half, w: 1.4, h: 1.4, d: 1.4, c: '#ffb347', m: 'neon', shape: 'sphere', deco: true, shadow: false });
  }
  // 멀리 화산
  const rnd = seeded(5);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rnd() * 0.3, r = 120 + rnd() * 60, h = 30 + rnd() * 40;
    parts.push({ x: Math.cos(a) * r, y: LAVA + h / 2, z: Math.sin(a) * r, w: h * 1.4, h, d: h * 1.4, c: '#3a2a4a', m: 'stone', shape: 'cone', deco: true, shadow: false });
    parts.push({ x: Math.cos(a) * r, y: LAVA + h - 1, z: Math.sin(a) * r, w: h * 0.3, h: 2, d: h * 0.3, c: '#ff6a1a', m: 'neon', shape: 'cyl', deco: true, shadow: false });
  }
  return { parts, signs, effects, zones, coins, npcs: [], spawn: { x: 0, y: LOBBY, z: 4, yaw: Math.PI }, sky: 'survival', killY: LAVA - 5 };
}

// ───────────────────────── 하늘 타워 짓기 ─────────────────────────
// 돌판(24×24칸)이 6개. 혼자면 가운데(0번)가 내 땅, 친구 방에서는 들어온 순서(p1 → 0번)대로 각자 다른 땅에 짓는다.
// 블록과 이름표, 무지개 카펫은 src/tower.js 가 만든다.
export const TOWER_SLOTS = [[0, 0], [60, 0], [-60, 0], [0, -60], [60, -60], [-60, -60]];
export const TOWER_HALF = ((TOWER.MAX - TOWER.MIN + 1) * TOWER.CELL) / 2;
export const carpetHome = slot => { const [sx, sz] = TOWER_SLOTS[slot]; return [sx, 0, sz + TOWER_HALF + 2.6]; };

export function buildTower({ slot = 0 } = {}) {
  const parts = [], signs = [], effects = [], coins = [];
  const C = TOWER.CELL, half = TOWER_HALF;
  const [mx, mz] = TOWER_SLOTS[slot];
  // 풀밭은 돌판(윗면 0)보다 0.3 낮게: 같은 높이면 돌판이 풀에 묻혀 안 보인다
  parts.push({ x: 0, y: -3.3, z: -26, w: 186, h: 6, d: 136, c: '#7fcf5f', m: 'grass', round: 1.2, shadow: false });
  parts.push({ x: 0, y: -3.15, z: -26, w: 200, h: 5.2, d: 150, c: '#f5dfa6', m: 'sand', round: 2, shadow: false });
  parts.push({ x: 0, y: -1.1, z: 0, w: 1600, h: 0.2, d: 1600, c: '#33a6ff', m: 'water', deco: true, shadow: false, round: 0 });
  for (const [x, z, w, d] of [[0, -100, 206, 2], [0, 48, 206, 2], [-101, -26, 2, 150], [101, -26, 2, 150]]) parts.push({ x, y: 4, z, w, h: 12, d, hidden: true });
  TOWER_SLOTS.forEach(([sx, sz], n) => {
    const mine = n === slot;
    // 짓는 돌판: 윗면이 정확히 0 (블록 0층이 0~2)
    parts.push({ x: sx, y: -0.24, z: sz, w: half * 2 + 1.2, h: 0.4, d: half * 2 + 1.2, c: mine ? '#21c7b8' : '#9aa3b5', round: 0.12, shadow: false });
    parts.push({ x: sx, y: -0.15, z: sz, w: half * 2, h: 0.3, d: half * 2, c: mine ? '#eef3f6' : '#e3e6ec', m: 'grid', round: 0.02, shadow: false });
    // 높이 재는 기둥 (내 땅에만 10층마다 표지판)
    const px = sx + half + 3.5, pz = sz - half - 3.5;
    parts.push({ x: px, y: (TOWER.TOP + 1) * C / 2, z: pz, w: 0.9, h: (TOWER.TOP + 1) * C, d: 0.9, c: '#ffffff', shape: 'cyl' });
    for (let f = 10; f <= TOWER.TOP + 1; f += 10) {
      parts.push({ x: px, y: f * C, z: pz, w: 1.6, h: 0.3, d: 1.6, c: f % 50 ? '#21c7b8' : '#ffd23f', m: 'neon', shape: 'cyl', deco: true, shadow: false });
      if (mine) signs.push({ x: px - 1.0, y: f * C + 0.9, z: pz + 1.0, ry: -Math.PI / 4, w: 2.6, h: 1.1, lines: [`${f}층`], bg: f % 50 ? '#ffffff' : '#ffd23f', fg: '#1b4d4a', sizes: [90], double: true });
    }
  });
  signs.push({ x: mx + 7, y: 3.3, z: mz + half + 5.6, ry: 0, w: 9.5, h: 3.2, lines: ['🏗️ 하늘 타워 짓기', '클릭: 블록 놓기 · 오른쪽 클릭: 부수기', '🌈 무지개 카펫을 타면 꼭대기까지!'], bg: '#ffffff', fg: '#1b4d4a', accent: '#21c7b8', sizes: [76, 46, 46] });
  parts.push({ x: mx + 7, y: 1.6, z: mz + half + 5.7, w: 0.5, h: 3.2, d: 0.5, c: '#8b5a3c', m: 'wood', deco: true });
  // 광장으로 (내 땅 앞 왼쪽)
  const gx = mx - 13, gz = mz + half + 6;
  effects.push({ type: 'portal', x: gx, y: 2.4, z: gz, w: 3.4, h: 4.2, color: '#3fa7ff', ry: Math.PI / 2 });
  parts.push({ x: gx, y: 0, z: gz, w: 4, h: 0.3, d: 5, c: '#ffffff' });
  signs.push({ x: gx + 0.4, y: 5.4, z: gz, ry: Math.PI / 2, w: 3.8, h: 1, lines: ['🏠 광장으로'], bg: '#ffffff', fg: '#2a6fb3', accent: '#3fa7ff', double: true });
  const zones = [{ x0: gx - 1, x1: gx + 1, y0: 0, y1: 5, z0: gz - 2.2, z1: gz + 2.2, portal: 0 }];
  // 나무 (돌판과 그 앞은 피해서)
  const rnd = seeded(404);
  const busy = (x, z) => TOWER_SLOTS.some(([sx, sz]) => Math.abs(x - sx) < half + 9 && z > sz - half - 9 && z < sz + half + 12);
  for (let n = 0, tries = 0; n < 40 && tries < 500; tries++) {
    const x = (rnd() - 0.5) * 176, z = -26 + (rnd() - 0.5) * 126;
    if (busy(x, z)) continue;
    tree(parts, x, z, rnd); n++;
  }
  return { parts, signs, effects, zones, coins, npcs: [], spawn: { x: mx, y: 0.1, z: mz + half + 9, yaw: Math.PI }, sky: 'tower', killY: -15 };
}

// ───────────────────────── 블록 배틀 로얄 ─────────────────────────
// 섬(지름 약 200)에 마을, 창고, 저격 탑, 상자, 바위, 언덕. 하늘 대기실에서 시작해 낙하산으로 내려간다.
// loot: 블래스터와 회복 주스, 방패가 놓일 수 있는 자리 (src/battle.js 가 판마다 골라 놓는다).
export const BATTLE_LOBBY = { x: 0, y: 92, z: 0 };

// 축(axis)을 따라 a0~a1 에 서는 벽. holes: [{ a: 가운데, w: 너비, y0, y1 }] 를 뚫는다.
function wall(out, axis, fixed, a0, a1, h, holes, c, t = 0.5) {
  const put = (a, b, y0, y1) => {
    if (b - a < 0.05 || y1 - y0 < 0.05) return;
    const mid = (a + b) / 2, len = b - a;
    out.push(axis === 'x' ? { x: mid, y: (y0 + y1) / 2, z: fixed, w: len, h: y1 - y0, d: t, c } : { x: fixed, y: (y0 + y1) / 2, z: mid, w: t, h: y1 - y0, d: len, c });
  };
  const hs = [...holes].sort((p, q) => p.a - q.a);
  let a = a0;
  for (const hole of hs) {
    const h0 = hole.a - hole.w / 2, h1 = hole.a + hole.w / 2;
    put(a, h0, 0, h);
    put(h0, h1, 0, hole.y0);
    put(h0, h1, hole.y1, h);
    a = h1;
  }
  put(a, a1, 0, h);
}

function bHouse(out, loot, x, z, w, d, h, c, roofC, door = 's') {
  out.push({ x, y: 0.1, z, w, h: 0.2, d, c: '#d9c3a5', m: 'wood', round: 0.02 });
  const doorHole = { w: 2.4, y0: 0, y1: 3 }, win = { w: 2, y0: 1.2, y1: 2.4 };
  const sides = { s: ['x', z + d / 2, x - w / 2, x + w / 2, x], n: ['x', z - d / 2, x - w / 2, x + w / 2, x], e: ['z', x + w / 2, z - d / 2, z + d / 2, z], w: ['z', x - w / 2, z - d / 2, z + d / 2, z] };
  for (const [k, [axis, fixed, a0, a1, mid]] of Object.entries(sides)) {
    const holes = k === door ? [{ ...doorHole, a: mid }] : [{ ...win, a: mid + (k === 'n' || k === 'w' ? -1 : 1) * (Math.min(w, d) * 0.18) }];
    wall(out, axis, fixed, a0, a1, h, holes, c);
  }
  out.push({ x, y: h + 0.25, z, w: w + 0.8, h: 0.5, d: d + 0.8, c: roofC });
  for (const [px, pz, pw, pd] of [[x, z - d / 2 - 0.15, w + 0.8, 0.3], [x, z + d / 2 + 0.15, w + 0.8, 0.3], [x - w / 2 - 0.15, z, 0.3, d + 0.8], [x + w / 2 + 0.15, z, 0.3, d + 0.8]]) out.push({ x: px, y: h + 0.85, z: pz, w: pw, h: 0.7, d: pd, c: roofC });
  // 지붕으로 가는 사다리 (문 반대쪽 바깥)
  const back = { s: [x, z - d / 2 - 0.35, 2.2, 0.5], n: [x, z + d / 2 + 0.35, 2.2, 0.5], e: [x - w / 2 - 0.35, z, 0.5, 2.2], w: [x + w / 2 + 0.35, z, 0.5, 2.2] }[door];
  out.push({ x: back[0], y: (h + 1.2) / 2, z: back[1], w: back[2], h: h + 1.2, d: back[3], k: 'ladder', c: '#a0612f', m: 'wood' });
  loot.push([x - w * 0.22, 0.7, z], [x + w * 0.22, 0.7, z - d * 0.2]);
  loot.push([x, h + 1.1, z]);
}

function bTower(out, loot, x, z, c) {
  out.push({ x, y: 7, z, w: 3, h: 14, d: 3, c, m: 'stone' });
  out.push({ x: x + 1.8, y: 7.3, z, w: 0.6, h: 14.6, d: 2.2, k: 'ladder', c: '#a0612f', m: 'wood' });
  out.push({ x, y: 14.3, z, w: 6, h: 0.6, d: 6, c: '#c7ccd6', m: 'metal' });
  for (const [px, pz, pw, pd] of [[x, z - 2.85, 6, 0.3], [x, z + 2.85, 6, 0.3], [x - 2.85, z, 0.3, 6]]) out.push({ x: px, y: 15.1, z: pz, w: pw, h: 1.0, d: pd, c: '#c7ccd6', m: 'metal' });
  loot.push([x - 1, 15.2, z]);
}

function bWarehouse(out, loot, x, z, rnd) {
  const w = 26, d = 16, h = 6.5, c = '#9aa3b5';
  out.push({ x, y: 0.1, z, w, h: 0.2, d, c: '#b8bcc6', m: 'stone', round: 0.02 });
  wall(out, 'x', z - d / 2, x - w / 2, x + w / 2, h, [{ a: x, w: 5, y0: 0, y1: 4.5 }], c, 0.6);
  wall(out, 'x', z + d / 2, x - w / 2, x + w / 2, h, [{ a: x, w: 5, y0: 0, y1: 4.5 }], c, 0.6);
  wall(out, 'z', x - w / 2, z - d / 2, z + d / 2, h, [{ a: z, w: 2.5, y0: 1.5, y1: 3 }], c, 0.6);
  wall(out, 'z', x + w / 2, z - d / 2, z + d / 2, h, [{ a: z, w: 2.5, y0: 1.5, y1: 3 }], c, 0.6);
  out.push({ x, y: h + 0.3, z, w: w + 1, h: 0.6, d: d + 1, c: '#5b6275', m: 'metal' });
  for (let k = 0; k < 7; k++) {
    const cx = x + (rnd() - 0.5) * (w - 6), cz = z + (rnd() - 0.5) * (d - 6), n = 1 + Math.floor(rnd() * 2);
    for (let q = 0; q < n; q++) out.push({ x: cx, y: 1 + q * 2, z: cz, w: 2, h: 2, d: 2, c: '#b9824f', m: 'wood' });
  }
  loot.push([x - 8, 0.7, z], [x + 8, 0.7, z], [x, 0.7, z - 3]);
}

// 섬 한가운데 성 (팀전에서 지킨다. 개인전에서는 그냥 큰 건물)
// 동서남북 성문, 성문에서 바깥으로 곧은 길, 길 끝에 몬스터가 나오는 보라색 포털.
export const CASTLE = {
  half: 20, wall: 6,
  gates: [[0, -20], [20, 0], [0, 20], [-20, 0]],
  spawns: [[0, -118], [118, 0], [0, 118], [-118, 0]],
  // 동료 봇이 서는 성벽 위 자리
  posts: [[6, -20], [20, 6], [-6, 20], [-20, -6], [-6, -20], [20, -6], [6, 20], [-20, 6]],
  starts: [[-10, 10], [10, 10], [-10, -10], [10, -10], [0, 13], [13, 0], [-13, 0], [0, -13]],
};

function bCastle(out, loot, effects) {
  const H = CASTLE.wall, half = CASTLE.half, c = '#d9d3ea', c2 = '#bdb3dc';
  out.push({ x: 0, y: 0.06, z: 0, w: half * 2, h: 0.12, d: half * 2, c: '#e9e2d4', m: 'stone', round: 0.04 });
  // 북쪽 벽 기준으로 만들고 90도씩 돌린다: k=0 북(-z), 1 동(+x), 2 남(+z), 3 서(-x)
  const rot = (x, z, k) => [[x, z], [-z, x], [-x, -z], [z, -x]][k];
  const put = (k, x, z, y, w, h, d, extra = {}) => { const [rx, rz] = rot(x, z, k); out.push({ ...extra, x: rx, y, z: rz, w: k % 2 ? d : w, h, d: k % 2 ? w : d }); };
  for (let k = 0; k < 4; k++) {
    // 벽 (가운데 성문 6칸, 높이 4.5)
    for (const [a0, a1] of [[-half - 1, -3], [3, half + 1]]) put(k, (a0 + a1) / 2, -half, H / 2, a1 - a0, H, 2, { c, m: 'stone' });
    put(k, 0, -half, (4.5 + H) / 2, 6, H - 4.5, 2, { c, m: 'stone' });
    // 성가퀴 (벽 위 낮은 담)
    for (let x = -half + 1; x <= half - 1; x += 2.6) put(k, x, -half - 0.75, H + 0.45, 1.1, 0.9, 0.5, { c: c2, m: 'stone' });
    // 안쪽 계단: 성문 옆에서 모퉁이 쪽으로 올라간다 (한 칸 0.6)
    for (let i = 0; i < 10; i++) put(k, -5 - i * 1.15, -half + 2.05, (0.6 * (i + 1)) / 2, 1.15, 0.6 * (i + 1), 2.1, { c: '#c9bfa8', m: 'stone' });
    // 성문 위 깃발
    put(k, 0, -half - 1.1, H + 2.2, 0.15, 3.4, 0.15, { c: '#ffffff', shape: 'cyl', deco: true });
    put(k, 0.8, -half - 1.1, H + 3.3, 1.5, 1.0, 0.08, { c: '#ff5e7e', deco: true, flag: true });
  }
  // 모퉁이 탑
  for (const [x, z] of [[-half, -half], [half, -half], [half, half], [-half, half]]) {
    out.push({ x, y: 4.5, z, w: 5.5, h: 9, d: 5.5, c: c2, m: 'stone', shape: 'cyl' });
    out.push({ x, y: 10.4, z, w: 6.4, h: 2.8, d: 6.4, c: '#6c5ce7', shape: 'cone', deco: true });
  }
  // 가운데 받침대 (성의 보석은 src/defense.js 가 올린다)
  out.push({ x: 0, y: 0.6, z: 0, w: 5, h: 1.2, d: 5, c: '#ffffff', m: 'stone', shape: 'cyl' });
  out.push({ x: 0, y: 1.25, z: 0, w: 4, h: 0.1, d: 4, c: '#7dfcff', m: 'neon', shape: 'cyl', deco: true, shadow: false });
  // 길과 가로등, 길 끝 포털
  CASTLE.spawns.forEach(([sx, sz], k) => {
    const [gx, gz] = CASTLE.gates[k];
    const mx = (gx + sx) / 2, mz = (gz + sz) / 2, len = Math.hypot(sx - gx, sz - gz) + 4;
    out.push({ x: mx, y: 0.05, z: mz, w: k % 2 ? len : 7, h: 0.1, d: k % 2 ? 7 : len, c: '#d6ccb8', m: 'stone', round: 0.03, shadow: false });
    for (let t = 0.2; t < 1; t += 0.2) {
      const x = gx + (sx - gx) * t, z = gz + (sz - gz) * t;
      for (const s of [-1, 1]) lamp(out, x + (k % 2 ? 0 : s * 5), z + (k % 2 ? s * 5 : 0));
    }
    effects.push({ type: 'portal', x: sx, y: 3, z: sz, w: 5, h: 6, color: '#9b5cff', ry: k % 2 ? Math.PI / 2 : 0 });
    out.push({ x: sx, y: 0.2, z: sz, w: 8, h: 0.4, d: 8, c: '#4a3a6b', m: 'stone', round: 0.1 });
  });
  loot.push([0, 1.8, 0], [12, 0.7, 12], [-12, 0.7, -12], [12, H + 0.6, -half], [-12, H + 0.6, half]);
}

export function buildBattle() {
  const parts = [], signs = [], effects = [], coins = [], loot = [];
  const rnd = seeded(5150);
  const R = 245; // 섬 반지름 (지름 약 500)
  parts.push({ x: 0, y: -3, z: 0, w: R * 2 + 14, h: 6, d: R * 2 + 14, c: '#7cc95a', m: 'grass', round: 2, shadow: false });
  parts.push({ x: 0, y: -2.85, z: 0, w: R * 2 + 40, h: 5.2, d: R * 2 + 40, c: '#f5dfa6', m: 'sand', round: 3, shadow: false });
  parts.push({ x: 0, y: -1.1, z: 0, w: 3000, h: 0.2, d: 3000, c: '#33a6ff', m: 'water', deco: true, shadow: false, round: 0 });
  const E = R + 22;
  for (const [x, z, w, d] of [[0, -E, E * 2 + 4, 2], [0, E, E * 2 + 4, 2], [-E, 0, 2, E * 2 + 4], [E, 0, 2, E * 2 + 4]]) parts.push({ x, y: 4, z, w, h: 14, d, hidden: true });
  // 하늘 대기실
  const L = BATTLE_LOBBY;
  parts.push({ x: L.x, y: L.y - 0.4, z: L.z, w: 26, h: 0.8, d: 26, c: '#d9f3ff', k: 'glass' });
  parts.push({ x: L.x, y: L.y - 0.85, z: L.z, w: 26.4, h: 0.1, d: 26.4, c: '#ffffff', deco: true, shadow: false });
  for (const [x, z, w, d] of [[0, -13, 26, 0.6], [0, 13, 26, 0.6], [-13, 0, 0.6, 26], [13, 0, 0.6, 26]]) parts.push({ x: L.x + x, y: L.y + 0.8, z: L.z + z, w, h: 1.6, d, c: '#ff5e3a' });
  signs.push({ x: L.x, y: L.y + 4.4, z: L.z - 13, ry: 0, w: 11, h: 3.2, lines: ['🎯 블록 배틀 로얄', '블래스터를 주워 마지막까지 남으면 승리!', '줄어드는 안전 구역 안에 있어야 해'], bg: '#2a1b0e', fg: '#ffffff', accent: '#ff5e3a', sizes: [66, 40, 40] });
  parts.push({ x: L.x, y: L.y + 1.4, z: L.z - 13.2, w: 0.5, h: 2.8, d: 0.5, c: '#3a3f4b', m: 'metal', deco: true });
  effects.push({ type: 'portal', x: L.x + 9.5, y: L.y + 2, z: L.z + 9.5, w: 2.6, h: 3.4, color: '#3fa7ff', ry: -3 * Math.PI / 4 });
  signs.push({ x: L.x + 9.5, y: L.y + 4.3, z: L.z + 9.5, ry: -3 * Math.PI / 4, w: 3.4, h: 0.9, lines: ['🏠 광장으로'], bg: '#ffffff', fg: '#2a6fb3', accent: '#3fa7ff', double: true });
  const zones = [{ x0: L.x + 8.4, x1: L.x + 10.6, y0: L.y, y1: L.y + 3.5, z0: L.z + 8.4, z1: L.z + 10.6, portal: 0 }];
  // 마을 7곳: 가운데 광장 둘레에 집
  const busy = [];
  const towns = [[72, 76], [-150, -120], [150, -110], [-145, 130], [140, 145], [40, -200], [-205, 40]];
  const doors = ['s', 'w', 'n', 'e'];
  towns.forEach(([tx, tz], t) => {
    parts.push({ x: tx, y: 0.06, z: tz, w: 16, h: 0.12, d: 16, c: '#e9dfcf', m: 'stone', round: 0.05 });
    const n = t === 0 ? 8 : 6 + (t % 2);
    for (let h = 0; h < n; h++) {
      const a = (h / n) * Math.PI * 2 + t * 0.4, d = 20 + (h % 2) * 6;
      const x = tx + Math.cos(a) * d, z = tz + Math.sin(a) * d;
      // 문은 광장 쪽으로
      const door = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 'w' : 'e') : (Math.sin(a) > 0 ? 'n' : 's');
      const hue = (t * 50 + h * 37) % 360;
      bHouse(parts, loot, x, z, 8 + (h % 2), 7 + (h % 3), 3.6 + (h % 3 === 0 ? 0.6 : 0), hsl(hue, 60, 84), hsl(hue, 55, 46), door);
      busy.push([x, z, 9]);
    }
    busy.push([tx, tz, 12]);
    void doors;
  });
  // 성과 네 갈래 길 (다른 것이 길을 막지 않게)
  bCastle(parts, loot, effects);
  busy.push([0, 0, 34]);
  for (const [sx, sz] of CASTLE.spawns) for (let t = 0.15; t <= 1.05; t += 0.07) busy.push([sx * t, sz * t, 8]);
  // 창고 5개
  for (const [x, z] of [[90, 30], [-80, -40], [60, -170], [-60, 190], [200, 60]]) { bWarehouse(parts, loot, x, z, rnd); busy.push([x, z, 18]); }
  // 저격 탑 8개
  for (const [x, z, c] of [[44, 44, '#c7ccd6'], [110, -40, '#b0a8c8'], [-110, -60, '#a8c0b0'], [-40, 110, '#c8b8a8'], [190, -190, '#c7ccd6'], [-190, -190, '#b0a8c8'], [190, 200, '#a8c0b0'], [-190, 200, '#c8b8a8']]) { bTower(parts, loot, x, z, c); busy.push([x, z, 5]); }
  // 언덕 10개
  for (let k = 0; k < 10; k++) {
    const a = k * 2.4 + 0.7, d = 70 + (k % 4) * 40;
    const x = Math.cos(a) * d, z = Math.sin(a) * d, s = 0.9 + (k % 3) * 0.25;
    if (busy.some(([bx, bz, br]) => Math.hypot(x - bx, z - bz) < br + 14)) continue;
    for (let q = 0; q < 4; q++) parts.push({ x, y: q * 1.5, z, w: (22 - q * 5) * s, h: 1.5, d: (18 - q * 4) * s, c: hsl(100 - q * 6, 45, 52 - q * 3), m: 'grass', round: 0.3 });
    loot.push([x, 6.2, z]);
    busy.push([x, z, 14]);
  }
  // 상자 무더기, 바위
  for (let k = 0, tries = 0; k < 150 && tries < 900; tries++) {
    const x = (rnd() - 0.5) * R * 2, z = (rnd() - 0.5) * R * 2;
    if (Math.hypot(x, z) > R - 6 || busy.some(([bx, bz, br]) => Math.hypot(x - bx, z - bz) < br + 3)) continue;
    const n = 1 + Math.floor(rnd() * 3);
    for (let q = 0; q < n; q++) parts.push({ x: x + (q === 2 ? 2.1 : 0), y: 1 + (q === 1 ? 2 : 0), z, w: 2, h: 2, d: 2, c: '#b9824f', m: 'wood' });
    if (k % 2 === 0) loot.push([x + 2.6, 0.7, z]);
    k++;
  }
  for (let k = 0; k < 70; k++) {
    const x = (rnd() - 0.5) * R * 2, z = (rnd() - 0.5) * R * 2, s = 2 + rnd() * 3.5;
    if (Math.hypot(x, z) > R - 4 || busy.some(([bx, bz, br]) => Math.hypot(x - bx, z - bz) < br + 2)) continue;
    parts.push({ x, y: s * 0.35, z, w: s * 1.4, h: s, d: s, c: '#a7a9b4', m: 'stone', ry: rnd() * 3, round: 0.5 });
  }
  // 나무 250그루
  for (let n = 0, tries = 0; n < 250 && tries < 2500; tries++) {
    const x = (rnd() - 0.5) * R * 2, z = (rnd() - 0.5) * R * 2;
    if (Math.hypot(x, z) > R - 3 || busy.some(([bx, bz, br]) => Math.hypot(x - bx, z - bz) < br)) continue;
    tree(parts, x, z, rnd); n++;
  }
  return { parts, signs, effects, zones, coins, loot, npcs: [], spawn: { x: L.x, y: L.y + 0.1, z: L.z + 5, yaw: Math.PI }, sky: 'hub', killY: -20, island: R };
}

// ───────────────────────── 술래잡기 마을 (술래잡기 · 숨바꼭질) ─────────────────────────
// 가운데 "술래 집"에서 시작. 집 4채(옷장, 침대), 덤불, 키 큰 풀밭, 상자 더미, 굴, 짚더미, 놀이터가 숨을 곳.
// spots: 봇이 숨거나 찾으러 가는 곳. cover: 덤불·풀숲처럼 가까이 와야 보이는 곳.
export const TAG_HALF = 44;
export const TAG_HOME = [-9, 12.5];
export const TAG_STARTS = [[-10, -8], [10, -8], [-10, 8], [10, 8], [0, -20], [0, 20], [-20, 8], [20, -8], [-34, 24], [34, -24], [-24, -37], [24, 37]];

function bush(out, x, z, rnd, s = 1) {
  const cols = ['#3faa55', '#4fbf5a', '#2f9d63', '#5cc95f'];
  out.push({ x, y: 1.35 * s, z, w: 3.8 * s, h: 2.9 * s, d: 3.6 * s, c: cols[Math.floor(rnd() * 4)], shape: 'sphere', deco: true });
  out.push({ x: x + 1.1 * s, y: 1.1 * s, z: z + 0.7 * s, w: 2.6 * s, h: 2.2 * s, d: 2.6 * s, c: cols[Math.floor(rnd() * 4)], shape: 'sphere', deco: true });
  out.push({ x: x - 1.0 * s, y: 1.0 * s, z: z - 0.8 * s, w: 2.4 * s, h: 2.0 * s, d: 2.4 * s, c: cols[Math.floor(rnd() * 4)], shape: 'sphere', deco: true });
  for (let i = 0; i < 3; i++) out.push({ x: x + (rnd() - 0.5) * 3 * s, y: 1.6 * s + rnd() * 1.1 * s, z: z + (rnd() - 0.5) * 3 * s, w: 0.35, h: 0.35, d: 0.35, c: ['#ff5e7e', '#ffffff', '#ffd23f'][i], shape: 'sphere', deco: true, shadow: false });
}

export function buildTag() {
  const parts = [], signs = [], effects = [], zones = [], coins = [], npcs = [], spots = [];
  const rnd = seeded(20261121);
  const H = TAG_HALF;
  parts.push({ x: 0, y: -1, z: 0, w: H * 2 + 6, h: 2, d: H * 2 + 6, c: '#7cc95a', m: 'grass', round: 0.4, shadow: false });
  parts.push({ x: 0, y: -1.2, z: 0, w: 700, h: 0.2, d: 700, c: '#8fd16a', m: 'grass', deco: true, shadow: false, round: 0 });
  // 울타리 (안 보이는 벽 + 하얀 나무 울타리)
  for (const [x, z, w, d] of [[0, -H, H * 2, 1], [0, H, H * 2, 1], [-H, 0, 1, H * 2], [H, 0, 1, H * 2]]) parts.push({ x, y: 4, z, w, h: 8, d, hidden: true });
  for (let a = -H; a <= H; a += 1.6) {
    for (const [x, z] of [[a, -H], [a, H], [-H, a], [H, a]]) parts.push({ x, y: 0.75, z, w: 0.3, h: 1.5, d: 0.3, c: '#ffffff', deco: true, round: 0.05 });
  }
  for (const y of [0.6, 1.2]) for (const [x, z, w, d] of [[0, -H, H * 2, 0.14], [0, H, H * 2, 0.14], [-H, 0, 0.14, H * 2], [H, 0, 0.14, H * 2]]) parts.push({ x, y, z, w, h: 0.14, d, c: '#ffffff', deco: true, shadow: false, round: 0 });
  // 길
  for (const [x, z, w, d] of [[0, -24, 4, 36], [0, 24, 4, 36], [-24, 0, 36, 4], [24, 0, 36, 4]]) parts.push({ x, y: 0.03, z, w, h: 0.06, d, c: '#e9dfcf', m: 'stone', deco: true, shadow: false, round: 0 });
  // 술래 집 (가운데 돌 마당, 기둥, 팻말)
  parts.push({ x: 0, y: 0.06, z: 0, w: 13, h: 0.12, d: 13, c: '#efe6d8', m: 'stone', shape: 'cyl' });
  parts.push({ x: 0, y: 2.2, z: 0, w: 1, h: 4.4, d: 1, c: '#8b5a3c', m: 'wood' });
  parts.push({ x: 0, y: 4.7, z: 0, w: 1.6, h: 0.6, d: 1.6, c: '#ff5e7e', round: 0.2 });
  signs.push({ x: 0, y: 5.9, z: 0, ry: 0, w: 4.2, h: 1.5, double: true, lines: ['👹 술래 집'], bg: '#ffffff', fg: '#e0335a', accent: '#ff5e7e' });
  signs.push({ x: 0, y: 2.6, z: -6.8, ry: 0, w: 7.2, h: 3.2, lines: ['🏃 술래잡기: 술래에게 닿으면 내가 술래!', '🙈 숨바꼭질: 20초 동안 숨어! 찾으면 술래 편', '대기실에서 숫자 1, 2 로 고르기'], bg: '#ffffff', fg: '#2a2d3a', accent: '#ff8fc7', sizes: [64, 64, 56] });
  parts.push({ x: 0, y: 1.0, z: -6.85, w: 0.3, h: 2, d: 0.3, c: '#8b5a3c', m: 'wood', deco: true });
  for (const [x, z] of [[-6, 6], [6, 6], [-6, -6], [6, -6]]) lamp(parts, x, z);
  for (const [x, z, a] of [[-4, 9, true], [4, 9, true]]) bench(parts, x, z, a);
  // 광장으로 가는 문 (2026-11-22 인혁: "광장으로 돌아가는 포탈이 없어 만들어줘"). 시작 자리 옆, 길과 출발 자리는 비켜서
  {
    const [gx, gz] = TAG_HOME;
    parts.push({ x: gx, y: 0.08, z: gz, w: 3.2, h: 0.16, d: 5.4, c: '#ffffff', round: 0.06 });
    for (const s of [-1, 1]) {
      parts.push({ x: gx, y: 2.4, z: gz + s * 2.5, w: 0.7, h: 4.8, d: 0.7, c: '#3fa7ff' });
      parts.push({ x: gx, y: 5.0, z: gz + s * 2.5, w: 1.0, h: 0.4, d: 1.0, c: '#ffffff' });
    }
    parts.push({ x: gx, y: 5.3, z: gz, w: 0.8, h: 0.6, d: 5.8, c: '#3fa7ff' });
    effects.push({ type: 'portal', x: gx, y: 2.4, z: gz, w: 4.2, h: 4.4, color: '#3fa7ff', ry: Math.PI / 2 });
    signs.push({ x: gx, y: 6.4, z: gz, ry: Math.PI / 2, w: 3.8, h: 1, lines: ['🏠 광장으로'], bg: '#ffffff', fg: '#2a6fb3', accent: '#3fa7ff', double: true });
    zones.push({ x0: gx - 0.6, x1: gx + 0.6, y0: 0, y1: 4.5, z0: gz - 2.0, z1: gz + 2.0, portal: 0 });
  }
  // 집 4채 (문은 가운데 쪽), 안에 옷장과 침대
  const dummy = [];
  for (const [x, z, door, c, roof] of [[-26, -26, 's', '#ffe2b8', '#ff7a59'], [26, -26, 's', '#d8f0ff', '#3fa7ff'], [-26, 26, 'n', '#e6ffd8', '#4fbf5a'], [26, 26, 'n', '#ffe0f0', '#ff5ec4']]) {
    bHouse(parts, dummy, x, z, 11, 9, 4, c, roof, door);
    const back = door === 's' ? -1 : 1; // 문 반대쪽 벽 방향 (z)
    const wz = z + back * 4.5;
    // 옷장 (문 쪽이 열려 있고 안에 들어갈 수 있다)
    const cx = x + 3, cz = wz - back * 1.0;
    parts.push({ x: cx - 1.35, y: 1.7, z: cz, w: 0.25, h: 3.4, d: 1.8, c: '#a0612f', m: 'wood' });
    parts.push({ x: cx + 1.35, y: 1.7, z: cz, w: 0.25, h: 3.4, d: 1.8, c: '#a0612f', m: 'wood' });
    parts.push({ x: cx, y: 3.5, z: cz, w: 2.95, h: 0.25, d: 1.8, c: '#8b5a3c', m: 'wood' });
    parts.push({ x: cx - 0.9, y: 1.7, z: cz - back * 0.95, w: 0.9, h: 3.0, d: 0.1, c: '#c98a4b', m: 'wood', deco: true, ry: back * 0.9 });
    spots.push({ x: cx, z: cz + back * 0.1, cover: true, room: [x, z, door], way: [[x, z + back * 0.5], [cx, z + back * 1.8]] });
    // 침대와 이불, 침대 뒤 구석
    parts.push({ x: x - 2.0, y: 0.55, z: wz - back * 2.1, w: 2.6, h: 0.7, d: 3.8, c: '#ffffff', round: 0.12 });
    parts.push({ x: x - 2.0, y: 0.95, z: wz - back * 2.6, w: 2.7, h: 0.18, d: 2.6, c: c === '#ffe2b8' ? '#ff9a76' : roof, deco: true, round: 0.08 });
    parts.push({ x: x - 2.0, y: 1.0, z: wz - back * 0.6, w: 2.0, h: 0.4, d: 0.8, c: '#fff6e0', deco: true, round: 0.15 });
    spots.push({ x: x - 4.3, z: wz - back * 0.8, cover: false, room: [x, z, door], way: [[x - 4.3, z - back * 0.2]] });
    // 식탁
    parts.push({ x: x + 2.5, y: 1.1, z: z + back * -1.2, w: 2.2, h: 0.2, d: 1.6, c: '#c98a4b', m: 'wood' });
    for (const [dx, dz] of [[-0.9, -0.6], [0.9, -0.6], [-0.9, 0.6], [0.9, 0.6]]) parts.push({ x: x + 2.5 + dx, y: 0.5, z: z + back * -1.2 + dz, w: 0.16, h: 1.0, d: 0.16, c: '#8b5a3c', m: 'wood', deco: true });
  }
  // 덤불 (안에 쏙 들어가 숨을 수 있다)
  const bushes = [[-14, -4], [-16, 6], [14, -6], [16, 5], [-6, -15], [6, -17], [-5, 16], [7, 15], [-38, -12], [-38, 14], [38, -14], [38, 12], [-12, -38], [14, -38], [-14, 38], [12, 38], [-38, -38], [38, 38], [38, -38], [-38, 38]];
  for (const [x, z] of bushes) { bush(parts, x, z, rnd); spots.push({ x, z, cover: true }); }
  // 키 큰 풀밭
  {
    const ox = 0, oz = -30;
    parts.push({ x: ox, y: 0.05, z: oz, w: 13, h: 0.1, d: 8, c: '#5aa845', m: 'grass', deco: true, shadow: false, round: 0 });
    for (let i = 0; i < 150; i++) {
      const gx = ox + (rnd() - 0.5) * 12.4, gz = oz + (rnd() - 0.5) * 7.4, h = 2.6 + rnd() * 1.2;
      parts.push({ x: gx, y: h / 2, z: gz, w: 0.18, h, d: 0.18, c: ['#4fae47', '#63c051', '#3e9a40'][i % 3], ry: rnd() * 3, rz: (rnd() - 0.5) * 0.3, deco: true, shadow: false, round: 0 });
    }
    spots.push({ x: ox - 3, z: oz, cover: true }, { x: ox + 3, z: oz + 1, cover: true });
    signs.push({ x: ox, y: 1.2, z: oz + 4.4, ry: 0, w: 3.4, h: 0.9, lines: ['🌾 풀숲'], bg: '#ffffff', fg: '#3e7d2f', accent: '#5aa845' });
  }
  // 상자 더미 (ㄱ자, 뒤에 숨기)
  for (const [x, z, flip] of [[12, -27, 1], [-12, 27, -1], [20, 14, 1], [-20, -14, -1]]) {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      parts.push({ x: x + i * 1.7 * flip, y: 0.8 + j * 1.6, z, w: 1.6, h: 1.6, d: 1.6, c: j ? '#d9a066' : '#c98a4b', m: 'wood', round: 0.05 });
      if (i < 2) parts.push({ x, y: 0.8 + j * 1.6, z: z + (i + 1) * 1.7, w: 1.6, h: 1.6, d: 1.6, c: j ? '#c98a4b' : '#d9a066', m: 'wood', round: 0.05 });
    }
    spots.push({ x: x + 1.7 * flip, z: z + 1.7, cover: false, way: [[x + 4.4 * flip, z + 4.4]] });
  }
  // 굴 (양쪽이 뚫린 긴 굴)
  {
    const x = -30;
    for (const dx of [-1.75, 1.75]) parts.push({ x: x + dx, y: 1.6, z: 0, w: 0.5, h: 3.2, d: 10, c: '#a7a9b4', m: 'stone' });
    parts.push({ x, y: 3.35, z: 0, w: 4, h: 0.5, d: 10, c: '#9a9da8', m: 'stone' });
    parts.push({ x, y: 3.9, z: 0, w: 4.4, h: 0.6, d: 10.4, c: '#7cc95a', m: 'grass', round: 0.2 });
    spots.push({ x, z: 0, cover: false, way: [[x, 7.5]] });
    signs.push({ x, y: 4.8, z: 5.3, ry: 0, w: 3, h: 0.9, lines: ['🕳️ 굴'], bg: '#ffffff', fg: '#555a66', accent: '#a7a9b4' });
  }
  // 짚더미
  {
    const ox = 30;
    for (const [dx, dz, two] of [[-2.6, -4.6, 1], [2.6, -4.6, 0], [-2.6, 0, 0], [2.6, 0, 1], [-2.6, 4.6, 1], [2.6, 4.6, 0]]) {
      parts.push({ x: ox + dx, y: 0.8, z: dz, w: 2.4, h: 1.6, d: 3.2, c: '#e8c26a', m: 'wood', round: 0.2 });
      if (two) parts.push({ x: ox + dx, y: 2.4, z: dz, w: 2.4, h: 1.6, d: 3.2, c: '#f0cf7a', m: 'wood', round: 0.2 });
    }
    spots.push({ x: ox, z: -2.3, cover: false, way: [[ox, -9]] }, { x: ox, z: 2.3, cover: false, way: [[ox, 9]] });
  }
  // 놀이터 (계단으로 올라가는 놀이 탑, 밑은 숨는 곳, 미끄럼틀)
  {
    const ox = 0, oz = 31;
    for (const [dx, dz] of [[-2.8, -2.8], [2.8, -2.8], [-2.8, 2.8], [2.8, 2.8]]) parts.push({ x: ox + dx, y: 1.8, z: oz + dz, w: 0.4, h: 3.6, d: 0.4, c: '#ff5e7e' });
    parts.push({ x: ox, y: 3.75, z: oz, w: 6.2, h: 0.3, d: 6.2, c: '#3fa7ff' });
    for (const [dx, dz, w, d] of [[0, 3.05, 6.2, 0.2], [-3.05, 0, 0.2, 6.2], [3.05, 0, 0.2, 6.2]]) parts.push({ x: ox + dx, y: 4.4, z: oz + dz, w, h: 1, d, c: '#ffd23f' });
    for (const [dx, dz, w, d] of [[0, 2.9, 5.2, 0.15], [-2.9, 0.6, 0.15, 4.4], [2.9, 0.6, 0.15, 4.4]]) parts.push({ x: ox + dx, y: 1.5, z: oz + dz, w, h: 3, d, c: '#ffffff', k: 'glass' });
    for (let i = 0; i < 6; i++) parts.push({ x: ox - 1.6, y: 0.3 + i * 0.6, z: oz - 3.6 - (5 - i) * 0.8, w: 2.2, h: 0.6, d: 0.8, c: hsl(200 + i * 20, 80, 65) });
    parts.push({ x: ox + 4.8, y: 2.0, z: oz, w: 1.6, h: 0.2, d: 6.4, c: '#ffd23f', rx: 0, rz: -0.55, deco: true });
    spots.push({ x: ox, z: oz + 0.6, cover: false, way: [[ox, oz - 6]] });
    signs.push({ x: ox, y: 5.6, z: oz + 3.2, ry: 0, w: 3.4, h: 0.9, lines: ['🛝 놀이터'], bg: '#ffffff', fg: '#2a6fb3', accent: '#3fa7ff' });
  }
  // 통 무더기
  for (const [x, z] of [[-34, -26], [34, 26], [-8, -36], [8, 36]]) {
    for (const [dx, dz] of [[0, 0], [1.4, 0.3], [0.6, 1.3]]) parts.push({ x: x + dx, y: 1.0, z: z + dz, w: 1.2, h: 2, d: 1.2, c: '#5a8ad6', m: 'metal', shape: 'cyl' });
  }
  // 꽃밭, 가로등
  for (const [x, z, w, d] of [[-10, -20, 3, 2], [10, 20, 3, 2], [20, -16, 2, 3], [-20, 16, 2, 3]]) flowers(parts, x, z, w, d, rnd);
  for (const [x, z] of [[-16, -16], [16, 16], [16, -16], [-16, 16], [-36, 0], [36, 0], [0, -40], [0, 40]]) lamp(parts, x, z);
  // 나무
  const busy = [[TAG_HOME[0], TAG_HOME[1], 4], [0, 0, 9], [-26, -26, 9], [26, -26, 9], [-26, 26, 9], [26, 26, 9], [0, -30, 8], [-30, 0, 7], [30, 0, 7], [0, 31, 7], ...bushes.map(([x, z]) => [x, z, 4]),
    [12, -26, 5], [-12, 27, 5], [20, 14, 5], [-20, -14, 5], ...TAG_STARTS.map(([x, z]) => [x, z, 3])];
  let placed = 0;
  for (let tries = 0; tries < 500 && placed < 18; tries++) {
    const x = (rnd() - 0.5) * (H * 2 - 8), z = (rnd() - 0.5) * (H * 2 - 8);
    if (busy.some(([bx, bz, r]) => Math.hypot(x - bx, z - bz) < r + 3) || Math.abs(x) < 3 || Math.abs(z) < 3) continue;
    tree(parts, x, z, rnd);
    busy.push([x, z, 3]);
    placed++;
  }
  return { parts, signs, effects, zones, coins, npcs, spots, spawn: { x: 0, y: 0.3, z: 7, yaw: Math.PI }, killY: -20, sky: 'tag' };
}

// ───────────────────────── 달걀 도둑 ─────────────────────────
// 남쪽에 기지 6개(친구마다 하나), 북쪽으로 갈수록 풀밭 → 숲속 → 용암 → 구름 둥지. 둥지 사이 울타리 문은 돈을 내면 열린다.
export const EGG_SLOTS = [-15, 15, -45, 45, -75, 75].map(x => ({ x, z: 62 }));
export const EGG_BASE = { w: 24, d: 16, door: 7 };
export const EGG_ZONE_Z = [18, -28, -75, -120];      // 둥지 마당 가운데 z
export const EGG_GATE_Z = [null, -5, -51, -97];      // 그 마당으로 들어가는 울타리 z
export const EGG_HOME = { x: -30, z: 60 };
// 받침대 12개 (뒷줄 6, 앞줄 6)
export function eggPedestals(slot) {
  const { x, z } = EGG_SLOTS[slot % EGG_SLOTS.length];
  const out = [];
  for (const dz of [5, -0.5]) for (const dx of [-9, -5.4, -1.8, 1.8, 5.4, 9]) out.push({ x: x + dx, y: 0.8, z: z + dz });
  return out;
}
export const eggInBase = (slot, px, pz) => { const b = EGG_SLOTS[slot % EGG_SLOTS.length]; return Math.abs(px - b.x) < EGG_BASE.w / 2 - 0.3 && pz > b.z - EGG_BASE.d / 2 && pz < b.z + EGG_BASE.d / 2; };
// 러닝머신 3대: 기지 앞 오른쪽, 북쪽(-z)을 보고 달린다.
// 벨트는 스스로 밀지 않는다 (2026-11-22 인혁: "안끌리게"). 달릴 때만 src/egghunt.js 가 내 빠르기만큼 밀어서 제자리 달리기가 된다.
export const TREAD_BELT = 0;
export const eggTreadmills = slot => { const { x, z } = EGG_SLOTS[slot % EGG_SLOTS.length]; return EGG_TREADS.map((t, k) => ({ k, x: x + 4.5 + k * 3.6, z: z - EGG_BASE.d / 2 - 13 })); };
function treadmill(out, signs, x, z, k) {
  const T = EGG_TREADS[k];
  out.push({ x, y: 0.25, z, w: 2.7, h: 0.5, d: 4.8, c: '#2a2d33', m: 'metal' });
  out.push({ x, y: 0.55, z: z + 0.2, w: 2.0, h: 0.12, d: 4.2, k: 'conveyor', cv: [0, TREAD_BELT], tread: k });
  for (const s of [-1, 1]) {
    out.push({ x: x + s * 1.2, y: 0.62, z: z + 0.2, w: 0.3, h: 0.2, d: 4.4, c: T.color, deco: true });
    out.push({ x: x + s * 1.15, y: 1.35, z: z - 2.05, w: 0.18, h: 1.7, d: 0.18, c: '#c7ccd6', m: 'metal', deco: true });
    out.push({ x: x + s * 1.15, y: 1.6, z: z - 1.2, w: 0.14, h: 0.14, d: 1.7, c: '#c7ccd6', m: 'metal', deco: true });
  }
  // 앞 계기판 (몸이 닿아서 앞으로 빠져나가지 않게 막는다)
  out.push({ x, y: 1.2, z: z - 2.3, w: 2.5, h: 1.4, d: 0.35, c: T.color });
  out.push({ x, y: 2.2, z: z - 2.2, w: 1.6, h: 0.9, d: 0.2, c: '#1e2235', rx: -0.35 });
  signs.push({ x, y: 2.25, z: z - 2.07, ry: 0, w: 1.45, h: 0.75, lines: [`${T.icon} ×${T.mult}`, T.price ? `$${T.price.toLocaleString('ko-KR')}` : '공짜'], bg: '#1e2235', fg: '#7df9ff', accent: T.color, sizes: [120, 80] });
}

// 잠긴 울타리 문 (src/egghunt.js 가 만들고 없앤다)
export function eggGateParts(zone) {
  const z = EGG_GATE_Z[zone], c = ['#ffffff', '#ffffff', '#5ad16b', '#ff7a3d', '#c9b6ff'][zone + 1];
  const out = [{ x: 0, y: 2.5, z, w: 8, h: 5, d: 0.6, c: '#ff5e7e', m: 'neon' }];
  for (let i = -3; i <= 3; i += 2) out.push({ x: i, y: 2.5, z: z - 0.4, w: 0.25, h: 5, d: 0.2, c, deco: true });
  return out;
}

function nest(out, x, z, zone, rnd) {
  const Z = EGG_ZONES[zone];
  const straw = ['#e8c26a', '#8b5a3c', '#3a2a2a', '#ffffff'][zone];
  out.push({ x, y: 0.25, z, w: 6.4, h: 0.5, d: 6.4, c: straw, m: zone === 3 ? 'cloud' : 'wood', shape: 'cyl' });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    out.push({ x: x + Math.cos(a) * 3.1, y: 0.75, z: z + Math.sin(a) * 3.1, w: 1.0, h: 0.6, d: 1.0, c: straw, m: zone === 3 ? 'cloud' : 'wood', ry: a, deco: true, round: 0.2 });
  }
  out.push({ x, y: 0.52, z, w: 4.6, h: 0.06, d: 4.6, c: Z.spot, m: 'neon', shape: 'cyl', deco: true, shadow: false });
  void rnd;
}

export function buildEgg({ slot = 0 } = {}) {
  const parts = [], signs = [], effects = [], zones = [], coins = [], npcs = [], nests = [];
  const rnd = seeded(20261122);
  const W = 100, N = -138, S = 84;
  // 땅: 마당마다 색이 다르다
  parts.push({ x: 0, y: -1, z: (S + 30) / 2 + 2, w: W * 2, h: 2, d: S - 30 + 4, c: '#86d06a', m: 'grass', round: 0.2, shadow: false });
  const grounds = [['#7cc95a', 'grass', 34, -5], ['#4f9e45', 'grass', -5, -51], ['#4a3b3b', 'stone', -51, -97], ['#f4f7ff', 'cloud', -97, N]];
  grounds.forEach(([c, m, z0, z1]) => parts.push({ x: 0, y: -1, z: (z0 + z1) / 2, w: W * 2, h: 2, d: z0 - z1, c, m, round: 0.2, shadow: false }));
  parts.push({ x: 0, y: -1.3, z: 0, w: 900, h: 0.2, d: 900, c: '#8fd16a', m: 'grass', deco: true, shadow: false, round: 0 });
  for (const [x, z, w, d] of [[0, N, W * 2, 1], [0, S, W * 2, 1], [-W, (N + S) / 2, 1, S - N], [W, (N + S) / 2, 1, S - N]]) parts.push({ x, y: 5, z, w, h: 10, d, hidden: true });
  // 울타리 (가운데 문 자리 8칸은 비우고, 잠긴 문은 실행하면서 세운다)
  for (let zone = 1; zone < EGG_ZONES.length; zone++) {
    const z = EGG_GATE_Z[zone], c = ['#ffffff', '#c98a4b', '#3a3f4b', '#ffffff'][zone];
    for (const [a0, a1] of [[-W, -4], [4, W]]) {
      parts.push({ x: (a0 + a1) / 2, y: 1.5, z, w: a1 - a0, h: 3, d: 0.5, c, m: zone === 2 ? 'stone' : 'wood' });
      for (let a = a0; a <= a1; a += 4) parts.push({ x: a, y: 1.8, z, w: 0.6, h: 3.6, d: 0.7, c, m: zone === 2 ? 'stone' : 'wood', deco: true });
    }
    for (const sx of [-4.4, 4.4]) parts.push({ x: sx, y: 3, z, w: 1.2, h: 6, d: 1.2, c: EGG_ZONES[zone].spot });
    const Z = EGG_ZONES[zone];
    signs.push({ x: 0, y: 7.2, z: z + 0.7, ry: 0, w: 8, h: 1.9, lines: [`${Z.icon} ${Z.name}`, `🔒 $${Z.price.toLocaleString('ko-KR')} 내면 열려`], bg: '#ffffff', fg: '#2a2d3a', accent: Z.spot, sizes: [80, 56], double: true });
  }
  // 둥지 12개
  EGG_ZONES.forEach((Z, zone) => {
    const zc = EGG_ZONE_Z[zone];
    for (const x of [-52, 0, 52]) { nest(parts, x, zc, zone, rnd); nests.push({ zone, x, z: zc }); }
    signs.push({ x: -W + 8, y: 3.2, z: zc, ry: Math.PI / 2, w: 7, h: 1.8, lines: [`${Z.icon} ${Z.name}`, `${Z.egg} · ${Z.guardName} 조심!`], bg: '#ffffff', fg: '#2a2d3a', accent: Z.spot, sizes: [72, 50] });
    parts.push({ x: -W + 8, y: 1.2, z: zc, w: 0.4, h: 2.4, d: 0.4, c: '#8b5a3c', m: 'wood', deco: true });
  });
  // 마당 꾸미기
  const nearNest = (x, z, r) => nests.some(n => Math.hypot(n.x - x, n.z - z) < r) || Math.abs(x) < 7;
  // 풀밭: 꽃밭, 나무 몇 그루
  for (let i = 0; i < 10; i++) { const x = (rnd() - 0.5) * 180, z = -2 + rnd() * 34; if (!nearNest(x, z, 14)) flowers(parts, x, z, 2 + Math.floor(rnd() * 2), 2, rnd); }
  for (let i = 0, n = 0; i < 80 && n < 12; i++) { const x = (rnd() - 0.5) * 186, z = -1 + rnd() * 33; if (!nearNest(x, z, 16)) { tree(parts, x, z, rnd); n++; } }
  // 숲: 나무가 빽빽
  for (let i = 0, n = 0; i < 300 && n < 46; i++) { const x = (rnd() - 0.5) * 190, z = -49 + rnd() * 40; if (!nearNest(x, z, 11)) { tree(parts, x, z, rnd, 1.2); n++; } }
  // 용암: 바위와 용암 웅덩이(장식), 화산
  for (let i = 0, n = 0; i < 200 && n < 26; i++) {
    const x = (rnd() - 0.5) * 186, z = -94 + rnd() * 40;
    if (nearNest(x, z, 12)) continue;
    if (n % 2) parts.push({ x, y: 0.02, z, w: 4 + rnd() * 5, h: 0.1, d: 3 + rnd() * 4, c: '#ff6a1a', m: 'lava', deco: true, shadow: false, round: 0.04 });
    else { const sz = 1.4 + rnd() * 2.4; parts.push({ x, y: sz * 0.4, z, w: sz * 1.3, h: sz, d: sz, c: '#2e2626', m: 'stone', ry: rnd() * 3, round: 0.3 }); }
    n++;
  }
  for (const [x, h] of [[-80, 26], [78, 32]]) {
    parts.push({ x, y: h / 2 - 1, z: -86, w: h * 1.1, h, d: h * 1.1, c: '#3a2a2a', m: 'stone', shape: 'cone', deco: true });
    parts.push({ x, y: h - 1.2, z: -86, w: 4, h: 0.6, d: 4, c: '#ff7a1a', m: 'lava', shape: 'cyl', deco: true, shadow: false });
  }
  // 구름: 뭉게구름과 무지개 다리
  for (let i = 0, n = 0; i < 200 && n < 22; i++) {
    const x = (rnd() - 0.5) * 186, z = -134 + rnd() * 34;
    if (nearNest(x, z, 12)) continue;
    const r = 2 + rnd() * 2.5;
    parts.push({ x, y: r * 0.5, z, w: r * 2, h: r * 1.3, d: r * 1.8, c: '#ffffff', m: 'cloud', shape: 'sphere', deco: true });
    n++;
  }
  for (const x of [-26, 26]) for (let k = 0; k < 6; k++) {
    const a = (k / 5) * Math.PI;
    parts.push({ x: x + Math.cos(a) * 9, y: Math.sin(a) * 8 + 0.5, z: -120, w: 1.6, h: 1.6, d: 1.6, c: ['#ff5e7e', '#ff8a3d', '#ffd23f', '#5ad16b', '#3fa7ff', '#9b5cff'][k], m: 'neon', deco: true, shadow: false });
  }
  // 기지 6개
  EGG_SLOTS.forEach(({ x, z }, k) => {
    const { w, d, door } = EGG_BASE, mine = k === slot;
    const col = ['#3fa7ff', '#ff5e7e', '#5ad16b', '#ffb820', '#9b5cff', '#21c7b8'][k];
    parts.push({ x, y: 0.15, z, w, h: 0.3, d, c: mine ? '#fff6e0' : '#f1f4fa', m: 'stone', round: 0.08 });
    // 낮은 담 (북쪽 가운데가 문)
    parts.push({ x, y: 0.9, z: z + d / 2, w, h: 1.5, d: 0.5, c: col });
    for (const sx of [-1, 1]) parts.push({ x: x + sx * w / 2, y: 0.9, z, w: 0.5, h: 1.5, d, c: col });
    for (const sx of [-1, 1]) parts.push({ x: x + sx * (w / 2 + door / 2) / 2, y: 0.9, z: z - d / 2, w: (w - door) / 2, h: 1.5, d: 0.5, c: col });
    for (const sx of [-1, 1]) parts.push({ x: x + sx * (door / 2 + 0.4), y: 2.2, z: z - d / 2, w: 0.8, h: 4.4, d: 0.8, c: '#ffffff' });
    parts.push({ x, y: 4.6, z: z - d / 2, w: door + 1.6, h: 0.6, d: 0.9, c: col });
    for (const p of eggPedestals(k)) parts.push({ x: p.x, y: 0.5, z: p.z, w: 2.2, h: 0.5, d: 2.2, c: '#ffffff', m: 'stone', shape: 'cyl' });
    signs.push({ x, y: 6, z: z - d / 2 - 0.1, ry: 0, w: 6, h: 1.4, lines: [mine ? '🏠 내 기지' : `기지 ${k + 1}`], bg: '#ffffff', fg: '#2a2d3a', accent: col, double: true });
    for (const t of eggTreadmills(k)) treadmill(parts, signs, t.x, t.z, t.k);
  });
  // 광장으로 가는 문 (내 기지 옆 틈)
  {
    const { x, z } = EGG_HOME;
    effects.push({ type: 'portal', x, y: 2.4, z, w: 4.2, h: 4.4, color: '#3fa7ff', ry: Math.PI / 2 });
    parts.push({ x, y: 0.08, z, w: 3.4, h: 0.16, d: 5.4, c: '#ffffff', round: 0.06 });
    signs.push({ x, y: 5.4, z, ry: Math.PI / 2, w: 3.8, h: 1, lines: ['🏠 광장으로'], bg: '#ffffff', fg: '#2a6fb3', accent: '#3fa7ff', double: true });
    zones.push({ x0: x - 0.6, x1: x + 0.6, y0: 0, y1: 4.5, z0: z - 2, z1: z + 2, portal: 0 });
  }
  signs.push({ x: EGG_SLOTS[slot].x - 9, y: 3.2, z: 46, ry: 0, w: 8, h: 3.2, lines: ['🥚 달걀 도둑', '경비를 피해서 둥지의 알을 훔쳐!', '내 기지에 가져오면 부화해서 돈을 벌어', '🦝 너구리 도둑은 닿아서 잡아!', '🏃 러닝머신에서 달리면 빨라져!'], bg: '#ffffff', fg: '#2a2d3a', accent: '#ffcf33', sizes: [80, 50, 50, 50, 50], double: true });
  parts.push({ x: EGG_SLOTS[slot].x - 9, y: 1.2, z: 46, w: 0.4, h: 2.4, d: 0.4, c: '#8b5a3c', m: 'wood', deco: true });
  for (const [x, z] of [[-30, 44], [0, 44], [30, 44], [-60, 44], [60, 44]]) lamp(parts, x, z);
  const sp = EGG_SLOTS[slot];
  return { parts, signs, effects, zones, coins, npcs, nests, spawn: { x: sp.x, y: 0.3, z: sp.z - EGG_BASE.d / 2 - 3, yaw: Math.PI }, killY: -20, sky: 'hub' };
}

// ───────────────────────── 모닥불 캠프 ─────────────────────────
// 둥근 숲 섬. 가운데 빈터에 모닥불, 둘레에 통나무 의자와 텐트. 나무와 열매 덤불은 src/camp.js 가 그리고 베면 다시 자란다.
export const CAMP_R = 95;
export const CAMP_HOME = { x: 11, z: 7 };
export function buildCamp() {
  const parts = [], signs = [], effects = [], zones = [], coins = [], npcs = [], trees = [], bushes = [];
  const rnd = seeded(20261199);
  const R = CAMP_R;
  parts.push({ x: 0, y: -1, z: 0, w: R * 2 + 10, h: 2, d: R * 2 + 10, c: '#4f8f45', m: 'grass', round: 0.4, shadow: false, shape: 'cyl' });
  parts.push({ x: 0, y: -1.3, z: 0, w: 900, h: 0.2, d: 900, c: '#2c5a3a', m: 'grass', deco: true, shadow: false, round: 0 });
  for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; parts.push({ x: Math.cos(a) * (R + 3), y: 5, z: Math.sin(a) * (R + 3), w: 14, h: 10, d: 2, ry: -a + Math.PI / 2, hidden: true }); }
  // 섬 끝 바위
  for (let i = 0; i < 60; i++) { const a = rnd() * Math.PI * 2, r = R + rnd() * 4, s2 = 2 + rnd() * 4; parts.push({ x: Math.cos(a) * r, y: s2 * 0.35, z: Math.sin(a) * r, w: s2 * 1.4, h: s2, d: s2, c: '#5b5f6b', m: 'stone', ry: rnd() * 3, round: 0.4, deco: true }); }
  // 빈터와 모닥불
  parts.push({ x: 0, y: 0.03, z: 0, w: 30, h: 0.06, d: 30, c: '#8a7350', m: 'sand', shape: 'cyl', deco: true, shadow: false });
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; parts.push({ x: Math.cos(a) * 1.9, y: 0.3, z: Math.sin(a) * 1.9, w: 0.9, h: 0.6, d: 0.8, c: '#7a7d88', m: 'stone', ry: a, round: 0.25 }); }
  for (const a of [0.3, 1.4, 2.5]) parts.push({ x: 0, y: 0.35, z: 0, w: 2.6, h: 0.35, d: 0.35, c: '#6b4a2f', m: 'wood', ry: a, deco: true, shape: 'cyl', rz: Math.PI / 2 });
  // 통나무 의자
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; parts.push({ x: Math.cos(a) * 6, y: 0.4, z: Math.sin(a) * 6, w: 2.6, h: 0.8, d: 0.8, c: '#8b5a3c', m: 'wood', ry: -a + Math.PI / 2, round: 0.3 }); }
  // 텐트
  for (const [x, z, c, ry] of [[-10, -6, '#ff7a3d', 0.5], [-4, -11, '#3fa7ff', 0.1], [8, -9, '#5ad16b', -0.5]]) {
    parts.push({ x, y: 1.3, z, w: 3.6, h: 2.6, d: 3.6, c, shape: 'cone', ry, deco: true });
    parts.push({ x, y: 0.05, z, w: 3.8, h: 0.1, d: 3.8, c: '#4a3a2a', m: 'wood', deco: true, shadow: false });
  }
  // 장작 더미, 표지판
  for (let i = 0; i < 6; i++) parts.push({ x: 4 + (i % 3) * 0.5, y: 0.25 + Math.floor(i / 3) * 0.45, z: 10, w: 0.45, h: 0.45, d: 2.2, c: '#8b5a3c', m: 'wood', shape: 'cyl', rx: Math.PI / 2, deco: true });
  signs.push({ x: -6, y: 2.6, z: 11, ry: Math.PI, w: 7.4, h: 3.2, lines: ['🔥 모닥불 캠프', '낮: 🪓 나무 베기 · 🫐 열매 따기', '불 옆에 서면 나무를 넣어 · 빛 안은 안전!', '밤: 그림자 늑대를 🪓 로 쫓아내 · 99일 버티기'], bg: '#2a2218', fg: '#ffe9c8', accent: '#ff7a3d', sizes: [80, 50, 50, 50], double: true });
  parts.push({ x: -6, y: 1.1, z: 11, w: 0.4, h: 2.2, d: 0.4, c: '#6b4a2f', m: 'wood', deco: true });
  // 광장으로 가는 문
  {
    const { x, z } = CAMP_HOME;
    effects.push({ type: 'portal', x, y: 2.4, z, w: 4.2, h: 4.4, color: '#3fa7ff', ry: -0.9 });
    parts.push({ x, y: 0.08, z, w: 4.6, h: 0.16, d: 4.6, c: '#d9cbb0', m: 'stone', shape: 'cyl' });
    signs.push({ x, y: 5.3, z, ry: -0.9, w: 3.8, h: 1, lines: ['🏠 광장으로'], bg: '#ffffff', fg: '#2a6fb3', accent: '#3fa7ff', double: true });
    zones.push({ x0: x - 1, x1: x + 1, y0: 0, y1: 4.5, z0: z - 1, z1: z + 1, portal: 0 });
  }
  // 베는 나무와 열매 덤불 (자리만)
  for (let tries = 0; tries < 3000 && trees.length < 190; tries++) {
    const a = rnd() * Math.PI * 2, r = 15 + Math.sqrt(rnd()) * (R - 19);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (trees.some(t => Math.hypot(t.x - x, t.z - z) < 4.2)) continue;
    trees.push({ x, z, s: 0.9 + rnd() * 0.5, kind: rnd() < 0.7 ? 0 : 1 });
  }
  for (let tries = 0; tries < 1500 && bushes.length < 30; tries++) {
    const a = rnd() * Math.PI * 2, r = 14 + rnd() * (R - 20);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (trees.some(t => Math.hypot(t.x - x, t.z - z) < 3) || bushes.some(b => Math.hypot(b.x - x, b.z - z) < 8)) continue;
    bushes.push({ x, z });
  }
  // 버섯, 풀 장식
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2, r = 14 + rnd() * (R - 16), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (i % 2) { parts.push({ x, y: 0.25, z, w: 0.14, h: 0.5, d: 0.14, c: '#f4efe6', deco: true, shadow: false }); parts.push({ x, y: 0.55, z, w: 0.55, h: 0.3, d: 0.55, c: i % 4 === 1 ? '#ff4d5e' : '#c98a4b', shape: 'sphere', deco: true, shadow: false }); }
    else parts.push({ x, y: 0.35, z, w: 0.8, h: 0.7, d: 0.8, c: '#3e8a3a', shape: 'cone', deco: true, shadow: false });
  }
  return { parts, signs, effects, zones, coins, npcs, trees, bushes, spawn: { x: 0, y: 0.3, z: 7, yaw: Math.PI }, killY: -20, sky: 'camp' };
}
