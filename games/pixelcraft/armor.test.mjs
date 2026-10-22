import { test } from 'node:test';
import assert from 'node:assert/strict';
import { I, ITEMS, ARMOR_MATERIALS, RECIPES, durabilityOf } from '../../public/play/pixelcraft/data.mjs';
import { canCraft, craftFromSlots } from '../../public/play/pixelcraft/core.mjs';
import { absorbDamage, armorPoints } from '../../public/play/pixelcraft/armor.mjs';
const full = material => ({ armor: ARMOR_MATERIALS[material].ids.map(id => ({ id, count: 1, dur: durabilityOf(id) })) });

test('16 armor pieces each have a valid recipe, material cost, single stack and durability', () => {
  for (const def of Object.values(ARMOR_MATERIALS)) def.ids.forEach((id, slot) => {
    const recipe = RECIPES.find(r => r.out[0] === id);
    const count = [5, 8, 7, 4][slot];
    const inventory = [{ id: def.ingredient, count }];
    assert.equal(canCraft(inventory, recipe), true);
    assert.equal(craftFromSlots(inventory, recipe), true);
    assert.equal(inventory[0], null);
    assert.equal(canCraft([{ id: def.ingredient, count: count - 1 }], recipe), false);
    assert.equal(ITEMS[id].stack, 1);
    assert.ok(durabilityOf(id) > 0);
  });
});
test('armor reduces combat damage, wears out, breaks, and does not protect falling/drowning/hunger', () => {
  const bare = { armor: Array(4).fill(null) };
  assert.equal(absorbDamage(bare, 10, '좀비'), 10);
  const diamond = full('diamond');
  assert.equal(armorPoints(diamond), 20);
  assert.ok(Math.abs(absorbDamage(diamond, 10, '좀비') - 2) < 1e-8);
  assert.equal(diamond.armor[0].dur, durabilityOf(I.DIAMOND_HELMET) - 2);
  for (const cause of ['fall', 'drown', 'starve', 'void']) assert.equal(absorbDamage(diamond, 10, cause), 10);
  assert.ok(absorbDamage(full('iron'), 10, 'lava') < absorbDamage(full('leather'), 10, 'lava'));
  const broken = { armor: [{ id: I.DIAMOND_HELMET, count: 1, dur: 1 }] };
  absorbDamage(broken, 4, '스켈레톤');
  assert.equal(broken.armor[0], null);
  assert.equal(armorPoints(broken), 0);
  assert.equal(armorPoints({ armor: [{ id: I.DIAMOND_CHEST, dur: 30 }] }), 0, 'wrong slot gives no defense');
});
