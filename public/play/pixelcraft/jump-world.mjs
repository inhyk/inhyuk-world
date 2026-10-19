import { B } from './data.mjs';
import { W, H, idx, computeLight } from './core.mjs';

export const JUMP_COURSE = 2;
export const JUMP_LAST = 60;
export const CHECKPOINT_EVERY = 15;
export const CRUMBLE_DELAY = 0.38;
const heights = [0, -1, -1, 0, 1, 0, -1, 0];
export const JUMP_PLATFORMS = [];
for (let i = 0; i <= JUMP_LAST; i++) {
  const previous = JUMP_PLATFORMS[i - 1];
  const checkpoint = i % CHECKPOINT_EVERY === 0;
  const desiredY = 62 - Math.floor(i / CHECKPOINT_EVERY) + heights[i % heights.length];
  const y = previous ? Math.max(previous.y - 1, desiredY) : desiredY;
  const gap = !previous ? 0 : y < previous.y ? 2 : y > previous.y && i % 3 === 1 ? 4 : 3;
  JUMP_PLATFORMS.push({ x: previous ? previous.x + previous.width + gap : 520, y,
    width: checkpoint ? 3 : 1, checkpoint, goal: i === JUMP_LAST,
    crumble: !checkpoint && i % 3 !== 1,
  });
}
export function newJumpState() {
  return { course: JUMP_COURSE, checkpoint: 0, progress: 0, elapsed: 0, falls: 0, completed: false };
}
export function checkpointNumber(index) { return Math.floor(index / CHECKPOINT_EVERY); }
function platformTile(p) { return p.goal ? B.GOLD_BLOCK : p.checkpoint ? B.DIAMOND_BLOCK : p.crumble ? B.NETHERRACK : B.STONE_BRICKS; }
function putPlatform(w, p, present) {
  for (let x = p.x; x < p.x + p.width; x++) {
    w.tiles[idx(x, p.y)] = present ? platformTile(p) : B.AIR;
    w.tiles[idx(x, p.y + 1)] = present ? B.PURPUR : B.AIR;
  }
}
export function makeJumpWorld(seed) {
  const w = { seed, sky: new Uint8Array(W * H), blk: new Uint8Array(W * H), tiles: new Uint8Array(W * H), bg: new Uint8Array(W * H), meta: new Uint8Array(W * H), surface: new Int16Array(W).fill(H - 1), biome: new Uint8Array(W) };
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
    if (!p.onGround) continue;
    const i = JUMP_PLATFORMS.findIndex(b => p.x + p.w > b.x && p.x < b.x + b.width && Math.abs(p.y + p.h - b.y) < 0.12);
    if (i < 0) continue;
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
    if (p.checkpoint) {
      g.fillStyle = '#e8edfa'; g.fillRect(x - T * 0.04, y - T * 2.8, T * 0.08, T * 2.8);
      g.fillStyle = p.goal ? '#ffd563' : i <= G.jump.checkpoint ? '#72efbe' : '#85cfff';
      g.fillRect(x, y - T * 2.8, T * 0.9, T * 0.65);
    }
    g.font = `bold ${Math.max(11, T * 0.28)}px sans-serif`; g.textAlign = 'center';
    const label = p.goal ? '★ 도착!' : i === 0 ? '출발 →' : p.checkpoint ? `◆ 체크포인트 ${checkpointNumber(i)}` : `${i}${p.crumble ? ' ⚠' : ''}`;
    const ly = y - T * (p.checkpoint ? 3.1 : 0.35);
    g.fillStyle = '#142238'; const width = g.measureText(label).width + T * 0.28;
    g.fillRect(x - width / 2, ly - T * 0.32, width, T * 0.45);
    g.fillStyle = '#fff4d5'; g.fillText(label, x, ly);
  }
  g.textAlign = 'start';
}
