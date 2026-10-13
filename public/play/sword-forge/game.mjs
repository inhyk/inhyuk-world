import { sword,MAX_LEVEL,TIERS,AREAS,MISSIONS,freshState,restoreState,cost,rates,enhance,sell,buy,upgradeCost,claim,encounter,attack } from './core.mjs';
import { swordArt,monsterArt,startEmbers } from './art.mjs';
const $=id=>document.getElementById(id),KEY='immortal-sword-forge-v1';
let state=freshState(),busy=false,battle=null,activeTab='forge',filter=-1,toastTimer,audioCtx,saveFailed=false,lastAttack=0;
try{state=restoreState(JSON.parse(localStorage.getItem(KEY)));}catch{saveFailed=true;}
const fmt=n=>n.toLocaleString('ko-KR');
const compact=n=>n>=1e8?`${(n/1e8).toFixed(1)}억`:n>=1e4?`${(n/1e4).toFixed(1)}만`:fmt(n);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));saveFailed=false;}catch{saveFailed=true;} $('save-status').textContent=saveFailed?'저장 불가 · 브라우저 설정 확인':'진행 상황 자동 저장';}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3200);}
function sound(kind='click'){
  if(!state.sound)return;try{audioCtx??=new (window.AudioContext||window.webkitAudioContext)();audioCtx.resume().catch(()=>{});const now=audioCtx.currentTime;
    const tone=(frequency,start,duration,volume=.08,type='sine')=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.setValueAtTime(frequency,now+start);g.gain.setValueAtTime(.001,now+start);g.gain.exponentialRampToValueAtTime(volume,now+start+.008);g.gain.exponentialRampToValueAtTime(.001,now+start+duration);o.connect(g);g.connect(audioCtx.destination);o.start(now+start);o.stop(now+start+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};};
    if(kind==='hammer'){[220,440,673,1002].forEach((f,i)=>tone(f,0,.28,.045/(i+1),'triangle'));tone(64,0,.11,.13,'sine');}
    else if(kind==='success'){[392,494,587,784].forEach((f,i)=>tone(f,i*.09,.5,.07));}
    else if(kind==='break'){[146,130,110,73].forEach((f,i)=>tone(f,i*.07,.32,.065,'triangle'));}
    else if(kind==='fail'){tone(196,0,.25);tone(146,.16,.4);}
    else if(kind==='win'){[523,659,784,1046].forEach((f,i)=>tone(f,i*.1,.4,.065));}
    else if(kind==='attack'){tone(110,0,.12,.1,'triangle');tone(600,0,.07,.025,'sawtooth');}
    else {tone(660,0,.09,.035);}
  }catch{/* Audio remains optional. */}
}
function modal(content,onConfirm){const d=$('modal');$('modal-content').innerHTML=content;d.showModal();$('modal-content').querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());const confirm=$('confirm-action');if(confirm)confirm.onclick=()=>{d.close();onConfirm?.();};}
$('modal').addEventListener('click',e=>{if(e.target===$('modal')){const r=$('modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('modal').close();}});
const particles=startEmbers($('embers'),()=>state.level);
function render(){
  const s=sword(state.level),r=rates(state,$('bless').checked&&state.bless>0),max=state.level===MAX_LEVEL;
  document.documentElement.style.setProperty('--sword',s.color);
  $('gold').textContent=fmt(state.gold);$('best').textContent=`+${state.best}`;$('rank').textContent=state.best>=30?'신의 대장장이':state.best>=20?'전설의 대장장이':state.best>=10?'왕실 대장장이':state.best>=5?'숙련 대장장이':'견습 대장장이';
  $('sword-display').innerHTML=swordArt(state.level);$('sword-name').textContent=s.name;$('sword-level').textContent=`+${state.level}`;$('sword-rarity').textContent=`${s.name==='낡은 철검'?'강철':TIERS[Math.min(5,Math.floor(state.level/5))].name} · ${s.label}`;$('stage-tier').textContent=s.label;
  $('discovered').textContent=`${state.found.length} / 31`;$('power').textContent=fmt(s.power);$('value').textContent=s.value?`${compact(s.value)} G`:'—';$('next-power').textContent=max?'MAX':fmt(sword(state.level+1).power);
  $('from-level').textContent=`+${state.level}`;$('to-level').textContent=max?'MAX':`+${state.level+1}`;$('chance').innerHTML=`${r.success}<small>%</small>`;$('chance-bar').style.width=`${r.success}%`;
  $('down-risk').textContent=$('protect').checked?'주문서로 단계 하락·파괴 방지':state.level<4?'실패 시 단계 유지':`하락 ${r.down}% · 실패 시 -1`;$('break-risk').textContent=`파괴 ${$('protect').checked?0:r.break}%`;
  $('pity').textContent=state.failures?`✧ 실패 보너스 +${Math.min(80,state.failures*8)}%p 적용 중`:'✧ 실패할 때마다 성공 확률 +8%p';
  for(const id of ['protect','bless']){$(`${id}-count`).textContent=`${state[id]}장`;$(id).disabled=busy||!state[id]||max;if(!state[id])$(id).checked=false;}
  $('enhance').disabled=busy||max||state.gold<cost(state.level);$('enhance').querySelector('span').textContent=busy?'⚒ 검을 두드리는 중…':max?'✦ 창세의 검 완성':'⚒ 검 강화하기';$('enhance-cost').textContent=max?'MAX':`${compact(cost(state.level))} G`;
  $('mobile-actions').hidden=activeTab!=='forge';$('mobile-enhance').disabled=busy||max||state.gold<cost(state.level);$('mobile-cost').textContent=max?'MAX':`${compact(cost(state.level))} G`;
  $('action-hint').textContent=state.gold<cost(state.level)?'골드가 부족해요. 사냥터에서 강화 자금을 모으세요.':max?'전설이 완성됐습니다. 도감에서 모든 검을 확인하세요.':'SPACE로 강화 · 주문서는 시도할 때 소모돼요';
  $('sell').disabled=busy||state.level===0;$('sell-price').textContent=state.level?`${fmt(s.value)} G`:'+1부터 판매 가능';$('attempts').textContent=`${fmt(state.attempts)} ATTEMPTS`;
  $('log').innerHTML=state.log.length?state.log.slice(0,12).map(l=>`<li class="${l.type}">${esc(l.text)}</li>`).join(''):'<li class="empty">아직 모루가 조용하네요.<br>첫 번째 검을 강화해 보세요.</li>';
  $('quote').textContent=state.level>=25?'별을 벼리는 자여, 이제 마지막 불꽃을 피워라.':state.level>=15?'두려움까지 두드려라. 그것이 전설의 무게다.':state.level>=7?'검을 지킬 주문서를 챙겼나? 불은 자비가 없지.':'모든 전설은 낡은 철검 한 자루에서 시작하지.';
  $('sound').innerHTML=state.sound?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m11 4-5 4H2v8h4l5 4V4ZM15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m11 4-5 4H2v8h4l5 4V4Zm5 4 6 8m0-8-6 8"/></svg>';$('sound').setAttribute('aria-label',state.sound?'효과음 끄기':'효과음 켜기');
  const ready=MISSIONS.filter(m=>!state.claimed.includes(m.id)&&state[m.field]>=m.goal).length;$('quest-link').innerHTML=`여정 보상 ${ready?`<b>${ready}</b>`:'확인'} <span>→</span>`;
  if(activeTab==='hunt')renderHunt();if(activeTab==='collection')renderCollection();if(activeTab==='shop')renderShop();
}
function switchTab(tab){if(busy){toast('강화가 끝나면 이동할 수 있어요.');return;}if(battle&&!battle.finished&&tab!=='hunt'){toast('전투에서 먼저 돌아와 주세요.');return;}
  activeTab=tab;document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id===tab));document.querySelectorAll('.nav').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-current',b.dataset.tab===tab?'page':'false');});render();window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{sound();switchTab(b.dataset.tab);});document.querySelector('.brand').onclick=e=>{e.preventDefault();switchTab('forge');};
$('protect').onchange=render;$('bless').onchange=render;
$('sound').onclick=()=>{state.sound=!state.sound;sound();save();render();};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function doEnhance(){
  if(busy||battle&&!battle.finished||state.level>=30||state.gold<cost(state.level)||$('modal').open)return;
  busy=true;const outcome=enhance(state,{protect:$('protect').checked,bless:$('bless').checked});if(!outcome.ok){busy=false;return;}save();
  $('mobile-enhance').disabled=true;
  $('stage').className='stage striking';$('stage-result').className='stage-result';$('enhance').disabled=true;$('sell').disabled=true;for(const id of ['protect','bless'])$(id).disabled=true;$('enhance').querySelector('span').textContent='⚒ 검을 두드리는 중…';
  sound('hammer');particles.burst();await sleep(450);sound('hammer');particles.burst();await sleep(450);busy=false;render();
  const success=outcome.result==='success';$('stage').className=`stage ${success?'success':outcome.result==='break'?'broken':''}`;
  const captions={success:['강화 성공','ENHANCEMENT SUCCESS'],protected:['검 보호 성공','PROTECTION ACTIVATED'],down:['강화 실패','THE FIRE TESTS YOU'],fail:['강화 실패','TRY ONCE MORE'],break:['검 파괴','FROM ASHES, AGAIN']};const [title,sub]=captions[outcome.result];$('stage-result').innerHTML=`<strong>${title}</strong><small>${sub}</small>`;$('stage-result').className=`stage-result show ${success?'':'bad'}`;sound(success?'success':outcome.result==='break'?'break':'fail');particles.burst();
  if(outcome.result==='break'){toast('새 철검과 보호 주문서 1장 지급. 실패 보너스는 유지됩니다.');setTimeout(()=>{$('stage').classList.remove('broken');},850);}
  if(success&&state.level%5===0)toast(`새로운 검 발견! +${state.level} ${sword(state.level).name}`);
  if(state.level===30){await sleep(1000);modal(`<p class="legend-stamp">THE LEGEND IS FORGED</p>${swordArt(30,'ending').replace('<svg ','<svg class="modal-sword" ')}<h2>창세의 검, 완성.</h2><p>낡은 철검을 별의 빛으로 벼려냈습니다.<br>${fmt(state.attempts)}번의 두드림 끝에 당신의 이름이 전설이 되었습니다. 도감과 여정 보상에서 이 순간을 간직하세요.</p><div class="dialog-actions"><button data-close>전설 이어가기</button></div>`);}
}
$('enhance').onclick=doEnhance;
$('mobile-enhance').onclick=doEnhance;
$('mobile-hunt').onclick=()=>switchTab('hunt');
document.addEventListener('keydown',e=>{if(e.code==='Space'&&activeTab==='forge'&&!$('modal').open&&!['INPUT','BUTTON','A'].includes(document.activeElement?.tagName)){e.preventDefault();if(!e.repeat)doEnhance();}});
$('sell').onclick=()=>{if(busy||state.level===0)return;modal(`<p class="eyebrow">THE PRICE OF YOUR CRAFT</p><h2>이 검을 판매할까요?</h2><p>+${state.level} ${sword(state.level).name}<br><strong>${fmt(sword(state.level).value)} G</strong>를 받고 새 +0 철검으로 시작합니다. 발견한 검과 최고 기록은 도감에 남아요.</p><div class="dialog-actions"><button data-close>더 강화하기</button><button id="confirm-action" class="confirm">판매하기</button></div>`,()=>{const earned=sell(state);sound('success');save();render();toast(`${fmt(earned)} G 획득! 새 철검을 준비했어요.`);});};
function renderHunt(){
  $('kills').textContent=fmt(state.kills);$('areas').hidden=Boolean(battle);$('battle').hidden=!battle;if(battle){renderBattle();return;}
  $('areas').innerHTML=AREAS.map((a,i)=>{const locked=state.level<a.require;return `<article class="area ${locked?'locked':''}" style="--area:${a.color}"><span class="area-number">REGION 0${i+1} ${locked?'· LOCKED':''}</span><div class="area-art">${monsterArt(a.icon,a.color)}</div><h2>${a.name}</h2><p>${a.enemy} · HP ${compact(a.hp)}</p><p>보상 ${compact(Math.round(a.reward*(1+state.forge*.25)))} G</p><button class="secondary" data-area="${i}" ${locked?'disabled':''}>${locked?`현재 검 +${a.require} 필요`:'사냥 시작하기 →'}</button></article>`;}).join('');
  document.querySelectorAll('[data-area]').forEach(b=>b.onclick=()=>{battle=encounter(state,Number(b.dataset.area));lastAttack=0;renderHunt();sound();$('battle').scrollIntoView({block:'nearest'});});
}
function renderBattle(message='',damage=0){
  const a=AREAS[battle.index],charged=battle.turn>0&&battle.turn%3===0;
  $('battle').innerHTML=`<div class="battle-heading"><div><p class="eyebrow">${a.name}</p><h2>${a.enemy}</h2></div><button class="secondary back-hunt" id="leave-battle">${battle.finished?'사냥터로':'돌아가기'}</button></div><div class="battle-hp enemy-hp"><div><span>몬스터 체력</span><span>${fmt(battle.hp)} / ${fmt(battle.maxHp)}</span></div><div class="hp-track"><i style="width:${battle.hp/battle.maxHp*100}%"></i></div></div><div class="battle-arena ${damage?'hit':''}">${monsterArt(a.icon,a.color)}${damage?`<div class="damage">${fmt(damage)}</div>`:''}</div><div class="battle-hp"><div><span>나의 체력</span><span>${battle.playerHp} / 100</span></div><div class="hp-track"><i style="width:${battle.playerHp}%"></i></div></div><div class="battle-actions"><button data-battle="attack" ${battle.finished?'disabled':''}>⚔ 베기</button><button data-battle="skill" ${!charged||battle.finished?'disabled':''}>✦ ${charged?'필살기 · 2.7배':`필살기 ${battle.turn%3} / 3`}</button><button data-battle="potion" ${!battle.potion||battle.finished||battle.playerHp===100?'disabled':''}>♜ 회복 +45 (${battle.potion})</button></div><p class="battle-message" role="status" aria-live="polite">${message||'베기로 힘을 모아 세 번마다 필살기를 사용하세요.'}</p>`;
  $('leave-battle').onclick=()=>{battle=null;renderHunt();};document.querySelectorAll('[data-battle]').forEach(b=>b.onclick=()=>fight(b.dataset.battle));
}
function fight(action){
  if(performance.now()-lastAttack<300)return;const result=attack(state,battle,action);if(!result.ok)return;lastAttack=performance.now();
  let message=result.healed?'회복 물약! 체력 +45':`${result.critical?'치명타! ':''}${fmt(result.damage)} 피해 · 반격 ${result.retaliation||0}`;
  if(result.win){message=`사냥 성공! ${fmt(result.gold)} G 획득${result.scroll?' · 축복 주문서 +1':''}`;sound('win');save();$('gold').textContent=fmt(state.gold);}
  else if(result.lose){message='잠시 후퇴합니다. 검과 골드는 안전해요. 다시 도전하세요.';sound('fail');}else sound(result.healed?'success':'attack');
  renderBattle(message,result.damage||0);
}
function renderCollection(){
  $('collection-count').textContent=`${state.found.length} / 31`;$('filters').innerHTML=[{name:'전체',index:-1},...TIERS.map((t,i)=>({name:t.name,index:i}))].map(t=>`<button class="${filter===t.index?'active':''}" data-filter="${t.index}">${t.name}</button>`).join('');
  $('collection-grid').innerHTML=Array.from({length:31},(_,i)=>sword(i)).filter(s=>filter===-1||Math.min(5,Math.floor(s.level/5))===filter).map(s=>{const found=state.found.includes(s.level);return `<article class="sword-card ${found?'':'locked'}" style="--sword:${s.color}"><span>+${s.level}</span>${swordArt(s.level,`codex${s.level}`)}<small>${s.label}</small><h3>${found?s.name:'미발견'}</h3><p>${found?`공격력 ${fmt(s.power)}`:`+${s.level} 강화 시 발견`}</p></article>`;}).join('');
  document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=Number(b.dataset.filter);renderCollection();sound();});
}
function renderShop(){
  const items=[{id:'protect',icon:'♜',name:'보호 주문서',text:'이번 강화에서 검 파괴와 단계 하락을 막아줍니다. 성공해도 1장이 소모돼요.',price:1200,stock:`${state.protect}장 보유`},{id:'bless',icon:'✧',name:'축복 주문서',text:'이번 강화 성공 확률 +15%p. 실패 보너스, 행운의 모루와 함께 적용됩니다.',price:900,stock:`${state.bless}장 보유`},{id:'luck',icon:'⚒',name:'행운의 모루',text:'영구적으로 강화 성공 확률 +2%p. 최대 5단계까지 성장합니다.',price:upgradeCost(state,'luck'),stock:`Lv. ${state.luck} / 5 · 현재 +${state.luck*2}%p`},{id:'forge',icon:'◇',name:'사냥꾼의 계약',text:'영구적으로 모든 사냥 골드 보상 +25%. 최대 5단계까지 성장합니다.',price:upgradeCost(state,'forge'),stock:`Lv. ${state.forge} / 5 · 현재 +${state.forge*25}%`}];
  $('shop-grid').innerHTML=items.map(it=>{const max=['luck','forge'].includes(it.id)&&state[it.id]>=5;return `<article class="shop-card"><span class="shop-icon">${it.icon}</span><h2>${it.name}</h2><span class="stock">${it.stock}</span><p>${it.text}</p><button class="secondary" data-buy="${it.id}" ${max||state.gold<it.price?'disabled':''}><span>${max?'최대 단계':it.id==='luck'||it.id==='forge'?'공방 성장시키기':'주문서 구매하기'}</span><strong>${max?'MAX':`${fmt(it.price)} G`}</strong></button></article>`;}).join('');
  $('missions').innerHTML=MISSIONS.map(m=>{const done=state.claimed.includes(m.id),ready=state[m.field]>=m.goal;return `<article class="mission"><span>${done?'✓':'✦'}</span><div><h3>${m.name}</h3><p>${m.text} · ${Math.min(m.goal,state[m.field])}/${m.goal}</p><small>${fmt(m.gold)} G + 보호 ${m.scroll}장</small></div><button data-claim="${m.id}" ${done||!ready?'disabled':''}>${done?'수령 완료':ready?'보상 받기':'진행 중'}</button></article>`;}).join('');
  document.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{if(buy(state,b.dataset.buy)){save();render();sound('success');toast('구매 완료! 대장간의 준비가 더 든든해졌어요.');}});
  document.querySelectorAll('[data-claim]').forEach(b=>b.onclick=()=>{if(claim(state,b.dataset.claim)){save();render();sound('win');toast('여정 보상을 받았어요. 다음 전설에 도전하세요!');}});
}
$('quest-link').onclick=()=>{switchTab('shop');$('missions').scrollIntoView({block:'nearest',behavior:'smooth'});};
$('help').onclick=()=>modal(`<p class="eyebrow">WELCOME TO THE IMMORTAL FORGE</p><h2>당신의 검을 전설로.</h2><p><b>01 · 강화</b><br>골드를 사용해 +30 창세의 검에 도전하세요. 처음 3번은 반드시 성공합니다. +4부터 실패하면 한 단계 하락하고, +7부터 파괴될 수 있어요.</p><p><b>02 · 준비</b><br>보호 주문서는 하락·파괴를 막고, 축복 주문서는 성공 확률을 15%p 올립니다. 선택한 주문서는 성공 여부와 관계없이 1장 소모됩니다. 실패할 때마다 다음 확률 +8%p, 성공하면 초기화됩니다.</p><p><b>03 · 성장</b><br>강화한 검으로 사냥하거나 판매해 골드를 모으세요. 철검과 첫 사냥터는 언제나 무료입니다. 상점의 여정 보상도 챙겨주세요. 진행은 이 브라우저에 자동 저장됩니다.</p><div class="dialog-actions"><button data-close class="confirm">모루 앞에 서기</button></div>`);
window.addEventListener('pagehide',save);render();save();
