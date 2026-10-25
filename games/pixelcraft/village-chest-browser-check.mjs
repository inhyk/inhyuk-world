import {chromium} from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.PIXELCRAFT_ARTIFACTS||'/tmp/pixelcraft-village-chests';await fs.mkdir(out,{recursive:true});
const b=await chromium.launch(),p=await b.newPage({viewport:{width:1280,height:760}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
 await p.goto(process.env.PIXELCRAFT_TEST_URL||'http://127.0.0.1:3065/play/pixelcraft/');await p.waitForFunction(()=>window.__pixelcraft);
 await p.click('#slots .play >> nth=0');await p.fill('#nwSeed','1234');await p.click('#nwCreate');await p.click('#adventureActions button:last-child');
 const i=await p.evaluate(()=>{const A=window.__pixelcraft,G=A.G;if(G.chests.size!==3)throw Error('Expected three supplied villages');const i=[...G.chests.keys()][0];Object.assign(G.player,{x:i%1280-1,y:Math.floor(i/1280)-.8,vx:0,vy:0,invT:999});G.cam={x:G.player.x,y:G.player.y};G.target={x:i%1280,y:Math.floor(i/1280)};A.doUse();return i;});
 await p.waitForSelector('[data-s="c:0"] img');assert.equal(await p.locator('[data-s^="c:"] img').count(),7);
 await p.screenshot({path:`${out}/chest.png`});
 await p.locator('[data-s="c:0"]').click({modifiers:['Shift']});
 assert.equal(await p.evaluate(i=>window.__pixelcraft.G.chests.get(i)[0],i),null);
 await p.evaluate(()=>{const A=window.__pixelcraft;A.closePanel();A.saveGame(true);});
 await p.reload();await p.click('#slots .play >> nth=0');assert.equal(await p.evaluate(i=>window.__pixelcraft.G.chests.get(i)[0],i),null);
 // Simulate a previous release: untouched/empty village chest gets supplies once.
 await p.evaluate(i=>{const A=window.__pixelcraft;delete A.G.adventure.villageLootVersion;A.G.chests.set(i,Array(27).fill(null));A.saveGame(true);},i);
 await p.reload();await p.click('#slots .play >> nth=0');assert.equal(await p.evaluate(i=>window.__pixelcraft.G.chests.get(i).filter(Boolean).length,i),7);
 await p.evaluate(i=>{const A=window.__pixelcraft;A.G.chests.set(i,Array(27).fill(null));A.saveGame(true);},i);
 await p.reload();await p.click('#slots .play >> nth=0');assert.equal(await p.evaluate(i=>window.__pixelcraft.G.chests.get(i).filter(Boolean).length,i),0);
 assert.deepEqual(errors,[]);console.log('PASS: three supplied village chests, actual opening/taking, save/reload, legacy supplies, no refills or browser errors');
}finally{await b.close();}
