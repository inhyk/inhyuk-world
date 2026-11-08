import test from 'node:test';
import assert from 'node:assert/strict';
import { entryOf } from './src/update.js';

test('the hashed entry script is read from index.html', () => {
  assert.equal(entryOf('<script type="module" crossorigin src="./assets/index-CjaC_2I6.js"></script>'), 'assets/index-CjaC_2I6.js');
  assert.equal(entryOf('<script type="module" src="/main.js"></script>'), null);
  assert.equal(entryOf(''), null);
});
