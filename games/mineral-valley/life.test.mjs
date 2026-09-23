import test from 'node:test';
import assert from 'node:assert/strict';
import { facingDot,inSwing,monsterReward,ringPoint,chase,knockback,MONSTER_SPEED,MONSTER_REACH,SWING_RANGE } from './life.mjs';
import { clampMap,PLAY_LIMIT,rareBoost } from './core.mjs';
import { MONSTER_REWARD,MONSTER_MAX,BALLOON_RESPAWN,AD_INTERVAL } from './events.mjs';
const actor=(x,z,facing=0)=>({x,z,facing});
test('공격은 앞쪽 13m 안에서만 닿고, 코앞이면 등 뒤라도 닿는다',()=>{
 const me=actor(0,0,0);                                  // +z 를 바라봄
 assert.equal(inSwing(me,{x:0,z:10}),true);
 assert.equal(inSwing(me,{x:0,z:SWING_RANGE+1}),false);
 assert.equal(inSwing(me,{x:0,z:-10}),false);            // 등 뒤 먼 곳
 assert.equal(inSwing(me,{x:0,z:-2}),true);              // 등 뒤라도 코앞
 assert.ok(Math.abs(facingDot(me,0,5)-1)<1e-9);
 assert.ok(Math.abs(facingDot(me,0,-5)+1)<1e-9);
 assert.equal(facingDot(me,0,0),1);
 const east=actor(0,0,Math.PI/2);                        // +x 를 바라봄
 assert.equal(inSwing(east,{x:9,z:0}),true);
 assert.equal(inSwing(east,{x:-9,z:0}),false);
});
test('몬스터는 가장 가까운 탐험가를 쫓다가 닿는 거리에서 멈춘다',()=>{
 const m={x:0,z:0,facing:0};
 const far=actor(500,0),close=actor(60,0);
 const first=chase(m,[far,close],1);
 assert.equal(first.target,close);
 assert.ok(Math.abs(m.x-MONSTER_SPEED)<1e-6,`한 번에 ${MONSTER_SPEED}m`);
 for(let i=0;i<20;i++)chase(m,[close],1);
 assert.ok(Math.hypot(close.x-m.x,close.z-m.z)<=MONSTER_REACH+.01);
 assert.equal(chase(m,[]),null);
});
test('부딪히면 몬스터 반대쪽으로 밀려나고 맵 밖으로는 나가지 않는다',()=>{
 const me=actor(100,0);
 knockback(me,{x:90,z:0},6);
 assert.equal(Math.round(me.x),106);
 const edge=actor(PLAY_LIMIT,0);
 knockback(edge,{x:PLAY_LIMIT-5,z:0},50,clampMap);
 assert.equal(edge.x,PLAY_LIMIT);
});
test('먼 곳의 몬스터일수록 보상이 크다',()=>{
 assert.equal(monsterReward(MONSTER_REWARD,rareBoost(0)),Math.round(MONSTER_REWARD*1.25));
 assert.ok(monsterReward(MONSTER_REWARD,rareBoost(16000))>monsterReward(MONSTER_REWARD,rareBoost(0))*12);
 assert.equal(MONSTER_MAX,14);
 assert.equal(BALLOON_RESPAWN,20);
 assert.equal(AD_INTERVAL,300);
});
test('생성 지점은 캠프를 피하고 맵 안에 머문다',()=>{
 for(let i=0;i<300;i++){
  const p=ringPoint({x:0,z:0},60,320,Math.random,clampMap,120);
  assert.ok(Math.hypot(p.x,p.z)>=120);
  assert.ok(Math.abs(p.x)<=PLAY_LIMIT&&Math.abs(p.z)<=PLAY_LIMIT);
 }
 const corner=ringPoint({x:PLAY_LIMIT,z:PLAY_LIMIT},60,320,Math.random,clampMap,0);
 assert.ok(Math.abs(corner.x)<=PLAY_LIMIT&&Math.abs(corner.z)<=PLAY_LIMIT);
});
