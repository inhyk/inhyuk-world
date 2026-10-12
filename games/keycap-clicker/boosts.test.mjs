import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOOSTS, freshState, restoreState, clickIncome, boostEffects, boostPrice, buyBoost, equip } from '../../public/play/keycap-clicker/core.mjs';
import { freshStreak, rewardPress } from '../../public/play/keycap-clicker/rewards.mjs';

test('ability purchases charge the correct balance, double subsequent costs and cap at five', () => {
  const s = freshState();
  assert.equal(buyBoost(s, 'power'), false); assert.equal(buyBoost(s, 'unknown'), false);
  for (const b of BOOSTS) {
    for (let level = 0; level < 5; level++) {
      const price = boostPrice(s, b.id); s.money = price - 1;
      assert.equal(buyBoost(s, b.id), false); s.money++;
      assert.equal(buyBoost(s, b.id), true); assert.equal(s.money, 0);
      assert.equal(s.boosts[b.id], level + 1);
      if (level < 4) assert.equal(boostPrice(s, b.id), price * 2);
    }
    assert.equal(buyBoost(s, b.id), false);
  }
  assert.deepEqual(boostEffects(s), { power: 2.25, criticalChance: .18, feverDuration: 13000, coinMultiplier: 18, bossDamage: 6, feverCharge: 30 });
});
test('ability effects survive saves and re-equipping; old saves start with zero ability levels', () => {
  const s = restoreState({level:9,money:1000,boosts:{power:5,luck:5,battery:5,magnet:5}});
  assert.equal(clickIncome(s), 4608); equip(s, 1); assert.equal(clickIncome(s), 4608);
  assert.deepEqual(restoreState(JSON.parse(JSON.stringify(s))), s);
  const old = restoreState({level:9,money:1000}); assert.equal(old.level,9); assert.equal(old.money,1000); assert.equal(clickIncome(old),2048);
  assert.deepEqual(restoreState({boosts:{power:-1,luck:99,battery:'5',magnet:NaN}}).boosts,freshState().boosts);
});
test('upgraded luck and battery affect real critical and fever outcomes', () => {
  const streak = freshStreak(), effects = boostEffects(restoreState({boosts:{luck:5,battery:5}}));
  assert.equal(rewardPress(freshStreak(), 0, .15).critical, false);
  assert.equal(rewardPress(streak, 0, .15, effects).critical, true);
  for(let i=1;i<50;i++) rewardPress(streak,i*100,.5,effects);
  assert.equal(streak.feverDuration,13000); assert.equal(streak.feverUntil,17900);
  assert.equal(rewardPress(streak,17900,.5,effects).fever,false);
});
