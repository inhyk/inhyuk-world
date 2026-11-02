// Plays one whole Monday and a bit of Tuesday in a real browser and saves screenshots.
// node games/social-game/browser-check.mjs [url] [outDir]
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const pw = await import('../../tools/node_modules/playwright/index.mjs').catch(() => import(process.env.PLAYWRIGHT_MJS ?? 'playwright'));
const url = process.argv[2] ?? 'http://127.0.0.1:5262/';
const out = process.argv[3] ?? 'artifacts/social-game';
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
assert.equal(await page.evaluate(() => window.__error ?? null), null, 'boot error');
await page.click('#play');
await page.waitForTimeout(800);
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
const G = (fn, arg) => page.evaluate(fn, arg);
const step = () => G(() => window.__game.day.step?.id ?? 'done');
const act = async (key) => {
  const ok = await G((k) => { const it = window.__game.places.interactables.find((i) => i.key === k); if (!it) return false; window.__game.day.use(it); return true; }, key);
  assert.ok(ok, `no interactable ${key}`);
  await page.waitForFunction(() => !window.__game.day.busy, null, { timeout: 20000 });
  await page.waitForTimeout(300);
};
const solveSeat = async () => {
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(900);
    const more = await G(() => { const d = window.__game.day; if (d._ok) { d._ok(); return true; } return !!d.seat; });
    if (!more) break;
  }
  await page.waitForFunction(() => !window.__game.day.seat, null, { timeout: 20000 });
};

// morning at home
await shot('01-wake');
assert.equal(await step(), 'wake');
await page.keyboard.down('KeyW'); await page.waitForTimeout(500); await page.keyboard.up('KeyW');
await page.waitForTimeout(300);
assert.equal(await step(), 'sink');
await act('home:sink'); assert.equal(await step(), 'breakfast');
const food0 = await G(() => window.__game.state.food);
await act('home:breakfast'); assert.equal(await step(), 'wardrobe');
assert.ok(await G(() => window.__game.state.food) > food0, 'breakfast fills the stomach');
await act('home:wardrobe'); assert.equal(await step(), 'drive-work');
assert.equal(await G(() => window.__game.state.outfit), 'suit');
await shot('02-dressed');

// drive to work
await G(() => { const g = window.__game; g.vehicle.driving = true; });
await page.keyboard.down('KeyW'); await page.waitForTimeout(1200); await page.keyboard.up('KeyW');
const moved = await G(() => window.__game.vehicle.speed);
assert.ok(Math.abs(moved) > 1, 'the car drives');
await shot('03-driving');
await G(() => { const g = window.__game; g.vehicle.park(70, -22, 0); g.vehicle.driving = false; const e = g.places.entrance('office'); g.player.place(e.x, 0.2, e.z, 0); });
await page.waitForTimeout(600);
assert.equal(await step(), 'badge');
await shot('04-office');
await act('office:badge'); assert.equal(await step(), 'coffee');
await act('office:coffee'); assert.equal(await step(), 'work');

// work, team meeting, lunch, work, print, manager, badge out
await act('office:desk'); await solveSeat();
assert.equal(await step(), 'teamMeeting');
await G(() => { window.__game.day.use(window.__game.places.interactables.find((i) => i.key === 'office:teamMeeting')); });
await page.waitForTimeout(1500);
await shot('05a-meeting');
await solveSeat();
assert.equal(await step(), 'lunch');
await act('office:lunch'); assert.equal(await step(), 'work2');
await G(() => { window.__game.day.use(window.__game.places.interactables.find((i) => i.key === 'office:desk')); });
await page.waitForTimeout(1600);
await shot('05-computer');
await solveSeat();
assert.equal(await step(), 'print');
assert.ok(await G(() => window.__game.state.money) >= 80000, 'got paid');
await act('office:boss'); assert.equal(await step(), 'print', 'no report yet');
await act('office:print'); assert.equal(await step(), 'boss');
await act('office:boss'); assert.equal(await step(), 'badge-out');
await act('office:badge'); assert.equal(await step(), 'gohome');

// home, shower, sleep
await G(() => { const g = window.__game; const e = g.places.entrance('home'); g.player.place(e.x, 0.5, e.z - 3, 0); });
await page.waitForTimeout(600);
assert.equal(await step(), 'shower');
await act('home:shower'); assert.equal(await step(), 'sleep');
await act('home:bed');
await page.waitForFunction(() => window.__game.state.day === 2, null, { timeout: 20000 });
assert.equal(await step(), 'wake');
await page.waitForTimeout(1500);
await shot('06-day2');

// office elevator: lobby → roof
await G(() => { const g = window.__game; const L = g.lifts.lifts[0].landings[0]; g.player.place(L.pos.x, L.pos.y + 0.02, L.pos.z + 2, 0); });
await page.waitForTimeout(300);
await G(() => { const g = window.__game; g.lifts.call(g.lifts.lifts[0], 0); });
await page.waitForTimeout(1200);
await G(() => { const g = window.__game; const L = g.lifts.lifts[0].landings[0]; g.player.place(L.pos.x, L.pos.y + 0.02, L.pos.z - 1, Math.PI); });
await G(() => { const g = window.__game; g.lifts.ride(g.lifts.lifts[0], 1); });
await page.waitForFunction(() => !window.__game.lifts.busy, null, { timeout: 20000 });
assert.ok(await G(() => window.__game.player.pos.y) > 20, 'rode up to the roof');
await page.waitForTimeout(600);
await shot('06b-roof');

// blocks: place and break
const n0 = await G(() => window.__game.state.inventory.stone);
await G(() => { const g = window.__game; g.build.placeBlock('stone', -146.5, 0, -8.5, 0); g.state.inventory.stone--; });
assert.equal(await G(() => window.__game.build.placed.size), 1);
await G(() => { const g = window.__game; const r = [...g.build.placed.values()][0]; g.build.removeBlock(r); g.state.inventory.stone++; });
assert.equal(await G(() => window.__game.state.inventory.stone), n0);

// weekend trip to Japan
await G(() => { const g = window.__game; g.state.day = 6; g.state.step = 0; g.state.hour = 7; g.state.wakeAt = 'home'; g.day.wakeUp(); });
await page.keyboard.down('KeyW'); await page.waitForTimeout(500); await page.keyboard.up('KeyW');
await page.waitForTimeout(300);
assert.equal(await step(), 'wardrobe');
await act('home:wardrobe'); assert.equal(await step(), 'drive-airport');
await G(() => { const g = window.__game; const e = g.places.entrance('airport'); g.player.place(e.x, 0.2, e.z, 0); });
await page.waitForTimeout(600);
assert.equal(await step(), 'fly-japan');
await G(() => { const g = window.__game; g.day.use(g.places.interactables.find((i) => i.key === 'airport:board')); });
await page.waitForTimeout(9000);
await shot('07-flight');
await page.waitForFunction(() => !window.__game.day.busy && !window.__game.flight.active, null, { timeout: 60000 });
assert.ok(await G(() => window.__game.player.pos.x) > 1500, 'landed in Japan');
assert.equal(await step(), 'photo-jp');
await shot('08-japan');
await G(() => { const g = window.__game; const s = g.places.sites.shrine; g.player.place(s.worldPos[0], 0.2, s.worldPos[2] + 18, 0); });
await page.waitForTimeout(500);
await page.keyboard.press('KeyP');
await page.waitForTimeout(800);
assert.equal(await step(), 'ramen');
await shot('09-shrine');
await act('ramen:ramen'); assert.equal(await step(), 'souvenir');
await act('souvenir:souvenir'); assert.equal(await step(), 'ryokan');
await act('ryokan:futon');
await page.waitForFunction(() => window.__game.state.day === 7, null, { timeout: 20000 });
assert.ok(await G(() => window.__game.player.pos.x) > 1500, 'woke up in the ryokan');
await page.keyboard.down('KeyW'); await page.waitForTimeout(500); await page.keyboard.up('KeyW');
await page.waitForTimeout(300);
assert.equal(await step(), 'onsen');
await act('ryokan:onsen'); assert.equal(await step(), 'fly-home');
await G(() => { const g = window.__game; g.day.use(g.places.interactables.find((i) => i.key === 'jpAirport:board')); });
await page.waitForTimeout(3000);
await page.waitForFunction(() => !window.__game.day.busy && !window.__game.flight.active, null, { timeout: 60000 });
assert.ok(await G(() => window.__game.player.pos.x) < 1500, 'flew home');
assert.equal(await step(), 'drive-home');

const fatal = errors.filter((e) => !/favicon|toNonIndexed/.test(e));
assert.deepEqual(fatal, [], 'no page errors');
console.log('browser check ok:', out);
await browser.close();
