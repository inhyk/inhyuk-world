// 온라인 계정으로 하는 것들을 실제 Chrome 두 창(+ 다른 기기 하나)과 로컬 net 서버로 끝까지 확인한다.
// 가입 두 명 → 둘 다 "게임 찾기" → 같은 판 → 대전 채팅(빠른 말, 뿌요 이모티콘, 이모지, 서버가 가린 번호) → 채팅 끄기
// → 판이 끝난 뒤 결과 화면에서 친구 요청 → 수락 → 친구 목록에서 초대 → 1:1 대화(빠른 말, 뿌요 이모티콘, 이모지)
// → 클라우드 저장(다른 기기에서 같은 레벨, 코인) → 저장 충돌 고르기 창 → 신고, 차단
// → 친구 코드 친구가 있는 기기 계정을 옮기기(우체통에 남은 편지를 받아 기존 친구 기록에 넣음, 기록 보기).
// 온라인 계정은 친구 우체통(/api/jelly-mail)과 친구 코드 직접 연결을 쓰지 않는다 (같은 말이 두 길로 가지 않음).
//
// 사용법:
//   npm run puyo-puyo:dev   (게임, http://127.0.0.1:5190)
//   PUYO_URL=http://127.0.0.1:5190/ node games/puyo-puyo/online-browser-check.mjs
// 옮기기 단계의 우체통까지 보려면 사이트를 빌드해서 JELLY_MAIL_MEMORY=1 로 next start 한 뒤 그 주소로:
//   PUYO_URL=http://127.0.0.1:3000/play/puyo-puyo/index.html node games/puyo-puyo/online-browser-check.mjs
//   (우체통이 없는 주소면 그 부분만 건너뛰고 알려 준다)
// net 서버: PUYO_NET 이 없으면 services/net 에서 빈 로컬 D1 로 wrangler dev 를 새로 띄우고(포트 8799) 끝나면 끈다.
//   이미 띄운 서버를 쓰려면 PUYO_NET=http://127.0.0.1:8787 (cd services/net && npx wrangler d1 migrations apply net --local && npx wrangler dev).
//   가입은 IP 하나에서 1시간에 10번까지라서, 같은 서버로 여러 번 돌리면 429 가 날 수 있다(그때는 빈 서버로).
// 화면 사진: PUYO_SHOTS (기본 /tmp/jelly-online), 이름은 jelly-online-*.png
// 두 길을 합친 화면 사진: PUYO_INTEGRATE_SHOTS 가 있으면 그 폴더에 jelly-integrate-*.png 도 남긴다
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.env.PUYO_URL || 'http://127.0.0.1:5190/';
const shots = process.env.PUYO_SHOTS || '/tmp/jelly-online';
await mkdir(shots, { recursive: true });
const integrate = process.env.PUYO_INTEGRATE_SHOTS;
if (integrate) await mkdir(integrate, { recursive: true });
const shot = async (page, name) => { await settle(page); await page.screenshot({ path: `${shots}/jelly-online-${name}.png` }); if (integrate) await page.screenshot({ path: `${integrate}/jelly-integrate-${name}.png` }); };
const netDir = fileURLToPath(new URL('../../services/net/', import.meta.url));

// ---------- 로컬 net 서버 ----------
let server = null, NET = process.env.PUYO_NET;
if (!NET) {
  const state = await mkdtemp(join(tmpdir(), 'jelly-net-'));
  execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'net', '--local', '--persist-to', state], { cwd: netDir, stdio: 'ignore', env: { ...process.env, CI: '1' } });
  const port = 8799;
  server = spawn('npx', ['wrangler', 'dev', '--port', String(port), '--ip', '127.0.0.1', '--persist-to', state], { cwd: netDir, detached: true, env: { ...process.env, CI: '1' } });
  let log = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error(`wrangler dev 가 뜨지 않음\n${log}`)), 60000);
    const read = chunk => { log += chunk; if (/Ready on/.test(log)) { clearTimeout(timer); resolve(); } };
    server.stdout.on('data', read); server.stderr.on('data', read);
    server.on('exit', code => reject(Error(`wrangler dev 가 끝남 (${code})\n${log}`)));
  });
  NET = `http://127.0.0.1:${port}`;
}
const stopServer = () => { if (server) try { process.kill(-server.pid, 'SIGTERM'); } catch { /* 이미 끝남 */ } };

const url = `${base}${base.includes('?') ? '&' : '?'}test&net=${encodeURIComponent(NET)}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
// 저장이 아직 없을 때(404 no-save), 저장 충돌(409), 차단된 뒤 보낸 대화(403 not-friends)는 확인하려고 일부러 내는 응답인데
// Chrome 이 콘솔 오류로 찍는다.
const expected = /Failed to load resource: the server responded with a status of (403|404|409)/;
const mailCalls = []; // 온라인 계정 창에서 친구 우체통을 부른 것 (없어야 한다)
async function open(name, viewport = { width: 1100, height: 860 }) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !expected.test(m.text())) errors.push(`${name}: ${m.text()}`); });
  page.on('dialog', d => d.accept());
  page.on('request', r => { if (r.url().includes('/api/jelly-mail')) mailCalls.push(`${name}: ${r.postData() || r.url()}`); });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__puyo, null, { timeout: 60000 });
  return page;
}
// 화면이 떠오르는 애니메이션(.25초)이 끝난 뒤에 사진을 찍는다
const settle = page => page.waitForTimeout(400);
const read = page => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const screenIs = (page, name) => page.waitForFunction(n => JSON.parse(window.render_game_to_text()).screen === n, name, { timeout: 20000 });
async function signup(page, nick, pass) {
  await page.click('#go-signup');
  await page.fill('#signup-name', nick); await page.fill('#signup-pass', pass);
  await page.click('#signup-form button[type=submit]');
  await screenIs(page, 'menu');
}
const tag = Math.random().toString(36).slice(2, 6);
const nickA = `뿌요A${tag}`, nickB = `뿌요B${tag}`;

try {
  // 1. 가입 두 명 (A 는 컴퓨터, B 는 휴대폰 화면)
  const a = await open('A');
  await a.click('#go-signup');
  await a.fill('#signup-name', nickA); await a.fill('#signup-pass', 'abcd1');
  await settle(a); await a.screenshot({ path: `${shots}/jelly-online-login.png` });
  await a.click('#signup-form button[type=submit]');
  await screenIs(a, 'menu');
  const b = await open('B', { width: 390, height: 844 });
  await signup(b, nickB, 'abcd2');
  assert.equal((await read(a)).net.nickname, nickA);
  // 같은 닉네임으로는 가입할 수 없다
  const dup = await open('dup');
  await dup.click('#go-signup'); await dup.fill('#signup-name', nickA); await dup.fill('#signup-pass', 'zzzz');
  await dup.click('#signup-form button[type=submit]');
  await dup.waitForFunction(() => /이미 있는 닉네임/.test(document.getElementById('login-msg').textContent));
  await dup.context().close();

  // 2. 둘 다 "게임 찾기" → 코드 없이 같은 판
  for (const p of [a, b]) { await p.click('[data-go="online"]'); await screenIs(p, 'online'); }
  assert.equal(await a.locator('#online-room-box').isHidden(), true); // 온라인 계정은 방 코드가 보이지 않는다
  await a.click('#online-find');
  await a.waitForSelector('#online-searching:not([hidden])');
  await b.click('#online-find');
  for (const p of [a, b]) await p.waitForSelector('#online-lobby:not([hidden])', { timeout: 30000 });
  await a.waitForFunction(n => document.getElementById('lobby-you').textContent.startsWith(n), nickB, { timeout: 15000 });
  await b.waitForFunction(n => document.getElementById('lobby-you').textContent.startsWith(n), nickA, { timeout: 15000 });
  await settle(a); await a.screenshot({ path: `${shots}/jelly-online-lobby.png` });
  const aHost = (await read(a)).online.host;
  const [host, guest] = aHost ? [a, b] : [b, a];
  await host.waitForFunction(() => !document.getElementById('online-start').disabled, null, { timeout: 15000 });
  await host.click('#online-first [data-v="1"]');
  await guest.waitForFunction(() => document.getElementById('online-wait').textContent.includes('1판'), null, { timeout: 15000 });
  await host.click('#online-start');
  for (const p of [a, b]) await p.waitForFunction(() => window.__puyo.game?.mode === 'online' && window.__puyo.match?.phase === 'play', null, { timeout: 20000 });
  assert.equal(await a.textContent('#hud-title'), `온라인 · ${nickB}`);
  assert.equal(await b.textContent('#hud-title'), `온라인 · ${nickA}`);

  // 3. 대전 채팅: 빠른 말과 뿌요 이모티콘은 번호로, 직접 쓴 말은 서버가 걸러서. 전화번호처럼 보이면 보내지도 않는다
  await a.click('#hud-chat');
  await a.waitForSelector('#chat:not([hidden])');
  await a.click('#chat-quick [data-q="0"]'); // 👋 안녕!
  await a.click('#chat-emoji-toggle'); await a.click('#chat-stickers [data-sticker="4"]'); // 뿌요 이모티콘 「최고!」
  await a.click('#chat-emojis [data-emoji="😀"]'); await a.click('#chat-emojis [data-emoji="🎉"]');
  await a.click('#chat-form button[type=submit]'); // 이모지만 두 개
  await a.fill('#chat-input', '내 번호 010-1234-5678');
  await a.click('#chat-form button[type=submit]');
  await a.waitForFunction(() => /전화번호는 보낼 수 없어/.test(document.getElementById('chat-note').textContent));
  await a.fill('#chat-input', '안녕! 내 번호 1234 5678'); // 기기 거르개는 통과, 서버가 가린다
  await a.click('#chat-form button[type=submit]');
  // B 는 판 위에서 말풍선과 💬 점으로 먼저 본다
  await b.waitForFunction(() => !document.getElementById('hud-chat-dot').hidden, null, { timeout: 15000 });
  await b.click('#hud-chat');
  await b.waitForFunction(() => document.querySelectorAll('#chat-log .msg.them').length >= 4, null, { timeout: 15000 });
  const themB = await b.evaluate(() => [...document.querySelectorAll('#chat-log .msg.them')].map(m => (m.classList.contains('sticker') ? `sticker:${m.querySelector('img').alt}` : `${m.classList.contains('big') ? 'big:' : ''}${m.textContent}`)));
  assert.deepEqual(themB.slice(0, 3), ['👋 안녕!', 'sticker:뿌요 이모티콘 최고!', 'big:😀🎉']);
  assert.match(themB[3], /^안녕! 내 번호 /);
  assert.ok(!/1234|5678/.test(themB[3]) && themB[3].includes('*'), themB[3]);
  assert.equal(themB.length, 4); // 막힌 전화번호 말은 가지 않았다
  await b.click('#chat-quick [data-q="6"]'); // 🎉 GG!
  await a.waitForFunction(() => [...document.querySelectorAll('#chat-log .msg.them span')].some(s => s.textContent === '🎉 GG!'), null, { timeout: 15000 });
  await shot(a, 'match-chat');
  await settle(b); await b.screenshot({ path: `${shots}/jelly-online-chat-phone.png` });
  await b.click('#chat-close'); await a.click('#chat-close');
  // 채팅 끄기 (내 정보 → 설정): 💬 단추가 사라지고, 온 말은 보이지 않는다
  await b.evaluate(() => { window.__puyo.P().settings.chat = false; window.__puyo.save(); });
  const before = await b.evaluate(() => document.querySelectorAll('#bubbles .bubble').length);
  await a.click('#hud-chat'); await a.fill('#chat-input', '꺼져 있니?'); await a.click('#chat-form button[type=submit]'); await a.click('#chat-close');
  await b.waitForTimeout(1500);
  assert.equal(await b.evaluate(() => document.getElementById('hud-chat-dot').hidden), true);
  assert.equal(await b.evaluate(() => document.querySelectorAll('#bubbles .bubble').length), before);
  await b.evaluate(() => { window.__puyo.P().settings.chat = true; window.__puyo.save(); });

  // 상대 필드 모습이 건너온다 (숫자 배열이라 서버가 가리지 않음)
  await host.evaluate(() => { const p = window.__puyo.match.players[0]; p.cells[71] = 3; p.refreshHeights(); });
  await guest.waitForFunction(() => window.__puyo.match.players[1].cells[71] === 3, null, { timeout: 15000 });

  // 4. 판을 끝낸다 (방장 필드를 가득 채움) → 결과 화면에서 친구 요청 → B 가 수락
  await host.evaluate(() => { const p = window.__puyo.match.players[0]; for (let y = 0; y < 12; y++) p.cells[y * 6 + 2] = 6; p.refreshHeights(); });
  for (const p of [a, b]) await p.waitForSelector('#result:not([hidden])', { timeout: 30000 });
  await a.waitForSelector('#result-social:not([hidden])');
  assert.match(await a.textContent('#result-friend'), new RegExp(nickB));
  await a.click('#result-friend');
  await a.waitForFunction(() => document.getElementById('result-friend').textContent.includes('보냄'));
  await b.click('#result-buttons button.ghost'); // 나가기
  await screenIs(b, 'online');
  await b.waitForFunction(() => !document.getElementById('friends-badge').hidden, null, { timeout: 15000 });
  await b.click('#go-friends');
  await screenIs(b, 'friends');
  await b.waitForFunction(n => [...document.querySelectorAll('#req-in .friend b')].some(x => x.textContent === n), nickA, { timeout: 15000 });
  await b.locator('#req-in .friend button.primary').first().click();
  await b.waitForFunction(n => [...document.querySelectorAll('#net-friend-list .friend b')].some(x => x.textContent === n), nickA, { timeout: 15000 });
  await settle(b); await b.screenshot({ path: `${shots}/jelly-online-friends-phone.png` });
  assert.equal(await b.locator('#friends-main').isHidden(), true); // 친구 코드 화면은 이 기기 계정만
  assert.equal(await b.locator('#go-legacy').isHidden(), true); // 옮긴 계정이 아니면 기존 친구 기록도 없다
  // 닉네임으로 찾으면 이미 친구
  await b.fill('#friend-q', nickA.slice(0, 5)); await b.click('#friend-search button[type=submit]');
  await b.waitForFunction(() => /이미 친구/.test(document.getElementById('friend-results').textContent), null, { timeout: 15000 });
  await a.click('#result-buttons button.ghost');
  await screenIs(a, 'online');
  await a.click('#go-friends');
  await a.waitForFunction(n => [...document.querySelectorAll('#net-friend-list .friend')].some(r => r.querySelector('b').textContent === n && r.querySelector('.dot.on')), nickB, { timeout: 15000 });
  await shot(a, 'friends');

  // 5. 친구 목록에서 초대 → B 가 수락 → 같은 방
  await a.locator('#net-friend-list .friend', { hasText: nickB }).locator('button.primary').click();
  await screenIs(a, 'online');
  await a.waitForSelector('#online-inviting:not([hidden])');
  await b.waitForSelector('#invite-pop:not([hidden])', { timeout: 15000 });
  assert.match(await b.textContent('#invite-text'), new RegExp(nickA));
  await b.click('#invite-yes');
  for (const p of [a, b]) await p.waitForSelector('#online-lobby:not([hidden])', { timeout: 20000 });
  await a.waitForFunction(n => document.getElementById('lobby-you').textContent.startsWith(n), nickB, { timeout: 15000 });
  await a.click('#online-leave');
  await b.waitForFunction(() => !window.__puyo.online.active, null, { timeout: 15000 });

  // 6. 1:1 대화
  await a.click('#go-friends');
  await screenIs(a, 'friends');
  await a.locator('#net-friend-list .friend', { hasText: nickB }).locator('button', { hasText: '대화' }).click();
  await screenIs(a, 'dm');
  await a.fill('#dm-input', 'B야 안녕!'); await a.click('#dm-form button[type=submit]');
  await a.waitForFunction(() => [...document.querySelectorAll('#dm-list .line.me span')].some(s => s.textContent === 'B야 안녕!'));
  await b.click('#go-friends'); await screenIs(b, 'friends');
  await b.waitForFunction(() => document.querySelector('#net-friend-list .friend .badge'), null, { timeout: 15000 }); // 안 읽은 메시지
  await b.locator('#net-friend-list .friend', { hasText: nickA }).locator('button', { hasText: '대화' }).click();
  await screenIs(b, 'dm');
  await b.waitForFunction(() => [...document.querySelectorAll('#dm-list .line.them span')].some(s => s.textContent === 'B야 안녕!'), null, { timeout: 15000 });
  await b.fill('#dm-input', 'A도 안녕!'); await b.click('#dm-form button[type=submit]');
  await a.waitForFunction(() => [...document.querySelectorAll('#dm-list .line.them span')].some(s => s.textContent === 'A도 안녕!'), null, { timeout: 15000 });
  // 1:1 대화의 빠른 말, 뿌요 이모티콘([[st:번호]]), 이모지
  await b.click('#dm-quick [data-q="1"]'); // 👍 잘한다!
  await b.click('#dm-emoji-toggle'); await b.click('#dm-stickers [data-sticker="3"]'); // ㅋㅋㅋ
  await b.click('#dm-emoji-toggle'); await b.click('#dm-emojis [data-emoji="🥳"]'); await b.click('#dm-form button[type=submit]');
  await a.waitForFunction(() => document.querySelectorAll('#dm-list .line.them').length >= 4, null, { timeout: 15000 });
  const dmA = await a.evaluate(() => [...document.querySelectorAll('#dm-list .line.them')].map(l => (l.classList.contains('sticker') ? `sticker:${l.querySelector('img.dm-sticker').alt}` : `${l.classList.contains('emoji-big') ? 'big:' : ''}${l.querySelector('span').textContent}`)));
  assert.deepEqual(dmA.slice(-3), ['👍 잘한다!', 'sticker:뿌요 이모티콘 ㅋㅋㅋ', 'big:🥳']);
  assert.equal(dmA.filter(x => x === 'A도 안녕!').length, 1); // 한 번만 온다
  await shot(a, 'dm-sticker');
  // 채팅을 끄면 1:1 대화도 열지 않는다
  await a.evaluate(() => { window.__puyo.P().settings.chat = false; window.__puyo.show('friends'); });
  await a.locator('#net-friend-list .friend', { hasText: nickB }).locator('button', { hasText: '대화' }).click();
  await a.waitForFunction(() => [...document.querySelectorAll('.toast')].some(t => t.textContent.includes('채팅이 꺼져')), null, { timeout: 5000 });
  assert.equal((await read(a)).screen, 'friends');
  await a.evaluate(() => { window.__puyo.P().settings.chat = true; window.__puyo.save(); });
  await a.locator('#net-friend-list .friend', { hasText: nickB }).locator('button', { hasText: '대화' }).click();
  await screenIs(a, 'dm');

  // 7. 클라우드 저장: A 의 기록을 바꾸면 새 기기에서 A 로 로그인해도 같은 레벨, 코인
  await a.evaluate(() => window.__puyo.show('rewards'));
  await a.click('#daily-button'); // 출석 선물 (코인, 경험치)
  await a.evaluate(() => { const p = window.__puyo.P(); p.level = 17; window.__puyo.save(); });
  await a.waitForFunction(() => window.__puyo.cloud.state === 'synced' && !window.__puyo.cloud.dirty, null, { timeout: 15000 });
  const mine = await read(a);
  const c = await open('C');
  await c.click('#go-net-login');
  await c.fill('#net-login-name', nickA); await c.fill('#net-login-pass', 'abcd1');
  await c.click('#net-login-form button[type=submit]');
  await screenIs(c, 'menu');
  const other = await read(c);
  assert.deepEqual([other.level, other.coins], [mine.level, mine.coins]);
  assert.equal(other.level, 17);
  assert.equal(await c.textContent('#chip-name'), nickA);

  // 8. 저장 충돌: C 가 먼저 쓰고 A 가 옛 revision 으로 쓰면 고르기 창. 서버 쪽을 고르면 C 의 기록이 된다
  await c.evaluate(() => { window.__puyo.P().coins = 7777; window.__puyo.save(); return window.__puyo.cloud.flush(); });
  await c.waitForFunction(() => window.__puyo.cloud.state === 'synced' && !window.__puyo.cloud.dirty);
  await a.evaluate(() => { window.__puyo.P().coins = 12; window.__puyo.save(); window.__puyo.cloud.flush(); });
  await a.waitForSelector('#cloud-conflict:not([hidden])', { timeout: 15000 });
  assert.match(await a.textContent('#conflict-local'), /🪙 12/);
  assert.match(await a.textContent('#conflict-server'), /🪙 7,777/);
  await settle(a); await a.screenshot({ path: `${shots}/jelly-online-conflict.png` });
  await a.click('#conflict-server');
  await a.waitForFunction(() => window.__puyo.P().coins === 7777 && window.__puyo.cloud.state === 'synced', null, { timeout: 15000 });

  // 9. 신고와 차단 (1:1 대화 화면에서)
  await b.click('#dm-report');
  await b.waitForSelector('#ask:not([hidden])');
  await b.fill('#ask-reason', '테스트 신고');
  await b.click('#ask-ok');
  await b.waitForFunction(() => [...document.querySelectorAll('.toast')].some(t => t.textContent.includes('신고했어')), null, { timeout: 15000 });
  await b.click('#dm-block');
  await b.click('#ask-ok');
  await screenIs(b, 'friends');
  await b.waitForFunction(n => ![...document.querySelectorAll('#net-friend-list .friend b')].some(x => x.textContent === n), nickA, { timeout: 15000 });
  await a.evaluate(() => window.__puyo.show('dm')); // A 는 조금 전에 대화하던 B 와의 화면으로
  await screenIs(a, 'dm');
  await a.fill('#dm-input', '또 안녕'); await a.click('#dm-form button[type=submit]');
  await a.waitForFunction(() => [...document.querySelectorAll('.toast')].some(t => t.textContent.includes('친구에게만')), null, { timeout: 15000 });

  // 10. 이 기기 계정 → 온라인 계정 옮기기. 같은 닉네임(A)이 이미 있어서 새 닉네임을 고른다. 기록은 그대로 올라간다.
  //     이 기기 계정에는 친구 코드 친구와 지난 대화가 있고, 우체통에 아직 안 받은 편지가 있다.
  const d = await open('D');
  await d.evaluate(n => window.__puyo.localSignup(n, '1111'), nickA);
  await d.evaluate(() => { const p = window.__puyo.P(); p.level = 9; p.coins = 999; window.__puyo.save(); window.__puyo.show('friends'); });
  await shot(d, 'local-friends'); // 이 기기 계정의 친구 코드 화면
  assert.equal(await d.locator('#friends-net').isHidden(), true);
  const legacyCode = await d.textContent('#my-friend-code');
  assert.match(legacyCode, /^[A-Z0-9]{6}$/);
  const FRIEND = 'QWERTY';
  await d.evaluate(f => {
    const s = window.__puyo.P().social;
    s.friends.push({ code: f, name: '옛친구', level: 7, since: Date.now() - 86400000 });
    s.chats[f] = [{ me: false, text: '어제 재밌었어!', time: Date.now() - 86400000 }, { me: true, sticker: 1, time: Date.now() - 86000000 }];
    s.requests.push({ code: 'ZXCVBN', name: '신청한애', level: 2, time: Date.now() });
    window.__puyo.save(); window.__puyo.show('menu');
  }, FRIEND);
  await d.evaluate(() => window.__puyo.show('profile'));
  await d.click('#logout');
  await screenIs(d, 'login');
  // 우체통이 있는 주소면: 옛친구가 게임을 꺼 둔(로그아웃한) D 에게 편지 두 통을 맡긴다 (D 는 아직 안 받음)
  // (D 의 우체통 열쇠로 hello 를 불러 본다. 개발 서버에는 /api/jelly-mail 이 없어서 404)
  const mailOn = await d.evaluate(() => { const s = window.__puyo.store.accounts[0].progress.social; return fetch('/api/jelly-mail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'hello', code: s.code, key: s.key }) }).then(r => r.json()).then(r => r.ok === true).catch(() => false); });
  let letters = 0;
  if (mailOn) {
    letters = await d.evaluate(async ([f, to]) => {
      const call = body => fetch('/api/jelly-mail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
      const key = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
      await call({ action: 'hello', code: f, key });
      const a1 = await call({ action: 'send', code: f, key, to, id: 'l1', kind: 'msg', text: '옮기기 전에 보낸 편지', name: '옛친구', level: 7 });
      const a2 = await call({ action: 'send', code: f, key, to, id: 'l2', kind: 'st', sticker: 2, name: '옛친구', level: 7 });
      return [a1, a2].filter(r => r.ok).length;
    }, [FRIEND, legacyCode]);
    assert.equal(letters, 2);
  } else console.log('참고: 이 주소에는 친구 우체통이 없어서(개발 서버) 옮길 때 우체통 비우기는 건너뜀');
  await d.click('#login-accounts button');
  await d.fill('#login-pass', '9999');
  await d.click('#migrate-go');
  await d.waitForFunction(() => /비밀번호가 달라/.test(document.getElementById('login-msg').textContent));
  await d.fill('#login-pass', '1111');
  await d.click('#migrate-go');
  await d.waitForSelector('#migrate-form:not([hidden])', { timeout: 15000 });
  assert.match(await d.textContent('#migrate-text'), /이미 온라인에 있어/);
  const nickD = `뿌요D${tag}`;
  await d.fill('#migrate-nick', nickD); await d.fill('#migrate-pass', 'dddd');
  await d.click('#migrate-form button[type=submit]');
  await screenIs(d, 'menu');
  const moved = await read(d);
  assert.deepEqual([moved.net?.nickname, moved.level, moved.coins], [nickD, 9, 999]);
  assert.equal(await d.evaluate(() => window.__puyo.store.accounts[0].migratedTo), nickD); // 기기 계정은 지우지 않고 표시만
  // 친구 코드 기록은 서버에 올리지 않고 기기의 예전 계정에 남는다. 우체통 편지는 옮기기 전에 받아서 거기에 넣었다
  await d.waitForFunction(() => window.__puyo.cloud.state === 'synced', null, { timeout: 15000 });
  assert.deepEqual(await d.evaluate(() => [window.__puyo.cloud.data.social.friends.length, window.__puyo.cloud.data.social.code, window.__puyo.P().social.friends.length]), [0, '', 0]);
  const kept = await d.evaluate(f => { const s = window.__puyo.store.accounts[0].progress.social; return { friends: s.friends.map(x => x.name), chats: s.chats[f].map(m => m.text ?? `st${m.sticker}`), requests: s.requests.map(r => r.name) }; }, FRIEND);
  assert.deepEqual(kept.friends, ['옛친구']);
  assert.deepEqual(kept.chats, mailOn ? ['어제 재밌었어!', 'st1', '옮기기 전에 보낸 편지', 'st2'] : ['어제 재밌었어!', 'st1']);
  assert.deepEqual(kept.requests, ['신청한애']);
  if (mailOn) {
    // 받은 편지는 우체통에서 지워졌다 (다시 열어도 없음)
    const left = await d.evaluate(async () => { const s = window.__puyo.store.accounts[0].progress.social; const r = await fetch('/api/jelly-mail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'inbox', code: s.code, key: s.key }) }).then(x => x.json()); return r.letters.length; });
    assert.equal(left, 0);
  }
  // 온라인 계정의 친구 화면 → 기존 친구(친구 코드) 기록 → 지난 대화 (보내기는 막힘)
  await d.click('[data-go="friends"]');
  await screenIs(d, 'friends');
  await d.waitForSelector('#go-legacy:not([hidden])');
  await d.click('#go-legacy');
  await d.waitForSelector('#friends-legacy:not([hidden])');
  assert.equal(await d.textContent('#legacy-code'), legacyCode);
  assert.match(await d.textContent('#legacy-list'), /옛친구.*QWERTY/);
  assert.match(await d.textContent('#legacy-requests'), /신청한애/);
  assert.match(await d.textContent('#friends-legacy'), /닉네임으로 다시 친구 신청/);
  await shot(d, 'legacy-friends');
  await d.click('#legacy-list [data-legacy]');
  await d.waitForSelector('#chat:not([hidden])');
  const legacyLog = await d.evaluate(() => [...document.querySelectorAll('#chat-log .msg')].map(m => (m.classList.contains('sticker') ? 'sticker' : m.textContent)));
  assert.deepEqual(legacyLog, mailOn ? ['어제 재밌었어!', 'sticker', '옮기기 전에 보낸 편지', 'sticker'] : ['어제 재밌었어!', 'sticker']);
  assert.equal(await d.locator('#chat-input').isDisabled(), true);
  assert.equal(await d.locator('#chat-quick button').count(), 0);
  assert.match(await d.textContent('#chat-note'), /닉네임으로 다시 친구 신청/);
  await shot(d, 'legacy-chat');
  await d.click('#chat-close');
  assert.equal(await d.evaluate(() => window.__puyo.friendNet.state), 'off'); // 온라인 계정은 친구 코드 직접 연결을 켜지 않는다
  await d.evaluate(() => window.__puyo.show('profile'));
  await d.click('#logout');
  await screenIs(d, 'login');
  assert.equal(await d.locator('#login-accounts button').count(), 0);
  await d.click('#go-net-login');
  await d.fill('#net-login-name', nickD); await d.fill('#net-login-pass', 'dddd');
  await d.click('#net-login-form button[type=submit]');
  await screenIs(d, 'menu');
  assert.deepEqual([(await read(d)).level, (await read(d)).coins], [9, 999]);

  // 제작자 모드의 비밀번호 다시 정하기는 이 기기 계정만 (옮긴 계정과 온라인 계정은 목록에 없음)
  await d.evaluate(() => window.__puyo.show('creator'));
  await d.fill('#creator-password', '7777777'); await d.click('#creator-form button[type=submit]');
  await d.waitForSelector('#creator-tools:not([hidden])');
  assert.equal(await d.locator('#reset-account option').count(), 0);
  assert.match(await d.textContent('#reset-form'), /온라인 계정\(서버\) 비밀번호는 여기서 바꿀 수 없고/);
  await shot(d, 'creator-reset');

  // 온라인 계정 창(A, B, C, D 의 옮긴 뒤)은 친구 우체통을 부르지 않았다. D 는 옮기기 전(기기 계정)과 기존 친구 화면에서만 불렀다
  assert.deepEqual(mailCalls.filter(c => !c.startsWith('D: ')), []);

  // 11. 휴대폰 화면(B)이 옆으로 넘치지 않는다
  assert.equal(await b.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

  assert.deepEqual(errors, []);
  console.log(`PASS: 가입 2명(같은 닉네임 거절), 게임 찾기로 같은 판, 대전 채팅(빠른 말, 뿌요 이모티콘, 이모지, 번호는 기기에서 막고 서버가 가림), 채팅 끄기, 결과 화면 친구 요청과 수락, 닉네임 찾기, 친구 초대, 1:1 대화(빠른 말, 뿌요 이모티콘, 이모지, 한 번만 도착, 채팅 끄면 안 열림), 다른 기기에서 같은 레벨/코인, 저장 충돌 고르기, 신고, 차단, 기기 계정 옮기기(닉네임 겹침 → 새 닉네임, 친구 코드 기록은 기기에 남고 ${mailOn ? `우체통 편지 ${letters}통을 받아 넣음` : '우체통 없음: 비우기 건너뜀'}), 기존 친구 기록과 지난 대화(보내기 막힘), 제작자 비밀번호 다시 정하기는 기기 계정만, 온라인 계정은 우체통·친구 코드 연결을 안 씀 — 오류 없음 (net ${NET})`);
  console.log(`Screenshots: ${shots}`);
} finally {
  await browser.close();
  stopServer();
}
