import {chromium} from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const a=await browser.newContext({viewport:{width:1280,height:800}}),b=await browser.newContext({viewport:{width:1280,height:800},hasTouch:true,isMobile:true});
const host=await a.newPage(),guest=await b.newPage();
const errors=[];for(const p of [host,guest]){p.on('pageerror',e=>{errors.push(e.stack);console.log('PAGEERROR',e.stack)});p.on('console',m=>{if(m.type()==='error')console.log('console',m.text())});}
await (await import('node:fs/promises')).mkdir('artifacts/pixelcraft-online',{recursive:true});
const url=process.env.PIXELCRAFT_TEST_URL||'http://127.0.0.1:3057/play/pixelcraft/?net=http://127.0.0.1:8793';
try{
await Promise.all([host.goto(url),guest.goto(url)]);
await Promise.all([host.waitForFunction(()=>window.__pixelcraft),guest.waitForFunction(()=>window.__pixelcraft)]);
await host.evaluate(()=>{const t=window.__pixelcraft;const g=t.newGame({name:'온라인 확인',seed:1234,mode:'creative',diff:0,slot:0,worldType:'builder'});g.adventure.storySeen=true;t.startGame(g);for(let x=625;x<660;x++){for(let y=40;y<50;y++)t.setTile(x,y,0);t.setTile(x,50,3);g.w.surface[x]=50;}Object.assign(g.player,{x:632,y:48.2,vx:0,vy:0,fallTop:48.2});});
await host.locator('#onlineButton').click();await host.locator('#onlineHost').click();await host.waitForFunction(()=>__pixelcraft.online.code.length===6);
const code=await host.evaluate(()=>__pixelcraft.online.code);console.log('CODE',code);
await guest.locator('#btnOnline').click();await guest.locator('#onlineInput').fill(code);await guest.locator('#onlineJoin').click();
await guest.waitForFunction(()=>__pixelcraft.G?.remoteReplica&&__pixelcraft.online.ready,{timeout:30000});
await host.waitForFunction(()=>__pixelcraft.online.ready);
await host.locator('#onlineClose').click();
console.log('connected',await guest.evaluate(()=>({p:__pixelcraft.G.player.x,inv:__pixelcraft.G.player.inv.length})));
await guest.keyboard.down('d');await guest.waitForTimeout(700);await guest.keyboard.up('d');await guest.waitForTimeout(400);
console.log('movement',await host.evaluate(()=>({host:__pixelcraft.G.player.x,guest:__pixelcraft.G.companion.x,same:__pixelcraft.G.player.inv===__pixelcraft.G.companion.inv})));
assert.equal(await host.evaluate(()=>__pixelcraft.G.player.inv===__pixelcraft.G.companion.inv),false);

// Changes made by one player reach the other, including 16-bit block IDs.
const tile=await host.evaluate(async()=>{const A=__pixelcraft,{MC_BLOCK_IDS}=await import('./data.mjs'),x=640,y=49,id=MC_BLOCK_IDS.cherry_planks;A.setTile(x,y,id);return {i:y*1280+x,id};});
await guest.waitForFunction(({i,id})=>__pixelcraft.G.w.tiles[i]===id,tile);
// Guest equipment is authoritative on the host, and enchanting cannot touch host gear.
await host.evaluate(async()=>{const {I}=await import('./data.mjs'),G=__pixelcraft.G;G.player.inv[10]={id:I.DIAMOND_SWORD,count:1,dur:100};G.companion.inv[10]={id:I.DIAMOND_SWORD,count:1,dur:99};});
await guest.waitForFunction(()=>__pixelcraft.G.player.inv[10]?.dur===99);
await guest.locator('#enchantButton').click();await guest.locator('[data-enchant-target="i:10"]').click();
await guest.locator('[data-enchant="sharpness"]').click();
await host.waitForFunction(()=>__pixelcraft.G.companion.inv[10]?.enchants?.sharpness===1);
assert.equal(await host.evaluate(()=>__pixelcraft.G.player.inv[10]?.enchants),undefined);
await guest.evaluate(()=>__pixelcraft.closePanel());await guest.waitForFunction(()=>!__pixelcraft.UI.open);
// Crafting and armor clicks are replayed by the host with the guest's own inventory.
await host.evaluate(async()=>{const {I,B}=await import('./data.mjs'),p=__pixelcraft.G.companion;p.inv[11]={id:B.OAK_LOG,count:8};p.inv[12]={id:I.DIAMOND_HELMET,count:1,dur:100};});
await host.evaluate(async()=>{const {B}=await import('./data.mjs');__pixelcraft.setTile(636,49,B.CRAFTING);});await guest.waitForFunction(()=>__pixelcraft.G.w.tiles[49*1280+636]!==0);await guest.evaluate(()=>__pixelcraft.openPanel('table',49*1280+636));await guest.locator('[data-s="g:0"]').waitFor();
await guest.locator('[data-s="i:11"]').click();await guest.locator('[data-s="g:0"]').click({button:'right'});await guest.locator('[data-s="i:11"]').click();
await guest.locator('[data-s="o"]').click();await guest.locator('[data-s="i:13"]').click();
await guest.locator('[data-s="i:12"]').click({modifiers:['Shift']});
await host.waitForFunction(()=>__pixelcraft.G.companion.armor[0]?.dur===100&&__pixelcraft.G.companion.inv[13]?.count===4);
assert.equal(await host.evaluate(()=>__pixelcraft.G.player.armor[0]),null);
await guest.evaluate(()=>__pixelcraft.closePanel());await guest.waitForFunction(()=>!__pixelcraft.UI.open);
// Both players race to withdraw one chest stack. Exactly one inventory receives it.
const chest=await host.evaluate(async()=>{const A=__pixelcraft,G=A.G,{B,I}=await import('./data.mjs');Object.assign(G.player,{x:638,y:48.2});Object.assign(G.companion,{x:640,y:48.2,vx:0,vy:0});const i=49*1280+639;A.setTile(639,49,B.CHEST);const slots=Array(27).fill(null);slots[0]={id:I.DIAMOND,count:7};G.chests.set(i,slots);return {i,id:I.DIAMOND};});
await guest.waitForFunction(({i})=>__pixelcraft.G.chests.has(i),chest);
await host.evaluate(i=>__pixelcraft.openPanel('chest',i),chest.i);await guest.evaluate(i=>__pixelcraft.openPanel('chest',i),chest.i);
await guest.locator('[data-s="c:0"]').waitFor();
await Promise.all([host.locator('[data-s="c:0"]').click({modifiers:['Shift']}),guest.locator('[data-s="c:0"]').click({modifiers:['Shift']})]);
await guest.waitForTimeout(600);
const total=await host.evaluate(({id,i})=>{const G=__pixelcraft.G;return [...G.player.inv,...G.companion.inv,...G.chests.get(i)].reduce((n,s)=>n+(s?.id===id?s.count:0),0)},chest);assert.equal(total,7);
await host.evaluate(()=>__pixelcraft.closePanel());await guest.evaluate(()=>__pixelcraft.closePanel());await guest.waitForFunction(()=>!__pixelcraft.UI.open);
// Guest action sends real input through the relay; a short right-click places a block.
await host.evaluate(async()=>{const A=__pixelcraft,G=A.G;for(let x=636;x<647;x++)for(let y=46;y<50;y++)A.setTile(x,y,0);Object.assign(G.player,{x:637,y:48.2,vx:0,vy:0});Object.assign(G.companion,{x:641,y:48.2,vx:0,vy:0});});
await guest.waitForFunction(()=>Math.abs(__pixelcraft.G.player.x-641)<.1);
await guest.keyboard.press('Digit3');await guest.waitForTimeout(1000);
const point=await guest.evaluate(()=>{const {view:v}=__pixelcraft.G,c=document.getElementById('game'),d=c.width/c.clientWidth;return {x:(644.5-v.left)*v.T/d,y:(49.5-v.top)*v.T/d};});
await guest.mouse.click(point.x,point.y,{button:'right',delay:120});
await guest.waitForTimeout(800);console.log('PLACEMENT',await host.evaluate(()=>({tile:__pixelcraft.G.w.tiles[49*1280+644],sel:__pixelcraft.G.companion.sel,pos:{x:__pixelcraft.G.companion.x,y:__pixelcraft.G.companion.y},mode:__pixelcraft.G.mode})),await guest.evaluate(()=>({mouse:__pixelcraft.mouse,target:__pixelcraft.G.target,place:__pixelcraft.G.placeAt})));
await host.waitForFunction(()=>__pixelcraft.G.w.tiles[49*1280+644]===3);
await guest.waitForFunction(()=>__pixelcraft.G.w.tiles[49*1280+644]===3);
await guest.mouse.down();await guest.waitForTimeout(500);await guest.mouse.up();
await host.waitForFunction(()=>__pixelcraft.G.w.tiles[49*1280+644]===0);

// Host dimension change replaces the guest world, preserving separate inventories.
await host.evaluate(()=>__pixelcraft.adventure.switchDimension('nether'));
await guest.waitForFunction(()=>__pixelcraft.G.adventure.dimension==='nether',null,{timeout:30000});
assert.equal(await guest.evaluate(()=>__pixelcraft.G.player.inv[10].enchants.sharpness),1);
await host.evaluate(()=>__pixelcraft.adventure.switchDimension());
await guest.waitForFunction(()=>__pixelcraft.G.adventure.dimension==='overworld',null,{timeout:30000});
await guest.screenshot({path:'artifacts/pixelcraft-online/guest.png'});
await host.screenshot({path:'artifacts/pixelcraft-online/host.png'});
// Leaving returns cursor items and rejoining retains the guest seat and enchants.
const before=await guest.evaluate(()=>JSON.stringify(localStorage));
await guest.evaluate(()=>__pixelcraft.online.end('',false));await host.waitForFunction(()=>!__pixelcraft.online.peer);
assert.equal(await guest.evaluate(()=>JSON.stringify(localStorage)),before);
await guest.evaluate(code=>__pixelcraft.online.open(code),code);
await guest.waitForFunction(()=>__pixelcraft.G?.remoteReplica&&__pixelcraft.online.ready,null,{timeout:30000});
assert.equal(await guest.evaluate(()=>__pixelcraft.G.player.inv[10].enchants.sharpness),1);
await guest.setViewportSize({width:390,height:844});await guest.locator('#onlineButton').click();
await guest.screenshot({path:'artifacts/pixelcraft-online/mobile-room.png'});
assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
await host.evaluate(()=>__pixelcraft.online.end('',false));
await guest.waitForFunction(()=>!__pixelcraft.online.active);
assert.equal(await host.evaluate(()=>__pixelcraft.G.onlineSession),false);
assert.ok(await host.evaluate(()=>__pixelcraft.G.onlinePartner.inv[10].enchants.sharpness===1));
const saved=await host.evaluate(()=>{const A=__pixelcraft;A.saveGame(true);const g=A.loadGame(0);return {enchant:g.onlinePartner.inv[10].enchants.sharpness,armor:g.onlinePartner.armor[0].dur,coop:g.adventure.coop,separate:g.onlinePartner.inv!==g.player.inv};});
assert.equal(saved.enchant,1);assert.equal(saved.armor,100);assert.equal(saved.separate,true);assert.equal(saved.coop,false);

assert.deepEqual(errors,[]);
console.log('PASS: room-code UI, separate inventories, movement, high-ID terrain, enchanting, crafting, armor, chest race, placement/mining, dimension replacement, rejoin/save, guest local-save protection, mobile layout and host departure; no page errors');
}catch(e){console.error(e);console.log('STATUS',await host.locator('#onlineStatus').textContent(),await guest.locator('#onlineStatus').textContent());await host.screenshot({path:'artifacts/pixelcraft-online/error-host.png'});await guest.screenshot({path:'artifacts/pixelcraft-online/error-guest.png'});process.exitCode=1;}finally{await browser.close()}
