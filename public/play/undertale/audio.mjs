// 언더테일 팬 게임 · 실시간 합성 사운드트랙과 효과음. 외부 오디오 파일 없음.
// 모든 멜로디는 이 게임을 위해 새로 작성한 오리지널 곡이다.
const midi = m => 440 * 2 ** ((m - 69) / 12);
// 트랙: 근음 진행(chords), 베이스 스텝(16분), 멜로디(8분), 파형, 템포, 드럼 여부
const TRACKS = {
  title: { bpm: 84, chords: [45, 41, 48, 43], bass: [0, 0, 7, 0, 12, 0, 7, 0], melody: [24, 0, 27, 29, 0, 31, 0, 29, 27, 0, 24, 0, 22, 0, 24, 0], wave: 'triangle', drums: false, pad: true },
  ruins: { bpm: 96, chords: [45, 41, 48, 43], bass: [0, 0, 12, 0, 7, 0, 12, 0], melody: [12, 0, 15, 19, 0, 15, 12, 0, 10, 0, 12, 15, 0, 12, 10, 0], wave: 'triangle', drums: false, pad: true },
  snowdin: { bpm: 122, chords: [48, 53, 55, 50], bass: [0, 12, 0, 12, 7, 12, 0, 12], melody: [24, 0, 26, 28, 31, 0, 28, 26, 24, 0, 23, 0, 24, 26, 0, 0], wave: 'square', drums: true, bells: true },
  waterfall: { bpm: 80, chords: [40, 45, 43, 38], bass: [0, 0, 0, 12, 0, 0, 7, 0], melody: [19, 0, 0, 22, 0, 24, 0, 0, 22, 0, 19, 0, 0, 17, 0, 0], wave: 'sine', drums: false, pad: true, sparkle: true },
  hotland: { bpm: 132, chords: [43, 43, 46, 41], bass: [0, 0, 0, 7, 0, 0, 10, 12], melody: [12, 12, 0, 15, 0, 17, 15, 12, 0, 10, 12, 0, 15, 0, 12, 0], wave: 'sawtooth', drums: true },
  castle: { bpm: 72, chords: [41, 36, 43, 38], bass: [0, 0, 0, 0, 12, 0, 0, 0], melody: [24, 0, 0, 0, 27, 0, 26, 0, 24, 0, 0, 0, 19, 0, 0, 0], wave: 'triangle', drums: false, pad: true },
  battle: { bpm: 150, chords: [45, 45, 41, 43], bass: [0, 0, 12, 0, 0, 12, 0, 10], melody: [24, 0, 24, 27, 0, 24, 22, 0, 24, 0, 27, 29, 0, 27, 24, 0], wave: 'square', drums: true },
  boss: { bpm: 156, chords: [40, 40, 36, 38], bass: [0, 12, 0, 12, 0, 12, 10, 12], melody: [24, 0, 27, 0, 31, 0, 27, 24, 26, 0, 24, 0, 22, 0, 24, 0], wave: 'sawtooth', drums: true },
  flowey: { bpm: 110, chords: [48, 48, 44, 46], bass: [0, 0, 0, 0, 0, 0, 0, 0], melody: [24, 26, 28, 0, 31, 0, 28, 26, 24, 0, 23, 24, 0, 0, 0, 0], wave: 'square', drums: false, detune: true },
  judgement: { bpm: 60, chords: [45, 41, 48, 43], bass: [0, 0, 0, 0, 0, 0, 0, 0], melody: [24, 0, 0, 0, 26, 0, 0, 0, 27, 0, 0, 0, 26, 0, 0, 0], wave: 'sine', drums: false, pad: true },
  sans: { bpm: 160, chords: [43, 43, 39, 41], bass: [0, 0, 12, 0, 7, 0, 12, 0], melody: [24, 24, 12, 24, 0, 22, 0, 24, 27, 0, 24, 0, 22, 19, 22, 0], wave: 'square', drums: true, bells: true },
  asgore: { bpm: 140, chords: [38, 38, 34, 36], bass: [0, 0, 12, 0, 0, 12, 0, 12], melody: [24, 0, 22, 24, 27, 0, 24, 0, 22, 0, 19, 0, 22, 0, 24, 0], wave: 'sawtooth', drums: true, pad: true },
  flowey_boss: { bpm: 170, chords: [41, 41, 37, 39], bass: [0, 12, 0, 12, 0, 12, 0, 12], melody: [24, 0, 25, 0, 24, 0, 22, 0, 24, 27, 0, 24, 0, 30, 0, 0], wave: 'square', drums: true, detune: true },
  asriel: { bpm: 150, chords: [45, 41, 48, 43], bass: [0, 0, 12, 0, 7, 0, 12, 0], melody: [24, 0, 27, 29, 31, 0, 29, 27, 24, 0, 22, 24, 0, 27, 0, 0], wave: 'sawtooth', drums: true, pad: true, bells: true },
  ending: { bpm: 90, chords: [48, 43, 45, 41], bass: [0, 0, 12, 0, 0, 0, 7, 0], melody: [24, 0, 28, 0, 31, 0, 28, 0, 26, 0, 24, 0, 23, 0, 24, 0], wave: 'triangle', drums: false, pad: true, bells: true },
  gameover: { bpm: 60, chords: [40, 40, 36, 38], bass: [0, 0, 0, 0, 0, 0, 0, 0], melody: [12, 0, 0, 0, 10, 0, 0, 0, 8, 0, 0, 0, 7, 0, 0, 0], wave: 'sine', drums: false, pad: true },
};
export class Soundtrack {
  constructor() { this.context = null; this.enabled = false; this.track = null; this.step = 0; this.next = 0; this.timer = null; this.paused = false; this.volume = .22; }
  async enable() {
    try {
      if (!this.context) { this.context = new (window.AudioContext || window.webkitAudioContext)(); this.master = this.context.createGain(); this.master.gain.value = this.volume; const comp = this.context.createDynamicsCompressor(); this.master.connect(comp); comp.connect(this.context.destination); }
      await this.context.resume(); this.enabled = true; this.next = this.context.currentTime + .05; this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, .03);
      if (!this.timer) this.timer = setInterval(() => this.schedule(), 40); return true;
    } catch { return false; }
  }
  disable() { this.enabled = false; if (this.context) this.master.gain.setTargetAtTime(0, this.context.currentTime, .03); clearInterval(this.timer); this.timer = null; }
  pause(v) { this.paused = v; if (this.context) this.next = this.context.currentTime + .05; }
  play(name) { if (this.track === name) return; this.track = name; this.step = 0; if (this.context) this.next = this.context.currentTime + .08; }
  tone(freq, time, length = .15, type = 'square', volume = .08, endFreq, detune = 0) {
    if (!this.context || !this.enabled) return; const c = this.context, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, time); if (detune) o.detune.value = detune; if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, time + length);
    g.gain.setValueAtTime(0, time); g.gain.linearRampToValueAtTime(volume, time + .008); g.gain.exponentialRampToValueAtTime(.001, time + length);
    o.connect(g); g.connect(this.master); o.start(time); o.stop(time + length + .02);
  }
  noise(time, length, volume, frequency, type = 'highpass') {
    if (!this.context || !this.enabled) return; const c = this.context, count = Math.ceil(c.sampleRate * length), buffer = c.createBuffer(1, count, c.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < count; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / count);
    const src = c.createBufferSource(), gain = c.createGain(), filter = c.createBiquadFilter(); src.buffer = buffer; filter.type = type; filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, time); gain.gain.exponentialRampToValueAtTime(.001, time + length); src.connect(filter); filter.connect(gain); gain.connect(this.master); src.start(time); src.stop(time + length);
  }
  schedule() {
    if (!this.enabled || this.paused || !this.track) return; const T = TRACKS[this.track]; if (!T) return; const c = this.context;
    if (this.next < c.currentTime - .1) this.next = c.currentTime + .02;
    while (this.next < c.currentTime + .14) {
      const n = this.step, t = this.next, beat = n % 16, root = T.chords[Math.floor(n / 32) % T.chords.length];
      const bass = T.bass[Math.floor(beat / 2) % 8]; if (n % 2 === 0 && bass !== undefined) this.tone(midi(root + bass), t, .2, T.wave === 'sine' ? 'triangle' : 'sawtooth', .06);
      if (T.drums) { if (beat % 8 === 0) this.tone(130, t, .16, 'sine', .4, 40); if (beat === 4 || beat === 12) this.noise(t, .12, .12, 1200); if (n % 2 === 0) this.noise(t, .04, .03, 7000); }
      if (n % 2 === 0) { const note = T.melody[Math.floor(n / 2) % 16]; if (note) this.tone(midi(root + note), t, .18, T.wave, .045, undefined, T.detune ? 12 : 0); }
      if (T.pad && beat === 0) for (const iv of [0, 7, 12, 15]) this.tone(midi(root + iv + 12), t, 60 / T.bpm * 4, 'triangle', .02);
      if (T.bells && beat % 4 === 2) this.tone(midi(root + 24 + [0, 3, 7][Math.floor(n / 4) % 3]), t, .3, 'sine', .03);
      if (T.sparkle && n % 6 === 0) this.tone(midi(root + 31 + (n % 12)), t, .25, 'sine', .02);
      this.step++; this.next += 60 / T.bpm / 4;
    }
  }
  effect(name) {
    if (!this.context || !this.enabled) return; const t = this.context.currentTime;
    switch (name) {
      case 'text': this.tone(520, t, .03, 'square', .025); break;
      case 'select': this.tone(660, t, .06, 'square', .06); this.tone(990, t + .05, .08, 'square', .04); break;
      case 'cancel': this.tone(440, t, .06, 'square', .04); break;
      case 'hurt': this.noise(t, .15, .2, 300); this.tone(180, t, .18, 'sawtooth', .12, 50); break;
      case 'slash': this.noise(t, .12, .18, 2500); this.tone(900, t, .1, 'square', .05, 200); break;
      case 'hit': this.tone(160, t, .12, 'square', .12, 60); this.noise(t, .08, .1, 800); break;
      case 'miss': this.tone(300, t, .1, 'square', .04, 200); break;
      case 'heal': [72, 76, 79].forEach((m, i) => this.tone(midi(m), t + i * .06, .18, 'triangle', .08)); break;
      case 'spare': [67, 72, 76, 79].forEach((m, i) => this.tone(midi(m), t + i * .07, .22, 'triangle', .07)); break;
      case 'save': [76, 80, 83, 88].forEach((m, i) => this.tone(midi(m), t + i * .08, .25, 'sine', .08)); break;
      case 'switch': this.tone(880, t, .08, 'square', .06); this.tone(1320, t + .07, .1, 'square', .04); break;
      case 'door': this.noise(t, .4, .12, 200, 'lowpass'); break;
      case 'ring': [0, .3, .6].forEach(d => { this.tone(1200, t + d, .12, 'square', .05); this.tone(1500, t + d + .06, .12, 'square', .05); }); break;
      case 'fire': this.noise(t, .3, .18, 600); this.tone(300, t, .3, 'sawtooth', .06, 80); break;
      case 'pellet': this.tone(1000, t, .05, 'square', .05, 1400); break;
      case 'spear': this.tone(1400, t, .12, 'sawtooth', .06, 300); break;
      case 'step': this.noise(t, .05, .05, 500); break;
      case 'block': this.tone(1100, t, .05, 'square', .05); break;
      case 'blaster': this.noise(t, .5, .2, 900); this.tone(220, t, .5, 'sawtooth', .1, 110); break;
      case 'levelup': [72, 76, 79, 84].forEach((m, i) => this.tone(midi(m), t + i * .1, .3, 'square', .07)); break;
      case 'lose': [65, 60, 56, 48].forEach((m, i) => this.tone(midi(m), t + i * .22, .45, 'triangle', .16)); break;
      case 'win': [60, 64, 67, 72, 76, 79].forEach((m, i) => this.tone(midi(m), t + i * .07, .25, 'triangle', .1)); break;
      case 'flash': this.noise(t, .3, .25, 3000); break;
      case 'wind': this.noise(t, 2.5, .08, 200, 'lowpass'); break;
      case 'shatter': this.noise(t, .3, .2, 4000); [84, 79, 72].forEach((m, i) => this.tone(midi(m), t + i * .1, .2, 'square', .06)); break;
    }
  }
  dispose() { this.disable(); if (this.context) this.context.close(); }
}
