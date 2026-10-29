import {chromium} from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {buildTrack,TRACKS} from '../../public/play/dash-overdrive/core.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const url='http://localhost:3000/play/dash-overdrive/index.html';
const read=p=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.waitForFunction(()=>window.render_game_to_text);
 await page.screenshot({path:'public/images/games/dash-overdrive-thumb.png'});
 await page.locator('#play').click();await page.keyboard.press('Space');await page.waitForTimeout(100);assert.ok((await read(page)).y>0);
 await page.keyboard.press('KeyP');assert.equal((await read(page)).state,'paused');const frozen=await read(page);await page.waitForTimeout(120);assert.deepEqual(await read(page),frozen);await page.locator('#retry').click();
 await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).state==='dead');await page.locator('#retry').click();assert.equal((await read(page)).attempt,2);
 await page.keyboard.press('KeyP');await page.locator('#sound').click();assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'true');await page.locator('#back').click();await page.locator('[data-track="1"]').click();assert.equal((await read(page)).level,1);await page.locator('[data-track="0"]').click();await page.locator('#play').click();
 // Play the entire real-time course using only keyboard controls and observed state.
 const objects=buildTrack(0);let holding=false,flightShot=false,cubeShot=false;
 const deadline=Date.now()+45000;
 while(Date.now()<deadline){
  const g=await read(page);if(g.state!=='playing'){assert.equal(g.state,'won',JSON.stringify(g));break;}
  let want=false;
  if(g.form==='ship') {const next=objects.find(o=>o.type==='wall'&&o.x+o.w>g.x);want=g.y+g.vy*.16<(next?next.h+TRACKS[0].gap/2-16:205);if(!flightShot&&g.x>3300){await page.screenshot({path:'public/images/games/dash-overdrive-flight.png'});flightShot=true;}}
  else {const next=objects.find(o=>['spike','block'].includes(o.type)&&o.x+o.w>g.x+6);if(next&&next.x>g.x&&next.x-g.x<130&&g.y<.5)await page.keyboard.press('Space');if(!cubeShot&&g.x>1800){await page.screenshot({path:'public/images/games/dash-overdrive-play.png'});cubeShot=true;}}
  if(want!==holding){await page.keyboard[want?'down':'up']('Space');holding=want;}
  await page.waitForTimeout(25);
 }
 if(holding)await page.keyboard.up('Space');assert.equal((await read(page)).state,'won');assert.ok(flightShot);await page.locator('#retry').click();assert.equal((await read(page)).level,1);await page.keyboard.press('KeyP');
 const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(url);await mobile.waitForFunction(()=>window.render_game_to_text);assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await mobile.screenshot({path:'public/images/games/dash-overdrive-mobile.png'});await mobile.locator('#play').tap();await mobile.locator('#world').tap({position:{x:150,y:400}});await mobile.waitForTimeout(80);assert.ok((await read(mobile)).y>0);await mobile.locator('#pause').tap();assert.equal((await read(mobile)).state,'paused');
 const blocked=await browser.newPage();await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}}));await blocked.goto(url);await blocked.locator('#play').click();assert.equal((await read(blocked)).state,'playing');assert.deepEqual(errors,[]);
 console.log('PASS: desktop/mobile controls, pause, retry, sound, track selection, real full-course victory with flight, next course, blocked storage; no browser errors.');
}finally{await browser.close();}
