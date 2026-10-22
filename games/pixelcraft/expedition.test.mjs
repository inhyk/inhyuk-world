import test from 'node:test';
import assert from 'node:assert/strict';
import { B,I } from '../../public/play/pixelcraft/data.mjs';
import { W,H,SEA,BIOME,generateWorld,idx } from '../../public/play/pixelcraft/core.mjs';
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
