// SANS · 심판의 회랑 — 전투 로직 (DOM 없음)
// 상태 g 는 함수가 하나도 없는 순수 데이터다. structuredClone 으로 복제해 몇 수 앞을 미리 돌려 볼 수 있다.
// 바깥(브라우저)은 press(g, 키) 와 tick(g, dt, 누르고 있는 키) 만 부르고, g.events 를 꺼내 소리와 저장에 쓴다.
import { PATTERNS, ORDER } from './patterns.mjs';
import * as L from './lines.mjs';

export { PATTERNS, ORDER };
export const W = 640, H = 480, BOX_BOTTOM = 390;
export const MENU_BOX = { w: 576, h: 140 };
export const BUTTON = { y: 432, w: 110, h: 42 };
export const BUTTONS = [
  { id: 'fight', x: 32, label: '공격', en: 'FIGHT' }, { id: 'act', x: 185, label: '행동', en: 'ACT' },
  { id: 'item', x: 345, label: '아이템', en: 'ITEM' }, { id: 'mercy', x: 500, label: '자비', en: 'MERCY' },
];
export const SOUL_HALF = 8, HIT_HALF = 4;
export const BAR_TIME = 1.15, STRIKE_TIME = 1.25;
export const PUSH_MIN = BUTTONS[0].x + BUTTON.w / 2, PUSH_MAX = BUTTONS[3].x + BUTTON.w / 2;
export const CINE_TIME = { enter: 1.5, blackout: .9, final: 3.9, leave: 4.6, lower: 2.2 };
// 난이도: 탄막이 흐르는 빠르기(tempo), 한 번 스칠 때의 무적 시간(grace), 업보가 쌓이는 양, 샌즈가 잠들기까지의 시간, 이어하기 지점
export const DIFFICULTIES = [
  { id: 'easy', name: '연습', note: '탄막이 느리다 · 쓰러져도 가까운 곳에서 다시 · 아이템이 돌아온다', tempo: .8, grace: .075, krGain: 1, sleep: 12, checkpoints: ['p2', 'special'], refill: true, menuBones: false },
  { id: 'normal', name: '보통', note: '빠르고 빈틈없는 심판 · 쓰러지면 2막부터', tempo: 1.18, grace: .05, krGain: 1, sleep: 17, checkpoints: ['p2'], refill: false, menuBones: true },
  { id: 'hard', name: '최악의 시간', note: '더 빠르고 더 아프다 · 쓰러지면 처음부터', tempo: 1.36, grace: .04, krGain: 2, sleep: 22, checkpoints: [], refill: false, menuBones: true },
  // HP 1, 아이템 없음. 이어하기 때도 가방을 채우지 않는다.
  { id: 'hp1', name: '하드모드', note: 'HP 1 · 아이템 없음 · 한 번만 스쳐도 끝 · 쓰러지면 2막부터', tempo: 1.18, grace: .05, krGain: 1, sleep: 17, checkpoints: ['p2'], refill: false, menuBones: true, startHp: 1, noItems: true },
  { id: 'veryhard', name: '배리하드', note: '최악의 시간 탄막 · HP 1 (히든 3) · 아이템 없음 · 처음부터 재도전', tempo: 1.36, grace: .04, krGain: 2, sleep: 22, checkpoints: [], refill: false, menuBones: true, startHp: 1, noItems: true },
];
const SPEED = 150, SLOW = 75, JUMP_SPEED = 390, JUMP_CUT = 80, GRAVITY = 1000, FALL_MAX = 1000;
const STAB_OUT = .06, STAB_IN = .1, GB_ENTER = .3;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const emit = (g, type, name, extra) => g.events.push({ type, name, ...extra });
export const diff = g => DIFFICULTIES[g.level];
export const attackTempo = g => diff(g).tempo * (g.attack?.name === 'special' ? (diff(g).id === 'easy' ? 1.08 : 1.18) : 1);
export function rand(g) {
  g.seed = (g.seed + 0x6D2B79F5) >>> 0; let t = g.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---------- 상태 ----------
export function createMeta() { return { deaths: 0, dunked: false, level: 1, best: {}, endings: {}, sound: true, hiddenHeart: false }; }
export const hardUnlocked = g => ['normal', 'hard'].some(id => ['kill', 'mercy'].includes(g.meta.best[id]?.ending));
export const veryHardUnlocked = g => ['kill', 'mercy'].includes(g.meta.best.hp1?.ending);
export const difficultyUnlocked = (g, id = diff(g).id) => id === 'veryhard' ? veryHardUnlocked(g) : id === 'hp1' ? hardUnlocked(g) : true;
export const unlockHint = g => diff(g).id === 'veryhard' ? '하드모드(하드코어) 클리어로 해금' : '보통 또는 최악의 시간 클리어로 해금';
export const hiddenHp = g => diff(g).startHp ? 3 : 180;
function applyHiddenHeart(g) {
  if (g.meta.hiddenHeart === true) g.hp = g.maxHp = hiddenHp(g);
}
export function createGame(meta = createMeta(), seed = 20261012) {
  const g = { meta, seed: seed >>> 0, events: [], session: { deaths: 0, hits: 0, time: 0 } };
  reset(g);
  return g;
}
function reset(g) {
  Object.assign(g, {
    mode: 'title', modeT: 0, time: 0, paused: false, level: clamp(g.meta.level ?? 1, 0, DIFFICULTIES.length - 1),
    name: '인간', lv: 19, hp: 92, maxHp: 92, kr: 0, krClock: 0, lastHit: -9, hurtT: 0,
    items: [...L.BAG],
    soul: { x: 320, y: 320, mode: 'red', gravity: 'down', va: 0, grounded: false, slam: false, inv: 0, plat: 0, moving: false, velX: 0, velY: 0 },
    box: { x: 320, y: BOX_BOTTOM - MENU_BOX.h / 2, w: MENU_BOX.w, h: MENU_BOX.h, tx: 320, ty: BOX_BOTTOM - MENU_BOX.h / 2, tw: MENU_BOX.w, th: MENU_BOX.h },
    bullets: [], nextId: 1, attack: null,
    phase: 'intro', story: 0, fillers: 0, jokes: 0, dodges: 0, turns: 0, pending: null, reply: null,
    menu: 0, submenu: null, text: null, talk: null, bubble: null, bar: null, strike: null, cine: null, flavor: '', flavorShown: 0,
    sans: { face: 'idle', dx: 0, dodgeT: -1, arm: null, armT: 0, eye: 0, sweat: 0, asleep: false, gash: false, walk: 0, hidden: false, hpShown: 0 },
    menuBones: [], menuBoneClock: 0, menuBoneNext: 1.3, sleepT: 0, asleepT: 0, bubbleIndex: 0, push: null, pushed: false,
    checkpoint: null, ended: null, over: null, result: null, blackout: 0, shake: 0, flash: 0, secretTaps: 0, lockedNotice: false,
    stats: { hits: 0, ticks: 0, heals: 0, turns: 0, time: 0 },
  });
  applyHiddenHeart(g);
}
export function targetBounds(g) {
  const b = g.box;
  return { l: b.tx - b.tw / 2, r: b.tx + b.tw / 2, t: b.ty - b.th / 2, b: b.ty + b.th / 2, cx: b.tx, cy: b.ty, w: b.tw, h: b.th };
}
function setBox(g, w, h, snap = false) {
  const b = g.box; b.tw = w; b.th = h; b.tx = 320; b.ty = BOX_BOTTOM - h / 2;
  if (snap) { b.w = w; b.h = h; b.x = b.tx; b.y = b.ty; }
}
export const cursorX = g => BUTTONS[g.menu].x + 17;
// 샌즈가 서 있는 바닥 높이. 상자가 커지면 위로 물러선다.
export const sansFloor = g => Math.min(238, g.box.y - g.box.h / 2 - 8);

// ---------- 시작과 끝 ----------
// from: 'title'(새 도전) | 'start'(쓰러진 뒤 처음부터) | 'checkpoint'(이어서)
export function begin(g, from = 'title') {
  if (!difficultyUnlocked(g)) { g.lockedNotice = true; g.mode = 'title'; return false; }
  const checkpoint = from === 'checkpoint' ? g.checkpoint : null, level = g.level;
  if (from === 'title') g.session = { deaths: 0, hits: 0, time: 0 };
  reset(g); g.level = level; g.meta.level = level; g.seed = (g.seed + 977) >>> 0;
  if (diff(g).id === 'veryhard') g.maxHp = 1;
  g.hp = diff(g).startHp ?? g.maxHp;
  applyHiddenHeart(g);
  if (diff(g).noItems) g.items = [];
  emit(g, 'music', 'hall');
  if (checkpoint) {
    g.checkpoint = checkpoint; g.items = diff(g).noItems ? [] : diff(g).refill ? [...L.BAG] : [...checkpoint.items];
    const special = checkpoint.at === 'special';
    g.phase = 'p2'; g.story = special ? ORDER.p2.length : 0; g.sans.sweat = special ? 3 : 1;
    startCine(g, 'enter', special ? 'resumeSpecial' : 'resumeP2');
  } else startCine(g, 'enter', 'intro');
}
export function toTitle(g) { reset(g); emit(g, 'music', 'title'); }
function saveCheckpoint(g, at) { if (diff(g).checkpoints.includes(at)) g.checkpoint = { at, items: [...g.items] }; }
function die(g) {
  const dunk = g.attack?.name === 'dunk', options = [];
  g.meta.deaths++; g.meta.dunked = dunk;
  g.session.deaths++; g.session.hits += g.stats.hits; g.session.time += g.stats.time;
  if (g.checkpoint && !dunk) options.push({ id: 'checkpoint', label: g.checkpoint.at === 'special' ? '특별 공격부터' : '2막부터' });
  options.push({ id: 'start', label: '처음부터' }, { id: 'title', label: '그만하기' });
  const inMenu = g.mode === 'menu';
  g.over = { x: inMenu ? cursorX(g) : g.soul.x, y: inMenu ? BUTTON.y + BUTTON.h / 2 : g.soul.y, dunk, lines: dunk ? L.GAMEOVER_DUNK : L.GAMEOVER[(g.meta.deaths - 1) % L.GAMEOVER.length], options, index: 0 };
  Object.assign(g, { mode: 'gameover', modeT: 0, ended: 'dead', hp: 0, kr: 0, bullets: [], menuBones: [], attack: null, cine: null, talk: null, text: null, bubble: null, submenu: null, strike: null });
  emit(g, 'music', null); emit(g, 'sfx', 'break'); emit(g, 'save');
}
function finish(g, ending) {
  const wasUnlocked = hardUnlocked(g), wasVeryHardUnlocked = veryHardUnlocked(g);
  const run = { ending, deaths: g.session.deaths, hits: g.session.hits + g.stats.hits, time: Math.round(g.session.time + g.stats.time), record: false };
  const id = diff(g).id, best = g.meta.best[id];
  if (!best || run.deaths < best.deaths || (run.deaths === best.deaths && run.hits < best.hits)) { g.meta.best[id] = { ending, deaths: run.deaths, hits: run.hits, time: run.time }; run.record = true; }
  run.unlockedHard = !wasUnlocked && hardUnlocked(g);
  run.unlockedVeryHard = !wasVeryHardUnlocked && veryHardUnlocked(g);
  g.meta.endings[ending] = true; g.meta.deaths = 0; g.meta.dunked = false;
  Object.assign(g, { mode: 'won', modeT: 0, ended: ending, result: run, text: null, talk: null });
  emit(g, 'music', ending === 'kill' ? 'dust' : 'warm'); emit(g, 'save');
}

// ---------- 흐름: 대사·내레이션·연출이 끝나면 이어질 일 ----------
function run(g, op) {
  switch (op) {
    case 'intro': {
      let lines = L.retryIntro(g.meta.deaths, g.meta.dunked); g.meta.dunked = false;
      // 하드모드로 처음 만나면 샌즈가 HP 1 을 알아본다
      if (lines === L.INTRO && g.meta.hiddenHeart === true) lines = [...L.INTRO.slice(0, -1), [`…그 하트, 찾았구나. HP가 ${g.maxHp}이라니.`, 'wink'], ['우리끼리 비밀로 하자.', 'closed'], L.INTRO[L.INTRO.length - 1]];
      else if (diff(g).startHp && lines === L.INTRO) lines = [...L.INTRO.slice(0, -1), ...L.ONE_HP, L.INTRO[L.INTRO.length - 1]];
      return startTalk(g, lines, 'blackout');
    }
    case 'resumeP2': return startTalk(g, L.RESUME.p2, 'p2start');
    case 'resumeSpecial': return startTalk(g, L.RESUME.special, 'special');
    case 'blackout': return startCine(g, 'blackout', 'opening');
    case 'opening': g.phase = 'opening'; return startAttack(g, 'opening');
    case 'afterOpening': emit(g, 'music', 'p1'); return toMenu(g);
    case 'menu': return toMenu(g);
    case 'story': return startAttack(g, g.pending, true);
    case 'filler': return startAttack(g, ORDER[g.phase === 'p2' ? 'fill2' : 'fill1'][g.fillers++ % 3]);
    case 'fillerTalk': return startTalk(g, [g.reply], 'filler');
    case 'offerReply': return startTalk(g, [g.reply], 'menu');
    case 'offer': g.phase = 'offer'; return say(g, L.OFFER_NOTE, 'menu');
    case 'p2start': g.phase = 'p2'; g.story = 0; g.sans.sweat = 1; saveCheckpoint(g, 'p2'); emit(g, 'music', 'p2'); return startAttack(g, ORDER.p2[0], true);
    case 'special': g.phase = 'special'; saveCheckpoint(g, 'special'); emit(g, 'music', 'p2'); return startAttack(g, 'special');
    case 'nothing': g.phase = 'nothing'; emit(g, 'music', 'lull'); return startAttack(g, 'nothing');
    case 'dunk': return startAttack(g, 'dunk');
    case 'deathTalk': return startTalk(g, L.DEATH, 'leave');
    case 'leave': return startCine(g, 'leave', 'killNotes');
    case 'killNotes': return say(g, L.KILL_NOTES, 'killEnd');
    case 'killEnd': return finish(g, 'kill');
    case 'mercyNotes': return say(g, L.MERCY_NOTES, 'mercyTalk');
    case 'mercyTalk': return startTalk(g, L.MERCY_TALK, 'mercyEnd');
    case 'mercyEnd': return finish(g, 'mercy');
  }
}
const restFace = g => g.sans.asleep ? 'sleep' : g.sans.gash ? 'hurt' : g.phase === 'p2' || g.phase === 'special' || g.phase === 'nothing' ? 'tired' : 'idle';
function setFace(g, face) { g.sans.face = face; g.sans.asleep = face === 'sleep'; }
function startTalk(g, lines, next) {
  Object.assign(g, { mode: 'talk', talk: { lines, index: 0, shown: 0, next }, text: null, submenu: null, bubble: null, attack: null, bullets: [] });
  setBox(g, MENU_BOX.w, MENU_BOX.h); setFace(g, lines[0][1]);
}
function say(g, lines, next) {
  Object.assign(g, { mode: 'text', text: { lines, index: 0, shown: 0, next }, talk: null, submenu: null });
  setBox(g, MENU_BOX.w, MENU_BOX.h);
}
function startCine(g, kind, next) { g.cine = { kind, t: 0, next, cue: 0 }; g.mode = 'cine'; }
function toMenu(g) {
  Object.assign(g, { mode: 'menu', text: null, talk: null, submenu: null, attack: null, bullets: [], menuBones: [], menuBoneClock: 0, menuBoneNext: 1.3, flavorShown: 0 });
  setBox(g, MENU_BOX.w, MENU_BOX.h); setFace(g, restFace(g));
  const pool = L.FLAVOR[g.phase] || L.FLAVOR.p1;
  g.flavor = g.kr >= 10 ? L.FLAVOR.karma : pool[g.turns % pool.length];
}
// 한 줄을 다 보여 주거나, 다음 줄로 넘기거나, 끝났으면 이어질 일을 한다.
function advance(g, box) {
  const line = box.lines[box.index], length = (Array.isArray(line) ? line[0] : line).length;
  if (box.shown < length) { box.shown = length; return; }
  if (box.index < box.lines.length - 1) { box.index++; box.shown = 0; if (box === g.talk) setFace(g, box.lines[box.index][1]); return; }
  const next = box.next;
  if (box === g.talk) { g.talk = null; setFace(g, restFace(g)); } else g.text = null;
  run(g, next);
}

// ---------- 플레이어의 차례 ----------
function openSub(g, kind, items) { g.mode = 'submenu'; g.submenu = { kind, items, index: 0 }; }
function choose(g) {
  const id = BUTTONS[g.menu].id; emit(g, 'sfx', 'select'); g.menuBones = [];
  if (id === 'fight') openSub(g, 'target', [{ id: 'sans', name: '샌즈' }]);
  else if (id === 'act') openSub(g, 'act', [{ id: 'check', name: '조사' }, { id: 'joke', name: '농담하기' }]);
  else if (id === 'item') { if (diff(g).noItems) say(g, ['* 하드모드에서는 아이템을 쓸 수 없다.'], 'menu'); else if (g.items.length) openSub(g, 'item', g.items.map((item, index) => ({ id: item, index, name: L.ITEMS[item].name }))); else say(g, ['* 가방이 비어 있다.'], 'menu'); }
  else openSub(g, 'mercy', [{ id: 'spare', name: '살려주기', glow: g.phase === 'offer' }]);
}
function confirmSub(g) {
  const sub = g.submenu, item = sub.items[sub.index]; g.submenu = null; emit(g, 'sfx', 'select');
  if (sub.kind === 'target') { g.mode = 'fightbar'; g.bar = { t: 0 }; return; }
  if (sub.kind === 'act') {
    if (item.id === 'check') return passTurn(g, L.checkLines(g.phase));
    const joke = L.JOKES[Math.min(g.jokes++, L.JOKES.length - 1)]; return passTurn(g, joke.text, joke.reply);
  }
  if (sub.kind === 'item') {
    const def = L.ITEMS[item.id], healed = Math.min(def.heal, g.maxHp - g.hp);
    g.items.splice(item.index, 1); g.hp += healed; g.stats.heals++; emit(g, 'sfx', 'heal');
    return passTurn(g, [`* ${def.name}${L.objectParticle(def.name)} 먹었다.`, g.hp >= g.maxHp ? '* HP가 가득 찼다.' : `* HP가 ${healed} 회복되었다.`]);
  }
  if (g.phase === 'offer') { emit(g, 'music', null); return startTalk(g, L.DUNK, 'dunk'); }
  passTurn(g, L.mercyLines(g.phase));
}
// 공격하지 않고 차례를 넘긴다. 샌즈가 기다려 주는 동안(제안)에는 공격이 오지 않는다.
function passTurn(g, lines, reply = null) {
  g.turns++; g.reply = reply;
  say(g, lines, g.phase === 'offer' ? (reply ? 'offerReply' : 'menu') : reply ? 'fillerTalk' : 'filler');
}
function strike(g) {
  g.strike = { t: 0, pos: Math.min(1, g.bar.t / BAR_TIME), final: 0, dodged: false }; g.bar = null; g.mode = 'strike';
  emit(g, 'sfx', 'slash');
}
// 샌즈가 피한 뒤: 이야기가 한 칸 나아간다.
function afterStrike(g) {
  g.strike = null; g.dodges++; g.turns++;
  if (g.phase === 'p1') {
    if (g.story < ORDER.p1.length) { g.pending = ORDER.p1[g.story]; return startTalk(g, L.P1[g.story], 'story'); }
    emit(g, 'music', 'hall'); return startTalk(g, L.OFFER, 'offer');
  }
  if (g.phase === 'offer') return startTalk(g, L.P2[0], 'p2start');
  if (g.phase === 'p2') {
    if (g.story < ORDER.p2.length) { g.pending = ORDER.p2[g.story]; return startTalk(g, L.P2[g.story], 'story'); }
    return startTalk(g, L.SPECIAL_INTRO, 'special');
  }
  toMenu(g);
}

// 한 번 누른 키: 'confirm' | 'cancel' | 'left' | 'right' | 'up' | 'down'
export function press(g, key) {
  if (g.paused) return;
  if (g.mode === 'cine') { if (key === 'confirm' && g.cine.kind === 'enter' && g.cine.t > .3) g.cine.t = CINE_TIME.enter; return; }
  const step = key === 'left' || key === 'up' ? -1 : key === 'right' || key === 'down' ? 1 : 0;
  switch (g.mode) {
    case 'title':
      if (key === 'cancel' && g.meta.hiddenHeart !== true) {
        g.secretTaps++;
        if (g.secretTaps === 3) {
          g.meta.hiddenHeart = true; applyHiddenHeart(g);
          emit(g, 'sfx', 'materialize'); emit(g, 'save');
        } else emit(g, 'sfx', 'move');
      }
      else if (step) { g.level = clamp(g.level + step, 0, DIFFICULTIES.length - 1); g.lockedNotice = false; applyHiddenHeart(g); emit(g, 'sfx', 'move'); }
      else if (key === 'confirm') { emit(g, 'sfx', 'select'); begin(g, 'title'); }
      return;
    case 'talk': if (key === 'confirm' || key === 'cancel') advance(g, g.talk); return;
    case 'text': if (key === 'confirm' || key === 'cancel') advance(g, g.text); return;
    case 'menu':
      if (key === 'left' || key === 'right') { g.menu = (g.menu + step + 4) % 4; emit(g, 'sfx', 'move'); }
      else if (key === 'confirm') choose(g);
      return;
    case 'submenu': {
      const sub = g.submenu, n = sub.items.length, cols = sub.kind === 'item' || sub.kind === 'act' ? 2 : 1;
      if (key === 'cancel') { g.submenu = null; g.mode = 'menu'; emit(g, 'sfx', 'move'); }
      else if (key === 'confirm') confirmSub(g);
      else if (n > 1) { sub.index = (sub.index + (key === 'up' ? -cols : key === 'down' ? cols : step) + n * 2) % n; emit(g, 'sfx', 'move'); }
      return;
    }
    case 'fightbar': if (key === 'confirm') strike(g); return;
    case 'dodge':
      if (key !== 'confirm' || g.phase !== 'asleep' || !g.push) return;
      g.bullets = []; g.attack = null;
      if (g.push === 'fight') startCine(g, 'final', 'deathTalk'); else { emit(g, 'music', null); startCine(g, 'lower', 'mercyNotes'); }
      return;
    case 'gameover': {
      const over = g.over;
      if (step) { over.index = (over.index + step + over.options.length) % over.options.length; emit(g, 'sfx', 'move'); }
      else if (key === 'confirm' && g.modeT > 1.8) { const id = over.options[over.index].id; emit(g, 'sfx', 'select'); if (id === 'title') toTitle(g); else begin(g, id); }
      return;
    }
    case 'won': if (key === 'confirm' && g.modeT > 2.5) { emit(g, 'sfx', 'select'); toTitle(g); } return;
  }
}

// ---------- 샌즈의 차례 ----------
function startAttack(g, name, story = false) {
  const def = PATTERNS[name];
  Object.assign(g, { mode: 'dodge', attack: { name, t: 0, dur: def.dur, memo: {}, story }, bullets: [], text: null, talk: null, submenu: null, push: null });
  setBox(g, def.box.w, def.box.h);
  const B = targetBounds(g);
  Object.assign(g.soul, { mode: def.soul, gravity: 'down', va: 0, grounded: false, slam: false, inv: 0, plat: 0, moving: false, velX: 0, velY: 0, x: B.cx, y: def.soul === 'blue' ? B.b - SOUL_HALF : B.cy });
  g.stats.turns++;
  if (def.sequence) switchPattern(g, 0, false);
  else if (def.setup) def.setup(context(g, 0));
  if (g.phase === 'p2' || g.phase === 'special') startBlackout(g, .38);
}
// 차례와 이야기 진행은 유지하고, 암전 속에서 탄막·상자·영혼을 새 패턴으로 교체한다.
function switchPattern(g, index, blackout = true) {
  const attack = g.attack, sequence = PATTERNS[attack.name].sequence;
  const [, name] = sequence[index], def = PATTERNS[name];
  const segment = { index, name, t: 0, memo: {}, dur: def.dur };
  attack.segment = segment;
  g.bullets = []; g.sans.arm = null; g.sans.eye = 0; g.hurtT = 0;
  setBox(g, def.box.w, def.box.h, true);
  const B = targetBounds(g);
  Object.assign(g.soul, { mode: def.soul, gravity: 'down', va: 0, grounded: false, slam: false, inv: .18, plat: 0, moving: false, velX: 0, velY: 0, x: B.cx, y: def.soul === 'blue' ? B.b - SOUL_HALF : B.cy });
  if (def.setup) def.setup(context(g, 0, segment));
  if (blackout) startBlackout(g);
}
// 검은 화면 동안 공격 시간도 멈추고, 다시 보인 직후에도 반응할 시간을 준다.
function startBlackout(g, seconds = .28) {
  g.blackout = seconds;
  g.soul.inv = Math.max(g.soul.inv, .18);
  emit(g, 'sfx', 'teleport');
}
function endAttack(g) {
  const attack = g.attack;
  g.bullets = []; g.attack = null; g.sans.arm = null; g.sans.eye = 0;
  Object.assign(g.soul, { mode: 'red', gravity: 'down', va: 0, slam: false, plat: 0 });
  if (attack.name === 'opening') { g.phase = 'p1'; g.story = 0; return startTalk(g, g.meta.deaths ? L.AFTER_OPENING_AGAIN : L.AFTER_OPENING, 'afterOpening'); }
  if (attack.name === 'special') return startTalk(g, L.NOTHING_INTRO, 'nothing');
  if (attack.story) { g.story++; if (g.phase === 'p2') g.sans.sweat = Math.min(3, 1 + Math.floor(g.story / 2)); }
  toMenu(g);
}
function context(g, dt, active = g.attack) {
  const attack = active, s = g.soul;
  return {
    g, t: attack.t, dt, dur: attack.dur, memo: attack.memo, soul: s, B: targetBounds(g), level: g.level,
    rand: () => rand(g),
    spawn: bullet => { const made = { id: g.nextId++, age: 0, vx: 0, vy: 0, color: 'white', ttl: 8, ...bullet }; g.bullets.push(made); return made; },
    fx: name => emit(g, 'sfx', name),
    glow: seconds => { g.sans.eye = Math.max(g.sans.eye, seconds); },
    slam: (dir, speed = 900) => {
      if (s.mode !== 'blue') emit(g, 'sfx', 'ding');
      Object.assign(s, { mode: 'blue', gravity: dir, va: speed, grounded: false, slam: true, plat: 0 });
      Object.assign(g.sans, { arm: dir, armT: .5, eye: Math.max(g.sans.eye, .55) }); emit(g, 'sfx', 'throw');
    },
    soulMode: mode => { if (s.mode !== mode) emit(g, 'sfx', 'ding'); Object.assign(s, { mode, gravity: 'down', va: 0, grounded: false, slam: false, plat: 0 }); },
    place: (x, y) => Object.assign(s, { x, y, va: 0, plat: 0 }),
    cut: () => { g.bullets = []; startBlackout(g); g.sans.arm = null; },
    box: (w, h) => setBox(g, w, h, true),
  };
}

// ---------- 탄막 ----------
export function stabRect(bullet, B) {
  const d = bullet.cur;
  if (bullet.side === 'top') return { x: B.l, y: B.t, w: B.w, h: d };
  if (bullet.side === 'left') return { x: B.l, y: B.t, w: d, h: B.h };
  if (bullet.side === 'right') return { x: B.r - d, y: B.t, w: d, h: B.h };
  return { x: B.l, y: B.b - d, w: B.w, h: d };
}
// 블래스터 빔: 주둥이에서 뻗는 선분과 반폭
export function beamOf(bullet) {
  const cos = Math.cos(bullet.ang), sin = Math.sin(bullet.ang), reach = 14 * bullet.size;
  return { x1: bullet.x + cos * reach, y1: bullet.y + sin * reach, x2: bullet.x + cos * 1400, y2: bullet.y + sin * 1400, half: bullet.half };
}
export function segmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, lengthSquared = dx * dx + dy * dy || 1;
  const u = clamp(((px - x1) * dx + (py - y1) * dy) / lengthSquared, 0, 1);
  return Math.hypot(px - x1 - u * dx, py - y1 - u * dy);
}
function stepBullet(g, b, dt) {
  b.age += dt;
  if (b.kind === 'bone') { b.x += b.vx * dt; b.y += b.vy * dt; }
  else if (b.kind === 'plat') { const before = b.x; b.x += b.vx * dt; b.dx = b.x - before; }
  else if (b.kind === 'stab') {
    const t = b.age - b.warnT;
    if (t < 0) return;
    if (!b.out) { b.out = 1; emit(g, 'sfx', 'stab'); }
    b.cur = t < STAB_OUT ? b.depth * t / STAB_OUT : t < STAB_OUT + b.hold ? b.depth : Math.max(0, b.depth * (1 - (t - STAB_OUT - b.hold) / STAB_IN));
    if (t >= STAB_OUT + b.hold + STAB_IN) b.dead = 1;
  } else if (b.kind === 'sea') {
    const t = b.age - b.warnT;
    if (t < 0) return;
    if (!b.out) { b.out = 1; emit(g, 'sfx', 'stab'); }
    b.cur = b.age >= b.until ? Math.max(0, b.depth * (1 - (b.age - b.until) / .2)) : Math.min(b.depth, b.depth * t / .12);
  } else if (b.kind === 'gb') {
    const fire = b.age - b.delay;
    if (b.age < GB_ENTER) { const k = 1 - (1 - b.age / GB_ENTER) ** 3; b.x = b.sx + (b.tx - b.sx) * k; b.y = b.sy + (b.ty - b.sy) * k; }
    else if (fire < 0) { b.x = b.tx; b.y = b.ty; }
    else {
      if (!b.fired) { b.fired = 1; emit(g, 'sfx', b.size > 1 ? 'gbFireBig' : 'gbFire'); g.shake = Math.max(g.shake, b.size > 1 ? 7 : 4); }
      const back = 380 * fire * fire, full = b.size > 1 ? 21 : 12;
      b.x = b.tx - Math.cos(b.ang) * back; b.y = b.ty - Math.sin(b.ang) * back;
      b.half = fire < b.hold ? full * Math.min(1, fire / .05) * Math.min(1, (b.hold - fire) / .09 + .15) : 0;
    }
  }
}
function touches(b, s, B) {
  if (b.kind === 'bone') return Math.abs(s.x - b.x) < b.w / 2 + HIT_HALF && Math.abs(s.y - b.y) < b.h / 2 + HIT_HALF;
  if (b.kind === 'stab' || b.kind === 'sea') {
    if (b.cur < 3) return false;
    const r = stabRect(b, B);
    return s.x + HIT_HALF > r.x && s.x - HIT_HALF < r.x + r.w && s.y + HIT_HALF > r.y && s.y - HIT_HALF < r.y + r.h;
  }
  if (b.kind === 'gb') { if (b.half <= 2) return false; const beam = beamOf(b); return segmentDistance(s.x, s.y, beam.x1, beam.y1, beam.x2, beam.y2) < beam.half * .85 + 3; }
  return false;
}
// 맞으면 HP 1 과 업보(KR). 무적 시간이 아주 짧아서, 스치면 조금 닳고 머무르면 금방 닳는다.
function damage(g, amount = 1) {
  const s = g.soul, d = diff(g);
  if (s.inv > 1e-6) return;
  g.hp = Math.max(0, g.hp - amount); g.kr = Math.min(40, g.kr + d.krGain); s.inv = d.grace;
  g.stats.ticks++; g.hurtT = .2;
  if (g.time - g.lastHit > .4) { g.stats.hits++; emit(g, 'sfx', 'hurt'); }
  g.lastHit = g.time;
}
// 업보는 HP를 천천히 갉아먹는다. 많이 쌓일수록 빨리. 업보만으로는 죽지 않는다.
function tickKarma(g, dt) {
  g.kr = Math.min(g.kr, Math.max(0, g.hp - 1));
  if (g.kr <= 0) { g.krClock = 0; return; }
  const step = g.kr >= 30 ? .07 : g.kr >= 20 ? .14 : g.kr >= 10 ? .3 : .6;
  g.krClock += dt;
  while (g.krClock >= step && g.kr > 0 && g.hp > 1) { g.krClock -= step; g.kr--; g.hp--; }
}

// ---------- 영혼 ----------
function moveSoul(g, dt, held) {
  const s = g.soul, b = g.box;
  const left = b.x - b.w / 2 + SOUL_HALF, right = b.x + b.w / 2 - SOUL_HALF, top = b.y - b.h / 2 + SOUL_HALF, bottom = b.y + b.h / 2 - SOUL_HALF;
  const speed = held.slow ? SLOW : SPEED, ix = (held.right ? 1 : 0) - (held.left ? 1 : 0), iy = (held.down ? 1 : 0) - (held.up ? 1 : 0);
  const fromX = s.x, fromY = s.y; let carried = 0;
  if (s.mode === 'red') {
    const n = ix && iy ? Math.SQRT1_2 : 1;
    s.x += ix * n * speed * dt; s.y += iy * n * speed * dt;
  } else {
    // 파란 영혼: 중력이 향하는 벽이 바닥이다. 바닥 반대쪽 키로 뛰고, 키를 떼면 상승이 끊긴다.
    const vertical = s.gravity === 'down' || s.gravity === 'up', sign = s.gravity === 'down' || s.gravity === 'right' ? 1 : -1;
    const riding = s.plat && g.bullets.find(p => p.id === s.plat);
    if (riding) { carried = riding.dx || 0; s.x += carried; }
    if (vertical) s.x += ix * speed * dt; else s.y += iy * speed * dt;
    const jump = s.gravity === 'down' ? held.up : s.gravity === 'up' ? held.down : s.gravity === 'right' ? held.left : held.right;
    if (jump && s.grounded) { s.va = -JUMP_SPEED; s.grounded = false; }
    if (!jump && s.va < -JUMP_CUT) s.va = -JUMP_CUT;
    s.va = Math.min(FALL_MAX, s.va + GRAVITY * dt);
    const before = vertical ? s.y : s.x, floor = s.gravity === 'down' ? bottom : s.gravity === 'up' ? top : s.gravity === 'right' ? right : left;
    let pos = before + s.va * sign * dt, landed = sign > 0 ? pos >= floor : pos <= floor;
    if (landed) pos = floor;
    s.plat = 0;
    if (!landed && s.gravity === 'down' && s.va >= 0) {
      for (const p of g.bullets) {
        if (p.kind !== 'plat' || Math.abs(s.x - p.x) > p.w / 2 + 3) continue;
        if (before + SOUL_HALF <= p.y + 2 && pos + SOUL_HALF >= p.y) { pos = p.y - SOUL_HALF; landed = true; s.plat = p.id; break; }
      }
    }
    if (landed) {
      if (s.slam) { s.slam = false; emit(g, 'sfx', 'slam'); g.shake = Math.max(g.shake, 6); }
      s.va = 0; s.grounded = true;
    } else s.grounded = false;
    if (vertical) s.y = pos; else s.x = pos;
  }
  s.x = clamp(s.x, left, right); s.y = clamp(s.y, top, bottom);
  s.moving = Math.abs(s.x - fromX - carried) > .02 || Math.abs(s.y - fromY) > .02;
  if (dt > 0) { const k = Math.min(1, dt * 12); s.velX += ((s.x - fromX) / dt - s.velX) * k; s.velY += ((s.y - fromY) / dt - s.velY) * k; }
}

// ---------- 프레임 ----------
export function tick(g, dt, held = {}) {
  dt = clamp(dt, 0, .05);
  if (g.paused) return;
  g.time += dt; g.modeT += dt;
  tickSans(g, dt); typeOut(g, dt);
  const wasBlackout = g.blackout > 0;
  if (wasBlackout) g.blackout = Math.max(0, g.blackout - dt);
  if (wasBlackout && g.blackout === 0) emit(g, 'sfx', 'materialize');
  if (g.shake > 0) g.shake = Math.max(0, g.shake - dt * 26);
  if (g.flash > 0) g.flash = Math.max(0, g.flash - dt * 1.6);
  if (g.hurtT > 0) g.hurtT -= dt;
  if (g.strike) g.strike.t += dt;
  // 상자는 어느 장면에서든 목표 크기로 부드럽게 바뀐다
  const box = g.box, k = Math.min(1, dt * 14);
  box.w += (box.tw - box.w) * k; box.h += (box.th - box.h) * k; box.x += (box.tx - box.x) * k; box.y += (box.ty - box.y) * k;
  switch (g.mode) {
    case 'cine': return tickCine(g, dt);
    case 'menu': g.stats.time += dt; tickKarma(g, dt); tickMenuBones(g, dt); return;
    case 'submenu': g.stats.time += dt; tickKarma(g, dt); return;
    case 'fightbar': g.stats.time += dt; tickKarma(g, dt); g.bar.t += dt; if (g.bar.t >= BAR_TIME) strike(g); return;
    case 'strike': {
      const strikeState = g.strike;
      if (!strikeState.dodged && strikeState.t >= .1) { strikeState.dodged = true; g.sans.dodgeT = 0; setFace(g, 'wink'); emit(g, 'sfx', 'dodge'); }
      if (strikeState.t >= STRIKE_TIME) afterStrike(g);
      return;
    }
    case 'dodge': g.stats.time += dt; if (wasBlackout) return; return tickDodge(g, dt, held);
  }
}
function tickDodge(g, dt, held) {
  const attack = g.attack, def = PATTERNS[attack.name], pdt = dt * attackTempo(g);
  attack.t += pdt;
  if (def.sequence) {
    const next = attack.segment.index + 1;
    if (def.sequence[next] && attack.t >= def.sequence[next][0]) {
      switchPattern(g, next);
      return;
    }
    const segment = attack.segment;
    segment.t += pdt;
    if (attack.t < attack.dur) PATTERNS[segment.name].tick(context(g, pdt, segment));
  } else {
    if (attack.t < attack.dur) def.tick(context(g, pdt));
  }
  if (g.blackout > 0) return;
  for (const b of g.bullets) stepBullet(g, b, pdt);
  g.bullets = g.bullets.filter(b => !b.dead && b.age < b.ttl);
  moveSoul(g, dt, held);
  if (g.soul.inv > 0) g.soul.inv -= dt;
  tickKarma(g, dt);
  const B = targetBounds(g), amount = attack.name === 'dunk' ? 9 : 1;
  for (const b of g.bullets) {
    if (b.kind === 'plat' || !touches(b, g.soul, B)) continue;
    if (b.color === 'blue' && !g.soul.moving) continue;
    damage(g, amount);
  }
  if (g.hp <= 0) return die(g);
  if (def.endless) return tickNothing(g, dt, held);
  if (attack.t >= attack.dur) endAttack(g);
}
// 아무 일도 일어나지 않는 차례. 샌즈가 잠들면 벽을 밀어 상자를 버튼 쪽으로 옮길 수 있다.
function tickNothing(g, dt, held) {
  if (g.phase === 'nothing') {
    g.sleepT += dt; const progress = g.sleepT / diff(g).sleep;
    while (g.bubbleIndex < L.NOTHING_BUBBLES.length && progress >= L.NOTHING_BUBBLES[g.bubbleIndex][0]) {
      const [, text, face] = L.NOTHING_BUBBLES[g.bubbleIndex++];
      g.bubble = { text, shown: 0, t: 0, hold: 2.6 }; setFace(g, face);
    }
    if (progress >= 1) { g.phase = 'asleep'; g.asleepT = 0; setFace(g, 'sleep'); emit(g, 'sfx', 'snore'); }
    return;
  }
  g.asleepT += dt;
  const box = g.box, s = g.soul, atLeft = s.x <= box.x - box.w / 2 + SOUL_HALF + .5, atRight = s.x >= box.x + box.w / 2 - SOUL_HALF - .5;
  const dir = held.left && atLeft ? -1 : held.right && atRight ? 1 : 0;
  if (dir) {
    const x = clamp(box.x + dir * 70 * dt, PUSH_MIN, PUSH_MAX), moved = x - box.x;
    box.x = box.tx = x; s.x += moved;
    if (moved && !g.pushed) { g.pushed = true; emit(g, 'sfx', 'push'); }
  }
  const push = box.x <= PUSH_MIN + 1 ? 'fight' : box.x >= PUSH_MAX - 1 ? 'mercy' : null;
  if (push && push !== g.push) emit(g, 'sfx', 'move');
  g.push = push;
}
// 2막의 메뉴: 뼈가 버튼 줄을 가로지른다. 고르고 있는 버튼 위를 지나가면 다친다.
function tickMenuBones(g, dt) {
  const d = diff(g);
  if (g.soul.inv > 0) g.soul.inv -= dt;
  if (g.phase !== 'p2' || g.story < 2 || !d.menuBones) return;
  g.menuBoneClock += dt * d.tempo;
  if (g.menuBoneClock >= g.menuBoneNext) { g.menuBoneNext += 2.6; g.menuBones.push({ x: W + 20 }); }
  for (const bone of g.menuBones) { bone.x -= 170 * d.tempo * dt; if (Math.abs(bone.x - cursorX(g)) < 10) damage(g); }
  g.menuBones = g.menuBones.filter(bone => bone.x > -20);
  if (g.hp <= 0) die(g);
}
function tickSans(g, dt) {
  const s = g.sans;
  if (s.dodgeT >= 0) {
    s.dodgeT += dt; const t = s.dodgeT;
    s.dx = t < .16 ? -96 * (1 - (1 - t / .16) ** 3) : t < .78 ? -96 : t < 1.02 ? -96 * (1 - ((t - .78) / .24) ** 2 * (3 - 2 * (t - .78) / .24)) : 0;
    if (t >= 1.02) { s.dodgeT = -1; s.dx = 0; if (g.mode !== 'talk') setFace(g, restFace(g)); }
  }
  if (s.armT > 0) { s.armT -= dt; if (s.armT <= 0) s.arm = null; }
  if (s.eye > 0) s.eye -= dt;
  if (s.hpShown > 0 && s.hpShown < 9) s.hpShown += dt;
}
// 글자가 한 자씩 찍힌다. 샌즈의 말풍선은 목소리가 난다.
function typeOut(g, dt) {
  const type = (box, line, speed, voice) => {
    if (box.shown >= line.length) return;
    const before = Math.floor(box.shown); box.shown = Math.min(line.length, box.shown + dt * speed);
    const now = Math.floor(box.shown), ch = line[now - 1];
    if (now !== before && now % 2 === 1 && ch && !/[\s….,!?"*]/.test(ch)) emit(g, 'voice', voice);
  };
  if (g.talk) type(g.talk, g.talk.lines[g.talk.index][0], 26, 'sans');
  if (g.text) type(g.text, g.text.lines[g.text.index], 34, 'text');
  if (g.mode === 'menu' && g.flavorShown < g.flavor.length) g.flavorShown = Math.min(g.flavor.length, g.flavorShown + dt * 40);
  if (g.bubble) {
    type(g.bubble, g.bubble.text, 22, 'sans');
    if (g.bubble.shown >= g.bubble.text.length) { g.bubble.t += dt; if (g.bubble.t >= g.bubble.hold) g.bubble = null; }
  }
}
function tickCine(g, dt) {
  const c = g.cine; c.t += dt;
  const cue = (n, time, fn) => { if (c.cue === n && c.t >= time) { c.cue++; fn(); } };
  if (c.kind === 'blackout') {
    cue(0, .1, () => emit(g, 'music', null));
    cue(1, .45, () => emit(g, 'sfx', 'ding'));
  } else if (c.kind === 'final') {
    // 첫 칼은 잠결에도 피한다. 말이 끝나기 전에 날아든 두 번째 칼은 피하지 못한다.
    cue(0, 0, () => { g.strike = { t: 0, pos: .5, final: 1, dodged: true }; setBox(g, MENU_BOX.w, MENU_BOX.h); emit(g, 'sfx', 'slash'); emit(g, 'music', null); });
    cue(1, .14, () => { setFace(g, 'wink'); g.sans.dodgeT = 0; emit(g, 'sfx', 'dodge'); });
    cue(2, .8, () => { g.bubble = { text: L.WAKE_LINE, shown: 0, t: 0, hold: 9 }; });
    cue(3, 2.05, () => { g.bubble = null; g.strike = { t: 0, pos: .5, final: 2, dodged: true }; emit(g, 'sfx', 'slash'); });
    cue(4, 2.2, () => { g.sans.gash = true; g.sans.hpShown = .001; g.flash = .6; g.shake = 12; setFace(g, 'hurt'); emit(g, 'sfx', 'hit'); });
  } else if (c.kind === 'leave') {
    g.sans.walk = Math.max(0, c.t - .4);
    cue(0, 3.5, () => { g.sans.hidden = true; emit(g, 'sfx', 'dust'); });
  } else if (c.kind === 'lower') {
    cue(0, 0, () => setBox(g, MENU_BOX.w, MENU_BOX.h));
    cue(1, .5, () => emit(g, 'sfx', 'drop'));
  }
  if (c.t < CINE_TIME[c.kind]) return;
  g.cine = null; if (c.kind === 'final') g.strike = null;
  run(g, c.next);
}

// 자동화·디버그용 요약
export function summarize(g) {
  const line = box => box ? (Array.isArray(box.lines[box.index]) ? box.lines[box.index][0] : box.lines[box.index]) : null;
  return { mode: g.mode, phase: g.phase, story: g.story, level: diff(g).id, hardUnlocked: hardUnlocked(g), veryHardUnlocked: veryHardUnlocked(g), hp: g.hp, maxHp: g.maxHp, hiddenHeart: g.meta.hiddenHeart === true, kr: g.kr, items: g.items.length, deaths: g.meta.deaths,
    attack: g.attack ? { name: g.attack.name, pattern: g.attack.segment?.name || g.attack.name, t: Math.round(g.attack.t * 100) / 100, dur: g.attack.dur } : null,
    soul: { x: Math.round(g.soul.x), y: Math.round(g.soul.y), mode: g.soul.mode, gravity: g.soul.gravity }, bullets: g.bullets.length,
    menu: BUTTONS[g.menu].id, submenu: g.submenu ? g.submenu.kind : null, talk: line(g.talk), text: line(g.text), bubble: g.bubble?.text || null,
    cine: g.cine?.kind || null, blackout: g.blackout, face: g.sans.face, push: g.push, checkpoint: g.checkpoint?.at || null, ended: g.ended, result: g.result };
}
