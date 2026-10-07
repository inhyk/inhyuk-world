// 펫 (인혁이 기획서 「뿌요뿌요 (업그레이드)」 1번과 그림).
// 알에서 펫을 뽑고, 데리고 다니는 펫만큼 판에서 받는 경험치가 몇 배가 된다.
// 그림에 적힌 숫자: 강아지 1.5배 70%, 고양이 50% 3.0배, 키캡 5.0배 10%, 큰 키캡 10.0배 1%, ??? 100.0배 0.1%.
// 다 더하면 131.1 이라서 100% 가 넘는다. 화면에는 적힌 숫자를 그대로 보여 주고,
// 뽑을 때는 그 숫자의 비율로 뽑는다 (강아지는 131.1번 가운데 70번꼴).
export const PET_PRICE = 1000;
export const PETS = [
  { id: 'dog', name: '강아지', mult: 1.5, chance: 70 },
  { id: 'cat', name: '고양이', mult: 3, chance: 50 },
  { id: 'keycap', name: '키캡', mult: 5, chance: 10 },
  { id: 'bigkeycap', name: '큰 키캡', mult: 10, chance: 1 },
  // 뽑기 전에는 이름이 ??? 이고, 뽑으면 진짜 이름이 보인다
  { id: 'mystery', name: '???', mult: 100, chance: 0.1, secret: '무지개 드래곤' },
];
export const PET_IDS = PETS.map(p => p.id);
export const findPet = id => PETS.find(p => p.id === id) || null;

// 0.1 단위 숫자를 정수로 바꿔서 센다 (700, 500, 100, 10, 1 → 모두 1311)
const WEIGHTS = PETS.map(p => Math.round(p.chance * 10));
export const WEIGHT_TOTAL = WEIGHTS.reduce((a, b) => a + b, 0);
// 진짜로 나올 확률 (0~1)
export const petOdds = id => WEIGHTS[PET_IDS.indexOf(id)] / WEIGHT_TOTAL || 0;
export const chanceTotal = () => WEIGHT_TOTAL / 10;

export const multText = mult => `${Number(mult).toFixed(1)}배`;
export const chanceText = chance => `${chance}%`;
// 가진 펫은 진짜 이름, 아직 없는 비밀 펫은 ???
export const petName = (pet, owned = true) => (pet.secret && owned ? pet.secret : pet.name);

export function rollPet(random = Math.random) {
  const r = random();
  let n = Math.floor(Math.max(0, Math.min(0.999999999, Number.isFinite(r) ? r : 0)) * WEIGHT_TOTAL);
  for (let i = 0; i < PETS.length; i++) {
    if (n < WEIGHTS[i]) return PETS[i];
    n -= WEIGHTS[i];
  }
  return PETS[0];
}

export function emptyPets() { return { owned: {}, equip: '', draws: 0 }; }
export const ownedCount = (progress, id) => Math.max(0, Math.floor(Number(progress.pets?.owned?.[id]) || 0));
export const petKinds = progress => PET_IDS.filter(id => ownedCount(progress, id) > 0).length;

// 무엇으로 뽑을 수 있나: 'ticket'(펫 뽑기권) | 'coins'(코인 1000) | null
export function drawWith(progress) {
  if ((progress.tickets?.pet || 0) > 0) return 'ticket';
  return progress.coins >= PET_PRICE ? 'coins' : null;
}

// 알을 하나 깐다. 더 좋은(배수가 큰) 펫이 나오면 바로 데리고 다닌다.
export function drawPet(progress, random = Math.random) {
  const paid = drawWith(progress);
  if (!paid) return null;
  if (paid === 'ticket') progress.tickets.pet--;
  else progress.coins -= PET_PRICE;
  progress.pets ||= emptyPets();
  const pets = progress.pets, pet = rollPet(random);
  const isNew = !ownedCount(progress, pet.id);
  pets.owned[pet.id] = ownedCount(progress, pet.id) + 1;
  pets.draws = (pets.draws || 0) + 1;
  const current = equippedPet(progress);
  const equipped = !current || pet.mult > current.mult;
  if (equipped) pets.equip = pet.id;
  return { pet, isNew, count: pets.owned[pet.id], paid, equipped };
}

export function equipPet(progress, id) {
  if (!findPet(id) || !ownedCount(progress, id)) return false;
  progress.pets.equip = id;
  return true;
}
// 지금 데리고 다니는 펫 (가진 펫만)
export function equippedPet(progress) {
  const id = progress.pets?.equip;
  return id && ownedCount(progress, id) ? findPet(id) : null;
}
export const petMultiplier = progress => equippedPet(progress)?.mult ?? 1;

// 저장된 기록에서 읽을 때: 아는 펫만, 수는 0 이상, 데리고 다니는 펫은 가진 펫 중에서
export function sanitizePets(raw) {
  const out = emptyPets();
  for (const id of PET_IDS) {
    const n = Math.floor(Number(raw?.owned?.[id]));
    if (Number.isFinite(n) && n > 0) out.owned[id] = Math.min(n, 1e6);
  }
  const draws = Math.floor(Number(raw?.draws));
  out.draws = Number.isFinite(draws) && draws > 0 ? Math.min(draws, 1e9) : 0;
  if (out.owned[raw?.equip]) out.equip = raw.equip;
  else out.equip = PETS.filter(p => out.owned[p.id]).sort((a, b) => b.mult - a.mult)[0]?.id || '';
  return out;
}
