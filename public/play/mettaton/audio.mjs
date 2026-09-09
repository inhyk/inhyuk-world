// Original, procedural synth-funk score. No downloaded music or audio assets.
export class Soundtrack {
  constructor() { this.context = null; this.enabled = false; this.step = 0; this.next = 0; this.phase = 1; this.timer = null; this.paused = false; }
  async enable() {
    try {
      if (!this.context) {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.context.createGain(); this.master.gain.value = .25;
        const compressor = this.context.createDynamicsCompressor();
        this.master.connect(compressor); compressor.connect(this.context.destination);
      }
      await this.context.resume(); this.enabled = true; this.next = this.context.currentTime + .05;
      this.master.gain.setTargetAtTime(.25, this.context.currentTime, .03);
      if (!this.timer) this.timer = setInterval(() => this.schedule(), 35);
      return true;
    } catch { return false; }
  }
  disable() {
    this.enabled = false;
    if (this.context) this.master.gain.setTargetAtTime(0, this.context.currentTime, .03);
    clearInterval(this.timer); this.timer = null;
  }
  pause(value) { this.paused = value; if (this.context) this.next = this.context.currentTime + .05; }
  tone(freq, time, length = .15, type = 'square', volume = .08, endFreq) {
    if (!this.context || !this.enabled) return;
    const c = this.context, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, time);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, time + length);
    g.gain.setValueAtTime(0, time); g.gain.linearRampToValueAtTime(volume, time + .006);
    g.gain.exponentialRampToValueAtTime(.001, time + length);
    o.connect(g); g.connect(this.master); o.start(time); o.stop(time + length + .02);
  }
  noise(time, length, volume, frequency) {
    const c = this.context, count = Math.ceil(c.sampleRate * length), buffer = c.createBuffer(1, count, c.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < count; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / count);
    const source = c.createBufferSource(), gain = c.createGain(), filter = c.createBiquadFilter();
    source.buffer = buffer; filter.type = 'highpass'; filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, time); gain.gain.exponentialRampToValueAtTime(.001, time + length);
    source.connect(filter); filter.connect(gain); gain.connect(this.master); source.start(time); source.stop(time + length);
  }
  schedule() {
    if (!this.enabled || this.paused) return;
    const c = this.context;
    if (this.next < c.currentTime - .1) this.next = c.currentTime + .02;
    while (this.next < c.currentTime + .12) {
      const n = this.step, t = this.next, beat = n % 16;
      const chords = [45, 48, 41, 43], root = chords[Math.floor(n / 32) % 4];
      const midi = m => 440 * 2 ** ((m - 69) / 12);
      const bass = [0,0,12,0,7,0,10,12,0,0,7,10,12,7,3,7];
      if (n % 2 === 0 || beat === 7 || beat === 15) this.tone(midi(root + bass[beat]), t, .16, 'sawtooth', .075);
      if (beat % 4 === 0) this.tone(140, t, .19, 'sine', .48, 38);
      if (beat === 4 || beat === 12) this.noise(t, .14, .15, 1100);
      if (n % 2 === 0) this.noise(t, .045, n % 4 === 2 ? .085 : .035, 7500);
      const melody = [12,19,22,19,15,0,19,24,22,19,15,17,19,0,10,12,12,0,15,19,22,24,19,0,17,15,12,10,7,10,12,0];
      if (n % 2 === 0) {
        const note = melody[Math.floor(n / 2) % melody.length];
        if (note) this.tone(midi(root + note + 12), t, .13, this.phase === 3 ? 'sawtooth' : 'square', .037);
      }
      if (beat === 2 || beat === 10) for (const note of [12,15,19,22]) this.tone(midi(root + note), t, .11, 'triangle', .048);
      this.step++; this.next += 60 / (this.phase === 3 ? 138 : this.phase === 2 ? 132 : 126) / 4;
    }
  }
  effect(name) {
    if (!this.context || !this.enabled) return;
    const t = this.context.currentTime;
    if (name === 'shoot') this.tone(1100, t, .06, 'square', .027, 400);
    else if (name === 'hurt') { this.noise(t, .18, .25, 200); this.tone(170, t, .2, 'sawtooth', .15, 45); }
    else if (['perfect','nohit','heal','win'].includes(name)) {
      const notes = name === 'win' ? [60,64,67,72,76,79,84] : [72,76,79,84];
      notes.forEach((m, i) => this.tone(440 * 2 ** ((m - 69) / 12), t + i * .075, .25, 'triangle', .17));
    } else if (['strike','bomb','laser','destroy'].includes(name)) {
      this.noise(t, .1, .12, 500); this.tone(220, t, .12, 'square', .08, 60);
    } else if (name === 'lose') [65,60,56,48].forEach((m,i) => this.tone(440 * 2 ** ((m-69)/12),t+i*.2,.4,'triangle',.2));
    else if (name === 'select' || name === 'start') { this.tone(660,t,.07,'square',.07); this.tone(990,t+.055,.1,'square',.05); }
    else if (name === 'target') this.tone(1450,t,.04,'sine',.05);
  }
  dispose() { this.disable(); if (this.context) this.context.close(); }
}
