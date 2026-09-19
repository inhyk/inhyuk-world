import assert from 'node:assert/strict';
import {chromium} from '../../tools/node_modules/playwright/index.mjs';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
try{
 for(const mobile of [false,true]){
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('http://127.0.0.1:3000/play/free-drive/index.html');
  await page.waitForFunction(()=>window.freeDrive);
  await page.locator('#shop').click();await page.locator('[data-car="ferrari"]').click();await page.locator('#close').click();
  await page.waitForFunction(()=>window.freeDrive.getState().modelStatus==='ready'&&window.freeDrive.getState().drivingModelStatus==='ready');
  assert.equal(await page.evaluate(()=>window.freeDrive.getState().coins),0);
  await page.reload();await page.waitForFunction(()=>window.freeDrive?.getState().modelStatus==='ready');
  assert.equal(await page.evaluate(()=>window.freeDrive.getState().selected),'ferrari');
  await page.locator('#start').click();await page.waitForTimeout(1800);
  await page.screenshot({path:`/tmp/ferrari-final-${mobile?'mobile':'desktop'}.png`});
  assert.equal(await page.locator('#durability').textContent(),'100 / 100');
  await page.locator('#interact').click();assert.equal(await page.evaluate(()=>window.freeDrive.getState().mode),'walking');
  await page.locator('#interact').click();assert.equal(await page.evaluate(()=>window.freeDrive.getState().mode),'driving');
  const before=await page.evaluate(()=>window.freeDrive.getState().position.z);
  if(mobile){const cdp=await page.context().newCDPSession(page),pad=await page.locator('[data-key="gas"]').boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pad.x+pad.width/2,y:pad.y+pad.height/2}]});await page.waitForFunction(z=>window.freeDrive.getState().position.z>z+.2,before);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  else {await page.keyboard.down('w');await page.waitForFunction(z=>window.freeDrive.getState().position.z>z+.2,before);await page.keyboard.up('w');}
  assert.ok(await page.evaluate(()=>window.freeDrive.getState().position.z)>before+.1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS: actual Ferrari loads without external requests, free purchase, reload persistence, desktop/mobile driving, durability and exit/re-entry.');
}catch(error){for(const context of browser.contexts())for(const page of context.pages())console.log(await page.evaluate(()=>window.freeDrive?.getState()));throw error;}finally{await browser.close();}
