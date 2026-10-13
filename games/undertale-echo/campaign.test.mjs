import test from 'node:test';
import assert from 'node:assert/strict';
import '../../public/play/undertale-echo/campaign.mjs';
import { ROOMS, ROOM_NAMES, SCRIPTS, createWorld, serialize, restore, passable } from '../../public/play/undertale-echo/world.mjs';
import { createPlayer } from '../../public/play/undertale-echo/core.mjs';
import { DETAILS, detailsFor } from '../../public/play/undertale-echo/details.mjs';
function play(script,p,answers=[]){const gen=SCRIPTS[script]({player:p,room:ROOMS.echo_terminal});const requests=[];let result;for(let i=0;i<200;i++){const step=gen.next(result);if(step.done)return requests;requests.push(step.value);result=step.value.type==='choice'?(answers.shift()??0):step.value.type==='battle'?{ended:'spare'}:undefined;}throw Error('Script did not finish');}
function signals(p){for(let i=1;i<=4;i++)p.flags['signal'+i]=true;return p;}
test('20 new rooms have valid dimensions, scripts, exits and a complete round trip',()=>{
 assert.equal(Object.keys(ROOMS).length,20);assert.equal(DETAILS.length,20);
 for(const r of Object.values(ROOMS)){
  assert.equal(r.tiles.length,15);assert.ok(r.tiles.every(row=>row.length===20));assert.ok(ROOM_NAMES[r.id]);
  for(const e of Object.values(r.exits))assert.ok(ROOMS[e.room]);
  for(const e of r.events)assert.ok(SCRIPTS[e.script]);
  for(const n of r.npcs)if(n.script)assert.ok(SCRIPTS[n.script]);
  const solid=new Set(detailsFor(r).filter(d=>d.solid).map(d=>`${d.x},${d.y}`));
  const flags={[r.id+'_switch']:true};const queue=[[1,7]],seen=new Set();
  while(queue.length){const [x,y]=queue.shift(),key=`${x},${y}`;if(seen.has(key)||x<0||y<0||x>=20||y>=15||solid.has(key)||!passable(r,x,y,flags))continue;seen.add(key);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])queue.push([x+dx,y+dy]);}
  if(r.exits.right)assert.ok(seen.has('19,7'),r.id+' exit inaccessible');
  if(r.box)assert.ok(seen.has('4,10'),r.id+' switch area inaccessible');
  for(const d of detailsFor(r)) assert.ok([[d.x-1,d.y],[d.x+1,d.y],[d.x,d.y-1],[d.x,d.y+1]].some(([x,y])=>seen.has(`${x},${y}`)),r.id+' memory inaccessible');
  for(let y=0;y<15;y++)for(let x=0;x<20;x++)if(r.tiles[y][x]==='S')assert.ok(seen.has(`${x},${y}`),r.id+' save inaccessible');
 }
});
test('each puzzle is blocked until its switch and its switch can be reached',()=>{for(const r of Object.values(ROOMS).filter(r=>r.box)){assert.equal(passable(r,12,7,{}),false);assert.equal(passable(r,12,7,{[r.id+'_switch']:true}),true);assert.equal(r.tiles[10][4],'x');}});
test('new saves restore the new campaign, inventory and signals',()=>{const p=signals(createPlayer('별'));const w=createWorld(p);assert.equal(w.room.id,'echo_arrival');const saved=JSON.parse(JSON.stringify(serialize(w)));const next=restore(saved);assert.equal(next.room.id,'echo_arrival');assert.equal(next.player.flags.signal4,true);});
test('ghost can be revisited after declining; listening grants a lasting bond',()=>{const p=createPlayer('별');play('echo_ghost',p,[1]);assert.ok(!p.flags.echoGhost);play('echo_ghost',p,[0]);assert.equal(p.flags.echoGhost,true);});
test('water offered after the guard battle grants friendship',()=>{const p=createPlayer('별');play('echo_guard',p,[0]);assert.equal(p.flags.echoWater,true);assert.equal(p.flags.signal3,true);});
test('final gate rejects missing signals',()=>{const events=play('echo_final',createPlayer('별'));assert.ok(!events.some(e=>e.type==='ending'||e.type==='battle'));});
test('all bonds and no kills lead through Asriel to the everyone-home ending',()=>{const p=signals(createPlayer('별'));Object.assign(p.flags,{papyrusFriend:true,echoWater:true,echoGhost:true});const events=play('echo_final',p,[0]);assert.equal(events.find(e=>e.type==='battle').enemies[0],'asriel');assert.equal(events.at(-1).kind,'pacifist');});
test('a missed bond leads through Flowey to the neutral ending',()=>{const events=play('echo_final',signals(createPlayer('별')),[0]);assert.equal(events.find(e=>e.type==='battle').enemies[0],'flowey');assert.equal(events.at(-1).kind,'neutral');});
test('leaving alone does not force a boss fight',()=>{const events=play('echo_final',signals(createPlayer('별')),[1]);assert.ok(!events.some(e=>e.type==='battle'));assert.equal(events.at(-1).kind,'neutral');});
test('empty world leads to its distinct ending',()=>{const p=signals(createPlayer('별'));p.flags.echoDark=true;assert.equal(play('echo_final',p,[0]).at(-1).kind,'genocide');});

test('transformed bosses still count toward the dark journey and trigger Sans',()=>{const p=createPlayer('별');p.kills=24;p.bossFate={toriel:'killed',papyrus:'killed',undying:'killed',neo:'killed'};const events=play('echo_judge',p);assert.equal(events.find(e=>e.type==='battle').enemies[0],'sans');assert.equal(p.flags.echoDark,true);});
test('sparing one gatekeeper prevents the dark journey even after many kills',()=>{const p=createPlayer('별');p.kills=24;p.bossFate={toriel:'killed',papyrus:'spared',undying:'killed',neo:'killed'};assert.ok(!play('echo_judge',p).some(e=>e.type==='battle'));assert.ok(!p.flags.echoDark);});
