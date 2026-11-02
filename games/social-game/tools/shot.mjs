// node games/social-game/tools/shot.mjs "<url>" out.png [width] [height]
// Screenshots a page once window.__ready is true. Uses the repo's shared Playwright install.
const { chromium } = await import('../../../tools/node_modules/playwright/index.mjs').catch(() => import(process.env.PLAYWRIGHT_MJS ?? 'playwright'));
const [url, out, w = '1280', h = '800'] = process.argv.slice(2);
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
await page.waitForTimeout(Number(process.env.SHOT_WAIT ?? 600));
await page.screenshot({ path: out });
const info = await page.evaluate(() => ({ err: window.__error, stats: window.__stats, gl: (() => { const c = document.createElement('canvas').getContext('webgl2'); const d = c && c.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'n/a'; })() }));
console.log(JSON.stringify(info));
for (const l of logs.slice(0, 15)) console.log(l);
await browser.close();
