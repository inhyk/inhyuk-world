// 모아몬 탐험대: 화면과 상관없는 게임 규칙 (몬스터 표, 잡기 확률, 키우기, 알, 할 일, 저장)
export const ELEMENTS = {
  leaf: { name: '풀', color: '#58c46a', icon: '🌿', fast: '잎날리기', charge: '꽃폭풍' },
  fire: { name: '불', color: '#ff7a3d', icon: '🔥', fast: '불꽃튀기기', charge: '불기둥' },
  water: { name: '물', color: '#3fa7ff', icon: '💧', fast: '물총', charge: '큰파도' },
  volt: { name: '번개', color: '#f6c21c', icon: '⚡', fast: '찌릿', charge: '벼락' },
  rock: { name: '돌', color: '#a58b6f', icon: '🪨', fast: '돌던지기', charge: '바위굴리기' },
  wind: { name: '바람', color: '#7fd6d0', icon: '🍃', fast: '바람가르기', charge: '회오리' },
  moon: { name: '달', color: '#9a7bff', icon: '🌙', fast: '달빛', charge: '별똥별' },
};
const STRONG = { leaf: ['water', 'rock'], fire: ['leaf', 'moon'], water: ['fire', 'rock'], volt: ['water', 'wind'], rock: ['fire', 'volt'], wind: ['leaf', 'rock'], moon: ['volt', 'water'] };
export function effect(att, def) {
  if (STRONG[att].includes(def)) return 1.6;
  if (STRONG[def].includes(att)) return 0.625;
  return 1;
}

// [id, 이름, 속성, 희귀도 1~5, 공격, 방어, 체력, 진화 대상, 필요 사탕, 사는 곳, 설명]
const ROWS = [
  ['ipsae', '잎새', 'leaf', 1, 92, 90, 110, 'ipsagwi', 12, 'park forest', '머리의 새싹이 햇빛을 받으면 기분이 좋아져 통통 뛴다.'],
  ['ipsagwi', '잎사귀', 'leaf', 3, 140, 132, 150, 'supimgeum', 30, 'forest', '등에 난 잎으로 바람을 일으켜 낙엽 놀이를 한다.'],
  ['supimgeum', '숲임금', 'leaf', 4, 198, 190, 200, null, 0, 'forest', '숲에서 가장 큰 나무 아래에 산다. 걸어간 자리마다 꽃이 핀다.'],
  ['bulssi', '불씨', 'fire', 1, 104, 80, 96, 'bulkkori', 12, 'house shop', '꼬리의 불꽃은 따뜻하기만 하고 뜨겁지 않다. 추운 날 인기가 많다.'],
  ['bulkkori', '불꼬리', 'fire', 3, 158, 118, 136, 'hwareureuk', 30, 'house', '신이 나면 꼬리 불꽃이 두 배로 커진다.'],
  ['hwareureuk', '화르륵', 'fire', 4, 222, 168, 180, null, 0, 'house', '갈기가 불꽃으로 되어 있어 밤길을 환하게 밝혀 준다.'],
  ['mulbang', '물방', 'water', 1, 88, 100, 112, 'mulbora', 12, 'lake park', '온몸이 말랑한 물방울이다. 비 오는 날 웅덩이에서 자주 보인다.'],
  ['mulbora', '물보라', 'water', 3, 134, 150, 156, 'padowang', 30, 'lake', '지느러미로 물을 튕기며 장난치는 것을 좋아한다.'],
  ['padowang', '파도왕', 'water', 4, 190, 208, 210, null, 0, 'lake', '호수 한가운데서 큰 파도를 만든다. 성격은 아주 느긋하다.'],
  ['jjirityang', '찌릿양', 'volt', 2, 112, 84, 104, 'cheondungyang', 20, 'shop plaza', '솜털에 전기를 모은다. 쓰다듬으면 머리카락이 선다.'],
  ['cheondungyang', '천둥양', 'volt', 4, 204, 150, 170, null, 0, 'shop', '뿔에서 번개가 번쩍인다. 천둥 치는 날 무리 지어 달린다.'],
  ['joyak', '조약', 'rock', 1, 84, 118, 100, 'bawidol', 12, 'plaza house', '길가의 조약돌인 줄 알고 지나치기 쉽다. 가만히 있는 것을 잘한다.'],
  ['bawidol', '바위돌', 'rock', 3, 132, 176, 150, 'sandeongi', 30, 'plaza', '몸에 박힌 수정이 햇빛에 반짝인다.'],
  ['sandeongi', '산덩이', 'rock', 4, 180, 240, 200, null, 0, 'plaza', '등에 작은 풀밭이 자란다. 낮잠을 자면 언덕처럼 보인다.'],
  ['sandeul', '산들', 'wind', 1, 96, 82, 94, 'hoeori', 15, 'park plaza', '귀를 날개처럼 펄럭여 낮게 떠다닌다.'],
  ['hoeori', '회오리', 'wind', 3, 168, 132, 150, null, 0, 'park', '빙글빙글 돌며 하늘 높이 올라간다. 연날리기 친구.'],
  ['byeolbam', '별밤', 'moon', 2, 100, 96, 104, 'daltokki', 20, 'night', '밤에만 나온다. 귀 끝의 별이 어두운 길을 비춘다.'],
  ['daltokki', '달토끼', 'moon', 4, 186, 170, 176, null, 0, 'night', '보름달이 뜬 밤이면 높이 뛰어올라 달을 만지려 한다.'],
  ['beoseosi', '버섯이', 'leaf', 1, 80, 104, 108, 'beoseotwang', 15, 'forest park', '비 온 뒤에 쑥쑥 자란다. 머리 갓을 건드리면 부끄러워한다.'],
  ['beoseotwang', '버섯왕', 'leaf', 3, 142, 170, 172, null, 0, 'forest', '커다란 갓 아래에 작은 친구들이 비를 피하러 온다.'],
  ['sutdeong', '숯덩이', 'fire', 2, 110, 110, 98, 'yongamdung', 20, 'plaza shop', '몸속에서 불씨가 깜빡인다. 군고구마 냄새가 난다.'],
  ['yongamdung', '용암둥이', 'fire', 4, 196, 190, 164, null, 0, 'plaza', '몸의 금 사이로 빛이 흐른다. 화나면 김이 폴폴 난다.'],
  ['gaegul', '개굴', 'water', 1, 94, 88, 102, 'yeonmotjang', 15, 'lake park', '연잎 위에서 노래 연습을 한다. 음은 잘 못 맞춘다.'],
  ['yeonmotjang', '연못장군', 'water', 3, 160, 150, 170, null, 0, 'lake', '연잎 방패를 들고 연못을 지킨다.'],
  ['kkomagureum', '꼬마구름', 'wind', 2, 90, 100, 110, 'meokgureum', 20, 'park lake', '하늘에서 내려온 작은 구름. 기분에 따라 색이 바뀐다.'],
  ['meokgureum', '먹구름', 'wind', 4, 178, 174, 196, null, 0, 'lake', '심술이 나면 작은 비를 내린다. 금방 풀린다.'],
  ['bandi', '반디', 'volt', 1, 98, 78, 90, 'deungbul', 15, 'forest night', '꼬리 불빛으로 친구와 이야기한다.'],
  ['deungbul', '등불나비', 'volt', 3, 172, 128, 146, null, 0, 'forest', '날개 가루가 밤하늘에 반짝이는 길을 만든다.'],
  ['somteol', '솜털', 'wind', 1, 76, 86, 120, null, 0, 'park house plaza', '바람이 불면 어디든 굴러간다. 어디에나 있다.'],
  ['kkomul', '꼬물', 'leaf', 1, 70, 84, 96, 'napul', 10, 'park forest house', '하루 종일 잎을 먹는다. 금방 자란다.'],
  ['napul', '나풀', 'leaf', 3, 156, 126, 148, null, 0, 'park', '무지갯빛 날개로 꽃밭을 날아다닌다.'],
  ['haenimi', '해님이', 'fire', 5, 250, 210, 220, null, 0, 'legend', '맑은 한낮에 아주 드물게 나타난다. 주변이 봄처럼 따뜻해진다.'],
  ['dalnimi', '달님이', 'moon', 5, 232, 236, 220, null, 0, 'legend night', '깊은 밤에 아주 드물게 나타난다. 조용히 사람들의 꿈을 지킨다.'],
  ['mujigaeyong', '무지개용', 'wind', 5, 262, 220, 232, null, 0, 'legend', '비가 갠 뒤 하늘을 가로지른다. 본 사람은 하루 종일 운이 좋다.'],
];
export const SPECIES = ROWS.map(([id, name, el, rare, atk, def, hp, to, need, where, text], no) => ({ id, name, el, rare, atk, def, hp, to, need, where: where.split(' '), text, no: no + 1 }));
const BY_ID = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
export const species = (id) => BY_ID[id];
// 진화 가족: 사탕은 가족끼리 같이 쓴다
const FAMILY = {};
for (const s of SPECIES) if (!SPECIES.some((o) => o.to === s.id)) { let c = s; while (c) { FAMILY[c.id] = s.id; c = BY_ID[c.to]; } }
export const familyOf = (id) => FAMILY[id];
// 받침에 맞는 조사: josa('나풀', '으로', '로')
export function josa(word, withBatchim, without) { const c = word.charCodeAt(word.length - 1) - 0xac00; if (c < 0 || c > 11171) return word + without; const b = c % 28; if (withBatchim === '으로') return word + (b === 0 || b === 8 ? '로' : '으로'); return word + (b ? withBatchim : without); }
export const STARTERS = ['ipsae', 'bulssi', 'mulbang'];

export const ITEMS = {
  ball: { name: '방울', icon: '🫧', text: '몬스터를 담는 기본 방울', price: [10, 60] },
  ball2: { name: '큰방울', icon: '🔮', text: '더 잘 잡히는 방울', price: [10, 150], lv: 5 },
  ball3: { name: '별방울', icon: '🌟', text: '가장 잘 잡히는 방울', price: [5, 200], lv: 10 },
  berry: { name: '달콤열매', icon: '🍓', text: '먹이면 더 잘 잡힌다', price: [5, 60] },
  gberry: { name: '황금열매', icon: '🍍', text: '먹이고 잡으면 사탕이 2배', price: [3, 90], lv: 4 },
  incense: { name: '향기풍선', icon: '🎈', text: '5분 동안 몬스터가 많이 모인다', price: [1, 80] },
  egg: { name: '알', icon: '🥚', text: '걸으면 깨어난다 (최대 6개)', price: [1, 120] },
};
export const BALL_POWER = { ball: 1, ball2: 1.6, ball3: 2.3 };
export const MAX_EGGS = 6;
export const MAX_MONS = 300;

// --- 난수 (씨앗이 같으면 결과가 같다) ---
export function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function hash2(a, b, c = 0) { let h = (a * 374761393 + b * 668265263 + c * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; }

// --- 몬스터 한 마리 ---
const cpm = (lv) => 0.094 + 0.746 * Math.sqrt((lv - 1) / 39);
let uidN = 0;
export function makeMon(id, lv, rand = Math.random, opt = {}) {
  const iv = opt.iv || [0, 1, 2].map(() => Math.floor(rand() * 16));
  return { uid: Date.now().toString(36) + (uidN++).toString(36) + Math.floor(rand() * 1e6).toString(36), sp: id, lv: Math.max(1, Math.min(40, Math.round(lv))), iv, shiny: opt.shiny ?? rand() < 1 / 40, fav: false, t: opt.t ?? Date.now() };
}
export function stats(m) {
  const s = BY_ID[m.sp], k = cpm(m.lv);
  return { atk: (s.atk + m.iv[0]) * k, def: (s.def + m.iv[1]) * k, hp: Math.max(10, Math.floor((s.hp + m.iv[2]) * k)) };
}
export function power(m) { const s = BY_ID[m.sp], k = cpm(m.lv); return Math.max(10, Math.floor(((s.atk + m.iv[0]) * Math.sqrt(s.def + m.iv[1]) * Math.sqrt(s.hp + m.iv[2]) * k * k) / 10)); }
export const stars = (m) => { const t = m.iv[0] + m.iv[1] + m.iv[2]; return t >= 40 ? 3 : t >= 30 ? 2 : t >= 18 ? 1 : 0; };

// --- 잡기 ---
const CATCH_BASE = [0, 0.5, 0.4, 0.28, 0.18, 0.06];
const FLEE = [0, 0.08, 0.1, 0.12, 0.15, 0.2];
// throwBonus: 0 보통, 1 좋아요, 2 멋져요, 3 완벽해요
export function catchChance(m, ball, berry, throwBonus) {
  const base = CATCH_BASE[BY_ID[m.sp].rare] * (1 - m.lv / 90);
  const mult = BALL_POWER[ball] * (berry === 'berry' ? 1.6 : 1) * [1, 1.2, 1.5, 1.9][throwBonus];
  return Math.min(1, 1 - Math.pow(1 - base, mult));
}
export const fleeChance = (m) => FLEE[BY_ID[m.sp].rare];
export const ringColor = (p) => (p > 0.6 ? '#4be06a' : p > 0.4 ? '#ffe04b' : p > 0.22 ? '#ff9a3d' : '#ff4b4b');

// --- 경험치와 레벨 ---
export const MAX_LEVEL = 50;
export const xpNeed = (lv) => 800 * lv + 200 * lv * lv;
export function addXp(save, n) {
  save.xp += Math.round(n);
  const ups = [];
  while (save.lv < MAX_LEVEL && save.xp >= xpNeed(save.lv)) {
    save.xp -= xpNeed(save.lv); save.lv++;
    const gift = { ball: 10 + (save.lv >= 5 ? 0 : 5), berry: 3 };
    if (save.lv >= 5) gift.ball2 = 5;
    if (save.lv >= 10) gift.ball3 = 3;
    if (save.lv % 3 === 0) gift.incense = 1;
    if (save.lv % 4 === 0) gift.gberry = 2;
    give(save, gift); save.coins += 30;
    ups.push({ lv: save.lv, gift, coins: 30 });
  }
  return ups;
}
export function give(save, items) { for (const k in items) { if (k === 'egg') { for (let i = 0; i < items[k]; i++) addEgg(save); } else save.items[k] = (save.items[k] || 0) + items[k]; } }

// 잡았을 때: 몬스터를 넣고 보상을 계산한다
export function onCaught(save, m, throwBonus, usedGold, firstTry) {
  const s = BY_ID[m.sp], fam = FAMILY[m.sp];
  const isNew = !save.dex[m.sp]?.caught;
  save.dex[m.sp] = { seen: 1, caught: (save.dex[m.sp]?.caught || 0) + 1, shiny: save.dex[m.sp]?.shiny || m.shiny ? 1 : 0 };
  save.mons.push(m);
  const candy = (3 + (s.rare >= 3 ? 2 : 0)) * (usedGold ? 2 : 1);
  const dust = 100 + s.rare * 25;
  const lines = [['잡았다!', 100]];
  if (throwBonus) lines.push([['', '좋아요!', '멋져요!', '완벽해요!'][throwBonus], [0, 20, 50, 100][throwBonus]]);
  if (firstTry) lines.push(['한 번에 성공', 50]);
  if (isNew) lines.push(['새로운 친구', 500]);
  if (m.shiny) lines.push(['반짝이', 300]);
  const xp = lines.reduce((a, l) => a + l[1], 0);
  save.candy[fam] = (save.candy[fam] || 0) + candy; save.dust += dust; save.stats.caught++;
  if (m.shiny) save.stats.shiny = (save.stats.shiny || 0) + 1;
  const ups = addXp(save, xp);
  return { isNew, candy, dust, xp, lines, ups, fam };
}

// --- 키우기 ---
export const maxMonLevel = (save) => Math.min(40, save.lv + 2);
export function powerUpCost(m) { return { dust: 200 + 100 * Math.floor(m.lv / 3), candy: 1 + Math.floor(m.lv / 12) }; }
export function powerUp(save, m) {
  const c = powerUpCost(m), fam = FAMILY[m.sp];
  if (m.lv >= maxMonLevel(save)) return '탐험가 레벨을 올리면 더 키울 수 있어';
  if (save.dust < c.dust) return '별가루가 모자라';
  if ((save.candy[fam] || 0) < c.candy) return '사탕이 모자라';
  save.dust -= c.dust; save.candy[fam] -= c.candy; m.lv++; return null;
}
export function evolve(save, m) {
  const s = BY_ID[m.sp], fam = FAMILY[m.sp];
  if (!s.to) return '더 진화할 수 없어';
  if ((save.candy[fam] || 0) < s.need) return '사탕이 모자라';
  save.candy[fam] -= s.need; m.sp = s.to;
  const isNew = !save.dex[m.sp]?.caught;
  save.dex[m.sp] = { seen: 1, caught: (save.dex[m.sp]?.caught || 0) + 1, shiny: save.dex[m.sp]?.shiny || m.shiny ? 1 : 0 };
  save.stats.evolved = (save.stats.evolved || 0) + 1;
  return { isNew, ups: addXp(save, isNew ? 1000 : 500) };
}
export function release(save, m) {
  if (m.fav) return '즐겨찾기한 친구는 보낼 수 없어';
  if (save.mons.length <= 1) return '마지막 친구는 보낼 수 없어';
  const i = save.mons.indexOf(m); if (i < 0) return '없는 친구야';
  save.mons.splice(i, 1); const fam = FAMILY[m.sp];
  save.candy[fam] = (save.candy[fam] || 0) + 1;
  if (save.buddy === m.uid) save.buddy = null;
  save.team = save.team.filter((u) => u !== m.uid);
  return null;
}

// --- 나타나는 몬스터 고르기 ---
export const WEATHERS = { sunny: { name: '맑음', icon: '☀️', boost: ['fire', 'leaf'] }, rain: { name: '비', icon: '🌧️', boost: ['water', 'volt'] }, windy: { name: '바람', icon: '💨', boost: ['wind', 'rock'] }, cloudy: { name: '흐림', icon: '☁️', boost: ['rock', 'moon'] } };
export function weatherAt(ms) { const d = new Date(ms); const slot = Math.floor(d.getHours() / 3); const r = hash2(d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate(), slot, 7) % 100; return r < 45 ? 'sunny' : r < 65 ? 'cloudy' : r < 83 ? 'windy' : 'rain'; }
export const isNight = (ms) => { const h = new Date(ms).getHours(); return h >= 19 || h < 6; };
const RARE_W = [0, 100, 45, 9, 2.2, 0.12];
export function pickSpawn(biome, night, weather, lv, rand = Math.random) {
  let total = 0; const list = [];
  for (const s of SPECIES) {
    if (s.where.includes('night') && !night && !s.where.includes(biome)) continue;
    if (s.rare === 5 && (lv < 5 || (s.id === 'haenimi' && (night || weather !== 'sunny')) || (s.id === 'dalnimi' && !night) || (s.id === 'mujigaeyong' && weather !== 'rain' && weather !== 'windy'))) continue;
    let w = RARE_W[s.rare];
    if (s.where.includes(biome)) w *= 5; else if (s.rare < 5) w *= 0.6;
    if (night && s.where.includes('night')) w *= 6;
    if (WEATHERS[weather].boost.includes(s.el)) w *= 1.5;
    total += w; list.push([s, w]);
  }
  let r = rand() * total; let pick = list[0][0];
  for (const [s, w] of list) { r -= w; if (r <= 0) { pick = s; break; } }
  const top = Math.min(30, lv + 4) + (WEATHERS[weather].boost.includes(pick.el) ? 3 : 0);
  return makeMon(pick.id, 1 + Math.floor(rand() * top), rand);
}

// --- 샘(보급소)에서 나오는 것 ---
export const STOP_COOLDOWN = 90e3;
export function spinLoot(save, rand = Math.random) {
  const out = {}; const n = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const r = rand();
    const k = r < 0.5 ? 'ball' : r < 0.7 ? 'berry' : r < 0.82 && save.lv >= 5 ? 'ball2' : r < 0.88 && save.lv >= 10 ? 'ball3' : r < 0.93 && save.lv >= 4 ? 'gberry' : r < 0.96 ? 'incense' : 'ball';
    out[k] = (out[k] || 0) + 1;
  }
  if (save.eggs.length < MAX_EGGS && rand() < 0.3) out.egg = 1;
  give(save, out); save.stats.spins++;
  return { loot: out, xp: 50, ups: addXp(save, 50) };
}

// --- 알 ---
const EGG_TIERS = [{ m: 250 }, { m: 600 }, { m: 1200 }];
export function addEgg(save, rand = Math.random) {
  if (save.eggs.length >= MAX_EGGS) return false;
  const r = rand(); const tier = r < 0.55 ? 0 : r < 0.88 ? 1 : 2;
  save.eggs.push({ tier, need: EGG_TIERS[tier].m, walked: 0 }); return true;
}
export function walk(save, meters, rand = Math.random) {
  save.dist += meters; const hatched = [];
  for (const e of save.eggs) e.walked += meters;
  for (let i = save.eggs.length - 1; i >= 0; i--) {
    const e = save.eggs[i];
    if (e.walked >= e.need && save.mons.length < MAX_MONS) {
      save.eggs.splice(i, 1);
      // 동글 알은 흔한 아기, 줄무늬 알은 조금 드문 아기, 별무늬 알은 드문 아기나 한 번 진화한 친구
      const base = (x) => FAMILY[x.id] === x.id;
      const pool = SPECIES.filter((x) => (e.tier === 0 ? base(x) && x.rare === 1 : e.tier === 1 ? base(x) && x.rare <= 2 : (base(x) && x.rare === 2) || x.rare === 3));
      const s = pool[Math.floor(rand() * pool.length)];
      const m = makeMon(s.id, Math.min(20, save.lv + 1), rand, { iv: [0, 1, 2].map(() => 8 + Math.floor(rand() * 8)), shiny: rand() < 1 / 20 });
      const isNew = !save.dex[m.sp]?.caught;
      save.dex[m.sp] = { seen: 1, caught: (save.dex[m.sp]?.caught || 0) + 1, shiny: save.dex[m.sp]?.shiny || m.shiny ? 1 : 0 };
      save.mons.push(m); const fam = FAMILY[m.sp]; const candy = 8 + e.tier * 6;
      save.candy[fam] = (save.candy[fam] || 0) + candy; save.dust += 300 + e.tier * 300; save.stats.hatched = (save.stats.hatched || 0) + 1;
      hatched.push({ mon: m, candy, dust: 300 + e.tier * 300, isNew, ups: addXp(save, 300 + e.tier * 200) });
    }
  }
  // 단짝과 걸으면 사탕
  if (save.buddy) {
    save.buddyWalk = (save.buddyWalk || 0) + meters;
    if (save.buddyWalk >= 300) { save.buddyWalk -= 300; const b = save.mons.find((m) => m.uid === save.buddy); if (b) { const fam = FAMILY[b.sp]; save.candy[fam] = (save.candy[fam] || 0) + 1; hatched.buddyCandy = b; } }
  }
  return hatched;
}

// --- 오늘의 할 일 ---
const QUEST_POOL = [
  { t: 'catch', need: [5, 8, 12], text: (q) => `몬스터 ${q.need}마리 잡기` },
  { t: 'el', need: [3, 4], text: (q) => `${ELEMENTS[q.arg].name} 속성 ${q.need}마리 잡기` },
  { t: 'spin', need: [3, 5], text: (q) => `별샘 ${q.need}번 돌리기` },
  { t: 'walk', need: [300, 600], text: (q) => `${q.need}m 걷기` },
  { t: 'nice', need: [3, 5], text: (q) => `좋아요 이상으로 ${q.need}번 맞히기` },
  { t: 'win', need: [1, 2], text: (q) => `도장에서 ${q.need}번 이기기` },
  { t: 'up', need: [3, 5], text: (q) => `몬스터 ${q.need}번 강하게 하기` },
];
export const questText = (q) => QUEST_POOL.find((p) => p.t === q.t).text(q);
export const dayKey = (ms) => { const d = new Date(ms); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
export function ensureQuests(save, ms = Date.now()) {
  const day = dayKey(ms);
  if (save.quests.day === day) return false;
  const r = rng(day * 13 + 5); const pool = QUEST_POOL.slice(); const list = [];
  for (let i = 0; i < 3; i++) {
    const p = pool.splice(Math.floor(r() * pool.length), 1)[0];
    const need = p.need[Math.floor(r() * p.need.length)];
    const q = { t: p.t, need, have: 0, claimed: false };
    if (p.t === 'el') q.arg = Object.keys(ELEMENTS)[Math.floor(r() * 6)];
    const rw = [{ ball: 8 }, { berry: 4, ball: 4 }, { ball2: 4 }, { egg: 1 }, { incense: 1, ball: 5 }][Math.floor(r() * 5)];
    q.reward = rw; q.coins = 20 + Math.floor(r() * 3) * 10; list.push(q);
  }
  save.quests = { day, list, bonus: false }; return true;
}
export function questEvent(save, t, n = 1, arg) {
  let done = false;
  for (const q of save.quests.list) {
    if (q.t !== t || q.have >= q.need) continue;
    if (q.t === 'el' && q.arg !== arg) continue;
    q.have = Math.min(q.need, q.have + n); if (q.have >= q.need) done = true;
  }
  return done;
}
export function claimQuest(save, i) {
  const q = save.quests.list[i]; if (!q || q.claimed || q.have < q.need) return null;
  q.claimed = true; give(save, q.reward); save.coins += q.coins;
  const out = { reward: q.reward, coins: q.coins, xp: 300, ups: addXp(save, 300) };
  if (!save.quests.bonus && save.quests.list.every((x) => x.claimed)) { save.quests.bonus = true; save.dust += 1500; out.bonusDust = 1500; }
  return out;
}

// --- 상점 ---
export function buy(save, k) {
  const it = ITEMS[k]; if (!it) return '없는 물건이야';
  if (it.lv && save.lv < it.lv) return `레벨 ${it.lv}부터 살 수 있어`;
  if (save.coins < it.price[1]) return '코인이 모자라';
  if (k === 'egg' && save.eggs.length >= MAX_EGGS) return '알을 더 가질 수 없어';
  save.coins -= it.price[1]; give(save, { [k]: it.price[0] }); return null;
}

// --- 도장 싸움 ---
export function damage(att, def, movePower) {
  const a = stats(att), d = stats(def), sa = BY_ID[att.sp], sd = BY_ID[def.sp];
  return Math.floor(0.5 * movePower * (a.atk / d.def) * effect(sa.el, sd.el) * 1.2) + 1;
}
export const FAST_POWER = 7, CHARGE_POWER = 70, FAST_ENERGY = 12;
// 도장 지킴이 세 마리: 도장마다 속성이 정해져 있고, 이길수록 강해진다
export function arenaTeam(key, wins, lv) {
  const r = rng(hash2(key, 99, 3)); const els = Object.keys(ELEMENTS); const el = els[Math.floor(r() * els.length)];
  const pool = SPECIES.filter((s) => s.el === el && s.rare < 5);
  const level = Math.max(2, Math.min(40, Math.round(lv * 0.8) + wins * 2 + 1));
  const team = [];
  for (let i = 0; i < 3; i++) { const cand = pool.filter((s) => s.rare <= 2 + i + Math.min(2, Math.floor(wins / 2))); const s = cand[Math.floor(r() * cand.length)] || pool[0]; team.push(makeMon(s.id, level + i, r, { iv: [8, 8, 8], shiny: false, t: 0 })); }
  return { el, team };
}
export function arenaReward(save, key) {
  const wins = (save.arenas[key] = (save.arenas[key] || 0) + 1); save.stats.wins++;
  const coins = 25 + Math.min(50, wins * 5); save.coins += coins; save.dust += 400;
  return { coins, dust: 400, xp: 400, wins, ups: addXp(save, 400) };
}
export function bestTeam(save) { return save.mons.slice().sort((a, b) => power(b) - power(a)).slice(0, 3).map((m) => m.uid); }

// --- 저장 ---
export const SAVE_KEY = 'moamon-save-v1';
export function newSave() {
  return { v: 1, lv: 1, xp: 0, coins: 100, dust: 1000, items: { ball: 25, ball2: 0, ball3: 0, berry: 5, gberry: 0, incense: 1 }, mons: [], candy: {}, dex: {}, eggs: [], dist: 0, buddy: null, buddyWalk: 0, team: [], quests: { day: 0, list: [] }, stats: { caught: 0, spins: 0, wins: 0 }, arenas: {}, stopCd: {}, incenseUntil: 0, settings: { sound: true, music: true }, pos: { x: 0, z: 0 }, look: { hat: 0, coat: 0 }, started: false };
}
export function fixSave(raw) {
  const base = newSave();
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return base;
  const s = { ...base, ...raw };
  for (const k of ['items', 'stats', 'settings', 'pos', 'look']) s[k] = { ...base[k], ...(raw[k] || {}) };
  s.mons = (Array.isArray(raw.mons) ? raw.mons : []).filter((m) => m && BY_ID[m.sp] && Array.isArray(m.iv) && m.iv.length === 3).slice(0, MAX_MONS);
  s.eggs = (Array.isArray(raw.eggs) ? raw.eggs : []).filter((e) => e && e.need > 0).slice(0, MAX_EGGS);
  for (const k of ['candy', 'dex', 'arenas', 'stopCd']) if (!s[k] || typeof s[k] !== 'object') s[k] = {};
  if (!s.quests || !Array.isArray(s.quests.list)) s.quests = base.quests;
  s.lv = Math.max(1, Math.min(MAX_LEVEL, s.lv | 0)); s.team = (s.team || []).filter((u) => s.mons.some((m) => m.uid === u));
  for (const k of ['xp', 'coins', 'dust', 'dist']) s[k] = Math.max(0, Number(s[k]) || 0);
  return s;
}
