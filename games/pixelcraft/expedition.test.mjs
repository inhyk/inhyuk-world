import test from 'node:test';
import assert from 'node:assert/strict';
import { B,I } from '../../public/play/pixelcraft/data.mjs';
import { W,H,SEA,BIOME,generateWorld,idx,stepFluid,wake,findSpawn } from '../../public/play/pixelcraft/core.mjs';
import { makeMoon,makeSchool,landingPad,END_TREASURES,upgradeWaters } from '../../public/play/pixelcraft/expedition-world.mjs';
import { makeEnd } from '../../public/play/pixelcraft/adventure-world.mjs';
import { populateEnd } from '../../public/play/pixelcraft/end-exploration.mjs';
import { bookPages,updateJournal } from '../../public/play/pixelcraft/journal.mjs';
test('바다와 지역별 작은 웅덩이는 깊이와 크기가 다르며 시작점은 마른 땅이다',()=>{
 for(const seed of[1,1234,98765]){
  const w=generateWorld(seed);assert.equal(w.biome[160],BIOME.OCEAN);assert.ok(w.surface[160]>SEA+12);assert.equal(w.tiles[idx(160,SEA)],B.WATER);
  assert.notEqual(w.tiles[idx(W/2,w.surface[W/2])],B.WATER);
  for(const x of[300,530,965])assert.equal(w.tiles[idx(x,w.surface[x]-1)],B.WATER);
 }
});
test('시작 지점 왼쪽 물웅덩이는 얕고 바닥·둑이 막혀 있으며 물이 새지 않는다',()=>{
 for(const seed of [1,1234,98765,123,9876,42,99,20261024]){
  const w=generateWorld(seed),levels=[];
  for(let y=0;y<H;y++)if(w.tiles[idx(620,y)]===B.WATER)levels.push(y);
  assert.equal(levels.length,3);const top=levels[0];
  for(let x=615;x<=625;x++){
   assert.equal(w.tiles[idx(x,top)],B.WATER);assert.equal(w.meta[idx(x,top)],8);
   assert.notEqual(w.tiles[idx(x,w.surface[x])],B.AIR);
  }
  for(const x of[614,626])assert.ok(w.surface[x]<top);
  const sp=findSpawn(w);assert.equal(Math.floor(sp.x),640);
  const active=new Set();for(let x=614;x<=626;x++)for(let y=top-1;y<=top+4;y++)wake(active,idx(x,y));
  const before=w.tiles.slice();for(let k=0;k<40;k++)stepFluid(w,B.WATER,active);
  for(let x=614;x<=626;x++)for(let y=top-1;y<=top+4;y++)assert.equal(w.tiles[idx(x,y)],before[idx(x,y)]);
 }
});
test('이전 세계의 새 웅덩이는 수정 안 한 곳에만 추가하고 흙 건축·채굴·보관함을 보존한다',()=>{
 const fresh=generateWorld(1234),old=generateWorld(1234,{nearbyPond:false});
 upgradeWaters(old,{nearSpawnOnly:true});
 assert.equal(old.tiles[idx(620,fresh.surface[620]-1)],B.WATER);
 for(const change of ['dirt','mine','chest']){
  const w=generateWorld(1234,{nearbyPond:false}),i=idx(620,w.surface[620]-1);
  if(change==='mine')w.tiles[idx(620,w.surface[620]+1)]=B.AIR;
  else w.tiles[i]=change==='dirt'?B.DIRT:B.CHEST;
  const before=w.tiles.slice(),meta=w.meta.slice(),bg=w.bg.slice();upgradeWaters(w,{nearSpawnOnly:true});
  assert.deepEqual(w.tiles,before);assert.deepEqual(w.meta,meta);assert.deepEqual(w.bg,bg);
 }
});
test('달의 크레이터와 운석은 저장 가능한 블록이며 착륙장은 서 있을 공간이 있다',()=>{
 const w=makeMoon(1234),r=landingPad(w,640);assert.ok(w.tiles.includes(B.MOON_STONE));assert.ok(w.tiles.includes(B.METEOR_ORE));
 assert.equal(w.tiles[idx(640,r.y)],B.STONE_BRICKS);assert.equal(w.tiles[idx(640,r.y-5)],B.AIR);assert.equal(w.tiles[idx(640,H-1)],B.BEDROCK);
});
test('엔드 바깥 섬의 상자는 재진입 때 보충되지 않는다',()=>{
 const G={w:makeEnd(1234),adventure:{dimension:'end'},chests:new Map()};populateEnd(G);assert.equal(G.chests.size,3);
 for(const p of END_TREASURES)assert.equal(G.w.tiles[idx(p.x,p.y)],B.CHEST);
 G.chests.clear();populateEnd(G);assert.equal(G.chests.size,0);
});
test('차원별 책의 목표와 완료 기록은 분리되고 재료를 써도 완료 기록이 남는다',()=>{
 const G={adventure:{dimension:'overworld',visited:[],achievements:[]},player:{x:640,y:60,inv:[{id:B.OAK_LOG,count:1}],armor:[]}};
 updateJournal(G);assert.ok(G.adventure.journal.includes('wood'));G.player.inv=[];
 assert.ok(bookPages(G,I.OVERWORLD_BOOK).some(p=>p.includes('◆ 완료')&&p.includes('나무')));
 assert.ok(bookPages(G,I.NETHER_BOOK).some(p=>p.includes('블레이즈')));assert.ok(bookPages(G,I.END_BOOK).some(p=>p.includes('탑')));
});
test('학교에는 실물 교실·책상·창문이 있고, 바다 이주는 기존 건축물을 보존한다',()=>{
 const s=makeSchool(1234);assert.equal(s.tiles[idx(626,85)],B.PLANKS);assert.equal(s.bg[idx(636,77)],B.GLASS);
 const w=generateWorld(1234);w.tiles[idx(150,60)]=B.GOLD_BLOCK;upgradeWaters(w);assert.equal(w.tiles[idx(150,60)],B.GOLD_BLOCK);
});
