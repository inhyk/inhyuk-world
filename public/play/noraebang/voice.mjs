// 젤리 가수의 목소리. 성대 소리(톱니파) 를 입 모양 필터(포먼트 넷) 에 통과시켜 모음을 만들고,
// 바람 소리(잡음) 로 ㅅ, ㅈ, ㅎ, 터지는 소리를 더한다. 가사 한 줄을 이어서(레가토) 부른다.
import { SINGERS } from './singers.mjs';
import { thirdBelow } from './score.mjs';

// 모음별 포먼트 (Hz). 가수마다 formant 배율을 곱한다.
const VOWEL = {
  a: [850, 1400, 2700, 3700], eo: [620, 1080, 2650, 3600], o: [470, 860, 2600, 3500], u: [380, 900, 2450, 3500],
  eu: [420, 1550, 2700, 3700], i: [310, 2650, 3250, 4000], e: [540, 2050, 2800, 3800],
};
// 겹모음은 [시작 모양, 끝 모양]
const MEDIAL = {
  ㅏ: ['a'], ㅐ: ['e'], ㅑ: ['i', 'a'], ㅒ: ['i', 'e'], ㅓ: ['eo'], ㅔ: ['e'], ㅕ: ['i', 'eo'], ㅖ: ['i', 'e'],
  ㅗ: ['o'], ㅘ: ['u', 'a'], ㅙ: ['u', 'e'], ㅚ: ['u', 'e'], ㅛ: ['i', 'o'], ㅜ: ['u'], ㅝ: ['u', 'eo'], ㅞ: ['u', 'e'],
  ㅟ: ['u', 'i'], ㅠ: ['i', 'u'], ㅡ: ['eu'], ㅢ: ['eu', 'i'], ㅣ: ['i'],
};
const OPEN = [1, 0.75, 0.42, 0.22];
const HUM = [1, 0.1, 0.06, 0.03];
const LIQUID = [1, 0.5, 0.3, 0.14];

const VELAR = [300, 1900, 2350, 3500], ALVEOLAR = [300, 1750, 2700, 3700], LABIAL = [300, 850, 2300, 3500];
// 첫소리. lead = 박자보다 먼저 시작하는 길이(초), burst/fric = [잡음 높이, 세기], asp = 숨소리 길이
const ONSET = {
  ㄱ: { stop: VELAR, lead: 0.035, burst: [1900, 0.3], asp: 0.012 },
  ㄲ: { stop: VELAR, lead: 0.05, burst: [1900, 0.42], asp: 0 },
  ㅋ: { stop: VELAR, lead: 0.035, burst: [1900, 0.3], asp: 0.07 },
  ㄷ: { stop: ALVEOLAR, lead: 0.035, burst: [3800, 0.3], asp: 0.012 },
  ㄸ: { stop: ALVEOLAR, lead: 0.05, burst: [3800, 0.42], asp: 0 },
  ㅌ: { stop: ALVEOLAR, lead: 0.035, burst: [3800, 0.3], asp: 0.07 },
  ㅂ: { stop: LABIAL, lead: 0.035, burst: [1100, 0.22], asp: 0.012 },
  ㅃ: { stop: LABIAL, lead: 0.05, burst: [1100, 0.32], asp: 0 },
  ㅍ: { stop: LABIAL, lead: 0.035, burst: [1100, 0.22], asp: 0.07 },
  ㅈ: { stop: [300, 2000, 2800, 3700], lead: 0.055, fric: [4200, 0.42], fricLen: 0.04, asp: 0.01 },
  ㅉ: { stop: [300, 2000, 2800, 3700], lead: 0.06, fric: [4400, 0.5], fricLen: 0.03, asp: 0 },
  ㅊ: { stop: [300, 2000, 2800, 3700], lead: 0.055, fric: [4200, 0.45], fricLen: 0.05, asp: 0.05 },
  ㅅ: { hiss: [6300, 0.5], lead: 0.07 },
  ㅆ: { hiss: [6800, 0.62], lead: 0.095 },
  ㅎ: { breath: 0.4, lead: 0.06 },
  ㄴ: { nasal: [280, 1550, 2650, 3600], lead: 0.06 },
  ㅁ: { nasal: [280, 1000, 2500, 3500], lead: 0.06 },
  ㄹ: { flap: [350, 1500, 2400, 3400], lead: 0.03 },
};
// 받침
const CODA = {
  ㄴ: { nasal: [280, 1550, 2650, 3600] }, ㅁ: { nasal: [280, 1000, 2500, 3500] }, ㅇ: { nasal: [300, 1850, 2300, 3400] },
  ㄹ: { liquid: [380, 1250, 2900, 3800] }, ㄱ: { stop: VELAR }, ㄷ: { stop: ALVEOLAR }, ㅂ: { stop: LABIAL },
};

const freq = (midi) => 440 * 2 ** ((midi - 69) / 12);

// synth: Synth 객체(ctx, noise, track, send 를 쓴다). timeOf: 박자 → 오디오 시각.
export function singLine(synth, { syllables, singer, harmony = false, key = 0, level = 1, timeOf }) {
  const ctx = synth.ctx, s = SINGERS[singer];
  const lastSyllable = syllables.at(-1);
  const first = timeOf(syllables[0].beat), finish = timeOf(lastSyllable.beat + lastSyllable.dur);
  const start = Math.max(ctx.currentTime + 0.005, first - 0.16), end = finish + 0.35;

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  const vibrato = ctx.createOscillator(), depth = ctx.createGain();
  vibrato.frequency.value = 5.3;
  depth.gain.value = 0;
  vibrato.connect(depth).connect(osc.detune);
  const voice = ctx.createGain();
  voice.gain.value = 0;
  osc.connect(voice);
  const noise = ctx.createBufferSource();
  noise.buffer = synth.noise;
  noise.loop = true;
  const breath = ctx.createGain();
  breath.gain.value = 0;
  noise.connect(breath);
  const hissFilter = ctx.createBiquadFilter();
  hissFilter.type = 'bandpass';
  hissFilter.Q.value = 1.4;
  const hiss = ctx.createGain();
  hiss.gain.value = 0;
  noise.connect(hissFilter).connect(hiss);
  const out = ctx.createGain();
  out.gain.value = 0.9 * s.level * level;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 5200;
  tone.connect(out);
  hiss.connect(out);
  const bands = [5, 8, 12, 14].map((q) => {
    const filter = ctx.createBiquadFilter(), amp = ctx.createGain();
    filter.type = 'bandpass';
    filter.Q.value = q;
    voice.connect(filter);
    breath.connect(filter);
    filter.connect(amp).connect(tone);
    return { filter, amp };
  });
  synth.send(out, 0.28, 0.12);
  for (const source of [osc, vibrato, noise]) synth.track(source, start, end);

  const at = (param, value, time, constant) => param.setTargetAtTime(value, Math.max(time, start), constant);
  const shape = (formants, time, constant = 0.02) => formants.forEach((value, k) => at(bands[k].filter.frequency, value * s.formant, time, constant));
  const amps = (values, time, constant = 0.015) => values.forEach((value, k) => at(bands[k].amp.gain, value, time, constant));
  const pitchOf = (syllable) => freq((harmony ? thirdBelow(syllable.midi, key) : syllable.midi) + s.shift);

  // 처음 모양
  const firstVowel = MEDIAL[syllables[0].sound.vowel];
  VOWEL[firstVowel[0]].forEach((value, k) => bands[k].filter.frequency.setValueAtTime(value * s.formant, start));
  OPEN.forEach((value, k) => bands[k].amp.gain.setValueAtTime(value, start));
  osc.frequency.setValueAtTime(pitchOf(syllables[0]), start);

  syllables.forEach((syllable, index) => {
    const { onset, vowel, coda } = syllable.sound;
    const previous = syllables[index - 1], next = syllables[index + 1];
    const T = timeOf(syllable.beat), noteEnd = timeOf(syllable.beat + syllable.dur);
    const restBefore = !previous || T - timeOf(previous.beat + previous.dur) > 0.05;
    const restAfter = !next || timeOf(next.beat) - noteEnd > 0.05;
    const [glide, target] = MEDIAL[vowel].length === 2 ? MEDIAL[vowel].map((v) => VOWEL[v]) : [null, VOWEL[MEDIAL[vowel][0]]];
    const opening = glide ?? target;
    const f0 = pitchOf(syllable);

    // 음높이: 이어 부를 땐 살짝 미끄러지듯, 쉬었다 시작할 땐 아래에서 살짝 올려 잡는다
    if (restBefore) { osc.frequency.setValueAtTime(f0 * 0.985, Math.max(start, T - 0.09)); at(osc.frequency, f0, T - 0.02, 0.03); }
    else at(osc.frequency, f0, T - 0.03, 0.022);
    if (restBefore) at(breath.gain, s.breath, T - 0.03, 0.02);

    // 첫소리
    const c = onset ? ONSET[onset] : null;
    const room = restBefore ? 0.12 : Math.max(0.02, (T - timeOf(previous.beat)) * 0.45);
    const lead = c ? Math.min(c.lead, room) : 0, Tc = T - lead;
    if (!c) {
      shape(opening, T - 0.03, restBefore ? 0.006 : 0.025);
      amps(OPEN, T - 0.03);
      at(voice.gain, 1, T - 0.01, restBefore ? 0.015 : 0.02);
    } else if (c.stop) {
      // 입을 막았다가(거의 무음) 터뜨린다
      shape(c.stop, Tc, 0.012);
      at(voice.gain, 0.04, Tc, 0.006);
      const [noiseFreq, noiseGain] = c.fric ?? c.burst;
      const burstAt = c.fricLen ? T - c.fricLen : T - 0.012;
      hissFilter.frequency.setValueAtTime(noiseFreq, Math.max(start, burstAt - 0.002));
      at(hiss.gain, noiseGain, burstAt, 0.003);
      at(hiss.gain, 0, c.fricLen ? T : burstAt + 0.012, 0.01);
      if (c.asp) { at(breath.gain, 0.3, T, 0.005); at(breath.gain, s.breath, T + c.asp, 0.01); }
      at(voice.gain, 1, T + c.asp, 0.012);
      shape(opening, T + c.asp * 0.5, 0.022);
      amps(OPEN, T, 0.01);
    } else if (c.hiss) {
      // ㅅ, ㅆ: 목소리를 끄고 쉬익
      at(voice.gain, 0, Tc, 0.008);
      hissFilter.frequency.setValueAtTime(c.hiss[0], Math.max(start, Tc - 0.002));
      at(hiss.gain, c.hiss[1], Tc, 0.012);
      at(hiss.gain, 0, T, 0.01);
      shape(opening, Tc, 0.02);
      amps(OPEN, Tc);
      at(voice.gain, 1, T, 0.012);
    } else if (c.breath) {
      // ㅎ: 입 모양은 모음 그대로, 숨만 내쉰다
      at(voice.gain, 0.08, Tc, 0.01);
      at(breath.gain, c.breath, Tc, 0.012);
      shape(opening, Tc, 0.015);
      amps(OPEN, Tc);
      at(breath.gain, s.breath, T, 0.015);
      at(voice.gain, 1, T, 0.015);
    } else if (c.nasal) {
      shape(c.nasal, Tc, 0.012);
      amps(HUM, Tc, 0.012);
      at(voice.gain, 0.7, Tc, restBefore ? 0.012 : 0.02);
      shape(opening, T, 0.02);
      amps(OPEN, T);
      at(voice.gain, 1, T, 0.015);
    } else if (c.flap) {
      shape(c.flap, Tc, 0.008);
      amps(LIQUID, Tc, 0.008);
      at(voice.gain, 0.5, Tc, 0.008);
      shape(opening, T, 0.02);
      amps(OPEN, T);
      at(voice.gain, 1, T, 0.012);
    }
    if (glide) shape(target, T + 0.045, 0.03);

    // 길게 끄는 음에는 비브라토
    at(depth.gain, 0, T, 0.02);
    if (noteEnd - T > 0.4) at(depth.gain, 26, T + 0.22, 0.14);

    // 받침
    const k = coda ? CODA[coda] : null;
    const codaLength = Math.min(0.1, Math.max(0.04, (noteEnd - T) * 0.3));
    const Tk = noteEnd - codaLength - (restAfter ? 0 : 0.01);
    if (k?.nasal) { shape(k.nasal, Tk); amps(HUM, Tk, 0.02); at(voice.gain, 0.7, Tk, 0.02); }
    else if (k?.liquid) { shape(k.liquid, Tk); amps(LIQUID, Tk, 0.02); at(voice.gain, 0.8, Tk, 0.02); }
    else if (k?.stop) { shape(k.stop, Tk, 0.015); at(voice.gain, 0.02, noteEnd - Math.min(0.05, codaLength * 0.6), 0.006); }

    if (restAfter) {
      at(voice.gain, 0, noteEnd - 0.03, 0.035);
      at(breath.gain, 0, noteEnd, 0.03);
    }
  });

  return { out, end, singer };
}
