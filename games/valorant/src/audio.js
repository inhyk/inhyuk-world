export class GameAudio {
  constructor() { this.context = null; this.muted = false; this.master = null; }
  unlock() {
    try {
      if (!this.context) {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.context.createGain();
        this.master.gain.value = 0.22;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === "suspended") this.context.resume().catch(() => {});
    } catch { /* Play remains available without audio. */ }
  }
  tone(frequency, duration, type = "sine", volume = 0.3, endFrequency = frequency, delay = 0) {
    if (this.muted || !this.context || this.context.state !== "running") return;
    const t = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator(), gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, t);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), t + duration);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    oscillator.connect(gain); gain.connect(this.master);
    oscillator.start(t); oscillator.stop(t + duration + 0.02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  noise(duration, volume = 0.4, frequency = 1500) {
    if (this.muted || !this.context || this.context.state !== "running") return;
    const buffer = this.context.createBuffer(1, Math.ceil(this.context.sampleRate * duration), this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
    const source = this.context.createBufferSource(), filter = this.context.createBiquadFilter(), gain = this.context.createGain();
    source.buffer = buffer; filter.type = "lowpass"; filter.frequency.value = frequency;
    gain.gain.value = volume;
    source.connect(filter); filter.connect(gain); gain.connect(this.master);
    source.start();
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  play(event) {
    if (event === "shot") { this.noise(0.16, 1.3, 5200); this.tone(160, 0.11, "triangle", 0.8, 38); }
    if (event === "enemyShot") { this.noise(0.12, 0.24, 2200); this.tone(120, 0.08, "triangle", 0.18, 45); }
    if (event === "hit") this.tone(1000, 0.05, "triangle", 0.4, 600);
    if (event === "headshot") { this.tone(1700, 0.13, "sine", 0.45, 2400); this.tone(2500, 0.08, "sine", 0.18, 1800, 0.05); }
    if (event === "kill") [440, 660, 880].forEach((f, i) => this.tone(f, 0.18, "triangle", 0.3, f, i * 0.055));
    if (event === "reload" || event === "switch") { this.noise(0.12, 0.4, 1800); this.tone(260, 0.08, "square", 0.1, 190); }
    if (event === "reloaded") { this.noise(0.08, 0.6, 3500); this.tone(500, 0.06, "square", 0.08, 300); }
    if (event === "damage") this.tone(85, 0.18, "sine", 0.6, 40);
    if (event === "dash" || event === "smoke") { this.noise(0.45, 0.6, 950); this.tone(300, 0.3, "sine", 0.2, 750); }
    if (event === "heal") [440, 550, 660].forEach((f, i) => this.tone(f, 0.35, "sine", 0.25, f, i * 0.12));
    if (event === "go") { this.tone(500, 0.2, "triangle", 0.4, 500); this.tone(750, 0.3, "triangle", 0.3, 750, 0.2); }
    if (event === "beep") this.tone(1250, 0.09, "sine", 0.24);
    if (event === "step") this.noise(0.075, 0.18, 500);
    if (event === "win") [330, 440, 554, 660].forEach((f, i) => this.tone(f, 0.65, "triangle", 0.35, f, i * 0.13));
    if (event === "lose") [330, 277, 220].forEach((f, i) => this.tone(f, 0.6, "triangle", 0.3, f, i * 0.2));
  }
}
