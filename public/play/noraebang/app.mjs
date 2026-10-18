// 인혁 노래방: 재생 조작, 노래방 가사(위아래 두 줄, 글자마다 색 채우기), 젤리 가수 고르기, 가사 전체 보기.
import { compileSong, sectionAt, chordAt } from './score.mjs';
import { Synth } from './synth.mjs';
import { Sky } from './sky.mjs';
import { SINGERS, MODES, singersFor } from './singers.mjs';
import { mouthOpen } from './hangul.mjs';

const score = compileSong();
const synth = new Synth(score);
const sky = new Sky(document.getElementById('sky'));
const $ = (id) => document.getElementById(id);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const firstLine = score.lines[0];
const SHOW_LYRICS_FROM = firstLine.startBeat - 8;

$('total').textContent = formatTime(score.duration);
$('meta').textContent = `${score.bpm} BPM · ${formatTime(score.duration)}`;

// ---- 누가 부르나 ----

const BOTH_COLOR = '#ffd84d';
const lineSingers = (line) => singersFor(synth.mode, line.section);
function lineColor(line, rowNumber) {
  const singers = lineSingers(line);
  if (singers.length === 2) return BOTH_COLOR;
  if (singers.length === 1) return SINGERS[singers[0]].color;
  return rowNumber ? SINGERS.blue.color : SINGERS.pink.color;
}
function lineWho(line) {
  const singers = lineSingers(line);
  return singers.length === 2 ? '둘이 같이' : singers.length === 1 ? SINGERS[singers[0]].name : '';
}

// ---- 가사 줄 ----

const rows = [0, 1].map((n) => ({ n, el: $(`row${n}`), lineEl: $(`row${n}`).querySelector('.line'), tag: $(`row${n}`).querySelector('.tag'), dots: $(`row${n}`).querySelector('.dots'), who: $(`row${n}`).querySelector('.who'), index: null, spans: [], positions: [], width: 0, popped: -1 }));

function renderRow(row, index) {
  row.index = index;
  row.popped = -1;
  row.lineEl.textContent = '';
  row.lineEl.style.fontSize = '';
  row.spans = [];
  const line = score.lines[index];
  row.who.textContent = line ? lineWho(line) : '';
  if (!line) { row.base = row.fill = null; return; }
  const color = lineColor(line, row.n);
  row.who.style.background = color;
  const base = document.createElement('span'), fill = document.createElement('span');
  base.className = 'base';
  fill.className = 'fill';
  for (const glyph of line.glyphs) {
    const b = document.createElement('span'), f = document.createElement('span');
    b.textContent = f.textContent = glyph.char;
    if (glyph.syllable >= 0) { b.className = f.className = 's'; row.spans[glyph.syllable] = [b, f]; }
    base.append(b);
    fill.append(f);
  }
  fill.style.color = color;
  row.lineEl.append(base, fill);
  row.base = base;
  row.fill = fill;
  measureRow(row);
}

function measureRow(row) {
  if (!row.base) return;
  row.lineEl.style.fontSize = '';
  const room = row.el.clientWidth;
  if (row.base.scrollWidth > room && room > 0) {
    const size = parseFloat(getComputedStyle(row.el).fontSize);
    row.lineEl.style.fontSize = `${Math.floor(size * (room / row.base.scrollWidth) * 0.97)}px`;
  }
  row.positions = row.spans.map(([b]) => ({ left: b.offsetLeft, width: b.offsetWidth }));
  row.width = row.base.offsetWidth;
}

function updateRow(row, beat, current) {
  const line = score.lines[row.index];
  if (!line) return;
  let x = 0, k = -1;
  if (beat >= line.endBeat) { x = row.width; k = line.syllables.length - 1; }
  else {
    for (let i = 0; i < line.syllables.length && line.syllables[i].beat <= beat; i++) k = i;
    if (k >= 0) {
      const syllable = line.syllables[k], pos = row.positions[k];
      x = pos.left + pos.width * clamp((beat - syllable.beat) / syllable.dur, 0, 1);
    }
  }
  // 아직 한 글자도 안 불렀으면 색 층을 통째로 가린다 (테두리가 삐져나오지 않게)
  const right = x <= 0 ? row.width + 40 : x >= row.width ? -20 : row.width - x;
  row.fill.style.clipPath = `inset(-20px ${right}px -20px -20px)`;
  if (k < row.popped) row.popped = k;
  if (synth.playing && k > row.popped && beat < line.endBeat) {
    for (let i = row.popped + 1; i <= k; i++) {
      for (const span of row.spans[i]) { span.classList.remove('pop'); void span.offsetWidth; span.classList.add('pop'); }
    }
    const singers = lineSingers(line);
    if (singers.length) singers.forEach((singer) => sky.spawnNote(SINGERS[singer].side));
    else sky.spawnNote(row.n);
  }
  row.popped = Math.max(row.popped, k);
  // 다 부른 줄은 조금 쉬면 흐리게
  const done = row.index === current && beat > line.endBeat + 2;
  const opacity = beat < SHOW_LYRICS_FROM ? '0' : done ? '0.35' : '1';
  row.lineEl.style.opacity = opacity;
  row.tag.style.opacity = opacity;
}

function countdown(row, beat, previous) {
  const line = score.lines[row.index];
  let text = '';
  if (line && beat < line.startBeat && beat >= line.startBeat - 4 && beat >= SHOW_LYRICS_FROM) {
    const gap = line.startBeat - (previous ? previous.endBeat : 0);
    if (gap >= 3) text = '●'.repeat(clamp(Math.ceil(line.startBeat - beat), 1, 4));
  }
  if (row.dots.textContent !== text) row.dots.textContent = text;
}

// 지금 부르는 줄 = 시작한 줄 중 마지막 줄. 그 줄과 다음 줄을 위아래 칸에 번갈아 보여 준다.
function currentLine(beat) {
  let current = -1;
  for (const line of score.lines) { if (line.startBeat <= beat) current = line.index; else break; }
  return current;
}

// ---- 가사 전체 보기 ----

const BLOCKS = [
  ['1절', ['verse1', 'pre1']], ['후렴', ['chorus1']], ['2절', ['verse2', 'pre2']], ['후렴', ['chorus2']],
  ['브릿지', ['bridge']], ['마지막 후렴 · 한 키 올려서', ['final']], ['끝', ['outro']],
];
const sheetButtons = [];
for (const [title, ids] of BLOCKS) {
  const block = document.createElement('div');
  block.className = 'sheet-block';
  const heading = document.createElement('h3');
  heading.textContent = title;
  block.append(heading);
  for (const line of score.lines.filter((l) => ids.includes(l.section))) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sheet-line';
    button.textContent = line.text;
    button.addEventListener('click', () => startAt(Math.max(0, line.startBeat - 4)));
    sheetButtons[line.index] = button;
    block.append(button);
  }
  $('sheet').append(block);
}

function paintSheet() {
  score.lines.forEach((line) => { sheetButtons[line.index].style.borderLeftColor = lineSingers(line).length ? lineColor(line, 0) : 'transparent'; });
}
paintSheet();

// ---- 진행 막대 ----

for (const section of score.sections) {
  const span = document.createElement('span');
  span.style.width = `${(section.bars * 4 / score.totalBeats) * 100}%`;
  span.dataset.style = section.style;
  span.title = section.label;
  span.textContent = section.style === 'pre' ? '' : section.label;
  $('segments').append(span);
}

let dragBeat = null;
const beatFromPointer = (event) => {
  const rect = $('track').getBoundingClientRect();
  return clamp((event.clientX - rect.left) / rect.width, 0, 1) * score.totalBeats;
};
$('track').addEventListener('pointerdown', (event) => {
  $('track').setPointerCapture(event.pointerId);
  dragBeat = beatFromPointer(event);
});
$('track').addEventListener('pointermove', (event) => { if (dragBeat !== null) dragBeat = beatFromPointer(event); });
$('track').addEventListener('pointerup', () => {
  if (dragBeat === null) return;
  const beat = dragBeat;
  dragBeat = null;
  seekTo(beat);
});
$('track').addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); nudge(event.key === 'ArrowLeft' ? -5 : 5); }
});

// ---- 조작 ----

let ended = false;

function seekTo(beat) {
  ended = false;
  $('endcard').hidden = true;
  synth.seek(beat);
  rows.forEach((row) => { row.popped = -1; });
}

async function startAt(beat) {
  ended = false;
  $('endcard').hidden = true;
  await synth.play(beat);
}

function togglePlay() {
  if (synth.playing) synth.pause();
  else startAt(ended ? 0 : synth.position);
}

function nudge(seconds) { seekTo(synth.beat + seconds / score.beatSec); }

const TIPS = {
  duet: '1절은 핑크 젤리, 2절은 파랑 젤리, 후렴은 둘이 같이 불러!',
  pink: '핑크 젤리가 처음부터 끝까지 혼자 불러.',
  blue: '파랑 젤리가 한 옥타브 낮은 목소리로 혼자 불러.',
  off: '지금은 반주만 나와. 가사 색이 바뀌는 대로 직접 불러 봐!',
};

function nextSinger() {
  const index = MODES.findIndex((mode) => mode.id === synth.mode);
  const mode = MODES[(index + 1) % MODES.length];
  synth.setMode(mode.id);
  $('singer').textContent = `🎤 ${mode.label}`;
  $('singer').dataset.mode = mode.id;
  $('tip').textContent = TIPS[mode.id];
  rows.forEach((row) => { row.index = null; });
  paintSheet();
}

$('play').addEventListener('click', togglePlay);
$('bigplay').addEventListener('click', () => startAt(0));
$('again').addEventListener('click', () => startAt(0));
$('restart').addEventListener('click', () => startAt(0));
$('singer').addEventListener('click', nextSinger);

window.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const onButton = event.target instanceof HTMLButtonElement;
  if (event.code === 'Space' && !onButton) { event.preventDefault(); togglePlay(); }
  else if (event.code === 'ArrowLeft') { event.preventDefault(); nudge(-5); }
  else if (event.code === 'ArrowRight') { event.preventDefault(); nudge(5); }
  else if (event.code === 'KeyG') nextSinger();
  else if (event.code === 'KeyR') startAt(0);
});

document.addEventListener('visibilitychange', () => { synth.lookahead = document.hidden ? 1.5 : 0.2; });

synth.onNote((event) => {
  if (event.inst === 'kick') sky.kick(event.vel);
  if (event.inst === 'crash') sky.crash();
});

new ResizeObserver(() => rows.forEach(measureRow)).observe($('stage'));
document.fonts?.ready.then(() => rows.forEach(measureRow));

// ---- 매 화면 ----

// 젤리 입 크기: 지금 부르는 글자의 모음만큼 벌린다. 안 부르는 젤리는 null
function mouths(beat, current) {
  const result = [null, null];
  const line = score.lines[current];
  if (!line || beat > line.endBeat + 0.05) return result;
  const syllable = line.syllables.find((s) => beat >= s.beat - 0.05 && beat < s.beat + s.dur * 0.92);
  for (const singer of lineSingers(line)) result[SINGERS[singer].side] = syllable ? mouthOpen(syllable.sound.vowel) : 0.08;
  return result;
}

let spectrum = null, lastSheet = -2, lastSection = '', lastChord = '';

function frame() {
  let beat = dragBeat ?? synth.beat;
  if (synth.playing && beat >= score.totalBeats) {
    synth.pause();
    synth.position = 0;
    ended = true;
    $('endcard').hidden = false;
    beat = score.totalBeats;
  }
  if (ended && !synth.playing && dragBeat === null) beat = score.totalBeats;

  const current = currentLine(beat);
  const top = Math.max(0, current);
  const want = [];
  want[top % 2] = top;
  want[(top + 1) % 2] = top + 1;
  rows.forEach((row) => {
    if (row.index !== want[row.n]) renderRow(row, want[row.n]);
    updateRow(row, beat, current);
    countdown(row, beat, score.lines[row.index - 1]);
  });

  const section = sectionAt(score, Math.min(beat, score.totalBeats - 0.01));
  if (section.label !== lastSection) { $('section').textContent = lastSection = section.label; }
  const chord = chordAt(score, beat);
  const chordName = chord ? chord.name : '-';
  if (chordName !== lastChord) { $('chord').textContent = lastChord = chordName; }

  const started = synth.playing || beat > 0.01;
  $('titlecard').classList.toggle('playing', started);
  $('titlecard').classList.toggle('hide', ended || (started && beat >= SHOW_LYRICS_FROM));
  $('play').textContent = synth.playing ? '⏸' : '▶';
  $('play').setAttribute('aria-label', synth.playing ? '멈춤' : '재생');
  $('state').textContent = synth.playing ? '노래 중 ♪' : ended ? '끝!' : started ? '멈춤' : '대기 중';

  const ratio = clamp(beat / score.totalBeats, 0, 1);
  $('progress').style.width = `${ratio * 100}%`;
  $('knob').style.left = `${ratio * 100}%`;
  $('track').setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
  $('time').textContent = formatTime(beat * score.beatSec);

  if (current !== lastSheet) {
    sheetButtons[lastSheet]?.classList.remove('now');
    sheetButtons[current]?.classList.add('now');
    lastSheet = current;
  }

  if (synth.analyser) {
    spectrum ??= new Uint8Array(synth.analyser.frequencyBinCount);
    synth.analyser.getByteFrequencyData(spectrum);
  }
  sky.draw({ beat, style: section.style, spectrum: synth.playing ? spectrum : null, playing: synth.playing, mouths: synth.playing ? mouths(beat, current) : [null, null] });
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// 검사 도구가 상태를 읽을 수 있게 열어 둔다
window.noraebang = { score, synth, startAt, seekTo, nextSinger, get beat() { return synth.beat; } };
