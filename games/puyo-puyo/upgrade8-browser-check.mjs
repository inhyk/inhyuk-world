// 인혁이 기획서 「뿌요뿌요 (업그레이드)」(2026-10-11)를 실제 Chrome 으로 끝까지 확인한다 (서버 없이 손님으로).
// 3번 직접 놓아 보는 배우기 → 2번 뿌요 동영상(목록, 틀기, 멈춤, 처음부터, 다른 동영상, 끝) → 1번 새 스킨 30가지.
// 배우기 목록의 칸 → 색(다섯 색과 방해 뿌요)을 골라(색 점, 뿌요 그림 누르기) 놓아도 터지지 않음 → 맵 고르기(쫀득 연구소는 6개) → ▶ 실행하면 하나씩 터지며 연쇄, 꼬마 뿌요가 알려 줌
// → ⏪ 터지기 전으로, ↩ 무르기, 🧹 처음부터 → 꽉 차도 지지 않음 → 챌린지에 세지 않음 → 나가면 배우기 목록, 보통 배우기는 그대로.
//
// 사용법: npm run puyo-puyo:dev 후 PUYO_URL=http://127.0.0.1:5190/ node games/puyo-puyo/upgrade8-browser-check.mjs
// 화면 사진: PUYO_SHOTS (기본 /tmp/puyo-upgrade8)
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { VIDEOS, videoSeconds, lengthText, clock } from './videos.mjs';

const base = process.env.PUYO_URL || 'http://127.0.0.1:5190/';
const shots = process.env.PUYO_SHOTS || '/tmp/puyo-upgrade8';
await mkdir(shots, { recursive: true });
const url = `${base}${base.includes('?') ? '&' : '?'}test`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const T = { timeout: 20000 };
const R = 1, G = 2, B = 3, O = 6; // O: 방해 뿌요
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
  assert.match((await coach(page))[1], /회색은 방해 뿌요.*네가 내릴 때까지 기다려!.*같은 색이 4개 붙어도 아직 안 터져.*▶ 실행/);
  // 뿌요는 스스로 떨어지지 않는다 (색을 고르는 동안 혼자 내려앉지 않게)
  const spawnY = await page.evaluate(() => window.__puyo.match.players[0].piece.y);
  await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(() => window.__puyo.match.players[0].piece.y), spawnY);
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
  for (let i = 0; i < 4; i++) await page.mouse.click(pair.x + pair.width / 2, pair.y + pair.height * 0.25); // 초록 → 파랑 → 노랑 → 보라 → 방해 뿌요
  assert.deepEqual((await read(page)).lab.colors, [B, O]);
  assert.equal(await page.getAttribute('#lab-top button.on', 'aria-label'), '위 방해 뿌요');
  assert.deepEqual(await page.evaluate(() => { const q = window.__puyo.match.players[0].piece; return [q.a, q.c]; }), [B, O]); // 손에 든 짝의 위쪽이 방해 뿌요로
  await page.mouse.click(pair.x + pair.width / 2, pair.y + pair.height * 0.25); // 방해 뿌요 다음은 다시 빨강
  assert.deepEqual((await read(page)).lab.colors, [B, R]);
  for (const id of ['lab-top', 'lab-bottom']) assert.deepEqual(await page.locator(`#${id} button`).evaluateAll(bs => bs.map(b => b.dataset.color)), ['1', '2', '3', '4', '5', '6']);

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

  // 방해 뿌요도 놓는다 ("방해뿌요도 놓을 수 있게 만들어줘"): 맨 왼쪽 줄에 아래부터 방해, 빨강 넷, 방해
  await page.click('#lab-clear'); await holding(page);
  for (const [bottom, top] of [[O, R], [R, R], [R, O]]) { await pick(bottom, top); await dropLeft(); }
  assert.equal(await column(page, 0), '611116');
  await page.screenshot({ path: `${shots}/lab-garbage-${name}.png` });
  // 방해 뿌요만 있을 때는 터지지 않는다는 것을 알려 주고(다른 줄에 방해 뿌요 둘), 빨강 4개를 터뜨리면 옆의 방해 뿌요가 같이 사라진다
  await page.click('#lab-run');
  await page.waitForFunction(() => document.getElementById('coach-title').textContent === '1연쇄!', null, T);
  assert.equal((await coach(page))[1], '빨강 뿌요 4개가 터졌어. 옆에 있던 방해 뿌요 2개도 같이 사라졌어! 위에 있던 뿌요가 떨어져서 또 붙으면 다음 연쇄야!');
  await page.waitForFunction(() => { const l = JSON.parse(window.render_game_to_text()).lab; return !l.running && l.cells === 0; }, null, T);
  await holding(page);
  await pick(O, O); await dropLeft();
  assert.equal(await column(page, 0), '66');
  await page.click('#lab-run');
  await page.waitForFunction(() => document.getElementById('coach-title').textContent === '아직 터질 게 없어', null, T);
  assert.match((await coach(page))[1], /방해 뿌요는 색이 없어서 저희끼리는 안 터져/);
  await holding(page);
  assert.equal(await column(page, 0), '66');

  // 맵 고르기 ("직접 놓아 보는 배우기에서 맵을 고를 수 있게 만들어줘"): 🗺️ 단추 → 여섯 맵 → 고르면 배경과 "몇 개가 붙어야 터지는지"가 바뀐다
  await page.click('#lab-clear'); await holding(page);
  s = await read(page);
  assert.deepEqual([s.lab.map, s.lab.minGroup, s.theme], ['garden', 4, 'meadow']);
  assert.equal(await page.textContent('#lab-map'), '🗺️ 🌳 뿌요 정원');
  await pick(R, R); await dropLeft(); await dropLeft(); // 빨강 4개를 놓아 둔다
  await page.click('#lab-map');
  await page.waitForSelector('#lab-maps-pop:not([hidden])');
  assert.deepEqual(await page.locator('#lab-maps .map-card b').allTextContents(), ['뿌요 정원', '느긋한 빙하', '불꽃 화산', '무지개 섬', '별빛 우주', '쫀득 연구소']);
  assert.equal(await page.getAttribute('#lab-maps .map-card.selected', 'data-map'), 'garden');
  assert.equal(await page.textContent('#lab-maps [data-map="six"] small'), '같은 색 6개가 붙으면 터져');
  await page.waitForTimeout(300); await page.screenshot({ path: `${shots}/lab-maps-${name}.png` });
  if (!phone) { // 창이 떠 있는 동안 스페이스를 눌러도 뿌요가 떨어지지 않는다
    await page.keyboard.press('Space'); await page.waitForTimeout(300);
    assert.equal(await column(page, 0), '1111');
    assert.equal((await read(page)).lab.cells, 4);
  }
  await page.click('#lab-maps [data-map="six"]');
  await page.waitForSelector('#lab-maps-pop', { state: 'hidden' });
  s = await read(page);
  assert.deepEqual([s.lab.map, s.lab.minGroup, s.theme, s.map], ['six', 6, 'lab', 'six']);
  assert.equal(await page.textContent('#lab-map'), '🗺️ 🧪 쫀득 연구소');
  assert.equal(await page.textContent('#hud-title'), '🧪 직접 놓아 보기 · 🧪 쫀득 연구소');
  assert.deepEqual(await coach(page), ['🧪 쫀득 연구소!', '맵을 쫀득 연구소(으)로 바꿨어. 여기서는 같은 색 6개가 붙으면 터져. 4개나 5개는 안 터지니까 더 크게 모아 봐! 놓아 둔 뿌요는 그대로야.']);
  assert.equal(await column(page, 0), '1111'); // 놓아 둔 뿌요는 그대로
  assert.equal(await page.evaluate(() => window.__puyo.P().settings.labMap), 'six');
  // 쫀득 연구소: 빨강 4개로는 터지지 않고, 6개가 되면 터진다
  await page.click('#lab-run');
  await page.waitForFunction(() => document.getElementById('coach-title').textContent === '아직 터질 게 없어', null, T);
  assert.match((await coach(page))[1], /쫀득 연구소에서는 같은 색 뿌요 6개가 붙어야 터져/);
  await holding(page);
  await dropLeft();
  assert.equal(await column(page, 0), '111111');
  await page.screenshot({ path: `${shots}/lab-six-${name}.png` });
  await page.click('#lab-run');
  await page.waitForFunction(() => document.getElementById('coach-title').textContent === '1연쇄!', null, T);
  assert.match((await coach(page))[1], /^빨강 뿌요 6개가 터졌어\./);
  await page.waitForFunction(() => { const l = JSON.parse(window.render_game_to_text()).lab; return !l.running && l.cells === 0; }, null, T);
  await holding(page);
  // 고른 맵은 다음에 들어와도 그대로. 바깥을 누르거나 닫기를 누르면 창만 닫힌다
  await page.click('#hud-pause'); await page.click('#pause-retry');
  await holding(page);
  s = await read(page);
  assert.deepEqual([s.lab.map, s.lab.minGroup, s.theme], ['six', 6, 'lab']);
  await page.evaluate(() => { document.getElementById('toasts').style.visibility = 'hidden'; });
  await page.click('#lab-map'); await page.waitForSelector('#lab-maps-pop:not([hidden])');
  assert.equal(await page.getAttribute('#lab-maps .map-card.selected', 'data-map'), 'six');
  await page.click('#lab-maps-close');
  await page.waitForSelector('#lab-maps-pop', { state: 'hidden' });
  assert.equal((await read(page)).lab.map, 'six');
  // 별빛 우주(3색 맵)에서도 다섯 색과 방해 뿌요를 모두 고를 수 있다. 다시 뿌요 정원으로
  await page.click('#lab-map'); await page.click('#lab-maps [data-map="space"]');
  s = await read(page);
  assert.deepEqual([s.lab.map, s.lab.minGroup, s.theme], ['space', 4, 'space']);
  assert.deepEqual(await page.locator('#lab-top button').evaluateAll(bs => bs.map(b => b.dataset.color)), ['1', '2', '3', '4', '5', '6']);
  await page.click('#lab-map'); await page.click('#lab-maps [data-map="garden"]');
  s = await read(page);
  assert.deepEqual([s.lab.map, s.lab.minGroup, s.theme], ['garden', 4, 'meadow']);
  assert.equal(await page.textContent('#hud-title'), '🧪 직접 놓아 보는 배우기');
  // pause-retry 로 새 판이 됐으니 터진 것을 적는 장치를 다시 단다
  await page.evaluate(() => {
    window.__pops = [];
    const handle = window.__puyo.renderer.onEvent.bind(window.__puyo.renderer);
    if (!window.__puyo.renderer.__popsHooked) { window.__puyo.renderer.__popsHooked = true; window.__puyo.renderer.onEvent = (e, m) => { if (e.type === 'pop') window.__pops.push([e.chain, e.colors.join(''), e.puyos]); return handle(e, m); }; }
  });

  // 꽉 차도 지지 않는다: 뿌요가 나오는 셋째 줄을 꼭대기까지 채운다 (필드는 방금 새 판이라 비어 있고, 빈 필드에서는 「처음부터」 단추가 꺼져 있다)
  assert.equal((await read(page)).lab.cells, 0);
  assert.equal(await page.locator('#lab-clear').isDisabled(), true);
  await holding(page);
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

// ---------- 2번: 뿌요 동영상 ----------
const video = page => page.evaluate(() => JSON.parse(window.render_game_to_text()).video);
async function videos(name, viewport) {
  const phone = viewport.width < 500;
  const page = await open(name, viewport);
  await page.evaluate(() => { document.getElementById('toasts').style.visibility = 'hidden'; window.__puyo.show('school'); });
  await screenIs(page, 'school');
  const missionsBefore = await page.evaluate(() => JSON.stringify(window.__puyo.P().missions));
  // 배우기 목록의 칸 → 동영상 목록: 번호와 제목, 길이
  assert.equal(await page.textContent('#video-card h3'), '뿌요 동영상');
  await page.click('#videos-open'); await screenIs(page, 'videos');
  assert.deepEqual(await page.locator('#videos-list h3').allTextContents(), VIDEOS.map((v, i) => `${i + 1}. ${v.title} ${lengthText(videoSeconds(v))}`));
  assert.equal(await page.locator('#videos-list li').first().locator('h3').textContent(), `1. 연쇄 잘하는 법 ${lengthText(videoSeconds(VIDEOS[0]))}`);
  await page.waitForTimeout(300); await page.screenshot({ path: `${shots}/videos-list-${name}.png` });

  // 1번 「연쇄 잘하는 법」을 튼다: 손대지 않아도 뿌요가 놓이고, 자막은 꼬마 뿌요 말풍선에
  await page.click('#videos-list [data-video="chain"] button');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).video?.scene === 0, null, T);
  let v = await video(page);
  assert.deepEqual([v.id, v.index, v.paused, v.done, v.seconds], ['chain', 0, false, false, videoSeconds(VIDEOS[0])]);
  assert.equal(await page.textContent('#hud-title'), '🎬 1. 연쇄 잘하는 법');
  assert.equal(await page.textContent('#coach-step'), `🎬 뿌요 동영상 1 / ${VIDEOS.length}`);
  assert.equal(await page.textContent('#coach-title'), '1. 연쇄 잘하는 법!');
  assert.equal(await page.textContent('#coach-text'), VIDEOS[0].scenes[0].say);
  assert.equal(await page.locator('#touch').isHidden(), true); // 휴대폰 조작 단추도 없다
  assert.equal(await page.locator('#lab-panel').isHidden(), true);
  // 그림의 자리: 가운데 필드, 오른쪽에 시간과 다른 동영상(「연쇄 잘하는 법은?」, 「대전 방법」 …), 넓은 화면은 왼쪽에 제목·외울 것·길이
  const place = await page.evaluate(() => {
    const r = id => { const b = document.getElementById(id).getBoundingClientRect(); return { x: b.left, y: b.top, r: b.right, b: b.bottom }; };
    const f = window.__puyo.renderer.layout.fields[0];
    return { panel: r('video-panel'), info: r('video-info'), field: { x: f.x, r: f.x + f.cell * 6 }, w: innerWidth, h: innerHeight };
  });
  assert.ok(place.panel.x >= place.field.r && place.panel.r <= place.w && place.panel.b <= place.h, `${name} 오른쪽 칸 ${JSON.stringify(place.panel)}`);
  assert.deepEqual(await page.locator('#video-others button').allTextContents(), VIDEOS.map(o => `${o.emoji} ${o.ask}`));
  assert.equal(await page.getAttribute('#video-others button.on', 'data-video'), 'chain');
  assert.equal(await page.locator('#video-info').isVisible(), !phone);
  if (!phone) {
    assert.ok(place.info.r <= place.field.x && place.info.x >= 0, `왼쪽 칸 ${JSON.stringify(place.info)}`);
    assert.equal(await page.textContent('#video-title'), '1. 연쇄 잘하는 법!');
    assert.deepEqual(await page.locator('#video-keep li').allTextContents(), VIDEOS[0].keep);
    assert.equal(await page.textContent('#video-length'), `⏱ ${lengthText(videoSeconds(VIDEOS[0]))}`);
  }
  // 키보드를 눌러도 동영상 속 뿌요는 움직이지 않는다
  if (!phone) for (const key of ['ArrowLeft', 'ArrowLeft', 'Space']) await page.keyboard.press(key);
  // ⏸ 멈춤 / ▶ 재생
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).video.scene >= 1, null, T);
  await page.click('#video-pause');
  assert.equal(await page.textContent('#video-pause'), '▶ 재생');
  const stopped = (await video(page)).frames;
  await page.waitForTimeout(700);
  assert.equal((await video(page)).frames, stopped);
  assert.equal(await page.textContent('#video-time'), `${clock(stopped / 60)} / ${clock(videoSeconds(VIDEOS[0]))}`);
  await page.screenshot({ path: `${shots}/video-paused-${name}.png` });
  await page.click('#video-pause');
  assert.equal(await page.textContent('#video-pause'), '⏸ 멈춤');
  await page.waitForFunction(n => JSON.parse(window.render_game_to_text()).video.frames > n + 20, stopped, T);
  // 끝까지: 3연쇄가 나오고 "끝!"과 다음 동영상 단추
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).video.done, null, { timeout: 120000 });
  v = await video(page);
  assert.equal(Math.ceil(v.frames / 60), videoSeconds(VIDEOS[0])); // 목록에 적힌 길이 그대로
  assert.equal(await page.textContent('#coach-text'), '끝! 다음 동영상은 「대전 방법」이야.');
  assert.deepEqual(await page.locator('#coach-buttons button').allTextContents(), ['다음 동영상 ▶', '🔁 다시 보기', '목록으로']);
  assert.equal((await read(page)).match.players[0].maxChain, 3);
  await page.screenshot({ path: `${shots}/video-end-${name}.png` });
  // 다음 동영상 ▶ → 2번 「대전 방법」: 예고 칸에 방해 뿌요가 보인다
  await page.click('#coach-buttons button.primary');
  await page.waitForFunction(() => { const t = JSON.parse(window.render_game_to_text()); return t.video?.id === 'battle' && t.video.scene === 1 && t.match.players[0].incoming === 6; }, null, T);
  assert.equal(await page.getAttribute('#video-others button.on', 'data-video'), 'battle');
  await page.waitForTimeout(600); await page.screenshot({ path: `${shots}/video-battle-${name}.png` });
  // 🔁 처음부터, 그리고 오른쪽 목록에서 다른 동영상 고르기
  await page.click('#video-again');
  await page.waitForFunction(() => { const x = JSON.parse(window.render_game_to_text()).video; return x.id === 'battle' && x.frames < 60; }, null, T);
  await page.click('#video-others [data-video="allclear"]');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).video?.id === 'allclear', null, T);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).video.done, null, { timeout: 90000 });
  assert.match(await page.textContent('#coach-text'), /동영상을 끝까지 다 봤어!/); // 마지막 동영상
  assert.deepEqual(await page.locator('#coach-buttons button').allTextContents(), ['🔁 다시 보기', '목록으로']);
  // 동영상 속 연쇄는 챌린지에 세지 않는다. 목록으로 → 동영상 목록, 보통 배우기는 그대로
  assert.equal(await page.evaluate(() => JSON.stringify(window.__puyo.P().missions)), missionsBefore);
  await page.locator('#coach-buttons button', { hasText: '목록으로' }).click();
  await screenIs(page, 'videos');
  for (const id of ['video-panel', 'video-info', 'coach']) assert.equal(await page.locator(`#${id}`).isHidden(), true, id);
  assert.equal((await read(page)).video, null);
  await page.click('#scr-videos .back'); await screenIs(page, 'school');
  await page.evaluate(() => window.__puyo.startPractice(0, 0));
  await page.waitForFunction(() => window.__puyo.practice && !window.__puyo.practice.video, null, T);
  assert.equal(await page.locator('#video-panel').isHidden(), true);
  await page.context().close();
}

// ---------- 1번: 새 스킨 30가지 ----------
const NEW_SKINS = [['풍선 뿌요', 'balloon'], ['햄스터 뿌요', 'hamster'], ['생쥐 뿌요', 'mouse'], ['오리 뿌요', 'duck'], ['안경 뿌요', 'glasses'], ['요리사 뿌요', 'chef'], ['주먹밥 뿌요', 'onigiri'],
  ['부엉이 뿌요', 'owl'], ['원숭이 뿌요', 'monkey'], ['젖소 뿌요', 'cow'], ['양 뿌요', 'sheep'], ['카우보이 뿌요', 'cowboy'], ['삐에로 뿌요', 'clown'], ['사자 뿌요', 'lion'], ['코끼리 뿌요', 'elephant'],
  ['선물 상자 뿌요', 'present'], ['사슴 뿌요', 'deer'], ['공주 뿌요', 'princess'], ['고슴도치 뿌요', 'hedgehog'], ['헤드폰 뿌요', 'headphone'], ['거북이 뿌요', 'turtle'], ['산타 뿌요', 'santa'],
  ['꽃게 뿌요', 'crab'], ['뱀파이어 뿌요', 'vampire'], ['해파리 뿌요', 'jellyfish'], ['미라 뿌요', 'mummy'], ['히어로 뿌요', 'hero'], ['주사위 뿌요', 'dice'], ['얼음 뿌요', 'ice'], ['무지개 뿌요', 'rainbow']];
async function skins() {
  const page = await open('스킨', { width: 1100, height: 860 });
  await page.evaluate(() => { document.getElementById('toasts').style.visibility = 'hidden'; });
  await page.click('[data-go="shop"]'); await screenIs(page, 'shop');
  assert.equal(await page.locator('#shop-grid .item').count(), 87);
  const names = await page.evaluate(() => [...document.querySelectorAll('#shop-grid .item > b')].map(b => b.textContent));
  for (const [name] of NEW_SKINS) assert.ok(names.includes(name), name);
  await page.evaluate(() => { const p = window.__puyo.P(); p.level = 20; p.coins = 90000; window.__puyo.show('shop'); });
  const card = name => page.locator('#shop-grid .item', { has: page.locator('b', { hasText: new RegExp(`^${name}$`) }) });
  await card('풍선 뿌요').scrollIntoViewIfNeeded();
  await page.waitForTimeout(700); await page.screenshot({ path: `${shots}/shop-skins-1.png` });
  await card('사슴 뿌요').scrollIntoViewIfNeeded();
  await page.waitForTimeout(700); await page.screenshot({ path: `${shots}/shop-skins-2.png` });
  for (const [name, id] of [['사자 뿌요', 'lion'], ['산타 뿌요', 'santa']]) {
    await card(name).locator('button').first().click();
    await page.waitForFunction(skin => window.__puyo.P().owned.skin.includes(skin), id, T);
    assert.equal(await page.evaluate(() => window.__puyo.P().equip.skin), id);
  }
  // 레벨 스킨은 45 · 65레벨이 되어야 산다
  assert.match(await card('얼음 뿌요').textContent(), /45/);
  assert.match(await card('무지개 뿌요').textContent(), /65/);
  assert.equal(await card('얼음 뿌요').locator('button').first().isDisabled(), true);
  // 서른 가지를 모두 끼고 한 판씩 (그리기 오류가 없어야 한다). 직접 놓아 보는 배우기의 「놓을 뿌요」에도 그 스킨이 나온다
  for (const [, id] of NEW_SKINS) {
    await page.evaluate(skin => { window.__puyo.P().equip.skin = skin; window.__puyo.startLab(); }, id);
    await holding(page);
    await page.evaluate(() => { const p = window.__puyo.match.players[0]; p.piece.x = 1; p.hardDrop(); });
    await page.waitForTimeout(160);
  }
  await page.screenshot({ path: `${shots}/skin-rainbow-lab.png` });
  await page.context().close();
}

try {
  await check('pc', { width: 1280, height: 720 });
  await check('phone', { width: 390, height: 844 });
  await videos('pc', { width: 1280, height: 720 });
  await videos('phone', { width: 390, height: 844 });
  await skins();
  assert.deepEqual(errors, []);
  console.log('PASS: 직접 놓아 보는 배우기 — 색 고르기(색 점, 뿌요 누르기) → 놓아도 안 터짐 → ▶ 실행 2연쇄와 꼬마 뿌요 설명 → 터지기 전으로·무르기·처음부터 → 꽉 차도 안 짐 → 챌린지 그대로 → 나가면 배우기 목록 (컴퓨터, 휴대폰) — 오류 없음');
  console.log('PASS: 뿌요 동영상 — 목록(번호·제목·길이) → 틀기(자막, 왼쪽 제목·외울 것·길이, 오른쪽 다른 동영상) → 멈춤·재생 → 끝과 다음 동영상 → 처음부터 → 다른 동영상 → 목록으로 (컴퓨터, 휴대폰) / 새 스킨 30가지 상점·구매·그리기 — 오류 없음');
  console.log(`Screenshots: ${shots}`);
} finally {
  await browser.close();
}
