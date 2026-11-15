// 소리: 엔진, 드리프트, 효과음, 배경 음악. 전부 Web Audio 로 그 자리에서 만든다.
let ctx = null, master = null, musicGain = null, engine = null, skid = null;
let soundOn = true, musicOn = true, tune = null, nextNote = 0, step = 0;

export function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = soundOn ? 0.9 : 0; master.connect(ctx.destination);
  musicGain = ctx.createGain(); musicGain.gain.value = musicOn ? 0.22 : 0; musicGain.connect(master);
  // 엔진
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o1.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 500; g.gain.value = 0;
  o1.connect(f); o2.connect(f); f.connect(g); g.connect(master); o1.start(); o2.start();
  engine = { o1, o2, f, g };
  // 타이어 끄는 소리 (잡음)
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 1900; bf.Q.value = 2.5;
  const sg = ctx.createGain(); sg.gain.value = 0; src.connect(bf); bf.connect(sg); sg.connect(master); src.start();
  skid = { g: sg, f: bf };
  setInterval(schedule, 60);
}
export function setSound(on) { soundOn = on; if (master) master.gain.value = on ? 0.9 : 0; }
export function setMusic(on) { musicOn = on; if (musicGain) musicGain.gain.value = on ? 0.22 : 0; }

export function engineSound(speed01, boost, on) {
  if (!engine) return;
  const t = ctx.currentTime, f = 55 + speed01 * 150 + (boost ? 45 : 0);
  engine.o1.frequency.setTargetAtTime(f, t, 0.05); engine.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
  engine.f.frequency.setTargetAtTime(350 + speed01 * 1300, t, 0.08);
  engine.g.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.05 : 0, t, 0.08);
}
export function skidSound(amount) { if (skid) skid.g.gain.setTargetAtTime(amount * 0.13, ctx.currentTime, 0.05); }

function tone(freq, dur, type = 'square', vol = 0.15, slide = 0, delay = 0, dest = master) {
  if (!ctx) return;
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, freq, vol = 0.2, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay, n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = vol; s.connect(f); f.connect(g); g.connect(master); s.start(t);
}
export const sfx = {
  beep: () => tone(440, 0.18, 'square', 0.16),
  go: () => { tone(880, 0.5, 'square', 0.18); tone(1320, 0.5, 'triangle', 0.12); },
  click: () => tone(660, 0.06, 'triangle', 0.12),
  coin: () => { tone(988, 0.08, 'square', 0.1); tone(1319, 0.2, 'square', 0.1, 0, 0.08); },
  box: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.09, 'square', 0.1, 0, i * 0.06)),
  boost: () => { noise(0.7, 900, 0.3); tone(180, 0.6, 'sawtooth', 0.14, 500); },
  turbo: (lv) => { noise(0.3, 1400, 0.18); tone(300 + lv * 120, 0.25, 'sawtooth', 0.1, 400); },
  charged: () => { tone(784, 0.1, 'triangle', 0.14); tone(1175, 0.22, 'triangle', 0.14, 0, 0.1); },
  hit: () => { noise(0.35, 400, 0.35); tone(300, 0.4, 'sawtooth', 0.14, -220); },
  block: () => { tone(1200, 0.12, 'sine', 0.16); tone(1600, 0.2, 'sine', 0.14, 0, 0.08); },
  wall: () => noise(0.16, 220, 0.3),
  use: () => tone(520, 0.14, 'triangle', 0.14, 300),
  thunder: () => { noise(0.8, 160, 0.45); },
  lap: () => [659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'square', 0.12, 0, i * 0.1)),
  finish: () => [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.22, 'square', 0.13, 0, i * 0.11)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'triangle', 0.14, 0, i * 0.18)),
};

// ── 배경 음악: 트랙마다 다른 음계와 빠르기 ──
const TUNES = {
  menu: { bpm: 112, root: 60, scale: [0, 2, 4, 7, 9], bass: [0, 0, 5, 7], wave: 'triangle' },
  forest: { bpm: 138, root: 60, scale: [0, 2, 4, 5, 7, 9, 11], bass: [0, 5, 7, 5], wave: 'square' },
  beach: { bpm: 126, root: 65, scale: [0, 2, 4, 7, 9], bass: [0, 7, 5, 7], wave: 'triangle' },
  snow: { bpm: 132, root: 62, scale: [0, 2, 3, 5, 7, 8, 10], bass: [0, 3, 5, 7], wave: 'square' },
  city: { bpm: 146, root: 57, scale: [0, 3, 5, 7, 10], bass: [0, 0, 3, 5], wave: 'sawtooth' },
  volcano: { bpm: 152, root: 55, scale: [0, 1, 4, 5, 7, 8, 10], bass: [0, 1, 0, 5], wave: 'sawtooth' },
  cloud: { bpm: 142, root: 67, scale: [0, 2, 4, 6, 7, 9, 11], bass: [0, 4, 5, 2], wave: 'triangle' },
};
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
let seed = 1; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
export function setTune(name) {
  if (tune && tune.name === name) return;
  const t = TUNES[name]; if (!t) { tune = null; return; }
  seed = name.length * 977 + name.charCodeAt(0) * 31;
  // 32칸짜리 가락을 미리 만든다 (같은 트랙은 늘 같은 노래)
  const mel = []; let deg = 2;
  for (let i = 0; i < 32; i++) { if (i % 8 === 7 || rnd() < 0.18) mel.push(null); else { deg = Math.max(0, Math.min(t.scale.length * 2 - 1, deg + Math.floor(rnd() * 5) - 2)); mel.push(deg); } }
  tune = { ...t, name, mel }; step = 0; nextNote = ctx ? ctx.currentTime + 0.1 : 0;
}
function schedule() {
  if (!ctx || !tune || ctx.state !== 'running') return;
  const beat = 60 / tune.bpm / 2;
  if (nextNote < ctx.currentTime) nextNote = ctx.currentTime + 0.05;
  while (nextNote < ctx.currentTime + 0.25) {
    const delay = nextNote - ctx.currentTime, i = step % 32, deg = tune.mel[i];
    if (deg != null) { const oct = Math.floor(deg / tune.scale.length), note = tune.root + 12 + oct * 12 + tune.scale[deg % tune.scale.length]; tone(hz(note), beat * 0.9, tune.wave, 0.5, 0, delay, musicGain); }
    if (i % 2 === 0) tone(hz(tune.root - 12 + tune.bass[Math.floor(i / 8) % 4]), beat * 1.6, 'triangle', 0.7, 0, delay, musicGain);
    if (i % 4 === 2) tone(hz(tune.root + tune.bass[Math.floor(i / 8) % 4] + 7), beat * 0.5, 'square', 0.16, 0, delay, musicGain);
    step++; nextNote += beat;
  }
}
