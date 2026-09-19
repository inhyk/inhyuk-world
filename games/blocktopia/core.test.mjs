import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanSave,stepBody} from './core.mjs';
const ground={x:0,z:0,w:86,d:78,top:.11,bottom:-3};
test('corrupt saves cannot create invalid currency or out of bounds blocks',()=>{const s=cleanSave({coins:-8,outfit:999,checkpoint:Infinity,collected:[1,1,-3,'2'],blocks:[{x:-24,z:-20,y:0,color:0},{x:999,z:-20,y:0,color:0}]});assert.equal(s.coins,0);assert.equal(s.outfit,5);assert.equal(s.checkpoint,0);assert.deepEqual(s.collected,[1]);assert.equal(s.blocks.length,1);});
test('jump rises and lands on the ground',()=>{const p={x:0,y:.11,z:0,vy:0,grounded:true};stepBody(p,0,0,1/60,[ground],true);assert.ok(p.y>.11);for(let i=0;i<90;i++)stepBody(p,0,0,1/60,[ground],false);assert.equal(p.y,.11);assert.equal(p.grounded,true);});
test('walls stop walking but allow walking above their top',()=>{const b={x:2,z:0,w:2,d:4,top:6,bottom:0};const p={x:0,y:.11,z:0,vy:0,grounded:true};for(let i=0;i<30;i++)stepBody(p,.1,0,1/60,[ground,b],false);assert.ok(p.x<=.620001);p.y=6.5;stepBody(p,.1,0,1/60,[ground,b],false);assert.ok(p.x>.62);});
test('all twelve obby platforms are reachable with the normal jump',()=>{const ps=Array.from({length:12},(_,i)=>({x:13+i*2.15,z:23+Math.sin(i*.7)*3.3,top:.87+i*.75,w:2.95,d:2.95,bottom:i*.75}));for(let i=0;i<11;i++){const a=ps[i],b=ps[i+1],p={x:a.x,y:a.top,z:a.z,vy:0,grounded:true};let landed=false;for(let f=0;f<100;f++){const dist=Math.hypot(b.x-p.x,b.z-p.z),step=Math.min(.1,dist);stepBody(p,dist?(b.x-p.x)/dist*step:0,dist?(b.z-p.z)/dist*step:0,1/60,ps,f===0);if(p.grounded&&Math.abs(p.y-b.top)<.01){landed=true;break;}}assert.ok(landed,`platform ${i+1} to ${i+2}`);}});
test('walking off the island causes a fall',()=>{const p={x:44,y:.11,z:0,vy:0,grounded:true};for(let i=0;i<60;i++)stepBody(p,0,0,1/60,[ground],false);assert.ok(p.y< -8);});

test('all five spiral towers can be completed with normal jumps', async()=>{
  const {TOWERS,towerPlatforms}=await import('./towers.mjs');
  for(const t of TOWERS){const ps=towerPlatforms(t);for(let i=0;i<ps.length-1;i++){const a=ps[i],b=ps[i+1],p={x:a.x,y:a.top,z:a.z,vy:0,grounded:true};let landed=false;for(let f=0;f<100;f++){const dist=Math.hypot(b.x-p.x,b.z-p.z),step=Math.min(.1,dist);stepBody(p,dist?(b.x-p.x)/dist*step:0,dist?(b.z-p.z)/dist*step:0,1/60,ps,f===0);if(p.grounded&&Math.abs(p.y-b.top)<.01){landed=true;break;}}assert.ok(landed,`${t.id}: ${i+1} to ${i+2}`);}}
});
test('old saves migrate; tower checkpoints stay separate; rewards only once',async()=>{
  const {TOWERS,recordTowerLanding}=await import('./towers.mjs');const s=cleanSave({coins:7,checkpoint:6,won:true});assert.equal(s.checkpoint,6);assert.equal(s.won,true);assert.equal(Object.keys(s.towers).length,5);recordTowerLanding(s,TOWERS[0],3);assert.equal(s.towers.berry.checkpoint,4);assert.equal(s.towers.forest.checkpoint,0);assert.equal(recordTowerLanding(s,TOWERS[0],11),true);assert.equal(s.coins,37);assert.equal(recordTowerLanding(s,TOWERS[0],11),false);assert.equal(s.coins,37);assert.deepEqual(cleanSave(JSON.parse(JSON.stringify(s))),s);assert.equal(cleanSave({towers:{berry:{checkpoint:999}}}).towers.berry.checkpoint,12);
});
