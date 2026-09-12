// 브라우저 검증: 정적 서버를 띄우고 타이틀 → 이름 짓기 → 플라위 도입부 → 토리엘 → 전투 → 저장까지 실제로 돌려 본다.
// 실행: node games/undertale/browser-check.mjs   (tools/node_modules의 playwright와 로컬 Chrome을 사용)
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('public'); const port = 8790;
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, p); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(port);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = []; const shots = process.argv.includes('--shots');
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); }); // 파비콘 404는 무시
  await page.evaluate(() => localStorage.clear()).catch(() => {});
  await page.goto(`http://127.0.0.1:${port}/play/undertale/index.html`);
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload(); await page.waitForFunction(() => typeof window.render_game_to_text === 'function'); await page.waitForTimeout(300);
  const snap = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
  const press = async (key, n = 1, wait = 60) => { for (let i = 0; i < n; i++) { await page.keyboard.press(key); await page.waitForTimeout(wait); } };
  const skipTextbox = async () => { for (let i = 0; i < 12; i++) { const st = await snap(); if (st.mode !== 'textbox') return; await press('KeyZ', 1, 120); } };
  const skipText = async () => { for (let i = 0; i < 8; i++) { const st = await snap(); if (!st.battle || st.battle.mode !== 'text') return; await press('KeyZ', 1, 80); } };
  assert.equal((await snap()).mode, 'title');
  if (shots) await page.locator('#stage').screenshot({ path: 'public/images/games/undertale-fan-game-thumb.png' });
  await press('KeyZ'); assert.equal((await snap()).mode, 'naming');
  await press('KeyZ', 3); await press('Enter'); assert.equal((await snap()).mode, 'confirmName'); await press('KeyZ');
  let s = await snap(); assert.equal(s.mode, 'overworld'); assert.equal(s.world.room, 'ruins_flowerbed'); assert.equal(s.player.name.length, 3);
  // 플라위 도입부
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(1200); await page.keyboard.up('ArrowUp');
  s = await snap(); assert.equal(s.mode, 'textbox'); assert.equal(s.textbox.who, '플라위');
  for (let i = 0; i < 8; i++) { await press('KeyX', 1, 30); await press('KeyZ', 1, 120); if ((await snap()).mode === 'battle') break; }
  s = await snap(); assert.equal(s.mode, 'battle'); assert.equal(s.battle.attack, 'scripted');
  if (shots) { await page.waitForTimeout(1500); await page.locator('#stage').screenshot({ path: 'public/images/games/undertale-fan-game-1.png' }); }
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode !== 'battle', null, { timeout: 15000 });
  s = await snap(); assert.equal(s.player.hp, 1);
  for (let i = 0; i < 6; i++) { await press('KeyX', 1, 30); await press('KeyZ', 1, 120); if ((await snap()).mode === 'battle') break; }
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode !== 'battle', null, { timeout: 15000 });
  for (let i = 0; i < 40; i++) { const st = await snap(); if (st.mode === 'overworld' && !st.world.script) break; if (st.mode === 'wait') { await page.waitForTimeout(300); continue; } await press('KeyX', 1, 30); await press('KeyZ', 1, 150); }
  s = await snap(); assert.equal(s.mode, 'overworld'); assert.equal(s.world.script, null); assert.equal(s.player.hp, 20);
  // 폐허 입구로 이동해 토리엘을 만나고 스위치를 밟는다
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(2500); await page.keyboard.up('ArrowUp');
  s = await snap(); assert.equal(s.world.room, 'ruins_entry');
  // 세이브/전투 직접 테스트: 상태를 조작해 폐허 복도로 이동
  await page.evaluate(() => { const { G, Wd } = window.__undertale; G.player.flags.floweyDone = true; Wd.enterRoom(G.world, 'ruins_hall', 2, 6); });
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(400); await page.keyboard.up('ArrowRight');
  // 강제로 프로깃 전투 시작
  await page.evaluate(() => { const { G } = window.__undertale; G.world.request = { type: 'battle', enemies: ['froggit'], random: true, resolve: () => { G.world.request = null; } }; });
  await page.waitForTimeout(200); s = await snap(); assert.equal(s.mode, 'battle'); assert.equal(s.battle.enemy, 'froggit');
  await skipText(); s = await snap(); assert.equal(s.battle.mode, 'menu');
  await press('ArrowRight'); await press('KeyZ'); await press('KeyZ'); await press('KeyZ'); // ACT → 프로깃 → 칭찬
  s = await snap(); assert.equal(s.battle.mode, 'text'); await skipText(); s = await snap(); assert.equal(s.battle.mode, 'dodge');
  if (shots) { await page.waitForTimeout(1200); await page.locator('#stage').screenshot({ path: 'public/images/games/undertale-fan-game-2.png' }); }
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(300); await page.keyboard.up('ArrowLeft'); s = await snap(); assert.ok(s.battle.soul.x < 320);
  // 창 전환 시 일시정지
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); const bg = await snap(); await page.waitForTimeout(200); assert.deepEqual((await snap()).battle.soul, bg.battle.soul);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).battle?.mode === 'menu', null, { timeout: 20000 });
  await press('ArrowRight', 3); await press('KeyZ'); await press('KeyZ'); // MERCY → 살려주기
  await skipText(); s = await snap(); assert.equal(s.battle.ended, 'spare'); assert.equal(s.battle.mode, 'end'); await press('KeyZ', 1, 150);
  s = await snap(); assert.equal(s.mode, 'overworld'); assert.equal(s.player.gold, 2); assert.equal(s.player.route, 'pacifist');
  // 세이브
  await page.evaluate(() => { const { G, Wd } = window.__undertale; Wd.enterRoom(G.world, 'ruins_hall', 1, 6); G.world.dir = 'up'; G.world.y = 6 * 32 + 16; });
  await press('KeyZ'); s = await snap(); assert.equal(s.mode, 'textbox'); assert.match(s.textbox.line, /결의/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('undertale-fan-save'))); assert.equal(saved.room, 'ruins_hall'); assert.equal(saved.player.gold, 2);
  await skipTextbox();
  // 메뉴
  await press('KeyC'); s = await snap(); assert.equal(s.mode, 'menu'); await press('KeyX');
  // 게임 오버 → 계속하기
  await page.evaluate(() => { const { G } = window.__undertale; G.player.hp = 0; G.world.request = { type: 'battle', enemies: ['froggit'], random: true, resolve: () => { G.world.request = null; } }; });
  await page.waitForTimeout(200); await skipText(); await press('ArrowRight'); await press('KeyZ'); await press('KeyZ'); await press('KeyZ'); await skipText();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'gameover', null, { timeout: 20000 });
  await page.waitForTimeout(4500); await press('KeyZ'); s = await snap(); assert.equal(s.mode, 'overworld'); assert.equal(s.world.room, 'ruins_hall'); assert.equal(s.player.hp, 20);
  // 결말 화면 세 종류가 그려지는지
  for (const kind of ['neutral', 'pacifist', 'genocide']) { await page.evaluate(k => { window.__undertale.startEnding(k); }, kind); await page.waitForTimeout(400); s = await snap(); assert.equal(s.mode, 'ending'); assert.equal(s.ending.kind, kind); }
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).ending?.choice === true, null, { timeout: 30000 }); await press('KeyZ');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'erased', null, { timeout: 10000 });
  await page.reload(); await page.waitForFunction(() => typeof window.render_game_to_text === 'function'); s = await snap(); assert.equal(s.mode, 'erased'); assert.equal(s.erased, true);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).erasedChoice === true, null, { timeout: 40000 }); await press('ArrowLeft'); await press('KeyZ'); await page.waitForTimeout(3500); s = await snap(); assert.equal(s.mode, 'title'); assert.equal(s.soulless, true); assert.equal(s.erased, false);
  // 모바일
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  mobile.on('pageerror', e => errors.push(e.message)); await mobile.goto(`http://127.0.0.1:${port}/play/undertale/index.html`); await mobile.waitForFunction(() => typeof window.render_game_to_text === 'function');
  assert.equal(await mobile.locator('#touch-controls').isVisible(), true); await mobile.locator('[data-key="KeyZ"]').dispatchEvent('pointerdown'); await mobile.waitForTimeout(100); assert.equal((await mobile.evaluate(() => JSON.parse(window.render_game_to_text()))).mode, 'naming');
  if (shots) await mobile.screenshot({ path: '/tmp/undertale-mobile.png' });
  assert.deepEqual(errors, []);
  console.log('브라우저 검증 통과');
} finally { await browser.close(); server.close(); }
