// 곤충 채집 (인혁이 계획: "곤충을 채집할 수 있게 해줘."): the rules without three.js, so node can test them.
// The species, where and when each one lives, how wary it is, the net's reach, and the 도감 save format
// (state.bugs, saved with the rest of the game and the cloud save).

/**
 * habitats: where it spawns (flower 꽃, bush 덤불, tree 동네 나무 줄기, forest 숲 나무 줄기, grass 풀밭,
 * water 물가 (sea shore, fountain), ground 땅). weight per habitat. hours [from, to] (to < from wraps
 * past midnight). flee: metres at which it runs away when you walk / run near it. dodge: chance it
 * escapes a swing while moving fast. size: body length in metres as shown (about 1.5 times life size, so a kid
 * can see it). cap: at most this many alive at once near you.
 */
export const SPECIES = [
  { id: 'swallowtail', name: '호랑나비', emoji: '🦋', move: 'flutter', habitats: { flower: 3, bush: 0.8 }, hours: [8, 18], flee: [1.0, 4.5], dodge: 0.2, cap: 3, size: 0.045, color: 0xf2d36a,
    where: '🌸 꽃밭 · 낮', fact: '애벌레는 귤나무와 산초나무 잎을 먹고, 놀라면 주황색 뿔을 내밀어요.' },
  { id: 'cabbage', name: '배추흰나비', emoji: '🦋', move: 'flutter', habitats: { flower: 3, grass: 1.6 }, hours: [7, 18], flee: [0.9, 4], dodge: 0.2, cap: 4, size: 0.03, color: 0xf4f2ea,
    where: '🌸 꽃밭, 풀밭 · 낮', fact: '봄에 가장 먼저 보이는 나비예요. 애벌레는 배추와 양배추를 좋아해요.' },
  { id: 'dragonfly', name: '고추잠자리', emoji: '🌶️', move: 'dart', habitats: { water: 4, grass: 1.2 }, hours: [8, 18.5], flee: [1.6, 5], dodge: 0.75, cap: 4, size: 0.065, color: 0xd8301e,
    where: '💧 바닷가, 분수, 풀밭 · 낮', fact: '눈이 2만 개가 넘는 작은 눈으로 되어 있어서 뒤도 보여요. 아주 빨라서 잡기 어려워요!' },
  { id: 'ladybug', name: '무당벌레', emoji: '🐞', move: 'perch', habitats: { flower: 2, bush: 2 }, hours: [7, 18], flee: [0, 1.6], dodge: 0, cap: 3, size: 0.014, color: 0xd42a1c,
    where: '🌿 꽃과 덤불 잎 · 낮', fact: '진딧물을 하루에 수십 마리나 잡아먹는 농부의 친구예요. 점이 일곱 개면 칠성무당벌레!' },
  { id: 'grasshopper', name: '메뚜기', emoji: '🦗', move: 'hop', habitats: { grass: 3 }, hours: [7, 18], flee: [2.2, 4], dodge: 0.3, cap: 3, size: 0.05, color: 0x7aa83a,
    where: '🌾 풀밭 · 낮', fact: '뒷다리가 아주 튼튼해서 자기 몸의 스무 배나 멀리 뛰어요.' },
  { id: 'acrida', name: '방아깨비', emoji: '🦗', move: 'hop', habitats: { grass: 2 }, hours: [8, 18], flee: [1.8, 3.5], dodge: 0.25, cap: 2, size: 0.1, color: 0x8cbf4a,
    where: '🌾 풀밭 · 낮', fact: '뒷다리를 잡으면 방아를 찧듯이 몸을 끄덕끄덕해요. 우리나라 메뚜기 중 가장 길어요.' },
  { id: 'cicada', name: '매미', emoji: '🎵', move: 'trunk', habitats: { tree: 3, forest: 2 }, hours: [7, 19], flee: [2.0, 5], dodge: 0, cap: 3, size: 0.055, color: 0x3a4a2a, sings: true,
    where: '🌳 나무 줄기 · 낮', fact: '수컷만 "맴맴" 울어요. 땅속에서 몇 년이나 애벌레로 살다가 여름에 나와요.' },
  { id: 'beetle', name: '장수풍뎅이', emoji: '🪲', move: 'trunk', habitats: { forest: 1.4, tree: 0.25 }, hours: [18.5, 4.5], flee: [0, 0], dodge: 0, cap: 1, size: 0.085, color: 0x4a2414, rare: true,
    where: '🌲 숲 나무 줄기 · 저녁, 밤', fact: '수컷 머리의 큰 뿔로 나무 수액 자리를 두고 힘겨루기를 해요. 우리나라에서 가장 큰 풍뎅이예요.' },
  { id: 'stag', name: '사슴벌레', emoji: '🪲', move: 'trunk', habitats: { forest: 1.4, tree: 0.25 }, hours: [18.5, 4.5], flee: [0, 0], dodge: 0, cap: 1, size: 0.075, color: 0x1a1210, rare: true,
    where: '🌲 숲 나무 줄기 · 저녁, 밤', fact: '사슴뿔처럼 생긴 큰 턱은 사실 입이에요. 밤에 참나무 수액을 먹으러 나와요.' },
  { id: 'firefly', name: '반딧불이', emoji: '✨', move: 'glow', habitats: { forest: 3, water: 2, bush: 1.6, grass: 1 }, hours: [20, 3.5], flee: [0, 1.8], dodge: 0, cap: 10, size: 0.016, color: 0xd8ff6a,
    where: '🌙 숲, 물가, 덤불 · 밤', fact: '꽁무니에서 차가운 빛을 내서 깜빡깜빡 친구를 불러요. 맑은 물이 있는 곳에만 살아요.' },
  { id: 'ant', name: '개미', emoji: '🐜', move: 'crawl', habitats: { ground: 4, grass: 1 }, hours: [6, 19.5], flee: [0, 0], dodge: 0, cap: 6, size: 0.016, color: 0x1a1614,
    where: '🟫 땅 어디나 · 낮', fact: '자기 몸무게의 수십 배를 들 수 있고, 냄새 길을 따라 줄지어 다녀요.' },
  { id: 'mantis', name: '사마귀', emoji: '🦗', move: 'perch', habitats: { bush: 0.6, grass: 0.35 }, hours: [9, 17], flee: [0, 0], dodge: 0, cap: 1, size: 0.11, color: 0x86b04a, rare: true,
    where: '🌿 덤불, 풀밭 · 낮 (드물어요)', fact: '머리를 뒤까지 돌릴 수 있는 유일한 곤충이에요. 낫 같은 앞다리로 벌레를 잡아요.' },
  { id: 'jewel', name: '비단벌레', emoji: '💎', move: 'trunk', habitats: { forest: 0.35 }, hours: [10, 16], flee: [1.2, 4], dodge: 0, cap: 1, size: 0.05, color: 0x2ab06a, rare: true,
    where: '🌲 숲 나무 줄기 · 한낮 (아주 드물어요)', fact: '초록 무지개빛 날개가 보석 같아서, 옛날 신라 사람들은 말 안장을 꾸몄어요. 천연기념물이에요.' },
];
export const BY_ID = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
export const HABITATS = ['flower', 'bush', 'tree', 'forest', 'grass', 'water', 'ground'];

/** Net reach (metres from the eye) and how far off the aim line still counts. */
export const NET = { near: 0.25, reach: 2.9, slack: 0.42, widen: 0.17 };
/** Most insects alive around you at once. */
export const MAX_ALIVE = { high: 26, low: 16 };

/** Is the species out at this hour (0..24)? */
export function activeAt(sp, hour) {
  const h = ((hour % 24) + 24) % 24, [a, b] = sp.hours;
  return a <= b ? h >= a && h < b : h >= a || h < b;
}

/** Species that may appear in a habitat at an hour: [{id, w}] (w > 0). */
export function speciesFor(habitat, hour) {
  const out = [];
  for (const sp of SPECIES) {
    const w = sp.habitats[habitat] ?? 0;
    if (w > 0 && activeAt(sp, hour)) out.push({ id: sp.id, w });
  }
  return out;
}

/** Weighted pick from [{w, ...}] with r in [0, 1); null for an empty list. */
export function pickWeighted(list, r) {
  const total = list.reduce((s, e) => s + e.w, 0);
  if (!(total > 0)) return null;
  let t = r * total;
  for (const e of list) if ((t -= e.w) < 0) return e;
  return list[list.length - 1];
}

/** How close you can come before it flees (metres), from your speed in m/s. */
export function fleeRadius(sp, speed) {
  const [walk, run] = sp.flee;
  if (speed > 5.5) return run;
  if (speed > 1.2) return walk;
  return walk * 0.6; // creeping up slowly
}

/**
 * Is point p inside the net's sweep? eye and p are [x, y, z], dir is the unit aim direction.
 * Returns the distance along the aim, or -1.
 */
export function inNet(eye, dir, p, net = NET) {
  const dx = p[0] - eye[0], dy = p[1] - eye[1], dz = p[2] - eye[2];
  const along = dx * dir[0] + dy * dir[1] + dz * dir[2];
  if (along < net.near || along > net.reach) return -1;
  const off2 = dx * dx + dy * dy + dz * dz - along * along;
  const r = net.slack + net.widen * along;
  return off2 <= r * r ? along : -1;
}

/** Korean object particle: 을 after a final consonant, 를 after a vowel. */
export function eul(word) {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return '를';
  return (c - 0xac00) % 28 ? '을' : '를';
}
export const caughtText = (sp) => `${sp.emoji} ${sp.name}${eul(sp.name)} 잡았다!`;

// ------------------------------------------------------------------ 도감 save (state.bugs)
/** A clean 도감 from whatever was saved: {c: {id: count}, seen: {id: day first caught}, tip: 0..2}. */
export function normBook(raw) {
  const b = { c: {}, seen: {}, tip: 0 };
  if (!raw || typeof raw !== 'object') return b;
  for (const sp of SPECIES) {
    const n = Math.floor(Number(raw.c?.[sp.id]));
    if (n > 0) b.c[sp.id] = Math.min(n, 9999);
    const d = Math.floor(Number(raw.seen?.[sp.id]));
    if (d > 0 || b.c[sp.id]) b.seen[sp.id] = d > 0 ? d : 1;
  }
  const tip = Math.floor(Number(raw.tip));
  b.tip = tip > 0 ? Math.min(tip, 9) : 0;
  return b;
}

/** Add one catch; returns true when it is a new species for the 도감. */
export function addCatch(book, id, day = 1) {
  if (!BY_ID[id]) return false;
  const fresh = !book.seen[id];
  book.c[id] = Math.min(9999, (book.c[id] ?? 0) + 1);
  if (fresh) book.seen[id] = Math.max(1, Math.floor(day) || 1);
  return fresh;
}

/** Let one go (it stays in the 도감 as found); returns true if there was one. */
export function release(book, id) {
  if (!(book.c[id] > 0)) return false;
  book.c[id]--;
  if (!book.c[id]) delete book.c[id];
  return true;
}

/** {kinds found, total kept, all kinds}. */
export function bookStats(book) {
  return { kinds: SPECIES.filter((s) => book.seen[s.id]).length, kept: Object.values(book.c).reduce((s, n) => s + n, 0), all: SPECIES.length };
}
