// 악보(song.mjs)를 박자 단위 시간표로 바꾼다. 화면과 소리와 검사가 모두 이 결과를 쓴다. DOM 을 쓰지 않는다.
import { SONG, SECTIONS } from './song.mjs';

const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SYLLABLE = /[가-힣A-Za-z0-9]/;

export function midiOf(name) {
  const match = /^([A-G])([#b]?)(\d)$/.exec(name);
  if (!match) throw new Error(`알 수 없는 음: ${name}`);
  return 12 * (Number(match[3]) + 1) + LETTER[match[1]] + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0);
}

export function noteName(midi) {
  return SHARP_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
}

// "E4:.5 r:1 | A4:2" → [{ midi, dur }]. 마디 표시 "|" 는 4박의 배수 자리에만 올 수 있다.
export function parseNotes(source) {
  const notes = [];
  let beats = 0;
  for (const token of source.trim().split(/\s+/)) {
    if (token === '|') {
      if (Math.abs(beats / 4 - Math.round(beats / 4)) > 1e-9) throw new Error(`마디가 4박에 안 맞음 (${beats}박): ${source}`);
      continue;
    }
    const [pitch, length] = token.split(':');
    const dur = Number(length);
    if (!(dur > 0)) throw new Error(`박자가 이상함: ${token}`);
    notes.push({ midi: pitch === 'r' ? null : midiOf(pitch), dur });
    beats += dur;
  }
  return notes;
}

export function syllablesOf(text) {
  return [...text].filter((char) => SYLLABLE.test(char));
}

// 'Am' → { root: 9, tones: [0, 3, 7] }. 'A7' 은 딸림7화음.
export function parseChord(name, key = 0) {
  const match = /^([A-G])([#b]?)(m?)(7?)$/.exec(name);
  if (!match) throw new Error(`알 수 없는 화음: ${name}`);
  const root = (LETTER[match[1]] + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0) + key + 12) % 12;
  const minor = match[3] === 'm';
  const tones = [0, minor ? 3 : 4, 7];
  if (match[4]) tones.push(10);
  return { root, minor, tones, name: SHARP_NAMES[root] + (minor ? 'm' : '') + (match[4] ? '7' : '') };
}

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

// 같은 조 안에서 3도 아래 음. 화음 넣기에 쓴다.
export function thirdBelow(midi, key) {
  const degree = MAJOR_SCALE.indexOf((midi - key + 120) % 12);
  if (degree < 0) return midi - 3;
  const target = MAJOR_SCALE[(degree + 5) % 7];
  let step = ((midi - key + 120) % 12) - target;
  if (step <= 0) step += 12;
  return midi - step;
}

export function compileSong(sections = SECTIONS, song = SONG) {
  const result = { song, bpm: song.bpm, beatSec: 60 / song.bpm, sections: [], chords: [], notes: [], lines: [] };
  let bar = 0;
  for (const section of sections) {
    const startBeat = bar * 4, endBeat = (bar + section.bars) * 4;
    if (section.chords.length !== section.bars) throw new Error(`${section.id}: 화음 수(${section.chords.length})와 마디 수(${section.bars})가 다름`);
    result.sections.push({ id: section.id, label: section.label, style: section.style, key: section.key, bars: section.bars, startBeat, endBeat });
    section.chords.forEach((name, index) => {
      result.chords.push({ ...parseChord(name, section.key), beat: startBeat + index * 4, dur: 4, style: section.style, section: section.id, barIndex: index, lastBar: index === section.bars - 1 });
    });
    for (const line of section.lines) {
      let beat = startBeat + line.bar * 4;
      const sung = Boolean(line.text);
      const lineNotes = [];
      for (const note of parseNotes(line.notes)) {
        if (note.midi !== null) lineNotes.push({ beat, dur: note.dur, midi: note.midi + section.key, sung, key: section.key, style: section.style, section: section.id });
        beat += note.dur;
      }
      if (beat > endBeat + 1e-9) throw new Error(`${section.id} ${line.bar}마디: 줄이 구간 밖으로 나감`);
      result.notes.push(...lineNotes);
      if (!sung) continue;
      const syllables = syllablesOf(line.text);
      if (syllables.length !== lineNotes.length) throw new Error(`「${line.text}」 글자 ${syllables.length}개, 음표 ${lineNotes.length}개`);
      let index = 0;
      const glyphs = [...line.text].map((char) => ({ char, syllable: SYLLABLE.test(char) ? index++ : -1 }));
      const last = lineNotes.at(-1);
      result.lines.push({
        text: line.text,
        glyphs,
        syllables: lineNotes.map((note, i) => ({ char: syllables[i], beat: note.beat, dur: note.dur, midi: note.midi })),
        startBeat: lineNotes[0].beat,
        endBeat: last.beat + last.dur,
        section: section.id,
      });
    }
    bar += section.bars;
  }
  result.totalBeats = bar * 4;
  result.duration = result.totalBeats * result.beatSec;
  result.lines.forEach((line, index) => { line.index = index; });
  return result;
}

export function sectionAt(score, beat) {
  return score.sections.find((section) => beat >= section.startBeat && beat < section.endBeat) ?? score.sections.at(-1);
}

export function chordAt(score, beat) {
  return score.chords.find((chord) => beat >= chord.beat && beat < chord.beat + chord.dur) ?? null;
}

// 지금 부르는 줄(없으면 다음에 부를 줄)의 번호. 노래가 끝났으면 줄 수를 돌려준다.
export function lineIndexAt(score, beat) {
  const index = score.lines.findIndex((line) => line.endBeat > beat);
  return index < 0 ? score.lines.length : index;
}
