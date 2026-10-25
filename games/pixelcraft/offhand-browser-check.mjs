import {chromium} from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.PIXELCRAFT_ARTIFACTS||'/tmp/pixelcraft-offhand';await fs.mkdir(out,{recursive:true});
const b=await chromium.launch(),p=await b.newPage({viewport:{width:1280,height:760}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
 await p.goto(process.env.PIXELCRAFT_TEST_URL||'http://127.0.0.1:3066/play/pixelcraft/');await p.waitForFunction(()=>window.__pixelcraft);
 await p.click('#slots .play >> nth=0');await p.fill('#nwSeed','1234');await p.click('#nwCreate');await p.click('#adventureActions button:last-child');
 await p.evaluate(async()=>{const A=window.__pixelcraft,G=A.G,{B,I}=await import('./data.mjs');G.mode='survival';G.player.inv[0]={id:I.DIAMOND_SWORD,count:1,dur:1500,enchants:{sharpness:2}};G.player.inv[1]={id:B.TORCH,count:16};G.player.sel=0;});
 await p.keyboard.press('KeyE');await p.locator('[data-s="i:1"]').click();await p.locator('[data-s="h:0"]').click();
 assert.equal(await p.evaluate(()=>window.__pixelcraft.G.player.offhand[0].count),16);
 await p.screenshot({path:`${out}/inventory.png`});await p.keyboard.press('KeyE');
 await p.keyboard.press('KeyG');assert.equal(await p.evaluate(()=>window.__pixelcraft.G.player.inv[0].count),16);
 await p.click('#offhandHUD');assert.equal(await p.evaluate(()=>window.__pixelcraft.G.player.inv[0].dur),1500);
 // Offhand food is consumed while the sword remains in the main hand.
 await p.evaluate(async()=>{const A=window.__pixelcraft,{I}=await import('./data.mjs'),G=A.G;G.target=null;G.placeAt=null;G.player.food=10;G.player.offhand[0]={id:I.APPLE,count:1};A.doUse();});
 assert.equal(await p.evaluate(()=>window.__pixelcraft.G.player.offhand[0]),null);assert.ok(await p.evaluate(()=>window.__pixelcraft.G.player.food>10));
 // Real placement consumes the offhand stack, never the enchanted sword.
 await p.evaluate(async()=>{const A=window.__pixelcraft,G=A.G,{B}=await import('./data.mjs');G.player.offhand[0]={id:B.PLANKS,count:2};const x=640,y=G.w.surface[x]-2;A.setTile(x,y,B.AIR);A.setTile(x,y+1,B.STONE);G.target=null;G.placeAt={x,y};A.doUse();if(G.w.tiles[y*1280+x]!==B.PLANKS)throw Error('Offhand placement failed');});
 assert.equal(await p.evaluate(()=>window.__pixelcraft.G.player.offhand[0].count),1);
 assert.equal(await p.evaluate(()=>window.__pixelcraft.G.player.inv[0].enchants.sharpness),2);
 await p.evaluate(async()=>{const A=window.__pixelcraft,G=A.G,{B}=await import('./data.mjs');G.player.offhand[0]={id:B.TORCH,count:16};G.time=.7;G.paused=true;A.saveGame(true);});
 await p.waitForTimeout(100);await p.screenshot({path:`${out}/night.png`});
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(100);await p.screenshot({path:`${out}/mobile.png`});
 await p.reload();await p.click('#slots .play >> nth=0');assert.equal(await p.evaluate(()=>window.__pixelcraft.G.player.offhand[0].count),16);
 assert.equal(await p.evaluate(()=>window.__pixelcraft.G.player.inv[0].enchants.sharpness),2);
 // Old saves missing offhand get an empty slot and can swap safely.
 await p.evaluate(()=>{const A=window.__pixelcraft;delete A.G.player.offhand;A.saveGame(true);});await p.reload();await p.click('#slots .play >> nth=0');
 await p.keyboard.press('KeyG');assert.equal(await p.evaluate(()=>window.__pixelcraft.G.player.offhand[0].enchants.sharpness),2);
 // Replay the same offhand slot intents used by a multiplayer guest.
 await p.evaluate(async()=>{const A=window.__pixelcraft,{replayPanelAction}=await import('./ui.mjs');A.openPanel('inv');replayPanelAction({op:'slot',ref:'h:0',button:0});replayPanelAction({op:'slot',ref:'i:1',button:0});A.closePanel();});
 assert.equal(await p.evaluate(()=>window.__pixelcraft.G.player.inv[1].enchants.sharpness),2);
 await p.evaluate(()=>{const A=window.__pixelcraft,G=A.G;G.player.inv[0]=G.player.inv[1];G.player.inv[1]=null;G.player.sel=0;A.saveGame(true);});
 const touch=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,storageState:await p.context().storageState()}),m=await touch.newPage();
 m.on('pageerror',e=>errors.push(e.message));await m.goto(p.url());await m.waitForFunction(()=>window.__pixelcraft);await m.locator('#slots .play').first().tap();
 await m.locator('#offhandHUD').tap();assert.equal(await m.evaluate(()=>window.__pixelcraft.G.player.offhand[0].enchants.sharpness),2);
 await m.evaluate(()=>window.__pixelcraft.openPanel('inv'));await m.screenshot({path:`${out}/mobile-inventory.png`});
 const box=await m.locator('[data-s="h:0"]').boundingBox();assert.ok(box.y>=0&&box.y+box.height<844);await touch.close();
 assert.deepEqual(errors,[]);console.log('PASS: inventory transfer, keyboard/touch swap, offhand food/block consumption, desktop/mobile rendering, save/reload, old save compatibility; no errors');
}finally{await b.close();}
