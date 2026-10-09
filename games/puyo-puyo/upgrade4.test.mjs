// 인혁이 기획서 「뿌요뿌요 (업그레이드)」 7가지: 펫, 시간 선물, 2배 부스트, 맵(AI·온라인·혼자)과 맵 투표,
// 뿌요뿌요 배우기(초급 → 최상급), 친구 배수, 친구 선물
import test from 'node:test';
import assert from 'node:assert/strict';
import { PETS, PET_PRICE, WEIGHT_TOTAL, rollPet, drawPet, drawWith, equipPet, equippedPet, petMultiplier, petOdds, petName, multText, chanceText, chanceTotal, sanitizePets } from './pets.mjs';
import { BOOST_MS, BOOST_PRICE, friendMultiplier, boostLeft, spendBoost, buyBoost, matchBonus, applyBonus, clockText } from './bonus.mjs';
import { TIME_REWARDS, rewardView, addPlayTime, claimTime, grantReward } from './rewards.mjs';
import { newProgress, sanitize, TIME_IDS, SCHOOL_IDS, TICKET_KINDS } from './profile.mjs';
import { GRADES, LESSONS, HINT_AFTER, gradeDone, gradeOpen, finishGrade, lessonCells, lessonSeq, lessonStep, newJudge, judge } from './tutorial.mjs';
import { MAPS, getMap, mapIndex, cleanMapIndex, voteResult } from './maps.mjs';
import { Player, makeSequence, findGroups, parseField, resolveChain, isEmpty, heights } from './core.mjs';
import { Match } from './match.mjs';
import { think, AI_LEVELS } from './ai.mjs';
import { GIFT_COINS, GIFT_DAILY_COINS, giftable, giftBody, parseGift, looksLikeGift, giftText, giftCost, canSend, paySend, refundSend, receiveGift } from './gifts.mjs';
import { SKINS, EFFECTS } from './shop.mjs';
import { MISSIONS, track } from './missions.mjs';
import { createOnline } from './online.mjs';
import { filterText, DM_MAX } from '../../services/net/src/filter.js';
import { createCreatorSession } from './creator.mjs';
import { canBuy } from './shop.mjs';

const normal = new Date('2026-10-07T12:00:00+09:00'); // 수요일, 공휴일 아님

// ---------- 1. 펫 ----------
test('펫: 그림에 적힌 이름·배수·확률 그대로, 뽑기는 코인 1000', () => {
  assert.equal(PET_PRICE, 1000);
  assert.deepEqual(PETS.map(p => [p.name, multText(p.mult), chanceText(p.chance)]), [
    ['강아지', '1.5배', '70%'], ['고양이', '3.0배', '50%'], ['키캡', '5.0배', '10%'], ['큰 키캡', '10.0배', '1%'], ['???', '100.0배', '0.1%'],
  ]);
  assert.equal(chanceTotal(), 131.1); // 적힌 숫자를 다 더하면 100이 넘는다 → 비율로 뽑는다
  assert.equal(WEIGHT_TOTAL, 1311);
  assert.ok(Math.abs(PETS.reduce((sum, p) => sum + petOdds(p.id), 0) - 1) < 1e-9);
  assert.ok(Math.abs(petOdds('dog') - 70 / 131.1) < 1e-9);
});

test('펫 뽑기: 적힌 숫자의 비율대로 나온다', () => {
  // 0~1310 을 한 번씩 굴리면 강아지 700, 고양이 500, 키캡 100, 큰 키캡 10, ??? 1
  const counts = {};
  for (let n = 0; n < WEIGHT_TOTAL; n++) { const pet = rollPet(() => (n + 0.5) / WEIGHT_TOTAL); counts[pet.id] = (counts[pet.id] || 0) + 1; }
  assert.deepEqual(counts, { dog: 700, cat: 500, keycap: 100, bigkeycap: 10, mystery: 1 });
  assert.equal(rollPet(() => 0).id, 'dog');
  assert.equal(rollPet(() => 0.9999999).id, 'mystery');
  assert.equal(rollPet(() => NaN).id, 'dog'); // 이상한 값이 와도 멈추지 않는다
  assert.equal(rollPet(() => 1).id, 'mystery');
});

test('펫 뽑기: 코인 1000이 들고, 더 좋은 펫이 나오면 데리고 다닌다', () => {
  const p = newProgress();
  assert.equal(drawWith(p), null); assert.equal(drawPet(p), null); // 코인 100으로는 못 뽑는다
  p.coins = 2500;
  const first = drawPet(p, () => 0.99); // 키캡 자리
  assert.equal(first.pet.id, 'keycap'); assert.equal(first.isNew, true); assert.equal(first.paid, 'coins'); assert.equal(first.equipped, true);
  assert.equal(p.coins, 1500); assert.equal(petMultiplier(p), 5);
  const second = drawPet(p, () => 0); // 강아지: 배수가 작아서 키캡을 그대로 데리고 다닌다
  assert.equal(second.pet.id, 'dog'); assert.equal(second.equipped, false); assert.equal(equippedPet(p).id, 'keycap');
  assert.equal(p.coins, 500); assert.equal(drawPet(p, () => 0), null); assert.equal(p.coins, 500);
  assert.equal(equipPet(p, 'dog'), true); assert.equal(petMultiplier(p), 1.5);
  assert.equal(equipPet(p, 'cat'), false); assert.equal(equipPet(p, 'nope'), false); // 없는 펫은 못 데리고 다닌다
  // 펫 뽑기권이 있으면 코인 대신 뽑기권을 쓴다
  p.tickets.pet = 1;
  const third = drawPet(p, () => 0);
  assert.equal(third.paid, 'ticket'); assert.equal(third.isNew, false); assert.equal(third.count, 2);
  assert.equal(p.coins, 500); assert.equal(p.tickets.pet, 0); assert.equal(p.pets.draws, 3);
});

test('펫: ??? 는 뽑기 전에는 이름이 보이지 않고, 저장 기록은 안전하게 읽는다', () => {
  const mystery = PETS.at(-1);
  assert.equal(petName(mystery, false), '???'); assert.equal(petName(mystery, true), '무지개 드래곤');
  assert.equal(petName(PETS[0], false), '강아지');
  assert.deepEqual(sanitize({}).pets, { owned: {}, equip: '', draws: 0 });
  assert.deepEqual(sanitizePets({ owned: { dog: 2, cat: -1, dragon: 5, keycap: 'x' }, equip: 'cat', draws: 3.7 }), { owned: { dog: 2 }, equip: 'dog', draws: 3 });
  assert.equal(sanitizePets({ owned: { dog: 1, bigkeycap: 1 }, equip: 'ghost' }).equip, 'bigkeycap'); // 없는 펫이면 가장 좋은 펫
  assert.equal(petMultiplier({ pets: { owned: {}, equip: 'mystery' } }), 1); // 갖지 않은 펫은 배수가 없다
});

// ---------- 2. 시간 선물 ----------
test('시간 선물: 3개에서 7개로, 펫 뽑기권이 조금 들어 있다', () => {
  assert.deepEqual(TIME_REWARDS.map(r => r.id), TIME_IDS);
  assert.equal(TIME_REWARDS.length, 7);
  assert.deepEqual(TIME_REWARDS.map(r => r.seconds / 60), [5, 10, 15, 20, 30, 45, 60]);
  assert.deepEqual(TIME_REWARDS.filter(r => r.tickets.pet).map(r => r.id), ['20m', '60m']);
  assert.deepEqual(TIME_REWARDS.filter(r => r.tickets.boost).map(r => r.id), ['10m', '45m']);
  for (const [a, b] of TIME_REWARDS.slice(1).map((r, i) => [TIME_REWARDS[i], r])) assert.ok(a.seconds < b.seconds && a.coins < b.coins);
  const p = newProgress();
  addPlayTime(p, 1200, normal);
  assert.deepEqual(rewardView(p, normal).time.filter(r => r.ready).map(r => r.id), ['5m', '10m', '15m', '20m']);
  assert.equal(claimTime(p, '20m', normal).tickets.pet, 1);
  assert.equal(p.tickets.pet, 1); assert.equal(claimTime(p, '20m', normal), null); assert.equal(claimTime(p, '30m', normal), null);
  assert.equal(claimTime(p, '10m', normal).tickets.boost, 1); assert.equal(p.tickets.boost, 1);
  assert.deepEqual(sanitize(p).rewards.claimedTime, ['20m', '10m']);
  assert.ok(drawPet(p, () => 0)); assert.equal(p.tickets.pet, 0); // 받은 뽑기권으로 바로 뽑는다
  assert.deepEqual(TICKET_KINDS, ['skin', 'effect', 'spin', 'pet', 'boost']);
  // 생일 코인 10배는 뽑기권 수에 곱하지 않는다
  const b = newProgress(); grantReward(b, { coins: 10, tickets: { pet: 1, boost: 2 } }, new Date('2027-05-12T12:00:00+09:00'));
  assert.equal(b.tickets.pet, 1); assert.equal(b.tickets.boost, 2); assert.equal(b.coins, 200);
});

// ---------- 3. 2배 부스트, 6. 친구 배수 ----------
test('2배 부스트: 쓰면 15분, 이어 쓰면 뒤에 붙고, 코인 500으로 산다', () => {
  const p = newProgress(), t0 = 1_800_000_000_000;
  assert.equal(spendBoost(p, t0), false); assert.equal(boostLeft(p, t0), 0);
  assert.equal(buyBoost(p), false); // 코인 100
  p.coins = BOOST_PRICE * 2 + 1;
  assert.equal(buyBoost(p), true); assert.equal(buyBoost(p), true); assert.equal(buyBoost(p), false);
  assert.equal(p.coins, 1); assert.equal(p.tickets.boost, 2);
  assert.equal(spendBoost(p, t0), true); assert.equal(boostLeft(p, t0), BOOST_MS); assert.equal(BOOST_MS, 15 * 60 * 1000);
  assert.equal(boostLeft(p, t0 + BOOST_MS - 1), 1); assert.equal(boostLeft(p, t0 + BOOST_MS), 0);
  assert.equal(spendBoost(p, t0 + 60_000), true); assert.equal(boostLeft(p, t0 + 60_000), BOOST_MS * 2 - 60_000); // 남은 시간 뒤에 15분
  assert.equal(p.tickets.boost, 0); assert.equal(spendBoost(p, t0), false);
  assert.equal(matchBonus(p, { now: t0 }).boost, 2); assert.equal(matchBonus(p, { now: t0 + BOOST_MS * 2 }).boost, 1);
  assert.equal(clockText(BOOST_MS), '15:00'); assert.equal(clockText(61_000), '1:01'); assert.equal(clockText(0), '0:00');
});

test('친구가 많을수록 배수가 오른다 (경험치와 코인): 1명마다 +0.1배, 20명 3.0배까지', () => {
  assert.deepEqual([0, 1, 2, 5, 10, 20, 21, 500].map(friendMultiplier), [1, 1.1, 1.2, 1.5, 2, 3, 3, 3]);
  assert.deepEqual([-3, NaN, 'x', 2.9].map(friendMultiplier), [1, 1, 1, 1.2]);
  for (let n = 0; n < 20; n++) assert.ok(friendMultiplier(n + 1) > friendMultiplier(n));
});

test('판 보상 배수: 펫은 경험치만, 부스트와 친구는 경험치와 코인', () => {
  const p = newProgress(), now = 1_800_000_000_000;
  assert.deepEqual(applyBonus({ coins: 80, xp: 100 }, matchBonus(p, { now })), { coins: 80, xp: 100 }); // 아무것도 없으면 그대로
  p.pets = { owned: { cat: 1 }, equip: 'cat', draws: 1 };
  let b = matchBonus(p, { now });
  assert.equal(b.xp, 3); assert.equal(b.coins, 1); assert.deepEqual(applyBonus({ coins: 80, xp: 100 }, b), { coins: 80, xp: 300 });
  p.tickets.boost = 1; spendBoost(p, now);
  b = matchBonus(p, { now, friends: 3 });
  assert.equal(b.petMult, 3); assert.equal(b.boost, 2); assert.equal(b.friend, 1.3); assert.equal(b.friends, 3);
  assert.equal(b.xp, 7.8); assert.equal(b.coins, 2.6);
  assert.deepEqual(applyBonus({ coins: 80, xp: 100 }, b), { coins: 208, xp: 780 });
  p.pets = { owned: { mystery: 1 }, equip: 'mystery', draws: 1 };
  assert.equal(matchBonus(p, { now, friends: 20 }).xp, 600); // ??? 100배 × 부스트 2배 × 친구 3배
});

// ---------- 4. 맵 ----------
test('맵 투표: 표가 많은 맵, 표가 같으면 둘 중에서 뽑기', () => {
  assert.equal(MAPS.length, 6); // 새로 만든 맵 없이 2인 플레이의 여섯 맵 그대로
  assert.deepEqual(MAPS.map(m => m.id), ['garden', 'ice', 'volcano', 'rainbow', 'space', 'six']);
  assert.equal(mapIndex('six'), 5); assert.equal(mapIndex('nope'), 0);
  assert.equal(cleanMapIndex(6), null); assert.equal(cleanMapIndex('2'), null); assert.equal(cleanMapIndex(2), 2);
  assert.deepEqual(voteResult([3, 3]), { map: 3, tie: false }); // 둘이 같은 맵
  assert.deepEqual(voteResult([1, 4], () => 0), { map: 1, tie: true });
  assert.deepEqual(voteResult([1, 4], () => 0.99), { map: 4, tie: true });
  assert.deepEqual(voteResult([4, 1], () => 0), { map: 1, tie: true }); // 누가 먼저 골랐는지와 상관없다
  assert.deepEqual(voteResult([2, 5, 5]), { map: 5, tie: false }); // 더 많은 쪽
  assert.deepEqual(voteResult([null, 9, 'x']), { map: 0, tie: false }); // 표가 없으면 뿌요 정원
  assert.deepEqual(voteResult([null, 2]), { map: 2, tie: false });
});

test('맵 규칙은 AI 대전과 혼자 하기의 판에도 그대로 들어간다', () => {
  const six = getMap('six'), rainbow = getMap('rainbow');
  const vs = new Match({ seed: 7, colors: six.colors, minGroup: six.minGroup, gravityScale: six.gravityScale, target: six.target, specs: [{ kind: 'human' }, { kind: 'ai', level: 3 }] });
  assert.equal(vs.players[0].minGroup, 6); assert.equal(vs.players[1].minGroup, 6);
  const solo = new Match({ seed: 7, colors: rainbow.colors, minGroup: rainbow.minGroup, gravityScale: rainbow.gravityScale, specs: [{ kind: 'human' }], solo: true });
  assert.equal(solo.seq.palette.length, 5);
  const ice = new Match({ seed: 7, gravityScale: getMap('ice').gravityScale, specs: [{ kind: 'human' }], solo: true });
  assert.ok(ice.gravity() < new Match({ seed: 7, specs: [{ kind: 'human' }], solo: true }).gravity());
});

test('AI 는 쫀득 연구소(같은 색 6개)에서 4개로는 안 터진다는 것을 안다', () => {
  const cells = parseField(['RRR...']);
  const base = { cells, pairs: [[1, 1], [2, 3], [3, 4]], palette: [1, 2, 3, 4], incoming: 0, target: 70 };
  const cfg = { ...AI_LEVELS[6], fire: 1 };
  assert.ok(think({ ...base, cells: cells.slice() }, cfg, () => 0.5).chain >= 1); // 보통 규칙: 바로 터뜨린다
  assert.equal(think({ ...base, cells: cells.slice(), minGroup: 6 }, cfg, () => 0.5).chain, 0); // 5개까지는 안 터진다
  assert.ok(think({ ...base, cells: cells.slice() }, cfg, () => 0.5).chain >= 1); // 다음 판은 다시 보통 규칙
  const five = parseField(['RRRRR.']);
  assert.ok(think({ ...base, cells: five, minGroup: 6 }, cfg, () => 0.5).chain >= 1); // 5개에 하나를 더하면 터진다
});

test('AI 는 여섯 맵 모두에서 AI 대전을 끝까지 한다', () => {
  for (const map of MAPS) {
    const m = new Match({ seed: 11, colors: map.colors, minGroup: map.minGroup, gravityScale: map.gravityScale, target: map.target, specs: [{ kind: 'ai', level: 6 }, { kind: 'ai', level: 2 }] });
    let frames = 0;
    while (!m.over && frames++ < 60 * 60 * 12) { m.step([]); m.events.length = 0; }
    assert.ok(m.over, `${map.name} 판이 끝나야 한다`);
    const popped = m.totals(0).popped + m.totals(1).popped;
    assert.ok(popped > 0, `${map.name}에서 AI 가 뿌요를 터뜨려야 한다`);
    if (map.minGroup === 6) assert.ok(m.totals(0).maxGroup >= 6 || m.totals(1).maxGroup >= 6);
  }
});

test('맵 탐험 챌린지는 2인 플레이가 아니어도 그 맵에서 하면 오른다', () => {
  const p = newProgress();
  track(p, { type: 'match', mode: 'vs', map: 'ice', win: true });
  track(p, { type: 'match', mode: 'online', map: 'ice', win: false });
  track(p, { type: 'match', mode: 'solo', map: 'ice', win: false });
  track(p, { type: 'match', mode: 'local', map: 'ice', win: true });
  track(p, { type: 'match', mode: 'tower', win: true }); // 타워에는 맵이 없다
  assert.equal(p.missions['map-ice-5'].v, 4);
  assert.equal(p.missions['map-garden-1']?.v ?? 0, 0);
  assert.ok(MISSIONS.some(m => m.id === 'map-six-15'));
});

// ---------- 온라인 맵 투표 (online.mjs) ----------
function fakeRoom(host) {
  const sent = [];
  return { sent, host, ready: true, peers: ['x'], code: 'ROOM', send(m, opts) { sent.push({ ...m, keep: !!opts?.keep }); return true; }, leave() {}, chat() { return true; }, report() { return true; } };
}
function onlineWith({ host, vote = 0, peerVotes = true, random }) {
  const started = [];
  const room = fakeRoom(host);
  const on = createOnline({
    toast() {}, sound: { sfx() {} }, me: () => ({ level: 3, skin: 'classic', effect: 'sparkle' }), vote: () => vote, random,
    social: () => ({ acceptInvite: async () => ({ room, opponent: { id: 9, nickname: '상대' } }) }),
    start: info => started.push(info), match: () => null, isFinished: () => false, quit() {}, render() {},
  });
  return { on, room, started, peerVotes };
}

test('온라인 맵 투표: 서로 표를 보내고, 방장이 정한 맵 번호로 둘이 같은 맵에서 시작한다', async () => {
  const a = onlineWith({ host: true, vote: 2, random: () => 0.99 });
  await a.on.accept({ id: 1 });
  assert.deepEqual(a.room.sent.filter(m => m.t === 'vote').at(-1), { t: 'vote', m: 2, keep: false }); // 들어가면 내 표를 보낸다
  a.on.hooks.message({ t: 'hello', level: 5, skin: 'cat', effect: 'star' });
  a.on.hooks.message({ t: 'vote', m: 4 });
  assert.equal(a.on.state().vote, 2); assert.equal(a.on.state().peerVote, 4);
  a.on.setVote(1);
  assert.deepEqual(a.room.sent.at(-1), { t: 'vote', m: 1, keep: false });
  a.on.start();
  const start = a.room.sent.findLast(m => m.t === 'start');
  assert.equal(start.m, 4); assert.equal(start.tie, 1); // 표가 1:1 이라 뽑기(0.99 → 큰 번호)
  assert.equal(a.started[0].map, 'space'); assert.equal(a.started[0].tie, true);
  assert.equal(typeof start.m, 'number'); // 글자열은 서버가 거르므로 번호로만 보낸다

  // 손님: 방장이 보낸 번호 그대로
  const b = onlineWith({ host: false, vote: 4 });
  await b.on.accept({ id: 1 });
  b.on.hooks.message({ t: 'hello', level: 5 });
  b.on.hooks.message({ t: 'vote', m: 1 });
  b.on.hooks.message({ t: 'start', seed: 123, first: 2, m: 4, tie: 1 });
  assert.equal(b.started[0].map, 'space'); assert.equal(b.started[0].tie, true); assert.equal(b.started[0].role, 'guest');
  b.on.hooks.message({ t: 'vote', m: 99 }); assert.equal(b.on.state().peerVote, 1); // 없는 맵 번호는 무시
});

test('온라인 맵 투표: 둘이 같은 맵을 고르면 그 맵, 예전 버전 상대(표가 없음)와는 기본 맵', async () => {
  const a = onlineWith({ host: true, vote: 5 });
  await a.on.accept({ id: 1 });
  a.on.hooks.message({ t: 'hello', level: 5 });
  a.on.hooks.message({ t: 'vote', m: 5 });
  a.on.start();
  assert.equal(a.started[0].map, 'six'); assert.equal(a.started[0].tie, false);

  const old = onlineWith({ host: true, vote: 5 });
  await old.on.accept({ id: 1 });
  old.on.hooks.message({ t: 'hello', level: 5 }); // 표를 보내지 않는 예전 게임
  old.on.start();
  assert.equal(old.started[0].map, 'garden');
  assert.equal(old.room.sent.findLast(m => m.t === 'start').m, 0);

  const guest = onlineWith({ host: false, vote: 3 });
  await guest.on.accept({ id: 1 });
  guest.on.hooks.message({ t: 'hello', level: 5 });
  guest.on.hooks.message({ t: 'start', seed: 5, first: 1 }); // 예전 방장: 맵 번호가 없다
  assert.equal(guest.started[0].map, 'garden');
});

// ---------- 5. 뿌요뿌요 배우기 ----------
// 진짜 Player 로 짝을 정한 자리에 떨어뜨려 보고 판정을 받는다. placements: [[x, rot], ...]
function playLesson(lesson, placements) {
  const p = new Player({ seq: lessonSeq(lesson, makeSequence(1)), seed: 1 });
  p.cells.set(lessonCells(lesson)); p.refreshHeights();
  p.start();
  const state = newJudge();
  let verdict = null, i = 0;
  for (let frame = 0; frame < 6000 && !verdict; frame++) {
    let input = {};
    if (p.state === 'control' && p.piece) {
      if (i >= placements.length) break;
      const [x, rot] = placements[i++];
      p.piece.x = x; p.piece.rot = rot;
      input = { drop: true };
    }
    p.step(input, {});
    for (const e of p.events) verdict ||= judge(lesson, state, e);
    p.events.length = 0;
  }
  return verdict;
}
const ALL_PLACES = [];
for (let x = 0; x < 6; x++) { ALL_PLACES.push([x, 0], [x, 2]); if (x < 5) ALL_PLACES.push([x, 1]); if (x > 0) ALL_PLACES.push([x, 3]); }
const lesson = id => GRADES.flatMap(g => g.lessons).find(l => l.id === id);

test('배우기: 초급 → 중급 → 상급 → 최상급 → 초초상급 → 마지막 → 찐 마지막 순서', () => {
  assert.deepEqual(GRADES.map(g => g.name), ['초급', '중급', '상급', '최상급', '초초상급', '마지막', '찐 마지막', '졸업', '졸업2', '졸업3', '졸업4', '졸업5', '졸업6', '졸업7', '졸업8', '졸업9', '졸업10']);
  assert.deepEqual(GRADES.slice(1).map(g => g.id), SCHOOL_IDS);
  for (const g of GRADES.slice(0, 5)) assert.equal(g.lessons.length, 3);
  // 마지막: 다섯 등급 복습 5개 → 빈 필드에서 직접 쌓기 → 진짜 연쇄를 잘하는 비결 4개 (맨 끝에)
  const last = GRADES[5].lessons;
  assert.deepEqual(last.map(l => l.id), ['review1', 'review2', 'review3', 'review4', 'review5', 'scratch', 'tip-wait', 'tip-stairs', 'tip-center', 'tip-next']);
  assert.deepEqual(last.slice(0, 5).map(l => l.title.split(' · ')[0]), ['복습 ① 초급', '복습 ② 중급', '복습 ③ 상급', '복습 ④ 최상급', '복습 ⑤ 초초상급']);
  assert.deepEqual(last.map(l => !!l.tip), [false, false, false, false, false, false, true, true, true, true]);
  assert.equal(GRADES[0].lessons, LESSONS); // 초급은 예전 연습하기 그대로
  const ids = GRADES.flatMap(g => g.lessons.map(l => l.id));
  assert.equal(new Set(ids).size, ids.length);
  for (const [a, b] of GRADES.slice(1).map((g, i) => [GRADES[i], g])) assert.ok(a.reward.coins < b.reward.coins);
});

test('배우기: 앞 등급을 끝내야 다음 등급이 열리고, 끝낸 선물은 한 번만', () => {
  const p = newProgress();
  const flags = n => GRADES.map((_, i) => i < n); // 앞에서부터 n개만 true
  assert.deepEqual(GRADES.map((_, i) => gradeOpen(p, i)), flags(1));
  assert.equal(finishGrade(p, 0), true); assert.equal(p.tutorial, true); assert.equal(finishGrade(p, 0), false);
  assert.deepEqual(GRADES.map((_, i) => gradeOpen(p, i)), flags(2));
  assert.equal(finishGrade(p, 1), true); assert.equal(finishGrade(p, 2), true);
  assert.deepEqual(GRADES.map((_, i) => gradeDone(p, i)), flags(3));
  assert.equal(finishGrade(p, 3), true); assert.equal(finishGrade(p, 3), false); assert.equal(finishGrade(p, 99), false);
  assert.deepEqual(sanitize(p).school, ['middle', 'high', 'master']);
  // 최상급까지 끝낸 예전 기록에서는 초초상급이 열려 있고, 마지막은 초초상급을 끝내야 열린다
  assert.deepEqual([gradeOpen(p, 4), gradeOpen(p, 5)], [true, false]);
  assert.equal(finishGrade(p, 4), true);
  assert.deepEqual([gradeOpen(p, 5), gradeDone(p, 5)], [true, false]);
  assert.equal(finishGrade(p, 5), true); assert.equal(finishGrade(p, 5), false);
  assert.deepEqual(sanitize(p).school, ['middle', 'high', 'master', 'ultra', 'final']);
  // 찐 마지막은 마지막을 끝내야 열린다
  assert.deepEqual([gradeOpen(p, 6), gradeDone(p, 6)], [true, false]);
  assert.equal(finishGrade(p, 6), true); assert.equal(finishGrade(p, 6), false);
  assert.deepEqual(sanitize(p).school, ['middle', 'high', 'master', 'ultra', 'final', 'real']);
  assert.deepEqual(GRADES.map((_, i) => gradeDone(p, i)), flags(7));
  // 졸업, 졸업2, 졸업3, 졸업4, 졸업5 도 순서대로 (찐 마지막을 끝내야 졸업이 열린다)
  assert.deepEqual(GRADES.map((_, i) => gradeOpen(p, i)), flags(8));
  for (const i of [7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) { assert.equal(gradeOpen(p, i), true); assert.equal(gradeOpen(p, i + 1), false); assert.equal(finishGrade(p, i), true); assert.equal(finishGrade(p, i), false); }
  assert.deepEqual(GRADES.map((_, i) => gradeDone(p, i)), flags(17));
  assert.deepEqual(sanitize(p).school, ['middle', 'high', 'master', 'ultra', 'final', 'real', 'grad1', 'grad2', 'grad3', 'grad4', 'grad5', 'grad6', 'grad7', 'grad8', 'grad9', 'grad10']);
  // 졸업3까지 끝낸 예전 기록(졸업3이 25가지였을 때 끝낸 사람)은 끝낸 그대로이고, 바로 졸업4가 열려 있다
  const doctor = sanitize({ tutorial: true, school: ['middle', 'high', 'master', 'ultra', 'final', 'real', 'grad1', 'grad2', 'grad3'] });
  assert.deepEqual([gradeDone(doctor, 9), gradeOpen(doctor, 10), gradeDone(doctor, 10), gradeOpen(doctor, 11)], [true, true, false, false]);
  assert.deepEqual(sanitize({ school: ['master', 'master', 'beginner', 7, 'boss'] }).school, ['master']);
  // 예전 기록(연습하기만 끝냄)은 초급을 끝낸 것으로 본다
  const old = sanitize({ tutorial: true });
  assert.equal(gradeDone(old, 0), true); assert.equal(gradeOpen(old, 1), true); assert.equal(gradeDone(old, 1), false);
});

test('배우기: 처음 필드에는 터질 것도, 떠 있는 뿌요도 없다', () => {
  for (const l of GRADES.flatMap(g => g.lessons)) {
    const cells = lessonCells(l);
    assert.equal(findGroups(cells).length, 0, `${l.id}: 시작하자마자 터지면 안 된다`);
    for (let x = 0; x < 6; x++) for (let y = 1; y < 12; y++) if (cells[y * 6 + x]) assert.ok(cells[(y - 1) * 6 + x], `${l.id}: (${x}, ${y}) 가 떠 있다`);
    for (const row of l.field) assert.equal(row.length, 6, `${l.id}: 한 줄은 6칸`);
    assert.ok(l.title && (l.tip || (l.done && l.retry) || l.goal.pieces) && (l.text || l.steps || (l.touch && l.keys)), `${l.id}: 설명이 있어야 한다`);
    if (l.steps) assert.equal(l.steps.length, l.pairs.length, `${l.id}: 짝마다 안내 하나`);
    if (l.hints) assert.equal(l.hints.length, l.pairs.length, `${l.id}: 짝마다 도움말 하나`);
  }
});

test('배우기: 알려 준 대로 놓으면 성공한다 (진짜 판으로 확인)', () => {
  const answers = {
    pop: [[2, 0]], chain: [[0, 0]],
    stairs3: [[0, 0]], double: [[3, 1]], garbage: [[3, 0]],
    stairs4: [[0, 0]], build3: [[1, 0], [0, 0]], allclear: [[3, 0]],
    stairs5: [[0, 0]], build4: [[1, 0], [0, 0]], clear3: [[1, 0], [0, 0]],
    sandwich: [[1, 0]], build5: [[1, 0], [0, 0]], stairs6: [[0, 0]],
    review1: [[5, 0]], review2: [[5, 0]], review3: [[4, 0], [5, 0]], review4: [[5, 0]], review5: [[4, 0]],
    scratch: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [0, 0]],
    // 찐 마지막: 총복습 10, 직접 쌓기 3, 대연쇄 4, 졸업 시험 2
    'real-pop': [[2, 0]], 'real-chain2': [[0, 0]], 'real-double': [[2, 3]], 'real-garbage': [[3, 0]], 'real-stairs4': [[5, 0]],
    'real-allclear': [[2, 0]], 'real-build4': [[4, 0], [5, 0]], 'real-clear3': [[4, 0], [5, 0]], 'real-stairs6': [[5, 0]], 'real-sandwich': [[1, 0]],
    'real-scratch3': [[5, 0], [4, 0], [3, 0], [5, 3], [3, 1], [5, 0]],
    'real-scratch4': [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [2, 1], [1, 1], [0, 0]],
    'real-scratch5': [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [2, 1], [1, 1], [3, 1], [0, 0]],
    'real-mega7': [[3, 0]], 'real-mega8': [[4, 0]], 'real-mega9': [[4, 0]], 'real-mega10': [[3, 0]],
    'real-exam3': [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [0, 0]],
    'real-exam4': [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [2, 1], [1, 1], [0, 0]],
  };
  for (const [id, moves] of Object.entries(answers)) assert.equal(playLesson(lesson(id), moves), 'done', `${id} 정답`);
  // 졸업 등급의 문제는 정답(answer)을 문제에 같이 적어 둔다
  const withAnswer = GRADES.flatMap(g => g.lessons).filter(l => l.answer);
  assert.equal(withAnswer.length, 622); // 졸업·졸업2·졸업3(처음 것) 53 + 졸업3에 더한 31 + 졸업4 49 + 졸업5 49 + 졸업6~10 의 58 + 67 + 81 + 108 + 126
  for (const l of withAnswer) {
    assert.equal(l.answer.length, l.pairs.length, `${l.id}: 짝마다 놓을 자리`);
    assert.equal(playLesson(l, l.answer), 'done', `${l.id} 정답`);
    assert.ok(!(l.id in answers), l.id);
  }
  assert.equal(playLesson(lesson('move'), [[0, 0], [2, 0], [4, 0]]), 'done'); // 3번 내려놓기
  assert.deepEqual(Object.keys(answers).length + 1 + withAnswer.length, GRADES.flatMap(g => g.lessons).filter(l => !l.tip).length); // 빠진 수업이 없다 (비결은 풀 것이 없다)
});

test('배우기: 다르게 놓으면 "다시 해 보자"', () => {
  assert.equal(playLesson(lesson('stairs3'), [[0, 2]]), 'retry'); // 뒤집어서(초록이 아래) 놓음
  assert.equal(playLesson(lesson('stairs3'), [[4, 0]]), 'retry'); // 엉뚱한 줄
  assert.equal(playLesson(lesson('double'), [[3, 0]]), 'retry'); // 세워서 놓으면 빨강만 터진다
  assert.equal(playLesson(lesson('garbage'), [[5, 0]]), 'retry');
  assert.equal(playLesson(lesson('allclear'), [[3, 1]]), 'retry'); // 눕히면 초록이 남는다
  assert.equal(playLesson(lesson('build3'), [[0, 0], [1, 0]]), 'retry'); // 순서가 틀림
  assert.equal(playLesson(lesson('clear3'), [[1, 1], [0, 0]]), 'retry'); // 파랑을 눕히면 먼저 터져 버린다
  assert.equal(playLesson(lesson('stairs5'), [[0, 2]]), 'retry');
  assert.equal(playLesson(lesson('sandwich'), [[3, 0]]), 'retry'); // 빨강에 닿지 않음
  assert.equal(playLesson(lesson('stairs6'), [[5, 0]]), 'retry'); // 반대쪽 끝에 놓으면 한 번만 터진다
  assert.equal(playLesson(lesson('review2'), [[0, 0]]), 'retry'); // 복습은 오른쪽으로 뒤집혀 있다
  assert.equal(playLesson(lesson('review3'), [[5, 0], [4, 0]]), 'retry');
});

test('배우기 마지막: 빈 필드에서 여섯 번 놓아 3연쇄, 놓을 때마다 안내가 바뀐다', () => {
  const l = lesson('scratch');
  assert.equal(l.field.length, 0); assert.equal(l.steps.length, l.pairs.length); assert.equal(l.goal.moves, 6);
  assert.deepEqual(l.steps.map(t => t.match(/[①-⑥]/)?.[0]), ['①', '②', '③', '④', '⑤', '⑥']);
  assert.equal(lessonStep(l), l.steps[0]); assert.equal(lessonStep(l, 3), l.steps[3]); assert.equal(lessonStep(l, 99), l.steps[5]);
  assert.equal(lessonStep(lesson('stairs3')), null);
  // 마지막 짝을 잘못 놓으면 다시, 중간에 4개가 닿아 먼저 터져도 다시
  assert.equal(playLesson(l, [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [5, 0]]), 'retry');
  assert.equal(playLesson(l, [[0, 0], [0, 0]]), null); // 아직 여섯 번을 다 놓지 않았다
  assert.equal(playLesson(l, [[0, 0], [1, 0], [2, 0], [0, 1], [2, 0]]), 'retry'); // 파랑 짝을 파랑 줄에 세우면 4개가 먼저 터져 버린다 (1연쇄)
});

test('배우기 마지막: 비결은 풀 것 없이 읽고 넘어간다 (어떤 사건으로도 끝나지 않음)', () => {
  const tips = GRADES[5].lessons.filter(l => l.tip);
  assert.equal(tips.length, 4);
  assert.deepEqual(tips.map(l => l.title.slice(0, 4)), ['비결 ①', '비결 ②', '비결 ③', '비결 ④']);
  for (const l of tips) {
    const state = newJudge();
    for (const e of [{ type: 'spawn' }, { type: 'lock' }, { type: 'pop', colors: [1, 2], garbage: 3 }, { type: 'chainEnd', chain: 9, allClear: true }, { type: 'spawn' }, { type: 'lock' }, { type: 'spawn' }, { type: 'spawn' }])
      assert.equal(judge(l, state, e), null, l.id);
    assert.ok(l.text.length > 30 && l.field.length >= 2, `${l.id}: 글과 보기 그림`);
  }
  assert.match(tips.at(-1).text, /진짜 연쇄 고수/);
});

test('배우기: 모든 수업은 정해진 횟수 안에 풀 수 있고, 아무 데나 놓아서는 안 풀린다', () => {
  for (const l of GRADES.slice(1).flatMap(g => g.lessons)) {
    if (l.tip || l.steps || l.hints || l.goal.pop) continue; // 비결은 풀 것이 없고, 직접 쌓기와 시험(여러 번 놓기)은 위에서 정답으로 확인한다. 4개 터뜨리기는 쉬운 게 맞다
    const moves = l.goal.moves;
    assert.ok(moves === 1 || moves === 2, `${l.id}: 몇 번 안에 푸는지 적혀 있어야 한다`);
    let solved = 0, total = 0;
    const tries = moves === 1 ? ALL_PLACES.map(a => [a]) : ALL_PLACES.flatMap(a => ALL_PLACES.map(b => [a, b]));
    for (const t of tries) { total++; if (playLesson(l, t) === 'done') solved++; }
    assert.ok(solved >= 1, `${l.id}: 풀 수 있어야 한다`);
    assert.ok(solved / total <= 0.5, `${l.id}: 아무 데나 놓아도 풀리면 안 된다 (${solved}/${total})`); // 전소는 푸는 길이 여러 가지다
  }
});

// ---------- 7. 친구 선물 ----------
test('선물: 코인·스킨·터짐 효과를 글로 바꿨다가 되돌린다', () => {
  assert.deepEqual(GIFT_COINS, [100, 500, 1000, 5000]);
  assert.equal(giftBody({ kind: 'coins', amount: 500 }), '[[gift:c:500]]');
  assert.equal(giftBody({ kind: 'skin', id: 'cat' }), '[[gift:s:cat]]');
  assert.equal(giftBody({ kind: 'effect', id: 'heart' }), '[[gift:e:heart]]');
  assert.deepEqual(parseGift('[[gift:c:500]]'), { kind: 'coins', amount: 500 });
  assert.deepEqual(parseGift(' [[gift:s:cat]] '), { kind: 'skin', id: 'cat' });
  assert.deepEqual(parseGift('[[gift:e:heart]]'), { kind: 'effect', id: 'heart' });
  for (const bad of ['[[gift:c:999999]]', '[[gift:c:501]]', '[[gift:c:-5]]', '[[gift:s:crown]]', '[[gift:s:legend]]', '[[gift:s:champion]]', '[[gift:s:classic]]', '[[gift:e:nova]]', '[[gift:e:meteor]]', '[[gift:x:cat]]', '안녕 [[gift:c:500]]', '[[st:3]]', '', null])
    assert.equal(parseGift(bad), null, String(bad));
  assert.equal(giftText({ kind: 'coins', amount: 5000 }), '코인 5,000개');
  assert.equal(giftText({ kind: 'skin', id: 'cat' }), '스킨 「고양이 뿌요」');
  assert.equal(giftText({ kind: 'effect', id: 'heart' }), '터짐 효과 「하트」');
  assert.equal(looksLikeGift('이거 받아 [[gift:c:5000]]'), true); assert.equal(looksLikeGift('[[ GIFT :c'), true); assert.equal(looksLikeGift('선물 줄게!'), false);
});

test('선물할 수 있는 것: 코인으로 파는 스킨·효과만 (보스·랭킹 보상과 고난이도 레벨 상품은 안 됨)', () => {
  for (const item of SKINS) assert.equal(giftable('skin', item.id), item.price > 0 && !item.noTicket, item.id);
  for (const item of EFFECTS) assert.equal(giftable('effect', item.id), item.price > 0 && !item.noTicket, item.id);
  assert.equal(giftable('skin', 'knight'), false); assert.equal(giftable('skin', 'aurora'), false); assert.equal(giftable('coins', 'cat'), false);
  assert.ok(SKINS.filter(s => giftable('skin', s.id)).length >= 20);
});

test('선물 글은 서버의 채팅 거르개를 그대로 지나간다', () => {
  const gifts = [...GIFT_COINS.map(amount => ({ kind: 'coins', amount })),
    ...SKINS.filter(s => giftable('skin', s.id)).map(s => ({ kind: 'skin', id: s.id })),
    ...EFFECTS.filter(e => giftable('effect', e.id)).map(e => ({ kind: 'effect', id: e.id }))];
  for (const gift of gifts) {
    const body = giftBody(gift);
    assert.equal(filterText(body, { max: DM_MAX }).text, body, body);
    assert.deepEqual(parseGift(body), gift);
  }
});

test('선물 보내기: 코인이 그만큼 빠지고, 못 보냈으면 되돌린다', () => {
  const p = newProgress(); p.coins = 700;
  assert.equal(canSend(p, { kind: 'coins', amount: 1000 }), 'coins');
  assert.equal(canSend(p, { kind: 'skin', id: 'crown' }), 'none');
  assert.equal(canSend(p, { kind: 'coins', amount: 123 }), 'none');
  assert.equal(paySend(p, { kind: 'coins', amount: 1000 }), false); assert.equal(p.coins, 700);
  assert.equal(giftCost({ kind: 'skin', id: 'cat' }), 650);
  assert.equal(paySend(p, { kind: 'skin', id: 'cat' }), true); assert.equal(p.coins, 50); assert.equal(p.gifts.sent, 1);
  assert.equal(p.owned.skin.includes('cat'), false); // 내 것이 생기는 게 아니라 친구에게 사 주는 것
  refundSend(p, { kind: 'skin', id: 'cat' }); assert.equal(p.coins, 700); assert.equal(p.gifts.sent, 0);
});

test('선물 받기: 같은 선물은 한 번만, 이미 가진 것은 코인으로, 하루 코인 한도', () => {
  const p = newProgress(); // 코인 100
  const coins = receiveGift(p, { kind: 'coins', amount: 500 }, { from: 7, id: 10, now: normal });
  assert.equal(coins.coins, 500); assert.equal(p.coins, 600); assert.equal(p.gifts.got, 1);
  assert.equal(receiveGift(p, { kind: 'coins', amount: 500 }, { from: 7, id: 10, now: normal }), null); // 같은 메시지
  assert.equal(receiveGift(p, { kind: 'coins', amount: 500 }, { from: 7, id: 9, now: normal }), null); // 더 옛날 메시지
  assert.equal(p.coins, 600);
  // 다른 친구는 번호를 따로 센다
  const skin = receiveGift(p, { kind: 'skin', id: 'cat' }, { from: 8, id: 3, now: normal });
  assert.equal(skin.item.name, '고양이 뿌요'); assert.equal(skin.coins, 0); assert.ok(p.owned.skin.includes('cat'));
  assert.equal(p.equip.skin, 'classic'); // 받기만 하고 바꿔 끼우지는 않는다
  const again = receiveGift(p, { kind: 'skin', id: 'cat' }, { from: 8, id: 4, now: normal });
  assert.equal(again.converted, true); assert.equal(again.coins, 650); assert.equal(p.coins, 1250);
  const fx = receiveGift(p, { kind: 'effect', id: 'heart' }, { from: 7, id: 11, now: normal });
  assert.equal(fx.item.id, 'heart'); assert.ok(p.owned.effect.includes('heart'));
  // 잘못된 선물과 보낸 사람
  assert.equal(receiveGift(p, { kind: 'skin', id: 'legend' }, { from: 7, id: 12, now: normal }), null);
  assert.equal(receiveGift(p, { kind: 'coins', amount: 500 }, { from: 0, id: 13, now: normal }), null);
  assert.equal(receiveGift(p, { kind: 'coins', amount: 500 }, { from: 7, id: 1.5, now: normal }), null);
  // 하루 한도
  p.gifts.dayCoins = GIFT_DAILY_COINS - 300;
  const capped = receiveGift(p, { kind: 'coins', amount: 5000 }, { from: 7, id: 20, now: normal });
  assert.equal(capped.coins, 300); assert.equal(capped.capped, true);
  assert.equal(receiveGift(p, { kind: 'coins', amount: 100 }, { from: 7, id: 21, now: normal }).coins, 0);
  const tomorrow = new Date('2026-10-08T00:00:01+09:00');
  assert.equal(receiveGift(p, { kind: 'coins', amount: 100 }, { from: 7, id: 22, now: tomorrow }).coins, 100); // 자정에 한도가 새로 시작
  // 저장했다가 읽어도 받은 번호가 남아서 다시 받지 않는다
  const saved = sanitize(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(saved.gifts.seen, { 7: 22, 8: 4 });
  assert.equal(receiveGift(saved, { kind: 'coins', amount: 100 }, { from: 7, id: 22, now: tomorrow }), null);
  assert.deepEqual(sanitize({ gifts: { seen: { abc: 3, 5: -1, 6: 2.5, 9: 4 }, day: 'x', dayCoins: -9 } }).gifts, { seen: { 9: 4 }, day: '', dayCoins: 0, sent: 0, got: 0 });
});

test('새 기록 칸: 예전 기록에 없어도 채워지고, 이상한 값은 고친다', () => {
  const old = sanitize({ level: 5, coins: 300, settings: { localMap: 'six' } });
  assert.deepEqual(old.tickets, { skin: 0, effect: 0, spin: 0, pet: 0, boost: 0 });
  assert.deepEqual(old.boost, { until: 0 }); assert.equal(old.friendCount, 0); assert.deepEqual(old.school, []);
  assert.deepEqual([old.settings.localMap, old.settings.vsMap, old.settings.soloMap, old.settings.onlineMap], ['six', 'garden', 'garden', 'garden']);
  const odd = sanitize({ boost: { until: -5 }, friendCount: 'many', settings: { vsMap: 'moon', soloMap: 'ice', onlineMap: 7 } });
  assert.deepEqual(odd.boost, { until: 0 }); assert.equal(odd.friendCount, 0);
  assert.deepEqual([odd.settings.vsMap, odd.settings.soloMap, odd.settings.onlineMap], ['garden', 'ice', 'garden']);
});

// ---------- 제작자 모드: 전설의 뿌요 바로 쓰기 (인혁이 요청) ----------
test('제작자 모드: 「전설의 뿌요」를 레벨·코인 없이 바로 받아서 낀다 (잠겨 있으면 안 됨)', () => {
  const p = newProgress(), creator = createCreatorSession();
  assert.equal(canBuy(p, 'skin', 'legend'), 'level'); // 원래는 99레벨부터
  assert.equal(creator.apply(p, 'legend'), null); // 비밀번호 전에는 아무 일도 없다
  assert.equal(p.owned.skin.includes('legend'), false);
  assert.equal(creator.unlock('7777777'), true);
  assert.match(creator.apply(p, 'legend'), /전설의 뿌요 스킨을 받아서 바로 꼈어/);
  assert.equal(p.equip.skin, 'legend'); assert.ok(p.owned.skin.includes('legend'));
  assert.equal(p.level, 1); assert.equal(p.coins, 100); // 레벨과 코인은 그대로
  assert.equal(p.owned.skin.includes('champion'), false); // 랭킹 보상은 주지 않는다
  creator.apply(p, 'legend');
  assert.equal(p.owned.skin.filter(id => id === 'legend').length, 1); // 여러 번 눌러도 하나
  assert.equal(sanitize(p).equip.skin, 'legend');
});

// ---------- 찐 마지막 (엄청 길게: 30가지) ----------
const real = () => GRADES[6].lessons;
test('찐 마지막: 다섯 부 30가지 (총복습 10 → 직접 쌓기 3 → 대연쇄 4 → 졸업 시험 2 → 찐 비결 7)', () => {
  assert.equal(GRADES[6].id, 'real'); assert.equal(real().length, 30);
  assert.ok(real().length >= GRADES[5].lessons.length * 3, '마지막보다 훨씬 길다');
  const kinds = real().map(l => (l.tip ? 'tip' : l.steps ? 'build' : l.hints ? 'exam' : /^real-mega/.test(l.id) ? 'mega' : 'review'));
  assert.deepEqual(kinds, ['tip', ...Array(10).fill('review'), 'tip', 'build', 'build', 'build', 'tip', 'mega', 'mega', 'mega', 'mega', 'tip', 'exam', 'exam', ...Array(7).fill('tip')]);
  assert.deepEqual(real().filter(l => l.tip).map(l => l.title), ['1부 · 총복습 시작!', '2부 · 빈 필드에서 직접 쌓기', '3부 · 대연쇄 구경', '4부 · 졸업 시험',
    '5부 · 찐 비결 ① 같은 색은 가까이', '찐 비결 ② 연쇄의 꼬리 늘리기', '찐 비결 ③ 높이를 고르게', '찐 비결 ④ 상대 필드도 보기', '찐 비결 ⑤ 전소를 노리기', '찐 비결 ⑥ 너무 오래 끌지 않기', '찐 비결 ⑦ 매일 조금씩']);
  assert.deepEqual(real().filter(l => !l.tip && !l.steps && !l.hints && !/mega/.test(l.id)).map(l => l.title.slice(0, 5)), ['총복습 ①', '총복습 ②', '총복습 ③', '총복습 ④', '총복습 ⑤', '총복습 ⑥', '총복습 ⑦', '총복습 ⑧', '총복습 ⑨', '총복습 ⑩']);
  // 선물도 가장 크다
  assert.ok(GRADES[6].reward.coins > GRADES[5].reward.coins * 3);
  assert.deepEqual(GRADES[6].reward.tickets, { pet: 5, boost: 3, skin: 2, effect: 2 });
  for (const l of real().filter(x => x.tip)) {
    const state = newJudge();
    for (const e of [{ type: 'spawn' }, { type: 'lock' }, { type: 'chainEnd', chain: 9, allClear: true }, { type: 'spawn' }, { type: 'spawn' }]) assert.equal(judge(l, state, e), null, l.id);
    assert.ok(l.text.length > 30 && l.field.length >= 1, `${l.id}: 글과 보기 그림`);
  }
});

test('찐 마지막 2부: 빈 필드에서 3·4·5연쇄를 직접 쌓는다 (6·8·10번 놓기, 놓을 때마다 안내)', () => {
  for (const [id, chain, n] of [['real-scratch3', 3, 6], ['real-scratch4', 4, 8], ['real-scratch5', 5, 10]]) {
    const l = lesson(id);
    assert.equal(l.field.length, 0); assert.equal(l.goal.chain, chain); assert.equal(l.goal.moves, n); assert.equal(l.pairs.length, n);
    assert.deepEqual(l.steps.map(t => t.match(/[①-⑩]/)?.[0]), [...'①②③④⑤⑥⑦⑧⑨⑩'].slice(0, n));
    assert.equal(lessonStep(l, n - 1), l.steps[n - 1]);
  }
  // 5연쇄: 마지막 짝을 다른 데 놓으면 다시
  assert.equal(playLesson(lesson('real-scratch5'), [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [2, 1], [1, 1], [3, 1], [5, 0]]), 'retry');
});

test('찐 마지막 3부: 대연쇄는 한 번 놓아 7·8·9·10연쇄, 모두 전소로 끝난다', () => {
  for (const [id, chain, x] of [['real-mega7', 7, 3], ['real-mega8', 8, 4], ['real-mega9', 9, 4], ['real-mega10', 10, 3]]) {
    const l = lesson(id), cells = lessonCells(l), h = heights(cells);
    assert.equal(l.goal.chain, chain); assert.equal(l.goal.moves, 1);
    assert.equal(findGroups(cells).length, 0);
    assert.ok(h[2] <= 8, `${id}: 뿌요가 나오는 셋째 줄은 낮아야 한다`);
    assert.ok(Math.max(...h) <= 11, `${id}: 보이는 칸 안에 들어온다`);
    const [a, c] = l.pairs[0];
    assert.equal(a, c); // 같은 색 짝이라 세워서 놓기만 하면 된다
    cells[h[x] * 6 + x] = a; cells[(h[x] + 1) * 6 + x] = c;
    assert.equal(resolveChain(cells).chain, chain, id);
    assert.ok(isEmpty(cells), `${id}: 전소로 끝난다`);
    assert.equal(playLesson(l, [[x, 0]]), 'done');
    assert.equal(playLesson(l, [[x === 3 ? 0 : 3, 0]]), 'retry'); // 다른 줄에 놓으면 다시
  }
});

test('찐 마지막 4부: 졸업 시험은 안내가 없고, 두 번 틀리면 도움말이 나온다', () => {
  assert.equal(HINT_AFTER, 2);
  for (const [id, n] of [['real-exam3', 6], ['real-exam4', 8]]) {
    const l = lesson(id);
    assert.equal(l.steps, undefined); assert.equal(l.hints.length, n); assert.equal(l.goal.moves, n);
    assert.equal(lessonStep(l, 0, 0), null); assert.equal(lessonStep(l, 3, 1), null); // 처음 두 번은 혼자서
    assert.match(lessonStep(l, 0, 2), /^조금 어렵지\? 이번에는 같이 하자! ①/);
    assert.equal(lessonStep(l, 3, 2), l.hints[3]); assert.equal(lessonStep(l, 99, 5), l.hints[n - 1]);
    assert.ok(!/①/.test(l.text) && /안내 없이/.test(l.text));
  }
  // 시험의 짝 순서는 2부의 직접 쌓기와 같다
  assert.deepEqual(lesson('real-exam4').pairs, lesson('real-scratch4').pairs);
  assert.deepEqual(lesson('real-exam3').pairs, lesson('scratch').pairs);
  assert.equal(playLesson(lesson('real-exam3'), [[5, 0], [4, 0], [3, 0], [2, 0], [1, 0], [0, 0]]), 'retry');
});

// ---------- 졸업, 졸업2, 졸업3 (찐 마지막 다음, 모두 길게) ----------
// 세 수·네 수 퍼즐은 안내(steps)가 있어도 쌓기가 아니라 퍼즐로 센다. flat 눕혀서 발화, duo 두 색 발화, dig 방해 뿌요 속 발화점 (tutorial.test.mjs 에서 자세히 확인)
const kindOf = l => (l.tip ? 'tip' : /three/.test(l.id) ? 'three' : /four/.test(l.id) ? 'four' : l.steps ? 'build' : /find/.test(l.id) ? 'find' : /flat/.test(l.id) ? 'flat'
  : /duo/.test(l.id) ? 'duo' : /dig/.test(l.id) ? 'dig' : /mega/.test(l.id) ? 'mega' : /two/.test(l.id) ? 'two' : /exam/.test(l.id) ? 'exam' : '?');
const count = (list, kind) => list.filter(l => kindOf(l) === kind).length;
test('졸업 다섯: 찐 마지막 다음에 졸업 → 졸업2 → 졸업3 → 졸업4 → 졸업5, 모두 길다', () => {
  const [g1, g2, g3, g4, g5] = GRADES.slice(7);
  assert.deepEqual([g1.id, g2.id, g3.id, g4.id, g5.id], ['grad1', 'grad2', 'grad3', 'grad4', 'grad5']);
  assert.deepEqual([g1.lessons.length, g2.lessons.length, g3.lessons.length, g4.lessons.length, g5.lessons.length], [26, 20, 62, 63, 65]);
  for (const g of [g1, g2, g3, g4, g5]) assert.ok(g.lessons.length >= 20, `${g.name}: 길게`);
  // 졸업: 발화점 찾기 22판 (2연쇄 → 10연쇄로 점점 길어진다)
  assert.equal(count(g1.lessons, 'find'), 22); assert.equal(count(g1.lessons, 'tip'), 4);
  const chains = g1.lessons.filter(l => kindOf(l) === 'find').map(l => l.goal.chain);
  assert.deepEqual(chains, [2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10]);
  // 졸업2: 쌓기 3개 → 두 수 퍼즐 9판 → 쌓기 시험 3개 → 6연쇄 쌓기
  assert.deepEqual(g2.lessons.map(kindOf), ['tip', 'build', 'build', 'build', 'tip', ...Array(9).fill('two'), 'tip', 'exam', 'exam', 'exam', 'build', 'tip']);
  // 졸업3 (처음 25가지는 그대로): 초대연쇄 3 → 발화점 찾기 6 → 두 수 퍼즐 4 → 쌓기 시험 2 → [더한 여섯 부] → 졸업 비결 5 와 졸업장
  const first = ['tip', 'mega', 'mega', 'mega', 'tip', ...Array(6).fill('find'), 'tip', ...Array(4).fill('two'), 'tip', 'exam', 'exam'];
  assert.deepEqual(g3.lessons.slice(0, 19).map(kindOf), first);
  assert.deepEqual(g3.lessons.slice(-6).map(kindOf), Array(6).fill('tip'));
  assert.deepEqual([...g3.lessons.slice(0, 19), ...g3.lessons.slice(-6)].map(l => l.id), ['grad3-part1', 'grad3-mega1', 'grad3-mega2', 'grad3-mega3', 'grad3-part2',
    'grad3-find1', 'grad3-find2', 'grad3-find3', 'grad3-find4', 'grad3-find5', 'grad3-find6', 'grad3-part3', 'grad3-two1', 'grad3-two2', 'grad3-two3', 'grad3-two4',
    'grad3-part4', 'grad3-exam5r', 'grad3-exam6', 'grad3-tip1', 'grad3-tip2', 'grad3-tip3', 'grad3-tip4', 'grad3-tip5', 'grad3-diploma']);
  assert.equal(g3.lessons.at(-1).title, '🎓 졸업장');
  assert.match(g3.lessons.at(-1).text, /초급부터 졸업3까지 뿌요뿌요 배우기 열 단계를 모두 마쳤습니다/);
  // 선물은 갈수록 커진다
  assert.deepEqual(GRADES.slice(6).map(g => g.reward.coins), [10000, 15000, 20000, 30000, 40000, 60000, 80000, 100000, 130000, 170000, 250000]);
  const ids = GRADES.flatMap(g => g.lessons.map(l => l.id));
  assert.equal(new Set(ids).size, ids.length); assert.equal(ids.length, 831); // 졸업5까지 291 + 졸업6~10 의 75 + 85 + 100 + 130 + 150
});

test('졸업: 발화점 찾기는 자리를 알려 주지 않고, 두 번 틀리면 도움말이 나온다', () => {
  const finds = GRADES.slice(7, 12).flatMap(g => g.lessons).filter(l => kindOf(l) === 'find'); // 졸업6~10 은 tutorial.test.mjs
  assert.equal(finds.length, 48); // 졸업 22 + 졸업3 6 + 졸업4 10 + 졸업5 10
  for (const l of finds) {
    const cells = lessonCells(l), h = heights(cells), [[x, rot]] = l.answer;
    assert.equal(findGroups(cells).length, 0, l.id);
    assert.ok(h[2] <= 9 && Math.max(...h) <= 11, `${l.id}: 높이`);
    assert.ok(!/줄/.test(l.text), `${l.id}: 문제 글에는 자리가 없다`);
    assert.equal(lessonStep(l, 0, 0), null); assert.equal(lessonStep(l, 0, 1), null);
    assert.match(lessonStep(l, 0, 2), /^도움말: .+ 짝을 .+ 줄.*에 (세워서|눕혀서) 놓아 봐/);
    assert.equal(l.pairs[0][0], l.pairs[0][1]); // 같은 색 짝
    // 엔진으로: 그 자리에 놓으면 적힌 만큼 이어지고 전소
    cells[h[x] * 6 + x] = l.pairs[0][0];
    if (rot === 1) cells[h[x + 1] * 6 + x + 1] = l.pairs[0][1]; else cells[(h[x] + 1) * 6 + x] = l.pairs[0][1];
    assert.equal(resolveChain(cells).chain, l.goal.chain, l.id); assert.ok(isEmpty(cells), `${l.id}: 전소`);
    // 아무 데나 놓아서는 안 풀린다 (22가지 자리 가운데 풀리는 자리는 몇 개뿐)
    const solved = ALL_PLACES.filter(place => playLesson(l, [place]) === 'done').length;
    assert.ok(solved >= 1 && solved <= 6, `${l.id}: 풀리는 자리 ${solved}개`);
  }
});

test('졸업3·졸업4·졸업5: 초대연쇄 11연쇄부터 16연쇄까지 한 번 놓아 전소까지', () => {
  const megas = GRADES.slice(9, 12).flatMap(g => g.lessons).filter(l => kindOf(l) === 'mega');
  assert.deepEqual(megas.map(l => l.goal.chain), [11, 12, 13, 14, 14, 15, 15, 16]);
  for (const l of megas) {
    const cells = lessonCells(l), h = heights(cells), [[x]] = l.answer;
    assert.match(l.text, new RegExp(`${l.goal.chain}연쇄`)); assert.match(l.text, /줄에 세워서/); // 자리를 알려 준다
    cells[h[x] * 6 + x] = l.pairs[0][0]; cells[(h[x] + 1) * 6 + x] = l.pairs[0][1];
    assert.equal(resolveChain(cells).chain, l.goal.chain); assert.ok(isEmpty(cells));
  }
});

test('두 수 퍼즐: 첫 짝으로 채우고 둘째 짝으로 발화해야 끝까지 이어진다', () => {
  const twos = GRADES.slice(7, 12).flatMap(g => g.lessons).filter(l => kindOf(l) === 'two');
  assert.equal(twos.length, 31); // 졸업2 9 + 졸업3 4 + 졸업4 10 + 졸업5 8
  for (const l of twos) {
    const [setup, fire] = l.answer;
    assert.equal(l.goal.moves, 2); assert.equal(l.pairs.length, 2);
    assert.equal(playLesson(l, [setup, fire]), 'done', l.id);
    assert.equal(playLesson(l, [fire, setup]), 'retry', `${l.id}: 순서를 바꾸면 중간에 끊긴다`);
    assert.equal(playLesson(l, [setup]), null); // 채우기만 해서는 아직 아무 일도 없다
  }
  // 졸업2는 자리를 알려 주고(①, ②), 졸업3은 알려 주지 않다가 두 번 틀리면 도움말
  for (const l of GRADES[8].lessons.filter(x => kindOf(x) === 'two')) { assert.match(l.text, /^① .+ ② /); assert.equal(l.hints, undefined); }
  for (const l of GRADES[9].lessons.filter(x => kindOf(x) === 'two')) {
    assert.ok(!/줄/.test(l.text)); assert.equal(lessonStep(l, 0, 1), null);
    assert.match(lessonStep(l, 0, 2), /^도움말 ① /); assert.match(lessonStep(l, 1, 2), /^도움말 ② /);
  }
});

test('졸업2·졸업3: 오른쪽 계단, 끼워 넣기, 6연쇄를 빈 필드에서 쌓고, 시험은 같은 짝 순서로 안내 없이', () => {
  const by = id => lesson(id);
  for (const [id, chain, n] of [['grad2-right4', 4, 8], ['grad2-right5', 5, 10], ['grad2-sandwich', 3, 7], ['grad2-scratch6', 6, 12]]) {
    const l = by(id);
    assert.equal(l.field.length, 0); assert.equal(l.goal.chain, chain); assert.equal(l.pairs.length, n); assert.equal(l.steps.length, n);
    assert.deepEqual(l.steps.map(t => t.match(/[①-⑫]/)?.[0]), [...'①②③④⑤⑥⑦⑧⑨⑩⑪⑫'].slice(0, n));
    // 마지막 짝을 엉뚱한 데 놓으면 다시
    assert.equal(playLesson(l, [...l.answer.slice(0, -1), [l.answer.at(-1)[0] === 0 ? 5 : 0, 0]]), 'retry', id);
  }
  for (const [id, same] of [['grad2-exam5', 'real-scratch5'], ['grad2-exam4r', 'grad2-right4'], ['grad2-exam-sandwich', 'grad2-sandwich'], ['grad3-exam5r', 'grad2-right5'], ['grad3-exam6', 'grad2-scratch6']]) {
    const l = by(id), guided = by(same);
    assert.equal(l.steps, undefined); assert.deepEqual(l.pairs, guided.pairs); assert.equal(l.goal.chain, guided.goal.chain);
    assert.equal(lessonStep(l, 0, 1), null);
    assert.match(lessonStep(l, 0, 2), /^조금 어렵지\? 이번에는 같이 하자! ①/);
    assert.equal(lessonStep(l, 1, 2), guided.steps[1]);
  }
});
