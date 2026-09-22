import {chromium} from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const b=await chromium.launch({channel:'chrome',headless:true});
try{
 const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:5186/?test');await p.waitForFunction(()=>window.__mineralTest);
 const read=()=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
 // 운반 칸은 1개로 시작해 상점에서 네 번 강화하면 5개가 된다.
 await p.evaluate(()=>{const t=window.__mineralTest;t.state.strength=30;t.state.money=1e15;t.home();t.update();});
 assert.equal((await read()).capacity,1);
 await p.click('#shop');
 for(const expect of [2,3,4,5]){await p.click('[data-buy="cargo"]');assert.equal((await read()).capacity,expect);}
 assert.equal(await p.locator('[data-buy="cargo"]').isDisabled(),true);
 await p.click('[data-buy="strength"]');assert.ok((await read()).power>Math.floor(12*1.4**30));await p.click('#close');
 // 가격은 무게에 비례하고 초대형은 80배가 더 붙는다.
 const priced=await p.evaluate(()=>{const t=window.__mineralTest;return [t.orePrice({id:4,weight:125}),t.orePrice({id:4,weight:156.25}),t.orePrice({id:4,weight:156.25,giant:true}),t.orePrice({id:0,weight:3.75})];});
 assert.deepEqual(priced,[100000,125000,125000*80,-125]);
 await p.evaluate(()=>{const t=window.__mineralTest;t.state.strength=42;t.update();});
 let spot=0;
 async function add(id){spot++;await p.evaluate(({id,spot})=>{const t=window.__mineralTest;t.player.x=400+spot*16;t.player.z=400;t.spawn(id,t.player.x,t.player.z);},{id,spot});await p.waitForFunction(id=>JSON.parse(window.render_game_to_text()).nearest?.id===id,id);await p.keyboard.press('e');}
 for(const id of [10,11,12,18,1])await add(id);
 let s=await read();assert.equal(s.carried.length,5);
 assert.equal(await p.locator('#cargo-items button').count(),5);
 assert.ok([10,11,12,18,1].every(id=>s.found[id]>0));
 // 여섯 번째는 칸이 없어 거절된다.
 await add(1);assert.equal((await read()).carried.length,5);
 await p.locator('[data-drop="2"]').click();
 s=await read();assert.equal(s.carried.length,4);assert.equal(s.carried.some(o=>o.id===12),false);
 const before=s.money,expected=s.carried.reduce((n,o)=>n+o.price,0);
 assert.ok(expected>1e14);
 await p.click('#return');await p.click('#sell');
 s=await read();assert.equal(s.carried.length,0);assert.equal(s.money-before,expected);
 // 힘이 부족하면 칸이 남아도 들 수 없다.
 await p.evaluate(()=>{const t=window.__mineralTest;t.state.strength=0;t.update();});
 await add(1);await add(2);assert.equal((await read()).carried.length,1);
 await p.click('#reset');await p.click('#cancel-reset');assert.equal((await read()).carried.length,1);assert.ok((await read()).money>0);
 await p.click('#reset');await p.click('#confirm-reset');
 s=await read();assert.equal(s.money,0);assert.equal(s.power,12);assert.equal(s.speed,22);assert.equal(s.capacity,1);assert.equal(s.carried.length,0);assert.equal(s.found.every(n=>n===0),true);assert.ok(s.event.playSeconds<3);assert.equal(s.ores,1612);assert.equal(s.day.name,'아침');
 await p.reload();await p.waitForFunction(()=>window.__mineralTest);assert.equal((await read()).money,0);assert.equal((await read()).capacity,1);
 await p.evaluate(()=>{const t=window.__mineralTest;t.state.strength=42;t.state.cargo=4;t.update();});
 for(const id of [10,11,12,13,1])await add(id);
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(400);await p.screenshot({path:'/tmp/mineral-cargo-mobile.png'});
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);
 console.log('PASS: one-slot start, four cargo upgrades to five, weight-based and giant pricing, fifth pickup and sixth rejection, selected drop, bulk sale total, strength limit, reset cancel/confirm/persistence, mobile inventory.');
}finally{await b.close();}
