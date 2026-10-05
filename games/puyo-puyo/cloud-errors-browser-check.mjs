// 클라우드 저장이 실패하는 경우를 실제 Chrome 과 로컬 net 서버로 확인한다. 실패를 성공처럼 보이지 않는지 본다.
// 1) 기기 계정을 옮기는데 다른 기기가 계속 먼저 저장(409 세 번) → 옮기지 않고 "다시 하기", 기기 계정과 옮기던 표시는 그대로
//    → 다시 하기를 누르면 그때 옮겨진다
// 2) 기기 저장소가 꽉 참(setItem 이 QuotaExceededError) → 저장하지 못했다는 알림
// 3) 서버가 기록이 너무 크다고 함(413 too-big) → 저장됨으로 표시하지 않고 알림, 이 기기에는 남김 → 서버가 받으면 저장됨
//
// 사용법: npm run puyo-puyo:dev 후
//   PUYO_NET=http://127.0.0.1:8787 node games/puyo-puyo/cloud-errors-browser-check.mjs
//   (PUYO_NET 이 없으면 online-browser-check 처럼 빈 로컬 D1 로 wrangler dev 를 포트 8798 에 띄운다)
// 화면 사진: PUYO_SHOTS (기본 /tmp/jelly-cloud-errors), 이름은 jelly-integrate2-*.png
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.env.PUYO_URL || 'http://127.0.0.1:5190/';
const shots = process.env.PUYO_SHOTS || '/tmp/jelly-cloud-errors';
await mkdir(shots, { recursive: true });
const netDir = fileURLToPath(new URL('../../services/net/', import.meta.url));

let server = null, NET = process.env.PUYO_NET;
if (!NET) {
  const state = await mkdtemp(join(tmpdir(), 'jelly-net-'));
  execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'net', '--local', '--persist-to', state], { cwd: netDir, stdio: 'ignore', env: { ...process.env, CI: '1' } });
  const port = 8798;
  server = spawn('npx', ['wrangler', 'dev', '--port', String(port), '--ip', '127.0.0.1', '--persist-to', state], { cwd: netDir, detached: true, env: { ...process.env, CI: '1' } });
  let log = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error(`wrangler dev 가 뜨지 않음\n${log}`)), 60000);
    const read = chunk => { log += chunk; if (/Ready on/.test(log)) { clearTimeout(timer); resolve(); } };
    server.stdout.on('data', read); server.stderr.on('data', read);
    server.on('exit', code => reject(Error(`wrangler dev 가 끝남 (${code})\n${log}`)));
  });
  NET = `http://127.0.0.1:${port}`;
}
const stopServer = () => { if (server) try { process.kill(-server.pid, 'SIGTERM'); } catch { /* 이미 끝남 */ } };

const url = `${base}${base.includes('?') ? '&' : '?'}test&net=${encodeURIComponent(NET)}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
// 일부러 내는 409, 413, 저장이 없을 때 404 는 Chrome 이 콘솔 오류로 찍는다
const expected = /Failed to load resource: the server responded with a status of (404|409|413)/;
async function open(name, viewport = { width: 1100, height: 860 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !expected.test(m.text())) errors.push(`${name}: ${m.text()}`); });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__puyo, null, { timeout: 60000 });
  return page;
}
const settle = page => page.waitForTimeout(400);
const shot = async (page, name) => { await settle(page); await page.screenshot({ path: `${shots}/jelly-integrate2-${name}.png` }); };
const screenIs = (page, name) => page.waitForFunction(n => JSON.parse(window.render_game_to_text()).screen === n, name, { timeout: 20000 });
const toastHas = (page, re) => page.waitForFunction(s => [...document.querySelectorAll('.toast')].some(t => new RegExp(s).test(t.textContent)), re.source, { timeout: 15000 });
const tag = Math.random().toString(36).slice(2, 6);
const SAVES = '**/saves/jelly-tower';

try {
  // ---------- 1) 옮기기: 다른 기기가 계속 먼저 저장 ----------
  const a = await open('A');
  const nick = `젤리E${tag}`;
  await a.evaluate(n => window.__puyo.localSignup(n, '1111'), nick);
  await a.evaluate(() => { const p = window.__puyo.P(); p.level = 8; p.coins = 888; window.__puyo.save(); window.__puyo.show('profile'); });
  await a.click('#logout');
  await screenIs(a, 'login');
  let revision = 10, puts = 0;
  await a.route(SAVES, async route => {
    if (route.request().method() !== 'PUT') return route.continue();
    puts++; revision++;
    await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'conflict', data: { level: 2, coins: 20 }, revision, updated: Date.now() }) });
  });
  await a.click('#login-accounts button');
  await a.fill('#login-pass', '1111');
  await a.click('#migrate-go');
  for (let i = 0; i < 3; i++) {
    await a.waitForSelector('#cloud-conflict:not([hidden])', { timeout: 15000 });
    await a.click('#conflict-local');
    await a.waitForFunction(() => document.getElementById('cloud-conflict').hidden);
  }
  await a.waitForSelector('#migrate-retry:not([hidden])', { timeout: 15000 });
  assert.match(await a.textContent('#migrate-text'), /다른 기기가 계속 먼저 저장/);
  assert.equal(puts, 4);
  const kept = await a.evaluate(() => ({
    local: window.__puyo.store.accounts.find(x => x.progress.coins === 888)?.migratedTo ?? null,
    marker: Object.keys(localStorage).some(k => k.startsWith('jelly-migrating')),
    screen: JSON.parse(window.render_game_to_text()).screen,
  }));
  assert.deepEqual(kept, { local: null, marker: true, screen: 'login' });
  await shot(a, 'import-retry');
  // 다른 기기가 멈춘 뒤 다시 하기 → 옮겨진다
  await a.unroute(SAVES);
  await a.click('#migrate-retry');
  await screenIs(a, 'menu');
  assert.equal(await a.evaluate(() => window.__puyo.P().coins), 888);
  assert.equal(await a.evaluate(() => window.__puyo.store.accounts[0].migratedTo), nick);

  // ---------- 2) 기기 저장소가 꽉 참 ----------
  const q = await open('Q');
  await q.evaluate(() => window.__puyo.localSignup(`젤리Q${Math.random().toString(36).slice(2, 6)}`, '2222'));
  await q.evaluate(() => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (k === 'puyo-tower-v1') { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } return real.call(this, k, v); };
    window.__puyo.P().coins += 1; window.__puyo.save();
  });
  await toastHas(q, /이 기기에 기록을 저장하지 못했어/);
  await shot(q, 'storage-full');

  // ---------- 3) 서버가 너무 크다고 함 (413) ----------
  const c = await open('C');
  await c.click('#go-signup');
  await c.fill('#signup-name', `젤리C${tag}`); await c.fill('#signup-pass', 'cccc');
  await c.click('#signup-form button[type=submit]');
  await screenIs(c, 'menu');
  await c.waitForFunction(() => window.__puyo.cloud?.state === 'synced', null, { timeout: 15000 });
  await c.route(SAVES, route => route.request().method() === 'PUT'
    ? route.fulfill({ status: 413, contentType: 'application/json', body: JSON.stringify({ error: 'too-big' }) })
    : route.continue());
  await c.evaluate(() => { window.__puyo.P().coins = 4321; window.__puyo.save(); return window.__puyo.cloud.flush(); });
  await toastHas(c, /너무 커서 서버에 저장하지 못했어/);
  await c.evaluate(() => window.__puyo.show('profile'));
  await c.waitForFunction(() => /너무 커서/.test(document.getElementById('cloud-badge').textContent));
  assert.deepEqual(await c.evaluate(() => ({ state: window.__puyo.cloud.state, dirty: window.__puyo.cloud.dirty, coins: window.__puyo.cloud.data.coins })), { state: 'too-big', dirty: true, coins: 4321 });
  await shot(c, 'save-too-big');
  // 서버가 받게 되면(한도를 올려 배포) 다음 다시 하기에서 올라간다
  await c.unroute(SAVES);
  await c.evaluate(() => { window.__puyo.cloud.retryNow(); return window.__puyo.cloud.busy; });
  await c.waitForFunction(() => window.__puyo.cloud.state === 'synced' && !window.__puyo.cloud.dirty, null, { timeout: 15000 });
  assert.equal(await c.textContent('#cloud-badge'), '☁️ 저장됨');

  assert.deepEqual(errors, []);
  console.log(`PASS: 옮기기 중 충돌 3번 → 옮기지 않고 다시 하기(기기 계정, 옮기던 표시 그대로) → 다시 하기로 옮김, 기기 저장소 꽉 참 알림, 413 too-big → 저장됨 아님(알림, 기기에 남음) → 서버가 받으면 저장됨 — 오류 없음 (net ${NET})`);
  console.log(`Screenshots: ${shots}`);
} finally {
  await browser.close();
  stopServer();
}
