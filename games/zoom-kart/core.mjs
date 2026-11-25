// 씽씽 카트 · 규칙과 계산 (화면 없이 돌아가는 부분). 테스트는 core.test.mjs.
export const SAVE_KEY = 'zoom-kart-save-v1';
export const GAME = 'zoom-kart', MAX_PLAYERS = 4; // 같이 하기: 공용 서버 방 이름과 사람 수
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
export function rng32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ── 고를 수 있는 것들 ──
export const RACERS = [
  { id: 'jelly', name: '말랑이', emoji: '🍓', color: 0xff5d73, ears: 'drop' },
  { id: 'ham', name: '콩떡이', emoji: '🐹', color: 0xf6c98a, ears: 'round' },
  { id: 'bear', name: '반달이', emoji: '🐻', color: 0x5b4a42, ears: 'round' },
  { id: 'cat', name: '나비', emoji: '🐱', color: 0xffa23e, ears: 'point' },
  { id: 'bunny', name: '깡총이', emoji: '🐰', color: 0xf4f1ff, ears: 'long' },
  { id: 'pengu', name: '뒤뚱이', emoji: '🐧', color: 0x3c4f76, ears: 'none' },
  { id: 'robo', name: '삐뽀', emoji: '🤖', color: 0x9fb4c7, ears: 'antenna' },
  { id: 'dino', name: '크앙이', emoji: '🦖', color: 0x58c36b, ears: 'spike' },
];
export const KARTS = [
  { id: 'basic', name: '말랑 카트', price: 0, color: 0xff4d5e, speed: 1.0, accel: 1.0, turn: 1.0, drift: 1.0 },
  { id: 'spin', name: '빙글 카트', price: 300, color: 0x39c2ff, speed: 0.99, accel: 1.02, turn: 1.1, drift: 1.2 },
  { id: 'bolt', name: '번개 카트', price: 600, color: 0xffd23e, speed: 1.05, accel: 0.96, turn: 0.97, drift: 1.0 },
  { id: 'rocket', name: '로켓 카트', price: 1200, color: 0x9b6bff, speed: 1.07, accel: 1.1, turn: 1.02, drift: 1.08 },
  { id: 'gold', name: '황금 카트', price: 3000, color: 0xffb400, speed: 1.1, accel: 1.12, turn: 1.06, drift: 1.15 },
];
export const ITEMS = {
  boost: { name: '로켓 부스터', emoji: '🚀' },
  jelly: { name: '미끌 젤리', emoji: '🍮' },
  bee: { name: '따라가 꿀벌', emoji: '🐝' },
  snow: { name: '눈덩이', emoji: '❄️' },
  shield: { name: '방울 방패', emoji: '🫧' },
  cloud: { name: '먹구름', emoji: '🌩️' },
};
export const DIFFS = [
  { id: 'easy', name: '쉬움', mul: 0.84, coin: 1 },
  { id: 'normal', name: '보통', mul: 0.92, coin: 1.3 },
  { id: 'hard', name: '어려움', mul: 0.99, coin: 1.6 },
];
export const MODES = [
  { id: 'item', name: '아이템전', desc: '상자를 먹고 아이템으로 역전!' },
  { id: 'speed', name: '스피드전', desc: '드리프트로 부스터를 모아요' },
  { id: 'time', name: '혼자 기록 재기', desc: '혼자 달려서 최고 기록에 도전' },
];
export const TRACKS = [
  { id: 'forest', name: '말랑 숲 서킷', theme: 'forest', star: 1, half: 8,
    pts: [[0, -70], [70, -72], [130, -50], [150, 10], [115, 65], [45, 60], [0, 95], [-70, 100], [-130, 60], [-140, -10], [-100, -60], [-50, -68]] },
  { id: 'beach', name: '반짝 모래 해변', theme: 'beach', star: 2, half: 7.5,
    pts: [[0, -95], [80, -98], [150, -75], [165, -5], [110, 25], [85, 85], [125, 140], [70, 185], [-20, 160], [-45, 90], [-115, 65], [-165, 10], [-140, -65], [-70, -90]] },
  { id: 'snow', name: '눈꽃 고개', theme: 'snow', star: 3, half: 7, laps: 2,
    pts: [[0, -105], [90, -108], [165, -80], [170, -5], [95, 10], [65, 65], [135, 95], [150, 165], [70, 195], [-5, 155], [-20, 85], [-85, 55], [-105, 135], [-175, 135], [-195, 45], [-155, -50], [-80, -95]] },
  { id: 'city', name: '네온 시티', theme: 'city', star: 3, half: 7, laps: 2,
    pts: [[0, -125], [110, -125], [175, -100], [185, -25], [125, 0], [120, 60], [180, 95], [170, 165], [90, 175], [55, 115], [-5, 100], [-40, 160], [-120, 175], [-175, 125], [-165, 45], [-95, 20], [-90, -40], [-160, -70], [-145, -125], [-70, -130]] },
  { id: 'volcano', name: '부글부글 화산', theme: 'volcano', star: 4, half: 7, laps: 2,
    pts: [[0, -110], [100, -112], [170, -70], [150, 0], [190, 70], [130, 130], [60, 90], [20, 150], [-60, 170], [-90, 100], [-40, 40], [-110, 0], [-180, 40], [-210, -40], [-150, -100], [-70, -105]] },
  { id: 'cloud', name: '무지개 구름길', theme: 'cloud', star: 5, half: 6.5, laps: 2,
    pts: [[0, -140], [120, -140], [200, -100], [210, -20], [150, 20], [160, 90], [220, 140], [180, 210], [90, 200], [60, 130], [0, 110], [-30, 180], [-110, 210], [-180, 160], [-150, 90], [-200, 30], [-230, -50], [-170, -110], [-100, -80], [-60, -135]] },
];
export const LAPS = 3;
export const WALL_PAD = 3; // 도로 밖 풀밭 폭. 그 뒤는 벽
export const BASE_SPEED = 34, ACC = 16, BRAKE = 34, REVERSE = 9, TURN = 1.9, DRIFT_MIN = 13;
export const BOOST_T = 2.6;
export const REWARD = [100, 70, 50, 40, 30, 20, 15, 10];

// ── 트랙 만들기: 점들을 부드러운 닫힌 곡선으로 잇고 2m 간격으로 자른다 ──
const trackCache = new Map();
export function buildTrack(id) {
  if (trackCache.has(id)) return trackCache.get(id);
  const def = TRACKS.find((t) => t.id === id);
  if (!def) throw new Error('없는 트랙: ' + id);
  const P = def.pts, m = P.length, dense = [], SUB = 24;
  for (let i = 0; i < m; i++) {
    const p0 = P[(i - 1 + m) % m], p1 = P[i], p2 = P[(i + 1) % m], p3 = P[(i + 2) % m];
    for (let j = 0; j < SUB; j++) {
      const t = j / SUB, t2 = t * t, t3 = t2 * t, q = [0, 0];
      for (let c = 0; c < 2; c++) q[c] = 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3);
      dense.push(q);
    }
  }
  const M = dense.length, cum = [0];
  for (let i = 1; i <= M; i++) cum[i] = cum[i - 1] + Math.hypot(dense[i % M][0] - dense[i - 1][0], dense[i % M][1] - dense[i - 1][1]);
  const L = cum[M], n = Math.round(L / 2), ds = L / n;
  const x = new Float64Array(n), z = new Float64Array(n);
  for (let k = 0, j = 0; k < n; k++) {
    const target = k * ds;
    while (cum[j + 1] < target) j++;
    const f = (target - cum[j]) / (cum[j + 1] - cum[j] || 1), a = dense[j], b = dense[(j + 1) % M];
    x[k] = a[0] + (b[0] - a[0]) * f; z[k] = a[1] + (b[1] - a[1]) * f;
  }
  const tx = new Float64Array(n), tz = new Float64Array(n), h = new Float64Array(n), curv = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const a = (k - 1 + n) % n, b = (k + 1) % n, dx = x[b] - x[a], dz = z[b] - z[a], len = Math.hypot(dx, dz) || 1;
    tx[k] = dx / len; tz[k] = dz / len; h[k] = Math.atan2(dx, dz);
  }
  for (let k = 0; k < n; k++) curv[k] = wrap(h[(k + 1) % n] - h[(k - 1 + n) % n]) / (2 * ds);
  // 옆 방향(n)은 (tz, -tx). 곡률이 +면 +n 쪽이 안쪽.
  const T = { id, def, name: def.name, theme: def.theme, half: def.half, wall: def.half + WALL_PAD, n, ds, length: L, x, z, tx, tz, h, curv, pads: [] };
  // 부스터 발판: 곧은 길 세 곳에 놓는다 (밟으면 잠깐 빨라진다)
  [0.22, 0.48, 0.74].forEach((f, pi) => {
    for (let i = Math.round(n * f), tries = 0; tries < n / 4; i++, tries++) {
      let straight = true;
      for (let o = -4; o <= 10; o++) if (Math.abs(curv[(i + o + n) % n]) > 0.012) { straight = false; break; }
      if (!straight) continue;
      const idx = i % n, d = (pi % 2 ? 1 : -1) * def.half * 0.4;
      T.pads.push({ idx, d, x: x[idx] + tz[idx] * d, z: z[idx] - tx[idx] * d, h: h[idx] });
      break;
    }
  });
  trackCache.set(id, T);
  return T;
}
// 트랙 위 (s: 조각 번호(소수 가능), d: 옆으로 벗어난 거리) → 좌표
export function trackPos(T, s, d = 0) {
  const n = T.n; s = ((s % n) + n) % n;
  const i = Math.floor(s), f = s - i, j = (i + 1) % n;
  const px = T.x[i] + (T.x[j] - T.x[i]) * f, pz = T.z[i] + (T.z[j] - T.z[i]) * f;
  return { x: px + T.tz[i] * d, z: pz - T.tx[i] * d, h: T.h[i] };
}
function locate(T, k) {
  const n = T.n; let best = k.idx, bd = Infinity;
  for (let o = -10; o <= 10; o++) {
    const i = (k.idx + o + n) % n, dx = k.x - T.x[i], dz = k.z - T.z[i], dd = dx * dx + dz * dz;
    if (dd < bd) { bd = dd; best = i; }
  }
  const delta = best - k.idx;
  if (delta < -n / 2) k.lap++; else if (delta > n / 2) k.lap--;
  k.idx = best;
  const dx = k.x - T.x[best], dz = k.z - T.z[best];
  k.d = dx * T.tz[best] - dz * T.tx[best];
  k.prog = best + clamp((dx * T.tx[best] + dz * T.tz[best]) / T.ds, -0.5, 0.5);
  k.total = k.lap * n + k.prog;
}

// ── 경주 만들기 ──
export function createRace(opt = {}) {
  const T = buildTrack(opt.track || 'forest');
  const mode = opt.mode || 'item', diff = DIFFS[clamp(opt.difficulty ?? 1, 0, 2)];
  const rnd = rng32(opt.seed ?? 1);
  // 같이 하기: slots = [{ kind: 'me' | 'remote' | 'ai', racer, kart, peer }] (racer, kart 는 번호). 내 것과 (방장이면) 컴퓨터 카트만 내가 계산한다.
  const slots = Array.isArray(opt.slots) ? opt.slots : null;
  const count = slots ? slots.length : mode === 'time' ? 1 : 8;
  const playerRacer = opt.racer || 'jelly';
  const others = RACERS.filter((r) => r.id !== playerRacer);
  const race = { track: T, mode, diff, laps: opt.laps || T.def.laps || LAPS, t: 0, state: 'countdown', countdown: 3.6, karts: [], boxes: [], traps: [], shots: [], events: [], rnd, endT: Infinity, order: [], online: !!slots };
  const playerSlot = slots ? Math.max(0, slots.findIndex((x) => x.kind === 'me')) : count === 1 ? 0 : 5;
  let ai = 0;
  for (let slot = 0; slot < count; slot++) {
    const isPlayer = slot === playerSlot;
    const sd = slots ? slots[slot] : null, kind = sd ? sd.kind : isPlayer ? 'me' : 'ai';
    const racer = sd ? RACERS[sd.racer] || RACERS[0] : isPlayer ? RACERS.find((r) => r.id === playerRacer) || RACERS[0] : others[ai];
    const kart = sd ? KARTS[sd.kart] || KARTS[0] : isPlayer ? (KARTS.find((c) => c.id === opt.kart) || KARTS[0]) : KARTS[(ai * 2 + 1) % 4];
    const back = 8 + Math.floor(slot / 2) * 6, side = (slot % 2 ? 1 : -1) * T.half * 0.42;
    const p = trackPos(T, T.n - back / T.ds, side);
    const k = {
      i: slot, player: isPlayer, kind, peer: sd ? sd.peer || '' : '', owned: !slots || kind === 'me' || (kind === 'ai' && !!opt.host), net: null, gone: false, shotN: 0, racer, kart, x: p.x, z: p.z, h: p.h, mv: p.h, s: 0,
      idx: Math.round(T.n - back / T.ds) % T.n, lap: -1, prog: 0, total: 0, d: side,
      steer: 0, drifting: false, driftDir: 0, driftT: 0, slip: 0, gauge: 0,
      boostT: 0, turboT: 0, spinT: 0, shieldT: 0, slowT: 0, safeT: 0, wallT: 0, padT: 0,
      items: [], rollT: 0, finished: false, finishT: 0, rank: slot + 1, lapStart: 0, lapTimes: [], bestLap: 0,
      offroad: false, wrong: false, stuckT: 0, wrongT: 0, gasAt: -1, prevGas: false, prevUse: false,
      // 컴퓨터 실력: 뒤 번호일수록 조금 느리다
      ai: { skill: kind !== 'ai' ? 1 : 1 - ai * 0.012, off: side, wT: 0, useT: 1 + rnd() * 2, drift: false, mul: 1 },
    };
    if (kind === 'ai') ai++;
    locate(T, k); k.lap = -1; k.total = k.lap * T.n + k.prog;
    race.karts.push(k);
  }
  race.player = race.karts[playerSlot];
  if (mode === 'item') {
    for (const f of [0.1, 0.34, 0.58, 0.82]) for (let c = 0; c < 4; c++) {
      const idx = Math.round(T.n * f), d = (c - 1.5) * T.half * 0.44, p = trackPos(T, idx, d);
      race.boxes.push({ x: p.x, z: p.z, idx, d, off: 0 });
    }
  }
  rankAll(race);
  return race;
}

const ev = (race, type, kart, extra) => race.events.push({ type, kart, ...extra });

function endDrift(race, k, reward) {
  if (!k.drifting) return;
  k.drifting = false;
  if (reward && k.driftT >= 0.7) {
    const lv = k.driftT >= 2.4 ? 3 : k.driftT >= 1.4 ? 2 : 1;
    k.turboT = Math.max(k.turboT, [0, 0.6, 1.0, 1.5][lv]);
    ev(race, 'turbo', k, { lv });
  }
  k.driftT = 0;
}

export function hitKart(race, k, kind, by) {
  if (k.safeT > 0 || k.finished) return false;
  if (k.shieldT > 0) { k.shieldT = 0; k.safeT = 0.6; ev(race, 'block', k); return false; }
  endDrift(race, k, false);
  k.boostT = 0; k.turboT = 0; k.safeT = 2.2;
  if (kind === 'cloud') { k.slowT = 3; k.spinT = 0.6; } else k.spinT = 1.2;
  ev(race, 'hit', k, { kind, by });
  return true;
}

export function rollItem(race, k) {
  const n = race.karts.length, r = n > 1 ? (k.rank - 1) / (n - 1) : 0, x = race.rnd();
  const w = { boost: 1 + 2.2 * r, jelly: 1.8 - 1.3 * r, bee: 0.4 + 2 * r, snow: 1.1, shield: 1.3 - 0.5 * r, cloud: r > 0.35 ? 1.6 * r : 0 };
  let sum = 0; for (const key in w) sum += w[key];
  let acc = 0; for (const key in w) { acc += w[key] / sum; if (x < acc) return key; }
  return 'boost';
}

export function fireItem(race, k) {
  if (!k.items.length || k.rollT > 0 || k.spinT > 0) return null;
  const T = race.track, item = k.items.shift(), id = k.i * 100000 + ++k.shotN;
  let spawn = null; // 다른 사람에게 알려 줄 숫자들
  if (item === 'boost') { k.boostT = BOOST_T; }
  else if (item === 'shield') { k.shieldT = 8; }
  else if (item === 'jelly') spawn = [id, k.x - Math.sin(k.h) * 2.6, k.z - Math.cos(k.h) * 2.6];
  else if (item === 'snow') spawn = [id, k.prog + 1.5, clamp(k.d, -T.half + 1, T.half - 1)];
  else if (item === 'bee') { const ahead = race.karts.find((o) => o.rank === k.rank - 1 && !o.gone); spawn = [id, k.prog + 1.5, k.d, ahead ? ahead.i : -1]; }
  else if (item === 'cloud') { const lead = race.karts.find((o) => o.rank === (k.rank === 1 ? 2 : 1) && !o.gone); if (lead) spawn = [id, lead.i]; }
  if (spawn) spawnItem(race, k.i, item, spawn);
  ev(race, 'use', k, { item, spawn });
  return item;
}
// 함정이나 날아가는 것을 만든다. 같이 하기에서는 다른 사람이 쓴 것도 이걸로 만든다.
export function spawnItem(race, owner, item, sp) {
  const T = race.track, K = race.karts;
  if (!Array.isArray(sp) || !sp.every(Number.isFinite) || !K[owner]) return false;
  const id = sp[0];
  if (race.traps.some((t) => t.id === id) || race.shots.some((t) => t.id === id)) return false;
  if (item === 'jelly' && sp.length >= 3) race.traps.push({ id, x: sp[1], z: sp[2], owner, arm: 0.5, life: 45 });
  else if (item === 'snow' && sp.length >= 3) { const p = trackPos(T, sp[1], sp[2]); race.shots.push({ id, type: 'snow', s: sp[1], d: clamp(sp[2], -T.half, T.half), owner, life: 4, x: p.x, z: p.z }); }
  else if (item === 'bee' && sp.length >= 4) { const p = trackPos(T, sp[1], sp[2]); race.shots.push({ id, type: 'bee', s: sp[1], d: clamp(sp[2], -T.wall, T.wall), owner, target: K[sp[3]] ? sp[3] : -1, life: 9, x: p.x, z: p.z }); }
  else if (item === 'cloud' && K[sp[1]]) race.shots.push({ id, type: 'cloud', owner, target: sp[1], life: 0.9, x: K[sp[1]].x, z: K[sp[1]].z, s: 0, d: 0 });
  else return false;
  return true;
}
export function removeItem(race, id) {
  race.traps = race.traps.filter((t) => t.id !== id); race.shots = race.shots.filter((t) => t.id !== id);
}

// ── 같이 하기: 다른 사람이 계산한 카트 ──
// 자리 정하기. humans = [[사람 번호, 선수 번호, 카트 번호], ...] (번호 순). 모두가 같은 목록으로 같은 자리를 만든다.
export function makeSlots(humans, me) {
  const int = (v, max) => (Number.isInteger(v) && v >= 0 && v < max ? v : 0);
  const list = humans.filter((h) => Array.isArray(h) && Number.isInteger(h[0])).slice(0, MAX_PLAYERS);
  const slots = list.map((h) => ({ kind: h[0] === me ? 'me' : 'remote', racer: int(h[1], RACERS.length), kart: int(h[2], KARTS.length), peer: 'p' + h[0] }));
  const used = new Set(slots.map((x) => x.racer));
  for (let r = 0, c = 0; r < RACERS.length && slots.length < 8; r++) if (!used.has(r)) slots.push({ kind: 'ai', racer: r, kart: (c++ * 2 + 1) % 4, peer: '' });
  return slots;
}
const FLAG = { drift: 1, boost: 2, turbo: 4, spin: 8, shield: 16, slow: 32, safe: 64 };
const r2 = (v) => Math.round(v * 100) / 100;
export function snapOf(k) {
  const f = (k.drifting ? 1 : 0) | (k.boostT > 0 ? 2 : 0) | (k.turboT > 0 ? 4 : 0) | (k.spinT > 0 ? 8 : 0) | (k.shieldT > 0 ? 16 : 0) | (k.slowT > 0 ? 32 : 0) | (k.safeT > 0 ? 64 : 0);
  return [k.i, r2(k.x), r2(k.z), r2(k.h), r2(k.mv), r2(k.s), k.lap, k.idx, f, r2(k.steer)];
}
export function applySnap(race, a, from, hostId) {
  if (!Array.isArray(a) || a.length < 10 || !a.every(Number.isFinite)) return false;
  const k = race.karts[a[0]], T = race.track;
  if (!k || k.owned || k.gone) return false;
  if (from !== undefined && !(k.kind === 'remote' ? k.peer === from : from === hostId)) return false; // 자기 카트만 보낼 수 있다
  if (!k.net) { k.net = { age: 0 }; k.x = a[1]; k.z = a[2]; k.h = a[3]; k.mv = a[4]; }
  const n = k.net; n.x = a[1]; n.z = a[2]; n.h = a[3]; n.mv = a[4]; n.s = clamp(a[5], -REVERSE, BASE_SPEED * 2); n.age = 0;
  n.lap = clamp(Math.round(a[6]), -1, race.laps); n.idx = clamp(Math.round(a[7]), 0, T.n - 1);
  const f = a[8] | 0;
  k.drifting = !!(f & FLAG.drift); k.boostT = f & FLAG.boost ? 0.3 : 0; k.turboT = f & FLAG.turbo ? 0.3 : 0; k.spinT = f & FLAG.spin ? 0.3 : 0;
  k.shieldT = f & FLAG.shield ? 0.3 : 0; k.slowT = f & FLAG.slow ? 0.3 : 0; k.safeT = f & FLAG.safe ? 0.3 : 0;
  k.steer = clamp(a[9], -1, 1); k.driftDir = Math.sign(k.steer);
  return true;
}
function stepRemote(race, k, dt) {
  const T = race.track, n = k.net;
  if (!n) return;
  n.age += dt;
  const lead = Math.min(n.age, 0.3), ex = n.x + Math.sin(n.mv) * n.s * lead, ez = n.z + Math.cos(n.mv) * n.s * lead, f = Math.min(1, 14 * dt);
  k.x += (ex - k.x) * f; k.z += (ez - k.z) * f; k.h += wrap(n.h - k.h) * f; k.mv += wrap(n.mv - k.mv) * f; k.s = n.s; k.slip = wrap(k.h - k.mv);
  k.driftT = k.drifting ? k.driftT + dt : 0;
  const i = k.idx = n.idx, dx = k.x - T.x[i], dz = k.z - T.z[i];
  k.d = dx * T.tz[i] - dz * T.tx[i]; k.prog = i + clamp((dx * T.tx[i] + dz * T.tz[i]) / T.ds, -0.5, 0.5);
  if (!k.finished) k.lap = n.lap;
  k.total = k.lap * T.n + k.prog; k.offroad = Math.abs(k.d) > T.half + 0.4;
}
// 다른 사람의 카트가 골인했다는 소식
export function applyFinish(race, slot, time, bestLap, from, hostId) {
  const k = race.karts[slot];
  if (!k || k.owned || k.gone || k.finished || !Number.isFinite(time) || time <= 0) return false;
  if (from !== undefined && !(k.kind === 'remote' ? k.peer === from : from === hostId)) return false;
  k.finished = true; k.finishT = time; k.lap = race.laps; if (Number.isFinite(bestLap) && bestLap > 0) k.bestLap = bestLap;
  if (race.endT === Infinity) race.endT = race.t + 15;
  ev(race, 'finish', k);
  return true;
}
// 방장이 바뀌면 컴퓨터 카트를 새 방장이 이어서 계산한다
export function setHost(race, isHost) {
  for (const k of race.karts) if (k.kind === 'ai' && !k.gone) { if (isHost && !k.owned) k.net = null; k.owned = !!isHost; }
}
// 친구가 나갔다: 그 카트를 뺀다
export function dropPeer(race, peer) {
  let n = 0;
  for (const k of race.karts) if (k.kind === 'remote' && k.peer === peer && !k.gone) { k.gone = true; n++; }
  rankAll(race);
  return n;
}

// ── 컴퓨터 운전 ──
function aiInput(race, k, dt) {
  const T = race.track, n = T.n, a = k.ai, sp = Math.abs(k.s);
  a.wT -= dt;
  if (a.wT <= 0) { a.wT = 1.5 + race.rnd() * 2.5; a.off = (race.rnd() * 2 - 1) * T.half * 0.5; }
  const la = Math.round(5 + sp * 0.3);
  let cmax = 0, csum = 0;
  for (let o = 2; o <= la + 6; o++) { const c = T.curv[(k.idx + o) % n]; csum += c; if (Math.abs(c) > cmax) cmax = Math.abs(c); }
  const off = clamp(a.off + clamp(csum * 2.2, -1, 1) * T.half * 0.55, -T.half + 1.6, T.half - 1.6);
  const p = trackPos(T, k.idx + la, off);
  const err = wrap(Math.atan2(p.x - k.x, p.z - k.z) - k.h);
  const steer = clamp(-err * 2.6, -1, 1);
  const vSafe = cmax > 0.004 ? (TURN * k.kart.turn * 1.25) / cmax : 999;
  const want = cmax > 0.05 && sp > DRIFT_MIN + 4 && Math.abs(steer) > 0.45 && a.skill > 0.9;
  a.drift = want && (a.drift || race.rnd() < 0.25);
  let use = false;
  if (k.items.length && k.rollT <= 0) {
    a.useT -= dt;
    const it = k.items[0];
    const ok = it === 'boost' ? cmax < 0.03 && !k.offroad && k.boostT <= 0 : it === 'shield' ? k.shieldT <= 0 : true;
    if (a.useT <= 0 && ok) { use = true; a.useT = 1 + race.rnd() * 3; }
  }
  return { steer, gas: sp < vSafe * 1.1, brake: sp > vSafe * 1.6, drift: a.drift, use };
}

function resetKart(race, k) {
  const T = race.track, p = trackPos(T, k.idx, 0);
  k.x = p.x; k.z = p.z; k.h = k.mv = T.h[k.idx]; k.s = 0; k.d = 0; k.stuckT = 0; k.wrongT = 0; k.spinT = 0; k.safeT = 1.5;
  endDrift(race, k, false);
  ev(race, 'reset', k);
}
export function requestReset(race) { if (race.state === 'race' && !race.player.finished) resetKart(race, race.player); }

function stepKart(race, k, inp, dt) {
  const T = race.track, st = k.kart, racing = race.state !== 'countdown';
  const can = racing && k.spinT <= 0;
  const steer = can ? clamp(inp.steer || 0, -1, 1) : 0, gas = can && !!inp.gas, brake = can && !!inp.brake;
  for (const key of ['boostT', 'turboT', 'spinT', 'shieldT', 'slowT', 'safeT', 'rollT', 'wallT', 'padT']) if (k[key] > 0) k[key] = Math.max(0, k[key] - dt);
  k.steer += (steer - k.steer) * Math.min(1, 12 * dt);
  // 드리프트 시작과 끝
  if (!k.drifting && can && inp.drift && Math.abs(steer) > 0.3 && k.s > DRIFT_MIN) { k.drifting = true; k.driftDir = Math.sign(steer); k.driftT = 0; ev(race, 'drift', k); }
  if (k.drifting && (!inp.drift || k.s < DRIFT_MIN * 0.6 || !can)) endDrift(race, k, can);
  // 방향
  const sf = clamp(k.s / 10, -1, 1);
  let rate;
  if (k.drifting) { rate = TURN * st.turn * 1.3 * (k.driftDir * 0.62 + steer * 0.58); k.driftT += dt; }
  else rate = TURN * st.turn * steer * sf * (1 - 0.18 * clamp(Math.abs(k.s) / BASE_SPEED, 0, 1));
  if (k.spinT <= 0) k.h -= rate * dt;
  // 미끄러짐: 가는 방향이 차 방향을 천천히 따라온다
  const grip = k.drifting ? 3.1 / st.drift + 0.4 : 10;
  if (k.s >= 0) k.mv += wrap(k.h - k.mv) * (1 - Math.exp(-grip * dt)); else k.mv = k.h;
  k.slip = wrap(k.h - k.mv);
  // 속도
  k.offroad = Math.abs(k.d) > T.half + 0.4;
  let top = BASE_SPEED * st.speed * (k.player && !k.finished ? 1 : k.ai.mul);
  if (k.boostT > 0) top *= 1.42; else if (k.turboT > 0) top *= 1.22;
  if (k.slowT > 0) top *= 0.6;
  if (k.offroad && k.boostT <= 0) top *= 0.55;
  if (k.drifting) top *= 1 - 0.1 * Math.min(1, Math.abs(k.slip));
  const acc = ACC * st.accel * (k.boostT > 0 ? 2.4 : k.turboT > 0 ? 1.7 : 1);
  if (k.spinT > 0) k.s -= k.s * Math.min(1, 2.2 * dt);
  else if (gas && !brake) { if (k.s < top) k.s = Math.min(top, k.s + acc * dt); }
  else if (brake) k.s = Math.max(-REVERSE, k.s - (k.s > 0 ? BRAKE : ACC * 0.6) * dt);
  else k.s -= k.s * Math.min(1, 0.8 * dt);
  if (k.s > top) k.s -= (k.s - top) * Math.min(1, 2.2 * dt);
  // 게이지 (스피드전, 혼자 달리기)
  if (k.drifting && race.mode !== 'item' && k.s > DRIFT_MIN) {
    k.gauge += Math.abs(k.slip) * 0.52 * st.drift * dt;
    if (k.gauge >= 1) { if (k.items.length < 2) { k.items.push('boost'); k.gauge = 0; ev(race, 'charged', k); } else k.gauge = 1; }
  }
  k.x += Math.sin(k.mv) * k.s * dt; k.z += Math.cos(k.mv) * k.s * dt;
  locate(T, k);
  // 벽
  const lim = T.wall - 1.5; // 카트 몸이 벽을 뚫고 보이지 않게
  if (Math.abs(k.d) > lim) {
    const i = k.idx, sg = Math.sign(k.d), over = Math.abs(k.d) - lim, nx = T.tz[i], nz = -T.tx[i];
    k.x -= nx * sg * over; k.z -= nz * sg * over; k.d = sg * lim;
    const vx = Math.sin(k.mv) * k.s, vz = Math.cos(k.mv) * k.s, vn = (vx * nx + vz * nz) * sg;
    if (vn > 0) {
      const ax = vx - nx * sg * vn * 1.25, az = vz - nz * sg * vn * 1.25, ns = Math.hypot(ax, az) * (1 - Math.min(0.45, vn / 45));
      if (k.s >= 0) { k.mv = Math.atan2(ax, az); k.s = ns; } else { k.mv = Math.atan2(-ax, -az); k.s = -ns; }
      k.h += wrap(k.mv - k.h) * 0.3;
      if (vn > 5 && k.wallT <= 0) { k.wallT = 0.4; endDrift(race, k, false); ev(race, 'wall', k, { power: vn }); }
    }
  }
  // 부스터 발판
  if (racing && k.padT <= 0 && k.spinT <= 0) for (const pad of T.pads) {
    const dx = k.x - pad.x, dz = k.z - pad.z;
    if (dx * dx + dz * dz < 7.5) { k.padT = 1.2; k.turboT = Math.max(k.turboT, 1.1); ev(race, 'pad', k); break; }
  }
  // 거꾸로 가기, 끼임
  const along = Math.cos(wrap(k.h - T.h[k.idx]));
  k.wrong = racing && along < -0.35 && k.s > 3;
  if (racing && !k.finished) {
    k.wrongT = along < -0.2 ? k.wrongT + dt : 0;
    k.stuckT = Math.abs(k.s) < 2.5 && k.spinT <= 0 ? k.stuckT + dt : 0;
    if (!k.player && (k.stuckT > 2 || k.wrongT > 2.5)) resetKart(race, k);
  }
}

function rankAll(race) {
  const list = race.karts.slice().sort((a, b) => (a.gone !== b.gone ? (a.gone ? 1 : -1) : a.finished && b.finished ? a.finishT - b.finishT : a.finished ? -1 : b.finished ? 1 : b.total - a.total));
  list.forEach((k, i) => { k.rank = i + 1; });
  race.order = list;
}

const NO_INPUT = { steer: 0, gas: false, brake: false, drift: false, use: false };
export function stepRace(race, dt, input = NO_INPUT) {
  const T = race.track, P = race.player;
  if (race.state === 'countdown') {
    if (input.gas && !P.prevGas) P.gasAt = race.countdown;
    if (!input.gas) P.gasAt = -1;
    P.prevGas = !!input.gas;
    race.countdown -= dt;
    if (race.countdown <= 0) {
      race.state = 'race';
      for (const k of race.karts) {
        const good = k.player ? k.gasAt >= 0 && k.gasAt <= 0.45 : race.rnd() < 0.35 * k.ai.skill;
        if (good) { k.turboT = 1.1; ev(race, 'startboost', k); }
      }
      ev(race, 'go', P);
    }
  } else race.t += dt;
  // 고무줄: 컴퓨터가 너무 앞서면 조금 느리게, 너무 뒤처지면 조금 빠르게
  for (const k of race.karts) {
    if (k.player) continue;
    const gap = k.total - P.total, band = gap > 30 ? -0.05 : gap < -40 ? 0.05 : 0;
    k.ai.mul = (race.diff.mul + band) * k.ai.skill * (k.finished ? 0.7 : 1);
  }
  if (P.finished) P.ai.mul = 0.6;
  for (const k of race.karts) {
    if (k.gone) continue;
    if (!k.owned) { stepRemote(race, k, dt); continue; }
    const auto = !k.player || k.finished;
    const inp = auto ? aiInput(race, k, dt) : input;
    const lapBefore = k.lap;
    stepKart(race, k, inp, dt);
    if (inp.use && !k.prevUse && race.state !== 'countdown' && !k.finished) fireItem(race, k);
    k.prevUse = !!inp.use;
    if (k.lap > lapBefore && !k.finished && race.state !== 'countdown') {
      if (lapBefore >= 0) {
        const lt = race.t - k.lapStart;
        k.lapTimes.push(lt); if (!k.bestLap || lt < k.bestLap) k.bestLap = lt;
        ev(race, 'lap', k, { lap: k.lap, time: lt });
      }
      k.lapStart = race.t;
      if (k.lap >= race.laps) {
        k.finished = true; k.finishT = race.t; endDrift(race, k, false);
        if (race.endT === Infinity) race.endT = race.t + 15;
        ev(race, 'finish', k);
      }
    }
  }
  // 카트끼리 밀어내기
  const K = race.karts;
  for (let a = 0; a < K.length; a++) for (let b = a + 1; b < K.length; b++) {
    if (K[a].gone || K[b].gone || (!K[a].owned && !K[b].owned)) continue;
    const dx = K[b].x - K[a].x, dz = K[b].z - K[a].z, dd = dx * dx + dz * dz;
    if (dd < 4.4 && dd > 1e-6) {
      // 내가 계산하는 카트만 민다 (다른 사람 카트는 그 사람이 민다)
      const d = Math.sqrt(dd), both = K[a].owned && K[b].owned, push = (2.1 - d) / (both ? 2 : 1), ux = dx / d, uz = dz / d;
      if (K[a].owned) { K[a].x -= ux * push; K[a].z -= uz * push; }
      if (K[b].owned) { K[b].x += ux * push; K[b].z += uz * push; }
      if (K[a].wallT <= 0 && K[b].wallT <= 0 && Math.abs(K[a].s - K[b].s) > 6) { K[a].wallT = K[b].wallT = 0.3; ev(race, 'bump', K[a].player ? K[a] : K[b]); }
    }
  }
  // 아이템 상자
  for (const box of race.boxes) {
    if (box.off > 0) { box.off -= dt; continue; }
    for (const k of K) {
      if (k.finished || k.items.length >= 2 || !k.owned || k.gone) continue;
      const dx = k.x - box.x, dz = k.z - box.z;
      if (dx * dx + dz * dz < 4.6) { box.off = 3.5; k.items.push(rollItem(race, k)); if (k.items.length === 1) k.rollT = 0.9; ev(race, 'box', k); break; }
    }
  }
  // 함정
  for (let i = race.traps.length - 1; i >= 0; i--) {
    const tr = race.traps[i]; tr.life -= dt; if (tr.arm > 0) tr.arm -= dt;
    let gone = tr.life <= 0;
    for (const k of K) {
      if (gone) break;
      if ((tr.arm > 0 && k.i === tr.owner) || !k.owned || k.gone) continue;
      const dx = k.x - tr.x, dz = k.z - tr.z;
      if (dx * dx + dz * dz < 3.4 && !k.finished) { if (k.safeT <= 0) hitKart(race, k, 'jelly', tr.owner); gone = true; ev(race, 'gone', k, { id: tr.id }); }
    }
    if (gone) race.traps.splice(i, 1);
  }
  // 날아가는 것들
  for (let i = race.shots.length - 1; i >= 0; i--) {
    const sh = race.shots[i]; sh.life -= dt;
    let gone = sh.life <= 0;
    if (sh.type === 'cloud') {
      const tg = K[sh.target]; sh.x = tg.x; sh.z = tg.z;
      if (gone && tg.owned && !tg.gone) hitKart(race, tg, 'cloud', sh.owner);
    } else {
      const fast = sh.type === 'snow' ? 2.1 : 1.65;
      sh.s += (BASE_SPEED * fast / T.ds) * dt;
      if (sh.type === 'bee' && sh.target >= 0) {
        const tg = K[sh.target];
        sh.d += (tg.d - sh.d) * Math.min(1, 8 * dt);
        if (tg.finished || tg.gone) gone = true;
        // 옆으로 스쳐 지나가지 않게: 목표를 따라잡는 순간 맞는다
        const left = (((tg.prog - sh.s) % T.n) + T.n) % T.n;
        if (!gone && (left < 0.6 || left > T.n / 2)) {
          if (tg.owned) { hitKart(race, tg, 'bee', sh.owner); gone = true; ev(race, 'gone', tg, { id: sh.id }); }
          else sh.s = tg.prog; // 맞았는지는 그 카트 주인이 정한다. 소식이 올 때까지 붙어 있는다
        }
      }
      const p = trackPos(T, sh.s, sh.d); sh.x = p.x; sh.z = p.z;
      for (const k of K) {
        if (gone || k.i === sh.owner || k.finished || !k.owned || k.gone) continue;
        if (sh.type === 'bee' && sh.target >= 0 && k.i !== sh.target) continue;
        const dx = k.x - sh.x, dz = k.z - sh.z;
        if (dx * dx + dz * dz < 5.3) { hitKart(race, k, sh.type, sh.owner); gone = true; ev(race, 'gone', k, { id: sh.id }); }
      }
    }
    if (gone) race.shots.splice(i, 1);
  }
  rankAll(race);
  if (race.state === 'race' && (P.finished || race.t >= race.endT)) {
    race.state = 'over';
    race.retired = !P.finished;
    ev(race, 'over', P);
  }
  return race;
}

// ── 결과, 보상, 저장 ──
export function results(race) {
  return race.order.filter((k) => !k.gone).map((k) => ({ rank: k.rank, name: k.racer.name, emoji: k.racer.emoji, player: k.player, friend: k.kind === 'remote', time: k.finished ? k.finishT : null, bestLap: k.bestLap || null }));
}
export function reward(race) {
  const P = race.player;
  if (race.mode === 'time') return P.finished ? 30 : 0;
  if (!P.finished) return 5;
  return Math.round((REWARD[P.rank - 1] || 10) * race.diff.coin);
}
export function fmtTime(t) {
  if (t == null || !isFinite(t)) return '--:--.--';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
}
export function newSave() {
  return { v: 1, coins: 0, karts: ['basic'], kart: 'basic', racer: 'jelly', unlocked: 1, best: {}, medals: {}, mode: 'item', difficulty: 0, track: 'forest', sound: true, music: true, races: 0, wins: 0 };
}
export function fixSave(raw) {
  const s = newSave();
  if (!raw || typeof raw !== 'object') return s;
  if (Number.isFinite(raw.coins)) s.coins = clamp(Math.floor(raw.coins), 0, 9999999);
  if (Array.isArray(raw.karts)) for (const id of raw.karts) if (KARTS.some((k) => k.id === id) && !s.karts.includes(id)) s.karts.push(id);
  if (s.karts.includes(raw.kart)) s.kart = raw.kart;
  if (RACERS.some((r) => r.id === raw.racer)) s.racer = raw.racer;
  if (Number.isFinite(raw.unlocked)) s.unlocked = clamp(Math.floor(raw.unlocked), 1, TRACKS.length);
  if (raw.best && typeof raw.best === 'object') for (const t of TRACKS) {
    const b = raw.best[t.id];
    if (b && typeof b === 'object') s.best[t.id] = { lap: Number.isFinite(b.lap) && b.lap > 0 ? b.lap : 0, total: Number.isFinite(b.total) && b.total > 0 ? b.total : 0 };
  }
  if (raw.medals && typeof raw.medals === 'object') for (const t of TRACKS) { const r = raw.medals[t.id]; if (Number.isInteger(r) && r >= 1 && r <= 8) s.medals[t.id] = r; }
  if (MODES.some((m) => m.id === raw.mode)) s.mode = raw.mode;
  if (Number.isInteger(raw.difficulty)) s.difficulty = clamp(raw.difficulty, 0, 2);
  if (TRACKS.findIndex((t) => t.id === raw.track) >= 0 && TRACKS.findIndex((t) => t.id === raw.track) < s.unlocked) s.track = raw.track;
  s.sound = raw.sound !== false; s.music = raw.music !== false;
  if (Number.isFinite(raw.races)) s.races = Math.max(0, Math.floor(raw.races));
  if (Number.isFinite(raw.wins)) s.wins = Math.max(0, Math.floor(raw.wins));
  return s;
}
// 경주가 끝난 뒤 저장에 반영하고, 화면에 보여 줄 것을 돌려준다
export function applyResult(save, race) {
  const P = race.player, id = race.track.id, out = { coins: reward(race), newLap: false, newTotal: false, unlockedTrack: null, rank: P.rank, retired: !P.finished };
  save.coins += out.coins; save.races++;
  const b = save.best[id] || (save.best[id] = { lap: 0, total: 0 });
  if (P.bestLap && (!b.lap || P.bestLap < b.lap)) { b.lap = P.bestLap; out.newLap = true; }
  if (P.finished && race.laps === (race.track.def.laps || LAPS) && (!b.total || P.finishT < b.total)) { b.total = P.finishT; out.newTotal = true; }
  if (race.mode !== 'time' && P.finished && !race.online) {
    if (!save.medals[id] || P.rank < save.medals[id]) save.medals[id] = P.rank;
    if (P.rank === 1) save.wins++;
    const ti = TRACKS.findIndex((t) => t.id === id);
    if (P.rank <= 3 && ti === save.unlocked - 1 && save.unlocked < TRACKS.length) { save.unlocked++; out.unlockedTrack = TRACKS[ti + 1].name; }
  }
  return out;
}
export function buyKart(save, id) {
  const k = KARTS.find((c) => c.id === id);
  if (!k || save.karts.includes(id) || save.coins < k.price) return false;
  save.coins -= k.price; save.karts.push(id); save.kart = id;
  return true;
}
