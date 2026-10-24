import {chromium} from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.PIXELCRAFT_ARTIFACTS||'artifacts/pixelcraft-interactions-20261024';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1280,height:760}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const ev=(fn,arg)=>page.evaluate(fn,arg);
try{
 await page.goto(process.env.PIXELCRAFT_TEST_URL||'http://127.0.0.1:3063/play/pixelcraft/index.html');
 await page.waitForFunction(()=>window.__pixelcraft);
 await ev(async()=>{
  const A=window.__pixelcraft,G=A.newGame({seed:1234,mode:'creative',diff:0,slot:0,name:'블록 상호작용 확인'});
  G.adventure.storySeen=true;A.startGame(G);G.paused=true;G.mobs=[];
  for(let x=632;x<659;x++){for(let y=40;y<50;y++)A.setTile(x,y,0);A.setTile(x,50,3);}
  G.player.x=640;G.player.y=48.2;G.player.inv.fill(null);
 });
 const doors=await ev(async()=>{
  const A=window.__pixelcraft,G=A.G,{B,MC_BLOCK_IDS,isSolid}=await import('./data.mjs');
  const results=[];
  for(const key of ['cherry_door','copper_door','bamboo_trapdoor','cherry_fence_gate']){
   const id=MC_BLOCK_IDS[key];G.player.inv[0]={id,count:64};G.player.sel=0;
   const placed=A.placeBlock(643,49,id);G.target={x:643,y:49};A.doUse();
   const open=!isSolid(id,G.w.meta[49*A.W+643]);
   // Upper half can also close a tall door.
   G.target={x:643,y:key.endsWith('_door')?48:49};A.doUse();
   const closed=isSolid(id,G.w.meta[49*A.W+643]);
   A.breakBlock(643,key.endsWith('_door')?48:49);
   results.push({key,placed,open,closed,removed:G.w.tiles[49*A.W+643]===0&&G.w.tiles[48*A.W+643]===0});
  }
  return results;
 });
 for(const r of doors)for(const k of ['placed','open','closed','removed'])assert.equal(r[k],true,`${r.key}: ${k}`);
 for(const key of ['barrel','red_shulker_box','trapped_chest','hopper','dispenser']){
  await ev(async key=>{const A=window.__pixelcraft,G=A.G,{MC_BLOCK_IDS,I}=await import('./data.mjs');G.player.inv[0]={id:I.DIAMOND,count:7};A.setTile(643,49,MC_BLOCK_IDS[key]);G.target={x:643,y:49};A.doUse();},key);
  assert.equal(await ev(()=>window.__pixelcraft.UI.open),'chest');
  await page.click('[data-s="i:0"]');await page.click('[data-s="c:0"]');
  assert.equal(await ev(()=>window.__pixelcraft.G.chests.get(49*1280+643)[0].count),7);
  await ev(()=>{const A=window.__pixelcraft;A.closePanel();A.breakBlock(643,49);});
  assert.equal(await ev(()=>window.__pixelcraft.G.chests.has(49*1280+643)),false);
 }
 const states=await ev(async()=>{
  const A=window.__pixelcraft,G=A.G,{B,I,blockLight}=await import('./data.mjs');
  A.setTile(643,49,B.LEVER);A.setTile(644,49,B.REDSTONE_LAMP);G.target={x:643,y:49};A.doUse();
  const lit=blockLight(B.REDSTONE_LAMP,G.w.meta[49*A.W+644]);A.doUse();
  const dark=blockLight(B.REDSTONE_LAMP,G.w.meta[49*A.W+644]);
  A.setTile(643,49,B.CAKE);G.player.food=6;
  for(let k=0;k<7;k++)A.doUse();
  const eaten=G.player.food===20&&G.w.tiles[49*A.W+643]===B.AIR;
  A.setTile(643,49,B.CAMPFIRE);A.doUse();const extinguished=G.w.meta[49*A.W+643]===1;
  G.player.inv[0]={id:I.FLINT_STEEL,count:1,dur:20};G.player.sel=0;A.doUse();
  const relit=G.w.meta[49*A.W+643]===0;
  A.setTile(643,49,B.ANVIL);G.player.inv[0]={id:I.IRON_PICK,count:1,dur:2,enchants:{efficiency:2}};
  G.mode='survival';A.doUse();const unpaid=G.player.inv[0].dur===2;
  G.player.inv[1]={id:I.IRON_INGOT,count:1};A.doUse();const repaired=G.player.inv[0].dur>2&&!G.player.inv[1];
  A.setTile(643,49,B.SMITHING_TABLE);G.player.inv[1]={id:I.DIAMOND,count:1};A.doUse();
  const upgraded=G.player.inv[0].id===I.DIAMOND_PICK&&G.player.inv[0].enchants.efficiency===2&&!G.player.inv[1];
  A.setTile(643,49,B.GRINDSTONE);A.doUse();const ground=!G.player.inv[0].enchants;
  A.setTile(643,49,B.AIR);A.setTile(644,49,B.AIR);G.player.face=1;G.player.inv[0]={id:B.RED_BED,count:1};G.mode='creative';
  const bedPlaced=A.placeBlock(643,49,B.RED_BED);G.target={x:644,y:49};G.time=.8;A.doUse();const slept=G.time===.1;
  A.breakBlock(644,49);const bedRemoved=G.w.tiles[49*A.W+643]===0;
  A.setTile(643,49,B.NOTE_BLOCK);G.target={x:643,y:49};A.doUse();const music=G.w.meta[49*A.W+643]===1;
  G.mode='creative';G.paused=false;
  return {lit,dark,eaten,extinguished,relit,unpaid,repaired,upgraded,ground,slept,bedPlaced,bedRemoved,music};
 });
 assert.equal(states.lit,15);assert.equal(states.dark,0);
 for(const k of ['eaten','extinguished','relit','unpaid','repaired','upgraded','ground','slept','bedPlaced','bedRemoved','music'])assert.equal(states[k],true,k);
 // Let the normal world loop really smelt an ore in the new furnace.
 await ev(async()=>{const A=window.__pixelcraft,G=A.G,{B,I}=await import('./data.mjs');A.setTile(643,49,B.BLAST_FURNACE);G.target={x:643,y:49};A.doUse();A.closePanel();G.furnaces.get(49*A.W+643).slots=[{id:B.DEEPSLATE_IRON_ORE,count:1},{id:I.COAL,count:1},null];});
 await page.waitForFunction(()=>window.__pixelcraft.G.furnaces.get(49*1280+643)?.slots[2],null,{timeout:8000});
 assert.equal(await ev(()=>window.__pixelcraft.G.furnaces.get(49*1280+643).slots[2].count),1);
 // Online panel requests use the same classification and reject wrong block kinds.
 const replay=await ev(async()=>{
  const A=window.__pixelcraft,G=A.G,{B}=await import('./data.mjs'),{replayPanelAction}=await import('./ui.mjs');
  A.setTile(643,49,B.BARREL);replayPanelAction({op:'open',kind:'chest',ref:49*A.W+643});const valid=A.UI.open==='chest';A.closePanel();
  replayPanelAction({op:'open',kind:'furnace',ref:49*A.W+643});const rejected=!A.UI.open;
  G.chests.get(49*A.W+643)[0]={id:104,count:9,enchants:{fortune:2}};
  A.setTile(645,49,B.CHERRY_DOOR,1);A.setTile(645,48,B.CHERRY_DOOR,5);
  A.saveGame(true);return {valid,rejected};
 });assert.equal(replay.valid,true);assert.equal(replay.rejected,true);
 await page.reload();await page.click('#slots .play >> nth=0');
 const saved=await ev(()=>{const A=window.__pixelcraft,G=A.G;G.paused=true;return{count:G.chests.get(49*A.W+643)[0].count,open:!!(G.w.meta[49*A.W+645]&1),half:!!(G.w.meta[48*A.W+645]&4)};});
 assert.deepEqual(saved,{count:9,open:true,half:true});
 await ev(()=>{const A=window.__pixelcraft;A.G.target={x:643,y:49};A.doUse();});
 await page.screenshot({path:`${out}/barrel-desktop.png`});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/barrel-mobile.png`});
 await page.setViewportSize({width:1280,height:760});
 await ev(()=>{const A=window.__pixelcraft;A.closePanel();A.G.paused=false;});
 await page.waitForTimeout(150);
 const point=await ev(()=>{const G=window.__pixelcraft.G,v=G.view,c=document.getElementById('game'),r=c.width/c.clientWidth;return{x:(643.5-v.left)*v.T/r,y:(49.5-v.top)*v.T/r};});
 await page.mouse.click(point.x,point.y,{button:'right'});
 await page.waitForFunction(()=>window.__pixelcraft.UI.open==='chest');
 await ev(()=>window.__pixelcraft.closePanel());
 await page.mouse.move(1000,100);await page.screenshot({path:`${out}/world-open-door.png`});
 assert.deepEqual(errors,[]);console.log('PASS: door/gate placement, both halves, collision/removal; 5 container variants and drops; lamp switches, cake, flames; anvil cost, smithing, grindstone; colored bed; real furnace tick; online panel validation; save/reload; desktop/mobile; no page errors');
}catch(e){await page.screenshot({path:`${out}/FAILED.png`});throw e;}finally{await browser.close();}
