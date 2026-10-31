// Checks the built levels. For every level:
// - the inputs recorded while building finish it (JavaScript physics, 60 and 120 fps),
// - the same taps and ship flying still finish it with uneven frame times
//   (120 Hz, 144 Hz, 90 Hz and a shaky 60 Hz, like a real browser),
// - with --engine, the real WebAssembly engine finishes it with those inputs too.
// node games/dash-overdrive/classic/levels/verify.mjs [--engine] [level numbers...]
import {readFileSync} from 'node:fs';
import {parseLevel, newPlayer, step} from './physics.mjs';
import {shipBot, pathFrom, tapHeld, TRACKS} from './generate.mjs';

const f = Math.fround;
const args = process.argv.slice(2);
const useEngine = args.includes('--engine');
const wanted = args.map(Number).filter(Boolean);
const report = JSON.parse(readFileSync(new URL('./report.json', import.meta.url), 'utf8'));
const levelText = index => readFileSync(new URL(`../res/leveldata/${index}.level`, import.meta.url), 'utf8');

function expand(runs) {
  const out = [];
  for (let i = 0; i < runs.length; i += 2) for (let n = 0; n < runs[i + 1]; n++) out.push(runs[i]);
  return out;
}

// Frame times the engine computes from millisecond ticks at a given refresh rate.
function frameTimes(hz, count) {
  const out = [];
  let real = 0;
  for (let i = 0; i < count; i++) {
    const before = Math.floor(real);
    real += 1000 / hz;
    out.push(f((Math.floor(real) - before) / f(1000 / 60)));
  }
  return out;
}

// Coins the player box touched on the way.
function touchCoins(level, player, taken) {
  for (const coin of level.objects) {
    if (coin.type !== 'coin' || taken.has(coin.index)) continue;
    const h = coin.hitbox;
    if (player.x < h.x + h.w && player.x + 120 > h.x && player.y < h.y + h.h && player.y + 120 > h.y) taken.add(coin.index);
  }
}

function replay(level, inputs, dts) {
  const player = newPlayer();
  const taken = new Set();
  for (let i = 0; i < inputs.length; i++) {
    const status = step(player, level, inputs[i] === 1, Array.isArray(dts) ? dts[i] : dts);
    touchCoins(level, player, taken);
    if (status) return {status, x: player.x, steps: i + 1, coins: taken.size};
  }
  return {status: 0, x: player.x, coins: taken.size};
}

// Plays the level's taps and flies its ship parts with the bot, like a player would.
function live(level, entry, dts) {
  const player = newPlayer();
  const bots = entry.shipPaths.map(waypoints => ({from: waypoints[0][0], to: waypoints.at(-1)[0], bot: shipBot(pathFrom(waypoints))}));
  const inputs = [];
  let ticks = 0;
  for (let i = 0; i < dts.length; i++) {
    const dt = dts[i];
    let held = tapHeld(entry.taps, Math.round(ticks));
    if (player.ship) {
      const flight = bots.find(b => player.x >= b.from - 480 && player.x <= b.to + 480);
      if (flight) held = flight.bot(player, dt);
    }
    inputs.push(held ? 1 : 0);
    const status = step(player, level, held, dt);
    ticks += dt * 2;
    if (status === 1) return {ok: false, x: player.x, inputs};
    if (status === 2) return {ok: true, inputs};
  }
  return {ok: false, x: player.x, inputs};
}

let failures = 0;
const engine = useEngine ? await (await import('./engine-harness.mjs')).openEngine(new URL('../../../../public/play/dash-overdrive/classic/engine/', import.meta.url).pathname) : null;
for (const [number, entry] of Object.entries(report)) {
  if (wanted.length && !wanted.includes(Number(number))) continue;
  const text = levelText(Number(number) - 1);
  const level = parseLevel(text);
  const lines = [];
  for (const [name, runs] of Object.entries(entry.inputs)) {
    const pattern = TRACKS.find(track => track.name === name).dts;
    const inputs = [...expand(runs), ...Array(2000).fill(0)];
    const dts = inputs.map((_, i) => pattern[i % pattern.length]);
    const result = replay(level, inputs, dts);
    lines.push(`${name} rec ${result.status === 2 ? 'ok' : 'FAIL at tile ' + (result.x / 120).toFixed(1)}`);
    if (result.status !== 2) failures++;
    if (result.coins !== 3) {
      lines.push(`only ${result.coins} coins`);
      failures++;
    }
    if (engine && (name === '60' || name === '120 uneven')) {
      const wasm = await engine.trajectory(text, inputs, dts);
      lines.push(`engine ${wasm.status === 2 ? 'ok' : 'FAIL at tile ' + (wasm.frames.at(-1)[0] / 120).toFixed(1)}`);
      if (wasm.status !== 2) failures++;
    }
  }
  for (const hz of [120, 144, 90, 60]) {
    const dts = frameTimes(hz, 30000);
    const result = live(level, entry, dts);
    lines.push(`${hz}Hz live ${result.ok ? 'ok' : 'FAIL at tile ' + (result.x / 120).toFixed(1)}`);
    if (!result.ok) failures++;
    if (engine && hz === 144) {
      const wasm = await engine.trajectory(text, result.inputs, dts.slice(0, result.inputs.length));
      lines.push(`engine ${wasm.status === 2 || !result.ok ? (wasm.status === 2 ? 'ok' : 'same fail') : 'FAIL'}`);
      if (result.ok && wasm.status !== 2) failures++;
    }
  }
  console.log(`level ${number} ${entry.name}: ${lines.join(', ')}`);
}
if (engine) await engine.close();
console.log(failures ? `${failures} problem(s)` : 'all levels finish');
process.exitCode = failures ? 1 : 0;
