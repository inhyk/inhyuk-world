// 온라인 2인 방을 실제 브라우저 세 개와 net 서버(services/net)로 확인한다.
// 사용법:
//   npm run mineral-valley:dev   (게임, 주소를 GAME_URL 로)
//   GAME_URL=http://127.0.0.1:5173/ node games/mineral-valley/online-browser-check.mjs
// net 서버: MV_NET 이 없으면 services/net 에서 빈 로컬 D1 로 wrangler dev 를 새로 띄우고(포트 MV_NET_PORT, 기본 8841) 끝나면 끈다.
//   이미 띄운 로컬 서버: MV_NET=http://127.0.0.1:8787
//   진짜 서버(https://net.seonn.workers.dev): MV_NET=prod  (코드 방은 DB에 아무것도 남기지 않는다)
// 실제 화면 속도(60fps)로 보낸 수를 보려면 MV_CHANNEL=chrome MV_GPU=1 (기본은 소프트웨어 WebGL 이라 느리다)
// 화면 사진: MV_SHOTS (기본 /tmp), 이름은 net-mineral-valley-*.png
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '../../tools/node_modules/playwright/index.mjs';
const netDir=fileURLToPath(new URL('../../services/net/',import.meta.url));
let server=null,NET=process.env.MV_NET;
if(!NET){
 const state=await mkdtemp(join(tmpdir(),'mineral-net-'));
 execFileSync('npx',['wrangler','d1','migrations','apply','net','--local','--persist-to',state],{cwd:netDir,stdio:'ignore',env:{...process.env,CI:'1'}});
 const port=Number(process.env.MV_NET_PORT||8841);
 server=spawn('npx',['wrangler','dev','--port',String(port),'--ip','127.0.0.1','--persist-to',state],{cwd:netDir,detached:true,env:{...process.env,CI:'1'}});
 let log='';
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error(`wrangler dev 가 뜨지 않음\n${log}`)),60000);
  const read=chunk=>{log+=chunk;if(/Ready on/.test(log)){clearTimeout(timer);resolve();}};
  server.stdout.on('data',read);server.stderr.on('data',read);
  server.on('exit',code=>reject(Error(`wrangler dev 가 끝남 (${code})\n${log}`)));
 });
 NET=`http://127.0.0.1:${port}`;
}
const stopServer=()=>{if(server)try{process.kill(-server.pid,'SIGTERM');}catch{}};
const prod=NET==='prod';
const shots=process.env.MV_SHOTS||'/tmp';
const browser=await chromium.launch({headless:true,...(process.env.MV_CHANNEL?{channel:process.env.MV_CHANNEL}:{}),args:[...(process.env.MV_GPU?['--use-angle=metal']:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']),'--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
const url=process.env.GAME_URL||'http://127.0.0.1:5173/';
const query=prod?'?test':`?test&net=${encodeURIComponent(NET)}`;
console.log('net 서버:',prod?'wss://net.seonn.workers.dev (기본값)':NET);
const errors=[],pages=[];
const read=p=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
try{
 async function open(size={width:900,height:640}){
  const context=await browser.newContext({viewport:size});
  // 이 창이 net 서버로 보내는 메시지를 센다 (핑 포함). 1초 창에서 가장 많이 보낸 수를 본다.
  await context.addInitScript(()=>{
   const times=window.__netSends=[];const send=WebSocket.prototype.send;
   WebSocket.prototype.send=function(data){times.push(performance.now());return send.call(this,data);};
  });
  const p=await context.newPage();pages.push(p);p.on('pageerror',e=>errors.push(e.message));
  await p.goto(url+query,{waitUntil:'domcontentloaded',timeout:120000});
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
 console.log('net 서버로 두 브라우저 연결됨:',code);

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
 await host.screenshot({path:`${shots}/net-mineral-valley-host${prod?'-prod':''}.png`});
 await guest.screenshot({path:`${shots}/net-mineral-valley-guest${prod?'-prod':''}.png`});
 // 보낸 속도: 두 창이 함께 노는 5초 동안 1초 창마다 몇 개를 보냈는지 (서버 한도 30, 핑 포함).
 // 그동안 손님은 앞으로 가면서 휘두르기를 40번 몰아 누른다. 행동은 조작 메시지에 묶여 가서 보낸 수가 늘지 않는다.
 const measure=p=>p.evaluate(()=>new Promise(r=>{
  const t=window.__netSends,t0=performance.now(),n0=t.length;let frames=0;
  const f=()=>{frames++;if(performance.now()-t0<5000){requestAnimationFrame(f);return;}
   const s=t.slice(n0);let max=0;for(let i=0;i<s.length;i++){let n=0;for(let j=i;j<s.length&&s[j]<s[i]+1000;j++)n++;max=Math.max(max,n);}
   r({fps:frames/5,avg:s.length/5,max});};
  requestAnimationFrame(f);}));
 const measuring=Promise.all([measure(host),measure(guest)]);
 await guest.keyboard.down('w');
 for(let i=0;i<40;i++)await guest.keyboard.press('t',{delay:5});
 const [hostRate,guestRate]=await measuring;
 await guest.keyboard.up('w');
 for(const [name,rate] of [['방장',hostRate],['손님',guestRate]]){
  console.log(`${name} 보낸 메시지: 5초 평균 ${rate.avg.toFixed(1)}/초, 1초 최대 ${rate.max}개 (화면 ${rate.fps.toFixed(0)}fps)`);
  assert.ok(rate.max<30,`${name}이 1초에 ${rate.max}개를 보냈다`);
 }
 if(prod){await guest.locator('#room-badge').click();await guest.locator('#room-leave').click();assert.deepEqual(errors,[]);console.log('PASS (진짜 서버): 방 만들기, 코드로 들어가기, 양쪽 동기화.');await browser.close();process.exit(0);}
 // 세 번째 사람은 거절
 const third=await open();
 await third.locator('#multiplayer').click();await third.locator('#room-code-input').fill(code);await third.locator('#room-join').click();
 await third.waitForFunction(()=>document.querySelector('#room-status').textContent.includes('이미 2명'),null,{timeout:30000});
 assert.equal((await read(third)).online.count,0);
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
 // 새 손님이 같은 코드로 다시 들어온 뒤, 이번에는 방장이 창을 닫는다
 await guest.locator('#room-code-input').fill(code);await guest.locator('#room-join').click();
 await guest.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online.count===2,null,{timeout:30000});
 await guest.waitForFunction(()=>JSON.parse(window.render_game_to_text()).capacity===5,null,{timeout:20000});
 console.log('같은 코드로 다시 들어감');
 await host.close();
 await guest.waitForFunction(()=>document.querySelector('#room-status').textContent.includes('방장과 연결이 끊겼어요'),null,{timeout:40000});
 g=await read(guest);
 assert.equal(g.online.count,0);assert.equal(g.money,0,'방장이 나가면 손님은 자기 저장으로 돌아와야 한다');
 assert.ok(g.ores>1000);
 await guest.screenshot({path:`${shots}/net-mineral-valley-host-left.png`});
 console.log('방장이 나가면 손님은 안내를 보고 혼자 플레이로 복귀:',await guest.locator('#toast').innerText());
 assert.deepEqual(errors,[]);
 console.log('PASS: net 서버 2인 방, 공용 지갑·강화, 손님 이동/줍기/판매, 광물 스트리밍, 1초 30개 미만, 3번째 거절, 손님 퇴장 후 자기 저장 복구, 같은 코드 재입장, 방장 퇴장 처리.');
}catch(error){
 console.log('PAGE ERRORS',errors);
 for(const p of pages)if(!p.isClosed())console.log(await p.evaluate(()=>({status:document.querySelector('#room-status')?.textContent,online:JSON.parse(window.render_game_to_text()).online})).catch(()=>'closed'));
 throw error;
}finally{await browser.close();stopServer();}
