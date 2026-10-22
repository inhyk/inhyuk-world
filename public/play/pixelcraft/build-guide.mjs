import { B,ITEMS } from './data.mjs';
import { W,H,idx,generateWorld,computeLight } from './core.mjs';
import { tex } from './textures.mjs';
const KEY={S:B.STONE_BRICKS,P:B.PLANKS,G:B.GLASS,O:B.OAK_LOG};
export const BLUEPRINTS=[
 {name:'네모 성',rows:[' S S S S S ',' SSSSSSSSS ',' SSSSSSSSS ',' SGGSSSGGS ',' SGGSSSGGS ',' SSSSSSSSS ',' SSS   SSS ',' SSS   SSS ','SSSSSSSSSSS']},
 {name:'숲속 작은 집',rows:['     S     ','    SSS    ','   SPPPS   ','  SPPPPPS  ',' SPPPPPPPS ',' OGGPPPGGO ',' OGGPPPGGO ',' OPP   PPO ','SSSSSSSSSSS']},
];
export function guideCells(G){
 const b=G.builder,plan=BLUEPRINTS[b.plan??0],cells=[];
 for(let row=plan.rows.length-1;row>=0;row--)for(let col=0;col<plan.rows[row].length;col++){
  const id=KEY[plan.rows[row][col]];if(id)cells.push({x:b.x+col,y:b.y-plan.rows.length+1+row,id});
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
 const blocks=[B.STONE_BRICKS,B.PLANKS,B.GLASS,B.OAK_LOG];blocks.forEach((id,k)=>G.player.inv[k]={id,count:64});
}
export function tickBuildGuide(G,toast,save){
 const p=guideProgress(G);G.builder.completed??=[];
 if(!p.missing.length&&!G.builder.completed.includes(G.builder.plan)){
  G.builder.completed.push(G.builder.plan);toast(`${BLUEPRINTS[G.builder.plan].name} 완성! 다른 그림에도 도전해 봐!`);save();
 }
}
export function drawBuildGuide(g,G,sx,sy,T){
 const p=guideProgress(G),next=p.missing[0];g.save();
 for(const c of p.missing){
  g.globalAlpha=c===next?.48:.16;g.drawImage(tex[c.id],sx(c.x),sy(c.y),T,T);
  g.globalAlpha=1;g.strokeStyle=c===next?'#ffe49b':'#7cd6cf66';g.lineWidth=c===next?3:1;g.strokeRect(sx(c.x)+1,sy(c.y)+1,T-2,T-2);
 }
 if(next){g.globalAlpha=1;g.fillStyle='#ffe8b0';g.font=`${Math.max(12,T*.25)}px Galmuri11`;g.textAlign='center';g.fillText(`다음 · ${ITEMS[next.id].name}`,sx(next.x+.5),sy(next.y)-8);}
 g.restore();
}
export function guidePreview(G){
 const c=document.createElement('canvas');c.width=352;c.height=304;c.id='blueprintPreview';c.setAttribute('aria-label',BLUEPRINTS[G.builder.plan].name+' 완성 그림');
 const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.fillStyle='#122c37';g.fillRect(0,0,c.width,c.height);
 const plan=BLUEPRINTS[G.builder.plan],s=24;
 for(let y=0;y<plan.rows.length;y++)for(let x=0;x<plan.rows[y].length;x++){const id=KEY[plan.rows[y][x]];if(id)g.drawImage(tex[id],44+x*s,24+y*s,s,s);}
 g.fillStyle='#67984b';g.fillRect(20,24+plan.rows.length*s,312,10);return c;
}
