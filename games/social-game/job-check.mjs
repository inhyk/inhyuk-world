// Plays one whole work day of every job (경찰관, 소방관, 의사, 요리사, 마트 직원, 우체부) in a real browser and
// saves a screenshot of each task. Waits for a step's time are fast-forwarded with day.timeScale (test only).
// node games/social-game/job-check.mjs [url] [outDir] [job,job,...]
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const pw = await import('../../tools/node_modules/playwright/index.mjs').catch(() => import(process.env.PLAYWRIGHT_MJS ?? 'playwright'));
const url = process.argv[2] ?? 'http://127.0.0.1:5262/';
const out = process.argv[3] ?? '/tmp/social-jobs';
const only = (process.argv[4] ?? '').split(',').filter(Boolean);
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const G = (fn, arg) => page.evaluate(fn, arg);
const step = () => G(() => window.__game.day.step?.id ?? 'done');
let job = '';
const shot = (n) => page.screenshot({ path: `${out}/${job}-${n}.png` });

/** Fast-forward the clock (test only) until the current step's time has come. */
const waitReady = async () => {
  if (await G(() => window.__game.day.ready())) return;
  await G(() => { window.__game.day.timeScale = 240; });
  await page.waitForFunction(() => window.__game.day.ready(), null, { timeout: 60000 });
  await G(() => { window.__game.day.timeScale = 1; });
};
const hasIt = (key) => page.waitForFunction((k) => window.__game.places.interactables.some((i) => i.key === k), key, { timeout: 30000 });
/** Use an interactable like E; finish mini games and seats. pic: screenshot name while the game is open. */
const act = async (key, pic) => {
  await waitReady();
  await hasIt(key);
  await G((k) => { const g = window.__game; g.day.use(g.places.interactables.find((i) => i.key === k)); }, key);
  if (pic) { await page.waitForTimeout(1500); await shot(pic); }
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(350);
    const more = await G(() => { const d = window.__game.day; if (d._ok) { d._ok(); return true; } if (d._miniFinish) { d._miniFinish(true); return true; } return d.busy || !!d.seat; });
    if (!more) break;
  }
  await page.waitForTimeout(300);
};
const goTo = async (site, back = 0) => {
  await G(([k, b]) => { const g = window.__game; g.vehicle.driving = false; const e = g.places.entrance(k); const s = g.places.sites[k]; const f = [Math.sin(s.worldYaw), Math.cos(s.worldYaw)]; g.player.place(e.x + f[0] * b, Math.max(0.2, e.y + 0.2), e.z + f[1] * b, s.worldYaw); }, [site, back]);
  await page.waitForTimeout(1800);
};
/** Put the player in front of an interactable (on the room side, so wall things are seen head on), facing it. */
const stand = async (key, d = 2.2) => {
  await hasIt(key);
  await G(([k, dd]) => {
    const g = window.__game, it = g.places.interactables.find((i) => i.key === k);
    g.vehicle.driving = false;
    const s = g.places.sites[it.site];
    let dx = s ? s.worldPos[0] - it.wpos.x : 0, dz = s ? s.worldPos[2] - it.wpos.z : 1;
    const n = Math.hypot(dx, dz) || 1; dx /= n; dz /= n;
    const x = it.wpos.x + dx * dd, z = it.wpos.z + dz * dd;
    g.player.place(x, Math.max(0.17, it.wpos.y - 1.4), z, Math.atan2(x - it.wpos.x, z - it.wpos.z));
  }, [key, d]);
  await page.waitForTimeout(700);
};
const expect = async (id) => assert.equal(await step(), id, `${job}: expected step ${id}`);
/** Hold W like a player: the job vehicle really drives off from where it was parked. */
const driveOff = async (what) => {
  const a = await G(() => window.__game.vehicle.pos.toArray());
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1800); await page.keyboard.up('KeyW');
  const b = await G(() => window.__game.vehicle.pos.toArray());
  assert.ok(Math.hypot(b[0] - a[0], b[2] - a[2]) > 3, `${what} drives away (${a} → ${b})`);
};

async function morning() {
  await G(() => { const g = window.__game; g.state.license = true; g.state.plan = null; });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(500); await page.keyboard.up('KeyW');
  await page.waitForTimeout(300);
  for (const k of ['home:sink', 'home:breakfast', 'home:wardrobe']) await act(k);
  assert.equal(await G(() => window.__game.state.outfit), 'casual', 'commute clothes');
  await expect('go-job');
}
async function evening(money0) {
  await expect('job-out');
  if (await G(() => window.__game.state.hour < 17.5)) {
    assert.equal(await G(() => window.__game.day.ready()), false, '퇴근 waits for 6 p.m.');
    await page.waitForTimeout(300);
    const late = await G(() => document.getElementById('quest-wait')?.textContent ?? '');
    assert.ok(/오후 6:00/.test(late), `wait chip shows 6 p.m. (${late})`);
    await shot('09-wait-for-6pm');
  }
  await act((await G(() => window.__game.day.step.target)));
  assert.equal(await G(() => window.__game.state.money), money0 + 150000, 'paid the wage at 퇴근');
  assert.equal(await G(() => window.__game.state.outfit), 'casual');
  await expect('gohome');
  await G(() => { const g = window.__game; const s = g.places.sites.home; const sp = s.spawn.pos; const c = Math.cos(s.worldYaw), sn = Math.sin(s.worldYaw); g.vehicle.driving = false; g.player.place(s.worldPos[0] + sp[0] * c + sp[2] * sn, s.worldPos[1] + sp[1] + 0.05, s.worldPos[2] - sp[0] * sn + sp[2] * c, 0); });
  await page.waitForTimeout(800);
  await expect('shower');
  await act('home:shower');
  await act('home:bed');
  await page.waitForFunction(() => window.__game.state.day === 2 && !window.__game.day.busy, null, { timeout: 30000 });
  assert.equal(await G(() => window.__game.kind()), 'job', 'day 2 is a work day again');
  assert.equal(await G(() => window.__game.jobs.ride), null, 'job vehicle back at its station');
}

const DAYS = {
  async police() {
    await goTo('civic-police'); await expect('p-check');
    await shot('01-station');
    await act('civic-police:officer', '02-check'); await expect('p-uniform');
    await stand('civic-police:policeLocker', 1.9); await shot('03-locker');
    await act('civic-police:policeLocker');
    assert.equal(await G(() => window.__game.state.outfit), 'police');
    await G(() => { const g = window.__game; g.player.toggleView(); });
    await page.waitForTimeout(600); await shot('03b-uniform-3rd'); await G(() => window.__game.player.toggleView());
    await expect('p-patrol');
    await act('civic-police:patrolCar');
    assert.equal(await G(() => window.__game.vehicle.driving && window.__game.jobs.ride?.kind), 'patrol', 'in the patrol car');
    await driveOff('patrol car');
    await G(() => { const g = window.__game; g.vehicle.park(g.vehicle.pos.x + 6, g.vehicle.pos.z + 8, Math.PI / 2); });
    await page.waitForTimeout(900); await shot('04-patrol-car');
    for (let i = 0; i < 3; i++) {
      if (i === 1) {
        // the school zone ring ahead, then too fast (not counted), then slow
        await G(() => { const g = window.__game; const p = g.day.target(); g.vehicle.speed = 0; g.vehicle.park(p.x + 26, p.z - 3, Math.PI / 2); });
        await page.waitForTimeout(900); await shot('05-school-zone');
        await G(() => { const g = window.__game; const p = g.day.target(); g.vehicle.park(p.x + 2, p.z, Math.PI / 2); g.vehicle.speed = 14; });
        await page.waitForTimeout(60);
        assert.equal(await G(() => window.__game.state.counts['p-patrol']), 1, 'too fast in the school zone does not count');
        await G(() => { window.__game.vehicle.speed = 0; });
      }
      await G(() => { const g = window.__game; const p = g.day.target(); g.vehicle.speed = 0; g.vehicle.park(p.x + 3, p.z, Math.PI / 2); });
      await page.waitForTimeout(500);
    }
    await expect('p-lost');
    await G(() => { const g = window.__game; g.vehicle.driving = false; const k = g.jobs.scene.kid.ch.group.position; g.player.place(k.x - 1.5, 0.3, k.z - 2.4, Math.atan2(-1.5, -2.4)); });
    await page.waitForTimeout(900); await shot('06-lost-kid');
    await act('job:lostKid', '06b-lost-kid-talk'); await expect('p-mom');
    await G(() => { const g = window.__game; const m = g.jobs.scene.mom.ch.group.position; g.player.place(m.x + 2.5, 0.3, m.z + 2.0, Math.atan2(2.5, 2.0)); });
    await page.waitForTimeout(2500); await shot('07-follow-to-mom');
    await act('job:mom'); await expect('p-traffic');
    await page.waitForTimeout(800); await shot('07b-reunited');
    await G(() => { const g = window.__game; g.player.place(150, 0.3, 15.5, 0); });
    await page.waitForTimeout(600);
    await act('job:traffic', '08-traffic'); await expect('p-report');
    await goTo('civic-police');
    await page.waitForFunction(() => !window.__game.jobs.ride, null, { timeout: 10000 });
    await act('civic-police:policeDesk', '08b-report');
  },
  async fire() {
    await goTo('civic-fire'); await expect('f-suit');
    await stand('civic-fire:fireLocker', 1.6); await shot('01-lockers');
    await act('civic-fire:fireLocker', '02-suit-game'); await expect('f-wait');
    assert.equal(await G(() => window.__game.state.outfit), 'fire');
    await G(() => window.__game.player.toggleView()); await page.waitForTimeout(600); await shot('02b-suit-3rd'); await G(() => window.__game.player.toggleView());
    await shot('03-wait');
    await waitReady(); await page.waitForTimeout(400);
    await shot('03b-alarm');
    await expect('f-truck');
    await act('civic-fire:firetruck');
    assert.equal(await G(() => window.__game.jobs.ride?.kind), 'truck', 'driving the fire truck');
    await driveOff('fire truck out of its bay');
    await G(() => { const g = window.__game; g.player.view = 'third'; g.vehicle.park(g.vehicle.pos.x, g.vehicle.pos.z + 12, Math.PI); g.vehicle.speed = 0; });
    await page.waitForTimeout(1200); await shot('04-truck-out');
    await G(() => { const g = window.__game; g.vehicle.park(62, 116.5, -Math.PI / 2 + 0.25); });
    await page.waitForTimeout(1500); await shot('04b-smoke');
    await G(() => { const g = window.__game; g.vehicle.speed = 0; g.vehicle.park(105, 116.5, -Math.PI / 2); });
    await page.waitForTimeout(800); await expect('f-hose');
    await G(() => { const g = window.__game; g.player.view = 'first'; g.vehicle.driving = false; if (g.player.arm) g.player.arm.group.visible = true; if (g.player.avatar) g.player.avatar.group.visible = false; g.player.place(113, 0.3, 112.5, 0.05); g.player.pitch = 0.22; });
    await page.waitForTimeout(800); await shot('05-fire');
    await G(() => { const g = window.__game; g.day.use(g.places.interactables.find((i) => i.key === 'job:hydrant')); });
    await page.waitForFunction(() => window.__game.jobs.tool === 'hose' && !window.__game.day.busy, null, { timeout: 10000 });
    await G(() => { const g = window.__game; g.player.place(113, 0.3, 112.5, -0.05); g.jobs._autoSpray = true; });
    await page.waitForTimeout(100); await G(() => { window.__game.player.pitch = 0.3; });
    await page.waitForTimeout(1400); await shot('06-hose');
    await G(() => { window.__game.jobs._autoSpray = false; window.__game.day._miniFinish(true); });
    await page.waitForFunction(() => window.__game.day.step?.id === 'f-back', null, { timeout: 10000 });
    await page.waitForTimeout(600); await shot('06b-fire-out');
    await G(() => { const g = window.__game; g.jobs.board('truck'); const e = g.places.entrance('civic-fire'); g.vehicle.park(e.x - 3, e.z + 4, Math.PI); });
    await page.waitForTimeout(400);
    await goTo('civic-fire');
    await page.waitForFunction(() => window.__game.day.step?.id === 'f-check' && !window.__game.jobs.ride, null, { timeout: 10000 });
    await act('civic-fire:gearRack', '07-gear-check');
  },
  async doctor() {
    await goTo('shop-hospital', -1); await expect('d-gown');
    await stand('shop-hospital:coatRack', 1.5); await shot('01-coat');
    await act('shop-hospital:coatRack'); await expect('d-patient');
    await act('shop-hospital:doctor', '02-patient'); await expect('d-xray');
    await act('shop-hospital:xray', '03-xray'); await expect('d-shot');
    await act('shop-hospital:shot', '04-shot');
  },
  async chef() {
    await goTo('civic-pizza', -1); await expect('c-apron');
    await stand('civic-pizza:chefHook', 1.4); await shot('01-hook');
    await act('civic-pizza:chefHook'); await expect('c-pizza');
    assert.equal(await G(() => window.__game.state.outfit), 'chef');
    await act('civic-pizza:pizzaOven', '02-pizza'); await expect('c-serve');
    await act('civic-pizza:pizzaTable');
  },
  async mart() {
    await goTo('civic-mart', -2); await expect('m-vest');
    await stand('civic-mart:martLocker', 1.6); await shot('01-locker');
    await act('civic-mart:martLocker'); await expect('m-stock');
    await act('civic-mart:stock', '02-stock'); await expect('m-cashier');
    await act('civic-mart:register', '03-cashier'); await expect('m-cart');
    await goTo('civic-mart', 9); await shot('04-carts');
    for (let i = 0; i < 4; i++) await act('job:cart');
  },
  async post() {
    await goTo('civic-post', -1); await expect('po-uniform');
    await stand('civic-post:postLocker', 1.6); await shot('01-locker');
    await act('civic-post:postLocker'); await expect('po-sort');
    await act('civic-post:sortRack', '02-sort'); await expect('po-deliver');
    await G(() => { const g = window.__game; const it = g.places.interactables.find((i) => i.key === 'job:mailbox'); g.player.place(it.wpos.x + 1.6, 0.3, it.wpos.z - 2.2, Math.atan2(1.6, -2.2)); });
    await page.waitForTimeout(1500); await shot('03-mailbox');
    for (let i = 0; i < 3; i++) await act('job:mailbox');
  },
};

await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
for (const j of Object.keys(DAYS).filter((k) => !only.length || only.includes(k))) {
  // back to the start screen, then pick the job (a new game)
  if (job) { await page.reload(); await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 }); }
  job = j;
  if (await G(() => !document.getElementById('new-game').classList.contains('hidden'))) await page.click('#new-game');
  await Promise.all([page.waitForEvent('load'), page.click(`#m-job-${j}`)]);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  await page.waitForTimeout(800);
  assert.deepEqual(await G(() => [window.__game.state.mode, window.__game.state.job, window.__game.kind()]), ['job', j, 'job']);
  const money0 = await G(() => window.__game.state.money);
  await morning();
  await DAYS[j]();
  await evening(money0);
  console.log(`job ${j} ok`);
}

const fatal = errors.filter((e) => !/favicon|toNonIndexed/.test(e));
assert.deepEqual(fatal, [], 'no page errors');
console.log('job check ok:', out);
await browser.close();
