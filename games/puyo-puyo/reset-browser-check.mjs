// 제작자 모드의 "계정 비밀번호 다시 정하기": 잊은 비밀번호를 새로 정하고 바로 들어가기, 기록은 그대로.
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const base = process.env.PUYO_URL || 'http://127.0.0.1:5190/';
const shots = process.env.PUYO_SHOTS || '/tmp/puyo-puyo-reset';
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}?test`); await page.waitForFunction(() => window.__puyo);
  // 레벨 55 "안녕" 계정을 만들고 나간다 (비밀번호 abcd를 잊었다고 치자)
  await page.click('#go-signup'); await page.fill('#signup-name', '안녕'); await page.fill('#signup-pass', 'abcd');
  await page.click('#signup-form button[type=submit]'); await page.waitForSelector('#scr-menu:not([hidden])');
  await page.evaluate(() => { const p = window.__puyo.P(); p.level = 55; p.coins = 25069; window.__puyo.save(); });
  await page.click('#profile-chip'); await page.click('#logout'); await page.waitForSelector('#scr-login:not([hidden])');
  // 손님으로 들어가서 제작자 모드 열기
  await page.click('#go-guest'); await page.waitForSelector('#scr-menu:not([hidden])');
  await page.click('[data-go="creator"]'); await page.fill('#creator-password', '7777777'); await page.click('#creator-form button');
  await page.waitForSelector('#reset-form');
  assert.match(await page.textContent('#reset-account'), /안녕 · Lv\.55/);
  // 두 번 다르게 적으면 안 바뀐다
  await page.fill('#reset-pass', '5678'); await page.fill('#reset-pass2', '9999'); await page.click('#reset-form button[type=submit]');
  assert.match(await page.textContent('#reset-msg'), /두 비밀번호가 달라/);
  // 너무 짧으면 안 바뀐다
  await page.fill('#reset-pass', '12'); await page.fill('#reset-pass2', '12'); await page.click('#reset-form button[type=submit]');
  assert.match(await page.textContent('#reset-msg'), /4글자 이상/);
  // 제대로 바꾸기
  await page.fill('#reset-pass', '5678'); await page.fill('#reset-pass2', '5678'); await page.click('#reset-form button[type=submit]');
  await page.waitForFunction(() => document.getElementById('reset-msg').textContent.includes('바꿨어'));
  await page.screenshot({ path: `${shots}/reset.png` });
  await page.click('#reset-login');
  await page.waitForSelector('#scr-menu:not([hidden])');
  assert.equal(await page.textContent('#chip-name'), '안녕');
  assert.equal(await page.textContent('#chip-level'), '55');
  assert.equal(await page.evaluate(() => window.__puyo.P().coins), 25069);
  // 새로고침해도 새 비밀번호가 남고, 옛 비밀번호로는 못 들어간다
  await page.click('#profile-chip'); await page.click('#logout');
  await page.reload(); await page.waitForSelector('#scr-login:not([hidden])');
  await page.click('#login-accounts button'); await page.fill('#login-pass', 'abcd'); await page.click('#login-form button[type=submit]');
  await page.waitForFunction(() => document.getElementById('login-msg').textContent.includes('비밀번호가 달라'));
  await page.fill('#login-pass', '5678'); await page.click('#login-form button[type=submit]');
  await page.waitForSelector('#scr-menu:not([hidden])');
  assert.equal(await page.textContent('#chip-name'), '안녕');
  // 제작자 모드는 계정을 바꾸면 다시 잠긴다
  await page.click('[data-go="creator"]');
  assert.equal(await page.locator('#creator-form').isVisible(), true);
  assert.deepEqual(errors, []);
  console.log('PASS: 제작자 모드 비밀번호 다시 정하기(다르게 두 번·짧은 비밀번호 막기), 바로 들어가기, 레벨·코인 그대로, 새로고침 뒤 새 비밀번호만 — 오류 없음');
} finally { await browser.close(); }
