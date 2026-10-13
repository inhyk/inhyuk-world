// 언더테일 팬 게임 · 아스리엘 드리무르 보스전 렌더러 (Canvas 2D, 논리 해상도 640×480)
// render.mjs 의 drawBattle 이 b.asr 가 있을 때 이 모듈에 배경·보스·탄막·연출·버튼을 맡긴다.
import * as PX from './asriel-pixels.mjs';
import { BATTLE, bake } from './sprites.mjs';
import { ATTACK_NAMES, allSaved } from './asriel.mjs';

const W = 640, H = 480, TAU = Math.PI * 2;
const FONT = '"Galmuri11", "DungGeunMo", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const hash = (i, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = k => k * k * (3 - 2 * k);
const hueCss = (h, s = 92, l = 64, a = 1) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;
const segment = (t, a, b) => clamp((t - a) / (b - a));

// ---------- 픽셀 인형 표면 ----------
const surfaces = {};
function makeCanvas(w, h) { return typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }); }
// 래스터를 20fps로 다시 그려 캔버스에 올린다. 같은 프레임이면 재사용한다.
function figure(key, size, draw, f, opts = {}, color = {}, stamp = '') {
  let s = surfaces[key];
  if (!s) { const c = makeCanvas(size.w, size.h); s = surfaces[key] = { c, g: c.getContext('2d'), R: PX.createRaster(size.w, size.h), img: null, stamp: null }; s.img = s.g.createImageData(size.w, size.h); }
  if (s.stamp !== stamp) { PX.clearRaster(s.R); draw(s.R, f, opts); PX.colorize(s.R, { ...color, out: s.img.data }); s.g.putImageData(s.img, 0, 0); s.stamp = stamp; }
  return s.c;
}
function blit(ctx, img, x, y, scale, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, Math.round(x), Math.round(y), img.width * scale, img.height * scale); ctx.restore();
}
function glow(ctx, x, y, r, color, alpha = 1) {
  if (alpha <= 0 || r <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}
function starPath(ctx, x, y, r, rot, inner = .45, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) { const a = rot + i * Math.PI / points - Math.PI / 2, rr = i % 2 ? r * inner : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath();
}
function pixelHeart(ctx, x, y, r, color) {
  const px = ['01100110', '11111111', '11111111', '11111111', '01111110', '00111100', '00011000'], u = r / 4;
  ctx.fillStyle = color; for (let row = 0; row < 7; row++) for (let col = 0; col < 8; col++) if (px[row][col] === '1') ctx.fillRect(x + (col - 4) * u, y + (row - 3) * u, u, u);
}
function label(ctx, str, x, y, { size = 16, color = '#fff', align = 'left', bold = false, alpha = 1, shadow = null, spacing = 0, outline = null } = {}) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'top';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
  if (shadow) { ctx.fillStyle = shadow; ctx.fillText(str, x + 2, y + 2); }
  ctx.fillStyle = color; ctx.fillText(str, x, y); ctx.restore();
}

// ---------- 보스 모습 계산 ----------
const GOD_SCALE = 2, FINAL_SCALE = 2, CHILD_SCALE = 3;
const godOrigin = bob => ({ x: 320 - PX.GOD_SIZE.w, y: 8 + bob });
const finalOrigin = bob => ({ x: 320 - PX.FINAL_SIZE.w, y: 2 + bob });
function drawGodForm(ctx, t, { alpha = 1, shake = 0, white = 0, dx = 0 } = {}) {
  const f = (t / 2.6) % 1, bob = Math.sin(t * 1.7) * 3, o = godOrigin(bob);
  const blink = (t % 4.3) < .12;
  const img = figure('god', PX.GOD_SIZE, PX.drawGod, f, { shake, blink }, { t }, `${Math.floor(t * 20)}|${shake.toFixed(1)}|${blink}`);
  const sx = shake ? (hash(Math.floor(t * 40)) - .5) * shake * 6 : 0;
  // 등 뒤의 후광과 무지개 기운
  glow(ctx, 320 + dx, 90 + bob, 190, hueCss(t * 60, 90, 60, .22), alpha * .8);
  glow(ctx, 320 + dx, 150 + bob, 120, 'rgba(255,255,255,.12)', alpha);
  blit(ctx, img, o.x + sx + dx, o.y, GOD_SCALE, alpha);
  // 가슴 심장의 맥동
  const pulse = .6 + Math.sin(t * 5) * .25;
  glow(ctx, 320 + dx + sx, o.y + 72 * 2 + 4, 26 + pulse * 10, hueCss(t * 200, 100, 70, .9), alpha * pulse);
  // 눈동자 빛
  if (!blink) for (const ex of [85, 94]) glow(ctx, o.x + dx + sx + ex * 2 + 1, o.y + 25 * 2 + 1, 7, 'rgba(255,255,255,.9)', alpha * .7);
  if (white > 0) { ctx.save(); ctx.globalAlpha = alpha * white; const img2 = figure('godWhite', PX.GOD_SIZE, PX.drawGod, f, { shake }, { t, tint: { c: [255, 255, 255], k: 1 }, outline: [255, 255, 255] }, `${Math.floor(t * 20)}|${shake.toFixed(1)}|w`); ctx.drawImage(img2, o.x + sx + dx, o.y, img2.width * GOD_SCALE, img2.height * GOD_SCALE); ctx.restore(); }
  return o;
}
function drawFinalForm(ctx, t, { alpha = 1, spread = 1, shatter = 0, shake = 0, white = 0, dim = 0 } = {}) {
  const f = (t / 1.9) % 1, bob = Math.sin(t * 1.4) * 4, o = finalOrigin(bob), blink = (t % 5.1) < .1;
  const sx = shake ? (hash(Math.floor(t * 40), 3) - .5) * shake * 7 : 0;
  const img = figure('final', PX.FINAL_SIZE, PX.drawFinal, f, { spread, shatter, blink }, { t, tint: dim ? { c: [20, 16, 40], k: dim } : null }, `${Math.floor(t * 20)}|${spread.toFixed(2)}|${shatter.toFixed(2)}|${blink}|${dim.toFixed(2)}`);
  glow(ctx, 320, 120 + bob, 260 * (.5 + spread * .5), hueCss(t * 90, 95, 62, .2), alpha * (1 - dim));
  blit(ctx, img, o.x + sx, o.y, FINAL_SCALE, alpha);
  const pulse = .7 + Math.sin(t * 6) * .3;
  glow(ctx, 320 + sx, o.y + 62 * 2 + 4, 40 + pulse * 16, hueCss(t * 240, 100, 72, 1), alpha * pulse * (1 - dim * .8));
  if (!blink) for (const ex of [114, 125]) glow(ctx, o.x + sx + ex * 2 + 1, o.y + 21 * 2 + 4, 9, 'rgba(255,255,255,1)', alpha * .8 * (1 - dim));
  if (white > 0) { ctx.save(); ctx.globalAlpha = alpha * white; const img2 = figure('finalWhite', PX.FINAL_SIZE, PX.drawFinal, f, { spread, shatter }, { t, tint: { c: [255, 255, 255], k: 1 }, outline: [255, 255, 255] }, `${Math.floor(t * 20)}|${spread.toFixed(2)}|${shatter.toFixed(2)}|w`); ctx.drawImage(img2, o.x + sx, o.y, img2.width * FINAL_SCALE, img2.height * FINAL_SCALE); ctx.restore(); }
  return o;
}
function drawChildForm(ctx, t, { alpha = 1, y = 70 } = {}) {
  const f = (t / 1.6) % 1, img = figure('child', PX.CHILD_SIZE, PX.drawChild, f, {}, { t }, `${Math.floor(t * 12)}`);
  const x = 320 - PX.CHILD_SIZE.w * CHILD_SCALE / 2;
  glow(ctx, 320, y + 110, 150, 'rgba(255,236,190,.25)', alpha);
  ctx.save(); ctx.globalAlpha = alpha * .45; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(320, y + 176, 70, 8, 0, 0, TAU); ctx.fill(); ctx.restore();
  blit(ctx, img, x, y, CHILD_SCALE, alpha);
}
// 잃어버린 영혼 두 사람: 색이 빠진 채 지직거린다. k=1 이면 원래 색을 되찾는다.
const ghosts = new Map();
function ghostOf(id, img) {
  if (ghosts.has(id)) return ghosts.get(id);
  const c = makeCanvas(img.width, img.height), g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'saturation'; g.fillStyle = '#808080'; g.fillRect(0, 0, c.width, c.height);   // 색을 뺀다
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(200,214,255,.42)'; g.fillRect(0, 0, c.width, c.height); // 푸르스름하게 바랜다
  g.globalCompositeOperation = 'destination-in'; g.drawImage(img, 0, 0);                                     // 원래 실루엣만 남긴다
  ghosts.set(id, c); return c;
}
function lostSprite(id, colorful) {
  const real = id === 'alphys' ? figure('alphys', PX.ALPHYS_SIZE, PX.drawAlphys, 0, {}, {}, 'c') : bake(BATTLE[id], 4);
  return colorful ? real : ghostOf(id, real);
}
function drawLostPair(ctx, soul, t, { alpha = 1, k = 0, rise = 0 } = {}) {
  soul.sprites.forEach((id, i) => {
    const ghost = lostSprite(id, false), real = lostSprite(id, true), scale = id === 'alphys' ? 3 : 1;
    const w = ghost.width * scale, h = ghost.height * scale, cx = 320 + (i ? 92 : -92), bottom = 226 - rise;
    const x = cx - w / 2, y = bottom - h + Math.sin(t * 2 + i * 1.7) * 3;
    glow(ctx, cx, bottom - h / 2, 90, k > 0 ? soul.colors[i] + '66' : 'rgba(170,190,255,.18)', alpha);
    // 지직거리는 유령: 가로 줄마다 조금씩 어긋나게 그린다
    ctx.save(); ctx.globalAlpha = alpha * (1 - k) * (.55 + Math.sin(t * 9 + i) * .08);
    for (let sy = 0; sy < ghost.height; sy += 2) {
      const off = Math.sin(sy * .35 + t * 7 + i * 3) * 2 + (hash(Math.floor(t * 12) + sy, i) > .93 ? 6 : 0);
      ctx.drawImage(ghost, 0, sy, ghost.width, 2, Math.round(x + off), Math.round(y + sy * scale), w, 2 * scale);
    }
    ctx.restore();
    if (k > 0) blit(ctx, real, x, y, scale, alpha * k);
    label(ctx, k > .5 ? soul.names[i] : '???', cx, y - 14, { size: 10, align: 'center', color: k > .5 ? soul.colors[i] : '#8f97b4', alpha: alpha * (k > .5 ? 1 : .7), outline: '#000' });
  });
}

// ---------- 배경 ----------
export function drawBackdrop(ctx, b, t, rm) {
  const A = b.asr, c = A.cine, phase = A.phase;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const finalish = phase === 'final' || (c?.kind === 'transform' && c.t > 2.6) || (phase === 'save' && A.focus === null && !(c?.kind === 'finale' && c.t > 2.6));
  const quiet = phase === 'end' || (c?.kind === 'finale' && c.t > 2.6);
  // 1. 별밭: 세 겹이 서로 다른 속도로 흐른다
  const speed = finalish ? 34 : 12;
  for (let layer = 0; layer < 3; layer++) {
    const n = 26 + layer * 16, sp = speed * (layer + 1) * .5;
    for (let i = 0; i < n; i++) {
      const x = (hash(i, layer + 1) * W + (rm ? 0 : t * sp * (layer === 1 ? -1 : 1))) % W, y = (hash(i, layer + 7) * 300 + (rm ? 0 : t * sp * .3)) % 300;
      const tw = .35 + .65 * Math.abs(Math.sin(t * (1 + hash(i, 9) * 2) + i));
      ctx.fillStyle = quiet ? `rgba(255,236,200,${.25 * tw})` : finalish ? hueCss(i * 37 + t * 80, 90, 80, .55 * tw) : `rgba(200,210,255,${(.2 + layer * .15) * tw})`;
      const s = layer === 2 && hash(i, 4) > .8 ? 2 : 1; ctx.fillRect(Math.round(x < 0 ? x + W : x), Math.round(y), s, s);
    }
  }
  if (quiet) {
    // 결말: 따뜻한 빛 알갱이가 천천히 내려온다
    for (let i = 0; i < 40; i++) { const x = hash(i, 21) * W, y = (hash(i, 22) * H + t * (8 + hash(i, 23) * 14)) % H; ctx.fillStyle = `rgba(255,232,180,${.15 + .25 * Math.abs(Math.sin(t + i))})`; ctx.fillRect(Math.round(x), Math.round(y), 2, 2); }
    return;
  }
  if (finalish) {
    // 2. 무지개 띠: 세로 띠가 옆으로 흐르며 색상환을 돈다
    ctx.save(); ctx.globalAlpha = phase === 'save' ? .08 : .14;
    for (let i = 0; i < 16; i++) { const x = ((i * 48 - (rm ? 0 : t * 30)) % 768 + 768) % 768 - 64; const g = ctx.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, hueCss(i * 22.5 + t * 90, 95, 55, 1)); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x, 0, 48, 300); }
    ctx.restore();
    // 3. 심장에서 뻗어 나가는 빛살
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(320, 128);
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12 + (rm ? 0 : t * .15); ctx.fillStyle = hueCss(i * 30 + t * 60, 90, 60, phase === 'save' ? .025 : .05); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - .06) * 520, Math.sin(a - .06) * 520); ctx.lineTo(Math.cos(a + .06) * 520, Math.sin(a + .06) * 520); ctx.fill(); }
    ctx.restore();
  } else {
    // 절대신: 성운 리본과 대성당 같은 빛기둥
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) { const x = 320 + Math.sin(t * .2 + i * 1.3) * 250, y = 110 + Math.cos(t * .17 + i) * 60; glow(ctx, x, y, 150, hueCss(200 + i * 40 + t * 12, 80, 45, .12), 1); }
    for (let i = 0; i < 6; i++) { const x = 70 + i * 100, a = .04 + .03 * Math.sin(t * .8 + i); const g = ctx.createLinearGradient(0, 0, 0, 260); g.addColorStop(0, `rgba(190,200,255,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - 10, 0, 20, 260); }
    ctx.restore();
  }
  // 4. 3막: 구한 영혼들의 하트가 아스리엘 주위를 돈다
  if (phase === 'save') A.souls.forEach((s, i) => {
    if (!s.saved) return;
    s.colors.forEach((col, j) => { const a = t * .9 + i * TAU / 3 + j * Math.PI, rx = 250, ry = 70; const x = 320 + Math.cos(a) * rx, y = 128 + Math.sin(a) * ry; glow(ctx, x, y, 18, col, .8); pixelHeart(ctx, x, y, 5, col); });
  });
}

// ---------- 보스 ----------
export function drawBoss(ctx, b, t, rm) {
  const A = b.asr, c = A.cine, phase = A.phase, atk = b.attack?.name;
  const hitShake = b.lastDamage && b.lastDamage.t < .5 && !rm ? Math.sin(b.lastDamage.t * 60) * 5 * (1 - b.lastDamage.t * 2) : 0;
  if (c) return drawCineBoss(ctx, b, t, c);
  if (phase === 'god') {
    const goner = atk === 'asHyperGoner';
    drawGodForm(ctx, t, { alpha: goner ? .18 : 1, dx: hitShake });
  } else if (phase === 'final') {
    drawFinalForm(ctx, t, { alpha: atk === 'asFinalBeam' ? .9 : 1, shake: atk === 'asFinalBeam' ? .6 : 0 });
  } else if (phase === 'save') {
    const saved = A.souls.filter(s => s.saved).length, sh = allSaved(b) ? [.12, .3, .5, .7][Math.min(3, A.asrielSave)] : 0;
    if (A.focus !== null) {
      drawFinalForm(ctx, t, { alpha: .35, dim: .7, shatter: sh });
      drawLostPair(ctx, A.souls[A.focus], t, { alpha: 1, k: 0 });
    } else drawFinalForm(ctx, t, { alpha: 1, shatter: sh, dim: allSaved(b) ? .1 + A.asrielSave * .08 : saved * .04, shake: allSaved(b) ? A.asrielSave * .35 : 0 });
    if (A.saveFlash > 0) { const k = A.saveFlash; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,226,120,${k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(320, 128, 60 + (1 - k) * 160, 0, TAU); ctx.stroke(); ctx.restore(); }
  } else if (phase === 'end') drawChildForm(ctx, t);
  // 공격 결과: 흠집 없는 ∞ 체력
  const d = b.lastDamage;
  if (d && d.t < 1.2 && (phase === 'god' || phase === 'final')) {
    const hx = 270, hy = 236;
    ctx.fillStyle = '#3a3a3a'; ctx.fillRect(hx, hy, 100, 12);
    const g = ctx.createLinearGradient(hx, 0, hx + 100, 0); for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, hueCss(i * 60 + t * 240, 90, 60)); ctx.fillStyle = g; ctx.fillRect(hx, hy, 100, 12);
    label(ctx, '∞', 320, hy - 1, { size: 12, align: 'center', bold: true, color: '#fff', shadow: '#000' });
  }
}
function drawCineBoss(ctx, b, t, c) {
  const A = b.asr, k = c.t;
  switch (c.kind) {
    case 'intro': {
      // 빛 한 점 → 아이의 실루엣 → 번쩍 → 절대신
      if (k < 1.5) { const r = 4 + k * 30; glow(ctx, 320, 130, r * 3, 'rgba(255,255,255,.9)', clamp(k / .4)); if (k > .7) drawChildForm(ctx, t, { alpha: segment(k, .7, 1.2) * .9, y: 60 }); }
      else drawGodForm(ctx, t, { alpha: segment(k, 1.5, 2.6), white: 1 - segment(k, 1.5, 2.9) });
      break;
    }
    case 'transform': {
      if (k < 2.4) { const cracks = segment(k, .2, 2.2); drawGodForm(ctx, t, { shake: cracks * 1.4, white: segment(k, 1.4, 2.3) }); drawCracks(ctx, 320, 150, cracks); }
      else drawFinalForm(ctx, t, { spread: ease(segment(k, 2.6, 4)), white: 1 - segment(k, 2.4, 3.4) });
      break;
    }
    case 'refuse': case 'refuseSmall': {
      if (A.phase === 'god') drawGodForm(ctx, t, { alpha: .25 });
      else if (A.phase === 'save' && A.focus !== null) drawLostPair(ctx, A.souls[A.focus], t, { alpha: .3 });
      else drawFinalForm(ctx, t, { alpha: .25, dim: .5 });
      break;
    }
    case 'soulFocus': {
      const s = A.souls[A.focus ?? 0]; drawFinalForm(ctx, t, { alpha: 1 - segment(k, 0, .9) * .65, dim: segment(k, 0, .9) * .7 });
      drawLostPair(ctx, s, t, { alpha: segment(k, .3, 1.2), k: 0 });
      break;
    }
    case 'soulSaved': {
      const s = A.souls[c.soul]; drawFinalForm(ctx, t, { alpha: .35 + segment(k, 2, 3) * .65, dim: .7 * (1 - segment(k, 2, 3)) });
      const colorK = segment(k, .4, 1.3), fade = 1 - segment(k, 1.3, 1.9);
      drawLostPair(ctx, s, t, { alpha: fade, k: colorK });
      // 두 사람이 하트가 되어 떠오른다
      if (k > 1.3) s.colors.forEach((col, i) => { const rise = segment(k, 1.3, 3), x = 320 + (i ? 92 : -92) * (1 - rise * .4), y = 170 - ease(rise) * 150; glow(ctx, x, y, 40, col, 1 - rise * .5); pixelHeart(ctx, x, y, 9, col); for (let j = 0; j < 6; j++) { const a = j * TAU / 6 + k * 3; ctx.fillStyle = col; ctx.fillRect(x + Math.cos(a) * (14 + rise * 20), y + Math.sin(a) * (14 + rise * 20), 2, 2); } });
      break;
    }
    case 'finale': {
      if (k < 2.6) { drawFinalForm(ctx, t, { shatter: .7 + segment(k, 0, 1.6) * .3, shake: 1.2 * (1 - segment(k, 1.6, 2.6)), white: segment(k, 1.8, 2.6), dim: 0 }); if (k > 1.5) drawFeathers(ctx, t, segment(k, 1.5, 2.6)); }
      else { drawFeathers(ctx, t, 1 + segment(k, 2.6, 5)); drawChildForm(ctx, t, { alpha: segment(k, 3.2, 4.6) }); }
      break;
    }
  }
}
function drawCracks(ctx, x, y, k) {
  if (k <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,255,255,${.4 + k * .6})`; ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const a = i * TAU / 9 + hash(i, 5), len = k * (60 + hash(i, 6) * 160); let px = x, py = y; ctx.beginPath(); ctx.moveTo(px, py);
    for (let s = 1; s <= 6; s++) { const d = len * s / 6, j = (hash(i * 10 + s, 7) - .5) * 18; px = x + Math.cos(a) * d + Math.cos(a + Math.PI / 2) * j; py = y + Math.sin(a) * d + Math.sin(a + Math.PI / 2) * j; ctx.lineTo(px, py); }
    ctx.stroke();
  }
  glow(ctx, x, y, 40 + k * 80, 'rgba(255,255,255,.8)', k); ctx.restore();
}
function drawFeathers(ctx, t, k) {
  for (let i = 0; i < 46; i++) {
    const side = i % 2 ? 1 : -1, x = 320 + side * (40 + hash(i, 31) * 200) + Math.sin(t * 2 + i) * 10 * k, y = 90 + hash(i, 32) * 80 + k * k * (60 + hash(i, 33) * 160);
    const a = t * (1 + hash(i, 34)) + i, alpha = clamp(1.6 - k * .6) * (.5 + hash(i, 35) * .5);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.globalAlpha = alpha; ctx.fillStyle = hueCss(i * 26 + t * 50, 92, 66);
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(3, 0); ctx.lineTo(0, 8); ctx.lineTo(-3, 0); ctx.fill(); ctx.restore();
  }
}

// ---------- 탄막 ----------
const FREE_KINDS = new Set(['asSaber', 'asBolt', 'asStrike', 'asGun', 'asOrb', 'asSkull', 'asSuck', 'asRay', 'asFinal']);
export function isFree(bl) { return bl.free || FREE_KINDS.has(bl.kind); }
export function drawBullet(ctx, bl, t, b) {
  if (!bl.kind.startsWith('as')) return false;
  const fadeK = bl.faded ? clamp(1 - (bl.age - (bl.fadeAt || 0)) / .35) : 1;
  ctx.save(); ctx.globalAlpha *= fadeK;
  switch (bl.kind) {
    case 'asMark': {
      const k = clamp(bl.age / bl.ttl), r = bl.r * (1.6 - k * .6);
      ctx.strokeStyle = `rgba(255,240,170,${.25 + k * .5})`; ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + t * 3; ctx.beginPath(); ctx.moveTo(bl.x + Math.cos(a) * r, bl.y + Math.sin(a) * r); ctx.lineTo(bl.x + Math.cos(a) * (r - 5), bl.y + Math.sin(a) * (r - 5)); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(bl.x, bl.y, r * .55, 0, TAU); ctx.stroke(); break;
    }
    case 'asStar': {
      const big = bl.big, rot = t * (big ? 4 : 6) + (bl.spinSeed || 0) + bl.x * .01;
      const fill = bl.rainbow ? hueCss((bl.hue || 0) + t * 220, 95, 70) : '#ffe66d';
      // 꼬리
      const sp = Math.hypot(bl.vx, bl.vy) || 1, tx = -bl.vx / sp, ty = -bl.vy / sp, trail = big ? 5 : bl.comet ? 4 : 2;
      for (let i = trail; i >= 1; i--) { ctx.globalAlpha = fadeK * (.35 - i * .06); ctx.fillStyle = bl.rainbow ? hueCss((bl.hue || 0) + t * 220 - i * 25, 95, 65) : '#ffd23a'; starPath(ctx, bl.x + tx * i * (big ? 7 : 5), bl.y + ty * i * (big ? 7 : 5), bl.r * (1 - i * .12), rot); ctx.fill(); }
      ctx.globalAlpha = fadeK;
      if (big) glow(ctx, bl.x, bl.y, bl.r * 3, bl.rainbow ? hueCss(t * 220, 95, 70, .8) : 'rgba(255,230,120,.7)', fadeK);
      starPath(ctx, bl.x, bl.y, bl.r + 1.5, rot); ctx.fillStyle = '#2a1a06'; ctx.fill();
      starPath(ctx, bl.x, bl.y, bl.r, rot); ctx.fillStyle = fill; ctx.fill();
      starPath(ctx, bl.x - .5, bl.y - .5, bl.r * .45, rot, .5); ctx.fillStyle = '#fffbe6'; ctx.fill();
      break;
    }
    case 'asFlash': { const k = clamp(bl.age / bl.ttl); glow(ctx, bl.x, bl.y, bl.r * (1 + k), 'rgba(255,255,255,1)', 1 - k); ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bl.x, bl.y, bl.r * (.4 + k * 1.2), 0, TAU); ctx.stroke(); break; }
    case 'asSaber': drawSaber(ctx, bl, t, b); break;
    case 'asWave': {
      ctx.translate(bl.x, bl.y); ctx.rotate(bl.ang + Math.PI / 2); const col = bl.rainbow ? hueCss(t * 300 + bl.x, 95, 70) : '#dff4ff';
      glow(ctx, 0, 0, 22, bl.rainbow ? hueCss(t * 300 + bl.x, 95, 60, .6) : 'rgba(200,240,255,.5)', 1);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, 11, Math.PI * 1.1, Math.PI * 1.9); ctx.arc(0, 4, 8, Math.PI * 1.9, Math.PI * 1.1, true); ctx.fill(); break;
    }
    case 'asBolt': drawBolt(ctx, bl, t); break;
    case 'asStrike': {
      const warnK = clamp(bl.age / bl.warnT);
      if (bl.warn) {
        const r = bl.radius * (2.2 - warnK * 1.2); ctx.strokeStyle = `rgba(255,236,120,${.3 + warnK * .6})`; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.lineDashOffset = -t * 30;
        ctx.beginPath(); ctx.arc(bl.x, bl.y, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(bl.x + Math.cos(a) * (r + 6), bl.y + Math.sin(a) * (r + 6)); ctx.lineTo(bl.x + Math.cos(a) * (r - 6), bl.y + Math.sin(a) * (r - 6)); ctx.stroke(); }
      } else {
        const k = clamp((bl.age - bl.warnT) / .38); glow(ctx, bl.x, bl.y, bl.radius * 2.2, 'rgba(255,240,150,1)', 1 - k);
        ctx.fillStyle = `rgba(255,255,230,${1 - k})`; ctx.beginPath(); ctx.arc(bl.x, bl.y, bl.radius * (1 - k * .3), 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(255,230,90,${1 - k})`; ctx.lineWidth = 3;
        for (let i = 0; i < 7; i++) { const a = i * TAU / 7 + bl.x; ctx.beginPath(); ctx.moveTo(bl.x, bl.y); let px = bl.x, py = bl.y; for (let s = 1; s <= 4; s++) { px = bl.x + Math.cos(a) * s * 14 + (hash(i + s, bl.y) - .5) * 10; py = bl.y + Math.sin(a) * s * 14 + (hash(i - s, bl.x) - .5) * 10; ctx.lineTo(px, py); } ctx.stroke(); }
      }
      break;
    }
    case 'asGun': {
      const aim = bl.aim ?? Math.PI / 2, kick = bl.kick || 0; bl.kick = Math.max(0, kick - .15);
      const appear = clamp(bl.age / .4), leave = clamp((bl.ttl - bl.age) / .3);
      ctx.globalAlpha *= appear * leave; ctx.translate(bl.x, bl.y); ctx.rotate(aim - Math.PI / 2);
      glow(ctx, 0, 30, 26 + kick * 20, 'rgba(255,170,240,.9)', .6 + kick);
      // 총신: 검은 몸체, 금빛 고리, 무지개 에너지 줄
      ctx.fillStyle = '#07060c'; ctx.fillRect(-11, -26 - kick * 6, 22, 52); ctx.fillStyle = '#2d2546'; ctx.fillRect(-9, -24 - kick * 6, 18, 48);
      const g = ctx.createLinearGradient(0, -24, 0, 24); for (let i = 0; i <= 4; i++) g.addColorStop(i / 4, hueCss(i * 90 + t * 300, 95, 65)); ctx.fillStyle = g; ctx.fillRect(-3, -20 - kick * 6, 6, 40);
      ctx.fillStyle = '#f0c75e'; ctx.fillRect(-12, -6 - kick * 6, 24, 4); ctx.fillRect(-12, 14 - kick * 6, 24, 4);
      ctx.fillStyle = '#07060c'; ctx.fillRect(-7, 24 - kick * 6, 14, 8); ctx.fillStyle = '#fff'; ctx.fillRect(-4, 27 - kick * 6, 8, 3);
      ctx.fillStyle = '#07060c'; ctx.fillRect(-18, -30 - kick * 6, 36, 8); ctx.fillStyle = '#4c4368'; ctx.fillRect(-16, -28 - kick * 6, 32, 4);
      break;
    }
    case 'asShell': {
      const a = Math.atan2(bl.vy, bl.vx); ctx.translate(bl.x, bl.y); ctx.rotate(a);
      ctx.fillStyle = 'rgba(255,120,220,.35)'; ctx.fillRect(-12, -2, 10, 4);
      ctx.fillStyle = '#ff5ad2'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(0, -5); ctx.lineTo(-7, 0); ctx.lineTo(0, 5); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(0, -2.5); ctx.lineTo(-4, 0); ctx.lineTo(0, 2.5); ctx.fill(); break;
    }
    case 'asOrb': {
      const k = clamp(bl.age / bl.ttl), r = 6 + k * 10;
      glow(ctx, bl.x, bl.y, r * 3.5, 'rgba(255,120,230,1)', .8);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bl.x, bl.y, r * .6, 0, TAU); ctx.fill();
      ctx.strokeStyle = hueCss(t * 400, 95, 70); ctx.lineWidth = 2; for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + t * 8; ctx.beginPath(); ctx.moveTo(bl.x + Math.cos(a) * r, bl.y + Math.sin(a) * r); ctx.lineTo(bl.x + Math.cos(a + .4) * (r + 7), bl.y + Math.sin(a + .4) * (r + 7)); ctx.stroke(); }
      break;
    }
    case 'asSkull': {
      const open = bl.open ?? 1, appear = clamp(bl.age / .5), leave = clamp((bl.ttl - bl.age) / .4), shake = open > .9 ? (hash(Math.floor(t * 30)) - .5) * 4 : 0;
      const img = figure('skull', PX.SKULL_SIZE, PX.drawSkull, 0, { open }, { t }, `${open.toFixed(2)}|${Math.floor(t * 20)}`);
      const x = bl.x - PX.SKULL_SIZE.w + shake, y = bl.y - 84 + (1 - appear) * -40;
      glow(ctx, bl.x, bl.y + 66, 110 * open, 'rgba(150,120,255,.9)', open * appear);
      blit(ctx, img, x, y, 2, appear * leave);
      for (const ex of [47, 72]) glow(ctx, x + ex * 2, y + 32 * 2, 12, 'rgba(255,255,255,1)', appear * leave);
      break;
    }
    case 'asShard': {
      const a = Math.atan2(bl.vy, bl.vx), col = hueCss(bl.hue || 0, 90, 80); ctx.translate(bl.x, bl.y); ctx.rotate(a);
      ctx.fillStyle = hueCss(bl.hue || 0, 90, 70, .35); ctx.fillRect(-14, -1.5, 12, 3);
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(0, -4); ctx.lineTo(-6, 0); ctx.lineTo(0, 4); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(-1, -1, 2, 2); break;
    }
    case 'asSuck': { const k = clamp(bl.age / bl.ttl), x0 = bl.x + (bl.tx - bl.x) * k, y0 = bl.y + (bl.ty - bl.y) * k, x1 = bl.x + (bl.tx - bl.x) * Math.min(1, k + .25), y1 = bl.y + (bl.ty - bl.y) * Math.min(1, k + .25); ctx.strokeStyle = `rgba(210,200,255,${.5 * (1 - k)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); break; }
    case 'asRay': {
      // 사방에서 박스 한가운데로 빨려 드는 빛줄기: 머리는 밝고 꼬리는 투명하다
      const k = ease(clamp(bl.age / bl.ttl)), head = 380 * (1 - k) + 12, tail = head + 150, ca = Math.cos(bl.ang), sa = Math.sin(bl.ang), nx = -sa, ny = ca;
      const hx = bl.x + ca * head, hy = bl.y + sa * head, tx = bl.x + ca * tail, ty = bl.y + sa * tail, w = 2 + k * 5;
      const g = ctx.createLinearGradient(tx, ty, hx, hy); g.addColorStop(0, hueCss(bl.hue + t * 200, 95, 65, 0)); g.addColorStop(1, hueCss(bl.hue + t * 200, 95, 75, .9));
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx + nx * w, hy + ny * w); ctx.lineTo(hx - nx * w, hy - ny * w); ctx.fill();
      glow(ctx, hx, hy, 10 + k * 8, hueCss(bl.hue + t * 200, 95, 80, 1), .8); break;
    }
    case 'asFinal': {
      const bx = b.box, l = bx.x - bx.w / 2, tp = bx.y - bx.h / 2, k = clamp(bl.age / .5);
      ctx.beginPath(); ctx.rect(l - 3, tp - 3, bx.w + 6, bx.h + 6); ctx.clip();
      for (let i = 0; i < 12; i++) { ctx.fillStyle = hueCss(i * 30 + t * 400, 95, 62, .85 * k); ctx.fillRect(l + ((i * bx.w / 12 + t * 240) % bx.w), tp, bx.w / 12 + 1, bx.h); }
      glow(ctx, bx.x, bx.y, bx.w * .7, 'rgba(255,255,255,1)', .6 + Math.sin(t * 20) * .2);
      ctx.fillStyle = `rgba(255,255,255,${.25 + Math.sin(t * 13) * .15})`; ctx.fillRect(l, tp, bx.w, bx.h);
      break;
    }
    case 'asSpark': { ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bl.x - 5, bl.y - 6); ctx.lineTo(bl.x + 2, bl.y - 1); ctx.lineTo(bl.x - 2, bl.y + 1); ctx.lineTo(bl.x + 5, bl.y + 6); ctx.stroke(); glow(ctx, bl.x, bl.y, 12, 'rgba(255,230,90,.6)', 1); break; }
    case 'asTear': {
      if (bl.faded) { const k = clamp((bl.age - bl.fadeAt) / .35); ctx.globalAlpha = 1 - k; ctx.fillStyle = '#bff0ff'; for (let i = 0; i < 5; i++) { const a = i * TAU / 5 - Math.PI / 2; ctx.fillRect(bl.x + Math.cos(a) * k * 12, bl.y + Math.sin(a) * k * 12, 2, 2); } break; }
      glow(ctx, bl.x, bl.y, 14, 'rgba(140,220,255,.5)', 1);
      ctx.fillStyle = '#9fe6ff'; ctx.beginPath(); ctx.moveTo(bl.x, bl.y - 8); ctx.quadraticCurveTo(bl.x + 6, bl.y + 1, bl.x, bl.y + 5); ctx.quadraticCurveTo(bl.x - 6, bl.y + 1, bl.x, bl.y - 8); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(bl.x - 2, bl.y - 1, 2, 2); break;
    }
    default: ctx.restore(); return false;
  }
  if (bl.faded && bl.kind !== 'asTear') { ctx.globalAlpha = fadeK; ctx.fillStyle = '#fff6c8'; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + bl.age * 8, r = (1 - fadeK) * 14; ctx.fillRect(bl.x + Math.cos(a) * r, bl.y + Math.sin(a) * r, 2, 2); } }
  ctx.restore(); return true;
}
function drawSaber(ctx, bl, t, b) {
  const col = a => bl.rainbow ? hueCss(t * 260 + a * 400, 95, 68) : '#cfe9ff';
  if (bl.warn) {
    // 휩쓸 영역: 박스 안에만 붉은 부채꼴을 칠하고, 칼끝이 멈출 자리를 점선으로 알린다
    const k = clamp(bl.age / bl.warnT), flick = .5 + Math.sin(t * 30) * .5, bx = b.box;
    ctx.save(); ctx.beginPath(); ctx.rect(bx.x - bx.w / 2, bx.y - bx.h / 2, bx.w, bx.h); ctx.clip();
    ctx.fillStyle = `rgba(255,60,80,${.12 + k * .2 * (.7 + flick * .3)})`; ctx.beginPath(); ctx.moveTo(bl.px, bl.py);
    const a0 = bl.a0, a1 = bl.a1; ctx.arc(bl.px, bl.py, bl.len, Math.min(a0, a1), Math.max(a0, a1)); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(255,120,130,${.3 + k * .5 * flick})`; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 40;
    ctx.beginPath(); ctx.moveTo(bl.px, bl.py); ctx.lineTo(bl.px + Math.cos(a1) * bl.len, bl.py + Math.sin(a1) * bl.len); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    // 칼자루가 모습을 드러낸다
    drawHilt(ctx, bl, a0, clamp(k * 2), t);
    return;
  }
  const k = bl.k ?? 1, after = clamp((bl.age - bl.warnT - bl.sweep) / .32);
  // 휩쓴 자취: 부채꼴 잔상
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const steps = 7; for (let i = 0; i < steps; i++) { const a = bl.a0 + (bl.a - bl.a0) * (i / steps); ctx.strokeStyle = bl.rainbow ? hueCss(t * 260 + i * 40, 95, 65, .08 * (i + 1) * (1 - after)) : `rgba(190,225,255,${.06 * (i + 1) * (1 - after)})`; ctx.lineWidth = bl.width; ctx.beginPath(); ctx.moveTo(bl.px + Math.cos(a) * 30, bl.py + Math.sin(a) * 30); ctx.lineTo(bl.px + Math.cos(a) * bl.len, bl.py + Math.sin(a) * bl.len); ctx.stroke(); }
  ctx.restore();
  // 칼날
  ctx.save(); ctx.globalAlpha *= 1 - after; ctx.translate(bl.px, bl.py); ctx.rotate(bl.a);
  const len = bl.len, w = bl.width;
  const g = ctx.createLinearGradient(40, 0, len, 0); for (let i = 0; i <= 5; i++) g.addColorStop(i / 5, col(i / 5));
  ctx.fillStyle = '#07060c'; ctx.beginPath(); ctx.moveTo(40, -w / 2 - 2); ctx.lineTo(len - 20, -w / 2 - 2); ctx.lineTo(len + 6, 0); ctx.lineTo(len - 20, w / 2 + 2); ctx.lineTo(40, w / 2 + 2); ctx.fill();
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(40, -w / 2); ctx.lineTo(len - 22, -w / 2); ctx.lineTo(len, 0); ctx.lineTo(len - 22, w / 2); ctx.lineTo(40, w / 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fillRect(44, -1.5, len - 70, 3);
  ctx.restore();
  drawHilt(ctx, bl, bl.a, 1 - after, t);
  glow(ctx, bl.px + Math.cos(bl.a) * bl.len * .6, bl.py + Math.sin(bl.a) * bl.len * .6, 60, bl.rainbow ? hueCss(t * 260, 95, 60, .5) : 'rgba(180,220,255,.4)', (1 - after) * (k < 1 ? 1 : .5));
}
function drawHilt(ctx, bl, a, alpha, t) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(bl.px, bl.py); ctx.rotate(a);
  ctx.fillStyle = '#07060c'; ctx.fillRect(-4, -5, 44, 10); ctx.fillStyle = '#3d3458'; ctx.fillRect(-2, -3, 40, 6);
  ctx.fillStyle = '#07060c'; ctx.fillRect(32, -15, 10, 30); ctx.fillStyle = '#f0c75e'; ctx.fillRect(34, -13, 6, 26);
  ctx.fillStyle = hueCss(t * 300, 95, 65); ctx.fillRect(35, -2, 4, 4);
  ctx.restore();
}
function drawBolt(ctx, bl, t) {
  const v = bl.orient === 'v', thick = v ? bl.w : bl.h, cx = bl.x, cy = bl.y;
  if (bl.warn) {
    const k = clamp(bl.age / bl.warnT), flick = Math.floor(t * 20) % 2 ? 1 : .55;
    ctx.fillStyle = `rgba(255,235,120,${(.05 + k * .12) * flick})`;
    if (v) ctx.fillRect(cx - thick / 2, 0, thick, 480); else ctx.fillRect(0, cy - thick / 2, 640, thick);
    ctx.strokeStyle = `rgba(255,236,140,${(.35 + k * .5) * flick})`; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); if (v) { ctx.moveTo(cx - thick / 2, 0); ctx.lineTo(cx - thick / 2, 480); ctx.moveTo(cx + thick / 2, 0); ctx.lineTo(cx + thick / 2, 480); } else { ctx.moveTo(0, cy - thick / 2); ctx.lineTo(640, cy - thick / 2); ctx.moveTo(0, cy + thick / 2); ctx.lineTo(640, cy + thick / 2); } ctx.stroke(); ctx.setLineDash([]);
    // 구름 속에서 모이는 전하
    const sx = v ? cx : 8, sy = v ? 6 : cy; glow(ctx, sx, sy, 16 + k * 20, 'rgba(255,240,160,1)', k);
    return;
  }
  const k = clamp((bl.age - bl.warnT) / (bl.strike + .22)), alpha = 1 - k * k;
  const seed = bl.seed + Math.floor(bl.age * 28);
  const pts = []; const n = 22;
  for (let i = 0; i <= n; i++) { const along = -40 + i * (v ? 560 : 720) / n, j = (hash(i, seed) - .5) * thick * .9; pts.push(v ? [cx + j, along] : [along, cy + j]); }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= alpha;
  const layer = (width, style) => { ctx.strokeStyle = style; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); };
  layer(thick * 1.1, 'rgba(255,220,80,.22)'); layer(thick * .5, 'rgba(255,240,150,.6)'); layer(4, '#ffffff');
  // 갈래 번개
  for (let bI = 0; bI < 4; bI++) { const i = 3 + Math.floor(hash(bI, seed + 9) * (n - 6)); const [x0, y0] = pts[i]; ctx.strokeStyle = 'rgba(255,245,180,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y0); let x = x0, y = y0; for (let s = 0; s < 3; s++) { const d = (hash(bI * 7 + s, seed) - .5) * 26; if (v) { x += (bI % 2 ? 1 : -1) * (8 + s * 5); y += 12 + d * .3; } else { y += (bI % 2 ? 1 : -1) * (8 + s * 5); x += 12 + d * .3; } ctx.lineTo(x, y); } ctx.stroke(); }
  ctx.restore();
  if (k < .3) { ctx.fillStyle = `rgba(255,255,230,${(.3 - k) * .6})`; ctx.fillRect(0, 0, 640, 480); }
}
// 잃어버린 영혼이 머뭇거릴 때 기존 탄막(창, 뼈, 불꽃)도 사라지며 반짝이게 한다.
export function fadeAlpha(bl) { return bl.faded ? clamp(1 - (bl.age - (bl.fadeAt || 0)) / .35) : bl.softened ? .25 : 1; }

// ---------- 연출 오버레이 ----------
export function drawOverlay(ctx, b, t, rm, api) {
  const A = b.asr, c = A.cine;
  // 희망: 영혼 둘레의 금빛 고리
  if (b.mode === 'dodge' && A.hope) { ctx.save(); ctx.strokeStyle = `rgba(255,220,110,${.5 + Math.sin(t * 8) * .25})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.soul.x, b.soul.y, 13 + Math.sin(t * 6) * 2, 0, TAU); ctx.stroke(); ctx.restore(); glow(ctx, b.soul.x, b.soul.y, 26, 'rgba(255,210,90,.6)', 1); }
  // 마지막 공격의 빛 속에서도 영혼은 보인다 (금이 가며 떨린다)
  if (b.mode === 'dodge' && b.bullets.some(x => x.kind === 'asFinal')) {
    const p = b.player, crack = 1 - p.hp / p.maxHp, sx = (hash(Math.floor(t * 40)) - .5) * crack * 4;
    pixelHeart(ctx, b.soul.x + sx, b.soul.y, 8, '#ff2a2a'); if (crack > .4) { ctx.fillStyle = '#000'; ctx.fillRect(b.soul.x + sx - 1, b.soul.y - 5, 2, 4); ctx.fillRect(b.soul.x + sx, b.soul.y - 1, 2, 4); }
  }
  // 공격 결과 숫자는 베기 효과 위에 그린다
  const d = b.lastDamage;
  if (d && d.t < 1.2 && (A.phase === 'god' || A.phase === 'final') && !c) {
    const rise = Math.min(1, d.t * 3) * 20, miss = d.label === 'MISS';
    label(ctx, miss ? 'MISS' : String(d.raw ?? d.dmg), 320, 200 - rise, { size: 26, align: 'center', bold: true, color: miss ? '#c8c8c8' : '#ff3a3a', outline: '#000' });
  }
  // 공격 이름: 라운드 시작 1.6초 동안 위쪽에 새겨진다
  if (b.mode === 'dodge' && b.attack && ATTACK_NAMES[b.attack.name] && b.attack.t < 1.8) {
    const k = b.attack.t, a = clamp(k / .25) * clamp((1.8 - k) / .4), str = '✦ ' + ATTACK_NAMES[b.attack.name] + ' ✦';
    ctx.save(); ctx.font = `12px ${FONT}`; const tw = ctx.measureText(str).width + str.length * 2 + 28; ctx.globalAlpha = a * .7; ctx.fillStyle = '#000'; ctx.fillRect(320 - tw / 2, 14, tw, 22); ctx.globalAlpha = a; ctx.fillStyle = A.phase === 'final' ? hueCss(t * 200, 90, 70) : '#b8a06a'; ctx.fillRect(320 - tw / 2, 14, tw, 1); ctx.fillRect(320 - tw / 2, 35, tw, 1); ctx.restore();
    label(ctx, str, 320, 19, { size: 12, align: 'center', color: A.phase === 'final' ? hueCss(t * 200, 90, 80) : '#f5e6b8', alpha: a, spacing: 2 });
  }
  if (!c) return;
  const k = c.t;
  switch (c.kind) {
    case 'intro': {
      // 박스와 HUD를 가리는 어둠, 번쩍임, 이름 카드
      ctx.fillStyle = `rgba(0,0,0,${1 - segment(k, 3.4, 5.4)})`; ctx.fillRect(0, 240, W, 240);
      ctx.fillStyle = `rgba(0,0,0,${k < 1.5 ? .55 : 0})`; ctx.fillRect(0, 0, W, 240);
      const flash = k >= 1.5 ? 1 - segment(k, 1.5, 2.3) : 0; if (flash > 0 && !rm) { ctx.fillStyle = `rgba(255,255,255,${flash})`; ctx.fillRect(0, 0, W, H); }
      if (k > 1.5 && k < 3.2) for (let i = 0; i < 24; i++) { const a = i * TAU / 24, r = segment(k, 1.5, 3.2) * 420, x = 320 + Math.cos(a) * r, y = 130 + Math.sin(a) * r * .7; ctx.fillStyle = hueCss(i * 15 + t * 100, 95, 70, 1 - segment(k, 1.5, 3.2)); ctx.fillRect(x, y, 4, 4); }
      if (k > 3) titleCard(ctx, t, segment(k, 3, 3.6) * (1 - segment(k, 4.9, 5.5)), '아스리엘 드리무르', 'ASRIEL DREEMURR · 모든 영혼의 절대신', false);
      break;
    }
    case 'transform': {
      const white = segment(k, 1.6, 2.4) * (1 - segment(k, 2.6, 3.6));
      if (white > 0) { ctx.fillStyle = `rgba(255,255,255,${rm ? white * .5 : white})`; ctx.fillRect(0, 0, W, H); }
      if (k > 2.4 && k < 4) { const r = segment(k, 2.4, 4); for (let i = 0; i < 36; i++) { const a = i * TAU / 36 + hash(i), d = r * (300 + hash(i, 2) * 200); ctx.save(); ctx.translate(320 + Math.cos(a) * d, 130 + Math.sin(a) * d * .8); ctx.rotate(a + t * 4); ctx.fillStyle = hueCss(i * 10 + t * 200, 95, 66, 1 - r); ctx.fillRect(-5, -2, 10, 4); ctx.restore(); } }
      if (k > 3.7) titleCard(ctx, t, segment(k, 3.7, 4.3) * (1 - segment(k, 5.9, 6.5)), '최후의 형태', 'ASRIEL DREEMURR · FINAL FORM', true);
      break;
    }
    case 'refuseSmall': {
      const x = c.x ?? 320, y = c.y ?? 320, crack = segment(k, .2, .5), mend = segment(k, 1.2, 1.9);
      ctx.fillStyle = `rgba(0,0,0,${.6 * (1 - segment(k, 2.2, 2.8))})`; ctx.fillRect(0, 0, W, H);
      const split = crack * (1 - mend) * 4;
      drawSplitHeart(ctx, x, y, 10, split, crack * (1 - mend), t);
      if (mend > 0) { glow(ctx, x, y, 30 + mend * 40, 'rgba(255,215,110,1)', mend * (1 - segment(k, 2, 2.8))); ctx.strokeStyle = `rgba(255,226,140,${1 - mend})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 12 + mend * 50, 0, TAU); ctx.stroke(); }
      break;
    }
    case 'refuse': drawRefuse(ctx, b, t, k, rm, api); break;
    case 'soulFocus': { const k2 = segment(k, 0, 1.4); for (let i = 0; i < 14; i++) { const y = hash(i, Math.floor(t * 20)) * 240; ctx.fillStyle = `rgba(200,210,255,${.15 * (1 - k2)})`; ctx.fillRect(0, y, W, 1); } break; }
    case 'soulSaved': { const flash = segment(k, .4, .7) * (1 - segment(k, .7, 1.4)); if (flash > 0) { ctx.fillStyle = `rgba(255,250,230,${flash * (rm ? .2 : .45)})`; ctx.fillRect(0, 0, W, H); } break; }
    case 'finale': {
      const white = segment(k, 1.9, 2.6) * (1 - segment(k, 2.9, 4.2));
      ctx.fillStyle = `rgba(0,0,0,${segment(k, 2.4, 2.7) * (1 - segment(k, 7.4, 9))})`; ctx.fillRect(0, 232, W, 248);
      if (white > 0) { ctx.fillStyle = `rgba(255,255,255,${rm ? white * .5 : white})`; ctx.fillRect(0, 0, W, H); }
      break;
    }
  }
}
function titleCard(ctx, t, a, name, sub, rainbow) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(0,0,0,.92)'; ctx.fillRect(0, 244, W, 236);
  const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.25, 'rgba(0,0,0,.72)'); g.addColorStop(.75, 'rgba(0,0,0,.72)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 300, W, 96);
  const lg = ctx.createLinearGradient(80, 0, 560, 0); for (let i = 0; i <= 6; i++) lg.addColorStop(i / 6, rainbow ? hueCss(i * 60 + t * 120, 90, 70) : `rgba(245,230,184,${i === 0 || i === 6 ? 0 : 1})`);
  ctx.fillStyle = lg; ctx.fillRect(80, 306, 480, 1); ctx.fillRect(80, 389, 480, 1);
  label(ctx, name, 320, 318, { size: 34, align: 'center', bold: true, color: '#fff', shadow: rainbow ? hueCss(t * 200, 90, 45) : '#6b5320', spacing: 6 });
  label(ctx, sub, 320, 364, { size: 11, align: 'center', color: rainbow ? hueCss(t * 150, 80, 80) : '#d9c38e', spacing: 3 });
  ctx.restore();
}
function drawSplitHeart(ctx, x, y, r, split, crack) {
  ctx.save(); ctx.beginPath(); ctx.rect(x - 40, y - 40, 40, 80); ctx.clip(); pixelHeart(ctx, x - split, y, r, '#ff2a2a'); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(x, y - 40, 40, 80); ctx.clip(); pixelHeart(ctx, x + split, y, r, '#ff2a2a'); ctx.restore();
  if (crack > 0 && split < 1) { ctx.fillStyle = '#000'; const u = r / 4; for (const [dx, dy] of [[0, -2], [-1, -1], [0, 0], [-1, 1], [0, 2]]) ctx.fillRect(x + dx * u, y + dy * u, u, u); }
}
function drawRefuse(ctx, b, t, k, rm, api) {
  // 0~0.7 영혼만 남는다 · 0.7 금 · 1.3 산산조각 · 1.3~2.8 어둠 · 2.8 문장 · 4.3 조각이 모여 다시 붙는다 · 5.5 구하기
  const x = 320, y = 320, darkness = segment(k, 0, .6);
  ctx.fillStyle = `rgba(0,0,0,${.92 * darkness})`; ctx.fillRect(0, 0, W, H);
  const shards = k >= 1.3 && k < 4.3, mend = segment(k, 3.6, 4.3);
  if (!shards) {
    const crack = segment(k, .7, .9), size = 12 + (k >= 4.3 ? Math.max(0, 1 - (k - 4.3) * 2) * 6 : 0);
    const shake = k > .7 && k < 1.3 && !rm ? (hash(Math.floor(t * 40)) - .5) * 3 : 0;
    drawSplitHeart(ctx, x + shake, y, size, k < 4.3 ? crack * 2 : 0, k < 4.3 ? crack : 0, t);
    if (k >= 4.3) { const g = segment(k, 4.3, 5.4); glow(ctx, x, y, 40 + g * 120, 'rgba(255,215,120,1)', 1 - g * .7); ctx.strokeStyle = `rgba(255,236,160,${1 - g})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 14 + g * 140, 0, TAU); ctx.stroke(); }
  } else {
    // 조각: 흩어졌다가 결의로 되돌아온다
    const scatter = ease(segment(k, 1.3, 2)), back = ease(mend);
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * .5 + hash(i, 4) * .3, d = scatter * (40 + hash(i, 8) * 60) * (1 - back), fall = scatter * (1 - back) * (20 + i * 6) * segment(k, 1.6, 3.6);
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d + fall;
      ctx.save(); ctx.translate(px, py); ctx.rotate((1 - back) * (i - 3) * .8 + t * (1 - back)); ctx.fillStyle = back > 0 ? `rgb(255,${42 + back * 170},${42 + back * 40})` : '#ff2a2a';
      ctx.beginPath(); ctx.moveTo(-4, -3); ctx.lineTo(4, -4); ctx.lineTo(2, 4); ctx.lineTo(-3, 3); ctx.fill(); ctx.restore();
    }
  }
  if (k > 2.8) {
    const shown = Math.floor(segment(k, 2.8, 3.8) * 18), str = '하지만 영혼이 거부했다.'.slice(0, shown), fade = 1 - segment(k, 6.4, 7.2);
    label(ctx, str, 320, 176, { size: 26, align: 'center', bold: true, color: '#fff', alpha: fade, shadow: '#5a0000', spacing: 2 });
  }
  if (k > 5.2) {
    const s = segment(k, 5.2, 6.2);
    label(ctx, '무언가를 구할 수 있을 것 같다.', 320, 220, { size: 14, align: 'center', color: '#f5e6b8', alpha: s * (1 - segment(k, 6.4, 7.2)) });
    api.drawButtons(ctx, b, t, s);
  }
}

// ---------- 버튼 ----------
// render.mjs 의 버튼 모양을 따르되, 3막에서는 발버둥(흐림)과 구하기(금빛, 무지개 테두리)로 바뀐다.
export function drawButtons(ctx, b, t, api, alpha = 1) {
  const list = b.asr.phase === 'save' || b.asr.phase === 'end' || (b.asr.cine?.kind === 'refuse' && b.asr.cine.t > 5.2) ? [{ id: 'fight', label: '발버둥', en: 'STRUGGLE', dim: true }, { id: 'act', label: '행동', en: 'ACT' }, { id: 'item', label: '아이템', en: 'ITEM' }, { id: 'mercy', label: '구하기', en: 'SAVE', glow: true, morph: b.asr.cine?.kind === 'refuse' ? segment(b.asr.cine.t, 5.2, 6.6) : b.asr.morph || 1 }]
    : [{ id: 'fight', label: '공격', en: 'FIGHT' }, { id: 'act', label: '행동', en: 'ACT' }, { id: 'item', label: '아이템', en: 'ITEM' }, { id: 'mercy', label: '자비', en: 'MERCY' }];
  ctx.save(); ctx.globalAlpha = alpha;
  list.forEach((bt, i) => {
    const x = 32 + i * 146, y = 432, w = 138, h = 40;
    const sel = (b.mode === 'menu' && b.menu === i) || (b.mode !== 'menu' && b.mode !== 'dodge' && b.lastAction === bt.id);
    let edge = sel ? '#ffd76a' : '#f08a24', fill = sel ? '#27190d' : '#080605', ink = sel ? '#ffd76a' : '#f08a24';
    if (bt.dim) { edge = sel ? '#b9ad96' : '#6d6559'; ink = sel ? '#d8cdb8' : '#8a8173'; fill = '#070605'; }
    const morph = bt.morph ?? 1;
    ctx.lineWidth = 3; ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
    if (bt.glow) {
      // 구하기: 무지개빛 테두리와 금빛 광택. 자비 버튼에서 녹아내리듯 바뀐다.
      glow(ctx, x + w / 2, y + h / 2, 90, `rgba(255,214,110,${.25 + Math.sin(t * 3) * .1})`, morph);
      const g = ctx.createLinearGradient(x, y, x + w, y + h); for (let j = 0; j <= 6; j++) g.addColorStop(j / 6, hueCss(j * 60 + t * 160, 95, 66));
      ctx.strokeStyle = morph < 1 ? '#f08a24' : g; ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
      if (morph < 1) { ctx.save(); ctx.globalAlpha *= morph; ctx.strokeStyle = g; ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3); ctx.restore(); }
      const sweep = (t * .6) % 1.6; if (sweep < 1) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.moveTo(x + sweep * (w + 40) - 30, y); ctx.lineTo(x + sweep * (w + 40) - 10, y); ctx.lineTo(x + sweep * (w + 40) - 40, y + h); ctx.lineTo(x + sweep * (w + 40) - 60, y + h); ctx.fill(); ctx.restore(); }
      // 글자: 자비 → 구하기. 가운데에서 가로 줄이 어긋나며 바뀐다.
      if (morph < 1) {
        const slip = (1 - morph) * 6, split = y + 6 + Math.round(morph * 18);
        ctx.save(); ctx.beginPath(); ctx.rect(x, split, w, h); ctx.clip(); api.text(ctx, '자비', x + 40 + (hash(Math.floor(t * 30)) - .5) * slip, y + 6, { size: 15, color: '#f08a24', bold: true }); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, split - y); ctx.clip(); api.text(ctx, '구하기', x + 40, y + 6, { size: 15, color: '#ffe38a', bold: true }); ctx.restore();
        ctx.fillStyle = `rgba(255,236,160,${1 - morph})`; ctx.fillRect(x + 6, split, w - 12, 1);
      }
      else { api.text(ctx, bt.label, x + 40, y + 6, { size: 15, color: '#ffe38a', bold: true }); }
      api.text(ctx, bt.en, x + 40, y + 24, { size: 9, color: morph < 1 ? '#f08a24' : hueCss(t * 160, 90, 78) });
      for (let j = 0; j < 3; j++) { const a = t * 2 + j * 2.1, sx = x + w / 2 + Math.cos(a) * (w / 2 + 2), sy = y + h / 2 + Math.sin(a) * (h / 2 + 2); ctx.fillStyle = `rgba(255,240,180,${morph * .9})`; ctx.fillRect(sx - 1, sy - 1, 2, 2); }
    } else {
      ctx.strokeStyle = edge; ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
      api.text(ctx, bt.label, x + 40, y + 6, { size: 15, color: ink, bold: true }); api.text(ctx, bt.en, x + 40, y + 24, { size: 9, color: ink });
      if (bt.dim) { ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 18, y + 3); ctx.lineTo(x + 26, y + 16); ctx.lineTo(x + 21, y + 24); ctx.lineTo(x + 30, y + 37); ctx.stroke(); }
    }
    if (b.mode === 'menu' && b.menu === i) api.heart(ctx, x + 22, y + 21, 7, '#ff2a2a');
  });
  ctx.restore();
}
