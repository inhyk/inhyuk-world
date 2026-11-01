// Two players race in one room on a local room server.
// 1) local room server on 8787 (see AGENTS.md "시험해 보기")
// 2) a static server for public/ (BASE_URL, default http://127.0.0.1:4173)
// node games/dash-overdrive/classic/online-check.mjs
import {chromium} from '../../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const url = `${base}/play/dash-overdrive/classic/index.html?net=${process.env.NET_URL || 'http://127.0.0.1:8787'}`;
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
await b.click('#online-open');
await b.click('#online-leave');
await a.waitForFunction(() => document.querySelectorAll('#online-players li').length === 1 || window.classicOnline.status().peers === 0, null, {timeout: 20000});
await a.waitForTimeout(400);
const ghostsAfter = await a.evaluate(() => window.classicOnline.status().ghosts);
assert.equal(ghostsA, 1, 'host sees the friend');
assert.equal(ghostsB, 1, 'friend sees the host');
assert.equal(raceA, true, 'race board shows');
assert.equal(ghostsAfter, 0, 'the friend disappears after leaving');
assert.deepEqual(errors, []);
console.log(`online race passed (room ${code})`);
await browser.close();
