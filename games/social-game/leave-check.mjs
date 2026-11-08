// 휴가 내기 check (인혁 계획 4: "한 달에 휴가가 3개가 생기게 해줘. 그리고 퀘스트 위에 휴가내기 버튼을 만들고 휴가내기 버튼을
// 누르면 오늘 퀘스트가 다 없어지게 해줘."): press the button on a work day, the quests vanish, sleep, the next day is normal
// and the count dropped, use all 3, the button is off (and on weekends / while busy), the next month gives 3 again.
// node games/social-game/leave-check.mjs [url] [outDir]
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const pw = await import('../../tools/node_modules/playwright/index.mjs').catch(() => import(process.env.PLAYWRIGHT_MJS ?? 'playwright'));
const url = process.argv[2] ?? 'http://127.0.0.1:5173/';
const out = process.argv[3] ?? '/tmp/social-leave';
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
await Promise.all([page.waitForEvent('load'), page.click('#m-office')]);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
await page.waitForTimeout(1200);

const G = (fn, arg) => page.evaluate(fn, arg);
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
const btn = () => G(() => { const b = document.getElementById('leave-btn'); return { label: b.querySelector('.lb-top').textContent, disabled: b.disabled, sub: document.getElementById('leave-sub').textContent }; });
const card = () => G(() => ({ text: document.getElementById('quest-text').textContent, items: document.querySelectorAll('#quest-list li').length, note: document.getElementById('quest-note')?.classList.contains('hidden') === false ? document.getElementById('quest-note').textContent : '', leave: document.getElementById('quest').classList.contains('leave'), day: document.getElementById('day').textContent }));
const kind = () => G(() => window.__game.day.kind);
const frames = (n = 300) => page.waitForTimeout(n);
/** Sleep in the home bed at `hour` and wait for the next morning. */
const sleepAt = async (hour) => {
  const d = await G((h) => { const g = window.__game; g.state.hour = h; g.day.use(g.places.interactables.find((i) => i.key === 'home:bed')); return g.state.day; }, hour);
  await page.waitForFunction((n) => window.__game.state.day === n + 1 && !window.__game.day.busy, d, { timeout: 20000 });
  await frames(400);
};
/** Press the button, check the question, answer 네. */
const takeLeave = async (left, name) => {
  await page.click('#leave-btn');
  await page.waitForSelector('#leave-ask:not(.hidden)');
  assert.equal(await G(() => document.getElementById('leave-ask-text').textContent), '오늘 휴가를 낼까요?');
  assert.equal(await G(() => document.getElementById('leave-ask-count').textContent), `이번 달 남은 휴가 ${left}개 → ${left - 1}개`);
  if (name) await shot(name);
  await page.click('#leave-yes');
  await page.waitForSelector('#leave-ask', { state: 'hidden' });
  await frames(400);
};

// ---- day 1 (Monday, a work day): the button is above the quest card with 3 left
assert.equal(await kind(), 'work');
const qb = await G(() => { const b = document.getElementById('leave-btn').getBoundingClientRect(), q = document.getElementById('quest').getBoundingClientRect(); return { bBottom: b.bottom, qTop: q.top, bRight: b.right, qRight: q.right, bTop: b.top }; });
assert.ok(qb.bBottom <= qb.qTop && qb.qTop - qb.bBottom < 16, 'the button sits right above the quest card');
assert.ok(Math.abs(qb.bRight - qb.qRight) < 1 && qb.bTop < 40, 'top right, lined up with the card');
let b = await btn();
assert.match(b.label, /🏖️ 휴가 내기 \(3\)/);
assert.equal(b.disabled, false);
assert.equal(b.sub, '이번 달 휴가 3개 남음');
// do a little of the day first: wake up and wash
await page.keyboard.down('KeyW'); await frames(500); await page.keyboard.up('KeyW');
await G(() => { const g = window.__game; g.day.use(g.places.interactables.find((i) => i.key === 'home:sink')); });
await page.waitForFunction(() => window.__game.day.step?.id === 'breakfast' && !window.__game.day.busy, null, { timeout: 20000 });
assert.ok((await card()).items > 3);
await page.locator('#quest-col').screenshot({ path: `${out}/01-button.png` });
await shot('01-work-day');
// 아니요 keeps the day; O opens the same question and Esc closes it
await page.click('#leave-btn');
await page.waitForSelector('#leave-ask:not(.hidden)');
await page.click('#leave-no');
await page.waitForSelector('#leave-ask', { state: 'hidden' });
assert.equal(await kind(), 'work');
await page.keyboard.press('KeyO');
await page.waitForSelector('#leave-ask:not(.hidden)');
await page.keyboard.press('Escape');
await page.waitForSelector('#leave-ask', { state: 'hidden' });
assert.equal(await kind(), 'work');
assert.deepEqual(await G(() => window.__game.state.leaves), []);

const money0 = await G(() => window.__game.state.money);
await takeLeave(3, '02-ask');
// today's quests are all gone: no steps, no marker beam, the vacation card
assert.equal(await kind(), 'leave');
assert.equal(await G(() => window.__game.day.steps.length), 0);
assert.equal(await G(() => window.__game.day.step), null);
assert.equal(await G(() => window.__game.day.target()), null);
assert.equal(await G(() => window.__game.day.marker.visible), false, 'no marker beam');
let c = await card();
assert.match(c.text, /^🏖️ 오늘은 휴가!\s*마음대로 놀아요$/);
assert.equal(c.items, 0);
assert.ok(c.leave && /밤 9시부터 침대/.test(c.note) && /유급 휴가/.test(c.note), c.note);
assert.match(c.day, /1일차 · 월요일 · 🏖️ 휴가/);
assert.equal(await G(() => window.__game.state.money), money0 + 150000, 'paid leave');
b = await btn();
assert.match(b.label, /\(2\)/);
assert.equal(b.disabled, true);
assert.equal(b.sub, '오늘은 벌써 휴가예요');
await frames(1500);
await shot('03-vacation-card');
await page.locator('#quest-col').screenshot({ path: `${out}/03-vacation-card-crop.png` });

// the bed: not before 9 p.m., then the day ends as usual
await G(() => { const g = window.__game; g.state.hour = 10; g.day.use(g.places.interactables.find((i) => i.key === 'home:bed')); });
await frames(600);
assert.equal(await G(() => window.__game.state.day), 1, 'too early to sleep');
await sleepAt(21.1);

// ---- day 2: a normal day again, one fewer left
assert.equal(await G(() => window.__game.state.day), 2);
assert.equal(await kind(), 'work');
assert.ok(await G(() => window.__game.day.steps.length) > 10);
c = await card();
assert.ok(c.items > 3 && !c.leave && c.note === '', 'normal quest card');
b = await btn();
assert.match(b.label, /\(2\)/);
assert.equal(b.disabled, false);
assert.equal(b.sub, '이번 달 휴가 2개 남음');
await G(() => { window.__game.day.busy = true; });
await frames(300);
b = await btn();
assert.equal(b.disabled, true);
assert.equal(b.sub, '지금 하는 일을 먼저 끝내요', 'off in the middle of something');
await G(() => { window.__game.day.busy = false; });
await frames(300);
assert.equal((await btn()).disabled, false);

// ---- use the other two (day 2 Tuesday, day 3 Wednesday 회식 day)
await takeLeave(2);
assert.equal(await kind(), 'leave');
await sleepAt(21.1);
assert.equal(await kind(), 'dinner');
await takeLeave(1);
assert.equal(await kind(), 'leave');
b = await btn();
assert.match(b.label, /\(0\)/);
await sleepAt(21.1);
// ---- day 4 (Thursday 출장): normal, but none left this month
assert.equal(await kind(), 'visit');
assert.ok(await G(() => window.__game.day.steps.length) > 5);
b = await btn();
assert.equal(b.disabled, true);
assert.equal(b.sub, '이번 달 휴가를 다 썼어요 (31일차에 3개 생겨요)');
await page.locator('#quest-col').screenshot({ path: `${out}/04-none-left.png` });
await page.keyboard.press('KeyO');
await frames(300);
assert.equal(await G(() => document.getElementById('leave-ask').classList.contains('hidden')), true, 'no question when off');
// ---- the weekend (Saturday without the ticket money is a rest day): off
await G(() => { window.__game.state.day = 5; });
await sleepAt(21.6);
assert.equal(await kind(), 'rest');
assert.equal((await btn()).sub, '주말은 원래 쉬는 날이에요');
// ---- next month (day 31, Wednesday): 3 again
await G(() => { window.__game.state.day = 30; });
await sleepAt(21.6);
assert.equal(await G(() => window.__game.state.day), 31);
assert.equal(await kind(), 'dinner');
b = await btn();
assert.match(b.label, /\(3\)/);
assert.equal(b.disabled, false);
assert.equal(b.sub, '이번 달 휴가 3개 남음');
await page.locator('#quest-col').screenshot({ path: `${out}/05-next-month.png` });
await takeLeave(3);
assert.deepEqual(await G(() => window.__game.state.leaves), [31], 'only this month is kept');

// ---- saved: after a reload it is still a vacation day with 2 left
await G(() => window.__game.day.g.save());
await page.reload();
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
await page.click('#play');
await frames(1200);
assert.equal(await G(() => window.__game.state.day), 31);
assert.equal(await kind(), 'leave');
assert.equal((await card()).items, 0);
b = await btn();
assert.match(b.label, /\(2\)/);
assert.equal(b.sub, '오늘은 벌써 휴가예요');

assert.deepEqual(errors, [], 'no page errors');
console.log('leave check ok', out);
await browser.close();
