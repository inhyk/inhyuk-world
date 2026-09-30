// 터질 때 나오는 효과(상점에서 사는 13가지)와 "N연쇄!" 글자, 화면 흔들림.
import { PALETTE } from './skins.mjs';

const TAU = Math.PI * 2;
const RAINBOW = ['#ff4f64', '#ff9f2e', '#ffd84a', '#3fd972', '#3d8bff', '#9b5cff'];
const rand = (a, b) => a + Math.random() * (b - a);
const pick = list => list[(Math.random() * list.length) | 0];
const MAX_PARTS = 900;

function starPath(ctx, s, points = 5, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + i * Math.PI / points, r = i % 2 ? s * inner : s;
    if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}
function heartPath(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, s * 0.8);
  ctx.bezierCurveTo(-s * 1.3, -s * 0.1, -s * 0.6, -s * 1.05, 0, -s * 0.4);
  ctx.bezierCurveTo(s * 0.6, -s * 1.05, s * 1.3, -s * 0.1, 0, s * 0.8);
}
function sparklePath(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, -s); ctx.quadraticCurveTo(0, 0, s, 0); ctx.quadraticCurveTo(0, 0, 0, s); ctx.quadraticCurveTo(0, 0, -s, 0); ctx.quadraticCurveTo(0, 0, 0, -s);
}

export class Effects {
  constructor() {
    this.parts = [];
    this.texts = [];
    this.rings = [];
    this.bolts = [];
    this.shakeT = 0;
    this.shakePower = 0;
    this.flashT = 0;
    this.flashColor = '#fff';
  }

  clear() { this.parts.length = 0; this.texts.length = 0; this.rings.length = 0; this.bolts.length = 0; this.shakeT = 0; this.flashT = 0; }

  add(p) { if (this.parts.length < MAX_PARTS) this.parts.push({ rot: 0, vr: 0, g: 0, drag: 0.98, life: 40, t: 0, ...p }); }

  // 뿌요 하나가 터질 때
  pop(kind, x, y, color, size, chain = 1) {
    const pal = PALETTE[color] || PALETTE[1];
    const c = pal.base, light = pal.light;
    const boost = Math.min(1.6, 1 + chain * 0.06);
    const s = size;
    switch (kind) {
      case 'star':
        for (let i = 0; i < 5; i++) { const a = rand(0, TAU), v = rand(1.5, 3.5) * s / 40 * boost; this.add({ kind: 'star', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, g: 0.08 * s / 40, size: rand(0.12, 0.2) * s, color: i % 2 ? '#ffe45c' : c, vr: rand(-0.2, 0.2), life: 42 }); }
        break;
      case 'heart':
        for (let i = 0; i < 4; i++) this.add({ kind: 'heart', x: x + rand(-0.3, 0.3) * s, y, vx: rand(-0.5, 0.5), vy: rand(-1.8, -0.9) * s / 40, drag: 0.99, size: rand(0.13, 0.2) * s, color: i % 2 ? '#ff6fa6' : c, wob: rand(0, TAU), life: 55 });
        break;
      case 'bubble':
        for (let i = 0; i < 5; i++) this.add({ kind: 'bubble', x: x + rand(-0.35, 0.35) * s, y: y + rand(-0.2, 0.2) * s, vx: rand(-0.3, 0.3), vy: rand(-1.6, -0.7) * s / 40, drag: 0.995, size: rand(0.1, 0.22) * s, color: light, wob: rand(0, TAU), life: rand(40, 60) });
        break;
      case 'petal':
        for (let i = 0; i < 6; i++) { const a = rand(0, TAU); this.add({ kind: 'petal', x, y, vx: Math.cos(a) * rand(1, 2.5) * s / 40, vy: Math.sin(a) * 2 * s / 40 - 1.5, g: 0.04 * s / 40, drag: 0.96, size: rand(0.1, 0.16) * s, color: i % 2 ? '#ffc7de' : light, vr: rand(-0.15, 0.15), rot: rand(0, TAU), life: 65 }); }
        break;
      case 'note':
        for (let i = 0; i < 3; i++) this.add({ kind: 'note', x: x + rand(-0.3, 0.3) * s, y, vx: rand(-0.6, 0.6), vy: rand(-1.6, -1) * s / 40, drag: 0.985, size: rand(0.22, 0.3) * s, color: pick([c, '#ffffff', '#ffe45c']), wob: rand(0, TAU), glyph: pick(['♪', '♫', '♬']), life: 55 });
        break;
      case 'snow':
        for (let i = 0; i < 5; i++) { const a = rand(0, TAU); this.add({ kind: 'snow', x, y, vx: Math.cos(a) * rand(0.8, 2) * s / 40, vy: Math.sin(a) * 1.5 * s / 40 - 0.6, g: 0.03 * s / 40, drag: 0.97, size: rand(0.12, 0.2) * s, color: i % 2 ? '#e8f6ff' : light, vr: rand(-0.06, 0.06), life: 70 }); }
        break;
      case 'pixel':
        for (let i = 0; i < 10; i++) { const a = rand(0, TAU), v = rand(1, 4) * s / 40 * boost; this.add({ kind: 'pixel', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2 * s / 40, g: 0.22 * s / 40, drag: 0.99, size: rand(0.08, 0.16) * s, color: pick([c, light, pal.dark]), life: 45, floor: y + s * 1.8 }); }
        break;
      case 'firework': {
        const n = 14;
        for (let i = 0; i < n; i++) { const a = i * TAU / n + rand(-0.1, 0.1), v = rand(2.5, 4.5) * s / 40 * boost; this.add({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.07 * s / 40, drag: 0.95, size: rand(0.05, 0.08) * s, color: pick(RAINBOW.concat([c, c])), life: rand(35, 50), trail: [] }); }
        break;
      }
      case 'lightning':
        this.bolts.push({ x, y, s, color: light, life: 16, t: 0, seed: Math.random() * 1000 });
        for (let i = 0; i < 4; i++) { const a = rand(0, TAU); this.add({ kind: 'sparkle', x, y, vx: Math.cos(a) * 3 * s / 40, vy: Math.sin(a) * 3 * s / 40, size: rand(0.1, 0.16) * s, color: '#fffbd6', life: 22 }); }
        break;
      case 'rainbow':
        this.rings.push({ x, y, r: s * 0.2, grow: s * 0.05 * boost, life: 34, t: 0, rainbow: true, width: s * 0.12 });
        for (let i = 0; i < 4; i++) { const a = rand(0, TAU); this.add({ kind: 'sparkle', x, y, vx: Math.cos(a) * 2 * s / 40, vy: Math.sin(a) * 2 * s / 40, size: rand(0.1, 0.15) * s, color: pick(RAINBOW), life: 34 }); }
        break;
      case 'blackhole':
        for (let i = 0; i < 9; i++) { const a = rand(0, TAU), d = rand(0.8, 1.6) * s; this.add({ kind: 'orbit', cx: x, cy: y, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, ang: a, dist: d, size: rand(0.06, 0.11) * s, color: pick([c, '#c9a8ff', '#ffffff']), life: 30 }); }
        this.rings.push({ x, y, r: s * 0.9, grow: -s * 0.03, life: 26, t: 0, color: '#2a1540', width: s * 0.1, delay: 0 });
        this.rings.push({ x, y, r: s * 0.1, grow: s * 0.09 * boost, life: 20, t: 0, color: '#d9b8ff', width: s * 0.08, delay: 26 });
        break;
      case 'comet':
        for (let i = 0; i < 3; i++) { const a = rand(-2.6, -2.1), v = rand(3, 5) * s / 40; this.add({ kind: 'comet', x: x + rand(-0.3, 0.3) * s, y: y + rand(-0.3, 0.3) * s, vx: -Math.cos(a) * v, vy: Math.sin(a) * v, drag: 0.985, size: rand(0.1, 0.16) * s, color: pick(['#bff4ff', '#7ad7ff', '#ffffff']), life: 38, trail: [] }); }
        break;
      default: // sparkle
        for (let i = 0; i < 6; i++) { const a = rand(0, TAU), v = rand(1.2, 3) * s / 40 * boost; this.add({ kind: 'sparkle', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: rand(0.1, 0.2) * s, color: i % 3 ? light : '#ffffff', life: rand(24, 36) }); }
        this.rings.push({ x, y, r: s * 0.3, grow: s * 0.035, life: 18, t: 0, color: 'rgba(255,255,255,.9)', width: s * 0.06 });
    }
  }

  // 방해뿌요가 사라질 때
  crumble(x, y, size) {
    for (let i = 0; i < 4; i++) { const a = rand(0, TAU), v = rand(1, 2.5) * size / 40; this.add({ kind: 'pixel', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, g: 0.2 * size / 40, size: rand(0.08, 0.14) * size, color: pick(['#dfe6f5', '#aeb8cf']), life: 30 }); }
  }

  // "3연쇄!" 같은 글자
  text(x, y, text, size, style = {}) {
    this.texts.push({ x, y, text, size, t: 0, life: style.life ?? 64, color: style.color, rainbow: style.rainbow, rise: style.rise ?? 0.35, big: style.big });
  }

  shake(power, frames = 16) { this.shakePower = Math.max(this.shakePower, power); this.shakeT = Math.max(this.shakeT, frames); }
  flash(color = '#fff', frames = 10) { this.flashColor = color; this.flashT = frames; this.flashMax = frames; }
  offset() {
    if (this.shakeT <= 0) return [0, 0];
    const k = this.shakePower * (this.shakeT / 16);
    return [rand(-k, k), rand(-k, k)];
  }

  update() {
    for (const p of this.parts) {
      p.t++;
      if (p.kind === 'orbit') {
        const k = p.t / p.life;
        p.ang += 0.25;
        p.dist *= 0.9;
        p.x = p.cx + Math.cos(p.ang) * p.dist;
        p.y = p.cy + Math.sin(p.ang) * p.dist;
        p.alpha = 1 - k * 0.3;
        continue;
      }
      if (p.trail) { p.trail.push(p.x, p.y); if (p.trail.length > 12) p.trail.splice(0, 2); }
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.g;
      if (p.wob !== undefined) { p.wob += 0.12; p.x += Math.sin(p.wob) * 0.6; }
      p.x += p.vx; p.y += p.vy;
      if (p.floor && p.y > p.floor) { p.y = p.floor; p.vy *= -0.45; p.vx *= 0.7; }
      p.rot += p.vr;
    }
    this.parts = this.parts.filter(p => p.t < p.life);
    for (const r of this.rings) { if (r.delay > 0) { r.delay--; continue; } r.t++; r.r = Math.max(0, r.r + r.grow); }
    this.rings = this.rings.filter(r => r.t < r.life);
    for (const b of this.bolts) b.t++;
    this.bolts = this.bolts.filter(b => b.t < b.life);
    for (const t of this.texts) t.t++;
    this.texts = this.texts.filter(t => t.t < t.life);
    if (this.shakeT > 0) this.shakeT--;
    else this.shakePower = 0;
    if (this.flashT > 0) this.flashT--;
  }

  draw(ctx) {
    ctx.save();
    for (const r of this.rings) {
      if (r.delay > 0) continue;
      const k = r.t / r.life;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = r.width * (1 - k * 0.6);
      if (r.rainbow) {
        RAINBOW.forEach((col, i) => { ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(r.x, r.y, r.r + i * r.width * 0.55, 0, TAU); ctx.stroke(); });
      } else { ctx.strokeStyle = r.color; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke(); }
    }
    for (const b of this.bolts) {
      ctx.globalAlpha = 1 - b.t / b.life;
      ctx.strokeStyle = '#fffbd6'; ctx.lineWidth = Math.max(1.5, b.s * 0.06);
      ctx.shadowColor = '#fff27a'; ctx.shadowBlur = b.s * 0.3;
      let seed = b.seed + Math.floor(b.t / 3);
      const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      for (let k = 0; k < 3; k++) {
        const a = rnd() * TAU;
        ctx.beginPath(); ctx.moveTo(b.x, b.y);
        let px = b.x, py = b.y;
        for (let i = 1; i <= 4; i++) { const d = b.s * 0.35 * i; px = b.x + Math.cos(a) * d + (rnd() - 0.5) * b.s * 0.4; py = b.y + Math.sin(a) * d + (rnd() - 0.5) * b.s * 0.4; ctx.lineTo(px, py); }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }
    for (const p of this.parts) {
      const k = p.t / p.life;
      const alpha = p.alpha ?? (k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
      ctx.globalAlpha = Math.max(0, alpha);
      if (p.trail && p.trail.length > 2) {
        ctx.strokeStyle = p.color; ctx.lineWidth = p.size * 0.9; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.trail[0], p.trail[1]);
        for (let i = 2; i < p.trail.length; i += 2) ctx.lineTo(p.trail[i], p.trail[i + 1]);
        ctx.lineTo(p.x, p.y);
        ctx.globalAlpha = Math.max(0, alpha * 0.5); ctx.stroke(); ctx.globalAlpha = Math.max(0, alpha);
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      const s = p.size * (p.kind === 'sparkle' ? 1 - k * 0.5 : 1);
      switch (p.kind) {
        case 'star': starPath(ctx, s); ctx.fill(); break;
        case 'heart': heartPath(ctx, s); ctx.fill(); break;
        case 'bubble':
          ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1, s * 0.18); ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(-s * 0.35, -s * 0.35, s * 0.25, 0, TAU); ctx.fill();
          break;
        case 'petal': ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.5, 0, 0, TAU); ctx.fill(); break;
        case 'note':
          ctx.font = `bold ${Math.round(s * 1.6)}px Jua, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = Math.max(1, s * 0.2); ctx.strokeStyle = 'rgba(30,20,60,.6)'; ctx.strokeText(p.glyph, 0, 0); ctx.fillText(p.glyph, 0, 0);
          break;
        case 'snow':
          ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1, s * 0.15); ctx.lineCap = 'round';
          for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.moveTo(s * 0.55, 0); ctx.lineTo(s * 0.8, -s * 0.25); ctx.moveTo(s * 0.55, 0); ctx.lineTo(s * 0.8, s * 0.25); ctx.stroke(); }
          break;
        case 'pixel': ctx.fillRect(-s / 2, -s / 2, s, s); break;
        case 'spark': case 'orbit': case 'comet': ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill(); break;
        default: sparklePath(ctx, s); ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // 글자
    for (const t of this.texts) {
      const k = t.t / t.life;
      const pop = t.t < 8 ? 0.4 + (t.t / 8) * 0.8 : t.t < 14 ? 1.2 - ((t.t - 8) / 6) * 0.2 : 1;
      const alpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      const y = t.y - t.t * t.rise * t.size * 0.04;
      ctx.save();
      ctx.translate(t.x, y);
      ctx.scale(pop, pop);
      ctx.globalAlpha = alpha;
      ctx.font = `${Math.round(t.size)}px Jua, 'Noto Sans KR', sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = t.size * 0.22; ctx.strokeStyle = '#2a1640'; ctx.strokeText(t.text, 0, 0);
      let fill = t.color || '#ffe45c';
      if (t.rainbow) {
        const w = ctx.measureText(t.text).width;
        const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
        RAINBOW.forEach((col, i) => g.addColorStop(((i + t.t * 0.05) % RAINBOW.length) / RAINBOW.length, col));
        fill = g;
      } else if (!t.color) {
        const g = ctx.createLinearGradient(0, -t.size / 2, 0, t.size / 2);
        g.addColorStop(0, '#fff6a8'); g.addColorStop(0.5, '#ffd23f'); g.addColorStop(1, '#ff8a1f');
        fill = g;
      }
      ctx.fillStyle = fill; ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  drawFlash(ctx, w, h) {
    if (this.flashT <= 0) return;
    ctx.save();
    ctx.globalAlpha = (this.flashT / (this.flashMax || 10)) * 0.45;
    ctx.fillStyle = this.flashColor;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}
