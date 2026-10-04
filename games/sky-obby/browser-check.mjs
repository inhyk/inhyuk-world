import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const origin=process.env.SKY_OBBY_URL||'http://localhost:3000';
const out=process.env.SHOTS||'public/images/games';
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];
const state=p=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 assert.equal((await page.goto(origin+'/play/sky-obby')).status(),200);
 await page.goto(origin+'/play/sky-obby/index.html');await page.evaluate(()=>localStorage.clear());await page.reload();
 await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).world.ready);
 await page.waitForTimeout(500);await page.screenshot({path:`${out}/sky-obby-start.png`});
 await page.locator('#play').click();assert.equal((await state(page)).playing,true);
 await page.waitForTimeout(1600);await page.screenshot({path:`${out}/sky-obby-thumb.png`});
 const z0=(await state(page)).player.z;
 await page.keyboard.down('KeyW');await page.waitForTimeout(400);await page.keyboard.press('Space');await page.waitForTimeout(150);
 const air=await state(page);assert.equal(air.player.grounded,false,'jumping');
 await page.waitForTimeout(500);await page.keyboard.up('KeyW');await page.waitForTimeout(600);
 const after=await state(page);assert.ok(after.player.z>z0+3,`moved ${after.player.z}`);
 for(const [cp,name] of [[2,'movers'],[3,'spinner'],[6,'spiral'],[8,'combo'],[9,'ice'],[10,'conveyor'],[12,'lava-maze'],[14,'gate'],[33,'night'],[44,'aurora'],[57,'volcano'],[84,'space'],[99,'final']]){
  await page.evaluate(cp=>window.sky_obby_debug.warp(cp),cp);await page.waitForTimeout(700);
  await page.screenshot({path:`${out}/sky-obby-${name}.png`});
 }
 // 100스테이지 코스여도 가까운 구간만 그리고 초당 프레임이 충분한지 확인
 const diag=(await state(page)).world;assert.ok(diag.enabledGroups<diag.groups/5,`groups ${diag.enabledGroups}/${diag.groups}`);
 const fps=await page.evaluate(()=>new Promise(r=>{let n=0;const t0=performance.now();const f=()=>{n++;if(performance.now()-t0<2000)requestAnimationFrame(f);else r(n/2);};requestAnimationFrame(f);}));
 console.log('fps',fps,'active meshes',diag.activeMeshes,'groups',diag.enabledGroups,'/',diag.groups);
 // 기록 리셋: 취소하면 유지, 확인하면 최고 기록까지 지워지고 새로고침 후에도 유지
 // 게임은 페이지를 떠날 때 저장하므로, 다른 페이지에서 저장값을 넣고 다시 연다.
 await page.goto(origin+'/robots.txt');
 await page.evaluate(()=>localStorage.setItem('sky-obby-v1',JSON.stringify({version:1,checkpoint:5,deaths:7,time:80,best:95.5,finished:false,sound:true})));
 await page.goto(origin+'/play/sky-obby/index.html');await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).world.ready);
 await page.locator('#play').click();assert.equal(await page.locator('#best').textContent(),'1:35.5');
 await page.locator('#reset-records').click();assert.ok(await page.locator('#records-dialog').isVisible());
 assert.equal(await page.locator('#records-best').textContent(),'1:35.5');
 await page.locator('#cancel-records').click();await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).playing);assert.equal((await state(page)).best,95.5);
 await page.locator('#reset-records').click();await page.screenshot({path:`${out}/sky-obby-reset.png`});await page.locator('#confirm-records').click();await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).playing);
 let r=await state(page);assert.deepEqual([r.best,r.checkpoint,r.deaths,r.playing],[null,0,0,true]);
 assert.equal(await page.locator('#best').textContent(),'—');assert.equal(await page.locator('#stage-num').textContent(),'1');
 await page.reload();await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).world.ready);
 r=await state(page);assert.deepEqual([r.best,r.checkpoint,r.deaths],[null,0,0]);
 const m=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 m.on('pageerror',e=>errors.push(e.message));
 await m.goto(origin+'/play/sky-obby/index.html');await m.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).world.ready);
 await m.locator('#play').tap();await m.waitForTimeout(800);assert.ok(await m.locator('#stick').isVisible());assert.ok(await m.locator('#jump').isVisible());
 await m.screenshot({path:`${out}/sky-obby-mobile.png`});
 assert.deepEqual(errors,[]);console.log('browser check ok');
}finally{await browser.close();}
