// 예전 친구(친구 코드) 기록: 옮기기 전에 우체통을 비워 기록에 넣기 (legacy.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMailbox, memoryStore } from '../../src/lib/jelly-mail/mailbox.mjs';
import { emptySocial, makeMailKey, addFriend } from './chat.mjs';
import { storeLetter, drainMailbox, hasLegacy } from './legacy.mjs';
import { stickerBody, bodySticker } from './social-ui.mjs';

// 진짜 우체통 규칙(메모리 저장소)에 게임 쪽 createMailClient 와 같은 모양으로 붙인다
function mailbox() {
  const clock = { t: Date.UTC(2026, 9, 5, 3, 0, 0) };
  const box = createMailbox(memoryStore({ now: () => clock.t }), { now: () => clock.t });
  const call = async body => { clock.t += 1000; const r = await box.handle(body, { ip: '1.2.3.4' }); return { ...r.body, status: r.status }; };
  const calls = [];
  const client = {
    hello: (code, key) => call({ action: 'hello', code, key }),
    send: (code, key, letter) => call({ action: 'send', code, key, ...letter }),
    inbox: (code, key, ack = 0) => { calls.push({ code, ack }); return call({ action: 'inbox', code, key, ack }); },
  };
  return { client, calls };
}
const me = () => Object.assign(emptySocial(), { code: 'AAAAAA', key: makeMailKey() });

test('옮기기 전에 우체통을 비운다: 친구 말과 이모티콘, 친구 신청이 기록에 들어가고 우체통에서 지워진다', async () => {
  const { client, calls } = mailbox();
  const a = me(), b = { code: 'BBBBBB', key: makeMailKey() }, c = { code: 'CCCCCC', key: makeMailKey() };
  addFriend(a, { code: b.code, name: '민준', level: 3 });
  for (const s of [a, b, c]) assert.equal((await client.hello(s.code, s.key)).ok, true);
  await client.send(b.code, b.key, { to: a.code, id: 'x1', kind: 'msg', text: '내일 같이 하자', name: '민준', level: 3 });
  await client.send(b.code, b.key, { to: a.code, id: 'x2', kind: 'st', sticker: 4, name: '민준', level: 3 });
  await client.send(c.code, c.key, { to: a.code, id: 'x3', kind: 'fr', name: '서연', level: 2 });

  const r = await drainMailbox(a, client);
  assert.deepEqual(r, { ok: true, count: 3 });
  assert.deepEqual(a.chats[b.code].map(m => m.text ?? m.sticker), ['내일 같이 하자', 4]);
  assert.deepEqual(a.requests.map(x => [x.code, x.name]), [[c.code, '서연']]);
  assert.ok(a.lastMail > 0);
  // 마지막 요청은 받은 것까지 지우라고(ack) 알린다 → 다시 열어도 같은 편지가 오지 않는다
  assert.equal(calls.at(-1).ack, a.lastMail);
  assert.equal((await client.inbox(a.code, a.key)).letters.length, 0);
  assert.deepEqual(await drainMailbox(a, client), { ok: true, count: 0 });
  assert.equal(a.chats[b.code].length, 2); // 두 번 넣지 않는다
});

test('우체통이 없거나 친구 코드가 없으면 그냥 지나간다', async () => {
  assert.deepEqual(await drainMailbox(emptySocial(), { inbox() { throw Error('부르면 안 됨'); } }), { ok: true, count: 0 });
  const off = await drainMailbox(me(), { inbox: async () => ({ ok: false, error: 'off' }) });
  assert.deepEqual(off, { ok: false, count: 0, error: 'off' });
});

test('편지 하나 넣기: 친구가 아닌 사람의 말, 차단한 사람, 이상한 이모티콘은 버린다. 서로 신청하면 친구', () => {
  const s = me();
  assert.equal(storeLetter(s, { from: 'BBBBBB', kind: 'msg', text: '안녕', t: 1 }), false); // 친구가 아님
  s.blocked.push('CCCCCC');
  assert.equal(storeLetter(s, { from: 'CCCCCC', kind: 'fr', name: '차단', t: 2 }), false);
  s.sent.push({ code: 'DDDDDD', time: 0 });
  assert.equal(storeLetter(s, { from: 'DDDDDD', kind: 'fa', name: '지우', level: 5, t: 3 }), true);
  assert.deepEqual(s.friends.map(f => f.name), ['지우']);
  assert.equal(storeLetter(s, { from: 'DDDDDD', kind: 'st', sticker: 99, t: 4 }), false);
  assert.equal(storeLetter(s, { from: 'DDDDDD', kind: 'msg', text: '씨발 안녕', t: 5 }), true);
  assert.ok(!s.chats.DDDDDD[0].text.includes('씨발')); // 받을 때도 나쁜 말을 가린다
  assert.equal(hasLegacy(s), true);
  assert.equal(hasLegacy(emptySocial()), false);
});

test('1:1 대화의 젤리 이모티콘은 [[st:번호]] 글로 오가고, 정해진 번호만 그림이 된다', () => {
  assert.equal(stickerBody(3), '[[st:3]]');
  assert.equal(bodySticker('[[st:3]]'), 3);
  assert.equal(bodySticker(' [[st:11]] '), 11);
  assert.equal(bodySticker('[[st:12]]'), null);
  assert.equal(bodySticker('안녕 [[st:3]]'), null);
  assert.equal(bodySticker(''), null);
});
