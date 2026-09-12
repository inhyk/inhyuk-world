import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../public/play/undertale/core.mjs';
import { PATTERNS } from '../../public/play/undertale/patterns.mjs';
import { MONSTERS, ITEMS } from '../../public/play/undertale/data.mjs';

const adv = (b, s, i = {}) => { for (let k = 0; k < Math.ceil(s * 60); k++) C.update(b, 1 / 60, i); };
const skip = b => { while (b.mode === 'text') C.advanceText(b); };
const dodge = b => { if (b.mode === 'dodge') { b.soul.invincible = 99; adv(b, 20); } };
const fightOnce = b => { C.chooseAction(b, 'fight'); C.chooseSub(b, 0); adv(b, .55); C.strike(b); adv(b, 1.2); skip(b); dodge(b); };
const actOnce = (b, id) => { C.chooseAction(b, 'act'); C.chooseSub(b, 0); const i = b.submenu.items.findIndex(x => x.id === id); assert.ok(i >= 0, `act ${id}`); C.chooseSub(b, i); skip(b); dodge(b); };
const mercyOnce = b => { C.chooseAction(b, 'mercy'); C.chooseSub(b, 0); skip(b); dodge(b); };
const open = (ids, p = C.createPlayer('테스트'), seed = 3) => { const b = C.createBattle(p, ids, { seed }); skip(b); assert.equal(b.mode, 'menu'); return b; };

test('스탯 공식과 EXP 표는 원작을 따른다', () => {
  assert.equal(C.maxHpFor(1), 20); assert.equal(C.maxHpFor(10), 56); assert.equal(C.maxHpFor(20), 99);
  assert.equal(C.levelFor(0), 1); assert.equal(C.levelFor(10), 2); assert.equal(C.levelFor(99999), 20);
  const p = C.createPlayer('a'); assert.equal(C.gainExp(p, 10), true); assert.equal(p.lv, 2); assert.equal(p.maxHp, 24); assert.equal(p.hp, 24);
  p.weapon = 'pan'; assert.equal(C.attackStat(p), C.baseAttack(2) + 10);
});
test('모든 몬스터의 패턴 이름이 실제 패턴을 가리킨다', () => {
  for (const [id, m] of Object.entries(MONSTERS)) for (const name of m.patterns) assert.ok(PATTERNS[name], `${id}.${name}`);
  for (const [id, it] of Object.entries(ITEMS)) assert.ok(it.name, id);
});
test('행동으로 프로깃을 달래고 자비로 살려보내면 EXP 없이 골드만 얻는다', () => {
  const b = open(['froggit']); actOnce(b, 'compliment'); assert.equal(b.enemy.spareable, true);
  C.chooseAction(b, 'mercy'); assert.deepEqual(b.submenu.items.map(i => i.id), ['spare', 'flee']); C.chooseSub(b, 0); skip(b);
  assert.equal(b.ended, 'spare'); assert.equal(b.player.exp, 0); assert.equal(b.player.gold, 2); assert.equal(C.routeFor(b.player), 'pacifist');
});
test('공격으로 죽이면 EXP와 처치 수가 오르고 루트가 중립이 된다', () => {
  const b = open(['froggit']); let n = 0; while (!b.ended && n++ < 10) fightOnce(b);
  assert.equal(b.ended, 'kill'); assert.equal(b.player.kills, 1); assert.equal(b.player.areaKills.ruins, 1); assert.equal(b.player.exp, 10); assert.equal(C.routeFor(b.player), 'neutral');
});
test('타이밍 바를 놓치면 MISS, 중앙 근처는 배율 2.2', () => {
  const b = open(['moldsmal']); C.chooseAction(b, 'fight'); C.chooseSub(b, 0); adv(b, 2); assert.equal(b.lastDamage.label, 'MISS'); assert.equal(b.enemy.hp, 50);
  const b2 = open(['moldsmal']); C.chooseAction(b2, 'fight'); C.chooseSub(b2, 0); adv(b2, .55); C.strike(b2); assert.ok(b2.lastDamage.label.endsWith('!')); assert.ok(b2.lastDamage.dmg >= 22);
});
test('탄막 피격은 무적 시간을 두고 HP를 깎으며, 파란·주황 규칙을 지킨다', () => {
  const b = open(['froggit']); actOnce(b, 'compliment');
  const b2 = open(['froggit']); C.chooseAction(b2, 'act'); C.chooseSub(b2, 0); C.chooseSub(b2, 0); skip(b2); assert.equal(b2.mode, 'dodge');
  b2.bullets = Array.from({ length: 10 }, () => ({ x: b2.soul.x, y: b2.soul.y, r: 8, kind: 'fly', color: 'white', age: 0, ttl: 9, vx: 0, vy: 0, ax: 0, ay: 0 }));
  b2.soul.invincible = 0; C.update(b2, 1 / 60); assert.equal(b2.hits, 1); assert.ok(b2.player.hp < 20); const hp = b2.player.hp; adv(b2, .5); assert.equal(b2.player.hp, hp);
  assert.equal(C.canHurt({ color: 'blue' }, false), false); assert.equal(C.canHurt({ color: 'blue' }, true), true); assert.equal(C.canHurt({ color: 'orange' }, true), false); assert.equal(C.canHurt({ color: 'green' }, true), false);
  void b;
});
test('아이템은 HP를 회복하고 장비는 교체된다', () => {
  const b = open(['whimsun']); b.player.hp = 5; b.player.items = ['candy', 'toyknife'];
  C.chooseAction(b, 'item'); C.chooseSub(b, 0); assert.equal(b.player.hp, 15); skip(b); dodge(b);
  C.chooseAction(b, 'item'); C.chooseSub(b, 0); assert.equal(b.player.weapon, 'toyknife'); assert.deepEqual(b.player.items, ['stick']);
});
test('토리엘은 자비를 일곱 번 고르면 보내 주고, 몰살 루트에선 한 방에 쓰러진다', () => {
  const b = open(['toriel']); let n = 0; while (!b.ended && n++ < 12) mercyOnce(b);
  assert.equal(b.ended, 'spare'); assert.equal(n, 7); assert.equal(b.player.bossFate.toriel, 'spared');
  const p = C.createPlayer('x'); p.kills = 6; p.areaKills.ruins = 6; assert.equal(C.routeFor(p, 'ruins'), 'genocide');
  const g = open(['toriel'], p); fightOnce(g); assert.equal(g.ended, 'kill'); assert.equal(p.bossFate.toriel, 'killed');
});
test('파피루스는 공격을 버티면 스스로 포기하고, 몰살 루트에서 살려주면 루트가 깨진다', () => {
  const b = open(['papyrus']); let n = 0; while (!b.ended && n++ < 14) mercyOnce(b); assert.equal(b.ended, 'spare'); assert.equal(n, 9);
  const p = C.createPlayer('x'); p.kills = 12; p.areaKills = { ruins: 6, snowdin: 6, waterfall: 0, hotland: 0 }; p.bossFate.toriel = 'killed'; assert.equal(C.routeFor(p, 'snowdin'), 'genocide');
  const g = open(['papyrus'], p); mercyOnce(g); assert.equal(g.ended, 'spare'); assert.equal(p.flags.genocideBroken, true); assert.equal(C.routeFor(p, 'snowdin'), 'neutral');
});
test('언다인 전투는 초록 영혼이며 방패로 화살을 막고, 도망 행동 여섯 번 뒤 도망칠 수 있다', () => {
  const b = open(['undyne']); C.chooseAction(b, 'act'); C.chooseSub(b, 0); C.chooseSub(b, 0); skip(b); assert.equal(b.soul.mode, 'green');
  let blocks = 0; for (let k = 0; k < 60 * 9; k++) { const a = b.bullets.find(x => x.kind === 'arrow' && !x.dead && !x.passing); const inp = {}; if (a) inp[a.from] = true; C.update(b, 1 / 60, inp); blocks += b.effects.filter(f => f.kind === 'block' && f.t === 0).length; }
  assert.ok(blocks >= 5); assert.equal(b.hits, 0);
  let n = 0; while (!b.ended && n++ < 10) { actOnce(b, 'flee'); if (b.enemy.fleeCount >= 6) { C.chooseAction(b, 'mercy'); assert.ok(b.submenu.items.some(i => i.id === 'flee')); C.chooseSub(b, 1); skip(b); } }
  assert.equal(b.ended, 'flee');
});
test('파피루스의 파란 영혼은 중력을 받고 위 키로 점프한다', () => {
  const b = open(['papyrus']); C.chooseAction(b, 'act'); C.chooseSub(b, 0); C.chooseSub(b, 0); skip(b); assert.equal(b.soul.mode, 'blue'); adv(b, 1);
  const floor = b.soul.y; assert.ok(b.soul.grounded); adv(b, .2, { up: true }); assert.ok(floor - b.soul.y > 30); adv(b, 2); assert.ok(Math.abs(b.soul.y - floor) < 1);
});
test('메타톤은 시청률 4,000을 모으면 살려보낼 수 있다', () => {
  const b = open(['mettaton']); let n = 0; while (!b.ended && n++ < 20) { actOnce(b, 'pose'); if (b.enemy.spareable) mercyOnce(b); }
  assert.equal(b.ended, 'spare'); assert.ok(b.enemy.ratings >= 4000);
});
test('아스고어는 자비 버튼을 부수고, HP가 낮아지면 살려 둘 수 있다', () => {
  const p = C.createPlayer('x'); p.lv = 8; p.weapon = 'pan'; p.maxHp = 48; p.hp = 48; const b = open(['asgore'], p);
  C.chooseAction(b, 'mercy'); assert.match(b.text.lines[0], /부숴/); skip(b);
  let n = 0; while (!b.ended && n++ < 60) { fightOnce(b); if (b.asgoreLow && !b.ended) mercyOnce(b); }
  assert.equal(b.ended, 'spare'); assert.equal(p.bossFate.asgore, 'spared');
});
test('아스리엘은 죽일 수 없고 잃어버린 영혼 셋을 구한 뒤 세 번 더 구하면 끝난다', () => {
  const b = open(['asriel']); fightOnce(b); assert.equal(b.enemy.hp, b.enemy.maxHp);
  let n = 0; while (!b.ended && n++ < 20) { C.chooseAction(b, 'act'); C.chooseSub(b, 0); C.chooseSub(b, b.submenu.items.findIndex(i => i.id === 'save')); if (b.submenu?.kind === 'souls') C.chooseSub(b, b.submenu.items.findIndex(i => !i.done)); skip(b); dodge(b); }
  assert.equal(b.ended, 'special'); assert.equal(b.enemy.saved.length, 3);
});
test('몰살 루트 판정과 샌즈 전투: 모든 공격을 피하고, 잠든 뒤에야 맞는다', () => {
  const p = C.createPlayer('x'); p.kills = 24; p.areaKills = { ruins: 6, snowdin: 6, waterfall: 6, hotland: 6 }; p.bossFate = { toriel: 'killed', papyrus: 'killed', undying: 'killed', neo: 'killed' };
  assert.equal(C.routeFor(p), 'genocide');
  const b = open(['sans'], p); fightOnce(b); assert.equal(b.enemy.hp, 1); assert.equal(b.lastDamage.label, 'MISS');
  let n = 0; while (!b.ended && n++ < 30) fightOnce(b); assert.equal(b.sansAsleep, true); assert.equal(b.ended, 'kill');
  // 샌즈의 자비 제안을 받아들이면 죽는다
  const b2 = open(['sans'], p, 4); let m = 0; while (!b2.sansOffer && m++ < 20) actOnce(b2, 'check'); C.chooseAction(b2, 'mercy'); C.chooseSub(b2, 0); skip(b2); assert.equal(b2.ended, 'dead'); assert.equal(p.hp, 0);
});
test('카르마: 샌즈에게 맞으면 HP가 서서히 줄지만 1 아래로는 내려가지 않는다', () => {
  const p = C.createPlayer('x'); const b = open(['sans'], p); C.chooseAction(b, 'act'); C.chooseSub(b, 0); C.chooseSub(b, 0); skip(b); assert.equal(b.mode, 'dodge');
  C.hurt(b, 1); assert.ok(b.karma > 0); b.soul.invincible = 99; const hp = p.hp; adv(b, 1); assert.ok(p.hp < hp); b.karma = 99; p.hp = 2; adv(b, 3); assert.equal(p.hp, 1);
});
test('일시정지는 모든 시계를 멈춘다', () => {
  const b = open(['froggit']); C.chooseAction(b, 'act'); C.chooseSub(b, 0); C.chooseSub(b, 0); skip(b); adv(b, 1); b.paused = true;
  const snap = JSON.stringify(C.summarize(b)); adv(b, 5, { left: true }); assert.equal(JSON.stringify(C.summarize(b)), snap);
});
test('영혼은 박스 안에 머물고 대각선 속도가 정규화된다', () => {
  const b = open(['froggit']); C.chooseAction(b, 'act'); C.chooseSub(b, 0); C.chooseSub(b, 0); skip(b); adv(b, .5);
  const x = b.soul.x, y = b.soul.y; C.update(b, .05, { up: true, right: true }); assert.ok(Math.abs(Math.hypot(b.soul.x - x, b.soul.y - y) - 7.5) < .01);
  adv(b, 5, { up: true, right: true }); assert.ok(b.soul.x <= b.box.x + b.box.w / 2 - C.SOUL_RADIUS + .01); assert.ok(b.soul.y >= b.box.y - b.box.h / 2 + C.SOUL_RADIUS - .01);
});
test('몬스터가 둘이면 같은 턴에 두 패턴이 함께 나온다', () => {
  const b = open(['froggit', 'whimsun']); actOnce(b, 'compliment');
  const b2 = open(['froggit', 'whimsun'], C.createPlayer('y'), 7); C.chooseAction(b2, 'act'); C.chooseSub(b2, 0); C.chooseSub(b2, 0); skip(b2);
  assert.equal(b2.mode, 'dodge'); assert.equal(b2.attack.names.length, 2); assert.ok(b2.attack.names.includes('mothDrift'));
  b2.soul.invincible = 99; adv(b2, 2); const kinds = new Set(b2.bullets.map(x => x.kind)); assert.ok(kinds.has('moth')); assert.ok(kinds.has('fly') || kinds.has('frog'));
  adv(b2, 20); assert.equal(b2.mode, 'menu'); assert.equal(b2.enemies[0].turnsSurvived, 1); assert.equal(b2.enemies[1].turnsSurvived, 1);
  void b;
});
test('언다인과 메타톤을 한 방에 쓰러뜨리면 언다잉·NEO로 변신한다', () => {
  const p = C.createPlayer('x'); p.lv = 250; p.maxHp = 500; p.hp = 500; p.weapon = 'knife';
  const b = open(['undyne'], p); fightOnce(b); assert.equal(b.enemy.id, 'undying'); assert.equal(b.enemy.hp, b.enemy.maxHp); assert.equal(b.ended, null); assert.equal(p.bossFate.undyne, undefined);
  let n = 0; while (!b.ended && n++ < 10) fightOnce(b); assert.equal(b.ended, 'kill'); assert.equal(p.bossFate.undying, 'killed');
  const b2 = open(['mettaton'], p); fightOnce(b2); assert.equal(b2.enemy.id, 'neo'); assert.equal(b2.ended, null);
  // 여러 번에 걸쳐 쓰러뜨리면 그대로 죽는다
  const q = C.createPlayer('q'); q.lv = 8; q.weapon = 'pan'; q.maxHp = 48; q.hp = 48; const b3 = open(['undyne'], q); let m = 0; while (!b3.ended && m++ < 80) fightOnce(b3); assert.equal(b3.ended, 'kill'); assert.equal(q.bossFate.undyne, 'killed');
});
