// Builds levels 22-100 and keeps, for each one, the first seed whose map
// verify.mjs finishes at every frame rate (the seeds go to extra-seeds.json, so
// generate.mjs builds the same maps again).
// node games/dash-overdrive/classic/levels/extra.mjs [level numbers...]
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {LEVELS, EXTRA_FIRST, buildLevel, loadSongs, REPORT_FILE, LEVEL_DIR} from './generate.mjs';

const SEEDS = new URL('./extra-seeds.json', import.meta.url);
const VERIFY = fileURLToPath(new URL('./verify.mjs', import.meta.url));
const ATTEMPTS = 40;
const wanted = process.argv.slice(2).map(Number).filter(Boolean);
const seeds = existsSync(SEEDS) ? JSON.parse(readFileSync(SEEDS, 'utf8')) : {};
const songs = loadSongs();
const failed = [];

for (let index = EXTRA_FIRST; index < LEVELS.length; index++) {
  const number = index + 1;
  if (wanted.length && !wanted.includes(number)) continue;
  const spec = LEVELS[index];
  const first = seeds[number] ?? 7000 + number * 31;
  let kept = null;
  for (let attempt = 0; attempt < ATTEMPTS && !kept; attempt++) {
    spec.seed = first + attempt;
    let built;
    try {
      built = buildLevel(index, songs);
    } catch {
      continue;
    }
    if (built.entry.coins !== 3) continue;
    writeFileSync(new URL(`${index}.level`, LEVEL_DIR), built.text);
    const report = JSON.parse(readFileSync(REPORT_FILE, 'utf8'));
    report[number] = built.entry;
    writeFileSync(REPORT_FILE, JSON.stringify(report));
    const check = spawnSync(process.execPath, [VERIFY, String(number)], {encoding: 'utf8'});
    if (check.status === 0) kept = {seed: spec.seed, attempt, entry: built.entry};
  }
  if (!kept) {
    failed.push(number);
    console.log(`level ${number} ${spec.name}: no seed passed in ${ATTEMPTS} tries`);
    continue;
  }
  seeds[number] = kept.seed;
  writeFileSync(SEEDS, `${JSON.stringify(seeds, null, 1)}\n`);
  console.log(`level ${number} ${spec.name} (${spec.difficulty}, song ${spec.song + 1}): seed ${kept.seed} (try ${kept.attempt + 1}), ${kept.entry.objects} objects, ${kept.entry.seconds} s, ${kept.entry.modes}, narrowest ${kept.entry.narrowestWindow}`);
}
if (failed.length) {
  console.log(`failed: ${failed.join(' ')}`);
  process.exitCode = 1;
}
