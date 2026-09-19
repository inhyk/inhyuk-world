import './style.css';
import {spawnPlayer,movePlayer,nearestBlock,blockPosition,blockDistance} from './movement.mjs';
import {createWorld} from './world.mjs';
import {ORES,GOAL,initial,capacity,count,cost,interval,width,oreAt,strike,hardness,power,descend,sell,upgrade,restore,money} from './core.mjs';
const $=id=>document.getElementById(id);
const KEY='deep-dig-v1';
let s=initial();try{s=restore(localStorage.getItem(KEY));}catch{}
let selected=4,held=false,elapsed=0,sound=false,audio,victoryShown=s.won;
let player=spawnPlayer();
const moveKeys=new Set(),moveTouches=new Map();
let lookPointer=null;
const movementCodes={KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};
const canvas=$('mine');
let world;
try {world=createWorld(canvas);}catch(error){$('pickup').textContent='3D 화면을 열 수 없어요. 브라우저의 하드웨어 가속을 켜고 다시 열어 주세요.';throw error;}
function save(){try{localStorage.setItem(KEY,JSON.stringify(s));$('save').textContent='진행 상황 자동 저장 ✓';}catch{$('save').textContent='저장 불가 · 이 창에서 계속 플레이할 수 있어요';}}
function toast(t){$('pickup').textContent=t;}
function tone(){if(!sound)return;try{audio??=new AudioContext();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.setValueAtTime(360+Math.random()*240,audio.currentTime);o.frequency.exponentialRampToValueAtTime(90,audio.currentTime+.1);g.gain.setValueAtTime(.08,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.12);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.13);}catch{}}
const upgradeDefs=[['shovel','⛏','삽 크기',()=>`${width(s)}칸 동시 채굴`],['speed','ϟ','손의 속도',()=>`${(interval(s)/1000).toFixed(2)}초마다 삽질`],['strength','✊','힘',()=>`한 번에 ${power(s)} 피해`],['bag','▣','배낭',()=>`${capacity(s)}개 보관`]];
function update(){
 $('depth').textContent=s.depth;$('balance').textContent=money(s.money);
 const pct=Math.min(100,s.earned/GOAL*100);$('percent').textContent=`${pct<1&&pct>0?'< 1':Math.floor(pct)}%`;$('goal-progress').style.width=`${pct}%`;
 $('goal-detail').textContent=`누적 판매 ${money(s.earned)} · 목표 100억 원`;
 $('bag-count').textContent=`${count(s)} / ${capacity(s)}`;$('bag-progress').style.width=`${count(s)/capacity(s)*100}%`;
 $('inventory').innerHTML=s.bag.some(Boolean)?s.bag.map((n,i)=>n?`<span style="color:${ORES[i].color}">${ORES[i].icon} ${ORES[i].name} ×${n}</span>`:'').join(''):'발견한 광물이 여기에 담겨요.';
 $('sale-value').textContent=money(s.bag.reduce((v,n,i)=>v+n*ORES[i].price,0));$('sell').disabled=!count(s);
 $('down').disabled=!s.dug.length;$('dig').disabled=count(s)>=capacity(s);
 $('collection').textContent=`${s.found.filter(Boolean).length} / 8 발견`;
 const next=ORES.find(o=>o.depth>s.depth);$('next-ore').textContent=next?`다음 발견 · ${next.name} ${next.depth}m`:'모든 광물이 잠든 다이아몬드 지층';
 $('biome').textContent=s.depth>=500?'다이아몬드 심층':s.depth>=300?'보랏빛 결정층':s.depth>=150?'은빛 광맥':s.depth>=75?'금속 광맥':s.depth>=50?'석탄 지층':'자갈 지층';
 $('upgrades').innerHTML=upgradeDefs.map(([key,icon,name,detail])=>`<div class="upgrade"><span class="tool">${icon}</span><div class="upgrade-info"><b>${name}<em>Lv.${s.levels[key]+1}</em></b><small>${detail()}</small></div><button data-upgrade="${key}" aria-label="${name} 업그레이드 ${money(cost(s,key))}" ${s.levels[key]>=4||s.money<cost(s,key)?'disabled':''}>${s.levels[key]>=4?'MAX':money(cost(s,key))+' ↗'}</button></div>`).join('');
 world.sync(s,selected);damageUI();
}
function damageUI(){
 const cracked=s.dug.includes(selected),pct=cracked?100:Math.round(s.damage[selected]/hardness(s,selected)*100);
 $('target-name').textContent=ORES[oreAt(s.depth,selected)].name;
 $('damage-progress').style.width=`${pct}%`;
 $('damage-label').textContent=cracked?'채굴 완료':`균열 ${pct}%`;
}
function stop(){held=false;elapsed=0;}
function stopAll(){lookPointer=null;stop();moveKeys.clear();moveTouches.clear();player.moving=false;}
function mine(){
 if($('journal').open||$('victory').open||$('reset-dialog').open){stop();return;}
 if(count(s)>=capacity(s)){toast('배낭이 가득 찼어요! 광물을 판매해 주세요.');stop();return;}
 if(s.dug.includes(selected)){
   const free=nearestBlock(s,player);
   if(free===null){descend(s);world.sync(s,selected);}else selected=free;
   if(blockDistance(player,selected)>1.6){update();return;}
 }
 const impacts=strike(s,selected);
 if(impacts.length){
   tone();world.impact(impacts);
   const broken=impacts.filter(h=>h.broken);
   if(count(s)>=capacity(s)){toast('배낭이 가득 찼어요! 판매하고 탐험을 이어가세요.');stop();}
   else if(broken.length)toast(`${[...new Set(broken.map(h=>ORES[h.ore].name))].join(' · ')} 채굴 완료! +${broken.length}개`);
   else toast('금이 점점 커지고 있어요. 계속 꾹 눌러 주세요!');
   update();save();
 }
}
function down(){stopAll();if(descend(s)){toast(`${s.depth}m 도착. 블록을 꾹 눌러 채굴하세요.`);update();save();}}
$('down').onclick=down;
$('sell').onclick=()=>{stop();const value=sell(s);toast(`${money(value)} 판매 완료! 현재 깊이에서 계속 탐험해요.`);update();save();if(s.won&&!victoryShown){stopAll();victoryShown=true;$('victory').showModal();}};
$('upgrades').onclick=e=>{stop();const button=e.target.closest('[data-upgrade]');if(button&&upgrade(s,button.dataset.upgrade)){toast('장비 업그레이드 완료! 더 편하게 탐험할 수 있어요.');tone();update();save();}};
$('book').onclick=()=>{stopAll();$('ore-pages').innerHTML=ORES.map((o,i)=>`<article class="ore-page ${s.found[i]?'':'locked'}"><span class="gem" style="color:${s.found[i]?o.color:'#98a28e'}">${s.found[i]?o.icon:'?'}</span><div><b>${o.name}</b><p>${o.depth}m부터 · ${money(o.price)}</p><p>${s.found[i]?`발견 ${s.found[i]}개`:'아직 발견하지 못했어요'}</p></div></article>`).join('');$('journal').showModal();};
$('close-book').onclick=()=>$('journal').close();$('continue').onclick=()=>$('victory').close();
$('sound').onclick=()=>{sound=!sound;$('sound').textContent=`소리 ${sound?'ON':'OFF'}`;$('sound').setAttribute('aria-pressed',String(sound));tone();};
$('reset').onclick=()=>{stopAll();$('reset-dialog').showModal();$('cancel-reset').focus();};
$('cancel-reset').onclick=()=>$('reset-dialog').close();
$('confirm-reset').onclick=()=>{
 stopAll();s=initial();player=spawnPlayer();selected=4;victoryShown=false;
 world.reset(s);update();save();
 $('reset-dialog').close();
 toast('새로운 탐험을 시작해요! 블록을 꾹 눌러 채굴하세요.');
 canvas.focus();
};
let previousScroll=0;
function setExpanded(expanded){
 const wasExpanded=document.body.classList.contains('expanded');
 if(expanded&&!wasExpanded)previousScroll=window.scrollY;
 document.body.classList.toggle('expanded',expanded);
 $('fullscreen').textContent=expanded?'⛶ 원래 크기로':'⛶ 화면 크게';
 $('fullscreen').setAttribute('aria-pressed',String(expanded));
 if(expanded)window.scrollTo(0,0);
 else if(wasExpanded)window.scrollTo(0,previousScroll);
}
$('fullscreen').onclick=async()=>{
 stopAll();$('fullscreen').disabled=true;
 try{
   if(document.body.classList.contains('expanded')){
     if(document.fullscreenElement)await document.exitFullscreen();
     setExpanded(false);
   }else{
     setExpanded(true);
     // Browsers without fullscreen still get the expanded game layout.
     if(document.documentElement.requestFullscreen){
       try{await document.documentElement.requestFullscreen();}catch{/* Keep the in-page expanded view. */}
     }
   }
 }finally{$('fullscreen').disabled=false;}
};
document.addEventListener('fullscreenchange',()=>{
 stopAll();setExpanded(Boolean(document.fullscreenElement));
});
window.addEventListener('keydown',e=>{
 if(e.code==='Escape'&&!document.fullscreenElement&&document.body.classList.contains('expanded')){
   stopAll();setExpanded(false);
 }
});
function begin(aim=true){
 if($('journal').open||$('victory').open||$('reset-dialog').open||count(s)>=capacity(s))return;
 if(aim){const r=canvas.getBoundingClientRect();const col=world.pick(r.left+r.width/2,r.top+r.height/2);if(col!==null){selected=col;update();}}
 held=true;elapsed=0;
}
function start(e){
 if(e.button!==undefined&&e.button!==0)return;
 e.preventDefault();
 if(e.currentTarget===canvas){
   const col=world.pick(e.clientX,e.clientY);if(col===null)return;
   selected=col;canvas.focus();update();
 }
 e.currentTarget.setPointerCapture(e.pointerId);begin(e.currentTarget!==canvas);
}
for(const el of [canvas,$('dig')]){
 el.addEventListener('pointerdown',start);
 el.addEventListener('pointerup',stop);
 el.addEventListener('pointercancel',stop);
 el.addEventListener('lostpointercapture',stop);
 el.addEventListener('contextmenu',e=>e.preventDefault());
}
function startLook(e){
 if(e.currentTarget===canvas&&e.button!==2)return;
 if($('journal').open||$('victory').open||$('reset-dialog').open)return;
 e.preventDefault();stop();lookPointer={id:e.pointerId,x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);canvas.focus();
}
for(const el of [canvas,$('look-pad')]){
 el.addEventListener('pointerdown',startLook);
 el.addEventListener('pointermove',e=>{if(lookPointer?.id!==e.pointerId)return;world.look(e.clientX-lookPointer.x,e.clientY-lookPointer.y);lookPointer.x=e.clientX;lookPointer.y=e.clientY;});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,e=>{if(lookPointer?.id===e.pointerId)lookPointer=null;});
 el.addEventListener('contextmenu',e=>e.preventDefault());
}
$('rotate-left').onclick=()=>{stop();world.rotate(-Math.PI/6);};
$('rotate-right').onclick=()=>{stop();world.rotate(Math.PI/6);};
for(const button of document.querySelectorAll('[data-move]')){
 button.addEventListener('pointerdown',e=>{e.preventDefault();if($('journal').open||$('victory').open||$('reset-dialog').open)return;button.setPointerCapture(e.pointerId);moveTouches.set(e.pointerId,button.dataset.move);canvas.focus();});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,e=>moveTouches.delete(e.pointerId));
 button.addEventListener('contextmenu',e=>e.preventDefault());
}
window.addEventListener('keydown',e=>{
 if($('journal').open||$('victory').open||$('reset-dialog').open)return;
 const onDig=e.target===$('dig');
 if(movementCodes[e.code]){e.preventDefault();moveKeys.add(e.code);return;}
 if(e.target instanceof HTMLElement&&e.target.closest('button,a')&&!onDig)return;
 if(['KeyR','Space','KeyQ','KeyE'].includes(e.code)||(onDig&&e.code==='Enter')){
   e.preventDefault();
   if(e.code==='KeyR'&&!e.repeat)down();
   if((e.code==='Space'||e.code==='Enter')&&!e.repeat)begin();
   if(['KeyQ','KeyE'].includes(e.code)&&!e.repeat){stop();world.rotate(e.code==='KeyQ'?-.3:.3);}
 }
});
window.addEventListener('keyup',e=>{moveKeys.delete(e.code);if(['Space','Enter'].includes(e.code))stop();});
window.addEventListener('blur',stopAll);
document.addEventListener('visibilitychange',()=>{stopAll();save();});window.addEventListener('pagehide',()=>{stopAll();save();});
let prev=performance.now();
update();
world.loop(()=>{
 const now=performance.now(),dt=Math.min(.25,(now-prev)/1000);prev=now;
 const modal=$('journal').open||$('victory').open||$('reset-dialog').open;
 const dirs=new Set([...moveKeys].map(k=>movementCodes[k]).concat([...moveTouches.values()]));
 const horizontal=Number(dirs.has('right'))-Number(dirs.has('left')),forward=Number(dirs.has('up'))-Number(dirs.has('down'));
 let dx=0,dz=0;
 if(!modal&&(horizontal||forward)){
   const angle=world.cameraAngle();dx=-Math.sin(angle)*horizontal-Math.cos(angle)*forward;dz=Math.cos(angle)*horizontal-Math.sin(angle)*forward;
   movePlayer(player,dx,dz,dt,s);
   const r=canvas.getBoundingClientRect();
   const nearest=world.pick(r.left+r.width/2,r.top+r.height/2)??nearestBlock(s,player);
   if(nearest!==null&&nearest!==selected){selected=nearest;elapsed=0;world.sync(s,selected);damageUI();}
 }else if(!modal&&held&&blockDistance(player,selected)>1.6){
   const target=blockPosition(selected);dx=target.x-player.x;dz=target.z-player.z;movePlayer(player,dx,dz,dt,s);
 }else if(!modal)movePlayer(player,0,0,dt,s);
 if(held&&!modal){
   if(blockDistance(player,selected)>1.6){elapsed=0;toast('광물 쪽으로 이동 중… 가까이 가면 채굴해요.');}
   else {player.facing=Math.atan2(player.x-blockPosition(selected).x,player.z-blockPosition(selected).z);elapsed+=dt*1000;while(held&&elapsed>=interval(s)){elapsed-=interval(s);mine();}}
 }
 world.render(dt,held&&blockDistance(player,selected)<=1.6,elapsed/interval(s),player);
});
window.render_game_to_text=()=>JSON.stringify({...s,player:{...player},selected,held,capacity:capacity(s),power:power(s),swingInterval:interval(s),collection:s.found.filter(Boolean).length,world:world.diagnostics()});
