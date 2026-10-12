// SANS · 심판의 회랑 — 화면 그리기 (Canvas 2D, 논리 해상도 640×480)
import * as C from './core.mjs';
import * as A from './art.mjs';
import * as L from './lines.mjs';

const W = C.W, H = C.H;
const FONT = 'Galmuri11, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const hash = (i, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
let reduced = false;
export function setReducedMotion(value) { reduced = value; }

// ---------- 그림 조각 ----------
const baked = new Map();
function bake(key, make, tint = null) {
  const id = key + (tint ? '|' + tint : '');
  let canvas = baked.get(id);
  if (!canvas) {
    const raster = make();
    canvas = document.createElement('canvas'); canvas.width = raster.w; canvas.height = raster.h;
    const context = canvas.getContext('2d'), image = context.createImageData(raster.w, raster.h);
    image.data.set(A.toRGBA(raster, tint)); context.putImageData(image, 0, 0);
    baked.set(id, canvas);
  }
  return canvas;
}
function text(ctx, str, x, y, { size = 16, color = '#fff', align = 'left', bold = false, alpha = 1, spacing = 0 } = {}) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'top';
  if ('letterSpacing' in ctx) ctx.letterSpacing = spacing + 'px';
  ctx.fillStyle = color; ctx.fillText(str, Math.round(x), Math.round(y)); ctx.restore();
}
function wrap(ctx, str, maxWidth, size, bold = false) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
  const lines = []; let line = '';
  for (const word of str.split(' ')) {
    const joined = line ? line + ' ' + word : word;
    if (ctx.measureText(joined).width <= maxWidth) { line = joined; continue; }
    if (line) lines.push(line);
    line = word;
    while (ctx.measureText(line).width > maxWidth) { let cut = line.length - 1; while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxWidth) cut--; lines.push(line.slice(0, cut)); line = line.slice(cut); }
  }
  if (line) lines.push(line);
  return lines;
}
// 줄바꿈은 완성된 문장 기준으로 잡고, 그 위에 찍힌 글자 수만큼만 보여 준다.
function typed(ctx, str, shown, x, y, maxWidth, { size = 16, color = '#fff', gap = 8, bold = false } = {}) {
  let left = Math.floor(shown), row = 0;
  for (const line of wrap(ctx, str, maxWidth, size, bold)) {
    if (left <= 0) break;
    text(ctx, line.slice(0, left), x, y + row * (size + gap), { size, color, bold });
    left -= line.length + 1; row++;
  }
}
const HEART = ['01100110', '11111111', '11111111', '11111111', '01111110', '00111100', '00011000'];
function heart(ctx, x, y, color, { scale = 2, rotate = 0, alpha = 1 } = {}) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(Math.round(x), Math.round(y)); if (rotate) ctx.rotate(rotate); ctx.fillStyle = color;
  HEART.forEach((row, j) => { for (let i = 0; i < 8; i++) if (row[i] === '1') ctx.fillRect((i - 4) * scale, (j - 3.5) * scale, scale, scale); });
  ctx.restore();
}
// 뼈: (x, y) 가 중심. 긴 쪽이 길이고, 양 끝에 마디가 둘씩 달린다.
function bone(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  if (h >= w) {
    const l = Math.round(x - w / 2), t = Math.round(y - h / 2), cap = Math.min(5, h / 2);
    ctx.fillRect(l + 2, t + 2, w - 4, Math.max(0, h - 4));
    ctx.fillRect(l, t, 4, cap); ctx.fillRect(l + w - 4, t, 4, cap); ctx.fillRect(l, t + h - cap, 4, cap); ctx.fillRect(l + w - 4, t + h - cap, 4, cap);
  } else {
    const l = Math.round(x - w / 2), t = Math.round(y - h / 2), cap = Math.min(5, w / 2);
    ctx.fillRect(l + 2, t + 2, Math.max(0, w - 4), h - 4);
    ctx.fillRect(l, t, cap, 4); ctx.fillRect(l, t + h - 4, cap, 4); ctx.fillRect(l + w - cap, t, cap, 4); ctx.fillRect(l + w - cap, t + h - 4, cap, 4);
  }
}
const BONE_COLOR = { white: '#ffffff', blue: '#22b4ff' };

// ---------- 회랑 ----------
// warmth 1 이면 금빛 저녁, 0 이면 차갑게 식은 푸른빛. light 는 전체 밝기.
function hall(ctx, t, light, warmth) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (light <= 0) return;
  const tone = (a, lift = 0) => `rgba(${Math.round(120 + 135 * warmth + lift)},${Math.round(150 + 58 * warmth)},${Math.round(255 - 150 * warmth)},${a * light})`;
  const sky = ctx.createLinearGradient(0, 0, 0, 250);
  sky.addColorStop(0, tone(.2)); sky.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, 250);
  // 높은 창과 비스듬히 떨어지는 빛
  for (let i = 0; i < 4; i++) {
    const x = 96 + i * 150;
    ctx.fillStyle = tone(.2); ctx.fillRect(x, 34, 48, 118); ctx.fillRect(x + 6, 24, 36, 10); ctx.fillRect(x + 14, 16, 20, 8);
    ctx.fillStyle = tone(.16); for (let k = 0; k < 4; k++) { ctx.fillRect(x + 22, 40 + k * 28, 4, 18); ctx.fillRect(x + 8 + (k % 2) * 22, 50 + k * 26, 10, 3); }
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x + 23, 16, 2, 136); ctx.fillRect(x, 92, 48, 2);
    ctx.fillStyle = tone(.055);
    ctx.beginPath(); ctx.moveTo(x, 152); ctx.lineTo(x + 48, 152); ctx.lineTo(x + 118, 238); ctx.lineTo(x + 40, 238); ctx.fill();
  }
  // 기둥
  for (let i = 0; i < 5; i++) {
    const x = 22 + i * 150 - (i > 1 ? 4 : 0);
    ctx.fillStyle = tone(.13); ctx.fillRect(x, 0, 30, 238);
    ctx.fillStyle = tone(.2); ctx.fillRect(x - 5, 0, 40, 12); ctx.fillRect(x - 5, 226, 40, 12); ctx.fillRect(x - 2, 12, 34, 4);
    ctx.fillStyle = tone(.22, 0); ctx.fillRect(x + 3, 16, 2, 210);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x + 22, 16, 5, 210);
  }
  // 바닥 타일
  ctx.fillStyle = tone(.3); ctx.fillRect(0, 238, W, 1);
  for (let i = 0; i < 16; i++) { ctx.fillStyle = tone(i % 2 ? .05 : .1); ctx.fillRect(i * 40, 239, 40, 5); }
  // 빛 속을 떠다니는 먼지
  for (let i = 0; i < 18; i++) {
    const x = (hash(i, 1) * W + (reduced ? 0 : t * (4 + hash(i, 2) * 6))) % W, y = 30 + hash(i, 3) * 190 + (reduced ? 0 : Math.sin(t * .6 + i) * 6);
    ctx.fillStyle = tone(.25 + .25 * Math.sin(t * 1.3 + i * 2)); ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
  }
}

// ---------- 샌즈 ----------
function sansImage(pose) { return bake(`sans|${pose.face}|${pose.arm}|${pose.sweat}|${pose.gash}|${pose.flicker}|${pose.breath}`, () => A.drawSans(pose)); }
function drawSans(ctx, g, t, { floor = C.sansFloor(g), x = 320, face = null, alpha = 1 } = {}) {
  const s = g.sans; if (s.hidden) return;
  const glowing = s.eye > 0 && g.mode === 'dodge' && s.face !== 'hurt' && s.face !== 'sleep';
  const pose = { face: face || (glowing ? 'glow' : s.face), arm: s.arm, sweat: s.sweat, gash: s.gash, flicker: 0, breath: 0 };
  pose.flicker = pose.face === 'glow' && !reduced ? Math.floor(t * 14) % 2 : 0;
  pose.breath = !reduced && pose.face !== 'sleep' && Math.floor(t * (s.sweat ? 2.6 : 1.4)) % 2 ? 1 : 0;
  const image = sansImage(pose), walk = s.walk * 118, bob = s.walk > 0 && !reduced ? -Math.abs(Math.sin(s.walk * 8)) * 3 : 0;
  const left = Math.round(x + s.dx + walk - A.SANS.cx * 2), top = Math.round(floor - A.SANS.feet * 2 + bob);
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = alpha * clamp(1 - (s.walk - 2.4) / .8);
  // 피할 때 남는 잔상
  if (s.dodgeT >= 0 && s.dodgeT < .4 && !reduced) for (let i = 1; i <= 3; i++) { ctx.globalAlpha = alpha * .22 * (1 - s.dodgeT / .4) / i; ctx.drawImage(image, left + i * 22 * (1 - s.dodgeT / .4), top, image.width * 2, image.height * 2); }
  ctx.globalAlpha = alpha * clamp(1 - (s.walk - 2.4) / .8);
  ctx.drawImage(image, left, top, image.width * 2, image.height * 2);
  ctx.restore();
  // 눈에서 피어오르는 불꽃
  if (pose.face === 'glow' && !reduced) {
    const ex = left + (A.SANS.cx + 7) * 2, ey = top + 30;
    for (let i = 0; i < 5; i++) { const k = (t * 3 + i / 5) % 1; ctx.fillStyle = `rgba(${pose.flicker ? '255,233,74' : '57,213,255'},${.7 * (1 - k)})`; ctx.fillRect(Math.round(ex + 6 + k * 10 + Math.sin(t * 20 + i) * 2), Math.round(ey - k * 22), 4 - Math.floor(k * 3), 4 - Math.floor(k * 3)); }
  }
  // 잠
  if (pose.face === 'sleep') for (let i = 0; i < 3; i++) { const k = ((reduced ? .4 : t * .45) + i / 3) % 1; text(ctx, 'Z', left + 108 + k * 34 + Math.sin(k * 6) * 4, top + 26 - k * 46, { size: 11 + Math.round(k * 9), color: '#dfe6ff', alpha: (1 - k) * alpha, bold: true }); }
  return { left, top };
}
function bubble(ctx, str, shown, anchorX, anchorY) {
  const size = 14, lines = wrap(ctx, str, 204, size), w = 230, h = 22 + lines.length * 20, x = Math.min(W - w - 8, anchorX + 26), y = Math.max(8, anchorY - 8);
  ctx.fillStyle = '#fff'; ctx.fillRect(x + 4, y, w - 8, h); ctx.fillRect(x, y + 4, w, h - 8); ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.beginPath(); ctx.moveTo(x + 1, y + 20); ctx.lineTo(x - 16, y + 30); ctx.lineTo(x + 1, y + 38); ctx.fill();
  typed(ctx, str, shown, x + 13, y + 12, 204, { size, color: '#000', gap: 6 });
}

// ---------- 탄막 ----------
function drawBullet(ctx, b, B, t) {
  if (b.kind === 'bone') return bone(ctx, b.x, b.y, b.w, b.h, BONE_COLOR[b.color] || '#fff');
  if (b.kind === 'plat') {
    const l = Math.round(b.x - b.w / 2), y = Math.round(b.y);
    ctx.fillStyle = '#fff'; ctx.fillRect(l, y, b.w, 7); ctx.fillStyle = '#000'; ctx.fillRect(l + 2, y + 2, b.w - 4, 3); ctx.fillStyle = '#62e37a'; ctx.fillRect(l + 2, y + 2, b.w - 4, 1);
    return;
  }
  if (b.kind === 'stab' || b.kind === 'sea') {
    const side = b.kind === 'sea' ? 'bottom' : b.side;
    if (b.age < b.warnT) {
      // 곧 가시가 솟을 자리
      const zone = C.stabRect({ side, cur: b.depth }, B), on = reduced || Math.floor(t * 14) % 2;
      ctx.fillStyle = on ? 'rgba(255,40,60,.22)' : 'rgba(255,40,60,.08)'; ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
      ctx.strokeStyle = '#ff2c44'; ctx.lineWidth = 2; ctx.strokeRect(zone.x + 2, zone.y + 2, zone.w - 4, zone.h - 4);
      if (on) text(ctx, '!', zone.x + zone.w / 2, zone.y + zone.h / 2 - 9, { size: 16, color: '#ff2c44', align: 'center', bold: true });
      return;
    }
    if (b.cur < 3) return;
    if (side === 'bottom' || side === 'top') for (let x = B.l + 7; x <= B.r - 5; x += 12) bone(ctx, x, side === 'bottom' ? B.b - b.cur / 2 + 3 : B.t + b.cur / 2 - 3, 10, b.cur + 6, '#fff');
    else for (let y = B.t + 7; y <= B.b - 5; y += 12) bone(ctx, side === 'left' ? B.l + b.cur / 2 - 3 : B.r - b.cur / 2 + 3, y, b.cur + 6, 10, '#fff');
  }
}
function drawBlaster(ctx, b, t) {
  const fire = b.age - b.delay, opening = clamp((b.age - (b.delay - .24)) / .24), frame = opening < .25 ? 0 : opening < .8 ? .5 : 1, charge = fire >= 0 ? 1 : opening > 0 ? .5 : 0;
  const image = bake(`gb|${frame}|${charge}`, () => A.drawBlaster(frame, charge)), scale = b.size > 1 ? 3 : 2;
  const alpha = fire > b.hold ? clamp(1 - (fire - b.hold) / .4) : clamp(b.age / .12), spin = b.age < .3 && !reduced ? (1 - b.age / .3) ** 2 * 5 : 0;
  // 겨누는 선: 빔이 지나갈 자리를 미리 흐리게 보여 준다
  if (fire < 0 && b.age > .16) {
    const reach = 14 * b.size, cos = Math.cos(b.ang), sin = Math.sin(b.ang), half = (b.size > 1 ? 21 : 12) * .85;
    ctx.save(); ctx.translate(b.tx + cos * reach, b.ty + sin * reach); ctx.rotate(b.ang);
    ctx.fillStyle = `rgba(255,255,255,${.05 + .07 * clamp(1 - -fire / b.delay)})`; ctx.fillRect(0, -half, 1400, half * 2);
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(0, -1, 1400, 2); ctx.restore();
  }
  if (b.half > 0) {
    const beam = C.beamOf(b), wobble = reduced ? 1 : 1 + Math.sin(t * 70 + b.id) * .1;
    ctx.save(); ctx.translate(beam.x1, beam.y1); ctx.rotate(b.ang);
    ctx.fillStyle = 'rgba(190,225,255,.5)'; ctx.fillRect(0, -b.half * wobble - 3, 1400, (b.half * wobble + 3) * 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(-4, -b.half * wobble, 1404, b.half * 2 * wobble); ctx.restore();
  }
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = alpha; ctx.translate(Math.round(b.x), Math.round(b.y)); ctx.rotate(b.ang - Math.PI / 2 + spin);
  ctx.drawImage(image, -A.BLASTER.cx * scale, -A.BLASTER.cy * scale, image.width * scale, image.height * scale); ctx.restore();
}
function drawSoul(ctx, g, t) {
  const s = g.soul;
  if (s.inv > 0 && g.hurtT > 0 && Math.floor(t * 30) % 2) return;
  const blue = s.mode === 'blue', rotate = !blue ? 0 : { down: 0, left: Math.PI / 2, up: Math.PI, right: -Math.PI / 2 }[s.gravity];
  heart(ctx, s.x, s.y, blue ? '#1c4cff' : '#ff1a1a', { rotate });
}

// ---------- 전투 화면 ----------
const ICONS = {
  fight: ctx => { ctx.fillRect(4, 14, 3, 3); ctx.fillRect(7, 11, 3, 3); ctx.fillRect(10, 8, 3, 3); ctx.fillRect(13, 5, 3, 3); ctx.fillRect(16, 2, 3, 3); ctx.fillRect(2, 8, 3, 3); ctx.fillRect(10, 16, 3, 3); },
  act: ctx => { ctx.fillRect(3, 6, 3, 9); ctx.fillRect(8, 3, 3, 15); ctx.fillRect(13, 0, 3, 21); },
  item: ctx => { ctx.fillRect(2, 7, 16, 13); ctx.fillRect(6, 2, 8, 3); ctx.fillRect(6, 2, 3, 6); ctx.fillRect(11, 2, 3, 6); },
  mercy: ctx => { for (let i = 0; i < 6; i++) { ctx.fillRect(2 + i * 3, 2 + i * 3, 3, 3); ctx.fillRect(17 - i * 3, 2 + i * 3, 3, 3); } },
};
function drawButtons(ctx, g, t) {
  const asleepTarget = g.phase === 'asleep' && g.mode === 'dodge' ? g.push : null;
  C.BUTTONS.forEach((button, i) => {
    const picked = g.mode === 'menu' ? g.menu === i : ['submenu', 'fightbar', 'strike'].includes(g.mode) ? g.menu === i : asleepTarget === button.id;
    const pulse = asleepTarget === button.id && !reduced ? .8 + .2 * Math.sin(t * 9) : 1, color = picked ? '#ffff3a' : '#ff8a1e', x = button.x, y = C.BUTTON.y;
    ctx.save(); ctx.globalAlpha = picked ? pulse : g.mode === 'dodge' || g.mode === 'talk' || g.mode === 'cine' ? .7 : 1;
    ctx.fillStyle = '#000'; ctx.fillRect(x, y, C.BUTTON.w, C.BUTTON.h); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, C.BUTTON.w - 2, C.BUTTON.h - 2);
    if (picked && g.mode === 'menu') heart(ctx, x + 17, y + 21, '#ff1a1a');
    else { ctx.save(); ctx.translate(x + 7, y + 10); ctx.fillStyle = color; ICONS[button.id](ctx); ctx.restore(); }
    text(ctx, button.label, x + 36, y + 7, { size: 16, color, bold: true }); text(ctx, button.en, x + 36, y + 27, { size: 8, color, spacing: 1 });
    ctx.restore();
    if (asleepTarget === button.id) text(ctx, 'Z', x + C.BUTTON.w / 2, y - 22 + (reduced ? 0 : Math.sin(t * 6) * 2), { size: 16, color: '#ffff3a', align: 'center', bold: true });
  });
  for (const menuBone of g.menuBones) bone(ctx, menuBone.x, C.BUTTON.y + 21, 10, 50, '#fff');
}
function drawHud(ctx, g) {
  const y = 400, barX = 276, barW = Math.round(g.maxHp * 1.2), hp = Math.max(0, g.hp), kr = Math.min(g.kr, Math.max(0, hp - 1));
  text(ctx, g.name, 32, y + 1, { size: 16, bold: true }); text(ctx, 'LV ' + g.lv, 130, y + 1, { size: 16, bold: true });
  text(ctx, 'HP', 246, y + 5, { size: 10, bold: true });
  ctx.fillStyle = '#b8101e'; ctx.fillRect(barX, y, barW, 20);
  ctx.fillStyle = '#ffee00'; ctx.fillRect(barX, y, Math.round(barW * (hp - kr) / g.maxHp), 20);
  if (kr > 0) { ctx.fillStyle = '#e24bff'; ctx.fillRect(barX + Math.round(barW * (hp - kr) / g.maxHp), y, Math.round(barW * kr / g.maxHp), 20); }
  text(ctx, 'KR', barX + barW + 9, y + 5, { size: 10, bold: true, color: kr > 0 ? '#e24bff' : '#fff' });
  text(ctx, `${String(hp).padStart(2, '0')} / ${g.maxHp}`, barX + barW + 38, y + 1, { size: 16, bold: true, color: kr > 0 ? '#e24bff' : '#fff' });
}
function drawBox(ctx, g, t) {
  const box = g.box, l = Math.round(box.x - box.w / 2), top = Math.round(box.y - box.h / 2), w = Math.round(box.w), h = Math.round(box.h);
  ctx.fillStyle = '#000'; ctx.fillRect(l, top, w, h);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeRect(l - 2, top - 2, w + 4, h + 4);
  const tx = l + 22, ty = top + 18, tw = w - 44;
  if (g.mode === 'menu') typed(ctx, g.flavor, g.flavorShown, tx, ty, tw, { size: 18 });
  else if (g.mode === 'text' && g.text) {
    const line = g.text.lines[g.text.index]; typed(ctx, line, g.text.shown, tx, ty, tw, { size: 18 });
    if (g.text.shown >= line.length && (reduced || Math.floor(t * 3) % 2)) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(l + w - 34, top + h - 24); ctx.lineTo(l + w - 22, top + h - 24); ctx.lineTo(l + w - 28, top + h - 16); ctx.fill(); }
  } else if (g.mode === 'submenu' && g.submenu) {
    const sub = g.submenu, cols = sub.kind === 'item' || sub.kind === 'act' ? 2 : 1;
    sub.items.forEach((item, i) => {
      const x = tx + 28 + (i % cols) * (tw / cols), y = ty + Math.floor(i / cols) * 28;
      text(ctx, '* ' + item.name, x, y, { size: 18, color: item.glow ? '#ffff3a' : '#fff' });
      if (sub.index === i) heart(ctx, x - 18, y + 10, '#ff1a1a');
      if (sub.kind === 'target') { ctx.fillStyle = '#3ad23a'; ctx.fillRect(l + w - 190, y + 3, 110, 16); }
    });
  } else if (g.mode === 'fightbar' || (g.mode === 'strike' && g.strike && !g.strike.final)) {
    const bl = l + 14, bt = top + 12, bw = w - 28, bh = h - 24, n = 44;
    for (let i = 0; i < n; i++) {
      const u = (i + .5) / n * 2 - 1, height = bh * Math.sqrt(Math.max(0, 1 - u * u * .86));
      ctx.fillStyle = Math.abs(u) < .05 ? '#fff2a8' : Math.abs(u) < .3 ? '#7ed957' : Math.abs(u) < .62 ? '#3f9a3f' : '#1f5f29';
      ctx.fillRect(Math.round(bl + i * bw / n + 1), Math.round(bt + (bh - height) / 2), Math.max(2, Math.round(bw / n) - 3), Math.round(height));
    }
    const pos = g.bar ? Math.min(1, g.bar.t / C.BAR_TIME) : g.strike.pos, x = Math.round(bl + pos * bw), flash = g.strike && Math.floor(t * 16) % 2;
    ctx.fillStyle = '#000'; ctx.fillRect(x - 6, bt - 6, 12, bh + 12); ctx.fillStyle = flash ? '#ffee00' : '#fff'; ctx.fillRect(x - 3, bt - 4, 6, bh + 8);
  } else if (g.mode === 'dodge') {
    const B = C.targetBounds(g);
    ctx.save(); ctx.beginPath(); ctx.rect(l, top, w, h); ctx.clip();
    for (const b of g.bullets) if (b.kind !== 'gb') drawBullet(ctx, b, B, t);
    drawSoul(ctx, g, t);
    ctx.restore();
  }
}
function drawStrike(ctx, g, t, floor) {
  const st = g.strike; if (!st) return;
  const cx = 320, cy = floor - 78, k = st.t;
  if (k < .42) {
    // 베는 선: 위에서 아래로 그어진다
    const p = clamp(k / .16), fade = clamp(1 - (k - .2) / .22), big = st.final === 2 ? 1.5 : 1;
    ctx.save(); ctx.globalAlpha = fade; ctx.strokeStyle = st.final === 2 ? '#fff' : '#ff3048'; ctx.lineWidth = 7 * big; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(cx + 34 * big, cy - 62 * big); ctx.lineTo(cx + 34 * big - 68 * big * p, cy - 62 * big + 124 * big * p); ctx.stroke();
    ctx.strokeStyle = '#ffd0d6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + 34 * big, cy - 62 * big); ctx.lineTo(cx + 34 * big - 68 * big * p, cy - 62 * big + 124 * big * p); ctx.stroke(); ctx.restore();
  }
  if (st.final === 2) {
    if (k > .15) {
      const rise = clamp((k - .15) / .3) * 16, shownHp = clamp(1 - (k - .2) / .45);
      text(ctx, '9999999', cx, cy - 104 - rise, { size: 30, color: '#ff2038', align: 'center', bold: true });
      ctx.fillStyle = '#555'; ctx.fillRect(cx - 55, cy - 66, 110, 12); ctx.fillStyle = '#3ad23a'; ctx.fillRect(cx - 55, cy - 66, Math.round(110 * shownHp), 12);
    }
  } else if (k > .2 && k < 1.2) text(ctx, 'MISS', cx, cy - 96 - clamp((k - .2) / .3) * 14, { size: 30, color: '#c9c9c9', align: 'center', bold: true });
}
function battleLight(g) {
  const cool = { p2: .55, special: .25, nothing: .8, asleep: .9 }[g.phase];
  return { light: g.mode === 'dodge' && g.phase !== 'nothing' && g.phase !== 'asleep' ? .5 : .95, warmth: cool === undefined ? 1 : cool };
}
function drawBattle(ctx, g, t) {
  const { light, warmth } = battleLight(g), floor = C.sansFloor(g), cine = g.cine;
  hall(ctx, t, light, warmth);
  const at = drawSans(ctx, g, t, { floor });
  drawStrike(ctx, g, t, floor);
  drawBox(ctx, g, t);
  drawHud(ctx, g);
  drawButtons(ctx, g, t);
  if (g.mode === 'dodge') for (const b of g.bullets) if (b.kind === 'gb') drawBlaster(ctx, b, t);
  // 말풍선
  if (at) {
    if (g.talk) { const line = g.talk.lines[g.talk.index][0]; bubble(ctx, line, g.talk.shown, at.left + 106, at.top + 14); if (g.talk.shown >= line.length && (reduced || Math.floor(t * 3) % 2)) text(ctx, 'Z ▸', 612, 222, { size: 10, color: '#8f8a80', align: 'right' }); }
    else if (g.bubble) bubble(ctx, g.bubble.text, g.bubble.shown, at.left + 106, at.top + 14);
  }
  // 잠든 뒤: 상자 위의 속삭임
  if (g.phase === 'asleep' && g.mode === 'dodge') {
    const k = g.asleepT, boxTop = g.box.y - g.box.h / 2;
    text(ctx, L.ASLEEP_NOTES[k < 3.2 ? 0 : 1], 320, 252, { size: 13, color: '#d9d2c2', align: 'center', alpha: clamp(k / .6) * (k > 2.8 && k < 3.2 ? clamp((3.2 - k) / .4) : clamp((k - 3.2) / .5 + (k < 3.2 ? 1 : 0))) });
    if (k > 8 && !g.pushed) text(ctx, L.PUSH_HINT, g.box.x, boxTop + g.box.h + 2 - 150, { size: 10, color: '#8f8a80', align: 'center', alpha: clamp((k - 8) / 1) });
  }
  if (cine) {
    if (cine.kind === 'enter') { ctx.fillStyle = `rgba(0,0,0,${clamp(1 - cine.t / C.CINE_TIME.enter)})`; ctx.fillRect(0, 0, W, H); }
    else if (cine.kind === 'blackout') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); if (cine.t > .45) heart(ctx, 320, 315, '#1c4cff'); }
    else if (cine.kind === 'lower') {
      const k = cine.t; heart(ctx, 320, 316, '#ff1a1a', { scale: 2 });
      if (k > .3 && k < 1.5) { const fall = clamp((k - .3) / .5); ctx.save(); ctx.globalAlpha = clamp((1.5 - k) / .4); ctx.translate(352, 300 + fall * fall * 44); ctx.rotate(fall * 1.4); ctx.fillStyle = '#e8e8f0'; ctx.fillRect(-2, -14, 4, 20); ctx.fillStyle = '#8a6a3c'; ctx.fillRect(-4, 6, 8, 3); ctx.fillRect(-2, 9, 4, 6); ctx.restore(); }
    }
  }
  if (g.blackout > 0) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  if (g.hurtT > 0 && !reduced) { ctx.fillStyle = `rgba(255,0,30,${.055 * clamp(g.hurtT / .2)})`; ctx.fillRect(0, 0, W, H); }
}

// ---------- 그 밖의 화면 ----------
function drawTitle(ctx, g, t) {
  hall(ctx, t, 1, 1);
  const level = C.DIFFICULTIES[g.level], best = g.meta.best[level.id];
  text(ctx, 'SANS', 320, 22, { size: 55, align: 'center', bold: true, spacing: 10, color: '#fff' });
  text(ctx, '심 판 의   회 랑', 320, 84, { size: 13, align: 'center', color: '#e8c170', spacing: 2 });
  ctx.save(); ctx.imageSmoothingEnabled = false; const image = sansImage({ face: Math.floor(t / 3.4) % 4 === 3 ? 'wink' : 'closed', arm: null, sweat: 0, gash: false, flicker: 0, breath: !reduced && Math.floor(t * 1.4) % 2 ? 1 : 0 });
  ctx.drawImage(image, 320 - A.SANS.cx * 2, 238 - A.SANS.feet * 2, image.width * 2, image.height * 2); ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fillRect(0, 246, W, 234);
  C.DIFFICULTIES.forEach((d, i) => {
    // 하드모드 칸은 붉게 표시한다
    const x = 320 + (i - (C.DIFFICULTIES.length - 1) / 2) * 150, on = i === g.level, danger = !!d.startHp;
    ctx.strokeStyle = on ? (danger ? '#ff4a4a' : '#ffff3a') : danger ? '#6b3a3a' : '#5b5648'; ctx.lineWidth = 2; ctx.strokeRect(x - 70, 268, 140, 44);
    text(ctx, d.name, x + (on ? 10 : 0), 282, { size: 16, align: 'center', bold: true, color: on ? (danger ? '#ff6a6a' : '#ffff3a') : danger ? '#a06060' : '#a59f90' });
    if (on) { ctx.font = `bold 16px ${FONT}`; heart(ctx, x + 10 - ctx.measureText(d.name).width / 2 - 15, 291, '#ff1a1a'); }
  });
  text(ctx, level.note, 320, 326, { size: 11, align: 'center', color: '#cfc8b6' });
  text(ctx, best ? `최고 기록 · 쓰러짐 ${best.deaths}번 · 스침 ${best.hits}번 · ${L.ENDINGS[best.ending].sub}` : '아직 이 난이도를 끝까지 간 적이 없다.', 320, 352, { size: 10, align: 'center', color: '#8f8a80' });
  if (g.meta.deaths > 0) text(ctx, `샌즈가 기억하는 횟수 · ${g.meta.deaths}`, 320, 370, { size: 10, align: 'center', color: '#b06a6a' });
  if (reduced || Math.floor(t * 2) % 2) text(ctx, 'Z 또는 화면을 눌러 시작', 320, 408, { size: 16, align: 'center', bold: true });
  text(ctx, '← → 난이도 고르기', 320, 436, { size: 10, align: 'center', color: '#8f8a80' });
  const endings = Object.keys(g.meta.endings);
  text(ctx, `본 결말 ${endings.length} / 2`, 320, 456, { size: 9, align: 'center', color: endings.length === 2 ? '#e8c170' : '#6f6a60' });
}
function drawGameOver(ctx, g) {
  const over = g.over, k = g.modeT;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (k < .55) heart(ctx, over.x, over.y, '#ff1a1a');
  else if (k < 1.15) {
    // 금이 가서 둘로 갈라진다
    for (const side of [-1, 1]) { ctx.save(); ctx.beginPath(); ctx.rect(side < 0 ? over.x - 20 : over.x, over.y - 20, 20, 40); ctx.clip(); heart(ctx, over.x + side * 3, over.y + (side < 0 ? 0 : 2), '#ff1a1a'); ctx.restore(); }
  } else if (k < 2.6) {
    const u = k - 1.15;
    for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * .55, speed = 60 + hash(i, 5) * 60; ctx.fillStyle = '#ff1a1a'; ctx.globalAlpha = clamp(1 - u / 1.3); ctx.fillRect(Math.round(over.x + Math.cos(a) * speed * u), Math.round(over.y + Math.sin(a) * speed * u + 160 * u * u), 5, 5); }
    ctx.globalAlpha = 1;
  }
  if (k > 1.5) {
    const a = clamp((k - 1.5) / .8);
    text(ctx, 'GAME', 320, 44, { size: 66, align: 'center', bold: true, alpha: a, spacing: 8 }); text(ctx, 'OVER', 320, 112, { size: 66, align: 'center', bold: true, alpha: a, spacing: 8 });
    over.lines.forEach((line, i) => typed(ctx, line, Math.max(0, (k - 2.2 - i * 1.3) * 22), 320 - 250, 216 + i * 30, 500, { size: 16, color: over.dunk ? '#9fd8ff' : '#fff' }));
    if (k > 1.8) {
      over.options.forEach((option, i) => { const x = 320 + (i - (over.options.length - 1) / 2) * 180, on = i === over.index; text(ctx, option.label, x + 10, 348, { size: 18, align: 'center', bold: true, color: on ? '#ffff3a' : '#8f8a80' }); if (on) { ctx.font = `bold 18px ${FONT}`; heart(ctx, x + 10 - ctx.measureText(option.label).width / 2 - 16, 358, '#ff1a1a'); } });
      text(ctx, `샌즈가 기억하는 횟수 · ${g.meta.deaths}`, 320, 404, { size: 10, align: 'center', color: '#b06a6a' });
      text(ctx, '← → 고르기 · Z 확인', 320, 426, { size: 10, align: 'center', color: '#6f6a60' });
    }
  }
}
function drawWon(ctx, g, t) {
  const kill = g.ended === 'kill', ending = L.ENDINGS[g.ended], k = g.modeT, run = g.result;
  hall(ctx, t, kill ? .35 : 1, kill ? .15 : 1);
  if (kill) {
    // 바닥에 남은 후드
    ctx.fillStyle = '#2a4ca6'; ctx.fillRect(286, 226, 68, 12); ctx.fillStyle = '#3f73e0'; ctx.fillRect(290, 222, 60, 10); ctx.fillStyle = '#e6e9f2'; ctx.fillRect(296, 218, 48, 7); ctx.fillStyle = '#aab0c4'; ctx.fillRect(300, 224, 40, 2);
    for (let i = 0; i < 12; i++) { const u = (t * .12 + hash(i, 9)) % 1; ctx.fillStyle = `rgba(230,230,240,${.5 * (1 - u)})`; ctx.fillRect(Math.round(270 + hash(i, 4) * 100 + Math.sin(t + i) * 6), Math.round(232 - u * 120), 2, 2); }
  } else drawSans(ctx, { ...g, mode: 'won', sans: { ...g.sans, face: Math.floor(t / 2.6) % 3 === 2 ? 'wink' : 'closed', hidden: false, dx: 0, walk: 0, arm: null, eye: 0, dodgeT: -1 } }, t, { floor: 238 });
  ctx.fillStyle = 'rgba(0,0,0,.78)'; ctx.fillRect(0, 246, W, 234);
  const a = clamp(k / 1.2);
  text(ctx, ending.sub, 320, 262, { size: 10, align: 'center', color: '#e8c170', spacing: 3, alpha: a });
  text(ctx, ending.title, 320, 280, { size: 30, align: 'center', bold: true, alpha: a });
  text(ctx, ending.closing, 320, 324, { size: 13, align: 'center', color: '#cfc8b6', alpha: clamp((k - 1) / 1) });
  if (k > 2) {
    const minutes = Math.floor(run.time / 60), seconds = String(run.time % 60).padStart(2, '0');
    text(ctx, `${C.diff(g).name}   ·   쓰러짐 ${run.deaths}번   ·   스침 ${run.hits}번   ·   ${minutes}분 ${seconds}초`, 320, 362, { size: 12, align: 'center', alpha: clamp((k - 2) / .6) });
    if (run.record) text(ctx, '★ 새 기록', 320, 384, { size: 11, align: 'center', color: '#ffff3a', alpha: clamp((k - 2.3) / .6) });
    text(ctx, kill ? '잠든 샌즈 앞에서, 다른 버튼 쪽으로 상자를 밀어 볼 수도 있었다.' : '다른 끝도 있다. 하지만 꼭 봐야 하는 건 아니다.', 320, 408, { size: 10, align: 'center', color: '#8f8a80', alpha: clamp((k - 2.6) / .6) });
    if (k > 2.5 && (reduced || Math.floor(t * 2) % 2)) text(ctx, 'Z 로 처음 화면', 320, 440, { size: 14, align: 'center', bold: true });
  }
}

export function draw(ctx, g) {
  const t = g.time;
  ctx.save();
  if (g.shake > 0 && !reduced) ctx.translate(Math.round((hash(Math.floor(t * 60), 1) - .5) * g.shake), Math.round((hash(Math.floor(t * 60), 2) - .5) * g.shake));
  if (g.mode === 'title') drawTitle(ctx, g, t);
  else if (g.mode === 'gameover') drawGameOver(ctx, g);
  else if (g.mode === 'won') drawWon(ctx, g, t);
  else drawBattle(ctx, g, t);
  ctx.restore();
  if (g.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${clamp(g.flash) * (reduced ? .4 : 1)})`; ctx.fillRect(0, 0, W, H); }
  if (g.paused) {
    ctx.fillStyle = 'rgba(0,0,0,.68)'; ctx.fillRect(0, 0, W, H);
    text(ctx, '잠깐 쉬는 중', 320, 206, { size: 28, align: 'center', bold: true }); text(ctx, 'ESC 또는 계속하기 버튼', 320, 248, { size: 12, align: 'center', color: '#b9b2a2' });
  }
}
