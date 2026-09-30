// 타워의 층 주인들과 주인공, 그리고 방해뿌요 예고 아이콘을 캔버스로 그린다.
const TAU = Math.PI * 2;

function body(ctx, x, y, rx, ry, light, base, dark, outline) {
  const g = ctx.createRadialGradient(x - rx * 0.35, y - ry * 0.4, rx * 0.08, x, y, Math.max(rx, ry) * 1.05);
  g.addColorStop(0, light); g.addColorStop(0.5, base); g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.lineWidth = Math.max(1.5, rx * 0.06); ctx.strokeStyle = outline; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.beginPath(); ctx.ellipse(x - rx * 0.4, y - ry * 0.5, rx * 0.26, ry * 0.13, -0.5, 0, TAU); ctx.fill();
}

// 표정: mood = idle | happy | sad | attack
function face(ctx, x, y, r, mood, t, opt = {}) {
  const ex = r * (opt.spread ?? 0.34), ey = y - r * (opt.eyeY ?? 0.05);
  const dark = opt.dark || '#1d1230';
  const blink = mood === 'idle' && (Math.floor(t * 60) % 190) < 7;
  ctx.lineCap = 'round';
  if (mood === 'happy' || blink) {
    ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1.5, r * 0.09);
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * ex, ey + r * 0.06, r * 0.13, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke(); }
  } else {
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x + s * ex, ey, r * 0.17, r * 0.22, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = opt.pupil || dark;
      if (opt.slit) { ctx.beginPath(); ctx.ellipse(x + s * ex, ey + r * 0.02, r * 0.05, r * 0.16, 0, 0, TAU); ctx.fill(); }
      else { ctx.beginPath(); ctx.ellipse(x + s * ex + s * r * 0.02, ey + r * 0.05, r * 0.1, r * 0.13, 0, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + s * ex - r * 0.03, ey - r * 0.03, r * 0.045, 0, TAU); ctx.fill();
    }
  }
  if (mood === 'attack' || opt.brows) {
    ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1.5, r * 0.08);
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * ex * 1.45, ey - r * 0.32); ctx.lineTo(x + s * ex * 0.45, ey - r * (mood === 'attack' ? 0.2 : 0.3)); ctx.stroke(); }
  }
  if (mood === 'sad') {
    ctx.fillStyle = '#7cc8ff';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + s * ex, ey + r * 0.3 + (t * 30 % 10) * r * 0.02, r * 0.05, r * 0.08, 0, 0, TAU); ctx.fill(); }
  }
  ctx.fillStyle = 'rgba(255,120,150,.45)';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + s * r * 0.58, y + r * 0.2, r * 0.12, r * 0.07, 0, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = dark; ctx.fillStyle = '#7a1d3a'; ctx.lineWidth = Math.max(1.2, r * 0.07);
  const my = y + r * 0.32;
  if (mood === 'happy' || mood === 'attack') {
    ctx.beginPath(); ctx.moveTo(x - r * 0.18, my - r * 0.03); ctx.quadraticCurveTo(x, my + r * 0.3, x + r * 0.18, my - r * 0.03); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (mood === 'sad') {
    ctx.beginPath(); ctx.arc(x, my + r * 0.12, r * 0.12, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(x, my - r * 0.05, r * 0.11, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  }
}

function star(ctx, x, y, s, fill = '#ffe066') {
  ctx.fillStyle = fill; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * 0.45 : s; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  ctx.closePath(); ctx.fill();
}
function crownShape(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(0, y - h, 0, y);
  g.addColorStop(0, '#fff09a'); g.addColorStop(0.5, '#ffc928'); g.addColorStop(1, '#c98a00');
  ctx.fillStyle = g; ctx.strokeStyle = '#8a5a00'; ctx.lineWidth = Math.max(1.2, w * 0.04);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w / 2, y - h * 0.55); ctx.lineTo(x - w * 0.27, y - h * 0.25); ctx.lineTo(x - w * 0.14, y - h);
  ctx.lineTo(x, y - h * 0.35); ctx.lineTo(x + w * 0.14, y - h); ctx.lineTo(x + w * 0.27, y - h * 0.25); ctx.lineTo(x + w / 2, y - h * 0.55); ctx.lineTo(x + w / 2, y);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  for (const [dx, col] of [[-0.3, '#ff4f7b'], [0, '#3d8bff'], [0.3, '#33d16a']]) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + dx * w, y - h * 0.18, w * 0.06, 0, TAU); ctx.fill(); }
}

const CHARS = {
  hero(ctx, x, y, s, mood, t, extra = {}) {
    const r = s * 0.36, by = y + s * 0.12 + Math.sin(t * 4) * s * 0.01;
    ctx.save();
    ctx.strokeStyle = '#e8313f'; ctx.lineWidth = s * 0.05; ctx.lineCap = 'round';
    for (const k of [0, 1]) { ctx.beginPath(); ctx.moveTo(x + r * 0.8, by - r * 0.45); ctx.quadraticCurveTo(x + r * 1.3, by - r * (0.55 + k * 0.3) + Math.sin(t * 8 + k) * r * 0.1, x + r * 1.55, by - r * (0.2 + k * 0.45)); ctx.stroke(); }
    ctx.restore();
    body(ctx, x, by, r, r * 0.95, '#fff4ad', '#ffcd2e', '#d99a06', '#8a5d00');
    ctx.fillStyle = '#e8313f'; ctx.beginPath(); ctx.ellipse(x, by - r * 0.5, r * 0.93, r * 0.2, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(x + r * 0.9, by - r * 0.38); ctx.ellipse(x, by - r * 0.38, r * 0.9, r * 0.18, 0, 0, Math.PI, false); ctx.fill();
    face(ctx, x, by + r * 0.05, r, mood, t, { brows: mood === 'attack' });
    if (extra.crown) crownShape(ctx, x, by - r * 0.72, r * 1.1, r * 0.75);
  },
  poyo(ctx, x, y, s, mood, t) {
    const r = s * 0.28, hop = Math.abs(Math.sin(t * 5)) * s * 0.04, by = y + s * 0.2 - hop;
    ctx.strokeStyle = '#2e8b3a'; ctx.lineWidth = s * 0.03;
    ctx.beginPath(); ctx.moveTo(x, by - r * 0.9); ctx.quadraticCurveTo(x + r * 0.1, by - r * 1.35, x, by - r * 1.55); ctx.stroke();
    ctx.fillStyle = '#56d364';
    ctx.beginPath(); ctx.ellipse(x - r * 0.28, by - r * 1.5, r * 0.3, r * 0.14, 0.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + r * 0.3, by - r * 1.45, r * 0.3, r * 0.14, -0.5, 0, TAU); ctx.fill();
    body(ctx, x, by, r, r * 0.93, '#c8ffc9', '#4cd964', '#1c9a45', '#0b5c2a');
    face(ctx, x, by, r, mood, t, { spread: 0.36 });
  },
  bubble(ctx, x, y, s, mood, t) {
    const r = s * 0.4, w = Math.sin(t * 3) * 0.04, by = y + s * 0.08;
    ctx.save(); ctx.translate(x, by); ctx.scale(1 + w, 1 - w); ctx.translate(-x, -by);
    body(ctx, x, by, r, r * 0.92, '#d6ecff', '#3d8bff', '#1c55cf', '#0f2f80');
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(x + r * 0.45, by + r * 0.35, r * 0.12, r * 0.18, -0.4, 0, TAU); ctx.fill();
    face(ctx, x, by - r * 0.05, r * 0.85, mood, t);
    ctx.fillStyle = '#ff4f64'; ctx.strokeStyle = '#8f1028'; ctx.lineWidth = Math.max(1, r * 0.03);
    const bx = x, bw = by + r * 0.62;
    ctx.beginPath(); ctx.moveTo(bx, bw); ctx.lineTo(bx - r * 0.28, bw - r * 0.14); ctx.lineTo(bx - r * 0.28, bw + r * 0.14); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx, bw); ctx.lineTo(bx + r * 0.28, bw - r * 0.14); ctx.lineTo(bx + r * 0.28, bw + r * 0.14); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(180,220,255,.8)'; ctx.lineWidth = Math.max(1, s * 0.01);
    for (let i = 0; i < 4; i++) { const a = t * 0.8 + i * 1.7; ctx.beginPath(); ctx.arc(x + Math.cos(a) * s * 0.46, y - s * 0.1 + Math.sin(a * 1.3) * s * 0.3, s * (0.02 + i * 0.008), 0, TAU); ctx.stroke(); }
  },
  golem(ctx, x, y, s, mood, t) {
    const r = s * 0.38, by = y + s * 0.1;
    for (let i = 0; i < 5; i++) {
      const fx = x + (i - 2) * r * 0.28, fh = r * (0.45 + 0.25 * Math.sin(t * 9 + i * 1.3));
      const g = ctx.createLinearGradient(0, by - r * 0.7 - fh, 0, by - r * 0.6);
      g.addColorStop(0, 'rgba(255,240,120,0)'); g.addColorStop(0.4, '#ffb52e'); g.addColorStop(1, '#ff5a1f');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(fx - r * 0.16, by - r * 0.6); ctx.quadraticCurveTo(fx, by - r * 0.7 - fh * 1.2, fx + r * 0.16, by - r * 0.6); ctx.fill();
    }
    ctx.beginPath();
    const pts = 11;
    for (let i = 0; i < pts; i++) { const a = i * TAU / pts, rr = r * (0.9 + 0.1 * Math.sin(i * 2.7)); ctx.lineTo(x + Math.cos(a) * rr, by + Math.sin(a) * rr * 0.92); }
    ctx.closePath();
    const g = ctx.createRadialGradient(x - r * 0.3, by - r * 0.3, r * 0.1, x, by, r);
    g.addColorStop(0, '#b9a79a'); g.addColorStop(0.55, '#7d6a5d'); g.addColorStop(1, '#46362c');
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = Math.max(1.5, r * 0.05); ctx.strokeStyle = '#2b1f18'; ctx.stroke();
    ctx.fillStyle = 'rgba(40,28,20,.35)';
    for (const [dx, dy, cr] of [[-0.5, 0.35, 0.14], [0.55, 0.25, 0.1], [0.2, 0.6, 0.08], [-0.2, -0.6, 0.09]]) { ctx.beginPath(); ctx.arc(x + dx * r, by + dy * r, cr * r, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = '#ff8a2e'; ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.beginPath(); ctx.moveTo(x - r * 0.1, by - r * 0.85); ctx.lineTo(x - r * 0.02, by - r * 0.55); ctx.lineTo(x - r * 0.15, by - r * 0.35); ctx.stroke();
    const glow = mood === 'sad' ? '#b0a090' : '#ffb13b';
    ctx.shadowColor = '#ff7a1f'; ctx.shadowBlur = mood === 'sad' ? 0 : r * 0.3;
    ctx.fillStyle = glow;
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + sd * r * 0.33, by - r * 0.05, r * 0.14, mood === 'happy' ? r * 0.05 : r * 0.12, 0, 0, TAU); ctx.fill(); }
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#2b1f18'; ctx.lineWidth = Math.max(2, r * 0.09);
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + sd * r * 0.55, by - r * 0.32); ctx.lineTo(x + sd * r * 0.15, by - r * (mood === 'sad' ? 0.3 : 0.2)); ctx.stroke(); }
    ctx.beginPath();
    if (mood === 'sad') ctx.arc(x, by + r * 0.5, r * 0.18, 1.2 * Math.PI, 1.8 * Math.PI);
    else { ctx.moveTo(x - r * 0.25, by + r * 0.35); ctx.lineTo(x - r * 0.1, by + r * 0.42); ctx.lineTo(x + r * 0.05, by + r * 0.34); ctx.lineTo(x + r * 0.22, by + r * 0.42); }
    ctx.stroke();
  },
  wizard(ctx, x, y, s, mood, t) {
    const r = s * 0.3, by = y + s * 0.2;
    body(ctx, x, by, r, r * 0.95, '#ecd4ff', '#b35cff', '#7c2fd6', '#4a1488');
    face(ctx, x, by + r * 0.05, r, mood, t);
    ctx.save();
    ctx.translate(x, by - r * 0.62); ctx.rotate(-0.12 + Math.sin(t * 2) * 0.04);
    const g = ctx.createLinearGradient(0, -r * 1.7, 0, 0); g.addColorStop(0, '#4b5dff'); g.addColorStop(1, '#23236e');
    ctx.fillStyle = g; ctx.strokeStyle = '#141447'; ctx.lineWidth = Math.max(1.2, r * 0.05);
    ctx.beginPath(); ctx.moveTo(-r * 0.95, 0); ctx.quadraticCurveTo(-r * 0.3, -r * 0.5, r * 0.2, -r * 1.75); ctx.quadraticCurveTo(r * 0.35, -r * 0.6, r * 0.95, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(-r * 0.85, -r * 0.2, r * 1.7, r * 0.16);
    star(ctx, -r * 0.1, -r * 0.8, r * 0.16); star(ctx, r * 0.25, -r * 1.2, r * 0.1); star(ctx, -r * 0.4, -r * 0.45, r * 0.08);
    ctx.restore();
    ctx.strokeStyle = '#8a5a2e'; ctx.lineWidth = Math.max(2, s * 0.022);
    const wx = x + r * 1.25, wy = by - r * 0.1 + Math.sin(t * 3) * r * 0.1;
    ctx.beginPath(); ctx.moveTo(x + r * 0.85, by + r * 0.5); ctx.lineTo(wx, wy); ctx.stroke();
    star(ctx, wx, wy, r * 0.28 * (1 + Math.sin(t * 6) * 0.1), '#fff27a');
    for (let i = 0; i < 5; i++) { const a = t * 2 + i * 1.25; star(ctx, wx + Math.cos(a) * r * 0.6, wy + Math.sin(a) * r * 0.5, r * 0.06, '#fffbd6'); }
  },
  luna(ctx, x, y, s, mood, t) {
    const r = s * 0.3, by = y + s * 0.2;
    for (const sd of [-1, 1]) {
      ctx.save(); ctx.translate(x + sd * r * 0.4, by - r * 0.7); ctx.rotate(sd * 0.18 + (sd > 0 ? Math.sin(t * 2) * 0.12 + 0.35 : 0));
      ctx.fillStyle = '#fbf7ff'; ctx.strokeStyle = '#7b6aa8'; ctx.lineWidth = Math.max(1.2, r * 0.05);
      ctx.beginPath(); ctx.ellipse(0, -r * 0.75, r * 0.22, r * 0.78, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffc3dc'; ctx.beginPath(); ctx.ellipse(0, -r * 0.72, r * 0.1, r * 0.55, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    body(ctx, x, by, r, r * 0.93, '#ffffff', '#e4dcff', '#a99bd9', '#6a5a9c');
    face(ctx, x, by + r * 0.05, r, mood, t, { dark: '#3b2566' });
    ctx.fillStyle = '#ff8fb8'; ctx.beginPath(); ctx.ellipse(x, by + r * 0.24, r * 0.07, r * 0.05, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(x - r * 0.62, by - r * 0.6, r * 0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e4dcff'; ctx.beginPath(); ctx.arc(x - r * 0.54, by - r * 0.66, r * 0.17, 0, TAU); ctx.fill();
  },
  king(ctx, x, y, s, mood, t) {
    const r = s * 0.4, by = y + s * 0.12;
    ctx.fillStyle = '#c3162f'; ctx.beginPath(); ctx.moveTo(x - r * 1.1, by + r * 0.95); ctx.quadraticCurveTo(x - r * 1.2, by - r * 0.2, x - r * 0.6, by - r * 0.3); ctx.lineTo(x + r * 0.6, by - r * 0.3); ctx.quadraticCurveTo(x + r * 1.2, by - r * 0.2, x + r * 1.1, by + r * 0.95); ctx.closePath(); ctx.fill();
    body(ctx, x, by, r, r * 0.9, '#ffc0c8', '#ff4f64', '#c81f3c', '#7d0b22');
    ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.ellipse(x, by + r * 0.8, r * 1.05, r * 0.24, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1b1330'; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(x + i * r * 0.28, by + r * 0.8, r * 0.035, r * 0.06, 0, 0, TAU); ctx.fill(); }
    face(ctx, x, by - r * 0.02, r * 0.85, mood, t, { brows: true });
    ctx.fillStyle = '#5a3217'; ctx.strokeStyle = '#2e170a'; ctx.lineWidth = Math.max(1, r * 0.02);
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x, by + r * 0.2); ctx.quadraticCurveTo(x + sd * r * 0.35, by + r * 0.08, x + sd * r * 0.55, by + r * 0.32); ctx.quadraticCurveTo(x + sd * r * 0.3, by + r * 0.28, x, by + r * 0.3); ctx.fill(); }
    crownShape(ctx, x, by - r * 0.72, r * 1.1, r * 0.7 * (1 + Math.sin(t * 3) * 0.03));
    ctx.strokeStyle = '#c98a00'; ctx.lineWidth = Math.max(2, s * 0.025);
    ctx.beginPath(); ctx.moveTo(x + r * 1.1, by + r * 0.9); ctx.lineTo(x + r * 1.35, by - r * 0.5); ctx.stroke();
    ctx.fillStyle = '#ff4f7b'; ctx.beginPath(); ctx.arc(x + r * 1.37, by - r * 0.58, r * 0.13, 0, TAU); ctx.fill();
  },
  comet(ctx, x, y, s, mood, t) {
    const r = s * 0.33, by = y + s * 0.14;
    const tail = ctx.createLinearGradient(x + r * 2.2, by - r * 1.6, x, by);
    tail.addColorStop(0, 'rgba(120,220,255,0)'); tail.addColorStop(0.6, 'rgba(120,220,255,.55)'); tail.addColorStop(1, 'rgba(230,250,255,.9)');
    ctx.fillStyle = tail;
    ctx.beginPath(); ctx.moveTo(x - r * 0.4, by - r * 0.7); ctx.quadraticCurveTo(x + r * 1.4, by - r * 1.9 + Math.sin(t * 6) * r * 0.1, x + r * 2.4, by - r * 1.8); ctx.quadraticCurveTo(x + r * 1.5, by - r * 0.6, x + r * 0.6, by + r * 0.5); ctx.closePath(); ctx.fill();
    for (const sd of [-1, 1]) {
      ctx.fillStyle = '#5ab8e8'; ctx.strokeStyle = '#1d5b86'; ctx.lineWidth = Math.max(1, r * 0.04);
      ctx.beginPath(); ctx.moveTo(x + sd * r * 0.7, by - r * 0.1); ctx.quadraticCurveTo(x + sd * r * 1.5, by - r * (0.9 + Math.sin(t * 5) * 0.15), x + sd * r * 1.35, by + r * 0.3); ctx.quadraticCurveTo(x + sd * r * 1.1, by + r * 0.05, x + sd * r * 0.8, by + r * 0.35); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff6c9'; ctx.beginPath(); ctx.moveTo(x + sd * r * 0.35, by - r * 0.8); ctx.lineTo(x + sd * r * 0.55, by - r * 1.3); ctx.lineTo(x + sd * r * 0.6, by - r * 0.72); ctx.closePath(); ctx.fill();
    }
    body(ctx, x, by, r, r * 0.95, '#e8fbff', '#62c9ff', '#1c7fc2', '#0d3f66');
    face(ctx, x, by, r, mood, t, { slit: true, pupil: '#0d3f66', brows: true });
    ctx.fillStyle = '#fff';
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + sd * r * 0.12, by + r * 0.38); ctx.lineTo(x + sd * r * 0.2, by + r * 0.52); ctx.lineTo(x + sd * r * 0.28, by + r * 0.38); ctx.fill(); }
  },
};

export const CHARACTER_IDS = Object.keys(CHARS);

// (x, y)를 가운데로 size 크기 상자 안에 그린다
export function drawCharacter(ctx, id, x, y, size, mood = 'idle', t = 0, extra = {}) {
  const fn = CHARS[id] || CHARS.hero;
  ctx.save();
  fn(ctx, x, y, size, mood, t, extra);
  ctx.restore();
}

// 방해뿌요 예고 아이콘: small big rock star moon crown comet
export function drawGarbageIcon(ctx, id, x, y, size, t = 0) {
  ctx.save();
  ctx.translate(x, y);
  const s = size / 2;
  if (id === 'small' || id === 'big') {
    const r = id === 'small' ? s * 0.55 : s * 0.92;
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#fff'); g.addColorStop(0.6, '#cfd8ea'); g.addColorStop(1, '#8e9ab6');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, id === 'small' ? s * 0.3 : 0, r, 0, TAU); ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.1); ctx.strokeStyle = '#566079'; ctx.stroke();
    ctx.fillStyle = '#39405a';
    const oy = id === 'small' ? s * 0.3 : 0;
    ctx.beginPath(); ctx.arc(-r * 0.3, oy - r * 0.05, r * 0.12, 0, TAU); ctx.arc(r * 0.3, oy - r * 0.05, r * 0.12, 0, TAU); ctx.fill();
  } else if (id === 'rock') {
    ctx.beginPath();
    for (let i = 0; i < 9; i++) { const a = i * TAU / 9, rr = s * (0.82 + 0.12 * Math.sin(i * 3.1)); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath();
    const g = ctx.createRadialGradient(-s * 0.3, -s * 0.3, s * 0.1, 0, 0, s);
    g.addColorStop(0, '#d9b58f'); g.addColorStop(0.6, '#94623d'); g.addColorStop(1, '#5a3517');
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = Math.max(1, s * 0.08); ctx.strokeStyle = '#3a200c'; ctx.stroke();
    ctx.fillStyle = 'rgba(58,32,12,.45)';
    for (const [dx, dy, r] of [[-0.3, 0.2, 0.18], [0.35, -0.2, 0.14], [0.2, 0.4, 0.1]]) { ctx.beginPath(); ctx.arc(dx * s, dy * s, r * s, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,150,60,.8)'; ctx.beginPath(); ctx.moveTo(-s * 0.9, -s * 0.5); ctx.lineTo(-s * 0.55, -s * 0.2); ctx.lineTo(-s * 0.7, -s * 0.72); ctx.fill();
  } else if (id === 'star') {
    ctx.rotate(Math.sin(t * 3) * 0.12);
    star(ctx, 0, 0, s * 0.95, '#ffd23f');
    ctx.lineWidth = Math.max(1, s * 0.08); ctx.strokeStyle = '#a86b00'; ctx.stroke();
    ctx.fillStyle = '#7a4b00'; ctx.beginPath(); ctx.arc(-s * 0.2, -s * 0.05, s * 0.08, 0, TAU); ctx.arc(s * 0.2, -s * 0.05, s * 0.08, 0, TAU); ctx.fill();
  } else if (id === 'moon') {
    ctx.fillStyle = '#ffe98a'; ctx.beginPath(); ctx.arc(0, 0, s * 0.9, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(s * 0.42, -s * 0.28, s * 0.75, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = Math.max(1, s * 0.07); ctx.strokeStyle = '#b58a00';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.9, 0.5, 4.1); ctx.stroke();
    ctx.fillStyle = '#7a5a00'; ctx.beginPath(); ctx.arc(-s * 0.45, s * 0.05, s * 0.08, 0, TAU); ctx.fill();
  } else if (id === 'crown') {
    crownShape(ctx, 0, s * 0.6, s * 1.8, s * 1.3);
  } else if (id === 'comet') {
    const g = ctx.createLinearGradient(s, -s, -s * 0.2, s * 0.2);
    g.addColorStop(0, 'rgba(120,220,255,0)'); g.addColorStop(1, 'rgba(160,235,255,.95)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-s * 0.5, s * 0.1); ctx.lineTo(s, -s); ctx.lineTo(-s * 0.1, s * 0.5); ctx.fill();
    ctx.fillStyle = '#e8fbff'; ctx.beginPath(); ctx.arc(-s * 0.35, s * 0.35, s * 0.45, 0, TAU); ctx.fill();
    ctx.lineWidth = Math.max(1, s * 0.08); ctx.strokeStyle = '#3aa2d9'; ctx.stroke();
  }
  ctx.restore();
}
