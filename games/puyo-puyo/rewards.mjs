import { addXp, TICKET_KINDS } from './profile.mjs';
import { calendarBonus, todayKey, shiftDay } from './calendar.mjs';

export const DAILY_REWARDS = [
  { coins: 100, xp: 30, tickets: { effect: 1 } }, { coins: 150, xp: 40, tickets: { spin: 1 } }, { coins: 200, xp: 50, tickets: { skin: 1 } },
  { coins: 250, xp: 60, tickets: { spin: 1 } }, { coins: 300, xp: 70, tickets: { effect: 1 } }, { coins: 400, xp: 90, tickets: { spin: 2 } }, { coins: 700, xp: 150, tickets: { skin: 1, effect: 1, spin: 2 } },
];
// 여섯 칸의 크기와 당첨 확률은 모두 같다 (각 1/6). 코인을 쓰지 않는 하루 한 번 무료 스핀.
export const SPIN_PRIZES = [
  { coins: 100, xp: 0 }, { coins: 0, xp: 100 }, { coins: 100, xp: 30, tickets: { skin: 1 } },
  { coins: 150, xp: 0, tickets: { effect: 1 } }, { coins: 0, xp: 200, tickets: { effect: 1 } }, { coins: 500, xp: 100, tickets: { skin: 1, effect: 1 } },
];
// 시간 선물 (인혁이 기획서 「뿌요뿌요 (업그레이드)」 2번 "시간 선물을 더 만들어주고, 거기에 조금씩 펫도 조금 넣어줘"):
// 3개(5·15·30분)에서 7개로. 20분과 60분 선물에는 🥚 펫 뽑기권, 10분과 45분 선물에는 ⚡ 2배 부스트가 들어 있다.
export const TIME_REWARDS = [
  { id: '5m', seconds: 300, coins: 100, xp: 40, tickets: { spin: 1 } },
  { id: '10m', seconds: 600, coins: 150, xp: 60, tickets: { boost: 1 } },
  { id: '15m', seconds: 900, coins: 200, xp: 80, tickets: { effect: 1 } },
  { id: '20m', seconds: 1200, coins: 250, xp: 100, tickets: { pet: 1 } },
  { id: '30m', seconds: 1800, coins: 400, xp: 150, tickets: { skin: 1 } },
  { id: '45m', seconds: 2700, coins: 500, xp: 200, tickets: { boost: 1, spin: 1 } },
  { id: '60m', seconds: 3600, coins: 700, xp: 300, tickets: { pet: 1 } },
];
// 광고 보고 선물 받기 (인혁이 기획서 「뿌요뿌요 (업그레이드)」 2026-10-09 4번 "광고보고 코인 1000 받기 같은것도 만들어줘").
// seonn 광고(5판마다 나오는 것과 같은 포스터)를 AD_SECONDS 초 동안 보면 선물을 받는다. 광고 회사의 광고가 아니라 우리 사이트 알림이라 돈이 오가지 않는다.
// 선물마다 하루에 받을 수 있는 횟수(perDay)가 있고, 한국 시간 밤 12시에 다시 채워진다.
export const AD_SECONDS = 10;
export const AD_REWARDS = [
  { id: 'coins', icon: '🪙', title: '코인 1000 받기', coins: 1000, xp: 0, perDay: 3 },
  { id: 'boost', icon: '⚡', title: '2배 부스트 받기', coins: 0, xp: 0, tickets: { boost: 1 }, perDay: 1 },
  { id: 'spin', icon: '🎡', title: '추가 스핀권 받기', coins: 0, xp: 0, tickets: { spin: 1 }, perDay: 1 },
  { id: 'pet', icon: '🥚', title: '펫 뽑기권 받기', coins: 0, xp: 0, tickets: { pet: 1 }, perDay: 1 },
];
export function rewardPreview(reward, now = new Date()) {
  const bonus = calendarBonus(now);
  const tickets = Object.fromEntries(TICKET_KINDS.map(k => [k, Math.max(0, Math.floor(Number(reward.tickets?.[k]) || 0))]));
  return { tickets, coins: Math.max(0, Math.round(Number(reward.coins) || 0)) * bonus.coinMultiplier,
    xp: Math.max(0, Math.round(Number(reward.xp) || 0)) * bonus.xpMultiplier, bonus };
}
// 경기, 챌린지, 출석, 스핀, 시간 보상 모두 이 경로로 지급하여 배율을 한 번만 적용한다.
export function grantReward(progress, reward, now = new Date()) {
  const result = rewardPreview(reward, now);
  progress.tickets ||= {};
  for (const k of TICKET_KINDS) progress.tickets[k] = (progress.tickets[k] || 0) + result.tickets[k];
  progress.coins += result.coins;
  const lv = addXp(progress, result.xp, result.bonus.coinMultiplier);
  return { ...result, lv };
}
export function ensureRewards(progress, now = new Date()) {
  const date = todayKey(now);
  progress.rewards ||= { dailyDate: '', dailyStreak: 0, spinDate: '', spinIndex: null };
  const r = progress.rewards;
  if (r.date !== date) Object.assign(r, { date, playSeconds: 0, claimedTime: [], ads: {} });
  r.ads ||= {};
  return r;
}
// 광고 선물 목록: 오늘 몇 번 받았고(used) 몇 번 남았는지(left)
export function adView(progress, now = new Date()) {
  const r = ensureRewards(progress, now);
  return AD_REWARDS.map(reward => {
    const used = Math.max(0, Math.floor(Number(r.ads[reward.id]) || 0));
    return { ...reward, ...rewardPreview(reward, now), used, left: Math.max(0, reward.perDay - used) };
  });
}
// 광고를 다 본 뒤에 부른다. 오늘 횟수가 남아 있지 않으면 null
export function claimAd(progress, id, now = new Date()) {
  const r = ensureRewards(progress, now), reward = AD_REWARDS.find(x => x.id === id);
  const used = Math.max(0, Math.floor(Number(r.ads[id]) || 0));
  if (!reward || used >= reward.perDay) return null;
  r.ads[id] = used + 1;
  return grantReward(progress, reward, now);
}
export function rewardView(progress, now = new Date()) {
  const r = ensureRewards(progress, now), date = todayKey(now);
  const dailyClaimed = r.dailyDate >= date;
  const nextStreak = r.dailyDate === shiftDay(date, -1) ? r.dailyStreak + 1 : 1;
  const day = ((dailyClaimed ? Math.max(1, r.dailyStreak) : nextStreak) - 1) % 7;
  return { date, day, dailyClaimed, spinClaimed: r.spinDate >= date && !(progress.tickets?.spin > 0), freeSpinClaimed: r.spinDate >= date, spinIndex: r.spinIndex,
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
  const useTicket = r.spinDate >= date;
  if (useTicket && !(progress.tickets?.spin > 0)) return null;
  if (useTicket) progress.tickets.spin--;
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
