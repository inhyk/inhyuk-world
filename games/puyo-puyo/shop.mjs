// 상점: 뿌요 스킨과 터질 때 나오는 효과 (인혁이 기획서 9번)
export const SKINS = [
  { id: 'classic', name: '기본 젤리', price: 0, level: 1, desc: '말랑말랑 동그란 원조 젤리.' },
  { id: 'symbol', name: '모양 젤리', price: 200, level: 1, desc: '색마다 ♥ ◆ ● ★ ▲ 모양이 있어서 구별하기 쉬워요.' },
  { id: 'jelly', name: '말랑 젤리', price: 300, level: 2, desc: '속이 비치는 투명 젤리.' },
  { id: 'candy', name: '알사탕', price: 450, level: 3, desc: '빙글빙글 소용돌이 사탕.' },
  { id: 'cat', name: '고양이 젤리', price: 650, level: 4, desc: '뾰족 귀와 수염이 달린 냥젤리.' },
  { id: 'fruit', name: '과일 젤리', price: 850, level: 5, desc: '딸기·사과·블루베리·레몬·포도.' },
  { id: 'gem', name: '보석 젤리', price: 1100, level: 6, desc: '반짝이는 보석으로 깎았어요.' },
  { id: 'pixel', name: '픽셀 젤리', price: 1300, level: 7, desc: '옛날 게임기 같은 네모 젤리.' },
  { id: 'planet', name: '행성 젤리', price: 1700, level: 9, desc: '고리를 두른 작은 행성들.' },
  { id: 'neon', name: '네온 젤리', price: 2100, level: 11, desc: '어둠 속에서 빛나는 네온사인.' },
  { id: 'ghost', name: '유령 젤리', price: 2600, level: 13, desc: '흐물흐물 꼬리가 달린 유령.' },
  { id: 'bunny', name: '토끼 젤리', price: 700, level: 4, desc: '길쭉한 두 귀가 쫑긋!' },
  { id: 'bear', name: '곰돌이 젤리', price: 900, level: 5, desc: '동그란 귀와 작은 코의 곰돌이.' },
  { id: 'robot', name: '로봇 젤리', price: 1400, level: 7, desc: '안테나와 반짝이는 전자 눈.' },
  { id: 'donut', name: '도넛 젤리', price: 1600, level: 8, desc: '알록달록 토핑을 올린 도넛.' },
  { id: 'flower', name: '꽃송이 젤리', price: 1800, level: 9, desc: '다섯 가지 색으로 피어나는 꽃.' },
  { id: 'dragon', name: '꼬마 드래곤', price: 2400, level: 12, desc: '작은 뿔과 날개를 가진 용.' },
  { id: 'astronaut', name: '우주인 젤리', price: 3000, level: 15, desc: '동그란 헬멧을 쓰고 별로 출발!' },
  { id: 'aurora', name: '오로라 갑옷', price: -1, level: 1, desc: '초신성 층 노바를 이기면 받는 별빛 갑옷.', reward: 'nova' },
  { id: 'crown', name: '황금 왕관 젤리', price: -1, level: 1, desc: '타워 꼭대기를 깬 사람만 받는 왕관.', reward: 'tower' },
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
  { id: 'butterfly', name: '나비 정원', price: 900, level: 5, desc: '색색의 나비들이 날갯짓해요.' },
  { id: 'confetti', name: '축하 폭죽', price: 1300, level: 7, desc: '알록달록 종이 꽃가루가 펑!' },
  { id: 'flame', name: '드래곤 불꽃', price: 1800, level: 9, desc: '금빛 불씨가 뜨겁게 솟아올라요.' },
  { id: 'musicbox', name: '별빛 오르골', price: 2200, level: 11, desc: '별과 음표가 함께 춤을 춰요.' },
  { id: 'portal', name: '차원 문', price: 2700, level: 14, desc: '보라와 민트색 문이 열려요.' },
  { id: 'nova', name: '초신성 폭발', price: -1, level: 1, desc: '노바를 이기면 얻는 별빛 대폭발.', reward: 'nova' },
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

// 교환권은 코인/레벨 없이 원하는 판매 상품을 하나 고를 수 있다. 보스 전용 보상은 제외.
export function canRedeem(progress, kind, id) {
  const item = findItem(kind, id);
  return !!item && item.price > 0 && !progress.owned[kind].includes(id) && (progress.tickets?.[kind] || 0) > 0;
}
export function redeem(progress, kind, id) {
  if (!canRedeem(progress, kind, id)) return false;
  progress.tickets[kind]--;
  grant(progress, kind, id);
  equip(progress, kind, id);
  return true;
}
