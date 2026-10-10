// 온라인 대전에서 고르는 캐릭터 (인혁이 기획서 「뿌요뿌요 (업그레이드)」 2026-10-10 3번):
// "처음 온라인 대전에서 캐릭터를 고를 수 있게 해줘."
// 주인공과 타워의 층 주인 여덟 명. 두 사람은 캐릭터 이름 대신 번호만 주고받는다 (서버가 글자열을 거르기 때문. 맵 투표와 같다).
import { FLOORS } from './tower.mjs';

export const FIGHTERS = [
  { id: 'hero', name: '주인공 뿌요' },
  ...FLOORS.map(f => ({ id: f.char, name: f.boss, floor: f.floor })),
];
// 상대가 보낸 번호처럼 믿을 수 없는 값은 주인공(0)으로
export const cleanFighter = n => (Number.isInteger(n) && n >= 0 && n < FIGHTERS.length ? n : 0);
export const fighterIndex = id => Math.max(0, FIGHTERS.findIndex(f => f.id === id));

// 비밀의 층 주인은 AI 대전과 똑같이 그 층이 열려야 고를 수 있다 (코멧: 타워를 깨면, 노바: 혜성을 깨면)
export function fighterOpen(tower, n) {
  const f = FIGHTERS[n];
  if (!f) return false;
  if (f.floor === 7) return !!tower?.cleared;
  if (f.floor === 8) return !!tower?.comet;
  return true;
}
export const fighterHint = n => (FIGHTERS[n]?.floor === 8 ? '혜성을 깨면 열려' : '타워를 깨면 열려');
// 저장해 둔 캐릭터 이름 → 지금 고를 수 있는 번호 (잠겨 있거나 없는 이름이면 주인공)
export function pickFighter(tower, id) {
  const n = fighterIndex(id);
  return fighterOpen(tower, n) ? n : 0;
}
