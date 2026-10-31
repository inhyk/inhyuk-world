(() => {
'use strict';
// The page around the WebAssembly engine: level picker, song downloads,
// touch input and the hooks the engine calls (Module.classic*).
const VERSION = 'classic-original-1';
const CLASSIC_LEVELS = [
  ['Neon Start', 'easy'], ['Pixel Hop', 'easy'], ['Blue Ladder', 'normal'], ['Desert Wind', 'normal'],
  ['Iron Gate', 'hard'], ['Night Rail', 'hard'], ['Sky Rocket', 'hard'], ['Crystal Cave', 'harder'],
  ['Thunder Road', 'harder'], ['Lava Lift', 'harder'], ['Star Factory', 'insane'], ['Frost Bite', 'insane'],
  ['Laser Maze', 'insane'], ['Black Hole', 'demon'], ['Overdrive', 'demon'],
  ['Golden Key', 'secret'], ['Secret Core', 'secret'], ['Last Dash', 'secret'],
];
const DIFFICULTY_NAMES = {easy: '쉬움', normal: '보통', hard: '어려움', harder: '더 어려움', insane: '아주 어려움', demon: '데몬', secret: '비밀 단계'};
// secret levels 16-18 open at 10, 20 and 30 coins (engine: Config::SECRET_COINS)
const SECRET_FIRST = 15;
const SECRET_COINS = [10, 20, 30];
const CUSTOM_LEVEL = 18;
const STATE_PLAYING = 2;

const canvas = document.getElementById('canvas');
const status = document.getElementById('status');
const play = document.getElementById('play');
const launcher = document.getElementById('launcher');
const choices = document.getElementById('choices');
const selectButton = document.getElementById('select');
const nowPlaying = document.getElementById('now-playing');
const params = new URLSearchParams(location.search);
const levelParameter = Number(params.get('level'));
let selected = Number.isInteger(levelParameter) && levelParameter >= 1 && levelParameter <= CLASSIC_LEVELS.length ? levelParameter : 1;
let ready = false;

function storedNumber(key) {
  try {
    const value = Number(localStorage.getItem(`dash-classic:${key}`));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function totalCoins() {
  let total = 0;
  for (let index = 0; index < CLASSIC_LEVELS.length; index++) {
    const bits = storedNumber(300 + index);
    total += (bits & 1) + ((bits >> 1) & 1) + ((bits >> 2) & 1);
  }
  return total;
}

// Creator mode: type 1 3 5 7 0 (the designer's code) to turn it on or off.
// Every level opens, nothing hurts, hitboxes show and nothing is saved.
const CREATOR_CODE = '13570';
let creator = false;
let typed = '';
const toast = document.getElementById('toast');
let toastTimer = 0;
function showToast(text) {
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 2600);
}
window.addEventListener('keydown', event => {
  if (!/^[0-9]$/.test(event.key)) return;
  typed = (typed + event.key).slice(-CREATOR_CODE.length);
  if (typed !== CREATOR_CODE || !ready) return;
  typed = '';
  creator = !creator;
  Module._classic_set_creator(creator ? 1 : 0);
  document.body.classList.toggle('creator', creator);
  showToast(creator ? '🛠️ 제작자 모드 켜짐: 모든 단계 열림 · 무적 · 히트박스 보기 (기록은 저장 안 돼)' : '제작자 모드 꺼짐');
  if (!launcher.hidden) buildChoices();
  updateChoice();
}, true);

// Coins still needed to open a level; 0 when it is open.
function coinsNeeded(index) {
  if (creator || index < SECRET_FIRST) return 0;
  return Math.max(0, SECRET_COINS[index - SECRET_FIRST] - totalCoins());
}

function bestText(index) {
  const best = storedNumber(100 + index);
  const coinBits = storedNumber(300 + index);
  const coins = (coinBits & 1) + ((coinBits >> 1) & 1) + ((coinBits >> 2) & 1);
  const record = best >= 100 ? '클리어! 100%' : best > 0 ? `최고 기록 ${best}%` : '아직 도전 전';
  return `${record} · 코인 ${coins}/3`;
}

function buildChoices() {
  choices.textContent = '';
  CLASSIC_LEVELS.forEach(([name, difficulty], index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `choice ${difficulty}`;
    button.dataset.level = String(index + 1);
    const number = document.createElement('span');
    number.className = 'number';
    number.textContent = String(index + 1).padStart(2, '0');
    const content = document.createElement('span');
    content.className = 'choice-content';
    const label = document.createElement('small');
    label.textContent = DIFFICULTY_NAMES[difficulty];
    const title = document.createElement('strong');
    title.textContent = name;
    const best = document.createElement('em');
    const needed = coinsNeeded(index);
    best.textContent = needed ? `🔒 코인 ${needed}개 더 모으면 열려` : bestText(index);
    if (needed) button.classList.add('locked');
    content.append(label, title, best);
    button.append(number, content);
    button.addEventListener('click', () => {
      selected = index + 1;
      updateChoice();
      prepareSong(index);
    });
    choices.append(button);
  });
  updateChoice();
}

function updateChoice() {
  for (const button of choices.querySelectorAll('[data-level]')) {
    const active = Number(button.dataset.level) === selected;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  const needed = coinsNeeded(selected - 1);
  if (ready) {
    play.textContent = needed ? `🔒 코인 ${needed}개 더 필요해` : `${selected}단계 시작하기 ▶`;
    play.disabled = needed > 0;
  }
  document.getElementById('coin-total').textContent = `모은 코인 ${totalCoins()}개`;
}

// Songs are downloaded only when needed and handed to the engine's file system.
const songRequests = new Map();
function prepareSong(index) {
  if (!ready || songRequests.has(index)) return songRequests.get(index);
  const request = fetch(`music/${index}.ogg?v=${VERSION}`)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.arrayBuffer();
    })
    .then(buffer => FS.writeFile(`/music/${index}.ogg`, new Uint8Array(buffer)))
    .catch(error => {
      // an empty file tells the engine to start without music
      console.warn(`song ${index + 1} failed`, error);
      try {
        FS.writeFile(`/music/${index}.ogg`, new Uint8Array(0));
      } catch {
        // the engine will stop waiting on its own
      }
      setTimeout(() => {
        songRequests.delete(index);
        try {
          FS.unlink(`/music/${index}.ogg`);
        } catch {
          // already replaced by a real song
        }
      }, 10000);
    });
  songRequests.set(index, request);
  return request;
}

function panelOpen() {
  return !launcher.hidden || Boolean(window.classicEditor?.isOpen());
}

// While a page panel is open the engine must not see the keyboard.
for (const type of ['keydown', 'keyup']) {
  window.addEventListener(type, event => {
    if (!panelOpen()) return;
    event.stopImmediatePropagation();
    if (window.classicEditor?.isOpen()) {
      window.classicEditor.handleKey(event);
    } else if (type === 'keydown' && event.key === 'Escape') {
      showLauncher(false);
    }
  }, true);
}

function showLauncher(show) {
  launcher.hidden = !show;
  selectButton.textContent = show ? '게임으로 돌아가기' : '단계 선택';
  if (show) {
    buildChoices();
  } else {
    canvas.focus();
  }
}

function startLevel(level) {
  if (!ready) return;
  if (level < CLASSIC_LEVELS.length && coinsNeeded(level) > 0) return;
  if (level < CLASSIC_LEVELS.length) prepareSong(level);
  showLauncher(false);
  window.classicEditor?.close();
  Module._classic_start_level(level);
  canvas.focus();
}

const Module = window.Module = {
  canvas,
  locateFile: path => `engine/${path}?v=${VERSION}`,
  print() {},
  printErr(message) {
    console.error(message);
  },
  setStatus(message) {
    if (!ready && message) status.textContent = '게임을 불러오고 있어…';
  },
  onAbort() {
    status.textContent = '게임을 불러오지 못했어. 새로고침해서 다시 해 줘.';
    status.classList.add('error');
  },
  classicReady() {
    ready = true;
    try {
      FS.mkdir('/music');
    } catch {
      // already there
    }
    play.disabled = false;
    status.textContent = '게임 화면에서 PLAY를 눌러도 돼.';
    updateChoice();
    const start = Number(params.get('start'));
    if (Number.isInteger(start) && start >= 1 && start <= CLASSIC_LEVELS.length) startLevel(start - 1);
  },
  classicPrepareSong(index) {
    prepareSong(index);
  },
  classicOpenEditor() {
    window.classicEditor?.open();
  },
  classicOnLevelExit(level) {
    if (level === CUSTOM_LEVEL) window.classicEditor?.reopenAfterTest();
  },
};
window.classicStartLevel = startLevel;
window.classicPrepareSong = prepareSong;

selectButton.addEventListener('click', () => showLauncher(launcher.hidden));
play.addEventListener('click', () => startLevel(selected - 1));

document.getElementById('full').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    // fullscreen is optional
  }
});

function key(type) {
  window.dispatchEvent(new KeyboardEvent(type, {key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true, cancelable: true}));
}

function isPlaying() {
  return ready && Module._classic_state() === STATE_PLAYING && !Module._classic_is_paused();
}

// A touch during a level is the jump key; menus get the touch as a click.
let touchHeld = false;
canvas.addEventListener('touchstart', event => {
  event.preventDefault();
  if (!isPlaying()) return;
  touchHeld = true;
  canvas.focus();
  key('keydown');
}, {passive: false});
function releaseTouch() {
  if (!touchHeld) return;
  touchHeld = false;
  key('keyup');
}
canvas.addEventListener('touchend', releaseTouch);
canvas.addEventListener('touchcancel', releaseTouch);
window.addEventListener('blur', () => {
  if (ready) key('keyup');
  releaseTouch();
});

// Header shows the level being played.
setInterval(() => {
  if (!ready) return;
  const playing = Module._classic_state() === STATE_PLAYING;
  const level = Module._classic_level();
  if (playing && level < CLASSIC_LEVELS.length) {
    nowPlaying.textContent = `${String(level + 1).padStart(2, '0')} / ${CLASSIC_LEVELS[level][0].toUpperCase()}`;
  } else if (playing) {
    nowPlaying.textContent = '내가 만든 맵';
  } else {
    nowPlaying.innerHTML = 'DASH / OVERDRIVE <span>CLASSIC</span>';
  }
}, 500);

window.render_classic_status = () => JSON.stringify({
  ready,
  creator,
  state: ready ? Module._classic_state() : -1,
  level: ready ? Module._classic_level() + 1 : selected,
  percent: ready ? Module._classic_percent() / 100 : 0,
  paused: ready ? Boolean(Module._classic_is_paused()) : false,
  launcher: !launcher.hidden,
  editor: Boolean(window.classicEditor?.isOpen()),
});

buildChoices();
})();
