// Jobs (인혁: "직업을 더 만들어줘. 다양하게 경찰, 소방관 같은 것도 넣어."): pure step data per job.
// A job day = the usual morning at home → drive to the workplace → the job's own tasks → 6 p.m. 퇴근.
// The mini games and the things in the town for each task live in src/jobs.js.
// Step fields are the same as in core.mjs: {id, label, text, target 'site:interactable', at?, rest?, count?}.

export const JOBS = {
  police: {
    icon: '👮', name: '경찰관', place: '세온 경찰서', site: 'civic-police', outfit: 'police', color: '#1f4f9a',
    title: '경찰관 근무 날', pick: '순찰차 타고 동네를 지키고 길 잃은 아이를 도와줘요',
    go: { label: '경찰서로 출근', text: '차 타고 세온 경찰서로 출근해요 (큰길 동쪽, 소방서 옆)' },
    steps: [
      { id: 'p-check', label: '출근 체크', text: '경찰서 민원실 반장님께 “출근했습니다!” 인사해요', target: 'civic-police:officer', at: 9 },
      { id: 'p-uniform', label: '경찰 제복 입기', text: '사무실 안쪽 파란 사물함에서 경찰 제복을 입어요 👮 (민원실 양쪽 끝으로 들어가요)', target: 'civic-police:policeLocker' },
      { id: 'p-patrol', label: '순찰차 타고 순찰', text: '경찰서 앞 순찰차를 타고 파란 고리 순찰 지점 3곳을 돌아요 🚓', target: 'civic-police:patrolCar', count: 3 },
      { id: 'p-lost', label: '길 잃은 아이 도와주기', text: '무전: “장난감 가게 앞에서 아이가 울고 있어요!” 가서 이야기해요', target: 'job:lostKid' },
      { id: 'p-mom', label: '엄마 찾아 주기', text: '아이 엄마가 세온 마트 앞에서 찾고 있대요. 아이를 데려다줘요', target: 'job:mom' },
      { id: 'p-traffic', label: '교통 정리', text: '큰길 사거리(소방서 앞)에서 호루라기로 교통 정리를 해요 🚦', target: 'job:traffic' },
      { id: 'p-report', label: '보고서 쓰기', text: '경찰서 사무실 내 자리 컴퓨터로 오늘 한 일을 보고서로 써요 📝', target: 'civic-police:policeDesk' },
    ],
    out: 'civic-police:policeLocker',
  },
  fire: {
    icon: '🚒', name: '소방관', place: '세온 소방서', site: 'civic-fire', outfit: 'fire', color: '#c4161c',
    title: '소방관 근무 날', pick: '출동 벨이 울리면 소방차 타고 출동! 호스로 불을 꺼요',
    go: { label: '소방서로 출근', text: '차 타고 세온 소방서로 출근해요 (큰길 동쪽, 망루가 있는 빨간 건물)' },
    steps: [
      { id: 'f-suit', label: '소방복 입기', text: '사물함 앞에서 소방복을 순서대로 빨리 입어요! 🧑‍🚒', target: 'civic-fire:fireLocker', at: 9 },
      { id: 'f-wait', label: '출동 대기', text: '상황실 앞에서 대기해요. 출동 벨이 울리면 소방차로!', target: 'civic-fire:firetruck', rest: 20 },
      { id: 'f-truck', label: '소방차 타고 출동', text: '🚨 출동! 소방차를 타고 불이 난 집으로 가요 (연기가 나는 곳)', target: 'civic-fire:firetruck' },
      { id: 'f-hose', label: '호스로 불 끄기', text: '빨간 소화전에 호스를 연결하고 불을 꺼요 (E, 왼쪽 클릭 꾹)', target: 'job:hydrant' },
      { id: 'f-back', label: '소방서로 돌아가기', text: '불 끄기 성공! 소방차 타고 소방서로 돌아가요', target: 'civic-fire:door' },
      { id: 'f-check', label: '장비 점검', text: '장비 선반에서 고장 난 장비를 찾아 고쳐요 🔧', target: 'civic-fire:gearRack' },
    ],
    out: 'civic-fire:fireLocker',
  },
  doctor: {
    icon: '🧑‍⚕️', name: '의사', place: '세온 병원', site: 'shop-hospital', outfit: 'doctor', color: '#2f8aa8',
    title: '의사 선생님 진료 날', pick: '아픈 사람을 진료하고 엑스레이도 보고 주사도 놓아요',
    go: { label: '병원으로 출근', text: '차 타고 병원으로 출근해요 (남쪽 학교길)' },
    steps: [
      { id: 'd-gown', label: '의사 가운 입기', text: '진료실 옷걸이에서 하얀 가운을 입어요 🥼', target: 'shop-hospital:coatRack', at: 9 },
      { id: 'd-patient', label: '환자 진료하기', text: '진료실 책상에 앉아서 환자 3명을 진료해요 🩺', target: 'shop-hospital:doctor', count: 3 },
      { id: 'd-xray', label: '엑스레이 보기', text: '엑스레이 사진에서 부러진 뼈를 찾아요 🦴', target: 'shop-hospital:xray' },
      { id: 'd-shot', label: '예방 주사 놓기', text: '어린이에게 아프지 않게 예방 주사를 놓아요 💉', target: 'shop-hospital:shot' },
    ],
    out: 'shop-hospital:coatRack',
  },
  chef: {
    icon: '🧑‍🍳', name: '요리사', place: '피자 하우스', site: 'civic-pizza', outfit: 'chef', color: '#2f5a3a',
    title: '요리사 출근 날', pick: '주문서를 보고 피자를 만들어 오븐에 구워요',
    go: { label: '피자 하우스로 출근', text: '차 타고 피자 하우스로 출근해요 (남쪽 학교길, 치킨집 옆)' },
    steps: [
      { id: 'c-apron', label: '요리사 옷 입기', text: '주방 옷걸이에서 요리사 옷을 입어요 🧑‍🍳', target: 'civic-pizza:chefHook', at: 10 },
      { id: 'c-pizza', label: '피자 만들기', text: '주문서를 보고 피자를 만들어 오븐에 구워요 🍕', target: 'civic-pizza:pizzaOven', count: 2 },
      { id: 'c-serve', label: '손님에게 갖다 주기', text: '다 구운 피자를 창가 손님 테이블에 갖다 줘요', target: 'civic-pizza:pizzaTable' },
    ],
    out: 'civic-pizza:chefHook',
  },
  mart: {
    icon: '🛒', name: '마트 직원', place: '세온 마트', site: 'civic-mart', outfit: 'mart', color: '#1f8a4c',
    title: '마트 직원 근무 날', pick: '물건을 채우고 계산하고 카트도 모아요',
    go: { label: '마트로 출근', text: '차 타고 세온 마트로 출근해요 (큰길 북쪽, 영화관 옆)' },
    steps: [
      { id: 'm-vest', label: '마트 조끼 입기', text: '직원 사물함에서 초록 조끼를 입어요', target: 'civic-mart:martLocker', at: 9 },
      { id: 'm-stock', label: '물건 채우기', text: '빈 진열대에 물건을 알맞은 칸에 채워요 📦', target: 'civic-mart:stock' },
      { id: 'm-cashier', label: '계산하기', text: '계산대에서 손님 3명의 물건을 계산해요 💳', target: 'civic-mart:register', count: 3 },
      { id: 'm-cart', label: '카트 모으기', text: '주차장에 흩어진 카트 4대를 모아요 🛒 (E)', target: 'job:cart', count: 4 },
    ],
    out: 'civic-mart:martLocker',
  },
  post: {
    icon: '📮', name: '우체부', place: '세온 우체국', site: 'civic-post', outfit: 'post', color: '#e4552a',
    title: '우체부 근무 날', pick: '편지를 주소대로 나누고 동네에 배달해요',
    go: { label: '우체국으로 출근', text: '차 타고 세온 우체국으로 출근해요 (큰길 남쪽, 은행 옆)' },
    steps: [
      { id: 'po-uniform', label: '우체부 옷 입기', text: '직원 사물함에서 빨간 우체부 옷을 입어요', target: 'civic-post:postLocker', at: 9 },
      { id: 'po-sort', label: '편지 나누기', text: '편지 주소를 보고 알맞은 칸에 넣어요 ✉️', target: 'civic-post:sortRack' },
      { id: 'po-deliver', label: '편지 배달하기', text: '빨간 깃발이 있는 우편함 3곳에 편지를 배달해요 (E)', target: 'job:mailbox', count: 3 },
    ],
    out: 'civic-post:postLocker',
  },
};
export const JOB_KEYS = Object.keys(JOBS);

/** Every interactable id a job step uses (src/jobs.js handles these). */
export const JOB_TARGET_IDS = new Set(JOB_KEYS.flatMap((k) => [...JOBS[k].steps.map((s) => s.target), JOBS[k].out].map((t) => t.split(':')[1])));

/** Work part of a job day: drive there, the job's tasks, 6 p.m. 퇴근 (the wage is paid there). */
export function jobWork(key) {
  const J = JOBS[key] ?? JOBS.police;
  return [
    { id: 'go-job', label: J.go.label, text: J.go.text, target: `${J.site}:door` },
    ...J.steps.map((s) => ({ ...s, job: key })),
    { id: 'job-out', label: '퇴근하기', text: `오후 6시! ${J.out.endsWith('Locker') ? '사물함' : '옷걸이'}에서 옷을 갈아입고 퇴근해요 (일당 받기)`, target: J.out, at: 18, job: key },
  ];
}

/** Police patrol report (fill in the blanks): each line has one right word. */
export const REPORT = [
  { line: '오늘 순찰차를 타고 ___ 을(를) 순찰했어요.', o: ['학교 앞', '달나라', '바닷속'], a: 0 },
  { line: '장난감 가게 앞에서 ___ 을(를) 엄마에게 데려다줬어요.', o: ['길 잃은 아이', '고양이 로봇', '피자'], a: 0 },
  { line: '큰길 사거리에서 ___ 을(를) 했어요.', o: ['낮잠', '교통 정리', '줄넘기'], a: 1 },
];

/** Traffic control rounds: what is happening, and the right signal ('stop' ✋ or 'go' 👉). */
export const TRAFFIC = [
  { what: '🚸 어린이들이 횡단보도 앞에서 기다려요', a: 'stop' },
  { what: '🚗🚙 차들이 줄 서 있고, 횡단보도는 비었어요', a: 'go' },
  { what: '🚑 구급차가 삐뽀삐뽀 달려와요', a: 'go' },
  { what: '🦆🐥 오리 가족이 길을 건너려고 해요', a: 'stop' },
  { what: '🚌 버스가 출발하려고 해요. 사람은 없어요', a: 'go' },
  { what: '👵 할머니가 천천히 건너고 있어요', a: 'stop' },
  { what: '🚒 소방차가 출동해요!', a: 'go' },
  { what: '⚽ 공이 길로 굴러왔어요!', a: 'stop' },
];

/** Fire fighter gear in the order it goes on (bunker pants and boots first, gloves last). */
export const FIRE_GEAR = [
  { k: 'pants', icon: '👖', name: '방화복 바지' },
  { k: 'boots', icon: '🥾', name: '안전화' },
  { k: 'coat', icon: '🧥', name: '방화복 상의' },
  { k: 'tank', icon: '🫧', name: '공기통' },
  { k: 'helmet', icon: '⛑️', name: '헬멧' },
  { k: 'gloves', icon: '🧤', name: '장갑' },
];

/** Fire station gear check: the broken ones and how they get fixed. */
export const GEAR_CHECK = [
  { icon: '🧯', name: '소화기', ok: true },
  { icon: '🫧', name: '공기통', ok: false, fix: '공기를 꽉 채웠어요' },
  { icon: '🔦', name: '손전등', ok: true },
  { icon: '🪢', name: '로프', ok: true },
  { icon: '🚿', name: '호스', ok: false, fix: '꼬인 호스를 풀었어요' },
  { icon: '📻', name: '무전기', ok: false, fix: '건전지를 바꿨어요' },
  { icon: '🪓', name: '도끼', ok: true },
  { icon: '⛑️', name: '헬멧', ok: true },
];

/** Doctor: patients, the tool to check with and the medicine. */
export const PATIENTS = [
  { who: '🤧 회사원 아저씨', say: '콜록콜록… 기침이 나고 목이 아파요', tool: 'steth', med: 'cold' },
  { who: '🤕 축구한 형', say: '공 차다가 넘어져서 무릎이 까졌어요', tool: 'look', med: 'band' },
  { who: '🥵 유치원 동생', say: '열이 나고 머리가 뜨거워요', tool: 'thermo', med: 'fever' },
  { who: '😖 할아버지', say: '배가 꾸르륵꾸르륵 아파요', tool: 'steth', med: 'tummy' },
];
export const DOC_TOOLS = { steth: '🩺 청진기로 들어 보기', thermo: '🌡️ 체온 재기', look: '🔍 상처 살펴보기' };
export const DOC_MEDS = { cold: '💊 감기약', band: '🩹 소독하고 반창고', fever: '🧊 해열제', tummy: '🍵 배 아픈 약' };

/** Pizza orders (toppings after dough, sauce and cheese). */
export const PIZZAS = [
  { name: '페퍼로니 피자', top: ['pepperoni'] },
  { name: '불고기 피자', top: ['bulgogi', 'onion'] },
  { name: '야채 피자', top: ['pepper', 'olive', 'onion'] },
];
export const TOPPINGS = { dough: '🫓 반죽', sauce: '🍅 소스', cheese: '🧀 치즈', pepperoni: '🍕 페퍼로니', bulgogi: '🥩 불고기', onion: '🧅 양파', pepper: '🫑 피망', olive: '🫒 올리브' };

/** Mart: things to put on shelves and where they go. */
export const STOCK = [
  { icon: '🥛', name: '우유', to: 'milk' }, { icon: '🍞', name: '식빵', to: 'bread' }, { icon: '🧴', name: '샴푸', to: 'home' },
  { icon: '🧀', name: '치즈', to: 'milk' }, { icon: '🥐', name: '크루아상', to: 'bread' }, { icon: '🧻', name: '휴지', to: 'home' },
];
export const AISLES = { milk: '🥛 우유 · 냉장', bread: '🍞 빵 · 베이커리', home: '🧴 생활용품' };

/** Cashier: three customers, what they buy and what they pay with. Change = paid - total. */
export const CUSTOMERS = [
  { items: [['🍎 사과', 2000], ['🥛 우유', 1500]], paid: 5000 },
  { items: [['🍞 식빵', 3000], ['🧀 치즈', 4000], ['🍌 바나나', 2000]], paid: 10000 },
  { items: [['🍫 초콜릿', 1000], ['🧃 주스', 1500]], paid: 3000 },
];
export const cartTotal = (c) => c.items.reduce((a, [, p]) => a + p, 0);
export const changeFor = (c) => c.paid - cartTotal(c);
/** Three answers for the change: the right one and two near misses, in a fixed order per customer. */
export function changeOptions(c, n = 0) {
  const right = changeFor(c);
  const opts = [right, right + 1000, right >= 500 ? right - 500 : right + 1500];
  const k = n % 3;
  return [...opts.slice(3 - k), ...opts.slice(0, 3 - k)];
}

/** Post office: letters and the slot they belong in. */
export const LETTERS = [
  { to: '세온 초등학교 1학년 1반', box: 'school' }, { to: '세온 아파트 106동', box: 'apt' }, { to: '세온 경찰서', box: 'town' },
  { to: '세온 아파트 101동 802호', box: 'apt' }, { to: '세온 초등학교 선생님', box: 'school' }, { to: '세온 소방서', box: 'town' },
];
export const SLOTS = { school: '🏫 학교', apt: '🏢 아파트', town: '🏛️ 관공서' };
