import { UPGRADES } from './core.mjs';
// Less plastic rattle, a rounder body, and richer overtones at each upgrade.
const ORIGINAL_SOUNDS = [
  { label: '가벼운 플라스틱 딸깍', noise: .27, cutoff: 4200, body: 310, depth: .10, decay: .055, warmth: 0, bell: 0 },
  { label: '깔끔한 밀크 톡', noise: .21, cutoff: 3500, body: 275, depth: .13, decay: .065, warmth: .01, bell: 0 },
  { label: '말랑한 피치 도각', noise: .17, cutoff: 3000, body: 245, depth: .16, decay: .075, warmth: .02, bell: 0 },
  { label: '산뜻한 민트 코톡', noise: .14, cutoff: 2600, body: 220, depth: .18, decay: .085, warmth: .03, bell: 0 },
  { label: '부드러운 스카이 토독', noise: .11, cutoff: 2200, body: 198, depth: .20, decay: .095, warmth: .04, bell: 0 },
  { label: '포근한 라벤더 도독', noise: .085, cutoff: 1900, body: 180, depth: .21, decay: .105, warmth: .05, bell: 0 },
  { label: '묵직한 체리 도각', noise: .065, cutoff: 1650, body: 164, depth: .22, decay: .115, warmth: .06, bell: .008 },
  { label: '깊고 정갈한 미드나잇 톡', noise: .045, cutoff: 1400, body: 148, depth: .23, decay: .125, warmth: .07, bell: .015 },
  { label: '은은하게 울리는 오로라 톡', noise: .032, cutoff: 1200, body: 135, depth: .24, decay: .14, warmth: .08, bell: .027 },
  { label: '맑고 풍성한 골든 도각', noise: .022, cutoff: 1000, body: 124, depth: .25, decay: .16, warmth: .09, bell: .045 },
];
export const SOUND_PROFILES = [
  ...ORIGINAL_SOUNDS,
  ...UPGRADES.slice(9).map((key, index) => {
    const progress = index / 90, family = key.chapter;
    const notes = [1046.5, 1174.66, 1318.51, 1396.91, 1567.98];
    return {
      label: `${key.edition} · ${['백금빛 도각', '달콤하고 포근한 톡', '나무처럼 따뜻한 도독', '물방울처럼 맑은 톡', '크리스털 도각', '청량한 전자 톡', '별빛의 깊은 울림', '마법의 은은한 종소리', '용의 묵직한 도각', '천상의 반짝이는 울림'][family]}`,
      noise: .018 - progress * .012, cutoff: 1000 - progress * 350,
      body: 122 - progress * 30 + Math.sin(index * .7) * 4,
      depth: .25, decay: .16 + progress * .04, warmth: .09,
      bell: .045 + progress * .015, bellHz: notes[index % notes.length],
      harmony: family >= 4 ? [1.5, 2, 1.25][family % 3] : 1.5,
      ring: .26 + progress * .10,
    };
  }),
];
const buffers = new WeakMap();
function noiseBuffer(ctx) {
  if (!buffers.has(ctx)) {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .055), ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length) ** 3;
    buffers.set(ctx, buffer);
  }
  return buffers.get(ctx);
}
function note(ctx, output, start, hz, endHz, volume, duration, type = 'sine') {
  const oscillator = ctx.createOscillator(), gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(hz, start);
  oscillator.frequency.exponentialRampToValueAtTime(endHz, start + duration * .7);
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + .002);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  oscillator.connect(gain).connect(output);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  oscillator.start(start); oscillator.stop(start + duration + .005);
}
export function playKeySound(ctx, output, level, upgrade = false) {
  const p = SOUND_PROFILES[Math.max(0, Math.min(SOUND_PROFILES.length - 1, level))], t = ctx.currentTime;
  const noise = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
  noise.buffer = noiseBuffer(ctx); filter.type = 'lowpass'; filter.frequency.value = p.cutoff; filter.Q.value = .5; gain.gain.value = p.noise;
  noise.connect(filter).connect(gain).connect(output);
  noise.onended = () => { noise.disconnect(); filter.disconnect(); gain.disconnect(); };
  noise.start(t);
  // Bottom-out, warm housing resonance, and a softer key return.
  note(ctx, output, t, p.body, p.body * .53, p.depth, p.decay, level < 2 ? 'triangle' : 'sine');
  if (p.warmth) note(ctx, output, t + .004, p.body * 1.5, p.body * 1.3, p.warmth, p.decay * .8);
  note(ctx, output, t + .037, p.body * 2.2, p.body * 1.4, .035, .027);
  if (p.bell) {
    note(ctx, output, t + .008, p.bellHz ?? 1046.5, p.bellHz ?? 1046.5, p.bell, p.ring ?? (.20 + level * .012));
    if (level >= 9) { const hz = (p.bellHz ?? 1046.5) * (p.harmony ?? 1.5); note(ctx, output, t + .012, hz, hz, p.bell * .42, p.ring ?? .26); }
  }
  if (upgrade) [523.25, 659.25, 783.99, 1046.5].forEach((hz, i) => note(ctx, output, t + .08 + i * .085, hz, hz, .06, .28));
}

export function playRewardSound(ctx, output, kind, combo = 0) {
  const t = ctx.currentTime;
  const notes = kind === 'super' ? [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98]
    : kind === 'boss' ? [196, 293.66, 392, 587.33, 783.99]
    : kind === 'fever' ? [392, 523.25, 659.25, 783.99, 1046.5]
    : kind === 'coin' ? [1318.51, 1567.98, 2093]
    : kind === 'critical' ? [783.99, 1174.66]
    : [523.25 * 2 ** (Math.min(6, Math.floor(combo / 10)) / 12)];
  notes.forEach((hz, i) => note(ctx, output, t + i * .045, hz, hz, .065, .16));
}
