// Plays the child story: a school day with the academy, the injury on day 2, the licence and the car on day 3.
// node games/social-game/kid-check.mjs [url] [outDir]
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const pw = await import('../../tools/node_modules/playwright/index.mjs').catch(() => import(process.env.PLAYWRIGHT_MJS ?? 'playwright'));
const url = process.argv[2] ?? 'http://127.0.0.1:5262/';
const out = process.argv[3] ?? '/tmp/social-kid';
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
await page.click('#m-kid');
await Promise.all([page.waitForEvent('load'), page.click('#m-boy')]);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
await page.waitForTimeout(800);
const G = (fn, arg) => page.evaluate(fn, arg);
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
const step = () => G(() => window.__game.day.step?.id ?? 'done');
/** Fast-forward the clock (test only) until the current step's time has come (rest steps end by themselves). */
const waitReady = async () => {
  if (await G(() => window.__game.day.ready())) return;
  await G(() => { window.__game.day.timeScale = 240; });
  await page.waitForFunction(() => window.__game.day.ready(), null, { timeout: 60000 });
  await G(() => { window.__game.day.timeScale = 1; });
  await page.waitForTimeout(200);
};
const act = async (key) => {
  await waitReady();
  assert.ok(await G((k) => { const it = window.__game.places.interactables.find((i) => i.key === k); if (!it) return false; window.__game.day.use(it); return true; }, key), `no ${key}`);
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(400);
    const busy = await G(() => { const d = window.__game.day; if (d._ok) { d._ok(); return true; } if (d._miniFinish) { d._miniFinish(true); return true; } return d.busy || !!d.seat; });
    if (!busy) break;
  }
  await page.waitForTimeout(300);
};
const goTo = (site) => G((k) => { const g = window.__game; const e = g.places.entrance(k); g.player.place(e.x, 0.2, e.z, 0); }, site);
const skipRest = async () => {
  // a rest step is a plain wait now: the card shows until when, then it ends by itself
  assert.ok(/쉬는 중/.test(await G(() => document.getElementById('quest-wait')?.textContent ?? '')), 'rest shows the wait chip');
  await waitReady();
};

assert.deepEqual(await G(() => [window.__game.state.mode, window.__game.state.gender]), ['kid', 'boy']);
assert.equal(await G(() => window.__game.places.interactables.filter((i) => i.id === 'mom' || i.id === 'dad').length), 2, 'mom and dad are home');
await page.keyboard.down('KeyW'); await page.waitForTimeout(500); await page.keyboard.up('KeyW');
await page.waitForTimeout(300);
for (const k of ['home:sink', 'home:breakfast', 'home:wardrobe']) await act(k);
assert.equal(await step(), 'go-school');
await goTo('school'); await page.waitForTimeout(600);
assert.equal(await step(), 'class');
await shot('01-school');
await act('school:class');
assert.equal(await step(), 'schoolLunch');
await act('school:schoolLunch');
assert.equal(await step(), 'rest1');
await skipRest(); await page.waitForTimeout(500);
assert.equal(await step(), 'taekwondo');
await waitReady();
await G(() => { const g = window.__game; g.day.use(g.places.interactables.find((i) => i.key === 'academy:taekwondo')); });
await page.waitForTimeout(1200);
await shot('02-taekwondo');
await G(() => window.__game.day._miniFinish?.(true));
await page.waitForTimeout(500);
assert.equal(await step(), 'piano');
await G(() => { const g = window.__game; g.day.use(g.places.interactables.find((i) => i.key === 'academy:piano')); });
await page.waitForTimeout(1500);
await shot('03-piano');
await G(() => window.__game.day._miniFinish?.(true));
await page.waitForTimeout(800);
assert.equal(await step(), 'rest2');
await skipRest(); await page.waitForTimeout(500);
assert.equal(await step(), 'english');
await act('academy:english');
assert.equal(await step(), 'gohome');
await G(() => { const g = window.__game; const s = g.places.sites.home; const sp = s.spawn.pos; const c = Math.cos(s.worldYaw), sn = Math.sin(s.worldYaw); g.player.place(s.worldPos[0] + sp[0] * c + sp[2] * sn, s.worldPos[1] + sp[1] + 0.05, s.worldPos[2] - sp[0] * sn + sp[2] * c, 0); });
await page.waitForTimeout(600);
assert.equal(await step(), 'dinner');
for (const k of ['home:breakfast', 'home:shower', 'home:bed']) await act(k);
await page.waitForFunction(() => window.__game.state.day === 2, null, { timeout: 20000 });

// day 2: PE time, the leg gets hurt
await page.keyboard.down('KeyW'); await page.waitForTimeout(500); await page.keyboard.up('KeyW');
await page.waitForTimeout(300);
for (const k of ['home:sink', 'home:breakfast', 'home:wardrobe']) await act(k);
await goTo('school'); await page.waitForTimeout(600);
await act('school:class');
// PE time (10:30): outside the building the child falls (the test player stands at the gate, so it happens at once)
await waitReady();
await goTo('school');
await page.waitForFunction(() => window.__game.state.hurt === true && !window.__game.day.busy, null, { timeout: 20000 });
await page.waitForTimeout(500);
assert.equal(await step(), 'schoolLunch');
assert.equal(await G(() => window.__game.state.hurt), true, 'hurt on day 2');
assert.equal(await G(() => window.__game.player.limp), true);
await G(() => { const g = window.__game; g.state.step = g.day.steps.length; g.day.sleep(); });
await page.waitForFunction(() => window.__game.state.day === 3 && !window.__game.day.busy, null, { timeout: 20000 });

// day 3: licence first, then drive to school
await page.keyboard.down('KeyW'); await page.waitForTimeout(500); await page.keyboard.up('KeyW');
await page.waitForTimeout(300);
for (const k of ['home:sink', 'home:breakfast', 'home:wardrobe']) await act(k);
assert.equal(await step(), 'license');
await act('home:mom');
await shot('04-license-centre');
await G(() => { const g = window.__game; g.day.use(g.places.interactables.find((i) => i.key === 'license:license')); });
await page.waitForFunction(() => window.__game.driveTest.active, null, { timeout: 20000 });
const n = await G(() => window.__game.driveTest.active.cps.length);
for (let i = 0; i <= n; i++) { await G(() => { const g = window.__game; const p = g.driveTest.target(); g.vehicle.speed = 0; g.vehicle.park(p.x, p.z, g.vehicle.yaw); }); await page.waitForTimeout(250); }
await page.waitForFunction(() => !window.__game.driveTest.active, null, { timeout: 20000 });
await page.waitForTimeout(1500);
assert.equal(await G(() => window.__game.state.license), true);
assert.equal(await step(), 'drive-school');
await shot('05-licensed');

assert.deepEqual(errors, [], 'no page errors');
console.log('kid check ok', out);
await browser.close();
