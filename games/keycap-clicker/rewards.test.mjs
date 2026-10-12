import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshStreak, rewardPress, addBonus, COMBO_WINDOW } from '../../public/play/keycap-clicker/rewards.mjs';
import { freshState, press } from '../../public/play/keycap-clicker/core.mjs';

test('combo breaks after a pause while fever charge survives; rewards occur at clear milestones', () => {
  const streak = freshStreak();
  for (let i = 1; i <= 25; i++) {
    const r = rewardPress(streak, i * 100, .5);
    assert.equal(r.combo, i);
    assert.equal(r.bonusReady, i === 25);
    assert.equal(r.milestone, i % 10 === 0);
  }
  const r = rewardPress(streak, 2500 + COMBO_WINDOW + 1, .5);
  assert.equal(r.combo, 1); assert.equal(streak.best, 25); assert.equal(streak.charge, 26);
});
test('50 presses trigger eight seconds of fever; critical stacks to 15x, then expires', () => {
  const streak = freshStreak();
  for (let i = 1; i < 50; i++) rewardPress(streak, i * 100, .5);
  const start = rewardPress(streak, 5000, .5);
  assert.equal(start.startedFever, true); assert.equal(start.multiplier, 3);
  assert.equal(streak.feverUntil, 13000);
  const critical = rewardPress(streak, 5100, 0);
  assert.equal(critical.multiplier, 15); assert.equal(streak.charge, 0);
  const expired = rewardPress(streak, 13000, .5);
  assert.equal(expired.fever, false); assert.equal(expired.multiplier, 1); assert.equal(streak.charge, 1);
});
test('bonus earnings are saved without adding fake presses and still respect the numeric limit', () => {
  const state = freshState();
  assert.equal(press(state, 5), 5); assert.equal(state.presses, 1);
  addBonus(state, 8); assert.equal(state.money, 13); assert.equal(state.earned, 13); assert.equal(state.presses, 1);
  assert.equal(press(state, 1000), 25);
  state.money = state.earned = Number.MAX_SAFE_INTEGER;
  addBonus(state, 8); assert.equal(state.money, Number.MAX_SAFE_INTEGER); assert.equal(state.earned, Number.MAX_SAFE_INTEGER);
});
