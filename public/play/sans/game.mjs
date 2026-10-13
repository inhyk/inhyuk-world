// SANS · 심판의 회랑 — 브라우저 연결부 (입력, 루프, 저장, 소리, 화면 맞춤)
import * as C from './core.mjs';
import * as R from './render.mjs';
import { Sound } from './audio.mjs';

const SAVE_KEY = 'sans-judgement-hall';
const canvas = document.querySelector('#game'), ctx = canvas.getContext('2d');
const statusText = document.querySelector('#message'), phaseText = document.querySelector('#phase');
const pauseButton = document.querySelector('#pause'), soundButton = document.querySelector('#sound');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
R.setReducedMotion(motion.matches); motion.addEventListener('change', event => R.setReducedMotion(event.matches));

function load() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; } }
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(g.meta)); } catch { /* 저장 공간을 쓸 수 없으면 기록 없이 진행한다 */ } }
const meta = { ...C.createMeta(), ...load() };
const g = C.createGame(meta, (Date.now() % 2147483647) || 1);
const sound = new Sound();
const held = {};
const pressedInputs = new Map();

// ---------- 화면 맞춤: 기기 픽셀에 맞춰 그려서 글자가 번지지 않게 한다 ----------
function fit() {
  const width = Math.max(320, Math.round(canvas.getBoundingClientRect().width * Math.min(3, devicePixelRatio || 1)));
  if (canvas.width !== width) { canvas.width = width; canvas.height = Math.round(width * C.H / C.W); }
}
new ResizeObserver(fit).observe(canvas); addEventListener('resize', fit);

// ---------- 소리 ----------
function showSound() { soundButton.textContent = sound.enabled ? '소리 ON' : '소리 OFF'; soundButton.setAttribute('aria-pressed', String(sound.enabled)); }
async function wantSound() {
  if (sound.enabled || g.meta.sound === false) return;
  if (await sound.enable()) { if (!sound.track) sound.music(g.mode === 'title' ? 'title' : 'hall'); showSound(); }
}
soundButton.addEventListener('click', async () => {
  if (sound.enabled) { sound.disable(); g.meta.sound = false; } else { g.meta.sound = true; if (await sound.enable() && !sound.track) sound.music(g.mode === 'title' ? 'title' : 'hall'); }
  save(); showSound(); canvas.focus({ preventScroll: true });
});

// ---------- 입력 ----------
const DIRECTION = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
const CONFIRM = ['KeyZ', 'Enter', 'Space'], CANCEL = ['KeyX'], SLOW = ['ShiftLeft', 'ShiftRight', 'KeyX'];
const heldState = () => ({ left: held.left, right: held.right, up: held.up, down: held.down, slow: held.slow });
function refreshHeld() {
  for (const key of ['left', 'right', 'up', 'down', 'slow']) held[key] = false;
  for (const code of pressedInputs.values()) {
    if (DIRECTION[code]) held[DIRECTION[code]] = true;
    if (SLOW.includes(code)) held.slow = true;
  }
}
function keyDown(code, repeat = false, source = 'key:' + code) {
  pressedInputs.set(source, code); refreshHeld();
  wantSound();
  if (code === 'Escape' || code === 'KeyP') { if (!repeat) togglePause(); return; }
  if (code === 'KeyM') { if (!repeat) soundButton.click(); return; }
  if (DIRECTION[code]) { if (!repeat || ['title', 'submenu', 'gameover'].includes(g.mode)) C.press(g, DIRECTION[code]); }
  if (repeat) return;
  if (g.paused) { if (CONFIRM.includes(code)) togglePause(); return; }
  if (CONFIRM.includes(code)) C.press(g, 'confirm');
  else if (CANCEL.includes(code)) C.press(g, 'cancel');
}
function keyUp(code, source = 'key:' + code) { pressedInputs.delete(source); refreshHeld(); }
addEventListener('keydown', event => {
  if (![...Object.keys(DIRECTION), ...CONFIRM, ...CANCEL, ...SLOW, 'Escape', 'KeyP', 'KeyM'].includes(event.code)) return;
  if ((event.code === 'Enter' || event.code === 'Space') && event.target instanceof HTMLElement && event.target.closest('button, a')) return;
  event.preventDefault(); keyDown(event.code, event.repeat);
});
addEventListener('keyup', event => keyUp(event.code));
function clearHeld() { pressedInputs.clear(); refreshHeld(); for (const button of document.querySelectorAll('[data-key]')) button.classList.remove('pressed'); }
for (const button of document.querySelectorAll('[data-key]')) {
  const code = button.dataset.key;
  const down = event => { event.preventDefault(); try { button.setPointerCapture(event.pointerId); } catch { /* 합성 입력에는 포인터가 없다 */ } button.classList.add('pressed'); keyDown(code, false, 'pointer:' + event.pointerId); };
  const up = event => {
    keyUp(code, 'pointer:' + event.pointerId);
    if (![...pressedInputs.values()].includes(code)) button.classList.remove('pressed');
  };
  button.addEventListener('pointerdown', down); button.addEventListener('pointerup', up); button.addEventListener('pointercancel', up); button.addEventListener('lostpointercapture', up);
}
// 화면을 누르면 확인. 피하는 중에는 실수로 눌리지 않게 막는다. (잠든 샌즈 앞에서는 된다)
canvas.addEventListener('pointerdown', event => {
  wantSound(); canvas.focus({ preventScroll: true });
  if (g.paused) return togglePause();
  if (g.mode === 'title') {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * C.W / rect.width, y = (event.clientY - rect.top) * C.H / rect.height;
    if (x >= 260 && x <= 380 && y >= 105 && y <= 242) { C.press(g, 'cancel'); return; }
  }
  if (['title', 'talk', 'text', 'gameover', 'won', 'cine', 'fightbar'].includes(g.mode) || (g.mode === 'dodge' && g.push)) C.press(g, 'confirm');
});
function togglePause() {
  if (['title', 'gameover', 'won'].includes(g.mode)) return;
  g.paused = !g.paused; clearHeld(); sound.pause(g.paused);
}
pauseButton.addEventListener('click', () => { togglePause(); canvas.focus({ preventScroll: true }); });
addEventListener('blur', () => { clearHeld(); if (!g.paused && !['title', 'gameover', 'won'].includes(g.mode)) togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearHeld(); if (!g.paused && !['title', 'gameover', 'won'].includes(g.mode)) togglePause(); } });

// ---------- 화면 밖의 안내 글 ----------
const PHASE_LABEL = { intro: 'THE LAST CORRIDOR', opening: 'FIRST STRIKE', p1: 'ACT 1 · 느긋한 심판', offer: '…MERCY?', p2: 'ACT 2 · 봐주지 않는다', special: 'SPECIAL ATTACK', nothing: '…', asleep: 'zzz' };
function hint() {
  if (g.paused) return '잠깐 쉬는 중. 준비되면 계속하세요.';
  switch (g.mode) {
    case 'title': return (C.diff(g).id === 'hp1' && !C.hardUnlocked(g)) ? '하드모드 잠김 · 보통 또는 최악의 시간을 끝까지 클리어하면 열립니다.' : g.meta.hiddenHeart === true ? `히든 발견! HP ${C.hiddenHp(g)} · 이 기기에 저장되었습니다. Z로 시작하세요.` : g.secretTaps ? ['','…한 번 더 말을 걸어 볼까?','…세 번째에는 대답할지도.'][g.secretTaps] : '난이도를 고르고 Z로 시작하세요. …샌즈에게도 말을 걸 수 있을까?';
    case 'talk': return 'Z 다음 말 · X 한 번에 보기';
    case 'text': return 'Z 다음';
    case 'menu': return g.menuBones.length ? '뼈가 버튼 위를 지나간다! ← → 로 옆 버튼으로 피하세요.' : g.phase === 'offer' ? '공격하면 싸움이 이어지고, 자비를 고르면…' : '← → 고르기 · Z 확인. 공격해야 이야기가 나아갑니다. 아이템은 한 차례를 씁니다.';
    case 'submenu': return '방향키로 고르기 · Z 확인 · X 돌아가기';
    case 'fightbar': return '막대가 가운데 왔을 때 Z!';
    case 'strike': return '…';
    case 'dodge':
      if (g.phase === 'asleep') return g.push ? 'Z를 누르면… 되돌릴 수 없다.' : '샌즈가 잠들었다. 벽에 붙어 ← 나 → 를 계속 누르면 상자가 밀린다.';
      if (g.phase === 'nothing') return '아무 일도 일어나지 않는다. …기다려 보자.';
      if (g.blackout > 0) return '암전! 화면이 돌아오면 다른 공격입니다. 영혼 색과 중력 방향을 확인하세요.';
      return g.soul.mode === 'blue' ? `파란 영혼 · ${{ down: '↑ 위', up: '↓ 아래', left: '→ 오른쪽', right: '← 왼쪽' }[g.soul.gravity]} 키로 점프 · 길게 누르면 높이 · 파란 뼈는 멈추기` : '빨간 영혼 · 방향키로 피하기 · 파란 뼈는 멈추기 · Shift 천천히';
    case 'gameover': return '괜찮아요. 몇 번이든 다시 할 수 있어요.';
    case 'won': return '끝까지 와 줘서 고마워요.';
    default: return '…';
  }
}
let shownHint = '', shownPhase = '';
function sync() {
  const nextHint = hint(), nextPhase = g.mode === 'title' ? 'THE LAST CORRIDOR' : g.mode === 'gameover' ? 'GAME OVER' : g.mode === 'won' ? 'THE END' : PHASE_LABEL[g.phase] || '';
  if (nextHint !== shownHint) statusText.textContent = shownHint = nextHint;
  if (nextPhase !== shownPhase) phaseText.textContent = shownPhase = nextPhase;
  pauseButton.disabled = ['title', 'gameover', 'won'].includes(g.mode); pauseButton.textContent = g.paused ? '계속하기' : '잠깐 쉬기';
}
function drain() {
  for (const event of g.events.splice(0)) {
    if (event.type === 'sfx') sound.sfx(event.name);
    else if (event.type === 'voice') sound.voice(event.name);
    else if (event.type === 'music') sound.music(event.name);
    else if (event.type === 'save') save();
  }
}
function paint() { const scale = canvas.width / C.W; ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.imageSmoothingEnabled = false; R.draw(ctx, g); }

// ---------- 루프 ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  C.tick(g, dt, heldState()); drain(); sync(); paint();
  requestAnimationFrame(frame);
}

// ---------- 자동화용 인터페이스 ----------
window.render_game_to_text = () => JSON.stringify({ ...C.summarize(g), paused: g.paused, coordinates: '640x480; 원점은 왼쪽 위, x 오른쪽, y 아래' });
window.advanceTime = milliseconds => { for (let left = milliseconds / 1000; left > 1e-9; left -= 1 / 60) C.tick(g, Math.min(left, 1 / 60), heldState()); drain(); sync(); paint(); };
window.__sans = { g, C, sound, held };

fit(); showSound(); sync();
(document.fonts?.load ? Promise.all([document.fonts.load('16px Galmuri11'), document.fonts.load('bold 16px Galmuri11')]).catch(() => {}) : Promise.resolve()).then(() => requestAnimationFrame(frame));

// iframe으로 처음 열어도 클릭 없이 방향키로 난이도를 고를 수 있다.
canvas.focus({ preventScroll: true });
