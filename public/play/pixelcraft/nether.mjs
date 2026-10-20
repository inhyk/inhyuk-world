import { B, I, MOBS } from './data.mjs';
import { W, H, idx, collides, moveBody, touching } from './core.mjs';
export const NETHER_TYPES = ['piglin', 'blaze', 'ghast'];
export function spawnNether(G, makeMob, initial = false) {
  if (G.adventure?.dimension !== 'nether') return;
  const living = G.mobs.filter(m => !m.dead && MOBS[m.type]?.nether);
  if (living.length >= (G.diff === 2 ? 12 : 8)) return;
  const types = initial ? ['piglin','piglin','blaze','ghast'] : [NETHER_TYPES[Math.floor(G.rng()*3)]];
  for (const [i,type] of types.entries()) {
    if (G.diff === 0 && type !== 'piglin') continue;
    const def=MOBS[type], side=i%2?-1:1;
    const x=Math.max(4,Math.min(W-def.w-4, initial ? type==='blaze'?W/2+40:G.player.x+side*(16+i*6) : G.player.x+(G.rng()<.5?-1:1)*(20+G.rng()*22)));
    const y=G.w.surface[Math.floor(x)]-def.h-(def.flying?(type==='ghast'?10:3):.02);
    if (!collides(G.w,x,y,def.w,def.h)) G.mobs.push(makeMob(type,x,y));
  }
}
export function tickNetherMob(G,m,p,dt,api) {
  const def=MOBS[m.type];
  if (!def?.nether) return false;
  if (Math.abs(m.x-p.x)>85 || m.y>H || (G.diff===0 && m.type!=='piglin')) {m.remove=true;return true;}
  m.hurtT=Math.max(0,m.hurtT-dt);m.attackT-=dt;m.walkT+=dt*2;m.fire=0;
  const dx=p.x+p.w/2-(m.x+m.w/2),dy=p.y+p.h/2-(m.y+m.h/2),dist=Math.hypot(dx,dy);
  const gold=p.armor?.some(s=>s&&s.id>=I.GOLD_HELMET&&s.id<=I.GOLD_BOOTS);
  const angry=G.mode!=='creative' && !G.dead && G.diff>0 && (m.type!=='piglin'||!gold||m.provoked);
  const visible=api.lineOfSight(m.x+m.w/2,m.y+m.h/2,p.x+p.w/2,p.y+p.h/2);
  const chase=angry&&dist<38;
  m.face=Math.sign(dx)||1;
  if (def.flying) {
    const desiredX=chase&&dist<10?-Math.sign(dx)*def.speed:chase&&dist>17?Math.sign(dx)*def.speed:Math.sin(G.clock*.4+m.x*.02)*.6;
    const hover=chase?p.y-(m.type==='ghast'?7:3):G.w.surface[Math.max(0,Math.min(W-1,Math.floor(m.x)))]-def.h-5;
    m.vx+=(desiredX-m.vx)*Math.min(1,dt*3);
    m.vy+=(Math.max(-3,Math.min(3,(hover-m.y)*1.5))+Math.sin(G.clock*2)*.4-m.vy)*Math.min(1,dt*3);
    moveBody(G.w,m,dt); if(m.hitWall)m.vy=-3;
    if(chase&&visible&&m.attackT<=0) {
      m.attackT=m.type==='ghast'?4:3;
      for(const offset of m.type==='blaze'?[-.3,0,.3]:[0]) api.shootFireball(m.x+m.w/2,m.y+m.h/2,p.x+p.w/2,p.y+.8+offset,m.type);
    }
  } else {
    m.vx+=((chase?Math.sign(dx)*def.speed:Math.sin(G.clock*.5+m.x)*.6)-m.vx)*Math.min(1,dt*7);
    m.vy=Math.min(25,m.vy+30*dt); moveBody(G.w,m,dt);if(m.hitWall&&m.onGround)m.vy=-9.2;
    if(chase&&dist<1.6&&m.attackT<=0){api.hurtPlayer(def.dmg,def.name,m.x,{player:p});m.attackT=1.1;}
  }
  // 물은 블레이즈의 약점, 불과 용암은 네더 생물에게 피해를 주지 않는다.
  if(m.type==='blaze'&&touching(G.w,m,t=>t===B.WATER)&&m.hurtT<=0)api.hitMob(m,2,m.x);
  return true;
}
export function updateFireballs(G,dt,api) {
  for(const f of G.fireballs??[]) {
    f.life-=dt;
    const steps=Math.max(1,Math.ceil(Math.hypot(f.vx,f.vy)*dt/.25));
    for(let i=0;i<steps&&f.life>0;i++){
      f.x+=f.vx*dt/steps; f.y+=f.vy*dt/steps;
      const players=[G.player,...(G.adventure?.coop&&!G.companion.spectator?[G.companion]:[])];
      const hit=players.find(p=>f.x>p.x-.15&&f.x<p.x+p.w+.15&&f.y>p.y-.15&&f.y<p.y+p.h+.15);
      if(hit||collides(G.w,f.x-.12,f.y-.12,.24,.24)) {
        if(f.type==='ghast'){
          G.shake=Math.max(G.shake,.3);
          for(const p of players)if(Math.hypot(p.x+p.w/2-f.x,p.y+p.h/2-f.y)<2.5)api.hurtPlayer(7,'가스트',f.x,{player:p});
        }else if(hit) api.hurtPlayer(4,'블레이즈',f.x,{player:hit});
        api.burst(f.x,f.y,'#ffb64b',12); f.life=0;
      }
    }
  }
  G.fireballs=(G.fireballs??[]).filter(f=>f.life>0&&f.x>0&&f.x<W&&f.y>0&&f.y<H);
}
