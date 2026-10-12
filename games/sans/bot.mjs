// 몇 수 앞을 미리 돌려 보고 덜 다치는 쪽으로 움직이는 봇. 패턴이 "피할 수 있게" 만들어졌는지 확인하는 데 쓴다.
// 상태가 순수 데이터라서 structuredClone 으로 복제한 뒤 후보 입력을 각각 굴려 본다.
import * as C from '../../public/play/sans/core.mjs';

const DT = 1 / 60;
const LENGTHS = [3, 6, 10, 16, 24, 36];
const CONSTANT = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
function makeRandom(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// 행동 [ax, ay]: 빨간 영혼은 그대로 방향. 파란 영혼은 바닥을 기준으로 읽는다 (ax 는 옆걸음, ay < 0 은 점프).
function heldFor(soul, [ax, ay]) {
  if (soul.mode === 'red') return { left: ax < 0, right: ax > 0, up: ay < 0, down: ay > 0 };
  const jump = ay < 0;
  if (soul.gravity === 'down') return { left: ax < 0, right: ax > 0, up: jump };
  if (soul.gravity === 'up') return { left: ax < 0, right: ax > 0, down: jump };
  if (soul.gravity === 'left') return { up: ax < 0, down: ax > 0, right: jump };
  return { up: ax < 0, down: ax > 0, left: jump };
}
// 계획: 프레임마다의 행동을 늘어놓은 배열
function randomPlan(random, horizon) {
  const plan = [];
  while (plan.length < horizon) { const action = CONSTANT[Math.floor(random() * 9)], n = LENGTHS[Math.floor(random() * LENGTHS.length)]; for (let k = 0; k < n && plan.length < horizon; k++) plan.push(action); }
  return plan;
}
function score(g, plan) {
  const sim = structuredClone(g); sim.events = [];
  const start = sim.stats.ticks, attack = sim.attack.name; let changes = 0;
  for (let i = 0; i < plan.length && sim.mode === 'dodge' && sim.attack?.name === attack; i++) { if (i && plan[i] !== plan[i - 1]) changes++; C.tick(sim, DT, heldFor(sim.soul, plan[i])); sim.events.length = 0; }
  if (sim.mode === 'gameover') return 1e7;
  const B = C.targetBounds(sim), s = sim.soul;
  // 덜 다친 쪽이 먼저. 그다음엔 상자 한가운데에 가깝고 덜 부산한 쪽.
  return (sim.stats.ticks - start) * 1000 + Math.hypot((s.x - B.cx) / B.w, (s.y - B.cy) / B.h) * 6 + changes * .05;
}
// 한 공격을 끝까지 돌리고 { ticks: 다친 횟수, hits, dead } 를 돌려준다.
// 세 프레임마다 무작위 계획 여러 개와 지난번에 고른 계획을 한 칸 민 것을 굴려 보고 제일 덜 다치는 것을 따른다.
export function playAttack(g, { horizon = 60, every = 3, samples = 40, seed = 1, onHit = null } = {}) {
  const attack = g.attack.name, before = { ticks: g.stats.ticks, hits: g.stats.hits }, random = makeRandom(seed);
  let plan = null, age = 0, frame = 0;
  while (g.mode === 'dodge' && g.attack?.name === attack && frame < 60 * 40) {
    if (g.phase === 'asleep' || (g.phase === 'nothing' && frame > 60)) break;
    if (frame % every === 0) {
      const candidates = CONSTANT.map(action => Array(horizon).fill(action));
      if (plan) { const rest = plan.slice(age); while (rest.length < horizon) rest.push(rest[rest.length - 1] || CONSTANT[0]); candidates.push(rest); }
      for (let k = 0; k < samples; k++) candidates.push(randomPlan(random, horizon));
      let bestScore = Infinity;
      for (const candidate of candidates) { const value = score(g, candidate); if (value < bestScore) { bestScore = value; plan = candidate; } }
      age = 0;
    }
    const ticks = g.stats.ticks, time = g.attack.t;
    C.tick(g, DT, heldFor(g.soul, plan[age])); g.events.length = 0; age++; frame++;
    if (onHit && g.stats.ticks !== ticks) onHit(time, g);
  }
  return { ticks: g.stats.ticks - before.ticks, hits: g.stats.hits - before.hits, dead: g.mode === 'gameover', seconds: frame / 60 };
}

// 전투를 원하는 공격 직전까지 건너뛴 상태로 만든다.
export function gameAt(name, level = 1, seed = 7) {
  const meta = C.createMeta(); meta.level = level;
  const g = C.createGame(meta, seed);
  C.press(g, 'confirm');
  for (let i = 0; i < 600 && g.mode !== 'dodge'; i++) { if (g.mode === 'cine') C.tick(g, .1); else C.press(g, 'confirm'); }
  g.events.length = 0;
  if (name === 'opening') return g;
  // 첫 공격을 치우고, 원하는 공격을 그 막의 이야기 공격처럼 건다
  const p2 = C.ORDER.p2.includes(name) || C.ORDER.fill2.includes(name) || name === 'special';
  Object.assign(g, { bullets: [], attack: null, hp: g.maxHp, kr: 0, phase: name === 'special' ? 'special' : p2 ? 'p2' : 'p1', pending: name, mode: 'text', text: { lines: ['*'], index: 0, shown: 1, next: 'story' } });
  C.press(g, 'confirm');
  g.events.length = 0;
  return g;
}
