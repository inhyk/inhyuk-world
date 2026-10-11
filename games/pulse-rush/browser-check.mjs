import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const url=process.env.PULSE_TEST_URL||'http://127.0.0.1:5298/play/pulse-rush/index.html';
const errors=[];
const state=p=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
try{
const page=await browser.newPage({viewport:{width:1440,height:1080}});page.on('pageerror',e=>errors.push(e.message));assert.equal((await page.goto(url)).status(),200);await page.waitForFunction(()=>window.render_game_to_text);assert.equal(await page.locator('.song').count(),10);
for(let i=0;i<10;i++){await page.locator(`[data-song="${i}"]`).click();assert.equal((await state(page)).songId,i);assert.ok((await page.locator('#track-meta').textContent()).includes('BPM'));}
await page.locator('[data-song="0"]').click();await page.screenshot({path:'/tmp/pulse-rush-desktop.png',fullPage:true});
await page.locator('#start').click();await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).phase==='playing');
await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).time>=1.98);
const s=await state(page);await page.keyboard.press(['d','f','j','k'][s.notes[0].lane]);assert.ok((await state(page)).score>=450,'keyboard scores against real audio clock');
await page.screenshot({path:'/tmp/pulse-rush-play.png',fullPage:true});await page.locator('.player').screenshot({path:'public/images/games/pulse-rush-thumb.png'});
await page.locator('#pause').click();const frozen=await state(page);await page.waitForTimeout(250);assert.equal((await state(page)).time,frozen.time);await page.locator('#resume').click();await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).phase==='playing');await page.keyboard.press('Escape');assert.equal((await state(page)).phase,'paused');await page.locator('#leave').click();await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).phase==='select');
const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(url);await mobile.locator('[data-song="9"]').tap();await mobile.locator('#start').tap();await mobile.waitForFunction(()=>JSON.parse(window.render_game_to_text()).time>=1.98);const ms=await state(mobile);await mobile.locator(`[data-lane="${ms.notes[0].lane}"]`).tap();assert.ok((await state(mobile)).score>0,'touch scores');await mobile.screenshot({path:'/tmp/pulse-rush-mobile.png',fullPage:true});
// The shortest track runs to completion on its real Web Audio clock.
await mobile.waitForFunction(()=>JSON.parse(window.render_game_to_text()).phase==='result',{},{timeout:45000});const final=await state(mobile);assert.equal(Object.values(final.counts).reduce((a,b)=>a+b,0),final.total);assert.ok(await mobile.locator('#result-panel').isVisible());assert.ok(await mobile.evaluate(()=>JSON.parse(localStorage.getItem('pulse-rush-best-v2-holds'))['9']>=0));await mobile.locator('#retry').tap();await mobile.waitForFunction(()=>JSON.parse(window.render_game_to_text()).phase==='playing');assert.equal((await state(mobile)).score,0);await mobile.locator('#pause').tap();await mobile.locator('#leave').tap();await mobile.waitForFunction(()=>JSON.parse(window.render_game_to_text()).phase==='select');
for(const width of [320,390,768,1024,1440]){await mobile.setViewportSize({width,height:900});assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);}
assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:['10 track selections','real audio clock keyboard hit','pause freezes audio clock','resume and Escape','return to selection','mobile touch hit','complete track accounting and result','saved best','clean retry','responsive 320–1440px'],errors},null,2));
}finally{await browser.close();}
