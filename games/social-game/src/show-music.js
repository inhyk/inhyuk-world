// Music for the fountain show: an original pop song made only with Web Audio oscillators and noise
// (no sound files, no borrowed melody). 120 BPM, about 102 s:
//   intro 2 bars · verse 8 · chorus 8 · fountain solo 4 · verse 8 · chorus 8 · final chorus +2 keys 8 ·
//   big ending 2 · bow and applause 3.
// The singer "sings" through formant filters (ah, oh, eh) so it sounds like a voice going la-la.
export const BPM = 120;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const SECTIONS = [
  { name: 'intro', bars: 2 }, { name: 'verse', bars: 8, lyric: 0 }, { name: 'chorus', bars: 8, lyric: 2 },
  { name: 'water', bars: 4 }, { name: 'verse', bars: 8, lyric: 4 }, { name: 'chorus', bars: 8, lyric: 2 },
  { name: 'final', bars: 8, lyric: 6, key: 2 }, { name: 'end', bars: 2, key: 2 }, { name: 'bow', bars: 3 },
];
let acc = 0;
for (const s of SECTIONS) { s.start = acc; acc += s.bars; }
export const TOTAL_BARS = acc;
export const LENGTH = TOTAL_BARS * BAR; // seconds

/** Lyric lines, two per 8-bar section (one per 4 bars). */
export const LYRICS = [
  '반짝반짝 금요일 밤에 분수 광장에 모여요 ✨', '물방울이 하늘 높이 춤을 추며 올라가요 💧',
  '분수야 춤춰라 빙글빙글 노래하자 다 같이 🎶', '무지개 물줄기 반짝반짝 오늘 밤은 최고야! 🌈',
  '일하고 공부한 우리 동네 모두 모두 수고했어요 👏', '손뼉 치고 발 구르며 다 같이 노래해요 🎤',
  '분수야 춤춰라 더 높이 노래하자 다 같이 🎶', '무지개 물줄기 반짝반짝 오늘 밤은 최고야!! 🎉',
];

/** Where we are in the song at t seconds. */
export function songAt(t) {
  const bar = Math.max(0, t) / BAR;
  const b = Math.floor(bar);
  let sec = SECTIONS[SECTIONS.length - 1], idx = SECTIONS.length - 1;
  for (let i = 0; i < SECTIONS.length; i++) if (b < SECTIONS[i].start + SECTIONS[i].bars) { sec = SECTIONS[i]; idx = i; break; }
  const inBar = bar - b;
  return { t, bar: b, barF: bar, section: sec.name, index: idx, barIn: b - sec.start, bars: sec.bars, beat: inBar * 4, beatF: bar * 4, key: sec.key ?? 0, done: t >= LENGTH };
}

// chords: bass root and three chord tones (MIDI)
const CH = { C: [36, 60, 64, 67], G: [43, 59, 62, 67], Am: [45, 60, 64, 69], F: [41, 60, 65, 69], Em: [40, 59, 64, 67] };
const PROG = {
  intro: ['F', 'G'], verse: ['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F'], chorus: ['F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'C'],
  water: ['Am', 'F', 'C', 'G'], final: ['F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'C'], end: ['C', 'C'], bow: ['F', 'C', 'C'],
};
// melody [midi|null, beats] per bar
const VERSE = [
  [[64, 0.5], [67, 0.5], [67, 0.5], [69, 0.5], [67, 1], [64, 1]], [[62, 0.5], [64, 0.5], [67, 1], [62, 1], [null, 1]],
  [[60, 0.5], [64, 0.5], [69, 0.5], [71, 0.5], [69, 1], [67, 1]], [[65, 0.5], [69, 0.5], [72, 1], [69, 1.5], [null, 0.5]],
  [[64, 0.5], [67, 0.5], [72, 0.5], [71, 0.5], [72, 1], [67, 1]], [[71, 0.5], [69, 0.5], [67, 1], [74, 1], [null, 1]],
  [[72, 0.5], [71, 0.5], [69, 0.5], [67, 0.5], [64, 1], [69, 1]], [[65, 1], [67, 1], [69, 0.5], [71, 0.5], [null, 1]],
];
const CHORUS = [
  [[72, 1], [72, 0.5], [74, 0.5], [72, 1], [69, 1]], [[74, 1], [74, 0.5], [76, 0.5], [74, 1], [71, 1]],
  [[76, 1.5], [74, 0.5], [71, 1], [67, 1]], [[69, 1], [72, 1], [76, 1.5], [null, 0.5]],
  [[77, 1], [76, 0.5], [74, 0.5], [72, 1], [69, 1]], [[71, 0.5], [72, 0.5], [74, 1], [79, 1.5], [null, 0.5]],
  [[76, 1], [74, 0.5], [72, 0.5], [74, 1], [76, 1]], [[72, 3], [null, 1]],
];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const VOWELS = [[800, 1200], [500, 900], [530, 1850], [800, 1200], [650, 1100]];

export class ShowMusic {
  /** out = {ctx, master} (the game's audio context and master gain). */
  constructor(out) {
    this.ctx = out.ctx;
    const c = this.ctx;
    this.bus = c.createGain(); this.bus.gain.value = 0;
    this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -16; this.comp.ratio.value = 3;
    this.bus.connect(this.comp).connect(out.master);
    // small plaza reverb
    this.rev = c.createConvolver();
    const len = Math.floor(c.sampleRate * 1.7), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.rev.buffer = ir;
    this.send = c.createGain(); this.send.gain.value = 0.22;
    this.send.connect(this.rev).connect(this.bus);
    this.dry = c.createGain(); this.dry.gain.value = 1;
    this.dry.connect(this.bus);
    this.nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = this.nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.t0 = null;
    this.nextBar = 0;
    this.playing = false;
  }
  get now() { return this.ctx.currentTime; }
  get running() { return this.ctx.state === 'running'; }
  /** Song time (s) from the audio clock. */
  get time() { return this.t0 == null ? 0 : this.ctx.currentTime - this.t0; }

  start(at = 0) { this.t0 = this.ctx.currentTime + 0.08 - at; this.nextBar = Math.max(0, Math.floor(at / BAR)); this.playing = true; }
  stop() { this.playing = false; this.t0 = null; this.bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15); }
  volume(v) { this.bus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.12); }

  /** Schedule every bar that starts within the next half second. */
  pump() {
    if (!this.playing || this.t0 == null) return;
    while (this.nextBar < TOTAL_BARS && this.t0 + this.nextBar * BAR < this.ctx.currentTime + 0.5) {
      const at = this.t0 + this.nextBar * BAR;
      if (at > this.ctx.currentTime - 0.05) this.bar(this.nextBar, at);
      this.nextBar++;
    }
  }

  // ---------------------------------------------------------------- voices
  env(g, t, a, peak, dur, rel = 0.08) {
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(0, t + Math.max(a, dur - rel), rel / 3);
  }
  osc(type, f, t, dur, gain, { a = 0.005, rel = 0.08, dest = this.dry, send = 0, detune = 0, lp = 0 } = {}) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = f; o.detune.value = detune;
    let n = o;
    if (lp) { const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lp; o.connect(f2); n = f2; }
    n.connect(g); g.connect(dest);
    if (send) { const s = c.createGain(); s.gain.value = send; g.connect(s).connect(this.send); }
    this.env(g, t, a, gain, dur, rel);
    o.start(t); o.stop(t + dur + rel * 2 + 0.05);
    return o;
  }
  noise(t, dur, { type = 'bandpass', freq = 1000, q = 1, gain = 0.3, a = 0.002, rel = 0.05, send = 0, sweep = 0 } = {}) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.nb; f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    s.connect(f).connect(g).connect(this.dry);
    if (send) { const sg = c.createGain(); sg.gain.value = send; g.connect(sg).connect(this.send); }
    this.env(g, t, a, gain, dur, rel);
    s.start(t, Math.random()); s.stop(t + dur + rel * 2 + 0.05);
  }
  kick(t, k = 1) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.13);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9 * k, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    o.connect(g).connect(this.dry); o.start(t); o.stop(t + 0.45);
    this.noise(t, 0.015, { type: 'highpass', freq: 3000, gain: 0.12 * k });
  }
  snare(t, k = 1) { this.noise(t, 0.16, { freq: 1900, q: 0.7, gain: 0.32 * k, send: 0.5 }); this.osc('triangle', 190, t, 0.07, 0.18 * k, { rel: 0.05 }); }
  clap(t, k = 1) { for (let i = 0; i < 3; i++) this.noise(t + i * 0.011, 0.05, { freq: 1300, q: 1.2, gain: 0.22 * k, send: 0.6 }); }
  hat(t, open = false, k = 1) { this.noise(t, open ? 0.22 : 0.035, { type: 'highpass', freq: 7500, gain: (open ? 0.1 : 0.08) * k }); }
  crash(t, k = 1) { this.noise(t, 1.6, { type: 'highpass', freq: 4200, gain: 0.16 * k, rel: 0.6, send: 0.5 }); }
  bass(t, m, dur) { this.osc('sawtooth', mtof(m), t, dur, 0.2, { lp: 520, rel: 0.05 }); this.osc('sine', mtof(m), t, dur, 0.22, { rel: 0.05 }); }
  keys(t, notes, dur, k = 1) { for (const m of notes) { this.osc('triangle', mtof(m), t, dur, 0.06 * k, { rel: 0.18, send: 0.3 }); this.osc('sine', mtof(m + 12), t, dur * 0.5, 0.02 * k, { rel: 0.1 }); } }
  pad(t, notes, dur, k = 1) { for (const m of notes) for (const dt of [-7, 7]) this.osc('sawtooth', mtof(m), t, dur, 0.022 * k, { a: 0.25, rel: 0.4, lp: 1500, detune: dt, send: 0.5 }); }
  bell(t, m, k = 1) { for (const [p, g, d] of [[1, 0.12, 1.4], [2.0, 0.05, 0.8], [3.01, 0.03, 0.5], [4.2, 0.015, 0.3]]) this.osc('sine', mtof(m) * p, t, d, g * k, { rel: d * 0.6, send: 0.6 }); }
  /** A sung note: sawtooth through two formant filters with a little vibrato. */
  sing(t, m, dur, vowel = 0, k = 1) {
    const c = this.ctx, f0 = mtof(m);
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0 * 0.985, t); o.frequency.linearRampToValueAtTime(f0, t + 0.05);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f0 * 0.012, t + Math.min(0.4, dur));
    lfo.connect(lg).connect(o.frequency);
    const g = c.createGain();
    const [F1, F2] = VOWELS[vowel % VOWELS.length];
    for (const [f, q, gg] of [[F1, 6, 1], [F2, 8, 0.55], [2600, 10, 0.18]]) {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      const fg = c.createGain(); fg.gain.value = gg; o.connect(bp).connect(fg).connect(g);
    }
    const sine = c.createOscillator(); sine.frequency.value = f0; const sg = c.createGain(); sg.gain.value = 0.12; sine.connect(sg).connect(g);
    g.connect(this.dry);
    const s = c.createGain(); s.gain.value = 0.35; g.connect(s).connect(this.send);
    this.env(g, t, 0.03, 0.55 * k, dur, 0.09);
    for (const x of [o, lfo, sine]) { x.start(t); x.stop(t + dur + 0.3); }
  }
  /** Audience: a burst of claps and a few 'woo!' calls. */
  applause(t, sec = 4, k = 1) {
    const n = Math.round(sec * 70 * k);
    for (let i = 0; i < n; i++) {
      const tt = t + Math.random() * sec * (0.6 + 0.4 * Math.random());
      const fade = 1 - (tt - t) / (sec * 1.1);
      this.noise(tt, 0.02 + Math.random() * 0.02, { freq: 900 + Math.random() * 1600, q: 1.4, gain: (0.05 + Math.random() * 0.06) * fade * k, send: 0.4 });
    }
    for (let i = 0; i < 4 * k; i++) this.woo(t + 0.2 + Math.random() * sec * 0.5);
  }
  woo(t) {
    const c = this.ctx, o = c.createOscillator(), bp = c.createBiquadFilter(), g = c.createGain();
    const f = 320 + Math.random() * 260;
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 1.7, t + 0.25); o.frequency.linearRampToValueAtTime(f * 1.2, t + 0.6);
    bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 2;
    o.connect(bp).connect(g).connect(this.dry);
    this.env(g, t, 0.05, 0.05, 0.6, 0.2);
    o.start(t); o.stop(t + 0.9);
  }
  riser(t, dur) { this.noise(t, dur, { freq: 300, sweep: 6000, q: 2, gain: 0.12, a: dur * 0.9, rel: 0.05, send: 0.4 }); }
  plop() {
    const t = this.ctx.currentTime, c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(300, t + 0.12);
    o.connect(g).connect(this.dry);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.25, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.start(t); o.stop(t + 0.25);
    this.noise(t, 0.3, { freq: 2500, q: 0.6, gain: 0.08 });
    this.bus.gain.setTargetAtTime(Math.max(this.bus.gain.value, 0.6), t, 0.01);
  }

  // ---------------------------------------------------------------- the arrangement
  bar(n, at) {
    const s = songAt(n * BAR + 0.001), sec = s.section, k = s.key, i = s.barIn;
    const chord = CH[PROG[sec][i % PROG[sec].length]].map((m) => m + k);
    const B = BEAT;
    if (sec === 'intro') {
      if (i === 0) { this.riser(at, BAR * 2); this.pad(at, chord.slice(1), BAR); }
      else { this.pad(at, chord.slice(1), BAR); for (let j = 0; j < 8; j++) this.snare(at + B * 2 + j * B / 4, 0.3 + j * 0.09); }
      return;
    }
    if (sec === 'bow') {
      if (i === 0) { this.applause(at, BAR * 3, 1.2); this.keys(at, chord.slice(1), BAR * 2, 0.6); }
      return;
    }
    if (sec === 'end') {
      if (i === 0) {
        this.kick(at, 1.2); this.crash(at, 1.4); this.crash(at + 0.02, 0.8);
        this.pad(at, chord.slice(1), BAR * 1.8, 1.6); this.keys(at, chord.slice(1), BAR * 1.5, 1.4); this.bass(at, chord[0], BAR * 1.5);
        this.sing(at, 72 + k, BAR * 1.6, 0, 1.1);
        this.applause(at + BAR * 0.6, BAR * 1.4, 0.6);
      }
      return;
    }
    const big = sec === 'chorus' || sec === 'final';
    // drums
    if (sec === 'water') {
      this.kick(at, 0.5);
      for (let j = 0; j < 16; j++) this.bell(at + j * B / 4, chord[1 + (j % 3)] + 12 + (j % 6 > 2 ? 12 : 0), 0.7 - (j % 4) * 0.12);
      this.pad(at, chord.slice(1), BAR, 1.2);
      this.bass(at, chord[0], BAR * 0.9);
      if (i === 3) this.riser(at, BAR);
      return;
    }
    if (i === 0) this.crash(at, big ? 1 : 0.6);
    for (let b = 0; b < 4; b++) {
      const t = at + b * B;
      if (big || b % 2 === 0) this.kick(t, big ? 1 : 0.85);
      if (!big && b === 2) this.kick(t + B / 2, 0.6);
      if (b % 2 === 1) { this.snare(t, big ? 1 : 0.7); if (big) this.clap(t); }
      this.hat(t + B / 2, big, big ? 1 : 0.8);
      this.hat(t, false, 0.6);
    }
    if (i === 7) for (let j = 0; j < 4; j++) this.snare(at + B * 3 + j * B / 4, 0.4 + j * 0.15);
    // bass
    for (let j = 0; j < (big ? 8 : 4); j++) {
      const t = at + j * B * (big ? 0.5 : 1);
      this.bass(t, chord[0] + (big && j % 2 ? 12 : 0), B * (big ? 0.45 : 0.9));
    }
    // chords
    if (big) { this.pad(at, chord.slice(1), BAR, 1); for (const b of [0, 1.5, 2.5]) this.keys(at + b * B, chord.slice(1).map((m) => m + 12), B * 0.4, 0.8); }
    else for (const b of [0.5, 1.5, 2.5, 3.5]) this.keys(at + b * B, chord.slice(1), B * 0.4, 0.9);
    // melody
    const mel = (sec === 'verse' ? VERSE : CHORUS)[i];
    let beat = 0, v = 0;
    for (const [m, len] of mel) {
      if (m != null) this.sing(at + beat * B, m + k, len * B * 0.95, v++, big ? 1.1 : 1);
      beat += len;
    }
    if (big && i === 7) this.applause(at + B * 2, BAR, 0.35);
  }
}
