// SANS 보스전 브라우저 검증: 실제 페이지에서 주요 장면을 돌려 보고 콘솔 오류가 없는지 확인한다.
// 실행: node games/sans/browser-check.mjs [스크린샷 폴더]   (tools/node_modules 의 playwright 와 로컬 Chrome 을 사용)
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
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 980 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/play/sans/index.html`);
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
  await page.evaluate(() => { localStorage.setItem('undertale-fan-save', 'preserve-me'); });
  const snap = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
  const shot = async name => { if (outDir) await page.locator('#game').screenshot({ path: path.join(outDir, name + '.png') }); };
  const advance = ms => page.evaluate(time => window.advanceTime(time), ms);
  const settle = async () => { for (let i = 0; i < 80; i++) { const s = await snap(); if (s.mode === 'cine') await advance(200); else if (s.mode === 'talk' || s.mode === 'text') await page.keyboard.press('KeyZ'); else break; } };
  // 원하는 공격을 바로 건다
  const attack = (name, phase) => page.evaluate(([attackName, attackPhase]) => {
    const { g, C } = window.__sans;
    Object.assign(g, { paused: false, bullets: [], attack: null, hp: 92, kr: 0, phase: attackPhase, pending: attackName, mode: 'text', text: { lines: ['*'], index: 0, shown: 1, next: 'story' } });
    C.press(g, 'confirm');
  }, [name, phase]);
  // 장면을 찍는 동안에는 쓰러지지 않게 HP를 채워 가며 흘려보낸다
  const scene = async (name, phase, ms, file) => {
    await attack(name, phase);
    await page.evaluate(time => { const { g } = window.__sans; for (let left = time; left > 0; left -= 250) { g.hp = 92; g.kr = 0; window.advanceTime(Math.min(250, left)); } g.hp = 92; g.kr = 0; }, ms);
    await shot(file);
  };

  // 타이틀
  let s = await snap(); assert.equal(s.mode, 'title'); await shot('01-title');
  await page.keyboard.press('ArrowLeft'); s = await snap(); assert.equal(s.level, 'easy'); await page.keyboard.press('ArrowRight');
  // 하드모드: HP 1로 시작한다
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); s = await snap(); assert.equal(s.level, 'hp1'); await shot('01b-title-hardmode');
  await page.keyboard.press('KeyZ'); await advance(1700); s = await snap(); assert.equal(s.hp, 1); await shot('02b-hardmode-hp1');
  await page.evaluate(() => { const { g, C } = window.__sans; C.toTitle(g); g.level = 1; });
  // 시작 → 첫 대사
  await page.keyboard.press('KeyZ'); await advance(1700); s = await snap(); assert.equal(s.mode, 'talk'); assert.equal(s.talk, '어이, 꼬마.'); await shot('02-intro');
  for (let i = 0; i < 5; i++) { await page.keyboard.press('KeyZ'); await page.keyboard.press('KeyZ'); }
  await advance(400); await shot('03-intro-dark');
  await settle(); s = await snap(); assert.equal(s.mode, 'dodge'); assert.equal(s.attack.name, 'opening');
  // 첫 공격의 장면들
  await scene('opening', 'opening', 450, '10-opening-slam-warn'); await scene('opening', 'opening', 760, '11-opening-stab');
  await scene('opening', 'opening', 3000, '12-opening-corridor'); await scene('opening', 'opening', 5350, '13-opening-grid-aim'); await scene('opening', 'opening', 5560, '14-opening-grid-fire');
  await scene('opening', 'opening', 6500, '15-opening-cross'); await scene('opening', 'opening', 7400, '16-opening-plus');
  // 1막
  await scene('hops', 'p1', 2600, '20-hops'); await scene('combs', 'p1', 2300, '21-combs'); await scene('blueMix', 'p1', 2700, '22-bluemix'); await scene('grid', 'p1', 4300, '23-grid-diagonal');
  await scene('platforms', 'p1', 4200, '24-platforms'); await scene('slamBox', 'p1', 2450, '25-slam-left');
  // 2막
  await scene('teleCuts', 'p2', 4500, '30-telecuts'); await scene('spiral', 'p2', 3300, '31-spiral'); await scene('platformsHard', 'p2', 3200, '32-platforms-hard');
  await scene('juggle', 'p2', 3950, '33-juggle'); await scene('storm', 'p2', 2400, '34-storm'); await scene('chase', 'p2', 2500, '35-chase');
  await scene('special', 'special', 15500, '36-special-spiral');
  // 메뉴와 차례
  await page.evaluate(() => { const { g, C } = window.__sans; Object.assign(g, { paused: false, bullets: [], attack: null, hp: 61, kr: 14, phase: 'p1', story: 2, mode: 'text', text: { lines: ['*'], index: 0, shown: 1, next: 'menu' } }); C.press(g, 'confirm'); });
  await advance(1200); s = await snap(); assert.equal(s.mode, 'menu'); await shot('40-menu-karma');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('KeyZ'); s = await snap(); assert.equal(s.submenu, 'item'); await shot('41-items');
  await page.keyboard.press('KeyX'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('KeyZ'); await page.keyboard.press('KeyZ');
  s = await snap(); assert.equal(s.mode, 'fightbar'); await advance(480); await shot('42-fightbar');
  await page.keyboard.press('KeyZ'); await advance(420); s = await snap(); assert.equal(s.mode, 'strike'); await shot('43-miss');
  await advance(1000); s = await snap(); assert.equal(s.mode, 'talk'); await advance(900); await shot('44-talk');
  // 제안과 속임수
  await page.evaluate(() => { const { g, C } = window.__sans; g.meta.deaths = 0; Object.assign(g, { paused: false, phase: 'offer', mode: 'text', text: { lines: ['*'], index: 0, shown: 1, next: 'menu' }, talk: null }); C.press(g, 'confirm'); g.menu = 3; });
  await page.keyboard.press('KeyZ'); await shot('50-mercy-offer'); await page.keyboard.press('KeyZ'); await settle();
  s = await snap(); assert.equal(s.attack.name, 'dunk'); await advance(700); await shot('51-dunk'); await advance(1200);
  s = await snap(); assert.equal(s.mode, 'gameover'); assert.equal(s.deaths, 1); await advance(700); await shot('52-gameover-break'); await advance(5000); await shot('53-gameover');
  // 다시 도전: 샌즈가 기억한다
  await page.keyboard.press('KeyZ'); await advance(1700); s = await snap(); assert.equal(s.mode, 'talk'); assert.equal(s.talk, '…푸흡.'); await shot('54-retry-remembers');
  // 아무 일도 없는 차례 → 잠 → 밀기
  await page.evaluate(() => { const { g, C } = window.__sans; Object.assign(g, { paused: false, phase: 'special', talk: null, mode: 'text', text: { lines: ['*'], index: 0, shown: 1, next: 'nothing' } }); g.sans.sweat = 3; C.press(g, 'confirm'); });
  await advance(9000); s = await snap(); assert.equal(s.phase, 'nothing'); await shot('60-nothing');
  await advance(12000); s = await snap(); assert.equal(s.phase, 'asleep'); await advance(1500); await shot('61-asleep');
  await page.evaluate(() => { window.__sans.held.left = true; }); await advance(5200); await page.evaluate(() => { window.__sans.held.left = false; });
  s = await snap(); assert.equal(s.push, 'fight'); await shot('62-pushed-to-fight');
  await page.keyboard.press('KeyZ'); await advance(450); await shot('63-final-dodge'); await advance(1250); await shot('64-wake-line'); await advance(800); await shot('65-final-hit');
  await advance(1600); s = await snap(); assert.equal(s.mode, 'talk'); await shot('66-death-talk');
  await settle(); s = await snap();
  for (let i = 0; i < 40 && s.mode !== 'won'; i++) { await settle(); await advance(300); s = await snap(); }
  assert.equal(s.mode, 'won'); assert.equal(s.ended, 'kill'); await advance(3200); await shot('67-ending-dust');
  // 다른 결말: 자비 쪽으로 민다
  await page.keyboard.press('KeyZ'); s = await snap(); assert.equal(s.mode, 'title');
  await page.evaluate(() => { const { g, C } = window.__sans; C.begin(g, 'title'); Object.assign(g, { cine: null, phase: 'special', talk: null, mode: 'text', text: { lines: ['*'], index: 0, shown: 1, next: 'nothing' } }); C.press(g, 'confirm'); });
  await advance(19000); await page.evaluate(() => { window.__sans.held.right = true; }); await advance(5200); await page.evaluate(() => { window.__sans.held.right = false; });
  s = await snap(); assert.equal(s.push, 'mercy'); await shot('70-pushed-to-mercy');
  await page.keyboard.press('KeyZ'); await advance(900); await shot('71-lower');
  for (let i = 0; i < 40 && s.mode !== 'won'; i++) { await settle(); await advance(300); s = await snap(); }
  assert.equal(s.ended, 'mercy'); await advance(3200); await shot('72-ending-mercy');
  // 기록과 저장: 다른 게임의 세이브는 건드리지 않는다
  const stored = await page.evaluate(() => ({ own: JSON.parse(localStorage.getItem('sans-judgement-hall')), other: localStorage.getItem('undertale-fan-save') }));
  assert.equal(stored.other, 'preserve-me'); assert.equal(stored.own.endings.kill, true); assert.equal(stored.own.endings.mercy, true); assert.equal(stored.own.deaths, 0);
  // 소리를 켜도 오류가 없어야 한다
  await page.locator('#sound').click(); await page.waitForTimeout(600);
  // 좁은 화면
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200); if (outDir) await page.screenshot({ path: path.join(outDir, '90-mobile.png') });
  assert.deepEqual(errors, []);
  console.log('SANS 브라우저 검증 통과' + (outDir ? ` · 스크린샷: ${outDir}` : ''));
} finally {
  await browser?.close(); server.close();
}
