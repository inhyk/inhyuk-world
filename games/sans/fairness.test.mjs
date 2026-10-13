// 공정함 검증: 몇 수 앞을 내다보는 봇이 모든 공격을 거의 다치지 않고 넘길 수 있어야 한다.
// "피할 길이 있다"는 것을 확인하는 검사다. 사람에게 쉬운지는 따로 해 봐야 안다. (전체를 도는 데 20초쯤 걸린다)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../public/play/sans/core.mjs';
import { playAttack, gameAt } from './bot.mjs';

// 공격별로 봇에게 허용하는 스침 횟수. 빠른 뼈 통로는 봇도 가끔 스친다.
const BUDGET = { storm: 8, special: 8, fillRush: 3, opening: 3 };
const run = (name, level, seed = 7) => playAttack(gameAt(name, level, seed), { seed });

test('1막과 2막의 모든 공격은 보통 난이도에서 피할 길이 있다', () => {
  for (const name of ['opening', ...C.ORDER.p1, ...C.ORDER.p2]) {
    const result = run(name, 1); assert.ok(!result.dead, `${name}: 쓰러짐`); assert.ok(result.ticks <= (BUDGET[name] ?? 1), `${name}: ${result.ticks}번 스침`);
  }
});
test('특별 공격은 세 난이도 모두에서 피할 길이 있다', () => {
  for (const level of [0, 1, 2]) { const result = run('special', level); assert.ok(!result.dead, `L${level}: 쓰러짐`); assert.ok(result.ticks <= BUDGET.special, `L${level}: ${result.ticks}번 스침`); }
});
test('내리꽂기와 짧은 공격들은 느린 난이도에서도 피할 수 있다', () => {
  for (const name of ['slamBox', 'juggle', 'teleCuts', ...C.ORDER.fill1, ...C.ORDER.fill2]) {
    const result = run(name, 0); assert.ok(result.ticks <= (BUDGET[name] ?? 1), `${name}: ${result.ticks}번 스침`);
  }
});
test('하드모드: HP 1로도 첫 공격을 한 번도 스치지 않고 넘길 길이 있다', () => {
  const level = C.DIFFICULTIES.findIndex(d => d.id === 'hp1');
  const survived = [7, 21, 3].some(seed => { const g = gameAt('opening', level, seed); assert.equal(g.hp, 1); const result = playAttack(g, { seed }); return !result.dead && result.ticks === 0; });
  assert.ok(survived, '세 번의 시도 중 한 번은 무사히 넘겨야 한다');
});

test('새 암전 패턴 다섯 가지도 세 난이도 모두에서 피할 길이 있다', () => {
  for (const level of [0, 1, 2]) for (const name of ['verticalTunnel', 'blueCross', 'cornerBeams', 'ceilingHops', 'finalSpiral']) {
    const result = run(name, level);
    assert.ok(!result.dead && result.ticks <= 1, `${name} L${level}: ${result.ticks}번 스침`);
  }
});
