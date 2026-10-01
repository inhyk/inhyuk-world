export const SAVE_KEY = 'pad-atelier-v1';
export const SKIP_COST = 100;
export const TIERS = Object.freeze([
  { name: '일반', english: 'CLASSIC', color: '#829792', chance: 70, price: 1000, cost: 0, power: 12, work: 120 },
  { name: '고급', english: 'FRESH', color: '#54ad88', chance: 50, price: 10000, cost: 10000, power: 22, work: 180 },
  { name: '에픽', english: 'EPIC', color: '#7397d6', chance: 30, price: 50000, cost: 50000, power: 40, work: 260 },
  { name: '레전더리', english: 'LEGENDARY', color: '#c79839', chance: 15, price: 1000000, cost: 500000, power: 75, work: 380 },
  { name: '매직', english: 'MAGIC', color: '#ae82c7', chance: 10, price: 5000000, cost: 1000000, power: 130, work: 520 },
  { name: '인피니티', english: 'INFINITY', color: '#46b8c0', chance: 5, price: 10000000, cost: 1000000, power: 230, work: 750 },
  { name: 'EX', english: 'EXCLUSIVE', color: '#df7c65', chance: 3, price: 100000000, cost: 10000000, power: 400, work: 1100 },
  { name: '크리스탈', english: 'CRYSTAL', color: '#91cbd7', chance: 2, price: 200000000, cost: 25000000, power: 650, work: 1500 },
  { name: '루비', english: 'RUBY', color: '#cc577a', chance: 1.5, price: 500000000, cost: 100000000, power: 950, work: 2100 },
  { name: '블리자드', english: 'BLIZZARD', color: '#70afe0', chance: 1, price: 1000000000, cost: 300000000, power: 1400, work: 2800 },
  { name: '드래곤', english: 'DRAGON', color: '#ed9051', chance: 0.7, price: 2500000000, cost: 1000000000, power: 2000, work: 4000 },
  { name: '코스믹', english: 'COSMIC', color: '#8e80dc', chance: 0.5, price: 6000000000, cost: 3000000000, power: 3000, work: 6000 },
  { name: '셀레스티얼', english: 'CELESTIAL', color: '#d8b663', chance: 0.3, price: 15000000000, cost: 10000000000, power: 4200, work: 8500 },
  { name: '네뷸라', english: 'NEBULA', color: '#c384d7', chance: 0.2, price: 40000000000, cost: 30000000000, power: 6000, work: 12000 },
  { name: '오메가', english: 'OMEGA', color: '#69bfb1', chance: 0.1, price: 100000000000, cost: 100000000000, power: 9000, work: 18000 },
  { name: '갤럭시', english: 'GALAXY', color: '#6477dc', chance: 0.07, price: 300000000000, cost: 250000000000, power: 13000, work: 26000 },
  { name: '레인보우', english: 'RAINBOW', color: '#e0719f', chance: 0.05, price: 1000000000000, cost: 800000000000, power: 19000, work: 38000 },
  { name: '블랙홀', english: 'BLACK HOLE', color: '#5a4b86', chance: 0.03, price: 3000000000000, cost: 2500000000000, power: 28000, work: 56000 },
  { name: '크로노스', english: 'CHRONOS', color: '#c9a444', chance: 0.02, price: 10000000000000, cost: 8000000000000, power: 42000, work: 84000 },
  { name: '유니버스', english: 'UNIVERSE', color: '#5fc6e6', chance: 0.01, price: 50000000000000, cost: 30000000000000, power: 65000, work: 130000 },
]);
export const MODELS = Object.freeze([
  { name: '기본', suffix: '', chance: 50, price: 1, work: 1, width: 1, depth: 1 },
  { name: '미니', suffix: ' 미니', chance: 40, price: 0.75, work: 0.8, width: 0.8, depth: 0.84 },
  { name: '프로', suffix: ' 프로', chance: 10, price: 1.6, work: 1.35, width: 1.08, depth: 1.12 },
]);
const PAD_NAMES = ['클래식', '포레스트', '스카이', '골든', '드림', '오로라', 'EX 시그니처', '크리스탈', '루비', '블리자드', '드래곤', '코스믹', '셀레스티얼', '네뷸라', '오메가', '갤럭시', '레인보우', '블랙홀', '크로노스', '유니버스'];
export const PADS = Object.freeze(TIERS.flatMap((tier, i) => MODELS.map((model, j) => ({
  id: i * MODELS.length + j, tier: i, model: j, name: `${PAD_NAMES[i]} 패드${model.suffix}`,
  price: Math.round(tier.price * model.price), work: Math.ceil(tier.work * model.work),
}))));
export const padFor = order => PADS[order.tier * MODELS.length + (order.model ?? 0)];
export const MAX_REBIRTH = 5;
export const REBIRTH_COSTS = Object.freeze([1000000, 5000000, 20000000, 100000000, 500000000]);
export const EGG_COST = 10000;
// Weights come from the handwritten design note; they are normalized when rolled.
export const PETS = Object.freeze([
  { name: '강아지', emoji: '🐶', luck: 1.5, weight: 70 },
  { name: '고양이', emoji: '🐱', luck: 2, weight: 50 },
  { name: '새', emoji: '🐦', luck: 3.5, weight: 30 },
  { name: '햄스터', emoji: '🐹', luck: 5, weight: 10 },
  { name: '코끼리', emoji: '🐘', luck: 10, weight: 1 },
  { name: '늑대', emoji: '🐺', luck: 50, weight: 0.5 },
  { name: '피카츄', emoji: '⚡', luck: 100, weight: 0.01 },
]);
export const PET_WEIGHT = PETS.reduce((sum, pet) => sum + pet.weight, 0);
export const HOUSES = Object.freeze([
  { name: '빨간색', color: '#d6574f' }, { name: '파란색', color: '#4a7fd4' }, { name: '노란색', color: '#e6bd3a' },
  { name: '초록색', color: '#55a562' }, { name: '보라색', color: '#9168c7' }, { name: '주황색', color: '#e8893a' },
]);
export const padsPerCraft = state => state.rebirth + 1;
export const luck = state => state.pet === null ? 1 : PETS[state.pet].luck;
export const CUSTOMERS = ['봄이', '우주', '하늘', '보리', '도담', '별이', '여름', '해솔'];
export const cleanNickname = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 10) : '';
export const money = value => `${Math.floor(value).toLocaleString('ko-KR')}원`;
export function initial() {
  return { version: 4, money: 0, earned: 0, sold: 0, skipped: 0, owned: [0], equipped: 0,
    order: { tier: 0, model: 0, customer: 0, progress: 0, special: false }, collection: Array(TIERS.length).fill(0),
    models: Array(PADS.length).fill(0), specialOrders: [], tutorial: false, sound: true, won: false, master: false,
    nickname: '', rebirth: 0, pets: Array(PETS.length).fill(0), pet: null, delivery: null, deliveries: 0 };
}
const integer = (value, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= 0 && value <= max;
export function restore(raw) {
  const fresh = initial();
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data || ![1, 2, 3, 4].includes(data.version)) return fresh;
    for (const key of ['money', 'earned', 'sold', 'skipped', 'deliveries']) if (integer(data[key])) fresh[key] = data[key];
    if (Array.isArray(data.owned)) fresh.owned = [...new Set([0, ...data.owned.filter(i => integer(i, TIERS.length - 1))])].sort((a, b) => a - b);
    if (fresh.owned.includes(data.equipped)) fresh.equipped = data.equipped;
    // Older saves had 7 or 15 tools; new grades are appended, so IDs stay the same.
    if (Array.isArray(data.collection) && [7, 15, TIERS.length].includes(data.collection.length)) {
      data.collection.forEach((v, i) => { fresh.collection[i] = integer(v) ? v : 0; });
    }
    if (data.version === 1) {
      // Old discoveries are the standard model; keep all seven original IDs.
      fresh.collection.forEach((v, i) => { fresh.models[i * MODELS.length] = v; });
    } else if (Array.isArray(data.models) && [15 * MODELS.length, PADS.length].includes(data.models.length)) {
      data.models.forEach((v, i) => { fresh.models[i] = integer(v) ? v : 0; });
    }
    // Purchase bonuses were removed. Do not restore queued guaranteed orders.
    if (data.order && integer(data.order.tier, TIERS.length - 1) && data.order.tier <= Math.max(...fresh.owned)) {
      const tier = data.order.tier;
      const model = integer(data.order.model, MODELS.length - 1) ? data.order.model : 0;
      fresh.order = { tier, model, customer: integer(data.order.customer, CUSTOMERS.length - 1) ? data.order.customer : 0,
        progress: integer(data.order.progress, padFor({ tier, model }).work) ? data.order.progress : 0, special: false };
      // Preserve work already started, but retire untouched guaranteed rewards.
      if (data.order.special === true && fresh.order.progress === 0) fresh.order = { ...fresh.order, tier: 0, model: 0 };
    }
    fresh.nickname = cleanNickname(data.nickname);
    if (integer(data.rebirth, MAX_REBIRTH)) fresh.rebirth = data.rebirth;
    if (Array.isArray(data.pets) && data.pets.length === PETS.length) fresh.pets = data.pets.map(v => integer(v) ? v : 0);
    if (integer(data.pet, PETS.length - 1) && fresh.pets[data.pet] > 0) fresh.pet = data.pet;
    const delivery = data.delivery;
    if (delivery && integer(delivery.house, HOUSES.length - 1) && integer(delivery.tier, TIERS.length - 1) && integer(delivery.model, MODELS.length - 1)) {
      fresh.delivery = { house: delivery.house, tier: delivery.tier, model: delivery.model };
    }
    for (const key of ['tutorial', 'sound', 'won', 'master']) if (typeof data[key] === 'boolean') fresh[key] = data[key];
    return fresh;
  } catch { return fresh; }
}
// Tier chances are weights (like the pet note): only unlocked grades are rolled,
// and the result is scaled to 100%.
// A pet's luck multiplies the weight of every rare grade (and the Pro model),
// then everything is scaled back to 100%, so luck never breaks the odds.
export function odds(equipped, boost = 1) {
  const weights = TIERS.map((tier, i) => i === 0 ? tier.chance : i <= equipped ? tier.chance * boost : 0);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map(weight => weight / total * 100);
}
export function modelOdds(boost = 1) {
  const weights = MODELS.map((model, i) => i === 2 ? model.chance * boost : model.chance);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map(weight => weight / total * 100);
}
export function rollTier(equipped, random = Math.random, boost = 1) {
  let roll = Math.max(0, Math.min(1 - Number.EPSILON, random())) * 100;
  const chances = odds(equipped, boost);
  for (let i = 0; i <= equipped; i++) { roll -= chances[i]; if (roll < 0) return i; }
  return equipped;
}
export function rollModel(random = Math.random, boost = 1) {
  let roll = Math.max(0, Math.min(1 - Number.EPSILON, random())) * 100;
  const chances = modelOdds(boost);
  for (let i = 0; i < MODELS.length; i++) { roll -= chances[i]; if (roll < 0) return i; }
  return MODELS.length - 1;
}
export function nextOrder(state, random = Math.random) {
  state.specialOrders = [];
  const tier = rollTier(state.equipped, random, luck(state)), model = rollModel(random, luck(state));
  state.order = { tier, model, customer: (state.order.customer + 1) % CUSTOMERS.length, progress: 0, special: false };
}
export function hit(state) {
  if (state.order.tier > state.equipped) return { ok: false, reason: '이 패드에는 더 높은 등급의 곡괭이가 필요해요.' };
  const required = padFor(state.order).work;
  if (state.order.progress >= required) return { ok: false, reason: '완성된 패드를 손님에게 판매해 주세요.' };
  state.order.progress = Math.min(required, state.order.progress + TIERS[state.equipped].power);
  return { ok: true, completed: state.order.progress === required };
}
export function sell(state, random = Math.random) {
  const tier = state.order.tier;
  const pad = padFor(state.order);
  if (state.order.progress < pad.work) return { ok: false, reason: '패드를 먼저 완성해 주세요.' };
  const count = padsPerCraft(state), price = pad.price * count;
  state.money += price; state.earned += price; state.sold += count; state.collection[tier] += count; state.models[pad.id] += count;
  nextOrder(state, random);
  return { ok: true, price, count, tier, pad: pad.id };
}
export function skip(state, random = Math.random) {
  if (state.money < SKIP_COST) return { ok: false, reason: '건너뛰려면 100원이 필요해요.' };
  state.money -= SKIP_COST; state.skipped++; nextOrder(state, random);
  return { ok: true };
}
export function buy(state, tier) {
  if (!integer(tier, TIERS.length - 1)) return { ok: false, reason: '없는 곡괭이예요.' };
  if (state.owned.includes(tier)) { state.equipped = tier; return { ok: true, equipped: true }; }
  if (state.money < TIERS[tier].cost) return { ok: false, reason: `${money(TIERS[tier].cost - state.money)} 더 모으면 살 수 있어요.` };
  state.money -= TIERS[tier].cost; state.owned.push(tier); state.owned.sort((a, b) => a - b); state.equipped = tier;
  const victory = tier === 6 && !state.won;
  const mastery = tier === TIERS.length - 1 && !state.master;
  if (victory) state.won = true;
  if (mastery) state.master = true;
  return { ok: true, victory, mastery };
}
// Rebirth trades money and tools for one more pad per finished craft.
export function rebirth(state, random = Math.random) {
  if (state.rebirth >= MAX_REBIRTH) return { ok: false, reason: '이미 최대 환생(5번)을 했어요.' };
  const cost = REBIRTH_COSTS[state.rebirth];
  if (state.money < cost) return { ok: false, reason: `${money(cost - state.money)} 더 모으면 환생할 수 있어요.` };
  state.rebirth++; state.money = 0; state.owned = [0]; state.equipped = 0; nextOrder(state, random);
  return { ok: true, rebirth: state.rebirth, count: padsPerCraft(state) };
}
export function rollPet(random = Math.random) {
  let roll = Math.max(0, Math.min(1 - Number.EPSILON, random())) * PET_WEIGHT;
  for (let i = 0; i < PETS.length; i++) { roll -= PETS[i].weight; if (roll < 0) return i; }
  return PETS.length - 1;
}
export function hatch(state, random = Math.random) {
  if (state.money < EGG_COST) return { ok: false, reason: `알을 사려면 ${money(EGG_COST - state.money)} 더 필요해요.` };
  const pet = rollPet(random);
  state.money -= EGG_COST; state.pets[pet]++;
  // A new pet only replaces the current buddy when it brings more luck.
  const equipped = state.pet === null || PETS[pet].luck > PETS[state.pet].luck;
  if (equipped) state.pet = pet;
  return { ok: true, pet, equipped, first: state.pets[pet] === 1 };
}
export function equipPet(state, pet) {
  if (!integer(pet, PETS.length - 1) || state.pets[pet] === 0) return { ok: false, reason: '아직 없는 펫이에요.' };
  state.pet = pet; return { ok: true };
}
// Naming the shop after a pet (e.g. "피카츄") starts the player with that pet.
export function nicknamePet(state) {
  const pet = PETS.findIndex(p => p.name === state.nickname.replace(/\s/g, ''));
  if (pet < 0) return null;
  if (state.pets[pet] === 0) state.pets[pet] = 1;
  state.pet = pet;
  return pet;
}
export function requestDelivery(state, random = Math.random) {
  if (state.delivery) return false;
  const tier = rollTier(state.equipped, random, luck(state)), model = rollModel(random, luck(state));
  state.delivery = { house: Math.min(HOUSES.length - 1, Math.floor(random() * HOUSES.length)), tier, model };
  return true;
}
// A delivery pays exactly the delivered pad's price.
export function deliver(state, house) {
  if (!state.delivery) return { ok: false, reason: '배달할 주문이 없어요.' };
  if (house !== state.delivery.house) return { ok: false, wrong: true, reason: `여기는 ${HOUSES[house].name} 지붕 집이에요.` };
  const pad = padFor(state.delivery);
  state.money += pad.price; state.earned += pad.price; state.deliveries++;
  state.collection[pad.tier]++; state.models[pad.id]++; state.delivery = null;
  return { ok: true, price: pad.price, pad: pad.id };
}
