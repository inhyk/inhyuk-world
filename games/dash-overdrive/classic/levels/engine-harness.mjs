// Loads the built WebAssembly engine in headless Chromium and exposes its
// level-checker functions (sim_load, sim_step, ...) to Node.
import {chromium} from '../../../../tools/node_modules/playwright/index.mjs';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

const ORIGIN = 'http://classic.test';
const TYPES = {'.js': 'text/javascript', '.wasm': 'application/wasm', '.data': 'application/octet-stream', '.html': 'text/html'};

const PAGE = `<!doctype html><html><body><canvas id="canvas" width="320" height="180"></canvas>
<script>
var Module = {
  canvas: document.getElementById('canvas'),
  locateFile: path => '/engine/' + path,
  print() {},
  printErr(message) { console.log('engine:', message); },
  classicReady() { window.engineReady = true; },
};
</script><script src="/engine/DashClassic.js"></script></body></html>`;

export async function openEngine(engineDir) {
  const browser = await chromium.launch({headless: true});
  const page = await browser.newPage();
  page.on('pageerror', error => console.error('page error:', error.message));
  await page.route(`${ORIGIN}/**`, async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/') return route.fulfill({contentType: 'text/html', body: PAGE});
    const name = path.replace(/^\/engine\//, '');
    const body = await readFile(join(engineDir, name));
    return route.fulfill({contentType: TYPES[name.slice(name.lastIndexOf('.'))] || 'application/octet-stream', body});
  });
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => window.engineReady === true, null, {timeout: 60000});
  return {
    browser,
    page,
    // Runs inputs (0/1 per frame) with one frame time or a list of them, and
    // returns per-frame [x, y, vy, ship, gravity, grounded] plus the end status.
    async trajectory(levelText, inputs, dt, slot = 90) {
      return page.evaluate(({levelText, inputs, dt, slot}) => {
        try { FS.mkdir('/res/leveldata'); } catch (error) { /* already there */ }
        FS.writeFile(`/res/leveldata/${slot}.level`, levelText);
        Module._sim_load(slot);
        const frames = [];
        let status = 0;
        for (let i = 0; i < inputs.length && status === 0; i++) {
          status = Module._sim_step(inputs[i], Array.isArray(dt) ? dt[i] : dt);
          frames.push([Module._sim_x(), Module._sim_y(), Module._sim_vy(), Module._sim_mode(), Module._sim_gravity(), Module._sim_grounded()]);
        }
        return {status, frames, endX: Module._sim_end_x()};
      }, {levelText, inputs, dt, slot});
    },
    async close() {
      await browser.close();
    },
  };
}
