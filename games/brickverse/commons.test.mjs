// 🧱 모두의 공터 규칙: 칸 이름, 받은 칸 검사, 내 블록 세기, 공터 자리, Plaza 가 칸을 넘겨주는 흐름.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BLOCKS, COMMONS, COMMONS_DAYS, COMMONS_HALF, TOWER, P, commonsKey, parseCommonsKey, commonsBlock, commonsCenter, commonsCellAt,
  inCommons, nearCommons, countMine, touchesCell, newPlayer,
} from './core.mjs';
import { buildHub, commonsArea } from './worlds.mjs';
import { Plaza, COMMONS_TEXT, commonsError, quietNotice } from './src/plaza.js';
import { World } from '../../packages/net/world.mjs';
import { cleanData, hasSplitContact } from '../../services/net/src/filter.js';

const serverWorld = readFileSync(new URL('../../services/net/src/world.js', import.meta.url), 'utf8');
const CELL_KEY_RE = new RegExp(serverWorld.match(/CELL_KEY_RE = \/(.+)\/;/)[1]);

test('공터 칸 이름: b|i|j|k 로 만들고 풀고, 서버 칸 이름 규칙에 맞는다', () => {
  for (const [i, j, k] of [[0, 0, 0], [11, 15, 11], [3, 7, 9]]) {
    const key = commonsKey(i, j, k);
    assert.equal(key, `b|${i}|${j}|${k}`);
    assert.ok(CELL_KEY_RE.test(key), key);
    assert.deepEqual(parseCommonsKey(key), { i, j, k });
  }
  assert.ok(serverWorld.includes(`TTL_CELLS_PER_USER = ${COMMONS.LIMIT};`), '내 블록 한도는 서버의 사라지는 칸 한도와 같다');
});

test('공터 블록은 놓은 지 7일 뒤 사라지고, 그 ttl 은 서버가 받는 범위(1분~30일) 안이다', () => {
  assert.equal(COMMONS.TTL, 7 * 24 * 3600);
  assert.equal(COMMONS_DAYS, 7);
  const [, min, max] = serverWorld.match(/TTL_MIN = (\d+), TTL_MAX = ([\d *]+);/);
  const maxSec = max.split('*').reduce((a, n) => a * Number(n), 1);
  assert.equal(maxSec, 30 * 24 * 3600);
  assert.ok(Number.isInteger(COMMONS.TTL) && COMMONS.TTL >= Number(min) && COMMONS.TTL <= maxSec);
  assert.equal(COMMONS_TEXT.expiry, '블록은 7일 뒤에 사라져');
  const sign = buildHub().signs.find(s => s.commons);
  assert.ok(sign.lines.includes('블록은 7일 뒤에 사라져'), '안내판에도 적는다');
  assert.equal(sign.lines.length, sign.sizes.length);
});

test('공터 칸 이름: 공터 밖, 다른 모양, 같은 칸을 다르게 쓴 이름은 null', () => {
  for (const bad of ['b|12|0|0', 'b|0|16|0', 'b|0|0|12', 'b|-1|0|0', 'b|01|0|0', 'b|0|0', 'b|0|0|0|0', 'x|0|0|0', '0,0,0', 'b|a|0|0', 'b|1.5|0|0', '', null, 7, ['b|0|0|0']]) {
    assert.equal(parseCommonsKey(bad), null, String(bad));
  }
  assert.equal(inCommons(0, 0, 0), true);
  assert.equal(inCommons(COMMONS.N - 1, COMMONS.TOP, COMMONS.N - 1), true);
  assert.equal(inCommons(COMMONS.N, 0, 0), false);
  assert.equal(inCommons(0, COMMONS.TOP + 1, 0), false);
  assert.equal(inCommons(0.5, 0, 0), false);
});

test('받은 칸 검사: 블록 번호(0~16 정수)만 그리고, 주인 번호를 들고 온다', () => {
  const owner = { id: 42, nickname: '서버닉네임' };
  assert.deepEqual(commonsBlock('b|2|3|4', { v: 5, owner }), { i: 2, j: 3, k: 4, t: 5, owner: 42 });
  assert.deepEqual(commonsBlock('b|0|0|0', { v: BLOCKS.length - 1, owner }), { i: 0, j: 0, k: 0, t: BLOCKS.length - 1, owner: 42 });
  for (const v of [-1, BLOCKS.length, 1.5, '3', null, undefined, [3], { t: 3 }, true, NaN]) {
    assert.equal(commonsBlock('b|0|0|0', { v, owner }), null, JSON.stringify(v));
  }
  assert.equal(commonsBlock('b|99|0|0', { v: 1, owner }), null, '공터 밖');
  assert.equal(commonsBlock('tree|7', { v: 1, owner }), null, '다른 칸');
  assert.equal(commonsBlock('b|0|0|0', null), null);
  assert.equal('nickname' in commonsBlock('b|0|0|0', { v: 1, owner }), false, '계정 닉네임은 들고 오지 않는다');
});

test('보내는 칸 값은 숫자 하나라 서버 거르개를 그대로 지난다', () => {
  for (let t = 0; t < BLOCKS.length; t++) {
    assert.equal(cleanData(t), t);
    assert.equal(hasSplitContact(t), false);
    assert.ok(JSON.stringify(t).length <= 256);
  }
});

test('내 블록 세기: 서버처럼 내가 놓은 사라지는 칸(exp)만 세고, 지난 칸과 exp 없는 예전 칸은 빼고, 광장에 없으면 0', () => {
  const now = Date.now(), week = COMMONS.TTL * 1000;
  const cells = new Map([
    ['b|0|0|0', { v: 1, owner: { id: 7, nickname: 'a' }, exp: now + week }],
    ['b|1|0|0', { v: 2, owner: { id: 7, nickname: 'a' }, exp: now + 60000 }],
    ['b|2|0|0', { v: 3, owner: { id: 8, nickname: 'b' }, exp: now + week }],
    ['b|3|0|0', { v: 3, owner: { id: 7, nickname: 'a' } }], // 한도를 넓히기 전에 exp 없이 놓은 칸 (서버도 따로 센다)
    ['b|4|0|0', { v: 3, owner: { id: 7, nickname: 'a' }, exp: now - 1 }], // 이미 지남
  ]);
  assert.equal(countMine(cells, 7, now), 2);
  assert.equal(countMine(cells, 8, now), 1);
  assert.equal(countMine(cells, 9, now), 0);
  assert.equal(countMine(cells, 7, now + 60000), 1, '1분 뒤에는 하나가 지났다');
  assert.equal(countMine(cells, 7, now + week), 0);
  assert.equal(countMine(cells, null), 0);
  assert.equal(countMine(new Map(), 7), 0);
});

test('공터 좌표: 칸 가운데와 바닥 칸 찾기가 맞고, 가까이 있는지 안다', () => {
  for (const [i, k] of [[0, 0], [11, 11], [5, 8]]) {
    const [x, y, z] = commonsCenter(i, 0, k);
    assert.deepEqual(commonsCellAt(x, z), { i, k });
    assert.ok(Math.abs(y - (COMMONS.Y + TOWER.CELL / 2)) < 1e-9, '0층 블록은 바닥판 위에 앉는다');
  }
  assert.equal(commonsCellAt(COMMONS.X - COMMONS_HALF - 0.01, COMMONS.Z), null);
  assert.equal(commonsCellAt(COMMONS.X + COMMONS_HALF + 0.01, COMMONS.Z), null);
  assert.equal(nearCommons(COMMONS.X, COMMONS.Z), true);
  assert.equal(nearCommons(COMMONS.X - COMMONS_HALF - COMMONS.NEAR + 0.5, COMMONS.Z), true);
  assert.equal(nearCommons(COMMONS.X - COMMONS_HALF - COMMONS.NEAR - 0.5, COMMONS.Z), false);
  assert.equal(nearCommons(0, 18), false, '시작 발판에서는 멀다');
  // 내 자리 검사 (하늘 타워와 같이 씀)
  const [x, y, z] = commonsCenter(4, 0, 4);
  assert.equal(touchesCell(newPlayer(x, COMMONS.Y, z), x, y, z), true);
  assert.equal(touchesCell(newPlayer(x + TOWER.CELL / 2 + P.R + 0.01, COMMONS.Y, z), x, y, z), false);
  assert.equal(touchesCell(newPlayer(x, y + TOWER.CELL / 2, z), x, y, z), false, '블록 위에 서 있으면 안 겹친다');
});

test('공터는 섬 안에 있고, 광장의 다른 부품, 문, 구역, 코인, 주민이 다니는 곳과 겹치지 않는다', () => {
  const hub = buildHub();
  const lot = commonsArea(), around = commonsArea(1.5);
  // 섬(150×150, 가운데 0) 안
  assert.ok(lot.x0 > -75 && lot.x1 < 75 && lot.z0 > -75 && lot.z1 < 75, JSON.stringify(lot));
  const hits = (a, x0, x1, z0, z1) => x1 > a.x0 && x0 < a.x1 && z1 > a.z0 && z0 < a.z1;
  const own = hub.parts.filter(p => p.commons);
  assert.ok(own.length >= 6, '바닥판, 테두리, 기둥');
  for (const p of own) assert.ok(hits(around, p.x - p.w / 2, p.x + p.w / 2, p.z - p.d / 2, p.z + p.d / 2), '공터 부품은 공터 자리에');
  const floor = own.find(p => p.m === 'grid');
  assert.ok(Math.abs(floor.y + floor.h / 2 - COMMONS.Y) < 1e-9, '바닥판 윗면이 COMMONS.Y');
  assert.equal(floor.w, COMMONS.N * TOWER.CELL);
  for (const p of hub.parts) {
    if (p.commons || p.hidden) continue;
    if (p.y + p.h / 2 <= 0.05) continue; // 섬, 모래, 바다 (바닥보다 낮음)
    assert.equal(hits(around, p.x - p.w / 2, p.x + p.w / 2, p.z - p.d / 2, p.z + p.d / 2), false, `부품이 공터와 겹침 ${JSON.stringify(p)}`);
  }
  const sign = hub.signs.filter(s => s.commons);
  assert.equal(sign.length, 1);
  assert.equal(sign[0].lines[0], '🧱 모두의 공터');
  for (const s of hub.signs) if (!s.commons) assert.equal(hits(around, s.x - s.w / 2, s.x + s.w / 2, s.z - s.w / 2, s.z + s.w / 2), false, s.lines[0]);
  for (const z of hub.zones) assert.equal(hits(around, z.x0, z.x1, z.z0, z.z1), false, JSON.stringify(z));
  for (const [x, , z] of hub.coins) assert.equal(hits(around, x - 0.5, x + 0.5, z - 0.5, z + 0.5), false, `코인 ${x},${z}`);
  // 주민은 집에서 12 안쪽으로 다닌다 (main.js updateNpcs)
  for (const n of hub.npcs) assert.equal(hits(around, n.x - 13, n.x + 13, n.z - 13, n.z + 13), false, n.name);
  assert.equal(hits(around, hub.spawn.x - 3, hub.spawn.x + 3, hub.spawn.z - 3, hub.spawn.z + 3), false, '시작 자리');
});

// ---------------------------------------------------------------- 가짜 World 로 Plaza 의 칸 흐름 보기
function fakeWorld() {
  const made = [];
  class FakeWorld {
    constructor(hooks, options) {
      this.hooks = hooks; this.options = options; this.id = ''; this.user = null; this.peers = new Map(); this.cells = new Map(); this.sent = [];
      made.push(this);
    }
    async open() {
      this.id = 'p3'; this.user = { id: 21, nickname: '서버닉네임' };
      // 들어올 때 받는 칸 (open 이 끝나기 전에 온다)
      for (const [k, v, id] of [['b|0|0|0', 2, 21], ['b|1|0|0', 4, 30]]) {
        const entry = { v, owner: { id, nickname: 'n' }, exp: Date.now() + COMMONS.TTL * 1000 };
        this.cells.set(k, entry); this.hooks.cell?.(k, entry);
      }
    }
    close() { this.id = ''; this.user = null; this.cells = new Map(); }
    set(k, v, opts) { this.sent.push(['set', k, v, opts]); return true; }
    del(k) { this.sent.push(['del', k]); return true; }
  }
  return { FakeWorld, made };
}

test('Plaza 칸: 들어오는 중에 받은 칸은 넘기지 않고 cells 로 보며, 들어온 뒤 바뀐 칸과 거절은 넘긴다', async () => {
  const { FakeWorld, made } = fakeWorld();
  const events = [];
  const plaza = new Plaza({
    opened: () => events.push(['opened', plaza.cells.size, plaza.userId]),
    cell: (k, e) => events.push(['cell', k, e]),
    cellError: (code, k) => events.push(['cellError', code, k]),
  }, { World: FakeWorld, ticket: async () => 't', timers: { setTimeout: () => 0, clearTimeout: () => {} } });
  assert.equal(plaza.cells.size, 0);
  assert.equal(plaza.userId, null);
  assert.equal(plaza.setCell('b|0|0|1', 3), false, '광장에 없으면 보내지 않는다');
  plaza.want(true);
  for (let i = 0; i < 5; i++) await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(events, [['opened', 2, 21]], '들어올 때 받은 칸은 opened 뒤 plaza.cells 로');
  const w = made[0];
  assert.equal(countMine(plaza.cells, plaza.userId), 1);
  // 보내기
  assert.equal(plaza.setCell('b|2|0|0', 7), true);
  assert.equal(plaza.delCell('b|0|0|0'), true);
  assert.deepEqual(w.sent, [['set', 'b|2|0|0', 7, { ttl: COMMONS.TTL }], ['del', 'b|0|0|0']], '공터 블록은 언제나 7일 ttl 을 붙여 놓는다');
  // 서버가 돌려준 칸과 거절
  const entry = { v: 7, owner: { id: 21, nickname: 'n' } };
  w.hooks.cell('b|2|0|0', entry);
  w.hooks.cell('b|0|0|0', null);
  w.hooks.error('taken', 'b|1|0|0');
  w.hooks.error('not-owner', 'b|1|0|0');
  w.hooks.error('limit-day', 'b|3|0|0');
  w.hooks.error('bad', 'b|4|0|0'); // 한도를 넓히기 전의 서버는 7일 ttl 을 bad 로 거절한다
  w.hooks.error('chat-rate');
  assert.deepEqual(events.slice(1), [
    ['cell', 'b|2|0|0', entry], ['cell', 'b|0|0|0', null],
    ['cellError', 'taken', 'b|1|0|0'], ['cellError', 'not-owner', 'b|1|0|0'], ['cellError', 'limit-day', 'b|3|0|0'],
    ['cellError', 'bad', 'b|4|0|0'],
  ], '칸과 관계없는 오류(chat-rate)는 넘기지 않는다');
  assert.equal(plaza.live, true, 'bad 를 받아도 광장에 그대로 있다');
  // 나가면 칸도 없다
  plaza.want(false);
  assert.equal(plaza.cells.size, 0);
  assert.equal(plaza.userId, null);
  assert.equal(plaza.delCell('b|2|0|0'), false);
});

// 진짜 World(packages/net/world.mjs)와 가짜 WebSocket 으로: 7일이 지난 칸은 World.expire 가 cell(k, null) 로 알리고
// 공터의 내 블록 수가 줄어든다. 들어올 때 이미 지난 칸은 받지 않는다.
class FakeSocket {
  constructor(url) { this.url = url; this.readyState = 1; this.sent = []; this.listeners = {}; }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  send(text) { this.sent.push(JSON.parse(text)); }
  close() { this.readyState = 3; }
  serve(message) { for (const fn of this.listeners.message ?? []) fn({ data: JSON.stringify(message) }); }
}

test('7일이 지난 공터 블록은 저절로 사라지고 내 블록 수가 줄어든다', async () => {
  const sockets = [], events = [];
  const plaza = new Plaza({
    cell: (k, e) => events.push([k, e]),
  }, {
    World, ticket: async () => 't', server: 'ws://local.test', timers: { setTimeout: () => 0, clearTimeout: () => {} },
    connect: url => { const s = new FakeSocket(url); sockets.push(s); return s; },
    fetch: async () => ({ status: 426, ok: false, json: async () => ({}) }),
  });
  plaza.want(true);
  for (let i = 0; i < 5 && !sockets.length; i++) await new Promise(r => setTimeout(r, 0));
  const socket = sockets[0], me = { id: 21, nickname: '나' }, friend = { id: 30, nickname: '친구' };
  const now = Date.now(), week = COMMONS.TTL * 1000;
  socket.serve({ t: 'welcome', id: 'p1', user: me, max: 12, peers: [] });
  socket.serve({ t: 'cells', done: true, list: [
    { k: 'b|0|0|0', v: 1, owner: me, exp: now + week },            // 방금 놓음
    { k: 'b|1|0|0', v: 2, owner: me, exp: now + 1000 },            // 7일 전에 놓아서 1초 남음
    { k: 'b|2|0|0', v: 3, owner: friend, exp: now + 1000 },
    { k: 'b|3|0|0', v: 4, owner: me },                             // exp 없는 예전 블록 (그대로 그린다)
    { k: 'b|4|0|0', v: 5, owner: me, exp: now - 1 },               // 이미 지남 (받지 않는다)
  ] });
  for (let i = 0; i < 5 && !plaza.live; i++) await new Promise(r => setTimeout(r, 0));
  assert.equal(plaza.live, true);
  assert.deepEqual([...plaza.cells.keys()], ['b|0|0|0', 'b|1|0|0', 'b|2|0|0', 'b|3|0|0']);
  assert.ok(commonsBlock('b|3|0|0', plaza.cells.get('b|3|0|0')), 'exp 없는 예전 블록도 그린다');
  assert.equal(countMine(plaza.cells, plaza.userId, now), 2);
  // 1초가 지났다: World 의 1초마다 보기가 지난 칸을 cell(k, null) 로 알린다
  plaza.world.expire(now + 1001);
  assert.deepEqual(events, [['b|1|0|0', null], ['b|2|0|0', null]]);
  assert.deepEqual([...plaza.cells.keys()], ['b|0|0|0', 'b|3|0|0']);
  assert.equal(countMine(plaza.cells, plaza.userId, now + 1001), 1);
  // 7일이 지났다: 방금 놓은 것도 사라지고, exp 없는 예전 블록만 남는다
  plaza.world.expire(now + week);
  assert.deepEqual(events.at(-1), ['b|0|0|0', null]);
  assert.deepEqual([...plaza.cells.keys()], ['b|3|0|0']);
  assert.equal(countMine(plaza.cells, plaza.userId, now + week), 0);
  plaza.want(false);
});

test('공터 알림: 서버 오류마다 한 줄, missing 은 조용히, 같은 알림은 연달아 나오지 않는다', () => {
  for (const code of ['taken', 'not-owner', 'limit', 'world-full', 'rate', 'limit-day', 'bad']) {
    const text = commonsError(code);
    assert.ok(text && text.length <= 40, code);
  }
  assert.equal(commonsError('taken'), '다른 친구가 먼저 놓았어');
  assert.equal(commonsError('not-owner'), '다른 친구가 놓은 블록은 못 부숴');
  assert.match(commonsError('limit'), /400개/);
  assert.equal(commonsError('missing'), '');
  assert.equal(commonsError('who-knows'), '');
  assert.equal(COMMONS_TEXT.loggedOut, '로그인하면 여기에 같이 블록을 놓을 수 있어');
  const once = quietNotice(2000);
  assert.equal(once('너무 빨라!', 0), true);
  assert.equal(once('너무 빨라!', 500), false);
  assert.equal(once('너무 빨라!', 1999), false);
  assert.equal(once('다른 말', 2100), true);
  assert.equal(once('너무 빨라!', 2200), true, '다른 말이 끼면 다시 보인다');
  assert.equal(once('', 9000), false);
});
