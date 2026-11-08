// 곤충 채집 check (인혁이 계획: "곤충을 채집할 수 있게 해줘."): insects come out by themselves around you
// (by place and hour), every species has a model, B takes out the net (blocks are off), a left-click swing
// catches insects in front of you, the 곤충 도감 counts them, the 도감 survives a save and reload, and the
// insects cost little frame time. Takes close-up photos of every insect and of the 도감.
// node games/social-game/bug-check.mjs [url] [outDir]
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const pw = await import('../../tools/node_modules/playwright/index.mjs').catch(() => import(process.env.PLAYWRIGHT_MJS ?? 'playwright'));
const url = process.argv[2] ?? 'http://127.0.0.1:5281/';
const out = process.argv[3] ?? '/tmp/social-bugs';
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
await G(async () => { const w = await import('/src/world.js'); window.__gy = w.groundAt; window.__bugs = await import('/bugs.mjs'); });
assert.ok(await G(() => !!window.__game.insects), 'the insect module is running');

// ---- 1. every species has a model and a picture
const models = await G(async () => { const m = await import('/src/props/insects.js'); return { ids: m.MODEL_IDS, species: window.__bugs.SPECIES.map((s) => s.id) }; });
assert.deepEqual([...models.ids].sort(), [...models.species].sort(), 'a model for every species in the table');

// ---- 2. they come out by themselves: a garden with flowers and grass at 11:00
const spot = await G(() => {
  const ins = window.__game.insects;
  let best = null, bs = -1;
  for (const [k, c] of ins.grid) {
    const [i, j] = k.split(',').map(Number), x = (i + 0.5) * 8, z = (j + 0.5) * 8;
    if (Math.abs(x) > 260 || Math.abs(z) > 120) continue;
    const s = c.flower.length * 3 + c.bush.length + Math.min(c.grass, 40) / 10;
    if (s > bs) { bs = s; best = { x, z }; }
  }
  return best;
});
const goTo = (x, z, hour, yaw = 0) => G(([x, z, hour, yaw]) => {
  const g = window.__game;
  g.state.hour = hour; g.sky.setHour(hour, true);
  g.player.place(x, window.__gy(x, z) + 0.05, z, yaw); g.player.pitch = -0.2;
  g.player.input.locked = true;
}, [x, z, hour, yaw]);
await goTo(spot.x, spot.z, 11);
await wait(4500);
const natural = await G(() => { const ins = window.__game.insects, p = window.__game.player.pos; return ins.alive.map((b) => ({ id: b.sp.id, d: Math.hypot(b.x - p.x, b.z - p.z), st: b.st })); });
const kinds = [...new Set(natural.map((b) => b.id))];
console.log('garden at 11:00:', natural.length, 'insects:', kinds.join(', '));
await page.screenshot({ path: `${out}/1-garden.png` });
assert.ok(natural.length >= 4 && kinds.length >= 2, 'insects come out around you by themselves (several kinds)');
assert.ok(natural.every((b) => b.d < 40), 'only near the player');
assert.ok(!kinds.includes('firefly') && !kinds.includes('beetle') && !kinds.includes('stag'), 'no night insects at 11:00');

// ---- 3. at night: fireflies glow in the forest, beetles on the forest trees
const forest = await G(() => { const ins = window.__game.insects; let best = null, n = 0; for (const [k, c] of ins.grid) if (c.forest.length > n && Math.abs((Number(k.split(',')[0]) + 0.5) * 8) < 600) { n = c.forest.length; const [i, j] = k.split(',').map(Number); best = { x: (i + 0.5) * 8, z: (j + 0.5) * 8, n }; } return best; });
await G(() => { const ins = window.__game.insects; for (const b of [...ins.alive]) ins.despawn(b); });
await goTo(forest.x + 5, forest.z, 21.5);
await wait(5000);
const night = await G(() => { const ins = window.__game.insects; return { ids: ins.alive.map((b) => b.sp.id), glow: ins.glow.geometry.drawRange.count }; });
console.log('forest at 21:30:', night.ids.length, 'insects:', [...new Set(night.ids)].join(', '), '| glowing', night.glow);
await G(() => { window.__game.player.pitch = 0.05; });
await wait(300);
await page.screenshot({ path: `${out}/2-fireflies.png` });
assert.ok(night.ids.includes('firefly') && night.glow > 0, 'fireflies glow at night');
assert.ok(!night.ids.some((id) => ['swallowtail', 'cabbage', 'cicada', 'grasshopper'].includes(id)), 'day insects are not out at night');

// ---- 4. close-up photos of every insect where it lives
await G(() => { const ins = window.__game.insects; for (const b of [...ins.alive]) ins.despawn(b); });
const photo = async (id, hour) => {
  const info = await G(([id, hour, spot]) => {
    const g = window.__game, ins = g.insects;
    g.state.hour = hour; g.sky.setHour(hour, true);
    for (const b of [...ins.alive]) ins.despawn(b);
    ins.spawnT = 99; // nothing else comes out during the photo
    const sp = window.__bugs.BY_ID[id];
    let b = null;
    if (['flower', 'bush', 'tree', 'forest'].some((h) => sp.habitats[h])) b = ins.showcase(id, { x: spot.x, z: spot.z });
    if (!b) { g.player.place(spot.x, window.__gy(spot.x, spot.z) + 0.05, spot.z, 0.4); g.player.pitch = -0.3; b = ins.spawnNear(id, 2.2, { dy: -0.8 }); }
    if (!b) return null;
    if (sp.move === 'flutter') b.k = 1; // basking, wings half open
    // stand next to it and look at it closely from the side and a bit above (test camera via day.seat)
    const n = b.n.clone(), up = Math.abs(n.y) > 0.8 ? new g.engine.camera.position.constructor(1, 0, 0) : new g.engine.camera.position.constructor(0, 1, 0);
    const side = new g.engine.camera.position.constructor().crossVectors(n, up).normalize();
    const dir = n.clone().multiplyScalar(0.75).addScaledVector(side, 0.55).addScaledVector(up, 0.35).normalize();
    if (b.st === 'fly' || n.y > 0.9) dir.set(0.62, 0.5, 0.6).normalize(); // in the air or on flat ground: from the side and above
    const dist = Math.max(0.1, sp.size * (sp.id === 'firefly' ? 4 : sp.move === 'flutter' ? 2.9 : 2.2));
    const cam = new g.engine.camera.position.constructor(b.x, b.y + sp.size * 0.15, b.z).addScaledVector(dir, dist);
    g.player.place(b.x + dir.x * 1.5, window.__gy(b.x + dir.x * 1.5, b.z + dir.z * 1.5) + 0.05, b.z + dir.z * 1.5, 0);
    const v = { x: b.x - cam.x, y: b.y + sp.size * 0.15 - cam.y, z: b.z - cam.z }, l = Math.hypot(v.x, v.y, v.z);
    g.day.seat = { it: { seatW: { pos: cam, yaw: Math.atan2(-v.x, -v.z), pitch: Math.asin(v.y / l) } }, t: 1, from: cam.clone(), fromQ: g.engine.camera.quaternion.clone() };
    document.getElementById('hud').style.visibility = 'hidden';
    if (g.player.arm) g.player.arm.group.visible = false;
    return { id, st: b.st, at: [b.x, b.y, b.z].map((a) => +a.toFixed(2)), n: [n.x, n.y, n.z].map((a) => +a.toFixed(2)) };
  }, [id, hour, spot]);
  await wait(700);
  await page.screenshot({ path: `${out}/3-${id}.png` });
  await G(() => { const g = window.__game; g.day.seat = null; document.getElementById('hud').style.visibility = ''; g.insects.spawnT = 0; if (g.player.arm) g.player.arm.group.visible = true; });
  return info;
};
const night2 = { beetle: 19.1, stag: 19.1, firefly: 20.3 }; // beetles come out at dusk
for (const sp of models.species) {
  const info = await photo(sp, night2[sp] ?? 11);
  console.log('photo', sp, JSON.stringify(info));
  assert.ok(info, `${sp} could be placed for a photo`);
}

// ---- 5. take the net, swing, catch three species
await G(() => { const ins = window.__game.insects; for (const b of [...ins.alive]) ins.despawn(b); ins.spawnT = 99; });
await goTo(spot.x, spot.z, 11);
await page.keyboard.press('b');
await wait(400);
const held = await G(() => ({ holding: window.__game.insects.holding, build: window.__game.build.enabled, held: window.__game.player._held }));
await page.screenshot({ path: `${out}/4-net.png` });
assert.ok(held.holding && held.held === 'net', 'B takes the net into the hand');
assert.equal(held.build, false, 'blocks are not broken while the net is in the hand');
await G(() => { window.__toasts = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) window.__toasts.push(n.textContent); }).observe(document.getElementById('toast'), { childList: true }); });
const catchOne = async (id, dist, dy) => {
  const before = await G((id) => { window.__toasts = []; return window.__game.state.bugs.c[id] ?? 0; }, id);
  await G(([id, dist, dy]) => {
    const g = window.__game, b = g.insects.spawnNear(id, dist, { dy });
    const e = g.player.pos.y + 1.62, dx = b.x - g.player.pos.x, dz = b.z - g.player.pos.z;
    g.player.yaw = Math.atan2(-dx, -dz); g.player.pitch = Math.atan2(b.y - e, Math.hypot(dx, dz));
    g.player.input.locked = true;
  }, [id, dist, dy]);
  await wait(150);
  await page.mouse.move(550, 340);
  await page.mouse.down(); await wait(60); await page.mouse.up();
  await wait(220);
  if (id === 'swallowtail') await page.screenshot({ path: `${out}/5-swing.png` });
  await wait(500);
  const after = await G((id) => ({ n: window.__game.state.bugs.c[id] ?? 0, toast: window.__toasts.join(' | ') }), id);
  console.log('catch', id, before, '→', after.n, JSON.stringify(after.toast.slice(-40)));
  assert.equal(after.n, before + 1, `${id} caught with the net`);
  assert.ok(/잡았다/.test(after.toast), 'toast says it was caught');
};
await catchOne('swallowtail', 1.8, -0.2);
await catchOne('grasshopper', 2.0, -1.4);
await catchOne('ladybug', 1.4, -0.6);
await catchOne('dragonfly', 2.2, 0.1);
await catchOne('swallowtail', 1.6, 0);
// a miss: nothing in front
const miss = await G(() => JSON.stringify(window.__game.state.bugs.c));
await G(() => { window.__game.player.yaw += 1.5; });
await page.mouse.down(); await wait(60); await page.mouse.up(); await wait(700);
assert.equal(await G(() => JSON.stringify(window.__game.state.bugs.c)), miss, 'a swing at nothing catches nothing');

// ---- 6. the 도감
await page.keyboard.press('k');
await wait(900);
const book = await G(() => ({ open: !document.getElementById('bugbook').classList.contains('hidden'), cards: document.querySelectorAll('#bugbook .bcard').length, known: document.querySelectorAll('#bugbook .bcard:not(.unknown)').length, head: document.querySelector('#bugbook h2').textContent, swallow: document.querySelector('#bugbook .bcard[data-id="swallowtail"] .n')?.textContent }));
console.log('도감:', JSON.stringify(book));
await page.screenshot({ path: `${out}/6-book.png` });
assert.ok(book.open, 'K opens the 곤충 도감');
assert.equal(book.cards, models.species.length, 'a card for every species');
assert.equal(book.known, 4, 'four species found');
assert.equal(book.swallow, '×2', 'two swallowtails counted');
assert.ok(/4 \/ 13/.test(book.head), 'header shows found / all');
// let one swallowtail go
await page.click('#bugbook button.rel[data-id="swallowtail"]');
await wait(300);
assert.equal(await G(() => window.__game.state.bugs.c.swallowtail), 1, 'releasing lets one go');
await page.click('#bugbook-x');
await wait(200);

// ---- 7. blocks still work once the net is put away
await page.keyboard.press('1');
await wait(300);
const blocks = await G(() => ({ holding: window.__game.insects.holding, build: window.__game.build.enabled, held: window.__game.player._held }));
assert.ok(!blocks.holding && blocks.build && blocks.held === 'stone', 'picking a block puts the net away and blocks work again');

// ---- 8. it is saved (also in what the cloud save sends) and survives a reload
const saved = await G(async () => {
  const core = await import('/core.mjs');
  window.dispatchEvent(new Event('beforeunload'));
  const s = JSON.parse(localStorage.getItem('social-game-save-v1'));
  return { local: s.bugs, cloud: JSON.parse(core.serialize(window.__game.state)).bugs };
});
console.log('saved 도감:', JSON.stringify(saved.local));
assert.deepEqual(saved.local.c, { swallowtail: 1, grasshopper: 1, ladybug: 1, dragonfly: 1 }, 'the 도감 is in the save');
assert.deepEqual(saved.cloud.c, saved.local.c, 'and in the state the cloud save sends');
await page.reload();
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
await wait(500);
const reloaded = await G(() => ({ c: window.__game.state.bugs.c, seen: Object.keys(window.__game.state.bugs.seen).length }));
console.log('after reload:', JSON.stringify(reloaded));
assert.deepEqual(reloaded.c, saved.local.c, 'counts survive a reload');
assert.equal(reloaded.seen, 4, 'found species survive a reload');

// ---- 9. frame cost
await page.click('#play');
await wait(600);
await G(async () => { const w = await import('/src/world.js'); window.__gy = w.groundAt; });
await goTo(spot.x, spot.z, 11);
await wait(4000);
const cost = await G(() => {
  const ins = window.__game.insects, t0 = performance.now();
  for (let i = 0; i < 300; i++) ins.update(0.016);
  return { ms: (performance.now() - t0) / 300, alive: ins.alive.length };
});
console.log('insects.update:', cost.ms.toFixed(3), 'ms per frame with', cost.alive, 'insects');
assert.ok(cost.ms < 0.6, 'insects cost little frame time');

console.log('page errors:', errors.length ? errors : 'none');
assert.equal(errors.length, 0, 'no page errors');
await browser.close();
console.log('bug-check OK →', out);
