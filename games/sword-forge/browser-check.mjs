import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1050}});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const url=process.env.SWORD_FORGE_URL||'http://127.0.0.1:5198/play/sword-forge/';
try{
 await page.goto(url,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'효과음 끄기'}).click();
 assert.equal(await page.locator('#gold').textContent(),'1,500');
 await page.locator('#enhance').click();await page.waitForFunction(()=>document.getElementById('sword-level').textContent==='+1');
 assert.equal(await page.locator('#gold').textContent(),'1,420');
 await page.keyboard.press('Space'); // Focus remains on button; native Space triggers a second upgrade.
 await page.waitForFunction(()=>document.getElementById('sword-level').textContent==='+2');
 await page.locator('#enhance').click();await page.waitForFunction(()=>document.getElementById('sword-level').textContent==='+3');
 await page.locator('#sell').click();
 await page.getByRole('button',{name:'더 강화하기'}).click();assert.equal(await page.locator('#sword-level').textContent(),'+3');
 await page.locator('#sell').click();await page.locator('#confirm-action').click();assert.equal(await page.locator('#sword-level').textContent(),'+0');
 await page.locator('[data-tab="hunt"]').click();await page.locator('[data-area="0"]').click();
 for(let i=0;i<8;i++) {if(await page.locator('[data-battle="attack"]').isDisabled())break;await page.locator('[data-battle="attack"]').click();await page.waitForTimeout(320);}
 assert.match(await page.locator('.battle-message').textContent(),/사냥 성공/);
 await page.locator('#leave-battle').click();
 await page.locator('[data-tab="shop"]').click();await page.locator('[data-claim="first"]').click();
 assert.equal(await page.locator('[data-claim="first"]').textContent(),'수령 완료');
 await page.reload();assert.equal(await page.locator('#sword-level').textContent(),'+0');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('immortal-sword-forge-v1')));assert.equal(saved.kills,1);assert.equal(saved.sales,1);assert.ok(saved.claimed.includes('first'));
 // A representative progressed save exercises high-level protection, collection and shop.
 await page.addInitScript(fixture=>{if(!sessionStorage.getItem('fixture-applied')){localStorage.setItem('immortal-sword-forge-v1',JSON.stringify(fixture));sessionStorage.setItem('fixture-applied','1');}}, {...saved,level:10,best:10,gold:75000,attempts:24,successes:15,protect:2,failures:0,found:Array.from({length:11},(_,i)=>i),sound:false});
 await page.reload();await page.locator('#protect').check();
 await page.evaluate(()=>{Math.random=()=>.9999;});await page.locator('#enhance').click();await page.waitForTimeout(1100);
 assert.equal(await page.locator('#sword-level').textContent(),'+10');assert.equal(await page.locator('#protect-count').textContent(),'1장');assert.match(await page.locator('#pity').textContent(),/8%p/);
 await page.reload();await page.waitForTimeout(500);await page.screenshot({path:'public/images/games/sword-forge-thumb.png',fullPage:true});
 await page.locator('[data-tab="hunt"]').click();await page.screenshot({path:'public/images/games/sword-forge-hunt.png',fullPage:true});
 await page.locator('[data-tab="collection"]').click();assert.equal(await page.locator('.sword-card').count(),31);await page.locator('[data-filter="2"]').click();assert.equal(await page.locator('.sword-card').count(),5);
 await page.setViewportSize({width:390,height:844});await page.locator('[data-tab="forge"]').click();await page.waitForTimeout(400);await page.screenshot({path:'public/images/games/sword-forge-mobile.png',fullPage:true});
 for(const tab of ['forge','hunt','collection','shop']){await page.locator(`[data-tab="${tab}"]`).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`mobile overflow ${tab}`);}
 await page.getByRole('button',{name:'게임 방법'}).click();assert.equal(await page.locator('dialog').isVisible(),true);await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('Browser checks passed: enhance, keyboard, sale, hunt, missions, reload, protection, collection, four mobile screens, dialog.');
}finally{await browser.close();}
