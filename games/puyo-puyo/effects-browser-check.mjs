// 새 터짐 효과 46가지를 실제 Chrome 으로 확인한다 (서버 없이 손님으로). 2026-10-11 요청: "터짐 효과를 더 많이 엄청 많이 더 만들어줘"
// 상점 「✨ 터질 때 효과」에 67가지 → 미리 보기가 오류 없이 돈다 → 코인으로 사서 끼기, 레벨 효과는 레벨이 되어야
// → 새 효과를 하나씩 끼고 직접 놓아 보는 배우기에서 빨강 4개를 터뜨려, 그 효과가 실제로 그려지는지 (컴퓨터는 46가지 모두, 휴대폰은 몇 가지).
//
// 사용법: npm run puyo-puyo:dev 후 PUYO_URL=http://127.0.0.1:5190/ node games/puyo-puyo/effects-browser-check.mjs
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { EFFECTS } from './shop.mjs';

const base = process.env.PUYO_URL || 'http://127.0.0.1:5190/';
const shots = process.env.PUYO_SHOTS || '/tmp/puyo-effects';
await mkdir(shots, { recursive: true });
const url = `${base}${base.includes('?') ? '&' : '?'}test`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const T = { timeout: 20000 };
const OLD = ['sparkle', 'star', 'heart', 'bubble', 'petal', 'note', 'snow', 'pixel', 'firework', 'lightning', 'rainbow', 'blackhole', 'butterfly', 'confetti', 'flame', 'musicbox', 'portal', 'meteor', 'storm', 'nova', 'comet'];
const NEW = EFFECTS.filter(e => !OLD.includes(e.id));
const LOOK = ['comic', 'paw', 'laser', 'slash', 'phoenix', 'legend']; // 게임 화면에서 어떻게 보이는지 사진으로 남길 효과

async function open(name, viewport) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__puyo, null, { timeout: 60000 });
  await page.click('#go-guest');
  await screenIs(page, 'menu');
  await page.evaluate(() => { document.getElementById('toasts').style.visibility = 'hidden'; });
  return page;
}
const screenIs = (page, name) => page.waitForFunction(n => JSON.parse(window.render_game_to_text()).screen === n, name, T);
const holding = page => page.waitForFunction(() => window.__puyo.match?.players[0].state === 'control', null, T);
const card = (page, name) => page.locator('#shop-grid .item', { has: page.locator('b', { hasText: new RegExp(`^${name.replace(/[!?]/g, '\\$&')}$`) }) });

// 효과를 끼고 직접 놓아 보는 배우기에서 빨강 4개를 터뜨린다. 터질 때 불린 효과 이름과 그려진 알갱이 수를 돌려준다
async function popWith(page, id, shot) {
  await page.evaluate(effect => {
    const g = window.__puyo;
    g.P().equip.effect = effect; g.startLab();
    const fx = g.renderer.effects;
    if (!fx.__spy) { fx.__spy = true; const pop = fx.pop.bind(fx); fx.pop = (kind, ...rest) => { window.__popped.push(kind); return pop(kind, ...rest); }; }
    window.__popped = [];
  }, id);
  await holding(page);
  await page.click('#lab-bottom [data-color="1"]'); await page.click('#lab-top [data-color="1"]');
  for (let i = 0; i < 2; i++) {
    await holding(page);
    const placed = await page.evaluate(() => { const p = window.__puyo.match.players[0], n = p.stats.pieces; p.piece.x = 2; p.hardDrop(); return n; });
    await page.waitForFunction(n => { const p = window.__puyo.match.players[0]; return p.stats.pieces === n + 1 && p.state === 'control'; }, placed, T);
  }
  await page.click('#lab-run');
  await page.waitForFunction(() => window.__popped.length >= 4, null, T);
  const drawn = await page.evaluate(() => { const fx = window.__puyo.renderer.effects; return fx.parts.length + fx.rings.length + fx.bolts.length; });
  if (shot) { await page.waitForTimeout(200); await page.screenshot({ path: shot }); }
  await page.waitForFunction(() => { const l = JSON.parse(window.render_game_to_text()).lab; return l && !l.running && l.cells === 0; }, null, T);
  return { popped: await page.evaluate(() => window.__popped), drawn };
}

async function check(name, viewport) {
  const phone = viewport.width < 500;
  const page = await open(name, viewport);
  // 상점: 효과 67가지, 새 효과의 이름이 모두 있다
  await page.click('[data-go="shop"]'); await screenIs(page, 'shop');
  await page.click('#shop-tabs [data-v="effect"]');
  assert.equal(await page.locator('#shop-grid .item').count(), 67);
  const names = await page.evaluate(() => [...document.querySelectorAll('#shop-grid .item > b')].map(b => b.textContent));
  assert.equal(NEW.length, 46);
  for (const item of NEW) assert.ok(names.includes(item.name), item.name);
  // 미리 보기 67칸이 한동안 돌아도 오류가 없다
  await card(page, '물결').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500); await page.screenshot({ path: `${shots}/shop-effects-1-${name}.png` });
  await card(page, '만화 펑!').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500); await page.screenshot({ path: `${shots}/shop-effects-2-${name}.png` });
  await card(page, '전설의 빛').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500); await page.screenshot({ path: `${shots}/shop-effects-3-${name}.png` });
  // 처음(1레벨, 코인 조금)에는 못 산다. 레벨과 코인이 되면 사서 바로 낀다
  assert.equal(await card(page, '칼바람').locator('button').first().isDisabled(), true);
  await page.evaluate(() => { const p = window.__puyo.P(); p.level = 20; p.coins = 90000; window.__puyo.show('shop'); });
  await page.click('#shop-tabs [data-v="effect"]');
  for (const [label, id] of [['만화 펑!', 'comic'], ['칼바람', 'slash']]) {
    await card(page, label).locator('button').first().click();
    await page.waitForFunction(effect => window.__puyo.P().owned.effect.includes(effect), id, T);
    assert.equal(await page.evaluate(() => window.__puyo.P().equip.effect), id);
  }
  assert.equal(await page.evaluate(() => window.__puyo.P().coins), 90000 - 2000 - 4000);
  // 레벨 효과는 40 · 99레벨이 되어야 산다 (교환권으로도 못 받는다)
  assert.match(await card(page, '눈보라').textContent(), /Lv\.40/);
  assert.match(await card(page, '전설의 빛').textContent(), /Lv\.99/);
  assert.equal(await card(page, '눈보라').locator('button').first().isDisabled(), true);
  assert.equal(await card(page, '눈보라').locator('.ticket-button').count(), 0);
  // 새 효과를 끼고 터뜨리면 그 효과가 그려진다
  for (const item of phone ? NEW.filter(e => LOOK.includes(e.id)) : NEW) {
    const r = await popWith(page, item.id, LOOK.includes(item.id) ? `${shots}/pop-${item.id}-${name}.png` : null);
    assert.deepEqual(r.popped.slice(0, 4), Array(4).fill(item.id), item.id);
    assert.ok(r.drawn > 0, `${item.id}: 그려진 것이 없다`);
  }
  await page.context().close();
}

try {
  await check('pc', { width: 1280, height: 720 });
  await check('phone', { width: 390, height: 844 });
  assert.deepEqual(errors, []);
  console.log('PASS: 터짐 효과 — 상점 67가지와 미리 보기 → 코인으로 사서 끼기, 레벨 효과는 레벨이 되어야 → 새 효과 46가지를 하나씩 끼고 터뜨리기 (컴퓨터 46가지, 휴대폰 6가지) — 오류 없음');
  console.log(`Screenshots: ${shots}`);
} finally {
  await browser.close();
}
