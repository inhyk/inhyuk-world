import test from 'node:test';
import assert from 'node:assert/strict';
import {Enforcement} from './police.mjs';
import {cleanSave} from './core.mjs';
function make(model,wanted=false){const node=()=>({position:{set(){}},rotation:{},setEnabled(value){this.enabled=value;}}),save=cleanSave({wanted}),journey={p:{x:3,z:-7,yaw:0,speed:8},occupied:model?{model}:null,walking:!model,solids:[]};let writes=0;const law=new Enforcement({save,persist:()=>writes++,toast:()=>{},journey,world:{},node,box:node,cyl:node,makeCar:node,material:()=>({})});return {law,save,journey,writes:()=>writes};}
test('police car can cross red lights without pursuit or jail',()=>{const {law,save}=make('police');law.step(.05,12,{x:3,z:-9},true);assert.equal(save.wanted,false);assert.equal(save.jailUntil,0);assert.equal(law.chasing,false);});
test('boarding police clears an existing pursuit before an adjacent officer can capture',()=>{const {law,save,writes}=make('police',true);law.chasing=true;law.cop={x:3,z:-7};law.trail=[{x:3,z:-7}];law.step(.05,12,{x:3,z:-9},true);assert.equal(save.wanted,false);assert.equal(save.jailUntil,0);assert.equal(law.chasing,false);assert.equal(law.car.enabled,false);assert.equal(law.officer.enabled,false);assert.equal(writes(),1);law.step(.05,12,{x:3,z:-7},true);assert.equal(writes(),1);});
test('switching back to a regular car restores normal enforcement',()=>{const {law,save,journey}=make('police');law.step(.05,12,{x:3,z:-9},true);journey.occupied={model:'mint'};law.step(.05,12,{x:3,z:-9},true);assert.equal(save.wanted,true);assert.equal(law.chasing,true);});
