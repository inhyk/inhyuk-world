import { TRACK_DURATION } from './presentation.mjs';

const STEP = .125;
const CHORDS = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60], [62, 65, 69], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
const THEMES = [
  [76, 0, 79, 81, 0, 79, 74, 76, 72, 0, 74, 79, 0, 76, 74, 0],
  [79, 81, 84, 0, 83, 79, 76, 0, 77, 79, 81, 77, 74, 76, 79, 0],
  [84, 0, 83, 79, 81, 0, 76, 79, 77, 0, 81, 84, 83, 79, 74, 0],
  [72, 0, 0, 76, 0, 0, 79, 0, 74, 0, 0, 77, 0, 0, 76, 0],
];
export function scoreAt(stepIndex) {
  const time = stepIndex * STEP;
  if (time >= TRACK_DURATION) return [];
  const chord = CHORDS[Math.floor(time / 2) % CHORDS.length];
  const section = time < 10 ? 'intro' : time < 58 ? 'rise' : time < 106 ? 'flight' : time < 130 ? 'quiet' : time < 174 ? 'finale' : 'outro';
  const events = [];
  const add = (note, duration, volume, type = 'triangle') => events.push({ note, duration, volume, type });
  const fade = time > 176 ? (182 - time) / 6 : 1;
  if (stepIndex % 16 === 0) chord.forEach(note => add(note - 12, 1.85, .016 * fade, 'sine'));
  if (stepIndex % 4 === 0) add(chord[0] - 24, .42, .07 * fade);
  if (section === 'intro' || section === 'quiet' || section === 'outro') {
    if (stepIndex % 4 === 0) add(chord[Math.floor(stepIndex / 4) % 3] + 12, .65, .038 * fade, 'sine');
  } else {
    const theme = THEMES[section === 'rise' ? 0 : section === 'flight' ? 1 : 2];
    if (stepIndex % 2 === 0) {
      const note = theme[Math.floor(stepIndex / 2) % theme.length];
      if (note) { add(note, .21, .034 * fade, 'square'); add(note - 12, .23, .028 * fade); }
    }
    add(chord[stepIndex % 3] + 12, .095, .013 * fade);
    if (stepIndex % 4 === 0) add(stepIndex % 8 === 0 ? 31 : 43, .09, .08 * fade, 'triangle');
    if (stepIndex % 2 === 1) add(102, .025, .009 * fade, 'square');
  }
  return events;
}
export class BattleMusic {
  constructor() { this.context = null; this.master = null; this.enabled = false; this.nextStep = 0; this.nodes = new Set(); }
  enable(enabled) {
    if (enabled && !this.context) {
      this.context = new AudioContext(); this.master = this.context.createGain();
      this.master.gain.value = .65; this.master.connect(this.context.destination);
    }
    this.enabled = enabled;
    if (enabled) this.context.resume().catch(() => {});
    else this.stop();
  }
  effect(name) {
    if (!this.enabled || !this.context) return;
    const cues = {
      star: [[880, .11, 'sine'], [1320, .16, 'sine']],
      sword: [[170, .14, 'sawtooth'], [360, .1, 'triangle']],
      thunder: [[55, .22, 'sawtooth'], [110, .16, 'triangle']],
      cannon: [[90, .25, 'sawtooth'], [660, .18, 'square']],
      transform: [[130, .9, 'sawtooth'], [262, 1.2, 'triangle'], [523, 1.6, 'sine']],
      memory: [[523, .4, 'sine'], [659, .5, 'sine'], [784, .7, 'sine']],
      refuse: [[220, .6, 'triangle'], [440, .8, 'sine'], [880, 1.2, 'sine']],
      save: [[262, 1.6, 'sine'], [330, 1.8, 'sine'], [392, 2, 'sine'], [523, 2.4, 'sine']],
    };
    for (const [i, [frequency, duration, type]] of (cues[name] || cues.star).entries()) {
      const node = this.context.createOscillator(), gain = this.context.createGain(), at = this.context.currentTime + i * .06;
      node.type = type; node.frequency.setValueAtTime(frequency, at);
      if (['cannon', 'thunder', 'sword'].includes(name)) node.frequency.exponentialRampToValueAtTime(frequency * .3, at + duration);
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.035, at + .01); gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
      node.connect(gain); gain.connect(this.master); node.start(at); node.stop(at + duration + .02);
      this.nodes.add(node); node.onended = () => { node.disconnect(); gain.disconnect(); this.nodes.delete(node); };
    }
  }
  stop() {
    for (const node of this.nodes) { try { node.stop(); } catch {} }
    this.nodes.clear();
  }
  reset() { this.stop(); this.nextStep = 0; }
  update(time, active) {
    const position = time % TRACK_DURATION;
    const currentStep = Math.floor(position / STEP);
    if (!active || !this.enabled) { this.stop(); this.nextStep = currentStep; return; }
    if (currentStep < this.nextStep - 2 || currentStep > this.nextStep + 4) this.nextStep = currentStep;
    if (currentStep < this.nextStep) return;
    for (const event of scoreAt(currentStep)) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const now = this.context.currentTime;
      oscillator.type = event.type; oscillator.frequency.value = 440 * 2 ** ((event.note - 69) / 12);
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(event.volume, now + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, now + event.duration);
      oscillator.connect(gain); gain.connect(this.master); oscillator.start(); oscillator.stop(now + event.duration + .02);
      this.nodes.add(oscillator);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); this.nodes.delete(oscillator); };
    }
    this.nextStep = currentStep + 1;
  }
}
