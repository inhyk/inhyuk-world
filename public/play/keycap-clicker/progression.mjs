import { clickIncome } from './core.mjs';
import { addBonus } from './rewards.mjs';
export const MISSIONS = [
  { id: 'taps', name: '톡톡 60번!', goal: 60, reward: 12, icon: '⌨️' },
  { id: 'criticals', name: '크리티컬 8번!', goal: 8, reward: 18, icon: '⚡' },
  { id: 'coins', name: '보너스 코인 3개!', goal: 3, reward: 20, icon: '🪙' },
];
export const ACHIEVEMENTS = [
  { id: 'a1', name: '첫 키캡', metric: 'level', goal: 1, icon: '🌱' },
  { id: 'a2', name: '열 개의 취향', metric: 'level', goal: 10, icon: '🎨' },
  { id: 'a3', name: '보석 수집가', metric: 'level', goal: 50, icon: '💎' },
  { id: 'a4', name: '궁극의 수집가', metric: 'level', goal: 100, icon: '👑' },
  { id: 'a5', name: '콤보 입문', metric: 'bestCombo', goal: 25, icon: '✨' },
  { id: 'a6', name: '100콤보 장인', metric: 'bestCombo', goal: 100, icon: '🔥' },
  { id: 'a7', name: '멈추지 않는 손', metric: 'bestCombo', goal: 250, icon: '🚀' },
  { id: 'a8', name: '짜릿한 한 방', metric: 'criticals', goal: 10, icon: '⚡' },
  { id: 'a9', name: '행운의 달인', metric: 'criticals', goal: 100, icon: '🍀' },
  { id: 'a10', name: '피버 마스터', metric: 'fevers', goal: 3, icon: '🌈' },
  { id: 'a11', name: '첫 보스 격파', metric: 'bosses', goal: 1, icon: '🔨' },
  { id: 'a12', name: '보스 사냥꾼', metric: 'bosses', goal: 5, icon: '🐉' },
];
export const metric = (s, id) => id === 'taps' ? s.presses : id === 'level' ? s.level : s.stats[id];
export const missionProgress = (s, m) => Math.max(0, metric(s, m.id) - s.missionStart[m.id]);
export function claimMission(s, id) {
  const m = MISSIONS.find(m => m.id === id);
  if (!m || missionProgress(s, m) < m.goal) return 0;
  s.missionStart[id] += m.goal;
  const reward = clickIncome(s) * m.reward; addBonus(s, reward); return reward;
}
export const unlocked = (s, a) => metric(s, a.metric) >= a.goal;
export function claimAchievement(s, id) {
  const a = ACHIEVEMENTS.find(a => a.id === id);
  if (!a || !unlocked(s, a) || s.claimedAchievements.includes(id)) return 0;
  s.claimedAchievements.push(id);
  const reward = clickIncome(s) * 20; addBonus(s, reward); return reward;
}
export function newBoss(s, now) {
  const rank = s.stats.bosses + 1, hp = Math.min(600, 90 + (rank - 1) * 24 + s.level * 3);
  return { rank, hp, maxHp: hp, until: now + 18000, reward: clickIncome(s) * Math.min(180, 75 + rank * 5), defeated: false };
}
export function bossDamage(boss, damage) {
  if (!Number.isFinite(damage) || damage <= 0) return 0;
  return boss.hp <= boss.maxHp / 2 ? Math.max(1, Math.ceil(damage * .65)) : damage;
}
export function hitBoss(s, boss, now, damage = 1) {
  if (!boss || boss.defeated || now >= boss.until) return 0;
  const hit = bossDamage(boss, damage);
  if (!hit) return 0;
  boss.hp = Math.max(0, boss.hp - hit);
  if (boss.hp) return 0;
  boss.defeated = true; s.stats.bosses++;
  addBonus(s, boss.reward); return boss.reward;
}
