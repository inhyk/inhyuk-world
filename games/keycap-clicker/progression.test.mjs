import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState, restoreState, press, boostEffects } from '../../public/play/keycap-clicker/core.mjs';
import { freshStreak, rewardPress } from '../../public/play/keycap-clicker/rewards.mjs';
import { MISSIONS, missionProgress, claimMission, claimAchievement, newBoss, hitBoss } from '../../public/play/keycap-clicker/progression.mjs';

test('missions require new progress; claiming consumes one goal and cannot double-pay', () => {
  const s = freshState(); assert.equal(claimMission(s, 'taps'), 0);
  for (let i=0;i<60;i++) press(s);
  assert.equal(claimMission(s, 'taps'), 12); assert.equal(claimMission(s, 'taps'),0);
  assert.equal(missionProgress(s,MISSIONS[0]),0);
  s.stats.criticals=8; assert.equal(claimMission(s,'criticals'),18);
  s.stats.coins=3; assert.equal(claimMission(s,'coins'),20);
  assert.deepEqual(restoreState(JSON.parse(JSON.stringify(s))),s);
  const old=restoreState({level:9,presses:10000,money:123});
  assert.equal(missionProgress(old,MISSIONS[0]),0); assert.equal(old.money,123);
});
test('achievement rewards are locked until earned and claimable once across saves', () => {
  const s=freshState(); assert.equal(claimAchievement(s,'a1'),0);
  s.level=1; assert.equal(claimAchievement(s,'a1'),40);
  assert.equal(claimAchievement(s,'a1'),0);
  assert.equal(claimAchievement(restoreState(JSON.parse(JSON.stringify(s))),'a1'),0);
  assert.equal(claimAchievement(s,'unknown'),0);
});
test('bosses pay once on defeat, grow stronger, and cannot be defeated after timeout', () => {
  const s=freshState(),boss=newBoss(s,0);
  for(let i=0;i<89;i++) assert.equal(hitBoss(s,boss,1000),0);
  assert.equal(hitBoss(s,boss,1000),80); assert.equal(s.stats.bosses,1);
  assert.equal(hitBoss(s,boss,1000),0); assert.equal(s.money,80);
  const next=newBoss(s,2000); assert.equal(next.maxHp,114);
  assert.equal(hitBoss(s,next,20000,1000),0); assert.equal(s.stats.bosses,1);
  s.boosts.hammer=5; assert.equal(boostEffects(s).bossDamage,6);
});
test('every third fever is super fever, uses the upgraded charge count and grants 25x critical', () => {
  const streak=freshStreak();streak.fevers=2;
  const effects={feverCharge:30,feverDuration:13000};
  let result;for(let i=0;i<30;i++)result=rewardPress(streak,i*100,0,effects);
  assert.equal(result.superFever,true);assert.equal(result.multiplier,25);
  assert.equal(streak.feverDuration,15000);assert.equal(streak.charge,0);
  const s=freshState();assert.equal(press(s,result.multiplier),25);
});
