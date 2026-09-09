// Only a completed EX run on Encore grants access to NEO.
export const PROGRESS_KEY = 'mtt-live-progress-v1';
const EX_MODES = ['easy', 'normal', 'hard'];
export function createProgress(saved) {
  return { clears: Object.fromEntries([...EX_MODES, 'neo'].map(key => [key, saved?.clears?.[key] === true])) };
}
export function neoUnlocked(progress) { return progress.clears.hard === true; }
export function canStartChallenge(progress, difficulty) {
  return EX_MODES.includes(difficulty) || (difficulty === 'neo' && neoUnlocked(progress));
}
export function recordVictory(progress, battle) {
  if (battle.mode !== 'won' || !['fight', 'audience'].includes(battle.ending)) return false;
  const validEX = battle.boss === 'ex' && EX_MODES.includes(battle.difficulty);
  const validNEO = battle.boss === 'neo' && battle.difficulty === 'neo' && neoUnlocked(progress);
  if (!validEX && !validNEO) return false;
  const wasUnlocked = neoUnlocked(progress);
  progress.clears[battle.difficulty] = true;
  return !wasUnlocked && neoUnlocked(progress);
}
