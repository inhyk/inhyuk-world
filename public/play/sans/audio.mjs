// SANS · 심판의 회랑 — 실시간 합성 음악과 효과음. 외부 음원 없음.
// 모든 선율은 이 게임을 위해 새로 쓴 곡이다. (원작의 음악과 멜로디를 쓰지 않는다)
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const _ = null;
// 곡: 마디마다 [근음, 장·단], 8분음표 여덟 개의 선율. 베이스는 근음 위의 8분음표 패턴.
const TRACKS = {
  title: { bpm: 76, chords: [[40, 'm'], [36, 'M'], [43, 'M'], [38, 'M']], bass: [0, _, _, _, 7, _, _, _], wave: 'triangle', pad: .028, volume: .05,
    lead: [[76, _, _, 79, _, _, 83, _], [84, _, _, 79, _, _, 76, _], [74, _, _, 79, _, _, 83, _], [81, _, _, 78, _, _, 74, _]] },
  hall: { bpm: 60, chords: [[40, 'm'], [40, 'm'], [36, 'M'], [36, 'M']], bass: [0, _, _, _, _, _, _, _], wave: 'sine', pad: .03, volume: .035, wind: true,
    lead: [[_, _, _, _, 88, _, _, _], [_, _, _, _, _, _, 83, _], [_, _, 84, _, _, _, _, _], [_, _, _, _, _, _, _, _]] },
  // 1막: 마 단조의 느긋하게 건들거리는 리프
  p1: { bpm: 152, chords: [[40, 'm'], [36, 'M'], [38, 'M'], [35, 'M'], [45, 'm'], [40, 'm'], [36, 'M'], [35, 'M']], bass: [0, 0, 12, 0, 0, 12, 0, 7], wave: 'square', drums: 1, volume: .042, arpFrom: 4,
    lead: [[76, _, 76, 79, _, 76, 74, 71], [72, _, 72, 76, _, 79, 76, 72], [74, _, 74, 78, _, 81, 78, 74], [71, _, 74, 78, _, 75, 71, _],
      [81, _, 79, 81, 84, _, 81, 79], [79, _, 76, 79, 83, _, 79, 76], [76, 79, 84, _, 83, 79, 76, _], [75, _, 78, 83, _, 87, 83, _]] },
  // 2막: 더 빠르고, 16분 아르페지오가 깔린다
  p2: { bpm: 170, chords: [[40, 'm'], [40, 'm'], [36, 'M'], [38, 'M'], [45, 'm'], [45, 'm'], [35, 'M'], [35, 'M']], bass: [0, 12, 0, 12, 0, 12, 7, 12], wave: 'sawtooth', drums: 2, volume: .034, arpFrom: 0, pad: .012,
    lead: [[76, 79, 83, 79, 76, 79, 83, 86], [88, _, 86, 83, _, 79, 76, _], [72, 76, 79, 76, 72, 76, 79, 84], [86, _, 81, 78, _, 74, 78, 81],
      [81, 84, 88, 84, 81, 76, 81, 84], [88, _, 84, 81, _, 76, 72, _], [71, 75, 78, 83, 78, 75, 71, 75], [78, _, 83, _, 87, _, 83, _]] },
  // 아무 일도 없는 차례: 느린 오르골
  lull: { bpm: 66, chords: [[40, 'm'], [36, 'M'], [43, 'M'], [38, 'M']], bass: [0, _, _, _, _, _, _, _], wave: 'sine', pad: .014, volume: .05,
    lead: [[76, _, _, _, 79, _, _, _], [72, _, _, _, 76, _, _, _], [74, _, _, _, 79, _, 83, _], [81, _, _, _, _, _, _, _]] },
  dust: { bpm: 50, chords: [[28, 'm']], bass: [_, _, _, _, _, _, _, _], wave: 'sine', pad: .012, volume: 0, wind: true, lead: [[_, _, _, _, _, _, _, _]] },
  warm: { bpm: 84, chords: [[43, 'M'], [38, 'M'], [40, 'm'], [36, 'M']], bass: [0, _, 7, _, 12, _, 7, _], wave: 'triangle', pad: .026, volume: .05, bells: true,
    lead: [[79, _, 83, _, 86, _, 83, _], [78, _, 81, _, 86, _, 81, _], [79, _, 83, _, 88, _, 86, _], [84, _, 83, _, 79, _, _, _]] },
};

export class Sound {
  constructor() { this.context = null; this.enabled = false; this.paused = false; this.track = null; this.step = 0; this.next = 0; this.timer = null; this.lastVoice = 0; this.lastHurt = 0; }
  async enable() {
    try {
      if (!this.context) {
        const c = this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.master = c.createGain(); this.master.gain.value = .9;
        const squash = c.createDynamicsCompressor(); this.master.connect(squash); squash.connect(c.destination);
        this.musicBus = c.createGain(); this.musicBus.gain.value = .85; const soften = c.createBiquadFilter(); soften.type = 'lowpass'; soften.frequency.value = 5200; this.musicBus.connect(soften); soften.connect(this.master);
        this.fxBus = c.createGain(); this.fxBus.gain.value = 1; this.fxBus.connect(this.master);
      }
      await this.context.resume(); this.enabled = true; this.next = this.context.currentTime + .06;
      this.master.gain.setTargetAtTime(.9, this.context.currentTime, .03);
      if (!this.timer) this.timer = setInterval(() => this.schedule(), 40);
      return true;
    } catch { this.enabled = false; return false; }
  }
  disable() { this.enabled = false; if (this.context) this.master.gain.setTargetAtTime(0, this.context.currentTime, .03); clearInterval(this.timer); this.timer = null; }
  pause(value) {
    this.paused = value;
    if (this.context) { this.next = this.context.currentTime + .06; this.musicBus.gain.setTargetAtTime(value ? 0 : .85, this.context.currentTime, .06); }
  }
  music(name) { if (this.track === name) return; this.track = name; this.step = 0; if (this.context) this.next = this.context.currentTime + .08; }
  tone(freq, time, length, { type = 'square', volume = .05, to = null, bus = this.fxBus, attack = .006, detune = 0 } = {}) {
    if (!this.context || !this.enabled) return;
    const c = this.context, osc = c.createOscillator(), gain = c.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, time); if (detune) osc.detune.value = detune;
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), time + length);
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(volume, time + attack); gain.gain.exponentialRampToValueAtTime(.0008, time + length);
    osc.connect(gain); gain.connect(bus); osc.start(time); osc.stop(time + length + .03);
  }
  noise(time, length, { volume = .1, freq = 2000, type = 'highpass', to = null, bus = this.fxBus } = {}) {
    if (!this.context || !this.enabled) return;
    const c = this.context, count = Math.max(1, Math.ceil(c.sampleRate * length)), buffer = c.createBuffer(1, count, c.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < count; i++) data[i] = Math.random() * 2 - 1;
    const source = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain();
    source.buffer = buffer; filter.type = type; filter.frequency.setValueAtTime(freq, time); if (to) filter.frequency.exponentialRampToValueAtTime(to, time + length);
    gain.gain.setValueAtTime(volume, time); gain.gain.exponentialRampToValueAtTime(.0008, time + length);
    source.connect(filter); filter.connect(gain); gain.connect(bus); source.start(time); source.stop(time + length + .02);
  }
  schedule() {
    if (!this.enabled || this.paused || !this.track) return;
    const T = TRACKS[this.track], c = this.context; if (!T) return;
    if (this.next < c.currentTime - .1) this.next = c.currentTime + .03;
    const sixteenth = 60 / T.bpm / 4, bus = this.musicBus;
    while (this.next < c.currentTime + .16) {
      const n = this.step, t = this.next, s = n % 16, bar = Math.floor(n / 16) % T.chords.length, [root, quality] = T.chords[bar], third = quality === 'M' ? 4 : 3;
      if (s % 2 === 0) {
        const bass = T.bass[s / 2]; if (bass !== null) { this.tone(hz(root + bass), t, sixteenth * 1.9, { type: 'triangle', volume: .1, bus }); if (T.drums) this.tone(hz(root + bass), t, sixteenth * 1.4, { type: 'sawtooth', volume: .025, bus }); }
        const note = T.lead[bar % T.lead.length][s / 2];
        if (note !== null && T.volume) { this.tone(hz(note), t, sixteenth * (T.drums ? 1.8 : 5), { type: T.wave, volume: T.volume, bus }); if (T.drums) this.tone(hz(note), t, sixteenth * 1.6, { type: 'square', volume: T.volume * .4, bus, detune: 9 }); }
        if (T.bells && s % 4 === 2) this.tone(hz(root + 36 + [0, third, 7][(n >> 2) % 3]), t, .5, { type: 'sine', volume: .022, bus });
      }
      if (T.arpFrom !== undefined && bar >= T.arpFrom) this.tone(hz(root + 36 + [0, third, 7, 12][n % 4]), t, sixteenth * .9, { type: 'square', volume: .012, bus });
      if (T.pad && s === 0) for (const interval of [12, 19, 24 + third]) this.tone(hz(root + interval), t, sixteenth * 16, { type: 'triangle', volume: T.pad, bus, attack: .3 });
      if (T.wind && s === 0 && bar % 2 === 0) this.noise(t, sixteenth * 30, { volume: .02, freq: 500, to: 220, type: 'bandpass', bus });
      if (T.drums) {
        const kick = T.drums === 2 ? s % 4 === 0 || s === 10 : s === 0 || s === 8 || s === 11;
        if (kick) this.tone(140, t, .15, { type: 'sine', volume: .34, to: 42, bus });
        if (s === 4 || s === 12) { this.noise(t, .13, { volume: .11, freq: 1700, type: 'bandpass', bus }); this.tone(190, t, .07, { type: 'triangle', volume: .08, to: 120, bus }); }
        if (s % 2 === 0 || T.drums === 2) this.noise(t, .03, { volume: s % 4 === 2 ? .035 : .02, freq: 8000, bus });
      }
      this.step++; this.next += sixteenth;
    }
  }
  // 말소리: 샌즈는 낮고 둥글다
  voice(kind) {
    if (!this.context || !this.enabled || this.paused) return;
    const now = this.context.currentTime; if (now - this.lastVoice < .045) return; this.lastVoice = now;
    if (kind === 'sans') this.tone(128 * (1 + (Math.random() - .5) * .08), now, .07, { type: 'triangle', volume: .16 });
    else this.tone(480, now, .025, { type: 'square', volume: .03 });
  }
  sfx(name) {
    if (!this.context || !this.enabled) return;
    const t = this.context.currentTime, tone = (...a) => this.tone(...a), noise = (...a) => this.noise(...a);
    switch (name) {
      case 'move': tone(420, t, .05, { volume: .05 }); break;
      case 'select': tone(620, t, .06, { volume: .06 }); tone(930, t + .05, .09, { volume: .05 }); break;
      case 'slash': noise(t, .16, { volume: .2, freq: 4200, to: 900 }); tone(1300, t, .13, { type: 'sawtooth', volume: .06, to: 220 }); break;
      case 'dodge': noise(t, .2, { volume: .09, freq: 500, to: 2600, type: 'bandpass' }); break;
      case 'hurt': if (t - this.lastHurt < .12) break; this.lastHurt = t; noise(t, .09, { volume: .16, freq: 420, type: 'lowpass' }); tone(170, t, .12, { type: 'sawtooth', volume: .1, to: 60 }); break;
      case 'heal': [72, 76, 79, 84].forEach((m, i) => tone(hz(m), t + i * .06, .2, { type: 'triangle', volume: .08 })); break;
      case 'ding': tone(hz(88), t, .7, { type: 'sine', volume: .12 }); tone(hz(95), t, .5, { type: 'sine', volume: .05 }); break;
      case 'throw': tone(880, t, .13, { type: 'sine', volume: .07, to: 260 }); break;
      case 'slam': tone(120, t, .24, { type: 'sine', volume: .4, to: 38 }); noise(t, .14, { volume: .2, freq: 320, type: 'lowpass' }); break;
      case 'stab': noise(t, .09, { volume: .14, freq: 5200 }); tone(980, t, .08, { volume: .06, to: 420 }); break;
      case 'gbIn': tone(170, t, .5, { type: 'sawtooth', volume: .035, to: 560 }); break;
      case 'gbFire': noise(t, .42, { volume: .22, freq: 2400, to: 260, type: 'lowpass' }); tone(150, t, .4, { type: 'sawtooth', volume: .1, to: 55 }); tone(1500, t, .22, { type: 'sine', volume: .04, to: 380 }); break;
      case 'gbFireBig': noise(t, .6, { volume: .3, freq: 1900, to: 160, type: 'lowpass' }); tone(110, t, .6, { type: 'sawtooth', volume: .16, to: 40 }); tone(1100, t, .3, { type: 'sine', volume: .05, to: 240 }); break;
      case 'cut': noise(t, .035, { volume: .2, freq: 3000 }); break;
      case 'dunk': tone(90, t, .5, { type: 'sawtooth', volume: .3, to: 30 }); noise(t, .4, { volume: .3, freq: 900, type: 'lowpass' }); break;
      case 'break': tone(1900, t + .5, .05, { volume: .08, to: 800 }); noise(t + .5, .07, { volume: .12, freq: 6000 }); noise(t + 1.15, .35, { volume: .2, freq: 3600 }); [84, 79, 72, 65].forEach((m, i) => tone(hz(m), t + 1.15 + i * .1, .22, { volume: .06 })); break;
      case 'snore': tone(84, t, 1.1, { type: 'sine', volume: .16, to: 62 }); noise(t, .9, { volume: .03, freq: 700, type: 'bandpass' }); break;
      case 'push': noise(t, .25, { volume: .1, freq: 260, type: 'lowpass' }); break;
      case 'hit': noise(t, .5, { volume: .34, freq: 1400, to: 200, type: 'lowpass' }); tone(70, t, .5, { type: 'sine', volume: .4, to: 30 }); tone(hz(61), t, .9, { type: 'sawtooth', volume: .05 }); tone(hz(62), t, .9, { type: 'sawtooth', volume: .05 }); break;
      case 'dust': noise(t, 1.5, { volume: .09, freq: 5000, to: 900 }); tone(520, t, 1.2, { type: 'sine', volume: .04, to: 130 }); break;
      case 'drop': tone(2300, t, .3, { type: 'sine', volume: .08 }); tone(3450, t + .02, .22, { type: 'sine', volume: .04 }); noise(t, .03, { volume: .08, freq: 5000 }); break;
    }
  }
}
