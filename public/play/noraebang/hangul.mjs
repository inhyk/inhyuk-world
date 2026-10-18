// 가사 글자를 노래할 소리로 바꾼다: 첫소리, 모음, 받침 소리.
// 실제로 소리 나는 대로 바꾸는 규칙 몇 가지를 쓴다(연음, 된소리, 콧소리 되기, 구개음화).
//   손을 → 소늘, 괜찮아 → 괜차나, 같이 → 가치, 잊지 → 읻찌, 됐니 → 됀니, 없어 → 업써

const ONSETS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const VOWELS = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const CODAS = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

// 받침 뒤에 ㅇ 으로 시작하는 글자가 오면: [남는 받침, 다음 글자로 넘어가는 소리]
const LIAISON = {
  ㄳ: ['ㄱ', 'ㅆ'], ㄵ: ['ㄴ', 'ㅈ'], ㄶ: [null, 'ㄴ'], ㄺ: ['ㄹ', 'ㄱ'], ㄻ: ['ㄹ', 'ㅁ'], ㄼ: ['ㄹ', 'ㅂ'],
  ㄽ: ['ㄹ', 'ㅆ'], ㄾ: ['ㄹ', 'ㅌ'], ㄿ: ['ㄹ', 'ㅍ'], ㅀ: [null, 'ㄹ'], ㅄ: ['ㅂ', 'ㅆ'], ㅎ: [null, null], ㅇ: ['ㅇ', null],
};
// 받침이 실제로 나는 일곱 소리
const CODA_SOUND = {
  ㄱ: 'ㄱ', ㄲ: 'ㄱ', ㅋ: 'ㄱ', ㄳ: 'ㄱ', ㄺ: 'ㄱ', ㄴ: 'ㄴ', ㄵ: 'ㄴ', ㄶ: 'ㄴ',
  ㄷ: 'ㄷ', ㅅ: 'ㄷ', ㅆ: 'ㄷ', ㅈ: 'ㄷ', ㅊ: 'ㄷ', ㅌ: 'ㄷ', ㅎ: 'ㄷ',
  ㄹ: 'ㄹ', ㄼ: 'ㄹ', ㄽ: 'ㄹ', ㄾ: 'ㄹ', ㅀ: 'ㄹ', ㅁ: 'ㅁ', ㄻ: 'ㅁ', ㅂ: 'ㅂ', ㅍ: 'ㅂ', ㅄ: 'ㅂ', ㄿ: 'ㅂ', ㅇ: 'ㅇ',
};
const TENSE = { ㄱ: 'ㄲ', ㄷ: 'ㄸ', ㅂ: 'ㅃ', ㅅ: 'ㅆ', ㅈ: 'ㅉ' };
const NASAL = { ㄱ: 'ㅇ', ㄷ: 'ㄴ', ㅂ: 'ㅁ' };

export function decompose(char) {
  const code = (char ?? '').charCodeAt(0) - 0xac00;
  if (!(code >= 0 && code <= 11171)) return null;
  return { onset: ONSETS[Math.floor(code / 588)], vowel: VOWELS[Math.floor((code % 588) / 28)], coda: CODAS[code % 28] || null };
}

// 한 줄의 한글 글자마다 { char, onset, vowel, coda } 를 돌려준다. onset 이 null 이면 모음으로 바로 시작한다.
export function pronounce(text) {
  const chars = [...text];
  const out = [];
  chars.forEach((char, i) => {
    const parts = decompose(char);
    if (parts) out.push({ char, ...parts, joined: decompose(chars[i + 1]) !== null });
  });
  for (let i = 0; i < out.length; i++) {
    const syllable = out[i], next = syllable.joined ? out[i + 1] : null;
    let coda = syllable.coda;
    if (coda && next && next.onset === 'ㅇ') {
      const [keep, move] = LIAISON[coda] ?? [null, coda];
      coda = keep;
      if (move) {
        // 같이 → 가치, 굳이 → 구지
        next.onset = next.vowel === 'ㅣ' && move === 'ㅌ' ? 'ㅊ' : next.vowel === 'ㅣ' && move === 'ㄷ' ? 'ㅈ' : move;
      }
    }
    coda = coda ? CODA_SOUND[coda] : null;
    if (next && NASAL[coda] && (next.onset === 'ㄴ' || next.onset === 'ㅁ')) coda = NASAL[coda];
    if (next && ['ㄱ', 'ㄷ', 'ㅂ'].includes(coda) && TENSE[next.onset]) next.onset = TENSE[next.onset];
    // 할게, 않을게 처럼 ㄹ 받침 뒤 '게' 는 '께'
    if (next && coda === 'ㄹ' && next.onset === 'ㄱ' && next.char === '게') next.onset = 'ㄲ';
    syllable.sound = { onset: syllable.onset === 'ㅇ' ? null : syllable.onset, vowel: syllable.vowel, coda };
  }
  return out.map(({ char, sound }) => ({ char, ...sound }));
}

// 젤리 입 크기용: 모음마다 입을 얼마나 벌리는지
const OPEN = { ㅏ: 1, ㅑ: 1, ㅘ: 1, ㅓ: 0.8, ㅕ: 0.8, ㅝ: 0.8, ㅐ: 0.75, ㅔ: 0.7, ㅒ: 0.75, ㅖ: 0.7, ㅙ: 0.75, ㅞ: 0.7, ㅚ: 0.6, ㅗ: 0.6, ㅛ: 0.6, ㅜ: 0.45, ㅠ: 0.45, ㅟ: 0.4, ㅡ: 0.35, ㅢ: 0.35, ㅣ: 0.3 };
export const mouthOpen = (vowel) => OPEN[vowel] ?? 0.5;
