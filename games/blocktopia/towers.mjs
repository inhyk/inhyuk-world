export const TOWERS = [
  { id:'berry', name:'딸기 마카롱 타워', sign:'BERRY TOWER', color:'#e4a0b4', trim:'#fae1c8', levels:12, reward:30, x:-48, z:67, width:2.8, rise:.72 },
  { id:'forest', name:'초록 숲 타워', sign:'FOREST TOWER', color:'#77b496', trim:'#d8ebaa', levels:16, reward:40, x:-24, z:67, width:2.7, rise:.78 },
  { id:'frost', name:'얼음 결정 타워', sign:'FROST TOWER', color:'#8ec9de', trim:'#e1f6f6', levels:20, reward:50, x:0, z:67, width:2.6, rise:.84 },
  { id:'sunset', name:'노을 구름 타워', sign:'SUNSET TOWER', color:'#eaaa76', trim:'#ffe6a1', levels:24, reward:60, x:24, z:67, width:2.5, rise:.9 },
  { id:'starlight', name:'별빛 왕관 타워', sign:'STARLIGHT TOWER', color:'#a39ad6', trim:'#e5d9ff', levels:28, reward:75, x:48, z:67, width:2.4, rise:.96 },
];
export function towerPlatforms(tower) {
  return Array.from({length:tower.levels},(_,i)=>({x:tower.x+Math.cos(i*.52)*5,z:tower.z+Math.sin(i*.52)*5,top:1+i*tower.rise,w:tower.width,d:tower.width,bottom:.5+i*tower.rise}));
}
export function cleanTowerProgress(raw) {
  return TOWERS.map(t=>{const saved=raw?.[t.id];return [t.id,{checkpoint:Number.isInteger(saved?.checkpoint)?Math.max(0,Math.min(t.levels,Math.floor(saved.checkpoint/4)*4)):0,completed:saved?.completed===true}];}).reduce((all,[id,p])=>({...all,[id]:p}),{});
}
// Returns true only for a first completion, so replaying cannot farm the reward.
export function recordTowerLanding(save,tower,index) {
  const p=save.towers[tower.id],level=index+1;
  if(level%4===0)p.checkpoint=Math.max(p.checkpoint,level);
  if(level===tower.levels&&!p.completed){p.completed=true;save.coins+=tower.reward;return true;}
  return false;
}
