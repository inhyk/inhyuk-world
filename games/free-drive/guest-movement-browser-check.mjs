import assert from 'node:assert/strict';
import {chromium} from '../../tools/node_modules/playwright/index.mjs';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const errors=[];const contexts=[];
 async function open(){const ctx=await browser.newContext({viewport:{width:1000,height:760}});contexts.push(ctx);ctx.setDefaultTimeout(120000);const p=await ctx.newPage();await p.addInitScript(()=>{const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(time=>{if(!window.pauseGraphics)cb(time);});});p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.DRIVE_URL||'http://127.0.0.1:3000/play/free-drive');const f=await (await p.locator('iframe').elementHandle()).contentFrame();await f.waitForFunction(()=>window.freeDrive);return {p,f};}
 const host=await open();await host.f.locator('#multiplayer').click();await host.f.locator('#room-host').click();await host.f.waitForFunction(()=>window.freeDrive.getState().multiplayer.status==='waiting');const code=await host.f.evaluate(()=>window.freeDrive.getState().multiplayer.code);
 const guest=await open();await guest.f.locator('#multiplayer').click();await guest.f.locator('#room-code-input').fill(code);await guest.f.locator('#room-join').click();await guest.f.waitForFunction(()=>window.freeDrive.getState().vehicle.id==='guest-own');
 await host.f.evaluate(()=>window.pauseGraphics=true);
 const z=await guest.f.evaluate(()=>window.freeDrive.getState().position.z);await guest.p.keyboard.down('ArrowUp');await guest.f.waitForFunction(z=>window.freeDrive.getState().position.z>z+1,z,{timeout:15000});await guest.p.keyboard.up('ArrowUp');const state=await guest.f.evaluate(()=>window.freeDrive.getState());assert.ok(state.position.z>z+1,'2P must move immediately after joining using keyboard without relocating');await guest.f.evaluate(()=>window.pauseGraphics=true);await guest.p.keyboard.down('ArrowDown');await guest.f.waitForFunction(()=>Math.abs(window.freeDrive.getState().position.speed)<.1,null,{timeout:15000,polling:100});await guest.p.keyboard.up('ArrowDown');assert.deepEqual(errors,[]);
 console.log('PASS: 2P keyboard moves immediately inside site iframe even with host animation frames stopped.');
}finally{await browser.close();}
