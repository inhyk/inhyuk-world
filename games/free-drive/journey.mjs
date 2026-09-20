import {CARS,drive,walk,vehicleBounds,findExit,nearestVehicle,nearestRoad,stepTraffic,rebaseDelta,applyCollision,clearCollisionAfterSeparation,cuffTarget,toggleCuffs} from './core.mjs';
import {PLACES,schoolZoneAt,SCHOOL_LIMIT} from './places.mjs';
import {WorldStream} from './world.mjs';

export class Journey {
 constructor({p,world,central,solids,makeCar,node,box,cyl,camera,selected,makeTreasure,makeCuffs=()=>null,conditions={},onDamage=()=>{},shared=null}){
  Object.assign(this,{p,world,central,baseSolids:solids,makeCar,node,box,cyl,camera});
  this.makeCuffs=makeCuffs;this.conditions=conditions;this.onDamage=onDamage;
  this.shared=shared;this.actors=shared?shared.actors:[this];if(shared)this.actors.push(this);
  this.stream=shared?shared.stream:new WorldStream({node,box,cyl,parent:world,makeTreasure});this.serial=0;this.vehicles=shared?shared.vehicles:[];
  this.own=this.create(shared?'guest-own':'own',selected,p.x,p.z,0,false);this.occupied=this.own;
  if(!shared){this.create('parked-coupe','sun',10,-15,0,false);this.create('parked-van','berry',10,-27,0,false);
  const streetCars=CARS.filter(c=>!c.hidden&&c.id!=='police'&&c.id!=='ferrari');
  for(let i=0;i<30;i++){const v=this.create(`traffic-${i}`,streetCars[i%streetCars.length].id,0,0,0,true);this.respawn(v,i);}
  // A visible passing car in the opposite lane at the starting point.
  Object.assign(this.vehicles.find(v=>v.id==='traffic-0'),{x:-3,z:12,yaw:Math.PI,speed:6});}
  this.pawn=node('explorer');this.pawn.parent=world;
  box('jacket',0,1.05,0,.65,.65,.4,'#f1b768',this.pawn);
  cyl('head',0,1.65,0,.24,.43,'#e5b58d',this.pawn);
  box('hair',0,1.86,-.03,.49,.16,.45,'#3b514d',this.pawn);
  this.legs=[-.19,.19].map(x=>box('walking leg',x,.45,0,.23,.65,.26,'#38566a',this.pawn));
  this.arms=[-.45,.45].map(x=>box('walking arm',x,1,0,.2,.65,.24,'#f1b768',this.pawn));
  this.refresh();this.render(0);
 }
 create(id,model,x,z,yaw,auto){const mesh=this.makeCar(CARS.find(c=>c.id===model));mesh.parent=this.world;const v={id,model,x,z,yaw,auto,speed:0,cuffed:false,durability:100,cruise:8+this.vehicles.length%4,mesh};this.vehicles.push(v);return v;}
 respawn(v,index=this.serial++){
  // Spawn outside the visible foreground, on roads that continue between regions.
  const vertical=index%2===0,dir=index%4<2?1:-1;
  for(let attempt=0;attempt<12;attempt++){
   const offset=(index*47+attempt*31)%170-85;
   const axis=(index%3-1)*85+dir*(130+attempt*8);
   const x=vertical?nearestRoad(this.p.x+offset)+3*dir:this.p.x+axis;
   const z=vertical?this.p.z+axis:nearestRoad(this.p.z+offset)-3*dir;
   if(this.vehicles.some(o=>o!==v&&Math.hypot(o.x-x,o.z-z)<12)||Math.hypot(this.p.x-x,this.p.z-z)<35)continue;
   Object.assign(v,{x,z,yaw:vertical?(dir>0?0:Math.PI):(dir>0?Math.PI/2:-Math.PI/2),speed:0,auto:true,cuffed:false,durability:100,lastImpact:null});return;
  }
 }
 get cuffTarget(){return cuffTarget(this.p,this.occupied,this.vehicles,this.solids);}
 handcuff(){
  if(this.occupied?.model!=='police')return '경찰차에 타야 수갑을 사용할 수 있어요.';
  const target=this.cuffTarget;if(!target)return '앞쪽 14m 안의 차량을 향해 가까이 가세요.';
  const cuffed=toggleCuffs(target);if(!target.cuffMesh)target.cuffMesh=this.makeCuffs(target.mesh);
  target.cuffMesh?.setEnabled(cuffed);
  return `${CARS.find(c=>c.id===target.model).name} ${cuffed?'수갑 체포! 차가 멈췄어요. 다시 H로 해제할 수 있어요.':'수갑을 풀었어요.'}`;
 }
 get walking(){return !this.occupied;}
 repair(save){
  const vehicle=this.occupied;
  if(!vehicle)return '수리할 차에 먼저 타 주세요.';
  if(vehicle.durability>=100)return '이미 내구도가 100이에요. 수리가 필요하지 않아요.';
  if(save.coins<100)return '수리하려면 100코인이 필요해요.';
  save.coins-=100;vehicle.durability=100;
  if(vehicle===this.own)this.conditions[vehicle.model]=100;
  return '100코인으로 수리 완료! 내구도가 100이 되었어요.';
 }
 get near(){return this.walking?nearestVehicle(this.p,this.vehicles.filter(v=>!v.networkReserved&&!this.actors.some(a=>a!==this&&(a.occupied===v||a.own===v)))):null;}
 get centralVisible(){return this.central.isEnabled();}
 refresh(){
  this.stream.updateMany(this.actors.map(a=>a.p));
  const {x,z}=this.stream.origin,near=this.actors.some(a=>Math.abs(a.p.x+Number(x)*240)<600&&Math.abs(a.p.z+Number(z)*240)<600);
  this.central.setEnabled(near);if(near)this.central.position.set(-Number(x)*240,0,-Number(z)*240);
  const ox=this.central.position.x,oz=this.central.position.z;
  this.solids=[...this.stream.solids,...(near?this.baseSolids.map(b=>({...b,x:b.x+ox,z:b.z+oz})):[])];
  this.region=this.stream.region(this.p.x,this.p.z);
 }
 interact(){
  if(this.occupied){
   if(Math.abs(this.p.speed)>1)return '먼저 브레이크로 차를 멈춰 주세요.';
   const walls=[...this.solids,...this.vehicles.map(v=>vehicleBounds(v))];
   const exit=findExit(this.occupied,walls);if(!exit)return '내릴 공간이 없어요. 조금 더 넓은 곳에 세워 주세요.';
   this.occupied.speed=0;this.occupied.auto=false;this.occupied=null;
   Object.assign(this.p,exit,{speed:0,yaw:0});this.render(0);return '차에서 내렸어요! WASD로 걷고, 가까운 차에 E로 타세요.';
  }
  const v=this.near;if(!v)return '차 가까이로 걸어가세요. 지나가는 차도 가까이 오면 멈춰요.';
  this.occupied=v;v.auto=false;v.speed=0;Object.assign(this.p,{x:v.x,z:v.z,yaw:v.yaw,speed:0,gear:'D'});this.render(0);
  return `${CARS.find(c=>c.id===v.model).name}에 탔어요. 출발해 볼까요?`;
 }
 select(model){
  if(this.occupied&&this.occupied!==this.own){this.occupied.auto=false;this.occupied.speed=0;}
  this.own.mesh.dispose();this.own.mesh=this.makeCar(CARS.find(c=>c.id===model));this.own.mesh.parent=this.world;this.own.model=model;this.own.durability=this.conditions[model]??100;this.own.lastImpact=null;
  // Changing cars at the garage places the selected car on the nearest road.
  Object.assign(this.own,{x:nearestRoad(this.p.x)+3,z:this.p.z,yaw:0,speed:0});
  this.occupied=this.own;Object.assign(this.p,{x:this.own.x,z:this.own.z,yaw:0,speed:0,gear:'D'});this.render(0);
 }
 travel(id,selected){
  const place=PLACES.find(place=>place.id===id);if(!place)return false;
  const ox=Number(this.stream.origin.x)*240,oz=Number(this.stream.origin.z)*240;
  const destination={x:place.x-ox,z:place.z-oz};
  for(let i=0;i<12;i++){if(!this.vehicles.some(v=>v!==this.own&&Math.hypot(v.x-destination.x,v.z-destination.z)<6))break;destination.z-=6;}
  Object.assign(this.p,destination,{yaw:0,speed:0,gear:'D'});this.select(selected);this.refresh();this.render(0);return true;
 }
 reset(selected){
  if(this.actors.length>1){Object.assign(this.p,{x:3-Number(this.stream.origin.x)*240,z:(this.shared?-25:-15)-Number(this.stream.origin.z)*240,yaw:0,speed:0,gear:'D'});this.select(selected);this.refresh();return;}
  this.stream.origin={x:0n,z:0n};for(const c of this.stream.chunks.values())c.root.dispose();this.stream.chunks.clear();this.stream.center='';
  Object.assign(this.p,{x:3,z:-15,yaw:0,speed:0,gear:'D'});this.select(selected);
  for(const v of this.vehicles)if(v!==this.own)this.respawn(v);this.refresh();this.render(0);
 }
 updateTraffic(dt,seconds){for(const v of this.vehicles){if(this.actors.some(a=>a.occupied===v))continue;if(this.actors.every(a=>Math.hypot(v.x-a.p.x,v.z-a.p.z)>230&&v!==a.own))this.respawn(v);const near=this.actors.slice().sort((a,b)=>Math.hypot(a.p.x-v.x,a.p.z-v.z)-Math.hypot(b.p.x-v.x,b.p.z-v.z))[0];stepTraffic(v,dt,{player:near.p,walking:near.walking,vehicles:this.vehicles,seconds,speedLimit:schoolZoneAt(v,this.stream.origin)?SCHOOL_LIMIT:Infinity});}}
 update(dt,input,seconds){
  if(!this.shared)this.updateTraffic(dt,seconds);
  const obstacles=[...this.solids,...this.vehicles.filter(v=>v!==this.occupied).map(v=>({...vehicleBounds(v,this.walking?0:1.5),vehicle:v}))];
  let moved=0;if(this.walking)walk(this.p,input.steer,Number(input.gas)-Number(input.brake),dt,obstacles);
  else{
   if(this.occupied.durability===0||this.occupied.cuffed){this.p.speed=0;this.p.collisionIndex=-1;}
   else moved=drive(this.p,input,dt,CARS.find(c=>c.id===this.occupied.model).speed,obstacles);
   Object.assign(this.occupied,{x:this.p.x,z:this.p.z,yaw:this.p.yaw,speed:this.p.speed});
   clearCollisionAfterSeparation(this.occupied);
   if(this.p.collisionIndex>=0&&this.p.impactSpeed>.1&&applyCollision(this.occupied,seconds)){
    const other=obstacles[this.p.collisionIndex]?.vehicle;if(other)applyCollision(other,seconds);
    if(this.occupied===this.own)this.conditions[this.own.model]=this.own.durability;
    for(const actor of this.actors)if(other===actor.own)actor.conditions[actor.own.model]=actor.own.durability;
    if(this.occupied.durability===0)this.p.speed=0;
    this.onDamage(this.occupied.durability);
   }
  }
  const shift=this.shared?{x:0,z:0}:rebaseDelta(this.p);if(shift.x||shift.z){for(const actor of this.actors){actor.p.x-=shift.x;actor.p.z-=shift.z;}for(const v of this.vehicles){v.x-=shift.x;v.z-=shift.z;if(v.lastImpact){v.lastImpact.x-=shift.x;v.lastImpact.z-=shift.z;}}this.camera.position.x-=shift.x;this.camera.position.z-=shift.z;this.stream.shift(shift.x,shift.z);}
  const before=this.stream.center;this.stream.updateMany(this.actors.map(a=>a.p));if(shift.x||shift.z||before!==this.stream.center)this.refresh();
  this.render(seconds);return moved;
 }
 render(seconds){
  for(const v of this.vehicles){v.mesh.position.set(v.x,.13,v.z);v.mesh.rotation.y=v.yaw;v.mesh.setEnabled(true);v.cuffMesh?.setEnabled(!!v.cuffed);}
  this.pawn.setEnabled(this.walking);this.pawn.position.set(this.p.x,.13,this.p.z);this.pawn.rotation.y=this.p.yaw;
  const swing=this.walking&&this.p.speed>.1?Math.sin(seconds*12)*.5:0;this.legs.forEach((leg,i)=>leg.rotation.x=(i?1:-1)*swing);this.arms.forEach((arm,i)=>arm.rotation.x=(i?-1:1)*swing);
 }
 state(){return {mode:this.walking?'walking':'driving',vehicle:this.occupied?{id:this.occupied.id,model:this.occupied.model,durability:this.occupied.durability}:null,nearby:this.near?.id||null,cuffTarget:this.cuffTarget?.id||null,region:this.region,origin:{x:this.stream.origin.x.toString(),z:this.stream.origin.z.toString()},chunks:this.stream.chunks.size,traffic:this.vehicles.map(({id,model,x,z,yaw,speed,auto,durability,cuffed})=>({id,model,x,z,yaw,speed,auto,durability,cuffed}))};}
}
