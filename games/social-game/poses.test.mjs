import test from 'node:test';
import assert from 'node:assert/strict';
import { POSES, poseNum, poseAt, poseMode, poseForKey } from './poses.mjs';

test('poses: about a dozen, each with a unique id, an emoji and a Korean name', () => {
  assert.ok(POSES.length >= 12 && POSES.length <= 16);
  assert.equal(new Set(POSES.map((p) => p.id)).size, POSES.length);
  for (const p of POSES) {
    assert.match(p.id, /^[a-z]+$/);
    assert.ok(p.icon && p.name);
    assert.match(p.name, /[가-힣]/);
  }
  for (const id of ['wave', 'heart', 'dance', 'sit', 'lie', 'jump', 'bow', 'clap']) assert.ok(poseNum(id) > 0, id);
});

test('pose numbers go both ways and reject anything else', () => {
  POSES.forEach((p, i) => { assert.equal(poseNum(p.id), i + 1); assert.equal(poseAt(i + 1), p); });
  assert.equal(poseNum('nope'), 0);
  assert.equal(poseNum(undefined), 0);
  for (const bad of [0, -1, POSES.length + 1, 1.5, '1', null, undefined, NaN]) assert.equal(poseAt(bad), null);
});

test('pose modes for the character', () => {
  assert.equal(poseMode('dance'), 'pose:dance');
  assert.equal(poseMode('nope'), 'idle');
});

test('number keys in the open menu pick poses 1~9 and 0 = the 10th', () => {
  assert.equal(poseForKey('Digit1'), POSES[0].id);
  assert.equal(poseForKey('Digit9'), POSES[8].id);
  assert.equal(poseForKey('Numpad3'), POSES[2].id);
  assert.equal(poseForKey('Digit0'), POSES[9].id);
  assert.equal(poseForKey('KeyA'), null);
  assert.equal(poseForKey(undefined), null);
});
