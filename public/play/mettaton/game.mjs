import { createState, start, choose, strike, update, getPattern, DIFFICULTIES } from './core.mjs';
import { Renderer } from './render.mjs';
import { Soundtrack } from './audio.mjs';
import { PROGRESS_KEY, createProgress, neoUnlocked, canStartChallenge, recordVictory } from './progression.mjs';
const $ = id => document.getElementById(id);
const canvas = $('game'), renderer = new Renderer(canvas), audio = new Soundtrack();
let difficulty = 'normal', state = createState(), lastMode = '', selectedAction = 0, previousFocus = null, modalKind = '', lastFrame = 0;
let submenu = false, soundPreference = null, autoPaused = false;
canvas.tabIndex = -1;
const keys = new Set(), actionNames = ['fight','act','item','mercy'];
const actionButtons = [...document.querySelectorAll('[data-action]')];
function readStore(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function saveStore(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing still supports the whole game. */ } }
soundPreference = readStore('mtt-live-sound', null);
const progress = createProgress(readStore(PROGRESS_KEY, null));
// Earlier versions saved a score only after victory. Preserve an existing Encore clear.
const legacyEncore = readStore('mtt-live-best-hard', null);
if (Number.isFinite(legacyEncore?.ratings) && ['S+','S','A','B'].includes(legacyEncore?.rank)) {
  progress.clears.hard = true;
  saveStore(PROGRESS_KEY, progress);
}
function refreshChallenge() {
  const unlocked = neoUnlocked(progress), neo = difficulty === 'neo', config = DIFFICULTIES[difficulty];
  $('neo-button').disabled = !unlocked;
  $('neo-button').innerHTML = unlocked ? '✦ NEO <small>UNLOCKED</small>' : '<span class="neo-lock">▣</span> NEO <small>LOCKED</small>';
  $('neo-button').setAttribute('aria-label', unlocked ? '메타톤 NEO 도전' : '메타톤 NEO 잠김 · EX 앙코르 클리어 필요');
  $('neo-requirement').textContent = unlocked ? '✦ 메타톤 NEO 해금 완료 · 새로운 무대가 열렸어요' : '🔒 메타톤 NEO · EX 앙코르 클리어 시 해금';
  $('neo-requirement').classList.toggle('unlocked', unlocked);
  for (const b of document.querySelectorAll('[data-difficulty]')) {
    const selected = b.dataset.difficulty === difficulty;
    b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected));
  }
  const descriptions = { easy: '느린 탄막 · 넓은 틈', normal: '표준 탄막 · 균형 잡힌 무대', hard: '고속 탄막 · 좁은 틈', neo: '전용 패턴 4종 · 노란 영혼 슈팅' };
  $('difficulty-detail').textContent = `${descriptions[difficulty]} · HP ${config.hp} · 피격 −${config.damage}`;
  $('app').classList.toggle('neo-challenge', neo);
  $('lobby-title').innerHTML = neo ? 'POWER OF<br><span>NEO</span><i>Ω</i>' : 'DEATH BY<br><span>GLAMOUR</span><i>EX</i>';
  $('lobby-subtitle').textContent = neo ? '메타톤 NEO · 리미터 해제' : '메타톤 EX · 마지막 스포트라이트';
  $('lobby-description').innerHTML = neo ? '앙코르 너머, 진정한 마지막 무대.<br>날개를 펼친 NEO의 코어를 꿰뚫으세요.' : '심장은 뜨겁게. 무대는 화려하게.<br>지하 세계 최고의 스타를 상대할 준비가 됐나요?';
  $('character-label').querySelector('strong').innerHTML = `METTATON <i>${neo ? 'NEO' : 'EX'}</i>`;
  $('character-label').querySelector('small').textContent = neo ? '「 이제 내 진짜 힘을 보여주지! 」' : '「 오, YES! 시청자들이 기다리잖아! 」';
  $('lobby-bottom').innerHTML = neo ? '<span>01 <b>네 개의 필살기</b></span><span>02 <b>리미터 해제</b></span><span>03 <b>마지막 승부</b></span>' : '<span>01 <b>빛나는 탄막</b></span><span>02 <b>세 개의 스테이지</b></span><span>03 <b>당신만의 피날레</b></span>';
  updateBest();
}
function selectChallenge(value) {
  if (!canStartChallenge(progress, value)) return false;
  difficulty = value; state = createState(difficulty); lastMode = ''; refreshChallenge(); sync();
  return true;
}
function updateBest() {
  const best = readStore(`mtt-live-best-${difficulty}`, null);
  $('best-score').textContent = best ? `BEST ${best.ratings.toLocaleString()} · RANK ${best.rank}` : '당신의 첫 무대를 기다리고 있어요';
}
function setSoundButton() {
  $('sound-button').classList.toggle('sound-on', audio.enabled);
  $('sound-button').setAttribute('aria-label', audio.enabled ? '소리 끄기' : '소리 켜기');
  $('sound-button').title = `${audio.enabled ? '소리 끄기' : '소리 켜기'} (M)`;
}
async function toggleSound() {
  if (audio.enabled) audio.disable(); else await audio.enable();
  soundPreference = audio.enabled; saveStore('mtt-live-sound', soundPreference);setSoundButton();
}
function begin() {
  if (!canStartChallenge(progress, difficulty)) return;
  closeModal(); autoPaused = false; state = createState(difficulty); start(state); keys.clear(); lastMode = ''; submenu = false; selectedAction = 0;
  if (soundPreference !== false) audio.enable().then(setSoundButton);
  audio.phase = difficulty === 'neo' ? 3 : 1; audio.pause(false); sync(); canvas.focus();
}
function returnToTitle() {
  closeModal(); autoPaused = false; state = createState(difficulty); keys.clear(); lastMode = ''; submenu = false;
  audio.pause(true); refreshChallenge(); sync(); $('start-button').focus();
}
function button(label, action) {
  const b = document.createElement('button'); b.textContent = label; b.addEventListener('click', action); return b;
}
function openModal(kind, eyebrow, title, content, actions) {
  keys.clear(); previousFocus = document.activeElement; modalKind = kind;
  $('modal-eyebrow').textContent = eyebrow; $('modal-title').textContent = title;
  $('modal-content').innerHTML = content; $('modal-actions').replaceChildren(...actions);
  $('modal').hidden = false; $('modal').querySelector('button')?.focus();
}
function closeModal() {
  $('modal').hidden = true; modalKind = ''; keys.clear();
  if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
}
function pause() {
  if (state.mode === 'lobby' || state.mode === 'won' || state.mode === 'lost' || modalKind) return;
  state.paused = true; audio.pause(true);
  openModal('pause', 'INTERMISSION', '스포트라이트는 기다려요.', '<p>숨을 고르고, 다음 무대를 준비하세요.<br>당신의 의지는 아직 빛나고 있어요.</p>', [button('계속하기  ↗', resume), button('플레이 가이드', showGuide), button('타이틀로 돌아가기', returnToTitle)]);
}
function resume() { closeModal(); state.paused = false; audio.pause(false); }
function showGuide() {
  const wasPlaying = state.mode !== 'lobby' && !['won','lost'].includes(state.mode);
  if (wasPlaying) { state.paused = true; audio.pause(true); }
  openModal('guide', 'HOW TO STEAL THE SHOW', '무대에 오르기 전에', `
    <div class="guide-row"><strong>이동 / 정밀 이동</strong><span>방향키 또는 WASD · SHIFT로 천천히</span></div>
    <div class="guide-row"><strong>공격 / 발사</strong><span>Z · SPACE · ENTER로 선택<br>노란 영혼일 때 Z를 누르면 연속 발사</span></div>
    <div class="guide-row"><strong>♥ 빨간 영혼</strong><span>별과 레이저를 피하세요. 하트 중앙이 판정점!</span></div>
    <div class="guide-row"><strong class="color-blue">파란 탄막</strong><span>멈춰 있으면 안전해요.</span></div>
    <div class="guide-row"><strong class="color-orange">주황 탄막</strong><span>움직이는 동안 안전해요.</span></div>
    <div class="guide-row"><strong>행동 / 회복</strong><span>포즈로 시청률 UP · 춤추면 HP +6<br>스타 파르페 3개, HP +24</span></div>
    <div class="guide-row"><strong>두 가지 피날레</strong><span>공격으로 보스를 쓰러뜨리거나 시청률 목표 달성 후 자비!<br>EX 10,000 · NEO 18,000</span></div><div class="guide-row"><strong>NEO 해금</strong><span>EX를 앙코르 난이도로 클리어해야 해금됩니다.<br>리허설·라이브 승리로는 열리지 않아요.</span></div>
    <p>가까스로 피하면 GRAZE 보너스!<br>모바일에서는 아래 방향 패드와 발사 버튼을 사용하세요.</p>`,
    [button(wasPlaying ? '준비 완료 · 계속하기' : '좋아, 준비됐어!', () => { closeModal(); if (wasPlaying) { state.paused = false; audio.pause(false); } })]);
}
function result() {
  const won = state.mode === 'won', rank = !won ? '—' : state.hits === 0 ? 'S+' : state.hits <= 4 ? 'S' : state.hits <= 10 ? 'A' : 'B';
  let justUnlocked = false;
  if (won) {
    justUnlocked = recordVictory(progress, state);
    saveStore(PROGRESS_KEY, progress);
    refreshChallenge();
    const best = readStore(`mtt-live-best-${difficulty}`, null);
    if (!best || state.ratings > best.ratings) saveStore(`mtt-live-best-${difficulty}`, { ratings: state.ratings, rank });
  }
  audio.pause(true);
  const title = won && state.boss === 'neo' ? 'NEO를 넘어선 진짜 스타!' : won ? (state.ending === 'audience' ? '당신이 오늘 밤의 스타!' : '정말 멋진 피날레였어!') : '아직, 끝나지 않았어.';
  const quote = won && state.boss === 'neo' ? '「 내 모든 힘을 보여줬는데... 정말 대단하구나, 달링. 」' : won ? (state.ending === 'audience' ? '「 이 환호성... 들려? 모두 널 사랑하잖아, 달링. 」' : '「 내 무대를 이 정도로 빛내다니... 다음에 또 만나. 」') : '당신의 의지는 여전히 빛나고 있다.<br>리허설 난이도와 춤추기 회복도 활용해 보세요.';
  const minutes = Math.floor(state.elapsed/60), seconds = Math.floor(state.elapsed%60).toString().padStart(2,'0');
  openModal('result', won ? 'BROADCAST COMPLETE' : 'STAY DETERMINED', title, `
    ${won ? `<div class="result-rank">${rank}</div>` : '<div class="result-rank" style="font-size:55px;color:#ff429d">♥</div>'}
    <p>${quote}</p>${justUnlocked ? '<div class="neo-unlock"><strong>✦ METTATON NEO UNLOCKED</strong><span>앙코르 클리어! NEO의 무대가 열렸습니다.</span></div>' : ''}<div class="result-stats"><div><strong>${state.ratings.toLocaleString()}</strong>최종 시청률</div><div><strong>${state.perfects}</strong>무피격 라운드</div><div><strong>${minutes}:${seconds}</strong>플레이 시간</div></div>
    <p>${DIFFICULTIES[difficulty].label} · ${state.hits}회 피격 · ${state.grazes}회 아슬아슬 회피</p>`,
    [...(justUnlocked ? [button('메타톤 NEO 도전하기  ↗', () => { closeModal(); selectChallenge('neo'); begin(); })] : []), button(won ? '한 번 더! 다시 플레이  ↗' : '다시 도전하기  ↗', begin), button('타이틀로 돌아가기', returnToTitle)]);
}
function setSubmenu(open) {
  submenu = open; $('submenu').hidden = !open;
  if (open) {
    const entries = [['멋진 포즈','시청률 +950','pose'],['대담한 선언','무피격 보너스 +850','boast'],['춤추기','HP +6 · 시청률 +400','dance']];
    const buttons = entries.map(([label, note, action]) => {
      const b = button('', () => { setSubmenu(false); choose(state, action); sync(); });
      const title = document.createElement('span');title.textContent = label;
      const small = document.createElement('small');small.textContent = note;b.append(title, small);return b;
    });
    buttons.push(button('← 돌아가기', () => { setSubmenu(false); actionButtons[1].focus(); }));
    $('submenu').replaceChildren(...buttons);buttons[0].focus();
  }
}
function selectAction(action) {
  if (state.mode !== 'menu' || state.paused) return;
  if (action === 'act') { setSubmenu(!submenu); return; }
  setSubmenu(false);choose(state, action);sync();
}
function sync() {
  const lobby = state.mode === 'lobby';
  $('lobby').hidden = !lobby; $('character-label').hidden = !lobby; $('lobby-bottom').hidden = !lobby;
  $('battle-interface').hidden = lobby; $('stage').classList.toggle('in-battle', !lobby); $('app').classList.toggle('in-game', !lobby);
  if (lastMode !== state.mode) {
    if (state.mode !== 'menu') setSubmenu(false);
    for (const b of actionButtons) b.disabled = state.mode !== 'menu';
    $('strike-button').hidden = state.mode !== 'fight';
    if (state.mode === 'dodge') $('announcer').textContent = getPattern(state).hint;
    if (state.mode === 'won' || state.mode === 'lost') result();
    lastMode = state.mode;
  }
  actionButtons.forEach((b,i) => b.classList.toggle('active', state.mode === 'menu' && i === selectedAction));
  actionButtons[3].style.borderColor = state.ratings >= state.ratingGoal ? '#ffe58b' : '';
  $('phase-label').textContent = `${state.boss === 'neo' ? 'NEO / LIMITER OFF' : ['ACT 01 / SHOWTIME','ACT 02 / TURN IT UP','ACT 03 / THE GRAND FINALE'][state.phase-1]} · ${state.config.label}`;
  const hint = state.mode === 'dodge' ? getPattern(state).hint : state.mode === 'fight' ? '가운데 황금빛에 맞춰 공격하세요' : state.mode === 'menu' ? '← → 선택  ·  Z 확인  ·  행동으로 시청률을 높여보세요' : '';
  if ($('battle-hint').textContent !== hint) $('battle-hint').textContent = hint;
}
function activate() {
  if (modalKind) { const focused = document.activeElement; if (focused?.tagName === 'BUTTON') focused.click(); return; }
  if (state.mode === 'lobby') begin();
  else if (state.mode === 'fight') { strike(state); sync(); }
  else if (state.mode === 'menu') {
    if (submenu) document.activeElement?.click(); else selectAction(actionNames[selectedAction]);
  }
}
function onKeyDown(e) {
  if (['Enter','Space'].includes(e.code) && e.target.closest?.('button,a') && (modalKind || ['lobby','menu'].includes(state.mode))) return;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyZ','KeyX','Escape','Enter','ShiftLeft','ShiftRight','KeyW','KeyA','KeyS','KeyD'].includes(e.code)) e.preventDefault();
  if (e.code === 'Tab' && modalKind) {
    const buttons = [...$('modal').querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement);
    if (e.shiftKey && index <= 0) {e.preventDefault();buttons.at(-1)?.focus();}
    if (!e.shiftKey && index === buttons.length-1) {e.preventDefault();buttons[0]?.focus();}
    return;
  }
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === 'KeyM') { toggleSound(); return; }
  if (e.code === 'Escape' || e.code === 'KeyX') {
    if (modalKind === 'pause' || modalKind === 'guide') resume();
    else if (submenu) setSubmenu(false);
    else if (!modalKind) pause();
    return;
  }
  if (['KeyZ','Space','Enter'].includes(e.code)) { activate(); return; }
  if (state.mode === 'menu' && !modalKind) {
    if (submenu) {
      const buttons = [...$('submenu').querySelectorAll('button')];
      const current = buttons.indexOf(document.activeElement),delta = ['ArrowUp','KeyW'].includes(e.code)?-1:['ArrowDown','KeyS'].includes(e.code)?1:0;
      if (delta) buttons[(current+delta+buttons.length)%buttons.length].focus();
    } else {
      const delta = ['ArrowLeft','KeyA'].includes(e.code)?-1:['ArrowRight','KeyD'].includes(e.code)?1:0;
      if (delta) {selectedAction=(selectedAction+delta+4)%4;audio.effect('select');sync();actionButtons[selectedAction].focus();}
    }
  }
}
function input() {
  return { left:keys.has('ArrowLeft')||keys.has('KeyA'),right:keys.has('ArrowRight')||keys.has('KeyD'),up:keys.has('ArrowUp')||keys.has('KeyW'),down:keys.has('ArrowDown')||keys.has('KeyS'),focus:keys.has('Shift')||keys.has('ShiftLeft')||keys.has('ShiftRight'),shoot:keys.has('KeyZ')||keys.has('Space')||keys.has('Enter') };
}
function tick(dt) {
  update(state, dt, input());
  for(const event of state.events.splice(0)) {
    audio.effect(event);
    if(event==='dialogue')$('announcer').textContent=state.dialogue;
    if(event==='round')audio.phase=state.boss === 'neo' ? 3 : state.phase;
  }
  sync();renderer.draw(state);
}
function frame(time) {const dt=lastFrame?Math.min((time-lastFrame)/1000,.05):0;lastFrame=time;tick(dt);requestAnimationFrame(frame);}
$('start-button').addEventListener('click',begin);
$('pause-button').addEventListener('click',pause);
$('help-button').addEventListener('click',showGuide);
$('guide-link').addEventListener('click',showGuide);
$('sound-button').addEventListener('click',toggleSound);
$('strike-button').addEventListener('click',()=>{strike(state);sync();});
actionButtons.forEach((b,i)=>{b.addEventListener('click',()=>{selectedAction=i;selectAction(b.dataset.action);});});
for (const b of document.querySelectorAll('[data-difficulty]')) {
  b.addEventListener('click', () => { if (selectChallenge(b.dataset.difficulty)) audio.effect('select'); });
}
$('fullscreen-button').addEventListener('click',async()=>{
  try {
    if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();
  }catch{$('announcer').textContent='이 브라우저에서는 전체 화면을 사용할 수 없습니다.';}
});
if(!document.fullscreenEnabled){$('fullscreen-button').hidden=true;}
for(const b of document.querySelectorAll('[data-key]')) {
  b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);if(b.dataset.key==='KeyZ')activate();});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>keys.delete(b.dataset.key));
}
window.addEventListener('keydown',onKeyDown);
window.addEventListener('keyup',e=>keys.delete(e.code));
function pauseInBackground() {
  keys.clear();
  if (!modalKind && !state.paused && !['lobby','won','lost'].includes(state.mode)) {
    autoPaused = true;
    state.paused = true;
  }
  audio.pause(true);
}
function resumeFromBackground() {
  if (document.hidden) return;
  if (autoPaused) {
    autoPaused = false;
    state.paused = false;
    lastFrame = performance.now();
  }
  if (!state.paused && !['won','lost'].includes(state.mode)) audio.pause(false);
}
window.addEventListener('blur', pauseInBackground);
window.addEventListener('focus', resumeFromBackground);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseInBackground();
  else resumeFromBackground();
});
window.addEventListener('pagehide',()=>audio.dispose());
// Read-only state snapshot for accessibility tools and browser smoke tests.
window.render_game_to_text = () => JSON.stringify({ mode:state.mode,paused:state.paused,difficulty:state.difficulty,boss:state.boss,neoUnlocked:neoUnlocked(progress),ratingGoal:state.ratingGoal,turn:state.turn,phase:state.phase,hp:state.hp,maxHp:state.maxHp,bossHp:state.bossHp,ratings:state.ratings,items:state.items,pattern:getPattern(state).name,roundTime:Math.round(state.roundTime*10)/10,player:{x:Math.round(state.player.x),y:Math.round(state.player.y)},bullets:state.bullets.length,shots:state.shots.length,ending:state.ending,coordinates:'1120×680, origin top-left, +x right, +y down' });
refreshChallenge();setSoundButton();sync();requestAnimationFrame(frame);
