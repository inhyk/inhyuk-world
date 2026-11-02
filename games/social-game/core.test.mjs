import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKind, weekday, stepsFor, newState, tickBody, eat, fallDamage, snapCell, formatClock, workTask, checkWork, meatState, serialize, deserialize } from './core.mjs';

test('a week has work, a company dinner, a business trip and a weekend trip', () => {
  assert.equal(weekday(1), '월요일');
  assert.equal(dayKind(1), 'work');
  assert.equal(dayKind(3), 'dinner');
  assert.equal(dayKind(4), 'visit');
  assert.equal(dayKind(6), 'trip');
  assert.equal(dayKind(7), 'trip2');
  assert.equal(dayKind(8), 'work');
});

test('a normal day: wake, wash, eat, dress, drive to work, work, come home, shower, sleep', () => {
  const ids = stepsFor('work').map((s) => s.id);
  assert.deepEqual(ids, ['wake', 'sink', 'breakfast', 'wardrobe', 'drive-work', 'badge', 'coffee', 'work', 'teamMeeting', 'lunch', 'work2', 'print', 'boss', 'badge-out', 'gohome', 'shower', 'sleep']);
  assert.ok(stepsFor('dinner').some((s) => s.id === 'dinner'));
  assert.ok(stepsFor('visit').some((s) => s.target === 'other:meeting'));
  assert.equal(stepsFor('trip').at(-1).target, 'ryokan:futon');
});

test('the weekend is a trip to Japan: airport, plane, shrine, ramen, souvenir, ryokan, onsen, home', () => {
  const sat = stepsFor('trip').map((s) => s.id), sun = stepsFor('trip2').map((s) => s.id);
  assert.deepEqual(sat, ['wake', 'wardrobe', 'drive-airport', 'fly-japan', 'photo-jp', 'ramen', 'souvenir', 'ryokan']);
  assert.deepEqual(sun, ['wake', 'onsen', 'fly-home', 'drive-home', 'shower', 'sleep']);
  assert.equal(stepsFor('trip2')[0].target, 'ryokan:futon');
});

test('hunger drains, an empty stomach hurts and food heals', () => {
  const s = newState();
  s.food = 1;
  tickBody(s, 20);
  assert.equal(s.food, 0);
  const hp = s.hp;
  tickBody(s, 10);
  assert.ok(s.hp < hp);
  eat(s, 80);
  assert.equal(s.food, 80);
  const before = s.hp;
  tickBody(s, 10);
  assert.ok(s.hp > before);
});

test('falls hurt only above 3.5 m', () => {
  assert.equal(fallDamage(3), 0);
  assert.ok(fallDamage(6) > 20);
});

test('blocks snap to a 1 m grid', () => {
  assert.deepEqual(snapCell(2.3, 0.0, -1.2), { x: 2.5, y: 0, z: -1.5 });
  assert.deepEqual(snapCell(-0.01, 1.99, 0.99), { x: -0.5, y: 1, z: 0.5 });
});

test('clock text', () => {
  assert.equal(formatClock(7), '오전 7:00');
  assert.equal(formatClock(13.5), '오후 1:30');
  assert.equal(formatClock(0.25), '오전 12:15');
});

test('work tasks are answerable', () => {
  for (let d = 1; d < 6; d++) for (let n = 0; n < 4; n++) {
    const t = workTask(d, n);
    assert.ok(checkWork(t, t.answer), `${d}/${n} ${t.kind}`);
    if (t.kind === 'mail') assert.ok(!checkWork(t, (t.answer + 1) % 3));
  }
});

test('meat cooks then burns', () => {
  assert.equal(meatState(1), 'raw');
  assert.equal(meatState(7), 'cooked');
  assert.equal(meatState(13), 'burnt');
});

test('save round trip keeps inventory and placed blocks', () => {
  const s = newState();
  s.placed.push({ id: 'stone', x: 1.5, y: 0, z: 2.5, rot: 0 });
  s.inventory.stone = 3;
  const back = deserialize(serialize(s));
  assert.equal(back.inventory.stone, 3);
  assert.equal(back.placed.length, 1);
  assert.equal(deserialize('nope'), null);
});
