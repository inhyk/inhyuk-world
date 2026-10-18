// 무대 뒤 밤하늘. 작은 해상도로 그린 뒤 늘려서 픽셀 그림처럼 보이게 한다.
// 별, 행성, 별똥별, 언덕, 박자에 맞춰 통통 튀는 젤리 둘, 날아오르는 음표, 바닥의 이퀄라이저.

const PIXEL = 3;

const PALETTES = {
  intro: { top: '#140d3a', bottom: '#3b1d6e', glow: '#ff7ac6', hill: '#1b1046', hill2: '#26145a' },
  verse: { top: '#0b1340', bottom: '#243c7a', glow: '#3ee8ff', hill: '#0e1b4a', hill2: '#15275e' },
  pre: { top: '#170d45', bottom: '#552886', glow: '#b07cff', hill: '#1c0f4c', hill2: '#2a1666' },
  chorus: { top: '#2a0b3f', bottom: '#b8336f', glow: '#ff4fa3', hill: '#2a0d42', hill2: '#45155a' },
  interlude: { top: '#1d0f48', bottom: '#6a2c88', glow: '#ffd84d', hill: '#200f4a', hill2: '#321862' },
  bridge: { top: '#06182a', bottom: '#165262', glow: '#7dffd1', hill: '#06202e', hill2: '#0b3040' },
  final: { top: '#2e0e2d', bottom: '#e0703c', glow: '#ffd84d', hill: '#30102c', hill2: '#4e1c38' },
  outro: { top: '#1a0c38', bottom: '#7a2c72', glow: '#ff4fa3', hill: '#1d0e3e', hill2: '#2e1450' },
};

const NOTE_SPRITE = ['..##.', '..#.#', '..#..', '..#..', '.##..', '###..', '.#...'];
const ENERGY = { intro: 0.45, verse: 0.55, pre: 0.75, chorus: 1, interlude: 0.9, bridge: 0.35, final: 1.2, outro: 0.85 };

const hex = (color) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t);
const rgb = (c, alpha = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha})`;

function seeded(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

export class Sky {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    const random = seeded(7);
    this.stars = Array.from({ length: 140 }, () => ({ x: random(), y: random() * 0.62, speed: 0.6 + random() * 2.4, phase: random() * 6.28, big: random() < 0.12 }));
    this.notes = [];
    this.shooting = null;
    this.kickPulse = 0;
    this.flash = 0;
    this.colors = Object.fromEntries(Object.entries(PALETTES.intro).map(([k, v]) => [k, hex(v)]));
    this.energy = 0.45;
    this.lastTime = performance.now();
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  resize() {
    const width = Math.max(120, Math.round(this.canvas.clientWidth / PIXEL));
    const height = Math.max(80, Math.round(this.canvas.clientHeight / PIXEL));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  kick(vel) { this.kickPulse = Math.max(this.kickPulse, vel); }
  crash() { this.flash = 1; }

  spawnNote(side) {
    const w = this.canvas.width, h = this.canvas.height;
    const x = side === 0 ? w * 0.14 : w * 0.86;
    const color = side === 0 ? '#ff4fa3' : '#3ee8ff';
    this.notes.push({ x: x + (Math.random() - 0.5) * 10, y: h * 0.5, vy: -(14 + Math.random() * 10), drift: Math.random() * 6.28, life: 0, color });
    if (this.notes.length > 40) this.notes.shift();
  }

  draw({ beat, style, spectrum, playing }) {
    const now = performance.now(), dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height, t = now / 1000;
    const target = PALETTES[style] ?? PALETTES.intro;
    const ease = 1 - Math.exp(-dt * 1.6);
    for (const key of Object.keys(this.colors)) this.colors[key] = mix(this.colors[key], hex(target[key]), ease);
    this.energy += ((ENERGY[style] ?? 0.5) - this.energy) * ease;
    this.kickPulse *= Math.exp(-dt * 7);
    this.flash *= Math.exp(-dt * 3);
    const c = this.colors, energy = playing ? this.energy : 0.3;

    // 하늘
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, rgb(c.top));
    sky.addColorStop(0.75, rgb(c.bottom));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    if (this.flash > 0.02) { ctx.fillStyle = rgb([255, 255, 255], this.flash * 0.18); ctx.fillRect(0, 0, w, h); }

    // 별
    for (const star of this.stars) {
      const twinkle = 0.45 + 0.55 * Math.sin(t * star.speed + star.phase);
      const alpha = Math.min(1, 0.25 + twinkle * 0.6 + this.kickPulse * 0.35 * energy);
      ctx.fillStyle = rgb([255, 250, 235], alpha);
      const x = Math.round(star.x * w), y = Math.round(star.y * h);
      ctx.fillRect(x, y, 1, 1);
      if (star.big && twinkle > 0.7) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
    }

    // 고리 행성: 고리 뒤쪽 → 행성 → 고리 앞쪽 순서로 그린다
    const px = Math.round(w * 0.7), py = Math.round(h * 0.2), r = Math.max(6, Math.round(h * 0.06));
    const ring = (front) => {
      ctx.fillStyle = rgb(mix(c.glow, [255, 255, 255], 0.35), front ? 0.95 : 0.55);
      for (let a = 0; a < Math.PI * 2; a += 0.02) {
        const s = Math.sin(a);
        if ((s > 0) !== front) continue;
        ctx.fillRect(Math.round(px + Math.cos(a) * r * 1.9), Math.round(py + s * r * 0.42 - Math.cos(a) * r * 0.25), 1, 1);
      }
    };
    ring(false);
    for (let y = -r; y <= r; y++) {
      const span = Math.round(Math.sqrt(r * r - y * y));
      ctx.fillStyle = y < -r * 0.3 ? '#ffe9a8' : y < r * 0.4 ? '#ffc96b' : '#e09a4a';
      ctx.fillRect(px - span, py + y, span * 2 + 1, 1);
    }
    ring(true);

    // 별똥별
    if (playing && !this.shooting && Math.random() < dt * 0.25 * energy) this.shooting = { x: Math.random() * w * 0.6, y: Math.random() * h * 0.25, life: 0 };
    if (this.shooting) {
      const s = this.shooting;
      s.life += dt;
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = rgb([255, 255, 255], (1 - i / 10) * (1 - s.life));
        ctx.fillRect(Math.round(s.x + s.life * 120 - i * 2), Math.round(s.y + s.life * 50 - i * 0.8), 1, 1);
      }
      if (s.life > 1) this.shooting = null;
    }

    // 지평선 빛
    const horizon = Math.round(h * 0.6);
    const glow = ctx.createLinearGradient(0, horizon - h * 0.25, 0, horizon);
    glow.addColorStop(0, rgb(c.glow, 0));
    glow.addColorStop(1, rgb(c.glow, 0.12 + this.kickPulse * 0.22 * energy));
    ctx.fillStyle = glow;
    ctx.fillRect(0, horizon - h * 0.25, w, h * 0.25);

    // 언덕 두 겹 (천천히 흘러간다)
    const scroll = t * 4;
    for (const [layer, color, base, amp] of [[0, c.hill2, 0.58, 0.05], [1, c.hill, 0.64, 0.035]]) {
      ctx.fillStyle = rgb(color);
      for (let x = 0; x < w; x++) {
        const k = (x + scroll * (layer ? 1.6 : 0.8)) / w;
        const y = Math.round(h * (base - amp * (Math.sin(k * 9 + layer) * 0.6 + Math.sin(k * 23 + layer * 3) * 0.4)));
        ctx.fillRect(x, y, 1, h - y);
      }
    }

    // 젤리 친구들
    const ground = Math.round(h * 0.62);
    this.jelly(Math.round(w * 0.14), ground, beat, energy, playing, '#ff4fa3', '#ffb3d6', 0);
    this.jelly(Math.round(w * 0.86), ground, beat + 0.5, energy, playing, '#3ee8ff', '#b8f6ff', 1);

    // 음표
    for (const note of this.notes) {
      note.life += dt;
      note.y += note.vy * dt;
      const x = Math.round(note.x + Math.sin(note.life * 4 + note.drift) * 4), y = Math.round(note.y);
      const alpha = Math.max(0, 1 - note.life / 1.8);
      ctx.fillStyle = note.color;
      ctx.globalAlpha = alpha;
      NOTE_SPRITE.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') ctx.fillRect(x + rx, y + ry, 1, 1); });
      ctx.globalAlpha = 1;
    }
    this.notes = this.notes.filter((note) => note.life < 1.8);

    // 이퀄라이저
    if (spectrum) {
      const bars = Math.min(64, Math.floor(w / 4)), bw = w / bars;
      for (let i = 0; i < bars; i++) {
        const bin = Math.floor(2 + (i / bars) ** 1.6 * (spectrum.length * 0.7));
        const value = spectrum[bin] / 255;
        const height = Math.round(value * h * 0.22);
        for (let y = 0; y < height; y += 2) {
          ctx.fillStyle = rgb(mix(c.glow, [255, 255, 255], y / (h * 0.22)), 0.16 + 0.22 * (y / (h * 0.22)));
          ctx.fillRect(Math.round(i * bw), h - y - 1, Math.max(1, Math.round(bw) - 1), 1);
        }
      }
    }
  }

  jelly(cx, ground, beat, energy, playing, body, shine, side) {
    const ctx = this.ctx;
    const phase = playing ? ((beat % 1) + 1) % 1 : 0.5;
    const hop = playing ? Math.sin(Math.PI * phase) * (3 + energy * 7) : Math.sin(performance.now() / 600 + side) * 1.5 + 1.5;
    const squash = playing ? Math.max(0, 1 - phase * 5) * 0.28 * energy : 0;
    const width = Math.round(20 * (1 + squash)), height = Math.round(16 * (1 - squash));
    const top = Math.round(ground - hop - height);
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(cx - Math.round(width / 2 - hop * 0.3), ground, width - Math.round(hop * 0.6), 2);
    // 몸통: 위가 둥근 반달
    ctx.fillStyle = body;
    for (let y = 0; y < height; y++) {
      const k = y / height;
      const half = Math.round((width / 2) * (k < 0.55 ? Math.sqrt(1 - ((0.55 - k) / 0.55) ** 2) : 1));
      ctx.fillRect(cx - half, top + y, half * 2, 1);
    }
    ctx.fillStyle = shine;
    ctx.fillRect(cx - Math.round(width * 0.28), top + 3, 3, 2);
    ctx.fillRect(cx - Math.round(width * 0.28) - 1, top + 5, 1, 2);
    // 눈과 볼
    const eyeY = top + Math.round(height * 0.45);
    const blink = playing ? 2 : (Math.floor(performance.now() / 180) % 22 === 0 ? 1 : 2);
    ctx.fillStyle = '#1a1145';
    ctx.fillRect(cx - 5, eyeY, 2, blink);
    ctx.fillRect(cx + 3, eyeY, 2, blink);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(cx - 8, eyeY + 3, 2, 1);
    ctx.fillRect(cx + 6, eyeY + 3, 2, 1);
    // 노래하는 입
    ctx.fillStyle = '#1a1145';
    const open = playing ? 1 + Math.round(Math.abs(Math.sin(Math.PI * phase * 2)) * 1.5) : 1;
    ctx.fillRect(cx - 1, eyeY + 3, 2, open);
  }
}
