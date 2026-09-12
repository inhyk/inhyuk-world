// Visual and interaction regression checks for the environmental detail update.
// node games/undertale/details-browser-check.mjs [--shots]
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('public');
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(8791);
await new Promise(resolve => server.on('listening', resolve));
const url = 'http://127.0.0.1:8791/play/undertale/index.html';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], shots = process.argv.includes('--shots');
const attach = page => { page.on('pageerror', e => errors.push(e.message)); page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); }); };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } }); attach(page);
  await page.goto(url); await page.waitForFunction(() => window.__undertale);
  await page.evaluate(() => document.fonts.ready);
  assert.ok(await page.evaluate(() => document.fonts.check('17px Galmuri11')));
  if (shots) await page.locator('#game').screenshot({ path: 'public/images/games/undertale-fan-game-thumb.png' });
  const press = async key => { await page.keyboard.press(key); await page.waitForTimeout(65); };
  const skipDialogue = async () => {
    for (let i = 0; i < 10 && await page.evaluate(() => window.__undertale.G.mode === 'textbox'); i++) { await press('KeyX'); await press('KeyZ'); }
  };
  await page.evaluate(() => {
    const { G, Wd, newGame } = window.__undertale; newGame('인혁'); G.player.flags.homeArrive = true;
    Wd.enterRoom(G.world, 'ruins_home', 5, 3); G.world.dir = 'up';
  });
  await press('KeyZ');
  assert.equal(await page.evaluate(() => window.__undertale.G.player.journal.entries.length), 1);
  // A dialogue can begin on the exact frame of entering a room; the fade must finish.
  await page.waitForTimeout(550);
  assert.ok(await page.evaluate(() => window.__undertale.G.world.transition <= 0));
  await skipDialogue();
  await press('KeyZ'); await skipDialogue();
  assert.equal(await page.evaluate(() => window.__undertale.G.player.journal.entries.length), 1);
  await page.evaluate(() => { const { G, Wd } = window.__undertale; Wd.enterRoom(G.world, 'ruins_home', 7, 6); G.world.dir = 'up'; });
  await press('KeyZ'); await skipDialogue();
  await press('KeyC'); await press('ArrowDown'); await press('ArrowDown'); await press('ArrowLeft');
  assert.equal(await page.evaluate(() => window.__undertale.G.menu.journalIndex), 1);
  await press('ArrowRight'); assert.equal(await page.evaluate(() => window.__undertale.G.menu.journalIndex), 0);
  await press('KeyX');

  // Each complete journal entry fits on the page with its navigation still visible.
  const overflow = await page.evaluate(async () => {
    const R = await import('./render.mjs'), D = await import('./details.mjs');
    const { G, C } = window.__undertale, p = C.createPlayer('기억');
    D.DETAILS.forEach(item => D.inspectDetail(p, item));
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
    const ctx = canvas.getContext('2d'), original = ctx.fillText.bind(ctx), violations = [];
    ctx.fillText = (str, x, y) => { if (x === 284 && y >= 380) violations.push(str); original(str, x, y); };
    p.journal.entries.forEach((entry, journalIndex) => R.drawMenu(ctx, 0, { tab: 2, journalIndex }, p, G.world));
    return violations;
  });
  assert.deepEqual(overflow, []);

  await page.locator('#help-button').click();
  const frozenWorld = await page.evaluate(() => ({ t: window.__undertale.G.t, x: window.__undertale.G.world.x }));
  await press('ArrowRight'); await page.waitForTimeout(180);
  assert.deepEqual(await page.evaluate(() => ({ t: window.__undertale.G.t, x: window.__undertale.G.world.x })), frozenWorld);
  await press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'modal-close');
  await press('Escape'); assert.equal(await page.locator('#modal').isVisible(), false);
  await page.evaluate(() => {
    const { G, C } = window.__undertale; G.battle = C.createBattle(G.player, ['froggit'], { seed: 3 }); G.mode = 'battle'; G.scripted = null;
    while (G.battle.mode === 'text') C.advanceText(G.battle);
    C.chooseAction(G.battle, 'act'); C.chooseSub(G.battle, 0); C.chooseSub(G.battle, 0);
    while (G.battle.mode === 'text') C.advanceText(G.battle);
    G.battle.soul.invincible = 99;
  });
  await page.locator('#help-button').click();
  const battleTime = await page.evaluate(() => window.__undertale.G.battle.time);
  await page.waitForTimeout(250); assert.equal(await page.evaluate(() => window.__undertale.G.battle.time), battleTime);
  await press('Escape'); await press('KeyC');
  assert.equal(await page.evaluate(() => window.__undertale.G.battle.paused), true);
  await page.locator('#help-button').click(); await press('Escape');
  assert.equal(await page.evaluate(() => window.__undertale.G.battle.paused), true);
  await press('KeyX'); assert.equal(await page.evaluate(() => window.__undertale.G.battle.paused), false);

  // Every room must render successfully, even with all props and route flags present.
  await page.evaluate(async () => {
    const R = await import('./render.mjs'), { G, Wd } = window.__undertale;
    const ctx = document.getElementById('game').getContext('2d');
    for (const room of Object.values(Wd.ROOMS)) { Wd.enterRoom(G.world, room.id); R.drawOverworld(ctx, G.world, 10); }
  });
  if (shots) {
    await page.evaluate(() => {
      const { G, Wd } = window.__undertale; G.battle = null; G.mode = 'overworld'; G.world.request = null; G.world.script = null;
      Wd.enterRoom(G.world, 'ruins_home', 10, 8);
    });
    await page.waitForTimeout(1100);
    await page.locator('#game').screenshot({ path: 'public/images/games/undertale-fan-game-1.png' });
    await page.evaluate(() => {
      const { G, C } = window.__undertale; G.mode = 'battle'; G.battle = C.createBattle(G.player, ['undyne'], { seed: 3 });
      while (G.battle.mode === 'text') C.advanceText(G.battle);
      C.chooseAction(G.battle, 'act'); C.chooseSub(G.battle, 0); C.chooseSub(G.battle, 0);
      while (G.battle.mode === 'text') C.advanceText(G.battle);
      C.update(G.battle, .5); G.battle.soul.invincible = 0; G.battle.soul.facing = 'right';
      // Freeze only the host frame for a deterministic capture of the live renderer.
      G.guideOpen = true;
    });
    await page.evaluate(async () => { const R = await import('./render.mjs'); R.drawBattle(document.getElementById('game').getContext('2d'), window.__undertale.G.battle, 0); });
    await page.locator('#game').screenshot({ path: 'public/images/games/undertale-fan-game-2.png' });
  }
  for (const viewport of [{ width: 1280, height: 960 }, { width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 2), JSON.stringify(viewport));
  }

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); attach(mobile);
  await mobile.goto(url); await mobile.waitForFunction(() => window.__undertale);
  await mobile.locator('[data-key="KeyZ"]').tap(); await mobile.waitForTimeout(80);
  assert.equal(await mobile.evaluate(() => window.__undertale.G.mode), 'naming');
  await mobile.locator('[data-key="KeyZ"]').tap(); await mobile.waitForTimeout(80);
  await mobile.locator('#name-done').tap(); await mobile.waitForTimeout(80);
  assert.equal(await mobile.evaluate(() => window.__undertale.G.mode), 'confirmName');
  await mobile.locator('[data-key="KeyZ"]').tap(); await mobile.waitForTimeout(80);
  assert.equal(await mobile.evaluate(() => window.__undertale.G.player.name), '가');
  for (const viewport of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 568, height: 320 }]) {
    await mobile.setViewportSize(viewport);
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 2), JSON.stringify(viewport));
    assert.ok(await mobile.locator('[data-key="KeyZ"]').isVisible());
  }
  const reduced = await browser.newPage({ reducedMotion: 'reduce' }); attach(reduced);
  await reduced.goto(url); await reduced.waitForFunction(() => window.__undertale);
  await reduced.evaluate(() => { window.__undertale.newGame('차분'); window.__undertale.G.world.roomTime = 10; });
  await reduced.waitForTimeout(700);
  const still = await reduced.locator('#game').evaluate(canvas => canvas.toDataURL());
  await reduced.waitForTimeout(220);
  assert.equal(await reduced.locator('#game').evaluate(canvas => canvas.toDataURL()), still);
  assert.deepEqual(errors, []);
  console.log('디테일 브라우저 검증 통과: 수첩·대화 전환·모달·전투 휴식·전체 맵·7개 화면 크기·터치 이름 입력·동작 줄이기');
} finally { await browser.close(); server.close(); }
