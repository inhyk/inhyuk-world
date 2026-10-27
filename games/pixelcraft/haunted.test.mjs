import test from 'node:test';import assert from 'node:assert/strict';
import {B} from '../../public/play/pixelcraft/data.mjs';
import {idx,generateWorld} from '../../public/play/pixelcraft/core.mjs';
import {newAdventure} from '../../public/play/pixelcraft/adventure.mjs';
import {upgradeHaunted,hauntedStrength} from '../../public/play/pixelcraft/haunted.mjs';
function world(seed=1234){const G={w:generateWorld(seed),chests:new Map(),player:{inv:Array(36).fill(null),armor:[],spawn:{x:640,y:40}}};newAdventure(G);return G;}
test('안개 숲은 여러 시드에서 실제 지형·검은 나무·거미줄·묘비를 만들고 재생성하지 않는다',()=>{
 for(const seed of[1234,1,44,2026,777]){const G=world(seed),h=G.adventure.halloween.haunted;assert.ok(h.trees.length>=3);assert.ok(h.stones.length>=1);const t=h.trees[0];assert.equal(G.w.tiles[idx(t.x,t.y-4)],B.DARK_OAK_LOG);assert.equal(G.w.tiles[idx(t.x-2,t.y-t.height+3)],B.COBWEB);assert.ok([B.PODZOL,B.MYCELIUM].includes(G.w.tiles[idx(t.x,t.y)]));G.w.tiles[idx(t.x,t.y-4)]=B.AIR;const before=G.w.tiles.slice();upgradeHaunted(G);assert.deepEqual(G.w.tiles,before);}
});
test('이전 할로윈 저장에 숲을 추가할 때 플레이어 건축·배경·메타와 다른 차원을 보존한다',()=>{
 const G=world(),p=G.adventure.halloween.haunted;G.w=generateWorld(1234);G.adventure.villagers=[];G.adventure.halloween={version:1,sites:[]};const h=G.adventure.halloween,i=idx(p.x,G.w.surface[p.x]-3);G.w.tiles[i]=B.DIAMOND_BLOCK;G.w.meta[i]=7;G.w.bg[i]=B.GOLD_BLOCK;
 const overworld=G.w,nether=generateWorld(9),before=nether.tiles.slice();G.adventure.worlds.overworld={w:overworld,villagers:G.adventure.villagers,chests:G.chests};G.adventure.dimension='nether';G.w=nether;upgradeHaunted(G);
 assert.equal(overworld.tiles[i],B.DIAMOND_BLOCK);assert.equal(overworld.meta[i],7);assert.equal(overworld.bg[i],B.GOLD_BLOCK);assert.deepEqual(nether.tiles,before);assert.equal(h.terrainVersion,1);assert.ok(h.haunted?.trees.length);
});
test('안개와 보랏빛 하늘은 해당 숲 주변 지상에서만 나타난다',()=>{
 const G=world(),h=G.adventure.halloween.haunted;G.cam={x:h.x,y:G.w.surface[h.x]-4};assert.equal(hauntedStrength(G),1);G.cam.x=h.start-20;assert.equal(hauntedStrength(G),0);G.cam={x:h.x,y:G.w.surface[h.x]+20};assert.equal(hauntedStrength(G),0);G.cam.y=20;G.adventure.dimension='nether';assert.equal(hauntedStrength(G),0);
});
