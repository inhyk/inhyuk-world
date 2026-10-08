// 챌린지(미션). 인혁이 기획서 7번: "챌린지는 타워에서 5번 연쇄하는 거야 (미션 같은 거)".
// 이벤트(연쇄·터뜨림·전소·상쇄·승리·층·레벨·구매)가 들어오면 진행도를 올린다.
// kind: 'max' = 가장 큰 값이 목표를 넘으면 완료, 'sum' = 모두 더해서 목표를 넘으면 완료.

import { MAPS } from './maps.mjs';
import { todayKey } from './calendar.mjs';
import { GRADES } from './tutorial.mjs';
export { todayKey } from './calendar.mjs';
const tower = e => e.mode === 'tower';
const m = (id, group, title, goal, event, value, reward, kind = 'max') => ({ id, group, title, goal, event, value, reward, kind });

export const MISSIONS = [
  m('tower-chain-2', 'tower', '타워에서 2연쇄 하기', 2, 'chain', e => (tower(e) ? e.chain : 0), { coins: 40, xp: 30 }),
  m('tower-chain-3', 'tower', '타워에서 3연쇄 하기', 3, 'chain', e => (tower(e) ? e.chain : 0), { coins: 80, xp: 50 }),
  m('tower-chain-5', 'tower', '타워에서 5연쇄 하기', 5, 'chain', e => (tower(e) ? e.chain : 0), { coins: 200, xp: 120 }),
  m('tower-chain-7', 'tower', '타워에서 7연쇄 하기', 7, 'chain', e => (tower(e) ? e.chain : 0), { coins: 400, xp: 220 }),
  m('tower-chain-10', 'tower', '타워에서 10연쇄 하기', 10, 'chain', e => (tower(e) ? e.chain : 0), { coins: 1000, xp: 500 }),
  m('tower-allclear', 'tower', '타워에서 전소하기 (필드를 모두 지우기)', 1, 'allClear', e => (tower(e) ? 1 : 0), { coins: 200, xp: 100 }, 'sum'),
  m('tower-offset', 'tower', '타워에서 상쇄 성공하기', 1, 'offset', e => (tower(e) ? 1 : 0), { coins: 120, xp: 60 }, 'sum'),
  m('tower-rock', 'tower', '타워에서 한 번에 운석(방해 뿌요 30개) 만들기', 30, 'chain', e => (tower(e) ? e.made : 0), { coins: 300, xp: 150 }),
  m('tower-star', 'tower', '타워에서 한 번에 별(방해 뿌요 180개) 만들기', 180, 'chain', e => (tower(e) ? e.made : 0), { coins: 1200, xp: 600 }),
  m('tower-pop-100', 'tower', '타워에서 뿌요 100개 터뜨리기', 100, 'pop', e => (tower(e) ? e.puyos : 0), { coins: 100, xp: 60 }, 'sum'),
  m('tower-pop-1000', 'tower', '타워에서 뿌요 1,000개 터뜨리기', 1000, 'pop', e => (tower(e) ? e.puyos : 0), { coins: 500, xp: 250 }, 'sum'),
  m('tower-floor-1', 'tower', '1층 작은 뿌요 층 깨기', 1, 'tower', e => e.floor, { coins: 50, xp: 30 }),
  m('tower-floor-3', 'tower', '3층 운석 층 깨기', 3, 'tower', e => e.floor, { coins: 150, xp: 80 }),
  m('tower-floor-5', 'tower', '5층 달 층 깨기', 5, 'tower', e => e.floor, { coins: 300, xp: 150 }),
  m('tower-floor-6', 'tower', '꼭대기 왕관 층 깨기', 6, 'tower', e => e.floor, { coins: 600, xp: 300 }),
  m('tower-floor-7', 'tower', '비밀의 혜성 층 깨기', 7, 'tower', e => e.floor, { coins: 1500, xp: 700 }),

  m('big-group', 'skill', '한 번에 8개 이상 이어서 터뜨리기', 8, 'pop', e => e.maxGroup, { coins: 120, xp: 60 }),
  m('four-colors', 'skill', '4가지 색을 한 번에 터뜨리기', 4, 'pop', e => e.colors, { coins: 150, xp: 80 }),
  m('chain-8', 'skill', '아무 모드에서 8연쇄 하기', 8, 'chain', e => e.chain, { coins: 500, xp: 250 }),
  m('endless-10k', 'skill', '혼자 하기에서 10,000점', 10000, 'endless', e => e.score, { coins: 100, xp: 60 }),
  m('endless-100k', 'skill', '혼자 하기에서 100,000점', 100000, 'endless', e => e.score, { coins: 500, xp: 250 }),

  m('win-1', 'play', '대전에서 처음 이기기', 1, 'match', e => (e.win ? 1 : 0), { coins: 50, xp: 30 }, 'sum'),
  m('win-10', 'play', '대전에서 10번 이기기', 10, 'match', e => (e.win ? 1 : 0), { coins: 300, xp: 150 }, 'sum'),
  m('win-50', 'play', '대전에서 50번 이기기', 50, 'match', e => (e.win ? 1 : 0), { coins: 1000, xp: 500 }, 'sum'),
  m('two-player', 'play', '2인 플레이 한 판 하기', 1, 'match', e => (e.mode === 'local' ? 1 : 0), { coins: 50, xp: 30 }, 'sum'),
  m('online-play', 'play', '온라인 대전 한 판 하기', 1, 'match', e => (e.mode === 'online' ? 1 : 0), { coins: 80, xp: 50 }, 'sum'),
  m('online-win', 'play', '온라인 대전에서 이기기', 1, 'match', e => (e.mode === 'online' && e.win ? 1 : 0), { coins: 200, xp: 100 }, 'sum'),

  m('level-5', 'grow', '레벨 5 되기', 5, 'level', e => e.level, { coins: 150, xp: 0 }),
  m('level-10', 'grow', '레벨 10 되기', 10, 'level', e => e.level, { coins: 300, xp: 0 }),
  m('level-20', 'grow', '레벨 20 되기', 20, 'level', e => e.level, { coins: 800, xp: 0 }),
  m('buy-skin', 'grow', '상점에서 스킨 사기', 1, 'buy', e => (e.kind === 'skin' ? 1 : 0), { coins: 60, xp: 30 }, 'sum'),
  m('buy-effect', 'grow', '상점에서 터짐 효과 사기', 1, 'buy', e => (e.kind === 'effect' ? 1 : 0), { coins: 60, xp: 30 }, 'sum'),
];

// 기존 ID를 유지하고, 짧은 목표부터 오래 즐길 목표까지 새 도전을 더한다.
const prize = n => ({ coins: 40 + n * 35, xp: 20 + n * 15 });
for (const [i, n] of [2, 3, 4, 5, 6, 7, 9, 10, 11, 12].entries())
  MISSIONS.push(m(`chain-master-${n}`, 'skill', `${n}연쇄 달성하기`, n, 'chain', e => e.chain, prize(i + 1)));
for (const [key, title, values, event, value] of [
  ['pop-total', '뿌요 터뜨리기', [50, 200, 500, 1500, 3000, 5000, 10000, 20000], 'pop', e => e.puyos],
  ['send-total', '방해 뿌요 보내기', [30, 100, 300, 720, 1440, 3000, 10000], 'chain', e => e.sent],
  ['clear-total', '전소 성공하기', [1, 3, 5, 10, 25, 50, 100], 'allClear', () => 1],
  ['offset-total', '상쇄 성공하기', [3, 5, 10, 25, 50, 100, 200], 'offset', () => 1],
]) for (const [i, n] of values.entries()) MISSIONS.push(m(`${key}-${n}`, 'skill', `${title} · 누적 ${n.toLocaleString('ko-KR')}${key.includes('total') && ['pop-total', 'send-total'].includes(key) ? '개' : '번'}`, n, event, value, prize(i + 1), 'sum'));
for (const [key, title, values] of [
  ['games', '게임 완료', [3, 5, 10, 20, 30, 50, 100, 200, 500]],
  ['wins', '대전 승리', [3, 5, 20, 30, 75, 100, 200]],
  ['localGames', '2인 플레이 완료', [3, 10, 25, 50]],
  ['onlineGames', '온라인 대전 완료', [3, 10, 25, 50]],
]) for (const [i, n] of values.entries()) MISSIONS.push(m(`career-${key}-${n}`, 'play', `${title} ${n}번`, n, 'career', e => e[key], prize(i + 1)));
for (const [i, n] of [1000, 5000, 25000, 50000, 200000].entries())
  MISSIONS.push(m(`solo-score-${n}`, 'skill', `혼자 하기 ${n.toLocaleString('ko-KR')}점 달성`, n, 'endless', e => e.score, prize(i + 1)));
for (const n of [2, 3, 7, 15, 25, 30, 40, 50])
  MISSIONS.push(m(`grow-level-${n}`, 'grow', `레벨 ${n} 달성`, n, 'level', e => e.level, { coins: n * 30, xp: 0 }));
for (const map of MAPS) for (const n of [1, 5, 15])
  MISSIONS.push(m(`map-${map.id}-${n}`, 'maps', `${map.name}에서 ${n}번 대전 완료`, n, 'match', e => (e.map === map.id ? 1 : 0), prize(n), 'sum'));
for (const [kind, title] of [['daily', '출석 선물'], ['spin', '스핀 선물'], ['time', '시간 선물']]) for (const n of [1, 5, 15])
  MISSIONS.push(m(`gift-${kind}-${n}`, 'gifts', `${title} ${n}번 받기`, n, 'gift', e => e.kind === kind ? 1 : 0, { ...prize(n), tickets: n === 15 ? { skin: 1 } : { spin: 1 } }, 'sum'));
for (const [kind, title] of [['skin', '스킨'], ['effect', '터짐 효과']]) for (const n of [3, 5, 10, 15, 18])
  MISSIONS.push(m(`collect-${kind}-${n}`, 'grow', `${title} ${n}개 모으기`, n, 'collection', e => e[kind], prize(n)));
MISSIONS.push(m('tower-floor-8', 'tower', '별의 수호자 노바 이기기', 8, 'tower', e => e.floor, { coins: 2500, xp: 1000, tickets: { skin: 1, effect: 1 } }));
for (const n of [2, 4]) MISSIONS.push(m(`tower-floor-${n}`, 'tower', `${n}층 처음 깨기`, n, 'tower', e => e.floor, prize(n)));
for (const n of [5, 20, 50]) MISSIONS.push(m(`tower-win-${n}`, 'tower', `타워에서 ${n}번 승리`, n, 'match', e => tower(e) && e.win ? 1 : 0, prize(n), 'sum'));


// ---------- 인혁이 기획서 「뿌요뿌요 (업그레이드)」 5번: "챌린지를 더 만들어줘" ----------
// 업그레이드 3, 4와 이번에 생긴 것들(트로피, 관전, 응원, 펫, 2배 부스트, 배우기, 친구, 친구 선물)에도 챌린지를 만들고,
// 예전 챌린지는 더 높은 목표를 붙였다. 예전 ID 는 그대로 둔다 (저장된 기록이 이어지게).
// status 이벤트: 지금 내 기록을 한꺼번에 알려 준다 { trophies, friends, petKinds, petDraws, school: [끝낸 등급 id], streak, coins }
const NUM = n => n.toLocaleString('ko-KR');
// 트로피와 대전 승리
for (const [i, n] of [1, 5, 10, 25, 50, 100, 300].entries())
  MISSIONS.push(m(`trophy-${n}`, 'trophy', `트로피 ${NUM(n)}개 모으기`, n, 'status', e => e.trophies, prize(i + 2)));
for (const [i, n] of [1, 10, 30, 100].entries())
  MISSIONS.push(m(`vs-win-${n}`, 'trophy', `AI 대전에서 ${n}번 이기기`, n, 'match', e => (e.mode === 'vs' && e.win ? 1 : 0), prize(i + 2), 'sum'));
for (const [i, n] of [3, 10, 30].entries())
  MISSIONS.push(m(`online-win-${n}`, 'trophy', `온라인 대전에서 ${n}번 이기기`, n, 'match', e => (e.mode === 'online' && e.win ? 1 : 0), prize(i + 4), 'sum'));
// 친구, 관전, 응원, 친구 선물
for (const [i, n] of [1, 3, 5, 10, 20].entries())
  MISSIONS.push(m(`friends-${n}`, 'friends', `친구 ${n}명 사귀기`, n, 'status', e => e.friends, prize(i + 2)));
for (const [i, n] of [1, 5, 20].entries())
  MISSIONS.push(m(`watch-${n}`, 'friends', `온라인 대전 ${n}번 관전하기`, n, 'watch', () => 1, prize(i + 1), 'sum'));
for (const [i, n] of [1, 10, 50].entries())
  MISSIONS.push(m(`cheer-${n}`, 'friends', `관전하면서 응원 ${n}번 보내기 (화이팅 · 좋아요)`, n, 'cheer', () => 1, prize(i + 1), 'sum'));
for (const [i, n] of [1, 5, 20].entries())
  MISSIONS.push(m(`gift-send-${n}`, 'friends', `친구에게 선물 ${n}번 보내기`, n, 'giftSent', () => 1, { ...prize(i + 2), tickets: n === 20 ? { effect: 1 } : { spin: 1 } }, 'sum'));
// 펫과 2배 부스트
for (const [i, n] of [1, 2, 3, 4, 5].entries())
  MISSIONS.push(m(`pet-kinds-${n}`, 'pets', n === 1 ? '알에서 첫 펫 뽑기' : n === 5 ? '펫 다섯 종류 모두 모으기' : `펫 ${n}종류 모으기`, n, 'status', e => e.petKinds, n === 5 ? { coins: 5000, xp: 2000, tickets: { skin: 1, effect: 1 } } : prize(i * 3 + 2)));
for (const [i, n] of [5, 10, 30].entries())
  MISSIONS.push(m(`pet-draw-${n}`, 'pets', `펫 뽑기 ${n}번 하기`, n, 'status', e => e.petDraws, { ...prize(i * 2 + 3), tickets: { pet: 1 } }));
for (const [i, n] of [1, 5, 20].entries())
  MISSIONS.push(m(`boost-${n}`, 'pets', `2배 부스트 ${n}번 쓰기`, n, 'boost', () => 1, { ...prize(i + 2), tickets: n === 20 ? { boost: 2 } : {} }, 'sum'));
// 뿌요뿌요 배우기: 등급마다 하나 (초급부터 맨 끝 등급까지)
for (const [i, g] of GRADES.entries())
  MISSIONS.push(m(`school-${g.id}`, 'school', `뿌요뿌요 배우기 「${g.name}」 끝내기`, 1, 'status', e => (e.school?.includes(g.id) ? 1 : 0), prize(i * 2 + 1)));
// 실력: 더 긴 연쇄, 연쇄 여러 번, 한 번에 많이
for (const [i, n] of [13, 14, 15].entries())
  MISSIONS.push(m(`chain-master-${n}`, 'skill', `${n}연쇄 달성하기`, n, 'chain', e => e.chain, prize(i + 11)));
for (const [min, values] of [[3, [10, 50, 200]], [5, [5, 25, 100]]]) for (const [i, n] of values.entries())
  MISSIONS.push(m(`chain${min}-total-${n}`, 'skill', `${min}연쇄 이상 · 누적 ${n}번`, n, 'chain', e => (e.chain >= min ? 1 : 0), prize(i + min - 1), 'sum'));
for (const [i, n] of [30, 60, 120].entries())
  MISSIONS.push(m(`send-once-${n}`, 'skill', `한 번의 연쇄로 방해 뿌요 ${n}개 보내기`, n, 'chain', e => e.sent || 0, prize(i * 2 + 3)));
for (const [i, n] of [10, 12].entries())
  MISSIONS.push(m(`big-group-${n}`, 'skill', `한 번에 ${n}개 이상 이어서 터뜨리기`, n, 'pop', e => e.maxGroup, prize(i + 4)));
MISSIONS.push(m('five-colors', 'skill', '5가지 색을 한 번에 터뜨리기 (다섯 색 맵에서)', 5, 'pop', e => e.colors, prize(8)));
for (const [i, n] of [500000, 1000000].entries())
  MISSIONS.push(m(`solo-score-${n}`, 'skill', `혼자 하기 ${NUM(n)}점 달성`, n, 'endless', e => e.score, prize(i * 2 + 7)));
// 성장: 높은 레벨, 코인, 출석
for (const n of [60, 70, 80, 99])
  MISSIONS.push(m(`grow-level-${n}`, 'grow', `레벨 ${n} 달성`, n, 'level', e => e.level, { coins: n * 30, xp: 0 }));
for (const [i, n] of [1000, 5000, 20000, 100000].entries())
  MISSIONS.push(m(`coins-${n}`, 'grow', `코인 ${NUM(n)}개 모으기 (한 번에 가진 수)`, n, 'status', e => e.coins, { coins: 0, xp: 60 + i * 80, tickets: { spin: 1 } }));
for (const [i, n] of [3, 7, 14, 30].entries())
  MISSIONS.push(m(`streak-${n}`, 'gifts', `${n}일 이어서 출석 선물 받기`, n, 'status', e => e.streak, { ...prize(i * 2 + 2), tickets: n >= 14 ? { skin: 1 } : { spin: 1 } }));
// 맵 탐험: 맵마다 이기기
for (const map of MAPS) for (const [i, n] of [3, 10].entries())
  MISSIONS.push(m(`map-win-${map.id}-${n}`, 'maps', `${map.name}에서 ${n}번 이기기`, n, 'match', e => (e.map === map.id && e.win ? 1 : 0), prize(i * 3 + 3), 'sum'));

export const GROUPS = {
  tower: '타워 챌린지', skill: '실력 챌린지', play: '놀이 챌린지', trophy: '트로피 챌린지', friends: '친구 · 관전 챌린지', pets: '펫 · 부스트 챌린지',
  school: '배우기 챌린지', grow: '성장 챌린지', maps: '맵 탐험 챌린지', gifts: '선물 챌린지',
};

// 오늘의 미션: 날짜마다 3개씩 바뀐다
export const DAILY_POOL = [
  m('d-chain3', 'daily', '오늘 3연쇄 이상을 3번 하기', 3, 'chain', e => (e.chain >= 3 ? 1 : 0), { coins: 60, xp: 40 }, 'sum'),
  m('d-pop200', 'daily', '오늘 뿌요 200개 터뜨리기', 200, 'pop', e => e.puyos, { coins: 60, xp: 40 }, 'sum'),
  m('d-win2', 'daily', '오늘 대전에서 2번 이기기', 2, 'match', e => (e.win ? 1 : 0), { coins: 80, xp: 50 }, 'sum'),
  m('d-tower', 'daily', '오늘 타워에 2번 도전하기', 2, 'match', e => (e.mode === 'tower' ? 1 : 0), { coins: 50, xp: 40 }, 'sum'),
  m('d-garbage', 'daily', '오늘 방해 뿌요 60개 보내기', 60, 'chain', e => e.sent || 0, { coins: 70, xp: 50 }, 'sum'),
  m('d-allclear', 'daily', '오늘 전소 1번 하기', 1, 'allClear', () => 1, { coins: 90, xp: 60 }, 'sum'),
  m('d-chain5', 'daily', '오늘 5연쇄 하기', 5, 'chain', e => e.chain, { coins: 100, xp: 70 }),
  m('d-endless', 'daily', '오늘 혼자 하기에서 5,000점', 5000, 'endless', e => e.score, { coins: 60, xp: 40 }),
  m('d-games3', 'daily', '오늘 3판 하기', 3, 'match', () => 1, { coins: 50, xp: 40 }, 'sum'),
  m('d-offset', 'daily', '오늘 상쇄 2번 하기', 2, 'offset', () => 1, { coins: 70, xp: 50 }, 'sum'),
  // 「챌린지를 더 만들어줘」로 더한 오늘의 미션
  m('d-chain4', 'daily', '오늘 4연쇄 하기', 4, 'chain', e => e.chain, { coins: 80, xp: 60 }),
  m('d-pop400', 'daily', '오늘 뿌요 400개 터뜨리기', 400, 'pop', e => e.puyos, { coins: 90, xp: 60 }, 'sum'),
  m('d-vs', 'daily', '오늘 AI 대전에서 1번 이기기', 1, 'match', e => (e.mode === 'vs' && e.win ? 1 : 0), { coins: 70, xp: 50 }, 'sum'),
  m('d-games5', 'daily', '오늘 5판 하기', 5, 'match', () => 1, { coins: 80, xp: 60 }, 'sum'),
  m('d-garbage120', 'daily', '오늘 방해 뿌요 120개 보내기', 120, 'chain', e => e.sent || 0, { coins: 100, xp: 70 }, 'sum'),
  m('d-colors3', 'daily', '오늘 3가지 색을 한 번에 터뜨리기', 3, 'pop', e => e.colors, { coins: 70, xp: 50 }),
];

function hash(text) {
  let h = 2166136261;
  for (const ch of text) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function dailyFor(date) {
  const pool = DAILY_POOL.slice();
  let h = hash(date);
  const out = [];
  while (out.length < 3) {
    h = Math.imul(h ^ (h >>> 13), 1103515245) + 12345 >>> 0;
    out.push(pool.splice(h % pool.length, 1)[0]);
  }
  return out;
}
export function ensureDaily(progress, date = todayKey()) {
  if (!progress.daily || progress.daily.date !== date) {
    progress.daily = { date, list: dailyFor(date).map(d => ({ id: d.id, v: 0, claimed: false })) };
  }
  return progress.daily;
}
const dailyDef = id => DAILY_POOL.find(d => d.id === id);

function advance(def, slot, event) {
  if (def.event !== event.type) return false;
  const value = Number(def.value(event)) || 0;
  if (!value) return false;
  const before = slot.v >= def.goal;
  slot.v = def.kind === 'sum' ? slot.v + value : Math.max(slot.v, value);
  return !before && slot.v >= def.goal;
}

// 이벤트를 넣으면 방금 완료된 미션 목록을 돌려준다
export function track(progress, event, date = todayKey()) {
  const done = [];
  progress.missions = progress.missions || {};
  for (const def of MISSIONS) {
    const slot = progress.missions[def.id] || (progress.missions[def.id] = { v: 0, claimed: false });
    if (advance(def, slot, event)) done.push(def);
  }
  const daily = ensureDaily(progress, date);
  for (const slot of daily.list) {
    const def = dailyDef(slot.id);
    if (def && advance(def, slot, event)) done.push(def);
  }
  return done;
}

export function missionView(progress, date = todayKey()) {
  const daily = ensureDaily(progress, date);
  const row = (def, slot) => ({ ...def, v: Math.min(slot?.v || 0, def.goal), done: (slot?.v || 0) >= def.goal, claimed: !!slot?.claimed });
  return {
    daily: daily.list.map(slot => row(dailyDef(slot.id), slot)),
    list: MISSIONS.map(def => row(def, progress.missions?.[def.id])),
  };
}

// 보상 받기. 받을 수 없으면 null
export function claim(progress, id, date = todayKey()) {
  const def = MISSIONS.find(d => d.id === id);
  let slot;
  if (def) slot = progress.missions?.[id];
  else {
    const daily = ensureDaily(progress, date);
    slot = daily.list.find(s => s.id === id);
  }
  const d = def || dailyDef(id);
  if (!d || !slot || slot.claimed || slot.v < d.goal) return null;
  slot.claimed = true;
  return d.reward;
}

export function unclaimedCount(progress, date = todayKey()) {
  const view = missionView(progress, date);
  return [...view.daily, ...view.list].filter(m => m.done && !m.claimed).length;
}
