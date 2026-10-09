// 소리: 효과음과 배경음악을 Web Audio로 직접 만든다 (파일 없음).
// 인혁이 기획서 12번: 가로·세로로 돌릴 때 효과음, 터질 때 효과음.

const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export function freq(name) {
  const m = /^([A-G][#b]?)(\d)$/.exec(name);
  if (!m) return 0;
  return 440 * Math.pow(2, (NOTE[m[1]] + (Number(m[2]) + 1) * 12 - 69) / 12);
}

// 한 칸 = 8분음표. '.'은 쉼, '-'는 앞 음을 이어서
// 예전 노래 (2026-10-09 까지의 배경음악). 인혁이 기획서 6번의 이스터에그(배경음악 ON/OFF 를 연속으로 5번)로 다시 들을 수 있다.
export const CLASSIC = {
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

// 새 노래 (인혁이 기획서 「뿌요뿌요 (업그레이드)」 2026-10-09 5번 "노래좀 재미있게 바꿔줘").
// 예전보다 길고(16마디, 앞 여덟 마디와 뒤 여덟 마디가 다르다) 통통 튄다: 음이 시작할 때 살짝 미끄러져 올라가는 가락(inst),
// 화음을 잘게 쪼개 반짝이는 아르페지오(chords), 옥타브를 뛰는 베이스, 마디마다 다른 북(drums 배열. c 박수, t 탐, o 열린 심벌)과 끝 마디의 필인.
// lead, bass 는 마디마다 8분음표 8칸. drums 는 16분음표 16칸. chords 는 마디마다 화음 하나.
export const SONGS = {
  // 메뉴: 폴짝폴짝 뛰는 장조
  menu: {
    bpm: 132, inst: 'blip', swing: 0.18,
    lead: [
      'C5 E5 G5 C6 . G5 E5 G5', 'A5 G5 E5 C5 . E5 G5 .', 'F5 A5 C6 F6 . C6 A5 C6', 'D6 B5 G5 D5 G5 B5 D6 .',
      'E6 . E6 D6 C6 . G5 .', 'A5 . C6 A5 E5 . A5 .', 'F5 A5 C6 A5 G5 B5 D6 B5', 'C6 . G5 E5 C5 . . .',
      'A5 C6 E6 C6 A5 . E5 A5', 'G5 B5 E6 B5 G5 . E5 G5', 'F5 A5 C6 F6 E6 C6 A5 F5', 'E5 G5 C6 E6 . C6 G5 .',
      'D5 F5 A5 D6 . A5 F5 A5', 'G5 B5 D6 G6 . D6 B5 .', 'A5 C6 F6 C6 B5 D6 G6 D6', 'C6 E6 G6 C7 . . C6 .',
    ],
    bass: [
      'C3 . C4 . G3 . C4 .', 'C3 . C4 . E3 . G3 .', 'F2 . F3 . C3 . F3 .', 'G2 . G3 . D3 . G3 B3',
      'C3 . C4 . G3 . C4 .', 'A2 . A3 . E3 . A3 .', 'F2 . F3 . G2 . G3 .', 'C3 . G3 . C3 G2 C3 .',
      'A2 . A3 . E3 . A3 .', 'E2 . E3 . B2 . E3 .', 'F2 . F3 . C3 . F3 .', 'C3 . C4 . G3 . C4 .',
      'D3 . D4 . A3 . D4 .', 'G2 . G3 . D3 . G3 .', 'F2 . F3 . G2 . G3 .', 'C3 G3 C4 . C3 . C3 .',
    ],
    chords: ['C', 'C', 'F', 'G', 'C', 'Am', 'F', 'C', 'Am', 'Em', 'F', 'C', 'Dm', 'G', 'F', 'C'],
    drums: ['k.h.c.h.k.hkc.h.', 'k.h.c.h.k.hkc.h.', 'k.h.c.h.k.hkc.h.', 'k.h.c.hhk.c.ctt.'],
  },
  // 대전: 빠르고 신나게. 앞은 단조로 달리고 뒤는 장조로 밝아진다
  battle: {
    bpm: 156, inst: 'zap', swing: 0,
    lead: [
      'A5 . A5 C6 E6 . D6 C6', 'B5 . G5 B5 D6 . C6 B5', 'A5 C6 E6 A6 . G6 E6 C6', 'D6 . B5 G5 E5 G5 B5 .',
      'A5 . A5 C6 E6 . G6 A6', 'G6 . E6 D6 C6 . D6 E6', 'F6 E6 D6 C6 B5 C6 D6 B5', 'A5 . E5 A5 . . E6 .',
      'C6 . C6 E6 G6 . E6 C6', 'D6 . D6 F6 A6 . F6 D6', 'E6 G6 C7 G6 E6 . G6 E6', 'D6 F6 B6 F6 D6 . B5 D6',
      'C6 E6 G6 C7 B6 G6 E6 G6', 'A6 F6 D6 A5 D6 F6 A6 .', 'G6 . E6 G6 B6 . G#6 B6', 'A6 - E6 C6 A5 . . .',
    ],
    bass: [
      'A2 A3 A2 A3 A2 A3 E3 A3', 'G2 G3 G2 G3 G2 G3 D3 G3', 'F2 F3 F2 F3 F2 F3 C3 F3', 'E2 E3 E2 E3 E2 E3 B2 E3',
      'A2 A3 A2 A3 A2 A3 E3 A3', 'C3 C4 C3 C4 G2 G3 G2 G3', 'D3 D4 D3 D4 E3 E4 E3 E4', 'A2 A3 E3 A3 A2 . A2 .',
      'C3 C4 C3 C4 C3 C4 G3 C4', 'D3 D4 D3 D4 D3 D4 A3 D4', 'C3 C4 C3 C4 E3 E4 G3 C4', 'G2 G3 G2 G3 B2 B3 D3 G3',
      'C3 C4 C3 C4 C3 C4 G3 C4', 'D3 D4 D3 D4 F2 F3 F2 F3', 'E2 E3 E2 E3 E2 E3 G#2 E3', 'A2 A3 E3 A3 A2 . A2 .',
    ],
    chords: ['Am', 'G', 'F', 'Em', 'Am', 'C', 'Dm', 'Am', 'C', 'Dm', 'C', 'G', 'C', 'Dm', 'E', 'Am'],
    drums: ['k.h.c.hkk.h.c.h.', 'k.hkc.h.k.hkc.hh', 'k.h.c.hkk.h.c.h.', 'k.hkc.hkkkc.ttcc'],
  },
  // 보스: 묵직한 발걸음 위로 쫓기듯 내달린다
  boss: {
    bpm: 164, inst: 'buzz', swing: 0,
    lead: [
      'D5 . D5 F5 A5 . D6 .', 'C6 . A5 F5 D5 . F5 A5', 'Bb5 . Bb5 D6 F6 . D6 Bb5', 'A5 . C#6 E6 A6 . G6 E6',
      'D6 F6 A6 D7 . A6 F6 D6', 'C6 E6 G6 C7 . G6 E6 C6', 'Bb5 D6 F6 Bb6 A6 G6 F6 E6', 'D6 . A5 D6 . . A6 .',
      'F6 . F6 E6 D6 . C6 D6', 'E6 . E6 D6 C6 . Bb5 C6', 'D6 C6 Bb5 A5 G5 A5 Bb5 C6', 'A5 . E5 A5 C#6 . E6 .',
      'F6 A6 F6 D6 F6 A6 D7 A6', 'G6 Bb6 G6 E6 G6 Bb6 C7 Bb6', 'A6 G6 F6 E6 D6 E6 F6 G6', 'A6 - E6 C#6 A5 . D6 .',
    ],
    bass: [
      'D2 D3 D2 D3 D2 D3 A2 D3', 'D2 D3 D2 D3 F2 F3 A2 D3', 'Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 F2 Bb2', 'A1 A2 A1 A2 A1 A2 E2 A2',
      'D2 D3 D2 D3 D2 D3 A2 D3', 'C2 C3 C2 C3 C2 C3 G2 C3', 'Bb1 Bb2 Bb1 Bb2 A1 A2 A1 A2', 'D2 D3 A2 D3 D2 . D2 .',
      'F2 F3 F2 F3 F2 F3 C3 F3', 'C2 C3 C2 C3 C2 C3 G2 C3', 'G2 G3 G2 G3 G2 G3 D3 G3', 'A1 A2 A1 A2 A1 A2 E2 A2',
      'D2 D3 D2 D3 D2 D3 A2 D3', 'G2 G3 G2 G3 C2 C3 C2 C3', 'F2 F3 F2 F3 Bb1 Bb2 Bb1 Bb2', 'A1 A2 A1 A2 A1 A2 D2 .',
    ],
    chords: ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'C', 'Bb', 'Dm', 'F', 'C', 'Gm', 'A', 'Dm', 'Gm', 'F', 'A'],
    drums: ['k.hkc.h.kkh.c.hk', 'k.hkc.h.kkh.c.hk', 'k.hkc.hkkkh.c.hk', 'k.kkc.kkt.t.cccc'],
  },
  // 엔딩: 종소리처럼 맑고 느긋하게, 끝으로 갈수록 높이 올라간다
  ending: {
    bpm: 104, inst: 'bell', swing: 0,
    lead: [
      'A5 - C6 - F6 - E6 C6', 'D6 - C6 A5 G5 - - .', 'F5 - A5 - D6 - C6 A5', 'Bb5 - A5 G5 A5 - - .',
      'A5 - C6 - F6 - G6 A6', 'G6 - F6 D6 C6 - - .', 'D6 - F6 - Bb6 - A6 G6', 'F6 - - - C6 - - .',
      'C6 - E6 - G6 - E6 C6', 'D6 - F6 - A6 - F6 D6', 'Bb5 - D6 - F6 - D6 Bb5', 'C6 - E6 - G6 - Bb6 .',
      'A6 - F6 - C6 - F6 A6', 'G6 - E6 - C6 - E6 G6', 'F6 - D6 Bb5 C6 - E6 G6', 'F6 - - - - - - .',
    ],
    bass: [
      'F2 - C3 - F3 - C3 -', 'C2 - G2 - C3 - G2 -', 'D2 - A2 - D3 - A2 -', 'Bb1 - F2 - C2 - G2 -',
      'F2 - C3 - F3 - C3 -', 'C2 - G2 - C3 - G2 -', 'Bb1 - F2 - Bb2 - C3 -', 'F2 - C3 - F3 - - -',
      'C2 - G2 - C3 - G2 -', 'D2 - A2 - D3 - A2 -', 'Bb1 - F2 - Bb2 - F2 -', 'C2 - G2 - C3 - E3 -',
      'F2 - C3 - F3 - C3 -', 'C2 - G2 - C3 - G2 -', 'Bb1 - F2 - C2 - G2 -', 'F2 - C3 - F3 - - -',
    ],
    chords: ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'F', 'C', 'Dm', 'Bb', 'C', 'F', 'C', 'Bb', 'F'],
    drums: ['k...h...c...h...', 'k...h...c...h.h.'],
  },
};
// 화음 → 아르페지오로 칠 음 (가운데 옥타브). 예: C → C E G
const CHORDS = {
  C: ['C5', 'E5', 'G5'], Dm: ['D5', 'F5', 'A5'], Em: ['E5', 'G5', 'B5'], F: ['F5', 'A5', 'C6'], G: ['G5', 'B5', 'D6'], Am: ['A5', 'C6', 'E6'],
  Bb: ['Bb4', 'D5', 'F5'], Gm: ['G4', 'Bb4', 'D5'], A: ['A4', 'C#5', 'E5'], E: ['E5', 'G#5', 'B5'],
};
// 시험용: 노래 하나가 엔진이 읽는 모양인지 (마디 수가 맞고, 칸 수와 음 이름이 맞는지)
export function songProblems(def) {
  const out = [], bars = def.lead?.length ?? 0;
  const note = t => t === '.' || t === '-' || freq(t) > 0;
  if (!bars || def.bass?.length !== bars) out.push('lead 와 bass 의 마디 수가 다르다');
  (def.lead ?? []).forEach((b, i) => { const t = b.split(/\s+/); if (t.length !== 8 || !t.every(note)) out.push(`lead ${i + 1}마디`); });
  (def.bass ?? []).forEach((b, i) => { const t = b.split(/\s+/); if (16 % t.length || !t.every(note)) out.push(`bass ${i + 1}마디`); });
  for (const d of [].concat(def.drums ?? [])) if (d.length !== 16 || /[^.khscto]/.test(d)) out.push(`drums ${d}`);
  if (def.chords) { if (def.chords.length !== bars) out.push('chords 마디 수'); for (const c of def.chords) if (!CHORDS[c]) out.push(`chords ${c}`); }
  if (!(def.bpm >= 60 && def.bpm <= 200)) out.push('bpm');
  return out;
}

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.sfxOn = true;
    this.musicOn = true;
    this.classic = false; // true 면 예전 노래 (이스터에그)
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
  // 예전 노래 ↔ 새 노래. 바로 지금 나오는 곡을 처음부터 다시 튼다.
  setClassic(on) {
    this.classic = !!on;
    if (this.wanted) this.play(this.wanted, true);
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
    const def = (this.classic ? CLASSIC : SONGS)[name];
    if (!def) return;
    const parse = bars => bars.map(b => b.split(/\s+/));
    this.song = {
      name, bpm: def.bpm, lead: parse(def.lead), bass: parse(def.bass), drums: [].concat(def.drums),
      inst: def.inst || '', swing: def.swing || 0, arp: def.chords ? def.chords.map(c => CHORDS[c].map(freq)) : null,
    };
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
      const bars = s.lead.length, count = Math.floor(this.step / 16), bar = count % bars, pos = this.step % 16;
      if (this.musicOn && this.ctx.state === 'running') {
        // 스윙: 엇박(8분음표의 뒤쪽)을 조금 늦게 쳐서 통통 튀게
        const at = this.nextTime + (s.swing && pos % 4 === 2 ? sixteenth * 2 * s.swing : 0);
        if (pos % 2 === 0) {
          const tokens = s.lead[bar], k = pos / 2, tok = tokens[k];
          if (tok && tok !== '.' && tok !== '-') {
            let len = 1;
            while (tokens[k + len] === '-') len++;
            this.voice(freq(tok), at, sixteenth * 2 * len * (s.inst ? 0.8 : 0.92), s.inst || 'lead');
          }
        }
        const bassTokens = s.bass[bar], per = 16 / bassTokens.length;
        if (pos % per === 0) {
          const k = pos / per, tok = bassTokens[k];
          if (tok && tok !== '.' && tok !== '-') {
            let len = 1;
            while (bassTokens[k + len] === '-') len++;
            this.voice(freq(tok), at, sixteenth * per * len * 0.9, s.inst ? 'boing' : 'bass');
          }
        }
        // 아르페지오: 가락 사이사이(16분음표 뒤쪽)에 화음을 한 음씩 올라가며 친다
        if (s.arp && pos % 2 === 1) { const tones = s.arp[bar]; this.voice(tones[((pos - 1) / 2) % tones.length] * (pos >= 8 ? 2 : 1), this.nextTime, sixteenth * 0.9, 'arp'); }
        const d = s.drums[count % s.drums.length][pos];
        if (d === 'k') this.drum('kick', this.nextTime);
        else if (d === 's') this.drum('snare', this.nextTime);
        else if (d === 'h') this.drum('hat', this.nextTime);
        else if (d === 'c') this.drum('clap', this.nextTime);
        else if (d === 't') this.drum('tom', this.nextTime, pos);
        else if (d === 'o') this.drum('open', this.nextTime);
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
    } else if (kind === 'blip' || kind === 'zap' || kind === 'buzz') {
      // 새 노래의 가락: 음이 시작할 때 살짝 아래에서 미끄러져 올라와서 통통 튄다
      o.type = kind === 'blip' ? 'square' : 'sawtooth';
      const filter = c.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = kind === 'buzz' ? 1900 : kind === 'zap' ? 2400 : 3000;
      const peak = kind === 'blip' ? 0.05 : 0.045;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.008); g.gain.exponentialRampToValueAtTime(peak * 0.55, t + Math.min(dur * 0.5, 0.12)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.frequency.setValueAtTime(f * (kind === 'buzz' ? 0.97 : 0.94), t); o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
      if (dur > 0.3) { // 긴 음은 끝을 살짝 떤다
        const lfo = c.createOscillator(), depth = c.createGain();
        lfo.frequency.value = 6.5; depth.gain.value = f * 0.012;
        lfo.connect(depth); depth.connect(o.frequency); lfo.start(t + 0.14); lfo.stop(t + dur + 0.05);
      }
      o.connect(filter); filter.connect(g);
      if (kind === 'buzz') { // 보스: 한 옥타브 아래를 겹쳐서 묵직하게
        const low = c.createOscillator(), lg = c.createGain();
        low.type = 'square'; low.frequency.setValueAtTime(f / 2, t);
        lg.gain.setValueAtTime(0.0001, t); lg.gain.exponentialRampToValueAtTime(0.022, t + 0.01); lg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        low.connect(lg); lg.connect(this.musicGain); low.start(t); low.stop(t + dur + 0.05);
      }
    } else if (kind === 'bell') {
      // 엔딩: 종소리 (맑은 소리에 한 옥타브 위를 얹고 길게 울린다)
      o.type = 'triangle';
      const ring = dur + 0.5;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.085, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + ring);
      o.frequency.setValueAtTime(f, t);
      o.connect(g);
      const hi = c.createOscillator(), hg = c.createGain();
      hi.type = 'sine'; hi.frequency.setValueAtTime(f * 2, t);
      hg.gain.setValueAtTime(0.0001, t); hg.gain.exponentialRampToValueAtTime(0.03, t + 0.006); hg.gain.exponentialRampToValueAtTime(0.0001, t + ring * 0.6);
      hi.connect(hg); hg.connect(this.musicGain); hi.start(t); hi.stop(t + ring);
      g.connect(this.musicGain);
      o.start(t); o.stop(t + ring + 0.05);
      return;
    } else if (kind === 'arp') {
      o.type = 'square';
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.014, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.frequency.setValueAtTime(f, t);
      o.connect(g);
    } else if (kind === 'boing') {
      // 새 노래의 베이스: 위에서 툭 떨어지며 시작해서 통통거린다
      o.type = 'triangle';
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.frequency.setValueAtTime(f * 1.18, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.035);
      o.connect(g);
    } else {
      o.type = 'triangle';
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.frequency.setValueAtTime(f, t);
      o.connect(g);
    }
    g.connect(this.musicGain);
    o.start(t); o.stop(t + dur + 0.05);
  }
  drum(kind, t, pos = 0) {
    const c = this.ctx;
    if (kind === 'tom') { // 둥둥 내려가는 탐 (필인)
      const o = c.createOscillator(), g = c.createGain(), f = 230 - (pos % 4) * 28;
      o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.13);
      g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + 0.18);
      return;
    }
    if (kind === 'clap') { // 짝! 짧은 소리 세 번을 겹친다
      for (const d of [0, 0.011, 0.022]) {
        const src = c.createBufferSource(), filter = c.createBiquadFilter(), g = c.createGain();
        src.buffer = this.noise; filter.type = 'bandpass'; filter.frequency.value = 1300; filter.Q.value = 0.9;
        g.gain.setValueAtTime(0.12, t + d); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.09);
        src.connect(filter); filter.connect(g); g.connect(this.musicGain);
        src.start(t + d, Math.random() * 0.5); src.stop(t + d + 0.11);
      }
      return;
    }
    if (kind === 'open') {
      const src = c.createBufferSource(), filter = c.createBiquadFilter(), g = c.createGain();
      src.buffer = this.noise; filter.type = 'highpass'; filter.frequency.value = 6000;
      g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      src.connect(filter); filter.connect(g); g.connect(this.musicGain);
      src.start(t, Math.random() * 0.5); src.stop(t + 0.24);
      return;
    }
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
