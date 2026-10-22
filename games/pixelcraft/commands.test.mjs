import test from 'node:test';
import assert from 'node:assert/strict';
import { runCommand } from '../../public/play/pixelcraft/commands.mjs';
import { makeJumpWorld, jumpSpawn, newJumpState } from '../../public/play/pixelcraft/jump-world.mjs';
import { B, I, durabilityOf } from '../../public/play/pixelcraft/data.mjs';
const state = () => ({ w: makeJumpWorld(42), player: { ...jumpSpawn(), w: .6, h: 1.8, spawn: jumpSpawn(), inv: Array(36).fill(null) }, mode: 'survival', time: 0, day: 1 });
test('아이템 이름·한글·숫자와 수량을 해석하고 도구 내구도를 채운다', () => {
 const G=state();
 for (const command of ['/give diamond 64','/give @s minecraft:diamond_sword 1','/give 돌 3',`/give ${B.GLASS} 5`]) assert.ok(runCommand(G,command).ok,command);
 assert.equal(G.player.inv[0].count,64);
 const sword=G.player.inv.find(s=>s?.id===I.DIAMOND_SWORD); assert.equal(sword.dur,durabilityOf(I.DIAMOND_SWORD));
 for (const command of ['/give diamond -3','/give diamond 2305','/give missing','/tp Infinity 2','/tp -1 30','/tp 520 62']) assert.equal(runCommand(G,command).ok,false,command);
 G.player.inv.fill({id:B.STONE,count:64}); assert.equal(runCommand(G,'/give diamond').changed,false);
});
test('상대 좌표 이동·모드·회복·시간·난이도가 실제 상태를 바꾼다',()=>{
 const G=state(), x=G.player.x;
 assert.ok(runCommand(G,'/tp ~3 ~-2').ok); assert.equal(G.player.x,x+3);
 assert.ok(runCommand(G,'/spawn').ok); assert.equal(G.player.x,x);
 assert.ok(runCommand(G,'/gamemode creative').ok); assert.equal(G.mode,'creative');
 runCommand(G,'/heal'); assert.equal(G.player.hp,20);
 runCommand(G,'/time set night'); assert.equal(G.time,.65);
 for (const cmd of ['50day','/50day','/day 50']) { G.day=1; assert.ok(runCommand(G,cmd).ok); assert.equal(G.day,50); }
 runCommand(G,'/difficulty hard'); assert.equal(G.diff,2);
 assert.equal(runCommand(G,'/help').changed,false);
});
test('체크포인트는 점프맵에서만 이동하며 잘못된 번호와 세계 설정을 거절한다',()=>{
 const G=state(); assert.equal(runCommand(G,'/checkpoint 1').ok,false);
 G.jump=newJumpState(); assert.ok(runCommand(G,'/checkpoint 3').ok); assert.equal(G.jump.checkpoint,45); assert.equal(G.player.x,jumpSpawn(45).x);
 assert.equal(runCommand(G,'/checkpoint 5').ok,false); assert.equal(runCommand(G,'/time night').ok,false);
});
