import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UPGRADES, freshState, currentKey, press, buy, restoreState, equippedKey, equip } from '../../public/play/keycap-clicker/core.mjs';

test('initial presses earn one won; upgrades deduct money and change future earnings', () => {
  const s = freshState();
  assert.equal(buy(s), false);
  for (let i = 0; i < 50; i++) assert.equal(press(s), 1);
  assert.equal(buy(s, 1), false);
  assert.equal(buy(s), true);
  assert.equal(s.money, 0); assert.equal(press(s), 2);
  assert.equal(s.earned, 52); assert.equal(s.presses, 51);
});
test('all 100 upgrades can be reached through actual presses and end without extra purchases', () => {
  const s = freshState();
  for (let i = 0; i < UPGRADES.length; i++) {
    const income = currentKey(s).income;
    while (s.money < UPGRADES[i].price) press(s);
    const before = s.money;
    assert.equal(buy(s), true);
    assert.equal(s.money, before - UPGRADES[i].price);
    assert.equal(currentKey(s).income, UPGRADES[i].income);
    assert.ok(currentKey(s).income >= income);
    assert.equal(buy(s, i), false);
  }
  assert.equal(s.level, 100); assert.equal(buy(s), false);
  assert.equal(press(s), UPGRADES.at(-1).income); assert.ok(s.presses < 40000);
  assert.deepEqual(restoreState(JSON.parse(JSON.stringify(s))), s);
});
test('damaged saves cannot inject invalid levels or negative and nonnumeric balances', () => {
  assert.deepEqual(restoreState(null), freshState());
  assert.deepEqual(restoreState({ level: 101, money: -1, earned: '200', presses: Infinity, sound: 'yes' }), freshState());
});


test('old golden-key saves continue with the new collection; equipping keeps highest income', () => {
  const s = restoreState({ level: 9, money: 1234, presses: 500, earned: 200000, sound: false });
  assert.equal(s.level, 9); assert.equal(s.equipped, 9); assert.equal(s.money, 1234);
  assert.equal(equip(s, 1), true); assert.equal(equippedKey(s).name, '밀크 키캡');
  assert.equal(press(s), 2048); assert.equal(equip(s, 10), false);
  assert.equal(equip(s, -1), false); assert.equal(equip(s, 1.5), false);
  assert.deepEqual(restoreState(JSON.parse(JSON.stringify(s))), s);
});

test('collections have unique names, increasing prices and safe integer earnings', () => {
  assert.equal(UPGRADES.length, 100);
  assert.equal(new Set(UPGRADES.map(k => k.name)).size, 100);
  for (let i = 1; i < UPGRADES.length; i++) {
    assert.ok(UPGRADES[i].price > UPGRADES[i-1].price);
    assert.ok(UPGRADES[i].income >= UPGRADES[i-1].income);
    assert.ok(Number.isSafeInteger(UPGRADES[i].price));
  }
  const s = restoreState({level:100, money:Number.MAX_SAFE_INTEGER, earned:Number.MAX_SAFE_INTEGER});
  press(s); assert.equal(s.money, Number.MAX_SAFE_INTEGER); assert.equal(s.earned, Number.MAX_SAFE_INTEGER);
});


test('every upgrade requires substantial saving at the preceding income and rejects short balances', () => {
  let lastRequired = 0;
  for (let i = 0; i < UPGRADES.length; i++) {
    const income = i ? UPGRADES[i-1].income : 1;
    const required = UPGRADES[i].price / income;
    assert.ok(required >= 50 && required <= 400);
    assert.ok(required >= lastRequired);
    lastRequired = required;
    const s = restoreState({level: i, money: UPGRADES[i].price - 1});
    assert.equal(buy(s), false);
    press(s); assert.equal(buy(s), true);
  }
  assert.equal(UPGRADES[0].price, 50);
  assert.equal(UPGRADES.at(-1).price / UPGRADES.at(-2).income, 400);
});
