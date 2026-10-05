// 키캡 타워 — 렌더링과 분리된 타워 데이터, 물리, 성장 계산.
export const GRAVITY=32,JUMP_VY=12.5,MAX_FALL=45,HW=.4,HEIGHT=1.8,STEP=.6,FALL_LIMIT=9;
// 타워는 기둥을 감고 올라가는 나선 길이다. s는 길을 따라 잰 거리, lat은 바깥쪽으로 벗어난 거리.
export const R=30,PITCH=16,TURN=2*Math.PI*R,SLOPE=PITCH/TURN,BASE=.6,LOBBY_R=52,PILLAR_R=15;
export const AIR=2*JUMP_VY/GRAVITY;
export const VANISH_DELAY=.8,VANISH_BACK=3,BUTTON_R=2.1,BUTTON_CD=30,GOLD_CD=25,TREAD_STEPS=3,MAX_REBIRTH=200,EVENT_EVERY=3600,EVENT_LENGTH=600,EVENT_BOOST=2;
// 이스터 에그: 2월드 기둥 뒤쪽에 숨은 알. 닿으면 트로피를 딱 1000 준다.
export const EGG={world:1,angle:1.2,r:1.7,gain:1000,cd:60};
const KEYLIKE=new Set(['key','mover','blink']);
const LETTERS='QWERTYUIOPASDFGHJKLZXCVBNM1234567890';

function rng(seed){return ()=>(seed=(seed*16807)%2147483647)/2147483647;}
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
// 5월드부터 50월드까지는 규칙으로 만든다. 월드가 올라갈수록 스테이지가 늘어 타워가 더 높아진다.
const WORLD_GAP=3000,BIG_WORLD=29,BIG_GAP=1e6,BIG_FROM=5000+(BIG_WORLD-4)*WORLD_GAP;
const MORE=[['얼음','🧊',195],['정글','🌴',130],['사막','🏜️',40],['바다','🌊',210],['구름','☁️',200],['과자','🍪',30],['로봇','🤖',220],['유령','👻',270],['무지개','🌈',320],['황금','🥇',48],
 ['수정','🔮',285],['번개','⚡',55],['꿈','💤',250],['장난감','🧸',15],['해적','🏴‍☠️',5],['공룡','🦖',110],['닌자','🥷',240],['마법','🪄',300],['눈꽃','❄️',185],['폭풍','🌪️',225],
 ['버섯','🍄',0],['꿀벌','🐝',50],['젤리','🍮',335],['레이저','🔦',350],['달빛','🌙',235],['태양','☀️',35],['심해','🐙',205],['화석','🦴',28],['다이아','💎',180],['픽셀','👾',140],
 ['음악','🎵',290],['팝콘','🍿',45],['초코민트','🍫',165],['솜사탕','🍭',325],['블랙홀','🕳️',265],['시간','⏰',20],['거울','🪞',190],['용','🐉',120],['불사조','🔥',12],['천둥','🌩️',230],
 ['오로라','🌠',160],['크리스탈','🧿',215],['혜성','☄️',25],['은하수','✨',255],['우주 끝','🚀',275],['전설의 키캡','👑',45]];
const MIDDLE=['징검다리','흔들 다리','함정 길','깜빡 길','회전 구간','엘리베이터','추격 구간','미로','질주','절벽'];
const KINDS=['zig:4','mover:4','lift:3','blink:5','del:4','spin','plain:3'];
function hsl(h,s,l){h=((h%360)+360)%360;s/=100;l/=100;const a=s*Math.min(l,1-l),f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');};return `#${f(0)}${f(8)}${f(4)}`;}
MORE.forEach(([nm,emoji,h],j)=>{
 const i=j+4,n=Math.min(12,7+Math.floor(j/6)),big=i>=BIG_WORLD,req=big?BIG_FROM+(i-BIG_WORLD)*BIG_GAP:5000+j*WORLD_GAP,rnd=rng(500+i*37),dark=i%3!==0,base=5e4*11**(i-3),win=5e12*10**j;
 WORLDS.push({name:`${nm} 타워`,emoji,req,keyMult:base,
  levels:Array.from({length:n},(_,k)=>req+Math.round(k*(big?BIG_GAP:WORLD_GAP)*.85/(n-1))),
  names:Array.from({length:n},(_,k)=>k===0?`${nm} 입구`:k===n-1?`${nm} 왕관`:`${nm} ${MIDDLE[(k-1+j)%MIDDLE.length]}`),
  segs:Array.from({length:n},(_,k)=>['plain:3',...Array.from({length:2+(k>n/2?1:0)+(k===n-1?1:0)},()=>KINDS[Math.floor(rnd()*KINDS.length)])]),
  chasers:Array.from({length:n},(_,k)=>k).filter(k=>k%3===2||k===n-1),
  wins:Array.from({length:n},(_,k)=>Math.round(win*1.2**k)),
  treads:[{name:`${nm} 러닝머신`,mult:base,cost:0},{name:`슈퍼 ${nm} 러닝머신`,mult:base*2.5,cost:win*40},{name:`울트라 ${nm} 러닝머신`,mult:base*6,cost:win*400}],
  theme:{sky:dark?hsl(h,50,9):hsl(h,75,84),fog:dark?hsl(h,50,16):hsl(h,75,91),floor:dark?hsl(h,30,18):hsl(h+20,70,88),keys:[hsl(h,75,58),hsl(h+35,75,66),hsl(h+180,65,62),dark?'#f1f3f5':'#495057'],safe:dark?hsl(h,35,30):hsl(h+20,80,94),accent:hsl(h+60,95,62),pillar:dark?hsl(h,45,7):hsl(h,35,32),dark}});
});
export const STATS={
 power:{name:'발걸음 힘',icon:'💪',max:400,cost:l=>Math.ceil(3*1.6**l),value:l=>Math.ceil(1.35**l),show:v=>`+${fmt(v)}`,desc:'키캡을 밟을 때 얻는 스피드'},
 wins:{name:'트로피 배수',icon:'🏆',max:150,cost:l=>Math.ceil(25*2.4**l),value:l=>1.5**l,show:v=>`×${fmt(v)}`,desc:'노란 버튼에서 받는 트로피'},
 tread:{name:'러닝머신 효율',icon:'🏃',max:200,cost:l=>Math.ceil(15*2**l),value:l=>1+.25*l,show:v=>`×${v.toFixed(2)}`,desc:'러닝머신에서 얻는 스피드'},
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
// 아이템 상점: 사 두면 얻는 스피드에 배수가 붙는다.
export const ITEMS=[
 {id:'chocolate',rarity:'일반',name:'초콜릿',mult:1.5,cost:3e3,price:'3.0K트로피'},
 {id:'keycap',rarity:'에픽',name:'키캡',mult:3,cost:1e5,price:'100K트로피'},
 {id:'bigkeycap',rarity:'비밀',name:'큰 키캡',mult:10,cost:1e6,price:'1.0M트로피'},
];
export const SKINS=[
 {name:'기본',cost:0,hoodie:'#4263eb',pants:'#343a40',hair:'#5c3d2e',skin:'#ffd8b1'},
 {name:'초콜릿',cost:100,hoodie:'#8d5a3b',pants:'#4a2c1a',hair:'#2b1a10',skin:'#ffd8b1'},
 {name:'딸기 우유',cost:2e3,hoodie:'#ff8fab',pants:'#fff0f6',hair:'#f783ac',skin:'#ffe3d3'},
 {name:'네온 게이머',cost:5e4,hoodie:'#22d3ee',pants:'#1e1b4b',hair:'#a855f7',skin:'#ffd8b1'},
 {name:'닌자',cost:1e6,hoodie:'#212529',pants:'#212529',hair:'#c92a2a',skin:'#e9c9a6'},
 {name:'로봇',cost:5e7,hoodie:'#adb5bd',pants:'#495057',hair:'#fa5252',skin:'#dee2e6'},
 {name:'용암',cost:5e9,hoodie:'#ff6b35',pants:'#3a2420',hair:'#ffd43b',skin:'#ffb38a'},
 {name:'황금 키캡',cost:5e12,hoodie:'#fcc419',pants:'#e67700',hair:'#fff3bf',skin:'#ffe8a1'},
];

// 숫자
const UNITS=[[1e68,'무량대수'],[1e64,'불가사의'],[1e60,'나유타'],[1e56,'아승기'],[1e52,'항하사'],[1e48,'극'],[1e44,'재'],[1e40,'정'],[1e36,'간'],[1e32,'구'],[1e28,'양'],[1e24,'자'],[1e20,'해'],[1e16,'경'],[1e12,'조'],[1e8,'억'],[1e4,'만']];
export function fmt(n){
 n=Number(n)||0;if(n<1e4)return Number.isInteger(n)?n.toLocaleString('en-US'):(+n.toFixed(n<10?2:1)).toLocaleString('en-US');
 for(const [u,name] of UNITS)if(n>=u){const v=n/u;return `${v>=100?Math.floor(v).toLocaleString('en-US'):+v.toFixed(v>=10?1:2)}${name}`;}
 return String(n);
}
// 레벨 2000까지는 가파르게, 그 뒤로는 월드 하나(레벨 3000)에 약 11배씩, 30월드(레벨 8만)부터는 월드 하나(레벨 100만)에 11배씩 늘어난다.
const CURVE_END=2000,curve=L=>5*L**1.6*1.012**L,mid=L=>curve(CURVE_END)*1.0008**(L-CURVE_END);
export const needSpeed=L=>L<=0?0:Math.round(L<=CURVE_END?curve(L):L<=BIG_FROM?mid(L):mid(BIG_FROM)*11**((L-BIG_FROM)/BIG_GAP));
export function levelOf(speed){let lo=0,hi=4e7;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(needSpeed(mid)<=speed)lo=mid;else hi=mid-1;}return lo;}
export const runSpeed=(level,run=0)=>(8+16*(1-Math.exp(-level/150)))*STATS.run.value(run);
export const jumpVy=(jump=0)=>JUMP_VY*STATS.jump.value(jump);
export const rebirthMult=r=>2**r;
export const rebirthReq=r=>50*(r+1);
export const trailMult=s=>s.trail>=0?TRAILS[s.trail].mult:1;
export const itemMult=s=>ITEMS.reduce((m,it)=>s.items.includes(it.id)?m*it.mult:m,1);
export const globalMult=s=>rebirthMult(s.rebirths)*trailMult(s)*itemMult(s);
export const stepPower=s=>STATS.power.value(s.stats.power);
export const keyGain=(s,o)=>stepPower(s)*WORLDS[s.world].keyMult*(o.stage+1)*globalMult(s);
export const treadRate=(s,tr)=>TREAD_STEPS*stepPower(s)*tr.mult*STATS.tread.value(s.stats.tread)*globalMult(s);
export const winAmount=(s,w,k)=>Math.round(WORLDS[w].wins[k]*STATS.wins.value(s.stats.wins)*(s.winBoost||1));
// 1시간마다 10분 동안 트로피 2배 이벤트 (now는 초)
export function eventInfo(now){const t=((now%EVENT_EVERY)+EVENT_EVERY)%EVENT_EVERY,active=t<EVENT_LENGTH;return {active,boost:active?EVENT_BOOST:1,remain:active?EVENT_LENGTH-t:EVENT_EVERY-t};}
export const treadId=(w,i)=>`${w}-${i}`;
export const ownsTread=(s,w,i)=>WORLDS[w].treads[i].cost===0||s.treads.includes(treadId(w,i));

// 나선 길 위의 한 점
export function pathPoint(sv,lat=0){const th=sv/R,ox=Math.cos(th),oz=Math.sin(th),r=R+lat;return {x:r*ox,z:r*oz,y:BASE+sv*SLOPE,ox,oz,tx:-oz,tz:ox};}
function place(o){const p=pathPoint(o.s,o.lat||0);o.x=p.x;o.z=p.z;o.ox=p.ox;o.oz=p.oz;o.tx=p.tx;o.tz=p.tz;return o;}

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
 const zones=[['stat',-1.25],['item',-1.62],['world',-2],['rebirth',2.2]].map(([id,th])=>({id,r:3.4,...place({s:th*R,lat:14})}));
 const spawn=place({s:-.5*R,lat:11});
 const solids=objects.filter(o=>o.type!=='spinner');
 const egg=w===EGG.world?{x:Math.cos(EGG.angle)*PILLAR_R,z:Math.sin(EGG.angle)*PILLAR_R}:null;
 return {index:w,def,egg,objects,solids,stages,spinners,zones,spawn,lobby:{id:'lobby',type:'lobby',top:0},byId:new Map(objects.map(o=>[o.id,o])),top:BASE+cur*SLOPE,length:cur};
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
 const s={version:1,world:0,checkpoint:0,speed:0,wins:0,totalWins:0,rebirths:0,stats:{power:0,wins:0,tread:0,run:0,jump:0},treads:[],trails:[],trail:-1,items:[],skins:[0],skin:0,unlocked:0,reached:WORLDS.map(()=>0),deaths:0,eggs:0,sound:true,music:true,winBoost:1,
  x:0,y:0,z:0,vx:0,vy:0,vz:0,facing:0,grounded:true,groundId:'lobby',lastKey:null,lastGroundY:0,clock:0,vanish:{},cool:{},chaser:null};
 respawn(s);return s;
}
const SAVED=['version','world','checkpoint','speed','wins','totalWins','rebirths','stats','treads','trails','trail','items','skins','skin','unlocked','reached','deaths','eggs','sound','music'];
export function serialize(s){const o={};for(const k of SAVED)o[k]=s[k];return o;}
export function restore(raw){
 const s=fresh();let d;try{d=typeof raw==='string'?JSON.parse(raw):raw;}catch{d=null;}
 if(!d||d.version!==1)return s;
 const num=(v,min,max,dflt=min)=>Number.isFinite(v)?Math.min(max,Math.max(min,v)):dflt,int=(v,min,max)=>Math.floor(num(v,min,max));
 s.speed=num(d.speed,0,1e300);s.wins=num(d.wins,0,1e300);s.totalWins=num(d.totalWins,0,1e300);s.rebirths=int(d.rebirths,0,MAX_REBIRTH);s.deaths=int(d.deaths,0,1e9);s.eggs=int(d.eggs,0,1e9);
 for(const k of Object.keys(STATS))s.stats[k]=int(d.stats?.[k],0,STATS[k].max);
 s.unlocked=int(d.unlocked,0,WORLDS.length-1);s.world=int(d.world,0,s.unlocked);
 s.reached=WORLDS.map((W,i)=>int(d.reached?.[i],0,W.levels.length));s.checkpoint=int(d.checkpoint,0,s.reached[s.world]);
 s.treads=Array.isArray(d.treads)?d.treads.filter(id=>typeof id==='string'&&/^\d{1,2}-[0-2]$/.test(id)&&parseInt(id,10)<WORLDS.length):[];
 s.trails=Array.isArray(d.trails)?d.trails.filter(i=>Number.isInteger(i)&&i>=0&&i<TRAILS.length):[];
 s.trail=s.trails.includes(d.trail)?d.trail:-1;
 s.items=Array.isArray(d.items)?ITEMS.map(it=>it.id).filter(id=>d.items.includes(id)):[];
 s.skins=[0,...(Array.isArray(d.skins)?d.skins.filter(i=>Number.isInteger(i)&&i>0&&i<SKINS.length):[])];s.skin=s.skins.includes(d.skin)?d.skin:0;s.sound=d.sound!==false;s.music=d.music!==false;
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
export function buyItem(s,id){const it=ITEMS.find(x=>x.id===id);if(!it||s.items.includes(id)||s.wins<it.cost)return false;s.wins-=it.cost;s.items.push(id);return true;}
export function buySkin(s,i){const k=SKINS[i];if(!k)return false;if(!s.skins.includes(i)){if(s.wins<k.cost)return false;s.wins-=k.cost;s.skins.push(i);}s.skin=i;return true;}
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
  if(t==='lobby'&&W.egg&&Math.hypot(s.x-W.egg.x,s.z-W.egg.z)<EGG.r&&(s.cool.egg??-1e9)+EGG.cd<=s.clock){s.cool.egg=s.clock;s.eggs++;addWins(s,EGG.gain);ev.push({t:'egg',gain:EGG.gain});}
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
