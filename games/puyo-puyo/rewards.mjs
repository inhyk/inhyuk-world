import { addXp } from './profile.mjs';
import { calendarBonus, todayKey, shiftDay } from './calendar.mjs';

export const DAILY_REWARDS = [
  { coins: 100, xp: 30 }, { coins: 150, xp: 40 }, { coins: 200, xp: 50 },
  { coins: 250, xp: 60 }, { coins: 300, xp: 70 }, { coins: 400, xp: 90 }, { coins: 700, xp: 150 },
];
// 여섯 칸의 크기와 당첨 확률은 모두 같다 (각 1/6). 코인을 쓰지 않는 하루 한 번 무료 스핀.
export const SPIN_PRIZES = [
  { coins: 100, xp: 0 }, { coins: 0, xp: 100 }, { coins: 200, xp: 30 },
  { coins: 300, xp: 0 }, { coins: 0, xp: 200 }, { coins: 500, xp: 100 },
];
export const TIME_REWARDS = [
  { id: '5m', seconds: 300, coins: 100, xp: 40 },
  { id: '15m', seconds: 900, coins: 200, xp: 80 },
  { id: '30m', seconds: 1800, coins: 400, xp: 150 },
];
export function rewardPreview(reward, now = new Date()) {
  const bonus = calendarBonus(now);
  return { coins: Math.max(0, Math.round(Number(reward.coins) || 0)) * bonus.coinMultiplier,
    xp: Math.max(0, Math.round(Number(reward.xp) || 0)) * bonus.xpMultiplier, bonus };
}
// 경기, 챌린지, 출석, 스핀, 시간 보상 모두 이 경로로 지급하여 배율을 한 번만 적용한다.
export function grantReward(progress, reward, now = new Date()) {
  const result = rewardPreview(reward, now);
  progress.coins += result.coins;
  const lv = addXp(progress, result.xp, result.bonus.coinMultiplier);
  return { ...result, lv };
}
export function ensureRewards(progress, now = new Date()) {
  const date = todayKey(now);
  progress.rewards ||= { dailyDate: '', dailyStreak: 0, spinDate: '', spinIndex: null };
  const r = progress.rewards;
  if (r.date !== date) Object.assign(r, { date, playSeconds: 0, claimedTime: [] });
  return r;
}
export function rewardView(progress, now = new Date()) {
  const r = ensureRewards(progress, now), date = todayKey(now);
  const dailyClaimed = r.dailyDate >= date;
  const nextStreak = r.dailyDate === shiftDay(date, -1) ? r.dailyStreak + 1 : 1;
  const day = ((dailyClaimed ? Math.max(1, r.dailyStreak) : nextStreak) - 1) % 7;
  return { date, day, dailyClaimed, spinClaimed: r.spinDate >= date, spinIndex: r.spinIndex,
    daily: rewardPreview(DAILY_REWARDS[day], now), playSeconds: r.playSeconds,
    time: TIME_REWARDS.map(reward => ({ ...reward, ...rewardPreview(reward, now),
      claimed: r.claimedTime.includes(reward.id), ready: r.playSeconds >= reward.seconds })) };
}
export function claimDaily(progress, now = new Date()) {
  const view = rewardView(progress, now);
  if (view.dailyClaimed) return null;
  const r = progress.rewards;
  r.dailyStreak = r.dailyDate === shiftDay(view.date, -1) ? r.dailyStreak + 1 : 1;
  r.dailyDate = view.date;
  return grantReward(progress, DAILY_REWARDS[view.day], now);
}
export function spin(progress, now = new Date(), random = Math.random) {
  const r = ensureRewards(progress, now), date = todayKey(now);
  if (r.spinDate >= date) return null;
  const roll = random();
  const index = Math.min(SPIN_PRIZES.length - 1, Math.floor(Math.max(0, Number.isFinite(roll) ? roll : 0) * SPIN_PRIZES.length));
  r.spinDate = date; r.spinIndex = index;
  return { ...grantReward(progress, SPIN_PRIZES[index], now), index };
}
export function addPlayTime(progress, seconds, now = new Date()) {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const r = ensureRewards(progress, now);
  r.playSeconds = Math.min(86400, r.playSeconds + seconds);
}
export function claimTime(progress, id, now = new Date()) {
  const r = ensureRewards(progress, now), reward = TIME_REWARDS.find(x => x.id === id);
  if (!reward || r.claimedTime.includes(id) || r.playSeconds < reward.seconds) return null;
  r.claimedTime.push(id);
  return grantReward(progress, reward, now);
}
