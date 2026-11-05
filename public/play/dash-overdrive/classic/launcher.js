(() => {
'use strict';
// The page around the WebAssembly engine: level picker, song downloads,
// touch input and the hooks the engine calls (Module.classic*).
const VERSION = 'classic-original-10';
// [name, difficulty, song] for levels 1-100, written by levels/level-list.mjs
const CLASSIC_LEVELS = window.CLASSIC_LEVEL_LIST;
// groups in the level picker
const GROUPS = [[0, '1~15단계'], [15, '비밀 단계 16~20 · 코인으로 열려'], [20, '21단계'], [21, '새 단계 22~100 · 처음부터 열려 있어']];
const DIFFICULTY_NAMES = {easy: '쉬움', normal: '보통', hard: '어려움', harder: '더 어려움', insane: '아주 어려움', demon: '데몬', secret: '비밀 단계'};
// secret levels 16-20 open at 10 to 50 coins (engine: Config::SECRET_COINS)
const SECRET_FIRST = 15;
const SECRET_COINS = [10, 20, 30, 40, 50];
const CUSTOM_LEVEL = CLASSIC_LEVELS.length;
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

// localStorage key of a level's record (engine LevelSelect::storageKey):
// levels 1-21 keep base + index, levels 22-100 use base * 10 + index.
function levelKey(base, index) {
  return index < 21 ? base + index : base * 10 + index;
}
const songOf = index => CLASSIC_LEVELS[index]?.[2] ?? index;

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
    total += coinCount(index);
  }
  return total;
}

function coinCount(index) {
  const bits = storedNumber(levelKey(300, index));
  return (bits & 1) + ((bits >> 1) & 1) + ((bits >> 2) & 1);
}

// ---- 나의 레벨, diamonds and the skin shop (the designer's plan 3, items 4-6) ----
// Everything is worked out from the saved records, so it can never drift:
// a first clear gives experience by difficulty, every coin gives 10, and 100
// experience is one level. My level 5, 10, 15, 20, ... each give 10 diamonds;
// a shop skin costs 10 diamonds.
const CLEAR_XP = {easy: 20, normal: 30, hard: 40, harder: 50, insane: 60, demon: 80, secret: 80};
const COIN_XP = 10;
const XP_PER_LEVEL = 100;
const DIAMOND_EVERY = 5;
const DIAMONDS_PER_REWARD = 10;
const SHOP_FIRST = 25; // engine Config::SHOP_FIRST
const SHOP_PRICE = 10; // engine Config::SHOP_PRICE
const SHOP_SKINS = ['크리스탈', '판다', '우주인', '수박', '번개', '쿠키'];
const BOUGHT_KEY = 2; // engine Storage::BOUGHT_SKINS, one bit per shop skin

function myProgress() {
  let xp = 0;
  CLASSIC_LEVELS.forEach(([, difficulty], index) => {
    if (storedNumber(levelKey(100, index)) >= 100) xp += CLEAR_XP[difficulty] ?? 20;
    xp += COIN_XP * coinCount(index);
  });
  const level = 1 + Math.floor(xp / XP_PER_LEVEL);
  const bought = storedNumber(BOUGHT_KEY);
  let spent = 0;
  for (let i = 0; i < SHOP_SKINS.length; i++) spent += ((bought >> i) & 1) * SHOP_PRICE;
  const earned = Math.floor(level / DIAMOND_EVERY) * DIAMONDS_PER_REWARD;
  return {xp, level, into: xp % XP_PER_LEVEL, earned, diamonds: Math.max(0, earned - spent), bought};
}

function updateMyLevel(announce = false) {
  const progress = myProgress();
  document.getElementById('my-level-value').textContent = `${progress.level}레벨`;
  document.getElementById('my-diamonds').textContent = `💎 ${progress.diamonds}`;
  document.getElementById('my-level-big').textContent = `${progress.level}레벨`;
  document.getElementById('my-xp').textContent = `경험치 ${progress.into} / ${XP_PER_LEVEL}`;
  document.getElementById('my-xp-bar').style.width = `${progress.into}%`;
  const nextReward = (Math.floor(progress.level / DIAMOND_EVERY) + 1) * DIAMOND_EVERY;
  document.getElementById('my-diamonds-big').textContent = `💎 다이아몬드 ${progress.diamonds}개 · ${nextReward}레벨이 되면 10개 더`;
  let seen = 0;
  try {
    seen = Number(localStorage.getItem('dash-classic:my-level-seen')) || 0;
    localStorage.setItem('dash-classic:my-level-seen', String(progress.level));
  } catch {
    // the level shows; only the "level up" message needs this
  }
  if (announce && seen && progress.level > seen) {
    const rewards = Math.floor(progress.level / DIAMOND_EVERY) - Math.floor(seen / DIAMOND_EVERY);
    showToast(rewards > 0
      ? `🎉 레벨 업! 나의 레벨 ${progress.level}레벨 · 💎 다이아몬드 ${rewards * DIAMONDS_PER_REWARD}개를 받았어!`
      : `🎉 레벨 업! 나의 레벨 ${progress.level}레벨`);
  }
  if (!shop.hidden) buildShop();
  return progress;
}

const shop = document.getElementById('shop');
const shopList = document.getElementById('shop-list');
const skinPictures = new Map();
function skinPicture(skin) {
  if (skinPictures.has(skin)) return skinPictures.get(skin);
  let url = '';
  try {
    url = URL.createObjectURL(new Blob([FS.readFile(`/res/gfx/skins/${skin}.png`)], {type: 'image/png'}));
  } catch {
    return '';
  }
  skinPictures.set(skin, url);
  return url;
}

function buildShop() {
  const progress = myProgress();
  document.getElementById('shop-diamonds').textContent = `가진 다이아몬드 💎 ${progress.diamonds}개 · 나의 레벨 ${progress.level}레벨`;
  shopList.textContent = '';
  const wearing = ready ? Module._classic_player_skin() : -1;
  SHOP_SKINS.forEach((name, i) => {
    const skin = SHOP_FIRST + i;
    const owned = ((progress.bought >> i) & 1) === 1;
    const item = document.createElement('div');
    item.className = 'shop-item';
    const picture = document.createElement('img');
    picture.alt = '';
    picture.src = ready ? skinPicture(skin) : '';
    const title = document.createElement('strong');
    title.textContent = name;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.skin = String(skin);
    if (owned && wearing === skin) {
      button.textContent = '쓰는 중 ✓';
      button.disabled = true;
    } else if (owned) {
      button.textContent = '쓰기';
      button.addEventListener('click', () => wearSkin(skin));
    } else if (progress.diamonds >= SHOP_PRICE) {
      button.textContent = `💎 ${SHOP_PRICE} 사기`;
      button.className = 'buy';
      button.addEventListener('click', () => buySkin(i));
    } else {
      button.textContent = `💎 ${SHOP_PRICE} · ${SHOP_PRICE - progress.diamonds}개 더 필요해`;
      button.disabled = true;
    }
    item.append(picture, title, button);
    shopList.append(item);
  });
}

function buySkin(i) {
  const progress = myProgress();
  if (progress.diamonds < SHOP_PRICE || (progress.bought >> i) & 1) return;
  try {
    localStorage.setItem(`dash-classic:${BOUGHT_KEY}`, String(progress.bought | (1 << i)));
  } catch {
    showToast('이 브라우저에는 저장할 수 없어서 살 수 없어.');
    return;
  }
  Module._classic_refresh_skins();
  Module._classic_select_skin(SHOP_FIRST + i);
  showToast(`💎 ${SHOP_SKINS[i]} 스킨을 샀어! 지금 쓰고 있어.`);
  updateMyLevel();
  buildShop();
}

function wearSkin(skin) {
  if (Module._classic_select_skin(skin)) showToast(`${SHOP_SKINS[skin - SHOP_FIRST]} 스킨으로 바꿨어.`);
  buildShop();
}

function openShop(open) {
  shop.hidden = !open;
  if (open) buildShop();
  else canvas.focus();
}
document.getElementById('my-level').addEventListener('click', () => openShop(shop.hidden));
document.getElementById('shop-open').addEventListener('click', () => openShop(true));
document.getElementById('shop-close').addEventListener('click', () => openShop(false));
window.classicShop = {open: () => openShop(true), close: () => openShop(false), isOpen: () => !shop.hidden, progress: myProgress};

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
  if (!/^[0-9]$/.test(event.key) || (event.target instanceof HTMLElement && event.target.matches('input, select, textarea'))) return;
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
  if (creator || index < SECRET_FIRST || index >= SECRET_FIRST + SECRET_COINS.length) return 0;
  return Math.max(0, SECRET_COINS[index - SECRET_FIRST] - totalCoins());
}

function bestText(index) {
  const best = storedNumber(levelKey(100, index));
  const coins = coinCount(index);
  const record = best >= 100 ? '클리어! 100%' : best > 0 ? `최고 기록 ${best}%` : '아직 도전 전';
  return `${record} · 코인 ${coins}/3`;
}

function buildChoices() {
  choices.textContent = '';
  CLASSIC_LEVELS.forEach(([name, difficulty], index) => {
    const group = GROUPS.find(([first]) => first === index);
    if (group) {
      const heading = document.createElement('h3');
      heading.className = 'choice-group';
      heading.textContent = group[1];
      choices.append(heading);
    }
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
      prepareSong(songOf(index));
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
  return !launcher.hidden || !shop.hidden || Boolean(window.classicEditor?.isOpen()) || Boolean(window.classicOnline?.isOpen()) || Boolean(window.classicSocial?.isOpen());
}

const isField = target => target instanceof HTMLElement && target.matches('input, select, textarea');

// While a page panel is open the engine must not see the keyboard.
for (const type of ['keydown', 'keyup']) {
  window.addEventListener(type, event => {
    if (!panelOpen()) return;
    // a text box keeps its keys; it stops them from reaching the game itself
    if (isField(event.target)) return;
    event.stopImmediatePropagation();
    if (!shop.hidden) {
      if (type === 'keydown' && event.key === 'Escape') openShop(false);
    } else if (window.classicSocial?.isOpen()) {
      if (type === 'keydown' && event.key === 'Escape') window.classicSocial.close();
    } else if (window.classicOnline?.isOpen()) {
      if (type === 'keydown' && event.key === 'Escape') window.classicOnline.close();
    } else if (window.classicEditor?.isOpen()) {
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
  if (level < CLASSIC_LEVELS.length) prepareSong(songOf(level));
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
    updateMyLevel();
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

// Header shows the level being played; my level is worked out again after each run.
let wasPlaying = false;
setInterval(() => {
  if (!ready) return;
  const playing = Module._classic_state() === STATE_PLAYING;
  const finished = playing && Module._classic_percent() >= 10000;
  if ((wasPlaying && !playing) || (finished && !wasPlaying)) updateMyLevel(true);
  wasPlaying = playing && !finished;
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
updateMyLevel();
})();
