// 업그레이드 3 (인혁이 기획서 3~6번): 트로피, 관전, 온라인 랭킹, 랭킹 5등 스킨을 실제 Chrome 세 창과 로컬 net 서버로 끝까지 확인한다.
// A, B 가 "게임 찾기"로 대전 → C 가 관전 목록에서 골라 본다 (그림대로 두 필드 위에 닉네임과 레벨, 아래에 점수)
// → 대전하는 두 사람 화면에 "👀 1명이 보는 중" → 판이 끝나면 이긴 사람 결과에 "🏆 트로피 +1"
// → 온라인 랭킹 세 가지(트로피, 레벨, 온라인 승리)와 내 순위 → 5등 안이라 챔피언 스킨
// → 이긴 사람과 C 가 친구가 된 뒤 다시 대전 → C 의 친구 목록에서 "👀 관전" → 손님은 랭킹과 관전에 로그인 안내.
//
// 사용법:
//   npm run puyo-puyo:dev   (게임, http://127.0.0.1:5190)
//   PUYO_URL=http://127.0.0.1:5190/ node games/puyo-puyo/watch-ranking-browser-check.mjs
// net 서버: PUYO_NET 이 없으면 services/net 에서 빈 로컬 D1 로 wrangler dev 를 새로 띄우고(포트 8798) 끝나면 끈다.
// 화면 사진: PUYO_SHOTS (기본 /tmp/puyo-watch-ranking)
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.env.PUYO_URL || 'http://127.0.0.1:5190/';
const shots = process.env.PUYO_SHOTS || '/tmp/puyo-watch-ranking';
await mkdir(shots, { recursive: true });
const netDir = fileURLToPath(new URL('../../services/net/', import.meta.url));

// ---------- 로컬 net 서버 ----------
let server = null, NET = process.env.PUYO_NET;
if (!NET) {
  const state = await mkdtemp(join(tmpdir(), 'puyo-net-'));
  execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'net', '--local', '--persist-to', state], { cwd: netDir, stdio: 'ignore', env: { ...process.env, CI: '1' } });
  const port = 8798;
  server = spawn('npx', ['wrangler', 'dev', '--port', String(port), '--ip', '127.0.0.1', '--persist-to', state], { cwd: netDir, detached: true, env: { ...process.env, CI: '1' } });
  let log = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error(`wrangler dev 가 뜨지 않음\n${log}`)), 60000);
    const read = chunk => { log += chunk; if (/Ready on/.test(log)) { clearTimeout(timer); resolve(); } };
    server.stdout.on('data', read); server.stderr.on('data', read);
    server.on('exit', code => reject(Error(`wrangler dev 가 끝남 (${code})\n${log}`)));
  });
  NET = `http://127.0.0.1:${port}`;
}
const stopServer = () => { if (server) try { process.kill(-server.pid, 'SIGTERM'); } catch { /* 이미 끝남 */ } };

const url = `${base}${base.includes('?') ? '&' : '?'}test&net=${encodeURIComponent(NET)}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
// 저장이 아직 없을 때(404 no-save)는 일부러 내는 응답인데 Chrome 이 콘솔 오류로 찍는다
const expected = /Failed to load resource: the server responded with a status of 404/;
const T = { timeout: 20000 };
async function open(name, viewport = { width: 1100, height: 860 }) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !expected.test(m.text())) errors.push(`${name}: ${m.text()}`); });
  page.on('dialog', d => d.accept());
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__puyo, null, { timeout: 60000 });
  return page;
}
const settle = page => page.waitForTimeout(400);
const read = page => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const screenIs = (page, name) => page.waitForFunction(n => JSON.parse(window.render_game_to_text()).screen === n, name, T);
async function signup(page, nick, pass) {
  await page.click('#go-signup');
  await page.fill('#signup-name', nick); await page.fill('#signup-pass', pass);
  await page.click('#signup-form button[type=submit]');
  await screenIs(page, 'menu');
  await page.evaluate(() => { document.getElementById('toasts').style.visibility = 'hidden'; }); // 사진을 가리지 않게
}
// 두 사람이 게임 찾기로 만나 1판 먼저 이기기로 시작한다 → [방장, 손님]
async function startMatch(a, b) {
  for (const p of [a, b]) { await p.evaluate(() => window.__puyo.show('online')); await screenIs(p, 'online'); }
  await a.click('#online-find');
  await a.waitForSelector('#online-searching:not([hidden])');
  await b.click('#online-find');
  for (const p of [a, b]) await p.waitForSelector('#online-lobby:not([hidden])', { timeout: 30000 });
  const aHost = (await read(a)).online.host;
  const [host, guest] = aHost ? [a, b] : [b, a];
  await host.waitForFunction(() => !document.getElementById('online-start').disabled, null, T);
  await host.click('#online-first [data-v="1"]');
  await guest.waitForFunction(() => document.getElementById('online-wait').textContent.includes('1판'), null, T);
  await host.click('#online-start');
  for (const p of [a, b]) await p.waitForFunction(() => window.__puyo.game?.mode === 'online' && window.__puyo.match?.phase === 'play', null, T);
  return [host, guest];
}
const tag = Math.random().toString(36).slice(2, 6);
const nicks = new Map();

try {
  // 1. 가입 세 명 (A 컴퓨터, B 휴대폰, C 구경하는 사람). A 는 고양이 스킨을 끼고 있다
  const a = await open('A'), b = await open('B', { width: 390, height: 844 }), c = await open('C', { width: 1470, height: 790 });
  for (const [page, name] of [[a, `가${tag}`], [b, `나${tag}`], [c, `다${tag}`]]) { nicks.set(page, name); await signup(page, name, 'abcd1'); }
  await a.evaluate(() => { const p = window.__puyo.P(); p.owned.skin.push('cat'); p.equip.skin = 'cat'; window.__puyo.save(); });
  // 아직 대전이 없으면 관전 목록은 비어 있다
  await c.click('[data-go="online"]'); await screenIs(c, 'online');
  await c.click('#go-watch'); await screenIs(c, 'watch');
  await c.waitForFunction(() => /지금 하고 있는 온라인 대전이 없어/.test(document.getElementById('watch-list').textContent), null, T);

  // 2. A, B 가 대전 → C 가 관전 목록에서 골라 본다
  const [host, guest] = await startMatch(a, b);
  const hostNick = nicks.get(host), guestNick = nicks.get(guest);
  await c.click('#watch-refresh');
  await c.waitForSelector('#watch-list .watch-row', T);
  const rowText = await c.textContent('#watch-list .watch-row .vsline');
  assert.ok(rowText.includes(`${nicks.get(a)} Lv.1`) && rowText.includes(`${nicks.get(b)} Lv.1`) && rowText.includes('VS'), rowText);
  await settle(c); await c.screenshot({ path: `${shots}/watch-list.png` });
  await c.click('#watch-list .watch-row button');
  await c.waitForFunction(() => window.__puyo.game?.mode === 'watch', null, T);
  // 그림대로: 왼쪽 방장, 오른쪽 손님. 필드 위 이름표에 닉네임과 레벨, 아래에 점수
  assert.equal(await c.textContent('#hud-title'), `👀 관전 · ${hostNick} VS ${guestNick}`);
  const view = await c.evaluate(() => ({ names: window.__puyo.renderer.views.map(v => v.name), levels: window.__puyo.renderer.views.map(v => v.level), watch: window.__puyo.renderer.layout.watch, labels: window.__puyo.renderer.layout.label.length, tracked: window.__puyo.game.tracked }));
  assert.deepEqual(view, { names: [hostNick, guestNick], levels: [1, 1], watch: true, labels: 2, tracked: -1 });
  assert.equal(await c.locator('#touch').isHidden(), true); // 조작 단추 없음
  assert.equal(await c.locator('#hud-chat').isHidden(), true); // 채팅 없음
  // 두 사람의 필드 모습과 점수가 건너온다
  await host.evaluate(() => { const p = window.__puyo.match.players[0]; p.cells[71] = 3; p.score = 1230; p.refreshHeights(); });
  await guest.evaluate(() => { const p = window.__puyo.match.players[0]; p.cells[70] = 2; p.score = 450; p.refreshHeights(); });
  await c.waitForFunction(() => { const [l, r] = window.__puyo.match.players; return l.cells[71] === 3 && l.score === 1230 && r.cells[70] === 2 && r.score === 450; }, null, T);
  // 처음 인사를 남겨 두어서 나중에 들어온 C 도 스킨을 본다 (A 는 고양이)
  const aSide = host === a ? 0 : 1;
  await c.waitForFunction(i => window.__puyo.renderer.views[i].skin === 'cat', aSide, T);
  assert.equal(await c.evaluate(i => window.__puyo.renderer.views[i].skin, 1 - aSide), 'classic');
  // 대전하는 두 사람은 누가 보고 있는지 안다
  for (const p of [a, b]) await p.waitForFunction(() => document.getElementById('hud-watchers').textContent === '👀 1명이 보는 중' && !document.getElementById('hud-watchers').hidden, null, T);
  await c.waitForTimeout(700); await c.screenshot({ path: `${shots}/watch-desktop.png` });
  // 대전 채팅은 관전하는 사람에게 가지 않는다
  await host.click('#hud-chat'); await host.fill('#chat-input', '우리끼리 얘기'); await host.click('#chat-form button[type=submit]'); await host.click('#chat-close');
  await guest.waitForFunction(() => !document.getElementById('hud-chat-dot').hidden, null, T);
  assert.equal(await c.evaluate(() => document.querySelectorAll('#bubbles .bubble').length), 0);

  // 3. 판을 끝낸다 (방장 필드를 가득 채움) → 손님 승리: 결과에 트로피, C 화면에도 결과
  await host.evaluate(() => { const p = window.__puyo.match.players[0]; for (let y = 0; y < 12; y++) p.cells[y * 6 + 2] = 6; p.refreshHeights(); });
  for (const p of [a, b]) await p.waitForSelector('#result:not([hidden])', { timeout: 30000 });
  assert.equal(await guest.textContent('#result-trophy'), '🏆 트로피 +1 (모두 1개)');
  assert.equal(await guest.locator('#result-trophy').isVisible(), true);
  assert.equal(await host.locator('#result-trophy').isVisible(), false);
  assert.equal(await guest.evaluate(() => window.__puyo.P().trophies), 1);
  assert.equal(await host.evaluate(() => window.__puyo.P().trophies), 0);
  await c.waitForFunction(() => window.__puyo.match?.phase === 'over' && window.__puyo.match.wins.join() === '0,1', null, T);
  await settle(guest); await guest.screenshot({ path: `${shots}/result-trophy.png` });
  // 두 사람이 나가면 관전도 끝나고 목록으로 돌아온다
  for (const p of [a, b]) { await p.click('#result-buttons button.ghost'); await screenIs(p, 'online'); }
  await screenIs(c, 'watch');
  assert.equal(await c.evaluate(() => window.__puyo.watcher.active), false);
  for (const p of [a, b]) assert.equal(await p.locator('#hud-watchers').isHidden(), true);

  // 4. 온라인 랭킹 세 가지 (그림: 맨 위 "닉네임 레벨" 칸). 이긴 손님이 1등
  const rows = page => page.evaluate(() => [...document.querySelectorAll('#rank-list .rank-row')].map(r => [...r.children].map(x => x.textContent)));
  const openRanking = async (page, by) => {
    await page.evaluate(() => window.__puyo.show('ranking')); await screenIs(page, 'ranking');
    await page.click(`#rank-tabs [data-by="${by}"]`);
    await page.waitForFunction(() => !/불러오는 중/.test(document.getElementById('rank-list').textContent), null, T);
  };
  // 진 사람과 C 의 기록도 서버에 올라간 다음에 본다
  for (const p of [host, c]) await p.evaluate(() => window.__puyo.sendStats());
  await openRanking(guest, 'trophies');
  assert.deepEqual(await guest.evaluate(() => [...document.querySelectorAll('.rank-head span')].map(x => x.textContent)), ['순위', '닉네임', '레벨', '트로피']);
  const guestLevel = await guest.evaluate(() => window.__puyo.P().level);
  assert.deepEqual(await rows(guest), [['🥇', guestNick, `Lv.${guestLevel}`, '🏆 1']]); // 트로피가 없는 사람은 트로피 랭킹에 없다
  assert.match(await guest.textContent('#rank-me'), /^내 순위: 1등 · 🏆 1$/);
  assert.equal(await guest.locator('#rank-list .rank-row.me').count(), 1);
  await settle(guest); await guest.screenshot({ path: `${shots}/ranking-trophies.png` });
  // 온라인 승리는 서버가 두 사람의 보고로 센다
  await openRanking(guest, 'wins');
  assert.deepEqual((await rows(guest)).map(r => [r[0], r[1], r[3]]), [['🥇', guestNick, '🌐 1승']]);
  // 레벨 랭킹은 레벨 2부터: 이겨서 레벨이 오른 손님만 나온다 (진 사람과 C 는 아직 레벨 1)
  assert.ok(guestLevel >= 2, `이긴 사람 레벨 ${guestLevel}`);
  await openRanking(guest, 'level');
  assert.deepEqual((await rows(guest)).map(r => [r[0], r[1], r[2]]), [['🥇', guestNick, `Lv.${guestLevel}`]]);
  assert.equal(await guest.textContent('#rank-val-head'), '경험치');
  // 진 사람: 트로피가 없어서 트로피 랭킹에는 순위가 없다
  await openRanking(host, 'trophies');
  assert.match(await host.textContent('#rank-me'), /아직 트로피가 없어/);
  await settle(host); await host.screenshot({ path: `${shots}/ranking-${host === b ? 'phone' : 'desktop'}-loser.png` });
  await openRanking(b, 'level');
  await settle(b); await b.screenshot({ path: `${shots}/ranking-phone.png` });
  // 진 사람과 구경만 한 C 는 어느 랭킹에도 5등 안이 아니라서 챔피언 스킨이 없다
  for (const p of [host, c]) assert.equal(await p.evaluate(() => window.__puyo.P().owned.skin.includes('champion')), false);

  // 5. 랭킹 5등 안이라 챔피언 스킨을 받는다 (상점에는 "랭킹 5등 보상"으로 보인다)
  await guest.waitForFunction(() => window.__puyo.P().owned.skin.includes('champion'), null, T);
  await guest.evaluate(() => window.__puyo.show('shop')); await screenIs(guest, 'shop');
  const champion = guest.locator('#shop-grid .item', { hasText: '챔피언' });
  assert.match(await champion.locator('button').first().textContent(), /장착하기/);
  await champion.scrollIntoViewIfNeeded(); await settle(guest); await guest.screenshot({ path: `${shots}/shop-champion.png` });
  // 고난이도 레벨 스킨은 레벨이 모자라면 잠겨 있고 교환권 단추가 없다
  await guest.evaluate(() => { window.__puyo.P().tickets.skin = 3; window.__puyo.save(); window.__puyo.show('shop'); });
  const knight = guest.locator('#shop-grid .item', { hasText: '기사' });
  assert.match(await knight.locator('button').first().textContent(), /Lv\.30부터/);
  assert.equal(await knight.locator('.ticket-button').count(), 0);
  assert.match(await knight.locator('.hard-tag').textContent(), /교환권으로 못 받아/);
  assert.equal(await guest.locator('#shop-grid .item', { hasText: '병아리' }).locator('.ticket-button').count(), 1); // 보통 새 스킨은 교환권으로도 받는다
  await knight.scrollIntoViewIfNeeded(); await settle(guest); await guest.screenshot({ path: `${shots}/shop-level-skins.png` });

  // 6. 이긴 사람과 C 가 친구 → 다시 대전 → C 의 친구 목록에서 "👀 관전"
  await c.evaluate(n => window.__puyo.social.requestFriend(n), guestNick);
  await guest.evaluate(async () => { const s = window.__puyo.social; const r = await s.requests(); await s.acceptFriend(r.incoming[0].id); });
  const [host2, guest2] = await startMatch(a, b);
  await c.evaluate(() => window.__puyo.show('friends')); await screenIs(c, 'friends');
  await c.waitForSelector('#net-friend-list .friend .watch-btn', T);
  assert.equal(await c.textContent('#net-friend-list .friend small'), '대전 중');
  await settle(c); await c.screenshot({ path: `${shots}/friends-watch.png` });
  await c.click('#net-friend-list .friend .watch-btn');
  await c.waitForFunction(() => window.__puyo.game?.mode === 'watch', null, T);
  assert.equal(await c.textContent('#hud-title'), `👀 관전 · ${nicks.get(host2)} VS ${nicks.get(guest2)}`);
  for (const p of [a, b]) await p.waitForFunction(() => !document.getElementById('hud-watchers').hidden, null, T);
  // 그만 보기 (⏸ 자리 단추): 목록으로 돌아오고, 두 사람 화면의 표시도 사라진다
  await c.click('#hud-pause');
  await screenIs(c, 'watch');
  for (const p of [a, b]) await p.waitForFunction(() => document.getElementById('hud-watchers').hidden, null, T);
  // 휴대폰에서 관전 (B 대신 새 창): 좁은 화면에서도 두 필드가 나란히
  const d = await open('D', { width: 390, height: 844 });
  await signup(d, `라${tag}`, 'abcd1');
  await d.evaluate(() => window.__puyo.show('watch')); await screenIs(d, 'watch');
  await d.waitForSelector('#watch-list .watch-row', T);
  await d.click('#watch-list .watch-row button');
  await d.waitForFunction(() => window.__puyo.game?.mode === 'watch', null, T);
  await host2.evaluate(() => { const p = window.__puyo.match.players[0]; p.cells[66] = 1; p.cells[67] = 1; p.cells[68] = 4; p.score = 880; p.refreshHeights(); });
  await d.waitForFunction(() => window.__puyo.match.players[0].score === 880, null, T);
  await d.waitForTimeout(700); await d.screenshot({ path: `${shots}/watch-phone.png` });
  const fit = await d.evaluate(() => { const l = window.__puyo.renderer.layout, f = l.fields[1]; return { right: f.x + f.cell * 6, bottom: l.score[1].y + l.score[1].h, top: l.label[0].y, w: innerWidth, h: innerHeight }; });
  assert.ok(fit.right <= fit.w && fit.bottom <= fit.h && fit.top >= 40, JSON.stringify(fit));
  // 대전 중인 사람은 자기 대전을 관전 목록에서 보지 않는다
  await a.evaluate(() => window.__puyo.social.matches('jelly-tower')).then(list => assert.deepEqual(list, []));
  await host2.evaluate(() => { const p = window.__puyo.match.players[0]; for (let y = 0; y < 12; y++) p.cells[y * 6 + 2] = 6; p.refreshHeights(); });
  for (const p of [a, b]) await p.waitForSelector('#result:not([hidden])', { timeout: 30000 });
  for (const p of [a, b]) { await p.click('#result-buttons button.ghost'); await screenIs(p, 'online'); }
  await screenIs(d, 'watch');

  // 7. 손님(로그인 안 함)은 랭킹과 관전에서 로그인 안내를 본다
  const g = await open('손님');
  await g.click('#go-guest'); await screenIs(g, 'menu');
  await g.click('[data-go="ranking"]'); await screenIs(g, 'ranking');
  assert.equal(await g.locator('#rank-need-login').isVisible(), true);
  assert.equal(await g.locator('#rank-board').isVisible(), false);
  await g.evaluate(() => window.__puyo.show('watch'));
  assert.equal(await g.locator('#watch-need-login').isVisible(), true);

  assert.deepEqual(errors, []);
  console.log('PASS: 관전 목록 → 두 필드 위 닉네임·레벨과 아래 점수, 필드·점수·스킨이 건너옴, 채팅은 안 감, 보는 사람 수 → 트로피 +1 → 랭킹 3가지와 내 순위 → 5등 챔피언 스킨, 레벨 스킨은 교환권 없음 → 친구 목록에서 관전, 그만 보기, 휴대폰 관전 → 손님 안내 — 오류 없음');
  console.log(`Screenshots: ${shots}`);
} finally {
  await browser.close();
  stopServer();
}
