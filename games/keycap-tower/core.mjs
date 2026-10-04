// 키캡 타워 — 렌더링과 분리된 타워 데이터, 물리, 성장 계산.
export const GRAVITY=32,JUMP_VY=12.5,MAX_FALL=45,HW=.4,HEIGHT=1.8,STEP=.6,FALL_LIMIT=9;
// 타워는 기둥을 감고 올라가는 나선 길이다. s는 길을 따라 잰 거리, lat은 바깥쪽으로 벗어난 거리.
export const R=30,PITCH=16,TURN=2*Math.PI*R,SLOPE=PITCH/TURN,BASE=.6,LOBBY_R=52,PILLAR_R=15;
export const AIR=2*JUMP_VY/GRAVITY;
export const VANISH_DELAY=.8,VANISH_BACK=3,BUTTON_R=2.1,BUTTON_CD=30,GOLD_CD=25,TREAD_STEPS=3,MAX_REBIRTH=30;
const KEYLIKE=new Set(['key','mover','blink']);
const LETTERS='QWERTYUIOPASDFGHJKLZXCVBNM1234567890';

export const WORLDS=[
 {name:'캔디 타워',emoji:'🍬',req:0,keyMult:1,
  levels:[0,3,8,15,25,40,60,90],
  names:['젤리 입구','사탕 지팡이 길','초콜릿 시냇물','마시멜로 미로','캐러멜 협곡','롤리팝 절벽','스프링클 질주','코코아 왕관'],
  segs:[['plain:6'],['plain:3','zig:4'],['plain:3','mover:3','plain:2'],['plain:3','del:3','plain:2'],['zig:3','blink:4','plain:2'],['plain:3','spin','plain:3'],['mover:3','del:3','blink:3'],['zig:3','spin','mover:3','blink:3']],
  chasers:[7],wins:[1,3,8,20,50,150,400,1000],
  treads:[{name:'초콜릿 러닝머신',mult:1,cost:0},{name:'골드 러닝머신',mult:3,cost:30},{name:'다이아 러닝머신',mult:9,cost:600}],
  theme:{sky:'#ffc9de',fog:'#ffe3ee',floor:'#ffe8cc',keys:['#8d5a3b','#fff4e6','#ff8fab','#a0e7e5'],safe:'#fff9db',accent:'#ffb347',pillar:'#7a4a2f',ink:'#4a2c1a',dark:false}},
 {name:'네온 타워',emoji:'🌈',req:120,keyMult:25,
  levels:[120,150,185,225,275,330],
  names:['네온 입구','RGB 물결','커서의 추격','엘리베이터 키','글리치 구간','오버클럭'],
  segs:[['plain:4','mover:3'],['blink:4','del:3'],['zig:4','spin','plain:3'],['lift:4','plain:3'],['del:4','mover:3','blink:3'],['spin','lift:3','del:3','blink:4']],
  chasers:[2,5],wins:[5e3,15e3,45e3,135e3,405e3,1215e3],
  treads:[{name:'캔디 러닝머신',mult:25,cost:0},{name:'젤리 러닝머신',mult:60,cost:2e5},{name:'어드민 러닝머신',mult:150,cost:2e6}],
  theme:{sky:'#120b2e',fog:'#24124d',floor:'#1d1b3a',keys:['#22d3ee','#a855f7','#f472b6','#4ade80'],safe:'#312e6b',accent:'#facc15',pillar:'#0b0920',ink:'#ffffff',dark:true}},
 {name:'용암 타워',emoji:'🌋',req:400,keyMult:1000,
  levels:[400,470,560,660,780,900],
  names:['불씨 계단','마그마 키','녹는 키캡','화염 선풍기','화산 추격','용암 왕좌'],
  segs:[['zig:4','blink:3'],['mover:4','del:3'],['spin','blink:4','spin'],['lift:4','del:4'],['blink:5','mover:4'],['spin','del:4','lift:3','blink:4']],
  chasers:[3,5],wins:[5e6,15e6,45e6,135e6,405e6,1215e6],
  treads:[{name:'마그마 러닝머신',mult:1000,cost:0},{name:'화염 러닝머신',mult:2500,cost:2e8},{name:'드래곤 러닝머신',mult:6000,cost:2e9}],
  theme:{sky:'#3b0d0d',fog:'#6b1a0f',floor:'#3a2420',keys:['#343a40','#ff6b35','#ffa94d','#868e96'],safe:'#5c3a2e',accent:'#ffd43b',pillar:'#1c1210',ink:'#ffffff',dark:true}},
 {name:'은하 타워',emoji:'🌌',req:1000,keyMult:50000,
  levels:[1000,1150,1320,1500,1750,2000],
  names:['별빛 입구','소행성 키','블랙홀 가장자리','혜성 추격','초신성','은하 왕관'],
  segs:[['zig:5','lift:3'],['blink:5','del:4'],['mover:5','spin'],['del:5','blink:5'],['spin','lift:4','spin'],['zig:4','del:4','mover:4','blink:5','spin']],
  chasers:[2,4,5],wins:[5e9,15e9,45e9,135e9,405e9,1215e9],
  treads:[{name:'별빛 러닝머신',mult:50000,cost:0},{name:'성운 러닝머신',mult:120000,cost:2e11},{name:'은하 러닝머신',mult:300000,cost:2e12}],
  theme:{sky:'#050418',fog:'#0d0a33',floor:'#14113a',keys:['#fcc419','#748ffc','#e599f7','#f8f9fa'],safe:'#2b2a5c',accent:'#63e6be',pillar:'#060518',ink:'#1a1440',dark:true}},
];
export const STATS={
 power:{name:'발걸음 힘',icon:'💪',max:60,cost:l=>Math.ceil(3*1.6**l),value:l=>Math.ceil(1.35**l),show:v=>`+${fmt(v)}`,desc:'키캡을 밟을 때 얻는 스피드'},
 wins:{name:'윈 배수',icon:'🏆',max:30,cost:l=>Math.ceil(25*2.4**l),value:l=>1.5**l,show:v=>`×${fmt(v)}`,desc:'노란 버튼에서 받는 윈'},
 tread:{name:'러닝머신 효율',icon:'🏃',max:40,cost:l=>Math.ceil(15*2**l),value:l=>1+.25*l,show:v=>`×${v.toFixed(2)}`,desc:'러닝머신에서 얻는 스피드'},
 run:{name:'달리기',icon:'👟',max:8,cost:l=>Math.ceil(10*3**l),value:l=>1+.03*l,show:v=>`×${v.toFixed(2)}`,desc:'움직이는 빠르기'},
 jump:{name:'점프력',icon:'🦘',max:8,cost:l=>Math.ceil(10*3**l),value:l=>1+.04*l,show:v=>`×${v.toFixed(2)}`,desc:'점프 높이'},
};
export const TRAILS=[
 {name:'초록 트레일',mult:1.5,cost:500,color:'#51cf66'},
 {name:'보라 트레일',mult:3,cost:5e4,color:'#b197fc'},
 {name:'무지개 트레일',mult:5,cost:5e6,color:'#ff6b6b'},
 {name:'은하 트레일',mult:10,cost:5e8,color:'#74c0fc'},
 {name:'무한 트레일',mult:20,cost:5e10,color:'#ffd43b'},
];

// 숫자
const UNITS=[[1e24,'자'],[1e20,'해'],[1e16,'경'],[1e12,'조'],[1e8,'억'],[1e4,'만']];
export function fmt(n){
 n=Number(n)||0;if(n<1e4)return Number.isInteger(n)?n.toLocaleString('en-US'):(+n.toFixed(n<10?2:1)).toLocaleString('en-US');
 for(const [u,name] of UNITS)if(n>=u){const v=n/u;return `${v>=100?Math.floor(v).toLocaleString('en-US'):+v.toFixed(v>=10?1:2)}${name}`;}
 return String(n);
}
export const needSpeed=L=>L<=0?0:Math.round(5*L**1.6*1.012**L);
export function levelOf(speed){let lo=0,hi=6000;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(needSpeed(mid)<=speed)lo=mid;else hi=mid-1;}return lo;}
export const runSpeed=(level,run=0)=>(8+16*(1-Math.exp(-level/150)))*STATS.run.value(run);
export const jumpVy=(jump=0)=>JUMP_VY*STATS.jump.value(jump);
export const rebirthMult=r=>2**r;
export const rebirthReq=r=>50*(r+1);
export const trailMult=s=>s.trail>=0?TRAILS[s.trail].mult:1;
export const globalMult=s=>rebirthMult(s.rebirths)*trailMult(s);
export const stepPower=s=>STATS.power.value(s.stats.power);
export const keyGain=(s,o)=>stepPower(s)*WORLDS[s.world].keyMult*(o.stage+1)*globalMult(s);
export const treadRate=(s,tr)=>TREAD_STEPS*stepPower(s)*tr.mult*STATS.tread.value(s.stats.tread)*globalMult(s);
export const winAmount=(s,w,k)=>Math.round(WORLDS[w].wins[k]*STATS.wins.value(s.stats.wins));
export const treadId=(w,i)=>`${w}-${i}`;
export const ownsTread=(s,w,i)=>WORLDS[w].treads[i].cost===0||s.treads.includes(treadId(w,i));

// 나선 길 위의 한 점
export function pathPoint(sv,lat=0){const th=sv/R,ox=Math.cos(th),oz=Math.sin(th),r=R+lat;return {x:r*ox,z:r*oz,y:BASE+sv*SLOPE,ox,oz,tx:-oz,tz:ox};}
function place(o){const p=pathPoint(o.s,o.lat||0);o.x=p.x;o.z=p.z;o.ox=p.ox;o.oz=p.oz;o.tx=p.tx;o.tz=p.tz;return o;}
function rng(seed){return ()=>(seed=(seed*16807)%2147483647)/2147483647;}

function buildWorld(w){
 const def=WORLDS[w],rnd=rng(97+w*131),objects=[],stages=[],spinners=[];let n=0,cur=2;
 const add=(type,o)=>{const obj=place({id:`${type}-${n++}`,type,h:1,lat:0,...o});obj.top??=+(BASE+obj.s*SLOPE).toFixed(3);objects.push(obj);return obj;};
 const last=def.levels.length-1;
 def.levels.forEach((req,k)=>{
  const v=runSpeed(req),reach=v*AIR,gap=Math.min(8.5,Math.max(1.2,reach*(.3+.22*k/last))),d=+(3+v*.1).toFixed(2),kw=+(4.2-k/last).toFixed(2);
  const st={k,req,name:def.names[k],start:cur,gap,chaser:def.chasers.includes(k)?+(v*.5).toFixed(2):0};
  if(req>0)add('wall',{s:cur+.4,w:16,d:.6,h:7,top:+(BASE+cur*SLOPE+7).toFixed(3),req,stage:k});
  let letter=k*7;
  const key=(type,o={})=>{cur+=gap;const dd=o.d??d,obj=add(type,{s:cur+dd/2,w:kw,d:dd,stage:k,label:LETTERS[letter++%LETTERS.length],...o});cur+=dd;return obj;};
  const first=objects.length;
  for(const seg of def.segs[k]){
   const [kind,count]=seg.split(':'),m=+count||1;
   for(let i=0;i<m;i++){
    if(kind==='plain')key('key',{lat:+((rnd()-.5)*2.4).toFixed(2)});
    else if(kind==='zig')key('key',{lat:(i%2?1:-1)*2.6});
    else if(kind==='mover')key('mover',{axis:'lat',amp:2.6,period:+(3.2+rnd()).toFixed(2),phase:+(i*.37).toFixed(2),label:'↔'});
    else if(kind==='lift')key('mover',{axis:'y',amp:.9,period:3,phase:i*.25,label:'↕'});
    else if(kind==='blink')key('blink',{lat:(i%2?1:-1)*1.2,label:'?'});
    else if(kind==='del'){const bad=rnd()<.5?-1:1;cur+=gap;add('del',{s:cur+d/2,lat:bad*2.4,w:3.8,d,stage:k,label:'DEL'});add('key',{s:cur+d/2,lat:-bad*2.4,w:3.8,d,stage:k,label:LETTERS[letter++%LETTERS.length]});cur+=d;}
    else if(kind==='spin'){const p=key('key',{d:13,w:3.4,label:'SPACE'});spinners.push(add('spinner',{s:p.s,len:7.5,speed:+((1.2+k*.08)*(rnd()<.5?-1:1)).toFixed(2),phase:+(rnd()*6).toFixed(2),top:p.top,stage:k}));}
   }
  }
  // 황금 키캡: 길 옆에 살짝 떨어져 있는 보너스
  const mains=objects.slice(first).filter(o=>o.type==='key'&&o.d<10&&Math.abs(o.lat)<2),mid=mains[Math.floor(mains.length/2)];
  if(mid)add('gold',{s:mid.s,lat:(mid.lat>0?-1:1)*6.4,w:2.6,d:2.6,stage:k,label:'★',top:mid.top});
  cur+=gap*.8;
  const safe=add('safe',{s:cur+6,w:9,d:12,cp:k+1,stage:k});safe.button=place({s:safe.s+2.5,lat:0});
  cur+=12;st.end=cur;st.safe=safe;stages.push(st);
 });
 // 로비: 러닝머신 세 대와 상점·포탈·환생 자리
 def.treads.forEach((tr,i)=>add('tread',{s:(Math.PI+(i-1)*.24)*R,lat:13,w:4.5,d:8,h:.4,top:.4,index:i}));
 const zones=[['stat',-1.25],['world',-2],['rebirth',2.2]].map(([id,th])=>({id,r:3.4,...place({s:th*R,lat:14})}));
 const spawn=place({s:-.5*R,lat:11});
 const solids=objects.filter(o=>o.type!=='spinner');
 return {index:w,def,objects,solids,stages,spinners,zones,spawn,lobby:{id:'lobby',type:'lobby',top:0},byId:new Map(objects.map(o=>[o.id,o])),top:BASE+cur*SLOPE,length:cur};
}
const cache=[];
export const getWorld=w=>cache[w]??=buildWorld(w);

export function boxAt(o,clock){
 if(o.type!=='mover')return o;
 const a=o.amp*Math.sin(2*Math.PI*(clock/o.period+o.phase));
 return o.axis==='y'?{x:o.x,z:o.z,top:o.top+a}:{x:o.x+o.ox*a,z:o.z+o.oz*a,top:o.top};
}
export function vanishPhase(s,id){
 const t0=s.vanish[id];if(t0==null)return 'solid';
 const e=s.clock-t0;if(e<VANISH_DELAY)return 'warning';if(e<VANISH_BACK)return 'gone';
 delete s.vanish[id];return 'solid';
}
export const spinnerAngle=(o,clock)=>o.phase+clock*o.speed;
export const onPath=s=>s.y>.3&&Math.abs(Math.hypot(s.x,s.z)-R)<9;
// 플레이어가 나선 길의 어디쯤 있는지 (높이로 몇 바퀴째인지 고른다)
export function pathS(s){const a=Math.atan2(s.z,s.x)*R;return a+Math.round(((s.y-BASE)/SLOPE-a)/TURN)*TURN;}
export const buttonReady=(s,w,k)=>(s.cool[`b${w}-${k}`]??-1e9)+BUTTON_CD<=s.clock;
export const buttonWait=(s,w,k)=>Math.max(0,(s.cool[`b${w}-${k}`]??-1e9)+BUTTON_CD-s.clock);

// 상태
export function fresh(){
 const s={version:1,world:0,checkpoint:0,speed:0,wins:0,totalWins:0,rebirths:0,stats:{power:0,wins:0,tread:0,run:0,jump:0},treads:[],trails:[],trail:-1,unlocked:0,reached:[0,0,0,0],deaths:0,sound:true,
  x:0,y:0,z:0,vx:0,vy:0,vz:0,facing:0,grounded:true,groundId:'lobby',lastKey:null,lastGroundY:0,clock:0,vanish:{},cool:{},chaser:null};
 respawn(s);return s;
}
const SAVED=['version','world','checkpoint','speed','wins','totalWins','rebirths','stats','treads','trails','trail','unlocked','reached','deaths','sound'];
export function serialize(s){const o={};for(const k of SAVED)o[k]=s[k];return o;}
export function restore(raw){
 const s=fresh();let d;try{d=typeof raw==='string'?JSON.parse(raw):raw;}catch{d=null;}
 if(!d||d.version!==1)return s;
 const num=(v,min,max,dflt=min)=>Number.isFinite(v)?Math.min(max,Math.max(min,v)):dflt,int=(v,min,max)=>Math.floor(num(v,min,max));
 s.speed=num(d.speed,0,1e300);s.wins=num(d.wins,0,1e300);s.totalWins=num(d.totalWins,0,1e300);s.rebirths=int(d.rebirths,0,MAX_REBIRTH);s.deaths=int(d.deaths,0,1e9);
 for(const k of Object.keys(STATS))s.stats[k]=int(d.stats?.[k],0,STATS[k].max);
 s.unlocked=int(d.unlocked,0,WORLDS.length-1);s.world=int(d.world,0,s.unlocked);
 s.reached=WORLDS.map((W,i)=>int(d.reached?.[i],0,W.levels.length));s.checkpoint=int(d.checkpoint,0,s.reached[s.world]);
 s.treads=Array.isArray(d.treads)?d.treads.filter(id=>typeof id==='string'&&/^[0-3]-[0-2]$/.test(id)):[];
 s.trails=Array.isArray(d.trails)?d.trails.filter(i=>Number.isInteger(i)&&i>=0&&i<TRAILS.length):[];
 s.trail=s.trails.includes(d.trail)?d.trail:-1;s.sound=d.sound!==false;
 respawn(s);return s;
}
export function respawn(s){
 const W=getWorld(s.world),safe=s.checkpoint>0?W.stages[s.checkpoint-1].safe:null;
 if(safe){const p=pathPoint(safe.s-3);s.x=p.x;s.z=p.z;s.y=safe.top;s.facing=Math.atan2(p.tx,p.tz);s.groundId=safe.id;}
 else{s.x=W.spawn.x;s.z=W.spawn.z;s.y=0;s.facing=Math.atan2(R-s.x,-s.z);s.groundId='lobby';}
 s.vx=s.vy=s.vz=0;s.grounded=true;s.lastGroundY=s.y;s.lastKey=s.groundId;s.chaser=null;s.vanish={};
}
export function toLobby(s){s.checkpoint=0;respawn(s);}
export function warpStage(s,cp){if(cp<0||cp>s.reached[s.world])return false;s.checkpoint=cp;respawn(s);return true;}
export function refreshUnlock(s){const lv=levelOf(s.speed);let got=false;while(s.unlocked<WORLDS.length-1&&lv>=WORLDS[s.unlocked+1].req){s.unlocked++;got=true;}return got;}
export function enterWorld(s,w){if(w<0||w>s.unlocked||w===s.world)return false;s.world=w;s.cool={};toLobby(s);return true;}
export function buyStat(s,key){const st=STATS[key],l=s.stats[key];if(!st||l>=st.max)return false;const c=st.cost(l);if(s.wins<c)return false;s.wins-=c;s.stats[key]=l+1;return true;}
export function buyTread(s,w,i){const tr=WORLDS[w]?.treads[i];if(!tr||w>s.unlocked||ownsTread(s,w,i)||s.wins<tr.cost)return false;s.wins-=tr.cost;s.treads.push(treadId(w,i));return true;}
export function buyTrail(s,i){const t=TRAILS[i];if(!t)return false;if(!s.trails.includes(i)){if(s.wins<t.cost)return false;s.wins-=t.cost;s.trails.push(i);}s.trail=i;return true;}
export const canRebirth=s=>s.rebirths<MAX_REBIRTH&&levelOf(s.speed)>=rebirthReq(s.rebirths);
export function rebirth(s){if(!canRebirth(s))return false;s.rebirths++;s.speed=0;toLobby(s);return true;}

function die(s,ev,why){s.deaths++;respawn(s);ev.push({t:'death',why});return ev;}
function addWins(s,n){s.wins+=n;s.totalWins+=n;}

export function step(s,input,dt){
 const ev=[],W=getWorld(s.world),lv=levelOf(s.speed),v=runSpeed(lv,s.stats.run);
 s.clock+=dt;
 // 움직이는 키 위에 서 있으면 함께 이동
 const ride=s.grounded&&W.byId.get(s.groundId);
 if(ride?.type==='mover'){const a=boxAt(ride,s.clock-dt),b=boxAt(ride,s.clock);s.x+=b.x-a.x;s.z+=b.z-a.z;s.y=b.top;}
 let ix=input.x||0,iz=input.z||0;const m=Math.hypot(ix,iz);if(m>1){ix/=m;iz/=m;}
 s.vx=ix*v;s.vz=iz*v;if(m>.1)s.facing=Math.atan2(ix,iz);
 if(input.jump&&s.grounded){s.vy=jumpVy(s.stats.jump);s.grounded=false;ev.push({t:'jump'});}
 s.vy=Math.max(-MAX_FALL,s.vy-GRAVITY*dt);
 const prevY=s.y;s.x+=s.vx*dt;s.z+=s.vz*dt;s.y+=s.vy*dt;
 let ground=null,gate=null;
 const rad=Math.hypot(s.x,s.z);
 if(s.vy<=0&&rad<LOBBY_R&&prevY>=-STEP&&s.y<=0){s.y=0;s.vy=0;ground=W.lobby;}
 if(rad<PILLAR_R+HW){const k=(PILLAR_R+HW)/(rad||1);s.x*=k;s.z*=k;}
 for(const o of W.solids){
  if(o.type==='wall'&&lv>=o.req)continue;
  const b=boxAt(o,s.clock);
  if(Math.abs(s.y-b.top)>12)continue;
  const dx=s.x-b.x,dz=s.z-b.z,lx=dx*o.ox+dz*o.oz,lz=dx*o.tx+dz*o.tz,px=o.w/2+HW-Math.abs(lx),pz=o.d/2+HW-Math.abs(lz);
  if(px<=0||pz<=0)continue;
  if(o.type==='blink'&&vanishPhase(s,o.id)==='gone')continue;
  const lift=o.axis==='y'?.5:0;
  if(s.vy<=0&&prevY>=b.top-STEP-lift&&s.y<=b.top){s.y=b.top;s.vy=0;ground=o;}
  else if(s.y<b.top-STEP&&s.y+HEIGHT>b.top-o.h){
   if(px<pz){const sg=lx<0?-1:1;s.x+=o.ox*px*sg;s.z+=o.oz*px*sg;}else{const sg=lz<0?-1:1;s.x+=o.tx*pz*sg;s.z+=o.tz*pz*sg;}
   if(o.type==='wall')gate=o;
  }
 }
 if(gate)ev.push({t:'gate',req:gate.req});
 s.grounded=!!ground;
 if(!ground){if(s.lastGroundY-s.y>FALL_LIMIT||s.y<-30)return die(s,ev,'fall');}
 else{
  s.groundId=ground.id;s.lastGroundY=s.y;const t=ground.type;
  if(t==='del')return die(s,ev,'del');
  if(ground.id!==s.lastKey){
   s.lastKey=ground.id;
   if(KEYLIKE.has(t)){const gain=keyGain(s,ground);s.speed+=gain;ev.push({t:'speed',gain,id:ground.id});}
   else if(t==='gold'&&(s.cool[ground.id]??-1e9)+GOLD_CD<=s.clock){s.cool[ground.id]=s.clock;const gain=Math.max(1,Math.round(winAmount(s,s.world,ground.stage)*.3));addWins(s,gain);ev.push({t:'gold',gain});}
  }
  if(t==='blink')s.vanish[ground.id]??=s.clock;
  else if(t==='safe'){
   if(ground.cp>s.checkpoint){s.checkpoint=ground.cp;s.reached[s.world]=Math.max(s.reached[s.world],ground.cp);ev.push({t:'checkpoint',cp:ground.cp});}
   if(ground.cp>=s.checkpoint)s.chaser=null;
   const b=ground.button,k=ground.stage;
   if(Math.hypot(s.x-b.x,s.z-b.z)<BUTTON_R&&buttonReady(s,s.world,k)){
    s.cool[`b${s.world}-${k}`]=s.clock;const gain=winAmount(s,s.world,k);addWins(s,gain);
    ev.push({t:'win',gain,stage:k,crown:k===W.stages.length-1});
   }
  }
  else if(t==='tread'){
   if(ownsTread(s,s.world,ground.index)){const gain=treadRate(s,W.def.treads[ground.index])*dt;s.speed+=gain;ev.push({t:'tread',gain,index:ground.index});}
   else ev.push({t:'locked',index:ground.index});
  }
 }
 // 빨간 회전 막대
 for(const o of W.spinners){
  if(s.y<o.top-.3||s.y>o.top+1)continue;
  const a=spinnerAngle(o,s.clock),ux=Math.cos(a),uz=Math.sin(a),dx=s.x-o.x,dz=s.z-o.z,along=Math.max(-o.len/2,Math.min(o.len/2,dx*ux+dz*uz));
  if(Math.hypot(dx-ux*along,dz-uz*along)<.2+HW)return die(s,ev,'spinner');
 }
 // 쫓아오는 ESC 괴물
 const st=W.stages[s.checkpoint];
 if(st?.chaser&&onPath(s)){
  const ps=pathS(s),inside=ps>st.start+3&&ps<st.end-12;
  if(!s.chaser&&inside){s.chaser={k:st.k,pos:st.start-16};ev.push({t:'chase'});}
  if(s.chaser){s.chaser.pos+=st.chaser*dt;if(inside&&s.chaser.pos>=ps-1.2)return die(s,ev,'chaser');}
 }
 const after=levelOf(s.speed);
 if(after>lv){ev.push({t:'level',level:after});if(refreshUnlock(s))ev.push({t:'unlock',world:s.unlocked});}
 return ev;
}
