// 예전 친구(친구 코드) 기록: 옮기기 전에 우체통을 비워 기록에 넣기 (legacy.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMailbox, memoryStore } from '../../src/lib/jelly-mail/mailbox.mjs';
import { emptySocial, makeMailKey, addFriend } from './chat.mjs';
import { storeLetter, drainMailbox, hasLegacy } from './legacy.mjs';
import { emptyStore, createAccount, saveStore, loadStore } from './profile.mjs';
import { migrationMarker } from './migrate.mjs';
import { memoryStorage } from '../../packages/net/social.mjs';
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

  const r = await drainMailbox(a, client, { commit: () => true });
  assert.deepEqual(r, { ok: true, count: 3 });
  assert.deepEqual(a.chats[b.code].map(m => m.text ?? m.sticker), ['내일 같이 하자', 4]);
  assert.deepEqual(a.requests.map(x => [x.code, x.name]), [[c.code, '서연']]);
  assert.ok(a.lastMail > 0);
  // 마지막 요청은 받은 것까지 지우라고(ack) 알린다 → 다시 열어도 같은 편지가 오지 않는다
  assert.equal(calls.at(-1).ack, a.lastMail);
  assert.equal((await client.inbox(a.code, a.key)).letters.length, 0);
  assert.deepEqual(await drainMailbox(a, client, { commit: () => true }), { ok: true, count: 0 });
  assert.equal(a.chats[b.code].length, 2); // 두 번 넣지 않는다
});

test('우체통이 없거나 친구 코드가 없으면 그냥 지나간다', async () => {
  assert.deepEqual(await drainMailbox(emptySocial(), { inbox() { throw Error('부르면 안 됨'); } }), { ok: true, count: 0 });
  const off = await drainMailbox(me(), { inbox: async () => ({ ok: false, error: 'off' }) }, { commit: () => true });
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

test('1:1 대화의 뿌요 이모티콘은 [[st:번호]] 글로 오가고, 정해진 번호만 그림이 된다', () => {
  assert.equal(stickerBody(3), '[[st:3]]');
  assert.equal(bodySticker('[[st:3]]'), 3);
  assert.equal(bodySticker(' [[st:11]] '), 11);
  assert.equal(bodySticker('[[st:12]]'), null);
  assert.equal(bodySticker('안녕 [[st:3]]'), null);
  assert.equal(bodySticker(''), null);
});

// ---------- 받은 편지는 기기에 저장된 뒤에만 지운다 ----------
async function friendWithLetters(n = 2) {
  const { client, calls } = mailbox();
  const a = me(), b = { code: 'BBBBBB', key: makeMailKey() };
  addFriend(a, { code: b.code, name: '민준', level: 3 });
  for (const s of [a, b]) await client.hello(s.code, s.key);
  for (let i = 0; i < n; i++) await client.send(b.code, b.key, { to: a.code, id: `m${i}`, kind: 'msg', text: `안녕 ${i}`, name: '민준', level: 3 });
  return { client, calls, a, b };
}

test('저장(commit)이 안 되면 ack 를 보내지 않고 기록을 되돌린다: 편지는 우체통에 그대로', async () => {
  const { client, calls, a } = await friendWithLetters();
  const before = JSON.stringify(a);
  const r = await drainMailbox(a, client, { commit: () => false });
  assert.deepEqual(r, { ok: false, count: 0, error: 'save' });
  assert.ok(calls.every(c => c.ack === 0));
  assert.equal(JSON.stringify(a), before); // lastMail 도 그대로
  const thrown = await drainMailbox(a, client, { commit: () => { throw new Error('QuotaExceededError'); } });
  assert.equal(thrown.error, 'save');
  assert.ok(calls.every(c => c.ack === 0));
  assert.equal((await client.inbox(a.code, a.key)).letters.length, 2);
});

test('commit 이 없으면 아무것도 받지 않는다', async () => {
  const { client, calls, a } = await friendWithLetters();
  assert.deepEqual(await drainMailbox(a, client), { ok: false, count: 0, error: 'save' });
  assert.equal(calls.length, 0);
});

test('저장이 되면 그 묶음까지 다음 요청에서 ack 로 지운다', async () => {
  const { client, calls, a } = await friendWithLetters();
  const commits = [];
  const r = await drainMailbox(a, client, { commit: () => { commits.push(a.lastMail); return true; } });
  assert.deepEqual(r, { ok: true, count: 2 });
  assert.equal(commits.length, 1);
  assert.equal(calls[0].ack, 0);
  assert.equal(calls[1].ack, commits[0]); // 저장한 다음에야 ack
  assert.equal((await client.inbox(a.code, a.key)).letters.length, 0);
});

test('기기 저장소가 꽉 차면(saveStore 실패) ok:false 이고 옮기던 표시와 기기 계정은 그대로', async () => {
  const store = emptyStore();
  const { account } = await createAccount(store, '인혁', '1234');
  const { client, a } = await friendWithLetters();
  account.progress.social = a;
  const marker = migrationMarker(memoryStorage());
  marker.set({ localId: account.id, nickname: '인혁' });
  const full = { getItem: () => null, setItem() { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }, removeItem() {} };
  const r = await drainMailbox(account.progress.social, client, { commit: () => saveStore(full, store) });
  assert.deepEqual(r, { ok: false, count: 0, error: 'save' });
  assert.deepEqual(marker.get(), { localId: account.id, nickname: '인혁' });
  assert.equal(store.accounts[0].migratedTo, undefined);
  assert.equal((await client.inbox(a.code, a.key)).letters.length, 2);
});

test('저장한 뒤 ack 전에 앱이 꺼져도 다시 받을 때 편지가 두 번 들어가지 않는다', async () => {
  const { client, a } = await friendWithLetters();
  const storage = memoryStorage();
  const store = emptyStore();
  const { account } = await createAccount(store, '인혁', '1234');
  account.progress.social = a;
  // 첫 묶음을 저장한 다음 요청(ack 를 보내는 요청)에서 꺼진다
  let n = 0;
  const crashy = { inbox: (...args) => { if (++n === 2) throw new Error('앱 꺼짐'); return client.inbox(...args); } };
  await assert.rejects(drainMailbox(a, crashy, { commit: () => saveStore(storage, store) }));
  assert.equal((await client.inbox(a.code, a.key)).letters.length, 2); // 우체통에는 아직 있다
  // 다시 켬: 기기에 저장된 것을 읽어서 다시 비운다
  const again = loadStore(storage).accounts[0].progress.social;
  assert.equal(again.chats.BBBBBB.length, 2);
  const r = await drainMailbox(again, client, { commit: () => true });
  assert.deepEqual(r, { ok: true, count: 0 });
  assert.equal(again.chats.BBBBBB.length, 2);
  assert.equal((await client.inbox(again.code, again.key)).letters.length, 0); // 이제 지워졌다
});
