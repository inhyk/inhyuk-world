// Edge of the land check (인혁 계획 6: "언덕 같은 데 계속 가면 나무도 없고 땅도 없어져. 나무랑 땅이 보이게 해 줘").
// Runs to the fence in four directions (north, east and south over the hills, west into the sea) and
// on the Japan island, and checks: the fence stops you, there is drawn ground under you and all around
// out to the fog, trees are drawn near you, the land is wooded past the fence, a jump out of the world
// (teleport far away) lands you back inside on the ground, and the car stops at the fence too.
// Takes a photo at each fence.
// node games/social-game/edge-check.mjs [url] [outDir]
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const pw = await import('../../tools/node_modules/playwright/index.mjs').catch(() => import(process.env.PLAYWRIGHT_MJS ?? 'playwright'));
const url = process.argv[2] ?? 'http://127.0.0.1:5273/';
const out = process.argv[3] ?? '/tmp/social-edge';
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
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
await G(async () => {
  const w = await import('/src/world.js');
  window.__w = w;
  const g = window.__game;
  // a raycaster from the same three.js the game uses: the dev server rewrites 'three' to a file URL
  const src = await (await fetch('/src/world.js')).text();
  const three = src.match(/from\s+["']([^"']*three[^"']*)["']/)?.[1];
  window.__T = three ? await import(three) : null;
  g.engine.updaters.add(() => { g.state.hour = 13; g.state.hp = 100; g.state.food = 100; });
  g.sky.setHour(13, true);
});
assert.ok(await G(() => !!window.__T?.Raycaster), 'three.js raycaster available');

/** What is around the player right now. */
const look = () => G(() => {
  const g = window.__game, w = window.__w, T = window.__T, p = g.player.pos;
  const E = w.edgeOf(p.x);
  const ground = g.engine.scene.getObjectByName('world').children.filter((m) => m.name?.startsWith('ground-') && m.visible);
  const rc = new T.Raycaster();
  const down = (x, z) => { rc.set(new T.Vector3(x, 900, z), new T.Vector3(0, -1, 0)); rc.far = 2000; const h = rc.intersectObjects(ground, false)[0]; return h ? h.point.y : null; };
  const under = down(p.x, p.z);
  // drawn ground all around: 8 directions at 30, 120, 350 and 700 m (or the sea: lower than the sea is fine)
  let rays = 0, holes = [];
  for (let a = 0; a < 8; a++) for (const r of [30, 120, 350, 700]) {
    const x = p.x + Math.cos(a * Math.PI / 4) * r, z = p.z + Math.sin(a * Math.PI / 4) * r;
    const y = down(x, z);
    rays++;
    if (y == null && w.groundAt(x, z) > w.LAYOUT.seaY - 0.2) holes.push([Math.round(x), Math.round(z)]);
  }
  // trees drawn near you (the detailed or the far copy of each one), from every scatter that has trees
  let near = 0, near150 = 0;
  for (const s of g.deco.scatters) {
    if (!s.far) continue;
    for (const it of s.items) {
      const d = Math.hypot(it.x - p.x, it.z - p.z);
      if (d > 150 || !it.visible || !it.chunk) continue;
      const drawn = it.near ? it.slot >= 0 && it.slot < it.chunk.nearCount && it.chunk.near[0]?.visible : !!it.chunk.farShow;
      if (!drawn) continue;
      near150++;
      if (d < 60) near++;
    }
  }
  // mountain forest past the fence (static blocks), within 400 m
  let forest = 0;
  const root = g.engine.scene.getObjectByName(E === w.EDGE.home ? 'edge-home' : 'edge-japan');
  const m = new T.Matrix4(), v = new T.Vector3();
  root?.traverse((o) => {
    if (o.name !== 'mountain-forest' || !root.visible) return;
    for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); v.setFromMatrixPosition(m); if (Math.hypot(v.x - p.x, v.z - p.z) < 400) forest++; }
  });
  return { x: +p.x.toFixed(1), z: +p.z.toFixed(1), y: +p.y.toFixed(2), gy: +w.groundAt(p.x, p.z).toFixed(2), under: under == null ? null : +under.toFixed(2), out: +w.landOut(E, p.x, p.z).toFixed(2), play: E.play, sea: E.sea, rays, holes, near, near150, forest, edgeVisible: !!root?.visible };
});

/** Stand at (x, z) facing yaw, run forward until the fence (or the sea limit) stops you, keep pushing `secs` more. */
async function run(x, z, yaw, secs) {
  await G(([x, z, yaw]) => {
    const g = window.__game;
    g.player.place(x, window.__w.groundAt(x, z) + 0.1, z, yaw); g.player.pitch = -0.05; g.player.fallStart = null;
  }, [x, z, yaw]);
  await wait(400);
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
  await page.waitForFunction(() => {
    const w = window.__w, p = window.__game.player.pos, E = w.edgeOf(p.x);
    return w.landOut(E, p.x, p.z) > E.play - 1.2 || (E.open === 'w' && p.x < E.sea + 1.2);
  }, null, { timeout: 90000, polling: 200 }).catch(() => {});
  await wait(secs * 1000);
  await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  await wait(300);
}

// yaw 0 faces -z (north), PI/2 faces -x (west)
const RUNS = [
  { name: 'north', x: -40, z: -395, yaw: 0, secs: 1.5 },
  { name: 'east', x: 625, z: 20, yaw: -Math.PI / 2, secs: 1.5 },
  { name: 'south', x: 20, z: 520, yaw: Math.PI, secs: 1.5 },
  { name: 'northeast', x: 500, z: -260, yaw: -Math.PI / 4, secs: 1.5 },
  { name: 'west-sea', x: -370, z: 30, yaw: Math.PI / 2, secs: 1.5 },
  { name: 'japan-north', x: 2200, z: -240, yaw: 0, secs: 1.5 },
  { name: 'japan-west', x: 1870, z: -20, yaw: Math.PI / 2, secs: 1.5 },
];
for (const r of RUNS) {
  await run(r.x, r.z, r.yaw, r.secs);
  const s = await look();
  console.log(r.name.padEnd(12), JSON.stringify(s));
  const sea = r.name === 'west-sea';
  assert.ok(s.out <= s.play + 0.01, `${r.name}: the fence stopped you (${s.out} m out, fence at ${s.play})`);
  if (sea) assert.ok(s.x >= s.sea - 0.01, `${r.name}: stopped at the sea limit`);
  else assert.ok(s.out > s.play - 3, `${r.name}: you really got to the fence (${s.out} of ${s.play})`);
  assert.ok(s.under != null && Math.abs(s.under - s.gy) < 0.6, `${r.name}: drawn ground right under you (${s.under} vs ${s.gy})`);
  assert.ok(Math.abs(s.y - s.gy) < 0.6, `${r.name}: standing on the ground, not falling (${s.y} vs ${s.gy})`);
  assert.equal(s.holes.length, 0, `${r.name}: no hole in the ground around you: ${JSON.stringify(s.holes)}`);
  if (!sea) {
    assert.ok(s.near >= 4, `${r.name}: trees drawn within 60 m (${s.near})`);
    assert.ok(s.forest >= 40, `${r.name}: a forest on the mountains past the fence (${s.forest})`);
  }
  // photo a few steps back from the fence, looking out
  await G(([yaw]) => {
    const g = window.__game, p = g.player.pos;
    g.player.place(p.x + Math.sin(yaw) * 7, p.y + 0.3, p.z + Math.cos(yaw) * 7, yaw); g.player.pitch = -0.06; g.player.fallStart = null;
  }, [r.yaw]);
  await wait(900);
  await page.screenshot({ path: `${out}/${r.name}.png` });
}

// jump out of the world: you land back inside, on the ground
for (const [x, z] of [[-40, -2500], [3000, 0], [-2000, 300], [2200, -1500], [2200, 900]]) {
  await G(([x, z]) => { const g = window.__game; g.player.place(x, 40, z, 0); g.player.fallStart = null; }, [x, z]);
  await wait(300);
  await page.waitForFunction(() => window.__game.player.onGround, null, { timeout: 60000, polling: 200 });
  await wait(300);
  const s = await look();
  console.log('teleport', x, z, '→', JSON.stringify({ x: s.x, z: s.z, y: s.y, gy: s.gy, out: s.out }));
  assert.ok(s.out <= s.play + 0.01, `teleport (${x}, ${z}): pulled back inside the fence`);
  assert.ok(s.under != null && Math.abs(s.y - s.gy) < 0.8, `teleport (${x}, ${z}): back on drawn ground`);
}

// the car: full speed into the east fence, it stays inside
const car = await G(async () => {
  const g = window.__game, v = g.vehicle, w = window.__w;
  if (!v) return null;
  v.park(600, 30, -Math.PI / 2);
  let maxOut = 0;
  const push = () => { v.speed = 24; v.update(1 / 60, null); maxOut = Math.max(maxOut, w.landOut(w.EDGE.home, v.pos.x, v.pos.z)); };
  for (let i = 0; i < 240; i++) push();
  const res = { maxOut, x: v.pos.x, play: w.EDGE.home.play, half: v.half.l };
  v.park(-140.7, -17.5, Math.PI);
  return res;
});
console.log('car', JSON.stringify(car));
if (car) assert.ok(car.maxOut <= car.play - car.half + 0.01, 'the car stops before the fence');

assert.deepEqual(errors, [], 'no page errors');
console.log('edge check passed', out);
await browser.close();
