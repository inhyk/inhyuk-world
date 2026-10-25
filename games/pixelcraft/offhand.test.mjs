import test from 'node:test';
import assert from 'node:assert/strict';
import {B,I} from '../../public/play/pixelcraft/data.mjs';
import {swapHands,canUseOffhand} from '../../public/play/pixelcraft/offhand.mjs';
test('양손 교환은 이전 저장과 빈손을 지원하며 수량·내구도·인챈트를 보존한다',()=>{
 const sword={id:I.DIAMOND_SWORD,count:1,dur:60,enchants:{sharpness:3}},p={sel:1,inv:[null,sword]};
 swapHands(p);assert.equal(p.offhand[0],sword);assert.equal(p.inv[1],null);
 p.inv[1]={id:B.TORCH,count:16};swapHands(p);assert.equal(p.inv[1],sword);assert.deepEqual(p.offhand[0],{id:B.TORCH,count:16});
 swapHands(p);assert.equal(p.offhand[0].enchants.sharpness,3);assert.equal(p.offhand[0].dur,60);
});
test('왼손의 블록·음식은 도구나 빈손에서 사용하고 오른손 사용을 우선한다',()=>{
 const torch={id:B.TORCH,count:2},food={id:I.APPLE,count:1};
 assert.equal(canUseOffhand({id:I.STONE_PICK},torch),true);assert.equal(canUseOffhand(null,food),true);
 for(const id of [B.STONE,I.APPLE,I.BOW,I.BUCKET,I.FLINT_STEEL])assert.equal(canUseOffhand({id},torch),false);
 assert.equal(canUseOffhand(null,{id:I.STONE_SWORD}),false);assert.equal(canUseOffhand(null,null),false);
});
