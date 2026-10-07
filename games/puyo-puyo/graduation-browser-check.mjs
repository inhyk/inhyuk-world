// 뿌요뿌요 배우기의 졸업, 졸업2, 졸업3 (찐 마지막 다음의 세 등급, 71가지)을 실제 Chrome 에서 처음부터 끝까지 푼다.
// - 졸업: 발화점 찾기 22판 (자리를 알려 주지 않음, 두 번 되돌리면 도움말)
// - 졸업2: 오른쪽 4·5연쇄와 끼워 넣기를 빈 필드에서 쌓기, 두 수 퍼즐 9판, 쌓기 시험 3개, 6연쇄 쌓기(열두 번 놓기)
// - 졸업3: 초대연쇄 11·12·13연쇄, 어려운 발화점 찾기, 혼자 푸는 두 수 퍼즐, 최종 시험, 졸업 비결과 졸업장
// 문제마다 적어 둔 answer 대로 놓고, 비결 쪽은 단추로 넘긴다. 손님으로 하므로 서버는 쓰지 않는다.
//
// 사용법: npm run puyo-puyo:dev 후 PUYO_URL=http://127.0.0.1:5190/ node games/puyo-puyo/graduation-browser-check.mjs (8분쯤 걸린다)
// 화면 사진: PUYO_SHOTS (기본 /tmp/puyo-graduation)
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { GRADES } from './tutorial.mjs';

const base = process.env.PUYO_URL || 'http://127.0.0.1:5190/';
const shots = process.env.PUYO_SHOTS || '/tmp/puyo-graduation';
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
  // 찐 마지막까지 끝낸 기록에서 시작한다: 졸업만 열려 있고 졸업2, 졸업3 은 잠겨 있다
  await page.evaluate(() => { const p = window.__puyo.P(); p.tutorial = true; p.school = ['middle', 'high', 'master', 'ultra', 'final', 'real']; window.__puyo.show('school'); });
  assert.deepEqual(await page.$$eval('#school-list .grade', rows => rows.slice(7).map(r => [r.querySelector('h3').textContent, r.className.replace('grade ', '')])), [['졸업', 'open'], ['졸업2', 'locked'], ['졸업3', 'locked']]);
  await page.locator('#school-list .grade[data-grade="grad1"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400); await page.screenshot({ path: `${shots}/school-graduation.png` });
  const before = await page.evaluate(() => ({ ...window.__puyo.P().tickets, coins: window.__puyo.P().coins }));
  await page.click('#school-list .grade[data-grade="grad1"] button');

  const control = () => page.waitForFunction(() => { const p = window.__puyo.match?.players[0]; return p?.state === 'control' && p.piece && !window.__puyo.practice?.freeze; }, null, T);
  const lessonIs = (g, i) => page.waitForFunction(([grade, index]) => { const p = window.__puyo.practice; return p?.grade === grade && p.index === index && !p.freeze; }, [g, i], T);
  async function place(x, rot) {
    await control();
    await page.evaluate(([px, r]) => { const p = window.__puyo.match.players[0]; p.piece.x = px; p.piece.rot = r; }, [x, rot]);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__puyo.match?.players[0].state !== 'control' || window.__puyo.practice?.freeze, null, T);
  }
  let solved = 0;
  for (const gi of [7, 8, 9]) {
    const grade = GRADES[gi], lessons = grade.lessons;
    for (const [index, l] of lessons.entries()) {
      if (l.tip) {
        await page.waitForFunction(([g, i]) => { const p = window.__puyo.practice; return p?.grade === g && p.index === i && p.freeze; }, [gi, index], T);
        assert.equal(await page.textContent('#coach-step'), `${grade.name} ${index + 1} / ${lessons.length}`);
        assert.equal(await page.textContent('#coach-title'), l.title);
        if (l.id === 'grad3-diploma') { await page.waitForTimeout(400); await page.screenshot({ path: `${shots}/diploma.png` }); }
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
      if (l.id === 'grad1-find22') { await page.waitForTimeout(300); await page.screenshot({ path: `${shots}/find-10chain.png` }); }
      if (l.id === 'grad3-mega3') { await page.waitForTimeout(300); await page.screenshot({ path: `${shots}/mega-13chain.png` }); }
      for (const [n, [x, rot]] of l.answer.entries()) {
        if (l.steps) await page.waitForFunction(mark => document.getElementById('coach-text').textContent.includes(mark), '①②③④⑤⑥⑦⑧⑨⑩⑪⑫'[n], T); // 쌓기: 짝마다 안내가 바뀐다
        if (l.id === 'grad2-scratch6' && n === 11) { await page.waitForTimeout(300); await page.screenshot({ path: `${shots}/build-6chain.png` }); }
        await place(x, rot);
      }
      await page.waitForFunction(() => /잘했어!|다시 해 보자!/.test(document.getElementById('coach-title').textContent), null, LONG);
      assert.match(await page.textContent('#coach-title'), /잘했어!/, `${l.id}: 알려 준 대로 놓으면 성공`);
      assert.equal(await page.evaluate(() => window.__puyo.match.players[0].lastChain), l.goal.chain, l.id);
      solved++;
    }
    await page.waitForFunction(t => document.getElementById('coach-title').textContent.includes(t), gi < 9 ? `다음은 ${GRADES[gi + 1].name}!` : '모두 배웠어!', T);
    if (gi < 9) await page.click('#coach-buttons button.primary');
  }
  assert.match(await page.textContent('#coach-text'), /초급부터 졸업3까지 뿌요뿌요 배우기 열 단계를 모두 끝냈어/);
  await page.waitForTimeout(400); await page.screenshot({ path: `${shots}/all-done.png` });
  // 세 등급의 선물: 펫 뽑기권 6 + 8 + 10, 부스트 3 + 4 + 5, 스킨·효과 교환권 2 + 3 + 3
  const after = await page.evaluate(() => ({ ...window.__puyo.P().tickets, school: window.__puyo.P().school.slice(-3) }));
  assert.deepEqual(after.school, ['grad1', 'grad2', 'grad3']);
  assert.deepEqual([after.pet - before.pet, after.boost - before.boost, after.skin - before.skin, after.effect - before.effect], [24, 12, 8, 8]);
  await page.click('#coach-buttons button.ghost');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).screen === 'school', null, T);
  assert.deepEqual(await page.$$eval('#school-list .grade', rows => rows.map(r => r.className.replace('grade ', ''))), Array(10).fill('done'));
  assert.deepEqual(errors, []);
  console.log(`PASS: 졸업(발화점 찾기 22판, 틀리면 다시·두 번 틀리면 도움말) → 졸업2(쌓기, 두 수 퍼즐, 시험, 6연쇄 쌓기) → 졸업3(초대연쇄 13연쇄, 최종 시험, 졸업장) ${solved}문제를 모두 풀고 열 등급 완료 — 오류 없음 (사진 ${shots})`);
} finally { await browser.close(); }
