import { ARENA, ATTACKS, INTRO, FRIENDS, saveFriend, advanceIntro, createGame, startGame, chooseAction, confirmStrike, tick } from './core.mjs';
import { backgroundColor, drawAsriel, drawHyperGoner } from './presentation.mjs';
import { drawAura, drawChapter, drawMoment } from './effects.mjs';
import { BattleMusic } from './music.mjs';

const canvas = document.querySelector('#game');
const context = canvas.getContext('2d');
const state = createGame();
const keys = {};
const sources = new Map();
function refreshKeys() { for (const code of Object.keys(keys)) delete keys[code]; for (const code of sources.values()) keys[code] = true; }
const overlay = document.querySelector('#overlay');
const start = document.querySelector('#start');
const actions = [...document.querySelectorAll('[data-action]')];
const message = document.querySelector('#message');
const phase = document.querySelector('#phase');
const pause = document.querySelector('#pause');
const soundButton = document.querySelector('#sound');
const choices = document.querySelector('#choices');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const soundtrack = new BattleMusic();
let sound = false;
let audioContext;
let previousMode = '';
let previousMessage = '';
let previousHits = 0;
let audioMode = null, audioWave = -1;
let soundChosen = false;
let choiceIndex = 0;
let best = null;
try { best = JSON.parse(localStorage.getItem('asriel-last-starlight-best')); } catch {}
if (typeof best?.hits === 'number') document.querySelector('#record').textContent = '최고 기록 · 피격 ' + best.hits + '회';

function tone(frequency, duration = .1, volume = .035) {
  if (!sound || !audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'triangle'; oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
  oscillator.connect(gain); gain.connect(audioContext.destination);
  oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
}
soundButton.addEventListener('click', () => {
  soundChosen = true;
  sound = !sound;
  if (sound) {
    try { audioContext ??= new AudioContext(); audioContext.resume().catch(() => {}); }
    catch { sound = false; }
  }
  try { soundtrack.enable(sound); } catch { sound = false; }
  soundButton.textContent = sound ? '소리 ON' : '소리 OFF';
  soundButton.setAttribute('aria-pressed', String(sound));
  tone(523);
});
function label(text, x, y, size = 16, color = '#eeeaf8', align = 'center') {
  context.font = size + 'px Galmuri11, sans-serif'; context.textAlign = align;
  context.textBaseline = 'middle'; context.fillStyle = color; context.fillText(text, x, y);
}
function heart(x, y, scale = 2, color = '#ff4569') {
  const rows = ['01100110', '11111111', '11111111', '01111110', '00111100', '00011000'];
  context.fillStyle = color;
  rows.forEach((row, rowIndex) => [...row].forEach((pixel, column) => {
    if (pixel === '1') context.fillRect(x + (column - 4) * scale, y + (rowIndex - 3) * scale, scale, scale);
  }));
}
function boss(time) {
  const child = state.mode === 'won' || (state.round >= ATTACKS.length && state.savedFriends.length === FRIENDS.length);
  drawAsriel(context, { finalForm: state.round >= 5 && !child, child, time, transform: state.mode === 'transform' ? state.elapsed : null });
}
function drawBullet(bullet) {
  const warning = bullet.age < (bullet.delay || 0);
  context.save();
  context.globalAlpha = warning ? .45 : 1;
  if (bullet.kind === 'beam') {
    context.fillStyle = warning ? '#ffbe5760' : '#d6f7ff';
    context.fillRect(bullet.x - bullet.width / 2, ARENA.top, bullet.width, ARENA.bottom - ARENA.top);
    context.fillStyle = warning ? '#ffcb69' : '#fff';
    context.fillRect(bullet.x - 2, ARENA.top, 4, ARENA.bottom - ARENA.top);
    if (warning) label('!', bullet.x, ARENA.top + 15, 20, '#ffc26c');
  } else if (bullet.kind === 'saber' || bullet.kind === 'laser') {
    context.translate(bullet.x, bullet.y);
    if (warning && bullet.kind === 'saber') {
      context.beginPath(); context.moveTo(0, 0);
      context.arc(0, 0, bullet.length, bullet.startAngle, bullet.startAngle + bullet.direction * 1.45, bullet.direction < 0);
      context.closePath(); context.fillStyle = '#c88aff44'; context.fill();
    }
    context.rotate(bullet.angle);
    context.fillStyle = warning ? '#f5b25c' : bullet.kind === 'laser' ? '#e4ffff' : '#edc6ff';
    context.fillRect(0, warning ? -1 : -bullet.radius, bullet.length, warning ? 2 : bullet.radius * 2);
    if (!warning && bullet.kind === 'saber') {
      context.fillStyle = '#fff'; context.fillRect(20, -2, bullet.length - 30, 4);
      context.fillStyle = '#ac64e8'; context.fillRect(15, -22, 8, 44);
    }
  } else if (bullet.kind === 'meteor') {
    const speed = Math.hypot(bullet.vx, bullet.vy);
    context.strokeStyle = warning ? '#ffc670' : '#c8a7ff'; context.lineWidth = warning ? 2 : 5;
    context.setLineDash(warning ? [5, 7] : []);
    context.beginPath(); context.moveTo(bullet.x, bullet.y);
    context.lineTo(bullet.x + bullet.vx / speed * (warning ? 250 : -32), bullet.y + bullet.vy / speed * (warning ? 250 : -32)); context.stroke();
    if (!warning) { context.fillStyle = '#fff'; context.beginPath(); context.arc(bullet.x, bullet.y, 6, 0, Math.PI * 2); context.fill(); }
  } else if (bullet.kind === 'sword') {
    if (warning) {
      context.fillStyle = '#c89cff33'; context.fillRect(ARENA.left, bullet.y - 15, 490, 30);
      label(bullet.vx > 0 ? '→' : '←', bullet.vx > 0 ? 175 : 625, bullet.y, 22, '#e1b8ff');
    } else {
      context.fillStyle = '#f4d7ff'; context.fillRect(bullet.x - 22, bullet.y - 5, 44, 10);
      context.fillStyle = '#b06df0'; context.fillRect(bullet.x - Math.sign(bullet.vx) * 15, bullet.y - 14, 5, 28);
    }
  } else {
    context.translate(bullet.x, bullet.y);
    context.fillStyle = 'hsl(' + (bullet.hue || 190) + ' 95% 78%)';
    if (bullet.kind === 'orb') { context.beginPath(); context.arc(0, 0, 7, 0, Math.PI * 2); context.fill(); }
    else {
      context.rotate(bullet.age * 2); context.beginPath();
      for (let point = 0; point < 10; point++) {
        const radius = (point % 2 ? 3.5 : 9) * (bullet.big ? 2 : 1);
        context.lineTo(Math.cos(point * Math.PI / 5) * radius, Math.sin(point * Math.PI / 5) * radius);
      }
      context.closePath(); context.fill();
    }
  }
  context.restore();
}
function draw() {
  const visualTime = reducedMotion.matches ? 0 : state.time;
  context.fillStyle = '#090b14'; context.fillRect(0, 0, 800, 620);
  const rainbow = backgroundColor(state.musicTime, reducedMotion.matches);
  context.fillStyle = rainbow; context.globalAlpha = .32; context.fillRect(0, 0, 800, 560);
  context.globalAlpha = 1;
  if (state.musicTime >= 10) {
    context.save(); context.translate(400, 165); context.rotate(visualTime * .06);
    for (let ray = 0; ray < 20; ray++) {
      context.rotate(Math.PI / 10); context.beginPath(); context.moveTo(0, 0);
      context.lineTo(-55, -900); context.lineTo(55, -900); context.closePath();
      context.fillStyle = ray % 2 ? '#ffffff09' : '#00000012'; context.fill();
    }
    context.restore();
  }
  const halo = context.createRadialGradient(400, 170, 10, 400, 170, 330);
  halo.addColorStop(0, state.round >= 5 ? '#53366866' : '#2c365b66'); halo.addColorStop(1, '#090b1400');
  context.fillStyle = halo; context.fillRect(0, 0, 800, 620);
  for (let index = 0; index < 90; index++) {
    const horizontal = (Math.sin(index * 127.1) * 43758.5453) % 1;
    const x = Math.abs(horizontal) * 800;
    const y = (index * 73.7 + visualTime * (4 + index % 5)) % 600;
    context.globalAlpha = .15 + (Math.sin(visualTime + index) + 1) * .2;
    context.fillStyle = index % 3 ? '#e4e1ff' : '#c792ff'; context.fillRect(x, y, index % 7 ? 1 : 3, index % 7 ? 1 : 3);
  }
  context.globalAlpha = 1; drawAura(context, state, reducedMotion.matches); boss(visualTime);
  if (state.mode === 'dodge' && ATTACKS[state.round].kind === 'vortex') drawHyperGoner(context, visualTime, Math.min(1, state.elapsed / 2));
  if (state.mode === 'title') return;
  if (!(state.mode === 'dodge' && ATTACKS[state.round]?.kind === 'vortex')) {
  label(state.round >= ATTACKS.length ? '아스리엘' : '아스리엘 드리무르', 400, 300, 20);
  label(state.round >= ATTACKS.length ? '너의 목소리가, 마침내 닿았다.' : state.round >= 5 ? 'FINAL FORM / 최종 형태' : 'GOD OF HYPERDEATH / 절대신', 400, 328, 10, '#a7a2c4');
  }
  context.fillStyle = '#07080f'; context.fillRect(ARENA.left, ARENA.top, 490, 190);
  context.strokeStyle = state.guard ? '#a5e8dd' : '#d9cfed'; context.lineWidth = 2;
  context.strokeRect(ARENA.left, ARENA.top, 490, 190);
  if (state.mode === 'dodge') {
    context.save(); context.beginPath(); context.rect(ARENA.left, ARENA.top, 490, 190); context.clip();
    state.bullets.forEach(drawBullet);
    if (state.soul.invincible <= 0 || state.soul.invincible > 1 || Math.floor(state.time * 16) % 2) heart(state.soul.x, state.soul.y);
    context.restore();
    const progress = Math.min(1, state.elapsed / ATTACKS[state.round].duration);
    context.fillStyle = '#b4a2e5'; context.fillRect(ARENA.left, ARENA.bottom + 8, 490 * progress, 3);
  } else if (state.mode === 'intro') {
    label('* ' + INTRO[state.introLine], 400, 427, state.introLine === 0 ? 28 : 17);
    label('Z / ENTER / 화면을 눌러 계속', 400, 494, 12, '#b7a6ce');
  } else if (state.mode === 'strike') {
    label('빛을 중앙에 맞춰 Z', 400, 395, 17, '#e7cfa2');
    context.fillStyle = '#383044'; context.fillRect(210, 440, 380, 20);
    context.fillStyle = '#a8e3c1'; context.fillRect(385, 435, 30, 30);
    context.fillStyle = '#fff'; context.fillRect(210 + (state.elapsed % 1.4) / 1.4 * 380, 425, 4, 50);
  } else if (state.mode === 'warning') {
    label('다음 공격', 400, 410, 12, '#b09bcf');
    label(ATTACKS[state.round].name, 400, 447, 26);
    label(ATTACKS[state.round].hint, 400, 486, 12, '#9999b1');
  } else if (state.mode === 'transform') {
    label('이제, 내 진짜 힘을 보여 줄게.', 400, 435, 23, '#e5c9ff');
    label('최종 형태로 변신 중…', 400, 477, 13, '#ac9fcb');
  } else if (state.mode === 'act' || state.mode === 'friends') {
    label(state.mode === 'act' ? '* 행동' : '* 친구들의 기억을 되찾아 주자.', 400, 405, 21);
    label(state.mode === 'act' ? '희망: 피해 절반 · 꿈: HP 36 회복' : '구한 친구 ' + state.savedFriends.length + ' / 3', 400, 448, 16, '#cfc1e8');
    label('아래에서 선택 · ↑ ↓ 이동 · Z 확인 · X 돌아가기', 400, 492, 11, '#b3a6c5');
  } else if (state.mode === 'menu') {
    heart(200, 403, 2, '#ff527a');
    label(state.round >= ATTACKS.length ? '아스리엘이 더 이상 공격하지 않는다.' : '당신의 영혼은 아직 빛나고 있다.', 225, 403, 17, '#eeeaf8', 'left');
    label(state.round >= ATTACKS.length ? '구하기를 눌러 손을 내밀어 주세요.' : '싸우기 · 행동 · 꿈 중 행동을 선택하세요.', 400, 448, 15, '#b9b1cd');
    label('꿈 ' + state.dreams + '회 남음  /  희망: 이번 턴 피해 절반', 400, 488, 12, '#88849c');
  }
  drawChapter(context, state);
  label('FRISK', 155, 583, 16, '#e4dced', 'left');
  label('HP', 285, 583, 12, '#b2a3be');
  context.fillStyle = '#4c253d'; context.fillRect(310, 575, 160, 16);
  context.fillStyle = state.hp < 25 ? '#ff647f' : '#f0d477'; context.fillRect(310, 575, 160 * state.hp / state.maxHp, 16);
  label(state.hp + ' / ' + state.maxHp, 490, 583, 14, '#e6dbe9', 'left');
  label(Math.min(state.round + 1, ATTACKS.length) + ' / ' + ATTACKS.length, 645, 583, 13, '#aaa0bb', 'right');
  drawMoment(context, state, reducedMotion.matches);
}
function activate(action) { choiceIndex = 0; if (chooseAction(state, action)) tone(392); sync(); }
function confirm() {
  if (['title', 'dead', 'won'].includes(state.mode)) begin();
  else if (state.mode === 'intro') advanceIntro(state);
  else if (state.mode === 'act' || state.mode === 'friends') choices.querySelectorAll('button')[choiceIndex]?.click();
  else if (state.mode === 'paused') togglePause();
  else if (state.mode === 'strike') { confirmStrike(state); tone(659); }
  else if (state.mode === 'menu') activate(actions[state.selected].dataset.action);
}
function begin() {
  startGame(state); previousHits = 0; soundtrack.reset();
  if (!soundChosen) {
    try { sound = true; soundtrack.enable(true); audioContext ??= new AudioContext(); audioContext.resume().catch(() => {}); }
    catch { sound = false; }
    soundButton.textContent = sound ? '소리 ON' : '소리 OFF';
    soundButton.setAttribute('aria-pressed', String(sound));
  }
  canvas.focus(); sync();
}
function togglePause() {
  if (['title', 'dead', 'won'].includes(state.mode)) return;
  if (state.mode === 'paused') state.mode = state.resumeMode;
  else { state.resumeMode = state.mode; state.mode = 'paused'; }
  clearKeys(); sync();
}
function clearKeys() { sources.clear(); refreshKeys(); document.querySelectorAll('[data-key]').forEach(button => button.classList.remove('pressed')); }
function sync() {
  if (previousMessage !== state.message) { message.textContent = state.message; previousMessage = state.message; }
  phase.textContent = state.round >= ATTACKS.length ? 'SAVE ASRIEL' : state.mode === 'dodge' || state.mode === 'warning' ? ATTACKS[state.round].name : state.round >= 5 ? '02 / FINAL FORM' : '01 / ABSOLUTE GOD';
  actions.forEach((button, index) => { button.disabled = state.mode !== 'menu'; button.classList.toggle('selected', state.selected === index); });
  pause.disabled = ['title', 'dead', 'won'].includes(state.mode);
  pause.textContent = state.mode === 'paused' ? '계속하기' : '일시정지';
  if (previousMode === state.mode) return;
  choices.replaceChildren();
  choices.hidden = !['act', 'friends'].includes(state.mode);
  if (!choices.hidden) {
    const options = state.mode === 'act' ? [
      { label: '희망 · 이번 턴 피해 절반', run: () => { state.mode = 'menu'; activate('hope'); } },
      { label: '꿈 · HP 36 회복 (' + state.dreams + ')', run: () => { state.mode = 'menu'; activate('heal'); } },
    ] : FRIENDS.map((friend, index) => ({
      label: (state.savedFriends.includes(index) ? '✓ ' : '♥ ') + friend.name,
      disabled: state.savedFriends.includes(index),
      run: () => { saveFriend(state, index); sync(); },
    }));
    options.push({ label: '돌아가기', run: () => { state.mode = 'menu'; sync(); } });
    options.forEach(option => {
      const button = document.createElement('button'); button.textContent = option.label; button.disabled = !!option.disabled;
      button.addEventListener('click', option.run); choices.append(button);
    });
    choiceIndex = Math.max(0, options.findIndex(option => !option.disabled));
    choices.children[choiceIndex]?.classList.add('selected');
  }
  const end = ['dead', 'won', 'paused'].includes(state.mode);
  overlay.hidden = !end && state.mode !== 'title';
  if (end) {
    document.querySelector('#overlay-kicker').textContent = state.mode === 'won' ? 'YOU HELD ON TO HOPE' : state.mode === 'dead' ? 'STAY DETERMINED' : 'TAKE A BREATH';
    document.querySelector('#overlay-title').textContent = state.mode === 'won' ? '마지막 별빛은, 너였어.' : state.mode === 'dead' ? '결의를 잃지 마.' : '잠시 쉬어 가도 괜찮아.';
    document.querySelector('#overlay-copy').textContent = state.mode === 'won' ? '아스리엘: “…고마워. 날 포기하지 않아 줘서.”' : state.mode === 'dead' ? '희망으로 피해를 줄이고, 꿈으로 HP를 회복해 보세요.' : '모든 공격이 멈췄어요. 준비되면 계속하세요.';
    start.textContent = state.mode === 'paused' ? '계속하기 →' : '다시 도전 →';
    document.querySelector('#record').textContent = state.mode === 'won' ? '클리어 · 피격 ' + state.hits + '회' : '도달한 공격 ' + Math.min(state.round + 1, ATTACKS.length) + ' / ' + ATTACKS.length;
    if (state.mode === 'won' && (!best || typeof best.hits !== 'number' || state.hits < best.hits)) {
      best = { hits: state.hits };
      try { localStorage.setItem('asriel-last-starlight-best', JSON.stringify(best)); } catch {}
    }
  }
  previousMode = state.mode;
}
start.addEventListener('click', () => state.mode === 'paused' ? togglePause() : begin());
canvas.addEventListener('click', () => { if (state.mode === 'intro' || state.mode === 'strike') { confirm(); sync(); } });
pause.addEventListener('click', togglePause);
actions.forEach((button, index) => button.addEventListener('click', () => { state.selected = index; activate(button.dataset.action); }));
document.querySelector('#confirm').addEventListener('click', confirm);
// 키보드와 화면 방향 버튼이 같은 메뉴 명령을 사용한다.
function press(code) {
  const direction = ({ ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' })[code];
  if (code === 'Escape') togglePause();
  else if (code === 'KeyZ' || code === 'Enter') confirm();
  else if (state.mode === 'act' || state.mode === 'friends') {
    const buttons = [...choices.querySelectorAll('button')];
    if (code === 'KeyX') state.mode = 'menu';
    if (direction) {
      const delta = direction === 'up' || direction === 'left' ? -1 : 1;
      do { choiceIndex = (choiceIndex + delta + buttons.length) % buttons.length; } while (buttons[choiceIndex].disabled);
      buttons.forEach((button, index) => button.classList.toggle('selected', index === choiceIndex));
    }
  } else if (state.mode === 'menu') {
    if (direction === 'left' || direction === 'up') state.selected = (state.selected + 3) % 4;
    if (direction === 'right' || direction === 'down') state.selected = (state.selected + 1) % 4;
    if (code.startsWith('Digit')) { state.selected = Number(code.slice(-1)) - 1; activate(actions[state.selected].dataset.action); }
  }
  sync();
}
window.addEventListener('keydown', event => {
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyX', 'Enter', 'Escape', 'ShiftLeft', 'ShiftRight', 'Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(event.code)) return;
  if (event.code === 'Enter' && event.target instanceof HTMLButtonElement) return;
  event.preventDefault(); sources.set('key:' + event.code, event.code); refreshKeys();
  if (!event.repeat) press(event.code);
});
window.addEventListener('keyup', event => { sources.delete('key:' + event.code); refreshKeys(); });
document.querySelectorAll('[data-key]').forEach(button => {
  button.addEventListener('pointerdown', event => { event.preventDefault(); try { button.setPointerCapture(event.pointerId); } catch {} sources.set('touch:' + event.pointerId, button.dataset.key); refreshKeys(); button.classList.add('pressed'); canvas.focus({ preventScroll: true }); press(button.dataset.key); });
  const release = event => { sources.delete('touch:' + event.pointerId); refreshKeys(); if (!keys[button.dataset.key]) button.classList.remove('pressed'); };
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
});
window.addEventListener('blur', () => { clearKeys(); if (!['title', 'dead', 'won', 'paused'].includes(state.mode)) togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearKeys(); if (!['title', 'dead', 'won', 'paused'].includes(state.mode)) togglePause(); } });
window.__asriel = { state, tick, chooseAction, saveFriend, soundtrack };
window.render_game_to_text = () => JSON.stringify({ ...state, bullets: state.bullets.map(({ kind, x, y, age }) => ({ kind, x, y, age })), coordinates: '800x620; origin top-left; x right, y down' });
window.advanceTime = milliseconds => {
  for (let remaining = milliseconds / 1000; remaining > 0; remaining -= 1 / 60) tick(state, Math.min(remaining, 1 / 60), keys);
  sync(); draw();
};
let lastTime = performance.now();
function updateSound() {
  if (audioMode !== state.mode) {
    const cue = { transform: 'transform', memory: 'memory', refuse: 'refuse', salvation: 'save' }[state.mode];
    if (cue) soundtrack.effect(cue);
    audioMode = state.mode;
  }
  if (state.mode === 'dodge' && state.wave !== audioWave) {
    if (state.wave % 3 === 1) soundtrack.effect(({ stars: 'star', constellation: 'star', orbit: 'star', swords: 'sword', lightning: 'thunder', blaster: 'cannon', vortex: 'cannon', meteors: 'star', prism: 'cannon', final: 'star' })[ATTACKS[state.round].kind]);
    audioWave = state.wave;
  }
}
function frame(now) {
  const delta = Math.min((now - lastTime) / 1000, .04); lastTime = now;
  tick(state, delta, keys);
  if (state.hits !== previousHits) { tone(85, .16, .06); previousHits = state.hits; }
  updateSound();
  soundtrack.update(state.musicTime, !['title', 'paused', 'dead', 'won'].includes(state.mode));
  sync(); draw(); requestAnimationFrame(frame);
}
sync(); canvas.focus({ preventScroll: true }); requestAnimationFrame(frame);
