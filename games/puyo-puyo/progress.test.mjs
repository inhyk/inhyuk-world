import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyStore, createAccount, login, logout, currentAccount, exportCode, importCode, loadStore, saveStore,
  newProgress, addXp, xpToNext, sanitize, STORE_KEY,
} from './profile.mjs';
import { track, claim, missionView, dailyFor, unclaimedCount } from './missions.mjs';
import { canBuy, buy, equip, grant } from './shop.mjs';
import { FLOORS, floorState, clearFloor, loseFloor, floorReward, helpLevel } from './tower.mjs';

const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

test('계정 만들기 → 로그아웃 → 비밀번호로 로그인', async () => {
  const store = emptyStore();
  const made = await createAccount(store, '  인혁  ', '1234');
  assert.equal(made.ok, true);
  assert.equal(made.account.name, '인혁');
  assert.notEqual(made.account.hash, '1234');
  assert.equal((await createAccount(store, '인혁', 'abcd')).ok, false);
  assert.equal((await createAccount(store, '친구', '12')).ok, false);
  logout(store);
  assert.equal(currentAccount(store), null);
  assert.equal((await login(store, '인혁', '9999')).ok, false);
  const ok = await login(store, '인혁', '1234');
  assert.equal(ok.ok, true);
  assert.equal(currentAccount(store).name, '인혁');
  const storage = memory();
  saveStore(storage, store);
  const back = loadStore(storage);
  assert.equal(back.accounts.length, 1);
  assert.equal(currentAccount(back).name, '인혁');
  assert.ok(storage.getItem(STORE_KEY).length > 10);
});

test('기록 코드로 다른 기기에 옮기면 레벨·코인이 그대로, 비밀번호도 그대로', async () => {
  const a = emptyStore();
  const { account } = await createAccount(a, '젤리왕', 'puyo');
  account.progress.level = 7;
  account.progress.coins = 4321;
  account.progress.tower.best = 3;
  const code = exportCode(account);
  assert.match(code, /^JELLY1\./);
  const b = emptyStore();
  const imported = importCode(b, code);
  assert.equal(imported.ok, true);
  assert.equal(imported.account.progress.level, 7);
  assert.equal(imported.account.progress.coins, 4321);
  assert.equal((await login(b, '젤리왕', 'puyo')).ok, true);
  assert.equal(importCode(b, code.slice(0, -3) + 'zzz').ok, false);
  assert.equal(importCode(b, 'hello').ok, false);
  // 이름을 바꾸기 전(뿌요 타워 시절)에 복사해 둔 PUYO1 코드도 그대로 들어온다
  const old = importCode(emptyStore(), code.replace(/^JELLY1\./, 'PUYO1.'));
  assert.equal(old.ok, true);
  assert.equal(old.account.progress.coins, 4321);
});

test('레벨: 경험치가 차면 오르고 코인을 받는다', () => {
  const p = newProgress();
  assert.equal(xpToNext(1), 100);
  const r = addXp(p, 100 + 140 + 10);
  assert.deepEqual(r.levels, [2, 3]);
  assert.equal(p.level, 3);
  assert.equal(p.xp, 10);
  assert.equal(r.coins, (50 + 20) + (50 + 30));
  assert.equal(p.coins, 100 + r.coins);
});

test('옛 기록이나 망가진 기록도 열린다', () => {
  const p = sanitize({ level: '5', coins: -3, owned: { skin: ['gem'] }, equip: { skin: 'nope' } });
  assert.equal(p.level, 5);
  assert.equal(p.coins, 0);
  assert.deepEqual(p.owned.skin, ['classic', 'gem']);
  assert.equal(p.equip.skin, 'classic');
  assert.equal(p.tower.best, 0);
});

test('챌린지: 타워에서 5연쇄 하면 완료되고 보상을 한 번만 받는다', () => {
  const p = newProgress();
  let done = track(p, { type: 'chain', mode: 'vs', chain: 6, made: 20 }, '2026-09-30');
  assert.ok(!done.some(d => d.id === 'tower-chain-5'));
  done = track(p, { type: 'chain', mode: 'tower', chain: 5, made: 12 }, '2026-09-30');
  assert.ok(done.some(d => d.id === 'tower-chain-5'));
  assert.ok(done.some(d => d.id === 'tower-chain-3'));
  assert.ok(unclaimedCount(p, '2026-09-30') >= 3);
  const reward = claim(p, 'tower-chain-5', '2026-09-30');
  assert.deepEqual(reward, { coins: 200, xp: 120 });
  assert.equal(claim(p, 'tower-chain-5', '2026-09-30'), null);
  assert.equal(claim(p, 'tower-chain-10', '2026-09-30'), null);
  const view = missionView(p, '2026-09-30');
  assert.equal(view.list.find(m => m.id === 'tower-chain-7').v, 5);
});

test('챌린지: 합계 미션과 층 미션', () => {
  const p = newProgress();
  for (let i = 0; i < 25; i++) track(p, { type: 'pop', mode: 'tower', puyos: 4, colors: 1, maxGroup: 4 });
  assert.equal(missionView(p).list.find(m => m.id === 'tower-pop-100').done, true);
  track(p, { type: 'tower', floor: 3 });
  const list = missionView(p).list;
  assert.equal(list.find(m => m.id === 'tower-floor-1').done, true);
  assert.equal(list.find(m => m.id === 'tower-floor-3').done, true);
  assert.equal(list.find(m => m.id === 'tower-floor-5').done, false);
});

test('오늘의 미션은 날짜마다 3개, 같은 날은 같다', () => {
  const a = dailyFor('2026-09-30').map(d => d.id), b = dailyFor('2026-09-30').map(d => d.id);
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, 3);
  const days = new Set();
  for (let d = 1; d <= 20; d++) days.add(dailyFor(`2026-10-${String(d).padStart(2, '0')}`).map(x => x.id).join());
  assert.ok(days.size > 5);
});

test('상점: 코인·레벨이 되어야 사고, 산 건 바로 장착', () => {
  const p = newProgress();
  p.coins = 1000;
  assert.equal(canBuy(p, 'skin', 'gem'), 'level');
  assert.equal(canBuy(p, 'skin', 'crown'), 'reward');
  assert.equal(buy(p, 'effect', 'star'), 'bought');
  assert.equal(p.coins, 850);
  assert.equal(p.equip.effect, 'star');
  assert.equal(canBuy(p, 'effect', 'star'), 'owned');
  assert.equal(equip(p, 'effect', 'sparkle'), true);
  assert.equal(equip(p, 'skin', 'neon'), false);
  grant(p, 'skin', 'crown');
  assert.equal(equip(p, 'skin', 'crown'), true);
  p.coins = 10;
  assert.equal(canBuy(p, 'effect', 'heart'), 'level');
  p.level = 2;
  assert.equal(canBuy(p, 'effect', 'heart'), 'coins');
});

test('타워: 작은→큰→운석→별→달→왕관 순서, 꼭대기에서 엔딩, 그다음 비밀 혜성 층', () => {
  assert.deepEqual(FLOORS.slice(0, 6).map(f => f.icon), ['small', 'big', 'rock', 'star', 'moon', 'crown']);
  assert.deepEqual(FLOORS.map(f => f.ai), [1, 2, 3, 4, 5, 6, 7, 8]);
  const t = newProgress().tower;
  assert.equal(floorState(t, 1), 'open');
  assert.equal(floorState(t, 2), 'locked');
  assert.equal(floorState(t, 7), 'hidden');
  loseFloor(t, 1); loseFloor(t, 1);
  assert.equal(helpLevel(t, 1), 2);
  assert.equal(floorReward(t, 1).first, true);
  for (let f = 1; f <= 5; f++) assert.equal(clearFloor(t, f).ending, false);
  assert.equal(helpLevel(t, 1), 0);
  assert.equal(floorState(t, 6), 'open');
  assert.equal(clearFloor(t, 6).ending, true);
  assert.equal(t.cleared, true);
  assert.equal(floorState(t, 7), 'open');
  assert.equal(clearFloor(t, 6).ending, false);
  assert.equal(floorReward(t, 2).first, false);
  const comet = clearFloor(t, 7);
  assert.equal(comet.secretFirst, true);
  assert.equal(comet.cometEnding, true);
  assert.equal(floorState(t, 7), 'cleared');
  assert.equal(clearFloor(t, 7).secretFirst, false);
  assert.equal(clearFloor(t, 7).cometEnding, true);
});
