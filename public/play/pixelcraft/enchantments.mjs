import { B,I,ITEMS,BLOCKS,durabilityOf } from './data.mjs';
import { W,H,countItem,removeItem } from './core.mjs';
export const ENCHANTMENTS={
 sharpness:{name:'날카로움',max:5,description:'근접 공격력이 올라가.',fits:it=>!!it.tool&&['sword','axe'].includes(it.tool.type)},
 efficiency:{name:'효율',max:5,description:'알맞은 도구로 블록을 더 빨리 캐.',fits:it=>!!it.tool&&it.tool.type!=='sword'},
 unbreaking:{name:'내구성',max:3,description:'내구도가 줄어들 확률이 낮아져.',fits:it=>!!durabilityOf(it.id)},
 fortune:{name:'행운',max:3,description:'광석에서 아이템을 더 얻어.',conflicts:['silk_touch'],fits:it=>it.tool?.type==='pick'},
 silk_touch:{name:'섬세한 손길',max:1,description:'블록을 원래 모습으로 얻어.',conflicts:['fortune'],fits:it=>!!it.tool&&it.tool.type!=='sword'},
 protection:{name:'보호',max:4,description:'받는 공격 피해를 줄여.',conflicts:['fire_protection'],fits:it=>!!it.armor},
 fire_protection:{name:'화염으로부터 보호',max:4,description:'불과 용암의 피해를 줄여.',conflicts:['protection'],fits:it=>!!it.armor},
 feather_falling:{name:'가벼운 착지',max:4,description:'추락 피해를 줄여.',fits:it=>it.armor?.slot===3},
 respiration:{name:'호흡',max:3,description:'물속에서 숨을 더 오래 쉬어.',fits:it=>it.armor?.slot===0},
 power:{name:'힘',max:5,description:'활의 화살 공격력이 올라가.',fits:it=>it.id===I.BOW},
 infinity:{name:'무한',max:1,description:'화살 한 개만 있으면 소모하지 않아.',fits:it=>it.id===I.BOW},
 flame:{name:'화염',max:1,description:'활로 맞힌 생물에 불이 붙어.',fits:it=>it.id===I.BOW},
 knockback:{name:'밀치기',max:2,description:'근접 공격으로 더 멀리 밀어내.',fits:it=>it.tool?.type==='sword'},
 mending:{name:'수선',max:1,description:'경험치를 얻을 때 장비를 고쳐.',fits:it=>!!durabilityOf(it.id)},
};
export const enchantLevel=(stack,key)=>Math.min(ENCHANTMENTS[key]?.max??0,Math.max(0,Math.floor(stack?.enchants?.[key]??0)));
export const enchantLines=stack=>Object.entries(stack?.enchants??{}).filter(([k])=>ENCHANTMENTS[k]).map(([k])=>`${ENCHANTMENTS[k].name} ${enchantLevel(stack,k)}`);
export const experienceLevel=p=>Math.floor(Math.sqrt(Math.max(0,p.xp??0)/7));
export function gainExperience(player,points,extraEquipment=[]){
 let left=Math.max(0,Math.floor(points));
 for(const s of [...(player.armor??[]),...player.inv,...extraEquipment]){
  if(!left||!s||!enchantLevel(s,'mending'))continue;
  const max=durabilityOf(s.id),missing=max-(s.dur??max),used=Math.min(left,Math.ceil(missing/2));
  if(used>0){s.dur=Math.min(max,(s.dur??max)+used*2);left-=used;}
 }
 player.xp=(player.xp??0)+left;
}
export function bookshelfPower(G,x,y){
 let n=0;for(let yy=Math.max(0,y-3);yy<=Math.min(H-1,y+3);yy++)for(let xx=Math.max(0,x-3);xx<=Math.min(W-1,x+3);xx++)if(BLOCKS[G.w.tiles[yy*W+xx]]?.bookshelf)n++;
 return {shelves:n,maxLevel:Math.min(5,1+Math.floor(n/3))};
}
export function enchantProblem(stack,key,level){
 const e=ENCHANTMENTS[key],it=ITEMS[stack?.id];
 if(!e||!it||!e.fits(it))return '이 장비에는 그 인챈트를 붙일 수 없어.';
 if(!Number.isInteger(level)||level<1||level>e.max)return `레벨은 1~${e.max} 사이로 골라 줘.`;
 if(enchantLevel(stack,key)>=level)return '이미 같거나 더 높은 인챈트가 붙어 있어.';
 if(e.conflicts?.some(k=>enchantLevel(stack,k)))return '함께 붙일 수 없는 인챈트가 이미 있어.';
 return '';
}
export function applyEnchant(G,stack,key,level,{command=false,x=Math.floor(G.player.x),y=Math.floor(G.player.y)}={}){
 const problem=enchantProblem(stack,key,level);if(problem)return {ok:false,text:problem};
 if(!command&&G.mode!=='creative'){
  if(G.w.tiles[y*W+x]!==B.ENCHANTING_TABLE)return {ok:false,text:'마법 부여대 가까이에서 사용해 줘.'};
  if(Math.hypot(G.player.x-x,G.player.y-y)>6)return {ok:false,text:'마법 부여대가 너무 멀어.'};
  if(level>bookshelfPower(G,x,y).maxLevel)return {ok:false,text:'주변에 책장을 더 놓아 줘. 책장 3개마다 최대 레벨이 1 올라가.'};
  const cost=level*3,current=experienceLevel(G.player);
  if(current<cost||countItem(G.player.inv,[I.LAPIS])<level)return {ok:false,text:`경험치 ${cost}레벨과 청금석 ${level}개가 필요해.`};
  removeItem(G.player.inv,[I.LAPIS],level);G.player.xp-=(current**2-(current-cost)**2)*7;
 }
 stack.enchants={...stack.enchants,[key]:level};return {ok:true,text:`${ITEMS[stack.id].name}에 ${ENCHANTMENTS[key].name} ${level}을 붙였어!`};
}
export function wearAmount(stack,amount,rng=Math.random){let wear=0;for(let k=0;k<amount;k++)if(rng()<1/(enchantLevel(stack,'unbreaking')+1))wear++;return wear;}
export function meleeDamage(stack,base){const lv=enchantLevel(stack,'sharpness');return base+(lv?0.5+0.5*lv:0);}
export function protectDamage(player,amount,cause){
 if(['void','starve','drown'].includes(cause))return amount;
 const armor=player.armor??[];
 const points=armor.reduce((n,s)=>n+enchantLevel(s,'protection')+(['fire','lava'].includes(cause)?2*enchantLevel(s,'fire_protection'):0),0)+(cause==='fall'?3*enchantLevel(armor[3],'feather_falling'):0);
 return amount*(1-Math.min(20,points)*.04);
}
export function enchantedDrop(stack,block,drop,rng=Math.random){
 if(enchantLevel(stack,'silk_touch')&&block!==B.BEDROCK)return [block,1];
 const lv=enchantLevel(stack,'fortune');if(lv&&BLOCKS[block]?.mcName?.endsWith('_ore')&&drop&&drop[0]!==block)return [drop[0],drop[1]*(1+Math.floor(rng()*(lv+1)))];
 return drop;
}
