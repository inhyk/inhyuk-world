import assert from 'node:assert/strict';
import {chromium} from '../../tools/node_modules/playwright/index.mjs';
// 사이트(iframe) 또는 게임 주소(DRIVE_URL)를 연다. 게임 주소를 직접 열 때 NET=http://127.0.0.1:8787 이면 로컬 net 서버를 쓴다.
const base=new URL(process.env.DRIVE_URL||'http://127.0.0.1:3000/play/free-drive');if(process.env.NET)base.searchParams.set('net',process.env.NET);
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const errors=[];const contexts=[];
 async function open(){const ctx=await browser.newContext({viewport:{width:1000,height:760}});contexts.push(ctx);ctx.setDefaultTimeout(120000);const p=await ctx.newPage();await p.addInitScript(()=>{const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(time=>{if(!window.pauseGraphics)cb(time);});});p.on('pageerror',e=>errors.push(e.message));await p.goto(base.href);await p.waitForLoadState('domcontentloaded');const iframe=await p.locator('iframe').count()?await p.locator('iframe').elementHandle():null;const f=iframe?await iframe.contentFrame():p.mainFrame();await f.waitForFunction(()=>window.freeDrive);return {p,f};}
 const host=await open();await host.f.locator('#multiplayer').click();await host.f.locator('#room-host').click();await host.f.waitForFunction(()=>window.freeDrive.getState().multiplayer.status==='waiting');const code=await host.f.evaluate(()=>window.freeDrive.getState().multiplayer.code);
 const guest=await open();await guest.f.locator('#multiplayer').click();await guest.f.locator('#room-code-input').fill(code);await guest.f.locator('#room-join').click();await guest.f.waitForFunction(()=>window.freeDrive.getState().vehicle.id==='guest-own');
 await host.f.evaluate(()=>window.pauseGraphics=true);
 const z=await guest.f.evaluate(()=>window.freeDrive.getState().position.z);await guest.p.keyboard.down('ArrowUp');await guest.f.waitForFunction(z=>window.freeDrive.getState().position.z>z+1,z,{timeout:15000});await guest.p.keyboard.up('ArrowUp');const state=await guest.f.evaluate(()=>window.freeDrive.getState());assert.ok(state.position.z>z+1,'2P must move immediately after joining using keyboard without relocating');await guest.f.evaluate(()=>window.pauseGraphics=true);await guest.p.keyboard.down('ArrowDown');await guest.f.waitForFunction(()=>Math.abs(window.freeDrive.getState().position.speed)<.1,null,{timeout:15000,polling:100});await guest.p.keyboard.up('ArrowDown');assert.deepEqual(errors,[]);
 console.log('PASS: 2P keyboard moves immediately inside site iframe even with host animation frames stopped.');
}finally{await browser.close();}
