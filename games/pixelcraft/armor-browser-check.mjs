import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { RECIPES, I } from '../../public/play/pixelcraft/data.mjs';
const base = process.env.PIXELCRAFT_TEST_URL || 'http://127.0.0.1:3051/play/pixelcraft/index.html';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 850 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const ev = fn => page.evaluate(fn);
try {
  await page.goto(base);
  await page.waitForFunction(() => window.__pixelcraft && !document.getElementById('slots').inert);
  await page.click('#slots .play >> nth=0'); await page.check('#nwCoop'); await page.fill('#nwName', '방어구 시험 세계'); await page.click('#nwCreate');
  await page.waitForSelector('#adventureDialog:not([hidden])'); await page.click('#adventureActions button:last-child');
  await ev(() => { const G = window.__pixelcraft.G; G.player.inv[0] = { id: 102, count: 24 }; });
  await page.keyboard.press('KeyE');
  // Production recipe-book crafting consumes exactly 24 ingots for a full iron set.
  await ev(() => { window.__pixelcraft.closePanel(); window.__pixelcraft.openPanel('table'); });
  for (const id of [I.IRON_HELMET, I.IRON_CHEST, I.IRON_LEGS, I.IRON_BOOTS]) {
    await page.click(`[data-s="rb:${RECIPES.find(r => r.out[0] === id).index}"]`);
    const index = await page.evaluate(id => window.__pixelcraft.G.player.inv.findIndex(s => s?.id === id), id);
    assert.ok(index >= 0);
    await page.click(`[data-s="i:${index}"]`, { modifiers: ['Shift'] });
  }
  assert.deepEqual(await ev(() => window.__pixelcraft.G.player.armor.map(s => s.id)), [174,175,176,177]);
  assert.equal(await ev(() => window.__pixelcraft.G.player.inv.some(s => s?.id === 102)), false);
  await ev(() => { const A=window.__pixelcraft; A.G.player.inv[0]={id:182,count:1,dur:363}; A.G.player.inv[1]={id:3,count:10}; A.closePanel(); A.openPanel('inv'); });
  await page.click('[data-s="i:0"]'); await page.click('[data-s="a:4"]');
  assert.equal(await ev(() => window.__pixelcraft.G.companion.armor[0].id),182);
  assert.equal(await ev(() => window.__pixelcraft.G.player.armor[0].id),174);
  await page.click('[data-s="i:1"]'); await page.click('[data-s="a:1"]');
  assert.equal(await ev(() => window.__pixelcraft.G.player.armor[1].id),175,'wrong item cannot replace armor');
  await page.click('[data-s="i:1"]');
  await page.screenshot({path:'artifacts/pixelcraft-adventure/18-armor-inventory.png'});
  await ev(() => { const A=window.__pixelcraft,G=A.G; A.closePanel(); for(let x=646;x<657;x++){A.setTile(x,50,3);for(let y=0;y<50;y++)A.setTile(x,y,0);} Object.assign(G.player,{x:650,y:48.2,vx:0,vy:0,fallTop:48.2,invT:0,hp:20});Object.assign(G.companion,{x:653,y:48.2,vx:0,vy:0,fallTop:48.2,invT:0,hp:20});G.mobs=[];G.time=0.2;G.arrows.push({x:650.3,y:49,vx:0.1,vy:0,from:'mob',dmg:10,life:2}); });
  await page.waitForFunction(() => window.__pixelcraft.G.player.hp < 20);
  assert.ok(Math.abs(await ev(() => window.__pixelcraft.G.player.hp)-16)<0.01,'iron armor reduces real projectile damage by 60%');
  await ev(() => { const G=window.__pixelcraft.G,p=G.companion;G.arrows.push({x:p.x+0.3,y:p.y+0.8,vx:0.1,vy:0,from:'mob',dmg:10,life:2}); });
  await page.waitForFunction(() => window.__pixelcraft.G.companion.hp < 20);
  assert.ok(Math.abs(await ev(() => window.__pixelcraft.G.companion.hp)-11.2)<0.01,'2P uses its own armor');
  await ev(() => { window.__pixelcraft.G.hintHidden=true; }); await page.waitForTimeout(500);
  await page.screenshot({path:'artifacts/pixelcraft-adventure/19-armor-world.png'});
  await ev(() => window.__pixelcraft.saveGame(true)); await page.reload();
  await page.waitForFunction(() => window.__pixelcraft && !document.getElementById('slots').inert);
  await page.click('#slots .play >> nth=0');
  assert.deepEqual(await ev(() => window.__pixelcraft.G.player.armor.map(s=>s.id)),[174,175,176,177]);
  assert.equal(await ev(() => window.__pixelcraft.G.companion.armor[0].id),182);
  const mobile = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const touch=await mobile.newPage();await touch.goto(base);
  await touch.waitForFunction(() => window.__pixelcraft && !document.getElementById('slots').inert);
  await touch.evaluate(() => {const A=window.__pixelcraft,G=A.newGame({seed:55,name:'방어구',mode:'survival',diff:1,slot:0,coop:true});A.startGame(G);});
  await touch.click('#adventureActions button:last-child');await touch.click('[data-act="inv"]');
  await touch.screenshot({path:'artifacts/pixelcraft-adventure/20-mobile-armor.png'});
  assert.equal(await touch.locator('[data-s="a:7"]').isVisible(),true);
  await mobile.close(); assert.deepEqual(errors,[]);
  console.log('PASS: crafting all iron armor, equip/unequip validation, separate 2P equipment, damage reduction, save/reload, mobile equipment UI');
} catch (error) { console.error(errors); await page.screenshot({path:'artifacts/pixelcraft-adventure/armor-check-failure.png'}); throw error; } finally { await browser.close(); }
