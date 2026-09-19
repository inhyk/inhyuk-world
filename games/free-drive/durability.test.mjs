import test from 'node:test';
import assert from 'node:assert/strict';
import {applyCollision,clearCollisionAfterSeparation,cleanSave,stepTraffic} from './core.mjs';
import {Journey} from './journey.mjs';
test('each distinct accident costs ten, continuous contact costs only once, ten accidents stop the car',()=>{const v={x:0,z:0,speed:10,durability:100};assert.equal(applyCollision(v,0),true);assert.equal(v.durability,90);for(let i=1;i<600;i++)assert.equal(applyCollision(v,i/60),false);assert.equal(v.durability,90);for(let crash=1;crash<10;crash++){v.x=3;clearCollisionAfterSeparation(v);v.x=0;assert.equal(applyCollision(v,10+crash),true);}assert.equal(v.durability,0);assert.equal(v.speed,0);assert.equal(applyCollision(v,100),false);assert.equal(v.durability,0);});
test('saved durability is validated and broken traffic cannot accelerate',()=>{const s=cleanSave({durability:{mint:0,sun:130,berry:-7,invalid:50,comet:'oops'}});assert.deepEqual(s.durability,{mint:0,sun:100,berry:0});const v={x:0,z:0,yaw:0,auto:true,cruise:10,speed:0,durability:0};stepTraffic(v,1,{player:{x:100,z:100},walking:false,vehicles:[],seconds:0});assert.equal(v.z,0);assert.equal(v.speed,0);});
// Exercise actual journey movement and vehicle switching, with rendering stubbed out.
function journey(conditions={}){const node=()=>({position:{x:0,z:0,set(x,y,z){this.x=x;this.z=z;}},rotation:{},dispose(){},setEnabled(v){this.enabled=v;},isEnabled(){return this.enabled!==false;}});const p={x:3,z:-15,yaw:0,speed:0,gear:'D'},world=node(),central=node();return new Journey({p,world,central,solids:[],makeCar:node,node,box:node,cyl:node,camera:node(),selected:'mint',conditions});}
test('zero durability blocks player gas but still allows exit and another vehicle',()=>{const j=journey({mint:0});j.select('mint');for(let i=0;i<120;i++)j.update(1/60,{gas:true,brake:false,steer:1},i/60);assert.equal(j.p.x,3);assert.equal(j.p.z,-15);assert.equal(j.p.speed,0);j.interact();assert.equal(j.walking,true);j.p.x=8;j.p.z=-15;j.interact();assert.equal(j.occupied.id,'parked-coupe');assert.equal(j.occupied.durability,100);for(let i=0;i<30;i++)j.update(1/60,{gas:true,brake:false,steer:0},3+i/60);assert.ok(j.p.z> -15);j.reset('mint');assert.equal(j.occupied.durability,0);});


test('100 coins repairs only the occupied car, persists owned health and restores broken driving',()=>{
 const conditions={mint:0,sun:40},j=journey(conditions),save={coins:100};j.select('mint');
 j.repair(save);assert.equal(save.coins,0);assert.equal(j.occupied.durability,100);assert.deepEqual(conditions,{mint:100,sun:40});
 for(let i=0;i<30;i++)j.update(1/60,{gas:true,brake:false,steer:0},i/60);
 assert.ok(j.p.z> -15);j.select('mint');assert.equal(j.occupied.durability,100);
});
test('repair does not charge for full health, walking, insufficient funds or repeat clicks',()=>{
 const j=journey(),save={coins:200};j.repair(save);assert.equal(save.coins,200);
 j.interact();j.repair(save);assert.equal(save.coins,200);j.interact();j.occupied.durability=10;
 save.coins=99;j.repair(save);assert.equal(save.coins,99);assert.equal(j.occupied.durability,10);
 save.coins=200;j.repair(save);j.repair(save);assert.equal(save.coins,100);assert.equal(j.occupied.durability,100);
});
test('repairing a borrowed car does not repair or overwrite the owned car of the same model',()=>{
 const conditions={mint:30,sun:20},j=journey(conditions),save={coins:100};
 j.occupied=j.vehicles.find(v=>v.id==='parked-coupe');j.occupied.durability=0;j.repair(save);
 assert.equal(j.occupied.durability,100);assert.equal(save.coins,0);assert.deepEqual(conditions,{mint:30,sun:20});
});
