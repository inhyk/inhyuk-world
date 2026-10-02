// 제작자·날짜 이벤트·보상 저장·혜성 엔딩을 실제 Chrome UI에서 확인한다.
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { SKINS, EFFECTS } from './shop.mjs';
import { COMET_ENDING_SECONDS } from './ending.mjs';
import { mkdir } from 'node:fs/promises';
const base = process.env.PUYO_URL || 'http://127.0.0.1:5190/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const read = page => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const screenshotDir = process.env.PUYO_SHOTS || '/tmp/puyo-puyo-features';
await mkdir(screenshotDir, { recursive: true });
async function setup(options = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, ...options });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.clock.setFixedTime(new Date('2026-10-01T12:00:00+09:00'));
  await page.goto(`${base}?test`);
  await page.waitForFunction(() => window.__puyo);
  return page;
}
async function closeTalk(page) {
  await page.waitForSelector('#talk:not([hidden])');
  await page.click('#talk');
  if (await page.locator('#talk').isVisible()) await page.click('#talk');
}
async function unlock(page) {
  await page.click('[data-go="creator"]');
  await page.fill('#creator-password', '7777777');
  await page.click('#creator-form button');
  await page.waitForSelector('#creator-tools:not([hidden])');
}
try {
  const page = await setup();
  await page.click('#go-signup');
  await page.fill('#signup-name', '제작자검증'); await page.fill('#signup-pass', 'abcd');
  await page.click('#signup-form button[type=submit]');
  await page.waitForSelector('#scr-menu:not([hidden])');
  await page.click('[data-go="creator"]');
  const before = await page.evaluate(() => JSON.stringify(window.__puyo.P()));
  await page.fill('#creator-password', '777777'); await page.click('#creator-form button');
  assert.match(await page.textContent('#creator-error'), /비밀번호가 달라/);
  assert.equal(await page.locator('#creator-tools').isVisible(), false);
  assert.equal(await page.evaluate(() => JSON.stringify(window.__puyo.P())), before);
  await page.fill('#creator-password', '7777777'); await page.click('#creator-form button');
  for (const action of ['tower', 'level', 'missions', 'skins']) await page.click(`[data-creator="${action}"]`);
  let state = await read(page);
  assert.equal(state.tower.best, 6); assert.equal(state.level, 50); assert.equal(state.tower.comet, false);
  assert.equal(await page.evaluate(() => window.__puyo.P().owned.skin.length), SKINS.length);
  assert.equal(await page.evaluate(() => window.__puyo.P().owned.effect.length), EFFECTS.length);
  await page.screenshot({ path: `${screenshotDir}/creator.png` });
  await page.click('#creator-lock'); assert.equal(await page.locator('#creator-tools').isVisible(), false);
  await page.click('#scr-creator [data-go="menu"]');
  await page.click('[data-go="missions"]');
  assert.equal(await page.locator('.mission:not(.done)').count(), 0);
  await page.locator('.mission button.primary').first().click();
  const missionCoins = (await read(page)).coins;
  await page.click('#scr-missions [data-go="menu"]'); await unlock(page);
  await page.click('[data-creator="missions"]');
  assert.equal((await read(page)).coins, missionCoins);
  await page.click('#scr-creator [data-go="menu"]');
  await page.click('[data-go="rewards"]');
  await page.click('#daily-button');
  assert.equal(await page.locator('#daily-button').isDisabled(), true);
  const dailyCoins = (await read(page)).coins;
  assert.equal(dailyCoins - missionCoins, 100);
  await page.click('#spin-button');
  assert.equal(await page.locator('#spin-button').isDisabled(), true);
  const spinCoins = (await read(page)).coins;
  await page.reload(); // 스핀 중 새로고침해도 이미 저장됨
  await page.waitForSelector('#scr-menu:not([hidden])');
  assert.equal((await read(page)).coins, spinCoins); assert.equal((await read(page)).creatorUnlocked, false);
  await page.click('[data-go="rewards"]');
  assert.equal(await page.locator('#daily-button').isDisabled(), true);
  assert.equal(await page.locator('#spin-button').isDisabled(), true);
  assert.equal(await page.locator('[data-time="5m"]').isDisabled(), true);
  await page.screenshot({ path: `${screenshotDir}/rewards.png` });
  // 새 날이 되면 열려 있는 화면도 갱신된다. 생일 코인, 공휴일 XP를 UI 경로로 지급.
  await page.clock.setFixedTime(new Date('2027-05-12T12:00:00+09:00'));
  await page.waitForFunction(() => !document.getElementById('daily-button').disabled);
  assert.match(await page.textContent('#reward-event'), /생일.*×10/);
  const birthdayBefore = (await read(page)).coins;
  await page.click('#daily-button'); assert.equal((await read(page)).coins - birthdayBefore, 1000);
  await page.clock.setFixedTime(new Date('2027-05-13T12:00:00+09:00'));
  await page.waitForFunction(() => !document.getElementById('daily-button').disabled);
  assert.match(await page.textContent('#reward-event'), /경험치 ×2/);
  const xpBefore = await page.evaluate(() => window.__puyo.P().xp);
  await page.click('#daily-button');
  assert.equal(await page.evaluate(() => window.__puyo.P().xp) - xpBefore, 80);
  // 실제 게임 화면에서 시간 증가, 일시정지·메뉴에서는 증가하지 않는다.
  await page.click('#scr-rewards [data-go="menu"]');
  await page.click('[data-go="solo"]');
  await page.waitForFunction(() => window.__puyo.match.phase === 'play');
  await page.evaluate(() => window.__puyo.recordPlayTime(301));
  assert.ok((await read(page)).rewards.playSeconds >= 300);
  await page.click('#hud-pause');
  const pausedTime = (await read(page)).rewards.playSeconds;
  await page.evaluate(() => window.__puyo.recordPlayTime(300));
  assert.equal((await read(page)).rewards.playSeconds, pausedTime);
  await page.click('#pause-quit');
  await page.evaluate(() => window.__puyo.recordPlayTime(300));
  assert.equal((await read(page)).rewards.playSeconds, pausedTime);
  await page.click('[data-go="rewards"]'); await page.click('[data-time="5m"]');
  assert.equal(await page.locator('[data-time="5m"]').isDisabled(), true);
  await page.reload(); await page.waitForSelector('#scr-menu:not([hidden])');
  await page.click('[data-go="rewards"]');
  assert.equal(await page.locator('[data-time="5m"]').isDisabled(), true);
  // 혜성 대전 승리 → 두 번째 엔딩 → 결과 → 다시 보기.
  await page.click('#scr-rewards [data-go="menu"]'); await page.click('[data-go="tower"]');
  await page.locator('.floor.secret button').click(); await closeTalk(page);
  await page.waitForFunction(() => window.__puyo.match.phase === 'play');
  await page.evaluate(() => { const ai = window.__puyo.match.players[1]; for (let y = 0; y < 12; y++) ai.cells[y * 6 + 2] = 6; ai.refreshHeights(); });
  await closeTalk(page);
  await page.waitForSelector('#ending:not([hidden])');
  assert.equal((await read(page)).ending, 'comet');
  assert.equal((await read(page)).tower.comet, true);
  assert.equal((await read(page)).tower.cometEndings, 1);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${screenshotDir}/comet-ending.png` });
  await page.click('#ending-skip'); await page.waitForSelector('#result:not([hidden])');
  assert.match(await page.textContent('#result-title'), /혜성 층 정복/);
  await page.getByRole('button', { name: '타워로', exact: true }).click();
  assert.ok(await page.locator('.floor.secret.cleared').count());
  assert.equal(await page.locator('#tower-comet-ending').isVisible(), true);
  await page.clock.install();
  await page.click('#tower-comet-ending');
  await page.clock.runFor(COMET_ENDING_SECONDS * 1000 + 50); // 자동으로 마지막 장면을 끝내도 타워로 돌아온다.
  assert.equal(await page.locator('#ending').isVisible(), false);
  assert.equal((await read(page)).screen, 'tower');
  assert.equal((await read(page)).tower.cometEndings, 2);
  // 로그아웃 시 잠금과 현재 계정 해제, 새로고침해도 자동 재로그인하지 않는다.
  await page.clock.resume();
  await page.click('#scr-tower [data-go="menu"]'); await unlock(page);
  await page.click('#scr-creator [data-go="menu"]'); await page.click('#profile-chip'); await page.click('#logout');
  await page.reload(); await page.waitForFunction(() => window.__puyo);
  assert.equal((await read(page)).screen, 'login');
  await page.click('#go-guest'); await page.click('[data-go="creator"]');
  assert.equal(await page.locator('#creator-tools').isVisible(), false);
  // 휴대폰: 제작자 입력과 선물 버튼이 화면 안에 있고 스크롤 가능.
  const phone = await setup({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await phone.click('#go-guest'); await unlock(phone);
  await phone.click('[data-creator="level"]'); assert.equal((await read(phone)).level, 50);
  await phone.screenshot({ path: `${screenshotDir}/creator-mobile.png` });
  await phone.click('#scr-creator [data-go="menu"]'); await phone.click('[data-go="rewards"]');
  await phone.click('#daily-button');
  for (const id of ['scr-rewards', 'scr-creator']) assert.equal(await phone.evaluate(id => { const el = document.getElementById(id); return el.hidden || el.scrollWidth <= el.clientWidth; }, id), true);
  await phone.locator('#scr-rewards').evaluate(el => { el.scrollTop = 0; });
  await phone.screenshot({ path: `${screenshotDir}/rewards-mobile.png` });
  assert.deepEqual(errors, []);
  console.log('PASS: 제작자 비밀번호·4개 기능·재잠금, 출석·스핀·시간 보상·중복 수령 방지·저장, 생일/공휴일 UI, 혜성 승리/엔딩/재생/자동 종료, 로그아웃, 모바일 — 브라우저 오류 없음');
  console.log(`Screenshots: ${screenshotDir}`);
} finally { await browser.close(); }
