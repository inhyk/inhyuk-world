// 온라인 대전 메시지(online.mjs)와 서버 주소 고르기(net.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from './match.mjs';
import { W, H } from './core.mjs';
import { RemoteView, snapshot, hasLongDigits, cleanPeer, eventMessage, createOnline } from './online.mjs';
import { serverUrl, scopedStorage, NET_GAME } from './net.mjs';
import { DEFAULT_SERVER, memoryStorage } from '../../packages/net/index.mjs';

function playFor(frames) {
  const m = new Match({ seed: 11, specs: [{ kind: 'human' }, { kind: 'human' }], firstTo: 1 });
  for (let i = 0; i < frames; i++) m.step([{ drop: i % 7 === 0, left: i % 11 === 0 }, {}]);
  return m;
}

test('필드 모습: 칸은 숫자 배열이고, 글자열에 숫자 8개 이상이 없다 (서버가 가리지 않게)', () => {
  const m = playFor(900);
  const snap = snapshot(m.players[0]);
  assert.ok(Array.isArray(snap.c) && snap.c.length === W * H);
  assert.equal(hasLongDigits(snap), false);
  assert.ok(JSON.stringify(snap).length < 16 * 1024);
});

test('필드 모습을 받으면 그대로 그린다', () => {
  const m = playFor(600);
  const view = new RemoteView(m.seq);
  view.apply(JSON.parse(JSON.stringify(snapshot(m.players[0]))));
  assert.deepEqual([...view.cells], [...m.players[0].cells]);
  assert.equal(view.score, m.players[0].score);
  // 이상한 값은 무시
  view.apply({ c: Array(W * H).fill(99), p: [9, 0, 0, 1, 1], sc: 'x', fl: [null] });
  assert.equal(view.cells.every(v => v === 0), true);
  assert.equal(view.piece, null);
  assert.equal(view.score, 0);
});

test('보내는 메시지 모두 숫자 8개 넘는 글자열이 없다', () => {
  const pop = eventMessage({ type: 'pop', chain: 3, score: 12345678, puyos: 4, colors: [1, 2], groups: [[1, 2, 3, 4]] });
  const garbage = eventMessage({ type: 'garbage', count: 30 });
  for (const msg of [pop, garbage, { t: 'hello', level: 99, skin: 'classic', effect: 'sparkle' }, { t: 'result', w: 'host', hw: 1, gw: 0, final: true }, { t: 'start', seed: 2147483647, first: 50 }])
    assert.equal(hasLongDigits(msg), false, JSON.stringify(msg));
  assert.equal(hasLongDigits({ a: '0101234567' }), true);
  assert.equal(hasLongDigits({ '12345678': 1 }), true);
});

test('상대가 보낸 hello 에서는 레벨과 꾸미기만 쓴다 (이름은 버린다)', () => {
  const p = cleanPeer({ name: '010-1234-5678', level: 500, skin: 'x'.repeat(50) });
  assert.deepEqual(Object.keys(p).sort(), ['effect', 'level', 'skin']);
  assert.equal(p.level, 99);
  assert.equal(p.skin.length, 20);
});

// 가짜 Social 과 Room 으로 게임 찾기 → 시작 → 채팅 → 상대가 나감
function fakeRoom(host) {
  return { code: 'ABCDEF', peers: ['p2'], ready: true, host, sent: [], left: 0,
    send(m) { this.sent.push(m); return true; }, chat(t) { return this.send({ chat: t }); }, leave() { this.left++; } };
}
function setup() {
  const room = fakeRoom(true);
  const calls = { start: [], quit: 0, toasts: [], lines: [] };
  const social = {
    async findMatch(game, hooks) { calls.game = game; hooks.join('p2'); return { room, opponent: { id: 5, nickname: '철수' } }; },
    cancelMatch() {},
  };
  let finished = false;
  const online = createOnline({
    toast: t => calls.toasts.push(t), sound: { sfx() {} }, social: () => social,
    me: () => ({ level: 3, skin: 'classic', effect: 'sparkle' }),
    start: cfg => calls.start.push(cfg), match: () => null, isFinished: () => finished, quit: () => calls.quit++,
    render() {}, chatLine: l => calls.lines.push(l), chatReset() {},
  });
  return { online, room, calls, finish: () => { finished = true; } };
}

test('게임 찾기: 서버가 준 상대 닉네임을 쓰고, 상대 이름은 메시지에서 받지 않는다', async () => {
  const { online, room, calls } = setup();
  await online.find();
  assert.equal(calls.game, NET_GAME);
  assert.equal(online.active, true);
  assert.deepEqual(room.sent[0], { t: 'hello', level: 3, skin: 'classic', effect: 'sparkle' });
  online.hooks.message({ t: 'hello', name: '가짜이름', level: 4 });
  assert.equal(online.peerName(), '철수');
  online.setFirstTo(1);
  online.start();
  assert.equal(calls.start.length, 1);
  assert.equal(calls.start[0].opponent.nickname, '철수');
  assert.equal(calls.start[0].firstTo, 1);
  assert.ok(room.sent.some(m => m.t === 'start'));
});

test('채팅: data.chat 으로만 보내고, 받은 글은 서버가 준 그대로 보여 준다. 신고에 같은 대화를 담는다', async () => {
  const { online, room, calls } = setup();
  await online.find();
  assert.equal(online.chat('  안녕!  '), true);
  assert.deepEqual(room.sent.at(-1), { chat: '안녕!' });
  online.hooks.message({ chat: '내 번호 ***-****-****' });
  assert.deepEqual(calls.lines.map(l => [l.who, l.text]), [['me', '안녕!'], ['them', '내 번호 ***-****-****']]);
  const report = online.reportPayload('욕해요');
  assert.equal(report.target, 5);
  assert.deepEqual(report.context, { kind: 'room', game: NET_GAME, room: 'ABCDEF' });
  assert.equal(report.messages.length, 2);
});

test('상대가 나가거나 다시 접속하면 대전을 끝낸다 (결과가 나온 뒤면 결과 화면은 둔다)', async () => {
  const a = setup();
  await a.online.find();
  a.online.hooks.message({ t: 'hello', level: 1 });
  a.online.start();
  a.online.hooks.rejoin('p2');
  assert.equal(a.online.active, false);
  assert.equal(a.calls.quit, 1);
  assert.equal(a.room.left, 1);
  assert.equal(a.online.recent.nickname, '철수'); // 친구 요청, 신고에 쓴다
  const b = setup();
  await b.online.find();
  b.online.hooks.message({ t: 'hello', level: 1 });
  b.online.start();
  b.finish();
  b.online.hooks.depart('p2');
  assert.equal(b.online.active, false);
  assert.equal(b.calls.quit, 0);
});

test('서버 주소: ?net= 은 내 컴퓨터 주소만, 아니면 빌드 환경 변수, 아니면 기본 서버', () => {
  assert.equal(serverUrl(''), DEFAULT_SERVER);
  assert.equal(serverUrl('?net=http://127.0.0.1:8787'), 'http://127.0.0.1:8787');
  assert.equal(serverUrl('?net=https://evil.example.com'), DEFAULT_SERVER);
  assert.equal(serverUrl('', { VITE_NET_SERVER: 'ws://localhost:9000/' }), 'ws://localhost:9000');
});

test('로컬 서버의 로그인은 다른 이름으로 저장한다 (진짜 서버에 토큰이 가지 않게)', () => {
  const raw = memoryStorage();
  const mirrored = [];
  scopedStorage(raw, DEFAULT_SERVER).setItem('k', '1');
  scopedStorage(raw, 'http://127.0.0.1:8787', (k, v) => mirrored.push([k, v])).setItem('k', '2');
  assert.equal(raw.getItem('k'), '1');
  assert.equal(raw.getItem('k@http://127.0.0.1:8787'), '2');
  assert.deepEqual(mirrored, [['k@http://127.0.0.1:8787', '2']]);
});
