// 인혁이 기획서 「뿌요뿌요 (업그레이드)」(2026-10-10): 대전 화면의 하늘(1번), 방해 뿌요 힘겨루기(2번),
// 온라인 캐릭터 고르기(3번), 혜성 엔딩이 마지막 글만 나오던 버그(4번), 그리고 "스킨도 더 넣어줘"의 규칙.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SKIES, SKY_IDS, skyAtHour, skyAt, getSky, skyText } from './sky.mjs';
import { Clash, clashGain, CLASH_MIN, CLASH_MAX, CLASH_HOLD } from './clash.mjs';
import { FIGHTERS, cleanFighter, fighterIndex, fighterOpen, fighterHint, pickFighter } from './fighters.mjs';
import { elapsed, cometScene, COMET_ENDING_SECONDS } from './ending.mjs';
import { Match } from './match.mjs';
import { computeLayout, THEMES } from './render.mjs';
import { cleanPeer } from './online.mjs';
import { CHARACTER_IDS } from './characters.mjs';
import { FLOORS } from './tower.mjs';
import { SKINS, canBuy, canRedeem } from './shop.mjs';
import { SKIN_IDS, SKIN_STYLE } from './skins.mjs';
import { newProgress, sanitize } from './profile.mjs';
import { cloudPayload } from './cloud.mjs';
import { maxProgress, bytes } from './save-size.fixture.mjs';
import { SAVE_MAX_BYTES } from '../../services/net/src/saves.js';

// ---------- 1번: 밤이면 밤하늘, 아침이면 아침 하늘 ----------
test('하늘은 시각에 맞춰 아침(5시~) · 낮(11시~) · 저녁(17시~) · 밤(20시~다음 날 5시 전)', () => {
  assert.deepEqual(SKY_IDS, ['morning', 'noon', 'evening', 'night']);
  const at = h => skyAtHour(h).id;
  assert.deepEqual([0, 3, 4].map(at), ['night', 'night', 'night']);
  assert.deepEqual([5, 7, 10].map(at), ['morning', 'morning', 'morning']);
  assert.deepEqual([11, 13, 16].map(at), ['noon', 'noon', 'noon']);
  assert.deepEqual([17, 18, 19].map(at), ['evening', 'evening', 'evening']);
  assert.deepEqual([20, 22, 23].map(at), ['night', 'night', 'night']);
  assert.equal(at(24), 'night'); assert.equal(at(29), 'morning'); assert.equal(at(-1), 'night');
  assert.equal(skyAt(new Date(2026, 9, 10, 21, 30)).id, 'night');
  assert.equal(skyAt(new Date(2026, 9, 10, 7, 0)).id, 'morning');
  assert.equal(getSky('evening').name, '저녁 하늘');
  assert.equal(getSky('없는하늘'), null);
  assert.equal(skyText(getSky('night')), '🌙 지금은 밤이라 밤하늘이야!');
  assert.equal(skyText(getSky('morning')), '🌅 지금은 아침이라 아침 하늘이야!');
  for (const sky of SKIES) assert.equal(THEMES[sky.id].length, 3, `${sky.id} 배경 색`);
});

// ---------- 2번: 방해 뿌요 힘겨루기 ----------
test('힘겨루기: 판 이벤트에서 누가 방해 뿌요를 얼마나 만들었는지 센다', () => {
  const local = [{ kind: 'human' }, { kind: 'ai' }], net = [{ kind: 'human' }, { kind: 'remote' }];
  assert.deepEqual(clashGain({ p: 0, type: 'send', amount: 7 }, local), [0, 7]);
  assert.deepEqual(clashGain({ p: 1, type: 'send', amount: 3 }, local), [1, 3]);
  assert.deepEqual(clashGain({ p: 1, type: 'offset', amount: 5 }, local), [1, 5]);
  // 같은 기기의 상대가 보낸 것은 send 로 이미 셌으므로 incoming 은 세지 않는다
  assert.equal(clashGain({ p: 0, type: 'incoming', amount: 3 }, local), null);
  // 온라인 상대가 보낸 것은 내 쪽 incoming 으로만 온다. 상쇄는 상대가 알려 준다.
  assert.deepEqual(clashGain({ p: 0, type: 'incoming', amount: 9 }, net), [1, 9]);
  assert.deepEqual(clashGain({ p: 1, type: 'offset', amount: 4 }, net), [1, 4]);
  assert.deepEqual(clashGain({ p: 0, type: 'send', amount: 6 }, net), [0, 6]);
  for (const e of [{ p: 0, type: 'pop', amount: 5 }, { p: -1, type: 'send', amount: 5 }, { p: 0, type: 'send', amount: 0 }, { p: 0, type: 'send' }, { p: 2, type: 'send', amount: 5 }, null]) assert.equal(clashGain(e, local), null);
});

test('힘겨루기: 센 쪽에서 약한 쪽으로 금이 밀리고, 방해 뿌요가 다 떨어지면 누가 이겼는지 알려 주고 가운데로 돌아온다', () => {
  const c = new Clash();
  assert.equal(c.pos, 0.5); assert.equal(c.fighting, false); assert.equal(c.leader, -1);
  c.add(0, 10);
  assert.equal(c.live, true); assert.equal(c.fighting, false); // 한 사람만 보냈을 때는 아직 "왔다 갔다"가 아니다
  assert.equal(c.target, CLASH_MAX);
  c.add(1, 30);
  assert.equal(c.fighting, true); assert.equal(c.leader, 1);
  assert.equal(c.target, 0.25);
  for (let i = 0; i < 200; i++) c.step(true);
  assert.equal(c.pos, 0.25); // 상대가 세면 금이 왼쪽(내 쪽)으로 온다
  assert.equal(c.takeEnded(), null);
  c.add(0, 50); // 내가 더 큰 연쇄로 받아쳤다
  assert.equal(c.leader, 0);
  for (let i = 0; i < 200; i++) c.step(true);
  assert.ok(Math.abs(c.pos - 60 / 90) < 1e-9);
  // 떨어질 것이 없어지면 잠깐 더 보여 주고 끝낸다
  for (let i = 0; i < CLASH_HOLD - 1; i++) c.step(false);
  assert.equal(c.live, true);
  c.step(false);
  assert.equal(c.live, false);
  assert.deepEqual(c.takeEnded(), { winner: 0, power: [60, 30] });
  assert.equal(c.takeEnded(), null); // 한 번만
  assert.deepEqual(c.power, [0, 0]);
  for (let i = 0; i < 200; i++) c.step(false);
  assert.equal(c.pos, 0.5);
  // 한 사람만 보낸 것은 싸움이 아니라서 승패를 알리지 않는다
  c.add(1, 4);
  assert.equal(c.target, CLASH_MIN);
  for (let i = 0; i < CLASH_HOLD; i++) c.step(false);
  assert.equal(c.takeEnded(), null);
  // 이상한 값은 무시
  c.add(2, 5); c.add(0, -3); c.add(0, NaN); c.add(0, 0.4);
  assert.equal(c.live, false);
  c.add(0, 5); c.add(1, 5);
  assert.equal(c.leader, -1); assert.equal(c.target, 0.5);
  c.reset();
  assert.deepEqual([c.power, c.pos, c.live, c.fought], [[0, 0], 0.5, false, false]);
});

test('힘겨루기: 진짜 대전(AI 끼리)에서 센 힘은 두 사람이 보낸 방해 뿌요 + 상쇄한 방해 뿌요와 같다', () => {
  let seed = 11;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const m = new Match({ seed: 5, specs: [{ kind: 'ai', level: 6 }, { kind: 'ai', level: 6 }], random });
  const sum = [0, 0];
  let frames = 0;
  while (m.phase !== 'roundEnd' && frames++ < 60 * 400) {
    m.step([]);
    for (const e of m.events) { const g = clashGain(e, m.specs); if (g) sum[g[0]] += g[1]; }
    m.events.length = 0;
  }
  assert.equal(m.phase, 'roundEnd');
  // 연쇄가 끝나야 garbageSent 에 더해지므로, 마지막 연쇄 도중에 판이 끝났으면 그만큼(chainSent) 더 세었을 수 있다
  m.players.forEach((p, i) => {
    const done = p.stats.garbageSent + p.stats.offsetAmount;
    assert.ok(sum[i] >= done && sum[i] <= done + (p.chainSent || 0), `${i}: ${sum[i]} / ${done}`);
  });
  assert.ok(sum[0] + sum[1] > 0, '방해 뿌요가 한 번은 오갔다');
});

test('힘겨루기 막대 자리: 대전 화면 맨 위, 필드와 예고 칸보다 위에 있고 화면 밖으로 나가지 않는다', () => {
  for (const [w, h] of [[1280, 720], [1100, 860], [390, 844], [844, 390], [768, 1024], [360, 640]]) {
    const insets = { top: 54, bottom: w < h ? 104 : 8, left: 8, right: 8 };
    const plain = computeLayout(w, h, { insets }), bar = computeLayout(w, h, { insets, clash: true });
    assert.equal(plain.clash ?? null, null);
    const b = bar.clash;
    assert.ok(b && b.w > 0 && b.h > 0, `${w}x${h}`);
    assert.ok(b.y >= insets.top - 0.5, `${w}x${h} 위쪽 단추 줄 아래`);
    assert.ok(b.x >= insets.left - 0.5 && b.x + b.w <= w - insets.right + 0.5, `${w}x${h} 좌우`);
    for (const tray of bar.tray) assert.ok(b.y + b.h <= tray.y + 0.5, `${w}x${h} 예고 칸 위`);
    for (const f of bar.fields) assert.ok(f.y + f.cell * 12 <= h - insets.bottom + 0.5, `${w}x${h} 필드가 아래로 안 넘침`);
    assert.ok(bar.cell >= plain.cell * 0.9, `${w}x${h} 칸이 너무 작아지지 않는다`);
  }
  // 혼자 하기와 관전에는 막대가 없다
  assert.equal(computeLayout(1280, 720, { solo: true, clash: true }).clash ?? null, null);
  assert.equal(computeLayout(1280, 720, { watch: true, clash: true }).clash ?? null, null);
});

// ---------- 3번: 온라인 대전 캐릭터 고르기 ----------
test('고를 수 있는 캐릭터: 주인공과 층 주인 여덟 명, 모두 그림이 있다', () => {
  assert.equal(FIGHTERS.length, 9);
  assert.deepEqual(FIGHTERS.map(f => f.id), ['hero', ...FLOORS.map(f => f.char)]);
  assert.equal(new Set(FIGHTERS.map(f => f.id)).size, 9);
  for (const f of FIGHTERS) { assert.ok(CHARACTER_IDS.includes(f.id), f.id); assert.ok(f.name.length > 1); }
  assert.equal(fighterIndex('luna'), 5); assert.equal(fighterIndex('없음'), 0);
});

test('캐릭터 번호: 상대가 보낸 이상한 값은 주인공으로, 예전 버전(번호 없음)도 주인공으로', () => {
  for (const bad of [-1, 9, 1.5, '3', null, undefined, NaN, {}]) assert.equal(cleanFighter(bad), 0);
  assert.equal(cleanFighter(8), 8);
  assert.equal(cleanPeer({ level: 12, skin: 'cat', effect: 'sparkle', ch: 6 }).char, 6);
  assert.equal(cleanPeer({ level: 12 }).char, 0);
  assert.equal(cleanPeer({ ch: 'king' }).char, 0);
  assert.deepEqual(cleanPeer({ level: 300, skin: 5, ch: 99 }), { level: 99, skin: 'classic', effect: 'sparkle', char: 0 });
});

test('비밀의 층 주인은 그 층이 열려야 고를 수 있다: 코멧은 타워를 깨면, 노바는 혜성을 깨면', () => {
  const tower = { best: 0, cleared: false, comet: false, nova: false };
  assert.deepEqual(FIGHTERS.map((_, i) => fighterOpen(tower, i)), [true, true, true, true, true, true, true, false, false]);
  assert.equal(fighterHint(7), '타워를 깨면 열려'); assert.equal(fighterHint(8), '혜성을 깨면 열려');
  assert.equal(pickFighter(tower, 'comet'), 0); // 잠긴 캐릭터를 저장해 뒀어도 주인공으로
  assert.equal(pickFighter(tower, 'king'), 6);
  tower.cleared = true;
  assert.equal(fighterOpen(tower, 7), true); assert.equal(fighterOpen(tower, 8), false);
  assert.equal(pickFighter(tower, 'comet'), 7);
  tower.comet = true;
  assert.equal(pickFighter(tower, 'nova'), 8);
  assert.equal(pickFighter(tower, undefined), 0); assert.equal(pickFighter(undefined, 'poyo'), 1);
  assert.equal(fighterOpen(tower, 9), false);
});

test('고른 캐릭터는 설정에 저장되고, 예전 저장에는 주인공이 들어간다', () => {
  assert.equal(newProgress().settings.onlineChar, 'hero');
  const old = newProgress(); delete old.settings.onlineChar;
  assert.equal(sanitize(old).settings.onlineChar, 'hero');
  const mine = newProgress(); mine.settings.onlineChar = 'luna';
  assert.equal(sanitize(JSON.parse(JSON.stringify(mine))).settings.onlineChar, 'luna');
});

// ---------- 4번: 혜성 엔딩이 마지막 장면의 글만 나오고 멈추던 버그 ----------
test('혜성 엔딩: 첫 그림의 시각이 시작 시각보다 앞서도 1장부터 시작한다 (전에는 장면 번호가 -1 이 되어 멈췄다)', () => {
  assert.equal(elapsed(1000, 1040), 0);   // 그리기 시각이 40ms 앞섬
  assert.equal(elapsed(1040, 1040), 0);
  assert.equal(elapsed(3040, 1040), 2);
  assert.equal(cometScene(elapsed(1000, 1040)), 0);
  assert.equal(cometScene(-0.04), 0);     // 예전 계산: Math.floor(-0.04 / 10) = -1
  assert.deepEqual([0, 9.99, 10, 35, 59.9, 60, 69.9, 70, 500].map(cometScene), [0, 0, 1, 3, 5, 6, 6, 6, 6]);
  assert.equal(COMET_ENDING_SECONDS, 70);
});

// ---------- 스킨도 더 넣어줘 ----------
const NEW_COIN = ['puppy', 'pig', 'fox', 'koala', 'ladybug', 'watermelon', 'tiger', 'cloud', 'devil', 'angel'];
const NEW_LEVEL = ['lava', 'blackhole'];
test('새 스킨 12가지: 코인 스킨 10가지와 레벨 스킨 2가지(85·95레벨)가 상점에 있고 그림도 있다', () => {
  assert.equal(SKINS.length, 57);
  assert.equal(new Set(SKINS.map(s => s.id)).size, SKINS.length);
  for (const id of [...NEW_COIN, ...NEW_LEVEL]) {
    const item = SKINS.find(s => s.id === id);
    assert.ok(item, id);
    assert.ok(SKIN_IDS.includes(id), `${id} 그림`);
    assert.equal(SKIN_STYLE[id].connect, false);
    assert.ok(item.name.includes('뿌요') && item.desc.length > 5, id);
  }
  for (const id of NEW_COIN) { const item = SKINS.find(s => s.id === id); assert.ok(item.price >= 500 && item.price <= 4000 && item.level <= 20 && !item.noTicket, id); }
  assert.deepEqual(NEW_LEVEL.map(id => SKINS.find(s => s.id === id).level), [85, 95]);
  for (const item of SKINS) assert.ok(SKIN_IDS.includes(item.id), `${item.id} 그림 없음`);
});

test('레벨 스킨(용암, 블랙홀)은 그 레벨이 되어야 사고 교환권으로는 못 받는다. 코인 스킨은 교환권으로도 받는다', () => {
  const p = newProgress();
  Object.assign(p, { level: 84, coins: 999999 }); p.tickets.skin = 5;
  assert.equal(canBuy(p, 'skin', 'lava'), 'level');
  assert.equal(canRedeem(p, 'skin', 'lava'), false);
  p.level = 85;
  assert.equal(canBuy(p, 'skin', 'lava'), 'ok');
  assert.equal(canBuy(p, 'skin', 'blackhole'), 'level');
  p.level = 95;
  assert.equal(canBuy(p, 'skin', 'blackhole'), 'ok');
  assert.equal(canRedeem(p, 'skin', 'blackhole'), false);
  assert.equal(canRedeem(p, 'skin', 'fox'), true);
  p.coins = 0;
  assert.equal(canBuy(p, 'skin', 'fox'), 'coins');
});

test('스킨을 다 모아도 클라우드 저장은 서버 한도의 반 안쪽', () => {
  const p = maxProgress({ social: false });
  for (const s of SKINS) assert.ok(p.owned.skin.includes(s.id), `${s.id} (save-size.fixture)`);
  assert.ok(bytes(cloudPayload(p)) < SAVE_MAX_BYTES / 2, `저장 ${bytes(cloudPayload(p))}바이트`);
});
