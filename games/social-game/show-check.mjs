// 분수 광장 공연 검사 (인혁 계획 7: "어느날엔 공연도 하게 해줘. 그리고 분수를 만들고 분수에서 공연을 하게 해줘").
// 1. a Monday afternoon: the plaza and fountain are there, E on the front bench says when the show is (no show)
// 2. the wishing fountain takes a 100원 coin and the coin lands in the basin
// 3. Friday 18:50: the crowd gathers; 19:00 the show starts by itself; E on the front bench watches it
// 4. the whole show plays (band, dancers, crowd, dancing jets, beams, music) and the watch ends by itself,
//    the player can walk again and the evening moved on
// node games/social-game/show-check.mjs [url] [outDir]
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const pw = await import('../../tools/node_modules/playwright/index.mjs').catch(() => import(process.env.PLAYWRIGHT_MJS ?? 'playwright'));
const url = process.argv[2] ?? 'http://127.0.0.1:5274/';
const out = process.argv[3] ?? '/tmp/social-show';
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
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
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
const toasts = () => G(() => [...document.querySelectorAll('#toast div')].map((d) => d.textContent).join(' | '));
// render stats over all passes of one frame
await G(() => { const e = window.__game.engine; e.renderer.info.autoReset = false; e.onUpdate(() => e.renderer.info.reset()); });
const stats = () => G(() => { const i = window.__game.engine.renderer.info.render; return { calls: i.calls, tris: i.triangles }; });
/** Stand at an interactable + (dx, dz) metres (world), facing it. */
const standAt = (key, dx, dz, hour = null, day = null) => G(([k, ox, oz, h, d]) => {
  const g = window.__game, it = g.places.interactables.find((i) => i.key === k);
  if (d != null) { g.state.day = d; g.state.plan = null; }
  if (h != null) { g.state.hour = h; g.sky.setHour(h, true); }
  const x = it.wpos.x + ox, z = it.wpos.z + oz;
  g.player.place(x, 0.2, z, Math.atan2(-(it.wpos.x - x), -(it.wpos.z - z))); g.player.pitch = -0.25;
  return { x: +x.toFixed(1), z: +z.toFixed(1) };
}, [key, dx, dz, hour, day]);

const site = await G(() => { const s = window.__game.places.sites.plaza; return s && { pos: s.worldPos, fp: s.footprint, its: s.interactables.map((i) => i.id), show: !!window.__game.day.g.show }; });
console.log('plaza', JSON.stringify(site));
assert.ok(site, 'the plaza is built');
assert.ok(site.show, 'the game has a show runtime (g.show)');
assert.deepEqual(site.its.sort(), ['fountain', 'show']);

// 1. Monday afternoon: no show
await G(() => { const g = window.__game; g.state.day = 1; g.state.hour = 15; g.sky.setHour(15, true); g.player.place(22, 0.2, 9.0, Math.PI); g.player.pitch = 0.02; });
await page.waitForTimeout(2500);
await shot('1-plaza-day');
const dayStats = await stats();
await G(() => { const g = window.__game; g.player.place(25.6, 0.2, 27.2, Math.PI * 0.82); g.player.pitch = -0.05; });
await page.waitForTimeout(1500);
await shot('2-fountain-day');
await standAt('plaza:show', 0, -1.5, 15, 1);
await page.waitForTimeout(600);
const prompt1 = await G(() => document.getElementById('prompt').textContent);
assert.match(prompt1, /공연 보기/, 'the front bench offers the show');
await page.keyboard.press('KeyE');
await page.waitForTimeout(400);
const t1 = await toasts();
console.log('no show:', t1);
assert.match(t1, /금요일 저녁 7시/, 'it says the show is on Friday at 7 pm');
assert.equal(await G(() => window.__game.day.g.show.watching), false);

// 2. wishing fountain
await standAt('plaza:fountain', 1.3, 0, 15, 1);
await page.waitForTimeout(500);
const prompt2 = await G(() => document.getElementById('prompt').textContent);
assert.match(prompt2, /소원/, 'the fountain rim offers a wish');
const m0 = await G(() => window.__game.state.money);
await page.keyboard.press('KeyE');
await page.waitForTimeout(1400);
const wish = await G(() => ({ money: window.__game.state.money, coins: window.__game.day.g.show.coins.count }));
console.log('wish:', await toasts(), JSON.stringify(wish));
assert.equal(wish.money, m0 - 100, 'a wish costs a 100원 coin');
assert.equal(wish.coins, 1, 'the coin lies in the basin');

// 3. Friday evening: the crowd gathers, the show starts at 19:00
await G(() => { const g = window.__game; g.state.day = 5; g.state.plan = null; g.state.hour = 18.8; g.sky.setHour(18.8, true); g.player.place(22, 0.2, 21.5, 0); g.player.pitch = -0.05; });
await page.waitForTimeout(2000); // the clock runs 2 s per game minute: about 18:49 now
const gather = await G(() => { const S = window.__game.day.g.show; return { present: S.present, playing: S.playing, crowd: S.crowd.filter((c) => c.state !== 'away').length }; });
console.log('18:51', JSON.stringify(gather));
assert.ok(gather.present && !gather.playing && gather.crowd > 10, 'the crowd comes before the show');
await shot('3-crowd-gathering');
await G(() => { const g = window.__game; g.state.hour = 19.0; g.sky.setHour(19.0, true); });
await page.waitForTimeout(1500);
assert.ok(await G(() => window.__game.day.g.show.playing), 'the show starts at 19:00 by itself');
console.log('19:00', await toasts());

// 4. watch the whole show from the front bench
await standAt('plaza:show', 0, -1.5);
await page.waitForTimeout(500);
await page.keyboard.press('KeyE');
await page.waitForTimeout(800);
const w0 = await G(() => { const g = window.__game, S = g.day.g.show; return { watching: S.watching, seat: !!g.day.seat, busy: g.day.busy, t: S.showT, audio: S.music?.ctx.state ?? 'none', cast: S.cast.length, crowd: S.crowd.filter((c) => c.state === 'here').length, hour: g.state.hour }; });
console.log('watch', JSON.stringify(w0));
assert.ok(w0.watching && w0.seat && w0.busy, 'E sits the player down to watch');
assert.ok(w0.t < 3, 'the show starts from the beginning');
assert.equal(w0.cast, 6, 'singer, two dancers, guitar, keyboard and drums');
assert.ok(w0.crowd >= 15, 'the crowd is in place');
const samples = [];
const T0 = Date.now();
for (const [at, name] of [[9, '4-verse'], [27, '5-chorus'], [40, '6-fountain-solo'], [86, '7-final'], [93, '8-ending']]) {
  await G((a) => new Promise((r) => { const S = window.__game.day.g.show; const tick = () => (S.showT >= a || !S.watching ? r() : setTimeout(tick, 100)); tick(); }), at);
  const s = await G(() => { const S = window.__game.day.g.show, J = S.water.jets; return { t: +S.showT.toFixed(1), maxJet: +Math.max(...J.map((j) => j.H)).toFixed(1), beams: S.stage.heads.filter((h) => h.beam.visible).length, caption: S.caption.textContent, clapping: S.crowd.filter((c) => Math.abs(c.ch.bones.shoulderL.rotation.x) > 0.5 || Math.abs(c.ch.bones.shoulderL.rotation.z) > 2).length }; });
  samples.push({ name, ...s, ...(await stats()) });
  await shot(name);
}
for (const s of samples) console.log(JSON.stringify(s));
assert.ok(samples.some((s) => s.maxJet > 6), 'the jets shoot high in the music');
assert.ok(samples.some((s) => s.beams >= 4), 'the stage beams are on at night');
assert.ok(samples.some((s) => s.clapping >= 5), 'the crowd claps and cheers');
assert.ok(samples.some((s) => /분수야 춤춰라/.test(s.caption)), 'lyrics show while watching');
await page.waitForFunction(() => !window.__game.day.g.show.watching, null, { timeout: 60000 });
const secs = (Date.now() - T0) / 1000 + 1;
const end = await G(() => { const g = window.__game, S = g.day.g.show; return { watched: S.stats.watched, seat: !!g.day.seat, busy: g.day.busy, hour: +g.state.hour.toFixed(2), caption: S.caption.style.display }; });
console.log(`watched ${secs.toFixed(0)} s`, JSON.stringify(end), await toasts());
assert.equal(end.watched, 1, 'the show played to the end');
assert.ok(secs > 60 && secs < 125, 'the show lasts 60–120 s');
assert.ok(!end.seat && !end.busy, 'the player is free again');
assert.ok(end.hour > 19.5, 'the evening moved on');
const p0 = await G(() => window.__game.player.pos.clone());
await page.keyboard.down('KeyW'); await page.waitForTimeout(700); await page.keyboard.up('KeyW');
const moved = await G((p) => window.__game.player.pos.distanceTo(p), p0);
assert.ok(moved > 0.3, 'the player walks again after the show');
console.log('render plaza day', JSON.stringify(dayStats), 'show', JSON.stringify(samples.map((s) => s.calls)));
assert.deepEqual(errors, [], 'no page errors');
console.log('show check ok', out);
await browser.close();
