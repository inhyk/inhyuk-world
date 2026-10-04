// 연습하기를 실제 키보드·휴대폰 버튼으로 끝까지 해 본다: 옮기기 → 4개 퐁 → 2연쇄 → 선물 → 1층 도전.
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const base = process.env.PUYO_URL || 'http://127.0.0.1:5190/';
const shots = process.env.PUYO_SHOTS || '/tmp/puyo-puyo-practice';
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];

async function open(options) {
  const page = await browser.newPage(options);
  // 경험치 2배가 없는 평일(금요일)로 시계를 고정해 선물 계산을 정확히 본다
  await page.clock.setFixedTime(new Date('2026-10-02T12:00:00+09:00'));
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}?test`); await page.waitForFunction(() => window.__puyo);
  await page.click('#go-guest'); await page.waitForSelector('#scr-menu:not([hidden])');
  return page;
}
const lessonIs = (page, n) => page.waitForFunction(n => window.__puyo.practice?.index === n && !window.__puyo.practice.freeze, n, { timeout: 15000 });
const inControl = page => page.waitForFunction(() => window.__puyo.match?.players[0].state === 'control', null, { timeout: 15000 });
// 키를 한 번 누를 때마다 젤리 짝이 정말 한 칸 움직였는지 확인하면서 맨 왼쪽 줄까지 옮긴다
async function toColumn(page, x) {
  for (;;) {
    const now = await page.evaluate(() => window.__puyo.match.players[0].piece?.x);
    if (now === x) return;
    await page.keyboard.press(now > x ? 'ArrowLeft' : 'ArrowRight');
    await page.waitForFunction(was => window.__puyo.match.players[0].piece?.x !== was, now, { timeout: 5000 });
  }
}
// 말풍선이 필드(위쪽 젤리가 나오는 자리)를 가리지 않는다
async function coachClear(page) {
  const { coach, field } = await page.evaluate(() => ({
    coach: document.getElementById('coach').getBoundingClientRect().bottom,
    field: window.__puyo.renderer.layout.fields[0].y,
  }));
  assert.ok(coach <= field + 1, `말풍선 ${coach} / 필드 ${field}`);
}

try {
  // ---------- PC: 키보드로 ----------
  const page = await open({ viewport: { width: 1280, height: 800 } });
  assert.equal(await page.locator('#practice-badge').isVisible(), true); // 처음에는 NEW
  await page.click('[data-go="practice"]');
  await lessonIs(page, 0);
  assert.match(await page.textContent('#coach-step'), /연습 1 \/ 3/);
  assert.match(await page.textContent('#coach-text'), /Space/); // 키보드에서는 키 이름으로 알려 준다
  await coachClear(page);
  await page.screenshot({ path: `${shots}/pc-lesson1.png` });
  for (const keys of [['ArrowLeft'], ['ArrowUp', 'ArrowRight'], []]) {
    await inControl(page);
    for (const k of keys) await page.keyboard.press(k);
    await page.keyboard.press('Space');
  }
  await page.waitForFunction(() => document.getElementById('coach-title').textContent.includes('잘했어'));
  await lessonIs(page, 1);
  assert.equal(await page.evaluate(() => [...window.__puyo.match.players[0].cells.slice(0, 6)].join('')), '110000'); // 바닥에 빨강 둘
  await inControl(page); await page.keyboard.press('Space'); // 3번째 줄로 그냥 떨어뜨리면 빨강 4개
  await page.waitForFunction(() => document.getElementById('coach-title').textContent.includes('잘했어'));
  await page.screenshot({ path: `${shots}/pc-lesson2-done.png` });
  await lessonIs(page, 2);
  await inControl(page);
  await toColumn(page, 0); await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__puyo.match.players[0].stats.maxChain >= 2, null, { timeout: 15000 });
  await page.waitForFunction(() => document.getElementById('coach-title').textContent.includes('이제 진짜 대결'), null, { timeout: 15000 });
  const p = await page.evaluate(() => ({ tutorial: window.__puyo.P().tutorial, coins: window.__puyo.P().coins }));
  assert.equal(p.tutorial, true); assert.equal(p.coins, 200); // 처음 100 + 연습 선물 100
  await page.screenshot({ path: `${shots}/pc-finish.png` });
  await page.getByRole('button', { name: '🗼 1층 도전' }).click();
  await page.waitForSelector('#talk:not([hidden])');
  assert.match(await page.textContent('#talk-name'), /꼬마 젤리/);
  assert.equal(await page.locator('#coach').isVisible(), false);
  await page.click('#talk'); await page.click('#talk');
  await page.waitForFunction(() => window.__puyo.game?.mode === 'tower');
  await page.evaluate(() => window.__puyo.pause(true)); await page.click('#pause-quit');
  await page.click('#scr-tower [data-go="menu"]');
  assert.equal(await page.locator('#practice-badge').isVisible(), false); // 끝낸 뒤에는 NEW가 사라진다
  // 두 번째로 끝내면 선물은 다시 주지 않는다
  await page.evaluate(() => window.__puyo.startPractice(2));
  await lessonIs(page, 2); await inControl(page);
  await toColumn(page, 0); await page.keyboard.press('Space');
  await page.waitForFunction(() => document.getElementById('coach-title').textContent.includes('이제 진짜 대결'), null, { timeout: 15000 });
  assert.equal(await page.evaluate(() => window.__puyo.P().coins), 200);
  // 놓치면 꼬마 젤리가 다시 해 보자고 하고 판을 되돌린다
  await page.getByRole('button', { name: '메뉴로' }).click();
  await page.evaluate(() => window.__puyo.startPractice(1));
  await lessonIs(page, 1);
  // 빨강 짝을 멀리 떨어진 두 줄(맨 오른쪽, 4번째 줄)에 따로 놓으면 아무것도 안 터진다 → 두 번 놓침
  for (const x of [5, 3]) { await inControl(page); await toColumn(page, x); await page.keyboard.press('Space'); }
  await page.waitForFunction(() => document.getElementById('coach-title').textContent.includes('다시 해 보자'), null, { timeout: 15000 });
  await lessonIs(page, 1);
  assert.equal(await page.evaluate(() => [...window.__puyo.match.players[0].cells.slice(0, 12)].join('')), '110000000000');
  await page.close();

  // ---------- 휴대폰: 화면 버튼으로 ----------
  const phone = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const tap = async act => { await phone.locator(`#touch [data-act="${act}"][data-pad="0"]`).dispatchEvent('pointerdown', { pointerId: 3, pointerType: 'touch' }); await phone.locator(`#touch [data-act="${act}"][data-pad="0"]`).dispatchEvent('pointerup', { pointerId: 3, pointerType: 'touch' }); };
  await phone.click('[data-go="practice"]');
  await lessonIs(phone, 0);
  assert.match(await phone.textContent('#coach-text'), /◀ ▶/); // 휴대폰에서는 화면 버튼 모양으로 알려 준다
  await coachClear(phone);
  await phone.screenshot({ path: `${shots}/phone-lesson1.png` });
  for (let i = 0; i < 3; i++) { await inControl(phone); await tap('drop'); }
  await lessonIs(phone, 1);
  await inControl(phone); await tap('drop');
  await lessonIs(phone, 2);
  await coachClear(phone);
  await phone.screenshot({ path: `${shots}/phone-lesson3.png` });
  // 화면 버튼도 한 번 누를 때마다 한 칸씩 옮겨졌는지 보면서 맨 왼쪽 줄까지
  await inControl(phone);
  for (;;) {
    const x = await phone.evaluate(() => window.__puyo.match.players[0].piece?.x);
    if (x === 0) break;
    await tap('left');
    await phone.waitForFunction(was => window.__puyo.match.players[0].piece?.x !== was, x, { timeout: 5000 });
  }
  await tap('drop');
  await phone.waitForFunction(() => document.getElementById('coach-title').textContent.includes('이제 진짜 대결'), null, { timeout: 15000 });
  await phone.screenshot({ path: `${shots}/phone-finish.png` });

  assert.deepEqual(errors, []);
  console.log('PASS: 연습 3단계(키보드·휴대폰 버튼), 놓치면 다시, 처음 끝내면 선물 한 번, 1층 도전 연결, 말풍선이 필드를 안 가림 — 오류 없음');
  console.log(`Screenshots: ${shots}`);
} finally { await browser.close(); }
