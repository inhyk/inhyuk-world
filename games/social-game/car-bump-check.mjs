// 같이 사는 동네: friends' cars are solid and stay where they were parked, against a LOCAL net server only:
//   (cd services/net && ST=$(mktemp -d) && CI=1 npx wrangler d1 migrations apply net --local --persist-to "$ST" && CI=1 npx wrangler dev --port 8787 --ip 127.0.0.1 --persist-to "$ST")
//   npx vite --config games/social-game/vite.config.js --host 127.0.0.1 --port 5276 --strictPort
//   node games/social-game/car-bump-check.mjs http://127.0.0.1:5276/ [outDir] [netUrl]
// 1. A drives and gets out: B still sees A (at the right place) and A's car parked where A left it.
// 2. A drives full speed at B's parked car: A's car bumps and stops, never goes through, no damage.
// 3. A cannot walk through B's car (parked, and with B in it).
// 4. B drives at A standing in front: B's car stops in front of A, no damage.
// 5. 같이 타기 still works: A rides in B's car, B drives away freely, A gets out next to the car.
// 6. A drives into B's car while B sits in it: bumps, does not go through.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const pw = await import('../../tools/node_modules/playwright/index.mjs').catch(() => import(process.env.PLAYWRIGHT_MJS ?? 'playwright'));
const base = process.argv[2] ?? 'http://127.0.0.1:5276/';
const out = process.argv[3] ?? '/tmp/social-car-bump';
const net = process.argv[4] ?? 'http://127.0.0.1:8787';
assert.match(net, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/, 'local net server only');
mkdirSync(out, { recursive: true });
const url = `${base}${base.includes('?') ? '&' : '?'}net=${net}`;
const tag = Math.random().toString(36).slice(2, 7);
const browser = await pw.chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const G = (c, f, a) => c.page.evaluate(f, a);
const until = (c, f, a, timeout = 30000) => c.page.waitForFunction(f, a, { timeout });
const shot = (c, name) => c.page.screenshot({ path: `${out}/${name}.png` });
const toastHas = (c, text) => until(c, (t) => [...document.querySelectorAll('#toast div')].some((d) => d.textContent.includes(t)), text, 10000);
const wait = (c, ms) => c.page.waitForTimeout(ms);

async function computer(name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000); // a busy computer loads slowly
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  page.on('framenavigated', (f) => { if (f === page.mainFrame() && page.__started) console.log(name, 'page navigated', f.url()); });
  page.on('crash', () => console.log(name, 'page crashed'));
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
  await page.evaluate(() => { const g = window.__game; g.state.hour = 12; g.sky.setHour(12, true); g.state.license = true; });
  page.__started = true;
  return { ctx, page, errors, name, nick };
}
const pressE = async (c) => { await c.page.keyboard.press('e'); await wait(c, 150); };
const hold = async (c, key, ms) => { await c.page.keyboard.down(key); await wait(c, ms); await c.page.keyboard.up(key); };
const stop = async (c) => {
  await c.page.keyboard.down('Space');
  await until(c, () => Math.abs(window.__game.vehicle.speed) < 0.3, null, 20000);
  await c.page.keyboard.up('Space');
};
const carOf = (c) => G(c, () => { const v = window.__game.vehicle; return { x: v.pos.x, z: v.pos.z, y: v.y, yaw: v.yaw }; });
const posOf = (c) => G(c, () => window.__game.player.pos.toArray());
/** What c sees of the player with that nickname. */
const sees = (c, nick) => G(c, (nick) => {
  const r = [...window.__game.town.remotes.values()].find((x) => x.user?.nickname === nick);
  if (!r) return null;
  const g = r.ch?.group;
  return {
    visible: r.visible, drawn: !!g && g.visible && g.parent === window.__game.engine.scene, at: g ? [g.position.x, g.position.z] : null,
    car: r.car && r.car.group.visible ? [r.car.group.position.x, r.car.group.position.z] : null, solid: !!r.boxes, mode: r.target?.mode,
  };
}, nick);
const look = (c, x, z, pitch = -0.12) => G(c, ([x, z, pitch]) => { const p = window.__game.player; p.yaw = Math.atan2(-(x - p.pos.x), -(z - p.pos.z)); p.pitch = pitch; }, [x, z, pitch]);
const near = (a, b, d) => Math.hypot(a[0] - b[0], a[1] - b[1]) < d;

const A = await computer('A');
const B = await computer('B');
const Z0 = 116.5; // second avenue, heading +x
const EAST = -Math.PI / 2;

// ---- 1. A drives and gets out: B still sees A and A's car
await G(A, ([x, z, yaw]) => { const g = window.__game; g.vehicle.park(x, z, yaw); g.player.place(x, 0.3, z - 2.3, Math.PI); }, [-80, Z0, EAST]);
await G(B, ([x, z]) => window.__game.player.place(x, 0.3, z, 0), [-52, Z0 - 8]);
await pressE(A);
await until(A, () => window.__game.vehicle.driving === true);
await hold(A, 'w', 1800);
await stop(A);
await wait(A, 400);
await pressE(A);
await until(A, () => window.__game.vehicle.driving === false);
const aCar1 = await carOf(A), aPos1 = await posOf(A);
await look(B, aPos1[0], aPos1[2]);
await until(B, ([nick, x, z, cx, cz]) => {
  const r = [...window.__game.town.remotes.values()].find((q) => q.user?.nickname === nick);
  return r && r.target?.mode !== 'drive' && r.ch.group.visible && Math.hypot(r.ch.group.position.x - x, r.ch.group.position.z - z) < 0.6
    && r.car?.group.visible && Math.hypot(r.car.group.position.x - cx, r.car.group.position.z - cz) < 0.5;
}, [A.nick, aPos1[0], aPos1[2], aCar1.x, aCar1.z]);
await wait(B, 1500);
const s1 = await sees(B, A.nick);
console.log('1. B sees A after A got out:', JSON.stringify(s1));
assert.ok(s1.visible && s1.drawn, 'A is drawn for B after getting out');
assert.ok(near(s1.at, [aPos1[0], aPos1[2]], 0.6), 'A stands where A really is');
assert.ok(s1.car && near(s1.car, [aCar1.x, aCar1.z], 0.5), 'A\'s car stays parked where A left it');
await shot(B, '01-B-sees-A-out-of-car');

// ---- 2. A drives full speed at B's parked car
const X1 = -40, BX = -24;
await G(B, ([x, z, yaw]) => { const g = window.__game; g.vehicle.park(x, z, yaw); g.player.place(x + 7, 0.3, z - 8, 0); }, [BX, Z0, EAST]);
await look(B, X1 + 6, Z0, -0.08);
await G(A, ([x, z, yaw]) => { const g = window.__game; g.vehicle.park(x, z, yaw); g.player.place(x, 0.3, z - 2.3, Math.PI); }, [X1, Z0, EAST]);
await until(A, ([nick, x]) => { const r = [...window.__game.town.remotes.values()].find((q) => q.user?.nickname === nick); return r?.carAt && Math.abs(r.carAt.x - x) < 0.3 && !!r.boxes; }, [B.nick, BX]);
const hp0 = await G(A, () => window.__game.state.hp);
await pressE(A);
await until(A, () => window.__game.vehicle.driving === true);
await G(A, (bx) => {
  window.__minGap = Infinity; window.__top = 0;
  const v = window.__game.vehicle;
  const tick = () => { window.__top = Math.max(window.__top, v.speed); window.__minGap = Math.min(window.__minGap, bx - v.pos.x); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}, BX);
await A.page.keyboard.press('v'); // chase camera
await A.page.keyboard.down('w');
await toastHas(A, '콩!');
await wait(A, 120);
await shot(A, '02-A-bumps-B-parked-car');
await wait(A, 1500);
await A.page.keyboard.up('w');
await stop(A);
const bump = await G(A, () => ({ gap: window.__minGap, top: window.__top, hp: window.__game.state.hp, x: window.__game.vehicle.pos.x }));
console.log('2. A drives at B\'s parked car:', JSON.stringify(bump));
assert.ok(bump.top > 8, `A hit it fast (${bump.top.toFixed(1)} m/s)`);
assert.ok(bump.gap > 4.3, `A's car never went into B's car (closest centres ${bump.gap.toFixed(2)} m, touching = 4.62)`);
assert.ok(bump.x < BX, 'A is still behind B\'s car');
assert.equal(bump.hp, hp0, 'a friend\'s car never hurts');
assert.deepEqual((await carOf(B)).x, BX, 'B\'s parked car did not move on B\'s computer');
await wait(B, 300);
await shot(B, '03-B-sees-A-bumped-into-B-car');
await A.page.keyboard.press('v');

// ---- 3. A cannot walk through B's car (parked)
await pressE(A);
await until(A, () => window.__game.vehicle.driving === false);
const walkInto = async (label) => {
  await G(A, ([x, z]) => window.__game.player.place(x, 0.3, z - 2.6, Math.PI), [BX, Z0]); // beside B's car, facing it (+z)
  await wait(A, 300);
  await hold(A, 'w', 1800);
  const p = await posOf(A);
  const carZ = await G(A, (nick) => [...window.__game.town.remotes.values()].find((r) => r.user?.nickname === nick).carAt.z, B.nick);
  console.log(`3. A walks into B's car (${label}): z ${p[2].toFixed(2)} (car side at ${(carZ - 0.91).toFixed(2)}), x ${p[0].toFixed(2)} (car x ${BX})`);
  assert.ok(p[2] < carZ - 1.15, `A stops at the side of B's car (${label})`);
  assert.ok(Math.abs(p[0] - BX) < 0.5, 'and does not slide around it');
};
await walkInto('parked');
await G(A, () => { const p = window.__game.player; if (p.view !== 'third') p.toggleView(); });
await look(A, BX, Z0 + 2, -0.25);
await wait(A, 300);
await shot(A, '04-A-blocked-by-B-car');
await G(A, () => { const p = window.__game.player; if (p.view === 'third') p.toggleView(); });

// B gets in: still solid with B inside
await G(B, ([x, z]) => window.__game.player.place(x, 0.3, z - 2.3, Math.PI), [BX, Z0]);
await pressE(B);
await until(B, () => window.__game.vehicle.driving === true);
await until(A, (nick) => [...window.__game.town.remotes.values()].some((r) => r.user?.nickname === nick && r.target?.mode === 'drive' && r.boxes), B.nick);
await walkInto('B sits in it');

// ---- 4. B drives at A standing in front of B's car
await G(A, ([x, z]) => window.__game.player.place(x, 0.3, z, -Math.PI / 2), [BX + 6, Z0]);
await until(B, ([nick, x]) => [...window.__game.town.remotes.values()].some((r) => r.user?.nickname === nick && r.visible && Math.abs(r.target.x - x) < 0.3), [A.nick, BX + 6]);
const hpB = await G(B, () => window.__game.state.hp);
await B.page.keyboard.press('v');
await B.page.keyboard.down('w');
await toastHas(B, '앞에 있어서 멈췄어요');
await shot(B, '05-B-stops-for-A');
await wait(B, 800);
await B.page.keyboard.up('w');
await B.page.keyboard.press('v');
const bStop = await carOf(B), aStand = await posOf(A);
console.log('4. B drives at A:', JSON.stringify({ carX: bStop.x, aX: aStand[0] }));
assert.ok(aStand[0] - bStop.x > 2.4, `B's car stopped in front of A (${(aStand[0] - bStop.x).toFixed(2)} m)`);
assert.equal(await G(B, () => window.__game.state.hp), hpB, 'no damage');

// ---- 5. 같이 타기: A rides in B's car, B drives away freely
await G(A, ([x, z]) => window.__game.player.place(x + 0.3, 0.3, z + 2.4, 0), [bStop.x, Z0]);
await until(A, (nick) => document.getElementById('prompt').textContent.includes(`같이 타기 (${nick} 님 차)`), B.nick);
await pressE(A);
await until(A, () => window.__game.town.riding === true);
const aNum = await G(A, () => window.__game.town.myNum);
await until(B, (n) => window.__game.town.seats.includes(n), aNum);
const bx0 = (await carOf(B)).x;
await G(B, () => { window.__bumps = 0; const v = window.__game.vehicle; const tick = () => { if (v.bump) window.__bumps++; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
await B.page.keyboard.down('w');
await until(B, (x) => window.__game.vehicle.pos.x > x + 25, bx0, 20000);
await B.page.keyboard.up('w');
await stop(B);
await wait(B, 600);
assert.equal(await G(A, () => window.__game.town.riding), true, 'A rode along');
assert.equal(await G(B, () => window.__bumps), 0, 'B\'s car never bumped into its own passenger');
await G(A, () => { window.__game.town.rideLook.yaw = 0.9; window.__game.town.rideLook.pitch = -0.12; });
await wait(A, 300);
await shot(A, '06-A-rides-in-B-car');
await pressE(A);
await until(A, () => !window.__game.town.ride);
const bCar5 = await carOf(B), aOut = await posOf(A);
const dOut = Math.hypot(aOut[0] - bCar5.x, aOut[2] - bCar5.z);
assert.ok(dOut > 1.3 && dOut < 4.5, `A got out next to B's car (${dOut.toFixed(2)} m)`);

// ---- 6. A drives into B's car while B sits in it (B is still in the driver's seat)
const AX = bCar5.x - 18;
await G(A, ([x, z, yaw]) => { const g = window.__game; g.vehicle.park(x, z, yaw); g.player.place(x, 0.3, z - 2.3, Math.PI); }, [AX, Z0, EAST]);
await wait(A, 500);
await pressE(A);
await until(A, () => window.__game.vehicle.driving === true);
await G(A, (bx) => { window.__minGap6 = Infinity; const v = window.__game.vehicle; const tick = () => { window.__minGap6 = Math.min(window.__minGap6, bx - v.pos.x); requestAnimationFrame(tick); }; requestAnimationFrame(tick); }, bCar5.x);
await A.page.keyboard.down('w');
await toastHas(A, '콩!');
await wait(A, 1200);
await A.page.keyboard.up('w');
await stop(A);
const gap6 = await G(A, () => window.__minGap6);
console.log('6. A drives at B sitting in B\'s car: closest centres', gap6.toFixed(2));
assert.ok(gap6 > 4.3, 'A\'s car never went into B\'s car');
await B.page.keyboard.press('v');
await wait(B, 900);
await shot(B, '07-B-sees-A-car-behind');
await B.page.keyboard.press('v');

for (const c of [A, B]) assert.deepEqual(c.errors, [], `page errors on ${c.name}`);
console.log('car bump check ok', A.nick, B.nick, out);
await browser.close();
