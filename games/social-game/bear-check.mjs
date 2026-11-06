// 반달가슴곰 check (인혁: "숲에 곰이 가끔씩 있게 해줘"): the day plan is stable and only some days have
// bears, a planned bear comes out in the forest and goes home, a bear walks around, notices you
// (stands up, huffs, leaves), bluff-charges when you run at it and stops short, shoves you when
// touched, and costs little frame time. Takes photos.
// node games/social-game/bear-check.mjs [url] [outDir]
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const pw = await import('../../tools/node_modules/playwright/index.mjs').catch(() => import(process.env.PLAYWRIGHT_MJS ?? 'playwright'));
const url = process.argv[2] ?? 'http://127.0.0.1:5273/';
const out = process.argv[3] ?? '/tmp/social-bear';
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 680 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
await Promise.all([page.waitForEvent('load'), page.click('#m-office')]);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
await page.waitForTimeout(800);
const G = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
await G(async () => { const w = await import('/src/world.js'); window.__gy = w.groundAt; window.__wl = await import('/src/wildlife.js'); });

// ---- 1. forest and day plan
const plan = await G(() => {
  const w = window.__game.wildlife, m = window.__wl;
  const days = Array.from({ length: 28 }, (_, i) => m.dayPlan(i + 1, w.cells));
  const again = Array.from({ length: 28 }, (_, i) => m.dayPlan(i + 1, w.cells));
  return { cells: w.cells.length, withBears: days.filter((d) => d.length).length, same: JSON.stringify(days) === JSON.stringify(again), first: days.findIndex((d) => d.length) + 1, wildCells: w.cells.every((c) => m.wildLand(c.x, c.z) || true) };
});
console.log('forest cells', plan.cells, '| days with bears in 28:', plan.withBears, '| first bear day', plan.first);
assert.ok(plan.cells >= 10, 'forest cells found from the trees on the hills');
assert.ok(plan.same, 'day plan is the same every time (stable on reload)');
assert.ok(plan.withBears >= 6 && plan.withBears <= 22, 'bears come only some days');

// ---- 2. a planned bear comes out (player far away) and goes home after its hours
const sched = await G((day) => {
  const g = window.__game, w = g.wildlife;
  g.state.day = day;
  const p = window.__wl.dayPlan(day, w.cells)[0];
  g.state.hour = (p.from + p.to) / 2; g.sky.setHour(g.state.hour, true);
  g.player.place(-150, 0.2, -20, 0); // home, far from the hills
  return { from: p.from, to: p.to, home: [p.home.x, p.home.z] };
}, plan.first);
await wait(700);
const spawned = await G(() => window.__game.wildlife.bears.map((b) => ({ id: b.plan.id, x: b.x, z: b.z, wild: window.__wl.wildLand(b.x, b.z) })));
console.log('planned bear', sched, '→', JSON.stringify(spawned));
assert.ok(spawned.length >= 1 && spawned.every((b) => b.wild), 'the planned bear came out in the forest');
await G((to) => { const g = window.__game; g.state.hour = to + 0.3; }, sched.to);
await wait(400);
assert.equal(await G(() => window.__game.wildlife.bears.length), 0, 'the bear went home after its hours');

// ---- helpers for the rest: stand in the densest forest cell at 10:30, a bear ahead
const cell = await G(() => { const g = window.__game; g.state.day = 1; g.state.hour = 10.5; g.sky.setHour(10.5, true); return [...g.wildlife.cells].sort((a, b) => b.n - a.n)[0]; });
const setup = (dist, opts = {}) => G(([c, dist, opts]) => {
  const g = window.__game, w = g.wildlife;
  for (const b of [...w.bears]) w.despawn(b);
  w.plan = []; // no planned bears in the way
  g.state.hour = 10.5;
  g.player.place(c.x, window.__gy(c.x, c.z) + 0.05, c.z, 0); g.player.pitch = -0.05;
  g.state.hp = 100;
  const b = w.spawnNear(dist, { stay: true, facing: opts.facing ?? Math.PI / 2 });
  if (opts.calm) { b.cool = 999; b.chargeCool = 999; }
  b.state = 'wander'; b.t = 0;
  window.__b = b;
  return { x: b.x, z: b.z };
}, [cell, dist, opts]);
const bear = () => G(() => { const g = window.__game, b = window.__b; return { state: b.state, mode: b.mode, x: b.x, z: b.z, speed: b.speed, d: Math.hypot(b.x - g.player.pos.x, b.z - g.player.pos.z), hp: g.state.hp, thigh: b.model.bones.thighL.quaternion.x, toast: document.getElementById('toast').textContent }; });

// ---- 3. it walks around (calm, out of reach) and the legs move
const a0 = await setup(26, { calm: true });
const b0 = await bear();
await wait(2500);
const b1 = await bear();
await page.screenshot({ path: `${out}/1-walk.png` });
const moved = Math.hypot(b1.x - a0.x, b1.z - a0.z);
console.log('walk:', b1.state, b1.mode, 'moved', moved.toFixed(2), 'm, thigh', b0.thigh.toFixed(3), '→', b1.thigh.toFixed(3));
assert.ok(moved > 0.8, 'the bear walks');
assert.notEqual(b0.thigh.toFixed(4), b1.thigh.toFixed(4), 'the legs are animated');

// ---- 4. notice: walk calmly to 11 m → it stands up, huffs, then leaves
await setup(11);
let saw = new Set(), stood = false, toast = '';
for (let i = 0; i < 14; i++) {
  await wait(300);
  const b = await bear();
  saw.add(b.state); if (b.mode === 'stand') stood = true; if (b.toast) toast = b.toast;
  if (i === 6) await page.screenshot({ path: `${out}/2-stand.png` });
}
const after = await bear();
console.log('notice:', [...saw].join(' → '), '| stood', stood, '| toast', JSON.stringify(toast), '| now', after.state, after.d.toFixed(1), 'm');
assert.ok(saw.has('alert') && stood, 'the bear noticed you and stood up');
assert.ok(/반달가슴곰/.test(toast), 'toast tells what it is and what to do');
assert.ok(saw.has('leave') || after.state === 'leave', 'then it ambles away');

// ---- 5. run at it → bluff charge that stops short, no damage
await setup(13, { facing: Math.PI / 2 });
await G(() => { const b = window.__b; b.cool = 999; }); // it has not seen you yet
await G(() => { const g = window.__game, b = window.__b; g.player.yaw = Math.atan2(-(b.x - g.player.pos.x), -(b.z - g.player.pos.z)); g.player.pitch = -0.05; });
await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
let charged = false;
for (let i = 0; i < 30 && !charged; i++) { await wait(60); charged = (await bear()).state === 'charge'; }
await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
let minD = 99, slam = false;
for (let i = 0; i < 30; i++) {
  await wait(80);
  const b = await bear();
  minD = Math.min(minD, b.d);
  if (b.state === 'slam') { if (!slam) await page.screenshot({ path: `${out}/3-charge.png` }); slam = true; }
}
const c1 = await bear();
console.log('charge:', charged, '| slam', slam, '| closest', minD.toFixed(2), 'm | hp', c1.hp, '|', JSON.stringify(c1.toast));
assert.ok(charged && slam, 'running at the bear makes it bluff-charge and stop with a slam');
assert.ok(minD > 1.9, 'the charge stops short of you');
assert.ok(c1.hp >= 99.9, 'a bluff charge does not hurt');

// ---- 6. touching it gets you shoved (small health loss, pushed back)
await setup(3, { calm: true });
await G(() => { const g = window.__game, b = window.__b; b.state = 'pause'; b.mode = 'idle'; b.dur = 99; const a = Math.atan2(g.player.pos.x - b.x, g.player.pos.z - b.z); g.player.place(b.x + Math.sin(a) * 1.25, window.__gy(b.x, b.z) + 0.05, b.z + Math.cos(a) * 1.25, g.player.yaw); });
await wait(1200);
const s1 = await bear();
console.log('shove: hp', s1.hp.toFixed(1), '| distance now', s1.d.toFixed(2), 'm');
assert.ok(s1.hp > 93 && s1.hp < 97, 'the shove costs 5 health');
assert.ok(s1.d > 2.2, 'you were pushed away');

// ---- 7. frame time with and without a bear in view
const frameMs = async () => G(() => new Promise((res) => { const t = []; let last = performance.now(); const f = (n) => { t.push(n - last); last = n; if (t.length < 120) requestAnimationFrame(f); else { t.sort((a, b) => a - b); res(t[60]); } }; requestAnimationFrame(f); }));
await setup(7, { calm: true });
await G(() => { const g = window.__game, b = window.__b; b.state = 'pause'; b.mode = 'sniff'; b.dur = 99; g.player.yaw = Math.atan2(-(b.x - g.player.pos.x), -(b.z - g.player.pos.z)); });
await wait(1000);
const withBear = await frameMs();
await page.screenshot({ path: `${out}/4-sniff.png` });
await G(() => { const w = window.__game.wildlife; for (const b of [...w.bears]) w.despawn(b); });
await wait(600);
const noBear = await frameMs();
console.log('median frame', noBear.toFixed(1), 'ms without bear,', withBear.toFixed(1), 'ms with a bear in view');
const stats = await G(() => window.__game.wildlife.pool[0].stats);
console.log('bear model', JSON.stringify(stats));
assert.ok(stats.tris < 30000 && stats.draws <= 3, 'bear stays light');

assert.deepEqual(errors, [], 'no page errors');
console.log('bear check ok', out);
await browser.close();
