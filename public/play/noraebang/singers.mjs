// 노래하는 젤리 둘과 "누가 어디를 부르나". 소리와 화면이 같이 쓴다.

export const SINGERS = {
  pink: { name: '핑크 젤리', color: '#ff4fa3', side: 0, shift: 0, formant: 1.1, level: 1, breath: 0.025 },
  blue: { name: '파랑 젤리', color: '#3ee8ff', side: 1, shift: -12, formant: 0.9, level: 1.15, breath: 0.04 },
};

export const MODES = [
  { id: 'duet', label: '둘이 같이' },
  { id: 'pink', label: '핑크 젤리' },
  { id: 'blue', label: '파랑 젤리' },
  { id: 'off', label: '반주만' },
];

// 둘이 같이: 1절과 브릿지는 핑크, 2절은 파랑, 후렴은 둘이. 파랑은 한 옥타브 아래.
const DUET = {
  verse1: ['pink'], pre1: ['pink'], chorus1: ['pink', 'blue'],
  verse2: ['blue'], pre2: ['blue'], chorus2: ['pink', 'blue'],
  bridge: ['pink'], final: ['pink', 'blue'], outro: ['pink', 'blue'],
};

export function singersFor(mode, section) {
  if (mode === 'off') return [];
  if (mode === 'duet') return DUET[section] ?? ['pink'];
  return [mode];
}

// 둘이 부를 때 마지막 후렴의 파랑 젤리는 3도 아래 화음을 부른다
export const harmonyPart = (mode, section, singer) => mode === 'duet' && section === 'final' && singer === 'blue';
