import test from 'node:test';import assert from 'node:assert/strict';
import {B,I,ITEMS} from '../../public/play/pixelcraft/data.mjs';
import {W,idx,generateWorld,countItem} from '../../public/play/pixelcraft/core.mjs';
import {makeVillage,portalFrame,populateVillageChests} from '../../public/play/pixelcraft/adventure-world.mjs';
import {upgradeHalloween,halloweenState,halloweenMissions,craftHalloween,claimHalloween} from '../../public/play/pixelcraft/halloween.mjs';
function oldWorld(seed=1234){const G={w:generateWorld(seed),chests:new Map(),player:{inv:Array(36).fill(null)},adventure:{dimension:'overworld',villagers:[],worlds:{}}};for(const x of[705,425,1150])G.adventure.villagers.push(...makeVillage(G.w,x));portalFrame(G.w,742,G.w.surface[742]-1);return G;}
test('할로윈은 다섯 지형의 마을·먹거리와 더 많은 호박·특별 나무를 생성한다',()=>{
 const G=oldWorld();populateVillageChests(G);upgradeHalloween(G);const h=halloweenState(G);
 assert.deepEqual([...new Set(G.adventure.villagers.map(v=>G.w.biome[Math.floor(v.x)]))].sort(),[0,1,2,3,4]);assert.deepEqual(h.food.map(v=>v.biome).sort(),[0,1,2,3,4]);assert.ok(h.sites.length>=20);assert.ok(h.trees.length>0);
 for(const site of h.food){const slots=G.chests.get(idx(site.x,site.y));assert.ok(slots.some(s=>s&&ITEMS[s.id].food));}
 for(const v of G.adventure.villagers){const x=Math.round(v.x-1.8),y=Math.round(v.y-.2);assert.equal(G.w.tiles[idx(x,y)],B.DOOR_B);}
 const before=G.w.tiles.slice(),chests=structuredClone([...G.chests]);upgradeHalloween(G);assert.deepEqual(G.w.tiles,before);assert.deepEqual([...G.chests],chests);
});
test('이전 세계의 건축·상자·지형 수정을 보존하고 파괴한 축제 장식은 재생성하지 않는다',()=>{
 const natural=oldWorld();upgradeHalloween(natural);const site=natural.adventure.halloween.villages[0],G=oldWorld(),i=idx(site.x,site.y-3);
 G.w.tiles[i]=B.DIAMOND_BLOCK;G.w.meta[i]=7;G.w.bg[i]=B.GOLD_BLOCK;G.chests.set(i,[{id:I.DIAMOND,count:10}]);upgradeHalloween(G);
 assert.equal(G.w.tiles[i],B.DIAMOND_BLOCK);assert.equal(G.w.meta[i],7);assert.equal(G.w.bg[i],B.GOLD_BLOCK);assert.deepEqual(G.chests.get(i),[{id:I.DIAMOND,count:10}]);
 const p=G.adventure.halloween.sites[0],j=idx(p.x,p.y);G.w.tiles[j]=B.AIR;upgradeHalloween(G);assert.equal(G.w.tiles[j],B.AIR);
});
test('다른 차원에서도 보관된 숲 세계만 업그레이드한다',()=>{
 const old=oldWorld(),w=generateWorld(10),before=w.tiles.slice(),G={w,player:old.player,adventure:{dimension:'nether',worlds:{overworld:{w:old.w,chests:old.chests,villagers:old.adventure.villagers}}}};
 upgradeHalloween(G);assert.equal(halloweenState(G).version,1);assert.deepEqual(w.tiles,before);assert.ok(G.adventure.worlds.overworld.chests.size>0);
});
test('제작법은 실제 재료를 소비하고 부족하거나 가방이 가득하면 물건을 잃지 않는다',()=>{
 const G=oldWorld();G.player.inv[0]={id:B.PUMPKIN,count:3};G.player.inv[1]={id:B.TORCH,count:3};halloweenMissions(G);
 for(let k=0;k<3;k++)assert.equal(craftHalloween(G,B.JACK).ok,true);
 assert.equal(countItem(G.player.inv,[B.JACK]),3);assert.equal(countItem(G.player.inv,[B.PUMPKIN]),0);assert.equal(halloweenState(G).crafted,3);assert.equal(halloweenState(G).collected,3);assert.equal(craftHalloween(G,B.JACK).ok,false);
 G.player.inv=Array.from({length:36},()=>({id:B.STONE,count:64}));G.player.inv[0]={id:B.PUMPKIN,count:64};G.player.inv[1]={id:B.TORCH,count:64};const before=structuredClone(G.player.inv);assert.equal(craftHalloween(G,B.JACK).ok,false);assert.deepEqual(G.player.inv,before);
});
test('미션 보상은 완료 후 한 번만 받고 가방 부족 실패는 재시도할 수 있다',()=>{
 const G=oldWorld(),h=halloweenState(G);assert.equal(claimHalloween(G).ok,false);Object.assign(h,{collected:3,crafted:3,placed:3});
 G.player.inv=Array.from({length:36},()=>({id:B.STONE,count:64}));assert.equal(claimHalloween(G).ok,false);assert.equal(h.claimed,false);
 G.player.inv[0]=null;G.player.inv[1]=null;assert.equal(claimHalloween(G).ok,true);assert.equal(countItem(G.player.inv,[I.DIAMOND]),3);assert.equal(countItem(G.player.inv,[I.GOLDEN_APPLE]),3);assert.equal(claimHalloween(G).ok,false);assert.equal(countItem(G.player.inv,[I.DIAMOND]),3);
});
