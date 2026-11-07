// 같이 타기 (riding in a friend's car) in 같이 사는 동네, against a LOCAL net server (never the real one):
//   (cd services/net && ST=$(mktemp -d) && CI=1 npx wrangler d1 migrations apply net --local --persist-to "$ST" && CI=1 npx wrangler dev --port 8787 --ip 127.0.0.1 --persist-to "$ST")
//   npx vite --config games/social-game/vite.config.js --host 127.0.0.1 --port 5276 --strictPort
//   node games/social-game/ride-check.mjs http://127.0.0.1:5276/ [outDir] [netUrl]
// A drives, B asks with E and gets the front seat, A drives ~100 m (B's camera rides along inside the car),
// B gets out with E, B gets in again and A gets out: B is put out too. Screenshots from both sides.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const pw = await import('../../tools/node_modules/playwright/index.mjs').catch(() => import(process.env.PLAYWRIGHT_MJS ?? 'playwright'));
const base = process.argv[2] ?? 'http://127.0.0.1:5276/';
const out = process.argv[3] ?? '/tmp/social-ride';
const net = process.argv[4] ?? 'http://127.0.0.1:8787';
assert.match(net, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/, 'local net server only');
mkdirSync(out, { recursive: true });
const url = `${base}${base.includes('?') ? '&' : '?'}net=${net}`;
const tag = Math.random().toString(36).slice(2, 7);
const browser = await pw.chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const G = (c, f, a) => c.page.evaluate(f, a);
const until = (c, f, a, timeout = 20000) => c.page.waitForFunction(f, a, { timeout });
const shot = (c, name) => c.page.screenshot({ path: `${out}/${name}.png` });
const toasts = (c) => G(c, () => [...document.querySelectorAll('#toast div')].map((d) => d.textContent).join(' | '));
const toastHas = (c, text) => until(c, (t) => [...document.querySelectorAll('#toast div')].some((d) => d.textContent.includes(t)), text, 10000);

async function computer(name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  await Promise.all([page.waitForEvent('load', { timeout: 60000 }), page.click('#m-office')]);
  await page.waitForFunction(() => window.__ready === true && !!window.__game, null, { timeout: 180000 });
  await page.waitForFunction(() => document.getElementById('start').classList.contains('hidden'), null, { timeout: 20000 });
  const nick = `${name.toLowerCase()}${tag}`;
  await page.click('#btn-login');
  await page.fill('#nick', nick);
  await page.fill('#pw', 'abcd1234');
  await page.click('#do-signup');
  await page.waitForFunction(() => !document.getElementById('login-in').classList.contains('hidden'), null, { timeout: 20000 });
  await page.click('#login-close');
  await page.click('#btn-town');
  await page.waitForFunction(() => !document.getElementById('town-pick').classList.contains('hidden'));
  await page.click('#town-pick .town-ch[data-n="1"]');
  await page.waitForFunction(() => window.__game.town.live === true, null, { timeout: 20000 });
  // midday, so the screenshots are bright
  await page.evaluate(() => { window.__game.state.hour = 12; window.__game.sky.setHour(12, true); });
  return { ctx, page, errors, name, nick };
}
const pressE = async (c) => { await c.page.keyboard.press('e'); await c.page.waitForTimeout(150); };

const A = await computer('A');
const B = await computer('B');

// A's car on the second avenue, heading +x; A next to the driver's door, B at the passenger door
const X0 = -60, Z0 = 116.5;
await G(A, ([x, z]) => {
  const g = window.__game;
  g.state.license = true;
  g.vehicle.park(x, z, -Math.PI / 2);
  g.player.place(x, 0.3, z - 2.3, Math.PI);
}, [X0, Z0]);
await pressE(A);
await until(A, () => window.__game.vehicle.driving === true);
await G(B, ([x, z]) => window.__game.player.place(x + 0.3, 0.3, z + 2.4, 0), [X0, Z0]);
// B sees A's car, which takes riders, and the E prompt names A
await until(B, (nick) => [...window.__game.town.remotes.values()].some((r) => r.visible && r.user?.nickname === nick && r.target?.mode === 'drive' && Array.isArray(r.target.seats)), A.nick);
await until(B, (nick) => document.getElementById('prompt').textContent.includes(`같이 타기 (${nick} 님 차)`), A.nick);
await shot(B, '01-B-prompt');
await pressE(B);
await until(B, () => window.__game.town.riding === true);
const bNum = await G(B, () => window.__game.town.myNum);
await until(A, (n) => window.__game.town.seats[0] === n, bNum);
await toastHas(A, `${B.nick} 님이 탔어요`);
await toastHas(B, `${A.nick} 님 차에 탔어요`);
assert.equal(await G(B, () => window.__game.town.ride.seat), 0, 'front passenger seat first');
assert.equal(await G(B, () => window.__game.vehicle.driving), false, 'B does not drive');
const bCarParked = await G(B, () => window.__game.vehicle.pos.toArray());

// A sees B seated in A's car
await until(A, (nick) => [...window.__game.town.remotes.values()].some((r) => r.user?.nickname === nick && r.host?.mine && r.seat === 0), B.nick);
// WASD do nothing for the passenger
const before = await G(B, () => window.__game.player.pos.toArray());
await B.page.keyboard.down('w'); await B.page.waitForTimeout(600); await B.page.keyboard.up('w');
const afterW = await G(B, () => window.__game.player.pos.toArray());
assert.ok(Math.hypot(afterW[0] - before[0], afterW[2] - before[2]) < 0.3, 'W does not move the passenger');

// A drives ~100 m; B's camera stays inside the car all the way, and moves smoothly
await G(B, () => {
  const g = window.__game, t = g.town;
  window.__rideLog = [];
  const tick = () => {
    const d = t.remotes.get(t.ride?.pid);
    if (d && t.riding) {
      const c = g.engine.camera.position;
      if (d.track.at !== window.__rideLog.at(-1)?.t) window.__rideLog.push({ t: d.track.at ?? performance.now(), cx: c.x, cz: c.z, cy: c.y, x: d.pos.x, z: d.pos.z, y: d.pos.y, yaw: d.yaw, off: d.track.offset, n: d.track.list.length, last: d.track.list.at(-1)?.st ?? 0 });
    }
    if (window.__rideLog.length < 4000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const hpBefore = await G(B, () => window.__game.state.hp);
await A.page.keyboard.down('w');
await until(A, (x) => window.__game.vehicle.pos.x > x + 60, X0, 40000);
// passenger view while moving: looking a little left at the friend driving
await G(B, () => { window.__game.town.rideLook.yaw = 0.75; window.__game.town.rideLook.pitch = -0.12; });
await B.page.waitForTimeout(250);
await shot(B, '02-B-passenger-view-moving');
await until(A, (x) => window.__game.vehicle.pos.x > x + 100, X0, 40000);
await A.page.keyboard.up('w');
await A.page.keyboard.down('Space');
await until(A, () => Math.abs(window.__game.vehicle.speed) < 0.3, null, 20000);
await A.page.keyboard.up('Space');
await A.page.waitForTimeout(800);
const drive = await G(B, () => {
  const L = window.__rideLog;
  let inside = 0, maxOff = 0, back = 0, maxJump = 0;
  for (let i = 0; i < L.length; i++) {
    const p = L[i];
    const off = Math.hypot(p.cx - p.x, p.cz - p.z);
    maxOff = Math.max(maxOff, off);
    if (off < 1.6 && p.cy > p.y + 0.6 && p.cy < p.y + 1.4) inside++;
    if (i) {
      const dx = p.x - L[i - 1].x;
      if (dx < -0.01) back++;
      maxJump = Math.max(maxJump, Math.hypot(dx, p.z - L[i - 1].z));
    }
  }
  // smoothness while cruising: frame-to-frame speed changes
  const sp = [];
  for (let i = 1; i < L.length; i++) { const dt = (L[i].t - L[i - 1].t) / 1000; if (dt > 0.005) sp.push(Math.hypot(L[i].x - L[i - 1].x, L[i].z - L[i - 1].z) / dt); }
  const fast = sp.filter((v) => v > 8);
  let wobble = 0;
  for (let i = 1; i < fast.length; i++) wobble = Math.max(wobble, Math.abs(fast[i] - fast[i - 1]));
  const jumps = [];
  for (let i = 1; i < L.length; i++) { const j = Math.hypot(L[i].x - L[i - 1].x, L[i].z - L[i - 1].z); if (j > 1.2) jumps.push({ i, j: +j.toFixed(2), dt: +(L[i].t - L[i - 1].t).toFixed(1), off: [L[i - 1].off, L[i].off].map((v) => Math.round(v)), n: [L[i - 1].n, L[i].n], last: [L[i - 1].last, L[i].last] }); }
  return { jumps: jumps.slice(0, 8), frames: L.length, inside, maxOff, back, maxJump, moved: L.length ? Math.hypot(L.at(-1).x - L[0].x, L.at(-1).z - L[0].z) : 0, topSpeed: Math.max(0, ...sp), wobble, fps: L.length / ((L.at(-1).t - L[0].t) / 1000) };
});
console.log('drive', JSON.stringify(drive));
assert.ok(await G(B, () => window.__game.state.hp) >= hpBefore - 0.01, 'riding does not hurt');
assert.ok(drive.moved > 95, `B rode along ~100 m (${drive.moved.toFixed(1)} m)`);
assert.equal(drive.inside, drive.frames, `camera inside the car every frame (max ${drive.maxOff.toFixed(2)} m from the centre)`);
assert.equal(drive.back, 0, 'the car never jumped backwards');
const aCar = await G(A, () => window.__game.vehicle.pos.toArray());
const bSees = await G(B, () => { const t = window.__game.town, d = t.remotes.get(t.ride.pid); return d.pos.toArray(); });
assert.ok(Math.hypot(aCar[0] - bSees[0], aCar[2] - bSees[2]) < 1.5, 'B sees the car where A has it');
assert.deepEqual(await G(B, () => window.__game.vehicle.pos.toArray()), bCarParked, 'B\'s own car stayed parked');

// screenshots after the drive: passenger looking at the driver, outside (V) view, the driver looking at B
await G(B, () => { window.__game.town.rideLook.yaw = 0.95; window.__game.town.rideLook.pitch = -0.15; });
await B.page.waitForTimeout(300);
await shot(B, '03-B-passenger-looks-at-driver');
await B.page.keyboard.press('v');
await G(B, () => { window.__game.town.rideLook.yaw = -1.25; window.__game.town.rideLook.pitch = 0.05; });
await B.page.waitForTimeout(1200);
await shot(B, '04-B-outside-view-two-people');
await B.page.keyboard.press('v');
await G(A, () => { window.__game.player.input.mouse.dx = 560; }); // look right, at the passenger seat
await A.page.waitForTimeout(60);
await shot(A, '05-A-driver-sees-B');
await A.page.keyboard.press('v');
await A.page.waitForTimeout(900);
await shot(A, '06-A-chase-view');
await A.page.keyboard.press('v');

// B gets out with E: next to the car on the passenger side, on free ground
await pressE(B);
await until(B, () => !window.__game.town.ride);
await until(A, () => window.__game.town.seats.every((n) => n === 0));
await toastHas(A, `${B.nick} 님이 내렸어요`);
const outB = await G(B, () => window.__game.player.pos.toArray());
const carA = await G(A, () => ({ p: window.__game.vehicle.pos.toArray(), yaw: window.__game.vehicle.yaw }));
const dOut = Math.hypot(outB[0] - carA.p[0], outB[2] - carA.p[2]);
assert.ok(dOut > 1.3 && dOut < 4.5, `B stands next to the car (${dOut.toFixed(2)} m)`);
const rightSide = (outB[0] - carA.p[0]) * Math.cos(carA.yaw) - (outB[2] - carA.p[2]) * Math.sin(carA.yaw);
assert.ok(rightSide > 0, 'out on the passenger (right) side');
await B.page.waitForTimeout(500);
await shot(B, '07-B-got-out');

// B gets in again; A gets out: B is put out too
await G(B, () => { const p = window.__game.player; p.yaw = 0; });
await until(B, (nick) => document.getElementById('prompt').textContent.includes(`같이 타기 (${nick} 님 차)`), A.nick);
await pressE(B);
await until(B, () => window.__game.town.riding === true);
await until(A, (n) => window.__game.town.seats.includes(n), bNum);
await pressE(A);
await until(A, () => window.__game.vehicle.driving === false);
await until(B, () => !window.__game.town.ride, null, 10000);
await toastHas(B, `${A.nick} 님이 차에서 내려서 나도 내렸어요`);
const outB2 = await G(B, () => window.__game.player.pos.toArray());
assert.ok(Math.hypot(outB2[0] - carA.p[0], outB2[2] - carA.p[2]) < 4.5, 'put out next to the car');
assert.equal(await G(B, () => window.__game.player.avatar?.group.visible ?? false), false, 'first person again: own body hidden');
await B.page.waitForTimeout(600);
await shot(B, '08-B-put-out-when-A-got-out');

console.log('toasts A:', await toasts(A));
console.log('toasts B:', await toasts(B));
for (const c of [A, B]) assert.deepEqual(c.errors, [], `page errors on ${c.name}`);
console.log('ride check ok', A.nick, B.nick, out);
await browser.close();
