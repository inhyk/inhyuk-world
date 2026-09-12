// 언더테일 팬 게임 · 브라우저 연결부 (입력, 루프, 화면 전환, 저장, 결말)
import * as C from './core.mjs';
import * as Wd from './world.mjs';
import * as R from './render.mjs';
import { Soundtrack } from './audio.mjs';
import { ITEMS, SHOPS, ENDINGS, AREAS } from './data.mjs';

const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const audio = new Soundtrack();
const SAVE_KEY = 'undertale-fan-save', META_KEY = 'undertale-fan-meta';
const meta = load(META_KEY) || { erased: false, soulless: false, endings: [], sound: false };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function load(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function store(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 저장 공간 없음 */ } }
function saveMeta() { store(META_KEY, meta); }

// ---------- 게임 상태 ----------
const G = { warp: null, mode: 'title', t: 0, player: null, world: null, battle: null, textbox: null, shop: null, menu: null, ending: null, gameover: null, title: null, naming: null, confirm: null, wait: 0, pausedByBlur: false, scripted: null, erased: null, lastBattleMusic: null };
const SECRET_CODE = '12345678901015', LEVEL_CODE = '13570'; let codeBuffer = '';
const keys = {}; let confirmPressed = false, cancelPressed = false, menuPressed = false, dirPressed = null;

function titleState() {
  const save = load(SAVE_KEY);
  const options = [];
  if (save) options.push({ id: 'continue', label: '계속하기', sub: `${save.player.name} · LV ${save.player.lv} · ${AREAS[Wd.ROOMS[save.room]?.area || 'ruins'].name}${save.player.flags?.hard ? ' · HARD' : ''}` });
  options.push({ id: 'new', label: '새로 시작', sub: save ? '기존 세이브가 지워집니다' : '' });
  options.push({ id: 'guide', label: '조작법' });
  return { options, index: 0, save };
}
function gotoTitle() { G.mode = 'title'; G.title = titleState(); audio.play('title'); }

// ---------- 이름 짓기 ----------
const KEY_ROWS = ['가나다라마바사아자차카타파하'.split(''), 'ABCDEFGHIJKLMN'.split(''), 'OPQRSTUVWXYZ'.split(''), '프리스크차라토리엘샌즈'.split('')];
const NAME_COMMENTS = { '프리스크': '경고: 이 이름은 하드 모드를 켠다. 그래도 이 이름인가?', '차라': '…진짜 이름이다.', '샌즈': '안 돼요. 너무 게을러서.', '파피루스': '난 이 이름을 좋아한다! 하지만 안 된다.', '토리엘': '아니, 나의 아이. 이 이름은 안 되겠구나.', '플라위': '그 이름 마음에 든다. 진짜야.', '아스고어': '이건 좀 이상하지 않니?', '아스리엘': '…', '언다인': '이 이름은 근위대장 거야!', '알피스': '어… 어… 이 이름은 안 돼. 아마도.', '메타톤': 'OH YES!!! …그래도 안 돼.' };
const FORBIDDEN = ['샌즈', '파피루스', '토리엘', '아스고어', '언다인', '알피스', '메타톤'];
function startNaming() { G.mode = 'naming'; G.naming = { name: '', row: 0, col: 0, keys: KEY_ROWS, message: '' }; }
function confirmName() {
  const name = G.naming.name.trim() || '프리스크';
  const comment = NAME_COMMENTS[name] || (name.length > 6 ? '너무 길지 않니? 그래도 이 이름인가?' : '이 이름인가?');
  G.mode = 'confirmName'; G.confirm = { name, comment, index: 1, forbidden: FORBIDDEN.includes(name) };
}
function newGame(name) {
  G.player = C.createPlayer(name); if (meta.soulless) G.player.flags.soulless = true; if (name === '프리스크') G.player.flags.hard = true;
  G.world = Wd.createWorld(G.player); localStorage.removeItem(SAVE_KEY);
  G.mode = 'overworld'; playAreaMusic();
  if (G.player.flags.hard) openText(null, ['* 하드 모드가 켜졌다.', '* 탄막이 빠르고 오래 가며, 받는 피해가 크고 보스는 더 튼튼하다. 회복 아이템은 덜 듣는다.']);
}
function continueGame() { const save = load(SAVE_KEY); if (!save) return newGame('프리스크'); G.player = save.player; G.world = Wd.restore(save); if (meta.soulless) G.player.flags.soulless = true; G.mode = 'overworld'; playAreaMusic(); }
function saveGame() { store(SAVE_KEY, Wd.serialize(G.world)); }
function playAreaMusic() { const area = G.world.room.area; audio.play(C.routeFor(G.player, area) === 'genocide' && area !== 'castle' ? 'judgement' : area); }

// ---------- 대화 상자 ----------
function openText(who, lines, done, opts = {}) { G.textbox = { who, lines, index: 0, shown: 0, done, top: opts.top || (G.world && G.world.y > 300), choice: null, request: opts.request || null }; G.mode = opts.mode || 'textbox'; }
function advanceTextbox() {
  const tb = G.textbox; if (!tb) return; const full = tb.lines[tb.index];
  if (tb.shown < full.length) { tb.shown = full.length; return; }
  if (tb.choice) { const idx = tb.choice.index; const done = tb.done; G.textbox = null; G.mode = 'overworld'; done(idx); return; }
  if (tb.index < tb.lines.length - 1) { tb.index++; tb.shown = 0; return; }
  const done = tb.done; G.textbox = null; if (G.mode === 'textbox') G.mode = 'overworld'; if (done) done();
}

// ---------- 월드 요청 처리 ----------
function handleWorldRequest() {
  const w = G.world, r = w.request; if (!r || r.handled) return; r.handled = true;
  const resolve = v => { Wd.resolveRequest(w, v); };
  switch (r.type) {
    case 'say': openText(r.who, r.lines, () => resolve()); break;
    case 'choice': openText(null, [r.prompt], idx => resolve(idx)); G.textbox.choice = { options: r.options, index: 0 }; break;
    case 'save': audio.effect('save'); openText(null, r.lines, () => resolve()); G.textbox.saveAfter = true; saveGame(); break;
    case 'battle': startBattle(r.enemies, r, resolve); break;
    case 'shop': openShop(r.shop, () => resolve()); break;
    case 'wait': G.mode = 'wait'; G.wait = { t: r.s, resolve }; break;
    case 'music': if (r.name === null) playAreaMusic(); else audio.play(r.name); resolve(); break;
    case 'sound': audio.effect(r.name); resolve(); break;
    case 'shake': shake(); resolve(); break;
    case 'flash': flash(); resolve(); break;
    case 'ending': startEnding(r.kind, r); break;
    case 'gameover': startGameOver(r.reason); break;
    default: resolve();
  }
}

// ---------- 전투 ----------
function startBattle(enemies, req, resolve) {
  const p = G.player; const b = C.createBattle(p, enemies, { area: G.world.room.area, intro: req.intro });
  b.onEnd = resolve; G.battle = b; G.mode = 'battle'; G.battleT = 0;
  G.lastBattleMusic = audio.track; if (req.music) audio.play(req.music); else if (!(b.enemy.def.boss) || req.scripted) audio.play(req.scripted ? 'flowey' : 'battle');
  if (req.scripted) { G.scripted = req.scripted; setupScripted(b, req.scripted); }
  else { G.scripted = null; b.mode = 'text'; b.pending = () => { b.mode = 'menu'; }; }
  audio.effect('select');
}
function setupScripted(b, kind) {
  b.text = null; b.mode = 'dodge'; b.turn = 1;
  const box = { w: 300, h: 150 }; b.box.tw = box.w; b.box.th = box.h; b.box.w = box.w; b.box.h = box.h; b.soul.x = b.box.x; b.soul.y = b.box.y;
  if (kind === 'pellets') b.attack = { name: 'scripted', t: 0, duration: 4.5, memo: {}, enemy: b.enemy, speech: '자, 우정 알갱이를 모아 봐!', def: { duration: 4.5, tick(c) { if (!c.memo.done) { c.memo.done = true; for (let i = 0; i < 5; i++) c.spawn({ kind: 'pellet', r: 6, x: 320 + (i - 2) * 28, y: b.box.y - 60, vy: 40, ttl: 6, dmg: 19, update(me, cc) { const dx = cc.soul.x - me.x, dy = cc.soul.y - me.y, d = Math.hypot(dx, dy) || 1; if (me.age > 1.2) { me.vx = dx / d * 140; me.vy = dy / d * 140; } } }); } } } };
  else b.attack = { name: 'scripted', t: 0, duration: 3.2, memo: {}, enemy: b.enemy, speech: '죽어.', def: { duration: 3.2, tick(c) { if (!c.memo.done) { c.memo.done = true; for (let i = 0; i < 18; i++) { const a = i * Math.PI * 2 / 18; c.spawn({ kind: 'pellet', r: 6, x: c.soul.x + Math.cos(a) * 130, y: c.soul.y + Math.sin(a) * 130, ttl: 6, dmg: 99, update(me, cc) { const dx = cc.soul.x - me.x, dy = cc.soul.y - me.y, d = Math.hypot(dx, dy) || 1; if (me.age > 1.4) { me.vx = dx / d * 60; me.vy = dy / d * 60; } if (d < 14) { me.dead = true; me.noHit = true; } } }); } } } } };
}
function battleInput() {
  const b = G.battle; if (!b || b.paused) return;
  if (b.mode === 'menu') {
    if (dirPressed === 'left') { b.menu = (b.menu + 3) % 4; audio.effect('cancel'); } if (dirPressed === 'right') { b.menu = (b.menu + 1) % 4; audio.effect('cancel'); }
    if (confirmPressed) { const action = ['fight', 'act', 'item', 'mercy'][b.menu]; b.lastAction = action; C.chooseAction(b, action); audio.effect('select'); }
  } else if (b.mode === 'submenu') {
    const n = b.submenu.items.length; const cols = b.submenu.kind === 'act' || b.submenu.kind === 'item' ? 2 : 1;
    if (dirPressed === 'up') b.sub = (b.sub - cols + n) % n; if (dirPressed === 'down') b.sub = (b.sub + cols) % n; if (dirPressed === 'left') b.sub = (b.sub - 1 + n) % n; if (dirPressed === 'right') b.sub = (b.sub + 1) % n;
    if (dirPressed) audio.effect('cancel');
    if (confirmPressed) { const kind = b.submenu.kind; if (C.chooseSub(b, b.sub)) { audio.effect(kind === 'item' ? 'heal' : 'select'); } }
    if (cancelPressed) { C.cancel(b); audio.effect('cancel'); }
  } else if (b.mode === 'fightbar') { if (confirmPressed) { C.strike(b); const d = b.lastDamage; audio.effect(d && d.dmg > 0 ? 'slash' : 'miss'); } }
  else if (b.mode === 'text') { if (confirmPressed || cancelPressed) { const before = b.mode; C.advanceText(b); if (b.mode !== before) afterBattleText(b); } }
  else if (b.mode === 'end') { if (confirmPressed) finishBattle(b); }
}
function afterBattleText(b) {
  if (b.mode === 'dodge') { if (b.attack?.enemy.def.karma) audio.effect('blaster'); else if (b.attack?.enemy.id === 'toriel' || b.attack?.enemy.id === 'asgore') audio.effect('fire'); }
  if (b.mode === 'end') { /* 확인 키로 종료 */ }
}
function finishBattle(b) {
  if (b.ended === 'dead' || G.player.hp <= 0) { G.player.hp = 0; startGameOver(b.enemy.id); return; }
  G.battle = null; G.mode = 'overworld'; if (G.lastBattleMusic && !b.enemy.def.boss) audio.play(G.lastBattleMusic); else playAreaMusic();
  if (b.ended === 'spare' || b.ended === 'flee') audio.effect('spare'); else if (b.ended === 'kill') audio.effect('win');
  const cb = b.onEnd; if (cb) cb({ ended: b.ended });
  saveMetaCheck();
}
function saveMetaCheck() { }
function updateBattle(dt) {
  const b = G.battle; if (!b) return; G.battleT += dt;
  const hpBefore = G.player.hp, modeBefore = b.mode, hitsBefore = b.hits, bulletsBefore = b.bullets.length;
  C.update(b, dt, { left: keys.ArrowLeft || keys.KeyA, right: keys.ArrowRight || keys.KeyD, up: keys.ArrowUp || keys.KeyW, down: keys.ArrowDown || keys.KeyS, slow: keys.ShiftLeft || keys.ShiftRight });
  if (b.hits > hitsBefore) audio.effect('hurt');
  if (b.effects.some(fx => fx.kind === 'block' && fx.t === 0)) audio.effect('block');
  if (b.mode === 'dodge' && b.attack) { const bl = b.bullets.find(x => x.kind === 'blaster' && !x.warn && !x.sounded); if (bl) { bl.sounded = true; audio.effect('blaster'); } }
  if (G.scripted) {
    if (G.player.hp < 1) G.player.hp = 1;
    if (G.scripted === 'pellets' && G.player.hp > 1 && b.hits > 0) G.player.hp = 1;
    if (G.scripted === 'ring' && b.attack && b.attack.t > 3.2) { b.bullets = []; endScripted(b); return; }
    if (b.mode === 'menu') { endScripted(b); return; }
    if (b.mode === 'end') { G.player.hp = 1; b.ended = 'scripted'; endScripted(b); return; }
  }
  if (modeBefore === 'strikeanim' && b.mode !== 'strikeanim' && b.lastDamage?.dmg > 0) audio.effect('hit');
  if (modeBefore === 'dodge' && b.mode === 'menu') { /* 라운드 종료 */ }
  if (b.mode === 'end' && b.ended === 'dead') { audio.effect('lose'); startGameOver(b.enemy.id); }
  if (hpBefore < G.player.hp && b.mode === 'dodge') audio.effect('heal');
  void bulletsBefore;
}
function endScripted(b) { G.scripted = null; b.ended = 'scripted'; G.battle = null; G.mode = 'overworld'; const cb = b.onEnd; if (cb) cb({ ended: 'scripted' }); }

// ---------- 상점 ----------
function openShop(id, done) { const shop = SHOPS[id]; G.shop = { shop, index: 0, message: shop.greeting, sprite: id === 'snowdin' ? 'rabbit' : id === 'tem' ? 'temmie' : 'vending', done }; G.mode = 'shop'; }
function shopInput() {
  const s = G.shop, p = G.player; const n = s.shop.items.length + 1;
  if (dirPressed === 'up') s.index = (s.index - 1 + n) % n; if (dirPressed === 'down') s.index = (s.index + 1) % n;
  if (cancelPressed || (confirmPressed && s.index === n - 1)) { G.mode = 'overworld'; const d = s.done; G.shop = null; d(); return; }
  if (confirmPressed) {
    const [id, price] = s.shop.items[s.index];
    if (p.gold < price) { s.message = '골드가 부족하다.'; audio.effect('cancel'); return; }
    if (p.items.length >= 8) { s.message = '가방이 가득 찼다.'; audio.effect('cancel'); return; }
    p.gold -= price; p.items.push(id); s.message = `${ITEMS[id].name}을(를) 샀다. 고마워!`; audio.effect('select');
  }
}

// ---------- 비밀 코드: 레벨업 (상한 없음) ----------
const LEVEL_STEPS = [{ amount: 1, name: 'LV +1', desc: '한 단계씩 차근차근' }, { amount: 10, name: 'LV +10', desc: '열 단계 한 번에' }, { amount: 100, name: 'LV +100', desc: '백 단계 한 번에 · 상한 없음' }];
function cheatLevelUp() {
  if (G.mode !== 'overworld' || !G.world || G.world.request || G.world.script) return;
  audio.effect('select'); G.lvSelect = { index: 0 }; G.mode = 'lvselect';
}
function applyLevelUp(amount) {
  const p = G.player; const before = p.lv;
  for (let i = 0; i < amount; i++) { p.lv++; p.maxHp = p.lv <= 20 ? C.maxHpFor(p.lv) : p.maxHp + 4; }
  p.hp = p.maxHp; if (p.lv <= 20) p.exp = Math.max(p.exp, C.EXP_TABLE[p.lv - 1]); else p.exp = Math.max(p.exp, C.EXP_TABLE[19]);
  audio.effect('levelup'); const w = G.world;
  w.request = { type: 'say', who: null, lines: [`* LV가 올랐다! LV ${before} → LV ${p.lv}`, `* HP ${p.maxHp}, AT ${C.attackStat(p)}, DF ${C.defenseStat(p)}`], resolve: () => { w.request = null; } };
}
function lvSelectInput() {
  const st = G.lvSelect, n = LEVEL_STEPS.length;
  if (dirPressed === 'up') st.index = (st.index - 1 + n) % n; if (dirPressed === 'down') st.index = (st.index + 1) % n;
  if (dirPressed) audio.effect('cancel');
  if (cancelPressed) { G.mode = 'overworld'; G.lvSelect = null; audio.effect('cancel'); return; }
  if (confirmPressed) { const step = LEVEL_STEPS[st.index]; G.lvSelect = null; G.mode = 'overworld'; applyLevelUp(step.amount); }
}

// ---------- 비밀 코드: 보스전 선택 ----------
const SECRET_BOSSES = [
  { id: 'sans', name: '샌즈', desc: '심판의 회랑 · 모든 공격을 피한다', music: 'sans', intro: '* 샌즈가 나타났다. "이런 전투 처음이지?"' },
  { id: 'asriel', name: '아스리엘 드리무르', desc: '절대신 · 죽일 수 없다, 구해야 한다', music: 'asriel', intro: '* 아스리엘이 세계를 뒤흔든다. 별빛이 쏟아진다.' },
  { id: 'flowey', name: '플라위', desc: '여섯 영혼의 힘 · 도움을 요청하라', music: 'flowey_boss', intro: '* 플라위가 여섯 영혼의 힘으로 낄낄댄다. "죽이거나 죽거나야!"' },
];
function startSecretBattle() {
  if (G.mode !== 'overworld' || !G.world || G.world.request || G.world.script) return;
  audio.effect('shatter'); shake(); G.bossSelect = { index: 0 }; G.mode = 'bossselect';
}
function bossSelectInput() {
  const st = G.bossSelect, n = SECRET_BOSSES.length;
  if (dirPressed === 'up') st.index = (st.index - 1 + n) % n; if (dirPressed === 'down') st.index = (st.index + 1) % n;
  if (dirPressed) audio.effect('cancel');
  if (cancelPressed) { G.mode = 'overworld'; G.bossSelect = null; audio.effect('cancel'); return; }
  if (confirmPressed) { const boss = SECRET_BOSSES[st.index]; const w = G.world; G.bossSelect = null; G.mode = 'overworld'; G.player.hp = G.player.maxHp; w.request = { type: 'battle', enemies: [boss.id], intro: boss.intro, music: boss.music, resolve: () => { w.request = null; } }; }
}

// ---------- 워프 메뉴 (- 키) ----------
function openWarp() { const ids = Object.keys(Wd.ROOMS); G.warp = { ids, index: Math.max(0, ids.indexOf(G.world.room.id)) }; G.mode = 'warp'; audio.effect('select'); }
function warpInput() {
  const s = G.warp, n = s.ids.length;
  if (dirPressed === 'up') s.index = (s.index - 1 + n) % n; if (dirPressed === 'down') s.index = (s.index + 1) % n;
  if (dirPressed === 'left') s.index = Math.max(0, s.index - 7); if (dirPressed === 'right') s.index = Math.min(n - 1, s.index + 7);
  if (dirPressed) audio.effect('cancel');
  if (cancelPressed) { G.mode = 'overworld'; G.warp = null; audio.effect('cancel'); return; }
  if (confirmPressed) { const id = s.ids[s.index]; Wd.enterRoom(G.world, id); G.world.transition = .4; G.mode = 'overworld'; G.warp = null; audio.effect('save'); playAreaMusic(); }
}

// ---------- 오버월드 메뉴 ----------
function openMenu() { G.menu = { tab: 0, sub: false, index: 0, message: '' }; G.mode = 'menu'; audio.effect('select'); }
function menuInput() {
  const m = G.menu, p = G.player;
  if (!m.sub) {
    if (dirPressed === 'up') m.tab = (m.tab + 2) % 3; if (dirPressed === 'down') m.tab = (m.tab + 1) % 3;
    if (cancelPressed || (confirmPressed && m.tab === 2)) { G.mode = 'overworld'; G.menu = null; audio.effect('cancel'); return; }
    if (confirmPressed && m.tab === 0 && p.items.length) { m.sub = true; m.index = 0; audio.effect('select'); }
    if (confirmPressed && m.tab === 1) audio.effect('select');
    return;
  }
  const n = p.items.length; if (!n) { m.sub = false; return; }
  if (dirPressed === 'up') m.index = (m.index - 1 + n) % n; if (dirPressed === 'down') m.index = (m.index + 1) % n;
  if (cancelPressed) { m.sub = false; audio.effect('cancel'); return; }
  if (confirmPressed) {
    const id = p.items[m.index], it = ITEMS[id];
    if (it.heal) { p.items.splice(m.index, 1); const h = id === 'noodles' ? C.heal(p, 90) : C.heal(p, it.heal); m.message = `${it.name}을(를) 먹었다. HP ${h} 회복.`; audio.effect('heal'); }
    else if (it.weapon !== undefined) { const old = p.weapon; p.weapon = id; p.items.splice(m.index, 1); p.items.push(old); m.message = `${it.name}을(를) 장착했다.`; audio.effect('select'); }
    else if (it.armor !== undefined) { const old = p.armor; p.armor = id; p.items.splice(m.index, 1); p.items.push(old); m.message = `${it.name}을(를) 장착했다.`; audio.effect('select'); }
    m.index = Math.min(m.index, Math.max(0, p.items.length - 1)); if (!p.items.length) m.sub = false;
  }
}

// ---------- 게임 오버 ----------
function startGameOver(reason) {
  G.player.deaths++; const p = G.player;
  const pools = { sans: ['아직 포기할 수 없어…', '샌즈가 기억하고 있다. 네가 몇 번이나 죽었는지.'], undying: ['넌 이 세상에서 지워져야 해…', '결의를 잃지 마라.'], asriel: ['크리스… 아직이야.', '결의를 잃지 마.'], default: ['아직 포기할 수 없어…', `${p.name}! 결의를 잃지 마!`] };
  G.gameover = { t: 0, lines: pools[reason] || pools.default }; G.mode = 'gameover'; G.battle = null; audio.play('gameover'); audio.effect('shatter');
}
function gameoverInput() { if (confirmPressed && G.gameover.t > 1.2 + G.gameover.lines.length * .9) { const save = load(SAVE_KEY); if (save) continueGame(); else newGame(G.player.name); } }

// ---------- 결말 ----------
function startEnding(kind, extra = {}) {
  const p = G.player; if (!meta.endings.includes(kind)) meta.endings.push(kind); saveMeta();
  G.mode = 'ending'; G.battle = null;
  if (kind === 'neutral') { const lines = [...ENDINGS.neutral.lines, ...Wd.neutralEndingLines(p)]; G.ending = { kind, title: ENDINGS.neutral.title, subtitle: ENDINGS.neutral.subtitle, lines, visible: [], t: 0, done: false, next: 0 }; audio.play('ending'); localStorage.removeItem(SAVE_KEY); }
  else if (kind === 'pacifist') { G.ending = { kind, lines: ENDINGS.pacifist.lines, visible: [], t: 0, done: false, next: 0, soulless: !!(extra.soulless || meta.soulless) }; audio.play('ending'); localStorage.removeItem(SAVE_KEY); }
  else { G.ending = { kind, lines: ['…', '아무도 남지 않았다.', '바람 소리만이 들린다.'], visible: [], t: 0, done: false, next: 0, phase: 'dark', choice: null }; audio.play(null); audio.effect('wind'); localStorage.removeItem(SAVE_KEY); }
}
function updateEnding(dt) {
  const e = G.ending; e.t += dt;
  if (e.kind === 'genocide') {
    if (e.phase === 'dark' && e.t > 6) { e.phase = 'chara'; e.visible = []; e.lines = ['안녕. 나는 차라.', '"악마"… 네가 이 세계를 이렇게 만들었을 때, 그렇게 불렀지.', '너와 나의 힘으로 이 세계는 끝났어. 다음으로 갈 시간이야.', '이 세계를 지울까?']; e.next = 0; e.t = 0; audio.play('judgement'); }
    if (e.phase === 'chara') { if (e.next < e.lines.length && e.t > e.next * 1.6 + .8) { e.visible.push(e.lines[e.next]); e.next++; audio.effect('text'); } if (e.next >= e.lines.length && !e.choice && e.t > e.lines.length * 1.6 + 1) e.choice = { options: ['지운다', '지우지 않는다'], index: 0 }; }
    if (e.phase === 'erase') { if (e.t > 3) { meta.erased = true; meta.soulless = false; saveMeta(); G.erased = { t: 0, phase: 'dark', visible: [], choice: null }; G.mode = 'erased'; } }
    return;
  }
  if (e.next < e.lines.length && e.t > e.next * 2.6 + 1) { e.visible.push(e.lines[e.next]); e.next++; audio.effect('text'); }
  if (e.next >= e.lines.length && e.t > e.lines.length * 2.6 + 2) e.done = true;
}
function endingInput() {
  const e = G.ending;
  if (e.kind === 'genocide' && e.choice) {
    if (dirPressed === 'left' || dirPressed === 'right') e.choice.index = 1 - e.choice.index;
    if (confirmPressed) { const pick = e.choice.index; e.choice = null; e.visible = pick === 0 ? ['…그래. 잘 가.'] : ['…', '뭐? 어차피 넌 선택권이 없어.', '"안 돼"라고 말한다고 될 줄 알았어?']; e.phase = 'erase'; e.t = 0; audio.effect('shatter'); shake(); }
    return;
  }
  if (e.done && confirmPressed) gotoTitle();
}
// 몰살 뒤 세계가 지워진 상태. 영혼을 넘기면 세계가 돌아온다.
function updateErased(dt) {
  const s = G.erased; s.t += dt;
  if (s.phase === 'dark' && s.t > 8) { s.phase = 'chara'; s.t = 0; s.lines = ['흥미롭군.', '이 세계를 되돌리고 싶니?', '그렇다면… 네 영혼을 내게 넘겨.', '그럼 이 세계를 다시 만들어 주지.', '…어때?']; s.next = 0; audio.play('judgement'); }
  if (s.phase === 'chara') { if (s.next < s.lines.length && s.t > s.next * 1.8 + .5) { s.visible.push(s.lines[s.next]); s.next++; audio.effect('text'); } if (s.next >= s.lines.length && !s.choice && s.t > s.lines.length * 1.8 + 1) s.choice = { options: ['넘긴다', '거부한다'], index: 1 }; }
}
function erasedInput() {
  const s = G.erased; if (!s.choice) return;
  if (dirPressed === 'left' || dirPressed === 'right') s.choice.index = 1 - s.choice.index;
  if (confirmPressed) { if (s.choice.index === 0) { meta.erased = false; meta.soulless = true; saveMeta(); s.visible = ['…좋아. 계약이 성립됐어.', '그럼, 다시 시작하자.']; s.choice = null; s.phase = 'accept'; s.t = 0; audio.effect('shatter'); setTimeout(() => gotoTitle(), 3000); } else { s.visible = ['…그래. 그럼 여기서 영원히 기다려.']; s.choice = null; s.phase = 'refuse'; s.t = 0; setTimeout(() => { s.phase = 'dark'; s.visible = []; s.t = 4; }, 3000); } }
}

// ---------- 입력 ----------
const DIR_KEYS = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
addEventListener('keydown', e => {
  if (e.repeat) { if (DIR_KEYS[e.code] && (G.mode === 'naming' || G.mode === 'shop' || G.mode === 'menu' || G.mode === 'warp' || G.mode === 'bossselect' || G.mode === 'lvselect')) dirPressed = DIR_KEYS[e.code]; return; }
  keys[e.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (DIR_KEYS[e.code]) dirPressed = DIR_KEYS[e.code];
  if (e.code === 'KeyZ' || e.code === 'Enter' || e.code === 'Space') { confirmPressed = true; if (e.code === 'Enter' && G.mode === 'naming') { confirmName(); confirmPressed = false; } }
  if (e.code === 'KeyX' || e.code === 'Escape' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') { if (e.code !== 'ShiftLeft' && e.code !== 'ShiftRight') cancelPressed = true; }
  if (e.code === 'KeyC' || e.code === 'ControlLeft') menuPressed = true;
  if (e.code === 'KeyM') toggleSound();
  if (/^[0-9]$/.test(e.key)) { codeBuffer = (codeBuffer + e.key).slice(-SECRET_CODE.length); if (codeBuffer === SECRET_CODE) { codeBuffer = ''; startSecretBattle(); } else if (codeBuffer.endsWith(LEVEL_CODE)) { codeBuffer = ''; cheatLevelUp(); } }
  if (e.code === 'Minus' || e.code === 'NumpadSubtract') { if (G.mode === 'overworld' && G.world && !G.world.request && !G.world.script) openWarp(); else if (G.mode === 'warp') { G.mode = 'overworld'; G.warp = null; } }
  if (e.code === 'Escape' && G.mode === 'battle' && G.battle) { G.battle.paused = !G.battle.paused; audio.pause(G.battle.paused); }
  if (!audio.enabled && meta.sound && !G.audioTried) { G.audioTried = true; audio.enable().then(ok => setSoundButton(ok)); }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { if (G.mode === 'battle' && G.battle && !G.battle.paused) { G.battle.paused = true; G.pausedByBlur = true; audio.pause(true); } for (const k in keys) keys[k] = false; });
addEventListener('focus', () => { if (G.pausedByBlur && G.battle) { G.battle.paused = false; G.pausedByBlur = false; audio.pause(false); } });
// 터치
for (const btn of document.querySelectorAll('.touch-controls button')) {
  const code = btn.dataset.key; const down = e => { e.preventDefault(); keys[code] = true; if (DIR_KEYS[code]) dirPressed = DIR_KEYS[code]; if (code === 'KeyZ') confirmPressed = true; if (code === 'KeyX') cancelPressed = true; if (code === 'KeyC') menuPressed = true; if (!audio.enabled && meta.sound) audio.enable().then(ok => setSoundButton(ok)); };
  const up = e => { e.preventDefault(); keys[code] = false; };
  btn.addEventListener('pointerdown', down); btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up); btn.addEventListener('pointerleave', up);
}
function inputOverworld() { return { left: keys.ArrowLeft || keys.KeyA, right: keys.ArrowRight || keys.KeyD, up: keys.ArrowUp || keys.KeyW, down: keys.ArrowDown || keys.KeyS, slow: keys.ShiftLeft || keys.ShiftRight }; }

// ---------- 화면 효과 ----------
const stage = document.getElementById('stage'), flashEl = document.getElementById('flash');
function shake() { if (reduceMotion) return; stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake'); }
function flash() { audio.effect('flash'); if (reduceMotion) return; flashEl.classList.add('on'); setTimeout(() => flashEl.classList.remove('on'), 80); }

// ---------- 소리·모달 ----------
const soundButton = document.getElementById('sound-button');
function setSoundButton(on) { soundButton.classList.toggle('on', on); soundButton.setAttribute('aria-label', on ? '소리 끄기' : '소리 켜기'); soundButton.title = on ? '소리 끄기 (M)' : '소리 켜기 (M)'; }
async function toggleSound() { if (audio.enabled) { audio.disable(); meta.sound = false; setSoundButton(false); } else { const ok = await audio.enable(); meta.sound = ok; setSoundButton(ok); if (ok && G.mode === 'title') audio.play('title'); } saveMeta(); }
soundButton.addEventListener('click', toggleSound);
document.getElementById('fullscreen-button').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else stage.requestFullscreen?.(); });
const modal = document.getElementById('modal');
function showGuide() {
  document.getElementById('modal-content').innerHTML = `<p>언더테일 팬 게임입니다. 지하 세계에 떨어진 인간이 되어 폐허, 설원, 폭포, 열지대를 지나 왕의 성까지 갑니다.</p><ul><li><b>이동</b> 방향키 / WASD · <b>확인·대화</b> Z / Enter · <b>취소</b> X · <b>메뉴</b> C</li><li><b>전투</b> 공격(타이밍 바 중앙에서 Z), 행동(대화로 몬스터를 달래기), 아이템, 자비(이름이 <span style="color:#ffe000">노란색</span>이면 살려줄 수 있음)</li><li><b>영혼</b> 빨강: 자유 이동 · 파랑: 중력, ↑로 점프 · 초록: 방향키로 방패를 돌려 화살 막기</li><li><b>파란 탄막</b>은 멈추면 안 맞고, <b>주황 탄막</b>은 움직이면 안 맞습니다.</li><li><b>세이브</b> 반짝이는 별에서 Z. 죽으면 마지막 세이브로 돌아갑니다.</li></ul><p>아무도 죽이지 않으면 <b>불살</b>, 지역마다 아무도 오지 않을 때까지 죽이면 <b>몰살</b>, 그 사이는 <b>중립</b> 결말입니다.</p>`;
  document.getElementById('modal-actions').innerHTML = '<button class="primary" id="modal-close">알겠어</button>';
  modal.hidden = false; document.getElementById('modal-close').addEventListener('click', () => { modal.hidden = true; }); document.getElementById('modal-close').focus();
}
document.getElementById('help-button').addEventListener('click', showGuide);
document.getElementById('guide-link').addEventListener('click', showGuide);

// ---------- 제너릭 입력 처리 ----------
function titleInput() {
  const s = G.title; const n = s.options.length;
  if (dirPressed === 'up') { s.index = (s.index - 1 + n) % n; audio.effect('cancel'); } if (dirPressed === 'down') { s.index = (s.index + 1) % n; audio.effect('cancel'); }
  if (confirmPressed) { const o = s.options[s.index]; audio.effect('select'); if (o.id === 'continue') continueGame(); else if (o.id === 'new') { if (s.save) { s.confirmNew = true; openText(null, ['정말 새로 시작할까? 기존 세이브 파일이 지워진다.'], idx => { if (idx === 0) startNaming(); else gotoTitle(); }, { mode: 'titletext', top: true }); G.textbox.choice = { options: ['새로 시작', '취소'], index: 1 }; } else startNaming(); } else showGuide(); }
}
function namingInput() {
  const s = G.naming; const rows = s.keys.length;
  if (dirPressed === 'up') s.row = (s.row - 1 + rows) % rows; if (dirPressed === 'down') s.row = (s.row + 1) % rows;
  const cols = s.keys[s.row].length; s.col = Math.min(s.col, cols - 1);
  if (dirPressed === 'left') s.col = (s.col - 1 + cols) % cols; if (dirPressed === 'right') s.col = (s.col + 1) % cols;
  if (confirmPressed) { if (s.name.length < 8) { s.name += s.keys[s.row][s.col]; audio.effect('text'); } else s.message = '이름은 8글자까지.'; }
  if (cancelPressed) { s.name = s.name.slice(0, -1); audio.effect('cancel'); }
}
function confirmInput() {
  const s = G.confirm;
  if (dirPressed === 'left' || dirPressed === 'right') s.index = 1 - s.index;
  if (confirmPressed) { if (s.index === 1 && !s.forbidden) { audio.effect('select'); newGame(s.name); } else { audio.effect('cancel'); startNaming(); } }
  if (cancelPressed) startNaming();
}
function textboxInput() {
  const tb = G.textbox; if (!tb) return;
  if (tb.choice && tb.shown >= tb.lines[tb.index].length) { if (dirPressed === 'left' || dirPressed === 'right') tb.choice.index = 1 - tb.choice.index; }
  if (confirmPressed) { advanceTextbox(); audio.effect('select'); }
  else if (cancelPressed) { tb.shown = tb.lines[tb.index].length; }
}

// ---------- 메인 루프 ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; G.t += dt;
  // 입력 처리
  switch (G.mode) {
    case 'title': titleInput(); break;
    case 'titletext': textboxInput(); if (!G.textbox && G.mode === 'overworld') G.mode = 'title'; break;
    case 'naming': namingInput(); break;
    case 'confirmName': confirmInput(); break;
    case 'overworld': if (G.world.request) handleWorldRequest(); else { if (confirmPressed) Wd.interact(G.world); if (menuPressed && !G.world.script) openMenu(); } break;
    case 'textbox': textboxInput(); break;
    case 'battle': battleInput(); break;
    case 'shop': shopInput(); break;
    case 'menu': menuInput(); break;
    case 'warp': warpInput(); break;
    case 'bossselect': bossSelectInput(); break;
    case 'lvselect': lvSelectInput(); break;
    case 'gameover': gameoverInput(); break;
    case 'ending': endingInput(); break;
    case 'erased': erasedInput(); break;
  }
  confirmPressed = false; cancelPressed = false; menuPressed = false; dirPressed = null;
  // 업데이트
  if (G.mode === 'overworld') { Wd.update(G.world, dt, inputOverworld()); if (G.world.request) handleWorldRequest(); }
  if (G.mode === 'textbox' || G.mode === 'titletext') { const tb = G.textbox; if (tb) { const before = Math.floor(tb.shown); tb.shown = Math.min(tb.lines[tb.index].length, tb.shown + dt * (keys.KeyX ? 90 : 28)); if (Math.floor(tb.shown) !== before && Math.floor(tb.shown) % 2 === 0) audio.effect('text'); } }
  if (G.mode === 'wait') { G.wait.t -= dt; if (G.world) Wd.update(G.world, dt, {}); if (G.wait.t <= 0) { const r = G.wait.resolve; G.wait = null; G.mode = 'overworld'; r(); if (G.world.request) handleWorldRequest(); } }
  if (G.mode === 'battle') updateBattle(dt);
  if (G.mode === 'gameover') G.gameover.t += dt;
  if (G.mode === 'ending') updateEnding(dt);
  if (G.mode === 'erased') updateErased(dt);
  if (G.mode === 'battle' && G.battle && G.battle.mode === 'text' && G.battle.text) { /* 타자 효과는 core가 처리 */ }
  // 렌더
  render();
  requestAnimationFrame(frame);
}
function render() {
  switch (G.mode) {
    case 'title': R.drawTitle(ctx, G.t, G.title); break;
    case 'titletext': R.drawTitle(ctx, G.t, G.title); if (G.textbox) R.drawTextbox(ctx, G.textbox, G.t, { top: true }); break;
    case 'naming': R.drawNaming(ctx, G.t, G.naming); break;
    case 'confirmName': R.drawConfirmName(ctx, G.t, G.confirm); break;
    case 'overworld': case 'wait': R.drawOverworld(ctx, G.world, G.t, { chara: G.player.flags.soulless && C.routeFor(G.player, G.world.room.area) === 'genocide' }); break;
    case 'textbox': R.drawOverworld(ctx, G.world, G.t, {}); R.drawTextbox(ctx, G.textbox, G.t, { top: G.textbox.top }); break;
    case 'battle': R.drawBattle(ctx, G.battle, G.t); break;
    case 'shop': R.drawShop(ctx, G.t, G.shop, G.player); break;
    case 'menu': R.drawOverworld(ctx, G.world, G.t, {}); R.drawMenu(ctx, G.t, G.menu, G.player, G.world); break;
    case 'warp': R.drawOverworld(ctx, G.world, G.t, {}); R.drawWarp(ctx, G.warp, Wd.ROOM_NAMES); break;
    case 'bossselect': R.drawOverworld(ctx, G.world, G.t, {}); R.drawBossSelect(ctx, G.t, G.bossSelect, SECRET_BOSSES); break;
    case 'lvselect': R.drawOverworld(ctx, G.world, G.t, {}); R.drawLevelSelect(ctx, G.lvSelect, LEVEL_STEPS, G.player); break;
    case 'gameover': R.drawGameOver(ctx, G.gameover.t, G.gameover); break;
    case 'ending': R.drawEnding(ctx, G.t, G.ending); break;
    case 'erased': { const s = G.erased; R.clear(ctx, '#000'); if (s.phase !== 'dark') { R.drawEnding(ctx, G.t, { kind: 'genocide', phase: 'chara', visible: s.visible, choice: s.choice }); } break; }
  }
}

// ---------- 자동화용 인터페이스 ----------
window.render_game_to_text = () => JSON.stringify({ mode: G.mode, player: G.player ? { name: G.player.name, hp: G.player.hp, maxHp: G.player.maxHp, lv: G.player.lv, exp: G.player.exp, gold: G.player.gold, kills: G.player.kills, items: G.player.items, route: C.routeFor(G.player, G.world?.room.area), hard: !!G.player.flags.hard } : null,
  world: G.world ? { room: G.world.room.id, x: Math.round(G.world.x), y: Math.round(G.world.y), request: G.world.request?.type || null, script: G.world.script?.name || null } : null,
  textbox: G.textbox ? { who: G.textbox.who, line: G.textbox.lines[G.textbox.index], choice: G.textbox.choice?.options || null } : null,
  battle: G.battle ? C.summarize(G.battle) : null, ending: G.ending ? { kind: G.ending.kind, done: G.ending.done, phase: G.ending.phase || null, choice: !!G.ending.choice } : null, erasedChoice: !!G.erased?.choice, erased: meta.erased, soulless: meta.soulless, endings: meta.endings });
window.__undertale = { G, C, Wd, meta, audio, newGame, startEnding };

// ---------- 시작 ----------
if (meta.erased) { G.erased = { t: 0, phase: 'dark', visible: [], choice: null }; G.mode = 'erased'; } else gotoTitle();
setSoundButton(false);
requestAnimationFrame(frame);
