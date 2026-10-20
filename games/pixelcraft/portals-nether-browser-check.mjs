import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.PIXELCRAFT_ARTIFACTS||'/tmp/pixelcraft-portals-nether';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1360,height:850}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const ev=(fn,arg)=>page.evaluate(fn,arg),shot=n=>page.screenshot({path:`${out}/${n}.png`});
const move=async pos=>{await ev(pos=>{const G=window.__pixelcraft.G;Object.assign(G.player,{...pos,vx:0,vy:0,fallTop:pos.y,invT:999});G.cam={...pos};},pos);};
try {
 await page.goto(process.env.PIXELCRAFT_TEST_URL||'http://127.0.0.1:3051/play/pixelcraft/index.html');
 await page.waitForFunction(()=>window.__pixelcraft&&!document.getElementById('slots').inert);
 await page.click('#slots .play >> nth=0');await page.fill('#nwSeed','1234');await page.click('#nwCreate');await page.click('#adventureActions button:last-child');
 // 마을 침대 옆 R로 실제 수면, 날짜와 부활 지점 저장.
 const bed=await ev(async()=>{const {B}=await import('./data.mjs');const G=window.__pixelcraft.G;const i=G.w.tiles.indexOf(B.BED_FOOT);G.mobs=[];G.time=.65;return{x:i%1280,y:Math.floor(i/1280)};});
 await move({x:bed.x,y:bed.y-1.3});await page.waitForTimeout(300);await shot('01-village-bed');await page.keyboard.press('KeyR');
 assert.equal(await ev(()=>window.__pixelcraft.G.day),2);assert.ok(await ev(()=>window.__pixelcraft.G.time<.2));
 await page.reload();await page.click('#slots .play >> nth=0');assert.equal(await ev(()=>window.__pixelcraft.G.day),2);
 // 포탈 바로 바깥 R은 설명만 표시. 안으로 들어가기 전에는 이동 안 함.
 const portal=await ev(()=>window.__pixelcraft.G.adventure.portals.find(p=>p.kind==='nether'));
 await move({x:portal.x-3,y:portal.y+2});await page.keyboard.press('KeyR');assert.match(await page.textContent('#adventureBody'),/바깥/);assert.equal(await page.locator('#adventureActions button').count(),1);await page.click('#adventureActions button:last-child');
 await page.waitForTimeout(750);assert.equal(await ev(()=>window.__pixelcraft.G.adventure.dimension),'overworld');
 // 실제 이동키로 포탈에 진입, .65초 후 이동. 도착 지점에서 자동 왕복하지 않음.
 await move({x:portal.x+.05,y:portal.y+2});await page.keyboard.down('KeyD');await page.waitForTimeout(100);await page.keyboard.up('KeyD');
 await page.waitForFunction(()=>window.__pixelcraft.G.adventure.dimension==='nether');await page.waitForTimeout(900);assert.equal(await ev(()=>window.__pixelcraft.G.adventure.dimension),'nether');
 assert.ok(await ev(()=>['piglin','blaze','ghast'].every(t=>window.__pixelcraft.G.mobs.some(m=>m.type===t))));
 await shot('02-nether-arrival');
 // 몬스터 모델과 요새를 실제 플레이 화면에서 확인.
 await move(await ev(()=>({x:675,y:window.__pixelcraft.G.w.surface[675]-3})));
 await page.waitForTimeout(700);await shot('03-fortress-blaze');
 await move(await ev(()=>{const m=window.__pixelcraft.G.mobs.find(m=>m.type==='ghast');return {x:m.x-4,y:m.y+3};}));await page.waitForTimeout(100);await shot('03b-ghast');
 const back=await ev(()=>window.__pixelcraft.G.adventure.portals[0]);await move({x:back.x+.5,y:back.y+2});await page.keyboard.press('KeyR');await page.click('#adventureActions button:first-child');
 assert.equal(await ev(()=>window.__pixelcraft.G.adventure.dimension),'overworld');
 // 흑요석 틀을 켜고, 부순 뒤 고쳐서 다시 사용할 수 있다.
 const built=await ev(async()=>{const {portalFrame}=await import('./adventure-world.mjs');const {B,I}=await import('./data.mjs');const A=window.__pixelcraft,G=A.G,x=855,floor=60;for(let xx=x-7;xx<x+8;xx++)for(let y=48;y<66;y++)A.setTile(xx,y,y>=floor?B.STONE:B.AIR);const p=portalFrame(G.w,x,floor);G.player.inv[0]={id:I.FLINT_STEEL,count:1,dur:64};G.player.sel=0;return p;});
 await move({x:built.x-2,y:built.y+2});await page.keyboard.press('KeyR');assert.equal(await ev(()=>window.__pixelcraft.G.player.inv[0].dur),63);
 await ev(async p=>{const {B}=await import('./data.mjs');window.__pixelcraft.setTile(p.x-1,p.y,B.AIR);},built);
 await move({x:built.x+.5,y:built.y+2});await page.waitForTimeout(800);assert.equal(await ev(()=>window.__pixelcraft.G.adventure.dimension),'overworld');
 await ev(async p=>{const {B}=await import('./data.mjs');window.__pixelcraft.setTile(p.x-1,p.y,B.OBSIDIAN);},built);
 // 원래 틀로 고친 포탈은 다시 정상 판정된다.
 assert.ok(await ev(async p=>{const {portalIntact}=await import('./adventure-world.mjs');return portalIntact(window.__pixelcraft.G.w,{...p,kind:'nether'});},built));
 // 직접 만든 엔드 틀은 엔더의 눈을 사용해야 켜진다.
 const own=await ev(async()=>{const {portalFrame}=await import('./adventure-world.mjs');const {B,I}=await import('./data.mjs');const A=window.__pixelcraft,G=A.G,x=825,floor=60;for(let xx=x-7;xx<x+8;xx++)for(let y=48;y<66;y++)A.setTile(xx,y,y>=floor?B.STONE:B.AIR);const p=portalFrame(G.w,x,floor,'end');G.player.inv[0]={id:I.ENDER_EYE,count:1};G.player.sel=0;return p;});
 await move({x:own.x-2,y:own.y+2});await page.keyboard.press('KeyR');assert.ok(await ev(x=>window.__pixelcraft.G.adventure.portals.some(p=>p.x===x&&p.kind==='end'),own.x));
 assert.equal(await ev(()=>window.__pixelcraft.G.player.inv[0]),null);
 await move({x:own.x+.5,y:own.y+2});await page.waitForFunction(()=>window.__pixelcraft.G.adventure.dimension==='end');await page.waitForTimeout(700);await shot('04-end');
 await page.keyboard.press('KeyR');await page.click('#adventureActions button:first-child');assert.equal(await ev(()=>window.__pixelcraft.G.adventure.dimension),'overworld');
 // 보스를 죽인 바로 그 순간 저장·재시작해도 승리와 엔딩을 잃지 않는다.
 await ev(()=>{const G=window.__pixelcraft.G;G.day=50;});await page.waitForFunction(()=>window.__pixelcraft.G.mobs.some(m=>m.type==='summoner'));
 assert.equal(await ev(()=>window.__pixelcraft.G.mobs.find(m=>m.type==='summoner').hp),540);
 await ev(()=>{const G=window.__pixelcraft.G,m=G.mobs.find(m=>m.type==='summoner');Object.assign(G.player,{x:m.x-4,y:m.y,invT:999});G.cam={x:G.player.x,y:G.player.y};m.burstT=.5;});await shot('05-hard-boss');
 await ev(()=>{const A=window.__pixelcraft,m=A.G.mobs.find(m=>m.type==='summoner');A.hitMob(m,9999,m.x-1);A.G.paused=true;A.saveGame(true);});
 await page.reload();await page.click('#slots .play >> nth=0');await page.waitForSelector('#adventureDialog:not([hidden])');assert.match(await page.textContent('#adventureTitle'),/현실/);assert.equal(await ev(()=>window.__pixelcraft.G.adventure.bossDefeated),true);await shot('06-ending');
 await page.click('#adventureActions button:first-child');assert.equal(await ev(()=>window.__pixelcraft.G.adventure.endingSeen),true);
 // 옛 저장에 살아 있는 보스가 누락되면 싸움을 재개할 수 있도록 복구.
 await ev(async()=>{const {B}=await import('./data.mjs');const A=window.__pixelcraft,G=A.G;G.adventure.bossDefeated=false;G.adventure.boss={spawned:true};delete G.adventure.bedsVersion;delete G.adventure.fortressVersion;for(let i=0;i<G.w.tiles.length;i++)if([B.BED_FOOT,B.BED_HEAD].includes(G.w.tiles[i]))G.w.tiles[i]=B.AIR;const w=G.adventure.worlds.nether.w;w.tiles[(w.surface[676]-8)*1280+676]=B.AIR;G.mobs=[];A.saveGame(true);});
 await page.reload();await page.click('#slots .play >> nth=0');await page.waitForFunction(()=>window.__pixelcraft.G.mobs.some(m=>m.type==='summoner'&&!m.dead));
 assert.ok(await ev(async()=>{const {B}=await import('./data.mjs');const G=window.__pixelcraft.G,w=G.adventure.worlds.nether.w;return G.w.tiles.includes(B.BED_FOOT)&&w.tiles[(w.surface[676]-8)*1280+676]===B.STONE_BRICKS;}));
 assert.deepEqual(errors,[]);console.log('PASS: village sleeping/save, outside portal refusal, walking entry, return lock, nether inhabitants, fortress, player-built End portal activation, immediate-kill reload ending, legacy boss recovery; no errors');
} catch(e){await shot('FAILED');console.error(errors.slice(0,3));throw e;}finally{await browser.close();}
