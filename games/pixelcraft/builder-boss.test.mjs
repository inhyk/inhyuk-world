import test from 'node:test';
import assert from 'node:assert/strict';
import {B,isSolid} from '../../public/play/pixelcraft/data.mjs';
import {idx,moveBody} from '../../public/play/pixelcraft/core.mjs';
import {makeBuildWorld,guideCells,guideProgress,initBuildGuide,tickBuildGuide,BLUEPRINTS,selectGuide,builtRocket,stopGuide,guideActive,isBuildWorld} from '../../public/play/pixelcraft/build-guide.mjs';
import {portalFrame,makeEnd,portalIntact} from '../../public/play/pixelcraft/adventure-world.mjs';
test('활성 포탈은 틀을 유지하면서 실제 물리 이동으로 옆에서 걸어 들어갈 수 있다',()=>{
 for(const kind of['nether','end','ending']){
  const w=makeBuildWorld(42),p={...portalFrame(w,640,87,kind),kind};assert.ok(portalIntact(w,p));
  const e={x:637,y:86.2,w:.6,h:1.8,vx:4,vy:0,step:true,onGround:true};
  for(let k=0;k<50;k++){e.vx=4;moveBody(w,e,.02);}assert.ok(e.x>640,`${kind}: ${e.x}`);
  assert.equal(isSolid(w.tiles[idx(639,86)],w.meta[idx(639,86)]),false);
  assert.equal(isSolid(B.OBSIDIAN,0),true);assert.equal(isSolid(B.END_FRAME,0),true);
 }
});
test('엔드의 자연 기둥은 장식으로 통과하지만 바닥과 플레이어의 보통 블록은 단단하다',()=>{
 const w=makeEnd(1234),x=680,y=w.surface[x]-4;
 assert.equal(w.tiles[idx(x,y)],B.OBSIDIAN);assert.equal(isSolid(w.tiles[idx(x,y)],w.meta[idx(x,y)]),false);
 assert.equal(isSolid(w.tiles[idx(x,w.surface[x])],0),true);assert.equal(isSolid(B.PURPUR,0),true);
});
test('건축 그림은 재료를 정확히 세고 실제 블록 일치로 완성하며 보상 기록은 한 번만 남는다',()=>{
 const G={w:makeBuildWorld(42),player:{inv:Array(36).fill(null)}};initBuildGuide(G);let saves=0;
 for(let plan=0;plan<BLUEPRINTS.length;plan++){
  G.builder.plan=plan;const cells=guideCells(G);const p=guideProgress(G);assert.equal([...p.needs.values()].reduce((a,b)=>a+b,0),p.missing.length);
  for(const c of cells)G.w.tiles[idx(c.x,c.y)]=c.id;
  assert.equal(guideProgress(G).done,cells.length);tickBuildGuide(G,()=>{},()=>saves++);tickBuildGuide(G,()=>{},()=>saves++);
 }
 assert.deepEqual(G.builder.completed,BLUEPRINTS.map((_,i)=>i));assert.equal(saves,BLUEPRINTS.length);
});

test('우주선은 건축 세계에서 실제 설계를 완성해야 탈 수 있고 다른 그림을 골라도 남는다',()=>{
 const G={w:makeBuildWorld(42),player:{inv:Array(36).fill(null)},adventure:{dimension:'overworld'}};initBuildGuide(G);selectGuide(G,2);
 assert.equal(builtRocket(G),null);const cells=guideCells(G);for(const c of cells)G.w.tiles[idx(c.x,c.y)]=c.id;
 assert.ok(builtRocket(G));selectGuide(G,4);assert.ok(builtRocket(G));
 const c=cells.find(c=>c.id===B.GLASS);G.w.tiles[idx(c.x,c.y)]=B.AIR;assert.equal(builtRocket(G),null);
 G.adventure.dimension='moon';assert.equal(selectGuide(G,0),false);
});

test('야생 그림 선택과 안 하기는 재료·위치·난이도·지형과 완성한 우주선을 보존한다',()=>{
 const G={w:makeBuildWorld(19),mode:'survival',diff:2,player:{x:610,y:86.2,inv:[{id:B.DIRT,count:7}]},adventure:{dimension:'overworld'}};
 const before=JSON.stringify(G.player),tiles=G.w.tiles.slice();
 assert.equal(builtRocket(G),null);selectGuide(G,2);
 assert.equal(isBuildWorld(G),false);assert.equal(guideActive(G),true);assert.equal(G.mode,'survival');assert.equal(G.diff,2);assert.equal(JSON.stringify(G.player),before);assert.deepEqual(G.w.tiles,tiles);
 const cells=guideCells(G);for(const c of cells)G.w.tiles[idx(c.x,c.y)]=c.id;const rocket=builtRocket(G);assert.ok(rocket);
 selectGuide(G,8);assert.deepEqual(builtRocket(G),rocket);assert.ok(Math.abs(G.builder.x-cells[0].x)>=15);
 stopGuide(G);assert.equal(guideActive(G),false);assert.deepEqual(builtRocket(G),rocket);selectGuide(G,2);assert.equal(guideActive(G),true);assert.equal(guideProgress(G).missing.length,0);
 assert.equal(JSON.stringify(G.player),before);
});
