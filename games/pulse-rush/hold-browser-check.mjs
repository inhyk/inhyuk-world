import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const url=process.env.PULSE_TEST_URL||'http://localhost:3020/play/pulse-rush/index.html';
const state=p=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const errors=[];
async function nextHold(p){return p.evaluate(()=>JSON.parse(window.render_game_to_text()).notes.find(n=>n.endTime));}
async function at(p,t){await p.waitForFunction(t=>JSON.parse(window.render_game_to_text()).time>=t,t,{polling:5});}
try{
 const p=await browser.newPage({viewport:{width:1440,height:1080}});p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await p.locator('#start').click();await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).phase==='playing');
 let hold=await nextHold(p);assert.ok(hold);const key=['d','f','j','k'][hold.lane];await at(p,hold.time);await p.keyboard.down(key);let s=await state(p);assert.ok(s.notes.find(n=>n.endTime&&n.holding));const before=s.counts.PERFECT+s.counts.GREAT+s.counts.GOOD;
 await p.screenshot({path:'/tmp/pulse-hold-desktop.png',fullPage:true});await p.locator('.player').screenshot({path:'public/images/games/pulse-rush-thumb.png'});
 await p.locator('#pause').click();s=await state(p);assert.equal(s.phase,'paused');await p.keyboard.up(key);await p.locator('#resume').click();await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).phase==='playing');await p.keyboard.down(key);
 await at(p,hold.endTime+.05);s=await state(p);assert.equal(s.counts.PERFECT+s.counts.GREAT+s.counts.GOOD,before+1);await p.keyboard.up(key);assert.equal((await state(p)).counts.BAD,0);
 // Releasing an upcoming hold early yields exactly one BAD.
 await p.locator('#restart').click();await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).time<1);hold=await nextHold(p);await at(p,hold.time);await p.keyboard.down(['d','f','j','k'][hold.lane]);await p.keyboard.up(['d','f','j','k'][hold.lane]);assert.equal((await state(p)).counts.BAD,1);
 const m=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});m.on('pageerror',e=>errors.push(e.message));await m.goto(url);await m.locator('#start').tap();await m.waitForFunction(()=>JSON.parse(window.render_game_to_text()).phase==='playing');hold=await nextHold(m);const pad=m.locator(`[data-lane="${hold.lane}"]`);
 const cdp=await m.context().newCDPSession(m);await at(m,hold.time);const box=await pad.boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2,id:1}]});assert.ok((await state(m)).notes.find(n=>n.holding));await m.screenshot({path:'/tmp/pulse-hold-mobile.png',fullPage:true});await at(m,hold.endTime+.05);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});s=await state(m);assert.equal(s.counts.PERFECT+s.counts.GREAT+s.counts.GOOD,1);assert.equal(s.counts.BAD,0);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:['keyboard hold','pause and regrab','one judgment at tail','early release BAD','real mobile long touch'],errors},null,2));
}finally{await browser.close();}
