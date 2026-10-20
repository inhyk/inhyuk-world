import test from 'node:test';
import assert from 'node:assert/strict';
import { B,I,MOBS } from '../../public/play/pixelcraft/data.mjs';
import { W,H,idx } from '../../public/play/pixelcraft/core.mjs';
import { makeNether,portalFrame,findPortal,insidePortal,portalIntact } from '../../public/play/pixelcraft/adventure-world.mjs';
import { spawnNether,tickNetherMob,updateFireballs } from '../../public/play/pixelcraft/nether.mjs';
const mob=(type,x,y)=>({type,x,y,...MOBS[type],vx:0,vy:0,attackT:0,hurtT:0,walkT:0});
const game=()=>({w:makeNether(42),adventure:{dimension:'nether'},player:{x:640,y:65,w:.6,h:1.8,armor:[]},mobs:[],diff:1,mode:'survival',clock:0,rng:()=>.5});
test('엔드 틀과 흑요석 틀은 구분되며 몸 전체가 포탈 안에 들어가야 한다',()=>{
 const w=makeNether(42),p=portalFrame(w,100,60,'end');p.kind='end';
 assert.ok(findPortal(w,100,58,'end'));assert.equal(findPortal(w,100,58),null);assert.ok(portalIntact(w,p));
 assert.equal(insidePortal({x:99.5,y:58,w:.6,h:1.8},p),false);
 assert.equal(insidePortal({x:100.5,y:58,w:.6,h:1.8},p),true);
 w.tiles[idx(99,58)]=B.AIR;assert.equal(portalIntact(w,p),false);
});
test('네더에서 전용 생물이 생성되고 금 방어구는 피글린의 선제공격을 막는다',()=>{
 const G=game();spawnNether(G,mob,true);assert.ok(['piglin','ghast','blaze'].every(t=>G.mobs.some(m=>m.type===t)));
 const p=G.player,m=mob('piglin',p.x+1,p.y);let damage=0;
 const api={lineOfSight:()=>true,shootFireball(){},hitMob(){},hurtPlayer:n=>damage+=n};
 p.armor=[{id:I.GOLD_HELMET}];tickNetherMob(G,m,p,.01,api);assert.equal(damage,0);
 p.armor=[];tickNetherMob(G,m,p,.01,api);assert.equal(damage,5);
});
test('가스트와 블레이즈는 떠서 불덩이를 쏘고 불덩이는 플레이어 충돌 시 사라진다',()=>{
 const G=game();let shots=0,hits=0;const api={lineOfSight:()=>true,shootFireball(){shots++;},hitMob(){},hurtPlayer(){hits++;},burst(){}};
 for(const type of ['ghast','blaze']){const m=mob(type,645,60);tickNetherMob(G,m,G.player,.01,api);assert.ok(Number.isFinite(m.vy));}
 assert.equal(shots,4);
 G.fireballs=[{x:640.2,y:65.5,vx:1,vy:0,life:2,type:'blaze'}];updateFireballs(G,.01,api);assert.equal(hits,1);assert.equal(G.fireballs.length,0);
});
