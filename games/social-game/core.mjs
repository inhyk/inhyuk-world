// Pure game rules (no three.js, no DOM) so they can be unit-tested with node --test.

export const DAY_NAMES = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];

/** What kind of day is day n (1-based)? Day 1 is a Monday. */
export function dayKind(n) {
  const w = (n - 1) % 7; // 0 Mon .. 6 Sun
  if (w === 5 || w === 6) return 'trip';     // 주말: 바다 여행
  if (w === 2) return 'dinner';              // 수요일: 회식
  if (w === 3) return 'visit';               // 목요일: 다른 회사 출장
  return 'work';
}
export const weekday = (n) => DAY_NAMES[(n - 1) % 7];

/** Quest steps for a day. Each step: {id, label, target (site/interactable), text (quest card line)}. */
export function stepsFor(kind) {
  const morning = [
    { id: 'wake', label: '일어나기', text: '일어나세요! 오늘도 좋은 아침', target: 'home:bed', auto: true },
    { id: 'sink', label: '세수하기', text: '욕실에서 세수하세요', target: 'home:sink' },
    { id: 'breakfast', label: '아침 먹기', text: '식탁에서 아침을 먹어요', target: 'home:breakfast' },
    { id: 'wardrobe', label: '옷 입기', text: '옷장에서 옷을 입어요', target: 'home:wardrobe' },
  ];
  const evening = [
    { id: 'gohome', label: '집에 가기', text: '집으로 가세요', target: 'home:door' },
    { id: 'shower', label: '씻기', text: '욕실에서 씻어요', target: 'home:shower' },
    { id: 'sleep', label: '잠자기', text: '침대에서 자요. 내일 또 만나요!', target: 'home:bed' },
  ];
  if (kind === 'trip') {
    return [
      { id: 'wake', label: '일어나기', text: '주말이다! 오늘은 바다로 여행 가는 날', target: 'home:bed', auto: true },
      { id: 'wardrobe', label: '여행 옷 입기', text: '옷장에서 여행 옷을 입어요', target: 'home:wardrobe' },
      { id: 'drive-beach', label: '차 타고 바다 가기', text: '차 타고 바다로 가세요 (서쪽 끝)', target: 'beach:arrive' },
      { id: 'photo', label: '바다 사진 찍기', text: '바다 앞에서 사진을 찍어요 (P)', target: 'beach:photo' },
      { id: 'shells', label: '조개 5개 줍기', text: '모래밭에서 조개를 5개 주워요 (왼쪽 클릭)', target: 'beach:shells', count: 5 },
      { id: 'pension', label: '펜션에서 자기', text: '바다 펜션에서 자요', target: 'pension:hotelBed' },
    ];
  }
  const work = kind === 'visit'
    ? [
      { id: 'drive-visit', label: '별빛테크로 출장 가기', text: '오늘은 출장! 차 타고 별빛테크로 가세요', target: 'other:door' },
      { id: 'meeting', label: '회의하기', text: '회의실에서 발표해요', target: 'other:meeting' },
      { id: 'drive-work', label: '회사로 돌아가기', text: '회사로 돌아가세요', target: 'office:door' },
      { id: 'work', label: '일하기', text: '내 자리에 앉아서 남은 일을 해요', target: 'office:desk', tasks: 2 },
    ]
    : [
      { id: 'drive-work', label: '차 타고 회사 가기', text: '회사로 가세요', target: 'office:door' },
      { id: 'work', label: '일하기 (오전)', text: '내 자리에 앉아서 일해요', target: 'office:desk', tasks: 2 },
      { id: 'lunch', label: '점심 먹기', text: '점심시간! 구내식당에서 밥 먹어요', target: 'office:lunch' },
      { id: 'work2', label: '일하기 (오후)', text: '오후 일도 해요', target: 'office:desk', tasks: 2 },
    ];
  const dinner = kind === 'dinner'
    ? [{ id: 'dinner', label: '회식하기', text: '오늘은 회식! 고깃집으로 가세요', target: 'restaurant:grill' }]
    : [];
  return [...morning, ...work, ...dinner, ...evening];
}

/** Clock time each step sets when it is finished (time skips), or null to let time flow. */
export const STEP_TIME = {
  wake: 7.0, 'drive-work': 9.0, work: 12.0, lunch: 13.0, work2: 18.0, meeting: 15.0, dinner: 21.0,
  shower: 22.0, 'drive-beach': 11.0, photo: 15.0, shells: 18.6,
};

export function newState() {
  return {
    day: 1, hour: 6.9, money: 30000, hp: 100, food: 70,
    step: 0, done: [], outfit: 'pajama', counts: {},
    inventory: { stone: 12, log: 8, brick: 12, glass: 6, turf: 8, plank: 8, pot: 3, lamp: 2, flower: 4 },
    placed: [], // [{id, x, y, z, rot}]
    broken: [], // ids of world props already broken
  };
}

/** Hunger drops over time (faster when running); empty stomach hurts, a full one heals. */
export function tickBody(s, dt, { running = false, sleeping = false } = {}) {
  const drain = sleeping ? 0 : running ? 0.2 : 0.11;
  s.food = Math.max(0, s.food - dt * drain);
  if (s.food <= 0) s.hp = Math.max(0, s.hp - dt * 0.7);
  else if (s.food >= 60) s.hp = Math.min(100, s.hp + dt * 0.35);
  return s;
}
export function eat(s, amount) { s.food = Math.min(100, s.food + amount); return s; }
export function hurt(s, amount) { s.hp = Math.max(0, s.hp - amount); return s.hp <= 0; }

/** Fall damage in hp for a fall of h metres (Minecraft-like: free up to 3.5 m). */
export const fallDamage = (h) => (h <= 3.5 ? 0 : Math.round((h - 3.5) * 9));

export const WAGE = 50000;
export const SNACK_PRICE = 2000;

/** Snap a point to the 1 m block grid: cell centre x/z and bottom y. */
export function snapCell(x, y, z) {
  return { x: Math.floor(x) + 0.5, y: Math.floor(y + 1e-6), z: Math.floor(z) + 0.5 };
}

export function formatClock(hour) {
  const h24 = Math.floor(((hour % 24) + 24) % 24), m = Math.floor((((hour % 1) + 1) % 1) * 60);
  return `${h24 < 12 ? '오전' : '오후'} ${((h24 + 11) % 12) + 1}:${String(m).padStart(2, '0')}`;
}

/** Work app tasks: deterministic per day/task so tests can check them. */
const WORDS = ['보고서', '회의 자료', '고객 메일', '일정표', '예산안', '발표 준비', '계약서', '신제품', '홍보 영상', '디자인 시안', '주간 회의', '출장 계획'];
export function workTask(day, n) {
  const kind = ['type', 'sort', 'mail', 'stamp'][(day + n) % 4];
  const w = WORDS[(day * 3 + n * 5) % WORDS.length];
  if (kind === 'type') return { kind, title: '문서 쓰기', prompt: `아래 글자를 똑같이 쳐요: “${w} 완료”`, answer: `${w} 완료` };
  if (kind === 'sort') {
    const nums = [];
    let a = (day * 7 + n * 13) % 9 + 1;
    for (let i = 0; i < 6; i++) { nums.push(((a + i * 4) % 9) + 1); }
    const uniq = [...new Set(nums)].slice(0, 5);
    return { kind, title: '숫자 정리', prompt: '작은 숫자부터 차례로 눌러요', nums: uniq, answer: [...uniq].sort((x, y) => x - y) };
  }
  if (kind === 'mail') {
    const mails = [
      { q: '“내일 회의 몇 시에 할까요?”', options: ['오전 10시 어때요?', '저는 고양이를 좋아해요', '바나나 3개 주세요'], answer: 0 },
      { q: '“보고서 다 됐나요?”', options: ['오늘 날씨가 맑아요', '네, 방금 보냈어요!', '라면 먹고 싶다'], answer: 1 },
      { q: '“새 제품 이름 좋은 거 있어요?”', options: ['몰라요 잘래요', '“반짝이 3000” 어때요?', '내 차 파란색이에요'], answer: 1 },
      { q: '“점심 같이 먹을래요?”', options: ['좋아요! 12시에 만나요', '키보드가 고장났어요', '어제 꿈을 꿨어요'], answer: 0 },
    ];
    const m = mails[(day + n) % mails.length];
    return { kind, title: '메일 답장', prompt: m.q, options: m.options, answer: m.answer };
  }
  const docs = [
    { name: '회의록', ok: true }, { name: '낙서한 종이', ok: false }, { name: '견적서', ok: true },
    { name: '고양이 그림', ok: false }, { name: '계약서', ok: true }, { name: '과자 포장지', ok: false },
  ];
  // four different papers, always at least one real one and one fake one
  const start = (day * 5 + n * 3) % docs.length;
  const pick = [0, 1, 2, 3].map((i) => docs[(start + i) % docs.length]);
  return { kind, title: '도장 찍기', prompt: '진짜 서류에만 도장을 찍어요', docs: pick, answer: pick.map((d) => d.ok) };
}

export function checkWork(task, reply) {
  if (task.kind === 'type') return String(reply).replace(/\s+/g, ' ').trim() === task.answer;
  if (task.kind === 'sort') return JSON.stringify(reply) === JSON.stringify(task.answer);
  if (task.kind === 'mail') return reply === task.answer;
  if (task.kind === 'stamp') return JSON.stringify(reply) === JSON.stringify(task.answer);
  return false;
}

/** Meat on the grill: 0 raw → 1 cooked (6 s) → burnt after 12 s per side-ish. */
export function meatState(t) { return t < 5 ? 'raw' : t < 11 ? 'cooked' : 'burnt'; }

/** Save/load (localStorage string). */
export function serialize(s) { return JSON.stringify({ v: 1, ...s }); }
export function deserialize(str) {
  try {
    const o = JSON.parse(str);
    if (!o || o.v !== 1) return null;
    const base = newState();
    return { ...base, ...o, inventory: { ...base.inventory, ...o.inventory } };
  } catch { return null; }
}
