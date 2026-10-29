export const TRACKS = [
 {name:'SKYLINE', subtitle:'하늘 도시', bpm:144, speed:420, gap:180, difficulty:'HARD', color:'#bfff59', sky:'#2559eb'},
 {name:'AFTERGLOW', subtitle:'노을 속으로', bpm:156, speed:500, gap:160, difficulty:'EXPERT', color:'#ffe36a', sky:'#a64465'},
 {name:'HYPERSPACE', subtitle:'우주 돌파', bpm:168, speed:580, gap:144, difficulty:'INSANE', color:'#78fff0', sky:'#6342ca'},
];
export const LENGTH=11000, SIZE=32;
export function buildTrack(level=0) {
 const objects=[];
 for(const base of [0,4800,9200]) {
  for(const [dx,count] of [[650,2+level],[1120,3+level],[2350,3+level]]) {
   if(base+dx>LENGTH-400 || (base===4800 && dx===2350))continue;
   for(let j=0;j<count;j++)objects.push({x:base+dx+j*34,w:34,h:48+level*4,type:'spike'});
  }
  if(base+1800<LENGTH-400){objects.push({x:base+1740,w:48,h:8,type:'pad'});objects.push({x:base+1950,w:100,h:100,type:'block'});}
 }
 for(const base of [2600,7000]) {
  objects.push({x:base,w:45,type:'portal',form:'ship'});
  const halfGap=TRACKS[level].gap/2;
  for(let i=0;i<5;i++) {
   const x=base+320+i*340, center=205+Math.sin(i*1.5+level*.4)*62;
   objects.push({x,w:84,h:center-halfGap,type:'wall'});
   objects.push({x,w:84,bottom:center+halfGap,h:470-center-halfGap,type:'roof'});
  }
  objects.push({x:base+2200,w:45,type:'portal',form:'cube'});
 }
 for(let x=500;x<LENGTH-250;x+=280) {
  const ship=(x>2600&&x<4800)||(x>7000&&x<9200);
  objects.push({x,w:20,h:ship?200:70,type:'gem'});
 }
 return objects.sort((a,b)=>a.x-b.x);
}
export function createRun(level=0,practice=false) {
 return {level,practice,state:'ready',x:0,y:0,vy:0,form:'cube',rotation:0,attempt:1,checkpoint:0,checkpointForm:'cube',gems:0,collected:new Set(),objects:buildTrack(level),time:0,jumps:0,padCount:0};
}
export function press(g) {if(g.state==='playing'&&g.form==='cube'&&g.y<.5){g.vy=710;g.jumps++;return true;}return false;}
export function restart(g) {
 g.state='playing';g.x=g.practice?g.checkpoint:0;g.form=g.practice?g.checkpointForm:'cube';g.y=g.form==='ship'?205:0;g.vy=0;g.rotation=0;g.time=0;g.attempt++;g.gems=0;g.collected=new Set();
}
export function update(g,dt,held=false) {
 if(g.state!=='playing')return;
 const previousX=g.x,previousY=g.y;
 g.x+=TRACKS[g.level].speed*dt;g.time+=dt;
 if(g.form==='ship'){g.vy=Math.max(-255,Math.min(255,g.vy+(held?1050:-780)*dt));g.rotation=-g.vy/700;}
 else {if(held)press(g);g.vy-=2200*dt;g.rotation=g.y>0?g.rotation+dt*8:0;}
 g.y+=g.vy*dt;
 if(g.form==='cube'&&g.y<0){g.y=0;g.vy=0;g.rotation=0;}
 if(g.form==='ship'&&(g.y<0||g.y+SIZE>470)){g.state='dead';return;}
 for(let i=0;i<g.objects.length;i++) {
  const o=g.objects[i];if(o.x>g.x+SIZE)break;if(o.x+o.w<g.x-5)continue;
  if(o.type==='portal') {
   if(previousX+SIZE<o.x&&g.x+SIZE>=o.x){g.form=o.form;g.y=o.form==='ship'?205:Math.max(0,g.y);g.vy=0;g.rotation=0;if(g.practice){g.checkpoint=o.x+60;g.checkpointForm=o.form;}}
   continue;
  }
  if(o.type==='gem'){if(!g.collected.has(i)&&Math.abs(g.y+16-o.h)<33){g.collected.add(i);g.gems++;}continue;}
  if(o.type==='pad'){if(g.y<=12&&g.vy<=0){g.vy=930;g.padCount++;}continue;}
  if(g.x+SIZE-5<=o.x||g.x+5>=o.x+o.w)continue;
  if(o.type==='block'&&g.vy<=0&&previousY>=o.h-2&&g.y<=o.h){g.y=o.h;g.vy=0;continue;}
  let hit=false;
  if(o.type==='roof')hit=g.y+SIZE-5>o.bottom;
  else if(o.type==='spike') {
   const near=Math.max(g.x+6,Math.min(g.x+SIZE-6,o.x+o.w/2));
   hit=g.y+6<o.h*(1-Math.abs(near-o.x-o.w/2)/(o.w/2));
  } else hit=g.y+5<o.h;
  if(hit){g.state='dead';return;}
 }
 if(g.practice&&g.form==='cube'&&g.y===0&&g.x-g.checkpoint>1200&&!g.objects.some(o=>!['gem','portal'].includes(o.type)&&o.x>g.x-100&&o.x<g.x+500)){g.checkpoint=g.x;g.checkpointForm='cube';}
 if(g.x>=LENGTH)g.state='won';
}
