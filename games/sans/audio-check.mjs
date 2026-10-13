// 자동 재생 허용/차단, 첫 입력, 음소거 저장을 실제 Web Audio로 검증한다.
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('public');
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/play/sans') {
    res.setHeader('content-type', 'text/html');
    res.end('<iframe src="/play/sans/index.html" allow="autoplay; fullscreen"></iframe>'); return;
  }
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader('content-type', ({ '.html': 'text/html', '.mjs': 'text/javascript', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
try {
  for (const autoplay of [true, false]) {
    const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=' + (autoplay ? 'no-user-gesture-required' : 'document-user-activation-required')] });
    try {
      const page = await browser.newPage(); const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const base = process.env.GAME_SITE || `http://127.0.0.1:${server.address().port}`;
      const open = async () => {
        await page.goto(base + '/play/sans');
        const frame = await (await page.locator('iframe').elementHandle()).contentFrame();
        await frame.waitForFunction(() => !!window.__sans); return frame;
      };
      let frame = await open();
      if (autoplay) {
        await frame.waitForFunction(() => window.__sans.sound.enabled && window.__sans.sound.step > 0);
        assert.equal(await frame.evaluate(() => window.__sans.sound.track), 'title');
      } else {
        assert.equal(await frame.evaluate(() => window.__sans.sound.context.state), 'suspended');
        await page.keyboard.press('KeyZ');
        await frame.waitForFunction(() => window.__sans.sound.enabled && window.__sans.sound.context.state === 'running' && window.__sans.sound.step > 0);
        assert.equal(await frame.evaluate(() => window.__sans.sound.track), 'hall');
      }
      // 실제 출력으로 음악 신호가 흐르는지도 확인한다.
      const peak = await frame.evaluate(async () => {
        const { sound } = window.__sans, meter = sound.context.createAnalyser();
        sound.master.connect(meter); const data = new Float32Array(meter.fftSize); let peak = 0;
        for (let i = 0; i < 20; i++) { await new Promise(r => setTimeout(r, 30)); meter.getFloatTimeDomainData(data); for (const value of data) peak = Math.max(peak, Math.abs(value)); }
        sound.master.disconnect(meter); return peak;
      });
      assert.ok(peak > .00001, '실제 음악 신호');
      await frame.locator('#sound').click();
      frame = await open(); await page.keyboard.press('KeyZ');
      assert.equal(await frame.evaluate(() => window.__sans.sound.enabled), false, '저장된 음소거 유지');
      await frame.locator('#sound').click();
      await frame.waitForFunction(() => window.__sans.sound.enabled && window.__sans.sound.step > 0);
      assert.deepEqual(errors, []);
      await page.close();
    } finally { await browser.close(); }
  }
  console.log('음악 검증 통과: 시작 화면 자동 재생·차단 후 첫 시작 입력·실제 오디오 신호·음소거 저장·다시 켜기');
} finally { await new Promise(r => server.close(r)); }
