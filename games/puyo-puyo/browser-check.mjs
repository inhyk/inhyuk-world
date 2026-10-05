// 실제 Chrome에서 확인: 로그인 → 타워 1층 → 왕관 층 → 엔딩 → 보상, 상점, 휴대폰 버튼.
// 사용법: npm run puyo-puyo:dev 후 node games/puyo-puyo/browser-check.mjs (PUYO_URL로 주소 변경)
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

const base = process.env.PUYO_URL || 'http://127.0.0.1:5190/';
const url = `${base}${base.includes('?') ? '&' : '?'}test`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const watch = (page, name) => {
  page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
};
const read = page => page.evaluate(() => JSON.parse(window.render_game_to_text()));
async function closeTalk(page) {
  await page.waitForSelector('#talk:not([hidden])');
  await page.click('#talk');
  if (await page.locator('#talk').isVisible()) await page.click('#talk');
}
async function knockOut(page) {
  await page.waitForFunction(() => window.__puyo.match?.phase === 'play');
  await page.evaluate(() => { const ai = window.__puyo.match.players[1]; for (let y = 0; y < 12; y++) ai.cells[y * 6 + 2] = 6; ai.refreshHeights(); });
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  watch(page, 'desktop');
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__puyo, null, { timeout: 60000 });
  assert.equal((await read(page)).screen, 'login');

  // 1. (이 기기) 계정 만들기 → 로그아웃 → 비밀번호 틀림 → 로그인
  // 새 계정은 이제 서버(온라인 계정)에 만든다. 서버 없이 확인하려고 예전 방식의 이 기기 계정을 테스트용 함수로 만든다.
  await page.evaluate(() => window.__puyo.localSignup('인혁', '1234'));
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).screen === 'menu');
  await page.evaluate(() => window.__puyo.show('profile'));
  await page.click('#logout');
  await page.click('#login-accounts button');
  await page.fill('#login-pass', '9999');
  await page.click('#login-form button[type=submit]');
  assert.match(await page.textContent('#login-msg'), /비밀번호/);
  await page.fill('#login-pass', '1234');
  await page.click('#login-form button[type=submit]');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).screen === 'menu');

  // 2. 타워 1층: 대사 → 대전 → 이기면 2층이 열린다
  await page.click('[data-go="tower"]');
  assert.equal(await page.locator('#tower-list .floor').count(), 6);
  await page.click('#tower-list .floor.open button');
  await closeTalk(page);
  const move = await page.evaluate(() => window.__puyo.match.players[0].piece?.x ?? null);
  await page.waitForFunction(() => window.__puyo.match?.phase === 'play');
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(80);
  assert.notEqual((await read(page)).match.players[0].piece?.x, move ?? 2);
  await knockOut(page);
  await closeTalk(page);
  await page.waitForSelector('#result:not([hidden])');
  assert.match(await page.textContent('#result-title'), /1층 클리어/);
  let state = await read(page);
  assert.equal(state.tower.best, 1);
  assert.ok(state.coins > 100);

  // 3. 왕관 층을 깨면 엔딩, 황금 왕관 스킨, 비밀 층
  await page.evaluate(() => { window.__puyo.P().tower.best = 5; });
  await page.click('#result-buttons button.ghost');
  await page.evaluate(() => window.__puyo.startTower(6));
  await closeTalk(page);
  await knockOut(page);
  await closeTalk(page);
  await page.waitForSelector('#ending:not([hidden])');
  await page.waitForTimeout(1500);
  await page.click('#ending-skip');
  await page.waitForSelector('#result:not([hidden])');
  state = await read(page);
  assert.equal(state.tower.cleared, true);
  assert.equal(state.tower.endings, 1);
  assert.ok(await page.evaluate(() => window.__puyo.P().owned.skin.includes('crown')));
  await page.click('#result-buttons button.ghost');
  await page.waitForSelector('#tower-list .floor.secret');

  // 4. 챌린지와 상점
  await page.evaluate(() => window.__puyo.show('missions'));
  assert.ok(await page.locator('.mission').count() >= 30);
  await page.locator('.mission button.primary').first().click();
  await page.evaluate(() => { window.__puyo.P().coins = 5000; window.__puyo.P().level = 5; window.__puyo.show('shop'); });
  await page.locator('.item button.primary').first().click();
  assert.ok(await page.evaluate(() => window.__puyo.P().owned.skin.length >= 3));

  // 5. 휴대폰: 버튼이 보이고, 화면이 넘치지 않고, 버튼으로 움직인다
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  watch(phone, 'phone');
  await phone.goto(url, { waitUntil: 'domcontentloaded' });
  await phone.waitForFunction(() => window.__puyo, null, { timeout: 60000 });
  await phone.click('#go-guest');
  await phone.evaluate(() => window.__puyo.startVs(1, 1));
  await phone.waitForFunction(() => window.__puyo.match?.players[0].piece);
  assert.equal(await phone.locator('#touch').isVisible(), true);
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const before = (await read(phone)).match.players[0].piece.x;
  await phone.locator('#touch button[data-act="right"]').first().dispatchEvent('pointerdown');
  await phone.waitForTimeout(40);
  await phone.locator('#touch button[data-act="right"]').first().dispatchEvent('pointerup');
  await phone.waitForTimeout(60);
  assert.equal((await read(phone)).match.players[0].piece.x, before + 1);

  assert.deepEqual(errors, []);
  console.log('PASS: 로그인·비밀번호, 타워 1층 클리어, 왕관 층 엔딩과 보상, 비밀 층, 챌린지 보상, 상점 구매, 휴대폰 버튼 — 브라우저 오류 없음');
} finally {
  await browser.close();
}
