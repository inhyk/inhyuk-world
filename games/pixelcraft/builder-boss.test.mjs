import test from 'node:test';
import assert from 'node:assert/strict';
import {B,isSolid} from '../../public/play/pixelcraft/data.mjs';
import {idx,moveBody} from '../../public/play/pixelcraft/core.mjs';
import {makeBuildWorld,guideCells,guideProgress,initBuildGuide,tickBuildGuide,BLUEPRINTS} from '../../public/play/pixelcraft/build-guide.mjs';
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
 assert.deepEqual(G.builder.completed,[0,1]);assert.equal(saves,2);
});
