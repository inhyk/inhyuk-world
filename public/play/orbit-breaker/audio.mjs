export function createAudio() {
  let context, master, enabled = false, beatTime = 0, beat = 0;
  const notes = [110, 164.81, 220, 164.81, 130.81, 196, 261.63, 196];
  function init() {
    if (!context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      context = new Audio(); master = context.createGain(); master.gain.value = 0.16; master.connect(context.destination);
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
  }
  function tone(frequency, end, duration, volume, type = 'sine', delay = 0) {
    if (!enabled || !context || context.state !== 'running') return;
    const start = context.currentTime + delay;
    const osc = context.createOscillator(), gain = context.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), start + duration);
    gain.gain.setValueAtTime(volume, start); gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain); gain.connect(master); osc.start(start); osc.stop(start + duration);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  return {
    unlock() { if (enabled) init(); },
    setEnabled(value) {
      enabled = value;
      if (enabled) init();
      if (master) master.gain.value = enabled ? 0.16 : 0;
      return enabled;
    },
    play(event) {
      if (event === 'shot') tone(950, 350, 0.055, 0.09, 'triangle');
      if (event === 'explode') { tone(130, 28, 0.2, 0.35, 'sawtooth'); tone(65, 24, 0.3, 0.4); }
      if (event === 'hurt') tone(180, 35, 0.35, 0.5, 'sawtooth');
      if (event === 'nova') { tone(70, 500, 0.25, 0.5, 'sawtooth'); tone(450, 22, 0.8, 0.5, 'triangle'); }
      if (event === 'pickup' || event === 'wave') [440, 554.37, 659.25].forEach((n, i) => tone(n, n, 0.18, 0.28, 'sine', i * 0.09));
      if (event === 'warning') [0, 0.22, 0.44].forEach(delay => tone(220, 200, 0.15, 0.24, 'square', delay));
      if (event === 'win') [261.63, 329.63, 392, 523.25, 659.25].forEach((n, i) => tone(n, n, 0.5, 0.3, 'triangle', i * 0.14));
      if (event === 'lose') [220, 164.81, 110].forEach((n, i) => tone(n, n * 0.8, 0.4, 0.3, 'triangle', i * 0.19));
    },
    tick(dt, playing) {
      if (!enabled || !playing) return;
      beatTime -= dt;
      if (beatTime <= 0) {
        beatTime = 0.28; const note = notes[beat % notes.length];
        tone(note * 2, note * 2, 0.2, 0.1, 'triangle');
        if (beat % 4 === 0) { tone(note / 2, note / 2, 0.65, 0.15); tone(85, 30, 0.13, 0.3); }
        beat++;
      }
    },
  };
}
