// 뿌요 동영상 (인혁이 기획서 「뿌요뿌요 (업그레이드)」 2026-10-11 2번):
// "빠르고 쉽게 배울 수 있는 뿌요 동영상을 넣어줘 이렇게" + 그림(가운데 필드, 왼쪽에 "1. 연쇄 잘하는 법!"과 길이, 오른쪽에 "연쇄 잘하는 법은?", "대전 방법").
// 찍어 둔 영상 파일이 아니라, 꼬마 뿌요가 진짜 필드에서 뿌요를 놓아 보이는 것을 그대로 틀어 준다 (보는 사람은 손대지 않는다).
// 장면을 차례로 적어 두면 VideoRun 이 한 프레임씩 입력을 만들어 낸다. 화면·소리와 떨어져 있어서 테스트에서도 그대로 돈다.
import { Match } from './match.mjs';
import { parseField } from './core.mjs';

export const VIDEO_TIMING = { popFrames: 50, chainPause: 18 }; // 터지는 것이 잘 보이게 보통보다 조금 천천히
export const VIDEO_GRAVITY = 0.6;
export const VIDEO_SEED = 7; // 방해 뿌요가 떨어지는 자리까지 볼 때마다 같게

const R = 1, G = 2, B = 3, Y = 4, P = 5;
// 장면 적는 법
//   say(자막, 프레임?)         자막만 보여 주고 읽을 시간을 준다
//   put([아래, 위], [줄, 방향], 자막?)  그 색 짝을 그 자리에 놓는다. 방향: 0 세워서, 1 눕혀서(오른쪽으로), 2 뒤집어서, 3 눕혀서(왼쪽으로)
//   field(줄들, 자막?)         필드를 그 모양으로 바꾼다 (위에서 아래로)
//   garbage(개수, 자막?)       예고 칸에 방해 뿌요를 올린다
const say = (text, wait) => ({ say: text, wait });
const put = (pair, at, text, fast = false) => ({ put: pair, at, say: text, fast });
const field = (rows, text) => ({ field: rows, say: text });
const garbage = (n, text) => ({ garbage: n, say: text });
// 긴 따라 쌓기: 자막 하나로 여러 짝을 이어서 놓는다
const puts = (pairs, answer, texts = {}) => pairs.map((pair, i) => put(pair, answer[i], texts[i], !texts[i]));

// 여섯 줄 계단 6연쇄 (tutorial.mjs 의 「필드 끝에서 끝까지 6연쇄」와 같은 순서)
const STAIRS6_PAIRS = [[R, R], [G, G], [B, B], [Y, Y], [P, P], [R, R], [R, G], [B, Y], [P, R], [B, Y], [P, R], [R, G]];
const STAIRS6_ANSWER = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [0, 1], [2, 1], [4, 1], [1, 1], [3, 1], [0, 0]];
// 끼워 넣기 3연쇄 (tutorial.mjs 의 「끼워 넣기」와 같은 순서)
const SANDWICH_PAIRS = [[B, B], [G, G], [R, R], [R, G], [G, B], [B, B], [R, R]];
const SANDWICH_ANSWER = [[0, 1], [0, 1], [0, 0], [0, 0], [0, 0], [0, 1], [1, 0]];

export const VIDEOS = [
  {
    id: 'chain', title: '연쇄 잘하는 법', ask: '연쇄 잘하는 법은?', emoji: '🔗', chain: 3,
    desc: '계단처럼 쌓아서 3연쇄!',
    keep: ['같은 색은 3개까지만 모아 둬', '다음 색은 옆 줄 위에 걸쳐 놓아 (계단)', '네 번째 한 개는 맨 마지막에 놓아'],
    scenes: [
      say('연쇄는 뿌요가 터진 다음, 위에 있던 뿌요가 떨어져서 또 터지는 거야. 계단처럼 쌓으면 쉬워!'),
      put([R, R], [0, 0], '① 빨강 짝을 맨 왼쪽 줄에 세워서 놓아.'),
      put([G, B], [2, 0], '② 초록·파랑 짝은 셋째 줄에. 초록이 아래야.'),
      put([B, B], [2, 1], '③ 파랑 짝을 눕혀서 셋째 줄과 넷째 줄에. 파랑이 계단처럼 걸쳐졌지?'),
      put([R, G], [1, 0], '④ 빨강·초록 짝을 둘째 줄에. 빨강이 3개! 아직 4개가 아니라서 안 터져.'),
      put([G, B], [1, 0], '⑤ 초록·파랑 짝을 그 위에. 준비 끝!'),
      put([R, G], [0, 0], '⑥ 마지막! 빨강·초록 짝을 맨 왼쪽 줄에 내리면 빨강이 4개…'),
      say('봤지? 빨강이 터지니까 초록이 떨어져서 붙고, 그다음 파랑이 붙었어. 빨강 → 초록 → 파랑, 3연쇄야!'),
      say('외울 것! 같은 색은 3개까지만 모으고, 다음 색은 옆 줄 위에 걸쳐 놓고, 네 번째 한 개는 맨 마지막에!'),
    ],
  },
  {
    id: 'battle', title: '대전 방법', ask: '대전 방법', emoji: '⚔️', chain: 3,
    desc: '방해 뿌요와 예고 칸, 상쇄',
    keep: ['연쇄를 하면 상대에게 방해 뿌요가 가', '필드 위 예고 칸을 봐', '방해 뿌요는 옆에서 터뜨리면 사라져', '예고됐을 때 연쇄를 하면 상쇄!'],
    scenes: [
      say('대전은 상대와 겨루는 거야. 내가 연쇄를 하면 상대 필드에 방해 뿌요가 떨어져!'),
      garbage(6, '상대가 연쇄를 하면 내 필드 위 예고 칸에 방해 뿌요가 보여. 큰 것 하나가 6개야.'),
      put([B, B], [5, 0], '뿌요를 하나 놓으면 예고된 방해 뿌요가 떨어져.'),
      say('방해 뿌요는 색이 없어서 저희끼리는 안 터져. 하지만 바로 옆에서 뿌요가 터지면 같이 사라져!'),
      put([R, R], [0, 0], '빨강 짝을 맨 왼쪽 줄에 놓고…'),
      put([R, R], [1, 0], '빨강 짝을 그 옆에 놓으면 빨강 4개! 아래 있던 방해 뿌요도 같이 사라져.'),
      field(['.B....', '.GB...', 'RGB...', 'RRGB..'], '이번에는 3연쇄를 미리 쌓아 뒀어. 빨강 하나만 더 놓으면 돼.'),
      garbage(12, '앗, 방해 뿌요 12개가 예고됐어! 큰 것 두 개야. 이럴 때는…'),
      put([R, G], [0, 0], '연쇄로 받아쳐! 연쇄를 하면 예고된 방해 뿌요가 그만큼 지워져. 이게 상쇄야!'),
      say('하나도 안 떨어졌지? 다 지우고 남은 방해 뿌요는 상대에게 가. 대전 화면 맨 위 막대가 누가 더 센지 보여 줘.'),
      say('필드 맨 위 ✕ 자리까지 쌓이면 져. 연쇄로 방해 뿌요를 많이 보내면 이겨!'),
    ],
  },
  {
    id: 'move', title: '뿌요 움직이는 법', ask: '뿌요 움직이는 법', emoji: '🕹️', chain: 1,
    desc: '옮기기, 돌리기, 4개 터뜨리기',
    keep: ['◀ ▶ 로 옮겨', '돌리면 눕히거나 뒤집을 수 있어', '같은 색 4개가 가로나 세로로 붙으면 터져'],
    scenes: [
      say('뿌요는 두 개가 짝으로 내려와. ◀ ▶ 로 옮기고, 놓고 싶은 줄에서 떨어뜨려.'),
      put([R, R], [0, 0], '빨강 짝을 맨 왼쪽 줄로 옮겨서 놓았어.'),
      put([B, G], [4, 1], '돌리면 눕힐 수 있어. 파랑·초록 짝을 눕혀서 오른쪽에.'),
      put([G, R], [3, 2], '한 번 더 돌리면 뒤집어져. 위아래 색이 바뀌었지?'),
      put([R, R], [1, 1], '같은 색 4개가 붙으면 터져! 빨강 짝을 눕혀서 빨강 옆에 놓으면…'),
      say('가로나 세로로 붙어야 해. 대각선은 안 붙어! ▼ 는 빨리 내리기, ⤓ 는 바로 떨어뜨리기야.'),
    ],
  },
  {
    id: 'stairs', title: '긴 연쇄 만들기', ask: '긴 연쇄 만들기', emoji: '🪜', chain: 6,
    desc: '여섯 줄 계단으로 6연쇄',
    keep: ['여섯 줄에 다른 색을 3개씩 깔아', '다음 색을 옆 줄 위에 하나씩 올려', '마지막에 첫 색을 놓으면 줄줄이 터져'],
    scenes: [
      say('3연쇄를 할 줄 알면 6연쇄도 똑같아. 필드 끝에서 끝까지 계단을 쌓는 거야!'),
      ...puts(STAIRS6_PAIRS, STAIRS6_ANSWER, {
        0: '먼저 여섯 줄에 다른 색 짝을 세워서 하나씩 놓아. 빨강, 초록, 파랑, 노랑, 보라, 빨강.',
        6: '이제 눕혀서 한 칸씩 올려. 여섯 줄 모두 같은 색이 3개씩 되게!',
        9: '다음 색을 옆 줄 위에 걸쳐 놓아. 파랑은 초록 줄 위에, 노랑은 파랑 줄 위에…',
        11: '마지막! 빨강·초록 짝을 맨 왼쪽 줄에 내리면…',
      }),
      say('빨강 → 초록 → 파랑 → 노랑 → 보라 → 빨강, 6연쇄!'),
      say('한 줄에 같은 색 3개, 다음 색 하나는 옆 줄 위에. 이것만 외우면 돼.'),
    ],
  },
  {
    id: 'sandwich', title: '끼워 넣기 3연쇄', ask: '끼워 넣기 3연쇄', emoji: '🥪', chain: 3,
    desc: '색 사이에 다른 색을 끼워서 3연쇄',
    keep: ['같은 색 사이에 다른 색을 끼워 넣어', '사이에 낀 색이 터지면 위아래가 붙어', '좁은 자리에서도 연쇄를 만들 수 있어'],
    scenes: [
      say('계단 말고 다른 방법도 있어. 같은 색 사이에 다른 색을 끼워 넣는 끼워 넣기야!'),
      ...puts(SANDWICH_PAIRS, SANDWICH_ANSWER, {
        0: '① 파랑 짝을 눕혀서 바닥에, ② 초록 짝을 눕혀서 그 위에 놓아.',
        2: '③ 빨강 짝을 맨 왼쪽 줄에 세워서, ④ 빨강·초록 짝도 그 위에. 빨강이 3개야.',
        4: '⑤ 초록·파랑 짝을 맨 왼쪽 줄에. ⑥ 파랑 짝은 눕혀서 하나는 꼭대기, 하나는 둘째 줄로.',
        6: '⑦ 마지막! 빨강 짝을 둘째 줄에 세워서 내리면…',
      }),
      say('빨강이 터지니까 위에 있던 초록이 내려와서 붙고, 그다음 파랑이 붙었어. 빨강 → 초록 → 파랑, 3연쇄!'),
    ],
  },
  {
    id: 'allclear', title: '전소를 노려 봐', ask: '전소를 노려 봐', emoji: '✨', chain: 2,
    desc: '필드를 싹 비우면 보너스!',
    keep: ['필드를 싹 비우면 전소', '전소 다음 연쇄에는 방해 뿌요 30개가 더 가', '판이 시작하자마자 노리기 좋아'],
    scenes: [
      say('필드의 뿌요를 하나도 남기지 않고 다 터뜨리면 전소야!'),
      put([R, R], [0, 0], '빨강 짝을 놓고…'),
      put([G, R], [1, 0], '초록·빨강 짝을 옆에. 초록이 아래야.'),
      put([G, G], [2, 1], '초록 짝을 눕혀서 그 옆에.'),
      put([R, G], [0, 0], '빨강·초록 짝을 맨 왼쪽 줄에 내리면 빨강이 터지고, 떨어진 초록도 터져서…'),
      say('전소! 필드가 싹 비었어. 전소를 하면 다음 연쇄에 방해 뿌요 30개가 더 가. 판이 시작하자마자 노려 봐!'),
    ],
  },
];
export const getVideo = id => VIDEOS.find(v => v.id === id) || null;

// 자막을 읽을 시간 (프레임). 글이 길수록 길게.
export const readFrames = text => Math.round(80 + [...String(text || '')].length * 7);

// 장면을 한 프레임씩 틀어 준다. step(player) 을 match.step 앞에서 부르면 그 프레임의 입력을 돌려준다.
export class VideoRun {
  constructor(video) {
    this.video = video;
    this.index = -1;      // 지금 장면
    this.frames = 0;      // 지금까지 튼 프레임
    this.caption = '';    // 지금 자막
    this.captionNo = 0;   // 자막이 바뀔 때마다 1씩 (화면이 바뀐 것을 알아채게)
    this.phase = 'next';  // next → read → aim → settle → rest → next … → done
    this.timer = 0; this.tick = 0; this.placed = 0; this.piece = null;
  }
  get done() { return this.phase === 'done'; }
  // 뿌요를 놓는 중이 아니면 손에 든 짝은 떨어지지 않고 떠 있는다
  get frozen() { return this.phase !== 'aim'; }
  get scene() { return this.video.scenes[this.index] || null; }

  step(player) {
    if (this.done) return {};
    this.frames++;
    if (this.phase === 'next') {
      // 연쇄나 방해 뿌요가 끝나고 새 짝이 나온 다음에 넘어간다 (필드를 바꾸는 장면이 중간에 끼어들지 않게)
      if (player.state !== 'control' && player.state !== 'full') return {};
      this.index++;
      const s = this.scene;
      if (!s) { this.phase = 'done'; return {}; }
      if (s.say) { this.caption = s.say; this.captionNo++; }
      if (s.field) { player.cells.fill(0); player.cells.set(parseField(s.field)); player.refreshHeights(); }
      if (s.garbage) player.receive(s.garbage);
      this.phase = 'read';
      // 놓는 장면은 자막을 조금 읽고 나서 놓기 시작한다. 이어서 놓는 것(fast)은 바로.
      this.timer = s.put ? (s.fast ? 8 : Math.min(150, Math.round(readFrames(s.say) * 0.45))) : (s.wait ?? readFrames(s.say));
      return {};
    }
    const s = this.scene;
    if (this.phase === 'read') {
      if (--this.timer > 0) return {};
      if (!s.put) { this.phase = 'next'; return {}; }
      this.phase = 'aim'; this.tick = 0; this.piece = null;
      this.placed = player.stats.pieces;
    }
    if (this.phase === 'aim') {
      const p = player.piece;
      if (player.state !== 'control' || !p) return {};
      if (this.piece !== p) { this.piece = p; p.a = s.put[0]; p.c = s.put[1]; this.tick = 0; } // 이 장면의 색으로
      const [x, rot] = s.at;
      if (++this.tick % 7) return {};
      if (p.rot !== rot) return rot === 3 ? { rotL: true } : { rotR: true };
      if (p.x < x) return { right: true };
      if (p.x > x) return { left: true };
      this.phase = 'settle';
      return { drop: true };
    }
    if (this.phase === 'settle') {
      // 놓은 짝이 굳고, 연쇄와 방해 뿌요까지 다 끝나서 다음 짝이 나올 때까지
      if (player.stats.pieces > this.placed && (player.state === 'control' || player.state === 'full')) {
        this.phase = 'rest';
        this.timer = s.fast ? 6 : Math.round(readFrames(s.say) * 0.3);
      }
      return {};
    }
    if (this.phase === 'rest' && --this.timer <= 0) this.phase = 'next';
    return {};
  }
}

// 동영상 한 편을 화면 없이 끝까지 틀어 본다. 길이(프레임)와 일어난 일을 돌려준다.
export function playVideo(video, limit = 60 * 600) {
  const match = new Match({ seed: VIDEO_SEED, specs: [{ kind: 'human' }], solo: true, steady: true, gravityScale: VIDEO_GRAVITY, timing: VIDEO_TIMING });
  const player = match.players[0];
  player.sandbox = true;
  match.phase = 'play'; match.timer = 0; player.start();
  const run = new VideoRun(video), events = [];
  while (!run.done && run.frames < limit) {
    const input = run.step(player);
    match.gravityScale = run.frozen ? 0 : VIDEO_GRAVITY;
    match.step([input]);
    for (const e of match.events) events.push({ ...e, frame: run.frames, scene: run.index });
    match.events.length = 0;
  }
  return { frames: run.frames, done: run.done, events, cells: player.cells.slice(), incoming: player.incoming, player };
}
const lengths = new Map();
// 동영상 길이 (초). 한 번 틀어 보고 적어 둔다.
export function videoSeconds(video) {
  if (!lengths.has(video.id)) lengths.set(video.id, Math.ceil(playVideo(video).frames / 60));
  return lengths.get(video.id);
}
// "1분 22초", "48초"
export const lengthText = seconds => (seconds >= 60 ? `${Math.floor(seconds / 60)}분${seconds % 60 ? ` ${seconds % 60}초` : ''}` : `${seconds}초`);
// "0:12"
export const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
