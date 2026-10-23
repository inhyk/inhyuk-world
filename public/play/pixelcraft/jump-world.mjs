import { B } from './data.mjs';
import { W, H, idx, computeLight } from './core.mjs';

export const JUMP_COURSE = 2;
export const JUMP_LAST = 60;
export const CHECKPOINT_EVERY = 15;
export const CRUMBLE_DELAY = 0.38;
const heights = [0, -1, -1, 0, 1, 0, -1, 0];
export const JUMP_THEMES = [
  { name: '숲의 나무다리', sky: ['#163c3b', '#9ccdb0'], color: '#97e6a4', hint: '나무·이끼 다리를 건너자. 금 간 발판 주의!' },
  { name: '얼음 절벽', sky: ['#334d91', '#cceff4'], color: '#b1edff', hint: '얼음 위는 미끄러워! 반대 방향으로 브레이크.' },
  { name: '화산 붕괴 지대', sky: ['#28142c', '#cc6943'], color: '#ffb77a', hint: '붉은 붕괴 발판! 0.38초 안에 다음 점프.' },
  { name: '별빛 도약섬', sky: ['#090c27', '#3e285a'], color: '#d6b3ff', hint: '초록 도약 발판은 자동으로 높이 튀어 올라!' },
];
export const JUMP_PLATFORMS = [];
for (let i = 0; i <= JUMP_LAST; i++) {
  const previous = JUMP_PLATFORMS[i - 1];
  const checkpoint = i % CHECKPOINT_EVERY === 0;
  const desiredY = 62 - Math.floor(i / CHECKPOINT_EVERY) + heights[i % heights.length];
  const y = previous ? Math.max(previous.y - 1, desiredY) : desiredY;
  const gap = !previous ? 0 : y < previous.y ? 2 : y > previous.y && i % 3 === 1 ? 4 : 3;
  const theme = Math.min(3, Math.floor(i / CHECKPOINT_EVERY));
  JUMP_PLATFORMS.push({ x: previous ? previous.x + previous.width + gap : 520, y,
    width: checkpoint ? 3 : 1, checkpoint, goal: i === JUMP_LAST,
    theme, bounce: !checkpoint && theme === 3 && i % 5 === 2,
    ice: !checkpoint && theme === 1 && i % 3 !== 0,
    crumble: !checkpoint && (theme === 2 ? i % 3 !== 1 : theme === 0 && i % 5 === 3),
  });
}
export function newJumpState() {
  return { course: JUMP_COURSE, checkpoint: 0, progress: 0, elapsed: 0, falls: 0, completed: false };
}
export function checkpointNumber(index) { return Math.floor(index / CHECKPOINT_EVERY); }
export function themeAt(x) {
  const platform = JUMP_PLATFORMS.findLast(p => p.x <= x + 0.6) ?? JUMP_PLATFORMS[0];
  return JUMP_THEMES[platform.theme];
}
function platformTile(p) {
  if (p.goal) return B.GOLD_BLOCK;
  if (p.checkpoint) return B.DIAMOND_BLOCK;
  if (p.bounce) return B.MOSSY_COBBLE;
  if (p.ice) return B.ICE;
  if (p.crumble) return B.NETHERRACK;
  const palette = [[B.OAK_LOG, B.PLANKS, B.MOSSY_COBBLE], [B.SNOW_GRASS, B.GLASS], [B.OBSIDIAN, B.GLOWSTONE], [B.PURPUR, B.END_STONE, B.GLOWSTONE]][p.theme];
  return palette[JUMP_PLATFORMS.indexOf(p) % palette.length];
}
export function jumpGrip(G, p, move, normal) {
  const x = Math.floor(p.x + p.w / 2), y = Math.floor(p.y + p.h + 0.05);
  return G.jump && p.onGround && G.w.tiles[idx(x, y)] === B.ICE ? (move ? 3.5 : 0.7) : normal;
}
function putPlatform(w, p, present) {
  for (let x = p.x; x < p.x + p.width; x++) {
    w.tiles[idx(x, p.y)] = present ? platformTile(p) : B.AIR;
    w.tiles[idx(x, p.y + 1)] = present ? [B.OAK_LOG, B.ICE, B.OBSIDIAN, B.PURPUR][p.theme] : B.AIR;
  }
}
export function makeJumpWorld(seed) {
  const w = { seed, sky: new Uint8Array(W * H), blk: new Uint8Array(W * H), tiles: new Uint16Array(W * H), bg: new Uint16Array(W * H), meta: new Uint8Array(W * H), surface: new Int16Array(W).fill(H - 1), biome: new Uint8Array(W) };
  for (let x = 0; x < W; x++) w.tiles[idx(x, H - 1)] = B.BEDROCK;
  for (const p of JUMP_PLATFORMS) {
    putPlatform(w, p, true);
    for (let x = p.x; x < p.x + p.width; x++) w.surface[x] = p.y;
  }
  computeLight(w, 0, W - 1);
  return w;
}
export function jumpSpawn(index = 0) {
  const p = JUMP_PLATFORMS[index] ?? JUMP_PLATFORMS[0];
  return { x: p.x + (p.width - 0.6) / 2, y: p.y - 1.8 };
}
export function resetJumper(p, index) {
  const sp = jumpSpawn(index);
  Object.assign(p, sp, { vx: 0, vy: 0, hp: 20, food: 20, air: 10, fire: 0, flying: false, fallTop: sp.y, onGround: false, spawn: { ...sp } });
}
export function tickJumpWorld(G, dt, notify = () => {}, save = () => {}) {
  const j = G.jump;
  if (!j) return;
  if (!j.completed) j.elapsed += dt;
  const runtime = G.jumpRuntime ??= new Map();
  for (const [i, state] of runtime) {
    state.time -= dt;
    if (state.time > 0) continue;
    const b = JUMP_PLATFORMS[i];
    if (!state.gone) { putPlatform(G.w, b, false); state.gone = true; state.time = 2.5; }
    else { putPlatform(G.w, b, true); runtime.delete(i); }
    G.dirty = [Math.min(G.dirty?.[0] ?? b.x, b.x - 2), Math.max(G.dirty?.[1] ?? b.x, b.x + b.width + 2)];
  }
  G.time = 0.18; if (!j.assisted) G.day = 1;
  for (const p of [G.player, ...(G.adventure.coop && !G.companion.spectator ? [G.companion] : [])]) {
    p.hp = 20; p.food = 20;
    if (p.y > 78 || p.x < JUMP_PLATFORMS[0].x - 5) {
      resetJumper(p, j.checkpoint); j.falls++;
      if (p === G.player) G.cam = { x: p.x, y: p.y };
      notify('떨어져도 괜찮아! 마지막 체크포인트에서 다시 출발!'); save();
    }
    p.bounceT = Math.max(0, (p.bounceT ?? 0) - dt);
    if (!p.onGround) continue;
    const i = JUMP_PLATFORMS.findIndex(b => p.x + p.w > b.x && p.x < b.x + b.width && Math.abs(p.y + p.h - b.y) < 0.12);
    if (i < 0) continue;
    if (JUMP_PLATFORMS[i].bounce && p.bounceT <= 0 && !p.flying) {
      p.vy = -11.5; p.onGround = false; p.y -= 0.02; p.bounceT = 0.25;
    }
    if (JUMP_PLATFORMS[i].crumble && !runtime.has(i)) runtime.set(i, { time: CRUMBLE_DELAY, gone: false });
    j.progress = Math.max(j.progress, i);
    if (JUMP_PLATFORMS[i].checkpoint && i > j.checkpoint) {
      j.checkpoint = i; G.player.spawn = jumpSpawn(i); G.companion.spawn = jumpSpawn(i);
      notify(`체크포인트 ${checkpointNumber(i)} 저장!`); save();
    }
    if (JUMP_PLATFORMS[i].goal && !j.completed) {
      j.completed = true; notify('점프맵 완주! 황금 발판에 도착했어! R로 기록을 확인해 봐.'); save();
    }
  }
}
export function drawJumpWorld(g, G, sx, sy, T) {
  for (let i = 0; i < JUMP_PLATFORMS.length; i++) {
    const p = JUMP_PLATFORMS[i], x = sx(p.x + p.width / 2), y = sy(p.y);
    if (x < -T * 4 || x > g.canvas.width + T * 4) continue;
    const state = G.jumpRuntime?.get(i);
    if (p.crumble && !state?.gone) {
      const bx = sx(p.x), by = sy(p.y);
      g.fillStyle = state ? `rgba(255,75,75,${0.35 + Math.sin(G.clock * 40) * 0.25})` : 'rgba(255,132,66,0.23)';
      g.fillRect(bx, by, T * p.width, T);
      g.strokeStyle = '#ffc080'; g.lineWidth = T * 0.04; g.beginPath(); g.moveTo(bx + T * 0.2, by); g.lineTo(bx + T * 0.5, by + T * 0.45); g.lineTo(bx + T * 0.3, by + T); g.stroke();
    }
    if (p.bounce) {
      const bx = sx(p.x), by = sy(p.y);
      g.fillStyle = '#80ffc1'; g.fillRect(bx, by - T * 0.12, T * p.width, T * 0.15);
      g.strokeStyle = '#baffd9'; g.lineWidth = T * 0.05; g.beginPath();
      g.moveTo(bx + T * 0.2, by - T * 0.4); g.lineTo(bx + T * 0.5, by - T * 0.7); g.lineTo(bx + T * 0.8, by - T * 0.4); g.stroke();
    }
    if (p.checkpoint) {
      g.fillStyle = '#e8edfa'; g.fillRect(x - T * 0.04, y - T * 2.8, T * 0.08, T * 2.8);
      g.fillStyle = p.goal ? '#ffd563' : i <= G.jump.checkpoint ? '#72efbe' : '#85cfff';
      g.fillRect(x, y - T * 2.8, T * 0.9, T * 0.65);
    }
    g.font = `bold ${Math.max(11, T * 0.28)}px sans-serif`; g.textAlign = 'center';
    const label = p.goal ? '★ 도착!' : i === 0 ? '출발 →' : p.checkpoint ? `◆ 체크포인트 ${checkpointNumber(i)}` : `${i}${p.crumble ? ' ⚠' : p.bounce ? ' ↑↑' : p.ice ? ' ❄' : ''}`;
    const ly = y - T * (p.checkpoint ? 3.1 : 0.35);
    g.fillStyle = '#142238'; const width = g.measureText(label).width + T * 0.28;
    g.fillRect(x - width / 2, ly - T * 0.32, width, T * 0.45);
    g.fillStyle = '#fff4d5'; g.fillText(label, x, ly);
  }
  g.textAlign = 'start';
}

export function drawJumpSky(g, G, cw, ch) {
  const theme = themeAt(G.player.x), index = JUMP_THEMES.indexOf(theme);
  const grad = g.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0, theme.sky[0]); grad.addColorStop(1, theme.sky[1]);
  g.fillStyle = grad; g.fillRect(0, 0, cw, ch);
  g.save();
  if (index === 3) {
    for (let k = 0; k < 95; k++) {
      g.globalAlpha = 0.4 + Math.sin(k + G.clock) * 0.25;
      g.fillStyle = k % 3 ? '#e0d6ff' : '#92d7ec';
      g.fillRect(((k * 137.3 - G.cam.x * 2) % cw + cw) % cw, (k * 71.7) % ch, 2 + k % 2, 2 + k % 2);
    }
    g.globalAlpha = 0.6; g.fillStyle = '#906bac'; g.beginPath(); g.arc(cw * 0.77, ch * 0.23, ch * 0.1, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#bdabf7'; g.lineWidth = 3; g.beginPath(); g.ellipse(cw * 0.77, ch * 0.23, ch * 0.17, ch * 0.03, -0.3, 0, Math.PI * 2); g.stroke();
  } else {
    for (let layer = 0; layer < 2; layer++) for (let k = -1; k < 9; k++) {
      const step = cw / 5, x = k * step - ((G.cam.x * (layer + 1) * 2) % step), y = ch * (0.65 + layer * 0.1), h = ch * (0.2 + (k + 9) % 3 * 0.06);
      g.fillStyle = index === 0 ? ['#31645e', '#264d4c'][layer] : index === 1 ? ['#87adc8', '#b2ceda'][layer] : ['#542e47', '#3b2437'][layer];
      g.beginPath(); g.moveTo(x - step, ch); g.lineTo(x, y - h); g.lineTo(x + step, ch); g.fill();
      if (index === 1) { g.fillStyle = '#e5f9ff'; g.beginPath(); g.moveTo(x, y - h); g.lineTo(x - step * 0.22, y - h + ch * 0.1); g.lineTo(x + step * 0.22, y - h + ch * 0.1); g.fill(); }
      if (index === 0) { g.fillStyle = '#193e3c'; g.fillRect(x - 4, y - h, 8, ch); for (let branch = 0; branch < 3; branch++) { g.beginPath(); g.moveTo(x, y - h - 70 + branch * 28); g.lineTo(x - 40 - branch * 10, y - h + branch * 28); g.lineTo(x + 40 + branch * 10, y - h + branch * 28); g.fill(); } }
    }
    if (index === 1 || index === 2) for (let k = 0; k < 45; k++) {
      g.globalAlpha = 0.2 + k % 3 * 0.13; g.fillStyle = index === 1 ? '#fff' : '#ffcc7d';
      g.fillRect(((k * 113.7 + G.clock * (index === 1 ? 4 : 9)) % cw + cw) % cw, ((k * 71.2 + G.clock * (index === 1 ? 10 : -12)) % ch + ch) % ch, 2 + k % 3, 2 + k % 3);
    }
  }
  g.restore();
}
