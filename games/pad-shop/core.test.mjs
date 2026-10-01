import test from 'node:test';
import assert from 'node:assert/strict';
import { TIERS, MODELS, PADS, PETS, HOUSES, REBIRTH_COSTS, EGG_COST, padFor, initial, restore, odds, modelOdds, rollTier, rollPet, hit, sell, skip, buy, rebirth, hatch, equipPet, nicknamePet, requestDelivery, deliver } from './core.mjs';

test('first pad is earnable from zero; unfinished pads cannot be sold and sales cannot repeat', () => {
  const s = initial(); assert.equal(sell(s).ok, false); assert.equal(skip(s).ok, false);
  for (let i = 0; i < 9; i++) { hit(s); assert.equal(sell(s).ok, false); }
  assert.equal(hit(s).completed, true); assert.equal(hit(s).ok, false);
  const result = sell(s, () => 0); assert.equal(result.price, 1000);
  assert.equal(s.money, 1000); assert.equal(s.collection[0], 1); assert.equal(s.sold, 1); assert.equal(s.order.progress, 0);
  assert.equal(sell(s).ok, false); assert.equal(s.money, 1000);
});
test('skip charges exactly 100 once, replaces the customer and clears work, cannot overdraw', () => {
  const s = initial(); s.money = 199; hit(s);
  assert.equal(skip(s, () => 0).ok, true); assert.equal(s.money, 99); assert.equal(s.order.progress, 0); assert.equal(s.order.customer, 1); assert.equal(s.skipped, 1);
  const before = structuredClone(s); assert.equal(skip(s).ok, false); assert.deepEqual(s, before);
});
test('buying charges once, equips the tool, strengthens hits, and prevents overspending', () => {
  const s = initial(); assert.equal(buy(s, 1).ok, false); s.money = 10000;
  assert.equal(buy(s, 1).ok, true); assert.equal(s.money, 0); assert.equal(s.equipped, 1);
  hit(s); assert.equal(s.order.progress, 22); buy(s, 0); buy(s, 1); assert.equal(s.money, 0); assert.deepEqual(s.owned, [0, 1]);
  assert.equal(buy(s, -1).ok, false); assert.equal(buy(s, TIERS.length).ok, false);
});
test('lower tier equipment cannot work a higher tier order; re-equipping resumes saved work', () => {
  const s = initial(); s.money = 50000; buy(s, 2); s.order.tier = 2; hit(s); buy(s, 0);
  assert.equal(hit(s).ok, false); assert.equal(s.order.progress, 40); buy(s, 2); hit(s); assert.equal(s.order.progress, 80);
});
test('all original rarity weights are reachable and normalize within the equipped tool limit', () => {
  assert.equal(TIERS[0].chance, 70); assert.equal(TIERS[1].chance, 50);
  for (let equipped = 0; equipped < TIERS.length; equipped++) {
    const rates = odds(equipped); assert.ok(Math.abs(rates.reduce((a, b) => a + b, 0) - 100) < 1e-10);
    assert.ok(rates.slice(equipped + 1).every(n => n === 0));
    let before = 0;
    for (let i = 0; i <= equipped; i++) { assert.equal(rollTier(equipped, () => (before + rates[i] / 2) / 100), i); before += rates[i]; }
    assert.equal(rollTier(equipped, () => 1), equipped);
  }
  assert.ok(Math.abs(odds(1)[1] - 50 / 120 * 100) < 1e-9); assert.ok(Math.abs(odds(2)[2] - 30 / 150 * 100) < 1e-9);
});
test('every pad sells at the handwritten price; EX tool victory happens only once', () => {
  const s = initial(); s.money = 10000000;
  assert.equal(buy(s, 6).victory, true); assert.equal(buy(s, 6).victory, undefined);
  for (let tier = 0; tier < 7; tier++) {
    s.order.tier = tier; s.order.progress = 0; const before = s.money;
    while (s.order.progress < TIERS[tier].work) hit(s);
    sell(s, () => 0); assert.equal(s.money - before, TIERS[tier].price); assert.equal(s.collection[tier], 1);
  }
});
test('saved money, upgrades, order progress, collection and settings survive a round-trip', () => {
  const s = initial(); s.money = 11000; buy(s, 1); hit(s); s.tutorial = true; s.sound = false;
  assert.deepEqual(restore(JSON.stringify(s)), s);
  assert.deepEqual(restore('{broken'), initial()); assert.deepEqual(restore(null), initial());
  const corrupt = restore({ version: 1, money: -1, owned: [99, -1, null], equipped: 99, order: { tier: 99, progress: Infinity }, collection: [1] });
  assert.deepEqual(corrupt, initial());
});
test('all 60 models can be completed and sold for their own price, with separate discoveries', () => {
  assert.equal(TIERS.length, 20); assert.equal(PADS.length, 60);
  const s = initial(); s.owned = [0, TIERS.length - 1]; s.equipped = TIERS.length - 1;
  for (const pad of PADS) {
    s.order = { tier: pad.tier, model: pad.model, progress: 0, customer: 0, special: false };
    const before = s.money;
    while (s.order.progress < pad.work) assert.equal(hit(s).ok, true);
    const result = sell(s, () => 0);
    assert.equal(result.pad, pad.id); assert.equal(s.money - before, pad.price); assert.equal(s.models[pad.id], 1);
  }
  assert.equal(s.sold, PADS.length); assert.deepEqual(s.collection, Array(TIERS.length).fill(MODELS.length));
});
test('buying a tool keeps the current order and queues no guaranteed rewards', () => {
  const s = initial(); s.money = TIERS[7].cost; hit(s);
  const existingOrder = structuredClone(s.order);
  assert.equal(buy(s, 7).ok, true); assert.deepEqual(s.order, existingOrder); assert.deepEqual(s.specialOrders, []);
});
test('version 1 save migrates all money, tools, discoveries and in-progress work without a reset', () => {
  const legacy = { version: 1, money: 12345678, earned: 23456789, sold: 12, skipped: 3, owned: [0, 2, 6], equipped: 6,
    order: { tier: 6, customer: 7, progress: 1099 }, collection: [2, 0, 3, 1, 2, 1, 3], tutorial: true, sound: false, won: true };
  const s = restore(JSON.stringify(legacy));
  assert.equal(s.version, 4); assert.equal(s.money, legacy.money); assert.deepEqual(s.owned, legacy.owned); assert.equal(s.equipped, 6);
  assert.equal(s.order.progress, 1099); assert.equal(s.order.model, 0); assert.equal(s.won, true); assert.equal(s.sound, false);
  assert.deepEqual(s.collection.slice(0, 7), legacy.collection); assert.ok(s.collection.slice(7).every(v => v === 0));
  legacy.collection.forEach((n, i) => assert.equal(s.models[i * MODELS.length], n));
  hit(s); assert.equal(sell(s, () => 0).price, 100000000); assert.equal(s.models[18], 4);
});
test('highest-grade pro pad progress and omega achievement persist independently from EX', () => {
  const s = initial(); s.money = TIERS.at(-1).cost;
  assert.equal(buy(s, TIERS.length - 1).mastery, true); assert.equal(s.master, true); assert.equal(s.won, false);
  assert.equal(buy(s, TIERS.length - 1).mastery, undefined);
  s.order = { tier: 19, model: 2, customer: 7, progress: PADS.at(-1).work - 1, special: false };
  const restored = restore(JSON.stringify(s)); assert.deepEqual(restored, s);
  assert.equal(hit(restored).completed, true); assert.equal(sell(restored, () => 0).price, 80000000000000);
});
test('all three variants can appear in ordinary orders', () => {
  for (let model = 0; model < MODELS.length; model++) {
    const s = initial(); s.money = 100;
    skip(s, () => (MODELS.slice(0, model).reduce((n, m) => n + m.chance, 0) + MODELS[model].chance / 2) / 100); assert.equal(s.order.model, model); assert.equal(s.order.special, false);
  }
});
test('rebirth adds one pad per craft up to five times and resets money and tools only', () => {
  const s = initial(); s.money = REBIRTH_COSTS[0] - 1; s.pets[0] = 1; s.pet = 0; s.nickname = '인혁';
  assert.equal(rebirth(s).ok, false);
  s.money = REBIRTH_COSTS[0]; buy(s, 1); s.money = REBIRTH_COSTS[0]; s.models[0] = 3;
  assert.equal(rebirth(s, () => 0).count, 2);
  assert.equal(s.money, 0); assert.deepEqual(s.owned, [0]); assert.equal(s.equipped, 0); assert.equal(s.order.tier, 0);
  assert.equal(s.models[0], 3); assert.equal(s.pet, 0); assert.equal(s.nickname, '인혁');
  while (s.order.progress < padFor(s.order).work) hit(s);
  const sale = sell(s, () => 0); assert.equal(sale.count, 2); assert.equal(sale.price, padFor({ tier: 0, model: 0 }).price * 2);
  assert.equal(s.sold, 2);
  for (let i = 1; i < 5; i++) { s.money = REBIRTH_COSTS[i]; assert.equal(rebirth(s).ok, true); }
  assert.equal(s.rebirth, 5); s.money = 1e12; assert.equal(rebirth(s).ok, false);
  assert.deepEqual(restore(JSON.stringify(s)), s);
});
test('eggs hatch pets by the handwritten weights and better pets boost rare odds', () => {
  assert.deepEqual(PETS.map(p => p.luck), [1.5, 2, 3.5, 5, 10, 50, 100]);
  assert.equal(rollPet(() => 0), 0); assert.equal(rollPet(() => 1), PETS.length - 1);
  const s = initial(); assert.equal(hatch(s).ok, false);
  s.money = EGG_COST * 3;
  assert.equal(hatch(s, () => 0.5).pet, 1); assert.equal(s.pet, 1);
  assert.equal(hatch(s, () => 0).equipped, false); assert.equal(s.pet, 1);
  assert.equal(equipPet(s, 0).ok, true); assert.equal(s.pet, 0); assert.equal(equipPet(s, 6).ok, false);
  assert.equal(s.money, EGG_COST);
  const base = odds(TIERS.length - 1), lucky = odds(TIERS.length - 1, 100);
  assert.ok(Math.abs(lucky.reduce((a, b) => a + b, 0) - 100) < 1e-9);
  assert.ok(Math.abs(lucky[1] / lucky[0] - base[1] / base[0] * 100) < 1e-9);
  assert.ok(odds(TIERS.length - 1, 100)[1] > odds(TIERS.length - 1, 50)[1]);
  assert.ok(modelOdds(100)[2] > modelOdds(50)[2]); assert.ok(Math.abs(modelOdds(100).reduce((a, b) => a + b, 0) - 100) < 1e-9);
  assert.deepEqual(restore(JSON.stringify(s)), s);
});
test('deliveries go to one of six roof colors and pay exactly the pad price', () => {
  assert.equal(HOUSES.length, 6);
  const s = initial(); s.rebirth = 3; assert.equal(deliver(s, 0).ok, false);
  assert.equal(requestDelivery(s, () => 0.99), true); assert.equal(s.delivery.house, 5);
  assert.equal(requestDelivery(s, () => 0), false);
  assert.equal(restore(JSON.stringify(s)).delivery.house, 5);
  const wrong = deliver(s, 1); assert.equal(wrong.wrong, true); assert.ok(s.delivery);
  const pad = padFor(s.delivery), result = deliver(s, 5);
  assert.equal(result.price, pad.price); assert.equal(s.money, pad.price); assert.equal(s.deliveries, 1); assert.equal(s.delivery, null);
  assert.equal(s.models[pad.id], 1);
});
test('nicknames are trimmed, limited and survive reloads', () => {
  const s = initial(); assert.equal(s.nickname, '');
  assert.equal(restore({ ...s, nickname: '   아주아주아주긴닉네임입니다  ' }).nickname, '아주아주아주긴닉네임');
  assert.equal(restore({ ...s, nickname: 42 }).nickname, '');
});
test('a pet name as nickname starts with that pet equipped', () => {
  const s = initial(); s.nickname = '피카츄'; assert.equal(nicknamePet(s), 6);
  assert.equal(s.pets[6], 1); assert.equal(s.pet, 6);
  assert.equal(nicknamePet(s), 6); assert.equal(s.pets[6], 1, 'renaming again gives no extra copies');
  const other = initial(); other.nickname = '늑 대'; assert.equal(nicknamePet(other), 5);
  const plain = initial(); plain.nickname = '인혁이'; assert.equal(nicknamePet(plain), null); assert.equal(plain.pet, null);
});
test('a 15-tool save keeps every discovery when five new tools are added', () => {
  const old = initial(); old.collection = Array(15).fill(2); old.models = Array(45).fill(1); old.owned = [0, 14]; old.equipped = 14;
  const s = restore(JSON.stringify(old));
  assert.deepEqual(s.owned, [0, 14]); assert.equal(s.collection.length, 20); assert.equal(s.models.length, 60);
  assert.deepEqual(s.collection.slice(0, 15), Array(15).fill(2)); assert.ok(s.collection.slice(15).every(v => v === 0));
  assert.deepEqual(s.models.slice(0, 45), Array(45).fill(1)); assert.ok(s.models.slice(45).every(v => v === 0));
  assert.equal(PADS[45].name, '갤럭시 패드'); assert.equal(PADS.at(-1).name, '유니버스 패드 프로');
});
