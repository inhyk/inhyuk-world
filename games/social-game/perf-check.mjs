// Frame-time benchmark (인혁 계획: "게임을 최적화 해줘"). Boots the game in a real browser, starts a 직장인
// story and measures fixed camera spots plus a fly-through along the avenue, where interiors get built.
//   node games/social-game/perf-check.mjs [url] [outDir]
// env: W, H (viewport, 1280x720), DPR (device pixel ratio, 2 like a laptop screen), FRAMES (per spot, 150),
//      THROTTLE (CPU slow-down factor, e.g. 4 for a slow laptop), SHOTS=0 (no screenshots), ONLY=avenue,dense,
//      ADAPT=1 (let the game lower its resolution when slow; off by default so runs compare like for like)
// Writes <outDir>/perf.json and one screenshot per spot. Numbers:
//   ms avg/p95  time between frames with vsync off (lower is better; 16.7 = 60 fps)
//   gpu, cpu    median GPU time (timer queries) and CPU time (update + render calls) of one frame
//   work        update + render + wait for the GPU (one pixel read back) in a second pass
//   upd         game update (people, doors, lights, minimap, HUD...) on the CPU
//   calls       draw calls per frame (sh = of them in the sun's shadow map), tris = triangles
//   heap        JS heap MB (+ typed arrays such as geometry, when Chrome reports them)
import { mkdirSync, writeFileSync } from 'node:fs';

const pw = await import('../../tools/node_modules/playwright/index.mjs').catch(() => import(process.env.PLAYWRIGHT_MJS ?? 'playwright'));
const url = process.argv[2] ?? 'http://127.0.0.1:5275/play/social-game/';
const out = process.argv[3] ?? '/tmp/social-perf';
mkdirSync(out, { recursive: true });
const W = Number(process.env.W ?? 1280), H = Number(process.env.H ?? 720), DPR = Number(process.env.DPR ?? 2);
const FRAMES = Number(process.env.FRAMES ?? 150);
const THROTTLE = Number(process.env.THROTTLE ?? 1);
const SHOTS = process.env.SHOTS !== '0';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const ADAPT = process.env.ADAPT === '1';

const browser = await pw.chromium.launch({
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--enable-precise-memory-info'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const bootLog = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); if (m.text().startsWith('[boot]')) bootLog.push(m.text()); });
// time of window.__ready and of the first rendered frame after it
await page.addInitScript(() => {
  let v;
  Object.defineProperty(window, '__ready', {
    configurable: true,
    get: () => v,
    set: (x) => { v = x; window.__readyAt = performance.now(); requestAnimationFrame(() => requestAnimationFrame(() => { window.__firstFrameAt = performance.now(); })); },
  });
});
const cdp = await ctx.newCDPSession(page);
if (THROTTLE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
const G = (fn, arg) => page.evaluate(fn, arg);
let arraysMB = null; // typed-array memory (geometry, texture pixels) outside the JS heap, when Chrome reports it
const heapMB = async () => { await cdp.send('HeapProfiler.collectGarbage'); const h = await cdp.send('Runtime.getHeapUsage'); if (h.backingStorageSize != null) arraysMB = Math.round(h.backingStorageSize / 1e5) / 10; return Math.round(h.usedSize / 1e5) / 10; };

// ---------------------------------------------------------------- start-up
await page.goto(url);
await G(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__firstFrameAt > 0, null, { timeout: 240000 });
const cold = await G(() => ({ ready: Math.round(window.__readyAt), frame: Math.round(window.__firstFrameAt) }));
bootLog.length = 0;
await Promise.all([page.waitForEvent('load'), page.click('#m-office')]);
await page.waitForFunction(() => window.__firstFrameAt > 0, null, { timeout: 240000 });
const warm = await G(() => ({ ready: Math.round(window.__readyAt), frame: Math.round(window.__firstFrameAt) }));
const boot = [...bootLog];
if (await G(() => window.__error ?? null)) throw new Error(await G(() => window.__error));
console.log(`start-up: first load ${cold.frame} ms (ready ${cold.ready}), story start ${warm.frame} ms (ready ${warm.ready})`);

// ---------------------------------------------------------------- probes
await G((adapt) => {
  const g = window.__game, e = g.engine, r = e.renderer, gl = r.getContext();
  if (!adapt) { e.adapt = () => {}; if (e.ratio !== e.maxRatio) { e.ratio = e.maxRatio; e.resize(); } }
  const P = window.__perf = { rec: null, sync: false, last: 0, built: 0, buildMs: 0 };
  r.info.autoReset = false;
  const ups = [...e.updaters];
  e.updaters.clear();
  e.updaters.add((dt, t) => { r.info.reset(); P.shadow = 0; const a = performance.now(); for (const f of ups) f(dt, t); P.upd = performance.now() - a; });
  const sm = r.shadowMap, smr = sm.render.bind(sm);
  sm.render = (...a) => { const c0 = r.info.render.calls; smr(...a); P.shadow += r.info.render.calls - c0; };
  const px = new Uint8Array(4);
  // GPU time of each frame from timer queries (they come back a few frames later)
  const tq = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const pending = [];
  const comp = e.composer, cr = comp.render.bind(comp);
  comp.render = (dt) => {
    const a = performance.now();
    const progs = r.info.programs?.length ?? 0;
    const q = tq && P.rec ? gl.createQuery() : null;
    if (q) gl.beginQuery(tq.TIME_ELAPSED_EXT, q);
    cr(dt);
    if (q) gl.endQuery(tq.TIME_ELAPSED_EXT);
    const b = performance.now();
    if (P.sync) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const c = performance.now();
    const now = performance.now();
    if (P.rec) {
      const f = { dt: P.last ? now - P.last : 0, upd: P.upd ?? 0, rend: b - a, wait: c - b, calls: r.info.render.calls, shadow: P.shadow, tris: r.info.render.triangles, newProgs: (r.info.programs?.length ?? 0) - progs, built: P.built, buildMs: P.buildMs, gpu: null };
      P.rec.push(f);
      if (q) pending.push({ q, f });
    }
    for (let i = 0; i < pending.length;) {
      const p = pending[i];
      if (!gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE)) { i++; continue; }
      if (!gl.getParameter(tq.GPU_DISJOINT_EXT)) p.f.gpu = gl.getQueryParameter(p.q, gl.QUERY_RESULT) / 1e6;
      gl.deleteQuery(p.q);
      pending.splice(i, 1);
    }
    P.built = 0; P.buildMs = 0;
    P.last = now;
  };
  const pl = g.places, ui = pl.updateInteriors.bind(pl);
  pl.updateInteriors = (...a) => {
    const n0 = pl.lazy.filter((s) => s.interior).length, t0 = performance.now();
    const res = ui(...a);
    const n1 = pl.lazy.filter((s) => s.interior).length;
    if (n1 > n0) { P.built += n1 - n0; P.buildMs += performance.now() - t0; }
    return res;
  };
  // keep the light of a fixed hour while measuring
  P.hold = null;
  e.updaters.add(() => { if (P.hold != null) g.state.hour = P.hold; });
}, ADAPT);
const settle = (ms) => page.waitForTimeout(ms);
const stat = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const avg = s.reduce((a, b) => a + b, 0) / Math.max(1, s.length);
  return { avg: +avg.toFixed(2), p95: +(s[Math.floor(s.length * 0.95)] ?? 0).toFixed(2), max: +(s[s.length - 1] ?? 0).toFixed(1) };
};
async function record(frames, sync) {
  await G((s) => { window.__perf.sync = s; window.__perf.last = 0; window.__perf.rec = []; }, sync);
  await page.waitForFunction((n) => window.__perf.rec.length >= n, frames, { timeout: 120000, polling: 100 });
  await G(() => { window.__perf.sync = false; window.__perf.stop = window.__perf.rec; window.__perf.rec = null; });
  await settle(150); // the last timer queries come back
  return G(() => window.__perf.stop);
}
const med = (arr) => { const s = arr.filter((x) => x != null).sort((a, b) => a - b); return s.length ? +s[s.length >> 1].toFixed(2) : null; };
const scene = () => G(() => {
  const g = window.__game, r = g.engine.renderer;
  let meshes = 0, visible = 0;
  g.engine.scene.traverse((o) => { if (o.isMesh) meshes++; });
  g.engine.scene.traverseVisible((o) => { if (o.isMesh) visible++; });
  return {
    programs: r.info.programs?.length ?? 0, textures: r.info.memory.textures, geometries: r.info.memory.geometries,
    meshes, visible, interiors: g.places.lazy.filter((s) => s.interior).length, people: g.life.people.length,
    ratio: g.engine.ratio, gtao: !!g.engine.gtao?.enabled, px: Math.round(g.engine.renderer.domElement.width * g.engine.renderer.domElement.height / 1000) + 'k',
  };
});

// ---------------------------------------------------------------- spots
// yaw 0 looks towards -Z (north), PI/2 towards -X (west)
const local = (key, lx, y) => ({ key, lx, y }); // inside a building: the middle of its biggest room
const SPOTS = [
  { name: 'home', hour: 7.2, at: null },
  { name: 'avenue', hour: 15, at: [20, 0.2, -3, -Math.PI / 2] },
  { name: 'dense', hour: 15, at: [-80, 0.2, 9, 0.35] },
  { name: 'mart', hour: 15, inside: local('civic-mart', 0, 0.2) },
  { name: 'cinema', hour: 15, inside: local('civic-cinema', 0, 0.2) },
  { name: 'school', hour: 15, at: [-120, 0.2, 113, Math.PI / 2] },
  { name: 'japan', hour: 15, at: [2180, 0.2, 4, -Math.PI / 2] },
  { name: 'night', hour: 21, at: [-30, 0.2, -9, -Math.PI / 2] },
  // out on the hills by the edge of the land (인혁 계획 6: "나무랑 땅이 보이게 해 줘")
  { name: 'hills', hour: 15, at: [-40, 0.2, -395, 0] },
  { name: 'edgeE', hour: 15, at: [620, 0.2, 10, -Math.PI / 2] },
  { name: 'edgeS', hour: 15, at: [20, 0.2, 520, Math.PI] },
];

async function goTo(s) {
  return G((s) => {
    const g = window.__game;
    window.__perf.hold = s.hour;
    g.state.hour = s.hour; g.sky.setHour(s.hour, true);
    if (s.at) g.player.place(s.at[0], s.at[1], s.at[2], s.at[3]);
    else if (s.inside) {
      // the middle of the building's biggest indoor room (it exists once the interior is built)
      const site = g.places.sites[s.inside.key];
      const vol = (v) => (v.max[0] - v.min[0]) * (v.max[2] - v.min[2]);
      const v = g.places.indoor.filter((x) => x.site === s.inside.key).sort((a, b) => vol(b) - vol(a))[0];
      if (v) g.player.place((v.min[0] + v.max[0]) / 2, v.min[1] + 0.2, (v.min[2] + v.max[2]) / 2 + Math.cos(site.worldYaw) * 3, site.worldYaw);
      else g.player.place(site.worldPos[0], s.inside.y, site.worldPos[2], site.worldYaw);
    } else g.day.wakeUp();
    g.player.pitch = -0.04;
    return null;
  }, s);
}

const results = {};
// 1) fly along the main avenue (west → east, 16 m/s, 1.6 m up) while interiors get built
if (!ONLY || ONLY.includes('drive')) {
  await G(() => { window.__perf.hold = 15; const g = window.__game; g.state.hour = 15; g.sky.setHour(15, true); });
  await settle(1500);
  const h0 = await heapMB();
  const n0 = await G(() => window.__game.places.lazy.filter((s) => s.interior).length);
  await G(() => {
    const g = window.__game, P = window.__perf;
    P.fly = { x: -270, done: false };
    P.rec = []; P.last = 0;
    g.engine.updaters.add(function fly(dt) {
      if (P.fly.done) return;
      P.fly.x += 16 * dt;
      if (P.fly.x > 290) { P.fly.done = true; g.engine.updaters.delete(fly); return; }
      g.player.place(P.fly.x, 0.2, 3.2, -Math.PI / 2);
    });
  });
  await page.waitForFunction(() => window.__perf.fly.done, null, { timeout: 240000, polling: 200 });
  const rec = await G(() => { const r = window.__perf.rec; window.__perf.rec = null; return r; });
  const dts = rec.slice(1).map((f) => f.dt);
  const long = rec.filter((f) => f.dt > 50);
  const builds = rec.filter((f) => f.built);
  results.drive = {
    frames: rec.length, ms: stat(dts), long50: long.length, long100: rec.filter((f) => f.dt > 100).length,
    built: builds.reduce((a, f) => a + f.built, 0) + 0, interiorsBefore: n0,
    buildMs: stat(builds.map((f) => f.buildMs)), worst: [...rec].sort((a, b) => b.dt - a.dt).slice(0, 5).map((f) => ({ dt: Math.round(f.dt), upd: Math.round(f.upd), rend: Math.round(f.rend), built: f.built, buildMs: Math.round(f.buildMs), newProgs: f.newProgs })),
    upd: stat(rec.map((f) => f.upd)), calls: stat(rec.map((f) => f.calls)), gpu: med(rec.map((f) => f.gpu)), cpu: med(rec.map((f) => f.upd + f.rend)),
    heapBefore: h0, heap: await heapMB(), ...(await scene()),
  };
  const d = results.drive;
  console.log(`drive: ${d.frames} frames, ${d.ms.avg} ms avg, p95 ${d.ms.p95}, max ${d.ms.max}, gpu ${d.gpu}, cpu ${d.cpu}, >50ms ${d.long50}, >100ms ${d.long100}, interiors built ${d.built} (${d.buildMs.avg} ms avg, max ${d.buildMs.max}), heap ${d.heap} MB`);
  console.log('  worst frames', JSON.stringify(d.worst));
}

for (const s of SPOTS) {
  if (ONLY && !ONLY.includes(s.name)) continue;
  await goTo(s);
  // let lazy interiors and people appear, lights settle and shaders compile
  await settle(2500);
  await page.waitForFunction(() => { const P = window.__perf; const r = window.__game.engine.renderer; const n = r.info.programs?.length ?? 0; const ok = P._pn === n; P._pn = n; return ok; }, null, { timeout: 20000, polling: 700 }).catch(() => {});
  await goTo(s); // player physics may have nudged it while waiting
  await settle(400);
  const free = await record(FRAMES, false);
  const sync = await record(Math.round(FRAMES * 0.6), true);
  const r = {
    ms: stat(free.slice(2).map((f) => f.dt)), gpu: med(free.map((f) => f.gpu)), cpu: med(free.map((f) => f.upd + f.rend)),
    work: stat(sync.map((f) => f.upd + f.rend + f.wait)), upd: stat(sync.map((f) => f.upd)), rend: stat(sync.map((f) => f.rend)),
    calls: Math.round(stat(free.map((f) => f.calls)).avg), shadow: Math.round(stat(free.map((f) => f.shadow)).avg), tris: Math.round(stat(free.map((f) => f.tris)).avg / 1000) + 'k',
    heap: await heapMB(), arrays: arraysMB, ...(await scene()),
    inside: await G(() => window.__game.places.inside(window.__game.player.pos)),
  };
  results[s.name] = r;
  if (SHOTS) await page.screenshot({ path: `${out}/${s.name}.png` });
  console.log(`${s.name.padEnd(7)} ${String(r.ms.avg).padStart(6)} ms (p95 ${r.ms.p95})  gpu ${r.gpu}  cpu ${r.cpu}  work ${r.work.avg} (p95 ${r.work.p95})  upd ${r.upd.avg}  calls ${r.calls} (sh ${r.shadow})  tris ${r.tris}  progs ${r.programs}  tex ${r.textures}  geo ${r.geometries}  meshes ${r.visible}/${r.meshes}  heap ${r.heap}${r.arrays != null ? '+' + r.arrays : ''} MB  px ${r.px} ratio ${r.ratio}${r.gtao ? ' gtao' : ''}${r.inside ? ' in ' + r.inside : ''}`);
}

const report = { url, viewport: [W, H, DPR], throttle: THROTTLE, startup: { cold, warm, boot }, results, errors };
writeFileSync(`${out}/perf.json`, JSON.stringify(report, null, 2));
if (errors.length) console.log('page errors:', errors.slice(0, 5));
console.log('perf check done', out);
await browser.close();
