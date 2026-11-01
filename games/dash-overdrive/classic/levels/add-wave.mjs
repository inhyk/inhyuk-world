// Puts one wave section into each of levels 1-18 (the designer: "웨이브
// 1단계부터 나오게 해줘").
//
// The levels are not built again. Each one is read as it was at BASE (before
// the waves), one span of columns [c0, c1) on a song section is cut out, and a
// wave section is built in its place with the generator's own pieces and
// checks. Everything outside the span stays exactly as it was:
// - c0 and c1 are columns where the cube rests on a block (or the floor),
//   holds nothing and has only ground around it, at every frame rate,
// - the cube moves at one speed for the whole level, so it reaches c1 at the
//   same moment as before, resting on the same height, and the old recorded
//   inputs after c1 play the rest of the level the same way,
// - the recorded inputs are spliced: old inputs before the span, the checked
//   wave run inside it, the old inputs after it.
// A coin that was inside the span moves onto the wave's path.
//
// node games/dash-overdrive/classic/levels/add-wave.mjs [level numbers...]
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {parseLevel, newPlayer, clonePlayer, step, TILE} from './physics.mjs';
import {LEVELS, TRACKS, LevelBuilder, make, objectText, play, waveBot, sameRoute, runLength} from './generate.mjs';

// The commit the levels are read from: levels 1-18 as they were before the waves.
export const BASE = 'a45c1ee';
const ROOT = new URL('../../../../', import.meta.url).pathname;
const HERE = 'games/dash-overdrive/classic/';
const FLOOR = 936;
const TOP = 9; // highest row inside the wave's floor and ceiling

// Song section for the wave, first one that fits wins.
const SECTION_ORDER = ['build', 'verse', 'build 2', 'breakdown'];

// How the wave gets harder from level 1 to 18 (index 0-17).
// gap: rows open in a gate (+1 now and then from level 2), shift: how far the
// next gate may move (rows), spacing: free columns between gates, spikes: chance
// of a spike on a gate's edge, runIn: open corridor before the first gate,
// length: columns from the wave portal to the cube portal.
const WAVE = {
  gap: [6, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3],
  jitter: [0, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3],
  shift: [1, 1, 1.5, 1.5, 2, 2, 2, 2, 2.5, 2.5, 2.5, 2.5, 3, 3, 3, 3, 3, 3],
  spacing: [8, 7, 7, 6, 6, 6, 6, 5, 5, 5, 5, 5, 5, 5, 4, 4, 4, 4],
  spikes: [0, 0, 0, 0.25, 0.35, 0.35, 0.4, 0.4, 0.45, 0.45, 0.5, 0.5, 0.55, 0.55, 0.6, 0.6, 0.6, 0.6],
  wide: [false, false, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
  floorSpikes: [false, false, false, false, false, false, false, false, false, false, false, false, true, true, true, true, true, true],
  ceilingSpikes: [false, false, false, false, false, false, false, false, false, false, false, false, true, true, true, true, true, true],
  runIn: [16, 12, 10, 10, 8, 8, 8, 8, 7, 7, 7, 7, 6, 6, 6, 6, 6, 6],
  length: [48, 46, 46, 46, 46, 46, 46, 46, 48, 48, 48, 48, 50, 50, 50, 50, 50, 50],
};

const gitShow = path => execFileSync('git', ['show', `${BASE}:${HERE}${path}`], {cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26});
const expand = runs => {
  const out = [];
  for (let i = 0; i < runs.length; i += 2) for (let n = 0; n < runs[i + 1]; n++) out.push(runs[i]);
  return out;
};
const DECORATIONS = new Set([15, 16, 17, 18, 19, 20, 21]);
const SOLID = new Set([1, 2, 3, 4, 6, 7, 8, 39, 40, 202, 203]);
const GROUND_BLOCKS = new Set([1, 2, 3, 4, 6, 7, 202]);
const TRIGGERS = new Set([29, 30]);
const group = id => (DECORATIONS.has(id) ? 0 : id === 5 ? 1 : SOLID.has(id) ? 2 : 3);

function parseItem(text) {
  const parts = text.split(',');
  const object = {text};
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const key = Number(parts[i]);
    const value = Number(parts[i + 1]);
    if (key === 1) object.id = value;
    else if (key === 2) object.x = value;
    else if (key === 3) object.y = value;
    else if (key === 5) object.flipY = value === 1;
  }
  // grid column (blocks sit at 30c + 15, triggers at 30c)
  object.column = Math.floor(object.x / 30);
  object.deco = DECORATIONS.has(object.id) || object.id === 5;
  return object;
}

// The old run on every frame rate: the player after each step.
function baseRuns(level, entry) {
  return TRACKS.map(track => {
    // the recorded inputs end just before the last tile; the checker runs on without pressing
    const inputs = expand(entry.inputs[track.name]);
    const player = newPlayer();
    const states = [];
    for (let i = 0; i < inputs.length + 2000; i++) {
      const status = step(player, level, inputs[i] === 1, track.dts[i % track.dts.length]);
      states.push(clonePlayer(player));
      if (status) break;
    }
    return {track, inputs, states};
  });
}

// Number of steps until the player first reaches x (it moves at one speed).
const stepsTo = (states, x) => states.findIndex(state => state.posX >= x) + 1;

// A column the span may start or end at: on every frame rate the old cube
// rests there when it reaches column - 2 (cube, right way up, holding nothing),
// and the two columns it stands on are plain ground. Those two columns are
// rebuilt the same way, so the run is the same. Returns the surface row.
function restingAt(runs, items, column) {
  let surface = null;
  for (const {states} of runs) {
    const at = stepsTo(states, (column - 2) * TILE);
    if (at <= 0) return null;
    const p = states[at - 1];
    if (p.mode !== 'cube' || p.gravity !== 1 || p.hasBounds || !p.grounded || p.held || p.buffered || p.vy !== 0) return null;
    const rows = (FLOOR - p.y) / TILE - 1;
    if (!Number.isInteger(rows) || (surface !== null && rows !== surface)) return null;
    surface = rows;
  }
  const near = items.filter(item => !TRIGGERS.has(item.id) && !item.deco && item.column >= column - 2 && item.column < column);
  for (const item of near) {
    const row = Math.round((item.y - 15) / 30);
    if (!(GROUND_BLOCKS.has(item.id) && row === surface - 1)) return null;
  }
  if (surface > 0) {
    for (const c of [column - 2, column - 1]) {
      if (!near.some(item => item.column === c)) return null;
    }
  }
  return surface;
}

// Columns where the old run is not a running cube (ship and upside-down parts).
function otherModeSpans(runs) {
  const spans = [];
  let from = null;
  for (const p of runs[0].states) {
    const other = p.mode !== 'cube' || p.gravity !== 1 || p.hasBounds;
    if (other && from === null) from = p.x / TILE;
    if (!other && from !== null) {
      spans.push([from, p.x / TILE]);
      from = null;
    }
  }
  return spans;
}

function chooseSpan(index, runs, items, song) {
  const spec = LEVELS[index];
  const beatTiles = 20.772 * 60 / TILE * 60 / spec.bpm;
  const avoid = otherModeSpans(runs);
  const coins = items.filter(item => item.id === 201);
  const options = [];
  for (const name of SECTION_ORDER) {
    const section = song.sections.find(s => s.name === name);
    if (!section) continue;
    const sectionStart = Math.round(section.startBeat * beatTiles) - 1;
    const sectionEnd = Math.round(section.endBeat * beatTiles) - 1;
    for (let c0 = sectionStart; c0 >= sectionStart - 14; c0--) {
      const s0 = restingAt(runs, items, c0);
      if (s0 === null) continue;
      const portal = c0 + 2 + (s0 > 0 ? 6 : 0);
      if (Math.abs(portal - sectionStart) > beatTiles) continue;
      for (let c1 = portal + WAVE.length[index] + 7; c1 <= portal + WAVE.length[index] + 16; c1++) {
        const s1 = restingAt(runs, items, c1);
        if (s1 === null || s1 > 4 || c1 > sectionEnd + 6) continue;
        if (avoid.some(([from, to]) => c0 < to + 3 && c1 > from - 3)) continue;
        const coinsInside = coins.filter(coin => coin.x / 30 >= c0 - 1 && coin.x / 30 < c1 + 1).length;
        options.push({section: name, sectionStart, beatTiles, c0, s0, portal, c1, s1, coinsInside});
        break;
      }
      if (options.length && options.at(-1).c0 === c0) break;
    }
  }
  return options.find(option => option.coinsInside === 0) || options[0] || null;
}

// The generator with the old level around the span: pieces are played with
// the old objects before and after it, from the old run's state at c0.
class WaveBuilder extends LevelBuilder {
  constructor(index, {context, runs, c0, s0, taps}) {
    super(index);
    this.spec = {...this.spec, plan: []}; // same checks as levels 19 and 20 (one route at every frame rate)
    this.context = context;
    this.column = c0;
    this.surface = s0;
    this.taps = taps;
    this.tracks = runs.map(({track, inputs, states}) => {
      const steps = stepsTo(states, (c0 - 2) * TILE);
      return {...track, state: {player: clonePlayer(states[steps - 1]), steps}, inputs: inputs.slice(0, steps)};
    });
  }

  allObjects(candidate) {
    return [...this.context, ...super.allObjects(candidate)];
  }

  // The wave: an open run first, then gates, then a cube portal in a last gate
  // at the height the old level runs on at c1, and a block floor to c1.
  wave(index, c1, exitRow, attempt) {
    const gapBonus = Math.floor(attempt / 3);
    const w = Object.fromEntries(Object.entries(WAVE).map(([key, values]) => [key, values[index]]));
    const start = this.column + 1;
    const portal = start + 1;
    const exitColumn = c1 - 7;
    const exitGap = w.gap >= 5 ? 4 : 3;
    const cells = [];
    const extra = [make.modePortal('wave', portal, 0)];
    const boxTop = center => FLOOR - 120 * center - 60;
    const waypoints = [[portal * TILE, 816]];
    let center = Math.min(3, (w.gap + gapBonus) / 2 + 0.6);
    // the open run: climb gently to the first gate's height and fly straight
    waypoints.push([(portal + Math.min(4, w.runIn / 2)) * TILE, boxTop(center)]);
    let c = portal + w.runIn;
    let first = true;
    const gates = [];
    for (;;) {
      const gap = w.gap + gapBonus + (this.random() < w.jitter ? 1 : 0);
      if (!first) center += (this.random() * 2 - 1) * Math.min(w.shift, w.spacing * 0.6);
      center = Math.max(gap / 2 + 0.6, Math.min(TOP + 1 - gap / 2 - 0.6, center));
      const width = w.wide && this.random() < 0.35 ? 2 : 1;
      // room to reach the last gate at 45 degrees
      const approach = Math.max(w.spacing, Math.ceil(Math.abs(center - (exitRow + exitGap / 2))) + 3);
      if (c + width + approach > exitColumn) break;
      const low = Math.round(center - gap / 2);
      const high = low + gap - 1;
      for (let k = 0; k < width; k++) {
        for (let r = 0; r < low; r++) cells.push([c + k, r, make.block(c + k, r, this.wallBlock)]);
        for (let r = high + 1; r <= TOP; r++) cells.push([c + k, r, make.block(c + k, r, this.wallBlock)]);
        if (!first) {
          if (low > 0 && this.random() < w.spikes) cells.push([c + k, low, make.spike(c + k, low)]);
          if (high < TOP && this.random() < w.spikes) cells.push([c + k, high, make.spike(c + k, high, true)]);
        }
      }
      const y = FLOOR - 120 * (low + high + 1) / 2 - 60;
      waypoints.push([c * TILE - 60, y], [(c + width) * TILE + 60, y]);
      gates.push(c);
      first = false;
      c += width + w.spacing + (this.random() < 0.4 ? 1 : 0);
    }
    if (gates.length < 2) return null;
    const isWall = (x, r) => cells.some(([cc, rr]) => cc === x && rr === r);
    if (w.floorSpikes) {
      for (let x = portal + w.runIn - 2; x < exitColumn - 2; x++) if (!isWall(x, 0)) cells.push([x, 0, make.small(x, 0)]);
    }
    if (w.ceilingSpikes) {
      for (let x = portal + w.runIn - 2; x < exitColumn - 1; x++) if (!isWall(x, TOP)) cells.push([x, TOP, make.small(x, TOP, true)]);
    }
    // aim at the middle of the last gap; the cube then drops a little onto the block floor
    const exitY = boxTop(exitRow + exitGap / 2);
    waypoints.push([(exitColumn - 2) * TILE, exitY], [(exitColumn + 3) * TILE, exitY]);
    extra.push(make.cubePortal(exitColumn, exitRow));
    for (let r = 0; r < exitRow; r++) cells.push([exitColumn, r, make.block(exitColumn, r, this.wallBlock)]);
    for (let r = exitRow + exitGap; r <= TOP; r++) cells.push([exitColumn, r, make.block(exitColumn, r, this.wallBlock)]);
    if (exitRow > 0) this.ground(cells, exitColumn + 1, c1, false, exitRow);
    return {cells, extra, waypoints, portal, exitColumn, gates, gap: w.gap + gapBonus};
  }

  addWave(index, c1, exitRow) {
    const t = this.tune;
    for (let attempt = 0; attempt < 9; attempt++) {
      const section = this.wave(index, c1, exitRow, attempt);
      if (!section) continue;
      const {cells, extra, waypoints} = section;
      const level = parseLevel(this.levelText(this.allObjects({cells, extra}), this.tracks[0].state.player.x / TILE));
      const path = pathOf(waypoints);
      const doneX = (c1 - 2) * TILE;
      const isDone = player => player.posX >= doneX && player.grounded && player.mode === 'cube';
      // late reactions and off-centre aims must get through too
      const variants = [{aim: 0, delay: 0}, {aim: 0, delay: t.shipDelay}, {aim: t.shipAim, delay: 0}, {aim: -t.shipAim, delay: 0}];
      const failed = this.tracks.flatMap(track => variants.map(({aim, delay}) => {
        const result = play(level, track.state, track.dts, {taps: this.taps, mode: 'wave', bot: waveBot(path, aim, delay)}, isDone, 6000);
        return result.ok ? null : `${track.name} aim ${aim} delay ${delay} at tile ${(result.x / TILE).toFixed(1)}${result.timeout ? ' (timeout)' : ''}`;
      })).filter(Boolean);
      if (process.env.DEBUG_WAVE && failed.length) console.log(`  attempt ${attempt}: ${failed.length} fail, e.g. ${failed[0]}; exit ${section.exitColumn} row ${exitRow}`);
      if (failed.length) continue;
      const results = this.tracks.map(track => play(level, track.state, track.dts, {taps: this.taps, mode: 'wave', bot: waveBot(path)}, isDone, 6000));
      const landed = FLOOR - TILE * (exitRow + 1);
      if (results.some(result => !result.ok || result.player.y !== landed || !sameRoute(result.player, results[0].player))) continue;
      this.tracks.forEach((track, i) => {
        track.state = {player: results[i].player, steps: results[i].steps};
        track.inputs.push(...results[i].inputs);
      });
      for (const [c, r, object] of cells) this.put(c, r, object);
      this.extra.push(...extra);
      this.column = c1;
      this.waypoints = waypoints;
      return {...section, attempt};
    }
    return null;
  }
}

function pathOf(waypoints) {
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

// old inputs before the span and the wave run inside it (newInputs), then the old inputs from step b on
function splice(baseInputs, newInputs, b) {
  return [...newInputs.slice(0, b), ...baseInputs.slice(b)];
}

export function addWave(index, baseText, baseEntry, song) {
  const [header, ...rest] = baseText.split(';');
  const items = rest.filter(Boolean).map(parseItem);
  const baseLevel = parseLevel(baseText);
  const runs = baseRuns(baseLevel, baseEntry);
  const span = chooseSpan(index, runs, items, song);
  if (!span) throw new Error(`level ${index + 1}: no song section has room for a wave`);
  const {c0, c1, s0, s1} = span;
  const inside = item => !TRIGGERS.has(item.id) && item.column >= c0 && item.column < c1;
  const kept = items.filter(item => !inside(item));
  const removed = items.filter(inside);
  const context = kept.filter(item => !item.deco && !TRIGGERS.has(item.id) && item.id !== 201);
  const tickA = 2 * stepsTo(runs[0].states, (c0 - 2) * TILE);
  const tickB = 2 * stepsTo(runs[0].states, (c1 - 2) * TILE);
  const builder = new WaveBuilder(index, {context, runs, c0, s0, taps: baseEntry.taps.filter(tick => tick < tickA)});
  builder.stepDownToFloor(c1);
  const portal = builder.column + 2;
  const wave = builder.addWave(index, c1, s1);
  if (!wave) throw new Error(`level ${index + 1}: no fair wave between columns ${c0} and ${c1}`);

  // the new objects of the span, and the coins that stood in it moved onto the wave's path
  const added = [...builder.cells.values(), ...builder.extra];
  const objects = [...kept, ...added.map(object => ({...parseItem(objectText(object)), fresh: true}))];
  const lostCoins = removed.filter(item => item.id === 201).length;
  const newTaps = [...baseEntry.taps.filter(tick => tick < tickA), ...baseEntry.taps.filter(tick => tick >= tickB)];
  const inputs = {};
  runs.forEach((run, i) => {
    const b = stepsTo(run.states, (c1 - 2) * TILE);
    if (builder.tracks[i].state.steps !== b) throw new Error(`level ${index + 1}: track ${run.track.name} reached c1 at step ${builder.tracks[i].state.steps}, not ${b}`);
    inputs[run.track.name] = splice(run.inputs, builder.tracks[i].inputs, b);
  });
  const textOf = list => `${header};${[0, 1, 2, 3].flatMap(g => list.filter(o => group(o.id) === g).map(o => o.text)).join(';')};`;
  if (lostCoins) {
    const level = parseLevel(textOf(objects));
    const player = newPlayer();
    const frames = [];
    for (const held of inputs['60']) {
      step(player, level, held === 1, 1);
      if (player.mode === 'wave') frames.push({x: player.x, y: player.y});
    }
    for (let k = 1; k <= lostCoins; k++) {
      const frame = frames[Math.floor(frames.length * (k / (lostCoins + 1) + 0.15))];
      const coin = {id: 201, x: Math.round(frame.x + 60) / 4, y: Math.round(FLOOR - frame.y - 60) / 4};
      objects.push({...parseItem(objectText(coin)), fresh: true});
    }
  }
  const text = textOf(objects);
  return {text, span: {...span, portal, exit: wave.exitColumn, gap: wave.gap, gates: wave.gates.length, attempt: wave.attempt},
    inputs, taps: newTaps, waypoints: wave.waypoints, removed, kept, added: objects.filter(o => o.fresh), runs};
}

// Plays the spliced inputs on the new level and compares with the old run.
export function checkWave(index, result, baseText) {
  const level = parseLevel(result.text);
  const base = parseLevel(baseText);
  const problems = [];
  if (level.furthestX !== base.furthestX) problems.push(`end moved ${base.furthestX} -> ${level.furthestX}`);
  const coins = level.objects.filter(o => o.type === 'coin');
  if (coins.length !== 3) problems.push(`${coins.length} coins`);
  const c1x = (result.span.c1 - 2) * TILE;
  for (const run of result.runs) {
    const inputs = result.inputs[run.track.name];
    const player = newPlayer();
    const taken = new Set();
    let status = 0;
    let compared = false;
    let i = 0;
    for (; i < inputs.length + 2000 && status === 0; i++) {
      status = step(player, level, inputs[i] === 1, run.track.dts[i % run.track.dts.length]);
      for (const coin of coins) {
        const h = coin.hitbox;
        if (player.x < h.x + h.w && player.x + 120 > h.x && player.y < h.y + h.h && player.y + 120 > h.y) taken.add(coin.index);
      }
      if (!compared && player.posX >= c1x) {
        compared = true;
        const old = run.states[i];
        for (const key of ['x', 'y', 'vy', 'grounded', 'held', 'buffered', 'gravity', 'mode', 'speed', 'hasBounds', 'prevY']) {
          if (player[key] !== old[key]) problems.push(`${run.track.name}: ${key} ${player[key]} != old ${old[key]} at c1`);
        }
      }
    }
    if (status !== 2 || i !== run.states.length) problems.push(`${run.track.name}: status ${status} after ${i} steps (old ${run.states.length})`);
    if (taken.size !== 3) problems.push(`${run.track.name}: ${taken.size} coins`);
  }
  // objects outside the span (and every colour trigger): the same as before, one for one
  const outside = text => text.split(';').slice(1).filter(Boolean).map(parseItem)
    .filter(item => TRIGGERS.has(item.id) || item.column < result.span.c0 || item.column >= result.span.c1)
    .map(item => item.text).sort();
  const before = outside(baseText);
  const after = outside(result.text);
  const same = before.length === after.length && before.every((text, k) => text === after[k]);
  if (!same) problems.push(`objects outside the span differ (${before.length} before, ${after.length} after)`);
  return {problems, outsideBefore: before.length, outsideAfter: after.length};
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const wanted = process.argv.slice(2).map(Number).filter(Boolean);
  const baseReport = JSON.parse(gitShow('levels/report.json'));
  const reportUrl = new URL('./report.json', import.meta.url);
  const report = JSON.parse(readFileSync(reportUrl, 'utf8'));
  const songs = JSON.parse(readFileSync(new URL('../music/timeline.json', import.meta.url), 'utf8')).songs;
  let failures = 0;
  for (let index = 0; index < 18; index++) {
    if (wanted.length && !wanted.includes(index + 1)) continue;
    const baseText = gitShow(`res/leveldata/${index}.level`);
    const entry = baseReport[index + 1];
    const result = addWave(index, baseText, entry, songs[index]);
    const check = checkWave(index, result, baseText);
    const {span} = result;
    const endX = parseLevel(result.text).furthestX;
    const percent = column => (100 * column * TILE / endX).toFixed(1);
    console.log(`level ${index + 1} ${LEVELS[index].name}: wave on "${span.section}" (portal ${((span.portal - span.sectionStart) / span.beatTiles).toFixed(2)} beat from its start), span ${span.c0}-${span.c1} (${percent(span.c0)}-${percent(span.c1)}%), portal ${span.portal}, ${span.gates} gates, gap ${span.gap} rows, ` +
      `removed ${result.removed.length} objects, added ${result.added.length}, outside the span ${check.outsideBefore} -> ${check.outsideAfter}${span.coinsInside ? `, moved ${span.coinsInside} coin` : ''}${check.problems.length ? `\n   PROBLEMS: ${check.problems.join('; ')}` : ''}`);
    if (check.problems.length) {
      failures++;
      continue;
    }
    writeFileSync(new URL(`../res/leveldata/${index}.level`, import.meta.url), result.text);
    report[index + 1] = {
      ...entry,
      objects: parseLevel(result.text).objects.length,
      taps: result.taps,
      flights: [...(entry.flights || []), {mode: 'wave', waypoints: result.waypoints}],
      wave: {section: span.section, from: span.c0, to: span.c1, portal: span.portal, exit: span.exit, gap: span.gap, base: BASE},
      inputs: Object.fromEntries(Object.entries(result.inputs).map(([name, inputs]) => [name, runLength(inputs)])),
    };
  }
  writeFileSync(reportUrl, JSON.stringify(report));
  process.exitCode = failures ? 1 : 0;
}
