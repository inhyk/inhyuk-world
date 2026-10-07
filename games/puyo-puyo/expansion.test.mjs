import test from 'node:test';
import assert from 'node:assert/strict';
import { findGroups, parseField, Player, makeSequence, resolveChain } from './core.mjs';
import { Match } from './match.mjs';
import { MAPS } from './maps.mjs';
import { newProgress, sanitize, emptyStore, createAccount, exportCode, importCode } from './profile.mjs';
import { clearFloor, floorState, floorReward, currentFloor } from './tower.mjs';
import { AI_LEVELS, AIController } from './ai.mjs';
import { SKINS, EFFECTS, RANK_SKIN, redeem, canRedeem, canBuy, buy } from './shop.mjs';
import { SKIN_IDS } from './skins.mjs';
import { grantReward, claimDaily, claimTime, addPlayTime, spin, rewardView } from './rewards.mjs';
import { MISSIONS, track, claim, missionView } from './missions.mjs';
import { consumePromo } from './promo.mjs';
const normal = new Date('2026-10-02T12:00:00+09:00');

test('6개 맵: 4·5개는 남고 6개는 점수·상쇄·공격·전소까지 계산된다', () => {
  for (const count of [4, 5, 6]) {
    const cells = parseField(['R'.repeat(count)]);
    assert.equal(findGroups(cells).length, 1);
    assert.equal(findGroups(cells, 6).length, count === 6 ? 1 : 0);
    const p = new Player({ seq: makeSequence(3), minGroup: 6 });
    p.cells.set(cells); p.refreshHeights(); p.incoming = 1;
    p.check({ canReceive: false });
    assert.equal(p.state, count === 6 ? 'pop' : 'spawn');
    if (count === 6) { assert.equal(p.score, 180); assert.equal(p.incoming, 0); assert.equal(p.events.find(e => e.type === 'send').amount, 1); }
    const result = resolveChain(cells, 70, 6);
    assert.equal(result.chain, count === 6 ? 1 : 0);
    assert.equal(result.allClear, count === 6);
  }
});

test('모든 맵의 규칙은 양쪽 필드와 다음 라운드에 동일하게 적용된다', () => {
  const defaultMatch = new Match({ seed: 4, specs: [{ kind: 'human' }, { kind: 'human' }] });
  for (const map of MAPS) {
    const m = new Match({ ...map, seed: 4, specs: [{ kind: 'human' }, { kind: 'human' }] });
    for (let round = 0; round < 2; round++) {
      assert.equal(m.players[0].minGroup, map.minGroup); assert.equal(m.players[1].minGroup, map.minGroup);
      assert.deepEqual(m.players[0].seq.puyos, m.players[1].seq.puyos);
      assert.equal(new Set(m.seq.puyos).size, map.colors);
      assert.equal(m.target, map.target);
      assert.equal(m.gravity(), defaultMatch.gravity() * map.gravityScale);
      m.startRound();
    }
  }
});

test('혜성을 깨야 노바 해제, 노바의 첫 보상·재도전 보상·기록은 따로다', () => {
  const p = newProgress();
  assert.equal(floorState(p.tower, 8), 'hidden');
  for (let f = 1; f <= 6; f++) clearFloor(p.tower, f);
  assert.equal(floorState(p.tower, 8), 'hidden');
  clearFloor(p.tower, 7);
  assert.equal(currentFloor(p.tower), 8); assert.equal(floorState(p.tower, 8), 'open');
  assert.equal(floorReward(p.tower, 8).first, true);
  assert.equal(floorReward(p.tower, 7).first, false);
  assert.equal(clearFloor(p.tower, 8).novaFirst, true);
  assert.equal(clearFloor(p.tower, 8).novaFirst, false);
  assert.equal(floorReward(p.tower, 8).coins, 700);
  assert.equal(floorState(p.tower, 8), 'cleared');
  assert.equal(sanitize(p).tower.nova, true);
  const ai = new AIController(8);
  assert.equal(ai.level, 8); assert.ok(AI_LEVELS[8].interval < AI_LEVELS[7].interval);
});

test('새 스킨은 실제 그림이 있고 교환권은 원하는 판매 상품만 한 번 해제한다', () => {
  for (const item of SKINS) assert.ok(SKIN_IDS.includes(item.id), item.id);
  assert.equal(SKINS.length, 33); assert.equal(EFFECTS.length, 21);
  const p = newProgress(); p.tickets.skin = 2; p.tickets.effect = 1;
  assert.equal(canRedeem(p, 'skin', 'aurora'), false);
  assert.equal(canRedeem(p, 'effect', 'nova'), false);
  assert.equal(redeem(p, 'skin', 'astronaut'), true); // 레벨 1이어도 교환 가능
  assert.equal(p.coins, 100); assert.equal(p.equip.skin, 'astronaut'); assert.equal(p.tickets.skin, 1);
  assert.equal(redeem(p, 'skin', 'astronaut'), false); assert.equal(p.tickets.skin, 1);
  assert.equal(redeem(p, 'effect', 'portal'), true); assert.equal(p.equip.effect, 'portal');
  assert.equal(redeem(p, 'effect', 'butterfly'), false);
});

// 업그레이드 3 (인혁이 기획서 2번): 30·40·50·60·70·99레벨 고난이도 스킨과 30·50레벨 효과
test('고난이도 레벨 상품은 그 레벨이 되어야 코인으로 사고, 교환권으로는 받을 수 없다', () => {
  const hardSkins = SKINS.filter(s => s.noTicket), hardEffects = EFFECTS.filter(s => s.noTicket);
  assert.deepEqual(hardSkins.map(s => s.level), [30, 40, 50, 60, 70, 99]);
  assert.deepEqual(hardEffects.map(s => s.level), [30, 50]);
  const p = newProgress(); p.tickets.skin = 5; p.tickets.effect = 5; p.coins = 1e6;
  for (const item of hardSkins) {
    assert.equal(canRedeem(p, 'skin', item.id), false, item.id);
    assert.equal(redeem(p, 'skin', item.id), false, item.id);
    p.level = item.level - 1; assert.equal(canBuy(p, 'skin', item.id), 'level', item.id);
    p.level = item.level; assert.equal(canBuy(p, 'skin', item.id), 'ok', item.id);
  }
  for (const item of hardEffects) assert.equal(canRedeem(p, 'effect', item.id), false, item.id);
  assert.equal(p.tickets.skin, 5); assert.equal(p.tickets.effect, 5);
  // 레벨이 되어도 코인이 모자라면 못 산다
  p.level = 30; p.coins = 4999; assert.equal(canBuy(p, 'skin', 'knight'), 'coins');
  p.coins = 5000; assert.equal(buy(p, 'skin', 'knight'), 'bought'); assert.equal(p.coins, 0); assert.equal(p.equip.skin, 'knight');
  // 레벨 제한이 없는 새 스킨 6가지는 교환권으로도 받는다
  for (const id of ['chick', 'penguin', 'cookie', 'ninja', 'pumpkin', 'octopus']) assert.equal(canRedeem(p, 'skin', id), true, id);
});

// 기획서 6번: 온라인 랭킹 5등 안에 든 사람만 받는 스킨
test('랭킹 5등 스킨은 코인, 교환권, 제작자 모드로 받을 수 없다', () => {
  const item = SKINS.find(s => s.id === RANK_SKIN);
  assert.equal(item.reward, 'ranking');
  const p = newProgress(); p.level = 99; p.coins = 1e9; p.tickets.skin = 9;
  assert.equal(canBuy(p, 'skin', RANK_SKIN), 'reward');
  assert.equal(buy(p, 'skin', RANK_SKIN), 'reward');
  assert.equal(canRedeem(p, 'skin', RANK_SKIN), false);
  assert.equal(p.owned.skin.includes(RANK_SKIN), false);
});

test('매일 선물·시간 선물·스핀은 교환권을 주고 추가 스핀권을 정확히 소모한다', () => {
  const p = newProgress();
  claimDaily(p, normal); assert.equal(p.tickets.effect, 1);
  addPlayTime(p, 1800, normal);
  claimTime(p, '5m', normal); claimTime(p, '15m', normal); claimTime(p, '30m', normal);
  assert.deepEqual(p.tickets, { skin: 1, effect: 2, spin: 1, pet: 0, boost: 0 });
  spin(p, normal, () => .4); assert.equal(p.tickets.skin, 2); assert.equal(p.tickets.spin, 1); // 무료 우선
  assert.equal(rewardView(p, normal).spinClaimed, false);
  spin(p, normal, () => .6); assert.equal(p.tickets.effect, 3); assert.equal(p.tickets.spin, 0);
  assert.equal(rewardView(p, normal).spinClaimed, true);
  const before = structuredClone(p); assert.equal(spin(p, normal), null); assert.equal(claimTime(p, '30m', normal), null); assert.deepEqual(p, before);
  grantReward(p, { tickets: { skin: 1, effect: 2, spin: 3 } }, new Date('2027-05-12T12:00:00+09:00'));
  assert.deepEqual(p.tickets, { skin: 3, effect: 5, spin: 3, pet: 0, boost: 0 }); // 생일 배율은 교환권에 적용하지 않음
});

test('옛 기록을 복원하고 교환권·새 보스·안내 횟수·맵 선택도 기록 코드에 보존', async () => {
  assert.deepEqual(sanitize({}).tickets, { skin: 0, effect: 0, spin: 0, pet: 0, boost: 0 });
  assert.deepEqual(sanitize({ tickets: { skin: -2, effect: 'oops', spin: Infinity, pet: -1, boost: 'x' } }).tickets, { skin: 0, effect: 0, spin: 0, pet: 0, boost: 0 });
  const { account } = await createAccount(emptyStore(), '우주왕', 'abcd');
  account.progress.tickets = { skin: 2, effect: 3, spin: 4, pet: 5, boost: 6 }; account.progress.tower.nova = true;
  account.progress.promo.lastGame = 10; account.progress.settings.localMap = 'six';
  const imported = importCode(emptyStore(), exportCode(account)).account.progress;
  assert.deepEqual(imported.tickets, account.progress.tickets); assert.equal(imported.tower.nova, true);
  assert.equal(imported.promo.lastGame, 10); assert.equal(imported.settings.localMap, 'six');
});

test('챌린지는 140개 이상, ID가 고유하고 맵·선물·수집 목표가 연결된다', () => {
  assert.ok(MISSIONS.length >= 140); assert.equal(new Set(MISSIONS.map(m => m.id)).size, MISSIONS.length);
  const p = newProgress();
  track(p, { type: 'match', mode: 'local', map: 'ice', win: true });
  assert.ok(claim(p, 'map-ice-1')); assert.equal(claim(p, 'map-six-1'), null);
  track(p, { type: 'gift', kind: 'daily' }); assert.ok(claim(p, 'gift-daily-1')); assert.equal(claim(p, 'gift-daily-1'), null);
  track(p, { type: 'collection', skin: 3, effect: 1 }); assert.ok(claim(p, 'collect-skin-3'));
  track(p, { type: 'career', games: 50, wins: 10, localGames: 3, onlineGames: 0 }); assert.ok(claim(p, 'career-games-50'));
  assert.equal(missionView(p).list.length, MISSIONS.length);
});

test('seonn 안내는 완료한 게임 5·10·15번마다 한 번, 재실행에도 중복되지 않는다', () => {
  let p = newProgress(); const shown = [];
  for (let games = 1; games <= 16; games++) {
    p.stats.games = games;
    if (consumePromo(p)) shown.push(games);
    p = sanitize(JSON.parse(JSON.stringify(p)));
    assert.equal(consumePromo(p), false);
  }
  assert.deepEqual(shown, [5, 10, 15]);
});
