// 효과음과 잔잔한 배경 음악을 Web Audio 로 바로 만든다 (소리 파일 없음)
let ctx = null;
let master = null;
let musicGain = null;
let noiseBuf = null;
export const sound = { on: true, music: true };

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function noise(dur, freq, q, vol, type = 'bandpass', when = 0) {
  if (!ctx || !sound.on) return;
  const t = ctx.currentTime + when;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5, dur + 0.05);
}
function tone(freq, dur, vol, type = 'square', slide = 0, when = 0, out = master) {
  if (!ctx || (!sound.on && out === master)) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

const MAT = {
  grass: [900, 0.6], dirt: [600, 0.7], sand: [1800, 0.5], snow: [2400, 0.5], wool: [500, 0.4],
  stone: [1300, 2.2], metal: [2600, 4], glass: [3200, 3], wood: [420, 2.5],
};
export const sfx = {
  dig(mat) {
    const [f, q] = MAT[mat] ?? MAT.stone;
    noise(0.08, f * (0.9 + Math.random() * 0.2), q, 0.22);
  },
  brk(mat) {
    const [f, q] = MAT[mat] ?? MAT.stone;
    noise(0.22, f, q, 0.4);
    noise(0.12, f * 1.6, q, 0.2, 'bandpass', 0.03);
    if (mat === 'glass') for (let k = 0; k < 4; k++) tone(2400 + Math.random() * 1800, 0.12, 0.05, 'triangle', 0.8, k * 0.03);
  },
  place(mat) {
    const [f, q] = MAT[mat] ?? MAT.stone;
    noise(0.1, f * 0.8, q, 0.32);
  },
  step(mat) {
    const [f, q] = MAT[mat] ?? MAT.stone;
    noise(0.05, f * 0.7, q, 0.07);
  },
  pop() { tone(500 + Math.random() * 300, 0.09, 0.12, 'sine', 1.8); },
  hurt() { tone(220, 0.18, 0.2, 'square', 0.6); noise(0.12, 500, 1, 0.15); },
  mobHurt(type) {
    const f = { pig: 520, cow: 180, sheep: 640, chicken: 1100, zombie: 140, skeleton: 900, creeper: 300, spider: 260 }[type] ?? 300;
    tone(f, 0.16, 0.12, type === 'skeleton' ? 'triangle' : 'sawtooth', 0.7);
  },
  groan() { tone(110 + Math.random() * 30, 0.6, 0.06, 'sawtooth', 0.8); },
  hiss() { noise(1.4, 3000, 0.4, 0.18, 'highpass'); },
  boom() {
    noise(1.2, 200, 0.7, 0.9, 'lowpass');
    noise(0.5, 900, 0.6, 0.4, 'lowpass');
    tone(60, 0.8, 0.4, 'sine', 0.5);
  },
  eat() { for (let k = 0; k < 3; k++) noise(0.07, 1400, 1.5, 0.2, 'bandpass', k * 0.13); },
  splash() { noise(0.4, 900, 0.6, 0.3, 'lowpass'); },
  bow() { tone(300, 0.12, 0.1, 'triangle', 2.2); noise(0.1, 2000, 2, 0.1); },
  click() { tone(800, 0.04, 0.06, 'square'); },
  note(pitch=0,bell=false) { tone((bell?660:262)*2**(pitch/12),bell?1:.35,.15,bell?'sine':'triangle'); },
  craft() { tone(660, 0.07, 0.08, 'triangle'); tone(990, 0.1, 0.08, 'triangle', 1, 0.06); },
  door() { noise(0.15, 380, 2, 0.35); tone(160, 0.1, 0.08, 'triangle'); },
  fizz() { noise(0.5, 2600, 0.8, 0.25, 'highpass'); },
  level() { [523, 659, 784, 1047].forEach((f, k) => tone(f, 0.18, 0.08, 'triangle', 1, k * 0.08)); },
};

// 배경 음악: 피아노 같은 음을 띄엄띄엄. 낮과 밤에 음계가 조금 다르다
const DAY = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3];
const NIGHT = [220, 246.9, 261.6, 329.6, 349.2, 440, 493.9, 523.3];
let nextNote = 0;
let phraseLeft = 0;
export function tickMusic(isNight) {
  if (!ctx || !sound.on || !sound.music) return;
  const now = ctx.currentTime;
  if (now < nextNote) return;
  if (phraseLeft <= 0) {
    phraseLeft = 6 + Math.floor(Math.random() * 8);
    nextNote = now + 6 + Math.random() * 10;
    return;
  }
  phraseLeft--;
  const scale = isNight ? NIGHT : DAY;
  const f = scale[Math.floor(Math.random() * scale.length)] * (Math.random() < 0.3 ? 0.5 : 1);
  tone(f, 2.6, 0.5, 'sine', 1, 0, musicGain);
  tone(f * 2, 1.4, 0.12, 'triangle', 1, 0, musicGain);
  if (Math.random() < 0.35) tone(f * 1.5, 2.2, 0.25, 'sine', 1, 0.02, musicGain);
  nextNote = now + [0.5, 0.75, 1, 1.5][Math.floor(Math.random() * 4)];
}
