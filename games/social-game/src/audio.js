// Small synthesized sound kit (no sound files): footsteps, blocks, doors, alarm, register, engine, ambience.
let ctx = null, master = null, engineNodes = null, amb = null;
export let muted = false;

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export function unlock() { ac(); }
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.55; }
/** The shared context and master gain (the fountain show plays its music through them), or null. */
export function audioOut() { return ac() ? { ctx, master } : null; }

function noiseBuffer(sec = 0.5) {
  const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
let nb = null;
function noise(t, dur, { freq = 1200, q = 1, type = 'bandpass', gain = 0.3, attack = 0.005 } = {}) {
  nb ??= noiseBuffer(1);
  const s = ctx.createBufferSource(); s.buffer = nb;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.05);
}
function tone(t, freq, dur, { type = 'sine', gain = 0.2, slide = 0, attack = 0.01 } = {}) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
}

/** Low animal voice: sawtooth through a resonant low-pass, roughened by fast amplitude flutter. */
function growl(t, dur, { f0 = 90, f1 = 72, gain = 0.25, rough = 26, cutoff = 520 } = {}) {
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * 1.15, t + dur * 0.3); o.frequency.linearRampToValueAtTime(f1, t + dur);
  const am = ctx.createOscillator(); am.frequency.value = rough;
  const amg = ctx.createGain(); amg.gain.value = 0.45;
  const vca = ctx.createGain(); vca.gain.value = 0.55;
  am.connect(amg).connect(vca.gain);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; lp.Q.value = 2.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.07); g.gain.setValueAtTime(gain, t + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(vca).connect(lp).connect(g).connect(master);
  o.start(t); am.start(t); o.stop(t + dur + 0.05); am.stop(t + dur + 0.05);
  noise(t, dur, { freq: 320, q: 0.6, gain: gain * 0.45, attack: 0.08 });
}

/** Play a named effect. */
export function sfx(name, opt = {}) {
  if (!ac() || muted) return;
  const t = ctx.currentTime;
  switch (name) {
    case 'step': noise(t, 0.09, { freq: opt.surface === 'wood' ? 500 : opt.surface === 'sand' ? 2400 : 900, q: 0.8, gain: 0.12 }); break;
    case 'hit': noise(t, 0.07, { freq: 700, q: 2, gain: 0.25 }); break;
    case 'break': noise(t, 0.35, { freq: 500, q: 0.7, gain: 0.45 }); noise(t + 0.03, 0.2, { freq: 2200, q: 1, gain: 0.15 }); break;
    case 'place': tone(t, 140, 0.15, { type: 'triangle', gain: 0.35, slide: -60 }); noise(t, 0.08, { freq: 400, gain: 0.2 }); break;
    case 'pickup': tone(t, 660, 0.09, { gain: 0.15 }); tone(t + 0.07, 990, 0.12, { gain: 0.15 }); break;
    case 'door': noise(t, 0.25, { freq: 300, q: 3, gain: 0.25 }); tone(t, 90, 0.2, { type: 'triangle', gain: 0.15 }); break;
    case 'slide': noise(t, 0.6, { freq: 1800, q: 0.5, gain: 0.08, attack: 0.15 }); break;
    case 'eat': for (let i = 0; i < 3; i++) noise(t + i * 0.16, 0.08, { freq: 1500, q: 1.5, gain: 0.2 }); break;
    case 'water': noise(t, 1.4, { freq: 3000, q: 0.4, gain: 0.12, attack: 0.2 }); break;
    case 'alarm': for (let i = 0; i < 6; i++) { tone(t + i * 0.28, 1760, 0.12, { type: 'square', gain: 0.07 }); } break;
    case 'coin': tone(t, 988, 0.1, { type: 'square', gain: 0.08 }); tone(t + 0.09, 1319, 0.35, { type: 'square', gain: 0.08 }); break;
    case 'done': [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.09, f, 0.3, { type: 'triangle', gain: 0.14 })); break;
    case 'click': tone(t, 1200, 0.04, { type: 'square', gain: 0.05 }); break;
    case 'wrong': tone(t, 220, 0.25, { type: 'sawtooth', gain: 0.08, slide: -60 }); break;
    case 'shutter': noise(t, 0.05, { freq: 3000, gain: 0.4 }); noise(t + 0.08, 0.06, { freq: 2000, gain: 0.3 }); break;
    case 'sizzle': noise(t, 0.6, { freq: 5000, q: 0.3, type: 'highpass', gain: 0.06, attack: 0.05 }); break;
    case 'cheers': [784, 988].forEach((f, i) => tone(t + i * 0.05, f, 0.5, { gain: 0.1 })); break;
    case 'horn': tone(t, 392, 0.4, { type: 'sawtooth', gain: 0.07 }); tone(t, 494, 0.4, { type: 'sawtooth', gain: 0.06 }); break;
    case 'carDoor': noise(t, 0.12, { freq: 250, q: 2, gain: 0.35 }); break;
    // 반달가슴곰: breathy huffs with a jaw pop, a low grunt while foraging, a roar for the bluff charge
    case 'bearHuff': { const g = opt.gain ?? 1;
      noise(t, 0.3, { freq: 430, q: 0.9, gain: 0.5 * g, attack: 0.015 }); noise(t + 0.34, 0.26, { freq: 380, q: 0.9, gain: 0.4 * g, attack: 0.015 });
      tone(t, 95, 0.2, { type: 'triangle', gain: 0.14 * g, slide: -35 });
      noise(t + 0.66, 0.03, { freq: 1700, q: 4, gain: 0.35 * g }); noise(t + 0.74, 0.03, { freq: 1500, q: 4, gain: 0.3 * g }); break; }
    case 'bearGrunt': growl(t, 0.32 + Math.random() * 0.15, { f0: 92, f1: 74, gain: 0.13 * (opt.gain ?? 1), rough: 22 }); break;
    case 'bearRoar': growl(t, 1.15, { f0: 115, f1: 78, gain: 0.34 * (opt.gain ?? 1), rough: 34, cutoff: 950 }); break;
    default: break;
  }
}

/** Continuous engine hum; call every frame with speed (m/s) or null to stop. */
export function engineSound(speed) {
  if (!ac() || muted) { if (engineNodes) { engineNodes.g.gain.value = 0; } return; }
  if (speed == null) { if (engineNodes) engineNodes.g.gain.setTargetAtTime(0, ctx.currentTime, 0.2); return; }
  if (!engineNodes) {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'triangle';
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    const g = ctx.createGain(); g.gain.value = 0;
    o1.connect(f); o2.connect(f); f.connect(g).connect(master);
    o1.start(); o2.start();
    engineNodes = { o1, o2, f, g };
  }
  const a = Math.abs(speed);
  engineNodes.o1.frequency.setTargetAtTime(38 + a * 4.2, ctx.currentTime, 0.08);
  engineNodes.o2.frequency.setTargetAtTime(76 + a * 8.4, ctx.currentTime, 0.08);
  engineNodes.f.frequency.setTargetAtTime(300 + a * 30, ctx.currentTime, 0.1);
  engineNodes.g.gain.setTargetAtTime(0.06 + a * 0.004, ctx.currentTime, 0.1);
}

/** Birds by day, crickets at night, waves at the beach (0..1 each). */
export function ambience(day, night, sea) {
  if (!ctx || muted) return;
  if (!amb) {
    nb ??= noiseBuffer(1);
    const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(f).connect(g).connect(master); s.start();
    amb = { g, t: 0 };
  }
  const now = ctx.currentTime;
  amb.g.gain.setTargetAtTime(sea * (0.06 + 0.04 * Math.sin(now * 0.7)), now, 0.3);
  if (now > amb.t) {
    amb.t = now + 0.6 + Math.random() * 2.5;
    if (day > 0.5 && Math.random() < 0.6 * day) {
      const base = 2400 + Math.random() * 1600;
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) tone(now + i * 0.11, base + Math.random() * 500, 0.08, { gain: 0.025, slide: 600 });
    }
    if (night > 0.5 && Math.random() < 0.8) for (let i = 0; i < 4; i++) tone(now + i * 0.06, 4200, 0.04, { type: 'square', gain: 0.008 });
  }
}

/** A soft piano-like note (Hz). */
export function note(freq) {
  if (!ac() || muted) return;
  const t = ctx.currentTime;
  tone(t, freq, 1.1, { type: 'triangle', gain: 0.18, attack: 0.005 });
  tone(t, freq * 2, 0.6, { type: 'sine', gain: 0.05, attack: 0.005 });
}
