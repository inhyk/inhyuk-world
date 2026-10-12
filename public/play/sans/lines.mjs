// SANS · 심판의 회랑 — 대사와 문구. 전부 이 게임을 위해 새로 쓴 글이다.
// 말풍선 한 줄은 [대사, 표정] 이다. 표정: idle, look, closed, wink, dark, glow, tired, sleep, hurt

export const ITEMS = {
  pie: { name: '버터스카치 파이', heal: 999 },
  steak: { name: '철판 스테이크', heal: 60 },
  snow: { name: '눈사람 조각', heal: 45 },
  hero: { name: '영웅 샌드위치', heal: 40 },
  burger: { name: '반짝 버거', heal: 27 },
  bunny: { name: '시나몬 토끼빵', heal: 22 },
};
export const BAG = ['pie', 'steak', 'snow', 'hero', 'hero', 'burger', 'bunny', 'bunny'];

// 받침이 있으면 '을', 없으면 '를'
export function objectParticle(word) {
  const code = word.charCodeAt(word.length - 1) - 0xAC00;
  return code >= 0 && code < 11172 && code % 28 ? '을' : '를';
}

export const INTRO = [
  ['어이, 꼬마.', 'idle'],
  ['여기까지 오는 복도, 참 조용했지?', 'idle'],
  ['평소엔 꽤 시끄러운 곳이거든. 근데 오늘은 인사해 줄 녀석이 하나도 안 남았네.', 'look'],
  ['난 원래 뭘 지키는 일 같은 건 딱 질색이야. 귀찮잖아.', 'closed'],
  ['근데 내 뒤로는 길이 더 없어. 그러니까…', 'idle'],
  ['오늘 하루만, 좀 부지런해져 볼게.', 'dark'],
];

// 하드모드(HP 1)로 처음 만났을 때 끼어드는 말
export const ONE_HP = [
  ['…그런데 너, HP가 1밖에 없네.', 'look'],
  ['그 꼴로 여기까지 걸어온 거야? 근성 하나는 인정할게.', 'closed'],
];

const COUNT_QUIPS = ['세는 것도 슬슬 귀찮아지는데.', '넌 포기라는 말을 뼛속까지 모르는구나.', '이쯤 되면 서로 정들겠다.', '아직도야? 대단하다, 정말.'];
const MANY_QUIPS = ['미안, 중간에 졸아서 몇 번 놓쳤을지도 몰라.', '이제 내 공격을 나보다 네가 더 잘 알겠다.', '끈기 하나는 인정할게. 방향이 좀 틀렸지만.'];

// 죽은 횟수를 샌즈가 기억한다.
export function retryIntro(deaths, dunked = false) {
  if (dunked) return [['…푸흡.', 'closed'], ['방금 그 얼굴. 제대로 한 방 먹은 사람 얼굴인데.', 'wink'], ['미안, 미안. 근데 그건 좀 속을 만했어.', 'closed'], ['자, 이번엔 진짜로.', 'dark']];
  if (deaths <= 0) return INTRO;
  if (deaths === 1) return [['…어.', 'idle'], ['그 표정. 방금 한 번 져 본 사람 표정인데.', 'look'], ['뭐, 좋아. 처음부터 다시 해 보자고.', 'dark']];
  if (deaths === 2) return [['또 왔네.', 'idle'], ['두 번 연달아 진 얼굴이야. 그쯤 되면 얼굴에 다 쓰여 있거든.', 'closed'], ['자, 세 번째.', 'dark']];
  if (deaths === 3) return [['이걸로 세 번. 삼세번이라는 말도 너한텐 안 통하나 보네.', 'closed'], ['괜찮아. 난 시간 많거든.', 'dark']];
  if (deaths === 4) return [['네 번째. 슬슬 내 공격 순서, 외웠겠다?', 'wink'], ['그래도 봐주진 않을 거야.', 'dark']];
  if (deaths === 5) return [['다섯 번. 한 손으로 셀 수 있는 건 여기까지야.', 'closed'], ['다음부턴 양손이 필요하겠네.', 'dark']];
  if (deaths < 10) return [[`${deaths}번째.`, 'idle'], [COUNT_QUIPS[deaths % COUNT_QUIPS.length], 'closed'], ['시작하자.', 'dark']];
  if (deaths === 10) return [['열 번. 축하해, 양손을 다 썼어.', 'closed'], ['이제 발가락 차례야. 난 발가락도 뼈라서 세기 편해.', 'wink'], ['…농담이야. 시작하자.', 'dark']];
  return [[`…${deaths}번째던가?`, 'look'], [MANY_QUIPS[deaths % MANY_QUIPS.length], 'closed'], ['어쨌든, 또 시작이네.', 'dark']];
}

export const AFTER_OPENING = [
  ['…어라. 아직 서 있네.', 'look'],
  ['제일 센 걸 맨 먼저 쓰면 금방 끝날 줄 알았는데.', 'closed'],
  ['뭐, 좋아. 천천히 하자고. 느긋한 건 내 전문이니까.', 'idle'],
];
export const AFTER_OPENING_AGAIN = [['…역시 이걸론 안 끝나네.', 'closed']];

// 1막: 공격을 피할 때마다 이야기가 한 칸씩 나아간다.
export const P1 = [
  [['뭘 그렇게 놀라?', 'wink'], ['뼈대 있는 집안이라 몸이 좀 가벼워. 그냥 서서 맞아 줄 줄 알았어?', 'closed']],
  [['요즘 이상한 일이 많았어.', 'idle'], ['시계가 멈췄다가, 거꾸로 갔다가. 어제 한 일이 통째로 없던 일이 되기도 하고.', 'look']],
  [['누가 자꾸 세상을 처음으로 되감는 거야.', 'idle'], ['마음에 안 들면 몇 번이고. 장난감 다루듯이.', 'dark']],
  [['그걸 알고 나니까 뭘 해도 의욕이 안 나더라.', 'closed'], ['어차피 전부 없던 일이 될 텐데. 열심히 살아서 뭐 해.', 'idle']],
  [['그래서 그냥 구경만 했어. 네가 어디까지 가나.', 'look'], ['…내 동생이 쓰러질 때까지도.', 'dark']],
  [['그건 내 잘못이야. 뼈저리게 알아.', 'idle'], ['그러니까 오늘은 안 비켜. 네가 더는 아무것도 못 망치게.', 'glow']],
];

export const OFFER = [
  ['…후.', 'tired'],
  ['솔직히 말할게. 난 싸우는 거 별로 안 좋아해.', 'closed'],
  ['너도 지쳤잖아. 나도 그래.', 'idle'],
  ['네 안에 아주 조금이라도 착한 구석이 남아 있다면… 여기서 그만하자.', 'look'],
  ['그 손에 든 것만 내려놔. 그럼 내 일도 훨씬 쉬워져.', 'closed'],
];
export const OFFER_NOTE = ['* 샌즈가 당신을 살려주려 한다.'];

export const DUNK = [
  ['…정말이야?', 'look'],
  ['…그래. 쉬운 결정 아니었을 텐데.', 'closed'],
  ['고마워, 꼬마. 네 선택, 헛되게 하진 않을게.', 'idle'],
  ['자, 이리 와. 친구.', 'closed'],
];
export const DUNK_PUNCHLINE = ['…라고 할 줄 알았어?', 'wink'];

// 2막: 제안을 거절하면 시작된다. 샌즈가 점점 지쳐 간다.
export const P2 = [
  [['…그래. 그럴 줄 알았어.', 'closed'], ['뭐, 한번 말해 본 거야. 그럼 이제 안 봐준다.', 'glow']],
  [['…하아. 이거 꽤 힘드네.', 'tired'], ['평소에 운동 좀 해 둘걸. 뼈를 깎는 노력, 뭐 그런 거.', 'closed']],
  [['넌 대체 뭘 바라는 거야?', 'tired'], ['날 지나가면 뭐가 있는데? 아무것도 없어. 진짜로.', 'look']],
  [['넌 그냥… 할 수 있으니까 하는 거지.', 'tired'], ['끝이 있으면 봐야 직성이 풀리니까. 그 끝이 뭐든 간에.', 'dark']],
  [['근데 말이야. 뭐든 언젠가는 스스로 멈출 줄도 알아야 해.', 'tired'], ['…지금이 딱 그때야. 난 그렇게 생각해.', 'look']],
  [['…안 멈추네. 그래.', 'tired'], ['그럼 다음엔 비장의 수를 꺼낼게. 진짜 특별한 거.', 'closed'], ['그러니까 이번 공격에서 살아남으면, 그땐…', 'glow']],
];

export const SPECIAL_INTRO = [
  ['…좋아. 약속했으니까.', 'tired'],
  ['특별 공격, 간다. 이걸 버틴 녀석은 지금까지 아무도 없었어.', 'glow'],
  ['…그야 써 본 적이 없으니까.', 'wink'],
];

export const NOTHING_INTRO = [
  ['…하아… 하아…', 'tired'],
  ['…좋아. 그럼 이제 진짜 특별 공격이야.', 'tired'],
  ['준비됐어? 놀라지 마.', 'closed'],
  ['…짜잔.', 'idle'],
  ['그래. 아무것도 없어. 이게 다야.', 'closed'],
  ['네 차례가 안 오면 넌 아무것도 못 하잖아. 그러니까 난 내 차례를 안 끝낼 거야.', 'idle'],
  ['네가 지루해서 그만둘 때까지, 여기 계속 서 있을게. 영원히.', 'wink'],
];
// 아무것도 하지 않는 동안 저절로 나오는 말풍선: [잠들기까지의 진행도 0~1, 대사, 표정]
export const NOTHING_BUBBLES = [
  [.16, '…아직 있어? 끈질기네.', 'idle'],
  [.38, '난 기다리는 건 자신 있어. 하루 종일도 서 있을 수 있거든.', 'closed'],
  [.62, '…하암.', 'tired'],
  [.8, '…안 졸려. 눈만… 잠깐…', 'tired'],
  [1, '…zzz', 'sleep'],
];
export const ASLEEP_NOTES = ['* 샌즈가 잠들었다.', '* 지금이라면… 무엇이든 할 수 있다.'];
export const PUSH_HINT = '벽을 밀면 상자가 움직인다.';
export const WAKE_LINE = '…어이쿠. 설마 내가 그냥 가만히 서서 맞아 줄';

export const DEATH = [
  ['…', 'hurt'],
  ['…아.', 'hurt'],
  ['결국 여기까지네.', 'tired'],
  ['뭐… 나쁘지 않았어. 이렇게 땀 흘려 본 건 오랜만이야.', 'closed'],
  ['…난 이만 가 볼게. 단골 가게에 외상도 남았고.', 'closed'],
  ['파피루스. 배고프지? …형이 맛있는 거 사 갈게.', 'look'],
];
export const KILL_NOTES = ['* 회랑이 조용해졌다.', '* 바닥에는 파란 후드 한 벌만 남아 있다.', '* …당신은 이겼다.'];

export const MERCY_NOTES = ['* 당신은 잠든 샌즈를 한참 바라보았다.', '* …쥐고 있던 것을, 바닥에 내려놓았다.'];
export const MERCY_TALK = [
  ['…', 'sleep'],
  ['…어라. 안 찔렀네.', 'wink'],
  ['사실 반쯤은 자는 척이었어. 넌 분명 찌를 줄 알았거든.', 'closed'],
  ['난 누가 쉽게 달라진다고는 안 믿어. 솔직히 지금도 반신반의야.', 'idle'],
  ['근데 방금 넌 멈췄어. 보는 사람도 없고, 시킨 사람도 없는데.', 'look'],
  ['…그거면 됐어. 오늘은.', 'closed'],
  ['가 봐, 꼬마. 되돌릴 수 있는 게 남아 있으면, 되돌릴 수 있을 때 되돌려.', 'idle'],
  ['다음에 보면 내 단골 가게에서 내가 살게. 케첩은 무제한이야.', 'wink'],
];

export const ENDINGS = {
  kill: { title: '먼지만 남은 회랑', sub: 'ENDING · DUST', closing: '이겼는데, 축하해 줄 사람이 아무도 없다.' },
  mercy: { title: '내려놓은 손', sub: 'ENDING · MERCY', closing: '마지막 한 번은, 다르게 골랐다.' },
};

export function checkLines(phase) {
  if (phase === 'offer') return ['* 샌즈 — 당신을 살려주려 하고 있다.', '* …정말일까?'];
  if (phase === 'p2') return ['* 샌즈 — 공격 1 · 방어 1', '* 숨이 가빠 보인다. 그런데도 아직 한 대도 맞지 않았다.'];
  return ['* 샌즈 — 공격 1 · 방어 1', '* 지하에서 제일 약한 몬스터. 한 번에 1의 피해밖에 못 준다. …겉보기엔.'];
}
export const JOKES = [
  { text: ['* 뼈 있는 농담을 건넸다.'], reply: ['…헤. 그건 좀 골 때리네.', 'closed'] },
  { text: ['* 해골이 제일 좋아하는 악기가 뭔지 물어봤다.'], reply: ['트롬"본". …그건 내가 백 번은 써먹은 건데.', 'wink'] },
  { text: ['* 썰렁한 농담을 했다. 회랑에 찬바람이 분다.'], reply: ['…뼈가 시리네. 진짜로.', 'closed'] },
  { text: ['* 더는 떠오르는 농담이 없다.'], reply: ['소재가 다 떨어졌어? 나도 그래. 그래서 싸우는 중이잖아.', 'idle'] },
];
export function mercyLines(phase) {
  if (phase === 'p2') return ['* 살려주려 했다.', '* 샌즈: "…그 얘긴 아까 끝났잖아."'];
  return ['* 살려주려 했다.', '* 샌즈는 어깨만 으쓱한다. 아직 그럴 때가 아닌 모양이다.'];
}
export const DODGE_NOTES = ['* 샌즈가 가볍게 피했다.', '* 또 빗나갔다.', '* 닿을 듯 닿지 않는다.', '* 칼끝이 허공을 갈랐다.'];

export const FLAVOR = {
  p1: ['* 샌즈가 주머니에 손을 넣은 채 서 있다.', '* 회랑에 금빛 저녁 햇살이 비친다.', '* 진짜 싸움이 시작된 것 같다.', '* 샌즈의 눈이 당신의 손을 따라 움직인다.'],
  offer: ['* 샌즈가 당신을 살려주려 한다.'],
  p2: ['* 샌즈가 땀을 흘리고 있다.', '* 숨소리가 조금씩 거칠어진다.', '* 뼈 부딪치는 소리가 회랑에 울린다.', '* 샌즈가 뭔가를 준비하고 있다.'],
  karma: '* 보라색 통증이 천천히 번진다.',
};

export const GAMEOVER = [
  ['아직이야.', '포기하기엔 일러.'],
  ['…다시 일어설 수 있어.', '몇 번이라도.'],
  ['넘어진 횟수는 중요하지 않아.', '중요한 건 다시 일어난 횟수야.'],
];
export const GAMEOVER_DUNK = ['걸려들었네.', '그렇게 많은 걸 저질러 놓고, 말 한마디에 끝날 줄 알았어?', '정말로 미안하다면… 다시는 여기 오지 마.'];

export const RESUME = { p2: [['…어디까지 했더라.', 'look'], ['아, 여기쯤이지. 앞부분은 건너뛰자. 서로 귀찮잖아.', 'closed'], ['그럼, 다시 안 봐주는 걸로.', 'glow']], special: [['…또 여기네.', 'tired'], ['좋아. 특별 공격, 한 번 더 간다.', 'glow']] };
