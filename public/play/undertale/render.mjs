// 언더테일 팬 게임 · Canvas 2D 렌더러. 논리 해상도 640×480.
import { TILE, COLS, ROWS, activeActors, interactionTarget, ROOM_NAMES } from './world.mjs';
import { HUMAN, OVERWORLD, BATTLE, BATTLE_SCALE, bake, CHARA } from './sprites.mjs';
import { SOUL_RADIUS, attackStat, defenseStat, spareReady, flavor, alive } from './core.mjs';
import { ITEMS } from './data.mjs';
import { detailsFor, DETAILS } from './details.mjs';
import * as Scene from './scenery.mjs';
let reducedMotion = false;
export function setReducedMotion(value) { reducedMotion = value; }

export const W = 640, H = 480;
export const FONT = '"Galmuri11", "DungGeunMo", "Neo둥근모", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
export const MONO = '"Galmuri11", "DungGeunMo", "Courier New", monospace';
const font = (size, bold = false) => `${bold ? 'bold ' : ''}${size}px ${FONT}`;

// ---------- 공용 ----------
export function clear(ctx, color = '#000') { ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); }
export function text(ctx, str, x, y, { size = 16, color = '#fff', align = 'left', bold = false, shadow = false } = {}) {
  ctx.font = font(size, bold); ctx.textAlign = align; ctx.textBaseline = 'top';
  if (shadow) { ctx.fillStyle = '#000'; ctx.fillText(str, x + 2, y + 2); }
  ctx.fillStyle = color; ctx.fillText(str, x, y);
}
export function wrap(ctx, str, maxWidth, size = 16) {
  ctx.font = font(size); const lines = []; let line = '';
  for (const ch of str) { if (ch === '\n') { lines.push(line); line = ''; continue; } const test = line + ch; if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = ch === ' ' ? '' : ch; } else line = test; }
  lines.push(line); return lines;
}
function heart(ctx, x, y, r, color) {
  const pixels = ['01100110', '11111111', '11111111', '11111111', '01111110', '00111100', '00011000'];
  const unit = r / 4; ctx.fillStyle = color;
  for (let row = 0; row < 7; row++) for (let col = 0; col < 8; col++) if (pixels[row][col] === '1') ctx.fillRect(x + (col - 4) * unit, y + (row - 3) * unit, unit, unit);
}
function fittedText(ctx, str, x, y, maxWidth, opts = {}) {
  let size = opts.size || 16;
  while (size > 9) { ctx.font = font(size, opts.bold); if (ctx.measureText(str).width <= maxWidth) break; size--; }
  text(ctx, str, x, y, { ...opts, size });
}
const PORTRAIT_MAP = {
  '플라위': 'flowey',
  '토리엘': 'toriel',
  '샌즈': 'sans',
  '파피루스': 'papyrus',
  '언다인': 'undyne',
  '몬스터 키드': 'kid',
  '토끼 아주머니': 'rabbit',
  '템미': 'temmie',
  '냅스타블룩': 'blook',
  '메아리 꽃': 'echo',
  '프로깃': 'froggit',
  '아스고어': 'asgore',
  '메타톤': 'mettaton',
  '메타톤 EX': 'mettaton',
  '차라': 'chara',
  '아스리엘': 'asriel',
  '아스리엘 드리무르': 'asriel',
};
function resolvePortraitSprite(who) { return PORTRAIT_MAP[who] || null; }
const CHARACTER_STYLE = {
  flowey: { glow: '#ff9cc5', aura: '#ff2f79', accent: '#ffdd73', shell: '#ffd7f2', wing: '#ffe7f5', contour: '#ff9fbe', detail: '#ffe4f1' },
  floweyIntro: { glow: '#ff9cc5', aura: '#ff2f79', accent: '#ffdd73', shell: '#ffd7f2', wing: '#ffe7f5', contour: '#ff9fbe', detail: '#ffe4f1' },
  toriel: { glow: '#ffdca6', aura: '#f7dfb4', accent: '#f7dfb4', shell: '#6a4b3a', halo: '#ffe9b7', contour: '#efd39f', detail: '#d6b58d' },
  sans: { glow: '#cad8f9', aura: '#9ca9d7', accent: '#c9dbff', shell: '#5b6175', eye: '#ffffff', contour: '#93a2c2', detail: '#ece6d5' },
  papyrus: { glow: '#7ad0ff', aura: '#f4c57a', accent: '#f4c57a', shell: '#5ca7dd', contour: '#7fc4ff', detail: '#ffefcf' },
  undyne: { glow: '#79f5bf', aura: '#7adf8d', accent: '#66e89b', shell: '#5b9fc3', contour: '#3a80a3', detail: '#b7f4d0' },
  asgore: { glow: '#e4b6ec', aura: '#3d1853', accent: '#f2a5d3', shell: '#ffe5f8', rune: '#d58ce0', contour: '#f1d0fa', detail: '#a35ca0' },
  mettaton: { glow: '#ffc3de', aura: '#8ea9ff', accent: '#8ea9ff', shell: '#ff8e4a', lens: '#ffe1ca', contour: '#ffe7cf', detail: '#f3cbff' },
  neo: { glow: '#9bd7ff', aura: '#f9d25b', accent: '#ff9ec0', shell: '#4ec8ff', lens: '#ffe1ca', contour: '#ffe7cf', detail: '#f3fbff' },
  asriel: { glow: '#f2f7ff', aura: '#2f8bff', accent: '#ffffff', shell: '#c7d5ff', star: '#ffd1f6', contour: '#eff7ff', detail: '#d8dfff' },
  undying: { glow: '#ff9ca1', aura: '#ff7f70', accent: '#ff7f70', shell: '#ffa28f', contour: '#ffb39f', detail: '#ffe0dc' },
  kid: { glow: '#f7e9cb', aura: '#f3d6a4', accent: '#f3d6a4', shell: '#8f7f66', contour: '#edd5a9', detail: '#fffae5' },
  blook: { glow: '#d7bdff', aura: '#e9dcff', accent: '#f4e6ff', shell: '#b3a0d4', contour: '#e0d0ff', detail: '#f9f2ff' },
};
function accentColorById(id) {
  return CHARACTER_STYLE[id]?.accent;
}
function rgba(hex, alpha) {
  if (!hex) return `rgba(255,255,255,${alpha})`;
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16), g = parseInt(full.slice(2, 4), 16), b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
function drawMicroDust(ctx, x, y, w, h, seed, color, alpha = .15) {
  const unit = Math.max(1, Math.round(Math.min(w, h) * 0.024));
  for (let i = 0; i < 5; i++) {
    const px = x + Math.round(Scene.hash(i, seed) * (w - unit));
    const py = y + Math.round(Scene.hash(i, seed + 1) * (h - unit));
    if (Scene.hash(i, seed + 2) > .6) {
      ctx.fillStyle = rgba(color, alpha * (0.5 + Scene.hash(i, seed + 3) * .7));
      ctx.fillRect(px, py, unit, unit);
    }
  }
}
function drawFineContours(ctx, x, y, w, h, color, strength = 0.18) {
  ctx.globalAlpha = strength;
  ctx.strokeStyle = rgba(color, strength);
  ctx.lineWidth = Math.max(1, Math.round(Math.min(w, h) * 0.012));
  const bx = Math.round(Math.min(w, h) * 0.06);
  const by = Math.round(Math.min(w, h) * 0.06);
  const lx = Math.round(x + bx / 2);
  const ly = Math.round(y + by / 2);
  const rw = Math.round(w - bx);
  const rh = Math.round(h - by);
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.lineTo(lx + rw, ly);
  ctx.lineTo(lx + rw, ly + rh);
  ctx.lineTo(lx, ly + rh);
  ctx.closePath();
  ctx.stroke();
  ctx.globalAlpha = 1;
}
function drawTwinHalo(ctx, x, y, r, color, t, kind) {
  const inner = Math.max(2, Math.round(r * 0.16));
  const outer = Math.max(inner + 2, Math.round(r * (kind === 'battle' ? 1.5 : 1.05)));
  const halo = ctx.createRadialGradient(x, y, inner, x, y, outer);
  halo.addColorStop(0, rgba(color, 0.6));
  halo.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, outer, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.22 + Math.sin(t * 3) * 0.06;
  ctx.fillStyle = rgba('#ffffff', 0.18);
  ctx.fillRect(x - outer, y - 1, outer * 2, 2);
  ctx.fillRect(x - 1, y - outer, 2, outer * 2);
  ctx.globalAlpha = 1;
}
function drawCharacterAccent(ctx, id, x, y, w, h, t, kind = 'world') {
  const style = CHARACTER_STYLE[id];
  if (!style) return;
  const cx = x + w / 2;
  const headY = kind === 'world' ? Math.max(3, Math.min(h * 0.24, 18)) : Math.max(3, Math.min(h * 0.20, 22));
  const blink = Math.sin(t * 11) > 0.85 ? 1 : 0;
  const pulse = reducedMotion ? 0.12 : 0.12 + Math.sin(t * 4 + (kind === 'battle' ? 0.8 : 0)) * 0.05;
  const radius = Math.max(w, h) * (kind === 'battle' ? 1.2 : 1.0);
  const aura = ctx.createRadialGradient(cx, y + h * 0.76, Math.max(1, Math.min(w, h) * 0.2), cx, y + h * 0.76, radius);
  aura.addColorStop(0, rgba(style.aura || style.glow || style.accent, pulse * .45));
  aura.addColorStop(1, rgba(style.aura || style.glow || style.accent, 0));
  ctx.globalAlpha = 1;
  ctx.fillStyle = aura;
  ctx.fillRect(x - radius * .4, y + h * 0.25, w + radius * .8, h * 1.06);
  const contour = style.contour || style.glow;
  const shell = Math.max(1, Math.round(Math.min(w, h) * (kind === 'battle' ? .033 : .028)));
  ctx.globalAlpha = kind === 'battle' ? 0.14 : 0.1;
  ctx.strokeStyle = rgba(style.shell || style.glow || style.accent, 1);
  ctx.lineWidth = shell;
  ctx.strokeRect(Math.round(x + .5), Math.round(y + .5), Math.round(w - 1), Math.round(h - 1));
  drawFineContours(ctx, x, y, w, h, contour, 0.13);
  drawMicroDust(ctx, x, y, w, h, Math.floor(t * 24), contour, kind === 'portrait' ? .18 : .12);
  ctx.globalAlpha = 1;
  if (id === 'flowey' || id === 'floweyIntro') {
    const halo = 0.48 + Math.sin(t * 2.2) * 0.05;
    const glow = 0.55 + Math.sin(t * 3) * 0.08;
    drawTwinHalo(ctx, cx, y + headY * 0.2, Math.min(w, h) * 0.28, style.aura || style.glow, t, kind);
    ctx.globalAlpha = Math.max(0.14, glow * halo);
    ctx.fillStyle = '#ff5a9f';
    const petal = Math.max(1, Math.round(Math.min(w, h) * 0.09));
    ctx.fillRect(Math.round(cx - w * 0.28), Math.round(y + headY * 0.17), petal, petal);
    ctx.fillRect(Math.round(cx + w * 0.17), Math.round(y + headY * 0.2), petal, petal);
    for (let i = 0; i < 3; i++) {
      const px = Math.round(cx + (i - 1) * (w * 0.12) + Math.sin(t * 2 + i * 2) * (w * 0.02));
      const py = Math.round(y + h * 0.11 + Math.cos(t * 2 + i * 2) * (h * 0.01));
      const p2 = Math.max(1, Math.round(w * 0.018));
      ctx.fillRect(px + Math.round(Math.cos(t + i) * (w * 0.015)), py, p2, Math.max(1, Math.round(h * 0.03)));
    }
    const petals = 6;
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2 + t * 1.3 * (kind === 'battle' ? 0.8 : 0.5);
      const px = Math.round(cx + Math.cos(a) * w * 0.18 + Math.sin(a * 2 + t) * 2);
      const py = Math.round(y + h * 0.34 + Math.sin(a * 1.6) * h * 0.12);
      ctx.fillStyle = rgba(style.wing || style.accent, 0.35 + i * 0.01);
      ctx.fillRect(px, py, Math.max(1, Math.round(w * 0.015)), Math.max(1, Math.round(h * 0.015)));
    }
    ctx.globalAlpha = 1;
  }
  if (id === 'toriel' || id === 'asriel') {
    ctx.globalAlpha = 0.42;
    drawTwinHalo(ctx, cx, y + headY * 0.5, Math.min(w, h) * 0.26, style.halo || style.glow, t, kind);
    const brow = Math.max(1, Math.round(Math.min(w, h) * 0.032));
    const seam = style.detail || style.contour || style.accent;
    for (let i = 0; i < 2; i++) {
      const oy = Math.round(y + h * (0.48 + i * 0.22));
      ctx.fillStyle = rgba(seam, 0.24);
      ctx.fillRect(Math.round(cx - w * 0.36), oy, Math.round(w * 0.11), brow);
      ctx.fillRect(Math.round(cx + w * 0.25), oy, Math.round(w * 0.11), brow);
    }
    ctx.fillStyle = '#ffffffcc';
    ctx.fillRect(Math.round(cx - w * 0.26), Math.round(y + headY * 0.5), Math.max(1, Math.round(w * 0.05)), Math.max(1, Math.round(h * 0.05)));
    ctx.fillRect(Math.round(cx + w * 0.21), Math.round(y + headY * 0.5), Math.max(1, Math.round(w * 0.05)), Math.max(1, Math.round(h * 0.05)));
    const glow = accentColorById(id);
    ctx.fillStyle = glow;
    ctx.fillRect(Math.round(cx - w * 0.18), Math.round(y + headY * 0.62), Math.max(1, Math.round(w * 0.36)), Math.max(1, Math.round(h * 0.04)));
    const mouth = Math.max(1, Math.round(Math.min(w, h) * 0.028));
    if (!blink) {
      ctx.fillStyle = rgba(style.contour || glow, 0.5);
      ctx.fillRect(Math.round(cx - w * 0.06), Math.round(y + headY * 0.9), Math.round(w * 0.12), mouth);
    }
    if (id === 'asriel') {
      const p = Math.max(1, Math.round(Math.min(w, h) * 0.05));
      ctx.fillRect(Math.round(cx - p), Math.round(y + headY * 0.08), p, p);
      ctx.fillRect(Math.round(cx + p), Math.round(y + headY * 0.08), p, p);
      for (let i = 0; i < 5; i++) {
        const ax = Math.round(cx + Math.sin((i * .9) + t) * w * 0.16);
        const ay = Math.round(y + headY * 0.14 + Math.cos((i * 1.1) + t) * h * 0.05);
        ctx.fillStyle = rgba(style.star || '#ffd6ff', 0.42);
        Scene.star(ctx, ax, ay, Math.max(1, Math.round(Math.min(w, h) * 0.03)), style.star || '#f8ecff');
      }
      for (let i = 0; i < 3; i++) {
        const bx = Math.round(cx + Math.sin(i * 1.2 + t * 1.4) * w * 0.21);
        const by = Math.round(y + h * (0.58 + (i % 2) * 0.08));
        drawTwinHalo(ctx, bx, by, Math.min(w, h) * 0.07, style.star || '#d2dfff', t, kind);
      }
    }
    ctx.globalAlpha = 1;
  }
  if (id === 'sans') {
    const gray = '#f0e9d2';
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = gray;
    const bw = Math.max(1, Math.round(w * 0.07));
    const sh = Math.max(1, Math.round(h * 0.08));
    ctx.fillRect(Math.round(cx - w * 0.28), Math.round(y + h * 0.20), bw, sh);
    ctx.fillRect(Math.round(cx + w * 0.21), Math.round(y + h * 0.20), bw, sh);
    ctx.fillStyle = style.contour || '#d8e0ef';
    ctx.fillRect(Math.round(cx - w * 0.11), Math.round(y + h * 0.34), Math.max(1, Math.round(w * 0.025)), Math.max(1, Math.round(h * 0.11)));
    ctx.fillRect(Math.round(cx + w * 0.085), Math.round(y + h * 0.34), Math.max(1, Math.round(w * 0.025)), Math.max(1, Math.round(h * 0.11)));
    if (blink) {
      ctx.fillRect(Math.round(cx - w * 0.28), Math.round(y + h * 0.21), bw, Math.max(1, Math.round(h * 0.035)));
      ctx.fillRect(Math.round(cx + w * 0.21), Math.round(y + h * 0.21), bw, Math.max(1, Math.round(h * 0.035)));
      ctx.fillStyle = rgba(style.eye || '#ffffff', 0.7);
      ctx.fillRect(Math.round(cx + w * 0.21), Math.round(y + h * 0.29), Math.max(1, Math.round(w * 0.035)), Math.max(1, Math.round(h * 0.025)));
      ctx.fillRect(Math.round(cx - w * 0.28), Math.round(y + h * 0.29), Math.max(1, Math.round(w * 0.035)), Math.max(1, Math.round(h * 0.025)));
    } else {
      const eyelid = Math.max(1, Math.round(w * 0.032));
      ctx.fillStyle = rgba(style.eye || '#ffffff', 0.86);
      ctx.fillRect(Math.round(cx - w * 0.29), Math.round(y + h * 0.19), Math.max(1, Math.round(w * 0.05)), eyelid);
      ctx.fillRect(Math.round(cx + w * 0.23), Math.round(y + h * 0.19), Math.max(1, Math.round(w * 0.05)), eyelid);
    }
    const rib = Math.max(1, Math.round(Math.min(w, h) * 0.03));
    for (let i = 0; i < 3; i++) {
      const py = Math.round(y + h * (0.63 + i * 0.09));
      ctx.fillStyle = rgba(style.detail || style.accent, 0.2);
      ctx.fillRect(Math.round(x + w * 0.3), py, Math.max(1, Math.round(w * 0.4)), rib);
    }
    ctx.globalAlpha = 1;
  }
  if (id === 'papyrus') {
    const glow = 0.45 + Math.sin(t * 2) * 0.07;
    ctx.globalAlpha = Math.max(0.2, glow);
    ctx.strokeStyle = style.accent || '#4ec8ff';
    ctx.lineWidth = Math.max(1, Math.round(Math.min(w, h) * 0.035));
    ctx.strokeRect(Math.round(cx - w * 0.30), Math.round(y + h * 0.14), Math.max(2, Math.round(w * 0.60)), Math.max(2, Math.round(h * 0.15)));
    for (let i = 0; i < 5; i++) {
      const px = Math.round(cx - w * 0.2 + i * w * 0.095);
      const py = Math.round(y + h * (0.36 + Math.sin(t * 3 + i) * 0.02));
      const d = Math.max(1, Math.round(Math.min(w, h) * 0.022));
      ctx.fillStyle = rgba(style.accent, 0.3 + (i % 2) * 0.05);
      ctx.fillRect(px, py, d, d * (1 + (i % 2)));
    }
    if (kind === 'battle') {
      ctx.fillStyle = rgba(style.accent, 0.4);
      ctx.fillRect(Math.round(cx - w * 0.20), Math.round(y + h * 0.48), Math.max(2, Math.round(w * 0.2)), Math.max(1, Math.round(h * 0.028)));
      ctx.fillRect(Math.round(cx - w * 0.15), Math.round(y + h * 0.52), Math.max(2, Math.round(w * 0.3)), Math.max(1, Math.round(h * 0.028)));
    }
    ctx.beginPath();
    ctx.moveTo(Math.round(cx - w * 0.30), Math.round(y + h * 0.22));
    ctx.lineTo(Math.round(cx - w * 0.40), Math.round(y + h * 0.08));
    ctx.lineTo(Math.round(cx - w * 0.28), Math.round(y + h * 0.16));
    ctx.lineTo(Math.round(cx - w * 0.18), Math.round(y + h * 0.22));
    ctx.closePath();
    ctx.fillStyle = rgba(style.contour || style.detail, 0.35);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(Math.round(cx + w * 0.30), Math.round(y + 0.22 * h));
    ctx.lineTo(Math.round(cx + w * 0.40), Math.round(y + h * 0.08));
    ctx.lineTo(Math.round(cx + w * 0.28), Math.round(y + h * 0.16));
    ctx.lineTo(Math.round(cx + w * 0.18), Math.round(y + h * 0.22));
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (id === 'undyne' || id === 'undying') {
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#67f1d7';
    const pole = Math.max(1, Math.round(Math.min(w, h) * 0.04));
    const hx = Math.round(cx + w * 0.32);
    const hy = Math.round(y + h * 0.16);
    ctx.fillRect(hx, hy, pole, Math.round(h * 0.54));
    ctx.fillRect(Math.round(hx + pole), Math.round(hy + h * 0.11), pole, pole);
    for (let i = 0; i < 3; i++) {
      const py = Math.round(y + h * (0.25 + i * 0.16));
      const px = Math.round(x + w * (0.56 + i * 0.05));
      const d = Math.max(1, Math.round(Math.min(w, h) * 0.017));
      ctx.fillStyle = rgba(style.detail || style.accent, 0.4);
      ctx.fillRect(px, py, d, d + 1);
    }
    ctx.globalAlpha = 1;
  }
  if (id === 'asgore') {
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#f2f2f2';
    ctx.lineWidth = Math.max(1, Math.round(Math.min(w, h) * 0.028));
    const tip = Math.round(h * 0.18);
    const ty = Math.round(y + h * 0.42);
    const tx = Math.round(cx + w * 0.02);
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + tip, ty - tip * 0.2);
    ctx.lineTo(tx + tip, ty + tip * 0.2);
    ctx.closePath();
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const by = Math.round(y + h * (0.42 + i * 0.09));
      ctx.fillStyle = rgba(style.detail || '#ffffff', 0.3);
      ctx.fillRect(Math.round(cx - w * 0.22), by, Math.max(2, Math.round(w * 0.11)), Math.max(1, Math.round(h * 0.008)));
    }
    if (style.rune) {
      for (let i = 0; i < 3; i++) {
        const rx = Math.round(cx - w * 0.08 + Math.sin(t + i) * w * 0.06);
        const ry = Math.round(y + h * (0.62 + i * 0.07));
        ctx.fillStyle = rgba(style.rune, 0.26);
        ctx.fillRect(rx, ry, Math.max(1, Math.round(w * 0.026)), Math.max(1, Math.round(w * 0.026)));
      }
    }
    ctx.globalAlpha = 1;
  }
  if (id === 'mettaton' || id === 'neo') {
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#ff8e4a';
    ctx.lineWidth = Math.max(1, Math.round(Math.min(w, h) * 0.03));
    ctx.beginPath();
    ctx.moveTo(x + w * 0.2, y + h * 0.16);
    ctx.lineTo(x + w * 0.8, y + h * 0.16);
    ctx.lineTo(x + w * 0.8, y + h * 0.33);
    ctx.stroke();
    if (kind === 'battle') {
      const glow = reducedMotion ? 0.12 : 0.22 + Math.sin(t * 3 + 1) * 0.07;
      for (let i = 0; i < 3; i++) {
        const bx = Math.round(x + w * (0.24 + i * 0.14));
        const by = Math.round(y + h * (kind === 'battle' ? 0.13 : 0.16));
        Scene.star(ctx, bx, by, Math.max(1, Math.round(Math.min(w, h) * 0.04)), rgba(style.lens || style.accent, glow));
      }
      for (let i = 0; i < 4; i++) {
        const sx = Math.round(x + w * (0.3 + i * 0.12));
        const sy = Math.round(y + h * (kind === 'battle' ? 0.46 : 0.52) + Math.sin(t * 4 + i) * 2);
        ctx.fillStyle = rgba(style.lens || style.detail || style.accent, 0.18);
        ctx.fillRect(sx, sy, Math.max(1, Math.round(w * 0.03)), Math.round(h * 0.01));
      }
    } else {
      for (let i = 0; i < 2; i++) {
        const sx = Math.round(x + w * (0.28 + i * 0.42));
        const sw = Math.max(1, Math.round(w * 0.12));
        ctx.fillStyle = rgba(style.lens || style.detail || style.accent, 0.18);
        ctx.fillRect(sx, Math.round(y + h * 0.52), sw, Math.max(1, Math.round(h * 0.008)));
      }
    }
    for (let i = 0; i < 8; i++) {
      const tx = Math.round(x + w * (0.22 + i * 0.09));
      const ty = Math.round(y + h * 0.18 + (i % 2) * 2);
      if (Math.abs((tx + ty) % 2) > 0.2) {
        ctx.fillStyle = rgba('#ffffff', 0.12 + (i % 3) * 0.02);
        ctx.fillRect(tx, ty, Math.max(1, Math.round(w * 0.01)), Math.max(1, Math.round(h * 0.004 + 1)));
      }
    }
    ctx.globalAlpha = 1;
  }
  if (id === 'kid' || id === 'blook') {
    ctx.globalAlpha = 0.33;
    ctx.fillStyle = accentColorById(id) || '#ffffff';
    const s = Math.max(1, Math.round(Math.min(w, h) * 0.05));
    ctx.fillRect(Math.round(cx - s), Math.round(y + h * 0.10), s, s);
    if (blink) ctx.fillRect(Math.round(cx + s), Math.round(y + h * 0.10), s, s);
    ctx.globalAlpha = 1;
  }
}
function drawPortraitAccent(ctx, who, x, y, w, h, t) {
  const id = resolvePortraitSprite(who);
  if (!id) return;
  drawCharacterAccent(ctx, id, x, y, w, h, t, 'portrait');
}
function drawPortraitFrame(ctx, who, x, y, w, h, t, speaking) {
  const id = resolvePortraitSprite(who);
  const style = id ? CHARACTER_STYLE[id] : null;
  if (!style) return;
  const pulse = speaking ? (Math.sin(t * 6) * 0.08 + 0.88) : 0.66;
  ctx.save();
  ctx.globalAlpha = Math.max(0.1, pulse * .5);
  ctx.fillStyle = rgba(style.glow || style.accent, 0.18);
  const bx = Math.max(1, Math.round(Math.min(w, h) * 0.04));
  const band = Math.max(1, Math.round(Math.min(w, h) * 0.018));
  ctx.fillRect(x, y, w, band);
  ctx.fillRect(x, y + h - band, w, band);
  ctx.fillRect(x, y, band, h);
  ctx.fillRect(x + w - band, y, band, h);
  ctx.strokeStyle = rgba(style.accent, 0.86);
  ctx.lineWidth = bx;
  ctx.strokeRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  if (speaking) {
    const cx = Math.round(x + w / 2);
    const cy = Math.round(y + h / 2);
    const d = Math.max(band, 2);
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = rgba(style.shell || style.accent, 0.18);
    ctx.fillRect(cx - d * 2, y - 1, d * 4, h + 2);
    ctx.fillRect(x - 1, cy - d * 2, w + 2, d * 4);
  }
  ctx.restore();
}
export function drawHeart(ctx, x, y, r, color) { heart(ctx, x, y, r, color); }

// ---------- 오버월드 ----------
export function drawOverworld(ctx, w, t, opts = {}) {
  if (reducedMotion) t = 0;
  const room = w.room, flags = w.player.flags;
  clear(ctx, '#080b14');
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) Scene.drawTile(ctx, room, x, y, t, flags);
  Scene.drawRoomFloor(ctx, w, t);
  const list = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (room.tiles[y][x] === 'o') list.push({ y: y * TILE + 24, draw: () => Scene.drawDecoration(ctx, room, x * TILE, y * TILE, t) });
    if (room.tiles[y][x] === 'S') {
      const px = x * TILE + 16, py = y * TILE + 13;
      Scene.glow(ctx, px, py, 40, '#ffe58d', .23 + Math.sin(t * 3) * .04);
      Scene.shadow(ctx, px, py + 14, 11, 3);
      Scene.star(ctx, px, py + Math.sin(t * 3) * 2, 9 + Math.sin(t * 4) * 2);
      for (let i = 0; i < 3; i++) Scene.star(ctx, px + Math.sin(t + i * 2) * 19, py + Math.cos(t + i * 2) * 13, 1);
    }
  }
  for (const item of detailsFor(room)) list.push({ y: item.y * TILE + 24, draw: () => Scene.drawProp(ctx, item, t, !!w.player.journal?.inspected[item.id]) });
  for (const a of activeActors(w)) list.push({ y: a.py + 16, draw: () => drawActor(ctx, a, t) });
  list.push({ y: w.y + 16, draw: () => drawPlayer(ctx, w, t, opts.chara) });
  list.sort((a, b) => a.y - b.y).forEach(o => o.draw());
  if (room.lasers && !flags[room.id + '_switch']) {
    ctx.fillStyle = '#ff565633'; ctx.fillRect(8 * TILE + 6, 3 * TILE, 20, 7 * TILE);
    ctx.fillStyle = '#ff9999'; ctx.fillRect(8 * TILE + 14, 3 * TILE, 3, 7 * TILE);
  }
  Scene.drawAtmosphere(ctx, w, t, reducedMotion);
  if (!opts.quiet) {
    const target = interactionTarget(w);
    if (target) {
      const label = 'Z  ' + target.label; ctx.font = font(12);
      const width = ctx.measureText(label).width + 20, x = Math.max(8, Math.min(632 - width, w.x - width / 2)), y = Math.max(8, w.y - 62);
      ctx.fillStyle = '#0b0c16ed'; ctx.fillRect(x, y, width, 25); ctx.strokeStyle = '#d7c293'; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, width - 1, 24);
      text(ctx, label, x + width / 2, y + 6, { size: 12, align: 'center', color: '#f7e4b2' });
    }
    if (w.roomTime < 3.8 && !w.request && !w.script) {
      ctx.save(); ctx.globalAlpha = Math.min(1, w.roomTime * 2, (3.8 - w.roomTime) * 1.5);
      const title = ROOM_NAMES[room.id];
      text(ctx, title, 28, 407, { size: 18, bold: true, color: '#eee2cb', shadow: true });
      ctx.fillStyle = '#c5ac79'; ctx.fillRect(28, 433, 26, 1);
      text(ctx, { ruins: '오래된 돌 사이에도, 온기가 남아 있다.', snowdin: '당신 뒤로 작은 발자국이 이어진다.', waterfall: '별을 닮은 빛이 물 위에 머문다.', hotland: '뜨거운 바람 너머로 누군가의 일상이 흐른다.', castle: '여기까지 온 당신의 발걸음을 기억한다.' }[room.area], 64, 428, { size: 11, color: '#b6acb6', shadow: true });
      ctx.restore();
    }
    if (w.notice) {
      ctx.save(); ctx.globalAlpha = Math.min(1, w.notice.t * 5, 4 - w.notice.t);
      ctx.fillStyle = '#0c0b16ef'; ctx.fillRect(171, 22, 298, 51); ctx.fillStyle = '#ae9361'; ctx.fillRect(171, 22, 2, 51);
      text(ctx, '작은 기억을 수첩에 남겼다', 320, 30, { size: 12, color: '#e8cc8c', align: 'center' });
      text(ctx, w.notice.title + '  ·  C → 수첩', 320, 51, { size: 11, color: '#b7adb9', align: 'center' }); ctx.restore();
    }
  }
  if (w.transition > 0) { ctx.fillStyle = 'rgba(0,0,0,' + Math.min(1, w.transition * 2.5) + ')'; ctx.fillRect(0, 0, W, H); }
}
function drawActor(ctx, a, t) {
  const sp = OVERWORLD[a.sprite]; if (!sp) return;
  const img = bake(sp, 2), floating = a.sprite === 'blook' || a.sprite === 'echo';
  const bob = reducedMotion ? 0 : floating ? Math.sin(t * 2) * 3 : a.target ? Math.sin((a.walk || 0) * 13) * 1.5 : 0;
  Scene.shadow(ctx, a.px, a.py + 14, Math.min(18, img.width * .35), floating ? 3 : 4);
  const dx = Math.round(a.px - img.width / 2);
  const dy = Math.round(a.py + 16 - img.height + bob);
  ctx.drawImage(img, dx, dy);
  drawCharacterAccent(ctx, a.sprite, dx, dy, img.width, img.height, t, 'world');
}
function drawPlayer(ctx, w, t, chara = false) {
  const frames = chara ? [CHARA] : HUMAN[w.dir], f = frames[w.moving ? w.frame % frames.length : 0];
  const img = bake(f, 2); Scene.shadow(ctx, w.x, w.y + 14, 11, 3);
  ctx.drawImage(img, Math.round(w.x - img.width / 2), Math.round(w.y + 16 - img.height - (w.moving && w.frame % 2 ? 1 : 0)));
}

// ---------- 대화 상자 ----------
export function drawTextbox(ctx, box, t, opts = {}) {
  const x = 32, y = opts.top ? 20 : 310, bw = 576, bh = 150;
  ctx.fillStyle = '#00000055'; ctx.fillRect(x + 6, y + 8, bw, bh);
  ctx.fillStyle = '#060609'; ctx.fillRect(x, y, bw, bh); ctx.lineWidth = 3; ctx.strokeStyle = '#f3f0e8'; ctx.strokeRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
  ctx.strokeStyle = '#302b38'; ctx.lineWidth = 1; ctx.strokeRect(x + 7.5, y + 7.5, bw - 15, bh - 15);
  const full = box.lines[box.index] || '', speaking = box.shown < full.length;
  const portraitId = resolvePortraitSprite(box.who);
  const sp = portraitId ? OVERWORLD[portraitId] : null, portrait = sp ? bake(sp, 2) : null;
  let tx = x + 26, ty = y + 21, width = bw - 52;
  if (portrait) {
    const headHeight = Math.min(portrait.height, Math.ceil(portrait.width * .95)), scale = Math.min(2.6, 78 / portrait.width, 84 / headHeight);
    const pw = Math.round(portrait.width * scale), ph = Math.round(headHeight * scale);
    ctx.save(); ctx.globalAlpha = speaking ? 1 : .8;
    const px = x + 55 - pw / 2;
    const py = y + 48 + (speaking && !reducedMotion ? Math.floor(t * 8) % 2 : 0);
    drawPortraitFrame(ctx, box.who, px, py, pw, ph, t, speaking);
    ctx.drawImage(portrait, 0, 0, portrait.width, headHeight, px, py, pw, ph);
    drawPortraitAccent(ctx, box.who, px, py, pw, ph, t);
    ctx.restore();
    ctx.fillStyle = '#2a2631'; ctx.fillRect(x + 100, y + 20, 1, bh - 40);
    tx = x + 119; width = bw - 148;
  }
  if (box.who) { text(ctx, box.who, tx, ty, { size: 13, color: '#d9c38e' }); ty += 25; }
  // Wrap the complete line first: typing never makes words jump between rows.
  let size = 17, lineHeight = 24;
  const maxLines = box.choice ? (box.who ? 2 : 3) : box.who ? 3 : 4;
  while (size > 12 && wrap(ctx, full, width, size).length > maxLines) size--;
  lineHeight = size + 7;
  const lines = wrap(ctx, full, width, size); let remaining = Math.floor(box.shown);
  lines.forEach((line, i) => { const shown = line.slice(0, Math.max(0, remaining)); remaining -= line.length; if (i < maxLines) text(ctx, shown, tx, ty + i * lineHeight, { size }); });
  if (!speaking && !box.choice) {
    text(ctx, (box.index + 1) + ' / ' + box.lines.length, x + bw - 59, y + bh - 23, { size: 9, color: '#817786', align: 'right' });
    ctx.fillStyle = '#e1c786'; const bx = x + bw - 33, by = y + bh - 23 + (reducedMotion ? 0 : Math.sin(t * 5) * 2);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + 9, by); ctx.lineTo(bx + 4, by + 5); ctx.fill();
  }
  if (box.choice && !speaking) box.choice.options.forEach((o, i) => { const ox = x + 68 + i * 260, oy = y + bh - 38; if (box.choice.index === i) heart(ctx, ox - 18, oy + 9, 7, '#ff3c52'); text(ctx, o, ox, oy, { size: 17, color: box.choice.index === i ? '#ffe096' : '#ddd8e1' }); });
}

// ---------- 전투 ----------
const BUTTONS = [{ id: 'fight', label: '공격', en: 'FIGHT' }, { id: 'act', label: '행동', en: 'ACT' }, { id: 'item', label: '아이템', en: 'ITEM' }, { id: 'mercy', label: '자비', en: 'MERCY' }];
export function drawBattle(ctx, b, t) {
  t = reducedMotion ? 0 : b.time;
  clear(ctx, '#000');
  drawBattleBackdrop(ctx, b);
  const p = b.player;
  // 적
  const list = b.enemies.filter(e => !e.dead || e.deathT < 1); const n = Math.max(1, list.length);
  list.forEach((e, i) => {
    const sp = BATTLE[e.id]; if (!sp) return; const scale = BATTLE_SCALE[e.id] || 4; const img = bake(sp, scale);
    const cx = W / 2 + (i - (n - 1) / 2) * 200, bob = e.spared || e.fled ? 0 : Math.sin(t * 2 + i) * 2;
    const boxTop = b.box.y - b.box.h / 2; const baseY = Math.min(230, boxTop - 8) - img.height; const shake = !reducedMotion && b.lastDamage && b.lastDamage.enemy === e && b.lastDamage.t < .5 ? Math.sin(b.lastDamage.t * 60) * 6 : 0;
    ctx.save();
    if (e.spared || e.fled) ctx.globalAlpha = Math.max(0, 1 - (e.exitT || 0) / 1.1);
    if (e.id === 'sans' && b.attack && b.attack.name === 'nothing') ctx.globalAlpha = .8;
    const spriteX = Math.round(cx - img.width / 2 + shake + (e.fled ? (e.exitT || 0) * 70 : 0)), spriteY = Math.round(baseY + bob);
    if (e.dead) {
      const progress = Math.min(1, e.deathT || 0);
      for (let sy = 0; sy < img.height; sy += 4) {
        ctx.globalAlpha = Math.max(0, 1 - progress);
        if (Scene.hash(sy, i) > progress) ctx.drawImage(img, 0, sy, img.width, Math.min(4, img.height - sy), spriteX + (reducedMotion ? 0 : Math.sin(sy + progress * 8) * progress * 12), spriteY + sy - progress * 6, img.width, Math.min(4, img.height - sy));
      }
    } else ctx.drawImage(img, spriteX, spriteY);
    drawCharacterAccent(ctx, e.id === 'floweyIntro' ? 'flowey' : e.id, spriteX, spriteY, img.width, img.height, t, 'battle');
    if (e.spared && e.exitT < 1.1) {
      ctx.globalAlpha = Math.max(0, 1 - e.exitT / 1.1);
      for (let j = 0; j < 9; j++) Scene.star(ctx, cx + (Scene.hash(j, 2) - .5) * 90, spriteY + Scene.hash(j, 4) * img.height - e.exitT * 22, 2, '#ffe293');
    }
    ctx.restore();
    if (b.mode === 'submenu' && (b.submenu.kind === 'target' || b.submenu.kind === 'acttarget')) { const item = b.submenu.items[b.sub]; if (item && item.enemy === e) { ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(cx - img.width / 2 - 8, baseY - 8, img.width + 16, img.height + 16); } }
    // 피격 시 HP 바와 숫자
    if (b.lastDamage && b.lastDamage.enemy === e && b.lastDamage.t < 1.1 && !e.def.immortal) {
      const bw = 100, hx = cx - bw / 2, hy = 236; ctx.fillStyle = '#7a7a7a'; ctx.fillRect(hx, hy, bw, 12); ctx.fillStyle = '#c88061'; ctx.fillRect(hx, hy, bw * ((e.hpBefore || e.hp) + (e.hp - (e.hpBefore || e.hp)) * Math.min(1, b.lastDamage.t * 2)) / e.maxHp, 12); ctx.fillStyle = '#81d798'; ctx.fillRect(hx, hy, bw * Math.max(0, e.hp / e.maxHp), 12);
      const rise = Math.min(1, b.lastDamage.t * 3) * 20; text(ctx, b.lastDamage.label, cx, hy - 30 - rise, { size: 24, color: b.lastDamage.dmg === 0 ? '#9a9a9a' : '#ff3a3a', align: 'center', bold: true });
    }
  });
  // 이펙트: 베기
  for (const fx of b.effects) {
    if (fx.kind === 'slash') { ctx.strokeStyle = `rgba(255,60,60,${1 - fx.t})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(fx.x - 30 + fx.t * 40, fx.y - 50); ctx.lineTo(fx.x + 10 - fx.t * 40, fx.y + 50); ctx.stroke(); }
  }
  // 박스
  const bx = b.box; const l = bx.x - bx.w / 2, tp = bx.y - bx.h / 2;
  ctx.fillStyle = '#000'; ctx.fillRect(l, tp, bx.w, bx.h); ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.strokeRect(l, tp, bx.w, bx.h);
  ctx.save(); ctx.beginPath(); ctx.rect(l - 2, tp - 2, bx.w + 4, bx.h + 4); ctx.clip();
  if (b.mode === 'dodge' || b.mode === 'end' && b.ended === 'dead') { drawBullets(ctx, b, t); drawSoul(ctx, b, t); }
  ctx.restore();
  if (b.mode === 'dodge' && b.attack?.speech) drawSpeech(ctx, b.attack.speech, b.attack.enemy, list, n);
  // 메뉴 텍스트
  if (b.mode === 'menu') { drawBoxText(ctx, b, [flavor(b)], true); }
  else if (b.mode === 'text' || b.mode === 'end') { if (b.text) drawBoxText(ctx, b, [b.text.lines[b.text.index].slice(0, Math.floor(b.text.shown))], false, b.text.shown >= b.text.lines[b.text.index].length); }
  else if (b.mode === 'submenu') drawSubmenu(ctx, b);
  else if (b.mode === 'fightbar' || b.mode === 'strikeanim') drawFightBar(ctx, b);
  // 하단 상태
  const uy = 400; fittedText(ctx, p.name, 36, uy, 105, { size: 16, bold: true }); fittedText(ctx, 'LV ' + p.lv, 154, uy, 84, { size: 15, bold: true }); if (b.hard) text(ctx, 'HARD', 604, 41, { size: 9, align: 'right', color: '#e99286' });
  text(ctx, 'HP', 246, uy + 3, { size: 12, bold: true });
  const hbw = Math.min(104, Math.max(48, p.maxHp * 1.2)), hx = 272; ctx.fillStyle = '#c00'; ctx.fillRect(hx, uy, hbw, 20); ctx.fillStyle = b.karma > 0 ? '#ffe000' : '#ffe000'; ctx.fillRect(hx, uy, hbw * Math.max(0, p.hp / p.maxHp), 20);
  if (b.karma > 0) { ctx.fillStyle = '#b26bff'; ctx.fillRect(hx + hbw * Math.max(0, (p.hp - b.karma) / p.maxHp), uy, hbw * Math.min(b.karma, p.hp) / p.maxHp, 20); text(ctx, 'KR', hx + hbw + 6, uy + 3, { size: 12, color: '#b26bff', bold: true }); }
  fittedText(ctx, String(p.hp).padStart(2, '0') + ' / ' + p.maxHp, hx + hbw + (b.karma > 0 ? 34 : 10), uy + 1, 604 - hx - hbw - (b.karma > 0 ? 34 : 10), { size: 15, bold: true });
  // 버튼
  BUTTONS.forEach((bt, i) => {
    const x = 32 + i * 146, y = 432, w = 138, h = 40; const sel = (b.mode === 'menu' && b.menu === i) || (b.mode !== 'menu' && b.mode !== 'dodge' && b.lastAction === bt.id);
    ctx.lineWidth = 3; ctx.strokeStyle = sel ? '#ffd76a' : '#f08a24'; ctx.fillStyle = sel ? '#27190d' : '#080605'; ctx.fillRect(x, y, w, h); ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    text(ctx, bt.label, x + 40, y + 6, { size: 15, color: sel ? '#ffd76a' : '#f08a24', bold: true }); text(ctx, bt.en, x + 40, y + 24, { size: 9, color: sel ? '#ffd76a' : '#f08a24' });
    if (bt.id === 'mercy' && spareReady(b, b.enemy) && !b.enemy.def.karma) { ctx.fillStyle = '#ffe000'; ctx.fillRect(x + 8, y + 8, 4, 4); }
    if (b.mode === 'menu' && b.menu === i) heart(ctx, x + 22, y + 21, 7, '#ff2a2a');
  });
  if (b.paused) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H); text(ctx, '일시정지', W / 2, H / 2 - 20, { size: 28, align: 'center', bold: true }); text(ctx, 'ESC 또는 X로 계속', W / 2, H / 2 + 20, { size: 14, align: 'center', color: '#aaa' }); }
}
function drawSpeech(ctx, line, enemy, list, n) {
  const i = list.indexOf(enemy); const cx = W / 2 + (i - (n - 1) / 2) * 200 + 90, y = 50; const lines = wrap(ctx, line.replace(/^\*\s?/, ''), 236, 13);
  const bw = 252, bh = 18 + lines.length * 18; const x = Math.min(W - bw - 8, cx);
  ctx.fillStyle = '#fff'; ctx.fillRect(x, y, bw, bh); ctx.beginPath(); ctx.moveTo(x, y + 20); ctx.lineTo(x - 12, y + 26); ctx.lineTo(x, y + 32); ctx.fill();
  lines.forEach((l, k) => text(ctx, l, x + 8, y + 9 + k * 18, { size: 13, color: '#000' }));
}
function drawBoxText(ctx, b, lines, isFlavor, done) {
  const bx = b.box; const l = bx.x - bx.w / 2 + 24, tp = bx.y - bx.h / 2 + 18;
  let y = tp; for (const line of lines) { const parts = wrap(ctx, line, bx.w - 50, 17); parts.forEach(pt => { text(ctx, pt, l, y, { size: 17 }); y += 24; }); }
  if (done && b.mode === 'text') { ctx.fillStyle = '#fff'; const ax = bx.x + bx.w / 2 - 30, ay = bx.y + bx.h / 2 - 22; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + 10, ay); ctx.lineTo(ax + 5, ay + 7); ctx.fill(); }
}
function drawSubmenu(ctx, b) {
  const bx = b.box; const l = bx.x - bx.w / 2 + 24, tp = bx.y - bx.h / 2 + 18; const items = b.submenu.items;
  const cols = b.submenu.kind === 'act' || b.submenu.kind === 'item' ? 2 : 1; const colW = (bx.w - 50) / cols;
  const page = Math.floor(b.sub / 6); const visible = items.slice(page * 6, page * 6 + 6);
  visible.forEach((it, i) => {
    const idx = page * 6 + i; const x = l + 30 + (i % cols) * colW, y = tp + Math.floor(i / cols) * 26;
    let name = it.name, color = '#fff';
    if (it.enemy) { if (spareReady(b, it.enemy)) color = '#ffe000'; name = `${it.name}`; }
    if (b.submenu.kind === 'item') { const def = ITEMS[it.id]; name = `${it.name}${def.heal ? '' : def.weapon !== undefined ? ' (무기)' : ' (방어구)'}`; }
    if (it.done) color = '#888';
    text(ctx, name, x, y, { size: 17, color });
    if (b.sub === idx) heart(ctx, x - 16, y + 9, 7, '#ff2a2a');
    // 적 HP 바 (공격 대상 선택)
    if (it.enemy && b.submenu.kind === 'target' && !it.enemy.def.immortal) { const hx = l + bx.w - 170, hb = 100; ctx.fillStyle = '#7a7a7a'; ctx.fillRect(hx, y + 3, hb, 14); ctx.fillStyle = '#2ee02e'; ctx.fillRect(hx, y + 3, hb * Math.max(0, it.enemy.hp / it.enemy.maxHp), 14); }
  });
  if (items.length > 6) text(ctx, `${page + 1} / ${Math.ceil(items.length / 6)}`, bx.x + bx.w / 2 - 60, bx.y + bx.h / 2 - 24, { size: 13, color: '#aaa' });
}
function drawFightBar(ctx, b) {
  const bx = b.box, l = bx.x - bx.w / 2 + 12, tp = bx.y - bx.h / 2 + 12, bw = bx.w - 24, bh = bx.h - 24;
  ctx.fillStyle = '#1c211b'; ctx.fillRect(l, tp, bw, bh);
  for (let i = 0; i < 22; i++) {
    const d = Math.abs(i - 10.5) / 10.5, height = bh * (1 - d * .75);
    ctx.fillStyle = i === 10 || i === 11 ? '#e2c98b' : i % 2 ? '#6b7554' : '#434b37';
    ctx.fillRect(l + i * bw / 22 + 1, tp + (bh - height) / 2, bw / 22 - 3, height);
  }
  ctx.strokeStyle = '#acaf7d'; ctx.lineWidth = 1; ctx.strokeRect(bx.x - 7, tp, 14, bh);
  const pos = b.bar ? Math.min(1, b.bar.struck ? b.bar.pos : b.bar.t / b.bar.duration) : 0, x = l + pos * bw;
  ctx.fillStyle = '#050606'; ctx.fillRect(x - 4, tp - 4, 8, bh + 8); ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, tp - 4, 3, bh + 8);
  if (b.mode === 'fightbar') text(ctx, '중앙에서 Z', bx.x, tp + bh - 19, { size: 11, color: '#fff0bd', align: 'center', shadow: true });
  else if (b.lastDamage?.dmg > 0 && Math.abs(pos - .5) < .05) text(ctx, '정확한 일격', bx.x, tp + bh - 21, { size: 13, color: '#fff0b0', align: 'center', bold: true, shadow: true });
}
function drawBattleBackdrop(ctx, b) {
  const area = b.area || b.enemy.def.area;
  if (b.enemy.def.boss) {
    ctx.strokeStyle = '#171620'; ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) { const x = 76 + i * 116; ctx.strokeRect(x, 57, 22, 173); ctx.strokeRect(x - 8, 55, 38, 6); }
  }
  if (area === 'waterfall' || b.enemy.id === 'asriel') for (let i = 0; i < 24; i++) {
    ctx.fillStyle = '#5b75924d'; ctx.fillRect(Scene.hash(i, 3) * 600 + 20, Scene.hash(i, 6) * 160 + 50, 1, 1);
  }
  text(ctx, b.enemies.filter(e => !e.dead && !e.spared && !e.fled).map(e => e.def.name).join('  ·  '), 34, 20, { size: 10, color: '#8c8295' });
  text(ctx, 'TURN ' + String(b.turn || 1).padStart(2, '0'), 604, 20, { size: 10, align: 'right', color: '#756d7e' });
  if (b.roundNotice?.clean && !b.enemy.def.scripted) {
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, (1.8 - b.roundNotice.t) * 2));
    text(ctx, '한 번도 다치지 않았다.', 320, 24, { size: 11, align: 'center', color: '#b4d9c2' }); ctx.restore();
  }
}
function drawSoul(ctx, b, t) {
  const s = b.soul;
  if (!reducedMotion) for (const point of b.trail) { ctx.save(); ctx.globalAlpha = Math.max(0, 1 - point.t / .24) * .2; heart(ctx, point.x, point.y, SOUL_RADIUS + 1, point.mode === 'blue' ? '#6b8bff' : point.mode === 'green' ? '#75dfa1' : '#ff5365'); ctx.restore(); }
  if (s.invincible > 0 && Math.floor(t * 20) % 2) return;
  const color = s.mode === 'blue' ? '#3b6bff' : s.mode === 'green' ? '#2fd86a' : '#ff2a2a';
  if (s.mode === 'green') { const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[s.facing]; ctx.strokeStyle = '#2fd86a'; ctx.lineWidth = 4; ctx.beginPath(); const a0 = Math.atan2(d[1], d[0]); ctx.arc(s.x, s.y, 20, a0 - .7, a0 + .7); ctx.stroke(); }
  if (s.mode === 'blue' && s.gravity === 'up') { ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(Math.PI); heart(ctx, 0, 0, SOUL_RADIUS + 3, color); ctx.restore(); return; }
  heart(ctx, s.x, s.y, SOUL_RADIUS + 3, color);
  ctx.fillStyle = '#ffffff77'; ctx.fillRect(s.x - 4, s.y - 4, 2, 2);
}
const BULLET_COLORS = { white: '#fff', blue: '#3b6bff', orange: '#ff8c1a', green: '#2fd86a' };
function drawBullets(ctx, b, t) {
  for (const bl of b.bullets) {
    const col = BULLET_COLORS[bl.color] || '#fff'; ctx.fillStyle = col;
    switch (bl.kind) {
      case 'fire': { const r = bl.r; ctx.fillStyle = '#ff5a1a'; ctx.beginPath(); ctx.arc(bl.x, bl.y, r + Math.sin(t * 30 + bl.x) * 1, 0, 7); ctx.fill(); ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(bl.x, bl.y + 1, r * .5, 0, 7); ctx.fill(); if (bl.color === 'green') { ctx.fillStyle = '#2fd86a'; ctx.beginPath(); ctx.arc(bl.x, bl.y, r * .7, 0, 7); ctx.fill(); } break; }
      case 'bone': { ctx.fillStyle = col; const w = bl.w, h = bl.h; ctx.fillRect(bl.x - w / 2, bl.y - h / 2, w, h); if (h > w) { ctx.fillRect(bl.x - w / 2 - 2, bl.y - h / 2 - 3, w + 4, 5); ctx.fillRect(bl.x - w / 2 - 2, bl.y + h / 2 - 2, w + 4, 5); } else { ctx.fillRect(bl.x - w / 2 - 3, bl.y - h / 2 - 2, 5, h + 4); ctx.fillRect(bl.x + w / 2 - 2, bl.y - h / 2 - 2, 5, h + 4); } break; }
      case 'blaster': {
        const h = bl.orient === 'h'; if (bl.warn) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2; ctx.strokeRect(bl.x - bl.w / 2, bl.y - bl.h / 2, bl.w, bl.h); ctx.setLineDash([]); }
        else { ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fillRect(bl.x - bl.w / 2, bl.y - bl.h / 2, bl.w, bl.h); ctx.fillStyle = 'rgba(180,220,255,.8)'; ctx.fillRect(bl.x - bl.w / 2 + (h ? 0 : 6), bl.y - bl.h / 2 + (h ? 6 : 0), h ? bl.w : bl.w - 12, h ? bl.h - 12 : bl.h); }
        // 블래스터 머리
        const hx = h ? bl.x - bl.w / 2 + 10 : bl.x, hy = h ? bl.y : bl.y - bl.h / 2 + 10; ctx.fillStyle = '#fff'; ctx.fillRect(hx - 14, hy - 12, 28, 24); ctx.fillStyle = '#000'; ctx.fillRect(hx - 9, hy - 6, 6, 6); ctx.fillRect(hx + 3, hy - 6, 6, 6); ctx.fillRect(hx - 6, hy + 5, 12, 3); break; }
      case 'arrow': { const d = { left: 0, right: Math.PI, up: Math.PI / 2, down: -Math.PI / 2 }[bl.from]; ctx.save(); ctx.translate(bl.x, bl.y); ctx.rotate(d); ctx.fillStyle = bl.reverse ? '#ffe000' : '#4ec8ff'; ctx.fillRect(-18, -3, 26, 6); ctx.beginPath(); ctx.moveTo(8, -9); ctx.lineTo(18, 0); ctx.lineTo(8, 9); ctx.fill(); ctx.restore(); break; }
      case 'spear': case 'spearv': case 'laser': { ctx.fillStyle = bl.kind === 'laser' ? '#ffd040' : '#4ec8ff'; ctx.fillRect(bl.x - bl.w / 2, bl.y - bl.h / 2, bl.w, bl.h); ctx.fillStyle = '#fff'; if (bl.kind === 'spearv') ctx.fillRect(bl.x - 2, bl.y + bl.h / 2 - 10, 4, 10); else ctx.fillRect(bl.vx > 0 ? bl.x + bl.w / 2 - 10 : bl.x - bl.w / 2, bl.y - 2, 10, 4); break; }
      case 'trident': { ctx.fillStyle = bl.color === 'blue' ? '#3b6bff' : bl.color === 'orange' ? '#ff8c1a' : '#ff5a1a'; ctx.fillRect(bl.x - bl.w / 2, bl.y - bl.h / 2, bl.w, bl.h); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(bl.x - bl.w / 2, bl.y - 2, bl.w, 4); break; }
      case 'star': { ctx.fillStyle = '#ffe66d'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2 + t * 3, rr = i % 2 ? bl.r * .45 : bl.r; ctx.lineTo(bl.x + Math.cos(a) * rr, bl.y + Math.sin(a) * rr); } ctx.fill(); break; }
      case 'saber': case 'lightning': { if (bl.warn) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 2; ctx.strokeRect(bl.x - bl.w / 2, bl.y - bl.h / 2, bl.w, bl.h); ctx.setLineDash([]); } else { ctx.fillStyle = bl.kind === 'saber' ? '#fff' : '#ffe66d'; ctx.fillRect(bl.x - bl.w / 2, bl.y - bl.h / 2, bl.w, bl.h); } break; }
      case 'bomb': { ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(bl.x, bl.y, bl.r, 0, 7); ctx.fill(); ctx.fillStyle = Math.floor(t * 10) % 2 ? '#ff3a3a' : '#ffd040'; ctx.fillRect(bl.x - 2, bl.y - bl.r - 6, 4, 6); break; }
      case 'spark': { ctx.fillStyle = '#ffb02a'; ctx.beginPath(); ctx.arc(bl.x, bl.y, bl.r, 0, 7); ctx.fill(); break; }
      case 'heart': { heart(ctx, bl.x, bl.y, bl.r, bl.color === 'orange' ? '#ff8c1a' : bl.color === 'blue' ? '#3b6bff' : '#ff7ad0'); break; }
      case 'leg': { ctx.fillStyle = '#ff5aa0'; ctx.fillRect(bl.x - bl.w / 2, bl.y - bl.h / 2, bl.w, bl.h); ctx.fillStyle = '#000'; ctx.fillRect(bl.x - bl.w / 2 + 4, bl.y + bl.h / 2 - 14, bl.w - 8, 10); break; }
      case 'pellet': { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bl.x, bl.y, bl.r, 0, 7); ctx.fill(); ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(bl.x - 2, bl.y - 2, bl.r * .4, 0, 7); ctx.fill(); break; }
      case 'icicle': { ctx.fillStyle = '#cfefff'; ctx.beginPath(); ctx.moveTo(bl.x - bl.w / 2, bl.y - bl.h / 2); ctx.lineTo(bl.x + bl.w / 2, bl.y - bl.h / 2); ctx.lineTo(bl.x, bl.y + bl.h / 2); ctx.fill(); break; }
      case 'plane': { ctx.fillStyle = '#ddd'; ctx.fillRect(bl.x - bl.w / 2, bl.y - bl.h / 2, bl.w, bl.h); ctx.fillRect(bl.x - 4, bl.y - 10, 8, 20); break; }
      case 'goner': { ctx.fillStyle = bl.color === 'green' ? '#2fd86a' : '#fff'; ctx.fillRect(bl.x - 3, bl.y - 3, 6, 6); break; }
      case 'bullet': { ctx.fillStyle = '#fff'; ctx.fillRect(bl.x - bl.w / 2, bl.y - bl.h / 2, bl.w, bl.h); break; }
      case 'frog': { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bl.x, bl.y, bl.r, 0, 7); ctx.fill(); ctx.fillStyle = '#000'; ctx.fillRect(bl.x - 4, bl.y - 3, 2, 2); ctx.fillRect(bl.x + 2, bl.y - 3, 2, 2); break; }
      case 'snowflake': case 'flake': { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3 + t * 2; ctx.beginPath(); ctx.moveTo(bl.x - Math.cos(a) * bl.r, bl.y - Math.sin(a) * bl.r); ctx.lineTo(bl.x + Math.cos(a) * bl.r, bl.y + Math.sin(a) * bl.r); ctx.stroke(); } break; }
      case 'crescent': { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bl.x, bl.y, bl.r, 0, 7); ctx.fill(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(bl.x + 3, bl.y - 2, bl.r * .8, 0, 7); ctx.fill(); break; }
      default: { if (bl.r !== undefined) { ctx.fillStyle = bl.color === 'green' ? '#2fd86a' : col; ctx.beginPath(); ctx.arc(bl.x, bl.y, bl.r, 0, 7); ctx.fill(); } else { ctx.fillStyle = col; ctx.fillRect(bl.x - bl.w / 2, bl.y - bl.h / 2, bl.w, bl.h); } }
    }
  }
  for (const fx of b.effects) {
    if (fx.kind === 'hurt') { text(ctx, `-${fx.dmg}`, fx.x, fx.y - 30 - fx.t * 20, { size: 16, color: '#ff3a3a', align: 'center', bold: true }); }
    if (fx.kind === 'block') { ctx.fillStyle = `rgba(255,224,0,${1 - fx.t})`; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(fx.x, fx.y, 8 + fx.t * 12, 0, 7); ctx.stroke(); }
    if (fx.kind === 'heal') { ctx.fillStyle = `rgba(47,216,106,${1 - fx.t})`; for (let i = 0; i < 4; i++) Scene.star(ctx, fx.x + Math.sin(i * 2) * 15, fx.y - fx.t * 28 + Math.cos(i * 2) * 13, 2, '#83e6a3'); }
  }
}

// ---------- 화면들 ----------
export function drawTitle(ctx, t, state) {
  if (reducedMotion) t = 0;
  Scene.drawTitleScene(ctx, t);
  text(ctx, 'SOMEWHERE BENEATH THE MOUNTAIN', 320, 44, { size: 10, align: 'center', color: '#a69791' });
  text(ctx, 'UNDERTALE', 320, 110, { size: 52, align: 'center', bold: true, shadow: true });
  text(ctx, '작은 선택이, 오래 남는 곳.', 320, 178, { size: 16, align: 'center', color: '#d9c8aa' });
  ctx.fillStyle = '#baa077'; ctx.fillRect(273, 214, 24, 1); ctx.fillRect(343, 214, 24, 1);
  heart(ctx, 320, 213, 7 + Math.sin(t * 2) * .5, '#f14c58');
  state.options.forEach((o, i) => {
    const y = 250 + i * 48, selected = state.index === i;
    if (selected) { ctx.fillStyle = '#d2b87b0c'; ctx.fillRect(210, y - 8, 220, 44); heart(ctx, 232, y + 10, 6, '#f14c58'); }
    text(ctx, o.label, 254, y, { size: 18, color: selected ? '#f8dfa1' : '#9d97a6' });
    if (o.sub) text(ctx, o.sub, 254, y + 25, { size: 9, color: '#8c8294' });
  });
  const human = bake(HUMAN.up[0], 2); Scene.shadow(ctx, 320, 442, 12, 3); ctx.drawImage(human, 320 - human.width / 2, 442 - human.height);
  text(ctx, 'FAN GAME  /  THREE ENDINGS', 22, 460, { size: 9, color: '#a99a83' });
  text(ctx, '방향키 선택 · Z 확인', 616, 460, { size: 10, color: '#b8a68b', align: 'right' });
}
export function drawNaming(ctx, t, state) {
  clear(ctx, '#000');
  text(ctx, '떨어진 인간의 이름을 지어 주세요.', W / 2, 60, { size: 22, align: 'center' });
  ctx.fillStyle = '#000'; ctx.fillRect(170, 110, 300, 44); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(170, 110, 300, 44);
  text(ctx, state.name + (Math.floor(t * 2) % 2 ? '_' : ''), W / 2, 120, { size: 24, align: 'center', color: '#ffd76a' });
  const keys = state.keys; keys.forEach((row, r) => row.forEach((k, c) => { const x = 60 + c * 40, y = 190 + r * 42; const sel = state.row === r && state.col === c; if (sel) { ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(x - 6, y - 4, 36, 34); } text(ctx, k, x + 12, y, { size: 20, align: 'center', color: sel ? '#ffd76a' : '#fff' }); }));
  text(ctx, '← → ↑ ↓ 고르기 · Z 입력 · X 지우기 · Enter 완료', W / 2, 430, { size: 13, align: 'center', color: '#888' });
  if (state.message) text(ctx, state.message, W / 2, 460, { size: 14, align: 'center', color: '#ff7a7a' });
}
export function drawConfirmName(ctx, t, state) {
  clear(ctx, '#000');
  text(ctx, state.name, W / 2, 140 + Math.sin(t) * 4, { size: 48, align: 'center', bold: true });
  text(ctx, state.comment, W / 2, 230, { size: 18, align: 'center', color: '#ddd' });
  ['아니오', '예'].forEach((o, i) => { const x = 200 + i * 240, y = 330; if (state.index === i) heart(ctx, x - 20, y + 10, 7, '#ff2a2a'); text(ctx, o, x, y, { size: 22, color: state.index === i ? '#ffd76a' : '#fff' }); });
}
export function drawGameOver(ctx, t, state) {
  clear(ctx, '#000');
  const a = Math.min(1, t / 1.5);
  ctx.globalAlpha = a; text(ctx, 'GAME OVER', W / 2, 120, { size: 52, align: 'center', bold: true, color: '#fff' }); ctx.globalAlpha = 1;
  if (t > 1.2) { const lines = state.lines; lines.forEach((l, i) => { if (t > 1.2 + i * .9) text(ctx, l, W / 2, 230 + i * 30, { size: 18, align: 'center', color: '#ccc' }); }); }
  if (t > 1.2 + state.lines.length * .9) text(ctx, 'Z · 세이브 지점에서 다시 시작', W / 2, 420, { size: 14, align: 'center', color: '#888' });
  if (t < .6) { heart(ctx, W / 2, 200, 14, '#ff2a2a'); if (t > .3) { ctx.fillStyle = '#000'; ctx.fillRect(W / 2 - 1, 180, 2, 40); } }
}
export function drawEnding(ctx, t, state) {
  const kind = state.kind;
  if (kind === 'genocide') { clear(ctx, '#000'); if (state.phase === 'chara') { const img = bake(CHARA, 6); ctx.drawImage(img, W / 2 - img.width / 2, 40); } state.visible.forEach((l, i) => text(ctx, l, W / 2, 330 + i * 28, { size: 18, align: 'center', color: '#ddd' })); if (state.choice) state.choice.options.forEach((o, i) => { const x = 200 + i * 240, y = 446; if (state.choice.index === i) heart(ctx, x - 20, y + 10, 7, '#ff2a2a'); text(ctx, o, x, y, { size: 20, color: state.choice.index === i ? '#ffd76a' : '#fff' }); }); return; }
  if (kind === 'pacifist') {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1b1b4a'); g.addColorStop(.6, '#ff9a5a'); g.addColorStop(1, '#ffe08a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffe66d'; ctx.beginPath(); ctx.arc(W / 2, 300 - Math.min(80, state.t * 8), 60, 0, 7); ctx.fill();
    ctx.fillStyle = '#2a1a2e'; ctx.fillRect(0, 330, W, 150);
    const cast = ['toriel', 'sans', 'papyrus', 'undyne', 'asgore']; cast.forEach((c, i) => {
      const img = bake(OVERWORLD[c], 2);
      const px = 90 + i * 100, py = 330 - img.height;
      ctx.drawImage(img, px, py);
      drawCharacterAccent(ctx, c, px, py, img.width, img.height, t, 'battle');
    });
    const hero = bake(HUMAN.up[0], 2); ctx.drawImage(hero, W / 2 - hero.width / 2 + 10, 300 - hero.height + 24);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 350, W, 130);
    // 최근 4줄만 보여 준다. 오래된 줄은 위로 흘러 사라진다.
    const recent = state.visible.slice(-4); recent.forEach((l, i) => { const lines = wrap(ctx, l, 580, 16); text(ctx, lines[0], W / 2, 358 + i * 23, { size: 16, align: 'center', color: i === recent.length - 1 ? '#fff' : '#cfcfcf' }); });
    if (state.done) text(ctx, state.soulless ? '…그런데 왜 이런 기분이 들까. 뒤에서 누군가 웃고 있는 것 같다. · Z로 타이틀' : 'THE END · Z로 타이틀', W / 2, 456, { size: 13, align: 'center', color: '#ffd76a' });
    return;
  }
  clear(ctx, '#000');
  text(ctx, state.title, W / 2, 60, { size: 30, align: 'center', bold: true }); text(ctx, state.subtitle, W / 2, 100, { size: 14, align: 'center', color: '#999' });
  state.visible.forEach((l, i) => { const parts = wrap(ctx, l, 560, 17); parts.forEach((pt, k) => text(ctx, pt, 40, 150 + i * 30 + k * 22, { size: 17 })); });
  if (state.done) text(ctx, 'Z로 타이틀', W / 2, 452, { size: 13, align: 'center', color: '#ffd76a' });
}
export function drawShop(ctx, t, state, player) {
  clear(ctx, '#1a1020');
  const sp = OVERWORLD[state.sprite]; if (sp) { const img = bake(sp, 4); ctx.drawImage(img, 60, 70); }
  ctx.fillStyle = '#000'; ctx.fillRect(300, 40, 300, 320); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeRect(300, 40, 300, 320);
  text(ctx, state.shop.name, 320, 56, { size: 18, bold: true, color: '#ffd76a' });
  state.shop.items.forEach(([id, price], i) => { const y = 100 + i * 36; const it = ITEMS[id]; const sel = state.index === i; if (sel) heart(ctx, 330, y + 10, 7, '#ff2a2a'); text(ctx, `${it.name}`, 350, y, { size: 17, color: sel ? '#ffd76a' : '#fff' }); text(ctx, `${price}G`, 580, y, { size: 15, align: 'right', color: player.gold >= price ? '#fff' : '#777' }); });
  const exitY = 100 + state.shop.items.length * 36 + 10; if (state.index === state.shop.items.length) heart(ctx, 330, exitY + 10, 7, '#ff2a2a'); text(ctx, '나가기', 350, exitY, { size: 17, color: state.index === state.shop.items.length ? '#ffd76a' : '#fff' });
  text(ctx, `${player.gold} G · 가방 ${player.items.length}/8`, 320, 330, { size: 14, color: '#aaa' });
  ctx.fillStyle = '#000'; ctx.fillRect(40, 380, 560, 80); ctx.strokeStyle = '#fff'; ctx.strokeRect(40, 380, 560, 80);
  wrap(ctx, state.message, 520, 16).slice(0, 2).forEach((l, i) => text(ctx, l, 60, 396 + i * 24, { size: 16 }));
  const desc = state.index < state.shop.items.length ? ITEMS[state.shop.items[state.index][0]].text : '';
  if (desc) text(ctx, desc, 60, 340, { size: 13, color: '#bbb' });
}
export function drawMenu(ctx, t, state, player, w) {
  ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000'; ctx.fillRect(40, 40, 200, 130); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeRect(40, 40, 200, 130);
  text(ctx, player.name, 60, 56, { size: 18, bold: true }); text(ctx, `LV ${player.lv}`, 60, 86, { size: 15 }); text(ctx, `HP ${player.hp} / ${player.maxHp}`, 60, 110, { size: 15 }); text(ctx, `${player.gold} G`, 60, 134, { size: 15 });
  ctx.fillStyle = '#000'; ctx.fillRect(40, 190, 200, 166); ctx.strokeRect(40, 190, 200, 166);
  ['아이템', '스탯', '탐험 수첩', '닫기'].forEach((o, i) => { const y = 208 + i * 34; if (state.tab === i && !state.sub) heart(ctx, 62, y + 10, 7, '#ff2a2a'); text(ctx, o, 80, y, { size: 18, color: state.tab === i ? '#ffd76a' : '#fff' }); });
  ctx.fillStyle = '#000'; ctx.fillRect(260, 40, 340, 400); ctx.strokeRect(260, 40, 340, 400);
  if (state.tab === 0) { if (!player.items.length) text(ctx, '가방이 비어 있다.', 290, 60, { size: 16 }); player.items.forEach((id, i) => { const y = 60 + i * 32; const sel = state.sub && state.index === i; if (sel) heart(ctx, 282, y + 10, 7, '#ff2a2a'); text(ctx, ITEMS[id].name, 300, y, { size: 17, color: sel ? '#ffd76a' : '#fff' }); }); if (state.sub && player.items[state.index]) { text(ctx, ITEMS[player.items[state.index]].text, 290, 340, { size: 13, color: '#bbb' }); text(ctx, 'Z 사용/장착 · X 닫기', 290, 410, { size: 13, color: '#777' }); } }
  else if (state.tab === 1) { const lines = [`"${player.name}"`, `LV ${player.lv}   HP ${player.hp} / ${player.maxHp}`, `AT ${attackStat(player)} (${ITEMS[player.weapon].weapon})   DF ${defenseStat(player)} (${ITEMS[player.armor].armor})`, `EXP ${player.exp}   다음 LV까지 ${player.lv >= 20 ? 0 : Math.max(0, [0, 10, 30, 70, 120, 200, 300, 500, 800, 1200, 1700, 2500, 3500, 5000, 7000, 10000, 15000, 25000, 50000, 99999][player.lv] - player.exp)}`, `무기: ${ITEMS[player.weapon].name}`, `방어구: ${ITEMS[player.armor].name}`, `골드: ${player.gold} G`, `죽인 수: ${player.kills}`, `현재 위치: ${w.room.area}`]; lines.forEach((l, i) => text(ctx, l, 290, 60 + i * 30, { size: 16 })); }
  if (state.tab === 2) drawJournal(ctx, state, player);
  if (state.message && state.tab !== 2) text(ctx, state.message, 290, 380, { size: 14, color: '#ffd76a' });
}
function drawJournal(ctx, state, player) {
  const entries = player.journal?.entries || [], entry = entries[state.journalIndex || 0];
  text(ctx, '작은 기억들', 284, 60, { size: 19, color: '#e9cf92', bold: true });
  text(ctx, entries.length + ' / ' + DETAILS.length + ' 발견', 576, 66, { size: 11, color: '#9990a5', align: 'right' });
  ctx.fillStyle = '#39313c'; ctx.fillRect(284, 96, 292, 1);
  if (!entry) {
    const lines = ['빛나는 소품 앞에서 Z를 눌러 보자.', '', '책갈피의 메모, 식탁 위의 파이,', '설원에 남겨진 누군가의 인사.', '', '지나치기 쉬운 이야기들을', '여기에 하나씩 간직할 수 있다.'];
    lines.forEach((line, i) => text(ctx, line, 286, 132 + i * 26, { size: 14, color: '#b5abbc' })); return;
  }
  text(ctx, ROOM_NAMES[entry.room], 284, 115, { size: 11, color: '#92869e' });
  text(ctx, entry.title, 284, 147, { size: 17, color: '#f0ddae' });
  let y = 190;
  for (const paragraph of entry.lines) {
    for (const line of wrap(ctx, paragraph.replace(/^\*\s?/, ''), 286, 14)) { text(ctx, line, 284, y, { size: 14, color: '#d3cbd8' }); y += 22; }
    y += 10;
  }
  text(ctx, '←  ' + ((state.journalIndex || 0) + 1) + ' / ' + entries.length + '  →', 430, 391, { size: 12, color: '#ead295', align: 'center' });
  text(ctx, '좌우로 기억 넘기기 · 별에서 저장', 430, 416, { size: 10, color: '#8e8497', align: 'center' });
}
export function drawWarp(ctx, state, names) {
  ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000'; ctx.fillRect(40, 24, 560, 432); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeRect(40, 24, 560, 432);
  text(ctx, '어디로 갈까?', 60, 36, { size: 18, bold: true, color: '#ffd76a' }); text(ctx, '↑↓ 고르기 · ←→ 7칸 · Z 이동 · X / - 닫기', 580, 40, { size: 12, align: 'right', color: '#888' });
  const perCol = 13, colW = 270; state.ids.forEach((id, i) => { const col = Math.floor(i / perCol), row = i % perCol; const x = 80 + col * colW, y = 72 + row * 28; const sel = state.index === i; if (sel) heart(ctx, x - 16, y + 9, 7, '#ff2a2a'); text(ctx, names[id] || id, x, y, { size: 15, color: sel ? '#ffd76a' : '#fff' }); });
}
export function drawBossSelect(ctx, t, state, bosses) {
  ctx.fillStyle = 'rgba(0,0,0,.85)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000'; ctx.fillRect(80, 60, 480, 360); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeRect(80, 60, 480, 360);
  text(ctx, '비밀 코드 · 보스전', W / 2, 78, { size: 20, bold: true, align: 'center', color: '#ffd76a' });
  text(ctx, '누구와 싸울까?', W / 2, 110, { size: 15, align: 'center', color: '#ccc' });
  bosses.forEach((b, i) => { const y = 160 + i * 74; const sel = state.index === i; const img = bake(BATTLE[b.id], 2); ctx.drawImage(img, 130, y + 20 - img.height / 2); if (sel) heart(ctx, 200, y + 9, 7, '#ff2a2a'); text(ctx, b.name, 220, y, { size: 19, bold: true, color: sel ? '#ffd76a' : '#fff' }); text(ctx, b.desc, 220, y + 26, { size: 12, color: '#999' }); });
  text(ctx, '↑↓ 고르기 · Z 시작 · X 닫기', W / 2, 392, { size: 12, align: 'center', color: '#777' });
}
export function drawLevelSelect(ctx, state, steps, player) {
  ctx.fillStyle = 'rgba(0,0,0,.85)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000'; ctx.fillRect(120, 100, 400, 280); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeRect(120, 100, 400, 280);
  text(ctx, '비밀 코드 · 레벨업', W / 2, 118, { size: 20, bold: true, align: 'center', color: '#ffd76a' });
  text(ctx, `지금 LV ${player.lv} · HP ${player.maxHp}`, W / 2, 150, { size: 14, align: 'center', color: '#ccc' });
  steps.forEach((s, i) => { const y = 195 + i * 52; const sel = state.index === i; if (sel) heart(ctx, 200, y + 9, 7, '#ff2a2a'); text(ctx, s.name, 220, y, { size: 19, bold: true, color: sel ? '#ffd76a' : '#fff' }); text(ctx, s.desc, 220, y + 24, { size: 12, color: '#999' }); });
  text(ctx, '↑↓ 고르기 · Z 적용 · X 닫기', W / 2, 352, { size: 12, align: 'center', color: '#777' });
}
export { alive };
