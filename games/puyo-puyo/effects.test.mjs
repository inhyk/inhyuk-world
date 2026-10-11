// 터짐 효과 (2026-10-11 요청: "터짐 효과를 더 많이 엄청 많이 더 만들어줘"): 상점의 효과마다 제 그림이 있고, 끝까지 그려도 탈이 없는지.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Effects, PART_SHAPES } from './effects.mjs';
import { EFFECTS, canBuy, canRedeem } from './shop.mjs';
import { newProgress } from './profile.mjs';

// 그리는 척만 하는 캔버스: 어떤 함수를 불러도 받아 주고, 부른 횟수를 센다
function fakeCtx() {
  const calls = { n: 0 };
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'measureText') return () => ({ width: 10 });
      if (key === 'createLinearGradient') return () => gradient;
      return () => { calls.n++; };
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  return { ctx, calls };
}
const signature = fx => [...fx.parts.map(p => p.shape || p.kind), ...fx.rings.map(r => (r.rainbow ? 'ring-rainbow' : 'ring')), ...fx.bolts.map(() => 'bolt')].sort().join(',');
function popped(id, chain = 3) { const fx = new Effects(); fx.pop(id, 200, 200, 2, 40, chain); return fx; }

const NEW_COIN = ['ripple', 'leaf', 'drop', 'clover', 'laugh', 'candy', 'balloon', 'coin', 'paw', 'gem', 'feather', 'popcorn', 'ice', 'cloud', 'smile', 'moon', 'sun', 'soccer', 'shuriken', 'ghost',
  'paint', 'fish', 'firefly', 'comic', 'shock', 'bomb', 'bat', 'laser', 'gold', 'volcano', 'tornado', 'aurora', 'disco', 'constellation', 'rocket', 'crown', 'glitch', 'galaxy', 'code', 'slash'];
const NEW_LEVEL = ['blizzard', 'thunderstorm', 'bigbang', 'phoenix', 'treasure', 'legend'];

test('터짐 효과는 67가지: 새 코인 효과 40가지와 레벨 효과 6가지', () => {
  assert.equal(EFFECTS.length, 67);
  assert.equal(new Set(EFFECTS.map(e => e.id)).size, 67);
  assert.equal(new Set(EFFECTS.map(e => e.name)).size, 67);
  for (const id of [...NEW_COIN, ...NEW_LEVEL]) assert.ok(EFFECTS.some(e => e.id === id), id);
  for (const item of EFFECTS) {
    assert.ok(item.id.length <= 20, `${item.id}: 온라인으로 보낼 때 20글자까지만 간다`);
    assert.ok(item.name && item.desc.length > 5, item.id);
  }
  for (const id of NEW_COIN) { const item = EFFECTS.find(e => e.id === id); assert.ok(item.price >= 200 && item.price <= 4000 && item.level <= 20 && !item.noTicket, id); }
  assert.deepEqual(NEW_LEVEL.map(id => EFFECTS.find(e => e.id === id).level), [40, 60, 70, 80, 90, 99]);
  // 레벨 효과는 그 레벨이 되어야 사고, 교환권으로는 못 받는다. 코인 효과는 교환권으로도 받는다
  const p = newProgress(); p.coins = 1e6; p.tickets.effect = 5;
  for (const id of NEW_LEVEL) {
    const item = EFFECTS.find(e => e.id === id);
    assert.equal(item.noTicket, true, id);
    assert.equal(canRedeem(p, 'effect', id), false, id);
    p.level = item.level - 1; assert.equal(canBuy(p, 'effect', id), 'level', id);
    p.level = item.level; assert.equal(canBuy(p, 'effect', id), 'ok', id);
  }
  p.level = 1;
  for (const id of NEW_COIN) assert.equal(canRedeem(p, 'effect', id), true, id);
});

test('효과마다 제 그림이 있다: 기본 반짝과 다르고, 서로도 다르고, 모르는 모양 이름이 없다', () => {
  const basic = signature(popped('sparkle'));
  assert.equal(signature(popped('없는 효과')), basic); // 모르는 이름(옛 버전이 새 효과를 받았을 때)은 기본 반짝
  const seen = new Map();
  for (const item of EFFECTS) {
    const fx = popped(item.id), sig = signature(fx);
    assert.ok(fx.parts.length + fx.rings.length + fx.bolts.length > 0, item.id);
    if (item.id !== 'sparkle') assert.notEqual(sig, basic, `${item.id}: pop() 에 case 가 없다`);
    assert.ok(!seen.has(sig), `${item.id} 와 ${seen.get(sig)} 가 똑같다`);
    seen.set(sig, item.id);
    for (const p of fx.parts) assert.ok(PART_SHAPES.includes(p.shape || p.kind), `${item.id}: ${p.shape || p.kind}`);
    assert.ok(fx.parts.length <= 20 && fx.rings.length <= 3 && fx.bolts.length <= 1, `${item.id}: 알갱이 ${fx.parts.length}개`);
  }
});

test('끝까지 그려도 탈이 없다: 숫자가 망가지지 않고, 3초 안에 모두 사라진다', () => {
  for (const item of EFFECTS) for (const size of [40, 14]) { // 14: 휴대폰에서 둘이 할 때의 작은 필드
    const fx = new Effects(), { ctx, calls } = fakeCtx();
    for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [2, -1]]) fx.pop(item.id, 200 + dx * size, 200 + dy * size, 1 + dx, size, 5);
    for (let f = 0; f < 90; f++) {
      fx.update(); fx.draw(ctx);
      for (const p of fx.parts) assert.ok([p.x, p.y, p.size, p.rot].every(Number.isFinite), `${item.id} ${f}프레임: ${p.kind} ${p.x} ${p.y} ${p.size} ${p.rot}`);
      for (const r of fx.rings) assert.ok(Number.isFinite(r.r) && r.r >= 0, `${item.id} 고리`);
    }
    assert.ok(calls.n > 0, item.id);
    assert.deepEqual([fx.parts.length, fx.rings.length, fx.bolts.length], [0, 0, 0], `${item.id}: 3초 뒤에도 남아 있다`);
  }
});

test('한꺼번에 많이 터져도 알갱이는 900개를 넘지 않는다', () => {
  for (const id of ['legend', 'treasure', 'gold']) {
    const fx = new Effects();
    for (let i = 0; i < 200; i++) fx.pop(id, 100, 100, 1, 40, 9);
    assert.ok(fx.parts.length <= 900, `${id}: ${fx.parts.length}`);
    const { ctx } = fakeCtx();
    for (let f = 0; f < 5; f++) { fx.update(); fx.draw(ctx); }
  }
});
