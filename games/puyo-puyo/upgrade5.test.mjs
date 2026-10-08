// 인혁이 기획서 「뿌요뿌요 (업그레이드)」(2026-10-08): 관전 채팅과 응원(3번), 챌린지 더(5번), 처음 인사(7번)의 규칙.
// 온라인 상대를 부드럽게(4번)는 remote-smooth.test.mjs, 졸업3~5(2번)는 tutorial.test.mjs 와 upgrade4.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWatch } from './watch.mjs';
import { createOnline } from './online.mjs';
import { CHEERS, validCheer, cheerText } from './chat.mjs';
import { MISSIONS, GROUPS, DAILY_POOL, track, claim, dailyFor } from './missions.mjs';
import { GRADES } from './tutorial.mjs';
import { MAPS } from './maps.mjs';
import { newProgress, sanitize } from './profile.mjs';
import { cloudPayload } from './cloud.mjs';

// ---------- 3번: 관전 채팅, 응원 ----------
test('응원은 정해진 말만 번호로: 화이팅, 좋아요가 들어 있다', () => {
  assert.equal(cheerText(0), '💪 화이팅!');
  assert.equal(cheerText(1), '👍 좋아요!');
  assert.ok(CHEERS.length >= 3 && CHEERS.length <= 16); // 서버는 0~15번을 받는다
  for (const bad of [-1, CHEERS.length, 1.5, '1', null, undefined]) assert.equal(validCheer(bad), false);
});

function watchSetup() {
  const calls = { lines: [], off: 0, slow: 0, ended: [], begin: [] };
  const room = {
    code: 'ABCDEF', hostId: 'p1', peers: ['p1', 'p2'], users: { p1: 11, p2: 22 }, sent: [], left: 0,
    chat(text) { this.sent.push({ chat: text }); return true; },
    cheer(to, k) { this.sent.push({ cheer: k, to }); return true; },
    leave() { this.left++; },
  };
  let hooks = null;
  const social = { async watch(game, code, h) { hooks = h; return room; } };
  const watcher = createWatch({
    social: () => social, begin: info => calls.begin.push(info), restart() {}, peer() {}, ended: text => calls.ended.push(text),
    line: l => calls.lines.push(l), talkOff: () => calls.off++, slow: () => calls.slow++,
  });
  const entry = { code: 'ABCDEF', players: [{ id: 11, nickname: '철수', level: 3 }, { id: 22, nickname: '영희', level: 7 }] };
  return { watcher, room, calls, entry, hooks: () => hooks };
}

test('관전하는 사람: 관전 채팅과 응원을 보내고, 두 사람에게 친구 요청할 번호를 안다', async () => {
  const { watcher, room, calls, entry } = watchSetup();
  assert.equal(watcher.chat('안녕'), false); // 관전 전에는 못 보낸다
  await watcher.start(entry);
  assert.deepEqual(calls.begin[0].names, ['철수', '영희']);
  assert.deepEqual(watcher.players().map(p => [p.id, p.nickname]), [[11, '철수'], [22, '영희']]);
  assert.equal(watcher.code, 'ABCDEF');
  assert.equal(watcher.chat('  둘 다 잘한다!  '), true);
  assert.equal(watcher.chat('   '), false);
  assert.equal(watcher.chat('가'.repeat(100)), true);
  assert.equal(watcher.cheer(0, 0), true); // 왼쪽(방장)에게 화이팅
  assert.equal(watcher.cheer(1, 1), true); // 오른쪽에게 좋아요
  assert.equal(watcher.cheer(1, 99), false);
  assert.equal(watcher.cheer(2, 0), false);
  assert.deepEqual(room.sent, [{ chat: '둘 다 잘한다!' }, { chat: '가'.repeat(60) }, { cheer: 0, to: 'p1' }, { cheer: 1, to: 'p2' }]);
  watcher.stop();
  assert.equal(watcher.cheer(0, 0), false);
});

test('관전하는 사람: 같이 보는 사람의 말과 응원을 받는다 (이름은 서버가 붙인 닉네임, 이상한 것은 버린다)', async () => {
  const { watcher, calls, entry, hooks } = watchSetup();
  await watcher.start(entry);
  const h = hooks();
  h.watcherMessage({ chat: '와 5연쇄!' }, { id: 33, nickname: '구경꾼' }, 'w2');
  h.watcherMessage({ t: 'cheer', k: 1, to: 'p2' }, { id: 33, nickname: '구경꾼' }, 'w2');
  h.watcherMessage({ t: 'cheer', k: 0, to: 'p1' }, { id: 33, nickname: '구경꾼' }, 'w2');
  assert.deepEqual(calls.lines, [
    { id: 33, name: '구경꾼', text: '와 5연쇄!' },
    { id: 33, name: '구경꾼', cheer: 1, side: 1 },
    { id: 33, name: '구경꾼', cheer: 0, side: 0 },
  ]);
  // 누구인지 모르는 것, 없는 응원 번호, 없는 자리, 빈 글, 게임 메시지 흉내는 버린다
  h.watcherMessage({ chat: '누구?' }, { id: 0, nickname: '' }, 'w3');
  h.watcherMessage({ t: 'cheer', k: 99, to: 'p1' }, { id: 33, nickname: '구경꾼' }, 'w2');
  h.watcherMessage({ t: 'cheer', k: 0, to: 'p9' }, { id: 33, nickname: '구경꾼' }, 'w2');
  h.watcherMessage({ chat: '' }, { id: 33, nickname: '구경꾼' }, 'w2');
  h.watcherMessage({ t: 'atk', n: 99 }, { id: 33, nickname: '구경꾼' }, 'w2');
  assert.equal(calls.lines.length, 3);
});

test('관전하는 사람: 서버가 예전 버전이면(watch-only) 알려 주고, 너무 빨리 보내면 천천히 하라고 한다', async () => {
  const { watcher, calls, entry, hooks } = watchSetup();
  await watcher.start(entry);
  hooks().error('watch-only');
  hooks().error('chat-rate');
  hooks().error('bad');
  assert.deepEqual([calls.off, calls.slow], [1, 1]);
});

test('대전하는 사람: 관전자의 말과 응원을 따로 받는다 (나에게 온 응원인지 안다). 대전 채팅과 섞이지 않는다', async () => {
  const room = { code: 'ABCDEF', id: 'p1', peers: ['p2'], ready: true, host: true, sent: [], send(m) { this.sent.push(m); return true; }, chat(t) { return this.send({ chat: t }); }, leave() {} };
  const calls = { lines: [], watcher: [] };
  const social = { async findMatch(game, hooks) { hooks.join('p2'); return { room, opponent: { id: 5, nickname: '철수' } }; }, cancelMatch() {} };
  const online = createOnline({
    toast() {}, sound: { sfx() {} }, social: () => social, me: () => ({ level: 3, skin: 'classic', effect: 'sparkle' }),
    start() {}, match: () => null, isFinished: () => false, quit() {}, render() {}, chatLine: l => calls.lines.push(l), chatReset() {},
    watcherLine: l => calls.watcher.push(l),
  });
  online.hooks.watcherMessage({ chat: '방 없음' }, { id: 9, nickname: '구경꾼' }); // 방에 들어가기 전에는 버린다
  await online.find();
  online.hooks.watcherMessage({ chat: '화이팅 하세요' }, { id: 9, nickname: '구경꾼' });
  online.hooks.watcherMessage({ t: 'cheer', k: 0, to: 'p1' }, { id: 9, nickname: '구경꾼' });
  online.hooks.watcherMessage({ t: 'cheer', k: 1, to: 'p2' }, { id: 9, nickname: '구경꾼' });
  online.hooks.watcherMessage({ t: 'cheer', k: 55, to: 'p1' }, { id: 9, nickname: '구경꾼' });
  online.hooks.watcherMessage({ chat: '이름 없음' }, { id: 0, nickname: '' });
  assert.deepEqual(calls.watcher, [
    { id: 9, name: '구경꾼', text: '화이팅 하세요' },
    { id: 9, name: '구경꾼', cheer: 0, mine: true },
    { id: 9, name: '구경꾼', cheer: 1, mine: false },
  ]);
  assert.deepEqual(calls.lines, []); // 대전 채팅(상대가 한 말)에는 들어가지 않는다
  assert.deepEqual(online.lines, []);
});

// ---------- 5번: 챌린지를 더 ----------
test('챌린지: 이름이 겹치지 않고, 모든 묶음에 이름이 있고, 예전 챌린지는 그대로 있다', () => {
  const ids = MISSIONS.map(d => d.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length >= 230, `챌린지 ${ids.length}개`);
  for (const d of MISSIONS) {
    assert.ok(GROUPS[d.group], `${d.id} 의 묶음 ${d.group}`);
    assert.ok(d.goal > 0 && d.title && d.reward && (d.kind === 'max' || d.kind === 'sum'), d.id);
  }
  for (const old of ['tower-chain-5', 'chain-master-12', 'map-garden-15', 'gift-time-15', 'collect-skin-18', 'tower-floor-8', 'career-wins-200']) assert.ok(ids.includes(old), old);
  for (const group of ['trophy', 'friends', 'pets', 'school']) assert.ok(MISSIONS.some(d => d.group === group), group);
  assert.equal(new Set(DAILY_POOL.map(d => d.id)).size, DAILY_POOL.length);
  assert.ok(DAILY_POOL.length >= 16);
  assert.equal(dailyFor('2026-10-08').length, 3);
});

test('챌린지: 지금 기록(status)으로 트로피, 친구, 펫, 배우기, 코인, 출석이 깨진다', () => {
  const p = newProgress();
  const status = extra => ({ type: 'status', trophies: 0, friends: 0, petKinds: 0, petDraws: 0, school: [], streak: 0, coins: 100, ...extra });
  assert.deepEqual(track(p, status({})), []);
  const done = track(p, status({ trophies: 5, friends: 3, petKinds: 2, petDraws: 6, school: ['beginner', 'middle'], streak: 7, coins: 5200 })).map(d => d.id);
  for (const id of ['trophy-1', 'trophy-5', 'friends-1', 'friends-3', 'pet-kinds-1', 'pet-kinds-2', 'pet-draw-5', 'school-beginner', 'school-middle', 'streak-3', 'streak-7', 'coins-1000', 'coins-5000']) assert.ok(done.includes(id), id);
  for (const id of ['trophy-10', 'friends-5', 'pet-kinds-3', 'pet-draw-10', 'school-high', 'streak-14', 'coins-20000']) assert.ok(!done.includes(id), id);
  // 값이 내려가도(코인을 씀) 깬 것은 그대로, 다시 깨지지 않는다
  assert.deepEqual(track(p, status({ coins: 0 })), []);
  assert.ok(claim(p, 'coins-5000'));
  assert.equal(claim(p, 'coins-5000'), null);
  assert.equal(claim(p, 'coins-20000'), null);
});

test('챌린지: 배우기 등급마다 하나씩 있다 (맨 끝 등급까지)', () => {
  for (const g of GRADES) assert.ok(MISSIONS.some(d => d.id === `school-${g.id}` && d.title.includes(`「${g.name}」`)), g.id);
  const p = newProgress();
  const done = track(p, { type: 'status', school: GRADES.map(g => g.id) }).map(d => d.id);
  assert.equal(done.filter(id => id.startsWith('school-')).length, GRADES.length);
});

test('챌린지: 관전, 응원, 친구 선물, 부스트, AI 대전 승리, 맵 승리는 할 때마다 쌓인다', () => {
  const p = newProgress();
  assert.deepEqual(track(p, { type: 'watch' }).map(d => d.id), ['watch-1']);
  for (let i = 0; i < 4; i++) track(p, { type: 'watch' });
  assert.equal(p.missions['watch-5'].v, 5);
  assert.deepEqual(track(p, { type: 'cheer' }).map(d => d.id), ['cheer-1']);
  assert.deepEqual(track(p, { type: 'giftSent' }).map(d => d.id), ['gift-send-1']);
  assert.deepEqual(track(p, { type: 'boost' }).map(d => d.id), ['boost-1']);
  const map = MAPS[1].id;
  const first = track(p, { type: 'match', mode: 'vs', map, win: true }).map(d => d.id);
  assert.ok(first.includes('vs-win-1'));
  track(p, { type: 'match', mode: 'vs', map, win: false });
  track(p, { type: 'match', mode: 'vs', map, win: true });
  const third = track(p, { type: 'match', mode: 'online', map, win: true }).map(d => d.id);
  assert.ok(third.includes(`map-win-${map}-3`), third.join());
  assert.equal(p.missions['vs-win-10'].v, 2);
  assert.equal(p.missions['online-win-3'].v, 1);
});

test('챌린지: 긴 연쇄, 연쇄 여러 번, 한 번에 많이 보내기', () => {
  const p = newProgress();
  const done = track(p, { type: 'chain', mode: 'vs', chain: 13, made: 200, sent: 130 }).map(d => d.id);
  for (const id of ['chain-master-13', 'send-once-30', 'send-once-60', 'send-once-120']) assert.ok(done.includes(id), id);
  assert.ok(!done.includes('chain-master-14'));
  assert.equal(p.missions['chain3-total-10'].v, 1);
  assert.equal(p.missions['chain5-total-5'].v, 1);
  track(p, { type: 'chain', mode: 'vs', chain: 4, made: 10, sent: 10 });
  assert.equal(p.missions['chain3-total-10'].v, 2);
  assert.equal(p.missions['chain5-total-5'].v, 1);
  assert.ok(track(p, { type: 'pop', mode: 'vs', puyos: 12, colors: 5, maxGroup: 12 }).some(d => d.id === 'five-colors'));
});

test('챌린지를 모두 깨도 클라우드 저장은 서버 한도(32KB)의 반을 넘지 않는다', async () => {
  const { maxProgress, bytes } = await import('./save-size.fixture.mjs');
  const size = bytes(cloudPayload(maxProgress({ social: false })));
  assert.ok(size < 16 * 1024, `저장 ${size}바이트`);
});

// ---------- 7번: 처음 인사 ----------
test('처음 인사를 봤는지(hiAsked)는 기록에 남고, 예전 기록에는 false 로 채워진다', () => {
  assert.equal(newProgress().hiAsked, false);
  const old = newProgress(); delete old.hiAsked;
  assert.equal(sanitize(old).hiAsked, false);
  assert.equal(sanitize({ ...newProgress(), hiAsked: true }).hiAsked, true);
  assert.equal(sanitize({ ...newProgress(), hiAsked: 'yes' }).hiAsked, false);
  assert.equal(cloudPayload({ ...newProgress(), hiAsked: true }).hiAsked, true);
});
