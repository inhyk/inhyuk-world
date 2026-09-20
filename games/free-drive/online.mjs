import {DriveRoom,normaliseCode,safeInput} from './room.mjs';
import {CARS,cleanSave,buy,claimDaily,claimTime,discover,nearestRoad} from './core.mjs';
import {Journey} from './journey.mjs';
import {Enforcement} from './police.mjs';
const idle={gas:false,brake:true,steer:0};
const $=selector=>document.querySelector(selector);
const day=()=>{const d=new Date();return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;};
const pose=p=>({x:p.x,z:p.z,yaw:p.yaw,speed:p.speed,gear:p.gear});
export function setupOnline(ctx){
 const {journey,world,node,box,cyl,makeCar,makeTreasure,makeCuffs,camera,material,toast,persist}=ctx;
 let partner=null,partnerSave=null,partnerLaw=null,partnerInput=idle,partnerPlaying=false,lastInput=0,sendClock=0,elapsed=0,guestJail=0,lastSave=0,connectedOnce=false;
 const initialVehicleIds=new Set(journey.vehicles.map(v=>v.id));
 let remotePawn=null;const friendMarker=cyl('friend marker',0,3,0,.32,.7,'#83ceff',world,0);friendMarker.setEnabled(false);
 const options=import.meta.env.DEV&&new URLSearchParams(location.search).has('localPeer')?{host:location.hostname,port:9001,path:'/free-drive',secure:false}:{};
 const room=new DriveRoom({save:()=>ctx.save(),status:updateStatus,join:joinGuest,depart:depart,message:receive},options);
 function updateStatus(status,message=''){
  $('#room-status').textContent=message||({offline:'각자 기기에서 같은 방 코드로 들어오세요.',connecting:'방에 연결하는 중…',waiting:`방 코드 ${room.code} · 친구를 기다리고 있어요 (1/2)`,connected:`방 코드 ${room.code} · 함께 플레이 중 (2/2)`,error:'연결을 확인하고 다시 시도해 주세요.'}[status]);
  $('#room-code-display').textContent=room.code;$('#room-host').disabled=room.active;$('#room-join').disabled=room.active;$('#room-leave').hidden=!room.active;$('#room-copy').hidden=!room.code;$('#room-badge').hidden=!room.active;
  $('#room-badge').textContent=room.active?`${room.code} · ${room.ready?'2/2':'1/2'} · 방 메뉴`:'';
  if(message)toast(message);
  if(status==='connected'){connectedOnce=true;ctx.closeModal();$('#room-panel').hidden=true;ctx.start();toast('친구와 연결됐어요! 같은 도로에서 함께 달려 보세요.');}
 }
 function joinGuest(raw){
  partnerSave=cleanSave(raw);partnerSave.wanted=false;partnerSave.jailUntil=0;
  const p={x:nearestRoad(journey.p.x)+3,z:journey.p.z-10,yaw:0,speed:0,gear:'D'};
  partner=new Journey({p,world,central:journey.central,solids:journey.baseSolids,makeCar,node,box,cyl,camera,selected:partnerSave.selected,makeTreasure,makeCuffs,shared:journey,conditions:partnerSave.durability,onDamage:health=>tell(health===0?'내구도 0! 수리하거나 다른 차에 타세요.':`사고! 내구도 ${health}/100`)});
  partner.own.durability=partnerSave.durability[partnerSave.selected]??100;
  partnerLaw=new Enforcement({save:partnerSave,persist:()=>{},toast:tell,journey:partner,world,node,box,cyl,makeCar,material});partnerPlaying=true;lastInput=Date.now();
 }
 function tell(message){room.send({type:'notice',text:message});}
 function clearPartner(){
  if(partner){if(partner.occupied&&partner.occupied!==partner.own){partner.occupied.auto=false;partner.occupied.speed=0;}const index=journey.vehicles.indexOf(partner.own);if(index>=0)journey.vehicles.splice(index,1);partner.own.mesh.dispose();partner.own.cuffMesh?.dispose();partner.pawn.dispose();journey.actors=journey.actors.filter(a=>a!==partner);}
  if(partnerLaw){partnerLaw.car.dispose();partnerLaw.officer.dispose();for(const s of partnerLaw.signals.values())s.root.dispose();}
  partner=null;partnerLaw=null;partnerSave=null;partnerInput=idle;partnerPlaying=false;
 }
 function depart(){
  clearPartner();friendMarker.setEnabled(false);remotePawn?.dispose();remotePawn=null;
  if(connectedOnce&&!journey.actors.includes(journey))journey.actors=[journey];
  // Restore this browser's own vehicle IDs after leaving a guest session.
  if(connectedOnce&&journey.own.id==='guest-own'){
   for(const v of [...journey.vehicles])if(!initialVehicleIds.has(v.id)){v.mesh.dispose();v.cuffMesh?.dispose();journey.vehicles.splice(journey.vehicles.indexOf(v),1);}
   journey.own=journey.vehicles.find(v=>v.id==='own');journey.occupied=journey.own;journey.conditions=ctx.save().durability;journey.actors=[journey];journey.reset(ctx.save().selected);ctx.syncCar();
  }
  for(const v of journey.vehicles)delete v.networkReserved;
  connectedOnce=false;guestJail=0;api.other=null;persist();
 }
 function action(kind,value){if(room.guest){room.send({type:'action',kind,value});return true;}return false;}
 function receive(message){
  if(room.host){
   if(!partner)return;
   if(message.type==='input'){partnerInput=safeInput(message.input);partnerPlaying=message.playing===true;lastInput=Date.now();}
   if(message.type==='action')perform(message.kind,message.value);
  }else if(room.guest){
   if(message.type==='notice'&&typeof message.text==='string')toast(message.text.slice(0,160));
   if(message.type==='frame')applyFrame(message);
  }
 }
 function perform(kind,value){
  if(kind==='unlock'){partnerLaw.unlock(String(value));return;}
  if(partnerLaw.jailed)return;
  if(kind==='interact')tell(partner.interact());
  else if(kind==='repair')tell(partner.repair(partnerSave));
  else if(kind==='cuff')tell(partner.handcuff());
  else if(kind==='gear'&&['D','N','P','R'].includes(value)&&!partner.walking){if(Math.abs(partner.p.speed)<=1)partner.p.gear=value;else tell('차를 멈춘 뒤 기어를 바꿔 주세요.');}
  else if(kind==='place'&&!partnerSave.wanted){partnerLaw.trail=[];partnerLaw.schoolSpeeding=0;if(partner.travel(value,partnerSave.selected))tell('선택한 장소에 도착했어요!');}
  else if(kind==='reset'&&!partnerSave.wanted){partnerLaw.trail=[];partner.reset(partnerSave.selected);}
  else if(kind==='buy'&&!partnerSave.wanted&&typeof value==='string'&&buy(partnerSave,value)){partner.select(value);tell('자동차가 준비됐어요!');}
  else if(kind==='daily'){if(claimDaily(partnerSave,day()))tell('오늘의 선물 +100 코인');}
  else if(kind==='time'){if(claimTime(partnerSave))tell('플레이 보상 +60 코인');}
 }
 function applyFrame(frame){
  if(!frame.self||!Array.isArray(frame.vehicles)||frame.vehicles.length>40||!frame.origin||!frame.other)return;
  if(!/^-?\d{1,100}$/.test(frame.origin.x)||!/^-?\d{1,100}$/.test(frame.origin.z))return;
  const source=frame.self.p;if(!source||![source.x,source.z,source.yaw,source.speed,frame.seconds].every(Number.isFinite))return;
  const previousSelected=ctx.save().selected;const previousShop=JSON.stringify([ctx.save().selected,ctx.save().coins,ctx.save().owned,ctx.save().daily,ctx.save().claimed]);
  Object.assign(ctx.save(),cleanSave(frame.save));journey.conditions=ctx.save().durability;
  guestJail=Math.max(0,Math.min(60,frame.self.jail||0));ctx.save().jailUntil=guestJail?Date.now()+guestJail*1000:0;
  if(Array.isArray(frame.coins))ctx.coins.forEach((c,i)=>c.mesh.setEnabled(frame.coins[i]===true));ctx.clock(frame.seconds);
  const ox=BigInt(frame.origin.x),oz=BigInt(frame.origin.z);
  if(journey.stream.origin.x!==ox||journey.stream.origin.z!==oz){for(const c of journey.stream.chunks.values())c.root.dispose();journey.stream.chunks.clear();journey.stream.origin={x:ox,z:oz};journey.stream.center='';camera.position.set(source.x+10,8,source.z-13);}
  for(const data of frame.vehicles){
   if(typeof data.id!=='string'||!CARS.some(c=>c.id===data.model)||![data.x,data.z,data.yaw,data.speed,data.durability].every(Number.isFinite))continue;
   let v=journey.vehicles.find(v=>v.id===data.id);
   if(!v)v=journey.create(data.id,data.model,data.x,data.z,data.yaw,false);
   if(v.model!==data.model){v.mesh.dispose();v.cuffMesh?.dispose();v.cuffMesh=null;v.mesh=makeCar(CARS.find(c=>c.id===data.model));v.mesh.parent=world;}
   for(const key of ['model','x','z','yaw','speed','auto','durability','cuffed'])v[key]=data[key];
   v.networkReserved=data.id===frame.other.vehicle||data.id==='own';
   if(v.cuffed&&!v.cuffMesh)v.cuffMesh=makeCuffs(v.mesh);
  }
  journey.own=journey.vehicles.find(v=>v.id==='guest-own');if(!journey.own)return;
  journey.occupied=journey.vehicles.find(v=>v.id===frame.self.vehicle)||null;
  Object.assign(journey.p,source);journey.refresh();journey.render(frame.seconds);
  if(!remotePawn){remotePawn=node('friend walking');remotePawn.parent=world;box('friend jacket',0,1.05,0,.65,.65,.4,'#8ecbfa',remotePawn);cyl('friend head',0,1.65,0,.24,.43,'#e5b58d',remotePawn);for(const x of [-.19,.19])box('friend leg',x,.45,0,.23,.65,.26,'#38566a',remotePawn);}
  remotePawn.setEnabled(!frame.other.vehicle&&frame.other.jail===0);remotePawn.position.set(frame.other.p.x,.13,frame.other.p.z);remotePawn.rotation.y=frame.other.p.yaw;
  ctx.showPolice(frame.self.police,!!frame.self.vehicle,frame.seconds);
  ctx.wallet();if(previousSelected!==ctx.save().selected)ctx.syncCar();if(previousShop!==JSON.stringify([ctx.save().selected,ctx.save().coins,ctx.save().owned,ctx.save().daily,ctx.save().claimed]))ctx.refreshModal();
  if(Date.now()-lastSave>2000){persist();lastSave=Date.now();}
  api.other=frame.other;friendMarker.setEnabled(frame.other.jail===0);friendMarker.position.set(frame.other.p.x,3.3,frame.other.p.z);
  if(!partnerLaw)partnerLaw=new Enforcement({save:cleanSave(),persist:()=>{},toast:()=>{},journey,world,node,box,cyl,makeCar,material});
  const otherCop=frame.other.police;partnerLaw.car.setEnabled(!!otherCop&&!!frame.other.vehicle);partnerLaw.officer.setEnabled(!!otherCop&&!frame.other.vehicle);if(otherCop)for(const m of [partnerLaw.car,partnerLaw.officer]){m.position.set(otherCop.x,.13,otherCop.z);m.rotation.y=otherCop.yaw;}
 }
 function frame(){
  const actor=(j,law)=>({p:pose(j.p),vehicle:j.occupied?.id||null,jail:law.jailed?law.state().jailRemaining:0,police:law.state().police});
  return {type:'frame',seconds:ctx.clock(),origin:{x:journey.stream.origin.x.toString(),z:journey.stream.origin.z.toString()},vehicles:journey.state().traffic,self:actor(partner,partnerLaw),other:actor(journey,ctx.law),save:partnerSave,coins:ctx.coins.map(c=>ctx.wallClock()>=c.ready)};
 }
 // Networking and the guest simulation must keep ticking when the host renders slowly.
 function tick(dt,input,playing){
  if(!room.active)return;
  sendClock+=dt;
  if(room.host)ctx.clock(ctx.clock()+dt);
  if(room.host&&partner){
   if(!playing)journey.updateTraffic(dt,ctx.clock());
   for(const c of ctx.coins)if(ctx.wallClock()>=c.ready)c.mesh.setEnabled(true);
   const remaining=partnerLaw.tick();
   if(!remaining&&partnerPlaying){
    const before={x:partner.p.x,z:partner.p.z},driving=!partner.walking;
    partnerSave.distance+=partner.update(dt,Date.now()-lastInput<1200?partnerInput:idle,ctx.clock());partnerLaw.step(dt,ctx.clock(),before,driving);
    elapsed+=dt;if(elapsed>=1){const n=Math.floor(elapsed);partnerSave.seconds+=n;elapsed-=n;}
    for(const c of ctx.coins)if(ctx.wallClock()>=c.ready&&Math.hypot(c.x+journey.central.position.x-partner.p.x,c.z+journey.central.position.z-partner.p.z)<2){partnerSave.coins+=5;c.ready=ctx.wallClock()+45;c.mesh.setEnabled(false);tell('+5 코인');}
    for(const h of ctx.treasures())if(Math.hypot(h.x-partner.p.x,h.z-partner.p.z)<5&&discover(partnerSave,h.id))tell(`히든 차 발견! ${CARS.find(c=>c.id===h.id).name}`);
   }else{partner.p.speed=0;if(partner.occupied)partner.occupied.speed=0;}
   partner.render(ctx.clock());partner.pawn.setEnabled(partner.walking&&!remaining);api.other={p:pose(partner.p),vehicle:partner.occupied?.id||null,jail:remaining};friendMarker.setEnabled(!remaining);friendMarker.position.set(partner.p.x,3.3,partner.p.z);
  }
  if(sendClock>=.05){sendClock%=.05;if(room.guest&&room.ready)room.send({type:'input',input:safeInput(input),playing});else if(room.host&&partner&&room.ready)room.send(frame());}
 }
 let lastTick=performance.now();
 setInterval(()=>{
  const now=performance.now();let remaining=Math.min((now-lastTick)/1000,.25);lastTick=now;
  const {input,playing}=ctx.controls();
  while(remaining>.001){const dt=Math.min(remaining,.05);tick(dt,safeInput(input),playing);remaining-=dt;}
 },50);
 function openPanel(){ctx.clearInput();$('#room-panel').hidden=false;$('#room-code-input').focus();}
 $('#multiplayer').onclick=openPanel;$('#room-badge').onclick=openPanel;$('#room-close').onclick=()=>$('#room-panel').hidden=true;
 $('#room-host').onclick=()=>connect();$('#room-form').onsubmit=e=>{e.preventDefault();connect($('#room-code-input').value);};
 async function connect(code){if(ctx.law.jailed||ctx.save().wanted){toast('경찰 추격과 수감이 끝난 뒤 방에 들어갈 수 있어요.');return;}try{await room.open(code);if(room.host){ctx.start();$('#room-panel').hidden=false;}}catch{/* status contains the reason */}}
 $('#room-leave').onclick=()=>{room.leave();toast('방에서 나왔어요. 혼자서 계속 달릴 수 있어요.');};
 $('#room-copy').onclick=async()=>{try{await navigator.clipboard.writeText(room.code);toast('방 코드를 복사했어요. 친구에게 알려 주세요!');}catch{toast(`친구에게 방 코드 ${room.code}를 알려 주세요.`);}};
 $('#room-code-input').oninput=e=>e.target.value=normaliseCode(e.target.value);
 addEventListener('pagehide',()=>room.leave());
 const api={room,other:null,get guest(){return room.guest&&room.ready;},get waitingGuest(){return room.guest;},get active(){return room.active;},get jail(){return guestJail;},action,shift(x,z){partnerLaw?.shift(x,z);},get blocked(){return !$('#room-panel').hidden;},state:()=>({role:room.role,code:room.code,status:room.status,count:room.active?(room.ready?2:1):0,other:api.other}),leave:()=>room.leave()};
 return api;
}
