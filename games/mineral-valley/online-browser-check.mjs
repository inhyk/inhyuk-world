import assert from 'node:assert/strict';
import {chromium} from '../../tools/node_modules/playwright/index.mjs';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
const url=process.env.GAME_URL||'http://127.0.0.1:5186/';
const errors=[],pages=[];
const read=p=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
try{
 async function open(size={width:900,height:640}){
  const context=await browser.newContext({viewport:size});
  const p=await context.newPage();pages.push(p);p.on('pageerror',e=>errors.push(e.message));
  await p.goto(url+'?test',{waitUntil:'domcontentloaded',timeout:120000});
  await p.waitForFunction(()=>window.__mineralTest,null,{timeout:120000});
  return p;
 }
 const host=await open({width:1280,height:820});
 await host.evaluate(()=>{const t=window.__mineralTest;t.state.strength=30;t.state.cargo=4;t.state.money=50000;t.update();});
 await host.locator('#multiplayer').click();
 await host.locator('#room-host').click();
 await host.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online.status==='waiting',null,{timeout:30000});
 const code=(await read(host)).online.code;
 assert.equal(code.length,6);
 await host.locator('#room-close').click();

 const guest=await open();
 await guest.locator('#multiplayer').click();
 await guest.locator('#room-code-input').fill(code);
 await guest.locator('#room-join').click();
 await guest.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online.count===2,null,{timeout:40000});
 await host.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online.count===2,null,{timeout:30000});
 console.log('실제 WebRTC로 두 브라우저 연결됨:',code);

 // 방장의 지갑·강화가 손님에게 그대로 보인다
 await guest.waitForFunction(()=>JSON.parse(window.render_game_to_text()).capacity===5,null,{timeout:20000});
 let g=await read(guest);
 assert.equal(g.money,50000);assert.equal(g.power,Math.floor(12*1.4**30));
 // 손님이 움직이면 방장 화면의 친구도 움직인다
 const start=(await read(host)).player2.z;
 await guest.keyboard.down('w');await guest.waitForTimeout(1200);await guest.keyboard.up('w');
 await host.waitForFunction(z=>JSON.parse(window.render_game_to_text()).player2.z>z+8,start,{timeout:20000});
 const hostView=await read(host);
 assert.ok(Math.abs(hostView.player.z-20)<3,'방장은 제자리에 있어야 한다');
 console.log('손님 이동이 방장 화면에 반영됨');
 // 손님 화면에도 광물이 흘러 들어온다
 await guest.waitForFunction(()=>JSON.parse(window.render_game_to_text()).ores>40,null,{timeout:25000});
 g=await read(guest);
 console.log('손님이 받은 주변 광물',g.ores,'개');
 assert.ok(g.ores<700,`손님은 주변 광물만 받아야 한다 (${g.ores})`);
 // 손님이 광물을 줍는다 → 방장이 실제로 처리
 await host.evaluate(()=>{const t=window.__mineralTest;t.spawn(1,t.P2.x,t.P2.z);});
 await host.waitForFunction(()=>window.__mineralTest.P2.nearest?.id===1,null,{timeout:25000});
 await guest.keyboard.press('e');
 await host.waitForFunction(()=>window.__mineralTest.P2.carried.length===1,null,{timeout:20000});
 await guest.waitForFunction(()=>JSON.parse(window.render_game_to_text()).carried.length===1,null,{timeout:20000});
 console.log('손님이 주운 광물이 양쪽에 보임');
 // 손님이 판매 → 방장 지갑이 함께 늘어난다
 const before=(await read(host)).money;
 await guest.keyboard.press('r');
 await host.waitForFunction(()=>Math.hypot(window.__mineralTest.P2.x,window.__mineralTest.P2.z)<38,null,{timeout:20000});
 await guest.keyboard.press('f');
 await host.waitForFunction(m=>JSON.parse(window.render_game_to_text()).money>m,before,{timeout:20000});
 await guest.waitForFunction(m=>JSON.parse(window.render_game_to_text()).money>m,before,{timeout:20000});
 console.log('손님 판매가 공용 지갑에 반영됨');
 await host.screenshot({path:'public/images/games/mineral-valley-online.png'});
 await guest.screenshot({path:'/tmp/mineral-online-guest.png'});
 // 세 번째 사람은 거절
 const third=await open();
 await third.locator('#multiplayer').click();await third.locator('#room-code-input').fill(code);await third.locator('#room-join').click();
 await third.waitForFunction(()=>document.querySelector('#room-status').textContent.includes('이미 2명'),null,{timeout:30000});
 assert.equal((await read(host)).online.count,2);
 await third.close();
 // 손님이 나가면 각자 자기 계곡으로 돌아간다
 await guest.locator('#room-badge').click();await guest.locator('#room-leave').click();
 await host.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online.count<2,null,{timeout:20000});
 await guest.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online.count===0,null,{timeout:20000});
 g=await read(guest);
 assert.equal(g.money,0,'손님은 자기 저장으로 돌아와야 한다');
 assert.equal(g.capacity,1);
 assert.ok(g.ores>1000,'손님 계곡이 다시 채워져야 한다');
 console.log('나간 뒤 손님은 자기 저장과 계곡으로 복귀');
 assert.deepEqual(errors,[]);
 console.log('PASS: 실제 WebRTC 2인 방, 공용 지갑·강화, 손님 이동/줍기/판매, 광물 스트리밍, 3번째 거절, 퇴장 후 자기 저장 복구.');
}catch(error){
 console.log('PAGE ERRORS',errors);
 for(const p of pages)if(!p.isClosed())console.log(await p.evaluate(()=>({status:document.querySelector('#room-status')?.textContent,online:JSON.parse(window.render_game_to_text()).online})).catch(()=>'closed'));
 throw error;
}finally{await browser.close();}
