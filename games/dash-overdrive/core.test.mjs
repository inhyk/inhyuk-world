import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TRACKS,LENGTH,createRun,press,restart,update} from '../../public/play/dash-overdrive/core.mjs';
const step=(g,n,held=false)=>{for(let i=0;i<n;i++)update(g,1/120,held);};
test('cube jump, collision, retry and pause use actual physics',()=>{
 const g=createRun();g.state='playing';assert.ok(press(g));step(g,20);assert.ok(g.y>0);assert.equal(press(g),false);g.state='paused';const x=g.x;step(g,20);assert.equal(g.x,x);restart(g);step(g,400);assert.equal(g.state,'dead');restart(g);assert.equal(g.x,0);assert.equal(g.attempt,3);
});
test('ship portal transforms and hold/release controls altitude',()=>{
 const g=createRun();g.state='playing';g.x=2560;step(g,10);assert.equal(g.form,'ship');const y=g.y;step(g,20,true);assert.ok(g.y>y);step(g,80,false);assert.ok(g.vy<0);
});
test('practice restart retains transformation and safe checkpoint',()=>{
 const g=createRun(0,true);g.state='playing';g.x=2560;step(g,10);assert.equal(g.checkpointForm,'ship');restart(g);assert.equal(g.x,g.checkpoint);assert.equal(g.form,'ship');assert.equal(g.y,205);
});
test('all three full courses are beatable with jump, pad and flight controls',()=>{
 for(let level=0;level<TRACKS.length;level++){
  const g=createRun(level);g.state='playing';const forms=new Set();
  for(let frame=0;frame<6000&&g.state==='playing';frame++){
   let held=false;
   if(g.form==='cube') {const next=g.objects.find(o=>['spike','block'].includes(o.type)&&o.x+o.w>g.x+6);if(next&&next.x>g.x&&next.x-g.x<125)press(g);}
   else {const next=g.objects.find(o=>o.type==='wall'&&o.x+o.w>g.x);held=g.y+g.vy*.16<(next?next.h+TRACKS[level].gap/2-16:205);}
   update(g,1/120,held);forms.add(g.form);
  }
  assert.equal(g.state,'won',`track ${level} failed at ${g.x}`);assert.ok(g.x>=LENGTH);assert.ok(forms.has('ship'));assert.ok(g.padCount>=2);assert.ok(g.gems>0);
 }
});
test('holding a single input does not automatically complete a course',()=>{const g=createRun();g.state='playing';step(g,6000,true);assert.equal(g.state,'dead');});


test('hard edition raises speed, spike density and narrows every flight corridor',()=>{
 for(let level=0;level<TRACKS.length;level++) {
  const g=createRun(level),walls=g.objects.filter(o=>o.type==='wall');
  assert.ok(TRACKS[level].speed>=[420,500,580][level]);
  assert.ok(g.objects.filter(o=>o.type==='spike').length>=15);
  assert.equal(walls.length,10);
  for(const wall of walls){const roof=g.objects.find(o=>o.type==='roof'&&o.x===wall.x);assert.equal(Math.round(roof.bottom-wall.h),TRACKS[level].gap);assert.ok(roof.bottom-wall.h<=180.000001);}
 }
});
