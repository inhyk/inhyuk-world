// 모두의 광장 (src/plaza.js): 세계 번호 고르기, 다시 시도 간격, 보내는 메시지가 서버 거르개를 그대로 지나는지,
// 그리고 가짜 World 로 Plaza 가 꽉 찬 광장을 건너뛰고, 끊기면 다시 들어가고, 다른 기기에서 들어가면 멈추는지 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAZA_WORLDS, PLAZA_AWAY_MS, nextPlaza, retryDelay, plazaShows, plazaHi, plazaSay, acceptPlaza, Plaza,
} from './src/plaza.js';
import { GAME, NET_VERSION, PHRASES, ADJECTIVES, ANIMALS, PETS, defaultSave, lookToArray, packPose, unpackPose, WORLDS } from './core.mjs';
import { cleanData, maskSplitContact, hasSplitContact } from '../../services/net/src/filter.js';
import { WORLD_NAME_RE } from '../../packages/net/world.mjs';
import { readFileSync } from 'node:fs';

test('광장 세계 이름: plaza-1 ~ plaza-4, 서버 WORLD_NAMES 에 모두 있다', () => {
  assert.deepEqual(PLAZA_WORLDS, ['plaza-1', 'plaza-2', 'plaza-3', 'plaza-4']);
  for (const w of PLAZA_WORLDS) assert.match(w, WORLD_NAME_RE);
  const wrangler = readFileSync(new URL('../../services/net/wrangler.jsonc', import.meta.url), 'utf8');
  const names = /"WORLD_NAMES":\s*"([^"]*)"/.exec(wrangler)[1].split(',');
  for (const w of PLAZA_WORLDS) assert.ok(names.includes(`${GAME}:${w}`), `${GAME}:${w} 가 WORLD_NAMES 에 있다`);
  assert.equal(PLAZA_AWAY_MS, 5 * 60 * 1000);
});

test('세계 번호 고르기: 꽉 차면 다음 번호, 넷 다 지나면 -1', () => {
  assert.equal(nextPlaza(0), 1);
  assert.equal(nextPlaza(1), 2);
  assert.equal(nextPlaza(2), 3);
  assert.equal(nextPlaza(3), -1);
  const order = [];
  for (let i = 0; i >= 0; i = nextPlaza(i)) order.push(i);
  assert.deepEqual(order, [0, 1, 2, 3]);
});

test('다시 시도 간격: 끊김과 인터넷은 3초부터 두 배씩 2분까지, 다 찼으면 30초부터, join-rate 는 65초', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 10].map(a => retryDelay('lost', a)), [3000, 6000, 12000, 24000, 48000, 96000, 120000, 120000]);
  assert.equal(retryDelay('network', 0), 3000);
  assert.equal(retryDelay('timeout', 1), 6000);
  assert.deepEqual([0, 1, 2, 3].map(a => retryDelay('all-full', a)), [30000, 60000, 120000, 120000]);
  assert.equal(retryDelay('join-rate', 0), 65000);
  assert.equal(retryDelay('join-rate', 5), 65000);
  for (const code of ['replaced', 'suspended', 'login-required', 'no-world', 'not-deployed']) assert.equal(retryDelay(code, 0), null, code);
  // 1분 안에 들어가 보는 횟수: 다시 시도는 3, 9, 21, 45초 = 4번. 한 번에 광장 4개까지 들어가 봐도 처음 것까지 20번 (서버 한도 20)
  let t = 0, tries = 1;
  for (let a = 0; ; a++) { t += retryDelay('lost', a); if (t > 60000) break; tries++; }
  assert.ok(tries * PLAZA_WORLDS.length <= 20, `1분에 ${tries * PLAZA_WORLDS.length}번`);
});

test('광장 사람은 같은 세계이고 브릭 광장(0)이나 점프 탑(1)일 때만 보인다', () => {
  assert.equal(plazaShows(0, 0), true);
  assert.equal(plazaShows(1, 1), true);
  assert.equal(plazaShows(0, 1), false);
  assert.equal(plazaShows(1, 0), false);
  for (let w = 2; w < WORLDS.length; w++) assert.equal(plazaShows(w, w), false, `세계 ${w}`);
  assert.equal(plazaShows(0, -1), false);
});

test('광장으로 보내는 hi 에는 타이쿤 물건 목록(o)이 없다', () => {
  const hi = { t: 'hi', v: NET_VERSION, n: [3, 4], l: [1, 2, 3, 4, 5, 6, 7, 8], w: 2, pt: 2, o: [0, 1, 2] };
  assert.deepEqual(plazaHi(hi), { t: 'hi', v: NET_VERSION, n: [3, 4], l: [1, 2, 3, 4, 5, 6, 7, 8], w: 2, pt: 2 });
  assert.deepEqual(plazaHi({ ...hi, pt: 0 }), { t: 'hi', v: NET_VERSION, n: [3, 4], l: [1, 2, 3, 4, 5, 6, 7, 8], w: 2 });
  assert.deepEqual(plazaSay(5), { t: 'say', i: 5 });
});

test('광장에서 받은 메시지는 hi 와 say 만 쓰고 돈 주기, 타워, 미니게임, 채팅은 버린다', () => {
  const hi = { t: 'hi', v: 2, n: [1, 2], l: [0, 0, 0], w: 0, pt: 1, o: [1, 2] };
  assert.deepEqual(acceptPlaza(hi), { t: 'hi', v: 2, n: [1, 2], l: [0, 0, 0], w: 0, pt: 1 });
  assert.deepEqual(acceptPlaza({ t: 'say', i: 0 }), { t: 'say', i: 0 });
  assert.equal(acceptPlaza({ t: 'say', i: PHRASES.length }), null);
  assert.equal(acceptPlaza({ t: 'say', i: '1' }), null);
  assert.equal(acceptPlaza({ t: 'hi', n: 'x', l: [] }), null);
  for (const t of ['gift', 'gift-ok', 'tw', 'ty', 'br', 'sv', 'tg', 'p', 'df']) assert.equal(acceptPlaza({ t, amt: 100, n: 1, a: 0, b: [1], k: 'tick' }), null, t);
  assert.equal(acceptPlaza({ chat: '안녕' }), null);
  assert.equal(acceptPlaza(null), null);
  assert.equal(acceptPlaza([1, 2]), null);
});

// 서버(World)는 send 의 data 를 cleanData 와 maskSplitContact 로, pose 는 cleanData 와 hasSplitContact 로 거른다.
// 브릭버스가 보내는 모양이 거르개를 지나도 한 글자도 바뀌지 않아야 받은 쪽이 같은 것을 읽는다.
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function myHis() {
  const out = [];
  const save = defaultSave();
  for (let a = 0; a < ADJECTIVES.length; a++) {
    for (let b = 0; b < ANIMALS.length; b++) {
      const look = { ...save.look, hat: (a + b) % 16, face: a % 8, emblem: b % 8, hair: (a * b) % 12, hairColor: b % 10, skin: a % 6, shirt: b, pants: a };
      for (const w of [0, 1, 6]) {
        const pt = (a + b + w) % (PETS.length + 1);
        out.push(plazaHi({ t: 'hi', v: NET_VERSION, n: [a, b], l: lookToArray(look), w, pt, o: [1, 2, 3] }));
      }
    }
  }
  return out;
}

test('hi, say 가 서버 거르개(cleanData, maskSplitContact)를 그대로 지난다', () => {
  const list = [...myHis(), ...PHRASES.map((_, i) => plazaSay(i))];
  assert.ok(list.length > 700);
  for (const m of list) {
    const cleaned = maskSplitContact(cleanData(m));
    assert.ok(same(cleaned, m), `바뀜: ${JSON.stringify(m)} → ${JSON.stringify(cleaned)}`);
    assert.ok(JSON.stringify({ t: 'send', data: m }).length < 16 * 1024);
  }
});

test('위치(pose)가 서버 거르개를 그대로 지나고 512글자 안이다', () => {
  const poses = [];
  for (let w = 0; w < WORLDS.length; w++) {
    for (const [x, y, z, yaw] of [[0, 0.3, 18, Math.PI], [-123.456, 456.789, 99999.4, -3.14159], [0.005, -29.99, -0.004, 6.28]]) {
      for (let anim = 0; anim < 3; anim++) poses.push(packPose({ x, y, z }, yaw, w, anim, (w + anim) % 5));
    }
  }
  for (const d of poses) {
    const cleaned = cleanData(d);
    assert.ok(same(cleaned, d), JSON.stringify(d));
    assert.equal(hasSplitContact(cleaned), false);
    assert.ok(JSON.stringify(cleaned).length <= 512);
    assert.ok(unpackPose(cleaned), '받은 쪽이 풀 수 있다');
  }
});

// ---------------------------------------------------------------- 가짜 World 로 Plaza 흐름 보기
// script: 세계 이름 → open() 이 할 일 ('ok' | 에러 코드)
function fakeWorlds(script) {
  const made = [];
  class FakeWorld {
    constructor(hooks, options) {
      this.hooks = hooks; this.options = options; this.id = ''; this.peers = new Map(); this.sent = []; this.closed = false;
      made.push(this);
    }
    async open(ticket) {
      this.ticket = ticket;
      const what = script[this.options.world] ?? 'ok';
      if (what !== 'ok') { const e = Error(what); e.code = what; this.hooks.status?.('error', what); throw e; }
      this.id = 'p7';
      this.peers.set('p1', { id: 1, nickname: '서버닉네임' });
      this.hooks.status?.('connected');
      this.hooks.join?.('p1', { id: 1, nickname: '서버닉네임' }); // 이미 있던 사람 (welcome 때)
    }
    close() { if (this.closed) return; this.closed = true; this.id = ''; this.peers = new Map(); this.hooks.status?.('offline'); }
    fail() { this.close(); this.hooks.status?.('error', 'lost'); }
    pose(d) { this.sent.push(['pose', d]); return true; }
    send(data) { this.sent.push(['send', data]); return true; }
    sendTo(id, data) { this.sent.push(['sendTo', id, data]); return true; }
  }
  return { FakeWorld, made };
}
function fakeTimers() {
  const list = [];
  return {
    list,
    setTimeout: (fn, ms) => { const t = { fn, ms, done: false }; list.push(t); return t; },
    clearTimeout: t => { if (t) t.done = true; },
    run: () => { const t = list.filter(x => !x.done).at(-1); t.done = true; t.fn(); return t.ms; },
    pending: () => list.filter(x => !x.done).map(x => x.ms),
  };
}
const tick = () => new Promise(r => setTimeout(r, 0));
function makePlaza(script, extra = {}) {
  const { FakeWorld, made } = fakeWorlds(script);
  const timers = fakeTimers();
  const events = [];
  let n = 0;
  const hooks = {};
  for (const k of ['status', 'opened', 'join', 'leave', 'reset', 'pose', 'message', 'notice']) hooks[k] = (...a) => events.push([k, ...a]);
  const plaza = new Plaza(hooks, { World: FakeWorld, timers, ticket: async () => `ticket-${++n}`, ...extra });
  return { plaza, made, timers, events };
}

test('Plaza: plaza-1 이 꽉 찼으면 plaza-2 로, 표는 매번 새로 받는다', async () => {
  const { plaza, made, events } = makePlaza({ 'plaza-1': 'full' });
  plaza.want(true);
  await tick(); await tick(); await tick();
  assert.deepEqual(made.map(w => [w.options.game, w.options.world, w.ticket]), [['brickverse', 'plaza-1', 'ticket-1'], ['brickverse', 'plaza-2', 'ticket-2']]);
  assert.equal(plaza.live, true);
  assert.equal(plaza.name, 'plaza-2');
  assert.equal(plaza.number, 2);
  assert.equal(plaza.count, 1);
  assert.equal(plaza.state, 'connected');
  assert.deepEqual(events.filter(e => e[0] === 'opened'), [['opened', { again: false }]]);
  assert.equal(events.some(e => e[0] === 'join'), false, '들어갈 때 이미 있던 사람은 join 으로 알리지 않는다 (opened 뒤 hi 로 안다)');
  // 들어온 뒤 온 사람은 알린다
  made[1].hooks.join('p9', { id: 9, nickname: '닉' });
  assert.deepEqual(events.at(-1), ['join', 'p9']);
  // 보내기
  plaza.pose([0, 1, 2, 3, 0, 0, 0]);
  plaza.send(plazaSay(1));
  plaza.sendTo('p9', { t: 'hi' });
  assert.deepEqual(made[1].sent, [['pose', [0, 1, 2, 3, 0, 0, 0]], ['send', { t: 'say', i: 1 }], ['sendTo', 'p9', { t: 'hi' }]]);
  // 받기: 돈 주기, 타워는 버린다
  made[1].hooks.message({ t: 'gift', amt: 1000, n: 5 }, 'p9');
  made[1].hooks.message({ t: 'tw', a: 0, p: 0, b: [1, 2, 3, 4] }, 'p9');
  made[1].hooks.message({ t: 'say', i: 2 }, 'p9');
  assert.deepEqual(events.filter(e => e[0] === 'message'), [['message', { t: 'say', i: 2 }, 'p9']]);
  made[1].hooks.pose('p9', [0, 1, 1, 1, 0, 0, 0]);
  assert.deepEqual(events.at(-1), ['pose', 'p9', [0, 1, 1, 1, 0, 0, 0]]);
  made[1].hooks.leave('p9');
  assert.deepEqual(events.at(-1), ['leave', 'p9']);
  // 나가기
  plaza.want(false);
  assert.equal(made[1].closed, true);
  assert.equal(plaza.live, false);
  assert.equal(plaza.state, 'off');
  assert.ok(events.some(e => e[0] === 'reset'));
});

test('Plaza: 넷 다 차면 혼자 하기, 한 번 알리고 30초 뒤 plaza-1 부터 다시', async () => {
  const script = Object.fromEntries(PLAZA_WORLDS.map(w => [w, 'full']));
  const { plaza, made, timers, events } = makePlaza(script);
  plaza.want(true);
  for (let i = 0; i < 10; i++) await tick();
  assert.deepEqual(made.map(w => w.options.world), PLAZA_WORLDS);
  assert.equal(plaza.live, false);
  assert.equal(plaza.state, 'waiting');
  assert.equal(events.filter(e => e[0] === 'notice').length, 1);
  assert.deepEqual(timers.pending(), [30000]);
  timers.run();
  for (let i = 0; i < 10; i++) await tick();
  assert.equal(made.length, 8);
  assert.equal(made[4].options.world, 'plaza-1');
  assert.deepEqual(timers.pending(), [60000]);
  assert.equal(events.filter(e => e[0] === 'notice').length, 1, '두 번째로 꽉 찼을 때는 다시 알리지 않는다');
  plaza.want(false);
  assert.deepEqual(timers.pending(), [], '나가면 다시 시도하지 않는다');
});

test('Plaza: 서버 배포 전(not-deployed, no-world)이면 조용히 혼자 하고 다시 시도하지 않는다', async () => {
  for (const code of ['not-deployed', 'no-world']) {
    const { plaza, made, timers, events } = makePlaza({ 'plaza-1': code });
    plaza.want(true);
    for (let i = 0; i < 5; i++) await tick();
    assert.equal(made.length, 1);
    assert.equal(plaza.state, 'stopped');
    assert.deepEqual(timers.pending(), []);
    assert.equal(events.some(e => e[0] === 'notice'), false, code);
  }
});

test('Plaza: 인터넷 오류나 표를 못 받으면 3초 뒤 다시', async () => {
  const { plaza, made, timers } = makePlaza({ 'plaza-1': 'network' });
  plaza.want(true);
  for (let i = 0; i < 5; i++) await tick();
  assert.equal(made.length, 1);
  assert.deepEqual(timers.pending(), [3000]);
  const t2 = makePlaza({}, { ticket: async () => { throw Object.assign(Error('x'), { code: 'network' }); } });
  t2.plaza.want(true);
  for (let i = 0; i < 5; i++) await tick();
  assert.equal(t2.made.length, 0);
  assert.deepEqual(t2.timers.pending(), [3000]);
  const t3 = makePlaza({}, { ticket: async () => { throw Object.assign(Error('x'), { code: 'login-required', status: 401 }); } });
  t3.plaza.want(true);
  for (let i = 0; i < 5; i++) await tick();
  assert.equal(t3.plaza.state, 'stopped');
  assert.deepEqual(t3.timers.pending(), []);
});

test('Plaza: 끊기면 광장 사람을 지우고 늘어나는 간격으로 다시 들어간다. 다른 기기에서 들어가면 멈춘다', async () => {
  const { plaza, made, timers, events } = makePlaza({});
  plaza.want(true);
  for (let i = 0; i < 5; i++) await tick();
  assert.equal(plaza.live, true);
  made[0].fail();
  assert.equal(plaza.live, false);
  assert.ok(events.some(e => e[0] === 'reset'));
  assert.deepEqual(timers.pending(), [3000]);
  timers.run();
  for (let i = 0; i < 5; i++) await tick();
  assert.equal(plaza.live, true);
  assert.equal(made.length, 2);
  assert.deepEqual(events.filter(e => e[0] === 'opened').map(e => e[1]), [{ again: false }, { again: true }]);
  // 다시 들어온 뒤에는 간격이 처음으로 돌아간다
  made[1].fail();
  assert.deepEqual(timers.pending(), [3000]);
  timers.run();
  for (let i = 0; i < 5; i++) await tick();
  // replaced: 서버가 error 를 알린 뒤 닫는다
  made[2].hooks.error('replaced');
  made[2].fail();
  assert.equal(plaza.state, 'stopped');
  assert.deepEqual(timers.pending(), []);
  assert.equal(events.filter(e => e[0] === 'notice').length, 1);
});

test('Plaza: 들어가는 중에 나가면 아무것도 남지 않는다', async () => {
  let release;
  const { plaza, made, timers } = makePlaza({}, { ticket: () => new Promise(r => { release = r; }) });
  plaza.want(true);
  assert.equal(plaza.state, 'connecting');
  plaza.want(false);
  release('late-ticket');
  for (let i = 0; i < 5; i++) await tick();
  assert.equal(made.length, 0);
  assert.equal(plaza.live, false);
  assert.equal(plaza.state, 'off');
  assert.deepEqual(timers.pending(), []);
});
