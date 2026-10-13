// 언더테일 팬 게임 · 실시간 합성 사운드트랙과 효과음. 외부 오디오 파일 없음.
// 모든 멜로디는 이 게임을 위해 새로 작성한 오리지널 곡이다.
const midi = m => 440 * 2 ** ((m - 69) / 12);
// 트랙: 근음 진행(chords), 베이스 스텝(16분), 멜로디(8분), 파형, 템포, 드럼 여부
const _ = null;
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
  // ---------- 아스리엘 드리무르 보스전 (네 곡) ----------
  // key 가 있는 곡은 멜로디가 조의 으뜸음 기준 절대 음이고, _ 는 쉼표다. chordSteps 는 화음 하나의 16분음표 수.
  // 1막 절대신: 가 단조, 한 마디마다 화음이 바뀌는 질주
  asriel: { bpm: 152, key: 57, chordSteps: 16, chords: [45, 41, 43, 40], quality: ['m', 'M', 'M', 'M'], bass: [0, 12, 0, 12, 7, 12, 0, 12],
    melody: [12, _, 12, 15, 14, 12, 10, 12, _, 7, 10, 12, 15, _, 14, 12, 12, _, 12, 15, 17, 15, 14, 15, 19, _, 17, 15, 14, _, 12, 11], wave: 'sawtooth', drums: true, pad: true, arp: [0, 7, 12, 7] },
  // 2막 최후의 형태: 라 단조, 16분 아르페지오와 합창 패드 위의 긴 선율
  asriel_final: { bpm: 166, key: 62, chordSteps: 32, chords: [38, 34, 41, 36], quality: ['m', 'M', 'M', 'M'], bass: [0, 0, 12, 0, 0, 12, 7, 12],
    melody: [0, _, 3, 5, 7, _, 5, 3, 0, _, -2, 0, 3, _, _, _, 5, _, 7, 8, 10, _, 8, 7, 5, _, 3, 5, 7, _, _, _, 7, _, 10, 12, 15, _, 12, 10, 12, _, 10, 7, 5, _, 3, 5, 7, _, 5, 3, 2, _, 3, 5, 7, _, _, _, 10, _, 7, _],
    wave: 'square', drums: true, pad: true, choir: true, arp: [0, 12, 7, 19], bells: true },
  // 3막 구원: 다장조, 희망이 차오르는 선율
  asriel_save: { bpm: 128, key: 60, chordSteps: 32, chords: [48, 43, 45, 41], quality: ['M', 'M', 'm', 'M'], bass: [0, 0, 7, 0, 12, 0, 7, 0],
    melody: [0, _, 4, 7, 12, _, 11, 7, 9, _, 7, 4, 5, _, 4, 2, 2, _, 7, 11, 14, _, 12, 11, 12, _, 11, 7, 7, _, _, _, 4, _, 9, 12, 16, _, 14, 12, 11, _, 12, 14, 16, _, 12, _, 12, _, 9, 5, 7, _, 9, 12, 14, _, 12, _, 12, _, _, _],
    wave: 'triangle', drums: true, pad: true, bells: true, choir: true },
  // 결말: 느린 오르골
  asriel_tears: { bpm: 66, key: 60, chordSteps: 32, chords: [41, 36, 38, 34], quality: ['M', 'M', 'm', 'M'], bass: [0, _, _, _, 7, _, _, _],
    melody: [12, _, _, 9, _, _, 7, _, 5, _, _, _, 7, _, 9, _, 7, _, _, 4, _, _, 2, _, 0, _, _, _, _, _, _, _, 5, _, _, 9, _, _, 10, _, 9, _, 7, _, 5, _, _, _, 2, _, _, 5, _, _, 7, _, 5, _, _, _, _, _, _, _],
    wave: 'sine', drums: false, pad: true, sparkle: true },
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
  pause(v) { this.paused = v; if (this.context) { this.next = this.context.currentTime + .05; this.master.gain.setTargetAtTime(v || !this.enabled ? 0 : this.volume, this.context.currentTime, .08); } }
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
      const n = this.step, t = this.next, beat = n % 16, ci = Math.floor(n / (T.chordSteps || 32)) % T.chords.length, root = T.chords[ci];
      const bass = T.bass[Math.floor(beat / 2) % 8]; if (n % 2 === 0 && bass !== undefined && bass !== null) this.tone(midi(root + bass), t, .2, T.wave === 'sine' ? 'triangle' : 'sawtooth', .06);
      if (T.drums) { if (beat % 8 === 0) this.tone(130, t, .16, 'sine', .4, 40); if (beat === 4 || beat === 12) this.noise(t, .12, .12, 1200); if (n % 2 === 0) this.noise(t, .04, .03, 7000); }
      if (n % 2 === 0) {
        if (T.key !== undefined) { const note = T.melody[Math.floor(n / 2) % T.melody.length]; if (note !== null) { this.tone(midi(T.key + note), t, .2, T.wave, .045); if (T.choir) this.tone(midi(T.key + note + 12), t, .24, 'sine', .016, undefined, 7); } }
        else { const note = T.melody[Math.floor(n / 2) % 16]; if (note) this.tone(midi(root + note), t, .18, T.wave, .045, undefined, T.detune ? 12 : 0); }
      }
      const third = T.quality?.[ci] === 'M' ? 16 : 15;
      if (T.pad && beat === 0) for (const iv of [0, 7, 12, third]) this.tone(midi(root + iv + 12), t, 60 / T.bpm * 4, 'triangle', .02);
      if (T.choir && beat === 0) for (const iv of [12, 19, 12 + third]) { this.tone(midi(root + iv + 12), t, 60 / T.bpm * 4, 'sine', .012, undefined, -6); this.tone(midi(root + iv + 12), t, 60 / T.bpm * 4, 'sine', .012, undefined, 6); }
      if (T.arp) this.tone(midi(root + 24 + (T.arp[n % T.arp.length] === 15 ? third : T.arp[n % T.arp.length])), t, .07, 'square', .014);
      if (T.bells && beat % 4 === 2) this.tone(midi(root + 24 + [0, 3, 7][Math.floor(n / 4) % 3]), t, .3, 'sine', .03);
      if (T.sparkle && n % 6 === 0) this.tone(midi(root + 31 + (n % 12)), t, .25, 'sine', .02);
      this.step++; this.next += 60 / T.bpm / 4;
    }
  }
  voice(speaker, index, letter) {
    if (!this.context || !this.enabled || this.paused || !letter || /[\s.,!?…*"“”]/.test(letter)) return;
    const voices = { '토리엘': [380, 'triangle'], '샌즈': [160, 'triangle'], '파피루스': [650, 'square'], '플라위': [740, 'square'], '언다인': [290, 'sawtooth'], '아스고어': [220, 'triangle'], '템미': [920, 'sine'], '냅스타블룩': [310, 'sine'] };
    const [pitch, wave] = voices[speaker] || [480, 'triangle'];
    this.tone(pitch * [1, 1.035, .975, 1.02][Math.floor(index / 2) % 4], this.context.currentTime, speaker === '샌즈' ? .055 : .035, wave, speaker ? .035 : .018);
  }
  footstep(area, tile, count) {
    if (!this.context || !this.enabled || this.paused) return;
    const t = this.context.currentTime;
    if (tile === '=') this.tone(count % 2 ? 125 : 140, t, .045, 'triangle', .045, 65);
    else if (area === 'snowdin') this.noise(t, .09, .045, 1800, 'lowpass');
    else if (area === 'ruins' && tile === ',') this.noise(t, .1, .04, 1900);
    else { this.tone(count % 2 ? 165 : 180, t, .035, 'sine', .038, 80); this.noise(t, .025, .016, 600); }
  }
  effect(name) {
    if (!this.context || !this.enabled) return; const t = this.context.currentTime;
    switch (name) {
      case 'text': this.tone(520, t, .03, 'square', .025); break;
      case 'page': this.noise(t, .055, .035, 1800); this.tone(460, t, .04, 'triangle', .025); break;
      case 'discover': [76, 83, 88].forEach((m, i) => this.tone(midi(m), t + i * .11, .32, 'sine', .055)); break;
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
      // ---------- 아스리엘 보스전 ----------
      case 'charge': this.tone(220, t, .45, 'sawtooth', .035, 880); this.noise(t, .4, .03, 3000); break;
      case 'starFall': this.tone(1800, t, .35, 'sine', .03, 600); break;
      case 'starBurst': this.noise(t, .18, .09, 2400); [88, 91, 95].forEach((m, i) => this.tone(midi(m), t + i * .03, .12, 'square', .025)); break;
      case 'saberWarn': this.tone(1320, t, .05, 'square', .025); this.tone(1320, t + .09, .05, 'square', .02); break;
      case 'saber': this.noise(t, .22, .16, 1600, 'bandpass'); this.tone(1600, t, .2, 'sawtooth', .05, 180); break;
      case 'thunder': this.noise(t, .5, .22, 500, 'lowpass'); this.tone(90, t, .45, 'sawtooth', .09, 40); this.noise(t, .08, .12, 5000); break;
      case 'gun': this.tone(700, t, .08, 'square', .05, 180); this.noise(t, .06, .06, 2000); break;
      case 'goner': this.tone(55, t, 2.2, 'sawtooth', .09, 110); this.noise(t, 2.4, .05, 300, 'lowpass'); [0, .4, .8].forEach(d => this.tone(160, t + d, .6, 'sine', .04, 60)); break;
      case 'crunch': this.noise(t, .35, .3, 700, 'lowpass'); this.tone(80, t, .3, 'square', .12, 30); break;
      case 'transform': this.noise(t, 1.4, .18, 1200, 'bandpass'); [60, 67, 72, 76, 79, 84].forEach((m, i) => this.tone(midi(m), t + i * .06, 1.2, 'triangle', .05)); this.tone(40, t, 1.2, 'sine', .25, 80); break;
      case 'crack': this.tone(2400, t, .05, 'square', .05, 900); this.noise(t, .09, .1, 6000); break;
      case 'mend': [72, 79, 84, 91].forEach((m, i) => this.tone(midi(m), t + i * .08, .5, 'sine', .07)); break;
      case 'refuse': this.tone(midi(48), t, 1.4, 'triangle', .1); this.tone(midi(55), t, 1.4, 'triangle', .06); this.tone(midi(60), t + .2, 1.4, 'sine', .06); break;
      case 'shine': [84, 88, 91, 96].forEach((m, i) => this.tone(midi(m), t + i * .05, .4, 'sine', .04)); break;
      case 'soulSave': [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => this.tone(midi(m), t + i * .07, .6, 'triangle', .06)); break;
      case 'lost': this.tone(330, t, .8, 'sine', .05, 220); this.tone(311, t, .8, 'sine', .04, 207); this.noise(t, .6, .03, 900, 'bandpass'); break;
      case 'sob': [0, .5, 1.1].forEach((d, i) => this.tone(520 - i * 30, t + d, .25, 'triangle', .03, 380)); break;
    }
  }
  dispose() { this.disable(); if (this.context) this.context.close(); }
}
