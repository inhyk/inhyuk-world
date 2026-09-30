// 소리: 효과음과 배경음악을 Web Audio로 직접 만든다 (파일 없음).
// 인혁이 기획서 12번: 가로·세로로 돌릴 때 효과음, 터질 때 효과음.

const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export function freq(name) {
  const m = /^([A-G][#b]?)(\d)$/.exec(name);
  if (!m) return 0;
  return 440 * Math.pow(2, (NOTE[m[1]] + (Number(m[2]) + 1) * 12 - 69) / 12);
}

// 한 칸 = 8분음표. '.'은 쉼, '-'는 앞 음을 이어서
const SONGS = {
  menu: {
    bpm: 118,
    lead: [
      'E5 G5 C6 G5 E5 G5 A5 G5', 'E5 . C5 E5 A5 . G5 E5', 'F5 A5 C6 A5 F5 A5 G5 F5', 'D5 . G5 . B5 A5 G5 .',
      'E5 G5 C6 D6 E6 - D6 C6', 'A5 . C6 . E6 D6 C6 A5', 'F5 A5 C6 . D5 G5 B5 D6', 'C6 - G5 . E5 . C5 .',
    ],
    bass: ['C3 G3 C3 G3', 'A2 E3 A2 E3', 'F2 C3 F2 C3', 'G2 D3 G2 D3', 'C3 G3 C3 G3', 'A2 E3 A2 E3', 'F2 C3 G2 D3', 'C3 G3 C3 .'],
    drums: 'k.h.s.h.k.h.s.hh',
  },
  battle: {
    bpm: 142,
    lead: [
      'A5 . C6 A5 E5 . A5 B5', 'C6 . A5 F5 C6 D6 C6 A5', 'G5 . E5 G5 C6 . B5 G5', 'B5 . D6 B5 G5 A5 B5 D6',
      'E6 - D6 C6 B5 . A5 E5', 'F5 A5 C6 F6 E6 D6 C6 A5', 'B5 . G5 B5 D6 . B5 D6', 'E6 - B5 G#5 E5 . G#5 B5',
    ],
    bass: ['A2 A3 A2 A3 A2 A3 A2 A3', 'F2 F3 F2 F3 F2 F3 F2 F3', 'C3 C4 C3 C4 C3 C4 C3 C4', 'G2 G3 G2 G3 G2 G3 G2 G3', 'A2 A3 A2 A3 A2 A3 A2 A3', 'F2 F3 F2 F3 F2 F3 F2 F3', 'G2 G3 G2 G3 G2 G3 G2 G3', 'E2 E3 E2 E3 E2 E3 E2 E3'],
    drums: 'k.h.s.hkk.h.s.hh',
  },
  boss: {
    bpm: 150,
    lead: [
      'D5 . F5 A5 D6 - C6 A5', 'Bb5 . A5 F5 D5 F5 A5 Bb5', 'C6 . Bb5 A5 G5 . A5 C6', 'A5 . C#6 E6 A6 - G6 E6',
      'F6 - E6 D6 A5 . D6 F6', 'G6 - F6 D6 Bb5 . D6 F6', 'G6 F6 E6 D6 Bb5 A5 G5 Bb5', 'A5 - E5 . C#5 . E5 A5',
    ],
    bass: ['D2 D3 D2 D3 D2 D3 D2 D3', 'Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2', 'C2 C3 C2 C3 C2 C3 C2 C3', 'A1 A2 A1 A2 A1 A2 A1 A2', 'D2 D3 D2 D3 D2 D3 D2 D3', 'Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2', 'G1 G2 G1 G2 G1 G2 G1 G2', 'A1 A2 A1 A2 A1 A2 A1 A2'],
    drums: 'k.hsk.hsk.hsk.ss',
  },
  ending: {
    bpm: 96,
    lead: [
      'A5 - - - C6 - A5 .', 'G5 - - - E5 - G5 .', 'F5 - A5 - D6 - C6 .', 'Bb5 - - - A5 - G5 .',
      'A5 - C6 - F6 - E6 .', 'D6 - C6 - G5 - - .', 'D6 - C6 - Bb5 - E6 .', 'F6 - - - - - - .',
    ],
    bass: ['F2 - C3 -', 'E2 - C3 -', 'D2 - A2 -', 'Bb1 - F2 -', 'F2 - C3 -', 'C2 - G2 -', 'Bb1 - C2 -', 'F2 - - -'],
    drums: 'k...h...s...h...',
  },
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.sfxOn = true;
    this.musicOn = true;
    this.song = null;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.noise = null;
    this.last = new Map();
  }

  // 첫 터치/키 입력 때 불러서 소리를 깨운다
  unlock() {
    try {
      if (!this.ctx) {
        const A = window.AudioContext || window.webkitAudioContext;
        if (!A) return;
        this.ctx = new A();
        this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
        this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = this.sfxOn ? 0.8 : 0; this.sfxGain.connect(this.master);
        this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = this.musicOn ? 0.45 : 0; this.musicGain.connect(this.master);
        const len = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        if (this.wanted) this.play(this.wanted, true);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch { /* 소리 없이 진행 */ }
  }

  setSfx(on) { this.sfxOn = on; if (this.sfxGain) this.sfxGain.gain.value = on ? 0.8 : 0; }
  setMusic(on) {
    this.musicOn = on;
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(on ? 0.45 : 0, this.ctx.currentTime, 0.05);
  }
  get ready() { return this.ctx && this.ctx.state === 'running'; }

  // ---------- 효과음 재료 ----------
  tone(f, dur, { type = 'sine', vol = 0.1, slide = 1, delay = 0, attack = 0.004, dest } = {}) {
    if (!this.ready || !f) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }
  hiss(dur, { vol = 0.1, freq: f = 1200, q = 1, type = 'bandpass', delay = 0, dest } = {}) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime + delay;
    const src = c.createBufferSource(), filter = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noise; filter.type = type; filter.frequency.value = f; filter.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(dest || this.sfxGain);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }
  // 같은 소리가 한 프레임에 여러 번 겹치지 않게
  gate(name, ms = 40) {
    const now = performance.now();
    if (now - (this.last.get(name) || 0) < ms) return false;
    this.last.set(name, now);
    return true;
  }

  // ---------- 효과음 ----------
  sfx(name, arg = 0) {
    if (!this.ready || !this.sfxOn) return;
    switch (name) {
      case 'move': if (this.gate('move', 30)) this.tone(900, 0.035, { type: 'triangle', vol: 0.045, slide: 0.8 }); break;
      case 'rotate': // 가로 ↔ 세로로 돌 때: 뿅!
        this.tone(560, 0.075, { type: 'sine', vol: 0.11, slide: 1.9 });
        this.tone(1680, 0.05, { type: 'triangle', vol: 0.03, slide: 1.3, delay: 0.02 });
        break;
      case 'quick': this.tone(500, 0.12, { type: 'sine', vol: 0.12, slide: 2.6 }); this.tone(1400, 0.08, { type: 'triangle', vol: 0.04, delay: 0.05 }); break;
      case 'bump': if (this.gate('bump', 90)) this.tone(170, 0.05, { type: 'square', vol: 0.03, slide: 0.8 }); break;
      case 'lock': if (this.gate('lock', 50)) { this.tone(330, 0.1, { vol: 0.13, slide: 0.55 }); this.hiss(0.05, { vol: 0.05, freq: 900 }); } break;
      case 'drop': this.hiss(0.12, { vol: 0.08, freq: 600, q: 0.6 }); this.tone(200, 0.12, { vol: 0.12, slide: 0.5 }); break;
      case 'land': if (this.gate('land', 60)) this.tone(260, 0.07, { vol: 0.07, slide: 0.6 }); break;
      case 'pop': { // 터질 때: 연쇄가 커질수록 높아진다
        const chain = Math.max(1, arg);
        const scale = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6', 'A6', 'C7', 'D7', 'E7'];
        const base = freq(scale[Math.min(scale.length - 1, chain - 1)]);
        this.hiss(0.09, { vol: 0.14, freq: 1600 + chain * 150, q: 0.9 });
        this.tone(base, 0.18, { type: 'square', vol: 0.05, slide: 1.02 });
        this.tone(base * 1.5, 0.16, { type: 'triangle', vol: 0.06, delay: 0.05 });
        this.tone(base * 2, 0.22, { type: 'sine', vol: 0.07, delay: 0.1 });
        if (chain >= 3) [1, 1.25, 1.5, 2].forEach((k, i) => this.tone(base * k, 0.12, { type: 'triangle', vol: 0.035, delay: 0.14 + i * 0.045 }));
        if (chain >= 5) for (let i = 0; i < 6; i++) this.tone(base * 2 * Math.pow(1.12, i), 0.08, { type: 'sine', vol: 0.03, delay: 0.3 + i * 0.035 });
        break;
      }
      case 'burst': if (this.gate('burst', 50)) { for (let i = 0; i < 3; i++) this.hiss(0.05, { vol: 0.08, freq: 2400 + i * 500, q: 2, delay: i * 0.03 }); } break;
      case 'garbage': {
        const n = arg;
        if (n >= 18) { this.hiss(0.5, { vol: 0.22, freq: 300, q: 0.5, type: 'lowpass' }); this.tone(70, 0.45, { vol: 0.22, slide: 0.6 }); }
        else { this.hiss(0.15, { vol: 0.12, freq: 500, type: 'lowpass' }); this.tone(120, 0.12, { vol: 0.12, slide: 0.6 }); }
        break;
      }
      case 'warn': [0, 0.16].forEach(d => this.tone(196, 0.13, { type: 'square', vol: 0.05, delay: d })); break;
      case 'offset': this.tone(1320, 0.25, { type: 'triangle', vol: 0.08 }); this.tone(1980, 0.2, { type: 'sine', vol: 0.05, delay: 0.03 }); break;
      case 'allclear': ['C6', 'E6', 'G6', 'C7', 'E7', 'G7'].forEach((n, i) => this.tone(freq(n), 0.22, { type: 'triangle', vol: 0.07, delay: i * 0.06 })); break;
      case 'count': this.tone(arg ? 990 : 660, arg ? 0.3 : 0.12, { type: 'square', vol: 0.05 }); break;
      case 'win': ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => this.tone(freq(n), 0.25, { type: 'square', vol: 0.05, delay: i * 0.12 })); ['C5', 'E5', 'G5', 'C6'].forEach(n => this.tone(freq(n), 0.7, { type: 'triangle', vol: 0.05, delay: 0.5 })); break;
      case 'lose': ['G4', 'E4', 'C4'].forEach((n, i) => this.tone(freq(n), 0.35, { type: 'triangle', vol: 0.08, slide: 0.97, delay: i * 0.25 })); break;
      case 'click': this.tone(720, 0.05, { type: 'triangle', vol: 0.06 }); break;
      case 'coin': this.tone(988, 0.08, { type: 'square', vol: 0.05 }); this.tone(1319, 0.25, { type: 'square', vol: 0.05, delay: 0.08 }); break;
      case 'level': ['C5', 'G5', 'C6', 'E6', 'G6'].forEach((n, i) => this.tone(freq(n), 0.2, { type: 'square', vol: 0.045, delay: i * 0.08 })); break;
      case 'mission': this.tone(1047, 0.12, { type: 'triangle', vol: 0.08 }); this.tone(1568, 0.3, { type: 'triangle', vol: 0.08, delay: 0.1 }); break;
      case 'heart': this.tone(60, 0.12, { vol: 0.18, slide: 0.8 }); this.tone(55, 0.12, { vol: 0.12, slide: 0.8, delay: 0.16 }); break;
      case 'talk': if (this.gate('talk', 45)) this.tone(420 + Math.random() * 180, 0.04, { type: 'square', vol: 0.025 }); break;
      default: break;
    }
  }

  // ---------- 배경음악 ----------
  play(name, force = false) {
    this.wanted = name;
    if (!this.ctx) return;
    if (this.song?.name === name && !force) return;
    this.stop();
    const def = SONGS[name];
    if (!def) return;
    const parse = bars => bars.map(b => b.split(/\s+/));
    this.song = { name, bpm: def.bpm, lead: parse(def.lead), bass: parse(def.bass), drums: def.drums };
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), 25);
  }
  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.song = null;
  }
  schedule() {
    if (!this.song || !this.ctx) return;
    const s = this.song, sixteenth = 60 / s.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      const bars = s.lead.length, bar = Math.floor(this.step / 16) % bars, pos = this.step % 16;
      if (this.musicOn && this.ctx.state === 'running') {
        if (pos % 2 === 0) {
          const tokens = s.lead[bar], k = pos / 2, tok = tokens[k];
          if (tok && tok !== '.' && tok !== '-') {
            let len = 1;
            while (tokens[k + len] === '-') len++;
            this.voice(freq(tok), this.nextTime, sixteenth * 2 * len * 0.92, 'lead');
          }
        }
        const bassTokens = s.bass[bar], per = 16 / bassTokens.length;
        if (pos % per === 0) {
          const k = pos / per, tok = bassTokens[k];
          if (tok && tok !== '.' && tok !== '-') {
            let len = 1;
            while (bassTokens[k + len] === '-') len++;
            this.voice(freq(tok), this.nextTime, sixteenth * per * len * 0.9, 'bass');
          }
        }
        const d = s.drums[pos];
        if (d === 'k') this.drum('kick', this.nextTime);
        else if (d === 's') this.drum('snare', this.nextTime);
        else if (d === 'h') this.drum('hat', this.nextTime);
      }
      this.nextTime += sixteenth;
      this.step++;
    }
  }
  voice(f, t, dur, kind) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    if (kind === 'lead') {
      o.type = 'square';
      const filter = c.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 2600;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.01); g.gain.setValueAtTime(0.04, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.frequency.setValueAtTime(f, t);
      o.connect(filter); filter.connect(g);
    } else {
      o.type = 'triangle';
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.frequency.setValueAtTime(f, t);
      o.connect(g);
    }
    g.connect(this.musicGain);
    o.start(t); o.stop(t + dur + 0.05);
  }
  drum(kind, t) {
    const c = this.ctx;
    if (kind === 'kick') {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + 0.16);
      return;
    }
    const src = c.createBufferSource(), filter = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noise;
    filter.type = kind === 'hat' ? 'highpass' : 'bandpass';
    filter.frequency.value = kind === 'hat' ? 7000 : 1800;
    const dur = kind === 'hat' ? 0.03 : 0.1;
    g.gain.setValueAtTime(kind === 'hat' ? 0.05 : 0.14, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(this.musicGain);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }
}
