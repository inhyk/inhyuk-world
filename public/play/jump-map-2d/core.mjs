export const NAMES=['첫 구름','별빛 징검다리','흔들리는 하늘','사라지는 구름','민트 점프대','얼음 산책','노을 건너기','달빛 발판','무지개 여행','하늘 끝의 선물'];
export const LENGTH=1400;
export function makeCourse(){
 const platforms=[],stars=[];
 for(let stage=0;stage<10;stage++){
  platforms.push({x:stage*LENGTH,y:460,w:220,type:'checkpoint',stage});
  for(let j=0;j<6;j++){
   const type=stage>=2&&j===2?'moving':stage>=3&&j===4?'crumble':stage>=4&&j===1?'spring':stage>=5&&j===3?'ice':'normal';
   const p={x:stage*LENGTH+280+j*170,y:[430,390,360,400,350,410][j],w:118,type,stage,phase:stage*.8};
   platforms.push(p);
   if(j<5)stars.push({x:p.x+59,y:p.y-52,id:stars.length});
  }
 }
 platforms.push({x:10*LENGTH,y:460,w:330,type:'goal',stage:9});
 return {platforms,stars};
}
export function createState(){return {x:70,y:420,vx:0,vy:0,w:28,h:36,grounded:false,ground:-1,coyote:0,buffer:0,time:0,tick:0,checkpoint:0,deaths:0,stars:[],crumbles:{},finished:false,events:[]};}
export function platformAt(p,t){return {...p,x:p.x+(p.type==='moving'?Math.sin(t*1.8+p.phase)*24:0)};}
export function respawn(s,count=true){s.x=s.checkpoint*LENGTH+70;s.y=420;s.vx=0;s.vy=0;s.grounded=false;s.ground=-1;s.coyote=0;s.buffer=0;s.crumbles={};if(count){s.deaths++;s.events.push('death');}}
export function step(s,input,dt,course){
 s.events=[];if(s.finished)return;
 s.time+=dt;s.tick+=dt;
 for(const id of Object.keys(s.crumbles)){s.crumbles[id]+=dt;if(s.crumbles[id]>3)delete s.crumbles[id];}
 s.buffer=input.jump?.13:Math.max(0,s.buffer-dt);
 s.coyote=s.grounded?.1:Math.max(0,s.coyote-dt);
 const previous=course.platforms[s.ground];
 if(s.grounded&&previous?.type==='moving')s.x+=platformAt(previous,s.tick).x-platformAt(previous,s.tick-dt).x;
 const acceleration=s.grounded&&previous?.type==='ice'?500:2400;
 const target=(Number(!!input.right)-Number(!!input.left))*300;
 s.vx+=Math.sign(target-s.vx)*Math.min(Math.abs(target-s.vx),acceleration*dt);
 if(s.buffer>0&&s.coyote>0){s.vy=-650;s.grounded=false;s.coyote=0;s.buffer=0;s.events.push('jump');}
 const bottom=s.y+s.h;s.vy=Math.min(950,s.vy+1800*dt);s.x=Math.max(0,s.x+s.vx*dt);s.y+=s.vy*dt;s.grounded=false;s.ground=-1;
 for(let i=0;i<course.platforms.length;i++){
  const p=platformAt(course.platforms[i],s.tick);
  if(p.type==='crumble'&&s.crumbles[i]>.65)continue;
  if(s.vy>=0&&bottom<=p.y+1&&s.y+s.h>=p.y&&s.x+s.w>p.x&&s.x<p.x+p.w){
   s.y=p.y-s.h;s.vy=0;s.grounded=true;s.ground=i;
   if(p.type==='crumble'&&s.crumbles[i]===undefined)s.crumbles[i]=0;
   if(p.type==='spring'){s.vy=-830;s.grounded=false;s.events.push('spring');}
   if(p.type==='checkpoint'&&p.stage>s.checkpoint){s.checkpoint=p.stage;s.events.push('checkpoint');}
   if(p.type==='goal'){s.finished=true;s.events.push('finish');}
   break;
  }
 }
 for(const star of course.stars){if(!s.stars.includes(star.id)&&Math.hypot(s.x+s.w/2-star.x,s.y+s.h/2-star.y)<32){s.stars.push(star.id);s.events.push('star');}}
 if(s.y>780)respawn(s);
}
export function formatTime(t){return `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;}
