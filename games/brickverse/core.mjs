// BRICKVERSE 의 순수 규칙: 캐릭터 물리, 저장 정리, 아바타 정보, 이름, 타이쿤 경제, 네트워크 묶기.
// 화면(three.js)이나 DOM 을 쓰지 않아서 node --test 로 시험한다 (core.test.mjs).

export const GAME = 'brickverse';
export const SAVE_KEY = 'brickverse:v1';
export const MAX_PLAYERS = 6;

// 캐릭터 크기와 움직임. 단위는 미터 비슷한 블록 단위.
export const P = Object.freeze({
  R: 0.5,          // 몸 반쪽 너비
  H: 2.7,          // 키
  SPEED: 8.5,      // 달리는 빠르기
  ACCEL: 70,       // 땅에서 빨라지고 멈추는 정도
  AIR: 30,         // 공중에서 방향 바꾸는 정도
  ICE: 5,          // 얼음 위
  GRAVITY: 40,
  JUMP: 14,        // 점프 높이 = JUMP² / (2·GRAVITY) ≈ 2.45
  BOUNCE: 26,      // 점프대 (≈ 8.4 높이)
  CLIMB: 8,        // 사다리 오르기
  STEP: 0.65,      // 이 높이까지는 그냥 걸어 올라간다
  COYOTE: 0.11,    // 발판 끝에서 살짝 늦게 눌러도 점프
  BUFFER: 0.14,    // 착지 직전에 미리 누른 점프
  MAXFALL: 60,
});

const EPS = 1e-4;

// 부품(가운데 위치와 크기) → 부딪힘 상자
export function makeBox(part) {
  const b = {
    x0: part.x - part.w / 2, x1: part.x + part.w / 2,
    y0: part.y - part.h / 2, y1: part.y + part.h / 2,
    z0: part.z - part.d / 2, z1: part.z + part.d / 2,
    kind: part.k ?? 'solid', on: true, dx: 0, dy: 0, dz: 0,
    cx: part.cv?.[0] ?? 0, cz: part.cv?.[1] ?? 0, part,
  };
  return b;
}

// 상자를 (가운데 x, y, z) 로 옮긴다. 이번 프레임에 움직인 만큼 dx, dy, dz 에 적는다 (위에 탄 사람을 같이 옮기려고).
export function placeBox(b, x, y, z) {
  const w = b.x1 - b.x0, h = b.y1 - b.y0, d = b.z1 - b.z0;
  const nx0 = x - w / 2, ny0 = y - h / 2, nz0 = z - d / 2;
  b.dx += nx0 - b.x0; b.dy += ny0 - b.y0; b.dz += nz0 - b.z0;
  b.x0 = nx0; b.x1 = nx0 + w; b.y0 = ny0; b.y1 = ny0 + h; b.z0 = nz0; b.z1 = nz0 + d;
}

export function newPlayer(x = 0, y = 0, z = 0) {
  return { x, y, z, vx: 0, vy: 0, vz: 0, ground: null, air: 0, buf: 0, climb: false, stepped: 0 };
}

function hits(pl, b, pad = 0) {
  return pl.x + P.R + pad > b.x0 && pl.x - P.R - pad < b.x1
    && pl.z + P.R + pad > b.z0 && pl.z - P.R - pad < b.z1
    && pl.y + P.H + pad > b.y0 && pl.y - pad < b.y1;
}

function free(pl, boxes) {
  for (const b of boxes) if (b.on && hits(pl, b)) return false;
  return true;
}

// 움직이는 발판이 몸 안으로 들어왔을 때 가장 짧은 쪽으로 밀어낸다.
function depenetrate(pl, boxes, ev) {
  for (const b of boxes) {
    if (!b.on || !hits(pl, b)) continue;
    if (b.kind === 'kill') ev.kill = true;
    const up = b.y1 - pl.y, down = pl.y + P.H - b.y0;
    const left = pl.x + P.R - b.x0, right = b.x1 - (pl.x - P.R);
    const back = pl.z + P.R - b.z0, front = b.z1 - (pl.z - P.R);
    const m = Math.min(up, down, left, right, back, front);
    if (m === up) { pl.y = b.y1; if (pl.vy < 0) pl.vy = 0; pl.ground = b; }
    else if (m === down) { pl.y = b.y0 - P.H - EPS; if (pl.vy > 0) pl.vy = 0; }
    else if (m === left) pl.x = b.x0 - P.R - EPS;
    else if (m === right) pl.x = b.x1 + P.R + EPS;
    else if (m === back) pl.z = b.z0 - P.R - EPS;
    else pl.z = b.z1 + P.R + EPS;
  }
}

function moveFlat(pl, axis, d, boxes, ev, grounded) {
  if (!d) return;
  pl[axis] += d;
  for (const b of boxes) {
    if (!b.on || !hits(pl, b)) continue;
    if (b.kind === 'kill') { ev.kill = true; }
    const rise = b.y1 - pl.y;
    if (grounded && rise > 0 && rise <= P.STEP && b.kind !== 'kill' && b.kind !== 'ladder') {
      const oldY = pl.y;
      pl.y = b.y1;
      if (free(pl, boxes)) { pl.stepped += rise; continue; }
      pl.y = oldY;
    }
    if (b.kind === 'ladder') ev.climb = true;
    if (axis === 'x') { pl.x = d > 0 ? b.x0 - P.R - EPS : b.x1 + P.R + EPS; pl.vx = 0; }
    else { pl.z = d > 0 ? b.z0 - P.R - EPS : b.z1 + P.R + EPS; pl.vz = 0; }
    ev.wall = true;
  }
}

function moveUp(pl, d, boxes, ev) {
  if (!d) return;
  pl.y += d;
  for (const b of boxes) {
    if (!b.on || !hits(pl, b)) continue;
    if (b.kind === 'kill') ev.kill = true;
    if (d < 0) {
      pl.y = b.y1;
      if (b.kind === 'bounce') { pl.vy = P.BOUNCE; ev.bounce = true; pl.ground = null; }
      else { if (pl.vy < -14) ev.hard = true; pl.vy = 0; pl.ground = b; }
    } else {
      pl.y = b.y0 - P.H - EPS;
      if (pl.vy > 0) pl.vy = 0;
      ev.bump = true;
    }
  }
}

// 한 프레임 움직이기. inp = { mx, mz: 월드 방향(길이 1 이하), jump: 이번에 눌렀나 }
// 돌려주는 것: 착지한 상자, 죽음, 점프, 점프대, 사다리 같은 일들.
export function stepPlayer(pl, inp, boxes, dt) {
  const ev = { kill: false, jumped: false, bounce: false, landed: null, climb: false, wall: false, bump: false, hard: false };
  const before = pl.ground;
  if (before && !before.on) pl.ground = null;
  const g = pl.ground;
  if (g) { pl.x += g.dx; pl.y += g.dy; pl.z += g.dz; }
  depenetrate(pl, boxes, ev);

  const ground = pl.ground;
  const sm = inp.speed > 0 ? inp.speed : 1; // 펫이 주는 속도 (강아지 1.5배 … 앵무새 10배)
  const rate = (!ground ? P.AIR : ground.kind === 'ice' ? P.ICE : P.ACCEL) * Math.max(1, Math.sqrt(sm));
  const tx = (inp.mx || 0) * P.SPEED * sm, tz = (inp.mz || 0) * P.SPEED * sm;
  let ax = tx - pl.vx, az = tz - pl.vz;
  const len = Math.hypot(ax, az), lim = rate * dt;
  if (len > lim) { ax *= lim / len; az *= lim / len; }
  pl.vx += ax; pl.vz += az;

  pl.buf = inp.jump ? P.BUFFER : Math.max(0, pl.buf - dt);
  pl.air = ground ? 0 : pl.air + dt;
  const pushing = Math.hypot(inp.mx || 0, inp.mz || 0) > 0.2;
  if (pl.climb && pushing && !inp.jump) { pl.vy = P.CLIMB; pl.air = 0; }
  if (pl.buf > 0 && pl.air <= P.COYOTE) {
    pl.vy = P.JUMP; pl.buf = 0; pl.air = P.COYOTE + 1; ev.jumped = true; pl.ground = null;
  }
  pl.vy = Math.max(pl.vy - P.GRAVITY * dt, -P.MAXFALL);

  let ex = 0, ez = 0;
  if (ground && ground.kind === 'conveyor' && !ev.jumped) { ex = ground.cx; ez = ground.cz; }
  const mx = (pl.vx + ex) * dt, my = pl.vy * dt, mz = (pl.vz + ez) * dt;
  const n = Math.min(24, Math.max(1, Math.ceil(Math.max(Math.abs(mx), Math.abs(my), Math.abs(mz)) / 0.3)));
  const grounded = !!ground && !ev.jumped;
  pl.ground = null;
  for (let i = 0; i < n; i++) {
    moveFlat(pl, 'x', mx / n, boxes, ev, grounded);
    moveFlat(pl, 'z', mz / n, boxes, ev, grounded);
    moveUp(pl, my / n, boxes, ev);
    if (ev.bounce) break;
  }
  pl.climb = ev.climb;
  // 서 있지 않은데 닿아 있는 킬 블록 (옆에서 스치기)
  for (const b of boxes) if (b.on && b.kind === 'kill' && hits(pl, b, 0.03)) ev.kill = true;
  if (pl.ground && pl.ground !== before) ev.landed = pl.ground;
  return ev;
}

// 움직이는 발판을 옮기기 전에 지난 프레임의 움직임을 지운다.
export function clearMotion(boxes) {
  for (const b of boxes) { b.dx = 0; b.dy = 0; b.dz = 0; }
}

// 점 (px, pz) 에서 선분 a-b 까지 거리 (돌아가는 막대에 닿았나 볼 때)
export function segmentDistance(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const l2 = vx * vx + vz * vz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / l2));
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}

// 카메라가 벽 뒤로 들어가지 않게: 시작점에서 방향 d 로 쏜 광선이 처음 부딪히는 t (0~maxT)
export function rayBoxes(ox, oy, oz, dx, dy, dz, boxes, maxT) {
  let best = maxT;
  for (const b of boxes) {
    if (!b.on || b.kind === 'ladder' || b.kind === 'glass' || b.kind === 'tile') continue;
    if (ox > b.x0 && ox < b.x1 && oy > b.y0 && oy < b.y1 && oz > b.z0 && oz < b.z1) continue;
    let t0 = 0, t1 = best, ok = true;
    for (const [o, d, lo, hi] of [[ox, dx, b.x0, b.x1], [oy, dy, b.y0, b.y1], [oz, dz, b.z0, b.z1]]) {
      if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { ok = false; break; } continue; }
      let a = (lo - o) / d, c = (hi - o) / d;
      if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, c);
      if (t0 > t1) { ok = false; break; }
    }
    if (ok && t0 < best) best = t0;
  }
  return best;
}

// ───────────── 아바타 ─────────────

export const SKINS = ['#ffdcb5', '#f2c48d', '#d9a066', '#a8693f', '#7a4a2a', '#ffe14d', '#9fe870', '#8fd3ff', '#ffb3d9', '#c9b6ff'];
export const COLORS = [
  '#ff4d5e', '#ff8a3d', '#ffd23f', '#5ad16b', '#21c7b8', '#3fa7ff', '#4a5cff', '#9b5cff',
  '#ff6fb5', '#ffffff', '#c7ccd6', '#4b5163', '#23262f', '#8b5a3c', '#2f7d4f', '#1d3f8f',
];

export const HATS = [
  { id: 'none', name: '없음', price: 0 },
  { id: 'cap', name: '야구 모자', price: 0 },
  { id: 'beanie', name: '털모자', price: 0 },
  { id: 'party', name: '파티 모자', price: 20 },
  { id: 'flower', name: '꽃핀', price: 25 },
  { id: 'antenna', name: '외계인 더듬이', price: 40 },
  { id: 'bunny', name: '토끼 귀', price: 50 },
  { id: 'cat', name: '고양이 귀', price: 50 },
  { id: 'chef', name: '요리사 모자', price: 70 },
  { id: 'headphones', name: '헤드폰', price: 80 },
  { id: 'tophat', name: '마술사 모자', price: 100 },
  { id: 'horns', name: '용 뿔', price: 120 },
  { id: 'viking', name: '바이킹 투구', price: 150 },
  { id: 'crown', name: '왕관', price: 200 },
  { id: 'wizard', name: '마법사 모자', price: 250 },
  { id: 'halo', name: '천사 링', price: 300 },
];

export const FACES = [
  { id: 'smile', name: '웃음', price: 0 },
  { id: 'grin', name: '활짝', price: 0 },
  { id: 'wink', name: '윙크', price: 0 },
  { id: 'surprised', name: '깜짝', price: 15 },
  { id: 'sleepy', name: '졸려', price: 15 },
  { id: 'tongue', name: '메롱', price: 30 },
  { id: 'cool', name: '선글라스', price: 60 },
  { id: 'star', name: '반짝 눈', price: 90 },
];

export const EMBLEMS = [
  { id: 'none', name: '없음', price: 0 },
  { id: 'star', name: '별', price: 0 },
  { id: 'heart', name: '하트', price: 0 },
  { id: 'bolt', name: '번개', price: 20 },
  { id: 'brick', name: '벽돌', price: 20 },
  { id: 'smile', name: '스마일', price: 30 },
  { id: 'flame', name: '불꽃', price: 50 },
  { id: 'crown', name: '왕관', price: 80 },
];

export const ADJECTIVES = ['용감한', '빠른', '졸린', '신난', '반짝이는', '멋진', '귀여운', '씩씩한', '배고픈', '행복한', '조용한', '튼튼한', '날쌘', '수줍은', '똑똑한', '엉뚱한'];
export const ANIMALS = ['판다', '토끼', '여우', '곰', '펭귄', '고양이', '강아지', '햄스터', '공룡', '부엉이', '다람쥐', '돌고래', '사자', '코알라', '오리', '거북이'];
export const displayName = n => `${ADJECTIVES[n?.[0]] ?? ADJECTIVES[0]} ${ANIMALS[n?.[1]] ?? ANIMALS[0]}`;

// 미리 정해 둔 말 (사람이 쓴 글을 보내지 않으려고 번호만 보낸다)
export const PHRASES = ['안녕! 👋', '같이 하자!', '고마워!', '잘했어! 👍', '여기야!', 'ㅋㅋㅋ', '도와줘!', '가자! 🏃', '조금만 기다려', '최고야! ⭐', '어디야?', '또 하자!'];
export const EMOTES = [
  { id: 'none', name: '' },
  { id: 'wave', name: '👋 인사' },
  { id: 'dance', name: '🕺 춤' },
  { id: 'cheer', name: '🙌 만세' },
  { id: 'sit', name: '🪑 앉기' },
];

// 머리카락 (2026-11-08 인혁: "머리카락을 만들어줘"). 값이 0 인 것은 처음부터 가진다.
export const HAIRS = [
  { id: 'none', name: '없음', price: 0 },
  { id: 'short', name: '짧은 머리', price: 0 },
  { id: 'bangs', name: '앞머리', price: 0 },
  { id: 'spiky', name: '뾰족 머리', price: 0 },
  { id: 'bob', name: '단발', price: 0 },
  { id: 'long', name: '긴 머리', price: 20 },
  { id: 'pony', name: '포니테일', price: 20 },
  { id: 'pigtails', name: '양갈래', price: 30 },
  { id: 'bun', name: '똥머리', price: 30 },
  { id: 'curly', name: '곱슬 머리', price: 40 },
  { id: 'mohawk', name: '모히칸', price: 50 },
  { id: 'swoop', name: '옆으로 넘긴 머리', price: 60 },
];
export const HAIR_COLORS = ['#2b2522', '#5a3825', '#8a5a36', '#e8c26a', '#d9682c', '#ff8fc7', '#4a8cff', '#9b5cff', '#4fbf5a', '#f4f1ea'];
export const FREE_HAIRS = HAIRS.map((h, i) => (h.price === 0 ? i : -1)).filter(i => i >= 0);

// 새 칸(hair, hairColor)은 끝에 붙인다: 예전 게임이 보낸 6칸짜리 옷 배열도 그대로 읽힌다
export const DEFAULT_LOOK = Object.freeze({ skin: 1, shirt: 5, pants: 15, hat: 1, face: 0, emblem: 1, hair: 1, hairColor: 1 });
const LOOK_LIMITS = { skin: SKINS.length, shirt: COLORS.length, pants: COLORS.length, hat: HATS.length, face: FACES.length, emblem: EMBLEMS.length, hair: HAIRS.length, hairColor: HAIR_COLORS.length };
export const LOOK_KEYS = Object.keys(LOOK_LIMITS);

const int = (v, max, fallback = 0) => (Number.isInteger(v) && v >= 0 && v < max ? v : fallback);
const num = (v, lo, hi, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);

export function cleanLook(look) {
  const out = {};
  for (const k of LOOK_KEYS) out[k] = int(look?.[k], LOOK_LIMITS[k], DEFAULT_LOOK[k]);
  return out;
}
export const lookToArray = look => LOOK_KEYS.map(k => look[k]);
export const lookFromArray = arr => cleanLook(Object.fromEntries(LOOK_KEYS.map((k, i) => [k, arr?.[i]])));

export function randomName(rand = Math.random) {
  return [Math.floor(rand() * ADJECTIVES.length), Math.floor(rand() * ANIMALS.length)];
}

// ───────────── 타이쿤 ─────────────
// 떨어뜨리개(dropper)가 블록을 떨어뜨리면 벨트가 녹이는 기계로 옮기고, 그 값이 쌓인다.
// 초록 발판을 밟으면 쌓인 돈을 받는다. 사는 순서는 need 를 따라 열린다.
export const TYCOON = [
  { id: 'floor', name: '바닥 타일', price: 50, need: null },
  { id: 'drop2', name: '떨어뜨리개 2', price: 120, need: 'floor', drop: { value: 8, every: 1.4 } },
  { id: 'fence', name: '울타리', price: 180, need: 'drop2' },
  { id: 'up1', name: '반짝 업그레이더 ×2', price: 320, need: 'drop2', mult: 2 },
  { id: 'drop3', name: '떨어뜨리개 3', price: 560, need: 'up1', drop: { value: 15, every: 1.2 } },
  { id: 'walls', name: '1층 벽', price: 840, need: 'fence' },
  { id: 'door', name: '문과 창문', price: 1120, need: 'walls' },
  { id: 'lamp', name: '가로등과 꽃밭', price: 1300, need: 'door' },
  { id: 'stairs', name: '계단', price: 1600, need: 'door' },
  { id: 'floor2', name: '2층 바닥', price: 2000, need: 'stairs' },
  { id: 'drop4', name: '떨어뜨리개 4', price: 3200, need: 'drop3', drop: { value: 40, every: 1.2 } },
  { id: 'walls2', name: '2층 벽', price: 4400, need: 'floor2' },
  { id: 'roof', name: '지붕', price: 6000, need: 'walls2' },
  { id: 'garden', name: '나무 정원', price: 7200, need: 'roof' },
  { id: 'pool', name: '수영장', price: 9000, need: 'garden' },
  { id: 'up2', name: '무지개 업그레이더 ×3', price: 12000, need: 'drop4', mult: 3 },
  { id: 'slide', name: '미끄럼틀', price: 14000, need: 'pool' },
  { id: 'gold', name: '황금 떨어뜨리개', price: 22000, need: 'up2', drop: { value: 120, every: 1.0 } },
  { id: 'tower', name: '깃발 탑', price: 32000, need: 'slide' },
  { id: 'statue', name: '황금 트로피 동상', price: 56000, need: 'tower', finale: true, reward: 200 },
  // 더 지을 것 (2026-11-06 추가). 먼저 사야 하는 것(need)은 언제나 이 목록에서 앞에 있다.
  // 2026-11-08 인혁: "더 만들고 더 비싸게" → 위 가격은 모두 2배, 하늘 섬 11개 추가.
  { id: 'mailbox', name: '우체통', price: 240, need: 'fence' },
  { id: 'bench', name: '벤치와 화분', price: 760, need: 'walls' },
  { id: 'balcony', name: '2층 발코니', price: 5200, need: 'walls2' },
  { id: 'drop5', name: '다이아 떨어뜨리개', price: 60000, need: 'gold', drop: { value: 400, every: 1.0 } },
  { id: 'up3', name: '레이저 업그레이더 ×2', price: 240000, need: 'drop5', mult: 2 },
  { id: 'yard', name: '뒷마당 넓히기', price: 80000, need: 'statue' },
  { id: 'garage', name: '차고와 자동차', price: 110000, need: 'yard' },
  { id: 'trampoline', name: '트램펄린', price: 140000, need: 'yard' },
  { id: 'swing', name: '그네', price: 170000, need: 'yard' },
  { id: 'pond', name: '오리 연못', price: 200000, need: 'trampoline' },
  { id: 'greenhouse', name: '유리 온실', price: 260000, need: 'swing' },
  { id: 'soccer', name: '축구 골대', price: 320000, need: 'pond' },
  { id: 'walls3', name: '3층 집', price: 400000, need: 'greenhouse' },
  { id: 'rocket', name: '로켓 발사대', price: 600000, need: 'walls3', finale: true, reward: 300 },
  // 3단계: 하늘 섬 (로켓 다음). boost 는 벨트 밖에서 모든 돈을 몇 배로 (구름 은행, 별 공장)
  { id: 'skyisland', name: '하늘 섬과 엘리베이터', price: 1200000, need: 'rocket' },
  { id: 'windmill', name: '하늘 풍차', price: 1600000, need: 'skyisland' },
  { id: 'cloudgarden', name: '구름 정원', price: 2000000, need: 'skyisland' },
  { id: 'skybank', name: '구름 은행 (돈 ×2)', price: 1400000, need: 'skyisland', boost: 2 },
  { id: 'balloon', name: '열기구', price: 3000000, need: 'windmill' },
  { id: 'rainbow', name: '무지개 다리', price: 3600000, need: 'cloudgarden' },
  { id: 'skyfountain', name: '하늘 분수', price: 4500000, need: 'skybank' },
  { id: 'castle', name: '하늘 성', price: 6000000, need: 'rainbow' },
  { id: 'starfactory', name: '별 공장 (돈 ×3)', price: 5000000, need: 'skyfountain', boost: 3 },
  { id: 'ufo', name: 'UFO 착륙장 (돈 ×2)', price: 10000000, need: 'castle', boost: 2 },
  { id: 'crown', name: '황금 왕관 탑', price: 20000000, need: 'ufo', finale: true, reward: 500 },
];
export const TYCOON_START_DROP = { value: 5, every: 1.5 };
export const TYCOON_REWARD = 200;

// 벨트 밖에서 모든 돈에 곱하는 배수 (구름 은행, 별 공장)
export function tycoonBoost(owned) {
  const has = new Set(owned);
  let boost = 1;
  for (const it of TYCOON) if (it.boost && has.has(it.id)) boost *= it.boost;
  return boost;
}

export function tycoonIncome(owned) {
  const has = new Set(owned);
  let mult = tycoonBoost(owned);
  for (const it of TYCOON) if (it.mult && has.has(it.id)) mult *= it.mult;
  let rate = TYCOON_START_DROP.value / TYCOON_START_DROP.every;
  for (const it of TYCOON) if (it.drop && has.has(it.id)) rate += it.drop.value / it.drop.every;
  return rate * mult;
}

// 타이쿤 밖에 있거나 게임을 꺼 둔 동안에도 돈이 쌓인다: 원래 버는 돈의 0.001% (인혁이가 정함, 2026-11-07).
// 1달러가 안 되는 돈은 버리지 않고 save.tycoon.bank 에 모아 둔다 (그래서 소수점 그대로 돌려준다).
// 기기 시계가 이상해도 너무 커지지 않게 7일까지만 센다.
export const TYCOON_AWAY_RATE = 0.001 / 100;
export const TYCOON_AWAY_MAX_SEC = 7 * 24 * 3600;
export function tycoonAwayEarnings(owned, ms) {
  const sec = Math.min(Math.max(0, Number.isFinite(ms) ? ms / 1000 : 0), TYCOON_AWAY_MAX_SEC);
  return tycoonIncome(owned) * TYCOON_AWAY_RATE * sec;
}

export function tycoonAvailable(owned) {
  const has = new Set(owned);
  return TYCOON.filter(it => !has.has(it.id) && (!it.need || has.has(it.need)));
}

// ───────────── 저장 ─────────────

export function defaultSave(rand = Math.random) {
  return {
    v: 1,
    coins: 0,
    look: { ...DEFAULT_LOOK },
    name: randomName(rand),
    owned: { hat: [0, 1, 2], face: [0, 1, 2], emblem: [0, 1, 2], hair: [...FREE_HAIRS] },
    obby: { cp: 0, top: 0, best: 0, clears: 0, paid: 0 },
    tycoon: { cash: 0, pending: 0, items: [], done: false, away: 0, bank: 0 },
    survival: { best: 0, wins: 0 },
    battle: { wins: 0, kills: 0, best: 0, teamWins: 0, teamBest: 0 },
    tower: { blocks: [], best: 0 },
    tag: { wins: 0, hideWins: 0, seekWins: 0 },
    egg: { cash: 0, pets: [], boots: 0, ped: EGG.PED0, zones: 1, stolen: 0, hatched: 0, saved: 0, run: 0, xp: 0, tread: 1 },
    camp: freshCamp(),
    pets: { dog: 0, cat: 0, panda: 0, parrot: 0 },
    pet: '',
    sound: true,
    music: true,
    tutorial: false,
    shiftTip: false,
  };
}

function ownedList(list, max) {
  const set = new Set([0, 1, 2]);
  if (Array.isArray(list)) for (const v of list) if (Number.isInteger(v) && v >= 0 && v < max) set.add(v);
  return [...set].sort((a, b) => a - b);
}

export function cleanSave(raw, rand = Math.random) {
  const base = defaultSave(rand);
  if (!raw || typeof raw !== 'object') return base;
  const s = base;
  s.coins = Math.floor(num(raw.coins, 0, 9_999_999, 0));
  s.owned = {
    hat: ownedList(raw.owned?.hat, HATS.length),
    face: ownedList(raw.owned?.face, FACES.length),
    emblem: ownedList(raw.owned?.emblem, EMBLEMS.length),
    hair: [...new Set([...FREE_HAIRS, ...ownedList(raw.owned?.hair, HAIRS.length)])].sort((a, b) => a - b),
  };
  const look = cleanLook(raw.look);
  if (!s.owned.hat.includes(look.hat)) look.hat = DEFAULT_LOOK.hat;
  if (!s.owned.hair.includes(look.hair)) look.hair = DEFAULT_LOOK.hair;
  if (!s.owned.face.includes(look.face)) look.face = DEFAULT_LOOK.face;
  if (!s.owned.emblem.includes(look.emblem)) look.emblem = DEFAULT_LOOK.emblem;
  s.look = look;
  if (Array.isArray(raw.name)) s.name = [int(raw.name[0], ADJECTIVES.length, base.name[0]), int(raw.name[1], ANIMALS.length, base.name[1])];
  const o = raw.obby ?? {};
  s.obby = {
    cp: Math.floor(num(o.cp, 0, OBBY_STAGES, 0)),
    top: Math.floor(num(o.top, 0, OBBY_STAGES, 0)),
    best: Math.floor(num(o.best, 0, 36_000_000, 0)),
    clears: Math.floor(num(o.clears, 0, 99_999, 0)),
    paid: Math.floor(num(o.paid, 0, OBBY_STAGES, 0)),
  };
  if (s.obby.top < s.obby.cp) s.obby.top = s.obby.cp;
  const t = raw.tycoon ?? {};
  const ids = new Set(TYCOON.map(it => it.id));
  const items = Array.isArray(t.items) ? [...new Set(t.items.filter(id => ids.has(id)))] : [];
  // 순서가 꼬인 저장(먼저 사야 하는 게 없음)은 그 물건을 뺀다
  const ok = [];
  for (const it of TYCOON) if (items.includes(it.id) && (!it.need || ok.includes(it.need))) ok.push(it.id);
  s.tycoon = { cash: Math.floor(num(t.cash, 0, 1e12, 0)), pending: Math.floor(num(t.pending, 0, 1e12, 0)), items: ok, done: !!t.done && ok.includes('statue'), away: Math.floor(num(t.away, 0, 1e14, 0)), bank: num(t.bank, 0, 1, 0) };
  s.survival = { best: Math.floor(num(raw.survival?.best, 0, 3600, 0)), wins: Math.floor(num(raw.survival?.wins, 0, 99_999, 0)) };
  s.battle = { wins: Math.floor(num(raw.battle?.wins, 0, 99_999, 0)), kills: Math.floor(num(raw.battle?.kills, 0, 9_999_999, 0)), best: Math.floor(num(raw.battle?.best, 0, 99, 0)), teamWins: Math.floor(num(raw.battle?.teamWins, 0, 99_999, 0)), teamBest: Math.floor(num(raw.battle?.teamBest, 0, 99, 0)) };
  s.tower = { blocks: cleanTowerBlocks(raw.tower?.blocks), best: Math.floor(num(raw.tower?.best, 0, TOWER.TOP + 1, 0)) };
  s.tag = { wins: Math.floor(num(raw.tag?.wins, 0, 99_999, 0)), hideWins: Math.floor(num(raw.tag?.hideWins, 0, 99_999, 0)), seekWins: Math.floor(num(raw.tag?.seekWins, 0, 99_999, 0)) };
  for (const p of PETS) s.pets[p.id] = Math.floor(num(raw.pets?.[p.id], 0, 99_999, 0));
  s.egg = cleanEgg(raw.egg);
  s.camp = cleanCamp(raw.camp);
  s.pet = PETS.some(p => p.id === raw.pet) && s.pets[raw.pet] > 0 ? raw.pet : '';
  s.sound = raw.sound !== false;
  s.music = raw.music !== false;
  s.tutorial = !!raw.tutorial;
  s.shiftTip = !!raw.shiftTip;
  return s;
}

export const OBBY_STAGES = 30;
// 처음 닿은 체크포인트마다 받는 코인과 꼭대기 보상
export const obbyStageCoins = stage => 3 + Math.floor(stage / 5) * 2;
export const OBBY_CLEAR_COINS = 100;

// ───────────── 네트워크 ─────────────
// 위치는 숫자만 보낸다 (글자열 속 숫자는 서버가 가릴 수 있다).
export const WORLDS = ['hub', 'obby', 'tycoon', 'survival', 'tower', 'battle', 'tag', 'egg', 'camp'];
const r2 = v => Math.round(v * 100) / 100;
export function packPose(pl, yaw, w, anim, emote) {
  return [w, r2(pl.x), r2(pl.y), r2(pl.z), r2(yaw), anim, emote];
}
export function unpackPose(q) {
  if (!Array.isArray(q) || q.length < 7) return null;
  const [w, x, y, z, yaw, anim, emote] = q;
  if (![x, y, z, yaw].every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e5)) return null;
  return { w: int(w, WORLDS.length, 0), x, y, z, yaw, anim: int(anim, 4, 0), emote: int(emote, EMOTES.length, 0) };
}

// 바닥이 사라져요: 바닥 칸 번호
export const SURVIVAL = Object.freeze({ N: 11, TILE: 3.2, LAYERS: [0, -11, -22], LAVA: -30, LOBBY: 16, FALL_AFTER: 0.45, ROUND_WAIT: 6 });
export const tileIndex = (layer, i, j) => layer * SURVIVAL.N * SURVIVAL.N + j * SURVIVAL.N + i;
export function tileAt(x, z) {
  const half = (SURVIVAL.N * SURVIVAL.TILE) / 2;
  const i = Math.floor((x + half) / SURVIVAL.TILE), j = Math.floor((z + half) / SURVIVAL.TILE);
  if (i < 0 || j < 0 || i >= SURVIVAL.N || j >= SURVIVAL.N) return null;
  return [i, j];
}

// 시드로 정하는 난수 (모두 같은 봇 모습을 보게)
export function seeded(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// ───── 하늘 타워 짓기 ─────
// 땅은 칸(2×2×2) 격자. i, k 는 -12~11 (가로세로 24칸), j 는 0~99 (100층).
export const TOWER = Object.freeze({ CELL: 2, MIN: -12, MAX: 11, TOP: 99, LIMIT: 500, REACH: 20, RATE: 0.1 });
export const BLOCKS = [
  { id: 'red', name: '빨강', c: '#ff4d5e' },
  { id: 'orange', name: '주황', c: '#ff8a3d' },
  { id: 'yellow', name: '노랑', c: '#ffd23f' },
  { id: 'green', name: '초록', c: '#5ad16b' },
  { id: 'sky', name: '하늘', c: '#3fa7ff' },
  { id: 'purple', name: '보라', c: '#9b5cff' },
  { id: 'pink', name: '분홍', c: '#ff8fc7' },
  { id: 'white', name: '하양', c: '#ffffff' },
  { id: 'black', name: '검정', c: '#2a2d36' },
  { id: 'wood', name: '나무', c: '#c98a4b', m: 'wood' },
  { id: 'stone', name: '돌', c: '#b8bcc6', m: 'stone' },
  { id: 'glass', name: '유리', c: '#bfe9ff', k: 'glass' },
  { id: 'neon', name: '빛나는', c: '#7dfcff', m: 'neon' },
  { id: 'gold', name: '황금', c: '#ffd23f', m: 'gold' },
  { id: 'ice', name: '얼음', c: '#bdefff', k: 'ice' },
  { id: 'bounce', name: '점프대', c: '#40ff8a', k: 'bounce', m: 'neon' },
  { id: 'ladder', name: '사다리', c: '#a0612f', k: 'ladder', m: 'wood' },
];
export const cellKey = (i, j, k) => `${i},${j},${k}`;
export const cellCenter = (i, j, k) => [(i + 0.5) * TOWER.CELL, (j + 0.5) * TOWER.CELL, (k + 0.5) * TOWER.CELL];
export const inTower = (i, j, k) => [i, j, k].every(Number.isInteger) && i >= TOWER.MIN && i <= TOWER.MAX && k >= TOWER.MIN && k <= TOWER.MAX && j >= 0 && j <= TOWER.TOP;
export const towerFloor = y => Math.max(0, Math.floor((y + 0.05) / TOWER.CELL));

// 저장이나 네트워크에서 온 블록 목록 정리: 칸 안, 겹치지 않게, 500개까지
export function cleanTowerBlocks(list, limit = TOWER.LIMIT) {
  const out = [], seen = new Set();
  if (!Array.isArray(list)) return out;
  for (const b of list) {
    if (!Array.isArray(b) || b.length < 4) continue;
    const [i, j, k, t] = b;
    if (!inTower(i, j, k) || !Number.isInteger(t) || t < 0 || t >= BLOCKS.length) continue;
    const key = cellKey(i, j, k);
    if (seen.has(key)) continue;
    seen.add(key); out.push([i, j, k, t]);
    if (out.length >= limit) break;
  }
  return out;
}
// 네트워크로 보낼 때는 숫자 배열 하나로 (글자열 없음)
export const packBlocks = blocks => blocks.flat();
export function unpackBlocks(flat) {
  if (!Array.isArray(flat)) return [];
  const list = [];
  for (let n = 0; n + 3 < flat.length; n += 4) list.push(flat.slice(n, n + 4));
  return cleanTowerBlocks(list);
}

// 블록 칸 (가운데 x, y, z, 한 변 TOWER.CELL) 이 캐릭터 몸과 겹치나 (하늘 타워와 모두의 공터: 내 자리에는 못 놓는다)
export function touchesCell(pl, x, y, z) {
  const h = TOWER.CELL / 2;
  return pl.x + P.R > x - h && pl.x - P.R < x + h && pl.z + P.R > z - h && pl.z - P.R < z + h && pl.y + P.H > y - h && pl.y < y + h;
}

// ───── 모두의 공터 (브릭 광장 오른쪽 아래, 모두의 광장 World 의 칸으로 저장) ─────
// 칸은 타워와 같은 2×2×2. i, k 는 0~11 (가로세로 12칸), j 는 0~15 (16층).
// 가운데 (X, Z), 바닥판 윗면 높이 Y. 칸 이름은 'b|i|j|k', 값은 블록 번호(0~16) 하나.
// 한 사람이 놓을 수 있는 칸은 서버와 같이 400개(LIMIT), 놓는 간격은 0.3초(RATE, 서버는 1초 4번). NEAR: 이만큼 가까우면 막대가 켜진다.
export const COMMONS = Object.freeze({ X: 60, Z: 20, Y: 0.14, N: 12, TOP: 15, LIMIT: 400, RATE: 0.3, NEAR: 6 });
export const COMMONS_HALF = (COMMONS.N * TOWER.CELL) / 2;
export const inCommons = (i, j, k) => [i, j, k].every(Number.isInteger) && i >= 0 && i < COMMONS.N && k >= 0 && k < COMMONS.N && j >= 0 && j <= COMMONS.TOP;
export const commonsKey = (i, j, k) => `b|${i}|${j}|${k}`;
// 칸 이름 → { i, j, k }. 공터 밖이거나 모양이 다르면 null ('b|01|0|0' 처럼 같은 칸을 다르게 쓴 이름도 null)
export function parseCommonsKey(key) {
  if (typeof key !== 'string') return null;
  const m = /^b\|(\d{1,2})\|(\d{1,2})\|(\d{1,2})$/.exec(key);
  if (!m) return null;
  const [i, j, k] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return inCommons(i, j, k) && commonsKey(i, j, k) === key ? { i, j, k } : null;
}
// 서버에서 온 칸 하나 → { i, j, k, t, owner(사용자 번호) }. 그리면 안 되는 칸이면 null.
export function commonsBlock(key, entry) {
  const at = parseCommonsKey(key);
  if (!at || !entry) return null;
  const t = entry.v;
  if (!Number.isInteger(t) || t < 0 || t >= BLOCKS.length) return null;
  return { ...at, t, owner: entry.owner?.id ?? null };
}
// 칸 가운데의 광장 좌표
export const commonsCenter = (i, j, k) => [COMMONS.X - COMMONS_HALF + (i + 0.5) * TOWER.CELL, COMMONS.Y + (j + 0.5) * TOWER.CELL, COMMONS.Z - COMMONS_HALF + (k + 0.5) * TOWER.CELL];
// 광장 바닥의 (x, z) 가 공터의 어느 칸 위인가. 밖이면 null
export function commonsCellAt(x, z) {
  const i = Math.floor((x - COMMONS.X + COMMONS_HALF) / TOWER.CELL), k = Math.floor((z - COMMONS.Z + COMMONS_HALF) / TOWER.CELL);
  return inCommons(i, 0, k) ? { i, k } : null;
}
// (x, z) 가 공터 안이거나 margin 만큼 가까운가
export const nearCommons = (x, z, margin = COMMONS.NEAR) => Math.abs(x - COMMONS.X) < COMMONS_HALF + margin && Math.abs(z - COMMONS.Z) < COMMONS_HALF + margin;
// 받은 칸(World 의 cells: 칸 이름 → { v, owner, exp? }) 중 내가 놓은 칸 수. 서버의 400개 한도처럼 사라지는 칸(exp)은 세지 않는다.
export function countMine(cells, userId) {
  if (userId === null || userId === undefined) return 0;
  let n = 0;
  for (const entry of cells.values()) if (entry?.owner?.id === userId && entry.exp === undefined) n++;
  return n;
}

// ───── 타이쿤 돈 주기 (친구 방) ─────
// 'hi' 에 실어 보내는 게임 버전. 2 부터 돈 주기를 안다 (1 이나 없음 = 예전 게임: 돈을 받지 못한다).
export const NET_VERSION = 2;
export const GIFT_WAIT_MS = 12000;
export const GIFT_AMOUNTS = [100, 1000, 10000, 100000, 1000000];
export const GIFT_MAX = 1_000_000_000;
// 받은 선물이 정상인가: 1 이상 GIFT_MAX 이하의 정수, 번호도 정수
export const validGift = d => Number.isInteger(d?.amt) && d.amt >= 1 && d.amt <= GIFT_MAX && Number.isInteger(d?.n) && d.n > 0;
// 반 주기: 1달러 이상일 때만
export const halfOf = cash => Math.max(0, Math.floor(cash / 2));

// ───── 블록 배틀 로얄 (2026-11-08 인혁: "배그같은 총게임") ─────
// 장난감 블래스터로 맞히면 체력이 줄고, 0 이 되면 탈락 (펑 사라짐). 안전 구역은 점점 줄어든다.
export const WEAPONS = [
  { id: 'pistol', name: '블래스터 권총', dmg: 14, rate: 3.2, spread: 0.014, range: 70, pellets: 1, auto: false, color: '#ff8a3d', icon: '🔫', mag: 12, reload: 1.1, start: Infinity },
  { id: 'rifle', name: '연사 블래스터', dmg: 9, rate: 8, spread: 0.024, range: 90, pellets: 1, auto: true, color: '#3fa7ff', icon: '🏹', mag: 30, reload: 1.8, start: 60 },
  { id: 'shotgun', name: '샷건 블래스터', dmg: 9, rate: 1.1, spread: 0.085, range: 30, pellets: 7, auto: false, color: '#5ad16b', icon: '💥', mag: 6, reload: 2.2, start: 12 },
  { id: 'sniper', name: '저격 블래스터', dmg: 70, rate: 0.75, spread: 0.0015, range: 220, pellets: 1, auto: false, color: '#9b5cff', icon: '🎯', zoom: true, mag: 5, reload: 2.4, start: 10 },
];
export const LOOT = [...WEAPONS.slice(1).map(w => ({ kind: 'weapon', id: w.id })), { kind: 'heal', id: 'juice', amount: 35 }, { kind: 'shield', id: 'shield', amount: 50 }, { kind: 'ammo', id: 'ammo' }, { kind: 'helmet', id: 'helmet' }, { kind: 'vest', id: 'vest' }];

// 방어구 (2026-11-08 인혁: "방어구도 나오게 해줘"): 헬멧과 조끼, 1~3단계. 맞을 때 줄어드는 비율.
export const GEAR = { helmet: [0, 0.10, 0.18, 0.25], vest: [0, 0.15, 0.25, 0.35] };
export const GEAR_NAMES = { helmet: '헬멧', vest: '조끼' };
export const GEAR_ICONS = { helmet: '🪖', vest: '🦺' };
export const GEAR_COLORS = ['#ffffff', '#9aa3b5', '#3fa7ff', '#ffcf33'];
export const gearReduce = (helmet = 0, vest = 0) => (GEAR.helmet[helmet] ?? 0) + (GEAR.vest[vest] ?? 0);

// 탄창 상태: mag(탄창에 든 것), res(남은 총알, 권총은 끝없음)
export const freshAmmo = id => { const w = WEAPONS.find(x => x.id === id); return { mag: w.mag, res: w.start }; };
// 재장전: 탄창을 채우고 남은 총알에서 뺀다
export function reloadAmmo(a, id) {
  const w = WEAPONS.find(x => x.id === id);
  const need = Math.max(0, w.mag - a.mag), take = Math.min(need, a.res);
  return { mag: a.mag + take, res: a.res - take };
}
// 총알 상자: 권총 말고 가진 블래스터마다 탄창 한 개 반만큼
export const ammoBox = id => { const w = WEAPONS.find(x => x.id === id); return w.start === Infinity ? 0 : Math.ceil(w.mag * 1.5); };
// 섬 지름 약 500 (2026-11-08 인혁: "맵을 엄청 더 넓혀줘"), 안전 구역 6단계로 약 5분
export const BATTLE = Object.freeze({ HP: 100, ARMOR: 100, PLAYERS: 12, LOBBY_WAIT: 10, DROP_Y: 80, FALL: -7, ZONE_DPS: [1, 2, 3, 5, 8, 12], R0: 240, ISLAND: 250 });

// 맞으면 방패가 먼저 줄고 남은 만큼 체력이 준다
export function applyDamage(s, dmg) {
  const d = Math.max(0, dmg) * (1 - gearReduce(s.helmet | 0, s.vest | 0)); // 헬멧과 조끼가 먼저 줄인다
  const fromArmor = Math.min(s.armor, d * 0.7);
  return { hp: Math.max(0, s.hp - (d - fromArmor)), armor: s.armor - fromArmor };
}

// 안전 구역 단계: 기다렸다가(wait) 줄어든다(shrink). 다음 원은 앞 원 안쪽 어딘가.
export function zonePhases(seed, r0 = BATTLE.R0) {
  const rnd = seeded(seed);
  const radii = [r0, r0 * 0.7, r0 * 0.45, r0 * 0.27, r0 * 0.14, r0 * 0.06, 0];
  const waits = [40, 32, 26, 22, 18, 15], shrinks = [38, 30, 24, 20, 15, 12];
  const out = [];
  let cx = 0, cz = 0, t = 0;
  for (let n = 0; n < radii.length - 1; n++) {
    const R = radii[n], r = radii[n + 1];
    const a = rnd() * Math.PI * 2, d = rnd() * Math.max(0, R - r) * 0.8;
    const nx = cx + Math.cos(a) * d, nz = cz + Math.sin(a) * d;
    out.push({ start: t + waits[n], end: t + waits[n] + shrinks[n], from: { x: cx, z: cz, r: R }, to: { x: nx, z: nz, r }, dps: BATTLE.ZONE_DPS[n] });
    t += waits[n] + shrinks[n];
    cx = nx; cz = nz;
  }
  return out;
}

// t 초(구역이 시작된 뒤)의 안전 구역
export function zoneAt(phases, t) {
  let z = { ...phases[0].from, dps: phases[0].dps, next: phases[0].start - t, shrinking: false, phase: 0 };
  for (let n = 0; n < phases.length; n++) {
    const p = phases[n];
    if (t < p.start) { z = { ...p.from, dps: p.dps, next: p.start - t, shrinking: false, phase: n }; break; }
    if (t < p.end) {
      const k = (t - p.start) / (p.end - p.start);
      z = { x: p.from.x + (p.to.x - p.from.x) * k, z: p.from.z + (p.to.z - p.from.z) * k, r: p.from.r + (p.to.r - p.from.r) * k, dps: p.dps, next: p.end - t, shrinking: true, phase: n };
      break;
    }
    z = { ...p.to, dps: p.dps, next: 0, shrinking: false, phase: n + 1 };
  }
  return z;
}
export const outsideZone = (z, x, zz) => Math.hypot(x - z.x, zz - z.z) > z.r;

// 광선이 사람 몸 상자(발 x, y, z, 너비 1, 키 P.H)에 맞는 거리 (안 맞으면 Infinity)
export function rayBody(ox, oy, oz, dx, dy, dz, bx, by, bz, r = P.R, h = P.H) {
  const b = { x0: bx - r, x1: bx + r, y0: by, y1: by + h, z0: bz - r, z1: bz + r, on: true };
  const t = rayBoxes(ox, oy, oz, dx, dy, dz, [b], 1e9);
  return t >= 1e9 ? Infinity : t;
}
// 몇 등이고 코인은 얼마
export const battleCoins = (place, kills) => kills * 5 + Math.max(0, 13 - place) * 2 + (place === 1 ? 30 : 0);

// ───── 팀전: 성 지키기 (2026-11-15 인혁: "팀전은 몬스터가 나와서 애들이랑 협동해서 성을 지키는거야") ─────
export const MONSTERS = {
  slime: { name: '슬라임', hp: 40, speed: 5, dmg: 6, r: 0.75, h: 1.4, icon: '🟢' },
  goblin: { name: '고블린', hp: 75, speed: 6.4, dmg: 9, r: 0.5, h: 2.7, icon: '👺' },
  golem: { name: '돌 골렘', hp: 340, speed: 3.2, dmg: 22, r: 0.95, h: 4.6, icon: '🗿' },
  king: { name: '킹 슬라임', hp: 1400, speed: 2.6, dmg: 40, r: 2.1, h: 4.0, icon: '👑' },
};
export const MONSTER_TYPES = Object.keys(MONSTERS);
export const DEFENSE = Object.freeze({ WAVES: 10, CORE_HP: 1000, FIRST: 10, BREAK: 12, RESPAWN: 6, TEAM: 4, SPAWN_GAP: 0.85 });
// n 번째 웨이브에 나오는 몬스터 (팀이 많을수록 조금 더 많이)
export function waveOf(n, team = DEFENSE.TEAM) {
  const k = Math.max(0.8, team / 3);
  const list = [];
  const add = (type, c) => { for (let i = 0; i < c; i++) list.push(type); };
  add('slime', Math.round((3 + n * 2) * k));
  add('goblin', Math.round(Math.max(0, n - 1) * 1.5 * k));
  add('golem', Math.floor((n / 3) * k));
  if (n === 5 || n === 10) add('king', 1);
  return list;
}
// 웨이브가 갈수록 몬스터 체력이 늘어난다 (킹 슬라임은 5번째가 더 약하다)
export const monsterHp = (type, n) => Math.round(MONSTERS[type].hp * (1 + (n - 1) * 0.08) * (type === 'king' && n === 5 ? 0.6 : 1));
export const defenseCoins = (wave, kills, won) => kills + wave * 5 + (won ? 100 : 0);

// ───── 펫 (2026-11-21 인혁: "코인 100이 있으면 속도에 버프를 주는 펫을 가질 수 있게 해줘 (알 까서)") ─────
// 적어 준 확률은 75 + 30 + 5 + 0.1 = 110% 라서, 귀한 펫은 적은 그대로 두고 강아지가 나머지(64.9%)를 갖는다.
export const EGG_PRICE = 100;
export const PETS = [
  { id: 'dog', name: '강아지', icon: '🐶', speed: 1.5, chance: 0.649, color: '#c98a4b' },
  { id: 'cat', name: '고양이', icon: '🐱', speed: 2.0, chance: 0.30, color: '#ffb347' },
  { id: 'panda', name: '판다', icon: '🐼', speed: 5.0, chance: 0.05, color: '#f4f4f4' },
  { id: 'parrot', name: '앵무새', icon: '🦜', speed: 10, chance: 0.001, color: '#3fd16b' },
];
export const petOf = id => PETS.find(p => p.id === id) ?? null;
export const petSpeed = id => petOf(id)?.speed ?? 1;
// 알 까기: 귀한 것부터 굴린다 (r 은 0 이상 1 미만)
export function hatchPet(r = Math.random()) {
  let acc = 0;
  for (const p of [...PETS].reverse()) { acc += p.chance; if (r < acc) return p.id; }
  return PETS[0].id;
}
export const chanceText = c => `${Math.round(c * 1000) / 10}%`;

// ───── 술래잡기 · 숨바꼭질 ─────
export const TAG = Object.freeze({ LOBBY_WAIT: 10, TIME: 90, HIDE: 20, SEEK: 100, PLAYERS: 6, FREEZE: 3, IMMUNE: 2, TOUCH: 1.8, END_WAIT: 5, BOT_SPEED: 0.94 });
export const TAG_MODES = ['tag', 'hide'];
// 닿았나: 옆으로 TOUCH 안, 높이 차이 2.2 안
export const touching = (a, b, r = TAG.TOUCH) => Math.hypot(a.x - b.x, a.z - b.z) < r && Math.abs(a.y - b.y) < 2.2;
// 끝났을 때 코인. 술래잡기: 술래가 아니면 15, 술래로 끝나면 3. 숨바꼭질: 이긴 편 25, 진 편 5
export function tagCoins(mode, { it = false, won = false } = {}) {
  if (mode === 'tag') return it ? 3 : 15;
  return won ? 25 : 5;
}

// ───── 달걀 도둑 (2026-11-22 인혁: "달걀을 훔치세요도 만들어줘 (거의 똑같이) 그리고 포탈이야") ─────
// 다른 사람의 게임을 베끼지 않고, 노는 방식(경비를 피해 알 훔치기 → 내 기지에서 부화 → 동물이 돈 벌기 → 신발, 새 둥지, 도둑 막기)만 같은 우리 게임.
export const EGG = Object.freeze({ PED0: 4, PED_MAX: 12, BOOTS_MAX: 10, CARRY: 0.9, LOCK: 30, LOCK_COOL: 60, RESPAWN: 8, GOLD: 0.03, GOLD_X: 3, SELL: 20 });
// 둥지 마당: 열 때 드는 돈, 알, 경비, 경비 빠르기
export const EGG_ZONES = [
  { id: 'meadow', name: '풀밭 둥지', icon: '🌾', price: 0, egg: '풀밭 알', eggColor: '#fff6e0', spot: '#ffd23f', guard: 'goose', guardName: '경비 거위', guardSpeed: 6.3, guards: 1 },
  { id: 'forest', name: '숲속 둥지', icon: '🌲', price: 500, egg: '숲 알', eggColor: '#9be07a', spot: '#2f9d63', guard: 'bear', guardName: '경비 곰', guardSpeed: 7.2, guards: 1 },
  { id: 'lava', name: '용암 둥지', icon: '🌋', price: 8000, egg: '불꽃 알', eggColor: '#ff7a3d', spot: '#ffcf33', guard: 'golem', guardName: '용암 골렘', guardSpeed: 8.2, guards: 2 },
  { id: 'cloud', name: '구름 둥지', icon: '☁️', price: 120000, egg: '무지개 알', eggColor: '#c9b6ff', spot: '#ff8fc7', guard: 'thunder', guardName: '번개 새', guardSpeed: 9.3, guards: 2 },
];
// 알에서 나오는 동물 (zone 번호, 확률, 1초에 버는 돈, 부화 시간)
export const CRITTERS = [
  { id: 'chick', name: '병아리', icon: '🐤', zone: 0, chance: 0.6, income: 1, hatch: 5 },
  { id: 'duck', name: '오리', icon: '🦆', zone: 0, chance: 0.3, income: 2, hatch: 6 },
  { id: 'bunny', name: '토끼', icon: '🐰', zone: 0, chance: 0.1, income: 4, hatch: 8 },
  { id: 'squirrel', name: '다람쥐', icon: '🐿️', zone: 1, chance: 0.6, income: 9, hatch: 10 },
  { id: 'fox', name: '여우', icon: '🦊', zone: 1, chance: 0.3, income: 15, hatch: 12 },
  { id: 'owl', name: '부엉이', icon: '🦉', zone: 1, chance: 0.1, income: 25, hatch: 14 },
  { id: 'dino', name: '아기 공룡', icon: '🦕', zone: 2, chance: 0.6, income: 70, hatch: 18 },
  { id: 'salamander', name: '불도마뱀', icon: '🦎', zone: 2, chance: 0.3, income: 110, hatch: 20 },
  { id: 'turtle', name: '화산 거북', icon: '🐢', zone: 2, chance: 0.1, income: 180, hatch: 24 },
  { id: 'unicorn', name: '유니콘', icon: '🦄', zone: 3, chance: 0.6, income: 600, hatch: 30 },
  { id: 'whale', name: '구름 고래', icon: '🐋', zone: 3, chance: 0.3, income: 1000, hatch: 34 },
  { id: 'dragon', name: '무지개 용', icon: '🐉', zone: 3, chance: 0.1, income: 2200, hatch: 40 },
];
export const critterOf = id => CRITTERS.find(c => c.id === id) ?? null;
export const critterIndex = id => CRITTERS.findIndex(c => c.id === id);
// 알 까기 (r: 0~1, g: 황금 굴리기 0~1)
export function hatchCritter(zone, r = Math.random(), g = Math.random()) {
  const list = CRITTERS.filter(c => c.zone === zone);
  let acc = 0, pick = list[0];
  for (const c of list) { acc += c.chance; if (r < acc) { pick = c; break; } }
  return { c: pick.id, gold: g < EGG.GOLD };
}
export const petIncome = p => { const c = critterOf(p?.c); return c ? c.income * (p.gold ? EGG.GOLD_X : 1) : 0; };
export const baseIncome = pets => pets.reduce((a, p) => a + (p && p.t <= 0 ? petIncome(p) : 0), 0);
export const bootsPrice = lv => Math.round(80 * Math.pow(2.3, lv));
export const bootsSpeed = lv => 1 + 0.1 * lv;
export const pedPrice = n => Math.round(150 * Math.pow(2.4, n - EGG.PED0));
export const sellValue = p => petIncome(p) * EGG.SELL;
export function cleanEgg(raw) {
  const e = { cash: 0, pets: [], boots: 0, ped: EGG.PED0, zones: 1, stolen: 0, hatched: 0, saved: 0, run: 0, xp: 0, tread: 1 };
  if (!raw || typeof raw !== 'object') return e;
  e.cash = Math.floor(num(raw.cash, 0, 1e13, 0));
  e.boots = Math.floor(num(raw.boots, 0, EGG.BOOTS_MAX, 0));
  e.ped = Math.floor(num(raw.ped, EGG.PED0, EGG.PED_MAX, EGG.PED0));
  e.zones = Math.floor(num(raw.zones, 1, EGG_ZONES.length, 1));
  for (const k of ['stolen', 'hatched', 'saved']) e[k] = Math.floor(num(raw[k], 0, 9_999_999, 0));
  e.run = Math.floor(num(raw.run, 0, RUN_MAX, 0));
  e.xp = num(raw.xp, 0, runNeed(e.run), 0);
  e.tread = Math.floor(num(raw.tread, 1, EGG_TREADS.length, 1));
  if (Array.isArray(raw.pets)) {
    for (const p of raw.pets.slice(0, e.ped)) {
      const c = critterOf(p?.c);
      e.pets.push(c ? { c: c.id, gold: !!p.gold, t: Math.max(0, Math.min(c.hatch, num(p.t, 0, 999, 0))) } : null);
    }
  }
  return e;
}

// ───── 러닝머신 (2026-11-22 인혁: "러닝머신도 만들어줘") ─────
// 벨트는 나를 안 움직이고, 올라가서 가만히 서 있으면 저절로 제자리 달리기. 달리는 동안 달리기 힘이 쌓여 레벨이 오르고, 레벨마다 3% 빨라진다.
export const RUN_MAX = 30;
export const EGG_TREADS = [
  { name: '러닝머신', icon: '🏃', mult: 1, price: 0, color: '#3fa7ff' },
  { name: '골드 러닝머신', icon: '⭐', mult: 2, price: 3000, color: '#ffcf33' },
  { name: '무지개 러닝머신', icon: '🌈', mult: 5, price: 60000, color: '#ff8fc7' },
];
export const runSpeed = lv => 1 + 0.03 * lv;
export const runNeed = lv => 8 + lv * 4; // 다음 레벨까지 달려야 하는 초 (1배 러닝머신)
// dt 초 달리기 → { run, xp, up: 오른 레벨 수 }
export function trainRun(run, xp, sec) {
  let up = 0;
  xp += sec;
  while (run < RUN_MAX && xp >= runNeed(run)) { xp -= runNeed(run); run++; up++; }
  if (run >= RUN_MAX) xp = 0;
  return { run, xp, up };
}

// 받침 있는 말이면 a(을, 이, 은), 없으면 b(를, 가, 는): josa('여우', '을', '를') → '여우를'
export function josa(word, a, b) {
  const c = String(word).charCodeAt(String(word).length - 1);
  if (!(c >= 0xac00 && c <= 0xd7a3)) return `${word}${b}`;
  return `${word}${(c - 0xac00) % 28 ? a : b}`;
}

// ───── 모닥불 캠프 (2026-11-22 인혁: "99일동안 살아남기도 만들어줘") ─────
// 다른 게임의 이야기와 괴물은 쓰지 않고, 노는 방식(낮에 나무 모으기 → 밤에 모닥불 빛 안에서 버티기 → 99일)만 비슷한 우리 게임.
export const CAMP = Object.freeze({
  DAYS: 99, DAY: 60, NIGHT: 35, LIVES: 3, HP: 100, HUNGER: 100, HUNGER_RATE: 0.5, STARVE: 2,
  FUEL_MAX: 100, WOOD_FUEL: 10, BURN_DAY: 0.35, BURN_NIGHT: 1.0, TORCH_WOOD: 5, TORCH_NIGHTS: 3, TORCH_R: 6, TORCH_MAX: 6,
  TREE_HP: 3, TREE_REGROW: 90, BUSH_REGROW: 60, BERRY: 3, BERRY_FOOD: 20, MEAT_FOOD: 45, AXE: 25, FEED_R: 4.5,
});
export const FIRE_LEVELS = [0, 20, 60, 140, 300]; // 지금까지 넣은 나무 수 → 불 레벨 1~5
export const fireLevel = fed => FIRE_LEVELS.filter(n => fed >= n).length;
export const fireRadius = (lv, fuel) => (fuel > 0 ? 7 + lv * 3 : 0) * (fuel > 0 && fuel < 15 ? 0.6 + (fuel / 15) * 0.4 : 1);
// n 번째 밤의 괴물: 그림자 늑대 수와 체력, 10일마다 보스
export function nightMonsters(day) {
  const wolves = Math.min(18, 2 + Math.floor(day / 3));
  return { wolves, wolfHp: 50 + day * 2, wolfDmg: 8 + Math.floor(day / 10) * 2, boss: day % 10 === 0, bossHp: 400 + day * 12 };
}
// 하루를 버틸 때 받는 코인
export const dayCoins = day => 2 + ({ 10: 20, 25: 50, 50: 100, 75: 150, 99: 500 }[day] ?? 0);
export function freshCamp() {
  return { day: 1, t: 0, lives: CAMP.LIVES, hp: CAMP.HP, hunger: CAMP.HUNGER, wood: 0, berry: 3, meat: 0, cooked: 0, fed: 0, cubs: [], opened: [], axe: 0, armor: 0, lantern: false, fuel: 60, torches: [], best: 0, wins: 0, runs: 0 };
}
export function cleanCamp(raw) {
  const c = freshCamp();
  if (!raw || typeof raw !== 'object') return c;
  c.day = Math.floor(num(raw.day, 1, CAMP.DAYS, 1));
  c.t = num(raw.t, 0, CAMP.DAY + CAMP.NIGHT, 0);
  c.lives = Math.floor(num(raw.lives, 1, CAMP.LIVES, CAMP.LIVES));
  c.hp = num(raw.hp, 1, CAMP.HP, CAMP.HP);
  c.hunger = num(raw.hunger, 0, CAMP.HUNGER, CAMP.HUNGER);
  for (const k of ['wood', 'berry', 'meat', 'cooked']) c[k] = Math.floor(num(raw[k], 0, 9999, c[k]));
  c.fed = Math.floor(num(raw.fed, 0, 999_999, 0));
  c.fuel = num(raw.fuel, 0, CAMP.FUEL_MAX, 60);
  c.torches = Array.isArray(raw.torches) ? raw.torches.slice(0, CAMP.TORCH_MAX).filter(t => Array.isArray(t) && t.slice(0, 3).every(Number.isFinite)).map(([x, z, n]) => [Math.max(-90, Math.min(90, x)), Math.max(-90, Math.min(90, z)), Math.max(1, Math.min(CAMP.TORCH_NIGHTS, Math.floor(n)))]) : [];
  c.cubs = Array.isArray(raw.cubs) ? CUBS.map(u => u.id).filter(id => raw.cubs.includes(id)) : [];
  c.opened = Array.isArray(raw.opened) ? raw.opened.filter(o => Array.isArray(o) && Number.isInteger(o[0]) && o[0] >= 0 && o[0] < 500 && Number.isInteger(o[1])).slice(0, 200).map(([i, d]) => [i, Math.max(1, Math.min(CAMP.DAYS, d))]) : [];
  c.axe = Math.floor(num(raw.axe, 0, AXES.length - 1, 0));
  c.armor = Math.floor(num(raw.armor, 0, ARMORS.length - 1, 0));
  c.lantern = !!raw.lantern;
  c.best = Math.floor(num(raw.best, 0, CAMP.DAYS, 0));
  c.wins = Math.floor(num(raw.wins, 0, 99_999, 0));
  c.runs = Math.floor(num(raw.runs, 0, 99_999, 0));
  return c;
}

// 길 잃은 아기 동물 (2026-11-22 인혁: "사슴 괴물이랑 아이들도 넣어" → 그 게임의 캐릭터 대신 우리 캐릭터).
// 숲 끝에서 울고 있는 아기 동물을 모닥불까지 데려오면 구조. 구한 동물마다 도와주는 힘이 하나씩.
export const CUBS = [
  { id: 'fox', name: '아기 여우', look: 'fox', icon: '🦊', perk: '아침마다 🪵 나무 5개를 물어 와' },
  { id: 'bear', name: '아기 곰', look: 'bear', icon: '🐻', perk: '늑대한테 30% 덜 아파' },
  { id: 'bunny', name: '아기 토끼', look: 'bunny', icon: '🐰', perk: '🫐 열매를 2배로 따' },
  { id: 'owl', name: '아기 부엉이', look: 'owl', icon: '🦉', perk: '🔥 불빛이 3칸 더 넓어져' },
];
// 그림자 사냥꾼: 2일째 밤부터 한 마리. 도끼로는 못 쓰러뜨리고 잠깐 얼린다. 빛 안에는 못 들어오고 횃불을 끈다.
export const STALKER = Object.freeze({ FROM: 2, SPEED: 7.4, DMG: 30, STUN: 3, WARN: 26, DELAY: 8 });

// ───── 파밍 (2026-11-22 인혁: "맵 엄청 넓혀 그리고 파밍도 할 수 있게 해줘") ─────
// 숲 곳곳의 보물 상자: 🟫 나무(가까운 숲) · ⬜ 쇠(먼 숲, 오두막) · 🟨 황금(섬 끝, 바위 언덕). 연 상자는 3일 뒤에 다시 찬다.
// 도끼, 갑옷, 랜턴은 한 번 얻으면 처음부터 다시 해도 그대로 남는다.
export const AXES = [{ name: '돌 도끼', icon: '🪓', dmg: 25, chop: 1 }, { name: '쇠 도끼', icon: '⛏️', dmg: 40, chop: 2 }, { name: '황금 도끼', icon: '✨', dmg: 60, chop: 3 }];
export const ARMORS = [{ name: '옷만', cut: 0 }, { name: '가죽 갑옷', cut: 0.15 }, { name: '쇠 갑옷', cut: 0.3 }, { name: '황금 갑옷', cut: 0.45 }];
export const CHESTS = [{ name: '나무 상자', color: '#a0612f', band: '#5b3a22' }, { name: '쇠 상자', color: '#9aa3b5', band: '#4a4f5c' }, { name: '황금 상자', color: '#ffcf33', band: '#b8860b' }];
export const LANTERN_R = 5;
export const CHEST_REFILL = 3;
// 상자 하나 열기: rnd 는 0~1 을 주는 함수. gear 는 지금 가진 도끼·갑옷·랜턴 (더 좋은 것만 준다)
export function chestLoot(tier, rnd, gear = { axe: 0, armor: 0, lantern: false }) {
  const T = [
    { wood: [3, 6], berry: 0.5, cooked: [0.3, 1], coins: [0.25, 3], armor: [0.12, 1], axe: [0.08, 1], lantern: 0 },
    { wood: [6, 10], berry: 0.4, cooked: [0.7, 2], coins: [0.6, 8], armor: [0.3, 2], axe: [0.35, 1], lantern: 0.18 },
    { wood: [10, 15], berry: 0.3, cooked: [1, 3], coins: [1, 25], armor: [0.4, 3], axe: [0.45, 2], lantern: 0.35 },
  ][tier] ?? null;
  if (!T) return null;
  const out = { wood: T.wood[0] + Math.floor(rnd() * (T.wood[1] - T.wood[0] + 1)), berry: 0, cooked: 0, coins: 0 };
  if (rnd() < T.berry) out.berry = 3;
  if (rnd() < T.cooked[0]) out.cooked = T.cooked[1];
  if (rnd() < T.coins[0]) out.coins = T.coins[1];
  if (rnd() < T.armor[0] && gear.armor < T.armor[1]) out.armor = Math.min(gear.armor + 1, T.armor[1]);
  if (rnd() < T.axe[0] && gear.axe < T.axe[1]) out.axe = Math.min(gear.axe + 1, T.axe[1]);
  if (rnd() < T.lantern && !gear.lantern) out.lantern = true;
  return out;
}
