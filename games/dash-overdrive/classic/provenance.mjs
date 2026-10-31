// Writes public/play/dash-overdrive/classic/provenance.json: where every part
// of the classic mode comes from, with hashes of the built files.
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseLevel} from './levels/physics.mjs';
import {LEVELS} from './levels/generate.mjs';

const publicDir = new URL('../../../public/play/dash-overdrive/classic/', import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const data = readFileSync(new URL('engine/DashClassic.data', publicDir));
const wasm = readFileSync(new URL('engine/DashClassic.wasm', publicDir));

const levels = LEVELS.map((spec, index) => {
  const bytes = readFileSync(new URL(`res/leveldata/${index}.level`, import.meta.url));
  return {level: index + 1, name: spec.name, bpm: spec.bpm, songSeconds: spec.seconds, objects: parseLevel(bytes.toString()).objects.length, sha256: hash(bytes)};
});

const provenance = {
  engine: {
    name: 'Bad-GD-Clone (modified)',
    source: 'https://github.com/VinkentLi/Bad-GD-Clone',
    license: 'MIT, Copyright (c) 2023 Vincent Li',
    changes: [
      'Block landing and side hits use a frame-to-frame crossing test and the inner hitbox',
      'Ship and upside-down sections draw their floor and ceiling at the same heights the player collides with',
      'Title screen with SKINS, PLAY and CREATE buttons and a parade of every skin',
      'Skin picker, saved best percentages, songs downloaded per level',
      'Extra level slot for the map maker and level-checker functions (sim_*)',
    ],
  },
  font: 'Lilita One, SIL Open Font License 1.1',
  generated: {
    art: 'games/dash-overdrive/classic/art/art.mjs',
    music: 'games/dash-overdrive/classic/music/music.mjs',
    levels: 'games/dash-overdrive/classic/levels/generate.mjs',
    check: 'games/dash-overdrive/classic/levels/verify.mjs',
  },
  packageBytes: data.length,
  packageSha256: hash(data),
  wasmSha256: hash(wasm),
  levels,
};
writeFileSync(new URL('provenance.json', publicDir), `${JSON.stringify(provenance, null, 1)}\n`);
console.log('provenance.json written');
