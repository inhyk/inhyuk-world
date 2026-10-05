// 가장 큰 젤리 타워 기록 (클라우드 저장 크기 확인용). 실제로 될 수 있는 값을 모두 끝까지 채운다.
import { newProgress, sanitize } from './profile.mjs';
import { SKINS, EFFECTS } from './shop.mjs';
import { MISSIONS, dailyFor } from './missions.mjs';
import { CHAT_MAX, CHAT_KEEP, FRIEND_MAX, REQUEST_MAX, FRIEND_ALPHABET, makeMailKey } from './chat.mjs';

const BIG = 999999999;
// 친구 코드 n 번째 (서로 다르게)
const code = n => Array.from({ length: 6 }, (_, i) => FRIEND_ALPHABET[Math.floor(n / FRIEND_ALPHABET.length ** i) % FRIEND_ALPHABET.length]).join('');

// 친구 기록(progress.social)을 허용되는 끝까지: 친구 30명 × 대화 50줄 × 60글자(UTF-8 로 가장 긴 이모지), 신청, 차단
export function maxSocial() {
  const emoji = '👨‍👩‍👧‍👦'; // 한 글자(grapheme)가 UTF-8 25바이트
  const s = { code: code(0), key: makeMailKey(), friends: [], blocked: [], chats: {}, requests: [], sent: [], lastMail: Date.now() };
  for (let i = 1; i <= FRIEND_MAX; i++) {
    s.friends.push({ code: code(i), name: '가나다라마바사아자차', level: 999, since: Date.now() });
    s.chats[code(i)] = Array.from({ length: CHAT_KEEP }, (_, j) => ({ me: j % 2 === 0, text: emoji.repeat(CHAT_MAX), time: Date.now() + j }));
  }
  for (let i = 0; i < REQUEST_MAX; i++) s.requests.push({ code: code(100 + i), name: '가나다라마바사아자차', level: 999, time: Date.now() });
  for (let i = 0; i < FRIEND_MAX; i++) s.sent.push({ code: code(200 + i), time: Date.now() });
  for (let i = 0; i < 200; i++) s.blocked.push(code(300 + i));
  return s;
}

// 게임 기록(소셜 빼고)을 끝까지: 모든 스킨과 효과, 모든 미션, 오늘 미션, 큰 숫자
export function maxProgress({ social = true } = {}) {
  const p = newProgress();
  Object.assign(p, { level: 99, xp: BIG, coins: BIG, tutorial: true });
  p.owned = { skin: SKINS.map(s => s.id), effect: EFFECTS.map(e => e.id) };
  p.equip = { skin: SKINS.at(-1).id, effect: EFFECTS.at(-1).id };
  p.tower = { best: 6, cleared: true, comet: true, nova: true, losses: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i + 1, BIG])), endings: BIG, cometEndings: BIG };
  p.tickets = { skin: 1e6, effect: 1e6, spin: 1e6 };
  p.promo = { lastGame: BIG };
  p.missions = Object.fromEntries(MISSIONS.map(m => [m.id, { v: BIG, claimed: true }]));
  p.daily = { date: '2026-10-05', list: dailyFor('2026-10-05').map(d => ({ id: d.id, v: BIG, claimed: true })) };
  p.rewards = { dailyDate: '2026-10-05', dailyStreak: 1e6, spinDate: '2026-10-05', spinIndex: 5, date: '2026-10-05', playSeconds: 86400, claimedTime: ['5m', '15m', '30m'] };
  p.stats = Object.fromEntries(Object.keys(p.stats).map(k => [k, BIG]));
  p.settings = { ...p.settings, localMap: 'nebula-garden-long-name' };
  if (social) p.social = maxSocial();
  return sanitize(p);
}

export const bytes = v => new TextEncoder().encode(JSON.stringify(v)).length;
