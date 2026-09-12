import { createGame, startGame, updateGame, updateEffects, activateNova, snapshot, DIFFICULTIES, SECTORS } from './core.mjs';
import { createRenderer } from './render.mjs';
import { createAudio } from './audio.mjs';

const $ = id => document.getElementById(id);
const canvas = $('game');
const render = createRenderer(canvas);
const sound = createAudio();
const keys = new Set();
const storage = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Play remains available when storage is blocked. */ } },
};
const storedRecords = storage.get('orbit-breaker.records.v2', {});
const records = {};
for (const key of Object.keys(DIFFICULTIES).flatMap(difficulty => [`${difficulty}:1`, `${difficulty}:2`])) {
  const score = storedRecords?.[key];
  records[key] = Number.isFinite(score) && score >= 0 ? Math.floor(score) : 0;
}
let selectedDifficulty = storage.get('orbit-breaker.difficulty', 'normal');
if (!DIFFICULTIES[selectedDifficulty]) selectedDifficulty = 'normal';
let selectedPlayers = storage.get('orbit-breaker.players', 1) === 2 ? 2 : 1;
const recordKey = () => `${selectedDifficulty}:${selectedPlayers}`;
let soundEnabled = storage.get('orbit-breaker.sound', false) === true;
let game;
let healthKey = '', lastMode = '', lastHud = '', previousTime = 0, accumulator = 0;
const pointers = new Map();
const drags = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
const sectorNames = ['OUTER ORBIT', 'ASTEROID BELT', 'RED NEBULA', 'OUTPOST', 'SENTINEL GATE', 'GHOST ROUTE', 'GRAVITY STORM', 'ABYSS FLEET', 'LAST DEFENSE', 'ECLIPSE CORE'];
const pad = value => String(value).padStart(6, '0');
const flightTime = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

function clearInput() { keys.clear(); pointers.clear(); for (const drag of drags) { drag.x = 0; drag.y = 0; } accumulator = 0; }
function updateSound() {
  $('sound-button').textContent = soundEnabled ? '소리 ON' : '소리 OFF';
  $('sound-button').setAttribute('aria-label', soundEnabled ? '소리 끄기' : '소리 켜기');
  $('sound-button').setAttribute('aria-pressed', String(soundEnabled));
}
function updateDifficulty() {
  for (const button of document.querySelectorAll('[data-difficulty]')) {
    const selected = button.dataset.difficulty === selectedDifficulty;
    button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
  }
  const config = DIFFICULTIES[selectedDifficulty];
  $('difficulty-description').textContent = `체력 ${config.hp} · ${selectedDifficulty === 'easy' ? '느린 탄막' : selectedDifficulty === 'hard' ? '빠른 탄막' : '기본 난이도'}`;
  $('best-label').textContent = `${config.label} · ${selectedPlayers}인 최고 기록`;
  $('best-score').textContent = pad(records[recordKey()]);
  for (const button of document.querySelectorAll('[data-players]')) {
    const selected = Number(button.dataset.players) === selectedPlayers;
    button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
  }
  const coop = selectedPlayers === 2;
  document.querySelector('.app').classList.toggle('coop', coop);
  for (const id of ['p2-hull', 'p2-weapon', 'nova2-button', 'coop-guide']) $(id).hidden = !coop;
  $('footer-controls').innerHTML = coop
    ? '<kbd>WASD</kbd><span>1P 이동</span><kbd>X</kbd><span>노바</span><kbd>↑↓←→</kbd><span>2P 이동</span><kbd>ENTER</kbd><span>노바</span>'
    : '<kbd>WASD / ↑↓←→</kbd><span>이동</span><kbd>SPACE</kbd><span>발사</span><kbd>X</kbd><span>노바</span><kbd>ESC</kbd><span>일시정지</span>';
}
function reset() {
  clearInput();
  const mobile = matchMedia('(max-width: 600px)').matches;
  const stage = $('stage').getBoundingClientRect();
  game = createGame({ difficulty: selectedDifficulty, playerCount: selectedPlayers, width: mobile ? 540 : Math.round(680 * stage.width / stage.height), height: mobile ? 720 : 680 });
  healthKey = ''; lastHud = ''; lastMode = 'ready';
  $('overlay').hidden = false; $('menu').hidden = false; $('result').hidden = true;
  $('dialog').close();
  updateDifficulty(); updateHud();
}
function launch() {
  if (game.mode !== 'ready' || $('dialog').open) return;
  clearInput(); sound.setEnabled(soundEnabled); sound.unlock();
  startGame(game); lastMode = game.mode;
  $('overlay').hidden = true;
  canvas.focus({ preventScroll: true }); updateHud();
}
function openDialog(help = false) {
  if ($('dialog').open) return;
  if (game.mode === 'playing') game.mode = 'paused';
  clearInput();
  $('dialog-title').textContent = help ? '비행 준비, 완료?' : '잠시 숨 고르기.';
  $('dialog-description').textContent = help ? '총 10웨이브! 5웨이브 중간 보스와 10웨이브 최종 보스에 도전하세요.' : '준비되면 다시 궤도로 돌아가세요.';
  $('resume-button').innerHTML = `${game.mode === 'paused' ? '계속하기' : '준비됐어요'} <span>↗</span>`;
  $('quit-button').hidden = game.mode !== 'paused';
  $('dialog').showModal(); updateHud();
}
function closeDialog() {
  $('dialog').close(); clearInput();
  if (game.mode === 'paused') game.mode = 'playing';
  if (game.mode === 'playing') canvas.focus({ preventScroll: true });
  updateHud();
}
function togglePause() {
  if ($('dialog').open) closeDialog();
  else if (game.mode === 'playing') openDialog();
}
function finish() {
  clearInput();
  const key = recordKey();
  const previousBest = records[key];
  records[key] = Math.max(previousBest, game.score);
  storage.set('orbit-breaker.records.v2', records);
  $('overlay').hidden = false; $('menu').hidden = true; $('result').hidden = false;
  $('result-title').innerHTML = game.mode === 'won' ? 'MISSION<br>COMPLETE.' : 'SIGNAL<br>LOST.';
  $('result-eyebrow').textContent = game.score > previousBest ? 'NEW PERSONAL BEST / 새로운 최고 기록' : 'FLIGHT REPORT / 비행 기록';
  $('result-description').textContent = game.mode === 'won' ? '이클립스가 침묵했다. 이제 이 궤도는 너의 것이다.' : `${game.wave}구역에서 통신이 끊겼습니다. 다음 비행은 더 멀리.`;
  $('result-score').textContent = game.score.toLocaleString('ko-KR');
  $('result-best').textContent = records[key].toLocaleString('ko-KR');
  $('result-flight').textContent = `${game.kills} / ${flightTime(game.time)}`;
  $('best-score').textContent = pad(records[key]);
  $('restart-button').focus({ preventScroll: true });
}

function updateHud() {
  const p = game.player;
  const playing = game.mode === 'playing';
  const hudKey = [game.score, game.wave, ...game.players.flatMap(p => [p.hp, p.level, p.novas]), game.mode].join('/');
  if (hudKey !== lastHud) {
    $('score').textContent = pad(game.score);
    $('sector').innerHTML = `${String(game.wave || 1).padStart(2, '0')} <span>/ 10</span>`;
    $('weapon-name').textContent = ['싱글 캐논', '듀얼 캐논', '트리플 캐논'][p.level - 1];
    $('weapon-level').textContent = `LV. 0${p.level}`;
    $('nova-count').textContent = String(p.novas);
    $('nova-button').disabled = !playing || p.hp <= 0 || p.novas === 0;
    const p2 = game.players[1];
    if (p2) {
      $('weapon2-name').textContent = p2.hp <= 0 ? '복귀 대기' : ['싱글 캐논', '듀얼 캐논', '트리플 캐논'][p2.level - 1];
      $('weapon2-level').textContent = `LV. 0${p2.level}`;
      $('nova2-count').textContent = String(p2.novas);
      $('nova2-button').disabled = !playing || p2.hp <= 0 || p2.novas === 0;
    }
    if (p.hp <= 0) $('weapon-name').textContent = '복귀 대기';
    $('pause-button').disabled = !playing && game.mode !== 'paused';
    $('pause-button').setAttribute('aria-label', game.mode === 'paused' ? '계속하기' : '일시정지');
    $('sector-tag').innerHTML = `<span class="live-dot"></span> ${sectorNames[Math.max(0, game.wave - 1)]} <span>001.048 / 092.017</span>`;
    document.querySelectorAll('#mission-route li').forEach((li, index) => {
      li.classList.toggle('active', index === Math.max(0, game.wave - 1));
      li.classList.toggle('done', index < game.wave - 1 || game.mode === 'won');
    });
    lastHud = hudKey;
  }
  const nextHealth = game.players.map(p => `${p.hp}/${p.maxHp}`).join(':');
  if (healthKey !== nextHealth) {
    for (const pilot of game.players) {
      const label = $(pilot.id === 0 ? 'hp-label' : 'hp2-label');
      const bar = $(pilot.id === 0 ? 'health' : 'health2');
      label.textContent = `${pilot.hp} / ${pilot.maxHp}`;
      bar.setAttribute('aria-label', `${pilot.id + 1}P 체력 ${pilot.hp} / ${pilot.maxHp}`);
      bar.innerHTML = Array.from({ length: pilot.maxHp }, (_, i) => `<i${i >= pilot.hp ? ' class="empty"' : ''}></i>`).join('');
    }
    healthKey = nextHealth;
  }
  const showBanner = game.bannerTime > 0 && playing;
  $('banner').classList.toggle('visible', showBanner);
  const bannerText = showBanner ? game.banner : '';
  if ($('banner').textContent !== bannerText) $('banner').textContent = bannerText;
  $('boss-hud').hidden = !game.boss || game.boss.hp <= 0 || !playing;
  if (game.boss) {
    $('boss-name').textContent = game.boss.kind === 'sentinel' ? 'WAVE 05 · SENTINEL / 중간 보스' : 'WAVE 10 · ECLIPSE / 최종 보스';
    const percent = Math.ceil(game.boss.hp / game.boss.maxHp * 100);
    $('boss-fill').style.width = `${percent}%`; $('boss-percent').textContent = `${percent}%`;
  }
  $('combo').hidden = game.combo < 8 || !playing;
  if (game.combo >= 8) $('combo').firstElementChild.textContent = `×${Math.min(4, 1 + Math.floor(game.combo / 8))}`;
  $('touch-hint').hidden = !playing || game.time > 5 || !matchMedia('(pointer: coarse)').matches;
  $('touch-hint').textContent = game.playerCount === 2 ? '왼쪽 1P · 오른쪽 2P 화면을 드래그해서 이동' : '화면을 드래그해서 이동';
}

$('start-button').addEventListener('click', launch);
$('restart-button').addEventListener('click', () => { reset(); launch(); });
$('home-button').addEventListener('click', () => { reset(); $('start-button').focus(); });
$('pause-button').addEventListener('click', togglePause);
$('help-button').addEventListener('click', () => openDialog(true));
$('resume-button').addEventListener('click', closeDialog);
$('quit-button').addEventListener('click', () => { reset(); $('start-button').focus(); });
$('dialog').addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
$('nova-button').addEventListener('click', () => { sound.unlock(); activateNova(game); canvas.focus({ preventScroll: true }); updateHud(); });
$('nova2-button').addEventListener('click', () => { sound.unlock(); activateNova(game, 1); canvas.focus({ preventScroll: true }); updateHud(); });
$('sound-button').addEventListener('click', () => {
  soundEnabled = !soundEnabled; sound.setEnabled(soundEnabled);
  storage.set('orbit-breaker.sound', soundEnabled); updateSound();
  if (soundEnabled) sound.play('pickup');
});
for (const button of document.querySelectorAll('[data-difficulty]')) {
  button.addEventListener('click', () => {
    if (game.mode !== 'ready') return;
    selectedDifficulty = button.dataset.difficulty;
    storage.set('orbit-breaker.difficulty', selectedDifficulty); reset();
  });
}
for (const button of document.querySelectorAll('[data-players]')) {
  button.addEventListener('click', () => {
    if (game.mode !== 'ready') return;
    selectedPlayers = Number(button.dataset.players);
    storage.set('orbit-breaker.players', selectedPlayers); reset();
  });
}
$('autofire').checked = storage.get('orbit-breaker.autofire', true) !== false;
$('autofire').addEventListener('change', () => storage.set('orbit-breaker.autofire', $('autofire').checked));

window.addEventListener('keydown', event => {
  if (event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.code === 'KeyM' && !event.repeat) { $('sound-button').click(); return; }
  if ((event.code === 'Escape' || event.code === 'KeyP') && !event.repeat) {
    event.preventDefault(); togglePause(); return;
  }
  if ($('dialog').open) return;
  if (event.code === 'Enter' && game.mode === 'playing' && game.playerCount === 2) {
    event.preventDefault();
    if (!event.repeat) activateNova(game, 1);
    return;
  }
  const interactive = event.target.closest('button, input, a');
  if (event.code === 'Enter' && !event.repeat && !interactive) {
    event.preventDefault();
    if (game.mode === 'ready') launch();
    else if (game.mode === 'won' || game.mode === 'lost') { reset(); launch(); }
    return;
  }
  const gameKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyX', 'Slash'];
  if (gameKeys.includes(event.code) && game.mode === 'playing') {
    if (event.code === 'Space' && interactive) return;
    event.preventDefault(); keys.add(event.code);
    if (event.code === 'KeyX' && !event.repeat) activateNova(game);
  }
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => { if (game.mode === 'playing') openDialog(); clearInput(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.mode === 'playing') openDialog();
  clearInput();
});

canvas.addEventListener('pointerdown', event => {
  if (game.mode !== 'playing' || event.button > 0) return;
  const rect = canvas.getBoundingClientRect();
  const playerId = game.playerCount === 2 && event.clientX > rect.left + rect.width / 2 ? 1 : 0;
  if ([...pointers.values()].some(pointer => pointer.playerId === playerId)) return;
  event.preventDefault(); canvas.focus({ preventScroll: true }); sound.unlock();
  pointers.set(event.pointerId, { playerId, x: event.clientX, y: event.clientY });
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  const pointer = pointers.get(event.pointerId);
  if (!pointer || game.mode !== 'playing') return;
  const rect = canvas.getBoundingClientRect();
  drags[pointer.playerId].x += (event.clientX - pointer.x) * game.width / rect.width;
  drags[pointer.playerId].y += (event.clientY - pointer.y) * game.height / rect.height;
  pointer.x = event.clientX; pointer.y = event.clientY;
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(event, e => pointers.delete(e.pointerId));
}

function frame(timestamp) {
  const dt = Math.min(0.05, (timestamp - (previousTime || timestamp)) / 1000);
  previousTime = timestamp;
  if (game.mode === 'playing') {
    accumulator += dt;
    const solo = game.playerCount === 1;
    const input = { players: [{
      x: Number(keys.has('KeyD') || (solo && keys.has('ArrowRight'))) - Number(keys.has('KeyA') || (solo && keys.has('ArrowLeft'))),
      y: Number(keys.has('KeyS') || (solo && keys.has('ArrowDown'))) - Number(keys.has('KeyW') || (solo && keys.has('ArrowUp'))),
      precise: keys.has('ShiftLeft') || (solo && keys.has('ShiftRight')),
      fire: $('autofire').checked || keys.has('Space'), dragX: drags[0].x, dragY: drags[0].y,
    }, {
      x: Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft')),
      y: Number(keys.has('ArrowDown')) - Number(keys.has('ArrowUp')),
      precise: keys.has('ShiftRight'), fire: $('autofire').checked || keys.has('Slash'),
      dragX: drags[1].x, dragY: drags[1].y,
    }] };
    while (accumulator >= 1 / 120) {
      updateGame(game, 1 / 120, input); accumulator -= 1 / 120;
      for (const control of input.players) { control.dragX = 0; control.dragY = 0; }
      for (const drag of drags) { drag.x = 0; drag.y = 0; }
    }
  } else if (game.mode === 'won' || game.mode === 'lost') updateEffects(game, dt);
  for (const event of game.events.splice(0)) sound.play(event);
  sound.tick(dt, game.mode === 'playing');
  if (game.mode !== lastMode) {
    if (game.mode === 'won' || game.mode === 'lost') finish();
    lastMode = game.mode;
  }
  updateHud(); render(game, timestamp / 1000, keys.has('ShiftLeft') || keys.has('ShiftRight'));
  requestAnimationFrame(frame);
}

// Read-only state for browser checks and accessibility/debugging tools.
window.render_game_to_text = () => JSON.stringify(snapshot(game));
$('mission-route').innerHTML = SECTORS.map((name, i) => `<li${i === 4 || i === 9 ? ' class="boss-route"' : ''}><span>${String(i + 1).padStart(2, '0')}</span><div>${name}${i === 4 ? '<small>MID BOSS</small>' : i === 9 ? '<small>FINAL BOSS</small>' : ''}</div><i>${i === 4 || i === 9 ? '✳' : ''}</i></li>`).join('');
updateSound(); reset(); requestAnimationFrame(frame);
