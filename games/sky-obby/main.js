import './style.css';
import {STAGES,CHECKPOINTS,GOAL,restore,serialize,step,restartRun,resetRecords,respawn,formatTime} from './core.mjs';
import {createWorld} from './world.mjs';
const $=id=>document.getElementById(id);
const KEY='sky-obby-v1';
let s;try{s=restore(localStorage.getItem(KEY));}catch{s=restore(null);}
const canvas=$('game');
let world;
try{world=createWorld(canvas);}catch(error){$('resume-note').textContent='3D 화면을 열 수 없어요. 브라우저의 하드웨어 가속을 켜고 다시 열어 주세요.';throw error;}
world.snapCamera(s);

let playing=false,audio,saveTimer=0,toastTimer;
function save(){try{localStorage.setItem(KEY,JSON.stringify(serialize(s)));}catch{}}
function tone(freq,dur=.12,type='square',slide=1,vol=.06){
 if(!s.sound)return;
 try{audio??=new AudioContext();if(audio.state==='suspended')audio.resume();const t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();
  o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(freq*slide,t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);
  o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+dur+.02);}catch{}
}
const sfx={
 jump:()=>tone(420,.12,'square',1.8,.04),
 pad:()=>tone(260,.35,'triangle',4,.08),
 death:()=>tone(300,.4,'sawtooth',.25,.06),
 checkpoint:()=>[523,659,784].forEach((f,i)=>setTimeout(()=>tone(f,.16,'triangle',1,.08),i*90)),
 finish:()=>[523,659,784,1047,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,.22,'triangle',1,.09),i*120)),
};
function toast(text,ms=1600){const t=$('toast');t.textContent=text;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),ms);}
function flash(kind){const f=$('flash');f.className=`flash ${kind}`;requestAnimationFrame(()=>requestAnimationFrame(()=>{f.className='flash';}));}

$('stage-total').textContent=`/ ${STAGES.length}`;
function hud(){
 const cp=s.checkpoint;
 $('stage-num').textContent=s.finished?'CLEAR':cp+1;
 $('stage-name').textContent=s.finished?'트로피 도착!':STAGES[cp];
 $('progress').style.width=`${s.finished?100:cp/STAGES.length*100}%`;
 $('timer').textContent=formatTime(s.time);$('deaths').textContent=s.deaths;$('best').textContent=formatTime(s.best);
 $('sound').textContent=s.sound?'🔊':'🔇';$('sound').setAttribute('aria-pressed',String(s.sound));$('sound').setAttribute('aria-label',s.sound?'소리 끄기':'소리 켜기');
}
hud();
if(s.finished)$('resume-note').textContent='이미 트로피에 도착했어요. 시작하면 새로 도전해요.';
else if(s.checkpoint>0)$('resume-note').textContent=`저장된 STAGE ${s.checkpoint+1}부터 이어서 해요 · ${formatTime(s.time)}`;

// 입력
const keys=new Set();let jumpQueued=false;const stick={x:0,y:0};
const codes={KeyW:'f',ArrowUp:'f',KeyS:'b',ArrowDown:'b',KeyA:'l',ArrowLeft:'l',KeyD:'r',ArrowRight:'r'};
addEventListener('keydown',e=>{
 if(document.querySelector('dialog[open]'))return;
 if(codes[e.code]){keys.add(codes[e.code]);e.preventDefault();}
 if(e.code==='Space'){e.preventDefault();if(!e.repeat)jumpQueued=true;if(!playing&&!$('start').hidden)start();}
 if(e.code==='Enter'&&!playing&&!$('start').hidden)start();
});
addEventListener('keyup',e=>{if(codes[e.code])keys.delete(codes[e.code]);});
addEventListener('blur',()=>keys.clear());
function inputVector(){
 let f=(keys.has('f')?1:0)-(keys.has('b')?1:0)-stick.y,r=(keys.has('r')?1:0)-(keys.has('l')?1:0)+stick.x;
 const yaw=world.cam.yaw;
 return {x:Math.sin(yaw)*f+Math.cos(yaw)*r,z:Math.cos(yaw)*f-Math.sin(yaw)*r};
}
// 시점 드래그
let look=null;
canvas.addEventListener('pointerdown',e=>{look={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);canvas.focus();});
canvas.addEventListener('pointermove',e=>{
 if(!look||look.id!==e.pointerId)return;
 world.cam.yaw+=(e.clientX-look.x)*.006;world.cam.pitch=Math.max(-.15,Math.min(1.25,world.cam.pitch+(e.clientY-look.y)*.005));
 look.x=e.clientX;look.y=e.clientY;
});
const endLook=e=>{if(look?.id===e.pointerId)look=null;};
canvas.addEventListener('pointerup',endLook);canvas.addEventListener('pointercancel',endLook);
canvas.addEventListener('wheel',e=>{e.preventDefault();world.cam.dist=Math.max(4.5,Math.min(18,world.cam.dist*(1+Math.sign(e.deltaY)*.1)));},{passive:false});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
// 모바일 조이스틱과 점프 버튼
const stickEl=$('stick'),knob=stickEl.firstElementChild;let stickId=null;
function moveStick(e){const r=stickEl.getBoundingClientRect(),R=r.width/2;let dx=e.clientX-r.left-R,dy=e.clientY-r.top-R;const m=Math.hypot(dx,dy);if(m>R){dx*=R/m;dy*=R/m;}stick.x=dx/R;stick.y=dy/R;knob.style.transform=`translate(${dx}px,${dy}px)`;}
stickEl.addEventListener('pointerdown',e=>{stickId=e.pointerId;stickEl.setPointerCapture(e.pointerId);moveStick(e);e.preventDefault();});
stickEl.addEventListener('pointermove',e=>{if(e.pointerId===stickId)moveStick(e);});
const endStick=e=>{if(e.pointerId!==stickId)return;stickId=null;stick.x=stick.y=0;knob.style.transform='';};
stickEl.addEventListener('pointerup',endStick);stickEl.addEventListener('pointercancel',endStick);
$('jump').addEventListener('pointerdown',e=>{e.preventDefault();jumpQueued=true;});

// 흐름
function start(){
 if(s.finished){restartRun(s);world.snapCamera(s);}
 $('start').hidden=true;playing=true;canvas.focus();hud();save();
 toast(`STAGE ${s.checkpoint+1} · ${STAGES[s.checkpoint]}`);
}
$('play').addEventListener('click',start);
$('sound').addEventListener('click',()=>{s.sound=!s.sound;hud();save();if(s.sound)tone(660,.1,'triangle');});
$('restart').addEventListener('click',()=>{playing=false;keys.clear();$('reset-dialog').showModal();});
$('cancel-reset').addEventListener('click',()=>$('reset-dialog').close());
$('reset-dialog').addEventListener('close',()=>{if($('start').hidden&&!s.finished)playing=true;canvas.focus();});
$('confirm-reset').addEventListener('click',()=>{restartRun(s);world.snapCamera(s);save();hud();$('reset-dialog').close();toast('STAGE 1 · 첫 점프');});
$('reset-records').addEventListener('click',()=>{playing=false;keys.clear();$('records-best').textContent=formatTime(s.best);$('records-dialog').showModal();});
$('cancel-records').addEventListener('click',()=>$('records-dialog').close());
$('records-dialog').addEventListener('close',()=>{if($('start').hidden&&!s.finished)playing=true;canvas.focus();});
$('confirm-records').addEventListener('click',()=>{resetRecords(s);world.snapCamera(s);save();hud();$('resume-note').textContent='';$('records-dialog').close();toast('기록을 모두 지웠어요 · STAGE 1');});
$('again').addEventListener('click',()=>{$('finish').close();restartRun(s);world.snapCamera(s);save();hud();playing=true;canvas.focus();toast('다시 도전! STAGE 1');});
$('stay').addEventListener('click',()=>$('finish').close());
$('finish').addEventListener('cancel',e=>e.preventDefault());
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();save();}});

function handle(ev){
 for(const e of ev){
  if(e==='jump')sfx.jump();
  else if(e==='pad')sfx.pad();
  else if(e==='death'){sfx.death();flash('death');toast(`앗! STAGE ${s.checkpoint+1}부터 다시`,1100);world.snapCamera(s);}
  else if(e==='checkpoint'){sfx.checkpoint();flash('good');const c=CHECKPOINTS[s.checkpoint];world.burst(c.x,c.y+1,c.z,30);toast(`✓ 체크포인트! STAGE ${s.checkpoint+1} · ${STAGES[s.checkpoint]}`,2000);save();}
  else if(e==='finish')finish();
 }
}
function finish(){
 const newBest=s.best!=null&&Math.abs(s.best-s.time)<1e-9;
 sfx.finish();flash('good');world.burst(GOAL.x,GOAL.y+3,GOAL.z,120);save();hud();
 $('final-time').textContent=formatTime(s.time);$('final-deaths').textContent=s.deaths;$('final-best').textContent=formatTime(s.best);
 $('new-best').textContent=newBest?'🎉 최고 기록 달성!':'';
 setTimeout(()=>$('finish').showModal(),900);
}

world.engine.runRenderLoop(()=>{
 const dt=Math.min(world.engine.getDeltaTime()/1000,.05);
 if(playing&&!document.hidden&&!s.finished){
  const ev=step(s,{...inputVector(),jump:jumpQueued},dt);jumpQueued=false;
  if(ev.length)handle(ev);
  saveTimer+=dt;if(saveTimer>3){saveTimer=0;save();}
  $('timer').textContent=formatTime(s.time);if(ev.includes('death')||ev.includes('checkpoint'))hud();
 } else jumpQueued=false;
 world.sync(s,dt);
});
addEventListener('pagehide',save);

window.render_game_to_text=()=>JSON.stringify({playing,...serialize(s),stage:s.checkpoint+1,stageName:STAGES[s.checkpoint],
 player:{x:s.x,y:s.y,z:s.z,vy:s.vy,grounded:s.grounded,groundId:s.groundId},world:world.diagnostics()});
// 브라우저 검사용: 특정 체크포인트로 이동
window.sky_obby_debug={warp(cp){s.checkpoint=cp;respawn(s);world.snapCamera(s);hud();}};
