// 채팅과 친구를 두 사람(서로 다른 브라우저 저장소)으로 실제 PeerJS 연결 서버를 거쳐 끝까지 해 본다.
// 방 채팅(나쁜 말 가리기·빠른 말·전화번호 막기·게임 중 말풍선·채팅 끄기) → 친구 신청·받기 → 친구 채팅 → 새로고침 뒤 기록
// → 대전 초대로 같은 방 들어가기 → 차단.
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const base = process.env.PUYO_URL || 'http://127.0.0.1:5190/';
const shots = process.env.PUYO_SHOTS || '/tmp/puyo-puyo-social';
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const T = { timeout: 30000 };

async function person(name, viewport = { width: 1100, height: 820 }) {
  const context = await browser.newContext({ viewport, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  // 개발 서버에는 우체통 주소가 없어서 404가 나는 것은 괜찮다 (게임은 직접 연결로 돌아간다)
  page.on('console', m => { if (m.type() === 'error' && !/peerjs|PeerJS|ICE|webrtc|Could not connect to peer|Failed to load resource/i.test(m.text())) errors.push(`${name}: ${m.text()}`); });
  page.on('dialog', d => d.accept());
  await page.goto(`${base}?test`); await page.waitForFunction(() => window.__puyo);
  // 친구 코드와 우체통은 이 기기 계정의 기능이다. 화면의 「새 계정 만들기」는 온라인 계정이라 검사용 기기 계정을 바로 만든다.
  await page.evaluate(n => window.__puyo.localSignup(n, 'abcd'), name); await page.waitForSelector('#scr-menu:not([hidden])');
  await page.evaluate(() => { document.getElementById('toasts').style.display = 'none'; });
  return { context, page };
}
const logTexts = page => page.locator('#chat-log .msg span').allTextContents();
const say = async (page, text) => { await page.fill('#chat-input', text); await page.click('#chat-form button[type=submit]'); };

try {
  const A = (await person('지우')).page;
  const B = (await person('민준')).page;

  // ---------- 1) 온라인 대전 방 채팅 ----------
  await A.click('[data-go="online"]'); await B.click('[data-go="online"]');
  await A.click('#room-host');
  await A.waitForFunction(() => /^[A-Z0-9]{6}$/.test(document.getElementById('room-code').textContent), null, T);
  await B.fill('#room-input', await A.textContent('#room-code')); await B.click('#room-join button[type=submit]');
  await A.waitForSelector('#online-lobby:not([hidden])', T); await B.waitForSelector('#online-lobby:not([hidden])', T);
  await A.click('#lobby-chat');
  assert.equal(await A.locator('#chat').isVisible(), true);
  assert.match(await A.textContent('#chat-name'), /민준/);
  await say(A, '안녕 씨발 같이 하자');
  assert.deepEqual(await logTexts(A), ['안녕 ♡♡ 같이 하자']); // 보내는 쪽에서도 가려진다
  await B.waitForSelector('#bubbles .bubble', T);
  assert.match(await B.textContent('#bubbles .bubble'), /민준|지우/);
  assert.match(await B.textContent('#bubbles .bubble'), /안녕 ♡♡ 같이 하자/);
  assert.equal(await B.locator('#lobby-chat-dot').isVisible(), true);
  await B.click('#lobby-chat');
  assert.deepEqual(await logTexts(B), ['안녕 ♡♡ 같이 하자']);
  await B.click('#chat-quick [data-q="1"]'); // 👍 잘한다!
  await A.waitForFunction(() => [...document.querySelectorAll('#chat-log .msg.them span')].some(s => s.textContent === '👍 잘한다!'), null, T);
  // 뿌요 이모티콘과 큰 이모지도 방 채팅으로
  await B.click('#chat-emoji-toggle'); await B.click('#chat-stickers [data-sticker="3"]'); // ㅋㅋㅋ
  await A.waitForSelector('#chat-log .msg.them.sticker img[alt*="ㅋㅋㅋ"]', T);
  await B.click('#chat-emojis [data-emoji="🥳"]'); await B.click('#chat-form button[type=submit]');
  await A.waitForSelector('#chat-log .msg.them.big', T);
  // 전화번호는 보내지 않는다
  await say(A, '내 번호 010-1234-5678');
  assert.match(await A.textContent('#chat-note'), /전화번호는 보낼 수 없어/);
  await A.waitForTimeout(800);
  assert.equal((await logTexts(B)).some(t => t.includes('010')), false);
  await A.screenshot({ path: `${shots}/room-lobby-chat.png` });
  await A.click('#chat-close'); await B.click('#chat-close');
  // 게임 중: 위쪽 💬 단추 → 작은 채팅 창 → 상대에게 말풍선
  await A.click('#online-start');
  await A.waitForFunction(() => window.__puyo.game?.mode === 'online', null, T); await B.waitForFunction(() => window.__puyo.game?.mode === 'online', null, T);
  assert.equal(await A.locator('#hud-chat').isVisible(), true);
  await A.click('#hud-chat');
  assert.equal(await A.evaluate(() => document.getElementById('chat').classList.contains('compact')), true);
  await A.click('#chat-quick [data-q="3"]'); // 🔥 간다!
  await B.waitForFunction(() => [...document.querySelectorAll('#bubbles .bubble')].some(b => b.textContent.includes('🔥 간다!')), null, T);
  await B.screenshot({ path: `${shots}/room-ingame-bubble.png` });
  // 채팅 끄기: 끈 사람은 이번 판 말을 받지 않는다
  await B.click('#hud-chat'); await B.click('[data-tool="mute"]'); await B.click('#chat-close');
  await A.click('#chat-quick [data-q="7"]'); // 💪 한 판 더!
  await B.waitForTimeout(1500);
  assert.equal(await B.evaluate(() => [...document.querySelectorAll('#bubbles .bubble')].some(b => b.textContent.includes('한 판 더'))), false);
  await A.click('#chat-close');
  // 방장이 그만두면 손님도 저절로 온라인 화면으로 돌아온다
  await A.click('#hud-pause'); await A.waitForSelector('#scr-online:not([hidden])', T);
  await B.waitForSelector('#scr-online:not([hidden])', T);
  assert.equal(await B.locator('#chat').isVisible(), false); // 방 채팅 창도 닫힌다
  for (const P of [A, B]) await P.click('#scr-online [data-go="menu"]');

  // ---------- 2) 친구 신청과 받기 ----------
  await A.click('[data-go="friends"]'); await B.click('[data-go="friends"]');
  await A.waitForFunction(() => /^[A-Z2-9]{6}$/.test(document.getElementById('my-friend-code').textContent));
  const codeA = await A.textContent('#my-friend-code'), codeB = await B.textContent('#my-friend-code');
  assert.notEqual(codeA, codeB);
  await A.waitForFunction(() => window.__puyo.friendNet.on, null, T); await B.waitForFunction(() => window.__puyo.friendNet.on, null, T);
  await A.fill('#friend-input', codeB.toLowerCase()); // 소문자로 써도 된다
  await A.click('#friend-add button[type=submit]');
  await A.waitForFunction(() => document.getElementById('friend-status').textContent.includes('보냈어'), null, T);
  await B.waitForSelector('#friend-requests [data-accept]', T);
  assert.match(await B.textContent('#friend-requests'), /지우/);
  await B.screenshot({ path: `${shots}/friend-request.png` });
  await B.click('#friend-requests [data-accept]');
  await B.waitForFunction(() => document.querySelector('#friend-list .friend')?.textContent.includes('지우'), null, T);
  await A.waitForFunction(() => document.querySelector('#friend-list .friend')?.textContent.includes('민준'), null, T);
  await A.waitForFunction(() => document.querySelector('#friend-list .friend .dot.on'), null, T); // 접속 중 표시

  // ---------- 3) 친구 채팅 ----------
  await A.click('#friend-list [data-chat]');
  await say(A, '안녕 민준아! 병신같은 버그 봤어?');
  await A.waitForFunction(() => document.querySelectorAll('#chat-log .msg.me').length === 1, null, T); // 우체통이 받으면 보인다
  assert.deepEqual(await logTexts(A), ['안녕 민준아! ♡♡같은 버그 봤어?']);
  await B.waitForFunction(() => document.querySelector('#friend-list [data-chat] .badge'), null, T); // 안 읽음 표시
  assert.equal(await B.locator('#friend-badge').isVisible(), false); // 친구 화면 안이라 메뉴 배지는 안 보임 (메뉴로 가면 보임)
  await B.click('#friend-list [data-chat]');
  assert.deepEqual(await logTexts(B), ['안녕 민준아! ♡♡같은 버그 봤어?']);
  await say(B, '응 ㅋㅋ 같이 연쇄 연습하자');
  await A.waitForFunction(() => [...document.querySelectorAll('#chat-log .msg.them span')].some(s => s.textContent === '응 ㅋㅋ 같이 연쇄 연습하자'), null, T);
  await say(A, 'me@example.com 으로 보내');
  assert.match(await A.textContent('#chat-note'), /이메일은 보낼 수 없어/);
  await A.screenshot({ path: `${shots}/friend-chat.png` });

  // ---------- 4) 새로고침해도 친구와 대화가 남는다 ----------
  await A.reload(); await A.waitForSelector('#scr-menu:not([hidden])');
  await A.evaluate(() => { document.getElementById('toasts').style.display = 'none'; });
  await A.click('[data-go="friends"]');
  await A.waitForFunction(() => document.querySelector('#friend-list .friend .dot.on'), null, T); // 다시 이어짐
  await A.click('#friend-list [data-chat]');
  assert.deepEqual(await logTexts(A), ['안녕 민준아! ♡♡같은 버그 봤어?', '응 ㅋㅋ 같이 연쇄 연습하자']);

  // ---------- 5) 대전 초대 → 같은 방 ----------
  await A.click('[data-tool="invite"]');
  await A.waitForSelector('#scr-online:not([hidden])', T);
  await A.waitForFunction(() => /^[A-Z0-9]{6}$/.test(document.getElementById('room-code').textContent), null, T);
  await B.waitForSelector('#chat-log [data-join]', T); // B는 A와의 채팅을 열어 둔 상태
  await B.screenshot({ path: `${shots}/friend-invite.png` });
  await B.click('#chat-log [data-join]');
  await A.waitForSelector('#online-lobby:not([hidden])', T); await B.waitForSelector('#online-lobby:not([hidden])', T);
  assert.match(await B.textContent('#lobby-you'), /지우/);
  await A.click('#room-leave'); await A.click('#scr-online [data-go="menu"]');
  await B.waitForSelector('#online-lobby', { state: 'hidden', ...T });
  await B.click('#scr-online [data-go="menu"]');

  // ---------- 6) 차단 ----------
  await B.click('[data-go="friends"]'); await B.click('#friend-list [data-chat]');
  await B.click('[data-tool="block"]');
  await B.waitForFunction(() => !document.querySelector('#friend-list .friend'), null, T);
  assert.match(await B.textContent('#friend-count'), /차단 1명/);
  await A.click('[data-go="friends"]');
  await A.waitForFunction(() => !document.querySelector('#friend-list .friend .dot.on'), null, T); // A에게는 그냥 연결 안 됨
  await A.click('#friend-list [data-chat]');
  if (await A.evaluate(() => window.__puyo.mailState === 'on')) {
    // 우체통이 있으면 A는 계속 보낼 수 있지만(차단당한 걸 알리지 않는다), B에게는 닿지 않는다
    await A.fill('#chat-input', '내 말 들려?'); await A.click('#chat-form button[type=submit]');
    await B.evaluate(() => window.__puyo.pollMail()); await B.waitForTimeout(2000);
    assert.equal(await B.evaluate(() => Object.keys(window.__puyo.P().social.chats).length), 0);
    assert.equal(await B.locator('#friend-requests [data-accept]').count(), 0);
  } else {
    assert.equal(await A.locator('#chat-input').isDisabled(), true);
  }
  // 차단된 쪽이 다시 친구 신청을 해도 상대에게 닿지 않는다 (차단당한 걸 알리지는 않는다)
  await A.click('#chat-close');
  await A.evaluate(() => window.__puyo.P().social.friends.splice(0)); // A가 B를 지운 뒤 다시 신청
  await A.fill('#friend-input', codeB); await A.click('#friend-add button[type=submit]');
  await A.waitForFunction(() => /보냈어|찾지 못했어/.test(document.getElementById('friend-status').textContent), null, T);
  await B.waitForTimeout(2500);
  assert.equal(await B.locator('#friend-requests [data-accept]').count(), 0);
  assert.equal(await A.evaluate(() => window.__puyo.P().social.friends.length), 0); // 받아 주지 않으니 친구가 되지 않는다

  // ---------- 7) 손님은 친구를 사귈 수 없다 ----------
  const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const G = await guestCtx.newPage();
  await G.goto(`${base}?test`); await G.waitForFunction(() => window.__puyo);
  await G.click('#go-guest'); await G.click('[data-go="friends"]');
  assert.equal(await G.locator('#friends-guest').isVisible(), true);
  assert.equal(await G.locator('#friends-main').isVisible(), false);

  assert.deepEqual(errors, []);
  const mode = await A.evaluate(() => (window.__puyo.mailState === 'on' ? '우체통 켬' : '우체통 없음(직접 연결만)'));
  console.log(`[${mode}] PASS: 방 채팅(나쁜 말 ♡, 빠른 말, 뿌요 이모티콘·큰 이모지, 전화번호 막기, 게임 중 말풍선, 채팅 끄기) · 친구 신청/받기 · 친구 채팅(이메일 막기, 안 읽음 표시) · 새로고침 뒤 기록 · 대전 초대로 같은 방 · 차단 · 손님 — 오류 없음`);
  console.log(`Screenshots: ${shots}`);
} finally { await browser.close(); }
