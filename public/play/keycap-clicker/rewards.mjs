export const FEVER_CHARGE = 50;
export const COMBO_WINDOW = 1800;
export const freshStreak = () => ({ combo: 0, best: 0, lastPress: -Infinity, charge: 0, feverUntil: 0, feverDuration: 8000, feverMultiplier: 3, fevers: 0 });
export function rewardPress(streak, now, roll = Math.random(), effects = {}) {
  streak.combo = now - streak.lastPress <= COMBO_WINDOW ? streak.combo + 1 : 1;
  streak.lastPress = now; streak.best = Math.max(streak.best, streak.combo);
  let startedFever = false;
  if (now >= streak.feverUntil) {
    streak.charge++;
    if (streak.charge >= (effects.feverCharge ?? FEVER_CHARGE)) {
      streak.fevers++; streak.feverMultiplier = streak.fevers % 3 === 0 ? 5 : 3;
      streak.charge = 0; streak.feverDuration = (effects.feverDuration ?? 8000) + (streak.feverMultiplier === 5 ? 2000 : 0);
      streak.feverUntil = now + streak.feverDuration; startedFever = true;
    }
  }
  const fever = now < streak.feverUntil, critical = roll < (effects.criticalChance ?? .08);
  return { combo: streak.combo, fever, critical, startedFever,
    superFever: fever && streak.feverMultiplier === 5,
    multiplier: (fever ? streak.feverMultiplier : 1) * (critical ? 5 : 1),
    bonusReady: streak.combo % 25 === 0,
    milestone: streak.combo % 10 === 0 };
}
export function addBonus(state, amount) {
  state.money = Math.min(Number.MAX_SAFE_INTEGER, state.money + amount);
  state.earned = Math.min(Number.MAX_SAFE_INTEGER, state.earned + amount);
}
