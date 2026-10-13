// SANS · 심판의 회랑: 전투 흐름과 규칙을 상태 기계로 끝까지 돌려 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../public/play/sans/core.mjs';
import * as L from '../../public/play/sans/lines.mjs';
import { gameAt } from './bot.mjs';

const newGame = (level = 1, seed = 5, meta = C.createMeta()) => { meta.level = level; if (level === 3) meta.best.normal ??= { ending: 'kill' }; return C.createGame(meta, seed); };
const step = (g, seconds, held = {}) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) C.tick(g, 1 / 60, held); };
const settle = g => { for (let i = 0; i < 600 && ['talk', 'text', 'cine'].includes(g.mode); i++) { if (g.mode === 'cine') step(g, .1); else C.press(g, 'confirm'); } };
// 샌즈의 차례를 버틴다: HP를 채워 가며 끝날 때까지 흘려보낸다.
const survive = g => { let n = 0; while (g.mode === 'dodge' && !['nothing', 'asleep'].includes(g.phase) && n++ < 4000) { g.hp = g.maxHp; g.kr = 0; step(g, 1 / 60); } };
const fight = g => { g.menu = 0; C.press(g, 'confirm'); C.press(g, 'confirm'); assert.equal(g.mode, 'fightbar'); step(g, .5); C.press(g, 'confirm'); assert.equal(g.mode, 'strike'); step(g, C.STRIKE_TIME + .05); };
const pick = (g, button, index = 0) => { g.menu = C.BUTTONS.findIndex(b => b.id === button); C.press(g, 'confirm'); assert.equal(g.mode, 'submenu'); g.submenu.index = index; C.press(g, 'confirm'); };
const open = (level = 1, meta) => { const g = newGame(level, 5, meta); C.press(g, 'confirm'); settle(g); return g; };
const toMenu = (level = 1, meta) => { const g = open(level, meta); survive(g); settle(g); assert.equal(g.mode, 'menu'); return g; };
const toOffer = (level = 1, meta) => {
  const g = toMenu(level, meta);
  for (const name of C.ORDER.p1) { fight(g); assert.equal(g.mode, 'talk'); settle(g); assert.equal(g.attack.name, name); survive(g); assert.equal(g.mode, 'menu'); }
  fight(g); assert.equal(g.talk.lines, L.OFFER); settle(g); assert.equal(g.phase, 'offer'); assert.equal(g.mode, 'menu');
  return g;
};
const toSpecial = (level = 1, meta) => {
  const g = toOffer(level, meta);
  for (let i = 0; i < C.ORDER.p2.length; i++) { fight(g); settle(g); assert.equal(g.attack.name, C.ORDER.p2[i]); survive(g); assert.equal(g.mode, 'menu'); }
  fight(g); assert.equal(g.talk.lines, L.SPECIAL_INTRO); settle(g); assert.equal(g.attack.name, 'special');
  return g;
};
const bone = (g, extra = {}) => g.bullets.push({ id: 900 + g.bullets.length, kind: 'bone', x: g.soul.x, y: g.soul.y, w: 10, h: 30, vx: 0, vy: 0, age: 0, ttl: 99, color: 'white', ...extra });

test('2막부터 공격 시작과 중간마다 암전하고, 가려진 동안 이동·탄막·업보가 멈춘다', () => {
  for (const name of [...C.ORDER.p2, ...C.ORDER.fill2, 'special']) {
    const g = gameAt(name);
    assert.ok(g.blackout > 0, name);
    g.hp = 50; g.kr = 10; g.krClock = .1;
    bone(g, { vx: 80 });
    const frozen = { t: g.attack.t, soul: structuredClone(g.soul), bullets: structuredClone(g.bullets) };
    step(g, .2, { left: true, up: true });
    assert.equal(g.attack.t, frozen.t, name);
    assert.deepEqual(g.soul, frozen.soul, name);
    assert.deepEqual(g.bullets, frozen.bullets, name);
    assert.equal(g.hp, 50); assert.equal(g.kr, 10);
    assert.equal(g.krClock, .1); assert.equal(g.stats.ticks, 0);
    g.bullets = []; g.kr = 0;
    let cuts = 0, wasBlack = true;
    while (g.mode === 'dodge') {
      g.hp = 92; g.kr = 0; C.tick(g, 1 / 60);
      if (g.blackout > 0 && !wasBlack) cuts++;
      wasBlack = g.blackout > 0;
    }
    assert.ok(cuts >= 2, `${name}: 중간 암전 ${cuts}회`);
  }
  for (const name of ['opening', ...C.ORDER.p1, ...C.ORDER.fill1, 'nothing']) {
    const g = gameAt(name); assert.equal(g.blackout, 0, name);
  }
});

test('암전에서 다시 보인 직후에는 HP 1이어도 반응할 여유가 있다', () => {
  const g = gameAt('chase', 3);
  g.hp = 1; bone(g);
  while (g.blackout > 0) C.tick(g, 1 / 60);
  step(g, .1);
  assert.equal(g.hp, 1); assert.equal(g.stats.ticks, 0);
  step(g, .15);
  assert.equal(g.mode, 'gameover');
});

test('암전과 새 패턴 등장에 효과음이 한 번씩 나오며, 멈춘 동안에는 나오지 않는다', () => {
  const g = gameAt('chase'); g.events = [];
  while (g.blackout > 0) C.tick(g, 1 / 60);
  assert.equal(g.events.filter(e => e.name === 'materialize').length, 1);
  g.events = []; g.attack.t = 1.95;
  C.tick(g, 1 / 60); assert.ok(g.blackout > 0);
  assert.equal(g.events.filter(e => e.name === 'teleport').length, 1);
  g.paused = true; step(g, 1);
  assert.equal(g.events.filter(e => e.name === 'materialize').length, 0);
  g.paused = false; step(g, .6);
  assert.equal(g.events.filter(e => e.name === 'materialize').length, 1);
});

test('암전마다 실제 공격 패턴을 교체하고, 이전 탄막과 발판은 남지 않는다', () => {
  for (const name of [...C.ORDER.p2, ...C.ORDER.fill2, 'special'].filter(n => C.PATTERNS[n].sequence)) {
    const g = gameAt(name), sequence = C.PATTERNS[name].sequence;
    let previous = g.attack.segment.name, switches = 0;
    while (g.mode === 'dodge') {
      g.hp = 92; g.kr = 0;
      const oldIds = g.bullets.map(b => b.id), story = g.story;
      C.tick(g, 1 / 60);
      if (g.attack && g.attack.segment.name !== previous) {
        assert.ok(g.blackout > 0, name);
        assert.equal(g.story, story, '패턴만 바뀌고 이야기 차례는 그대로');
        assert.ok(g.bullets.every(b => !oldIds.includes(b.id)), '이전 탄막 제거');
        assert.equal(g.attack.segment.t, 0);
        if (!C.PATTERNS[g.attack.segment.name].setup) assert.deepEqual(g.attack.segment.memo, {});
        previous = g.attack.segment.name; switches++;
      }
    }
    assert.equal(switches, sequence.length - 1, name);
    assert.equal(g.story, name === 'special' ? 0 : 1, name);
  }
});

test('새 암전 패턴은 실제 탄막을 내보내고, 천장 중력은 아래로 점프한다', () => {
  for (const name of ['verticalTunnel', 'blueCross', 'cornerBeams', 'ceilingHops', 'finalSpiral']) {
    const g = gameAt(name); step(g, .7);
    assert.ok(g.bullets.length > 0, `${name}: 탄막이 보인다`);
    if (name === 'blueCross') assert.ok(g.bullets.every(b => b.color === 'blue'));
    if (name === 'cornerBeams') assert.equal(g.bullets[0].kind, 'gb');
    if (name === 'ceilingHops') {
      assert.equal(g.soul.gravity, 'up');
      const y = g.soul.y; step(g, .1, { down: true }); assert.ok(g.soul.y > y);
    }
  }
});

test('시작하면 대사 뒤에 플레이어 차례 없이 첫 공격이 날아온다', () => {
  const g = newGame(); assert.equal(g.mode, 'title');
  C.press(g, 'right'); assert.equal(C.diff(g).id, 'hard'); C.press(g, 'left'); C.press(g, 'left'); assert.equal(C.diff(g).id, 'easy'); C.press(g, 'right');
  C.press(g, 'confirm'); assert.equal(g.mode, 'cine'); step(g, 1.6); assert.equal(g.mode, 'talk'); assert.equal(g.talk.lines, L.INTRO);
  settle(g); assert.equal(g.mode, 'dodge'); assert.equal(g.attack.name, 'opening'); assert.equal(g.soul.mode, 'blue'); assert.equal(g.stats.turns, 1);
  survive(g); assert.equal(g.mode, 'talk'); assert.equal(g.talk.lines, L.AFTER_OPENING); settle(g); assert.equal(g.mode, 'menu'); assert.equal(g.phase, 'p1');
  assert.ok(g.events.some(e => e.type === 'music' && e.name === 'p1'));
});

test('공격은 전부 빗나가고, 공격할 때만 이야기와 공격 순서가 나아간다', () => {
  const g = toMenu();
  fight(g); assert.equal(g.dodges, 1); assert.equal(g.talk.lines, L.P1[0]); settle(g); assert.equal(g.attack.name, C.ORDER.p1[0]); survive(g); assert.equal(g.story, 1);
  // 조사: 차례는 넘어가지만 이야기는 제자리, 짧은 공격이 온다
  pick(g, 'act', 0); assert.equal(g.mode, 'text'); settle(g); assert.ok(C.ORDER.fill1.includes(g.attack.name)); survive(g); assert.equal(g.story, 1);
  // 농담: 샌즈가 한마디 받아친 뒤 공격한다
  pick(g, 'act', 1); C.press(g, 'confirm'); C.press(g, 'confirm'); assert.equal(g.mode, 'talk'); assert.deepEqual(g.talk.lines, [L.JOKES[0].reply]); settle(g); assert.equal(g.mode, 'dodge'); survive(g);
  fight(g); assert.equal(g.talk.lines, L.P1[1]); settle(g); assert.equal(g.attack.name, C.ORDER.p1[1]);
});

test('아이템은 HP를 채우고 가방에서 사라지며 한 차례를 쓴다', () => {
  const g = toMenu(); g.hp = 30; const count = g.items.length;
  pick(g, 'item', g.items.indexOf('steak')); assert.equal(g.hp, 90); assert.equal(g.items.length, count - 1); assert.ok(!g.items.includes('steak'));
  assert.equal(g.text.lines[0], '* 철판 스테이크를 먹었다.'); settle(g); assert.equal(g.mode, 'dodge'); survive(g);
  g.hp = 80; pick(g, 'item', g.items.indexOf('pie')); assert.equal(g.hp, 92); assert.equal(g.text.lines[1], '* HP가 가득 찼다.');
  assert.equal(L.objectParticle('눈사람 조각'), '을'); assert.equal(L.objectParticle('반짝 버거'), '를');
});

test('업보(KR): 스치면 HP 1과 KR이 쌓이고, KR은 HP를 갉아먹되 죽이지는 않는다', () => {
  const g = gameAt('nothing'); g.bullets = []; bone(g);
  step(g, 1 / 60); assert.equal(g.hp, 91); assert.equal(g.kr, 1); assert.equal(g.stats.hits, 1);
  step(g, .5); assert.ok(g.stats.ticks >= 9 && g.stats.ticks <= 11, `0.5초 동안 ${g.stats.ticks}번`); assert.equal(g.stats.hits, 1, '이어진 접촉은 한 번으로 센다');
  g.bullets = []; const hp = g.hp, kr = g.kr; step(g, 3); assert.ok(g.hp < hp); assert.ok(g.kr < kr);
  g.hp = 5; g.kr = 40; step(g, 6); assert.equal(g.hp, 1); assert.equal(g.kr, 0); assert.equal(g.mode, 'dodge');
  bone(g); step(g, 1 / 60); assert.equal(g.mode, 'gameover'); assert.equal(g.meta.deaths, 1);
  // 어려움에서는 KR이 두 배로 쌓인다
  const hard = gameAt('nothing', 2); hard.bullets = []; bone(hard); step(hard, 1 / 60); assert.equal(hard.kr, 2);
});

test('파란 뼈는 가만히 있으면 지나가고, 움직이면 다친다', () => {
  const g = gameAt('nothing'); g.bullets = []; bone(g, { color: 'blue', h: 200 });
  step(g, .5); assert.equal(g.hp, 92);
  step(g, .1, { left: true }); assert.ok(g.hp < 92);
});

test('파란 영혼: 네 방향 중력, 길게 누르면 높이 뛰고, 내리꽂히면 쿵 소리가 난다', () => {
  const peak = hold => {
    const g = gameAt('nothing'); const box = g.box; Object.assign(box, { w: 200, h: 200, tw: 200, th: 200, y: 290, ty: 290 });
    Object.assign(g.soul, { mode: 'blue', gravity: 'down', x: 320, y: 300, va: 0, grounded: false }); step(g, .6);
    const floor = g.soul.y; assert.ok(g.soul.grounded); assert.equal(floor, 390 - C.SOUL_HALF);
    let top = floor; for (let i = 0; i < 70; i++) { C.tick(g, 1 / 60, { up: i < hold }); top = Math.min(top, g.soul.y); }
    return floor - top;
  };
  const tap = peak(2), full = peak(60); assert.ok(tap < 22, `살짝 ${tap}`); assert.ok(full > 68 && full < 82, `길게 ${full}`);
  for (const [gravity, key, axis, wall] of [['up', 'down', 'y', 190 + C.SOUL_HALF], ['left', 'right', 'x', 220 + C.SOUL_HALF], ['right', 'left', 'x', 420 - C.SOUL_HALF]]) {
    const g = gameAt('nothing'); Object.assign(g.box, { w: 200, h: 200, tw: 200, th: 200, y: 290, ty: 290 });
    Object.assign(g.soul, { mode: 'blue', gravity, x: 320, y: 290, va: 900, grounded: false, slam: true }); g.events.length = 0;
    step(g, .4); assert.equal(g.soul[axis], wall, gravity); assert.ok(g.soul.grounded); assert.ok(g.events.some(e => e.name === 'slam'), gravity + ' 쿵');
    step(g, .2, { [key]: true }); assert.notEqual(g.soul[axis], wall, gravity + ' 점프');
  }
});

test('발판: 위에서 내려앉으면 올라서고, 발판이 움직이면 같이 실려 간다', () => {
  const g = gameAt('platforms'); const soul = g.soul, plat = g.bullets.find(b => b.kind === 'plat' && Math.abs(b.x - soul.x) < 5);
  assert.ok(plat); step(g, .3); assert.ok(soul.grounded); assert.equal(soul.plat, plat.id); assert.equal(soul.y, plat.y - C.SOUL_HALF);
  const x = soul.x; step(g, .5); assert.ok(soul.x < x - 30, '왼쪽으로 실려 간다'); assert.equal(soul.moving, false, '실려 가는 건 움직인 게 아니다');
  step(g, 1.2); assert.ok(g.bullets.some(b => b.kind === 'sea' && b.cur > 15), '바닥에 뼈 바다');
});

test('제안: 기다려 주는 동안은 공격이 없고, 자비를 고르면 속는다', () => {
  const g = toOffer(); assert.equal(L.FLAVOR.offer[0], g.flavor);
  pick(g, 'act', 0); settle(g); assert.equal(g.mode, 'menu', '조사해도 공격이 오지 않는다'); assert.equal(g.phase, 'offer');
  pick(g, 'mercy', 0); assert.equal(g.talk.lines, L.DUNK); settle(g); assert.equal(g.attack.name, 'dunk');
  step(g, 2); assert.equal(g.mode, 'gameover'); assert.equal(g.over.dunk, true); assert.equal(g.over.lines, L.GAMEOVER_DUNK); assert.equal(g.meta.dunked, true);
  assert.deepEqual(g.over.options.map(o => o.id), ['start', 'title']);
  // 다시 도전하면 샌즈가 방금 일을 놀린다
  step(g, 2); C.press(g, 'confirm'); assert.equal(g.mode, 'cine'); step(g, 1.6); assert.equal(g.talk.lines[0][0], '…푸흡.'); assert.equal(g.meta.dunked, false);
});

test('제안을 거절하면 2막. 보통은 2막부터 이어서, 어려움은 처음부터', () => {
  const g = toOffer(1); g.items = ['pie', 'bunny'];
  fight(g); assert.equal(g.talk.lines, L.P2[0]); settle(g); assert.equal(g.phase, 'p2'); assert.equal(g.attack.name, C.ORDER.p2[0]); assert.deepEqual(g.checkpoint, { at: 'p2', items: ['pie', 'bunny'] });
  step(g, .6); g.soul.inv = 0; g.hp = 1; g.kr = 0; bone(g); step(g, 1 / 60); assert.equal(g.mode, 'gameover'); assert.deepEqual(g.over.options.map(o => o.id), ['checkpoint', 'start', 'title']);
  step(g, 2); C.press(g, 'confirm'); step(g, 1.6); assert.equal(g.talk.lines, L.RESUME.p2); settle(g);
  assert.equal(g.phase, 'p2'); assert.equal(g.attack.name, C.ORDER.p2[0]); assert.equal(g.hp, 92); assert.deepEqual(g.items, ['pie', 'bunny']); assert.equal(g.session.deaths, 1);
  // 연습: 아이템이 돌아오고 특별 공격 앞에도 이어하기 지점이 있다
  const easy = toSpecial(0); assert.equal(easy.checkpoint.at, 'special'); easy.items = [];
  step(easy, .6); easy.soul.inv = 0; easy.hp = 1; easy.kr = 0; bone(easy); step(easy, 1 / 60); step(easy, 2); assert.equal(easy.over.options[0].label, '특별 공격부터'); C.press(easy, 'confirm'); step(easy, 1.6); settle(easy);
  assert.equal(easy.attack.name, 'special'); assert.equal(easy.items.length, L.BAG.length);
  // 어려움: 이어하기 없음
  const hard = toOffer(2); fight(hard); settle(hard); assert.equal(hard.checkpoint, null);
});

test('2막의 메뉴에서는 뼈가 버튼 위를 지나간다 (연습에서는 없다)', () => {
  const g = toOffer(1); fight(g); settle(g); survive(g); fight(g); settle(g); survive(g); assert.equal(g.story, 2); assert.equal(g.mode, 'menu');
  g.menu = 1; step(g, 1.5); assert.equal(g.menuBones.length, 1); const hp = g.hp;
  let n = 0; while (g.menuBones.length && n++ < 600) step(g, 1 / 60);
  assert.ok(g.hp < hp, '고르고 있던 버튼 위로 지나가면 다친다');
  // 뼈가 올 때 옆 버튼으로 피하면 안 다친다
  g.hp = 92; g.kr = 0; n = 0; while (!g.menuBones.length && n++ < 600) step(g, 1 / 60);
  const safe = () => [0, 1, 2, 3].find(i => g.menuBones.every(b => Math.abs(b.x - C.cursorX({ menu: i })) > 30));
  n = 0; while (g.menuBones.length && n++ < 900) { g.menu = safe(); step(g, 1 / 60); }
  assert.equal(g.kr, 0); assert.equal(g.hp, 92);
  const easy = toOffer(0); fight(easy); settle(easy); survive(easy); fight(easy); settle(easy); survive(easy); step(easy, 4); assert.equal(easy.menuBones.length, 0);
});

test('특별 공격 뒤: 아무 일도 없는 차례 → 잠 → 상자를 공격 쪽으로 밀어 끝낸다', () => {
  const meta = C.createMeta(); meta.deaths = 3; const g = toSpecial(1, meta);
  survive(g); assert.equal(g.talk.lines, L.NOTHING_INTRO); settle(g); assert.equal(g.phase, 'nothing'); assert.equal(g.attack.name, 'nothing');
  C.press(g, 'confirm'); assert.equal(g.mode, 'dodge', '깨어 있을 때는 아무 일도 없다');
  step(g, C.diff(g).sleep / 2); assert.ok(g.bubbleIndex >= 2); step(g, C.diff(g).sleep / 2 + .2); assert.equal(g.phase, 'asleep'); assert.equal(g.sans.face, 'sleep');
  step(g, 6, { left: true }); assert.equal(g.push, 'fight'); assert.equal(g.box.x, C.PUSH_MIN);
  C.press(g, 'confirm'); assert.equal(g.cine.kind, 'final'); step(g, 1.5); assert.equal(g.bubble.text, L.WAKE_LINE); assert.equal(g.sans.gash, false, '첫 칼은 피한다');
  step(g, 1); assert.equal(g.sans.gash, true); step(g, 1.6); assert.equal(g.talk.lines, L.DEATH); settle(g);
  assert.equal(C.hardUnlocked(g), true); assert.equal(g.result.unlockedHard, true);
  assert.equal(C.hardUnlocked(C.createGame(JSON.parse(JSON.stringify(g.meta)))), true);
  assert.equal(g.mode, 'won'); assert.equal(g.ended, 'kill'); assert.equal(g.sans.hidden, true);
  assert.equal(g.meta.endings.kill, true); assert.equal(g.meta.deaths, 0, '끝까지 가면 샌즈의 셈이 처음으로 돌아간다'); assert.equal(g.result.record, true); assert.equal(g.meta.best.normal.ending, 'kill');
  step(g, 3); C.press(g, 'confirm'); assert.equal(g.mode, 'title');
});

test('잠든 샌즈 앞에서 자비 쪽으로 밀면 다른 결말', () => {
  const g = gameAt('nothing'); g.phase = 'nothing'; step(g, C.diff(g).sleep + .5); assert.equal(g.phase, 'asleep');
  step(g, 6, { right: true }); assert.equal(g.push, 'mercy'); assert.equal(g.box.x, C.PUSH_MAX);
  C.press(g, 'confirm'); assert.equal(g.cine.kind, 'lower'); step(g, 2.4); assert.equal(g.text.lines, L.MERCY_NOTES); C.press(g, 'confirm'); C.press(g, 'confirm'); C.press(g, 'confirm'); C.press(g, 'confirm');
  assert.equal(g.talk.lines, L.MERCY_TALK); assert.equal(g.sans.face, 'sleep'); C.press(g, 'confirm'); C.press(g, 'confirm'); assert.equal(g.sans.face, 'wink'); assert.equal(g.sans.asleep, false);
  settle(g); assert.equal(g.ended, 'mercy'); assert.equal(g.meta.endings.mercy, true); assert.equal(g.sans.gash, false);
});

test('하드모드: HP 1, 아이템 없음, 이어하기에서도 회복 아이템이 돌아오지 않는다', () => {
  const level = C.DIFFICULTIES.findIndex(d => d.id === 'hp1'); assert.equal(C.DIFFICULTIES[level].name, '하드모드'); assert.equal(C.DIFFICULTIES[level].tempo, C.DIFFICULTIES[1].tempo);
  const g = newGame(level); C.press(g, 'confirm'); assert.equal(g.hp, 1); assert.equal(g.maxHp, 92); assert.deepEqual(g.items, []);
  step(g, 1.6); assert.deepEqual(g.talk.lines.slice(-3, -1), L.ONE_HP, '샌즈가 HP 1을 알아본다'); assert.equal(g.talk.lines.length, L.INTRO.length + L.ONE_HP.length);
  settle(g); assert.equal(g.attack.name, 'opening'); assert.equal(g.hp, 1);
  // 첫 공격의 가시에 스치면 바로 끝
  step(g, 1); assert.equal(g.mode, 'gameover'); assert.equal(g.meta.deaths, 1);
  // 아이템 메뉴에는 회복할 수 있는 선택지가 없다.
  const h = toMenu(level); h.hp = 1; h.kr = 0; assert.deepEqual(h.items, []);
  h.menu = 2; C.press(h, 'confirm'); assert.equal(h.mode, 'text'); assert.match(h.text.lines[0], /아이템을 쓸 수 없다/); assert.equal(h.hp, 1);
  // 2막부터 이어서 도전할 때도 HP 1에서 시작한다
  const p = toOffer(level); fight(p); settle(p); assert.equal(p.checkpoint.at, 'p2'); step(p, .6); p.soul.inv = 0; p.hp = 1; p.kr = 0; bone(p); step(p, 1 / 60); assert.equal(p.mode, 'gameover');
  p.checkpoint.items = ['pie']; // 예전 버전의 가방이 남아 있어도 비운다.
  step(p, 2); C.press(p, 'confirm'); assert.equal(p.hp, 1); assert.deepEqual(p.items, []); step(p, 1.6); settle(p); assert.equal(p.attack.name, C.ORDER.p2[0]); assert.equal(p.hp, 1);
});

test('샌즈는 몇 번 졌는지 기억한다', () => {
  assert.equal(L.retryIntro(0), L.INTRO);
  assert.match(L.retryIntro(1)[1][0], /한 번/); assert.match(L.retryIntro(5)[0][0], /다섯 번/); assert.match(L.retryIntro(7)[0][0], /7번째/); assert.match(L.retryIntro(10)[0][0], /열 번/); assert.match(L.retryIntro(23)[0][0], /23번째/);
  const meta = C.createMeta(); meta.deaths = 2; const g = open(1, meta); assert.equal(g.attack.name, 'opening'); survive(g); assert.equal(g.talk.lines, L.AFTER_OPENING_AGAIN);
});

test('모든 공격은 세 난이도에서 예외 없이 돌고, 상태는 언제든 복제할 수 있다', () => {
  const names = ['opening', ...C.ORDER.p1, ...C.ORDER.p2, 'special', ...C.ORDER.fill1, ...C.ORDER.fill2];
  for (const name of names) assert.ok(C.PATTERNS[name], name);
  for (const level of [0, 1, 2]) for (const name of names) {
    const g = gameAt(name, level, 11); let spawned = 0, frames = 0, darkFrames = 0;
    while (g.mode === 'dodge' && g.attack?.name === name && frames++ < 60 * 120) {
      if (g.blackout > 0) darkFrames++;
      g.hp = g.maxHp; g.kr = 0; C.tick(g, 1 / 60, { left: frames % 90 < 40, up: frames % 50 < 20, right: frames % 90 > 60 }); spawned = Math.max(spawned, g.bullets.length);
      if (frames % 120 === 0) structuredClone(g);
    }
    assert.ok(spawned > 0, `${name} 탄막`); assert.notEqual(g.mode, 'dodge', `${name} 은 끝난다`);
    const expected = C.PATTERNS[name].dur / (C.DIFFICULTIES[level].tempo * (name === 'special' ? (level === 0 ? 1.08 : 1.18) : 1)); assert.ok(Math.abs((frames - darkFrames) / 60 - expected) < .3, `${name} L${level}: ${frames / 60}초, 기대 ${expected}초`);
  }
});


test('히든 하트: 타이틀에서 세 번 말을 걸어야 열리고 모든 일반 난이도는 HP 180', () => {
  for (let level = 0; level < 3; level++) {
    const g = newGame(level);
    C.press(g, 'cancel'); C.press(g, 'cancel');
    assert.equal(g.meta.hiddenHeart, false); assert.equal(g.hp, 92);
    C.press(g, 'cancel');
    assert.equal(g.mode, 'title'); assert.equal(g.meta.hiddenHeart, true);
    assert.equal(g.hp, 180); assert.equal(g.maxHp, 180);
    assert.equal(g.events.filter(e => e.type === 'save').length, 1);
    C.press(g, 'cancel'); assert.equal(g.events.filter(e => e.type === 'save').length, 1);
    C.press(g, 'confirm'); assert.equal(g.hp, 180); assert.equal(g.maxHp, 180);
    step(g, 1.6); assert.ok(g.talk.lines.some(([line]) => line.includes('180')));
    const restored = newGame(level, 5, JSON.parse(JSON.stringify(g.meta)));
    C.begin(restored); assert.equal(restored.hp, 180); assert.equal(restored.maxHp, 180);
    restored.checkpoint = { at: 'p2', items: ['pie'] }; restored.hp = 12;
    C.begin(restored, 'checkpoint'); assert.equal(restored.hp, 180); assert.equal(restored.maxHp, 180);
    C.begin(restored, 'start'); assert.equal(restored.hp, 180);
  }
});

test('히든 하드모드: HP 3, 빈 가방, 난이도 변경·새로고침·이어하기에도 올바른 최대 HP', () => {
  const g = newGame(3);
  for (let i = 0; i < 3; i++) C.press(g, 'cancel');
  assert.equal(g.hp, 3); assert.equal(g.maxHp, 3);
  C.press(g, 'left'); assert.equal(g.hp, 180); assert.equal(g.maxHp, 180);
  C.press(g, 'right'); assert.equal(g.hp, 3); assert.equal(g.maxHp, 3);
  C.press(g, 'confirm'); assert.equal(g.hp, 3); assert.deepEqual(g.items, []);
  step(g, 1.6); assert.ok(g.talk.lines.some(([line]) => line.includes('HP가 3')));
  const restored = newGame(3, 5, JSON.parse(JSON.stringify(g.meta)));
  C.begin(restored); assert.equal(restored.hp, 3); assert.equal(restored.maxHp, 3);
  restored.checkpoint = { at: 'p2', items: ['pie'] };
  C.begin(restored, 'checkpoint'); assert.equal(restored.hp, 3); assert.equal(restored.maxHp, 3); assert.deepEqual(restored.items, []);
  C.begin(restored, 'start'); assert.equal(restored.hp, 3);
});


test('하드모드는 보통 또는 최악의 시간의 실제 클리어 기록으로만 열린다', () => {
  for (const id of ['easy', 'normal', 'hard']) {
    const meta = C.createMeta(); meta.level = 3; meta.best[id] = { ending: 'mercy' };
    const g = C.createGame(meta); C.press(g, 'confirm');
    assert.equal(C.hardUnlocked(g), id !== 'easy');
    assert.equal(g.mode, id === 'easy' ? 'title' : 'cine');
  }
  const g = C.createGame(); g.level = 3; C.press(g, 'confirm');
  assert.equal(g.mode, 'title'); assert.equal(g.lockedNotice, true);
  C.begin(g, 'checkpoint'); assert.equal(g.mode, 'title');
  g.meta.hiddenHeart = true; C.begin(g); assert.equal(g.mode, 'title', '히든도 해금 조건을 우회하지 않는다');
  g.meta.best.normal = { ending: 'kill' }; C.begin(g); assert.equal(g.mode, 'cine'); assert.equal(g.hp, 3);
});

test('배리하드: 하드코어 클리어로만 해금, HP 1/히든 3, 빈 가방과 처음부터 재도전', () => {
  const level = C.DIFFICULTIES.findIndex(d => d.id === 'veryhard');
  for (const cleared of ['easy', 'normal', 'hard', 'hp1']) {
    const meta = C.createMeta(); meta.level = level; meta.best[cleared] = { ending: 'mercy' };
    const g = C.createGame(meta); C.begin(g);
    assert.equal(C.veryHardUnlocked(g), cleared === 'hp1');
    assert.equal(g.mode, cleared === 'hp1' ? 'cine' : 'title');
  }
  for (const hidden of [false, true]) {
    const meta = C.createMeta(); meta.level = level; meta.hiddenHeart = hidden;
    const g = C.createGame(meta); C.begin(g); assert.equal(g.mode, 'title', '히든은 잠금을 풀지 않는다');
    meta.best.hp1 = { ending: 'kill', deaths: 0, hits: 0, time: 100 };
    C.begin(g); assert.equal(g.hp, hidden ? 3 : 1); assert.equal(g.maxHp, hidden ? 3 : 1); assert.deepEqual(g.items, []);
    assert.deepEqual(C.diff(g).checkpoints, []);
    C.begin(g, 'start'); assert.equal(g.hp, hidden ? 3 : 1);
    const restored = C.createGame(JSON.parse(JSON.stringify(meta))); C.begin(restored);
    assert.equal(C.veryHardUnlocked(restored), true); assert.equal(restored.hp, hidden ? 3 : 1);
  }
});

test('배리하드는 최악의 시간과 같은 공격 속도·피격·특별구간 규칙을 쓴다', () => {
  const hard = C.DIFFICULTIES.find(d => d.id === 'hard'), very = C.DIFFICULTIES.find(d => d.id === 'veryhard');
  for (const key of ['tempo', 'grace', 'krGain', 'sleep', 'checkpoints', 'refill', 'menuBones']) assert.deepEqual(very[key], hard[key], key);
  for (const name of Object.keys(C.PATTERNS)) {
    const hardGame = gameAt(name, 2), veryGame = structuredClone(hardGame); veryGame.level = 4;
    assert.equal(C.attackTempo(veryGame), C.attackTempo(hardGame));
    step(hardGame, .8); step(veryGame, .8);
    assert.deepEqual(veryGame.bullets, hardGame.bullets, name); assert.deepEqual(veryGame.soul, hardGame.soul, name);
  }
});

test('하드코어 실제 결말에서 배리하드가 열리고 해금 알림이 한 번 나온다', () => {
  const g = gameAt('nothing', 3); g.phase = 'nothing'; step(g, C.diff(g).sleep + .5);
  step(g, 6, { right: true }); C.press(g, 'confirm'); step(g, 2.4);
  settle(g); assert.equal(g.mode, 'won'); assert.equal(g.result.unlockedVeryHard, true);
  assert.equal(C.veryHardUnlocked(C.createGame(JSON.parse(JSON.stringify(g.meta)))), true);
});
