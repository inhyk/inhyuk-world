// 언더테일 팬 게임 · Canvas 2D 렌더러. 논리 해상도 640×480.
import { TILE, COLS, ROWS, activeActors } from './world.mjs';
import { HUMAN, OVERWORLD, BATTLE, BATTLE_SCALE, bake, CHARA } from './sprites.mjs';
import { SOUL_RADIUS, attackStat, defenseStat, spareReady, flavor, alive } from './core.mjs';
import { ITEMS } from './data.mjs';

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
  ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(x, y + r); ctx.bezierCurveTo(x - r * 1.35, y - r * .1, x - r * .6, y - r * 1.15, x, y - r * .4); ctx.bezierCurveTo(x + r * .6, y - r * 1.15, x + r * 1.35, y - r * .1, x, y + r); ctx.fill();
}
export function drawHeart(ctx, x, y, r, color) { heart(ctx, x, y, r, color); }

// ---------- 오버월드 ----------
const THEMES = {
  ruins: { floor: '#3a2751', floor2: '#43305c', wall: '#1c1230', wallEdge: '#5b3f7d', grass: '#5a2d3b', grass2: '#7a3b4c', deco: '#c9a052', bg: '#0e0818' },
  snowdin: { floor: '#dfe7f2', floor2: '#cfd9e8', wall: '#22343f', wallEdge: '#3c5a6b', grass: '#c8d6ea', grass2: '#b6c8e0', deco: '#1d5a3a', bg: '#101a22' },
  waterfall: { floor: '#1b2a4a', floor2: '#213256', wall: '#0a1020', wallEdge: '#2f4a7a', grass: '#12384a', grass2: '#185066', deco: '#5ac8ff', bg: '#050912', water: '#0f2d6b' },
  hotland: { floor: '#6e2c1c', floor2: '#7e3422', wall: '#2a0e0a', wallEdge: '#a04a2a', grass: '#8a3a1e', grass2: '#a4482a', deco: '#3a1a12', bg: '#1a0806', water: '#ff6a1a' },
  castle: { floor: '#7a7a86', floor2: '#84848f', wall: '#2c2c34', wallEdge: '#5a5a66', grass: '#c9a84a', grass2: '#d8ba5a', deco: '#d9c27a', bg: '#141418' },
};
export function drawOverworld(ctx, w, t, opts = {}) {
  const room = w.room, th = THEMES[room.area]; const flags = w.player.flags;
  clear(ctx, th.bg);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const c = room.tiles[y][x], px = x * TILE, py = y * TILE;
    if (c === '#') { ctx.fillStyle = th.wall; ctx.fillRect(px, py, TILE, TILE); const below = room.tiles[y + 1]?.[x]; if (below && below !== '#') { ctx.fillStyle = th.wallEdge; ctx.fillRect(px, py + TILE - 6, TILE, 6); } if (room.area === 'ruins' || room.area === 'castle') { ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fillRect(px, py + ((x % 2) * 16), TILE, 1); ctx.fillRect(px + 16, py, 1, TILE); } continue; }
    if (c === '~') { const wc = th.water || '#0f2d6b'; ctx.fillStyle = wc; ctx.fillRect(px, py, TILE, TILE); ctx.fillStyle = room.area === 'hotland' ? 'rgba(255,230,120,.35)' : 'rgba(120,200,255,.25)'; const ph = Math.sin(t * 2 + x * .8 + y * 1.3); ctx.fillRect(px + 4 + ph * 4, py + 12 + (y % 2) * 8, 14, 2); continue; }
    ctx.fillStyle = (x + y) % 2 ? th.floor : th.floor2; ctx.fillRect(px, py, TILE, TILE);
    if (c === ',') { ctx.fillStyle = (x * 7 + y * 3) % 2 ? th.grass : th.grass2; ctx.fillRect(px, py, TILE, TILE); ctx.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 3; i++) ctx.fillRect(px + ((x * 13 + i * 11 + y * 5) % 28), py + ((y * 7 + i * 9 + x * 3) % 28), 3, 3); }
    else if (c === '=') { ctx.fillStyle = '#6b4a2a'; ctx.fillRect(px, py, TILE, TILE); ctx.fillStyle = '#4e351d'; ctx.fillRect(px, py + 10, TILE, 2); ctx.fillRect(px, py + 22, TILE, 2); }
    else if (c === 'o') drawDeco(ctx, room, px, py, t, th);
    else if (c === 'S') { ctx.fillStyle = th.floor; }
    else if (c === '^') { const down = flags[`${room.id}_switch`]; ctx.fillStyle = down ? 'rgba(255,255,255,.12)' : '#b9bcc4'; if (down) ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8); else for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(px + 4 + i * 10, py + 28); ctx.lineTo(px + 9 + i * 10, py + 6); ctx.lineTo(px + 14 + i * 10, py + 28); ctx.fill(); } }
    else if (c === 'x') { const on = flags[`${room.id}_switch`] || flags[`${room.id}_door`]; ctx.fillStyle = on ? '#8fd18f' : '#c9c9c9'; ctx.fillRect(px + 6, py + 8, 20, 16); ctx.fillStyle = on ? '#4c8a4c' : '#7a7a7a'; ctx.fillRect(px + 9, py + 11, 14, 10); }
    else if (c === 'D') { const open = flags[`${room.id}_door`]; ctx.fillStyle = open ? '#000' : '#2a1d3a'; ctx.fillRect(px, py, TILE, TILE); if (!open) { ctx.fillStyle = '#5b3f7d'; ctx.fillRect(px + 4, py + 2, TILE - 8, TILE - 2); ctx.fillStyle = '#2a1d3a'; ctx.fillRect(px + 15, py + 2, 2, TILE - 2); } }
    else if (c === 'B') { const empty = room.box && flags[room.box.flag]; ctx.fillStyle = '#7a4a2a'; ctx.fillRect(px + 4, py + 8, 24, 20); ctx.fillStyle = empty ? '#3a2214' : '#a8683a'; ctx.fillRect(px + 4, py + 8, 24, 8); ctx.fillStyle = '#f0d060'; ctx.fillRect(px + 14, py + 14, 4, 5); }
  }
  // 세이브 포인트 별
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (room.tiles[y][x] === 'S') { const px = x * TILE + 16, py = y * TILE + 16; const s = 6 + Math.sin(t * 4) * 1.5; ctx.fillStyle = '#ffe66d'; ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, rr = i % 2 ? s * .4 : s * 1.6; ctx.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr); } ctx.fill(); }
  if (room.deco === 'flowers') for (let i = 0; i < 30; i++) { const fx = 212 + ((i * 7919 + 13) % 196), fy = 150 + ((i * 104729 + 7) % 128); ctx.fillStyle = '#f4d34a'; ctx.beginPath(); ctx.arc(fx, fy, 3, 0, 7); ctx.fill(); ctx.fillStyle = '#c99a1c'; ctx.fillRect(fx - 1, fy - 1, 2, 2); }
  if (room.hall) for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(255,230,140,.10)'; ctx.fillRect(48 + i * 96, 40, 40, 400); }
  if (room.throne) { ctx.fillStyle = 'rgba(255,240,180,.08)'; ctx.fillRect(160, 32, 320, 96); }
  // 배우와 플레이어를 y순으로 그린다
  const list = activeActors(w).map(a => ({ y: a.py, draw: () => drawActor(ctx, a, t) }));
  list.push({ y: w.y, draw: () => drawPlayer(ctx, w, t, opts.chara) });
  list.sort((a, b) => a.y - b.y).forEach(o => o.draw());
  if (room.fog) { ctx.fillStyle = 'rgba(200,215,235,.35)'; ctx.fillRect(0, 0, W, H); }
  if (room.lasers && !flags[`${room.id}_switch`]) { for (let y = 3; y < 10; y++) { ctx.fillStyle = `rgba(255,80,80,${.5 + Math.sin(t * 8 + y) * .3})`; ctx.fillRect(8 * TILE + 12, y * TILE, 8, TILE); } }
  if (room.gray) { ctx.fillStyle = 'rgba(120,120,130,.25)'; ctx.fillRect(0, 0, W, H); }
  if (w.transition > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, w.transition * 2.5)})`; ctx.fillRect(0, 0, W, H); }
}
function drawDeco(ctx, room, px, py, t, th) {
  if (room.area === 'snowdin') { ctx.fillStyle = '#1d4a33'; ctx.beginPath(); ctx.moveTo(px + 16, py - 10); ctx.lineTo(px + 30, py + 22); ctx.lineTo(px + 2, py + 22); ctx.fill(); ctx.fillStyle = '#e8f0ff'; ctx.beginPath(); ctx.moveTo(px + 16, py - 10); ctx.lineTo(px + 24, py + 6); ctx.lineTo(px + 8, py + 6); ctx.fill(); ctx.fillStyle = '#4a2f1c'; ctx.fillRect(px + 13, py + 22, 6, 8); }
  else if (room.area === 'waterfall') { const g = .6 + Math.sin(t * 3 + px) * .3; ctx.fillStyle = `rgba(90,200,255,${g})`; ctx.beginPath(); ctx.arc(px + 16, py + 14, 9, 0, 7); ctx.fill(); ctx.fillStyle = '#245a7a'; ctx.fillRect(px + 13, py + 18, 6, 12); }
  else if (room.area === 'hotland') { ctx.fillStyle = '#3a1a12'; ctx.fillRect(px + 8, py - 6, 16, 36); ctx.fillStyle = '#5a2a1a'; ctx.fillRect(px + 8, py - 6, 16, 4); }
  else if (room.area === 'castle') { ctx.fillStyle = '#c9b46a'; ctx.fillRect(px + 8, py - 30, 16, 60); ctx.fillStyle = '#e8d88a'; ctx.fillRect(px + 8, py - 30, 4, 60); }
  else { ctx.fillStyle = th.deco; ctx.fillRect(px + 10, py - 8, 12, 36); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(px + 10, py + 22, 12, 6); }
}
function drawActor(ctx, a, t) {
  const sp = OVERWORLD[a.sprite]; if (!sp) return;
  const img = bake(sp, 2); const bob = a.sprite === 'blook' || a.sprite === 'echo' ? Math.sin(t * 2) * 3 : 0;
  ctx.drawImage(img, Math.round(a.px - img.width / 2), Math.round(a.py + 16 - img.height + bob));
}
function drawPlayer(ctx, w, t, chara = false) {
  const frames = chara ? [CHARA, CHARA] : HUMAN[w.dir]; const f = frames[w.moving ? (w.frame % 2) : 0];
  const img = bake(f, 2); ctx.drawImage(img, Math.round(w.x - img.width / 2), Math.round(w.y + 16 - img.height));
}

// ---------- 대화 상자 ----------
export function drawTextbox(ctx, box, t, opts = {}) {
  const top = opts.top ? 20 : H - 170; const x = 40, y = top, bw = W - 80, bh = 150;
  ctx.fillStyle = '#000'; ctx.fillRect(x, y, bw, bh); ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.strokeRect(x + 2.5, y + 2.5, bw - 5, bh - 5);
  let ty = y + 22, tx = x + 30;
  if (box.who) { text(ctx, box.who, tx, ty, { size: 15, color: '#ffd76a', bold: true }); ty += 26; }
  const full = box.lines[box.index]; const shown = full.slice(0, Math.floor(box.shown));
  const lines = wrap(ctx, shown, bw - 60, 18);
  lines.slice(0, 4).forEach((l, i) => text(ctx, l, tx, ty + i * 26, { size: 18 }));
  if (box.shown >= full.length && !box.choice) { ctx.fillStyle = '#fff'; const bx = x + bw - 40, by = y + bh - 28 + Math.sin(t * 6) * 2; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + 12, by); ctx.lineTo(bx + 6, by + 8); ctx.fill(); }
  if (box.choice && box.shown >= full.length) {
    box.choice.options.forEach((o, i) => { const ox = x + 60 + i * 260, oy = y + bh - 40; if (box.choice.index === i) heart(ctx, ox - 18, oy + 9, 7, '#ff2a2a'); text(ctx, o, ox, oy, { size: 18, color: box.choice.index === i ? '#ffd76a' : '#fff' }); });
  }
}

// ---------- 전투 ----------
const BUTTONS = [{ id: 'fight', label: '공격', en: 'FIGHT' }, { id: 'act', label: '행동', en: 'ACT' }, { id: 'item', label: '아이템', en: 'ITEM' }, { id: 'mercy', label: '자비', en: 'MERCY' }];
export function drawBattle(ctx, b, t) {
  clear(ctx, '#000');
  const p = b.player;
  // 적
  const list = b.enemies.filter(e => !e.dead || e.deathT < 1); const n = Math.max(1, list.length);
  list.forEach((e, i) => {
    const sp = BATTLE[e.id]; if (!sp) return; const scale = BATTLE_SCALE[e.id] || 4; const img = bake(sp, scale);
    const cx = W / 2 + (i - (n - 1) / 2) * 200, bob = e.spared || e.fled ? 0 : Math.sin(t * 2 + i) * 3;
    const boxTop = b.box.y - b.box.h / 2; const baseY = Math.min(230, boxTop - 8) - img.height; const shake = b.lastDamage && b.lastDamage.enemy === e && b.lastDamage.t < .5 ? Math.sin(b.lastDamage.t * 60) * 6 : 0;
    ctx.save();
    if (e.spared || e.fled) ctx.globalAlpha = .35;
    if (e.id === 'sans' && b.attack && b.attack.name === 'nothing') ctx.globalAlpha = .8;
    ctx.drawImage(img, Math.round(cx - img.width / 2 + shake), Math.round(baseY + bob));
    ctx.restore();
    if (b.mode === 'submenu' && (b.submenu.kind === 'target' || b.submenu.kind === 'acttarget')) { const item = b.submenu.items[b.sub]; if (item && item.enemy === e) { ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(cx - img.width / 2 - 8, baseY - 8, img.width + 16, img.height + 16); } }
    // 피격 시 HP 바와 숫자
    if (b.lastDamage && b.lastDamage.enemy === e && b.lastDamage.t < 1.1 && !e.def.immortal) {
      const bw = 100, hx = cx - bw / 2, hy = 236; ctx.fillStyle = '#7a7a7a'; ctx.fillRect(hx, hy, bw, 12); ctx.fillStyle = '#2ee02e'; ctx.fillRect(hx, hy, bw * Math.max(0, e.hp / e.maxHp), 12);
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
  const uy = 400; text(ctx, p.name, 36, uy, { size: 16, bold: true }); text(ctx, `LV ${p.lv}`, 150, uy, { size: 16, bold: true }); if (b.hard) text(ctx, 'HARD', 200, uy + 3, { size: 11, bold: true, color: '#ff5a5a' });
  text(ctx, 'HP', 246, uy + 3, { size: 12, bold: true });
  const hbw = Math.max(40, p.maxHp * 1.2), hx = 272; ctx.fillStyle = '#c00'; ctx.fillRect(hx, uy, hbw, 20); ctx.fillStyle = b.karma > 0 ? '#ffe000' : '#ffe000'; ctx.fillRect(hx, uy, hbw * Math.max(0, p.hp / p.maxHp), 20);
  if (b.karma > 0) { ctx.fillStyle = '#b26bff'; ctx.fillRect(hx + hbw * Math.max(0, (p.hp - b.karma) / p.maxHp), uy, hbw * Math.min(b.karma, p.hp) / p.maxHp, 20); text(ctx, 'KR', hx + hbw + 6, uy + 3, { size: 12, color: '#b26bff', bold: true }); }
  text(ctx, `${String(p.hp).padStart(2, '0')} / ${p.maxHp}`, hx + hbw + (b.karma > 0 ? 34 : 10), uy, { size: 16, bold: true });
  // 버튼
  BUTTONS.forEach((bt, i) => {
    const x = 32 + i * 155, y = 432, w = 110, h = 42; const sel = (b.mode === 'menu' && b.menu === i) || (b.mode !== 'menu' && b.mode !== 'dodge' && b.lastAction === bt.id);
    ctx.lineWidth = 3; ctx.strokeStyle = sel ? '#ffd76a' : '#f08a24'; ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h); ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    text(ctx, bt.label, x + 40, y + 6, { size: 15, color: sel ? '#ffd76a' : '#f08a24', bold: true }); text(ctx, bt.en, x + 40, y + 24, { size: 10, color: sel ? '#ffd76a' : '#f08a24' });
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
  const bx = b.box; const l = bx.x - bx.w / 2 + 12, tp = bx.y - bx.h / 2 + 12, bw = bx.w - 24, bh = bx.h - 24;
  // 표적판: 중앙이 밝다
  for (let i = 0; i < 20; i++) { const d = Math.abs(i - 9.5) / 9.5; ctx.fillStyle = `rgb(${Math.round(255 - d * 200)},${Math.round(255 - d * 200)},${Math.round(255 - d * 200)})`; ctx.fillRect(l + i * bw / 20, tp, bw / 20 + 1, bh); }
  ctx.fillStyle = '#000'; for (let i = 0; i < 20; i += 2) ctx.fillRect(l + i * bw / 20 + 1, tp, 1, bh);
  const pos = b.bar ? Math.min(1, b.bar.struck ? b.bar.pos : b.bar.t / b.bar.duration) : 0; const x = l + pos * bw;
  const blink = b.mode === 'strikeanim' && Math.floor(b.animT * 12) % 2 === 0;
  ctx.fillStyle = blink ? '#fff' : '#000'; ctx.fillRect(x - 5, tp - 6, 10, bh + 12); ctx.fillStyle = blink ? '#000' : '#fff'; ctx.fillRect(x - 3, tp - 4, 6, bh + 8);
}
function drawSoul(ctx, b, t) {
  const s = b.soul; if (s.invincible > 0 && Math.floor(t * 20) % 2) return;
  const color = s.mode === 'blue' ? '#3b6bff' : s.mode === 'green' ? '#2fd86a' : '#ff2a2a';
  if (s.mode === 'green') { const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[s.facing]; ctx.strokeStyle = '#2fd86a'; ctx.lineWidth = 4; ctx.beginPath(); const a0 = Math.atan2(d[1], d[0]); ctx.arc(s.x, s.y, 20, a0 - .7, a0 + .7); ctx.stroke(); }
  if (s.mode === 'blue' && s.gravity === 'up') { ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(Math.PI); heart(ctx, 0, 0, SOUL_RADIUS + 3, color); ctx.restore(); return; }
  heart(ctx, s.x, s.y, SOUL_RADIUS + 3, color);
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
    if (fx.kind === 'block') { ctx.fillStyle = `rgba(255,224,0,${1 - fx.t})`; ctx.beginPath(); ctx.arc(fx.x, fx.y, 8 + fx.t * 12, 0, 7); ctx.fill(); }
    if (fx.kind === 'heal') { ctx.fillStyle = `rgba(47,216,106,${1 - fx.t})`; ctx.beginPath(); ctx.arc(fx.x, fx.y, 6 + fx.t * 10, 0, 7); ctx.fill(); }
  }
}

// ---------- 화면들 ----------
export function drawTitle(ctx, t, state) {
  clear(ctx, '#000');
  text(ctx, 'UNDERTALE', W / 2, 90, { size: 54, align: 'center', bold: true, color: '#fff' });
  text(ctx, '팬 게임 · 세 갈래의 결말', W / 2, 152, { size: 16, align: 'center', color: '#aaa' });
  heart(ctx, W / 2, 200 + Math.sin(t * 2) * 3, 14, '#ff2a2a');
  const opts = state.options; opts.forEach((o, i) => { const y = 260 + i * 36; const sel = state.index === i; if (sel) heart(ctx, W / 2 - 110, y + 10, 7, '#ff2a2a'); text(ctx, o.label, W / 2 - 92, y, { size: 20, color: sel ? '#ffd76a' : o.disabled ? '#555' : '#fff' }); if (o.sub) text(ctx, o.sub, W / 2 - 92, y + 22, { size: 11, color: '#777' }); });
  text(ctx, '방향키 이동 · Z 확인 · X 취소', W / 2, 440, { size: 13, align: 'center', color: '#666' });
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
    const cast = ['toriel', 'sans', 'papyrus', 'undyne', 'asgore']; cast.forEach((c, i) => { const img = bake(OVERWORLD[c], 2); ctx.drawImage(img, 90 + i * 100, 330 - img.height); });
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
  ctx.fillStyle = '#000'; ctx.fillRect(40, 190, 200, 130); ctx.strokeRect(40, 190, 200, 130);
  ['아이템', '스탯', '닫기'].forEach((o, i) => { const y = 208 + i * 34; if (state.tab === i && !state.sub) heart(ctx, 62, y + 10, 7, '#ff2a2a'); text(ctx, o, 80, y, { size: 18, color: state.tab === i ? '#ffd76a' : '#fff' }); });
  ctx.fillStyle = '#000'; ctx.fillRect(260, 40, 340, 400); ctx.strokeRect(260, 40, 340, 400);
  if (state.tab === 0) { if (!player.items.length) text(ctx, '가방이 비어 있다.', 290, 60, { size: 16 }); player.items.forEach((id, i) => { const y = 60 + i * 32; const sel = state.sub && state.index === i; if (sel) heart(ctx, 282, y + 10, 7, '#ff2a2a'); text(ctx, ITEMS[id].name, 300, y, { size: 17, color: sel ? '#ffd76a' : '#fff' }); }); if (state.sub && player.items[state.index]) { text(ctx, ITEMS[player.items[state.index]].text, 290, 340, { size: 13, color: '#bbb' }); text(ctx, 'Z 사용/장착 · X 닫기', 290, 410, { size: 13, color: '#777' }); } }
  else if (state.tab === 1) { const lines = [`"${player.name}"`, `LV ${player.lv}   HP ${player.hp} / ${player.maxHp}`, `AT ${attackStat(player)} (${ITEMS[player.weapon].weapon})   DF ${defenseStat(player)} (${ITEMS[player.armor].armor})`, `EXP ${player.exp}   다음 LV까지 ${player.lv >= 20 ? 0 : Math.max(0, [0, 10, 30, 70, 120, 200, 300, 500, 800, 1200, 1700, 2500, 3500, 5000, 7000, 10000, 15000, 25000, 50000, 99999][player.lv] - player.exp)}`, `무기: ${ITEMS[player.weapon].name}`, `방어구: ${ITEMS[player.armor].name}`, `골드: ${player.gold} G`, `죽인 수: ${player.kills}`, `현재 위치: ${w.room.area}`]; lines.forEach((l, i) => text(ctx, l, 290, 60 + i * 30, { size: 16 })); }
  if (state.message) text(ctx, state.message, 290, 380, { size: 14, color: '#ffd76a' });
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
