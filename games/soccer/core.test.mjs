import test from 'node:test';
import assert from 'node:assert/strict';
import {create,step,shoot,pass,HALF_L,HALF_W,BALL_R,restoreRecords,applyResult,newRecords,formatClock} from './core.mjs';

const run=(s,sec,input=null)=>{const ev=[];for(let i=0;i<sec*60;i++)ev.push(...step(s,input,1/60));return ev;};
const idle={x:0,z:0,sprint:false,shoot:false,pass:false};

test('킥오프: 홈팀 10번이 가운데에서 공을 가진다',()=>{
 const s=create();assert.equal(s.phase,'kickoff');assert.equal(s.ball.owner,4);assert.equal(s.players[4].num,10);
 run(s,1.3,idle);assert.equal(s.phase,'play');
});

test('강한 슛이 빈 골대에 들어가면 골',()=>{
 const s=create();run(s,1.3,idle);
 const p=s.players[4];Object.assign(p,{x:HALF_L-12,z:0,face:0});s.ball.owner=p.id;
 Object.assign(s.players[5],{x:HALF_L-1,z:8}); // 골키퍼를 비켜 둔다
 const ev=[];shoot(s,p,.5,0,ev);assert.ok(ev.includes('shoot'));
 const after=run(s,1.5,idle);assert.ok(after.includes('goal:home'),after.join());
 assert.deepEqual(s.score,[1,0]);assert.equal(s.phase,'goal');
 run(s,3.2,idle);assert.equal(s.phase,'kickoff');assert.equal(s.players[s.ball.owner].team,1);
});

test('공이 터치라인 밖으로 나가면 상대 스로인',()=>{
 const s=create();run(s,1.3,idle);
 Object.assign(s.ball,{owner:null,x:0,z:HALF_W-1,y:BALL_R,vx:0,vy:0,vz:12,lastTeam:0});
 for(const p of s.players)if(Math.hypot(p.x,p.z-HALF_W)<6)p.x+=10;
 const ev=run(s,.6,idle);assert.ok(ev.includes('out'));assert.equal(s.message,'스로인');
 assert.equal(s.players[s.ball.owner].team,1);
});

test('패스하면 공을 받은 선수로 조종이 넘어간다',()=>{
 const s=create();run(s,1.3,idle);
 const ev=[];pass(s,s.players[4],-1,0,ev);assert.ok(ev.includes('pass'));
 assert.notEqual(s.human,4);assert.equal(s.players[s.human].team,0);
});

test('AI끼리 3분 경기를 끝까지 치러도 값이 망가지지 않는다',()=>{
 for(const difficulty of ['easy','normal','hard']){
  const s=create({difficulty,seed:7});let n=0;
  while(!s.over&&n++<60*300){step(s,null,1/60);assert.ok(Number.isFinite(s.ball.x+s.ball.y+s.ball.z));}
  assert.ok(s.over);assert.equal(s.time,0);assert.ok(s.shots[0]+s.shots[1]>0);
 }
});

test('전적 저장과 복원',()=>{
 const r=newRecords(),s=create();s.score=[3,1];
 assert.deepEqual(applyResult(r,s),{res:'win',newBest:true});
 const back=restoreRecords(JSON.stringify(r));assert.equal(back.wins,1);assert.equal(back.bestWin,2);
 assert.equal(restoreRecords('망가진 값').played,0);
 assert.equal(formatClock(179.2),'3:00');assert.equal(formatClock(0),'0:00');
});
