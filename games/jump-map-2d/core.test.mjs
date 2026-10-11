import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,makeCourse,step,platformAt,respawn} from '../../public/play/jump-map-2d/core.mjs';

test('all ten stages are reachable with normal movement and all 50 stars can be collected',()=>{
 const course=makeCourse(),s=createState();let target=1;
 for(let n=0;n<20000&&!s.finished;n++){
  if(s.grounded)target=Math.max(target,s.ground+1);
  const p=platformAt(course.platforms[Math.min(target,course.platforms.length-1)],s.tick),x=p.x+p.w/2-s.w/2;
  step(s,{right:s.x<x-14,left:s.x>x+14,jump:s.grounded&&s.ground<target},1/120,course);
  if(s.events.includes('spring'))target=s.ground+1;
 }
 assert.equal(s.finished,true);assert.equal(s.checkpoint,9);assert.equal(s.deaths,0);assert.equal(s.stars.length,50);
});

test('falling restores the last checkpoint and preserves collected stars',()=>{
 const s=createState();s.checkpoint=4;s.stars=[1,3];s.y=800;
 step(s,{},1/120,makeCourse());
 assert.equal(s.x,5670);assert.equal(s.deaths,1);assert.deepEqual(s.stars,[1,3]);
});

test('respawn clears pending jumps and crumbling platforms',()=>{
 const s=createState();s.buffer=.1;s.coyote=.1;s.crumbles={2:1};respawn(s);
 assert.equal(s.buffer,0);assert.equal(s.coyote,0);assert.deepEqual(s.crumbles,{});
});
