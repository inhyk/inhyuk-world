import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];
try{
 if (!process.argv.includes('--neo')) {
  const page=await browser.newPage({viewport:{width:1440,height:1050},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:3000/play/mettaton/index.html');
  await page.waitForFunction(()=>typeof window.render_game_to_text==='function');
  await page.screenshot({path:'/tmp/mettaton-desktop.png',fullPage:true});
  await page.locator('#stage').screenshot({path:'public/images/games/mettaton-ex-live-thumb.png'});
  await page.locator('#help-button').click();await page.getByRole('button',{name:'좋아, 준비됐어!'}).click();
  await page.locator('#start-button').click();await page.waitForTimeout(2800);
  const snapshot=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
  assert.equal((await snapshot()).mode,'menu');
  await page.locator('[data-action="fight"]').click();await page.waitForTimeout(625);await page.keyboard.press('KeyZ');
  assert.ok((await snapshot()).bossHp<9000);await page.waitForTimeout(2100);
  assert.equal((await snapshot()).mode,'dodge');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  const background=await snapshot();assert.equal(background.paused,true);
  assert.equal(await page.locator('#modal').isVisible(),false);
  await page.waitForTimeout(150);assert.deepEqual(await snapshot(),background);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  assert.equal((await snapshot()).paused,false);
  assert.equal(await page.locator('#modal').isVisible(),false);
  await page.keyboard.down('ArrowLeft');await page.waitForTimeout(300);await page.keyboard.up('ArrowLeft');
  assert.ok((await snapshot()).player.x<550);
  await page.waitForTimeout(1200);await page.screenshot({path:'/tmp/mettaton-battle.png',fullPage:true});
  await page.locator('#stage').screenshot({path:'public/images/games/mettaton-ex-live-1.png'});
  await page.keyboard.press('Escape');const paused=await snapshot();assert.equal(paused.paused,true);
  await page.waitForTimeout(400);assert.deepEqual(await snapshot(),paused);
  await page.getByRole('button',{name:'계속하기  ↗',exact:true}).click();assert.equal((await snapshot()).paused,false);
  await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='menu',{},{timeout:15000});
  await page.locator('[data-action="act"]').click();await page.getByRole('button',{name:'춤추기'}).click();
  assert.ok((await snapshot()).ratings>0);
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'타이틀로 돌아가기'}).click();
  assert.equal((await snapshot()).mode,'lobby');
  const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto('http://127.0.0.1:3000/play/mettaton/index.html');
  await mobile.waitForFunction(()=>typeof window.render_game_to_text==='function');
  await mobile.screenshot({path:'/tmp/mettaton-mobile.png',fullPage:true});
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await mobile.locator('#start-button').tap();await mobile.waitForTimeout(2800);
  await mobile.locator('[data-action="fight"]').tap();await mobile.locator('#strike-button').tap();await mobile.waitForTimeout(1900);
  await mobile.screenshot({path:'/tmp/mettaton-mobile-battle.png',fullPage:true});
  if (!await mobile.locator('#touch-controls').isVisible()) console.log(await mobile.evaluate(()=>({state:JSON.parse(window.render_game_to_text()),className:document.getElementById('app').className,display:getComputedStyle(document.getElementById('touch-controls')).display,pointer:matchMedia('(pointer:coarse)').matches,narrow:matchMedia('(max-width:650px)').matches,viewport:innerWidth,css:[...document.styleSheets[0].cssRules].filter(r=>r.cssText.includes('touch-controls')).map(r=>r.cssText)})));
  assert.equal(await mobile.locator('#touch-controls').isVisible(),true);
  await mobile.locator('[data-key="ArrowRight"]').dispatchEvent('pointerdown',{pointerId:1});
  await mobile.waitForTimeout(200);await mobile.locator('[data-key="ArrowRight"]').dispatchEvent('pointerup',{pointerId:1});
  assert.ok((await mobile.evaluate(()=>JSON.parse(window.render_game_to_text()))).player.x>560);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({desktop:'passed',mobile:'passed',combat:'passed',pause:'passed',consoleErrors:errors,screenshots:['/tmp/mettaton-desktop.png','/tmp/mettaton-battle.png','/tmp/mettaton-mobile.png','/tmp/mettaton-mobile-battle.png']},null,2));
 } else {
  const report=[];
  for (const difficulty of ['easy','normal','hard']) {
    const context=await browser.newContext({viewport:{width:1440,height:1050}});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    // A one-hit boss fixture reaches the real victory controller without a test backdoor in the shipped game.
    await page.route('**/core.mjs',async route=>{
      const response=await route.fetch();
      const body=(await response.text()).replace(/bossHp: (6600|9000|12000)/g,'bossHp: 1');
      await route.fulfill({response,body});
    });
    await page.goto('http://127.0.0.1:3000/play/mettaton/index.html');
    await page.waitForFunction(()=>typeof window.render_game_to_text==='function');
    const snapshot=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
    assert.equal(await page.locator('#neo-button').isDisabled(),true);
    await page.locator('#neo-button').dispatchEvent('click');assert.equal((await snapshot()).difficulty,'normal');
    if(difficulty==='hard')await page.screenshot({path:'/tmp/mettaton-neo-locked.png',fullPage:true});
    await page.locator(`[data-difficulty="${difficulty}"]`).click();
    await page.locator('#start-button').click();
    await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='menu');
    assert.equal((await snapshot()).difficulty,difficulty);
    await page.locator('[data-action="fight"]').click();await page.keyboard.press('KeyZ');
    await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='won');
    const unlocked=difficulty==='hard';
    assert.equal((await snapshot()).neoUnlocked,unlocked);
    assert.equal(await page.locator('.neo-unlock').isVisible(),unlocked);
    if(unlocked)await page.screenshot({path:'/tmp/mettaton-neo-unlocked.png',fullPage:true});
    await page.unroute('**/core.mjs');await page.reload();
    await page.waitForFunction(()=>typeof window.render_game_to_text==='function');
    assert.equal(await page.locator('#neo-button').isDisabled(),!unlocked);
    if(unlocked) {
      await page.locator('#neo-button').click();
      assert.equal((await snapshot()).boss,'neo');assert.equal((await snapshot()).bossHp,16000);
      assert.equal(await page.locator('.difficulty .selected').count(),1);
      assert.equal(await page.locator('#neo-button').getAttribute('aria-pressed'),'true');
      await page.waitForTimeout(250);await page.screenshot({path:'/tmp/mettaton-neo-title.png',fullPage:true});
      await page.locator('#start-button').click();
      await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='menu');
      await page.locator('[data-action="act"]').click();await page.getByRole('button',{name:'멋진 포즈'}).click();
      await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='dodge');
      await page.keyboard.down('KeyZ');await page.waitForTimeout(2600);
      assert.equal((await snapshot()).pattern,'NEO BLASTER');assert.ok((await snapshot()).bullets>0);
      await page.screenshot({path:'/tmp/mettaton-neo-battle.png',fullPage:true});await page.keyboard.up('KeyZ');
      await page.setViewportSize({width:390,height:844});await page.reload();
      await page.waitForFunction(()=>typeof window.render_game_to_text==='function');await page.locator('#neo-button').click();
      await page.waitForTimeout(250);await page.screenshot({path:'/tmp/mettaton-neo-mobile.png',fullPage:true});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      const start=await page.locator('#start-button').boundingBox(),stage=await page.locator('#stage').boundingBox();
      assert.ok(start.y+start.height<stage.y+stage.height);
    }
    report.push({difficulty,neoUnlocked:unlocked,persisted:true});await context.close();
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify({unlockCases:report,neoBattle:'passed',mobile:'passed',errors},null,2));
 }
}finally{await browser.close();}
