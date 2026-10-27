import {B} from './data.mjs';
import {W,H,SEA,BIOME,idx,generateWorld,computeLight} from './core.mjs';

// This is an overworld region, so existing biome/save IDs stay compatible.
export function upgradeHaunted(G){
 const a=G.adventure,h=a.halloween;
 if(!h||h.terrainVersion===1)return;
 const d=a.dimension==='overworld'?{w:G.w,villagers:a.villagers}:a.worlds.overworld;
 if(!d)return;
 const w=d.w,base=generateWorld(w.seed),decor=new Set((h.sites??[]).map(p=>idx(p.x,p.y)));
 const safe=x=>{
  const y=w.surface[x];
  if(w.biome[x]===BIOME.OCEAN||y>=SEA-2||Math.abs(x-W/2)<65||d.villagers.some(v=>Math.abs(v.x-x)<38))return false;
  for(let yy=Math.max(1,y-16);yy<=Math.min(H-2,y+4);yy++){
   const i=idx(x,yy),t=w.tiles[i];
   if(w.meta[i]!==base.meta[i]||w.bg[i]!==base.bg[i])return false;
   if(t!==base.tiles[i]&&!(decor.has(i)&&[B.PUMPKIN,B.JACK].includes(t)))return false;
  }
  return true;
 };
 const usable=Array.from({length:W},(_,x)=>x>22&&x<W-23&&safe(x));
 let best=null;
 for(let start=30;start<W-75;start+=3){
  const end=start+44,columns=[];for(let x=start;x<=end;x++)if(usable[x])columns.push(x);
  if(columns.length<38)continue;
  const heights=columns.map(x=>w.surface[x]);if(Math.max(...heights)-Math.min(...heights)>14)continue;
  const score=columns.length*10-Math.abs((start+end)/2-(W/2+205))*.08;
  if(!best||score>best.score)best={start,end,columns,score};
 }
 if(!best){h.terrainVersion=1;return;}
 const {start,end,columns}=best,trees=[],stones=[];
 for(const x of columns){
  const y=w.surface[x];
  for(let yy=y-15;yy<y;yy++){const i=idx(x,yy);w.tiles[i]=B.AIR;w.meta[i]=0;}
  w.tiles[idx(x,y)]=x%4===0?B.MYCELIUM:B.PODZOL;
  for(let dy=1;dy<=2;dy++)w.tiles[idx(x,y+dy)]=B.COARSE_DIRT;
  if(x%9===0)w.tiles[idx(x,y-1)]=B.JACK;
  else if(x%7===0)w.tiles[idx(x,y-1)]=B.PUMPKIN;
  else if(x%5===0)w.tiles[idx(x,y-1)]=B.RED_MUSHROOM;
  else if(x%3===0)w.tiles[idx(x,y-1)]=B.DEAD_BUSH;
 }
 const put=(x,y,id)=>{w.tiles[idx(x,y)]=id;w.meta[idx(x,y)]=0;};
 for(let x=start+4;x<=end-4;x+=8){
  if(![-3,-2,-1,0,1,2,3].every(dx=>usable[x+dx]))continue;
  const y=w.surface[x],height=7+(x%3);
  for(let dy=1;dy<=height;dy++)put(x,y-dy,B.DARK_OAK_LOG);
  for(const side of[-1,1]){
   for(let k=1;k<=3;k++)put(x+side*k,y-height+2-Math.floor(k/2),B.DARK_OAK_LOG);
   put(x+side*3,y-height,B.DARK_OAK_LOG);
   put(x+side*2,y-height+3,B.COBWEB);
  }
  put(x,y-height-1,B.PUMPKIN);put(x-2,y-1,B.JACK);trees.push({x,y,height});
 }
 for(let x=start+8;x<end-4;x+=13){
  if(![0,1,2].every(dx=>usable[x+dx]))continue;
  const y=w.surface[x];
  for(let dx=0;dx<3;dx++)put(x+dx,w.surface[x+dx]-1,B.MOSSY_COBBLE);
  put(x+1,y-2,B.CHISELED_STONE_BRICKS);put(x+1,y-3,B.STONE_BRICK_SLAB);stones.push({x,y});
 }
 h.haunted={start,end,x:Math.round((start+end)/2),name:'속삭이는 안개 숲',trees,stones};h.terrainVersion=1;
 G.dirty=[0,W-1];
}
export function hauntedStrength(G){
 const h=G.adventure?.halloween?.haunted;
 if(!h||G.adventure.dimension!=='overworld'||G.jump||G.builder?.mode==='build')return 0;
 const x=G.cam.x,y=G.cam.y,s=G.w.surface[Math.max(0,Math.min(W-1,Math.floor(x)))];
 if(y>s+10)return 0;
 return Math.max(0,Math.min(1,(x-h.start+8)/12,(h.end+8-x)/12,(s+10-y)/8));
}
export function drawHauntedSky(g,G,cw,ch){
 const strength=hauntedStrength(G);if(!strength)return;
 g.save();g.globalAlpha=strength;
 const gradient=g.createLinearGradient(0,0,0,ch);gradient.addColorStop(0,'#111021');gradient.addColorStop(.7,'#3c2a4d');gradient.addColorStop(1,'#677064');g.fillStyle=gradient;g.fillRect(0,0,cw,ch);
 // Crescent moon and layers of crooked distant trees.
 g.fillStyle='#d9d6b3';g.beginPath();g.arc(cw*.76,ch*.19,27,0,Math.PI*2);g.fill();g.fillStyle='#191426';g.beginPath();g.arc(cw*.76+12,ch*.19-6,26,0,Math.PI*2);g.fill();
 for(let layer=0;layer<2;layer++){
  g.fillStyle=layer?'#20202d':'#34303f';
  for(let k=-1;k<15;k++){
   const x=((k*113-G.cam.x*(layer+1)*2)%(cw+180)+cw+180)%(cw+180)-90;
   const y=ch*(.66+layer*.12),height=100+(k*31%67+67)%67;
   g.fillRect(x,y-height,7,y+height);g.beginPath();g.moveTo(x+3,y-height*.3);g.lineTo(x-25,y-height*.7);g.lineTo(x-34,y-height*.72);g.moveTo(x+3,y-height*.55);g.lineTo(x+31,y-height*.86);g.lineTo(x+29,y-height);g.strokeStyle=g.fillStyle;g.lineWidth=6;g.stroke();
  }
 }
 g.restore();
}
export function drawHauntedMist(g,G,sx,sy,T,cw){
 const strength=hauntedStrength(G),h=G.adventure?.halloween?.haunted;
 if(strength&&h){g.save();g.beginPath();g.rect(sx(h.start),0,sx(h.end+1)-sx(h.start),10000);g.clip();
  for(let k=0;k<6;k++){
   const x=h.start+((k*9+G.clock*.25)%(h.end-h.start)),y=G.w.surface[Math.floor(x)]-1.5-k%2;
   const grad=g.createRadialGradient(sx(x),sy(y),0,sx(x),sy(y),T*7);grad.addColorStop(0,`rgba(177,190,175,${.09*strength})`);grad.addColorStop(1,'rgba(177,190,175,0)');g.fillStyle=grad;g.fillRect(sx(x)-T*7,sy(y)-T*3,T*14,T*6);
  }g.restore();}
 const tree=G.adventure?.halloween?.trees?.find(t=>t.special);if(!tree||Math.abs(tree.x-G.cam.x)>cw/T)return;
 const cx=sx(tree.x),cy=sy(tree.y-9);g.save();g.globalAlpha=.55+.3*Math.sin(G.clock*2);g.fillStyle='#ffe18a';
 for(let k=0;k<8;k++){const a=G.clock*.7+k*Math.PI/4,x=cx+Math.cos(a)*(T*(2.2+Math.sin(G.clock+k)*.2)),y=cy+Math.sin(a)*(T*(1.2+Math.cos(G.clock*1.3+k)*.15));g.fillRect(Math.round(x),Math.round(y),Math.max(2,Math.round(T*.08)),Math.max(2,Math.round(T*.08)));}
 g.restore();
}
