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
  await page.goto(process.env.SANS_URL || `http://127.0.0.1:${server.address().port}/play/sans/index.html`);
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
  await page.keyboard.press('KeyZ'); await advance(1700); s = await snap(); assert.equal(s.hp, 1); assert.equal(s.items, 0); await shot('02b-hardmode-hp1');
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
  // 암전은 실제로 전체 캔버스를 검게 덮고, 이후에는 공격이 다시 보인다.
  await attack('chase', 'p2'); await advance(0);
  const isBlack = () => page.evaluate(() => {
    const canvas = document.querySelector('#game');
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] || pixels[i + 1] || pixels[i + 2]) return false;
    return true;
  });
  assert.equal(await isBlack(), true); await shot('37-blackout-start');
  await advance(650); assert.equal(await isBlack(), false); await shot('38-blackout-resumed');
  // 실제 시각 대신 패턴 시각의 다음 전환 바로 전으로 이동한다.
  await page.evaluate(() => { window.__sans.g.attack.t = 1.95; });
  await advance(20); assert.equal(await isBlack(), true); await shot('39-blackout-midattack');
  await page.keyboard.press('Escape'); assert.equal((await page.evaluate(() => window.__sans.g.paused)), true);
  const darkTime = (await snap()).blackout; await advance(1000); assert.equal((await snap()).blackout, darkTime);
  await page.keyboard.press('Escape'); await advance(500); assert.equal(await isBlack(), false);
  s = await snap(); assert.equal(s.attack.pattern, 'hops'); assert.equal(s.soul.mode, 'blue');
  await shot('39b-new-pattern-hops');
  // 새 패턴을 각각 실제로 그려 보고, 천장 중력 안내도 확인한다.
  for (const [name, file] of [['verticalTunnel', '80-vertical-tunnel'], ['blueCross', '81-blue-cross'], ['cornerBeams', '82-corner-beams'], ['ceilingHops', '83-ceiling-hops'], ['finalSpiral', '84-final-spiral'], ['specialSlam', '85-special-slam'], ['specialBlasters', '86-special-blasters'], ['specialTunnel', '87-special-tunnel'], ['specialFinale', '88-special-finale']]) {
    await scene(name, 'p2', 1450, file);
    assert.ok((await snap()).bullets > 0, name);
    if (name === 'ceilingHops') {
      assert.equal((await snap()).soul.gravity, 'up');
      assert.match(await page.locator('#message').textContent(), /↓ 아래/);
    }
  }
  // 한 차례 도중 모든 암전이 새 패턴으로 이어지는지 브라우저에서도 확인한다.
  for (const name of ['spiral', 'platformsHard', 'juggle', 'storm', 'chase', 'special']) {
    await attack(name, name === 'special' ? 'special' : 'p2');
    const sequence = await page.evaluate(() => window.__sans.C.PATTERNS[window.__sans.g.attack.name].sequence);
    for (const [when, expected] of sequence.slice(1)) {
      await page.evaluate(t => { const { g } = window.__sans; g.hp = 92; g.kr = 0; g.blackout = 0; g.attack.t = t - .01; }, when);
      await advance(20); assert.equal((await snap()).attack.pattern, expected);
      assert.equal(await isBlack(), true);
      await advance(600); assert.equal(await isBlack(), false);
    }
  }
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
  // 새 효과음이 실제 오디오 샘플을 만드는지 확인한다. 음소거도 유지된다.
  const audioResult = await page.evaluate(async () => {
    const result = {};
    for (const cue of ['teleport', 'materialize']) {
      const context = new OfflineAudioContext(1, 44100 * .7, 44100);
      const sound = new window.__sans.sound.constructor();
      sound.context = context; sound.enabled = true; sound.fxBus = context.destination;
      sound.sfx(cue);
      const data = (await context.startRendering()).getChannelData(0);
      result[cue] = { rms: Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length), finite: data.every(Number.isFinite) };
    }
    const context = new OfflineAudioContext(1, 4410, 44100);
    const muted = new window.__sans.sound.constructor(); muted.context = context; muted.fxBus = context.destination;
    muted.sfx('teleport');
    result.muted = (await context.startRendering()).getChannelData(0).every(v => v === 0);
    return result;
  });
  for (const cue of ['teleport', 'materialize']) assert.ok(audioResult[cue].rms > .005 && audioResult[cue].finite, `${cue}: 소리가 생성된다`);
  assert.equal(audioResult.muted, true);
  // 좁은 화면
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200); if (outDir) await page.screenshot({ path: path.join(outDir, '90-mobile.png') });
  await attack('nothing', 'nothing'); await advance(0);
  // 같은 방향의 WASD와 방향키를 같이 눌렀다가 하나를 떼도 나머지 입력은 유지한다.
  await page.keyboard.down('ArrowLeft'); await page.keyboard.down('KeyA'); await page.keyboard.up('KeyA');
  assert.equal(await page.evaluate(() => window.__sans.held.left), true);
  const leftButton = page.locator('[data-key="ArrowLeft"]');
  await leftButton.dispatchEvent('pointerdown', { pointerId: 21, pointerType: 'touch' });
  await page.keyboard.up('ArrowLeft'); assert.equal(await page.evaluate(() => window.__sans.held.left), true);
  await leftButton.dispatchEvent('pointerdown', { pointerId: 22, pointerType: 'touch' });
  await leftButton.dispatchEvent('pointerup', { pointerId: 21, pointerType: 'touch' });
  assert.equal(await page.evaluate(() => window.__sans.held.left), true);
  await leftButton.dispatchEvent('pointercancel', { pointerId: 22, pointerType: 'touch' });
  assert.equal(await page.evaluate(() => window.__sans.held.left), false);
  await page.locator('[data-key="ArrowUp"]').dispatchEvent('pointerdown', { pointerId: 23, pointerType: 'touch' });
  await page.locator('[data-key="ArrowRight"]').dispatchEvent('pointerdown', { pointerId: 24, pointerType: 'touch' });
  assert.deepEqual(await page.evaluate(() => [window.__sans.held.up, window.__sans.held.right]), [true, true]);
  await page.locator('#pause').click();
  assert.equal(await page.locator('.touch .pressed').count(), 0);
  assert.deepEqual(await page.evaluate(() => [window.__sans.held.up, window.__sans.held.right]), [false, false]);
  await page.locator('#pause').click();
  // 가로로 돌린 휴대폰에서는 게임과 버튼이 한 화면에 들어온다.
  await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(200);
  for (const selector of ['#game', '.dpad', '.touch-buttons', '#pause']) {
    const bounds = await page.locator(selector).boundingBox();
    assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 844 && bounds.y + bounds.height <= 390, `${selector}: 가로 화면 안에 표시`);
  }
  if (outDir) await page.screenshot({ path: path.join(outDir, '91-mobile-landscape.png') });
  assert.deepEqual(errors, []);
  console.log('SANS 브라우저 검증 통과' + (outDir ? ` · 스크린샷: ${outDir}` : ''));
} finally {
  await browser?.close(); server.close();
}
