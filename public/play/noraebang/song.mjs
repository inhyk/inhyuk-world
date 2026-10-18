// 「인혁 월드로 와!」 악보. 멜로디는 "음:박자" 를 띄어쓰기로 잇고, "|" 는 마디 표시(읽을 때 무시)다.
// 가사 한 글자가 음표 하나다. 문장부호와 띄어쓰기는 음표를 쓰지 않는다. r 은 쉼표.
// 화음과 멜로디는 다장조로 적고, key 만큼 반음을 올려 연주한다(마지막 후렴은 라장조).

export const SONG = {
  title: '인혁 월드로 와!',
  subtitle: '인혁 월드 주제가',
  credit: '작사·작곡 수영(AI)',
  bpm: 124,
};

const VERSE = [
  { bar: 0, notes: 'E4:.5 E4:.5 A4:.5 A4:.5 B4:1 C5:.5 B4:.5 | A4:1 G4:1 A4:1.5 r:.5' },
  { bar: 2, notes: 'G4:.5 G4:.5 C5:.5 C5:.5 D5:1 E5:.5 D5:.5 | D5:1.5 B4:1.5 r:1' },
  { bar: 4, notes: 'E4:.5 E4:.5 A4:.5 A4:.5 B4:.5 C5:1 E5:.5 | D5:.5 C5:.5 A4:.5 C5:2 r:.5' },
  { bar: 6, notes: 'E5:.5 D5:.5 C5:.5 D5:.5 E5:1 D5:1 | B4:1 D5:2 r:1' },
];

const PRE = [
  { bar: 0, notes: 'A4:.5 A4:.5 C5:1 D5:.5 C5:1.5 | D5:1 B4:1 D5:2' },
  { bar: 2, notes: 'B4:.5 B4:.5 E5:1 D5:.5 B4:1.5 | C5:1 B4:1 A4:2' },
  { bar: 4, notes: 'C5:1 D5:1 E5:1 G5:3 r:2', text: '준비됐니?' },
  { bar: 6, notes: 'D5:1 E5:1 F5:1 G5:1 r:4', text: '하나 둘 셋!' },
];

const CHORUS = [
  { bar: 0, notes: 'C5:1 E5:.5 G5:1 G5:.5 A5:1 | G5:3 r:1', text: '인혁 월드로 와!' },
  { bar: 2, notes: 'E5:.5 E5:.5 E5:.5 D5:.5 C5:.5 D5:.5 E5:1 | F5:.5 E5:.5 C5:2 r:1', text: '버튼 하나 누르면 시작돼' },
  { bar: 4, notes: 'C5:1 E5:.5 G5:1 G5:.5 A5:1 | G5:3 r:1', text: '인혁 월드로 와!' },
  { bar: 6, notes: 'E5:.5 E5:.5 C5:1 E5:.5 E5:.5 C5:1 | D5:.5 E5:.5 F5:2 r:1', text: '샌즈도 뿌요도 기다려' },
  { bar: 8, notes: 'G5:.5 G5:.5 E5:.5 G5:.5 A5:1 G5:1 | D5:1 G5:2 r:1', text: '넘어져도 다시 점프' },
  { bar: 10, notes: 'E5:.5 E5:.5 C5:.5 E5:.5 A5:1 G5:1 | G5:1 F5:2 r:1', text: '끝판왕도 문제없어' },
  { bar: 12, notes: 'E5:.5 E5:.5 E5:.5 G5:.5 G5:.5 G5:.5 A5:.5 G5:.5 | G5:.5 F5:.5 E5:1 D5:1.5 r:.5', text: '오늘도 새로운 게임을 만들자' },
  { bar: 14, notes: 'F5:1 G5:1 A5:1 G5:4 r:1', text: '인혁 월드!' },
];
const CHORUS_CHORDS = ['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G'];

const withText = (lines, texts) => lines.map((line, index) => ({ ...line, text: texts[index] ?? line.text }));

export const SECTIONS = [
  {
    id: 'intro', label: '전주', style: 'intro', key: 0, bars: 4, chords: ['C', 'G', 'Am', 'F'],
    lines: [{ bar: 0, notes: 'C5:1 E5:.5 G5:1 G5:.5 A5:1 | G5:3 r:1 | E5:.5 E5:.5 E5:.5 D5:.5 C5:.5 D5:.5 E5:1 | F5:.5 E5:.5 C5:2 r:1' }],
  },
  {
    id: 'verse1', label: '1절', style: 'verse', key: 0, bars: 8, chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'],
    lines: withText(VERSE, ['키보드 위에 손을 올리면', '내 머릿속 세상이 열려', '점프하는 친구 반짝이는 별', '모두 내가 만든 거야']),
  },
  {
    id: 'pre1', label: '1절', style: 'pre', key: 0, bars: 8, chords: ['F', 'G', 'Em', 'Am', 'F', 'G', 'Dm', 'G'],
    lines: withText(PRE, ['버그가 나도 괜찮아', '다시 고치면 되니까']),
  },
  { id: 'chorus1', label: '후렴', style: 'chorus', key: 0, bars: 16, chords: CHORUS_CHORDS, lines: CHORUS },
  {
    id: 'interlude', label: '간주', style: 'interlude', key: 0, bars: 4, chords: ['C', 'G', 'Am', 'F'],
    lines: [{ bar: 0, notes: 'C5:.5 E5:.5 G5:.5 C6:.5 G5:.5 E5:.5 G5:.5 E5:.5 | B4:.5 D5:.5 G5:.5 B5:.5 G5:.5 D5:.5 G5:.5 D5:.5 | A4:.5 C5:.5 E5:.5 A5:.5 E5:.5 C5:.5 E5:.5 C5:.5 | A4:.5 C5:.5 F5:.5 A5:.5 G5:1 r:1' }],
  },
  {
    id: 'verse2', label: '2절', style: 'verse', key: 0, bars: 8, chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'],
    lines: withText(VERSE, ['종이 위에 그린 그림 하나', '화면 속에 살아 움직여', '친구들이 하나둘 모여들어', '같이 하면 더 재밌어']),
  },
  {
    id: 'pre2', label: '2절', style: 'pre', key: 0, bars: 8, chords: ['F', 'G', 'Em', 'Am', 'F', 'G', 'Dm', 'G'],
    lines: withText(PRE, ['또 져도 진짜 괜찮아', '한 번 더 하면 되니까']),
  },
  { id: 'chorus2', label: '후렴', style: 'chorus', key: 0, bars: 16, chords: CHORUS_CHORDS, lines: CHORUS },
  {
    id: 'bridge', label: '브릿지', style: 'bridge', key: 0, bars: 8, chords: ['F', 'G', 'Em', 'Am', 'Dm', 'G', 'F', 'A7'],
    lines: [
      { bar: 0, notes: 'C5:.5 C5:.5 A4:1 C5:.5 D5:.5 C5:1 | B4:1 D5:1 D5:2', text: '언젠가 어른이 되어도' },
      { bar: 2, notes: 'B4:.5 B4:.5 E5:1 D5:.5 B4:.5 G4:1 | B4:1 A4:3', text: '이 마음 잊지 않을게' },
      { bar: 4, notes: 'A4:.5 A4:.5 D5:1 F5:.5 E5:.5 D5:1 | D5:.5 B4:.5 D5:3', text: '처음 만든 그 게임처럼' },
      { bar: 6, notes: 'C5:.5 C5:.5 D5:.5 D5:.5 E5:1 F5:1 | E5:1 G5:1 A5:2', text: '두근두근 계속될 거야' },
    ],
  },
  { id: 'final', label: '마지막 후렴', style: 'final', key: 2, bars: 16, chords: CHORUS_CHORDS, lines: CHORUS },
  {
    id: 'outro', label: '후주', style: 'outro', key: 2, bars: 4, chords: ['F', 'G', 'C', 'C'],
    lines: [
      { bar: 0, notes: 'C5:1 D5:1 E5:2 | G5:4', text: '인혁 월드!' },
      { bar: 2, notes: 'C6:4 r:4' },
    ],
  },
];
