// 친구가 게임을 꺼 두었어도 채팅: 친구 우체통(/api/jelly-mail)을 거쳐 친구 신청 → 받기 → 메시지·젤리 이모티콘·이모지가
// 상대가 다시 켰을 때 도착하는지, 사이트처럼 같은 주소에서 보는 게임으로 끝까지 해 본다.
// 실행: 사이트를 빌드하고 JELLY_MAIL_MEMORY=1 로 next start 한 뒤
//   PUYO_URL=http://127.0.0.1:3000/play/puyo-puyo/index.html node games/puyo-puyo/offline-chat-browser-check.mjs
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const base = process.env.PUYO_URL || 'http://127.0.0.1:3000/play/puyo-puyo/index.html';
const shots = process.env.PUYO_SHOTS || '/tmp/puyo-puyo-offline-chat';
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const T = { timeout: 30000 };
const quiet = text => /peerjs|PeerJS|ICE|webrtc|Could not connect to peer|Failed to load resource/i.test(text);

async function openGame(context, who) {
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(`${who}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !quiet(m.text())) errors.push(`${who}: ${m.text()}`); });
  await page.goto(`${base}?test`); await page.waitForFunction(() => window.__puyo);
  return page;
}
async function signup(context, name) {
  const page = await openGame(context, name);
  await page.click('#go-signup'); await page.fill('#signup-name', name); await page.fill('#signup-pass', 'abcd');
  await page.click('#signup-form button[type=submit]'); await page.waitForSelector('#scr-menu:not([hidden])');
  return page;
}
const mailOn = page => page.waitForFunction(() => window.__puyo.mailState === 'on', null, T);
const logTexts = page => page.locator('#chat-log .msg').evaluateAll(rows => rows.map(r => r.querySelector('img')?.alt || r.querySelector('span')?.textContent));

try {
  const ctxA = await browser.newContext({ viewport: { width: 1100, height: 860 } });
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  // 1) 지우: 친구 화면을 열어 우체통에 친구 코드를 맡기고 게임을 끈다
  let A = await signup(ctxA, '지우');
  await A.click('[data-go="friends"]'); await mailOn(A);
  assert.match(await A.textContent('#mail-note'), /게임을 꺼 두었어도/);
  const codeA = await A.textContent('#my-friend-code');
  await A.close();

  // 2) 민준: 지우가 게임을 꺼 둔 동안 친구 신청 (잘못 적은 코드는 아직 없다고 알려 준다)
  let B = await signup(ctxB, '민준');
  await B.click('[data-go="friends"]'); await mailOn(B);
  await B.fill('#friend-input', 'ZZZZZZ'); await B.click('#friend-add button[type=submit]');
  await B.waitForFunction(() => document.getElementById('friend-status').textContent.includes('아직 그 코드로'), null, T);
  await B.click('[data-cancel="ZZZZZZ"]');
  await B.fill('#friend-input', codeA); await B.click('#friend-add button[type=submit]');
  await B.waitForFunction(() => document.getElementById('friend-status').textContent.includes('꺼 두었어도 켜면 받아'), null, T);
  assert.match(await B.textContent('.sent-list'), new RegExp(codeA));
  await B.screenshot({ path: `${shots}/b-request-sent.png` });
  await B.close();

  // 3) 지우가 다시 켠다 → 메뉴에 친구 표시 → 받기 (민준은 게임을 꺼 둔 상태)
  A = await openGame(ctxA, '지우');
  await A.waitForSelector('#scr-menu:not([hidden])');
  await A.waitForSelector('#friend-badge:not([hidden])', T);
  assert.equal(await A.textContent('#friend-badge'), '1');
  await A.click('[data-go="friends"]');
  await A.waitForSelector('#friend-requests [data-accept]', T);
  assert.match(await A.textContent('#friend-requests'), /민준/);
  await A.click('#friend-requests [data-accept]');
  await A.waitForFunction(() => document.querySelector('#friend-list .friend')?.textContent.includes('민준'), null, T);
  assert.match(await A.textContent('#friend-list .friend small'), /편지는 보낼 수 있어/);

  // 4) 지우: 꺼져 있는 민준에게 글·젤리 이모티콘·이모지를 보낸다
  await A.click('#friend-list [data-chat]');
  assert.equal(await A.locator('#chat-input').isDisabled(), false);
  assert.match(await A.textContent('#chat-note'), /친구가 지금 없어도 보내 두면/);
  await A.fill('#chat-input', '안녕 민준! 내일 같이 연쇄 연습하자'); await A.click('#chat-form button[type=submit]');
  await A.waitForFunction(() => document.querySelectorAll('#chat-log .msg.me').length === 1, null, T);
  await A.click('#chat-emoji-toggle');
  assert.equal(await A.locator('#chat-emoji').isVisible(), true);
  assert.ok(await A.locator('#chat-stickers button').count() >= 8);
  await A.click('#chat-stickers [data-sticker="4"]'); // 혜성: 최고!
  await A.waitForFunction(() => document.querySelectorAll('#chat-log .msg.me').length === 2, null, T);
  await A.click('#chat-emojis [data-emoji="😂"]'); await A.click('#chat-emojis [data-emoji="🔥"]');
  assert.equal(await A.inputValue('#chat-input'), '😂🔥');
  await A.click('#chat-form button[type=submit]');
  await A.waitForFunction(() => document.querySelectorAll('#chat-log .msg.me').length === 3, null, T);
  assert.equal(await A.locator('#chat-log .msg.me.sticker img').count(), 1);
  assert.equal(await A.locator('#chat-log .msg.me.big').count(), 1);
  await A.screenshot({ path: `${shots}/a-sent-while-b-away.png` });
  await A.close();

  // 5) 민준이 다시 켠다 → 친구가 되어 있고, 지우의 편지 3개가 와 있다
  B = await openGame(ctxB, '민준');
  await B.waitForSelector('#scr-menu:not([hidden])');
  await B.waitForFunction(() => document.getElementById('friend-badge').textContent === '3', null, T);
  await B.click('[data-go="friends"]');
  await B.waitForFunction(() => document.querySelector('#friend-list .friend')?.textContent.includes('지우'), null, T);
  assert.equal(await B.locator('.sent-list').count(), 0); // 보낸 신청은 친구가 되면서 사라짐
  assert.equal(await B.textContent('#friend-list [data-chat] .badge'), '3');
  await B.click('#friend-list [data-chat]');
  assert.deepEqual(await logTexts(B), ['안녕 민준! 내일 같이 연쇄 연습하자', '젤리 이모티콘 최고!', '😂🔥']);
  assert.equal(await B.locator('#chat-log .msg.them.sticker img').count(), 1);
  assert.equal(await B.locator('#chat-log .msg.them.big').count(), 1);
  await B.screenshot({ path: `${shots}/b-received.png` });

  // 6) 둘 다 켜 있으면 바로바로 (지우는 친구 화면에서 기다린다)
  A = await openGame(ctxA, '지우');
  await A.waitForSelector('#scr-menu:not([hidden])');
  await A.click('[data-go="friends"]'); await mailOn(A);
  // 둘 다 켜져 있으면 직접 이어진다 (게임 중 표시) → 이때는 우체통을 거치지 않고 바로 간다
  await A.waitForFunction(() => document.querySelector('#friend-list .friend .dot.on'), null, T);
  await B.waitForFunction(() => document.getElementById('chat-dot').classList.contains('on'), null, T);
  await A.click('#friend-list [data-chat]');
  await B.click('#chat-emoji-toggle'); await B.click('#chat-stickers [data-sticker="0"]'); // 좋아!
  await B.fill('#chat-input', '좋아 ㅋㅋ'); await B.click('#chat-form button[type=submit]');
  await A.waitForFunction(() => document.querySelectorAll('#chat-log .msg.them').length === 2, null, { timeout: 8000 }); // 직접 연결이라 금방
  assert.deepEqual((await logTexts(A)).slice(-2), ['젤리 이모티콘 좋아!', '좋아 ㅋㅋ']);
  // 우체통에서 받아 간 편지는 지워진다 (다시 열어도 같은 편지가 또 오지 않는다)
  await A.reload(); await A.waitForSelector('#scr-menu:not([hidden])');
  await A.click('[data-go="friends"]'); await mailOn(A);
  await A.evaluate(() => window.__puyo.pollMail()); await A.waitForTimeout(1500);
  await A.click('#friend-list [data-chat]');
  assert.equal((await logTexts(A)).length, 5); // 내가 보낸 3 + 받은 2, 중복 없음

  // 7) 검사용 계정을 지운다: 계정을 지우면 우체통과 열쇠도 지워진다 (진짜 사이트에서 돌려도 흔적이 남지 않게)
  for (const P of [A, B]) {
    await P.evaluate(() => window.__puyo.show('profile'));
    await P.click('#delete-account'); await P.click('#delete-yes');
    await P.waitForSelector('#scr-login:not([hidden])', T);
  }
  const gone = await A.evaluate(async code => (await fetch('/api/jelly-mail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', code, key: '0'.repeat(32), to: 'QQQQQQ', kind: 'msg', text: 'x' }) })).status, codeA);
  assert.equal(gone, 401); // 지운 계정의 코드로는 더 보낼 수 없다

  assert.deepEqual(errors, []);
  console.log('PASS: 친구가 꺼 둔 동안 친구 신청(없는 코드 알림) → 다시 켜서 받기 → 꺼 둔 친구에게 글·젤리 이모티콘·이모지 → 켜면 도착(메뉴 배지·안 읽음) → 둘 다 켜 있을 때 바로 · 중복 없음 · 계정 지우면 우체통도 지움 — 오류 없음');
  console.log(`Screenshots: ${shots}`);
} finally { await browser.close(); }
