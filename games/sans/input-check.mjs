// 공개 페이지처럼 iframe을 감싼 상태에서 최초 키 입력과 모바일 메뉴를 검증한다.
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('public');
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (/^\/play\/(sans|asriel)$/.test(pathname)) {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<iframe title="boss" src="${pathname}/index.html" allow="autoplay; fullscreen" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>`); return;
  }
  const f = path.resolve(root, '.' + pathname);
  if (!f.startsWith(root + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
  const type = { '.html': 'text/html', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' }[path.extname(f)] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': type }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const base = process.env.GAME_SITE || `http://127.0.0.1:${server.address().port}`;
  for (const boss of ['sans', 'asriel']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/play/' + boss);
    let frame = await (await page.locator('iframe').elementHandle()).contentFrame();
    await frame.waitForFunction(() => typeof window.render_game_to_text === 'function');
    const snap = () => frame.evaluate(() => JSON.parse(window.render_game_to_text()));
    const advance = ms => frame.evaluate(t => window.advanceTime(t), ms);
    const touch = async (code, id = 10) => {
      const button = frame.locator(`[data-key="${code}"]`);
      await button.dispatchEvent('pointerdown', { pointerId: id }); await button.dispatchEvent('pointerup', { pointerId: id });
    };
    assert.equal(await page.evaluate(() => document.activeElement.tagName), 'IFRAME', boss + ': 최초 iframe 초점');
    assert.equal(await frame.evaluate(() => document.activeElement.id), 'game');
    if (boss === 'sans') {
      await page.keyboard.press('ArrowRight'); assert.equal((await snap()).level, 'hard', '클릭 전에 난이도 선택');
      await page.keyboard.press('ArrowLeft'); await touch('ArrowLeft'); assert.equal((await snap()).level, 'easy');
      await page.reload(); frame = await (await page.locator('iframe').elementHandle()).contentFrame(); await frame.waitForFunction(() => typeof window.render_game_to_text === 'function');
      await page.keyboard.press('ArrowLeft'); assert.equal((await snap()).level, 'easy', '새로고침 직후 입력');
      await page.keyboard.press('KeyZ'); assert.equal((await snap()).mode, 'cine');
    } else {
      await page.keyboard.press('Enter'); assert.equal((await snap()).mode, 'intro', '클릭 전에 시작');
      for (let i = 0; i < 3; i++) await page.keyboard.press('KeyZ');
      assert.equal((await snap()).mode, 'menu'); await page.keyboard.press('ArrowRight'); assert.equal((await snap()).selected, 1);
      await touch('ArrowRight'); assert.equal((await snap()).selected, 2, '터치 방향키로 첫 행동 메뉴 이동');
      await touch('ArrowUp'); assert.equal((await snap()).selected, 1);
      await frame.locator('#confirm').click(); assert.equal((await snap()).mode, 'act');
      await touch('ArrowDown'); assert.ok(await frame.locator('#choices button').nth(1).evaluate(b => b.classList.contains('selected')));
      await frame.locator('#confirm').click(); assert.equal((await snap()).mode, 'warning'); assert.equal((await snap()).dreams, 3);
      await advance(1650); assert.equal((await snap()).mode, 'dodge');
      const x = (await snap()).soul.x, left = frame.locator('[data-key="ArrowLeft"]');
      await left.dispatchEvent('pointerdown', { pointerId: 20 }); await left.dispatchEvent('pointerdown', { pointerId: 21 });
      await left.dispatchEvent('pointerup', { pointerId: 20 }); await advance(150); assert.ok((await snap()).soul.x < x);
      await left.dispatchEvent('pointerup', { pointerId: 21 }); const stopped = (await snap()).soul.x; await advance(150); assert.equal((await snap()).soul.x, stopped);
      await page.keyboard.down('ArrowRight'); await advance(150); await page.keyboard.up('ArrowRight'); assert.ok((await snap()).soul.x > stopped, '첫 공격에서 실제 키보드 이동');
    }
    assert.deepEqual(errors, []); await page.close();
  }
  console.log('입력 검증 통과: 실제 iframe의 최초 키 입력·새로고침·난이도·행동 메뉴·모바일 선택·첫 공격 이동·다중 터치 해제');
} finally { await browser?.close(); await new Promise(r => server.close(r)); }
