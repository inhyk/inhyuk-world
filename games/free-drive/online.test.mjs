import test from 'node:test';
import assert from 'node:assert/strict';
import {Journey} from './journey.mjs';
import {WorldStream} from './world.mjs';
import {normaliseCode,safeInput,roomCode} from './room.mjs';
const node=()=>({position:{x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}},rotation:{},dispose(){},setEnabled(){},isEnabled(){return true;}});
function pair(){
 const params={world:node(),central:node(),solids:[],makeCar:node,node,box:node,cyl:node,camera:node(),selected:'mint'};
 const host=new Journey({...params,p:{x:3,z:-15,yaw:0,speed:0,gear:'D'}});
 const guest=new Journey({...params,p:{x:3,z:-25,yaw:0,speed:0,gear:'D'},shared:host});
 return {host,guest};
}
test('room codes and wire input are constrained',()=>{
 for(let i=0;i<20;i++)assert.match(roomCode(),/^[A-HJ-NP-Z2-9]{6}$/);
 assert.equal(normaliseCode(' ab cd ef!'), 'ABCDEF');
 assert.deepEqual(safeInput({gas:'yes',brake:true,steer:999}),{gas:false,brake:true,steer:0});
});
test('two drivers share one traffic pool and cannot board an occupied or reserved car',()=>{
 const {host,guest}=pair();assert.equal(host.vehicles,guest.vehicles);assert.equal(host.stream,guest.stream);assert.equal(host.vehicles.length,34);
 guest.interact();guest.p.x=host.p.x+3;guest.p.z=host.p.z;
 assert.notEqual(guest.near,host.occupied);
 guest.p.x=10;guest.p.z=-15;guest.interact();assert.equal(guest.occupied.id,'parked-coupe');
 host.interact();host.p.x=13;host.p.z=-15;assert.notEqual(host.near,guest.occupied);
});
test('floating origin shifts both drivers exactly once and protects the other owned car',()=>{
 const {host,guest}=pair();host.p.x=1000;guest.p.x=1010;
 host.update(.01,{gas:false,brake:true,steer:0},0);
 assert.equal(host.p.x,40);assert.equal(guest.p.x,50);assert.equal(host.stream.origin.x,4n);
 assert.equal(guest.own.x,3-960);
});
test('resetting one driver does not reset the friend, traffic or shared origin',()=>{
 const {host,guest}=pair();guest.p.z=100;const before={...host.p};guest.reset('mint');
 assert.deepEqual(host.p,before);assert.equal(guest.p.z,-25);assert.equal(host.vehicles.length,34);
});
test('cuffed player cars cannot accelerate, and releasing cuffs restores driving',()=>{
 const {guest}=pair();guest.occupied.cuffed=true;const input={gas:true,brake:false,steer:0};guest.update(.05,input,0);assert.equal(guest.p.z,-25);
 guest.occupied.cuffed=false;guest.update(.05,input,.1);assert.ok(guest.p.z> -25);
});
test('terrain stays loaded around both players and remains bounded',()=>{
 const stream=new WorldStream({node,box:node,cyl:node});stream.updateMany([{x:0,z:0},{x:2400,z:2400}]);
 assert.equal(stream.chunks.size,17);assert.ok(stream.chunks.has('10,10'));assert.ok(stream.chunks.has('1,0'));
 stream.updateMany([{x:4800,z:4800},{x:2400,z:2400}]);assert.equal(stream.chunks.size,18);assert.equal(stream.chunks.has('1,0'),false);
});
