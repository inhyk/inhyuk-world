import {chromium} from '../../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const base=process.env.BASE_URL||'http://localhost:3000';
const errors=[];
async function setup(viewport,level,touch=false){
 const context=await browser.newContext({viewport,hasTouch:touch,isMobile:touch});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`${base}/play/dash-overdrive/classic/index.html?level=${level}`);
 await page.waitForFunction(()=>window.render_classic_status&&JSON.parse(window.render_classic_status()).ready);
 await page.evaluate(()=>{window.mapReads=[];const open=FS.open;FS.open=function(path,...args){if(typeof path==='string'&&path.includes('leveldata'))mapReads.push(path);return open.call(this,path,...args);};});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 return {page,context};
}
async function launch(page,level){
 await page.locator('#play').click();
 await page.waitForFunction(()=>JSON.parse(window.render_classic_status()).phase==='playing');
 assert.ok((await page.evaluate(()=>window.mapReads)).includes(`//res/leveldata/${level-1}.level`));
}
async function press(page,key){await page.keyboard.down(key);await page.waitForTimeout(90);await page.keyboard.up(key);await page.waitForTimeout(150);}
try{
 for(const level of [6,7]){
  const {page,context}=await setup({width:1440,height:900},level);
  if(level===6)await page.screenshot({path:'public/images/games/dash-overdrive-classic-menu.png'});
  await launch(page,level);
  await page.waitForTimeout(1300);
  await press(page,'Space');
  await page.screenshot({path:`public/images/games/dash-overdrive-classic-${level}.png`});
  await press(page,'Escape');
  // A stable central region proves the native engine paused; top FPS counter is excluded.
  const box=await page.locator('#canvas').boundingBox();
  const clip={x:box.x+box.width*.2,y:box.y+box.height*.3,width:Math.floor(box.width*.6),height:Math.floor(box.height*.5)};
  const frozen=await page.screenshot({clip});await page.waitForTimeout(300);
  assert.deepEqual(await page.screenshot({clip}),frozen);
  await press(page,'Space');
  await page.waitForTimeout(300);assert.notDeepEqual(await page.screenshot({clip}),frozen);
  console.log(`Level ${level}: correct native map, keyboard, pause and resume passed`);
  await context.close();
 }
 for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  const {page,context}=await setup(viewport,7,true);
  await page.screenshot({path:`/tmp/classic-mobile-${viewport.width}.png`});
  assert.ok(await page.locator('#play').isVisible());
  await launch(page,7);
  await page.waitForTimeout(1300);
  await page.evaluate(()=>{window.touchKeyReceived=false;window.addEventListener('keydown',event=>{if(event.code==='Space')window.touchKeyReceived=true;},{once:true});});
  const box=await page.locator('#canvas').boundingBox();
  const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width*.4,y:box.y+box.height*.5}]});
  await page.waitForTimeout(170);
  assert.equal(await page.evaluate(()=>window.touchKeyReceived),true);
  await page.screenshot({path:`/tmp/classic-mobile-playing-${viewport.width}.png`});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  console.log(`Mobile ${viewport.width}x${viewport.height}: layout, native Jumper and touch bridge passed`);
  await context.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
