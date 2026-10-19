import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
const root = path.resolve('public');
const types = {'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2'};
const server = http.createServer((req,res) => {
  const file = path.resolve(root, '.' + new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404).end();return;}
  res.setHeader('content-type',types[path.extname(file)]||'application/octet-stream');createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const net = process.env.PIXELCRAFT_TEST_NET || 'http://127.0.0.1:8789';
assert.match(net, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/, 'account checks only use a local server');
const url = `http://127.0.0.1:${server.address().port}/play/pixelcraft/index.html?net=${encodeURIComponent(net)}`;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1360, height: 850 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const name = `p${Date.now().toString(36)}`;
const password = 'Browser5678';
const out = path.resolve('artifacts/pixelcraft-adventure');
await fs.mkdir(out, { recursive: true });
async function register() {
  await page.click('#btnAccount'); await page.click('#accountSwitch');
  await page.fill('#accountUsername', name); await page.fill('#accountPassword', password); await page.fill('#accountConfirm', 'mismatch123');
  await page.click('#accountSubmit'); assert.match(await page.textContent('#accountError'), /서로 달라/);
  await page.fill('#accountConfirm', password);
  await page.screenshot({ path: `${out}/15-register.png` });
  await page.click('#accountSubmit'); await page.waitForFunction(() => document.getElementById('accountDialog').hidden);
}
try {
  await page.goto(url);
  await page.waitForSelector('#btnAccount:enabled');
  // An existing guest world stays available only in the guest namespace.
  await page.evaluate(() => {
    const A = window.__pixelcraft;
    const game = A.newGame({ seed: 77, name: '손님 세계', mode: 'creative', diff: 0, slot: 0 });
    localStorage.setItem('pixelcraft.v1.slot0', A.serialize(game));
  });
  await page.reload(); await page.waitForSelector('#btnAccount:enabled');
  assert.match(await page.textContent('#slots'), /손님 세계/);
  await register();
  assert.match(await page.textContent('#accountName'), new RegExp(name));
  assert.doesNotMatch(await page.textContent('#slots'), /손님 세계/);
  await page.click('#slots .play >> nth=0'); await page.fill('#nwName', '나만의 계정 세계'); await page.click('#nwCreate');
  await page.waitForSelector('#adventureDialog:not([hidden])'); await page.click('#adventureActions button:last-child');
  await page.keyboard.press('Escape'); await page.click('#btnQuit');
  assert.match(await page.textContent('#slots'), /나만의 계정 세계/);
  await page.reload(); await page.waitForSelector('#btnLogout:not([hidden])');
  assert.match(await page.textContent('#accountName'), new RegExp(name));
  assert.match(await page.textContent('#slots'), /나만의 계정 세계/);
  await page.screenshot({ path: `${out}/16-account-world.png` });
  await page.click('#btnLogout'); await page.waitForSelector('#btnAccount:not([hidden])');
  assert.match(await page.textContent('#slots'), /손님 세계/);
  assert.doesNotMatch(await page.textContent('#slots'), /나만의 계정 세계/);
  await page.click('#btnAccount'); await page.fill('#accountUsername', name); await page.fill('#accountPassword', 'wrong123'); await page.click('#accountSubmit');
  await page.waitForFunction(() => document.getElementById('accountError').textContent.includes('비밀번호가 달라'));
  assert.equal(await page.locator('#accountDialog').isVisible(), true);
  await page.fill('#accountPassword', password); await page.click('#accountSubmit'); await page.waitForFunction(() => document.getElementById('accountDialog').hidden);
  assert.match(await page.textContent('#slots'), /나만의 계정 세계/);
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const touch = await mobile.newPage(); await touch.goto(url); await touch.waitForSelector('#btnAccount:enabled');
  await touch.click('#btnAccount'); await touch.click('#accountSwitch');
  await touch.screenshot({ path: `${out}/17-mobile-login.png` });
  assert.equal(await touch.locator('#accountSubmit').isVisible(), true);
  assert.ok(await touch.locator('#accountSubmit').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight));
  await mobile.close();
  await page.click('#btnLogout');
  assert.deepEqual(errors, []);
  console.log('PASS: signup, password confirmation, session restoration, wrong password, logout, guest/account world isolation, mobile form');
} finally {
  await browser.close();
  server.close();
}
