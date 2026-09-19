import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ORES,GOAL,initial,strike,descend,sell,upgrade,cost,capacity,restore,oreAt,power,interval,hardness,targets} from './core.mjs';
const total=s=>s.bag.reduce((a,b)=>a+b,0);
const breakBlock=(s,col)=>{let swings=0;while(!s.dug.includes(col)&&swings<100){strike(s,col);swings++;}return swings;};
test('each mineral appears at its planned depth, never before',()=>{for(let i=0;i<8;i++){assert.ok(Array.from({length:9},(_,c)=>oreAt(ORES[i].depth,c)).includes(i));for(let d=1;d<ORES[i].depth;d++)for(let c=0;c<9;c++)assert.ok(oreAt(d,c)<i);}});
test('a block cracks progressively and yields ore only after its final hit',()=>{const s=initial();for(let i=1;i<=4;i++){const hit=strike(s,4);assert.equal(hit[0].broken,false);assert.equal(s.damage[4],i*20);assert.equal(total(s),0);assert.equal(s.found[0],0);}assert.equal(strike(s,4)[0].broken,true);assert.equal(total(s),1);assert.equal(s.found[0],1);assert.deepEqual(strike(s,4),[]);assert.equal(total(s),1);});
test('partial cracks persist per block, survive save reload, and reset on descent',()=>{const s=initial();strike(s,4);strike(s,1);const loaded=restore(JSON.stringify(s));assert.equal(loaded.damage[4],20);assert.equal(loaded.damage[1],20);assert.equal(descend(loaded),false);breakBlock(loaded,4);assert.ok(descend(loaded));assert.equal(loaded.depth,2);assert.deepEqual(loaded.damage,Array(9).fill(0));});
test('strength reduces time to break independently of swing speed',()=>{const base=initial(),strong=initial(),fast=initial();strong.money=10000;fast.money=10000;assert.ok(upgrade(strong,'strength'));assert.ok(upgrade(fast,'speed'));assert.equal(interval(strong),interval(base));assert.equal(power(fast),power(base));assert.ok(interval(fast)<interval(base));assert.ok(breakBlock(strong,4)*interval(strong)<breakBlock(base,4)*interval(base));for(let i=1;i<4;i++)upgrade(strong,'strength');assert.ok(power(strong)<100,'fresh blocks still require multiple hits at max strength');});
test('larger shovel damages nearest blocks without overfilling inventory',()=>{const s=initial();s.levels.shovel=1;assert.equal(targets(s,4).length,3);strike(s,4);assert.equal(s.damage.filter(Boolean).length,3);assert.equal(total(s),0);s.bag[0]=capacity(s)-1;for(let i=0;i<10;i++)strike(s,4);assert.equal(total(s),capacity(s));assert.equal(s.dug.length,1);assert.deepEqual(strike(s,4),[]);});
test('selling, upgrades, and goal preserve accounting and caps',()=>{const s=initial();assert.equal(upgrade(s,'strength'),false);s.bag[7]=10;assert.equal(sell(s),GOAL);assert.equal(s.won,true);assert.equal(sell(s),0);const before=s.money,price=cost(s,'strength');assert.ok(upgrade(s,'strength'));assert.equal(s.money,before-price);assert.equal(upgrade(s,'unknown'),false);for(let i=0;i<6;i++)upgrade(s,'strength');assert.equal(s.levels.strength,4);});
test('legacy saves retain money, equipment and discoveries',()=>{const legacy=initial();legacy.version=1;delete legacy.levels.strength;delete legacy.damage;legacy.money=1250;legacy.depth=80;legacy.levels.speed=2;legacy.found[0]=9;legacy.dug=[2];const s=restore(JSON.stringify(legacy));assert.equal(s.version,2);assert.equal(s.money,1250);assert.equal(s.depth,80);assert.equal(s.levels.speed,2);assert.equal(s.levels.strength,0);assert.equal(s.found[0],9);assert.deepEqual(s.dug,[2]);assert.deepEqual(s.damage,Array(9).fill(0));});
test('malformed progress is rejected without crashing',()=>{for(const raw of [null,'null','bad','{}',JSON.stringify({...initial(),bag:[-1]}),JSON.stringify({...initial(),damage:Array(9).fill(Infinity)}),JSON.stringify({...initial(),levels:{shovel:0,speed:0,bag:0,strength:99}})])assert.deepEqual(restore(raw),initial());const s=initial();s.damage[0]=hardness(s,0);assert.deepEqual(restore(JSON.stringify(s)),initial());assert.deepEqual(strike(initial(),-1),[]);});

test('walking stays on the mine, diagonal motion is normalized, and release stops it',async()=>{
 const {spawnPlayer,movePlayer}=await import('./movement.mjs');const s=initial();const straight=spawnPlayer(),diagonal=spawnPlayer();
 movePlayer(straight,1,0,.1,s);movePlayer(diagonal,1,1,.1,s);
 assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.z+3.02)-straight.x)<1e-9);
 const before={...straight};movePlayer(straight,0,0,.1,s);assert.equal(straight.x,before.x);assert.equal(straight.z,before.z);assert.equal(straight.moving,false);
 for(let i=0;i<1000;i++)movePlayer(straight,1,1,.1,s);assert.equal(straight.x,2.06);assert.equal(straight.z,2.06);
 for(let i=0;i<1000;i++)movePlayer(straight,-1,-1,.1,s);assert.equal(straight.x,-2.06);assert.equal(straight.z,-3.12);
});
test('walking finds unmined nearby blocks and follows mined floor height',async()=>{
 const {spawnPlayer,movePlayer,nearestBlock}=await import('./movement.mjs');const s=initial(),p=spawnPlayer();assert.equal(nearestBlock(s,p),1);
 p.x=0;p.z=0;assert.equal(nearestBlock(s,p),4);
 for(let i=0;i<20;i++)movePlayer(p,0,0,.1,s);assert.equal(p.y,.7);
 s.dug=[4];assert.notEqual(nearestBlock(s,p),4);for(let i=0;i<20;i++)movePlayer(p,0,0,.1,s);assert.equal(p.y,-.7);
 s.dug=[0,1,2,3,4,5,6,7,8];assert.equal(nearestBlock(s,p),null);
});
