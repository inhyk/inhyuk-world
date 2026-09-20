import {schoolZoneAt,SCHOOL_LIMIT} from './places.mjs';
import {nearestRoad,blockedAt} from './core.mjs';
import {signalPhase,crossedRed,jailSeconds,arrest,release} from './law.mjs';

export class Enforcement {
 constructor({save,persist,toast,journey,world,node,box,cyl,makeCar,material}){
  Object.assign(this,{save,persist,toast,journey,world,node,box,cyl,material});this.trail=[];this.signals=new Map();this.cop={x:0,z:0,yaw:0};this.chasing=false;this.schoolSpeeding=0;
  this.car=makeCar({name:'경찰 순찰차',color:'#e8eff4',shape:'compact'});this.car.parent=world;
  box('police stripe',0,.84,2.19,1.8,.22,.03,'#3567b7',this.car);box('police roof',0,2.04,-.3,1.5,.12,.5,'#27384e',this.car);
  this.red=box('red siren',-.42,2.21,-.3,.6,.22,.4,'#fc6960',this.car);this.blue=box('blue siren',.42,2.21,-.3,.6,.22,.4,'#75c9ff',this.car);
  this.officer=node('police officer');this.officer.parent=world;box('uniform',0,1,0,.7,.7,.4,'#36537d',this.officer);cyl('face',0,1.62,0,.24,.4,'#e0b48f',this.officer);box('cap',0,1.86,.04,.55,.17,.55,'#243754',this.officer);for(const x of [-.2,.2])box('leg',x,.42,0,.24,.65,.25,'#263b59',this.officer);box('badge',.18,1.15,.22,.12,.16,.025,'#fbe499',this.officer);
  this.car.setEnabled(false);this.officer.setEnabled(false);
 }
 get jailed(){return jailSeconds(this.save)>0;}
 unlock(code){if(code!=='13570'||!this.jailed)return false;this.save.jailUntil=Date.now();this.tick();return true;}
 tick(now=Date.now()){
  if(release(this.save,now)){this.chasing=false;this.trail=[];this.car.setEnabled(false);this.officer.setEnabled(false);this.journey.reset(this.save.selected);this.persist();this.toast('출소했어요! 신호와 어린이 보호구역 제한속도를 지켜 주세요.');}
  return jailSeconds(this.save,now);
 }
 shift(dx,dz){for(const t of this.trail){t.x-=dx;t.z-=dz;}this.cop.x-=dx;this.cop.z-=dz;for(const s of this.signals.values())s.root.dispose();this.signals.clear();}
 lights(seconds){
  const p=this.journey.p,roads=n=>[...new Set(Array.from({length:13},(_,i)=>nearestRoad(n+(i-6)*20)))].sort((a,b)=>Math.abs(a-n)-Math.abs(b-n)).slice(0,3);
  const needed=new Set();for(const x of roads(p.x))for(const z of roads(p.z)){const key=`${x},${z}`;needed.add(key);if(!this.signals.has(key)){
   const root=this.node('traffic signals');root.parent=this.world;root.position.set(x,0,z);const bulbs=[];
   for(const side of [-1,1]){this.box('north south stop line',side*3,.16,-side*8,4.4,.035,.3,'#f2e9d1',root);this.box('east west stop line',-side*8,.16,-side*3,.3,.035,4.4,'#f2e9d1',root);}
   for(const axis of ['z','x']){const px=axis==='z'?6.8:-8,pz=axis==='z'?-8:-6.8;this.cyl('signal post',px,1.8,pz,.1,3.6,'#44595d',root);this.box('signal housing',px,3.65,pz,.65,1.7,.5,'#223b3e',root);for(const [i,color] of ['red','yellow','green'].entries()){const mesh=this.box(`${color} lamp`,px,4.15-i*.48,pz,.48,.35,.57,'#344a4c',root);bulbs.push({mesh,axis,color});}}
   this.signals.set(key,{root,bulbs});
  }}
  for(const [key,s] of this.signals){if(!needed.has(key)){s.root.dispose();this.signals.delete(key);continue;}for(const b of s.bulbs)b.mesh.material=this.material(b.color===signalPhase(seconds,b.axis)?{red:'#ff594e',yellow:'#ffdc66',green:'#8de88a'}[b.color]:'#344a4c');}
 }
 step(dt,seconds,before,driving){
  if(this.journey.occupied?.model==='police'){
   this.schoolSpeeding=0;const wasWanted=this.save.wanted;this.save.wanted=false;this.chasing=false;this.trail=[];
   this.car.setEnabled(false);this.officer.setEnabled(false);
   if(wasWanted){this.persist();this.toast('경찰차에 탔어요. 경찰 추격이 해제됐어요.');}
   return;
  }
  const p=this.journey.p,last=this.trail.at(-1);
  const speeding=driving&&schoolZoneAt(p,this.journey.stream?.origin)&&Math.abs(p.speed)>SCHOOL_LIMIT+.05;
  this.schoolSpeeding=speeding?(this.schoolSpeeding||0)+dt:0;
  if(!this.save.wanted&&this.schoolSpeeding>=.5){this.save.wanted=true;this.persist();this.toast('어린이 보호구역 과속! 30 km/h 이하로 달려 주세요. 경찰이 추격해요.');}

  if(!last||Math.hypot(last.x-p.x,last.z-p.z)>1)this.trail.push({x:p.x,z:p.z});
  if(!this.save.wanted){while(this.trail.length>35)this.trail.shift();if(driving&&crossedRed(before,p,seconds,nearestRoad)){this.save.wanted=true;this.persist();this.toast('신호 위반! 경찰이 추격해요. 잡히면 60초 동안 감옥에 있어요.');}}
  if(!this.save.wanted||this.jailed)return;
  if(!this.chasing){
   let spawn=this.trail[0];if(!spawn||Math.hypot(spawn.x-p.x,spawn.z-p.z)<10){spawn={x:p.x-Math.sin(p.yaw)*22,z:p.z-Math.cos(p.yaw)*22};if(blockedAt(spawn.x,spawn.z,this.journey.solids,1))spawn={x:nearestRoad(p.x)+3,z:p.z-22};this.trail.unshift(spawn);}
   Object.assign(this.cop,spawn);this.chasing=true;
  }
  let budget=(this.journey.walking?8:46)*dt;
  while(budget>0&&this.trail.length){const target=this.trail[0],dx=target.x-this.cop.x,dz=target.z-this.cop.z,d=Math.hypot(dx,dz);if(d<.05){this.trail.shift();continue;}const step=Math.min(d,budget);this.cop.x+=dx/d*step;this.cop.z+=dz/d*step;this.cop.yaw=Math.atan2(dx,dz);budget-=step;if(step===d)this.trail.shift();}
  // Keep pursuit history bounded even if a very fast car keeps driving away.
  if(this.trail.length>512)this.trail.splice(1,this.trail.length-512);
  this.car.setEnabled(!this.journey.walking);this.officer.setEnabled(this.journey.walking);
  for(const m of [this.car,this.officer]){m.position.set(this.cop.x,.13,this.cop.z);m.rotation.y=this.cop.yaw;}
  this.red.setEnabled(Math.floor(seconds*6)%2===0);this.blue.setEnabled(Math.floor(seconds*6)%2!==0);
  if(Math.hypot(this.cop.x-p.x,this.cop.z-p.z)<(this.journey.walking?1.5:3)){
   arrest(this.save);p.speed=0;if(this.journey.occupied)this.journey.occupied.speed=0;this.car.setEnabled(false);this.officer.setEnabled(false);this.chasing=false;this.persist();this.toast('경찰에게 잡혔어요. 60초 후에 자동으로 출소합니다.');
  }
 }
 state(){return {wanted:this.save.wanted,jailRemaining:jailSeconds(this.save),police:this.chasing?{...this.cop}:null,signals:this.signals.size};}
}
