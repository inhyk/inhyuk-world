import {chromium} from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.PIXELCRAFT_ARTIFACTS||'/tmp/pixelcraft-builder-boss';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1360,height:850}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const ev=(fn,arg)=>page.evaluate(fn,arg),shot=n=>page.screenshot({path:`${out}/${n}.png`});
async function aim(x,y){const pos=await ev(({x,y})=>{const v=window.__pixelcraft.G.view;return{x:(x+.5-v.left)*v.T,y:(y+.5-v.top)*v.T};},{x,y});await page.mouse.move(pos.x,pos.y);await page.waitForTimeout(50);}
try{
 await page.goto(process.env.PIXELCRAFT_TEST_URL||'http://127.0.0.1:3053/play/pixelcraft/');await page.waitForFunction(()=>window.__pixelcraft&&!document.getElementById('slots').inert);
 await page.click('#btnBuildWorld');assert.equal(await page.inputValue('#nwWorldType'),'builder');await page.click('#nwCreate');await page.waitForSelector('#blueprintPreview');
 assert.match(await page.textContent('#adventureBody'),/남은 블록/);await shot('01-blueprint');await page.click('#adventureActions button:last-child');await page.waitForTimeout(400);await shot('02-guide');
 const first=await ev(async()=>{const {guideCells}=await import('./build-guide.mjs');return guideCells(window.__pixelcraft.G)[0];});
 
 // 실제 마우스로 설치하고 캐서 기록이 늘어나는지 확인한다.
 await aim(first.x,first.y);await page.mouse.down({button:'right'});await page.waitForTimeout(150);await page.mouse.up({button:'right'});
 assert.equal(await ev(()=>window.__pixelcraft.G.stats.placed),1);
 await aim(first.x,first.y);await page.mouse.down();await page.waitForTimeout(120);await page.mouse.up();assert.equal(await ev(()=>window.__pixelcraft.G.stats.mined),1);
 await page.click('#recordsButton');assert.match(await page.textContent('#adventureBody'),/설치한 블록 · 1회/);assert.match(await page.textContent('#adventureBody'),/부순 블록 · 1회/);await shot('03-records');await page.click('#adventureActions button:last-child');
 // 일반 배치 함수를 이용해 설계 전체의 지지대와 재료, 완성 판정을 검사한다.
 const built=await ev(async()=>{const A=window.__pixelcraft,{guideCells,guideProgress}=await import('./build-guide.mjs');for(const c of guideCells(A.G)){A.G.player.inv[A.G.player.sel]={id:c.id,count:64};A.placeBlock(c.x,c.y,c.id);}return guideProgress(A.G);});assert.equal(built.done,built.total);
 await page.waitForFunction(()=>window.__pixelcraft.G.builder.completed.includes(0));await shot('04-complete');await ev(()=>window.__pixelcraft.saveGame(true));
 await page.reload();await page.click('#slots .play >> nth=0');assert.deepEqual(await ev(()=>window.__pixelcraft.G.builder.completed),[0]);assert.ok(await ev(()=>window.__pixelcraft.G.stats.placed)>1);
 await page.click('#blueprintButton');await page.click('#adventureActions button:nth-child(2)');assert.match(await page.textContent('#adventureTitle'),/작은 집/);
 await page.setViewportSize({width:390,height:844});await shot('05-mobile-blueprint');await page.click('#adventureActions button:last-child');await page.setViewportSize({width:1360,height:850});
 // 99일에는 새 보스가 없고 100일 명령 후 등장한다. 게스트 로컬 저장만 사용한다.
 await ev(()=>{const A=window.__pixelcraft,G=A.newGame({seed:1234,mode:'creative',diff:1,slot:1,name:'100일 시험'});G.adventure.storySeen=true;G.adventure.bossDefeated=true;G.day=99;A.startGame(G);});
 await page.waitForTimeout(150);assert.equal(await ev(()=>window.__pixelcraft.G.mobs.some(m=>m.type==='skeleton_summoner')),false);
 await page.click('#commandButton');await page.fill('#commandInput','100day');await page.click('#commandForm button');await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__pixelcraft.G.mobs.some(m=>m.type==='skeleton_summoner'));
 assert.match(await page.textContent('#bossLabel'),/스켈레톤 소환사/);assert.equal(await ev(()=>window.__pixelcraft.G.mobs.find(m=>m.type==='skeleton_summoner').hp),1200);
 await ev(()=>{const G=window.__pixelcraft.G,m=G.mobs.find(m=>m.type==='skeleton_summoner');m.hp=350;m.summonT=.01;m.volleyT=.01;});await page.waitForFunction(()=>window.__pixelcraft.G.mobs.some(m=>m.type==='skeleton'&&m.summoned));assert.ok(await ev(()=>window.__pixelcraft.G.arrows.length)>=5);await shot('06-day100-boss');
 await ev(()=>window.__pixelcraft.saveGame(true));await page.reload();await page.click('#slots .play >> nth=1');assert.equal(await ev(()=>window.__pixelcraft.G.mobs.find(m=>m.type==='skeleton_summoner').hp),350);
 await ev(()=>{const A=window.__pixelcraft,m=A.G.mobs.find(m=>m.type==='skeleton_summoner');A.hitMob(m,9999,m.x-1);A.saveGame(true);});await page.reload();await page.click('#slots .play >> nth=1');await page.waitForTimeout(150);assert.equal(await ev(()=>window.__pixelcraft.G.adventure.skeletonDefeated),true);assert.equal(await ev(()=>window.__pixelcraft.G.mobs.some(m=>m.type==='skeleton_summoner'&&!m.dead)),false);
 // 실제 승리로 열린 황금 포탈에 바깥에서 이동 키로 걸어 들어간다.
 await ev(()=>{const A=window.__pixelcraft,G=A.G;G.mobs=[];G.adventure.portals=G.adventure.portals.filter(p=>p.kind!=='ending');G.adventure.bossDefeated=false;const x=640,floor=G.w.surface[x];for(let xx=x-5;xx<=x+5;xx++)for(let yy=floor-6;yy<=floor;yy++)A.setTile(xx,yy,yy===floor?3:0);const m=A.makeMob('summoner',x,floor-2.6);G.mobs.push(m);A.hitMob(m,9999,x-1);const p=G.adventure.portals.find(p=>p.kind==='ending');Object.assign(G.player,{x:p.x-3,y:p.y+2.2,vx:0,vy:0,invT:999,fallTop:p.y,flying:false});G.cam={x:G.player.x,y:G.player.y};G.portalBlockedUntilExit=false;});
 await page.keyboard.down('KeyD');await page.waitForFunction(()=>window.__pixelcraft.G.adventure.dimension==='school',{},{timeout:7000});await page.keyboard.up('KeyD');assert.match(await page.textContent('#adventureTitle'),/현실/);await shot('07-walked-ending');
 assert.deepEqual(errors,[]);console.log('PASS: title builder entry, preview/materials, actual place/mine records, full blueprint completion/save, second design/mobile, 99/100day boss timing, phases/arrows/summons/save/victory, actual keyboard walk through golden portal to school; no errors');
}catch(e){await shot('FAILED');console.error(errors.slice(0,5));throw e;}finally{await browser.close();}
