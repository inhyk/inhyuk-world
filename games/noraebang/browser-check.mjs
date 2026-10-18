// 인혁 노래방 브라우저 검사: 실제 페이지에서 재생, 이동, 가수 바꾸기, 가사 눌러 이동, 끝 화면을 확인한다.
// 실행: node games/noraebang/browser-check.mjs [스크린샷 폴더]   (tools/node_modules 의 playwright 를 사용)
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('public'), outDir = process.argv[2] || null;
if (outDir) fs.mkdirSync(outDir, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2' };
const server = http.createServer((request, response) => {
  let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  const filename = path.join(root, pathname);
  if (!filename.startsWith(root) || !fs.existsSync(filename)) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(filename)] || 'application/octet-stream' });
  fs.createReadStream(filename).pipe(response);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/play/noraebang/`;

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const shot = async (page, name) => { if (outDir) await page.screenshot({ path: path.join(outDir, `${name}.png`) }); };
try {
  for (const [name, viewport] of [['desktop', { width: 1200, height: 860 }], ['mobile', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport });
    page.on('pageerror', (error) => errors.push(`${name}: ${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(`${name} console: ${message.text()}`); });
    await page.goto(url);
    await page.waitForFunction(() => window.noraebang);
    assert.equal(await page.textContent('#total'), '3:13');
    await shot(page, `${name}-title`);

    await page.click('#bigplay');
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => window.noraebang.synth.playing), true, '노래가 시작돼야 함');
    assert.equal(await page.evaluate(() => window.noraebang.synth.ctx.state), 'running');

    // 1절 첫 줄로 건너뛰면 그 줄이 나오고 색이 채워진다
    await page.evaluate(() => window.noraebang.seekTo(17));
    await page.waitForTimeout(700);
    const verse = await page.evaluate(() => [...document.querySelectorAll('.row .base')].map((el) => el.textContent));
    assert.ok(verse.includes('키보드 위에 손을 올리면'), verse.join(' / '));
    const clip = await page.evaluate(() => document.querySelector('#row0 .fill').style.clipPath);
    assert.match(clip, /inset\(-20px [\d.]+px/);
    // 1절은 핑크 젤리가 부르고, 목소리가 실제로 만들어진다
    assert.equal(await page.textContent('#row0 .who'), '핑크 젤리');
    const voices = await page.evaluate(() => window.noraebang.synth.singing.map((v) => v.singer));
    assert.ok(voices.includes('pink'), `노래하는 가수: ${voices}`);
    await shot(page, `${name}-verse`);

    // 가수 바꾸기: 둘이 → 핑크 → 파랑 → 반주만 → 둘이
    const modes = [];
    for (let i = 0; i < 4; i++) {
      await page.click('#singer');
      modes.push(await page.evaluate(() => window.noraebang.synth.mode));
    }
    assert.deepEqual(modes, ['pink', 'blue', 'off', 'duet']);
    await page.evaluate(() => window.noraebang.seekTo(81));
    await page.waitForTimeout(500);
    assert.equal(await page.textContent('#row0 .who'), '둘이 같이');
    const chorusVoices = await page.evaluate(() => window.noraebang.synth.singing.filter((v) => v.end > window.noraebang.synth.ctx.currentTime).map((v) => v.singer).sort());
    assert.deepEqual(chorusVoices, ['blue', 'pink'], '후렴 가운데로 건너뛰어도 둘이 이어서 불러야 함');
    await shot(page, `${name}-chorus`);

    // 가사 전체 보기에서 줄을 누르면 그 줄 조금 앞부터
    const bridgeLine = page.locator('.sheet-line', { hasText: '언젠가 어른이 되어도' });
    await bridgeLine.scrollIntoViewIfNeeded();
    await bridgeLine.click();
    await page.waitForTimeout(300);
    const beat = await page.evaluate(() => window.noraebang.beat);
    const start = await page.evaluate(() => window.noraebang.score.lines.find((l) => l.text === '언젠가 어른이 되어도').startBeat);
    assert.ok(beat > start - 4 && beat < start, `가사 누르기 이동 ${beat} / ${start}`);

    // 키보드: 스페이스로 멈춤
    await page.locator('#stage').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => window.noraebang.synth.playing), false, '스페이스로 멈춰야 함');

    // 끝 화면
    await page.evaluate(() => window.noraebang.startAt(window.noraebang.score.totalBeats - 2));
    await page.waitForTimeout(1600);
    assert.equal(await page.isVisible('#endcard'), true, '끝 화면이 나와야 함');
    assert.equal(await page.evaluate(() => window.noraebang.synth.playing), false);
    await shot(page, `${name}-end`);
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('인혁 노래방 브라우저 검사 통과');
} finally {
  await browser.close();
  server.close();
}
