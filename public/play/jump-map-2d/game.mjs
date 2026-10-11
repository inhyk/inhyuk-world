import {NAMES,LENGTH,makeCourse,createState,platformAt,respawn,step,formatTime} from './core.mjs';
const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d'),course=makeCourse();
let s=createState(),mode='start',camera=0,width=0,height=0,scale=1,last=0,accumulator=0,best=null,sound=false,audio,toastTimer;
const keys=new Set(),touch=new Set();let queued=false;
try{const saved=JSON.parse(localStorage.getItem('cloud-jump-2d-v1'));if(saved){best=Number.isFinite(saved.best)&&saved.best>0?saved.best:null;s.checkpoint=Number.isInteger(saved.checkpoint)?Math.max(0,Math.min(9,saved.checkpoint)):0;s.time=Number.isFinite(saved.time)?Math.max(0,saved.time):0;s.deaths=Number.isInteger(saved.deaths)?Math.max(0,saved.deaths):0;s.stars=Array.isArray(saved.stars)?[...new Set(saved.stars.filter(id=>Number.isInteger(id)&&id>=0&&id<50))]:[];respawn(s,false);}}catch{}
function save(){try{localStorage.setItem('cloud-jump-2d-v1',JSON.stringify({best,checkpoint:s.finished?0:s.checkpoint,time:s.finished?0:s.time,deaths:s.finished?0:s.deaths,stars:s.finished?[]:s.stars}));}catch{}}
function tone(freq){if(!sound)return;try{audio??=new AudioContext();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq*1.5,audio.currentTime+.12);g.gain.setValueAtTime(.06,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.2);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.21);}catch{}}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2200);}
function resize(){width=innerWidth;height=innerHeight;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=width*dpr;canvas.height=height*dpr;scale=Math.min(width/780,height/700);ctx.setTransform(dpr,0,0,dpr,0,0);}
addEventListener('resize',resize);resize();
function clearInput(){keys.clear();touch.clear();queued=false;}
function pause(){if(mode!=='play')return;mode='pause';clearInput();$('overlay').hidden=false;$('intro').textContent='잠깐 쉬어가요. 준비되면 이어서 점프!';$('play').textContent='계속하기 →';$('pause').textContent='▶';save();}
$('pause').onclick=()=>mode==='play'?pause():mode==='pause'?start():null;
function start(){if(mode==='finish'){s=createState();camera=0;document.querySelector('h1').innerHTML='구름 <em>점프</em>';save();}mode='play';$('overlay').hidden=true;$('pause').textContent='Ⅱ';canvas.focus();clearInput();}
$('play').onclick=start;
$('sound').onclick=()=>{sound=!sound;$('sound').textContent=sound?'소리 ON':'소리 OFF';$('sound').setAttribute('aria-pressed',String(sound));$('sound').setAttribute('aria-label',sound?'소리 끄기':'소리 켜기');tone(600);};
addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','Space','KeyA','KeyD','KeyW','KeyR','KeyP','Escape'].includes(e.code))e.preventDefault();if(e.repeat)return;if(e.code==='KeyP'||e.code==='Escape'){if(mode==='play')pause();else if(mode==='pause')start();return;}if(mode!=='play')return;keys.add(e.code);if(['Space','ArrowUp','KeyW'].includes(e.code))queued=true;if(e.code==='KeyR'){respawn(s);save();}});
addEventListener('keyup',e=>keys.delete(e.code));
for(const b of document.querySelectorAll('[data-key]')){b.addEventListener('pointerdown',e=>{e.preventDefault();if(mode!=='play')return;b.setPointerCapture(e.pointerId);touch.add(b.dataset.key);if(b.dataset.key==='jump')queued=true;});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>touch.delete(b.dataset.key));}
addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});addEventListener('pagehide',save);
if(s.checkpoint>0){$('play').textContent=`STAGE ${s.checkpoint+1} 이어하기 →`;$('guide').textContent='지난 체크포인트를 기억하고 있어요. 방향키 이동 · 스페이스 점프';}
if(best)$('best').textContent=`최고 기록 ${formatTime(best)}`;
function finish(){mode='finish';if(!best||s.time<best)best=s.time;save();$('overlay').hidden=false;document.querySelector('h1').innerHTML='하늘 끝 <em>도착!</em>';$('intro').innerHTML=`10개 스테이지 완주! ★ ${s.stars.length} / 50<br>${formatTime(s.time)} · 넘어짐 ${s.deaths}번`;$('play').textContent='처음부터 다시 도전 →';$('guide').textContent='별 50개를 모두 모으는 도전도 해보세요!';$('best').textContent=`최고 기록 ${formatTime(best)}`;}
function round(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function cloud(x,y,size,opacity=1){ctx.globalAlpha=opacity;ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(x,y,65*size,18*size,0,0,Math.PI*2);ctx.ellipse(x-23*size,y-13*size,26*size,24*size,0,0,Math.PI*2);ctx.ellipse(x+10*size,y-23*size,33*size,32*size,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
function star(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,rr=i%2?r*.45:r;const xx=x+Math.cos(a)*rr,yy=y+Math.sin(a)*rr;if(i)ctx.lineTo(xx,yy);else ctx.moveTo(xx,yy);}ctx.closePath();ctx.fill();}
function draw(){
 const night=s.checkpoint>=7, sunset=s.checkpoint>=6&&!night;
 const grad=ctx.createLinearGradient(0,0,0,height);grad.addColorStop(0,night?'#8c9bcf':sunset?'#efc3b6':'#b6def5');grad.addColorStop(1,night?'#e5d9ef':sunset?'#fff0d7':'#edf8ef');ctx.fillStyle=grad;ctx.fillRect(0,0,width,height);
 ctx.fillStyle='#fff9';ctx.beginPath();ctx.arc(width*.79,height*.24,40,0,Math.PI*2);ctx.fill();
 for(let i=0;i<12;i++){const period=width+230,x=((i*227-camera*.18*scale)%period+period)%period-100;cloud(x,height*(.27+(i%3)*.17),.6+(i%3)*.25,.5);}
 ctx.save();const base=Math.max(130,height*.28);ctx.translate(0,base);ctx.scale(scale,scale);const view=width/scale;
 for(let layer=0;layer<2;layer++){ctx.fillStyle=layer?'#8bbca944':'#99bbd12b';ctx.beginPath();ctx.moveTo(0,700);for(let x=-100;x<view+200;x+=100)ctx.lineTo(x,400+layer*85+Math.sin((x+camera*.15)/220)*65);ctx.lineTo(view,700);ctx.fill();}
 ctx.translate(-camera,0);
 for(let i=0;i<course.platforms.length;i++){
  const p=platformAt(course.platforms[i],s.tick);if(p.x+p.w<camera-80||p.x>camera+view+80)continue;
  const broken=p.type==='crumble'&&s.crumbles[i]>.65;ctx.globalAlpha=broken?.15:1;
  const color={moving:'#efb655',crumble:'#bdacd9',spring:'#7fbc93',ice:'#9cd9ed',checkpoint:'#68aa93',goal:'#e1b04e',normal:'#7fba9c'}[p.type];
  round(p.x,p.y+4,p.w,27,9,'#446b6e2c');round(p.x,p.y,p.w,23,8,color);round(p.x+3,p.y,p.w-6,5,3,'#ffffff8c');
  ctx.fillStyle='#ffffff66';for(let d=12;d<p.w-6;d+=24){ctx.beginPath();ctx.arc(p.x+d,p.y+13,2,0,7);ctx.fill();}
  ctx.font='bold 16px system-ui';ctx.textAlign='center';ctx.fillStyle='#fff';
  if(p.type==='moving')ctx.fillText('↔',p.x+p.w/2,p.y+18);
  if(p.type==='spring'){ctx.fillText('↑ ↑ ↑',p.x+p.w/2,p.y+18);round(p.x+30,p.y-7,p.w-60,8,3,'#e4f6ab');}
  if(p.type==='ice')ctx.fillText('❄',p.x+p.w/2,p.y+19);
  if(p.type==='crumble'){ctx.strokeStyle='#fff8';ctx.beginPath();ctx.moveTo(p.x+40,p.y);ctx.lineTo(p.x+52,p.y+10);ctx.lineTo(p.x+45,p.y+23);ctx.stroke();}
  ctx.globalAlpha=1;
  if(p.type==='checkpoint'||p.type==='goal'){
   round(p.x+32,p.y-66,4,66,2,'#56847a');ctx.fillStyle=p.type==='goal'?'#edbe50':p.stage<=s.checkpoint?'#3b8c70':'#fff';ctx.beginPath();ctx.moveTo(p.x+36,p.y-65);ctx.lineTo(p.x+75,p.y-51);ctx.lineTo(p.x+36,p.y-37);ctx.fill();
   ctx.font='bold 13px system-ui';ctx.fillStyle='#3e6e6c';ctx.fillText(p.type==='goal'?'GOAL':`STAGE ${String(p.stage+1).padStart(2,'0')}`,p.x+134,p.y-24);
   if(p.type==='goal'){star(p.x+155,p.y-95,28,'#eab446');}
  }
 }
 for(const c of course.stars){if(s.stars.includes(c.id)||c.x<camera-50||c.x>camera+view+50)continue;const y=c.y+Math.sin(s.tick*3+c.id)*4;ctx.beginPath();ctx.fillStyle='#fff4';ctx.arc(c.x,y,21,0,7);ctx.fill();star(c.x,y,12,'#eeb84e');}
 // A tiny explorer with a scarf, boots and a squash on landing.
 const bob=s.grounded?Math.sin(s.tick*15)*Math.min(2,Math.abs(s.vx)/100):0,x=s.x,y=s.y+bob;
 ctx.fillStyle='#42656c22';ctx.beginPath();ctx.ellipse(x+14,y+39,19,4,0,0,7);ctx.fill();
 round(x+2,y+14,24,20,7,'#e69d65');round(x+3,y+31,9,6,3,'#36525d');round(x+17,y+31,9,6,3,'#36525d');round(x,y,28,24,9,'#fffaf0');round(x+1,y+19,26,6,2,'#599c90');
 const face=s.vx<0?-2:2;round(x+8+face,y+10,3,4,1,'#35576a');round(x+18+face,y+10,3,4,1,'#35576a');round(x+(s.vx<0?22:-10),y+20,16,5,2,'#599c90');
 ctx.restore();
}
function hud(){$('stage').textContent=`${String(s.checkpoint+1).padStart(2,'0')} / 10`;$('name').textContent=NAMES[s.checkpoint];$('stars').textContent=s.stars.length;$('time').textContent=formatTime(s.time);$('deaths').textContent=s.deaths;$('progress').style.width=`${s.finished?100:Math.min(100,s.x/(LENGTH*10)*100)}%`;}
function frame(t){const dt=Math.min((t-last)/1000||0,.05);last=t;if(mode==='play'){accumulator+=dt;while(accumulator>=1/120){step(s,{left:keys.has('ArrowLeft')||keys.has('KeyA')||touch.has('left'),right:keys.has('ArrowRight')||keys.has('KeyD')||touch.has('right'),jump:queued},1/120,course);queued=false;accumulator-=1/120;for(const e of s.events){tone({jump:420,spring:700,star:880,checkpoint:660,death:180,finish:1000}[e]);if(e==='checkpoint'){toast(`⚑ STAGE ${s.checkpoint+1} · 체크포인트 저장!`);save();}if(e==='death'){toast('괜찮아요! 마지막 깃발에서 다시 도전');save();}if(e==='finish')finish();}if(mode!=='play'){accumulator=0;break;}}}else accumulator=0;
 const target=Math.max(0,Math.min(LENGTH*10+330-width/scale,s.x-width/scale*.3));camera+=(target-camera)*Math.min(1,dt*8);hud();draw();requestAnimationFrame(frame);}
window.render_game_to_text=()=>JSON.stringify({mode,player:{x:s.x,y:s.y,vx:s.vx,vy:s.vy,grounded:s.grounded},checkpoint:s.checkpoint,stars:s.stars.length,deaths:s.deaths,finished:s.finished});
requestAnimationFrame(frame);
