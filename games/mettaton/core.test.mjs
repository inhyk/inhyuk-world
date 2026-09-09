import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, start, choose, strike, beginRound, finishRound, update, canHurt, ARENA, getPatterns, getPattern, DIFFICULTIES } from '../../public/play/mettaton/core.mjs';
function advance(s, seconds, input = {}) { for(let i=0;i<Math.ceil(seconds*60);i++)update(s,1/60,input); }
function menu(difficulty='normal') {const s=createState(difficulty);start(s);advance(s,3);assert.equal(s.mode,'menu');return s;}
test('start, timing attack, enemy turn, and player turn form a complete loop',()=>{
  const s=menu();choose(s,'fight');advance(s,.675);strike(s);
  assert.equal(s.lastStrike,'PERFECT!');assert.ok(s.bossHp>=7910 && s.bossHp<8000);assert.equal(s.ratings,650);
  advance(s,1.8);assert.equal(s.mode,'dodge');
  // A declared invulnerability window isolates the turn clock from damage here.
  s.player.invincible=20;advance(s,10);
  assert.equal(s.mode,'menu');assert.equal(s.turn,1);assert.equal(s.bullets.length,0);assert.equal(s.shots.length,0);
});
test('blue is safe when still; orange is safe only when actually moving',()=>{
  assert.equal(canHurt({color:'blue'},false),false);assert.equal(canHurt({color:'blue'},true),true);
  assert.equal(canHurt({color:'orange'},true),false);assert.equal(canHurt({color:'orange'},false),true);
  const s=menu();beginRound(s);s.player.x=ARENA.x+8;s.player.invincible=0;
  s.bullets=[{kind:'bar',x:ARENA.x,y:ARENA.y,w:20,h:ARENA.h,vx:0,vy:0,color:'orange',age:0,ttl:1}];
  update(s,1/60,{left:true});assert.equal(s.player.moving,false);assert.equal(s.hp,s.maxHp-s.config.damage);
});
test('stacked bullets deal one hit and respect the damage cooldown',()=>{
  const s=menu();beginRound(s);s.player.invincible=0;
  s.bullets=Array.from({length:20},()=>({x:s.player.x,y:s.player.y,vx:0,vy:0,r:8,kind:'star',color:'pink',age:0,ttl:5}));
  update(s,1/60);assert.equal(s.hits,1);assert.equal(s.hp,36);
  advance(s,.5);assert.equal(s.hits,1);
});
test('pausing freezes all clocks, projectiles, HP, and input movement',()=>{
  const s=menu();beginRound(s);advance(s,2);s.paused=true;
  const snapshot=JSON.stringify(s);advance(s,10,{right:true,shoot:true});assert.equal(JSON.stringify(s),snapshot);
});
test('diagonal speed is normalized and the soul stays inside the arena',()=>{
  const s=menu();beginRound(s);const x=s.player.x,y=s.player.y;update(s,.05,{up:true,right:true});
  assert.ok(Math.abs(Math.hypot(s.player.x-x,s.player.y-y)-11)<.001);
  for(let i=0;i<100;i++)update(s,.05,{up:true,right:true});
  assert.ok(s.player.x<=ARENA.x+ARENA.w-8);assert.ok(s.player.y>=ARENA.y+8);
});
test('parfaits are finite, capped at maximum HP, and empty inventory does not consume a turn',()=>{
  const s=menu();s.hp=20;choose(s,'item');assert.equal(s.hp,40);assert.equal(s.items,2);
  s.mode='menu';s.items=0;const rating=s.ratings;choose(s,'item');advance(s,3);
  assert.equal(s.mode,'menu');assert.equal(s.items,0);assert.equal(s.ratings,rating);assert.equal(s.turn,0);
});
test('a boast pays out only after a no-hit round, and dancing heals',()=>{
  const s=menu();choose(s,'boast');beginRound(s);finishRound(s);assert.equal(s.ratings,1850);
  choose(s,'boast');beginRound(s);s.roundHits=1;finishRound(s);assert.equal(s.ratings,2500);
  s.hp=10;choose(s,'dance');assert.equal(s.hp,16);assert.equal(s.ratings,2900);
});
test('mercy requires 10,000 ratings and leads to the audience ending',()=>{
  const s=menu();choose(s,'mercy');assert.notEqual(s.mode,'won');advance(s,3);assert.equal(s.mode,'menu');
  s.ratings=10000;choose(s,'mercy');assert.equal(s.mode,'won');assert.equal(s.ending,'audience');
});
test('a final timing attack and a yellow-soul core shot both finish the boss',()=>{
  const a=menu();a.bossHp=100;choose(a,'fight');advance(a,.675);strike(a);assert.equal(a.mode,'won');assert.equal(a.ending,'fight');
  const b=menu();b.turn=2;beginRound(b);b.bossHp=20;
  b.shots=[{x:560,y:425,vy:-480,life:1}];update(b,1/60);assert.equal(b.mode,'won');assert.equal(b.ending,'fight');
});
test('shooting destroys bombs before their timed explosion',()=>{
  const s=menu();s.turn=5;beginRound(s);
  s.bullets=[{x:560,y:475,vx:0,vy:0,r:13,hp:1,kind:'bomb',color:'white',age:0,ttl:5,fuse:2}];
  s.shots=[{x:560,y:483,vy:-480,life:1}];update(s,1/60);
  assert.equal(s.bullets.length,0);assert.equal(s.ratings,100);
});
test('death and restart clear combat state while preserving chosen difficulty',()=>{
  const s=menu('hard');beginRound(s);s.hp=1;s.player.invincible=0;
  s.bullets=[{x:s.player.x,y:s.player.y,vx:0,vy:0,r:8,kind:'star',color:'pink',age:0,ttl:2}];update(s,1/60);
  assert.equal(s.mode,'lost');assert.equal(s.hp,0);assert.equal(s.bullets.length,0);
  const fresh=createState('hard');assert.equal(fresh.hp,32);assert.equal(fresh.turn,0);assert.equal(fresh.items,3);assert.equal(fresh.ratings,0);
});
for(const difficulty of Object.keys(DIFFICULTIES))test(`all boss patterns complete with finite, bounded entities (${difficulty})`,()=>{
  for(let p=0;p<getPatterns(createState(difficulty)).length;p++){
    const s=menu(difficulty);s.turn=p;beginRound(s);s.player.invincible=30;
    let maxBullets=0;
    for(let i=0;i<900&&s.mode==='dodge';i++){
      update(s,1/60,{shoot:true,left:i%240<120,right:i%240>=120});
      maxBullets=Math.max(maxBullets,s.bullets.length);
      for(const b of s.bullets)assert.ok([b.x,b.y,b.vx,b.vy,b.age].every(Number.isFinite),`${p}: finite projectile`);
    }
    assert.equal(s.mode,'menu',`pattern ${p} finishes`);assert.ok(maxBullets>0&&maxBullets<150,`pattern ${p}: ${maxBullets} bullets`);
    assert.equal(s.bullets.length,0);assert.equal(s.turn,p+1);
  }
});
test('EX difficulties visibly differ in first-wave density, speed and spawn cadence',()=>{
  const stats=['easy','normal','hard'].map(difficulty=>{
    const s=menu(difficulty);beginRound(s);s.player.invincible=20;
    while(s.spawnIndex===0)update(s,1/60);
    const firstWave=s.bullets.length,speed=Math.max(...s.bullets.map(b=>b.vy));
    while(s.roundTime<4)update(s,1/60);
    return {firstWave,speed,waves:s.spawnIndex,hp:s.maxHp,damage:s.config.damage};
  });
  for(let i=1;i<stats.length;i++){
    assert.ok(stats[i].firstWave>stats[i-1].firstWave);
    assert.ok(stats[i].speed>stats[i-1].speed*1.4);
    assert.ok(stats[i].waves>stats[i-1].waves);
    assert.ok(stats[i].hp<stats[i-1].hp);
    assert.ok(stats[i].damage>stats[i-1].damage);
  }
});
test('higher difficulty leaves fewer safe lanes and shorter laser warnings',()=>{
  const first=['easy','normal','hard'].map(difficulty=>{
    const s=menu(difficulty);s.turn=3;beginRound(s);
    while(s.spawnIndex===0)update(s,1/60);
    return {count:s.bullets.length,warning:s.bullets[0].delay};
  });
  assert.deepEqual(first.map(s=>s.count),[2,3,4]);
  assert.ok(first[0].warning>first[1].warning && first[1].warning>first[2].warning);
});
test('NEO has its own boss, four yellow-soul patterns and a separate rating goal',()=>{
  const s=menu('neo');assert.equal(s.boss,'neo');assert.equal(s.bossHp,16000);
  assert.equal(getPatterns(s).length,4);
  for(let i=0;i<4;i++){s.turn=i;beginRound(s);assert.equal(getPattern(s).yellow,true);assert.equal(getPattern(s).core,true);}
  s.mode='menu';s.ratings=10000;choose(s,'mercy');assert.notEqual(s.mode,'won');
  s.mode='menu';s.ratings=18000;choose(s,'mercy');assert.equal(s.mode,'won');
});
