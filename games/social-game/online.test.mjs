import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GAME, TOWNS, townId, townName, KEY_RE, blockKey, parseBlockKey, buildKeyOf, blockValue, parseBlockValue,
  propKey, parsePropKey, scatterKey, cellAlive, packPose, unpackPose, samePose, HIDDEN, lerpAngle, follow,
  isPrivate, PRIVATE_SITES, lookFor, SoloBlocks, placeErrorText, TEXT,
} from './online.mjs';

test('town ids are valid world names', () => {
  assert.equal(GAME, 'social-game');
  assert.deepEqual(TOWNS, ['town-1', 'town-2', 'town-3', 'town-4']);
  for (const t of TOWNS) assert.match(t, /^[a-z0-9-]{1,16}$/);
  assert.equal(townId(1), 'town-1');
  assert.equal(townId(4), 'town-4');
  assert.equal(townId(0), null);
  assert.equal(townId(5), null);
  assert.equal(townName('town-3'), '동네 3');
});

test('block keys match the Build key and the server key rule', () => {
  const k = blockKey(-149.5, 0.2633, -32.5);
  assert.equal(k, 'b|-149.5|0.26|-32.5');
  assert.match(k, KEY_RE);
  assert.equal(buildKeyOf(k), `${-149.5}|${(0.2633).toFixed(2)}|${-32.5}`);
  assert.deepEqual(parseBlockKey(k), { x: -149.5, y: 0.26, z: -32.5 });
  // round trip: the parsed position gives the same key again
  const p = parseBlockKey(k);
  assert.equal(blockKey(p.x, p.y, p.z), k);
  // far away (Japan) and high up still fit in 64 characters
  assert.match(blockKey(3012.5, 123.45, -260.5), KEY_RE);
  assert.equal(blockKey(-0.5, -0.04, 0.5), 'b|-0.5|-0.04|0.5');
});

test('bad block keys are refused', () => {
  for (const k of ['', 'b|', 'b|1|2', 'b|1|2|3|4', 'p|1|2|3', 'b|x|0|0', 'b|1||3', null, 7, 'b|1|2|3 ']) assert.equal(parseBlockKey(k), null, String(k));
});

test('block values are short and checked', () => {
  assert.deepEqual(blockValue('stone', 1), { i: 'stone', r: 1 });
  assert.deepEqual(blockValue('lamp', 5), { i: 'lamp', r: 1 });
  assert.deepEqual(blockValue('log', -1), { i: 'log', r: 3 });
  assert.ok(JSON.stringify(blockValue('flower', 3)).length < 256);
  const known = { stone: {}, lamp: {} };
  assert.deepEqual(parseBlockValue({ i: 'stone', r: 2 }, known), { id: 'stone', rot: 2 });
  assert.deepEqual(parseBlockValue({ i: 'stone', r: 9 }, known), { id: 'stone', rot: 0 });
  assert.equal(parseBlockValue({ i: 'diamond', r: 0 }, known), null, 'unknown block');
  assert.equal(parseBlockValue({ i: 'toString' }, known), null, 'not an own block id');
  assert.equal(parseBlockValue({ i: 'stone' }, new Set(['lamp'])), null);
  for (const v of [null, 1, 'stone', { r: 1 }, { i: 3 }, { i: 'a'.repeat(25) }, { i: '<b>' }]) assert.equal(parseBlockValue(v), null, JSON.stringify(v));
});

test('prop keys', () => {
  const key = scatterKey('round2', 57);
  assert.equal(key, 'round2.57');
  assert.equal(propKey(key), 'p|round2.57');
  assert.match(propKey(key), KEY_RE);
  assert.equal(parsePropKey('p|round2.57'), 'round2.57');
  assert.equal(parsePropKey('b|1|2|3'), null);
  assert.equal(parsePropKey('p|'), null);
  assert.equal(propKey(''), null);
  assert.equal(propKey('bad key'), null);
});

test('cells with a passed exp no longer count', () => {
  assert.equal(cellAlive({ v: 1 }), true);
  assert.equal(cellAlive({ v: 1, exp: 2000 }, 1000), true);
  assert.equal(cellAlive({ v: 1, exp: 1000 }, 1000), false);
  assert.equal(cellAlive(null), false);
});

test('poses pack to small number arrays and back', () => {
  const d = packPose({ mode: 'walk', x: 10.1234, y: 0.256, z: -33.987, yaw: 1.23456, kid: true });
  assert.deepEqual(d, [1, 10.12, 0.26, -33.99, 1.235, 1]);
  assert.ok(d.every((n) => typeof n === 'number'), 'numbers only (strings get filtered)');
  assert.ok(JSON.stringify(d).length < 512);
  const p = unpackPose(d);
  assert.deepEqual(p, { mode: 'walk', x: 10.12, y: 0.26, z: -33.99, yaw: 1.235, kid: true, hidden: false });
  const drive = unpackPose(packPose({ mode: 'drive', x: 1, y: 2, z: 3, yaw: 7 }));
  assert.equal(drive.mode, 'drive');
  assert.ok(Math.abs(drive.yaw - (7 - Math.PI * 2)) < 0.001, 'yaw wraps to -PI..PI');
  assert.equal(drive.kid, false);
});

test('a hidden pose carries no position', () => {
  assert.deepEqual(HIDDEN, [4]);
  assert.deepEqual(packPose({ mode: 'hidden', x: 5, y: 6, z: 7 }), [4]);
  assert.deepEqual(unpackPose([4]), { mode: 'hidden', hidden: true });
  assert.deepEqual(unpackPose([4, 1, 2, 3]), { mode: 'hidden', hidden: true });
});

test('garbage poses are ignored', () => {
  for (const d of [null, {}, [], 'x', [9, 0, 0, 0, 0], [1.5, 0, 0, 0, 0], [1, 'a', 0, 0, 0], [1, 0, 0, 0], [1, NaN, 0, 0, 0], [1, 1e9, 0, 0, 0], new Array(20).fill(1)]) {
    assert.equal(unpackPose(d), null, JSON.stringify(d));
  }
});

test('samePose', () => {
  assert.equal(samePose([1, 2, 3], [1, 2, 3]), true);
  assert.equal(samePose([1, 2, 3], [1, 2, 4]), false);
  assert.equal(samePose(null, [1]), false);
});

test('angles blend the short way and smoothing does not depend on frame rate', () => {
  const a = lerpAngle(3.0, -3.0, 0.5);
  assert.ok(Math.abs(Math.abs(a) - Math.PI) < 0.3, `went the long way: ${a}`);
  assert.equal(lerpAngle(0, 1, 0.5), 0.5);
  const two = 1 - (1 - follow(1 / 60)) ** 2;
  assert.ok(Math.abs(two - follow(1 / 30)) < 1e-9);
  assert.ok(follow(0) === 0 && follow(10) > 0.99);
});

test('private places: home, the trip bedrooms, the whole home tower', () => {
  for (const s of ['home', 'pension', 'ryokan']) assert.ok(PRIVATE_SITES.has(s));
  assert.equal(isPrivate('home', { x: 0, y: 0, z: 0 }), true);
  assert.equal(isPrivate('office', { x: 0, y: 0, z: 0 }), false);
  assert.equal(isPrivate(null, { x: 0, y: 0, z: 0 }), false);
  const box = { min: [-163, -5, -40], max: [-137, 100, -26] };
  assert.equal(isPrivate(null, { x: -150, y: 21.3, z: -33 }, box), true, 'elevator / 8층 inside the tower');
  assert.equal(isPrivate(null, { x: -150, y: 0, z: -20 }, box), false, 'the parking lot in front is not');
  assert.equal(isPrivate('store', { x: -110, y: 0, z: -17 }, box), false);
});

test('looks come from the user id and stay the same', () => {
  const a = lookFor(7), b = lookFor(7), c = lookFor(8);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  for (const id of [1, 2, 3, 999, 0, undefined]) {
    const l = lookFor(id);
    assert.ok(['short', 'spiky', 'bob', 'long', 'bun'].includes(l.hair));
    assert.ok(Number.isInteger(l.seed) && Number.isInteger(l.carColor) && typeof l.outfit === 'string');
  }
});

test('solo blocks are kept untouched while online and come back after', () => {
  const solo = new SoloBlocks();
  const mine = [{ id: 'stone', x: 1.5, y: 0, z: 2.5, rot: 0 }, { id: 'lamp', x: 3.5, y: 0.26, z: 2.5, rot: 2 }];
  assert.equal(solo.active, false);
  assert.equal(solo.forSave(mine), mine, 'solo play saves what is on screen');
  solo.enter(mine);
  assert.equal(solo.active, true);
  mine[0].id = 'changed'; // the caller's array changing does not touch the kept copy
  const town = [{ id: 'brick', x: 9.5, y: 0, z: 9.5, rot: 1 }];
  const saved = solo.forSave(town);
  assert.deepEqual(saved.map((b) => b.id), ['stone', 'lamp'], 'online: the save keeps the solo blocks, never the town');
  saved[0].id = 'x';
  assert.equal(solo.forSave(town)[0].id, 'stone', 'the save gets a copy');
  solo.enter([{ id: 'brick', x: 0, y: 0, z: 0 }]);
  assert.equal(solo.forSave([])[0].id, 'stone', 'entering twice keeps the first (real solo) list');
  const back = solo.leave();
  assert.deepEqual(back, [{ id: 'stone', x: 1.5, y: 0, z: 2.5, rot: 0 }, { id: 'lamp', x: 3.5, y: 0.26, z: 2.5, rot: 2 }]);
  assert.equal(solo.active, false);
  assert.deepEqual(solo.leave(), []);
});

test('error texts are short Korean', () => {
  assert.equal(placeErrorText('taken'), TEXT.taken);
  assert.equal(placeErrorText('limit'), TEXT.limit);
  assert.equal(placeErrorText('world-full'), TEXT.worldFull);
  assert.equal(placeErrorText('missing'), null);
  assert.equal(TEXT.notMine('철수'), '철수 님의 블럭이에요');
  assert.equal(TEXT.notDeployed, '같이 사는 동네는 아직 준비 중이에요');
});
