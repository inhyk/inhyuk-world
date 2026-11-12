// DASH TOWER floors (levels 101-110): walking levels for the tower mode, where
// the cube does not run by itself (the designer: "맘대로 옆, 점프를 할수 있어야지").
// Left and right walk, the jump button jumps, blocks are walls and ceilings.
//
// A floor is a row of pieces (spike jumps, steps, two-wide pillars over spikes,
// a ring bridge, and a zigzag climb up the tower on jump pads) with three keys.
// Every floor is played in the real WebAssembly engine by a robot that presses
// left, right and jump at fixed places, at 60, 90, 120 and 144 Hz frame times;
// a floor is kept only when the robot reaches the end with all three keys at
// every rate. The seeds that worked go to extra-seeds.json.
//
// node games/dash-overdrive/classic/levels/tower.mjs [floor numbers 1-10]
// node games/dash-overdrive/classic/levels/tower.mjs --check   (replays the packed floors)
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {LEVELS, TOWER_FIRST, TOWER_FLOORS, objectText, REPORT_FILE, LEVEL_DIR} from './generate.mjs';
import {openEngine} from './engine-harness.mjs';

const SEEDS = new URL('./extra-seeds.json', import.meta.url);
const ENGINE_DIR = fileURLToPath(new URL('../../../../public/play/dash-overdrive/classic/engine', import.meta.url));
const SIM_SLOT = 91; // engine PlayingState::SIM_PLATFORMER_SLOT
const ATTEMPTS = 30;
// Walking is as fast as running (20.77 px a frame, 0.17 tile); a jump is 2.00
// tiles high and about 4.3 tiles long, a jump pad lifts 4.13 tiles.
const gx = c => 30 * c + 15;
const gy = r => 30 * r + 15;

function mulberry32(seed) {
  return function random() {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Frame times a browser gives at a refresh rate (whole milliseconds), in 60 fps frames.
function frameTimes(hz, count) {
  const out = [];
  let real = 0;
  for (let i = 0; i < count; i++) {
    const before = Math.floor(real);
    real += 1000 / hz;
    out.push(Math.fround((Math.floor(real) - before) / Math.fround(1000 / 60)));
  }
  return out;
}
const TRACKS = [['60', [1]], ['120', [0.5]], ['144', [Math.fround(5 / 12)]], ['60Hz', frameTimes(60, 3)], ['90Hz', frameTimes(90, 9)], ['144Hz', frameTimes(144, 18)]];

export class Floor {
  constructor(floor, random) {
    this.floor = floor;
    this.random = random;
    this.cells = new Map();
    this.extra = [];
    this.col = 0;
    this.h = 0;
    this.steps = [];
    this.keys = 0;
    this.block = [1, 2, 3, 4, 6, 7][floor % 6];
  }

  range(low, high) {
    return low + Math.floor(this.random() * (high - low + 1));
  }

  put(c, r, object) {
    this.cells.set(`${c},${r}`, object);
  }

  solid(c, r) {
    this.put(c, r, {id: this.block, x: gx(c), y: gy(r)});
  }

  // the surface the cube walks on from c0 to c1 (a block tower under it)
  surface(c0, c1, h = this.h) {
    for (let c = c0; c < c1; c++) for (let r = 0; r < h; r++) this.solid(c, r);
  }

  spike(c, r) {
    this.put(c, r, {id: 8, x: gx(c), y: gy(r)});
  }

  key(c, r) {
    this.keys++;
    this.extra.push({id: 204, x: gx(c), y: gy(r)});
  }

  walk(n) {
    this.surface(this.col, this.col + n);
    this.col += n;
    this.steps.push({dir: 1, until: {x: this.col - 1, grounded: true, h: this.h}});
  }

  // one or two spikes to jump over; with a key in the top of the jump
  spikes(w, withKey = false) {
    const s = this.col + 1;
    this.surface(this.col, s + w + 2);
    for (let c = s; c < s + w; c++) this.spike(c, this.h);
    if (withKey) this.key(s, this.h + 2);
    this.steps.push({dir: 1, jumpAt: s - 1.15, until: {x: s + w + 0.6, grounded: true, h: this.h}});
    this.col = s + w + 2;
  }

  stepUp() {
    const s = this.col + 2;
    this.surface(this.col, s);
    this.h++;
    this.surface(s, s + 3);
    this.steps.push({dir: 1, jumpAt: s - 1.3, until: {x: s + 0.5, grounded: true, h: this.h}});
    this.col = s + 3;
  }

  stepDown() {
    this.surface(this.col, this.col + 2);
    this.col += 2;
    this.h--;
    this.surface(this.col, this.col + 3);
    this.steps.push({dir: 1, until: {x: this.col + 0.5, grounded: true, h: this.h}});
    this.col += 3;
  }

  // two-wide pillars one tile up, three tiles of spikes between them (a walking
  // jump is about 4.3 tiles long, so the cube lands in the middle of the next one)
  pillars(n) {
    let p = this.col + 4;
    this.surface(this.col, p);
    const first = p;
    // up onto the first pillar: jump early, the jump comes down on it
    this.steps.push({dir: 1, jumpAt: p - 2.9, until: {x: p + 0.3, grounded: true, h: this.h + 1}});
    for (let i = 0; i < n; i++) {
      this.surface(p, p + 2, this.h + 1);
      const next = p + 5;
      for (let c = p + 2; c < next; c++) {
        this.surface(c, c + 1);
        this.spike(c, this.h);
      }
      if (i < n - 1) {
        this.steps.push({dir: 1, jumpAt: p + 1.0, until: {x: next + 0.3, grounded: true, h: this.h + 1}});
      } else {
        // off the last pillar down over the spikes
        this.surface(next, next + 3);
        this.steps.push({dir: 1, jumpAt: p + 1.0, until: {x: next + 0.5, grounded: true, h: this.h}});
        this.col = next + 3;
      }
      p = next;
    }
    void first;
  }

  // a long row of spikes with a ring above it: jump, then press at the ring
  ringBridge(len, withKey = false) {
    const s = this.col + 1;
    this.surface(this.col, s + len + 3);
    for (let c = s; c < s + len; c++) this.spike(c, this.h);
    this.extra.push({id: 36, x: gx(s + 1), y: gy(this.h + 2)});
    if (withKey) this.key(s + 3, this.h + 3);
    this.steps.push({dir: 1, jumpAt: s - 1.15, ringAt: s + 0.9, until: {x: s + len + 0.6, grounded: true, h: this.h}});
    this.col = s + len + 3;
  }

  // Zigzag up the tower on jump pads: ledges three tiles apart, odd ones on the
  // left and even ones on the right; the top one runs out to the right as a
  // walkway with a key, and the cube drops back to the floor after it.
  climb(levels, withKey = true) {
    const S = this.col + 2;
    this.surface(this.col, S + 16);
    const base = this.h;
    this.extra.push({id: 35, x: gx(S + 7), y: 2 + 30 * base});
    this.steps.push({dir: 1, until: {launched: base}});
    for (let k = 1; k <= levels; k++) {
      const top = base + 3 * k;
      const odd = k % 2 === 1;
      const from = odd ? S : S + 2;
      const to = k === levels ? S + 14 : odd ? S + 6 : S + 8;
      for (let c = from; c < to; c++) this.solid(c, top - 1);
      this.steps.push({dir: odd ? -1 : 1, rise: top + 0.3, until: {grounded: true, h: top}});
      if (k < levels) {
        this.extra.push({id: 35, x: gx(odd ? S : S + 7), y: 2 + 30 * top});
        this.steps.push({dir: odd ? -1 : 1, until: {launched: top}});
      } else {
        if (withKey) this.key(S + 10, top);
        // off the end of the walkway, then straight down (a long fall drifts far)
        this.steps.push({dir: 1, until: {x: S + 14.05}});
        this.steps.push({dir: 0, until: {grounded: true, h: base}});
      }
    }
    this.surface(S + 16, S + 18);
    this.col = S + 18;
  }

  // ---- more patterns (the designer: "너무 다 똑같은 패턴이야 다른패턴도 넣고")

  // two or three steps in a row, up or down, each two tiles wide
  stairs(n, up) {
    for (let i = 0; i < n; i++) {
      if (up && this.h < 4) {
        const s = this.col + 2;
        this.surface(this.col, s);
        this.h++;
        this.surface(s, s + 2);
        this.steps.push({dir: 1, jumpAt: s - 1.5, until: {x: s + 0.3, grounded: true, h: this.h}});
        this.col = s + 2;
      } else if (!up && this.h > 0) {
        this.surface(this.col, this.col + 2);
        this.col += 2;
        this.h--;
        this.surface(this.col, this.col + 2);
        this.steps.push({dir: 1, until: {x: this.col + 0.3, grounded: true, h: this.h}});
        this.col += 2;
      }
    }
    this.surface(this.col, this.col + 2);
    this.col += 2;
  }

  // floating two-wide steps over a sea of spikes, one tile higher each, then
  // back down the same way; a key waits on the top step
  skyStairs(n, withKey = false) {
    const base = this.h;
    const tops = [];
    for (let i = 0; i < n; i++) tops.push(base + 1 + i);
    for (let i = n - 2; i >= 0; i--) tops.push(base + 1 + i);
    let p = this.col + 3;
    this.surface(this.col, p);
    const start = p - 1;
    let prevTop = base;
    let prevP = p;
    for (const [i, top] of tops.entries()) {
      // a walking jump goes further when it comes down a step
      if (i > 0) p = prevP + (top >= prevTop ? 4 : 5);
      for (let c = p; c < p + 2; c++) this.solid(c, top - 1);
      if (withKey && i === n - 1) this.key(p, top);
      const jumpAt = i === 0 ? p - 2.9 : prevP + (top >= prevTop ? 1.0 : 0.5);
      this.steps.push({dir: 1, jumpAt, until: {x: p + 0.2, grounded: true, h: top}});
      prevP = p;
      prevTop = top;
    }
    // down to the floor past the spikes
    const landing = prevP + 5;
    for (let c = start; c < landing; c++) {
      this.surface(c, c + 1);
      if (!this.cells.has(`${c},${base}`)) this.spike(c, base);
    }
    this.surface(landing, landing + 3);
    this.steps.push({dir: 1, jumpAt: prevP + 0.5, until: {x: landing + 0.3, grounded: true, h: base}});
    this.col = landing + 3;
  }

  // a wall three tiles high that no jump clears: a jump pad flies over it
  padWall() {
    const w = this.col + 5;
    this.surface(this.col, w + 6);
    this.extra.push({id: 35, x: gx(w - 2), y: 2 + 30 * this.h});
    for (let c = w; c < w + 2; c++) for (let r = this.h; r < this.h + 3; r++) this.solid(c, r);
    this.steps.push({dir: 1, until: {x: w + 2.5, grounded: true, h: this.h}});
    this.col = w + 6;
  }

  // a low tunnel with spikes hanging from its roof: jumping in here hurts
  spikeTunnel(len) {
    const s = this.col + 1;
    this.surface(this.col, s + len + 1);
    for (let c = s; c < s + len; c++) {
      this.put(c, this.h + 1, {id: 8, x: gx(c), y: gy(this.h + 1), flipY: true});
      this.solid(c, this.h + 2);
    }
    this.steps.push({dir: 1, until: {x: s + len + 0.2, grounded: true, h: this.h}});
    this.col = s + len + 1;
  }

  // a longer sea of spikes with two or three rings: press at every ring
  ringChain(n, rise = [0, 1, 1], gap = 4) {
    const s = this.col + 1;
    const len = 4 + gap * (n - 1);
    this.surface(this.col, s + len + 3);
    for (let c = s; c < s + len; c++) this.spike(c, this.h);
    const rings = [];
    // the second ring sends the cube higher, so the next rings sit a tile higher (measured)
    for (let i = 0; i < n; i++) {
      this.extra.push({id: 36, x: gx(s + 1 + gap * i), y: gy(this.h + 2 + rise[i])});
      rings.push(s + 0.9 + gap * i);
    }
    this.steps.push({dir: 1, jumpAt: s - 1.15, rings, until: {x: s + len + 0.6, grounded: true, h: this.h}});
    this.col = s + len + 3;
  }

  // a key up on a ledge behind: a pad lifts the cube, it turns back left for the
  // key, drops off the far end of the ledge and walks on over the pad again
  backtrackKey() {
    const base = this.h;
    const p = this.col + 9;
    this.surface(this.col, p + 6);
    this.extra.push({id: 35, x: gx(p), y: 2 + 30 * base});
    const top = base + 3;
    for (let c = p - 6; c < p - 1; c++) this.solid(c, top - 1);
    this.key(p - 5, top);
    this.steps.push({dir: 1, until: {launched: base}});
    this.steps.push({dir: -1, rise: top + 0.3, until: {grounded: true, h: top}});
    this.steps.push({dir: -1, until: {x: p - 8, grounded: true, h: base}});
    this.steps.push({dir: 1, until: {x: p + 3, grounded: true, h: base}});
    this.col = p + 6;
  }

  text() {
    const hue = (24 + this.floor * 28) % 360;
    const color = ([r, g, b]) => `1_${r}_2_${g}_3_${b}`;
    const spec = LEVELS[TOWER_FIRST + this.floor];
    const [background, ground] = spec.colors[0];
    void hue;
    const end = {id: 29, x: 30 * this.col, y: 0, color: background, duration: 0.5};
    const objects = [...this.cells.values(), ...this.extra, end];
    return `kS29,${color(background)},kS30,${color(ground)};${objects.map(objectText).join(';')};`;
  }
}

// What a floor is made of. Every floor mixes many patterns (never the same one
// twice in a row), more and longer ones higher up, with the pad climb in the
// middle. Keys: the climb's walkway, and two of the key ledge behind, the top
// of the sky stairs, a ring and a spike jump.
const PATTERNS = [
  // name, weight, first floor (0 = 1F)
  ['spikes', 3, 0], ['pillars', 2, 0], ['stairs', 2, 0], ['ring', 2, 1], ['tunnel', 2, 1],
  ['padWall', 2, 1], ['skyStairs', 2, 2], ['backtrack', 1, 2], ['ringChain', 2, 3],
];
export function buildFloor(floor, seed) {
  const random = mulberry32(seed);
  const f = new Floor(floor, random);
  const pool = PATTERNS.filter(([, , from]) => floor >= from);
  const count = 6 + floor;
  const pieces = [];
  // the floor shows at least four different patterns (or all it has)
  const kinds = pool.map(([name]) => name);
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  pieces.push(...kinds.slice(0, Math.min(kinds.length, 4 + Math.floor(floor / 3))));
  while (pieces.length < count) {
    const options = pool.filter(([name]) => name !== pieces.at(-1) && !(name === 'backtrack' && pieces.includes('backtrack')));
    let total = 0;
    for (const [, weight] of options) total += weight;
    let roll = random() * total;
    for (const [name, weight] of options) {
      roll -= weight;
      if (roll < 0) {
        pieces.push(name);
        break;
      }
    }
  }
  // shuffle again, then split any pattern that ended up twice in a row
  for (let i = pieces.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
  }
  for (let i = 1; i < pieces.length; i++) {
    if (pieces[i] !== pieces[i - 1]) continue;
    const j = pieces.findIndex((name, k) => k > i && name !== pieces[i] && name !== pieces[i - 1]);
    if (j > 0) [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
  }
  pieces.splice(Math.floor(pieces.length / 2), 0, 'climb');
  // which two pieces hold keys besides the climb
  const keyed = new Set();
  for (const name of ['backtrack', 'skyStairs', 'ring', 'ringChain', 'spikes']) {
    const index = pieces.indexOf(name);
    if (index >= 0 && keyed.size < 2 && name !== 'ringChain') keyed.add(index);
  }
  const climbLevels = floor < 2 ? 2 : floor < 6 ? 4 : 6;
  const run = Math.max(1, 3 - Math.floor(floor / 4));
  f.walk(4);
  f.stepOwner = [];
  for (const [index, piece] of pieces.entries()) {
    const key = keyed.has(index);
    if (piece === 'climb') {
      while (f.h > 0) f.stepDown();
      f.climb(climbLevels);
    } else if (piece === 'spikes') {
      f.spikes(floor < 3 ? 1 : f.range(1, 2), key);
    } else if (piece === 'pillars') {
      f.pillars(2 + Math.floor(floor / 3) + f.range(0, 1));
    } else if (piece === 'ring') {
      f.ringBridge(floor < 5 ? 4 : 5, key);
    } else if (piece === 'stairs') {
      f.stairs(f.range(2, 3), f.h < 2);
    } else if (piece === 'tunnel') {
      f.spikeTunnel(4 + Math.floor(floor / 2));
    } else if (piece === 'padWall') {
      f.padWall();
    } else if (piece === 'skyStairs') {
      f.skyStairs(floor < 6 ? 3 : 4, key);
    } else if (piece === 'backtrack') {
      f.backtrackKey();
    } else if (piece === 'ringChain') {
      f.ringChain(floor < 7 ? 2 : 3);
    }
    f.walk(run);
    while (f.stepOwner.length < f.steps.length) f.stepOwner.push(piece);
  }
  while (f.keys < 3) f.ringBridge(4, true);
  while (f.h > 0) f.stepDown();
  f.walk(5);
  f.pieces = pieces;
  return f;
}

// Plays a floor in the engine with the robot; returns {ok, x, keys, frames} per track.
async function play(engine, text, steps, slot, write = true) {
  return engine.page.evaluate(({text, steps, slot, write, tracks}) => {
    if (write) {
      try { FS.mkdir('/res/leveldata'); } catch (error) { /* already there */ }
      FS.writeFile(`/res/leveldata/${slot}.level`, text);
    }
    const results = [];
    for (const [name, dts] of tracks) {
      Module._sim_load(slot);
      let k = 0;
      let press = 0;
      let jumped = false;
      let ringed = false;
      let ring = 0;
      let status = 0;
      let frames = 0;
      const crossed = (x, at, dir) => (dir >= 0 ? x >= at : x <= at);
      for (; frames < 20000 && status === 0; frames++) {
        const x = Module._sim_x() / 120;
        const h = (816 - Module._sim_y()) / 120;
        const grounded = Module._sim_grounded() === 1;
        // move on to the next step when this one is done
        for (;;) {
          const s = steps[k];
          if (!s) break;
          const u = s.until;
          let done = true;
          if (u.launched !== undefined) done = !grounded && h > u.launched + 0.6;
          if (u.x !== undefined) done = done && crossed(x, u.x, s.dir);
          if (u.grounded) done = done && grounded;
          if (u.h !== undefined) done = done && Math.abs(h - u.h) < 0.05;
          if (!done) break;
          k++;
          jumped = false;
          ringed = false;
          ring = 0;
        }
        const s = steps[Math.min(k, steps.length - 1)];
        let buttons = 0;
        if (!s.rise || h > s.rise) buttons |= s.dir > 0 ? 4 : s.dir < 0 ? 2 : 0;
        if (s.jumpAt !== undefined && !jumped && grounded && crossed(x, s.jumpAt, s.dir)) {
          jumped = true;
          press = 4;
        }
        if (s.ringAt !== undefined && jumped && !ringed && !grounded && crossed(x, s.ringAt, s.dir)) {
          ringed = true;
          press = 4;
        }
        if (s.rings && jumped && !grounded && ring < s.rings.length && crossed(x, s.rings[ring], s.dir)) {
          ring++;
          press = 4;
        }
        if (press > 0) {
          buttons |= 1;
          press--;
        }
        status = Module._sim_step_buttons(buttons, dts[frames % dts.length]);
      }
      results.push({track: name, ok: status === 2, x: +(Module._sim_x() / 120).toFixed(1), keys: Module._sim_coins(), frames, step: k});
    }
    return results;
  }, {text, steps, slot, write, tracks: TRACKS});
}

export const playFloor = (engine, text, steps) => play(engine, text, steps, SIM_SLOT);

const passed = results => results.every(result => result.ok && result.keys === 7);

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const wanted = args.map(Number).filter(Boolean);
  const seeds = existsSync(SEEDS) ? JSON.parse(readFileSync(SEEDS, 'utf8')) : {};
  const engine = await openEngine(ENGINE_DIR);
  let failures = 0;
  try {
    for (let floor = 0; floor < TOWER_FLOORS; floor++) {
      if (wanted.length && !wanted.includes(floor + 1)) continue;
      const number = TOWER_FIRST + floor + 1;
      const name = LEVELS[TOWER_FIRST + floor].name;
      if (check) {
        // the packed file, with the robot steps saved in the report
        const report = JSON.parse(readFileSync(REPORT_FILE, 'utf8'));
        const results = await play(engine, '', report[number].steps, TOWER_FIRST + floor, false);
        console.log(`${name}: ${results.map(r => `${r.track} ${r.ok ? 'ok' : `FAIL at ${r.x}`} keys ${r.keys}`).join(', ')}`);
        if (!passed(results)) failures++;
        continue;
      }
      const first = seeds[number] ?? 13000 + floor * 41;
      let kept = null;
      for (let attempt = 0; attempt < ATTEMPTS && !kept; attempt++) {
        const seed = first + attempt;
        const built = buildFloor(floor, seed);
        const text = built.text();
        const results = await play(engine, text, built.steps, SIM_SLOT);
        if (process.env.DEBUG_TOWER) console.log(seed, JSON.stringify(results));
        if (passed(results)) kept = {seed, attempt, built, text, results};
      }
      if (!kept) {
        failures++;
        console.log(`${name}: no seed passed in ${ATTEMPTS} tries`);
        continue;
      }
      writeFileSync(new URL(`${TOWER_FIRST + floor}.level`, LEVEL_DIR), kept.text);
      const report = JSON.parse(readFileSync(REPORT_FILE, 'utf8'));
      const objects = kept.text.split(';').length - 2;
      report[number] = {
        name, platformer: true, objects, columns: kept.built.col, coins: 3,
        seconds: +(kept.results[0].frames / 60).toFixed(2),
        tracks: kept.results.map(result => result.track), steps: kept.built.steps,
      };
      writeFileSync(REPORT_FILE, JSON.stringify(report));
      seeds[number] = kept.seed;
      writeFileSync(SEEDS, `${JSON.stringify(seeds, null, 1)}\n`);
      console.log(`${name}: seed ${kept.seed} (try ${kept.attempt + 1}), ${objects} objects, ${kept.built.col} tiles, robot ${report[number].seconds} s at 60 fps, keys 3`);
    }
  } finally {
    await engine.close();
  }
  if (failures) process.exitCode = 1;
}
