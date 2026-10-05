import './style.css';
import { MAPS, getMap } from './maps.mjs';
import { consumePromo } from './promo.mjs';
import { Match, FIRST_TO } from './match.mjs';
import { Renderer } from './render.mjs';
import { Sound } from './audio.mjs';
import { Controls } from './input.mjs';
import { AI_LEVELS, createBrain } from './ai.mjs';
import { FLOORS, TOP_FLOOR, floorState, currentFloor, helpLevel, floorReward, clearFloor, loseFloor } from './tower.mjs';
import { SKINS, EFFECTS, canBuy, buy, equip, grant, canRedeem, redeem } from './shop.mjs';
import { GROUPS, track, claim, missionView, unclaimedCount } from './missions.mjs';
import {
  STORE_KEY, loadStore, saveStore, createAccount, login, logout, currentAccount, removeAccount, exportCode, importCode,
  newProgress, xpToNext, sanitize,
} from './profile.mjs';
import { isApp, buzz, restoreSaves, mirrorSave, hideSplash, onBackButton } from './platform.mjs';
import { calendarBonus, todayKey } from './calendar.mjs';
import { DAILY_REWARDS, SPIN_PRIZES, TIME_REWARDS, rewardPreview, grantReward, rewardView, claimDaily, spin, addPlayTime, claimTime } from './rewards.mjs';
import { createCreatorSession } from './creator.mjs';
import { drawCharacter, drawGarbageIcon } from './characters.mjs';
import { drawPreview } from './skins.mjs';
import { Effects } from './effects.mjs';
import { GARBAGE_ICONS } from './core.mjs';
import { createOnline } from './online.mjs';
import { createPeerOnline } from './online-peer.mjs';
import { Account, Social } from '../../packages/net/index.mjs';
import { serverUrl, scopedStorage } from './net.mjs';
import { CloudSave, CACHE_KEY } from './cloud.mjs';
import { migrateLocal, checkLocalPassword, markMigrated, migrationMarker, importIdFor, MIGRATING_KEY } from './migrate.mjs';
import { createSocialUI } from './social-ui.mjs';
import { playEnding } from './ending.mjs';
import { LESSONS, lessonCells, lessonSeq, newJudge, judge } from './tutorial.mjs';
import {
  QUICK, STICKERS, EMOJIS, CHAT_MAX, FRIEND_MAX, REQUEST_MAX, cleanChat, personalInfo, rateLimiter, makeFriendCode, normaliseFriendCode,
  validFriendCode, validMailKey, makeMailKey, validSticker, bigEmoji, graphemes, cleanName, addFriend, removeFriend, pushChat, emptySocial,
} from './chat.mjs';
import { drainMailbox, hasLegacy } from './legacy.mjs';
import { FriendNet } from './friendnet.mjs';
import { createMailClient, letterId } from './mailbox.mjs';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Number(n || 0).toLocaleString('ko-KR');
const TEST = new URLSearchParams(location.search).has('test');
const creator = createCreatorSession();

// ---------- 저장 ----------
let storage = null;
try { storage = window.localStorage; storage.getItem('x'); } catch { storage = null; }
const DEVICE_KEY = 'puyo-tower-device';
// 온라인 계정(@inhyuk/net). 서버 주소는 개발과 테스트에서만 ?net= 이나 VITE_NET_SERVER 로 바꾼다 (net.mjs).
const NET_SERVER = serverUrl(location.search, import.meta.env);
const netStore = scopedStorage(storage, NET_SERVER, mirrorSave);
await restoreSaves(storage, [STORE_KEY, DEVICE_KEY, netStore.key('inhyuk-net-session'), netStore.key(CACHE_KEY), netStore.key(MIGRATING_KEY)]); // 앱: 기기 저장소에 적어 둔 기록을 되살린다 (웹은 바로 지나감)
const store = loadStore(storage);
const net = new Account({ server: NET_SERVER, storage: netStore });
const marker = migrationMarker(netStore);
let cloud = null, hub = null; // 온라인 계정으로 들어갔을 때: 클라우드 세이브, 친구와 알림(@inhyuk/net Social)
let account = net.loggedIn ? null : currentAccount(store); // 이 기기 계정, 또는 온라인 계정({ cloud: true, uid })
let guest = null;
let device = { sound: true, music: true, haptics: true };
try { device = { ...device, ...JSON.parse(storage?.getItem(DEVICE_KEY) || '{}') }; } catch { /* 기본값 */ }
const me = () => account || guest;
const P = () => me()?.progress || (guest = { name: '손님', guest: true, progress: newProgress() }).progress;
function persistStore() {
  saveStore(storage, store);
  mirrorSave(STORE_KEY, storage?.getItem(STORE_KEY));
}
function save() {
  if (account?.cloud) cloud?.change(account.progress); // 3초 조용하면 서버에 올린다
  else if (account) { account.last = Date.now(); persistStore(); }
  try { storage?.setItem(DEVICE_KEY, JSON.stringify(device)); } catch { /* 저장 안 됨 */ }
  mirrorSave(DEVICE_KEY, storage?.getItem(DEVICE_KEY));
}
// 앱에서 손에 전해지는 톡! (설정에서 끌 수 있다)
const haptic = kind => { if (device.haptics !== false) buzz(kind); };
document.body.classList.toggle('app', isApp);

// ---------- 준비 ----------
const brain = createBrain(() => new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' }));
const canvas = $('stage');
const renderer = new Renderer(canvas);
const sound = new Sound();
sound.setSfx(device.sound);
sound.setMusic(device.music);
const controls = new Controls();
controls.bindButtons($('touch'));
const coarse = matchMedia('(pointer: coarse)').matches;
controls.bindSwipe(canvas, () => renderer.layout?.fields?.[0]?.cell || 30);
const unlock = () => sound.unlock();
// 아이폰은 손을 뗄 때(pointerup·touchend)만 소리를 켜 준다
for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown']) addEventListener(type, unlock, { capture: true });

let screen = '', match = null, demo = null, game = null, paused = false, talking = false;
let practice = null; // 연습하기 중이면 { index, judge, freeze }

// ---------- 알림 ----------
function toast(text, gold = false) {
  const t = document.createElement('div');
  t.className = `toast${gold ? ' gold' : ''}`;
  t.textContent = text;
  $('toasts').append(t);
  setTimeout(() => t.remove(), 3300);
}

// ---------- 화면 ----------
const SCREENS = ['login', 'menu', 'tower', 'vs', 'local', 'online', 'friends', 'dm', 'missions', 'shop', 'profile', 'help', 'creator', 'rewards'];
function show(name) {
  if ((chatWith?.kind === 'friend' || chatWith?.kind === 'legacy') && name !== 'friends') closeChat(); // 친구 화면을 떠나면 친구 채팅 창도 닫는다
  screen = name;
  for (const s of SCREENS) $(`scr-${s}`).hidden = s !== name;
  $('hud').hidden = true;
  $('touch').hidden = true;
  document.body.classList.remove('duo');
  controls.enabled = false;
  if (!match && !demo) startDemo();
  renderScreen(name);
  if (name && !match) sound.play('menu');
}
function hideScreens() { for (const s of SCREENS) $(`scr-${s}`).hidden = true; screen = ''; }

function renderScreen(name) {
  document.querySelectorAll('.coin-count').forEach(el => { el.textContent = fmt(P().coins); });
  if (name === 'login') renderLogin();
  if (name === 'menu') renderMenu();
  if (name === 'tower') renderTower();
  if (name === 'vs') renderVs();
  if (name === 'local') renderLocal();
  if (name === 'missions') renderMissions();
  if (name === 'shop') renderShop();
  if (name === 'profile') renderProfile();
  if (name === 'help') renderHelp();
  if (name === 'creator') renderCreator();
  if (name === 'rewards') renderRewards();
  if (name === 'online' && !account?.cloud) peerOnline.refresh(); // 방 코드 대전 (이 기기 계정, 손님)
  if (name === 'friends') renderFriendsScreen();
  ui.render(name); // 온라인 계정: 온라인, 친구, 1:1 대화
  watchFriends(name === 'friends' && legacyOn());
}

document.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => {
  sound.sfx('click');
  const to = btn.dataset.go;
  if (to === 'solo') return startSolo();
  if (to === 'practice') return startPractice();
  if (to === 'online' && roomNet().active && screen === 'online') return;
  show(to);
}));

// ---------- 뒤에서 도는 AI 시범 경기 ----------
function startDemo() {
  demo = new Match({ seed: (Math.random() * 2 ** 31) | 0, specs: [{ kind: 'ai', level: 4 }, { kind: 'ai', level: 5 }], firstTo: 99, brain });
  renderer.setTheme('default');
  const skin = P().equip.skin, effect = P().equip.effect;
  renderer.setup([{ name: '', skin, effect }, { name: '', skin, effect }], { insets: { top: 0, bottom: 0, left: 0, right: 0 } });
}

// ---------- 로그인 ----------
// 새 계정과 로그인은 서버의 온라인 계정이다. 이 기기에만 있던 예전 계정은 목록에 남아서 그대로 들어가거나 온라인 계정으로 옮긴다.
let loginTarget = null, migrating = null; // migrating: { local, password } 기기 비밀번호를 확인한 뒤
function renderLogin() {
  const list = $('login-accounts');
  list.innerHTML = '';
  const locals = store.accounts.filter(a => !a.migratedTo);
  for (const a of locals.sort((x, y) => (y.last || 0) - (x.last || 0))) {
    const b = document.createElement('button');
    b.innerHTML = `<span>👤 ${esc(a.name)}</span><small>Lv.${a.progress.level} · 🪙${fmt(a.progress.coins)}</small>`;
    b.onclick = () => { loginTarget = a; $('login-name').textContent = a.name; loginPanel('login'); $('login-pass').focus(); };
    list.append(b);
  }
  loginPanel(migrating ? 'migrate' : 'main');
}
function loginPanel(which) {
  const locals = store.accounts.some(a => !a.migratedTo);
  $('login-main').hidden = which !== 'main';
  $('login-accounts').hidden = which !== 'main' || !locals;
  $('login-accounts-title').hidden = which !== 'main' || !locals;
  $('login-form').hidden = which !== 'login';
  $('signup-form').hidden = which !== 'signup';
  $('net-login-form').hidden = which !== 'netLogin';
  $('migrate-form').hidden = which !== 'migrate';
  $('import-form').hidden = which !== 'import';
  $('login-msg').textContent = '';
}
const loginMsg = text => { $('login-msg').textContent = text; sound.sfx('bump'); };
// 단추를 누르고 서버 답을 기다리는 동안 다시 못 누르게
async function busy(form, fn) {
  const buttons = [...$(form).querySelectorAll('button')];
  buttons.forEach(b => { b.disabled = true; });
  try { return await fn(); } finally { buttons.forEach(b => { b.disabled = false; }); }
}
$('go-signup').onclick = () => { loginPanel('signup'); $('signup-name').focus(); };
$('go-net-login').onclick = () => { loginPanel('netLogin'); $('net-login-name').focus(); };
$('go-import').onclick = () => { loginPanel('import'); $('import-code').focus(); };
$('go-guest').onclick = () => {
  guest = { name: '손님', guest: true, progress: newProgress() };
  account = null;
  toast('손님은 기록이 저장되지 않아. 계정을 만들면 레벨·코인이 저장돼!');
  afterLogin();
};
['login-back', 'signup-back', 'net-login-back', 'import-back'].forEach(id => { $(id).onclick = () => loginPanel('main'); });
$('login-form').onsubmit = async e => {
  e.preventDefault();
  const r = await login(store, loginTarget?.name, $('login-pass').value);
  $('login-pass').value = '';
  if (!r.ok) { loginMsg(r.error); return; }
  account = r.account; guest = null; save(); afterLogin();
};
$('signup-form').onsubmit = e => {
  e.preventDefault();
  busy('signup-form', async () => {
    try {
      const user = await net.signup($('signup-name').value.trim(), $('signup-pass').value);
      $('signup-pass').value = '';
      await enterCloud(user);
      toast(`환영해, ${user.nickname}! 🪙100 선물이야.`, true);
      save();
      afterLogin();
    } catch (error) { loginMsg(error.message); }
  });
};
$('net-login-form').onsubmit = e => {
  e.preventDefault();
  busy('net-login-form', async () => {
    try {
      const user = await net.login($('net-login-name').value.trim(), $('net-login-pass').value);
      $('net-login-pass').value = '';
      await enterCloud(user);
      toast(`다시 왔구나, ${user.nickname}!`);
      afterLogin();
    } catch (error) { loginMsg(error.message); }
  });
};
$('import-form').onsubmit = e => {
  e.preventDefault();
  const r = importCode(store, $('import-code').value);
  if (!r.ok) { $('login-msg').textContent = r.error; return; }
  delete r.account.migratedTo;
  save();
  $('import-code').value = '';
  toast(`${r.account.name} 기록을 가져왔어! 비밀번호로 로그인하거나 온라인 계정으로 옮겨 줘.`);
  renderLogin();
};

// ---------- 이 기기 계정 → 온라인 계정 ----------
// 기기 비밀번호를 다시 확인하고 같은 닉네임으로 가입한다. 닉네임이 이미 있으면 로그인하거나 새 닉네임을 고른다.
// 서버 가입(또는 로그인)과 첫 저장 올리기가 모두 끝나야 기기 계정을 "옮김"으로 표시한다 (지우지 않음).
$('migrate-go').onclick = async () => {
  const local = loginTarget, password = $('login-pass').value;
  if (!local) return;
  if (!(await checkLocalPassword(local, password))) { loginMsg('비밀번호가 달라. 다시 해 봐!'); return; }
  $('login-pass').value = '';
  migrating = { local, password };
  await busy('login-form', () => drainLegacy(local));
  await runMigration({ nickname: local.name, password, mode: 'signup' });
};
function migratePanel(text, { fields = true, retry = false } = {}) {
  loginPanel('migrate');
  $('migrate-text').textContent = text;
  $('migrate-fields').hidden = !fields;
  $('migrate-retry').hidden = !retry;
}
// 서버에 올리는 기록에는 친구 코드 기록(progress.social)을 넣지 않는다. 그 기록은 이 기기의 예전 계정에 그대로 남는다.
const cloudProgress = progress => ({ ...sanitize(progress), social: emptySocial() });
// 옮기기 전에 친구 우체통에 남은 편지를 받아서 예전 계정의 친구 기록에 넣는다 (안 되면 기존 친구 화면을 열 때 다시 받는다)
async function drainLegacy(local) {
  const r = await drainMailbox(local?.progress?.social, mail).catch(() => ({ ok: false, count: 0 }));
  if (r.count) persistStore();
  return r;
}
async function runMigration(params) {
  const { local } = migrating;
  const result = await busy('migrate-form', () => busy('login-form', () => migrateLocal({
    local, account: net, marker, ...params,
    upload: async (progress, importId) => {
      const acc = openCloud(net.user);
      await cloud.importLocal(cloudProgress(progress), importId);
      acc.progress = sanitize(cloud.data);
      account = acc;
    },
  })));
  if (result.ok) {
    markMigrated(store, local.id, result.user.nickname);
    persistStore();
    migrating = null; guest = null;
    startSocial();
    toast(`☁️ ${result.user.nickname} 온라인 계정으로 옮겼어! 이제 다른 기기에서도 이어 할 수 있어.`, true);
    save();
    afterLogin();
    return;
  }
  migrating.last = params;
  if (result.step === 'upload') { stopCloud(); migratePanel(result.message, { fields: false, retry: true }); return; }
  $('migrate-nick').value = params.nickname;
  $('migrate-pass').value = '';
  migratePanel(result.code === 'nickname-taken'
    ? `"${params.nickname}" 닉네임은 이미 온라인에 있어. 내 온라인 계정이면 그 비밀번호로 로그인해서 옮기고, 아니면 새 닉네임과 비밀번호를 정해 줘.`
    : result.message);
}
$('migrate-form').onsubmit = e => {
  e.preventDefault();
  if (migrating) runMigration({ nickname: $('migrate-nick').value.trim(), password: $('migrate-pass').value, mode: 'signup' });
};
$('migrate-login').onclick = () => {
  if (migrating) runMigration({ nickname: $('migrate-nick').value.trim(), password: $('migrate-pass').value, mode: 'login' });
};
$('migrate-retry').onclick = () => { if (migrating?.last) runMigration(migrating.last); };
// 그만두기: 기기 계정은 그대로. 옮기는 중에 서버에 로그인했으면 이 기기에서는 로그아웃한다.
$('migrate-back').onclick = async () => {
  migrating = null;
  marker.clear();
  stopCloud();
  if (net.loggedIn) await net.logout().catch(() => {});
  renderLogin();
};

// ---------- 온라인 계정 세션 ----------
function openCloud(user) {
  stopCloud();
  const acc = { name: user.nickname, cloud: true, uid: user.id, progress: newProgress() };
  cloud = new CloudSave({
    client: net, uid: user.id, storage: netStore, initial: newProgress,
    apply: data => { acc.progress = sanitize(data); if (account === acc && screen) renderScreen(screen); },
    onConflict: info => ui.chooseSave(info),
    onStatus: state => ui.cloudStatus(state),
    onAuthLost: code => lostLogin(code),
  });
  if (cloud.data) acc.progress = sanitize(cloud.data);
  return acc;
}
function stopCloud() { cloud?.stop(); cloud = null; }
// 로그인한 뒤: 서버 저장을 읽고(wait 이면 다 읽을 때까지 기다림), 친구 알림을 켠다
async function enterCloud(user, { wait = true } = {}) {
  const acc = openCloud(user);
  account = acc; guest = null;
  if (store.current) { logout(store); persistStore(); }
  const loading = cloud.start().then(data => { if (data && !cloud?.dirty) acc.progress = sanitize(data); }).catch(() => {});
  if (wait) await loading; else loading.then(() => { if (account === acc && screen) renderScreen(screen); });
  startSocial();
}
function startSocial() {
  hub?.close();
  hub = new Social(net, ui.socialHooks);
  hub.live().catch(() => {});
  ui.refreshCounts();
}
function stopSocial() { hub?.close(); hub = null; ui.reset(); }
// 로그인이 풀렸거나(다른 곳에서 로그아웃, 정지) 서버가 내보냈을 때
function lostLogin(reason) {
  if (!account?.cloud) return;
  online.leave();
  stopSocial(); stopCloud();
  account = null; guest = null;
  if (match) { match = null; game = null; $('result').hidden = true; startDemo(); }
  toast(reason === 'suspended' ? '이 계정은 정지됐어.' : '다시 로그인해 줘.');
  show('login');
}
// 옮기던 중 앱이 꺼졌으면(가입은 됐는데 첫 저장 전) 다음에 켤 때 마저 올린다. 안 되면 기기 계정으로 돌아간다.
async function resumeMigration(local) {
  await drainLegacy(local);
  const acc = openCloud(net.user);
  try {
    await cloud.importLocal(cloudProgress(local.progress), importIdFor(local));
    acc.progress = sanitize(cloud.data);
    markMigrated(store, local.id, net.user.nickname); persistStore();
    marker.clear();
    account = acc; guest = null;
    startSocial();
    toast(`☁️ ${net.user.nickname} 온라인 계정으로 옮겼어!`, true);
    afterLogin();
  } catch {
    stopCloud(); marker.clear();
    await net.logout().catch(() => {});
    if (screen === 'login') { renderLogin(); $('login-msg').textContent = '온라인 계정으로 옮기던 기록을 올리지 못했어. 인터넷을 확인하고 다시 옮겨 줘.'; }
  }
}
function afterLogin() {
  creator.lock();
  resetSocialSession();
  pendingPlay = 0; unsavedPlay = 0;
  $('creator-result').textContent = '';
  $('spin-result').textContent = '';
  sound.sfx('coin');
  startDemo();
  show('menu');
  syncFriendNet();
  ensureMail();
}

// ---------- 메뉴 ----------
function renderMenu() {
  const p = P();
  $('chip-name').textContent = me()?.name || '손님';
  $('chip-level').textContent = p.level;
  $('chip-coins').textContent = fmt(p.coins);
  $('chip-xp').style.width = `${Math.min(100, (p.xp / xpToNext(p.level)) * 100)}%`;
  const f = currentFloor(p.tower);
  $('menu-tower-sub').textContent = p.tower.cleared ? (p.tower.comet ? (p.tower.nova ? '🌟 초신성까지 모두 정복!' : '🌟 혜성 너머 초신성 층이 열렸어!') : '✨ 탑 너머에 혜성이 보여…') : `${f}층 ${FLOORS[f - 1].name} 도전 중`;
  const n = unclaimedCount(p);
  $('mission-badge').hidden = !n;
  $('mission-badge').textContent = n;
  $('menu-event').textContent = eventText();
  const rewards = rewardView(p);
  const gifts = Number(!rewards.dailyClaimed) + Number(!rewards.spinClaimed) + rewards.time.filter(r => r.ready && !r.claimed).length;
  $('reward-badge').hidden = !gifts;
  $('reward-badge').textContent = gifts;
  $('practice-badge').hidden = !!p.tutorial; // 연습하기를 끝내기 전까지 NEW
  updateSocialBadges();
}
$('profile-chip').onclick = () => { sound.sfx('click'); show('profile'); };

// ---------- 타워 ----------
function iconCanvas(id, size = 64) {
  const c = document.createElement('canvas');
  c.width = size * 2; c.height = size * 2;
  const ctx = c.getContext('2d');
  drawGarbageIcon(ctx, id, size, size, size * 1.6);
  return c;
}
function renderTower() {
  const t = P().tower;
  const list = $('tower-list');
  list.innerHTML = '';
  for (let floor = FLOORS.length; floor >= 1; floor--) {
    const info = FLOORS[floor - 1];
    const state = floorState(t, floor);
    if (state === 'hidden') continue;
    const li = document.createElement('li');
    li.className = `floor ${state}${info.secret ? ' secret' : ''}`;
    const help = helpLevel(t, floor);
    const label = state === 'cleared' ? '✔ 클리어' : state === 'open' ? '▶ 도전 가능' : '🔒 잠김';
    li.innerHTML = `<div class="num">${info.secret ? '★' : floor}<small>${info.secret ? '비밀' : '층'}</small></div><div class="ic"></div>
      <div><h3>${esc(info.name)}</h3><p>${esc(info.boss)} · AI 레벨 ${info.ai}${help ? ` · 도움 ${help}단계` : ''}</p><p class="state">${label}${state === 'cleared' && info.secret ? (floor === 8 ? ' · 오로라 갑옷 + 초신성 효과 획득' : ' · 혜성 꼬리 효과 획득') : ''}</p></div>`;
    li.querySelector('.ic').append(iconCanvas(info.icon, 32));
    if (state === 'open' || state === 'cleared') {
      const b = document.createElement('button');
      b.className = state === 'open' ? 'primary' : 'ghost';
      b.textContent = state === 'open' ? '도전!' : '다시';
      b.onclick = () => { sound.sfx('click'); startTower(floor); };
      li.append(b);
    } else li.append(document.createElement('span'));
    list.append(li);
  }
  $('tower-ending').hidden = !t.cleared;
  $('tower-comet-ending').hidden = !t.comet;
}
$('tower-ending').onclick = () => runEnding(() => show('tower'));
$('tower-comet-ending').onclick = () => runEnding(() => show('tower'), 'comet');

// ---------- AI 대전 설정 ----------
let vsLevel = 3;
function faceCanvas(char, size = 72, mood = 'idle') {
  const c = document.createElement('canvas');
  c.width = size * 2; c.height = size * 2;
  drawCharacter(c.getContext('2d'), char, size, size, size * 1.9, mood, 0);
  return c;
}
function renderVs() {
  const grid = $('vs-levels');
  grid.innerHTML = '';
  for (let lv = 1; lv <= FLOORS.length; lv++) {
    const info = FLOORS[lv - 1];
    const locked = floorState(P().tower, lv) === 'hidden';
    const b = document.createElement('button');
    b.className = `level${vsLevel === lv ? ' on' : ''}`;
    b.disabled = locked;
    b.append(faceCanvas(info.char, 36));
    b.insertAdjacentHTML('beforeend', `<b>${locked ? '???' : esc(info.boss)}</b><small>AI 레벨 ${lv} · ${locked ? (lv === 8 ? '혜성을 깨면 열려' : '타워를 깨면 열려') : esc(AI_LEVELS[lv].name)}</small>`);
    b.onclick = () => { vsLevel = lv; sound.sfx('click'); renderVs(); };
    grid.append(b);
  }
}
function segValue(id) { return Number($(id).querySelector('.on')?.dataset.v || 1); }
// 몇 판 먼저 이기면 승리? 단추: 1·2·3·5·10·25·30·40·50판 (처음에는 2판)
for (const id of ['vs-first', 'local-first', 'online-first'])
  $(id).innerHTML = FIRST_TO.map(n => `<button data-v="${n}"${n === 2 ? ' class="on"' : ''}>${n}판</button>`).join('');
document.querySelectorAll('.seg').forEach(seg => seg.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || seg.id === 'shop-tabs') return;
  seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  sound.sfx('click');
  if (seg.id === 'online-first') roomNet().setFirstTo(Number(b.dataset.v));
}));
$('vs-start').onclick = () => startVs(vsLevel, segValue('vs-first'));
$('local-start').onclick = () => startLocal(segValue('local-first'));

// ---------- 게임 시작 ----------
// 아이폰의 다이내믹 아일랜드·노치·홈 막대가 차지하는 자리 (웹에서는 보통 모두 0)
const safeProbe = document.createElement('div');
safeProbe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
document.body.append(safeProbe);
function safeArea() {
  const s = getComputedStyle(safeProbe), px = v => parseFloat(v) || 0;
  return { top: px(s.paddingTop), right: px(s.paddingRight), bottom: px(s.paddingBottom), left: px(s.paddingLeft) };
}
function computeInsets() {
  const sa = safeArea();
  // 위쪽 버튼 줄(#hud) 바로 아래부터. 연습하기에서는 꼬마 젤리 말풍선 자리도 비운다.
  const top = Math.max(8, sa.top) + 46 + (practice ? $('coach').offsetHeight + 8 : 0);
  if (!coarse) return { top, bottom: 8 + sa.bottom, left: 8 + sa.left, right: 8 + sa.right };
  const portrait = innerHeight > innerWidth;
  if (portrait) return { top, bottom: 94 + Math.max(10, sa.bottom), left: 4 + sa.left, right: 4 + sa.right };
  return { top: Math.max(8, sa.top) + 38, bottom: 6 + sa.bottom, left: 205 + sa.left, right: 205 + sa.right };
}
function myView(extra = {}) {
  return { name: me()?.name || '나', level: P().level, skin: P().equip.skin, effect: P().equip.effect, char: 'hero', color: '#ffe45c', ...extra };
}
function startGame(cfg) {
  closePromo(true);
  demo = null;
  game = { ...cfg, tracked: 0, started: performance.now(), warned: false };
  const seed = cfg.seed ?? ((Math.random() * 2 ** 31) | 0);
  match = new Match({ seed, colors: cfg.colors, minGroup: cfg.minGroup, gravityScale: cfg.gravityScale, target: cfg.target, specs: cfg.specs, firstTo: cfg.firstTo || 1, solo: cfg.mode === 'solo' || cfg.mode === 'practice', online: cfg.online || null, makeRemote: cfg.makeRemote, brain });
  if (cfg.slow && match.ai[1]) match.ai[1].slow = cfg.slow;
  renderer.setTheme(cfg.theme || 'default');
  if (cfg.mode !== 'practice') endPractice();
  renderer.setup(cfg.views, { solo: cfg.mode === 'solo' || cfg.mode === 'practice', ghost: P().settings.ghost !== false, insets: computeInsets() });
  hideScreens();
  $('hud').hidden = false;
  $('hud-chat').hidden = cfg.mode !== 'online' || !chatOn();
  if (chatWith?.kind === 'room') $('chat').classList.add('compact');
  $('hud-title').textContent = cfg.title || '';
  $('touch').hidden = !coarse;
  document.body.classList.toggle('duo', cfg.mode === 'local');
  document.querySelector('#touch .pad[data-side="1"]').hidden = cfg.mode !== 'local';
  controls.mode = cfg.mode === 'local' ? 'duo' : 'solo';
  controls.reset();
  controls.enabled = true;
  paused = false;
  sound.play(cfg.music || 'battle');
}

function startTower(floor) {
  const info = FLOORS[floor - 1];
  const help = helpLevel(P().tower, floor);
  const cfg = {
    mode: 'tower', floor, title: `${info.secret ? '비밀 ' : ''}${info.name} · ${info.boss}`, theme: info.theme,
    music: floor >= 6 ? 'boss' : 'battle', firstTo: 1, slow: 1 + help * 0.15,
    specs: [{ kind: 'human' }, { kind: 'ai', level: info.ai }],
    views: [myView(), { name: info.boss, level: 0, skin: 'classic', effect: 'sparkle', char: info.char, color: '#ffb3c8' }],
  };
  talk(info, info.intro, () => { startGame(cfg); if (help) toast(`도움 ${help}단계: ${info.boss}의 손이 조금 느려져!`); });
}
function startVs(level, firstTo) {
  const info = FLOORS[level - 1];
  startGame({
    mode: 'vs', level, title: `AI 대전 · ${info.boss}`, theme: info.theme, music: level >= 6 ? 'boss' : 'battle', firstTo,
    specs: [{ kind: 'human' }, { kind: 'ai', level }],
    views: [myView(), { name: info.boss, level: 0, skin: 'classic', effect: 'sparkle', char: info.char, color: '#ffb3c8' }],
  });
}
function renderLocal() {
  const current = getMap(P().settings.localMap);
  $('local-maps').innerHTML = MAPS.map(map => `<button class="map-card${map.id === current.id ? ' selected' : ''}" data-map="${map.id}" style="--map-color:${map.tint}" aria-pressed="${map.id === current.id}"><span>${map.emoji}</span><b>${map.name}</b><small>${map.desc}</small></button>`).join('');
  $('local-map-tip').textContent = `${current.emoji} ${current.tip}`;
  $('local-maps').querySelectorAll('button').forEach(button => { button.onclick = () => {
    P().settings.localMap = button.dataset.map; save(); sound.sfx('click'); renderLocal();
  }; });
}
function startLocal(firstTo, mapId = P().settings.localMap) {
  const arena = getMap(mapId);
  const name2 = ($('local-name').value || '2P').slice(0, 10);
  startGame({
    mode: 'local', map: arena.id, title: `${arena.emoji} ${arena.name} · ${arena.minGroup}개 연결 · ${arena.colors}색`, theme: arena.theme, music: 'battle', firstTo,
    colors: arena.colors, minGroup: arena.minGroup, gravityScale: arena.gravityScale, target: arena.target,
    specs: [{ kind: 'human' }, { kind: 'human' }],
    views: [myView({ char: null }), { name: name2, skin: 'classic', effect: 'sparkle', char: null, color: '#9fe3ff' }],
  });
}
function startSolo() {
  startGame({
    mode: 'solo', title: '혼자 하기 · 끝없이', theme: 'meadow', music: 'menu', firstTo: 1,
    specs: [{ kind: 'human' }], views: [myView()],
  });
}

// ---------- 연습하기 (처음 하는 사람) ----------
function startPractice(index = 0) {
  startGame({
    mode: 'practice', title: '🐣 연습하기', theme: 'meadow', music: 'menu', firstTo: 1, gravityScale: 0.6,
    specs: [{ kind: 'human' }], views: [myView()],
  });
  setLesson(index);
}
function setLesson(index) {
  practice = { index, judge: newJudge(), freeze: false };
  const lesson = LESSONS[index];
  showCoach({
    step: `연습 ${index + 1} / ${LESSONS.length}`, title: lesson.title, mood: 'idle',
    text: lesson.text || (coarse ? lesson.touch : lesson.keys),
    buttons: [['ghost', '건너뛰기', () => { sound.sfx('click'); if (index + 1 < LESSONS.length) setLesson(index + 1); else finishPractice(); }]],
  });
  resetLessonField(match.players[0], lesson);
}
// 필드를 수업 모양으로 되돌리고, 짝 순서도 처음부터
function resetLessonField(p, lesson) {
  p.cells.fill(0);
  p.cells.set(lessonCells(lesson));
  p.refreshHeights();
  p.seq = lessonSeq(lesson, p.seq);
  p.pairIndex = 0;
  Object.assign(p, { piece: null, falling: [], popping: null, chain: 0, chaining: false, incoming: 0 });
  if (p.state !== 'ready') { p.state = 'spawn'; p.timer = 1; }
}
function practiceEvent(e) {
  if (!practice || practice.freeze) return;
  const lesson = LESSONS[practice.index];
  const verdict = judge(lesson, practice.judge, e);
  if (verdict === 'done') {
    practice.freeze = true;
    sound.sfx('mission'); haptic('success');
    showCoach({ step: `연습 ${practice.index + 1} / ${LESSONS.length}`, title: '잘했어! ✨', text: lesson.done, mood: 'happy' });
    const next = practice.index + 1;
    setTimeout(() => {
      if (!practice || game?.mode !== 'practice') return;
      if (next < LESSONS.length) setLesson(next); else finishPractice();
    }, 2400);
  } else if (verdict === 'retry') {
    practice.freeze = true;
    sound.sfx('bump');
    showCoach({ step: `연습 ${practice.index + 1} / ${LESSONS.length}`, title: '다시 해 보자!', text: lesson.retry, mood: 'sad' });
    setTimeout(() => { if (practice && game?.mode === 'practice') setLesson(practice.index); }, 2200);
  }
}
// 연습 중에 쌓여서 지면 그 수업을 처음부터
function practiceFail() {
  const index = practice?.index ?? 0;
  setTimeout(() => { if (game?.mode === 'practice') startPractice(index); }, 900);
}
function finishPractice() {
  if (!practice) return;
  practice.freeze = true;
  const p = P(), first = !p.tutorial;
  p.tutorial = true;
  if (first) {
    const r = grantReward(p, { coins: 100, xp: 50 });
    for (const level of r.lv.levels) trackEvent({ type: 'level', level });
    toast(`🎁 연습 완료 선물 ${rewardText(r)}`, true);
  }
  save();
  sound.sfx('level'); haptic('success');
  showCoach({
    step: '연습 끝!', title: '이제 진짜 대결!', mood: 'happy',
    text: '큰 연쇄를 만들수록 상대에게 방해 젤리가 많이 날아가. 1층 꼬마 젤리에게 도전해 볼까?',
    buttons: [
      ['primary', '🗼 1층 도전', () => { sound.sfx('click'); quitGame(); startTower(1); }],
      ['ghost', '메뉴로', () => { sound.sfx('click'); quitGame(); }],
    ],
  });
}
function endPractice() {
  practice = null;
  $('coach').hidden = true;
  $('toasts').style.top = '';
}
let coachTimer = null;
function showCoach({ step, title, text, mood = 'idle', buttons = [] }) {
  $('coach').hidden = false;
  $('coach-step').textContent = step;
  $('coach-title').textContent = title;
  $('coach-text').textContent = text;
  const row = $('coach-buttons');
  row.innerHTML = '';
  for (const [cls, label, fn] of buttons) {
    const b = document.createElement('button');
    b.className = cls; b.textContent = label; b.onclick = fn;
    row.append(b);
  }
  const face = $('coach-face'), ctx = face.getContext('2d'), t0 = performance.now();
  clearInterval(coachTimer);
  coachTimer = setInterval(() => {
    if ($('coach').hidden) return clearInterval(coachTimer);
    ctx.clearRect(0, 0, face.width, face.height);
    drawCharacter(ctx, 'poyo', 60, 64, 112, mood, (performance.now() - t0) / 1000);
  }, 50);
  if (match) renderer.setInsets(computeInsets());
  // 챌린지 알림 같은 쪽지는 말풍선 아래에 뜨게 해서 꼬마 젤리 말을 가리지 않는다
  $('toasts').style.top = `${Math.round($('coach').getBoundingClientRect().bottom + 8)}px`;
}

// ---------- 층 주인 대사 ----------
let talkDone = null, talkTimer = null, talkState = null;
function talk(info, text, done) {
  talking = true;
  talkDone = done;
  talkState = { n: 0, text };
  $('talk').hidden = false;
  $('talk-floor').textContent = info.secret ? '★ 비밀의 층' : `${info.floor}층 · ${info.name}`;
  $('talk-name').textContent = info.boss;
  $('talk-text').textContent = '';
  const face = $('talk-face'), ctx = face.getContext('2d');
  const t0 = performance.now(), state = talkState;
  clearInterval(talkTimer);
  talkTimer = setInterval(() => {
    const t = (performance.now() - t0) / 1000;
    ctx.clearRect(0, 0, face.width, face.height);
    drawCharacter(ctx, info.char, 80, 84, 150, state.n < text.length ? 'attack' : 'idle', t);
    if (state.n < text.length) { state.n++; $('talk-text').textContent = text.slice(0, state.n); if (state.n % 2) sound.sfx('talk'); }
  }, 33);
}
function closeTalk() {
  if (!talking || !talkState) return;
  // 글자가 아직 나오는 중이면 한 번에 다 보여 준다
  if (talkState.n < talkState.text.length) { talkState.n = talkState.text.length; $('talk-text').textContent = talkState.text; return; }
  clearInterval(talkTimer);
  talking = false;
  talkState = null;
  $('talk').hidden = true;
  const done = talkDone;
  talkDone = null;
  done?.();
}
$('talk').addEventListener('click', () => { sound.sfx('click'); closeTalk(); });

// ---------- 일시정지 ----------
function pause(on) {
  if (!match || game?.mode === 'online') return;
  paused = on;
  $('pause').hidden = !on;
  controls.reset();
}
$('hud-pause').onclick = () => {
  if (game?.mode === 'online') { if (confirm('온라인 대전을 그만할까? 방에서 나가게 돼.')) quitGame(); return; }
  pause(true);
};
$('pause-resume').onclick = () => pause(false);
$('pause-retry').onclick = () => { $('pause').hidden = true; paused = false; retry(); };
$('pause-quit').onclick = () => { $('pause').hidden = true; paused = false; quitGame(); };
function updateHudButtons() {
  $('hud-sound').textContent = device.sound ? '🔊' : '🔇';
  $('hud-music').style.opacity = device.music ? 1 : 0.4;
}
$('hud-sound').onclick = () => { device.sound = !device.sound; sound.setSfx(device.sound); updateHudButtons(); save(); };
$('hud-music').onclick = () => { device.music = !device.music; sound.setMusic(device.music); updateHudButtons(); save(); };
updateHudButtons();
document.addEventListener('visibilitychange', () => { if (document.hidden && match && !paused && game?.mode !== 'online' && match.phase !== 'over') pause(true); });

controls.onKey = e => {
  if ($('seonn-promo').open) return true;
  if (talking && (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyZ')) { e.preventDefault(); closeTalk(); return true; }
  if (!$('result').hidden && (e.code === 'Enter')) { e.preventDefault(); $('result-buttons').querySelector('button')?.click(); return true; }
  if (match && (e.code === 'Escape' || e.code === 'KeyP') && !talking && $('result').hidden) { e.preventDefault(); pause(!paused); return true; }
  if (paused && e.code === 'Enter') { pause(false); return true; }
  return false;
};

// 안드로이드 뒤로 가기 단추: 열린 창을 닫거나 한 칸 뒤로. 첫 화면에서만 false(앱 끄기)
function handleBack() {
  if ($('seonn-promo').open) { $('promo-close').click(); return true; }
  if (!$('ending').hidden) { $('ending-skip').click(); return true; }
  // 기록 고르기는 둘 중 하나를 골라야 끝난다 (뒤로 가기로 넘기지 않는다)
  if (!$('cloud-conflict').hidden) return true;
  if (!$('ask').hidden) { $('ask-cancel').click(); return true; }
  if (!$('invite-pop').hidden) { $('invite-no').click(); return true; }
  if (talking) { closeTalk(); return true; }
  if (!$('result').hidden) { [...$('result-buttons').querySelectorAll('button')].pop()?.click(); return true; }
  if (match) {
    if (game?.mode === 'online') $('hud-pause').click();
    else pause(!paused);
    return true;
  }
  if (screen === 'login') {
    if (!$('migrate-form').hidden) { $('migrate-back').click(); return true; }
    if ($('login-main').hidden) { loginPanel('main'); return true; }
    return false;
  }
  if (screen === 'menu') return false;
  if (!screen) return true;
  if (!$('delete-confirm').hidden) { $('delete-cancel').click(); return true; }
  if (screen === 'friends' && !$('friends-legacy').hidden) { $('legacy-back').click(); return true; }
  const back = document.querySelector(`#scr-${screen} .head .back`);
  if (back) back.click(); else show('menu');
  return true;
}
onBackButton(handleBack);

function quitGame() {
  if (game?.mode === 'online') roomNet().leave();
  if (chatWith?.kind === 'room') closeChat();
  endPractice();
  match = null;
  const back = game?.mode === 'tower' ? 'tower' : game?.mode === 'online' ? 'online' : 'menu';
  game = null;
  $('result').hidden = true;
  startDemo();
  show(back);
}
function retry() {
  const g = game;
  if (!g) return;
  $('result').hidden = true;
  match = null;
  if (g.mode === 'tower') startTower(g.floor);
  else if (g.mode === 'vs') startVs(g.level, g.firstTo);
  else if (g.mode === 'local') startLocal(g.firstTo, g.map);
  else if (g.mode === 'solo') startSolo();
  else if (g.mode === 'practice') startPractice(practice?.index ?? 0);
  else if (g.mode === 'online') roomNet().rematch();
}

// ---------- 매 프레임 ----------
let last = performance.now(), acc = 0;
function loop(now) {
  recordPlayTime(Math.max(0, Math.min(0.25, (now - last) / 1000)));
  acc += Math.min(250, now - last);
  last = now;
  const step = 1000 / 60;
  while (acc >= step) { acc -= step; tick(); }
  renderer.draw(match || demo, now / 1000);
  requestAnimationFrame(loop);
}
function tick() {
  const m = match || demo;
  if (!m || (match && (paused || talking))) return;
  if (match && practice?.freeze) { renderer.step(m); return; } // 연습 칭찬 중: 젤리는 멈추고 반짝이 효과만 움직인다
  const inputs = match ? controls.frame(2, m.players.map(p => p.state === 'control')) : [];
  m.step(inputs);
  for (const e of m.events) handle(e, m);
  m.events.length = 0;
  renderer.step(m);
  if (match && game?.mode === 'online') roomNet().tick(match);
  if (match && game) watchDanger(m);
}

let heartClock = 0;
function watchDanger(m) {
  const p = m.players[0];
  if (m.phase !== 'play' || !p?.h) return;
  if (p.h[2] >= 10 && ++heartClock % 48 === 0) sound.sfx('heart');
}

function human(m, i) { return m.specs[i]?.kind === 'human'; }
function mode() { return game?.mode === 'solo' ? 'solo' : game?.mode; }
function trackEvent(ev) {
  const done = track(P(), ev);
  for (const d of done) { toast(`🎯 챌린지 완료! ${d.title}`, true); sound.sfx('mission'); haptic('light'); }
  if (done.length) save();
}

function handle(e, m) {
  renderer.onEvent(e, m);
  if (m === demo) return;
  if (game.mode === 'practice' && e.p === 0) practiceEvent(e);
  const mine = e.p === game.tracked;
  switch (e.type) {
    case 'rotate': if (human(m, e.p)) sound.sfx(e.quick ? 'quick' : 'rotate'); break;
    case 'move': if (human(m, e.p)) sound.sfx('move'); break;
    case 'bump': if (human(m, e.p)) sound.sfx('bump'); break;
    case 'lock': sound.sfx('lock'); break;
    case 'drop': if (human(m, e.p)) sound.sfx('drop'); break;
    case 'pop': {
      sound.sfx('pop', e.chain);
      setTimeout(() => sound.sfx('burst'), 560);
      if (human(m, e.p)) haptic(e.chain >= 5 ? 'heavy' : e.chain >= 3 ? 'medium' : 'light');
      if (game.online && mine) roomNet().event(e);
      if (mine) trackEvent({ type: 'pop', mode: mode(), puyos: e.puyos, colors: new Set(e.colors).size, maxGroup: Math.max(...e.groups.map(g => g.length)) });
      break;
    }
    case 'chainStart': if (game.online && mine) roomNet().send({ t: 'cs' }); break;
    case 'chainEnd':
      if (game.online && mine) roomNet().send({ t: 'ce' });
      if (mine) trackEvent({ type: 'chain', mode: mode(), chain: e.chain, made: e.made, sent: e.sent });
      break;
    case 'allClear': sound.sfx('allclear'); if (human(m, e.p)) haptic('success'); if (game.online && mine) roomNet().event(e); if (mine) trackEvent({ type: 'allClear', mode: mode() }); break;
    case 'offset': sound.sfx('offset'); if (game.online && mine) roomNet().event(e); if (mine) trackEvent({ type: 'offset', mode: mode(), amount: e.amount }); break;
    case 'incoming':
      if (human(m, e.p) && m.players[e.p].incoming >= 30 && !game.warned) { game.warned = true; sound.sfx('warn'); }
      break;
    case 'garbage': sound.sfx('garbage', e.count); if (human(m, e.p)) haptic(e.count >= 6 ? 'heavy' : 'medium'); game.warned = false; if (game.online && mine) roomNet().event(e); break;
    case 'remoteSend': roomNet().send({ t: 'atk', n: e.amount }); break;
    case 'count': sound.sfx('count', 0); break;
    case 'go': sound.sfx('count', 1); break;
    case 'dead': if (game.online && mine) roomNet().send({ t: 'dead', r: m.round }); break;
    case 'roundEnd': if (game.mode === 'practice') { practiceFail(); break; } roundEnd(e, m); break;
    case 'round': renderer.resetRound(); break;
    case 'matchEnd': if (game.mode !== 'practice') finishMatch(); break;
    default: break;
  }
}

function roundEnd(e, m) {
  if (m.solo) { renderer.setResult(0, ''); sound.sfx('lose'); haptic('warning'); return; }
  const w = e.winner;
  m.players.forEach((_, i) => renderer.setResult(i, w < 0 ? 'draw' : i === w ? 'win' : 'lose'));
  const humans = m.specs.filter(s => s.kind === 'human').length;
  if (humans === 2) { sound.sfx('win'); haptic('success'); }
  else { const won = w === game.tracked; sound.sfx(won ? 'win' : 'lose'); haptic(won ? 'success' : 'error'); }
  if (game.online) roomNet().roundOver(e, m);
}

// ---------- 결과와 보상 ----------
function finishMatch() {
  const m = match, g = game;
  if (!m || !g || g.finished) return;
  g.finished = true;
  controls.enabled = false;
  const p = P();
  const win = m.winner() === 0;
  const totals = m.totals(0);
  let coins = 0, xp = 0, title = win ? '승리!' : '패배…', sub = '', ending = false;
  const buttons = [];
  if (g.mode === 'tower') {
    const info = FLOORS[g.floor - 1];
    if (win) {
      const r = floorReward(p.tower, g.floor);
      coins += r.coins; xp += r.xp;
      const res = clearFloor(p.tower, g.floor);
      trackEvent({ type: 'tower', floor: g.floor });
      if (res.ending) { grant(p, 'skin', 'crown'); ending = 'crown'; }
      if (res.cometEnding) ending = 'comet';
      if (info.secret && res.secretFirst) { grant(p, 'effect', 'comet'); toast('✨ 혜성 꼬리 효과를 얻었어!', true); }
      if (res.novaFirst) { grant(p, 'skin', 'aurora'); grant(p, 'effect', 'nova'); toast('🌟 오로라 갑옷과 초신성 폭발을 얻었어!', true); }
      title = info.secret ? `${info.name} 정복!` : g.floor === TOP_FLOOR ? '타워 정복!' : `${g.floor}층 클리어!`;
      sub = r.first ? `${info.name}을(를) 처음 깼어!` : `${info.name} 다시 클리어`;
      const next = g.floor < FLOORS.length ? g.floor + 1 : null;
      if (next) buttons.push(['primary', `${FLOORS[next - 1].name} 도전 ▶`, () => { closeResult(); startTower(next); }]);
      buttons.push(['ghost', '타워로', () => { closeResult(); quitGame(); }]);
    } else {
      loseFloor(p.tower, g.floor);
      coins += 10; xp += 15;
      sub = `${info.boss}에게 졌어. 다시 도전하면 AI 손이 조금 느려져!`;
      buttons.push(['primary', '다시 도전', () => { closeResult(); startTower(g.floor); }]);
      buttons.push(['ghost', '타워로', () => { closeResult(); quitGame(); }]);
    }
  } else if (g.mode === 'vs') {
    if (win) { coins += 20 + g.level * 10; xp += 30 + g.level * 12; } else { coins += 5; xp += 15; }
    sub = `${FLOORS[g.level - 1].boss} (AI 레벨 ${g.level}) · ${m.wins[0]} : ${m.wins[1]}`;
    buttons.push(['primary', '다시 하기', () => { closeResult(); retry(); }], ['ghost', '메뉴로', () => { closeResult(); quitGame(); }]);
  } else if (g.mode === 'local') {
    title = m.winner() === 0 ? `${me()?.name || '1P'} 승리!` : m.winner() === 1 ? `${renderer.views[1]?.name || '2P'} 승리!` : '무승부!';
    coins += 20; xp += 30;
    sub = `${m.wins[0]} : ${m.wins[1]}`;
    buttons.push(['primary', '다시 하기', () => { closeResult(); retry(); }], ['ghost', '메뉴로', () => { closeResult(); quitGame(); }]);
  } else if (g.mode === 'online') {
    if (win) { coins += 80; xp += 100; } else { coins += 20; xp += 40; }
    sub = `${roomNet().peerName()} · ${m.wins[0]} : ${m.wins[1]}`;
    buttons.push(['primary', '한 번 더!', () => { closeResult(); roomNet().rematch(); }], ['ghost', '나가기', () => { closeResult(); quitGame(); }]);
  } else if (g.mode === 'solo') {
    title = '게임 끝!';
    const score = m.players[0].score;
    coins += Math.min(300, Math.floor(score / 400));
    xp += Math.min(250, Math.floor(score / 150)) + 10;
    sub = `점수 ${fmt(score)}${score > p.stats.endlessBest ? ' · 새 최고 기록!' : ''}`;
    p.stats.endlessBest = Math.max(p.stats.endlessBest, score);
    trackEvent({ type: 'endless', score });
    buttons.push(['primary', '다시 하기', () => { closeResult(); retry(); }], ['ghost', '메뉴로', () => { closeResult(); quitGame(); }]);
  }
  xp += totals.maxChain * 5;
  if (g.mode !== 'solo') trackEvent({ type: 'match', mode: g.mode, map: g.map, win });
  else trackEvent({ type: 'match', mode: 'solo', win: false });
  const s = p.stats;
  s.games++;
  if (g.mode !== 'solo' && g.mode !== 'local') { if (win) s.wins++; else s.losses++; }
  if (g.mode === 'local') s.localGames++;
  if (g.mode === 'online') { s.onlineGames++; if (win) s.onlineWins++; }
  s.maxChain = Math.max(s.maxChain, totals.maxChain);
  s.maxScore = Math.max(s.maxScore, totals.maxScore);
  s.popped += totals.popped; s.allClears += totals.allClears; s.offsets += totals.offsets; s.garbageSent += totals.garbageSent;
  trackEvent({ type: 'career', ...s });
  trackEvent({ type: 'collection', skin: p.owned.skin.length, effect: p.owned.effect.length });
  const before = { level: p.level, xp: p.xp };
  const reward = grantReward(p, { coins, xp });
  coins = reward.coins; xp = reward.xp;
  const lv = reward.lv;
  if (reward.bonus.birthday || reward.bonus.holidays.length) sub += ` · ${eventText(reward.bonus)}`;
  for (const level of lv.levels) trackEvent({ type: 'level', level });
  save();
  cloud?.flush().catch(() => {}); // 판이 끝나면 바로 올린다
  const show = () => showResult({ title, sub, win: g.mode === 'solo' || g.mode === 'local' ? true : win, totals, coins, xp, lv, before, buttons, mode: g.mode, score: m.players[0].score });
  if (g.mode === 'tower') {
    const info = FLOORS[g.floor - 1];
    setTimeout(() => talk(info, win ? info.win : info.lose, () => (ending ? runEnding(show, ending) : show())), 900);
  } else setTimeout(show, 700);
}

function showResult(r) {
  sound.play('menu');
  $('result').hidden = false;
  $('result').querySelector('.card').classList.toggle('lose', !r.win);
  $('result-title').textContent = r.title;
  $('result-sub').textContent = r.sub;
  const t = r.totals;
  $('result-stats').innerHTML = [
    ['최대 연쇄', `${t.maxChain}연쇄`], ['점수', fmt(r.mode === 'solo' ? r.score : t.maxScore)], ['보낸 방해 젤리', `${fmt(t.garbageSent)}개`],
    ['터뜨린 젤리', `${fmt(t.popped)}개`], ['상쇄', `${t.offsets}번`], ['전소', `${t.allClears}번`],
  ].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('');
  $('result-xp').textContent = `+${r.xp}`;
  $('result-coins').textContent = `+${fmt(r.coins + (r.lv.coins || 0))}`;
  const p = P();
  const bar = $('result-xpbar');
  bar.style.transition = 'none';
  bar.style.width = `${Math.min(100, (r.before.xp / xpToNext(r.before.level)) * 100)}%`;
  requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transition = 'width 1s'; bar.style.width = `${Math.min(100, (p.xp / xpToNext(p.level)) * 100)}%`; }));
  $('result-level').innerHTML = r.lv.levels.length ? `<span class="levelup">🎉 레벨 업! Lv.${p.level} (레벨 보상 🪙${fmt(r.lv.coins)})</span>` : `Lv.${p.level} · 다음 레벨까지 ${fmt(xpToNext(p.level) - p.xp)}`;
  if (r.lv.levels.length) { sound.sfx('level'); haptic('success'); } else sound.sfx('coin');
  const view = missionView(p);
  const ready = [...view.daily, ...view.list].filter(x => x.done && !x.claimed);
  $('result-missions').innerHTML = ready.length ? `<div>🎯 받을 수 있는 챌린지 보상이 ${ready.length}개 있어! 메뉴 → 챌린지</div>` : '';
  const row = $('result-buttons');
  row.innerHTML = '';
  for (const [cls, label, fn] of r.buttons) {
    const b = document.createElement('button');
    b.className = cls;
    b.textContent = label;
    b.onclick = () => { sound.sfx('click'); fn(); };
    row.append(b);
  }
  ui.resultSocial(r.mode);
  if (consumePromo(P())) { save(); openPromo(); }
}
function closeResult() { $('result').hidden = true; }

// ---------- seonn 광고 (기획서 6번 그림) ----------
// 오른쪽 위 단추는 "5초 뒤에 ✕"에서 1초씩 줄어들다가, 0이 되면 눌러서 닫는 ✕가 된다.
const PROMO_WAIT = 5;
let promoLeft = 0, promoTimer = null;
function paintPromoClose() {
  const b = $('promo-close'), waiting = promoLeft > 0;
  b.textContent = waiting ? `${promoLeft}초 뒤에 ✕` : '✕ 닫기';
  b.classList.toggle('waiting', waiting);
  b.setAttribute('aria-disabled', String(waiting));
  b.setAttribute('aria-label', waiting ? `광고는 ${promoLeft}초 뒤에 닫을 수 있어` : '광고 닫기');
}
function openPromo() {
  clearInterval(promoTimer);
  promoLeft = PROMO_WAIT;
  paintPromoClose();
  promoTimer = setInterval(() => { promoLeft--; paintPromoClose(); if (promoLeft <= 0) clearInterval(promoTimer); }, 1000);
  $('seonn-promo').showModal();
}
// force: 온라인 상대가 먼저 다음 판을 시작했을 때처럼 기다리지 않고 닫아야 할 때
function closePromo(force = false) {
  if (promoLeft > 0 && !force) return;
  clearInterval(promoTimer); promoLeft = 0;
  if ($('seonn-promo').open) $('seonn-promo').close();
}
$('promo-close').onclick = () => { sound.sfx(promoLeft > 0 ? 'bump' : 'click'); closePromo(); };
$('seonn-promo').addEventListener('cancel', e => { if (promoLeft > 0) e.preventDefault(); });
// Esc를 연달아 누르면 브라우저가 막아 둔 창도 닫아 버린다. 다 세기 전이라면 남은 시간 그대로 다시 연다.
$('seonn-promo').addEventListener('close', () => { if (promoLeft > 0) $('seonn-promo').showModal(); });

// ---------- 엔딩 ----------
function runEnding(done, kind = 'crown') {
  $('ending').hidden = false;
  $('ending').dataset.kind = kind;
  $('ending').setAttribute('aria-label', kind === 'comet' ? '혜성 엔딩 · 우주의 친구들' : '왕관 엔딩');
  hideScreens();
  $('hud').hidden = true; $('touch').hidden = true;
  controls.enabled = false;
  sound.play('ending');
  P().tower.endings = (P().tower.endings || 0) + 1;
  if (kind === 'comet') P().tower.cometEndings = (P().tower.cometEndings || 0) + 1;
  save();
  const stop = playEnding($('ending-canvas'), { name: me()?.name || '나', kind, sound, onDone: finish });
  $('ending-skip').onclick = () => { stop(); finish(); };
  function finish() {
    if ($('ending').hidden) return;
    $('ending').hidden = true;
    if (kind === 'comet') toast('🌠 우주의 친구들 엔딩! 코멧과 함께 별빛을 되찾았어! 초신성 층이 열렸어!', true);
    else {
      toast('👑 황금 왕관 젤리 스킨을 상점에서 장착해 봐.', true);
      toast('✨ 탑 너머 비밀의 혜성 층이 열렸어!', true);
    }
    done?.();
  }
}

// ---------- 제작자 모드 ----------
function renderCreator() {
  $('creator-form').hidden = creator.unlocked;
  $('creator-tools').hidden = !creator.unlocked;
  $('creator-account').textContent = `${me()?.name || '손님'} · Lv.${P().level}`;
  $('creator-error').textContent = '';
  $('creator-password').value = '';
  // 비밀번호 다시 정하기: 이 기기 계정 목록 (온라인 계정으로 옮긴 계정과 온라인 계정은 여기서 바꿀 수 없다)
  const locals = store.accounts.filter(a => !a.migratedTo);
  $('reset-account').innerHTML = locals.map(a => `<option value="${a.id}">${esc(a.name)} · Lv.${a.progress.level}</option>`).join('');
  $('reset-account').disabled = !locals.length;
  $('reset-form').querySelector('button[type=submit]').disabled = !locals.length;
  $('reset-pass').value = ''; $('reset-pass2').value = '';
  resetMsg(locals.length ? '' : '이 기기에 만든 계정이 아직 없어.');
  $('reset-login').hidden = true;
}
let resetDone = null; // 방금 비밀번호를 바꾼 계정 { name, password } (바로 들어가기용)
function resetMsg(text, ok = false) { $('reset-msg').textContent = text; $('reset-msg').classList.toggle('ok', ok); }
$('reset-form').onsubmit = async e => {
  e.preventDefault();
  const id = $('reset-account').value, p1 = $('reset-pass').value, p2 = $('reset-pass2').value;
  if (!id || store.accounts.find(a => a.id === id)?.migratedTo) { resetMsg('바꿀 계정을 골라 줘.'); return; }
  if (p1 !== p2) { resetMsg('두 비밀번호가 달라. 똑같이 두 번 적어 줘.'); sound.sfx('bump'); return; }
  const r = await creator.resetPassword(store, id, p1);
  if (!r.ok) { resetMsg(r.error); sound.sfx('bump'); return; }
  persistStore();
  $('reset-pass').value = ''; $('reset-pass2').value = '';
  resetDone = { name: r.account.name, password: p1 };
  resetMsg(`✅ ${r.account.name} 계정 비밀번호를 바꿨어! 새 비밀번호를 꼭 기억해 둬.`, true);
  $('reset-login').hidden = false;
  sound.sfx('coin'); haptic('success');
};
$('reset-login').onclick = async () => {
  if (!resetDone) return;
  const r = await login(store, resetDone.name, resetDone.password);
  resetDone = null;
  $('reset-login').hidden = true;
  if (!r.ok) { toast(r.error); return; }
  friendNet.stop();
  if (account?.cloud) { save(); await leaveCloud(); } // 온라인 계정에서 이 기기 계정으로 바꾼다
  account = r.account; guest = null; save(); afterLogin();
};
$('creator-form').onsubmit = e => {
  e.preventDefault();
  const ok = creator.unlock($('creator-password').value);
  $('creator-password').value = '';
  if (!ok) { $('creator-error').textContent = '비밀번호가 달라. 다시 입력해 줘!'; sound.sfx('bump'); return; }
  sound.sfx('coin'); renderCreator();
};
$('creator-lock').onclick = () => { creator.lock(); renderCreator(); };
document.querySelectorAll('[data-creator]').forEach(button => {
  button.onclick = () => {
    const message = creator.apply(P(), button.dataset.creator);
    if (!message) return;
    save(); sound.sfx('mission'); renderCreator();
    $('creator-result').textContent = message;
    toast(message, true);
  };
});

// ---------- 매일 보상 ----------
function eventText(bonus = calendarBonus()) {
  const lines = [];
  if (bonus.birthday) lines.push('🎂 인혁이 생일! 포인트(코인) ×10');
  if (bonus.holidays.length) lines.push(`🎉 ${bonus.holidays.join(' · ')} 경험치 ×2`);
  return lines.length ? lines.join(' · ') : '🎂 매년 5월 12일 코인 ×10 · 🎉 한국 공휴일 경험치 ×2';
}
const ticketNames = { skin: '🎨 스킨 교환권', effect: '✨ 효과 교환권', spin: '🎟️ 추가 스핀' };
function ticketText(tickets) {
  return Object.entries(ticketNames).filter(([key]) => tickets?.[key] > 0).map(([key, title]) => `${title} ${fmt(tickets[key])}장`).join(' · ');
}
function rewardText(r) {
  return [r.coins ? `🪙 ${fmt(r.coins)}` : '', r.xp ? `경험치 ${fmt(r.xp)}` : '', ticketText(r.tickets)].filter(Boolean).join(' · ');
}
function inventoryText() { return ticketText(P().tickets) || '아직 교환권이 없어. 출석·스핀·시간 선물에서 받아 봐!'; }
function received(result, kind) {
  if (!result) return;
  if (kind) trackEvent({ type: 'gift', kind });
  for (const level of result.lv.levels) trackEvent({ type: 'level', level });
  sound.sfx(result.lv.levels.length ? 'level' : 'coin');
  toast(`🎁 ${rewardText(result)} 받았어!${result.lv.levels.length ? ` Lv.${P().level}!` : ''}`, true);
  save();
}
let spinning = false;
function renderRewards() {
  const view = rewardView(P());
  $('reward-event').textContent = eventText();
  $('reward-inventory').textContent = inventoryText();
  $('daily-rewards').innerHTML = DAILY_REWARDS.map((reward, i) => `<div class="daily-gift${i === view.day ? ' active' : ''}${i < view.day || (i === view.day && view.dailyClaimed) ? ' received' : ''}"><b>${i + 1}일째 ${i === 6 ? '🎁' : '✨'}</b><small>${rewardText(rewardPreview(reward))}</small></div>`).join('');
  $('daily-button').disabled = view.dailyClaimed;
  $('daily-button').textContent = view.dailyClaimed ? '✔ 오늘 선물 받음 · 내일 또 만나!' : `${view.day + 1}일째 선물 받기`;
  $('spin-button').disabled = view.spinClaimed || spinning;
  $('spin-button').textContent = spinning ? '두근두근…' : view.spinClaimed ? '✔ 오늘 스핀 완료 · 내일 다시!' : view.freeSpinClaimed ? `🎟️ 추가 스핀 사용 (${P().tickets.spin}장)` : '무료로 돌리기!';
  const wheel = $('spin-wheel');
  if (!wheel.childElementCount) {
    wheel.innerHTML = SPIN_PRIZES.map((r, i) => `<span class="spin-label" style="transform:rotate(${i * 60}deg) translateY(-87px) rotate(${-i * 60}deg)">${r.tickets?.skin && r.tickets?.effect ? '🎁 꾸미기' : r.tickets?.skin ? '🎨 스킨권' : r.tickets?.effect ? '✨ 효과권' : r.coins ? `🪙${r.coins}` : `XP ${r.xp}`}<small>${r.tickets ? '+ 코인 / XP' : '선물'}</small></span>`).join('');
  }
  if (!spinning) {
    wheel.classList.remove('spinning');
    wheel.style.transform = `rotate(${-(view.spinIndex ?? 0) * 60}deg)`;
    $('spin-result').textContent = view.spinIndex !== null ? `최근 당첨: ${rewardText(rewardPreview(SPIN_PRIZES[view.spinIndex]))}` : '어느 선물이 나올까?';
  }
  $('spin-prizes').textContent = `룰렛에는 기본 보상이 표시돼. 오늘 받을 보상: ${SPIN_PRIZES.map(r => rewardText(rewardPreview(r))).join(' / ')}`;
  const minutes = Math.floor(view.playSeconds / 60), seconds = Math.floor(view.playSeconds % 60);
  $('play-time').textContent = `오늘 게임한 시간: ${minutes}분 ${seconds}초`;
  $('time-rewards').innerHTML = view.time.map(r => `<div class="time-gift"><b>${r.seconds / 60}분 선물</b><p class="fine">${rewardText(r)}</p><button data-time="${r.id}" ${r.ready && !r.claimed ? 'class="primary"' : 'disabled'}>${r.claimed ? '✔ 받음' : r.ready ? '선물 받기!' : `${Math.ceil((r.seconds - view.playSeconds) / 60)}분 더!`}</button></div>`).join('');
  $('time-rewards').querySelectorAll('button').forEach(button => { button.onclick = () => {
    received(claimTime(P(), button.dataset.time), 'time'); renderScreen('rewards');
  }; });
}
$('daily-button').onclick = () => { received(claimDaily(P()), 'daily'); renderScreen('rewards'); };
$('spin-button').onclick = () => {
  if (spinning) return;
  const result = spin(P());
  if (!result) return;
  // 먼저 결과를 지급·저장하므로 애니메이션 중 새로고침해도 선물이 사라지지 않는다.
  received(result, 'spin');
  const owner = me();
  spinning = true;
  renderScreen('rewards');
  $('spin-result').textContent = '빙글빙글… 선물을 고르는 중!';
  const wheel = $('spin-wheel');
  wheel.classList.remove('spinning');
  wheel.style.transform = 'rotate(0deg)';
  void wheel.offsetWidth;
  wheel.classList.add('spinning');
  wheel.style.transform = `rotate(${1800 - result.index * 60}deg)`;
  setTimeout(() => {
    spinning = false;
    if (owner !== me()) return;
    if (screen === 'rewards') renderScreen('rewards');
    toast(`🎡 당첨! ${rewardText(result)}`, true); sound.sfx('mission');
  }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 150 : 3100);
};

let pendingPlay = 0, unsavedPlay = 0;
function recordPlayTime(seconds) {
  if (!match || !game || game.finished || match.phase !== 'play' || paused || talking || screen || document.hidden || !$('ending').hidden) return;
  pendingPlay += seconds;
  if (pendingPlay < 1) return;
  const p = P(), before = rewardView(p).playSeconds;
  const elapsed = pendingPlay;
  addPlayTime(p, elapsed);
  p.stats.playSeconds += elapsed;
  pendingPlay = 0; unsavedPlay += elapsed;
  for (const reward of TIME_REWARDS) if (before < reward.seconds && p.rewards.playSeconds >= reward.seconds) toast(`🎁 ${reward.seconds / 60}분 선물을 받을 수 있어! 메뉴 → 보상 받기`, true);
  if (unsavedPlay >= 15) { save(); unsavedPlay = 0; }
}
// 열린 화면도 자정이 지나면 출석·미션·배율을 갱신한다.
let displayedDate = todayKey();
setInterval(() => {
  const date = todayKey();
  if (date !== displayedDate) { displayedDate = date; if (screen) renderScreen(screen); }
}, 1000);
addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

// ---------- 챌린지 ----------
let missionFilter = 'all';
$('mission-filter').onchange = e => { missionFilter = e.target.value; renderMissions(); };
function renderMissions() {
  const p = P();
  track(p, { type: 'career', ...p.stats });
  track(p, { type: 'level', level: p.level });
  track(p, { type: 'collection', skin: p.owned.skin.length, effect: p.owned.effect.length });
  const view = missionView(p);
  $('mission-count').textContent = `전체 ${view.list.length}개 · 완료 ${view.list.filter(m => m.done).length}개 · 받을 보상 ${unclaimedCount(p)}개`;
  const root = $('mission-list');
  root.innerHTML = '';
  const section = (title, rows) => {
    const h = document.createElement('h3');
    h.className = 'mgroup';
    h.textContent = title;
    root.append(h);
    for (const m of rows) {
      const d = document.createElement('div');
      d.className = `mission${m.done ? ' done' : ''}${m.claimed ? ' claimed' : ''}${m.id === 'tower-chain-5' ? ' kid' : ''}`;
      const pct = Math.round((m.v / m.goal) * 100);
      d.innerHTML = `<b>${m.id === 'tower-chain-5' ? '<span class="star">★</span> ' : ''}${esc(m.title)}</b><button ${m.done && !m.claimed ? 'class="primary"' : 'disabled'}>${m.claimed ? '✔ 받음' : m.done ? '받기!' : `${fmt(m.v)}/${fmt(m.goal)}`}</button>
        <div class="bar"><i style="width:${pct}%"></i></div><span class="rw">보상 ${rewardText(rewardPreview(m.reward))}</span>`;
      d.querySelector('button').onclick = () => {
        const reward = claim(p, m.id);
        if (!reward) return;
        const { lv } = grantReward(p, reward);
        for (const level of lv.levels) { trackEvent({ type: 'level', level }); toast(`🎉 레벨 업! Lv.${level}`, true); }
        sound.sfx(lv.levels.length ? 'level' : 'coin');
        save();
        renderScreen('missions');
      };
      root.append(d);
    }
  };
  const eligible = rows => missionFilter === 'ready' ? rows.filter(m => m.done && !m.claimed) : rows;
  if (['all', 'daily', 'ready'].includes(missionFilter)) section('📅 오늘의 미션', eligible(view.daily));
  for (const [key, title] of Object.entries(GROUPS)) {
    if (!['all', 'ready', key].includes(missionFilter)) continue;
    const rows = eligible(view.list.filter(m => m.group === key));
    if (rows.length) section(title, rows);
  }
  if (missionFilter === 'ready' && !unclaimedCount(p)) root.insertAdjacentHTML('beforeend', '<p class="lead">아직 받을 보상이 없어. 다른 도전에 도전해 봐!</p>');
}

// ---------- 상점 ----------
let shopTab = 'skin', previewTimer = null;
$('shop-tabs').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  shopTab = b.dataset.v;
  $('shop-tabs').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  sound.sfx('click');
  renderShop();
});
function renderShop() {
  const p = P();
  $('shop-inventory').textContent = inventoryText();
  const grid = $('shop-grid');
  grid.innerHTML = '';
  const items = shopTab === 'skin' ? SKINS : EFFECTS;
  const previews = [];
  for (const item of items) {
    const state = canBuy(p, shopTab, item.id);
    const owned = p.owned[shopTab].includes(item.id);
    const on = p.equip[shopTab] === item.id;
    const card = document.createElement('div');
    card.className = `item${on ? ' equipped' : ''}`;
    const cv = document.createElement('canvas');
    cv.width = 240; cv.height = 200;
    card.append(cv);
    card.insertAdjacentHTML('beforeend', `<b>${esc(item.name)}</b><p>${esc(item.desc)}</p>`);
    const b = document.createElement('button');
    if (on) { b.textContent = '✔ 장착 중'; b.disabled = true; }
    else if (owned) { b.textContent = '장착하기'; b.className = 'ghost'; }
    else if (state === 'reward') { b.textContent = item.reward === 'tower' ? '🗼 타워 정복 보상' : item.reward === 'nova' ? '🌟 노바 클리어 보상' : '☄️ 혜성 클리어 보상'; b.disabled = true; }
    else if (state === 'level') { b.innerHTML = `🔒 Lv.${item.level}부터 · <span class="price">🪙${fmt(item.price)}</span>`; b.disabled = true; }
    else { b.innerHTML = `<span class="price">🪙${fmt(item.price)}</span> 사기`; b.className = state === 'ok' ? 'primary' : ''; b.disabled = state !== 'ok'; }
    b.onclick = () => {
      if (owned) { equip(p, shopTab, item.id); sound.sfx('click'); toast(`${item.name} 장착!`); }
      else {
        const r = buy(p, shopTab, item.id);
        if (r !== 'bought') return;
        sound.sfx('coin');
        toast(`🛍️ ${item.name}을(를) 샀어!`, true);
        trackEvent({ type: 'buy', kind: shopTab });
      }
      save();
      renderShop();
      document.querySelectorAll('.coin-count').forEach(el => { el.textContent = fmt(p.coins); });
    };
    card.append(b);
    if (canRedeem(p, shopTab, item.id)) {
      const gift = document.createElement('button'); gift.className = 'ticket-button'; gift.textContent = '🎟️ 교환권 1장으로 받기';
      gift.onclick = () => {
        if (!redeem(p, shopTab, item.id)) return;
        trackEvent({ type: 'collection', skin: p.owned.skin.length, effect: p.owned.effect.length });
        save(); sound.sfx('coin'); toast(`🎁 ${item.name} 교환하고 장착했어!`, true); renderScreen('shop');
      }; card.append(gift);
    }
    grid.append(card);
    previews.push({ cv, item });
  }
  clearInterval(previewTimer);
  const fx = previews.map(() => new Effects());
  let t = 0;
  const paint = () => {
    t += 1 / 30;
    previews.forEach(({ cv, item }, k) => {
      if (shopTab === 'skin') { drawPreview(cv, item.id, [1, 3, 4, 2], t); return; }
      const ctx = cv.getContext('2d');
      const e = fx[k];
      if (Math.floor(t * 30) % 50 === k % 50 || !e.parts.length && !e.rings.length && Math.random() < 0.02) e.pop(item.id, 120, 110, [1, 2, 3, 4, 5][k % 5], 60, 3);
      e.update();
      ctx.clearRect(0, 0, cv.width, cv.height);
      drawPreview(cv, p.equip.skin, [[1, 2, 3, 4, 5][k % 5], 3], t + 2);
      e.draw(ctx);
    });
    if (screen !== 'shop') clearInterval(previewTimer);
  };
  paint();
  previewTimer = setInterval(paint, 33);
}

// ---------- 내 정보 ----------
function renderProfile() {
  const p = P();
  $('profile-name').textContent = me()?.name || '손님';
  $('profile-level').textContent = p.level;
  $('profile-xp').style.width = `${Math.min(100, (p.xp / xpToNext(p.level)) * 100)}%`;
  $('profile-xp-text').textContent = `경험치 ${fmt(p.xp)} / ${fmt(xpToNext(p.level))}`;
  const av = $('profile-avatar'), ctx = av.getContext('2d');
  ctx.clearRect(0, 0, av.width, av.height);
  drawCharacter(ctx, 'hero', 60, 62, 110, 'happy', 0, { crown: p.tower.cleared });
  const s = p.stats;
  const t = p.tower;
  $('profile-stats').innerHTML = [
    ['타워', t.cleared ? (t.nova ? '🌟 우주 정복' : t.comet ? '👑 + ☄️ 정복' : '👑 정복') : `${t.best}층까지`], ['판 수', `${fmt(s.games)}판`], ['승리', `${fmt(s.wins)}승 ${fmt(s.losses)}패`],
    ['최대 연쇄', `${s.maxChain}연쇄`], ['최고 점수', fmt(s.maxScore)], ['혼자 하기 최고', fmt(s.endlessBest)],
    ['터뜨린 젤리', `${fmt(s.popped)}개`], ['보낸 방해 젤리', `${fmt(s.garbageSent)}개`], ['전소', `${fmt(s.allClears)}번`],
    ['상쇄', `${fmt(s.offsets)}번`], ['온라인', `${fmt(s.onlineWins)}승 / ${fmt(s.onlineGames)}판`], ['엔딩 본 횟수', `${t.endings || 0}번`],
  ].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('');
  $('set-sound').checked = device.sound;
  $('set-music').checked = device.music;
  $('set-ghost').checked = p.settings.ghost !== false;
  $('set-shake').checked = p.settings.shake !== false;
  $('set-haptic').checked = device.haptics !== false;
  $('set-chat').checked = chatOn();
  $('delete-zone').hidden = !account || !!account.cloud;
  $('delete-confirm').hidden = true;
  $('export-copy').disabled = !account;
  // 온라인 계정은 기록 코드 대신 자동 저장 (서버 계정 지우기는 아직 없음)
  for (const id of ['export-title', 'export-fine', 'export-copy']) $(id).hidden = !!account?.cloud;
  $('cloud-note').hidden = $('cloud-delete-note').hidden = !account?.cloud;
  if (account?.cloud) ui.cloudStatus(cloud?.state);
  $('logout').textContent = account ? '🚪 로그아웃' : '🔑 로그인하러 가기';
  $('export-code').hidden = true;
}
$('set-sound').onchange = e => { device.sound = e.target.checked; sound.setSfx(device.sound); updateHudButtons(); save(); };
$('set-music').onchange = e => { device.music = e.target.checked; sound.setMusic(device.music); updateHudButtons(); save(); };
$('set-ghost').onchange = e => { P().settings.ghost = e.target.checked; save(); };
$('set-shake').onchange = e => { P().settings.shake = e.target.checked; save(); };
$('set-haptic').onchange = e => { device.haptics = e.target.checked; save(); haptic('medium'); };
$('set-chat').onchange = e => { P().settings.chat = e.target.checked; save(); if (!e.target.checked) closeChat(); };
// 계정 지우기: 이 기기에 저장된 그 계정의 모든 기록을 없앤다 (앱스토어 규칙: 앱 안에서 계정을 지울 수 있어야 함)
$('delete-account').onclick = () => { if (!account) return; sound.sfx('click'); $('delete-name').textContent = account.name; $('delete-confirm').hidden = false; };
$('delete-cancel').onclick = () => { sound.sfx('click'); $('delete-confirm').hidden = true; };
$('delete-yes').onclick = () => {
  if (!account) return;
  // 친구 우체통에 맡겨 둔 편지와 열쇠도 지운다
  if (validFriendCode(social().code) && validMailKey(social().key)) mail.forget(social().code, social().key);
  friendNet.stop(); resetSocialSession();
  const name = account.name;
  creator.lock();
  removeAccount(store, account.id);
  account = null; guest = null;
  persistStore();
  toast(`🗑️ ${name} 계정을 지웠어.`);
  show('login');
};
$('export-copy').onclick = async () => {
  if (!account) return;
  const code = exportCode(account);
  $('export-code').hidden = false;
  $('export-code').value = code;
  try { await navigator.clipboard.writeText(code); toast('📋 기록 코드를 복사했어!'); } catch { $('export-code').select(); toast('코드를 길게 눌러 복사해 줘.'); }
};
$('logout').onclick = async () => {
  friendNet.stop(); resetSocialSession();
  creator.lock();
  save();
  peerOnline.leave();
  if (account?.cloud) await leaveCloud();
  else if (account) { logout(store); persistStore(); account = null; }
  guest = null;
  show('login');
};
// 온라인 계정에서 나간다: 올릴 것을 마저 올리고, 알림을 끄고, 서버에서 로그아웃
async function leaveCloud() {
  online.leave();
  await cloud?.flush().catch(() => {});
  stopSocial(); stopCloud();
  await net.logout().catch(() => {});
  account = null;
}

// ---------- 하는 방법 ----------
function renderHelp() {
  const box = $('help-icons');
  if (box.childElementCount) return;
  for (const icon of GARBAGE_ICONS) {
    const s = document.createElement('span');
    s.append(iconCanvas(icon.id, 20));
    s.append(`${icon.name} ${fmt(icon.value)}`);
    box.append(s);
  }
}

// ---------- 온라인 ----------
const online = createOnline({
  toast, sound,
  social: () => hub,
  me: () => ({ level: P().level, skin: P().equip.skin, effect: P().equip.effect }), // 이름은 보내지 않는다 (상대는 서버가 준 닉네임을 씀)
  start: ({ seed, firstTo, opponent, peer, role, makeRemote }) => {
    startGame({
      mode: 'online', online: role, seed, firstTo, title: `온라인 · ${opponent.nickname}`, theme: 'starry', music: 'battle',
      specs: [{ kind: 'human' }, { kind: 'remote' }], makeRemote,
      views: [myView({ char: null }), { name: opponent.nickname, level: peer.level, skin: peer.skin || 'classic', effect: peer.effect || 'sparkle', char: null, color: '#9fe3ff' }],
    });
  },
  match: () => match,
  isFinished: () => !!game?.finished,
  quit: () => { if (match && game?.mode === 'online') { match = null; game = null; $('result').hidden = true; startDemo(); show('online'); } },
  render: () => { if (!online.active && chatWith?.kind === 'room') closeChat(); ui.onlineChanged(); },
  // 대전 채팅: 내가 보낸 줄은 sendChat 이 이미 적었다
  chatLine: entry => { if (entry.who === 'them') roomChat({ name: online.peerName(), text: entry.text, sticker: entry.sticker }); },
  chatReset: () => roomJoined(),
});
// 방 코드 대전 (PeerJS): 이 기기 계정과 손님. 주고받는 모양은 예전 버전 게임과 같다.
const peerOnline = createPeerOnline({
  $, toast, sound, esc,
  me: () => ({ name: me()?.name || '손님', level: P().level, skin: P().equip.skin, effect: P().equip.effect }),
  start: ({ seed, firstTo, peer, role, makeRemote }) => {
    startGame({
      mode: 'online', online: role, viaPeer: true, seed, firstTo, title: `온라인 · ${peer.name}`, theme: 'starry', music: 'battle',
      specs: [{ kind: 'human' }, { kind: 'remote' }], makeRemote,
      views: [myView({ char: null }), { name: peer.name, level: peer.level, skin: peer.skin || 'classic', effect: peer.effect || 'sparkle', char: null, color: '#9fe3ff' }],
    });
  },
  match: () => match,
  finished: () => finishMatch(),
  quit: () => { if (match && game?.mode === 'online') { match = null; game = null; $('result').hidden = true; startDemo(); show('online'); } },
  renderer,
  roomChat: message => roomChat(message),
  roomJoined: () => roomJoined(),
  roomLeft: () => { if (chatWith?.kind === 'room') closeChat(); },
});
// 지금 계정이 쓰는 대전 방: 온라인 계정은 net 서버(online.mjs), 그 밖에는 방 코드(online-peer.mjs)
const roomNet = () => (account?.cloud ? online : peerOnline);
function roomJoined() { roomLog.length = 0; roomMuted = false; roomUnread = 0; updateRoomDots(); }
const ui = createSocialUI({
  $, toast, sound, online,
  show, screen: () => screen, social: () => hub, user: () => (account?.cloud ? net.user : null), P,
  leaveOnline: () => { if (game?.mode === 'online') quitGame(); else online.leave(); },
  stopGame: () => { if (match) { $('pause').hidden = true; paused = false; quitGame(); } },
  lost: reason => lostLogin(reason),
  chatOn: () => chatOn(),
  stickerImg: i => stickerURL(i),
});
// 시작 단추: 온라인 계정 방이면 net 서버 대전, 아니면 방 코드 대전
$('online-start').onclick = () => { sound.sfx('click'); roomNet().start(); };
addEventListener('pagehide', () => { online.leave(); cloud?.flush().catch(() => {}); });
document.addEventListener('visibilitychange', () => { if (document.hidden) cloud?.flush().catch(() => {}); });
addEventListener('online', () => cloud?.retryNow());

// ---------- 친구와 채팅 ----------
// 친구는 계정마다 6글자 친구 코드로 맺는다.
// - 둘 다 게임을 켜 두었으면 PeerJS로 직접 이어져서 메시지·이모티콘을 바로 보내고 "받았어"(got) 답을 받는다.
//   "게임 중" 표시와 대전 초대도 이 연결로 한다.
// - 친구가 게임을 꺼 두었거나 답이 없으면 사이트의 친구 우체통(/api/jelly-mail)에 맡긴다. 친구가 나중에 켜면 받고,
//   받아 가면 우체통에서 지운다 (안 받아 가도 7일 뒤 지운다). 우체통을 얼마나 자주 열지는 서버가 알려 준다(pace).
// - 우체통이 없으면(개발 서버, 인터넷 끊김) 예전처럼 둘 다 켜 두었을 때만 보낸다.
// 대화는 이 기기에 친구마다 최근 50개만 남는다.
const social = () => P().social;
// 친구 코드 친구(직접 연결 + 우체통)는 이 기기 계정에서만 켠다. 온라인 계정은 닉네임 친구(social-ui.mjs)를 쓴다.
const legacyOn = () => !!account && !account.cloud;
const chatOn = () => P().settings.chat !== false;
const mail = createMailClient();
let mailState = 'unknown';  // 'on' 우체통 사용 중 | 'off' 우체통 없음 | 'unknown' 아직 모름
let mailTimer = null, mailBusy = false, mailTries = 0, ackedTo = 0;
let mailPace = { fast: 8000, slow: 40000 }; // 우체통을 여는 간격: 친구 화면·채팅에서 / 그 밖에서
const pendingAcks = new Map(); // 직접 보낸 편지 아이디 → "받았어" 답을 기다리는 함수
const friendNet = new FriendNet({
  status: (state, message) => {
    netNote = state === 'connecting' ? '친구 서버에 연결하는 중…' : message;
    if (state === 'on') greetFriends();
    if (state === 'error') setTimeout(() => { if (legacyOn() && friendNet.state === 'error') syncFriendNet(); }, 15000);
    if (screen === 'friends') renderFriends();
  },
  hello: (code, info) => {
    const friend = legacyOn() && social().friends.find(f => f.code === code);
    if (friend) { friend.name = cleanName(info.name); friend.level = Math.max(1, Number(info.level) | 0); }
  },
  online: (code, isOnline) => friendOnline(code, isOnline),
  data: (code, message) => friendData(code, message),
  blocked: code => legacyOn() && social().blocked.includes(code),
}, import.meta.env?.DEV && new URLSearchParams(location.search).has('localPeer') ? { host: location.hostname, port: 9003, path: '/puyo', secure: false } : {});

let netNote = '', chatWith = null, roomMuted = false, roomUnread = 0, presenceTimer = null;
const unread = new Map();       // 친구 코드 → 이번에 켠 동안 안 읽은 메시지 수
const greeted = new Set();      // 이번에 접속했다고 알려 준 친구
const friendLimits = new Map(); // 직접 연결로 오는 말의 친구별 속도 제한
const seenLetters = new Set();  // 이번에 켠 동안 받은 편지 (우체통과 직접 연결로 두 번 와도 한 번만)
const roomLog = [];             // 이번 온라인 방의 대화 (저장하지 않음)
const sendLimit = rateLimiter(5, 5000);

function resetSocialSession() {
  closeChat();
  legacyView = false; legacyDrained.clear();
  unread.clear(); greeted.clear(); friendLimits.clear(); seenLetters.clear();
  roomLog.length = 0; roomMuted = false; roomUnread = 0;
  clearTimeout(mailTimer); mailState = 'unknown'; mailTries = 0; ackedTo = 0;
}
function ensureFriendCode() {
  const s = social();
  let changed = false;
  if (!validFriendCode(s.code)) { s.code = makeFriendCode(); changed = true; }
  if (!validMailKey(s.key)) { s.key = makeMailKey(); changed = true; }
  if (changed) save();
  return s.code;
}
// 친구가 있거나 친구 화면을 보고 있을 때만 친구 서버에 이어 둔다 (안 쓰면 인터넷을 쓰지 않는다)
function syncFriendNet() {
  if (!legacyOn() || (!social().friends.length && screen !== 'friends')) { friendNet.stop(); return; }
  friendNet.start(ensureFriendCode(), { name: account.name, level: P().level });
}
function greetFriends() {
  if (!legacyOn()) return;
  for (const friend of social().friends) if (!friendNet.isOnline(friend.code)) friendNet.connect(friend.code);
}

// ---------- 친구 우체통 ----------
// 친구 기능을 한 번이라도 쓴 계정만 우체통을 연다 (친구 코드가 있는 계정)
function ensureMail() {
  if (!legacyOn() || !social().code) return;
  if (mailState === 'on') pollMail();
  else if (mailState === 'unknown') startMail();
}
async function startMail() {
  if (!legacyOn()) return;
  const who = account, code = ensureFriendCode();
  const r = await mail.hello(code, social().key);
  if (who !== account) return;
  if (r.ok) { mailState = 'on'; mailTries = 0; setPace(r.pace); refreshSocialViews(); pollMail(); return; }
  if (r.error === 'taken' && mailTries++ < 2) {
    // 아주 드문 일: 다른 사람이 같은 친구 코드를 먼저 맡았다 → 새 코드로 바꾼다
    social().code = makeFriendCode(); social().key = makeMailKey(); save();
    friendStatus('친구 코드가 새로 바뀌었어. 친구에게 새 코드를 알려 줘!');
    startMail();
    return;
  }
  mailState = r.error === 'network' || r.error === 'store' || r.error === 'limit' ? 'unknown' : 'off';
  if (mailState === 'unknown') scheduleMail(60000); // 인터넷이 돌아오면 다시 해 본다
  refreshSocialViews();
}
// 친구 화면이나 친구 채팅을 보고 있으면 자주, 아니면 가끔 우체통을 연다
const mailDelay = () => (screen === 'friends' || chatWith?.kind === 'friend' ? mailPace.fast : mailPace.slow);
// 서버가 알려 준 간격 (저장소마다 무료 한도가 달라서): 5초~15분 사이만 받는다
function setPace(pace) {
  const ok = v => Number.isFinite(v) && v >= 5000 && v <= 900000;
  if (pace && ok(pace.fast) && ok(pace.slow)) mailPace = { fast: pace.fast, slow: pace.slow };
}
function scheduleMail(ms = mailDelay()) {
  clearTimeout(mailTimer);
  if (legacyOn()) mailTimer = setTimeout(() => (mailState === 'on' ? pollMail() : startMail()), ms);
}
async function pollMail() {
  if (!legacyOn() || mailState !== 'on' || mailBusy) return;
  clearTimeout(mailTimer);
  if (document.hidden) { scheduleMail(); return; }
  mailBusy = true;
  const who = account;
  try {
    for (let round = 0; round < 3; round++) {
      const s = social();
      // 지난번에 받은 편지까지 지우라고 알리면서 새 편지를 받는다
      const ack = s.lastMail > ackedTo ? s.lastMail : 0;
      const r = await mail.inbox(s.code, s.key, ack);
      if (who !== account) return;
      if (!r.ok) {
        if (r.status === 401) { mailState = 'unknown'; startMail(); }
        else if (r.error === 'off') { mailState = 'off'; refreshSocialViews(); }
        break;
      }
      if (ack) ackedTo = ack;
      setPace(r.pace);
      const letters = (r.letters || []).filter(l => l && l.t > s.lastMail);
      if (!letters.length) break;
      s.lastMail = Math.max(s.lastMail, ...letters.map(l => l.t));
      receiveLetters(letters);
      save();
    }
  } finally {
    mailBusy = false;
    if (who === account) scheduleMail();
  }
}
function receiveLetters(letters) {
  const quiet = letters.length > 2;
  for (const l of letters) friendData(l.from, { t: l.kind, text: l.text, sticker: l.sticker, name: l.name, level: l.level, at: l.t, id: l.id }, { via: 'mail', quiet });
  if (quiet) { toast(`📮 친구 우체통에 편지가 ${letters.length}통 왔어!`, true); sound.sfx('mission'); }
}
// 게임 중인 친구에게 직접 보내고 "받았어"(got) 답을 기다린다.
// 'got' 받았대 | 'sent' 보냈지만 답이 없다 (예전 버전 게임은 답을 안 한다) | false 보내지 못했다
function sendLive(code, payload, wait = 3500) {
  return new Promise(resolve => {
    if (!friendNet.isOnline(code) || !friendNet.send(code, payload)) { resolve(false); return; }
    const timer = setTimeout(() => { pendingAcks.delete(payload.id); resolve('sent'); }, wait);
    pendingAcks.set(payload.id, () => { clearTimeout(timer); pendingAcks.delete(payload.id); resolve('got'); });
  });
}
// 친구에게 보내기: 게임 중이면 직접(바로 도착, 우체통을 아낀다), 아니면 우체통에 맡긴다(친구가 켜면 받는다)
async function sendToFriend(code, letter) {
  const s = social(), id = letterId(), me = { name: account.name, level: P().level };
  const live = await sendLive(code, { t: letter.kind, text: letter.text, sticker: letter.sticker, id, ...me });
  if (live === 'got') return { ok: true, live: true };
  if (mailState === 'on') {
    const r = await mail.send(s.code, s.key, { to: code, id, kind: letter.kind, text: letter.text, sticker: letter.sticker, ...me });
    if (r.ok) { friendNet.send(code, { t: 'ring' }); return r; }
    if (['personal', 'limit', 'empty', 'sticker'].includes(r.error)) return r;
    if (r.status === 401) { mailState = 'unknown'; startMail(); }
  }
  // 우체통을 쓸 수 없어도 열린 연결로 보내기는 했으면 보낸 걸로 친다 (예전처럼. 차단당한 것도 알리지 않는다)
  if (live === 'sent') return { ok: true, live: true };
  return { ok: false, error: mailState === 'on' ? 'fail' : 'offline' };
}
const NEEDS_GOT = new Set(['msg', 'st', 'fr', 'fa', 'fx']);
// 친구 신청에 답하기: 신청한 친구가 게임 중이면 직접 이어서 바로 알려 준다
async function replyFriend(code, kind) {
  if (!legacyOn()) return;
  if (!friendNet.isOnline(code) && friendNet.on) await friendNet.connect(code);
  sendToFriend(code, { kind });
}
function refreshSocialViews() {
  updateSocialBadges();
  if (screen === 'friends') renderFriends();
  if (chatWith) renderChat();
}

function friendOnline(code, isOnline) {
  const friend = legacyOn() && social().friends.find(f => f.code === code);
  if (friend && isOnline && !greeted.has(code)) {
    greeted.add(code);
    if (screen !== 'friends') toast(`👫 ${friend.name}이(가) 게임에 들어왔어!`);
  }
  if (!isOnline) greeted.delete(code);
  if (screen === 'friends') renderFriends();
  if (chatWith?.code === code) renderChat();
}
// 친구가 보낸 것 하나를 처리한다. via: 'mail'(우체통, 서버가 보낸 사람을 확인함) | 'live'(직접 연결)
function friendData(code, m, { via = 'live', quiet = false } = {}) {
  if (!legacyOn() || !validFriendCode(code)) return;
  const s = social(), friend = s.friends.find(f => f.code === code);
  if (s.blocked.includes(code)) return; // 차단한 친구가 보낸 것은 조용히 버린다
  if (via === 'live') {
    if (m.t === 'got') { if (typeof m.id === 'string') pendingAcks.get(m.id)?.(); return; } // 내가 보낸 것을 받았대
    if (!friendLimits.has(code)) friendLimits.set(code, rateLimiter(8, 5000));
    if (!friendLimits.get(code)()) return;
    if (m.t === 'ring') { pollMail(); return; } // 친구가 우체통에 편지를 넣었다는 알림
    if (m.id && NEEDS_GOT.has(m.t)) friendNet.send(code, { t: 'got', id: m.id }); // 받았다고 답한다 (두 번 받아도)
  }
  if (m.id) { if (seenLetters.has(m.id)) return; seenLetters.add(m.id); }
  const time = Number(m.at) || Date.now();
  if (m.t === 'fr') {
    if (friend) { replyFriend(code, 'fa'); return; } // 이미 친구면 바로 받아 준다
    if (s.sent.some(r => r.code === code)) { becomeFriends(code, m, quiet); replyFriend(code, 'fa'); return; } // 서로 신청했으면 바로 친구
    if (s.requests.some(r => r.code === code) || s.requests.length >= REQUEST_MAX) return;
    s.requests.push({ code, name: cleanName(m.name), level: Math.max(1, Number(m.level) | 0), time });
    save();
    if (!quiet) { toast(`👫 ${cleanName(m.name)}이(가) 친구 신청을 했어! 친구 화면에서 받아 줘.`, true); sound.sfx('mission'); }
  } else if (m.t === 'fa') {
    if (!friend && !s.sent.some(r => r.code === code)) return; // 내가 신청한 적 없는 수락은 무시
    becomeFriends(code, m, quiet);
  } else if (m.t === 'fx') {
    if (!s.sent.some(r => r.code === code)) return;
    s.sent = s.sent.filter(r => r.code !== code); save();
    friendStatus('보낸 친구 신청 하나를 친구가 받지 않았어.');
  } else if ((m.t === 'msg' || m.t === 'st') && friend && chatOn()) {
    const sticker = Number(m.sticker), text = m.t === 'msg' ? cleanChat(m.text) : '';
    const entry = m.t === 'st' ? (validSticker(sticker) ? { me: false, sticker, time } : null) : text ? { me: false, text, time } : null;
    if (!entry) return;
    pushChat(s, code, entry); save();
    if (chatWith?.code === code && !$('chat').hidden) renderChat();
    else {
      unread.set(code, (unread.get(code) || 0) + 1);
      if (!quiet) toast(`💬 ${friend.name}: ${entry.text ?? `젤리 이모티콘 「${STICKERS[entry.sticker].text}」`}`);
    }
    if (!quiet) { sound.sfx('talk'); haptic('light'); }
  } else if (m.t === 'inv' && friend && via === 'live') {
    const room = normaliseFriendCode(m.room);
    if (room.length !== 6) return;
    pushChat(s, code, { me: false, text: '🎮 같이 하자! 대전 초대가 왔어', time, invite: room }); save();
    if (chatWith?.code === code) renderChat();
    else { unread.set(code, (unread.get(code) || 0) + 1); toast(`🎮 ${friend.name}이(가) 대전에 초대했어! 친구 화면 → 채팅에서 들어가기`, true); }
    sound.sfx('mission'); haptic('medium');
  }
  updateSocialBadges();
  if (screen === 'friends') renderFriends();
}
function becomeFriends(code, m, quiet = false) {
  if (!addFriend(social(), { code, name: m.name, level: m.level })) return;
  save();
  if (!quiet) { toast(`🎉 ${cleanName(m.name)}와(과) 친구가 됐어!`, true); sound.sfx('level'); haptic('success'); }
  friendStatus('');
  syncFriendNet();
}
function updateSocialBadges() {
  if (account?.cloud) { ui.refreshBadges(); return; } // 온라인 계정은 social-ui 가 센다
  const n = account ? social().requests.length + [...unread.values()].reduce((a, b) => a + b, 0) : 0;
  $('friend-badge').hidden = !n;
  $('friend-badge').textContent = n;
}
function updateRoomDots() {
  $('hud-chat-dot').hidden = !roomUnread;
  $('lobby-chat-dot').hidden = !roomUnread;
  $('lobby-chat').hidden = !chatOn();
}
function friendStatus(text) { $('friend-status').textContent = text; }

// ---------- 기존 친구(친구 코드) 기록: 온라인 계정 ----------
// 이 기기에서 지금 온라인 계정으로 옮긴 예전 계정들의 progress.social. 서버 계정과 이어 붙이지 않고 보기만 한다.
const sameNick = (a, b) => !!a && !!b && String(a).toLowerCase() === String(b).toLowerCase();
function legacyRecords() {
  if (!account?.cloud) return [];
  return store.accounts.filter(a => a.migratedTo && sameNick(a.migratedTo, net.user?.nickname) && hasLegacy(a.progress?.social));
}
const legacyDrained = new Set(); // 이번에 켠 동안 우체통을 비운 예전 계정
async function openLegacy() {
  legacyView = true;
  renderFriendsScreen();
  // 옮긴 뒤에 친구 코드 친구가 우체통에 넣은 편지도 기록으로 받아 둔다 (이번에 켠 동안 한 번)
  let got = 0;
  for (const local of legacyRecords()) {
    if (legacyDrained.has(local.id)) continue;
    legacyDrained.add(local.id);
    got += (await drainLegacy(local)).count;
  }
  if (got && screen === 'friends' && legacyView) { $('legacy-status').textContent = `📮 우체통에 있던 편지 ${got}통을 기록에 넣었어.`; renderLegacy(); }
}
function renderLegacy() {
  const records = legacyRecords();
  $('legacy-code').textContent = records.map(a => a.progress.social.code || '------').join(', ');
  const rows = records.flatMap(a => a.progress.social.friends.map(f => ({ local: a.id, ...f, count: a.progress.social.chats[f.code]?.length || 0 })));
  $('legacy-count').textContent = `${rows.length}명`;
  $('legacy-list').innerHTML = rows.length ? rows.map(f => `<div class="friend"><i class="dot"></i><b>${esc(f.name)}</b><small>Lv.${f.level} · 친구 코드 ${f.code}${f.count ? ` · 대화 ${f.count}개` : ''}</small><button class="ghost" data-legacy="${esc(f.local)}" data-code="${f.code}">📜 지난 대화</button></div>`).join('')
    : '<p class="fine empty">친구 코드로 맺은 친구가 없어.</p>';
  const reqs = records.flatMap(a => a.progress.social.requests);
  const sent = records.flatMap(a => a.progress.social.sent);
  $('legacy-requests').innerHTML = (reqs.length ? `<p class="fine">옮기기 전에 받은 친구 신청: ${reqs.map(r => `<b>${esc(r.name)}</b> (${r.code})`).join(', ')}</p>` : '')
    + (sent.length ? `<p class="fine">옮기기 전에 보낸 친구 신청: ${sent.map(r => r.code).join(', ')}</p>` : '')
    + (reqs.length || sent.length ? '<p class="fine">이 신청들은 이제 이어지지 않아. 닉네임을 물어봐서 다시 친구 신청해 줘.</p>' : '');
}
$('go-legacy').onclick = () => { sound.sfx('click'); openLegacy(); };
$('legacy-back').onclick = () => { sound.sfx('click'); legacyView = false; $('legacy-status').textContent = ''; renderFriendsScreen(); ui.render('friends'); };
$('legacy-list').addEventListener('click', e => {
  const b = e.target.closest('button[data-legacy]');
  if (b) openChat({ kind: 'legacy', local: b.dataset.legacy, code: b.dataset.code });
});
// 지난 대화 보기 (보내기는 막는다)
function renderLegacyChat() {
  const local = legacyRecords().find(a => a.id === chatWith.local);
  const friend = local?.progress.social.friends.find(f => f.code === chatWith.code);
  if (!friend) { closeChat(); return; }
  $('chat-name').textContent = friend.name;
  $('chat-sub').textContent = `친구 코드 ${friend.code} · 지난 대화`;
  $('chat-dot').className = 'dot';
  const log = local.progress.social.chats[friend.code] || [];
  $('chat-log').innerHTML = log.length ? log.map(chatLine).join('') : '<p class="fine empty">나눈 대화가 없어.</p>';
  $('chat-log').querySelectorAll('[data-join]').forEach(b => b.remove()); // 지난 대전 초대는 들어갈 수 없다
  $('chat-quick').innerHTML = '';
  $('chat-input').disabled = true;
  $('chat-emoji-toggle').disabled = true;
  $('chat-form').querySelector('button[type=submit]').disabled = true;
  toggleEmojiPanel(false);
  $('chat-note').textContent = '친구 코드 친구와는 이제 주고받을 수 없어. 친구도 온라인 계정을 만들거나 옮기면, 닉네임으로 다시 친구 신청해 줘!';
  $('chat-tools').innerHTML = '';
  $('chat-log').scrollTop = $('chat-log').scrollHeight;
}

// 친구 화면: 손님 → 안내, 온라인 계정 → 닉네임 친구(social-ui.mjs)와 기존 친구 기록, 이 기기 계정 → 친구 코드 친구
let legacyView = false;
function renderFriendsScreen() {
  const cloudAcc = !!account?.cloud, records = cloudAcc ? legacyRecords() : [];
  if (!records.length) legacyView = false;
  $('friends-guest').hidden = !!account;
  $('friends-net').hidden = !cloudAcc || legacyView;
  $('friends-legacy').hidden = !cloudAcc || !legacyView;
  $('friends-main').hidden = !legacyOn();
  $('live-dot').hidden = !cloudAcc;
  $('go-legacy').hidden = !records.length;
  if (legacyOn()) { renderFriends(); syncFriendNet(); greetFriends(); ensureMail(); }
  if (cloudAcc && legacyView) renderLegacy();
}
function renderFriends() {
  if (!legacyOn()) return; // 손님과 온라인 계정은 renderFriendsScreen
  const s = social();
  $('my-friend-code').textContent = ensureFriendCode();
  $('mail-note').textContent = mailState === 'on'
    ? '📮 친구가 게임을 꺼 두었어도 메시지·이모티콘·친구 신청을 보낼 수 있어. 친구가 켜면 받아!'
    : mailState === 'off' ? '지금은 둘 다 게임을 켜 두었을 때만 친구 신청과 채팅을 할 수 있어.' : '친구 우체통을 여는 중…';
  if (netNote && !$('friend-status').textContent) friendStatus(netNote);
  $('friend-requests').innerHTML = s.requests.map(r => `<div class="friend-request card"><span>👋 <b>${esc(r.name)}</b> <small>Lv.${r.level}</small> 이(가) 친구 신청을 했어!</span><div class="row center"><button class="primary" data-accept="${r.code}">받기</button><button class="ghost" data-decline="${r.code}">안 받기</button></div></div>`).join('')
    + (s.sent.length ? `<p class="fine sent-list">📨 보낸 친구 신청 (친구가 받으면 친구가 돼): ${s.sent.map(r => `<span class="sent-code">${r.code} <button class="ghost tiny" data-cancel="${r.code}" aria-label="${r.code} 신청 취소">취소</button></span>`).join(' ')}</p>` : '');
  $('friend-count').innerHTML = `${s.friends.length}/${FRIEND_MAX}${s.blocked.length ? ` · 차단 ${s.blocked.length}명 <button class="ghost tiny" id="unblock-all">차단 모두 풀기</button>` : ''}`;
  const list = [...s.friends].sort((a, b) => Number(friendNet.isOnline(b.code)) - Number(friendNet.isOnline(a.code)) || a.name.localeCompare(b.name, 'ko'));
  $('friend-list').innerHTML = list.length ? list.map(f => {
    const on = friendNet.isOnline(f.code), n = unread.get(f.code) || 0;
    return `<div class="friend"><i class="dot${on ? ' on' : ''}"></i><div><b>${esc(f.name)}</b> <small>Lv.${f.level} · ${on ? '게임 중' : mailState === 'on' ? '없음 · 편지는 보낼 수 있어' : '없음'}</small></div>
      <div class="friend-buttons"><button class="ghost" data-chat="${f.code}">💬 채팅${n ? `<i class="badge mini">${n}</i>` : ''}</button>${on ? `<button class="primary" data-invite="${f.code}">🎮 같이 하기</button>` : ''}</div></div>`;
  }).join('') : `<p class="lead empty">아직 친구가 없어. 친구 코드를 서로 넣어 봐!${mailState === 'on' ? '' : ' 친구도 게임을 켜 두고 있어야 해.'}</p>`;
}
$('friends-main').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.accept) acceptRequest(b.dataset.accept);
  else if (b.dataset.decline) declineRequest(b.dataset.decline);
  else if (b.dataset.cancel) { sound.sfx('click'); social().sent = social().sent.filter(r => r.code !== b.dataset.cancel); save(); renderFriends(); }
  else if (b.dataset.chat) openChat({ kind: 'friend', code: b.dataset.chat });
  else if (b.dataset.invite) inviteFriend(b.dataset.invite);
  else if (b.id === 'unblock-all') { sound.sfx('click'); social().blocked = []; save(); friendStatus('차단을 모두 풀었어.'); renderFriends(); }
});
function acceptRequest(code) {
  const s = social(), r = s.requests.find(x => x.code === code);
  if (!r) return;
  if (addFriend(s, { code, name: r.name, level: r.level })) {
    save();
    syncFriendNet();
    replyFriend(code, 'fa');
    toast(`🎉 ${r.name}와(과) 친구가 됐어!`, true); sound.sfx('level'); haptic('success');
  }
  updateSocialBadges(); renderFriends(); syncFriendNet();
}
function declineRequest(code) {
  sound.sfx('click');
  social().requests = social().requests.filter(r => r.code !== code);
  save();
  replyFriend(code, 'fx');
  updateSocialBadges(); renderFriends();
}
$('friend-add').onsubmit = async e => {
  e.preventDefault();
  if (!legacyOn()) return;
  const code = normaliseFriendCode($('friend-input').value), s = social();
  if (!validFriendCode(code)) { friendStatus('친구 코드는 6글자야. (숫자 0·1, 글자 O·I는 없어!)'); return; }
  if (code === ensureFriendCode()) { friendStatus('그건 내 코드야! 친구의 코드를 넣어 줘.'); return; }
  if (s.friends.some(f => f.code === code)) { friendStatus('벌써 친구야!'); return; }
  if (s.friends.length >= FRIEND_MAX) { friendStatus(`친구는 ${FRIEND_MAX}명까지야.`); return; }
  if (s.requests.some(r => r.code === code)) { $('friend-input').value = ''; acceptRequest(code); return; } // 그 친구가 먼저 신청했다
  if (s.sent.some(r => r.code === code)) { friendStatus('벌써 친구 신청을 보냈어. 친구가 받으면 친구가 돼!'); return; }
  sound.sfx('click');
  friendStatus('친구 신청을 보내는 중…');
  // 친구가 지금 게임 중이면 직접 이어서 바로 보내고, 아니면 우체통에 맡긴다
  await friendNet.start(ensureFriendCode(), { name: account.name, level: P().level });
  const live = await friendNet.connect(code);
  if (mailState !== 'on' && !live) await startMail();
  if (live || mailState === 'on') {
    const r = await sendToFriend(code, { kind: 'fr' });
    if (!r.ok) {
      friendStatus(r.error === 'limit' ? '신청을 너무 많이 보냈어. 조금 뒤에 다시 해 줘.'
        : r.error === 'offline' ? '친구를 찾지 못했어. 친구도 지금 게임을 켜 두고 있어야 해. 코드를 확인하고 다시 해 봐!'
        : '친구 신청을 보내지 못했어. 인터넷을 확인하고 다시 해 봐!');
      return;
    }
    s.sent.push({ code, time: Date.now() }); save();
    $('friend-input').value = '';
    friendStatus(r.live || r.known !== false
      ? '친구 신청을 보냈어! 친구가 받으면 친구가 돼. (친구가 게임을 꺼 두었어도 켜면 받아)'
      : '친구 신청을 보냈어! 그런데 아직 그 코드로 젤리 타워 친구 화면을 연 사람이 없어. 코드가 맞는지 확인해 줘. 맞으면 친구가 열 때 받아.');
    renderFriends();
    return;
  }
  friendStatus('친구를 찾지 못했어. 친구도 지금 게임을 켜 두고 있어야 해. 코드를 확인하고 다시 해 봐!');
};
$('friend-input').oninput = e => { e.target.value = normaliseFriendCode(e.target.value); };
$('friend-code-copy').onclick = async () => {
  const code = ensureFriendCode();
  try { await navigator.clipboard.writeText(code); toast('📋 친구 코드를 복사했어!'); } catch { toast(`내 친구 코드는 ${code}야.`); }
};
$('friends-login').onclick = () => { sound.sfx('click'); show('login'); };

// ---------- 젤리 이모티콘 ----------
// 게임 캐릭터를 그려서 한 번만 그림으로 만들어 둔다 (글꼴이 늦게 오면 다시 그린다)
const stickerCache = new Map();
document.fonts?.ready.then(() => stickerCache.clear());
function stickerURL(i) {
  if (stickerCache.has(i)) return stickerCache.get(i);
  const s = STICKERS[i], cv = document.createElement('canvas');
  cv.width = cv.height = 160;
  const ctx = cv.getContext('2d');
  drawCharacter(ctx, s.char, 80, 66, 116, s.mood, 0.35);
  ctx.font = "27px Jua, 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = 8; ctx.strokeStyle = '#ffffff'; ctx.strokeText(s.text, 80, 140);
  ctx.fillStyle = '#5b3bb3'; ctx.fillText(s.text, 80, 140);
  const url = cv.toDataURL('image/png');
  stickerCache.set(i, url);
  return url;
}
const stickerImg = (i, cls = '') => `<img class="${cls}" src="${stickerURL(i)}" alt="젤리 이모티콘 ${esc(STICKERS[i].text)}" draggable="false">`;
function renderEmojiPanel() {
  $('chat-stickers').innerHTML = STICKERS.map((s, i) => `<button type="button" data-sticker="${i}" aria-label="젤리 이모티콘 ${esc(s.text)}">${stickerImg(i)}</button>`).join('');
  $('chat-emojis').innerHTML = EMOJIS.map(e => `<button type="button" data-emoji="${e}" aria-label="${e}">${e}</button>`).join('');
}
function toggleEmojiPanel(open = $('chat-emoji').hidden) {
  if (open && !$('chat-stickers').childElementCount) renderEmojiPanel();
  $('chat-emoji').hidden = !open;
  $('chat-emoji-toggle').setAttribute('aria-expanded', String(open));
  $('chat-emoji-toggle').classList.toggle('on', open);
  if (open && chatWith) $('chat-log').scrollTop = $('chat-log').scrollHeight; // 판이 열려 채팅 칸이 줄어도 새 메시지가 보이게
}
// 이모지는 글자처럼 커서 자리에 넣는다
function insertEmoji(emoji) {
  const input = $('chat-input'), start = input.selectionStart ?? input.value.length, end = input.selectionEnd ?? start;
  if (graphemes(input.value).length >= CHAT_MAX) { chatNote(`${CHAT_MAX}글자까지야!`); return; }
  input.value = input.value.slice(0, start) + emoji + input.value.slice(end);
  const caret = start + emoji.length;
  try { input.setSelectionRange(caret, caret); } catch { /* 커서를 못 옮겨도 괜찮다 */ }
  sound.sfx('click');
}

// ---------- 채팅 창 ----------
function openChat(target) {
  if (!chatOn() && target.kind !== 'legacy') { toast('설정에서 채팅이 꺼져 있어. 내 정보 → 설정에서 켤 수 있어.'); return; }
  sound.sfx('click');
  chatWith = target;
  if (target.kind === 'friend') { unread.delete(target.code); pollMail(); } else if (target.kind === 'room') { roomUnread = 0; updateRoomDots(); }
  $('chat').hidden = false;
  $('chat').classList.toggle('compact', target.kind === 'room' && !!match);
  $('chat-input').value = '';
  toggleEmojiPanel(false);
  renderChat();
  updateSocialBadges();
  if (screen === 'friends') renderFriends();
  if (!coarse && !match) $('chat-input').focus();
}
function closeChat() {
  chatWith = null;
  $('chat').hidden = true;
  $('chat-note').textContent = '';
  toggleEmojiPanel(false);
}
let noteUntil = 0;
function chatNote(text) { $('chat-note').textContent = text; noteUntil = text ? Date.now() + 4000 : 0; }
// 받침이 있으면 '은', 없으면 '는' (이메일은, 전화번호는)
const withTopic = word => { const c = word.charCodeAt(word.length - 1) - 0xac00; return word + (c >= 0 && c < 11172 && c % 28 ? '은' : '는'); };
function chatLine(m) {
  const who = m.me ? 'me' : 'them';
  if (validSticker(m.sticker)) return `<div class="msg ${who} sticker">${stickerImg(m.sticker)}</div>`;
  return `<div class="msg ${who}${bigEmoji(m.text) ? ' big' : ''}"><span>${esc(m.text)}</span>${m.invite && !m.me ? `<button class="primary tiny" data-join="${m.invite}">들어가기 ▶</button>` : ''}</div>`;
}
function renderChat() {
  if (!chatWith) return;
  if (chatWith.kind === 'legacy') { renderLegacyChat(); return; }
  const room = chatWith.kind === 'room';
  const friend = room ? null : legacyOn() && social().friends.find(f => f.code === chatWith.code);
  if (!room && !friend) { closeChat(); return; }
  const live = room ? roomNet().connected : friendNet.isOnline(friend.code);
  const canSend = room ? live : live || mailState === 'on';
  $('chat-name').textContent = room ? roomNet().peerName() : friend.name;
  $('chat-sub').textContent = room ? '온라인 대전' : `Lv.${friend.level} · ${live ? '게임 중' : '없음'}`;
  $('chat-dot').className = `dot${live ? ' on' : ''}`;
  const log = room ? roomLog : social().chats[friend.code] || [];
  $('chat-log').innerHTML = log.length ? log.map(chatLine).join('') : '<p class="fine empty">첫 인사를 해 봐! 👋</p>';
  $('chat-quick').innerHTML = QUICK.map((q, i) => `<button type="button" data-q="${i}"${canSend ? '' : ' disabled'}>${q}</button>`).join('');
  $('chat-input').disabled = !canSend;
  $('chat-emoji-toggle').disabled = !canSend;
  $('chat-form').querySelector('button[type=submit]').disabled = !canSend;
  if (!canSend) toggleEmojiPanel(false);
  if (Date.now() > noteUntil || !canSend) {
    $('chat-note').textContent = !canSend ? (room ? '방에 친구가 없어.' : '친구가 지금 게임을 안 하고 있어. 둘 다 켜 두었을 때 보낼 수 있어.')
      : !room && !live ? '📮 친구가 지금 없어도 보내 두면, 친구가 게임을 켤 때 받아!' : '🔒 전화번호·주소·학교 이름은 보내지 마!';
  }
  $('chat-tools').innerHTML = room
    ? `<button type="button" class="ghost" data-tool="mute">${roomMuted ? '🔔 채팅 다시 받기' : '🔇 이번 판 채팅 끄기'}</button>${account?.cloud ? '<button type="button" class="ghost danger" data-tool="block">🚫 차단</button>' : ''}<button type="button" class="ghost" data-tool="report">🚩 신고</button>`
    : `${live ? '<button type="button" class="ghost" data-tool="invite">🎮 같이 하자</button>' : ''}<button type="button" class="ghost danger" data-tool="block">🚫 차단</button><button type="button" class="ghost" data-tool="report">🚩 신고</button>`;
  // 아래쪽(빠른 말·안내·단추)을 다 채운 다음에 맨 아래로 내린다. 먼저 내리면 그만큼 채팅 칸이 줄어서 새 메시지가 가려진다
  $('chat-log').scrollTop = $('chat-log').scrollHeight;
}
async function sendChat({ q, text, sticker }) {
  if (!chatWith || !chatOn()) return;
  const isSticker = validSticker(sticker), quick = Number.isInteger(q) && QUICK[q];
  if (!quick && !isSticker) {
    const info = personalInfo(text);
    if (info) { chatNote(`🔒 ${withTopic(info)} 보낼 수 없어. 개인정보는 꼭 지켜야 해!`); sound.sfx('bump'); return; }
  }
  const out = isSticker ? '' : quick || cleanChat(text);
  if (!isSticker && !out) return;
  if (!sendLimit()) { chatNote('조금만 천천히 보내 줘!'); return; }
  const entry = isSticker ? { me: true, sticker } : { me: true, text: out };
  if (chatWith.kind === 'legacy') return;
  if (chatWith.kind === 'room') {
    // 온라인 계정 방: 직접 쓴 말은 서버가 거르는 room.chat, 빠른 말과 젤리 이모티콘은 번호만
    const sent = account?.cloud ? (isSticker ? online.say({ sticker }) : quick ? online.say({ quick: q }) : online.chat(out))
      : peerOnline.say(isSticker ? { sticker } : quick ? { q } : { text: out });
    if (!sent) { chatNote('방에 친구가 없어.'); return; }
    roomLog.push(entry);
    if (roomLog.length > 50) roomLog.shift();
  } else {
    const code = chatWith.code;
    const r = await sendToFriend(code, isSticker ? { kind: 'st', sticker } : { kind: 'msg', text: out });
    if (!r.ok) {
      chatNote(r.error === 'personal' ? '🔒 개인정보는 보낼 수 없어!' : r.error === 'limit' ? '조금만 천천히 보내 줘!' : r.error === 'offline' ? '친구가 지금 게임을 안 하고 있어.' : '보내지 못했어. 인터넷을 확인하고 다시 해 봐!');
      sound.sfx('bump');
      return;
    }
    pushChat(social(), code, { ...entry, time: Date.now() });
    save();
  }
  if (!isSticker) $('chat-input').value = '';
  chatNote('');
  sound.sfx('click');
  renderChat();
}
$('chat-form').onsubmit = e => { e.preventDefault(); sendChat({ text: $('chat-input').value }); };
$('chat-close').onclick = () => { sound.sfx('click'); closeChat(); };
$('chat').addEventListener('click', e => {
  if (e.target === $('chat')) { closeChat(); return; } // 바깥을 누르면 닫기
  const b = e.target.closest('button');
  if (!b || !chatWith) return;
  if (b.id === 'chat-emoji-toggle') { sound.sfx('click'); toggleEmojiPanel(); }
  else if (b.dataset.sticker) sendChat({ sticker: Number(b.dataset.sticker) });
  else if (b.dataset.emoji) insertEmoji(b.dataset.emoji);
  else if (b.dataset.q) sendChat({ q: Number(b.dataset.q) });
  else if (b.dataset.join) joinInvite(b.dataset.join);
  else if (b.dataset.tool === 'mute') { roomMuted = !roomMuted; sound.sfx('click'); renderChat(); }
  else if (b.dataset.tool === 'invite') inviteFriend(chatWith.code);
  else if (b.dataset.tool === 'block') { if (chatWith.kind === 'room') ui.blockOpponent(); else blockFriend(chatWith.code); }
  else if (b.dataset.tool === 'report') { if (chatWith.kind === 'room' && account?.cloud) ui.reportOpponent(); else reportChat(); }
});
function roomChat({ name, text, sticker }) {
  if (!chatOn() || roomMuted) return;
  const entry = validSticker(sticker) ? { me: false, sticker } : { me: false, text };
  roomLog.push(entry);
  if (roomLog.length > 50) roomLog.shift();
  if (chatWith?.kind === 'room' && !$('chat').hidden) renderChat();
  else { roomUnread++; updateRoomDots(); bubble(name, entry); }
  sound.sfx('talk');
}
// 게임 중에 온 말은 화면 위쪽에 말풍선으로 잠깐 보여 준다
function bubble(name, entry) {
  const b = document.createElement('div');
  b.className = 'bubble';
  b.innerHTML = `<b>${esc(name)}</b> ${validSticker(entry.sticker) ? stickerImg(entry.sticker, 'bubble-sticker') : esc(entry.text)}`;
  $('bubbles').append(b);
  setTimeout(() => b.remove(), 3600);
}
$('hud-chat').onclick = () => { if ($('chat').hidden) openChat({ kind: 'room' }); else closeChat(); };
$('lobby-chat').onclick = () => openChat({ kind: 'room' });
async function inviteFriend(code) {
  const friend = social().friends.find(f => f.code === code);
  if (!friend || !friendNet.isOnline(code)) { toast('친구가 게임을 켜 두고 있어야 초대할 수 있어.'); return; }
  closeChat();
  show('online');
  const room = await peerOnline.host();
  if (!room) { toast('방을 만들지 못했어. 다시 해 볼래?'); return; }
  if (friendNet.send(code, { t: 'inv', room, id: letterId() })) {
    pushChat(social(), code, { me: true, text: `🎮 대전 초대를 보냈어! (방 ${room})`, time: Date.now() });
    save();
    toast(`🎮 ${friend.name}에게 초대를 보냈어. 친구가 들어오면 시작!`, true);
  }
}
async function joinInvite(room) {
  sound.sfx('click');
  closeChat();
  show('online');
  await peerOnline.join(room);
}
function blockFriend(code) {
  const friend = social().friends.find(f => f.code === code);
  removeFriend(social(), code, { block: true });
  friendNet.close(code);
  unread.delete(code);
  save();
  closeChat();
  toast(`🚫 ${friend?.name || '친구'}을(를) 차단했어. 이제 서로 이어지지 않아.`);
  updateSocialBadges();
  if (screen === 'friends') renderFriends();
  syncFriendNet();
}
// 신고: 대화를 복사해서 어른께 보여 드리고 사이트 문의로 알릴 수 있게
async function reportChat() {
  const room = chatWith.kind === 'room';
  const name = room ? roomNet().peerName() : social().friends.find(f => f.code === chatWith.code)?.name || '친구';
  const log = (room ? roomLog : social().chats[chatWith.code] || []).slice(-20);
  const line = m => (validSticker(m.sticker) ? `[젤리 이모티콘: ${STICKERS[m.sticker].text}]` : m.text);
  const text = `[젤리 타워 신고] ${name}${room ? ' (온라인 대전)' : ` (친구 코드 ${chatWith.code})`}\n${log.map(m => `${m.me ? '나' : name}: ${line(m)}`).join('\n')}`;
  try { await navigator.clipboard.writeText(text); } catch { /* 복사가 안 되면 안내만 */ }
  chatNote('🚩 대화를 복사했어. 어른께 보여 드리고 seonn.dev/jelly-tower 의 문의하기로 알려 줘. 싫은 친구는 차단할 수 있어.');
}
// 친구 화면에 있는 동안은 45초마다 친구들이 게임에 들어왔는지 다시 본다
function watchFriends(on) {
  clearInterval(presenceTimer);
  if (on) presenceTimer = setInterval(() => { if (screen === 'friends') greetFriends(); else watchFriends(false); }, 45000);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && legacyOn()) pollMail(); });
if (legacyOn()) { syncFriendNet(); ensureMail(); }

// ---------- 창 크기 ----------
addEventListener('resize', () => {
  renderer.resize();
  if (match) renderer.setInsets(computeInsets());
});
// 휴대폰을 가로·세로로 돌려도 효과음 (기획서 12번)
const portraitQuery = matchMedia('(orientation: portrait)');
portraitQuery.addEventListener?.('change', e => {
  sound.sfx('rotate');
  if (coarse) toast(e.matches ? '📱 세로 화면!' : '📱 가로 화면!');
});

// ---------- 테스트용 ----------
window.render_game_to_text = () => JSON.stringify({
  screen, paused, talking,
  account: me()?.name || null, level: P().level, coins: P().coins, tower: P().tower,
  rewards: P().rewards, creatorUnlocked: creator.unlocked, ending: $('ending').hidden ? null : $('ending').dataset.kind,
  mode: game?.mode || null,
  net: account?.cloud ? { nickname: net.user?.nickname, cloud: cloud?.state ?? null, live: hub?.status ?? null } : null,
  online: online.state(),
  match: match ? {
    phase: match.phase, round: match.round, wins: match.wins, frame: match.frame,
    players: match.players.map(p => ({ state: p.state, score: p.score, incoming: p.incoming, pieces: p.stats?.pieces, maxChain: p.stats?.maxChain, piece: p.piece ? { x: p.piece.x, y: Math.round(p.piece.y * 10) / 10, rot: p.piece.rot } : null })),
  } : null,
});
if (TEST) {
  window.__puyo = { get match() { return match; }, get game() { return game; }, get practice() { return practice; }, get mailState() { return mailState; }, pollMail, friendNet, P, handleBack, store, startTower, startVs, startSolo, startLocal, startPractice, show, finishMatch, renderer, online, peerOnline, runEnding, recordPlayTime, pause, save,
    get cloud() { return cloud; }, get social() { return hub; }, net,
    // 예전 방식의 이 기기 계정 만들기 (화면에서는 더 이상 만들지 않는다. 브라우저 확인용)
    async localSignup(name, password) { const r = await createAccount(store, name, password); if (r.ok) { account = r.account; guest = null; save(); afterLogin(); } return r.ok; } };
}

// ---------- 시작 ----------
if (net.loggedIn && net.user) {
  const pending = marker.get(), local = pending && store.accounts.find(a => a.id === pending.localId);
  if (local) { show('login'); resumeMigration(local); } // 옮기던 중이었으면 마저 올린다
  else { enterCloud(net.user, { wait: false }); show('menu'); }
} else show(account ? 'menu' : 'login');
requestAnimationFrame(loop);
// 앱: 첫 화면이 그려진 다음에 시작 그림을 걷는다
requestAnimationFrame(() => requestAnimationFrame(hideSplash));
