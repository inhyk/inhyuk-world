// 인혁 노래방 악보 검사: node --test games/noraebang/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { SECTIONS } from '../../public/play/noraebang/song.mjs';
import { compileSong, parseNotes, parseChord, thirdBelow, midiOf, lineIndexAt } from '../../public/play/noraebang/score.mjs';
import { arrange } from '../../public/play/noraebang/arrange.mjs';

const score = compileSong();

test('가사 한 글자마다 음표가 하나씩 있다', () => {
  // compileSong 이 글자 수와 음표 수가 다르면 오류를 낸다
  assert.equal(score.lines.length, 45);
  for (const line of score.lines) assert.equal(line.syllables.length, line.glyphs.filter((g) => g.syllable >= 0).length, line.text);
});

test('모든 줄이 4박 마디에 맞고 구간 안에 들어간다', () => {
  for (const section of SECTIONS) {
    for (const line of section.lines) {
      const beats = parseNotes(line.notes).reduce((sum, note) => sum + note.dur, 0);
      assert.ok(line.bar * 4 + beats <= section.bars * 4 + 1e-9, `${section.id}: ${line.text ?? '연주'}`);
    }
  }
  assert.throws(() => parseNotes('C4:1 | D4:1'), /마디/);
});

test('줄끼리 겹치지 않고 순서대로 나온다', () => {
  for (let i = 1; i < score.lines.length; i++) {
    assert.ok(score.lines[i].startBeat >= score.lines[i - 1].endBeat, `${score.lines[i - 1].text} → ${score.lines[i].text}`);
  }
});

test('노래 길이는 3분 남짓이고 마지막 후렴은 한 키 올라간다', () => {
  assert.equal(score.totalBeats, 400);
  assert.ok(score.duration > 180 && score.duration < 210, `${score.duration}초`);
  const chorus = score.notes.find((note) => note.section === 'chorus1');
  const final = score.notes.find((note) => note.section === 'final');
  assert.equal(final.midi - chorus.midi, 2);
});

test('멜로디는 부르기 좋은 음역(E4~B5) 안에 있다', () => {
  for (const note of score.notes.filter((n) => n.sung)) {
    assert.ok(note.midi >= midiOf('E4') && note.midi <= midiOf('B5'), `${note.section} ${note.midi}`);
  }
});

test('화음 이름과 3도 아래 화음', () => {
  assert.deepEqual(parseChord('Am').tones, [0, 3, 7]);
  assert.equal(parseChord('A7').tones.at(-1), 10);
  assert.equal(parseChord('C', 2).name, 'D');
  assert.equal(parseChord('Am', 2).name, 'Bm');
  assert.equal(thirdBelow(midiOf('E5'), 0), midiOf('C5'));
  assert.equal(thirdBelow(midiOf('C5'), 0), midiOf('A4'));
  assert.equal(thirdBelow(midiOf('F#5'), 2), midiOf('D5'));
});

test('지금 부를 줄 찾기', () => {
  assert.equal(lineIndexAt(score, 0), 0);
  assert.equal(lineIndexAt(score, score.lines[3].startBeat + 0.1), 3);
  assert.equal(lineIndexAt(score, score.totalBeats), score.lines.length);
});

test('반주는 노래 안에서만 울리고 구간마다 악기가 있다', () => {
  const events = arrange(score);
  assert.ok(events.length > 2000);
  for (const event of events) {
    assert.ok(event.beat >= 0 && event.beat < score.totalBeats, `${event.inst} @${event.beat}`);
    assert.ok(event.vel > 0 && event.vel <= 1.2, `${event.inst} vel ${event.vel}`);
    if (['vox', 'harm', 'lead', 'bass', 'arp', 'bell'].includes(event.inst)) assert.ok(Number.isFinite(event.midi), event.inst);
    if (['pad', 'pluck'].includes(event.inst)) assert.ok(event.notes.length >= 3, event.inst);
  }
  for (const section of score.sections) {
    const inside = events.filter((e) => e.beat >= section.startBeat && e.beat < section.endBeat);
    assert.ok(inside.some((e) => e.inst === 'kick'), `${section.id} 킥`);
    assert.ok(inside.some((e) => e.inst === 'pad' || e.inst === 'pluck'), `${section.id} 화음`);
  }
  const vox = events.filter((e) => e.inst === 'vox');
  assert.equal(vox.length, score.notes.filter((n) => n.sung).length);
});
