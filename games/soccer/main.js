import './style.css';
import {create,step,teamName,possession,formatClock,restoreRecords,newRecords,applyResult,result,HALF_L,HALF_W,GOAL_W} from './core.mjs';
import {createWorld} from './world.mjs';
const $=id=>document.getElementById(id);
const KEY='inhyuk-soccer-v1';
let rec;try{rec=restoreRecords(localStorage.getItem(KEY));}catch{rec=newRecords();}
function save(){try{localStorage.setItem(KEY,JSON.stringify(rec));}catch{}}
const canvas=$('game');
let world;
try{world=createWorld(canvas);}catch(error){$('record-line').textContent='3D 화면을 열 수 없어요. 브라우저의 하드웨어 가속을 켜고 다시 열어 주세요.';throw error;}

// 시작 화면 뒤에서는 AI끼리 경기한다
let s=create({difficulty:rec.difficulty,seed:Date.now()%100000});
let mode='demo',paused=false,toastTimer,bannerTimer;
world.snapCamera(s);

// 소리
let audio,noise;
function ctx(){if(!rec.sound)return null;try{audio??=new AudioContext();if(audio.state==='suspended')audio.resume();return audio;}catch{return null;}}
function tone(freq,dur=.12,type='square',slide=1,vol=.06,delay=0){
 const a=ctx();if(!a)return;const t=a.currentTime+delay,o=a.createOscillator(),g=a.createGain();
 o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(freq*slide,t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);
 o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+dur+.02);
}
function hiss(dur,vol,freq=900,q=.7){
 const a=ctx();if(!a)return;
 if(!noise){noise=a.createBuffer(1,a.sampleRate*2,a.sampleRate);const d=noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
 const src=a.createBufferSource(),f=a.createBiquadFilter(),g=a.createGain(),t=a.currentTime;
 src.buffer=noise;src.loop=true;f.type='bandpass';f.frequency.value=freq;f.Q.value=q;
 g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(vol,t+.15);g.gain.exponentialRampToValueAtTime(.001,t+dur);
 src.connect(f);f.connect(g);g.connect(a.destination);src.start(t);src.stop(t+dur+.05);
}
const sfx={
 kick:(v=1)=>{tone(150,.1,'sine',.4,.16*v);hiss(.06,.05*v,2500,1);},
 whistle:(n=1)=>{for(let i=0;i<n;i++){tone(2300,.22,'square',1.02,.035,i*.3);tone(2450,.22,'square',.98,.02,i*.3);}},
 goal:()=>{hiss(2.6,.22,700,.5);[523,659,784,1047].forEach((f,i)=>tone(f,.25,'triangle',1,.08,i*.12));},
 groan:()=>{hiss(1.3,.12,400,.6);tone(300,.6,'sawtooth',.5,.04);},
 post:()=>tone(900,.4,'triangle',.98,.09),
 tackle:()=>{tone(110,.12,'sawtooth',.6,.07);hiss(.1,.06,1200,1);},
 save:()=>{hiss(.8,.1,600,.6);tone(200,.12,'sine',.5,.12);},
 click:()=>tone(660,.08,'triangle',1,.05),
};

function toast(text,ms=1500){const t=$('toast');t.textContent=text;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),ms);}
function banner(big,small,kind='',ms=2600){const b=$('banner');$('banner-big').textContent=big;$('banner-small').textContent=small;b.className=`show ${kind}`;clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>b.className='',ms);}
function flash(kind){const f=$('flash');f.className=`flash ${kind}`;requestAnimationFrame(()=>requestAnimationFrame(()=>{f.className='flash';}));}

function hud(){
 $('away-name').textContent=teamName(s,1);
 $('score-home').textContent=s.score[0];$('score-away').textContent=s.score[1];
 $('clock').textContent=formatClock(s.time);
 $('phase').textContent=s.phase==='play'?'':s.message;
 $('player-num').textContent=s.players[s.human].num;
 $('stamina').style.width=`${Math.round(s.stamina*100)}%`;$('stamina').classList.toggle('tired',s.tired);
 $('sound').textContent=rec.sound?'🔊':'🔇';$('sound').setAttribute('aria-pressed',String(rec.sound));$('sound').setAttribute('aria-label',rec.sound?'소리 끄기':'소리 켜기');
}
function recordLine(){
 $('record-line').textContent=rec.played?`전적 ${rec.wins}승 ${rec.draws}무 ${rec.losses}패 · 득점 ${rec.goalsFor} · 실점 ${rec.goalsAgainst}${rec.bestWin?` · 최다 점수 차 승리 ${rec.bestWin}골`:''}`:'첫 경기를 시작해 보세요!';
}
document.querySelector(`input[name=diff][value=${rec.difficulty}]`).checked=true;
recordLine();hud();

// 입력
const keys=new Set();let passQueued=false,shootHeld=false,sprintHeld=false;const stick={x:0,y:0};
const codes={KeyW:'u',ArrowUp:'u',KeyS:'d',ArrowDown:'d',KeyA:'l',ArrowLeft:'l',KeyD:'r',ArrowRight:'r'};
addEventListener('keydown',e=>{
 if(document.querySelector('dialog[open]'))return;
 if(codes[e.code]){keys.add(codes[e.code]);e.preventDefault();}
 if(e.code==='ShiftLeft'||e.code==='ShiftRight')sprintHeld=true;
 if(e.code==='Space'){e.preventDefault();if(mode==='play')shootHeld=true;else if(!$('start').hidden&&!e.repeat)startMatch();}
 if((e.code==='KeyE'||e.code==='KeyK')&&!e.repeat)passQueued=true;
 if(e.code==='KeyJ')shootHeld=true;
 if(e.code==='Enter'&&mode!=='play'&&!$('start').hidden)startMatch();
 if((e.code==='Escape'||e.code==='KeyP')&&mode==='play'&&!s.over)openPause();
});
addEventListener('keyup',e=>{
 if(codes[e.code])keys.delete(codes[e.code]);
 if(e.code==='ShiftLeft'||e.code==='ShiftRight')sprintHeld=false;
 if(e.code==='Space'||e.code==='KeyJ')shootHeld=false;
});
addEventListener('blur',()=>{keys.clear();shootHeld=sprintHeld=false;});
// 화면: 오른쪽이 +x(상대 골대), 위쪽이 +z(먼 쪽 터치라인)
function inputVector(){
 const x=(keys.has('r')?1:0)-(keys.has('l')?1:0)+stick.x,z=(keys.has('u')?1:0)-(keys.has('d')?1:0)-stick.y;
 const m=Math.hypot(x,z);return m>1?{x:x/m,z:z/m}:{x,z};
}
canvas.addEventListener('wheel',e=>{e.preventDefault();world.cam.zoom=Math.max(.65,Math.min(1.45,world.cam.zoom*(1+Math.sign(e.deltaY)*.08)));},{passive:false});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',()=>canvas.focus());
// 모바일 조이스틱과 버튼
const stickEl=$('stick'),knob=stickEl.firstElementChild;let stickId=null;
function moveStick(e){const r=stickEl.getBoundingClientRect(),R=r.width/2;let dx=e.clientX-r.left-R,dy=e.clientY-r.top-R;const m=Math.hypot(dx,dy);if(m>R){dx*=R/m;dy*=R/m;}stick.x=dx/R;stick.y=dy/R;knob.style.transform=`translate(${dx}px,${dy}px)`;}
stickEl.addEventListener('pointerdown',e=>{stickId=e.pointerId;stickEl.setPointerCapture(e.pointerId);moveStick(e);e.preventDefault();});
stickEl.addEventListener('pointermove',e=>{if(e.pointerId===stickId)moveStick(e);});
const endStick=e=>{if(e.pointerId!==stickId)return;stickId=null;stick.x=stick.y=0;knob.style.transform='';};
stickEl.addEventListener('pointerup',endStick);stickEl.addEventListener('pointercancel',endStick);
function holdButton(el,on,off){el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);el.classList.add('down');on();});const up=()=>{el.classList.remove('down');off();};el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('contextmenu',e=>e.preventDefault());}
holdButton($('btn-shoot'),()=>shootHeld=true,()=>shootHeld=false);
holdButton($('btn-sprint'),()=>sprintHeld=true,()=>sprintHeld=false);
holdButton($('btn-pass'),()=>passQueued=true,()=>{});

// 흐름
function startMatch(){
 const diff=document.querySelector('input[name=diff]:checked')?.value||'normal';
 rec.difficulty=diff;save();
 s=create({difficulty:diff,seed:(Date.now()%1000003)+1});
 mode='play';paused=false;$('start').hidden=true;document.body.classList.add('playing');
 world.snapCamera(s);hud();canvas.focus();
 banner('킥오프!',`인혁 FC vs ${teamName(s,1)}`,'',1800);sfx.whistle();
}
function toMenu(){
 mode='demo';paused=false;keys.clear();shootHeld=false;
 s=create({difficulty:rec.difficulty,seed:Date.now()%100000});world.snapCamera(s);
 document.body.classList.remove('playing');$('start').hidden=false;recordLine();hud();
}
function openPause(){paused=true;keys.clear();shootHeld=false;$('pause-dialog').showModal();}
$('play').addEventListener('click',startMatch);
$('sound').addEventListener('click',()=>{rec.sound=!rec.sound;save();hud();if(rec.sound)sfx.click();});
$('pause').addEventListener('click',()=>{if(mode==='play'&&!s.over)openPause();});
$('resume').addEventListener('click',()=>$('pause-dialog').close());
$('pause-dialog').addEventListener('close',()=>{if(!$('records-dialog').open&&mode==='play'){paused=false;canvas.focus();}});
$('restart').addEventListener('click',()=>{$('pause-dialog').close();startMatch();});
$('menu').addEventListener('click',()=>{$('pause-dialog').close();toMenu();});
$('reset-records').addEventListener('click',()=>{$('records-summary').textContent=`지금 전적: ${rec.wins}승 ${rec.draws}무 ${rec.losses}패, 득점 ${rec.goalsFor}, 실점 ${rec.goalsAgainst}`;$('pause-dialog').close();paused=true;$('records-dialog').showModal();});
$('cancel-records').addEventListener('click',()=>$('records-dialog').close());
$('records-dialog').addEventListener('close',()=>{if(mode==='play'){paused=false;canvas.focus();}});
$('confirm-records').addEventListener('click',()=>{const {sound,difficulty}=rec;rec={...newRecords(),sound,difficulty};save();recordLine();$('records-dialog').close();toast('전적을 모두 지웠어요');});
$('again').addEventListener('click',()=>{$('finish').close();startMatch();});
$('to-menu').addEventListener('click',()=>{$('finish').close();toMenu();});
$('finish').addEventListener('cancel',e=>e.preventDefault());
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();shootHeld=false;if(mode==='play'&&!s.over&&!document.querySelector('dialog[open]'))openPause();}});

function handle(ev){
 const live=mode==='play';
 for(const e of ev){
  if(e==='goal:home'||e==='goal:away'){
   const g=s.lastGoal,mine=g.team===0;
   world.celebrate(g.team);
   if(live){
    if(mine){sfx.goal();flash('good');banner(g.own?'자책골!':'GOOOAL!',g.own?`${teamName(s,1)}의 자책골 · ${s.score[0]} : ${s.score[1]}`:`${g.num}번 선수 골! · ${s.score[0]} : ${s.score[1]}`,'home');}
    else{sfx.groan();flash('bad');banner('실점…',`${teamName(s,1)} ${g.own?'(자책골)':g.num+'번'} · ${s.score[0]} : ${s.score[1]}`,'away');}
   }
  }
  else if(!live)continue;
  else if(e==='shoot'||e==='pass')sfx.kick(e==='shoot'?1.2:.7);
  else if(e==='whistle'){sfx.whistle();toast('킥오프',1000);}
  else if(e==='post'){sfx.post();toast('골대 맞았다! 🥅',1100);}
  else if(e==='save'){sfx.save();toast(s.lastSave===1?'상대 골키퍼 선방! 🧤':'우리 골키퍼 선방! 🧤',1200);}
  else if(e==='tackle'||e==='steal')sfx.tackle();
  else if(e==='dodge')toast('휙! 태클을 피했다',800);
  else if(e==='out'){sfx.whistle();toast(s.message+(s.players[s.ball.owner].team===0?' · 우리 공':' · 상대 공'),1100);}
  else if(e==='end')finish();
 }
}
function finish(){
 const {res,newBest}=applyResult(rec,s);save();
 sfx.whistle(3);if(res==='win'){setTimeout(()=>sfx.goal(),900);world.burst(0,6,0,160);}
 $('result-title').textContent=res==='win'?'🏆 승리!':res==='loss'?'😢 아쉽게 졌어요':'🤝 무승부';
 $('final-score').textContent=`${s.score[0]} : ${s.score[1]}`;$('final-away').textContent=teamName(s,1);
 $('final-shots').textContent=`${s.shots[0]} : ${s.shots[1]}`;$('final-poss').textContent=`${possession(s)}%`;
 $('final-record').textContent=`${rec.wins}승 ${rec.draws}무 ${rec.losses}패`;
 $('goal-list').textContent=s.goals.map(g=>`${g.minute}' ${g.team?'🔴':'🔵'} ${g.own?'자책골':g.num+'번'}`).join('  ·  ');
 $('new-best').textContent=newBest?`🎉 최다 점수 차 승리 기록! ${rec.bestWin}골 차`:res==='win'&&s.score[1]===0?'🧤 무실점 승리!':'';
 setTimeout(()=>$('finish').showModal(),1600);
}

// 미니맵
const radar=$('radar'),rc=radar.getContext('2d');
function drawRadar(){
 const W=radar.width,H=radar.height,sx=W/(HALF_L*2+4),sz=H/(HALF_W*2+4),X=x=>(x+HALF_L+2)*sx,Z=z=>H-(z+HALF_W+2)*sz;
 rc.clearRect(0,0,W,H);rc.fillStyle='#2f8a3bcc';rc.fillRect(0,0,W,H);
 rc.strokeStyle='#ffffffaa';rc.lineWidth=1.5;rc.strokeRect(X(-HALF_L),Z(HALF_W),HALF_L*2*sx,HALF_W*2*sz);
 rc.beginPath();rc.moveTo(X(0),Z(HALF_W));rc.lineTo(X(0),Z(-HALF_W));rc.stroke();
 rc.fillStyle='#fff';for(const gx of [-HALF_L,HALF_L])rc.fillRect(X(gx)-2,Z(GOAL_W/2),4,GOAL_W*sz);
 for(const p of s.players){rc.fillStyle=p.team?'#ff6b6b':'#4dabf7';rc.beginPath();rc.arc(X(p.x),Z(p.z),p.id===s.human&&mode==='play'?5:3.5,0,Math.PI*2);rc.fill();
  if(p.id===s.human&&mode==='play'){rc.strokeStyle='#ffe066';rc.lineWidth=2;rc.stroke();}}
 rc.fillStyle='#fff';rc.strokeStyle='#000';rc.lineWidth=1;rc.beginPath();rc.arc(X(s.ball.x),Z(s.ball.z),2.8,0,Math.PI*2);rc.fill();rc.stroke();
}

let hudTimer=0;
world.engine.runRenderLoop(()=>{
 const dt=Math.min(world.engine.getDeltaTime()/1000,.05);
 if(!paused&&!document.hidden){
  let ev;
  if(mode==='play'){ev=step(s,{...inputVector(),sprint:sprintHeld,shoot:shootHeld,pass:passQueued},dt);}
  else{ev=step(s,null,dt);if(s.over)s=create({difficulty:rec.difficulty,seed:Date.now()%100000});}
  passQueued=false;
  if(ev.length)handle(ev);
 } else passQueued=false;
 hudTimer-=dt;if(hudTimer<=0){hudTimer=.1;hud();drawRadar();}
 world.sync(s,dt,{human:mode==='play'?s.human:null,charge:mode==='play'&&s.charging?s.charge:0});
});

window.render_game_to_text=()=>JSON.stringify({mode,paused,difficulty:s.difficulty,time:+s.time.toFixed(2),phase:s.phase,score:s.score,shots:s.shots,over:s.over,result:s.over?result(s):null,
 human:s.human,charging:s.charging,charge:+s.charge.toFixed(2),ball:{x:+s.ball.x.toFixed(2),y:+s.ball.y.toFixed(2),z:+s.ball.z.toFixed(2),owner:s.ball.owner},
 players:s.players.map(p=>({id:p.id,team:p.team,role:p.role,x:+p.x.toFixed(2),z:+p.z.toFixed(2)})),records:rec,world:world.diagnostics()});
// 브라우저 검사용
window.soccer_debug={
 get state(){return s;},
 setTime(t){s.time=t;},
 giveBall(x,z){const p=s.players[s.human];p.x=x;p.z=z;p.face=0;p.vx=p.vz=0;s.ball.owner=p.id;s.phase='play';s.pause=0;},
};
