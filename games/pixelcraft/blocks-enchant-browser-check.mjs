import {chromium} from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.PIXELCRAFT_ARTIFACTS||'/tmp/pixelcraft-enchant';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1360,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const ev=(fn,arg)=>page.evaluate(fn,arg),shot=n=>page.screenshot({path:`${out}/${n}.png`});
async function fresh(mode='creative'){
 await ev(mode=>{const A=window.__pixelcraft,G=A.newGame({seed:1234,mode,diff:1,slot:0,name:'블록과 인챈트 시험'});G.adventure.storySeen=true;G.player.invT=999;A.startGame(G);},mode);
}
try{
 await page.goto(process.env.PIXELCRAFT_TEST_URL||'http://127.0.0.1:3055/play/pixelcraft/index.html');await page.waitForFunction(()=>window.__pixelcraft&&!document.getElementById('slots').inert);await fresh();
 const missing=await ev(async()=>{const{MC_BLOCK_IDS}=await import('./data.mjs'),{iconUrl}=await import('./textures.mjs');return Object.entries(MC_BLOCK_IDS).filter(([key,id])=>id&&!iconUrl[id]);});assert.deepEqual(missing,[]);
 await page.click('#blockCatalogButton');assert.equal(await page.locator('.catalog-cell').count(),48);await shot('catalog-desktop');await page.click('[data-page="1"]');assert.match(await page.textContent('.catalog-pager'),/2\//);
 await page.fill('#catalogSearch','벚나무');assert.ok(await page.locator('.catalog-cell').count()>5);await page.fill('#catalogSearch','cherry_planks');assert.equal(await page.locator('.catalog-cell').count(),1);await page.locator('.catalog-cell .slot').click({modifiers:['Shift']});
 const placed=await ev(async()=>{const A=window.__pixelcraft,G=A.G,{MC_BLOCK_IDS,B}=await import('./data.mjs'),id=MC_BLOCK_IDS.cherry_planks;A.closePanel();G.player.sel=G.player.inv.findIndex(s=>s?.id===id);for(let x=630;x<650;x++){for(let y=42;y<50;y++)A.setTile(x,y,0);A.setTile(x,50,B.STONE);}Object.assign(G.player,{x:640,y:48.2,vx:0,vy:0});const ok=A.placeBlock(638,49,id);A.saveGame(true);return {ok,id,tile:G.w.tiles[49*1280+638]};});assert.equal(placed.ok,true);assert.equal(placed.tile,placed.id);assert.ok(placed.id>255);
 await page.reload();await page.click('#slots .play >> nth=0');assert.equal(await ev(()=>window.__pixelcraft.G.w.tiles[49*1280+638]),placed.id);
 await ev(async()=>{const A=window.__pixelcraft,G=A.G,{I,durabilityOf}=await import('./data.mjs');G.player.inv[0]={id:I.DIAMOND_SWORD,count:1,dur:durabilityOf(I.DIAMOND_SWORD)};G.player.sel=0;});await page.click('#enchantButton');
 for(let n=1;n<=5;n++)await page.click('[data-enchant="sharpness"]');await page.click('[data-enchant="unbreaking"]');await shot('enchant-desktop');assert.equal(await ev(()=>window.__pixelcraft.G.player.inv[0].enchants.sharpness),5);assert.equal(await page.locator('[data-enchant="sharpness"]').isDisabled(),true);
 await page.setViewportSize({width:390,height:844});await shot('enchant-mobile');assert.equal(await ev(()=>document.documentElement.scrollWidth<=innerWidth),true);await ev(()=>window.__pixelcraft.closePanel());await page.click('#blockCatalogButton');await page.fill('#catalogSearch','');await page.selectOption('#catalogCategory','색깔');await shot('catalog-mobile');assert.ok(await page.locator('.catalog-cell').count()>0);assert.equal(await ev(()=>document.documentElement.scrollWidth<=innerWidth),true);await ev(()=>window.__pixelcraft.closePanel());await page.setViewportSize({width:1360,height:900});
 // A real inventory right-click split, chest quick move, save/reload, and keyboard drop retain enchantments.
 await ev(()=>window.__pixelcraft.openPanel('inv'));await page.click('[data-s="i:0"]',{button:'right'});await page.click('[data-s="i:8"]');await ev(async()=>{const A=window.__pixelcraft,G=A.G,{B}=await import('./data.mjs');A.closePanel();const i=49*1280+636;A.setTile(636,49,B.CHEST);G.chests.set(i,Array(27).fill(null));A.openPanel('chest',i);});await page.click('[data-s="i:8"]',{modifiers:['Shift']});assert.equal(await ev(()=>window.__pixelcraft.G.chests.get(49*1280+636)[0].enchants.sharpness),5);await page.click('[data-s="c:0"]',{modifiers:['Shift']});await ev(()=>{const A=window.__pixelcraft;A.closePanel();A.G.player.sel=A.G.player.inv.findIndex(s=>s?.enchants?.sharpness===5);A.saveGame(true);});await page.reload();await page.click('#slots .play >> nth=0');assert.equal(await ev(()=>window.__pixelcraft.G.player.inv.find(s=>s?.enchants?.sharpness===5).enchants.unbreaking),1);await page.keyboard.press('KeyQ');assert.equal(await ev(()=>window.__pixelcraft.G.drops.find(d=>d.enchants?.sharpness===5)?.enchants.unbreaking),1);
 // Survival catalog cannot grant blocks; a nearby real station charges XP and lapis only on success.
 await fresh('survival');await page.click('#blockCatalogButton');const before=await ev(()=>JSON.stringify(window.__pixelcraft.G.player.inv));await page.locator('.catalog-cell .slot').first().click({modifiers:['Shift']});assert.equal(await ev(()=>JSON.stringify(window.__pixelcraft.G.player.inv)),before);await ev(async()=>{const A=window.__pixelcraft,G=A.G,{B,I,durabilityOf}=await import('./data.mjs');A.closePanel();for(let x=630;x<650;x++){for(let y=42;y<50;y++)A.setTile(x,y,0);A.setTile(x,50,B.STONE);}Object.assign(G.player,{x:640,y:48.2,vx:0,vy:0,xp:70000,sel:0});G.player.inv=Array(36).fill(null);G.player.inv[0]={id:I.DIAMOND_PICK,count:1,dur:durabilityOf(I.DIAMOND_PICK)};G.player.inv[1]={id:I.LAPIS,count:12};A.setTile(638,49,B.ENCHANTING_TABLE);for(let x=635;x<638;x++)A.setTile(x,49,B.BOOKSHELF);});await page.click('#enchantButton');assert.match(await page.locator('.enchant-choice').filter({has:page.locator('[data-enchant="efficiency"]')}).textContent(),/경험치 3레벨 · 청금석 1개/);await page.click('[data-enchant="efficiency"]');await page.click('[data-enchant="efficiency"]');assert.deepEqual(await ev(()=>{const p=window.__pixelcraft.G.player;return {xp:p.xp,lapis:p.inv[1].count,lv:p.inv[0].enchants.efficiency};}),{xp:57967,lapis:9,lv:2});await page.click('[data-enchant="efficiency"]');assert.match(await page.textContent('.enchant-message'),/책장/);await page.click('[data-enchant="fortune"]');assert.equal(await page.locator('[data-enchant="silk_touch"]').isDisabled(),true);await shot('survival-enchant');
 await ev(()=>{const A=window.__pixelcraft;A.closePanel();A.G.target={x:638,y:49};A.doUse();});assert.equal(await ev(()=>window.__pixelcraft.UI.open),'enchant');await ev(()=>window.__pixelcraft.closePanel());
 // Mining awards XP and applies fortune; enchanted bow emits stronger, burning, infinite arrows without spending the last arrow.
 const mining=await ev(async()=>{const A=window.__pixelcraft,G=A.G,{B}=await import('./data.mjs');G.rng=()=>.99;G.player.xp=0;A.setTile(642,49,B.DIAMOND_ORE);A.breakBlock(642,49,{harvest:true});return {xp:G.player.xp,d:G.drops.find(d=>d.id===104)?.count};});assert.equal(mining.xp,3);assert.equal(mining.d,2);
 await ev(async()=>{const G=window.__pixelcraft.G,{I,durabilityOf}=await import('./data.mjs');G.player.inv[0]={id:I.BOW,count:1,dur:durabilityOf(I.BOW),enchants:{power:5,infinity:1,flame:1}};G.player.inv[1]={id:I.ARROW,count:1};G.player.sel=0;G.player.bowT=1;});await page.mouse.move(1000,300);await page.mouse.up({button:'right'});const bow=await ev(()=>{const G=window.__pixelcraft.G;return{a:G.arrows.at(-1),count:G.player.inv[1]?.count};});assert.equal(bow.count,1);assert.ok(bow.a.dmg>9);assert.equal(bow.a.flame,true);assert.equal(bow.a.infinite,true);
 // Co-op uses the same enchanted tool and preserves dropped equipment metadata.
 await fresh();
 const coop=await ev(async()=>{
  const A=window.__pixelcraft,G=A.G,{B,I,durabilityOf}=await import('./data.mjs');
  G.paused=true;G.adventure.coop=true;G.mobs=[];G.drops=[];
  for(let x=630;x<650;x++){for(let y=42;y<50;y++)A.setTile(x,y,0);A.setTile(x,50,B.STONE);}
  Object.assign(G.player,{x:640,y:48.2,sel:0});
  Object.assign(G.companion,{x:643,y:48.2,vx:0,vy:0,fallTop:48.2,face:1,attackT:0,spectator:false});
  G.player.inv=Array(36).fill(null);G.player.inv[0]={id:I.DIAMOND_SWORD,count:1,dur:100,enchants:{sharpness:5,knockback:2}};
  const mob=A.makeMob('zombie',644,48.2);mob.hp=100;G.mobs=[mob];A.keys.add('Slash');A.adventure.tick(0);A.keys.clear();
  const damage=100-mob.hp,knockback=mob.vx;G.mobs=[];
  G.player.inv[0]={id:I.DIAMOND_PICK,count:1,dur:100,enchants:{efficiency:5}};
  G.companion.attackT=0;A.setTile(644,49,B.STONE);A.keys.add('Period');A.adventure.tick(.1);A.keys.clear();
  const mined=G.w.tiles[49*1280+644]===B.AIR;
  G.drops=[{id:I.DIAMOND_SWORD,count:1,dur:77,enchants:{sharpness:5},x:643,y:48.2,age:1}];A.adventure.tick(0);
  const picked=G.player.inv.find(s=>s?.id===I.DIAMOND_SWORD);
  G.companion.armor[0]={id:I.DIAMOND_HELMET,count:1,dur:durabilityOf(I.DIAMOND_HELMET)-4,enchants:{mending:1}};
  G.player.inv[0]={id:I.EXPERIENCE_BOTTLE,count:1};A.doUse();
  const repaired=G.companion.armor[0].dur===durabilityOf(I.DIAMOND_HELMET);
  return {damage,knockback,mined,picked,repaired};
 });
 assert.equal(coop.damage,10);assert.equal(coop.knockback,14);assert.equal(coop.mined,true);assert.equal(coop.picked.enchants.sharpness,5);assert.equal(coop.picked.dur,77);assert.equal(coop.repaired,true);
 await page.click('#enchantButton');await page.click('[data-enchant-target="a:4"]');assert.match(await page.textContent('.enchant-target.selected'),/2P 착용/);
 await page.click('[data-enchant="protection"]');assert.equal(await ev(()=>window.__pixelcraft.G.companion.armor[0].enchants.protection),1);await shot('coop-enchant');
 await page.setViewportSize({width:390,height:844});await shot('coop-enchant-mobile');assert.equal(await ev(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await ev(()=>{window.__pixelcraft.closePanel();window.__pixelcraft.saveGame(true);});await page.reload();await page.click('#slots .play >> nth=0');
 assert.equal(await ev(()=>window.__pixelcraft.G.companion.armor[0].enchants.protection),1);
 assert.deepEqual(errors,[]);console.log('PASS: all registry icons, desktop/mobile catalog search/categories/pagination, real high-ID placement and reload, creative enchanting, maximum/conflicts, metadata across right-click/chest/reload/drop, survival read-only catalog and station/bookshelf/resource rules, right-click station, mining XP/fortune, power/flame/infinity bow, 2P sharpness/knockback/efficiency, enchanted drop pickup, shared XP mending, equipped 2P enchanting and reload; no page errors');
}catch(e){await shot('FAILED');console.error(errors);throw e;}finally{await browser.close();}
