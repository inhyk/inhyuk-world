import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const url=process.env.KEYCAP_TOWER_URL||'http://localhost:3000/play/keycap-tower/index.html';
const out=process.env.SHOTS||'public/images/games';
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];
const state=p=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const ready=p=>p.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).world3d.ready);
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('/favicon.ico'))errors.push(m.text());});
 await page.goto(url);await page.evaluate(()=>localStorage.clear());await page.reload();await ready(page);
 await page.waitForTimeout(500);await page.screenshot({path:`${out}/keycap-tower-start.png`});
 await page.locator('#play').click();assert.equal((await state(page)).playing,true);
 await page.waitForTimeout(1200);await page.screenshot({path:`${out}/keycap-tower-lobby.png`});
 // 걸어서 타워 입구의 첫 키캡을 밟는다
 await page.keyboard.down('KeyW');
 let st;for(let i=0;i<40;i++){await page.waitForTimeout(150);st=await state(page);if(st.player.grounded&&st.pathS>-2&&st.player.groundId==='lobby'&&i%2===0)await page.keyboard.press('Space');if(st.speed>=2)break;}
 await page.keyboard.up('KeyW');assert.ok(st.speed>=2,`speed ${st.speed}`);
 await page.screenshot({path:`${out}/keycap-tower-thumb.png`});
 // 러닝머신: 초콜릿은 바로 달리고, 골드는 사야 한다
 await page.evaluate(()=>window.keycap_tower_debug.tread(0));const before=(await state(page)).speed;await page.waitForTimeout(1500);
 st=await state(page);assert.equal(st.onTread,0);assert.ok(st.speed>before+3,`treadmill ${before} -> ${st.speed}`);
 await page.screenshot({path:`${out}/keycap-tower-treadmill.png`});
 await page.evaluate(()=>window.keycap_tower_debug.tread(1));await page.waitForTimeout(400);
 assert.match(await page.locator('#prompt').textContent(),/골드 러닝머신 사기/);
 await page.evaluate(()=>window.keycap_tower_debug.set({wins:5000}));await page.locator('#prompt').click();await page.waitForTimeout(600);
 st=await state(page);assert.deepEqual(st.treads,['0-1']);assert.equal(st.onTread,1);assert.equal(st.wins,4970);
 // 스탯 메뉴
 await page.locator('.actions [data-tab=stat]').click();await page.locator('[data-act="stat:power"]').click();await page.locator('[data-act="stat:power"]').click();
 st=await state(page);assert.equal(st.stats.power,2);await page.screenshot({path:`${out}/keycap-tower-stats.png`});
 await page.locator('.tabs [data-tab=tread]').click();await page.screenshot({path:`${out}/keycap-tower-menu-tread.png`});
 await page.locator('.tabs [data-tab=world]').click();assert.equal(await page.locator('[data-act="world:1"]').count(),0);
 await page.locator('#menu-close').click();
 // 아이템 상점: 그림대로 세 칸, 가격표 글자 그대로
 await page.locator('.actions [data-tab=item]').click();
 assert.deepEqual(await page.locator('.shop .rarity').allTextContents(),['일반','에픽','비밀']);
 assert.deepEqual(await page.locator('.shop .name').allTextContents(),['초콜릿','키캡','큰 키캡']);
 assert.deepEqual(await page.locator('.shop .mult').allTextContents(),['1.5배','3.0배','10.0배']);
 assert.deepEqual(await page.locator('.shop .price').allTextContents(),['3.0K트로피','100K트로피','1.0M트로피']);
 await page.screenshot({path:`${out}/keycap-tower-items.png`});
 await page.locator('[data-act="item:chocolate"]').click();st=await state(page);assert.deepEqual(st.items,['chocolate']);assert.equal(await page.locator('[data-act="item:chocolate"]').textContent(),'보유 중');
 // 스킨
 await page.locator('.tabs [data-tab=skin]').click();await page.locator('[data-act="skin:1"]').click();st=await state(page);assert.equal(st.skin,1);
 await page.screenshot({path:`${out}/keycap-tower-skins.png`});await page.locator('#menu-close').click();
 // 1시간마다 트로피 2배 이벤트
 await page.evaluate(()=>window.keycap_tower_debug.event(-(Date.now()/1000%3600)+5));assert.match(await page.locator('#event').textContent(),/트로피 2배 이벤트! 9:5\d 남음/);
 await page.evaluate(()=>window.keycap_tower_debug.event(-(Date.now()/1000%3600)+1800));assert.match(await page.locator('#event').textContent(),/다음 트로피 2배 이벤트까지 (29:5\d|30:00)/);
 await page.evaluate(()=>window.keycap_tower_debug.event(0));
 // 스테이지 구경
 for(const [w,cp,name] of [[0,2,'movers'],[0,3,'del'],[0,5,'spinner'],[0,7,'chaser'],[0,8,'summit'],[1,0,'world2'],[1,3,'neon'],[2,0,'world3'],[2,2,'lava'],[3,0,'world4'],[3,4,'galaxy'],[4,0,'world5'],[8,3,'world9'],[26,5,'world27'],[49,0,'world50'],[49,12,'world50-top']]){
  await page.evaluate(([w,cp])=>{window.keycap_tower_debug.set({speed:1e70});window.keycap_tower_debug.warp(w,cp);},[w,cp]);await page.waitForTimeout(900);
  st=await state(page);assert.equal(st.world3d.world,w);assert.equal(st.player.grounded,true,`grounded at ${name}`);
  await page.screenshot({path:`${out}/keycap-tower-${name}.png`});
 }
 // 월드 메뉴에서 1월드로 돌아가기, 환생
 await page.locator('.actions [data-tab=world]').click();await page.screenshot({path:`${out}/keycap-tower-menu-world.png`});
 // 광고: 10월드에 들어가면 뜨고, 10초 뒤에야 X가 눌린다
 await page.locator('[data-act="world:9"]').click();await page.waitForTimeout(400);assert.ok(await page.locator('#ad').isVisible());
 assert.match(await page.locator('#ad-close').textContent(),/^(10|9)초뒤에 X$/);assert.ok(await page.locator('#ad-close').isDisabled());
 assert.match(await page.locator('.ad-text').textContent(),/40개의 게임을 무료로 플레이하세요!.*9개의 종류가 있습니다!/);
 assert.equal(await page.locator('.ad-link').textContent(),'seonn.dev!');assert.equal(await page.locator('.ad-link').getAttribute('href'),'https://seonn.dev');
 await page.screenshot({path:`${out}/keycap-tower-ad.png`});
 await page.waitForTimeout(10500);assert.equal(await page.locator('#ad-close').textContent(),'X');await page.locator('#ad-close').click();assert.ok(!(await page.locator('#ad').isVisible()));
 await page.locator('.actions [data-tab=world]').click();
 await page.locator('[data-act="world:0"]').click();await page.waitForTimeout(500);st=await state(page);assert.equal(st.world,0);assert.equal(st.player.groundId,'lobby');
 await page.locator('.actions [data-tab=rebirth]').click({force:true});await page.locator('[data-act=rebirth]').click();await page.waitForTimeout(300);
 st=await state(page);assert.deepEqual([st.rebirths,st.speed,st.level],[1,0,0]);
 const fps=await page.evaluate(()=>new Promise(r=>{let n=0;const t0=performance.now();const f=()=>{n++;if(performance.now()-t0<2000)requestAnimationFrame(f);else r(n/2);};requestAnimationFrame(f);}));
 console.log('fps',fps,'meshes',st.world3d.meshes,'active',st.world3d.activeMeshes);
 // 저장: 새로고침해도 남는다
 await page.reload();await ready(page);st=await state(page);assert.equal(st.rebirths,1);assert.equal(st.stats.power,2);assert.equal(st.unlocked,49);assert.equal(st.skin,1);assert.deepEqual(st.items,['chocolate']);
 // 예전 저장(3월드, 환생 5번)도 그대로 열린다
 // 게임은 페이지를 떠날 때 저장하므로, 다른 페이지에서 저장값을 넣고 다시 연다.
 await page.goto(new URL('style.css',url).href);
 await page.evaluate(()=>localStorage.setItem('keycap-tower-v1',JSON.stringify({version:1,world:2,checkpoint:0,speed:2.59e10,wins:2.23e10,totalWins:3e10,rebirths:5,stats:{power:20,wins:5,tread:8,run:2,jump:1},treads:['0-1','0-2'],trails:[0],trail:0,unlocked:2,reached:[8,6,1,0],deaths:3,sound:true})));
 await page.goto(url);await ready(page);await page.locator('#play').click();await page.waitForTimeout(900);st=await state(page);assert.deepEqual([st.world,st.rebirths,st.level,st.world3d.world],[2,5,954,2]);await page.screenshot({path:`${out}/keycap-tower-old-save.png`});
 const m=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 m.on('pageerror',e=>errors.push(e.message));
 await m.goto(url);await ready(m);await m.screenshot({path:`${out}/keycap-tower-mobile-start.png`});
 await m.locator('#play').tap();await m.waitForTimeout(900);assert.ok(await m.locator('#stick').isVisible());assert.ok(await m.locator('#jump').isVisible());
 await m.screenshot({path:`${out}/keycap-tower-mobile.png`});
 assert.deepEqual(errors,[]);console.log('browser check ok');
}finally{await browser.close();}
