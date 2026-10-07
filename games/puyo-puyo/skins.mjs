// 뿌요 그리기. 스킨마다 몸통(body)과 얼굴(face)을 따로 그려서 캐시해 두고,
// 같은 색끼리 붙으면 몸통 사이에 다리(bridge)를 그려 말랑하게 이어 보이게 한다.

export const PALETTE = {
  1: { base: '#ff4f64', light: '#ffb8c1', dark: '#c81f3c', deep: '#7d0b22', glow: '#ff7a8a' },
  2: { base: '#33d16a', light: '#b5f7c9', dark: '#149245', deep: '#095c2a', glow: '#6dffa0' },
  3: { base: '#3d8bff', light: '#b8d5ff', dark: '#1c55cf', deep: '#0f2f80', glow: '#7ab0ff' },
  4: { base: '#ffcd2e', light: '#fff3ad', dark: '#d99a06', deep: '#8a5d00', glow: '#ffe066' },
  5: { base: '#b35cff', light: '#e5c6ff', dark: '#7c2fd6', deep: '#4a1488', glow: '#d39bff' },
  6: { base: '#d3dbec', light: '#ffffff', dark: '#8e9ab6', deep: '#566079', glow: '#ffffff' },
};
export const SYMBOLS = { 1: 'heart', 2: 'diamond', 3: 'circle', 4: 'star', 5: 'triangle' };

// 스킨별 성질: connect = 같은 색끼리 이어 그리기
export const SKIN_STYLE = {
  classic: { connect: true }, symbol: { connect: true }, jelly: { connect: true }, candy: { connect: true },
  cat: { connect: true }, fruit: { connect: false }, gem: { connect: false }, pixel: { connect: false },
  planet: { connect: false }, neon: { connect: true }, ghost: { connect: false }, crown: { connect: true },
};

const TAU = Math.PI * 2;

function ellipse(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); }

// 기본 몸통: 동그란 젤리
function roundBody(ctx, pal, r, alpha = 1) {
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.08, 0, 0, r * 1.05);
  g.addColorStop(0, pal.light);
  g.addColorStop(0.45, pal.base);
  g.addColorStop(1, pal.dark);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ellipse(ctx, 0, 0, r, r * 0.97);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = Math.max(1, r * 0.07);
  ctx.strokeStyle = pal.deep;
  ctx.stroke();
}

function shine(ctx, r, alpha = 0.8) {
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ellipse(ctx, -r * 0.38, -r * 0.48, r * 0.3, r * 0.17, -0.55);
  ctx.fill();
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.8})`;
  ellipse(ctx, -r * 0.62, -r * 0.18, r * 0.07, r * 0.07);
  ctx.fill();
}

// 눈: variant 0=보통, 1=깜빡, 2=놀람(터질 때)
function eyes(ctx, r, variant, opt = {}) {
  const ex = r * (opt.spread ?? 0.31), ey = r * (opt.y ?? -0.02), size = opt.size ?? 1;
  const dark = opt.dark || '#1b1330';
  if (variant === 1) {
    ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1, r * 0.1); ctx.lineCap = 'round';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * ex, ey, r * 0.15 * size, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
    return;
  }
  if (variant === 2) {
    ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1, r * 0.1); ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * ex - s * r * 0.13, ey - r * 0.13); ctx.lineTo(s * ex + s * r * 0.08, ey); ctx.lineTo(s * ex - s * r * 0.13, ey + r * 0.13);
      ctx.stroke();
    }
    return;
  }
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#ffffff';
    ellipse(ctx, s * ex, ey, r * 0.2 * size, r * 0.26 * size);
    ctx.fill();
    ctx.lineWidth = Math.max(0.8, r * 0.035); ctx.strokeStyle = 'rgba(40,20,60,.45)'; ctx.stroke();
    ctx.fillStyle = dark;
    ellipse(ctx, s * ex + s * r * 0.03, ey + r * 0.06, r * 0.11 * size, r * 0.15 * size);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ellipse(ctx, s * ex - r * 0.02, ey - r * 0.02, r * 0.04 * size, r * 0.05 * size);
    ctx.fill();
  }
}

function garbageLook(ctx, r, layer, variant) {
  const pal = PALETTE[6];
  if (layer === 'body') {
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.05);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, pal.base); g.addColorStop(1, pal.dark);
    ctx.fillStyle = g; ctx.globalAlpha = 0.93;
    ellipse(ctx, 0, 0, r, r * 0.97); ctx.fill(); ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(1, r * 0.07); ctx.strokeStyle = pal.deep; ctx.stroke();
    return;
  }
  shine(ctx, r, 0.7);
  ctx.fillStyle = '#39405a';
  if (variant === 1) {
    ctx.fillRect(-r * 0.42, -r * 0.05, r * 0.24, r * 0.07); ctx.fillRect(r * 0.18, -r * 0.05, r * 0.24, r * 0.07);
  } else {
    ellipse(ctx, -r * 0.3, -r * 0.04, r * 0.09, r * 0.13); ctx.fill();
    ellipse(ctx, r * 0.3, -r * 0.04, r * 0.09, r * 0.13); ctx.fill();
  }
  ctx.strokeStyle = '#39405a'; ctx.lineWidth = Math.max(1, r * 0.06); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-r * 0.14, r * 0.32); ctx.lineTo(r * 0.14, r * 0.32); ctx.stroke();
}

function symbolPath(ctx, kind, s) {
  ctx.beginPath();
  if (kind === 'heart') {
    ctx.moveTo(0, s * 0.75);
    ctx.bezierCurveTo(-s * 1.2, -s * 0.05, -s * 0.55, -s * 0.95, 0, -s * 0.35);
    ctx.bezierCurveTo(s * 0.55, -s * 0.95, s * 1.2, -s * 0.05, 0, s * 0.75);
  } else if (kind === 'diamond') {
    ctx.moveTo(0, -s * 0.85); ctx.lineTo(s * 0.62, 0); ctx.lineTo(0, s * 0.85); ctx.lineTo(-s * 0.62, 0); ctx.closePath();
  } else if (kind === 'circle') {
    ctx.arc(0, 0, s * 0.62, 0, TAU);
  } else if (kind === 'star') {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? s * 0.36 : s * 0.85;
      if (i) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
  } else {
    ctx.moveTo(0, -s * 0.78); ctx.lineTo(s * 0.75, s * 0.58); ctx.lineTo(-s * 0.75, s * 0.58); ctx.closePath();
  }
}

// ---------- 스킨들 ----------
const SKINS = {
  classic(ctx, c, r, layer, v) {
    if (layer === 'body') return roundBody(ctx, PALETTE[c], r);
    shine(ctx, r); eyes(ctx, r, v);
  },
  symbol(ctx, c, r, layer, v) {
    if (layer === 'body') return roundBody(ctx, PALETTE[c], r);
    shine(ctx, r, 0.55);
    ctx.save();
    ctx.translate(0, r * 0.04);
    symbolPath(ctx, SYMBOLS[c], r * 0.62);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.09); ctx.strokeStyle = PALETTE[c].deep; ctx.stroke();
    ctx.restore();
    if (v === 1) { ctx.fillStyle = PALETTE[c].deep; ctx.fillRect(-r * 0.2, r * 0.02, r * 0.4, r * 0.08); }
  },
  jelly(ctx, c, r, layer, v) {
    const pal = PALETTE[c];
    if (layer === 'body') {
      const g = ctx.createRadialGradient(0, r * 0.1, r * 0.1, 0, 0, r * 1.05);
      g.addColorStop(0, pal.light); g.addColorStop(0.6, pal.base); g.addColorStop(1, pal.dark);
      ctx.globalAlpha = 0.78; ctx.fillStyle = g;
      ellipse(ctx, 0, 0, r, r * 0.95); ctx.fill(); ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(1.2, r * 0.1); ctx.strokeStyle = pal.light; ctx.stroke();
      return;
    }
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    for (const [x, y, s] of [[r * 0.35, r * 0.4, 0.09], [r * 0.5, r * 0.15, 0.06], [-r * 0.45, r * 0.45, 0.07]]) { ellipse(ctx, x, y, r * s, r * s); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ellipse(ctx, -r * 0.35, -r * 0.5, r * 0.34, r * 0.14, -0.4); ctx.fill();
    eyes(ctx, r, v, { size: 0.8, y: 0.02, dark: pal.deep });
  },
  candy(ctx, c, r, layer, v) {
    const pal = PALETTE[c];
    if (layer === 'body') {
      ctx.save();
      ellipse(ctx, 0, 0, r, r * 0.97); ctx.clip();
      ctx.fillStyle = pal.base; ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.fillStyle = pal.light;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath(); ctx.moveTo(0, 0);
        const a = i * TAU / 6;
        for (let k = 0; k <= 12; k++) { const t = k / 12, rr = r * 1.1 * t, aa = a + t * 1.6; ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); }
        for (let k = 12; k >= 0; k--) { const t = k / 12, rr = r * 1.1 * t, aa = a + 0.45 + t * 1.6; ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); }
        ctx.fill();
      }
      ctx.restore();
      ctx.lineWidth = Math.max(1, r * 0.08); ctx.strokeStyle = pal.dark; ellipse(ctx, 0, 0, r, r * 0.97); ctx.stroke();
      return;
    }
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ellipse(ctx, -r * 0.36, -r * 0.5, r * 0.3, r * 0.13, -0.5); ctx.fill();
    ctx.fillStyle = '#fff'; ellipse(ctx, 0, 0, r * 0.52, r * 0.36); ctx.globalAlpha = 0.75; ctx.fill(); ctx.globalAlpha = 1;
    eyes(ctx, r, v, { size: 0.72, spread: 0.24, dark: pal.deep });
  },
  cat(ctx, c, r, layer, v) {
    const pal = PALETTE[c];
    if (layer === 'body') {
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(s * r * 0.82, -r * 0.2); ctx.lineTo(s * r * 0.72, -r * 1.12); ctx.lineTo(s * r * 0.2, -r * 0.78); ctx.closePath();
        ctx.fillStyle = pal.base; ctx.fill(); ctx.lineWidth = Math.max(1, r * 0.07); ctx.strokeStyle = pal.deep; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * r * 0.66, -r * 0.4); ctx.lineTo(s * r * 0.64, -r * 0.9); ctx.lineTo(s * r * 0.34, -r * 0.7); ctx.closePath();
        ctx.fillStyle = '#ffc1d3'; ctx.fill();
      }
      return roundBody(ctx, pal, r);
    }
    shine(ctx, r, 0.6);
    ctx.strokeStyle = '#2a1830'; ctx.lineWidth = Math.max(1, r * 0.09); ctx.lineCap = 'round';
    if (v === 0) {
      for (const s of [-1, 1]) { ctx.fillStyle = '#2a1830'; ellipse(ctx, s * r * 0.3, -r * 0.04, r * 0.09, r * 0.17); ctx.fill(); ctx.fillStyle = '#fff'; ellipse(ctx, s * r * 0.28, -r * 0.1, r * 0.035, r * 0.05); ctx.fill(); }
    } else {
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * r * 0.3, 0, r * 0.13, 1.1 * Math.PI, 1.9 * Math.PI); ctx.stroke(); }
    }
    ctx.fillStyle = '#ff7aa2'; ellipse(ctx, 0, r * 0.17, r * 0.07, r * 0.05); ctx.fill();
    ctx.lineWidth = Math.max(0.8, r * 0.06);
    ctx.beginPath(); ctx.arc(-r * 0.1, r * 0.25, r * 0.1, 0.1 * Math.PI, 0.9 * Math.PI); ctx.arc(r * 0.1, r * 0.25, r * 0.1, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    ctx.lineWidth = Math.max(0.6, r * 0.035); ctx.strokeStyle = 'rgba(40,20,50,.6)';
    for (const s of [-1, 1]) for (const d of [-0.08, 0.08]) { ctx.beginPath(); ctx.moveTo(s * r * 0.45, r * 0.2 + d * r); ctx.lineTo(s * r * 0.95, r * 0.12 + d * r * 2.2); ctx.stroke(); }
  },
  fruit(ctx, c, r, layer, v) {
    const pal = PALETTE[c];
    if (layer === 'body') {
      ctx.lineWidth = Math.max(1, r * 0.07); ctx.strokeStyle = pal.deep;
      if (c === 1) { // 딸기
        const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 1.1);
        g.addColorStop(0, '#ff9aa6'); g.addColorStop(0.5, '#ff3553'); g.addColorStop(1, '#b3102b');
        ctx.fillStyle = g; ctx.beginPath();
        ctx.moveTo(0, r * 0.98); ctx.bezierCurveTo(-r * 1.05, r * 0.35, -r * 1.05, -r * 0.8, 0, -r * 0.72); ctx.bezierCurveTo(r * 1.05, -r * 0.8, r * 1.05, r * 0.35, 0, r * 0.98);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffe66b';
        for (const [x, y] of [[-0.45, -0.15], [0, -0.3], [0.45, -0.15], [-0.25, 0.2], [0.25, 0.2], [0, 0.55], [-0.55, 0.25], [0.55, 0.25]]) { ellipse(ctx, x * r, y * r, r * 0.05, r * 0.08); ctx.fill(); }
        ctx.fillStyle = '#2fb65b';
        for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.55; ctx.beginPath(); ctx.ellipse(Math.cos(a) * r * 0.28, -r * 0.72 + Math.sin(a) * r * 0.12, r * 0.28, r * 0.1, a, 0, TAU); ctx.fill(); }
      } else if (c === 2) { // 청사과
        const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 1.1);
        g.addColorStop(0, '#d9ffb0'); g.addColorStop(0.5, '#7fd94a'); g.addColorStop(1, '#3f8f1f');
        ctx.fillStyle = g; ctx.beginPath();
        ctx.moveTo(0, -r * 0.62); ctx.bezierCurveTo(r * 0.5, -r * 1.05, r * 1.15, -r * 0.5, r * 0.95, r * 0.25);
        ctx.bezierCurveTo(r * 0.8, r * 0.95, r * 0.25, r * 1.05, 0, r * 0.88); ctx.bezierCurveTo(-r * 0.25, r * 1.05, -r * 0.8, r * 0.95, -r * 0.95, r * 0.25);
        ctx.bezierCurveTo(-r * 1.15, -r * 0.5, -r * 0.5, -r * 1.05, 0, -r * 0.62); ctx.fill(); ctx.strokeStyle = '#2f6b16'; ctx.stroke();
        ctx.strokeStyle = '#7a4a1e'; ctx.lineWidth = Math.max(1, r * 0.1); ctx.beginPath(); ctx.moveTo(0, -r * 0.6); ctx.quadraticCurveTo(r * 0.05, -r * 0.95, r * 0.18, -r * 1.05); ctx.stroke();
        ctx.fillStyle = '#35b04a'; ctx.beginPath(); ctx.ellipse(r * 0.38, -r * 0.92, r * 0.25, r * 0.11, -0.4, 0, TAU); ctx.fill();
      } else if (c === 3) { // 블루베리
        const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.05);
        g.addColorStop(0, '#9fb6ff'); g.addColorStop(0.5, '#3e56c9'); g.addColorStop(1, '#1c2572');
        ctx.fillStyle = g; ellipse(ctx, 0, 0, r * 0.97, r * 0.94); ctx.fill(); ctx.strokeStyle = '#141a55'; ctx.stroke();
        ctx.fillStyle = '#1c2572';
        ctx.beginPath();
        for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, rr = i % 2 ? r * 0.1 : r * 0.24; ctx.lineTo(Math.cos(a) * rr, -r * 0.62 + Math.sin(a) * rr * 0.6); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(210,225,255,.35)'; ellipse(ctx, r * 0.2, r * 0.3, r * 0.5, r * 0.35); ctx.fill();
      } else if (c === 4) { // 레몬
        const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 1.1);
        g.addColorStop(0, '#fffbd0'); g.addColorStop(0.55, '#ffe030'); g.addColorStop(1, '#d4a400');
        ctx.fillStyle = g; ctx.beginPath();
        ctx.moveTo(-r * 1.02, r * 0.02); ctx.quadraticCurveTo(-r * 0.9, -r * 0.82, 0, -r * 0.8); ctx.quadraticCurveTo(r * 0.9, -r * 0.82, r * 1.02, -r * 0.02);
        ctx.quadraticCurveTo(r * 0.9, r * 0.82, 0, r * 0.8); ctx.quadraticCurveTo(-r * 0.9, r * 0.82, -r * 1.02, r * 0.02); ctx.fill(); ctx.strokeStyle = '#a77b00'; ctx.stroke();
        ctx.fillStyle = 'rgba(160,120,0,.25)'; for (const [x, y] of [[0.4, 0.3], [-0.3, 0.4], [0.1, -0.4], [0.55, -0.2]]) { ellipse(ctx, x * r, y * r, r * 0.035, r * 0.035); ctx.fill(); }
      } else if (c === 5) { // 포도
        const berries = [[-0.42, -0.35], [0, -0.42], [0.42, -0.35], [-0.24, 0.05], [0.24, 0.05], [-0.5, 0.22], [0.5, 0.22], [0, 0.45]];
        for (const [x, y] of berries) {
          const g = ctx.createRadialGradient(x * r - r * 0.1, y * r - r * 0.1, r * 0.03, x * r, y * r, r * 0.34);
          g.addColorStop(0, '#e6c2ff'); g.addColorStop(0.5, '#9b3fe0'); g.addColorStop(1, '#5a168f');
          ctx.fillStyle = g; ellipse(ctx, x * r, y * r, r * 0.33, r * 0.33); ctx.fill(); ctx.lineWidth = Math.max(0.8, r * 0.05); ctx.strokeStyle = '#3f0c68'; ctx.stroke();
        }
        ctx.strokeStyle = '#7a4a1e'; ctx.lineWidth = Math.max(1, r * 0.1); ctx.beginPath(); ctx.moveTo(0, -r * 0.7); ctx.lineTo(r * 0.05, -r * 1.0); ctx.stroke();
        ctx.fillStyle = '#35b04a'; ctx.beginPath(); ctx.ellipse(-r * 0.25, -r * 0.88, r * 0.24, r * 0.1, 0.4, 0, TAU); ctx.fill();
      } else return garbageLook(ctx, r, 'body', v);
      return;
    }
    if (c === 6) return garbageLook(ctx, r, 'face', v);
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ellipse(ctx, -r * 0.4, -r * 0.35, r * 0.2, r * 0.1, -0.6); ctx.fill();
    eyes(ctx, r, v, { size: 0.62, spread: 0.24, y: 0.12 });
  },
  gem(ctx, c, r, layer, v) {
    const pal = PALETTE[c];
    if (c === 6) return garbageLook(ctx, r, layer, v);
    if (layer === 'body') {
      const pts = [];
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + Math.PI / 8; pts.push([Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98]); }
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
      ctx.fillStyle = pal.base; ctx.fill();
      const inner = pts.map(([x, y]) => [x * 0.55, y * 0.55]);
      for (let i = 0; i < 8; i++) {
        const j = (i + 1) % 8;
        ctx.beginPath(); ctx.moveTo(...pts[i]); ctx.lineTo(...pts[j]); ctx.lineTo(...inner[j]); ctx.lineTo(...inner[i]); ctx.closePath();
        ctx.fillStyle = i < 3 || i === 7 ? pal.light : i < 5 ? pal.dark : pal.base;
        ctx.globalAlpha = i === 4 ? 1 : 0.85; ctx.fill(); ctx.globalAlpha = 1;
      }
      ctx.beginPath(); inner.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
      const g = ctx.createLinearGradient(-r * 0.5, -r * 0.5, r * 0.5, r * 0.5); g.addColorStop(0, pal.light); g.addColorStop(1, pal.base);
      ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
      ctx.lineWidth = Math.max(1, r * 0.08); ctx.strokeStyle = pal.deep; ctx.stroke();
      return;
    }
    ctx.fillStyle = '#fff';
    const star = (x, y, s) => { ctx.beginPath(); ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s); ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s); ctx.fill(); };
    star(-r * 0.3, -r * 0.35, r * (v === 1 ? 0.12 : 0.24));
    if (v !== 1) star(r * 0.35, r * 0.3, r * 0.1);
  },
  pixel(ctx, c, r, layer, v) {
    const pal = PALETTE[c];
    const map = [
      '..XXXX..',
      '.XLLXXX.',
      'XLLXXXXX',
      'XXWBXWBX',
      'XXWBXWBX',
      'XXXXXXXX',
      'DXXXXXXD',
      '.DDDDDD.',
    ];
    const px = (r * 2) / 8;
    if (layer === 'body') {
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const k = map[y][x];
        if (k === '.') continue;
        ctx.fillStyle = k === 'L' ? pal.light : k === 'D' ? pal.dark : pal.base;
        if (k === 'W' || k === 'B') ctx.fillStyle = pal.base;
        ctx.fillRect(-r + x * px, -r + y * px, px + 0.5, px + 0.5);
      }
      ctx.strokeStyle = pal.deep; ctx.lineWidth = Math.max(1, px * 0.3);
      ctx.strokeRect(-r + px * 0.1, -r + px * 0.1, r * 2 - px * 0.2, r * 2 - px * 0.2);
      return;
    }
    for (let y = 3; y < 5; y++) for (let x = 0; x < 8; x++) {
      const k = map[y][x];
      if (k !== 'W' && k !== 'B') continue;
      if (v === 1) { if (y === 4) { ctx.fillStyle = '#1b1330'; ctx.fillRect(-r + x * px, -r + y * px, px + 0.5, px * 0.5); } continue; }
      ctx.fillStyle = k === 'W' ? '#ffffff' : '#1b1330';
      ctx.fillRect(-r + x * px, -r + y * px, px + 0.5, px + 0.5);
    }
  },
  planet(ctx, c, r, layer, v) {
    const pal = PALETTE[c];
    if (c === 6) return garbageLook(ctx, r, layer, v);
    const ring = c === 4 || c === 5;
    if (layer === 'body') {
      if (ring) { ctx.strokeStyle = pal.light; ctx.lineWidth = Math.max(1.5, r * 0.14); ctx.beginPath(); ctx.ellipse(0, 0, r * 1.18, r * 0.36, -0.35, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke(); }
      ctx.save();
      ellipse(ctx, 0, 0, r * 0.86, r * 0.86); ctx.clip();
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
      g.addColorStop(0, pal.light); g.addColorStop(0.5, pal.base); g.addColorStop(1, pal.deep);
      ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.globalAlpha = 0.35; ctx.fillStyle = pal.deep;
      if (c === 1) { for (const [x, y, s] of [[-0.3, 0.2, 0.18], [0.35, -0.2, 0.12], [0.2, 0.45, 0.1]]) { ellipse(ctx, x * r, y * r, s * r, s * r); ctx.fill(); } }
      else if (c === 2) { ctx.fillStyle = '#1e8fff'; ctx.globalAlpha = 0.45; ellipse(ctx, 0.3 * r, 0.1 * r, 0.4 * r, 0.3 * r); ctx.fill(); ellipse(ctx, -0.45 * r, -0.4 * r, 0.3 * r, 0.2 * r); ctx.fill(); }
      else for (let i = -3; i <= 3; i++) { ctx.fillRect(-r, i * r * 0.26 - r * 0.05, r * 2, r * 0.1); }
      if (c === 5) { ctx.globalAlpha = 0.6; ctx.fillStyle = '#ff9d5c'; ellipse(ctx, r * 0.3, r * 0.3, r * 0.18, r * 0.11); ctx.fill(); }
      ctx.restore();
      ctx.lineWidth = Math.max(1, r * 0.06); ctx.strokeStyle = pal.deep; ellipse(ctx, 0, 0, r * 0.86, r * 0.86); ctx.stroke();
      return;
    }
    if (ring) { ctx.strokeStyle = pal.light; ctx.lineWidth = Math.max(1.5, r * 0.14); ctx.beginPath(); ctx.ellipse(0, 0, r * 1.18, r * 0.36, -0.35, -0.02 * Math.PI, 1.02 * Math.PI); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ellipse(ctx, -r * 0.35, -r * 0.4, r * 0.2, r * 0.1, -0.6); ctx.fill();
    if (v === 1) { ctx.fillStyle = '#fff'; for (const [x, y] of [[-0.8, -0.8], [0.85, 0.7]]) { ellipse(ctx, x * r, y * r, r * 0.06, r * 0.06); ctx.fill(); } }
  },
  neon(ctx, c, r, layer, v) {
    const pal = PALETTE[c];
    if (layer === 'body') {
      ctx.fillStyle = 'rgba(12,8,30,.92)'; ellipse(ctx, 0, 0, r * 0.94, r * 0.92); ctx.fill();
      ctx.shadowColor = pal.glow; ctx.shadowBlur = r * 0.5;
      ctx.lineWidth = Math.max(1.5, r * 0.14); ctx.strokeStyle = pal.glow; ctx.stroke();
      ctx.shadowBlur = 0;
      return;
    }
    ctx.shadowColor = pal.glow; ctx.shadowBlur = r * 0.35;
    ctx.fillStyle = pal.glow; ctx.strokeStyle = pal.glow; ctx.lineWidth = Math.max(1, r * 0.1); ctx.lineCap = 'round';
    if (v === 1) { for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.42, 0); ctx.lineTo(s * r * 0.16, 0); ctx.stroke(); } }
    else { for (const s of [-1, 1]) { ellipse(ctx, s * r * 0.3, -r * 0.02, r * 0.1, r * 0.16); ctx.fill(); } }
    ctx.beginPath(); ctx.arc(0, r * 0.18, r * 0.16, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.shadowBlur = 0;
  },
  ghost(ctx, c, r, layer, v) {
    const pal = c === 6 ? PALETTE[6] : PALETTE[c];
    if (layer === 'body') {
      ctx.beginPath();
      ctx.moveTo(-r * 0.92, r * 0.1); ctx.arc(0, -r * 0.05, r * 0.92, Math.PI, 0);
      ctx.lineTo(r * 0.92, r * 0.72);
      for (let i = 0; i < 4; i++) { const x1 = r * 0.92 - (i + 0.5) * r * 0.46, x2 = r * 0.92 - (i + 1) * r * 0.46; ctx.quadraticCurveTo(x1, i % 2 ? r * 0.98 : r * 0.55, x2, r * 0.8); }
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, pal.light); g.addColorStop(0.6, pal.base); g.addColorStop(1, pal.dark);
      ctx.globalAlpha = 0.86; ctx.fillStyle = g; ctx.fill(); ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(1, r * 0.07); ctx.strokeStyle = pal.deep; ctx.stroke();
      return;
    }
    ctx.fillStyle = '#20122e';
    if (v === 1) { ctx.fillRect(-r * 0.45, -r * 0.1, r * 0.28, r * 0.08); ctx.fillRect(r * 0.17, -r * 0.1, r * 0.28, r * 0.08); }
    else { ellipse(ctx, -r * 0.3, -r * 0.12, r * 0.14, r * 0.22); ctx.fill(); ellipse(ctx, r * 0.3, -r * 0.12, r * 0.14, r * 0.22); ctx.fill(); ctx.fillStyle = '#fff'; ellipse(ctx, -r * 0.34, -r * 0.2, r * 0.05, r * 0.06); ctx.fill(); ellipse(ctx, r * 0.26, -r * 0.2, r * 0.05, r * 0.06); ctx.fill(); }
    ctx.fillStyle = '#20122e'; ellipse(ctx, 0, r * 0.28, r * 0.12, r * (v === 2 ? 0.14 : 0.08)); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ellipse(ctx, -r * 0.45, -r * 0.55, r * 0.2, r * 0.09, -0.6); ctx.fill();
  },
  crown(ctx, c, r, layer, v) {
    const pal = PALETTE[c];
    if (layer === 'body') {
      roundBody(ctx, pal, r);
      ctx.lineWidth = Math.max(1, r * 0.1); ctx.strokeStyle = '#ffd34d'; ellipse(ctx, 0, 0, r * 0.9, r * 0.87); ctx.stroke();
      return;
    }
    shine(ctx, r, 0.7);
    eyes(ctx, r, v, { size: 0.85, y: 0.08 });
    ctx.fillStyle = '#ffcf3a'; ctx.strokeStyle = '#a86b00'; ctx.lineWidth = Math.max(0.8, r * 0.05);
    ctx.beginPath();
    ctx.moveTo(-r * 0.42, -r * 0.5); ctx.lineTo(-r * 0.46, -r * 0.92); ctx.lineTo(-r * 0.22, -r * 0.7); ctx.lineTo(0, -r * 1.02); ctx.lineTo(r * 0.22, -r * 0.7); ctx.lineTo(r * 0.46, -r * 0.92); ctx.lineTo(r * 0.42, -r * 0.5); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff4f7b'; ellipse(ctx, 0, -r * 0.64, r * 0.07, r * 0.07); ctx.fill();
  },
};

// 새 스킨도 다섯 기본 색을 그대로 써서 게임 중 색 구별이 쉽다.
for (const kind of ['bunny', 'bear', 'robot', 'donut', 'flower', 'dragon', 'astronaut', 'aurora']) {
  SKIN_STYLE[kind] = { connect: false };
  SKINS[kind] = (ctx, c, r, layer, v) => {
    const pal = PALETTE[c];
    if (layer === 'body') {
      if (kind === 'bunny' || kind === 'bear') {
        for (const sign of [-1, 1]) {
          const ey = kind === 'bunny' ? -.85 : -.64, ry = kind === 'bunny' ? .55 : .35;
          ctx.fillStyle = pal.base; ctx.strokeStyle = pal.deep; ctx.lineWidth = r * .065;
          ellipse(ctx, sign * r * .6, ey * r, r * .29, ry * r, sign * .15); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#ffbed9'; ellipse(ctx, sign * r * .6, ey * r, r * .14, ry * r * .68, sign * .15); ctx.fill();
        }
      }
      if (kind === 'flower') for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8; ctx.fillStyle = i % 2 ? pal.base : pal.light;
        ellipse(ctx, Math.cos(a) * r * .7, Math.sin(a) * r * .7, r * .38, r * .38); ctx.fill();
      }
      if (kind === 'dragon') for (const sign of [-1, 1]) {
        ctx.fillStyle = pal.dark; ctx.beginPath(); ctx.moveTo(sign * r * .5, r * .2); ctx.lineTo(sign * r * 1.22, -r * .58); ctx.lineTo(sign * r * 1.02, r * .45); ctx.closePath(); ctx.fill();
      }
      if (kind === 'robot') {
        ctx.fillStyle = pal.base; ctx.strokeStyle = pal.deep; ctx.lineWidth = r * .08;
        ctx.beginPath(); ctx.roundRect(-r * .87, -r * .8, r * 1.74, r * 1.65, r * .25); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -r * .8); ctx.lineTo(0, -r * 1.12); ctx.stroke();
        ctx.fillStyle = '#ffec85'; ellipse(ctx, 0, -r * 1.12, r * .12, r * .12); ctx.fill();
      } else if (kind === 'donut') {
        ctx.fillStyle = '#d49048'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.arc(0, 0, r * .35, 0, TAU, true); ctx.fill();
        ctx.fillStyle = pal.base; ctx.beginPath(); ctx.arc(0, -r * .03, r * .87, 0, TAU); ctx.arc(0, 0, r * .35, 0, TAU, true); ctx.fill();
        // 시곗바늘처럼 줄 서지 않게, 스프링클을 이리저리 흩뿌린다 (황금각 2.4rad씩 돌며 안팎으로)
        for (let i = 0; i < 11; i++) {
          const a = i * 2.4 + .5, d = r * (.5 + (i * 7 % 5) * .07);
          ctx.save(); ctx.translate(Math.cos(a) * d, Math.sin(a) * d); ctx.rotate(i * 1.9);
          ctx.fillStyle = ['#fff6c9', '#ffffff', pal.light][i % 3];
          ctx.beginPath(); ctx.roundRect(-r * .1, -r * .035, r * .2, r * .07, r * .035); ctx.fill(); ctx.restore();
        }
        ctx.strokeStyle = pal.dark; ctx.lineWidth = r * .05; ctx.beginPath(); ctx.arc(0, 0, r * .37, 0, TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = r * .09; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0, -r * .03, r * .72, Math.PI * 1.1, Math.PI * 1.4); ctx.stroke();
      } else {
        roundBody(ctx, pal, r * (kind === 'flower' ? .66 : kind === 'astronaut' ? .8 : .88));
      }
      if (kind === 'astronaut' || kind === 'aurora') {
        ctx.strokeStyle = kind === 'astronaut' ? '#e9f8ff' : '#aaffef'; ctx.lineWidth = r * .16;
        ellipse(ctx, 0, 0, r * .94, r * .94); ctx.stroke();
        ctx.strokeStyle = kind === 'astronaut' ? '#57789c' : '#815fea'; ctx.lineWidth = r * .04; ctx.stroke();
        if (kind === 'astronaut') { ctx.fillStyle = '#d5e7f7'; ctx.fillRect(-r * .65, r * .69, r * 1.3, r * .2); }
      }
      return;
    }
    if (kind === 'donut') { eyes(ctx, r, v, { spread: .52, y: -.2, size: .5 }); return; }
    if (kind === 'robot') {
      ctx.fillStyle = '#19394a'; ctx.beginPath(); ctx.roundRect(-r * .68, -r * .4, r * 1.36, r * .65, r * .13); ctx.fill();
      ctx.fillStyle = '#b4fff1'; for (const sign of [-1, 1]) ctx.fillRect(sign * r * .31 - r * .1, -r * .22, r * .2, r * (v === 1 ? .07 : .22));
      ctx.strokeStyle = pal.deep; ctx.lineWidth = r * .06; ctx.beginPath(); ctx.moveTo(-r * .3, r * .52); ctx.lineTo(r * .3, r * .52); ctx.stroke(); return;
    }
    shine(ctx, r * .8, .6); eyes(ctx, r, v, { size: .72, spread: .26, y: .02 });
    if (kind === 'bear') { ctx.fillStyle = pal.light; ellipse(ctx, 0, r * .33, r * .28, r * .19); ctx.fill(); ctx.fillStyle = pal.deep; ellipse(ctx, 0, r * .23, r * .1, r * .07); ctx.fill(); }
    if (kind === 'dragon') for (const sign of [-1, 1]) { ctx.fillStyle = '#fff0a1'; ctx.beginPath(); ctx.moveTo(sign * r * .28, -r * .65); ctx.lineTo(sign * r * .57, -r * 1.13); ctx.lineTo(sign * r * .67, -r * .55); ctx.closePath(); ctx.fill(); }
    if (kind === 'aurora') { ctx.save(); ctx.translate(0, -r * .7); symbolPath(ctx, 'star', r * .36); ctx.fillStyle = '#fff1a1'; ctx.fill(); ctx.restore(); }
    if (kind === 'astronaut') { ctx.strokeStyle = '#fff9'; ctx.lineWidth = r * .08; ctx.beginPath(); ctx.arc(0, 0, r * .8, 3.4, 4.3); ctx.stroke(); }
  };
}

// 업그레이드 3 (인혁이 기획서 2, 6번): 코인으로 사는 새 스킨 6가지, 고난이도 레벨 스킨 6가지(30·40·50·60·70·99레벨),
// 온라인 랭킹 5등 챔피언. 몸은 다섯 기본 색을 그대로 써서 게임 중 색 구별이 쉽다 (꾸밈은 그 위나 둘레에 그린다).
const RAINBOW6 = ['#ff4f64', '#ff9f2e', '#ffd84a', '#3fd972', '#3d8bff', '#9b5cff'];
function beak(ctx, r, y, w = 0.14, h = 0.2) {
  ctx.fillStyle = '#ffa52e'; ctx.strokeStyle = '#b45f00'; ctx.lineWidth = Math.max(0.8, r * 0.04);
  ctx.beginPath(); ctx.moveTo(-r * w, r * y); ctx.lineTo(r * w, r * y); ctx.lineTo(0, r * (y + h)); ctx.closePath(); ctx.fill(); ctx.stroke();
}
function cheeks(ctx, r, y = 0.18, spread = 0.53) {
  ctx.fillStyle = 'rgba(255,110,150,.48)';
  for (const s of [-1, 1]) { ellipse(ctx, s * r * spread, r * y, r * 0.11, r * 0.07); ctx.fill(); }
}
function smile(ctx, r, color, y = 0.2, w = 0.15) {
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, r * 0.07); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, r * y, r * w, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
}
const MORE_SKINS = {
  // ---- 코인으로 사는 스킨 ----
  chick: {
    body(ctx, pal, r) {
      ctx.fillStyle = pal.light; ctx.strokeStyle = pal.deep; ctx.lineWidth = Math.max(1, r * 0.06);
      for (const [x, y, a] of [[-0.2, -0.92, -0.5], [0, -1.02, 0], [0.2, -0.92, 0.5]]) { ellipse(ctx, x * r, y * r, r * 0.12, r * 0.26, a); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = pal.dark;
      for (const s of [-1, 1]) { ellipse(ctx, s * r * 0.86, r * 0.22, r * 0.17, r * 0.3, s * 0.45); ctx.fill(); }
      roundBody(ctx, pal, r * 0.9);
    },
    face(ctx, pal, r, v) {
      shine(ctx, r * 0.85, 0.6);
      eyes(ctx, r, v, { size: 0.7, spread: 0.28, y: -0.1 });
      beak(ctx, r, 0.1);
      cheeks(ctx, r);
    },
  },
  penguin: {
    body(ctx, pal, r) {
      for (const s of [-1, 1]) {
        ctx.fillStyle = pal.dark; ellipse(ctx, s * r * 0.9, r * 0.12, r * 0.16, r * 0.38, s * 0.35); ctx.fill();
        ctx.fillStyle = '#ffa52e'; ellipse(ctx, s * r * 0.34, r * 0.92, r * 0.2, r * 0.1); ctx.fill();
      }
      roundBody(ctx, pal, r * 0.92);
      ctx.fillStyle = 'rgba(255,255,255,.92)'; ellipse(ctx, 0, r * 0.3, r * 0.52, r * 0.54); ctx.fill();
    },
    face(ctx, pal, r, v) {
      shine(ctx, r * 0.85, 0.55);
      eyes(ctx, r, v, { size: 0.68, spread: 0.26, y: -0.22 });
      ctx.fillStyle = '#ffa52e'; ctx.strokeStyle = '#b45f00'; ctx.lineWidth = Math.max(0.8, r * 0.04);
      ctx.beginPath(); ctx.moveTo(-r * 0.15, r * 0.02); ctx.lineTo(0, -r * 0.06); ctx.lineTo(r * 0.15, r * 0.02); ctx.lineTo(0, r * 0.14); ctx.closePath(); ctx.fill(); ctx.stroke();
    },
  },
  cookie: {
    body(ctx, pal, r) {
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) { const a = i * TAU / 48, rr = r * (0.94 + 0.045 * Math.sin(a * 9)), x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.closePath();
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.05);
      g.addColorStop(0, pal.light); g.addColorStop(0.5, pal.base); g.addColorStop(1, pal.dark);
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = Math.max(1, r * 0.07); ctx.strokeStyle = pal.deep; ctx.stroke();
      ctx.fillStyle = '#5a3320';
      for (const [x, y, s] of [[-0.55, -0.42, 0.11], [0.5, -0.5, 0.09], [0.64, 0.2, 0.1], [-0.62, 0.34, 0.09], [0.1, 0.7, 0.1], [-0.08, -0.72, 0.08]]) { ellipse(ctx, x * r, y * r, r * s, r * s * 0.85, x); ctx.fill(); }
    },
    face(ctx, pal, r, v) {
      eyes(ctx, r, v, { size: 0.72, spread: 0.27, y: -0.05 });
      smile(ctx, r, pal.deep);
    },
  },
  ninja: {
    body(ctx, pal, r) {
      // 뒤로 날리는 머리띠 끈 (어두운 필드에서도 보이게 몸 색으로)
      ctx.fillStyle = pal.dark; ctx.strokeStyle = pal.deep; ctx.lineWidth = Math.max(1, r * 0.05);
      for (const [dy, a] of [[-0.52, -0.38], [-0.34, 0.08]]) {
        ctx.save(); ctx.translate(r * 0.84, r * dy); ctx.rotate(a);
        ctx.beginPath(); ctx.moveTo(0, -r * 0.08); ctx.lineTo(r * 0.5, -r * 0.16); ctx.lineTo(r * 0.45, r * 0.12); ctx.lineTo(0, r * 0.08); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      roundBody(ctx, pal, r);
      ctx.save(); ellipse(ctx, 0, 0, r, r * 0.97); ctx.clip();
      ctx.fillStyle = '#2a1640'; ctx.fillRect(-r, -r * 0.64, r * 2, r * 0.34);
      ctx.fillStyle = '#d8dfee'; ctx.fillRect(-r * 0.22, -r * 0.6, r * 0.44, r * 0.26);
      ctx.restore();
    },
    face(ctx, pal, r, v) {
      eyes(ctx, r, v, { size: 0.78, y: 0.04 });
      ctx.strokeStyle = '#1b1330'; ctx.lineWidth = Math.max(1, r * 0.09); ctx.lineCap = 'round';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.52, -r * 0.27); ctx.lineTo(s * r * 0.16, -r * 0.15); ctx.stroke(); }
    },
  },
  pumpkin: {
    body(ctx, pal, r) {
      ctx.fillStyle = '#5f8f2e'; ctx.strokeStyle = '#34531a'; ctx.lineWidth = Math.max(1, r * 0.06);
      ctx.beginPath(); ctx.moveTo(-r * 0.1, -r * 0.8); ctx.quadraticCurveTo(-r * 0.05, -r * 1.2, r * 0.22, -r * 1.22); ctx.lineTo(r * 0.26, -r * 1.02); ctx.quadraticCurveTo(r * 0.12, -r * 1.0, r * 0.12, -r * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.lineWidth = Math.max(1, r * 0.07); ctx.strokeStyle = pal.deep;
      for (const [x, w, mid] of [[-0.48, 0.54, pal.dark], [0.48, 0.54, pal.dark], [0, 0.6, pal.base]]) {
        const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, pal.light); g.addColorStop(0.45, mid); g.addColorStop(1, pal.dark);
        ctx.fillStyle = g; ellipse(ctx, x * r, r * 0.03, r * w, r * 0.9); ctx.fill(); ctx.stroke();
      }
    },
    face(ctx, pal, r, v) {
      ctx.fillStyle = '#3a1c05';
      if (v === 1) { ctx.fillRect(-r * 0.46, -r * 0.12, r * 0.28, r * 0.08); ctx.fillRect(r * 0.18, -r * 0.12, r * 0.28, r * 0.08); }
      else for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.32, -r * 0.3); ctx.lineTo(s * r * 0.5, r * 0.02); ctx.lineTo(s * r * 0.14, r * 0.02); ctx.closePath(); ctx.fill(); }
      ctx.beginPath(); ctx.moveTo(-r * 0.42, r * 0.28);
      for (let i = 1; i <= 5; i++) ctx.lineTo(-r * 0.42 + i * r * 0.14, r * (i % 2 ? 0.46 : 0.3));
      ctx.lineTo(r * 0.42, r * 0.28); ctx.closePath(); ctx.fill();
    },
  },
  octopus: {
    body(ctx, pal, r) {
      ctx.strokeStyle = pal.deep; ctx.lineWidth = Math.max(1, r * 0.06);
      for (const x of [-0.66, -0.22, 0.22, 0.66]) { ctx.fillStyle = pal.base; ellipse(ctx, x * r, r * 0.72, r * 0.2, r * 0.3, x * 0.5); ctx.fill(); ctx.stroke(); }
      ctx.save(); ctx.translate(0, -r * 0.12); roundBody(ctx, pal, r * 0.9); ctx.restore();
      ctx.fillStyle = pal.light;
      for (const x of [-0.66, -0.22, 0.22, 0.66]) { ellipse(ctx, x * r, r * 0.86, r * 0.06, r * 0.05); ctx.fill(); }
    },
    face(ctx, pal, r, v) {
      ctx.translate(0, -r * 0.12);
      shine(ctx, r * 0.85, 0.6);
      eyes(ctx, r, v, { size: 0.72, spread: 0.28, y: -0.04 });
      ctx.strokeStyle = pal.deep; ctx.lineWidth = Math.max(1, r * 0.07);
      ellipse(ctx, 0, r * 0.3, r * 0.08, r * 0.07); ctx.stroke();
      cheeks(ctx, r, 0.2, 0.56);
    },
  },
  // ---- 고난이도 레벨 스킨 (교환권으로 못 받는다) ----
  knight: { // 30레벨
    body(ctx, pal, r) {
      ctx.fillStyle = pal.base; ctx.strokeStyle = pal.deep; ctx.lineWidth = Math.max(1, r * 0.06);
      ctx.beginPath(); ctx.moveTo(-r * 0.08, -r * 0.9); ctx.quadraticCurveTo(-r * 0.46, -r * 1.34, r * 0.3, -r * 1.24); ctx.quadraticCurveTo(r * 0.05, -r * 1.12, r * 0.12, -r * 0.9); ctx.closePath(); ctx.fill(); ctx.stroke();
      roundBody(ctx, pal, r);
      ctx.save(); ellipse(ctx, 0, 0, r, r * 0.97); ctx.clip();
      const g = ctx.createLinearGradient(0, -r, 0, -r * 0.2); g.addColorStop(0, '#f6f9ff'); g.addColorStop(1, '#8f9bb5');
      ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 0.72);
      ctx.fillStyle = '#5d6880'; ctx.fillRect(-r, -r * 0.33, r * 2, r * 0.07); ctx.fillRect(-r * 0.05, -r, r * 0.1, r * 0.7);
      ctx.restore();
      ctx.lineWidth = Math.max(1, r * 0.07); ctx.strokeStyle = pal.deep; ellipse(ctx, 0, 0, r, r * 0.97); ctx.stroke();
    },
    face(ctx, pal, r, v) {
      eyes(ctx, r, v, { size: 0.78, y: 0.1 });
      ctx.strokeStyle = pal.deep; ctx.lineWidth = Math.max(1, r * 0.07); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-r * 0.14, r * 0.54); ctx.lineTo(r * 0.14, r * 0.54); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ellipse(ctx, -r * 0.42, -r * 0.68, r * 0.2, r * 0.08, -0.5); ctx.fill();
    },
  },
  wizard: { // 40레벨
    body(ctx, pal, r) {
      ctx.save(); ctx.translate(0, r * 0.1); roundBody(ctx, pal, r * 0.9); ctx.restore();
      ctx.fillStyle = '#3a2a86'; ctx.strokeStyle = '#1c1250'; ctx.lineWidth = Math.max(1, r * 0.06);
      ctx.beginPath(); ctx.moveTo(-r * 0.62, -r * 0.5); ctx.quadraticCurveTo(-r * 0.1, -r * 0.95, r * 0.28, -r * 1.3); ctx.quadraticCurveTo(r * 0.34, -r * 0.85, r * 0.62, -r * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = pal.light; ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.6); ctx.lineTo(r * 0.56, -r * 0.6); ctx.lineTo(r * 0.62, -r * 0.46); ctx.lineTo(-r * 0.62, -r * 0.46); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4a37a6'; ellipse(ctx, 0, -r * 0.44, r * 0.95, r * 0.16); ctx.fill(); ctx.stroke();
    },
    face(ctx, pal, r, v) {
      ctx.save(); ctx.translate(0, r * 0.1);
      eyes(ctx, r, v, { size: 0.74, spread: 0.27, y: 0 });
      smile(ctx, r, pal.deep, 0.26, 0.14);
      ctx.restore();
      ctx.fillStyle = '#ffe45c';
      for (const [x, y, s] of [[0.04, -0.8, 0.19], [0.2, -1.04, 0.11], [-0.24, -0.7, 0.1]]) { ctx.save(); ctx.translate(x * r, y * r); symbolPath(ctx, 'star', r * s); ctx.fill(); ctx.restore(); }
    },
  },
  phoenix: { // 50레벨
    body(ctx, pal, r) {
      const flame = (x, y, w, h, rot) => {
        ctx.save(); ctx.translate(x * r, y * r); ctx.rotate(rot);
        const g = ctx.createLinearGradient(0, h * r * 0.5, 0, -h * r); g.addColorStop(0, '#ff5a2a'); g.addColorStop(0.55, '#ffb03a'); g.addColorStop(1, '#fff3a6');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(0, -h * r); ctx.quadraticCurveTo(w * r, 0, 0, h * r * 0.5); ctx.quadraticCurveTo(-w * r, 0, 0, -h * r); ctx.fill();
        ctx.restore();
      };
      // 불꽃은 옆 칸 몸을 덮지 않을 만큼만 (끝이 가운데에서 1.3r 안쪽)
      for (const s of [-1, 1]) { flame(s * 0.8, 0.12, 0.42, 0.58, s * 1.05); flame(s * 0.7, -0.36, 0.36, 0.56, s * 0.6); }
      flame(0, -0.8, 0.3, 0.5, 0); flame(-0.3, -0.72, 0.24, 0.4, -0.35); flame(0.3, -0.72, 0.24, 0.4, 0.35);
      roundBody(ctx, pal, r * 0.86);
    },
    face(ctx, pal, r, v) {
      shine(ctx, r * 0.82, 0.6);
      eyes(ctx, r, v, { size: 0.72, spread: 0.26, y: -0.04 });
      beak(ctx, r, 0.16, 0.12);
    },
  },
  galaxy: { // 60레벨
    body(ctx, pal, r) {
      const g = ctx.createRadialGradient(0, 0, r * 0.05, 0, 0, r);
      g.addColorStop(0, pal.light); g.addColorStop(0.5, pal.base); g.addColorStop(0.82, pal.dark); g.addColorStop(1, '#16123c');
      ctx.fillStyle = g; ellipse(ctx, 0, 0, r, r * 0.97); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(1, r * 0.07); ctx.lineCap = 'round';
      for (const start of [0, Math.PI]) {
        ctx.beginPath();
        for (let k = 0; k <= 16; k++) { const t = k / 16, a = start + t * 3.4, rr = r * (0.18 + t * 0.68), x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.92; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.stroke();
      }
      ctx.fillStyle = '#ffffff';
      for (const [x, y, s] of [[-0.62, -0.3, 0.05], [0.55, -0.55, 0.06], [0.68, 0.25, 0.04], [-0.4, 0.62, 0.05], [0.2, 0.74, 0.04], [-0.75, 0.18, 0.035]]) { ellipse(ctx, x * r, y * r, r * s, r * s); ctx.fill(); }
      ctx.lineWidth = Math.max(1.2, r * 0.09); ctx.strokeStyle = pal.glow; ellipse(ctx, 0, 0, r * 0.97, r * 0.94); ctx.stroke();
    },
    face(ctx, pal, r, v) {
      eyes(ctx, r, v, { size: 0.74, spread: 0.27 });
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ellipse(ctx, -r * 0.38, -r * 0.5, r * 0.22, r * 0.1, -0.55); ctx.fill();
    },
  },
  thunder: { // 70레벨
    body(ctx, pal, r) {
      ctx.strokeStyle = '#ffe45c'; ctx.lineWidth = Math.max(1.2, r * 0.09); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        ctx.save(); ctx.rotate(i * TAU / 6 + 0.3);
        ctx.beginPath(); ctx.moveTo(r * 0.95, 0); ctx.lineTo(r * 1.12, -r * 0.1); ctx.lineTo(r * 1.08, r * 0.06); ctx.lineTo(r * 1.3, -r * 0.04); ctx.stroke();
        ctx.restore();
      }
      roundBody(ctx, pal, r * 0.93);
      ctx.lineWidth = Math.max(1, r * 0.06); ctx.strokeStyle = '#fff6a8'; ellipse(ctx, 0, 0, r * 0.86, r * 0.83); ctx.stroke();
    },
    face(ctx, pal, r, v) {
      shine(ctx, r * 0.88, 0.55);
      eyes(ctx, r, v, { size: 0.72, spread: 0.3, y: -0.14 });
      ctx.fillStyle = '#ffe45c'; ctx.strokeStyle = '#a86b00'; ctx.lineWidth = Math.max(0.8, r * 0.045); ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(r * 0.1, r * 0.14); ctx.lineTo(-r * 0.18, r * 0.48); ctx.lineTo(-r * 0.02, r * 0.48); ctx.lineTo(-r * 0.12, r * 0.8); ctx.lineTo(r * 0.2, r * 0.4); ctx.lineTo(r * 0.04, r * 0.4); ctx.closePath(); ctx.fill(); ctx.stroke();
    },
  },
  legend: { // 99레벨
    body(ctx, pal, r) {
      RAINBOW6.forEach((col, i) => { ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, r * 0.06); ctx.beginPath(); ctx.arc(0, 0, r * (1.24 - i * 0.06), Math.PI * 1.12, Math.PI * 1.88); ctx.stroke(); });
      ctx.strokeStyle = '#b9c4e6'; ctx.lineWidth = Math.max(1, r * 0.05);
      for (const s of [-1, 1]) for (const [dy, len] of [[-0.06, 0.46], [0.14, 0.38], [0.32, 0.3]]) {
        ctx.fillStyle = '#ffffff'; ellipse(ctx, s * r * (0.84 + len * 0.35), r * dy, r * len * 0.5, r * 0.13, s * -0.35); ctx.fill(); ctx.stroke();
      }
      roundBody(ctx, pal, r * 0.86);
      ctx.lineWidth = Math.max(1, r * 0.08); ctx.strokeStyle = '#ffd34d'; ellipse(ctx, 0, 0, r * 0.86, r * 0.835); ctx.stroke();
    },
    face(ctx, pal, r, v) {
      shine(ctx, r * 0.82, 0.65);
      eyes(ctx, r, v, { size: 0.74, spread: 0.26, y: 0.06 });
      ctx.fillStyle = '#ffcf3a'; ctx.strokeStyle = '#a86b00'; ctx.lineWidth = Math.max(0.8, r * 0.045);
      ctx.beginPath(); ctx.moveTo(-r * 0.34, -r * 0.52); ctx.lineTo(-r * 0.38, -r * 0.88); ctx.lineTo(-r * 0.17, -r * 0.7); ctx.lineTo(0, -r * 0.98); ctx.lineTo(r * 0.17, -r * 0.7); ctx.lineTo(r * 0.38, -r * 0.88); ctx.lineTo(r * 0.34, -r * 0.52); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff4f7b'; ellipse(ctx, 0, -r * 0.64, r * 0.06, r * 0.06); ctx.fill();
    },
  },
  // ---- 온라인 랭킹 5등 안에 든 사람만 (기획서 6번) ----
  champion: {
    body(ctx, pal, r) {
      ctx.fillStyle = '#7ccf4a'; ctx.strokeStyle = '#3f7a1f'; ctx.lineWidth = Math.max(0.8, r * 0.04);
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
        const a = Math.PI / 2 + s * (0.5 + i * 0.42);
        ctx.save(); ctx.translate(Math.cos(a) * r * 1.02, Math.sin(a) * r); ctx.rotate(a + s * 0.9);
        ellipse(ctx, 0, 0, r * 0.2, r * 0.09); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      roundBody(ctx, pal, r * 0.92);
    },
    face(ctx, pal, r, v) {
      shine(ctx, r * 0.88, 0.6);
      eyes(ctx, r, v, { size: 0.7, spread: 0.28, y: -0.22 });
      ctx.lineCap = 'round';
      for (const [s, col] of [[-1, '#ff4f64'], [1, '#3d8bff']]) { ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.2, r * 0.12); ctx.beginPath(); ctx.moveTo(s * r * 0.52, -r * 0.02); ctx.lineTo(0, r * 0.34); ctx.stroke(); }
      const g = ctx.createRadialGradient(-r * 0.08, r * 0.4, r * 0.02, 0, r * 0.48, r * 0.3); g.addColorStop(0, '#fff6b0'); g.addColorStop(0.6, '#ffcf3a'); g.addColorStop(1, '#d99a06');
      ctx.fillStyle = g; ellipse(ctx, 0, r * 0.5, r * 0.27, r * 0.27); ctx.fill();
      ctx.lineWidth = Math.max(0.8, r * 0.05); ctx.strokeStyle = '#a86b00'; ctx.stroke();
      ctx.save(); ctx.translate(0, r * 0.5); symbolPath(ctx, 'star', r * 0.17); ctx.fillStyle = '#fff8cf'; ctx.fill(); ctx.restore();
    },
  },
};
for (const [kind, art] of Object.entries(MORE_SKINS)) {
  SKIN_STYLE[kind] = { connect: false };
  SKINS[kind] = (ctx, c, r, layer, v) => (layer === 'body' ? art.body(ctx, PALETTE[c], r) : art.face(ctx, PALETTE[c], r, v));
}

export const SKIN_IDS = Object.keys(SKINS);

// 스킨 하나의 한 층을 (0,0) 가운데에 반지름 r로 그린다
export function drawSkinLayer(ctx, skin, color, r, layer, variant = 0) {
  const fn = SKINS[skin] || SKINS.classic;
  ctx.save();
  if (color === 6 && !['pixel', 'ghost', 'neon'].includes(skin)) garbageLook(ctx, r, layer, variant);
  else if (color === 6 && skin === 'neon') {
    if (layer === 'body') { ctx.fillStyle = 'rgba(40,40,60,.9)'; ellipse(ctx, 0, 0, r * 0.94, r * 0.92); ctx.fill(); ctx.shadowColor = '#fff'; ctx.shadowBlur = r * 0.3; ctx.lineWidth = Math.max(1, r * 0.1); ctx.strokeStyle = '#dfe6ff'; ctx.stroke(); }
    else garbageLook(ctx, r, 'face', variant);
  } else fn(ctx, color, r, layer, variant);
  ctx.restore();
}

// 캐시: 같은 크기·색·스킨의 그림은 한 번만 그린다
export class SkinCache {
  constructor() { this.map = new Map(); }
  sprite(skin, color, size, layer, variant = 0) {
    const s = Math.max(4, Math.round(size));
    const key = `${skin}|${color}|${s}|${layer}|${variant}`;
    let c = this.map.get(key);
    if (c) return c;
    const pad = Math.ceil(s * 0.35);
    c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(s + pad * 2, s + pad * 2) : Object.assign(document.createElement('canvas'), { width: s + pad * 2, height: s + pad * 2 });
    const ctx = c.getContext('2d');
    ctx.translate(pad + s / 2, pad + s / 2);
    drawSkinLayer(ctx, skin, color, s * 0.46, layer, variant);
    c.pad = pad;
    if (this.map.size > 1600) this.map.clear();
    this.map.set(key, c);
    return c;
  }
  clear() { this.map.clear(); }
}

// 붙어 있는 두 뿌요 사이 다리. (x,y)는 첫 뿌요 가운데, horizontal이면 오른쪽 이웃, 아니면 위쪽 이웃
export function drawBridge(ctx, skin, color, x, y, size, horizontal) {
  const pal = PALETTE[color];
  const w = size * 0.62;
  ctx.save();
  if (skin === 'neon') {
    ctx.fillStyle = 'rgba(12,8,30,.92)';
    if (horizontal) ctx.fillRect(x, y - w / 2, size, w); else ctx.fillRect(x - w / 2, y - size, w, size);
    ctx.shadowColor = pal.glow; ctx.shadowBlur = size * 0.2; ctx.strokeStyle = pal.glow; ctx.lineWidth = Math.max(1.5, size * 0.065);
    ctx.beginPath();
    if (horizontal) { ctx.moveTo(x + size * 0.3, y - w / 2); ctx.lineTo(x + size * 0.7, y - w / 2); ctx.moveTo(x + size * 0.3, y + w / 2); ctx.lineTo(x + size * 0.7, y + w / 2); }
    else { ctx.moveTo(x - w / 2, y - size * 0.3); ctx.lineTo(x - w / 2, y - size * 0.7); ctx.moveTo(x + w / 2, y - size * 0.3); ctx.lineTo(x + w / 2, y - size * 0.7); }
    ctx.stroke();
    ctx.restore();
    return;
  }
  const g = horizontal ? ctx.createLinearGradient(0, y - w / 2, 0, y + w / 2) : ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, skin === 'jelly' ? pal.light : pal.base);
  g.addColorStop(0.5, pal.base);
  g.addColorStop(1, pal.dark);
  ctx.globalAlpha = skin === 'jelly' ? 0.78 : 1;
  ctx.fillStyle = g;
  if (skin === 'candy') ctx.fillStyle = pal.base;
  ctx.beginPath();
  if (horizontal) ctx.rect(x + size * 0.15, y - w / 2, size * 0.7, w);
  else ctx.rect(x - w / 2, y - size * 0.85, w, size * 0.7);
  ctx.fill();
  ctx.restore();
}

// 상점·메뉴 미리보기용: 캔버스 하나에 스킨 뿌요를 그린다
export function drawPreview(canvas, skin, colors = [1, 2, 3, 4], t = 0) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const size = Math.min(w / 2.6, h / 2.4);
  const cx = w / 2, cy = h / 2;
  const spots = [[-0.5, 0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, -0.5]];
  const style = SKIN_STYLE[skin] || SKIN_STYLE.classic;
  const shape = [colors[0], colors[0], colors[1], colors[0]];
  for (const layer of ['body', 'bridge', 'face']) {
    if (layer === 'bridge') {
      if (style.connect) {
        drawBridge(ctx, skin, colors[0], cx - size * 0.5, cy + size * 0.5, size, true);
        drawBridge(ctx, skin, colors[0], cx + size * 0.5, cy + size * 0.5, size, false);
      }
      continue;
    }
    shape.forEach((c, i) => {
      const [dx, dy] = spots[i];
      ctx.save();
      ctx.translate(cx + dx * size, cy + dy * size);
      drawSkinLayer(ctx, skin, c, size * 0.46, layer, layer === 'face' && Math.floor(t * 1.3 + i * 0.7) % 7 === 0 ? 1 : 0);
      ctx.restore();
    });
  }
}
