import test from 'node:test';
import assert from 'node:assert/strict';
import { GRADES, LESSONS, lessonCells, lessonSeq, lessonStep, newJudge, judge, gradeDone, gradeOpen, finishGrade } from './tutorial.mjs';
import { resolveChain, makeSequence, pairAt, W, Player, findGroups, heights, GARBAGE, DX } from './core.mjs';
import { newProgress, sanitize, SCHOOL_IDS } from './profile.mjs';
import * as boards from './school-puzzles2.mjs';
import * as boards1 from './school-puzzles.mjs';
import { SETS3 } from './school-puzzles3.mjs';

const lesson = id => LESSONS.find(l => l.id === id);
// (x, y)에 색 c를 놓은 새 필드 (y=0이 바닥)
function place(cells, puts) { const out = cells.slice(); for (const [x, y, c] of puts) out[y * W + x] = c; return out; }

test('연습 2: 빨강 짝을 옆에 붙여도, 위에 쌓아도 4개가 이어져 터진다', () => {
  const cells = lessonCells(lesson('pop'));
  assert.equal(resolveChain(cells.slice()).chain, 0); // 처음에는 아무것도 안 터진다
  assert.equal(resolveChain(place(cells, [[2, 0, 1], [3, 0, 1]])).chain, 1); // 가로로 옆에
  assert.equal(resolveChain(place(cells, [[2, 0, 1], [2, 1, 1]])).chain, 1); // 그냥 바로 떨어뜨리기(3번째 줄 세로)
  assert.equal(resolveChain(place(cells, [[5, 0, 1], [5, 1, 1]])).chain, 0); // 멀리 놓으면 안 터진다
});

test('연습 3: 빨강을 맨 왼쪽 줄에 세로로도, 가로로도 놓으면 2연쇄', () => {
  const cells = lessonCells(lesson('chain'));
  assert.equal(resolveChain(cells.slice()).chain, 0);
  assert.equal(resolveChain(place(cells, [[0, 1, 1], [0, 2, 1]])).chain, 2); // 세로로 맨 왼쪽
  assert.equal(resolveChain(place(cells, [[0, 1, 1], [1, 3, 1]])).chain, 2); // 가로 짝이 갈라져 왼쪽 두 줄에
  assert.equal(resolveChain(place(cells, [[4, 0, 1], [4, 1, 1]])).chain, 0);
});

test('연습 짝 순서는 정해 둔 대로 되풀이된다', () => {
  const seq = lessonSeq(lesson('chain'), makeSequence(5));
  assert.deepEqual(pairAt(seq, 0), [1, 1]);
  assert.deepEqual(pairAt(seq, 3), [1, 1]);
  const moveSeq = lessonSeq(lesson('move'), makeSequence(5));
  assert.deepEqual([0, 1, 2, 3, 4].map(n => pairAt(moveSeq, n)), [[1, 2], [3, 3], [4, 1], [2, 3], [1, 2]]);
});

test('연습 판정: 3번 내려놓기 / 터뜨리기 / 2연쇄, 두 번 놓치면 다시', () => {
  let s = newJudge();
  assert.equal(judge(lesson('move'), s, { type: 'lock' }), null);
  assert.equal(judge(lesson('move'), s, { type: 'spawn' }), null);
  assert.equal(judge(lesson('move'), s, { type: 'lock' }), null);
  assert.equal(judge(lesson('move'), s, { type: 'lock' }), 'done');

  s = newJudge();
  assert.equal(judge(lesson('pop'), s, { type: 'spawn' }), null); // 첫 짝이 나올 때는 놓친 게 아니다
  assert.equal(judge(lesson('pop'), s, { type: 'lock' }), null);
  assert.equal(judge(lesson('pop'), s, { type: 'spawn' }), null); // 한 번 놓침
  assert.equal(judge(lesson('pop'), s, { type: 'lock' }), null);
  assert.equal(judge(lesson('pop'), s, { type: 'chainEnd', chain: 1 }), 'done'); // 두 번째에 터뜨림

  s = newJudge();
  judge(lesson('pop'), s, { type: 'lock' }); judge(lesson('pop'), s, { type: 'spawn' });
  judge(lesson('pop'), s, { type: 'lock' });
  assert.equal(judge(lesson('pop'), s, { type: 'spawn' }), 'retry'); // 두 번 놓치면 처음부터

  s = newJudge();
  judge(lesson('chain'), s, { type: 'lock' });
  assert.equal(judge(lesson('chain'), s, { type: 'chainEnd', chain: 1 }), 'retry'); // 한 번만 터지면 아깝다
  s = newJudge();
  judge(lesson('chain'), s, { type: 'lock' });
  assert.equal(judge(lesson('chain'), s, { type: 'chainEnd', chain: 2 }), 'done');
});

test('연습을 끝냈는지는 저장되고, 이상한 값은 끝내지 않은 것으로', () => {
  assert.equal(newProgress().tutorial, false);
  assert.equal(sanitize({ tutorial: true }).tutorial, true);
  assert.equal(sanitize({ tutorial: 'yes' }).tutorial, false);
  assert.equal(sanitize({}).tutorial, false);
});

// ---------- 졸업3(늘린 부분), 졸업4, 졸업5 ----------
// 인혁이 기획서 「뿌요뿌요 (업그레이드)」 2번: "졸업3은 엄청 길게 만들어줘 그리고 졸업4랑 졸업5도 만드는데 그것도 엄청 길게 만들어줘"
// 진짜 Player 로 짝을 정한 자리에 떨어뜨려 보고 판정과 연쇄 수를 받는다. placements: [[줄, 돌림], ...]
function playLesson(l, placements) {
  const p = new Player({ seq: lessonSeq(l, makeSequence(1)), seed: 1 });
  p.cells.set(lessonCells(l)); p.refreshHeights();
  p.start();
  const state = newJudge(), out = { verdict: null, chain: 0, allClear: false, garbage: 0 };
  let i = 0;
  for (let frame = 0; frame < 9000 && !out.verdict; frame++) {
    let input = {};
    if (p.state === 'control' && p.piece) {
      if (i >= placements.length) break;
      const [x, rot] = placements[i++];
      p.piece.x = x; p.piece.rot = rot;
      input = { drop: true };
    }
    p.step(input, {});
    for (const e of p.events) {
      if (e.type === 'chainEnd') { out.chain = e.chain; out.allClear = !!e.allClear; }
      if (e.type === 'pop') out.garbage += e.garbage || 0;
      out.verdict ||= judge(l, state, e);
    }
    p.events.length = 0;
  }
  return out;
}
const PLACES = [];
for (let x = 0; x < 6; x++) { PLACES.push([x, 0], [x, 2]); if (x < 5) PLACES.push([x, 1]); if (x > 0) PLACES.push([x, 3]); }
const solvedPlaces = l => PLACES.filter(pl => playLesson(l, [pl]).verdict === 'done');
const grad = n => GRADES.find(g => g.id === `grad${n}`);
const kind = l => (l.tip ? 'tip' : l.id.replace(/^grad\d+-/, '').replace(/\d+$/, ''));
const of = (n, k) => grad(n).lessons.filter(l => kind(l) === k);
const chains = list => list.map(l => l.goal.chain);
// 짝을 놓기 전의 줄 높이로, 뿌요가 나오는 셋째 줄에서 그 자리까지 가는 길이 막히지 않았나 (아홉 칸보다 높은 줄을 넘지 않는다)
function reachable(l) {
  const h = Array.from(heights(lessonCells(l)));
  return l.answer.every(([x, rot], i) => {
    const xs = [2, x, x + DX[rot]], ok = h.slice(Math.min(...xs), Math.max(...xs) + 1).every(v => v <= 9);
    const [a, c] = l.pairs[i];
    if (rot === 0 || rot === 2) h[x] += 2; else { h[x]++; h[x + DX[rot]]++; }
    return ok && a > 0 && c > 0;
  });
}

test('졸업3 은 62가지로 길어지고, 졸업4(63가지)와 졸업5(65가지)가 그 뒤에 열린다', () => {
  assert.deepEqual(GRADES.slice(9, 12).map(g => [g.id, g.name, g.lessons.length]), [['grad3', '졸업3', 62], ['grad4', '졸업4', 63], ['grad5', '졸업5', 65]]);
  for (const g of GRADES.slice(9, 12)) assert.ok(g.lessons.length >= 60, `${g.name}: 엄청 길게`);
  assert.deepEqual(SCHOOL_IDS.slice(8, 11), ['grad3', 'grad4', 'grad5']);
  assert.equal(GRADES.slice(0, 12).reduce((n, g) => n + g.lessons.length, 0), 291);
  // 졸업3에 끼운 여섯 부: 눕혀서 발화 8 → 두 색 발화 8 → 세 수 퍼즐 6 → 방해 뿌요 속 발화점 7 → 14연쇄 → 오른쪽 6연쇄 쌓기
  assert.deepEqual(grad(3).lessons.slice(19, -6).map(kind), ['tip', ...Array(8).fill('flat'), 'tip', ...Array(8).fill('duo'), 'tip', ...Array(6).fill('three'),
    'tip', ...Array(7).fill('dig'), 'tip', 'mega', 'tip', 'right']);
  assert.deepEqual(grad(4).lessons.map(kind), ['tip', ...Array(10).fill('find'), 'tip', ...Array(6).fill('flat'), 'tip', ...Array(10).fill('two'), 'tip', ...Array(6).fill('duo'),
    'tip', ...Array(6).fill('three'), 'tip', ...Array(6).fill('dig'), 'tip', 'sandwich-r', 'build', 'exam6r', 'tip', 'mega', 'mega', ...Array(6).fill('tip')]);
  assert.deepEqual(grad(5).lessons.map(kind), ['tip', ...Array(10).fill('find'), 'tip', ...Array(8).fill('duo'), 'tip', ...Array(8).fill('two'), 'tip', ...Array(8).fill('three'),
    'tip', ...Array(4).fill('four'), 'tip', ...Array(6).fill('dig'), 'tip', 'build', 'exam-sandwich-r', 'exam', 'tip', 'mega', 'mega', ...Array(8).fill('tip')]);
  // 뒤로 갈수록 길어진다
  assert.deepEqual(chains(of(3, 'flat')), [4, 5, 6, 7, 8, 9, 10, 11]); assert.deepEqual(chains(of(3, 'duo')), [4, 5, 6, 7, 8, 9, 10, 11]);
  assert.deepEqual(chains(of(3, 'three')), [5, 6, 7, 8, 9, 10]); assert.deepEqual(chains(of(3, 'dig')), [4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(chains(of(4, 'find')), [8, 9, 9, 10, 10, 11, 11, 12, 12, 13]); assert.deepEqual(chains(of(4, 'two')), [6, 7, 7, 8, 8, 9, 9, 10, 10, 11]);
  assert.deepEqual(chains(of(5, 'find')), [10, 11, 12, 12, 13, 13, 14, 14, 15, 15]); assert.deepEqual(chains(of(5, 'four')), [6, 7, 8, 9]);
  assert.deepEqual(chains([...of(3, 'mega'), ...of(4, 'mega'), ...of(5, 'mega')]), [11, 12, 13, 14, 14, 15, 15, 16]);
  // 맨 끝은 졸업장, 선물은 갈수록 크다 (졸업6 ~ 졸업10 이 생긴 뒤로 졸업5 의 것은 「다섯 번째 졸업장」)
  assert.equal(grad(5).lessons.at(-1).title, '🎓 다섯 번째 졸업장');
  assert.match(grad(5).lessons.at(-1).text, /초급부터 졸업5까지 뿌요뿌요 배우기 열두 단계를 모두 마쳤습니다/);
  assert.match(grad(4).lessons.at(-1).text, /다음은 다섯 번째 졸업, 졸업5야/);
  assert.deepEqual(GRADES.slice(9, 12).map(g => g.reward), [
    { coins: 30000, xp: 8000, tickets: { pet: 10, boost: 5, skin: 3, effect: 3 } },
    { coins: 40000, xp: 10000, tickets: { pet: 12, boost: 6, skin: 4, effect: 4 } },
    { coins: 60000, xp: 15000, tickets: { pet: 15, boost: 8, skin: 5, effect: 5 } },
  ]);
  for (const l of GRADES.slice(9, 12).flatMap(g => g.lessons)) assert.ok(!/젤리/.test(JSON.stringify(l)), `${l.id}: 화면 글은 뿌요로만 쓴다 (앱 빌드가 바꾼다)`);
});

test('졸업3까지 끝낸 기록은 그대로 끝낸 것이고, 졸업4 → 졸업5 순서로 열린다. 기록에는 등급 이름만 더 적힌다', () => {
  const p = sanitize({ tutorial: true, school: ['middle', 'high', 'master', 'ultra', 'final', 'real', 'grad1', 'grad2', 'grad3'] });
  assert.deepEqual([9, 10, 11].map(i => [gradeDone(p, i), gradeOpen(p, i)]), [[true, true], [false, true], [false, false]]);
  assert.equal(finishGrade(p, 10), true); assert.equal(gradeOpen(p, 11), true);
  assert.equal(finishGrade(p, 11), true); assert.equal(finishGrade(p, 11), false);
  assert.deepEqual(sanitize(JSON.parse(JSON.stringify(p))).school.slice(-3), ['grad3', 'grad4', 'grad5']);
  assert.ok(JSON.stringify(p.school).length < 120); // 클라우드 저장(32KB)에 등급 이름 열한 개만
});

test('새 퍼즐 판 122개: 모두 다르고, 처음에는 아무것도 안 터지고, 알려 준 대로 놓으면 적힌 연쇄가 나와 전소로 끝난다', () => {
  const sets = Object.entries(boards), all = sets.flatMap(([, list]) => list);
  assert.equal(sets.length, 19); assert.equal(all.length, 122);
  assert.equal(new Set(all.map(b => b.field.join('/'))).size, 122);
  const lessons = GRADES.slice(9, 12).flatMap(g => g.lessons).filter(l => !l.tip && l.field.length);
  const fresh = lessons.filter(l => all.some(b => b.field === l.field));
  assert.equal(fresh.length, 122); // 판마다 문제 하나
  for (const l of fresh) {
    const cells = lessonCells(l), h = heights(cells);
    assert.equal(findGroups(cells).length, 0, l.id);
    assert.ok(h[2] <= 9 && Math.max(...h) <= 11, `${l.id}: 높이`);
    assert.ok(reachable(l), `${l.id}: 놓을 자리까지 가는 길이 열려 있다`);
    assert.equal(l.answer.length, l.pairs.length, l.id); assert.equal(l.goal.moves, l.pairs.length, l.id);
    const r = playLesson(l, l.answer);
    assert.deepEqual([r.verdict, r.chain, r.allClear], ['done', l.goal.chain, true], l.id);
    // 마지막 짝을 놓기 전에는 아무것도 터지지 않는다
    for (let n = 1; n < l.answer.length; n++) assert.deepEqual(playLesson(l, l.answer.slice(0, n)), { verdict: null, chain: 0, allClear: false, garbage: 0 }, `${l.id}: ${n}번째까지`);
  }
});

test('눕혀서 발화: 같은 색 짝을 눕혀야만 풀리고, 자리는 두 번 틀린 뒤에 알려 준다', () => {
  const list = [...of(3, 'flat'), ...of(4, 'flat')];
  assert.equal(list.length, 14);
  for (const l of list) {
    assert.equal(l.pairs[0][0], l.pairs[0][1]); assert.equal(l.answer[0][1], 1);
    const solved = solvedPlaces(l);
    assert.ok(solved.length >= 1 && solved.length <= 4, `${l.id}: 풀리는 자리 ${solved.length}개`);
    assert.ok(solved.every(([, rot]) => rot === 1 || rot === 3), `${l.id}: 세워서는 안 풀린다`);
    assert.ok(!/줄/.test(l.text)); assert.equal(lessonStep(l, 0, 1), null);
    assert.match(lessonStep(l, 0, 2), /^도움말: .+ 짝을 .+ 줄과 .+ 줄에 눕혀서 놓아 봐/);
  }
});

test('두 색 발화: 자리와 방향이 모두 맞아야 풀린다. 졸업5는 짝이 거꾸로 나와서 뒤집거나 반대로 눕혀야 한다', () => {
  const plain = [...of(3, 'duo'), ...of(4, 'duo')], flipped = of(5, 'duo');
  assert.deepEqual([plain.length, flipped.length], [14, 8]);
  for (const l of [...plain, ...flipped]) {
    const [[a, c]] = l.pairs, [[x, rot]] = l.answer;
    assert.notEqual(a, c, l.id);
    const solved = solvedPlaces(l);
    assert.ok(solved.length >= 1 && solved.length <= 2, `${l.id}: 풀리는 자리 ${solved.length}개`);
    // 같은 자리에 색만 반대로 놓으면 안 풀린다
    const swapped = rot === 0 ? [x, 2] : rot === 2 ? [x, 0] : rot === 1 ? [x + 1, 3] : [x - 1, 1];
    assert.equal(playLesson(l, [swapped]).verdict, 'retry', `${l.id}: 방향이 반대`);
    assert.ok(!/줄/.test(l.text)); assert.equal(lessonStep(l, 0, 1), null);
    assert.match(lessonStep(l, 0, 2), /^도움말: .+·.+ 짝을 .+ 줄.*에 (세워서|뒤집어 세워서|눕혀서)\(.+(이|가) (아래|왼쪽|오른쪽)\) 놓아 봐!$/);
  }
  for (const l of plain) assert.ok([0, 1].includes(l.answer[0][1]), `${l.id}: 나온 그대로(또는 한 번 돌려서) 놓는다`);
  for (const l of flipped) { assert.ok([2, 3].includes(l.answer[0][1]), `${l.id}: 뒤집거나 반대로 눕힌다`); assert.match(l.title, /^뒤집어서 두 색 발화/); assert.match(l.text, /거꾸로 나왔어/); }
  // 방향 설명: 세워서는 아래 색, 눕혀서는 그 색이 왼쪽인지 오른쪽인지
  const say = l => lessonStep(l, 0, 2);
  const up = flipped.find(l => l.answer[0][1] === 2), left = flipped.find(l => l.answer[0][1] === 3);
  assert.match(say(up), /뒤집어 세워서/); assert.match(say(left), /눕혀서\(.+ 오른쪽\)/);
});

test('두 수·세 수 퍼즐을 혼자 풀기: 빈칸을 모두 채운 다음에 발화해야 하고, 두 번 틀리면 짝마다 도움말', () => {
  const list = [...of(4, 'two'), ...of(4, 'three'), ...of(5, 'two'), ...of(5, 'three')];
  assert.equal(list.length, 32);
  for (const l of list) {
    const k = l.pairs.length;
    assert.equal(l.steps, undefined); assert.equal(l.hints.length, k); assert.ok(!/줄/.test(l.text), l.id);
    assert.equal(lessonStep(l, 0, 1), null);
    l.hints.forEach((hint, i) => assert.match(hint, new RegExp(`^도움말 ${'①②③'[i]} .+ 짝을 .+ 줄.*에 .+ ${i < k - 1 ? '놓아\\.' : '내려 봐!'}$`), l.id));
    assert.equal(lessonStep(l, k - 1, 2), l.hints[k - 1]);
    // 발화를 먼저 하면(마지막 자리에 첫 짝) 끝까지 이어지지 않는다
    assert.notEqual(playLesson(l, [l.answer.at(-1), ...l.answer.slice(0, -1)]).verdict, 'done', l.id);
    assert.deepEqual(l.pairs.at(-1), [l.pairs.at(-1)[0], l.pairs.at(-1)[0]]); // 발화는 같은 색 짝
  }
  for (const l of of(5, 'two')) assert.notEqual(l.pairs[0][0], l.pairs[0][1], `${l.id}: 졸업5의 두 수 퍼즐은 첫 짝이 두 색`);
  // 두 수 퍼즐은 모든 자리(22 × 22)를 놓아 봐도 풀리는 길이 몇 개뿐이다
  for (const l of [...of(4, 'two'), ...of(5, 'two')]) {
    let solved = 0;
    for (const a of PLACES) for (const b of PLACES) if (playLesson(l, [a, b]).verdict === 'done') solved++;
    assert.ok(solved >= 1 && solved <= 12, `${l.id}: 풀리는 길 ${solved}개`);
  }
});

test('세 수·네 수 퍼즐(안내): 짝을 놓을 때마다 다음 자리를 알려 준다', () => {
  const list = [...of(3, 'three'), ...of(5, 'four')];
  assert.deepEqual(list.map(l => l.pairs.length), [3, 3, 3, 3, 3, 3, 4, 4, 4, 4]);
  for (const l of list) {
    const k = l.pairs.length;
    assert.equal(l.hints, undefined); assert.equal(l.steps.length, k);
    assert.deepEqual(l.steps.map(t => t.match(/[①-④]/)?.[0]), [...'①②③④'].slice(0, k));
    assert.match(l.steps[0], new RegExp(`^짝이 ${k === 3 ? '세' : '네'} 개야`)); assert.match(l.steps.at(-1), /발화! .+ 내려 봐/);
    assert.equal(lessonStep(l, 0), l.steps[0]); assert.equal(lessonStep(l, k - 1), l.steps[k - 1]);
    assert.match(l.title, k === 3 ? /^세 수 퍼즐 \d · \d+연쇄$/ : /^네 수 퍼즐 \d · \d+연쇄$/);
    // 순서를 바꿔 발화부터 하면 다시
    assert.notEqual(playLesson(l, [l.answer.at(-1), ...l.answer.slice(0, -1)]).verdict, 'done', l.id);
  }
});

test('방해 뿌요 속 발화점: 방해 뿌요가 낀 필드에서도 연쇄가 끝까지 가고, 방해 뿌요도 모두 같이 사라진다', () => {
  const list = [...of(3, 'dig'), ...of(4, 'dig'), ...of(5, 'dig')];
  assert.equal(list.length, 19);
  for (const l of list) {
    const count = lessonCells(l).filter(v => v === GARBAGE).length;
    assert.ok(count >= 2, l.id); assert.equal(l.goal.garbage, count, l.id);
    assert.match(l.text, new RegExp(`방해 뿌요 ${count}개`));
    const r = playLesson(l, l.answer);
    assert.deepEqual([r.verdict, r.garbage, r.allClear], ['done', count, true], l.id);
    const solved = solvedPlaces(l);
    assert.ok(solved.length >= 1 && solved.length <= 4, `${l.id}: 풀리는 자리 ${solved.length}개`);
    assert.ok(!/줄/.test(l.text)); assert.match(lessonStep(l, 0, 2), /^도움말: .+ 짝을 .+ 줄에 세워서 놓아 봐/);
  }
});

test('새 쌓기: 오른쪽 6연쇄, 오른쪽 끼워 넣기, 2층 쌓기 7연쇄(15번)와 8연쇄(18번). 시험은 같은 짝 순서로 안내 없이', () => {
  const by = id => GRADES.flatMap(g => g.lessons).find(l => l.id === id);
  for (const [id, chain, n] of [['grad3-right6', 6, 12], ['grad4-sandwich-r', 3, 7], ['grad4-build7', 7, 15], ['grad5-build8', 8, 18]]) {
    const l = by(id);
    assert.equal(l.field.length, 0); assert.equal(l.goal.chain, chain); assert.equal(l.goal.moves, n); assert.equal(l.pairs.length, n); assert.equal(l.answer.length, n);
    assert.deepEqual(l.steps.map(t => t.match(/[①-⑱]/)?.[0]), [...'①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱'].slice(0, n), id);
    const r = playLesson(l, l.answer);
    assert.deepEqual([r.verdict, r.chain, r.allClear], ['done', chain, true], id);
    for (let k = 1; k < n; k++) assert.equal(playLesson(l, l.answer.slice(0, k)).chain, 0, `${id}: ${k}번째까지는 아무것도 안 터진다`);
    assert.equal(playLesson(l, [...l.answer.slice(0, -1), [l.answer.at(-1)[0] === 0 ? 5 : 0, 0]]).verdict, 'retry', `${id}: 마지막 짝을 엉뚱한 데`);
    assert.ok(reachable(l), `${id}: 놓을 자리까지 가는 길이 열려 있다`);
  }
  // 오른쪽 6연쇄는 왼쪽 6연쇄를 거울처럼 뒤집은 것
  const left = by('grad2-scratch6'), right = by('grad3-right6');
  assert.deepEqual(right.pairs, left.pairs);
  assert.deepEqual(right.answer.map(([x, rot]) => [5 - x, rot]), left.answer.map(([x, rot]) => [x, rot === 1 ? 3 : rot]));
  // 2층 쌓기는 6연쇄 계단의 앞 열한 번을 그대로 쌓고 그 위에 올린다
  assert.deepEqual(by('grad4-build7').pairs.slice(0, 11), left.pairs.slice(0, 11)); assert.deepEqual(by('grad5-build8').answer.slice(0, 14), by('grad4-build7').answer.slice(0, 14));
  for (const [id, same] of [['grad4-exam6r', 'grad3-right6'], ['grad5-exam-sandwich-r', 'grad4-sandwich-r'], ['grad5-exam7', 'grad4-build7']]) {
    const l = by(id), guided = by(same);
    assert.equal(l.steps, undefined); assert.deepEqual(l.pairs, guided.pairs); assert.deepEqual(l.answer, guided.answer); assert.equal(l.goal.chain, guided.goal.chain);
    assert.ok(/안내 없이/.test(l.text) && !/①/.test(l.text));
    assert.equal(lessonStep(l, 0, 1), null);
    assert.match(lessonStep(l, 0, 2), /^조금 어렵지\? 이번에는 같이 하자! ①/);
    assert.equal(lessonStep(l, 1, 2), guided.steps[1]);
  }
});

test('초대연쇄 14 · 15 · 16연쇄: 자리를 알려 주고, 뿌요가 나오는 줄 가까이에 놓는다', () => {
  const megas = [...of(3, 'mega').slice(3), ...of(4, 'mega'), ...of(5, 'mega')];
  assert.deepEqual(chains(megas), [14, 14, 15, 15, 16]);
  for (const l of megas) {
    const [[x, rot]] = l.answer;
    assert.equal(rot, 0); assert.ok(Math.abs(x - 2) <= 1, `${l.id}: 셋째 줄 바로 옆까지만`);
    assert.match(l.text, /줄에 세워서 내려 봐/);
    assert.equal(lessonCells(l).filter(Boolean).length, l.goal.chain * 4 - 2); // 4개씩 딱 맞게 사라진다
    assert.equal(playLesson(l, [[x === 0 ? 5 : 0, 0]]).verdict, 'retry');
  }
});

// ---------- 졸업6 ~ 졸업10 ----------
// 인혁이 기획서 「뿌요뿌요 (업그레이드)」(2026-10-09) 3번: "졸업 6,7,8,9,10 까지 만들어줘 이렇게" + 그림(졸업8 100가지, 졸업9 130가지, 졸업10 150가지)
const LONG = [6, 7, 8, 9, 10];
const longLessons = () => LONG.flatMap(n => grad(n).lessons);
// 등급의 차례를 "tip find*8 tip flat*6 …" 처럼 줄여서
const shape = n => grad(n).lessons.map(kind).reduce((runs, k) => { const last = runs.at(-1); if (last && last[0] === k) last[1]++; else runs.push([k, 1]); return runs; }, []).map(([k, c]) => (c > 1 ? `${k}*${c}` : k)).join(' ');
const ofLong = k => LONG.flatMap(n => of(n, k));

test('졸업6 ~ 졸업10: 75, 85, 100, 130, 150가지 (졸업8 · 9 · 10 은 기획서 그림에 적힌 수) 이고, 모두 열일곱 등급 831가지', () => {
  assert.deepEqual(GRADES.slice(12).map(g => [g.id, g.name, g.lessons.length]), [['grad6', '졸업6', 75], ['grad7', '졸업7', 85], ['grad8', '졸업8', 100], ['grad9', '졸업9', 130], ['grad10', '졸업10', 150]]);
  assert.equal(GRADES.length, 17);
  assert.deepEqual(SCHOOL_IDS.slice(-5), ['grad6', 'grad7', 'grad8', 'grad9', 'grad10']);
  assert.equal(GRADES.reduce((n, g) => n + g.lessons.length, 0), 831);
  const ids = GRADES.flatMap(g => g.lessons.map(l => l.id));
  assert.equal(new Set(ids).size, ids.length);
  // 부 구성: 부마다 안내 장 하나, 그다음 그 종류의 문제들. 맨 끝은 비결과 수료증(졸업장)
  assert.equal(shape(6), 'tip find*8 tip flat*6 tip duo*6 tip two*7 tip three*6 tip four*6 tip five*4 tip dig*6 tip digflat*4 tip copy*2 exam tip mega*2 tip*6');
  assert.equal(shape(7), 'tip find*8 tip flip*7 tip two*8 tip digtwo*6 tip three*7 tip four*6 tip five*6 tip six*4 tip flat*5 tip dig*5 tip right exam7r copy tip mega*2 tip*6');
  assert.equal(shape(8), 'tip find*9 tip flat*7 tip duo*8 tip two*9 tip three*9 tip four*7 tip five*5 tip six*4 tip dig*7 tip digflat*4 tip digtwo*5 tip right exam8r copy*2 tip mega*3 tip*6');
  assert.equal(shape(9), 'tip find*10 tip flat*8 tip duo*8 tip flip*8 tip two*10 tip three*10 tip four*8 tip five*8 tip six*6 tip seven*4 tip dig*8 tip digflat*6 tip digtwo*6 tip copy again copy*2 tip mega*4 tip*7');
  assert.equal(shape(10), 'tip find*12 tip flat*9 tip duo*9 tip flip*9 tip two*12 tip three*12 tip four*10 tip five*8 tip six*8 tip seven*6 tip dig*9 tip digflat*6 tip digtwo*7 tip copy again copy again copy tip mega*4 tip*9');
  // 부 안내 장: 첫 장은 "졸업N · 몇 번째 졸업", 그 뒤는 "k부 · 이름". 부 수는 11, 12, 13, 15, 15
  for (const [n, parts, ordinal] of [[6, 11, '여섯'], [7, 12, '일곱'], [8, 13, '여덟'], [9, 15, '아홉'], [10, 15, '열']]) {
    const heads = grad(n).lessons.filter(l => /-part\d+$/.test(l.id));
    assert.equal(heads.length, parts, `졸업${n}`);
    assert.equal(heads[0].title, `졸업${n} · ${ordinal} 번째 졸업`);
    heads.slice(1).forEach((l, i) => assert.match(l.title, new RegExp(`^${i + 2}부 · `), l.id));
    assert.match(heads[0].text, new RegExp(`${grad(n).lessons.length}가지`), `졸업${n}: 첫 장에 걸음 수`);
    assert.match(heads[0].text, / 1부는 발화점 찾기 \d+판 \(\d+~\d+연쇄\)부터!$/, `졸업${n}: 첫 장은 등급 소개와 1부 이름`);
    assert.ok(Math.max(...grad(n).lessons.map(l => (l.text || '').length)) <= 170, `졸업${n}: 말풍선 글이 예전 등급보다 길지 않다`);
    // 안내 장 다음에는 언제나 문제가 온다 (부가 비어 있지 않다)
    for (const l of heads) assert.ok(!grad(n).lessons[grad(n).lessons.indexOf(l) + 1].tip, l.id);
  }
  // 문제를 틀로 만든 부는 판 수와 연쇄 수를 알려 준다
  assert.match(grad(8).lessons.find(l => l.id === 'grad8-part4').text, / 9판 \(10~15연쇄\)\.$/);
  for (const l of longLessons()) {
    assert.ok(!/젤리/.test(JSON.stringify(l)), `${l.id}: 화면 글은 뿌요로만 쓴다 (앱 빌드가 바꾼다)`);
    assert.ok(!/undefined|NaN|\[object/.test(JSON.stringify(l)), `${l.id}: 틀이 빠진 글이 없다`);
  }
});

test('진짜 끝은 졸업10: 졸업5 다음에 졸업6 → 7 → 8 → 9 → 10 순서로 열리고, 맨 끝에 진짜 졸업장. 선물은 갈수록 크다', () => {
  const p = sanitize({ tutorial: true, school: ['middle', 'high', 'master', 'ultra', 'final', 'real', 'grad1', 'grad2', 'grad3', 'grad4', 'grad5'] });
  assert.deepEqual([11, 12, 13].map(i => [gradeDone(p, i), gradeOpen(p, i)]), [[true, true], [false, true], [false, false]]);
  for (const i of [12, 13, 14, 15, 16]) { assert.equal(gradeOpen(p, i), true); assert.equal(finishGrade(p, i), true); assert.equal(finishGrade(p, i), false); }
  assert.deepEqual(sanitize(JSON.parse(JSON.stringify(p))).school.slice(-5), ['grad6', 'grad7', 'grad8', 'grad9', 'grad10']);
  assert.ok(JSON.stringify(p.school).length < 200); // 클라우드 저장(32KB)에 등급 이름 열여섯 개만
  assert.deepEqual(Object.keys(sanitize(p)).sort(), Object.keys(sanitize({})).sort()); // 기록에 새 칸은 없다
  // 맨 끝 장
  const last = grad(10).lessons.at(-1);
  assert.equal(last.id, 'grad10-diploma'); assert.equal(last.title, '🎓 진짜 졸업장');
  assert.match(last.text, /초급부터 졸업10까지 뿌요뿌요 배우기 열일곱 단계 831가지를 모두 마쳤습니다/);
  assert.match(grad(9).lessons.at(-1).text, /진짜 마지막, 졸업10만 남았어/);
  for (const n of [6, 7, 8]) assert.match(grad(n).lessons.at(-1).text, new RegExp(`다음은 .*졸업${n + 1}이?야!$`));
  // 졸업 ~ 졸업5 는 이제 끝이 아니다 (id 는 그대로, 글만 고침)
  assert.match(GRADES[7].lessons[0].text, /졸업은 열 번 있어\(졸업부터 졸업10까지\)/);
  assert.match(grad(5).lessons.at(-1).text, /졸업6부터 졸업10까지도 열렸어/);
  assert.equal(grad(5).lessons.at(-1).id, 'grad5-diploma');
  for (const l of GRADES.slice(7, 12).flatMap(g => g.lessons)) assert.ok(!/진짜 졸업장|진짜 끝|진짜 마지막|마지막 졸업|마지막 비결/.test(l.title + (l.text || '')), `${l.id}: 졸업5 가 끝인 것처럼 말하지 않는다`);
  assert.deepEqual(grad(5).lessons.filter(l => /^grad5-tip/.test(l.id)).map(l => l.title.slice(0, 8)), [...'①②③④⑤⑥⑦'].map(m => `대박사 비결 ${m}`));
  // 선물과 이모지
  assert.deepEqual(GRADES.slice(11).map(g => g.reward.coins), [60000, 80000, 100000, 130000, 170000, 250000]);
  for (const [a, b] of GRADES.slice(12).map((g, i) => [GRADES[11 + i], g])) for (const k of ['pet', 'boost', 'skin', 'effect']) assert.ok(a.reward.tickets[k] < b.reward.tickets[k], `${b.name}: ${k}`);
  assert.equal(new Set(GRADES.map(g => g.emoji)).size, GRADES.length);
  for (const g of GRADES.slice(12)) assert.ok(g.desc.length > 20 && g.desc.length < 140, g.name);
});

test('졸업6 ~ 졸업10 의 판 421개: school-puzzles 세 파일을 통틀어 모두 다르고, 알려 준 대로 놓으면 적힌 연쇄가 나와 전소로 끝난다', () => {
  const fresh = Object.values(SETS3).flat().filter(b => b.field.length);
  assert.equal(Object.values(SETS3).flat().length, 432); assert.equal(fresh.length, 421);
  const every = [...Object.values(boards1).flat(), ...Object.values(boards).flat(), ...fresh].map(b => b.field.join('/'));
  assert.equal(every.length, 44 + 122 + 421); assert.equal(new Set(every).size, every.length);
  const lessons = longLessons().filter(l => !l.tip && l.field.length);
  assert.equal(lessons.length, 421); assert.equal(new Set(lessons.map(l => l.field)).size, 421); // 판마다 문제 하나
  for (const l of lessons) {
    const cells = lessonCells(l), h = heights(cells), tall = l.goal.chain >= 17;
    assert.equal(findGroups(cells).length, 0, l.id);
    for (let x = 0; x < 6; x++) for (let y = 1; y < 12; y++) if (cells[y * W + x]) assert.ok(cells[(y - 1) * W + x], `${l.id}: 떠 있는 뿌요가 없다`);
    // 17 · 18연쇄는 필드를 꼭대기까지 채운다 (셋째 줄만 두 칸 넘게 비워 둔다). 그 밖의 판은 예전과 같은 높이
    if (tall) assert.ok(h[2] <= 10 && Math.max(...h) <= 12, `${l.id}: 높이`); else assert.ok(h[2] <= 9 && Math.max(...h) <= 11, `${l.id}: 높이`);
    if (tall || l.goal.chain === 16) assert.deepEqual(l.answer, [[2, 0]], `${l.id}: 꽉 찬 필드는 나온 자리 그대로 내린다`); else assert.ok(reachable(l), `${l.id}: 놓을 자리까지 가는 길이 열려 있다`);
    assert.equal(l.answer.length, l.pairs.length, l.id); assert.equal(l.goal.moves, l.pairs.length, l.id);
    const r = playLesson(l, l.answer);
    assert.deepEqual([r.verdict, r.chain, r.allClear], ['done', l.goal.chain, true], l.id);
    assert.equal(lessonCells(l).filter(v => v && v !== GARBAGE).length, l.goal.chain * 4 - l.pairs.length * 2, `${l.id}: 4개씩 딱 맞게 사라진다`);
    // 마지막 짝을 놓기 전에는 아무것도 터지지 않는다
    for (let n = 1; n < l.answer.length; n++) assert.deepEqual(playLesson(l, l.answer.slice(0, n)), { verdict: null, chain: 0, allClear: false, garbage: 0 }, `${l.id}: ${n}번째까지`);
  }
});

test('졸업6 ~ 졸업10 의 한 수 퍼즐(발화점 찾기, 눕혀서 발화, 두 색 발화, 방해 뿌요 속): 풀리는 자리는 몇 곳뿐이고, 자리는 두 번 틀린 뒤에 알려 준다', () => {
  const finds = ofLong('find'), flats = ofLong('flat'), duos = [...ofLong('duo'), ...ofLong('flip')], digs = ofLong('dig'), digflats = ofLong('digflat');
  assert.deepEqual([finds.length, flats.length, duos.length, digs.length, digflats.length], [47, 35, 55, 35, 20]);
  // 뒤로 갈수록 길어진다
  assert.deepEqual(chains(of(6, 'find')), [11, 11, 12, 12, 13, 13, 14, 14]); assert.deepEqual(chains(of(10, 'find')), [13, 13, 14, 14, 14, 14, 15, 15, 15, 15, 16, 16]);
  assert.deepEqual(chains(of(6, 'flat')), [8, 9, 9, 10, 11, 12]); assert.deepEqual(chains(of(10, 'flat')), [10, 10, 11, 11, 11, 12, 12, 12, 13]);
  assert.deepEqual(chains(of(6, 'digflat')), [6, 7, 8, 9]); assert.deepEqual(chains(of(10, 'dig')), [12, 12, 13, 13, 13, 14, 14, 14, 14]);
  for (const l of [...finds, ...flats, ...duos, ...digs, ...digflats]) {
    assert.equal(l.pairs.length, 1, l.id); assert.equal(l.hints.length, 1, l.id); assert.equal(l.steps, undefined, l.id);
    assert.ok(!/줄/.test(l.text), `${l.id}: 문제 글에는 자리가 없다`);
    assert.equal(lessonStep(l, 0, 1), null); assert.match(lessonStep(l, 0, 2), /^도움말: .+ 짝을 .+ 줄.*에 .+ 놓아 봐/, l.id);
    const solved = solvedPlaces(l), [[x, rot]] = l.answer;
    assert.ok(solved.some(([sx, sr]) => sx === x && sr === rot), `${l.id}: 적어 둔 자리로 풀린다`);
    assert.ok(solved.length <= 4, `${l.id}: 풀리는 자리 ${solved.length}개`);
  }
  for (const l of [...finds, ...digs]) { assert.equal(l.pairs[0][0], l.pairs[0][1]); assert.equal(l.answer[0][1], 0, `${l.id}: 세워서`); }
  // 눕혀야만 풀린다
  for (const l of [...flats, ...digflats]) {
    assert.equal(l.pairs[0][0], l.pairs[0][1]); assert.equal(l.answer[0][1], 1);
    assert.ok(solvedPlaces(l).every(([, rot]) => rot === 1 || rot === 3), `${l.id}: 세워서는 안 풀린다`);
    assert.match(lessonStep(l, 0, 2), /줄과 .+ 줄에 눕혀서 놓아 봐/);
  }
  // 두 색 발화: 같은 자리에 색만 반대로 놓으면 안 풀린다. flip 은 짝이 거꾸로 나온다 (졸업8 은 번갈아)
  for (const l of duos) {
    const [[a, c]] = l.pairs, [[x, rot]] = l.answer;
    assert.notEqual(a, c, l.id); assert.ok(solvedPlaces(l).length <= 2, l.id);
    const swapped = rot === 0 ? [x, 2] : rot === 2 ? [x, 0] : rot === 1 ? [x + 1, 3] : [x - 1, 1];
    assert.equal(playLesson(l, [swapped]).verdict, 'retry', `${l.id}: 방향이 반대`);
    assert.equal(/^뒤집어서 두 색 발화/.test(l.title), rot >= 2, l.id); assert.equal(/거꾸로 나왔어/.test(l.text), rot >= 2, l.id);
  }
  for (const l of ofLong('flip')) assert.ok(l.answer[0][1] >= 2, l.id);
  for (const n of [6, 9, 10]) for (const l of of(n, 'duo')) assert.ok(l.answer[0][1] <= 1, l.id);
  assert.deepEqual(of(8, 'duo').map(l => l.answer[0][1] >= 2), [false, true, false, true, false, true, false, true]);
  // 방해 뿌요: 적힌 수만큼 끼어 있고 연쇄와 함께 모두 사라진다
  for (const l of [...digs, ...digflats]) {
    const count = lessonCells(l).filter(v => v === GARBAGE).length;
    assert.ok(count >= 2, l.id); assert.equal(l.goal.garbage, count, l.id); assert.match(l.text, new RegExp(`방해 뿌요 ${count}개`));
    assert.equal(playLesson(l, l.answer).garbage, count, l.id);
  }
});

test('졸업6 ~ 졸업10 의 여러 수 퍼즐: 두 수부터 일곱 수까지. 빈칸을 모두 채운 다음에 발화해야 하고, 처음 나오는 다섯·여섯·일곱 수는 안내해 준다', () => {
  const NAMES = { two: [2, '두'], three: [3, '세'], four: [4, '네'], five: [5, '다섯'], six: [6, '여섯'], seven: [7, '일곱'] };
  const counts = Object.fromEntries(Object.keys(NAMES).map(k => [k, ofLong(k).length]));
  assert.deepEqual(counts, { two: 46, three: 44, four: 37, five: 31, six: 22, seven: 10 });
  const guided = ['grad6-five', 'grad7-six', 'grad9-seven']; // 처음 나오는 등급에서는 짝마다 다음 자리를 알려 준다
  for (const [key, [k, word]] of Object.entries(NAMES)) for (const l of ofLong(key)) {
    assert.equal(l.pairs.length, k, l.id); assert.match(l.title, new RegExp(`^${word} 수 퍼즐 \\d+ · \\d+연쇄$`), l.id);
    assert.deepEqual(l.pairs.at(-1), [l.pairs.at(-1)[0], l.pairs.at(-1)[0]], `${l.id}: 발화는 같은 색 짝`);
    assert.notEqual(playLesson(l, [l.answer.at(-1), ...l.answer.slice(0, -1)]).verdict, 'done', `${l.id}: 발화를 먼저 하면 끝까지 이어지지 않는다`);
    if (guided.some(prefix => l.id.startsWith(prefix))) {
      assert.equal(l.hints, undefined, l.id); assert.equal(l.steps.length, k);
      assert.deepEqual(l.steps.map(t => t.match(/[①-⑦]/)?.[0]), [...'①②③④⑤⑥⑦'].slice(0, k));
      assert.match(l.steps[0], new RegExp(`^짝이 ${word} 개야`)); assert.match(l.steps.at(-1), /발화! .+ 내려 봐/);
    } else {
      assert.equal(l.steps, undefined, l.id); assert.equal(l.hints.length, k, l.id); assert.ok(!/줄/.test(l.text), l.id);
      assert.equal(lessonStep(l, 0, 1), null);
      l.hints.forEach((hint, i) => assert.match(hint, new RegExp(`^도움말 ${'①②③④⑤⑥⑦'[i]} .+ 짝을 .+ 줄.*에 .+ ${i < k - 1 ? '놓아\\.' : '내려 봐!'}$`), l.id));
    }
  }
  assert.deepEqual(chains(of(6, 'four')), [7, 7, 8, 8, 9, 10]); assert.deepEqual(chains(of(10, 'seven')), [8, 8, 9, 9, 10, 10]);
  for (const n of [7, 9]) for (const l of of(n, 'two')) assert.notEqual(l.pairs[0][0], l.pairs[0][1], `${l.id}: 첫 짝이 두 색`);
  // 두 수 퍼즐은 순서를 바꾸면 중간에 끊긴다. 모든 자리(22 × 22)를 놓아 봐도 풀리는 길은 몇 개뿐 (등급마다 첫 판으로 확인)
  for (const l of ofLong('two')) assert.equal(playLesson(l, [l.answer[1], l.answer[0]]).verdict, 'retry', l.id);
  for (const n of LONG) {
    const l = of(n, 'two')[0];
    let solved = 0;
    for (const a of PLACES) for (const b of PLACES) if (playLesson(l, [a, b]).verdict === 'done') solved++;
    assert.ok(solved >= 1 && solved <= 12, `${l.id}: 풀리는 길 ${solved}개`);
  }
  // 방해 뿌요 속 두 수 퍼즐: 방해 뿌요까지 모두 사라져야 성공
  const digtwos = ofLong('digtwo');
  assert.equal(digtwos.length, 24);
  for (const l of digtwos) {
    const count = lessonCells(l).filter(v => v === GARBAGE).length;
    assert.ok(count >= 2, l.id); assert.deepEqual(l.goal, { chain: l.goal.chain, garbage: count, moves: 2 }, l.id);
    assert.equal(playLesson(l, l.answer).garbage, count, l.id);
    assert.equal(playLesson(l, [l.answer[1], l.answer[0]]).verdict, 'retry', `${l.id}: 순서를 바꾸면 끊긴다`);
    assert.ok(!/줄/.test(l.text)); assert.match(lessonStep(l, 0, 2), /^도움말 ① /); assert.match(lessonStep(l, 1, 2), /^도움말 ② .+ 내려 봐!$/);
  }
});

test('졸업6 ~ 졸업10 의 쌓기: 보고 따라 쌓기(6~10연쇄, 스무 번까지), 한 번 더 쌓기, 오른쪽 2층 쌓기 7 · 8연쇄와 시험', () => {
  const by = id => GRADES.flatMap(g => g.lessons).find(l => l.id === id);
  const MARKS = [...'①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'];
  const copies = ofLong('copy');
  assert.deepEqual(copies.map(l => [l.id, l.goal.chain, l.pairs.length]), [['grad6-copy1', 6, 12], ['grad6-copy2', 7, 14], ['grad7-copy1', 8, 16], ['grad8-copy1', 9, 18], ['grad8-copy2', 9, 18],
    ['grad9-copy1', 7, 14], ['grad9-copy2', 10, 20], ['grad9-copy3', 10, 20], ['grad10-copy1', 6, 12], ['grad10-copy2', 8, 16], ['grad10-copy3', 10, 20]]);
  assert.equal(new Set(copies.map(l => JSON.stringify([l.pairs, l.answer]))).size, copies.length); // 모양이 모두 다르다
  const builds = [...copies, by('grad7-right7'), by('grad8-right8')];
  for (const l of builds) {
    const n = l.pairs.length;
    assert.equal(l.field.length, 0, l.id); assert.equal(l.goal.moves, n); assert.equal(l.answer.length, n); assert.equal(l.steps.length, n);
    assert.deepEqual(l.steps.map(t => t.match(/[①-⑳]/)?.[0]), MARKS.slice(0, n), l.id);
    assert.match(l.steps.at(-1), /발화! .+ 내려 봐\.$/);
    const r = playLesson(l, l.answer);
    assert.deepEqual([r.verdict, r.chain, r.allClear], ['done', l.goal.chain, true], l.id);
    for (let k = 1; k < n; k++) assert.equal(playLesson(l, l.answer.slice(0, k)).chain, 0, `${l.id}: ${k}번째까지는 아무것도 안 터진다`);
    assert.equal(playLesson(l, [...l.answer.slice(0, -1), [l.answer.at(-1)[0] === 0 ? 5 : 0, 0]]).verdict, 'retry', `${l.id}: 마지막 짝을 엉뚱한 데`);
    assert.ok(reachable(l), `${l.id}: 놓을 자리까지 가는 길이 열려 있다`);
  }
  for (const l of copies) { assert.match(l.title, /^보고 따라 쌓기 \d · \d+연쇄$/); assert.match(l.steps[0], new RegExp(`^처음 보는 모양의 ${l.goal.chain}연쇄! ${l.pairs.length}번 놓아\\. ① `)); }
  // 오른쪽 2층 쌓기는 왼쪽 2층 쌓기를 거울처럼 뒤집은 것
  for (const [right, left] of [['grad7-right7', 'grad4-build7'], ['grad8-right8', 'grad5-build8']]) {
    assert.deepEqual(by(right).pairs, by(left).pairs);
    assert.deepEqual(by(right).answer.map(([x, rot]) => [5 - x, rot]), by(left).answer.map(([x, rot]) => [x, rot === 1 ? 3 : rot]));
  }
  // 시험과 한 번 더 쌓기: 같은 짝 순서로 안내 없이. 두 번 틀리면 같이 한다
  for (const [id, same] of [['grad6-exam8', 'grad5-build8'], ['grad7-exam7r', 'grad7-right7'], ['grad8-exam8r', 'grad8-right8'], ['grad9-again1', 'grad9-copy1'], ['grad10-again1', 'grad10-copy1'], ['grad10-again2', 'grad10-copy2']]) {
    const l = by(id), guided = by(same);
    assert.equal(l.steps, undefined, id); assert.deepEqual(l.pairs, guided.pairs); assert.deepEqual(l.answer, guided.answer); assert.equal(l.goal.chain, guided.goal.chain);
    assert.ok(/안내 없이|안내가 없어/.test(l.text) && !/①/.test(l.text), id);
    assert.equal(lessonStep(l, 0, 1), null);
    assert.match(lessonStep(l, 0, 2), /^조금 어렵지\? 이번에는 같이 하자! ①/);
    assert.equal(lessonStep(l, 1, 2), guided.steps[1]);
    assert.equal(playLesson(l, l.answer).verdict, 'done', id);
  }
  // 한 번 더 쌓기는 따라 쌓은 바로 다음에 나온다
  for (const [n, k] of [[9, 1], [10, 1], [10, 2]]) { const list = grad(n).lessons; assert.equal(list[list.findIndex(l => l.id === `grad${n}-copy${k}`) + 1].id, `grad${n}-again${k}`); }
});

test('졸업6 ~ 졸업10 의 초대연쇄: 16연쇄 한 판, 17연쇄 아홉 판, 가장 긴 18연쇄 다섯 판. 나온 자리(셋째 줄)에 그대로 내린다', () => {
  const megas = ofLong('mega');
  assert.deepEqual(LONG.map(n => chains(of(n, 'mega'))), [[16, 17], [17, 17], [17, 17, 18], [17, 17, 18, 18], [17, 17, 18, 18]]);
  for (const l of megas) {
    assert.deepEqual(l.answer, [[2, 0]]); assert.equal(l.hints, undefined);
    assert.match(l.text, new RegExp(`셋째 줄에 세워서 내려 봐\\. ${l.goal.chain}연쇄`));
    assert.equal(playLesson(l, [[0, 0]]).verdict, 'retry', l.id);
  }
  // 18연쇄: 필드 72칸에서 셋째 줄 꼭대기 두 칸만 비어 있다 (이보다 긴 연쇄는 필드에 들어가지 않는다)
  for (const l of megas.filter(m => m.goal.chain === 18)) assert.deepEqual(Array.from(heights(lessonCells(l))), [12, 12, 10, 12, 12, 12], l.id);
});
