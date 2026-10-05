import test from 'node:test';
import assert from 'node:assert/strict';
import { createMailbox, memoryStore, upstashStore, BOX_MAX, BOX_TTL, LIMITS } from '../../src/lib/jelly-mail/mailbox.mjs';
import { makeMailKey, STICKERS } from './chat.mjs';

function setup() {
  const clock = { t: Date.UTC(2026, 9, 5, 3, 0, 0) };
  const now = () => clock.t;
  const store = memoryStore({ now });
  const mail = createMailbox(store, { now });
  const call = (body, ip = '1.2.3.4') => mail.handle(body, { ip });
  return { clock, store, call };
}
const A = { code: 'AAAAAA', key: makeMailKey() }, B = { code: 'BBBBBB', key: makeMailKey() };

test('우체통 열쇠: 처음 온 열쇠로 코드를 맡고, 다른 열쇠는 거절', async () => {
  const { call } = setup();
  assert.deepEqual((await call({ action: 'hello', ...A })).body, { ok: true, created: true });
  assert.deepEqual((await call({ action: 'hello', ...A })).body, { ok: true }); // 같은 열쇠는 언제든
  const other = await call({ action: 'hello', code: A.code, key: makeMailKey() });
  assert.equal(other.status, 409); assert.equal(other.body.error, 'taken');
  assert.equal((await call({ action: 'hello', code: 'AAAAA0', key: A.key })).status, 400); // 0은 친구 코드에 없음
  assert.equal((await call({ action: 'hello', code: A.code, key: 'short' })).status, 400);
  assert.equal((await call({ action: 'nope' })).status, 400);
});

test('친구가 없을 때 보낸 편지·젤리 이모티콘·친구 신청이 쌓였다가, 받아 가면 지워진다', async () => {
  const { clock, call } = setup();
  await call({ action: 'hello', ...A }); await call({ action: 'hello', ...B });
  assert.equal((await call({ action: 'send', ...A, to: B.code, kind: 'fr', name: '지우', level: 7 })).status, 200);
  clock.t += 1000;
  const sent = await call({ action: 'send', ...A, to: B.code, kind: 'msg', text: '안녕 씨발 😂', name: '지우', level: 7, id: 'abc12345' });
  assert.equal(sent.status, 200); assert.equal(sent.body.id, 'abc12345');
  clock.t += 1000;
  assert.equal((await call({ action: 'send', ...A, to: B.code, kind: 'st', sticker: STICKERS.length - 1, name: '지우', level: 7 })).status, 200);
  const box = await call({ action: 'inbox', ...B });
  assert.equal(box.status, 200);
  assert.deepEqual(box.body.letters.map(l => [l.from, l.kind, l.text ?? l.sticker ?? null]), [
    ['AAAAAA', 'fr', null], ['AAAAAA', 'msg', '안녕 ♡♡ 😂'], ['AAAAAA', 'st', STICKERS.length - 1],
  ]);
  assert.equal(box.body.letters[0].name, '지우'); assert.equal(box.body.letters[0].level, 7);
  // 두 번째 편지까지 받았다고 알려 주면 그것까지 지운다
  const after = await call({ action: 'inbox', ...B, ack: box.body.letters[1].t });
  assert.deepEqual(after.body.letters.map(l => l.kind), ['st']);
  assert.deepEqual((await call({ action: 'inbox', ...B, ack: box.body.letters[2].t })).body.letters, []);
  // 보낸 사람 우체통은 그대로 비어 있다
  assert.deepEqual((await call({ action: 'inbox', ...A })).body.letters, []);
});

test('열쇠가 틀리면 보내지도 열지도 못하고, 다른 사람인 척할 수 없다', async () => {
  const { call } = setup();
  await call({ action: 'hello', ...A }); await call({ action: 'hello', ...B });
  await call({ action: 'send', ...A, to: B.code, kind: 'msg', text: '비밀', name: '지우', level: 1 });
  assert.equal((await call({ action: 'inbox', code: B.code, key: A.key })).status, 401); // 남의 우체통
  assert.equal((await call({ action: 'send', code: A.code, key: B.key, to: B.code, kind: 'msg', text: '가짜', name: '지우', level: 1 })).status, 401);
  assert.equal((await call({ action: 'send', code: 'CCCCCC', key: makeMailKey(), to: B.code, kind: 'msg', text: '누구게', name: '?', level: 1 })).status, 401); // 맡긴 적 없는 코드
  assert.equal((await call({ action: 'inbox', ...B })).body.letters.length, 1);
});

test('보내는 내용 검사: 개인정보·빈 글·없는 이모티콘·나에게·이상한 종류는 거절', async () => {
  const { call } = setup();
  await call({ action: 'hello', ...A });
  const base = { action: 'send', ...A, to: B.code, name: '지우', level: 1 };
  assert.equal((await call({ ...base, kind: 'msg', text: '내 번호 010-1234-5678' })).body.error, 'personal');
  assert.equal((await call({ ...base, kind: 'msg', text: 'me@example.com' })).body.error, 'personal');
  assert.equal((await call({ ...base, kind: 'msg', text: '   ' })).body.error, 'empty');
  assert.equal((await call({ ...base, kind: 'st', sticker: STICKERS.length })).body.error, 'sticker');
  assert.equal((await call({ ...base, kind: 'st', sticker: 'x' })).body.error, 'sticker');
  assert.equal((await call({ ...base, to: A.code, kind: 'msg', text: '나야' })).body.error, 'to');
  assert.equal((await call({ ...base, kind: 'inv', text: 'ROOMAB' })).body.error, 'kind');
  const long = await call({ ...base, kind: 'msg', text: '가'.repeat(200) });
  assert.equal(long.status, 200);
});

test('너무 많이 보내면 막고(1분 20개), 1분이 지나면 다시 된다', async () => {
  const { clock, call } = setup();
  await call({ action: 'hello', ...A });
  const base = { action: 'send', ...A, to: B.code, kind: 'msg', text: '도배', name: '지우', level: 1 };
  for (let i = 0; i < LIMITS.perMinute; i++) assert.equal((await call(base)).status, 200, `${i}`);
  assert.equal((await call(base)).status, 429);
  clock.t += 61000;
  assert.equal((await call(base)).status, 200);
});

test('우체통에는 최근 100통만, 7일이 지난 편지는 사라진다', async () => {
  const { clock, call } = setup();
  await call({ action: 'hello', ...A }); await call({ action: 'hello', ...B });
  for (let i = 0; i < BOX_MAX + 15; i++) {
    clock.t += 61000; // 1분마다 하나씩 (보내기 한도 안에서)
    await call({ action: 'send', ...A, to: B.code, kind: 'msg', text: `편지 ${i}`, name: '지우', level: 1 });
  }
  const box = (await call({ action: 'inbox', ...B })).body.letters;
  assert.equal(box.length, BOX_MAX);
  assert.equal(box[0].text, '편지 15'); assert.equal(box.at(-1).text, `편지 ${BOX_MAX + 14}`);
  clock.t += BOX_TTL * 1000 + 1000;
  assert.deepEqual((await call({ action: 'inbox', ...B })).body.letters, []);
});

test('Upstash 저장소: 명령을 한 번에 묶어 보내고 오류는 알린다', async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, init });
    const commands = JSON.parse(init.body);
    return { ok: true, json: async () => commands.map(c => (c[0] === 'GET' ? { result: null } : c[0] === 'BAD' ? { error: 'ERR boom' } : { result: 'OK' })) };
  };
  const store = upstashStore('https://example.upstash.io/', 'secret-token', fakeFetch);
  assert.deepEqual(await store.run([['SET', 'k', 1, 'NX'], ['GET', 'k']]), ['OK', null]);
  assert.equal(calls[0].url, 'https://example.upstash.io/pipeline');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer secret-token');
  assert.deepEqual(JSON.parse(calls[0].init.body), [['SET', 'k', '1', 'NX'], ['GET', 'k']]); // 모두 글자로
  await assert.rejects(store.run([['BAD']]), /boom/);
  const down = upstashStore('https://x', 't', async () => ({ ok: false, status: 503 }));
  await assert.rejects(down.run([['GET', 'k']]), /503/);
});

test('친구 신청은 그 코드가 있는지 알려 주고, 계정을 지우면 열쇠·우체통도 사라진다', async () => {
  const { call } = setup();
  await call({ action: 'hello', ...A });
  const unknown = await call({ action: 'send', ...A, to: B.code, kind: 'fr', name: '지우', level: 1 });
  assert.equal(unknown.body.known, false); // 아직 B가 우체통을 연 적 없음
  await call({ action: 'hello', ...B });
  assert.equal((await call({ action: 'send', ...A, to: B.code, kind: 'fr', name: '지우', level: 1 })).body.known, true);
  assert.equal((await call({ action: 'send', ...A, to: B.code, kind: 'msg', text: '안녕', name: '지우', level: 1 })).body.known, undefined);
  assert.equal((await call({ action: 'forget', code: B.code, key: A.key })).status, 401); // 남의 계정은 못 지운다
  assert.equal((await call({ action: 'forget', ...B })).status, 200);
  assert.equal((await call({ action: 'inbox', ...B })).status, 401); // 열쇠도 사라짐
  assert.deepEqual((await call({ action: 'hello', ...B })).body, { ok: true, created: true }); // 다시 처음부터
  assert.deepEqual((await call({ action: 'inbox', ...B })).body.letters, []); // 예전 편지는 없다
});
