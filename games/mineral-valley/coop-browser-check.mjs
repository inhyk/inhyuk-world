import {chromium} from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const b=await chromium.launch({channel:'chrome',headless:true});
try{
 const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:5186/?test');await p.waitForFunction(()=>window.__mineralTest);await p.waitForTimeout(400);
 const read=()=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
 const pixel=(x,y)=>p.evaluate(({x,y})=>[...document.getElementById('minimap').getContext('2d').getImageData(x,y,1,1).data].slice(0,3),{x,y});
 // 미니맵은 항상 플레이어를 가운데 두고 함께 움직인다.
 const camp=await pixel(90,90);
 await p.evaluate(()=>{const t=window.__mineralTest;t.player.x=9000;t.player.z=-6200;});await p.waitForTimeout(400);
 const far=await pixel(90,90);
 assert.deepEqual(far,camp);
 assert.match(await p.locator('#coords').innerText(),/X 24,000 \/ Z 8,800/);
 assert.match(await p.locator('#rarity').innerText(),/×1[0-9]\.[0-9]/);
 // 캠프에서 1,000m를 넘어서면 고급 광물이 제대로 나온다.
 await p.evaluate(()=>window.__mineralTest.recycle(4000));await p.waitForTimeout(300);
 const far900=await p.evaluate(()=>{const t=window.__mineralTest;const n=t.ores.filter(o=>Math.hypot(o.x-t.player.x,o.z-t.player.z)<900);return {all:n.length,rare:n.filter(o=>o.id>=3).length};});
 assert.ok(far900.rare/far900.all>.5,`먼 곳 희귀 비율 ${far900.rare}/${far900.all}`);
 await p.evaluate(()=>{const t=window.__mineralTest;t.home();t.recycle(4000);});await p.waitForTimeout(300);
 const nearCamp=await p.evaluate(()=>{const t=window.__mineralTest;const n=t.ores.filter(o=>Math.hypot(o.x,o.z)<900);return {all:n.length,rare:n.filter(o=>o.id>=3).length};});
 assert.ok(nearCamp.rare/nearCamp.all<.1,`캠프 희귀 비율 ${nearCamp.rare}/${nearCamp.all}`);
 assert.match(await p.locator('#rarity').innerText(),/×0\.25/);
 // 0.1% 초대형 광물은 훨씬 크고 훨씬 비싸다.
 await p.evaluate(()=>{const t=window.__mineralTest;t.state.strength=42;t.state.cargo=9;t.update();const o=t.spawn(13,t.player.x+10,t.player.z+10);Object.assign(o,{weight:32000*1.125*25,giant:true});});
 await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).nearest?.giant===true);
 let s=await read();
 assert.equal(s.nearest.price,5000000000*1.125*25*80);
 await p.waitForFunction(()=>document.getElementById('target-rank').textContent.includes('초대형'));
 assert.match(await p.locator('#target-name').innerText(),/초대형/);
 await p.keyboard.press('e');s=await read();assert.equal(s.carried[0].giant,true);
 await p.click('#return');await p.click('#sell');s=await read();assert.equal(s.money,5000000000*1.125*25*80);
 // 하루는 아침 10분 · 낮 10분 · 밤 10분.
 for(const [seconds,name,night] of [[60,'아침',false],[700,'낮',false],[1300,'밤',true],[1900,'아침',false]]){
  await p.evaluate(seconds=>{const t=window.__mineralTest;t.advanceEvents(seconds-t.state.playSeconds);},seconds);
  await p.waitForTimeout(250);
  assert.equal((await read()).day.name,name);
  assert.equal(await p.locator('#day-name').innerText(),name);
  assert.equal(await p.evaluate(()=>document.body.classList.contains('night')),night);
 }
 // 2 키로 두 명이 분할 화면에서 함께 플레이한다.
 await p.keyboard.press('2');await p.waitForTimeout(350);
 s=await read();assert.equal(s.twoPlayer,true);
 assert.equal(await p.evaluate(()=>document.body.classList.contains('coop')),true);
 assert.equal(await p.locator('#split-line').isVisible(),true);
 assert.equal(await p.locator('#coop').isVisible(),true);
 const start=await read();
 await p.keyboard.down('ArrowUp');await p.waitForTimeout(500);await p.keyboard.up('ArrowUp');await p.waitForTimeout(150);
 s=await read();assert.ok(s.player2.z>start.player2.z+5,'2P가 방향키로 움직여야 한다');assert.equal(s.player.z,start.player.z);
 await p.keyboard.down('w');await p.waitForTimeout(500);await p.keyboard.up('w');await p.waitForTimeout(150);
 const moved=await read();assert.ok(moved.player.z>start.player.z+5,'1P는 WASD로 움직여야 한다');
 // 2P는 마침표로 줍고 슬래시로 판매한다. 지갑과 강화는 함께 쓴다.
 await p.evaluate(()=>{const t=window.__mineralTest;t.P2.x=500;t.P2.z=500;t.spawn(4,500,500);});
 await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).nearest2?.id===4);
 await p.keyboard.press('.');s=await read();assert.equal(s.carried2.length,1);assert.equal(s.carried.length,0);
 const wallet=s.money,p2price=s.carried2[0].price;
 assert.ok(p2price>=100000&&p2price<=125000);
 await p.evaluate(()=>{const t=window.__mineralTest;t.P1.x=-9;t.P1.z=30;t.P1.facing=Math.PI;t.P2.x=9;t.P2.z=20;t.P2.facing=Math.PI*.8;});await p.waitForTimeout(600);
 await p.screenshot({path:'public/images/games/mineral-valley-coop.png'});
 await p.keyboard.press('/');s=await read();
 assert.equal(s.carried2.length,0);assert.equal(s.money-wallet,p2price);
 // 마침표로 주운 뒤 쉼표로 내려놓기
 await p.evaluate(()=>{const t=window.__mineralTest;t.P2.x=700;t.P2.z=700;t.spawn(2,700,700);});
 await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).nearest2?.id===2);
 await p.keyboard.press('.');assert.equal((await read()).carried2.length,1);
 await p.keyboard.press(',');assert.equal((await read()).carried2.length,0);
 // 다시 2를 누르면 1인 플레이로 돌아온다.
 await p.keyboard.press('2');await p.waitForTimeout(300);
 s=await read();assert.equal(s.twoPlayer,false);assert.equal(s.player2,null);
 assert.equal(await p.evaluate(()=>document.body.classList.contains('coop')),false);
 assert.equal(await p.locator('#coop').isVisible(),false);
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(300);
 await p.keyboard.press('2');await p.waitForTimeout(300);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await p.screenshot({path:'/tmp/mineral-coop-mobile.png'});
 assert.deepEqual(errors,[]);
 console.log('PASS: player-centred scrolling minimap, 1,000m rarity threshold, 0.1% giant ore size and price, morning/day/night cycle, split-screen two-player with independent movement, pickup, drop, shared wallet sale, toggle back, mobile layout.');
}finally{await b.close();}
