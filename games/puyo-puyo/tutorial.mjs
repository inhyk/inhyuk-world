// 처음 하는 사람을 위한 연습하기. 꼬마 뿌요가 알려 주는 세 가지만 해 보면 바로 타워에 도전할 수 있다.
// field: parseField 모양 (위에서 아래 줄 순서, R G B Y P), pairs: 차례로 나올 뿌요 짝 (끝나면 처음부터 다시)
import { parseField } from './core.mjs';

export const LESSONS = [
  {
    id: 'move', title: '옮기고 돌리기',
    touch: '◀ ▶ 로 옮기고 ↻ ↺ 로 돌려 봐. ⤓ 를 누르면 바로 떨어져! 3번 내려놓아 보자.',
    keys: '← → 로 옮기고 ↑ 나 Z 로 돌려 봐. Space 를 누르면 바로 떨어져! 3번 내려놓아 보자.',
    goal: { pieces: 3 }, field: [], pairs: [[1, 2], [3, 3], [4, 1], [2, 3]],
    done: '좋아! 뿌요 짝을 마음대로 움직일 수 있어.',
  },
  {
    id: 'pop', title: '같은 색 4개면 퐁!',
    text: '빨간 뿌요 2개를 바닥의 빨간 뿌요 옆이나 위에 붙여 봐. 같은 색 4개가 이어지면 터져!',
    goal: { pop: 1 }, field: ['RR....'], pairs: [[1, 1]],
    retry: '아깝다! 빨간 뿌요끼리 4개가 닿아야 터져. 다시 해 보자.',
    done: '퐁! 같은 색 4개를 이으면 이렇게 사라져.',
  },
  {
    id: 'chain', title: '연쇄 만들기',
    text: '빨간 뿌요를 맨 왼쪽 줄에 내려 봐. 빨강이 터지면 초록이 떨어지면서 또 터져!',
    goal: { chain: 2 }, field: ['.G....', '.RG...', 'RRGG..'], pairs: [[1, 1]],
    retry: '거의 다 왔어! 빨간 뿌요를 맨 왼쪽 줄에 놓아 봐.',
    done: '2연쇄! 연쇄가 길수록 점수가 쑥쑥, 상대에게 방해 뿌요도 많이 날아가.',
  },
];

export const lessonCells = lesson => parseField(lesson.field);
// 연습 판의 짝 순서. 정해 둔 짝이 없으면 원래 순서를 그대로 쓴다.
export const lessonSeq = (lesson, base) => (lesson.pairs ? { ...base, puyos: lesson.pairs.flat() } : base);

export function newJudge() { return { pieces: 0, pending: false, misses: 0 }; }
// 게임 사건 하나를 보고 연습 목표를 이뤘는지 본다: 'done'(성공) | 'retry'(다시) | null(계속)
export function judge(lesson, state, e) {
  const goal = lesson.goal;
  if (e.type === 'lock') {
    state.pieces++;
    state.pending = true;
    if (goal.pieces && state.pieces >= goal.pieces) return 'done';
  } else if (e.type === 'chainEnd') {
    state.pending = false;
    if (goal.pop) return 'done';
    if (goal.chain) return e.chain >= goal.chain ? 'done' : 'retry';
  } else if (e.type === 'spawn' && state.pending) {
    // 내려놓은 뿌요가 아무것도 터뜨리지 못하고 다음 짝이 나왔다
    state.pending = false;
    if (!goal.pieces && ++state.misses >= 2) return 'retry';
  }
  return null;
}
