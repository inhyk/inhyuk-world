import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { ATTACKS } from '../../public/play/asriel/core.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('public'), outDir = process.argv[2] || '/tmp/asriel-polished-check';
fs.mkdirSync(outDir, { recursive: true });
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const f = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!f.startsWith(root + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(process.env.ASRIEL_URL || `http://127.0.0.1:${server.address().port}/play/asriel/index.html`);
  await page.waitForFunction(() => !!window.__asriel);
  const snap = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
  const advance = ms => page.evaluate(t => window.advanceTime(t), ms);
  const shot = async name => { await page.locator('#game').screenshot({ path: path.join(outDir, name + '.png') }); };
  const hope = async () => { await page.locator('[data-action="act"]').click(); await page.locator('#choices button').first().click(); };
  const intro = async () => { for (let i = 0; i < 3; i++) await page.keyboard.press('KeyZ'); };
  await page.evaluate(() => { localStorage.setItem('undertale-fan-save', 'preserve-me'); localStorage.setItem('sans-judgement-hall', '{"hiddenHeart":true}'); });
  assert.equal(await page.locator('.boss-modes a').count(), 2);
  await page.screenshot({ path: path.join(outDir, '01-title.png'), fullPage: true });
  await page.locator('#start').click(); await intro(); assert.equal((await snap()).mode, 'menu');
  await hope(); await advance(1650); assert.equal((await snap()).mode, 'dodge');
  const before = (await snap()).soul.x; await page.keyboard.down('ArrowRight'); await advance(150); await page.keyboard.up('ArrowRight'); assert.ok((await snap()).soul.x > before);
  await page.keyboard.press('Escape'); const paused = await snap(); await advance(1000); assert.equal((await snap()).time, paused.time);
  await page.locator('#start').click(); assert.equal((await snap()).mode, 'dodge');
  assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'true'); await page.locator('#sound').click(); assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'false'); await page.locator('#sound').click();
  // 실제 상태 흐름으로 12개 공격과 변신을 거친다. 회피 경로는 별도 공정함 검사로 확인.
  for (let round = 0; round < 12; round++) {
    if (round) { assert.equal((await snap()).mode, 'menu'); await hope(); await advance(1600); }
    await page.evaluate(() => window.__asriel.state.soul.invincible = 100);
    await advance(1400); assert.equal((await snap()).round, round); assert.ok((await snap()).bullets.length);
    await shot('attack-' + String(round + 1).padStart(2, '0'));
    if (round === 11) { await advance(6000); await shot('13-finale-prism'); await advance(6000); await shot('14-finale-starfall'); }
    await advance((ATTACKS[round].duration - (await snap()).elapsed + .03) * 1000);
    if (round === 4) { assert.equal((await snap()).mode, 'transform'); await shot('06-transform'); await advance(3100); }
  }
  for (let i = 0; i < 3; i++) {
    await page.locator('[data-action="save"]').click(); await page.locator('#choices button').nth(i).click();
    assert.equal((await snap()).mode, 'memory'); await advance(600); await shot('memory-' + i); await advance(2100);
    assert.equal((await snap()).savedFriends.length, i + 1);
  }
  await page.locator('[data-action="save"]').click(); assert.equal((await snap()).mode, 'salvation');
  await advance(4200); await shot('15-save-asriel'); await advance(4000); assert.equal((await snap()).mode, 'won');
  await page.screenshot({ path: path.join(outDir, '16-ending.png'), fullPage: true });
  assert.ok(await page.evaluate(() => localStorage.getItem('asriel-last-starlight-best')));
  assert.equal(await page.evaluate(() => localStorage.getItem('undertale-fan-save')), 'preserve-me');
  assert.equal(await page.evaluate(() => localStorage.getItem('sans-judgement-hall')), '{"hiddenHeart":true}');
  // 2페이즈의 결의 부활은 한 번뿐이며, 다음 패배 뒤에는 재도전한다.
  await page.locator('#start').click(); await intro();
  await page.evaluate(() => { const s = window.__asriel.state; Object.assign(s, { round: 8, mode: 'dodge', hp: 1 }); s.soul.invincible = 0; s.bullets = [{ kind: 'orb', x: s.soul.x, y: s.soul.y, vx: 0, vy: 0, radius: 8, age: 0, life: 1 }]; });
  await advance(20); assert.equal((await snap()).mode, 'refuse'); await advance(1600); await shot('17-refuse'); await advance(1250); assert.equal((await snap()).hp, 92);
  await page.evaluate(() => { const s = window.__asriel.state; s.mode = 'dodge'; s.hp = 1; s.soul.invincible = 0; s.bullets = [{ kind: 'orb', x: s.soul.x, y: s.soul.y, vx: 0, vy: 0, radius: 8, age: 0, life: 1 }]; });
  await advance(20); assert.equal((await snap()).mode, 'dead'); await page.locator('#start').click(); assert.equal((await snap()).hp, 92); await intro();
  await page.setViewportSize({ width: 390, height: 844 }); assert.ok(await page.locator('.touch').isVisible());
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await hope(); await advance(1650); const x = (await snap()).soul.x;
  const left = page.locator('[data-key="ArrowLeft"]');
  await left.dispatchEvent('pointerdown', { pointerId: 1 }); await left.dispatchEvent('pointerdown', { pointerId: 2 });
  await left.dispatchEvent('pointerup', { pointerId: 1 }); await advance(150); assert.ok((await snap()).soul.x < x);
  await left.dispatchEvent('pointerup', { pointerId: 2 });
  await page.screenshot({ path: path.join(outDir, '18-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(200);
  for (const sel of ['#game', '.touch', '#pause']) { const r = await page.locator(sel).boundingBox(); assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.width <= 844 && r.y + r.height <= 390, sel); }
  await page.screenshot({ path: path.join(outDir, '19-mobile-landscape.png') });
  // 브라우저 음성 렌더러로 실제 효과음과 음소거를 검사한다.
  const audio = await page.evaluate(async () => {
    const { BattleMusic } = await import('./music.mjs');
    const result = {};
    for (const cue of ['transform', 'memory', 'refuse', 'save', 'cannon', 'thunder', 'sword', 'star', 'muted']) {
      const off = new OfflineAudioContext(1, 132300, 44100), music = new BattleMusic();
      music.context = off; music.master = off.createGain(); music.master.connect(off.destination); music.enabled = cue !== 'muted'; music.effect(cue);
      const data = (await off.startRendering()).getChannelData(0); result[cue] = Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);
    }
    return result;
  });
  for (const [cue, rms] of Object.entries(audio)) assert.ok(cue === 'muted' ? rms === 0 : Number.isFinite(rms) && rms > .001, cue);
  await page.emulateMedia({ reducedMotion: 'reduce' }); await advance(100); await shot('20-reduced-motion');
  assert.deepEqual(errors, []); console.log('ASRIEL 검증 통과: 12개 공격·변신·기억 3개·구원·결의 부활·패배/재도전·모바일·음악/효과음·저장 분리.');
} finally { await browser?.close(); await new Promise(r => server.close(r)); }
