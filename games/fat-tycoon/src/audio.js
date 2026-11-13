// 소리는 전부 Web Audio 로 그 자리에서 만든다 (파일 없음).
let ctx = null, master = null, musicGain = null, soundOn = true, musicOn = true, timer = null, step = 0, tune = 1;

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  if (musicOn && !timer) startMusic();
}
function tone(freq, dur, type = 'sine', vol = 0.3, slide = 0, when = 0, out = master) {
  if (!ctx) return;
  const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.03);
}
function noise(dur, vol, freq) {
  if (!ctx) return;
  const n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2; g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(master); s.start();
}
export const sfx = {
  bite() { if (!soundOn) return; noise(0.07, 0.5, 900 + Math.random() * 900); tone(260 + Math.random() * 80, 0.09, 'triangle', 0.22, -120); },
  coin() { if (!soundOn) return; tone(988, 0.07, 'square', 0.1); tone(1319, 0.16, 'square', 0.1, 0, 0.07); },
  buy() { if (!soundOn) return; [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'triangle', 0.22, 0, i * 0.06)); },
  deny() { if (!soundOn) return; tone(180, 0.16, 'sawtooth', 0.14, -60); },
  plate() { if (!soundOn) return; tone(660, 0.08, 'sine', 0.25); tone(880, 0.14, 'sine', 0.25, 0, 0.08); },
  level() { if (!soundOn) return; [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, 'square', 0.13, 0, i * 0.1)); },
  record() { if (!soundOn) return; [392, 523, 659, 784, 659, 784, 1047, 1319, 1568].forEach((f, i) => { tone(f, 0.34, 'square', 0.12, 0, i * 0.16); tone(f / 2, 0.34, 'triangle', 0.16, 0, i * 0.16); }); },
  click() { if (!soundOn) return; tone(700, 0.05, 'sine', 0.18); },
  portal() { if (!soundOn) return; tone(200, 0.7, 'sine', 0.25, 900); tone(300, 0.7, 'triangle', 0.15, 1200, 0.05); },
};
const TUNES = {
  1: { bpm: 132, lead: [0, 4, 7, 4, 9, 7, 4, 2, 0, 4, 7, 12, 11, 9, 7, -1, 5, 9, 12, 9, 14, 12, 9, 7, 5, 4, 2, 4, 0, -1, 7, -1], bass: [0, 0, 5, 5, 0, 0, 7, 7], root: 261.63, wave: 'triangle' },
  2: { bpm: 104, lead: [0, 3, 7, 10, 7, 3, 5, -1, 0, 3, 7, 12, 10, 7, 5, -1, 8, 12, 15, 12, 10, 7, 8, -1, 7, 5, 3, 5, 0, -1, -1, -1], bass: [0, 0, 8, 8, 5, 5, 7, 7], root: 220, wave: 'sine' },
  3: { bpm: 120, lead: [12, 7, 4, 7, 12, 14, 16, -1, 14, 12, 9, 12, 7, -1, 4, -1, 5, 9, 12, 9, 17, 16, 14, 12, 11, 12, 14, 11, 12, -1, -1, -1], bass: [0, 0, 9, 9, 5, 5, 7, 7], root: 293.66, wave: 'sine' },
  4: { bpm: 126, lead: [0, -1, 7, 0, 10, 7, 0, -1, 3, -1, 10, 3, 12, 10, 7, -1, 5, -1, 12, 5, 15, 12, 10, 7, 8, 7, 5, 3, 0, -1, 12, -1], bass: [0, 0, 3, 3, 5, 5, 8, 7], root: 196, wave: 'square' },
  5: { bpm: 138, lead: [0, 4, 7, 12, 16, 12, 7, 4, 5, 9, 12, 17, 21, 17, 12, 9, 7, 11, 14, 19, 23, 19, 14, 11, 12, 16, 19, 24, 19, 16, 12, -1], bass: [0, 0, 5, 5, 7, 7, 0, 0], root: 261.63, wave: 'triangle' },
};
function startMusic() {
  if (!ctx || timer) return;
  const tick = () => {
    const T = TUNES[tune], n = T.lead[step % T.lead.length], f = (s) => T.root * Math.pow(2, s / 12);
    if (n >= 0) tone(f(n) * 2, 0.2, T.wave, T.wave === 'square' ? 0.22 : 0.5, 0, 0, musicGain);
    if (step % 4 === 0) tone(f(T.bass[(step / 4 | 0) % T.bass.length]) / 2, 0.36, 'triangle', 0.7, 0, 0, musicGain);
    if (step % 2 === 1) tone(f(T.bass[(step / 4 | 0) % T.bass.length] + 7), 0.08, 'sine', 0.25, 0, 0, musicGain);
    step += 1; timer = setTimeout(tick, 60000 / T.bpm / 2);
  };
  tick();
}
export function setSound(on) { soundOn = on; }
export function setMusic(on) { musicOn = on; if (!on && timer) { clearTimeout(timer); timer = null; } else if (on && ctx) startMusic(); }
export function setTune(n) { if (tune !== n) { tune = n; step = 0; } }
