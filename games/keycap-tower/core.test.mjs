import test from 'node:test';
import assert from 'node:assert/strict';
import {ITEMS,SKINS,EVENT_EVERY,EVENT_LENGTH,buyItem,buySkin,eventInfo,globalMult,WORLDS,STATS,TRAILS,AIR,JUMP_VY,GRAVITY,BUTTON_CD,fmt,needSpeed,levelOf,runSpeed,getWorld,pathPoint,pathS,boxAt,fresh,restore,serialize,step,respawn,toLobby,warpStage,enterWorld,buyStat,buyTread,buyTrail,rebirth,canRebirth,rebirthReq,keyGain,treadRate,winAmount,ownsTread,refreshUnlock} from './core.mjs';

const DT=1/60;
const idle=(s,sec,input={})=>{const all=[];for(let i=0;i<sec*60;i++)all.push(...step(s,input,DT));return all;};
function putOn(s,o){const b=boxAt(o,s.clock);s.x=b.x;s.z=b.z;s.y=b.top;s.vy=0;s.grounded=true;s.groundId=o.id;s.lastGroundY=s.y;}

test('숫자를 한국어 단위로 보여 준다',()=>{
 assert.equal(fmt(0),'0');assert.equal(fmt(9999),'9,999');assert.equal(fmt(12345),'1.23만');assert.equal(fmt(5e8),'5억');assert.equal(fmt(1.5e12),'1.5조');assert.equal(fmt(2.2e16),'2.2경');
});

test('레벨은 스피드가 쌓일수록 오르고 필요 스피드와 맞는다',()=>{
 assert.equal(levelOf(0),0);assert.equal(levelOf(4),0);assert.equal(levelOf(5),1);
 assert.ok(needSpeed(2001)>needSpeed(2000)&&needSpeed(5000)/needSpeed(2000)>10);
 for(const L of [1,3,25,120,400,1000]){assert.equal(levelOf(needSpeed(L)),L);assert.equal(levelOf(needSpeed(L)-1),L-1);}
 assert.ok(runSpeed(0)===8&&runSpeed(2000)<25&&runSpeed(120)>runSpeed(25));
});

test('월드는 50개이고 1월드부터 순서대로 열리며 뒤로 갈수록 타워가 높다',()=>{
 assert.equal(WORLDS.length,50);assert.deepEqual(WORLDS.slice(0,5).map(w=>w.req),[0,120,400,1000,5000]);
 for(let i=5;i<30;i++)assert.equal(WORLDS[i].req-WORLDS[i-1].req,3000,'5월드부터는 레벨이 3000씩 올라야 다음 월드');
 for(let i=30;i<50;i++)assert.equal(WORLDS[i].req-WORLDS[i-1].req,1000000,'30월드부터는 레벨이 1000000씩 올라야 다음 월드');
 assert.equal(WORLDS[29].req,80000);assert.equal(WORLDS[49].req,20080000);assert.ok(Math.abs(levelOf(needSpeed(WORLDS[49].req))-WORLDS[49].req)<=1);
 for(const w of WORLDS)for(let k=1;k<w.levels.length;k++)assert.ok(needSpeed(w.levels[k])>needSpeed(w.levels[k-1]));
 assert.equal(new Set(WORLDS.map(w=>w.name)).size,50);assert.ok(getWorld(49).top>getWorld(4).top&&WORLDS[49].levels.length>WORLDS[4].levels.length);
 assert.ok(Number.isFinite(needSpeed(WORLDS[49].levels.at(-1)))&&needSpeed(WORLDS[49].levels.at(-1))<1e72);
 WORLDS.forEach((w,i)=>{
  const W=getWorld(i);assert.equal(W.stages.length,w.levels.length);assert.equal(w.names.length,w.levels.length);assert.equal(w.wins.length,w.levels.length);assert.equal(w.segs.length,w.levels.length);
  assert.equal(w.levels[0],w.req);assert.equal(w.treads.length,3);assert.equal(w.treads[0].cost,0);
  assert.equal(W.objects.filter(o=>o.type==='tread').length,3);assert.equal(W.objects.filter(o=>o.type==='safe').length,w.levels.length);
  if(i)assert.ok(w.levels[0]>WORLDS[i-1].levels.at(-1)&&w.treads[0].mult>WORLDS[i-1].treads[2].mult&&w.wins[0]>WORLDS[i-1].wins.at(-1));
 });
});

test('모든 스테이지는 문 레벨의 빠르기로 건널 수 있다',()=>{
 const jumpH=JUMP_VY**2/(2*GRAVITY);
 WORLDS.forEach((w,i)=>{
  const W=getWorld(i);
  for(const st of W.stages){
   const reach=runSpeed(st.req)*AIR,row=W.objects.filter(o=>o.stage===st.k&&['key','mover','blink','safe'].includes(o.type)).sort((a,b)=>a.s-b.s);
   assert.ok(row.length>=5,`world ${i} stage ${st.k}`);
   for(let n=1;n<row.length;n++){
    const a=row[n-1],b=row[n];if(Math.abs(a.s-b.s)<.01)continue;
    const gap=(b.s-b.d/2)-(a.s+a.d/2),rise=b.top-a.top; // 오르내리는 키는 낮을 때를 기다려 건넌다
    assert.ok(gap<=reach*.6&&gap>0,`gap ${gap.toFixed(2)} reach ${reach.toFixed(2)} at world ${i} stage ${st.k}`);
    assert.ok(rise<jumpH-.2,`rise ${rise.toFixed(2)} at world ${i} stage ${st.k} ${a.id}->${b.id}`);
   }
  }
 });
});

test('나선 위치를 길 거리로 되돌릴 수 있다',()=>{
 for(const sv of [5,120,333,700]){const p=pathPoint(sv,1.5);assert.ok(Math.abs(pathS({x:p.x,y:p.y+.4,z:p.z})-sv)<.01);}
});

test('로비에 서 있고, 키캡을 밟으면 스피드가 오른다',()=>{
 const s=fresh();idle(s,.5);assert.equal(s.grounded,true);assert.equal(s.groundId,'lobby');assert.equal(s.speed,0);
 const W=getWorld(0),keys=W.objects.filter(o=>o.type==='key');
 putOn(s,keys[0]);s.y+=.2;let ev=idle(s,.2);assert.equal(s.speed,1);assert.equal(ev.filter(e=>e.t==='speed').length,1);
 idle(s,.5);assert.equal(s.speed,1,'같은 키에 서 있으면 더 오르지 않는다');
 putOn(s,keys[1]);s.y+=.2;idle(s,.2);assert.equal(s.speed,2);
 const high=keys.find(o=>o.stage===3);s.stats.power=4;s.rebirths=1;putOn(s,high);s.y+=.2;idle(s,.2);
 assert.equal(s.speed,2+keyGain(s,high));assert.equal(keyGain(s,high),Math.ceil(1.35**4)*4*2);
});

test('봇이 1월드 첫 스테이지를 올라 노란 버튼으로 윈을 받는다',()=>{
 const s=fresh(),W=getWorld(0),st=W.stages[0],row=W.objects.filter(o=>o.stage===0&&(o.type==='key'||o.type==='safe')).sort((a,b)=>a.s-b.s);
 let i=0,wins=0;
 for(let f=0;f<60*40&&!wins;f++){
  const target=i<row.length?row[i]:st.safe.button;if(s.groundId===row[i]?.id)i++;
  const dx=target.x-s.x,dz=target.z-s.z,dist=Math.hypot(dx,dz);
  const ev=step(s,{x:dist>.3?dx/dist:0,z:dist>.3?dz/dist:0,jump:s.grounded&&i<row.length&&dist<runSpeed(levelOf(s.speed))*.6+row[i].d/2-.6},DT);
  for(const e of ev){assert.notEqual(e.t,'death');if(e.t==='win')wins=e.gain;}
 }
 assert.equal(wins,1);assert.equal(s.wins,1);assert.equal(s.checkpoint,1);assert.equal(s.reached[0],1);assert.ok(s.speed>=6);
});

test('버튼은 잠깐 쉬어야 다시 눌린다',()=>{
 const s=fresh(),safe=getWorld(0).stages[0].safe;
 s.x=safe.button.x;s.z=safe.button.z;s.y=safe.top;s.lastGroundY=s.y;
 assert.equal(idle(s,1).filter(e=>e.t==='win').length,1);
 idle(s,BUTTON_CD-2);assert.equal(s.wins,1);idle(s,2);assert.equal(s.wins,2);
});

test('러닝머신은 가진 것만 스피드를 준다',()=>{
 const s=fresh(),W=getWorld(0),[choco,gold]=W.objects.filter(o=>o.type==='tread');
 putOn(s,choco);idle(s,2);assert.ok(Math.abs(s.speed-6)<.2,`chocolate ${s.speed}`);
 const before=s.speed;putOn(s,gold);const ev=idle(s,1);assert.equal(s.speed,before);assert.ok(ev.some(e=>e.t==='locked'&&e.index===1));
 assert.equal(buyTread(s,0,1),false);s.wins=30;assert.equal(buyTread(s,0,1),true);assert.equal(s.wins,0);assert.ok(ownsTread(s,0,1));
 idle(s,1);assert.ok(Math.abs(s.speed-before-9)<.3);
 s.stats.tread=4;assert.equal(treadRate(s,WORLDS[0].treads[2]),3*9*2);
 assert.equal(buyTread(s,1,1),false,'잠긴 월드의 러닝머신은 못 산다');
});

test('스탯은 윈으로 올리고 최대 레벨에서 멈춘다',()=>{
 const s=fresh();assert.equal(buyStat(s,'power'),false);
 s.wins=3;assert.equal(buyStat(s,'power'),true);assert.equal(s.stats.power,1);assert.equal(s.wins,0);
 s.wins=1e300;for(const k of Object.keys(STATS)){while(buyStat(s,k));assert.equal(s.stats[k],STATS[k].max);}
 assert.equal(winAmount(fresh(),0,7),1000);
});

test('DEL 키와 추락은 체크포인트로 돌려보낸다',()=>{
 const s=fresh(),W=getWorld(0);s.checkpoint=3;respawn(s);const home=W.stages[2].safe;assert.equal(s.groundId,home.id);
 putOn(s,W.objects.find(o=>o.type==='del'));s.y+=.2;let ev=idle(s,.3);assert.ok(ev.some(e=>e.t==='death'&&e.why==='del'));assert.equal(s.groundId,home.id);assert.equal(s.deaths,1);
 const p=pathPoint(home.s,12);s.x=p.x;s.z=p.z;ev=idle(s,2);assert.ok(ev.some(e=>e.t==='death'&&e.why==='fall'));assert.equal(s.groundId,home.id);
});

test('레벨 문은 레벨이 모자라면 막고, 충분하면 지나간다',()=>{
 const W=getWorld(0),wall=W.objects.find(o=>o.type==='wall'),prev=W.stages[wall.stage-1].safe;
 const run=speed=>{const s=fresh();s.speed=speed;s.checkpoint=wall.stage;respawn(s);const t=pathPoint(wall.s+1.2);let gate=false;
  for(let i=0;i<120;i++){const dx=t.x-s.x,dz=t.z-s.z,d=Math.hypot(dx,dz)||1;for(const e of step(s,{x:dx/d,z:dz/d},DT))if(e.t==='gate')gate=true;}
  return {gate,past:pathS({x:s.x,y:prev.top,z:s.z})>wall.s};};
 assert.deepEqual(run(0),{gate:true,past:false});assert.deepEqual(run(needSpeed(wall.req)),{gate:false,past:true});
});

test('레벨이 오르면 다음 월드가 열리고 들어갈 수 있다',()=>{
 const s=fresh();assert.equal(enterWorld(s,1),false);
 s.speed=needSpeed(120)-1;const key=getWorld(0).objects.find(o=>o.type==='key');putOn(s,key);s.y+=.2;
 const ev=idle(s,.3);assert.ok(ev.some(e=>e.t==='unlock'&&e.world===1));assert.equal(s.unlocked,1);
 assert.equal(enterWorld(s,1),true);assert.equal(s.world,1);assert.equal(s.groundId,'lobby');assert.ok(ownsTread(s,1,0));
 s.speed=needSpeed(1000);refreshUnlock(s);assert.equal(s.unlocked,3);
 s.speed=needSpeed(WORLDS[49].req);refreshUnlock(s);assert.equal(s.unlocked,49);assert.equal(enterWorld(s,49),true);idle(s,.3);assert.equal(s.grounded,true);s.speed=needSpeed(1000);assert.equal(enterWorld(s,3),true);idle(s,.3);assert.equal(s.grounded,true);
 assert.equal(enterWorld(s,0),true,'1월드로 돌아갈 수 있다');
});

test('환생은 스피드를 0으로 하고 배수를 두 배로 한다',()=>{
 const s=fresh();assert.equal(canRebirth(s),false);assert.equal(rebirth(s),false);
 s.speed=needSpeed(rebirthReq(0));s.wins=77;s.stats.power=3;s.unlocked=1;s.checkpoint=2;
 assert.equal(rebirth(s),true);assert.deepEqual([s.speed,s.rebirths,s.wins,s.stats.power,s.unlocked,s.checkpoint],[0,1,77,3,1,0]);
 assert.equal(keyGain(s,{stage:0}),Math.ceil(1.35**3)*2);
});

test('트레일은 사서 끼우면 배수가 붙는다',()=>{
 const s=fresh();assert.equal(buyTrail(s,0),false);s.wins=TRAILS[0].cost;assert.equal(buyTrail(s,0),true);assert.equal(s.trail,0);assert.equal(keyGain(s,{stage:0}),1.5);
 s.trail=-1;assert.equal(buyTrail(s,0),true,'이미 산 트레일은 다시 끼우기만 한다');assert.equal(s.wins,0);
});

test('스테이지 순간이동은 가 본 곳까지만 된다',()=>{
 const s=fresh();assert.equal(warpStage(s,2),false);s.reached[0]=3;assert.equal(warpStage(s,2),true);assert.equal(s.groundId,getWorld(0).stages[1].safe.id);
 toLobby(s);assert.equal(s.groundId,'lobby');assert.equal(s.reached[0],3);
});

test('쫓아오는 괴물은 서 있으면 잡고, 안전지대에 닿으면 사라진다',()=>{
 const s=fresh(),W=getWorld(0),st=W.stages[7];s.speed=needSpeed(st.req);s.checkpoint=7;respawn(s);
 const key=W.objects.find(o=>o.stage===7&&o.type==='key');putOn(s,key);
 const ev=idle(s,12);assert.ok(ev.some(e=>e.t==='chase'));assert.ok(ev.some(e=>e.t==='death'&&e.why==='chaser'));assert.equal(s.chaser,null);
});

test('저장과 불러오기, 망가진 저장은 새로 시작',()=>{
 const s=fresh();s.speed=12345;s.wins=99;s.stats.power=5;s.treads=['0-1'];s.trails=[1];s.trail=1;s.unlocked=1;s.world=1;s.reached[0]=8;s.reached[1]=2;s.items=['chocolate'];s.skins=[0,2];s.skin=2;s.checkpoint=2;s.rebirths=2;
 const r=restore(JSON.stringify(serialize(s)));assert.deepEqual(serialize(r),serialize(s));assert.equal(r.groundId,getWorld(1).stages[1].safe.id);
 assert.deepEqual(serialize(restore('{bad')),serialize(fresh()));
 const odd=restore({version:1,world:3,unlocked:0,speed:-5,stats:{power:999},treads:['9-9',3],trail:4,checkpoint:50});
 assert.deepEqual([odd.world,odd.speed,odd.stats.power,odd.treads.length,odd.trail,odd.checkpoint,odd.skin,odd.items.length],[0,0,400,0,-1,0,0,0]);
});

test('아이템 상점: 초콜릿 1.5배, 키캡 3배, 큰 키캡 10배',()=>{
 assert.deepEqual(ITEMS.map(i=>[i.rarity,i.name,i.mult,i.cost,i.price]),[['일반','초콜릿',1.5,3000,'3.0K트로피'],['에픽','키캡',3,100000,'100K트로피'],['비밀','큰 키캡',10,1000000,'1.0M트로피']]);
 const s=fresh();assert.equal(buyItem(s,'chocolate'),false);s.wins=3000;assert.equal(buyItem(s,'chocolate'),true);assert.equal(s.wins,0);assert.equal(globalMult(s),1.5);
 assert.equal(buyItem(s,'chocolate'),false,'두 번 살 수 없다');s.wins=1.1e6;buyItem(s,'keycap');buyItem(s,'bigkeycap');assert.equal(globalMult(s),45);assert.equal(s.wins,0);
});

test('스킨은 사서 입고, 가진 스킨은 그냥 갈아입는다',()=>{
 const s=fresh();assert.equal(s.skin,0);assert.equal(buySkin(s,1),false);s.wins=SKINS[1].cost;assert.equal(buySkin(s,1),true);assert.equal(s.skin,1);assert.equal(s.wins,0);
 assert.equal(buySkin(s,0),true);assert.equal(s.skin,0);assert.equal(buySkin(s,1),true);assert.equal(s.skin,1);
});

test('1시간마다 10분 동안 트로피가 2배',()=>{
 assert.deepEqual(eventInfo(0),{active:true,boost:2,remain:EVENT_LENGTH});assert.deepEqual(eventInfo(EVENT_LENGTH),{active:false,boost:1,remain:EVENT_EVERY-EVENT_LENGTH});
 assert.equal(eventInfo(EVENT_EVERY*7+30).active,true);assert.equal(eventInfo(EVENT_EVERY*7-1).remain,1);
 const s=fresh();assert.equal(winAmount(s,0,3),20);s.winBoost=2;assert.equal(winAmount(s,0,3),40);
});
