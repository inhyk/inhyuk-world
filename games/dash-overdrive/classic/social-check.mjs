// Two new accounts become friends and chat, on a room server on this computer (never the real one).
// 1) local room server on 8787 with a new empty database (AGENTS.md "시험해 보기")
// 2) a static server for public/ (BASE_URL, default http://127.0.0.1:4173)
// node games/dash-overdrive/classic/social-check.mjs
// SHOTS=/some/folder also saves screenshots (A at 1280x760, B at 390x844).
// The local server takes 10 sign-ups an hour from one address and each run makes two:
// after five runs start the local server again.
import {chromium} from '../../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const net = process.env.NET_URL || 'http://127.0.0.1:8787';
assert.match(net, /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/, 'accounts are only made on a server on this computer');
const url = `${base}/play/dash-overdrive/classic/index.html?net=${net}`;
const run = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
const names = {a: `dasha${run}`, b: `dashb${run}`};
const password = 'race1234';
const shots = process.env.SHOTS;

const browser = await chromium.launch({headless: true});
const errors = [];
async function player(tag, viewport) {
  const context = await browser.newContext({viewport});
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(`${tag}: ${e.message}`));
  await page.goto(url);
  await ready(page);
  return page;
}
const ready = page => page.waitForFunction(() => window.render_classic_status && JSON.parse(window.render_classic_status()).ready
  && window.classicSocial && window.classicOnline, null, {timeout: 60000});
const until = (page, fn, arg) => page.waitForFunction(fn, arg, {timeout: 20000});
const shot = async (page, name) => {
  if (shots) await page.screenshot({path: `${shots}/${name}.png`});
};
const lines = page => page.evaluate(() => window.classicSocial.status().chat?.lines ?? []);

async function signup(page, nickname) {
  await page.click('#social-open');
  await page.click('#social-mode-signup');
  await page.fill('#social-nick', nickname);
  await page.fill('#social-pass', password);
  await page.fill('#social-pass2', 'wrong');
  await page.click('#social-submit');
  assert.match(await page.textContent('#social-status'), /달라/, 'the two passwords must match');
  await page.fill('#social-pass2', password);
  await page.click('#social-submit');
  await until(page, n => window.classicSocial.status().nickname === n && window.classicSocial.status().live === 'online', nickname);
}

const a = await player('A', {width: 1280, height: 760});
const b = await player('B', {width: 390, height: 844});
await a.click('#social-open');
await shot(a, 'login');
await a.click('#social-close');
await signup(a, names.a);
await signup(b, names.b);
assert.equal((await a.textContent('#social-label')).trim(), names.a, 'the header shows the nickname');
// a test server keeps its login apart from the real server's
assert.deepEqual(await a.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('inhyuk-net-session'))), [`inhyuk-net-session@${net}`]);

// A finds B by nickname and asks to be friends
await a.fill('#social-q', names.b);
await a.press('#social-q', 'Enter');
await a.locator(`#social-results .social-row[data-nick="${names.b}"] [data-action="request"]`).click();
await until(a, n => window.classicSocial.status().outgoing.includes(n), names.b);

// B gets the request at once and accepts it
await until(b, n => window.classicSocial.status().incoming.includes(n), names.a);
assert.equal(await b.isVisible('#social-badge'), true, 'the header button counts the request');
await shot(b, 'request');
await b.locator(`#social-in .social-row[data-nick="${names.a}"] button.primary`).click();
for (const [page, other] of [[a, names.b], [b, names.a]]) {
  await until(page, n => window.classicSocial.status().friends.some(f => f.nickname === n && f.online), other);
  await page.locator(`#social-friends .social-row[data-nick="${other}"]`).waitFor();
}
await shot(a, 'friends');

// A calls B to chat; B says yes on the pop-up
await a.locator(`#social-friends .social-row[data-nick="${names.b}"] [data-action="chat"]`).click();
await b.waitForSelector('#social-invite:not([hidden])');
assert.match(await b.textContent('#social-invite-text'), new RegExp(names.a));
await shot(b, 'invite');
await b.click('#social-invite-yes');
for (const page of [a, b]) await until(page, () => window.classicSocial.status().chat?.state === 'open');
assert.equal(await a.textContent('#social-with'), names.b, 'the name comes from the server');
assert.equal(await b.textContent('#social-with'), names.a, 'the name comes from the server');

// typing stays in the chat box and never reaches the game
await a.evaluate(() => {
  window.keysSeen = 0;
  window.addEventListener('keydown', () => window.keysSeen++);
});
await a.type('#social-say', 'hi there');
await a.focus('#social-close');
await a.keyboard.press('z');
assert.equal(await a.evaluate(() => window.keysSeen), 0, 'keys stay out of the game while the panel is open');

await a.fill('#social-say', '안녕! 같이 달리자');
await a.press('#social-say', 'Enter');
await until(b, text => window.classicSocial.status().chat.lines.some(l => l.who === 'them' && l.text === text), '안녕! 같이 달리자');
assert.equal(await b.locator('#social-lines .social-line.them b').last().textContent(), names.a);
await b.fill('#social-say', '좋아!');
await b.press('#social-say', 'Enter');
await until(a, text => window.classicSocial.status().chat.lines.some(l => l.who === 'them' && l.text === text), '좋아!');

// a few lines at once go out, then one a second (under the server's limit, so none is dropped)
await a.waitForTimeout(4500);
for (const word of ['하나', '둘', '셋', '넷']) {
  await a.fill('#social-say', word);
  await a.press('#social-say', 'Enter');
  assert.equal(await a.inputValue('#social-say'), '', `${word} went out`);
}
await a.fill('#social-say', '다섯');
await a.press('#social-say', 'Enter');
assert.match(await a.textContent('#social-status'), /천천히/);
assert.equal(await a.inputValue('#social-say'), '다섯', 'a line sent too fast stays in the box');
await until(b, () => window.classicSocial.status().chat.lines.filter(l => l.who === 'them').map(l => l.text).join(' ').endsWith('하나 둘 셋 넷'));
// the server hides a phone number before B sees it
await a.waitForTimeout(1100);
await a.fill('#social-say', '내 번호 010-1234-5678');
await a.press('#social-say', 'Enter');
await until(b, () => window.classicSocial.status().chat.lines.some(l => l.who === 'them' && l.text.startsWith('내 번호')));
const seen = (await lines(b)).find(l => l.text.startsWith('내 번호')).text;
assert.ok(!seen.includes('5678'), `the phone number is hidden: ${seen}`);

for (const page of [a, b]) {
  assert.equal(await page.isVisible('#social-block'), true, 'block button on the chat screen');
  assert.equal(await page.isVisible('#social-report'), true, 'report button on the chat screen');
}
await shot(a, 'chat');
await shot(b, 'chat-phone');

// B reports the chat (it goes to the local server only)
await b.click('#social-report');
await b.fill('#social-ask-reason', '시험으로 보내는 신고');
await shot(b, 'report');
await b.click('#social-ask-ok');
await until(b, () => document.getElementById('social-status').textContent.includes('신고했어'));

// 같이 달리기: A makes a race room, B joins it from the chat
await a.click('#social-race');
await until(a, () => window.classicOnline.isOpen() && window.classicOnline.status().room.length === 6);
const code = await a.evaluate(() => window.classicOnline.status().room);
await until(b, () => window.classicSocial.status().chat.lines.some(l => l.who === 'race'));
await b.click('#social-lines .social-offer button');
for (const page of [a, b]) await until(page, () => window.classicOnline.status().peers === 1);
assert.equal(await b.evaluate(() => window.classicOnline.status().room), code, 'B is in the race room');
await b.click('#online-leave');
await until(a, () => window.classicOnline.status().peers === 0);

// 같이 달리기 from a friend's row: once B says yes, A's race room opens and B gets the offer
await a.click('#social-open');
await a.click('#social-hangup');
await until(b, () => window.classicSocial.status().chat?.state === 'ended');
await a.locator(`#social-friends .social-row[data-nick="${names.b}"] [data-action="race"]`).click();
await b.waitForSelector('#social-invite:not([hidden])');
await b.click('#social-invite-yes');
await until(b, () => window.classicSocial.status().chat?.lines.some(l => l.who === 'race'));
await until(a, () => window.classicOnline.isOpen() && window.classicOnline.status().room.length === 6);
await shot(b, 'race-offer');

// A blocks B: B drops out of A's friends and the chat ends for B
await a.click('#social-open');
await a.click('#social-block');
await a.click('#social-ask-ok');
await until(a, n => !window.classicSocial.status().friends.some(f => f.nickname === n), names.b);
await until(b, () => window.classicSocial.status().chat?.state === 'ended');

// the login stays after a reload; logging out forgets it
await a.reload();
await ready(a);
await until(a, n => window.classicSocial.status().nickname === n, names.a);
assert.equal((await a.textContent('#social-label')).trim(), names.a);
await b.click('#social-back');
await b.click('#social-logout');
await b.click('#social-ask-ok');
await until(b, () => !window.classicSocial.status().loggedIn);
assert.equal((await b.textContent('#social-label')).trim(), '로그인');

assert.deepEqual(errors, []);
console.log(`social check passed (${names.a}, ${names.b}, race room ${code})`);
await browser.close();
