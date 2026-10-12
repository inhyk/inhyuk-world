import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState, boostEffects, clickIncome } from '../../public/play/keycap-clicker/core.mjs';
import { newBoss, bossDamage, hitBoss } from '../../public/play/keycap-clicker/progression.mjs';

function defeat(s, boss, damage) {
  let hits = 0;
  while (!boss.defeated && hits < 1000) {
    hitBoss(s, boss, 1, damage);
    hits++;
  }
  assert.equal(boss.defeated, true, 'valid attacks can finish the fight');
  return hits;
}

test('starter boss needs 90 taps and allows 18 seconds', () => {
  const s = freshState(), boss = newBoss(s, 500);
  assert.equal(boss.rank, 1);
  assert.equal(boss.maxHp, 90);
  assert.equal(boss.hp, 90);
  assert.equal(boss.until, 18500);
  assert.equal(boss.reward, 80);
  for (let i = 0; i < 89; i++) assert.equal(hitBoss(s, boss, 1000), 0);
  assert.equal(boss.hp, 1);
  assert.equal(s.stats.bosses, 0);
  assert.equal(hitBoss(s, boss, 1000), 80);
  assert.equal(s.stats.bosses, 1);
});

test('boss HP scales with victories and collected keycaps, then caps at 600', () => {
  const s = freshState();
  assert.equal(newBoss(s, 0).maxHp, 90);
  s.stats.bosses = 4;
  assert.equal(newBoss(s, 0).maxHp, 186);
  s.level = 20;
  const advanced = newBoss(s, 0);
  assert.equal(advanced.rank, 5);
  assert.equal(advanced.maxHp, 246);
  assert.equal(advanced.reward, clickIncome(s) * 100);
  s.level = 100;
  s.stats.bosses = 20;
  const capped = newBoss(s, 0);
  assert.equal(capped.maxHp, 600);
  assert.equal(capped.reward, clickIncome(s) * 180);
  s.stats.bosses = 1000;
  assert.equal(newBoss(s, 0).maxHp, 600);
});

test('armor starts exactly at half HP and changes subsequent attacks', () => {
  const s = freshState(), boss = newBoss(s, 0);
  boss.hp = 46;
  assert.equal(bossDamage(boss, 6), 6);
  assert.equal(hitBoss(s, boss, 1, 6), 0);
  assert.equal(boss.hp, 40, 'an attack crossing halfway lands before armor');
  assert.equal(bossDamage(boss, 6), 4);
  assert.equal(hitBoss(s, boss, 2, 6), 0);
  assert.equal(boss.hp, 36);
  boss.hp = 45;
  assert.equal(bossDamage(boss, 6), 4);
  assert.equal(bossDamage(boss, 3), 2);
  assert.equal(bossDamage(boss, 1), 1);
  assert.equal(boss.hp, 45, 'damage previews do not mutate the boss');
});

test('max hammer helps substantially while bosses still take many attacks', () => {
  const basic = freshState();
  assert.equal(defeat(basic, newBoss(basic, 0), boostEffects(basic).bossDamage), 90);
  const upgraded = freshState();
  upgraded.boosts.hammer = 5;
  assert.equal(boostEffects(upgraded).bossDamage, 6);
  assert.equal(defeat(upgraded, newBoss(upgraded, 0), boostEffects(upgraded).bossDamage), 19);
  upgraded.level = 100;
  upgraded.stats.bosses = 20;
  assert.equal(defeat(upgraded, newBoss(upgraded, 0), boostEffects(upgraded).bossDamage), 125);
});

test('invalid attacks cannot damage, heal, finish, or pay out a boss', () => {
  for (const damage of [NaN, Infinity, -Infinity, 0, -1, -100, '6', null]) {
    const s = freshState(), boss = newBoss(s, 0);
    boss.hp = 1;
    const stateBefore = structuredClone(s), bossBefore = { ...boss };
    assert.equal(hitBoss(s, boss, 1, damage), 0);
    assert.deepEqual(s, stateBefore);
    assert.deepEqual(boss, bossBefore);
  }
});

test('rewards stay fixed after a keycap upgrade and pay once on overkill', () => {
  const s = freshState(), boss = newBoss(s, 0), reward = boss.reward;
  s.level = 20;
  s.boosts.power = 5;
  assert.ok(clickIncome(s) * 80 > reward);
  boss.hp = 1;
  assert.equal(hitBoss(s, boss, 1, 1000), reward);
  assert.equal(boss.hp, 0);
  assert.equal(s.money, reward);
  assert.equal(s.earned, reward);
  assert.equal(s.stats.bosses, 1);
  assert.equal(hitBoss(s, boss, 2, 1000), 0);
  assert.equal(s.money, reward);
  assert.equal(s.earned, reward);
  assert.equal(s.stats.bosses, 1);
});

test('attacks at or after the deadline leave HP and rewards unchanged', () => {
  for (const now of [18000, 18001]) {
    const s = freshState(), boss = newBoss(s, 0);
    boss.hp = 1;
    const stateBefore = structuredClone(s), bossBefore = { ...boss };
    assert.equal(hitBoss(s, boss, now, 1000), 0);
    assert.deepEqual(s, stateBefore);
    assert.deepEqual(boss, bossBefore);
  }
});
