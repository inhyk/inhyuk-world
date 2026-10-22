import { B,ITEMS } from './data.mjs';
import { W,H,idx,generateWorld,computeLight } from './core.mjs';
import { tex } from './textures.mjs';
const KEY={S:B.STONE_BRICKS,P:B.PLANKS,G:B.GLASS,O:B.OAK_LOG,W:B.IRON_BLOCK,R:B.NETHERRACK,C:B.COAL_BLOCK,F:B.GLOWSTONE,L:B.OAK_LEAVES};
export const BLUEPRINTS=[
 {name:'네모 성',rows:[' S S S S S ',' SSSSSSSSS ',' SSSSSSSSS ',' SGGSSSGGS ',' SGGSSSGGS ',' SSSSSSSSS ',' SSS   SSS ',' SSS   SSS ','SSSSSSSSSSS']},
 {name:'숲속 작은 집',rows:['     S     ','    SSS    ','   SPPPS   ','  SPPPPPS  ',' SPPPPPPPS ',' OGGPPPGGO ',' OGGPPPGGO ',' OPP   PPO ','SSSSSSSSSSS']},
 {name:'달 탐사 우주선',kind:'rocket',rows:['     R     ','    RRR    ','    WWW    ','    WGW    ','    WGW    ','    WWW    ','   RWWWR   ','  RRWWWRR  ',' RR W W RR ','    C C    ','SSSSSSSSSSS']},
 {name:'별빛 등대',rows:['    SSS    ','   SFFFS   ','   GFFFG   ','   SSSSS   ','    WWW    ','    RRR    ','    WWW    ','    RRR    ','    WGW    ','   SSSSS   ','SSSSSSSSSSS']},
 {name:'커다란 버섯 집',rows:['   RRRRR   ','  RRWRRRR  ',' RRRRRRWRR ','RRWRRRRRRRR','RRRRRRWRRRR','    WWW    ','    WGW    ','    WWW    ','SSSSSSSSSSS']},
 {name:'초록 나무',rows:['    LLL    ','  LLLLLLL  ',' LLLLLLLLL ','LLLLLLLLLLL',' LLLLLLLLL ','   LOOOL   ','    OOO    ','    OOO    ','SSSSSSSSSSS']},
 {name:'빛나는 다리',rows:['   FFFFF   ','  FF   FF  ',' FF     FF ','FF       FF','W         W','W         W','SSSSSSSSSSS']},
 {name:'바다의 돛단배',rows:['     O     ','     OPP   ','     OPPP  ','     OPPPP ','     O     ','WOOOOOOOOOW',' WWWWWWWWW ','  SSSSSSS  ']},
 {name:'하트 조형물',rows:['  RR   RR  ',' RRRR RRRR ',' RRRRRRRRR ','  RRRRRRR  ','   RRRRR   ','    RRR    ','     R     ','SSSSSSSSSSS']},
];
export const isBuildWorld=G=>!!G.builder&&!G.builder.survival;
export const guideActive=G=>!!G.builder&&G.builder.active!==false;
export function stopGuide(G){if(G.builder)G.builder.active=false;}
function plotFor(G,number){
 const b=G.builder;return b.survival?b.plots?.[number]:{x:W/2-5+number*22,y:b.y};
}
function survivalPlot(G){
 const used=Object.values(G.builder.plots),px=Math.floor(G.player.x);
 for(let step=0;step<W;step+=22)for(const dir of [1,-1]){
  const x=Math.max(2,Math.min(W-14,px+4+step*dir));
  if(used.some(p=>Math.abs(p.x-x)<15))continue;
  const y=Math.max(16,Math.min(H-4,...Array.from({length:11},(_,k)=>G.w.surface[x+k]-1)));
  return {x,y};
 }
 return {x:Math.max(2,px-14),y:Math.max(16,G.w.surface[px]-1)};
}
export function guideCells(G,number=G.builder.plan??0){
 const plan=BLUEPRINTS[number],cells=[],plot=plotFor(G,number);if(!plot)return cells;const left=plot.x;
 for(let row=plan.rows.length-1;row>=0;row--)for(let col=0;col<plan.rows[row].length;col++){
  const id=KEY[plan.rows[row][col]];if(id)cells.push({x:left+col,y:plot.y-plan.rows.length+1+row,id});
 }
 return cells;
}
export function guideProgress(G){
 const cells=guideCells(G),missing=cells.filter(c=>G.w.tiles[idx(c.x,c.y)]!==c.id),needs=new Map();
 for(const c of missing)needs.set(c.id,(needs.get(c.id)??0)+1);
 return {cells,missing,needs,done:cells.length-missing.length,total:cells.length};
}
export function makeBuildWorld(seed){
 const w=generateWorld(seed);w.tiles.fill(B.AIR);w.bg.fill(B.AIR);w.meta.fill(0);w.surface.fill(88);
 for(let x=0;x<W;x++)for(let y=88;y<H;y++)w.tiles[idx(x,y)]=y===H-1?B.BEDROCK:y===88?B.GRASS:y<92?B.DIRT:B.STONE;
 computeLight(w,0,W-1);return w;
}
export function initBuildGuide(G){
 G.builder={plan:0,x:W/2-5,y:87,completed:[]};
 G.player.x=W/2-8;G.player.y=85.1;G.player.spawn={x:G.player.x,y:G.player.y};G.cam={x:G.player.x,y:G.player.y};
 grantGuideMaterials(G);
}
export function grantGuideMaterials(G){
 if(G.builder.survival)return;
 const ids=[...new Set(guideCells(G).map(c=>c.id))];
 ids.forEach((id,k)=>G.player.inv[k]={id,count:64});
}
export function selectGuide(G,number){
 if(!BLUEPRINTS[number]||G.adventure?.dimension!=='overworld')return false;
 G.builder??={survival:true,active:true,plan:number,completed:[],plots:{}};
 const b=G.builder;b.active=true;
 if(b.survival){b.plots??={};b.plots[number]??=survivalPlot(G);Object.assign(b,b.plots[number]);b.plan=number;}
 else if(b.plan!==number){b.plan=number;b.x=W/2-5+number*22;Object.assign(G.player,{x:b.x-3,y:85.1,vx:0,vy:0,fallTop:85.1,flying:false});G.cam={x:G.player.x,y:G.player.y};}
 grantGuideMaterials(G);return true;
}
export function builtRocket(G){
 if(!G.builder||G.adventure?.dimension!=='overworld')return null;
 const number=BLUEPRINTS.findIndex(p=>p.kind==='rocket'),cells=guideCells(G,number);
 if(!cells.length||cells.some(c=>G.w.tiles[idx(c.x,c.y)]!==c.id))return null;
 const plot=plotFor(G,number);return {x:plot.x+5.5,y:plot.y+1};
}
export function tickBuildGuide(G,toast,save){
 const p=guideProgress(G);G.builder.completed??=[];
 const rocket=builtRocket(G);if(rocket&&G.adventure){G.adventure.rocketSites??={};G.adventure.rocketSites.overworld=rocket;G.adventure.rocketSource='blueprint';}else if(G.adventure?.rocketSource==='blueprint')delete G.adventure.rocketSites.overworld;
 if(guideActive(G)&&!p.missing.length&&!G.builder.completed.includes(G.builder.plan)){
  G.builder.completed.push(G.builder.plan);toast(`${BLUEPRINTS[G.builder.plan].name} 완성! 다른 그림에도 도전해 봐!`);save();
 }
}
export function drawBuildGuide(g,G,sx,sy,T){
 if(!guideActive(G))return;
 const p=guideProgress(G),next=p.missing[0];g.save();
 for(const c of p.missing){
  g.globalAlpha=c===next?.48:.16;g.drawImage(tex[c.id],sx(c.x),sy(c.y),T,T);
  g.globalAlpha=1;g.strokeStyle=c===next?'#ffe49b':'#7cd6cf66';g.lineWidth=c===next?3:1;g.strokeRect(sx(c.x)+1,sy(c.y)+1,T-2,T-2);
 }
 const rocket=builtRocket(G);if(rocket){g.fillStyle='#ffe8b0';g.globalAlpha=1;g.font=`${Math.max(12,T*.26)}px Galmuri11`;g.textAlign='center';g.fillText('R · 완성한 우주선으로 달에 가기',sx(rocket.x),sy(rocket.y-12));}
 if(next){g.globalAlpha=1;g.fillStyle='#ffe8b0';g.font=`${Math.max(12,T*.25)}px Galmuri11`;g.textAlign='center';g.fillText(`다음 · ${ITEMS[next.id].name}`,sx(next.x+.5),sy(next.y)-8);}
 g.restore();
}
export function guidePreview(G,number=G.builder.plan){
 const c=document.createElement('canvas');c.width=352;c.height=304;c.id='blueprintPreview';c.setAttribute('aria-label',BLUEPRINTS[number].name+' 완성 그림');
 const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.fillStyle='#122c37';g.fillRect(0,0,c.width,c.height);
 const plan=BLUEPRINTS[number],s=Math.min(24,Math.floor(250/plan.rows.length)),left=(352-11*s)/2;
 for(let y=0;y<plan.rows.length;y++)for(let x=0;x<plan.rows[y].length;x++){const id=KEY[plan.rows[y][x]];if(id)g.drawImage(tex[id],left+x*s,24+y*s,s,s);}
 g.fillStyle='#67984b';g.fillRect(20,24+plan.rows.length*s,312,10);return c;
}
