import test from 'node:test';
import assert from 'node:assert/strict';
import { makeJumpWorld, JUMP_PLATFORMS, resetJumper, tickJumpWorld, newJumpState, CRUMBLE_DELAY } from '../../public/play/pixelcraft/jump-world.mjs';
import { moveBody } from '../../public/play/pixelcraft/core.mjs';
test('달리기 점프 물리로 모든 발판을 순서대로 건널 수 있다', () => {
  const w = makeJumpWorld(42);
  for (let i = 1; i < JUMP_PLATFORMS.length; i++) {
    const a = JUMP_PLATFORMS[i-1], b = JUMP_PLATFORMS[i];
    let reached = false;
    for (const offset of [0.45, 0.3, 0.15, 0.05]) {
    const p = { x: a.x + a.width - offset, y: a.y - 1.8, w: 0.6, h: 1.8, vx: 5.6, vy: -9.4, step: true, stepLift: 0 };
    for (let k = 0; k < 100; k++) {
      p.vy = Math.min(28, p.vy + 30 / 60); moveBody(w, p, 1 / 60);
      if (p.onGround && p.x + p.w > b.x && p.x < b.x + b.width && Math.abs(p.y + p.h - b.y) < 0.1) { reached = true; break; }
    }
    if (reached) break;
    }
    assert.ok(reached, `발판 ${i}`);
  }
});
test('체크포인트, 낙하 재시작, 완주 기록이 두 플레이어에 적용된다', () => {
 const player = { w: 0.6, h: 1.8 }, companion = { w: 0.6, h: 1.8 };
 resetJumper(player, 15); resetJumper(companion, 0); player.onGround = true;
 const G = { w: makeJumpWorld(42), player, companion, adventure: { coop: true }, jump: newJumpState() };
 tickJumpWorld(G, 1); assert.equal(G.jump.checkpoint, 15);
 companion.y = 90; tickJumpWorld(G, 1); assert.equal(G.jump.falls, 1); assert.equal(companion.x, player.spawn.x);
 resetJumper(player, 60); player.onGround = true; tickJumpWorld(G, 1);
 assert.equal(G.jump.completed, true); const time = G.jump.elapsed; tickJumpWorld(G, 1); assert.equal(G.jump.elapsed, time);
});

test('붕괴 발판은 몸을 지지하다 무너지고 2.5초 뒤 다시 생긴다', () => {
 const w = makeJumpWorld(42), player = { w: 0.6, h: 1.8 }, companion = {};
 resetJumper(player, 2); player.onGround = true;
 const G = { w, player, companion, adventure: { coop: false }, jump: newJumpState() };
 tickJumpWorld(G, 0.01);
 tickJumpWorld(G, CRUMBLE_DELAY + 0.01);
 moveBody(w, player, 0.05); assert.equal(player.onGround, false);
 player.vy = 3; moveBody(w, player, 0.1); assert.ok(player.y > JUMP_PLATFORMS[2].y - 1.8);
 tickJumpWorld(G, 2.51); resetJumper(player, 2); player.vy = 1;
 moveBody(w, player, 0.05); assert.equal(player.onGround, true);
});
