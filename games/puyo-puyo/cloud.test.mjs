// 클라우드 세이브 adapter (cloud.mjs) 와 기기 계정 옮기기 (migrate.mjs) 를 가짜 서버로 확인한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudSave, readCache, saveSummary, GAME, cloudPayload } from './cloud.mjs';
import { SAVE_MAX_BYTES } from '../../services/net/src/saves.js';
import { maxProgress, bytes } from './save-size.fixture.mjs';
import { migrateLocal, markMigrated, migrationMarker, importIdFor, checkLocalPassword } from './migrate.mjs';
import { emptyStore, createAccount, newProgress } from './profile.mjs';
import { memoryStorage } from '../../packages/net/social.mjs';
import { scopedStorage } from './net.mjs';
import { writeCache } from './cloud.mjs';

class NetError extends Error { constructor(code) { super(code); this.code = code; } }

// 서버 하나를 흉내 낸다: revision 이 맞을 때만 쓰고, importId 는 한 번만.
function fakeServer() {
  const s = {
    save: null, imports: new Set(), down: false, calls: [], updatedAt: 1000,
    async loadSave(game) {
      s.calls.push(['load', game]);
      if (s.down) throw new NetError('network');
      return s.save ? structuredClone(s.save) : null;
    },
    async putSave(game, data, base, { importId } = {}) {
      s.calls.push(['put', game, base, importId ?? null]);
      if (s.down) throw new NetError('network');
      if (importId && s.imports.has(importId)) return { ok: true, revision: s.save.revision, updated: s.save.updated, duplicate: true };
      const current = s.save?.revision ?? 0;
      if ((base ?? 0) !== current) return { conflict: true, server: s.save ? structuredClone(s.save) : { data: null, revision: 0, updated: null } };
      s.save = { data: structuredClone(data), revision: current + 1, updated: ++s.updatedAt };
      if (importId) s.imports.add(importId);
      return { ok: true, revision: s.save.revision, updated: s.save.updated };
    },
  };
  return s;
}

// 손으로 돌리는 타이머
function fakeTimers() {
  let id = 0;
  const t = { jobs: new Map(),
    setTimeout(fn, ms) { t.jobs.set(++id, { fn, ms }); return id; },
    clearTimeout(i) { t.jobs.delete(i); },
    async runAll() { const jobs = [...t.jobs.values()]; t.jobs.clear(); for (const j of jobs) j.fn(); await settle(); },
  };
  return t;
}
const settle = () => new Promise(r => setTimeout(r, 0));

function make(server, extra = {}) {
  const storage = extra.storage ?? memoryStorage();
  const timers = fakeTimers();
  const applied = [], states = [], conflicts = [];
  const cloud = new CloudSave({
    client: server, uid: 7, storage, timers, initial: () => newProgress(),
    apply: d => applied.push(d), onStatus: s => states.push(s),
    onConflict: async info => { conflicts.push(info); return extra.choose ?? 'server'; },
    ...extra.options,
  });
  return { cloud, storage, timers, applied, states, conflicts };
}

test('로그인하면 서버 저장을 읽어 게임에 넣는다', async () => {
  const server = fakeServer();
  server.save = { data: { ...newProgress(), level: 9, coins: 777 }, revision: 4, updated: 5 };
  const { cloud, applied } = make(server);
  const data = await cloud.start();
  assert.equal(data.level, 9);
  assert.equal(applied.at(-1).coins, 777);
  assert.equal(cloud.revision, 4);
  assert.equal(cloud.state, 'synced');
});

test('바뀐 뒤 3초 조용하면 baseRevision 을 붙여 올린다 (몰아서 한 번)', async () => {
  const server = fakeServer();
  server.save = { data: newProgress(), revision: 2, updated: 1 };
  const { cloud, timers } = make(server);
  await cloud.start();
  const p = newProgress();
  p.coins = 150; cloud.change(p);
  p.coins = 160; cloud.change(p);
  assert.equal(cloud.state, 'pending');
  assert.equal([...timers.jobs.values()][0].ms, 3000);
  assert.equal(server.calls.filter(c => c[0] === 'put').length, 0);
  await timers.runAll();
  const puts = server.calls.filter(c => c[0] === 'put');
  assert.deepEqual(puts, [['put', GAME, 2, null]]);
  assert.equal(server.save.data.coins, 160);
  assert.equal(server.save.revision, 3);
  assert.equal(cloud.revision, 3);
  assert.equal(cloud.dirty, false);
});

test('보내는 동안 게임이 같은 객체를 또 바꿔도 보낸 것만 올라간 것으로 친다', async () => {
  const server = fakeServer();
  const { cloud } = make(server);
  await cloud.start();
  const p = newProgress();
  p.coins = 1; cloud.change(p);
  p.coins = 2; // change 를 부르지 않았으므로 아직 반영 안 됨
  await cloud.flush();
  assert.equal(server.save.data.coins, 1);
});

test('409: 합치지 않고 고르게 한다. 서버를 고르면 서버 것을 쓴다 (코인 큰 쪽을 고르지 않음)', async () => {
  const server = fakeServer();
  server.save = { data: newProgress(), revision: 1, updated: 1 };
  const { cloud, conflicts, applied } = make(server, { choose: 'server' });
  await cloud.start();
  // 다른 기기가 먼저 씀
  server.save = { data: { ...newProgress(), level: 3, coins: 50 }, revision: 2, updated: 99 };
  const mine = { ...newProgress(), level: 2, coins: 900 };
  cloud.change(mine);
  const when = cloud.updated;
  await cloud.flush();
  assert.equal(conflicts.length, 1);
  assert.deepEqual(conflicts[0], { local: saveSummary(mine, when), server: { level: 3, coins: 50, updated: 99 } });
  assert.equal(applied.at(-1).coins, 50);
  assert.equal(server.save.revision, 2); // 서버를 골랐으므로 쓰지 않음
  assert.equal(cloud.revision, 2);
  assert.equal(cloud.dirty, false);
});

test('409: 이 기기를 고르면 서버 revision 으로 다시 쓴다', async () => {
  const server = fakeServer();
  server.save = { data: newProgress(), revision: 1, updated: 1 };
  const { cloud } = make(server, { choose: 'local' });
  await cloud.start();
  server.save = { data: { ...newProgress(), coins: 5000 }, revision: 5, updated: 2 };
  cloud.change({ ...newProgress(), coins: 30 });
  await cloud.flush();
  const puts = server.calls.filter(c => c[0] === 'put').map(c => c[2]);
  assert.deepEqual(puts, [1, 5]);
  assert.equal(server.save.data.coins, 30);
  assert.equal(server.save.revision, 6);
  assert.equal(cloud.state, 'synced');
});

test('인터넷이 없으면 기기에 적어 두고 나중에 다시 올린다', async () => {
  const server = fakeServer();
  server.save = { data: newProgress(), revision: 1, updated: 1 };
  const { cloud, timers, storage } = make(server);
  await cloud.start();
  server.down = true;
  cloud.change({ ...newProgress(), coins: 321 });
  await timers.runAll();       // 3초 뒤 올리기 → 실패
  assert.equal(cloud.state, 'offline');
  assert.equal(readCache(storage, 7).dirty, true);
  assert.equal(readCache(storage, 7).data.coins, 321);
  server.down = false;
  await timers.runAll();       // 다시 시도
  assert.equal(server.save.data.coins, 321);
  assert.equal(cloud.state, 'synced');
  assert.equal(readCache(storage, 7).dirty, false);
});

test('꺼진 사이 바꾼 기록: 다음에 켤 때 같은 revision 이면 그대로 올리고, 아니면 고르게 한다', async () => {
  const server = fakeServer();
  server.save = { data: newProgress(), revision: 1, updated: 1 };
  const storage = memoryStorage();
  const first = make(server, { storage });
  await first.cloud.start();
  server.down = true;
  first.cloud.change({ ...newProgress(), coins: 444 });
  await first.timers.runAll();
  first.cloud.stop();
  server.down = false;
  // 앱을 다시 켬: 기기 기록(dirty)이 revision 1 에서 시작했으므로 그대로 올린다
  const again = make(server, { storage });
  assert.equal(again.cloud.dirty, true);
  await again.cloud.start();
  assert.equal(server.save.data.coins, 444);
  assert.equal(again.conflicts.length, 0);
  // 다시 꺼진 사이 다른 기기가 씀 → 고르기
  server.down = true;
  again.cloud.change({ ...newProgress(), coins: 1 });
  await again.timers.runAll();
  again.cloud.stop();
  server.down = false;
  server.save = { data: { ...newProgress(), coins: 2 }, revision: 9, updated: 3 };
  const third = make(server, { storage, choose: 'server' });
  await third.cloud.start();
  assert.equal(third.conflicts.length, 1);
  assert.equal(third.applied.at(-1).coins, 2);
});

test('서버가 아예 안 되고 기기 기록도 없으면 새 기록으로 시작하고 기다린다', async () => {
  const server = fakeServer();
  server.down = true;
  const { cloud, timers } = make(server);
  const data = await cloud.start();
  assert.equal(data.level, 1);
  assert.equal(cloud.state, 'offline');
  assert.equal(timers.jobs.size, 1);
});

test('로그인이 풀리면 onAuthLost 를 부른다', async () => {
  const server = fakeServer();
  let lost = '';
  server.loadSave = async () => { throw new NetError('login-required'); };
  const { cloud } = make(server, { options: { onAuthLost: code => { lost = code; } } });
  await assert.rejects(cloud.start());
  assert.equal(lost, 'login-required');
});

test('importLocal: importId 로 한 번만 올리고, 다시 보내면 서버 것을 읽는다', async () => {
  const server = fakeServer();
  const { cloud } = make(server);
  const local = { ...newProgress(), level: 12, coins: 3000 };
  await cloud.importLocal(local, 'jelly-abc123');
  assert.equal(server.save.revision, 1);
  const again = make(server).cloud;
  await again.importLocal(local, 'jelly-abc123');
  assert.equal(server.save.revision, 1);
  assert.equal(again.revision, 1);
  assert.equal(again.data.coins, 3000);
});

test('409 에서 이 기기를 골라 다시 쓰는 동안 또 바뀐 기록은 올라간 것으로 치지 않고 다시 올린다', async () => {
  const server = fakeServer();
  const { cloud, timers } = make(server, { choose: 'local' });
  cloud.data = { coins: 100 }; cloud.revision = 0; cloud.dirty = true;
  // 고른 기록을 쓰는 응답을 붙잡아 두고, 그 사이 게임이 기록을 바꾼다
  let release;
  const realPut = server.putSave;
  server.putSave = (...args) => new Promise(resolve => { release = () => resolve(realPut(...args)); });
  const resolving = cloud.resolve({ data: { coins: 80 }, revision: 2, updated: 5 });
  await settle();
  server.save = { data: { coins: 80 }, revision: 2, updated: 5 };
  cloud.change({ coins: 50 });
  release();
  await resolving;
  assert.equal(server.save.data.coins, 100);
  assert.equal(cloud.revision, 3);
  assert.equal(cloud.dirty, true);
  assert.equal(cloud.state, 'pending');
  assert.equal(readCache(cloud.o.storage, 7).dirty, true);
  // 조용해지면 바뀐 기록을 새 revision 으로 올린다
  server.putSave = realPut;
  await timers.runAll();
  await cloud.busy;
  assert.equal(server.save.data.coins, 50);
  assert.equal(server.save.revision, 4);
  assert.equal(cloud.dirty, false);
  assert.equal(cloud.state, 'synced');
});

test('importLocal 이 409 로 고르기 창을 거쳐 이 기기 것을 쓰면 importId 도 같이 보내 다시 해도 두 번 쓰지 않는다', async () => {
  const server = fakeServer();
  server.save = { data: { ...newProgress(), coins: 1 }, revision: 3, updated: 1 };
  const { cloud } = make(server, { choose: 'local' });
  const local = { ...newProgress(), level: 9, coins: 900 };
  await cloud.importLocal(local, 'jelly-conflict1');
  const puts = server.calls.filter(c => c[0] === 'put');
  assert.deepEqual(puts.map(c => [c[2], c[3]]), [[0, 'jelly-conflict1'], [3, 'jelly-conflict1']]);
  assert.equal(server.save.data.coins, 900);
  assert.equal(server.save.revision, 4);
  // 응답을 못 받았다고 보고 다시 옮겨도 서버를 또 쓰지 않는다
  const again = make(server, { choose: 'local' });
  await again.cloud.importLocal(local, 'jelly-conflict1');
  assert.equal(server.save.revision, 4);
  assert.equal(again.conflicts.length, 0);
});

// ---------- 옮기기 ----------
async function localAccount(name = '인혁', password = '1234') {
  const store = emptyStore();
  const r = await createAccount(store, name, password);
  r.account.progress.level = 7; r.account.progress.coins = 555;
  return { store, local: r.account };
}
function fakeAccount({ taken = [] } = {}) {
  const users = new Map(taken.map(([n, p]) => [n.toLowerCase(), p]));
  return {
    loggedIn: false, user: null, users,
    async signup(nickname, password) {
      if (users.has(nickname.toLowerCase())) throw new NetError('nickname-taken');
      users.set(nickname.toLowerCase(), password);
      this.loggedIn = true; this.user = { id: 1, nickname }; return this.user;
    },
    async login(nickname, password) {
      if (users.get(nickname.toLowerCase()) !== password) throw new NetError('wrong-login');
      this.loggedIn = true; this.user = { id: 2, nickname }; return this.user;
    },
  };
}

test('기기 비밀번호 확인', async () => {
  const { local } = await localAccount();
  assert.equal(await checkLocalPassword(local, '1234'), true);
  assert.equal(await checkLocalPassword(local, '9999'), false);
});

test('옮기기: 같은 닉네임으로 가입하고 기기 기록을 importId 로 한 번 올린다', async () => {
  const { store, local } = await localAccount();
  const account = fakeAccount();
  const marker = migrationMarker(memoryStorage());
  const uploads = [];
  const before = JSON.stringify(store);
  const r = await migrateLocal({ local, password: '1234', account, marker, upload: async (p, id) => { uploads.push([p.level, p.coins, id]); } });
  assert.equal(r.ok, true);
  assert.deepEqual(uploads, [[7, 555, `jelly-${local.id}`]]);
  assert.equal(importIdFor(local), `jelly-${local.id}`);
  assert.equal(JSON.stringify(store), before); // 기기 계정은 그대로
  assert.equal(marker.get(), null);
  markMigrated(store, local.id, '인혁');
  assert.equal(store.accounts[0].migratedTo, '인혁');
  assert.equal(store.current, null);
});

test('옮기기: 닉네임이 이미 있으면 알려 주고, 내 계정이면 로그인해서 옮긴다', async () => {
  const { local } = await localAccount();
  const account = fakeAccount({ taken: [['인혁', 'abcd']] });
  const upload = async () => {};
  const first = await migrateLocal({ local, password: '1234', account, upload });
  assert.deepEqual([first.ok, first.step, first.code], [false, 'auth', 'nickname-taken']);
  const wrong = await migrateLocal({ local, password: '1234', mode: 'login', account, upload });
  assert.equal(wrong.code, 'wrong-login');
  const ok = await migrateLocal({ local, password: 'abcd', mode: 'login', account, upload });
  assert.equal(ok.ok, true);
});

test('옮기기: 새 닉네임을 골라 가입할 수 있다', async () => {
  const { local } = await localAccount();
  const account = fakeAccount({ taken: [['인혁', 'abcd']] });
  const r = await migrateLocal({ local, nickname: '인혁2', password: '1234', account, upload: async () => {} });
  assert.equal(r.ok, true);
  assert.equal(account.user.nickname, '인혁2');
});

test('옮기기: 올리기가 실패하면 표시를 남기고, 다시 하면 가입을 건너뛰고 올리기만 한다', async () => {
  const { store, local } = await localAccount();
  const account = fakeAccount();
  const marker = migrationMarker(memoryStorage());
  const before = JSON.stringify(store);
  let fail = true, signups = 0;
  const signup = account.signup.bind(account);
  account.signup = async (...a) => { signups++; return signup(...a); };
  const upload = async () => { if (fail) throw new NetError('network'); };
  const r = await migrateLocal({ local, password: '1234', account, marker, upload });
  assert.deepEqual([r.ok, r.step], [false, 'upload']);
  assert.deepEqual(marker.get(), { localId: local.id, nickname: '인혁' });
  assert.equal(JSON.stringify(store), before);
  fail = false;
  const again = await migrateLocal({ local, password: '1234', account, marker, upload });
  assert.equal(again.ok, true);
  assert.equal(signups, 1);
  assert.equal(marker.get(), null);
});

// ---------- 충돌이 끝나지 않을 때 ----------
// 다른 기기가 매번 먼저 쓰는 서버: 쓸 때마다 revision 이 올라가서 늘 409
function racingServer() {
  const s = {
    revision: 5, calls: [],
    async loadSave() { return { data: { ...newProgress(), coins: 1 }, revision: s.revision, updated: s.revision }; },
    async putSave(game, data, base, { importId } = {}) {
      s.calls.push(['put', base, importId ?? null]);
      s.revision++;
      return { conflict: true, server: { data: { ...newProgress(), coins: 1 }, revision: s.revision, updated: s.revision } };
    },
  };
  return s;
}

test('importLocal: 충돌이 끝나지 않으면 conflict-exhausted 로 던진다 (올라간 것으로 치지 않음)', async () => {
  const server = racingServer();
  const { cloud } = make(server, { choose: 'local' });
  await assert.rejects(cloud.importLocal({ ...newProgress(), coins: 900 }, 'jelly-race'), e => e.code === 'conflict-exhausted');
  assert.equal(cloud.dirty, true);
  assert.equal(cloud.state, 'pending');
  // 모든 다시 쓰기에 importId 가 붙는다
  assert.ok(server.calls.every(c => c[2] === 'jelly-race'));
});

test('옮기기: 충돌이 끝나지 않으면 ok:false, 표시와 기기 계정은 그대로 남는다', async () => {
  const { store, local } = await localAccount();
  const account = fakeAccount();
  const marker = migrationMarker(memoryStorage());
  const server = racingServer();
  const { cloud } = make(server, { choose: 'local' });
  const before = JSON.stringify(store);
  const r = await migrateLocal({ local, password: '1234', account, marker, upload: (p, id) => cloud.importLocal(p, id) });
  assert.deepEqual([r.ok, r.step, r.code], [false, 'upload', 'conflict-exhausted']);
  assert.match(r.message, /다시 해 줘/);
  assert.deepEqual(marker.get(), { localId: local.id, nickname: '인혁' });
  assert.equal(JSON.stringify(store), before);
  assert.equal(store.accounts[0].migratedTo, undefined);
});

test('자동 저장: 충돌이 끝나지 않아도 던지지 않고 pending, dirty 로 두었다가 다음 flush 에 다시 올린다', async () => {
  const server = racingServer();
  const { cloud, timers } = make(server, { choose: 'local' });
  cloud.revision = 5;
  cloud.change({ ...newProgress(), coins: 42 });
  await timers.runAll();
  await cloud.busy;
  assert.equal(cloud.state, 'pending');
  assert.equal(cloud.dirty, true);
  const tries = server.calls.length;
  assert.equal(tries, 4); // 처음 한 번 + 고르고 다시 쓰기 3번
  // 다른 기기가 멈추면 다음 flush 에 올라간다
  server.putSave = async (game, data, base) => { server.calls.push(['put', base, null]); return { ok: true, revision: base + 1, updated: 99 }; };
  await cloud.flush();
  assert.equal(server.calls.length, tries + 1);
  assert.equal(cloud.dirty, false);
  assert.equal(cloud.state, 'synced');
});

// ---------- 저장 크기 ----------
// 서버 한도(services/net saves.js)를 그대로 지키는 가짜 서버
function sizedServer(max = SAVE_MAX_BYTES) {
  const s = fakeServer();
  const put = s.putSave;
  s.putSave = async (game, data, base, options) => {
    if (bytes(data) > max) { s.calls.push(['too-big', game, base]); throw Object.assign(new NetError('too-big'), { status: 413 }); }
    return put(game, data, base, options);
  };
  return s;
}

test('가장 큰 기록: 친구 기록까지 넣으면 서버 한도를 넘고, 올리는 기록(cloudPayload)은 한도 안이다', () => {
  const full = maxProgress();
  assert.ok(bytes(full) > SAVE_MAX_BYTES * 50, `full ${bytes(full)}`);
  const payload = cloudPayload(full);
  assert.ok(bytes(payload) < SAVE_MAX_BYTES / 3, `payload ${bytes(payload)}`);
  assert.equal(payload.social.key, '');
  assert.deepEqual(payload.social.friends, []);
  assert.equal(full.social.friends.length, 30); // 원본은 건드리지 않는다
});

test('가장 큰 기기 계정을 옮겨도 서버 한도 안에서 올라가고 우체통 열쇠는 서버에 가지 않는다', async () => {
  const { store, local } = await localAccount();
  local.progress = maxProgress();
  const key = local.progress.social.key;
  const server = sizedServer();
  const { cloud } = make(server);
  const r = await migrateLocal({ local, password: '1234', account: fakeAccount(), marker: migrationMarker(memoryStorage()),
    upload: (p, id) => cloud.importLocal(cloudPayload(p), id) });
  assert.equal(r.ok, true);
  assert.equal(server.save.data.coins, 999999999);
  assert.equal(server.save.data.social.key, '');
  assert.ok(!JSON.stringify(server.save.data).includes(key));
  assert.equal(store.accounts[0].progress.social.chats[local.progress.social.friends[0].code].length, 50); // 기기에는 그대로
});

test('가장 큰 기록의 자동 저장도 한도 안에서 올라간다', async () => {
  const server = sizedServer();
  server.save = { data: newProgress(), revision: 1, updated: 1 };
  const { cloud, timers } = make(server);
  await cloud.start();
  cloud.change(cloudPayload(maxProgress()));
  await timers.runAll(); await cloud.busy;
  assert.equal(cloud.state, 'synced');
  assert.equal(server.save.revision, 2);
  assert.equal(server.save.data.social.key, '');
});

test('서버가 너무 크다고(413) 하면 저장된 것으로 치지 않는다: 기기에 두고 too-big 으로 알리고 나중에 다시 올린다', async () => {
  const server = sizedServer(100); // 배포된 서버 한도가 더 작다고 치자
  server.save = { data: newProgress(), revision: 1, updated: 1 };
  const { cloud, timers, storage, states } = make(server, { options: { tooBigRetryMs: 300000 } });
  await cloud.start();
  const p = cloudPayload(maxProgress()); p.coins = 4321;
  cloud.change(p);
  await timers.runAll(); await cloud.busy;
  assert.equal(cloud.state, 'too-big');
  assert.ok(states.includes('too-big'));
  assert.equal(cloud.dirty, true);
  assert.equal(readCache(storage, 7).data.coins, 4321); // 기기에는 남는다
  assert.equal(readCache(storage, 7).dirty, true);
  assert.equal(server.save.revision, 1);
  assert.deepEqual([...timers.jobs.values()].map(j => j.ms), [300000]);
  // 한도를 올린 서버가 배포되면 다음 다시 하기에서 올라간다
  const big = sizedServer(); big.save = server.save; server.putSave = big.putSave;
  await timers.runAll(); await cloud.busy;
  assert.equal(cloud.state, 'synced');
  assert.equal(cloud.dirty, false);
  assert.equal(big.save.data.coins, 4321);
});

test('옮기다가 413 이면 ok:false(too-big), 옮기던 표시와 기기 계정은 그대로', async () => {
  const { store, local } = await localAccount();
  const marker = migrationMarker(memoryStorage());
  const server = sizedServer(100);
  const { cloud } = make(server);
  const r = await migrateLocal({ local, password: '1234', account: fakeAccount(), marker, upload: (p, id) => cloud.importLocal(cloudPayload(p), id) });
  assert.deepEqual([r.ok, r.step, r.code], [false, 'upload', 'too-big']);
  assert.match(r.message, /너무 커서/);
  assert.deepEqual(marker.get(), { localId: local.id, nickname: '인혁' });
  assert.equal(store.accounts[0].migratedTo, undefined);
  assert.equal(server.save, null);
});

test('기기 저장 공간이 꽉 차면(scopedStorage 경유) 저장한 것으로 치지 않고 알린다', async () => {
  const raw = { getItem: () => null, setItem() { throw Error('QuotaExceededError'); }, removeItem() {} };
  const storage = scopedStorage(raw, 'http://127.0.0.1:8787');
  assert.equal(storage.setItem('x', '1'), false);
  assert.equal(writeCache(storage, 7, { data: { coins: 1 }, revision: 0, dirty: true }), false);
  // 인터넷도 없을 때: 기기에도 서버에도 없으므로 synced 로 치면 안 되고, 기기 저장 실패를 알려야 한다
  const server = fakeServer();
  server.save = { data: { coins: 1 }, revision: 1, updated: 1 };
  const errors = [];
  const { cloud } = make(server, { storage, options: { onPersistError: state => errors.push(state) } });
  await cloud.start();
  server.down = true;
  cloud.change({ coins: 50 });
  await cloud.flush();
  assert.equal(cloud.localFailed, true);
  assert.ok(errors.length >= 1);
  assert.equal(cloud.dirty, true);
  assert.notEqual(cloud.state, 'synced');
  assert.equal(readCache(storage, 7), null);
  // 서버가 돌아오면 서버에는 올라가지만, 기기 저장 실패 표시는 그대로 남는다
  server.down = false;
  await cloud.flush();
  assert.equal(server.save.data.coins, 50);
  assert.equal(cloud.localFailed, true);
});
