import './style.css';
import { ORES,rankIndex,balance,redeem,GIFT_AMOUNT,LIMITS,MAX_CAPACITY,capacity,weightTotal,initial,power,speed,cost,pick,makeOre,orePrice,radius,canLift,buy,sell,restore,money,rareBoost,RARE_DISTANCE,GIANT_CHANCE,GIANT_PRICE,MAP_SIZE,MAP_HALF,clampMap } from './core.mjs';
import { BASE_ORE_COUNT,EVENT_ORE_COUNT,EVENT_CHANCES,EVENT_DURATION,eventStatus,pickEvent,timeLabel,dayPhase } from './events.mjs';
import { createWorld } from './world.mjs';
const $=id=>document.getElementById(id),KEY='mineral-valley-v1';let state=initial();try{state=restore(localStorage.getItem(KEY));}catch{}
let world;try{world=createWorld($('world'));}catch(error){$('toast').textContent='3D를 시작하지 못했어요. 브라우저의 하드웨어 가속을 켠 뒤 새로고침해 주세요.';throw error;}
const makeActor=(index,tag,z)=>({index,tag,x:index*9,z,facing:0,carried:[],nearest:null,dist:Infinity,moving:false});
const P1=makeActor(0,'1P',20),P2=makeActor(1,'2P',20);
let twoPlayer=false;
const crew=()=>twoPlayer?[P1,P2]:[P1];
const held=o=>P1.carried.includes(o)||P2.carried.includes(o);
const ores=[],keys=new Set();let uid=0,clock=0,last=performance.now(),refresh=0,sweep=0,sound=false,audio,toastUntil=8;
// 광물은 플레이어 주변 900m에만 깔리고, 1,500m 밖으로 밀려나면 회수해 다시 앞쪽에 심는다.
const FIELD_RADIUS=900,FIELD_KEEP=1500,MAP_VIEW=1400;
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));$('save').textContent='진행 상황 자동 저장 ✓';}catch{$('save').textContent='저장 불가 · 이 창에서 계속 플레이 가능';}}
function toast(text){$('toast').textContent=text;$('toast').style.opacity=1;toastUntil=clock+5;}
function tone(high=false){if(!sound)return;try{audio??=new AudioContext();audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.setValueAtTime(high?740:440,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(high?1100:620,audio.currentTime+.12);gain.gain.setValueAtTime(.08,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.3);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+.3);}catch{}}
let activeEventCycle=0;
const oreName=o=>`${ORES[o.id].name}${o.giant?' · 초대형':''}`;
// 40%에 가까운 흔한 광물은 소수점을 접고, 0.001%대 확률은 그대로 보여 준다.
const pct=n=>n>=1?+n.toFixed(1):n;
function spawn(id,x,z,eventOre=false){const o={...makeOre(id),uid:uid++,x,z,eventOre,turn:Math.random()*6.28,mesh:null};ores.push(o);return o;}
function fieldSpawn(center,eventOre=false){
 let x=0,z=0;
 for(let tries=0;tries<14;tries++){const a=Math.random()*6.283,d=70+Math.sqrt(Math.random())*FIELD_RADIUS;x=clampMap(center.x+Math.cos(a)*d);z=clampMap(center.z+Math.sin(a)*d);if(Math.hypot(x,z)>=46)break;}
 // 캠프에서 멀수록 좋은 광물이 잘 나온다.
 return spawn(eventOre||eventStatus(state.playSeconds).active?pickEvent():pick(Math.random,Math.hypot(x,z)),x,z,eventOre);
}
function populate(){
 for(let i=0;i<BASE_ORE_COUNT;i++)fieldSpawn({x:0,z:0});
 // 첫 탐험 보급품은 무작위 분포와 별개로 캠프 앞에 놓인다.
 for(let i=0;i<9;i++)spawn(1,Math.sin(i*2.4)*(8+i*3),31+i*3);
 spawn(2,16,43);spawn(3,-23,49);spawn(0,-9,30);
}
populate();
function eventSpawn(){
 const host=crew()[Math.floor(Math.random()*crew().length)];
 let x=0,z=0;
 for(let tries=0;tries<14;tries++){const a=Math.random()*6.283,r=28+Math.sqrt(Math.random())*180;x=clampMap(host.x+Math.sin(a)*r);z=clampMap(host.z+Math.cos(a)*r);if(Math.hypot(x,z)>=40)break;}
 return spawn(pickEvent(),x,z,true);
}
function syncEvent(){
 const status=eventStatus(state.playSeconds);
 if(status.active&&activeEventCycle!==status.cycle){
  clearEventOres();activeEventCycle=status.cycle;
  for(let i=0;i<EVENT_ORE_COUNT;i++)eventSpawn();
  toast(`희귀 광맥 대폭발! 주변에 에픽 이상 원석 ${EVENT_ORE_COUNT}개가 나타났어요. 1분 동안 탐험하세요!`);tone(true);save();
 }else if(!status.active&&activeEventCycle){
  clearEventOres();activeEventCycle=0;toast('희귀 광맥 이벤트 종료! 들고 있는 광물은 계속 가져갈 수 있어요.');save();
 }
 $('event-panel').classList.toggle('active',status.active);
 $('event-title').textContent=status.active?'희귀 광맥 대폭발!':'희귀 광맥 이벤트';
 $('event-countdown').textContent=timeLabel(status.remaining);
 $('event-detail').textContent=status.active?`${status.stage}/6회 · 주변에 에픽 이상 +${EVENT_ORE_COUNT}개 · 종료까지`:'10·20·30·40·50·60분마다 · 다음 이벤트까지';
 $('event-schedule').textContent=status.active?'특별 광물은 종료 시 사라져요 · 운반 중이면 유지':'플레이 시간 기준 · 매시간 반복 · 접속 종료 시 일시정지';
}
function clearEventOres(){for(let i=ores.length-1;i>=0;i--){const o=ores[i];if(o.eventOre&&!held(o)){o.mesh?.dispose();ores.splice(i,1);}}}
function advanceEvents(seconds){state.playSeconds+=seconds;syncEvent();syncDay();}
function syncDay(){
 const phase=dayPhase(state.playSeconds);
 world.setDay(phase);
 $('day-icon').textContent=phase.icon;$('day-name').textContent=phase.name;
 $('day-countdown').textContent=timeLabel(phase.remaining);
 $('day-detail').textContent=`${phase.day}일차 · ${phase.hint}`;
 document.body.classList.toggle('night',phase.key==='night');
 return phase;
}
// 광물을 회수해 다시 심어 30,000m 맵 어디서나 밀도가 유지된다.
function recycle(limit=110){
 const team=crew();let moved=0;
 for(let i=ores.length-1;i>=0&&moved<limit;i--){
  const o=ores[i];
  if(held(o)||team.some(a=>Math.hypot(o.x-a.x,o.z-a.z)<=FIELD_KEEP))continue;
  ores.splice(i,1);o.mesh?.dispose();
  fieldSpawn(team[Math.floor(Math.random()*team.length)],o.eventOre);moved++;
 }
}
function update(){
 $('money').textContent=money(state.money);$('money').classList.toggle('large-balance',String(state.money).length>15);
 $('power').textContent=`${new Intl.NumberFormat('ko-KR',{notation:'compact',maximumFractionDigits:1}).format(power(state))} kg`;$('power').title=`${power(state).toLocaleString()} kg`;
 $('speed').textContent=`${speed(state)} m/s`;
 const n=state.found.filter(Boolean).length;$('collected').textContent=`${n} / ${ORES.length} 발견`;$('track').style.width=`${n/ORES.length*100}%`;
 $('drop').hidden=!P1.carried.length;
 cargoUI(P1,'cargo-count','cargo-items');
 if(twoPlayer)cargoUI(P2,'coop-count','coop-items');
}
function cargoUI(actor,countId,itemsId){
 $(countId).textContent=`${twoPlayer?actor.tag+' ':''}운반 ${actor.carried.length} / ${capacity(state)} · ${weightTotal(actor.carried).toLocaleString()} / ${power(state).toLocaleString()} kg`;
 $(itemsId).innerHTML=actor.carried.map((o,i)=>`<button data-drop="${i}" data-actor="${actor.index}" title="${oreName(o)} 내려놓기" style="border-color:${ORES[o.id].color}"><span style="color:${ORES[o.id].color}">${o.giant?'★':'◆'}</span> ${oreName(o)} ×<small>${o.weight.toLocaleString()} kg · ${money(orePrice(o))}</small></button>`).join('');
}
function targetUI(){
 const o=P1.nearest;
 if(!o){
  $('target-rank').textContent=P1.carried.length?'CARGO / 운반 중':'EXPLORE THE VALLEY';
  $('target-name').textContent=P1.carried.length?`광석 ${P1.carried.length}개 · 판매 합계 ${money(P1.carried.reduce((n,x)=>n+orePrice(x),0))}`:'원석을 찾아 가까이 다가가세요';
  $('target-info').textContent=P1.carried.length?'R 귀환 · F 모두 판매 · 광석 칸을 눌러 내려놓기':'WASD 이동 · 드래그로 시점 회전 · 2 키로 2인 플레이';
  $('target-symbol').style.color='#6e9070';$('lift').textContent='E · 줍기';$('lift').disabled=true;
 }else{
  const def=ORES[o.id];
  $('target-symbol').style.color=def.color;$('target-symbol').textContent=o.giant?'★':'◇';
  $('target-rank').textContent=`${def.rank} / ${def.colorName}${o.giant?' · 0.1% 초대형!':''}`;
  $('target-name').textContent=oreName(o);
  $('target-info').textContent=`${o.weight.toLocaleString()} kg · ${money(orePrice(o))}${def.price<0?' · 판매 손해 주의!':''}`;
  $('lift').textContent=P1.carried.length>=capacity(state)?`${capacity(state)}개 가득 참`:canLift(state,o,P1.carried)?'E · 줍기':'힘 부족';
  $('lift').disabled=!canLift(state,o,P1.carried);
 }
 if(twoPlayer){
  const t=P2.nearest;
  $('coop-target').textContent=t?`${oreName(t)} · ${t.weight.toLocaleString()} kg · ${money(orePrice(t))}${canLift(state,t,P2.carried)?'':' · 들 수 없어요'}`:P2.carried.length?`광석 ${P2.carried.length}개 운반 중 · 합계 ${money(P2.carried.reduce((n,x)=>n+orePrice(x),0))}`:'가까운 광물을 찾아보세요';
 }
}
function lift(actor){
 if($('modal').open)return;
 if(actor.carried.length>=capacity(state)){toast(`${actor.tag}: 지금은 광석을 ${capacity(state)}개까지 들 수 있어요. 상점에서 운반 칸을 늘려 보세요.`);return;}
 if(!actor.nearest){toast(`${actor.tag}: 가까운 광물을 찾아보세요.`);return;}
 if(!canLift(state,actor.nearest,actor.carried)){toast(`총무게 ${weightTotal([...actor.carried,actor.nearest])} kg / 현재 힘 ${power(state)} kg · 힘을 더 강화하세요!`);return;}
 const o=actor.nearest;actor.carried.push(o);state.found[o.id]++;actor.nearest=null;tone();
 toast(`${actor.tag}: ${oreName(o)}을 들었어요! ${actor.carried.length}/${capacity(state)}개 운반 중${o.giant?` · ${money(orePrice(o))}!`:''}`);
 save();update();targetUI();
}
function drop(actor,index=actor.carried.length-1){
 if(!Number.isInteger(index)||index<0||index>=actor.carried.length)return;
 const o=actor.carried.splice(index,1)[0];
 o.x=clampMap(actor.x+Math.sin(actor.facing)*5);o.z=clampMap(actor.z+Math.cos(actor.facing)*5);
 o.mesh.scaling.setAll(radius(o)*.62);o.mesh.position.set(o.x,0,o.z);
 update();targetUI();toast(`${actor.tag}: ${oreName(o)}을 내려놓았어요.`);
}
function home(actor){actor.x=actor.index*9;actor.z=13;toast(`${actor.tag}: 베이스캠프 도착! 판매소와 상점을 이용하세요.`);}
const atCamp=actor=>Math.hypot(actor.x,actor.z)<38;
function doSell(actor){
 if(!actor.carried.length){toast('광물을 들고 판매소에 와 주세요.');return;}
 const batch=actor.carried;actor.carried=[];let total=0;
 for(const o of batch){
  total+=orePrice(o);sell(state,o);
  ores.splice(ores.indexOf(o),1);o.mesh?.dispose();
  if(o.eventOre){if(eventStatus(state.playSeconds).active)eventSpawn();}
  else if(o.id===1&&ores.filter(x=>x.id===1&&Math.hypot(x.x,x.z)<75).length<6)spawn(1,(Math.random()-.5)*35,32+Math.random()*25);
  else fieldSpawn(actor);
 }
 tone(true);toast(`${actor.tag}: 광석 ${batch.length}개 판매 완료! ${total>=0?'+':''}${money(total)}`);
 update();save();targetUI();
}
function sale(actor){
 if(!atCamp(actor)){toast(`${actor.tag}: 판매소는 캠프에 있어요. 귀환 키로 돌아오세요.`);return;}
 if(actor.carried.some(o=>o.id===0)){
  openModal('CAUTION','갈색 돌도 함께 판매할까요?',`<p class="note">갈색 돌은 무게에 비례해 손해입니다. ${actor.carried.length}개를 모두 판매하면 합계 ${money(actor.carried.reduce((n,o)=>n+orePrice(o),0))}입니다. 운반 칸에서 갈색 돌만 내려놓을 수도 있어요.</p><button id="confirm-sale">손해 광석 포함 모두 판매</button>`);
  $('confirm-sale').onclick=()=>{$('modal').close();doSell(actor);};return;
 }
 doSell(actor);
}
function setTwoPlayer(on){
 if(!on&&twoPlayer){while(P2.carried.length)drop(P2);P2.nearest=null;}
 twoPlayer=on;world.setSplit(on);
 document.body.classList.toggle('coop',on);
 $('coop').hidden=!on;
 if(on){P2.x=P1.x+9;P2.z=P1.z;P2.facing=P1.facing;}
 toast(on?'2인 플레이 시작! 2P는 방향키로 움직이고 마침표(.)로 줍습니다. 2를 다시 누르면 1인으로 돌아와요.':'1인 플레이로 돌아왔어요.');
 update();targetUI();
}
function resetPrompt(){
 openModal('NEW EXPEDITION','처음부터 다시 시작할까요?',`<p class="note">돈, 힘·속도·운반 칸 업그레이드, 발견 도감, 운반 중인 광석과 이벤트·하루 시간이 모두 초기화됩니다.</p><button id="confirm-reset">모두 초기화하고 시작</button> <button id="cancel-reset">취소</button>`);
 $('cancel-reset').onclick=()=>$('modal').close();
 $('confirm-reset').onclick=()=>{
  clearInput();for(const o of ores)o.mesh?.dispose();ores.length=0;
  for(const a of [P1,P2]){a.carried=[];a.nearest=null;a.x=a.index*9;a.z=20;a.facing=0;}
  Object.assign(state,initial());activeEventCycle=0;populate();
  $('modal').close();save();update();syncEvent();syncDay();targetUI();toast('새로운 탐험을 시작해요!');
 };
}
function openModal(label,title,html){keys.clear();$('modal-label').textContent=label;$('modal-title').textContent=title;$('modal-body').innerHTML=html;if(!$('modal').open)$('modal').showModal();}
const UPGRADES={
 strength:{name:'✊ 운반의 힘',detail:s=>`${power(s).toLocaleString()} kg → ${power({...s,strength:s.strength+1}).toLocaleString()} kg까지 들 수 있어요.`},
 cargo:{name:'📦 운반 칸',detail:s=>`한 번에 ${capacity(s)}개 → ${capacity({...s,cargo:s.cargo+1})}개까지 들고 다닐 수 있어요.`},
 speed:{name:'ϟ 탐험 속도',detail:s=>`${speed(s)} m/s → ${speed(s)+4} m/s로 더 빠르게 이동해요.`},
};
function shop(){
 if(!atCamp(P1)&&!(twoPlayer&&atCamp(P2))){toast('상점은 캠프에 있어요. R 또는 귀환 버튼으로 돌아오세요.');return;}
 openModal('BASE CAMP / EQUIPMENT','다음 발견을 위한 준비',`<p class="note">보유 금액 <b>${money(state.money)}</b> · 구매한 능력은 영구 적용되고 2인 플레이에서는 두 탐험가가 함께 씁니다.</p>${Object.entries(UPGRADES).map(([key,up])=>{const max=state[key]>=LIMITS[key];return `<article class="upgrade"><b>${up.name} <small>Lv.${state[key]+1} / ${LIMITS[key]+1}</small></b><p>${up.detail(state)}</p><button data-buy="${key}" ${max||balance(state)<BigInt(cost(state,key))?'disabled':''}>${max?'최고 레벨':money(cost(state,key))+' · 업그레이드'}</button></article>`;}).join('')}<form id="gift-form" class="gift-form"><label for="gift-code">선물 코드</label><div><input id="gift-code" inputmode="numeric" autocomplete="off" placeholder="코드를 입력하세요" maxlength="30" required><button type="submit">받기</button></div><p id="gift-result" role="status"></p></form><p class="note">운반 칸은 Lv.1에서 1개로 시작해 Lv.5에서 ${MAX_CAPACITY}개가 됩니다. 힘은 총무게 이상이어야 추가로 들 수 있고 Lv.${LIMITS.strength+1}까지 강화할 수 있어요. 운반 중에는 무게에 따라 조금 느려집니다.</p>`);
}
function journal(){
 openModal(`FIELD GUIDE / ${ORES.length} MINERALS`,'돌 속의 작은 우주',`<p class="note">가격이 등급을 결정합니다. 높은 등급일수록 더 무겁고, 더 크고, 더 드물어요.<br><b>가격은 실제 무게에 비례합니다.</b> 같은 광물이라도 크게 자란 쪽이 더 비쌉니다.<br><b>${GIANT_CHANCE}% 확률로 초대형 광물(★)</b>이 나오며 무게 ${ORES.length&&''}${25}배에 가격은 ${GIANT_PRICE}배 프리미엄까지 붙습니다.</p><div class="catalog">${[...ORES].sort((a,b)=>a.price-b.price).map(o=>`<article><span class="swatch" style="color:${o.color}">◆</span><div><b>${o.name} · ${o.rank}</b><p>${money(o.price)} · ${o.weight.toLocaleString()}–${(o.weight*1.25).toLocaleString()} kg</p><small>평소 ${pct(o.chance)}% / 이벤트 ${pct(EVENT_CHANCES[o.id])}% · ${state.found[o.id]?'발견 '+state.found[o.id]+'회':'미발견'}</small></div></article>`).join('')}</div><p class="note">계곡은 ${MAP_SIZE.toLocaleString()} × ${MAP_SIZE.toLocaleString()}m이고 광물 ${BASE_ORE_COUNT.toLocaleString()}개가 항상 주변 ${FIELD_RADIUS}m 안에 깔립니다. <b>캠프에서 ${RARE_DISTANCE.toLocaleString()}m를 넘어가면 에픽 이상이 제대로 나오기 시작하고</b>, 더 멀리 갈수록 최대 18배까지 잘 나옵니다. 누적 플레이 10·20·30·40·50·60분마다 ${EVENT_DURATION}초간 희귀 광맥 이벤트가 열리고 매시간 반복됩니다. 하루는 아침 10분 · 낮 10분 · 밤 10분으로 흐르고 밤에는 광물이 스스로 빛납니다. 이벤트 중 새 광석은 에픽 이상만 나오며 주변에 특별 광석 ${EVENT_ORE_COUNT}개가 추가됩니다. 캠프 앞에는 처음 시작하는 탐험가를 위한 견본이 놓여 있어요. 돈·업그레이드·도감은 자동 저장되며, 지도와 운반 중인 광물은 새로 접속하면 다시 생성됩니다.</p>`);
}
$('lift').onclick=()=>lift(P1);$('drop').onclick=()=>drop(P1);$('reset').onclick=resetPrompt;
$('return').onclick=()=>home(P1);$('sell').onclick=()=>sale(P1);$('shop').onclick=shop;$('journal').onclick=journal;$('close').onclick=()=>$('modal').close();
$('coop-toggle').onclick=()=>setTwoPlayer(!twoPlayer);
for(const id of ['cargo-items','coop-items'])$(id).onclick=e=>{const b=e.target.closest('[data-drop]');if(b)drop(b.dataset.actor==='1'?P2:P1,Number(b.dataset.drop));};
$('sound').onclick=()=>{sound=!sound;$('sound').textContent=`소리 ${sound?'ON':'OFF'}`;$('sound').setAttribute('aria-label',sound?'소리 끄기':'소리 켜기');tone();};
$('modal-body').onsubmit=e=>{if(e.target.id!=='gift-form')return;e.preventDefault();if(redeem(state,$('gift-code').value)){save();update();tone(true);shop();$('gift-result').textContent=`${money(GIFT_AMOUNT)} 지급 완료!`;}else $('gift-result').textContent='코드가 맞지 않아요. 다시 확인해 주세요.';};
$('modal-body').onclick=e=>{const b=e.target.closest('[data-buy]');if(b&&buy(state,b.dataset.buy)){tone(true);save();update();shop();}};
// 1인 플레이에서는 방향키가 WASD를 대신하고, 2인 플레이에서는 2P 전용이 된다.
const ARROWS={w:'arrowup',s:'arrowdown',a:'arrowleft',d:'arrowright'};
const HOTKEYS=new Set(['w','a','s','d','e','q','r','f','z','2',' ','arrowup','arrowdown','arrowleft','arrowright','.',',','/',"'"]);
addEventListener('keydown',e=>{
 if($('modal').open)return;
 const k=e.key.toLowerCase();
 if(HOTKEYS.has(k))e.preventDefault();
 keys.add(k);
 if(e.repeat)return;
 if(k==='e')lift(P1);if(k==='q')drop(P1);if(k==='r')home(P1);if(k==='f')sale(P1);if(k==='z')shop();
 if(k==='2')setTwoPlayer(!twoPlayer);
 if(twoPlayer){if(k==='.')lift(P2);if(k===',')drop(P2);if(k==='/')sale(P2);if(k==="'")home(P2);}
});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
let drag=null;const touches=new Map();
function clearInput(){keys.clear();touches.clear();drag=null;last=performance.now();}
addEventListener('blur',clearInput);document.addEventListener('visibilitychange',clearInput);$('modal').addEventListener('close',clearInput);
$('world').addEventListener('pointerdown',e=>{drag={id:e.pointerId,x:e.clientX};$('world').setPointerCapture(e.pointerId);});
$('world').addEventListener('pointermove',e=>{if(drag?.id!==e.pointerId||$('modal').open)return;world.setYaw((e.clientX-drag.x)*.006);drag.x=e.clientX;});
$('world').addEventListener('pointerup',()=>drag=null);$('world').addEventListener('pointercancel',()=>drag=null);
$('world').addEventListener('wheel',e=>{e.preventDefault();world.setZoom(e.deltaY*.025);},{passive:false});
for(const b of document.querySelectorAll('[data-move]')){b.onpointerdown=e=>{e.preventDefault();touches.set(e.pointerId,b.dataset.move);b.setPointerCapture(e.pointerId);};b.onpointerup=b.onpointercancel=e=>touches.delete(e.pointerId);}
function moveInput(actor){
 if(actor===P2)return {x:(keys.has('arrowright')?1:0)-(keys.has('arrowleft')?1:0),z:(keys.has('arrowup')?1:0)-(keys.has('arrowdown')?1:0)};
 const pad=new Set(touches.values());
 const on=k=>keys.has(k)||pad.has(k)||(!twoPlayer&&keys.has(ARROWS[k]));
 return {x:(on('d')?1:0)-(on('a')?1:0),z:(on('w')?1:0)-(on('s')?1:0)};
}
const ctx=$('minimap').getContext('2d');
function map(){
 const team=crew(),s=180/MAP_VIEW;
 const cx=team.reduce((n,a)=>n+a.x,0)/team.length,cz=team.reduce((n,a)=>n+a.z,0)/team.length;
 const night=document.body.classList.contains('night');
 const at=(x,z)=>[90+(x-cx)*s,90-(z-cz)*s];
 ctx.fillStyle=night?'#1b2440':'#e1e7d6';ctx.fillRect(0,0,180,180);
 ctx.strokeStyle=night?'#2c3a5e':'#cbd5c0';ctx.lineWidth=1;
 // 격자는 실제 좌표 200m마다 그려져 미니맵이 플레이어를 따라 스크롤된다.
 const step=200;
 for(let wx=Math.ceil((cx-MAP_VIEW/2)/step)*step;wx<cx+MAP_VIEW/2;wx+=step){const[px]=at(wx,0);ctx.beginPath();ctx.moveTo(px,0);ctx.lineTo(px,180);ctx.stroke();}
 for(let wz=Math.ceil((cz-MAP_VIEW/2)/step)*step;wz<cz+MAP_VIEW/2;wz+=step){const[,py]=at(0,wz);ctx.beginPath();ctx.moveTo(0,py);ctx.lineTo(180,py);ctx.stroke();}
 // 캠프에서 1,000m — 이 원 밖으로 나가면 좋은 광물이 나오기 시작한다.
 const[ox,oz]=at(0,0);
 ctx.strokeStyle=night?'#6f7fc4':'#a9bf9a';ctx.setLineDash([3,3]);ctx.beginPath();ctx.arc(ox,oz,RARE_DISTANCE*s,0,6.3);ctx.stroke();ctx.setLineDash([]);
 ctx.strokeStyle=night?'#4a5a8a':'#9aa892';ctx.lineWidth=2;const[bx,bz]=at(-MAP_HALF,MAP_HALF);ctx.strokeRect(bx,bz,MAP_SIZE*s,MAP_SIZE*s);
 for(const o of ores){
  if(held(o))continue;
  const[px,py]=at(o.x,o.z);if(px<-4||px>184||py<-4||py>184)continue;
  // 흔한 광물은 옅게 깔고 값나가는 광물과 초대형만 또렷하게 찍는다.
  const tier=rankIndex(o.id);
  ctx.fillStyle=ORES[o.id].color;ctx.globalAlpha=o.giant?1:tier<3?.28:.85;
  ctx.beginPath();ctx.arc(px,py,o.giant?4.5:tier<3?.9:tier<8?1.8:2.6,0,6.3);ctx.fill();
  if(o.giant){ctx.strokeStyle='#fffdf0';ctx.lineWidth=1.5;ctx.stroke();}
 }
 ctx.globalAlpha=1;
 if(ox>-8&&ox<188&&oz>-8&&oz<188){ctx.fillStyle='#af8049';ctx.fillRect(ox-3,oz-3,6,6);}
 else{const a=Math.atan2(oz-90,ox-90);ctx.fillStyle='#af8049';ctx.beginPath();ctx.arc(90+Math.cos(a)*84,90+Math.sin(a)*84,4,0,6.3);ctx.fill();}
 for(const a of team){
  const[px,py]=at(a.x,a.z);
  ctx.fillStyle=a.index?'#1f4d84':'#204e3e';ctx.strokeStyle='#fffde8';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(px,py,4,0,6.3);ctx.fill();ctx.stroke();
 }
 const dist=Math.hypot(P1.x,P1.z);
 $('coords').textContent=`X ${Math.round(P1.x+MAP_HALF).toLocaleString()} / Z ${Math.round(P1.z+MAP_HALF).toLocaleString()} · 캠프 ${Math.round(dist).toLocaleString()} m`;
 $('rarity').textContent=dist<RARE_DISTANCE?`희귀 광물 확률 ×0.25 · ${Math.ceil(RARE_DISTANCE-dist).toLocaleString()}m 더 나가세요`:`희귀 광물 확률 ×${rareBoost(dist).toFixed(1)}`;
}
const regionName=d=>d<38?'베이스캠프':d<1000?'이끼빛 초원':d<3000?'안개빛 황야':d<7000?'햇빛의 능선':d<12000?'고요한 북쪽 숲':'세상의 끝 절벽';
function frame(now){
 const elapsed=Math.max(0,(now-last)/1000),dt=Math.min(elapsed,.05);last=now;
 if(!document.hidden)state.playSeconds+=elapsed;
 clock+=dt;
 const team=crew();
 if(!$('modal').open)for(const a of team){
  const input=moveInput(a);let{x:dx,z:dz}=input;
  a.moving=false;
  if(dx||dz){
   const n=Math.hypot(dx,dz);dx/=n;dz/=n;
   const yaw=world.yaw(a.index),vx=dx*Math.cos(yaw)-dz*Math.sin(yaw),vz=dx*Math.sin(yaw)+dz*Math.cos(yaw);
   const pace=speed(state)*(a.carried.length?1-.3*weightTotal(a.carried)/power(state):1);
   a.x=clampMap(a.x+vx*pace*dt);a.z=clampMap(a.z+vz*pace*dt);a.facing=Math.atan2(vx,vz);a.moving=true;
  }
 }else for(const a of team)a.moving=false;
 for(const a of team){a.nearest=null;a.dist=Infinity;}
 let budget=8;
 for(const o of ores){
  if(held(o))continue;
  let best=Infinity;
  for(const a of team){
   const d=Math.hypot(o.x-a.x,o.z-a.z);
   if(d<best)best=d;
   if(o.mesh&&d<radius(o)+6&&d<a.dist){a.nearest=o;a.dist=d;}
  }
  if(best<170&&!o.mesh&&budget>0){o.mesh=world.addOre(o);budget--;}
  else if(best>250&&o.mesh){o.mesh.dispose();o.mesh=null;}
 }
 for(const a of team)for(const o of a.carried)o.mesh.setEnabled(true);
 world.update(team,clock);
 if(clock>toastUntil)$('toast').style.opacity=0;
 refresh+=dt;
 if(refresh>.15){
  refresh=0;syncEvent();syncDay();targetUI();map();world.streamScenery(team);
  $('region').textContent=regionName(Math.hypot(P1.x,P1.z));
 }
 sweep+=dt;
 if(sweep>1.5){sweep=0;if(!document.hidden)recycle();}
 requestAnimationFrame(frame);
}
setInterval(save,5000);addEventListener('pagehide',save);
addEventListener('resize',()=>world.resize());
update();syncEvent();syncDay();map();targetUI();requestAnimationFrame(frame);
window.render_game_to_text=()=>JSON.stringify({
 coordinates:`x,z: -${MAP_HALF}..${MAP_HALF}; y up; map ${MAP_SIZE}×${MAP_SIZE}`,
 player:{x:P1.x,z:P1.z,facing:P1.facing},twoPlayer,player2:twoPlayer?{x:P2.x,z:P2.z,facing:P2.facing}:null,
 money:state.money,power:power(state),speed:speed(state),capacity:capacity(state),
 carried:P1.carried.map(o=>({id:o.id,weight:o.weight,giant:!!o.giant,price:orePrice(o)})),
 carried2:P2.carried.map(o=>({id:o.id,weight:o.weight,giant:!!o.giant,price:orePrice(o)})),
 cargoWeight:weightTotal(P1.carried),
 nearest:P1.nearest?{id:P1.nearest.id,weight:P1.nearest.weight,giant:!!P1.nearest.giant,price:orePrice(P1.nearest),canLift:canLift(state,P1.nearest,P1.carried)}:null,
 nearest2:P2.nearest?{id:P2.nearest.id,canLift:canLift(state,P2.nearest,P2.carried)}:null,
 ores:ores.length,rareBoost:rareBoost(Math.hypot(P1.x,P1.z)),
 day:dayPhase(state.playSeconds),
 event:{...eventStatus(state.playSeconds),playSeconds:state.playSeconds,bonusOres:ores.filter(o=>o.eventOre).length},
 found:state.found,atCamp:atCamp(P1)});
// 개발용 훅은 일반 플레이에는 존재하지 않는다.
if(import.meta.env.DEV&&new URLSearchParams(location.search).has('test'))window.__mineralTest={state,player:P1,player2:P2,ores,spawn,update,advanceEvents,setTwoPlayer,recycle,P1,P2,orePrice,capacity:()=>capacity(state),lift:(a=P1)=>lift(a),sale:(a=P1)=>sale(a),drop:(a=P1,i)=>drop(a,i??a.carried.length-1),home:(a=P1)=>home(a)};
