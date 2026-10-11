// 인혁이 기획서 「뿌요뿌요 (업그레이드)」(2026-10-11) 3번 직접 놓아 보는 배우기를 실제 Chrome 으로 끝까지 확인한다 (서버 없이 손님으로).
// 배우기 목록의 칸 → 색을 골라(색 점, 뿌요 그림 누르기) 놓아도 터지지 않음 → ▶ 실행하면 하나씩 터지며 연쇄, 꼬마 뿌요가 알려 줌
// → ⏪ 터지기 전으로, ↩ 무르기, 🧹 처음부터 → 꽉 차도 지지 않음 → 챌린지에 세지 않음 → 나가면 배우기 목록, 보통 배우기는 그대로.
//
// 사용법: npm run puyo-puyo:dev 후 PUYO_URL=http://127.0.0.1:5190/ node games/puyo-puyo/upgrade8-browser-check.mjs
// 화면 사진: PUYO_SHOTS (기본 /tmp/puyo-upgrade8)
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const base = process.env.PUYO_URL || 'http://127.0.0.1:5190/';
const shots = process.env.PUYO_SHOTS || '/tmp/puyo-upgrade8';
await mkdir(shots, { recursive: true });
const url = `${base}${base.includes('?') ? '&' : '?'}test`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const T = { timeout: 20000 };
const R = 1, G = 2, B = 3;
async function open(name, viewport) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__puyo, null, { timeout: 60000 });
  await page.click('#go-guest');
  await screenIs(page, 'menu');
  return page;
}
const read = page => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const screenIs = (page, name) => page.waitForFunction(n => JSON.parse(window.render_game_to_text()).screen === n, name, T);
const holding = page => page.waitForFunction(() => window.__puyo.match?.players[0].state === 'control', null, T);
const column = (page, x) => page.evaluate(col => { const p = window.__puyo.match.players[0], out = []; for (let y = 0; y < 13; y++) { const v = p.cells[y * 6 + col]; if (v) out.push(v); } return out.join(''); }, x);
const pops = page => page.evaluate(() => window.__pops);
const coach = async page => [await page.textContent('#coach-title'), await page.textContent('#coach-text')];

async function check(name, viewport) {
  const phone = viewport.width < 500;
  const page = await open(name, viewport);
  // 배우기 목록 맨 위의 칸
  await page.evaluate(() => window.__puyo.show('school')); await screenIs(page, 'school');
  assert.equal(await page.textContent('#lab-card h3'), '직접 놓아 보는 배우기');
  const missionsBefore = await page.evaluate(() => JSON.stringify(window.__puyo.P().missions));
  await page.click('#lab-start');
  // 준비~ 3, 2, 1 없이 바로 짝이 나온다. 옆 칸은 필드 오른쪽에 화면 안쪽으로
  await holding(page);
  await page.evaluate(() => {
    document.getElementById('toasts').style.visibility = 'hidden';
    window.__pops = [];
    const handle = window.__puyo.renderer.onEvent.bind(window.__puyo.renderer);
    window.__puyo.renderer.onEvent = (e, m) => { if (e.type === 'pop') window.__pops.push([e.chain, e.colors.join(''), e.puyos]); return handle(e, m); };
  });
  let s = await read(page);
  assert.equal(s.mode, 'practice');
  assert.deepEqual([s.lab.colors, s.lab.running, s.lab.hold, s.lab.cells], [[1, 3], false, true, 0]);
  assert.equal(await page.textContent('#hud-title'), '🧪 직접 놓아 보는 배우기');
  assert.match((await coach(page))[1], /같은 색이 4개 붙어도 아직 안 터져!.*▶ 실행/);
  await page.waitForTimeout(300);
  const boxes = await page.evaluate(() => {
    const r = id => { const b = document.getElementById(id).getBoundingClientRect(); return { x: b.left, y: b.top, r: b.right, b: b.bottom }; };
    const f = window.__puyo.renderer.layout.fields[0];
    return { panel: r('lab-panel'), pair: r('lab-pair'), run: r('lab-run'), undo: r('lab-undo'), clear: r('lab-clear'), field: { r: f.x + f.cell * 6, y: f.y }, w: innerWidth, h: innerHeight };
  });
  assert.ok(boxes.panel.x >= boxes.field.r && boxes.panel.r <= boxes.w, `${name} 옆 칸이 필드 오른쪽, 화면 안 ${JSON.stringify(boxes.panel)}`);
  // 기획서 그림의 차례: 위에 놓을 뿌요 칸, 그 아래 단추들
  assert.ok(boxes.pair.b <= boxes.run.y && boxes.run.b <= boxes.undo.y + 1 && boxes.undo.b <= boxes.clear.y + 1 && boxes.clear.b <= boxes.h);
  assert.equal(await page.locator('#lab-run').isDisabled(), true); // 아직 놓은 것이 없다
  assert.equal(await page.locator('#lab-undo').isDisabled(), true);
  await page.screenshot({ path: `${shots}/lab-start-${name}.png` });

  // 색 고르기: 색 점을 누르거나 뿌요 그림을 누른다(위쪽 반은 위, 아래쪽 반은 아래 뿌요가 다음 색으로). 손에 든 짝도 바로 바뀐다
  const pick = async (bottom, top) => { await page.click(`#lab-bottom [data-color="${bottom}"]`); await page.click(`#lab-top [data-color="${top}"]`); };
  await pick(G, R);
  assert.deepEqual(await page.evaluate(() => { const q = window.__puyo.match.players[0].piece; return [q.a, q.c]; }), [G, R]);
  const pair = await page.locator('#lab-pair').boundingBox();
  await page.mouse.click(pair.x + pair.width / 2, pair.y + pair.height * 0.25); // 위: 빨강 → 초록
  await page.mouse.click(pair.x + pair.width / 2, pair.y + pair.height * 0.75); // 아래: 초록 → 파랑
  assert.deepEqual((await read(page)).lab.colors, [B, G]);
  assert.equal(await page.getAttribute('#lab-top button.on', 'data-color'), String(G));
  for (let i = 0; i < 4; i++) await page.mouse.click(pair.x + pair.width / 2, pair.y + pair.height * 0.25); // 초록 → 파랑 → 노랑 → 보라 → 빨강
  assert.deepEqual((await read(page)).lab.colors, [B, R]);

  // 놓기: 컴퓨터는 화살표와 스페이스, 휴대폰은 아래 단추
  const dropLeft = async () => {
    await holding(page);
    const placed = await page.evaluate(() => window.__puyo.match.players[0].stats.pieces);
    for (let i = 0; i < 2; i++) { if (phone) await page.tap('#touch [data-act="left"]'); else await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(70); }
    if (phone) await page.tap('#touch [data-act="drop"]'); else await page.keyboard.press('Space');
    // 짝이 놓이고(놓은 수 +1) 다음 짝이 나올 때까지
    await page.waitForFunction(n => { const p = window.__puyo.match.players[0]; return p.stats.pieces === n + 1 && p.state === 'control'; }, placed, T);
  };
  // 맨 왼쪽 줄에 아래부터 파랑 파랑 / 파랑 빨강 / 빨강 빨강 / 빨강 파랑: 빨강 4개가 붙어도 터지지 않는다
  for (const [bottom, top] of [[B, B], [B, R], [R, R], [R, B]]) { await pick(bottom, top); await dropLeft(); }
  assert.equal(await column(page, 0), '33311113');
  assert.deepEqual(await pops(page), []);
  s = await read(page);
  assert.deepEqual([s.lab.history, s.lab.cells, s.lab.hold], [5, 8, true]);
  assert.equal(await page.locator('#lab-run').isEnabled(), true);
  await page.screenshot({ path: `${shots}/lab-built-${name}.png` });

  // ↩ 무르기: 마지막에 놓은 짝 하나만 사라진다. 다시 놓는다
  await page.click('#lab-undo'); await holding(page);
  assert.equal(await column(page, 0), '333111');
  assert.equal((await coach(page))[0], '하나 물렀어');
  await pick(R, B); await dropLeft();
  assert.equal(await column(page, 0), '33311113');

  // ▶ 실행: 하나씩 터지며 연쇄. 터지는 동안 단추는 잠긴다
  await page.click('#lab-run');
  await page.waitForFunction(() => window.__pops.length === 1, null, T);
  assert.deepEqual(await coach(page), ['1연쇄!', '빨강 뿌요 4개가 터졌어. 위에 있던 뿌요가 떨어져서 또 붙으면 다음 연쇄야!']);
  for (const id of ['lab-run', 'lab-undo', 'lab-clear']) assert.equal(await page.locator(`#${id}`).isDisabled(), true, id);
  await page.waitForTimeout(350); await page.screenshot({ path: `${shots}/lab-pop1-${name}.png` });
  await page.waitForFunction(() => window.__pops.length === 2, null, T);
  assert.equal((await coach(page))[0], '2연쇄!');
  await page.waitForFunction(() => { const l = JSON.parse(window.render_game_to_text()).lab; return !l.running && l.chain === 2; }, null, T);
  assert.deepEqual(await pops(page), [[1, '1', 4], [2, '3', 4]]);
  const done = await coach(page);
  assert.equal(done[0], '2연쇄 완성! ✨');
  assert.match(done[1], /지금까지 가장 긴 연쇄야!.*터지고 떨어져서 또 터지는 게 연쇄야.*⏪ 터지기 전으로/);
  await holding(page);
  s = await read(page);
  assert.deepEqual([s.lab.cells, s.lab.hold, s.lab.history], [0, true, 6]);
  assert.equal(await page.textContent('#lab-undo'), '⏪ 터지기 전으로');
  await page.screenshot({ path: `${shots}/lab-done-${name}.png` });

  // ⏪ 터지기 전으로: 실행하기 전 모양으로 돌아와서 고쳐 볼 수 있다
  await page.click('#lab-undo'); await holding(page);
  assert.equal(await column(page, 0), '33311113');
  assert.equal((await coach(page))[0], '터지기 전으로 돌아왔어');
  assert.equal(await page.textContent('#lab-undo'), '↩ 무르기');
  if (!phone) {
    // 단추를 누른 뒤의 스페이스는 단추가 아니라 뿌요를 떨어뜨린다 (실행이 또 눌리지 않는다)
    await page.click('#lab-run');
    await page.waitForFunction(() => { const l = JSON.parse(window.render_game_to_text()).lab; return !l.running && l.cells === 0; }, null, T);
    await holding(page);
    const before = (await pops(page)).length;
    await page.keyboard.press('Space');
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).lab.cells === 2, null, T);
    await page.waitForTimeout(500);
    assert.equal((await pops(page)).length, before);
    assert.equal((await read(page)).lab.running, false);
  }

  // 터질 것이 없을 때 실행하면 알려 준다
  await page.click('#lab-clear'); await holding(page);
  assert.equal((await read(page)).lab.cells, 0);
  assert.equal((await coach(page))[0], '처음부터!');
  await pick(R, G); await dropLeft();
  await page.click('#lab-run');
  await page.waitForFunction(() => document.getElementById('coach-title').textContent === '아직 터질 게 없어', null, T);
  await holding(page);
  assert.equal(await column(page, 0), '12');
  assert.equal(await page.textContent('#lab-undo'), '↩ 무르기');

  // 꽉 차도 지지 않는다: 뿌요가 나오는 셋째 줄을 꼭대기까지 채운다
  await page.click('#lab-clear'); await holding(page);
  for (let i = 0; i < 6; i++) {
    await pick(i % 2 ? G : R, i % 2 ? G : R);
    await page.evaluate(() => window.__puyo.match.players[0].hardDrop());
    await page.waitForFunction(() => ['control', 'full'].includes(window.__puyo.match.players[0].state), null, T);
  }
  await page.waitForFunction(() => document.getElementById('coach-title').textContent === '꽉 찼어!', null, T);
  s = await read(page);
  assert.equal(s.lab.state, 'full'); assert.equal(s.match.phase, 'play');
  assert.equal(await page.locator('#result').isHidden(), true);
  await page.screenshot({ path: `${shots}/lab-full-${name}.png` });
  await page.click('#lab-undo'); await holding(page);
  assert.equal(await column(page, 2), '1122112211'); // 마지막 짝 하나만 물렀다

  // 마음대로 만든 연쇄는 챌린지에 세지 않는다
  assert.equal(await page.evaluate(() => JSON.stringify(window.__puyo.P().missions)), missionsBefore);

  // 그만하면 배우기 목록으로. 보통 배우기를 시작하면 옆 칸은 사라지고 예전 그대로다
  await page.click('#hud-pause'); await page.click('#pause-quit');
  await screenIs(page, 'school');
  assert.equal(await page.locator('#lab-panel').isHidden(), true);
  assert.equal((await read(page)).lab, null);
  await page.evaluate(() => window.__puyo.startPractice(0, 0));
  await page.waitForFunction(() => window.__puyo.practice && !window.__puyo.practice.lab, null, T);
  assert.equal(await page.locator('#lab-panel').isHidden(), true);
  assert.equal((await read(page)).lab, null);
  assert.equal(await page.evaluate(() => window.__puyo.match.players[0].hold), false);
  await page.context().close();
}

try {
  await check('pc', { width: 1280, height: 720 });
  await check('phone', { width: 390, height: 844 });
  assert.deepEqual(errors, []);
  console.log('PASS: 직접 놓아 보는 배우기 — 색 고르기(색 점, 뿌요 누르기) → 놓아도 안 터짐 → ▶ 실행 2연쇄와 꼬마 뿌요 설명 → 터지기 전으로·무르기·처음부터 → 꽉 차도 안 짐 → 챌린지 그대로 → 나가면 배우기 목록 (컴퓨터, 휴대폰) — 오류 없음');
  console.log(`Screenshots: ${shots}`);
} finally {
  await browser.close();
}
