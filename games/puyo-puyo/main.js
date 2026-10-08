import './style.css';
import { MAPS, getMap, mapIndex, mapTitle, mapRules } from './maps.mjs';
import { consumePromo } from './promo.mjs';
import { Match, FIRST_TO } from './match.mjs';
import { Renderer } from './render.mjs';
import { Sound } from './audio.mjs';
import { Controls } from './input.mjs';
import { AI_LEVELS, createBrain } from './ai.mjs';
import { FLOORS, TOP_FLOOR, floorState, currentFloor, helpLevel, floorReward, clearFloor, loseFloor } from './tower.mjs';
import { SKINS, EFFECTS, RANK_SKIN, findItem, canBuy, buy, equip, grant, canRedeem, redeem } from './shop.mjs';
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
import { serverUrl, scopedStorage, NET_GAME } from './net.mjs';
import { createWatch } from './watch.mjs';
import { CloudSave, CACHE_KEY, cloudPayload, writeCache } from './cloud.mjs';
import { migrateLocal, checkLocalPassword, markMigrated, migrationMarker, importIdFor, MIGRATING_KEY } from './migrate.mjs';
import { createSocialUI } from './social-ui.mjs';
import { playEnding } from './ending.mjs';
import { GRADES, gradeDone, gradeOpen, finishGrade, lessonCells, lessonSeq, lessonStep, newJudge, judge } from './tutorial.mjs';
import { PETS, PET_PRICE, drawPet, drawWith, equipPet, equippedPet, ownedCount, petName, petKinds, multText, chanceText, chanceTotal } from './pets.mjs';
import { drawPet as paintPet, drawEgg } from './pet-art.mjs';
import { BOOST_PRICE, boostLeft, spendBoost, buyBoost, matchBonus, applyBonus, clockText } from './bonus.mjs';
import { receiveGift, paySend, refundSend, giftText } from './gifts.mjs';
import {
  QUICK, STICKERS, EMOJIS, CHAT_MAX, FRIEND_MAX, REQUEST_MAX, cleanChat, personalInfo, rateLimiter, makeFriendCode, normaliseFriendCode,
  validFriendCode, validMailKey, makeMailKey, validSticker, bigEmoji, graphemes, cleanName, addFriend, removeFriend, pushChat,
  CHEERS, cheerText,
} from './chat.mjs';
import { drainMailbox, hasLegacy } from './legacy.mjs';
import { FriendNet } from './friendnet.mjs';
import { createMailClient, letterId } from './mailbox.mjs';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Number(n || 0).toLocaleString('ko-KR');
const TEST = new URLSearchParams(location.search).has('test');
const HI_TEST = new URLSearchParams(location.search).has('hi'); // 브라우저 확인에서 처음 인사 창도 띄울 때 (?test&hi)
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
let cloud = null, hub = null, cloudWarned = 0; // 온라인 계정으로 들어갔을 때: 클라우드 세이브, 친구와 알림(@inhyuk/net Social)
let statsSent = '', statsTimer = null, statsJob = null; // 온라인 랭킹에 마지막으로 올린 기록, 올리는 중인 일
let cloudLoaded = false; // 서버 저장을 다 읽었나. 읽기 전에는 친구 선물을 기록에 넣지 않는다 (읽어 온 기록과 어긋나지 않게)
let account = net.loggedIn ? null : currentAccount(store); // 이 기기 계정, 또는 온라인 계정({ cloud: true, uid })
let guest = null;
let device = { sound: true, music: true, haptics: true, hiSeen: false };
try { device = { ...device, ...JSON.parse(storage?.getItem(DEVICE_KEY) || '{}') }; } catch { /* 기본값 */ }
const me = () => account || guest;
const P = () => me()?.progress || (guest = { name: '손님', guest: true, progress: newProgress() }).progress;
// 기기 계정 목록을 기기에 적는다. 못 적으면(저장 공간이 꽉 참 등) false 를 돌려주고 알린다.
let storeFailed = false, storeWarned = 0;
function persistStore() {
  const ok = saveStore(storage, store);
  storeFailed = !ok;
  if (ok) mirrorSave(STORE_KEY, storage?.getItem(STORE_KEY));
  else if (Date.now() - storeWarned > 30000) { storeWarned = Date.now(); toast('⚠️ 이 기기에 기록을 저장하지 못했어. 저장 공간이 꽉 찼는지 확인해 줘.'); }
  return ok;
}
function save() {
  if (account?.cloud) { cloud?.change(cloudPayload(account.progress)); syncStats(); } // 3초 조용하면 서버에 올린다 (친구 코드 기록은 빼고)
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
let practice = null; // 배우기(연습하기) 중이면 { grade, index, judge, freeze, fails }. grade: 0 초급 ~ 11 졸업5, fails: 이 문제를 틀린 횟수

// ---------- 알림 ----------
function toast(text, gold = false) {
  const t = document.createElement('div');
  t.className = `toast${gold ? ' gold' : ''}`;
  t.textContent = text;
  $('toasts').append(t);
  setTimeout(() => t.remove(), 3300);
}

// ---------- 화면 ----------
const SCREENS = ['login', 'menu', 'tower', 'vs', 'local', 'solo', 'online', 'watch', 'ranking', 'friends', 'dm', 'missions', 'shop', 'profile', 'help', 'creator', 'rewards', 'pets', 'boost', 'school'];
function show(name) {
  if ((chatWith?.kind === 'friend' || chatWith?.kind === 'legacy') && name !== 'friends') closeChat(); // 친구 화면을 떠나면 친구 채팅 창도 닫는다
  screen = name;
  for (const s of SCREENS) $(`scr-${s}`).hidden = s !== name;
  $('hud').hidden = true;
  $('touch').hidden = true;
  $('watch-bar').hidden = true;
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
  if (name === 'solo') renderSolo();
  if (name === 'pets') renderPets();
  if (name === 'boost') renderBoost();
  if (name === 'school') renderSchool();
  if (name === 'missions') renderMissions();
  if (name === 'shop') renderShop();
  if (name === 'profile') renderProfile();
  if (name === 'help') renderHelp();
  if (name === 'creator') renderCreator();
  if (name === 'rewards') renderRewards();
  if (name === 'online' && !account?.cloud) peerOnline.refresh(); // 방 코드 대전 (이 기기 계정, 손님)
  if (name === 'friends') renderFriendsScreen();
  if (name === 'watch') renderWatchList();
  if (name === 'ranking') renderRanking();
  ui.render(name); // 온라인 계정: 온라인, 친구, 1:1 대화
  if (name === 'online') paintVote();
  watchFriends(name === 'friends' && legacyOn());
}

document.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => {
  sound.sfx('click');
  const to = btn.dataset.go;
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
  await runMigration({ nickname: local.name, password, mode: 'signup' });
};
function migratePanel(text, { fields = true, retry = false } = {}) {
  loginPanel('migrate');
  $('migrate-text').textContent = text;
  $('migrate-fields').hidden = !fields;
  $('migrate-retry').hidden = !retry;
}
// 옮기기 전에 친구 우체통에 남은 편지를 받아서 예전 계정의 친구 기록에 넣는다 (안 되면 기존 친구 화면을 열 때 다시 받는다)
// 한 묶음마다 기기에 저장(persistStore)된 뒤에만 우체통에서 지운다. 저장이 안 되면 { ok: false, error: 'save' }
async function drainLegacy(local) {
  return drainMailbox(local?.progress?.social, mail, { commit: () => persistStore() }).catch(() => ({ ok: false, count: 0 }));
}
const SAVE_FAILED = '이 기기에 기록을 저장하지 못해서 옮기지 않았어. 기기 계정은 그대로 있어. 저장 공간을 확인하고 다시 해 줘.';
async function runMigration(params) {
  const { local } = migrating;
  // 받은 편지를 기기에 저장하지 못했으면 옮기지 않는다 (기기 계정은 그대로, 편지는 우체통에 남음)
  const drained = await busy('migrate-form', () => busy('login-form', () => drainLegacy(local)));
  if (drained.error === 'save') { migrating.last = params; migratePanel(SAVE_FAILED, { fields: false, retry: true }); return; }
  const result = await busy('migrate-form', () => busy('login-form', () => migrateLocal({
    local, account: net, marker, ...params,
    upload: async (progress, importId) => {
      const acc = openCloud(net.user);
      await cloud.importLocal(cloudPayload(progress), importId);
      acc.progress = sanitize(cloud.data);
      account = acc;
    },
  })));
  if (result.ok) {
    markMigrated(store, local.id, result.user.nickname);
    // 못 적어도 기록은 서버에 있다. 기기 계정이 다음에 다시 보이면 옮기기를 다시 하면 된다 (importId 로 두 번 쓰지 않음).
    persistStore();
    migrating = null; guest = null;
    cloudLoaded = true;
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
  cloudLoaded = false;
  const acc = { name: user.nickname, cloud: true, uid: user.id, progress: newProgress() };
  cloud = new CloudSave({
    client: net, uid: user.id, storage: netStore, initial: newProgress,
    apply: data => { acc.progress = sanitize(data); if (account === acc && screen) renderScreen(screen); },
    onConflict: info => ui.chooseSave(info),
    onStatus: state => {
      const localFailed = !!cloud?.localFailed;
      ui.cloudStatus(state, localFailed);
      if (state === 'too-big') toast(localFailed
        ? '⚠️ 기록이 너무 커서 서버에 저장하지 못했고, 이 기기에도 저장하지 못했어. 창을 닫지 마.'
        : '⚠️ 기록이 너무 커서 서버에 저장하지 못했어. 이 기기에는 그대로 있고, 조금 뒤에 다시 올려 볼게.');
    },
    // 이 기기에 적지 못함: 서버 저장은 계속 시도하되, 기기에 남았다고 안내하지 않는다
    onPersistError: state => {
      ui.cloudStatus(state, true);
      if (Date.now() - cloudWarned > 30000) {
        cloudWarned = Date.now();
        toast(state === 'synced'
          ? '⚠️ 이 기기에 기록을 저장하지 못했어. 서버에는 올라갔지만 저장 공간을 확인해 줘.'
          : '⚠️ 이 기기에 기록을 저장하지 못했어. 서버에 올라갈 때까지 창을 닫지 마.');
      }
    },
    onPersistOk: () => ui.cloudStatus(cloud?.state, false),
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
  const loading = cloud.start().then(data => { if (data && !cloud?.dirty) acc.progress = sanitize(data); }).catch(() => {})
    .then(() => { if (account === acc) { cloudLoaded = true; if (!wait) { ui.refreshCounts(); greetHi(); } } }); // 다 읽은 뒤에 그동안 온 선물을 받는다
  if (wait) await loading; else loading.then(() => { if (account === acc && screen) renderScreen(screen); });
  startSocial();
}
function startSocial() {
  hub?.close();
  hub = new Social(net, ui.socialHooks);
  hub.live().catch(() => {});
  ui.refreshCounts();
  statsSent = '';
  syncStats(true);
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
  const drained = await drainLegacy(local);
  const acc = openCloud(net.user);
  try {
    if (drained.error === 'save') throw new Error('save');
    await cloud.importLocal(cloudPayload(local.progress), importIdFor(local));
    acc.progress = sanitize(cloud.data);
    markMigrated(store, local.id, net.user.nickname); persistStore();
    marker.clear();
    account = acc; guest = null;
    cloudLoaded = true;
    startSocial();
    toast(`☁️ ${net.user.nickname} 온라인 계정으로 옮겼어!`, true);
    afterLogin();
  } catch (error) {
    // 기기 계정과 옮기던 표시는 그대로 둔다. 다시 하기를 누르면 가입은 건너뛰고 올리기만 한다 (그만두면 로그아웃).
    stopCloud();
    if (account === acc) account = null;
    const code = error?.code ?? error?.message;
    const text = code === 'save' ? SAVE_FAILED
      : code === 'conflict-exhausted' ? '다른 기기가 계속 먼저 저장해서 기록을 올리지 못했어. 기기 계정은 그대로 있어. 잠시 뒤에 다시 해 줘.'
        : code === 'too-big' ? '기록이 너무 커서 서버가 받지 않았어. 기기 계정은 그대로 있어. 나중에 다시 해 줘.'
          : '온라인 계정으로 옮기던 기록을 올리지 못했어. 인터넷을 확인하고 다시 해 줘.';
    migrating = { local, last: { nickname: net.user?.nickname ?? local.name, mode: 'login' } };
    if (screen === 'login') migratePanel(text, { fields: false, retry: true });
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
  greetHi();
}

// ---------- 처음 인사 (인혁이 기획서 「뿌요뿌요 (업그레이드)」 7번) ----------
// "처음에 하이와 친구가 돼어주세요 라고 나오게 해줘." 게임을 켜서 메뉴가 처음 나올 때 한 번 「하이와 친구가 되어 주세요!」 창이 뜬다.
// - 온라인 계정: 「🤝 하이에게 친구 요청」을 누르면 닉네임 "하이"에게 친구 요청을 보낸다. 본 것은 계정 기록(hiAsked)에 적어서 다시 뜨지 않는다.
//   내가 하이이거나 이미 하이와 친구면 뜨지 않는다.
// - 이 기기 계정과 손님: 친구 요청은 온라인 계정만 보낼 수 있어서 안내만 하고, 이 기기에 한 번 봤다고 적는다 (온라인 계정으로 들어오면 그때 다시 한 번 나온다).
// 자동 확인(?test)에서는 다른 화면을 가리지 않게 ?hi 를 붙였을 때만 뜬다.
const HI_NICK = '하이';
let hiBusy = false;
async function greetHi() {
  if ((TEST && !HI_TEST) || hiBusy || screen !== 'menu' || match || !$('hi-pop').hidden) return;
  const acc = account, isCloud = !!acc?.cloud;
  if (isCloud) {
    if (!cloudLoaded || P().hiAsked || !hub || sameNick(net.user?.nickname, HI_NICK)) return;
    hiBusy = true;
    let friends = null;
    try { friends = await hub.friends(); } catch { /* 인터넷이 없으면 다음에 켤 때 다시 */ }
    hiBusy = false;
    if (!friends || account !== acc || screen !== 'menu' || match) return;
    if (friends.some(f => sameNick(f.nickname, HI_NICK))) { P().hiAsked = true; save(); return; }
  } else if (device.hiSeen) return;
  $('hi-text').textContent = isCloud
    ? '친구 요청을 보내면 하이가 수락할 때 친구가 돼. 친구가 되면 같이 대전하고 채팅하고 선물도 주고받을 수 있어. 친구가 많을수록 경험치와 코인도 더 받아!'
    : '하이에게 친구 요청을 보내려면 온라인 계정이 있어야 해. 온라인 계정을 만들거나 로그인하면 바로 보낼 수 있어!';
  $('hi-yes').textContent = isCloud ? '🤝 하이에게 친구 요청' : '✨ 계정 만들러 가기';
  $('hi-yes').disabled = false;
  $('hi-msg').textContent = '';
  const cv = $('hi-face'), ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  drawCharacter(ctx, 'hero', 100, 104, 180, 'happy', 0);
  $('hi-pop').hidden = false;
  sound.sfx('coin');
}
// 봤다고 적고 닫는다
function closeHi() {
  $('hi-pop').hidden = true;
  if (account?.cloud) P().hiAsked = true; else device.hiSeen = true;
  save();
}
$('hi-later').onclick = () => { sound.sfx('click'); closeHi(); };
$('hi-yes').onclick = async () => {
  sound.sfx('click');
  if (!account?.cloud) { // 이 기기 계정, 손님: 계정을 만들러 간다
    const local = !!account;
    closeHi();
    if (local) { logout(store); persistStore(); account = null; }
    guest = null;
    show('login');
    return;
  }
  if (!hub) { closeHi(); return; }
  $('hi-yes').disabled = true;
  $('hi-msg').textContent = '보내는 중…';
  try {
    const r = await hub.requestFriend(HI_NICK);
    toast(r.status === 'friends' ? '🤝 하이와 친구가 됐어!' : '🤝 하이에게 친구 요청을 보냈어. 하이가 수락하면 친구가 돼!', true);
    ui.refreshCounts();
    closeHi();
  } catch (error) {
    // 하이를 찾지 못했거나(닉네임이 아직 없음) 인터넷이 끊겼을 때: 창은 그대로 두고 알려 준다
    $('hi-msg').textContent = error.code === 'not-found' ? '지금은 하이를 찾지 못했어. 다음에 👫 친구에서 "하이"를 찾아 줘.' : error.message;
    $('hi-yes').disabled = false;
    sound.sfx('bump');
  }
};

// ---------- 메뉴 ----------
function renderMenu() {
  const p = P();
  trackStatus(); // 트로피, 친구, 펫 같은 지금 기록으로 깨지는 챌린지
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
  $('practice-badge').hidden = !!p.tutorial; // 배우기 초급(연습하기)을 끝내기 전까지 NEW
  // 펫, 2배 부스트, 지금 내 배수
  const pet = equippedPet(p), left = boostLeft(p);
  $('menu-pet-sub').textContent = pet ? `${petName(pet)}와 함께 · 경험치 ${multText(pet.mult)}` : '알에서 펫 뽑기 · 경험치 배수';
  $('pet-badge').hidden = !(p.tickets.pet > 0);
  $('pet-badge').textContent = p.tickets.pet;
  $('menu-boost-sub').textContent = left > 0 ? `켜짐! ${clockText(left)} 남음` : '경험치 · 코인 2배';
  $('boost-badge').hidden = !(p.tickets.boost > 0);
  $('boost-badge').textContent = p.tickets.boost;
  const bonus = bonusText();
  $('menu-bonus').hidden = !bonus;
  $('menu-bonus').textContent = `✨ 지금 내 배수: ${bonus}`;
  updateSocialBadges();
}
$('menu-bonus').onclick = () => { sound.sfx('click'); show('boost'); };

// ---------- 판 보상 배수: 펫, 2배 부스트, 친구 (인혁이 기획서 「뿌요뿌요 (업그레이드)」 1, 3, 6번) ----------
// 친구 수: 온라인 계정은 서버의 닉네임 친구(마지막으로 본 수를 기록에 적어 둔다), 이 기기 계정은 친구 코드 친구. 손님은 0명.
function friendTotal() {
  if (account?.cloud) return P().friendCount || 0;
  return account ? social().friends.length : 0;
}
const currentBonus = () => matchBonus(P(), { friends: friendTotal() });
function bonusText(b = currentBonus()) {
  const parts = [];
  if (b.pet) parts.push(`🐾 ${petName(b.pet)} 경험치 ×${b.petMult}`);
  if (b.boost > 1) parts.push(`⚡ 부스트 ×${b.boost}`);
  if (b.friends > 0) parts.push(`👫 친구 ${b.friends}명 ×${b.friend}`);
  return parts.join(' · ');
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
  paintMaps('vs-maps', 'vs-map-tip', 'vsMap', renderVs);
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
  // 위쪽 버튼 줄(#hud) 바로 아래부터. 연습하기에서는 꼬마 뿌요 말풍선 자리도 비운다.
  const top = Math.max(8, sa.top) + 46 + (practice ? $('coach').offsetHeight + 8 : 0);
  // 관전: 아래에 응원 줄(#watch-bar) 자리를 비운다
  if (game?.mode === 'watch') return { top, bottom: 8 + sa.bottom + ($('watch-bar').hidden ? 0 : $('watch-bar').offsetHeight + 4), left: 8 + sa.left, right: 8 + sa.right };
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
  paintWatchers(cfg.mode === 'online' && !cfg.viaPeer ? online.watchers : 0);
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
// 맵 규칙 (maps.mjs). 뿌요 정원은 기본 규칙이라 예전 화면 그대로 두고, 다른 맵은 그 맵의 배경과 이름을 보여 준다.
const mapRulesOf = arena => ({ map: arena.id, colors: arena.colors, minGroup: arena.minGroup, gravityScale: arena.gravityScale, target: arena.target });
const plainMap = arena => arena.id === 'garden';
function startVs(level, firstTo, mapId = P().settings.vsMap) {
  const info = FLOORS[level - 1], arena = getMap(mapId);
  startGame({
    mode: 'vs', level, title: `AI 대전 · ${info.boss}${plainMap(arena) ? '' : ` · ${mapTitle(arena)}`}`, theme: plainMap(arena) ? info.theme : arena.theme, music: level >= 6 ? 'boss' : 'battle', firstTo,
    ...mapRulesOf(arena),
    specs: [{ kind: 'human' }, { kind: 'ai', level }],
    views: [myView(), { name: info.boss, level: 0, skin: 'classic', effect: 'sparkle', char: info.char, color: '#ffb3c8' }],
  });
}
// 맵 고르기: 2인 플레이, AI 대전, 혼자 하기가 같은 여섯 맵을 쓴다 (기획서 4번). key: 고른 맵을 적어 두는 설정 칸
function paintMaps(gridId, tipId, key, again) {
  const current = getMap(P().settings[key]);
  $(gridId).innerHTML = MAPS.map(map => `<button class="map-card${map.id === current.id ? ' selected' : ''}" data-map="${map.id}" style="--map-color:${map.tint}" aria-pressed="${map.id === current.id}"><span>${map.emoji}</span><b>${map.name}</b><small>${map.desc}</small></button>`).join('');
  $(tipId).textContent = `${current.emoji} ${current.tip}`;
  $(gridId).querySelectorAll('button').forEach(button => { button.onclick = () => {
    P().settings[key] = button.dataset.map; save(); sound.sfx('click'); again();
  }; });
}
function renderLocal() { paintMaps('local-maps', 'local-map-tip', 'localMap', renderLocal); }
function renderSolo() { paintMaps('solo-maps', 'solo-map-tip', 'soloMap', renderSolo); }
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
function startSolo(mapId = P().settings.soloMap) {
  const arena = getMap(mapId);
  startGame({
    mode: 'solo', title: plainMap(arena) ? '혼자 하기 · 끝없이' : `혼자 하기 · ${mapTitle(arena)}`, theme: plainMap(arena) ? 'meadow' : arena.theme, music: 'menu', firstTo: 1,
    ...mapRulesOf(arena),
    specs: [{ kind: 'human' }], views: [myView()],
  });
}
$('solo-start').onclick = () => { sound.sfx('click'); startSolo(); };

// ---------- 뿌요뿌요 배우기 (초급 = 처음 하는 사람의 연습하기, 그리고 중급 → 상급 → 최상급) ----------
function startPractice(index = 0, grade = 0) {
  if (!GRADES[grade]?.lessons[index]) { grade = 0; index = 0; }
  startGame({
    mode: 'practice', title: grade ? `🎓 ${GRADES[grade].name} 배우기` : '🐣 연습하기', theme: 'meadow', music: 'menu', firstTo: 1, gravityScale: 0.6,
    specs: [{ kind: 'human' }], views: [myView()],
  });
  setLesson(index, grade);
}
const lessonsNow = () => GRADES[practice?.grade ?? 0].lessons;
const lessonNow = () => lessonsNow()[practice.index];
// "연습 2 / 3" (초급), "중급 2 / 3"
const stepText = () => `${practice.grade ? GRADES[practice.grade].name : '연습'} ${practice.index + 1} / ${lessonsNow().length}`;
function setLesson(index, grade = practice?.grade ?? 0, fails = 0) {
  practice = { index, grade, judge: newJudge(), freeze: false, fails };
  const lessons = lessonsNow(), lesson = lessons[index];
  const next = () => { sound.sfx('click'); if (index + 1 < lessons.length) setLesson(index + 1); else finishPractice(); };
  showCoach({
    step: stepText(), title: lesson.title, mood: lesson.tip ? 'happy' : 'idle',
    text: lessonStep(lesson, 0, fails) || lesson.text || (coarse ? lesson.touch : lesson.keys), // 시험은 두 번 틀리면 도움말로 바뀐다
    // 초급은 건너뛸 수 있다. 중급부터는 선물이 걸려 있어서 건너뛰지 못하고, 막히면 처음 모양으로 되돌린다.
    // 비결(tip)은 풀 것 없이 읽고 넘어간다.
    buttons: lesson.tip ? [['primary', index + 1 < lessons.length ? '알겠어! ▶' : '다 배웠어! 🎉', next]]
      : grade ? [['ghost', '↺ 처음 모양으로', () => { sound.sfx('click'); setLesson(index, grade, fails + 1); }]] // 되돌리기도 틀린 횟수로 센다 (시험은 두 번이면 도움말)
        : [['ghost', '건너뛰기', next]],
  });
  const player = match.players[0];
  resetLessonField(player, lesson);
  if (lesson.tip) {
    // 비결을 읽는 동안에는 뿌요가 나오지 않는다 (필드는 보기 그림). 3, 2, 1 을 세는 중이었으면 건너뛴다.
    practice.freeze = true;
    if (match.phase === 'countdown') { match.phase = 'play'; match.timer = 0; }
  } else if (match.phase === 'play' && player.state === 'ready') {
    // 비결로 시작한 등급(찐 마지막)은 3, 2, 1 을 건너뛰어서 아직 뿌요가 나온 적이 없다. 첫 문제에서 시작시킨다.
    player.start();
  }
}
// 직접 쌓는 수업: 짝을 하나 놓을 때마다 꼬마 뿌요의 안내를 바꾼다
function coachHint(text) {
  if (!text || $('coach-text').textContent === text) return;
  $('coach-text').textContent = text;
  if (match) renderer.setInsets(computeInsets());
  $('toasts').style.top = `${Math.round($('coach').getBoundingClientRect().bottom + 8)}px`;
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
  const lesson = lessonNow(), lessons = lessonsNow();
  const verdict = judge(lesson, practice.judge, e);
  if (!verdict && e.type === 'spawn') coachHint(lessonStep(lesson, practice.judge.pieces, practice.fails));
  if (verdict === 'done') {
    practice.freeze = true;
    sound.sfx('mission'); haptic('success');
    showCoach({ step: stepText(), title: '잘했어! ✨', text: lesson.done, mood: 'happy' });
    const next = practice.index + 1;
    setTimeout(() => {
      if (!practice || game?.mode !== 'practice') return;
      if (next < lessons.length) setLesson(next); else finishPractice();
    }, 2400);
  } else if (verdict === 'retry') {
    practice.freeze = true;
    sound.sfx('bump');
    showCoach({ step: stepText(), title: '다시 해 보자!', text: lesson.retry, mood: 'sad' });
    setTimeout(() => { if (practice && game?.mode === 'practice') setLesson(practice.index, practice.grade, practice.fails + 1); }, 2200);
  }
}
// 연습 중에 쌓여서 지면 그 수업을 처음부터
function practiceFail() {
  const index = practice?.index ?? 0, grade = practice?.grade ?? 0;
  setTimeout(() => { if (game?.mode === 'practice') startPractice(index, grade); }, 900);
}
function finishPractice() {
  if (!practice) return;
  practice.freeze = true;
  const p = P(), gi = practice.grade, grade = GRADES[gi];
  if (finishGrade(p, gi)) { // 처음 끝낸 등급이면 선물
    const r = grantReward(p, grade.reward);
    for (const level of r.lv.levels) trackEvent({ type: 'level', level });
    toast(gi ? `🎁 ${grade.name} 완료 선물 ${rewardText(r)}` : `🎁 연습 완료 선물 ${rewardText(r)}`, true);
    trackEvent(statusEvent(p)); // 배우기 챌린지
  }
  save();
  sound.sfx('level'); haptic('success');
  if (!gi) {
    showCoach({
      step: '연습 끝!', title: '이제 진짜 대결!', mood: 'happy',
      text: '큰 연쇄를 만들수록 상대에게 방해 뿌요가 많이 날아가. 1층 꼬마 뿌요에게 도전해 볼까?',
      buttons: [
        ['primary', '🗼 1층 도전', () => { sound.sfx('click'); quitGame(); startTower(1); }],
        ['ghost', '메뉴로', () => { sound.sfx('click'); quitGame(); }],
      ],
    });
    return;
  }
  const next = GRADES[gi + 1];
  showCoach({
    step: `${grade.name} 끝!`, title: next ? `다음은 ${next.name}!` : '모두 배웠어! 👑', mood: 'happy',
    text: next ? `${grade.name}을 모두 배웠어. 이어서 ${next.name}에 도전해 볼까?` : '초급부터 졸업5까지 뿌요뿌요 배우기 열두 단계를 모두 끝냈어! 졸업 축하해! 이제 타워와 온라인 대전에서 진짜 연쇄를 보여 줘.',
    buttons: [
      next ? ['primary', `${next.emoji} ${next.name} 배우기`, () => { sound.sfx('click'); startPractice(0, gi + 1); }]
        : ['primary', '🗼 타워로', () => { sound.sfx('click'); quitGame(); show('tower'); }],
      ['ghost', '배우기 목록', () => { sound.sfx('click'); quitGame(); }],
    ],
  });
}
// 배우기 목록: 초급 → 중급 → 상급 → 최상급 → 초초상급 → 마지막 → 찐 마지막 → 졸업 → 졸업2 → 졸업3 → 졸업4 → 졸업5. 앞 등급을 끝내야 다음 등급이 열린다.
function renderSchool() {
  const p = P(), list = $('school-list');
  list.innerHTML = '';
  GRADES.forEach((grade, i) => {
    const done = gradeDone(p, i), open = gradeOpen(p, i);
    const li = document.createElement('li');
    li.className = `grade ${done ? 'done' : open ? 'open' : 'locked'}`;
    li.dataset.grade = grade.id;
    const state = done ? '✔ 다 배웠어' : open ? '▶ 배울 수 있어' : `🔒 ${GRADES[i - 1].name}을 끝내면 열려`;
    li.innerHTML = `<div class="em">${grade.emoji}</div><div><h3>${grade.name}</h3><p>${esc(grade.desc)} (${grade.lessons.length}가지)</p><p class="state">${state}</p><p>${done ? '선물 받음' : '끝내면 선물'}: ${esc(rewardText(rewardPreview(grade.reward)))}</p></div>`;
    const b = document.createElement('button');
    if (open) {
      b.className = done ? 'ghost' : 'primary';
      b.textContent = done ? '다시 배우기' : '배우기!';
      b.onclick = () => { sound.sfx('click'); startPractice(0, i); };
    } else { b.textContent = '🔒'; b.disabled = true; b.setAttribute('aria-label', `${grade.name} 잠김`); }
    li.append(b);
    list.append(li);
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
  // 챌린지 알림 같은 쪽지는 말풍선 아래에 뜨게 해서 꼬마 뿌요 말을 가리지 않는다
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
  if (!match || game?.mode === 'online' || game?.mode === 'watch') return;
  paused = on;
  $('pause').hidden = !on;
  controls.reset();
}
$('hud-pause').onclick = () => {
  if (game?.mode === 'watch') { quitGame(); return; } // 관전 그만 보기
  if (game?.mode === 'online') { if (confirm('온라인 대전을 그만할까? 방에서 나가게 돼.')) quitGame(); return; }
  pause(true);
};
$('pause-resume').onclick = () => pause(false);
$('pause-retry').onclick = () => { $('pause').hidden = true; paused = false; retry(); };
$('pause-quit').onclick = () => { $('pause').hidden = true; paused = false; quitGame(); };
// 효과음 on and off, 배경음악 끄기 (인혁이 기획서 「뿌요뿌요 (업그레이드)」 1번).
// 메뉴, 일시정지 창, 내 정보에 「효과음 ON/OFF」「배경음악 ON/OFF」 단추가 있고, 게임 중에는 위쪽 동그란 단추로 바꾼다. 이 기기에 저장된다.
function updateHudButtons() {
  $('hud-sound').textContent = device.sound ? '🔊' : '🔇';
  $('hud-sound').classList.toggle('off', !device.sound);
  $('hud-music').classList.toggle('off', !device.music);
  $('hud-sound').setAttribute('aria-pressed', String(!!device.sound));
  $('hud-music').setAttribute('aria-pressed', String(!!device.music));
  document.querySelectorAll('[data-sound]').forEach(b => {
    const sfx = b.dataset.sound === 'sfx', on = sfx ? device.sound : device.music;
    b.textContent = sfx ? `${on ? '🔊' : '🔇'} 효과음 ${on ? 'ON' : 'OFF'}` : `🎵 배경음악 ${on ? 'ON' : 'OFF'}`;
    b.classList.toggle('off', !on);
    b.setAttribute('aria-pressed', String(!!on));
  });
  $('set-sound').checked = device.sound;
  $('set-music').checked = device.music;
}
function setSound(kind, on) {
  if (kind === 'sfx') { device.sound = on; sound.setSfx(on); if (on) sound.sfx('click'); } // 켤 때는 소리로 알려 준다
  else { device.music = on; sound.setMusic(on); }
  updateHudButtons();
  save();
}
$('hud-sound').onclick = () => setSound('sfx', !device.sound);
$('hud-music').onclick = () => setSound('music', !device.music);
document.querySelectorAll('[data-sound]').forEach(b => { b.onclick = () => { const sfx = b.dataset.sound === 'sfx'; setSound(sfx ? 'sfx' : 'music', !(sfx ? device.sound : device.music)); }; });
updateHudButtons();
document.addEventListener('visibilitychange', () => { if (document.hidden && match && !paused && game?.mode !== 'online' && game?.mode !== 'watch' && match.phase !== 'over') pause(true); });

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
  if (!$('hi-pop').hidden) { $('hi-later').click(); return true; }
  if (!$('invite-pop').hidden) { $('invite-no').click(); return true; }
  if (!$('pet-pop').hidden) { $('pet-pop-ok').click(); return true; }
  if (!$('gift-pop').hidden) { $('gift-close').click(); return true; }
  if (talking) { closeTalk(); return true; }
  if (!$('result').hidden) { [...$('result-buttons').querySelectorAll('button')].pop()?.click(); return true; }
  if (match) {
    if (game?.mode === 'online' || game?.mode === 'watch') $('hud-pause').click();
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
  if (game?.mode === 'watch') watcher.stop();
  paintWatchers(0);
  if (chatWith?.kind === 'room' || chatWith?.kind === 'watch') closeChat();
  const school = game?.mode === 'practice' && (practice?.grade ?? 0) > 0; // 중급부터는 배우기 목록으로 돌아간다
  endPractice();
  match = null;
  const back = game?.mode === 'tower' ? 'tower' : game?.mode === 'online' ? 'online' : game?.mode === 'watch' ? 'watch' : school ? 'school' : 'menu';
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
  else if (g.mode === 'vs') startVs(g.level, g.firstTo, g.map);
  else if (g.mode === 'local') startLocal(g.firstTo, g.map);
  else if (g.mode === 'solo') startSolo(g.map);
  else if (g.mode === 'practice') startPractice(practice?.index ?? 0, practice?.grade ?? 0);
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
  if (match && practice?.freeze) { renderer.step(m); return; } // 연습 칭찬 중: 뿌요는 멈추고 반짝이 효과만 움직인다
  const inputs = match ? controls.frame(2, m.players.map(p => p.state === 'control')) : [];
  m.step(inputs);
  for (const e of m.events) handle(e, m);
  m.events.length = 0;
  renderer.step(m);
  if (match && game?.mode === 'online') roomNet().tick(match);
  if (match && game && game.mode !== 'watch') watchDanger(m);
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
// 지금 내 기록으로 깨지는 챌린지 (인혁이 기획서 「뿌요뿌요 (업그레이드)」 5번에서 더한 트로피, 친구, 펫, 배우기, 코인, 출석 챌린지)
const statusEvent = (p = P()) => ({
  type: 'status', trophies: p.trophies || 0, friends: friendTotal(), petKinds: petKinds(p), petDraws: p.pets?.draws || 0,
  school: GRADES.filter((_, i) => gradeDone(p, i)).map(g => g.id), streak: p.rewards?.dailyStreak || 0, coins: p.coins,
});
// 온라인 계정은 서버 기록을 다 읽은 뒤에만 (읽기 전에 저장하면 다른 기기 기록과 어긋난다)
function trackStatus() {
  if (account?.cloud && !cloudLoaded) return;
  trackEvent(statusEvent());
}

function handle(e, m) {
  renderer.onEvent(e, m);
  if (m === demo) return;
  if (game.mode === 'watch') { watchSound(e, m); return; }
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
  // 트로피 (인혁이 기획서 3번): AI 대전, 온라인 대전을 이기면 1개씩
  const trophy = win && (g.mode === 'vs' || g.mode === 'online');
  if (trophy) p.trophies = (p.trophies || 0) + 1;
  // 온라인 승리는 서버가 두 사람의 결과 보고로 센다 (온라인 계정 대전만)
  if (g.mode === 'online' && !g.viaPeer) online.report(win);
  xp += totals.maxChain * 5;
  // 펫(경험치), 2배 부스트와 친구 수(경험치와 코인) 배수를 곱한다. 생일·공휴일 배수는 grantReward 가 그 뒤에 곱한다.
  const bonus = currentBonus();
  ({ coins, xp } = applyBonus({ coins, xp }, bonus));
  if (g.mode !== 'solo') trackEvent({ type: 'match', mode: g.mode, map: g.map, win });
  else trackEvent({ type: 'match', mode: 'solo', map: g.map, win: false });
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
  trackEvent(statusEvent(p));
  const before = { level: p.level, xp: p.xp };
  const reward = grantReward(p, { coins, xp });
  coins = reward.coins; xp = reward.xp;
  const lv = reward.lv;
  if (reward.bonus.birthday || reward.bonus.holidays.length) sub += ` · ${eventText(reward.bonus)}`;
  for (const level of lv.levels) trackEvent({ type: 'level', level });
  save();
  cloud?.flush().catch(() => {}); // 판이 끝나면 바로 올린다
  syncStats(true);
  const show = () => showResult({ title, sub, win: g.mode === 'solo' || g.mode === 'local' ? true : win, totals, coins, xp, lv, before, buttons, mode: g.mode, score: m.players[0].score, trophy, bonus: bonusText(bonus) });
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
    ['최대 연쇄', `${t.maxChain}연쇄`], ['점수', fmt(r.mode === 'solo' ? r.score : t.maxScore)], ['보낸 방해 뿌요', `${fmt(t.garbageSent)}개`],
    ['터뜨린 뿌요', `${fmt(t.popped)}개`], ['상쇄', `${t.offsets}번`], ['전소', `${t.allClears}번`],
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
  $('result-bonus').hidden = !r.bonus;
  $('result-bonus').textContent = r.bonus ? `✨ 배수 적용: ${r.bonus}` : '';
  $('result-trophy').hidden = !r.trophy;
  if (r.trophy) $('result-trophy').textContent = `🏆 트로피 +1 (모두 ${fmt(p.trophies)}개)`;
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
      toast('👑 황금 왕관 뿌요 스킨을 상점에서 장착해 봐.', true);
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
  if (!persistStore()) { resetMsg('이 기기에 저장하지 못했어. 저장 공간을 확인하고 다시 해 줘.'); sound.sfx('bump'); return; }
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
const ticketNames = { skin: '🎨 스킨 교환권', effect: '✨ 효과 교환권', spin: '🎟️ 추가 스핀', pet: '🥚 펫 뽑기권', boost: '⚡ 2배 부스트' };
function ticketText(tickets) {
  return Object.entries(ticketNames).filter(([key]) => tickets?.[key] > 0).map(([key, title]) => `${title} ${fmt(tickets[key])}${key === 'boost' ? '개' : '장'}`).join(' · ');
}
function rewardText(r) {
  return [r.coins ? `🪙 ${fmt(r.coins)}` : '', r.xp ? `경험치 ${fmt(r.xp)}` : '', ticketText(r.tickets)].filter(Boolean).join(' · ');
}
function inventoryText() { return ticketText(P().tickets) || '아직 교환권이 없어. 출석·스핀·시간 선물에서 받아 봐!'; }
const shopInventoryText = () => ticketText({ skin: P().tickets.skin, effect: P().tickets.effect }) || '아직 교환권이 없어. 출석·스핀·시간 선물에서 받아 봐!';
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

// ---------- 펫 (인혁이 기획서 「뿌요뿌요 (업그레이드)」 1번 그림) ----------
// 그림대로: 왼쪽 위 "뒤로", 가운데 "알", 그 아래 "펫 뽑기 1000원", 펫 다섯 칸에는 적힌 글 그대로
// (강아지 1.5배 / 70%, 고양이 50% / 3.0배, 키캡 5.0배 / 10%, 큰 키캡 10.0배 / 1%, ??? 100.0배 / 0.1%).
const EGG_MS = 1700;
let petAnim = null, petTimer = null; // petAnim: 알이 깨지는 중 { t0, result }
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function renderPets() {
  const p = P();
  const tickets = p.tickets.pet || 0;
  $('pet-draw').textContent = tickets > 0 ? `🥚 펫 뽑기권으로 뽑기 (${fmt(tickets)}장)` : `펫 뽑기 ${PET_PRICE}원`;
  $('pet-draw').disabled = !!petAnim;
  $('pet-draw-note').textContent = petAnim ? '두근두근… 알이 깨지고 있어!' : drawWith(p) ? '' : `코인이 ${fmt(PET_PRICE - p.coins)}개 모자라. 대전이나 🎁 보상 받기에서 모아 봐!`;
  const now = equippedPet(p);
  $('pet-cards').innerHTML = PETS.map((pet, i) => {
    const count = ownedCount(p, pet.id), on = now?.id === pet.id, name = petName(pet, count > 0);
    // 기획서 그림의 두 줄: 고양이만 "고양이 50%" 아래에 "3.0배" 라고 적혀 있다
    const [l1, l2] = pet.id === 'cat' ? [`${name} ${chanceText(pet.chance)}`, multText(pet.mult)] : [`${name} ${multText(pet.mult)}`, chanceText(pet.chance)];
    return `<div class="pet-card${i === PETS.length - 1 ? ' wide' : ''}${on ? ' equipped' : ''}" data-pet="${pet.id}">
      <canvas width="140" height="140" data-pet="${pet.id}" data-owned="${count > 0 ? 1 : 0}" role="img" aria-label="${esc(name)}"></canvas>
      <span class="l1">${esc(l1)}</span><span class="l2">${esc(l2)}</span>
      <div class="own"><span>${count > 0 ? `가진 수 ${fmt(count)}` : '아직 없어'}</span>${count > 0 ? `<button ${on ? 'disabled' : 'class="ghost"'} data-equip="${pet.id}">${on ? '✔ 함께하는 중' : '데리고 다니기'}</button>` : ''}</div>
    </div>`;
  }).join('');
  $('pet-cards').querySelectorAll('[data-equip]').forEach(button => { button.onclick = () => {
    if (!equipPet(P(), button.dataset.equip)) return;
    save(); sound.sfx('click');
    toast(`🐾 ${petName(equippedPet(P()))}와 함께 다녀! 경험치 ${multText(equippedPet(P()).mult)}`);
    renderPets();
  }; });
  $('pet-odds').textContent = `% 숫자를 모두 더하면 ${chanceTotal()}이라서, 적힌 숫자의 비율로 뽑아 (강아지는 ${chanceTotal()}번 가운데 70번꼴).`;
  $('pet-now').textContent = now ? `🐾 지금 ${petName(now)}와 함께! 판에서 받는 경험치 ${multText(now.mult)}` : '아직 펫이 없어. 알을 깨서 첫 펫을 만나 봐!';
  refreshCoins();
  clearInterval(petTimer);
  const t0 = performance.now();
  const paint = () => {
    if (screen !== 'pets') { clearInterval(petTimer); return; }
    const t = (performance.now() - t0) / 1000;
    const egg = $('pet-egg'), ctx = egg.getContext('2d');
    const a = petAnim ? Math.min(1, (performance.now() - petAnim.t0) / EGG_MS) : 0;
    ctx.clearRect(0, 0, egg.width, egg.height);
    drawEgg(ctx, egg.width / 2, egg.height / 2 + 6, 270, t, { shake: petAnim ? 1 : 0, crack: petAnim ? a * 1.5 : 0, open: a > 0.82 ? (a - 0.82) / 0.18 : 0 });
    $('egg-label').hidden = a > 0.82;
    for (const cv of $('pet-cards').querySelectorAll('canvas')) {
      const c = cv.getContext('2d');
      c.clearRect(0, 0, cv.width, cv.height);
      paintPet(c, cv.dataset.pet, 70, 74, 124, t, cv.dataset.owned === '1');
    }
  };
  paint();
  petTimer = setInterval(paint, 40);
}
function showPet(result) {
  const { pet, isNew, count, equipped } = result;
  const name = petName(pet);
  sound.sfx(pet.mult >= 5 ? 'level' : 'coin'); haptic('success');
  if (screen !== 'pets') { toast(`🥚 ${name}이(가) 나왔어! 경험치 ${multText(pet.mult)}`, true); return; }
  $('pet-pop').hidden = false;
  $('pet-pop-title').textContent = `${isNew ? '🎉 새 펫! ' : ''}${name}`;
  $('pet-pop-text').textContent = `경험치 ${multText(pet.mult)}. ${equipped ? '이제부터 함께 다녀!' : `지금 펫이 더 좋아서 그대로 데리고 다녀 (가진 수 ${fmt(count)}).`}`;
  $('pet-pop-again').disabled = !drawWith(P());
  const cv = $('pet-pop-art'), ctx = cv.getContext('2d'), t0 = performance.now();
  const timer = setInterval(() => {
    if ($('pet-pop').hidden) { clearInterval(timer); return; }
    ctx.clearRect(0, 0, cv.width, cv.height);
    paintPet(ctx, pet.id, 120, 126, 210, (performance.now() - t0) / 1000, true);
  }, 40);
}
$('pet-draw').onclick = () => {
  if (petAnim) return;
  const owner = me();
  // 먼저 뽑아서 저장한다. 알이 깨지는 동안 새로고침해도 뽑은 펫이 사라지지 않는다.
  const result = drawPet(P());
  if (!result) { sound.sfx('bump'); toast(`펫을 뽑으려면 코인 ${fmt(PET_PRICE)}개가 필요해.`); renderPets(); return; }
  save();
  sound.sfx('click'); haptic('light');
  petAnim = { t0: performance.now(), result };
  $('pet-draw').disabled = true;
  $('pet-draw-note').textContent = '두근두근… 알이 깨지고 있어!';
  refreshCoins();
  setTimeout(() => {
    petAnim = null;
    if (owner !== me()) return; // 그사이 다른 계정으로 바뀜
    if (screen === 'pets') renderPets();
    showPet(result);
  }, calm() ? 150 : EGG_MS);
};
$('pet-pop-ok').onclick = () => { sound.sfx('click'); $('pet-pop').hidden = true; };
$('pet-pop-again').onclick = () => { $('pet-pop').hidden = true; $('pet-draw').click(); };

// ---------- 2배 부스트와 지금 내 배수 (기획서 3번, 6번) ----------
let boostTimer = null;
function boostStateText(left) { return left > 0 ? `⚡ 2배 부스트 켜짐! ${clockText(left)} 남음` : '부스트가 꺼져 있어'; }
function renderBoost() {
  const p = P(), left = boostLeft(p), have = p.tickets.boost || 0, b = currentBonus();
  $('scr-boost').querySelector('.boost-card').classList.toggle('on', left > 0);
  $('boost-state').textContent = boostStateText(left);
  $('boost-have').textContent = `가진 부스트: ${fmt(have)}개`;
  $('boost-use').disabled = !have;
  $('boost-use').textContent = left > 0 ? '⚡ 15분 더 쓰기' : '⚡ 부스트 쓰기 (15분)';
  $('boost-buy').disabled = p.coins < BOOST_PRICE;
  $('boost-buy').innerHTML = `<span class="price">🪙 ${fmt(BOOST_PRICE)}</span>으로 사기`;
  const count = friendTotal();
  $('bonus-rows').innerHTML = [
    ['🐾 펫', `×${b.petMult}`, b.pet ? `${petName(b.pet)} · 경험치만` : '펫이 없어'],
    ['⚡ 부스트', `×${b.boost}`, left > 0 ? '경험치 · 코인' : '꺼져 있어'],
    ['👫 친구', `×${b.friend}`, account ? `${fmt(count)}명 · 경험치 · 코인` : '계정이 있어야 해'],
  ].map(([k, v, note]) => `<div><small>${k}</small><b>${v}</b><small>${esc(note)}</small></div>`).join('');
  $('bonus-total').textContent = `지금 판을 끝내면 경험치 ×${b.xp} · 코인 ×${b.coins}`;
  refreshCoins();
  clearInterval(boostTimer);
  boostTimer = setInterval(() => {
    if (screen !== 'boost') { clearInterval(boostTimer); return; }
    const now = boostLeft(P());
    if (left > 0 && now <= 0) { renderBoost(); return; } // 방금 끝남
    $('boost-state').textContent = boostStateText(now);
  }, 500);
}
$('boost-use').onclick = () => {
  if (!spendBoost(P())) return;
  trackEvent({ type: 'boost' });
  save(); sound.sfx('level'); haptic('success');
  toast('⚡ 2배 부스트 시작! 15분 동안 경험치와 코인이 2배!', true);
  renderScreen('boost');
};
$('boost-buy').onclick = () => {
  if (!buyBoost(P())) { sound.sfx('bump'); return; }
  save(); sound.sfx('coin');
  toast('⚡ 2배 부스트를 샀어!');
  renderScreen('boost');
};

// ---------- 챌린지 ----------
let missionFilter = 'all';
$('mission-filter').onchange = e => { missionFilter = e.target.value; renderMissions(); };
function renderMissions() {
  const p = P();
  track(p, { type: 'career', ...p.stats });
  track(p, { type: 'level', level: p.level });
  track(p, { type: 'collection', skin: p.owned.skin.length, effect: p.owned.effect.length });
  track(p, statusEvent(p));
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
  $('shop-inventory').textContent = shopInventoryText();
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
    card.insertAdjacentHTML('beforeend', `<b>${esc(item.name)}</b><p>${esc(item.desc)}</p>${item.noTicket && !owned ? `<small class="hard-tag">🏅 Lv.${item.level} 고난이도 · 교환권으로 못 받아</small>` : ''}`);
    const b = document.createElement('button');
    if (on) { b.textContent = '✔ 장착 중'; b.disabled = true; }
    else if (owned) { b.textContent = '장착하기'; b.className = 'ghost'; }
    else if (state === 'reward') { b.textContent = item.reward === 'tower' ? '🗼 타워 정복 보상' : item.reward === 'nova' ? '🌟 노바 클리어 보상' : item.reward === 'ranking' ? '🎖️ 온라인 랭킹 5등 보상' : '☄️ 혜성 클리어 보상'; b.disabled = true; }
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
  $('profile-trophies').textContent = fmt(p.trophies || 0);
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
    ['터뜨린 뿌요', `${fmt(s.popped)}개`], ['보낸 방해 뿌요', `${fmt(s.garbageSent)}개`], ['전소', `${fmt(s.allClears)}번`],
    ['상쇄', `${fmt(s.offsets)}번`], ['온라인', `${fmt(s.onlineWins)}승 / ${fmt(s.onlineGames)}판`], ['엔딩 본 횟수', `${t.endings || 0}번`],
  ].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('');
  $('set-sound').checked = device.sound;
  $('set-music').checked = device.music;
  $('set-ghost').checked = p.settings.ghost !== false;
  $('set-shake').checked = p.settings.shake !== false;
  $('set-haptic').checked = device.haptics !== false;
  $('set-chat').checked = chatOn();
  $('delete-zone').hidden = !account; // 이 기기 계정도, 온라인 계정도 지울 수 있다
  $('delete-confirm').hidden = true;
  $('export-copy').disabled = !account;
  // 온라인 계정은 기록 코드 대신 자동 저장 (서버 계정 지우기는 아직 없음)
  for (const id of ['export-title', 'export-fine', 'export-copy']) $(id).hidden = !!account?.cloud;
  $('cloud-note').hidden = !account?.cloud;
  if (account?.cloud) ui.cloudStatus(cloud?.state, !!cloud?.localFailed);
  $('logout').textContent = account ? '🚪 로그아웃' : '🔑 로그인하러 가기';
  $('export-code').hidden = true;
}
$('set-sound').onchange = e => setSound('sfx', e.target.checked);
$('set-music').onchange = e => setSound('music', e.target.checked);
$('set-ghost').onchange = e => { P().settings.ghost = e.target.checked; save(); };
$('set-shake').onchange = e => { P().settings.shake = e.target.checked; save(); };
$('set-haptic').onchange = e => { device.haptics = e.target.checked; save(); haptic('medium'); };
$('set-chat').onchange = e => { P().settings.chat = e.target.checked; save(); if (!e.target.checked) closeChat(); };
// 계정 지우기: 이 기기에 저장된 그 계정의 모든 기록을 없앤다 (앱스토어 규칙: 앱 안에서 계정을 지울 수 있어야 함)
// 온라인 계정은 서버에서 지운다 (POST /auth/delete, 비밀번호를 한 번 더 확인). 친구, 대화, 모든 게임의 저장까지 사라진다.
$('delete-account').onclick = () => {
  if (!account) return;
  sound.sfx('click');
  $('delete-name').textContent = account.name;
  $('delete-what').textContent = account.cloud
    ? '레벨·코인·스킨·타워 기록과 친구, 대화가 서버에서 모두 사라지고 되돌릴 수 없어. seonn 의 다른 게임에서 쓰는 같은 계정도 함께 지워져.'
    : '레벨·코인·스킨·타워 기록이 이 기기에서 모두 사라지고 되돌릴 수 없어.';
  $('delete-pass').hidden = !account.cloud;
  $('delete-pass').value = '';
  $('delete-msg').textContent = '';
  $('delete-confirm').hidden = false;
  if (account.cloud) $('delete-pass').focus();
};
$('delete-cancel').onclick = () => { sound.sfx('click'); $('delete-confirm').hidden = true; $('delete-pass').value = ''; };
let deleting = false;
async function deleteCloudAccount() {
  const acc = account, password = $('delete-pass').value;
  if (!acc?.cloud || deleting) return;
  if (!password) { $('delete-msg').textContent = '비밀번호를 적어 줘.'; sound.sfx('bump'); return; }
  deleting = true;
  $('delete-yes').disabled = true;
  $('delete-msg').textContent = '지우는 중…';
  // 지우는 동안에는 이 기기의 알림과 자동 저장을 멈춘다 (서버가 "지워졌어" 하고 끊는 것을 로그인 풀림으로 보지 않게)
  online.leave();
  stopSocial();
  cloud?.clearTimers();
  let error = null;
  try { await net.deleteAccount(password); } catch (e) { error = e; }
  deleting = false;
  $('delete-yes').disabled = false;
  if (account !== acc) return; // 그사이 로그인이 풀렸다
  if (error?.code === 'login-required' || error?.code === 'suspended') { lostLogin(error.code); return; }
  // 서버가 아직 이 길(/auth/delete)을 모르면(다시 배포하기 전) 브라우저가 요청을 미리 물어보는 단계에서 막혀서
  // "연결하지 못함"으로 보인다. 다른 길(/me)이 되면 서버는 살아 있는 것이니, 인터넷 탓이 아니라고 알려 준다.
  let notReady = error?.status === 404;
  if (error?.code === 'network') {
    $('delete-msg').textContent = '서버를 확인하는 중…';
    $('delete-yes').disabled = true;
    try { await net.me(); notReady = true; } catch (e) { notReady = !!e.code && e.code !== 'network' && e.code !== 'login-required' && e.code !== 'suspended'; }
    $('delete-yes').disabled = false;
    if (account !== acc) return;
    if (!net.loggedIn) { lostLogin('login-required'); return; }
  }
  if (error) {
    startSocial(); // 못 지웠으면 예전처럼 이어 간다
    // 서버가 예전 버전일 때: 이 게임을 만든 집(인혁이네)에서 서버를 다시 배포해야 한다. 다른 사람에게는 "부모님께 말해 줘"가 맞지 않아서 기다려 달라고만 한다.
    $('delete-msg').textContent = notReady ? '아직 지울 수 없어. 게임 서버가 새 버전으로 바뀌어야 계정 지우기가 돼 (만든 사람이 준비하고 있어). 조금 뒤에 다시 해 줘. 인터넷과 비밀번호는 괜찮아!' : error.message;
    $('delete-pass').value = '';
    sound.sfx('bump');
    return;
  }
  // 서버에서 지워졌다. 이 기기에 남은 것도 지운다: 저장해 둔 기록, 옮기기 전의 기기 계정(숨겨 둔 것)
  stopCloud();
  writeCache(netStore, acc.uid, null);
  for (const old of store.accounts.filter(a => sameNick(a.migratedTo, acc.name))) {
    const s = old.progress?.social; // 예전 친구 코드의 우체통에 남은 편지와 열쇠도 지운다
    if (validFriendCode(s?.code) && validMailKey(s?.key)) mail.forget(s.code, s.key);
    removeAccount(store, old.id);
  }
  persistStore();
  creator.lock();
  account = null; guest = null;
  $('delete-confirm').hidden = true;
  $('delete-pass').value = '';
  toast(`🗑️ ${acc.name} 계정을 지웠어.`);
  show('login');
}
$('delete-pass').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('delete-yes').click(); } };
$('delete-yes').onclick = () => {
  if (!account) return;
  if (account.cloud) { deleteCloudAccount(); return; }
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
  vote: () => mapIndex(P().settings.onlineMap),
  start: ({ seed, firstTo, opponent, peer, role, makeRemote, map, tie }) => {
    const arena = getMap(map);
    startGame({
      mode: 'online', online: role, seed, firstTo, title: `온라인 · ${opponent.nickname}${plainMap(arena) ? '' : ` · ${mapTitle(arena)}`}`, theme: plainMap(arena) ? 'starry' : arena.theme, music: 'battle',
      ...mapRulesOf(arena),
      specs: [{ kind: 'human' }, { kind: 'remote' }], makeRemote,
      views: [myView({ char: null }), { name: opponent.nickname, level: peer.level, skin: peer.skin || 'classic', effect: peer.effect || 'sparkle', char: null, color: '#9fe3ff' }],
    });
    voteToast(arena, tie);
  },
  match: () => match,
  isFinished: () => !!game?.finished,
  quit: () => { if (match && game?.mode === 'online') { match = null; game = null; $('result').hidden = true; startDemo(); show('online'); } },
  render: () => { if (!online.active && chatWith?.kind === 'room') closeChat(); ui.onlineChanged(); paintVote(); },
  // 대전 채팅: 내가 보낸 줄은 sendChat 이 이미 적었다
  chatLine: entry => { if (entry.who === 'them') roomChat({ name: online.peerName(), text: entry.text, sticker: entry.sticker }); },
  chatReset: () => roomJoined(),
  watchersChanged: n => { if (game?.mode === 'online' && !game.viaPeer) paintWatchers(n); },
  // 관전하는 사람이 보낸 관전 채팅과 응원 (기획서 「뿌요뿌요 (업그레이드)」 3번)
  watcherLine: line => {
    if (game?.mode !== 'online' || game.viaPeer) return;
    watcherSaid(line, line.cheer === undefined ? null : { side: line.mine ? 0 : 1, name: line.mine ? '나' : online.peerName() });
  },
});
// 방 코드 대전 (PeerJS): 이 기기 계정과 손님. 주고받는 모양은 예전 버전 게임과 같다.
const peerOnline = createPeerOnline({
  $, toast, sound, esc,
  me: () => ({ name: me()?.name || '손님', level: P().level, skin: P().equip.skin, effect: P().equip.effect }),
  vote: () => mapIndex(P().settings.onlineMap),
  lobbyChanged: () => paintVote(),
  start: ({ seed, firstTo, peer, role, makeRemote, map, tie }) => {
    const arena = getMap(map);
    startGame({
      mode: 'online', online: role, viaPeer: true, seed, firstTo, title: `온라인 · ${peer.name}${plainMap(arena) ? '' : ` · ${mapTitle(arena)}`}`, theme: plainMap(arena) ? 'starry' : arena.theme, music: 'battle',
      ...mapRulesOf(arena),
      specs: [{ kind: 'human' }, { kind: 'remote' }], makeRemote,
      views: [myView({ char: null }), { name: peer.name, level: peer.level, skin: peer.skin || 'classic', effect: peer.effect || 'sparkle', char: null, color: '#9fe3ff' }],
    });
    voteToast(arena, tie);
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
// 온라인 맵 투표 (기획서 4번): 로비에서 두 사람이 맵에 표를 던진다. 같은 맵이면 그 맵, 다르면 방장이 시작할 때 둘 중에서 뽑는다.
function paintVote() {
  if (screen !== 'online' || $('online-lobby').hidden) return;
  const state = roomNet().state();
  const mine = state.vote ?? mapIndex(P().settings.onlineMap), theirs = state.peerVote ?? null;
  $('online-maps').innerHTML = MAPS.map((map, i) => `<button class="map-card${i === mine ? ' selected' : ''}" data-map="${map.id}" style="--map-color:${map.tint}" aria-pressed="${i === mine}"><span>${map.emoji}</span><b>${map.name}</b><small>${map.desc}</small><i class="vote-tags">${i === mine ? '<i class="vote-tag me">나</i>' : ''}${i === theirs ? '<i class="vote-tag you">상대</i>' : ''}</i></button>`).join('');
  $('online-maps').querySelectorAll('button').forEach((button, i) => { button.onclick = () => {
    sound.sfx('click');
    P().settings.onlineMap = MAPS[i].id; save();
    roomNet().setVote(i);
    paintVote();
  }; });
  const a = MAPS[mine], b = theirs === null ? null : MAPS[theirs];
  $('online-vote-text').textContent = !b ? `내 표: ${mapTitle(a)} · 상대 표를 기다리는 중… (상대 표가 없으면 뿌요 정원에서 해)`
    : a === b ? `둘 다 ${mapTitle(a)}! 이 맵에서 대결해.`
      : `내 표: ${mapTitle(a)} · 상대 표: ${mapTitle(b)} → 표가 같아서 시작할 때 둘 중 하나를 뽑아!`;
}
function voteToast(arena, tie) {
  toast(tie ? `🎲 표가 갈려서 뽑기로 정했어: ${mapTitle(arena)} (${mapRules(arena)})` : `🗺️ ${mapTitle(arena)}에서 대결! (${mapRules(arena)})`);
}
function roomJoined() { roomLog.length = 0; roomMuted = false; roomUnread = 0; updateRoomDots(); }
const ui = createSocialUI({
  $, toast, sound, online,
  show, screen: () => screen, social: () => hub, user: () => (account?.cloud ? net.user : null), P,
  leaveOnline: () => { if (game?.mode === 'online') quitGame(); else online.leave(); },
  stopGame: () => { if (match) { $('pause').hidden = true; paused = false; quitGame(); } },
  lost: reason => lostLogin(reason),
  chatOn: () => chatOn(),
  stickerImg: i => stickerURL(i),
  watch: entry => watchMatch(entry),
  // 친구 수가 바뀌면 적어 둔다 (친구 배수). 서버에서 받아 온 수만 쓴다.
  friendsChanged: n => {
    if (!account?.cloud || P().friendCount === n) return;
    P().friendCount = n; save();
    if (screen === 'menu') renderMenu();
    if (screen === 'boost') renderBoost();
  },
  // 친구 선물 (기획서 7번): 보내기 전에 값을 치르고, 받은 선물은 메시지 번호로 한 번만 기록에 넣는다
  gifts: {
    pay: gift => { if (!account?.cloud || !paySend(P(), gift)) return false; save(); refreshCoins(); return true; },
    refund: gift => { refundSend(P(), gift); save(); refreshCoins(); },
    sent: (gift, nickname) => { sound.sfx('coin'); toast(`🎁 ${nickname}에게 ${giftText(gift)}을(를) 선물했어!`, true); trackEvent({ type: 'giftSent' }); cloud?.flush().catch(() => {}); },
    receive(gift, { from, nickname, id }) {
      if (!account?.cloud || !cloudLoaded) return null;
      const r = receiveGift(P(), gift, { from, id });
      if (!r) return null;
      save();
      cloud?.flush().catch(() => {}); // 받은 것을 바로 올린다
      sound.sfx('coin'); haptic('success');
      toast(r.item ? `🎁 ${nickname}이(가) ${giftText(gift)}을(를) 선물했어! 상점에서 낄 수 있어.`
        : r.converted ? `🎁 ${nickname}이(가) ${giftText(gift)}을(를) 선물했어! 이미 가지고 있어서 🪙 ${fmt(r.coins)}로 받았어.`
          : `🎁 ${nickname}이(가) 🪙 ${fmt(r.coins)}을(를) 선물했어!`, true);
      if (r.capped) toast('오늘 선물로 받을 수 있는 코인을 다 받았어. 넘는 만큼은 받지 못했어.');
      if (r.item) trackEvent({ type: 'collection', skin: P().owned.skin.length, effect: P().owned.effect.length });
      refreshCoins();
      if (screen === 'menu') renderMenu();
      return r;
    },
  },
});
// 화면에 보이는 코인 수를 다시 적는다
function refreshCoins() { document.querySelectorAll('.coin-count').forEach(el => { el.textContent = fmt(P().coins); }); }
// 시작 단추: 온라인 계정 방이면 net 서버 대전, 아니면 방 코드 대전
$('online-start').onclick = () => { sound.sfx('click'); roomNet().start(); };
addEventListener('pagehide', () => { online.leave(); cloud?.flush().catch(() => {}); });
document.addEventListener('visibilitychange', () => { if (document.hidden) cloud?.flush().catch(() => {}); });
addEventListener('online', () => cloud?.retryNow());

// ---------- 온라인 랭킹 (인혁이 기획서 5, 6번) ----------
// 온라인 계정이면 랭킹에 쓰는 레벨, 경험치, 트로피를 서버에 올린다 (바뀌었을 때만, 조용해지고 나서).
// 온라인 승리는 서버가 대전 결과 보고로 직접 센다. 세 랭킹 중 하나라도 5등 안에 들면 「챔피언 뿌요」 스킨을 준다.
function syncStats(soon = false) {
  if (!account?.cloud || !hub) return;
  clearTimeout(statsTimer);
  statsTimer = setTimeout(() => { sendStats(); }, soon ? 1500 : 20000);
}
// 올리는 중이면 그 일이 끝나기를 같이 기다린다 (랭킹 화면이 올리기 전 기록을 받아 오지 않게)
function sendStats() {
  if (statsJob) return statsJob;
  if (!account?.cloud || !hub) return Promise.resolve();
  const p = P(), body = { level: p.level, xp: p.xp, trophies: p.trophies || 0 };
  const key = JSON.stringify(body);
  if (key === statsSent) return Promise.resolve();
  const social = hub;
  statsJob = (async () => {
    try {
      await social.putStats(NET_GAME, body);
      if (social !== hub) return; // 그사이 로그아웃하거나 다른 계정으로 들어감
      statsSent = key;
      const { me: mine } = await social.rankings(NET_GAME, 'trophies');
      if (social === hub) rewardTop5(mine);
    } catch { /* 인터넷이 없으면 다음 저장 때 다시 */ } finally { statsJob = null; }
  })();
  return statsJob;
}
function rewardTop5(mine) {
  const p = P();
  if (!mine?.top5 || !account?.cloud || p.owned.skin.includes(RANK_SKIN)) return;
  grant(p, 'skin', RANK_SKIN);
  save();
  toast(`🎖️ 온라인 랭킹 5등 안에 들어서 「${findItem('skin', RANK_SKIN).name}」 스킨을 받았어! 상점에서 낄 수 있어.`, true);
  sound.sfx('level');
}

const RANK_VALUE = { trophies: '트로피', level: '경험치', wins: '온라인 승리' };
const RANK_TIP = {
  trophies: 'AI 대전, 온라인 대전을 이길 때마다 트로피를 1개씩 받아.',
  level: '레벨이 높은 순서야 (레벨 2부터 나와). 레벨이 같으면 경험치가 많은 사람이 위야.',
  wins: '온라인 대전에서 이긴 횟수야. 두 사람이 보낸 결과가 같아야 세어져.',
};
let rankBy = 'trophies', rankLoading = 0;
const fineText = text => Object.assign(document.createElement('p'), { className: 'fine', textContent: text });
function cell(cls, text) { const e = document.createElement('span'); e.className = cls; e.textContent = text; return e; }
const rankValue = (row, by) => (by === 'trophies' ? `🏆 ${fmt(row.trophies)}` : by === 'wins' ? `🌐 ${fmt(row.wins)}승` : `✨ ${fmt(row.xp)}`);
async function renderRanking() {
  const on = !!(account?.cloud && hub);
  $('rank-need-login').hidden = on;
  $('rank-board').hidden = !on;
  $('rank-me').hidden = !on;
  $('rank-tabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.by === rankBy));
  $('rank-tip').textContent = RANK_TIP[rankBy];
  $('rank-val-head').textContent = RANK_VALUE[rankBy];
  if (!on) return;
  const ticket = ++rankLoading, by = rankBy;
  $('rank-list').replaceChildren(fineText('랭킹을 불러오는 중…'));
  $('rank-me').textContent = '';
  await sendStats(); // 내 기록이 바뀌었으면 먼저 올린다
  let r;
  try { r = await hub.rankings(NET_GAME, by); } catch (error) { if (ticket === rankLoading) $('rank-list').replaceChildren(fineText(error.message)); return; }
  if (ticket !== rankLoading || screen !== 'ranking') return;
  const myId = net.user?.id;
  $('rank-list').replaceChildren(...(r.list.length ? r.list.map(row => {
    const line = document.createElement('div');
    line.className = `rank-row${row.id === myId ? ' me' : ''}${row.rank <= 5 ? ' top' : ''}`;
    line.append(cell('rk', ['🥇', '🥈', '🥉'][row.rank - 1] || `${row.rank}`), cell('nm', row.nickname), cell('lv', `Lv.${row.level}`), cell('val', rankValue(row, by)));
    return line;
  }) : [fineText(by === 'wins' ? '아직 온라인 대전을 이긴 사람이 없어. 첫 번째가 되어 봐!' : '아직 랭킹에 아무도 없어. 첫 번째가 되어 봐!')]));
  $('rank-me').textContent = r.me.rank
    ? `내 순위: ${r.me.rank}등 · ${rankValue({ trophies: r.me.trophies, wins: r.me.wins, xp: P().xp }, by)}`
    : by === 'trophies' ? '아직 트로피가 없어. AI 대전이나 온라인 대전을 이겨 봐!' : by === 'wins' ? '아직 온라인 승리가 없어. 게임 찾기로 한 판 해 봐!' : '레벨 2가 되면 랭킹에 나와. 한 판 해 봐!';
  rewardTop5(r.me);
}
$('rank-tabs').querySelectorAll('button').forEach(b => { b.onclick = () => { sound.sfx('click'); rankBy = b.dataset.by; renderRanking(); }; });

// ---------- 관전 (인혁이 기획서 4번 그림) ----------
const watcher = createWatch({
  social: () => hub,
  begin: ({ match: m, names, levels }) => startWatchGame(m, names, levels),
  restart: m => { if (game?.mode === 'watch') { match = m; renderer.resetRound(); } },
  peer: (side, peer) => {
    const v = game?.mode === 'watch' ? renderer.views[side] : null;
    if (!v) return;
    v.skin = peer.skin || 'classic'; v.effect = peer.effect || 'sparkle';
    if (peer.level) v.level = peer.level;
  },
  ended: text => { toast(`👀 ${text}`); if (game?.mode === 'watch') quitGame(); },
  // 같이 보는 다른 사람의 관전 채팅과 응원
  line: l => { if (game?.mode === 'watch') watcherSaid(l, l.cheer === undefined ? null : { side: l.side, name: renderer.views[l.side]?.name ?? '' }); },
  talkOff: () => watchTalkOff(),
  slow: () => { if (chatWith?.kind === 'watch') chatNote('조금만 천천히 보내 줘!'); else toast('조금만 천천히 보내 줘!'); },
});
function startWatchGame(m, names, levels) {
  closePromo(true);
  demo = null;
  endPractice();
  game = { mode: 'watch', tracked: -1, started: performance.now(), warned: false };
  match = m;
  roomJoined(); chatPick = null;
  renderer.setTheme('starry');
  const views = names.map((name, i) => ({ name, level: levels[i], skin: 'classic', effect: 'sparkle', char: null, color: i ? '#9fe3ff' : '#ffe45c' }));
  renderer.setup(views, { watch: true, ghost: false, insets: computeInsets() });
  hideScreens();
  // 응원 줄을 먼저 보여 주고, 그 높이만큼 필드 자리를 다시 잡는다
  $('watch-bar').hidden = false;
  paintWatchBar();
  renderer.setInsets(computeInsets());
  $('hud').hidden = false;
  $('hud-chat').hidden = true;
  paintWatchers(0);
  $('hud-title').textContent = `👀 관전 · ${names[0]} VS ${names[1]}`;
  $('touch').hidden = true;
  document.body.classList.remove('duo');
  controls.enabled = false;
  paused = false;
  sound.play('battle');
  trackEvent({ type: 'watch' }); // 관전 챌린지
}
async function watchMatch(entry) {
  if (!hub) { toast('관전은 온라인 계정으로 로그인해야 할 수 있어.'); return; }
  if (match || watcher.active) return;
  if (online.active || online.searching) { toast('대전 방에서 나와야 관전할 수 있어.'); return; }
  sound.sfx('click');
  try { await watcher.start(entry); } catch (error) { toast(error.message || '이 대전은 볼 수 없어.'); if (screen === 'watch') renderWatchList(); }
}
// 관전: 소리와 판 결과 표시만 (챌린지, 기록, 보상은 없다)
function watchSound(e, m) {
  switch (e.type) {
    case 'pop': sound.sfx('pop', e.chain); setTimeout(() => sound.sfx('burst'), 560); break;
    case 'allClear': sound.sfx('allclear'); break;
    case 'offset': sound.sfx('offset'); break;
    case 'garbage': sound.sfx('garbage', e.count); break;
    case 'count': sound.sfx('count', 0); break;
    case 'go': sound.sfx('count', 1); break;
    case 'round': renderer.resetRound(); break;
    case 'roundEnd': m.players.forEach((_, i) => renderer.setResult(i, e.winner < 0 ? 'draw' : i === e.winner ? 'win' : 'lose')); sound.sfx('win'); break;
    case 'matchEnd': { const w = m.winner(); toast(w < 0 ? '👀 비겼어!' : `👀 ${renderer.views[w]?.name ?? ''} 승리!`); break; }
    default: break;
  }
}
// 지금 하는 대전 목록
let watchLoading = 0;
async function renderWatchList() {
  const on = !!(account?.cloud && hub);
  $('watch-need-login').hidden = on;
  $('watch-refresh').hidden = !on;
  const list = $('watch-list');
  list.replaceChildren();
  if (!on) return;
  const ticket = ++watchLoading;
  list.append(fineText('대전 목록을 불러오는 중…'));
  let matches;
  try { matches = await hub.matches(NET_GAME); } catch (error) { if (ticket === watchLoading) list.replaceChildren(fineText(error.message)); return; }
  if (ticket !== watchLoading || screen !== 'watch') return;
  list.replaceChildren(...(matches.length ? matches.map(entry => {
    const row = document.createElement('div');
    row.className = 'watch-row';
    const vs = document.createElement('div');
    vs.className = 'vsline';
    const [a, b] = entry.players;
    vs.append(cell('', `${a.nickname} Lv.${a.level}`), Object.assign(document.createElement('b'), { textContent: 'VS' }), cell('', `${b.nickname} Lv.${b.level}`));
    row.append(vs);
    if (entry.friend) row.append(cell('friend-tag', '👫 친구'));
    const go = document.createElement('button');
    go.className = 'primary';
    go.textContent = '👀 보기';
    go.onclick = () => watchMatch(entry);
    row.append(go);
    return row;
  }) : [fineText('지금 하고 있는 온라인 대전이 없어. 조금 뒤에 🔄 새로 보기를 눌러 봐!')]));
}
// ---------- 관전 채팅과 응원 (인혁이 기획서 「뿌요뿌요 (업그레이드)」 3번) ----------
// "관전에서 채팅 할 수 있게 만들어주고 관전에서 하고 있는 사람한테 친구요청, 화이팅, 좋아요 등을 보낼 수 있게 해줘."
// - 관전하는 사람: 아래 줄(#watch-bar)에서 두 사람에게 응원(화이팅, 좋아요 …)과 친구 요청을 보내고, 💬 관전 채팅을 한다.
// - 대전하는 사람: 관전자의 응원과 관전 채팅이 말풍선과 대전 채팅 창에 "👀 닉네임"으로 나온다.
// 관전 채팅 줄은 roomLog 를 같이 쓴다 (관전하는 동안에는 대전 방에 있을 수 없다).
// 응원과 관전 채팅은 net 서버가 새 버전이어야 된다. 예전 서버는 'watch-only' 로 돌려보내고, 그때는 안내만 한다 (친구 요청은 예전 서버에서도 된다).
let watchTalk = 'on';            // 'old': 서버가 아직 관전 채팅을 모른다 (다시 배포하기 전)
let chatPick = null;             // 채팅 창에서 고른 관전자 { id, nickname } (차단, 신고)
const mutedWatchers = new Set(); // 이번에 켠 동안 차단한 관전자
const friendAsked = new Set();   // 이번에 켠 동안 관전하면서 친구 요청을 보낸 사람
const cheerLimit = rateLimiter(4, 5000);
const TALK_OFF = '응원과 관전 채팅은 게임 서버가 새 버전으로 바뀌면 쓸 수 있어 (만든 사람이 준비하고 있어). 친구 요청은 지금도 돼!';
function pushRoomLine(entry) {
  roomLog.push(entry);
  if (roomLog.length > 50) roomLog.shift();
}
const roomChatOpen = () => (chatWith?.kind === 'room' || chatWith?.kind === 'watch') && !$('chat').hidden;
// 응원을 받은 사람의 필드 위로 그림이 떠오른다
function cheerFloat(side, emoji) {
  const f = renderer.layout?.fields?.[side];
  if (!f || calm()) return;
  const el = document.createElement('div');
  el.className = 'cheer-float';
  el.textContent = emoji;
  el.style.left = `${f.x + f.cell * (1.2 + Math.random() * 3.6)}px`;
  el.style.top = `${f.y + f.cell * 8}px`;
  el.style.fontSize = `${Math.max(26, f.cell * 1.7)}px`;
  document.body.append(el);
  setTimeout(() => el.remove(), 1700);
}
// 관전자가 한 말(line.text)이나 응원(line.cheer, target: 누구에게 { side, name })을 화면에. 대전하는 사람과 다른 관전자 모두 이 함수로 받는다.
function watcherSaid(line, target) {
  if (mutedWatchers.has(line.id) || roomMuted) return;
  const cheer = !!target;
  if (!cheer && !chatOn()) return; // 채팅을 꺼 두었으면 글은 받지 않는다 (응원은 정해진 말이라 보여 준다)
  const text = cheer ? `${target.name}에게 ${cheerText(line.cheer)}` : line.text;
  pushRoomLine({ me: false, who: line.id, name: line.name, text, cheer });
  if (cheer) cheerFloat(target.side, CHEERS[line.cheer].emoji);
  if (roomChatOpen()) renderChat();
  else { if (chatOn()) { roomUnread++; updateRoomDots(); } bubble(`👀 ${line.name}`, { text }); }
  sound.sfx(cheer ? 'coin' : 'talk');
}
// 관전 화면 아래 줄: 두 사람마다 응원 단추와 친구 요청
function paintWatchBar() {
  const people = watcher.players();
  document.querySelectorAll('#watch-bar .cheer-side').forEach(box => {
    const side = Number(box.dataset.side), who = people[side];
    const name = renderer.views[side]?.name ?? who?.nickname ?? '?';
    const friend = !!who && ui.friends.some(f => f.id === who.id), asked = !!who && friendAsked.has(who.id);
    box.innerHTML = `<b>${esc(name)}에게</b><div class="cheer-buttons">${CHEERS.map((c, k) => `<button type="button" data-cheer="${k}">${c.emoji} ${esc(c.text.replace('!', ''))}</button>`).join('')}`
      + `<button type="button" class="cheer-friend" data-friend="1"${friend || asked || !who ? ' disabled' : ''}>${friend ? '✔ 이미 친구' : asked ? '✔ 친구 요청 보냄' : '🤝 친구 요청'}</button></div>`;
  });
  $('watch-bar').classList.toggle('off', watchTalk === 'old');
}
function sendCheer(side, k) {
  if (watchTalk === 'old') { toast(TALK_OFF); sound.sfx('bump'); return; }
  if (!cheerLimit()) { toast('조금만 천천히 보내 줘!'); return; }
  if (!watcher.cheer(side, k)) { toast('지금은 보낼 수 없어.'); return; }
  const text = `${renderer.views[side]?.name ?? ''}에게 ${cheerText(k)}`;
  pushRoomLine({ me: true, text, cheer: true });
  cheerFloat(side, CHEERS[k].emoji);
  if (roomChatOpen()) renderChat(); else bubble('나', { text });
  sound.sfx('coin'); haptic('light');
  // 응원 챌린지: 서버가 받았을 때만 센다 (예전 서버면 곧 'watch-only' 가 돌아와서 watchTalk 가 'old' 가 된다)
  setTimeout(() => { if (watchTalk === 'on') trackEvent({ type: 'cheer' }); }, 1500);
}
async function askWatchFriend(side) {
  const who = watcher.players()[side];
  if (!who?.id || !hub) return;
  sound.sfx('click');
  try {
    const r = await hub.requestFriend(who.id);
    friendAsked.add(who.id);
    toast(r.status === 'friends' ? `🤝 ${who.nickname}와 친구가 됐어!` : `🤝 ${who.nickname}에게 친구 요청을 보냈어. 수락하면 친구가 돼!`, true);
    if (r.status === 'friends') ui.refreshCounts();
  } catch (error) { toast(error.message); }
  if (game?.mode === 'watch') paintWatchBar();
}
// 서버가 아직 관전 채팅을 모른다: 보낸 줄 알았던 내 말과 응원은 가지 않았으니 지우고 알려 준다
function watchTalkOff() {
  if (watchTalk === 'old') return;
  watchTalk = 'old';
  for (let i = roomLog.length - 1; i >= 0; i--) if (roomLog[i].me) roomLog.splice(i, 1);
  toast(TALK_OFF); sound.sfx('bump');
  paintWatchBar();
  if (chatWith?.kind === 'watch') renderChat();
}
$('watch-bar').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || game?.mode !== 'watch') return;
  if (b.id === 'watch-chat') { if ($('chat').hidden) openChat({ kind: 'watch' }); else closeChat(); return; }
  const side = Number(b.closest('.cheer-side')?.dataset.side);
  if (b.dataset.cheer !== undefined) sendCheer(side, Number(b.dataset.cheer));
  else if (b.dataset.friend) askWatchFriend(side);
});
// 관전 채팅을 한 사람을 차단, 신고
async function blockWatcher() {
  const who = chatPick;
  if (!who || !account?.cloud) return;
  if (!(await ui.blockUser(who))) return;
  mutedWatchers.add(who.id);
  for (let i = roomLog.length - 1; i >= 0; i--) if (roomLog[i].who === who.id) roomLog.splice(i, 1);
  chatPick = null;
  if (chatWith) renderChat();
}
function reportWatcher() {
  const who = chatPick, code = game?.mode === 'watch' ? watcher.code : online.recent?.room;
  if (!who || !code) return;
  const line = l => `${l.me ? '나' : l.who ? `(관전) ${l.name}` : '상대'}: ${validSticker(l.sticker) ? `[뿌요 이모티콘: ${STICKERS[l.sticker].text}]` : l.text}`;
  ui.reportUser({ target: who.id, context: { kind: 'room', game: NET_GAME, room: code }, messages: roomLog.slice(-50).map(l => ({ text: line(l) })) }, who);
}

// 온라인 대전 중: 지금 몇 명이 보고 있는지
function paintWatchers(n) {
  $('hud-watchers').hidden = !n;
  $('hud-watchers').textContent = `👀 ${n}명이 보는 중`;
}
$('go-watch').onclick = () => { sound.sfx('click'); show('watch'); };
$('go-ranking').onclick = () => { sound.sfx('click'); show('ranking'); };
$('watch-refresh').onclick = () => { sound.sfx('click'); renderWatchList(); };
$('watch-login').onclick = $('rank-login').onclick = () => { sound.sfx('click'); show('login'); };

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
      // 지난번에 받은 편지까지 지우라고 알리면서 새 편지를 받는다 (기기에 저장이 안 됐으면 지우지 않는다)
      const ack = !storeFailed && s.lastMail > ackedTo ? s.lastMail : 0;
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
      if (storeFailed) break;
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
      if (!quiet) toast(`💬 ${friend.name}: ${entry.text ?? `뿌요 이모티콘 「${STICKERS[entry.sticker].text}」`}`);
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
  $('watch-chat-dot').hidden = !roomUnread;
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
      : '친구 신청을 보냈어! 그런데 아직 그 코드로 뿌요뿌요 타워 친구 화면을 연 사람이 없어. 코드가 맞는지 확인해 줘. 맞으면 친구가 열 때 받아.');
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

// ---------- 뿌요 이모티콘 ----------
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
const stickerImg = (i, cls = '') => `<img class="${cls}" src="${stickerURL(i)}" alt="뿌요 이모티콘 ${esc(STICKERS[i].text)}" draggable="false">`;
function renderEmojiPanel() {
  $('chat-stickers').innerHTML = STICKERS.map((s, i) => `<button type="button" data-sticker="${i}" aria-label="뿌요 이모티콘 ${esc(s.text)}">${stickerImg(i)}</button>`).join('');
  $('chat-emojis').innerHTML = EMOJIS.map(e => `<button type="button" data-emoji="${e}" aria-label="${e}">${e}</button>`).join('');
}
function toggleEmojiPanel(open = $('chat-emoji').hidden) {
  if (open && !$('chat-stickers').childElementCount) renderEmojiPanel();
  // 관전 채팅은 글만 보낸다 (뿌요 이모티콘은 대전하는 두 사람의 채팅에만)
  $('chat-stickers').hidden = $('chat-stickers').previousElementSibling.hidden = chatWith?.kind === 'watch';
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
  if (target.kind === 'friend') { unread.delete(target.code); pollMail(); } else if (target.kind === 'room' || target.kind === 'watch') { roomUnread = 0; updateRoomDots(); }
  $('chat').hidden = false;
  $('chat').classList.toggle('compact', (target.kind === 'room' || target.kind === 'watch') && !!match);
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
  // 관전자가 한 말: 이름표를 누르면 그 사람을 차단하거나 신고할 수 있다
  const label = m.who ? `<button type="button" class="who" data-who="${Number(m.who)}" data-name="${esc(m.name)}" aria-label="${esc(m.name)} 차단하거나 신고하기">👀 ${esc(m.name)} ⋯</button>` : '';
  return `<div class="msg ${who}${m.who ? ' watcher' : ''}${m.cheer ? ' cheer' : ''}${bigEmoji(m.text) ? ' big' : ''}">${label}<span>${esc(m.text)}</span>${m.invite && !m.me ? `<button class="primary tiny" data-join="${m.invite}">들어가기 ▶</button>` : ''}</div>`;
}
function renderChat() {
  if (!chatWith) return;
  if (chatWith.kind === 'legacy') { renderLegacyChat(); return; }
  const watching = chatWith.kind === 'watch'; // 관전 채팅 (기획서 「뿌요뿌요 (업그레이드)」 3번)
  const room = chatWith.kind === 'room' || watching;
  const friend = room ? null : legacyOn() && social().friends.find(f => f.code === chatWith.code);
  if (!room && !friend) { closeChat(); return; }
  const live = watching ? watcher.active : room ? roomNet().connected : friendNet.isOnline(friend.code);
  const canSend = watching ? live && watchTalk !== 'old' : room ? live : live || mailState === 'on';
  $('chat-name').textContent = watching ? '👀 관전 채팅' : room ? roomNet().peerName() : friend.name;
  $('chat-sub').textContent = watching ? `${renderer.views[0]?.name ?? ''} VS ${renderer.views[1]?.name ?? ''}` : room ? '온라인 대전' : `Lv.${friend.level} · ${live ? '게임 중' : '없음'}`;
  $('chat-dot').className = `dot${live ? ' on' : ''}`;
  const log = room ? roomLog : social().chats[friend.code] || [];
  $('chat-log').innerHTML = log.length ? log.map(chatLine).join('') : `<p class="fine empty">${watching ? '두 사람을 응원해 봐! 📣' : '첫 인사를 해 봐! 👋'}</p>`;
  $('chat-quick').innerHTML = QUICK.map((q, i) => `<button type="button" data-q="${i}"${canSend ? '' : ' disabled'}>${q}</button>`).join('');
  $('chat-input').disabled = !canSend;
  $('chat-emoji-toggle').disabled = !canSend;
  $('chat-form').querySelector('button[type=submit]').disabled = !canSend;
  if (!canSend) toggleEmojiPanel(false);
  if (Date.now() > noteUntil || !canSend) {
    $('chat-note').textContent = !canSend ? (watching ? (watchTalk === 'old' ? TALK_OFF : '대전이 끝났어.') : room ? '방에 친구가 없어.' : '친구가 지금 게임을 안 하고 있어. 둘 다 켜 두었을 때 보낼 수 있어.')
      : watching ? '👀 대전하는 두 사람과 같이 보는 사람들이 이 채팅을 봐. 🔒 전화번호·주소·학교 이름은 보내지 마!'
        : !room && !live ? '📮 친구가 지금 없어도 보내 두면, 친구가 게임을 켤 때 받아!' : '🔒 전화번호·주소·학교 이름은 보내지 마!';
  }
  if (chatPick && !(room && log.some(l => l.who === chatPick.id))) chatPick = null;
  const mute = `<button type="button" class="ghost" data-tool="mute">${roomMuted ? '🔔 채팅 다시 받기' : watching ? '🔇 관전 채팅 끄기' : '🔇 이번 판 채팅 끄기'}</button>`;
  $('chat-tools').innerHTML = chatPick
    ? `<span class="pick-name">👀 ${esc(chatPick.nickname)}</span><button type="button" class="ghost danger" data-tool="block-who">🚫 차단</button><button type="button" class="ghost" data-tool="report-who">🚩 신고</button><button type="button" class="ghost" data-tool="unpick" aria-label="고르기 취소">✕</button>`
    : watching ? `${mute}<small class="fine">이름표(👀 닉네임 ⋯)를 누르면 차단하거나 신고할 수 있어.</small>`
      : room
        ? `${mute}${account?.cloud ? '<button type="button" class="ghost danger" data-tool="block">🚫 차단</button>' : ''}<button type="button" class="ghost" data-tool="report">🚩 신고</button>`
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
  if (chatWith.kind === 'watch') {
    // 관전 채팅: 글만 (빠른 말도 글로 보낸다). 서버가 걸러서 두 사람과 다른 관전자에게 전한다.
    if (isSticker) return;
    if (watchTalk === 'old') { chatNote(TALK_OFF); sound.sfx('bump'); return; }
    if (!watcher.chat(out)) { chatNote('지금은 보낼 수 없어.'); return; }
    pushRoomLine(entry);
  } else if (chatWith.kind === 'room') {
    // 온라인 계정 방: 직접 쓴 말은 서버가 거르는 room.chat, 빠른 말과 뿌요 이모티콘은 번호만
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
  else if (b.dataset.who) { sound.sfx('click'); chatPick = { id: Number(b.dataset.who), nickname: b.dataset.name }; renderChat(); }
  else if (b.dataset.tool === 'unpick') { sound.sfx('click'); chatPick = null; renderChat(); }
  else if (b.dataset.tool === 'block-who') blockWatcher();
  else if (b.dataset.tool === 'report-who') reportWatcher();
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
  const line = m => (validSticker(m.sticker) ? `[뿌요 이모티콘: ${STICKERS[m.sticker].text}]` : m.text);
  const text = `[뿌요뿌요 타워 신고] ${name}${room ? ' (온라인 대전)' : ` (친구 코드 ${chatWith.code})`}\n${log.map(m => `${m.me ? '나' : name}: ${line(m)}`).join('\n')}`;
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
  mode: game?.mode || null, map: game?.map || null,
  pets: P().pets, tickets: P().tickets, boostLeft: Math.ceil(boostLeft(P()) / 1000), friends: friendTotal(), bonus: { xp: currentBonus().xp, coins: currentBonus().coins },
  school: P().school, tutorial: P().tutorial, lesson: practice ? { grade: practice.grade, index: practice.index, freeze: practice.freeze } : null,
  net: account?.cloud ? { nickname: net.user?.nickname, cloud: cloud?.state ?? null, live: hub?.status ?? null } : null,
  online: online.state(),
  match: match ? {
    phase: match.phase, round: match.round, wins: match.wins, frame: match.frame,
    players: match.players.map(p => ({ state: p.state, score: p.score, incoming: p.incoming, pieces: p.stats?.pieces, maxChain: p.stats?.maxChain, piece: p.piece ? { x: p.piece.x, y: Math.round(p.piece.y * 10) / 10, rot: p.piece.rot } : null })),
  } : null,
});
if (TEST) {
  window.__puyo = { get match() { return match; }, get game() { return game; }, get practice() { return practice; }, get mailState() { return mailState; }, pollMail, friendNet, P, handleBack, store, startTower, startVs, startSolo, startLocal, startPractice, show, finishMatch, renderer, online, peerOnline, runEnding, recordPlayTime, pause, save,
    get cloud() { return cloud; }, get social() { return hub; }, net, get watcher() { return watcher; }, sendStats,
    watchTalkOff, greetHi, get device() { return device; }, get roomLog() { return roomLog; },
    // 예전 방식의 이 기기 계정 만들기 (화면에서는 더 이상 만들지 않는다. 브라우저 확인용)
    async localSignup(name, password) { const r = await createAccount(store, name, password); if (r.ok) { account = r.account; guest = null; save(); afterLogin(); } return r.ok; } };
}

// ---------- 시작 ----------
if (net.loggedIn && net.user) {
  const pending = marker.get(), local = pending && store.accounts.find(a => a.id === pending.localId);
  if (local) { show('login'); resumeMigration(local); } // 옮기던 중이었으면 마저 올린다
  else { enterCloud(net.user, { wait: false }); show('menu'); }
} else { show(account ? 'menu' : 'login'); greetHi(); }
requestAnimationFrame(loop);
// 앱: 첫 화면이 그려진 다음에 시작 그림을 걷는다
requestAnimationFrame(() => requestAnimationFrame(hideSplash));
