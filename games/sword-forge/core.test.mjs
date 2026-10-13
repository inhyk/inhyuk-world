import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState,restoreState,sword,cost,rates,enhance,sell,buy,claim,encounter,attack,AREAS } from '../../public/play/sword-forge/core.mjs';

test('first three upgrades are guaranteed and charge exactly the displayed price',()=>{
 const s=freshState();for(let i=0;i<3;i++){const before=s.gold;assert.equal(rates(s).success,100);const result=enhance(s,{},.9999);assert.equal(result.result,'success');assert.equal(s.level,i+1);assert.equal(s.gold,before-cost(i));}assert.equal(s.attempts,3);assert.deepEqual(s.found,[0,1,2,3]);
});
test('roll boundaries match displayed success, down and break rates',()=>{
 for(let level=0;level<30;level++){
  const s={...freshState(),level,gold:1e12};const r=rates(s);assert.equal(r.success+r.break+(level<4?100-r.success:r.down),100);
  assert.equal(enhance(structuredClone(s),{},(r.success-.001)/100).result,'success');
  if(r.success<100) assert.equal(enhance(structuredClone(s),{},r.success/100).result,level>=4?'down':'fail');
  if(r.break) {const copy=structuredClone(s);assert.equal(enhance(copy,{},(100-r.break)/100).result,'break');assert.equal(copy.level,0);assert.equal(copy.protect,3);}
 }
});
test('protection and blessing consume once and prevent destruction without hiding failure bonus',()=>{
 const s={...freshState(),level:15,gold:1e8};const p=rates(s,true);assert.equal(p.success,rates(s).success+15);const r=enhance(s,{protect:true,bless:true},.99999);assert.equal(r.result,'protected');assert.equal(s.level,15);assert.equal(s.protect,1);assert.equal(s.bless,1);assert.equal(s.failures,1);assert.equal(rates(s).success,rates({...s,failures:0}).success+8);
 s.failures=10;assert.equal(rates(s).success,100);enhance(s,{},.99999);assert.equal(s.level,16);assert.equal(s.failures,0);
});
test('unaffordable or invalid attempts never mutate balances or inventory',()=>{
 const s={...freshState(),gold:0};const before=structuredClone(s);assert.equal(enhance(s).ok,false);assert.deepEqual(s,before);
 s.gold=10000;s.protect=0;const clean=structuredClone(s);assert.equal(enhance(s,{protect:true}).ok,false);assert.deepEqual(s,clean);
});
test('sale preserves discoveries and highest record; free iron cannot be sold',()=>{
 const s=freshState();enhance(s,{},0);const gold=s.gold;assert.equal(sell(s),sword(1).value);assert.equal(s.gold,gold+sword(1).value);assert.equal(s.level,0);assert.equal(s.best,1);assert.ok(s.found.includes(1));assert.equal(sell(s),0);assert.equal(s.sales,1);
});
test('max level ends progression without charges and every blade has increasing power/value',()=>{
 const s={...freshState(),gold:1e12};for(let i=0;i<30;i++){assert.equal(enhance(s,{},0).result,'success');assert.ok(sword(i+1).power>sword(i).power);assert.ok(sword(i+1).value>sword(i).value);}const copy=structuredClone(s);assert.equal(enhance(s).ok,false);assert.deepEqual(s,copy);assert.equal(s.found.length,31);
});
test('shop applies permanent upgrades, caps at five, and denies unknown purchases',()=>{
 const s={...freshState(),gold:1e9};for(let i=0;i<5;i++)assert.equal(buy(s,'luck'),true);assert.equal(buy(s,'luck'),false);assert.equal(rates({...s,level:12}).success,rates({...s,level:12,luck:0}).success+10);assert.equal(buy(s,'unknown'),false);s.gold=0;assert.equal(buy(s,'protect'),false);
});
test('mission rewards are earned once and unearned rewards are rejected',()=>{
 const s=freshState();assert.equal(claim(s,'first'),false);s.best=3;assert.equal(claim(s,'first'),true);const copy=structuredClone(s);assert.equal(claim(s,'first'),false);assert.deepEqual(s,copy);assert.equal(s.gold,2100);assert.equal(s.protect,3);
});
test('every area is survivable with its minimum sword using skills; no duplicate rewards',()=>{
 for(let i=0;i<AREAS.length;i++){
  const s={...freshState(),level:AREAS[i].require,kills:2};if(i)assert.equal(encounter({...s,level:s.level-1},i),null);
  const b=encounter(s,i);let result;
  while(!b.finished){if(b.playerHp<50&&b.potion)attack(s,b,'potion');result=attack(s,b,b.turn>0&&b.turn%3===0?'skill':'attack',.9);}
  assert.ok(result.win,`area ${i}`);assert.equal(s.kills,3);assert.equal(s.bless,3);assert.equal(s.gold,1500+AREAS[i].reward);const gold=s.gold;assert.equal(attack(s,b).ok,false);assert.equal(s.gold,gold);
 }
});
test('zero gold and a broken sword can always recover via free first-area hunts',()=>{
 const s={...freshState(),gold:0};const b=encounter(s,0);while(!b.finished)attack(s,b,b.turn>0&&b.turn%3===0?'skill':'attack',.99);assert.ok(s.gold>=cost(0));assert.equal(enhance(s,{},0).result,'success');
});
test('save round-trip preserves progression; damaged data cannot inject markup or invalid numbers',()=>{
 const s=freshState();enhance(s,{},0);assert.deepEqual(restoreState(JSON.parse(JSON.stringify(s))),s);assert.deepEqual(restoreState(null),freshState());const bad=restoreState({version:1,gold:-2,level:Infinity,luck:50,protect:'5',found:[-1,2,2,31,'x'],claimed:['first','fake'],log:[{type:'<script>',text:'x'},null]});assert.equal(bad.gold,0);assert.equal(bad.level,0);assert.equal(bad.luck,5);assert.equal(bad.protect,0);assert.deepEqual(bad.found,[0,2]);assert.deepEqual(bad.log,[]);
});
