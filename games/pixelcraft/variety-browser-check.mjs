import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.PIXELCRAFT_ARTIFACTS||'/tmp/pixelcraft-variety'; await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch(), page=await browser.newPage({viewport:{width:1360,height:850}}), errors=[];
page.on('pageerror',e=>errors.push(e.message));
const url=process.env.PIXELCRAFT_TEST_URL||'http://127.0.0.1:3051/play/pixelcraft/index.html';
async function stand(index){await page.evaluate(async i=>{const {resetJumper}=await import('./jump-world.mjs');const G=window.__pixelcraft.G;resetJumper(G.player,i);G.cam={x:G.player.x,y:G.player.y};},index);}
try{
 await page.goto(url);await page.waitForFunction(()=>window.__pixelcraft&&!document.getElementById('slots').inert);
 await page.click('#btnJumpWorld');await page.click('#nwCreate');await page.click('#adventureActions button:last-child');
 for(const [i,name] of ['숲의 나무다리','얼음 절벽','화산 붕괴 지대','별빛 도약섬'].entries()){
  await stand(i*15);await page.waitForTimeout(150);assert.match(await page.textContent('#worldLine'),new RegExp(name));
  await page.screenshot({path:`${out}/0${i+1}-theme.png`});
 }
 const ice=await page.evaluate(async()=>{const {JUMP_PLATFORMS}=await import('./jump-world.mjs');return JUMP_PLATFORMS.findIndex(p=>p.ice);});
 await stand(ice);await page.waitForFunction(()=>window.__pixelcraft.G.player.onGround);
 await page.evaluate(()=>{window.__pixelcraft.G.player.vx=2;});await page.waitForTimeout(100);
 assert.ok(await page.evaluate(()=>window.__pixelcraft.G.player.vx>1.5),'얼음에서 손을 떼어도 미끄러진다');
 const bounce=await page.evaluate(async()=>{const {JUMP_PLATFORMS}=await import('./jump-world.mjs');return JUMP_PLATFORMS.findIndex(p=>p.bounce);});
 await stand(bounce); await page.waitForFunction(()=>window.__pixelcraft.G.player.vy<-5);
 await page.screenshot({path:`${out}/05-bounce.png`});
 await stand(0);await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);await page.screenshot({path:`${out}/06-mobile.png`});
 await page.keyboard.press('KeyT');await page.fill('#commandInput','50day');await page.click('#commandForm button');await page.keyboard.press('Escape');await page.waitForTimeout(150);
 assert.equal(await page.evaluate(()=>window.__pixelcraft.G.day),50);
 assert.deepEqual(errors,[]); console.log('PASS: four themed regions, ice sliding, automatic bounce, mobile composition, 50day preserved; no browser errors');
}finally{await browser.close();}
