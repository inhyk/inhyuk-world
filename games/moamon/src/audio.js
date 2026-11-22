// 소리: 효과음과 배경 음악을 모두 코드로 만든다 (소리 파일 없음)
let ctx = null, master = null, musicGain = null, sfxGain = null, timer = null, step = 0, nextT = 0, mode = 'off';
const opt = { sound: true, music: true };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
export function unlock() { if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination); musicGain = ctx.createGain(); musicGain.connect(master); sfxGain = ctx.createGain(); sfxGain.connect(master); apply(); } if (ctx.state === 'suspended') ctx.resume(); }
function apply() { if (!ctx) return; musicGain.gain.value = opt.music ? 0.5 : 0; sfxGain.gain.value = opt.sound ? 0.9 : 0; }
export function setOptions(o) { Object.assign(opt, o); apply(); }
function tone(dest, type, f0, f1, t0, dur, vol, attack = 0.005) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.03);
}
let noiseBuf = null;
function noise(dest, t0, dur, vol, f0 = 2000, f1 = 2000, q = 1) {
  if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q; f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); s.connect(f); f.connect(g); g.connect(dest); s.start(t0); s.stop(t0 + dur + 0.02);
}
const seq = (notes, type, gap, dur, vol) => (t) => notes.forEach((n, i) => tone(sfxGain, type, hz(n), hz(n), t + i * gap, dur, vol));
const SFX = {
  tap: (t) => tone(sfxGain, 'sine', 720, 900, t, 0.06, 0.15),
  open: (t) => { tone(sfxGain, 'sine', 500, 800, t, 0.1, 0.14); },
  close: (t) => tone(sfxGain, 'sine', 700, 450, t, 0.09, 0.12),
  appear: (t) => { tone(sfxGain, 'triangle', 300, 900, t, 0.25, 0.2); tone(sfxGain, 'sine', 900, 1400, t + 0.2, 0.2, 0.15); },
  throw: (t) => noise(sfxGain, t, 0.28, 0.35, 500, 3200, 0.8),
  hit: (t) => { tone(sfxGain, 'triangle', 600, 1200, t, 0.12, 0.25); noise(sfxGain, t, 0.08, 0.2, 3000, 1500); },
  miss: (t) => tone(sfxGain, 'sine', 180, 90, t, 0.18, 0.25),
  bounce: (t) => tone(sfxGain, 'sine', 260, 140, t, 0.1, 0.22),
  deflect: (t) => { tone(sfxGain, 'square', 500, 200, t, 0.14, 0.12); noise(sfxGain, t, 0.1, 0.2, 2500, 800); },
  guard: (t) => tone(sfxGain, 'sawtooth', 200, 330, t, 0.3, 0.07),
  wobble: (t) => { tone(sfxGain, 'triangle', 520, 520, t, 0.07, 0.22); tone(sfxGain, 'triangle', 390, 390, t + 0.12, 0.09, 0.22); },
  caught: seq([72, 76, 79, 84, 88], 'triangle', 0.09, 0.3, 0.22),
  pop: (t) => { noise(sfxGain, t, 0.15, 0.4, 1500, 5000, 0.6); tone(sfxGain, 'sine', 700, 200, t, 0.15, 0.15); },
  flee: (t) => tone(sfxGain, 'triangle', 900, 200, t, 0.4, 0.16),
  berry: seq([76, 81], 'sine', 0.08, 0.15, 0.18),
  shiny: seq([84, 88, 91, 96, 91, 96], 'sine', 0.06, 0.2, 0.14),
  spin: (t) => { noise(sfxGain, t, 0.5, 0.18, 600, 4000, 2); tone(sfxGain, 'sine', 300, 1200, t, 0.5, 0.1); },
  item: seq([84, 91], 'sine', 0.06, 0.12, 0.16),
  coin: seq([88, 93], 'square', 0.05, 0.08, 0.07),
  level: seq([67, 72, 76, 79, 84, 79, 84], 'triangle', 0.11, 0.32, 0.2),
  hatch: seq([72, 74, 76, 79, 84], 'sine', 0.1, 0.3, 0.2),
  evolve: seq([60, 64, 67, 72, 76, 79, 84, 88], 'triangle', 0.1, 0.4, 0.18),
  power: seq([67, 72, 79], 'sine', 0.06, 0.18, 0.18),
  attack: (t) => { noise(sfxGain, t, 0.09, 0.3, 1800, 600, 0.7); tone(sfxGain, 'square', 260, 140, t, 0.08, 0.08); },
  hurt: (t) => { noise(sfxGain, t, 0.12, 0.3, 900, 300, 0.7); tone(sfxGain, 'sawtooth', 180, 90, t, 0.12, 0.08); },
  charge: (t) => { tone(sfxGain, 'sawtooth', 150, 900, t, 0.45, 0.12); noise(sfxGain, t + 0.4, 0.4, 0.45, 4000, 300, 0.5); tone(sfxGain, 'sine', 120, 50, t + 0.4, 0.4, 0.3); },
  warn: seq([81, 81], 'square', 0.14, 0.09, 0.1),
  dodge: (t) => noise(sfxGain, t, 0.15, 0.25, 800, 3000, 1.5),
  faint: (t) => tone(sfxGain, 'triangle', 500, 110, t, 0.5, 0.2),
  win: seq([72, 72, 72, 76, 79, 76, 79, 84], 'triangle', 0.12, 0.3, 0.2),
  lose: seq([67, 64, 60, 55], 'triangle', 0.2, 0.4, 0.18),
  no: (t) => tone(sfxGain, 'square', 200, 160, t, 0.15, 0.08),
};
export function sfx(name) { if (!ctx || !opt.sound || !SFX[name]) return; SFX[name](ctx.currentTime + 0.005); }

// ---- 배경 음악: 8분음표 단위로 미리 예약한다 ----
const SONGS = {
  map: { bpm: 104, chords: [[48, 64, 67, 72], [43, 62, 67, 71], [45, 64, 69, 72], [41, 65, 69, 72], [48, 64, 67, 72], [43, 62, 67, 71], [41, 65, 69, 72], [43, 62, 67, 74]],
    lead: [76, 0, 79, 0, 84, 0, 83, 81, 79, 0, 0, 76, 74, 0, 76, 0, 72, 0, 76, 0, 81, 0, 79, 76, 77, 0, 0, 81, 79, 0, 77, 0, 76, 0, 79, 0, 84, 0, 86, 84, 83, 0, 0, 79, 81, 0, 83, 0, 81, 0, 84, 0, 81, 0, 77, 0, 79, 0, 0, 0, 74, 0, 0, 0] },
  night: { bpm: 80, chords: [[45, 64, 69, 72], [41, 65, 69, 72], [48, 64, 67, 72], [43, 62, 67, 71], [45, 64, 69, 72], [41, 65, 69, 72], [50, 65, 69, 74], [40, 64, 68, 71]],
    lead: [81, 0, 0, 0, 84, 0, 0, 83, 81, 0, 0, 0, 77, 0, 0, 0, 79, 0, 0, 0, 84, 0, 0, 0, 83, 0, 79, 0, 74, 0, 0, 0, 81, 0, 0, 0, 88, 0, 0, 86, 84, 0, 0, 0, 81, 0, 0, 0, 77, 0, 81, 0, 86, 0, 0, 0, 83, 0, 80, 0, 76, 0, 0, 0] },
  catch: { bpm: 138, drums: 1, chords: [[45, 64, 69, 72], [41, 65, 69, 72], [48, 64, 67, 72], [43, 62, 67, 74]],
    lead: [81, 0, 84, 81, 88, 0, 84, 0, 81, 0, 84, 0, 86, 84, 81, 0, 79, 0, 84, 79, 88, 0, 84, 0, 86, 0, 83, 0, 79, 0, 83, 86] },
  battle: { bpm: 156, drums: 2, chords: [[38, 62, 65, 69], [38, 62, 65, 69], [34, 62, 65, 70], [36, 64, 67, 72], [38, 62, 65, 69], [41, 65, 69, 72], [43, 62, 67, 71], [45, 61, 64, 69]],
    lead: [74, 0, 74, 77, 81, 0, 77, 0, 74, 0, 77, 81, 86, 0, 81, 0, 82, 0, 77, 0, 74, 0, 77, 0, 79, 0, 76, 0, 72, 0, 76, 79, 74, 0, 74, 77, 81, 0, 86, 0, 84, 0, 81, 0, 77, 0, 81, 0, 79, 0, 83, 0, 86, 0, 83, 79, 81, 0, 85, 0, 88, 0, 0, 0] },
};
function tick() {
  if (!ctx || mode === 'off') return; const s = SONGS[mode], d = 30 / s.bpm;
  if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
  while (nextT < ctx.currentTime + 0.25) {
    const bar = Math.floor(step / 8) % s.chords.length, k = step % 8, ch = s.chords[bar], t = nextT;
    if (k === 0 || k === 4 || (s.drums && k % 2 === 0)) tone(musicGain, 'triangle', hz(ch[0]), hz(ch[0]), t, d * (s.drums ? 0.9 : 3.4), 0.2, 0.01);
    if (k === 0) for (const n of ch.slice(1)) tone(musicGain, 'sine', hz(n - 12), hz(n - 12), t, d * 8, 0.035, 0.3);
    const arp = ch[1 + [0, 1, 2, 1, 0, 2, 1, 2][k]]; tone(musicGain, 'triangle', hz(arp), hz(arp), t, d * 0.9, 0.05, 0.01);
    const n = s.lead[step % s.lead.length]; if (n) { tone(musicGain, 'sine', hz(n), hz(n), t, d * 1.8, 0.12, 0.02); tone(musicGain, 'triangle', hz(n + 12), hz(n + 12), t, d * 0.8, 0.02, 0.01); }
    if (s.drums) { if (k % 4 === 0) tone(musicGain, 'sine', 130, 45, t, 0.12, 0.3); if (k % 4 === 2) noise(musicGain, t, 0.09, 0.12, 2200, 1200); if (s.drums === 2 || k % 2) noise(musicGain, t, 0.03, 0.05, 8000, 8000, 2); }
    step++; nextT += d;
  }
}
export function music(m) { if (mode === m) return; mode = m; step = 0; nextT = 0; if (!timer) timer = setInterval(tick, 60); }
