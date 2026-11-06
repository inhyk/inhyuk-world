// Pure game rules (no three.js, no DOM) so they can be unit-tested with node --test.
import { JOBS, jobWork } from './jobs.mjs';
import { isShowDay, SHOW_HOUR } from './show-days.mjs';

export const DAY_NAMES = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];

/** What kind of day is day n (1-based)? Day 1 is a Monday. */
export function dayKind(n) {
  const w = (n - 1) % 7; // 0 Mon .. 6 Sun
  if (w === 5) return 'trip';                // 토요일: 일본 여행 첫째 날
  if (w === 6) return 'trip2';               // 일요일: 일본 여행 둘째 날, 집으로
  if (w === 2) return 'dinner';              // 수요일: 회식
  if (w === 3) return 'visit';               // 목요일: 다른 회사 출장
  return 'work';
}
export const weekday = (n) => DAY_NAMES[(n - 1) % 7];

/** Plane ticket price (인혁: "비행기표는 1000000원으로 해줘") and the daily wage. */
export const TICKET = 1000000;

/**
 * The plan for a day, decided once in the morning so the steps never shift during the day.
 * Office story: weekends are a Japan trip only when the ticket money is saved; otherwise a rest day.
 */
export function planDay(s, { hasLicenseCenter = true, hasPlaza = false } = {}) {
  // 분수 공연 (fountain show) on show days, only once the plaza is in the town
  const show = hasPlaza && isShowDay(s.day);
  if (s.mode === 'kid') {
    const w = (s.day - 1) % 7;
    const kind = w >= 5 ? 'kidRest' : 'school';
    // 어린이 이야기: day 2 the child gets hurt at school; from day 3 a licence and the car to school
    return { day: s.day, kind, needLicense: hasLicenseCenter && !!s.hurt && !s.license, hurtToday: s.day === 2 && !s.hurt, drive: !!s.license, show: show && kind === 'school' };
  }
  const job = s.mode === 'job' && JOBS[s.job] ? s.job : null;
  let kind = dayKind(s.day);
  // jobs: every weekday is a work day at the job's own workplace; the weekend is the same as 직장인
  if (job && kind !== 'trip' && kind !== 'trip2') kind = 'job';
  if (kind === 'trip' && !(s.ticket || (s.money ?? 0) >= TICKET)) kind = 'rest';
  if (kind === 'trip2' && s.wakeAt !== 'ryokan') kind = 'rest';
  const needLicense = hasLicenseCenter && !s.license && kind !== 'trip2';
  return { day: s.day, kind, needLicense, ...(job ? { job } : {}), show: show && (kind === 'work' || kind === 'job') };
}

/** 분수 공연 보기: a real step after work (adults) or after the academy (kid) on show days. */
const SHOW_STEP = { id: 'show', label: '분수 공연 보기', text: '오늘은 금요일! 저녁 7시에 분수 광장에서 분수 공연을 해요 ⛲', target: 'plaza:show', at: SHOW_HOUR };

/** Quest steps for a day. Each step: {id, label, target (site/interactable), text (quest card line)}. */
/** Child weekdays: school, then (his order) rest, 태권도, right away 피아노, rest an hour, 영어, home. */
function kidSteps(kind, { needLicense = false, hurtToday = false, drive = false, show = false } = {}) {
  const morning = [
    { id: 'wake', label: '일어나기', text: '엄마: “일어나야지~ 학교 가자!”', target: 'home:bed', auto: true },
    { id: 'sink', label: '세수하기', text: '욕실에서 세수하세요', target: 'home:sink' },
    { id: 'breakfast', label: '아침 먹기', text: '엄마가 차려 준 아침을 먹어요', target: 'home:breakfast' },
    { id: 'wardrobe', label: '옷 입고 가방 메기', text: '옷장에서 옷을 입고 책가방을 메요', target: 'home:wardrobe' },
  ];
  const evening = [
    { id: 'gohome', label: '집에 가기', text: '집으로 가요 (101동 8층)', target: 'home:door' },
    // dinner at 6 p.m.; on show days it comes right after the 7 p.m. fountain show
    { id: 'dinner', label: '엄마 아빠랑 저녁', text: '엄마 아빠랑 저녁을 먹어요', target: 'home:breakfast', ...(show ? {} : { at: 18 }) },
    { id: 'shower', label: '씻기', text: '욕실에서 씻어요', target: 'home:shower' },
    { id: 'sleep', label: '잠자기', text: '침대에서 자요. 잘 자!', target: 'home:bed', at: 21 },
  ];
  if (kind === 'kidRest') {
    return [
      { id: 'wake', label: '일어나기', text: '주말이다! 학교 안 가는 날', target: 'home:bed', auto: true },
      { id: 'breakfast', label: '아침 먹기', text: '엄마가 차려 준 아침을 먹어요', target: 'home:breakfast' },
      ...(needLicense ? [{ id: 'license', label: '운전면허 따기', text: '면허시험장에서 운전면허 시험을 봐요', target: 'license:license' }] : []),
      { id: 'play', label: '놀이터에서 놀기', text: '학교 운동장에서 신나게 놀아요', target: 'school:door' },
      { id: 'snack', label: '편의점 간식', text: '오후 3시는 간식 시간! 편의점에서 간식을 사 먹어요', target: 'store:shop', at: 15 },
      ...evening.slice(1),
    ];
  }
  const toSchool = needLicense
    ? [
      { id: 'license', label: '운전면허 따기', text: '다리를 다쳐서 걷기 힘들어요… 면허시험장에서 운전면허를 따요! (엄마가 데려다 줘요: E)', target: 'license:license' },
      { id: 'drive-school', label: '차 타고 학교 가기', text: '면허 땄다! 차 타고 학교에 가요', target: 'school:door' },
    ]
    : [{ id: 'go-school', label: drive ? '차 타고 학교 가기' : '학교 가기', text: drive ? '차 타고 학교에 가요 (남쪽 학교길)' : '걸어서 학교에 가요 (남쪽 학교길)', target: 'school:door' }];
  const school = [
    { id: 'class', label: '수업 듣기', text: '1학년 1반 내 자리에 앉아서 수업을 들어요', target: 'school:class', at: 9 },
    ...(hurtToday ? [{ id: 'hurt', label: '체육 시간', text: '체육 시간! 운동장으로 나가요', target: 'school:door', at: 10.5 }] : []),
    { id: 'schoolLunch', label: '급식 먹기', text: '급식실에서 밥을 먹어요', target: 'school:schoolLunch', at: 12 },
  ];
  // rest steps are plain waits: they end `rest` game minutes after they begin (인혁: "기다리고 다음 일을 하게")
  const academy = [
    { id: 'rest1', label: '쉬기', text: '학교 끝! 조금 쉬어요 (간식 먹거나 놀기)', target: 'academy:door', rest: 30 },
    { id: 'taekwondo', label: '태권도', text: '학원 빌딩 2층 반짝 태권도에 가요', target: 'academy:taekwondo' },
    { id: 'piano', label: '피아노', text: '바로 1층 도레미 피아노에 가요', target: 'academy:piano' },
    { id: 'rest2', label: '1시간 쉬기', text: '1시간 쉬어요', target: 'academy:door', rest: 60 },
    { id: 'english', label: '영어', text: '2층 헬로 영어에서 영어 공부해요', target: 'academy:english' },
  ];
  return [...morning, ...toSchool, ...school, ...academy, ...(show ? [SHOW_STEP] : []), ...evening];
}

export function stepsFor(kind, opts = {}) {
  if (kind === 'school' || kind === 'kidRest') return kidSteps(kind, opts);
  const { needLicense = false, show = false } = opts;
  const license = needLicense ? [{ id: 'license', label: '운전면허 따기', text: '운전면허가 없어요! 면허시험장(남쪽 학교길)에서 시험을 봐요', target: 'license:license' }] : [];
  const morning = [
    { id: 'wake', label: '일어나기', text: '일어나세요! 오늘도 좋은 아침', target: 'home:bed', auto: true },
    { id: 'sink', label: '세수하기', text: '욕실에서 세수하세요', target: 'home:sink' },
    { id: 'breakfast', label: '아침 먹기', text: '식탁에서 아침을 먹어요', target: 'home:breakfast' },
    { id: 'wardrobe', label: '옷 입기', text: '옷장에서 옷을 입어요', target: 'home:wardrobe' },
  ];
  const evening = [
    { id: 'gohome', label: '집에 가기', text: '집으로 가세요', target: 'home:door' },
    { id: 'shower', label: '씻기', text: '욕실에서 씻어요', target: 'home:shower' },
    { id: 'sleep', label: '잠자기', text: '침대에서 자요. 내일 또 만나요!', target: 'home:bed', at: 21 },
  ];
  if (kind === 'rest') {
    return [
      { id: 'wake', label: '일어나기', text: '주말이다! 오늘은 쉬는 날', target: 'home:bed', auto: true },
      { id: 'sink', label: '세수하기', text: '욕실에서 세수하세요', target: 'home:sink' },
      { id: 'breakfast', label: '아침 먹기', text: '식탁에서 아침을 먹어요', target: 'home:breakfast' },
      ...license,
      { id: 'snack', label: '편의점 간식', text: '편의점에서 간식을 사 먹어요. 비행기표는 1,000,000원을 모으면 살 수 있어요', target: 'store:shop', at: 15 },
      { id: 'shower', label: '씻기', text: '욕실에서 씻어요', target: 'home:shower', at: 19 },
      { id: 'sleep', label: '잠자기', text: '침대에서 자요', target: 'home:bed', at: 21 },
    ];
  }
  if (kind === 'trip') {
    return [
      { id: 'wake', label: '일어나기', text: '주말이다! 오늘은 일본으로 여행 가는 날 ✈️', target: 'home:bed', auto: true },
      { id: 'wardrobe', label: '여행 옷 입기', text: '옷장에서 여행 옷을 입어요', target: 'home:wardrobe' },
      ...license,
      { id: 'drive-airport', label: '차 타고 공항 가기', text: '차 타고 세온 국제공항으로 가세요 (동쪽 끝)', target: 'airport:door' },
      { id: 'fly-japan', label: '비행기표 사고 일본 가기', text: '탑승구에서 비행기표(1,000,000원)를 사고 비행기를 타요', target: 'airport:board', at: 10 },
      { id: 'photo-jp', label: '신사에서 사진 찍기', text: '빨간 도리이 앞에서 사진을 찍어요 (P)', target: 'shrine:photo' },
      { id: 'ramen', label: '라멘 먹기', text: '점심은 라멘! 라멘 가게에서 라멘을 먹어요', target: 'ramen:ramen', at: 12 },
      { id: 'souvenir', label: '기념품 사기', text: '기념품 가게에서 선물을 사요', target: 'souvenir:souvenir' },
      { id: 'ryokan', label: '료칸에서 자기', text: '료칸(일본 여관)에서 자요', target: 'ryokan:futon', at: 20 },
    ];
  }
  if (kind === 'trip2') {
    return [
      { id: 'wake', label: '일어나기', text: '료칸에서 맞는 아침! 오늘은 집에 가는 날', target: 'ryokan:futon', auto: true },
      { id: 'onsen', label: '온천 하기', text: '료칸 마당의 온천에 들어가요', target: 'ryokan:onsen' },
      { id: 'fly-home', label: '비행기 타고 집에 가기', text: '사쿠라 공항에서 비행기를 타요', target: 'jpAirport:board', at: 10 },
      { id: 'drive-home', label: '차 타고 집에 가기', text: '공항 주차장에서 차를 타고 집으로 가요', target: 'home:door' },
      { id: 'shower', label: '씻기', text: '욕실에서 씻어요', target: 'home:shower', at: 18 },
      { id: 'sleep', label: '잠자기', text: '침대에서 자요. 여행 재밌었다!', target: 'home:bed', at: 21 },
    ];
  }
  const work = kind === 'visit'
    ? [
      { id: 'drive-visit', label: '별빛테크로 출장 가기', text: '오늘은 출장! 차 타고 별빛테크로 가세요', target: 'other:door' },
      { id: 'meeting', label: '회의하기', text: '오전 10시에 회의실에서 발표해요', target: 'other:meeting', at: 10 },
      { id: 'drive-work', label: '회사로 돌아가기', text: '회사로 돌아가세요', target: 'office:door' },
      { id: 'work', label: '일하기', text: '내 자리에 앉아서 남은 일을 해요', target: 'office:desk', tasks: 2, at: 14 },
    ]
    : kind === 'job'
      ? jobWork(opts.job)
      : [
        { id: 'drive-work', label: '차 타고 회사 가기', text: '회사로 가세요', target: 'office:door' },
        { id: 'badge', label: '사원증 찍고 출근', text: '오전 9시 출근! 입구 출입기에 사원증을 찍어요 (삑!)', target: 'office:badge', at: 9 },
        { id: 'coffee', label: '모닝 커피', text: '탕비실에서 커피를 타요 ☕', target: 'office:coffee' },
        { id: 'work', label: '일하기 (오전)', text: '내 자리에 앉아서 일해요', target: 'office:desk', tasks: 2 },
        { id: 'teamMeeting', label: '팀 회의', text: '오전 11시! 회의실에서 팀 회의를 해요', target: 'office:teamMeeting', at: 11 },
        { id: 'lunch', label: '점심 먹기', text: '점심시간! 구내식당에서 밥 먹어요', target: 'office:lunch', at: 12 },
        { id: 'work2', label: '일하기 (오후)', text: '오후 일도 해요', target: 'office:desk', tasks: 2, at: 13 },
        { id: 'print', label: '보고서 출력', text: '프린터에서 보고서를 뽑아요', target: 'office:print' },
        { id: 'boss', label: '부장님 결재', text: '부장님께 보고서 결재를 받아요', target: 'office:boss' },
        { id: 'badge-out', label: '사원증 찍고 퇴근', text: '오후 6시 퇴근! 입구 출입기에 사원증을 찍고 퇴근해요', target: 'office:badge', at: 18 },
      ];
  const dinner = kind === 'dinner'
    ? [{ id: 'dinner', label: '회식하기', text: '오늘은 회식! 고깃집으로 가세요', target: 'restaurant:grill' }]
    : [];
  return [...morning, ...license, ...work, ...dinner, ...(show ? [SHOW_STEP] : []), ...evening];
}

/**
 * Step timing (인혁: "할일 끝나고 다음 일 해야 하는 시간이 바로 되는 게 아니고 기다리고 다음 일을 하게"):
 * the clock never jumps. A step with `at` (clock hour) waits until then; a `rest` step (game minutes) is a plain
 * wait that ends that long after it began (s.restFrom remembers when). Late players can do a step at once.
 */
export const LAST_HOUR = 23.99; // the clock stops here until you sleep
export function stepStart(st, s) {
  if (!st) return null;
  if (st.rest) {
    const from = s.restFrom && s.restFrom.id === st.id && s.restFrom.day === s.day ? s.restFrom.hour : s.hour;
    return Math.min(from + st.rest / 60, LAST_HOUR - 0.05);
  }
  return st.at ?? null;
}
export const stepReady = (st, s) => { const t = stepStart(st, s); return t == null || s.hour >= t - 1e-6; };
/** Game minutes until step st may start (0 when it can). */
export function minutesLeft(st, s) { const t = stepStart(st, s); return t == null ? 0 : Math.max(0, Math.ceil((t - s.hour) * 60 - 1e-6)); }
/** Clock speed: real seconds per game minute (인혁: "1분을 0.5초로 해줘"). */
export const SEC_PER_MIN = 0.5;
/** Advance the clock by dt real seconds (never past LAST_HOUR). */
export function tickClock(s, dt, scale = 1) { s.hour = Math.min(LAST_HOUR, s.hour + (dt * scale) / (SEC_PER_MIN * 60)); return s; }

export function newState() {
  return {
    day: 1, hour: 6.9, money: 30000, hp: 100, food: 70, license: false, ticket: false, mode: 'office', plan: null,
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

export const WAGE = 150000;
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
