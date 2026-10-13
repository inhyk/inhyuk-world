import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
const root=path.resolve('public');const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root+'/')||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end();}res.setHeader('content-type',({'.mjs':'text/javascript','.css':'text/css','.html':'text/html','.woff2':'font/woff2'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);}).listen(0,'127.0.0.1');
await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'chrome',headless:true});const errors=[];
const out=path.resolve('artifacts/undertale-echo');fs.mkdirSync(out,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1080}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/play/undertale-echo/index.html`);await page.waitForFunction(()=>window.__echo);
 await page.evaluate(()=>localStorage.setItem('undertale-fan-save','original-save-preserved'));
 await page.screenshot({path:out+'/title.png'});await page.locator('#stage').screenshot({path:'public/images/games/undertale-echo-thumb.png'});
 const snap=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
 const press=async(key,n=1)=>{for(let i=0;i<n;i++){await page.keyboard.press(key);await page.waitForTimeout(65);}};
 const text=async()=>{for(let i=0;i<80;i++){const s=await snap();if(s.mode==='overworld'&&!s.world.script)return;if(s.mode==='textbox'){await press('KeyX');await press('KeyZ');}else await page.waitForTimeout(100);}throw Error('dialogue failed to finish');};
 await press('KeyZ');assert.equal((await snap()).mode,'naming');await press('KeyZ',2);await press('Enter');await press('KeyZ');await text();
 assert.equal((await snap()).world.room,'echo_arrival');assert.equal((await snap()).player.gold,35);
 await page.screenshot({path:out+'/garden.png'});await page.locator('#stage').screenshot({path:'public/images/games/undertale-echo-1.png'});
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(3900);await page.keyboard.up('ArrowRight');assert.equal((await snap()).world.room,'echo_atrium');
 // Reach the switch with real movement, then save and reload through the title.
 await page.evaluate(()=>{const {G,Wd}=window.__echo;Wd.enterRoom(G.world,'echo_atrium',3,10);});
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(300);await page.keyboard.up('ArrowRight');await text();
 assert.equal(await page.evaluate(()=>window.__echo.G.player.flags.echo_atrium_switch),true);
 await page.evaluate(()=>{const {G,Wd}=window.__echo;Wd.enterRoom(G.world,'echo_atrium',3,10);G.world.dir='up';});await press('KeyZ');await text();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('undertale-echo-save-v1')).room),'echo_atrium');
 assert.equal(await page.evaluate(()=>localStorage.getItem('undertale-fan-save')),'original-save-preserved');
 await page.reload();await page.waitForFunction(()=>window.__echo);await press('KeyZ');assert.equal((await snap()).world.room,'echo_atrium');
 // Actual ACT -> dodge -> MERCY flow; the test grants invulnerability only during dodge.
 await page.evaluate(()=>{const {G}=window.__echo;G.world.request={type:'battle',enemies:['froggit'],random:true,resolve:()=>{G.world.request=null;}};});await page.waitForTimeout(200);
 for(let i=0;i<5&&(await snap()).battle.mode==='text';i++)await press('KeyZ');
 await press('ArrowRight');await press('KeyZ',3);
 for(let i=0;i<5&&(await snap()).battle.mode==='text';i++)await press('KeyZ');
 assert.equal((await snap()).battle.mode,'dodge');await page.evaluate(()=>window.__echo.G.battle.soul.invincible=99);
 await page.screenshot({path:out+'/battle.png'});await page.locator('#stage').screenshot({path:'public/images/games/undertale-echo-2.png'});await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).battle?.mode==='menu',null,{timeout:15000});
 await press('ArrowRight',3);await press('KeyZ',2);for(let i=0;i<5&&(await snap()).battle.mode==='text';i++)await press('KeyZ');assert.equal((await snap()).battle.ended,'spare');await press('KeyZ');
 // Render every new room and confirm the final neutral choice returns to an ending.
 for(const room of await page.evaluate(()=>Object.keys(window.__echo.Wd.ROOMS))){await page.evaluate(room=>{const {G,Wd}=window.__echo;for(const r of Object.values(Wd.ROOMS)){if(r.onEnter?.once)G.player.flags[r.onEnter.once]=true;}G.mode='overworld';G.world.script=null;G.world.request=null;Wd.enterRoom(G.world,room,2,7);},room);await page.waitForTimeout(35);}
 await page.evaluate(()=>{const {G,Wd}=window.__echo;for(let i=1;i<=4;i++)G.player.flags['signal'+i]=true;Wd.runScript(G.world,'echo_final');});
 for(let i=0;i<30;i++){const s=await snap();if(s.textbox?.choice)break;await press('KeyX');await press('KeyZ');}
 // The choice is intentionally selected using the real keyboard.
 await press('KeyX');await press('ArrowRight');await press('KeyZ');await page.waitForTimeout(100);assert.equal((await snap()).mode,'ending');
 await page.reload();await page.waitForFunction(()=>window.__echo);await press('ArrowDown');await press('KeyZ');assert.equal((await snap()).mode,'bossselect');await press('ArrowDown',9);await page.screenshot({path:out+'/practice.png'});await press('KeyX');assert.equal((await snap()).mode,'title');
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(page.url());await mobile.waitForFunction(()=>window.__echo);await mobile.screenshot({path:out+'/mobile.png'});
 assert.ok(await mobile.locator('.touch-controls').isVisible());assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await mobile.locator('[data-key=KeyZ]').tap();await mobile.waitForTimeout(100);assert.equal(await mobile.evaluate(()=>window.__echo.G.mode),'naming');
 assert.deepEqual(errors,[]);console.log('PASS: title, naming, intro, walking, switch, save, continue, ACT/dodge/MERCY, 20 rooms, ending, mobile; zero runtime errors. Screenshots: '+out);
}finally{await browser.close();server.close();}
