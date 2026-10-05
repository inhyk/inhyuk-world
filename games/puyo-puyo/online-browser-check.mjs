// 온라인 계정으로 하는 것들을 실제 Chrome 두 창(+ 다른 기기 하나)과 로컬 net 서버로 끝까지 확인한다.
// 가입 두 명 → 둘 다 "게임 찾기" → 같은 판 → 채팅의 전화번호가 가려짐 → 판이 끝난 뒤 결과 화면에서 친구 요청 → 수락
// → 친구 목록에서 초대 → 1:1 대화 → 클라우드 저장(다른 기기에서 같은 레벨, 코인) → 저장 충돌 고르기 창 → 신고, 차단.
//
// 사용법:
//   npm run puyo-puyo:dev   (게임, http://127.0.0.1:5190)
//   PUYO_URL=http://127.0.0.1:5190/ node games/puyo-puyo/online-browser-check.mjs
// net 서버: PUYO_NET 이 없으면 services/net 에서 빈 로컬 D1 로 wrangler dev 를 새로 띄우고(포트 8799) 끝나면 끈다.
//   이미 띄운 서버를 쓰려면 PUYO_NET=http://127.0.0.1:8787 (cd services/net && npx wrangler d1 migrations apply net --local && npx wrangler dev).
//   가입은 IP 하나에서 1시간에 10번까지라서, 같은 서버로 여러 번 돌리면 429 가 날 수 있다(그때는 빈 서버로).
// 화면 사진: PUYO_SHOTS (기본 /tmp/jelly-online), 이름은 jelly-online-*.png
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
async function open(name, viewport = { width: 1100, height: 860 }) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !expected.test(m.text())) errors.push(`${name}: ${m.text()}`); });
  page.on('dialog', d => d.accept());
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
const nickA = `젤리A${tag}`, nickB = `젤리B${tag}`;

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
  assert.equal(await a.locator('#room-code, #room-input').count(), 0); // 방 코드 화면이 없다
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

  // 3. 대전 채팅: 전화번호는 상대 화면에서 가려진다
  await a.click('#chat-toggle');
  await a.fill('#chat-input', '안녕! 내 번호 010-1234-5678');
  await a.click('#chat-form button[type=submit]');
  await b.waitForFunction(() => document.querySelectorAll('#chat-lines .line.them').length > 0, null, { timeout: 15000 });
  const seen = await b.locator('#chat-lines .line.them span').first().textContent();
  assert.match(seen, /^안녕! 내 번호 /);
  assert.ok(!/1234|5678/.test(seen) && seen.includes('*'), seen);
  assert.equal(await b.locator('#chat-badge').isVisible(), true); // 닫혀 있으면 새 글 수
  await b.click('#chat-toggle');
  await b.fill('#chat-input', '반가워');
  await b.click('#chat-form button[type=submit]');
  await a.waitForFunction(() => [...document.querySelectorAll('#chat-lines .line.them span')].some(s => s.textContent === '반가워'), null, { timeout: 15000 });
  await settle(a); await a.screenshot({ path: `${shots}/jelly-online-chat.png` });
  await settle(b); await b.screenshot({ path: `${shots}/jelly-online-chat-phone.png` });
  await b.click('#chat-close'); await a.click('#chat-close');

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
  await b.waitForFunction(n => [...document.querySelectorAll('#friend-list .friend b')].some(x => x.textContent === n), nickA, { timeout: 15000 });
  await settle(b); await b.screenshot({ path: `${shots}/jelly-online-friends-phone.png` });
  // 닉네임으로 찾으면 이미 친구
  await b.fill('#friend-q', nickA.slice(0, 5)); await b.click('#friend-search button[type=submit]');
  await b.waitForFunction(() => /이미 친구/.test(document.getElementById('friend-results').textContent), null, { timeout: 15000 });
  await a.click('#result-buttons button.ghost');
  await screenIs(a, 'online');
  await a.click('#go-friends');
  await a.waitForFunction(n => [...document.querySelectorAll('#friend-list .friend')].some(r => r.querySelector('b').textContent === n && r.querySelector('.dot.on')), nickB, { timeout: 15000 });
  await settle(a); await a.screenshot({ path: `${shots}/jelly-online-friends.png` });

  // 5. 친구 목록에서 초대 → B 가 수락 → 같은 방
  await a.locator('#friend-list .friend', { hasText: nickB }).locator('button.primary').click();
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
  await a.locator('#friend-list .friend', { hasText: nickB }).locator('button', { hasText: '대화' }).click();
  await screenIs(a, 'dm');
  await a.fill('#dm-input', 'B야 안녕!'); await a.click('#dm-form button[type=submit]');
  await a.waitForFunction(() => [...document.querySelectorAll('#dm-list .line.me span')].some(s => s.textContent === 'B야 안녕!'));
  await b.click('#go-friends'); await screenIs(b, 'friends');
  await b.waitForFunction(() => document.querySelector('#friend-list .friend .badge'), null, { timeout: 15000 }); // 안 읽은 메시지
  await b.locator('#friend-list .friend', { hasText: nickA }).locator('button', { hasText: '대화' }).click();
  await screenIs(b, 'dm');
  await b.waitForFunction(() => [...document.querySelectorAll('#dm-list .line.them span')].some(s => s.textContent === 'B야 안녕!'), null, { timeout: 15000 });
  await b.fill('#dm-input', 'A도 안녕!'); await b.click('#dm-form button[type=submit]');
  await a.waitForFunction(() => [...document.querySelectorAll('#dm-list .line.them span')].some(s => s.textContent === 'A도 안녕!'), null, { timeout: 15000 });

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
  await b.waitForFunction(n => ![...document.querySelectorAll('#friend-list .friend b')].some(x => x.textContent === n), nickA, { timeout: 15000 });
  await a.evaluate(() => window.__puyo.show('dm')); // A 는 조금 전에 대화하던 B 와의 화면으로
  await screenIs(a, 'dm');
  await a.fill('#dm-input', '또 안녕'); await a.click('#dm-form button[type=submit]');
  await a.waitForFunction(() => [...document.querySelectorAll('.toast')].some(t => t.textContent.includes('친구에게만')), null, { timeout: 15000 });

  // 10. 이 기기 계정 → 온라인 계정 옮기기. 같은 닉네임(A)이 이미 있어서 새 닉네임을 고른다. 기록은 그대로 올라간다
  const d = await open('D');
  await d.evaluate(n => window.__puyo.localSignup(n, '1111'), nickA);
  await d.evaluate(() => { const p = window.__puyo.P(); p.level = 9; p.coins = 999; window.__puyo.save(); window.__puyo.show('profile'); });
  await d.click('#logout');
  await screenIs(d, 'login');
  await d.click('#login-accounts button');
  await d.fill('#login-pass', '9999');
  await d.click('#migrate-go');
  await d.waitForFunction(() => /비밀번호가 달라/.test(document.getElementById('login-msg').textContent));
  await d.fill('#login-pass', '1111');
  await d.click('#migrate-go');
  await d.waitForSelector('#migrate-form:not([hidden])', { timeout: 15000 });
  assert.match(await d.textContent('#migrate-text'), /이미 온라인에 있어/);
  const nickD = `젤리D${tag}`;
  await d.fill('#migrate-nick', nickD); await d.fill('#migrate-pass', 'dddd');
  await d.click('#migrate-form button[type=submit]');
  await screenIs(d, 'menu');
  const moved = await read(d);
  assert.deepEqual([moved.net?.nickname, moved.level, moved.coins], [nickD, 9, 999]);
  assert.equal(await d.evaluate(() => window.__puyo.store.accounts[0].migratedTo), nickD); // 기기 계정은 지우지 않고 표시만
  await d.evaluate(() => window.__puyo.show('profile'));
  await d.click('#logout');
  await screenIs(d, 'login');
  assert.equal(await d.locator('#login-accounts button').count(), 0);
  await d.click('#go-net-login');
  await d.fill('#net-login-name', nickD); await d.fill('#net-login-pass', 'dddd');
  await d.click('#net-login-form button[type=submit]');
  await screenIs(d, 'menu');
  assert.deepEqual([(await read(d)).level, (await read(d)).coins], [9, 999]);

  // 11. 휴대폰 화면(B)이 옆으로 넘치지 않는다
  assert.equal(await b.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

  assert.deepEqual(errors, []);
  console.log(`PASS: 가입 2명(같은 닉네임 거절), 게임 찾기로 같은 판, 채팅 전화번호 가림, 결과 화면 친구 요청과 수락, 닉네임 찾기, 친구 초대, 1:1 대화, 다른 기기에서 같은 레벨/코인, 저장 충돌 고르기, 신고, 차단, 기기 계정 옮기기(닉네임 겹침 → 새 닉네임) — 오류 없음 (net ${NET})`);
  console.log(`Screenshots: ${shots}`);
} finally {
  await browser.close();
  stopServer();
}
