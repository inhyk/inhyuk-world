import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { MAPS } from './maps.mjs';
import { MISSIONS } from './missions.mjs';
const base = process.env.PUYO_URL || 'http://127.0.0.1:5190/';
const shots = process.env.PUYO_SHOTS || '/tmp/puyo-puyo-expansion';
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
async function setup(options = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, ...options });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.clock.setFixedTime(new Date('2026-10-02T12:00:00+09:00'));
  await page.goto(`${base}?test`); await page.waitForFunction(() => window.__puyo);
  return page;
}
async function talk(page) {
  await page.waitForSelector('#talk:not([hidden])');
  await page.click('#talk'); if (await page.locator('#talk').isVisible()) await page.click('#talk');
}
async function win(page) {
  await page.waitForFunction(() => window.__puyo.match.phase === 'play');
  await page.evaluate(() => {
    const ai = window.__puyo.match.players[1];
    for (let y = 0; y < 12; y++) ai.cells[y * 6 + 2] = 6;
    ai.refreshHeights(); ai.state = 'spawn'; ai.timer = 1;
  });
}
async function unlock(page) {
  await page.click('[data-go="creator"]');
  // 같은 로그인 동안에는 한 번 연 작업실이 열려 있으므로 비밀번호 창이 보일 때만 입력한다.
  if (await page.locator('#creator-form').isVisible()) { await page.fill('#creator-password', '7777777'); await page.click('#creator-form button'); }
}
async function shot(page, name) {
  await page.waitForTimeout(3600); await page.screenshot({ path: `${shots}/${name}.png` });
}
try {
  const page = await setup();
  // 새 계정은 이제 서버(온라인 계정)에 만든다. 서버 없이 확인하려고 예전 방식의 이 기기 계정을 테스트용 함수로 만든다.
  await page.evaluate(() => window.__puyo.localSignup('새모험검증', 'abcd')); await page.waitForSelector('#scr-menu:not([hidden])');
  // 출석 → 교환권 → 레벨 제한 없이 실제 새 상품 교환 → 계정 저장.
  await page.click('[data-go="rewards"]'); await page.click('#daily-button');
  assert.equal(await page.evaluate(() => window.__puyo.P().tickets.effect), 1);
  await page.click('#scr-rewards [data-go="shop"]'); await page.click('#shop-tabs [data-v="effect"]');
  const portal = page.locator('.item').filter({ has: page.getByText('차원 문', { exact: true }) });
  await portal.locator('.ticket-button').click();
  assert.equal(await page.evaluate(() => window.__puyo.P().equip.effect), 'portal');
  assert.equal(await page.evaluate(() => window.__puyo.P().tickets.effect), 0);
  await page.reload(); await page.waitForSelector('#scr-menu:not([hidden])');
  assert.equal(await page.evaluate(() => window.__puyo.P().equip.effect), 'portal');
  // 여섯 맵의 실제 대전, 5판마다 결과 뒤 안내, 닫기와 다음 판 진행.
  for (const [i, map] of MAPS.entries()) {
    await page.click('[data-go="local"]'); await page.click(`[data-map="${map.id}"]`);
    assert.equal(await page.locator(`[data-map="${map.id}"]`).getAttribute('aria-pressed'), 'true');
    await page.click('#local-first [data-v="1"]');
    if (map.id === 'six') await shot(page, 'maps');
    await page.click('#local-start'); await page.waitForFunction(() => window.__puyo.match.phase === 'play');
    const rules = await page.evaluate(() => { const m = window.__puyo.match; return { colors: m.colors, target: m.target, minGroup: m.players.map(p => p.minGroup), map: window.__puyo.game.map, gravity: m.gravity() }; });
    assert.equal(rules.colors, map.colors); assert.equal(rules.target, map.target);
    assert.deepEqual(rules.minGroup, [map.minGroup, map.minGroup]); assert.equal(rules.map, map.id);
    assert.ok(Math.abs(rules.gravity - map.gravityScale / 30) < .000001);
    if (map.id === 'six') {
      await page.evaluate(() => {
        window.__puyo.pause(true);
        for (const p of window.__puyo.match.players) { p.cells.fill(0); for (let i = 0; i < 5; i++) p.cells[i] = 1; p.refreshHeights(); p.check({ canReceive: false }); }
      });
      assert.deepEqual(await page.evaluate(() => window.__puyo.match.players.map(p => p.state)), ['spawn', 'spawn']);
      await page.evaluate(() => { for (const p of window.__puyo.match.players) { p.cells[5] = 1; p.refreshHeights(); p.check({ canReceive: false }); } });
      assert.deepEqual(await page.evaluate(() => window.__puyo.match.players.map(p => p.state)), ['pop', 'pop']);
      await page.click('#pause-resume'); await page.waitForTimeout(1000);
      await page.screenshot({ path: `${shots}/six-play.png` });
    }
    await win(page); await page.waitForSelector('#result:not([hidden])');
    assert.equal(await page.locator('#seonn-promo').isVisible(), i === 4);
    if (i === 4) {
      // 기획서 그림대로: 오른쪽 위 "5초 뒤에 ✕"가 1초씩 줄어들고, 다 센 뒤에야 닫힌다.
      assert.match(await page.textContent('#promo-title'), /seonn/);
      assert.match(await page.textContent('#promo-description'), /40개의 게임을 무료로/);
      assert.equal(await page.locator('.promo-play').getAttribute('href'), 'https://seonn.dev');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'promo-close');
      assert.match(await page.textContent('#promo-close'), /^[45]초 뒤에 ✕$/);
      await page.screenshot({ path: `${shots}/seonn-promo.png` });
      await page.click('#promo-close', { force: true }); await page.keyboard.press('Escape'); await page.keyboard.press('Enter');
      assert.equal(await page.locator('#seonn-promo').isVisible(), true);
      // Esc를 연달아 누르면 브라우저가 강제로 닫지만, 다 세기 전에는 곧바로 다시 열린다.
      for (let n = 0; n < 4; n++) { await page.keyboard.press('Escape'); await page.waitForTimeout(120); }
      await page.waitForSelector('#seonn-promo[open]');
      assert.match(await page.textContent('#promo-close'), /^[1-5]초 뒤에 ✕$/);
      assert.equal(await page.locator('#promo-close').getAttribute('aria-disabled'), 'true');
      await page.waitForFunction(() => document.getElementById('promo-close').textContent === '✕ 닫기', null, { timeout: 8000 });
      assert.equal(await page.locator('#promo-close').getAttribute('aria-disabled'), 'false');
      await page.screenshot({ path: `${shots}/seonn-promo-ready.png` });
      await page.click('#promo-close');
      assert.equal(await page.locator('#seonn-promo').isVisible(), false);
      assert.equal(await page.locator('#result').isVisible(), true);
    }
    await page.getByRole('button', { name: '메뉴로', exact: true }).click();
  }
  assert.equal(await page.evaluate(() => window.__puyo.P().stats.games), 6);
  assert.equal(await page.evaluate(() => window.__puyo.P().promo.lastGame), 5);
  await page.reload(); await page.waitForSelector('#scr-menu:not([hidden])');
  assert.equal(await page.locator('#seonn-promo').isVisible(), false);
  await page.click('[data-go="local"]'); assert.equal(await page.locator('[data-map="six"]').getAttribute('aria-pressed'), 'true');
  await page.click('#scr-local [data-go="menu"]'); await page.click('[data-go="missions"]');
  assert.match(await page.textContent('#mission-count'), new RegExp(String(MISSIONS.length)));
  await page.selectOption('#mission-filter', 'maps'); assert.equal(await page.locator('.mission').count(), 18);
  assert.equal(await page.locator('.mission.done').count(), 6);
  await shot(page, 'missions'); await page.click('#scr-missions [data-go="menu"]');
  // 노바는 혜성 다음에 열리고, 이기면 전용 스킨과 효과를 준다.
  await unlock(page); await page.click('[data-creator="tower"]');
  await page.click('#scr-creator [data-go="menu"]'); await page.click('[data-go="tower"]');
  assert.equal(await page.getByText('초신성 층', { exact: true }).count(), 0);
  await page.evaluate(() => { window.__puyo.P().tower.comet = true; window.__puyo.save(); window.__puyo.show('tower'); });
  const nova = page.locator('.floor').filter({ has: page.getByText('초신성 층', { exact: true }) });
  await nova.getByRole('button', { name: '도전!' }).click(); await talk(page);
  await page.waitForFunction(() => window.__puyo.match.phase === 'play');
  assert.equal(await page.evaluate(() => window.__puyo.match.ai[1].level), 8);
  await page.waitForTimeout(1600); await page.screenshot({ path: `${shots}/nova.png` });
  await win(page); await talk(page); await page.waitForSelector('#result:not([hidden])');
  assert.match(await page.textContent('#result-title'), /초신성 층 정복/);
  assert.equal(await page.evaluate(() => window.__puyo.P().tower.nova), true);
  assert.equal(await page.evaluate(() => window.__puyo.P().owned.skin.includes('aurora')), true);
  assert.equal(await page.evaluate(() => window.__puyo.P().owned.effect.includes('nova')), true);
  await page.getByRole('button', { name: '타워로', exact: true }).click(); await shot(page, 'tower-expanded');
  await page.click('#scr-tower [data-go="menu"]'); await unlock(page); await page.click('[data-creator="skins"]');
  await page.click('#scr-creator [data-go="menu"]'); await page.click('[data-go="shop"]');
  await page.click('#shop-tabs [data-v="skin"]'); assert.equal(await page.locator('.item').count(), 20);
  await page.locator('.item').filter({ has: page.getByText('토끼 젤리', { exact: true }) }).scrollIntoViewIfNeeded();
  await shot(page, 'skins');
  await page.click('#shop-tabs [data-v="effect"]'); assert.equal(await page.locator('.item').count(), 19);
  await page.locator('.item').filter({ has: page.getByText('나비 정원', { exact: true }) }).scrollIntoViewIfNeeded();
  await shot(page, 'effects');
  // 휴대폰에서 지도, 선물, 필터, 안내창이 화면에 맞고 닫힌다.
  const phone = await setup({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await phone.click('#go-guest');
  for (const screen of ['local', 'rewards', 'missions', 'shop']) {
    await phone.click(`[data-go="${screen}"]`);
    assert.equal(await phone.evaluate(screen => { const el = document.getElementById(`scr-${screen}`); return el.scrollWidth <= el.clientWidth; }, screen), true, screen);
    await shot(phone, `${screen}-mobile`);
    await phone.click(`#scr-${screen} [data-go="menu"]`);
  }
  await phone.evaluate(() => { window.__puyo.P().stats.games = 4; window.__puyo.startLocal(1, 'six'); });
  await win(phone); await phone.waitForSelector('#seonn-promo[open]');
  const rect = await phone.locator('#seonn-promo').boundingBox(); assert.ok(rect.x >= 0 && rect.x + rect.width <= 390);
  await phone.screenshot({ path: `${shots}/promo-mobile.png` });
  await phone.waitForFunction(() => document.getElementById('promo-close').textContent === '✕ 닫기', null, { timeout: 8000 });
  await phone.tap('#promo-close');
  assert.equal(await phone.locator('#seonn-promo').isVisible(), false);
  // 광고를 세는 중에 새 판이 시작되면(온라인 다시 하기 등) 광고가 조작을 막지 않도록 바로 닫힌다.
  await phone.getByRole('button', { name: '메뉴로', exact: true }).click();
  await phone.evaluate(() => { window.__puyo.P().stats.games = 9; window.__puyo.startLocal(1, 'garden'); });
  await win(phone); await phone.waitForSelector('#seonn-promo[open]');
  await phone.evaluate(() => window.__puyo.startLocal(1, 'garden'));
  assert.equal(await phone.locator('#seonn-promo').isVisible(), false);
  assert.deepEqual(errors, []);
  console.log('PASS: 6개 맵 실전 규칙·6개 터짐, 5판 광고(5초 뒤에 ✕)/닫기/저장, 151개 챌린지·맵 진행, 교환권 실제 교환, 노바 AI/전용 보상, 새 스킨20/효과19 미리보기, 모바일 — 오류 없음');
  console.log(`Screenshots: ${shots}`);
} finally { await browser.close(); }
