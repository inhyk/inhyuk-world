// Browser check for the classic mode. Start a server for public/ first, then:
// BASE_URL=http://127.0.0.1:4173 node games/dash-overdrive/classic/browser-check.mjs
import {chromium} from '../../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

const base = process.env.BASE_URL || 'http://localhost:3000';
const page_ = `${base}/play/dash-overdrive/classic/index.html`;
const browser = await chromium.launch({headless: true});
const errors = [];
const status = page => page.evaluate(() => JSON.parse(window.render_classic_status()));

async function open(viewport, query = '', touch = false) {
  const context = await browser.newContext({viewport, hasTouch: touch, isMobile: touch});
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${page_}${query}`);
  await page.waitForFunction(() => window.render_classic_status && JSON.parse(window.render_classic_status()).ready, null, {timeout: 60000});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no sideways scroll');
  return {page, context};
}

try {
  {
    const {page, context} = await open({width: 1440, height: 900});
    await page.waitForTimeout(2500);
    await page.screenshot({path: 'public/images/games/dash-overdrive-classic-menu.png'});
    // title PLAY button (engine coordinates 1152, 590 on a 2304 x 1296 screen)
    const box = await page.locator('#canvas').boundingBox();
    // the engine reads the button once per frame, so hold the click briefly
    await page.mouse.move(box.x + box.width * 1152 / 2304, box.y + box.height * 590 / 1296);
    await page.mouse.down();
    await page.waitForTimeout(80);
    await page.mouse.up();
    await page.waitForFunction(() => JSON.parse(window.render_classic_status()).state === 1);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => JSON.parse(window.render_classic_status()).state === 2);
    assert.equal((await status(page)).level, 1);
    await page.waitForTimeout(2000);
    assert.ok((await status(page)).percent > 0, 'the cube runs');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    assert.equal((await status(page)).paused, true);
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    assert.equal((await status(page)).paused, false);
    console.log('title, level select, level 1, pause and resume passed');

    // level picker on the page
    await page.click('#select');
    await page.click('[data-level="5"]');
    await page.click('#play');
    await page.waitForFunction(() => JSON.parse(window.render_classic_status()).level === 5);
    console.log('page level picker passed');

    // map maker: place a few things and play the map
    await page.evaluate(() => Module._classic_go_title());
    await page.evaluate(() => window.classicEditor.open());
    const grid = await page.locator('#editor-canvas').boundingBox();
    for (const x of [0.4, 0.5]) await page.mouse.click(grid.x + grid.width * x, grid.y + grid.height * 0.86);
    const text = await page.evaluate(() => window.classicEditor.levelText());
    assert.match(text, /^kS29,1_\d+_2_\d+_3_\d+,kS30,/);
    assert.equal(text.split(';').filter(row => row.startsWith('1,1,')).length, 2);
    await page.click('#editor-test');
    await page.waitForFunction(() => JSON.parse(window.render_classic_status()).level === 16);
    await page.evaluate(() => Module._classic_go_title());
    await page.waitForFunction(() => JSON.parse(window.render_classic_status()).editor);
    console.log('map maker passed');
    await context.close();
  }
  for (const viewport of [{width: 390, height: 844}, {width: 844, height: 390}]) {
    const {page, context} = await open(viewport, '?start=2', true);
    await page.waitForFunction(() => JSON.parse(window.render_classic_status()).state === 2);
    const box = await page.locator('#canvas').boundingBox();
    assert.ok(box.width <= viewport.width && box.height > 100);
    await context.close();
    console.log(`mobile ${viewport.width}x${viewport.height} passed`);
  }
  assert.deepEqual(errors, []);
  console.log('classic browser check passed');
} finally {
  await browser.close();
}
