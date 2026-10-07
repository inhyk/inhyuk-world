// 판 수 고르기: AI 대전·2인 플레이·온라인 대전에서 10·25·30·40·50판까지 고르고 그대로 시작되는지 본다.
// 온라인은 PUYO_NET(로컬 net 서버 주소, 예 http://127.0.0.1:8787)이 있으면 두 창을 "게임 찾기"로 실제로 이어 본다.
// 없으면 건너뛰었다고 알려 준다 (net 서버 띄우는 법은 online-browser-check.mjs).
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const base = process.env.PUYO_URL || 'http://127.0.0.1:5190/';
const shots = process.env.PUYO_SHOTS || '/tmp/puyo-puyo-rounds';
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const LABELS = ['1판', '2판', '3판', '5판', '10판', '25판', '30판', '40판', '50판'];

async function open(name, options = { viewport: { width: 1280, height: 860 } }) {
  const page = await browser.newPage(options);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/peerjs|PeerJS|ICE|webrtc/i.test(m.text())) errors.push(m.text()); });
  await page.goto(`${base}?test`); await page.waitForFunction(() => window.__puyo);
  // 새 계정은 이제 서버(온라인 계정)에 만든다. 서버 없이 확인하려고 예전 방식의 이 기기 계정을 테스트용 함수로 만든다.
  await page.evaluate(n => window.__puyo.localSignup(n, 'abcd'), name); await page.waitForSelector('#scr-menu:not([hidden])');
  return page;
}
const labels = (page, id) => page.locator(`#${id} button`).allTextContents();
const quit = async page => { await page.evaluate(() => window.__puyo.pause(true)); await page.click('#pause-quit'); };

try {
  const page = await open('판수검사');
  // AI 대전: 단추 9개, 50판으로 시작
  await page.click('[data-go="vs"]');
  assert.deepEqual(await labels(page, 'vs-first'), LABELS);
  assert.equal(await page.locator('#vs-first .on').textContent(), '2판'); // 처음에는 2판
  await page.click('#vs-first [data-v="50"]');
  assert.equal(await page.locator('#vs-first .on').textContent(), '50판');
  await page.screenshot({ path: `${shots}/vs.png` });
  await page.click('#vs-start');
  await page.waitForFunction(() => window.__puyo.match?.firstTo === 50 && window.__puyo.game.mode === 'vs');
  await quit(page);
  // 2인 플레이: 25판, 처음부터 다시 해도 25판
  await page.click('[data-go="local"]');
  assert.deepEqual(await labels(page, 'local-first'), LABELS);
  await page.click('#local-first [data-v="25"]');
  await page.click('#local-start');
  await page.waitForFunction(() => window.__puyo.match?.firstTo === 25 && window.__puyo.game.mode === 'local');
  await page.evaluate(() => window.__puyo.pause(true)); await page.click('#pause-retry');
  await page.waitForFunction(() => window.__puyo.match?.firstTo === 25);
  // 25선승에서 5번 이겨도 판이 끝나지 않는다
  await page.evaluate(() => { const m = window.__puyo.match; for (let i = 0; i < 5; i++) { m.endRound([false, true]); m.timer = 1; m.step([]); } });
  assert.equal(await page.evaluate(() => window.__puyo.match.phase !== 'over' && window.__puyo.match.wins[0] === 5), true);
  await quit(page);
  // 휴대폰: 단추 9개가 화면 밖으로 넘치지 않는다
  const phone = await open('판수폰', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  for (const screen of ['vs', 'local']) {
    await phone.click(`[data-go="${screen}"]`);
    assert.equal(await phone.evaluate(s => { const el = document.getElementById(`scr-${s}`); return el.scrollWidth <= el.clientWidth; }, screen), true, screen);
    await phone.locator(`#${screen}-first`).scrollIntoViewIfNeeded();
    await phone.screenshot({ path: `${shots}/phone-${screen}.png` });
    await phone.click(`#scr-${screen} [data-go="menu"]`);
  }
  await phone.close();

  // 온라인: 방장이 40판을 고르면 손님 화면에도 40판, 둘 다 40선승으로 시작
  let online = 'SKIPPED (PUYO_NET 로컬 net 서버 주소가 없음)';
  if (process.env.PUYO_NET) {
    online = 'PASS';
    const tag = Math.random().toString(36).slice(2, 6);
    const netPage = async nick => {
      const p = await browser.newPage({ viewport: { width: 1280, height: 860 } });
      p.on('pageerror', e => errors.push(e.message));
      // 새 계정은 서버 저장이 아직 없어서 404 no-save 가 정상인데 Chrome 이 콘솔 오류로 찍는다
      p.on('console', m => { if (m.type() === 'error' && !/status of 404/.test(m.text())) errors.push(m.text()); });
      await p.goto(`${base}?test&net=${encodeURIComponent(process.env.PUYO_NET)}`); await p.waitForFunction(() => window.__puyo);
      await p.click('#go-signup'); await p.fill('#signup-name', nick); await p.fill('#signup-pass', 'abcd');
      await p.click('#signup-form button[type=submit]'); await p.waitForSelector('#scr-menu:not([hidden])');
      await p.click('[data-go="online"]');
      return p;
    };
    const first = await netPage(`판수${tag}`);
    const second = await netPage(`손님${tag}`);
    await first.click('#online-find');
    await first.waitForFunction(() => window.__puyo.online.searching);
    await second.click('#online-find');
    await first.waitForSelector('#online-lobby:not([hidden])', { timeout: 30000 });
    await second.waitForSelector('#online-lobby:not([hidden])', { timeout: 30000 });
    // 방장은 방에 먼저 들어온 사람이라, 먼저 찾기를 누른 쪽이 아닐 수도 있다
    const [host, guest] = (await first.evaluate(() => window.__puyo.online.host)) ? [first, second] : [second, first];
    assert.deepEqual(await labels(host, 'online-first'), LABELS);
    await host.waitForFunction(() => !document.getElementById('online-start').disabled, null, { timeout: 15000 });
    await host.click('#online-first [data-v="40"]');
    await guest.waitForFunction(() => document.getElementById('online-wait').textContent.includes('40판'), null, { timeout: 15000 });
    await host.screenshot({ path: `${shots}/online-host.png` });
    await host.click('#online-start');
    await host.waitForFunction(() => window.__puyo.match?.firstTo === 40 && window.__puyo.game.mode === 'online', null, { timeout: 15000 });
    await guest.waitForFunction(() => window.__puyo.match?.firstTo === 40 && window.__puyo.game.mode === 'online', null, { timeout: 15000 });
    await host.close(); await guest.close();
  }

  assert.deepEqual(errors, []);
  console.log(`PASS: AI 대전 50판·2인 플레이 25판(다시 하기 유지, 5승에도 계속), 휴대폰 단추 줄바꿈 — 오류 없음 / 온라인 40판: ${online}`);
  console.log(`Screenshots: ${shots}`);
} finally { await browser.close(); }
