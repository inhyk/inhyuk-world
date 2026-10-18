// Web Audio 로 반주를 연주한다. 미리 0.2초씩 앞서 음을 예약하고, 멈추면 예약한 음을 모두 끊는다.
import { arrange } from './arrange.mjs';

const freq = (midi) => 440 * 2 ** ((midi - 69) / 12);

function pulseWave(ctx, duty) {
  const size = 64, real = new Float32Array(size), imag = new Float32Array(size);
  for (let n = 1; n < size; n++) imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
  return ctx.createPeriodicWave(real, imag);
}

function impulse(ctx, seconds, decay) {
  const length = Math.floor(ctx.sampleRate * seconds), buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
  }
  return buffer;
}

export class Synth {
  constructor(score) {
    this.score = score;
    this.events = arrange(score);
    this.ctx = null;
    this.playing = false;
    this.position = 0; // 멈춰 있을 때의 박자 위치
    this.guide = true;
    this.lookahead = 0.2; // 몇 초 앞까지 미리 예약할지. 탭이 숨으면 타이머가 느려지니 늘린다
    this.listeners = new Set();
  }

  onNote(listener) { this.listeners.add(listener); }

  ensure(given) {
    if (this.ctx) return;
    const ctx = this.ctx = given ?? new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain();
    this.master.gain.value = 0.7;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16; compressor.ratio.value = 3.5; compressor.attack.value = 0.004; compressor.release.value = 0.2;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.75;
    // 마지막에 한 번 더 눌러서 소리가 찢어지지 않게 한다
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -4; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.08;
    this.master.connect(compressor).connect(limiter).connect(this.analyser).connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = impulse(ctx, 2.4, 3);
    const reverbOut = ctx.createGain(); reverbOut.gain.value = 0.55;
    this.reverb.connect(reverbOut).connect(this.master);

    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = this.score.beatSec * 0.75;
    const feedback = ctx.createGain(); feedback.gain.value = 0.32;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2600;
    this.delay.connect(tone).connect(feedback).connect(this.delay);
    const delayOut = ctx.createGain(); delayOut.gain.value = 0.4;
    tone.connect(delayOut).connect(this.master);

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.pulse25 = pulseWave(ctx, 0.25);
    this.pulse12 = pulseWave(ctx, 0.125);
    this.pulse40 = pulseWave(ctx, 0.4);
  }

  get duration() { return this.score.duration; }

  get beat() {
    if (!this.playing) return this.position;
    return this.startBeat + (this.ctx.currentTime - this.startTime) / this.score.beatSec;
  }

  async play(fromBeat = this.position) {
    this.ensure();
    if (this.ctx.state !== 'running') await this.ctx.resume();
    this.stopVoices();
    const ctx = this.ctx;
    this.session(ctx);
    this.startBeat = Math.max(0, fromBeat);
    this.startTime = ctx.currentTime + 0.06;
    this.cursor = this.events.findIndex((event) => event.beat >= this.startBeat - 1e-6);
    if (this.cursor < 0) this.cursor = this.events.length;
    this.playing = true;
    this.pending = [];
    this.tick();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 25);
  }

  pause() {
    if (!this.playing) return;
    this.position = Math.min(this.beat, this.score.totalBeats);
    this.playing = false;
    clearInterval(this.timer);
    this.stopVoices();
  }

  seek(beat) {
    const target = Math.max(0, Math.min(beat, this.score.totalBeats - 0.01));
    if (this.playing) this.play(target);
    else this.position = target;
  }

  // 연주 한 번마다 새 묶음을 만든다. 멈추면 이 묶음을 통째로 끊는다.
  // 같은 양의 울림 보내기와 드럼 필터는 음마다 만들지 않고 묶음 안에서 같이 쓴다(폰에서도 가볍게).
  session(ctx) {
    this.bus = ctx.createGain(); this.bus.connect(this.master);
    this.reverbSend = ctx.createGain(); this.reverbSend.connect(this.reverb);
    this.delaySend = ctx.createGain(); this.delaySend.connect(this.delay);
    this.voices = new Set();
    this.shared = new Map();
  }

  sharedNode(key, make) {
    if (!this.shared.has(key)) this.shared.set(key, make());
    return this.shared.get(key);
  }

  stopVoices() {
    if (!this.bus) return;
    const now = this.ctx.currentTime;
    const { bus, reverbSend, delaySend, voices } = this;
    for (const gain of [bus, reverbSend, delaySend]) { gain.gain.cancelScheduledValues(now); gain.gain.setValueAtTime(gain.gain.value, now); gain.gain.linearRampToValueAtTime(0, now + 0.04); }
    setTimeout(() => {
      for (const voice of voices) { try { voice.stop(); } catch { /* 이미 끝남 */ } }
      for (const gain of [bus, reverbSend, delaySend]) gain.disconnect();
    }, 80);
    this.bus = null;
    this.pending = [];
  }

  tick() {
    if (!this.playing) return;
    const horizon = this.beat + this.lookahead / this.score.beatSec;
    while (this.cursor < this.events.length && this.events[this.cursor].beat < horizon) {
      const event = this.events[this.cursor++];
      if (event.inst === 'vox' && !this.guide) continue;
      const time = this.startTime + (event.beat - this.startBeat) * this.score.beatSec;
      this.voice(event, Math.max(time, this.ctx.currentTime), event.dur * this.score.beatSec);
      if (this.listeners.size) this.pending.push({ at: time, event });
    }
    const now = this.ctx.currentTime;
    while (this.pending.length && this.pending[0].at <= now) {
      const { event } = this.pending.shift();
      this.listeners.forEach((listener) => listener(event));
    }
  }

  // 검사용: 노래 전체를 한 번에 예약한다. OfflineAudioContext 를 넘기면 소리를 파일처럼 미리 만들 수 있다.
  renderAll(ctx, keep = () => true, fromBeat = 0) {
    this.ensure(ctx);
    this.session(ctx);
    for (const event of this.events) {
      if (event.inst === 'vox' && !this.guide) continue;
      if (event.beat >= fromBeat && keep(event)) this.voice(event, 0.05 + (event.beat - fromBeat) * this.score.beatSec, event.dur * this.score.beatSec);
    }
  }

  // ---- 악기 ----

  track(source, time, end) {
    const voices = this.voices;
    source.start(time);
    source.stop(end);
    voices.add(source);
    source.onended = () => voices.delete(source);
  }

  // 치고 사라지는 소리(뜯는 소리, 종소리)용 엔벨로프
  strike(time, peak, decay, attack = 0.004) {
    const gain = this.ctx.createGain(), g = gain.gain;
    g.setValueAtTime(0, time);
    g.linearRampToValueAtTime(peak, time + attack);
    g.exponentialRampToValueAtTime(0.0005, time + attack + decay);
    return { gain, end: time + attack + decay + 0.02 };
  }

  envelope(time, dur, peak, { attack = 0.01, decay = 0.1, sustain = 0.7, release = 0.08 } = {}) {
    const gain = this.ctx.createGain(), g = gain.gain;
    g.setValueAtTime(0, time);
    g.linearRampToValueAtTime(peak, time + attack);
    g.setTargetAtTime(peak * sustain, time + attack, decay / 3);
    const off = time + Math.max(dur, attack + 0.01);
    g.setValueAtTime(peak * sustain, off);
    g.setTargetAtTime(0, off, release / 3);
    return { gain, end: off + release + 0.05 };
  }

  osc(type, frequency, time, end, out, detune = 0) {
    const osc = this.ctx.createOscillator();
    if (typeof type === 'string') osc.type = type; else osc.setPeriodicWave(type);
    osc.frequency.setValueAtTime(frequency, time);
    osc.detune.value = detune;
    osc.connect(out);
    this.track(osc, time, end);
    return osc;
  }

  noiseHit(time, dur, out) {
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    source.connect(out);
    this.voices.add(source);
    const voices = this.voices;
    source.onended = () => voices.delete(source);
    source.start(time, Math.random() * 1.5);
    source.stop(time + dur);
    return source;
  }

  send(node, reverb = 0, delay = 0) {
    node.connect(this.bus);
    const amount = (target, value) => this.sharedNode(`${target === this.reverbSend ? 'r' : 'd'}${value}`, () => {
      const g = this.ctx.createGain(); g.gain.value = value; g.connect(target); return g;
    });
    if (reverb) node.connect(amount(this.reverbSend, reverb));
    if (delay) node.connect(amount(this.delaySend, delay));
  }

  // 드럼용 같이 쓰는 필터: 엔벨로프를 지난 소리가 이 필터 하나로 모인다
  drumFilter(key, type, frequency, q, reverb = 0) {
    return this.sharedNode(`f${key}`, () => { const f = this.filter(type, frequency, q); this.send(f, reverb); return f; });
  }

  filter(type, frequency, q = 0.7) {
    const filter = this.ctx.createBiquadFilter();
    filter.type = type; filter.frequency.value = frequency; filter.Q.value = q;
    return filter;
  }

  voice(event, time, dur) {
    const ctx = this.ctx, v = event.vel;
    switch (event.inst) {
      case 'vox': {
        // 가이드 멜로디: 부드러운 사각파 + 삼각파, 길게 끌면 비브라토
        const f = freq(event.midi);
        const { gain, end } = this.envelope(time, dur * 0.92, 0.36 * v, { attack: 0.02, decay: 0.2, sustain: 0.75, release: 0.1 });
        const lp = this.filter('lowpass', 3000);
        lp.connect(gain);
        const a = this.osc(this.pulse40, f, time, end, lp);
        const b = this.osc('triangle', f, time, end, lp, 4);
        if (dur > 0.3) {
          const lfo = ctx.createOscillator(), depth = ctx.createGain();
          lfo.frequency.value = 5.6;
          depth.gain.setValueAtTime(0, time);
          depth.gain.linearRampToValueAtTime(f * 0.012, time + Math.min(dur, 0.6));
          lfo.connect(depth); depth.connect(a.frequency); depth.connect(b.frequency);
          this.track(lfo, time, end);
        }
        this.send(gain, 0.28, 0.16);
        break;
      }
      case 'harm': {
        const { gain, end } = this.envelope(time, dur * 0.92, 0.12 * v, { attack: 0.03, decay: 0.2, sustain: 0.8, release: 0.12 });
        this.osc('triangle', freq(event.midi), time, end, gain);
        this.osc(this.pulse25, freq(event.midi), time, end, gain, -6);
        this.send(gain, 0.35, 0.1);
        break;
      }
      case 'lead': {
        const f = freq(event.midi);
        const { gain, end } = this.envelope(time, dur * 0.9, 0.16 * v, { attack: 0.008, decay: 0.15, sustain: 0.6, release: 0.12 });
        const lp = this.filter('lowpass', 4200);
        lp.connect(gain);
        this.osc('sawtooth', f, time, end, lp, -7);
        this.osc(this.pulse25, f, time, end, lp, 7);
        this.send(gain, 0.25, 0.3);
        break;
      }
      case 'bass': {
        const f = freq(event.midi);
        const { gain, end } = this.envelope(time, dur, 0.15 * v, { attack: 0.004, decay: 0.15, sustain: 0.75, release: 0.05 });
        const lp = this.filter('lowpass', 900, 3);
        lp.frequency.setValueAtTime(1600, time);
        lp.frequency.exponentialRampToValueAtTime(420, time + 0.18);
        lp.connect(gain);
        this.osc('sawtooth', f, time, end, lp);
        this.osc('sine', f, time, end, gain);
        this.send(gain);
        break;
      }
      case 'pad': {
        const bright = event.vel > 0.8;
        const { gain, end } = this.envelope(time, dur, 0.06 * v, { attack: 0.35, decay: 0.6, sustain: 0.85, release: 0.6 });
        const lp = this.filter('lowpass', bright ? 2400 : 1400);
        lp.connect(gain);
        for (const midi of event.notes) {
          this.osc('sawtooth', freq(midi), time, end, lp, -9);
          this.osc('sawtooth', freq(midi), time, end, lp, 9);
        }
        this.send(gain, 0.5);
        break;
      }
      case 'pluck': {
        const { gain, end } = this.strike(time, 0.3 * v, 0.3);
        const lp = this.filter('lowpass', 900);
        lp.frequency.setValueAtTime(3800, time);
        lp.frequency.exponentialRampToValueAtTime(700, time + 0.16);
        lp.connect(gain);
        for (const midi of event.notes) this.osc(this.pulse25, freq(midi), time, end, lp);
        this.send(gain, 0.2, 0.16);
        break;
      }
      case 'arp': {
        const { gain, end } = this.strike(time, 0.09 * v, 0.28, 0.003);
        this.osc(this.pulse12, freq(event.midi), time, end, gain);
        this.send(gain, 0.2, 0.35);
        break;
      }
      case 'bell': {
        const f = freq(event.midi);
        const { gain, end } = this.strike(time, 0.12 * v, 1.6);
        this.osc('sine', f, time, end, gain);
        const overtone = ctx.createGain(); overtone.gain.value = 0.25; overtone.connect(gain);
        this.osc('sine', f * 3.01, time, end, overtone);
        this.send(gain, 0.55, 0.2);
        break;
      }
      case 'kick': {
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.55 * v, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.38);
        const osc = this.osc('sine', 150, time, time + 0.4, gain);
        osc.frequency.exponentialRampToValueAtTime(42, time + 0.13);
        const click = ctx.createGain(); click.gain.setValueAtTime(0.25 * v, time); click.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
        click.connect(this.drumFilter('click', 'highpass', 2000));
        this.noiseHit(time, 0.03, click);
        this.send(gain);
        break;
      }
      case 'snare': {
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.24 * v, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
        gain.connect(this.drumFilter('snare', 'highpass', 1500, 0.7, 0.15));
        this.noiseHit(time, 0.22, gain);
        const body = ctx.createGain(); body.gain.setValueAtTime(0.072 * v, time); body.gain.exponentialRampToValueAtTime(0.0003, time + 0.1);
        this.osc('triangle', 190, time, time + 0.12, body);
        this.send(body, 0.15);
        break;
      }
      case 'clap': {
        const gain = ctx.createGain();
        [0, 0.012, 0.024].forEach((offset) => { gain.gain.setValueAtTime(0.2 * v, time + offset); gain.gain.exponentialRampToValueAtTime(0.05 * v, time + offset + 0.01); });
        gain.gain.setValueAtTime(0.16 * v, time + 0.036);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
        gain.connect(this.drumFilter('clap', 'bandpass', 1300, 1.2, 0.25));
        this.noiseHit(time, 0.25, gain);
        break;
      }
      case 'hat':
      case 'ohat': {
        const open = event.inst === 'ohat', length = open ? 0.28 : 0.05;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.16 * v, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + length);
        gain.connect(this.drumFilter(event.inst, 'highpass', 7500, 0.7, open ? 0.1 : 0));
        this.noiseHit(time, length + 0.02, gain);
        break;
      }
      case 'crash': {
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.2 * v, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
        gain.connect(this.drumFilter('crash', 'highpass', 4200, 0.7, 0.3));
        this.noiseHit(time, dur, gain);
        break;
      }
      case 'tom': {
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.5 * v, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
        const pitch = 120 + (1 - v) * 180;
        const osc = this.osc('sine', pitch * 1.6, time, time + 0.32, gain);
        osc.frequency.exponentialRampToValueAtTime(pitch, time + 0.12);
        this.send(gain, 0.2);
        break;
      }
      case 'riser': {
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(0.13 * v, time + dur * 0.97);
        gain.gain.linearRampToValueAtTime(0, time + dur);
        const bp = this.filter('bandpass', 400, 2.5);
        bp.frequency.setValueAtTime(400, time);
        bp.frequency.exponentialRampToValueAtTime(7000, time + dur);
        bp.connect(gain);
        const source = ctx.createBufferSource();
        source.buffer = this.noise; source.loop = true; source.connect(bp);
        this.track(source, time, time + dur);
        this.send(gain, 0.3);
        break;
      }
      default:
        break;
    }
  }
}
