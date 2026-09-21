import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
const url=process.env.GAME_URL||'http://127.0.0.1:5186/';
const read=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
async function near(id){await page.evaluate(id=>{const t=window.__mineralTest;const o=t.ores.find(o=>o.id===id);assertPresent(o);t.player.x=o.x;t.player.z=o.z;function assertPresent(v){if(!v)throw new Error('missing ore');}},id);await page.waitForFunction(id=>JSON.parse(window.render_game_to_text()).nearest?.id===id,id);}
try{
 await page.goto(url+'?test');await page.waitForFunction(()=>window.__mineralTest);await page.waitForTimeout(500);
 assert.equal((await read()).power,12);
 await page.keyboard.down('w');await page.waitForTimeout(350);await page.keyboard.up('w');assert.ok((await read()).player.z>22);
 await near(3);assert.equal((await read()).nearest.canLift,false);await page.keyboard.press('e');assert.equal((await read()).carried.length,0);
 await near(1);await page.click('#lift');assert.equal((await read()).carried[0].id,1);
 await page.click('#return');await page.click('#sell');assert.equal((await read()).money,100);assert.equal((await read()).carried.length,0);
 await page.click('#shop');await page.click('[data-buy="strength"]');assert.equal((await read()).money,0);assert.equal((await read()).power,16);await page.click('#close');
 await near(0);await page.click('#lift');await page.click('#return');await page.click('#sell');assert.ok(await page.locator('#modal').evaluate(e=>e.open));assert.equal((await read()).money,0);await page.click('#confirm-sale');assert.equal((await read()).money,-100);
 await near(1);await page.keyboard.press('e');await page.click('#drop');assert.equal((await read()).carried.length,0);
 await page.evaluate(()=>{const t=window.__mineralTest;t.player.x=495;t.player.z=495;});await page.keyboard.down('w');await page.waitForTimeout(500);await page.keyboard.up('w');assert.ok((await read()).player.z<=496);
 await page.click('#shop');assert.equal(await page.locator('#modal').evaluate(e=>e.open),false);
 await page.reload();await page.waitForFunction(()=>window.__mineralTest);assert.equal((await read()).power,16);assert.equal((await read()).money,-100);
 await page.click('#journal');assert.equal(await page.locator('.catalog article').count(),14);await page.click('#close');
 await page.evaluate(()=>{localStorage.clear();});await page.reload();await page.waitForFunction(()=>window.__mineralTest);await page.waitForTimeout(600);
 await page.screenshot({path:'public/images/games/mineral-valley-thumb.png'});
 await page.click('#journal');await page.screenshot({path:'public/images/games/mineral-valley-guide.png'});await page.click('#close');
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(url);await mobile.waitForFunction(()=>window.render_game_to_text);await mobile.waitForTimeout(400);
 assert.equal(await mobile.locator('#touch').isVisible(),true);assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const touch=await mobile.context().newCDPSession(mobile);const bounds=await mobile.locator('[data-move="w"]').boundingBox();await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2}]});await mobile.waitForTimeout(350);await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok(JSON.parse(await mobile.evaluate(()=>window.render_game_to_text())).player.z>20);
 await mobile.click('#shop');assert.ok(await mobile.locator('#modal').evaluate(e=>e.open));await mobile.click('#close');await mobile.screenshot({path:'/tmp/mineral-mobile.png'});
 assert.deepEqual(errors,[]);console.log('PASS: movement, heavy ore rejection, pickup, sale, upgrade, negative-sale confirmation, drop, boundaries, camp restriction, persistence, guide, mobile controls; no browser errors.');
}finally{await browser.close();}
