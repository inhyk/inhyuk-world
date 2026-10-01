import test from 'node:test';
import assert from 'node:assert/strict';
import { newProgress, sanitize, emptyStore, createAccount, exportCode, importCode } from './profile.mjs';
import { calendarBonus, todayKey, holidaysFor } from './calendar.mjs';
import { grantReward, claimDaily, rewardView, spin, addPlayTime, claimTime, DAILY_REWARDS, SPIN_PRIZES } from './rewards.mjs';
import { createCreatorSession } from './creator.mjs';
import { missionView, claim } from './missions.mjs';
import { SKINS, EFFECTS } from './shop.mjs';
import { floorState } from './tower.mjs';
const day = key => new Date(`${key}T12:00:00+09:00`);
const normal = day('2026-10-01');

test('한국 시간 자정에 생일 이벤트가 시작·종료되고 매년 반복한다', () => {
  assert.equal(todayKey(new Date('2026-05-11T15:00:00Z')), '2026-05-12');
  assert.equal(calendarBonus(new Date('2026-05-11T14:59:59Z')).coinMultiplier, 1);
  assert.equal(calendarBonus(new Date('2026-05-11T15:00:00Z')).coinMultiplier, 10);
  assert.equal(calendarBonus(new Date('2026-05-12T14:59:59Z')).coinMultiplier, 10);
  assert.equal(calendarBonus(new Date('2026-05-12T15:00:00Z')).coinMultiplier, 1);
  assert.equal(calendarBonus(day('2027-05-12')).coinMultiplier, 10);
});

test('양력·음력·대체공휴일·확정 선거일을 계산하고 평일에는 배율이 없다', () => {
  for (const date of ['2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-03-02',
    '2026-05-01', '2026-05-05', '2026-05-24', '2026-05-25', '2026-06-03', '2026-06-06', '2026-07-17',
    '2026-08-17', '2026-09-24', '2026-09-25', '2026-09-26', '2026-10-05', '2026-10-09', '2026-12-25',
    '2027-02-09', '2027-05-03', '2027-07-19', '2027-09-15', '2027-12-27']) {
    assert.equal(calendarBonus(day(date)).xpMultiplier, 2, date);
  }
  for (const date of ['2026-02-19', '2026-05-26', '2026-06-08', '2026-09-28', '2026-10-01', '2026-10-02']) {
    assert.equal(calendarBonus(day(date)).xpMultiplier, 1, date);
  }
  assert.equal(calendarBonus(day('2026-10-04')).xpMultiplier, 2, '일요일');
  assert.equal(holidaysFor(2025).has('2025-05-06'), true, '어린이날·부처님 오신 날이 같은 평일에 겹침');
  assert.equal(holidaysFor(2025).has('2025-05-07'), false, '같은 겹침으로 대체일을 두 번 만들지 않음');
  assert.equal(holidaysFor(2025).has('2025-07-17'), false);
});

test('생일 코인 ×10, 공휴일 경험치 ×2, 겹치면 각 배율을 한 번씩만 적용', () => {
  let p = newProgress();
  let r = grantReward(p, { coins: 100, xp: 60 }, normal);
  assert.equal(p.coins, 200); assert.equal(p.xp, 60);
  p = newProgress();
  r = grantReward(p, { coins: 100, xp: 60 }, day('2026-05-12'));
  assert.equal(r.coins, 1000); assert.equal(r.xp, 60); assert.equal(p.coins, 1100);
  p = newProgress();
  r = grantReward(p, { coins: 100, xp: 60 }, day('2026-05-05'));
  assert.equal(r.coins, 100); assert.equal(r.xp, 120); assert.equal(p.level, 2); assert.equal(p.xp, 20);
  p = newProgress();
  r = grantReward(p, { coins: 100, xp: 60 }, day('2030-05-12')); // 생일 + 일요일
  assert.equal(r.coins, 1000); assert.equal(r.xp, 120); assert.equal(r.lv.coins, 700);
  assert.equal(p.coins, 100 + 1000 + 700);
});

test('출석은 하루 한 번, 자정 갱신, 7일 순환, 결석 시 1일부터', () => {
  let p = newProgress();
  const dates = ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17'];
  for (const [i, date] of dates.entries()) {
    const now = day(date);
    assert.equal(rewardView(p, now).day, i % 7);
    const r = claimDaily(p, now);
    assert.equal(r.coins, DAILY_REWARDS[i % 7].coins);
    const before = JSON.stringify(p);
    assert.equal(claimDaily(p, now), null);
    assert.equal(JSON.stringify(p), before);
    p = sanitize(JSON.parse(JSON.stringify(p))); // 새로고침 후에도 수령 기록 유지
    assert.equal(claimDaily(p, now), null);
  }
  assert.equal(rewardView(p, day('2026-11-19')).day, 0);
  claimDaily(p, day('2026-11-19'));
  assert.equal(p.rewards.dailyStreak, 1);
  assert.equal(claimDaily(p, day('2026-11-18')), null);
  p = newProgress();
  assert.ok(claimDaily(p, new Date('2026-10-01T14:59:59Z')));
  assert.ok(claimDaily(p, new Date('2026-10-01T15:00:00Z')));
});

test('무료 스핀은 모든 칸에 당첨 가능하고 하루 한 번, 계정별로 저장', () => {
  for (let i = 0; i < SPIN_PRIZES.length; i++) {
    const p = newProgress(), r = spin(p, normal, () => (i + .5) / SPIN_PRIZES.length);
    assert.equal(r.index, i); assert.equal(r.coins, SPIN_PRIZES[i].coins);
    const saved = sanitize(JSON.parse(JSON.stringify(p)));
    assert.equal(spin(saved, normal), null);
    assert.equal(saved.rewards.spinIndex, i);
    assert.ok(spin(saved, day('2026-10-02')));
  }
  assert.equal(spin(newProgress(), normal, () => 1).index, 5);
  const a = newProgress(), b = newProgress();
  spin(a, normal); assert.ok(spin(b, normal));
});

test('시간 보상은 실제 누적 시간 문턱을 넘어야 한 번만 받으며 날짜별로 초기화', () => {
  let p = newProgress();
  addPlayTime(p, 299, normal);
  assert.equal(claimTime(p, '5m', normal), null);
  assert.equal(claimTime(p, 'bad', normal), null);
  addPlayTime(p, -50, normal); addPlayTime(p, Infinity, normal);
  assert.equal(p.rewards.playSeconds, 299);
  addPlayTime(p, 1, normal);
  assert.equal(claimTime(p, '5m', normal).coins, 100);
  p = sanitize(JSON.parse(JSON.stringify(p)));
  assert.equal(claimTime(p, '5m', normal), null);
  addPlayTime(p, 1500, normal);
  assert.equal(claimTime(p, '15m', normal).coins, 200);
  assert.equal(claimTime(p, '30m', normal).coins, 400);
  assert.equal(claimTime(p, '30m', normal), null);
  const next = rewardView(p, day('2026-10-02'));
  assert.equal(next.playSeconds, 0);
  assert.ok(next.time.every(r => !r.claimed && !r.ready));
});

test('출석·스핀·시간·챌린지 보상에도 생일 배율 적용, 수령 중복 방지', () => {
  const now = day('2026-05-12'), p = newProgress();
  assert.equal(claimDaily(p, now).coins, 1000);
  assert.equal(spin(p, now, () => 0).coins, 1000);
  addPlayTime(p, 300, now);
  assert.equal(claimTime(p, '5m', now).coins, 1000);
  p.missions['tower-chain-5'] = { v: 5, claimed: false };
  assert.equal(grantReward(p, claim(p, 'tower-chain-5'), now).coins, 2000);
  assert.equal(claim(p, 'tower-chain-5'), null);
});

test('옛 저장·손상된 보상 기록은 안전하게 복원', () => {
  const old = sanitize({ level: 8, coins: 234, tower: { best: 6, cleared: true } });
  assert.equal(old.level, 8); assert.equal(old.coins, 234); assert.equal(old.tower.cleared, true);
  assert.equal(old.rewards.dailyDate, ''); assert.equal(old.tower.cometEndings, 0);
  const broken = sanitize({ rewards: { dailyDate: 'invalid', dailyStreak: -3, playSeconds: -100, spinIndex: 8, claimedTime: ['5m', '5m', 'bad'] } });
  assert.equal(broken.rewards.dailyDate, ''); assert.equal(broken.rewards.dailyStreak, 0);
  assert.equal(broken.rewards.playSeconds, 0); assert.equal(broken.rewards.spinIndex, null);
  assert.deepEqual(broken.rewards.claimedTime, ['5m']);
});

test('기록 코드에도 보상 수령 내역이 보존되어 가져온 뒤 재수령 불가', async () => {
  const store = emptyStore();
  const { account } = await createAccount(store, '선물왕', 'abcd');
  claimDaily(account.progress, normal); spin(account.progress, normal);
  addPlayTime(account.progress, 300, normal); claimTime(account.progress, '5m', normal);
  const imported = importCode(emptyStore(), exportCode(account));
  assert.equal(imported.ok, true);
  const p = imported.account.progress;
  assert.equal(claimDaily(p, normal), null); assert.equal(spin(p, normal), null); assert.equal(claimTime(p, '5m', normal), null);
});

test('제작자 비밀번호가 맞아야 변경, 잠그기·새 세션 후 다시 인증', () => {
  const p = newProgress(), session = createCreatorSession(), before = JSON.stringify(p);
  for (const action of ['tower', 'level', 'missions', 'skins']) assert.equal(session.apply(p, action), null);
  assert.equal(session.unlock('777777'), false); assert.equal(session.unlock('77777777'), false);
  assert.equal(session.apply(p, 'level'), null); assert.equal(JSON.stringify(p), before);
  assert.equal(session.unlock('7777777'), true); assert.ok(session.apply(p, 'level')); assert.equal(p.level, 50);
  session.lock(); assert.equal(session.apply(p, 'tower'), null);
  assert.equal(createCreatorSession().unlocked, false);
});

test('제작자 기능은 타워·챌린지·스킨에 반영, 반복 사용해도 보상 복제 없음', () => {
  const p = newProgress(), session = createCreatorSession(); session.unlock('7777777');
  session.apply(p, 'tower'); assert.equal(p.tower.best, 6); assert.equal(p.tower.cleared, true);
  assert.equal(p.tower.comet, false); assert.equal(floorState(p.tower, 7), 'open'); assert.ok(p.owned.skin.includes('crown'));
  const coins = p.coins; session.apply(p, 'tower'); assert.equal(p.coins, coins);
  p.level = 72; p.xp = 8; session.apply(p, 'level'); assert.equal(p.level, 72); assert.equal(p.xp, 8);
  session.apply(p, 'missions'); const view = missionView(p);
  assert.ok([...view.list, ...view.daily].every(m => m.done));
  assert.ok(claim(p, 'tower-chain-5')); session.apply(p, 'missions'); assert.equal(claim(p, 'tower-chain-5'), null);
  session.apply(p, 'skins'); session.apply(p, 'skins');
  assert.deepEqual(p.owned.skin.slice().sort(), SKINS.map(s => s.id).sort());
  assert.deepEqual(p.owned.effect.slice().sort(), EFFECTS.map(s => s.id).sort());
  assert.equal(p.equip.skin, 'classic'); assert.equal(session.apply(p, 'invalid'), null);
});
