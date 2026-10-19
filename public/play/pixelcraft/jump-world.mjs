import { B } from './data.mjs';
import { W, H, idx, computeLight } from './core.mjs';

// 발판 사이 빈칸은 1칸, 오르막은 최대 1칸: 기본 점프로 모두 건널 수 있다.
export const JUMP_PLATFORMS = Array.from({ length: 31 }, (_, i) => ({
  x: 620 + i * 4, y: 62 - Math.min(5, Math.floor(i / 6)) - [0, 0, 1, 1, 0, 0][i % 6],
  width: 3,
  checkpoint: i % 6 === 0, goal: i === 30,
}));
export function makeJumpWorld(seed) {
  const w = { seed, sky: new Uint8Array(W * H), blk: new Uint8Array(W * H), tiles: new Uint8Array(W * H), bg: new Uint8Array(W * H), meta: new Uint8Array(W * H), surface: new Int16Array(W).fill(H - 1), biome: new Uint8Array(W) };
  for (let x = 0; x < W; x++) w.tiles[idx(x, H - 1)] = B.BEDROCK;
  for (const p of JUMP_PLATFORMS) for (let x = p.x; x < p.x + p.width; x++) {
    w.surface[x] = p.y;
    w.tiles[idx(x, p.y)] = p.goal ? B.GOLD_BLOCK : p.checkpoint ? B.DIAMOND_BLOCK : B.STONE_BRICKS;
    w.tiles[idx(x, p.y + 1)] = B.PURPUR;
  }
  computeLight(w, 0, W - 1);
  return w;
}
export function jumpSpawn(index = 0) {
  const p = JUMP_PLATFORMS[index] ?? JUMP_PLATFORMS[0];
  return { x: p.x + 0.7, y: p.y - 1.8 };
}
export function resetJumper(p, index) {
  const sp = jumpSpawn(index);
  Object.assign(p, sp, { vx: 0, vy: 0, hp: 20, food: 20, air: 10, fire: 0, flying: false, fallTop: sp.y, onGround: false, spawn: { ...sp } });
}
export function tickJumpWorld(G, dt, notify = () => {}, save = () => {}) {
  const j = G.jump;
  if (!j) return;
  if (!j.completed) j.elapsed += dt;
  G.time = 0.18; G.day = 1;
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
    j.progress = Math.max(j.progress, i);
    if (JUMP_PLATFORMS[i].checkpoint && i > j.checkpoint) {
      j.checkpoint = i; G.player.spawn = jumpSpawn(i); G.companion.spawn = jumpSpawn(i);
      notify(`체크포인트 ${i / 6} 저장!`); save();
    }
    if (JUMP_PLATFORMS[i].goal && !j.completed) {
      j.completed = true; notify('점프맵 완주! 황금 발판에 도착했어! R로 기록을 확인해 봐.'); save();
    }
  }
}
export function drawJumpWorld(g, G, sx, sy, T) {
  for (let i = 0; i < JUMP_PLATFORMS.length; i++) {
    const p = JUMP_PLATFORMS[i], x = sx(p.x + 1.5), y = sy(p.y);
    if (x < -T * 4 || x > g.canvas.width + T * 4) continue;
    if (p.checkpoint) {
      g.fillStyle = '#e8edfa'; g.fillRect(x - T * 0.04, y - T * 2.8, T * 0.08, T * 2.8);
      g.fillStyle = p.goal ? '#ffd563' : i <= G.jump.checkpoint ? '#72efbe' : '#85cfff';
      g.fillRect(x, y - T * 2.8, T * 0.9, T * 0.65);
    }
    g.font = `bold ${Math.max(11, T * 0.28)}px sans-serif`; g.textAlign = 'center';
    const label = p.goal ? '★ 도착!' : i === 0 ? '출발 →' : p.checkpoint ? `◆ 체크포인트 ${i / 6}` : `${i}`;
    const ly = y - T * (p.checkpoint ? 3.1 : 0.35);
    g.fillStyle = '#142238'; const width = g.measureText(label).width + T * 0.28;
    g.fillRect(x - width / 2, ly - T * 0.32, width, T * 0.45);
    g.fillStyle = '#fff4d5'; g.fillText(label, x, ly);
  }
  g.textAlign = 'start';
}
