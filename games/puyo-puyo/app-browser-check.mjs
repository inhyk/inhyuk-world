// 아이폰·안드로이드 앱(Capacitor) 안에서만 하는 일을 Chrome에서 가짜 Capacitor로 확인한다.
// 시작 그림 걷기, 기기 저장소에 같이 저장하고 되살리기, 진동, 계정 지우기, 앱에서 숨기는 사이트 링크,
// 안드로이드 뒤로 가기 단추.
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

const base = process.env.PUYO_URL || 'http://127.0.0.1:5190/';
const STORE_KEY = 'puyo-tower-v1', DEVICE_KEY = 'puyo-tower-device';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];

// prefs: 아이폰의 기기 저장소(Preferences)에 이미 들어 있는 값
async function openApp(prefs = {}, platform = 'ios') {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(([initial, platform]) => {
    window.__calls = [];
    window.__listeners = {};
    window.__prefs = { ...initial };
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => platform,
      addListener(plugin, event, callback) { window.__listeners[`${plugin}.${event}`] = callback; return { remove() {} }; },
      nativePromise(plugin, method, options = {}) {
        window.__calls.push({ plugin, method, options });
        if (plugin === 'Preferences' && method === 'get') return Promise.resolve({ value: window.__prefs[options.key] ?? null });
        if (plugin === 'Preferences' && method === 'set') { window.__prefs[options.key] = options.value; return Promise.resolve(); }
        return Promise.resolve();
      },
    };
  }, [prefs, platform]);
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}?test`);
  await page.waitForFunction(() => window.__puyo);
  return { context, page };
}
const calls = (page, plugin, method) => page.evaluate(([p, m]) => window.__calls.filter(c => c.plugin === p && (!m || c.method === m)), [plugin, method]);
const prefs = page => page.evaluate(() => window.__prefs);

try {
  // 1) 앱으로 켜면: 시작 그림을 걷고, 사이트로 가는 링크는 숨기고, 진동 설정이 보인다.
  const first = await openApp();
  let page = first.page;
  assert.equal(await page.evaluate(() => document.body.classList.contains('app')), true);
  // 개발 서버는 처음 열 때 한 번 새로고침할 수 있으므로, 이 페이지에서 걷기가 일어날 때까지 기다린다
  await page.waitForFunction(() => window.__calls.some(c => c.plugin === 'SplashScreen' && c.method === 'hide'));
  // 기록·기기 설정·온라인 계정(로그인, 클라우드 저장, 옮기던 표시)을 되살리려고 한 번씩 물어본 다음에 시작 그림을 걷는다
  const order = await page.evaluate(() => window.__calls.map(c => `${c.plugin}.${c.method}:${c.options.key || ''}`));
  assert.deepEqual(order.slice(0, order.indexOf('SplashScreen.hide:') + 1),
    [...[STORE_KEY, DEVICE_KEY, 'inhyuk-net-session', 'jelly-cloud-v1', 'jelly-migrating'].map(k => `Preferences.get:${k}`), 'SplashScreen.hide:']);

  // 2) 계정을 만들면 기기 저장소에도 똑같이 적힌다.
  // 새 계정은 이제 서버(온라인 계정)에 만든다. 서버 없이 확인하려고 예전 방식의 이 기기 계정을 테스트용 함수로 만든다.
  await page.evaluate(() => window.__puyo.localSignup('앱뿌요', 'abcd')); await page.waitForSelector('#scr-menu:not([hidden])');
  assert.equal(await page.locator('.back-site').isVisible(), false);
  await page.waitForFunction(key => (window.__prefs[key] || '').includes('앱뿌요'), STORE_KEY);
  assert.equal((await prefs(page))[STORE_KEY], await page.evaluate(key => localStorage.getItem(key), STORE_KEY));

  // 3) 진동 설정: 끄고 켜면 설정이 저장되고, 켤 때 톡 한 번.
  await page.click('#profile-chip'); await page.waitForSelector('#scr-profile:not([hidden])');
  assert.equal(await page.locator('#set-haptic').isVisible(), true);
  const before = (await calls(page, 'Haptics')).length;
  await page.click('#set-haptic');
  assert.equal(JSON.parse((await prefs(page))[DEVICE_KEY]).haptics, false);
  assert.equal((await calls(page, 'Haptics')).length, before); // 끈 순간에는 떨리지 않는다
  await page.click('#set-haptic');
  assert.equal(JSON.parse((await prefs(page))[DEVICE_KEY]).haptics, true);
  assert.ok((await calls(page, 'Haptics', 'impact')).length > before);

  // 4) 게임에서 터뜨리면 진동이 온다.
  await page.click('#scr-profile [data-go="menu"]');
  await page.evaluate(() => window.__puyo.startSolo());
  await page.waitForFunction(() => window.__puyo.match?.phase === 'play');
  const hapticsBeforePop = (await calls(page, 'Haptics')).length;
  await page.evaluate(() => {
    const p = window.__puyo.match.players[0];
    for (let x = 0; x < 4; x++) p.cells[x] = 1; // 바닥에 빨강 4개 → 바로 퐁
    p.refreshHeights(); p.check({ canReceive: false });
  });
  await page.waitForFunction(n => window.__calls.filter(c => c.plugin === 'Haptics').length > n, hapticsBeforePop);
  await page.evaluate(() => window.__puyo.pause(true)); await page.click('#pause-quit');
  const saved = await prefs(page);

  // 5) 아이폰이 웹 저장소를 비워 버려도, 기기 저장소에서 계정이 돌아온다.
  await first.context.close();
  const second = await openApp(saved);
  page = second.page;
  assert.equal(await page.evaluate(key => localStorage.getItem(key)?.includes('앱뿌요'), STORE_KEY), true);
  await page.waitForSelector('#scr-menu:not([hidden])'); // 마지막으로 들어가 있던 계정으로 바로 시작
  assert.equal(await page.textContent('#chip-name'), '앱뿌요');

  // 6) 계정 지우기: 한 번 더 물어보고, 지우면 기기 저장소에서도 사라진다.
  await page.click('#profile-chip'); await page.waitForSelector('#scr-profile:not([hidden])');
  await page.click('#delete-account');
  assert.match(await page.textContent('#delete-question'), /앱뿌요 계정을 지울까/);
  await page.click('#delete-cancel'); assert.equal(await page.locator('#delete-confirm').isVisible(), false);
  await page.click('#delete-account'); await page.click('#delete-yes');
  await page.waitForSelector('#scr-login:not([hidden])');
  const store = JSON.parse((await prefs(page))[STORE_KEY]);
  assert.equal(store.accounts.some(a => a.name === '앱뿌요'), false);
  assert.equal(await page.locator('#login-accounts button').count(), 0);
  await second.context.close();

  // 7) 웹사이트(진짜 Capacitor 없음)에서는 앱 전용 것들이 안 보이고 사이트 링크는 그대로.
  const web = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  web.on('pageerror', e => errors.push(e.message));
  await web.goto(`${base}?test`); await web.waitForFunction(() => window.__puyo);
  assert.equal(await web.evaluate(() => document.body.classList.contains('app')), false);
  await web.click('#go-guest'); await web.waitForSelector('#scr-menu:not([hidden])');
  assert.equal(await web.locator('.back-site').isVisible(), true);
  await web.click('#profile-chip');
  assert.equal(await web.locator('#set-haptic').isVisible(), false);
  assert.equal(await web.locator('#delete-zone').isVisible(), false); // 손님은 지울 계정이 없다

  // 8) 안드로이드: 뒤로 가기 단추는 한 칸씩 돌아가고, 첫 화면에서만 앱을 끈다. 아이폰은 듣지 않는다.
  const ios = await openApp();
  assert.equal(await ios.page.evaluate(() => Object.keys(window.__listeners).length), 0);
  await ios.context.close();
  const droid = await openApp({}, 'android');
  page = droid.page;
  const back = () => page.evaluate(() => window.__listeners['App.backButton']({}));
  const exits = () => calls(page, 'App', 'exitApp').then(c => c.length);
  assert.equal(await page.evaluate(() => typeof window.__listeners['App.backButton']), 'function');
  await page.click('#go-signup'); await back();
  assert.equal(await page.locator('#login-main').isVisible(), true); // 가입 칸 → 로그인 첫 칸
  assert.equal(await exits(), 0);
  await page.click('#go-guest'); await page.waitForSelector('#scr-menu:not([hidden])');
  await page.click('#scr-menu [data-go="shop"]'); await back();
  await page.waitForSelector('#scr-menu:not([hidden])'); // 상점 → 메뉴
  await page.evaluate(() => window.__puyo.startSolo());
  await page.waitForFunction(() => window.__puyo.match?.phase === 'play');
  await back(); assert.equal(await page.locator('#pause').isVisible(), true); // 게임 중 → 멈춤
  await back(); assert.equal(await page.locator('#pause').isVisible(), false); // 한 번 더 → 계속
  assert.equal(await exits(), 0);
  await page.evaluate(() => window.__puyo.pause(true)); await page.click('#pause-quit');
  await page.waitForSelector('#scr-menu:not([hidden])');
  await back(); assert.equal(await exits(), 1); // 메뉴에서는 앱 끄기
  await droid.context.close();

  assert.deepEqual(errors, []);
  console.log('PASS: 앱 시작 그림 걷기, 기기 저장소에 같이 저장·되살리기, 진동 설정·터질 때 진동, 계정 지우기, 웹에서는 앱 전용 숨김, 안드로이드 뒤로 가기 — 오류 없음');
} finally { await browser.close(); }
