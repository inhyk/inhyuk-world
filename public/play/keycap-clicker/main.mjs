import { UPGRADES, COLLECTIONS, freshState, restoreState, currentKey, equippedKey, equip, press, buy, BOOSTS, boostEffects, clickIncome, boostPrice, buyBoost } from './core.mjs';
import { SOUND_PROFILES, playKeySound, playRewardSound } from './audio.mjs';
import { freshStreak, rewardPress, addBonus, COMBO_WINDOW } from './rewards.mjs';
import { MISSIONS, ACHIEVEMENTS, missionProgress, claimMission, claimAchievement, unlocked, metric, newBoss, bossDamage, hitBoss } from './progression.mjs';
const $ = id => document.getElementById(id);
const fmt = n => n >= 1000000 ? new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 }).format(n) : n.toLocaleString('ko-KR');
const SAVE = 'keycap-clicker-v1';
let boss = null;
let chapter = 0, streak = freshStreak(), coinValue = 0, coinTimer, bannerTimer;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let state = freshState(), storageOK = true, audio, audioOutput, toastTimer, pressTimer;
try { state = restoreState(JSON.parse(localStorage.getItem(SAVE))); } catch { storageOK = false; }
streak.fevers = state.stats.fevers;
chapter = Math.min(COLLECTIONS.length - 1, Math.floor(state.level / 10));
COLLECTIONS.forEach((c, i) => { const option = document.createElement('option'); option.value = i; option.textContent = `${String(i + 1).padStart(2, '0')} · ${c.name} (${i * 10 + 1}–${i * 10 + 10})`; $('chapter-select').append(option); });
$('chapter-select').value = chapter;
$('chapter-select').addEventListener('change', () => { chapter = Number($('chapter-select').value); render(); });
$('next-key').addEventListener('click', () => { chapter = Math.min(COLLECTIONS.length - 1, Math.floor(state.level / 10)); $('chapter-select').value = chapter; render(); });
function save() {
  try { localStorage.setItem(SAVE, JSON.stringify(state)); storageOK = true; } catch { storageOK = false; }
  $('save-status').textContent = storageOK ? '자동 저장' : '저장 불가 · 현재 창에서 플레이';
}
function notify(message) { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2300); }
function sound(upgrade = false, reward, combo = 0) {
  if (!state.sound) return;
  try {
    if (!audio) {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      const compressor = audio.createDynamicsCompressor();
      compressor.threshold.value = -14; compressor.knee.value = 12;
      compressor.ratio.value = 6; compressor.attack.value = .003; compressor.release.value = .08;
      audioOutput = audio.createGain(); audioOutput.gain.value = .65;
      audioOutput.connect(compressor).connect(audio.destination);
    }
    if (audio.state === 'suspended') void audio.resume();
    playKeySound(audio, audioOutput, state.equipped, upgrade);
    if (reward) playRewardSound(audio, audioOutput, reward, combo);
  } catch { /* Audio is optional; the game remains playable. */ }
}
function celebrateReward(amount, text) {
  sound(false, text.startsWith('BOSS') ? 'boss' : 'coin'); floatAmount(amount, 'jackpot'); burst(true); banner(text, 'bonus');
  render(false); save(); notify(`${text} +${fmt(amount)}원!`);
}
const missionButtons = MISSIONS.map(m => {
  const button = document.createElement('button'); button.className = 'mission-card'; button.dataset.mission = m.id;
  button.innerHTML = `<span class="mission-icon">${m.icon}</span><span><b>${m.name}</b><small class="mission-progress"></small></span><span class="mission-prize"></span>`;
  button.addEventListener('click', () => { const amount = claimMission(state, m.id); if (amount) celebrateReward(amount, 'MISSION CLEAR!'); });
  $('missions').append(button); return button;
});
const achievementButtons = ACHIEVEMENTS.map(a => {
  const button = document.createElement('button'); button.className = 'achievement'; button.dataset.achievement = a.id;
  button.innerHTML = `<span>${a.icon}</span><b>${a.name}</b><small></small>`;
  button.addEventListener('click', () => { const amount = claimAchievement(state, a.id); if (amount) celebrateReward(amount, 'ACHIEVEMENT GET!'); });
  $('achievement-list').append(button); return button;
});
$('achievements-open').addEventListener('click', () => $('achievements-dialog').showModal());
function renderProgression() {
  MISSIONS.forEach((m, i) => {
    const button = missionButtons[i], progress = missionProgress(state, m), ready = progress >= m.goal;
    button.disabled = !ready; button.classList.toggle('ready', ready);
    button.querySelector('.mission-progress').textContent = `${Math.min(progress, m.goal)} / ${m.goal}`;
    button.querySelector('.mission-prize').textContent = ready ? '보상 받기! ✦' : `+${fmt(clickIncome(state) * m.reward)}원`;
  });
  let count = 0, pending = 0;
  ACHIEVEMENTS.forEach((a, i) => {
    const ready = unlocked(state, a), claimed = state.claimedAchievements.includes(a.id), button = achievementButtons[i];
    if (ready) count++; if (ready && !claimed) pending++;
    button.disabled = !ready || claimed; button.classList.toggle('ready', ready && !claimed); button.classList.toggle('claimed', claimed);
    button.querySelector('small').textContent = claimed ? '✓ 보상 완료' : ready ? '보상 받기! ✦' : `${fmt(Math.min(metric(state, a.metric), a.goal))} / ${fmt(a.goal)}`;
  });
  $('achievement-count').textContent = `${count}/12`;
  $('achievements-open').classList.toggle('has-reward', pending > 0);
}
function renderBoss(now = performance.now()) {
  if (boss && !boss.defeated && now >= boss.until) { boss = null; notify('보스가 도망갔어요! 다음 보스에 다시 도전해요.'); }
  $('boss-card').hidden = !boss || boss.defeated;
  if (!boss || boss.defeated) return;
  $('boss-name').textContent = `👾 ${boss.rank}단계 보스 키캡`;
  $('boss-time').textContent = `${Math.ceil((boss.until - now) / 1000)}초`;
  $('boss-hp').style.width = `${boss.hp / boss.maxHp * 100}%`;
  const guarded = boss.hp <= boss.maxHp / 2;
  $('boss-card').classList.toggle('guarded', guarded);
  $('boss-description').textContent = guarded ? '🛡️ 갑옷 발동! 피해를 덜 받아요!' : '키캡을 눌러 공격! 반피부터 갑옷 발동!';
  $('boss-health').textContent = `HP ${boss.hp} / ${boss.maxHp} · 공격당 피해 ${bossDamage(boss, boostEffects(state).bossDamage)}`;
  $('boss-reward').textContent = `격파 보상 +${fmt(boss.reward)}원!`;
}
$('boss-hit').addEventListener('click', () => { if (boss && !boss.defeated && performance.now() < boss.until) clickKey(); });
const boostButtons = BOOSTS.map(b => {
  const button = document.createElement('button'); button.className = 'boost-card'; button.dataset.boost = b.id;
  button.innerHTML = `<span class="boost-icon">${b.icon}</span><b>${b.name}</b><span class="boost-level"></span><span class="boost-effect"></span><span class="boost-price"></span>`;
  button.addEventListener('click', () => {
    if (!buyBoost(state, b.id)) return;
    sound(true); burst(true); banner(`${b.icon} ${b.name} UP!`, 'unlock');
    render(); save(); notify(`${b.name} ${state.boosts[b.id]}단계! ${b.description}`);
  });
  $('boosts').append(button); return button;
});
function renderBoosts() {
  const effects = boostEffects(state);
  const values = { power: `수입 ×${effects.power}`, luck: `크리티컬 ${Math.round(effects.criticalChance * 100)}%`, battery: `피버 ${effects.feverDuration / 1000}초`, magnet: `코인 보상 ×${effects.coinMultiplier}`, hammer: `보스 공격력 ${effects.bossDamage}`, core: `${effects.feverCharge}클릭마다 피버` };
  BOOSTS.forEach((b, i) => {
    const button = boostButtons[i], level = state.boosts[b.id], price = boostPrice(state, b.id), maxed = level === b.max;
    button.disabled = maxed || state.money < price;
    button.classList.toggle('ready', !button.disabled); button.classList.toggle('maxed', maxed);
    button.querySelector('.boost-level').textContent = `LV. ${level} / ${b.max}`;
    button.querySelector('.boost-effect').textContent = values[b.id];
    button.querySelector('.boost-price').textContent = maxed ? '✦ MAX 완성!' : `${fmt(price)}원 · 강화 ↗`;
    button.title = b.description;
    button.setAttribute('aria-label', `${b.name}, ${level}단계, ${values[b.id]}, ${maxed ? '최대 강화 완료' : `다음 강화 ${fmt(price)}원, ${b.description}`}`);
  });
}
const buttons = UPGRADES.map((u, i) => {
  const button = document.createElement('button');
  button.className = 'upgrade'; button.style.setProperty('--swatch', u.color); button.style.setProperty('--mini-ink', u.ink);
  button.innerHTML = `<span class="mini-key">${u.symbol}</span><span><span class="upgrade-title">${String(i + 1).padStart(2, '0')} ${u.name}</span><span class="upgrade-sub">${i === UPGRADES.length - 1 ? '궁극의 키캡 · 최종 엔딩' : `한 번에 ${fmt(u.income)}원`}</span></span><span class="upgrade-price"></span>`;
  button.addEventListener('click', () => {
    if (i < state.level) { equip(state, i + 1); sound(); save(); render(); notify(`${u.name} 장착! 클릭 수입은 그대로예요.`); return; }
    if (!buy(state, i)) return;
    chapter = Math.min(COLLECTIONS.length - 1, Math.floor(state.level / 10)); $('chapter-select').value = chapter;
    sound(true); save(); render();
    burst(true); banner(`✦ ${u.name} GET!`, 'unlock');
    $('key').classList.add('unlocked'); setTimeout(() => $('key').classList.remove('unlocked'), 1500);
    notify(`${u.name} 완성! ${i === UPGRADES.length - 1 ? '모든 키캡을 모았어요 ✦' : `이제 한 번에 ${fmt(u.income)}원!`}`);
    if (state.level === UPGRADES.length) finish();
  });
  $('upgrades').append(button); return button;
});
function render(refreshCollection = true) {
  const key = equippedKey(state), next = UPGRADES[state.level];
  renderBoosts(); renderProgression(); renderBoss();
  $('money').textContent = fmt(state.money); $('income').textContent = `+${fmt(clickIncome(state))}원`; $('presses').textContent = fmt(state.presses);
  $('key-name').textContent = key.name; $('level').textContent = `NO. ${String(state.equipped).padStart(3, '0')}`; $('collection').textContent = `${state.level} / ${UPGRADES.length}`;
  $('key-info-hint').textContent = `${SOUND_PROFILES[state.equipped].label} · 클릭 / 터치 / 스페이스`;
  $('key-tag').textContent = `${String(state.equipped).padStart(3, '0')} — ${key.edition}`;
  $('key').dataset.finish = key.finish;
  document.documentElement.style.setProperty('--key', key.color); document.documentElement.style.setProperty('--key-ink', key.ink);
  $('key').querySelector('.key-corner').textContent = `K / ${String(state.equipped).padStart(3, '0')}`;
  $('key').querySelector('.key-symbol').textContent = key.symbol;
  $('key').setAttribute('aria-label', `키캡 누르기, ${fmt(clickIncome(state))}원 모으기`);
  $('sound').textContent = state.sound ? '소리 켜짐 ♪' : '소리 꺼짐'; $('sound').setAttribute('aria-pressed', String(state.sound));
  $('goal-label').textContent = next ? '다음 키캡까지' : '모든 키캡 완성!';
  $('goal-amount').textContent = next ? `${fmt(Math.min(state.money, next.price))} / ${fmt(next.price)}원` : `${UPGRADES.length} / ${UPGRADES.length}`;
  const progress = next ? Math.min(100, state.money / next.price * 100) : 100;
  $('goal-bar').style.width = `${progress}%`; document.querySelector('.track').setAttribute('aria-valuenow', String(Math.round(progress)));
  $('goal-hint').textContent = next ? state.money >= next.price ? `${next.name} 준비 완료! 업그레이드를 눌러주세요.` : `${fmt(next.price - state.money)}원 더 모으면 ${next.name}을 만나요.` : '100종 완성! 수집한 키캡을 골라 계속 즐겨보세요.';
  buttons.forEach((b, i) => {
    if (!refreshCollection && i !== state.level) return;
    const owned = i < state.level, current = i === state.level, ready = current && state.money >= UPGRADES[i].price;
    b.hidden = Math.floor(i / 10) !== chapter;
    b.disabled = !ready && !owned; b.className = `upgrade ${owned ? 'owned' : current ? ready ? 'current ready' : 'current' : 'future'}`;
    b.querySelector('.upgrade-price').innerHTML = owned ? state.equipped === i + 1 ? '✓ 장착 중' : '장착하기' : `${fmt(UPGRADES[i].price)}원<small>${ready ? '업그레이드 ↗' : current ? '모으는 중' : '순서대로 해금'}</small>`;
    b.setAttribute('aria-label', `${i + 1}단계 ${UPGRADES[i].name}, ${fmt(UPGRADES[i].price)}원, ${owned ? '수집 완료, 장착 가능' : ready ? '구매 가능' : current ? '돈을 더 모으세요' : '이전 단계 구매 필요'}`);
  });
}
function floatAmount(amount, special = '') {
  if ($('particles').children.length >= 50) return;
  const p = document.createElement('span'); p.className = `coin-pop ${special}`; p.textContent = `+${fmt(amount)}`;
  p.style.left = `${30 + Math.random() * 40}%`; p.style.setProperty('--dx', `${Math.random() * 100 - 50}px`); p.style.setProperty('--tilt', `${Math.random() * 18 - 9}deg`);
  $('particles').append(p); setTimeout(() => p.remove(), 850);
}
function burst(big = false) {
  if (reduceMotion || $('particles').children.length > 40) return;
  for (let i = 0; i < (big ? 14 : 6); i++) {
    const p = document.createElement('i'), angle = Math.random() * Math.PI * 2, radius = 65 + Math.random() * (big ? 100 : 45);
    p.className = 'hit-spark'; p.style.setProperty('--x', `${Math.cos(angle) * radius}px`); p.style.setProperty('--y', `${Math.sin(angle) * radius}px`);
    p.style.setProperty('--c', ['#f2b941', '#f19772', '#b4a0e9', '#85bd9b'][i % 4]);
    $('particles').append(p); setTimeout(() => p.remove(), 650);
  }
}
function banner(text, kind) {
  $('hit-banner').textContent = text; $('hit-banner').className = kind;
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { $('hit-banner').textContent = ''; }, 950);
}
function spawnCoin() {
  if (coinValue) return;
  coinValue = clickIncome(state) * boostEffects(state).coinMultiplier;
  $('bonus-value').textContent = `+${fmt(coinValue)}원`;
  $('bonus-coin').hidden = false;
  clearTimeout(coinTimer); coinTimer = setTimeout(hideCoin, 6000);
}
function hideCoin() { coinValue = 0; $('bonus-coin').hidden = true; clearTimeout(coinTimer); }
$('bonus-coin').addEventListener('click', () => {
  if (!coinValue || document.querySelector('dialog[open]')) return;
  const value = coinValue; hideCoin(); state.stats.coins++; addBonus(state, value); sound(false, 'coin');
  floatAmount(value, 'jackpot'); burst(true); banner('BONUS GET! ✦', 'bonus'); render(false); save();
});
function renderHype(now = performance.now()) {
  const fever = now < streak.feverUntil;
  if (now - streak.lastPress > COMBO_WINDOW) streak.combo = 0;
  document.body.classList.toggle('fever', fever);
  document.body.classList.toggle('super-fever', fever && streak.feverMultiplier === 5);
  const charge = boostEffects(state).feverCharge;
  $('combo-count').textContent = streak.combo;
  $('combo-tip').textContent = streak.combo ? `최고 ${streak.best}콤보 · 25콤보마다 보너스!` : '연속으로 톡톡 눌러봐!';
  $('fever-title').textContent = fever ? streak.feverMultiplier === 5 ? '🌈 SUPER ×5' : '🔥 FEVER ×3' : `FEVER ×3 · ${3 - state.stats.fevers % 3}회 후 슈퍼`;
  $('fever-count').textContent = fever ? `${Math.ceil((streak.feverUntil - now) / 1000)}초!` : `${streak.charge} / ${charge}`;
  const percent = fever ? (streak.feverUntil - now) / streak.feverDuration * 100 : streak.charge / charge * 100;
  $('fever-fill').style.width = `${percent}%`;
  document.querySelector('.fever-track').setAttribute('aria-valuemax', String(charge));
  document.querySelector('.fever-track').setAttribute('aria-valuenow', String(fever ? charge : streak.charge));
}
function clickKey() {
  if (document.querySelector('dialog[open]')) return;
  const hadBoss = Boolean(boss && !boss.defeated);
  const reward = rewardPress(streak, performance.now(), Math.random(), boostEffects(state));
  const amount = press(state, reward.multiplier);
  if (reward.critical) state.stats.criticals++;
  if (reward.startedFever) state.stats.fevers++;
  state.stats.bestCombo = Math.max(state.stats.bestCombo, reward.combo);
  let bossPrize = 0;
  if (boss && !boss.defeated) bossPrize = hitBoss(state, boss, performance.now(), boostEffects(state).bossDamage);
  if (state.presses % 75 === 0 && !hadBoss) {
    boss = newBoss(state, performance.now()); notify('👾 보스 키캡 등장! 18초 안에 격파해요! 반피부터 갑옷 발동!');
  }
  sound(false, reward.startedFever ? reward.superFever ? 'super' : 'fever' : reward.critical ? 'critical' : reward.milestone ? 'combo' : undefined, reward.combo);
  render(false); renderHype(); save();
  $('key').classList.add('pressed'); clearTimeout(pressTimer); pressTimer = setTimeout(() => $('key').classList.remove('pressed'), 95);
  floatAmount(amount, reward.critical ? 'critical' : reward.fever ? 'hot' : '');
  burst(reward.critical || reward.startedFever);
  if (reward.startedFever) { banner(reward.superFever ? 'SUPER FEVER! ×5' : 'FEVER TIME! ×3', reward.superFever ? 'super' : 'hot'); notify(`${reward.superFever ? '🌈 슈퍼 피버' : '🔥 피버'} ${streak.feverDuration / 1000}초! 모든 클릭 ${streak.feverMultiplier}배, 크리티컬 ${streak.feverMultiplier * 5}배!`); }
  else if (reward.critical) banner(`CRITICAL! ×${reward.multiplier}`, 'critical');
  else if (reward.milestone) banner(`${reward.combo} COMBO!`, 'combo');
  if (reward.bonusReady) spawnCoin();
  if (bossPrize) celebrateReward(bossPrize, 'BOSS BREAK! 👾');
  $('money').getAnimations().forEach(a => a.cancel());
  if (!reduceMotion) $('money').animate([{ transform: 'scale(1.08)', color: reward.critical ? '#d18a25' : '#4d6952' }, { transform: 'scale(1)', color: '#333c32' }], { duration: 180 });
}
setInterval(() => { renderHype(); renderBoss(); }, 100);
function finish() {
  $('end-presses').textContent = `${fmt(state.presses)}번`; $('end-earned').textContent = `${fmt(state.earned)}원`; $('ending').showModal();
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) for (let i = 0; i < 65; i++) {
    const c = document.createElement('i'); c.className = 'confetti'; c.style.left = `${Math.random() * 100}%`; c.style.setProperty('--c', ['#d3ad53', '#a8c394', '#e4ae99', '#bcb2d8'][i % 4]); c.style.setProperty('--duration', `${2 + Math.random() * 2}s`); c.style.setProperty('--drift', `${Math.random() * 240 - 120}px`); document.body.append(c); setTimeout(() => c.remove(), 4100);
  }
}
$('key').addEventListener('click', clickKey);
document.addEventListener('keydown', e => {
  if (e.code !== 'Space' || /^(BUTTON|INPUT|TEXTAREA|SELECT|A)$/.test(e.target.tagName) || e.target.isContentEditable || document.querySelector('dialog[open]')) return;
  e.preventDefault(); if (!e.repeat) clickKey();
});
$('sound').addEventListener('click', () => { state.sound = !state.sound; save(); render(); if (state.sound) sound(); });
$('help').addEventListener('click', () => $('help-dialog').showModal());
$('reset').addEventListener('click', () => $('reset-dialog').showModal());
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
$('confirm-reset').addEventListener('click', () => { const soundEnabled = state.sound; state = freshState(); state.sound = soundEnabled; streak = freshStreak(); boss = null; hideCoin(); $('particles').replaceChildren(); clearTimeout(bannerTimer); $('hit-banner').textContent = ''; renderHype(); chapter = 0; $('chapter-select').value = chapter; save(); render(); $('reset-dialog').close(); notify('새로운 키캡 이야기, 다시 시작!'); });
window.addEventListener('pagehide', save);
render(); renderHype(); save();
