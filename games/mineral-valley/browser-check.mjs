import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
const url=process.env.GAME_URL||'http://127.0.0.1:5186/';
const read=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
async function near(id){await page.evaluate(id=>{const t=window.__mineralTest;const o=t.ores.find(o=>o.id===id&&!t.P1.carried.includes(o)&&!t.P2.carried.includes(o));if(!o)throw new Error('missing ore');t.player.x=o.x;t.player.z=o.z;},id);await page.waitForFunction(id=>JSON.parse(window.render_game_to_text()).nearest?.id===id,id);}
try{
 await page.goto(url+'?test');await page.waitForFunction(()=>window.__mineralTest);await page.waitForTimeout(500);
 let s=await read();assert.equal(s.power,12);assert.equal(s.capacity,1);assert.equal(s.ores,1612);assert.equal(s.day.name,'아침');
 assert.match(s.coordinates,/30000×30000/);
 await page.keyboard.down('w');await page.waitForTimeout(350);await page.keyboard.up('w');assert.ok((await read()).player.z>22);
 await near(3);assert.equal((await read()).nearest.canLift,false);await page.keyboard.press('e');assert.equal((await read()).carried.length,0);
 await near(1);await page.click('#lift');const green=(await read()).carried[0];assert.equal(green.id,1);assert.ok(green.price>=100&&green.price<=125);
 // 운반 칸은 Lv.1에서 한 개뿐이라 두 번째 광석은 들 수 없다.
 await near(1);await page.waitForFunction(()=>document.getElementById('lift').textContent==='1개 가득 참');assert.equal(await page.locator('#lift').isDisabled(),true);await page.keyboard.press('e');assert.equal((await read()).carried.length,1);
 await page.click('#return');await page.click('#sell');s=await read();assert.equal(s.money,green.price);assert.equal(s.carried.length,0);
 await page.click('#shop');await page.click('[data-buy="strength"]');s=await read();assert.equal(s.money,green.price-100);assert.equal(s.power,16);await page.click('#close');
 await near(0);await page.click('#lift');const brown=(await read()).carried[0];assert.ok(brown.price<=-100);
 await page.click('#return');await page.click('#sell');assert.ok(await page.locator('#modal').evaluate(e=>e.open));assert.equal((await read()).money,green.price-100);
 await page.click('#confirm-sale');assert.equal((await read()).money,green.price-100+brown.price);
 await near(1);await page.keyboard.press('e');await page.click('#drop');assert.equal((await read()).carried.length,0);
 // 30,000m 맵의 경계에서 멈춘다.
 await page.evaluate(()=>{const t=window.__mineralTest;t.player.x=14950;t.player.z=14950;});await page.keyboard.down('w');await page.waitForTimeout(500);await page.keyboard.up('w');assert.ok((await read()).player.z<=14960);
 await page.click('#shop');assert.equal(await page.locator('#modal').evaluate(e=>e.open),false);
 // B 키가 상점을 연다.
 await page.evaluate(()=>window.__mineralTest.home());await page.keyboard.press('b');assert.equal(await page.locator('#modal').evaluate(e=>e.open),true);await page.click('#close');
 const money=(await read()).money;
 await page.reload();await page.waitForFunction(()=>window.__mineralTest);assert.equal((await read()).power,16);assert.equal((await read()).money,money);
 await page.click('#journal');assert.equal(await page.locator('.catalog article').count(),19);await page.click('#close');
 // 스크린샷은 갓 시작한 상태에서 찍는다. pagehide가 저장을 되살리므로 리셋 확인창을 쓴다.
 await page.click('#reset');await page.click('#confirm-reset');await page.waitForTimeout(1200);
 assert.equal((await read()).money,0);assert.equal((await read()).power,12);
 await page.screenshot({path:'public/images/games/mineral-valley-thumb.png'});
 await page.click('#journal');await page.screenshot({path:'public/images/games/mineral-valley-guide.png'});await page.click('#close');
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(url);await mobile.waitForFunction(()=>window.render_game_to_text);await mobile.waitForTimeout(400);
 assert.equal(await mobile.locator('#touch').isVisible(),true);assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const touch=await mobile.context().newCDPSession(mobile);const bounds=await mobile.locator('[data-move="w"]').boundingBox();await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2}]});await mobile.waitForTimeout(350);await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok(JSON.parse(await mobile.evaluate(()=>window.render_game_to_text())).player.z>20);
 await mobile.click('#shop');assert.ok(await mobile.locator('#modal').evaluate(e=>e.open));await mobile.click('#close');await mobile.screenshot({path:'/tmp/mineral-mobile.png'});
 assert.deepEqual(errors,[]);console.log('PASS: 30,000m map, one-slot start, movement, heavy rejection, weight-priced sale, upgrade, negative sale, drop, boundary, camp restriction, B shop key, persistence, 19-mineral guide, mobile controls; no browser errors.');
}finally{await browser.close();}
