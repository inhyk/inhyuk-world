// 뿌요뿌요 배우기의 졸업, 졸업2, 졸업3, 졸업4, 졸업5 (찐 마지막 다음의 다섯 등급, 236가지)를 실제 Chrome 에서 처음부터 끝까지 푼다.
// - 졸업: 발화점 찾기 22판 (자리를 알려 주지 않음, 두 번 되돌리면 도움말)
// - 졸업2: 오른쪽 4·5연쇄와 끼워 넣기를 빈 필드에서 쌓기, 두 수 퍼즐 9판, 쌓기 시험 3개, 6연쇄 쌓기(열두 번 놓기)
// - 졸업3 (62가지): 초대연쇄 11~14연쇄, 어려운 발화점 찾기, 두 수 퍼즐, 쌓기 시험, 눕혀서 발화, 두 색 발화, 세 수 퍼즐(안내),
//   방해 뿌요 속 발화점, 오른쪽 6연쇄 쌓기, 졸업 비결과 졸업장
// - 졸업4 (63가지): 혼자 푸는 발화점 찾기·눕혀서 발화·두 수·두 색·세 수 퍼즐, 방해 뿌요 속 발화점, 2층 쌓기 7연쇄(열다섯 번), 14·15연쇄
// - 졸업5 (65가지): 10~15연쇄 발화점 찾기, 뒤집어서 두 색 발화, 두 색 짝 두 수 퍼즐, 세 수·네 수 퍼즐, 2층 쌓기 8연쇄(열여덟 번), 16연쇄, 진짜 졸업장
// 문제마다 적어 둔 answer 대로 놓고, 비결 쪽은 단추로 넘긴다. 손님으로 하므로 서버는 쓰지 않는다.
//
// 사용법: npm run puyo-puyo:dev 후 PUYO_URL=http://127.0.0.1:5190/ node games/puyo-puyo/graduation-browser-check.mjs
// (예전 세 등급 71가지가 8분쯤 걸렸으니, 다섯 등급 236가지는 어림잡아 30분쯤. 아직 재 보지 않았다)
// 일부만: PUYO_GRADES=grad4,grad5 (이어진 등급만, 앞 등급은 끝낸 기록으로 시작한다. 등급 하나에 어림잡아 7~9분)
// 화면 사진: PUYO_SHOTS (기본 /tmp/puyo-graduation)
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { GRADES } from './tutorial.mjs';

const base = process.env.PUYO_URL || 'http://127.0.0.1:5190/';
const shots = process.env.PUYO_SHOTS || '/tmp/puyo-graduation';
const ALL = ['grad1', 'grad2', 'grad3', 'grad4', 'grad5'];
const wanted = (process.env.PUYO_GRADES || ALL.join(',')).split(',').map(s => s.trim()).filter(Boolean);
const indexes = wanted.map(id => GRADES.findIndex(g => g.id === id));
assert.ok(indexes.length && indexes.every((gi, k) => gi >= 7 && (k === 0 || gi === indexes[k - 1] + 1)), `PUYO_GRADES 는 ${ALL.join(', ')} 가운데 이어진 등급이어야 한다`);
const LAST = GRADES.length - 1, MARK = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱';
const SHOTS = { 'grad1-find22': 'find-10chain', 'grad3-mega3': 'mega-13chain', 'grad3-flat1': 'flat', 'grad3-duo1': 'duo', 'grad3-dig7': 'dig', 'grad4-two1': 'two-solo', 'grad5-duo1': 'duo-flipped', 'grad5-mega2': 'mega-16chain' };
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const T = { timeout: 20000 }, LONG = { timeout: 120000 };
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}${base.includes('?') ? '&' : '?'}test`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__puyo, null, { timeout: 60000 });
  await page.click('#go-guest');
  await page.waitForSelector('#scr-menu:not([hidden])');
  await page.evaluate(() => { document.getElementById('toasts').style.visibility = 'hidden'; });
  // 처음 풀 등급의 앞 등급까지 끝낸 기록에서 시작한다: 그 등급만 열려 있고 뒤 등급은 잠겨 있다
  const first = indexes[0], doneIds = GRADES.slice(1, first).map(g => g.id);
  await page.evaluate(ids => { const p = window.__puyo.P(); p.tutorial = true; p.school = ids; window.__puyo.show('school'); }, doneIds);
  assert.deepEqual(await page.$$eval('#school-list .grade', rows => rows.map(r => [r.querySelector('h3').textContent, r.className.replace('grade ', '')])),
    GRADES.map((g, i) => [g.name, i < first ? 'done' : i === first ? 'open' : 'locked']));
  await page.locator(`#school-list .grade[data-grade="${GRADES[first].id}"]`).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400); await page.screenshot({ path: `${shots}/school-graduation.png` });
  const before = await page.evaluate(() => ({ ...window.__puyo.P().tickets, coins: window.__puyo.P().coins }));
  await page.click(`#school-list .grade[data-grade="${GRADES[first].id}"] button`);

  const control = () => page.waitForFunction(() => { const p = window.__puyo.match?.players[0]; return p?.state === 'control' && p.piece && !window.__puyo.practice?.freeze; }, null, T);
  const lessonIs = (g, i) => page.waitForFunction(([grade, index]) => { const p = window.__puyo.practice; return p?.grade === grade && p.index === index && !p.freeze; }, [g, i], T);
  // 줄과 돌림(0 세워서, 1 오른쪽으로 눕혀서, 2 뒤집어서, 3 왼쪽으로 눕혀서)을 바로 정하고 떨어뜨린다
  async function place(x, rot) {
    await control();
    await page.evaluate(([px, r]) => { const p = window.__puyo.match.players[0]; p.piece.x = px; p.piece.rot = r; }, [x, rot]);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__puyo.match?.players[0].state !== 'control' || window.__puyo.practice?.freeze, null, T);
  }
  let solved = 0;
  for (const gi of indexes) {
    const grade = GRADES[gi], lessons = grade.lessons;
    for (const [index, l] of lessons.entries()) {
      if (l.tip) {
        await page.waitForFunction(([g, i]) => { const p = window.__puyo.practice; return p?.grade === g && p.index === i && p.freeze; }, [gi, index], T);
        assert.equal(await page.textContent('#coach-step'), `${grade.name} ${index + 1} / ${lessons.length}`);
        assert.equal(await page.textContent('#coach-title'), l.title);
        if (/diploma|grad4-done/.test(l.id)) { await page.waitForTimeout(400); await page.screenshot({ path: `${shots}/${l.id}.png` }); }
        await page.click('#coach-buttons button');
        continue;
      }
      await lessonIs(gi, index);
      assert.equal(await page.textContent('#coach-title'), l.title);
      if (l.id === 'grad1-find1') {
        // 발화점 찾기: 처음에는 자리를 알려 주지 않는다. 틀리면 "다시 해 보자", 두 번 틀린 뒤에는 도움말
        assert.ok(!/줄/.test(await page.textContent('#coach-text')));
        const wrong = [0, 1, 2, 3, 4, 5].find(x => x !== l.answer[0][0] && x !== l.answer[0][0] + 1 && x !== l.answer[0][0] - 1);
        for (let k = 0; k < 2; k++) {
          await place(wrong, 0);
          await page.waitForFunction(() => document.getElementById('coach-title').textContent.includes('다시 해 보자'), null, T);
          await lessonIs(gi, index);
        }
        assert.match(await page.textContent('#coach-text'), /^도움말: /);
        await page.waitForTimeout(300); await page.screenshot({ path: `${shots}/find-help.png` });
      }
      if (l.id === 'grad4-three1') {
        // 혼자 푸는 세 수 퍼즐: "↺ 처음 모양으로"를 두 번 누르면 짝마다 도움말이 나온다
        assert.ok(!/줄/.test(await page.textContent('#coach-text')));
        for (let k = 0; k < 2; k++) { await control(); await page.click('#coach-buttons button'); await lessonIs(gi, index); }
        assert.match(await page.textContent('#coach-text'), /^도움말 ① /);
        await page.waitForTimeout(300); await page.screenshot({ path: `${shots}/three-help.png` });
      }
      if (SHOTS[l.id]) { await page.waitForTimeout(300); await page.screenshot({ path: `${shots}/${SHOTS[l.id]}.png` }); }
      for (const [n, [x, rot]] of l.answer.entries()) {
        if (l.steps) await page.waitForFunction(mark => document.getElementById('coach-text').textContent.includes(mark), MARK[n], T); // 쌓기와 안내 퍼즐: 짝마다 안내가 바뀐다
        if (['grad2-scratch6', 'grad4-build7', 'grad5-build8'].includes(l.id) && n === l.answer.length - 1) { await page.waitForTimeout(300); await page.screenshot({ path: `${shots}/${l.id}.png` }); }
        await place(x, rot);
      }
      await page.waitForFunction(() => /잘했어!|다시 해 보자!/.test(document.getElementById('coach-title').textContent), null, LONG);
      assert.match(await page.textContent('#coach-title'), /잘했어!/, `${l.id}: 알려 준 대로 놓으면 성공`);
      assert.equal(await page.evaluate(() => window.__puyo.match.players[0].lastChain), l.goal.chain, l.id);
      solved++;
    }
    await page.waitForFunction(t => document.getElementById('coach-title').textContent.includes(t), gi < LAST ? `다음은 ${GRADES[gi + 1].name}!` : '모두 배웠어!', T);
    if (gi !== indexes.at(-1)) await page.click('#coach-buttons button.primary');
  }
  const last = indexes.at(-1);
  if (last === LAST) assert.match(await page.textContent('#coach-text'), /초급부터 졸업5까지 뿌요뿌요 배우기 열두 단계를 모두 끝냈어/);
  await page.waitForTimeout(400); await page.screenshot({ path: `${shots}/all-done.png` });
  // 푼 등급의 선물: 펫 뽑기권, 부스트, 스킨·효과 교환권이 등급에 적힌 만큼 늘었다
  const after = await page.evaluate(() => ({ ...window.__puyo.P().tickets, school: window.__puyo.P().school.slice() }));
  assert.deepEqual(after.school, GRADES.slice(1, last + 1).map(g => g.id));
  const sum = kind => indexes.reduce((n, gi) => n + (GRADES[gi].reward.tickets?.[kind] || 0), 0);
  assert.deepEqual([after.pet - before.pet, after.boost - before.boost, after.skin - before.skin, after.effect - before.effect], [sum('pet'), sum('boost'), sum('skin'), sum('effect')]);
  await page.click('#coach-buttons button.ghost');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).screen === 'school', null, T);
  assert.deepEqual(await page.$$eval('#school-list .grade', rows => rows.map(r => r.className.replace('grade ', ''))), GRADES.map((_, i) => (i <= last ? 'done' : i === last + 1 ? 'open' : 'locked')));
  assert.deepEqual(errors, []);
  console.log(`PASS: ${indexes.map(gi => `${GRADES[gi].name}(${GRADES[gi].lessons.length}가지)`).join(' → ')} ${solved}문제를 모두 풀고 ${last === LAST ? '열두 등급 완료' : `${GRADES[last].name}까지 완료`} — 오류 없음 (사진 ${shots})`);
} finally { await browser.close(); }
