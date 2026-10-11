import { test } from 'node:test';
import assert from 'node:assert/strict';
import {SONGS,compose,judge,newRun,hit,expire,accuracy,releaseHold,updateHolds} from '../../public/play/pulse-rush/core.mjs';
test('ten distinct compositions have playable charts synchronized to melody',()=>{
 assert.equal(SONGS.length,10);const signatures=new Set();
 for(const s of SONGS){const c=compose(s);assert.ok(c.duration>30&&c.duration<65);assert.ok(c.notes.length>=96);assert.ok(c.events.length>600);signatures.add(JSON.stringify(c.notes));const unique=new Set();
 for(const n of c.notes){assert.ok(n.lane>=0&&n.lane<4);assert.ok(n.time>=2&&n.time<c.duration-1);assert.ok(c.events.some(e=>e.voice==='lead'&&Math.abs(e.time-n.time)<1e-8));assert.ok(!unique.has(`${n.time}:${n.lane}`));unique.add(`${n.time}:${n.lane}`);}
 assert.deepEqual(compose(s),c);
 }assert.equal(signatures.size,10);
});
test('all five timing judgments include correct positive and negative boundaries',()=>{
 for(const sign of [-1,1])for(const [delta,name] of [[0,'PERFECT'],[.045,'PERFECT'],[.046,'GREAT'],[.09,'GREAT'],[.091,'GOOD'],[.14,'GOOD'],[.141,'BAD'],[.2,'BAD'],[.201,'MISS']])assert.equal(judge(delta*sign),name);
});
test('wrong lane and repeated hits cannot score; combo breaks on BAD and MISS',()=>{
 const r=newRun({notes:[{time:2,lane:0},{time:3,lane:1},{time:4,lane:2},{time:5,lane:3}]});assert.equal(hit(r,1,2),null);assert.equal(hit(r,0,2),'PERFECT');assert.equal(hit(r,0,2),null);assert.equal(hit(r,1,3.07),'GREAT');assert.equal(r.combo,2);assert.equal(hit(r,2,4.18),'BAD');assert.equal(r.combo,0);assert.equal(expire(r,5.21),true);assert.equal(r.counts.MISS,1);expire(r,6);assert.equal(r.counts.MISS,1);assert.equal(r.maxCombo,2);assert.equal(r.score,1850);
});
test('every chart supports a perfect completion, including simultaneous chords',()=>{
 for(const song of SONGS){const c=compose(song),r=newRun(c);for(const n of c.notes){updateHolds(r,n.time,new Set(r.notes.filter(x=>x.holding&&!x.judgment).map(x=>x.lane)));assert.equal(hit(r,n.lane,n.time),n.endTime?'HOLD':'PERFECT');}updateHolds(r,c.duration,new Set(r.notes.filter(x=>x.holding&&!x.judgment).map(x=>x.lane)));expire(r,c.duration+1);assert.equal(r.counts.MISS,0);assert.equal(r.maxCombo,c.notes.length);assert.equal(accuracy(r),100);}
});
test('entire unattended songs expire once with zero score',()=>{for(const s of SONGS){const c=compose(s),r=newRun(c);expire(r,c.duration);assert.equal(r.counts.MISS,c.notes.length);assert.equal(accuracy(r),0);assert.equal(r.combo,0);}});
test('the 200ms hit boundary is not expired prematurely',()=>{const r=newRun({notes:[{time:2,lane:0}]});expire(r,2.2);assert.equal(hit(r,0,2.2),'BAD');});

test('every song includes sustained notes without same-lane conflicts',()=>{for(const s of SONGS){const c=compose(s),holds=c.notes.filter(n=>n.endTime);assert.ok(holds.length>=6);for(const n of holds){assert.ok(n.endTime>n.time+.4);assert.ok(!c.notes.some(other=>other!==n&&other.lane===n.lane&&other.time>n.time&&other.time<=n.endTime+.2));}}});
test('hold scores once at the end, preserving the head judgment',()=>{const r=newRun({notes:[{time:2,lane:0,endTime:3}]});assert.equal(hit(r,0,2.07),'HOLD');assert.equal(r.score,0);expire(r,2.8);assert.equal(r.counts.MISS,0);assert.deepEqual(updateHolds(r,2.9,new Set([0])),[]);assert.equal(updateHolds(r,3,new Set([0]))[0].result,'GREAT');assert.equal(r.score,750);assert.equal(r.combo,1);assert.equal(releaseHold(r,0,3.1),null);assert.equal(r.counts.GREAT,1);});
test('early release and lost input fail a hold; repress cannot rescue it',()=>{for(const lostInput of [false,true]){const r=newRun({notes:[{time:2,lane:0,endTime:3}]});hit(r,0,2);if(lostInput)assert.equal(updateHolds(r,2.5,new Set())[0].result,'BAD');else assert.equal(releaseHold(r,0,2.5),'BAD');assert.equal(hit(r,0,2.6),null);assert.equal(r.combo,0);assert.equal(r.counts.BAD,1);expire(r,10);assert.equal(r.counts.MISS,0);}});
test('simultaneous holds are independent and support pause regrab grace',()=>{const r=newRun({notes:[{time:2,lane:0,endTime:3},{time:2,lane:1,endTime:3.5}]});hit(r,0,2);hit(r,1,2);for(const n of r.notes)n.resumeGrace=2.8;assert.deepEqual(updateHolds(r,2.5,new Set()),[]);assert.equal(hit(r,0,2.6),'HOLD');assert.equal(updateHolds(r,2.9,new Set([0]))[0].result,'BAD');assert.equal(updateHolds(r,3,new Set([0]))[0].result,'PERFECT');assert.equal(r.counts.BAD,1);assert.equal(r.counts.PERFECT,1);});
