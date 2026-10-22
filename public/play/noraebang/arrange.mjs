// 시간표(score)에서 반주를 만든다: 드럼, 베이스, 화음, 아르페지오, 화음 멜로디, 그리고 가사 줄마다 노래 한 번.
// 결과는 { beat, dur, inst, vel, midi?, notes? } 목록이다. 소리를 내지 않는 순수 함수라 검사할 수 있다.
import { thirdBelow } from './score.mjs';

const STEP = 0.25; // 16분음표 한 칸 = 0.25박

function chordMidis(chord, low) {
  // low 이상에서 시작하는 닫힌 자리바꿈
  return chord.tones.map((tone) => {
    let midi = low - (low % 12) + ((chord.root + tone) % 12);
    while (midi < low) midi += 12;
    return midi;
  }).sort((a, b) => a - b);
}

function bassRoot(chord) {
  const midi = 36 + chord.root; // C2 부터 A2 근처까지
  return midi > 45 ? midi - 12 : midi;
}

const every = (n, from = 0) => Array.from({ length: Math.ceil((16 - from) / n) }, (_, k) => from + k * n);

export function arrange(score) {
  const events = [];
  const add = (beat, dur, inst, vel, extra) => events.push({ beat, dur, inst, vel, ...extra });
  const note = (beat, dur, inst, vel, midi) => add(beat, dur, inst, vel, { midi });
  const hits = (beat, inst, steps, vel, dur = 0.25) => steps.forEach((step) => add(beat + step * STEP, dur, inst, typeof vel === 'function' ? vel(step) : vel));
  const harmonyFrom = score.sections.find((section) => section.id === 'chorus2').startBeat + 32;

  for (const chord of score.chords) {
    const b = chord.beat, i = chord.barIndex, style = chord.style, last = chord.lastBar;
    const root = bassRoot(chord);
    const triad = chordMidis(chord, 60), lowTriad = chordMidis(chord, 55);
    const pad = (vel, dur = 4, notes = lowTriad) => add(b, dur, 'pad', vel, { notes });
    const stabs = (vel, notes) => [2, 6, 10, 14].forEach((step) => add(b + step * STEP, 0.32, 'pluck', vel, { notes }));
    const bassEighths = (octaves, vel = 0.85) => every(2).forEach((step) => note(b + step * STEP, 0.4, 'bass', vel, octaves && step % 4 === 2 ? root + 12 : root));

    if (style === 'intro') {
      if (i === 0) add(b, 2, 'crash', 0.5);
      triad.concat(triad.map((m) => m + 12)).forEach((midi, k) => note(b + k * 0.5, 0.5, 'arp', 0.5, midi));
      pad(0.6);
      hits(b, 'hat', [2, 6, 10, 14], 0.35);
      hits(b, 'kick', i < 2 ? [0] : [0, 8], 0.9);
      if (i >= 2) { hits(b, 'snare', [4, 12], 0.6); bassEighths(true, 0.8); }
      if (last) hits(b, 'tom', [12, 13, 14, 15], (s) => 0.5 + (s - 12) * 0.1);
    }

    if (style === 'verse') {
      hits(b, 'kick', last ? [0, 8] : [0, 6, 8], 0.9);
      hits(b, 'snare', [4, 12], 0.55);
      hits(b, 'hat', every(2), (s) => (s % 4 === 0 ? 0.32 : 0.2));
      note(b, 1.5, 'bass', 0.85, root);
      note(b + 1.5, 0.5, 'bass', 0.7, root);
      note(b + 2, 1, 'bass', 0.8, root);
      note(b + 3, 1, 'bass', 0.7, root + 7);
      stabs(0.55, lowTriad);
      if (chord.section === 'verse2') pad(0.35);
    }

    if (style === 'pre') {
      pad(0.7);
      if (i < 6) {
        hits(b, 'kick', i < 4 ? [0, 8] : [0, 4, 8, 12], 0.9);
        hits(b, 'snare', [4, 12], 0.55);
        hits(b, 'hat', every(1), (s) => (s % 2 === 0 ? 0.22 : 0.12));
        triad.concat(triad.map((m) => m + 12), [triad[1] + 12, triad[0] + 12]).forEach((midi, k) => note(b + k * 0.5, 0.5, 'arp', 0.4, midi));
        bassEighths(false, 0.8);
      } else if (i === 6) {
        // "하나 둘 셋!" 박마다 쾅
        hits(b, 'kick', [0, 4, 8, 12], 1);
        hits(b, 'snare', [0, 4, 8, 12], 0.75);
        hits(b, 'clap', [0, 4, 8, 12], 0.6);
        [0, 4, 8, 12].forEach((step) => note(b + step * STEP, 0.9, 'bass', 0.9, root));
        add(b, 8, 'riser', 0.8);
      } else {
        hits(b, 'kick', [0], 0.9);
        hits(b, 'snare', every(1), (s) => 0.2 + (s / 15) * 0.75);
        every(2).slice(0, 4).forEach((step) => note(b + step * STEP, 0.4, 'bass', 0.8, root));
      }
    }

    if (style === 'chorus' || style === 'final' || style === 'interlude') {
      const big = style === 'final';
      if (i === 0 || (big && i === 8)) add(b, 2.5, 'crash', big ? 0.7 : 0.6);
      pad(big ? 1 : 0.85);
      if (last && style !== 'interlude') {
        hits(b, 'kick', [0, 4, 8], 1);
        hits(b, 'clap', [4], 0.7);
        hits(b, 'snare', [4], 0.6);
        hits(b, 'tom', [8, 10, 12, 13, 14, 15], (s) => 0.55 + (s - 8) * 0.05);
      } else {
        hits(b, 'kick', [0, 4, 8, 12], 1);
        hits(b, 'clap', [4, 12], 0.7);
        hits(b, 'snare', [4, 12], 0.5);
        hits(b, 'ohat', [2, 6, 10, 14], 0.35);
        if (big) hits(b, 'hat', every(1), (s) => (s % 2 ? 0.18 : 0.1));
      }
      if (style === 'interlude' && last) hits(b, 'snare', [12, 13, 14, 15], (s) => 0.4 + (s - 12) * 0.15);
      bassEighths(true);
      stabs(big ? 0.4 : 0.32, triad);
    }

    if (style === 'bridge') {
      pad(0.55);
      if (i < 6) {
        hits(b, 'kick', [0], 0.75);
        hits(b, 'snare', [8], 0.4);
        hits(b, 'hat', [0, 4, 8, 12], 0.14);
        note(b, 4, 'bass', 0.7, root);
        const bells = chordMidis(chord, 67);
        bells.concat(bells[0] + 12).forEach((midi, k) => note(b + k, 1.5, 'bell', 0.45, midi));
      } else {
        hits(b, 'kick', [0, 4, 8, 12], 0.85);
        hits(b, 'snare', i === 6 ? every(2) : every(1), (s) => (i === 6 ? 0.25 + s * 0.02 : 0.45 + s * 0.035));
        bassEighths(false, 0.8);
        if (i === 6) add(b, 8, 'riser', 0.9);
      }
    }

    if (style === 'outro') {
      if (i < 2) {
        pad(0.9);
        hits(b, 'kick', [0, 4, 8, 12], 1);
        hits(b, 'clap', [4, 12], 0.7);
        hits(b, 'ohat', [2, 6, 10, 14], 0.3);
        bassEighths(true);
        if (i === 1) hits(b, 'tom', [12, 13, 14, 15], (s) => 0.6 + (s - 12) * 0.08);
      } else if (i === 2) {
        add(b, 3, 'crash', 0.8);
        hits(b, 'kick', [0], 1);
        note(b, 6, 'bass', 0.9, root);
        pad(1, 7, lowTriad.concat(lowTriad[0] + 12));
      }
    }
  }

  for (const melody of score.notes) {
    if (!melody.sung) { note(melody.beat, melody.dur, 'lead', melody.style === 'outro' ? 1 : 0.8, melody.midi); continue; }
    // 2절 후렴 뒷부분과 마지막 후렴은 3도 아래 화음을 악기로 받쳐 준다
    if (melody.style === 'final' || (melody.section === 'chorus2' && melody.beat >= harmonyFrom)) {
      note(melody.beat, melody.dur, 'harm', 0.8, thirdBelow(melody.midi, melody.key));
    }
  }
  // 가사 한 줄 = 노래 한 번. 누가 부를지는 연주할 때 정한다(singers.mjs)
  for (const line of score.lines) add(line.startBeat, line.endBeat - line.startBeat, 'sing', 1, { line: line.index, section: line.section });

  events.sort((a, b) => a.beat - b.beat);
  return events;
}
