// 포즈 검사: opens the pose menu (B), plays every pose, checks the avatar's bones really moved (and keep moving
// for looping poses), that hands stay out of the head and feet out of the ground, that P takes a photo of it,
// that number keys in the menu leave the hotbar alone, and that walking ends the pose. One screenshot per pose.
// node games/social-game/pose-check.mjs [url] [outDir]
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { POSES } from './poses.mjs';

const pw = await import('../../tools/node_modules/playwright/index.mjs').catch(() => import(process.env.PLAYWRIGHT_MJS ?? 'playwright'));
const url = process.argv[2] ?? 'http://127.0.0.1:5173/';
const out = process.argv[3] ?? 'artifacts/social-poses';
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
await Promise.all([page.waitForEvent('load'), page.click('#m-office')]);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
await page.waitForFunction(() => document.getElementById('start').classList.contains('hidden'), null, { timeout: 20000 });
const G = (fn, arg) => page.evaluate(fn, arg);

// outside on the grass next to the parked car, at noon
await G(() => {
  const g = window.__game, v = g.vehicle.pos;
  const x = v.x + 5, z = v.z + 1;
  g.player.place(x, g.player.groundAt(x, z) + 0.05, z, 0.6);
  g.state.hour = 12; g.sky.setHour(12, true);
});
await page.waitForTimeout(1200);
const avatarState = () => G(() => {
  const g = window.__game, a = g.player.avatar;
  a.group.updateMatrixWorld(true);
  const w = (n) => a.bones[n].getWorldPosition(new a.group.position.constructor());
  const head = w('head'), ground = g.player.groundAt(g.player.pos.x, g.player.pos.z);
  const headC = head.clone().add(new head.constructor(0, 0.1 * a.group.scale.y, 0));
  return {
    q: Object.values(a.bones).map((b) => b.quaternion.toArray()),
    hips: w('hips').y - ground,
    feet: Math.min(w('footL').y, w('footR').y) - ground,
    handHead: Math.min(w('handL').distanceTo(headC), w('handR').distanceTo(headC)) / a.group.scale.y,
    visible: a.group.visible,
    camDist: g.engine.camera.position.distanceTo(g.player.pos),
    pose: g.player.pose?.id ?? null,
    view: g.player.view,
  };
});
const angle = (a, b) => Math.max(...a.q.map((q, i) => { const d = Math.abs(q[0] * b.q[i][0] + q[1] * b.q[i][1] + q[2] * b.q[i][2] + q[3] * b.q[i][3]); return 2 * Math.acos(Math.min(1, d)); }));

const idle = await avatarState();
assert.equal(idle.pose, null);
assert.equal(idle.view, 'first');

// B opens the menu with every pose; a number key picks one and the hotbar stays where it was
const slot = await G(() => window.__game.build.slot);
await page.keyboard.press('b');
await page.waitForFunction(() => !document.getElementById('pose-menu').classList.contains('hidden'));
assert.equal(await page.locator('#pose-grid button').count(), POSES.length);
await page.screenshot({ path: `${out}/menu.png` });
await page.keyboard.press('3');
await page.waitForTimeout(300);
assert.equal(await G(() => window.__game.player.pose?.id), POSES[2].id, 'number key 3 picks the third pose');
assert.ok(await G(() => document.getElementById('pose-menu').classList.contains('hidden')), 'menu closes');
assert.equal(await G(() => window.__game.build.slot), slot, 'the hotbar did not change');

const results = [];
for (const p of POSES) {
  // the 🙋 button opens the menu, a click picks the pose
  await G(() => window.__game.poses.stop());
  await page.click('#btn-pose', { force: true });
  await page.click(`#pose-grid button[data-pose="${p.id}"]`);
  await page.waitForTimeout(900);
  const a = await avatarState();
  await page.waitForTimeout(1700);
  const b = await avatarState();
  assert.equal(a.pose, p.id, `${p.id} is on`);
  assert.ok(a.visible, `${p.id}: I can see myself`);
  assert.ok(a.camDist > 1.2, `${p.id}: the camera stepped back (${a.camDist.toFixed(2)} m)`);
  const moved = angle(idle, a), anim = angle(a, b);
  assert.ok(moved > 0.35, `${p.id}: bones changed (${moved.toFixed(2)} rad)`);
  if (p.loop) assert.ok(anim > 0.05, `${p.id}: keeps moving (${anim.toFixed(2)} rad)`);
  assert.ok(a.feet > -0.04 && b.feet > -0.04, `${p.id}: feet above the ground (${Math.min(a.feet, b.feet).toFixed(3)} m)`);
  assert.ok(a.handHead > 0.12, `${p.id}: hands out of the head (${a.handHead.toFixed(2)} m)`);
  // turn the camera a little around me so the pose reads, then a screenshot
  await G(() => { window.__game.player.pose.camYaw += 0.45; });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/pose-${p.id}.png` });
  results.push(`${p.icon} ${p.id}: bones ${moved.toFixed(2)} rad, moving ${anim.toFixed(2)}, feet ${a.feet.toFixed(3)} m, hand-head ${a.handHead.toFixed(2)} m`);
}

// P takes a photo of the pose into the gallery
const before = await G(() => window.__game.day.g.album.photos.length);
await page.keyboard.press('p');
await page.waitForFunction((n) => window.__game.day.g.album.photos.length > n, before, { timeout: 5000 });
assert.match(await G(() => window.__game.day.g.album.photos[0].caption), new RegExp(POSES.at(-1).name.replace(/[()]/g, '.')));

// walking ends the pose and gives back the first-person view
await page.keyboard.down('w');
await page.waitForTimeout(400);
await page.keyboard.up('w');
const walked = await avatarState();
assert.equal(walked.pose, null, 'walking ends the pose');
assert.equal(walked.view, 'first');
assert.ok(!walked.visible, 'back in first person: my body is hidden again');

// B toggles a pose off again, Space jumps out of one
await G(() => window.__game.poses.start('dance'));
await page.waitForTimeout(200);
await page.keyboard.press('b');
await page.waitForTimeout(200);
assert.equal(await G(() => window.__game.player.pose), null, 'B ends the pose');
await G(() => window.__game.poses.start('wave'));
await page.waitForTimeout(200);
await page.keyboard.press('Space');
await page.waitForTimeout(200);
assert.equal(await G(() => window.__game.player.pose), null, 'Space ends the pose');

// not while driving
await page.waitForTimeout(800);
const blocked = await G(() => { const g = window.__game; g.vehicle.driving = true; const ok = g.poses.start('heart'); g.vehicle.driving = false; return ok || !!g.player.pose; });
assert.equal(blocked, false, 'no poses while driving');

assert.deepEqual(errors, [], 'no page errors');
console.log(results.join('\n'));
console.log(`pose check OK · ${POSES.length} poses · screenshots in ${out}`);
await browser.close();
