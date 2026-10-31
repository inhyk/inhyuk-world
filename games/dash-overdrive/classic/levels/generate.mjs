// Builds the 15 built-in levels of Dash Overdrive Classic into res/leveldata/.
//
// A level is built left to right, one piece at a time. Each piece is played by
// the engine's own physics (physics.mjs) from the exact moment the previous
// piece ended: every tap time is tried, and the piece is kept only when the
// window of working taps is wide enough for the level's difficulty and the
// middle of that window also works at 120 fps. Ship parts are flown by a bot
// that must survive with a late reaction and an off-centre aim.
//
// node games/dash-overdrive/classic/levels/generate.mjs [level numbers...]
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {parseLevel, newPlayer, clonePlayer, step, TILE, SPEED_PER_FRAME} from './physics.mjs';

const OUT = new URL('../res/leveldata/', import.meta.url);
const REPORT = new URL('./report.json', import.meta.url);
const TIMELINE = new URL('../music/timeline.json', import.meta.url);

// Plans count time in ticks of 1/120 s, so a 60 fps step is 2 ticks.
const TICKS_PER_SECOND = 120;
const TAP = 8; // a tap holds the button for 4 frames
// Frame times the checker plays with, in 60 fps frames. Browsers measure whole
// milliseconds, so a real 60 Hz screen gives 16, 17, 17 ms frames.
const MS = ms => Math.fround(ms / Math.fround(1000 / 60));
export const TRACKS = [
  {name: '60', dts: [1]},
  {name: '120', dts: [0.5]},
  {name: '144', dts: [Math.fround(5 / 12)]},
  {name: '60 uneven', dts: [MS(16), MS(17), MS(17)]},
  {name: '120 uneven', dts: [MS(8), MS(8), MS(9)]},
];
const ONE = [1];

// Time in ticks (1/120 s) at the start of step `index`.
export function tickAt(dts, index) {
  let period = 0;
  for (const dt of dts) period += dt * 2;
  let ticks = Math.floor(index / dts.length) * period;
  for (let i = 0; i < index % dts.length; i++) ticks += dts[i] * 2;
  return ticks;
}
const CEILING_ROW = 4; // block ceiling for upside-down parts
const FLOOR = 936;

export const LEVELS = [
  {name: 'Neon Start', bpm: 124.632, seconds: 64, colors: [[[40, 125, 255], [0, 86, 230]], [[255, 64, 170], [190, 24, 120]]]},
  {name: 'Pixel Hop', bpm: 138.48, seconds: 68, colors: [[[40, 200, 120], [0, 140, 90]], [[255, 170, 40], [215, 105, 0]]]},
  {name: 'Blue Ladder', bpm: 124.632, seconds: 72, colors: [[[64, 96, 255], [30, 52, 205]], [[155, 64, 255], [92, 30, 200]]]},
  {name: 'Desert Wind', bpm: 138.48, seconds: 74, colors: [[[240, 170, 60], [196, 108, 28]], [[255, 112, 64], [200, 60, 30]]]},
  {name: 'Iron Gate', bpm: 155.79, seconds: 78, colors: [[[124, 136, 160], [70, 80, 104]], [[255, 96, 44], [160, 42, 20]]]},
  {name: 'Night Rail', bpm: 124.632, seconds: 80, colors: [[[56, 40, 140], [26, 14, 84]], [[130, 48, 214], [66, 22, 140]]]},
  {name: 'Sky Rocket', bpm: 155.79, seconds: 82, colors: [[[64, 190, 255], [22, 120, 222]], [[255, 214, 64], [228, 146, 20]]]},
  {name: 'Crystal Cave', bpm: 138.48, seconds: 84, colors: [[[84, 220, 232], [30, 140, 172]], [[184, 124, 255], [110, 60, 200]]]},
  {name: 'Thunder Road', bpm: 178.05, seconds: 86, colors: [[[255, 206, 44], [170, 118, 0]], [[90, 90, 120], [40, 40, 64]]]},
  {name: 'Lava Lift', bpm: 155.79, seconds: 88, colors: [[[255, 92, 32], [170, 40, 10]], [[255, 172, 34], [200, 82, 0]]]},
  {name: 'Star Factory', bpm: 138.48, seconds: 90, colors: [[[255, 92, 200], [170, 40, 140]], [[72, 220, 255], [20, 140, 200]]]},
  {name: 'Frost Bite', bpm: 178.05, seconds: 92, colors: [[[172, 230, 255], [90, 170, 230]], [[84, 124, 255], [40, 70, 200]]]},
  {name: 'Laser Maze', bpm: 155.79, seconds: 94, colors: [[[44, 255, 164], [0, 170, 110]], [[255, 44, 96], [170, 10, 60]]]},
  {name: 'Black Hole', bpm: 138.48, seconds: 96, colors: [[[90, 36, 120], [36, 6, 60]], [[176, 20, 72], [86, 0, 34]]]},
  {name: 'Overdrive', bpm: 178.05, seconds: 100, colors: [[[150, 230, 60], [76, 160, 26]], [[40, 92, 236], [20, 50, 180]], [[255, 64, 128], [170, 20, 80]]]},
  // secret levels, opened with coins
  {name: 'Golden Key', bpm: 138.48, seconds: 102, colors: [[[255, 196, 40], [176, 112, 0]], [[60, 40, 120], [26, 14, 70]]]},
  {name: 'Secret Core', bpm: 178.05, seconds: 106, colors: [[[40, 230, 210], [0, 140, 130]], [[120, 20, 60], [60, 0, 30]]]},
  {name: 'Last Dash', bpm: 178.05, seconds: 110, colors: [[[255, 60, 60], [150, 10, 20]], [[20, 20, 40], [6, 6, 16]], [[191, 255, 89], [90, 170, 30]]]},
];

// How hard each level is. margin = half of the narrowest allowed tap window in
// 60 fps frames; runway = free tiles between pieces.
function tuning(d) {
  return {
    margin: [3, 3, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1][d],
    runway: [[1, 4], [1, 3], [1, 3], [1, 3], [1, 2], [1, 2], [0, 2], [0, 2], [0, 2], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 0]][d],
    shipGap: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3][d],
    shipSpacing: [6, 6, 5, 5, 5, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3][d],
    shipShift: [2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4][d],
    shipSpikes: d >= 1,
    shipSpikesInNarrowGaps: d >= 12,
    shipFloorSpikes: d >= 4,
    shipCeilingSpikes: d >= 7,
    shipDelay: [4, 4, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2][d],
    shipAim: [40, 38, 36, 32, 30, 28, 26, 24, 22, 20, 18, 16, 14, 12, 12, 11, 10, 10][d],
    halfBeats: d >= 3,
    maxSurface: d < 2 ? 3 : 4,
    comboMax: [2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 7, 7][d],
    comboGapMax: [3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2][d],
  };
}

// Which pieces a level may use, with weights. Each piece lists the lowest difficulty.
const PIECES = [
  {name: 'spikes1', from: 0, weight: 3},
  {name: 'spikes2', from: 0, weight: 4},
  {name: 'spikes3', from: 3, weight: 3},
  {name: 'small', from: 0, weight: 2},
  {name: 'stepUp', from: 0, weight: 3},
  {name: 'stepDown', from: 0, weight: 2},
  {name: 'pillar', from: 0, weight: 2},
  {name: 'pillarSpike', from: 1, weight: 3},
  {name: 'gap', from: 0, weight: 3},
  {name: 'pad', from: 0, weight: 2},
  {name: 'orbPit', from: 1, weight: 3},
  {name: 'platformSpike', from: 1, weight: 3},
  {name: 'hopUpGap', from: 2, weight: 3},
  {name: 'slabHop', from: 2, weight: 3},
  {name: 'ceilingSpikes', from: 4, weight: 3},
  {name: 'padSpikes', from: 2, weight: 2},
  {name: 'combo', from: 0, weight: 6},
];
const UPSIDE_PIECES = ['spikes1', 'spikes2', 'spikes3', 'small', 'orbPit', 'combo', 'combo'];

function mulberry32(seed) {
  return function random() {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Objects. GD units: a tile is 30 wide; column c is centred at 30c + 15 and
// row r (0 sits on the floor) at 30r + 15.
const gx = c => 30 * c + 15;
const gy = r => 30 * r + 15;

function objectText(o) {
  const parts = [1, o.id, 2, o.x, 3, o.y];
  if (o.flipY) parts.push(5, 1);
  if (o.color) parts.push(7, o.color[0], 8, o.color[1], 9, o.color[2], 10, o.duration);
  return parts.join(',');
}

const make = {
  block: (c, r, id = 1) => ({id, x: gx(c), y: gy(r)}),
  fill: (c, r) => ({id: 5, x: gx(c), y: gy(r), deco: true}),
  spike: (c, r, flipY = false) => ({id: 8, x: gx(c), y: gy(r), flipY}),
  // small spikes sit on the floor of their cell, or hang from its roof
  small: (c, r, flipY = false) => ({id: 39, x: gx(c), y: (flipY ? 23.25 : 6.75) + 30 * r, flipY}),
  slab: (c, r) => ({id: 40, x: gx(c), y: 23.25 + 30 * r}),
  pad: (c, r, flipY = false) => ({id: 35, x: gx(c), y: (flipY ? 28 : 2) + 30 * r, flipY}),
  orb: (c, r) => ({id: 36, x: gx(c), y: gy(r)}),
  shipPortal: (c, r) => ({id: 13, x: gx(c), y: 42 + 30 * r}),
  cubePortal: (c, r) => ({id: 12, x: gx(c), y: 42 + 30 * r}),
  upsidePortal: (c, r) => ({id: 11, x: gx(c), y: 36.5 + 30 * r}),
  // centred on the cube running upside down in row r
  normalPortal: (c, r) => ({id: 10, x: gx(c), y: gy(r)}),
  trigger: (c, id, color, duration) => ({id, x: 30 * c, y: 0, color, duration}),
  decoration: (c, id, y) => ({id, x: gx(c), y, deco: true}),
};

// ---------------------------------------------------------------------------
// Simulation helpers

export function tapHeld(taps, tick) {
  for (const tap of taps) if (tick >= tap - 1e-6 && tick < tap + TAP - 1e-6) return true;
  return false;
}

// Ship bot: aims the box top at path(x) a few frames ahead.
export function pathFrom(waypoints) {
  return x => {
    if (x <= waypoints[0][0]) return waypoints[0][1];
    for (let i = 1; i < waypoints.length; i++) {
      const [x1, y1] = waypoints[i];
      const [x0, y0] = waypoints[i - 1];
      if (x <= x1) return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
    return waypoints.at(-1)[1];
  };
}

export function shipBot(path, aim = 0, delay = 0) {
  const queue = [];
  let held = false;
  return (player, dt) => {
    const framesAhead = 6;
    const ahead = player.x + SPEED_PER_FRAME * framesAhead;
    const target = path(ahead) + aim;
    const predicted = player.y + player.vy * 0.9 * framesAhead;
    if (predicted > target + 8) held = true;
    else if (predicted < target - 8) held = false;
    queue.push(held);
    const lag = Math.round(delay / dt);
    return queue.length > lag ? queue[queue.length - 1 - lag] : false;
  };
}

// Plays from a saved state until done(player) or death.
function play(level, start, dts, plan, done, maxSteps = 4000) {
  const player = clonePlayer(start.player);
  player.pressed = [];
  let index = start.steps;
  const inputs = [];
  for (let n = 0; n < maxSteps; n++, index++) {
    const dt = dts[index % dts.length];
    const tick = tickAt(dts, index);
    let held = tapHeld(plan.taps, tick);
    if (player.ship && plan.bot) held = plan.bot(player, dt);
    const status = step(player, level, held, dt);
    inputs.push(held ? 1 : 0);
    if (status === 1) return {ok: false, x: player.x, steps: index + 1};
    // Passing the last object of a partial level is not the end of the piece.
    if (done(player)) return {ok: true, player, steps: index + 1, inputs};
  }
  return {ok: false, x: player.x, timeout: true};
}

// ---------------------------------------------------------------------------

class LevelBuilder {
  constructor(index) {
    this.index = index;
    this.spec = LEVELS[index];
    this.tune = tuning(index);
    this.random = mulberry32(1000 + index * 7919);
    this.cells = new Map(); // "c,r" -> object on the tile grid
    this.extra = []; // pads, orbs, portals, triggers, decorations
    this.taps = [];
    this.column = 0;
    this.surface = 0; // rows the cube runs above the floor
    this.tracks = TRACKS.map(track => ({...track, state: {player: newPlayer(), steps: 0}, inputs: []}));
    this.pieces = [];
    this.minMargin = Infinity;
    this.beatTiles = SPEED_PER_FRAME * 60 / TILE * 60 / this.spec.bpm;
    // each level gets its own block patterns for platforms and ship walls
    const styles = [1, 2, 3, 4, 6, 7];
    this.platformBlock = styles[index % styles.length];
    this.wallBlock = styles[(index * 5 + 3) % styles.length];
  }

  pick(list) {
    return list[Math.floor(this.random() * list.length)];
  }

  range(low, high) {
    return low + Math.floor(this.random() * (high - low + 1));
  }

  put(c, r, object) {
    const key = `${c},${r}`;
    const current = this.cells.get(key);
    // a real block always wins over decoration fill
    if (current && !current.deco && object.deco) return;
    this.cells.set(key, object);
  }

  // Objects near and after column `from`, for fast simulation.
  levelText(objects, from = -Infinity) {
    const header = levelHeader(this.spec.colors[0]);
    const near = objects.filter(o => !o.deco && o.x / 30 >= from - 6);
    return `${header};${near.map(objectText).join(';')};`;
  }

  allObjects(candidate = {cells: [], extra: []}) {
    const merged = new Map(this.cells);
    for (const [c, r, object] of candidate.cells) {
      const key = `${c},${r}`;
      const current = merged.get(key);
      if (current && !current.deco && object.deco) continue;
      merged.set(key, object);
    }
    return [...merged.values(), ...this.extra, ...candidate.extra];
  }

  // ---- placing pieces -----------------------------------------------------

  beatColumn(minimum) {
    // x of beat k is -120 + k * beat; a jump made on the beat clears an
    // obstacle about two tiles later.
    const step = this.beatTiles / 2;
    const k = Math.ceil((minimum - 2 + 1) / step);
    return Math.round(-1 + k * step + 2);
  }

  // Tries a piece with every tap time; keeps it if it is fair. Returns true when kept.
  tryPiece(piece) {
    const objects = this.allObjects(piece);
    const startTrack = this.tracks[0];
    const fromColumn = startTrack.state.player.x / TILE;
    const level = parseLevel(this.levelText(objects, fromColumn));
    const doneX = (piece.end - 2) * TILE;
    const isDone = player => player.posX >= doneX && player.grounded && !player.held;
    const startTick = Math.round(startTrack.state.steps * 2);
    const lastTick = startTick + Math.ceil(((piece.lastObstacle + 1) * TILE - startTrack.state.player.x) / SPEED_PER_FRAME + 4) * 2;

    // A piece that needs no taps must work without them, and a piece that
    // needs taps must not.
    const free = play(level, startTrack.state, ONE, {taps: []}, isDone);
    if (piece.taps === 0) {
      if (!free.ok) return false;
      return this.commit(piece, [], 99, level, isDone);
    }
    if (free.ok) return false;

    const works = taps => play(level, startTrack.state, ONE, {taps}, isDone).ok;
    let best = null;
    if (piece.taps === 1) {
      const ok = [];
      for (let tick = startTick; tick <= lastTick; tick += 2) ok.push([tick, works([tick])]);
      const run = longestRun(ok);
      if (run) best = {taps: [run.center], margin: run.margin};
    } else {
      // two taps: jump, then a tap in the air (orb)
      const grid = new Map();
      for (let first = startTick; first <= lastTick; first += 2) {
        for (let second = first + 12; second <= first + 80; second += 2) {
          if (works([first, second])) grid.set(`${first},${second}`, true);
        }
      }
      for (const key of grid.keys()) {
        const [first, second] = key.split(',').map(Number);
        const along = (a, b, stepA, stepB) => {
          let n = 0;
          while (grid.has(`${a + stepA * (n + 1)},${b + stepB * (n + 1)}`)) n++;
          return n;
        };
        const m1 = Math.min(along(first, second, 2, 0), along(first, second, -2, 0));
        const m2 = Math.min(along(first, second, 0, 2), along(first, second, 0, -2));
        const margin = Math.min(m1, m2);
        if (!best || margin > best.margin) best = {taps: [first, second], margin};
      }
    }
    if (!best || best.margin < this.tune.margin) return false;
    return this.commit(piece, best.taps, best.margin, level, isDone);
  }

  // Plays the chosen taps on every track (with small timing errors at 120 fps)
  // and keeps the result as the new starting point.
  commit(piece, taps, margin, level, isDone) {
    const results = [];
    for (const track of this.tracks) {
      const result = play(level, track.state, track.dts, {taps: [...this.taps, ...taps]}, isDone);
      if (!result.ok) return false;
      if (track.name !== '60' && taps.length) {
        const shift = Math.max(1, Math.floor(margin / 2)) * 2;
        for (const delta of [-shift, shift]) {
          const moved = taps.map(t => t + delta);
          if (!play(level, track.state, track.dts, {taps: [...this.taps, ...moved]}, isDone).ok) return false;
        }
      }
      results.push(result);
    }
    this.tracks.forEach((track, i) => {
      track.state = {player: results[i].player, steps: results[i].steps};
      track.inputs.push(...results[i].inputs);
    });
    for (const [c, r, object] of piece.cells) this.put(c, r, object);
    this.extra.push(...piece.extra);
    this.taps.push(...taps);
    this.column = piece.end;
    this.surface = piece.surface;
    this.pieces.push({name: piece.name, column: piece.start, taps: taps.length, margin});
    if (taps.length) this.minMargin = Math.min(this.minMargin, margin);
    return true;
  }

  // ---- cube pieces (normal gravity, or upside down under a ceiling) ---------

  // rel row: 0 = the row the cube runs in, -1 = the surface under it.
  rowOf(rel, upside) {
    return upside ? CEILING_ROW - 1 - rel : this.surface + rel;
  }

  // Surface blocks (and fill below them) for columns [from, to).
  ground(cells, from, to, upside, surface = this.surface) {
    for (let c = from; c < to; c++) {
      if (upside) {
        cells.push([c, CEILING_ROW, make.block(c, CEILING_ROW, this.wallBlock)]);
      } else if (surface > 0) {
        cells.push([c, surface - 1, make.block(c, surface - 1, this.platformBlock)]);
        for (let r = 0; r < surface - 1; r++) cells.push([c, r, make.fill(c, r)]);
      }
    }
  }

  cubePiece(name, start, upside) {
    const cells = [];
    const extra = [];
    const s = this.surface;
    const row = rel => this.rowOf(rel, upside);
    const hazard = (c, rel) => cells.push([c, row(rel), make.spike(c, row(rel), upside)]);
    const smallHazard = (c, rel) => cells.push([c, row(rel), make.small(c, row(rel), upside)]);
    const from = this.column;
    let end;
    let surface = s;
    let taps = 1;
    let lastObstacle = start;
    switch (name) {
      case 'spikes1':
      case 'spikes2':
      case 'spikes3': {
        const n = Number(name.at(-1));
        for (let i = 0; i < n; i++) hazard(start + i, 0);
        lastObstacle = start + n - 1;
        end = start + n + 3;
        this.ground(cells, from, end, upside);
        break;
      }
      case 'small': {
        const n = this.range(1, Math.min(4, 2 + Math.floor(this.index / 3)));
        for (let i = 0; i < n; i++) smallHazard(start + i, 0);
        lastObstacle = start + n - 1;
        end = start + n + 4;
        this.ground(cells, from, end, upside);
        break;
      }
      case 'stepUp': {
        if (upside || s >= this.tune.maxSurface) return null;
        const length = this.range(4, 7);
        this.ground(cells, from, start, false);
        end = start + length;
        this.ground(cells, start, end, false, s + 1);
        surface = s + 1;
        lastObstacle = start;
        break;
      }
      case 'stepDown': {
        if (upside || s === 0) return null;
        this.ground(cells, from, start, false);
        end = start + 4;
        this.ground(cells, start, end, false, s - 1);
        surface = s - 1;
        taps = 0;
        break;
      }
      case 'pillar':
      case 'pillarSpike': {
        if (upside) return null;
        // a lone block to jump over (or onto and off again)
        const height = name === 'pillar' && this.index >= 2 && s + 2 <= this.tune.maxSurface && this.random() < 0.3 ? 2 : 1;
        if (height === 2) return null;
        cells.push([start, s, make.block(start, s)]);
        if (name === 'pillarSpike') hazard(start + 1, 0);
        lastObstacle = start + (name === 'pillarSpike' ? 1 : 0);
        end = lastObstacle + 5;
        this.ground(cells, from, end, false);
        break;
      }
      case 'combo': {
        // two to four small obstacles in a row, each with its own jump
        const count = this.range(2, this.tune.comboMax);
        const kinds = upside ? ['spike1', 'spike2', 'small'] : ['spike1', 'spike2', 'small', 'pillar'];
        let c = start;
        for (let i = 0; i < count; i++) {
          const kind = this.pick(kinds);
          if (kind === 'spike1') hazard(c++, 0);
          else if (kind === 'spike2') { hazard(c++, 0); hazard(c++, 0); }
          else if (kind === 'small') { smallHazard(c++, 0); smallHazard(c++, 0); }
          else cells.push([c, s, make.block(c++, s)]);
          lastObstacle = c - 1;
          c += this.range(2, this.tune.comboGapMax);
        }
        end = lastObstacle + 5;
        this.ground(cells, from, end, upside);
        return {name, start, end, surface, taps: 'chain', count, cells, extra, lastObstacle};
      }
      case 'gap': {
        if (upside || s === 0) return null;
        const width = this.range(2, this.index >= 3 ? 4 : 3);
        this.ground(cells, from, start, false);
        for (let c = start; c < start + width; c++) cells.push([c, 0, make.spike(c, 0)]);
        end = start + width + 4;
        this.ground(cells, start + width, end, false);
        lastObstacle = start + width - 1;
        break;
      }
      case 'hopUpGap': {
        if (upside || s === 0 || s >= this.tune.maxSurface) return null;
        const width = this.range(1, 2);
        this.ground(cells, from, start, false);
        for (let c = start; c < start + width; c++) cells.push([c, 0, make.spike(c, 0)]);
        end = start + width + 5;
        this.ground(cells, start + width, end, false, s + 1);
        surface = s + 1;
        lastObstacle = start + width;
        break;
      }
      case 'platformSpike': {
        if (upside || s >= this.tune.maxSurface) return null;
        // a short raised platform with a spike right after it
        this.ground(cells, from, end = start + 9, false);
        this.ground(cells, start, start + 3, false, s + 1);
        hazard(start + 5, 0);
        lastObstacle = start + 5;
        taps = 2;
        return {name, start, end, surface, taps: 'pair', cells, extra, lastObstacle};
      }
      case 'slabHop': {
        if (upside || s !== 0) return null;
        // thin slabs over a spike floor
        const count = this.range(2, 3);
        let c = start;
        for (let i = 0; i < count; i++) {
          cells.push([c, 0, make.spike(c, 0)]);
          cells.push([c + 1, 0, make.spike(c + 1, 0)]);
          c += 2;
          cells.push([c, 1, make.slab(c, 0)]);
          cells.push([c + 1, 1, make.slab(c + 1, 0)]);
          c += 2;
        }
        end = c + 3;
        lastObstacle = c - 1;
        return {name, start, end, surface: 0, taps: 'chain', count, cells, extra, lastObstacle};
      }
      case 'pad': {
        if (upside || s > 1) return null;
        // a pad throws the cube onto a platform three rows up
        this.ground(cells, from, start + 1, false);
        extra.push(make.pad(start, s));
        const wallStart = start + this.range(2, 3);
        end = wallStart + this.range(5, 7);
        this.ground(cells, start + 1, wallStart, false);
        this.ground(cells, wallStart, end, false, s + 3);
        surface = s + 3;
        taps = 0;
        break;
      }
      case 'padSpikes': {
        if (upside) return null;
        // a pad throws the cube over a long row of spikes
        this.ground(cells, from, start + 1, false);
        extra.push(make.pad(start, s));
        const count = this.range(4, 5);
        for (let i = 0; i < count; i++) hazard(start + 2 + i, 0);
        end = start + 2 + count + 4;
        this.ground(cells, start + 1, end, false);
        taps = 0;
        break;
      }
      case 'orbPit': {
        const width = this.range(4, this.index >= 5 ? 6 : 5);
        if (upside || s === 0) {
          for (let c = start; c < start + width; c++) hazard(c, 0);
          this.ground(cells, from, start + width + 4, upside);
        } else {
          this.ground(cells, from, start, false);
          for (let c = start; c < start + width; c++) cells.push([c, 0, make.spike(c, 0)]);
          this.ground(cells, start + width, start + width + 4, false);
        }
        const orbColumn = start + Math.floor(width / 2) - (width >= 6 ? 1 : 0);
        extra.push(make.orb(orbColumn, row(this.range(1, 2))));
        end = start + width + 4;
        lastObstacle = start + width - 1;
        taps = 2;
        break;
      }
      case 'ceilingSpikes': {
        if (upside || s >= this.tune.maxSurface) return null;
        // spikes hang from a low roof on both sides of a floor spike: the jump
        // must be right in the middle
        for (let c = start - 1; c <= start + 5; c++) cells.push([c, s + 3, make.block(c, s + 3)]);
        cells.push([start, s + 2, make.spike(start, s + 2, true)]);
        cells.push([start + 4, s + 2, make.spike(start + 4, s + 2, true)]);
        hazard(start + 2, 0);
        end = start + 8;
        this.ground(cells, from, end, false);
        lastObstacle = start + 4;
        break;
      }
      default:
        return null;
    }
    return {name, start, end, surface, taps, cells, extra, lastObstacle};
  }

  // Adds one cube piece somewhere after the current column. Returns false when
  // nothing fits before `limit`.
  addCubePiece(limit, upside = false) {
    const [low, high] = this.tune.runway;
    const names = upside
      ? UPSIDE_PIECES.filter(name => PIECES.find(p => p.name === name).from <= this.index)
      : PIECES.filter(p => p.from <= this.index).flatMap(p => Array(p.weight).fill(p.name));
    for (let attempt = 0; attempt < 40; attempt++) {
      const name = this.pick(names);
      let start = this.column + this.range(low, high);
      const aligned = this.beatColumn(this.column + low);
      if (aligned <= this.column + low + 1) start = aligned;
      const piece = this.cubePiece(name, start, upside);
      if (!piece || piece.end > limit) continue;
      if (piece.taps === 'pair' || piece.taps === 'chain') {
        if (this.tryChain(piece)) return true;
        continue;
      }
      if (this.tryPiece(piece)) return true;
    }
    return false;
  }

  // Pieces with several separate jumps are tried jump by jump: each jump gets
  // its own window while the earlier ones stay at their chosen time.
  tryChain(piece) {
    const objects = this.allObjects(piece);
    const startTrack = this.tracks[0];
    const level = parseLevel(this.levelText(objects, startTrack.state.player.x / TILE));
    const doneX = (piece.end - 2) * TILE;
    const isDone = player => player.posX >= doneX && player.grounded && !player.held;
    const startTick = Math.round(startTrack.state.steps * 2);
    const lastTick = startTick + Math.ceil(((piece.lastObstacle + 1) * TILE - startTrack.state.player.x) / SPEED_PER_FRAME + 4) * 2;
    const chosen = [];
    let margin = Infinity;
    const jumps = piece.taps === 'pair' ? 2 : piece.count;
    for (let j = 0; j < jumps; j++) {
      const last = j === jumps - 1;
      const from = chosen.length ? chosen.at(-1) + 12 : startTick;
      const ok = [];
      for (let tick = from; tick <= lastTick; tick += 2) {
        const taps = [...chosen, tick];
        // an inner jump is good when the cube lands safely after it
        const landed = player => player.grounded && player.posX > startTrack.state.player.x && landedAfter(player, tick);
        let stepTick = startTick;
        const landedAfter = () => stepTick >= tick + 12;
        const result = play(level, startTrack.state, ONE, {taps}, last ? isDone : player => {
          stepTick += 2;
          return landed(player);
        });
        ok.push([tick, result.ok]);
      }
      const run = longestRun(ok);
      if (!run) return false;
      chosen.push(run.center);
      margin = Math.min(margin, run.margin);
    }
    if (margin < this.tune.margin) return false;
    // the full chain must work
    if (!play(level, startTrack.state, ONE, {taps: chosen}, isDone).ok) return false;
    return this.commit({...piece, taps: chosen.length}, chosen, margin, level, isDone);
  }

  // Runway on the current surface up to column `to`.
  addRunway(to, upside = false) {
    if (to <= this.column) return;
    const piece = {name: 'runway', start: this.column, end: to, surface: this.surface, taps: 0, cells: [], extra: [], lastObstacle: to};
    this.ground(piece.cells, this.column, to, upside);
    if (!this.tryPiece(piece)) throw new Error(`level ${this.index + 1}: runway failed at ${this.column}`);
  }

  stepDownToFloor(limit) {
    while (this.surface > 0) {
      const start = this.column + 2;
      const piece = this.cubePiece('stepDown', start, false);
      if (!this.tryPiece(piece)) throw new Error(`level ${this.index + 1}: could not step down at ${this.column}`);
      if (this.column > limit) break;
    }
  }

  // ---- sections -----------------------------------------------------------

  cubeSection(endColumn, upside = false) {
    while (this.column < endColumn - 6) {
      // nothing fitted here: move on a little and try again, never leave the rest empty
      if (!this.addCubePiece(endColumn, upside)) this.addRunway(this.column + 2, upside);
    }
  }

  upsideSection(endColumn) {
    this.stepDownToFloor(endColumn);
    const start = this.column;
    // runway with a roof, the yellow portal, then the roof as the new floor
    const roofFrom = start + 2;
    const portal = start + 4;
    const cells = [];
    for (let c = roofFrom; c < portal + 6; c++) cells.push([c, CEILING_ROW, make.block(c, CEILING_ROW)]);
    const entry = {name: 'upsidePortal', start, end: portal + 6, surface: 0, taps: 0, cells, extra: [make.upsidePortal(portal, 0)], lastObstacle: portal};
    // done when the cube rests on the roof
    if (!this.tryUpside(entry)) return false;
    const upsideStart = start;
    // keep the upside-down part short and busy; the rest of the section runs normally
    const upsideEnd = Math.min(endColumn, this.column + 34 + 3 * Math.min(this.index, 6));
    this.cubeSection(upsideEnd - 8, true);
    // exit: blue portal, the cube drops to the floor
    const exitStart = this.column + 2;
    const exitCells = [];
    for (let c = this.column; c < exitStart + 2; c++) exitCells.push([c, CEILING_ROW, make.block(c, CEILING_ROW)]);
    const exit = {name: 'normalPortal', start: exitStart, end: exitStart + 6, surface: 0, taps: 0, cells: exitCells, extra: [make.normalPortal(exitStart, CEILING_ROW - 1)], lastObstacle: exitStart};
    if (!this.tryPiece(exit)) throw new Error(`level ${this.index + 1}: upside exit failed`);
    this.upsideRanges = this.upsideRanges || [];
    this.upsideRanges.push([upsideStart, this.column]);
    this.cubeSection(endColumn);
    return true;
  }

  tryUpside(piece) {
    const objects = this.allObjects(piece);
    const level = parseLevel(this.levelText(objects, this.tracks[0].state.player.x / TILE));
    const doneX = (piece.end - 2) * TILE;
    const isDone = player => player.posX >= doneX && player.grounded && player.gravity === -1;
    const results = this.tracks.map(track => play(level, track.state, track.dts, {taps: this.taps}, isDone));
    if (results.some(result => !result.ok)) return false;
    this.tracks.forEach((track, i) => {
      track.state = {player: results[i].player, steps: results[i].steps};
      track.inputs.push(...results[i].inputs);
    });
    for (const [c, r, object] of piece.cells) this.put(c, r, object);
    this.extra.push(...piece.extra);
    this.column = piece.end;
    this.pieces.push({name: piece.name, column: piece.start, taps: 0});
    return true;
  }

  shipSection(endColumn) {
    this.stepDownToFloor(endColumn);
    const t = this.tune;
    const start = this.column + 1;
    const portal = start + 1;
    const cells = [];
    const extra = [make.shipPortal(portal, 0)];
    const waypoints = [[portal * TILE, 816]];
    const top = 9; // highest row inside the ship bounds
    // The ship starts on the floor, so the first gap is low; later gaps move
    // only as far as the ship can climb or dive before it gets there.
    let center = 2 + this.random() * 0.8;
    let c = portal + 8;
    let spacing = t.shipSpacing;
    const exitColumn = endColumn - 7;
    let first = true;
    while (c < exitColumn - 4) {
      const gap = t.shipGap + (this.random() < 0.3 ? 1 : 0);
      if (!first) center += (this.random() * 2 - 1) * Math.min(t.shipShift, spacing * 0.6);
      const spiky = t.shipSpikes && !first;
      first = false;
      center = Math.max(gap / 2 + 0.6, Math.min(top + 1 - gap / 2 - 0.6, center));
      const low = Math.round(center - gap / 2);
      const high = low + gap - 1;
      const width = this.random() < 0.35 ? 2 : 1;
      for (let w = 0; w < width; w++) {
        for (let r = 0; r < low; r++) cells.push([c + w, r, make.block(c + w, r, this.wallBlock)]);
        for (let r = high + 1; r <= top; r++) cells.push([c + w, r, make.block(c + w, r, this.wallBlock)]);
        if (spiky && (gap >= 4 || t.shipSpikesInNarrowGaps)) {
          if (low > 0 && this.random() < 0.6) cells.push([c + w, low, make.spike(c + w, low)]);
          if (high < top && this.random() < 0.6) cells.push([c + w, high, make.spike(c + w, high, true)]);
        }
      }
      const y = 936 - 120 * (low + high + 1) / 2 - 60;
      waypoints.push([c * TILE - 60, y], [(c + width) * TILE + 60, y]);
      spacing = t.shipSpacing + (this.random() < 0.4 ? 1 : 0);
      c += width + spacing;
    }
    if (t.shipFloorSpikes) {
      for (let x = portal + 5; x < exitColumn - 1; x++) {
        if (!cells.some(([cc, r]) => cc === x && r === 0)) cells.push([x, 0, make.small(x, 0)]);
      }
    }
    if (t.shipCeilingSpikes) {
      for (let x = portal + 3; x < exitColumn - 1; x++) {
        if (!cells.some(([cc, r]) => cc === x && r === top)) cells.push([x, top, make.small(x, top, true)]);
      }
    }
    // The cube portal sits in a last gate where the last gap was: blocks under
    // and over it, so the ship flies straight through, and the cube lands on a
    // block floor at the portal's height and runs on from there.
    const exitRow = Math.max(0, Math.min(3, Math.round(center - 1.5)));
    const exitY = 816 - 120 * exitRow - 60;
    waypoints.push([(exitColumn - 1) * TILE, exitY], [(exitColumn + 4) * TILE, exitY]);
    extra.push(make.cubePortal(exitColumn, exitRow));
    for (let r = 0; r < exitRow; r++) cells.push([exitColumn, r, make.block(exitColumn, r, this.wallBlock)]);
    for (let r = exitRow + 3; r <= top; r++) cells.push([exitColumn, r, make.block(exitColumn, r, this.wallBlock)]);
    const path = pathFrom(waypoints);
    const end = exitColumn + 6;
    if (exitRow > 0) {
      const landing = [];
      this.ground(landing, exitColumn + 1, end, false, exitRow);
      cells.push(...landing);
    }
    const objects = this.allObjects({cells, extra});
    const level = parseLevel(this.levelText(objects, this.tracks[0].state.player.x / TILE));
    const doneX = (end - 2) * TILE;
    const isDone = player => player.posX >= doneX && player.grounded && !player.ship;
    // the bot must also survive reacting late and aiming off-centre
    const variants = [
      {aim: 0, delay: 0}, {aim: 0, delay: t.shipDelay}, {aim: t.shipAim, delay: 0}, {aim: -t.shipAim, delay: 0},
    ];
    for (const track of this.tracks) {
      for (const variant of variants) {
        const result = play(level, track.state, track.dts, {taps: this.taps, bot: shipBot(path, variant.aim, variant.delay)}, isDone, 6000);
        if (!result.ok) {
          if (process.env.DEBUG_SHIP) {
            console.log('ship fail', this.index + 1, 'track', track.name, variant, 'at tile', (result.x / TILE).toFixed(1), 'start', start, 'gap', t.shipGap, result.timeout ? 'timeout' : '');
            const near = level.objects.filter(o => Math.abs(o.x - result.x) < 360).map(o => `${o.id}@${(o.x / TILE).toFixed(1)},${((FLOOR - o.y) / TILE).toFixed(1)}`);
            console.log('   near', near.join(' '));
            const probe = play(level, track.state, track.dts, {taps: this.taps, bot: shipBot(path, variant.aim, variant.delay)}, p => p.x > result.x - 200, 6000);
            console.log('   before death y', probe.player?.y, 'vy', probe.player?.vy, 'ship', probe.player?.ship, 'bounds', probe.player?.boundsTop, probe.player?.boundsBottom, 'target', path(result.x));
            process.exit(0);
          }
          return false;
        }
      }
    }
    const results = this.tracks.map(track => play(level, track.state, track.dts, {taps: this.taps, bot: shipBot(path)}, isDone, 6000));
    this.tracks.forEach((track, i) => {
      track.state = {player: results[i].player, steps: results[i].steps};
      track.inputs.push(...results[i].inputs);
    });
    for (const [cc, r, object] of cells) this.put(cc, r, object);
    this.extra.push(...extra);
    this.column = end;
    this.surface = exitRow;
    this.shipPaths = this.shipPaths || [];
    this.shipPaths.push(waypoints);
    this.shipRanges = this.shipRanges || [];
    this.shipRanges.push([start, end]);
    this.pieces.push({name: 'ship', column: start, gates: waypoints.length});
    return true;
  }

  // Tries a ship section; makes it gentler until the bot gets through.
  addShipSection(endColumn) {
    const saved = {random: this.random, tune: this.tune};
    for (let attempt = 0; attempt < 12; attempt++) {
      if (this.shipSection(endColumn)) return true;
      if (attempt % 3 === 2) {
        this.tune = {...this.tune, shipGap: this.tune.shipGap + 1, shipShift: Math.max(1, this.tune.shipShift - 1)};
      }
      if (attempt === 8) this.tune = {...this.tune, shipFloorSpikes: false, shipCeilingSpikes: false, shipSpikesInNarrowGaps: false};
    }
    this.tune = saved.tune;
    return false;
  }

  colorChange(column, colors, duration = 0.6) {
    this.extra.push(make.trigger(column, 29, colors[0], duration));
    this.extra.push(make.trigger(column, 30, colors[1], duration));
  }

  // Light poles with a ball on top (the designer's sketch: they sparkle now
  // and then) stand on free block tops and on the floor, away from ship parts.
  addPoles() {
    const skip = (this.shipRanges || []).concat(this.upsideRanges || []);
    for (let c = 6; c < this.column - 4; c += this.range(7, 13)) {
      if (skip.some(([from, to]) => c >= from - 2 && c <= to + 2)) continue;
      let top = -1;
      for (let r = 0; r < 6; r++) {
        const cell = this.cells.get(`${c},${r}`);
        if (cell && !cell.deco && cell.id !== 8 && cell.id !== 39) top = r;
      }
      const surface = top + 1;
      const blocked = [0, 1, 2].some(d => this.cells.has(`${c},${surface + d}`) && !this.cells.get(`${c},${surface + d}`).deco);
      if (blocked || this.extra.some(o => Math.abs(o.x - gx(c)) < 31 && !o.deco)) continue;
      const id = this.pick([15, 16, 16, 17]);
      const base = {15: 21, 16: 13, 17: 6}[id];
      this.extra.unshift(make.decoration(c, id, base + 30 * surface));
    }
  }

  // Three coins on the way through the level: at the top of a high jump early
  // on, inside the first ship flight, and at the top of a jump near the end.
  // They sit where the checked run already flies, so every coin can be taken.
  placeCoins() {
    const objects = this.allObjects().filter(o => !o.deco);
    const header = levelHeader(this.spec.colors[0]);
    const level = parseLevel(`${header};${objects.map(objectText).join(';')};`);
    const player = newPlayer();
    const frames = [];
    let groundY = player.y;
    for (const held of this.tracks[0].inputs) {
      step(player, level, held === 1, 1);
      if (player.grounded) groundY = player.y;
      frames.push({x: player.x, y: player.y, vy: player.vy, ship: player.ship, gravity: player.gravity, grounded: player.grounded, height: Math.abs(player.y - groundY)});
    }
    const total = frames.length;
    const tops = [];
    for (let i = 1; i < total; i++) {
      const before = frames[i - 1];
      const now = frames[i];
      if (!now.ship && !now.grounded && before.vy * now.gravity < 0 && now.vy * now.gravity >= 0) tops.push(i);
    }
    const highest = (from, to) => tops.filter(i => i >= from * total && i <= to * total).sort((a, b) => frames[b].height - frames[a].height)[0];
    const flight = frames.map((f, i) => i).filter(i => frames[i].ship && i >= 0.3 * total && i <= 0.75 * total);
    const picks = [highest(0.1, 0.38), flight.length ? flight[Math.floor(flight.length * 0.55)] : highest(0.4, 0.68), highest(0.7, 0.94)];
    for (const i of picks) {
      if (i === undefined) continue;
      const centerX = frames[i].x + 60;
      const centerY = frames[i].y + 60;
      this.extra.push({id: 201, x: Math.round(centerX / 4 * 4) / 4, y: Math.round((FLOOR - centerY) / 4 * 4) / 4});
    }
  }

  decorate() {
    this.addPoles();
    // soft tufts on open floor, never under the cube's path
    for (let c = 4; c < this.column; c += this.range(3, 7)) {
      const free = [0, 1, 2].every(r => !this.cells.has(`${c},${r}`) && !this.cells.has(`${c + 1},${r}`));
      if (!free) continue;
      const id = this.pick([18, 19, 20, 21]);
      const height = {18: 164, 19: 144, 20: 116, 21: 52}[id];
      // bottom of the texture on the floor: y*4 + h/2 = h -> y = h/8
      this.extra.unshift(make.decoration(c, id, Math.trunc(height / 2) / 4));
    }
  }

  // ---- whole level --------------------------------------------------------

  build(sections) {
    const totalColumns = Math.floor((this.spec.seconds - 4.5) * SPEED_PER_FRAME * 60 / TILE) - 1;
    this.addRunway(8);
    let colorIndex = 0;
    for (const section of sections) {
      const endColumn = Math.min(totalColumns - 8, Math.round(section.endBeat * this.beatTiles) - 1);
      if (endColumn - this.column < 16) continue;
      if (colorIndex !== section.colors) {
        colorIndex = section.colors;
        this.colorChange(this.column, this.spec.colors[colorIndex % this.spec.colors.length]);
      }
      if (section.type === 'ship') {
        // long drops fly for a while, then run again
        const shipEnd = Math.min(endColumn, this.column + 64 + 2 * this.index);
        this.addShipSection(shipEnd);
        this.cubeSection(endColumn);
      } else if (section.type === 'upside') {
        if (!this.upsideSection(endColumn)) this.cubeSection(endColumn);
      } else {
        this.cubeSection(endColumn);
      }
    }
    this.stepDownToFloor(totalColumns);
    this.addRunway(Math.max(this.column + 4, totalColumns));
    // the level ends at the last object: a trigger marks the end column
    this.extra.push(make.trigger(this.column, 29, this.spec.colors[colorIndex % this.spec.colors.length][0], 0.5));
    this.placeCoins();
    this.decorate();
    return this;
  }

  text() {
    const header = levelHeader(this.spec.colors[0]);
    const decorations = this.extra.filter(o => o.deco);
    const fills = [...this.cells.values()].filter(o => o.deco);
    const solid = [...this.cells.values()].filter(o => !o.deco);
    const rest = this.extra.filter(o => !o.deco);
    return `${header};${[...decorations, ...fills, ...solid, ...rest].map(objectText).join(';')};`;
  }
}

// Initial colours: 1_R_2_G_3_B for the background (kS29) and the ground (kS30).
function levelHeader([background, ground]) {
  const color = ([r, g, b]) => `1_${r}_2_${g}_3_${b}`;
  return `kS29,${color(background)},kS30,${color(ground)}`;
}

function longestRun(results) {
  let best = null;
  let runStart = -1;
  for (let i = 0; i <= results.length; i++) {
    const ok = i < results.length && results[i][1];
    if (ok && runStart < 0) runStart = i;
    if (!ok && runStart >= 0) {
      const length = i - runStart;
      if (!best || length > best.length) best = {length, from: runStart};
      runStart = -1;
    }
  }
  if (!best) return null;
  const middle = best.from + Math.floor((best.length - 1) / 2);
  return {center: results[middle][0], margin: Math.floor((best.length - 1) / 2), length: best.length};
}

// Section plan from the song timeline: drops fly, breakdowns go upside down.
function sectionsFor(index, timeline) {
  const spec = LEVELS[index];
  const song = timeline?.find(entry => entry.index === index);
  const totalBeats = Math.floor((spec.seconds - 4.5) * spec.bpm / 60);
  let raw = song?.sections?.length ? song.sections : null;
  if (!raw) {
    const q = totalBeats / 8;
    raw = [
      {name: 'intro', startBeat: 0, endBeat: q * 2, energy: 0.4},
      {name: 'build', startBeat: q * 2, endBeat: q * 3, energy: 0.6},
      {name: 'drop', startBeat: q * 3, endBeat: q * 4.5, energy: 1},
      {name: 'breakdown', startBeat: q * 4.5, endBeat: q * 5.5, energy: 0.5},
      {name: 'drop', startBeat: q * 5.5, endBeat: q * 7, energy: 1},
      {name: 'outro', startBeat: q * 7, endBeat: totalBeats, energy: 0.3},
    ];
  }
  const sections = [];
  let drops = 0;
  raw.forEach((section, i) => {
    const name = section.name.toLowerCase();
    let type = 'cube';
    const length = section.endBeat - section.startBeat;
    if (/drop/.test(name) && length >= 12) {
      // every drop flies; quiet breakdowns turn the world upside down
      type = 'ship';
      drops++;
    } else if (/break|bridge/.test(name) && index >= 3 && length >= 12) {
      type = 'upside';
    }
    sections.push({type, endBeat: Math.min(section.endBeat, totalBeats), colors: type === 'cube' ? 0 : (i % 2) + 1});
  });
  return sections;
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) main();

function main() {
const timeline = existsSync(TIMELINE) ? JSON.parse(readFileSync(TIMELINE, 'utf8')) : null;
const songs = Array.isArray(timeline) ? timeline : timeline?.songs || timeline?.levels || null;
const wanted = process.argv.slice(2).map(Number).filter(Boolean);
const report = existsSync(REPORT) ? JSON.parse(readFileSync(REPORT, 'utf8')) : {};
mkdirSync(OUT, {recursive: true});
for (let index = 0; index < LEVELS.length; index++) {
  if (wanted.length && !wanted.includes(index + 1)) continue;
  const started = Date.now();
  const builder = new LevelBuilder(index).build(sectionsFor(index, songs));
  const text = builder.text();
  writeFileSync(new URL(`${index}.level`, OUT), text);
  const parsed = parseLevel(text);
  report[index + 1] = {
    name: builder.spec.name,
    objects: parsed.objects.length,
    endX: parsed.furthestX,
    seconds: +(builder.tracks[0].state.steps / 60).toFixed(2),
    taps: builder.taps,
    pieces: builder.pieces.length,
    ships: builder.pieces.filter(p => p.name === 'ship').length,
    upside: builder.pieces.filter(p => p.name === 'upsidePortal').length,
    narrowestWindow: builder.minMargin === Infinity ? null : builder.minMargin * 2 + 1,
    coins: parsed.objects.filter(o => o.id === 201).length,
    shipPaths: builder.shipPaths || [],
    inputs: Object.fromEntries(builder.tracks.map(track => [track.name, runLength(track.inputs)])),
  };
  if (process.env.DEBUG_PIECES) console.log(builder.pieces.map(p => `${p.name}@${p.column}${p.margin !== undefined ? '/' + p.margin : ''}`).join(' '));
  console.log(`level ${index + 1} ${builder.spec.name}: ${parsed.objects.length} objects, ${builder.pieces.length} pieces, ${report[index + 1].ships} ship, ${report[index + 1].upside} upside, narrowest window ${report[index + 1].narrowestWindow} frames, ${((Date.now() - started) / 1000).toFixed(1)} s`);
}
writeFileSync(REPORT, JSON.stringify(report));
}

// [value, count, value, count, ...] keeps the input log small
function runLength(inputs) {
  const out = [];
  for (const value of inputs) {
    if (out.length && out[out.length - 2] === value) out[out.length - 1]++;
    else out.push(value, 1);
  }
  return out;
}
