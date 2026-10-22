import {chromium} from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.PIXELCRAFT_ARTIFACTS||'/tmp/pixelcraft-gallery';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1360,height:850}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const ev=(fn,arg)=>page.evaluate(fn,arg),shot=n=>page.screenshot({path:`${out}/${n}.png`});
const close=()=>page.click('#adventureActions button:last-child');
async function rocketTrip(slot){
 const r=await ev(async()=>{const{builtRocket}=await import('./build-guide.mjs');const G=window.__pixelcraft.G,r=builtRocket(G);Object.assign(G.player,{x:r.x-4,y:r.y-1.8,vx:0,vy:0,fallTop:r.y,invT:999,flying:false});G.cam={x:G.player.x,y:G.player.y};return r;});
 await page.waitForTimeout(200);await shot(`rocket-${slot}`);await page.keyboard.press('KeyR');assert.match(await page.textContent('#adventureTitle'),/내가 만든 우주선/);await page.getByRole('button',{name:'달로 발사!',exact:true}).click();
 assert.equal(await ev(()=>window.__pixelcraft.G.adventure.dimension),'moon');await page.waitForTimeout(400);await shot(`moon-${slot}`);await ev(()=>window.__pixelcraft.saveGame(true));await page.reload();await page.click(`#slots .play >> nth=${slot}`);assert.equal(await ev(()=>window.__pixelcraft.G.adventure.dimension),'moon');
 await ev(()=>{const G=window.__pixelcraft.G,r=G.adventure.rocketSites.moon;Object.assign(G.player,{x:r.x+2,y:r.y-1.8,vx:0,vy:0,invT:999,fallTop:r.y});});await page.keyboard.press('KeyR');await page.click('#adventureActions button:first-child');assert.equal(await ev(()=>window.__pixelcraft.G.adventure.dimension),'overworld');
 assert.deepEqual(await ev(async()=>{const{builtRocket}=await import('./build-guide.mjs');return builtRocket(window.__pixelcraft.G);}),r);
}
async function buildRocket(survival){
 return ev(async survival=>{const A=window.__pixelcraft,G=A.G,{guideCells,guideProgress}=await import('./build-guide.mjs'),{B}=await import('./data.mjs');
 const cells=guideCells(G),ids=[...new Set(cells.map(c=>c.id))];
 // Test fixture supplies collected resources and a level work site; the game never clears wild terrain.
 if(survival){ids.forEach((id,k)=>G.player.inv[k]={id,count:64});const b=G.builder;for(let x=b.x-1;x<=b.x+11;x++)for(let y=b.y-12;y<=b.y+1;y++)A.setTile(x,y,y===b.y+1?B.STONE:0);}
 Object.assign(G.player,{x:G.builder.x-3,y:G.builder.y-1.8,vx:0,vy:0,invT:999});
 const before=G.player.inv.reduce((n,s)=>n+(s?.count??0),0),placed=G.stats.placed;
 for(let pass=0;pass<6;pass++)for(const c of guideProgress(G).missing){G.player.sel=G.player.inv.findIndex(s=>s?.id===c.id);A.placeBlock(c.x,c.y,c.id);}
 return{missing:guideProgress(G).missing.length,used:before-G.player.inv.reduce((n,s)=>n+(s?.count??0),0),placed:G.stats.placed-placed};},survival);
}
try{
 await page.goto(process.env.PIXELCRAFT_TEST_URL||'http://127.0.0.1:3054/play/pixelcraft/');await page.waitForFunction(()=>window.__pixelcraft&&!document.getElementById('slots').inert);
 await page.click('#btnBuildWorld');await page.click('#nwCreate');await close();await page.click('#galleryButton');assert.equal(await page.locator('.blueprint-card').count(),9);await shot('gallery-desktop');
 await page.setViewportSize({width:390,height:844});await shot('gallery-mobile');await page.locator('[data-plan="8"]').scrollIntoViewIfNeeded();await shot('gallery-mobile-more');assert.equal(await ev(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.click('[data-plan="2"]');assert.match(await page.textContent('#adventureTitle'),/우주선/);await close();await page.setViewportSize({width:1360,height:850});
 const free=await buildRocket(false);assert.equal(free.missing,0);assert.equal(free.used,0);await page.waitForFunction(()=>window.__pixelcraft.G.builder.completed.includes(2));await rocketTrip(0);
 await page.click('#galleryButton');await page.getByRole('button',{name:'안 하기',exact:true}).click();assert.equal(await ev(()=>window.__pixelcraft.G.builder.active),false);assert.equal(await page.locator('#blueprintButton').isVisible(),false);await ev(()=>window.__pixelcraft.saveGame(true));await page.reload();await page.click('#slots .play >> nth=0');assert.equal(await ev(()=>window.__pixelcraft.G.builder.active),false);
 await ev(()=>{const A=window.__pixelcraft,G=A.newGame({seed:1234,mode:'survival',diff:2,slot:1,name:'야생 건축 시험'});G.adventure.storySeen=true;G.player.invT=999;A.startGame(G);});
 await page.click('#galleryButton');await page.getByRole('button',{name:'안 하기',exact:true}).click();assert.equal(await ev(()=>!!window.__pixelcraft.G.builder),false);
 await page.click('#galleryButton');const before=await ev(()=>{const G=window.__pixelcraft.G;return{inv:G.player.inv,x:G.player.x,y:G.player.y};});await page.click('[data-plan="2"]');
 assert.deepEqual(await ev(()=>{const G=window.__pixelcraft.G;return{inv:G.player.inv,x:G.player.x,y:G.player.y};}),before);assert.equal(await ev(()=>window.__pixelcraft.G.mode),'survival');assert.equal(await ev(()=>window.__pixelcraft.G.diff),2);await close();
 const wild=await buildRocket(true);assert.equal(wild.missing,0);assert.equal(wild.used,wild.placed);assert.ok(wild.used>40);await page.waitForFunction(()=>window.__pixelcraft.G.builder.completed.includes(2));
 await page.click('#galleryButton');await page.getByRole('button',{name:'안 하기',exact:true}).click();await rocketTrip(1);assert.equal(await ev(()=>window.__pixelcraft.G.mode),'survival');assert.equal(await ev(()=>window.__pixelcraft.G.builder.active),false);
 await page.click('#galleryButton');await page.click('[data-plan="8"]');await close();assert.equal(await ev(()=>window.__pixelcraft.G.builder.active),true);await shot('wild-heart-guide');
 await ev(()=>{const G=window.__pixelcraft.G;G.day=100;G.adventure.bossDefeated=true;G.player.invT=999;});await page.waitForFunction(()=>window.__pixelcraft.G.mobs.some(m=>m.type==='skeleton_summoner'));
 assert.deepEqual(errors,[]);console.log('PASS: 9 desktop/mobile pictures, opt out/re-enable/save, actual rocket building, creative unlimited vs survival consumption, no survival mode/inventory/position change, both Moon round trips and reloads, day100 boss with survival guide; no page errors');
}catch(e){await shot('FAILED');console.error(errors);throw e;}finally{await browser.close();}
