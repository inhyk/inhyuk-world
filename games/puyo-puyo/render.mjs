// 게임 화면 그리기: 배경, 두 필드, 다음 뿌요, 방해뿌요 예고, 점수, 캐릭터, 효과.
import { W, VISIBLE, GARBAGE, garbageIcons, idx, SPAWN_X, SPAWN_Y, TIMING } from './core.mjs';
import { SkinCache, SKIN_STYLE, PALETTE, drawBridge } from './skins.mjs';
import { Effects } from './effects.mjs';
import { drawCharacter, drawGarbageIcon } from './characters.mjs';
import { Clash, clashGain } from './clash.mjs';
import { SKY_IDS } from './sky.mjs';

const TAU = Math.PI * 2;
const FONT = "Jua, 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";

// ---------- 배치 ----------
export function computeLayout(w, h, opt = {}) {
  const ins = { top: 0, bottom: 0, left: 0, right: 0, ...(opt.insets || {}) };
  const aw = Math.max(100, w - ins.left - ins.right), ah = Math.max(100, h - ins.top - ins.bottom);
  const ox = ins.left, oy = ins.top;
  if (opt.solo) {
    const c = Math.floor(Math.min(aw / 11, ah / 14.9));
    const totalW = c * 10.6, totalH = c * 14.7;
    const x0 = ox + (aw - totalW) / 2, y0 = oy + (ah - totalH) / 2;
    const f = { x: x0 + c * 0.4, y: y0 + c * 1.4, cell: c };
    return {
      solo: true, portrait: false, cell: c,
      fields: [f],
      next: [{ x: f.x + c * 6.5, y: f.y, cell: c * 0.95 }],
      tray: [{ x: f.x, y: f.y - c * 1.25, w: c * 6, h: c * 1 }],
      score: [{ x: f.x, y: f.y + c * 12.2, w: c * 6, h: c * 1.1 }],
      side: { x: f.x + c * 6.4, y: f.y + c * 4.2, w: c * 3.8, h: c * 7.8 },
    };
  }
  if (opt.watch && aw / ah < 0.85) {
    // 관전, 좁은 세로 화면(휴대폰): 가운데 칸 없이 두 필드를 크게. 그림 그대로 위에 "닉네임 레벨", 아래에 "점수"만.
    // 맨 위 한 줄(center)에 "관전 중 · VS · 판 수"를 적는다. 다음 뿌요 미리보기는 자리가 없어 뺀다.
    const c = Math.floor(Math.min(aw / 12.9, ah / 16.9));
    const totalW = c * 12.9, totalH = c * 16.7;
    const x0 = ox + (aw - totalW) / 2, y0 = oy + (ah - totalH) / 2;
    const f0 = { x: x0 + c * 0.2, y: y0 + c * 3.35, cell: c };
    const f1 = { x: f0.x + c * 6.5, y: f0.y, cell: c };
    return {
      portrait: false, watch: true, cell: c,
      fields: [f0, f1],
      label: [{ x: f0.x, y: f0.y - c * 2.25, w: c * 6, h: c * 0.95 }, { x: f1.x, y: f1.y - c * 2.25, w: c * 6, h: c * 0.95 }],
      next: [{ hidden: true }, { hidden: true }],
      tray: [{ x: f0.x, y: f0.y - c * 1.2, w: c * 6, h: c * 0.95 }, { x: f1.x, y: f1.y - c * 1.2, w: c * 6, h: c * 0.95 }],
      score: [{ x: f0.x, y: f0.y + c * 12.15, w: c * 6, h: c * 1 }, { x: f1.x, y: f1.y + c * 12.15, w: c * 6, h: c * 1 }],
      center: { x: x0, y: y0 + c * 0.1, w: totalW, h: c * 0.9, strip: true },
    };
  }
  if (opt.watch) {
    // 관전 (인혁이 기획서 4번 그림): 두 필드를 똑같은 크기로 나란히, 필드 위에 "닉네임 레벨", 아래에 "점수"
    const c = Math.floor(Math.min(aw / 17.4, ah / 16));
    const totalW = c * 17, totalH = c * 15.7;
    const x0 = ox + (aw - totalW) / 2, y0 = oy + (ah - totalH) / 2;
    const f0 = { x: x0 + c * 0.2, y: y0 + c * 2.35, cell: c };
    const f1 = { x: x0 + c * 10.8, y: f0.y, cell: c };
    const cx = f0.x + c * 6.4;
    return {
      portrait: false, watch: true, cell: c,
      fields: [f0, f1],
      label: [{ x: f0.x, y: f0.y - c * 2.25, w: c * 6, h: c * 0.95 }, { x: f1.x, y: f1.y - c * 2.25, w: c * 6, h: c * 0.95 }],
      next: [{ x: cx + c * 0.15, y: f0.y, cell: c * 0.8 }, { x: f1.x - c * 1.75, y: f0.y, cell: c * 0.8 }],
      tray: [{ x: f0.x, y: f0.y - c * 1.2, w: c * 6, h: c * 0.95 }, { x: f1.x, y: f1.y - c * 1.2, w: c * 6, h: c * 0.95 }],
      score: [{ x: f0.x, y: f0.y + c * 12.15, w: c * 6, h: c * 1 }, { x: f1.x, y: f1.y + c * 12.15, w: c * 6, h: c * 1 }],
      center: { x: cx, y: f0.y + c * 3.6, w: c * 4, h: c * 8.4 },
    };
  }
  // 대전: 맨 위에 방해 뿌요 힘겨루기 막대 한 줄 (인혁이 기획서 2026-10-10 2번 그림 「나 ⚡ 상대」)
  const bar = opt.clash ? 1 : 0;
  const portrait = opt.portrait ?? (aw / ah < 1.05);
  if (portrait && !opt.symmetric) {
    const c = Math.floor(Math.min(aw / 9.9, ah / (14.9 + bar)));
    const m = c * 0.46;
    const totalW = c * 9.7, totalH = c * (14.6 + bar);
    const x0 = ox + (aw - totalW) / 2, y0 = oy + (ah - totalH) / 2;
    const f0 = { x: x0 + c * 0.2, y: y0 + c * (1.3 + bar), cell: c };
    const rx = f0.x + c * 6.35;
    const f1 = { x: rx + (c * 3.1 - m * 6) / 2, y: f0.y + c * 6.15, cell: m, mini: true };
    return {
      portrait: true, cell: c,
      fields: [f0, f1],
      next: [{ x: rx + c * 0.45, y: f0.y, cell: c * 0.85 }, { x: f1.x + m * 6.2, y: f1.y + m * 0.2, cell: m * 0.8, hidden: true }],
      tray: [{ x: f0.x, y: f0.y - c * 1.2, w: c * 6, h: c * 0.95 }, { x: f1.x, y: f1.y - m * 1.5, w: m * 6, h: m * 1.2 }],
      score: [{ x: f0.x, y: f0.y + c * 12.15, w: c * 6, h: c * 1 }, { x: f1.x - m * 0.5, y: f1.y + m * 12.25, w: m * 7, h: m * 1.8 }],
      center: { x: rx, y: f0.y + c * 3.3, w: c * 3.1, h: c * 2.1 },
      clash: bar ? { x: x0 + c * 0.2, y: y0 + c * 0.1, w: c * 9.3, h: c * 0.9 } : null,
    };
  }
  const c = Math.floor(Math.min(aw / 17.4, ah / (15 + bar)));
  const totalW = c * 17, totalH = c * (14.7 + bar);
  const x0 = ox + (aw - totalW) / 2, y0 = oy + (ah - totalH) / 2;
  const f0 = { x: x0 + c * 0.2, y: y0 + c * (1.35 + bar), cell: c };
  const f1 = { x: x0 + c * 10.8, y: f0.y, cell: c };
  const cx = f0.x + c * 6.4;
  return {
    portrait: false, cell: c,
    fields: [f0, f1],
    next: [{ x: cx + c * 0.15, y: f0.y, cell: c * 0.8 }, { x: f1.x - c * 1.75, y: f0.y, cell: c * 0.8 }],
    tray: [{ x: f0.x, y: f0.y - c * 1.2, w: c * 6, h: c * 0.95 }, { x: f1.x, y: f1.y - c * 1.2, w: c * 6, h: c * 0.95 }],
    score: [{ x: f0.x, y: f0.y + c * 12.15, w: c * 6, h: c * 1 }, { x: f1.x, y: f1.y + c * 12.15, w: c * 6, h: c * 1 }],
    center: { x: cx, y: f0.y + c * 3.6, w: c * 4, h: c * 8.4 },
    clash: bar ? { x: x0 + c * 0.2, y: y0 + c * 0.1, w: c * 16.6, h: c * 0.9 } : null,
  };
}

// ---------- 배경 ----------
const THEMES = {
  default: ['#ffb3d9', '#b9a6ff', '#7fd6ff'],
  meadow: ['#9fe3ff', '#d9f7ff', '#8fe08a'],
  sky: ['#ffd1e8', '#bfe3ff', '#ffffff'],
  crater: ['#2b0f1f', '#6e2323', '#ff8a3d'],
  starry: ['#0c1033', '#1e2a6e', '#3b2f7a'],
  moon: ['#221a4a', '#4b3a8c', '#9a86d9'],
  palace: ['#5a1020', '#a62a3a', '#ffcf6a'],
  space: ['#05030f', '#170b3a', '#0f3b5a'],
  ice: ['#7fbada', '#d5f5ff', '#edfaff'],
  lab: ['#123f47', '#287367', '#91e4c3'],
  nova: ['#120e35', '#344c71', '#9adebc'],
  ending: ['#ff9ec7', '#ffd88a', '#8fd8ff'],
  // 대전 화면의 하늘 (sky.mjs): 지금 시각에 맞춰 고른다
  morning: ['#7fc4ff', '#ffe2c8', '#ffb57c'],
  noon: ['#4aa9ff', '#a3dbff', '#e6f8ff'],
  evening: ['#3a2f7c', '#e9637b', '#ffc56c'],
  night: ['#050824', '#141d57', '#2c2a68'],
};
const DARK = new Set(['crater', 'starry', 'moon', 'space', 'nova', 'lab', 'night']);
const SKY = new Set(SKY_IDS);

// 대전 화면의 하늘: 해나 달, 구름이나 별, 그리고 아래에는 뿌요 정원의 언덕
function paintSky(ctx, theme, w, h, rnd) {
  const s = Math.min(w, h);
  const disc = (x, y, r, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
  const glow = (x, y, r, inner, outer) => {
    const g = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
    g.addColorStop(0, inner); g.addColorStop(1, outer);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  const clouds = (n, color, top, bottom) => {
    for (let i = 0; i < n; i++) {
      const cx = rnd() * w, cy = h * (top + rnd() * (bottom - top)), r = s * (0.05 + rnd() * 0.07);
      ctx.fillStyle = color;
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(cx + (k - 1.5) * r * 0.55, cy + (k % 2) * r * 0.15, r * (0.5 + (k % 2) * 0.2), 0, TAU); ctx.fill(); }
    }
  };
  if (theme === 'morning') {
    // 언덕 너머로 떠오르는 해
    glow(w * 0.14, h * 0.8, s * 0.62, 'rgba(255,238,170,.9)', 'rgba(255,222,160,0)');
    disc(w * 0.14, h * 0.8, s * 0.12, '#fff4b4');
    clouds(6, 'rgba(255,240,234,.78)', 0.05, 0.5);
  } else if (theme === 'noon') {
    glow(w * 0.86, h * 0.15, s * 0.36, 'rgba(255,255,222,.92)', 'rgba(255,255,222,0)');
    disc(w * 0.86, h * 0.15, s * 0.075, '#fffbe2');
    clouds(7, 'rgba(255,255,255,.82)', 0.05, 0.55);
  } else if (theme === 'evening') {
    // 먼저 뜬 별 몇 개와 지는 해, 노을 구름
    for (let i = 0; i < 32; i++) disc(rnd() * w, rnd() * h * 0.3, rnd() * 1.2 + 0.4, `rgba(255,255,255,${0.2 + rnd() * 0.45})`);
    glow(w * 0.85, h * 0.78, s * 0.64, 'rgba(255,196,112,.92)', 'rgba(255,150,90,0)');
    disc(w * 0.85, h * 0.78, s * 0.13, '#ffb45e');
    clouds(4, 'rgba(112,72,152,.42)', 0.08, 0.4);
    clouds(4, 'rgba(255,172,150,.46)', 0.3, 0.62);
  } else {
    for (let i = 0; i < 170; i++) disc(rnd() * w, rnd() * h * 0.82, rnd() * 1.6 + 0.3, `rgba(255,255,255,${0.2 + rnd() * 0.7})`);
    const mx = w * 0.84, my = h * 0.17, r = s * 0.085;
    glow(mx, my, r * 2.6, 'rgba(255,250,220,.75)', 'rgba(255,250,220,0)');
    disc(mx, my, r, '#fff6d6');
    for (const [dx, dy, cr] of [[-0.3, -0.2, 0.2], [0.3, 0.2, 0.15], [0.05, 0.45, 0.1]]) disc(mx + dx * r, my + dy * r, cr * r, 'rgba(200,190,150,.4)');
  }
  const [far, near] = { morning: ['#a5e08a', '#6cc96c'], noon: ['#86dc7c', '#55c462'], evening: ['#4a7560', '#2f5348'], night: ['#1c3554', '#12243c'] }[theme];
  const hill = (color, base, wave, swing) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w + 20; x += 20) ctx.lineTo(x, h * base + Math.sin(x / wave + swing) * s * 0.035);
    ctx.lineTo(w, h); ctx.fill();
  };
  hill(far, 0.8, 150, 1.4);
  hill(near, 0.86, 95, 0);
  if (theme === 'night') {
    // 반딧불이
    for (let i = 0; i < 26; i++) { const x = rnd() * w, y = h * (0.78 + rnd() * 0.2); glow(x, y, s * 0.018, 'rgba(255,250,150,.9)', 'rgba(255,250,150,0)'); }
  } else {
    const dots = theme === 'evening' ? ['#c98aa5', '#c9b56a', '#b9b3c9'] : ['#ff7aa2', '#ffe45c', '#ffffff'];
    for (let i = 0; i < 40; i++) disc(rnd() * w, h * (0.89 + rnd() * 0.11), 3, dots[i % 3]);
  }
}

function paintBackground(ctx, theme, w, h, seed = 7) {
  const cols = THEMES[theme] || THEMES.default;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, cols[0]); g.addColorStop(0.6, cols[1]); g.addColorStop(1, cols[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  if (SKY.has(theme)) { paintSky(ctx, theme, w, h, rnd); return; }
  if (DARK.has(theme)) {
    for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.7})`; const r = rnd() * 1.6 + 0.3; ctx.beginPath(); ctx.arc(rnd() * w, rnd() * h * 0.85, r, 0, TAU); ctx.fill(); }
  }
  if (theme === 'meadow' || theme === 'default' || theme === 'sky' || theme === 'ending') {
    for (let i = 0; i < 7; i++) {
      const cx = rnd() * w, cy = rnd() * h * 0.5, r = 30 + rnd() * 50;
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(cx + (k - 1.5) * r * 0.55, cy + (k % 2) * r * 0.15, r * (0.5 + (k % 2) * 0.2), 0, TAU); ctx.fill(); }
    }
  }
  if (theme === 'meadow') {
    ctx.fillStyle = '#5fcf6a';
    ctx.beginPath(); ctx.moveTo(0, h); for (let x = 0; x <= w; x += 20) ctx.lineTo(x, h * 0.8 + Math.sin(x / 90) * 25); ctx.lineTo(w, h); ctx.fill();
    for (let i = 0; i < 40; i++) { ctx.fillStyle = ['#ff7aa2', '#ffe45c', '#ffffff'][i % 3]; ctx.beginPath(); ctx.arc(rnd() * w, h * 0.86 + rnd() * h * 0.14, 3, 0, TAU); ctx.fill(); }
  }
  if (theme === 'crater') {
    ctx.fillStyle = '#3a1512';
    ctx.beginPath(); ctx.moveTo(0, h); for (let x = 0; x <= w; x += 30) ctx.lineTo(x, h * 0.84 + (rnd() - 0.5) * 30); ctx.lineTo(w, h); ctx.fill();
  }
  if (theme === 'moon') {
    const mx = w * 0.82, my = h * 0.2, r = Math.min(w, h) * 0.12;
    const mg = ctx.createRadialGradient(mx, my, r * 0.2, mx, my, r * 2.2);
    mg.addColorStop(0, 'rgba(255,250,220,.9)'); mg.addColorStop(0.45, 'rgba(255,250,220,.25)'); mg.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = mg; ctx.fillRect(mx - r * 2.5, my - r * 2.5, r * 5, r * 5);
    ctx.fillStyle = '#fff6d6'; ctx.beginPath(); ctx.arc(mx, my, r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(200,190,150,.4)'; for (const [dx, dy, cr] of [[-0.3, -0.2, 0.2], [0.3, 0.2, 0.15], [0.05, 0.45, 0.1]]) { ctx.beginPath(); ctx.arc(mx + dx * r, my + dy * r, cr * r, 0, TAU); ctx.fill(); }
  }
  if (theme === 'palace') {
    for (let i = 0; i < 6; i++) {
      const x = (i + 0.5) * w / 6;
      const pg = ctx.createLinearGradient(x - 25, 0, x + 25, 0);
      pg.addColorStop(0, 'rgba(120,20,30,.5)'); pg.addColorStop(0.5, 'rgba(255,200,120,.25)'); pg.addColorStop(1, 'rgba(120,20,30,.5)');
      ctx.fillStyle = pg; ctx.fillRect(x - 25, 0, 50, h);
      ctx.fillStyle = 'rgba(255,215,100,.35)'; ctx.beginPath(); ctx.moveTo(x - 40, 0); ctx.lineTo(x + 40, 0); ctx.lineTo(x + 40, h * 0.18); ctx.lineTo(x, h * 0.24); ctx.lineTo(x - 40, h * 0.18); ctx.fill();
    }
  }
  if (theme === 'ice') {
    ctx.fillStyle = '#ffffff70';
    for (let i = 0; i < 14; i++) { const x = i * w / 13; ctx.beginPath(); ctx.moveTo(x - 65, h); ctx.lineTo(x, h * (.5 + rnd() * .3)); ctx.lineTo(x + 70, h); ctx.fill(); }
  }
  if (theme === 'lab') {
    ctx.strokeStyle = '#b7fff026'; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) for (let y = 0; y < h; y += 40) ctx.strokeRect(x, y, 40, 40);
    for (let i = 0; i < 18; i++) { ctx.beginPath(); ctx.arc(rnd() * w, rnd() * h, 12 + rnd() * 24, 0, TAU); ctx.stroke(); }
  }
  if (theme === 'nova') {
    for (let i = 0; i < 7; i++) { ctx.strokeStyle = ['#92ffd52a', '#b9a2ff30'][i % 2]; ctx.lineWidth = 24; ctx.beginPath(); ctx.moveTo(-50, h * .15 + i * 28); ctx.bezierCurveTo(w * .3, -50, w * .65, h * .6, w + 50, h * .05 + i * 35); ctx.stroke(); }
  }
  if (theme === 'space') {
    for (let i = 0; i < 3; i++) {
      const nx = rnd() * w, ny = rnd() * h, r = Math.min(w, h) * (0.25 + rnd() * 0.25);
      const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, r);
      ng.addColorStop(0, ['rgba(160,80,255,.35)', 'rgba(60,200,255,.3)', 'rgba(255,90,180,.28)'][i]); ng.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ng; ctx.fillRect(0, 0, w, h);
    }
  }
  if (theme === 'default' || theme === 'ending') {
    const colors = ['#ff4f64', '#33d16a', '#3d8bff', '#ffcd2e', '#b35cff'];
    for (let i = 0; i < 26; i++) { ctx.globalAlpha = 0.18; ctx.fillStyle = colors[i % 5]; ctx.beginPath(); ctx.arc(rnd() * w, rnd() * h, 14 + rnd() * 30, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ---------- 렌더러 ----------
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cache = new SkinCache();
    this.effects = new Effects();
    this.theme = 'default';
    this.bg = null;
    this.views = [];
    this.opts = {};
    this.pending = [];
    this.tick = 0;
    this.clash = new Clash();
    this.resize();
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    this.dpr = dpr; this.w = w; this.h = h;
    this.bg = null;
    this.relayout();
  }

  setTheme(theme) { if (theme !== this.theme) { this.theme = theme; this.bg = null; } }

  // views[i]: { name, level, skin, effect, char, tag, color }
  setup(views, opts = {}) {
    this.views = views.map(v => ({ ...v, vx: SPAWN_X, angle: 0, prevRot: 0, pieceRef: null, shown: 0, formula: null, formulaT: 0, shakeT: 0, fall: 0, mood: 'idle', moodT: 0, result: '' }));
    this.opts = opts;
    this.effects.clear();
    this.pending = [];
    this.clash.reset();
    this.relayout();
  }

  relayout() {
    this.layout = computeLayout(this.w, this.h, { solo: this.opts.solo, insets: this.opts.insets, symmetric: this.opts.symmetric, watch: this.opts.watch, clash: !!this.opts.clash });
  }

  setInsets(insets) { this.opts.insets = insets; this.relayout(); }

  cellCenter(i, x, y) {
    const f = this.layout.fields[i];
    return [f.x + (x + 0.5) * f.cell, f.y + (VISIBLE - 1 - y + 0.5) * f.cell];
  }

  // 매치 이벤트를 받아 효과를 준비한다 (고정 60프레임마다 한 번씩 부른다)
  onEvent(e, match) {
    if (this.opts.clash) {
      if (e.type === 'round') this.clash.reset();
      const gain = clashGain(e, match.specs);
      if (gain) this.clash.add(gain[0], gain[1]);
    }
    const i = e.p;
    const v = this.views[i];
    if (!v || !this.layout.fields[i]) return;
    const f = this.layout.fields[i];
    if (e.type === 'pop') {
      const player = match.players[i];
      const cells = [];
      for (let g = 0; g < e.groups.length; g++) for (const j of e.groups[g]) cells.push({ j, color: e.colors[g] });
      this.pending.push({ at: this.tick + TIMING.popFrames - 2, i, cells, garbage: player.popping?.garbage || [], chain: e.chain });
      // 연쇄 글자는 무리 가운데 위에
      let sx = 0, sy = 0;
      for (const c of cells) { const [x, y] = this.cellCenter(i, c.j % W, Math.floor(c.j / W)); sx += x; sy += y; }
      sx /= cells.length; sy /= cells.length;
      const size = f.cell * (f.mini ? 1.4 : 0.9) * Math.min(1.8, 1 + (e.chain - 1) * 0.08);
      this.effects.text(sx, sy - f.cell * 0.4, `${e.chain}연쇄!`, size, { rainbow: e.chain >= 7 });
      v.formula = `${e.puyos * 10} × ${e.score / (e.puyos * 10)}`;
      v.formulaT = 50;
      v.mood = 'attack'; v.moodT = 60;
      if (e.chain >= 4) this.effects.shake(Math.min(10, e.chain * 1.2) * (f.cell / 40), 14);
    } else if (e.type === 'allClear') {
      this.effects.text(f.x + f.cell * 3, f.y + f.cell * 5.5, '전소!', f.cell * (f.mini ? 2 : 1.5), { rainbow: true, life: 110, rise: 0.1 });
      v.mood = 'happy'; v.moodT = 90;
    } else if (e.type === 'offset' && e.amount >= 6) {
      this.effects.text(f.x + f.cell * 3, f.y + f.cell * 2.2, '상쇄!', f.cell * (f.mini ? 1.4 : 0.9), { color: '#9ff2ff', life: 60 });
    } else if (e.type === 'garbage') {
      v.shakeT = Math.min(24, 8 + e.count);
      v.mood = 'sad'; v.moodT = 50;
    } else if (e.type === 'dead') {
      v.fall = 0.001;
    }
  }

  step(match) {
    this.tick++;
    for (const p of this.pending.filter(p => p.at <= this.tick)) {
      const f = this.layout.fields[p.i], v = this.views[p.i];
      if (!f || !v) continue;
      for (const c of p.cells) { const [x, y] = this.cellCenter(p.i, c.j % W, Math.floor(c.j / W)); this.effects.pop(v.effect || 'sparkle', x, y, c.color, f.cell * (f.mini ? 1.3 : 1), p.chain); }
      for (const j of p.garbage) { const [x, y] = this.cellCenter(p.i, j % W, Math.floor(j / W)); this.effects.crumble(x, y, f.cell); }
    }
    this.pending = this.pending.filter(p => p.at > this.tick);
    this.effects.update();
    for (const v of this.views) {
      if (v.formulaT > 0) v.formulaT--;
      if (v.shakeT > 0) v.shakeT--;
      if (v.moodT > 0 && --v.moodT === 0 && !v.result) v.mood = 'idle';
      if (v.fall > 0) v.fall += 1;
    }
    if (this.opts.clash && match) this.stepClash(match);
    this.match = match;
  }

  // 힘겨루기: 한 판 내내 이어지는 줄다리기. 금을 끝까지 민 채로 떨어질 방해 뿌요와 연쇄가 다 끝나면 「승!」
  stepClash(match) {
    // 판이 끝난 뒤에는 필드에 WIN / LOSE 가 뜨므로 힘겨루기 승부는 대전 중에만 알린다
    const busy = match.phase !== 'play' || match.remoteChaining || match.players.some(p => p.incoming > 0 || p.chaining);
    this.clash.step(busy);
    const end = this.clash.takeEnded(), box = this.layout.clash;
    if (!end || !box) return;
    this.effects.text(box.x + box.w / 2, box.y + box.h * 1.7, `${this.clashNames()[end.winner]} 승!`, box.h * 0.85, { color: end.winner === 1 ? '#ffb3c8' : '#fff6a8', life: 70, rise: 0.1 });
  }
  clashNames() { return this.opts.clash?.names || ['나', '상대']; }

  setResult(i, result) {
    const v = this.views[i];
    if (!v) return;
    v.result = result;
    v.mood = result === 'win' ? 'happy' : result === 'lose' ? 'sad' : 'idle';
    v.moodT = 0;
  }
  resetRound() {
    for (const v of this.views) { v.result = ''; v.fall = 0; v.mood = 'idle'; v.pieceRef = null; v.shown = 0; }
    this.clash.reset();
    this.effects.clear();
    this.pending = [];
  }

  // ---------- 그리기 ----------
  draw(match, time) {
    const ctx = this.ctx, dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!this.bg) {
      this.bg = document.createElement('canvas');
      this.bg.width = Math.round(this.w * dpr); this.bg.height = Math.round(this.h * dpr);
      const b = this.bg.getContext('2d'); b.scale(dpr, dpr);
      paintBackground(b, this.theme, this.w, this.h);
    }
    ctx.drawImage(this.bg, 0, 0, this.w, this.h);
    this.drawAmbient(ctx, time);
    if (!match) return;
    const [sx, sy] = this.effects.offset();
    ctx.save();
    ctx.translate(sx, sy);
    match.players.forEach((p, i) => this.drawSide(ctx, match, p, i, time));
    if (!this.layout.solo && this.layout.center) this.drawCenter(ctx, match, time);
    if (this.layout.solo) this.drawSoloSide(ctx, match, time);
    if (this.layout.clash && this.opts.clash) this.drawClash(ctx, time);
    this.effects.draw(ctx);
    ctx.restore();
    this.drawOverlay(ctx, match);
    this.effects.drawFlash(ctx, this.w, this.h);
  }

  drawAmbient(ctx, time) {
    if (DARK.has(this.theme)) {
      for (let i = 0; i < 18; i++) {
        const x = ((i * 137.5) % 100) / 100 * this.w, y = ((i * 71.3) % 100) / 100 * this.h * 0.8;
        const a = 0.3 + 0.7 * Math.abs(Math.sin(time * 1.5 + i));
        ctx.fillStyle = `rgba(255,255,230,${a})`;
        ctx.beginPath(); ctx.arc(x, y, 1.4 + (i % 3) * 0.4, 0, TAU); ctx.fill();
      }
      if (this.theme === 'crater' || this.theme === 'starry' || this.theme === 'space' || this.theme === 'night') {
        const k = (time * 0.35) % 1, x = this.w * (1.1 - k * 1.3), y = this.h * (k * 0.7 - 0.05);
        const g = ctx.createLinearGradient(x, y, x + 90, y - 50);
        g.addColorStop(0, this.theme === 'crater' ? 'rgba(255,170,80,.9)' : 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 90, y - 50); ctx.stroke();
      }
    }
  }

  drawSide(ctx, match, player, i, time) {
    const f = this.layout.fields[i];
    if (!f) return;
    const v = this.views[i] || {};
    const c = f.cell;
    let ox = 0, oy = 0;
    if (v.shakeT > 0) { ox = Math.sin(v.shakeT * 2.1) * c * 0.08 * (v.shakeT / 12); oy = Math.cos(v.shakeT * 1.7) * c * 0.05; }
    ctx.save();
    ctx.translate(ox, oy);
    // 필드 판
    const pad = c * 0.14;
    roundRect(ctx, f.x - pad, f.y - pad - c * 0.45, c * 6 + pad * 2, c * 12 + pad * 2 + c * 0.45, c * 0.35);
    ctx.fillStyle = 'rgba(16,10,40,.72)'; ctx.fill();
    ctx.lineWidth = Math.max(2, c * 0.1); ctx.strokeStyle = v.color || 'rgba(255,255,255,.85)'; ctx.stroke();
    // 칸 점
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    for (let y = 0; y < VISIBLE; y++) for (let x = 0; x < W; x++) { const [px, py] = this.cellCenter(i, x, y); ctx.beginPath(); ctx.arc(px, py, c * 0.06, 0, TAU); ctx.fill(); }
    // X 표시 (여기가 막히면 짐)
    {
      const [px, py] = this.cellCenter(i, SPAWN_X, SPAWN_Y);
      const danger = player.h && player.h[SPAWN_X] >= 9;
      ctx.strokeStyle = danger && Math.floor(time * 4) % 2 ? '#ff4f64' : 'rgba(255,90,110,.55)';
      ctx.lineWidth = Math.max(2, c * 0.1); ctx.lineCap = 'round';
      const s = c * 0.26;
      ctx.beginPath(); ctx.moveTo(px - s, py - s); ctx.lineTo(px + s, py + s); ctx.moveTo(px + s, py - s); ctx.lineTo(px - s, py + s); ctx.stroke();
    }
    // 판 안쪽만 그리기 (13번째 줄은 반쯤 보이게)
    ctx.save();
    ctx.beginPath(); ctx.rect(f.x - pad, f.y - c * 0.45, c * 6 + pad * 2, c * 12 + c * 0.45 + pad);
    ctx.clip();
    if (v.fall > 0) {
      const d = v.fall * v.fall * 0.06 * c / 10;
      ctx.translate(0, d);
      ctx.globalAlpha = Math.max(0, 1 - v.fall / 90);
    }
    this.drawCells(ctx, player, i, f, v, time);
    ctx.restore();
    // 결과 글자
    if (v.result) {
      const big = v.result === 'win' ? 'WIN!' : v.result === 'lose' ? 'LOSE' : 'DRAW';
      const size = c * (f.mini ? 2.2 : 1.6);
      ctx.save();
      ctx.translate(f.x + c * 3, f.y + c * 5 + Math.sin(time * 4) * c * 0.15);
      ctx.font = `${Math.round(size)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.2; ctx.strokeStyle = '#2a1640'; ctx.strokeText(big, 0, 0);
      const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
      if (v.result === 'win') { g.addColorStop(0, '#fff6a8'); g.addColorStop(1, '#ff9f1f'); } else { g.addColorStop(0, '#d8e2ff'); g.addColorStop(1, '#7d8bb5'); }
      ctx.fillStyle = g; ctx.fillText(big, 0, 0);
      ctx.restore();
    }
    this.drawTray(ctx, match, player, i, time);
    this.drawScore(ctx, player, i);
    if (this.layout.label) this.drawLabel(ctx, i);
    if (!this.layout.next[i]?.hidden) this.drawNext(ctx, player, i, v);
    ctx.restore();
  }

  drawCells(ctx, player, i, f, v, time) {
    const c = f.cell, skin = v.skin || 'classic';
    const style = SKIN_STYLE[skin] || SKIN_STYLE.classic;
    const cells = player.cells;
    const hidden = new Set();
    const falling = player.falling || [];
    for (const fl of falling) if (fl.y > fl.to + 0.001) hidden.add(idx(fl.x, fl.to));
    const popping = player.popping?.cells;
    const popT = player.state === 'pop' ? (TIMING.popFrames - player.timer) : -1;
    const garbagePop = new Set(player.popping?.garbage || []);
    const flashOn = popT >= 0 && popT < 26 && Math.floor(popT / 3) % 2 === 0;
    const items = [];
    for (let y = 0; y <= 12; y++) for (let x = 0; x < W; x++) {
      const j = idx(x, y), col = cells[j];
      if (!col || hidden.has(j)) continue;
      const [px, py] = this.cellCenter(i, x, y);
      const land = player.land?.get(j) || 0;
      const pop = popping?.has(j) || garbagePop.has(j);
      items.push({ x, y, j, col, px, py, land, pop });
    }
    for (const fl of falling) {
      if (fl.y <= fl.to + 0.001) continue;
      const [px, py] = this.cellCenter(i, fl.x, fl.y);
      items.push({ x: fl.x, y: fl.y, j: -1, col: fl.color, px, py, land: 0, pop: false, moving: true });
    }
    // 1) 몸통
    for (const it of items) this.drawLayer(ctx, it, c, skin, 'body', popT, time);
    // 2) 다리 (같은 색끼리 이어 붙이기)
    if (style.connect) {
      for (const it of items) {
        if (it.moving || it.col === GARBAGE || it.y >= VISIBLE) continue;
        if (it.pop && popT > 26) continue;
        const right = it.x < W - 1 ? cells[idx(it.x + 1, it.y)] : 0;
        const up = it.y < VISIBLE - 1 ? cells[idx(it.x, it.y + 1)] : 0;
        if (right === it.col && !hidden.has(idx(it.x + 1, it.y))) drawBridge(ctx, skin, it.col, it.px, it.py, c, true);
        if (up === it.col && !hidden.has(idx(it.x, it.y + 1))) drawBridge(ctx, skin, it.col, it.px, it.py, c, false);
      }
    }
    // 3) 얼굴
    for (const it of items) this.drawLayer(ctx, it, c, skin, 'face', popT, time);
    if (flashOn) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      for (const it of items) if (it.pop) { ctx.beginPath(); ctx.arc(it.px, it.py, c * 0.46, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    // 그림자(떨어질 자리)와 조작 중인 짝
    const p = player.piece;
    if (p && player.state === 'control') {
      if (v.pieceRef !== p) { v.pieceRef = p; v.vx = p.x; v.angle = p.rot * 90; v.prevRot = p.rot; v.shownAngle = v.angle; }
      if (p.rot !== v.prevRot) {
        let d = (p.rot - v.prevRot + 4) % 4;
        if (d === 3) d = -1;
        v.angle += d * 90; v.prevRot = p.rot;
      }
      v.shownAngle += (v.angle - v.shownAngle) * 0.45;
      if (Math.abs(v.angle - v.shownAngle) < 0.5) v.shownAngle = v.angle;
      v.vx += (p.x - v.vx) * 0.5;
      if (Math.abs(p.x - v.vx) < 0.01) v.vx = p.x;
      if (this.opts.ghost !== false && !f.mini) {
        const ghost = player.ghost?.();
        if (ghost) for (const gp of ghost) {
          if (gp.y >= 13) continue;
          const [gx, gy] = this.cellCenter(i, gp.x, gp.y);
          ctx.save(); ctx.globalAlpha = 0.35;
          ctx.strokeStyle = PALETTE[gp.v].light; ctx.lineWidth = Math.max(1.5, c * 0.07); ctx.setLineDash([c * 0.12, c * 0.1]);
          ctx.beginPath(); ctx.arc(gx, gy, c * 0.34, 0, TAU); ctx.stroke();
          ctx.restore();
        }
      }
      const a = v.shownAngle * Math.PI / 180;
      const ax = v.vx, ay = p.y;
      const cxp = ax + Math.sin(a), cyp = ay + Math.cos(a);
      const [apx, apy] = this.cellCenter(i, ax, ay);
      const [cpx, cpy] = this.cellCenter(i, cxp, cyp);
      const pulse = 0.5 + 0.5 * Math.sin(time * 10);
      const aItem = { col: p.a, px: apx, py: apy, land: 0, pop: false, j: -2 }, cItem = { col: p.c, px: cpx, py: cpy, land: 0, pop: false, j: -3 };
      if (style.connect && p.a === p.c && Math.abs(v.shownAngle - v.angle) < 1) {
        this.drawLayer(ctx, aItem, c, skin, 'body', -1, time); this.drawLayer(ctx, cItem, c, skin, 'body', -1, time);
        const horizontal = p.rot === 1 || p.rot === 3;
        const [bx, by] = p.rot === 1 ? [apx, apy] : p.rot === 3 ? [cpx, cpy] : p.rot === 0 ? [apx, apy] : [cpx, cpy];
        drawBridge(ctx, skin, p.a, bx, by, c, horizontal);
        this.drawLayer(ctx, aItem, c, skin, 'face', -1, time); this.drawLayer(ctx, cItem, c, skin, 'face', -1, time);
      } else {
        for (const it of [cItem, aItem]) { this.drawLayer(ctx, it, c, skin, 'body', -1, time); this.drawLayer(ctx, it, c, skin, 'face', -1, time); }
      }
      // 축 뿌요는 테두리가 반짝인다
      ctx.save();
      ctx.strokeStyle = `rgba(255,255,255,${0.35 + pulse * 0.5})`; ctx.lineWidth = Math.max(1.5, c * 0.07);
      ctx.beginPath(); ctx.arc(apx, apy, c * 0.5, 0, TAU); ctx.stroke();
      ctx.restore();
    }
  }

  drawLayer(ctx, it, c, skin, layer, popT, time) {
    let sx = 1, sy = 1, alpha = 1;
    if (it.land > 0) { const k = it.land / TIMING.landFrames; sx = 1 + 0.2 * k; sy = 1 - 0.22 * k; }
    if (it.pop && popT >= 0) {
      if (popT > 26) { const k = (popT - 26) / (TIMING.popFrames - 26); sx = sy = 1 + k * 0.35; alpha = 1 - k; }
    }
    let variant = 0;
    if (layer === 'face') {
      if (it.pop && popT >= 0) variant = 2;
      else if (it.j >= 0 && ((Math.floor(time * 2 + it.j * 0.37) % 11) === 0) && ((time * 2 + it.j * 0.37) % 1) < 0.18) variant = 1;
    }
    const sprite = this.cache.sprite(skin, it.col, c * this.dpr, layer, variant);
    const size = sprite.width / this.dpr;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(it.px, it.py + c * 0.46);
    ctx.scale(sx, sy);
    ctx.drawImage(sprite, -size / 2, -size / 2 - c * 0.46, size, size);
    ctx.restore();
  }

  drawTray(ctx, match, player, i, time) {
    const tray = this.layout.tray[i];
    if (!tray || match.solo) return;
    const n = player.incoming || 0;
    const icons = garbageIcons(n, 6);
    const opp = match.players[1 - i];
    const locked = opp && (match.specs?.[1 - i]?.kind === 'remote' ? match.remoteChaining : opp.chaining);
    const s = Math.min(tray.h, tray.w / 6);
    ctx.save();
    roundRect(ctx, tray.x, tray.y, tray.w, tray.h, tray.h * 0.3);
    ctx.fillStyle = 'rgba(16,10,40,.45)'; ctx.fill();
    icons.forEach((id, k) => {
      const bounce = locked ? 0 : Math.abs(Math.sin(time * 6 + k)) * s * 0.08;
      ctx.globalAlpha = locked ? 0.55 + 0.25 * Math.sin(time * 8) : 1;
      drawGarbageIcon(ctx, id, tray.x + s * (k + 0.5) + (tray.w - s * 6) / 2, tray.y + tray.h / 2 - bounce, s * 0.86, time);
    });
    ctx.restore();
  }

  drawScore(ctx, player, i) {
    const box = this.layout.score[i];
    if (!box) return;
    const v = this.views[i];
    v.shown = v.shown + Math.ceil((player.score - v.shown) * 0.2);
    if (Math.abs(player.score - v.shown) < 2 || v.shown > player.score) v.shown = player.score;
    ctx.save();
    roundRect(ctx, box.x, box.y, box.w, box.h, box.h * 0.3);
    ctx.fillStyle = 'rgba(16,10,40,.62)'; ctx.fill();
    const fs = Math.round(box.h * (this.layout.fields[i].mini ? 0.42 : 0.62));
    ctx.font = `${fs}px ${FONT}`; ctx.textBaseline = 'middle';
    if (v.formulaT > 0) {
      ctx.textAlign = 'center'; ctx.fillStyle = '#9ff2ff';
      ctx.fillText(v.formula, box.x + box.w / 2, box.y + box.h / 2);
    } else {
      if (this.layout.watch) {
        ctx.textAlign = 'left'; ctx.fillStyle = '#ffe45c';
        ctx.fillText('점수', box.x + box.h * 0.35, box.y + box.h / 2);
      }
      ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
      ctx.fillText(String(v.shown).padStart(8, '0'), box.x + box.w - box.h * 0.35, box.y + box.h / 2);
    }
    ctx.restore();
  }

  // 관전: 필드 위 이름표 "닉네임 Lv.레벨" (인혁이 기획서 4번 그림)
  drawLabel(ctx, i) {
    const box = this.layout.label?.[i], v = this.views[i];
    if (!box || !v) return;
    const text = `${v.name || '?'}  Lv.${v.level || 1}`;
    ctx.save();
    roundRect(ctx, box.x, box.y, box.w, box.h, box.h * 0.35);
    ctx.fillStyle = 'rgba(16,10,40,.7)'; ctx.fill();
    ctx.lineWidth = Math.max(2, box.h * 0.08); ctx.strokeStyle = v.color || 'rgba(255,255,255,.85)'; ctx.stroke();
    let size = box.h * 0.58;
    ctx.font = `${Math.round(size)}px ${FONT}`;
    while (ctx.measureText(text).width > box.w * 0.92 && size > box.h * 0.3) { size *= 0.92; ctx.font = `${Math.round(size)}px ${FONT}`; }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
    ctx.fillText(text, box.x + box.w / 2, box.y + box.h / 2);
    ctx.restore();
  }

  drawNext(ctx, player, i, v) {
    const n = this.layout.next[i];
    if (!n || !player.next) return;
    const [p1, p2] = player.next;
    const c = n.cell, skin = v.skin || 'classic';
    ctx.save();
    roundRect(ctx, n.x - c * 0.15, n.y - c * 0.1, c * 1.9, c * 3.7, c * 0.3);
    ctx.fillStyle = 'rgba(16,10,40,.55)'; ctx.fill();
    ctx.font = `${Math.round(c * 0.38)}px ${FONT}`; ctx.fillStyle = '#ffe45c'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('NEXT', n.x, n.y);
    const draw = (pair, x, y, s) => {
      for (const [col, dy] of [[pair[1], 0], [pair[0], 1]]) {
        const it = { col, px: x, py: y + dy * s, land: 0, pop: false, j: -4 };
        this.drawLayer(ctx, it, s, skin, 'body', -1, 0);
        this.drawLayer(ctx, it, s, skin, 'face', -1, 0);
      }
    };
    draw(p1, n.x + c * 0.55, n.y + c * 0.95, c);
    draw(p2, n.x + c * 1.35, n.y + c * 1.7, c * 0.7);
    ctx.restore();
  }

  drawCenter(ctx, match, time) {
    const box = this.layout.center;
    const c = this.layout.cell;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (this.layout.portrait) {
      const v = this.views[1] || {};
      const label = `${v.name || ''}`;
      let size = c * 0.42;
      ctx.font = `${Math.round(size)}px ${FONT}`;
      while (ctx.measureText(label).width > box.w * 0.98 && size > c * 0.24) { size *= 0.92; ctx.font = `${Math.round(size)}px ${FONT}`; }
      ctx.fillStyle = v.color || '#fff'; ctx.lineWidth = size * 0.28; ctx.strokeStyle = 'rgba(20,10,40,.75)'; ctx.lineJoin = 'round';
      ctx.strokeText(label, box.x + box.w / 2, box.y + c * 0.3); ctx.fillText(label, box.x + box.w / 2, box.y + c * 0.3);
      if (match.firstTo > 1) this.drawWins(ctx, match, box.x + box.w / 2, box.y + c * 0.78, c * 0.62);
      if (this.opts.duel && this.views[0]?.char) {
        // 온라인 대전: 두 사람이 고른 캐릭터를 나란히 (왼쪽이 나)
        drawCharacter(ctx, this.views[0].char, box.x + box.w * 0.26, box.y + c * 1.6, c * 1.05, this.views[0].mood, time, this.views[0].charExtra || {});
        if (v.char) drawCharacter(ctx, v.char, box.x + box.w * 0.74, box.y + c * 1.6, c * 1.05, v.mood, time);
      } else if (v.char) drawCharacter(ctx, v.char, box.x + box.w / 2, box.y + c * 1.6, c * 1.15, v.mood, time);
      ctx.restore();
      return;
    }
    if (this.layout.watch && box.strip) {
      // 좁은 화면: 맨 위 한 줄에 "👀 관전 중 · VS · 판 수"
      const wins = match.firstTo > 1 ? `  ${match.wins[0]} : ${match.wins[1]} (${match.firstTo}선승)` : '';
      ctx.font = `${Math.round(c * 0.5)}px ${FONT}`; ctx.fillStyle = '#ffe45c';
      ctx.lineJoin = 'round'; ctx.lineWidth = c * 0.12; ctx.strokeStyle = 'rgba(20,10,40,.75)';
      const text = `👀 관전 중 · VS${wins}`;
      ctx.strokeText(text, box.x + box.w / 2, box.y + box.h / 2); ctx.fillText(text, box.x + box.w / 2, box.y + box.h / 2);
      ctx.restore();
      return;
    }
    if (this.layout.watch) {
      ctx.font = `${Math.round(c * 0.36)}px ${FONT}`; ctx.fillStyle = '#9ff2ff';
      ctx.lineJoin = 'round'; ctx.lineWidth = c * 0.12; ctx.strokeStyle = 'rgba(20,10,40,.75)';
      ctx.strokeText('👀 관전 중', box.x + box.w / 2, box.y + c * 0.2); ctx.fillText('👀 관전 중', box.x + box.w / 2, box.y + c * 0.2);
      ctx.font = `${Math.round(c * 0.7)}px ${FONT}`; ctx.fillStyle = '#ffe45c';
      ctx.strokeText('VS', box.x + box.w / 2, box.y + c * 1.1); ctx.fillText('VS', box.x + box.w / 2, box.y + c * 1.1);
      this.drawWins(ctx, match, box.x + box.w / 2, box.y + c * 2, c);
      ctx.restore();
      return;
    }
    // 이름표
    const names = this.views.map(v => `${v.name || ''}${v.level ? ` Lv.${v.level}` : ''}`);
    ctx.font = `${Math.round(c * 0.4)}px ${FONT}`;
    ctx.lineJoin = 'round'; ctx.lineWidth = c * 0.12; ctx.strokeStyle = 'rgba(20,10,40,.75)';
    ctx.fillStyle = this.views[0]?.color || '#fff';
    ctx.strokeText(names[0], box.x + box.w / 2, box.y + c * 0.2); ctx.fillText(names[0], box.x + box.w / 2, box.y + c * 0.2);
    ctx.font = `${Math.round(c * 0.55)}px ${FONT}`; ctx.fillStyle = '#ffe45c';
    ctx.strokeText('VS', box.x + box.w / 2, box.y + c * 0.85); ctx.fillText('VS', box.x + box.w / 2, box.y + c * 0.85);
    ctx.font = `${Math.round(c * 0.4)}px ${FONT}`; ctx.fillStyle = this.views[1]?.color || '#fff';
    ctx.strokeText(names[1], box.x + box.w / 2, box.y + c * 1.5); ctx.fillText(names[1], box.x + box.w / 2, box.y + c * 1.5);
    this.drawWins(ctx, match, box.x + box.w / 2, box.y + c * 2.3, c);
    // 캐릭터
    const chars = this.views.map(v => v.char);
    if (this.opts.duel) {
      // 온라인 대전 (기획서 3번): 두 사람이 고른 캐릭터를 자기 필드 쪽에 같은 크기로
      if (chars[0]) drawCharacter(ctx, chars[0], box.x + box.w * 0.25, box.y + c * 5.5, c * 1.95, this.views[0].mood, time, this.views[0].charExtra || {});
      if (chars[1]) drawCharacter(ctx, chars[1], box.x + box.w * 0.75, box.y + c * 5.5, c * 1.95, this.views[1].mood, time);
    } else {
      if (chars[1]) drawCharacter(ctx, chars[1], box.x + box.w / 2, box.y + c * 4.4, c * 2.9, this.views[1].mood, time);
      if (chars[0]) drawCharacter(ctx, chars[0], box.x + box.w / 2, box.y + c * 7.1, c * 1.9, this.views[0].mood, time, this.views[0].charExtra || {});
    }
    // 마진 타임
    if (match.frame > 96 * 60 && match.phase === 'play') {
      ctx.font = `${Math.round(c * 0.32)}px ${FONT}`; ctx.fillStyle = '#ff9fb0';
      ctx.fillText(`마진 타임! 방해 뿌요 ×${(70 / match.target).toFixed(1)}`, box.x + box.w / 2, box.y + c * 8.4);
    }
    ctx.restore();
  }

  // 힘겨루기 막대 (기획서 2번 그림): 왼쪽은 나, 오른쪽은 상대. 가운데 번개 금이 앞선 쪽에서 뒤진 쪽으로 밀려간다.
  drawClash(ctx, time) {
    const box = this.layout.clash, k = this.clash, names = this.clashNames();
    const colors = [this.views[0]?.color || '#ffe45c', this.views[1]?.color || '#9fe3ff'];
    const fight = k.fighting, pulse = k.bump / 14;
    const h = box.h * (1 + pulse * 0.12), y = box.y - (h - box.h) / 2, x = box.x, w = box.w;
    const mid = x + w * k.pos + (fight ? Math.sin(time * 38) * h * 0.07 : 0);
    const amp = h * 0.2, steps = 5, zig = [];
    for (let i = 0; i <= steps; i++) zig.push([mid + (i % 2 ? amp : -amp), y + h * i / steps]);
    const line = () => { ctx.beginPath(); zig.forEach(([zx, zy], i) => (i ? ctx.lineTo(zx, zy) : ctx.moveTo(zx, zy))); };
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.save();
    roundRect(ctx, x, y, w, h, h * 0.42); ctx.clip();
    ctx.fillStyle = colors[1]; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = colors[0];
    ctx.beginPath(); ctx.moveTo(x, y); for (const [zx, zy] of zig) ctx.lineTo(zx, zy); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
    const shade = ctx.createLinearGradient(0, y, 0, y + h);
    shade.addColorStop(0, 'rgba(255,255,255,.38)'); shade.addColorStop(0.5, 'rgba(255,255,255,0)'); shade.addColorStop(1, 'rgba(40,20,80,.3)');
    ctx.fillStyle = shade; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#2a1640'; ctx.lineWidth = Math.max(3, h * 0.22); line(); ctx.stroke();
    ctx.strokeStyle = fight && Math.floor(time * 12) % 2 ? '#fff27a' : '#ffffff'; ctx.lineWidth = Math.max(1.5, h * 0.1); line(); ctx.stroke();
    ctx.restore();
    roundRect(ctx, x, y, w, h, h * 0.42);
    ctx.lineWidth = Math.max(2, h * 0.09); ctx.strokeStyle = '#2a1640'; ctx.stroke();
    // 이름과, 앞선 쪽 이름 옆에는 얼마나 앞서는지 (예고 칸과 같은 방해 뿌요 그림)
    const pad = h * 0.45, icon = h * 0.62;
    ctx.textBaseline = 'middle'; ctx.lineWidth = Math.max(2, h * 0.16); ctx.strokeStyle = '#2a1640'; ctx.fillStyle = '#fff';
    [0, 1].forEach(side => {
      let size = h * 0.62;
      ctx.font = `${Math.round(size)}px ${FONT}`;
      while (ctx.measureText(names[side]).width > w * 0.24 && size > h * 0.32) { size *= 0.92; ctx.font = `${Math.round(size)}px ${FONT}`; }
      const tw = ctx.measureText(names[side]).width, dir = side ? -1 : 1, tx = side ? x + w - pad : x + pad;
      ctx.textAlign = side ? 'right' : 'left';
      ctx.strokeText(names[side], tx, y + h / 2); ctx.fillText(names[side], tx, y + h / 2);
      garbageIcons(side === k.leader ? Math.abs(k.lead) : 0, 3).forEach((id, n) => drawGarbageIcon(ctx, id, tx + dir * (tw + icon * (n + 0.75)), y + h / 2, icon, time));
    });
    // 서로 밀고 있을 때는 금 둘레에 불꽃이 튄다
    if (fight) {
      ctx.strokeStyle = '#fff6a8'; ctx.lineWidth = Math.max(1.5, h * 0.07);
      for (let i = 0; i < 6; i++) {
        const a = time * 9 + i * TAU / 6, r1 = h * 0.55, r2 = h * (0.8 + 0.22 * Math.sin(time * 20 + i));
        ctx.beginPath(); ctx.moveTo(mid + Math.cos(a) * r1, y + h / 2 + Math.sin(a) * r1 * 0.7); ctx.lineTo(mid + Math.cos(a) * r2, y + h / 2 + Math.sin(a) * r2 * 0.7); ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawWins(ctx, match, x, y, c) {
    if (!match || match.firstTo <= 1) return;
    ctx.save();
    ctx.font = `${Math.round(c * 0.42)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = c * 0.1; ctx.strokeStyle = 'rgba(20,10,40,.7)'; ctx.lineJoin = 'round';
    const text = `${match.wins[0]} : ${match.wins[1]}  (${match.firstTo}선승)`;
    ctx.fillStyle = '#fff'; ctx.strokeText(text, x, y); ctx.fillText(text, x, y);
    ctx.restore();
  }

  drawSoloSide(ctx, match, time) {
    const box = this.layout.side, c = this.layout.cell, p = match.players[0];
    ctx.save();
    roundRect(ctx, box.x, box.y, box.w, box.h, c * 0.3);
    ctx.fillStyle = 'rgba(16,10,40,.55)'; ctx.fill();
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#fff';
    const lines = [
      ['속도', `${Math.min(16, Math.floor(p.stats.pieces / 25) + 1)}단계`],
      ['놓은 뿌요', `${p.stats.pieces}쌍`],
      ['최대 연쇄', `${p.stats.maxChain}연쇄`],
      ['터뜨린 뿌요', `${p.stats.popped}개`],
      ['전소', `${p.stats.allClears}번`],
    ];
    lines.forEach(([k, val], n) => {
      ctx.font = `${Math.round(c * 0.3)}px ${FONT}`; ctx.fillStyle = '#b9b3ff'; ctx.fillText(k, box.x + c * 0.3, box.y + c * (0.3 + n * 1.05));
      ctx.font = `${Math.round(c * 0.45)}px ${FONT}`; ctx.fillStyle = '#fff'; ctx.fillText(val, box.x + c * 0.3, box.y + c * (0.62 + n * 1.05));
    });
    drawCharacter(ctx, 'hero', box.x + box.w / 2, box.y + box.h - c * 1.2, c * 1.8, this.views[0]?.mood || 'idle', time);
    ctx.restore();
  }

  drawOverlay(ctx, match) {
    if (match.phase !== 'countdown') return;
    const t = match.timer;
    const text = t > 120 ? '준비~' : t > 80 ? '3' : t > 40 ? '2' : '1';
    const k = ((t - 1) % 40) / 40;
    const size = Math.min(this.w, this.h) * (text === '준비~' ? 0.12 : 0.18) * (0.8 + k * 0.4);
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 3);
    ctx.font = `${Math.round(size)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.18; ctx.strokeStyle = '#2a1640';
    const y = this.layout.fields[0].y + this.layout.cell * 5;
    const x = this.layout.solo ? this.layout.fields[0].x + this.layout.cell * 3 : this.w / 2;
    ctx.strokeText(text, x, y);
    const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2); g.addColorStop(0, '#fff6a8'); g.addColorStop(1, '#ff8a1f');
    ctx.fillStyle = g; ctx.fillText(text, x, y);
    ctx.restore();
  }
}

export { paintBackground, roundRect, THEMES };
