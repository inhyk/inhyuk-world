// 상점: 뿌요 스킨과 터질 때 나오는 효과 (인혁이 기획서 9번)
export const SKINS = [
  { id: 'classic', name: '기본 뿌요', price: 0, level: 1, desc: '말랑말랑 동그란 원조 뿌요.' },
  { id: 'symbol', name: '모양 뿌요', price: 200, level: 1, desc: '색마다 ♥ ◆ ● ★ ▲ 모양이 있어서 구별하기 쉬워요.' },
  { id: 'jelly', name: '말랑 젤리', price: 300, level: 2, desc: '속이 비치는 투명 젤리.' },
  { id: 'candy', name: '알사탕', price: 450, level: 3, desc: '빙글빙글 소용돌이 사탕.' },
  { id: 'cat', name: '고양이 뿌요', price: 650, level: 4, desc: '뾰족 귀와 수염이 달린 냥뿌요.' },
  { id: 'fruit', name: '과일 뿌요', price: 850, level: 5, desc: '딸기·사과·블루베리·레몬·포도.' },
  { id: 'gem', name: '보석 뿌요', price: 1100, level: 6, desc: '반짝이는 보석으로 깎았어요.' },
  { id: 'pixel', name: '픽셀 뿌요', price: 1300, level: 7, desc: '옛날 게임기 같은 네모 뿌요.' },
  { id: 'planet', name: '행성 뿌요', price: 1700, level: 9, desc: '고리를 두른 작은 행성들.' },
  { id: 'neon', name: '네온 뿌요', price: 2100, level: 11, desc: '어둠 속에서 빛나는 네온사인.' },
  { id: 'ghost', name: '유령 뿌요', price: 2600, level: 13, desc: '흐물흐물 꼬리가 달린 유령.' },
  { id: 'crown', name: '황금 왕관 뿌요', price: -1, level: 1, desc: '타워 꼭대기를 깬 사람만 받는 왕관.', reward: 'tower' },
];

export const EFFECTS = [
  { id: 'sparkle', name: '기본 반짝', price: 0, level: 1, desc: '반짝반짝 작은 빛.' },
  { id: 'star', name: '별가루', price: 150, level: 1, desc: '별이 빙글빙글 튀어요.' },
  { id: 'heart', name: '하트', price: 250, level: 2, desc: '하트가 둥실둥실.' },
  { id: 'bubble', name: '비눗방울', price: 400, level: 3, desc: '방울이 떠올라 톡!' },
  { id: 'petal', name: '꽃잎', price: 600, level: 4, desc: '꽃잎이 살랑살랑.' },
  { id: 'note', name: '음표', price: 800, level: 5, desc: '연쇄할 때마다 음표가 춤춰요.' },
  { id: 'snow', name: '눈꽃', price: 1000, level: 6, desc: '차가운 눈꽃 결정.' },
  { id: 'pixel', name: '픽셀 폭발', price: 1200, level: 7, desc: '네모 조각이 와르르.' },
  { id: 'firework', name: '불꽃놀이', price: 1500, level: 8, desc: '펑! 하늘의 불꽃놀이.' },
  { id: 'lightning', name: '번개', price: 1900, level: 10, desc: '찌릿찌릿 번개가 쳐요.' },
  { id: 'rainbow', name: '무지개 링', price: 2300, level: 12, desc: '무지개 고리가 퍼져요.' },
  { id: 'blackhole', name: '블랙홀', price: 3000, level: 15, desc: '빨려 들어갔다가 펑!' },
  { id: 'comet', name: '혜성 꼬리', price: -1, level: 1, desc: '비밀의 혜성 층을 깨면 받아요.', reward: 'comet' },
];

export const itemList = kind => (kind === 'skin' ? SKINS : EFFECTS);
export const findItem = (kind, id) => itemList(kind).find(i => i.id === id);

// 살 수 있는지: 'owned' | 'reward' | 'level' | 'coins' | 'ok'
export function canBuy(progress, kind, id) {
  const item = findItem(kind, id);
  if (!item) return 'none';
  if (progress.owned[kind].includes(id)) return 'owned';
  if (item.price < 0) return 'reward';
  if (progress.level < item.level) return 'level';
  if (progress.coins < item.price) return 'coins';
  return 'ok';
}

export function buy(progress, kind, id) {
  const state = canBuy(progress, kind, id);
  if (state !== 'ok') return state;
  const item = findItem(kind, id);
  progress.coins -= item.price;
  progress.owned[kind].push(id);
  progress.equip[kind] = id;
  return 'bought';
}

export function equip(progress, kind, id) {
  if (!progress.owned[kind].includes(id)) return false;
  progress.equip[kind] = id;
  return true;
}

export function grant(progress, kind, id) {
  if (!progress.owned[kind].includes(id)) progress.owned[kind].push(id);
}
