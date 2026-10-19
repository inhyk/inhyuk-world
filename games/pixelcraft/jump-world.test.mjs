import test from 'node:test';
import assert from 'node:assert/strict';
import { makeJumpWorld, JUMP_PLATFORMS, resetJumper, tickJumpWorld } from '../../public/play/pixelcraft/jump-world.mjs';
import { moveBody } from '../../public/play/pixelcraft/core.mjs';
test('기본 점프 물리로 모든 발판을 순서대로 건널 수 있다', () => {
  const w = makeJumpWorld(42);
  for (let i = 1; i < JUMP_PLATFORMS.length; i++) {
    const a = JUMP_PLATFORMS[i-1], b = JUMP_PLATFORMS[i];
    let reached = false;
    const p = { x: a.x + a.width - 0.7, y: a.y - 1.8, w: 0.6, h: 1.8, vx: 4.3, vy: -9.4, step: true, stepLift: 0 };
    for (let k = 0; k < 100; k++) {
      p.vy = Math.min(28, p.vy + 30 / 120); moveBody(w, p, 1 / 120);
      if (p.onGround && p.x + p.w > b.x && p.x < b.x + b.width && Math.abs(p.y + p.h - b.y) < 0.1) { reached = true; break; }
    }
    assert.ok(reached, `발판 ${i}`);
  }
});
test('체크포인트, 낙하 재시작, 완주 기록이 두 플레이어에 적용된다', () => {
 const player = { w: 0.6, h: 1.8 }, companion = { w: 0.6, h: 1.8 };
 resetJumper(player, 6); resetJumper(companion, 0); player.onGround = true;
 const G = { player, companion, adventure: { coop: true }, jump: { checkpoint: 0, progress: 0, elapsed: 0, falls: 0, completed: false } };
 tickJumpWorld(G, 1); assert.equal(G.jump.checkpoint, 6);
 companion.y = 90; tickJumpWorld(G, 1); assert.equal(G.jump.falls, 1); assert.equal(companion.x, player.spawn.x);
 resetJumper(player, 30); player.onGround = true; tickJumpWorld(G, 1);
 assert.equal(G.jump.completed, true); const time = G.jump.elapsed; tickJumpWorld(G, 1); assert.equal(G.jump.elapsed, time);
});
