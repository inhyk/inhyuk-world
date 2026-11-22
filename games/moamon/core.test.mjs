import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from './core.mjs';

const fresh = () => { const s = C.newSave(); C.ensureQuests(s, new Date(2026, 10, 22).getTime()); return s; };
const fixed = (v) => () => v;

test('몬스터 표: 34마리, 번호와 진화 가족이 맞다', () => {
  assert.equal(C.SPECIES.length, 34);
  assert.equal(new Set(C.SPECIES.map((s) => s.id)).size, 34);
  for (const s of C.SPECIES) { assert.ok(C.ELEMENTS[s.el]); if (s.to) { assert.ok(C.species(s.to), s.id); assert.ok(s.need > 0); assert.equal(C.familyOf(s.to), C.familyOf(s.id)); } }
  assert.equal(C.familyOf('supimgeum'), 'ipsae');
});

test('속성: 강하면 1.6배, 약하면 0.625배', () => {
  assert.equal(C.effect('water', 'fire'), 1.6); assert.equal(C.effect('fire', 'water'), 0.625); assert.equal(C.effect('fire', 'fire'), 1);
});

test('힘은 레벨이 오르면 커진다', () => {
  const a = C.makeMon('ipsae', 5, fixed(0.5)), b = { ...a, lv: 20 };
  assert.ok(C.power(b) > C.power(a)); assert.ok(C.stats(b).hp > C.stats(a).hp);
});

test('잡기 확률: 좋은 방울, 열매, 잘 던지면 높아지고 1을 넘지 않는다', () => {
  const m = C.makeMon('hwareureuk', 20, fixed(0.5));
  const base = C.catchChance(m, 'ball', null, 0);
  assert.ok(C.catchChance(m, 'ball2', null, 0) > base); assert.ok(C.catchChance(m, 'ball', 'berry', 0) > base); assert.ok(C.catchChance(m, 'ball', null, 3) > base);
  assert.ok(C.catchChance(C.makeMon('somteol', 1, fixed(0.5)), 'ball3', 'berry', 3) <= 1);
  assert.ok(C.catchChance(C.makeMon('haenimi', 30, fixed(0.5)), 'ball', null, 0) < 0.1);
});

test('잡으면 도감, 사탕, 별가루, 경험치가 오른다', () => {
  const s = fresh(), m = C.makeMon('ipsae', 3, fixed(0.5), { shiny: false });
  const r = C.onCaught(s, m, 3, true, true);
  assert.equal(s.mons.length, 1); assert.equal(s.dex.ipsae.caught, 1); assert.equal(r.isNew, true); assert.equal(s.candy.ipsae, 6);
  assert.equal(r.xp, 100 + 100 + 50 + 500); assert.equal(s.dust, 1000 + 125);
  const r2 = C.onCaught(s, C.makeMon('ipsae', 3, fixed(0.5), { shiny: false }), 0, false, false);
  assert.equal(r2.isNew, false); assert.equal(r2.xp, 100); assert.equal(s.candy.ipsae, 9);
});

test('레벨 업: 경험치가 넘치면 여러 번 오르고 선물을 받는다', () => {
  const s = fresh(); const ups = C.addXp(s, C.xpNeed(1) + C.xpNeed(2) + 10);
  assert.equal(s.lv, 3); assert.equal(ups.length, 2); assert.equal(s.xp, 10); assert.ok(s.items.ball > 25); assert.equal(s.coins, 160);
});

test('강하게 하기: 재료가 줄고, 탐험가 레벨보다 너무 높이 못 올린다', () => {
  const s = fresh(), m = C.makeMon('ipsae', 1, fixed(0.5)); s.mons.push(m); s.candy.ipsae = 10;
  assert.equal(C.powerUp(s, m), null); assert.equal(m.lv, 2); assert.equal(s.dust, 800); assert.equal(s.candy.ipsae, 9);
  assert.equal(C.powerUp(s, m), null); assert.equal(m.lv, 3);
  assert.match(C.powerUp(s, m), /탐험가 레벨/); s.dust = 0; s.lv = 10; assert.match(C.powerUp(s, m), /별가루/);
});

test('진화: 사탕이 모자라면 안 되고, 되면 모습이 바뀐다', () => {
  const s = fresh(), m = C.makeMon('ipsae', 5, fixed(0.5)); s.mons.push(m);
  assert.equal(typeof C.evolve(s, m), 'string'); s.candy.ipsae = 12;
  const r = C.evolve(s, m); assert.equal(m.sp, 'ipsagwi'); assert.equal(s.candy.ipsae, 0); assert.equal(r.isNew, true); assert.equal(s.dex.ipsagwi.caught, 1);
  assert.match(C.evolve(s, C.makeMon('somteol', 1, fixed(0.5))), /더 진화/);
});

test('보내 주기: 즐겨찾기와 마지막 친구는 못 보낸다', () => {
  const s = fresh(), a = C.makeMon('ipsae', 1, fixed(0.5)), b = C.makeMon('bulssi', 1, fixed(0.5)); s.mons.push(a);
  assert.match(C.release(s, a), /마지막/); s.mons.push(b); b.fav = true; assert.match(C.release(s, b), /즐겨찾기/);
  s.buddy = a.uid; s.team = [a.uid, b.uid]; assert.equal(C.release(s, a), null); assert.equal(s.mons.length, 1); assert.equal(s.buddy, null); assert.deepEqual(s.team, [b.uid]); assert.equal(s.candy.ipsae, 1);
});

test('나타나는 몬스터: 사는 곳과 밤낮, 전설 조건을 지킨다', () => {
  const r = C.rng(7); const seen = new Set(); let nightOnly = 0;
  for (let i = 0; i < 3000; i++) { const m = C.pickSpawn('lake', false, 'sunny', 3, r); seen.add(m.sp); if (m.sp === 'byeolbam' || m.sp === 'daltokki') nightOnly++; assert.ok(m.lv >= 1 && m.lv <= 10); assert.notEqual(C.species(m.sp).rare, 5); }
  assert.equal(nightOnly, 0); assert.ok(seen.has('mulbang')); assert.ok(seen.size > 10);
  const night = new Set(); for (let i = 0; i < 2000; i++) night.add(C.pickSpawn('park', true, 'cloudy', 20, r).sp);
  assert.ok(night.has('byeolbam')); assert.ok(!night.has('haenimi'));
});

test('별샘: 물건을 받고 알은 6개까지만', () => {
  const s = fresh(); const before = s.items.ball + s.items.berry; const r = C.spinLoot(s, fixed(0.1));
  assert.ok(s.items.ball + s.items.berry > before); assert.equal(r.loot.egg, 1); assert.equal(s.eggs.length, 1); assert.equal(s.stats.spins, 1);
  for (let i = 0; i < 10; i++) C.spinLoot(s, fixed(0.1)); assert.equal(s.eggs.length, C.MAX_EGGS);
});

test('걷기: 알이 깨어나고 단짝이 사탕을 가져온다', () => {
  const s = fresh(); C.addEgg(s, fixed(0.1)); const m = C.makeMon('ipsae', 1, fixed(0.5)); s.mons.push(m); s.buddy = m.uid;
  assert.equal(C.walk(s, 100, fixed(0.3)).length, 0);
  const h = C.walk(s, 200, fixed(0.3)); assert.equal(h.length, 1); assert.equal(s.eggs.length, 0); assert.equal(s.mons.length, 2); assert.equal(h.buddyCandy, m); assert.equal(s.dist, 300); assert.ok(s.dex[h[0].mon.sp].caught);
});

test('알 세 종류 모두 깨어난다', () => {
  for (const pick of [0.1, 0.7, 0.95]) for (const roll of [0, 0.5, 0.999]) { const s = fresh(); C.addEgg(s, fixed(pick)); const h = C.walk(s, 2000, fixed(roll)); assert.equal(h.length, 1); assert.ok(C.species(h[0].mon.sp)); }
});

test('할 일: 하루에 세 개, 다 하면 보상과 추가 별가루', () => {
  const s = fresh(); assert.equal(s.quests.list.length, 3); assert.equal(C.ensureQuests(s, new Date(2026, 10, 22, 23).getTime()), false);
  assert.equal(C.claimQuest(s, 0), null);
  for (const q of s.quests.list) q.have = q.need; const coins = s.coins;
  C.claimQuest(s, 0); C.claimQuest(s, 1); const r = C.claimQuest(s, 2); assert.equal(r.bonusDust, 1500); assert.ok(s.coins > coins); assert.equal(C.claimQuest(s, 2), null);
  assert.equal(C.ensureQuests(s, new Date(2026, 10, 23).getTime()), true); assert.equal(s.quests.list[0].claimed, false);
});

test('할 일 진행: 속성이 맞을 때만 오른다', () => {
  const s = fresh(); s.quests.list = [{ t: 'el', arg: 'fire', need: 2, have: 0, claimed: false, reward: { ball: 1 }, coins: 10 }];
  C.questEvent(s, 'el', 1, 'water'); assert.equal(s.quests.list[0].have, 0); C.questEvent(s, 'el', 1, 'fire'); assert.equal(C.questEvent(s, 'el', 5, 'fire'), true); assert.equal(s.quests.list[0].have, 2);
});

test('상점: 코인과 레벨을 확인한다', () => {
  const s = fresh(); assert.equal(C.buy(s, 'ball'), null); assert.equal(s.coins, 40); assert.equal(s.items.ball, 35);
  assert.match(C.buy(s, 'berry'), /코인/); s.coins = 999; assert.match(C.buy(s, 'ball3'), /레벨 10/);
});

test('도장: 지킴이는 세 마리, 이길수록 강해지고 보상이 커진다', () => {
  const a = C.arenaTeam(5, 0, 5), b = C.arenaTeam(5, 3, 5); assert.equal(a.team.length, 3); assert.equal(a.el, b.el); assert.ok(b.team[0].lv > a.team[0].lv);
  for (const m of a.team) assert.equal(C.species(m.sp).el, a.el);
  const s = fresh(); const r1 = C.arenaReward(s, 'k'), r2 = C.arenaReward(s, 'k'); assert.equal(r2.wins, 2); assert.ok(r2.coins > r1.coins);
  const w = C.makeMon('mulbang', 10, fixed(0.5)), f = C.makeMon('bulssi', 10, fixed(0.5)); assert.ok(C.damage(w, f, 10) > C.damage(f, w, 10));
});

test('저장: 망가진 기록을 고쳐서 불러온다', () => {
  assert.equal(C.fixSave(null).lv, 1); assert.equal(C.fixSave({ v: 9 }).mons.length, 0);
  const s = C.fixSave({ v: 1, lv: 999, xp: -5, mons: [{ sp: 'nope', iv: [1, 1, 1] }, { sp: 'ipsae', iv: [1, 2, 3], lv: 3, uid: 'a' }, null], team: ['a', 'zz'], items: { ball: 3 }, eggs: 'x' });
  assert.equal(s.lv, C.MAX_LEVEL); assert.equal(s.xp, 0); assert.equal(s.mons.length, 1); assert.deepEqual(s.team, ['a']); assert.equal(s.items.ball, 3); assert.equal(s.items.berry, 5); assert.deepEqual(s.eggs, []);
  const round = C.fixSave(JSON.parse(JSON.stringify(fresh()))); assert.equal(round.quests.list.length, 3);
});

test('조사: 받침에 맞게 붙는다', () => {
  assert.equal(C.josa('나풀', '으로', '로'), '나풀로'); assert.equal(C.josa('달토끼', '으로', '로'), '달토끼로'); assert.equal(C.josa('숲임금', '으로', '로'), '숲임금으로');
  assert.equal(C.josa('불씨', '이', '가'), '불씨가'); assert.equal(C.josa('찌릿양', '이', '가'), '찌릿양이');
});
