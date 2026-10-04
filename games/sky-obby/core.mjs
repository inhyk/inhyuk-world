// 하늘 점프맵 — 렌더링과 분리된 코스 데이터와 물리 계산.
import {generateStages,THEMES,TOTAL_STAGES} from './stages.mjs';
export {THEMES,TOTAL_STAGES};
export const GRAVITY=32,JUMP_VY=12.5,PAD_VY=21,SPEED=8,MAX_FALL=45,FALL_DEPTH=12;
export const HW=.4,HEIGHT=1.8;
export const VANISH_DELAY=.7,VANISH_BACK=2.7;
const HAND_STAGES=['첫 점프','용암 징검다리','움직이는 발판','회전 막대 다리','사라지는 블록','하늘 점프대','구름 나선 계단','쌍둥이 회전 막대','하늘 삼단 콤보','미끄러운 얼음길','컨베이어 벨트','앞뒤로 움직이는 발판','용암 미로','점프대 릴레이','구름 관문'];
const SOLID=new Set(['block','checkpoint','mover','vanish','pad','goal','pillar','ice','conveyor']);
export const ICE_ACCEL=10;

function buildLevel(){
 const list=[];let stage=0,n=0;
 const add=(type,o)=>{const h=o.h??1;const obj={id:`${type}-${n++}`,type,stage,h,...o,y:o.top-h/2};list.push(obj);return obj;};
 // 1. 첫 점프
 add('checkpoint',{cp:0,x:0,top:0,z:0,w:10,d:10});
 add('block',{x:0,top:0,z:9,w:3,d:3});
 add('block',{x:-1,top:.5,z:14,w:3,d:3});
 add('block',{x:1,top:1,z:19.5,w:3,d:3});
 stage=1;add('checkpoint',{cp:1,x:0,top:1,z:26,w:6,d:6});
 // 2. 용암 징검다리
 add('lava',{x:0,top:.6,z:37,w:8,d:16,h:.6});
 [[-1.5,31.5],[1.5,35],[-1.5,38.5],[1.5,42]].forEach(([x,z])=>add('block',{x,top:1.6,z,w:2,d:2}));
 stage=2;add('checkpoint',{cp:2,x:0,top:1.6,z:48,w:6,d:6});
 // 3. 움직이는 발판
 add('mover',{x:0,top:1.6,z:55,w:3,d:3,axis:'x',amp:3.5,period:4,phase:0});
 add('mover',{x:0,top:1.6,z:61,w:3,d:3,axis:'x',amp:3.5,period:4,phase:.5});
 add('mover',{x:0,top:1.6,z:67,w:3,d:3,axis:'y',amp:1.2,period:3.5,phase:0});
 stage=3;add('checkpoint',{cp:3,x:0,top:2.5,z:73,w:6,d:6});
 // 4. 회전 막대 다리
 add('block',{x:0,top:2.5,z:83,w:1.4,d:14});
 add('spinner',{x:0,top:2.5,z:83,len:7,speed:1.4,phase:0});
 stage=4;add('checkpoint',{cp:4,x:0,top:2.5,z:93,w:6,d:6});
 // 5. 사라지는 블록
 [[-1,99],[1,103],[-1,107],[1,111]].forEach(([x,z])=>add('vanish',{x,top:3,z,w:2.5,d:2.5}));
 stage=5;add('checkpoint',{cp:5,x:0,top:3.5,z:117,w:6,d:6});
 // 6. 하늘 점프대
 add('pad',{x:0,top:3.5,z:123,w:3,d:3});
 stage=6;add('checkpoint',{cp:6,x:0,top:9,z:130,w:6,d:6});
 // 7. 구름 나선 계단
 add('pillar',{x:0,top:24,z:140,w:2,d:2,h:26});
 for(let i=0;i<=12;i++){const a=-Math.PI/2+i*Math.PI/4;add('block',{x:+(5*Math.cos(a)).toFixed(3),top:10+i,z:+(140+5*Math.sin(a)).toFixed(3),w:2.6,d:2.6});}
 stage=7;add('checkpoint',{cp:7,x:0,top:22,z:150.5,w:6,d:6});
 // 8. 쌍둥이 회전 막대
 add('block',{x:0,top:22,z:162.25,w:6,d:17.5});
 add('spinner',{x:0,top:22,z:158,len:6.6,speed:1.3,phase:0});
 add('spinner',{x:0,top:22,z:166,len:6.6,speed:-1.5,phase:1});
 stage=8;add('checkpoint',{cp:8,x:0,top:22,z:174,w:6,d:6});
 // 9. 하늘 삼단 콤보
 add('block',{x:0,top:22,z:182,w:1.2,d:6});
 add('mover',{x:0,top:22,z:189.5,w:3,d:3,axis:'x',amp:3,period:3,phase:0});
 add('vanish',{x:0,top:23,z:195,w:2.5,d:2.5});
 add('pad',{x:0,top:23,z:200,w:3,d:3});
 stage=9;add('checkpoint',{cp:9,x:0,top:28,z:208,w:8,d:8});
 // 10. 미끄러운 얼음길 — 얼음 위에서는 잘 멈추지 않는다.
 add('ice',{x:0,top:28,z:216,w:2,d:6});
 add('ice',{x:2,top:28,z:223.5,w:2,d:5});
 add('ice',{x:-1,top:28.5,z:230.5,w:2.5,d:5});
 stage=10;add('checkpoint',{cp:10,x:0,top:29,z:239,w:6,d:6});
 // 11. 컨베이어 벨트 — 뒤로 미는 벨트, 옆으로 미는 벨트
 add('conveyor',{x:0,top:29,z:248,w:3,d:10,dir:[0,-1],push:4});
 add('conveyor',{x:0,top:29,z:259.5,w:3,d:9,dir:[1,0],push:3});
 stage=11;add('checkpoint',{cp:11,x:0,top:29,z:270,w:6,d:6});
 // 12. 앞뒤로 움직이는 발판
 add('mover',{x:0,top:29,z:277.5,w:3,d:3,axis:'z',amp:2,period:3,phase:0});
 add('mover',{x:0,top:29,z:284.5,w:3,d:3,axis:'z',amp:2,period:3,phase:.5});
 stage=12;add('checkpoint',{cp:12,x:0,top:30,z:296,w:6,d:12});
 // 13. 용암 미로 — 바닥의 용암 칸을 피하거나 뛰어넘는다.
 add('block',{x:0,top:30,z:310,w:8,d:16});
 ['#..#','#.##','#.##','#...','###.','#...','#.##','#.##'].forEach((row,r)=>[...row].forEach((c,k)=>{if(c==='#')add('lava',{x:-3+k*2,top:30.1,z:303+r*2,w:2,d:2,h:.3});}));
 stage=13;add('checkpoint',{cp:13,x:0,top:30,z:321,w:6,d:6});
 // 14. 점프대 릴레이
 add('pad',{x:0,top:30,z:328,w:3,d:3});
 add('block',{x:0,top:34,z:336,w:5,d:5});
 add('pad',{x:0,top:34,z:342,w:3,d:3});
 stage=14;add('checkpoint',{cp:14,x:0,top:39,z:351,w:6,d:6});
 // 15. 마지막 도전
 add('block',{x:0,top:39,z:359,w:1.2,d:8});
 add('spinner',{x:0,top:39,z:359,len:5,speed:1.5,phase:0});
 add('ice',{x:0,top:39,z:367,w:2.5,d:4});
 add('mover',{x:0,top:40,z:374,w:3,d:3,axis:'x',amp:2.5,period:2.8,phase:0});
 add('vanish',{x:0,top:41,z:380,w:2.5,d:2.5});
 add('pad',{x:0,top:41,z:385,w:3,d:3});
 stage=15;const cp15=add('checkpoint',{cp:15,x:0,top:46,z:393,w:8,d:8});
 // 16~100: 생성기
 const gen=generateStages({add,setStage:v=>{stage=v;}},{obj:cp15,z:397,top:46});
 return {list,...gen};
}
const BUILT=buildLevel();
export const LEVEL=BUILT.list;
export const STAGES=[...HAND_STAGES,...BUILT.names];
// 생성된 스테이지(16~100)의 봇 검증 경로: {nodes:[{obj,at?}], edges:[{kind,path?}]}
export const ROUTES=BUILT.routes;
export const BY_ID=new Map(LEVEL.map(o=>[o.id,o]));
export const CHECKPOINTS=LEVEL.filter(o=>o.type==='checkpoint').sort((a,b)=>a.cp-b.cp);
export const GOAL=LEVEL.find(o=>o.type==='goal');
// z 구간(10m)마다 가까운 오브젝트를 미리 모아 두어 물리 계산을 가볍게 한다.
const BIN=10;
export function zRange(o){const r=o.type==='spinner'?o.len/2:Math.max(o.d??0,o.w??0)/2;const a=o.type==='mover'&&o.axis!=='y'?o.amp:0;return [o.z-r-a,o.z+r+a];}
const BINS=new Map(),FLOOR=new Map();
for(const o of LEVEL){
 const [a,b]=zRange(o);
 for(let k=Math.floor((a-12)/BIN);k<=Math.floor((b+12)/BIN);k++){if(!BINS.has(k))BINS.set(k,[]);BINS.get(k).push(o);}
 // 떨어짐 판정 높이: 주변 40m 안에서 가장 낮은 발판보다 FALL_DEPTH 아래
 const low=(o.type==='spinner'?o.top:o.y+o.h/2)-FALL_DEPTH;
 for(let k=Math.floor((a-40)/BIN);k<=Math.floor((b+40)/BIN);k++)FLOOR.set(k,Math.min(FLOOR.get(k)??Infinity,low));
}
const EMPTY=[];
export function nearby(z){return BINS.get(Math.floor(z/BIN))||EMPTY;}
export function killY(z){return FLOOR.get(Math.floor(z/BIN))??-FALL_DEPTH;}

export function boxAt(o,t){
 if(o.type!=='mover')return o;
 const off=o.amp*Math.sin(2*Math.PI*(t/o.period+o.phase));
 return {...o,[o.axis]:o[o.axis]+off};
}
export function vanishPhase(s,id){
 const a=s.vanish[id];if(a==null)return 'solid';
 const dt=s.clock-a;return dt<VANISH_DELAY?'warning':dt<VANISH_BACK?'gone':'solid';
}
export function spinnerAngle(o,t){return o.speed*t+o.phase;}
export function spinnerEnds(o,t){
 const a=spinnerAngle(o,t),r=o.len/2,c=Math.cos(a)*r,sn=Math.sin(a)*r;
 return [{x:o.x-c,z:o.z-sn},{x:o.x+c,z:o.z+sn}];
}
export function solids(s,t=s.clock){
 const out=[];
 for(const o of nearby(s.z)){
  if(!SOLID.has(o.type))continue;
  if(o.type==='mover')out.push(boxAt(o,t));
  else if(o.type!=='vanish'||vanishPhase(s,o.id)!=='gone')out.push(o);
 }
 return out;
}

export function create(saved){
 const s={version:1,checkpoint:0,deaths:0,time:0,best:null,finished:false,sound:true,...saved,
  clock:0,x:0,y:0,z:0,vx:0,vy:0,vz:0,facing:0,grounded:false,groundId:null,coyote:0,jumpBuffer:0,vanish:{}};
 respawn(s);return s;
}
export function serialize(s){const {version,checkpoint,deaths,time,best,finished,sound}=s;return {version,checkpoint,deaths,time,best,finished,sound};}
export function restore(raw){
 let d={};try{d=JSON.parse(raw)||{};}catch{d={};}
 const num=(v,min,max,def)=>Number.isFinite(v)?Math.min(max,Math.max(min,v)):def;
 return create({
  checkpoint:Math.floor(num(d.checkpoint,0,CHECKPOINTS.length-1,0)),
  deaths:Math.floor(num(d.deaths,0,1e6,0)),time:num(d.time,0,1e7,0),
  best:Number.isFinite(d.best)&&d.best>0?d.best:null,finished:d.finished===true,sound:d.sound!==false,
 });
}
export function spawnPoint(cp){const c=CHECKPOINTS[cp]||CHECKPOINTS[0];return {x:c.x,y:c.y+c.h/2,z:c.z};}
export function respawn(s){
 const p=s.finished?{x:GOAL.x,y:GOAL.y+GOAL.h/2,z:GOAL.z}:spawnPoint(s.checkpoint);
 Object.assign(s,p,{vx:0,vy:0,vz:0,facing:0,grounded:true,groundId:null,coyote:0,jumpBuffer:0,vanish:{}});
}
export function restartRun(s){Object.assign(s,{checkpoint:0,deaths:0,time:0,finished:false});respawn(s);}
// 최고 기록까지 지우고 처음 상태로 (소리 설정은 유지)
export function resetRecords(s){s.best=null;restartRun(s);}

const approach=(v,target,delta)=>v<target?Math.min(target,v+delta):Math.max(target,v-delta);
function overlaps(s,b,eps=0){
 return s.x-HW<b.x+b.w/2&&s.x+HW>b.x-b.w/2&&s.z-HW<b.z+b.d/2&&s.z+HW>b.z-b.d/2&&s.y+eps<b.y+b.h/2&&s.y+HEIGHT-eps>b.y-b.h/2;
}
function resolve(s,boxes,axis){
 for(const b of boxes){
  // 발이 윗면에 거의 닿은 블록은 옆으로 밀지 않고 y축에서 올려 준다.
  if(axis!=='y'){if(!overlaps(s,b,.06)||s.y>=b.y+b.h/2-.06)continue;}
  else if(!overlaps(s,b))continue;
  if(axis==='x'){s.x=s.x<b.x?b.x-b.w/2-HW:b.x+b.w/2+HW;s.vx=0;}
  else if(axis==='z'){s.z=s.z<b.z?b.z-b.d/2-HW:b.z+b.d/2+HW;s.vz=0;}
  else if(s.y+HEIGHT/2>=b.y){s.y=b.y+b.h/2;if(s.vy<=0){s.vy=0;s.grounded=true;s.groundId=b.id;}}
  else{s.y=b.y-b.h/2-HEIGHT;if(s.vy>0)s.vy=0;}
 }
}
function segmentDistance(px,pz,a,b){
 const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz;
 const k=l?Math.max(0,Math.min(1,((px-a.x)*dx+(pz-a.z)*dz)/l)):0;
 return Math.hypot(px-a.x-dx*k,pz-a.z-dz*k);
}
export function hitsSpinner(s,o,t=s.clock){
 const barLow=o.top+.3,barHigh=o.top+.7;
 if(!(s.y<barHigh&&s.y+HEIGHT>barLow))return false;
 const [a,b]=spinnerEnds(o,t);return segmentDistance(s.x,s.z,a,b)<.25+HW;
}
function die(s,ev){s.deaths++;ev.push('death');respawn(s);}

function sub(s,input,dt,ev){
 const t0=s.clock;s.clock+=dt;const t=s.clock;s.time+=dt;
 const ground=s.groundId&&BY_ID.get(s.groundId);
 if(s.grounded&&ground?.type==='mover'){const a=boxAt(ground,t0),b=boxAt(ground,t);s.x+=b.x-a.x;s.y+=b.y-a.y;s.z+=b.z-a.z;}
 if(s.grounded&&ground?.type==='conveyor'){s.x+=ground.dir[0]*ground.push*dt;s.z+=ground.dir[1]*ground.push*dt;}
 let ix=input.x||0,iz=input.z||0;const m=Math.hypot(ix,iz);if(m>1){ix/=m;iz/=m;}
 const acc=!s.grounded?30:ground?.type==='ice'?ICE_ACCEL:70;
 s.vx=approach(s.vx,ix*SPEED,acc*dt);s.vz=approach(s.vz,iz*SPEED,acc*dt);
 if(m>.1)s.facing=Math.atan2(ix,iz);
 s.coyote=s.grounded?.1:Math.max(0,s.coyote-dt);
 if(s.jumpBuffer>0&&s.coyote>0){s.vy=JUMP_VY;s.jumpBuffer=0;s.coyote=0;s.grounded=false;s.groundId=null;ev.push('jump');}
 s.jumpBuffer=Math.max(0,s.jumpBuffer-dt);
 s.vy=Math.max(s.vy-GRAVITY*dt,-MAX_FALL);
 const boxes=solids(s,t);
 s.x+=s.vx*dt;resolve(s,boxes,'x');
 s.z+=s.vz*dt;resolve(s,boxes,'z');
 const was=s.grounded;s.grounded=false;s.groundId=null;
 s.y+=s.vy*dt;resolve(s,boxes,'y');
 if(s.grounded&&!was)ev.push('land');
 for(const id in s.vanish)if(t-s.vanish[id]>=VANISH_BACK)delete s.vanish[id];
 const g=s.groundId&&BY_ID.get(s.groundId);
 if(s.grounded&&g){
  if(g.type==='pad'){s.vy=PAD_VY;s.grounded=false;s.groundId=null;s.coyote=0;ev.push('pad');}
  else if(g.type==='vanish'&&s.vanish[g.id]==null)s.vanish[g.id]=t;
  else if(g.type==='checkpoint'&&g.cp>s.checkpoint){s.checkpoint=g.cp;ev.push('checkpoint');}
  else if(g.type==='goal'){s.finished=true;if(s.best==null||s.time<s.best)s.best=s.time;ev.push('finish');return;}
 }
 if(s.y<killY(s.z)||nearby(s.z).some(o=>o.type==='lava'?overlaps(s,o):o.type==='spinner'&&hitsSpinner(s,o,t)))die(s,ev);
}

// input: {x,z} 월드 기준 이동 방향, jump: 이번 프레임에 점프를 눌렀는지
export function step(s,input,dt){
 const ev=[];if(s.finished)return ev;
 if(input.jump)s.jumpBuffer=.14;
 let remain=Math.min(dt,.1);
 while(remain>1e-9&&!s.finished){const h=Math.min(remain,1/120);sub(s,input,h,ev);remain-=h;}
 return ev;
}
// 발밑 그림자를 그릴 가장 가까운 윗면 높이
export function groundBelow(s){
 let best=null;
 for(const b of solids(s)){
  const top=b.y+b.h/2;
  if(top<=s.y+.05&&Math.abs(s.x-b.x)<b.w/2&&Math.abs(s.z-b.z)<b.d/2&&(best==null||top>best))best=top;
 }
 return best;
}
export function formatTime(sec){
 if(sec==null)return '—';
 const m=Math.floor(sec/60),r=sec-m*60;return `${m}:${r.toFixed(1).padStart(4,'0')}`;
}
