import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('public'), out=path.resolve('artifacts/pixelcraft-adventure');
fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{if(req.url==='/api/pixelcraft/account'){res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:true,available:false,user:null}));return;}const p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+path.sep)||!fs.existsSync(p)||!fs.statSync(p).isFile()){res.writeHead(404).end();return;}res.setHeader('content-type',types[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch(), page=await browser.newPage({viewport:{width:1360,height:850}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const ev=(fn,arg)=>page.evaluate(fn,arg), shot=n=>page.screenshot({path:path.join(out,n+'.png')});
const move=async(p)=>{await ev(p=>{const G=window.__pixelcraft.G;Object.assign(G.player,{x:p.x,y:p.y,vx:0,vy:0,fallTop:p.y,invT:999});G.cam={...p};Object.assign(G.companion,{x:p.x+1,y:p.y,vx:0,vy:0,fallTop:p.y,invT:999});},p);await page.waitForTimeout(150);};
try {
 await page.goto(`http://127.0.0.1:${server.address().port}/play/pixelcraft/index.html`);
 await page.click('#slots .play');await page.fill('#nwSeed','1234');await page.fill('#nwPlayer','모험 친구');await page.check('#nwCoop');await page.selectOption('#nwSkin','2');await page.selectOption('#nwDayLength','60');
 await shot('01-setup');await page.click('#nwCreate');await page.waitForSelector('#adventureDialog:not([hidden])');await shot('02-story');await page.click('#adventureActions button:last-child');
 assert.equal(await page.title(),'2D마인크레프트');assert.equal(await ev(()=>window.__pixelcraft.W),1280);
 const x=await ev(()=>window.__pixelcraft.G.companion.x);await page.keyboard.down('ArrowRight');await page.waitForTimeout(550);await page.keyboard.up('ArrowRight');
 assert.ok(await ev(x=>window.__pixelcraft.G.companion.x>x+0.5,x),'2P independently moves');
 await page.keyboard.press('KeyL');assert.equal(await ev(()=>window.__pixelcraft.G.companion.spectator),true);await page.keyboard.press('KeyL');assert.equal(await ev(()=>window.__pixelcraft.G.companion.spectator),false);assert.ok(await ev(()=>Math.abs(window.__pixelcraft.G.companion.x-window.__pixelcraft.G.player.x)<0.8));
 await ev(()=>{const A=window.__pixelcraft,G=A.G;for(let x=644;x<657;x++){A.setTile(x,50,3);for(let y=46;y<50;y++)A.setTile(x,y,0);}Object.assign(G.player,{x:648,y:48.2,vx:0,vy:0,fallTop:48.2});Object.assign(G.companion,{x:650,y:48.2,vx:0,vy:0,face:1,fallTop:48.2});G.player.inv[0]={id:147,count:4};G.player.inv[1]={id:17,count:5};G.player.sel=1;});
 await page.keyboard.press('Comma');assert.equal(await ev(()=>window.__pixelcraft.G.w.tiles[49*1280+651]),17);assert.equal(await ev(()=>window.__pixelcraft.G.player.inv[1].count),4);assert.equal(await ev(()=>window.__pixelcraft.G.player.inv[0].count),4);
 // Actual trade dialog and atomic inventory exchange.
 const v=await ev(()=>window.__pixelcraft.G.adventure.villagers[0]);await move(v);await ev(()=>{window.__pixelcraft.G.player.inv[0]={id:8,count:8};});
 await page.keyboard.press('KeyR');await page.click('#adventureActions button:first-child');assert.ok(await ev(()=>window.__pixelcraft.G.player.inv.some(s=>s?.id===147&&s.count===4)));
 await shot('03-trade');await page.click('#adventureActions button:last-child');await shot('04-village');
 // Portals use actual proximity, dialog and click. Both worlds retain edits after save/load.
 const portal=await ev(()=>window.__pixelcraft.G.adventure.portals.find(p=>p.kind==='nether'));await move({x:portal.x,y:portal.y+2});await page.keyboard.press('KeyR');await page.click('#adventureActions button:first-child');
 assert.equal(await ev(()=>window.__pixelcraft.G.adventure.dimension),'nether');
 await ev(()=>{const A=window.__pixelcraft;A.setTile(650,70,17);A.saveGame(true);});await page.waitForFunction(()=>window.__pixelcraft.G.fade===0);await shot('05-nether');await page.reload();await page.click('#slots .play');
 assert.equal(await ev(()=>window.__pixelcraft.G.adventure.dimension),'nether');assert.equal(await ev(()=>window.__pixelcraft.G.w.tiles[70*1280+650]),17);
 await page.keyboard.press('KeyR');await page.click('#adventureActions button:first-child');assert.equal(await ev(()=>window.__pixelcraft.G.adventure.dimension),'overworld');
 const end=await ev(()=>window.__pixelcraft.G.adventure.portals.find(p=>p.kind==='end'));await move({x:end.x,y:end.y+2});await page.keyboard.press('KeyR');await page.click('#adventureActions button:first-child');
 assert.equal(await ev(()=>window.__pixelcraft.G.adventure.dimension),'end');await page.waitForFunction(()=>window.__pixelcraft.G.fade===0);await shot('06-end');await page.keyboard.press('KeyR');await page.click('#adventureActions button:first-child');
 assert.equal(await ev(()=>window.__pixelcraft.G.adventure.dimension),'overworld');
 // Advance time as a fixture; boss is created by production day trigger.
 await ev(()=>{const G=window.__pixelcraft.G;G.day=50;});await page.waitForFunction(()=>window.__pixelcraft.G.mobs.some(m=>m.type==='summoner'));
 assert.equal(await page.locator('#bossHUD').isVisible(),true);
 const boss=await ev(()=>{const G=window.__pixelcraft.G,m=G.mobs.find(m=>m.type==='summoner');return{x:m.x-4,y:m.y};});await move(boss);await shot('07-boss-phase1');
 await ev(()=>{const m=window.__pixelcraft.G.mobs.find(m=>m.type==='summoner');m.hp=360;m.summonT=0;});await page.waitForFunction(()=>window.__pixelcraft.G.mobs.find(m=>m.type==='summoner').phase===2);
 await ev(()=>{const m=window.__pixelcraft.G.mobs.find(m=>m.type==='summoner');m.hp=180;m.summonT=0;});await page.waitForFunction(()=>window.__pixelcraft.G.mobs.some(m=>m.summoned&&m.type==='skeleton'));
 await shot('08-boss-phase3');
 // Save mid-boss and restore phase, HP, and simultaneous input. Defeat using real 2P attack.
 await ev(()=>window.__pixelcraft.saveGame(true));await page.reload();await page.click('#slots .play');assert.equal(await ev(()=>window.__pixelcraft.G.mobs.find(m=>m.type==='summoner').phase),3);
 await ev(()=>{const G=window.__pixelcraft.G,m=G.mobs.find(m=>m.type==='summoner');m.hp=1;m.vx=0;Object.assign(G.companion,{x:m.x-1,y:m.y+0.6,vx:0,vy:0});G.player.inv[0]={id:129,count:1,dur:1561};G.player.sel=0;});
 await page.keyboard.down('Slash');await page.waitForFunction(()=>window.__pixelcraft.G.adventure.bossDefeated);await page.keyboard.up('Slash');
 const gold=await ev(()=>window.__pixelcraft.G.adventure.portals.find(p=>p.kind==='ending'));await move({x:gold.x,y:gold.y+2});await page.keyboard.press('KeyR');await page.click('#adventureActions button:first-child');await page.waitForFunction(()=>window.__pixelcraft.G.adventure.dimension==='school');await shot('09-ending');assert.ok((await page.locator('#adventureTitle').textContent()).includes('현실'));
 await page.click('#adventureActions button:first-child');assert.equal(await ev(()=>window.__pixelcraft.G.adventure.endingSeen),true);
 await page.click('#achievementButton');await shot('10-achievements');assert.ok((await page.locator('#adventureBody').textContent()).includes('학교로 돌아오다'));await page.click('#adventureActions button:last-child');
 // Mobile layout and reachable interactions.
 await page.setViewportSize({width:390,height:844});await shot('11-mobile');await page.click('#storyButton');await shot('12-mobile-story');await page.click('#adventureActions button:last-child');
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 const mp=await mobile.newPage();mp.on('pageerror',e=>errors.push(e.message));
 await mp.goto(page.url());await mp.locator('#slots .play').first().tap();await mp.locator('#nwCreate').tap();await mp.locator('#adventureActions button').last().tap();
 await mp.waitForFunction(()=>window.__pixelcraft.G?.view);const qb=await mp.locator('#questHUD').boundingBox(),tb=await mp.locator('#touch .tops').boundingBox();assert.ok(tb.y>=qb.y+qb.height,'모바일 안내와 조작 버튼 분리');assert.equal(await mp.locator('#touch [data-key="KeyD"]').isVisible(),true);
 await mp.locator('#touch [data-act="inv"]').tap();assert.equal(await mp.locator('#panel').isVisible(),true);await mp.screenshot({path:path.join(out,'13-touch-inventory.png')});
 await mp.locator('#panel [data-close]').tap();await mp.screenshot({path:path.join(out,'14-touch-world.png')});
 await mobile.close();
 assert.deepEqual(errors,[]);console.log('PASS: setup, story, co-op, spectator toggle, trade, nether save/reload/return, End return, day-50 boss, three phases, skeleton summon, boss save/reload, 2P attack victory, portal ending, achievements, mobile; browser errors 0');
} catch(e) {await shot('FAILED');console.error('browser errors',errors);throw e;}
finally {await browser.close();server.close();}
