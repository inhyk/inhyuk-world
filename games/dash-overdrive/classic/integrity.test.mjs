import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseLevel, OBJECTS} from './levels/physics.mjs';
import {LEVELS} from './levels/generate.mjs';

const root = new URL('../../../public/play/dash-overdrive/classic/', import.meta.url);
const res = new URL('./res/', import.meta.url);
const read = path => readFileSync(new URL(path, root));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const provenance = JSON.parse(read('provenance.json'));
const report = JSON.parse(readFileSync(new URL('./levels/report.json', import.meta.url), 'utf8'));

test('fifteen built levels use only objects the engine knows', () => {
  assert.equal(LEVELS.length, 15);
  for (let index = 0; index < LEVELS.length; index++) {
    const text = readFileSync(new URL(`leveldata/${index}.level`, res), 'utf8');
    const ids = text.split(';').slice(1).filter(Boolean).map(row => Number(row.split(',')[1]));
    assert.ok(ids.length > 100, `level ${index + 1} has objects`);
    for (const id of ids) assert.ok(OBJECTS[id], `level ${index + 1} object ${id}`);
    const level = parseLevel(text);
    // the end of the level lines up with its song
    const seconds = (level.furthestX + 120) / (20.772 * 60);
    assert.ok(seconds < LEVELS[index].seconds - 2 && seconds > LEVELS[index].seconds - 8, `level ${index + 1} length ${seconds}`);
  }
});

test('the checker played every level to the end at 60, 120 and 144 fps', () => {
  for (let index = 0; index < LEVELS.length; index++) {
    const entry = report[index + 1];
    assert.equal(entry.name, LEVELS[index].name);
    assert.deepEqual(Object.keys(entry.inputs).sort(), ['0.4166666567325592', '0.5', '1'].sort());
    assert.equal(hash(readFileSync(new URL(`leveldata/${index}.level`, res))), provenance.levels[index].sha256);
  }
});

test('package holds the generated files and the MIT notice, no old game data', () => {
  const js = read('engine/DashClassic.js').toString();
  const packed = [...js.matchAll(/filename:"([^"]+)"/g)].map(([, name]) => name);
  assert.ok(packed.includes('/res/fonts/LilitaOne-Regular.ttf'));
  assert.ok(packed.includes('/res/gfx/skins/11.png'));
  assert.ok(!packed.some(name => /pusab|GJ_|\.plist/i.test(name)), 'no files from the old engine data');
  for (let index = 0; index < 15; index++) assert.ok(packed.includes(`/res/leveldata/${index}.level`));
  assert.equal(hash(read('engine/DashClassic.data')), provenance.packageSha256);
  assert.equal(hash(read('engine/DashClassic.wasm')), provenance.wasmSha256);
  assert.match(read('engine/LICENSE.txt').toString(), /MIT License/);
  assert.ok(!existsSync(new URL('engine/GDClone.data', root)));
  assert.ok(!readdirSync(root).some(name => name.startsWith('reference-')));
});

test('every level song is present and the page has no outside player', () => {
  for (let index = 0; index < 15; index++) {
    const song = read(`music/${index}.ogg`);
    assert.equal(song.subarray(0, 4).toString(), 'OggS', `song ${index + 1}`);
  }
  const page = read('index.html').toString() + read('launcher.js').toString();
  assert.doesNotMatch(page, /youtube|iframe_api/i);
});
