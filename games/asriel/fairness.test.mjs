import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, advanceIntro, chooseAction, tick, ATTACKS } from '../../public/play/asriel/core.mjs';
const actions = [{}, { ArrowLeft: true }, { ArrowRight: true }, { ArrowUp: true }, { ArrowDown: true }, { ArrowLeft: true, ArrowUp: true }, { ArrowRight: true, ArrowUp: true }, { ArrowLeft: true, ArrowDown: true }, { ArrowRight: true, ArrowDown: true }];
// 다음 0.9초를 실제 충돌 계산으로 예측한다. 무적/HP 보정 없이 각 공격의 회피 경로를 찾는다.
function dodge(round, random) {
  const state = createGame(); startGame(state); for (let i = 0; i < 3; i++) advanceIntro(state);
  state.round = round; chooseAction(state, 'hope'); state.guard = false;
  for (let i = 0; i < 91; i++) tick(state, 1 / 60, {}, () => random);
  let chosen = {}, frames = 0;
  while (state.mode === 'dodge' && frames++ < 2000) {
    if (frames % 6 === 1) {
      let best = Infinity;
      for (const action of actions) {
        const sim = structuredClone(state);
        for (let i = 0; i < 54 && sim.mode === 'dodge'; i++) tick(sim, 1 / 60, action, () => random);
        // 같은 점수이면 멈추고, 불필요하게 모서리에 붙지 않는다.
        const score = (sim.hits - state.hits) * 10000 + Math.abs(sim.soul.x - 400) * .001 + Math.abs(sim.soul.y - 455) * .001 + (Object.keys(action).length ? .02 : 0);
        if (score < best) { best = score; chosen = action; }
      }
    }
    tick(state, 1 / 60, chosen, () => random);
  }
  return state;
}
test('12개 공격 모두 경고를 보고 움직이면 HP 보정 없이 생존할 수 있다', () => {
  for (let round = 0; round < ATTACKS.length; round++) {
    for (const seed of [.23, .71]) {
      const state = dodge(round, seed);
      assert.equal(state.round, round + 1, ATTACKS[round].name);
      assert.equal(state.refusals, 0, '부활 보너스 없이 생존');
      assert.ok(state.hp > 0);
      assert.ok(state.hits <= 5, `${ATTACKS[round].name}: ${state.hits} hits`);
    }
  }
});
