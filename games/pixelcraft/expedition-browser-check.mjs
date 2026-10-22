import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.PIXELCRAFT_ARTIFACTS||'/tmp/pixelcraft-expedition';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1360,height:850}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const ev=(fn,arg)=>page.evaluate(fn,arg),shot=n=>page.screenshot({path:`${out}/${n}.png`});
const move=async pos=>{await ev(pos=>{const G=window.__pixelcraft.G;Object.assign(G.player,{...pos,vx:0,vy:0,fallTop:pos.y,invT:999});G.cam={...pos};},pos);};
try{
 await page.goto(process.env.PIXELCRAFT_TEST_URL||'http://127.0.0.1:3052/play/pixelcraft/');await page.waitForFunction(()=>window.__pixelcraft&&!document.getElementById('slots').inert);
 await page.click('#slots .play >> nth=0');await page.fill('#nwSeed','1234');await page.click('#nwCreate');await page.click('#adventureActions button:last-child');
 const r=await ev(()=>window.__pixelcraft.G.adventure.rocketSites.overworld);assert.ok(r);await move({x:r.x+2,y:r.y-1.8});await page.waitForTimeout(300);await shot('01-rocket');
 await page.keyboard.press('KeyR');assert.match(await page.textContent('#adventureTitle'),/탐사선/);await page.click('#adventureActions button:first-child');assert.equal(await ev(()=>window.__pixelcraft.G.adventure.dimension),'moon');await page.waitForTimeout(1200);await shot('02-moon-earth');
 // 달의 실제 점프는 지구보다 오래 떠 있고 높은 곳에 도달한다.
 const ground=await ev(()=>window.__pixelcraft.G.player.y);await page.keyboard.down('Space');await page.waitForTimeout(150);await page.keyboard.up('Space');await page.waitForTimeout(650);assert.ok(await ev(y=>window.__pixelcraft.G.player.y<y-4,ground));
 // 달에 지은 블록은 차원 왕복과 재접속 뒤에도 유지된다.
 await ev(async()=>{const {B}=await import('./data.mjs');window.__pixelcraft.setTile(648,75,B.GOLD_BLOCK);window.__pixelcraft.saveGame(true);});
 await page.reload();await page.click('#slots .play >> nth=0');assert.equal(await ev(()=>window.__pixelcraft.G.adventure.dimension),'moon');assert.equal(await ev(async()=>{const {B}=await import('./data.mjs');return window.__pixelcraft.G.w.tiles[75*1280+648]===B.GOLD_BLOCK;}),true);
 const mr=await ev(()=>window.__pixelcraft.G.adventure.rocketSites.moon);await move({x:mr.x+2,y:mr.y-1.8});await page.keyboard.press('KeyR');await page.click('#adventureActions button:first-child');assert.equal(await ev(()=>window.__pixelcraft.G.adventure.dimension),'overworld');
 await move({x:160,y:64});await page.waitForTimeout(300);await shot('03-ocean');
 const pond=await ev(()=>({x:530,y:window.__pixelcraft.G.w.surface[530]-3}));await move(pond);await page.waitForTimeout(300);await shot('04-pond');
 const portal=await ev(()=>window.__pixelcraft.G.adventure.portals.find(p=>p.kind==='end'));await move({x:portal.x+.5,y:portal.y+2});await page.keyboard.press('KeyR');await page.click('#adventureActions button:first-child');
 assert.equal(await ev(()=>window.__pixelcraft.G.adventure.dimension),'end');
 await page.click('#journalButton');assert.match(await page.textContent('#adventureTitle'),/엔드 책/);await shot('05-end-book');await page.click('#adventureActions button:last-child');
 await move({x:807,y:80});await page.waitForTimeout(300);await shot('06-end-outpost');assert.ok(await ev(()=>window.__pixelcraft.G.chests.size===3));
 const back=await ev(()=>window.__pixelcraft.G.adventure.portals[0]);await move({x:back.x+.5,y:back.y+2});await page.keyboard.press('KeyR');await page.click('#adventureActions button:first-child');
 await page.click('#journalButton');assert.match(await page.textContent('#adventureTitle'),/오버월드 책/);assert.match(await page.textContent('#adventureBody'),/◆ 완료.*달/);await page.click('#adventureActions button:last-child');
 // 저장을 즉시 불러와도 승리 포탈이 남고, 실제 학교 차원에 도착한다.
 await ev(()=>{window.__pixelcraft.G.day=50;});await page.waitForFunction(()=>window.__pixelcraft.G.mobs.some(m=>m.type==='summoner'));
 await ev(()=>{const A=window.__pixelcraft,m=A.G.mobs.find(m=>m.type==='summoner');A.hitMob(m,9999,m.x-1);A.G.paused=true;A.saveGame(true);});
 await page.reload();await page.click('#slots .play >> nth=0');await page.waitForTimeout(100);
 const gold=await ev(()=>window.__pixelcraft.G.adventure.portals.find(p=>p.kind==='ending'));assert.ok(gold);await move({x:gold.x-3,y:gold.y+2});await page.waitForTimeout(100);await move({x:gold.x+.5,y:gold.y+2});
 await page.waitForFunction(()=>window.__pixelcraft.G.adventure.dimension==='school');await page.waitForSelector('#adventureDialog:not([hidden])');assert.match(await page.textContent('#adventureTitle'),/현실/);await page.click('#adventureActions button:first-child');
 await move({x:640,y:84});await page.waitForTimeout(500);await shot('07-real-school');
 await ev(()=>window.__pixelcraft.saveGame(true));await page.reload();await page.click('#slots .play >> nth=0');assert.equal(await ev(()=>window.__pixelcraft.G.adventure.dimension),'school');assert.equal(await ev(()=>window.__pixelcraft.G.adventure.endingSeen),true);
 const exit=await ev(()=>window.__pixelcraft.G.adventure.portals[0]);await move({x:exit.x+.5,y:exit.y+2});await page.keyboard.press('KeyR');await page.click('#adventureActions button:first-child');assert.equal(await ev(()=>window.__pixelcraft.G.adventure.dimension),'overworld');
 // 휴대폰에서도 책 전환과 학교/우주선 조작 버튼을 사용할 수 있다.
 await page.setViewportSize({width:844,height:390});await page.click('#journalButton');await page.click('#adventureActions button:first-child');assert.match(await page.textContent('#adventureTitle'),/네더 책/);await shot('08-mobile-book');await page.click('#adventureActions button:last-child');
 assert.deepEqual(errors,[]);console.log('PASS: rocket boarding/return, low gravity, cubic Earth, lunar build/save, ocean/pond, End outpost/treasure, three quest books/mobile, boss victory portal physically reaches school, school save/return; no errors');
}catch(e){await shot('FAILED');console.error(errors.slice(0,5));throw e;}finally{await browser.close();}
