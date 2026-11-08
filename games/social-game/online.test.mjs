import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GAME, TOWNS, townId, townName, KEY_RE, blockKey, parseBlockKey, buildKeyOf, blockValue, parseBlockValue,
  propKey, parsePropKey, scatterKey, cellAlive, packPose, unpackPose, samePose, HIDDEN, lerpAngle, follow,
  isPrivate, PRIVATE_SITES, lookFor, SoloBlocks, placeErrorText, TEXT,
  peerNum, assignSeats, seatOf, rideStep, PoseTrack, SEATS, SEAT_POS, RIDE_WAIT, RIDE_STALE,
  CAR_HALF, PERSON_R, carCircles, overlap, pushOut, ghostStep, friendSolids,
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
  assert.deepEqual(p, { mode: 'walk', x: 10.12, y: 0.26, z: -33.99, yaw: 1.235, kid: true, hidden: false, t: null, seats: null, ride: 0, car: null, pose: 0 });
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
  // the clock (slot 6) does not count, the seat list does
  assert.equal(samePose([3, 1, 2, 3, 0, 0, 100, [5, 0, 0]], [3, 1, 2, 3, 0, 0, 200, [5, 0, 0]]), true);
  assert.equal(samePose([3, 1, 2, 3, 0, 0, 100, [5, 0, 0]], [3, 1, 2, 3, 0, 0, 100, [5, 6, 0]]), false);
});

test('ride slots: the clock and the seat list or the car I ride in, still readable by older games', () => {
  const drive = packPose({ mode: 'drive', x: 1, y: 0.3, z: 2, yaw: 0.5, t: 123456, seats: [7, 0, 12] });
  assert.deepEqual(drive, [3, 1, 0.3, 2, 0.5, 0, 123456, [7, 0, 12]]);
  assert.ok(drive.length <= 8, 'older games refuse poses longer than 8');
  assert.ok(drive.flat().every((n) => typeof n === 'number'), 'numbers only (strings are filtered and checked for phone numbers)');
  const u = unpackPose(drive);
  assert.deepEqual([u.mode, u.t, u.seats, u.ride], ['drive', 123456, [7, 0, 12], 0]);
  const rider = unpackPose(packPose({ mode: 'idle', x: 1, y: 0, z: 2, t: 5, ride: 7 }));
  assert.deepEqual([rider.mode, rider.t, rider.seats, rider.ride], ['idle', 5, null, 7]);
  // a walker who rides nothing keeps 6 or 7 numbers
  assert.deepEqual(packPose({ mode: 'walk', x: 1 }), [1, 1, 0, 0, 0, 0]);
  assert.deepEqual(packPose({ mode: 'walk', x: 1, t: 0 }), [1, 1, 0, 0, 0, 0, 0]);
  assert.equal(unpackPose([1, 1, 0, 0, 0, 0, 0]).t, null, 'clock 0 means none');
  // bad seat lists and riders are dropped, not trusted
  assert.equal(unpackPose([3, 1, 0, 2, 0, 0, 9, [1, 2]]).seats, null);
  assert.equal(unpackPose([3, 1, 0, 2, 0, 0, 9, [1, 'x', 0]]).seats, null);
  assert.equal(unpackPose([3, 1, 0, 2, 0, 0, 9, 7]).ride, 0, 'a driver rides nothing');
  assert.equal(unpackPose([0, 1, 0, 2, 0, 0, 9, [1, 0, 0]]).seats, null, 'only a driver has seats');
  assert.equal(unpackPose([0, 1, 0, 2, 0, 0, 9, -3]).ride, 0);
  assert.equal(unpackPose([0, 1, 0, 2, 0, 0, 9, 1.5]).ride, 0);
  assert.deepEqual(packPose({ mode: 'drive', seats: [0, -1, 2.5] }).at(-1), [0, 0, 0]);
  assert.deepEqual(packPose({ mode: 'hidden', seats: [1, 2, 3], ride: 4 }), [4], 'hidden carries nothing');
});

test('peer numbers come from the server ids', () => {
  assert.equal(peerNum('p12'), 12);
  assert.equal(peerNum('p1'), 1);
  for (const id of ['', 'x12', 'p', 'p1x', null, 12, 'p1234567890']) assert.equal(peerNum(id), 0, String(id));
});

test('the driver seats askers: front first, first come first seated, at most 3', () => {
  assert.equal(SEATS, 3);
  assert.equal(SEAT_POS.length, 3);
  const ask = (n, extra = {}) => ({ n, asking: true, near: true, blocked: false, hidden: false, ...extra });
  let r = assignSeats([0, 0, 0], [ask(5)]);
  assert.deepEqual(r, { seats: [5, 0, 0], added: [5], removed: [] });
  r = assignSeats(r.seats, [ask(5), ask(9), ask(3), ask(4)]);
  assert.deepEqual(r.seats, [5, 9, 3], 'the fourth waits: no seat');
  assert.deepEqual(r.added, [9, 3]);
  // someone stops asking (got out): only their seat frees, nobody moves
  r = assignSeats(r.seats, [ask(5), ask(3), ask(4)]);
  assert.deepEqual(r.seats, [5, 4, 3]);
  assert.deepEqual([r.added, r.removed], [[4], [9]]);
  // far away or a moving car: no new rider, the seated stay
  r = assignSeats([5, 0, 0], [ask(5), ask(8, { near: false })]);
  assert.deepEqual(r.seats, [5, 0, 0]);
  r = assignSeats([5, 0, 0], [ask(5), ask(8)], { slow: false });
  assert.deepEqual(r.seats, [5, 0, 0]);
});

test('blocked, hidden and gone riders; the driver getting out empties the car', () => {
  const ask = (n, extra = {}) => ({ n, asking: true, near: true, blocked: false, hidden: false, ...extra });
  assert.deepEqual(assignSeats([0, 0, 0], [ask(5, { blocked: true })]).seats, [0, 0, 0], 'a blocked friend cannot get in');
  assert.deepEqual(assignSeats([5, 7, 0], [ask(5, { blocked: true }), ask(7)]), { seats: [0, 7, 0], added: [], removed: [5] }, 'blocking puts them out');
  assert.deepEqual(assignSeats([5, 0, 0], [ask(5, { hidden: true })]).seats, [5, 0, 0], 'a hidden rider keeps the seat');
  assert.deepEqual(assignSeats([0, 0, 0], [ask(5, { hidden: true })]).seats, [0, 0, 0], 'but never gets a new one');
  assert.deepEqual(assignSeats([5, 7, 0], [ask(7)]).seats, [0, 7, 0], 'left the town: seat freed');
  assert.deepEqual(assignSeats([5, 7, 2], [ask(5), ask(7), ask(2)], { open: false }), { seats: [0, 0, 0], added: [], removed: [5, 7, 2] });
  assert.deepEqual(assignSeats(null, [ask(5)]).seats, [5, 0, 0]);
  assert.equal(seatOf([5, 7, 0], 7), 1);
  assert.equal(seatOf([5, 7, 0], 0), -1, 'an empty seat is nobody');
  assert.equal(seatOf(null, 7), -1);
});

test('the passenger sits only once the driver lists it, and is put out when the list says so', () => {
  const me = 7, t0 = 1000;
  const ride = { seat: -1, askedAt: t0, lastAt: t0 };
  const car = (seats) => ({ mode: 'drive', hidden: false, seats });
  assert.equal(rideStep(ride, car([0, 0, 0]), me, t0 + 200).what, 'wait');
  assert.deepEqual(rideStep(ride, car([3, me, 0]), me, t0 + 300), { what: 'seated', seat: 1 });
  ride.seat = 1;
  assert.deepEqual(rideStep(ride, car([3, me, 0]), me, t0 + 400), { what: 'ride', seat: 1 });
  assert.equal(rideStep(ride, car([3, 0, 0]), me, t0 + 500).what, 'out', 'dropped from the list (blocked, toggle...)');
  assert.equal(rideStep(ride, { mode: 'walk', hidden: false, seats: null }, me, t0 + 500).what, 'out', 'the driver got out');
  assert.equal(rideStep(ride, { mode: 'hidden', hidden: true }, me, t0 + 500).what, 'out', 'the driver went somewhere private');
  assert.equal(rideStep(ride, car([3, me, 0]), me, t0 + 500, true).what, 'out', 'the driver left or I blocked them');
  assert.equal(rideStep(ride, car([3, me, 0]), me, t0 + RIDE_STALE + 1).what, 'out', 'no news from the driver (they blocked me)');
  // asking that does not work out
  const ask = { seat: -1, askedAt: t0, lastAt: t0 };
  assert.equal(rideStep(ask, car([1, 2, 3]), me, t0 + RIDE_WAIT + 1).what, 'full');
  assert.equal(rideStep(ask, { mode: 'drive', hidden: false, seats: null }, me, t0 + 10).what, 'closed', 'an older game takes no riders');
  assert.equal(rideStep(ask, { mode: 'idle', hidden: false, seats: null }, me, t0 + RIDE_WAIT + 1).what, 'closed');
  assert.equal(rideStep(ask, car([0, 0, 0]), 0, t0 + 10).what, 'wait', 'no peer number yet');
});

test('a car is played back smoothly between poses, on the sender clock', () => {
  const tr = new PoseTrack(100);
  assert.equal(tr.sample(0), null);
  // 10 m/s along x, poses every 100 ms, arriving late and unevenly (40-90 ms)
  const late = [40, 90, 50, 80, 45, 60];
  for (let i = 0; i < 6; i++) tr.push({ x: i, y: 0, z: 0, yaw: 0, t: 1000 + i * 10 }, 5000 + i * 100 + late[i]);
  const xs = [];
  for (let now = 5300; now <= 5600; now += 50) xs.push(tr.sample(now).x);
  const steps = xs.slice(1).map((x, i) => x - xs[i]);
  for (const s of steps) assert.ok(Math.abs(s - 0.5) < 1e-6, `even steps ${steps}`);
  assert.ok(Math.abs(tr.sample(5400).speed - 10) < 1e-6);
  // past the newest pose it waits there
  const end = tr.sample(99999);
  assert.ok(Math.abs(end.x - 5) < 1e-6, `held at ${end.x}`);
  assert.equal(end.speed, 0);
  // doubled or late poses are ignored; a teleport or a new page starts again
  tr.push({ x: 4, y: 0, z: 0, yaw: 0, t: 1040 }, 6000);
  assert.equal(tr.list.length, 6);
  tr.push({ x: 500, y: 0, z: 0, yaw: 0, t: 1060 }, 6100);
  assert.equal(tr.list.length, 1, 'teleport');
  tr.push({ x: 500, y: 0, z: 0, yaw: 0, t: 3 }, 6200);
  assert.equal(tr.list.length, 1, 'their clock went back: start again');
  tr.push({ mode: 'hidden', hidden: true }, 6300);
  assert.equal(tr.ready, false);
});

test('a driver whose game paused: no jump back or forward on screen, it glides back onto the path', () => {
  const tr = new PoseTrack(100);
  let now = 10000, sent = 0, x = 0;
  const shown = [];
  const send = () => tr.push({ x, y: 0, z: 0, yaw: 0, t: 1000 + sent / 10 }, now + 40);
  for (let f = 0; f < 400; f++) {
    // the sender moves 20 m/s and sends every 100 ms, but stops for 0.6 s (a hitch) after 2 s
    if (f % 6 === 0 && !(f >= 120 && f < 156)) { send(); }
    now += 1000 / 60; sent += 1000 / 60;
    if (!(f >= 120 && f < 156)) x += 20 / 60; else x += 2 / 60; // paused game: its car barely moves
    const s = tr.sample(now);
    if (s) shown.push(s.x);
  }
  let back = 0, maxStep = 0;
  for (let i = 1; i < shown.length; i++) { const d = shown[i] - shown[i - 1]; if (d < -0.02) back++; maxStep = Math.max(maxStep, Math.abs(d)); }
  assert.equal(back, 0, 'never backwards');
  assert.ok(maxStep < 0.8, `no big jumps (${maxStep.toFixed(2)} m in a frame at 20 m/s ≈ 0.33)`);
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

test('a walker sends where their car is parked; drivers and riders do not', () => {
  const car = { x: -140.7, y: 0.123, z: -17.5, yaw: Math.PI };
  const d = packPose({ mode: 'walk', x: 1, y: 0, z: 2, t: 0, car });
  assert.deepEqual(d, [1, 1, 0, 2, 0, 0, 0, [-140.7, 0.12, -17.5, -3.142]]);
  assert.ok(d.length <= 8 && JSON.stringify(d).length < 512, 'older games still read it, the server takes it');
  assert.ok(d.flat().every((n) => typeof n === 'number'));
  const u = unpackPose(d);
  assert.deepEqual(u.car, { x: -140.7, y: 0.12, z: -17.5, yaw: -3.142 });
  assert.equal(u.ride, 0, 'a parked car is not a ride (the riding game before this reads 0 here too)');
  assert.equal(u.seats, null);
  // riding: the ride number wins (the car stays where friends last saw it); driving: the pose is the car
  assert.deepEqual(packPose({ mode: 'idle', t: 0, ride: 7, car }).at(-1), 7);
  assert.equal(unpackPose(packPose({ mode: 'drive', t: 5, seats: [0, 0, 0], car })).car, null);
  assert.deepEqual(packPose({ mode: 'hidden', car }), [4], 'hidden carries nothing');
  // bad or missing cars are left out, never trusted
  assert.deepEqual(packPose({ mode: 'walk', t: 0, car: { x: NaN, y: 0, z: 0, yaw: 0 } }), [1, 0, 0, 0, 0, 0, 0]);
  assert.equal(unpackPose([0, 1, 0, 2, 0, 0, 9, [1, 2, 3]]).car, null);
  assert.equal(unpackPose([0, 1, 0, 2, 0, 0, 9, [1, 2, 3, 'x']]).car, null);
  assert.equal(unpackPose([0, 1, 0, 2, 0, 0, 9, [1, 2, 3, 1e9]]).car, null);
  assert.equal(unpackPose([3, 1, 0, 2, 0, 0, 9, [1, 2, 3, 4]]).car, null, 'a driver has seats, not a parked car');
  // standing still with the car parked: same pose, so it goes out once a second only
  assert.equal(samePose(packPose({ mode: 'idle', t: 0, car }), packPose({ mode: 'idle', t: 0, car })), true);
});

test('a pose and a parked car share the last slot: the pose wins while posing', () => {
  const car = { x: -140.7, y: 0.1, z: -17.5, yaw: 0 };
  const posing = packPose({ mode: 'idle', t: 0, car, pose: 3 });
  assert.equal(posing.at(-1), -3);
  const u = unpackPose(posing);
  assert.equal(u.pose, 3); assert.equal(u.car, null, 'friends keep the car where they last saw it');
  const walking = unpackPose(packPose({ mode: 'walk', t: 0, car, pose: 3 }));
  assert.equal(walking.pose, 0, 'walking ends a pose'); assert.ok(walking.car);
});

test('car circles follow the car like Vehicle.circles()', () => {
  const c = carCircles(10, 20, 0); // yaw 0: forward is -z
  assert.equal(c.length, 3);
  const k = CAR_HALF.l - CAR_HALF.w;
  assert.deepEqual(c.map((p) => [+p.x.toFixed(6), +p.z.toFixed(6), p.r]), [[10, 20 + k, CAR_HALF.w], [10, 20, CAR_HALF.w], [10, 20 - k, CAR_HALF.w]]);
  const side = carCircles(0, 0, -Math.PI / 2); // forward +x
  assert.ok(side[2].x > side[0].x && Math.abs(side[2].z) < 1e-9);
  assert.ok(Math.abs(carCircles(0, 0, 0, CAR_HALF, 0.92)[0].r - CAR_HALF.w * 0.92) < 1e-12);
});

test('my car is pushed out of a friend\'s car and stops for a friend on foot', () => {
  // two cars nose to tail along x: mine 3 m behind theirs overlaps by 4.4 - 3 = 1.4 m
  const mine = carCircles(0, 0, -Math.PI / 2), theirs = carCircles(3, 0, -Math.PI / 2);
  assert.ok(Math.abs(overlap(mine, theirs) - (CAR_HALF.w * 2 - (3 - 2 * (CAR_HALF.l - CAR_HALF.w)))) < 1e-9);
  const solids = friendSolids([{ car: { x: 3, y: 0, z: 0, yaw: -Math.PI / 2 } }]);
  const p = pushOut(mine, solids);
  assert.equal(p.car, true); assert.equal(p.person, false);
  assert.ok(p.x < -1, `pushed back (${p.x.toFixed(2)} m)`);
  const after = mine.map((c) => ({ ...c, x: c.x + p.x, z: c.z + p.z }));
  assert.ok(overlap(after, solids) < 1e-6, 'and out of it');
  assert.equal(pushOut(carCircles(-6, 0, -Math.PI / 2), solids).car, false, 'apart: nothing');
  // a friend standing in front of my bumper
  const front = mine[2];
  const q = pushOut(mine, friendSolids([{ foot: { x: front.x + 1, y: 0, z: 0, kid: false } }]));
  assert.equal(q.person, true); assert.equal(q.car, false);
  // exactly on top of each other: still pushed somewhere, never stuck
  assert.ok(Math.hypot(pushOut([{ x: 0, z: 0, r: 0.3 }], [{ x: 0, z: 0, r: 1 }]).x, 0) > 1.2);
});

test('friends in a car seat or asking for a ride are never solid; driven and parked cars are', () => {
  const car = { x: 5, y: 0.1, z: 5, yaw: 0 };
  const s = friendSolids([
    { car, foot: null },                                        // driving (or parked, nobody near)
    { car: null, foot: { x: 0, y: 0, z: 0 }, seated: true },    // sits in my car (or a friend's)
    { car: null, foot: { x: 1, y: 0, z: 0 }, ride: 7 },         // waiting at the door for a seat
    { car: { x: 20, y: 0, z: 0, yaw: 1 }, foot: { x: 18, y: 0, z: 0, kid: true } }, // on foot next to their parked car
    { car: null, foot: null },                                  // hidden or too far
  ]);
  assert.equal(s.filter((p) => !p.person).length, 6, 'two cars, three circles each');
  const people = s.filter((p) => p.person);
  assert.equal(people.length, 1);
  assert.equal(people[0].r, PERSON_R * 0.75, 'a kid is a smaller circle');
  assert.equal(s[0].y, 0.1, 'height kept, so things on another floor are skipped');
});

test('a parked car standing on another one is a ghost until they are apart', () => {
  assert.equal(ghostStep(false, 1.9), true, 'both parked in the same spot at home');
  assert.equal(ghostStep(false, 0.1), false, 'a touch while driving is a bump, not a ghost');
  assert.equal(ghostStep(true, 0.1), true);
  assert.equal(ghostStep(true, -0.3), true, 'stays a ghost while still close');
  assert.equal(ghostStep(true, -0.6), false, 'comes back once there is room');
  assert.equal(ghostStep(false, -Infinity), false);
  // same spot at home: overlap is two whole widths
  const home = carCircles(-140.7, -17.5, Math.PI);
  assert.ok(overlap(home, home) > 1.9);
});

test('a pose (포즈) rides in the link slot as minus its number, only when standing and not riding', async () => {
  const { POSES, poseNum } = await import('./poses.mjs');
  const n = poseNum('dance');
  const d = packPose({ mode: 'idle', x: 1, y: 2, z: 3, yaw: 0, kid: false, t: 0, pose: n });
  assert.equal(d.length, 8);
  assert.equal(d[7], -n);
  const p = unpackPose(d);
  assert.equal(p.pose, n);
  assert.equal(p.ride, 0); // older games: a negative link is "not riding"
  assert.equal(p.mode, 'idle');
  // every pose fits and comes back
  for (let k = 1; k <= POSES.length; k++) assert.equal(unpackPose(packPose({ mode: 'idle', pose: k, t: 0 })).pose, k);
  // no pose, unknown numbers, walking, driving or riding: nothing is sent and nothing is read
  assert.equal(packPose({ mode: 'idle', t: 0 }).length, 7);
  assert.equal(packPose({ mode: 'idle', pose: 0 }).length, 6);
  assert.equal(packPose({ mode: 'idle', pose: POSES.length + 1 }).length, 6);
  assert.equal(packPose({ mode: 'idle', pose: 1.5 }).length, 6);
  assert.equal(packPose({ mode: 'walk', pose: n }).length, 6);
  assert.equal(packPose({ mode: 'idle', ride: 7, pose: n })[7], 7);
  assert.deepEqual(packPose({ mode: 'drive', seats: [0, 0, 0], pose: n, t: 0 })[7], [0, 0, 0]);
  assert.equal(unpackPose([0, 0, 0, 0, 0, 0, 0, -(POSES.length + 1)]).pose, 0);
  assert.equal(unpackPose([0, 0, 0, 0, 0, 0, 0, -1.5]).pose, 0);
  assert.equal(unpackPose([1, 0, 0, 0, 0, 0, 0, -n]).pose, 0); // walking: no pose
  assert.equal(unpackPose([0, 0, 0, 0, 0, 0, 0, 5]).pose, 0);
  // a changed pose is a new pose to send; the same pose is not
  assert.equal(samePose(packPose({ mode: 'idle', pose: 1, t: 0 }), packPose({ mode: 'idle', pose: 2, t: 0 })), false);
  assert.equal(samePose(packPose({ mode: 'idle', pose: 2, t: 0 }), packPose({ mode: 'idle', pose: 2, t: 0 })), true);
  // small: well under the server's 512 characters
  assert.ok(JSON.stringify(packPose({ mode: 'idle', x: -12345.67, y: 123.45, z: 9876.54, yaw: 3, kid: true, t: 999999, pose: POSES.length })).length < 80);
});
