import test from 'node:test';
import assert from 'node:assert/strict';
import {LEVEL,BY_ID,CHECKPOINTS,STAGES,GOAL,ROUTES,killY,nearby,create,restore,serialize,step,boxAt,spawnPoint,restartRun,resetRecords,vanishPhase,hitsSpinner,groundBelow,formatTime,HW} from './core.mjs';

const idle=(s,sec,input={})=>{const ev=[];for(let i=0;i<sec*60;i++)ev.push(...step(s,input,1/60));return ev;};
const top=o=>o.y+o.h/2;

// 발판 from에서 to를 향해 달리다 가장자리에서 점프해 to에 착지하는지 확인하는 봇
// from/to는 오브젝트 또는 {obj,at} 노드 (at: 발판 위 서 있을 지점)
const node=n=>n.obj?n:{obj:n};
function place(s,o,at){const b=boxAt(o,s.clock);Object.assign(s,{x:at?.x??b.x,y:top(b),z:at?.z??b.z,vx:0,vy:0,vz:0,grounded:true,groundId:o.id});}
function cross(s,fromN,toN,{lead=.6}={}){
 const {obj:from,at:fromAt}=node(fromN),{obj:to,at:toAt}=node(toN);
 place(s,from,fromAt);idle(s,.2);
 if(to.type==='mover'||from.type==='mover'){
  // 움직이는 발판은 도착할 즈음 목표와 정렬되는 순간까지 기다린다.
  for(let i=0;i<600;i++){
   const a=boxAt(to,s.clock+lead),b=boxAt(from,s.clock+lead*.4);
   const off=to.axis==='x'||from.axis==='x'?Math.abs(a.x-b.x):0;
   const gap=(a.z-a.d/2)-(b.z+b.d/2);
   const vy=to.axis==='y'?top(a)-top(boxAt(to,s.clock)):0;
   const high=from.axis!=='y'||top(b)>=from.y+from.h/2+from.amp*.5;
   if(off<.4&&vy>=0&&gap<=2.6&&high)break;step(s,{},1/60);
  }
 }
 const narrow=from.w<2&&from.d>from.w*2;
 const ev=[];
 for(let i=0;i<300;i++){
  const b=boxAt(from,s.clock),t=toAt?{x:toAt.x,z:toAt.z}:boxAt(to,s.clock+.3);
  let dx=t.x-s.x,dz=t.z-s.z;
  const onFrom=s.groundId===from.id;
  // 좁은 다리 위에서는 끝까지 똑바로 달린 뒤 목표로 방향을 튼다.
  if(narrow&&onFrom&&s.z<b.z+b.d/2-1.2){dx=(b.x-s.x)*2;dz=1;}
  const m=Math.hypot(dx,dz)||1;dx/=m;dz/=m;
  const edge=onFrom&&(Math.abs(s.x+dx*.5-b.x)>b.w/2-HW||Math.abs(s.z+dz*.5-b.z)>b.d/2-HW);
  const e=step(s,{x:dx,z:dz,jump:edge},1/60);ev.push(...e);
  if(e.includes('death'))return {ok:false,why:'death',ev};
  if(e.includes('pad')&&to.type==='pad')return {ok:true,ev};
  if(e.includes('finish')&&to.type==='goal')return {ok:true,ev};
  if(s.grounded&&s.groundId===to.id)return {ok:true,ev};
  if(s.grounded&&s.groundId!==from.id&&s.groundId!==null&&i>5)return {ok:false,why:`landed ${s.groundId}`,ev};
 }
 return {ok:false,why:`timeout at ${s.x.toFixed(2)},${s.y.toFixed(2)},${s.z.toFixed(2)}`,ev};
}
// 점프대에 올라 앞으로 가면 to에 착지하는지
function bounce(pad,toN){
 const {obj:to}=node(toN);const s=create();place(s,pad);s.grounded=false;s.y+=.01;
 for(let i=0;i<200&&!s.finished;i++){const e=step(s,{z:1},1/60);if(e.includes('death'))return 'death';if(s.grounded&&s.groundId===to.id)return 'ok';}
 return `landed ${s.groundId} at ${s.z.toFixed(1)}`;
}
// 회전 막대 구간 봇: 막대는 중심을 지나므로 가운데는 반드시 점프로 넘어야 한다.
// 막대마다 앞에서 기다렸다가 중심 2.9m 앞에서 뛰어넘는다. 기다리는 시간을 0.05초씩 바꿔 가며
// 미리 시뮬레이션해서 통과되는 타이밍을 고른다.
const clone=s=>({...s,vanish:{...s.vanish}});
function runTo(s,tx,{untilZ,stopAt,target,jumpZ}){
 let jumped=false;
 for(let i=0;i<900;i++){
  const g=groundBelow({...s,z:s.z+.9,y:s.y+.01}),edge=g==null||g<s.y-.1;
  const go=stopAt==null||s.z<stopAt||jumped&&!s.grounded;
  const hop=jumpZ!=null&&!jumped&&s.z>=jumpZ;if(hop&&s.grounded)jumped=true;
  // 목표 발판 위에 오면 앞으로 가는 키를 떼어 지나치지 않게 한다.
  const brake=target&&s.z>target.z-target.d/2+.8;
  const e=step(s,{z:brake?0:go?1:0,x:(tx-s.x)*.5,jump:!brake&&go&&(edge||hop)&&s.grounded},1/60);
  if(e.includes('death'))return false;
  if(target&&s.grounded&&s.groundId===target.id)return true;
  if(!target&&s.z>=untilZ&&s.grounded)return true;
 }
 return false;
}
function dodge(fromN,toN){
 const {obj:from,at}=node(fromN),{obj:to,at:toAt}=node(toN);const tx=toAt?.x??to.x;
 let s=create();place(s,from,at);idle(s,.1);
 const spinners=LEVEL.filter(o=>o.type==='spinner'&&o.z>s.z&&o.z<to.z).sort((a,b)=>a.z-b.z);
 for(let k=0;k<spinners.length;k++){
  const sp=spinners[k],next=spinners[k+1];let ok=null;
  for(let wait=0;wait<6&&!ok;wait+=.05){
   const t=clone(s);idle(t,wait);
   // 다음 막대 앞 쉼터에서 멈추거나, 마지막 막대면 목표 발판까지
   const done=next?runTo(t,tx,{untilZ:sp.z+sp.len/2+.6,stopAt:next.z-next.len/2-1.3,jumpZ:sp.z-2.9})
    :runTo(t,tx,{target:to,jumpZ:sp.z-2.9});
   if(done){idle(t,.4);if(t.deaths===0&&(!next||t.grounded))ok=t;}
  }
  if(!ok)return `fail at ${sp.id}`;
  s=ok;
 }
 return s.groundId===to.id?'ok':`ended on ${s.groundId}`;
}
// 경유점을 따라 걷는 봇 (용암 미로)
function walk(fromN,path){
 const {obj:from,at}=node(fromN);const s=create();place(s,from,at);
 for(const p of path)for(let k=0;k<600;k++){const dx=p.x-s.x,dz=p.z-s.z,m=Math.hypot(dx,dz);if(m<.15)break;const e=step(s,{x:dx/Math.max(m,1),z:dz/Math.max(m,1)},1/60);if(e.includes('death'))return `death near ${p.x},${p.z}`;}
 return s.groundId===from.id?'ok':`off ${s.groundId}`;
}

test('코스는 9개 스테이지와 체크포인트, 골을 가진다',()=>{
 assert.equal(STAGES.length,100);assert.equal(CHECKPOINTS.length,100);
 CHECKPOINTS.forEach((c,i)=>assert.equal(c.cp,i));assert.ok(GOAL);
 assert.equal(new Set(LEVEL.map(o=>o.id)).size,LEVEL.length);
});

test('처음엔 출발 발판 위에 서 있고 가만히 있으면 떨어지지 않는다',()=>{
 const s=create();assert.deepEqual({x:s.x,y:s.y,z:s.z},spawnPoint(0));
 idle(s,2);assert.ok(s.grounded);assert.ok(Math.abs(s.y-0)<1e-6);assert.equal(s.deaths,0);
});

test('점프하면 약 2.4m 올라가고 다시 착지한다',()=>{
 const s=create();idle(s,.2);let peak=s.y;const ev=step(s,{jump:true},1/60);assert.ok(ev.includes('jump'));
 for(let i=0;i<60;i++){step(s,{},1/60);peak=Math.max(peak,s.y);}
 assert.ok(peak>2.2&&peak<2.6,`peak ${peak}`);assert.ok(s.grounded);
});

test('공중에서는 두 번 점프할 수 없다',()=>{
 const s=create();idle(s,.2);step(s,{jump:true},1/60);idle(s,.2);
 const vy=s.vy;const ev=step(s,{jump:true},1/60);assert.ok(!ev.includes('jump'));assert.ok(s.vy<vy);
});

test('떨어지면 넘어짐이 늘고 체크포인트에서 다시 시작한다',()=>{
 const s=create();s.checkpoint=2;Object.assign(s,{x:0,y:-5,z:-40,grounded:false});
 const ev=idle(s,1);assert.ok(ev.includes('death'));assert.equal(s.deaths,1);
 assert.deepEqual({x:s.x,z:s.z},{x:spawnPoint(2).x,z:spawnPoint(2).z});
});

test('용암에 닿으면 넘어진다',()=>{
 const s=create();s.checkpoint=1;Object.assign(s,{x:0,y:1.2,z:33,vy:0,grounded:false});
 const ev=idle(s,.5);assert.ok(ev.includes('death'));assert.equal(s.deaths,1);
});

test('체크포인트에 올라서면 진행도가 저장된다',()=>{
 const s=create();place(s,CHECKPOINTS[3]);const ev=idle(s,.1);
 assert.ok(ev.includes('checkpoint'));assert.equal(s.checkpoint,3);
 place(s,CHECKPOINTS[1]);idle(s,.1);assert.equal(s.checkpoint,3,'뒤로 가도 진행도는 줄지 않는다');
});

test('움직이는 발판은 위에 탄 캐릭터를 함께 옮긴다',()=>{
 const s=create();const m=LEVEL.find(o=>o.type==='mover'&&o.axis==='x');place(s,m);idle(s,.05);
 const before=s.x-boxAt(m,s.clock).x;idle(s,1.5);
 assert.ok(s.grounded&&s.groundId===m.id);assert.ok(Math.abs(s.x-boxAt(m,s.clock).x-before)<.05);
});

test('사라지는 블록은 밟고 잠시 후 사라졌다가 돌아온다',()=>{
 const s=create();const v=LEVEL.find(o=>o.type==='vanish');place(s,v);idle(s,.1);
 assert.equal(vanishPhase(s,v.id),'warning');idle(s,.8);assert.equal(vanishPhase(s,v.id),'gone');assert.ok(!s.grounded||s.groundId!==v.id);
 idle(s,3);assert.equal(vanishPhase(s,v.id),'solid');
});

test('회전 막대에 닿으면 넘어지고, 점프하면 피할 수 있다',()=>{
 const s=create();const sp=LEVEL.find(o=>o.type==='spinner');
 s.clock=0;Object.assign(s,{x:sp.x+2,y:sp.top,z:sp.z});assert.ok(hitsSpinner(s,sp,0));
 Object.assign(s,{y:sp.top+1.3});assert.ok(!hitsSpinner(s,sp,0));
});

test('점프대는 높이 튕겨 올린다',()=>{
 const s=create();const pad=LEVEL.find(o=>o.type==='pad');place(s,pad);s.grounded=false;s.y+=.01;
 const ev=idle(s,.1);assert.ok(ev.includes('pad'));assert.ok(s.vy>15);
});

test('골 발판에 착지하면 클리어하고 최고 기록을 남긴다',()=>{
 const s=create();s.time=90;place(s,GOAL);s.grounded=false;s.y+=.01;const ev=idle(s,.1);
 assert.ok(ev.includes('finish'));assert.ok(s.finished);assert.ok(Math.abs(s.best-90)<.1);
 restartRun(s);assert.equal(s.checkpoint,0);assert.equal(s.time,0);assert.ok(s.best>0);
});

test('저장 데이터는 정리되어 복원된다',()=>{
 const s=restore(JSON.stringify({checkpoint:99,deaths:-3,time:'x',best:12.5,sound:false}));
 assert.equal(s.checkpoint,99);assert.equal(s.deaths,0);assert.equal(s.time,0);assert.equal(s.best,12.5);assert.equal(s.sound,false);
 assert.deepEqual(Object.keys(serialize(s)).sort(),['best','checkpoint','deaths','finished','sound','time','version']);
 assert.equal(restore('망가진 데이터').checkpoint,0);
});

test('발밑 그림자 높이를 찾는다',()=>{const s=create();Object.assign(s,{y:3});assert.equal(groundBelow(s),0);});
test('시간 표시',()=>{assert.equal(formatTime(75.34),'1:15.3');assert.equal(formatTime(null),'—');});

// 코스 전체가 실제로 건널 수 있는지 봇으로 확인한다. 회전 막대 구간은 막대를 피하는 타이밍 검사로 대신한다.
const ids=type=>LEVEL.filter(o=>o.type===type);
const blocks=LEVEL.filter(o=>o.type==='block');
const cp=i=>CHECKPOINTS[i];
const movers=ids('mover'),vanish=ids('vanish'),pads=ids('pad'),ice=ids('ice'),belts=LEVEL.filter(o=>o.type==='conveyor'&&o.stage===10);
const inStage=(type,st)=>LEVEL.filter(o=>o.type===type&&o.stage===st);
const spiral=blocks.filter(o=>o.stage===6);
const routes=[
 ['1. 첫 점프',[cp(0),blocks[0],blocks[1],blocks[2],cp(1)]],
 ['2. 용암 징검다리',[cp(1),blocks[3],blocks[4],blocks[5],blocks[6],cp(2)]],
 ['3. 움직이는 발판',[cp(2),movers[0],movers[1],movers[2],cp(3)]],
 ['5. 사라지는 블록',[cp(4),...vanish.slice(0,4),cp(5)]],
 ['6. 하늘 점프대',[cp(5),pads[0]]],
 ['7. 나선 계단',[cp(6),...spiral,cp(7)]],
 ['9. 하늘 삼단 콤보',[cp(8),inStage('block',8)[0],movers[3],vanish[4],pads[1]]],
 ['10. 미끄러운 얼음길',[cp(9),...ice.slice(0,3),cp(10)]],
 ['11. 컨베이어 벨트',[cp(10),...belts,cp(11)]],
 ['12. 앞뒤로 움직이는 발판',[cp(11),movers[4],movers[5],cp(12)]],
 ['14. 점프대 릴레이',[cp(13),pads[2]]],
 ['15. 마지막 도전',[ice[3],movers[6],vanish[5],pads[4]]],
];
for(const [name,path] of routes)test(`코스를 건널 수 있다: ${name}`,()=>{
 for(let i=0;i<path.length-1;i++){const s=create();const r=cross(s,path[i],path[i+1]);assert.ok(r.ok,`${path[i].id} → ${path[i+1].id}: ${r.why}`);}
});
test('점프대에서 앞으로 가면 다음 발판에 도착한다',()=>{
 for(const [pad,target] of [[pads[0],cp(6)],[pads[1],cp(9)],[pads[2],inStage('block',13)[0]],[pads[3],cp(14)],[pads[4],cp(15)]]){
  const s=create();place(s,pad);s.grounded=false;s.y+=.01;const ev=[];
  for(let i=0;i<180&&!s.finished;i++){ev.push(...step(s,{z:1},1/60));if(s.grounded&&s.groundId===target.id)break;}
  if(target.type==='block'){for(let i=0;i<120;i++)step(s,{},1/60);assert.equal(s.groundId,target.id,'점프대 뒤 발판에서 멈출 수 있다');}
  assert.ok(s.groundId===target.id||s.finished,`${pad.id} → ${target.id} at ${s.x},${s.y},${s.z}`);
 }
});
test('회전 막대 다리와 쌍둥이 막대 구간을 점프로 통과할 수 있다',()=>{
 for(const [from,to] of [[cp(3),cp(4)],[cp(7),cp(8)],[cp(14),ice[3]]]){
  let ok=false;
  for(let start=0;start<6&&!ok;start+=.25){
   const s=create();s.checkpoint=from.cp;place(s,from);s.clock=start;
   // 막대가 다가오면 점프하는 간단한 봇
   for(let i=0;i<900;i++){
    const danger=LEVEL.filter(o=>o.type==='spinner'||o.type==='lava').some(o=>{
     if(o.type==='lava')return Math.abs(s.z+.35-o.z)<o.d/2+.5&&Math.abs(s.x-o.x)<o.w/2&&s.grounded;
     const probe={...s,y:s.y};for(const k of [.2,.3,.4])if(hitsSpinner({...probe,z:s.z+s.vz*k,x:s.x},o,s.clock+k))return true;return false;});
    const g=s.groundId&&BY_ID.get(s.groundId),edge=g&&g.w<2&&s.z+.5>g.z+g.d/2-HW; // 좁은 다리 끝에서만 점프
    const ev=step(s,{z:1,x:-s.x*.5,jump:(danger||edge)&&s.grounded},1/60);
    if(ev.includes('death'))break;
    if(to.type==='checkpoint'?s.checkpoint===to.cp:s.groundId===to.id){ok=true;break;}
   }
  }
  assert.ok(ok,`${from.id} → ${to.id}`);
 }
});

test('얼음 위에서는 미끄러져 바로 멈추지 않는다',()=>{
 const slow=o=>{const s=create();place(s,o);if(o.d>4)s.z=o.z-o.d/2+.6;for(let k=0;k<20;k++)step(s,{z:1},1/60);const v=s.vz;step(s,{},1/60);return v-s.vz;};
 assert.ok(slow(ice[0])<.3,'얼음 위 감속은 느리다');assert.ok(slow(cp(0))>1,'일반 바닥은 빨리 멈춘다');
});
test('컨베이어 벨트는 위에 선 캐릭터를 민다',()=>{
 for(const b of belts){const s=create();place(s,b);const x=s.x,z=s.z;for(let k=0;k<30;k++)step(s,{},1/60);
  assert.ok(Math.abs(s.x-x-b.dir[0]*b.push*.5)<.05&&Math.abs(s.z-z-b.dir[1]*b.push*.5)<.05,b.id);}
});
test('용암 미로는 안전한 길로 지나갈 수 있다',()=>{
 const s=create();s.checkpoint=12;place(s,cp(12));
 const path=[[-1,301],[-1,309],[3,309],[3,313],[-1,313],[-1,322]];
 for(const [x,z] of path){for(let k=0;k<400;k++){const dx=x-s.x,dz=z-s.z,m=Math.hypot(dx,dz);if(m<.15)break;const e=step(s,{x:dx/Math.max(m,1),z:dz/Math.max(m,1)},1/60);assert.ok(!e.includes('death'),`용암 ${s.x.toFixed(1)},${s.z.toFixed(1)}`);}}
 assert.equal(s.checkpoint,13);
});
test('바로 걸어 들어가면 용암 미로에서 넘어진다',()=>{
 const s=create();s.checkpoint=12;place(s,cp(12));const ev=[];for(let k=0;k<200;k++)ev.push(...step(s,{z:1},1/60));assert.ok(ev.includes('death'));
});

test('기록 리셋은 최고 기록까지 지우고 소리 설정은 남긴다',()=>{
 const s=create({checkpoint:7,deaths:12,time:300,best:95,finished:true,sound:false});
 resetRecords(s);
 assert.deepEqual(serialize(s),{version:1,checkpoint:0,deaths:0,time:0,best:null,finished:false,sound:false});
 assert.deepEqual({x:s.x,y:s.y,z:s.z},spawnPoint(0));
 assert.equal(restore(JSON.stringify(serialize(s))).best,null);
});

// 16~100 생성 스테이지: 모든 구간을 봇이 실제 입력으로 건너 본다.
for(let st=15;st<100;st++)test(`생성 스테이지 ${st+1} · ${STAGES[st]}`,()=>{
 const {nodes,edges}=ROUTES[st];
 assert.equal(nodes[0].obj.cp,st);assert.ok(nodes.at(-1).obj.cp===st+1||nodes.at(-1).obj.type==='goal');
 edges.forEach((e,i)=>{
  const a=nodes[i],b=nodes[i+1],label=`${a.obj.id} → ${b.obj.id} (${e.kind})`;
  if(e.kind==='hop'){const r=cross(create(),a,b);assert.ok(r.ok,`${label}: ${r.why}`);}
  else if(e.kind==='pad')assert.equal(bounce(a.obj,b),'ok',label);
  else if(e.kind==='spinner'){const r=dodge(a,b);assert.equal(r,'ok',`${label}: ${r}`);}
  else if(e.kind==='walk')assert.equal(walk(a,e.path),'ok',label);
  else assert.fail(label);
 });
});
test('생성 코스는 겹치는 발판이 없다',()=>{
 const solid=LEVEL.filter(o=>['block','checkpoint','vanish','pad','goal','ice','conveyor','pillar'].includes(o.type));
 const bad=[];
 for(let i=0;i<solid.length;i++)for(const o of nearby(solid[i].z)){const a=solid[i];if(o===a||!solid.includes(o)||o.id<a.id)continue;
  const ov=(p,q,k,s)=>Math.abs(p[k]-q[k])<(p[s]+q[s])/2-.01;
  if(ov(a,o,'x','w')&&ov(a,o,'z','d')&&ov(a,o,'y','h'))bad.push(`${a.id}/${o.id}`);}
 // 1~15 손으로 만든 코스의 의도된 겹침(징검돌 아래 용암 등은 solid 아님)만 허용
 assert.deepEqual(bad.filter(x=>!x.startsWith('block-')||true).filter(x=>{const [p,q]=x.split('/');return BY_ID.get(p).stage>=15||BY_ID.get(q).stage>=15;}),[]);
});
test('떨어짐 판정 높이는 코스를 따라 올라간다',()=>{
 const g=GOAL;assert.ok(killY(g.z)>300);assert.ok(killY(0)<0);
 for(const c of CHECKPOINTS)assert.ok(killY(c.z)<c.y,`cp ${c.cp}`);
});
