import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from './core.mjs';

const DT = 1 / 60;
const run = (race, sec, input) => { for (let i = 0; i < sec * 60; i++) C.stepRace(race, DT, typeof input === 'function' ? input(race) : input); };
const go = (race) => { run(race, 3.7, {}); assert.equal(race.state, 'race'); race.events.length = 0; };

test('트랙: 닫힌 길이고, 다른 구간과 겹치지 않고, 급커브가 너무 급하지 않다', () => {
  for (const def of C.TRACKS) {
    const T = C.buildTrack(def.id);
    assert.ok(T.length > 600 && T.length < 1800, def.id + ' 길이 ' + T.length);
    assert.ok(Math.abs(T.ds - 2) < 0.02);
    const gap = Math.round(70 / T.ds); let minSep = Infinity, maxCurv = 0;
    for (let i = 0; i < T.n; i++) {
      maxCurv = Math.max(maxCurv, Math.abs(T.curv[i]));
      const j0 = (i + 1) % T.n; assert.ok(Math.hypot(T.x[i] - T.x[j0], T.z[i] - T.z[j0]) < 2.2);
      for (let j = i + gap; j < T.n; j++) { if (T.n - j + i < gap) continue; minSep = Math.min(minSep, Math.hypot(T.x[i] - T.x[j], T.z[i] - T.z[j])); }
    }
    assert.ok(minSep > 2 * T.wall + 3, def.id + ' 구간 사이 ' + minSep);
    assert.ok(1 / maxCurv > T.wall - 2, def.id + ' 가장 급한 커브 반지름 ' + 1 / maxCurv);
    // 출발선 앞뒤는 거의 곧다
    for (let o = -12; o <= 12; o++) assert.ok(Math.abs(T.curv[(o + T.n) % T.n]) < 0.02, def.id + ' 출발선 곡률');
  }
});

test('출발: 카운트다운 동안은 움직이지 않고, 8명이 서로 떨어져 선다', () => {
  const r = C.createRace({ track: 'forest', mode: 'item', seed: 3 });
  assert.equal(r.karts.length, 8); assert.equal(r.karts.filter((k) => k.player).length, 1);
  assert.equal(new Set(r.karts.map((k) => k.racer.id)).size, 8);
  for (const a of r.karts) for (const b of r.karts) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 2.5);
  const x = r.player.x, z = r.player.z;
  run(r, 2, { gas: true, steer: 1 });
  assert.equal(r.state, 'countdown'); assert.equal(r.player.x, x); assert.equal(r.player.z, z);
});

test('출발 부스터: 출발 직전에 가속을 누르면 받는다', () => {
  const r = C.createRace({ track: 'forest', mode: 'speed', seed: 3 });
  run(r, 3.3, {}); run(r, 0.5, { gas: true });
  assert.equal(r.state, 'race'); assert.ok(r.events.some((e) => e.type === 'startboost' && e.kart.player));
  const early = C.createRace({ track: 'forest', mode: 'speed', seed: 3 });
  run(early, 3.8, { gas: true });
  assert.ok(!early.events.some((e) => e.type === 'startboost' && e.kart.player));
});

test('컴퓨터 카트는 모든 트랙, 모든 난이도에서 벽에 끼지 않고 완주한다', () => {
  for (const def of C.TRACKS) for (const mode of ['item', 'speed']) for (const difficulty of [0, 2]) {
    const r = C.createRace({ track: def.id, mode, difficulty, seed: 11 });
    let resets = 0, steps = 0;
    while (r.karts.some((k) => !k.player && !k.finished) && steps < 60 * 300) {
      C.stepRace(r, DT, {}); r.endT = Infinity; if (r.state === 'over') r.state = 'race';
      for (const e of r.events) if (e.type === 'reset') resets++;
      r.events.length = 0; steps++;
      for (const k of r.karts) assert.ok(Number.isFinite(k.x + k.z + k.s + k.h), 'NaN');
    }
    const ai = r.karts.filter((k) => !k.player);
    assert.ok(ai.every((k) => k.finished), `${def.id} ${mode} ${difficulty} 완주`);
    assert.ok(resets <= 2, `${def.id} 되돌리기 ${resets}번`);
    for (const k of ai) { assert.equal(k.lapTimes.length, r.laps); assert.ok(Math.abs(k.d) <= r.track.wall); }
  }
});

test('어려움 컴퓨터가 쉬움 컴퓨터보다 빨리 들어온다', () => {
  const t = [0, 2].map((difficulty) => {
    const r = C.createRace({ track: 'forest', mode: 'speed', difficulty, seed: 5 });
    while (!r.karts.some((k) => k.finished)) { C.stepRace(r, DT, {}); r.events.length = 0; }
    return r.t;
  });
  assert.ok(t[1] < t[0] - 4);
});

test('드리프트: 미끄러지며 게이지가 차고, 놓으면 순간 부스터, 게이지가 다 차면 부스터 아이템', () => {
  const r = C.createRace({ track: 'forest', mode: 'time', seed: 1 }); go(r);
  run(r, 3, { gas: true });
  const P = r.player, T = r.track; assert.ok(P.s > 25);
  // 오른쪽으로 돌 자리가 넉넉하게 길 왼쪽 끝에 놓는다 (오른쪽 = -d 쪽)
  const put = (idx, d) => { const p = C.trackPos(T, idx, d); P.x = p.x; P.z = p.z; P.idx = idx; P.h = P.mv = T.h[idx]; P.s = 30; };
  put(8, 6);
  run(r, 0.75, { gas: true, steer: 1, drift: true });
  assert.ok(P.drifting); assert.ok(Math.abs(P.slip) > 0.2); assert.ok(P.gauge > 0.03);
  run(r, 0.1, { gas: true });
  assert.ok(!P.drifting); assert.ok(P.turboT > 0); assert.ok(r.events.some((e) => e.type === 'turbo'));
  P.gauge = 0.99; put(8, -6);
  run(r, 0.5, { gas: true, steer: -1, drift: true });
  assert.deepEqual(P.items, ['boost']); assert.ok(P.gauge < 0.5);
});

test('부스터 발판: 트랙마다 곧은 길에 있고, 밟으면 잠깐 빨라진다', () => {
  for (const def of C.TRACKS) {
    const T = C.buildTrack(def.id); assert.ok(T.pads.length >= 2, def.id + ' 발판 ' + T.pads.length);
    for (const pad of T.pads) { assert.ok(Math.abs(T.curv[pad.idx]) < 0.012); assert.ok(Math.abs(pad.d) < T.half - 2); }
  }
  const r = C.createRace({ track: 'forest', mode: 'time', seed: 1 }); go(r);
  const P = r.player, pad = r.track.pads[0];
  P.x = pad.x; P.z = pad.z; P.idx = pad.idx; P.h = P.mv = pad.h; P.s = 20;
  C.stepRace(r, DT, { gas: true });
  assert.ok(P.turboT > 1); assert.ok(r.events.some((e) => e.type === 'pad'));
  run(r, 0.8, { gas: true }); assert.ok(P.s > C.BASE_SPEED * 1.1);
});

test('아이템전에서는 드리프트 게이지가 차지 않는다', () => {
  const r = C.createRace({ track: 'forest', mode: 'item', seed: 1 }); go(r);
  run(r, 3, { gas: true }); run(r, 1, { gas: true, steer: 1, drift: true });
  assert.equal(r.player.gauge, 0);
});

test('벽: 벽 밖으로 못 나가고, 도로 밖 풀밭은 느리다', () => {
  const r = C.createRace({ track: 'forest', mode: 'time', seed: 1 }); go(r);
  run(r, 6, { gas: true, steer: 1 });
  assert.ok(Math.abs(r.player.d) <= r.track.wall); assert.ok(r.events.some((e) => e.type === 'wall'));
  const P = r.player; P.s = 30; run(r, 2, (race) => ({ gas: true, steer: race.player.d > 0 ? 0.2 : -0.2 }));
  if (P.offroad) assert.ok(P.s < C.BASE_SPEED * 0.7);
});

test('아이템: 부스터, 방패, 젤리, 눈덩이, 꿀벌, 먹구름', () => {
  const r = C.createRace({ track: 'forest', mode: 'item', seed: 2 }); go(r);
  run(r, 2, { gas: true });
  const P = r.player, K = r.karts;
  // 부스터
  P.items = ['boost']; C.fireItem(r, P); assert.ok(P.boostT > 0); assert.equal(P.items.length, 0);
  // 방패는 한 번 막고 사라진다
  P.items = ['shield']; C.fireItem(r, P); assert.ok(P.shieldT > 0);
  assert.equal(C.hitKart(r, P, 'snow', 0), false); assert.equal(P.shieldT, 0); assert.equal(P.spinT, 0);
  P.safeT = 0; assert.equal(C.hitKart(r, P, 'snow', 0), true); assert.ok(P.spinT > 0);
  assert.equal(C.hitKart(r, P, 'snow', 0), false, '맞은 직후에는 잠깐 안 맞는다');
  // 젤리 함정: 뒤에 놓이고 다른 카트가 밟으면 돈다
  P.spinT = 0; P.items = ['jelly']; C.fireItem(r, P); assert.equal(r.traps.length, 1);
  const victim = K.find((k) => !k.player); victim.safeT = 0; victim.shieldT = 0; victim.x = r.traps[0].x; victim.z = r.traps[0].z;
  C.stepRace(r, DT, {}); assert.ok(victim.spinT > 0); assert.equal(r.traps.length, 0);
  // 꿀벌은 바로 앞 등수 카트를 따라간다
  run(r, 3, { gas: true }); r.events.length = 0;
  for (const k of K) k.items = []; for (const b of r.boxes) b.off = 999; r.traps.length = 0; r.shots.length = 0; // 다른 아이템이 끼어들지 않게
  const me = r.order[4], ahead = r.order[3]; ahead.safeT = 0; ahead.shieldT = 0;
  me.items = ['bee']; me.spinT = 0; me.rollT = 0; C.fireItem(r, me);
  assert.equal(r.shots[0].target, ahead.i);
  // 먹구름은 1등을 느리게 한다
  const lead = r.order[0]; lead.safeT = 0; lead.shieldT = 0;
  const last = r.order[7]; last.items = ['cloud']; last.spinT = 0; last.rollT = 0; C.fireItem(r, last);
  run(r, 1.2, { gas: true });
  assert.ok(r.events.some((e) => e.type === 'hit' && e.kind === 'cloud' && e.kart === lead));
  run(r, 8, { gas: true });
  assert.ok(r.events.some((e) => e.type === 'hit' && e.kind === 'bee' && e.kart === ahead) || r.events.some((e) => e.type === 'block' && e.kart === ahead));
  assert.equal(r.shots.length, 0);
});

test('아이템 상자: 먹으면 아이템이 생기고 잠깐 사라졌다 돌아온다. 두 개까지만 든다', () => {
  const r = C.createRace({ track: 'forest', mode: 'item', seed: 2 }); go(r);
  assert.equal(r.boxes.length, 16);
  const P = r.player, box = r.boxes[5];
  for (const k of r.karts) if (!k.player) { k.x += 1000; }
  P.x = box.x; P.z = box.z; P.idx = box.idx; C.stepRace(r, DT, {});
  assert.equal(P.items.length, 1); assert.ok(box.off > 0); assert.ok(C.ITEMS[P.items[0]]);
  assert.equal(C.fireItem(r, P), null, '룰렛이 도는 동안은 못 쓴다');
  P.items = ['boost', 'boost']; box.off = 0; P.x = box.x; P.z = box.z; C.stepRace(r, DT, {});
  assert.equal(P.items.length, 2);
  const rear = C.createRace({ track: 'forest', mode: 'item', seed: 9 }); const f = rear.karts[0], b = rear.karts[7]; f.rank = 1; b.rank = 8;
  const count = (k) => { let n = 0; for (let i = 0; i < 400; i++) if (C.rollItem(rear, k) === 'cloud') n++; return n; };
  assert.equal(count(f), 0); assert.ok(count(b) > 20);
});

test('바퀴 수와 골인: 정해진 바퀴를 돌면 끝나고 결과와 보상이 나온다', () => {
  const r = C.createRace({ track: 'forest', mode: 'item', difficulty: 0, seed: 4 }); go(r);
  // 플레이어를 자동 운전으로 달리게 한다 (finished 처리와 같은 길)
  const P = r.player; P.player = false; r.player = P; // 고무줄 계산에서만 빠진다
  let steps = 0; while (!P.finished && steps < 60 * 200) { C.stepRace(r, DT, {}); r.events.length = 0; steps++; if (r.state === 'over') break; }
  assert.ok(P.finished); assert.equal(P.lapTimes.length, 3); assert.ok(P.bestLap > 15 && P.bestLap < 60);
  P.player = true; C.stepRace(r, DT, {});
  assert.equal(r.state, 'over');
  const res = C.results(r); assert.equal(res.length, 8); assert.deepEqual(res.map((x) => x.rank), [1, 2, 3, 4, 5, 6, 7, 8]);
  const save = C.newSave(), rank = P.rank, out = C.applyResult(save, r);
  assert.equal(out.coins, C.REWARD[rank - 1]); assert.equal(save.coins, out.coins);
  assert.equal(save.medals.forest, rank); assert.ok(save.best.forest.lap > 0 && save.best.forest.total > 0);
  assert.equal(save.unlocked, rank <= 3 ? 2 : 1);
});

test('시간 초과: 1등이 들어오고 15초 안에 못 들어오면 끝난다', () => {
  const r = C.createRace({ track: 'forest', mode: 'speed', difficulty: 2, seed: 4 }); go(r);
  let steps = 0; while (r.state !== 'over' && steps < 60 * 300) { C.stepRace(r, DT, {}); r.events.length = 0; steps++; }
  assert.equal(r.state, 'over'); assert.equal(r.retired, true); assert.equal(C.reward(r), 5);
  const save = C.newSave(); const out = C.applyResult(save, r);
  assert.equal(out.retired, true); assert.equal(save.unlocked, 1); assert.equal(save.medals.forest, undefined);
});

test('혼자 기록 재기는 혼자 달리고 상자가 없다', () => {
  const r = C.createRace({ track: 'beach', mode: 'time', seed: 1 });
  assert.equal(r.karts.length, 1); assert.equal(r.boxes.length, 0); assert.equal(r.player.rank, 1);
});

test('트랙으로 돌아오기', () => {
  const r = C.createRace({ track: 'forest', mode: 'time', seed: 1 }); go(r);
  run(r, 4, { gas: true, steer: 1 });
  C.requestReset(r);
  assert.ok(Math.abs(r.player.d) < 0.01); assert.equal(r.player.s, 0);
});

test('저장: 이상한 값은 고치고, 카트는 코인이 있어야 산다', () => {
  assert.deepEqual(C.fixSave(null), C.newSave());
  const s = C.fixSave({ coins: -5, karts: ['gold', 'nope'], kart: 'gold', racer: 'x', unlocked: 99, track: 'cloud', difficulty: 9, mode: 'zz', best: { forest: { lap: -1, total: 'a' } }, medals: { forest: 0, beach: 2 } });
  assert.equal(s.coins, 0); assert.deepEqual(s.karts, ['basic', 'gold']); assert.equal(s.kart, 'gold'); assert.equal(s.racer, 'jelly');
  assert.equal(s.unlocked, 6); assert.equal(s.track, 'cloud'); assert.equal(s.difficulty, 2); assert.equal(s.mode, 'item');
  assert.deepEqual(s.best.forest, { lap: 0, total: 0 }); assert.deepEqual(s.medals, { beach: 2 });
  assert.equal(C.fixSave({ track: 'cloud' }).track, 'forest', '잠긴 트랙은 고를 수 없다');
  const b = C.newSave(); assert.equal(C.buyKart(b, 'spin'), false);
  b.coins = 350; assert.equal(C.buyKart(b, 'spin'), true); assert.equal(b.coins, 50); assert.equal(b.kart, 'spin'); assert.equal(C.buyKart(b, 'spin'), false);
  assert.equal(C.fmtTime(75.5), '1:15.50'); assert.equal(C.fmtTime(null), '--:--.--');
});

// ── 같이 하기 ──
function pair(seed = 5) {
  const humans = [[1, 0, 0], [2, 3, 1]];
  const A = C.createRace({ track: 'forest', mode: 'item', difficulty: 0, seed, slots: C.makeSlots(humans, 1), host: true });
  const B = C.createRace({ track: 'forest', mode: 'item', difficulty: 0, seed, slots: C.makeSlots(humans, 2), host: false });
  return { A, B };
}
// 서로의 소식을 전해 준다 (실제로는 main.js 가 공용 서버 방으로 보낸다)
function relay(from, to, peer) {
  for (const k of from.karts) if (k.owned && !k.gone) C.applySnap(to, JSON.parse(JSON.stringify(C.snapOf(k))), peer, 'p1');
  for (const e of from.events) {
    if (e.remote || !e.kart.owned) continue;
    if (e.type === 'use' && e.spawn) C.spawnItem(to, e.kart.i, e.item, e.spawn);
    if (e.type === 'gone') C.removeItem(to, e.id);
    if (e.type === 'finish') C.applyFinish(to, e.kart.i, e.kart.finishT, e.kart.bestLap, peer, 'p1');
  }
  from.events.length = 0;
}
const both = ({ A, B }, sec, inA = { gas: true }, inB = { gas: true }) => { for (let i = 0; i < sec * 60; i++) { C.stepRace(A, DT, inA); C.stepRace(B, DT, inB); if (i % 5 === 0) { relay(A, B, 'p1'); relay(B, A, 'p2'); } } };

test('같이 하기: 자리는 모두 똑같이 만들고, 내 카트와 (방장이면) 컴퓨터 카트만 내가 계산한다', () => {
  const s1 = C.makeSlots([[1, 0, 0], [2, 3, 1]], 1), s2 = C.makeSlots([[1, 0, 0], [2, 3, 1]], 2);
  assert.equal(s1.length, 8); assert.deepEqual(s1.map((x) => x.racer), s2.map((x) => x.racer));
  assert.deepEqual(s1.map((x) => x.kind), ['me', 'remote', 'ai', 'ai', 'ai', 'ai', 'ai', 'ai']);
  assert.deepEqual(s2.map((x) => x.kind).slice(0, 2), ['remote', 'me']);
  assert.equal(new Set(s1.map((x) => x.racer)).size, 8);
  assert.equal(C.makeSlots([[1, 99, -1], [2, 'x', 2], [3, 0, 0], [4, 0, 0], [5, 0, 0]], 1).filter((x) => x.kind !== 'ai').length, 4, '사람은 4명까지');
  const { A, B } = pair();
  assert.equal(A.player.i, 0); assert.equal(B.player.i, 1);
  assert.deepEqual(A.karts.map((k) => k.owned), [true, false, true, true, true, true, true, true]);
  assert.deepEqual(B.karts.map((k) => k.owned), [false, true, false, false, false, false, false, false]);
});

test('같이 하기: 친구와 컴퓨터 카트가 내 화면에서도 같은 곳을 달리고 등수가 같다', () => {
  const g = pair(), { A, B } = g, t0 = B.karts.map((k) => k.total);
  both(g, 12);
  for (let i = 0; i < 8; i++) {
    assert.ok(Math.hypot(A.karts[i].x - B.karts[i].x, A.karts[i].z - B.karts[i].z) < 6, `카트 ${i} 위치 차이`);
    assert.ok(Math.abs(A.karts[i].total - B.karts[i].total) < 4);
  }
  assert.ok(B.karts[0].total > t0[0] + 20, '친구 카트가 움직인다'); assert.ok(B.karts[4].total > t0[4] + 60, '컴퓨터 카트가 움직인다');
});

test('같이 하기: 남의 카트 소식은 그 주인만 보낼 수 있고, 이상한 값은 버린다', () => {
  const { B } = pair();
  const snap = [0, 5, 5, 0, 0, 10, 0, 3, 0, 0];
  assert.equal(C.applySnap(B, snap, 'p3', 'p1'), false, '다른 사람이 보낸 친구 카트');
  assert.equal(C.applySnap(B, [4, 5, 5, 0, 0, 10, 0, 3, 0, 0], 'p3', 'p1'), false, '방장이 아닌 사람이 보낸 컴퓨터 카트');
  assert.equal(C.applySnap(B, [1, 5, 5, 0, 0, 10, 0, 3, 0, 0], 'p1', 'p1'), false, '내 카트는 남이 못 바꾼다');
  assert.equal(C.applySnap(B, [0, NaN, 5, 0, 0, 10, 0, 3, 0, 0], 'p1', 'p1'), false);
  assert.equal(C.applySnap(B, [0, 5, 5, 0, 0, 1e9, 99, 1e9, 0, 9], 'p1', 'p1'), true);
  const k = B.karts[0]; assert.ok(k.net.s <= C.BASE_SPEED * 2); assert.ok(k.net.idx < B.track.n); assert.ok(k.net.lap <= B.laps); assert.ok(k.steer <= 1);
  assert.equal(C.applyFinish(B, 0, 50, 20, 'p2', 'p1'), false); assert.equal(C.applyFinish(B, 0, 50, 20, 'p1', 'p1'), true);
  assert.equal(B.karts[0].finished, true); assert.ok(B.endT < Infinity);
  assert.equal(C.spawnItem(B, 0, 'jelly', [7, 'a', 1]), false); assert.equal(C.spawnItem(B, 0, 'bee', [7, 1, 1]), false);
});

test('같이 하기: 친구가 놓은 젤리를 내가 밟으면 내 쪽에서 맞고, 친구 화면에서도 사라진다', () => {
  const g = pair(); both(g, 5);
  const { A, B } = g, a = A.karts[0], b = B.karts[1];
  for (const r of [A, B]) { for (const k of r.karts) k.items = []; for (const x of r.boxes) x.off = 999; r.traps.length = 0; r.shots.length = 0; r.events.length = 0; }
  a.items = ['jelly']; a.rollT = 0; a.spinT = 0; C.fireItem(A, a); relay(A, B, 'p1');
  assert.equal(B.traps.length, 1); assert.equal(B.traps[0].id, A.traps[0].id);
  // 친구(B)의 카트를 함정 위로: A 화면에서는 남의 카트라 아무 일도 없다
  A.karts[1].x = A.traps[0].x; A.karts[1].z = A.traps[0].z; A.karts[1].net.x = A.traps[0].x; A.karts[1].net.z = A.traps[0].z; A.karts[1].net.s = 0;
  C.stepRace(A, DT, {}); assert.equal(A.traps.length, 1);
  b.x = B.traps[0].x; b.z = B.traps[0].z; b.safeT = 0; b.shieldT = 0; b.idx = (B.karts[0].net ? B.karts[0].idx : b.idx);
  // b 를 함정 바로 위에 두려면 트랙 위치도 맞춘다
  let best = 0, bd = Infinity; for (let i = 0; i < B.track.n; i++) { const d = Math.hypot(B.track.x[i] - b.x, B.track.z[i] - b.z); if (d < bd) { bd = d; best = i; } } b.idx = best; b.s = 0;
  C.stepRace(B, DT, {});
  assert.ok(b.spinT > 0); assert.equal(B.traps.length, 0); assert.ok(B.events.some((e) => e.type === 'gone'));
  relay(B, A, 'p2');
  assert.equal(A.traps.length, 0); assert.ok(A.karts[1].spinT > 0, '친구 카트가 도는 모습이 보인다');
});

test('같이 하기: 친구가 골인하면 내 순위표에 들어오고, 친구가 나가면 카트가 빠진다. 방장이 바뀌면 컴퓨터 카트를 이어받는다', () => {
  const { A, B } = pair(); go(A); go(B);
  const b = B.karts[1]; b.finished = true; b.finishT = 61.5; b.bestLap = 20; B.events.push({ type: 'finish', kart: b });
  relay(B, A, 'p2');
  assert.equal(A.karts[1].finished, true); assert.equal(A.karts[1].finishT, 61.5); C.stepRace(A, DT, {});
  assert.equal(A.karts[1].rank, 1); assert.ok(C.results(A)[0].friend);
  assert.equal(C.dropPeer(B, 'p1'), 1); assert.equal(B.karts[0].gone, true); assert.equal(C.results(B).length, 7);
  C.setHost(B, true); assert.ok(B.karts.slice(2).every((k) => k.owned));
  const x = B.karts[3].x; for (let i = 0; i < 120; i++) C.stepRace(B, DT, { gas: true });
  assert.ok(Math.hypot(B.karts[3].x - x) > 1, '이어받은 컴퓨터 카트가 달린다');
  const save = C.newSave(); B.player.finished = true; B.player.finishT = 70; B.player.rank = 1; C.applyResult(save, B);
  assert.equal(save.unlocked, 1, '같이 하기로는 트랙이 열리지 않는다'); assert.ok(save.coins > 0);
});
