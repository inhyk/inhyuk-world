import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QUICK, CHAT_MAX, CHAT_KEEP, FRIEND_MAX, cleanChat, personalInfo, rateLimiter, makeFriendCode, normaliseFriendCode, validFriendCode,
  emptySocial, addFriend, removeFriend, pushChat,
} from './chat.mjs';
import { keepLink, friendPeerId, codeFromPeer } from './friendnet.mjs';
import { newProgress, sanitize, emptyStore, createAccount, exportCode, importCode } from './profile.mjs';

test('나쁜 말은 띄어쓰기·점·초성으로 숨겨도 ♡로 바뀌고, 보통 말은 그대로', () => {
  assert.equal(cleanChat('안녕 씨발'), '안녕 ♡♡');
  assert.equal(cleanChat('씨 발'), '♡♡');
  assert.equal(cleanChat('ㅅㅂ 진짜'), '♡♡ 진짜');
  assert.equal(cleanChat('병.신아'), '♡♡아');
  assert.equal(cleanChat('FUCK you'), '♡♡♡♡ you');
  assert.equal(cleanChat('잘한다! 한 판 더 하자 👍'), '잘한다! 한 판 더 하자 👍');
  assert.equal(cleanChat('같이 연쇄 만들자'), '같이 연쇄 만들자');
});

test('채팅 글자: 60자까지, 꺾쇠·조종 문자는 지우고 공백은 하나로', () => {
  assert.equal(cleanChat('가'.repeat(100)).length, CHAT_MAX);
  assert.equal(cleanChat('<b>안녕</b>'), 'b안녕/b');
  assert.equal(cleanChat('  줄\n바꿈\t  ok  '), '줄 바꿈 ok');
  assert.equal(cleanChat(null), '');
  assert.equal(QUICK.length, 8);
  for (const q of QUICK) assert.equal(cleanChat(q), q); // 빠른 말은 걸리지 않는다
});

test('전화번호·이메일처럼 보이면 개인정보라서 보내지 않는다', () => {
  assert.equal(personalInfo('내 번호 010-1234-5678'), '전화번호');
  assert.equal(personalInfo('01012345678'), '전화번호');
  assert.equal(personalInfo('010 1234 5678 연락해'), '전화번호');
  assert.equal(personalInfo('me@example.com 으로'), '이메일');
  assert.equal(personalInfo('10연쇄 했다! 점수 123456'), '');
  assert.equal(personalInfo('3시에 하자'), '');
});

test('너무 빨리 보내면 막고, 시간이 지나면 다시 된다', () => {
  const ok = rateLimiter(3, 1000);
  assert.deepEqual([ok(0), ok(10), ok(20), ok(30)], [true, true, true, false]);
  assert.equal(ok(1015), true); // 첫 번째가 1초 지나서 빠짐
});

test('친구 코드: 6글자, 헷갈리는 0·O·1·I 없음, 입력은 대문자로 정리', () => {
  const codes = new Set(Array.from({ length: 200 }, () => makeFriendCode()));
  for (const c of codes) assert.equal(validFriendCode(c), true, c);
  assert.ok(codes.size > 190);
  assert.equal(normaliseFriendCode(' ab-c 12d '), 'ABC12D');
  assert.equal(validFriendCode('ABCDE0'), false);
  assert.equal(validFriendCode('ABCDEI'), false);
  assert.equal(validFriendCode('ABCDE'), false);
});

test('친구 추가·차단·대화 기록: 30명까지, 대화는 친구마다 50개만', () => {
  const s = emptySocial(); s.code = 'MEMEME';
  assert.equal(addFriend(s, { code: 'MEMEME', name: '나', level: 3 }), false); // 내 코드는 안 됨
  assert.equal(addFriend(s, { code: 'BBBBBB', name: '<b>민준</b>', level: 7 }), true);
  assert.equal(s.friends[0].name, 'b민준/b');
  assert.equal(addFriend(s, { code: 'BBBBBB', name: '민준', level: 9 }), true); // 다시 받으면 이름·레벨만 바뀐다
  assert.equal(s.friends.length, 1); assert.equal(s.friends[0].level, 9);
  for (let i = 0; i < CHAT_KEEP + 10; i++) pushChat(s, 'BBBBBB', { me: i % 2 === 0, text: `말 ${i}`, time: i });
  assert.equal(s.chats.BBBBBB.length, CHAT_KEEP);
  assert.equal(s.chats.BBBBBB[0].text, '말 10');
  removeFriend(s, 'BBBBBB', { block: true });
  assert.equal(s.friends.length, 0); assert.deepEqual(s.blocked, ['BBBBBB']); assert.equal(s.chats.BBBBBB, undefined);
  assert.equal(addFriend(s, { code: 'BBBBBB', name: '민준', level: 9 }), true); // 다시 친구가 되면 차단도 풀린다
  assert.deepEqual(s.blocked, []);
  for (let i = 0; i < FRIEND_MAX + 5; i++) addFriend(s, { code: makeFriendCode(), name: `친구${i}`, level: 1 });
  assert.equal(s.friends.length, FRIEND_MAX);
});

test('저장된 친구 정보가 이상해도 안전하게 열리고, 기록 코드로 옮겨도 그대로', async () => {
  assert.deepEqual(newProgress().social, emptySocial());
  assert.equal(newProgress().settings.chat, true);
  const bad = sanitize({ social: { code: 'nope', friends: [{ code: 'ABCDEF', name: '하나', level: 3 }, { code: 'ABCDEF', name: '중복' }, { code: 'x' }, null], blocked: ['ABCDEF', 7, 'ZZZZZZ'], chats: { ABCDEF: [{ me: true, text: '씨발 안녕', time: 5 }, { text: 3 }] } } }).social;
  assert.equal(bad.code, '');
  assert.deepEqual(bad.friends.map(f => f.code), ['ABCDEF']);
  assert.deepEqual(bad.blocked, ['ABCDEF', 'ZZZZZZ']);
  assert.deepEqual(bad.chats.ABCDEF, [{ me: true, text: '♡♡ 안녕', time: 5 }]);
  const { account } = await createAccount(emptyStore(), '친구왕', 'abcd');
  addFriend(account.progress.social, { code: 'QWERTY', name: '지우', level: 4 });
  account.progress.social.code = 'ASDFGH';
  pushChat(account.progress.social, 'QWERTY', { me: false, text: '같이 하자', time: 9, invite: 'ROOMAB' });
  const moved = importCode(emptyStore(), exportCode(account)).account.progress.social;
  assert.equal(moved.code, 'ASDFGH');
  assert.equal(moved.friends[0].name, '지우');
  assert.equal(moved.chats.QWERTY[0].invite, 'ROOMAB');
});

test('친구 연결 이름과, 둘이 동시에 연결해도 양쪽이 같은 연결 하나만 남긴다', () => {
  assert.equal(friendPeerId('ABCDEF'), 'puyo-tower-v1-f-ABCDEF');
  assert.equal(codeFromPeer('puyo-tower-v1-f-ABCDEF'), 'ABCDEF');
  assert.equal(codeFromPeer('puyo-tower-v1-ROOMAB'), '');
  // A(작은 코드)가 건 연결: A 쪽에서는 내가 건 것, B 쪽에서는 받은 것 → 둘 다 남긴다
  assert.equal(keepLink('AAAAAA', 'BBBBBB', true), true);
  assert.equal(keepLink('BBBBBB', 'AAAAAA', false), true);
  // B가 건 연결은 양쪽 다 버린다
  assert.equal(keepLink('BBBBBB', 'AAAAAA', true), false);
  assert.equal(keepLink('AAAAAA', 'BBBBBB', false), false);
});

test('이모티콘: 이모지는 반으로 잘리지 않고, 이모지만 1~3개면 크게, 젤리 이모티콘 번호만 통과', async () => {
  const { STICKERS, EMOJIS, validSticker, bigEmoji, graphemes, cleanChat: clean } = await import('./chat.mjs');
  assert.equal(clean('😂'.repeat(70)), '😂'.repeat(60)); // 60글자 = 이모지 60개 (반쪽 이모지 없음)
  assert.equal(graphemes('👍🏽❤️🇰🇷').length, 3);
  assert.equal(clean('👨‍👩‍👧 가족'), '👨‍👩‍👧 가족');
  assert.equal(bigEmoji('😂'), true); assert.equal(bigEmoji('🔥🔥🔥'), true); assert.equal(bigEmoji(' ❤️ '), true);
  assert.equal(bigEmoji('😂😂😂😂'), false); assert.equal(bigEmoji('안녕 😂'), false); assert.equal(bigEmoji('123'), false); assert.equal(bigEmoji(''), false);
  assert.ok(STICKERS.length >= 8 && EMOJIS.length >= 30);
  for (let i = 0; i < STICKERS.length; i++) assert.equal(validSticker(i), true);
  for (const bad of [-1, STICKERS.length, 1.5, '2', null, undefined]) assert.equal(validSticker(bad), false);
  for (const e of EMOJIS) assert.equal(clean(e), e); // 고르기 판의 이모지는 그대로 보내진다
});

test('우체통 열쇠·받은 신청·보낸 신청·젤리 이모티콘 대화가 저장되고, 이상한 값은 걸러진다', async () => {
  const { sanitizeSocial, makeMailKey, validMailKey, STICKERS } = await import('./chat.mjs');
  const key = makeMailKey();
  assert.equal(validMailKey(key), true); assert.equal(validMailKey('xyz'), false);
  const s = sanitizeSocial({
    code: 'MEMEME', key,
    friends: [{ code: 'PALPAL', name: '친구', level: 2 }],
    blocked: ['BADBAD'],
    requests: [{ code: 'ASKASK', name: '<i>새친구</i>', level: 4, time: 9 }, { code: 'ASKASK' }, { code: 'PALPAL' }, { code: 'BADBAD' }, { code: 'nope' }],
    sent: [{ code: 'WAQTME', time: 3 }, 'WAQTME', { code: 'PALPAL' }, 'x'],
    chats: { PALPAL: [{ me: true, sticker: 2, time: 1 }, { me: false, sticker: STICKERS.length, time: 2 }, { me: false, text: '😂', time: 3 }] },
    lastMail: 1234,
  });
  assert.equal(s.key, key); assert.equal(s.lastMail, 1234);
  assert.deepEqual(s.requests, [{ code: 'ASKASK', name: 'i새친구/i', level: 4, time: 9 }]); // 중복·친구·차단·이상한 코드는 빠짐
  assert.deepEqual(s.sent, [{ code: 'WAQTME', time: 3 }]);
  assert.deepEqual(s.chats.PALPAL, [{ me: true, sticker: 2, time: 1 }, { me: false, text: '😂', time: 3 }]);
  assert.equal(sanitizeSocial({ key }).key, ''); // 친구 코드 없이 열쇠만 있으면 버린다
});
