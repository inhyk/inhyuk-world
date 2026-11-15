// 개발 서버(5198)를 켠 뒤: node games/zoom-kart/browser-check.mjs [주소] [사진 폴더]
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '../../tools/node_modules/playwright/index.mjs');
import { mkdir } from 'node:fs/promises';
const origin = process.argv[2] || 'http://127.0.0.1:5198/';
const out = process.argv[3] || new URL('../../artifacts/zoom-kart', import.meta.url).pathname;
const url = new URL(origin); url.searchParams.set('debug', '1');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = []; page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url.href);
await page.waitForFunction(() => window.__kart);
await page.waitForTimeout(800);
await page.screenshot({ path: out + '/lobby.png' });
// 잠긴 트랙은 못 고른다
await page.locator('.track').nth(1).click();
if (await page.evaluate(() => window.__kart.save.track) !== 'forest') throw Error('locked track selectable');
// 아이템전 시작, 카운트다운, 달리기
await page.locator('#b-start').click();
await page.waitForFunction(() => window.__kart.race && window.__kart.race.state === 'race', null, { timeout: 8000 });
await page.keyboard.down('ArrowUp');
await page.waitForFunction(() => window.__kart.race.player.s > 25);
await page.screenshot({ path: out + '/race.png' });
// 드리프트
await page.keyboard.down('ArrowRight'); await page.keyboard.down('ShiftLeft');
await page.waitForFunction(() => window.__kart.race.player.drifting);
await page.waitForTimeout(500); await page.screenshot({ path: out + '/drift.png' });
await page.keyboard.up('ShiftLeft'); await page.keyboard.up('ArrowRight');
// 아이템 쓰기
await page.evaluate(() => { const k = window.__kart.race.player; k.items = ['boost', 'shield']; k.rollT = 0; });
await page.keyboard.press('ControlLeft');
await page.waitForFunction(() => window.__kart.race.player.boostT > 0);
await page.waitForTimeout(400); await page.screenshot({ path: out + '/boost.png' });
await page.keyboard.up('ArrowUp');
// 멈춤과 계속
await page.keyboard.press('Escape'); await page.locator('button[data-a=resume]').click();
// 모든 트랙 화면 찍기
for (const id of ['beach', 'snow', 'city', 'volcano', 'cloud']) {
  await page.evaluate((t) => { const s = window.__kart.save; s.unlocked = 6; s.track = t; window.__kart.save = s; window.__kart.startRace(t); }, id);
  await page.waitForFunction(() => window.__kart.race.state === 'race', null, { timeout: 8000 });
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(2500); await page.keyboard.up('ArrowUp');
  await page.screenshot({ path: `${out}/track-${id}.png` });
}
// 결과 화면: 마지막 바퀴 끝으로 보내서 골인
await page.evaluate(() => { const r = window.__kart.race, k = r.player; k.lap = r.laps - 1; });
await page.evaluate(() => { const r = window.__kart.race, k = r.player, T = r.track, p = window.__kart.C.trackPos(T, T.n - 6, 0); k.x = p.x; k.z = p.z; k.h = k.mv = p.h; k.idx = T.n - 6; });
await page.keyboard.down('ArrowUp');
await page.waitForFunction(() => window.__kart.shownResult, null, { timeout: 15000 });
await page.keyboard.up('ArrowUp');
await page.screenshot({ path: out + '/result.png' });
if (!(await page.evaluate(() => window.__kart.save.coins > 0))) throw Error('no coins after race');
await page.locator('button[data-a=menu]').click();
await page.waitForFunction(() => window.__kart.screen === 'lobby');
// 휴대폰 화면
const phone = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
phone.on('pageerror', (e) => errors.push(String(e)));
await phone.goto(url.href); await phone.waitForFunction(() => window.__kart); await phone.waitForTimeout(600);
await phone.screenshot({ path: out + '/phone-lobby.png' });
await phone.locator('#b-start').tap();
await phone.waitForFunction(() => window.__kart.race && window.__kart.race.state === 'race', null, { timeout: 8000 });
await phone.waitForFunction(() => window.__kart.race.player.s > 20);
await phone.screenshot({ path: out + '/phone-race.png' });
await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('zoom-kart browser check ok →', out);
