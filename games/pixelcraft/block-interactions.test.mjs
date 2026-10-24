import test from 'node:test';
import assert from 'node:assert/strict';
import {B,I,BLOCKS,MC_BLOCK_IDS,isSolid,blockLight,smeltResult,FUEL} from '../../public/play/pixelcraft/data.mjs';
import {W,H,computeLight,collides} from '../../public/play/pixelcraft/core.mjs';

test('every wood/copper door, trapdoor and fence gate blocks passage only when closed',()=>{
  const variants=BLOCKS.filter(b=>b&&['door','gate'].includes(b.use));
  assert.ok(variants.length>50);
  for(const b of variants){assert.equal(isSolid(b.id,0),true,b.name);assert.equal(isSolid(b.id,1),false,b.name);assert.equal(isSolid(b.id,5),false,b.name);}
  const w={tiles:new Uint16Array(W*H),meta:new Uint8Array(W*H)};
  const i=40*W+640;w.tiles[i]=MC_BLOCK_IDS.cherry_door;
  assert.equal(collides(w,640,40,.6,.8),true);w.meta[i]=1;
  assert.equal(collides(w,640,40,.6,.8),false);
});

test('switchable lamps and extinguished flames change actual world lighting',()=>{
  const w={tiles:new Uint16Array(W*H).fill(B.STONE),meta:new Uint8Array(W*H),sky:new Uint8Array(W*H),blk:new Uint8Array(W*H)};
  const i=40*W+640;w.tiles[i]=B.REDSTONE_LAMP;w.tiles[i+1]=B.AIR;
  computeLight(w,638,643);assert.equal(w.blk[i+1],0);
  w.meta[i]=1;computeLight(w,638,643);assert.ok(w.blk[i+1]>=13);
  assert.ok(blockLight(B.CAMPFIRE,0)>0);assert.equal(blockLight(B.CAMPFIRE,1),0);
  assert.equal(blockLight(B.BLAST_FURNACE,1),13);
});

test('smokers cook food, blast furnaces smelt ores, new wood fuels work',()=>{
  assert.equal(smeltResult(B.SMOKER,I.RAW_BEEF),I.STEAK);
  assert.equal(smeltResult(B.SMOKER,B.IRON_ORE),undefined);
  assert.equal(smeltResult(B.BLAST_FURNACE,B.DEEPSLATE_IRON_ORE),I.IRON_INGOT);
  assert.equal(smeltResult(B.BLAST_FURNACE,I.RAW_BEEF),undefined);
  assert.ok(FUEL[B.CHERRY_PLANKS]>0);assert.equal(FUEL[B.CRIMSON_PLANKS],undefined);
});
