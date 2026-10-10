// 인혁이 기획서 「뿌요뿌요 (업그레이드)」(2026-10-10)를 실제 Chrome 으로 끝까지 확인한다.
// 4번 혜성 엔딩이 마지막 글만 나오고 멈추던 버그(그리기 시각이 앞설 때) → 1번 대전 화면의 하늘(아침·낮·저녁·밤)
// → 2번 방해 뿌요 힘겨루기 막대 「나 ⚡ 상대」 → "스킨도 더 넣어줘" 새 스킨 12가지 → 3번 온라인 로비에서 캐릭터 고르기(두 계정).
//
// 사용법: npm run puyo-puyo:dev 후 PUYO_URL=http://127.0.0.1:5190/ node games/puyo-puyo/upgrade7-browser-check.mjs
// net 서버: PUYO_NET 이 없으면 services/net 에서 빈 로컬 D1 로 wrangler dev 를 새로 띄우고(포트 8799) 끝나면 끈다.
// 화면 사진: PUYO_SHOTS (기본 /tmp/puyo-upgrade7)
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKIES, skyAtHour, skyText } from './sky.mjs';
import { CLASH_MAX } from './clash.mjs';

const base = process.env.PUYO_URL || 'http://127.0.0.1:5190/';
const shots = process.env.PUYO_SHOTS || '/tmp/puyo-upgrade7';
await mkdir(shots, { recursive: true });
const netDir = fileURLToPath(new URL('../../services/net/', import.meta.url));

// ---------- 로컬 net 서버 ----------
let server = null, NET = process.env.PUYO_NET;
if (!NET) {
  const state = await mkdtemp(join(tmpdir(), 'puyo-net-'));
  execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'net', '--local', '--persist-to', state], { cwd: netDir, stdio: 'ignore', env: { ...process.env, CI: '1' } });
  const port = 8799;
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

const urlOf = (extra = '') => `${base}${base.includes('?') ? '&' : '?'}test&net=${encodeURIComponent(NET)}${extra}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const expected = /Failed to load resource: the server responded with a status of 404/; // 저장이 아직 없을 때(404 no-save)
const T = { timeout: 20000 };
const PC = { width: 1280, height: 720 }, PHONE = { width: 390, height: 844 };
async function open(name, viewport = PC, { extra = '', late = false } = {}) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !expected.test(m.text())) errors.push(`${name}: ${m.text()}`); });
  page.on('dialog', d => d.accept());
  // 바쁜 기기에서처럼 화면 그리기 시각이 '지금'보다 조금 앞서게 한다 (브라우저는 그리는 순간이 아니라 화면 주사 시각을 넘겨준다)
  if (late) await page.addInitScript(() => { const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => raf(t => cb(t - 40)); });
  await page.goto(urlOf(extra), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__puyo, null, { timeout: 60000 });
  return page;
}
const settle = page => page.waitForTimeout(400);
const read = page => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const screenIs = (page, name) => page.waitForFunction(n => JSON.parse(window.render_game_to_text()).screen === n, name, T);
const hideToasts = (page, hidden = true) => page.evaluate(h => { document.getElementById('toasts').style.visibility = h ? 'hidden' : ''; }, hidden);
const toastSeen = (page, text) => page.waitForFunction(t => [...document.querySelectorAll('#toasts .toast')].some(el => el.textContent.includes(t)), text, T);
const playing = page => page.waitForFunction(() => window.__puyo.match?.phase === 'play', null, T);
const clashIs = (page, fn, arg) => page.waitForFunction(fn, arg, T);
async function closeTalk(page) {
  await page.waitForSelector('#talk:not([hidden])');
  await page.click('#talk');
  if (await page.locator('#talk').isVisible()) await page.click('#talk');
}
async function signup(page, nick, pass = 'abcd1') {
  await page.click('#go-signup');
  await page.fill('#signup-name', nick); await page.fill('#signup-pass', pass);
  await page.click('#signup-form button[type=submit]');
  await screenIs(page, 'menu');
}
const chapter = page => page.evaluate(() => document.getElementById('ending-canvas').dataset.chapter);
async function endingMoves(page) {
  const snap = () => page.evaluate(() => document.getElementById('ending-canvas').toDataURL().length);
  const a = await snap(); await page.waitForTimeout(600);
  return a !== await snap();
}
const NEW_SKINS = [['강아지 뿌요', 'puppy'], ['돼지 뿌요', 'pig'], ['여우 뿌요', 'fox'], ['코알라 뿌요', 'koala'], ['무당벌레 뿌요', 'ladybug'], ['수박 뿌요', 'watermelon'],
  ['호랑이 뿌요', 'tiger'], ['구름 뿌요', 'cloud'], ['꼬마 악마 뿌요', 'devil'], ['천사 뿌요', 'angel'], ['용암 뿌요', 'lava'], ['블랙홀 뿌요', 'blackhole']];

try {
  // ---------- 4번: 혜성을 처음 깨면 마지막 장면의 글만 나오던 버그 ----------
  const late = await open('그리기 시각이 앞선 기기', PC, { late: true });
  await late.click('#go-guest'); await screenIs(late, 'menu');
  await late.evaluate(() => { const t = window.__puyo.P().tower; t.best = 6; t.cleared = true; window.__puyo.show('tower'); });
  await late.locator('.floor.secret button').first().click(); await closeTalk(late);
  await playing(late);
  // 타워의 층은 그 층만의 배경 그대로 (하늘은 뿌요 정원 대전에만), 힘겨루기 막대는 있다
  let s = await read(late);
  assert.equal(s.theme, 'space'); assert.equal(s.sky, null);
  assert.deepEqual(s.clash.names, ['나', '상대']);
  await late.evaluate(() => { const ai = window.__puyo.match.players[1]; for (let y = 0; y < 12; y++) ai.cells[y * 6 + 2] = 6; ai.refreshHeights(); });
  await closeTalk(late);
  await late.waitForSelector('#ending:not([hidden])');
  await late.waitForTimeout(900);
  assert.equal((await read(late)).ending, 'comet');
  assert.equal(await chapter(late), '1', '처음 깬 혜성 엔딩은 1장부터 (전에는 장면 번호가 -1 이 되어 0)');
  assert.equal(await endingMoves(late), true, '엔딩이 멈추지 않고 움직인다');
  await late.screenshot({ path: `${shots}/comet-ending-first.png` });
  await late.waitForFunction(() => document.getElementById('ending-canvas').dataset.chapter === '2', null, T); // 10초 뒤 2장으로 넘어간다
  await late.click('#ending-skip'); await late.waitForSelector('#result:not([hidden])');
  assert.match(await late.textContent('#result-title'), /혜성 층 정복/);
  await late.getByRole('button', { name: '타워로', exact: true }).click();
  // 다시 보기도 1장부터
  await late.click('#tower-comet-ending');
  await late.waitForTimeout(900);
  assert.equal(await chapter(late), '1');
  assert.equal(await endingMoves(late), true);
  await late.click('#ending-skip'); await screenIs(late, 'tower');
  // 왕관 엔딩도 그대로 나온다
  await late.click('#tower-ending'); await late.waitForTimeout(900);
  assert.equal((await read(late)).ending, 'crown');
  assert.equal(await endingMoves(late), true);
  await late.click('#ending-skip'); await screenIs(late, 'tower');
  await late.context().close();

  // ---------- 1번: 대전 화면에서 밤이면 밤하늘, 아침이면 아침 하늘 ----------
  const g = await open('손님');
  await g.click('#go-guest'); await screenIs(g, 'menu');
  // 이 기기의 지금 시각에 맞는 하늘
  const now = skyAtHour(await g.evaluate(() => new Date().getHours()));
  await g.evaluate(() => window.__puyo.startVs(1, 1, 'garden'));
  await toastSeen(g, skyText(now));
  s = await read(g);
  assert.equal(s.sky, now.id); assert.equal(s.theme, now.id);
  // 대전하는 동안 시계를 따라간다: 배경이 다른 것으로 바뀌어 있어도 곧 지금 하늘로 돌아온다
  await g.evaluate(() => window.__puyo.renderer.setTheme('default'));
  await g.waitForFunction(id => JSON.parse(window.render_game_to_text()).theme === id, now.id, T);
  await hideToasts(g);
  for (const sky of SKIES) {
    assert.equal(await g.evaluate(id => window.__puyo.setSky(id), sky.id), sky.id);
    await playing(g);
    assert.equal((await read(g)).theme, sky.id);
    await settle(g); await g.screenshot({ path: `${shots}/sky-${sky.id}.png` });
  }
  // 다른 맵은 그 맵의 배경, 2인 플레이의 뿌요 정원은 하늘, 혼자 하기는 예전 그대로
  await g.evaluate(() => window.__puyo.startVs(1, 1, 'ice'));
  s = await read(g); assert.equal(s.sky, null); assert.equal(s.theme, 'ice');
  await g.evaluate(() => window.__puyo.startLocal(1, 'garden'));
  s = await read(g); assert.equal(s.sky, 'night'); assert.equal(s.theme, 'night');
  assert.deepEqual(s.clash.names, ['손님', '2P']);
  await g.evaluate(() => window.__puyo.startLocal(1, 'space'));
  s = await read(g); assert.equal(s.sky, null); assert.equal(s.theme, 'space');
  await g.evaluate(() => window.__puyo.startSolo('garden'));
  s = await read(g); assert.equal(s.sky, null); assert.equal(s.theme, 'meadow'); assert.equal(s.clash, null);

  // ---------- 2번: 방해 뿌요가 왔다 갔다 하면 위에서 누구 뿌요가 센지 겨루기 ----------
  async function clashCheck(page, name) {
    await page.evaluate(() => { window.__puyo.setSky('noon'); window.__puyo.startVs(1, 1, 'garden'); });
    await playing(page);
    await hideToasts(page);
    // 상대가 스스로 공격하지 않게 손을 멈추고, 확인하는 동안 뿌요가 바닥에 닿지 않게 아주 천천히 떨어뜨린다
    await page.evaluate(() => { const m = window.__puyo.match; m.ai[1] = null; m.gravityScale = 0.02; });
    let c = (await read(page)).clash;
    assert.deepEqual([c.names, c.power, c.pos, c.fighting], [['나', '상대'], [0, 0], 0.5, false]);
    // 그림처럼 맨 위: 위쪽 단추 줄 아래, 두 필드의 예고 칸보다 위
    const layout = await page.evaluate(() => { const l = window.__puyo.renderer.layout; return { tray: l.tray.map(t => t.y), fields: l.fields.map(f => f.y), w: window.innerWidth }; });
    assert.ok(c.box.y >= 40 && c.box.x >= 0 && c.box.x + c.box.w <= layout.w, `${name} 막대 자리 ${JSON.stringify(c.box)}`);
    for (const y of layout.tray) assert.ok(c.box.y + c.box.h <= y + 0.5, `${name} 예고 칸 위`);
    await settle(page); await page.screenshot({ path: `${shots}/clash-rest-${name}.png` });
    // 내가 12개를 보낸다 → 아직 혼자 미는 중
    await page.evaluate(() => window.__puyo.match.players[0].events.push({ type: 'send', amount: 12 }));
    await clashIs(page, () => { const k = JSON.parse(window.render_game_to_text()).clash; return k.power[0] === 12 && !k.fighting; });
    assert.equal((await read(page)).match.players[1].incoming, 12);
    await clashIs(page, max => JSON.parse(window.render_game_to_text()).clash.pos === max, CLASH_MAX);
    // 상대가 12개를 상쇄하고 20개를 더 보낸다 → 왔다 갔다, 상대가 더 세서 금이 내 쪽으로 밀려온다
    await page.evaluate(() => { const p = window.__puyo.match.players[1]; p.incoming = 0; p.events.push({ type: 'offset', amount: 12 }, { type: 'send', amount: 20 }); });
    await clashIs(page, () => { const k = JSON.parse(window.render_game_to_text()).clash; return k.fighting && k.power[0] === 12 && k.power[1] === 32 && k.pos < 0.3; });
    assert.equal((await read(page)).match.players[0].incoming, 20);
    await page.screenshot({ path: `${shots}/clash-fight-${name}.png` });
    // 내가 더 큰 연쇄로 받아친다 → 금이 상대 쪽으로
    await page.evaluate(() => { const p = window.__puyo.match.players[0]; p.incoming = 0; p.events.push({ type: 'offset', amount: 20 }, { type: 'send', amount: 40 }); });
    await clashIs(page, () => { const k = JSON.parse(window.render_game_to_text()).clash; return k.power[0] === 72 && k.pos > 0.68; });
    await page.screenshot({ path: `${shots}/clash-push-${name}.png` });
    // 방해 뿌요가 다 떨어지면 누가 더 셌는지 알려 주고 가운데로 돌아온다
    await page.evaluate(() => { for (const p of window.__puyo.match.players) p.incoming = 0; });
    await page.waitForFunction(() => window.__puyo.renderer.effects.texts.some(t => t.text === '나 승!'), null, T);
    await clashIs(page, () => { const k = JSON.parse(window.render_game_to_text()).clash; return k.power[0] === 0 && k.power[1] === 0 && !k.fighting && k.pos === 0.5; });
    // 다음 판이 시작되면 처음부터
    await page.evaluate(() => { window.__puyo.renderer.clash.add(1, 5); window.__puyo.renderer.resetRound(); });
    c = (await read(page)).clash;
    assert.deepEqual([c.power, c.pos], [[0, 0], 0.5]);
  }
  await clashCheck(g, 'pc');
  const phone = await open('휴대폰', PHONE);
  await phone.click('#go-guest'); await screenIs(phone, 'menu');
  await clashCheck(phone, 'phone');
  await phone.context().close();

  // ---------- 스킨도 더 넣어줘: 새 스킨 12가지 ----------
  await g.evaluate(() => window.__puyo.show('menu')); await screenIs(g, 'menu');
  await hideToasts(g);
  await g.click('[data-go="shop"]'); await screenIs(g, 'shop');
  assert.equal(await g.locator('#shop-grid .item').count(), 57);
  const names = await g.evaluate(() => [...document.querySelectorAll('#shop-grid .item > b')].map(b => b.textContent));
  for (const [name] of NEW_SKINS) assert.ok(names.includes(name), name);
  await g.evaluate(() => { const p = window.__puyo.P(); p.level = 20; p.coins = 50000; window.__puyo.show('shop'); });
  const card = name => g.locator('#shop-grid .item', { hasText: name });
  await card('강아지 뿌요').scrollIntoViewIfNeeded();
  await g.waitForTimeout(700); await g.screenshot({ path: `${shots}/shop-new-skins.png` });
  for (const [name, id] of [['여우 뿌요', 'fox'], ['천사 뿌요', 'angel']]) {
    await card(name).locator('button').first().click();
    await g.waitForFunction(skin => window.__puyo.P().owned.skin.includes(skin), id, T);
    assert.equal(await g.evaluate(() => window.__puyo.P().equip.skin), id);
  }
  // 레벨 스킨은 85 · 95레벨이 되어야 산다
  assert.match(await card('용암 뿌요').textContent(), /85/);
  assert.match(await card('블랙홀 뿌요').textContent(), /95/);
  assert.equal(await g.evaluate(() => window.__puyo.P().owned.skin.includes('lava')), false);
  // 열두 가지를 모두 끼고 한 판씩 (그리기 오류가 없어야 한다)
  for (const [, id] of NEW_SKINS) {
    await g.evaluate(skin => { window.__puyo.P().equip.skin = skin; window.__puyo.startSolo('garden'); }, id);
    await playing(g); await g.waitForTimeout(350);
  }
  await g.screenshot({ path: `${shots}/skin-blackhole-play.png` });
  await g.context().close();

  // ---------- 3번: 처음 온라인 대전에서 캐릭터 고르기 ----------
  const tag = Math.random().toString(36).slice(2, 6);
  const a = await open('가', PC), b = await open('나', PHONE);
  await signup(a, `가${tag}`); await signup(b, `나${tag}`);
  for (const p of [a, b]) { await hideToasts(p); await p.evaluate(() => { window.__puyo.setSky('evening'); window.__puyo.show('online'); }); await screenIs(p, 'online'); }
  await a.click('#online-find');
  await a.waitForSelector('#online-searching:not([hidden])');
  await b.click('#online-find');
  for (const p of [a, b]) await p.waitForSelector('#online-lobby:not([hidden])', { timeout: 30000 });
  const grid = '#online-char-grid .char-card';
  for (const p of [a, b]) {
    await p.waitForFunction(sel => document.querySelectorAll(sel).length === 9, grid, T);
    // 처음에는 둘 다 주인공. 비밀의 층 주인 둘은 잠겨 있다
    assert.equal(await p.getAttribute(`${grid}.selected`, 'data-char'), 'hero');
    assert.deepEqual(await p.evaluate(sel => [...document.querySelectorAll(sel)].filter(c => c.disabled).map(c => `${c.dataset.char}:${c.querySelector('b').textContent}:${c.querySelector('small')?.textContent}`), grid),
      ['comet:???:타워를 깨면 열려', 'nova:???:혜성을 깨면 열려']);
    assert.equal(await p.locator('#lobby-me-char').isVisible(), true);
    await p.waitForFunction(sel => document.querySelector(`${sel}[data-char="hero"] .vote-tag.you`), grid, T);
    assert.equal(await p.locator('#lobby-you-char').isVisible(), true);
  }
  // 가: 달토끼 루나 → 나의 화면에 「상대」 표가 옮겨 간다
  await a.click(`${grid}[data-char="luna"]`);
  assert.equal(await a.getAttribute(`${grid}.selected`, 'data-char'), 'luna');
  await b.waitForFunction(sel => document.querySelector(`${sel}[data-char="luna"] .vote-tag.you`), grid, T);
  assert.equal(await b.locator(`${grid}[data-char="hero"] .vote-tag.you`).count(), 0);
  // 나: 타워를 깬 사람이라 코멧이 열린다 → 코멧
  await b.evaluate(() => { window.__puyo.P().tower.cleared = true; window.__puyo.show('online'); });
  await b.waitForFunction(sel => !document.querySelector(`${sel}[data-char="comet"]`).disabled, grid, T);
  assert.equal(await b.locator(`${grid}[data-char="nova"]`).isDisabled(), true);
  await b.click(`${grid}[data-char="comet"]`);
  await a.waitForFunction(sel => document.querySelector(`${sel}[data-char="comet"] .vote-tag.you`), grid, T);
  assert.equal(await a.textContent('#online-char-text'), '내 캐릭터: 달토끼 루나 · 상대 캐릭터: 혜성 드래곤 코멧');
  assert.equal(await b.textContent('#online-char-text'), '내 캐릭터: 혜성 드래곤 코멧 · 상대 캐릭터: 달토끼 루나');
  // 가의 화면에서 코멧은 아직 잠겨 있어서 이름이 ??? 이지만 「상대」 표는 붙는다
  assert.equal(await a.locator(`${grid}[data-char="comet"]`).isDisabled(), true);
  assert.equal(await a.evaluate(() => window.__puyo.P().settings.onlineChar), 'luna');
  await a.locator('#online-chars').scrollIntoViewIfNeeded(); await b.locator('#online-chars').scrollIntoViewIfNeeded();
  await settle(a); await a.screenshot({ path: `${shots}/lobby-chars-pc.png` });
  await settle(b); await b.screenshot({ path: `${shots}/lobby-chars-phone.png` });
  // 시작: 고른 캐릭터가 대전 화면에 나온다 (왼쪽이 나)
  const aHost = (await read(a)).online.host;
  const [host, guest] = aHost ? [a, b] : [b, a];
  await host.waitForFunction(() => !document.getElementById('online-start').disabled, null, T);
  await host.click('#online-first [data-v="1"]');
  await guest.waitForFunction(() => document.getElementById('online-wait').textContent.includes('1판'), null, T);
  await host.click('#online-start');
  for (const p of [a, b]) await p.waitForFunction(() => window.__puyo.game?.mode === 'online' && window.__puyo.match?.phase === 'play', null, T);
  let sa = await read(a), sb = await read(b);
  assert.deepEqual(sa.chars, ['luna', 'comet']); assert.deepEqual(sb.chars, ['comet', 'luna']);
  // 온라인 대전도 뿌요 정원이면 하늘, 맨 위에는 힘겨루기 막대
  assert.equal(sa.sky, 'evening'); assert.equal(sa.theme, 'evening'); assert.equal(sb.theme, 'evening');
  assert.deepEqual(sa.clash.names, ['나', '상대']); assert.deepEqual(sb.clash.names, ['나', '상대']);
  // 온라인에서도 방해 뿌요가 왔다 갔다: 가가 9개를 보내고, 나가 상쇄한 뒤 14개를 돌려보낸다
  await a.evaluate(() => window.__puyo.match.players[0].events.push({ type: 'send', amount: 9 }));
  await b.waitForFunction(() => { const t = JSON.parse(window.render_game_to_text()); return t.clash.power[1] === 9 && t.match.players[0].incoming === 9; }, null, T);
  await b.evaluate(() => { const p = window.__puyo.match.players[0]; p.incoming = 0; p.events.push({ type: 'offset', amount: 9 }, { type: 'send', amount: 14 }); });
  await a.waitForFunction(() => { const k = JSON.parse(window.render_game_to_text()).clash; return k.fighting && k.power[0] === 9 && k.power[1] === 23; }, null, T);
  sb = await read(b);
  assert.deepEqual(sb.clash.power, [23, 9]); assert.equal(sb.clash.fighting, true);
  await a.screenshot({ path: `${shots}/online-chars-clash-pc.png` });
  await b.screenshot({ path: `${shots}/online-chars-clash-phone.png` });

  assert.deepEqual(errors, []);
  console.log('PASS: 혜성 엔딩 1장부터(그리기 시각이 앞서도) → 대전 화면 하늘 아침·낮·저녁·밤 → 힘겨루기 막대(PC, 휴대폰) → 새 스킨 12가지 → 온라인 캐릭터 고르기와 대전 화면 — 오류 없음');
  console.log(`Screenshots: ${shots}`);
} finally {
  await browser.close();
  stopServer();
}
