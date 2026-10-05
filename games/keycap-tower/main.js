import './style.css';
import {WORLDS,STATS,TRAILS,ITEMS,SKINS,MAX_REBIRTH,eventInfo,buyItem,buySkin,itemMult,getWorld,restore,serialize,fresh,step,respawn,toLobby,warpStage,enterWorld,buyStat,buyTread,buyTrail,rebirth,canRebirth,rebirthReq,rebirthMult,globalMult,stepPower,treadRate,ownsTread,levelOf,needSpeed,runSpeed,onPath,pathS,buttonWait,fmt} from './core.mjs';
import {createWorld} from './world.mjs';
const $=id=>document.getElementById(id);
const KEY='keycap-tower-v1';
let s;try{s=restore(localStorage.getItem(KEY));}catch{s=restore(null);}
const canvas=$('game');
let world;
try{world=createWorld(canvas);}catch(error){$('resume-note').textContent='3D 화면을 열 수 없어요. 브라우저의 하드웨어 가속을 켜고 다시 열어 주세요.';throw error;}
world.snapCamera(s);

let eventShift=0,playing=false,audio,saveTimer=0,toastTimer,hudTimer=0,gateTimer=0,lookIdle=9,onTread=null,treadGain=0,treadTimer=0,zone=null,lockedTread=null;
function save(){try{localStorage.setItem(KEY,JSON.stringify(serialize(s)));}catch{}}
function tone(freq,dur=.12,type='square',slide=1,vol=.06){
 if(!s.sound)return;
 try{audio??=new AudioContext();if(audio.state==='suspended')audio.resume();const t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();
  o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(freq*slide,t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);
  o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+dur+.02);}catch{}
}
const chord=(notes,gap=90,dur=.16)=>notes.forEach((f,i)=>setTimeout(()=>tone(f,dur,'triangle',1,.08),i*gap));
let click=0;
const sfx={
 jump:()=>tone(420,.12,'square',1.8,.035),
 key:()=>tone(520+(click++%8)*45,.05,'square',.6,.04),
 death:()=>tone(300,.4,'sawtooth',.25,.06),
 checkpoint:()=>chord([523,659,784]),
 win:()=>chord([659,784,1047,1319],70),
 level:()=>chord([784,988],60,.1),
 buy:()=>chord([523,784],70,.12),
 no:()=>tone(180,.15,'square',.8,.05),
 big:()=>chord([523,659,784,1047,784,1047],120,.22),
 chase:()=>tone(140,.5,'sawtooth',1.6,.07),
};
// 배경음악: 월드마다 빠르기·조·멜로디가 조금씩 다른 8비트 반복 음악. 음원 파일 없이 바로 만들어 낸다.
const PROGS=[[0,9,5,7],[0,5,9,7],[9,5,0,7],[0,7,9,5]],MINOR=new Set([2,4,9]);
let musicTimer=0,musicGain,musicStep=0,musicNext=0,song=null;
function makeSong(w){
 let seed=31+w*977;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
 const dark=WORLDS[w].theme.dark,prog=PROGS[(w+(dark?2:0))%PROGS.length],melody=[];
 for(let bar=0;bar<8;bar++){const root=prog[bar%4],third=MINOR.has(root)?3:4,tones=[0,third,7,12,third+12];let at=Math.floor(rnd()*3);
  for(let i=0;i<8;i++){if(i%2&&rnd()<.45){melody.push(null);continue;}at=Math.max(0,Math.min(tones.length-1,at+Math.floor(rnd()*3)-1));melody.push(root+tones[at]);}}
 return {world:w,key:57+(w*5)%7,beat:60/(100+(w%5)*8)/2,prog,melody,lead:dark?'square':'triangle'};
}
function note(midi,t,dur,type,vol){
 const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=440*2**((midi-69)/12);
 g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(musicGain);o.start(t);o.stop(t+dur+.02);
}
function musicTick(){
 if(!audio||audio.state!=='running'||document.hidden)return;
 if(song?.world!==s.world){song=makeSong(s.world);musicStep=0;musicNext=audio.currentTime+.08;}
 if(musicNext<audio.currentTime)musicNext=audio.currentTime+.05;
 while(musicNext<audio.currentTime+.3){
  const i=musicStep%64,bar=Math.floor(i/8),st=i%8,root=song.key+song.prog[bar%4],third=MINOR.has(song.prog[bar%4])?3:4,t=musicNext,b=song.beat;
  if(st===0||st===3||st===4||st===6)note(root-24,t,b*1.6,'triangle',.16);
  note(root-12+[0,third,7,third][st%4],t,b*.8,'square',.022);
  const m=song.melody[i];if(m!=null)note(song.key+m,t,b*1.7,song.lead,song.lead==='square'?.035:.07);
  musicStep++;musicNext+=b;
 }
}
function music(on){
 clearInterval(musicTimer);musicTimer=0;
 if(!on){musicGain?.gain.setTargetAtTime(0,audio.currentTime,.05);return;}
 try{audio??=new AudioContext();if(audio.state==='suspended')audio.resume();musicGain??=audio.createGain();musicGain.connect(audio.destination);musicGain.gain.setTargetAtTime(.7,audio.currentTime,.05);musicTimer=setInterval(musicTick,100);musicTick();}catch{}
}
function toast(text,ms=1700){const t=$('toast');t.textContent=text;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),ms);}
function flash(kind){const f=$('flash');f.className=`flash ${kind}`;requestAnimationFrame(()=>requestAnimationFrame(()=>{f.className='flash';}));}
function pop(text,kind=''){const p=document.createElement('div');p.className=`pop ${kind}`;p.textContent=text;p.style.marginLeft=`${Math.round((Math.random()-.5)*140)}px`;$('pops').append(p);setTimeout(()=>p.remove(),900);}

function hud(){
 const lv=levelOf(s.speed),a=needSpeed(lv),b=needSpeed(lv+1),W=getWorld(s.world);
 $('level').textContent=fmt(lv);$('level-bar').style.width=`${Math.min(100,(s.speed-a)/(b-a)*100)}%`;$('level-next').textContent=`다음 레벨까지 ${fmt(Math.max(1,Math.ceil(b-s.speed)))}`;
 $('speed').textContent=fmt(Math.floor(s.speed));$('wins').textContent=fmt(s.wins);$('rebirths').textContent=`×${fmt(rebirthMult(s.rebirths))}`;
 $('world-name').textContent=`${s.world+1}월드 · ${W.def.name}`;
 const st=W.stages[s.checkpoint];
 $('stage-name').textContent=!onPath(s)&&s.checkpoint===0?'로비':st?`STAGE ${st.k+1} · ${st.name}`:`👑 ${W.def.name} 정상`;
 $('rebirth-button').classList.toggle('ready',canRebirth(s));
 const ev=eventInfo(Date.now()/1000+eventShift),mm=Math.floor(ev.remain/60),ss=String(Math.floor(ev.remain%60)).padStart(2,'0');
 $('event').textContent=ev.active?`🏆 트로피 2배 이벤트! ${mm}:${ss} 남음`:`다음 트로피 2배 이벤트까지 ${mm}:${ss}`;$('event').classList.toggle('on',ev.active);
 if(ev.active&&s.winBoost===1){sfx.big();toast('🏆 트로피 2배 이벤트 시작! 10분 동안 트로피가 2배',3000);}
 s.winBoost=ev.boost;
 $('music').classList.toggle('off',!s.music);$('music').setAttribute('aria-pressed',String(s.music));$('music').setAttribute('aria-label',s.music?'배경음악 끄기':'배경음악 켜기');
 $('sound').textContent=s.sound?'🔊':'🔇';$('sound').setAttribute('aria-pressed',String(s.sound));$('sound').setAttribute('aria-label',s.sound?'소리 끄기':'소리 켜기');
}
hud();
if(s.speed>0||s.wins>0)$('resume-note').textContent=`저장된 기록으로 이어서 해요 · 레벨 ${levelOf(s.speed)} · ${s.world+1}월드`;

// 입력
const keys=new Set();let jumpQueued=false;const stick={x:0,y:0};
const codes={KeyW:'f',ArrowUp:'f',KeyS:'b',ArrowDown:'b',KeyA:'l',ArrowLeft:'l',KeyD:'r',ArrowRight:'r'};
addEventListener('keydown',e=>{
 if(document.querySelector('dialog[open]'))return;
 if(codes[e.code]){keys.add(codes[e.code]);e.preventDefault();}
 if(e.code==='Space'){e.preventDefault();if(!e.repeat)jumpQueued=true;if(!playing&&!$('start').hidden)start();}
 if(e.code==='Enter'&&!playing&&!$('start').hidden)start();
 if(e.code==='KeyE'&&playing&&!$('prompt').hidden)$('prompt').click();
});
addEventListener('keyup',e=>{if(codes[e.code])keys.delete(codes[e.code]);});
addEventListener('blur',()=>keys.clear());
function inputVector(){
 const f=(keys.has('f')?1:0)-(keys.has('b')?1:0)-stick.y,r=(keys.has('r')?1:0)-(keys.has('l')?1:0)+stick.x,yaw=world.cam.yaw;
 return {x:Math.sin(yaw)*f+Math.cos(yaw)*r,z:Math.cos(yaw)*f-Math.sin(yaw)*r};
}
// 시점 드래그
let look=null;
canvas.addEventListener('pointerdown',e=>{look={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);canvas.focus();});
canvas.addEventListener('pointermove',e=>{
 if(!look||look.id!==e.pointerId)return;
 world.cam.yaw+=(e.clientX-look.x)*.006;world.cam.pitch=Math.max(-.15,Math.min(1.25,world.cam.pitch+(e.clientY-look.y)*.005));
 look.x=e.clientX;look.y=e.clientY;lookIdle=0;
});
const endLook=e=>{if(look?.id===e.pointerId)look=null;};
canvas.addEventListener('pointerup',endLook);canvas.addEventListener('pointercancel',endLook);
canvas.addEventListener('wheel',e=>{e.preventDefault();world.cam.dist=Math.max(5,Math.min(22,world.cam.dist*(1+Math.sign(e.deltaY)*.1)));},{passive:false});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
// 모바일 조이스틱과 점프 버튼
const stickEl=$('stick'),knob=stickEl.firstElementChild;let stickId=null;
function moveStick(e){const r=stickEl.getBoundingClientRect(),Rr=r.width/2;let dx=e.clientX-r.left-Rr,dy=e.clientY-r.top-Rr;const m=Math.hypot(dx,dy);if(m>Rr){dx*=Rr/m;dy*=Rr/m;}stick.x=dx/Rr;stick.y=dy/Rr;knob.style.transform=`translate(${dx}px,${dy}px)`;}
stickEl.addEventListener('pointerdown',e=>{stickId=e.pointerId;stickEl.setPointerCapture(e.pointerId);moveStick(e);e.preventDefault();});
stickEl.addEventListener('pointermove',e=>{if(e.pointerId===stickId)moveStick(e);});
const endStick=e=>{if(e.pointerId!==stickId)return;stickId=null;stick.x=stick.y=0;knob.style.transform='';};
stickEl.addEventListener('pointerup',endStick);stickEl.addEventListener('pointercancel',endStick);
$('jump').addEventListener('pointerdown',e=>{e.preventDefault();jumpQueued=true;});

// 메뉴
const TITLES={item:'🛒 아이템 상점',skin:'👕 스킨',stat:'📊 스탯',tread:'🏃 러닝머신',world:'🌍 월드',rebirth:'🔁 환생',trail:'🌈 트레일'};
let tab='stat';
const item=(icon,name,sub,button,now=false)=>`<div class="item${now?' now':''}"><div class="icon">${icon}</div><div class="info"><b>${name}</b><span>${sub}</span></div>${button}</div>`;
const buyButton=(act,cost,label='사기')=>`<button class="buy" data-act="${act}" ${s.wins<cost?'disabled':''}>${label} · ${fmt(cost)}🏆</button>`;
function renderMenu(){
 const lv=levelOf(s.speed);let h='';
 if(tab==='stat'){
  h+=`<div class="summary"><div><small>레벨</small><b>${fmt(lv)}</b></div><div><small>⚡ 스피드</small><b>${fmt(Math.floor(s.speed))}</b></div><div><small>🏆 트로피</small><b>${fmt(s.wins)}</b></div><div><small>달리기 빠르기</small><b>${runSpeed(lv,s.stats.run).toFixed(1)}</b></div><div><small>키캡 한 번</small><b>+${fmt(stepPower(s)*WORLDS[s.world].keyMult*globalMult(s))}</b></div><div><small>전체 배수</small><b>×${fmt(globalMult(s))}</b></div></div>`;
  for(const [k,st] of Object.entries(STATS)){const l=s.stats[k],max=l>=st.max;
   h+=item(st.icon,`${st.name} <small>Lv ${l}/${st.max}</small>`,`${st.desc} · ${st.show(st.value(l))}${max?'':` → ${st.show(st.value(l+1))}`}`,max?'<button disabled>최대</button>':buyButton(`stat:${k}`,st.cost(l),'올리기'));}
 }else if(tab==='item'){
  const pics={chocolate:'<i></i>'.repeat(9),keycap:'<i>A</i>',bigkeycap:[...'ABCDEFGHIJKL'].map(c=>`<i>${c}</i>`).join('')},cls={일반:'common',에픽:'epic',비밀:'secret'};
  h+=`<p class="note">아이템을 사 두면 얻는 스피드에 배수가 붙어요. 지금 아이템 배수 ×${fmt(itemMult(s))}</p><div class="shop">`;
  for(const it of ITEMS){const own=s.items.includes(it.id);
   h+=`<div class="card ${cls[it.rarity]}"><div class="frame"><div class="rarity">${it.rarity}</div><div class="pic ${it.id}">${pics[it.id]}</div></div><div class="name">${it.name}</div><div class="mult">${it.mult.toFixed(1)}배</div><button class="price${own?' owned':''}" data-act="item:${it.id}" ${own||s.wins<it.cost?'disabled':''}>${own?'보유 중':it.price}</button></div>`;}
  h+='</div>';
 }else if(tab==='skin'){
  h+='<p class="note">트로피로 스킨을 사서 갈아입어요. 한 번 산 스킨은 언제든 다시 입을 수 있어요.</p>';
  SKINS.forEach((k,i)=>{const own=s.skins.includes(i),on=s.skin===i;
   h+=item(`<span class="swatch"><i style="background:${k.hair}"></i><i style="background:${k.hoodie}"></i><i style="background:${k.pants}"></i></span>`,`${k.name} 스킨`,own?'가지고 있어요':'트로피로 살 수 있어요',on?'<button disabled>입는 중</button>':own?`<button data-act="skin:${i}">입기</button>`:buyButton(`skin:${i}`,k.cost),on);});
 }else if(tab==='tread'){
  h+=`<p class="note">러닝머신은 로비 건너편에 있어요. 위에 올라서 있기만 하면 스피드가 계속 올라요. 월드마다 세 대씩 있어요.</p>`;
  WORLDS.forEach((W,w)=>w===s.world&&W.treads.forEach((tr,i)=>{
   const own=ownsTread(s,w,i)&&w<=s.unlocked,here=w===s.world;
   h+=item('🏃',`${tr.name} ×${fmt(tr.mult)}`,`${w+1}월드 · 1초에 +${fmt(treadRate(s,tr))}`,w>s.unlocked?`<button disabled>🔒 ${w+1}월드</button>`:own?`<button disabled>${here?'보유 중':`${w+1}월드에 있어요`}</button>`:buyButton(`tread:${w}:${i}`,tr.cost),here&&own);
  }));
 }else if(tab==='world'){
  WORLDS.forEach((W,w)=>{
   const open=w<=s.unlocked,here=w===s.world;
   if(w>s.unlocked+3&&(w+1)%10)return;
  h+=item(W.emoji,`${w+1}월드 · ${W.name}`,`레벨 ${fmt(W.req)} 필요 · 키캡 ×${fmt(W.keyMult)} · 스테이지 ${W.levels.length}개 · ${s.reached[w]}개 클리어`,here?'<button disabled>지금 여기</button>':open?`<button class="buy" data-act="world:${w}">들어가기</button>`:`<button disabled>🔒 레벨 ${fmt(W.req)}</button>`,here);
  });
  const W=getWorld(s.world);
  h+=`<p class="note">월드는 모두 ${WORLDS.length}개! 지금 ${s.unlocked+1}월드까지 열었어요.</p><p class="note">${s.world+1}월드 순간이동 — 가 본 스테이지부터 다시 올라가요.</p><div class="warps"><button data-act="warp:0">🏠 로비</button>`;
  for(let cp=1;cp<=s.reached[s.world]&&cp<W.stages.length;cp++)h+=`<button data-act="warp:${cp}">STAGE ${cp+1} · ${W.stages[cp].name}</button>`;
  h+='</div><button data-act="reset" class="danger">🗑 리셋 (처음부터 다시)</button>';
 }else if(tab==='rebirth'){
  const max=s.rebirths>=MAX_REBIRTH,req=rebirthReq(s.rebirths);
  h+=`<p class="big">지금 ×${fmt(rebirthMult(s.rebirths))} ${max?'(최대)':`→ 환생하면 <b>×${fmt(rebirthMult(s.rebirths+1))}</b>`}</p><p class="note">환생하면 스피드와 레벨이 0이 되지만, 얻는 스피드가 영원히 2배가 돼요. 트로피·스탯·러닝머신·월드는 그대로예요.</p>`;
  if(!max)h+=item('🔁',`${s.rebirths+1}번째 환생`,`레벨 ${fmt(req)} 필요 · 지금 레벨 ${fmt(lv)}`,`<button class="buy" data-act="rebirth" ${canRebirth(s)?'':'disabled'}>환생하기</button>`);
 }else{
  h+='<p class="note">트레일을 끼우면 얻는 스피드에 배수가 붙고, 달릴 때 뒤에 빛이 따라와요.</p>';
  TRAILS.forEach((t,i)=>{const own=s.trails.includes(i),on=s.trail===i;
   h+=item(`<span style="color:${t.color}">●</span>`,`${t.name} ×${t.mult}`,own?'가지고 있어요':'트로피로 살 수 있어요',on?'<button disabled>끼우는 중</button>':own?`<button data-act="trail:${i}">끼우기</button>`:buyButton(`trail:${i}`,t.cost),on);});
 }
 $('menu-title').textContent=TITLES[tab];$('menu-body').innerHTML=h;
 for(const b of $('menu').querySelectorAll('.tabs [data-tab]'))b.setAttribute('aria-selected',String(b.dataset.tab===tab));
}
function openMenu(t){tab=t;keys.clear();renderMenu();if(!$('menu').open)$('menu').showModal();}
for(const b of document.querySelectorAll('[data-tab]'))b.addEventListener('click',()=>openMenu(b.dataset.tab));
$('menu-close').addEventListener('click',()=>$('menu').close());
$('menu').addEventListener('close',()=>canvas.focus());
function moved(text){world.snapCamera(s);save();hud();$('menu').close();toast(text,2200);}
$('menu-body').addEventListener('click',e=>{
 const b=e.target.closest('[data-act]');if(!b)return;const [act,a,c]=b.dataset.act.split(':');let ok=true;
 if(act==='stat')ok=buyStat(s,a);
 else if(act==='tread')ok=buyTread(s,+a,+c);
 else if(act==='trail')ok=buyTrail(s,+a);
 else if(act==='item')ok=buyItem(s,a);
 else if(act==='skin')ok=buySkin(s,+a);
 else if(act==='world'){if(enterWorld(s,+a)){sfx.big();moved(`${WORLDS[+a].emoji} ${+a+1}월드 · ${WORLDS[+a].name}`);if((+a+1)%10===0)showAd();}return;}
 else if(act==='warp'){if(warpStage(s,+a)){sfx.checkpoint();moved(+a?`STAGE ${+a+1}부터 다시 올라가요`:'🏠 로비로 돌아왔어요');}return;}
 else if(act==='rebirth'){if(rebirth(s)){sfx.big();flash('good');moved(`🔁 환생! 이제 스피드 ×${fmt(rebirthMult(s.rebirths))}`);world.burst(s.x,s.y+2,s.z,90);}return;}
 else if(act==='reset'){$('menu').close();$('reset-dialog').showModal();return;}
 if(ok){sfx.buy();save();hud();renderMenu();}else sfx.no();
});
// 광고: 월드 10개를 넘을 때마다(10·20·30·40·50월드에 들어갈 때) 뜨고, 10초 뒤에 X로 닫는다.
let adTimer;
function showAd(){
 const b=$('ad-close');let left=10;keys.clear();b.disabled=true;b.textContent=`${left}초뒤에 X`;$('ad').showModal();clearInterval(adTimer);
 adTimer=setInterval(()=>{left--;if(left>0)b.textContent=`${left}초뒤에 X`;else{clearInterval(adTimer);b.disabled=false;b.textContent='X';}},1000);
}
$('ad-close').addEventListener('click',()=>{$('ad').close();canvas.focus();});
$('ad').addEventListener('cancel',e=>{if($('ad-close').disabled)e.preventDefault();});
$('reset').addEventListener('click',()=>{keys.clear();$('reset-dialog').showModal();});
$('cancel-reset').addEventListener('click',()=>$('reset-dialog').close());
$('confirm-reset').addEventListener('click',()=>{const sound=s.sound,bgm=s.music;s=fresh();s.sound=sound;s.music=bgm;world.snapCamera(s);save();hud();$('reset-dialog').close();toast('리셋 완료! 1월드 로비에서 처음부터');});
$('home').addEventListener('click',()=>{toLobby(s);world.snapCamera(s);hud();save();toast('🏠 로비로 돌아왔어요');canvas.focus();});
$('music').addEventListener('click',()=>{s.music=!s.music;music(s.music&&playing);hud();save();toast(s.music?'🎵 배경음악 켜짐':'🎵 배경음악 꺼짐',1000);canvas.focus();});
$('sound').addEventListener('click',()=>{s.sound=!s.sound;hud();save();if(s.sound)tone(660,.1,'triangle');});
// 로비 시설 앞이나 잠긴 러닝머신 위에서 뜨는 버튼
const ZONE_TEXT={item:'🛒 아이템 상점 열기',stat:'📊 스탯 상점 열기',world:'🌍 월드 포탈 열기',rebirth:'🔁 환생의 제단 열기'};
$('prompt').addEventListener('click',()=>{
 if(lockedTread!=null){const tr=WORLDS[s.world].treads[lockedTread];if(buyTread(s,s.world,lockedTread)){sfx.buy();toast(`${tr.name} 구매! 올라서면 스피드 ×${fmt(tr.mult)}`);save();hud();}else{sfx.no();toast(`트로피가 모자라요 · ${fmt(tr.cost)}🏆 필요`);}}
 else if(zone)openMenu(zone);
 canvas.focus();
});
function prompt(){
 const p=$('prompt');let text='';
 if(lockedTread!=null){const tr=WORLDS[s.world].treads[lockedTread];text=`${tr.name} 사기 · ${fmt(tr.cost)}🏆`;}
 else if(zone)text=ZONE_TEXT[zone];
 if(text){if(p.textContent!==text)p.textContent=text;p.hidden=false;}else p.hidden=true;
}

// 흐름
function start(){$('start').hidden=true;playing=true;music(s.music);canvas.focus();hud();save();toast(`${WORLDS[s.world].emoji} ${s.world+1}월드 · ${WORLDS[s.world].name}`);}
$('play').addEventListener('click',start);
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();save();}});

function handle(ev){
 lockedTread=null;let tread=null;
 for(const e of ev){
  if(e.t==='jump')sfx.jump();
  else if(e.t==='speed'){sfx.key();pop(`+${fmt(e.gain)} ⚡`);}
  else if(e.t==='tread'){tread=e.index;treadGain+=e.gain;}
  else if(e.t==='locked')lockedTread=e.index;
  else if(e.t==='gold'){sfx.win();pop(`★ +${fmt(e.gain)} 🏆`,'win');}
  else if(e.t==='win'){
   sfx.win();flash('good');pop(`+${fmt(e.gain)} 🏆`,'win');world.burst(s.x,s.y+1,s.z,e.crown?140:40);
   if(e.crown){sfx.big();toast(`👑 ${WORLDS[s.world].name} 정상 도착! +${fmt(e.gain)}🏆`,3000);}
   save();
  }
  else if(e.t==='checkpoint'){sfx.checkpoint();toast(`✓ STAGE ${e.cp} 클리어! 노란 버튼을 밟아 트로피를 받아요`,2200);save();}
  else if(e.t==='death'){sfx.death();flash('death');world.snapCamera(s);toast({del:'앗! DEL 키를 밟았어요',spinner:'앗! 빨간 막대에 맞았어요',chaser:'ESC 괴물에게 잡혔어요!',fall:'앗! 떨어졌어요'}[e.why],1300);}
  else if(e.t==='gate'&&gateTimer<=0){gateTimer=1.5;sfx.no();toast(`🔒 레벨 ${fmt(e.req)}이 되어야 지나갈 수 있어요 · 러닝머신에서 스피드를 올려요`,2200);}
  else if(e.t==='chase'){sfx.chase();toast('ESC 괴물이 쫓아와요! 달려요!',1500);}
  else if(e.t==='level')sfx.level();
  else if(e.t==='unlock'){sfx.big();flash('good');toast(`🎉 ${e.world+1}월드 · ${WORLDS[e.world].name} 열림! 🌍 월드에서 들어가요`,3500);save();}
 }
 onTread=tread;
}

world.engine.runRenderLoop(()=>{
 const dt=Math.min(world.engine.getDeltaTime()/1000,.05);
 if(playing&&!document.hidden){
  const still=!!document.querySelector('dialog[open]');
  handle(step(s,still?{}:{...inputVector(),jump:jumpQueued},dt));jumpQueued=false;
  gateTimer-=dt;lookIdle+=dt;
  if(onTread!=null){treadTimer+=dt;if(treadTimer>.4){pop(`+${fmt(treadGain)} ⚡`);if(Math.random()<.5)sfx.key();treadTimer=0;treadGain=0;}}else{treadTimer=0;treadGain=0;}
  // 타워 위에서는 카메라가 길을 따라 저절로 돈다
  if(onPath(s)&&lookIdle>1.2){const want=-Math.atan2(s.z,s.x),d=Math.atan2(Math.sin(want-world.cam.yaw),Math.cos(want-world.cam.yaw));world.cam.yaw+=d*Math.min(1,dt*2.5);}
  zone=null;if(s.groundId==='lobby')for(const z of getWorld(s.world).zones)if(Math.hypot(s.x-z.x,s.z-z.z)<z.r)zone=z.id;
  prompt();
  saveTimer+=dt;if(saveTimer>3){saveTimer=0;save();}
  hudTimer+=dt;if(hudTimer>.1){hudTimer=0;hud();if($('menu').open&&onTread!=null)renderMenu();}
 } else jumpQueued=false;
 world.sync(s,dt,{onTread});
});
addEventListener('pagehide',save);

window.render_game_to_text=()=>JSON.stringify({playing,...serialize(s),level:levelOf(s.speed),stage:s.checkpoint,bgm:{on:s.music,running:!!musicTimer,step:musicStep,world:song?.world??null,tempo:song?Math.round(30/song.beat):null},pathS:pathS(s),onTread,zone,
 player:{x:s.x,y:s.y,z:s.z,vy:s.vy,grounded:s.grounded,groundId:s.groundId},chaser:s.chaser,wait:buttonWait(s,s.world,0),world3d:world.diagnostics()});
// 브라우저 검사용
window.keycap_tower_debug={
 set(patch){Object.assign(s,patch);hud();},
 warp(w,cp){s.unlocked=Math.max(s.unlocked,w);s.world=w;s.reached[w]=Math.max(s.reached[w],cp);s.checkpoint=cp;respawn(s);world.snapCamera(s);hud();},
 put(x,y,z){s.x=x;s.y=y;s.z=z;s.vy=0;s.lastGroundY=y;world.snapCamera(s);},
 ad:showAd,event(shift){eventShift=shift;hud();},
 tread(i){const o=getWorld(s.world).objects.find(o=>o.type==='tread'&&o.index===i);s.x=o.x;s.z=o.z;s.y=o.top;s.lastGroundY=o.top;s.facing=Math.atan2(o.tx,o.tz);world.snapCamera(s);},
};
