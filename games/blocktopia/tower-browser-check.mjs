import assert from 'node:assert/strict';
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import { TOWERS,towerPlatforms } from './towers.mjs';
import { cleanSave,SAVE_KEY } from './core.mjs';
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.BLOCKTOPIA_URL||'http://127.0.0.1:5180/');
 const seeded=cleanSave({coins:7,checkpoint:6,won:true,towers:{berry:{checkpoint:12,completed:false},frost:{checkpoint:8,completed:false}}});
 await page.evaluate(({s,key})=>localStorage.setItem(key,JSON.stringify(s)),{s:seeded,key:SAVE_KEY});await page.reload();
 await page.locator('#start:not([disabled])').click();
 for(const tower of TOWERS){
  await page.locator('[data-action="towers"]').click();assert.equal(await page.locator('[data-tower]').count(),5);
  await page.locator(`[data-tower="${tower.id}"]`).click();await page.waitForFunction(id=>window.blocktopia.getState().activeTower===id,tower.id);
  if(tower.id==='berry'){await page.locator('#close-modal').waitFor({state:'visible'});assert.match(await page.locator('#modal').innerText(),/정복/);await page.locator('#close-modal').click();}
  await page.waitForFunction(()=>window.blocktopia.getState().position.grounded);
  const state=await page.evaluate(()=>window.blocktopia.getState());const cp=seeded.towers[tower.id].checkpoint,p=towerPlatforms(tower)[Math.max(0,cp-1)];assert.ok(Math.abs(state.position.x-p.x)<.1);assert.ok(Math.abs(state.position.y-p.top)<.1);assert.equal(state.checkpoint,6);assert.equal(state.won,true);
  if(tower.id==='frost'){await page.keyboard.press('Space');await page.waitForFunction(y=>window.blocktopia.getState().position.y>y+.3,p.top);await page.waitForFunction(()=>window.blocktopia.getState().position.grounded);}
  if(['berry','starlight','frost'].includes(tower.id)){await page.waitForTimeout(1200);await page.screenshot({path:`/tmp/blocktopia-${tower.id}-tower.png`});}
 }
 const done=await page.evaluate(()=>window.blocktopia.getState());assert.equal(done.coins,37);assert.equal(done.towers.berry.completed,true);
 await page.keyboard.press('r');assert.equal(await page.evaluate(()=>window.blocktopia.getState().activeTower),null);
 await page.locator('[data-action="towers"]').click();await page.locator('[data-tower="berry"]').click();await page.waitForFunction(()=>window.blocktopia.getState().position.grounded);assert.equal(await page.evaluate(()=>window.blocktopia.getState().coins),37);
 await page.reload();await page.locator('#start:not([disabled])').click();assert.equal(await page.evaluate(()=>window.blocktopia.getState().towers.berry.completed),true);
 await page.setViewportSize({width:390,height:844});await page.locator('[data-action="towers"]').click();assert.equal(await page.locator('[data-tower="starlight"]').isVisible(),true);await page.locator('[data-tower="starlight"]').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'/tmp/blocktopia-tower-mobile.png'});
 assert.deepEqual(errors,[]);console.log('PASS: 5 tower entries, checkpoints, real summit reward, no duplicate reward, jump, home, migration, reload and mobile layout.');
}finally{await browser.close();}
