// 인혁이 기획서 「뿌요뿌요 (업그레이드)」(2026-10-09): 새 스킨(1번), 광고 보고 선물 받기(4번), 새 노래와 예전 노래(5, 6번)의 규칙.
// 졸업6~10(3번)은 tutorial.test.mjs 와 upgrade4.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SKINS, EFFECTS, canBuy, canRedeem } from './shop.mjs';
import { SKIN_IDS, SKIN_STYLE, drawSkinLayer } from './skins.mjs';
import { AD_REWARDS, AD_SECONDS, adView, claimAd, rewardPreview } from './rewards.mjs';
import { newProgress, sanitize, AD_IDS } from './profile.mjs';
import { SONGS, CLASSIC, songProblems } from './audio.mjs';
import { MISSIONS, track, compactMissions } from './missions.mjs';
import { cloudPayload } from './cloud.mjs';
import { maxProgress, bytes } from './save-size.fixture.mjs';

const NEW_COIN = ['frog', 'bee', 'icecream', 'panda', 'mushroom', 'snowman', 'pirate', 'alien', 'shark', 'unicorn'];
const NEW_LEVEL = ['diamond', 'sun'];

// ---------- 1번: 스킨을 더 ----------
test('새 스킨 12가지: 코인 스킨 10가지와 레벨 스킨 2가지가 상점에 있고 그림도 있다', () => {
  assert.equal(SKINS.length, 45);
  assert.equal(new Set(SKINS.map(s => s.id)).size, SKINS.length);
  for (const id of [...NEW_COIN, ...NEW_LEVEL]) {
    const item = SKINS.find(s => s.id === id);
    assert.ok(item, id);
    assert.ok(SKIN_IDS.includes(id), `${id} 그림`);
    assert.equal(SKIN_STYLE[id].connect, false);
    assert.ok(item.name.includes('뿌요') && item.desc.length > 5, id);
  }
  for (const id of NEW_COIN) { const item = SKINS.find(s => s.id === id); assert.ok(item.price >= 500 && item.price <= 4000 && item.level <= 20 && !item.noTicket, id); }
  assert.deepEqual(NEW_LEVEL.map(id => SKINS.find(s => s.id === id).level), [80, 90]);
  for (const item of SKINS) assert.ok(SKIN_IDS.includes(item.id), `${item.id} 그림 없음`);
  assert.equal(EFFECTS.length, 21);
});

test('레벨 스킨(다이아, 태양)은 그 레벨이 되어야 사고 교환권으로는 못 받는다. 코인 스킨은 교환권으로도 받는다', () => {
  const p = newProgress();
  Object.assign(p, { level: 79, coins: 999999 }); p.tickets.skin = 5;
  assert.equal(canBuy(p, 'skin', 'diamond'), 'level');
  assert.equal(canRedeem(p, 'skin', 'diamond'), false);
  p.level = 80;
  assert.equal(canBuy(p, 'skin', 'diamond'), 'ok');
  assert.equal(canBuy(p, 'skin', 'sun'), 'level');
  assert.equal(canRedeem(p, 'skin', 'unicorn'), true);
});

// 그리기 함수가 어떤 색·층·표정에서도 멈추지 않는지 (가짜 캔버스로)
test('새 스킨은 다섯 색, 몸과 얼굴, 세 가지 표정을 모두 그린다', () => {
  let calls = 0;
  const fake = new Proxy(function () {}, { get: (_, key) => (key === Symbol.toPrimitive ? () => 0 : fake), set: () => true, apply: () => { calls++; return fake; } });
  for (const id of [...NEW_COIN, ...NEW_LEVEL]) {
    for (let color = 1; color <= 6; color++) for (const layer of ['body', 'face']) for (const v of [0, 1, 2]) {
      const before = calls;
      drawSkinLayer(fake, id, color, 30, layer, v);
      assert.ok(calls > before + 3, `${id} ${color} ${layer} ${v}`);
    }
  }
});

// ---------- 4번: 광고 보고 선물 받기 ----------
test('광고 선물: 코인 1000 은 하루 세 번, 부스트·스핀권·펫 뽑기권은 하루 한 번', () => {
  assert.deepEqual(AD_REWARDS.map(r => r.id), AD_IDS);
  assert.ok(AD_SECONDS >= 5 && AD_SECONDS <= 30);
  const coins = AD_REWARDS.find(r => r.id === 'coins');
  assert.equal(coins.coins, 1000);
  assert.equal(coins.title, '코인 1000 받기');
  const day = new Date('2026-10-09T03:00:00Z'); // 한국 시간 낮 12시, 생일도 공휴일도 아닌 날
  assert.equal(rewardPreview(coins, day).coins, 1000);
  const p = newProgress(), start = p.coins;
  assert.deepEqual(adView(p, day).map(r => [r.id, r.left]), [['coins', 3], ['boost', 1], ['spin', 1], ['pet', 1]]);
  for (let i = 1; i <= 3; i++) { assert.ok(claimAd(p, 'coins', day)); assert.equal(p.coins, start + 1000 * i); }
  assert.equal(claimAd(p, 'coins', day), null);
  assert.equal(p.coins, start + 3000);
  assert.ok(claimAd(p, 'boost', day)); assert.equal(p.tickets.boost, 1); assert.equal(claimAd(p, 'boost', day), null);
  assert.ok(claimAd(p, 'spin', day)); assert.equal(p.tickets.spin, 1);
  assert.ok(claimAd(p, 'pet', day)); assert.equal(p.tickets.pet, 1);
  assert.equal(claimAd(p, 'nope', day), null);
  assert.deepEqual(adView(p, day).map(r => r.left), [0, 0, 0, 0]);
  // 다음 날(한국 시간 밤 12시가 지나면) 다시 채워진다
  const next = new Date('2026-10-09T15:30:00Z');
  assert.deepEqual(adView(p, next).map(r => r.left), [3, 1, 1, 1]);
  assert.ok(claimAd(p, 'coins', next));
});

test('광고 선물 횟수는 기록에 남고, 이상한 값은 고친다', () => {
  const day = new Date('2026-10-09T03:00:00Z');
  const p = newProgress();
  claimAd(p, 'coins', day); claimAd(p, 'coins', day); claimAd(p, 'pet', day);
  const saved = sanitize(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(saved.rewards.ads, { coins: 2, pet: 1 });
  assert.deepEqual(adView(saved, day).map(r => r.left), [1, 1, 1, 0]);
  assert.deepEqual(sanitize({ ...newProgress(), rewards: { ads: { coins: -3, boost: 'x', hack: 9, spin: 1.9 } } }).rewards.ads, { spin: 1 });
  assert.deepEqual(sanitize(newProgress()).rewards.ads, {});
  assert.deepEqual(cloudPayload(saved).rewards.ads, { coins: 2, pet: 1 });
});

test('광고 선물 챌린지: 받을 때마다 쌓인다', () => {
  const p = newProgress();
  assert.deepEqual(track(p, { type: 'gift', kind: 'ad' }).map(d => d.id), ['gift-ad-1']);
  for (let i = 0; i < 4; i++) track(p, { type: 'gift', kind: 'ad' });
  assert.equal(p.missions['gift-ad-5'].v, 5);
  assert.equal(p.missions['gift-daily-1'].v, 0);
});

// ---------- 5, 6번: 새 노래와 예전 노래 ----------
test('새 노래 네 곡: 16마디이고 엔진이 읽을 수 있는 모양이다. 예전 노래 네 곡도 그대로 있다', () => {
  assert.deepEqual(Object.keys(SONGS), ['menu', 'battle', 'boss', 'ending']);
  assert.deepEqual(Object.keys(CLASSIC), ['menu', 'battle', 'boss', 'ending']);
  for (const [name, def] of Object.entries(SONGS)) {
    assert.deepEqual(songProblems(def), [], `새 ${name}`);
    assert.equal(def.lead.length, 16, name);
    assert.ok(def.inst && def.chords.length === 16 && Array.isArray(def.drums), name);
    assert.notDeepEqual(def.lead.slice(0, 8), CLASSIC[name].lead, `${name} 가락이 예전과 다르다`);
    assert.notDeepEqual(def.lead.slice(0, 8), def.lead.slice(8), `${name} 앞 여덟 마디와 뒤 여덟 마디가 다르다`);
  }
  for (const [name, def] of Object.entries(CLASSIC)) { assert.deepEqual(songProblems(def), [], `예전 ${name}`); assert.equal(def.lead.length, 8); }
  // 예전 노래는 한 글자도 바뀌지 않았다 (이스터에그로 듣는 그 노래)
  assert.equal(CLASSIC.menu.lead[0], 'E5 G5 C6 G5 E5 G5 A5 G5');
  assert.equal(CLASSIC.battle.bpm, 142);
  assert.deepEqual(songProblems({ bpm: 120, lead: ['C5 E5'], bass: ['C3 . . .'], drums: 'k...' }).length > 0, true);
});

// ---------- 저장 크기 ----------
test('클라우드 저장: 목표를 넘은 챌린지 진행도는 목표까지만 적는다 (모르는 챌린지는 그대로)', () => {
  const out = compactMissions({ 'win-10': { v: 999, claimed: true }, 'pop-total-50': { v: 20, claimed: false }, future: { v: 12345, claimed: false } });
  assert.deepEqual(out, { 'win-10': { v: 10, claimed: true }, 'pop-total-50': { v: 20, claimed: false }, future: { v: 12345, claimed: false } });
  assert.deepEqual(compactMissions(null), {});
  const p = newProgress();
  p.missions['win-1'] = { v: 77, claimed: false };
  assert.equal(cloudPayload(p).missions['win-1'].v, 1);
  assert.equal(p.missions['win-1'].v, 77); // 기기 기록은 손대지 않는다
  const size = bytes(cloudPayload(maxProgress({ social: false })));
  assert.ok(MISSIONS.length >= 246);
  assert.ok(size < 16 * 1024, `저장 ${size}바이트`);
});
