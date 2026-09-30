// 게임 화면 그리기: 배경, 두 필드, 다음 뿌요, 방해뿌요 예고, 점수, 캐릭터, 효과.
import { W, VISIBLE, GARBAGE, garbageIcons, idx, SPAWN_X, SPAWN_Y, TIMING } from './core.mjs';
import { SkinCache, SKIN_STYLE, PALETTE, drawBridge } from './skins.mjs';
import { Effects } from './effects.mjs';
import { drawCharacter, drawGarbageIcon } from './characters.mjs';

const TAU = Math.PI * 2;
const FONT = "Jua, 'Noto Sans KR', sans-serif";

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
  const portrait = opt.portrait ?? (aw / ah < 1.05);
  if (portrait && !opt.symmetric) {
    const c = Math.floor(Math.min(aw / 9.9, ah / 14.9));
    const m = c * 0.46;
    const totalW = c * 9.7, totalH = c * 14.6;
    const x0 = ox + (aw - totalW) / 2, y0 = oy + (ah - totalH) / 2;
    const f0 = { x: x0 + c * 0.2, y: y0 + c * 1.3, cell: c };
    const rx = f0.x + c * 6.35;
    const f1 = { x: rx + (c * 3.1 - m * 6) / 2, y: f0.y + c * 6.15, cell: m, mini: true };
    return {
      portrait: true, cell: c,
      fields: [f0, f1],
      next: [{ x: rx + c * 0.45, y: f0.y, cell: c * 0.85 }, { x: f1.x + m * 6.2, y: f1.y + m * 0.2, cell: m * 0.8, hidden: true }],
      tray: [{ x: f0.x, y: f0.y - c * 1.2, w: c * 6, h: c * 0.95 }, { x: f1.x, y: f1.y - m * 1.5, w: m * 6, h: m * 1.2 }],
      score: [{ x: f0.x, y: f0.y + c * 12.15, w: c * 6, h: c * 1 }, { x: f1.x - m * 0.5, y: f1.y + m * 12.25, w: m * 7, h: m * 1.8 }],
      center: { x: rx, y: f0.y + c * 3.3, w: c * 3.1, h: c * 2.1 },
    };
  }
  const c = Math.floor(Math.min(aw / 17.4, ah / 15));
  const totalW = c * 17, totalH = c * 14.7;
  const x0 = ox + (aw - totalW) / 2, y0 = oy + (ah - totalH) / 2;
  const f0 = { x: x0 + c * 0.2, y: y0 + c * 1.35, cell: c };
  const f1 = { x: x0 + c * 10.8, y: f0.y, cell: c };
  const cx = f0.x + c * 6.4;
  return {
    portrait: false, cell: c,
    fields: [f0, f1],
    next: [{ x: cx + c * 0.15, y: f0.y, cell: c * 0.8 }, { x: f1.x - c * 1.75, y: f0.y, cell: c * 0.8 }],
    tray: [{ x: f0.x, y: f0.y - c * 1.2, w: c * 6, h: c * 0.95 }, { x: f1.x, y: f1.y - c * 1.2, w: c * 6, h: c * 0.95 }],
    score: [{ x: f0.x, y: f0.y + c * 12.15, w: c * 6, h: c * 1 }, { x: f1.x, y: f1.y + c * 12.15, w: c * 6, h: c * 1 }],
    center: { x: cx, y: f0.y + c * 3.6, w: c * 4, h: c * 8.4 },
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
  ending: ['#ff9ec7', '#ffd88a', '#8fd8ff'],
};

function paintBackground(ctx, theme, w, h, seed = 7) {
  const cols = THEMES[theme] || THEMES.default;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, cols[0]); g.addColorStop(0.6, cols[1]); g.addColorStop(1, cols[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const dark = ['crater', 'starry', 'moon', 'space'].includes(theme);
  if (dark) {
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
    this.relayout();
  }

  relayout() {
    this.layout = computeLayout(this.w, this.h, { solo: this.opts.solo, insets: this.opts.insets, symmetric: this.opts.symmetric });
  }

  setInsets(insets) { this.opts.insets = insets; this.relayout(); }

  cellCenter(i, x, y) {
    const f = this.layout.fields[i];
    return [f.x + (x + 0.5) * f.cell, f.y + (VISIBLE - 1 - y + 0.5) * f.cell];
  }

  // 매치 이벤트를 받아 효과를 준비한다 (고정 60프레임마다 한 번씩 부른다)
  onEvent(e, match) {
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
    this.match = match;
  }

  setResult(i, result) {
    const v = this.views[i];
    if (!v) return;
    v.result = result;
    v.mood = result === 'win' ? 'happy' : result === 'lose' ? 'sad' : 'idle';
    v.moodT = 0;
  }
  resetRound() {
    for (const v of this.views) { v.result = ''; v.fall = 0; v.mood = 'idle'; v.pieceRef = null; v.shown = 0; }
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
    this.effects.draw(ctx);
    ctx.restore();
    this.drawOverlay(ctx, match);
    this.effects.drawFlash(ctx, this.w, this.h);
  }

  drawAmbient(ctx, time) {
    const dark = ['crater', 'starry', 'moon', 'space'].includes(this.theme);
    if (dark) {
      for (let i = 0; i < 18; i++) {
        const x = ((i * 137.5) % 100) / 100 * this.w, y = ((i * 71.3) % 100) / 100 * this.h * 0.8;
        const a = 0.3 + 0.7 * Math.abs(Math.sin(time * 1.5 + i));
        ctx.fillStyle = `rgba(255,255,230,${a})`;
        ctx.beginPath(); ctx.arc(x, y, 1.4 + (i % 3) * 0.4, 0, TAU); ctx.fill();
      }
      if (this.theme === 'crater' || this.theme === 'starry' || this.theme === 'space') {
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
      ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
      ctx.fillText(String(v.shown).padStart(8, '0'), box.x + box.w - box.h * 0.35, box.y + box.h / 2);
    }
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
      if (v.char) drawCharacter(ctx, v.char, box.x + box.w / 2, box.y + c * 1.6, c * 1.15, v.mood, time);
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
    if (chars[1]) drawCharacter(ctx, chars[1], box.x + box.w / 2, box.y + c * 4.4, c * 2.9, this.views[1].mood, time);
    if (chars[0]) drawCharacter(ctx, chars[0], box.x + box.w / 2, box.y + c * 7.1, c * 1.9, this.views[0].mood, time, this.views[0].charExtra || {});
    // 마진 타임
    if (match.frame > 96 * 60 && match.phase === 'play') {
      ctx.font = `${Math.round(c * 0.32)}px ${FONT}`; ctx.fillStyle = '#ff9fb0';
      ctx.fillText(`마진 타임! 방해뿌요 ×${(70 / match.target).toFixed(1)}`, box.x + box.w / 2, box.y + c * 8.4);
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
