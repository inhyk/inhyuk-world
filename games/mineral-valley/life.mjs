// 밤에만 나타나는 몬스터와, 30,000m 계곡에 딱 하나뿐인 풍선.
export const MONSTER_SPEED=11;
export const MONSTER_REACH=3.6;      // 몬스터가 탐험가에게 닿는 거리
export const MONSTER_BUMP=6;         // 부딪히면 밀려나는 거리
export const SWING_RANGE=13;         // 곡괭이가 닿는 거리
export const SWING_ARC=.4;           // 앞쪽으로 향한 정도(코사인)
export const SWING_COOLDOWN=.45;
export const BALLOON_RANGE=16;
export const BALLOON_HEIGHT=34;
// 바로 앞이면 방향을 따지지 않는다. 등 뒤에서 달려드는 몬스터도 뿌리칠 수 있다.
export function facingDot(actor,x,z){
 const dx=x-actor.x,dz=z-actor.z,d=Math.hypot(dx,dz);
 if(d<1e-6)return 1;
 return (Math.sin(actor.facing)*dx+Math.cos(actor.facing)*dz)/d;
}
export function inSwing(actor,target,range=SWING_RANGE,arc=SWING_ARC){
 const d=Math.hypot(target.x-actor.x,target.z-actor.z);
 if(d>range)return false;
 return d<2.5||facingDot(actor,target.x,target.z)>=arc;
}
// 캠프에서 멀수록 몬스터가 더 값진 것을 떨군다.
export const monsterReward=(base,boost)=>Math.round(base*(1+boost));
// 중심에서 min~max 만큼 떨어진 한 점. 캠프 안쪽(safe)은 피한다.
export function ringPoint(center,min,max,random=Math.random,clamp=v=>v,safe=0){
 for(let tries=0;tries<16;tries++){
  const a=random()*Math.PI*2,d=min+Math.sqrt(random())*(max-min);
  const x=clamp(center.x+Math.cos(a)*d),z=clamp(center.z+Math.sin(a)*d);
  if(Math.hypot(x,z)>=safe)return {x,z};
 }
 return {x:clamp(center.x+min),z:clamp(center.z+min)};
}
// 가장 가까운 탐험가를 쫓는다.
export function chase(monster,team,dt,speed=MONSTER_SPEED){
 let target=null,best=Infinity;
 for(const a of team){const d=Math.hypot(a.x-monster.x,a.z-monster.z);if(d<best){best=d;target=a;}}
 if(!target)return null;
 if(best>MONSTER_REACH){
  const step=Math.min(speed*dt,best-MONSTER_REACH*.5);
  monster.x+=(target.x-monster.x)/best*step;
  monster.z+=(target.z-monster.z)/best*step;
  monster.facing=Math.atan2(target.x-monster.x,target.z-monster.z);
 }
 return {target,distance:Math.hypot(target.x-monster.x,target.z-monster.z)};
}
// 부딪힌 탐험가를 몬스터 반대쪽으로 밀어낸다.
export function knockback(actor,from,distance=MONSTER_BUMP,clamp=v=>v){
 const dx=actor.x-from.x,dz=actor.z-from.z,d=Math.hypot(dx,dz)||1;
 actor.x=clamp(actor.x+dx/d*distance);
 actor.z=clamp(actor.z+dz/d*distance);
}
