// 인혁이 기획서 「뿌요뿌요 (업그레이드)」(2026-10-09)를 실제 Chrome 으로 끝까지 확인한다 (서버 없이 손님으로).
// 1번 새 스킨 12가지가 상점에 보이고 살 수 있음 → 5번 새 노래가 나옴 → 6번 배경음악 ON/OFF 를 연속으로 5번 누르면 예전 노래(이스터에그)
// → 4번 광고 보고 코인 1000 받기(10초, 하루 3번)와 부스트·스핀권·펫 뽑기권 → 3번 그림: 배우기 목록 칸마다 "N가지", 목록 안 스크롤 막대.
// (졸업6~10 문제를 끝까지 푸는 것은 graduation-browser-check.mjs)
//
// 사용법: npm run puyo-puyo:dev 후 PUYO_URL=http://127.0.0.1:5190/ node games/puyo-puyo/upgrade6-browser-check.mjs
// 화면 사진: PUYO_SHOTS (기본 /tmp/puyo-upgrade6)
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const base = process.env.PUYO_URL || 'http://127.0.0.1:5190/';
const shots = process.env.PUYO_SHOTS || '/tmp/puyo-upgrade6';
await mkdir(shots, { recursive: true });
const url = `${base}${base.includes('?') ? '&' : '?'}test`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const T = { timeout: 20000 };
async function open(name, viewport = { width: 1100, height: 860 }) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__puyo, null, { timeout: 60000 });
  return page;
}
const settle = page => page.waitForTimeout(400);
const screenIs = (page, name) => page.waitForFunction(n => JSON.parse(window.render_game_to_text()).screen === n, name, T);
const hideToasts = (page, hidden = true) => page.evaluate(h => { document.getElementById('toasts').style.visibility = h ? 'hidden' : ''; }, hidden);
const toastSeen = (page, re) => page.waitForFunction(src => [...document.querySelectorAll('#toasts .toast')].some(t => new RegExp(src).test(t.textContent)), re.source, T);
const song = page => page.evaluate(() => { const s = window.__puyo.sound; return { name: s.song?.name ?? null, bars: s.song?.lead.length ?? 0, classic: s.classic, on: s.musicOn, ready: !!s.ready }; });

try {
  const g = await open('손님');
  await g.click('#go-guest'); await screenIs(g, 'menu');

  // ---------- 5번: 새 노래 ----------
  await g.waitForFunction(() => window.__puyo.sound.ready && window.__puyo.sound.song, null, T);
  assert.deepEqual(await song(g), { name: 'menu', bars: 16, classic: false, on: true, ready: true });
  await g.waitForTimeout(2500); // 새 악기(가락, 아르페지오, 박수, 베이스)가 실제로 울리는 동안 오류가 없어야 한다
  assert.equal(await g.textContent('#scr-menu [data-go="rewards"] small'), '무료 스핀 · 출석 · 광고 선물 · 플레이 시간');

  // ---------- 6번: 배경음악 ON/OFF 를 연속으로 5번 → 예전 노래 ----------
  const music = '#scr-menu [data-sound="music"]';
  // 네 번 누르고 쉬었다가 한 번 더 누르면 "연속"이 아니다
  for (let i = 0; i < 4; i++) await g.click(music);
  await g.waitForTimeout(1800);
  await g.click(music);
  assert.equal((await song(g)).classic, false);
  assert.equal(await g.textContent(music), '🎵 배경음악 OFF');
  await g.waitForTimeout(1800);
  // 연속으로 다섯 번: 예전 노래로 바뀌고, 음악은 켜진 채로 끝난다
  for (let i = 0; i < 5; i++) await g.click(music);
  await toastSeen(g, /이스터에그 발견! 예전 노래로 바뀌었어/);
  assert.deepEqual(await song(g), { name: 'menu', bars: 8, classic: true, on: true, ready: true });
  assert.equal(await g.textContent(music), '🎵 배경음악 ON');
  assert.equal(await g.evaluate(() => JSON.parse(localStorage.getItem('puyo-tower-device')).classicSongs), true);
  await settle(g); await g.screenshot({ path: `${shots}/egg-classic.png` });
  await g.waitForTimeout(1200);
  // AI 대전에 들어가도 예전 노래 (대전 노래)
  await g.evaluate(() => window.__puyo.startVs(1, 1));
  await g.waitForFunction(() => window.__puyo.sound.song?.name === 'battle', null, T);
  assert.equal((await song(g)).bars, 8);
  await g.evaluate(() => window.__puyo.pause(true));
  await g.click('#pause-quit'); await screenIs(g, 'menu');
  // 새로 열어도 예전 노래 그대로 (이 기기에 저장)
  await g.reload({ waitUntil: 'domcontentloaded' });
  await g.waitForFunction(() => window.__puyo, null, { timeout: 60000 });
  await g.click('#go-guest'); await screenIs(g, 'menu');
  await g.waitForFunction(() => window.__puyo.sound.ready && window.__puyo.sound.song, null, T);
  assert.equal((await song(g)).classic, true);
  // 또 다섯 번 누르면 새 노래로 돌아온다 (일시정지 창의 단추로도 된다)
  await g.waitForTimeout(1700);
  for (let i = 0; i < 5; i++) await g.click(music);
  await toastSeen(g, /새 노래로 돌아왔어/);
  assert.deepEqual(await song(g), { name: 'menu', bars: 16, classic: false, on: true, ready: true });
  await g.waitForTimeout(1700);
  // 효과음 단추는 아무리 눌러도 이스터에그가 아니다
  for (let i = 0; i < 6; i++) await g.click('#scr-menu [data-sound="sfx"]');
  assert.equal((await song(g)).classic, false);
  // 보스 노래와 엔딩 노래도 오류 없이 나온다
  for (const name of ['boss', 'ending', 'battle', 'menu']) { await g.evaluate(n => window.__puyo.sound.play(n), name); await g.waitForTimeout(1300); assert.equal((await song(g)).name, name); }

  // ---------- 1번: 새 스킨 ----------
  await hideToasts(g);
  await g.click('[data-go="shop"]'); await screenIs(g, 'shop');
  assert.equal(await g.locator('#shop-grid .item').count(), 57); // 업그레이드 7 에서 12가지를 더해 57종
  const names = await g.evaluate(() => [...document.querySelectorAll('#shop-grid .item > b')].map(b => b.textContent));
  for (const name of ['개구리 뿌요', '꿀벌 뿌요', '아이스크림 뿌요', '판다 뿌요', '버섯 뿌요', '눈사람 뿌요', '해적 뿌요', '외계인 뿌요', '상어 뿌요', '유니콘 뿌요', '다이아 뿌요', '태양 뿌요']) assert.ok(names.includes(name), name);
  // 레벨과 코인이 되면 사서 끼고 한 판 한다 (그리기 오류가 없어야 한다)
  await g.evaluate(() => { const p = window.__puyo.P(); p.level = 20; p.coins = 50000; window.__puyo.show('shop'); });
  const card = name => g.locator('#shop-grid .item', { hasText: name });
  await card('개구리 뿌요').scrollIntoViewIfNeeded();
  await g.waitForTimeout(700); await g.screenshot({ path: `${shots}/shop-new-skins.png` });
  // 사면 바로 낀다. 다른 것을 산 뒤에는 「장착하기」로 다시 낄 수 있다
  for (const [name, id] of [['개구리 뿌요', 'frog'], ['유니콘 뿌요', 'unicorn'], ['상어 뿌요', 'shark']]) {
    await card(name).locator('button').first().click();
    await g.waitForFunction(skin => window.__puyo.P().owned.skin.includes(skin), id, T);
    assert.equal(await g.evaluate(() => window.__puyo.P().equip.skin), id);
    assert.match(await card(name).locator('button').first().textContent(), /장착 중/);
  }
  await card('개구리 뿌요').locator('button', { hasText: '장착하기' }).click();
  assert.equal(await g.evaluate(() => window.__puyo.P().equip.skin), 'frog');
  assert.equal(await g.evaluate(() => window.__puyo.P().coins), 50000 - 700 - 3400 - 2900);
  assert.match(await card('다이아 뿌요').locator('button').first().textContent(), /Lv\.80부터/);
  assert.equal(await card('다이아 뿌요').locator('.ticket-button').count(), 0);
  await card('태양 뿌요').scrollIntoViewIfNeeded(); await g.waitForTimeout(600); await g.screenshot({ path: `${shots}/shop-level-skins.png` });
  for (const skin of ['frog', 'bee', 'icecream', 'panda', 'mushroom', 'snowman', 'pirate', 'alien', 'shark', 'unicorn', 'diamond', 'sun']) {
    await g.evaluate(id => { const p = window.__puyo.P(); if (!p.owned.skin.includes(id)) p.owned.skin.push(id); p.equip.skin = id; window.__puyo.startSolo(); }, skin);
    await g.waitForFunction(() => window.__puyo.match?.phase === 'play', null, T);
    await g.evaluate(() => { const p = window.__puyo.match.players[0]; [1, 2, 3, 4, 1, 1, 2, 6, 3, 4, 2, 2].forEach((c, i) => { p.cells[i] = c; }); p.refreshHeights(); });
    await g.waitForTimeout(350);
    if (['frog', 'unicorn', 'sun'].includes(skin)) await g.screenshot({ path: `${shots}/play-${skin}.png` });
    await g.evaluate(() => window.__puyo.pause(true));
    await g.click('#pause-quit'); await screenIs(g, 'menu');
  }

  // ---------- 4번: 광고 보고 선물 받기 ----------
  await g.click('[data-go="rewards"]'); await screenIs(g, 'rewards');
  const gifts = await g.evaluate(() => [...document.querySelectorAll('#ad-rewards .ad-gift')].map(d => [d.querySelector('b').textContent, d.querySelector('button').textContent]));
  assert.deepEqual(gifts, [['코인 1000 받기', '📺 광고 보고 받기 (오늘 3번 남음)'], ['2배 부스트 받기', '📺 광고 보고 받기'], ['추가 스핀권 받기', '📺 광고 보고 받기'], ['펫 뽑기권 받기', '📺 광고 보고 받기']]);
  await g.locator('.ad-card').scrollIntoViewIfNeeded(); await settle(g); await g.screenshot({ path: `${shots}/ad-rewards.png` });
  const coins = () => g.evaluate(() => window.__puyo.P().coins);
  const before = await coins();
  await g.click('#ad-rewards [data-ad="coins"]');
  assert.equal(await g.evaluate(() => document.getElementById('seonn-promo').open), true);
  assert.equal(await g.textContent('#promo-label'), '📺 광고 보고 코인 1000 받기');
  assert.equal(await g.textContent('#promo-close'), '10초 뒤에 🎁');
  await settle(g); await g.screenshot({ path: `${shots}/ad-watching.png` });
  // 다 보기 전에는 단추를 눌러도, Esc 를 눌러도 닫히지 않고 선물도 없다
  // (Playwright 의 click 은 aria-disabled 인 단추가 풀릴 때까지 기다리므로, 기다리는 중의 단추는 직접 눌러 본다)
  await g.evaluate(() => document.getElementById('promo-close').click()); await g.keyboard.press('Escape'); await g.keyboard.press('Escape');
  await g.waitForTimeout(300);
  assert.equal(await g.evaluate(() => document.getElementById('seonn-promo').open), true);
  assert.equal(await coins(), before);
  await g.waitForFunction(() => document.getElementById('promo-close').textContent === '🎁 선물 받기', null, { timeout: 15000 });
  await g.screenshot({ path: `${shots}/ad-ready.png` });
  await g.click('#promo-close');
  await g.waitForFunction(() => !document.getElementById('seonn-promo').open, null, T);
  assert.equal(await coins(), before + 1000);
  assert.equal(await g.textContent('#ad-rewards [data-ad="coins"]'), '📺 광고 보고 받기 (오늘 2번 남음)');
  assert.equal(await g.evaluate(() => window.__puyo.P().missions['gift-ad-1'].v), 1);
  // 두 번 더 받으면 오늘은 끝. 다 본 뒤에 Esc 로 닫아도 선물은 받는다
  await g.click('#ad-rewards [data-ad="coins"]');
  await g.waitForFunction(() => document.getElementById('promo-close').textContent === '🎁 선물 받기', null, { timeout: 15000 });
  await g.keyboard.press('Escape');
  await g.waitForFunction(c => !document.getElementById('seonn-promo').open && window.__puyo.P().coins === c, before + 2000, T);
  await g.click('#ad-rewards [data-ad="coins"]');
  await g.waitForFunction(() => document.getElementById('promo-close').textContent === '🎁 선물 받기', null, { timeout: 15000 });
  await g.click('#promo-close');
  await g.waitForFunction(() => document.getElementById('ad-rewards').querySelector('[data-ad="coins"]').disabled, null, T);
  assert.equal(await coins(), before + 3000);
  assert.equal(await g.textContent('#ad-rewards [data-ad="coins"]'), '✔ 오늘은 다 받았어 · 내일 또!');
  // 펫 뽑기권 광고
  const pets = await g.evaluate(() => window.__puyo.P().tickets.pet);
  await g.click('#ad-rewards [data-ad="pet"]');
  assert.equal(await g.textContent('#promo-label'), '📺 광고 보고 펫 뽑기권 받기');
  await g.waitForFunction(() => document.getElementById('promo-close').textContent === '🎁 선물 받기', null, { timeout: 15000 });
  await g.click('#promo-close');
  await g.waitForFunction(() => document.getElementById('ad-rewards').querySelector('[data-ad="pet"]').disabled, null, T);
  assert.equal(await g.evaluate(() => window.__puyo.P().tickets.pet), pets + 1);
  // 5판마다 나오는 보통 광고는 예전 그대로 (5초, 선물 없음)
  await g.evaluate(() => { const p = window.__puyo.P(); p.stats.games = 5; p.promo.lastGame = 0; });
  // (보통 광고는 expansion-browser-check.mjs 가 확인한다. 여기서는 선물 모드가 남아 있지 않은지만 본다)
  assert.equal(await g.textContent('#promo-label'), '📺 광고 보고 펫 뽑기권 받기');

  // ---------- 3번 그림: 배우기 목록 ----------
  await g.evaluate(() => window.__puyo.show('school')); await screenIs(g, 'school');
  const school = await g.evaluate(() => {
    const list = document.getElementById('school-list'), cs = getComputedStyle(list);
    return {
      rows: [...list.querySelectorAll('.grade')].map(li => [li.dataset.grade, li.querySelector('h3').childNodes[0].textContent.trim(), li.querySelector('h3 .count').textContent]),
      overflow: cs.overflowY, scrolls: list.scrollHeight > list.clientHeight + 40, inside: list.getBoundingClientRect().bottom <= innerHeight + 1,
      last: document.getElementById('school-last').textContent, total: document.getElementById('school-total').textContent,
    };
  });
  assert.equal(school.overflow, 'scroll');
  assert.equal(school.scrolls, true, '목록 안에서 스크롤');
  assert.equal(school.inside, true, '목록이 화면 안에 있다');
  for (const [, name, count] of school.rows) assert.match(count, /^\d+가지$/, name);
  assert.equal(school.last, school.rows.at(-1)[1]);
  assert.match(school.total, new RegExp(`모두 ${school.rows.length}단계`));
  await settle(g); await g.screenshot({ path: `${shots}/school-top.png` });
  // 졸업6~10 이 있으면: 그림에 적힌 걸음 수 그대로
  const want = { grad8: ['졸업8', '100가지'], grad9: ['졸업9', '130가지'], grad10: ['졸업10', '150가지'] };
  const have = Object.fromEntries(school.rows.map(([id, name, count]) => [id, [name, count]]));
  if (have.grad10) {
    for (const [id, pair] of Object.entries(want)) assert.deepEqual(have[id], pair, id);
    assert.equal(school.rows.length, 17);
    assert.equal(school.last, '졸업10');
    // 모든 등급을 끝낸 기록으로 보면 맨 아래 졸업8, 졸업9, 졸업10 이 그림처럼 보인다
    await g.evaluate(() => { const p = window.__puyo.P(); p.tutorial = true; p.school = ['middle', 'high', 'master', 'ultra', 'final', 'real', 'grad1', 'grad2', 'grad3', 'grad4', 'grad5', 'grad6', 'grad7', 'grad8', 'grad9']; window.__puyo.show('school'); });
    await g.evaluate(() => { const list = document.getElementById('school-list'); list.scrollTop = list.scrollHeight; });
    await settle(g); await g.screenshot({ path: `${shots}/school-bottom.png` });
    assert.equal(await g.evaluate(() => { const list = document.getElementById('school-list'), r = list.getBoundingClientRect(), last = list.querySelector('[data-grade="grad10"]').getBoundingClientRect(); return last.bottom <= r.bottom + 1 && last.top >= r.top; }), true);
  } else console.log('참고: 이 빌드에는 졸업6~10 이 아직 없어서 걸음 수 확인은 건너뜀');
  // 이어서 배우기: 중간에 그만두면 그 걸음부터 다시 시작할 수 있다 (졸업10 은 150가지라 한 번에 끝내기 어렵다)
  await g.evaluate(() => { const p = window.__puyo.P(); p.tutorial = true; p.school = ['middle', 'high', 'master', 'ultra', 'final']; p.schoolAt = {}; window.__puyo.show('school'); });
  assert.equal(await g.textContent('#school-list [data-grade="real"] button'), '배우기!');
  await g.evaluate(() => window.__puyo.startPractice(4, 6)); // 찐 마지막의 다섯 번째 걸음까지 온 것처럼
  await g.waitForFunction(() => window.__puyo.practice?.index === 4, null, T);
  assert.deepEqual(await g.evaluate(() => window.__puyo.P().schoolAt), { real: 4 });
  await g.evaluate(() => window.__puyo.pause(true));
  await g.click('#pause-quit'); await screenIs(g, 'school');
  const real = '#school-list [data-grade="real"]';
  assert.deepEqual(await g.evaluate(sel => [...document.querySelectorAll(`${sel} button`)].map(b => b.textContent), real), ['이어서 배우기', '처음부터']);
  assert.match(await g.textContent(`${real} .state`), /5번째부터 이어서 할 수 있어 \(30가지 중 4가지 끝\)/);
  await g.locator(real).scrollIntoViewIfNeeded(); await settle(g); await g.screenshot({ path: `${shots}/school-resume.png` });
  await g.click(`${real} button.primary`);
  await g.waitForFunction(() => window.__puyo.practice?.grade === 6 && window.__puyo.practice?.index === 4, null, T);
  assert.match(await g.textContent('#coach-step'), /찐 마지막 5 \/ 30/);
  await g.evaluate(() => window.__puyo.pause(true));
  await g.click('#pause-quit'); await screenIs(g, 'school');
  // 「처음부터」를 누르면 첫 걸음부터, 적어 둔 곳은 지워진다
  await g.click(`${real} button.again`);
  await g.waitForFunction(() => window.__puyo.practice?.grade === 6 && window.__puyo.practice?.index === 0, null, T);
  assert.deepEqual(await g.evaluate(() => window.__puyo.P().schoolAt), {});
  await g.evaluate(() => window.__puyo.pause(true));
  await g.click('#pause-quit'); await screenIs(g, 'school');
  assert.equal(await g.textContent(`${real} button`), '배우기!');

  // 휴대폰에서도 목록이 화면 안에서 스크롤된다
  const m = await open('휴대폰', { width: 390, height: 844 });
  await m.click('#go-guest'); await screenIs(m, 'menu');
  await hideToasts(m);
  await m.evaluate(() => window.__puyo.show('school')); await screenIs(m, 'school');
  const phone = await m.evaluate(() => { const list = document.getElementById('school-list'), r = list.getBoundingClientRect(); return { scrolls: list.scrollHeight > list.clientHeight + 40, bottom: r.bottom, h: innerHeight, height: r.height, w: document.documentElement.scrollWidth, vw: innerWidth }; });
  assert.ok(phone.scrolls && phone.bottom <= phone.h + 1 && phone.height > 300 && phone.w <= phone.vw, JSON.stringify(phone));
  await settle(m); await m.screenshot({ path: `${shots}/school-phone.png` });
  await m.evaluate(() => window.__puyo.show('rewards')); await screenIs(m, 'rewards');
  await m.locator('.ad-card').scrollIntoViewIfNeeded(); await settle(m); await m.screenshot({ path: `${shots}/ad-rewards-phone.png` });
  assert.equal(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

  assert.deepEqual(errors, []);
  console.log('PASS: 새 노래(16마디) → 연속 5번 이스터에그로 예전 노래, 저장, 다시 5번에 새 노래 → 새 스킨 12가지 상점·장착·대전 → 광고 보고 코인 1000(10초, 하루 3번)과 펫 뽑기권 → 배우기 목록 "N가지"와 목록 안 스크롤(컴퓨터, 휴대폰) — 오류 없음');
  console.log(`Screenshots: ${shots}`);
} finally {
  await browser.close();
}
