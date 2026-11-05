// Login and cloud save against a LOCAL net server (never the real one):
//   (cd services/net && ST=$(mktemp -d) && CI=1 npx wrangler d1 migrations apply net --local --persist-to "$ST" && CI=1 npx wrangler dev --port 8787 --ip 127.0.0.1 --persist-to "$ST")
//   node games/social-game/login-check.mjs http://127.0.0.1:5262/ [outDir]
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const pw = await import('../../tools/node_modules/playwright/index.mjs').catch(() => import(process.env.PLAYWRIGHT_MJS ?? 'playwright'));
const base = process.argv[2] ?? 'http://127.0.0.1:5262/';
const out = process.argv[3] ?? '/tmp/social-login';
mkdirSync(out, { recursive: true });
const url = `${base}${base.includes('?') ? '&' : '?'}net=http://127.0.0.1:8787`;
const nick = 'sg' + Math.random().toString(36).slice(2, 8);
const browser = await pw.chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });

async function computer(name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  return { ctx, page, errors, name };
}
const ready = (page) => page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
const G = (page, f, a) => page.evaluate(f, a);

// computer A: pick a story (a new game asks first; the page reloads and starts), sign up, make progress, it uploads
const A = await computer('A');
await Promise.all([A.page.waitForEvent('load', { timeout: 60000 }), A.page.click('#m-office')]);
await ready(A.page);
await A.page.waitForFunction(() => document.getElementById('start').classList.contains('hidden'), null, { timeout: 20000 });
await A.page.click('#btn-login');
await A.page.fill('#nick', nick);
await A.page.fill('#pw', 'abcd1234');
await A.page.screenshot({ path: `${out}/01-login.png` });
await A.page.click('#do-signup');
await A.page.waitForFunction(() => !document.getElementById('login-in').classList.contains('hidden'), null, { timeout: 20000 });
await A.page.screenshot({ path: `${out}/02-loggedin.png` });
await A.page.click('#login-close');
await G(A.page, () => { const g = window.__game; g.state.day = 3; g.state.money = 123000; g.state.step = 4; g.build.placeBlock('stone', -146.5, 0, -8.5, 0); g.day.complete(g.day.step.id); });
await A.page.waitForFunction(() => document.getElementById('cloud-status').textContent.includes('서버에 저장됨'), null, { timeout: 20000 });
const stepA = await G(A.page, () => window.__game.state.step);

// computer B: fresh browser, log in, the game reloads with A's save
const B = await computer('B');
await B.page.click('#btn-login-start');
await B.page.fill('#nick', nick);
await B.page.fill('#pw', 'abcd1234');
await Promise.all([B.page.waitForEvent('load', { timeout: 30000 }), B.page.click('#do-login')]);
await ready(B.page);
const sB = await G(B.page, () => ({ day: window.__game.state.day, money: window.__game.state.money, step: window.__game.state.step, blocks: window.__game.build.placed.size, who: document.getElementById('who').textContent }));
assert.deepEqual([sB.day, sB.money, sB.step, sB.blocks], [3, 123000, stepA, 1], 'B continues A\'s game');
assert.match(sB.who, new RegExp(nick));
await B.page.screenshot({ path: `${out}/03-second-computer.png` });

// both change it: B saves first, A then gets the choice dialog and keeps its own record
await B.page.click('#play');
await G(B.page, () => { const g = window.__game; g.state.money = 1000; g.day.g.save(); });
await B.page.waitForFunction(() => document.getElementById('cloud-status').textContent.includes('서버에 저장됨'), null, { timeout: 20000 });
await G(A.page, () => { const g = window.__game; g.state.money = 999000; g.day.g.save(); });
await A.page.waitForFunction(() => !document.getElementById('choose').classList.contains('hidden'), null, { timeout: 20000 });
await A.page.screenshot({ path: `${out}/04-choose.png` });
const texts = await G(A.page, () => [document.getElementById('pick-local').textContent, document.getElementById('pick-server').textContent]);
assert.match(texts[0], /999,000원/);
assert.match(texts[1], /1,000원/);
await A.page.click('#pick-local');
await A.page.waitForFunction(() => document.getElementById('cloud-status').textContent.includes('서버에 저장됨'), null, { timeout: 20000 });
const server = await G(A.page, async () => (await window.__game.cloud.account.loadSave('social-game')).data.money);
assert.equal(server, 999000, 'the chosen record is on the server, nothing merged');

for (const c of [A, B]) assert.deepEqual(c.errors, [], `page errors on ${c.name}`);
console.log('login check ok', nick, out);
await browser.close();
