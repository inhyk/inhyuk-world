import {chromium} from '../../tools/node_modules/playwright/index.mjs';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const out=process.env.PIXELCRAFT_ARTIFACTS||'/tmp/pixelcraft-halloween';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1360,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.PIXELCRAFT_TEST_URL||'http://127.0.0.1:3067/play/pixelcraft/');await page.waitForFunction(()=>window.__pixelcraft);await page.screenshot({path:`${out}/title-desktop.png`});
 await page.click('#btnHalloween');assert.equal(await page.locator('#halloweenCraft').isDisabled(),true);await page.keyboard.press('Escape');assert.equal(await page.locator('#halloweenDialog').isHidden(),true);
 await page.click('#slots .play >> nth=0');await page.fill('#nwSeed','1234');await page.click('#nwCreate');await page.click('#adventureActions button:last-child');
 assert.equal(await page.evaluate(()=>new Set(window.__pixelcraft.G.adventure.villagers.map(v=>window.__pixelcraft.G.w.biome[Math.floor(v.x)])).size),5);
 const tree=await page.evaluate(()=>{const A=window.__pixelcraft,G=A.G,t=G.adventure.halloween.trees[0];Object.assign(G.player,{x:t.x-5,y:t.y-1,vx:0,vy:0,invT:999});G.cam={x:t.x,y:t.y-3};G.paused=true;G.time=.65;return t;});
 await page.waitForTimeout(150);await page.screenshot({path:`${out}/pumpkin-tree.png`});
 const village=await page.evaluate(()=>{const G=window.__pixelcraft.G,p=G.adventure.halloween.villages.find(v=>v.biome===4);Object.assign(G.player,{x:p.x-5,y:p.y-3,vx:0,vy:0});G.cam={x:p.x,y:p.y-3};return p;});await page.waitForTimeout(150);await page.screenshot({path:`${out}/ocean-village.png`});
 await page.evaluate(async()=>{const A=window.__pixelcraft,G=A.G,{B}=await import('./data.mjs');G.paused=false;G.player.inv=Array(36).fill(null);G.player.inv[0]={id:B.PUMPKIN,count:3};G.player.inv[1]={id:B.TORCH,count:3};G.player.sel=0;});
 await page.click('#halloweenButton');assert.equal(await page.locator('#halloweenCraft').isEnabled(),true);await page.screenshot({path:`${out}/recipe-desktop.png`});
 for(let k=0;k<3;k++)await page.click('#halloweenCraft');assert.equal(await page.locator('#halloweenCraft').isDisabled(),true);
 assert.equal(await page.evaluate(async()=>{const {B}=await import('./data.mjs');return window.__pixelcraft.G.player.inv.filter(s=>s?.id===B.JACK).reduce((n,s)=>n+s.count,0);}),3);
 await page.click('#halloweenClose');
 await page.evaluate(async()=>{const A=window.__pixelcraft,G=A.G,{B}=await import('./data.mjs');G.player.sel=G.player.inv.findIndex(s=>s?.id===B.JACK);for(let x=640;x<643;x++){const y=G.w.surface[x]-3;A.setTile(x,y,B.AIR);A.setTile(x,y+1,B.STONE);if(!A.placeBlock(x,y,B.JACK))throw Error('Lantern placement failed');}G.paused=false;});
 await page.click('#halloweenButton');assert.equal(await page.locator('#halloweenClaim').isEnabled(),true);await page.click('#halloweenClaim');assert.match(await page.textContent('#halloweenMessage'),/다이아몬드 3개/);assert.equal(await page.locator('#halloweenClaim').isDisabled(),true);await page.screenshot({path:`${out}/missions-complete.png`});
 await page.click('#halloweenClose');await page.reload();await page.click('#slots .play >> nth=0');assert.equal(await page.evaluate(()=>window.__pixelcraft.G.adventure.halloween.claimed),true);
 assert.equal(await page.evaluate(async()=>{const {I}=await import('./data.mjs');return window.__pixelcraft.G.player.inv.filter(s=>s?.id===I.DIAMOND).reduce((n,s)=>n+s.count,0);}),3);
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,storageState:await page.context().storageState()}),mobile=await context.newPage();mobile.on('pageerror',e=>errors.push(e.message));
 await mobile.goto(page.url());await mobile.waitForFunction(()=>window.__pixelcraft);await mobile.screenshot({path:`${out}/title-mobile.png`});await mobile.locator('#slots .play').first().tap();await mobile.locator('#halloweenButton').tap();await mobile.screenshot({path:`${out}/missions-mobile.png`});
 await mobile.locator('#halloweenRecipes button').nth(1).tap();await mobile.locator('#halloweenCraft').scrollIntoViewIfNeeded();await mobile.screenshot({path:`${out}/recipe-mobile.png`});
 const box=await mobile.locator('#halloweenCraft').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390&&box.y>=0&&box.y+box.height<=844);await mobile.locator('#halloweenClose').scrollIntoViewIfNeeded();await mobile.locator('#halloweenClose').tap();
 await context.close();assert.deepEqual(errors,[]);console.log('PASS: spooky desktop/mobile title, five-biome villages, pumpkin trees, ocean settlement, actual recipe ingredients/crafting/placement, mission reward once, save/reload, touch scrolling; no errors');
}finally{await browser.close();}
