import { B } from './data.mjs';
import { W,H,idx,generateWorld,noise1,computeLight } from './core.mjs';

export function makeMoon(seed) {
  const w=generateWorld(seed);w.tiles.fill(B.AIR);w.bg.fill(B.AIR);w.meta.fill(0);
  for(let x=0;x<W;x++){
    const crater=Math.max(0,1-Math.abs(x%83-41)/16)*5;
    const floor=Math.round(80+noise1(seed+870,x/28)*7+crater);w.surface[x]=floor;
    for(let y=floor;y<H;y++)w.tiles[idx(x,y)]=y===H-1?B.BEDROCK:y>floor+6&&(x*7+y*13)%61===0?B.METEOR_ORE:B.MOON_STONE;
  }
  computeLight(w,0,W-1);return w;
}
export function landingPad(w,x) {
  const floor=w.surface[x];
  for(let xx=x-5;xx<=x+5;xx++){
    w.surface[xx]=floor;
    for(let y=floor-10;y<=floor+2;y++){const i=idx(xx,y);w.tiles[i]=y>=floor?B.STONE_BRICKS:B.AIR;w.meta[i]=0;w.bg[i]=B.AIR;}
  }
  computeLight(w,x-20,x+20);return {x:x+.5,y:floor};
}
export function addEndIslands(w) {
  // 중앙 전투 섬을 건드리지 않고 바깥 섬과 다리·탑을 더한다.
  for(const [cx,top] of [[W/2+170,83],[W/2+278,76],[W/2-195,85]]){
    for(let x=cx-28;x<=cx+28;x++){
      const edge=Math.abs(x-cx),floor=top+Math.floor(edge/13);w.surface[x]=floor;
      for(let y=floor;y<Math.min(H-1,floor+18-edge/2);y++){w.tiles[idx(x,y)]=B.END_STONE;w.meta[idx(x,y)]=0;}
    }
    for(let x=cx-6;x<=cx+6;x++){
      const floor=w.surface[cx];
      for(let y=floor-10;y<=floor;y++){
        if(y===floor||y===floor-10||x===cx-6||x===cx+6)w.tiles[idx(x,y)]=B.PURPUR;
        else w.tiles[idx(x,y)]=B.AIR;
      }
      if(Math.abs(x-cx)<=2){w.tiles[idx(x,top-1)]=B.AIR;w.tiles[idx(x,top-2)]=B.AIR;}
    }
    for(let y=top-3;y<top;y++)w.tiles[idx(cx-6,y)]=B.AIR;
    w.tiles[idx(cx+2,top-1)]=B.CHEST;
    for(let y=top-7;y<top-1;y++)w.tiles[idx(cx+5,y)]=B.LADDER;
    w.tiles[idx(cx,top-11)]=B.GLOWSTONE;
  }
  // 동쪽 탐험로. 서쪽의 큰 틈은 그대로 남겨 공허의 긴장을 유지한다.
  for(let x=W/2+82;x<=W/2+255;x++)if(w.surface[x]>100){const y=85-Math.max(0,Math.min(7,Math.floor((x-850)/5)));w.tiles[idx(x,y)]=B.PURPUR;w.surface[x]=y;}
  computeLight(w,0,W-1);
}
export const END_TREASURES=[{x:W/2+172,y:82},{x:W/2+280,y:75},{x:W/2-193,y:84}];
export function drawMoonSky(g,G,cw,ch) {
  const grad=g.createLinearGradient(0,0,0,ch);grad.addColorStop(0,'#030617');grad.addColorStop(1,'#19263a');g.fillStyle=grad;g.fillRect(0,0,cw,ch);
  for(let k=0;k<150;k++){g.fillStyle=k%4?'#abbcda':'#fff6db';g.fillRect(((k*137-G.cam.x*1.2)%cw+cw)%cw,(k*73)%Math.round(ch*.75),k%5?2:3,2);}
  // 그림처럼 파란 바다와 초록 대륙을 가진 정육면체 지구.
  const s=Math.min(cw*.19,ch*.25),x=cw*.73-s*.5,y=ch*.14;
  g.save();g.translate(x,y);g.shadowColor='#5ab8ff';g.shadowBlur=35;
  g.fillStyle='#2176d2';g.fillRect(0,s*.25,s,s);g.shadowBlur=0;
  g.fillStyle='#15529b';g.beginPath();g.moveTo(s,s*.25);g.lineTo(s*1.32,0);g.lineTo(s*1.32,s);g.lineTo(s,s*1.25);g.fill();
  g.fillStyle='#71beed';g.beginPath();g.moveTo(0,s*.25);g.lineTo(s*.32,0);g.lineTo(s*1.32,0);g.lineTo(s,s*.25);g.fill();
  const land=[[0,2,3,2],[1,4,2,1],[5,1,2,2],[4,3,3,2],[5,5,2,2],[2,7,3,1],[0,0,2,1],[7,6,1,2]];
  for(const [a,b,w,h]of land){g.fillStyle=b%2?'#46945c':'#63b76b';g.fillRect(a*s/8,s*.25+b*s/8,w*s/8,h*s/8);}
  g.fillStyle='#a6dba0';g.fillRect(s*.4,s*.06,s*.3,s*.12);g.fillStyle='#43815c';g.fillRect(s*1.04,s*.27,s*.2,s*.35);
  g.fillStyle='#e5f3ed';g.fillRect(s*.08,s*.35,s*.4,s*.05);g.fillRect(s*.52,s*.9,s*.4,s*.06);
  g.strokeStyle='#b2e8ff';g.lineWidth=2;g.strokeRect(0,s*.25,s,s);g.restore();
}
export function drawRocket(g,G,sx,sy,T) {
 const r=G.adventure?.rocketSites?.[G.adventure.dimension];if(!r)return;
 const x=sx(r.x),y=sy(r.y);g.save();g.translate(x,y);
 g.fillStyle='#92a0ab';g.fillRect(-T*.85,-T*4.9,T*1.7,T*4.2);
 g.fillStyle='#f0eee3';g.fillRect(-T*.6,-T*4.8,T*1.1,T*3.8);
 g.fillStyle='#c34b44';g.beginPath();g.moveTo(-T*.85,-T*4.8);g.lineTo(0,-T*6);g.lineTo(T*.85,-T*4.8);g.fill();
 g.fillStyle='#4eb6d0';g.fillRect(-T*.38,-T*4.2,T*.76,T*.9);g.fillStyle='#c9f5ff';g.fillRect(-T*.3,-T*4.12,T*.2,T*.25);
 g.fillStyle='#bc4947';for(const d of[-1,1]){g.beginPath();g.moveTo(d*T*.65,-T*2);g.lineTo(d*T*1.5,-T*.1);g.lineTo(d*T*.65,-T*.4);g.fill();}
 g.fillStyle='#273342';g.fillRect(-T*.45,-T*.65,T*.9,T*.65);
 g.fillStyle='#f2ce79';g.font=`${Math.max(11,T*.27)}px Galmuri11`;g.textAlign='center';g.fillText(G.adventure.dimension==='moon'?(G.builder&&!G.builder.survival?'R · 건축 세계로 귀환':'R · 지구로 귀환'):'R · 달 탐사선',0,-T*6.3);g.restore();
}

export function upgradeWaters(w,{nearSpawnOnly=false}={}) {
  const fresh=generateWorld(w.seed);
  const previous=generateWorld(w.seed,{nearbyPond:false});
  const natural=new Set([B.AIR,B.GRASS,B.DIRT,B.STONE,B.SAND,B.GRAVEL,B.SNOW_GRASS,B.WATER,B.ICE,B.OAK_TRUNK,B.BIRCH_TRUNK,B.SPRUCE_TRUNK,B.OAK_LEAVES,B.BIRCH_LEAVES,B.SPRUCE_LEAVES,B.TALL_GRASS,B.POPPY,B.DANDELION,B.CACTUS,B.DEAD_BUSH]);
  for(const [left,right]of(nearSpawnOnly?[[614,626]]:[[95,235],[293,307],[523,537],[614,626],[958,972]])){
    let clear=true;
    for(let x=left-2;x<=right+2&&clear;x++)for(let y=0;y<=Math.max(w.surface[x],fresh.surface[x])+4;y++){
      const i=idx(x,y);
      if(left===614 ? (w.tiles[i]!==previous.tiles[i]||w.bg[i]!==previous.bg[i]||w.meta[i]!==previous.meta[i]) : !natural.has(w.tiles[i])){clear=false;break;}
    }
    if(!clear)continue; // 이미 지은 집이 있는 구역은 그대로 둔다.
    for(let x=left;x<=right;x++){
      const bottom=Math.max(w.surface[x],fresh.surface[x])+(left===614?4:1);
      for(let y=0;y<=bottom;y++){const i=idx(x,y);w.tiles[i]=fresh.tiles[i];w.bg[i]=fresh.bg[i];w.meta[i]=fresh.meta[i];}
      w.surface[x]=fresh.surface[x];w.biome[x]=fresh.biome[x];
    }
  }
  computeLight(w,0,W-1);
}

export function makeSchool(seed) {
 const w=generateWorld(seed);w.tiles.fill(B.AIR);w.bg.fill(B.AIR);w.meta.fill(0);w.surface.fill(87);
 for(let x=0;x<W;x++)for(let y=87;y<H;y++)w.tiles[idx(x,y)]=y===H-1?B.BEDROCK:y===87?B.PLANKS:B.STONE;
 for(let x=615;x<=668;x++)for(let y=73;y<=87;y++){
   if(y===73||x===615||x===668)w.tiles[idx(x,y)]=B.STONE_BRICKS;
   w.bg[idx(x,y)]=y>84?B.PLANKS:B.SANDSTONE;
   if(x%12<7&&y>=76&&y<81)w.bg[idx(x,y)]=B.GLASS;
 }
 for(const x of[626,632,638,644,650]){w.tiles[idx(x,85)]=B.PLANKS;w.tiles[idx(x+1,85)]=B.PLANKS;w.tiles[idx(x,86)]=B.OAK_LOG;w.tiles[idx(x-1,86)]=B.PLANKS;}
 for(let x=619;x<=627;x++)for(let y=76;y<=79;y++)w.bg[idx(x,y)]=B.MOSSY_COBBLE;
 for(const x of[621,633,645,657]){w.tiles[idx(x,74)]=B.GLOWSTONE;w.tiles[idx(x,82)]=B.TORCH;}
 w.tiles[idx(628,84)]=B.DIAMOND_BLOCK;
 computeLight(w,0,W-1);return w;
}
