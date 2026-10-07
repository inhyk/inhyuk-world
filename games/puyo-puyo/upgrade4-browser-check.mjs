// 인혁이 기획서 「뿌요뿌요 (업그레이드)」 7가지를 실제 Chrome 과 로컬 net 서버로 끝까지 확인한다.
// 1. 펫: 그림대로 왼쪽 위 "뒤로", 가운데 "알", "펫 뽑기 1000원", 펫 다섯 칸(적힌 글 그대로) → 뽑기 → 경험치 배수
// 2. 시간 선물 7개와 펫 뽑기권   3. 2배 부스트 (사기, 쓰기, 결과 화면의 배수)
// 4. AI 대전·혼자 하기에서 2인 플레이의 맵 고르기, 온라인 대전의 맵 투표(같은 맵 / 다르면 뽑기)
// 5. 뿌요뿌요 배우기: 초급 → 중급 → 상급 → 최상급 → 초초상급 → 마지막 순서로 열리고, 문제를 실제로 풀기
//    (마지막: 다섯 등급 복습 → 빈 필드에서 직접 쌓기 → 진짜 연쇄를 잘하는 비결 4가지)
//    (찐 마지막 30가지: 총복습 10 → 직접 쌓기 3·4·5연쇄 → 대연쇄 7~10연쇄 → 졸업 시험(두 번 되돌리면 도움말) → 찐 비결 7가지)
// 6. 친구가 생기면 경험치·코인 배수   7. 친구에게 코인·스킨·터짐 효과 선물 (접속 중, 꺼 둔 동안, 한 번만 받기)
// 그리고 같은 날 인혁이가 말한 것: 제작자 모드 「전설의 뿌요 바로 쓰기」, 온라인 계정의 「계정 지우기」 단추
//
// 사용법:
//   npm run puyo-puyo:dev   (게임, http://127.0.0.1:5190)
//   PUYO_URL=http://127.0.0.1:5190/ node games/puyo-puyo/upgrade4-browser-check.mjs
// net 서버: PUYO_NET 이 없으면 services/net 에서 빈 로컬 D1 로 wrangler dev 를 새로 띄우고(포트 8797) 끝나면 끈다.
// 화면 사진: PUYO_SHOTS (기본 /tmp/puyo-upgrade4)
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.env.PUYO_URL || 'http://127.0.0.1:5190/';
const shots = process.env.PUYO_SHOTS || '/tmp/puyo-upgrade4';
await mkdir(shots, { recursive: true });
const netDir = fileURLToPath(new URL('../../services/net/', import.meta.url));

// ---------- 로컬 net 서버 ----------
let server = null, NET = process.env.PUYO_NET;
if (!NET) {
  const state = await mkdtemp(join(tmpdir(), 'puyo-net-'));
  execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'net', '--local', '--persist-to', state], { cwd: netDir, stdio: 'ignore', env: { ...process.env, CI: '1' } });
  const port = 8797;
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
function watchErrors(page, name) {
  page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !expected.test(m.text())) errors.push(`${name}: ${m.text()}`); });
  page.on('dialog', d => d.accept());
}
async function load(page) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__puyo, null, { timeout: 60000 });
}
async function open(name, viewport = { width: 1100, height: 900 }) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
  const page = await context.newPage();
  watchErrors(page, name);
  await load(page);
  return page;
}
const settle = page => page.waitForTimeout(400);
const read = page => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const screenIs = (page, name) => page.waitForFunction(n => JSON.parse(window.render_game_to_text()).screen === n, name, T);
const go = async (page, name) => { await page.evaluate(n => window.__puyo.show(n), name); await screenIs(page, name); };
const hideToasts = page => page.evaluate(() => { document.getElementById('toasts').style.visibility = 'hidden'; });
const box = async (page, selector) => { const b = await page.locator(selector).first().boundingBox(); assert.ok(b, `${selector} 가 화면에 있어야 한다`); return { ...b, cx: b.x + b.width / 2, cy: b.y + b.height / 2, right: b.x + b.width, bottom: b.y + b.height }; };
async function signup(page, nick, pass) {
  await page.click('#go-signup');
  await page.fill('#signup-name', nick); await page.fill('#signup-pass', pass);
  await page.click('#signup-form button[type=submit]');
  await screenIs(page, 'menu');
  await hideToasts(page); // 사진을 가리지 않게
}
// 다음 뽑기에서 나올 펫을 정한다 (0~1). 뽑고 나면 freeRoll 로 되돌린다.
const nextRoll = (page, r) => page.evaluate(v => { window.__realRandom ||= Math.random; Math.random = () => v; }, r);
const freeRoll = page => page.evaluate(() => { if (window.__realRandom) Math.random = window.__realRandom; });
async function drawPet(page, roll) {
  await nextRoll(page, roll);
  await page.click('#pet-draw');
  await freeRoll(page);
  await page.waitForSelector('#pet-pop:not([hidden])', T);
  const title = await page.textContent('#pet-pop-title'), text = await page.textContent('#pet-pop-text');
  await page.click('#pet-pop-ok');
  return { title, text };
}
// 배우기: 지금 나온 짝을 (x, rot) 자리에 놓는다
async function place(page, x, rot) {
  await page.waitForFunction(() => { const p = window.__puyo.match?.players[0]; return window.__puyo.game?.mode === 'practice' && p?.state === 'control' && p.piece && !window.__puyo.practice?.freeze; }, null, T);
  await page.evaluate(([px, r]) => { const p = window.__puyo.match.players[0]; p.piece.x = px; p.piece.rot = r; }, [x, rot]);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__puyo.match?.players[0].state !== 'control' || window.__puyo.practice?.freeze, null, T);
}
const lessonIs = (page, grade, index) => page.waitForFunction(([g, i]) => { const p = window.__puyo.practice; return p?.grade === g && p.index === i && !p.freeze; }, [grade, index], T);
const coachTitle = (page, text) => page.waitForFunction(t => document.getElementById('coach-title').textContent.includes(t) && !document.getElementById('coach').hidden, text, T);
// AI 대전을 바로 이긴다 (AI 필드를 가득 채움)
async function winNow(page) {
  await page.waitForFunction(() => window.__puyo.match?.phase === 'play', null, T);
  await page.evaluate(() => { const ai = window.__puyo.match.players[1]; for (let y = 0; y < 12; y++) ai.cells[y * 6 + 2] = 6; ai.refreshHeights(); });
  await page.waitForSelector('#result:not([hidden])', { timeout: 30000 });
}
const tag = Math.random().toString(36).slice(2, 6);

try {
  // ====================== 손님 한 사람으로: 펫, 시간 선물, 부스트, 맵, 배우기 ======================
  const g = await open('손님');
  await g.click('#go-guest');
  await screenIs(g, 'menu');
  await hideToasts(g);
  for (const to of ['pets', 'boost', 'school', 'solo']) assert.equal(await g.locator(`#scr-menu [data-go="${to}"]`).count(), 1, `메뉴에 ${to} 단추`);
  assert.equal(await g.locator('#scr-menu [data-go="practice"]').count(), 0); // 연습하기는 배우기(초급)로 들어갔다
  assert.equal(await g.textContent('#scr-menu [data-go="school"] small'), '초급부터 졸업3까지 10단계');
  assert.equal(await g.locator('#practice-badge').isVisible(), true);
  assert.equal(await g.locator('#menu-bonus').isVisible(), false); // 아직 배수가 없다
  await settle(g); await g.screenshot({ path: `${shots}/menu.png` });

  // ---------- 1. 펫: 기획서 그림대로 ----------
  await g.click('#scr-menu [data-go="pets"]'); await screenIs(g, 'pets');
  assert.equal((await g.textContent('#scr-pets .pet-back')).trim(), '뒤로');
  assert.equal((await g.textContent('#egg-label')).trim(), '알');
  assert.equal((await g.textContent('#pet-draw')).trim(), '펫 뽑기 1000원');
  const cardTexts = await g.$$eval('#pet-cards .pet-card', cards => cards.map(c => [c.dataset.pet, c.querySelector('.l1').textContent, c.querySelector('.l2').textContent]));
  assert.deepEqual(cardTexts, [['dog', '강아지 1.5배', '70%'], ['cat', '고양이 50%', '3.0배'], ['keycap', '키캡 5.0배', '10%'], ['bigkeycap', '큰 키캡 10.0배', '1%'], ['mystery', '??? 100.0배', '0.1%']]);
  // 그림의 자리: "뒤로"는 왼쪽 위, "알"은 가운데 위, 그 아래 뽑기 단추, 그 아래 두 칸씩 두 줄, 맨 아래 넓은 ??? 칸
  const back = await box(g, '#scr-pets .pet-back'), egg = await box(g, '#pet-egg'), draw = await box(g, '#pet-draw'), board = await box(g, '.pet-board');
  const [dog, cat, key, big, mys] = await Promise.all(['dog', 'cat', 'keycap', 'bigkeycap', 'mystery'].map(id => box(g, `.pet-card[data-pet="${id}"]`)));
  assert.ok(back.cx < board.x + board.width * 0.25 && back.cy < egg.cy, '뒤로는 왼쪽 위');
  assert.ok(Math.abs(egg.cx - board.cx) < 6 && egg.y >= board.y, '알은 가운데 위');
  assert.ok(egg.bottom <= draw.y + 2 && Math.abs(draw.cx - board.cx) < 6, '알 아래 가운데에 펫 뽑기');
  assert.ok(draw.bottom <= dog.y && Math.abs(dog.y - cat.y) < 2 && dog.right <= cat.x, '강아지 왼쪽, 고양이 오른쪽 한 줄');
  assert.ok(dog.bottom <= key.y && Math.abs(key.y - big.y) < 2 && key.right <= big.x, '키캡 왼쪽, 큰 키캡 오른쪽 한 줄');
  assert.ok(key.bottom <= mys.y && mys.width > dog.width * 1.8, '맨 아래 넓은 ??? 칸');
  await settle(g); await g.screenshot({ path: `${shots}/pets.png` });
  // 코인이 모자라면 못 뽑는다 (손님은 코인 100)
  assert.match(await g.textContent('#pet-draw-note'), /코인이 900개 모자라/);
  await g.click('#pet-draw');
  assert.equal(await g.locator('#pet-pop').isHidden(), true);
  assert.equal((await read(g)).coins, 100);
  // 코인 1000으로 뽑기: 고양이
  await g.evaluate(() => { window.__puyo.P().coins = 3100; window.__puyo.show('pets'); });
  await nextRoll(g, 0.6);
  await g.click('#pet-draw');
  await freeRoll(g);
  await g.waitForFunction(() => document.getElementById('pet-draw').disabled && /두근두근/.test(document.getElementById('pet-draw-note').textContent));
  await g.waitForTimeout(800); await g.screenshot({ path: `${shots}/pets-egg.png` });
  await g.waitForSelector('#pet-pop:not([hidden])', T);
  assert.equal(await g.textContent('#pet-pop-title'), '🎉 새 펫! 고양이');
  assert.match(await g.textContent('#pet-pop-text'), /경험치 3\.0배\. 이제부터 함께 다녀!/);
  await settle(g); await g.screenshot({ path: `${shots}/pet-new.png` });
  await g.click('#pet-pop-ok');
  let s = await read(g);
  assert.equal(s.coins, 2100); assert.deepEqual(s.pets, { owned: { cat: 1 }, equip: 'cat', draws: 1 }); assert.deepEqual(s.bonus, { xp: 3, coins: 1 });
  assert.equal(await g.locator('.pet-card[data-pet="cat"].equipped').count(), 1);
  assert.match(await g.textContent('#pet-now'), /지금 고양이와 함께! 판에서 받는 경험치 3\.0배/);
  // 강아지가 나오면 더 좋은 고양이를 그대로 데리고 다닌다 → 직접 바꿀 수 있다
  const second = await drawPet(g, 0);
  assert.equal(second.title, '🎉 새 펫! 강아지'); assert.match(second.text, /지금 펫이 더 좋아서 그대로/);
  assert.equal((await read(g)).pets.equip, 'cat');
  await g.click('.pet-card[data-pet="dog"] [data-equip]');
  assert.equal((await read(g)).bonus.xp, 1.5);
  // ??? 는 뽑으면 진짜 이름이 보인다
  const third = await drawPet(g, 0.9999);
  assert.equal(third.title, '🎉 새 펫! 무지개 드래곤');
  assert.equal(await g.textContent('.pet-card[data-pet="mystery"] .l1'), '무지개 드래곤 100.0배');
  s = await read(g);
  assert.equal(s.coins, 100); assert.equal(s.pets.equip, 'mystery'); assert.equal(s.bonus.xp, 100);
  await settle(g); await g.screenshot({ path: `${shots}/pets-owned.png` });
  await g.click('.pet-card[data-pet="cat"] [data-equip]'); // 아래 확인은 고양이(3배)로
  await g.click('#scr-pets .pet-back'); await screenIs(g, 'menu');
  assert.equal(await g.textContent('#menu-bonus'), '✨ 지금 내 배수: 🐾 고양이 경험치 ×3');

  // ---------- 2. 시간 선물: 7개, 펫 뽑기권이 조금 ----------
  await go(g, 'rewards');
  assert.deepEqual(await g.$$eval('#time-rewards [data-time]', bs => bs.map(b => b.dataset.time)), ['5m', '10m', '15m', '20m', '30m', '45m', '60m']);
  assert.equal(await g.locator('[data-time="20m"]').isDisabled(), true);
  await g.evaluate(() => { window.__puyo.P().rewards.playSeconds = 1200; window.__puyo.show('rewards'); });
  assert.match(await g.locator('.time-gift', { hasText: '20분 선물' }).textContent(), /펫 뽑기권 1장/);
  assert.match(await g.locator('.time-gift', { hasText: '60분 선물' }).textContent(), /펫 뽑기권 1장/);
  await g.click('[data-time="20m"]'); await g.click('[data-time="10m"]');
  s = await read(g);
  assert.equal(s.tickets.pet, 1); assert.equal(s.tickets.boost, 1);
  assert.equal(await g.locator('[data-time="30m"]').isDisabled(), true);
  assert.match(await g.textContent('#reward-inventory'), /펫 뽑기권 1장/);
  await g.evaluate(() => document.querySelector('#scr-rewards .time-card').scrollIntoView()); await settle(g); await g.screenshot({ path: `${shots}/time-gifts.png` });
  // 받은 뽑기권으로는 코인 없이 뽑는다
  await go(g, 'menu');
  assert.equal(await g.textContent('#pet-badge'), '1');
  await go(g, 'pets');
  assert.equal((await g.textContent('#pet-draw')).trim(), '🥚 펫 뽑기권으로 뽑기 (1장)');
  const coinsBefore = (await read(g)).coins;
  await drawPet(g, 0);
  s = await read(g);
  assert.equal(s.coins, coinsBefore); assert.equal(s.tickets.pet, 0); assert.equal(s.pets.owned.dog, 2);

  // ---------- 3. 2배 부스트 ----------
  await g.evaluate(() => { window.__puyo.P().coins = 499; });
  await go(g, 'boost');
  assert.equal(await g.textContent('#boost-state'), '부스트가 꺼져 있어');
  assert.equal(await g.textContent('#boost-have'), '가진 부스트: 1개');
  assert.equal(await g.locator('#boost-buy').isDisabled(), true); // 코인이 500보다 적다
  await g.click('#boost-use');
  await g.waitForFunction(() => /2배 부스트 켜짐! 1[45]:\d\d 남음/.test(document.getElementById('boost-state').textContent), null, T);
  s = await read(g);
  assert.equal(s.tickets.boost, 0); assert.ok(s.boostLeft > 890 && s.boostLeft <= 900); assert.deepEqual(s.bonus, { xp: 6, coins: 2 });
  assert.equal(await g.textContent('#bonus-total'), '지금 판을 끝내면 경험치 ×6 · 코인 ×2');
  await g.evaluate(() => { window.__puyo.P().coins = 600; window.__puyo.show('boost'); });
  await g.click('#boost-buy');
  s = await read(g);
  assert.equal(s.coins, 100); assert.equal(s.tickets.boost, 1);
  await g.click('#boost-use'); // 켜진 채로 또 쓰면 15분이 더 붙는다
  assert.ok((await read(g)).boostLeft > 1780);
  await settle(g); await g.screenshot({ path: `${shots}/boost.png` });

  // ---------- 4. 맵: AI 대전에서 쫀득 연구소(6개 터짐), 결과 화면에 배수 ----------
  await go(g, 'vs');
  assert.equal(await g.locator('#vs-maps .map-card').count(), 6);
  assert.deepEqual(await g.$$eval('#vs-maps .map-card', a => a.map(b => b.dataset.map)), await g.evaluate(() => { window.__puyo.show('local'); return [...document.querySelectorAll('#local-maps .map-card')].map(b => b.dataset.map); })); // 2인 플레이와 같은 맵
  await go(g, 'vs');
  await g.click('#vs-maps [data-map="six"]');
  assert.match(await g.textContent('#vs-map-tip'), /6개 이상/);
  await settle(g); await g.screenshot({ path: `${shots}/vs-maps.png` });
  await g.click('#vs-first [data-v="1"]');
  await g.click('#vs-start');
  await g.waitForFunction(() => window.__puyo.game?.mode === 'vs', null, T);
  assert.match(await g.textContent('#hud-title'), /쫀득 연구소/);
  assert.deepEqual(await g.evaluate(() => ({ map: window.__puyo.game.map, groups: window.__puyo.match.players.map(p => p.minGroup), scale: window.__puyo.match.gravityScale })), { map: 'six', groups: [6, 6], scale: 0.75 });
  await winNow(g);
  assert.equal(await g.textContent('#result-bonus'), '✨ 배수 적용: 🐾 고양이 경험치 ×3 · ⚡ 부스트 ×2');
  const xp = Number((await g.textContent('#result-xp')).replace(/\D/g, '')), coins = Number((await g.textContent('#result-coins')).replace(/\D/g, ''));
  // AI 레벨 3 을 이기면 경험치 66, 코인 50 → 경험치 ×6, 코인 ×2 (공휴일이면 경험치가 한 번 더 2배, 레벨 업 코인이 더해짐)
  assert.ok(xp === 66 * 6 || xp === 66 * 12, `경험치 ${xp}`);
  assert.ok(coins >= 100, `코인 ${coins}`);
  await settle(g); await g.screenshot({ path: `${shots}/result-bonus.png` });
  await g.click('#result-buttons button.ghost'); await screenIs(g, 'menu');

  // 혼자 하기: 바로 시작하지 않고 맵을 고른다
  await g.click('#scr-menu [data-go="solo"]'); await screenIs(g, 'solo');
  assert.equal((await read(g)).mode, null);
  assert.equal(await g.locator('#solo-maps .map-card').count(), 6);
  await g.click('#solo-maps [data-map="rainbow"]');
  await g.click('#solo-start');
  await g.waitForFunction(() => window.__puyo.game?.mode === 'solo', null, T);
  assert.deepEqual(await g.evaluate(() => ({ map: window.__puyo.game.map, colors: window.__puyo.match.seq.palette.length })), { map: 'rainbow', colors: 5 });
  assert.match(await g.textContent('#hud-title'), /무지개 섬/);
  await g.evaluate(() => window.__puyo.handleBack()); await g.click('#pause-quit'); await screenIs(g, 'menu');

  // ---------- 5. 뿌요뿌요 배우기: 초급 → 중급 → 상급 → 최상급 ----------
  await g.click('#scr-menu [data-go="school"]'); await screenIs(g, 'school');
  assert.deepEqual(await g.$$eval('#school-list .grade', rows => rows.map(r => [r.querySelector('h3').textContent, r.classList.contains('open'), r.querySelector('button').disabled])),
    [['초급', true, false], ['중급', false, true], ['상급', false, true], ['최상급', false, true], ['초초상급', false, true], ['마지막', false, true], ['찐 마지막', false, true], ['졸업', false, true], ['졸업2', false, true], ['졸업3', false, true]]);
  await settle(g); await g.screenshot({ path: `${shots}/school.png` });
  // 초급(예전 연습하기)은 건너뛸 수 있다
  await g.click('#school-list .grade[data-grade="beginner"] button');
  await lessonIs(g, 0, 0);
  for (let i = 0; i < 3; i++) await g.click('#coach-buttons button');
  await coachTitle(g, '이제 진짜 대결!');
  assert.equal((await read(g)).tutorial, true);
  await g.click('#coach-buttons button.ghost'); await screenIs(g, 'menu');
  assert.equal(await g.locator('#practice-badge').isVisible(), false);
  await go(g, 'school');
  assert.deepEqual(await g.$$eval('#school-list .grade', rows => rows.map(r => r.className.replace('grade ', ''))), ['done', 'open', 'locked', 'locked', 'locked', 'locked', 'locked', 'locked', 'locked', 'locked']);
  // 중급 1: 뒤집어 놓으면 "다시 해 보자", 알려 준 대로 놓으면 3연쇄
  const ticketsBefore = (await read(g)).tickets;
  await g.click('#school-list .grade[data-grade="middle"] button');
  await lessonIs(g, 1, 0);
  assert.equal(await g.textContent('#coach-step'), '중급 1 / 3');
  assert.equal(await g.textContent('#coach-buttons button'), '↺ 처음 모양으로'); // 중급부터는 건너뛰지 못한다
  await settle(g); await g.screenshot({ path: `${shots}/lesson-middle.png` });
  await place(g, 0, 2);
  await coachTitle(g, '다시 해 보자!');
  await lessonIs(g, 1, 0);
  const answers = [
    [1, [[[0, 0]], [[3, 1]], [[3, 0]]]],
    [2, [[[0, 0]], [[1, 0], [0, 0]], [[3, 0]]]],
    [3, [[[0, 0]], [[1, 0], [0, 0]], [[1, 0], [0, 0]]]],
    [4, [[[1, 0]], [[1, 0], [0, 0]], [[0, 0]]]], // 초초상급: 끼워 넣기, 직접 쌓아서 5연쇄, 여섯 칸 6연쇄
    // 마지막: 복습 다섯(오른쪽으로 뒤집은 문제) + 빈 필드에서 여섯 번 놓아 직접 쌓기. 그 뒤의 비결 4가지는 아래에서 따로 본다
    [5, [[[5, 0]], [[5, 0]], [[4, 0], [5, 0]], [[5, 0]], [[4, 0]], [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [0, 0]]]],
  ];
  const nextTitle = ['', '다음은 상급!', '다음은 최상급!', '다음은 초초상급!', '다음은 마지막!', '다음은 찐 마지막!', '다음은 졸업!'];
  for (const [grade, lessons] of answers) {
    for (const [index, moves] of lessons.entries()) {
      await lessonIs(g, grade, index);
      if (grade === 4 && index === 0) { assert.equal(await g.textContent('#coach-step'), '초초상급 1 / 3'); await settle(g); await g.screenshot({ path: `${shots}/lesson-ultra.png` }); }
      if (grade === 5 && index === 0) { assert.equal(await g.textContent('#coach-step'), '마지막 1 / 10'); assert.match(await g.textContent('#coach-title'), /복습 ① 초급/); }
      for (const [n, [x, rot]] of moves.entries()) {
        if (grade === 5 && index === 5) {
          // 직접 쌓기: 짝을 놓을 때마다 꼬마 뿌요의 안내가 ① → ⑥ 으로 바뀐다
          await g.waitForFunction(mark => document.getElementById('coach-text').textContent.includes(mark), '①②③④⑤⑥'[n], T);
          if (n === 4) { await settle(g); await g.screenshot({ path: `${shots}/lesson-scratch.png` }); }
        }
        await place(g, x, rot);
      }
      if (grade === 5 && index === 5) assert.equal(await g.evaluate(() => window.__puyo.match.players[0].lastChain), 3); // 빈 필드에서 직접 만든 3연쇄
      await coachTitle(g, grade === 5 || index < 2 ? '잘했어!' : nextTitle[grade]);
    }
    if (grade === 3) await g.screenshot({ path: `${shots}/lesson-master-done.png` });
    if (grade < 5) await g.click('#coach-buttons button.primary'); // 다음 등급 배우기
  }
  // 마지막의 끝: 진짜 연쇄를 잘하는 비결 4가지. 풀 것 없이 읽고 단추로 넘어가고, 그동안 뿌요는 나오지 않는다
  for (const [k, title] of ['비결 ① 3개까지만 모으고 참기', '비결 ② 계단으로 쌓기', '비결 ③ 가운데는 비워 두기', '비결 ④ 다음 뿌요를 보고, 위험하면 바로 터뜨리기'].entries()) {
    await g.waitForFunction(([i, t]) => window.__puyo.practice?.index === i && document.getElementById('coach-title').textContent === t, [6 + k, title], T);
    assert.equal(await g.textContent('#coach-step'), `마지막 ${7 + k} / 10`);
    assert.equal(await g.textContent('#coach-buttons button'), k < 3 ? '알겠어! ▶' : '다 배웠어! 🎉');
    assert.ok((await g.textContent('#coach-text')).length > 30);
    await g.waitForTimeout(500);
    assert.deepEqual(await g.evaluate(() => { const p = window.__puyo.match.players[0]; return [window.__puyo.practice.freeze, p.piece, p.cells.some(v => v > 0)]; }), [true, null, true]);
    if (k === 1 || k === 3) { await settle(g); await g.screenshot({ path: `${shots}/lesson-tip${k + 1}.png` }); }
    await g.click('#coach-buttons button');
  }
  await coachTitle(g, nextTitle[5]);
  assert.match(await g.textContent('#coach-text'), /마지막을 모두 배웠어\. 이어서 찐 마지막에 도전해 볼까/);
  await settle(g); await g.screenshot({ path: `${shots}/lesson-final-done.png` });
  await g.click('#coach-buttons button.primary'); // 💎 찐 마지막 배우기

  // ---------- 찐 마지막 (엄청 길게: 30가지) ----------
  const s3 = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [0, 0]];
  const s4 = [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [2, 1], [1, 1], [0, 0]];
  const s5 = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [2, 1], [1, 1], [3, 1], [0, 0]];
  const realPlan = [
    'tip', [[2, 0]], [[0, 0]], [[2, 3]], [[3, 0]], [[5, 0]], [[2, 0]], [[4, 0], [5, 0]], [[4, 0], [5, 0]], [[5, 0]], [[1, 0]], // 1부 총복습 10
    'tip', [[5, 0], [4, 0], [3, 0], [5, 3], [3, 1], [5, 0]], s4, s5, // 2부 직접 쌓기 3·4·5연쇄
    'tip', [[3, 0]], [[4, 0]], [[4, 0]], [[3, 0]], // 3부 대연쇄 7·8·9·10연쇄
    'tip', s3, s4, // 4부 졸업 시험
    'tip', 'tip', 'tip', 'tip', 'tip', 'tip', 'tip', // 5부 찐 비결 7가지
  ];
  assert.equal(realPlan.length, 30);
  const LONG = { timeout: 90000 };
  for (const [index, plan] of realPlan.entries()) {
    if (plan === 'tip') {
      await g.waitForFunction(i => { const p = window.__puyo.practice; return p?.grade === 6 && p.index === i && p.freeze && !document.getElementById('coach').hidden; }, index, T);
      assert.equal(await g.textContent('#coach-step'), `찐 마지막 ${index + 1} / 30`);
      assert.equal(await g.textContent('#coach-buttons button'), index < 29 ? '알겠어! ▶' : '다 배웠어! 🎉');
      if (index === 0) { assert.equal(await g.textContent('#coach-title'), '1부 · 총복습 시작!'); await settle(g); await g.screenshot({ path: `${shots}/real-start.png` }); }
      if (index === 29) assert.equal(await g.textContent('#coach-title'), '찐 비결 ⑦ 매일 조금씩');
      await g.click('#coach-buttons button');
      continue;
    }
    await lessonIs(g, 6, index);
    const title = await g.textContent('#coach-title');
    if (index === 21) {
      // 졸업 시험 ①: 처음에는 안내가 없다. 두 번 되돌리면 꼬마 뿌요가 도움말을 준다
      assert.equal(title, '졸업 시험 ① 혼자서 3연쇄');
      assert.ok(!/①/.test(await g.textContent('#coach-text')));
      await g.click('#coach-buttons button'); await lessonIs(g, 6, index);
      assert.ok(!/①/.test(await g.textContent('#coach-text')));
      await g.click('#coach-buttons button'); await lessonIs(g, 6, index);
      assert.match(await g.textContent('#coach-text'), /^조금 어렵지\? 이번에는 같이 하자! ①/);
      await settle(g); await g.screenshot({ path: `${shots}/real-exam-help.png` });
    }
    if (index === 22) { assert.equal(title, '졸업 시험 ② 혼자서 4연쇄'); assert.ok(!/①/.test(await g.textContent('#coach-text'))); } // 도움 없이 혼자서
    if (index === 19) { assert.equal(title, '대연쇄 ④ 10연쇄'); await settle(g); await g.screenshot({ path: `${shots}/real-mega10.png` }); }
    for (const [n, [x, rot]] of plan.entries()) {
      if (index === 14) await g.waitForFunction(mark => document.getElementById('coach-text').textContent.includes(mark), '①②③④⑤⑥⑦⑧⑨⑩'[n], T); // 5연쇄 직접 쌓기: 안내가 ① → ⑩
      if (index === 14 && n === 9) { await settle(g); await g.screenshot({ path: `${shots}/real-scratch5.png` }); }
      await place(g, x, rot);
    }
    await g.waitForFunction(() => document.getElementById('coach-title').textContent.includes('잘했어!'), null, LONG);
    // 대연쇄는 정말 그만큼 이어지고 전소로 끝난다
    const chain = { 16: 7, 17: 8, 18: 9, 19: 10, 14: 5, 13: 4 }[index];
    if (chain) assert.equal(await g.evaluate(() => window.__puyo.match.players[0].lastChain), chain, title);
    if (index >= 16 && index <= 19) assert.equal(await g.evaluate(() => window.__puyo.match.players[0].cells.some(v => v > 0)), false, `${title}: 전소`);
  }
  await coachTitle(g, nextTitle[6]);
  assert.match(await g.textContent('#coach-text'), /찐 마지막을 모두 배웠어\. 이어서 졸업에 도전해 볼까/); // 졸업, 졸업2, 졸업3 은 graduation-browser-check.mjs 가 끝까지 푼다
  await settle(g); await g.screenshot({ path: `${shots}/real-done.png` });
  s = await read(g);
  assert.deepEqual(s.school, ['middle', 'high', 'master', 'ultra', 'final', 'real']);
  // 등급 선물: 중급 부스트 1, 상급 펫 뽑기권 1, 최상급 펫 뽑기권 1 + 부스트 1, 초초상급 펫 뽑기권 2 + 부스트 1, 마지막 펫 뽑기권 3 + 부스트 2 + 스킨·효과 교환권
  // 찐 마지막: 펫 뽑기권 5 + 부스트 3 + 스킨·효과 교환권 2장씩
  assert.equal(s.tickets.pet, ticketsBefore.pet + 12); assert.equal(s.tickets.boost, ticketsBefore.boost + 8);
  assert.equal(s.tickets.skin, ticketsBefore.skin + 3); assert.equal(s.tickets.effect, ticketsBefore.effect + 3);
  await g.click('#coach-buttons button.ghost'); await screenIs(g, 'school'); // 배우기 목록으로
  assert.deepEqual(await g.$$eval('#school-list .grade', rows => rows.map(r => r.className.replace('grade ', ''))), ['done', 'done', 'done', 'done', 'done', 'done', 'done', 'open', 'locked', 'locked']);
  // 다시 배워도 선물은 한 번만
  await g.click('#school-list .grade[data-grade="middle"] button');
  for (const [index, moves] of answers[0][1].entries()) { await lessonIs(g, 1, index); for (const [x, rot] of moves) await place(g, x, rot); }
  await coachTitle(g, '다음은 상급!');
  assert.equal((await read(g)).tickets.boost, s.tickets.boost);
  await g.evaluate(() => window.__puyo.handleBack()); await g.click('#pause-quit'); await screenIs(g, 'school');

  // 휴대폰 크기: 펫 화면이 그림 모양 그대로 한 화면에 들어온다
  const phone = await open('휴대폰', { width: 390, height: 844 });
  await phone.click('#go-guest'); await screenIs(phone, 'menu'); await hideToasts(phone);
  await go(phone, 'pets');
  const pb = await box(phone, '.pet-board'), pd = await box(phone, '.pet-card[data-pet="dog"]'), pc = await box(phone, '.pet-card[data-pet="cat"]'), pm = await box(phone, '.pet-card[data-pet="mystery"]');
  assert.ok(pb.x >= 0 && pb.right <= 390 && Math.abs(pd.y - pc.y) < 2 && pm.width > pd.width * 1.8);
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '가로로 넘치지 않는다');
  await settle(phone); await phone.screenshot({ path: `${shots}/pets-phone.png` });
  await go(phone, 'school'); await settle(phone); await phone.screenshot({ path: `${shots}/school-phone.png` });
  await phone.context().close();

  // ====================== 온라인 계정 두 사람: 친구 배수, 선물, 맵 투표 ======================
  const a = await open('A'), b = await open('B', { width: 1100, height: 900 });
  const nickA = `가${tag}`, nickB = `나${tag}`;
  await signup(a, nickA, 'abcd1'); await signup(b, nickB, 'abcd2');
  assert.equal((await read(a)).friends, 0); assert.deepEqual((await read(a)).bonus, { xp: 1, coins: 1 });

  // ---------- 6. 친구가 생기면 배수 ----------
  await go(b, 'friends');
  await b.fill('#friend-q', nickA); await b.click('#friend-search button[type=submit]');
  await b.locator('#friend-results .friend button').click();
  await go(a, 'friends');
  await a.locator('#req-in .friend button.primary').click({ timeout: 15000 });
  for (const p of [a, b]) await p.waitForFunction(() => JSON.parse(window.render_game_to_text()).friends === 1, null, T);
  assert.deepEqual((await read(a)).bonus, { xp: 1.1, coins: 1.1 });
  await go(a, 'menu');
  assert.equal(await a.textContent('#menu-bonus'), '✨ 지금 내 배수: 👫 친구 1명 ×1.1');
  await go(a, 'boost');
  assert.match(await a.textContent('#bonus-rows'), /친구×1\.11명/);
  // 친구 배수는 코인에도 곱해진다: AI 레벨 1 승리 = 코인 30, 경험치 42 → ×1.1
  await a.evaluate(() => window.__puyo.startVs(1, 1));
  await winNow(a);
  assert.equal(await a.textContent('#result-bonus'), '✨ 배수 적용: 👫 친구 1명 ×1.1');
  const aXp = Number((await a.textContent('#result-xp')).replace(/\D/g, ''));
  assert.ok(aXp === 46 || aXp === 92, `경험치 ${aXp}`); // 42 × 1.1 = 46.2 (공휴일이면 2배)
  assert.equal((await read(a)).coins, 100 + 33); // 30 × 1.1
  await a.click('#result-buttons button.ghost'); await screenIs(a, 'menu');

  // ---------- 7. 친구에게 선물: 코인 ----------
  await go(a, 'friends');
  const rowB = a.locator('#net-friend-list .friend', { hasText: nickB });
  await rowB.locator('button', { hasText: '선물' }).click({ timeout: 15000 });
  await a.waitForSelector('#gift-pop:not([hidden])');
  assert.equal(await a.textContent('#gift-title'), `🎁 ${nickB}에게 선물하기`);
  assert.deepEqual(await a.$$eval('#gift-list .gift-item', bs => bs.map(x => [x.dataset.gift, x.disabled])), [['coins-100', false], ['coins-500', true], ['coins-1000', true], ['coins-5000', true]]);
  await settle(a); await a.screenshot({ path: `${shots}/gift-coins.png` });
  await a.click('[data-gift="coins-100"]');
  await a.waitForSelector('#ask:not([hidden])');
  assert.match(await a.textContent('#ask-text'), new RegExp(`${nickB}에게 코인 100개을\\(를\\) 선물할까`));
  await a.click('#ask-ok');
  await a.waitForFunction(() => window.__puyo.P().coins === 33, null, T);
  await b.waitForFunction(() => window.__puyo.P().coins === 200, null, T); // B 는 접속 중이라 바로 받는다
  assert.match(await a.textContent('#gift-note'), /코인 100개을\(를\) 보냈어/);
  // 스킨: 내 코인으로 사서 준다 (내 것은 그대로). 이미 가진 스킨이면 친구는 코인으로 받는다
  await a.evaluate(() => { window.__puyo.P().coins = 2000; window.__puyo.save(); });
  await a.click('#gift-tabs [data-v="skin"]');
  assert.equal(await a.locator('[data-gift="skin-knight"]').count(), 0); // 고난이도 레벨 스킨은 선물할 수 없다
  assert.equal(await a.locator('[data-gift="skin-crown"]').count(), 0);
  await settle(a); await a.screenshot({ path: `${shots}/gift-skins.png` });
  await a.click('[data-gift="skin-cat"]'); await a.click('#ask-ok');
  await a.waitForFunction(() => window.__puyo.P().coins === 1350, null, T);
  await b.waitForFunction(() => window.__puyo.P().owned.skin.includes('cat'), null, T);
  assert.equal(await a.evaluate(() => window.__puyo.P().owned.skin.includes('cat')), false);
  assert.equal((await read(b)).coins, 200);
  await a.click('[data-gift="skin-cat"]'); await a.click('#ask-ok');
  await b.waitForFunction(() => window.__puyo.P().coins === 850, null, T); // 고양이 뿌요 값 650을 코인으로
  await a.waitForFunction(() => window.__puyo.P().coins === 700, null, T);
  // 그만두면 코인이 빠지지 않는다
  await a.click('#gift-tabs [data-v="effect"]');
  await a.click('[data-gift="effect-heart"]'); await a.click('#ask-cancel');
  assert.equal((await read(a)).coins, 700);

  // 꺼 둔 친구에게 선물 → 다음에 켜면 받는다 (한 번만)
  await b.waitForFunction(() => JSON.parse(window.render_game_to_text()).net?.cloud === 'synced', null, T);
  const bContext = b.context();
  await b.close();
  await a.click('[data-gift="effect-heart"]'); await a.click('#ask-ok');
  await a.waitForFunction(() => window.__puyo.P().coins === 450, null, T);
  await a.click('#gift-close');
  const b2 = await bContext.newPage();
  watchErrors(b2, 'B(다시 켬)');
  await load(b2);
  await screenIs(b2, 'menu');
  await b2.waitForFunction(() => window.__puyo.P().owned.effect.includes('heart'), null, T);
  assert.equal((await read(b2)).coins, 850);
  await hideToasts(b2);
  // 1:1 대화에는 선물이 선물 줄로 보인다
  await go(b2, 'friends');
  await b2.locator('#net-friend-list .friend', { hasText: nickA }).locator('button', { hasText: '대화' }).click({ timeout: 15000 });
  await screenIs(b2, 'dm');
  await b2.waitForFunction(() => document.querySelectorAll('#dm-list .line.gift').length === 4, null, T);
  assert.deepEqual(await b2.$$eval('#dm-list .line.gift span', xs => xs.map(x => x.textContent)),
    ['🎁 코인 100개 선물을 받았어!', '🎁 스킨 「고양이 뿌요」 선물을 받았어!', '🎁 스킨 「고양이 뿌요」 선물을 받았어!', '🎁 터짐 효과 「하트」 선물을 받았어!']);
  await settle(b2); await b2.screenshot({ path: `${shots}/gift-dm.png` });
  assert.equal((await read(b2)).coins, 850); // 대화를 다시 읽어도 또 받지 않는다
  // 선물 글을 직접 써서 보내는 것은 막는다
  await b2.fill('#dm-input', '[[gift:c:5000]]'); await b2.click('#dm-form button[type=submit]');
  await b2.waitForTimeout(700);
  assert.equal(await b2.locator('#dm-list .line').count(), 4);
  assert.equal((await read(a)).coins, 450);
  // 1:1 대화 화면의 선물하기: B 가 A 에게 되갚는다
  await b2.click('#dm-gift');
  await b2.waitForSelector('#gift-pop:not([hidden])');
  await b2.click('[data-gift="coins-500"]'); await b2.click('#ask-ok');
  await a.waitForFunction(() => window.__puyo.P().coins === 950, null, T);
  await b2.waitForFunction(() => window.__puyo.P().coins === 350 && document.querySelectorAll('#dm-list .line.gift').length === 5, null, T);
  assert.equal(await b2.locator('#dm-list .line.gift.me span').textContent(), '🎁 코인 500개 선물을 보냈어!');
  await b2.click('#gift-close');
  // 새로고침해도 받은 선물을 또 받지 않는다
  await b2.waitForFunction(() => JSON.parse(window.render_game_to_text()).net?.cloud === 'synced', null, T);
  await load(b2); await screenIs(b2, 'menu'); await hideToasts(b2);
  await b2.waitForFunction(() => window.__puyo.social?.status === 'online', null, T);
  await b2.waitForTimeout(1500);
  assert.equal((await read(b2)).coins, 350);
  assert.deepEqual(await b2.evaluate(() => [window.__puyo.P().owned.skin.includes('cat'), window.__puyo.P().owned.effect.includes('heart')]), [true, true]);

  // ---------- 4. 온라인 대전 맵 투표 ----------
  await go(a, 'friends');
  await a.waitForFunction(n => [...document.querySelectorAll('#net-friend-list .friend')].some(r => r.querySelector('b').textContent === n && r.querySelector('.dot.on')), nickB, T);
  await a.locator('#net-friend-list .friend', { hasText: nickB }).locator('button.primary').click();
  await b2.waitForSelector('#invite-pop:not([hidden])', { timeout: 15000 });
  await b2.click('#invite-yes');
  for (const p of [a, b2]) await p.waitForSelector('#online-lobby:not([hidden])', T);
  for (const p of [a, b2]) await p.waitForFunction(() => document.querySelectorAll('#online-maps .map-card').length === 6 && window.__puyo.online.state().peerVote !== null, null, T);
  // 처음에는 둘 다 뿌요 정원
  assert.match(await a.textContent('#online-vote-text'), /둘 다 🌳 뿌요 정원/);
  // 서로 다른 맵에 표를 던진다
  await a.click('#online-maps [data-map="ice"]');
  await b2.click('#online-maps [data-map="six"]');
  await a.waitForFunction(() => window.__puyo.online.state().peerVote === 5, null, T);
  await b2.waitForFunction(() => window.__puyo.online.state().peerVote === 1, null, T);
  assert.equal(await a.textContent('#online-vote-text'), '내 표: 🧊 느긋한 빙하 · 상대 표: 🧪 쫀득 연구소 → 표가 같아서 시작할 때 둘 중 하나를 뽑아!');
  assert.equal(await a.textContent('#online-maps [data-map="ice"] .vote-tag.me'), '나');
  assert.equal(await a.textContent('#online-maps [data-map="six"] .vote-tag.you'), '상대');
  assert.equal(await b2.textContent('#online-maps [data-map="six"] .vote-tag.me'), '나');
  await settle(a); await a.screenshot({ path: `${shots}/vote-split.png` });
  const aHost = (await read(a)).online.host;
  const [host, guest] = aHost ? [a, b2] : [b2, a];
  await host.click('#online-first [data-v="1"]');
  await host.click('#online-start');
  for (const p of [a, b2]) await p.waitForFunction(() => window.__puyo.game?.mode === 'online' && window.__puyo.match?.phase === 'play', null, T);
  const maps = await Promise.all([a, b2].map(p => p.evaluate(() => ({ map: window.__puyo.game.map, group: window.__puyo.match.players[0].minGroup, scale: window.__puyo.match.gravityScale, colors: window.__puyo.match.seq.palette.length, seed: window.__puyo.match.seed }))));
  assert.deepEqual(maps[0], maps[1]); // 두 사람이 같은 맵, 같은 규칙, 같은 뿌요 순서
  assert.ok(['ice', 'six'].includes(maps[0].map), maps[0].map); // 둘이 고른 맵 중 하나
  assert.equal(maps[0].group, maps[0].map === 'six' ? 6 : 4);
  assert.match(await a.textContent('#hud-title'), maps[0].map === 'six' ? /쫀득 연구소/ : /느긋한 빙하/);
  await settle(a); await a.screenshot({ path: `${shots}/vote-game.png` });
  // 판을 끝내고(방장 필드를 가득 채움) 결과에서 로비로
  await host.evaluate(() => { const p = window.__puyo.match.players[0]; for (let y = 0; y < 12; y++) p.cells[y * 6 + 2] = 6; p.refreshHeights(); });
  for (const p of [a, b2]) await p.waitForSelector('#result:not([hidden])', { timeout: 30000 });
  // 이긴 손님은 친구 배수가 곱해진 보상을 받는다
  assert.equal(await guest.textContent('#result-bonus'), '✨ 배수 적용: 👫 친구 1명 ×1.1');
  // 둘이 같은 맵을 고르면 뽑기 없이 그 맵
  for (const p of [a, b2]) { await p.click('#result-buttons button.ghost'); await screenIs(p, 'online'); }
  await a.locator('#go-friends').click(); await screenIs(a, 'friends');
  await a.waitForFunction(n => [...document.querySelectorAll('#net-friend-list .friend')].some(r => r.querySelector('b').textContent === n && r.querySelector('.dot.on') && !r.querySelector('button.primary').disabled), nickB, T);
  await a.locator('#net-friend-list .friend', { hasText: nickB }).locator('button.primary').click();
  await b2.waitForSelector('#invite-pop:not([hidden])', { timeout: 15000 });
  await b2.click('#invite-yes');
  for (const p of [a, b2]) await p.waitForSelector('#online-lobby:not([hidden])', T);
  // 지난번에 고른 맵이 내 표로 남아 있다
  await a.waitForFunction(() => window.__puyo.online.state().vote === 1 && window.__puyo.online.state().peerVote === 5, null, T);
  await a.click('#online-maps [data-map="rainbow"]'); await b2.click('#online-maps [data-map="rainbow"]');
  for (const p of [a, b2]) await p.waitForFunction(() => /둘 다 🌈 무지개 섬/.test(document.getElementById('online-vote-text').textContent), null, T);
  await settle(b2); await b2.screenshot({ path: `${shots}/vote-same.png` });
  const host2 = (await read(a)).online.host ? a : b2;
  await host2.click('#online-start');
  for (const p of [a, b2]) await p.waitForFunction(() => window.__puyo.game?.mode === 'online' && window.__puyo.match?.phase === 'play', null, T);
  for (const p of [a, b2]) assert.deepEqual(await p.evaluate(() => ({ map: window.__puyo.game.map, colors: window.__puyo.match.seq.palette.length })), { map: 'rainbow', colors: 5 });
  await a.evaluate(() => window.__puyo.handleBack()); // 온라인 대전 그만하기 (확인 창은 자동으로 수락)
  await screenIs(a, 'online');

  // ====================== 인혁이가 덧붙인 것 ======================
  // ---------- 제작자 모드: 전설의 뿌요 바로 쓰기 ----------
  await go(b2, 'creator');
  assert.equal(await b2.locator('[data-creator="legend"]').isVisible(), false); // 비밀번호 전에는 안 보인다
  await b2.fill('#creator-password', '7777777'); await b2.click('#creator-form button[type=submit]');
  await b2.click('[data-creator="legend"]');
  assert.match(await b2.textContent('#creator-result'), /전설의 뿌요 스킨을 받아서 바로 꼈어/);
  assert.deepEqual(await b2.evaluate(() => { const p = window.__puyo.P(); return [p.equip.skin, p.owned.skin.includes('legend'), p.level < 99]; }), ['legend', true, true]);
  await go(b2, 'shop');
  assert.equal((await b2.locator('#shop-grid .item.equipped b').first().textContent()).trim(), '전설의 뿌요');
  await settle(b2); await b2.screenshot({ path: `${shots}/creator-legend.png` });

  // ---------- 온라인 계정의 계정 지우기 ----------
  const forgive = (from, pattern) => { for (let i = errors.length - 1; i >= from; i--) if (pattern.test(errors[i])) errors.splice(i, 1); };
  await go(a, 'profile');
  assert.equal(await a.locator('#delete-account').isVisible(), true); // 온라인 계정에도 단추가 있다
  await a.click('#delete-account');
  assert.equal(await a.locator('#delete-pass').isVisible(), true);
  assert.match(await a.textContent('#delete-question'), new RegExp(`${nickA} 계정을 지울까\\? .*친구, 대화가 서버에서 모두 사라지고 되돌릴 수 없어`));
  await settle(a); await a.screenshot({ path: `${shots}/delete-account.png` });
  await a.click('#delete-yes');
  assert.equal(await a.textContent('#delete-msg'), '비밀번호를 적어 줘.');
  // 틀린 비밀번호: 계정은 그대로
  let mark = errors.length;
  await a.fill('#delete-pass', 'wrong1'); await a.click('#delete-yes');
  await a.waitForFunction(() => /비밀번호가 달라/.test(document.getElementById('delete-msg').textContent), null, T);
  forgive(mark, /status of 403/);
  assert.deepEqual([(await read(a)).screen, (await read(a)).account], ['profile', nickA]);
  // 서버가 아직 이 기능을 모를 때(배포 전의 서버)는 안내만 하고 계정은 그대로
  // (진짜 배포 전 서버는 브라우저가 미리 물어보는 요청에서 막혀서, 게임에는 "연결하지 못함"으로 보인다. 그래도 인터넷 탓이라고 하지 않는다)
  mark = errors.length;
  await a.route('**/auth/delete', route => route.abort());
  await a.fill('#delete-pass', 'abcd1'); await a.click('#delete-yes');
  await a.waitForFunction(() => /아직 지울 수 없어\. 게임 서버를 새로 배포해야 계정 지우기가 돼/.test(document.getElementById('delete-msg').textContent), null, T);
  assert.ok(!/인터넷을 확인/.test(await a.textContent('#delete-msg')));
  // 인터넷이 정말 안 될 때만 인터넷을 확인하라고 한다
  await a.route('**/me', route => route.abort());
  await a.fill('#delete-pass', 'abcd1'); await a.click('#delete-yes');
  await a.waitForFunction(() => /서버에 연결하지 못했어\. 인터넷을 확인해 줘/.test(document.getElementById('delete-msg').textContent), null, T);
  await a.unroute('**/me');
  await a.unroute('**/auth/delete');
  forgive(mark, /Failed to load resource|ERR_FAILED/);
  assert.equal((await read(a)).account, nickA);
  await a.click('#delete-cancel');
  assert.equal(await a.locator('#delete-confirm').isHidden(), true);
  // 맞는 비밀번호: 서버에서 지워지고 로그인 화면으로
  await a.waitForFunction(() => window.__puyo.social?.status === 'online', null, T);
  await a.click('#delete-account'); await a.fill('#delete-pass', 'abcd1'); await a.click('#delete-yes');
  await screenIs(a, 'login');
  assert.equal(await a.evaluate(() => window.__puyo.net.loggedIn), false);
  // 같은 닉네임과 비밀번호로 다시 들어갈 수 없고, 새로고침해도 로그인되어 있지 않다
  mark = errors.length;
  await a.click('#go-net-login'); await a.fill('#net-login-name', nickA); await a.fill('#net-login-pass', 'abcd1');
  await a.click('#net-login-form button[type=submit]');
  await a.waitForFunction(() => /닉네임이나 비밀번호가 달라/.test(document.getElementById('login-msg').textContent), null, T);
  forgive(mark, /status of 401/);
  await load(a);
  assert.equal((await read(a)).screen, 'login');
  // 친구였던 B 의 목록에서도 사라지고, 친구 배수도 내려간다
  await go(b2, 'friends');
  await b2.waitForFunction(() => JSON.parse(window.render_game_to_text()).friends === 0 && !document.querySelector('#net-friend-list .friend'), null, T);
  assert.deepEqual((await read(b2)).bonus, { xp: 1, coins: 1 });

  assert.deepEqual(errors, []);
  console.log(`PASS: 펫(그림대로 뒤로·알·펫 뽑기 1000원·다섯 칸, 뽑기, ???, 뽑기권) → 시간 선물 7개 → 2배 부스트(사기·쓰기·이어 쓰기) → AI 대전 쫀득 연구소와 결과 배수 → 혼자 하기 맵 → 배우기 초급~찐 마지막(초초상급, 마지막의 복습과 비결, 찐 마지막 30가지: 총복습·직접 쌓기 5연쇄·대연쇄 10연쇄·졸업 시험·찐 비결) → 친구 배수 ×1.1 → 선물(코인·스킨·터짐 효과, 접속 중·꺼 둔 동안, 한 번만, 직접 쓴 글은 막음) → 온라인 맵 투표(다르면 뽑기, 같으면 그 맵) → 제작자 모드 전설의 뿌요 바로 쓰기 → 온라인 계정 지우기(틀린 비밀번호, 배포 전 서버는 인터넷 탓이 아니라고 안내, 지운 뒤 로그인 안 됨, 친구 목록에서 사라짐) — 오류 없음 (net ${NET}, 사진 ${shots})`);
} finally {
  await browser.close();
  stopServer();
}
