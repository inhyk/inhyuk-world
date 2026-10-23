import test from 'node:test';
import assert from 'node:assert/strict';
import {B,I,BLOCKS,ITEMS,MC_BLOCK_IDS,RECIPES,durabilityOf} from '../../public/play/pixelcraft/data.mjs';
import {VANILLA_BLOCKS} from '../../public/play/pixelcraft/block-catalog.mjs';
import {generateWorld,rleEncode,rleDecode,W,H,idx,addItem,breakInfo} from '../../public/play/pixelcraft/core.mjs';
import {terrainSave,restoreTerrain} from '../../public/play/pixelcraft/adventure-world.mjs';
import {ENCHANTMENTS,applyEnchant,experienceLevel,enchantedDrop,meleeDamage,wearAmount,gainExperience,protectDamage} from '../../public/play/pixelcraft/enchantments.mjs';
import {runCommand} from '../../public/play/pixelcraft/commands.mjs';
const stack=id=>({id,count:1,dur:durabilityOf(id)});
const fixture=()=>({w:generateWorld(1234),mode:'survival',diff:1,player:{x:640,y:50,sel:0,xp:70000,armor:Array(4).fill(null),inv:[stack(I.DIAMOND_PICK),{id:I.LAPIS,count:32},...Array(34).fill(null)]}});
test('26.1 등록 블록 1168종은 고유 ID·이름·아이템을 가지며 기존 ID가 유지된다',()=>{
 assert.equal(VANILLA_BLOCKS.length,1168);assert.equal(new Set(Object.values(MC_BLOCK_IDS)).size,1168);
 for(const [,name,ko] of VANILLA_BLOCKS){const id=MC_BLOCK_IDS[name];assert.ok(BLOCKS[id],name);if(id!==0)assert.equal(ITEMS[id].place,id);assert.ok(ko.length);}
 assert.equal(B.STONE,3);assert.equal(I.DIAMOND_SWORD,129);assert.equal(B.PLANKS,17);assert.equal(MC_BLOCK_IDS.snow_block,32);assert.notEqual(MC_BLOCK_IDS.snow,MC_BLOCK_IDS.snow_block);assert.notEqual(MC_BLOCK_IDS.short_grass,MC_BLOCK_IDS.tall_grass);
});
test('16비트 블록 저장은 큰 ID를 보존하고 예전 8비트 저장도 읽는다',()=>{
 for(const a of [new Uint8Array([0,0,17,255]),new Uint16Array([0,0,256,1385,65535,65535])])assert.deepEqual(rleDecode(rleEncode(a),a.length),a);
 const G=fixture(),id=MC_BLOCK_IDS.cherry_planks;assert.ok(G.w.tiles.includes(B.SUGAR_CANE));assert.ok(G.w.tiles.includes(B.LAPIS_ORE));G.w.tiles[idx(10,12)]=id;G.w.bg[idx(10,12)]=id;const saved=terrainSave(G.w),w=generateWorld(1234);restoreTerrain(w,saved);assert.equal(w.tiles[idx(10,12)],id);assert.equal(w.bg[idx(10,12)],id);
 const legacy={...saved,tiles:rleEncode(new Uint8Array(W*H).fill(B.PLANKS)),bg:rleEncode(new Uint8Array(W*H))};restoreTerrain(w,legacy);assert.equal(w.tiles[idx(10,12)],17);
});
test('야생 인챈트는 부여대·책장·경험치·청금석을 검사하고 성공할 때만 지불한다',()=>{
 const G=fixture(),s=G.player.inv[0];assert.equal(applyEnchant(G,s,'efficiency',1).ok,false);G.w.tiles[idx(640,50)]=B.ENCHANTING_TABLE;
 assert.equal(applyEnchant(G,s,'efficiency',2).ok,false);for(let x=641;x<=643;x++)G.w.tiles[idx(x,50)]=B.BOOKSHELF;
 assert.equal(applyEnchant(G,s,'efficiency',2).ok,true);assert.equal(experienceLevel(G.player),94);assert.equal(G.player.inv[1].count,30);const before=JSON.stringify(G.player);assert.equal(applyEnchant(G,s,'efficiency',2).ok,false);assert.equal(JSON.stringify(G.player),before);
 G.player.xp=0;assert.equal(applyEnchant(G,s,'unbreaking',1).ok,false);assert.equal(G.player.inv[1].count,30);
});
test('인챈트 효과와 충돌 및 가방 이동 메타데이터가 실제 계산에 반영된다',()=>{
 assert.equal(Object.keys(ENCHANTMENTS).length,14);const G=fixture(),pick=G.player.inv[0];assert.equal(applyEnchant(G,pick,'fortune',3,{command:true}).ok,true);assert.equal(applyEnchant(G,pick,'silk_touch',1,{command:true}).ok,false);assert.equal(applyEnchant(G,pick,'sharpness',1,{command:true}).ok,false);
 assert.deepEqual(enchantedDrop(pick,B.IRON_ORE,[B.IRON_ORE,1],()=>.99),[B.IRON_ORE,1]);assert.deepEqual(enchantedDrop(pick,B.DIAMOND_ORE,[I.DIAMOND,1],()=>.99),[I.DIAMOND,4]);assert.deepEqual(enchantedDrop({enchants:{silk_touch:1}},B.STONE,[B.COBBLE,1]),[B.STONE,1]);
 assert.ok(breakInfo(B.STONE,pick.id,{efficiency:5}).time<breakInfo(B.STONE,pick.id).time);assert.equal(meleeDamage({enchants:{sharpness:5}},7),10);assert.equal(wearAmount({enchants:{unbreaking:3}},4,()=>.4),0);assert.equal(wearAmount({},4,()=>.4),4);
 G.player.armor[3]={id:I.DIAMOND_BOOTS,count:1,enchants:{feather_falling:4}};assert.ok(protectDamage(G.player,10,'fall')<10);assert.equal(protectDamage(G.player,10,'drown'),10);
 pick.enchants={mending:1};pick.dur=durabilityOf(pick.id)-10;G.player.xp=0;gainExperience(G.player,3);assert.equal(pick.dur,durabilityOf(pick.id)-4);assert.equal(G.player.xp,0);
 const inv=Array(9).fill(null);addItem(inv,pick.id,1,pick.dur,0,9,pick);assert.deepEqual(inv[0].enchants,pick.enchants);inv[0].enchants.mending=0;assert.equal(pick.enchants.mending,1);
});
test('명령어로 새 블록·인챈트·경험치를 받고 부여대와 책을 제작할 수 있다',()=>{
 const G=fixture();assert.equal(runCommand(G,'/give cherry_planks 4').ok,true);assert.ok(G.player.inv.some(s=>s?.id===MC_BLOCK_IDS.cherry_planks&&s.count===4));assert.equal(runCommand(G,'/enchant minecraft:efficiency 5').ok,true);assert.equal(G.player.inv[0].enchants.efficiency,5);assert.equal(runCommand(G,'/enchant sharpness 5').ok,false);const before=experienceLevel(G.player);assert.equal(runCommand(G,'/xp add 30 levels').ok,true);assert.equal(experienceLevel(G.player),before+30);assert.equal(runCommand(G,'/xp add -1 levels').ok,false);
 for(const id of [I.BOOK,I.PAPER,B.BOOKSHELF,B.ENCHANTING_TABLE])assert.ok(RECIPES.some(r=>r.out[0]===id),`recipe ${id}`);
});
