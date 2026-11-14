// 뚱뚱해지기 타이쿤: 화면 없이 돌아가는 게임 규칙 (레벨, 음식, 코인, 보상, 저장)

export const START_WEIGHT = 30;
export const SAVE_KEY = 'fat-tycoon-save-v1';

// 인혁이 공책의 먹기 순서 (월드 1). 월드 2는 수영이가 정했다.
const W1 = [
  ['majju', '마쮸', '🍬', 0.1, 60],
  ['tangerine', '귤', '🍊', 0.3, 100],
  ['apple', '사과', '🍎', 0.8, 150],
  ['seaweed-soup', '미역국', '🥣', 2, 200],
  ['chicken', '치킨', '🍗', 5, 260],
  ['pizza', '피자', '🍕', 12, 320],
  ['malatang', '마라탕', '🍲', 30, 380],
  ['donkatsu3', '돈까스 3판', '🍛', 80, 450],
  ['malatang2', '마라탕 2판', '🍲', 200, 520],
  ['malatang100', '마라탕 100판', '🍲', 600, 600],
];
const W2 = [
  ['bungeoppang', '붕어빵', '🐟', 1500, 650],
  ['tteokbokki', '떡볶이', '🌶️', 4000, 700],
  ['gimbap', '김밥', '🍙', 10000, 750],
  ['ramyeon', '라면', '🍜', 25000, 800],
  ['burger', '햄버거', '🍔', 60000, 850],
  ['jjajang', '짜장면', '🍝', 150000, 900],
  ['samgyeopsal', '삼겹살', '🥓', 400000, 950],
  ['sushi30', '초밥 30접시', '🍣', 1000000, 1000],
  ['cake10', '케이크 10판', '🎂', 2500000, 1050],
  ['chicken1000', '치킨 1000마리', '🍗', 10000000, 1100],
];

const W3 = [
  ['icecream', '아이스크림', '🍦', 3e7, 1150],
  ['tanghulu', '탕후루', '🍡', 8e7, 1200],
  ['donut', '도넛', '🍩', 2e8, 1250],
  ['waffle', '와플', '🧇', 5e8, 1300],
  ['pudding', '푸딩', '🍮', 1.2e9, 1350],
  ['macaron', '마카롱', '🧁', 3e9, 1400],
  ['cottoncandy', '솜사탕', '☁️', 8e9, 1450],
  ['bingsu', '팥빙수', '🍧', 2e10, 1500],
  ['hotteok20', '호떡 20장', '🥞', 5e10, 1550],
  ['icecream500', '아이스크림 500개', '🍦', 2e11, 1600],
];
const W4 = [
  ['mandu', '만두', '🥟', 5e11, 1650],
  ['hotdog', '핫도그', '🌭', 1.2e12, 1700],
  ['taco', '타코', '🌮', 3e12, 1750],
  ['curry', '카레', '🍛', 8e12, 1800],
  ['bibimbap', '비빔밥', '🥗', 2e13, 1850],
  ['steak', '스테이크', '🥩', 5e13, 1900],
  ['lobster', '랍스터', '🦞', 1.2e14, 1950],
  ['burger50', '햄버거 50층', '🍔', 3e14, 2000],
  ['pizza100', '피자 100판', '🍕', 8e14, 2050],
  ['meatball10000', '미트볼 1만 개', '🧆', 3e15, 2100],
];
const W5 = [
  ['goldapple', '황금 사과', '🍏', 8e15, 2150],
  ['watermelon', '수박', '🍉', 2e16, 2200],
  ['galbi', '갈비', '🍖', 5e16, 2250],
  ['turkey', '칠면조 구이', '🦃', 1.2e17, 2300],
  ['octopus', '대왕 문어', '🐙', 3e17, 2350],
  ['rainbowcake', '무지개 케이크', '🌈', 8e17, 2400],
  ['goldramyeon', '황금 라면', '🍜', 2e18, 2450],
  ['feast', '잔칫상 한 상', '🍱', 5e18, 2500],
  ['malatang10000', '마라탕 1만 판', '🍲', 1.2e19, 2550],
  ['earthmajju', '지구만 한 마쮸', '🌍', 5e19, 2600],
];

export const STAGES = [];
{
  let total = START_WEIGHT;
  [...W1, ...W2, ...W3, ...W4, ...W5].forEach(([id, name, emoji, gain, bites], i) => {
    total += gain * bites * 1.5;
    STAGES.push({
      index: i, id, name, emoji, gain, bites,
      world: Math.floor(i / 10) + 1, level: (i % 10) + 1,
      coin: Math.round(Math.pow(1.3, i)),
      target: Math.round(total * 10) / 10,
    });
  });
}
export const WORLDS = [
  { id: 1, name: '우리 동네 먹자골목', emoji: '🏘️', record: '대한민국에서 제일 뚱뚱한 사람' },
  { id: 2, name: '별빛 야시장', emoji: '🌙', record: '세계에서 제일 뚱뚱한 사람' },
  { id: 3, name: '눈꽃 얼음 나라', emoji: '❄️', record: '태양계에서 제일 뚱뚱한 사람' },
  { id: 4, name: '우주 정거장', emoji: '🚀', record: '우리 은하에서 제일 뚱뚱한 사람' },
  { id: 5, name: '황금 구름 궁전', emoji: '👑', record: '온 우주에서 제일 뚱뚱한 사람' },
];
export const WORLD_COUNT = WORLDS.length;

export const UPGRADES = [
  { id: 'mouth', name: '입 크게', emoji: '👄', desc: '한 입에 더 많이 먹어요', base: 40, grow: 1.7, max: 100 },
  { id: 'robot', name: '먹여 주는 로봇', emoji: '🤖', desc: '로봇이 알아서 먹여 줘요', base: 150, grow: 1.75, max: 60 },
  { id: 'fans', name: '먹방 방송', emoji: '📺', desc: '코인을 더 많이 받아요', base: 100, grow: 1.7, max: 100 },
  { id: 'tray', name: '큰 쟁반', emoji: '🍽️', desc: '한 번에 더 많이 받아요', base: 60, grow: 1.5, max: 20 },
  { id: 'shoes', name: '빠른 신발', emoji: '👟', desc: '더 빨리 걸어요', base: 200, grow: 2.2, max: 6 },
  { id: 'drone', name: '배달 드론', emoji: '🛸', desc: '음식이 떨어지면 알아서 가져다줘요', base: 1500, grow: 1, max: 1 },
];
const UP = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export const SKINS = [
  { id: 'basic', name: '기본 옷', cost: 0, shirt: '#ff7a59', pants: '#3b5bdb', hat: 'none' },
  { id: 'blue', name: '파랑 후드', cost: 300, shirt: '#3fa7ff', pants: '#2b2f4a', hat: 'hood' },
  { id: 'chick', name: '노랑 병아리', cost: 800, shirt: '#ffd43b', pants: '#ff922b', hat: 'chick' },
  { id: 'dino', name: '초록 공룡', cost: 2500, shirt: '#51cf66', pants: '#2f9e44', hat: 'dino' },
  { id: 'bunny', name: '분홍 토끼', cost: 6000, shirt: '#ff8fc7', pants: '#ffffff', hat: 'bunny' },
  { id: 'chef', name: '요리사', cost: 20000, shirt: '#ffffff', pants: '#343a40', hat: 'chef' },
  { id: 'king', name: '먹방 임금님', cost: 80000, shirt: '#9b5cff', pants: '#ffd43b', hat: 'crown' },
  { id: 'rainbow', name: '무지개', cost: 300000, shirt: 'rainbow', pants: '#ffffff', hat: 'star' },
];

export const DAILY = [100, 200, 300, 500, 800, 1200, 2500];
export const TIME_REWARDS = [
  { min: 1, coin: 50 }, { min: 3, coin: 150 }, { min: 5, coin: 300 },
  { min: 10, coin: 800 }, { min: 20, coin: 2000 }, { min: 30, coin: 5000 },
];

export function newSave() {
  return {
    v: 1, weight: START_WEIGHT, coins: 0, stage: 0, world: 1, plate: 0, plateStage: 0,
    up: { mouth: 0, robot: 0, fans: 0, tray: 0, shoes: 0, drone: 0 },
    skins: ['basic'], skin: 'basic',
    daily: { last: '', streak: 0 }, time: { day: '', sec: 0, got: [] },
    intro: false, cleared: WORLDS.map(() => false), bites: 0, sound: true, music: true, adv: [], friend: false,
    plateMult: 1, plateName: '', plateModel: '', jump: 1, jumps: 0, jumpTop: 0, gender: '', videos: 0, subs: 0, reps: 0, cooked: 0, weird: false, legend: false, home: false,
  };
}
export function fixSave(raw) {
  const s = newSave();
  if (!raw || typeof raw !== 'object') return s;
  const num = (v, d, lo = 0, hi = 1e30) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  s.weight = num(raw.weight, START_WEIGHT, START_WEIGHT);
  s.coins = Math.floor(num(raw.coins, 0));
  s.stage = Math.floor(num(raw.stage, 0, 0, STAGES.length));

  s.plate = Math.floor(num(raw.plate, 0, 0, 100000));
  s.plateStage = Math.floor(num(raw.plateStage, 0, 0, STAGES.length - 1));
  for (const u of UPGRADES) s.up[u.id] = Math.floor(num(raw.up?.[u.id], 0, 0, u.max));
  const own = Array.isArray(raw.skins) ? raw.skins.filter((id) => SKINS.some((k) => k.id === id)) : [];
  s.skins = [...new Set(['basic', ...own])];
  s.skin = s.skins.includes(raw.skin) ? raw.skin : 'basic';
  if (raw.daily && typeof raw.daily.last === 'string') s.daily = { last: raw.daily.last, streak: Math.floor(num(raw.daily.streak, 0, 0, 1e6)) };
  if (raw.time && typeof raw.time.day === 'string') s.time = { day: raw.time.day, sec: num(raw.time.sec, 0, 0, 86400), got: Array.isArray(raw.time.got) ? raw.time.got.filter((n) => Number.isInteger(n)) : [] };
  s.intro = !!raw.intro;
  s.cleared = WORLDS.map((_, i) => !!raw.cleared?.[i]);
  s.bites = Math.floor(num(raw.bites, 0));
  s.adv = Array.isArray(raw.adv) ? [...new Set(raw.adv.filter((id) => typeof id === 'string'))].slice(0, 100) : [];
  s.friend = !!raw.friend;
  s.plateMult = num(raw.plateMult, 1, 0.1, 20); s.plateName = typeof raw.plateName === 'string' && DISHES.some((d) => d.name === raw.plateName) ? raw.plateName : '';
  s.plateModel = s.plateName ? DISHES.find((d) => d.name === s.plateName).model : ''; if (!s.plateName) s.plateMult = 1;
  s.jump = Math.round(num(raw.jump, 1, 1, JUMP_MAX) * 100) / 100; s.jumps = Math.floor(num(raw.jumps, 0)); s.jumpTop = Math.floor(num(raw.jumpTop, 0, 0, JUMP_SECTIONS.length));
  s.gender = raw.gender === 'girl' || raw.gender === 'boy' ? raw.gender : '';
  s.videos = Math.floor(num(raw.videos, 0)); s.subs = Math.floor(num(raw.subs, 0)); s.reps = Math.floor(num(raw.reps, 0)); s.cooked = Math.floor(num(raw.cooked, 0));
  s.weird = !!raw.weird; s.legend = !!raw.legend; s.home = !!raw.home;
  s.world = Number.isInteger(raw.world) && raw.world >= 1 && raw.world <= WORLDS.length && (raw.world === 1 || s.cleared[raw.world - 2]) ? raw.world : 1;
  s.sound = raw.sound !== false; s.music = raw.music !== false;
  return s;
}

export const stageOf = (s) => STAGES[Math.min(s.stage, STAGES.length - 1)];
export const allDone = (s) => s.stage >= STAGES.length;
export const mouthPower = (s) => 1 + 0.25 * s.up.mouth;
export const coinPower = (s) => 1 + 0.5 * s.up.fans;
export const traySize = (s) => 20 + 10 * s.up.tray;
export const robotRate = (s) => 0.3 * s.up.robot; // 1초에 로봇이 먹여 주는 횟수
export const walkSpeed = (s) => 6.5 + 0.9 * s.up.shoes;
export const biteGain = (s, stageIndex) => STAGES[stageIndex].gain * mouthPower(s);
export const biteCoin = (s, stageIndex) => Math.max(1, Math.round(STAGES[stageIndex].coin * coinPower(s)));

// 지금 받을 수 있는 가장 좋은 음식 (끝까지 깼으면 마지막 음식)
export const bestStage = (s) => Math.min(s.stage, STAGES.length - 1);

// 계획 2: 먹는 건 돈 내고 먹는다. 마쮸(첫 음식)는 공짜, 돈이 모자라면 시식 5개를 준다 (막히지 않게).
export const SAMPLE = 5;
export const platePrice = (s, stageIndex) => (stageIndex === 0 ? 0 : Math.round(STAGES[stageIndex].coin * traySize(s) * 0.4));
// 돌려주는 값: false(잠김) | 'full'(돈 내고 한 쟁반) | 'sample'(돈이 모자라서 시식)
export function fillPlate(s, stageIndex) {
  if (stageIndex > bestStage(s)) return false;
  const price = platePrice(s, stageIndex), poor = s.coins < price;
  if (!poor) s.coins -= price;
  s.plate = poor ? SAMPLE : traySize(s); s.plateStage = stageIndex; s.plateMult = 1; s.plateName = ''; s.plateModel = '';
  return poor ? 'sample' : 'full';
}
function gain(s, stageIndex, times, mult = 1) {
  const kg = biteGain(s, stageIndex) * times * mult, coin = biteCoin(s, stageIndex) * times;
  s.weight += kg; s.coins += coin; s.bites += times;
  return { kg, coin };
}
// 클릭 한 번 = 한 입. 쟁반이 비었으면 못 먹는다 (드론이 있으면 알아서 사 온다).
export function bite(s) {
  if (s.plate <= 0) {
    if (!s.up.drone) return null;
    fillPlate(s, bestStage(s));
  }
  s.plate -= 1;
  const r = gain(s, s.plateStage, 1, s.plateMult || 1);
  if (s.plate <= 0) { s.plateMult = 1; s.plateName = ''; s.plateModel = ''; if (s.up.drone) fillPlate(s, bestStage(s)); }
  return r;
}
// 로봇은 쟁반과 상관없이 지금 레벨 음식을 먹여 준다.
export function robotBites(s, times) {
  return times > 0 ? gain(s, bestStage(s), times) : null;
}

export function levelProgress(s) {
  if (allDone(s)) return 1;
  const st = STAGES[s.stage], prev = s.stage ? STAGES[s.stage - 1].target : START_WEIGHT;
  return Math.max(0, Math.min(1, (s.weight - prev) / (st.target - prev)));
}
export const canLevelUp = (s) => !allDone(s) && s.weight >= STAGES[s.stage].target;
// 저울에서 E. 10레벨을 깨면 그 월드 기록을 세운다.
export function levelUp(s) {
  if (!canLevelUp(s)) return null;
  const done = STAGES[s.stage];
  s.stage += 1;
  const bonus = done.coin * 30;
  s.coins += bonus;
  let worldClear = 0;
  if (done.level === 10) { s.cleared[done.world - 1] = true; worldClear = done.world; }
  return { done, bonus, worldClear, next: allDone(s) ? null : STAGES[s.stage] };
}
export const canEnterWorld = (s, w) => Number.isInteger(w) && w >= 1 && w <= WORLDS.length && (w === 1 || !!s.cleared[w - 2]);

export const upgradeCost = (s, id) => {
  const u = UP[id];
  return s.up[id] >= u.max ? Infinity : Math.round(u.base * Math.pow(u.grow, s.up[id]));
};
export function buyUpgrade(s, id) {
  const cost = upgradeCost(s, id);
  if (!(s.coins >= cost)) return false;
  s.coins -= cost; s.up[id] += 1;
  return true;
}
export function buySkin(s, id) {
  const k = SKINS.find((x) => x.id === id);
  if (!k) return false;
  if (!s.skins.includes(id)) {
    if (s.coins < k.cost) return false;
    s.coins -= k.cost; s.skins.push(id);
  }
  s.skin = id;
  return true;
}

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const rewardScale = (s) => 1 + Math.min(s.stage, STAGES.length - 1);
export const dailyReady = (s, today) => s.daily.last !== today;
export function dailyAmount(s, today, yesterday) {
  const streak = s.daily.last === yesterday ? s.daily.streak : 0;
  return { day: (streak % 7) + 1, coin: DAILY[streak % 7] * rewardScale(s) };
}
export function claimDaily(s, today, yesterday) {
  if (!dailyReady(s, today)) return 0;
  const { coin } = dailyAmount(s, today, yesterday);
  s.daily = { last: today, streak: (s.daily.last === yesterday ? s.daily.streak : 0) + 1 };
  s.coins += coin;
  return coin;
}
export function tickTime(s, today, dt) {
  if (s.time.day !== today) s.time = { day: today, sec: 0, got: [] };
  s.time.sec += dt;
}
export const timeRewardCoin = (s, i) => TIME_REWARDS[i].coin * rewardScale(s);
export const timeRewardReady = (s, i) => !s.time.got.includes(i) && s.time.sec >= TIME_REWARDS[i].min * 60;
export function claimTime(s, i) {
  if (!timeRewardReady(s, i)) return 0;
  const coin = timeRewardCoin(s, i);
  s.time.got.push(i); s.coins += coin;
  return coin;
}
export const anyTimeReady = (s) => TIME_REWARDS.some((_, i) => timeRewardReady(s, i));

// 몸이 얼마나 뚱뚱해 보이는지 (1 = 처음, 약 5.4 = 세계 기록, 약 7 = 우주 기록)
export const fatScale = (w) => { const L = Math.log10(Math.max(w, START_WEIGHT) / START_WEIGHT); return 1 + 0.5 * Math.min(L, 9) + 0.12 * Math.max(0, L - 9); };

const BIG = [[1e20, '해'], [1e16, '경'], [1e12, '조'], [1e8, '억'], [1e4, '만']];
const bigNum = (n) => { for (const [v, name] of BIG) if (n >= v) { const x = n / v; return `${x < 100 ? x.toFixed(1) : Math.round(x).toLocaleString('ko-KR')}${name}`; } return null; };
export function fmtKg(w) {
  if (w < 100) return `${(Math.round(w * 10) / 10).toFixed(1)}kg`;
  if (w < 1000) return `${Math.round(w)}kg`;
  const t = w / 1000, b = bigNum(t);
  if (b) return `${b} 톤`;
  return `${t < 100 ? t.toFixed(1) : Math.round(t).toLocaleString('ko-KR')}톤`;
}
export function fmtNum(n) {
  n = Math.floor(n);
  if (n < 10000) return n.toLocaleString('ko-KR');
  if (n < 1e8) return `${(n / 1e4).toFixed(n < 1e5 ? 2 : 1)}만`;
  if (n < 1e12) return `${(n / 1e8).toFixed(2)}억`;
  if (n < 1e16) return `${(n / 1e12).toFixed(2)}조`;
  return `${(n / 1e16).toFixed(2)}경`;
}

// ── 발전과제 ──
const upSum = (s) => UPGRADES.reduce((n, u) => n + s.up[u.id], 0);
export const ADVANCEMENTS = [
  { id: 'bite1', emoji: '😋', name: '첫 한 입', desc: '음식을 한 입 먹기', coin: 20, ok: (s) => s.bites >= 1 },
  { id: 'bite100', emoji: '🍴', name: '냠냠 100번', desc: '100번 먹기', coin: 100, ok: (s) => s.bites >= 100 },
  { id: 'bite1000', emoji: '🥄', name: '냠냠 1000번', desc: '1000번 먹기', coin: 1000, ok: (s) => s.bites >= 1000 },
  { id: 'bite10000', emoji: '👑', name: '먹방의 신', desc: '10000번 먹기', coin: 50000, ok: (s) => s.bites >= 10000 },
  { id: 'kg50', emoji: '⚖️', name: '통통해졌다', desc: '몸무게 50kg 넘기', coin: 50, ok: (s) => s.weight >= 50 },
  { id: 'ton1', emoji: '🐘', name: '코끼리만큼', desc: '몸무게 1톤 넘기', coin: 500, ok: (s) => s.weight >= 1000 },
  { id: 'ton100', emoji: '🐋', name: '고래만큼', desc: '몸무게 100톤 넘기', coin: 5000, ok: (s) => s.weight >= 1e5 },
  { id: 'ton1man', emoji: '🏔️', name: '산만큼', desc: '몸무게 1만 톤 넘기', coin: 100000, ok: (s) => s.weight >= 1e7 },
  { id: 'level2', emoji: '🍊', name: '첫 레벨 업', desc: '저울에서 레벨 올리기', coin: 50, ok: (s) => s.stage >= 1 },
  { id: 'level5', emoji: '🍗', name: '치킨이다!', desc: '월드 1의 5레벨 되기', coin: 300, ok: (s) => s.stage >= 4 },
  { id: 'level10', emoji: '🍲', name: '마라탕 100판 도전', desc: '월드 1의 10레벨 되기', coin: 3000, ok: (s) => s.stage >= 9 },
  { id: 'korea', emoji: '🇰🇷', name: '한국 기록', desc: '월드 1을 끝까지 깨기', coin: 10000, ok: (s) => s.cleared[0] },
  { id: 'night', emoji: '🌙', name: '별빛 야시장', desc: '월드 2에 가 보기', coin: 5000, ok: (s) => s.world === 2 },
  { id: 'world', emoji: '🏆', name: '기네스북에 오르다', desc: '세계 기록 세우기', coin: 1000000, ok: (s) => s.cleared[1] },
  { id: 'ice', emoji: '❄️', name: '눈꽃 얼음 나라', desc: '월드 3에 가 보기', coin: 5e7, ok: (s) => s.world === 3 },
  { id: 'solar', emoji: '🪐', name: '태양계 기록', desc: '월드 3을 끝까지 깨기', coin: 5e8, ok: (s) => s.cleared[2] },
  { id: 'space', emoji: '🚀', name: '우주 정거장', desc: '월드 4에 가 보기', coin: 5e9, ok: (s) => s.world === 4 },
  { id: 'galaxy', emoji: '🌌', name: '은하 기록', desc: '월드 4를 끝까지 깨기', coin: 5e10, ok: (s) => s.cleared[3] },
  { id: 'cloud', emoji: '👑', name: '황금 구름 궁전', desc: '월드 5에 가 보기', coin: 5e11, ok: (s) => s.world === 5 },
  { id: 'universe', emoji: '🌍', name: '온 우주에서 제일', desc: '월드 5를 끝까지 깨기', coin: 5e12, ok: (s) => s.cleared[4] },
  { id: 'up1', emoji: '🛒', name: '첫 업그레이드', desc: '업그레이드 하나 사기', coin: 50, ok: (s) => upSum(s) >= 1 },
  { id: 'up30', emoji: '💪', name: '업그레이드 부자', desc: '업그레이드 30번 사기', coin: 20000, ok: (s) => upSum(s) >= 30 },
  { id: 'robot', emoji: '🤖', name: '로봇 친구', desc: '먹여 주는 로봇 사기', coin: 200, ok: (s) => s.up.robot >= 1 },
  { id: 'robot8', emoji: '🦾', name: '로봇 군단', desc: '로봇 8대 모으기', coin: 30000, ok: (s) => s.up.robot >= 8 },
  { id: 'drone', emoji: '🛸', name: '배달 왔어요', desc: '배달 드론 사기', coin: 1000, ok: (s) => s.up.drone >= 1 },
  { id: 'skin', emoji: '👕', name: '새 옷', desc: '스킨 하나 사기', coin: 200, ok: (s) => s.skins.length >= 2 },
  { id: 'skins', emoji: '🌈', name: '옷장 가득', desc: '스킨을 전부 모으기', coin: 500000, ok: (s) => s.skins.length >= SKINS.length },
  { id: 'daily', emoji: '🎁', name: '선물이다', desc: '일일 보상 받기', coin: 100, ok: (s) => s.daily.streak >= 1 },
  { id: 'daily7', emoji: '📅', name: '매일매일', desc: '7일 연속으로 일일 보상 받기', coin: 20000, ok: (s) => s.daily.streak >= 7 },
  { id: 'jump', emoji: '🦘', name: '폴짝', desc: '스페이스바로 점프하기', coin: 20, ok: (s) => s.jumps >= 1 },
  { id: 'jump2', emoji: '🤸', name: '트램폴린 선수', desc: '점프력 2.0 만들기', coin: 2000, ok: (s) => s.jump >= 2 },
  { id: 'jumpmap1', emoji: '🚩', name: '점프맵 첫 깃발', desc: '점프맵 1구간 깨기', coin: 500, ok: (s) => s.jumpTop >= 1 },
  { id: 'jumpmap', emoji: '🏔️', name: '점프맵 꼭대기', desc: '점프맵을 끝까지 오르기', coin: 500000, ok: (s) => s.jumpTop >= JUMP_SECTIONS.length },
  { id: 'cook', emoji: '🍳', name: '첫 요리', desc: '우리 집 부엌에서 요리하기', coin: 100, ok: (s) => s.cooked >= 1 },
  { id: 'weird', emoji: '🤢', name: '괴식 요리사', desc: '초콜렛을 이상한 재료와 섞기', coin: 300, ok: (s) => s.weird },
  { id: 'legend', emoji: '🌟', name: '전설의 잡탕', desc: '재료 네 가지를 전부 넣기', coin: 5000, ok: (s) => s.legend },
  { id: 'video', emoji: '🎬', name: '첫 먹방 동영상', desc: '먹방 동영상 찍기', coin: 200, ok: (s) => s.videos >= 1 },
  { id: 'subs', emoji: '📢', name: '구독자 1000명', desc: '구독자 1000명 모으기', coin: 30000, ok: (s) => s.subs >= 1000 },
  { id: 'gym', emoji: '🏃', name: '운동 시작', desc: '운동해서 살 빼기', coin: 100, ok: (s) => s.reps >= 1 },
  { id: 'gym100', emoji: '💦', name: '땀 뻘뻘', desc: '운동 100번 하기', coin: 5000, ok: (s) => s.reps >= 100 },
  { id: 'home', emoji: '🏠', name: '우리 집', desc: '우리 집에 들어가 보기', coin: 50, ok: (s) => s.home },
  { id: 'friend', emoji: '👫', name: '같이 먹자', desc: '친구와 같은 방에서 먹기', coin: 500, ok: (s) => s.friend },
];
// 새로 이룬 발전과제를 돌려준다 (보상 코인도 준다)
export function checkAdvancements(s) {
  const got = [];
  for (const a of ADVANCEMENTS) if (!s.adv.includes(a.id) && a.ok(s)) { s.adv.push(a.id); s.coins += a.coin; got.push(a); }
  return got;
}

// ── 같이 하기 (방 코드) ──
export const GAME = 'fat-tycoon';
export const MAX_PLAYERS = 4;
export const FRIEND_BONUS = 0.2; // 친구와 같이 먹으면 코인을 20% 더 받는다
// 친구가 보낸 상태. 숫자만 받고, 이상한 값은 버리거나 범위 안으로 맞춘다.
export function cleanPeer(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.p) || d.p.length < 3 || d.p.length > 4 || !d.p.every(Number.isFinite)) return null;
  const n = (v, lo, hi, def) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def);
  return {
    x: n(d.p[0], -30, 30, 0), z: n(d.p[1], -30, 30, 0), f: n(d.p[2], -10, 10, 0),
    weight: n(d.w, START_WEIGHT, 1e30, START_WEIGHT), world: Math.floor(n(d.wd, 0, WORLDS.length + 1, 1)), y: n(d.p[3] ?? 0, -40, 200, 0), girl: d.g === 1, dish: Number.isInteger(d.ds) && d.ds >= 0 && d.ds < DISHES.length ? d.ds : -1,
    skin: Math.floor(n(d.sk, 0, SKINS.length - 1, 0)), food: Math.floor(n(d.fd, -1, STAGES.length - 1, -1)),
    bites: Math.floor(n(d.n, 0, 1e12, 0)), moving: d.m === 1, stage: Math.floor(n(d.st, 0, STAGES.length, 0)),
  };
}
export const peerNumber = (id) => { const n = parseInt(String(id).replace(/\D/g, ''), 10); return Number.isFinite(n) && n > 0 ? n : 0; };

// ── 로그인과 클라우드 저장 ──
// 아직 아무것도 안 한 저장인가 (그러면 묻지 않고 서버 기록을 불러온다)
export const cloudFresh = (s) => !s || (s.stage === 0 && s.bites < 20 && s.coins < 50 && UPGRADES.every((u) => !s.up?.[u.id]) && (s.skins?.length ?? 1) <= 1);
// 사람이 신경 쓰는 진행이 같은가
export const cloudSame = (a, b) => { const pick = (s) => JSON.stringify([s?.stage, Math.round(s?.weight ?? 0), s?.coins, s?.up, s?.skins, s?.skin, s?.adv?.length, s?.cleared]); return pick(a) === pick(b); };
export function cloudSummary(s, updated) {
  const f = fixSave(s), t = updated ? new Date(updated) : null;
  const when = t && !Number.isNaN(t.getTime()) ? ` · ${t.getMonth() + 1}/${t.getDate()} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')} 저장` : '';
  const st = stageOf(f);
  return `몸무게 ${fmtKg(f.weight)} · ${allDone(f) ? '우주 기록 달성' : `월드 ${st.world} ${st.level}레벨`} · ${fmtNum(f.coins)}코인 · 발전과제 ${f.adv.length}개${when}`;
}

// ── 계획 2: 점프, 트램폴린, 점프맵 ──
export const JUMP_MAX = 5;
export const JUMP_STEP = 0.02; // 트램폴린에서 한 번 튈 때마다 오르는 점프력
export const HOME_PLACE = 0;   // 같이 하기에서 보내는 곳 번호: 0 우리 집, 1~5 월드, 6 점프맵
export const JUMP_PLACE = WORLDS.length + 1;
export function trainJump(s) { const before = s.jump; s.jump = Math.min(JUMP_MAX, Math.round((s.jump + JUMP_STEP) * 100) / 100); return s.jump > before; }
// 뚱뚱할수록 조금 낮게 뛴다 (운동해서 살을 빼면 더 높이 뛴다)
export const jumpVelocity = (s) => (7.5 * Math.sqrt(s.jump)) / (1 + 0.06 * (fatScale(s.weight) - 1));
export const jumpHeight = (s, gravity = 22) => jumpVelocity(s) ** 2 / (2 * gravity);
export const JUMP_SECTIONS = [
  { rise: 0.6, need: 1.0, steps: 8 }, { rise: 1.4, need: 1.3, steps: 8 }, { rise: 2.0, need: 1.9, steps: 8 }, { rise: 2.9, need: 2.6, steps: 8 }, { rise: 3.9, need: 3.5, steps: 8 },
];
// 점프맵 깃발에 처음 닿으면 코인을 준다 (idx 1~5)
export function jumpReward(s, idx) {
  if (!(idx > s.jumpTop) || idx > JUMP_SECTIONS.length) return 0;
  s.jumpTop = idx;
  const coin = STAGES[bestStage(s)].coin * 400 * idx; s.coins += coin;
  return coin;
}

// ── 계획 2: 요리 (재료: 토마토, 고기, 양파, 초콜렛) ──
export const INGREDIENTS = [
  { id: 'tomato', name: '토마토', emoji: '🍅', k: 1, g: 0.25 },
  { id: 'meat', name: '고기', emoji: '🥩', k: 2, g: 0.5 },
  { id: 'onion', name: '양파', emoji: '🧅', k: 1, g: 0.2 },
  { id: 'choco', name: '초콜렛', emoji: '🍫', k: 3, g: 0.6 },
];
export const INGREDIENT_MAX = 3;
export const DISH_BITES = 12;
export const DISHES = [
  { name: '토마토 주스', emoji: '🍅', model: 'dish-juice' }, { name: '스테이크', emoji: '🥩', model: 'steak' }, { name: '양파링', emoji: '🧅', model: 'dish-rings' },
  { name: '초콜렛 케이크', emoji: '🍫', model: 'dish-choco' }, { name: '미트볼 스파게티', emoji: '🍝', model: 'dish-spaghetti' }, { name: '불고기', emoji: '🍖', model: 'samgyeopsal' },
  { name: '살사 샐러드', emoji: '🥗', model: 'dish-salsa' }, { name: '수제 햄버거', emoji: '🍔', model: 'burger' }, { name: '초코 괴식', emoji: '🤢', model: 'dish-weird' }, { name: '전설의 잡탕', emoji: '🌟', model: 'dish-legend' },
];
const dish = (name) => DISHES.find((d) => d.name === name);
export const ingredientPrice = (s, id) => Math.round(STAGES[bestStage(s)].coin * 6 * INGREDIENTS.find((x) => x.id === id).k);
const cleanCounts = (c) => Object.fromEntries(INGREDIENTS.map((x) => [x.id, Math.max(0, Math.min(INGREDIENT_MAX, Math.floor(Number(c?.[x.id]) || 0)))]));
// 재료 개수로 무슨 요리가 되는지 정한다. mult 는 한 입에 찌는 몸무게 배수.
export function recipe(counts) {
  const c = cleanCounts(counts), total = INGREDIENTS.reduce((n, x) => n + c[x.id], 0);
  if (!total) return null;
  const base = 1 + INGREDIENTS.reduce((n, x) => n + x.g * c[x.id], 0), T = c.tomato > 0, M = c.meat > 0, O = c.onion > 0, Ch = c.choco > 0, savory = T || M || O;
  let name, mult = base, note = '';
  if (T && M && O && Ch) { name = '전설의 잡탕'; mult = base * 2; note = '네 가지를 다 넣었더니 전설의 맛!'; }
  else if (Ch && savory) { name = '초코 괴식'; mult = base * 0.5; note = '으악, 초콜렛이랑 섞었더니 맛이 이상해!'; }
  else if (Ch) name = '초콜렛 케이크';
  else if (T && M && O) { name = '수제 햄버거'; mult = base + 1; note = '토마토, 고기, 양파가 딱 맞아!'; }
  else if (T && M) name = '미트볼 스파게티';
  else if (M && O) name = '불고기';
  else if (T && O) name = '살사 샐러드';
  else if (T) name = '토마토 주스';
  else if (M) name = '스테이크';
  else name = '양파링';
  return { ...dish(name), mult: Math.round(mult * 100) / 100, note, counts: c };
}
export const cookPrice = (s, counts) => { const c = cleanCounts(counts); return INGREDIENTS.reduce((n, x) => n + ingredientPrice(s, x.id) * c[x.id], 0); };
// 요리해서 쟁반에 올린다. 돈이 모자라거나 재료가 없으면 null.
export function cook(s, counts) {
  const r = recipe(counts), price = cookPrice(s, counts);
  if (!r || s.coins < price) return null;
  s.coins -= price; s.plate = DISH_BITES; s.plateStage = bestStage(s); s.plateMult = r.mult; s.plateName = r.name; s.plateModel = r.model;
  s.cooked += 1; if (r.name === '초코 괴식') s.weird = true; if (r.name === '전설의 잡탕') s.legend = true;
  return { ...r, price };
}

// ── 계획 2: 먹방 동영상 ──
export const VIDEO_SEC = 20;
export const VIDEO_COOL = 30;
// 찍는 동안 먹은 횟수만큼 돈을 번다. 구독자가 많을수록 조회수가 많다.
export function videoPay(s, bites) {
  bites = Math.max(0, Math.floor(bites));
  s.videos += 1;
  if (!bites) return { coin: 0, views: 0, subs: 0 };
  const views = Math.round(bites * (12 + s.subs * 0.05)), coin = Math.round(bites * biteCoin(s, bestStage(s)) * 2), subs = Math.max(1, Math.round(bites / 2));
  s.coins += coin; s.subs += subs;
  return { coin, views, subs };
}

// ── 계획 2: 운동해서 살 빼기 ──
export function exercise(s) {
  const loss = Math.min(s.weight - START_WEIGHT, Math.max(0.1, s.weight * 0.01));
  s.reps += 1;
  if (loss <= 0) return 0;
  s.weight -= loss;
  return loss;
}

// ── 계획 2: 날씨 (1시간마다 바뀐다. 모두 같은 날씨를 본다) ──
export const WEATHERS = [
  { id: 'sunny', name: '맑음', emoji: '☀️' }, { id: 'cloudy', name: '구름', emoji: '⛅' }, { id: 'rain', name: '비', emoji: '🌧️' },
  { id: 'snow', name: '눈', emoji: '🌨️' }, { id: 'fog', name: '안개', emoji: '🌫️' }, { id: 'rainbow', name: '무지개', emoji: '🌈' },
];
const hourPick = (h) => { let x = Math.imul(h | 0, 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return (x >>> 0) % WEATHERS.length; };
// 하루(24시간) 묶음마다 첫 시간을 정하고, 그 뒤로는 앞 시간과 다른 날씨로 1~5칸씩 넘긴다.
// 마지막 시간은 앞 시간과도, 다음 날 첫 시간과도 다르게 고른다. 그래서 언제나 1시간마다 바뀐다.
export function weatherIndex(hour) {
  const N = WEATHERS.length, day = Math.floor(hour / 24), start = day * 24, k = hour - start;
  let w = hourPick(day * 31 + 7);
  for (let i = 1; i <= Math.min(k, 22); i += 1) w = (w + 1 + (hourPick(start + i) % (N - 1))) % N;
  if (k < 23) return w;
  const next = hourPick((day + 1) * 31 + 7);
  let v = hourPick(hour);
  while (v === w || v === next) v = (v + 1) % N;
  return v;
}
export const hourOf = (ms) => Math.floor(ms / 3600000);
export const weatherAt = (ms) => WEATHERS[weatherIndex(hourOf(ms))];
export const minutesToNextWeather = (ms) => Math.ceil((3600000 - (ms % 3600000)) / 60000);
