// 인터넷으로 친구와 같은 계곡을 탐험한다.
// 방장(host)이 계곡 전체를 계산하고, 손님(guest)은 조작을 보내고 주변 풍경만 받아 그린다.
import { ValleyRoom,normaliseCode,safeMove } from './room.mjs';
import { ORES } from './core.mjs';
const SEND=.08;                 // 초당 12번 남짓 주고받는다
const VIEW=340;                 // 손님에게 보내 주는 광물 반경
const SNAP=6;                   // 예측 위치가 이만큼 어긋나면 바로 맞춘다
const num=v=>Number.isFinite(v)?v:0;
const round=v=>Math.round(v*10)/10;
export function setupOnline(ctx){
 const $=id=>document.getElementById(id);
 const {state,me,partner,ores,monsters,world}=ctx;
 let sendClock=0,sent=new Set(),guestOres=new Map(),backup=null,partnerMove={mx:0,mz:0,yaw:0},lastMove=0;
 const options=import.meta.env.DEV&&new URLSearchParams(location.search).has('localPeer')?{host:location.hostname,port:9002,path:'/mineral-valley',secure:false}:{};
 const room=new ValleyRoom({status,join,depart,message:receive},options);

 function status(state_,message=''){
  const label={offline:'각자 기기에서 같은 방 코드로 들어오세요.',connecting:'방에 연결하는 중…',waiting:`방 코드 ${room.code} · 친구를 기다리고 있어요 (1/2)`,connected:`방 코드 ${room.code} · 함께 탐험 중 (2/2)`,error:'연결을 확인하고 다시 시도해 주세요.'}[state_];
  $('room-status').textContent=message||label;
  $('room-code-display').textContent=room.code||'------';
  $('room-host').disabled=room.active;$('room-join').disabled=room.active;
  $('room-leave').hidden=!room.active;$('room-copy').hidden=!room.code;
  $('room-badge').hidden=!room.active;
  $('room-badge').textContent=room.active?`온라인 ${room.code} · ${room.ready?'2/2':'1/2'}`:'';
  if(message)ctx.toast(message);
  if(state_==='connected'){
   $('room-panel').hidden=true;
   // 손님은 자기 계곡을 비우고 방장이 보내 주는 풍경만 그린다.
   if(room.guest){guestOres.clear();ctx.clearField();}
   ctx.toast('친구와 연결됐어요! 같은 계곡에서 함께 캐 보세요.');
  }
 }
 // 손님이 들어오면 방장 쪽에서 친구 캐릭터를 캠프 옆에 세운다.
 function join(){
  partner.x=me.x+9;partner.z=me.z;partner.facing=me.facing;partner.carried=[];partner.nearest=null;partner.swing=0;
  partnerMove={mx:0,mz:0,yaw:0};lastMove=Date.now();sent=new Set();
  ctx.setPartnered(true);
 }
 function depart(){
  if(room.guest||backup){restoreOwn();}
  ctx.dropAll(partner);
  partner.nearest=null;
  ctx.setPartnered(false);
  sent=new Set();
 }
 // 손님은 자기 저장을 잠시 접어 두고 방장의 계곡을 본다. 나가면 원래 것으로 돌아온다.
 function keepOwn(){backup=JSON.parse(JSON.stringify(state));}
 function restoreOwn(){
  if(!backup)return;
  Object.assign(state,backup);backup=null;
  for(const o of guestOres.values())o.mesh?.dispose();
  guestOres.clear();ores.length=0;
  for(const m of monsters)m.mesh?.dispose();
  monsters.length=0;
  ctx.rebuild();
 }

 // ---- 방장이 보내는 한 장면 ----
 function snapshot(){
  const add=[],drop=[];
  const alive=new Set();
  for(const o of ores){
   if(Math.hypot(o.x-partner.x,o.z-partner.z)>VIEW||partner.carried.includes(o))continue;
   alive.add(o.uid);
   if(!sent.has(o.uid)){sent.add(o.uid);add.push([o.uid,o.id,o.weight,o.giant?1:0,round(o.x),round(o.z),round(o.turn)]);}
  }
  for(const uid of sent)if(!alive.has(uid)){sent.delete(uid);drop.push(uid);}
  return {
   type:'f',t:state.playSeconds,
   m:String(state.money),up:[state.strength,state.speed,state.cargo],found:state.found,
   me:{x:round(partner.x),z:round(partner.z),f:round(partner.facing),s:round(partner.swing),
       c:partner.carried.map(o=>[o.uid,o.id,o.weight,o.giant?1:0])},
   you:{x:round(me.x),z:round(me.z),f:round(me.facing),s:round(me.swing),c:me.carried.length},
   add,drop,
   mon:monsters.filter(o=>Math.hypot(o.x-partner.x,o.z-partner.z)<VIEW).slice(0,20).map(o=>[round(o.x),round(o.z),o.hp,round(o.facing)]),
   bal:ctx.balloon()?[round(ctx.balloon().x),round(ctx.balloon().z)]:null,
  };
 }

 // ---- 손님이 받은 장면을 그대로 반영 ----
 function apply(frame){
  if(!frame||typeof frame!=='object'||!frame.me||!frame.you)return;
  if(![frame.me.x,frame.me.z,frame.you.x,frame.you.z,frame.t].every(Number.isFinite))return;
  state.playSeconds=Math.max(0,frame.t);
  if(typeof frame.m==='string'&&/^-?\d{1,200}$/.test(frame.m))state.money=Math.abs(Number(frame.m))<=Number.MAX_SAFE_INTEGER?Number(frame.m):frame.m;
  if(Array.isArray(frame.up)){[state.strength,state.speed,state.cargo]=frame.up.map(n=>Math.max(0,n|0));}
  if(Array.isArray(frame.found)&&frame.found.length===ORES.length)state.found=frame.found.map(n=>Math.max(0,n|0));
  // 내 캐릭터: 크게 어긋날 때만 방장 위치로 맞춘다 (평소에는 내 조작이 바로 반응한다)
  if(Math.hypot(me.x-frame.me.x,me.z-frame.me.z)>SNAP){me.x=frame.me.x;me.z=frame.me.z;}
  me.swing=num(frame.me.s);
  partner.x=frame.you.x;partner.z=frame.you.z;partner.facing=num(frame.you.f);partner.moving=true;
  // 광물 더하기 / 빼기
  for(const uid of frame.drop||[]){const o=guestOres.get(uid);if(!o)continue;o.mesh?.dispose();guestOres.delete(uid);const i=ores.indexOf(o);if(i>=0)ores.splice(i,1);}
  for(const row of frame.add||[]){
   if(!Array.isArray(row)||row.length<7)continue;
   const [uid,id,weight,giant,x,z,turn]=row;
   if(guestOres.has(uid)||!ORES[id]||!Number.isFinite(weight)||!Number.isFinite(x)||!Number.isFinite(z))continue;
   const o={uid,id,weight,giant:giant===1,x,z,turn:num(turn),mesh:null,eventOre:false};
   guestOres.set(uid,o);ores.push(o);
  }
  // 내가 들고 있는 광물
  const want=new Map((frame.me.c||[]).map(row=>[row[0],row]));
  for(const o of [...me.carried])if(!want.has(o.uid)){o.mesh?.dispose();me.carried.splice(me.carried.indexOf(o),1);}
  for(const [uid,row] of want){
   if(me.carried.some(o=>o.uid===uid))continue;
   const existing=guestOres.get(uid);
   if(existing){const i=ores.indexOf(existing);if(i>=0)ores.splice(i,1);guestOres.delete(uid);me.carried.push(existing);existing.mesh??=world.addOre(existing);continue;}
   const o={uid,id:row[1],giant:row[3]===1,weight:row[2],x:me.x,z:me.z,turn:0,mesh:null};
   if(!ORES[o.id]||!Number.isFinite(o.weight))continue;
   o.mesh=world.addOre(o);me.carried.push(o);
  }
  // 몬스터
  const rows=Array.isArray(frame.mon)?frame.mon:[];
  while(monsters.length>rows.length){const m=monsters.pop();m.mesh?.dispose();}
  rows.forEach((row,i)=>{
   const m=monsters[i]||(monsters[i]={x:0,z:0,hp:1,facing:0,cool:0,flash:0,mesh:null});
   m.x=num(row[0]);m.z=num(row[1]);m.hp=row[2]|0;m.facing=num(row[3]);
   m.mesh??=world.addMonster();
   m.mesh.position.set(m.x,0,m.z);m.mesh.rotation.y=m.facing;
  });
  ctx.setBalloon(Array.isArray(frame.bal)&&frame.bal.length===2?{x:num(frame.bal[0]),z:num(frame.bal[1])}:null);
  ctx.refresh();
 }

 function receive(message){
  if(room.host){
   if(message.type==='i'){partnerMove=safeMove(message);lastMove=Date.now();}
   else if(message.type==='a')perform(message.kind,message.value);
  }else if(room.guest){
   if(message.type==='f')apply(message);
   else if(message.type==='n'&&typeof message.text==='string')ctx.toast(message.text.slice(0,180));
  }
 }
 function perform(kind,value){
  if(kind==='lift')ctx.act.lift(partner);
  else if(kind==='drop')ctx.act.drop(partner,Number.isInteger(value)?value:partner.carried.length-1);
  else if(kind==='sell')ctx.act.sale(partner);
  else if(kind==='home')ctx.act.home(partner);
  else if(kind==='swing')ctx.act.swing(partner);
  else if(kind==='buy'&&typeof value==='string')ctx.act.buy(value);
  else if(kind==='code'&&typeof value==='string')ctx.act.redeem(value.slice(0,40));
 }
 // 손님이 보낸 행동의 결과를 짧은 문구로 알려 준다.
 function notify(text){if(room.host&&room.ready)room.send({type:'n',text});}

 function tick(dt){
  if(!room.active||!room.ready)return;
  if(room.host){
   // 1.5초 넘게 조작이 안 오면 친구를 멈춰 세운다
   const fresh=Date.now()-lastMove<1500;
   ctx.applyMove(partner,fresh?partnerMove:{mx:0,mz:0},dt);
  }
  sendClock+=dt;
  if(sendClock<SEND)return;
  sendClock=0;
  if(room.host)room.send(snapshot());
  else{const axis=ctx.moveAxis();room.send({type:'i',mx:axis.x,mz:axis.z,yaw:ctx.yaw()});}
 }

 function openPanel(){ctx.clearInput();$('room-panel').hidden=false;$('room-code-input').focus();}
 $('multiplayer').onclick=openPanel;$('room-badge').onclick=openPanel;
 $('room-close').onclick=()=>$('room-panel').hidden=true;
 $('room-host').onclick=()=>connect();
 $('room-form').onsubmit=e=>{e.preventDefault();connect($('room-code-input').value);};
 $('room-leave').onclick=()=>{room.leave();ctx.toast('방에서 나왔어요. 혼자서 계속 탐험할 수 있어요.');};
 $('room-copy').onclick=async()=>{try{await navigator.clipboard.writeText(room.code);ctx.toast('방 코드를 복사했어요. 친구에게 알려 주세요!');}catch{ctx.toast(`친구에게 방 코드 ${room.code}를 알려 주세요.`);}};
 $('room-code-input').oninput=e=>e.target.value=normaliseCode(e.target.value);
 async function connect(code){
  if(code)keepOwn();
  try{await room.open(code);}catch{if(code)restoreOwn();}
 }
 addEventListener('pagehide',()=>room.leave());
 return {
  tick,notify,
  get active(){return room.active&&room.ready;},
  get host(){return room.host&&room.ready;},
  get guest(){return room.guest&&room.ready;},
  get partnered(){return room.ready;},
  get blocked(){return !$('room-panel').hidden;},
  act(kind,value){if(room.guest&&room.ready){room.send({type:'a',kind,value});return true;}return false;},
  state:()=>({role:room.role,code:room.code,status:room.status,count:room.active?(room.ready?2:1):0}),
  leave:()=>room.leave(),
 };
}
