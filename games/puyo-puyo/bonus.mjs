// 판에서 받는 경험치와 코인의 배수 (인혁이 기획서 「뿌요뿌요 (업그레이드)」 1, 3, 6번).
// - 펫: 데리고 다니는 펫만큼 경험치가 몇 배 (pets.mjs)
// - 2배 부스트: 쓰면 15분 동안 경험치와 코인이 2배
// - 친구: 친구가 많을수록 경험치와 코인이 배수로 (친구 1명마다 +0.1배, 20명이면 3.0배까지)
// 판이 끝났을 때(finishMatch)만 곱한다. 출석, 스핀, 시간 선물, 챌린지 보상은 그대로다.
// 생일 코인 10배와 공휴일 경험치 2배(calendar.mjs)는 그 뒤에 따로 곱해진다.
import { equippedPet } from './pets.mjs';

export const BOOST_MULT = 2;
export const BOOST_MS = 15 * 60 * 1000;
export const BOOST_PRICE = 500;
export const FRIEND_STEP = 0.1, FRIEND_CAP = 20;

const tenth = v => Math.round(v * 10) / 10;
export const friendCount = n => Math.max(0, Math.min(FRIEND_CAP, Math.floor(Number(n) || 0)));
export const friendMultiplier = n => tenth(1 + friendCount(n) * FRIEND_STEP);

// 부스트가 얼마나 남았나 (ms)
export const boostLeft = (progress, now = Date.now()) => Math.max(0, (Number(progress.boost?.until) || 0) - now);
// 부스트 하나를 쓴다. 이미 켜져 있으면 남은 시간 뒤에 15분을 잇는다.
export function spendBoost(progress, now = Date.now()) {
  if (!((progress.tickets?.boost || 0) > 0)) return false;
  progress.tickets.boost--;
  progress.boost ||= { until: 0 };
  progress.boost.until = Math.max(now, Number(progress.boost.until) || 0) + BOOST_MS;
  return true;
}
export function buyBoost(progress) {
  if (progress.coins < BOOST_PRICE) return false;
  progress.coins -= BOOST_PRICE;
  progress.tickets.boost = (progress.tickets.boost || 0) + 1;
  return true;
}

// 지금 판에서 곱해지는 배수. friends: 친구 수
export function matchBonus(progress, { friends = 0, now = Date.now() } = {}) {
  const pet = equippedPet(progress);
  const petMult = pet?.mult ?? 1;
  const boost = boostLeft(progress, now) > 0 ? BOOST_MULT : 1;
  const friend = friendMultiplier(friends);
  return {
    pet, petMult, boost, friend, friends: friendCount(friends),
    xp: tenth(petMult * boost * friend), coins: tenth(boost * friend),
  };
}
export function applyBonus({ coins = 0, xp = 0 }, bonus) {
  return { coins: Math.round(coins * bonus.coins), xp: Math.round(xp * bonus.xp) };
}

// "12:34" 처럼 남은 시간
export function clockText(ms) {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}:${String(s % 60).padStart(2, '0')}`;
}
