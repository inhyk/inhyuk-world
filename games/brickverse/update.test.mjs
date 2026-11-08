import test from 'node:test';
import assert from 'node:assert/strict';
import { entryOf } from './src/update.js';

test('index.html 에서 해시 게임 파일 이름 읽기', () => {
  assert.equal(entryOf('<script type="module" crossorigin src="./assets/index-CepGuUIO.js"></script>'), 'assets/index-CepGuUIO.js');
  assert.equal(entryOf('<script type="module" src="main.js"></script>'), null);
  assert.equal(entryOf(''), null);
});
