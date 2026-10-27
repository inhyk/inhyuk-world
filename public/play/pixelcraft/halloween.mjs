import {upgradeHaunted} from './haunted.mjs';
import {B,I,ITEMS,RECIPES} from './data.mjs';
import {W,H,SEA,BIOME,idx,generateWorld,makeRng,computeLight,countItem,addItem,canCraft,craftFromSlots} from './core.mjs';
import {makeVillage,populateVillageChests} from './adventure-world.mjs';
export const HALLOWEEN_RECIPES=[B.JACK,B.TORCH,B.CRAFTING];
export function halloweenState(G){return G.adventure.halloween??={version:0,collected:0,crafted:0,placed:0,claimed:false,sites:[],villages:[],food:[]};}
export function halloweenMissions(G){const h=halloweenState(G);h.collected=Math.max(h.collected??0,countItem(G.player.inv,[B.PUMPKIN]));return [{name:'호박 수확',hint:'호박 3개 모으기',n:h.collected??0,total:3},{name:'어둠을 밝힐 등불',hint:'잭오랜턴 3개 제작하기',n:h.crafted??0,total:3},{name:'등불 축제',hint:'잭오랜턴 3개 설치하기',n:h.placed??0,total:3}];}
export function recordHalloweenCraft(G,id,n=1){if(G?.adventure&&id===B.JACK){const h=halloweenState(G);h.crafted=(h.crafted??0)+n;h.collected=Math.max(h.collected??0,h.crafted);}}
export function craftHalloween(G,id){
 if(!HALLOWEEN_RECIPES.includes(id))return {ok:false,text:'이 제작법은 지원하지 않아.'};
 const recipe=RECIPES.find(r=>r.out[0]===id),slots=structuredClone(G.player.inv);
 if(!canCraft(slots,recipe))return {ok:false,text:'가방에 재료가 더 필요해!'};
 if(!craftFromSlots(slots,recipe)||addItem(slots,id,recipe.out[1])>0)return {ok:false,text:'가방에 빈칸을 만들어 줘!'};
 G.player.inv.splice(0,G.player.inv.length,...slots);recordHalloweenCraft(G,id,recipe.out[1]);halloweenMissions(G);
 return {ok:true,text:`${ITEMS[id].name} ${recipe.out[1]}개를 만들었어!`};
}
export function claimHalloween(G){
 const h=halloweenState(G);if(h.claimed)return {ok:false,text:'보상은 이미 받았어!'};
 if(halloweenMissions(G).some(m=>m.n<m.total))return {ok:false,text:'세 가지 미션을 먼저 완성해 줘!'};
 const slots=structuredClone(G.player.inv);
 for(const [id,n] of [[I.DIAMOND,3],[I.GOLDEN_APPLE,3]])if(addItem(slots,id,n)>0)return {ok:false,text:'보상을 받을 가방 빈칸이 필요해!'};
 G.player.inv.splice(0,G.player.inv.length,...slots);h.claimed=true;return {ok:true,text:'축제 완료! 다이아몬드 3개와 황금 사과 3개를 받았어.'};
}
// Upgrade only untouched natural terrain; never reconstruct a player's buildings.
export function upgradeHalloween(G){
 const h=halloweenState(G);if(h.version===1){upgradeHaunted(G);return;}
 const d=G.adventure.dimension==='overworld'?{w:G.w,villagers:G.adventure.villagers,chests:G.chests}:G.adventure.worlds.overworld;if(!d)return;
 const w=d.w,base=generateWorld(w.seed),r=makeRng(w.seed^0x0c70bee),sites=h.sites??=[],villages=h.villages??=[],food=h.food??=[];
 const clean=(x0,x1,y0,y1)=>{for(let x=x0;x<=x1;x++)for(let y=Math.max(1,y0);y<=Math.min(H-2,y1);y++){const i=idx(x,y);if(w.tiles[i]!==base.tiles[i]||w.meta[i]!==base.meta[i]||w.bg[i]!==base.bg[i])return false;}return true;};
 const added=[];
 for(const biome of Object.values(BIOME)){
  if(d.villagers.some(v=>w.biome[Math.floor(v.x)]===biome))continue;
  const full=[],small=[];for(let x=15;x<W-15;x++){if(w.biome[x]!==biome||w.biome[x-6]!==biome||w.biome[x+6]!==biome)continue;const compact=x<30||x>W-30||w.biome[x-25]!==biome||w.biome[x+25]!==biome;if(d.villagers.every(v=>Math.abs(v.x-x)>(compact?28:65))&&Math.abs(x-W/2)>(compact?45:80))(compact?small:full).push({x,compact});}
  const candidates=full.length?full:small;
  const offset=Math.floor(r()*Math.max(1,candidates.length));
  for(let k=0;k<candidates.length;k++){
   const {x,compact}=candidates[(k+offset)%candidates.length],radius=compact?7:25,floor=biome===BIOME.OCEAN?SEA-1:w.surface[x];
   if(!clean(x-radius,x+radius,floor-13,Math.max(floor+6,w.surface[x])))continue;
   if(biome===BIOME.OCEAN)w.surface[x]=floor;
   const people=makeVillage(w,x,{compact});d.villagers.push(...people);added.push(...people);villages.push({x,y:floor,biome,compact});
   // Every new settlement gets glowing festival lanterns beside the doors.
   for(const off of(compact?[-6]:[-20,-5,10])){w.tiles[idx(x+off,floor-1)]=B.JACK;}
   break;
  }
 }
 if(added.length)populateVillageChests({w,chests:d.chests,adventure:{dimension:'overworld',villagers:added,worlds:{}}});
 // A few pumpkin trees use existing log/leaf blocks and hanging lanterns.
 h.trees??=[];
 for(let x=35;x<W-35&&h.trees.length<5;x+=11){
  const y=w.surface[x]-1;
  if(![BIOME.FOREST,BIOME.PLAINS,BIOME.SNOW].includes(w.biome[x])||Math.abs(x-W/2)<12||r()>.25||!clean(x-3,x+3,y-7,y+1))continue;
  if(![B.GRASS,B.SNOW_GRASS].includes(w.tiles[idx(x,y+1)]))continue;
  let clear=true;for(let dx=-3;dx<=3;dx++)for(let dy=-7;dy<=0;dy++)if(![B.AIR,B.TALL_GRASS,B.POPPY,B.DANDELION,B.SNOW,B.OAK_TRUNK,B.BIRCH_TRUNK,B.SPRUCE_TRUNK,B.OAK_LEAVES,B.BIRCH_LEAVES,B.SPRUCE_LEAVES].includes(w.tiles[idx(x+dx,y+dy)]))clear=false;
  if(!clear)continue;
  for(let dy=0;dy>=-5;dy--)w.tiles[idx(x,y+dy)]=B.SPRUCE_TRUNK;
  for(let dx=-3;dx<=3;dx++)for(let dy=-7;dy<=-4;dy++)if(Math.abs(dx)+(dy===-7?1:0)<=3&&dx!==0)w.tiles[idx(x+dx,y+dy)]=B.SPRUCE_LEAVES;
  w.tiles[idx(x-2,y-3)]=B.JACK;w.tiles[idx(x+2,y-3)]=B.JACK;w.tiles[idx(x,y-6)]=B.PUMPKIN;
  h.trees.push({x,y});x+=45;
 }
 for(let x=12;x<W-12;x+=7){
  if(r()>.55||Math.abs(x-W/2)<5)continue;
  const y=w.surface[x]-1,i=idx(x,y),ground=w.tiles[i+W];
  if(![B.GRASS,B.SNOW_GRASS,B.SAND,B.DIRT].includes(ground)||![B.AIR,B.TALL_GRASS,B.POPPY,B.DANDELION,B.DEAD_BUSH].includes(w.tiles[i])||!clean(x,x,y,y+1))continue;
  w.tiles[i]=r()<.2?B.JACK:B.PUMPKIN;w.meta[i]=0;sites.push({x,y});
 }
 for(const biome of Object.values(BIOME)){
  const shop=d.villagers.find(v=>v.shop===2&&w.biome[Math.floor(v.x)]===biome);
  if(shop){const x=Math.round(shop.x-6.8),y=Math.round(shop.y-.2);if(d.chests.get(idx(x,y))?.some(s=>s&&ITEMS[s.id]?.food)){food.push({x,y,biome});continue;}}
  for(let k=0;k<120;k++){
   const x=20+Math.floor(r()*(W-40)),y=w.surface[x]-1,i=idx(x,y);
   if(w.biome[x]!==biome||w.tiles[i]!==B.AIR||![B.GRASS,B.SNOW_GRASS,B.SAND].includes(w.tiles[i+W])||!clean(x,x,y,y+1))continue;
   w.tiles[i]=B.CHEST;const slots=Array(27).fill(null);slots[0]={id:I.APPLE,count:6};slots[1]={id:I.COOKED_PORK,count:4};d.chests.set(i,slots);food.push({x,y,biome});break;
  }
 }
 h.version=1;h.sites=sites;h.villages=villages;h.food=food;computeLight(w,0,W-1);G.dirty=[0,W-1];upgradeHaunted(G);
}
