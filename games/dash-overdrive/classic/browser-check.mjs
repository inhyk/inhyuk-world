// Browser check for the classic mode. Start a server for public/ first, then:
// BASE_URL=http://127.0.0.1:4173 node games/dash-overdrive/classic/browser-check.mjs
import {chromium} from '../../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

const base = process.env.BASE_URL || 'http://localhost:3000';
const page_ = `${base}/play/dash-overdrive/classic/index.html`;
const browser = await chromium.launch({headless: true});
const errors = [];
const status = page => page.evaluate(() => JSON.parse(window.render_classic_status()));
// the engine reads keys once per frame, so hold each key for a moment
async function tap(page, key) {
  await page.keyboard.down(key);
  await page.waitForTimeout(80);
  await page.keyboard.up(key);
}

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
    await tap(page, 'Space');
    await page.waitForFunction(() => JSON.parse(window.render_classic_status()).state === 2);
    assert.equal((await status(page)).level, 1);
    await page.waitForTimeout(2000);
    assert.ok((await status(page)).percent > 0, 'the cube runs');
    await tap(page, 'Escape');
    await page.waitForTimeout(200);
    assert.equal((await status(page)).paused, true);
    await tap(page, 'Space');
    await page.waitForTimeout(200);
    assert.equal((await status(page)).paused, false);
    console.log('title, level select, level 1, pause and resume passed');

    // level picker on the page
    await page.click('#select');
    await page.click('[data-level="5"]');
    await page.click('#play');
    await page.waitForFunction(() => JSON.parse(window.render_classic_status()).level === 5);
    console.log('page level picker passed');

    // a click at the bottom middle jumps outside practice (the hidden checkpoint
    // buttons there used to swallow it)
    await page.evaluate(() => { Module._classic_set_creator(1); Module._classic_set_hitboxes(0); Module._classic_start_level(0); });
    await page.waitForFunction(() => Module._classic_state() === 2 && Module._classic_percent() > 50, null, {timeout: 30000});
    await page.waitForTimeout(700);
    const canvas = await page.locator('#canvas').boundingBox();
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height * 0.95);
    const spun = page.evaluate(() => new Promise(done => {
      const started = performance.now();
      const look = () => {
        if (Math.round(Module._classic_player_rotation()) % 90 !== 0) done(true);
        else if (performance.now() - started > 450) done(false);
        else requestAnimationFrame(look);
      };
      look();
    }));
    await page.mouse.down();
    await page.waitForTimeout(80);
    await page.mouse.up();
    assert.equal(await spun, true, 'a click at the bottom middle jumps');
    await page.evaluate(() => { Module._classic_set_creator(0); Module._classic_go_title(); });
    console.log('bottom click passed');

    // map maker: place a few things and play the map
    await page.evaluate(() => Module._classic_go_title());
    await page.evaluate(() => window.classicEditor.open());
    const grid = await page.locator('#editor-canvas').boundingBox();
    for (const x of [0.4, 0.5]) await page.mouse.click(grid.x + grid.width * x, grid.y + grid.height * 0.86);
    const text = await page.evaluate(() => window.classicEditor.levelText());
    assert.match(text, /^kS29,1_\d+_2_\d+_3_\d+,kS30,/);
    assert.equal(text.split(';').filter(row => row.startsWith('1,1,')).length, 2);
    await page.click('#editor-test');
    await page.waitForFunction(() => JSON.parse(window.render_classic_status()).level === 111);
    await page.evaluate(() => Module._classic_go_title());
    await page.waitForFunction(() => JSON.parse(window.render_classic_status()).editor);
    // no height limit: place a block high up
    for (let i = 0; i < 5; i++) await page.click('#editor-up');
    await page.mouse.click(grid.x + grid.width * 0.45, grid.y + grid.height * 0.3);
    const high = await page.evaluate(() => window.classicEditor.map().cells.filter(([, r]) => r > 12).length);
    assert.equal(high, 1, 'a block above the old limit');
    // share code: copy, clear, load it back
    await page.click('#editor-copy');
    await page.waitForFunction(() => document.getElementById('editor-share-text').value.startsWith('DOC1.'));
    const code = await page.inputValue('#editor-share-text');
    await page.click('#editor-share-close');
    await page.click('#editor-clear');
    await page.click('#editor-confirm-yes');
    assert.equal(await page.evaluate(() => window.classicEditor.map().cells.length), 0);
    await page.click('#editor-paste');
    await page.fill('#editor-share-text', code);
    await page.click('#editor-share-load');
    await page.waitForFunction(() => window.classicEditor.map().cells.length === 3);
    console.log('map maker passed (height, share code)');

    // plan 2: every new object from the palette, a share code with them, and a run through them
    await page.click('#editor-clear');
    await page.click('#editor-confirm-yes');
    for (let i = 0; i < 5; i++) await page.click('#editor-down');
    const editorBox = await page.locator('#editor-canvas').boundingBox();
    const cell = editorBox.height / 12;
    // scroll so column c is the second one on screen, then click it (row 0 is the lowest of 11 rows)
    const clickCell = async (c, r) => {
      await page.evaluate(column => {
        const position = document.getElementById('editor-position');
        position.value = String(column);
        position.dispatchEvent(new Event('input'));
      }, c - 1);
      await page.mouse.click(editorBox.x + 1.5 * cell, editorBox.y + (10.5 - r) * cell);
    };
    const placed = [
      [2, '느린 속도', 213], [4, '보통 속도', 214], [6, '빠른 속도', 215], [8, '아주 빠른 속도', 216],
      [10, '분홍 패드', 222], [13, '분홍 링', 220], [16, '공 포털', 210], [19, 'UFO 포털', 211],
      [22, '웨이브 포털', 212], [25, '파랑 링', 221], [27, '파랑 패드', 223],
    ];
    for (const [column, name] of placed) {
      await page.locator('#editor-tools').getByRole('button', {name, exact: true}).click();
      await clickCell(column, 0);
    }
    const newMap = await page.evaluate(() => window.classicEditor.map().cells.map(([c, r, id]) => `${c},${r},${id}`).sort());
    assert.deepEqual(newMap, placed.map(([c, , id]) => `${c},0,${id}`).sort(), 'every new object is on the map');
    const newText = await page.evaluate(() => window.classicEditor.levelText());
    for (const [, , id] of placed) assert.match(newText, new RegExp(`;1,${id},2,`), `object ${id} in the level text`);
    // share code round trip keeps them
    await page.click('#editor-copy');
    await page.waitForFunction(() => document.getElementById('editor-share-text').value.startsWith('DOC1.'));
    const newCode = await page.inputValue('#editor-share-text');
    await page.click('#editor-share-close');
    await page.click('#editor-clear');
    await page.click('#editor-confirm-yes');
    await page.click('#editor-paste');
    await page.fill('#editor-share-text', newCode);
    await page.click('#editor-share-load');
    await page.waitForFunction(count => window.classicEditor.map().cells.length === count, placed.length);
    assert.deepEqual(await page.evaluate(() => window.classicEditor.map().cells.map(([c, r, id]) => `${c},${r},${id}`).sort()), newMap, 'share code keeps the new objects');
    // play it (creator mode so nothing stops the run) and watch the speed, mode and gravity change
    await page.click('#editor-test');
    await page.waitForFunction(() => JSON.parse(window.render_classic_status()).level === 111);
    await page.evaluate(() => { Module._classic_set_creator(1); Module._classic_set_hitboxes(0); });
    const seen = await page.evaluate(() => new Promise(resolve => {
      const result = {modes: new Set(), speeds: new Set(), gravities: new Set()};
      const started = performance.now();
      const look = () => {
        if (Module._classic_state() === 2) {
          result.modes.add(Module._sim_mode());
          result.speeds.add(Module._classic_player_speed());
          result.gravities.add(Module._sim_gravity());
        }
        if (performance.now() - started < 7000 && Module._classic_percent() < 9000) requestAnimationFrame(look);
        else resolve({modes: [...result.modes].sort(), speeds: [...result.speeds].sort(), gravities: [...result.gravities].sort(), percent: Module._classic_percent()});
      };
      look();
    }));
    await page.evaluate(() => { Module._classic_set_creator(0); Module._classic_go_title(); });
    assert.deepEqual(seen.speeds, [0, 1, 2, 3], 'all four speed gates');
    assert.deepEqual(seen.modes, [0, 2, 3, 4], 'cube, ball, UFO and wave');
    assert.deepEqual(seen.gravities, [-1, 1], 'the blue ring or pad flips gravity');
    assert.ok(seen.percent > 0);
    console.log(`map maker plan 2 passed (11 new objects, share code, run: modes ${seen.modes}, speeds ${seen.speeds})`);
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
