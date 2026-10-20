// 블록, 아이템, 조합법, 화로 굽기 목록.
// 숫자 ID 는 저장 파일에 그대로 들어가므로 한 번 정하면 바꾸지 않는다.

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, BEDROCK: 5, SAND: 6, GRAVEL: 7,
  OAK_LOG: 8, OAK_TRUNK: 9, OAK_LEAVES: 10, BIRCH_LOG: 11, BIRCH_TRUNK: 12, BIRCH_LEAVES: 13,
  SPRUCE_LOG: 14, SPRUCE_TRUNK: 15, SPRUCE_LEAVES: 16, PLANKS: 17, GLASS: 18,
  COAL_ORE: 19, IRON_ORE: 20, GOLD_ORE: 21, DIAMOND_ORE: 22, REDSTONE_ORE: 23,
  CRAFTING: 24, FURNACE: 25, FURNACE_LIT: 26, CHEST: 27, TORCH: 28, WATER: 29, LAVA: 30,
  SNOW_GRASS: 31, SNOW: 32, ICE: 33, CACTUS: 34, SANDSTONE: 35, STONE_BRICKS: 36, TNT: 37, WOOL: 38,
  TALL_GRASS: 39, POPPY: 40, DANDELION: 41, OBSIDIAN: 42, IRON_BLOCK: 43, GOLD_BLOCK: 44, DIAMOND_BLOCK: 45,
  LADDER: 46, DOOR_B: 47, DOOR_T: 48, BED_FOOT: 49, BED_HEAD: 50,
  SAPLING_OAK: 51, SAPLING_BIRCH: 52, SAPLING_SPRUCE: 53, PUMPKIN: 54, JACK: 55, DEAD_BUSH: 56,
  COAL_BLOCK: 57, MOSSY_COBBLE: 58, NETHERRACK: 59, SOUL_SAND: 60, GLOWSTONE: 61, END_STONE: 62, PURPUR: 63, END_FRAME: 64,
};

export const I = {
  STICK: 100, COAL: 101, IRON_INGOT: 102, GOLD_INGOT: 103, DIAMOND: 104, REDSTONE: 105, FLINT: 106,
  WOOD_PICK: 110, WOOD_AXE: 111, WOOD_SHOVEL: 112, WOOD_SWORD: 113,
  STONE_PICK: 114, STONE_AXE: 115, STONE_SHOVEL: 116, STONE_SWORD: 117,
  IRON_PICK: 118, IRON_AXE: 119, IRON_SHOVEL: 120, IRON_SWORD: 121,
  GOLD_PICK: 122, GOLD_AXE: 123, GOLD_SHOVEL: 124, GOLD_SWORD: 125,
  DIAMOND_PICK: 126, DIAMOND_AXE: 127, DIAMOND_SHOVEL: 128, DIAMOND_SWORD: 129,
  FLINT_STEEL: 130, BUCKET: 131, WATER_BUCKET: 132, LAVA_BUCKET: 133, BOW: 134, ARROW: 135,
  COMPASS: 136, CLOCK: 137,
  RAW_PORK: 140, COOKED_PORK: 141, RAW_BEEF: 142, STEAK: 143, RAW_CHICKEN: 144, COOKED_CHICKEN: 145,
  ROTTEN_FLESH: 146, APPLE: 147, GOLDEN_APPLE: 148,
  BONE: 150, GUNPOWDER: 151, LEATHER: 152, FEATHER: 153, STRING: 154,
  ENDER_EYE: 155, BLAZE_ROD: 156,
  DOOR: 160, BED: 161,
  LEATHER_HELMET: 170, LEATHER_CHEST: 171, LEATHER_LEGS: 172, LEATHER_BOOTS: 173,
  IRON_HELMET: 174, IRON_CHEST: 175, IRON_LEGS: 176, IRON_BOOTS: 177,
  GOLD_HELMET: 178, GOLD_CHEST: 179, GOLD_LEGS: 180, GOLD_BOOTS: 181,
  DIAMOND_HELMET: 182, DIAMOND_CHEST: 183, DIAMOND_LEGS: 184, DIAMOND_BOOTS: 185,
};

// tool: 이 블록을 빨리 캐는 도구. tier: 아이템을 얻으려면 필요한 곡괭이 등급(1 나무·금, 2 돌, 3 철, 4 다이아)
const BASE = {
  hard: 1, tool: null, tier: 0, solid: true, opaque: true, light: 0, atten: 0,
  replace: false, plant: false, gravity: false, climb: false, hurt: 0, fluid: false, sound: 'stone',
};

export const BLOCKS = [];
function block(id, name, props = {}) {
  BLOCKS[id] = { ...BASE, id, name, drop: id, ...props };
}
const see = { solid: false, opaque: false };
const plant = { ...see, hard: 0, plant: true, replace: true, sound: 'grass' };

block(B.AIR, '공기', { ...see, hard: 0, replace: true, drop: 0 });
block(B.GRASS, '잔디 블록', { hard: 0.6, tool: 'shovel', drop: B.DIRT, sound: 'grass' });
block(B.DIRT, '흙', { hard: 0.5, tool: 'shovel', sound: 'dirt' });
block(B.STONE, '돌', { hard: 1.5, tool: 'pick', tier: 1, drop: B.COBBLE });
block(B.COBBLE, '조약돌', { hard: 2, tool: 'pick', tier: 1 });
block(B.END_FRAME, '엔드 포탈 틀', { hard: 3, tool: 'pick', tier: 2 });
block(B.BEDROCK, '기반암', { hard: Infinity });
block(B.SAND, '모래', { hard: 0.5, tool: 'shovel', gravity: true, sound: 'sand' });
block(B.GRAVEL, '자갈', { hard: 0.6, tool: 'shovel', gravity: true, sound: 'sand', drop: (r) => (r < 0.15 ? [I.FLINT, 1] : [B.GRAVEL, 1]) });
block(B.OAK_LOG, '참나무 원목', { hard: 2, tool: 'axe', sound: 'wood' });
block(B.OAK_TRUNK, '참나무', { ...see, atten: 1, hard: 2, tool: 'axe', sound: 'wood', drop: B.OAK_LOG });
block(B.OAK_LEAVES, '참나무 잎', { ...see, atten: 1, hard: 0.2, sound: 'grass', drop: (r) => (r < 0.07 ? [B.SAPLING_OAK, 1] : r < 0.12 ? [I.APPLE, 1] : null) });
block(B.BIRCH_LOG, '자작나무 원목', { hard: 2, tool: 'axe', sound: 'wood' });
block(B.BIRCH_TRUNK, '자작나무', { ...see, atten: 1, hard: 2, tool: 'axe', sound: 'wood', drop: B.BIRCH_LOG });
block(B.BIRCH_LEAVES, '자작나무 잎', { ...see, atten: 1, hard: 0.2, sound: 'grass', drop: (r) => (r < 0.07 ? [B.SAPLING_BIRCH, 1] : null) });
block(B.SPRUCE_LOG, '가문비나무 원목', { hard: 2, tool: 'axe', sound: 'wood' });
block(B.SPRUCE_TRUNK, '가문비나무', { ...see, atten: 1, hard: 2, tool: 'axe', sound: 'wood', drop: B.SPRUCE_LOG });
block(B.SPRUCE_LEAVES, '가문비나무 잎', { ...see, atten: 1, hard: 0.2, sound: 'grass', drop: (r) => (r < 0.07 ? [B.SAPLING_SPRUCE, 1] : null) });
block(B.PLANKS, '나무 판자', { hard: 2, tool: 'axe', sound: 'wood' });
block(B.GLASS, '유리', { opaque: false, hard: 0.3, sound: 'glass' });
block(B.COAL_ORE, '석탄 광석', { hard: 3, tool: 'pick', tier: 1, drop: I.COAL });
block(B.IRON_ORE, '철 광석', { hard: 3, tool: 'pick', tier: 2 });
block(B.GOLD_ORE, '금 광석', { hard: 3, tool: 'pick', tier: 3 });
block(B.DIAMOND_ORE, '다이아몬드 광석', { hard: 3, tool: 'pick', tier: 3, drop: I.DIAMOND });
block(B.REDSTONE_ORE, '레드스톤 광석', { hard: 3, tool: 'pick', tier: 3, drop: (r) => [I.REDSTONE, 4 + Math.floor(r * 2)] });
block(B.CRAFTING, '제작대', { hard: 2.5, tool: 'axe', sound: 'wood' });
block(B.FURNACE, '화로', { hard: 3.5, tool: 'pick', tier: 1 });
block(B.FURNACE_LIT, '불 켜진 화로', { hard: 3.5, tool: 'pick', tier: 1, light: 13, drop: B.FURNACE });
block(B.CHEST, '상자', { hard: 2.5, tool: 'axe', sound: 'wood' });
block(B.TORCH, '횃불', { ...see, hard: 0, light: 14, sound: 'wood' });
block(B.WATER, '물', { ...see, atten: 2, hard: Infinity, replace: true, fluid: true, drop: 0 });
block(B.LAVA, '용암', { ...see, atten: 2, hard: Infinity, replace: true, fluid: true, light: 15, hurt: 4, drop: 0 });
block(B.SNOW_GRASS, '눈 덮인 잔디', { hard: 0.6, tool: 'shovel', drop: B.DIRT, sound: 'snow' });
block(B.SNOW, '눈 블록', { hard: 0.2, tool: 'shovel', sound: 'snow' });
block(B.ICE, '얼음', { opaque: false, atten: 1, hard: 0.5, tool: 'pick', sound: 'glass' });
block(B.CACTUS, '선인장', { ...see, hard: 0.4, plant: true, hurt: 1, sound: 'wool' });
block(B.SANDSTONE, '사암', { hard: 0.8, tool: 'pick', tier: 1 });
block(B.STONE_BRICKS, '석재 벽돌', { hard: 1.5, tool: 'pick', tier: 1 });
block(B.TNT, 'TNT', { hard: 0, sound: 'grass' });
block(B.WOOL, '양털', { hard: 0.8, sound: 'wool' });
block(B.TALL_GRASS, '풀', { ...plant, drop: 0 });
block(B.POPPY, '양귀비', plant);
block(B.DANDELION, '민들레', plant);
block(B.OBSIDIAN, '흑요석', { hard: 25, tool: 'pick', tier: 4 });
block(B.IRON_BLOCK, '철 블록', { hard: 5, tool: 'pick', tier: 2, sound: 'metal' });
block(B.GOLD_BLOCK, '금 블록', { hard: 3, tool: 'pick', tier: 3, sound: 'metal' });
block(B.DIAMOND_BLOCK, '다이아몬드 블록', { hard: 5, tool: 'pick', tier: 3, sound: 'metal' });
block(B.LADDER, '사다리', { ...see, hard: 0.4, tool: 'axe', climb: true, sound: 'wood' });
block(B.DOOR_B, '나무 문', { opaque: false, hard: 3, tool: 'axe', sound: 'wood', drop: I.DOOR });
block(B.DOOR_T, '나무 문', { opaque: false, hard: 3, tool: 'axe', sound: 'wood', drop: 0 });
block(B.BED_FOOT, '침대', { ...see, hard: 0.2, sound: 'wool', drop: I.BED });
block(B.BED_HEAD, '침대', { ...see, hard: 0.2, sound: 'wool', drop: 0 });
block(B.SAPLING_OAK, '참나무 묘목', { ...plant, replace: false });
block(B.SAPLING_BIRCH, '자작나무 묘목', { ...plant, replace: false });
block(B.SAPLING_SPRUCE, '가문비나무 묘목', { ...plant, replace: false });
block(B.PUMPKIN, '호박', { hard: 1, tool: 'axe', sound: 'wood' });
block(B.JACK, '잭오랜턴', { hard: 1, tool: 'axe', light: 15, sound: 'wood' });
block(B.DEAD_BUSH, '마른 덤불', { ...plant, drop: (r) => (r < 0.5 ? [I.STICK, 1] : null) });
block(B.COAL_BLOCK, '석탄 블록', { hard: 5, tool: 'pick', tier: 1 });
block(B.MOSSY_COBBLE, '이끼 낀 조약돌', { hard: 2, tool: 'pick', tier: 1 });
block(B.NETHERRACK, '네더랙', { hard: 0.4, tool: 'pick', tier: 1 });
block(B.SOUL_SAND, '영혼 모래', { hard: 0.5, tool: 'shovel', sound: 'sand' });
block(B.GLOWSTONE, '발광석', { hard: 0.4, light: 15, sound: 'glass' });
block(B.END_STONE, '엔드 돌', { hard: 3, tool: 'pick', tier: 1 });
block(B.PURPUR, '퍼퍼 블록', { hard: 1.5, tool: 'pick', tier: 1 });

// 문은 닫혔을 때만 몸을 막는다 (meta 의 1 비트가 열림)
export function isSolid(t, m) {
  if (t === B.DOOR_B || t === B.DOOR_T) return !(m & 1);
  return BLOCKS[t].solid;
}

// ---- 아이템 ----
export const ITEMS = [];
function item(id, name, props = {}) {
  ITEMS[id] = { id, name, stack: 64, ...props };
}
for (const b of BLOCKS) if (b) item(b.id, b.name, { place: b.id });

export const MATERIALS = {
  wood: { name: '나무', tier: 1, speed: 2, dur: 59, dmg: 4 },
  stone: { name: '돌', tier: 2, speed: 4, dur: 131, dmg: 5 },
  iron: { name: '철', tier: 3, speed: 6, dur: 250, dmg: 6 },
  gold: { name: '금', tier: 1, speed: 12, dur: 32, dmg: 4 },
  diamond: { name: '다이아몬드', tier: 4, speed: 8, dur: 1561, dmg: 7 },
};
const TOOL_NAMES = { pick: '곡괭이', axe: '도끼', shovel: '삽', sword: '검' };
const TOOL_DMG = { pick: -2, axe: -1, shovel: -3, sword: 0 };
const toolIds = {
  wood: [I.WOOD_PICK, I.WOOD_AXE, I.WOOD_SHOVEL, I.WOOD_SWORD],
  stone: [I.STONE_PICK, I.STONE_AXE, I.STONE_SHOVEL, I.STONE_SWORD],
  iron: [I.IRON_PICK, I.IRON_AXE, I.IRON_SHOVEL, I.IRON_SWORD],
  gold: [I.GOLD_PICK, I.GOLD_AXE, I.GOLD_SHOVEL, I.GOLD_SWORD],
  diamond: [I.DIAMOND_PICK, I.DIAMOND_AXE, I.DIAMOND_SHOVEL, I.DIAMOND_SWORD],
};
const TOOL_TYPES = ['pick', 'axe', 'shovel', 'sword'];
for (const [mat, ids] of Object.entries(toolIds)) {
  const m = MATERIALS[mat];
  ids.forEach((id, k) => {
    const type = TOOL_TYPES[k];
    item(id, `${m.name} ${TOOL_NAMES[type]}`, {
      stack: 1,
      tool: { type, mat, tier: m.tier, speed: type === 'sword' ? 1 : m.speed, dur: m.dur, dmg: Math.max(1, m.dmg + TOOL_DMG[type]) },
    });
  });
}

export const ARMOR_MATERIALS = {
  leather: { name: '가죽', ingredient: I.LEATHER, ids: [170, 171, 172, 173], points: [1, 3, 2, 1], dur: 5, color: '#a16c46' },
  iron: { name: '철', ingredient: I.IRON_INGOT, ids: [174, 175, 176, 177], points: [2, 6, 5, 2], dur: 15, color: '#d3dee6' },
  gold: { name: '금', ingredient: I.GOLD_INGOT, ids: [178, 179, 180, 181], points: [2, 5, 3, 1], dur: 7, color: '#f3c74f' },
  diamond: { name: '다이아몬드', ingredient: I.DIAMOND, ids: [182, 183, 184, 185], points: [3, 8, 6, 3], dur: 33, color: '#57ded5' },
};
for (const [mat, def] of Object.entries(ARMOR_MATERIALS)) def.ids.forEach((id, slot) => {
  item(id, `${def.name} ${['투구', '흉갑', '바지', '신발'][slot]}`, { stack: 1, armor: { slot, mat, points: def.points[slot], color: def.color }, uses: [11, 16, 15, 13][slot] * def.dur });
});

item(I.STICK, '막대기');
item(I.COAL, '석탄');
item(I.IRON_INGOT, '철 주괴');
item(I.GOLD_INGOT, '금 주괴');
item(I.DIAMOND, '다이아몬드');
item(I.REDSTONE, '레드스톤 가루');
item(I.FLINT, '부싯돌');
item(I.FLINT_STEEL, '부싯돌과 부시', { stack: 1, uses: 64 });
item(I.BUCKET, '양동이', { stack: 16 });
item(I.WATER_BUCKET, '물 양동이', { stack: 1 });
item(I.LAVA_BUCKET, '용암 양동이', { stack: 1 });
item(I.BOW, '활', { stack: 1, uses: 384 });
item(I.ARROW, '화살');
item(I.COMPASS, '나침반', { stack: 1 });
item(I.CLOCK, '시계', { stack: 1 });
item(I.RAW_PORK, '익히지 않은 돼지고기', { food: 3 });
item(I.COOKED_PORK, '익힌 돼지고기', { food: 8 });
item(I.RAW_BEEF, '익히지 않은 소고기', { food: 3 });
item(I.STEAK, '스테이크', { food: 8 });
item(I.RAW_CHICKEN, '익히지 않은 닭고기', { food: 2 });
item(I.COOKED_CHICKEN, '익힌 닭고기', { food: 6 });
item(I.ROTTEN_FLESH, '썩은 살점', { food: 4 });
item(I.APPLE, '사과', { food: 4 });
item(I.GOLDEN_APPLE, '황금 사과', { food: 4, heal: 8 });
item(I.BONE, '뼈');
item(I.GUNPOWDER, '화약');
item(I.LEATHER, '가죽');
item(I.FEATHER, '깃털');
item(I.STRING, '실');
item(I.DOOR, '나무 문', { place: B.DOOR_B });
item(I.ENDER_EYE, '엔더의 눈');
item(I.BLAZE_ROD, '블레이즈 막대');
item(I.BED, '침대', { stack: 1, place: B.BED_FOOT });
// 자연에서만 생기는 블록은 아이템으로 갖고 다니지 않는다
for (const id of [B.AIR, B.OAK_TRUNK, B.BIRCH_TRUNK, B.SPRUCE_TRUNK, B.FURNACE_LIT, B.WATER, B.LAVA, B.DOOR_B, B.DOOR_T, B.BED_FOOT, B.BED_HEAD, B.SNOW_GRASS]) delete ITEMS[id];

export function maxStack(id) {
  return ITEMS[id]?.stack ?? 64;
}
export function durabilityOf(id) {
  const it = ITEMS[id];
  return it?.tool?.dur ?? it?.uses ?? 0;
}

// ---- 화로 ----
export const SMELT_TIME = 4;
export const SMELT = {
  [B.IRON_ORE]: I.IRON_INGOT, [B.GOLD_ORE]: I.GOLD_INGOT, [B.SAND]: B.GLASS, [B.COBBLE]: B.STONE,
  [I.RAW_PORK]: I.COOKED_PORK, [I.RAW_BEEF]: I.STEAK, [I.RAW_CHICKEN]: I.COOKED_CHICKEN,
  [B.OAK_LOG]: I.COAL, [B.BIRCH_LOG]: I.COAL, [B.SPRUCE_LOG]: I.COAL,
  [B.STONE]: B.STONE_BRICKS,
};
// 연료가 타는 초. 화로 한 번 굽기는 SMELT_TIME 초
export const FUEL = {
  [I.COAL]: 32, [B.COAL_BLOCK]: 320, [B.OAK_LOG]: 6, [B.BIRCH_LOG]: 6, [B.SPRUCE_LOG]: 6, [B.PLANKS]: 6,
  [I.STICK]: 2, [I.LAVA_BUCKET]: 400, [B.SAPLING_OAK]: 2, [B.SAPLING_BIRCH]: 2, [B.SAPLING_SPRUCE]: 2,
  [B.CRAFTING]: 6, [B.CHEST]: 6, [B.LADDER]: 3, [I.WOOD_PICK]: 4, [I.WOOD_AXE]: 4, [I.WOOD_SHOVEL]: 4, [I.WOOD_SWORD]: 4,
};

// ---- 조합법 ----
// shape 의 공백은 빈 칸. key 값은 아이템 ID 하나 또는 받아 주는 ID 목록
const LOGS = [B.OAK_LOG, B.BIRCH_LOG, B.SPRUCE_LOG];
const raw = [
  { out: [B.PLANKS, 4], shape: ['L'], key: { L: LOGS } },
  { out: [I.STICK, 4], shape: ['P', 'P'], key: { P: B.PLANKS } },
  { out: [B.CRAFTING, 1], shape: ['PP', 'PP'], key: { P: B.PLANKS } },
  { out: [B.TORCH, 4], shape: ['C', 'S'], key: { C: I.COAL, S: I.STICK } },
  { out: [B.FURNACE, 1], shape: ['CCC', 'C C', 'CCC'], key: { C: B.COBBLE } },
  { out: [B.CHEST, 1], shape: ['PPP', 'P P', 'PPP'], key: { P: B.PLANKS } },
];
const TOOL_MATS = { wood: B.PLANKS, stone: B.COBBLE, iron: I.IRON_INGOT, gold: I.GOLD_INGOT, diamond: I.DIAMOND };
for (const [mat, ids] of Object.entries(toolIds)) {
  const M = TOOL_MATS[mat];
  const key = { M, S: I.STICK };
  raw.push(
    { out: [ids[0], 1], shape: ['MMM', ' S ', ' S '], key },
    { out: [ids[1], 1], shape: ['MM', 'MS', ' S'], key },
    { out: [ids[2], 1], shape: ['M', 'S', 'S'], key },
    { out: [ids[3], 1], shape: ['M', 'M', 'S'], key },
  );
}
for (const def of Object.values(ARMOR_MATERIALS)) {
  const shapes = [['MMM', 'M M'], ['M M', 'MMM', 'MMM'], ['MMM', 'M M', 'M M'], ['M M', 'M M']];
  def.ids.forEach((id, slot) => raw.push({ out: [id, 1], shape: shapes[slot], key: { M: def.ingredient } }));
}
raw.push(
  { out: [I.FLINT_STEEL, 1], items: [I.IRON_INGOT, I.FLINT] },
  { out: [I.BUCKET, 1], shape: ['I I', ' I '], key: { I: I.IRON_INGOT } },
  { out: [B.LADDER, 3], shape: ['S S', 'SSS', 'S S'], key: { S: I.STICK } },
  { out: [I.DOOR, 3], shape: ['PP', 'PP', 'PP'], key: { P: B.PLANKS } },
  { out: [I.BED, 1], shape: ['WWW', 'PPP'], key: { W: B.WOOL, P: B.PLANKS } },
  { out: [B.SANDSTONE, 1], shape: ['SS', 'SS'], key: { S: B.SAND } },
  { out: [B.STONE_BRICKS, 4], shape: ['SS', 'SS'], key: { S: B.STONE } },
  { out: [B.TNT, 1], shape: ['GSG', 'SGS', 'GSG'], key: { G: I.GUNPOWDER, S: B.SAND } },
  { out: [B.JACK, 1], shape: ['P', 'T'], key: { P: B.PUMPKIN, T: B.TORCH } },
  { out: [I.BOW, 1], shape: [' ST', 'S T', ' ST'], key: { S: I.STICK, T: I.STRING } },
  { out: [I.ARROW, 4], shape: ['F', 'S', 'E'], key: { F: I.FLINT, S: I.STICK, E: I.FEATHER } },
  { out: [I.COMPASS, 1], shape: [' I ', 'IRI', ' I '], key: { I: I.IRON_INGOT, R: I.REDSTONE } },
  { out: [I.CLOCK, 1], shape: [' G ', 'GRG', ' G '], key: { G: I.GOLD_INGOT, R: I.REDSTONE } },
  { out: [I.GOLDEN_APPLE, 1], shape: ['GGG', 'GAG', 'GGG'], key: { G: I.GOLD_INGOT, A: I.APPLE } },
  { out: [B.WOOL, 1], shape: ['SS', 'SS'], key: { S: I.STRING } },
  { out: [B.MOSSY_COBBLE, 1], items: [B.COBBLE, B.TALL_GRASS] },
  { out: [B.IRON_BLOCK, 1], shape: ['MMM', 'MMM', 'MMM'], key: { M: I.IRON_INGOT } },
  { out: [B.GOLD_BLOCK, 1], shape: ['MMM', 'MMM', 'MMM'], key: { M: I.GOLD_INGOT } },
  { out: [B.DIAMOND_BLOCK, 1], shape: ['MMM', 'MMM', 'MMM'], key: { M: I.DIAMOND } },
  { out: [B.COAL_BLOCK, 1], shape: ['MMM', 'MMM', 'MMM'], key: { M: I.COAL } },
  { out: [I.IRON_INGOT, 9], items: [B.IRON_BLOCK] },
  { out: [I.GOLD_INGOT, 9], items: [B.GOLD_BLOCK] },
  { out: [I.DIAMOND, 9], items: [B.DIAMOND_BLOCK] },
  { out: [I.COAL, 9], items: [B.COAL_BLOCK] },
  { out: [B.END_FRAME, 4], shape: [' O ', 'ODO', ' O '], key: { O: B.OBSIDIAN, D: I.DIAMOND } },
  { out: [I.ENDER_EYE, 1], items: [I.DIAMOND, I.BLAZE_ROD] },
);

// 모양을 숫자 칸 배열로 바꿔 둔다. cells[r][c] 는 받아 주는 ID 목록 또는 null(빈 칸)
export const RECIPES = raw.map((r, index) => {
  if (r.items) return { index, out: r.out, items: r.items.map((v) => (Array.isArray(v) ? v : [v])), w: 1, h: 1 };
  const w = Math.max(...r.shape.map((row) => row.length));
  const cells = r.shape.map((row) => Array.from({ length: w }, (_, c) => {
    const ch = row[c] ?? ' ';
    if (ch === ' ') return null;
    const v = r.key[ch];
    return Array.isArray(v) ? v : [v];
  }));
  return { index, out: r.out, cells, w, h: cells.length };
});
// 2x2 안에 들어가지 않는 조합법은 제작대가 있어야 한다
for (const r of RECIPES) r.table = r.items ? r.items.length > 4 : r.w > 2 || r.h > 2;

export const HOSTILE = new Set(['zombie', 'skeleton', 'creeper', 'spider', 'summoner', 'piglin', 'ghast', 'blaze']);
export const MOBS = {
  piglin: { name: '피글린', w: .65, h: 1.85, hp: 24, speed: 2.7, dmg: 5, nether: true, drops: [[I.GOLD_INGOT, 1, 3]] },
  ghast: { name: '가스트', w: 2.5, h: 2.8, hp: 32, speed: 1.8, dmg: 7, nether: true, flying: true, drops: [[I.GUNPOWDER, 2, 4]] },
  blaze: { name: '블레이즈', w: .8, h: 1.8, hp: 28, speed: 2, dmg: 4, nether: true, flying: true, drops: [[I.BLAZE_ROD, 1, 2]] },
  summoner: { name: '소환사 좀비', w: 1, h: 2.6, hp: 540, speed: 2.3, dmg: 8, drops: [[I.DIAMOND, 10, 10], [I.GOLDEN_APPLE, 3, 3]] },
  pig: { name: '돼지', w: 0.9, h: 0.85, hp: 10, speed: 1.5, drops: [[I.RAW_PORK, 1, 3]] },
  cow: { name: '소', w: 0.95, h: 1.3, hp: 10, speed: 1.3, drops: [[I.RAW_BEEF, 1, 3], [I.LEATHER, 0, 2]] },
  sheep: { name: '양', w: 0.9, h: 1.15, hp: 8, speed: 1.4, drops: [[B.WOOL, 1, 2]] },
  chicken: { name: '닭', w: 0.5, h: 0.7, hp: 4, speed: 1.5, drops: [[I.RAW_CHICKEN, 1, 1], [I.FEATHER, 0, 2]] },
  zombie: { name: '좀비', w: 0.6, h: 1.85, hp: 20, speed: 2.2, dmg: 3, burns: true, drops: [[I.ROTTEN_FLESH, 0, 2]] },
  skeleton: { name: '스켈레톤', w: 0.6, h: 1.85, hp: 20, speed: 2.1, dmg: 2, burns: true, drops: [[I.BONE, 0, 2], [I.ARROW, 0, 2]] },
  creeper: { name: '크리퍼', w: 0.6, h: 1.6, hp: 20, speed: 2, dmg: 0, drops: [[I.GUNPOWDER, 0, 2]] },
  spider: { name: '거미', w: 1.3, h: 0.8, hp: 16, speed: 2.9, dmg: 2, drops: [[I.STRING, 0, 2]] },
};
