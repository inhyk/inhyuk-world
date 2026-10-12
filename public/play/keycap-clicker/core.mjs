const ORIGINAL = [
  { price: 10, income: 2, name: '밀크 키캡', subtitle: '첫 번째 작은 변화', color: '#f3e8d5', ink: '#705b48' },
  { price: 100, income: 4, name: '피치 키캡', subtitle: '말랑한 복숭아빛', color: '#f6bba5', ink: '#964c3a' },
  { price: 400, income: 8, name: '민트 키캡', subtitle: '손끝에 시원한 바람', color: '#a8d5bb', ink: '#2c6650' },
  { price: 1600, income: 16, name: '스카이 키캡', subtitle: '구름 위를 톡, 톡', color: '#a9cce6', ink: '#365f87' },
  { price: 4800, income: 32, name: '라벤더 키캡', subtitle: '보랏빛으로 물든 오후', color: '#c8b3e2', ink: '#66458e' },
  { price: 9600, income: 128, name: '체리 키캡', subtitle: '한층 깊어진 타건감', color: '#df8396', ink: '#822d46' },
  { price: 15480, income: 512, name: '미드나잇 키캡', subtitle: '조용한 밤의 멋진 소리', color: '#606d89', ink: '#ffffff' },
  { price: 30400, income: 2048, name: '오로라 키캡', subtitle: '손끝에서 피어나는 빛', color: '#91c9c7', ink: '#28535a' },
  { price: 100000, income: 2048, name: '골든 키캡', subtitle: '나만의 키캡, 완성!', color: '#eac76b', ink: '#77521c' },
];
export const COLLECTIONS = [
  { name: '오리지널', symbol: 'K', color: '#eac76b', ink: '#77521c', finish: 'classic' },
  { name: '디저트 카페', symbol: '♡', color: '#ecc4ac', ink: '#794d42', finish: 'candy' },
  { name: '비밀의 숲', symbol: '❀', color: '#a9cc94', ink: '#355c38', finish: 'leaf' },
  { name: '푸른 바다', symbol: '≈', color: '#9bd4df', ink: '#225773', finish: 'ocean' },
  { name: '보석 공방', symbol: '◇', color: '#c7b0e7', ink: '#5a3984', finish: 'gem' },
  { name: '네온 시티', symbol: 'ϟ', color: '#303c63', ink: '#99ffe0', finish: 'neon' },
  { name: '우주 여행', symbol: '✧', color: '#5b5487', ink: '#f1d8ff', finish: 'space' },
  { name: '판타지 왕국', symbol: '♜', color: '#d7b57c', ink: '#714421', finish: 'rune' },
  { name: '드래곤 전설', symbol: '♨', color: '#bc6379', ink: '#fff3c5', finish: 'dragon' },
  { name: '신화의 빛', symbol: '✦', color: '#f0d688', ink: '#77511c', finish: 'divine' },
];
const NAMES = [
  ['밀크', '피치', '민트', '스카이', '라벤더', '체리', '미드나잇', '오로라', '골든', '플래티넘'],
  ['바닐라 푸딩', '딸기 우유', '초코 브라우니', '레몬 타르트', '블루베리 머핀', '피스타치오', '솜사탕', '마카롱', '카라멜 라테', '무지개 케이크'],
  ['새싹', '네잎클로버', '이끼 정원', '대나무', '벚꽃', '은방울꽃', '단풍', '반딧불', '세계수', '숲의 정령'],
  ['조개껍데기', '산호초', '파도', '바다 유리', '진주', '해파리', '돌고래', '심해', '아틀란티스', '바다의 왕관'],
  ['로즈쿼츠', '토파즈', '아쿠아마린', '에메랄드', '사파이어', '루비', '자수정', '오팔', '다이아몬드', '별빛 크리스털'],
  ['픽셀', '아케이드', '사이버 민트', '네온 핑크', '홀로그램', '레이저', '전기 회로', '사이버펑크', '퀀텀', '네온 코어'],
  ['달빛', '별똥별', '혜성', '토성', '성운', '은하수', '블랙홀', '초신성', '안드로메다', '우주의 심장'],
  ['마법 두루마리', '요정 날개', '유니콘', '불사조', '얼음 성', '마법사 수정', '시간의 모래', '왕실 문장', '엑스칼리버', '전설의 왕관'],
  ['드래곤 알', '새끼 용', '비늘 갑옷', '화염 송곳니', '빙룡', '뇌룡', '흑룡', '황금 용', '고대 용왕', '무한의 드래곤'],
  ['천사의 깃털', '태양 조각', '운명의 별', '천상의 종', '차원의 문', '영원의 꽃', '창조의 빛', '우주 너머', '인피니티', '궁극의 키캡'],
];
const PALETTES = [
  ['#eee6d2','#f6bba5','#a8d5bb','#a9cce6','#c8b3e2','#df8396','#606d89','#91c9c7','#eac76b','#d8e3eb'],
  ['#f2dbac','#efb5c6','#b98d73','#ecdc82','#b9b0da','#c3d7a6','#f2c9e5','#cfb3e5','#cba47d','#f0bca3'],
  ['#bddd89','#98c7a2','#9eae82','#b4d397','#e7b4ca','#e3eac9','#d6a079','#b8cf85','#8bb9a7','#b9dfc2'],
  ['#eed6ca','#e8afa9','#91c9e2','#aadcd5','#e5dfee','#c4b6e7','#9ebedb','#5a7d9e','#92babd','#aecbdb'],
  ['#e6b6c9','#e4c77f','#a3d9db','#81bf9d','#92abd6','#da8f9e','#b9a0d6','#d5c2dc','#d8e6ee','#c2c6ee'],
  ['#344562','#493356','#294b51','#4a315a','#3c416e','#2e4a65','#2a4d4c','#45395d','#344e6e','#3a5861'],
  ['#6f7797','#7d729a','#79618c','#86758c','#6e6295','#62568a','#47405f','#8d667e','#5e5c91','#7466a3'],
  ['#dfc699','#d5b7d7','#e2c2df','#e2b48f','#c3dce6','#b7aed9','#dcc89d','#d9bc8a','#c7d0d8','#e4cd92'],
  ['#c79c97','#be959c','#a795ac','#cf8b78','#9cbcd7','#b6a0d5','#72677f','#d6b474','#be8e88','#d6ac96'],
  ['#e9dfb6','#efc98d','#dbcef0','#e2d7b0','#c3d8e4','#ecc8d9','#f0dc9f','#d7cbed','#d8e1c5','#f8df94'],
];
export const UPGRADES = NAMES.flatMap((names, chapter) => names.map((name, slot) => {
  const index = chapter * 10 + slot, level = index + 1;
  const original = ORIGINAL[index];
  const income = original?.income ?? Math.round(2500 * 1.18 ** (level - 10));
  const previousIncome = index === 0 ? 1 : index < 10 ? ORIGINAL[index - 1].income : Math.round(2500 * 1.18 ** (level - 11));
  // Price against the income BEFORE purchase, so income jumps cannot skip saving.
  const requiredPresses = index < 9 ? [50, 100, 200, 300, 350, 375, 385, 390, 391][index] : Math.ceil(391 + (index - 8) * 9 / 91);
  return {
    ...(original ?? {}),
    name: original?.name ?? (name.endsWith('키캡') ? name : `${name} 키캡`),
    price: previousIncome * requiredPresses,
    income, chapter, color: original?.color ?? PALETTES[chapter][slot],
    ink: original?.ink ?? COLLECTIONS[chapter].ink,
    symbol: index === 8 ? '✦' : chapter === 0 ? 'K' : COLLECTIONS[chapter].symbol,
    finish: COLLECTIONS[chapter].finish,
    edition: COLLECTIONS[chapter].name,
  };
}));
export const BASIC = { income: 1, name: '기본 키캡', color: '#d5d1c9', ink: '#68645e' };
export const BOOSTS = [
  { id: 'power', name: '손끝 파워', icon: '⚡', cost: 150, max: 5, description: '클릭 수입 +25%씩' },
  { id: 'luck', name: '행운 부적', icon: '🍀', cost: 180, max: 5, description: '크리티컬 확률 +2%씩' },
  { id: 'battery', name: '피버 배터리', icon: '🔥', cost: 200, max: 5, description: '피버 지속 시간 +1초씩' },
  { id: 'magnet', name: '황금 자석', icon: '🧲', cost: 160, max: 5, description: '보너스 코인 +2배씩' },
  { id: 'hammer', name: '보스 해머', icon: '🔨', cost: 220, max: 5, description: '보스 공격력 +1씩' },
  { id: 'core', name: '피버 코어', icon: '💎', cost: 240, max: 5, description: '피버 충전 클릭 -4회씩' },
];
export const freshState = () => ({ money: 0, level: 0, presses: 0, earned: 0, sound: true, equipped: 0,
  boosts: { power: 0, luck: 0, battery: 0, magnet: 0, hammer: 0, core: 0 },
  stats: { criticals: 0, coins: 0, fevers: 0, bosses: 0, bestCombo: 0 },
  missionStart: { taps: 0, criticals: 0, coins: 0 }, claimedAchievements: [] });
export function restoreState(raw) {
  if (!raw || typeof raw !== 'object') return freshState();
  const s = freshState();
  for (const k of ['money', 'presses', 'earned']) if (Number.isSafeInteger(raw[k]) && raw[k] >= 0) s[k] = raw[k];
  if (Number.isInteger(raw.level) && raw.level >= 0 && raw.level <= UPGRADES.length) s.level = raw.level;
  s.equipped = Number.isInteger(raw.equipped) && raw.equipped >= 0 && raw.equipped <= s.level ? raw.equipped : s.level;
  if (typeof raw.sound === 'boolean') s.sound = raw.sound;
  for (const b of BOOSTS) if (Number.isInteger(raw.boosts?.[b.id]) && raw.boosts[b.id] >= 0 && raw.boosts[b.id] <= b.max) s.boosts[b.id] = raw.boosts[b.id];
  for (const key of Object.keys(s.stats)) if (Number.isSafeInteger(raw.stats?.[key]) && raw.stats[key] >= 0) s.stats[key] = raw.stats[key];
  for (const key of Object.keys(s.missionStart)) {
    const total = key === 'taps' ? s.presses : s.stats[key];
    s.missionStart[key] = Number.isSafeInteger(raw.missionStart?.[key]) && raw.missionStart[key] >= 0 ? Math.min(total, raw.missionStart[key]) : total;
  }
  if (Array.isArray(raw.claimedAchievements)) s.claimedAchievements = [...new Set(raw.claimedAchievements.filter(id => typeof id === 'string' && /^a\d{1,2}$/.test(id)))].slice(0, 20);
  return s;
}
export const currentKey = s => s.level ? UPGRADES[s.level - 1] : BASIC;
export function boostEffects(s) {
  return { power: 1 + s.boosts.power * .25, criticalChance: .08 + s.boosts.luck * .02,
    feverDuration: 8000 + s.boosts.battery * 1000, coinMultiplier: 8 + s.boosts.magnet * 2,
    bossDamage: 1 + s.boosts.hammer, feverCharge: 50 - s.boosts.core * 4 };
}
export const clickIncome = s => Math.ceil(currentKey(s).income * boostEffects(s).power);
export function boostPrice(s, id) {
  const b = BOOSTS.find(b => b.id === id);
  return b && s.boosts[id] < b.max ? currentKey(s).income * b.cost * 2 ** s.boosts[id] : Infinity;
}
export function buyBoost(s, id) {
  const price = boostPrice(s, id);
  if (!Number.isFinite(price) || s.money < price) return false;
  s.money -= price; s.boosts[id]++; return true;
}
export const equippedKey = s => s.equipped ? UPGRADES[s.equipped - 1] : { ...BASIC, symbol: 'K', finish: 'classic', edition: '오리지널' };
export function equip(s, level) {
  if (!Number.isInteger(level) || level < 0 || level > s.level) return false;
  s.equipped = level; return true;
}
export function press(s, multiplier = 1) {
  const amount = clickIncome(s) * Math.max(1, Math.min(25, Number.isFinite(multiplier) ? multiplier : 1));
  s.money = Math.min(Number.MAX_SAFE_INTEGER, s.money + amount);
  s.earned = Math.min(Number.MAX_SAFE_INTEGER, s.earned + amount);
  s.presses = Math.min(Number.MAX_SAFE_INTEGER, s.presses + 1);
  return amount;
}
export function buy(s, index = s.level) {
  const next = UPGRADES[index];
  if (index !== s.level || !next || s.money < next.price) return false;
  s.money -= next.price; s.level++; s.equipped = s.level;
  return true;
}
