import {TRACKS,LENGTH,SIZE,createRun,press,restart,update} from './core.mjs';
const $=id=>document.getElementById(id),canvas=$('world'),ctx=canvas.getContext('2d');
let g=createRun(),held=false,W=1280,H=720,last=0,acc=0,particles=[],sound=false,audio,beat=-1,best=[0,0,0],toastUntil=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
try{const saved=JSON.parse(localStorage.getItem('dash-overdrive-hard-v2')||'[]');if(Array.isArray(saved))best=TRACKS.map((_,i)=>Math.min(100,Math.max(0,Number(saved[i])||0)));}catch{}
function resize(){const d=Math.min(devicePixelRatio||1,2);canvas.width=innerWidth*d;canvas.height=innerHeight*d;W=Math.max(800,innerWidth/innerHeight*720);H=W*innerHeight/innerWidth;ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);}
addEventListener('resize',resize);resize();
const ground=()=>H*.76;
function sync(){
 const t=TRACKS[g.level],pct=Math.min(100,Math.floor(g.x/LENGTH*100));
 document.documentElement.style.setProperty('--acid',t.color);
 $('menu').hidden=g.state!=='ready';$('hud').hidden=g.state==='ready';$('pause').disabled=!['playing','paused'].includes(g.state);
 $('track-name').textContent=t.name+' / '+t.difficulty;$('form').textContent=g.form==='ship'?'SHIP / HOLD TO FLY':'CUBE / TAP TO JUMP';$('percent').textContent=pct+'%';$('progress').style.width=pct+'%';$('gems').textContent='◆ '+g.gems;
 $('footer-left').textContent=`0${g.level+1} — ${t.name} / ${t.bpm} BPM / ${t.difficulty}`;
 $('footer-right').textContent=g.state==='ready'?'JUMP INTO THE UNKNOWN.':`ATTEMPT ${String(g.attempt).padStart(2,'0')} · ${g.practice?'PRACTICE':'NORMAL'} · R 재도전 / P 일시정지`;
 document.querySelectorAll('[data-track]').forEach(el=>{const i=Number(el.dataset.track);el.classList.toggle('selected',i===g.level);el.setAttribute('aria-pressed',String(i===g.level));el.querySelector('em b').textContent=`BEST ${best[i]}%`;});
 $('result').hidden=!['dead','won','paused'].includes(g.state);
 if(!$('result').hidden){const won=g.state==='won',paused=g.state==='paused';$('result-tag').textContent=paused?'TAKE A BREATH':won?'YOU OWN THE SKY':'CRASH. LEARN. REPEAT.';$('result-title').textContent=paused?'잠깐 쉬어가기':won?'STAGE CLEAR!':`${pct}% — 한 번 더!`;$('result-message').textContent=paused?'준비되면 다시 날아올라.':won?`◆ ${g.gems}개 수집 · ${g.attempt}번의 도전\n${g.practice?'연습 완주! 일반 모드에도 도전해 봐.':'멋진 비행이었어. 다음 하늘로 가 볼까?'}`:`${g.form==='ship'?'비행 중에는 누르면 상승, 떼면 하강해.':'가시 앞에서 조금 일찍 점프해 봐.'}\n${g.practice&&g.checkpoint?'체크포인트에서 다시 시작해.':`최고 기록 ${best[g.level]}% · 시도 ${g.attempt}회`}`;$('retry').innerHTML=`${paused?'계속하기':won?'다음 코스':'다시 달리기'} <span>↗</span>`;}
}
function audioInit(){try{if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});}catch{}}
function note(freq,duration=.12,type='triangle',volume=.035){if(!sound||audio?.state!=='running')return;const o=audio.createOscillator(),v=audio.createGain(),t=audio.currentTime;o.type=type;o.frequency.setValueAtTime(freq,t);v.gain.setValueAtTime(volume,t);v.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(v);v.connect(audio.destination);o.start(t);o.stop(t+duration);}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;toastUntil=performance.now()+2700;}
function start(){audioInit();g.practice=$('practice').checked;g.state='playing';canvas.focus();held=false;acc=0;beat=-1;sync();toast('가시 앞에서 SPACE / 클릭 / 터치로 점프!');}
function select(i){g=createRun(i,$('practice').checked);held=false;particles=[];sync();}
function pause(){held=false;if(g.state==='playing')g.state='paused';else if(g.state==='paused'){g.state='playing';canvas.focus();}sync();}
$('play').onclick=start;
$('retry').onclick=()=>{audioInit();held=false;if(g.state==='paused'){g.state='playing';}else if(g.state==='won'){select((g.level+1)%TRACKS.length);start();return;}else restart(g);canvas.focus();beat=-1;sync();};
$('back').onclick=()=>{select(g.level);$('toast').hidden=true;};$('pause').onclick=pause;
$('sound').onclick=()=>{sound=!sound;audioInit();$('sound').textContent=sound?'♫ ON':'♫ OFF';$('sound').setAttribute('aria-pressed',String(sound));$('sound').setAttribute('aria-label',sound?'소리 끄기':'소리 켜기');note(660);};
$('full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('이 브라우저에서는 전체 화면을 지원하지 않아.');}};
for(const el of document.querySelectorAll('[data-track]'))el.onclick=()=>select(Number(el.dataset.track));
function down(){if(g.state!=='playing')return;held=true;press(g);note(660,.07);}
canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.focus();canvas.setPointerCapture(e.pointerId);down();});
addEventListener('pointerup',()=>held=false);addEventListener('pointercancel',()=>held=false);
addEventListener('keydown',e=>{if(['Space','ArrowUp','KeyW'].includes(e.code)){if(['INPUT','BUTTON','A'].includes(document.activeElement?.tagName)&&e.code==='Space')return;e.preventDefault();if(e.repeat)return;if(g.state==='ready')start();else if(['dead','won'].includes(g.state))$('retry').click();else down();}if(['KeyP','Escape'].includes(e.code)&&!e.repeat)pause();if(e.code==='KeyR'&&!e.repeat&&g.state!=='ready'){held=false;restart(g);canvas.focus();sync();}});
addEventListener('keyup',e=>{if(['Space','ArrowUp','KeyW'].includes(e.code))held=false;});
addEventListener('blur',()=>{if(g.state==='playing')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&g.state==='playing')pause();});
function polygon(points,fill,stroke,width=2){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
function draw(now){
 const track=TRACKS[g.level],floor=ground(),px=W*.19,off=g.x-px,preview=g.state==='ready',shift=preview?(reduced?0:now*.025):g.x;
 const gradient=ctx.createLinearGradient(0,0,0,H);gradient.addColorStop(0,track.sky);gradient.addColorStop(1,g.level===1?'#f2a286':g.level===2?'#be85ee':'#83c7ff');ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);
 // A huge graphic sun, tiny orbital marks, and layered cloud islands.
 const sunX=W*.79,sunY=H*.29;ctx.fillStyle=g.level===1?'#ffda93':'#d8f3ff';ctx.beginPath();ctx.arc(sunX,sunY,Math.min(W*.1,125),0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#ffffff35';ctx.lineWidth=1;ctx.beginPath();ctx.arc(sunX,sunY,Math.min(W*.1,125)+20,0,Math.PI*2);ctx.stroke();
 for(let i=0;i<16;i++){const x=((i*197-shift*.07)%(W+180)+W+180)%(W+180)-90,y=H*.12+(i*67)%(H*.45);rect(x,y,3,3,'#ffffff60');if(i%4===0){rect(x-5,y+1,13,1,'#ffffff70');rect(x+1,y-5,1,13,'#ffffff70');}}
 for(let layer=0;layer<3;layer++){
  const color=layer===0?'#c9e1ff25':layer===1?'#213fb52e':'#183a9b4a',spacing=180+layer*70;
  for(let i=-1;i<W/spacing+2;i++){
   const x=i*spacing-(shift*(.08+layer*.07)%spacing),y=floor-40-layer*32-((i+10)*53%130);
   polygon([[x,y],[x+70,y-110-layer*20],[x+140,y],[x+170,floor+20],[x-30,floor+20]],color);
   rect(x+64,y-90,3,45,'#ffffff20');
  }
 }
 for(let i=0;i<6;i++){const x=((i*367-shift*.18)%(W+400)+W+400)%(W+400)-180,y=H*.3+(i%3)*65;polygon([[x,y],[x+110,y],[x+76,y+44],[x+28,y+32]],'#315bc0');rect(x-4,y-8,120,9,'#b2dcff');rect(x+20,y-42,18,34,'#4d7cda');rect(x+42,y-70,28,62,'#6b9be9');rect(x+48,y-60,5,6,'#d6f4ff');rect(x+77,y-32,15,24,'#83aaf0');}
 // Track: bright top, extruded tiles, and a checker strip.
 rect(0,floor,W,H-floor,g.level===1?'#4c284f':'#16378e');rect(0,floor,W,7,track.color);rect(0,floor+7,W,12,'#ffffff60');
 for(let x=-(shift%90);x<W;x+=90){polygon([[x,floor+20],[x+70,floor+20],[x+42,H],[x-28,H]],'#ffffff08');rect(x,floor+27,36,4,'#ffffff15');}
 rect(0,H-40,W,1,'#ffffff20');
 if(preview){
  // The menu illustration is an actual cube, portal, and ship suspended over an island.
  const x=W*.79,y=H*.54+(reduced?0:Math.sin(now*.0017)*14);
  polygon([[x-110,y+98],[x+110,y+98],[x+66,y+155],[x-50,y+140]],'#14398e');rect(x-118,y+87,236,13,track.color);rect(x-108,y+100,216,9,'#f2ffd0');
  ctx.save();ctx.translate(x,y);ctx.rotate(-.18);rect(-42,-42,84,84,'#102b79');rect(-36,-36,72,72,track.color);rect(-25,-23,18,18,'#163078');rect(9,-23,18,18,'#163078');rect(-24,11,48,12,'#163078');ctx.restore();
  for(let i=0;i<3;i++){const bx=x+120+i*25;polygon([[bx,y+60],[bx+18,y+30],[bx+36,y+60]],'#ff8f7e','#ffe1be');}
  ctx.save();ctx.translate(x+150,y-130);ctx.rotate(-.3);polygon([[-30,10],[32,0],[-30,-12],[-18,0]],track.color,'#ffffff');polygon([[-35,-6],[-65,0],[-35,6]],'#ffb26a');ctx.restore();
  ctx.font='bold 10px Arial';ctx.fillStyle='#ffffffa0';ctx.textAlign='center';ctx.fillText('BREAK THE LIMIT.',x,y+191);ctx.textAlign='left';
 }else{
  for(let i=0;i<g.objects.length;i++){
   const o=g.objects[i],x=o.x-off;if(x<-130||x>W+130)continue;
   if(o.type==='spike'){polygon([[x,floor],[x+o.w/2,floor-o.h],[x+o.w,floor]],'#ff8d7d','#ffe7ca',2);polygon([[x+9,floor-4],[x+o.w/2,floor-o.h+15],[x+o.w-9,floor-4]],'#bd455a');}
   else if(o.type==='block'||o.type==='wall'){rect(x,floor-o.h,o.w,o.h,'#123784');rect(x,floor-o.h,o.w,5,track.color);ctx.strokeStyle='#a9e9ff';ctx.lineWidth=2;ctx.strokeRect(x,floor-o.h,o.w,o.h);for(let yy=floor-o.h+16;yy<floor-6;yy+=22)rect(x+10,yy,o.w-20,3,'#78a8e770');}
   else if(o.type==='roof'){rect(x,floor-470,o.w,o.h,'#123784');ctx.strokeStyle='#a9e9ff';ctx.lineWidth=2;ctx.strokeRect(x,floor-470,o.w,o.h);rect(x,floor-o.bottom-5,o.w,5,'#ffb291');}
   else if(o.type==='pad'){rect(x,floor-8,o.w,8,'#ffe15c');polygon([[x+8,floor-14],[x+24,floor-26],[x+40,floor-14]],null,'#fff1b1',3);}
   else if(o.type==='gem'&&!g.collected.has(i)){const y=floor-o.h;polygon([[x+10,y-12],[x+20,y],[x+10,y+12],[x,y]],'#fff4a2','#ffffff',1.5);}
   else if(o.type==='portal'){
    const cy=floor-130;ctx.save();ctx.translate(x+20,cy);ctx.scale(.43,1);ctx.strokeStyle=o.form==='ship'?'#ffadf1':track.color;ctx.lineWidth=10;ctx.beginPath();ctx.ellipse(0,0,65,145,0,0,Math.PI*2);ctx.stroke();ctx.lineWidth=2;ctx.strokeStyle='#fff';ctx.beginPath();ctx.ellipse(0,0,49,131,0,0,Math.PI*2);ctx.stroke();ctx.restore();ctx.fillStyle='white';ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.fillText(o.form==='ship'?'FLY ↑':'CUBE ◇',x+20,cy-165);ctx.textAlign='left';
   }
  }
  const finish=LENGTH-off;if(finish<W+100){rect(finish,floor-350,8,350,track.color);for(let i=0;i<8;i++)for(let j=0;j<3;j++)rect(finish+8+j*16,floor-350+i*16,16,16,(i+j)%2?'#133783':'white');}
  if(g.state!=='dead'){
   for(let i=6;i>0;i--){ctx.globalAlpha=(7-i)*.04;rect(px-i*12,floor-g.y-25,24,24,track.color);}ctx.globalAlpha=1;
   ctx.save();ctx.translate(px+16,floor-g.y-16);ctx.rotate(g.form==='ship'?g.rotation:-g.rotation);
   if(g.form==='cube'){rect(-18,-18,36,36,'#173478');rect(-15,-15,30,30,track.color);rect(-10,-10,7,8,'#163478');rect(3,-10,7,8,'#163478');rect(-10,4,20,6,'#163478');}
   else{polygon([[-23,13],[27,0],[-23,-13],[-14,0]],track.color,'#fff',2);rect(-10,-4,10,8,'#2343a3');if(held)polygon([[-25,-8],[-45-Math.sin(now*.1)*9,0],[-25,8]],'#ffb369');}ctx.restore();
  }
 }
 for(const p of particles){ctx.globalAlpha=Math.max(0,p.life);rect(p.x,p.y,6,6,p.color);}ctx.globalAlpha=1;
}
function frame(now){const dt=last?Math.min(.05,(now-last)/1000):0;last=now;acc+=dt;
 while(acc>=1/120){const before=g.state,form=g.form,pads=g.padCount;update(g,1/120,held);if(g.form!==form){toast(g.form==='ship'?'비행 모드! 꾹 누르면 상승 · 떼면 하강':'큐브 모드! 점프로 가시를 넘어!');note(880,.3,'sine');}if(g.padCount!==pads){toast('JUMP BOOST ↗');note(1000,.16);}
 if(before==='playing'&&['dead','won'].includes(g.state)){held=false;if(!g.practice){best[g.level]=Math.max(best[g.level],Math.min(100,Math.floor(g.x/LENGTH*100)));try{localStorage.setItem('dash-overdrive-hard-v2',JSON.stringify(best));}catch{}}if(g.state==='dead'){note(80,.3,'sawtooth',.06);if(!reduced)for(let i=0;i<30;i++)particles.push({x:W*.19+16,y:ground()-g.y-16,vx:(Math.random()-.5)*500,vy:(Math.random()-.6)*500,life:1,color:TRACKS[g.level].color});}else{note(523,.3);setTimeout(()=>note(784,.4),150);}sync();}acc-=1/120;}
 if(g.state==='playing'){const b=Math.floor(g.time/(60/TRACKS[g.level].bpm));if(b!==beat){beat=b;note(b%4===0?65:130,.12,'sine',.09);note([261,330,392,523,440,392,330,293][b%8],.22,'triangle',.025);}sync();}
 if(now>toastUntil)$('toast').hidden=true;
 for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=700*dt;p.life-=dt*1.5;}particles=particles.filter(p=>p.life>0);draw(now);requestAnimationFrame(frame);
}
window.render_game_to_text=()=>JSON.stringify({state:g.state,level:g.level,x:g.x,y:g.y,vy:g.vy,form:g.form,progress:Math.min(100,Math.floor(g.x/LENGTH*100)),gems:g.gems,attempt:g.attempt,practice:g.practice,checkpoint:g.checkpoint,best,coordinates:'x forward; y height above floor'});
sync();requestAnimationFrame(frame);
