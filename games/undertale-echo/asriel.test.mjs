// 아스리엘 드리무르 보스전: 세 막의 흐름, 거부, 영혼 구하기, 결말까지 상태 기계를 끝까지 돌려 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../public/play/undertale-echo/core.mjs';
import * as AS from '../../public/play/undertale-echo/asriel.mjs';
import { PATTERNS } from '../../public/play/undertale-echo/patterns.mjs';
import { MONSTERS } from '../../public/play/undertale-echo/data.mjs';
import * as PX from '../../public/play/undertale-echo/asriel-pixels.mjs';

const step = (b, s, input = {}) => { for (let k = 0; k < Math.ceil(s * 60); k++) C.update(b, 1 / 60, input); };
const skipText = b => { let n = 0; while (b.mode === 'text' && n++ < 50) C.advanceText(b); };
const skipCine = b => { let n = 0; while (b.mode === 'cine' && n++ < 1000) step(b, .1); };
const settle = b => { for (let i = 0; i < 20 && (b.mode === 'text' || b.mode === 'cine'); i++) { skipCine(b); skipText(b); } };
// 적의 턴을 버틴다: 무적으로 두고 끝날 때까지 흘려보낸다. (마지막 공격은 무적을 무시한다)
const survive = b => { let n = 0; while (b.mode === 'dodge' && n++ < 1200) { b.soul.invincible = 99; step(b, 1 / 20); } settle(b); };
const open = (p = C.createPlayer('테스트')) => { const b = C.createBattle(p, ['asriel'], { seed: 7 }); assert.equal(b.mode, 'cine'); assert.equal(b.asr.cine.kind, 'intro'); settle(b); assert.equal(b.mode, 'menu'); return b; };
const act = (b, id) => { assert.ok(C.chooseAction(b, 'act')); const i = b.submenu.items.findIndex(x => x.id === id); assert.ok(i >= 0, `행동 ${id}`); C.chooseSub(b, i); settle(b); };
const saveMenu = (b, pick) => { assert.ok(C.chooseAction(b, 'mercy')); assert.equal(b.submenu.kind, 'asSave'); const i = b.submenu.items.findIndex(pick); assert.ok(i >= 0); C.chooseSub(b, i); settle(b); };
const toSavePhase = b => {
  for (const name of AS.GOD_SEQUENCE) { act(b, 'check'); assert.equal(b.mode, 'dodge'); assert.equal(b.attack.name, name); survive(b); }
  assert.equal(b.asr.phase, 'final');
  for (const name of AS.FINAL_SEQUENCE) { act(b, 'check'); assert.equal(b.attack.name, name); if (name === 'asFinalBeam') break; survive(b); }
  // 진짜 마지막 공격은 무적도 무시하고 HP를 0까지 지운다 → 영혼이 거부한다
  let n = 0; while (b.mode === 'dodge' && n++ < 400) { b.soul.invincible = 99; step(b, 1 / 20); }
  assert.equal(b.mode, 'cine'); assert.equal(b.asr.cine.kind, 'refuse'); assert.equal(b.player.hp, 0);
  settle(b); assert.equal(b.asr.phase, 'save'); assert.equal(b.player.hp, b.player.maxHp); assert.equal(b.mode, 'menu');
};

test('아스리엘 패턴은 모두 실제 패턴이며 12초 동안 예외 없이 돈다', () => {
  for (const name of MONSTERS.asriel.patterns) assert.ok(PATTERNS[name], name);
  for (const name of MONSTERS.asriel.patterns) {
    const b = open(); settle(b); C.chooseAction(b, 'act'); C.chooseSub(b, 0); skipText(b);
    b.attack.name = name; b.attack.def = PATTERNS[name]; b.attack.memo = {}; b.attack.t = 0; b.attack.duration = PATTERNS[name].duration; b.soul.mode = PATTERNS[name].soul || 'red';
    for (let k = 0; k < 12 * 60 && b.mode === 'dodge'; k++) C.update(b, 1 / 60, { left: k % 90 < 45, up: k % 70 < 30, down: k % 70 >= 40 });
  }
});

test('1막 절대신 → 변신 → 2막 최후의 형태 → 거부 → 구하기 버튼', () => {
  const b = open();
  assert.deepEqual(AS.buttons(b).map(x => x.label), ['공격', '행동', '아이템', '자비']);
  toSavePhase(b);
  assert.deepEqual(AS.buttons(b).map(x => x.label), ['발버둥', '행동', '아이템', '구하기']);
});

test('공격은 흠집도 내지 못하고, 희망은 피해를 절반으로, 꿈은 HP를 채운다', () => {
  const b = open();
  C.chooseAction(b, 'fight'); C.chooseSub(b, 0); step(b, .55); C.strike(b); assert.ok(b.lastDamage.raw > 0); step(b, 1.2); skipText(b);
  assert.equal(b.enemy.hp, b.enemy.maxHp); survive(b);
  act(b, 'hope'); assert.equal(b.asr.hope, 1);
  b.soul.invincible = 0; const before = b.player.hp; C.hurt(b, 6); const halfDmg = before - b.player.hp;
  b.asr.hope = 0; b.player.hp = before; C.hurt(b, 6); const fullDmg = before - b.player.hp;
  assert.ok(halfDmg < fullDmg, `${halfDmg} < ${fullDmg}`);
  survive(b); assert.equal(b.asr.hope, 0);
  b.player.hp = 3; act(b, 'dream'); assert.equal(b.player.hp, b.player.maxHp); assert.equal(b.asr.dreams, 2);
});

test('1막에서 HP가 0이 되면 죽지 않고 친구의 목소리로 다시 일어선다', () => {
  const b = open(); act(b, 'check'); assert.equal(b.mode, 'dodge');
  b.player.hp = 1; b.soul.invincible = 0; C.hurt(b, 50); step(b, 1 / 60);
  assert.equal(b.mode, 'cine'); assert.equal(b.asr.cine.kind, 'refuseSmall');
  settle(b); assert.equal(b.player.hp, b.player.maxHp); assert.equal(b.asr.refusals, 1); assert.equal(b.mode, 'menu'); assert.equal(b.ended, null);
});

test('하이퍼 고너는 HP 1 아래로 떨어뜨리지 않고 영혼을 입 쪽으로 끌어당긴다', () => {
  const b = open(); b.asr.round = 4; act(b, 'check'); assert.equal(b.attack.name, 'asHyperGoner');
  const y0 = b.soul.y; b.player.hp = 1; step(b, 2); assert.ok(b.player.hp >= 1); assert.ok(b.soul.y < y0, '위로 끌려간다');
});

test('3막: 잃어버린 영혼 셋을 기억 탄막과 함께 구하고, 아스리엘을 세 번 구하면 결말', () => {
  const b = open(); toSavePhase(b);
  // 첫 영혼: 구하기 → 만남 + 기억 탄막 → 행동으로 기억을 되찾게 한다
  saveMenu(b, i => i.index === 0); assert.equal(b.mode, 'dodge'); assert.equal(b.attack.name, 'lsUndyneAlphys'); assert.equal(b.asr.focus, 0);
  survive(b); act(b, 'water'); assert.equal(b.asr.souls[0].saved, true); assert.equal(b.asr.focus, null); survive(b);
  // 둘째: 파란 영혼 기억
  saveMenu(b, i => i.index === 1); assert.equal(b.attack.name, 'lsPapyrusSans'); assert.equal(b.soul.mode, 'blue'); survive(b);
  saveMenu(b, i => i.index === 1); assert.equal(b.asr.souls[1].saved, true); survive(b);
  // 셋째
  saveMenu(b, i => i.index === 2); assert.equal(b.attack.name, 'lsTorielAsgore'); survive(b);
  act(b, 'hug'); assert.ok(AS.allSaved(b)); survive(b);
  // 다른 누군가
  for (const name of AS.ASRIEL_SEQUENCE) { saveMenu(b, i => i.id === 'asriel'); assert.equal(b.attack.name, name); survive(b); }
  assert.equal(b.asr.phase, 'end'); assert.equal(b.mode, 'end'); assert.equal(b.ended, 'special');
});

test('픽셀 아트: 모든 형태가 캔버스 없이 래스터라이즈되고 초상 문자열이 만들어진다', () => {
  for (const [size, draw] of [[PX.GOD_SIZE, PX.drawGod], [PX.FINAL_SIZE, PX.drawFinal], [PX.CHILD_SIZE, PX.drawChild], [PX.SKULL_SIZE, PX.drawSkull], [PX.ALPHYS_SIZE, PX.drawAlphys]]) {
    const R = PX.createRaster(size.w, size.h); draw(R, .3); const filled = R.m.reduce((a, v) => a + (v ? 1 : 0), 0);
    assert.ok(filled > size.w * size.h * .08, `채움 ${filled}`);
    const rgba = PX.colorize(R, { t: 1 }); assert.equal(rgba.length, size.w * size.h * 4);
  }
  const rows = PX.childPortraitRows(); assert.ok(rows.length > 20 && rows.every(r => r.length === rows[0].length));
});

test('기억 탄막: 첫 만남에는 아프고, 한 번 버텨 준 뒤에는 영혼 앞에서 머뭇거리며 사라진다', () => {
  const b = open(); toSavePhase(b);
  saveMenu(b, i => i.index === 0); assert.equal(b.attack.name, 'lsUndyneAlphys'); assert.ok(!b.asr.souls[0].calm);
  let faded = 0; for (let k = 0; k < 400 && b.mode === 'dodge'; k++) { b.soul.invincible = 99; C.update(b, 1 / 60, {}); faded += b.bullets.filter(x => x.faded).length; }
  assert.equal(faded, 0, '첫 만남의 탄막은 머뭇거리지 않는다');
  survive(b); assert.ok(b.asr.souls[0].calm);
  C.chooseAction(b, 'fight'); settle(b); assert.equal(b.attack.name, 'lsUndyneAlphys');
  faded = 0; for (let k = 0; k < 400 && b.mode === 'dodge'; k++) { b.soul.invincible = 99; C.update(b, 1 / 60, {}); faded += b.bullets.filter(x => x.faded).length; }
  assert.ok(faded > 0, '버텨 준 뒤에는 머뭇거린다');
});
