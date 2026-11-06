// 영화관 진짜 영화 (인혁: "진짜 영화를 볼 수 있게 해줘"): walks into 세온 시네마, sits in the movie seat with E,
// checks the 햄찌 영화 really plays on the 3D screen (video texture, time moving, sound on, 13분 31초 = 811 s in all,
// the game clock stops), skips to 1화 with N, then leaves with E and checks everything is released.
// node games/social-game/movie-check.mjs [url] [outDir]
// The videos come from public/play/kongtteok/videos through a small local server (the new movie files are not
// on seonn.dev until the site is deployed), passed to the game as ?movies=.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pw = await import('../../tools/node_modules/playwright/index.mjs').catch(() => import(process.env.PLAYWRIGHT_MJS ?? 'playwright'));
const url = process.argv[2] ?? 'http://127.0.0.1:5272/';
const out = process.argv[3] ?? '/tmp/social-movie';
mkdirSync(out, { recursive: true });

// static video server with Range and CORS, like the real site
const dir = fileURLToPath(new URL('../../public/play/kongtteok/videos/', import.meta.url));
const server = createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
  if (!/^[\w.-]+\.mp4$/.test(name)) { res.writeHead(404).end(); return; }
  let size;
  try { size = statSync(dir + name).size; } catch { res.writeHead(404).end(); return; }
  const head = { 'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'access-control-allow-origin': '*' };
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
  if (m) {
    const a = m[1] ? Number(m[1]) : size - Number(m[2]), b = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    res.writeHead(206, { ...head, 'content-range': `bytes ${a}-${b}/${size}`, 'content-length': b - a + 1 });
    createReadStream(dir + name, { start: a, end: b }).pipe(res);
  } else {
    res.writeHead(200, { ...head, 'content-length': size });
    createReadStream(dir + name).pipe(res);
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const movies = `http://127.0.0.1:${server.address().port}/`;

const browser = await pw.chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 680 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${url}?movies=${encodeURIComponent(movies)}`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
await Promise.all([page.waitForEvent('load'), page.click('#m-office')]);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
await page.waitForTimeout(5000); // the "good morning" toasts of a new game go away first
const G = (fn, arg) => page.evaluate(fn, arg);
const status = () => G(() => window.__game.day.g.cinema.status);

// 1) stand in front of the cinema until its inside is built, then go to the movie seat in the 1관
await G(() => {
  const g = window.__game, s = g.places.sites['civic-cinema'];
  g.state.hour = 15; g.day.timeTo = null; g.sky.setHour(15, true);
  g.player.place(s.worldPos[0], 0.25, s.worldPos[2] + s.footprint.d / 2 + 3, 0);
});
await page.waitForFunction(() => !!window.__game.places.interactables.find((i) => i.key === 'civic-cinema:movie'), null, { timeout: 20000 });
await G(() => {
  const g = window.__game, it = g.places.interactables.find((i) => i.key === 'civic-cinema:movie');
  g.player.place(it.wpos.x, it.wpos.y - 1.15, it.wpos.z + 0.3, 0);
  g.state.hour = 15; g.day.timeTo = null;
});
await page.waitForTimeout(500);
const prompt = await G(() => document.getElementById('prompt').textContent);
assert.match(prompt, /영화 보기/, 'the movie seat asks "영화 보기"');

// 2) E: sit down, the film starts
await page.keyboard.press('KeyE');
await page.waitForFunction(() => window.__game.day.g.cinema.status.playing, null, { timeout: 30000 });
const s0 = await status();
const left0 = await G(() => document.querySelector('#cinema-ui .cl b').textContent);
assert.ok(s0.time > 1 || left0 === '13:31', `starts at 13:31 (${left0})`);
const h0 = await G(() => window.__game.state.hour);
assert.equal(s0.part, 0, 'starts with the opening');
assert.ok(s0.src.startsWith(movies) && s0.src.endsWith('movie-open.mp4'), `plays the opening from ${movies} (${s0.src})`);
assert.equal(s0.muted, false, 'sound is on');
const look = await G(() => {
  const g = window.__game, c = g.day.g.cinema, film = c.film;
  return { seat: !!g.day.seat, busy: g.day.busy, video: !!film?.material.map?.isVideoTexture, w: c.video.videoWidth, h: c.video.videoHeight, ui: document.getElementById('cinema-ui')?.textContent ?? '', audience: c.audience.length, popcorn: !!c.cup?.parent };
});
assert.ok(look.seat && look.busy, 'sitting in the seat, the day is paused');
assert.ok(look.video, 'the screen shows the video texture');
assert.deepEqual([look.w, look.h], [1280, 720], 'video is 1280x720');
assert.match(look.ui, /햄찌 영화/, 'UI shows the title');
assert.match(look.ui, /남은 시간/, 'UI shows the time left');
assert.ok(look.audience >= 2 && look.popcorn, 'people in front and popcorn in hand');
await page.waitForTimeout(3500);
await page.screenshot({ path: `${out}/movie-seat.png` });

// 3) the film moves on, the game clock does not
const s1 = await status();
await page.waitForTimeout(3000);
const s2 = await status();
assert.ok(s2.time > s1.time + 2, `video time advances (${s1.time.toFixed(2)} → ${s2.time.toFixed(2)})`);
assert.ok(s2.left < s1.left - 2, 'time left counts down');
const h1 = await G(() => window.__game.state.hour);
assert.ok(Math.abs(h1 - h0) < 0.01, `game clock waits while watching (${h0} → ${h1})`);

// 4) the whole movie is 13분 31초: add up the real length of every part
const durs = await G(() => {
  const { movie: { parts }, base } = window.__game.day.g.cinema;
  return Promise.all(parts.map((p) => new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata'; v.crossOrigin = 'anonymous';
    v.onloadedmetadata = () => resolve({ file: p.file, real: v.duration, table: p.dur });
    v.onerror = () => resolve({ file: p.file, real: NaN, table: p.dur });
    v.src = base + p.file;
  })));
});
const total = durs.reduce((a, d) => a + d.real, 0);
for (const d of durs) assert.ok(Math.abs(d.real - d.table) < 0.2, `${d.file}: ${d.real} s (table ${d.table})`);
assert.ok(Math.abs(total - 811) <= 1, `whole movie ${total.toFixed(2)} s = 13분 31초`);
console.log('parts', durs.map((d) => `${d.file} ${d.real.toFixed(2)}`).join(', '), '→ total', total.toFixed(2), 's');

// 5) N: next part (1화)
await page.keyboard.press('KeyN');
await page.waitForFunction(() => { const s = window.__game.day.g.cinema.status; return s.part === 1 && s.playing && s.time > 1; }, null, { timeout: 30000 });
const s3 = await status();
assert.ok(s3.src.endsWith('ep1.mp4') && Math.abs(s3.left - (811 - 14 - s3.time)) < 0.5, 'N skips to 1화, the countdown follows');
await page.screenshot({ path: `${out}/movie-ep1.png` });

// 6) E: leave early, everything is released
await page.keyboard.press('KeyE');
await page.waitForFunction(() => !window.__game.day.g.cinema.status.active && !window.__game.day.seat, null, { timeout: 10000 });
await page.waitForTimeout(1500);
const after = await G(() => {
  const g = window.__game, c = g.day.g.cinema;
  return { active: c.status.active, video: c.video, seat: !!g.day.seat, busy: g.day.busy, ui: !!document.getElementById('cinema-ui'), screen: !!g.engine.scene.getObjectByName('cinema-film'), hour: g.state.hour, people: g.life.people.length, hud: document.body.classList.contains('cinema-on'), videos: document.querySelectorAll('video').length };
});
assert.ok(!after.active && !after.seat && !after.busy, 'standing up again (E did not start the movie again)');
assert.equal(after.video, null, 'video released');
assert.ok(!after.ui && !after.screen && !after.hud, 'screen and UI removed, HUD back');
const watched = s3.pos ?? (14 + s3.time);
assert.ok(after.hour > h0 && after.hour - h0 < 0.2, `clock moved by the time watched (${(after.hour - h0).toFixed(3)} h for ${watched.toFixed(0)} s of film)`);
await page.screenshot({ path: `${out}/movie-left.png` });
assert.deepEqual(errors, [], 'no page errors');
console.log('movie check ok', out);
await browser.close();
server.close();
