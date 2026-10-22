import { isBuildWorld } from './build-guide.mjs';
import { W,H } from './core.mjs';
import { MOBS } from './data.mjs';
export const SKELETON_BOSS_HP=1200;
export const isBoss=m=>['summoner','skeleton_summoner'].includes(m.type)&&!m.dead;
export const skeletonPhase=hp=>hp>SKELETON_BOSS_HP*2/3?1:hp>SKELETON_BOSS_HP/3?2:3;
export function tickSkeletonBoss(G,dt,api){
 const a=G.adventure;if(isBuildWorld(G)||G.jump||a.dimension!=='overworld'||G.dead)return;
 let m=G.mobs.find(m=>m.type==='skeleton_summoner'&&!m.dead);
 if(!m&&G.day>=100&&!a.skeletonDefeated){
  const x=Math.max(8,Math.min(W-10,G.player.x+13));m=api.makeMob('skeleton_summoner',x,G.w.surface[Math.floor(x)]-3.2);
  Object.assign(m,{phase:1,summonT:4,volleyT:2.5,burstT:5});G.mobs.push(m);a.skeletonBoss={spawned:true};
  api.toast('100일째! 스켈레톤 소환사 등장 · 화살 부채와 뼈 군단을 조심해!');api.save();
 }
 if(!m)return;
 const phase=skeletonPhase(m.hp);if(m.phase!==phase){m.phase=phase;m.summonT=.6;api.toast(`${phase}페이즈 · 스켈레톤 소환사의 화살이 더 많아졌어!`);}
 if(m.y>H-6||Math.abs(m.x-G.player.x)>52){m.x=Math.max(3,Math.min(W-4,G.player.x+14));m.y=G.w.surface[Math.floor(m.x)]-m.h;m.vx=m.vy=0;}
 m.volleyT=(m.volleyT??2)-dt;m.summonT=(m.summonT??4)-dt;m.burstT=(m.burstT??5)-dt;
 const targets=[G.player,...(a.coop&&!G.companion.spectator?[G.companion]:[])];
 const p=targets.reduce((p,q)=>Math.abs(q.x-m.x)<Math.abs(p.x-m.x)?q:p);
 if(m.volleyT<=0){
  m.volleyT=phase===3?1.2:phase===2?1.7:2.3;
  for(let k=-phase;k<=phase;k++)api.shootArrow(m.x+.5,m.y+.8,p.x+.3,p.y+.6+k*.65,19+phase,'mob',5+phase);
 }
 if(m.summonT<=0){
  m.summonT=phase===3?4:6;const count=G.mobs.filter(e=>e.summoned&&!e.dead).length;
  for(let k=0;k<Math.min(phase+2,18-count);k++){
   const x=Math.max(3,Math.min(W-4,m.x+(k%2?-1:1)*(4+k)));const s=api.makeMob('skeleton',x,G.w.surface[Math.floor(x)]-1.85);
   Object.assign(s,{summoned:true,hp:32+phase*8});G.mobs.push(s);
  }
 }
 if(m.burstT<=0){for(const p of targets)if(Math.hypot(p.x-m.x,p.y-m.y)<6)api.hurtPlayer(8+phase,'스켈레톤 소환사',m.x,{player:p});m.burstT=phase===3?3.5:5;G.shake=.35;}
}
