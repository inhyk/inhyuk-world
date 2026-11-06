// 효과음과 배경 음악 (Web Audio 로 직접 만든 소리. 파일 없음)
let ctx = null, master = null, sfxBus = null, musicBus = null;
let soundOn = true, musicOn = true;
let musicTimer = null, musicName = '', step = 0, nextTime = 0;

function ensure() {
  if (ctx) return ctx;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = soundOn ? 0.5 : 0; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.16 : 0; musicBus.connect(master);
  return ctx;
}

export function unlock() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
}

export function setSound(on) { soundOn = on; if (sfxBus) sfxBus.gain.value = on ? 0.5 : 0; }
export function setMusic(on) { musicOn = on; if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.16 : 0, ctx.currentTime, 0.1); }

function tone(freq, dur, { type = 'square', vol = 0.3, slide = 0, delay = 0, bus = sfxBus, attack = 0.005 } = {}) {
  if (!ctx || !bus) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus);
  o.start(t); o.stop(t + dur + 0.02);
}

function noiseBurst(dur, vol = 0.2, freq = 1200) {
  if (!ctx || !sfxBus) return;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(sfxBus);
  src.start();
}

export const sfx = {
  jump: () => tone(330, 0.14, { type: 'triangle', vol: 0.25, slide: 260 }),
  land: () => noiseBurst(0.07, 0.12, 500),
  coin: () => { tone(988, 0.08, { type: 'square', vol: 0.14 }); tone(1319, 0.22, { type: 'square', vol: 0.14, delay: 0.07 }); },
  check: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.22, delay: i * 0.07 })),
  bounce: () => tone(180, 0.32, { type: 'sine', vol: 0.4, slide: 520 }),
  die: () => { tone(420, 0.35, { type: 'sawtooth', vol: 0.16, slide: -330 }); noiseBurst(0.18, 0.12, 900); },
  portal: () => { tone(220, 0.6, { type: 'sine', vol: 0.25, slide: 660 }); tone(330, 0.6, { type: 'triangle', vol: 0.12, slide: 990, delay: 0.05 }); },
  buy: () => { tone(784, 0.09, { type: 'square', vol: 0.15 }); tone(1047, 0.09, { type: 'square', vol: 0.15, delay: 0.08 }); tone(1568, 0.2, { type: 'square', vol: 0.12, delay: 0.16 }); },
  nope: () => tone(160, 0.2, { type: 'square', vol: 0.12, slide: -40 }),
  click: () => tone(660, 0.05, { type: 'triangle', vol: 0.15 }),
  pop: () => tone(520, 0.08, { type: 'sine', vol: 0.18, slide: 300 }),
  cash: () => { noiseBurst(0.05, 0.1, 3000); [1175, 1568].forEach((f, i) => tone(f, 0.12, { type: 'triangle', vol: 0.18, delay: i * 0.06 })); },
  tick: () => tone(880, 0.06, { type: 'square', vol: 0.12 }),
  go: () => tone(1320, 0.4, { type: 'square', vol: 0.16 }),
  crumble: () => noiseBurst(0.22, 0.16, 700),
  win: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, { type: 'square', vol: 0.14, delay: i * 0.1 })),
  say: () => tone(740, 0.07, { type: 'sine', vol: 0.15, slide: 120 }),
};

// ───── 배경 음악: 세계마다 다른 짧은 반복 ─────
const SONGS = {
  hub: { bpm: 112, chords: [[60, 64, 67], [57, 60, 64], [65, 69, 72], [67, 71, 74]], mel: [72, 0, 76, 79, 76, 0, 74, 72, 69, 0, 72, 76, 74, 0, 71, 0, 72, 74, 76, 0, 77, 76, 74, 72, 74, 0, 71, 72, 74, 0, 0, 0] },
  obby: { bpm: 132, chords: [[62, 66, 69], [59, 62, 66], [55, 59, 62], [57, 61, 64]], mel: [74, 78, 81, 78, 74, 0, 76, 78, 71, 74, 78, 74, 71, 0, 73, 74, 67, 71, 74, 71, 67, 0, 69, 71, 69, 73, 76, 73, 69, 0, 73, 0] },
  tycoon: { bpm: 104, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], mel: [69, 0, 72, 0, 76, 74, 72, 0, 65, 0, 69, 0, 72, 0, 69, 0, 67, 0, 72, 0, 76, 0, 79, 77, 74, 0, 71, 0, 74, 0, 0, 0] },
  survival: { bpm: 140, chords: [[57, 60, 64], [57, 60, 64], [53, 57, 60], [52, 55, 59]], mel: [69, 72, 76, 72, 69, 72, 76, 81, 77, 76, 72, 69, 72, 0, 69, 0, 64, 67, 71, 67, 64, 67, 71, 76, 74, 72, 71, 69, 71, 0, 68, 0] },
};
const midi = n => 440 * Math.pow(2, (n - 69) / 12);

function scheduleMusic() {
  const song = SONGS[musicName];
  if (!song || !ctx) return;
  const beat = 60 / song.bpm / 2;
  while (nextTime < ctx.currentTime + 0.25) {
    const i = step % song.mel.length;
    const n = song.mel[i];
    const dly = Math.max(0, nextTime - ctx.currentTime);
    if (n) tone(midi(n), beat * 0.9, { type: 'triangle', vol: 0.35, bus: musicBus, delay: dly, attack: 0.01 });
    if (i % 8 === 0) {
      const ch = song.chords[Math.floor(i / 8) % song.chords.length];
      ch.forEach(c => tone(midi(c - 12), beat * 7.5, { type: 'sine', vol: 0.18, bus: musicBus, delay: dly, attack: 0.06 }));
      tone(midi(ch[0] - 24), beat * 3.5, { type: 'triangle', vol: 0.4, bus: musicBus, delay: dly });
    }
    if (i % 8 === 4) {
      const ch = song.chords[Math.floor(i / 8) % song.chords.length];
      tone(midi(ch[0] - 24 + 7), beat * 3.5, { type: 'triangle', vol: 0.32, bus: musicBus, delay: dly });
    }
    nextTime += beat; step++;
  }
}

export function playMusic(name) {
  if (!ensure()) return;
  if (musicName === name) return;
  musicName = name; step = 0; nextTime = ctx.currentTime + 0.1;
  clearInterval(musicTimer);
  musicTimer = setInterval(scheduleMusic, 90);
}
