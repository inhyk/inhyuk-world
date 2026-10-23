import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {encodePackets,SnapshotReader,cleanInput,CHUNK_SIZE,MAX_CHUNKS} from '../../public/play/pixelcraft/online-codec.mjs';
test('online snapshots split below relay limit and preserve Unicode, high block IDs and enchants',async()=>{
 const value={full:true,name:'친구의 세계',tiles:[0,255,1170],inv:[{id:501,enchants:{sharpness:5}}],noise:randomBytes(30000).toString('base64')};
 const packets=await encodePackets(value,1);assert.ok(packets.length>1);
 const reader=new SnapshotReader();let out;for(const packet of packets){assert.ok(Buffer.byteLength(JSON.stringify({type:'data',data:packet,to:'some-peer-id'}))<16384);out=await reader.push(packet);}
 assert.deepEqual(out,value);assert.equal(await reader.push(packets[0]),null);
 const next=await encodePackets({full:false,delta:[10,1170,0,0]},2);assert.deepEqual(await reader.push(next[0]),{full:false,delta:[10,1170,0,0]});
});
test('online rejects missing, oversized, corrupt and out of order snapshot chunks',async()=>{
 const r=new SnapshotReader(),parts=await encodePackets({noise:randomBytes(30000).toString('base64')},1);
 await assert.rejects(()=>r.push(parts[1]));r.reset();await r.push(parts[0]);await assert.rejects(()=>r.push(parts[2]));
 for(const m of [{...parts[0],total:MAX_CHUNKS+1},{...parts[0],data:'x'.repeat(CHUNK_SIZE+1)},{...parts[0],data:'!!!'},{...parts[0],total:1,data:'AAAA'}])await assert.rejects(()=>new SnapshotReader().push(m));
});
test('guest input permits controls but rejects arbitrary positions, inventory and commands',()=>{
 const valid={keys:['KeyD','Space','KeyD'],sel:2,target:{x:640,y:40},left:true,right:false};
 assert.deepEqual(cleanInput({...valid,x:999999,inv:[1],command:'/give'}),{...valid,keys:['KeyD','Space']});
 for(const v of [{...valid,keys:['KeyT']},{...valid,sel:9},{...valid,target:{x:NaN,y:40}},{...valid,target:{x:1280,y:40}},{...valid,target:{x:5,y:160}},{...valid,keys:Array(8).fill('KeyD')}])assert.equal(cleanInput(v),null);
 assert.deepEqual(cleanInput({...valid,target:null}),{...valid,keys:['KeyD','Space'],target:null});
});
