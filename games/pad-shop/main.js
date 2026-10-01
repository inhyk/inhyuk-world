import './style.css';
import { SAVE_KEY, TIERS, MODELS, PADS, padFor, CUSTOMERS, money, initial, restore, odds, modelOdds, hit, sell, skip, buy,
  MAX_REBIRTH, REBIRTH_COSTS, EGG_COST, PETS, PET_WEIGHT, HOUSES, padsPerCraft, luck, cleanNickname, rebirth, hatch, equipPet, nicknamePet, requestDelivery, deliver } from './core.mjs';
import { createWorld } from './world.mjs';

const $ = id => document.getElementById(id);
let state;
try { state = restore(localStorage.getItem(SAVE_KEY)); } catch { state = initial(); }
let world, audio, toastTimer, held = false, heldPointer = null, hitTimer = 0, tutorialStep = 0;
let craftGesture = null, discardSaleClick = false;
let shopFilter = 'all';
let outside = false, courier = 0, delivering = false, deliveryTimer = 0, nextDelivery = 25, hatching = false;
const percent = value => value.toLocaleString('ko-KR', { maximumSignificantDigits: 3 });
const petPercent = value => value.toLocaleString('ko-KR', { maximumSignificantDigits: 3 });
const nickname = () => state.nickname || '인혁이';
const compactMoney = value => value >= 1000000000000 ? `${(value / 1000000000000).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}조 원` : value >= 100000000 ? `${(value / 100000000).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}억 원` : money(value);
const greetings = ['“첫 패드, 사장님께 맡길게요!”', '“그림 그릴 때 쓰고 싶어요.”', '“멋진 여행을 기록할 거예요.”', '“친구에게 선물하고 싶어요.”', '“이 색깔, 정말 마음에 들어요!”', '“오늘도 좋은 작품 부탁해요.”', '“새로운 이야기를 담고 싶어요.”', '“사장님 솜씨를 듣고 왔어요.”'];
const tutorials = [
  ['작은 작업실의 사장님이 되어 볼까요?', '손님이 찾아오면 패드를 만들어 팔아요.\n첫 손님은 일반 패드를 기다리고 있어요.', '작업실 둘러보기'],
  ['두드릴수록, 패드가 완성돼요.', '가운데 작업대나 제작 버튼을 꾹 눌러 보세요.\nSpace 키로도 만들 수 있어요. 100%가 되면 완성!', '판매하는 방법은요?'],
  ['직접 만든 패드로 첫 수익을!', '판매 버튼이나 Enter 키로 손님에게 건네요.\n번 돈으로 곡괭이를 사면 더 좋은 패드를 만들 수 있어요.', '곡괭이도 알아볼래요'],
  [`${TIERS.length}가지 곡괭이, ${PADS.length}가지 패드!`, '기본·미니·프로 패드를 도감에 모아 보세요.\n높은 등급과 프로 모델은 아주 드물게 찾아와요.', '또 뭐가 있어요?'],
  ['알, 환생, 그리고 배달!', '알을 깨면 행운을 올려 주는 펫이 나와요.\n환생하면 패드를 한 번에 여러 개 만들어요.\n배달이 오면 M 키로 나가 지붕 색을 찾아 주세요!', '내 첫 패드 만들기'],
];
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); $('save-status').innerHTML = '<i></i> 작업 기록 자동 저장'; }
  catch { $('save-status').textContent = '이 브라우저에서는 저장할 수 없어요'; }
}
function toast(message) {
  $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2600);
}
function tone(frequency, duration = .12, type = 'sine', volume = .035) {
  if (!state.sound) return;
  try {
    audio ??= new AudioContext(); if (audio.state === 'suspended') audio.resume();
    const oscillator = audio.createOscillator(), gain = audio.createGain(), time = audio.currentTime;
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, time); oscillator.frequency.exponentialRampToValueAtTime(frequency * .7, time + duration);
    gain.gain.setValueAtTime(volume, time); gain.gain.exponentialRampToValueAtTime(.001, time + duration);
    oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(time + duration);
  } catch { /* Audio is optional; crafting works without an audio device. */ }
}
function chime() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, .23, 'sine', .045), i * 85)); }
function stop() { held = false; heldPointer = null; hitTimer = 0; }
function modalOpen() { return Boolean(document.querySelector('dialog[open]')); }
function openDialog(id) { stop(); $(id).showModal(); }
function hud() {
  const tier = TIERS[state.order.tier], tool = TIERS[state.equipped], pad = padFor(state.order), completed = state.order.progress >= pad.work;
  const count = padsPerCraft(state), pet = state.pet === null ? null : PETS[state.pet];
  const percent = Math.round(state.order.progress / pad.work * 100);
  $('money').textContent = compactMoney(state.money); $('money').title = money(state.money); $('sold').textContent = state.sold; $('found').textContent = state.models.filter(n => n > 0).length;
  $('found-total').textContent = `/ ${PADS.length}`;
  $('customer').textContent = `${CUSTOMERS[state.order.customer]} 손님`; $('avatar').textContent = CUSTOMERS[state.order.customer][0];
  $('avatar').style.background = ['#eadac1', '#d9e4c5', '#d5e0e9', '#ece1bd', '#e4d8e7', '#d7e2ce', '#ecd6c9', '#dde0ef'][state.order.customer];
  $('customer-message').textContent = greetings[state.order.customer];
  $('order-number').textContent = `NO. ${String(state.sold + state.skipped + 1).padStart(3, '0')}`;
  $('order-grade').textContent = `${tier.name} · ${MODELS[pad.model].name}`; $('order-grade').style.color = tier.color; $('order-name').textContent = pad.name;
  $('order-type').textContent = count > 1 ? `새로운 주문 · ${count}개 한꺼번에` : '새로운 주문';
  $('order-price').textContent = compactMoney(pad.price * count); $('order-price').title = money(pad.price * count);
  $('order-mini').style.borderColor = tier.color; $('order-mini').style.setProperty('--tier', tier.color); $('order-mini').dataset.model = pad.model;
  $('equipped-name').textContent = `${tool.name} 곡괭이`; $('power').textContent = `제작 힘 ${tool.power}`;
  $('buffs').textContent = `${pet ? `${pet.emoji} ${pet.name} 행운 ×${pet.luck}` : '펫 없음'} · 환생 ${state.rebirth}`; $('equipped-icon').style.color = tool.color;
  $('progress-label').textContent = `${percent}%`; $('progress-fill').style.width = `${percent}%`; $('progress-track').setAttribute('aria-valuenow', String(percent));
  $('craft-stage').textContent = completed ? '완성! 손님에게 건네 주세요.' : percent === 0 ? '패드 제작 준비' : percent < 40 ? '꼼꼼하게 회로를 만들어요' : percent < 80 ? '화면과 부품을 조립해요' : '마지막으로 반짝반짝 다듬어요';
  const locked = state.equipped < state.order.tier;
  $('craft-hint').textContent = locked ? `${tier.name} 이상의 곡괭이를 장착해 주세요.` : completed ? `${pad.name}${count > 1 ? ` ×${count}` : ''} · 판매 가격 ${compactMoney(pad.price * count)}` : '작업대나 제작 버튼을 꾹 눌러 주세요.';
  $('craft').hidden = completed; $('craft').disabled = locked || !world || outside; $('sell').hidden = !completed;
  $('skip').disabled = state.money < 100;
  $('skip').title = state.money < 100 ? '패드를 팔아 100원을 모으면 건너뛸 수 있어요.' : '100원을 내고 다음 손님을 받아요. 제작 진행은 초기화돼요.';
  $('scene-caption').textContent = completed ? '나만의 작은 작품이 완성되었어요!' : '손끝에서 시작되는 작은 작품';
  $('sound').setAttribute('aria-pressed', String(state.sound)); $('sound').setAttribute('aria-label', state.sound ? '소리 끄기' : '소리 켜기'); $('sound').style.opacity = state.sound ? '1' : '.45';
  const next = TIERS.findIndex((_, i) => !state.owned.includes(i));
  if (next >= 0) {
    $('goal-caption').textContent = '다음 작은 목표'; $('goal-text').textContent = `${TIERS[next].name} 곡괭이로 더 멋진 패드 만들기`;
    $('goal-money').textContent = `${compactMoney(state.money)} / ${compactMoney(TIERS[next].cost)}`;
    $('goal-fill').style.width = `${Math.min(100, state.money / TIERS[next].cost * 100)}%`;
  } else {
    $('goal-caption').textContent = `${TIERS.at(-1).name} 장인의 작업실`; $('goal-text').textContent = '모든 곡괭이 수집 완료! 패드 도감도 채워 보세요.';
    $('goal-money').textContent = `${state.models.filter(Boolean).length} / ${PADS.length}종`; $('goal-fill').style.width = `${state.models.filter(Boolean).length / PADS.length * 100}%`;
  }
  $('shop-dot').hidden = !TIERS.some((t, i) => !state.owned.includes(i) && state.money >= t.cost);
  $('shop-name').textContent = `${nickname()}의 작은 작업실`;
  $('eggs-icon').textContent = pet ? pet.emoji : '🥚'; $('egg-dot').hidden = state.pet !== null || state.money < EGG_COST;
  $('rebirth-count').textContent = `${state.rebirth}/${MAX_REBIRTH}`;
  $('rebirth-dot').hidden = state.rebirth >= MAX_REBIRTH || state.money < REBIRTH_COSTS[state.rebirth];
  const delivery = state.delivery && padFor(state.delivery);
  $('delivery-banner').hidden = !delivery || outside;
  if (delivery) $('delivery-info').textContent = `${delivery.name} · ${compactMoney(delivery.price)} · 눌러서 배달 나가기`;
  world?.sync(state);
}
function drawShop() {
  $('shop-money').textContent = compactMoney(state.money); $('shop-money').title = money(state.money);
  $('shop-owned').textContent = `${state.owned.length} / ${TIERS.length}종 보유`;
  const rates = odds(TIERS.length - 1, luck(state));
  $('rarity-note').textContent = `좋은 도구는 제작 가능한 등급과 힘을 높여요. 고급 ${percent(rates[1])}% · 에픽 ${percent(rates[2])}% · 레전더리 ${percent(rates[3])}%, 더 높은 등급은 더욱 희귀해요.${luck(state) > 1 ? ` (펫 행운 ×${luck(state)} 적용)` : ''}`;
  document.querySelectorAll('[data-shop-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.shopFilter === shopFilter)));
  $('shop-list').innerHTML = TIERS.map((tier, i) => {
    if ((shopFilter === 'owned' && !state.owned.includes(i)) || (shopFilter === 'new' && i < 15)) return '';
    const equipped = state.equipped === i, owned = state.owned.includes(i), affordable = state.money >= tier.cost;
    return `<article class="shop-row" style="--tier:${tier.color}"><div class="pick-preview ${i >= 7 ? 'expanded-pick' : ''}"><svg><use href="#icon-pick"/></svg>${i >= 7 ? '<b>✦</b>' : ''}</div><div class="shop-tool-info"><h3>${tier.name} 곡괭이${i >= 15 ? '<small class="new-tag">NEW</small>' : ''}</h3><p>힘 ${tier.power.toLocaleString('ko-KR')} · ${tier.name} 이하 제작</p></div><button data-buy="${i}" title="${money(tier.cost)}" ${!owned && !affordable ? 'disabled' : ''} class="${equipped ? 'equipped-button' : ''}">${equipped ? '장착 중 ✓' : owned ? '장착하기' : compactMoney(tier.cost)}</button></article>`;
  }).join('');
}
function drawCollection() {
  const chance = odds(state.equipped, luck(state)), models = modelOdds(luck(state)), rates = odds(TIERS.length - 1, luck(state));
  $('odds-note').textContent = `고급 ${percent(rates[1])}% · 에픽 ${percent(rates[2])}% · 레전더리 ${percent(rates[3])}%. 더 높은 등급은 더욱 희귀해요. 모델 확률은 기본 ${percent(models[0])}% · 미니 ${percent(models[1])}% · 프로 ${percent(models[2])}%이고, 위 카드에는 등급과 모델을 함께 뽑을 확률이 표시돼요. 곡괭이를 사거나 손님을 건너뛰어도 확률은 올라가지 않지만, 행운 펫은 확률을 올려 줘요.`;
  const grade = $('grade-filter').value, model = $('model-filter').value;
  const pads = PADS.filter(p => (grade === 'all' || p.tier === Number(grade)) && (model === 'all' || p.model === Number(model)));
  $('collection-summary').textContent = `${state.models.filter(Boolean).length} / ${PADS.length}종 발견 · ${pads.length}종 표시`;
  $('collection-list').innerHTML = pads.map(pad => {
    const tier = TIERS[pad.tier], count = state.models[pad.id];
    return `<article data-pad="${pad.id}" class="collection-item ${count ? 'discovered' : ''}" style="--tier:${tier.color}"><header><div class="mini-pad" data-model="${pad.model}" style="border-color:${tier.color}"><i></i></div><span>${count ? `${count}개 판매` : '아직 미발견'}</span></header><span class="model-label">${tier.name} · ${MODELS[pad.model].name}</span><h3>${pad.name}</h3><strong title="${money(pad.price)}">${compactMoney(pad.price)}</strong><p>${pad.tier > state.equipped ? `${tier.name} 이상 곡괭이로 잠금 해제` : `제작량 ${pad.work.toLocaleString('ko-KR')} · 주문 확률 ${(chance[pad.tier] * models[pad.model] / 100).toLocaleString('ko-KR', { maximumFractionDigits: 12 })}%`}</p></article>`;
  }).join('');
}
function craftHit() {
  if (modalOpen() || !world || document.hidden || outside) return;
  const result = hit(state);
  if (!result.ok) { stop(); return; }
  world.impact(result.completed); tone(result.completed ? 620 : 140 + state.equipped * 25, result.completed ? .2 : .075, 'triangle');
  if (result.completed) { stop(); chime(); toast('패드 완성! 손님에게 팔아 볼까요?'); }
  hud(); save();
}
function sellPad() {
  if (modalOpen() || !world || outside) return;
  stop(); const result = sell(state);
  if (!result.ok) return;
  world.sale(); chime(); hud(); save(); toast(`${PADS[result.pad].name}${result.count > 1 ? ` ${result.count}개` : ''} 판매! +${compactMoney(result.price)}`);
}
// Delivery town: slot 0 is the workshop, slots 1-6 are the houses.
$('street').insertAdjacentHTML('beforeend', HOUSES.map((house, i) => `<button class="house" data-house="${i}" style="--roof:${house.color}" aria-label="${house.name} 지붕 집, ${i + 1}번지"><span class="roof"></span><span class="walls"></span><span class="plate">${i + 1}</span></button>`).join(''));
function drawTown() {
  $('courier').style.setProperty('--slot', courier);
  document.querySelectorAll('.house').forEach(h => h.classList.toggle('here', Number(h.dataset.house) === courier - 1));
  const delivery = state.delivery;
  $('courier').classList.toggle('empty', !delivery);
  if (delivery) {
    const house = HOUSES[delivery.house], pad = padFor(delivery);
    $('town').classList.remove('success');
    $('town-hint').innerHTML = `<i style="--roof:${house.color}"></i>${house.name} 지붕이에요!`;
    $('town-pad').textContent = `${pad.name} 배달 · 받으면 ${compactMoney(pad.price)}`;
  }
}
function goOut() {
  if (outside) return;
  if (!state.delivery) { toast('아직 배달 주문이 없어요. 조금만 기다려 주세요!'); return; }
  stop(); outside = true; courier = 0; delivering = false; $('courier').classList.remove('right');
  $('town').hidden = false; drawTown(); hud(); tone(520, .15); $('go-home').focus({ preventScroll: true });
}
function goHome() {
  if (!outside) return;
  outside = false; delivering = false; $('town').hidden = true; hud(); $('workbench').focus({ preventScroll: true });
}
function move(step) {
  if (delivering) return;
  const next = Math.max(0, Math.min(HOUSES.length, courier + step));
  if (next === courier) return;
  $('courier').classList.toggle('right', next > courier); courier = next; drawTown(); tone(300 + courier * 40, .06, 'triangle', .02);
}
function tryDeliver() {
  if (delivering || !state.delivery) return;
  if (courier === 0) { toast('집 앞까지 가서 배달해 주세요!'); return; }
  const house = document.querySelector(`[data-house="${courier - 1}"]`), result = deliver(state, courier - 1);
  if (!result.ok) {
    house.classList.remove('wrong'); void house.offsetWidth; house.classList.add('wrong'); tone(180, .2, 'square', .025);
    toast(`${result.reason} ${HOUSES[state.delivery.house].name} 지붕을 찾아 주세요!`); return;
  }
  delivering = true; house.classList.add('done'); chime(); save();
  $('courier').classList.add('empty'); $('town').classList.add('success');
  $('town-hint').textContent = '배달 완료! 고마워요!'; $('town-pad').textContent = `${PADS[result.pad].name} · +${compactMoney(result.price)}`;
  toast(`배달 완료! +${compactMoney(result.price)}`); nextDelivery = 40 + Math.random() * 30; deliveryTimer = 0;
  setTimeout(() => { house.classList.remove('done'); goHome(); }, 1500);
}
$('street').addEventListener('click', event => {
  const house = event.target.closest('[data-house]'); if (!house || delivering) return;
  const target = Number(house.dataset.house) + 1;
  if (target === courier) { tryDeliver(); return; }
  $('courier').classList.toggle('right', target > courier); courier = target; drawTown();
  delivering = true; setTimeout(() => { delivering = false; tryDeliver(); }, 400);
});
$('delivery-banner').addEventListener('click', goOut);
$('go-home').addEventListener('click', goHome);
function tickDelivery(dt) {
  if (state.delivery || outside || modalOpen() || !state.tutorial) return;
  deliveryTimer += dt;
  if (deliveryTimer < nextDelivery) return;
  deliveryTimer = 0;
  if (requestDelivery(state)) { save(); hud(); [660, 880].forEach((f, i) => setTimeout(() => tone(f, .16, 'sine', .04), i * 120)); toast('📦 배달 주문이 왔어요! M 키로 배달 나가기'); }
}
// Pets and eggs.
function drawEggs() {
  const pet = state.pet === null ? null : PETS[state.pet];
  $('hatch').textContent = `알 깨기 · ${money(EGG_COST)}`; $('hatch').disabled = hatching || state.money < EGG_COST;
  if (!hatching) $('egg-sub').textContent = pet ? `지금 ${pet.emoji} ${pet.name}와 함께 · 행운 ×${pet.luck}` : '아직 함께하는 펫이 없어요 · 행운 ×1';
  $('pet-list').innerHTML = PETS.map((p, i) => {
    const owned = state.pets[i], active = state.pet === i;
    return `<article class="pet-row ${owned ? '' : 'locked'}"><span class="pet-emoji">${p.emoji}</span><div><h3>${owned ? p.name : '???'}</h3><p><b>행운 ×${p.luck}</b> · 확률 ${petPercent(p.weight / PET_WEIGHT * 100)}%${owned ? ` · ${owned}마리` : ''}</p></div><button data-pet="${i}" ${owned ? '' : 'disabled'} class="${active ? 'equipped-button' : ''}">${active ? '함께하는 중 ✓' : owned ? '함께하기' : '미발견'}</button></article>`;
  }).join('');
}
$('eggs').addEventListener('click', () => { drawEggs(); openDialog('egg-dialog'); });
$('hatch').addEventListener('click', () => {
  if (hatching) return;
  const result = hatch(state);
  if (!result.ok) { toast(result.reason); return; }
  hatching = true; save(); hud(); drawEggs();
  const art = $('egg-art'); art.textContent = '🥚'; art.className = 'egg-art hatching'; $('egg-result').textContent = '알이 흔들려요…';
  [330, 390, 450].forEach((f, i) => setTimeout(() => tone(f, .08, 'triangle'), i * 180));
  setTimeout(() => {
    const pet = PETS[result.pet]; hatching = false;
    art.textContent = pet.emoji; art.className = 'egg-art born';
    $('egg-result').textContent = `${result.first ? '새 펫! ' : ''}${pet.name}가 나왔어요!`;
    chime(); drawEggs();
    if (!result.equipped) $('egg-sub').textContent = `지금 함께하는 펫이 더 행운이 좋아서 ${pet.name}는 도감에 쏙!`;
  }, 780);
});
$('pet-list').addEventListener('click', event => {
  const button = event.target.closest('[data-pet]'); if (!button) return;
  if (equipPet(state, Number(button.dataset.pet)).ok) { tone(620, .12); save(); hud(); drawEggs(); }
});
// Rebirth.
function drawRebirth() {
  const max = state.rebirth >= MAX_REBIRTH, cost = REBIRTH_COSTS[state.rebirth];
  $('rebirth-steps').innerHTML = Array.from({ length: MAX_REBIRTH }, (_, i) => `<i class="${i < state.rebirth ? 'done' : ''}">${i + 1}</i>`).join('');
  $('rebirth-title').textContent = max ? '최대 환생 완료!' : `${state.rebirth + 1}번째 환생`;
  $('rebirth-text').textContent = max ? `패드를 한 번에 ${padsPerCraft(state)}개씩 만들고 있어요. 더 높은 곡괭이와 도감에 도전해 보세요!`
    : `지금은 패드를 한 번에 ${padsPerCraft(state)}개 만들어요. 환생하면 ${padsPerCraft(state) + 1}개씩 만들어 팔 수 있어요! 대신 돈과 곡괭이는 처음으로 돌아가요. 도감·펫·닉네임은 그대로예요.`;
  $('rebirth-cost').textContent = max ? '—' : `${compactMoney(state.money)} / ${compactMoney(cost)}`;
  $('rebirth-fill').style.width = max ? '100%' : `${Math.min(100, state.money / cost * 100)}%`;
  $('confirm-rebirth').hidden = max; $('confirm-rebirth').disabled = max || state.money < cost;
  $('confirm-rebirth').textContent = max ? '' : `${compactMoney(cost)}으로 환생하기`;
}
$('rebirth').addEventListener('click', () => { drawRebirth(); openDialog('rebirth-dialog'); });
$('confirm-rebirth').addEventListener('click', () => {
  const result = rebirth(state);
  if (!result.ok) { toast(result.reason); return; }
  save(); hud(); $('rebirth-dialog').close();
  $('victory-title').textContent = `${result.rebirth}번째 환생 성공!`;
  $('victory-text').textContent = `이제 패드를 한 번에 ${result.count}개씩 만들어 팔아요. 돈과 곡괭이를 다시 모아 볼까요?`;
  openDialog('victory-dialog'); chime();
});
// Nickname sign.
function openName() {
  $('name-input').value = state.nickname; $('name-preview').textContent = `${cleanNickname(state.nickname) || '○○'}의 작은 작업실`;
  openDialog('name-dialog'); $('name-input').focus();
}
$('name-input').addEventListener('input', () => { $('name-preview').textContent = `${cleanNickname($('name-input').value) || '○○'}의 작은 작업실`; });
$('name-form').addEventListener('submit', event => {
  event.preventDefault();
  const name = cleanNickname($('name-input').value);
  if (!name) { toast('닉네임을 한 글자 이상 적어 주세요.'); $('name-input').focus(); return; }
  state.nickname = name; const pet = nicknamePet(state); save(); hud(); $('name-dialog').close(); chime();
  if (pet !== null) toast(`${PETS[pet].emoji} ${PETS[pet].name}와 함께 시작해요! 행운 ×${PETS[pet].luck}`);
  if (!state.tutorial) { tutorialStep = 0; drawTutorial(); openDialog('tutorial-dialog'); }
});
// A shop needs a name before it opens; Esc only closes the dialog when renaming.
$('name-dialog').addEventListener('cancel', event => { if (!state.nickname) event.preventDefault(); });
$('rename').addEventListener('click', openName);
function startHold(event) {
  if (event.button !== 0 || modalOpen() || !world) return;
  event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); heldPointer = event.pointerId; craftGesture = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId);
  held = true; hitTimer = 0; craftHit();
}
for (const element of [$('craft'), $('workbench')]) {
  element.addEventListener('pointerdown', startHold);
  element.addEventListener('pointerup', event => { if (event.pointerId === heldPointer) stop(); });
  element.addEventListener('pointercancel', stop); element.addEventListener('lostpointercapture', stop);
  element.addEventListener('contextmenu', event => event.preventDefault());
}
// Pointer crafting is handled on pointerdown; this covers assistive-technology clicks.
$('craft').addEventListener('click', event => { if (event.detail === 0) craftHit(); });
// Finishing a touch replaces the craft button with the sell button. Browsers
// can retarget that touch's compatibility click to Sell: require a fresh gesture.
addEventListener('pointerup', event => {
  if (event.pointerId === craftGesture) { discardSaleClick = true; craftGesture = null; }
}, true);
addEventListener('pointercancel', () => { craftGesture = null; });
$('sell').addEventListener('pointerdown', () => { discardSaleClick = false; });
$('sell').addEventListener('click', event => { if (event.detail === 0 || !discardSaleClick) sellPad(); });
$('skip').addEventListener('click', () => {
  stop(); const result = skip(state);
  if (!result.ok) { toast(result.reason); return; }
  tone(280); hud(); save(); toast('다음 손님이 오셨어요. −100원');
});
$('shop').addEventListener('click', () => { drawShop(); openDialog('shop-dialog'); });
$('collection').addEventListener('click', () => { drawCollection(); openDialog('collection-dialog'); });
$('grade-filter').innerHTML = '<option value="all">모든 등급</option>' + TIERS.map((t, i) => `<option value="${i}">${t.name}</option>`).join('');
for (const id of ['grade-filter', 'model-filter']) $(id).addEventListener('change', drawCollection);
document.querySelectorAll('[data-shop-filter]').forEach(b => b.addEventListener('click', () => { shopFilter = b.dataset.shopFilter; drawShop(); }));
$('shop-list').addEventListener('click', event => {
  const button = event.target.closest('[data-buy]'); if (!button) return;
  const tier = Number(button.dataset.buy), result = buy(state, tier);
  if (!result.ok) { toast(result.reason); return; }
  tone(660, .16); hud(); save(); drawShop();
  $('shop-list').querySelector(`[data-buy="${tier}"]`).focus();
  if (result.victory || result.mastery) {
    const top = TIERS.at(-1), topPad = PADS.at(-1);
    $('victory-title').textContent = result.mastery ? `${top.name} 장인이 되었어요!` : 'EX 장인이 되었어요!';
    $('victory-text').textContent = result.mastery ? `최강 곡괭이로 ${compactMoney(top.price)}짜리 ${top.name} 패드에 도전해 보세요. 프로 모델은 무려 ${compactMoney(topPad.price)}이에요!` : `1억 원짜리 EX 패드를 만들 수 있어요! 다음은 크리스탈부터 ${top.name}까지, ${TIERS.length - 7}가지 새로운 곡괭이에 도전해 보세요.`;
    $('shop-dialog').close(); openDialog('victory-dialog'); chime();
  }
});
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => { dialog.addEventListener('close', stop); dialog.addEventListener('cancel', stop); });
$('sound').addEventListener('click', () => { state.sound = !state.sound; hud(); save(); if (state.sound) tone(440); });
function drawTutorial() {
  const [title, text, button] = tutorials[tutorialStep];
  $('tutorial-title').textContent = title; $('tutorial-text').textContent = text; $('tutorial-next').textContent = button;
  $('tutorial-dots').innerHTML = tutorials.map((_, i) => `<i class="${i === tutorialStep ? 'active' : ''}"></i>`).join('');
}
function finishTutorial() { state.tutorial = true; save(); $('tutorial-dialog').close(); $('workbench').focus({ preventScroll: true }); }
$('help').addEventListener('click', () => { tutorialStep = 0; drawTutorial(); openDialog('tutorial-dialog'); });
$('tutorial-next').addEventListener('click', () => { if (tutorialStep === tutorials.length - 1) finishTutorial(); else { tutorialStep++; drawTutorial(); } });
$('tutorial-close').addEventListener('click', finishTutorial);
$('tutorial-dialog').addEventListener('cancel', () => { state.tutorial = true; save(); });
$('reset').addEventListener('click', () => openDialog('reset-dialog'));
$('cancel-reset').addEventListener('click', () => $('reset-dialog').close());
$('confirm-reset').addEventListener('click', () => {
  stop(); goHome(); const name = state.nickname; state = initial(); state.nickname = name; nicknamePet(state); save(); hud(); $('reset-dialog').close(); tutorialStep = 0; drawTutorial(); openDialog('tutorial-dialog');
});
addEventListener('keydown', event => {
  if (modalOpen() || event.ctrlKey || event.metaKey || event.altKey) return;
  if (outside) {
    const keys = { ArrowLeft: () => move(-1), KeyA: () => move(-1), ArrowRight: () => move(1), KeyD: () => move(1), Enter: tryDeliver, Space: tryDeliver, KeyM: goHome, Escape: goHome };
    if (keys[event.code] && !event.repeat) { event.preventDefault(); keys[event.code](); }
    return;
  }
  if (event.code === 'KeyM' && !event.repeat) { event.preventDefault(); goOut(); return; }
  if (event.code === 'Space' && (!event.target.closest('button, a') || event.target === $('craft'))) { event.preventDefault(); if (!event.repeat) { held = true; hitTimer = 0; craftHit(); } }
  if (event.code === 'Enter' && !event.repeat && (event.target === document.body || event.target === $('workbench') || event.target === $('craft') || event.target === $('sell'))) { event.preventDefault(); sellPad(); }
  if (event.code === 'KeyB' && !event.repeat) { event.preventDefault(); $('shop').click(); }
});
addEventListener('keyup', event => { if (event.code === 'Space') stop(); });
addEventListener('blur', () => { stop(); save(); });
addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) { stop(); save(); } });
try { world = createWorld($('workbench')); }
catch (error) { console.error(error); $('load-error').hidden = false; }
hud();
if (world) {
  let last = performance.now();
  world.loop(() => {
    const now = performance.now(), dt = Math.min((now - last) / 1000, .05); last = now;
    if (document.hidden) return;
    if (held && !modalOpen()) { hitTimer += dt; if (hitTimer >= .22) { hitTimer -= .22; craftHit(); } }
    tickDelivery(dt);
    world.render(dt);
  });
  if (!state.nickname) openName();
  else if (!state.tutorial) { drawTutorial(); openDialog('tutorial-dialog'); }
}
// Read-only diagnostics used by the browser smoke checks.
window.render_game_to_text = () => JSON.stringify({ ...state, held, outside, courier, pad: padFor(state.order), totalTools: TIERS.length, totalPads: PADS.length, world: world?.diagnostics() ?? { ready: false }, percent: Math.round(state.order.progress / padFor(state.order).work * 100) });
