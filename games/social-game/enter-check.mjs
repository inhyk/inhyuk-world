// Walks into every building that has a lazy interior (인혁: "모든 건물에 들어 갈 수 있게 해줘"):
// stands at the entrance, waits for the interior, walks in with W and checks the player is inside.
// node games/social-game/enter-check.mjs [url] [outDir]
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const pw = await import('../../tools/node_modules/playwright/index.mjs').catch(() => import(process.env.PLAYWRIGHT_MJS ?? 'playwright'));
const url = process.argv[2] ?? 'http://127.0.0.1:5262/';
const out = process.argv[3] ?? '/tmp/social-enter';
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
await Promise.all([page.waitForEvent('load'), page.click('#m-office')]);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
await page.waitForTimeout(600);
const G = (fn, arg) => page.evaluate(fn, arg);

const keys = await G(() => window.__game.places.lazy.map((s) => s.key));
console.log('buildings with interiors:', keys.length, keys.join(' '));
assert.ok(keys.length >= 14, 'shops and civic buildings have interiors');
const results = [];
for (const key of keys) {
  // stand 3 m in front of the entrance, facing the building
  await G((k) => {
    const g = window.__game; const s = g.places.sites[k];
    const c = Math.cos(s.worldYaw), sn = Math.sin(s.worldYaw), d = s.footprint.d / 2 + 2.5;
    const door = s.doors[0]?.pivot ? new (g.player.pos.constructor)() : null;
    if (door) s.doors[0].pivot.getWorldPosition(door);
    const lx = door ? (door.x - s.worldPos[0]) * c - (door.z - s.worldPos[2]) * sn : 0; // door's local x
    g.state.hour = 15; g.sky.setHour(15, true);
    g.player.place(s.worldPos[0] + lx * c + d * sn, 0.25, s.worldPos[2] - lx * sn + d * c, s.worldYaw);
    g.player.pitch = -0.05;
  }, key);
  await page.waitForFunction((k) => !!window.__game.places.sites[k].interior, key, { timeout: 15000 }).catch(() => {});
  const built = await G((k) => !!window.__game.places.sites[k].interior, key);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(2600); await page.keyboard.up('KeyW');
  await page.waitForTimeout(400);
  const r = await G((k) => {
    const g = window.__game; const s = g.places.sites[k];
    return { inside: g.places.inside(g.player.pos), its: g.places.interactables.filter((i) => i.site === k).map((i) => i.id) };
  }, key);
  await page.screenshot({ path: `${out}/${key}.png` });
  results.push({ key, built, inside: r.inside === key, its: r.its });
  console.log(key, built ? 'built' : 'NOT BUILT', r.inside === key ? 'inside' : `outside (${r.inside})`, r.its.join(','));
}
const bad = results.filter((r) => !r.built || !r.inside);
assert.deepEqual(errors, [], 'no page errors');
assert.deepEqual(bad.map((r) => r.key), [], 'every building can be entered');
console.log('enter check ok', out);
await browser.close();
