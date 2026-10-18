// 픽셀크래프트 브라우저 검증: 실제 페이지에서 새 세계 → 나무 베기 → 판자 만들기 → 제작대 놓기 → 밤 몬스터 → 저장·불러오기를 돌려 보고 콘솔 오류가 없는지 본다.
// 실행: node games/pixelcraft/browser-check.mjs [스크린샷 폴더]   (tools/node_modules 의 playwright 사용, 서버는 스스로 띄운다)
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('public'), outDir = process.argv[2] || null;
if (outDir) fs.mkdirSync(outDir, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2' };
const server = http.createServer((request, response) => {
  const filename = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(filename)] || 'application/octet-stream' });
  fs.createReadStream(filename).pipe(response);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/play/pixelcraft/index.html`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
const shot = (name) => (outDir ? page.screenshot({ path: path.join(outDir, `${name}.png`) }) : null);
const ev = (fn, arg) => page.evaluate(fn, arg);
const toScreen = (x, y) => ev(([x, y]) => {
  const G = window.__pixelcraft.G, v = G.view, c = document.getElementById('game'), r = c.width / c.clientWidth;
  return { x: ((x - v.left) * v.T) / r, y: ((y - v.top) * v.T) / r };
}, [x, y]);

try {
  await page.goto(url);
  await ev(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#slots .play');
  await shot('01-title');
  await page.click('#slots .play');
  await page.fill('#nwSeed', '1234');
  await page.click('#nwCreate');
  await page.waitForFunction(() => window.__pixelcraft.G?.view);
  await shot('02-world');

  // 가장 가까운 나무 밑동 옆에 서서 베기 → 통째로 쓰러져 원목 여러 개
  const tree = await ev(() => {
    const G = window.__pixelcraft.G, w = G.w, px = Math.floor(G.player.x);
    for (let d = 1; d < 60; d++) for (const x of [px + d, px - d]) {
      const s = w.surface[x];
      if ([9, 12, 15].includes(w.tiles[(s - 1) * 640 + x])) return { x, s };
    }
    return null;
  });
  assert.ok(tree, '가까운 나무');
  await ev((t) => { const G = window.__pixelcraft.G; Object.assign(G.player, { x: t.x - 1.6, y: t.s - 1.85, vx: 0, vy: 0, fallTop: t.s - 1.85 }); G.cam.x = G.player.x; G.cam.y = G.player.y; }, tree);
  await page.waitForTimeout(300);
  let pt = await toScreen(tree.x + 0.5, tree.s - 0.5);
  await page.mouse.move(pt.x, pt.y);
  await page.mouse.down();
  await page.waitForTimeout(3300);
  await page.mouse.up();
  await page.waitForTimeout(1500);
  const logs = await ev(() => window.__pixelcraft.G.player.inv.filter((s) => s && [8, 11, 14].includes(s.id)).reduce((n, s) => n + s.count, 0));
  assert.ok(logs >= 3, `나무가 쓰러져 원목 ${logs}개`);

  // 가방 → "만들 수 있는 것" 에서 판자
  await page.keyboard.press('KeyE');
  await page.click('.slot.book.ok');
  await shot('03-inventory');
  const planks = await ev(() => window.__pixelcraft.G.player.inv.filter((s) => s?.id === 17).reduce((n, s) => n + s.count, 0));
  assert.equal(planks, 4);
  await page.keyboard.press('Escape');

  // 제작대를 놓고 오른쪽 클릭으로 열기
  await ev(() => { const G = window.__pixelcraft.G; G.player.inv[0] = { id: 24, count: 1 }; G.player.sel = 0; });
  const feet = await ev(() => { const p = window.__pixelcraft.G.player; return { x: Math.floor(p.x), y: Math.floor(p.y + 1.85) }; });
  pt = await toScreen(feet.x + 2.5, feet.y - 0.5);
  await page.mouse.click(pt.x, pt.y, { button: 'right' });
  await page.waitForTimeout(300);
  await page.mouse.click(pt.x, pt.y, { button: 'right' });
  await page.waitForTimeout(300);
  assert.equal(await ev(() => window.__pixelcraft.UI.open), 'table');
  await page.keyboard.press('Escape');

  // 밤 몬스터가 그려지고 움직인다
  await ev(() => {
    const P = window.__pixelcraft, G = P.G, p = G.player;
    G.time = 0.75;
    for (const [t, dx] of [['zombie', 6], ['skeleton', -6], ['creeper', 9], ['spider', -9]]) G.mobs.push(P.makeMob(t, p.x + dx, p.y - 1));
  });
  await page.waitForTimeout(1200);
  await shot('04-night');
  const mobsOk = await ev(() => window.__pixelcraft.G.mobs.every((m) => Number.isFinite(m.x) && Number.isFinite(m.y) && Number.isFinite(m.stepLift)));
  assert.ok(mobsOk, '몹 위치가 숫자');

  // 저장하고 처음 화면 → 이어 하기
  await page.keyboard.press('Escape');
  await page.click('#btnQuit');
  await page.waitForSelector('#slots .play');
  await page.click('#slots .play');
  await page.waitForFunction(() => window.__pixelcraft.G?.view);
  const back = await ev(() => window.__pixelcraft.G.player.inv.filter(Boolean).length);
  assert.ok(back >= 1, '불러온 가방');
  assert.deepEqual(errors, []);
  console.log('픽셀크래프트 브라우저 확인 통과');
} finally {
  await browser.close();
  server.close();
}
