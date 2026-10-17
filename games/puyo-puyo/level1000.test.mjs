// 1000레벨 (2026-10-17 요청: "1000레벨 까지 올릴 수 있게 해줘"): 99에서 멈추지 않고 1000까지 오른다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newProgress, sanitize, addXp, xpToNext, levelReward, LEVEL_MAX, OLD_SERVER_LEVEL_MAX, putStatsCompat } from './profile.mjs';
import { cleanPeer } from './online.mjs';
import { FRIEND_LEVEL_MAX, sanitizeSocial, emptySocial } from './chat.mjs';
import { maxProgress, bytes } from './save-size.fixture.mjs';

test('레벨은 1000까지 오르고, 99에서 멈추지 않는다', () => {
  assert.equal(LEVEL_MAX, 1000);
  const p = newProgress(); p.level = 99; p.xp = 0; p.coins = 0;
  const r = addXp(p, xpToNext(99) + xpToNext(100) + 5);
  assert.deepEqual([p.level, p.xp, r.levels], [101, 5, [100, 101]]);
  assert.equal(r.coins, levelReward(100) + levelReward(101)); // 레벨 보상 코인도 그대로 받는다
  assert.equal(xpToNext(100), 4060); // 레벨마다 필요한 경험치 셈은 그대로
  // 1000에서 멈춘다. 경험치는 1000레벨 칸이 가득 찬 데서 더 쌓이지 않는다
  p.level = 999; p.xp = 0;
  addXp(p, 1e9);
  assert.deepEqual([p.level, p.xp], [1000, xpToNext(1000)]);
  assert.deepEqual(addXp(p, 500).levels, []);
});

test('저장한 레벨: 100이 넘어도 그대로, 1000이 넘으면 1000', () => {
  for (const [level, kept] of [[99, 99], [100, 100], [537, 537], [1000, 1000], [5000, 1000], [-3, 1]]) {
    const p = newProgress(); p.level = level;
    assert.equal(sanitize(JSON.parse(JSON.stringify(p))).level, kept, String(level));
  }
});

test('대전 상대와 관전 화면, 친구 목록도 1000레벨까지 보여 준다', () => {
  assert.equal(cleanPeer({ level: 650 }).level, 650);
  assert.equal(cleanPeer({ level: 99999 }).level, 1000);
  assert.equal(FRIEND_LEVEL_MAX, LEVEL_MAX);
  const s = emptySocial();
  s.friends.push({ code: 'ABCDEF', name: '하이', level: 777, since: 1 });
  s.requests.push({ code: 'GHJKLM', name: '친구', level: 4000, time: 1 });
  const out = sanitizeSocial(JSON.parse(JSON.stringify(s)));
  assert.deepEqual([out.friends[0].level, out.requests[0].level], [777, 1000]);
});

test('랭킹 서버가 아직 99까지만 받으면 99레벨로 다시 올리고, 새 서버면 그대로 올린다', async () => {
  const fake = max => {
    const sent = [];
    return { sent, async putStats(game, body) { sent.push(body); if (body.level > max) { const e = new Error('bad'); e.code = 'bad-stats'; e.status = 400; throw e; } return { ok: true }; } };
  };
  const body = { level: 250, xp: 1234, trophies: 41 };
  const oldServer = fake(99);
  assert.deepEqual(await putStatsCompat(oldServer, 'puyo', body), { ok: true });
  assert.deepEqual(oldServer.sent, [body, { level: OLD_SERVER_LEVEL_MAX, xp: xpToNext(99), trophies: 41 }]);
  const newServer = fake(1000);
  await putStatsCompat(newServer, 'puyo', body);
  assert.deepEqual(newServer.sent, [body]);
  // 99레벨 이하가 거절되었거나 다른 오류면 다시 올리지 않고 그대로 알린다
  const low = fake(10);
  await assert.rejects(putStatsCompat(low, 'puyo', { level: 50, xp: 0, trophies: 0 }), e => e.code === 'bad-stats');
  assert.equal(low.sent.length, 1);
  const offline = { sent: 0, async putStats() { this.sent++; const e = new Error('net'); e.code = 'network'; throw e; } };
  await assert.rejects(putStatsCompat(offline, 'puyo', body), e => e.code === 'network');
  assert.equal(offline.sent, 1);
});

test('1000레벨 기록도 클라우드 저장 크기 안에 든다', () => {
  const p = maxProgress();
  assert.equal(p.level, 1000);
  assert.ok(bytes(p) > 0);
});
