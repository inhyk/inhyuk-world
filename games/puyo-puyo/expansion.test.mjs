import test from 'node:test';
import assert from 'node:assert/strict';
import { findGroups, parseField, Player, makeSequence, resolveChain } from './core.mjs';
import { Match } from './match.mjs';
import { MAPS } from './maps.mjs';
import { newProgress, sanitize, emptyStore, createAccount, exportCode, importCode } from './profile.mjs';
import { clearFloor, floorState, floorReward, currentFloor } from './tower.mjs';
import { AI_LEVELS, AIController } from './ai.mjs';
import { SKINS, EFFECTS, redeem, canRedeem } from './shop.mjs';
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
  assert.equal(SKINS.length, 20); assert.equal(EFFECTS.length, 19);
  const p = newProgress(); p.tickets.skin = 2; p.tickets.effect = 1;
  assert.equal(canRedeem(p, 'skin', 'aurora'), false);
  assert.equal(canRedeem(p, 'effect', 'nova'), false);
  assert.equal(redeem(p, 'skin', 'astronaut'), true); // 레벨 1이어도 교환 가능
  assert.equal(p.coins, 100); assert.equal(p.equip.skin, 'astronaut'); assert.equal(p.tickets.skin, 1);
  assert.equal(redeem(p, 'skin', 'astronaut'), false); assert.equal(p.tickets.skin, 1);
  assert.equal(redeem(p, 'effect', 'portal'), true); assert.equal(p.equip.effect, 'portal');
  assert.equal(redeem(p, 'effect', 'butterfly'), false);
});

test('매일 선물·시간 선물·스핀은 교환권을 주고 추가 스핀권을 정확히 소모한다', () => {
  const p = newProgress();
  claimDaily(p, normal); assert.equal(p.tickets.effect, 1);
  addPlayTime(p, 1800, normal);
  claimTime(p, '5m', normal); claimTime(p, '15m', normal); claimTime(p, '30m', normal);
  assert.deepEqual(p.tickets, { skin: 1, effect: 2, spin: 1 });
  spin(p, normal, () => .4); assert.equal(p.tickets.skin, 2); assert.equal(p.tickets.spin, 1); // 무료 우선
  assert.equal(rewardView(p, normal).spinClaimed, false);
  spin(p, normal, () => .6); assert.equal(p.tickets.effect, 3); assert.equal(p.tickets.spin, 0);
  assert.equal(rewardView(p, normal).spinClaimed, true);
  const before = structuredClone(p); assert.equal(spin(p, normal), null); assert.equal(claimTime(p, '30m', normal), null); assert.deepEqual(p, before);
  grantReward(p, { tickets: { skin: 1, effect: 2, spin: 3 } }, new Date('2027-05-12T12:00:00+09:00'));
  assert.deepEqual(p.tickets, { skin: 3, effect: 5, spin: 3 }); // 생일 배율은 교환권에 적용하지 않음
});

test('옛 기록을 복원하고 교환권·새 보스·안내 횟수·맵 선택도 기록 코드에 보존', async () => {
  assert.deepEqual(sanitize({}).tickets, { skin: 0, effect: 0, spin: 0 });
  assert.deepEqual(sanitize({ tickets: { skin: -2, effect: 'oops', spin: Infinity } }).tickets, { skin: 0, effect: 0, spin: 0 });
  const { account } = await createAccount(emptyStore(), '우주왕', 'abcd');
  account.progress.tickets = { skin: 2, effect: 3, spin: 4 }; account.progress.tower.nova = true;
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
