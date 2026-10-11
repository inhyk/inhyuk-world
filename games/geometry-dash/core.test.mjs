import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, SIZE, createGame, jump, tick, retry, collides, releaseJump } from '../../public/play/geometry-dash/core.mjs';
const step = (g, seconds, held=false) => {for(let i=0;i<seconds*120;i++)tick(g,1/120,held);};
test('jump is grounded only, lands, and pause freezes physics', () => {
  const g=createGame();g.mode='playing';assert.ok(jump(g));step(g,.1);assert.ok(g.y>0);assert.equal(jump(g),false);
  step(g,.7);assert.equal(g.y,0);g.mode='paused';const before={...g};step(g,1);assert.deepEqual(g,before);
});
test('triangle corners are forgiving and block top is landable', () => {
  const g=createGame();const o={x:100,w:34,h:36,type:'spike'};g.x=100;assert.ok(collides(g,o));g.y=40;assert.equal(collides(g,o),false);
  g.mode='playing';g.x=100;g.y=61;g.vy=-100;g.obstacles=[{x:90,w:80,h:56,type:'block'}];step(g,.06);assert.equal(g.mode,'playing');assert.equal(g.y,56);
});
test('collision, retry and practice checkpoint reset correctly', () => {
  const g=createGame();g.mode='playing';step(g,4);assert.equal(g.mode,'dead');retry(g);assert.equal(g.x,0);assert.equal(g.attempts,2);
  g.practice=true;g.checkpoint=2000;retry(g);assert.equal(g.x,2000);assert.equal(g.y,0);
});
test('every extreme track has a complete route through unmodified physics', () => {
  for(let level=0;level<3;level++) {
    const initial=createGame(level,true);initial.mode='playing';
    let frontier=[initial], winner;
    // Explore distinct reachable jump phases at 120 Hz. Every state uses real jump/tick.
    for(let frame=0;frame<18000 && !winner;frame++) {
      const next=new Map();
      for(const g of frontier) for(const press of [0,1,2]) {
        const candidate={...g};
        if(press===1 && !jump(candidate))continue;
        if(press===2) { if(candidate.vy<470 || candidate.vy>490)continue; releaseJump(candidate); }
        tick(candidate,1/120);
        if(candidate.mode==='won'){winner=candidate;break;}
        if(candidate.mode==='dead')continue;
        const key=`${candidate.y.toFixed(3)}:${candidate.vy.toFixed(3)}`;
        if(!next.has(key))next.set(key,candidate);
      }
      frontier=[...next.values()];
      assert.ok(winner || frontier.length,`level ${level} has an impossible section at frame ${frame}`);
    }
    assert.equal(winner?.mode,'won');assert.ok(winner.checkpoint>0);
  }
});
test('holding jump continuously cannot beat any extreme track', () => {
  for(let level=0;level<3;level++) {
    const g=createGame(level);g.mode='playing';step(g,70,true);
    assert.equal(g.mode,'dead');assert.ok(g.x<LEVELS[level].length*.3);
  }
});
test('new tracks are faster, denser and require substantially more jumps', () => {
  const oldSpeeds=[300,350,390];
  for(let i=0;i<3;i++) {
    const g=createGame(i);
    assert.ok(LEVELS[i].speed>=oldSpeeds[i]*1.4);
    assert.ok(g.obstacles.filter(o=>o.type==='spike').length>100);
    assert.ok(g.obstacles.some(o=>o.type==='block'));
  }
});

test('release shortens the jump, and ceiling collisions respect the player height', () => {
 const high=createGame(),low=createGame();high.mode=low.mode='playing';jump(high);jump(low);
 step(high,.12);step(low,.12);releaseJump(low);step(high,.12);step(low,.12);assert.ok(high.y>low.y+20);
 const roof={x:100,w:200,bottom:130,h:48,type:'ceiling'};low.x=high.x=120;low.y=90;high.y=110;
 assert.equal(collides(low,roof),false);assert.equal(collides(high,roof),true);
});
