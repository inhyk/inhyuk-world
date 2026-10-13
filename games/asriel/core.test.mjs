import test from 'node:test';
import assert from 'node:assert/strict';
import { ARENA, ATTACKS, FRIENDS, advanceIntro, saveFriend, createGame, startGame as startEncounter, chooseAction, confirmStrike, tick } from '../../public/play/asriel/core.mjs';
import { backgroundColor, TRACK_DURATION } from '../../public/play/asriel/presentation.mjs';
import { scoreAt } from '../../public/play/asriel/music.mjs';

function startGame(state) { startEncounter(state); for (let line = 0; line < 3; line++) advanceIntro(state); }

function advance(state, duration, keys = {}) {
  for (let frame = 0; frame < Math.ceil(duration * 60); frame++) tick(state, 1 / 60, keys, () => .5);
}
test('a complete encounter visits all twelve attacks and only ends when Asriel is saved', () => {
  const state = createGame(); startGame(state);
  assert.equal(chooseAction(state, 'save'), false);
  for (let round = 0; round < ATTACKS.length; round++) {
    assert.equal(state.round, round);
    assert.equal(state.mode, 'menu');
    chooseAction(state, 'hope'); advance(state, 1.6);
    assert.equal(state.mode, 'dodge');
    state.soul.invincible = 100;
    advance(state, ATTACKS[round].duration + .1);
    if (round === 4) { assert.equal(state.mode, 'transform'); advance(state, 3.1); }
  }
  assert.equal(state.mode, 'menu');
  assert.equal(chooseAction(state, 'fight'), false);
  chooseAction(state, 'save'); assert.equal(state.mode, 'friends');
  FRIENDS.forEach((friend, index) => { if (index) chooseAction(state, 'save'); saveFriend(state, index); assert.equal(state.mode, 'memory'); advance(state, 2.7); });
  chooseAction(state, 'save'); assert.equal(state.mode, 'salvation'); advance(state, 8.1); assert.equal(state.mode, 'won');
});
test('introduction, phase-two memories and menu color timing are independent of attacks', () => {
  const state = createGame(); startEncounter(state);
  assert.equal(state.mode, 'intro'); assert.equal(state.message, 'ASRIEL DREEMURR');
  advance(state, 5); assert.equal(state.round, 0);
  for (let line = 0; line < 3; line++) advanceIntro(state);
  chooseAction(state, 'act'); assert.equal(state.mode, 'act');
  advance(state, 6); assert.ok(state.musicTime >= 10);
  assert.notEqual(backgroundColor(state.musicTime), backgroundColor(0));
  assert.notEqual(backgroundColor(10), backgroundColor(12));
  assert.equal(backgroundColor(10, true), backgroundColor(20, true));
  state.mode = 'menu'; assert.equal(chooseAction(state, 'save'), false);
  state.round = 5; chooseAction(state, 'save');
  assert.equal(state.mode, 'friends'); state.hp = 30;
  assert.equal(saveFriend(state, 0), true); assert.equal(state.hp, 46); assert.equal(state.mode, 'memory'); advance(state, 2.7);
  chooseAction(state, 'save'); assert.equal(saveFriend(state, 0), false);
  assert.equal(state.savedFriends.length, 1);
});
test('the original score has a 182-second arrangement with layered voices and an ending', () => {
  assert.equal(TRACK_DURATION, 182);
  assert.ok(scoreAt(0).length >= 3);
  assert.ok(scoreAt(128).some(event => event.type === 'square'));
  assert.deepEqual(scoreAt(1456), []);
  for (let step = 0; step < 1456; step++) for (const event of scoreAt(step)) {
    assert.ok(event.duration > 0 && event.volume > 0 && Number.isFinite(event.note));
  }
});
test('stars burst into rings and saber collisions cover the swept blade', () => {
  const state = createGame(); startGame(state); chooseAction(state, 'hope'); advance(state, 1.6);
  state.soul.invincible = 100; advance(state, .8);
  assert.ok(state.bullets.filter(bullet => bullet.kind === 'star' && !bullet.big).length >= 8);
  state.round = 1; state.mode = 'menu'; chooseAction(state, 'hope'); advance(state, 1.6);
  const saber = state.bullets.find(bullet => bullet.kind === 'saber');
  assert.ok(saber);
  advance(state, .85); assert.ok(saber.angle > saber.startAngle);
});
test('damage, guard, invincibility, death and retry work', () => {
  const state = createGame(); startGame(state);
  chooseAction(state, 'hope'); advance(state, 1.6);
  const overlap = () => state.bullets.push({ kind: 'orb', x: state.soul.x, y: state.soul.y, vx: 0, vy: 0, radius: 8, age: 0, life: 1 });
  overlap(); tick(state, .01);
  assert.equal(state.hp, 88); assert.equal(state.hits, 1);
  overlap(); tick(state, .01); assert.equal(state.hp, 88);
  state.soul.invincible = 0; state.hp = 4; overlap(); tick(state, .01);
  assert.equal(state.mode, 'dead');
  startGame(state); assert.equal(state.hp, 92); assert.equal(state.round, 0); assert.equal(state.hits, 0);
});
test('healing is limited, timing restores HP, paused state and movement stay bounded', () => {
  const state = createGame(); startGame(state);
  state.hp = 40; chooseAction(state, 'heal'); assert.equal(state.hp, 76); assert.equal(state.dreams, 3);
  state.mode = 'menu'; state.dreams = 0; assert.equal(chooseAction(state, 'heal'), false);
  chooseAction(state, 'fight'); state.elapsed = .7; confirmStrike(state); assert.equal(state.hp, 88);
  state.mode = 'paused'; const snapshot = JSON.stringify(state); advance(state, 2); assert.equal(JSON.stringify(state), snapshot);
  state.mode = 'dodge'; state.soul.invincible = 100;
  advance(state, 2, { ArrowLeft: true, ArrowUp: true });
  assert.ok(state.soul.x >= ARENA.left + 8); assert.ok(state.soul.y >= ARENA.top + 8);
});
test('lightning telegraphs before damage and always leaves a safe lane', () => {
  const state = createGame(); startGame(state); state.round = 2;
  chooseAction(state, 'hope'); advance(state, 1.6);
  const beams = state.bullets.filter(bullet => bullet.kind === 'beam');
  assert.ok(beams.length > 0 && beams.length < 5);
  state.soul.x = beams[0].x; state.soul.y = 400;
  tick(state, .02); assert.equal(state.hits, 0);
  advance(state, .85); assert.equal(state.hits, 1);
});


test('phase two refuses death once and resumes the same attack, the next defeat can end the run', () => {
  const s = createGame(); startGame(s); s.round = 8; chooseAction(s, 'hope'); advance(s, 1.6);
  s.hp = 4; s.soul.invincible = 0;
  const hit = () => s.bullets.push({ kind: 'orb', x: s.soul.x, y: s.soul.y, vx: 0, vy: 0, radius: 8, age: 0, life: 1 });
  hit(); tick(s, .01); assert.equal(s.mode, 'refuse'); assert.equal(s.refusals, 1); assert.equal(s.round, 8);
  advance(s, 2.9); assert.equal(s.mode, 'warning'); assert.equal(s.hp, 92); assert.deepEqual(s.bullets, []);
  advance(s, 1.6); s.hp = 4; s.soul.invincible = 0; hit(); tick(s, .01); assert.equal(s.mode, 'dead');
});

test('new attacks generate finite geometry, telegraph prism and meteors, and clear between turns', () => {
  assert.equal(ATTACKS.length, 12);
  for (let round = 5; round < ATTACKS.length; round++) {
    const s = createGame(); startGame(s); s.round = round; chooseAction(s, 'hope'); advance(s, 1.6);
    assert.ok(s.bullets.length, ATTACKS[round].name);
    for (const b of s.bullets) assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y));
    if (['meteors', 'prism'].includes(ATTACKS[round].kind)) assert.ok(s.bullets.every(b => b.delay >= .6));
    s.soul.invincible = 100; advance(s, ATTACKS[round].duration + .1);
    assert.equal(s.mode, 'menu'); assert.deepEqual(s.bullets, []);
  }
});
