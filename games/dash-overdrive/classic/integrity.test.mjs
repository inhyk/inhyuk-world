import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=new URL('../../../public/play/dash-overdrive/classic/',import.meta.url);
const read=path=>readFileSync(new URL(path,root));
const provenance=JSON.parse(read('provenance.json'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
// Compare multisets, so duplicated objects must match too. Keys 1..6 encode
// object ID, X, Y, horizontal flip, vertical flip and rotation.
function placements(text){return text.split(';').slice(1).filter(Boolean).map(row=>{
 const fields=row.split(','),obj={};for(let i=0;i<fields.length;i+=2)obj[fields[i]]=fields[i+1];
 return [1,2,3,4,5,6].map(key=>Number(obj[key]||0)).join(',');
}).sort();}
for(const map of provenance.maps)test(`original level ${map.level}: every object position, flip and rotation`,()=>{
 const reference=gunzipSync(readFileSync(new URL(`reference-${map.level}.txt.gz`,import.meta.url))).toString();
 const actual=read(`maps/${map.level}.level`);
 assert.equal(hash(actual),map.sha256);
 assert.equal(placements(actual.toString()).length,map.objects);
 assert.deepEqual(placements(actual.toString()),placements(reference));
 if(map.playable){
  const packed=read('engine/GDClone.data').subarray(map.nativeOffset,map.nativeEnd);
  assert.deepEqual(packed,actual);
 }
});
test('local engine package integrity and MIT attribution',()=>{
 const data=read('engine/GDClone.data'),wasm=read('engine/GDClone.wasm');
 assert.equal(data.length,provenance.packageBytes);
 assert.equal(hash(data),provenance.packageSha256);
 assert.equal(hash(wasm),provenance.wasmSha256);
 assert.equal(wasm.subarray(0,4).toString(),'\0asm');
 assert.match(read('engine/LICENSE.txt').toString(),/MIT License/);
});
test('every packaged audio file is the same generated silent clip',()=>{
 const js=read('engine/GDClone.js').toString();
 const audio=[...js.matchAll(/\{filename:"([^\"]+\.ogg)",start:(\d+),end:(\d+)\}/g)]
  .map(([,filename,start,end])=>({filename,start:Number(start),end:Number(end)}));
 assert.ok(audio.length>=7);
 const data=read('engine/GDClone.data');
 const clip=data.subarray(audio[0].start,audio[0].end);
 assert.ok(clip.length<5000);
 for(const file of audio)assert.deepEqual(data.subarray(file.start,file.end),clip,file.filename);
});
