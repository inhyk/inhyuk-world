// Two players race in one room on a local room server.
// 1) local room server on 8787 (see AGENTS.md "시험해 보기")
// 2) a static server for public/ (BASE_URL, default http://127.0.0.1:4173)
// node games/dash-overdrive/classic/online-check.mjs
import {chromium} from '../../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
// NET_URL=default uses the real room server (only for one check after a deploy)
const net = process.env.NET_URL || 'http://127.0.0.1:8787';
const url = `${base}/play/dash-overdrive/classic/index.html${net === 'default' ? '' : `?net=${net}`}`;
const browser = await chromium.launch({headless: true});
const errors = [];
async function player(skin) {
  const context = await browser.newContext({viewport: {width: 1280, height: 760}});
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(s => localStorage.setItem('dash-classic:1', String(s)), skin);
  await page.goto(url);
  await page.waitForFunction(() => window.render_classic_status && JSON.parse(window.render_classic_status()).ready && window.classicOnline, null, {timeout: 60000});
  return page;
}
const a = await player(0);
const b = await player(5);
await a.click('#online-open');
await a.click('#online-create');
await a.waitForFunction(() => document.getElementById('online-room-code').textContent.length === 6, null, {timeout: 20000});
const code = await a.textContent('#online-room-code');
await b.click('#online-open');
await b.fill('#online-code', code.toLowerCase());
await b.click('#online-enter');
await a.waitForFunction(() => document.querySelectorAll('#online-players li').length === 2, null, {timeout: 20000});
await b.waitForFunction(() => document.querySelectorAll('#online-players li').length === 2, null, {timeout: 20000});
assert.equal(await b.isVisible('#online-go'), false, 'guest has no start button');
// both invincible so the cubes keep running for the check
for (const page of [a, b]) await page.evaluate(() => { Module._classic_set_creator(1); Module._classic_set_hitboxes(0); });
await a.selectOption('#online-level', '2');
await a.click('#online-go');
for (const page of [a, b]) await page.waitForFunction(() => JSON.parse(window.render_classic_status()).state === 2 && JSON.parse(window.render_classic_status()).level === 3, null, {timeout: 20000});
await a.waitForTimeout(3000);
const ghostsA = await a.evaluate(() => window.classicOnline.status().ghosts);
const ghostsB = await b.evaluate(() => window.classicOnline.status().ghosts);
const raceA = await a.isVisible('#race');
// level 21, DASH AND RUN, is open to everyone, so it can be raced too
await a.click('#online-open');
await a.selectOption('#online-level', '20');
await a.click('#online-go');
for (const page of [a, b]) await page.waitForFunction(() => JSON.parse(window.render_classic_status()).state === 2 && JSON.parse(window.render_classic_status()).level === 21, null, {timeout: 20000});
await b.click('#online-open');
await b.click('#online-leave');
await a.waitForFunction(() => document.querySelectorAll('#online-players li').length === 1 || window.classicOnline.status().peers === 0, null, {timeout: 20000});
await a.waitForTimeout(400);
const ghostsAfter = await a.evaluate(() => window.classicOnline.status().ghosts);
// race on the host's own map, then watch the host after dying
const c = await player(1);
await c.evaluate(() => localStorage.setItem('dash-classic:editor', JSON.stringify({cells: [[25, 0, 8], [26, 0, 8], [27, 0, 8], [40, 0, 1], [41, 1, 1], [55, 0, 8]], song: 3, colors: 2})));
await c.reload();
await c.waitForFunction(() => window.render_classic_status && JSON.parse(window.render_classic_status()).ready && window.classicOnline, null, {timeout: 60000});
const d = await player(2);
await c.click('#online-open');
await c.click('#online-create');
await c.waitForFunction(() => document.getElementById('online-room-code').textContent.length === 6, null, {timeout: 20000});
const code2 = await c.textContent('#online-room-code');
await d.click('#online-open');
await d.fill('#online-code', code2);
await d.click('#online-enter');
await c.waitForFunction(() => document.querySelectorAll('#online-players li').length === 2, null, {timeout: 20000});
await c.evaluate(() => { Module._classic_set_creator(1); Module._classic_set_hitboxes(0); });
await c.selectOption('#online-level', 'custom');
await c.click('#online-go');
for (const page of [c, d]) await page.waitForFunction(() => JSON.parse(window.render_classic_status()).state === 2 && JSON.parse(window.render_classic_status()).level === 111, null, {timeout: 20000});
const sameMap = await d.evaluate(() => new TextDecoder().decode(FS.readFile('/res/leveldata/110.level')));
assert.match(sameMap, /1,8,2,765,3,15/, 'the friend got the host map');
// the friend runs into the first spike and then watches the host
await d.waitForFunction(() => !document.getElementById('watch').hidden, null, {timeout: 20000});
assert.match(await d.textContent('#watch-name'), /관전/);
await d.click('#watch-retry');
await d.waitForFunction(() => document.getElementById('watch').hidden && JSON.parse(window.render_classic_status()).percent < 3, null, {timeout: 5000, polling: 50});

assert.equal(ghostsA, 1, 'host sees the friend');
assert.equal(ghostsB, 1, 'friend sees the host');
assert.equal(raceA, true, 'race board shows');
assert.equal(ghostsAfter, 0, 'the friend disappears after leaving');
assert.deepEqual(errors, []);
console.log(`online race passed (rooms ${code}, ${code2}): ghosts, race board, level 21, own map, watching`);
await browser.close();
