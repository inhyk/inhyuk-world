// 맵마다 다른 규칙. 처음에는 2인 플레이에만 있었고, 인혁이 기획서 「뿌요뿌요 (업그레이드)」 4번으로
// AI 대전, 온라인 대전, 혼자 하기에서도 같은 맵(새로 만든 것 말고)을 고른다.
// 두 사람에게 같은 색 순서와 같은 규칙을 적용한다.
export const MAPS = [
  { id: 'garden', name: '뿌요 정원', emoji: '🌳', theme: 'meadow', colors: 4, minGroup: 4, gravityScale: 1, target: 70, tint: '#c8f2c0', desc: '4색 · 같은 색 4개 · 기본 속도', tip: '처음이라면 여기! 같은 색 4개를 붙여 봐.' },
  { id: 'ice', name: '느긋한 빙하', emoji: '🧊', theme: 'ice', colors: 4, minGroup: 4, gravityScale: .55, target: 70, tint: '#b5edff', desc: '4색 · 같은 색 4개 · 낙하 속도 55%', tip: '천천히 떨어져서 긴 연쇄를 준비하기 좋아.' },
  { id: 'volcano', name: '불꽃 화산', emoji: '🌋', theme: 'crater', colors: 4, minGroup: 4, gravityScale: 1.6, target: 70, tint: '#ffc7a1', desc: '4색 · 같은 색 4개 · 낙하 속도 160%', tip: '뜨거운 스피드 대결! 빠르게 자리를 골라.' },
  { id: 'rainbow', name: '무지개 섬', emoji: '🌈', theme: 'sky', colors: 5, minGroup: 4, gravityScale: 1, target: 70, tint: '#ffd3ec', desc: '5색 · 같은 색 4개 · 기본 속도', tip: '다섯 가지 색! 더 다양한 모양으로 연쇄를 만들어.' },
  { id: 'space', name: '별빛 우주', emoji: '🪐', theme: 'space', colors: 3, minGroup: 4, gravityScale: .8, target: 50, tint: '#d9c7ff', desc: '3색 · 같은 색 4개 · 50점마다 공격', tip: '색은 적고 공격은 강해! 낙하 속도는 기본의 80%야.' },
  { id: 'six', name: '쫀득 연구소', emoji: '🧪', theme: 'lab', colors: 4, minGroup: 6, gravityScale: .75, target: 70, tint: '#b8f4dd', desc: '4색 · 같은 색 6개 · 낙하 속도 75%', tip: '4개나 5개는 안 터져! 같은 색 6개 이상을 모아야 퐁!' },
];
export const getMap = id => MAPS.find(m => m.id === id) || MAPS[0];

// 맵 번호 (온라인에서는 맵 이름 대신 번호만 주고받는다. 서버가 글자열을 거르기 때문)
export const mapIndex = id => Math.max(0, MAPS.findIndex(m => m.id === id));
export const cleanMapIndex = n => (Number.isInteger(n) && n >= 0 && n < MAPS.length ? n : null);
// 온라인 맵 투표: 표를 더 많이 받은 맵에서 한다. 표가 같으면(두 사람이 서로 다른 맵) 그중에서 뽑는다.
// 돌려주는 값: { map: 맵 번호, tie: 뽑기로 정했는지 }
export function voteResult(votes, random = Math.random) {
  const counts = new Map();
  for (const v of votes) { const n = cleanMapIndex(v); if (n !== null) counts.set(n, (counts.get(n) || 0) + 1); }
  if (!counts.size) return { map: 0, tie: false };
  const best = Math.max(...counts.values());
  const top = [...counts.keys()].filter(n => counts.get(n) === best).sort((a, b) => a - b);
  if (top.length === 1) return { map: top[0], tie: false };
  const r = random();
  return { map: top[Math.min(top.length - 1, Math.floor(Math.max(0, Number.isFinite(r) ? r : 0) * top.length))], tie: true };
}
// 대전 화면 위에 적는 맵 설명
export const mapTitle = map => `${map.emoji} ${map.name}`;
export const mapRules = map => `${map.minGroup}개 연결 · ${map.colors}색`;
