// 레이팅 점수: 이기면 오르고 지면 내려간다 (엘로 방식).
// 컴퓨터 대전, 온라인 랭크전, 퍼즐은 점수를 따로 쓰고, 퍼즐 러시는 최고 기록만 남긴다.
// 이 기기(브라우저)에만 저장한다.

export const START = 800;
export const KINDS = { bot: '컴퓨터 대전', online: '온라인', puzzle: '퍼즐' };
export const RUSH_MODES = ['180', '300', 'survival'];
const KEY = 'green-chess-ratings-v1';

export function expected(rating, opponent) {
  return 1 / (1 + 10 ** ((opponent - rating) / 400));
}

// 처음 20판은 크게, 그다음은 작게 움직인다
export function nextRating(rating, opponent, score, games = 0) {
  const k = games < 20 ? 40 : 20;
  return Math.max(100, Math.min(3500, Math.round(rating + k * (score - expected(rating, opponent)))));
}

function fresh() {
  return {
    bot: { r: START, games: 0, best: START },
    online: { r: START, games: 0, best: START },
    puzzle: { r: START, games: 0, best: START },
    rush: { 180: 0, 300: 0, survival: 0 },
  };
}

const okNumber = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;

export function loadRatings(storage = globalThis.localStorage) {
  const out = fresh();
  try {
    const saved = JSON.parse(storage?.getItem(KEY) ?? 'null');
    if (!saved || typeof saved !== 'object') return out;
    for (const kind of Object.keys(KINDS)) {
      const s = saved[kind];
      if (s && okNumber(s.r, 100, 3500) && okNumber(s.games, 0, 1e7)) {
        out[kind] = { r: Math.round(s.r), games: Math.floor(s.games), best: okNumber(s.best, 100, 3500) ? Math.round(s.best) : Math.round(s.r) };
      }
    }
    for (const mode of RUSH_MODES) if (okNumber(saved.rush?.[mode], 0, 1000)) out.rush[mode] = Math.floor(saved.rush[mode]);
  } catch { /* 망가진 저장은 새로 시작 */ }
  return out;
}

export function saveRatings(ratings, storage = globalThis.localStorage) {
  try { storage?.setItem(KEY, JSON.stringify(ratings)); return true; } catch { return false; }
}

// score: 이김 1, 비김 0.5, 짐 0. 바뀐 점수를 돌려준다.
export function applyResult(ratings, kind, opponent, score) {
  const entry = ratings[kind];
  const before = entry.r;
  entry.r = nextRating(before, opponent, score, entry.games);
  entry.games++;
  entry.best = Math.max(entry.best, entry.r);
  return { before, after: entry.r, delta: entry.r - before };
}

// 새 기록이면 true
export function recordRush(ratings, mode, score) {
  if (!RUSH_MODES.includes(mode)) return false;
  if (score <= ratings.rush[mode]) return false;
  ratings.rush[mode] = score;
  return true;
}

export const signed = n => (n > 0 ? `+${n}` : `${n}`);
