import assert from 'node:assert/strict';
import {chromium} from '../../tools/node_modules/playwright/index.mjs';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
try{for(const mobile of [false,true]){
 const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.DRIVE_URL||'http://127.0.0.1:3000/play/free-drive/index.html');await page.waitForFunction(()=>window.freeDrive);
 for(const [id,x,z] of [['school',3,-58],['forest',3,92],['beach',73,24],['city',3,-15]]){
  await page.locator('#places').click();assert.equal(await page.locator('[data-place]').count(),4);await page.locator(`[data-place="${id}"]`).click();await page.waitForFunction(()=>window.freeDrive.getState().playing);const state=await page.evaluate(()=>window.freeDrive.getState());assert.equal(state.position.x,x);assert.ok(Math.abs(state.position.z-z)<=12);assert.equal(state.schoolZone,id==='school');
  if(id==='school'){await page.waitForFunction(()=>document.querySelector('#law-status').textContent.includes('30 km/h'));assert.match(await page.locator('#law-status').textContent(),/30 km\/h/);if(!mobile){await page.keyboard.press('c');await page.keyboard.press('c');}await page.waitForTimeout(800);await page.screenshot({path:`/tmp/free-drive-school-${mobile?'mobile':'desktop'}.png`});}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('#garage').click();
 }
 await page.close();
}assert.deepEqual(errors,[]);console.log('PASS: desktop/mobile four destination buttons, correct locations, school warning, return to garage and no viewport overflow.');}finally{await browser.close();}
