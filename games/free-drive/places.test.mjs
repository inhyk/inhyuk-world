import test from 'node:test';
import assert from 'node:assert/strict';
import {PLACES,schoolZoneAt,SCHOOL_LIMIT} from './places.mjs';
import {stepTraffic,cleanSave} from './core.mjs';
import {Journey} from './journey.mjs';
import {Enforcement} from './police.mjs';
const node=()=>({position:{x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}},rotation:{},dispose(){},setEnabled(){},isEnabled(){return true;}});
function setup(){const save=cleanSave({durability:{mint:60},coins:123});const j=new Journey({p:{x:3,z:-15,yaw:0,speed:0,gear:'D'},world:node(),central:node(),solids:[],makeCar:node,node,box:node,cyl:node,camera:node(),selected:'mint',conditions:save.durability});return {j,save};}
test('school zone detection follows floating origins and leaves ordinary roads unrestricted',()=>{
 assert.equal(schoolZoneAt({x:3,z:-58}),true);assert.equal(schoolZoneAt({x:3,z:-15}),false);assert.equal(schoolZoneAt({x:73,z:24}),false);
 assert.equal(schoolZoneAt({x:-957,z:-58},{x:4n,z:0n}),true);assert.equal(schoolZoneAt({x:3,z:-58},{x:99999999999999999999n,z:0n}),false);
});
test('all four places are selectable and travelling preserves ownership, coins and damage',()=>{
 const {j,save}=setup();for(const place of PLACES){assert.equal(j.travel(place.id,'mint'),true);assert.equal(j.p.x,place.x);assert.ok(Math.abs(j.p.z-place.z)<=6);assert.equal(j.occupied.durability,60);assert.equal(save.coins,123);assert.equal(j.p.speed,0);}
 const p={...j.p};assert.equal(j.travel('unknown','mint'),false);assert.deepEqual(j.p,p);
});
test('travelling while sharing an origin leaves the other driver and the shared origin alone',()=>{
 const {j}=setup();const friend={p:{x:30,z:30}};j.actors.push(friend);j.stream.origin={x:4n,z:0n};j.travel('beach','mint');assert.equal(j.p.x,73-960);assert.deepEqual(friend.p,{x:30,z:30});assert.equal(j.stream.origin.x,4n);
});
test('traffic slows to 30km/h without changing its original cruise speed',()=>{
 const v={x:3,z:-50,yaw:0,auto:true,cruise:11,speed:11,durability:100};for(let i=0;i<60;i++)stepTraffic(v,.05,{player:{x:100,z:100},walking:false,vehicles:[],seconds:0,speedLimit:SCHOOL_LIMIT});assert.ok(v.speed<=SCHOOL_LIMIT);assert.equal(v.cruise,11);
});
test('school speeding summons police after a grace period; slowing down and police immunity work',()=>{
 const {j,save}=setup();j.p.x=3;j.p.z=-44;j.p.speed=12;
 const law=new Enforcement({save,persist(){},toast(){},journey:j,world:node(),node,box:node,cyl:node,makeCar:node,material(){return {};}});
 for(let i=0;i<8;i++)law.step(.05,0,{...j.p},true);assert.equal(save.wanted,false);
 j.p.speed=8;law.step(.05,0,{...j.p},true);assert.equal(law.schoolSpeeding,0);
 j.p.speed=12;for(let i=0;i<12;i++)law.step(.05,0,{...j.p},true);assert.equal(save.wanted,true);
 j.occupied.model='police';law.step(.05,0,{...j.p},true);assert.equal(save.wanted,false);assert.equal(law.schoolSpeeding,0);
});
