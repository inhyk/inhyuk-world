import {signalPhase} from './law.mjs';
export const SAVE_KEY='free-drive-v1';
export const CARS=[
 {id:'mint',name:'민트 러너',tag:'가벼운 첫 드라이브',color:'#70e2c0',price:0,speed:24,shape:'compact'},
 {id:'ferrari',name:'페라리 458 이탈리아',tag:'Three.js 예제의 스포츠카 · 무료 선물',color:'#30363c',price:0,speed:48,shape:'ferrari'},
 {id:'sun',name:'선셋 쿠페',tag:'노을을 닮은 스포츠카',color:'#ffad66',price:150,speed:32,shape:'sport'},
 {id:'berry',name:'베리 밴',tag:'어디든 함께 떠나요',color:'#dba7ed',price:250,speed:22,shape:'van'},
 {id:'forest',name:'포레스트',tag:'숲속 전망대에서 발견',color:'#b9da73',hidden:true,speed:27,shape:'van'},
 {id:'ocean',name:'오션 블루',tag:'해변 등대에서 발견',color:'#76c9f3',hidden:true,speed:34,shape:'sport'},
 {id:'gold',name:'골든 아워',tag:'도시 광장에서 발견',color:'#f6d677',hidden:true,speed:38,shape:'sport'},
 {id:'brick-jeep',name:'레드 블록 지프',tag:'블록 지붕 · 투명 창문과 노란 헤드라이트',color:'#e44338',price:220,speed:31,shape:'jeep'},
 {id:'police',name:'경찰 순찰차',tag:'H로 앞쪽 차량에 수갑 채우기 · 다시 H로 해제',color:'#e8eff4',price:1000,speed:38,shape:'compact',kit:'police'},
 {id:'taxi',name:'옐로 택시',tag:'도시를 누비는 노란 택시',color:'#ffd257',price:180,speed:28,shape:'compact',kit:'taxi'},
 {id:'rally',name:'레드 랠리',tag:'줄무늬와 커다란 윙',color:'#ed7162',price:350,speed:37,shape:'sport',kit:'stripe'},
 {id:'camper',name:'구름 캠핑카',tag:'짐을 싣고 긴 여행을 떠나요',color:'#f0e7d5',price:400,speed:25,shape:'van',kit:'rack'},
 {id:'electric',name:'일렉트릭',tag:'푸른 라인이 빛나는 전기차',color:'#91d5de',price:500,speed:40,shape:'sport',kit:'stripe'},
 {id:'retro',name:'레트로 체리',tag:'체리빛 지붕의 클래식 카',color:'#b85978',price:300,speed:30,shape:'compact',kit:'roof'},
 {id:'explorer',name:'오렌지 탐험대',tag:'루프 캐리어가 달린 탐험차',color:'#e9a458',price:600,speed:33,shape:'van',kit:'rack'},
 {id:'comet',name:'코멧 스타',tag:'동쪽 새 지역의 별빛 주차장',color:'#bba2f2',hidden:true,speed:46,shape:'sport',kit:'stripe'},
 {id:'ice',name:'아이스 크리스털',tag:'서쪽 새 지역의 얼음빛 쉼터',color:'#d4f4ff',hidden:true,speed:41,shape:'sport',kit:'roof'},
 {id:'dragon',name:'드래곤 파이어',tag:'북쪽 새 지역의 붉은 봉화',color:'#e85b49',hidden:true,speed:44,shape:'sport',kit:'fins'},
 {id:'shadow',name:'섀도 나이트',tag:'남쪽 새 지역의 어두운 차고',color:'#515677',hidden:true,speed:45,shape:'sport',kit:'stripe'},
 {id:'candy',name:'캔디 드림',tag:'북동쪽 새 지역의 분홍 쉼터',color:'#f7a9d4',hidden:true,speed:32,shape:'van',kit:'roof'},
 {id:'safari',name:'사파리 킹',tag:'남서쪽 새 지역의 탐험 캠프',color:'#d3ba6f',hidden:true,speed:35,shape:'van',kit:'rack'},
];
const integer=(n,max=1e9)=>Number.isFinite(n)?Math.max(0,Math.min(max,Math.floor(n))):0;
export function cleanSave(s={}){if(!s||typeof s!=='object')s={};const owned=['mint',...CARS.filter(c=>c.id!=='mint'&&Array.isArray(s.owned)&&s.owned.includes(c.id)).map(c=>c.id)];return {coins:integer(s.coins),owned,selected:owned.includes(s.selected)?s.selected:'mint',daily:typeof s.daily==='string'?s.daily:'',seconds:integer(s.seconds),claimed:integer(s.claimed),distance:integer(s.distance),wanted:s.wanted===true,jailUntil:integer(s.jailUntil,Number.MAX_SAFE_INTEGER),durability:Object.fromEntries(CARS.filter(c=>Number.isFinite(s.durability?.[c.id])).map(c=>[c.id,integer(s.durability[c.id],100)]))};}
export function buy(s,id){const c=CARS.find(c=>c.id===id);if(!c)return false;if(s.owned.includes(id)){s.selected=id;return true;}if(c.hidden||s.coins<c.price)return false;s.coins-=c.price;s.owned.push(id);s.selected=id;return true;}
export function claimDaily(s,date){if(s.daily===date)return false;s.daily=date;s.coins+=100;return true;}
export function claimTime(s){if(Math.floor(s.seconds/120)<=s.claimed)return false;s.claimed++;s.coins+=60;return true;}
export function drive(p,input,dt,maxSpeed,solids=[]){dt=Math.min(.05,Math.max(0,dt));const oldX=p.x,oldZ=p.z;let target=input.gas?(p.gear==='D'?maxSpeed:p.gear==='R'?-maxSpeed*.4:0):0;const force=input.brake||p.gear==='P'?35:input.gas?10:4;p.speed+=Math.sign(target-p.speed)*Math.min(Math.abs(target-p.speed),force*dt);if(input.brake||p.gear==='P')p.speed=Math.sign(p.speed)*Math.max(0,Math.abs(p.speed)-35*dt);p.yaw+=input.steer*Math.min(1,Math.abs(p.speed)/5)*Math.sign(p.speed)*1.45*dt;p.x+=Math.sin(p.yaw)*p.speed*dt;p.z+=Math.cos(p.yaw)*p.speed*dt;
const hit=solids.findIndex(b=>Math.abs(p.x-b.x)<b.w/2+1.1&&Math.abs(p.z-b.z)<b.d/2+1.1);p.collisionIndex=hit;p.impactSpeed=Math.abs(p.speed);if(hit>=0){p.x=oldX;p.z=oldZ;p.speed=0;}return Math.hypot(p.x-oldX,p.z-oldZ);}

export const CHUNK_SIZE=240;
export const chunkAt=n=>Math.floor((n+CHUNK_SIZE/2)/CHUNK_SIZE);
export function chunkInfo(x,z){
 x=BigInt(x);z=BigInt(z);
 const seed=Number(BigInt.asUintN(32,x*73856093n^z*19349663n));
 const biome=seed%4;
 return {seed,biome,name:['그린필드','파인 포레스트','선셋 코스트','컬러 시티'][biome]};
}
export function nearestRoad(n){const center=chunkAt(n)*CHUNK_SIZE;return [-70,0,70].map(d=>center+d).sort((a,b)=>Math.abs(a-n)-Math.abs(b-n))[0];}
export function rebaseDelta(p){return {x:Math.abs(p.x)>960?chunkAt(p.x)*CHUNK_SIZE:0,z:Math.abs(p.z)>960?chunkAt(p.z)*CHUNK_SIZE:0};}
export function blockedAt(x,z,solids,radius=.4){return solids.some(b=>Math.abs(x-b.x)<b.w/2+radius&&Math.abs(z-b.z)<b.d/2+radius);}
export function vehicleBounds(v,padding=0){const s=Math.abs(Math.sin(v.yaw)),c=Math.abs(Math.cos(v.yaw));return {x:v.x,z:v.z,w:2.25*c+4.4*s+padding,d:4.4*c+2.25*s+padding};}
export function walk(p,dx,dz,dt,solids=[]){const length=Math.hypot(dx,dz);if(!length){p.speed=0;return 0;}const step=5*Math.min(.05,dt),ox=p.x,oz=p.z;dx=dx/length*step;dz=dz/length*step;if(!blockedAt(p.x+dx,p.z,solids))p.x+=dx;if(!blockedAt(p.x,p.z+dz,solids))p.z+=dz;p.yaw=Math.atan2(dx,dz);const moved=Math.hypot(p.x-ox,p.z-oz);p.speed=moved/Math.max(dt,.001);return moved;}
export function findExit(v,solids){const c=Math.cos(v.yaw),s=Math.sin(v.yaw);for(const [side,along] of [[3,0],[-3,0],[0,-4.5],[0,4.5],[3,-3],[-3,-3]]){const x=v.x+c*side+s*along,z=v.z-s*side+c*along;if(!blockedAt(x,z,solids,.5))return {x,z};}return null;}
export function nearestVehicle(p,vehicles){return vehicles.filter(v=>!v.cuffed&&Math.abs(v.speed)<.8&&Math.hypot(v.x-p.x,v.z-p.z)<5).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0]||null;}
export function stepTraffic(v,dt,{player,walking,vehicles,seconds,speedLimit=Infinity}){
 if(!v.auto)return;if(v.durability===0||v.cuffed){v.speed=0;return;}
 const sx=Math.sin(v.yaw),sz=Math.cos(v.yaw),vertical=Math.abs(sz)>.5;
 const ahead=(x,z)=>(x-v.x)*sx+(z-v.z)*sz;
 const lateral=(x,z)=>Math.abs((x-v.x)*sz-(z-v.z)*sx);
 let stop=walking&&Math.hypot(v.x-player.x,v.z-player.z)<13;
 if(!walking&&ahead(player.x,player.z)>0&&ahead(player.x,player.z)<12&&lateral(player.x,player.z)<3.2)stop=true;
 if(vehicles.some(o=>o!==v&&ahead(o.x,o.z)>0&&ahead(o.x,o.z)<10&&lateral(o.x,o.z)<2.8))stop=true;
 const coordinate=vertical?v.z:v.x,dir=vertical?sz:sx;
 // Alternating right-of-way at every crossing, with a clearing interval.
 const red=signalPhase(seconds,vertical?'z':'x')!=='green';
 const center=chunkAt(coordinate)*CHUNK_SIZE;
 for(let tile=-1;tile<=1;tile++)for(const offset of [-70,0,70]){const d=(center+tile*CHUNK_SIZE+offset-coordinate)*dir;if(red&&d>6&&d<13)stop=true;}
 const target=stop?0:Math.min(v.cruise,speedLimit);
 v.speed+=Math.sign(target-v.speed)*Math.min(Math.abs(target-v.speed),(stop?25:4)*dt);
 const x=v.x+sx*v.speed*dt,z=v.z+sz*v.speed*dt;
 if(vehicles.some(o=>o!==v&&Math.hypot(o.x-x,o.z-z)<4.8)||Math.hypot(player.x-x,player.z-z)<(walking?2.8:4.8)){v.speed=0;return;}
 v.x=x;v.z=z;
}

export const HIDDEN_TOTAL=CARS.filter(c=>c.hidden).length;
export const EXTRA_HIDDEN=['comet','ice','dragon','shadow','candy','safari'];
export function treasureForChunk(x,z){
 x=BigInt(x);z=BigInt(z);if(x===0n&&z===0n)return null;
 const guaranteed={'1,0':'comet','-1,0':'ice','0,1':'dragon','0,-1':'shadow','1,1':'candy','-1,-1':'safari'};
 return {id:guaranteed[`${x},${z}`]||EXTRA_HIDDEN[(chunkInfo(x,z).seed>>>4)%EXTRA_HIDDEN.length],x:12,z:28};
}
export function discover(s,id){if(!CARS.some(c=>c.id===id&&c.hidden)||s.owned.includes(id))return false;s.owned.push(id);return true;}

// A continuous press against the same obstacle is one accident, not one per frame.
export function applyCollision(v,seconds,x=v.x,z=v.z){
 if(v.durability===0)return false;
 if(v.lastImpact&&(seconds-v.lastImpact.seconds<.65||Math.hypot(x-v.lastImpact.x,z-v.lastImpact.z)<2))return false;
 v.durability=Math.max(0,(v.durability??100)-10);v.lastImpact={x,z,seconds};if(v.durability===0)v.speed=0;return true;
}
export function clearCollisionAfterSeparation(v){if(v.lastImpact&&Math.hypot(v.x-v.lastImpact.x,v.z-v.lastImpact.z)>=2)v.lastImpact=null;}

export function cuffTarget(p,occupied,vehicles,solids=[]){
 if(!occupied||occupied.model!=='police'||occupied.durability===0)return null;
 const sx=Math.sin(p.yaw),sz=Math.cos(p.yaw);
 return vehicles.filter(v=>{if(v===occupied)return false;const dx=v.x-p.x,dz=v.z-p.z,d=Math.hypot(dx,dz);if(d<.1||d>14||(dx*sx+dz*sz)/d<.2)return false;for(let t=1;t<d;t+=1)if(blockedAt(p.x+dx*t/d,p.z+dz*t/d,solids,.15))return false;return true;}).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0]||null;
}
export function toggleCuffs(v){if(v.cuffed){v.cuffed=false;v.auto=!!v.autoBeforeCuffs;}else{v.autoBeforeCuffs=v.auto;v.cuffed=true;v.auto=false;}v.speed=0;return v.cuffed;}
