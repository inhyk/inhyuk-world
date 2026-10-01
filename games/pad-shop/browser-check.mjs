import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { initial, SAVE_KEY, TIERS, PADS } from './core.mjs';

const origin = process.env.PAD_SHOP_URL || 'http://127.0.0.1:3000';
const url = `${origin}/play/pad-shop/index.html`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const state = page => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const ready = page => page.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).world.ready);
function watch(page) {
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
}
async function fixture(page, value) {
  // Leave the game first so its pagehide autosave cannot overwrite this fixture.
  await page.goto(`${origin}/robots.txt`);
  // Fixtures skip the one-time nickname sign unless a test sets one itself.
  value = { nickname: '테스터', ...value };
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: SAVE_KEY, value });
  await page.goto(url); await ready(page);
}
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } }); watch(page);
  await page.route('**/_vercel/insights/script.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  assert.equal((await page.goto(`${origin}/play/pad-shop`, { waitUntil: 'domcontentloaded' })).status(), 200);
  assert.equal(await page.locator('iframe').getAttribute('src'), '/play/pad-shop/index.html');
  await page.goto(url); await ready(page);
  assert.ok(await page.locator('#name-dialog').isVisible());
  await page.locator('#name-input').fill('인혁이'); await page.locator('#name-submit').click();
  assert.equal(await page.locator('#shop-name').textContent(), '인혁이의 작은 작업실');
  assert.ok(await page.locator('#tutorial-dialog').isVisible());
  for (let i = 0; i < 5; i++) await page.locator('#tutorial-next').click();
  assert.ok(await page.locator('#tutorial-dialog').isHidden());
  assert.equal((await state(page)).tutorial, true); assert.equal((await state(page)).world.hands, 2);
  assert.ok(await page.locator('#skip').isDisabled());
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'public/images/games/pad-shop-thumb.png', fullPage: true });
  // A tap makes one hit; releasing stops crafting, including across reloads.
  await page.locator('#craft').click(); let s = await state(page); assert.equal(s.order.progress, 12);
  await page.waitForTimeout(350); assert.equal((await state(page)).order.progress, 12);
  await page.reload(); await ready(page); assert.equal((await state(page)).order.progress, 12);
  assert.ok(await page.locator('#tutorial-dialog').isHidden());
  await page.locator('#workbench').focus(); await page.keyboard.down('Space');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).percent === 100); await page.keyboard.up('Space');
  await page.screenshot({ path: 'public/images/games/pad-shop-crafting.png', fullPage: true });
  assert.ok(await page.locator('#sell').isVisible()); assert.equal((await state(page)).held, false);
  await page.keyboard.press('Enter'); s = await state(page); assert.equal(s.money, 1000); assert.equal(s.sold, 1); assert.equal(s.collection[0], 1);
  await page.keyboard.press('Enter'); assert.equal((await state(page)).money, 1000);
  await page.locator('#skip').click(); s = await state(page); assert.equal(s.money, 900); assert.equal(s.skipped, 1);
  // Modal opening and window blur release held keys.
  await page.locator('#workbench').focus(); await page.keyboard.down('Space'); await page.waitForTimeout(250);
  await page.keyboard.press('KeyB'); const progress = (await state(page)).order.progress;
  await page.waitForTimeout(400); assert.equal((await state(page)).order.progress, progress); assert.equal((await state(page)).held, false);
  await page.keyboard.up('Space'); await page.keyboard.press('Escape');
  await page.locator('#workbench').focus(); await page.keyboard.down('Space');
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); assert.equal((await state(page)).held, false); await page.keyboard.up('Space');
  // Buy/equip and restore, with deterministic saved fixtures rather than game cheats.
  const rich = initial(); rich.tutorial = true; rich.money = 15000;
  await fixture(page, rich); await page.locator('#shop').click();
  assert.equal(await page.locator('[data-buy]').count(), TIERS.length); assert.ok(await page.locator('[data-buy="2"]').isDisabled());
  await page.locator('[data-buy="1"]').click(); s = await state(page); assert.equal(s.money, 5000); assert.equal(s.equipped, 1);
  await page.locator('[data-buy="0"]').click(); await page.locator('[data-buy="1"]').click(); assert.equal((await state(page)).money, 5000);
  await page.screenshot({ path: 'public/images/games/pad-shop-store.png', fullPage: true });
  await page.keyboard.press('Escape'); await page.locator('#craft').click(); assert.equal((await state(page)).order.progress, 22);
  await page.reload(); await ready(page); assert.equal((await state(page)).equipped, 1); assert.equal((await state(page)).money, 5000);
  await page.locator('#collection').click(); assert.equal(await page.locator('.collection-item').count(), PADS.length);
  await page.locator('#grade-filter').selectOption('7'); assert.equal(await page.locator('.collection-item').count(), 3);
  await page.locator('#model-filter').selectOption('2'); assert.equal(await page.locator('.collection-item').count(), 1);
  await page.locator('#grade-filter').selectOption('all'); assert.equal(await page.locator('.collection-item').count(), TIERS.length);
  await page.locator('#model-filter').selectOption('all'); await page.keyboard.press('Escape');
  // EX can actually be completed/sold and the victory dialog remains dismissible.
  const expert = initial(); expert.tutorial = true; expert.money = 10000000;
  await fixture(page, expert); await page.locator('#shop').click(); await page.locator('[data-buy="6"]').click();
  assert.ok(await page.locator('#victory-dialog').isVisible()); await page.locator('#victory-dialog [data-close]').click(); assert.equal((await state(page)).won, true);
  expert.money = 0; expert.owned = [0, 6]; expert.equipped = 6; expert.won = true; expert.order = { tier: 6, customer: 7, progress: TIERS[6].work - 1 };
  await fixture(page, expert); await page.locator('#craft').click(); await page.locator('#sell').click(); assert.equal((await state(page)).money, 100000000);
  // Legacy records survive expansion, including the nearly finished EX pad.
  const legacy = { version: 1, money: 1234, earned: 2000, sold: 3, skipped: 1, owned: [0, 6], equipped: 6,
    order: { tier: 6, customer: 2, progress: 1099 }, collection: [2, 0, 0, 0, 0, 0, 1], tutorial: true, sound: false, won: true };
  await fixture(page, legacy); s = await state(page); assert.equal(s.money, 1234); assert.equal(s.order.progress, 1099); assert.equal(s.models[18], 1); assert.equal(s.totalPads, 45);
  await page.locator('#craft').click(); await page.locator('#sell').click(); assert.equal((await state(page)).money, 100001234);
  // A new tool delivers each model once, without replacing existing work.
  const expanded = initial(); expanded.tutorial = true; expanded.money = TIERS[7].cost; expanded.order.progress = 12;
  await fixture(page, expanded); await page.locator('#shop').click(); await page.locator('[data-shop-filter="new"]').click();
  assert.equal(await page.locator('[data-buy]').count(), 8); await page.locator('[data-buy="7"]').click();
  assert.equal((await state(page)).order.progress, 12); assert.deepEqual((await state(page)).specialOrders, [21, 22, 23]);
  await page.locator('[data-shop-filter="owned"]').click(); assert.equal(await page.locator('[data-buy]').count(), 2);
  await page.keyboard.press('Escape'); await page.locator('#craft').click(); await page.locator('#sell').click();
  for (let model = 0; model < 3; model++) {
    s = await state(page); assert.equal(s.order.tier, 7); assert.equal(s.order.model, model); assert.equal(s.order.special, true);
    await page.locator('#workbench').focus(); await page.keyboard.down('Space');
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).percent === 100); await page.keyboard.up('Space');
    assert.equal((await state(page)).world.padModel, ['기본', '미니', '프로'][model]);
    if (model === 2) await page.screenshot({ path: 'public/images/games/pad-shop-expanded.png', fullPage: true });
    await page.keyboard.press('Enter'); assert.equal((await state(page)).models[21 + model], 1);
  }
  await page.reload(); await ready(page); assert.equal((await state(page)).models.filter(Boolean).length, 4); assert.deepEqual((await state(page)).specialOrders, []);
  // The final tool has its own award and the largest pro pad really sells.
  const omega = initial(); omega.tutorial = true; omega.money = TIERS.at(-1).cost;
  await fixture(page, omega); await page.locator('#shop').click(); await page.locator('[data-buy="14"]').click();
  assert.ok(await page.locator('#victory-title').textContent().then(t => t.includes('오메가')));
  await page.locator('#victory-dialog [data-close]').click();
  omega.money = 0; omega.owned = [0, 14]; omega.equipped = 14; omega.master = true;
  omega.order = { tier: 14, model: 2, customer: 7, progress: PADS.at(-1).work - 1, special: true };
  await fixture(page, omega); await page.locator('#craft').click(); await ready(page);
  assert.equal((await state(page)).world.toolStyle, 'OMEGA');
  await page.screenshot({ path: 'public/images/games/pad-shop-omega.png', fullPage: true });
  await page.locator('#sell').click(); assert.equal((await state(page)).money, 160000000000);
  // Reset is explicit, cancel is harmless, confirmation clears all game records.
  await page.locator('#reset').click(); await page.locator('#cancel-reset').click(); assert.equal((await state(page)).money, 160000000000);
  await page.locator('#reset').click(); await page.locator('#confirm-reset').click(); await page.locator('#tutorial-close').click();
  assert.equal((await state(page)).money, 0); assert.equal((await state(page)).sold, 0); assert.deepEqual((await state(page)).owned, [0]);
  await page.reload(); await ready(page); assert.equal((await state(page)).money, 0);
  await page.locator('#sound').click(); assert.equal((await state(page)).sound, false); await page.reload(); await ready(page); assert.equal((await state(page)).sound, false);
  // Touch input uses the same economy and never causes horizontal overflow.
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); watch(mobile);
  await mobile.goto(url); await ready(mobile); await mobile.locator('#name-input').fill('모바일'); await mobile.locator('#name-submit').tap(); await mobile.locator('#tutorial-close').click();
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await mobile.locator('#craft').scrollIntoViewIfNeeded(); const rect = await mobile.locator('#craft').boundingBox();
  const cdp = await mobile.context().newCDPSession(mobile);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }] });
  await mobile.waitForFunction(() => JSON.parse(window.render_game_to_text()).percent === 100);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal((await state(mobile)).money, 0, 'releasing a completed craft must not sell it automatically');
  await mobile.locator('#sell').tap(); assert.equal((await state(mobile)).money, 1000);
  await mobile.locator('#skip').tap(); assert.equal((await state(mobile)).money, 900);
  await mobile.screenshot({ path: '/tmp/pad-shop-mobile-verified.png', fullPage: true });
  await mobile.locator('#shop').tap(); assert.ok(await mobile.locator('#shop-dialog').isVisible());
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await mobile.locator('#shop-dialog [data-close]').tap();
  await fixture(mobile, omega); await mobile.locator('#craft').tap(); await mobile.locator('#sell').tap();
  assert.equal((await state(mobile)).money, 160000000000);
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await mobile.locator('#collection').tap(); await mobile.locator('#grade-filter').selectOption('14');
  assert.equal(await mobile.locator('.collection-item').count(), 3); await mobile.locator('#collection-dialog [data-close]').tap();
  await mobile.setViewportSize({ width: 844, height: 390 }); await ready(mobile);
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  console.log('PASS: 15 tools, 45 pads, model/grade filters, special-order queue, v1 save migration, EX/Omega awards, 160-billion-won Pro sale, desktop/mobile touch, save/reload/reset, and 3D variants; no browser errors.');
} finally { await browser.close(); }
