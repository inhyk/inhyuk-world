import assert from 'node:assert/strict';
import {chromium} from '../../tools/node_modules/playwright/index.mjs';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
try{for(const mobile of [false,true]){
 const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{if(!sessionStorage.getItem('seed')){localStorage.setItem('free-drive-v1',JSON.stringify({coins:2000,durability:{porsche:70,lamborghini:60}}));sessionStorage.setItem('seed','1');}});
 await page.goto(process.env.DRIVE_URL||'http://127.0.0.1:3000/play/free-drive/index.html');await page.waitForFunction(()=>window.freeDrive);
 for(const [id,remaining] of [['porsche',1200],['lamborghini',200]]){
  await page.locator('#shop').click();await page.locator(`[data-car="${id}"]`).click();await page.locator('#close').click();
  assert.equal(await page.evaluate(()=>window.freeDrive.getState().selected),id);
  await page.waitForTimeout(600);await page.screenshot({path:`/tmp/${id}-${mobile?'mobile':'desktop'}.png`});
  await page.locator('#start').click();await page.locator('#repair').click();await page.waitForFunction(()=>window.freeDrive.getState().vehicle.durability===100);assert.equal(await page.evaluate(()=>window.freeDrive.getState().coins),remaining);
  await page.locator('#interact').click();await page.waitForFunction(()=>window.freeDrive.getState().mode==='walking');await page.locator('#interact').click();await page.waitForFunction(()=>window.freeDrive.getState().mode==='driving');
  const before=await page.evaluate(()=>window.freeDrive.getState().position.z);await page.keyboard.down('w');await page.waitForFunction(z=>window.freeDrive.getState().position.z>z+.2,before);await page.keyboard.up('w');
  await page.reload();await page.waitForFunction(()=>window.freeDrive);const state=await page.evaluate(()=>window.freeDrive.getState());assert.equal(state.selected,id);assert.equal(state.vehicle.model,id);assert.equal(state.vehicle.durability,100);assert.equal(state.coins,remaining);
 }
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.close();
}assert.deepEqual(errors,[]);console.log('PASS: both supercars purchased at correct prices, repaired independently, entered/exited, driven, restored after reload, desktop/mobile rendering without runtime errors.');}finally{await browser.close();}
