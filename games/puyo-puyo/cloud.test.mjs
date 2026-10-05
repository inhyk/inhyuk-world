// 클라우드 세이브 adapter (cloud.mjs) 와 기기 계정 옮기기 (migrate.mjs) 를 가짜 서버로 확인한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudSave, readCache, saveSummary, GAME } from './cloud.mjs';
import { migrateLocal, markMigrated, migrationMarker, importIdFor, checkLocalPassword } from './migrate.mjs';
import { emptyStore, createAccount, newProgress } from './profile.mjs';
import { memoryStorage } from '../../packages/net/social.mjs';

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
