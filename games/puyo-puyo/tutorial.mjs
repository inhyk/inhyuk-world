// 뿌요뿌요 배우기. 꼬마 뿌요가 알려 주는 것을 직접 해 보면서 배운다.
// 처음에는 연습하기 세 가지(초급)만 있었고, 인혁이 기획서 「뿌요뿌요 (업그레이드)」 5번
// "뿌요뿌요 배우는 데도 만들어줘. 그리고 초급 → 중급 → 상급 → 최상급 순으로 해줘" 로 네 등급이 됐다.
// 같은 날 "초초상급, 그다음에 마지막도 만들어주고 마지막은 초급 중급 상급 최상급 초초상급을 복습하는 시간,
// 그리고 마지막에 진짜 연쇄를 잘하는 법을 알려줘" 로 여섯 등급이 됐다.
// 그리고 "찐 마지막까지 만들어줘, 찐 마지막은 엄청 길게 해줘" 로 일곱 번째 등급 「찐 마지막」(30가지)이 생겼다.
// 앞 등급을 끝내야 다음 등급이 열린다.
// field: parseField 모양 (위에서 아래 줄 순서, R G B Y P, O 는 방해 뿌요), pairs: 차례로 나올 뿌요 짝 (끝나면 처음부터 다시)
// goal: pieces(몇 번 내려놓기) | pop(터뜨리기) | chain(몇 연쇄) · allClear(전소) · colors(한 번에 몇 색) · garbage(방해 뿌요 몇 개 지우기)
//       moves: 몇 번 안에 해야 하나 (안 적으면 두 번 놓칠 때까지). 짝 [a, c] 는 처음에 a 가 아래, c 가 위로 나온다.
// steps: 짝을 하나 놓을 때마다 바뀌는 안내 (처음부터 직접 쌓는 수업). tip: 풀 것 없이 읽고 넘어가는 비결 (필드는 보기 그림).
// hints: 안내 없이 혼자 푸는 시험에서, 두 번 틀린 뒤부터 보여 주는 안내 (steps 와 같은 모양).
import { parseField } from './core.mjs';

const BEGINNER = [
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

const MIDDLE = [
  {
    id: 'stairs3', title: '계단 쌓기 3연쇄',
    text: '뿌요가 계단처럼 쌓여 있어. 빨강이 아래, 초록이 위인 그대로 맨 왼쪽 줄에 내려 봐. 퐁퐁퐁 3연쇄!',
    goal: { chain: 3, moves: 1 }, field: ['.B....', 'RGB...', 'RGB...', 'RGB...'], pairs: [[1, 2]],
    retry: '아깝다! 돌리지 말고 빨강이 아래로 가게 맨 왼쪽 줄에 놓아 봐.',
    done: '3연쇄! 이렇게 한 줄씩 옆으로 쌓는 걸 계단 쌓기라고 해.',
  },
  {
    id: 'double', title: '두 색을 한 번에',
    text: '빨강과 초록을 한 번에 터뜨려 보자. 짝을 옆으로 눕혀서(빨강이 왼쪽) 빨강은 빈칸에, 초록은 노랑 위에 놓아 봐!',
    goal: { colors: 2, moves: 1 }, field: ['.....G', '.....G', 'RRR.YG'], pairs: [[1, 2]],
    retry: '아깝다! 한 번 돌려서 눕힌 다음, 빨강은 빨강 옆 빈칸에 초록은 노랑 위에 가게 놓아 봐.',
    done: '두 색 동시에 퐁! 여러 색을 한 번에 터뜨리면 점수를 더 받아.',
  },
  {
    id: 'garbage', title: '방해 뿌요 치우기',
    text: '회색 방해 뿌요는 혼자서는 안 터져. 바로 옆에서 뿌요가 터지면 같이 사라져! 빨강을 터뜨려 봐.',
    goal: { garbage: 3, moves: 1 }, field: ['OOO...', 'RRR.O.'], pairs: [[1, 1]],
    retry: '아깝다! 빨간 뿌요 옆 빈칸에 빨강을 세워서 놓아 봐.',
    done: '방해 뿌요가 싹 사라졌어! 방해 뿌요가 쌓이면 그 옆에서 터뜨리면 돼.',
  },
];

const HIGH = [
  {
    id: 'stairs4', title: '계단 쌓기 4연쇄',
    text: '이번에는 계단이 네 칸! 빨강이 아래로 가게 맨 왼쪽 줄에 내려서 4연쇄를 터뜨려 봐.',
    goal: { chain: 4, moves: 1 }, field: ['.BY...', 'RGBY..', 'RGBY..', 'RGBY..'], pairs: [[1, 2]],
    retry: '아깝다! 빨강이 아래, 초록이 위인 채로 맨 왼쪽 줄에 놓아 봐.',
    done: '4연쇄! 방해 뿌요가 우수수 날아가는 큰 공격이야.',
  },
  {
    id: 'build3', title: '직접 쌓아서 3연쇄',
    text: '계단이 한 칸 모자라. ① 파랑·노랑 짝을 둘째 줄(초록 위)에 세워서 놓고 ② 빨강·초록 짝을 맨 왼쪽 줄에 내려 봐!',
    goal: { chain: 3, moves: 2 }, field: ['RGB...', 'RGB...', 'RGB...'], pairs: [[3, 4], [1, 2]],
    retry: '아깝다! 먼저 파랑이 초록 바로 위에 오게 놓고, 그다음에 빨강을 맨 왼쪽 줄에 놓아 봐.',
    done: '직접 쌓아서 3연쇄! 위에 올려 둔 뿌요가 떨어지면서 다음 색을 이어 줘.',
  },
  {
    id: 'allclear', title: '전소 (모두 지우기)',
    text: '필드의 뿌요를 하나도 남기지 않으면 전소! 짝을 돌리지 말고 그대로, 뿌요들 바로 오른쪽 빈칸에 내려 봐.',
    goal: { allClear: true, moves: 1 }, field: ['GGG...', 'RRR...'], pairs: [[1, 2]],
    retry: '아깝다! 빨강이 아래, 초록이 위인 채로 뿌요들 바로 오른쪽 빈칸에 놓아 봐.',
    done: '전소! 필드를 싹 비우면 다음 연쇄에 방해 뿌요 30개가 더 날아가.',
  },
];

const MASTER = [
  {
    id: 'stairs5', title: '다섯 색 5연쇄',
    text: '다섯 가지 색 계단이야. 빨강이 아래로 가게 맨 왼쪽 줄에 내리면… 5연쇄!',
    goal: { chain: 5, moves: 1 }, field: ['.BYP..', 'RGBYP.', 'RGBYP.', 'RGBYP.'], pairs: [[1, 2]],
    retry: '아깝다! 빨강이 아래, 초록이 위인 채로 맨 왼쪽 줄에 놓아 봐.',
    done: '5연쇄! 타워 챌린지 "5연쇄 하기"도 이렇게 하면 돼.',
  },
  {
    id: 'build4', title: '직접 쌓아서 4연쇄',
    text: '① 파랑 짝을 둘째 줄(초록 위)에 세워서 놓고 ② 빨강·초록 짝을 맨 왼쪽 줄에 내려서 4연쇄를 만들어 봐!',
    goal: { chain: 4, moves: 2 }, field: ['..Y...', 'RGBY..', 'RGBY..', 'RGBY..'], pairs: [[3, 3], [1, 2]],
    retry: '아깝다! 파랑 짝을 초록 줄 위에 세워서 올리고, 그다음에 빨강을 맨 왼쪽 줄에 놓아 봐.',
    done: '4연쇄를 직접 만들었어! 이제 진짜 대전에서도 계단을 쌓아 봐.',
  },
  {
    id: 'clear3', title: '3연쇄로 전소',
    text: '마지막 문제! ① 파랑 짝을 둘째 줄(초록 위)에 세워서 놓고 ② 빨강·초록 짝을 맨 왼쪽 줄에. 3연쇄로 필드를 싹 비워 봐!',
    goal: { chain: 3, allClear: true, moves: 2 }, field: ['RGB...', 'RGB...', 'RGB...'], pairs: [[3, 3], [1, 2]],
    retry: '아깝다! 파랑 짝을 눕히지 말고 초록 줄 위에 세워서 올려야 해.',
    done: '3연쇄 전소! 최상급까지 모두 배웠어. 넌 이제 뿌요뿌요 박사야!',
  },
];

// 초초상급: 다른 모양의 연쇄(끼워 넣기), 더 긴 연쇄
const ULTRA = [
  {
    id: 'sandwich', title: '끼워 넣기 3연쇄',
    text: '초록 사이에 빨강이, 파랑 사이에 초록이 끼어 있어. 빨강이 터지면 위의 초록이 떨어져서 아래 초록과 만나! 빨강 짝을 둘째 줄에 세워서 놓아 봐.',
    goal: { chain: 3, moves: 1 }, field: ['B.....', 'B.....', 'G.....', 'G.....', 'R.....', 'R.....', 'R.....', 'GG....', 'BB....'], pairs: [[1, 1]],
    retry: '아깝다! 빨강 짝이 맨 왼쪽 줄의 빨강 옆(둘째 줄)에 닿아야 해.',
    done: '3연쇄! 이렇게 사이에 끼워 두는 걸 끼워 넣기(샌드위치)라고 해. 좁은 자리에서도 연쇄가 돼.',
  },
  {
    id: 'build5', title: '직접 쌓아서 5연쇄',
    text: '다섯 색 계단이 한 칸 모자라. ① 파랑 짝을 둘째 줄(초록 위)에 세워서 놓고 ② 빨강·초록 짝을 맨 왼쪽 줄에 내려 봐!',
    goal: { chain: 5, moves: 2 }, field: ['..YP..', 'RGBYP.', 'RGBYP.', 'RGBYP.'], pairs: [[3, 3], [1, 2]],
    retry: '아깝다! 파랑 짝을 초록 줄 위에 세워서 올리고, 그다음에 빨강이 아래로 가게 맨 왼쪽 줄에 놓아 봐.',
    done: '5연쇄를 직접 완성했어! 한 칸만 채우면 되는 자리를 찾는 눈이 생겼네.',
  },
  {
    id: 'stairs6', title: '여섯 칸 6연쇄',
    text: '필드 끝에서 끝까지 이어진 계단이야. 빨강이 아래로 가게 맨 왼쪽 줄에 내리면… 6연쇄!',
    goal: { chain: 6, moves: 1 }, field: ['.BYPR.', 'RGBYPR', 'RGBYPR', 'RGBYPR'], pairs: [[1, 2]],
    retry: '아깝다! 빨강이 아래, 초록이 위인 채로 맨 왼쪽 줄에 놓아 봐.',
    done: '6연쇄! 방해 뿌요가 별만큼 날아가는 엄청난 공격이야.',
  },
];

// 빈 필드에서 계단을 직접 쌓는 순서 (왼쪽부터). 3연쇄는 여섯 번, 4연쇄는 여덟 번, 5연쇄는 열 번 놓는다.
const SCRATCH3_PAIRS = [[1, 1], [2, 2], [3, 3], [1, 2], [3, 3], [1, 2]];
const SCRATCH3_STEPS = [
  '이제 아무것도 없는 필드야. 내가 말하는 대로 하나씩! ① 빨강 짝을 맨 왼쪽 줄에 세워서 놓아.',
  '② 초록 짝을 둘째 줄(빨강 옆)에 세워서 놓아.',
  '③ 파랑 짝을 셋째 줄(초록 옆)에 세워서 놓아. 지금 나온 자리 그대로 내리면 돼.',
  '④ 빨강·초록 짝을 한 번 돌려 눕혀서(빨강이 왼쪽) 빨강은 빨강 위에, 초록은 초록 위에 놓아. 이제 3개씩이야!',
  '⑤ 파랑 짝을 눕혀서 하나는 초록 줄 위에, 하나는 파랑 줄 위에 놓아. 초록 줄 위의 파랑이 다음 연쇄를 이어 줄 거야.',
  '⑥ 발화! 빨강·초록 짝을 세운 채로(빨강이 아래) 맨 왼쪽 줄에 내려 봐.',
];
const SCRATCH4_PAIRS = [[1, 1], [2, 2], [3, 3], [4, 4], [1, 2], [3, 4], [3, 4], [1, 2]];
const SCRATCH4_STEPS = [
  '이번에는 네 색으로 4연쇄! ① 빨강 짝을 맨 왼쪽 줄에 세워서 놓아.',
  '② 초록 짝을 둘째 줄에 세워서 놓아.',
  '③ 파랑 짝을 셋째 줄에 세워서 놓아 (나온 자리 그대로).',
  '④ 노랑 짝을 넷째 줄에 세워서 놓아.',
  '⑤ 빨강·초록 짝을 눕혀서(빨강이 왼쪽) 빨강은 빨강 위에, 초록은 초록 위에.',
  '⑥ 파랑·노랑 짝을 눕혀서(파랑이 왼쪽) 파랑은 파랑 위에, 노랑은 노랑 위에. 이제 네 줄 모두 3개씩!',
  '⑦ 파랑·노랑 짝을 눕혀서(파랑이 왼쪽) 파랑은 초록 줄 위에, 노랑은 파랑 줄 위에. 한 칸씩 왼쪽으로 올려 두는 거야.',
  '⑧ 발화! 빨강·초록 짝을 세운 채로(빨강이 아래) 맨 왼쪽 줄에 내려 봐.',
];
const SCRATCH5_PAIRS = [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [1, 2], [3, 4], [3, 4], [5, 5], [1, 2]];
const SCRATCH5_STEPS = [
  '다섯 색으로 5연쇄를 처음부터! ① 빨강 짝을 맨 왼쪽 줄에 세워서 놓아.',
  '② 초록 짝을 둘째 줄에 세워서 놓아.',
  '③ 파랑 짝을 셋째 줄에 세워서 놓아 (나온 자리 그대로).',
  '④ 노랑 짝을 넷째 줄에 세워서 놓아.',
  '⑤ 보라 짝을 다섯째 줄에 세워서 놓아.',
  '⑥ 빨강·초록 짝을 눕혀서(빨강이 왼쪽) 빨강은 빨강 위에, 초록은 초록 위에.',
  '⑦ 파랑·노랑 짝을 눕혀서(파랑이 왼쪽) 파랑은 파랑 위에, 노랑은 노랑 위에.',
  '⑧ 파랑·노랑 짝을 눕혀서(파랑이 왼쪽) 파랑은 초록 줄 위에, 노랑은 파랑 줄 위에.',
  '⑨ 보라 짝을 눕혀서 하나는 노랑 줄 위에, 하나는 보라 줄 위에. 다 쌓았어!',
  '⑩ 발화! 빨강·초록 짝을 세운 채로(빨강이 아래) 맨 왼쪽 줄에 내려 봐.',
];
// 시험에서 두 번 틀리면 보여 주는 도움말: 첫 줄만 "같이 하자" 로 바꾼다
const asHints = steps => [`조금 어렵지? 이번에는 같이 하자! ${steps[0].slice(steps[0].indexOf('①'))}`, ...steps.slice(1)];

// 마지막: 다섯 등급을 하나씩 복습하고(오른쪽으로 뒤집은 문제), 빈 필드에서 직접 연쇄를 쌓아 본 다음, 진짜 연쇄를 잘하는 비결을 듣는다
const FINAL = [
  {
    id: 'review1', title: '복습 ① 초급 · 2연쇄',
    text: '초급 복습이야. 이번에는 오른쪽! 빨간 짝을 맨 오른쪽 줄에 내려서 2연쇄를 만들어 봐.',
    goal: { chain: 2, moves: 1 }, field: ['....G.', '...GR.', '..GGRR'], pairs: [[1, 1]],
    retry: '아깝다! 빨간 짝을 맨 오른쪽 줄에 놓아 봐.',
    done: '좋아! 초급은 완벽해.',
  },
  {
    id: 'review2', title: '복습 ② 중급 · 계단 3연쇄',
    text: '중급 복습! 계단이 오른쪽에 있어. 빨강이 아래로 가게 맨 오른쪽 줄에 내려 봐.',
    goal: { chain: 3, moves: 1 }, field: ['....B.', '...BGR', '...BGR', '...BGR'], pairs: [[1, 2]],
    retry: '아깝다! 돌리지 말고 빨강이 아래로 가게 맨 오른쪽 줄에 놓아 봐.',
    done: '계단 쌓기도 문제없어!',
  },
  {
    id: 'review3', title: '복습 ③ 상급 · 직접 쌓아서 3연쇄',
    text: '상급 복습! ① 파랑·노랑 짝을 초록 줄(오른쪽에서 둘째 줄) 위에 세워서 놓고 ② 빨강·초록 짝을 맨 오른쪽 줄에 내려 봐.',
    goal: { chain: 3, moves: 2 }, field: ['...BGR', '...BGR', '...BGR'], pairs: [[3, 4], [1, 2]],
    retry: '아깝다! 먼저 파랑이 초록 바로 위에 오게 놓고, 그다음에 빨강을 맨 오른쪽 줄에 놓아 봐.',
    done: '직접 쌓는 것도 잘하네!',
  },
  {
    id: 'review4', title: '복습 ④ 최상급 · 다섯 색 5연쇄',
    text: '최상급 복습! 다섯 색 계단이야. 빨강이 아래로 가게 맨 오른쪽 줄에 내려 봐.',
    goal: { chain: 5, moves: 1 }, field: ['..PYB.', '.PYBGR', '.PYBGR', '.PYBGR'], pairs: [[1, 2]],
    retry: '아깝다! 빨강이 아래, 초록이 위인 채로 맨 오른쪽 줄에 놓아 봐.',
    done: '5연쇄도 척척!',
  },
  {
    id: 'review5', title: '복습 ⑤ 초초상급 · 끼워 넣기',
    text: '초초상급 복습! 끼워 넣기가 오른쪽에 있어. 빨강 짝을 오른쪽에서 둘째 줄에 세워서 놓아 봐.',
    goal: { chain: 3, moves: 1 }, field: ['.....B', '.....B', '.....G', '.....G', '.....R', '.....R', '.....R', '....GG', '....BB'], pairs: [[1, 1]],
    retry: '아깝다! 빨강 짝이 맨 오른쪽 줄의 빨강 옆에 닿아야 해.',
    done: '복습 끝! 이제 진짜 연쇄를 잘하는 법을 알려 줄게.',
  },
  {
    id: 'scratch', title: '진짜 연쇄 ① 빈 필드에서 직접 쌓기',
    steps: SCRATCH3_STEPS,
    goal: { chain: 3, moves: 6 }, field: [], pairs: SCRATCH3_PAIRS,
    retry: '아깝다! 처음부터 다시 해 보자. 한 줄에 같은 색 3개씩, 그리고 파랑 하나는 초록 줄 위에!',
    done: '빈 필드에서 3연쇄를 직접 만들었어! 진짜 대전에서도 똑같이 쌓으면 돼.',
  },
  {
    id: 'tip-wait', title: '비결 ① 3개까지만 모으고 참기', tip: true,
    text: '같은 색은 3개까지만 붙여 두고 참아. 네 번째가 닿는 순간 터지니까, 그 한 칸(발화점)은 연쇄를 다 쌓을 때까지 남겨 두는 거야.',
    goal: { tip: true }, field: ['R..B..', 'R.GB..', 'RGGB..'],
  },
  {
    id: 'tip-stairs', title: '비결 ② 계단으로 쌓기', tip: true,
    text: '한 줄에 같은 색 3개를 세로로 쌓고, 다음 색의 네 번째 뿌요는 앞줄 위에 올려 둬 (파랑 하나가 초록 줄 위에 있지?). 앞줄이 터지면 떨어지면서 이어져!',
    goal: { tip: true }, field: ['.B....', 'RGB...', 'RGB...', 'RGB...'],
  },
  {
    id: 'tip-center', title: '비결 ③ 가운데는 비워 두기', tip: true,
    text: '✕ 표시가 있는 셋째 줄 꼭대기까지 쌓이면 져. 양옆부터 쌓고 가운데는 낮게 비워 둬. 연쇄를 시작할 자리(발화점)가 막히지 않게!',
    goal: { tip: true }, field: ['R....B', 'R....B', 'RG..YB', 'GG..YY'],
  },
  {
    id: 'tip-next', title: '비결 ④ 다음 뿌요를 보고, 위험하면 바로 터뜨리기', tip: true,
    text: '오른쪽 NEXT 를 보고 다음 짝이 갈 자리를 미리 정해 둬. 방해 뿌요가 많이 오면 큰 연쇄를 기다리지 말고 바로 터뜨려서 막아(상쇄). 이 네 가지만 지키면 진짜 연쇄 고수야!',
    goal: { tip: true }, field: ['OO..OO', 'RRR.GG'],
  },
];

// 찐 마지막 (엄청 길다, 30가지): 1부 총복습 10문제(색과 방향을 바꿈) → 2부 빈 필드에서 직접 쌓기(3·4·5연쇄)
// → 3부 대연쇄(한 번 놓아 7·8·9·10연쇄, 모두 전소로 끝남) → 4부 졸업 시험(안내 없이 혼자 3·4연쇄) → 5부 찐 비결 7가지.
// 대연쇄 네 판은 빈 필드에서 거꾸로 4개씩 끼워 넣어 만들었고(역연쇄), 진짜 판으로 풀리는지는 upgrade4.test.mjs 가 확인한다.
const REAL = [
  {
    id: 'real-part1', title: '1부 · 총복습 시작!', tip: true,
    text: '찐 마지막에 온 걸 환영해! 여기는 엄청 길어서 다섯 부로 나뉘어 있어. 1부는 지금까지 배운 걸 색과 방향을 바꿔서 푸는 열 문제야. 천천히 해도 돼!',
    goal: { tip: true }, field: ['RGBYPR'],
  },
  {
    id: 'real-pop', title: '총복습 ① 4개 터뜨리기',
    text: '노란 짝을 바닥의 노란 뿌요 옆이나 위에 붙여서 터뜨려 봐.',
    goal: { pop: 1, moves: 1 }, field: ['YY....'], pairs: [[4, 4]],
    retry: '아깝다! 노란 뿌요끼리 4개가 닿아야 터져.', done: '퐁! 기본은 완벽해.',
  },
  {
    id: 'real-chain2', title: '총복습 ② 2연쇄',
    text: '노란 짝을 맨 왼쪽 줄에 내려 봐. 노랑이 터지면 파랑이 떨어지면서 또 터져!',
    goal: { chain: 2, moves: 1 }, field: ['.B....', '.YB...', 'YYBB..'], pairs: [[4, 4]],
    retry: '아깝다! 노란 짝을 맨 왼쪽 줄에 놓아 봐.', done: '2연쇄! 연쇄의 시작이지.',
  },
  {
    id: 'real-double', title: '총복습 ③ 두 색을 한 번에',
    text: '짝을 눕혀서 초록이 왼쪽으로 가게 한 다음, 빨강은 빨강 옆 빈칸에 초록은 노랑 위에 놓아 봐. 두 색이 한 번에 터져!',
    goal: { colors: 2, moves: 1 }, field: ['G.....', 'G.....', 'GY.RRR'], pairs: [[1, 2]],
    retry: '아깝다! 초록이 왼쪽에 오게 눕혀서, 빨강은 빈칸에 초록은 노랑 위에 놓아 봐.', done: '두 색 동시에 퐁!',
  },
  {
    id: 'real-garbage', title: '총복습 ④ 방해 뿌요 치우기',
    text: '파랑을 터뜨려서 옆의 회색 방해 뿌요까지 치워 봐. 파란 뿌요 옆 빈칸에 파랑 짝을 세워서!',
    goal: { garbage: 3, moves: 1 }, field: ['OOO...', 'BBB.O.'], pairs: [[3, 3]],
    retry: '아깝다! 파란 뿌요 옆 빈칸에 파랑 짝을 세워서 놓아 봐.', done: '방해 뿌요 청소 끝!',
  },
  {
    id: 'real-stairs4', title: '총복습 ⑤ 계단 4연쇄',
    text: '오른쪽에 네 칸짜리 계단이 있어. 빨강이 아래로 가게 맨 오른쪽 줄에 내려 봐.',
    goal: { chain: 4, moves: 1 }, field: ['...YB.', '..YBGR', '..YBGR', '..YBGR'], pairs: [[1, 2]],
    retry: '아깝다! 빨강이 아래, 초록이 위인 채로 맨 오른쪽 줄에 놓아 봐.', done: '4연쇄!',
  },
  {
    id: 'real-allclear', title: '총복습 ⑥ 전소',
    text: '필드를 싹 비우는 전소! 짝을 돌리지 말고 나온 자리 그대로 내려 봐.',
    goal: { allClear: true, moves: 1 }, field: ['...GGG', '...RRR'], pairs: [[1, 2]],
    retry: '아깝다! 빨강이 아래, 초록이 위인 채로 뿌요들 바로 왼쪽 빈칸에 놓아 봐.', done: '전소! 깨끗해졌어.',
  },
  {
    id: 'real-build4', title: '총복습 ⑦ 직접 쌓아서 4연쇄',
    text: '① 파랑 짝을 초록 줄(오른쪽에서 둘째 줄) 위에 세워서 놓고 ② 빨강·초록 짝을 맨 오른쪽 줄에 내려 봐.',
    goal: { chain: 4, moves: 2 }, field: ['...Y..', '..YBGR', '..YBGR', '..YBGR'], pairs: [[3, 3], [1, 2]],
    retry: '아깝다! 파랑 짝을 초록 줄 위에 세워서 올리고, 그다음에 빨강을 맨 오른쪽 줄에 놓아 봐.', done: '직접 쌓은 4연쇄!',
  },
  {
    id: 'real-clear3', title: '총복습 ⑧ 3연쇄로 전소',
    text: '① 파랑 짝을 초록 줄(오른쪽에서 둘째 줄) 위에 세워서 놓고 ② 빨강·초록 짝을 맨 오른쪽 줄에. 3연쇄로 싹 비워 봐!',
    goal: { chain: 3, allClear: true, moves: 2 }, field: ['...BGR', '...BGR', '...BGR'], pairs: [[3, 3], [1, 2]],
    retry: '아깝다! 파랑 짝을 눕히지 말고 초록 줄 위에 세워서 올려야 해.', done: '3연쇄 전소!',
  },
  {
    id: 'real-stairs6', title: '총복습 ⑨ 여섯 칸 6연쇄',
    text: '이번에는 오른쪽에서 시작하는 여섯 칸 계단이야. 빨강이 아래로 가게 맨 오른쪽 줄에 내려 봐.',
    goal: { chain: 6, moves: 1 }, field: ['.RPYB.', 'RPYBGR', 'RPYBGR', 'RPYBGR'], pairs: [[1, 2]],
    retry: '아깝다! 빨강이 아래, 초록이 위인 채로 맨 오른쪽 줄에 놓아 봐.', done: '6연쇄!',
  },
  {
    id: 'real-sandwich', title: '총복습 ⑩ 끼워 넣기',
    text: '초록 사이에 파랑, 파랑 사이에 노랑이 끼어 있어. 노랑 짝을 둘째 줄에 세워서 놓아 봐.',
    goal: { chain: 3, moves: 1 }, field: ['G.....', 'G.....', 'B.....', 'B.....', 'Y.....', 'Y.....', 'Y.....', 'BB....', 'GG....'], pairs: [[4, 4]],
    retry: '아깝다! 노랑 짝이 맨 왼쪽 줄의 노랑 옆(둘째 줄)에 닿아야 해.', done: '1부 총복습 끝! 열 문제를 모두 풀었어.',
  },
  {
    id: 'real-part2', title: '2부 · 빈 필드에서 직접 쌓기', tip: true,
    text: '2부는 아무것도 없는 필드에서 계단을 직접 쌓아. 3연쇄, 4연쇄, 5연쇄로 점점 길어져! 내가 짝마다 어디에 놓을지 알려 줄게.',
    goal: { tip: true }, field: ['.B....', 'RGB...', 'RGB...', 'RGB...'],
  },
  {
    id: 'real-scratch3', title: '직접 쌓기 ① 오른쪽에서 3연쇄',
    steps: [
      '먼저 오른쪽에서 3연쇄! ① 빨강 짝을 맨 오른쪽 줄에 세워서 놓아.',
      '② 초록 짝을 그 왼쪽 줄(오른쪽에서 둘째)에 세워서 놓아.',
      '③ 파랑 짝을 그 왼쪽 줄(오른쪽에서 셋째)에 세워서 놓아.',
      '④ 빨강·초록 짝을 눕혀서(빨강이 오른쪽) 빨강은 빨강 위에, 초록은 초록 위에.',
      '⑤ 파랑 짝을 눕혀서 하나는 파랑 줄 위에, 하나는 초록 줄 위에.',
      '⑥ 발화! 빨강·초록 짝을 세운 채로(빨강이 아래) 맨 오른쪽 줄에 내려 봐.',
    ],
    goal: { chain: 3, moves: 6 }, field: [], pairs: SCRATCH3_PAIRS,
    retry: '아깝다! 처음부터 다시. 오른쪽부터 빨강, 초록, 파랑 순서로 3개씩!', done: '오른쪽에서도 3연쇄 완성!',
  },
  {
    id: 'real-scratch4', title: '직접 쌓기 ② 4연쇄',
    steps: SCRATCH4_STEPS,
    goal: { chain: 4, moves: 8 }, field: [], pairs: SCRATCH4_PAIRS,
    retry: '아깝다! 처음부터 다시. 한 줄에 같은 색 3개씩, 그리고 다음 색 하나를 앞줄 위에!', done: '빈 필드에서 4연쇄를 만들었어!',
  },
  {
    id: 'real-scratch5', title: '직접 쌓기 ③ 5연쇄',
    steps: SCRATCH5_STEPS,
    goal: { chain: 5, moves: 10 }, field: [], pairs: SCRATCH5_PAIRS,
    retry: '아깝다! 처음부터 다시. 열 번을 차근차근 놓으면 돼.', done: '빈 필드에서 5연쇄! 이건 진짜 고수만 할 수 있어.',
  },
  {
    id: 'real-part3', title: '3부 · 대연쇄 구경', tip: true,
    text: '3부는 쉬어 가는 시간! 누가 미리 쌓아 둔 엄청 긴 연쇄에 불만 붙이면 돼. 7연쇄, 8연쇄, 9연쇄, 10연쇄… 끝까지 터지면 필드가 싹 비워져(전소).',
    goal: { tip: true }, field: ['.BYPR.', 'RGBYPR', 'RGBYPR', 'RGBYPR'],
  },
  {
    id: 'real-mega7', title: '대연쇄 ① 7연쇄',
    text: '파랑 짝을 왼쪽에서 넷째 줄(비어 있는 줄)에 세워서 내려 봐. 눈 크게 뜨고 구경해!',
    goal: { chain: 7, moves: 1 }, pairs: [[3, 3]],
    field: ['G.....', 'GY....', 'GY....', 'BY....', 'BG....', 'PB....', 'PGY...', 'YGY...', 'PGY...', 'PYB...', 'BGB...'],
    retry: '아깝다! 파랑 짝을 넷째 줄 바닥에 세워서 놓아 봐 (셋째 줄의 파랑 옆).', done: '7연쇄! 전소까지!',
  },
  {
    id: 'real-mega8', title: '대연쇄 ② 8연쇄',
    text: '보라 짝을 왼쪽에서 다섯째 줄(비어 있는 줄)에 세워서 내려 봐.',
    goal: { chain: 8, moves: 1 }, pairs: [[5, 5]],
    field: ['.G....', 'BGP...', 'RBB...', 'RYY...', 'RYBY..', 'GPBY..', 'GPBY..', 'RPYP..', 'BYBP..'],
    retry: '아깝다! 보라 짝을 다섯째 줄 바닥에 세워서 놓아 봐 (넷째 줄의 보라 옆).', done: '8연쇄!',
  },
  {
    id: 'real-mega9', title: '대연쇄 ③ 9연쇄',
    text: '보라 짝을 왼쪽에서 다섯째 줄(보라 뿌요 하나가 있는 줄)에 세워서 내려 봐.',
    goal: { chain: 9, moves: 1 }, pairs: [[5, 5]],
    field: ['.B....', '.G....', '.RBB..', 'RPBR..', 'GPRG..', 'GYRG..', 'PYBG..', 'PYRP..', 'GBRG..', 'BBYRP.'],
    retry: '아깝다! 보라 짝을 다섯째 줄의 보라 뿌요 위에 세워서 놓아 봐.', done: '9연쇄!!',
  },
  {
    id: 'real-mega10', title: '대연쇄 ④ 10연쇄',
    text: '드디어 10연쇄! 초록 짝을 왼쪽에서 넷째 줄(낮은 줄)에 세워서 내려 봐.',
    goal: { chain: 10, moves: 1 }, pairs: [[2, 2]],
    field: ['.....R', '....PB', '....YB', '..G.YR', '..Y.YR', '..R.PY', '..R.GR', '.YR.GR', '.GBBRB', 'GGBPRB', 'YYRBPR'],
    retry: '아깝다! 초록 짝을 넷째 줄(셋째 줄 바로 오른쪽 낮은 줄)에 세워서 놓아 봐.', done: '10연쇄!!! 타워 챌린지의 10연쇄가 바로 이런 거야.',
  },
  {
    id: 'real-part4', title: '4부 · 졸업 시험', tip: true,
    text: '4부는 졸업 시험이야. 이번에는 내가 알려 주지 않아! 빈 필드에서 혼자 힘으로 계단을 쌓아 봐. 나오는 짝은 2부와 같은 순서야. 두 번 틀리면 내가 다시 도와줄게.',
    goal: { tip: true }, field: ['R.G.B.', 'YPYPYP'],
  },
  {
    id: 'real-exam3', title: '졸업 시험 ① 혼자서 3연쇄',
    text: '안내 없이 3연쇄! 빨강, 초록, 파랑을 한 줄에 3개씩 쌓고, 파랑 하나는 초록 줄 위에. 마지막에 빨강으로 발화!',
    hints: asHints(SCRATCH3_STEPS),
    goal: { chain: 3, moves: 6 }, field: [], pairs: SCRATCH3_PAIRS,
    retry: '아깝다! 다시 해 보자. 한 줄에 같은 색 3개씩!', done: '혼자서 3연쇄! 합격!',
  },
  {
    id: 'real-exam4', title: '졸업 시험 ② 혼자서 4연쇄',
    text: '마지막 시험! 안내 없이 4연쇄. 빨강, 초록, 파랑, 노랑을 한 줄에 3개씩, 그리고 파랑은 초록 줄 위에, 노랑은 파랑 줄 위에 하나씩!',
    hints: asHints(SCRATCH4_STEPS),
    goal: { chain: 4, moves: 8 }, field: [], pairs: SCRATCH4_PAIRS,
    retry: '아깝다! 다시 해 보자. 다음 색 하나를 앞줄 위에 올려 두는 걸 잊지 마.', done: '혼자서 4연쇄! 졸업 시험 합격이야!',
  },
  {
    id: 'real-tip1', title: '5부 · 찐 비결 ① 같은 색은 가까이', tip: true,
    text: '이제 마지막 5부, 고수들의 찐 비결 일곱 가지야. 첫째! 같은 색은 2개씩 붙여서 놓아. 여기저기 흩어 놓으면 나중에 이을 수가 없어.',
    goal: { tip: true }, field: ['RR.GG.', 'BB.YY.'],
  },
  {
    id: 'real-tip2', title: '찐 비결 ② 연쇄의 꼬리 늘리기', tip: true,
    text: '연쇄를 더 길게 하고 싶으면 발화점 반대쪽 끝에 계단을 한 줄씩 더 붙여. 3연쇄 계단에 한 줄을 더하면 4연쇄, 또 더하면 5연쇄!',
    goal: { tip: true }, field: ['.BY...', 'RGBY..', 'RGBY..', 'RGBY..'],
  },
  {
    id: 'real-tip3', title: '찐 비결 ③ 높이를 고르게', tip: true,
    text: '한 줄만 삐죽 높으면 그 너머로 뿌요를 옮길 수 없어. 줄마다 높이를 비슷하게 맞추면서 쌓아.',
    goal: { tip: true }, field: ['RGBYPR', 'GBYPRG'],
  },
  {
    id: 'real-tip4', title: '찐 비결 ④ 상대 필드도 보기', tip: true,
    text: '대전에서는 상대 필드도 봐. 상대가 큰 연쇄를 쌓고 있으면 작은 연쇄를 먼저 보내서 방해하고, 방해 뿌요가 오면 내 연쇄로 막아(상쇄).',
    goal: { tip: true }, field: ['O.O.O.', 'RRRGGG'],
  },
  {
    id: 'real-tip5', title: '찐 비결 ⑤ 전소를 노리기', tip: true,
    text: '필드를 싹 비우면(전소) 다음 연쇄에 방해 뿌요 30개가 더 날아가. 판을 시작하자마자 4개씩 딱 맞춰서 전소를 노려 봐.',
    goal: { tip: true }, field: ['GGG...', 'RRR...'],
  },
  {
    id: 'real-tip6', title: '찐 비결 ⑥ 너무 오래 끌지 않기', tip: true,
    text: '96초가 지나면 같은 연쇄로도 방해 뿌요가 점점 더 많이 나가(마진 타임). 그때는 더 큰 연쇄를 기다리지 말고 쌓아 둔 연쇄를 터뜨려!',
    goal: { tip: true }, field: ['.B....', 'RGB...', 'RGB...', 'RGB...'],
  },
  {
    id: 'real-tip7', title: '찐 비결 ⑦ 매일 조금씩', tip: true,
    text: '마지막 비결은 연습이야. ♾️ 혼자 하기에서 계단 3연쇄를 열 번만 쌓아 봐. 손이 기억하면 대전에서도 저절로 돼. 여기까지 온 넌 이제 찐 연쇄 고수야!',
    goal: { tip: true }, field: ['R.G.B.', 'YPYPYP'],
  },
];

// 등급. 끝내면 처음 한 번만 선물을 준다.
export const GRADES = [
  { id: 'beginner', name: '초급', emoji: '🐣', desc: '옮기기 · 4개 터뜨리기 · 2연쇄', lessons: BEGINNER, reward: { coins: 100, xp: 50 } },
  { id: 'middle', name: '중급', emoji: '🌱', desc: '계단 3연쇄 · 두 색 한 번에 · 방해 뿌요 치우기', lessons: MIDDLE, reward: { coins: 200, xp: 100, tickets: { boost: 1 } } },
  { id: 'high', name: '상급', emoji: '🔥', desc: '4연쇄 · 직접 쌓아서 3연쇄 · 전소', lessons: HIGH, reward: { coins: 400, xp: 200, tickets: { pet: 1 } } },
  { id: 'master', name: '최상급', emoji: '👑', desc: '5연쇄 · 직접 쌓아서 4연쇄 · 3연쇄 전소', lessons: MASTER, reward: { coins: 800, xp: 400, tickets: { pet: 1, boost: 1 } } },
  { id: 'ultra', name: '초초상급', emoji: '⚡', desc: '끼워 넣기 3연쇄 · 직접 쌓아서 5연쇄 · 여섯 칸 6연쇄', lessons: ULTRA, reward: { coins: 1500, xp: 600, tickets: { pet: 2, boost: 1 } } },
  { id: 'final', name: '마지막', emoji: '🏆', desc: '초급~초초상급 복습 · 빈 필드에서 직접 쌓기 · 진짜 연쇄를 잘하는 비결 4가지', lessons: FINAL, reward: { coins: 3000, xp: 1000, tickets: { pet: 3, boost: 2, skin: 1, effect: 1 } } },
  { id: 'real', name: '찐 마지막', emoji: '💎', desc: '총복습 10문제 · 직접 쌓기 3·4·5연쇄 · 대연쇄 7~10연쇄 · 졸업 시험 · 찐 비결 7가지', lessons: REAL, reward: { coins: 10000, xp: 3000, tickets: { pet: 5, boost: 3, skin: 2, effect: 2 } } },
];
// 예전 이름: 연습하기(초급) 세 가지
export const LESSONS = BEGINNER;

// 그 등급을 끝냈나 / 지금 할 수 있나 (앞 등급을 끝내야 열린다)
export const gradeDone = (progress, index) => (index === 0 ? progress.tutorial === true : !!progress.school?.includes(GRADES[index]?.id));
export const gradeOpen = (progress, index) => index === 0 || gradeDone(progress, index - 1);
// 등급을 끝냈다고 적는다. 처음 끝낸 것이면 true (선물을 줄 때)
export function finishGrade(progress, index) {
  if (!GRADES[index] || gradeDone(progress, index)) return false;
  if (index === 0) progress.tutorial = true;
  else (progress.school ||= []).push(GRADES[index].id);
  return true;
}

export const lessonCells = lesson => parseField(lesson.field);
// 연습 판의 짝 순서. 정해 둔 짝이 없으면 원래 순서를 그대로 쓴다.
export const lessonSeq = (lesson, base) => (lesson.pairs ? { ...base, puyos: lesson.pairs.flat() } : base);

// 직접 쌓는 수업에서 지금 보여 줄 안내 (놓은 짝 수에 맞춰). 시험(hints)은 fails 번 틀린 뒤부터 도움말을 보여 준다.
export const HINT_AFTER = 2;
export function lessonStep(lesson, pieces = 0, fails = 0) {
  const steps = lesson.steps || (lesson.hints && fails >= HINT_AFTER ? lesson.hints : null);
  return steps ? steps[Math.min(pieces, steps.length - 1)] : null;
}

export function newJudge() { return { pieces: 0, pending: false, misses: 0, colors: 0, garbage: 0 }; }
// 게임 사건 하나를 보고 연습 목표를 이뤘는지 본다: 'done'(성공) | 'retry'(다시) | null(계속)
export function judge(lesson, state, e) {
  const goal = lesson.goal;
  if (goal.tip) return null; // 비결은 읽고 단추로 넘어간다
  if (e.type === 'lock') {
    state.pieces++;
    state.pending = true;
    if (goal.pieces && state.pieces >= goal.pieces) return 'done';
  } else if (e.type === 'pop') {
    state.colors = Math.max(state.colors || 0, new Set(e.colors || []).size);
    state.garbage = (state.garbage || 0) + (Number(e.garbage) || 0);
  } else if (e.type === 'chainEnd') {
    state.pending = false;
    if (goal.pop) return 'done';
    if (goal.pieces) return null;
    const ok = (!goal.chain || e.chain >= goal.chain) && (!goal.allClear || !!e.allClear)
      && (!goal.colors || state.colors >= goal.colors) && (!goal.garbage || state.garbage >= goal.garbage);
    return ok ? 'done' : 'retry';
  } else if (e.type === 'spawn' && state.pending) {
    // 내려놓은 뿌요가 아무것도 터뜨리지 못하고 다음 짝이 나왔다
    state.pending = false;
    if (!goal.pieces && ++state.misses >= (goal.moves ?? 2)) return 'retry';
  }
  return null;
}
