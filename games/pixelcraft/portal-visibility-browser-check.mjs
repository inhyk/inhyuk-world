import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.PIXELCRAFT_ARTIFACTS||'/tmp/pixelcraft-visible-portal';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1280,height:760}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.PIXELCRAFT_TEST_URL||'http://127.0.0.1:3064/play/pixelcraft/');
 await page.waitForFunction(()=>window.__pixelcraft);await page.click('#slots .play >> nth=0');await page.fill('#nwSeed','1234');await page.click('#nwCreate');await page.click('#adventureActions button:last-child');
 await page.waitForFunction(()=>document.getElementById('questLine').textContent.includes('네더 포탈 →'));
 const built=await page.evaluate(async()=>{
  const A=window.__pixelcraft,G=A.G,{B}=await import('./data.mjs'),{portalFrame}=await import('./adventure-world.mjs');
  G.mode='creative';G.paused=true;G.mobs=[];
  const p=portalFrame(G.w,855,60);Object.assign(G.player,{x:p.x-3,y:p.y+2,vx:0,vy:0,invT:999});G.cam={x:p.x,y:p.y+2};
  G.player.inv[0]={id:B.NETHER_PORTAL,count:1};G.player.sel=0;
  if(!A.placeBlock(p.x,p.y+3,B.NETHER_PORTAL))throw Error('portal placement failed');
  if(!G.adventure.portals.some(q=>q.x===p.x))throw Error('placed portal was not activated');
  A.saveGame(true);return p;
 });
 await page.waitForTimeout(250);await page.screenshot({path:`${out}/desktop.png`});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);await page.screenshot({path:`${out}/mobile.png`});
 await page.reload();await page.click('#slots .play >> nth=0');
 assert.ok(await page.evaluate(async p=>{const {portalIntact}=await import('./adventure-world.mjs');const G=window.__pixelcraft.G;return portalIntact(G.w,{...p,kind:'nether'})&&G.adventure.portals.some(q=>q.x===p.x);},built));
 await page.evaluate(p=>{const G=window.__pixelcraft.G;Object.assign(G.player,{x:p.x+.5,y:p.y+2,vx:0,vy:0,invT:999});G.cam={x:p.x,y:p.y};},built);
 await page.waitForFunction(()=>window.__pixelcraft.G.adventure.dimension==='nether');
 assert.deepEqual(errors,[]);console.log('PASS: portal direction, placed tile activation, desktop/mobile rendering, save/reload, Nether entry; no browser errors');
}finally{await browser.close();}
