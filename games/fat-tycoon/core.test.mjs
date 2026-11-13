import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from './core.mjs';

test('월드 1 먹기 순서는 공책 그대로', () => {
  assert.deepEqual(C.STAGES.slice(0, 10).map((s) => s.name),
    ['마쮸', '귤', '사과', '미역국', '치킨', '피자', '마라탕', '돈까스 3판', '마라탕 2판', '마라탕 100판']);
  assert.equal(C.STAGES.length, 50);
  assert.equal(new Set(C.STAGES.map((s) => s.id)).size, 50);
  assert.equal(C.STAGES[49].name, '지구만 한 마쮸');
  assert.ok(C.STAGES.every((s, i) => !i || s.target > C.STAGES[i - 1].target));
});

test('쟁반이 비면 못 먹고, 받으면 먹는다', () => {
  const s = C.newSave();
  assert.equal(C.bite(s), null);
  assert.equal(C.fillPlate(s, 3), false);
  assert.ok(C.fillPlate(s, 0));
  const r = C.bite(s);
  assert.ok(Math.abs(r.kg - 0.1) < 1e-9);
  assert.equal(s.plate, 19);
  assert.ok(s.coins > 0);
});

test('몸무게가 차야 레벨이 오르고 10레벨 뒤 월드 2가 열린다', () => {
  const s = C.newSave();
  assert.equal(C.levelUp(s), null);
  assert.equal(C.canEnterWorld(s, 2), false);
  for (let i = 0; i < 10; i += 1) { s.weight = C.STAGES[i].target; assert.ok(C.levelUp(s)); }
  assert.equal(s.stage, 10);
  assert.ok(C.canEnterWorld(s, 2));
  assert.equal(C.canEnterWorld(s, 3), false);
  for (let i = 10; i < 50; i += 1) { s.weight = C.STAGES[i].target; C.levelUp(s); }
  assert.ok(C.allDone(s));
  assert.deepEqual(s.cleared, [true, true, true, true, true]);
  assert.ok(C.canEnterWorld(s, 5));
  assert.equal(C.canEnterWorld(s, 6), false);
  C.fillPlate(s, 49);
  assert.ok(C.bite(s));
});

test('업그레이드와 스킨은 코인이 있어야 산다', () => {
  const s = C.newSave();
  assert.equal(C.buyUpgrade(s, 'mouth'), false);
  s.coins = 40;
  assert.ok(C.buyUpgrade(s, 'mouth'));
  assert.equal(s.coins, 0);
  assert.equal(C.mouthPower(s), 1.25);
  assert.equal(C.buySkin(s, 'blue'), false);
  s.coins = 300;
  assert.ok(C.buySkin(s, 'blue'));
  assert.equal(s.skin, 'blue');
  s.up.drone = 1;
  assert.equal(C.upgradeCost(s, 'drone'), Infinity);
  s.plate = 0;
  assert.ok(C.bite(s));
  assert.ok(s.plate > 0);
});

test('일일 보상은 하루 한 번, 시간 보상은 시간이 지나야', () => {
  const s = C.newSave();
  assert.equal(C.claimDaily(s, '2026-11-11', '2026-11-10'), 100);
  assert.equal(C.claimDaily(s, '2026-11-11', '2026-11-10'), 0);
  assert.equal(C.claimDaily(s, '2026-11-12', '2026-11-11'), 200);
  assert.equal(C.claimDaily(s, '2026-11-20', '2026-11-19'), 100);
  assert.equal(C.claimTime(s, 0), 0);
  C.tickTime(s, '2026-11-20', 61);
  assert.equal(C.claimTime(s, 0), 50);
  assert.equal(C.claimTime(s, 0), 0);
  C.tickTime(s, '2026-11-21', 1);
  assert.deepEqual(s.time.got, []);
});

test('망가진 저장도 고쳐서 읽는다', () => {
  const s = C.fixSave({ weight: 'x', coins: -5, stage: 99, skins: ['nope'], skin: 'nope', up: { mouth: 1e9 } });
  assert.equal(s.weight, 30);
  assert.equal(s.coins, 0);
  assert.equal(s.stage, 50);
  assert.equal(C.fixSave({ world: 4, cleared: [true, true, false] }).world, 1);
  assert.equal(C.fixSave({ world: 3, cleared: [true, true, false] }).world, 3);
  assert.equal(s.skin, 'basic');
  assert.equal(s.up.mouth, 100);
  assert.equal(C.fmtKg(3e11), '3.0억 톤');
  assert.ok(C.fatScale(1e24) < 7.5);
  assert.equal(C.fmtKg(30), '30.0kg');
  assert.equal(C.fmtKg(2500), '2.5톤');
});

// 1초에 5번 누르고, 살 수 있는 것 중 제일 싼 것을 사는 사람이 걸리는 시간
test('월드 하나는 4분에서 25분 사이에 깬다', () => {
  const s = C.newSave();
  let sec = 0; const marks = [];
  while (!C.allDone(s) && sec < 20000) {
    sec += 1;
    for (let i = 0; i < 5; i += 1) { if (s.plate <= 0) { C.fillPlate(s, C.bestStage(s)); sec += 0.6; } C.bite(s); }
    C.robotBites(s, C.robotRate(s));
    for (;;) {
      const u = C.UPGRADES.map((x) => [x.id, C.upgradeCost(s, x.id)]).sort((a, b) => a[1] - b[1])[0];
      if (!(s.coins >= u[1]) || !C.buyUpgrade(s, u[0])) break;
    }
    if (C.canLevelUp(s)) { const r = C.levelUp(s); sec += 4; if (r.worldClear) marks.push(sec / 60); }
  }
  assert.equal(marks.length, 5, `끝까지 못 깸: ${s.stage}`);
  marks.forEach((m, i) => { const took = m - (i ? marks[i - 1] : 0); assert.ok(took > 4 && took < 25, `월드 ${i + 1}: ${took}분`); });
});

test('발전과제는 한 번만 받고 코인을 준다', () => {
  const s = C.newSave();
  assert.deepEqual(C.checkAdvancements(s), []);
  C.fillPlate(s, 0); C.bite(s);
  const got = C.checkAdvancements(s);
  assert.deepEqual(got.map((a) => a.id), ['bite1']);
  assert.equal(C.checkAdvancements(s).length, 0);
  s.friend = true;
  assert.deepEqual(C.checkAdvancements(s).map((a) => a.id), ['friend']);
  assert.ok(C.fixSave(JSON.parse(JSON.stringify(s))).adv.includes('friend'));
  assert.equal(new Set(C.ADVANCEMENTS.map((a) => a.id)).size, C.ADVANCEMENTS.length);
});

test('친구가 보낸 상태는 숫자만 받는다', () => {
  assert.equal(C.cleanPeer(null), null);
  assert.equal(C.cleanPeer({ p: [1, 'x', 0] }), null);
  const p = C.cleanPeer({ p: [999, -2, 1], w: -5, wd: 7, sk: 99, fd: 3.7, n: 4, m: 1, st: 'a', name: '나쁜 글' });
  assert.equal(p.x, 30); assert.equal(p.weight, 30); assert.equal(p.world, C.WORLD_COUNT); assert.equal(C.cleanPeer({ p: [0, 0, 0], wd: 'x' }).world, 1); assert.equal(p.skin, C.SKINS.length - 1);
  assert.equal(p.food, 3); assert.equal(p.stage, 0); assert.equal(p.name, undefined);
  assert.equal(C.peerNumber('p3'), 3);
});

test('클라우드 저장: 새 저장인지, 진행이 같은지', () => {
  const a = C.newSave(), b = C.newSave();
  assert.ok(C.cloudFresh(a)); assert.ok(C.cloudSame(a, b));
  b.stage = 3; b.weight = 500; b.coins = 900;
  assert.equal(C.cloudFresh(b), false); assert.equal(C.cloudSame(a, b), false);
  assert.match(C.cloudSummary(b), /월드 1 4레벨/);
  assert.match(C.cloudSummary({ junk: 1 }), /30\.0kg/);
  assert.ok(JSON.stringify(b).length < 30000);
});
