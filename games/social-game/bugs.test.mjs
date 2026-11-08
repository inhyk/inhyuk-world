import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, BY_ID, HABITATS, activeAt, speciesFor, pickWeighted, fleeRadius, inNet, eul, caughtText, normBook, addCatch, release, bookStats, NET } from './bugs.mjs';
import { newState, serialize, deserialize } from './core.mjs';

test('곤충 table: the Korean insects from the plan, each with a place, a time, a fact', () => {
  const names = SPECIES.map((s) => s.name);
  for (const n of ['호랑나비', '배추흰나비', '고추잠자리', '무당벌레', '메뚜기', '방아깨비', '매미', '장수풍뎅이', '사슴벌레', '반딧불이', '개미']) assert.ok(names.includes(n), n);
  assert.ok(SPECIES.filter((s) => s.rare).length >= 3, 'a few rare ones');
  assert.equal(new Set(SPECIES.map((s) => s.id)).size, SPECIES.length, 'ids are unique');
  for (const s of SPECIES) {
    assert.ok(Object.keys(s.habitats).length && Object.keys(s.habitats).every((h) => HABITATS.includes(h)), `${s.id} habitats`);
    assert.ok(s.fact.length > 10 && s.where && s.emoji, `${s.id} has a fact, a place and an emoji`);
    assert.ok(s.size > 0.01 && s.size < 0.2, `${s.id} size in metres`);
    assert.ok(s.cap >= 1, `${s.id} cap`);
  }
});

test('hours: day insects by day, fireflies and beetles at night (wrapping past midnight)', () => {
  assert.ok(activeAt(BY_ID.swallowtail, 11) && !activeAt(BY_ID.swallowtail, 21));
  assert.ok(activeAt(BY_ID.firefly, 22) && activeAt(BY_ID.firefly, 1) && !activeAt(BY_ID.firefly, 12));
  assert.ok(activeAt(BY_ID.beetle, 23.5) && activeAt(BY_ID.beetle, 3) && !activeAt(BY_ID.beetle, 10));
  assert.ok(activeAt(BY_ID.cicada, 13) && !activeAt(BY_ID.cicada, 22));
  assert.ok(activeAt(BY_ID.firefly, 24 + 22), 'hours wrap');
});

test('spawn rules: what lives where, and when', () => {
  const ids = (h, t) => speciesFor(h, t).map((e) => e.id);
  assert.ok(ids('flower', 11).includes('swallowtail') && ids('flower', 11).includes('ladybug'));
  assert.ok(ids('water', 14).includes('dragonfly'));
  assert.ok(ids('grass', 10).includes('grasshopper') && ids('grass', 10).includes('acrida'));
  assert.ok(ids('tree', 12).includes('cicada') && !ids('tree', 12).includes('beetle'));
  assert.ok(ids('forest', 21).includes('beetle') && ids('forest', 21).includes('stag') && ids('forest', 21).includes('firefly'));
  assert.ok(!ids('forest', 21).includes('cicada'), 'cicadas sleep at night');
  assert.ok(ids('ground', 9).includes('ant'));
  assert.deepEqual(ids('flower', 2), [], 'no flower insects in the middle of the night');
  assert.ok(ids('forest', 12).includes('jewel') && !ids('tree', 12).includes('jewel'), '비단벌레 only deep in the forest');
});

test('weighted pick follows the weights', () => {
  const list = [{ id: 'a', w: 1 }, { id: 'b', w: 3 }];
  assert.equal(pickWeighted(list, 0.1).id, 'a');
  assert.equal(pickWeighted(list, 0.3).id, 'b');
  assert.equal(pickWeighted(list, 0.999).id, 'b');
  assert.equal(pickWeighted([], 0.5), null);
  const n = { a: 0, b: 0 };
  for (let i = 0; i < 1000; i++) n[pickWeighted(list, i / 1000).id]++;
  assert.ok(Math.abs(n.b / 1000 - 0.75) < 0.01);
});

test('wary insects flee sooner when you run; beetles and ants do not flee', () => {
  assert.ok(fleeRadius(BY_ID.cicada, 7.2) > fleeRadius(BY_ID.cicada, 4.3));
  assert.ok(fleeRadius(BY_ID.cicada, 0.8) < fleeRadius(BY_ID.cicada, 4.3), 'creeping up gets you closer');
  assert.ok(fleeRadius(BY_ID.cicada, 4.3) < NET.reach, 'walking up carefully you can still reach it');
  assert.equal(fleeRadius(BY_ID.beetle, 7.2), 0);
  assert.equal(fleeRadius(BY_ID.ant, 7.2), 0);
  assert.ok(BY_ID.dragonfly.dodge > BY_ID.swallowtail.dodge, 'the dragonfly is the hardest to catch');
});

test('the net catches what is in front of you within reach', () => {
  const eye = [0, 1.6, 0], dir = [0, 0, -1];
  assert.ok(inNet(eye, dir, [0, 1.6, -2]) > 0);
  assert.ok(inNet(eye, dir, [0.5, 1.3, -2]) > 0, 'a little off the aim still counts');
  assert.equal(inNet(eye, dir, [0, 1.6, 2]), -1, 'not behind');
  assert.equal(inNet(eye, dir, [0, 1.6, -4]), -1, 'not too far');
  assert.equal(inNet(eye, dir, [2, 1.6, -1]), -1, 'not far to the side');
  assert.equal(inNet(eye, dir, [0, 1.6, -0.1]), -1, 'not inside your head');
});

test('Korean toasts use the right particle', () => {
  assert.equal(eul('호랑나비'), '를');
  assert.equal(eul('매미'), '를');
  assert.equal(eul('곰'), '을');
  assert.equal(caughtText(BY_ID.swallowtail), '🦋 호랑나비를 잡았다!');
});

test('도감 save: counts, first day, release, and junk in old saves is cleaned', () => {
  const b = normBook(undefined);
  assert.deepEqual(b, { c: {}, seen: {}, tip: 0 });
  assert.equal(addCatch(b, 'swallowtail', 3), true, 'first one is new');
  assert.equal(addCatch(b, 'swallowtail', 4), false);
  assert.equal(addCatch(b, 'nope', 4), false);
  assert.deepEqual(b.c, { swallowtail: 2 });
  assert.equal(b.seen.swallowtail, 3);
  assert.equal(release(b, 'swallowtail'), true);
  assert.equal(release(b, 'swallowtail'), true);
  assert.equal(release(b, 'swallowtail'), false);
  assert.deepEqual(b.c, {});
  assert.equal(b.seen.swallowtail, 3, 'still in the 도감 after letting them go');
  assert.deepEqual(bookStats(b), { kinds: 1, kept: 0, all: SPECIES.length });
  const junk = normBook({ c: { ladybug: '3', alien: 5, ant: -2, cicada: 1e9 }, seen: { stag: 2, ghost: 1 }, tip: 'x' });
  assert.deepEqual(junk.c, { ladybug: 3, cicada: 9999 });
  assert.deepEqual(junk.seen, { ladybug: 1, stag: 2, cicada: 1 });
  assert.equal(junk.tip, 0);
});

test('the 도감 rides along in the game save (local and cloud use serialize)', () => {
  const s = newState();
  s.bugs = normBook(null);
  addCatch(s.bugs, 'firefly', 2);
  const back = deserialize(serialize(s));
  assert.deepEqual(normBook(back.bugs).c, { firefly: 1 });
  assert.deepEqual(normBook(deserialize(serialize(newState())).bugs).c, {}, 'old saves without a 도감 start empty');
});
