// 펫과 알 그림. 다른 그림처럼 모두 코드로 직접 그린다 (인혁이 기획서 「뿌요뿌요 (업그레이드)」 1번 그림).
// drawPet(ctx, id, cx, cy, size, t, owned): size 는 대략 그림의 폭. owned 가 false 인 비밀 펫(???)은 물음표 그림자로 그린다.
const TAU = Math.PI * 2;

function ellipse(ctx, x, y, rx, ry, fill, stroke, lw = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function eyes(ctx, s, y, gap, r, blink) {
  for (const dx of [-gap, gap]) {
    if (blink) { ctx.strokeStyle = '#2a1640'; ctx.lineWidth = s * 0.03; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(dx - r, y); ctx.lineTo(dx + r, y); ctx.stroke(); continue; }
    ellipse(ctx, dx, y, r, r * 1.15, '#2a1640');
    ellipse(ctx, dx - r * 0.3, y - r * 0.4, r * 0.35, r * 0.35, '#fff');
  }
}
function blush(ctx, s, y, gap) {
  for (const dx of [-gap, gap]) ellipse(ctx, dx, y, s * 0.07, s * 0.045, 'rgba(255, 120, 150, .55)');
}

function dog(ctx, s, t, blink) {
  const wag = Math.sin(t * 9) * 0.35;
  // 꼬리
  ctx.save(); ctx.translate(s * 0.3, s * 0.2); ctx.rotate(-0.6 + wag);
  ellipse(ctx, s * 0.1, 0, s * 0.13, s * 0.05, '#c98a4b'); ctx.restore();
  // 귀
  for (const side of [-1, 1]) { ctx.save(); ctx.translate(side * s * 0.3, -s * 0.2); ctx.rotate(side * (0.35 + Math.sin(t * 3) * 0.05)); ellipse(ctx, 0, s * 0.1, s * 0.1, s * 0.2, '#8a5a2b'); ctx.restore(); }
  ellipse(ctx, 0, 0, s * 0.36, s * 0.34, '#e2a869', '#8a5a2b', s * 0.025);
  ellipse(ctx, 0, s * 0.1, s * 0.19, s * 0.15, '#fff3dc');
  eyes(ctx, s, -s * 0.06, s * 0.14, s * 0.045, blink);
  ellipse(ctx, 0, s * 0.05, s * 0.05, s * 0.036, '#2a1640');
  ctx.strokeStyle = '#2a1640'; ctx.lineWidth = s * 0.022; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, s * 0.08); ctx.lineTo(0, s * 0.13); ctx.moveTo(-s * 0.06, s * 0.14); ctx.quadraticCurveTo(0, s * 0.19, s * 0.06, s * 0.14); ctx.stroke();
  ellipse(ctx, 0, s * 0.19, s * 0.035, s * 0.045, '#ff7d9c');
  blush(ctx, s, s * 0.06, s * 0.25);
}

function cat(ctx, s, t, blink) {
  // 꼬리
  ctx.strokeStyle = '#8f8aa8'; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(s * 0.26, s * 0.24); ctx.quadraticCurveTo(s * 0.48, s * 0.2 + Math.sin(t * 4) * s * 0.06, s * 0.42, -s * 0.02); ctx.stroke();
  // 뾰족 귀
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(side * s * 0.33, -s * 0.12); ctx.lineTo(side * s * 0.3, -s * 0.42); ctx.lineTo(side * s * 0.08, -s * 0.28); ctx.closePath();
    ctx.fillStyle = '#b8b3cc'; ctx.fill(); ctx.strokeStyle = '#6d6887'; ctx.lineWidth = s * 0.025; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(side * s * 0.28, -s * 0.18); ctx.lineTo(side * s * 0.27, -s * 0.34); ctx.lineTo(side * s * 0.15, -s * 0.26); ctx.closePath();
    ctx.fillStyle = '#ffb5c8'; ctx.fill();
  }
  ellipse(ctx, 0, 0, s * 0.36, s * 0.32, '#cfcbe0', '#6d6887', s * 0.025);
  eyes(ctx, s, -s * 0.04, s * 0.15, s * 0.05, blink);
  ctx.fillStyle = '#ff7d9c'; ctx.beginPath(); ctx.moveTo(-s * 0.035, s * 0.06); ctx.lineTo(s * 0.035, s * 0.06); ctx.lineTo(0, s * 0.1); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#2a1640'; ctx.lineWidth = s * 0.02; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, s * 0.1); ctx.quadraticCurveTo(-s * 0.05, s * 0.17, -s * 0.1, s * 0.13); ctx.moveTo(0, s * 0.1); ctx.quadraticCurveTo(s * 0.05, s * 0.17, s * 0.1, s * 0.13);
  for (const side of [-1, 1]) for (const dy of [0.05, 0.11]) { ctx.moveTo(side * s * 0.2, s * dy); ctx.lineTo(side * s * 0.4, s * (dy - 0.02 + (dy > 0.1 ? 0.05 : 0))); }
  ctx.stroke();
  blush(ctx, s, s * 0.09, s * 0.24);
}

// 키보드 키캡 (인혁이의 다른 게임 「키캡 타워」에서 온 친구). big: 왕관을 쓴 황금 큰 키캡
function keycap(ctx, s, t, blink, big) {
  const w = s * (big ? 0.78 : 0.62), h = s * (big ? 0.66 : 0.54), top = big ? ['#ffe27a', '#ffb52e', '#b36b00'] : ['#9be7ff', '#4fb4f2', '#1f6aa8'];
  // 옆면
  roundRect(ctx, -w / 2, -h / 2 + s * 0.08, w, h, s * 0.1); ctx.fillStyle = top[2]; ctx.fill();
  // 윗면
  roundRect(ctx, -w / 2 + s * 0.04, -h / 2, w - s * 0.08, h - s * 0.06, s * 0.09);
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, top[0]); g.addColorStop(1, top[1]);
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = top[2]; ctx.lineWidth = s * 0.025; ctx.stroke();
  // 반짝
  ctx.fillStyle = 'rgba(255,255,255,.55)'; roundRect(ctx, -w / 2 + s * 0.1, -h / 2 + s * 0.05, w * 0.3, s * 0.05, s * 0.025); ctx.fill();
  eyes(ctx, s, -s * 0.02, s * 0.13, s * 0.042, blink);
  ctx.strokeStyle = '#2a1640'; ctx.lineWidth = s * 0.022; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-s * 0.06, s * 0.08); ctx.quadraticCurveTo(0, s * 0.14, s * 0.06, s * 0.08); ctx.stroke();
  blush(ctx, s, s * 0.07, s * 0.21);
  if (big) {
    // 왕관
    const cy = -h / 2 - s * 0.02 + Math.sin(t * 3) * s * 0.008;
    ctx.beginPath(); ctx.moveTo(-s * 0.2, cy); ctx.lineTo(-s * 0.22, cy - s * 0.17); ctx.lineTo(-s * 0.1, cy - s * 0.08); ctx.lineTo(0, cy - s * 0.2); ctx.lineTo(s * 0.1, cy - s * 0.08); ctx.lineTo(s * 0.22, cy - s * 0.17); ctx.lineTo(s * 0.2, cy); ctx.closePath();
    ctx.fillStyle = '#fff1a8'; ctx.fill(); ctx.strokeStyle = '#b36b00'; ctx.lineWidth = s * 0.022; ctx.lineJoin = 'round'; ctx.stroke();
    for (const [dx, c] of [[-0.11, '#ff5fa2'], [0, '#5fd0ff'], [0.11, '#7bea7b']]) ellipse(ctx, s * dx, cy - s * 0.035, s * 0.025, s * 0.025, c);
  }
}

// ???: 뽑기 전에는 물음표 그림자, 뽑으면 무지개 드래곤
function mystery(ctx, s, t, blink, owned) {
  if (!owned) {
    ellipse(ctx, 0, 0, s * 0.36, s * 0.34, '#3a2a6e', '#8a5cff', s * 0.025);
    ctx.fillStyle = '#c9b8ff'; ctx.font = `${Math.round(s * 0.42)}px Jua, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', 0, s * 0.02 + Math.sin(t * 2) * s * 0.01);
    return;
  }
  const rainbow = ['#ff5f6d', '#ffb13b', '#ffe45c', '#5fe38a', '#5fb8ff', '#b77bff'];
  // 날개
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(side * s * 0.28, -s * 0.05); ctx.rotate(side * (0.3 + Math.sin(t * 6) * 0.25));
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(side * s * 0.3, -s * 0.3, side * s * 0.34, s * 0.02); ctx.quadraticCurveTo(side * s * 0.2, -s * 0.02, side * s * 0.16, s * 0.1); ctx.quadraticCurveTo(side * s * 0.08, s * 0.02, 0, s * 0.08); ctx.closePath();
    ctx.fillStyle = '#b6f0ff'; ctx.fill(); ctx.strokeStyle = '#5fb8ff'; ctx.lineWidth = s * 0.02; ctx.stroke(); ctx.restore();
  }
  // 무지개 몸
  ctx.save();
  ctx.beginPath(); ctx.ellipse(0, 0.02 * s, s * 0.33, s * 0.31, 0, 0, TAU); ctx.clip();
  const shift = (t * 0.25) % 1;
  for (let i = -1; i < rainbow.length + 1; i++) { ctx.fillStyle = rainbow[(i + rainbow.length) % rainbow.length]; ctx.fillRect(-s * 0.4, (-0.33 + (i + shift) * 0.115) * s, s * 0.8, s * 0.12); }
  ctx.restore();
  ellipse(ctx, 0, 0.02 * s, s * 0.33, s * 0.31, null, '#5b3bb3', s * 0.025);
  // 뿔
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * s * 0.12, -s * 0.26); ctx.lineTo(side * s * 0.2, -s * 0.44); ctx.lineTo(side * s * 0.24, -s * 0.22); ctx.closePath(); ctx.fillStyle = '#fff1a8'; ctx.fill(); ctx.strokeStyle = '#b36b00'; ctx.lineWidth = s * 0.02; ctx.lineJoin = 'round'; ctx.stroke(); }
  ellipse(ctx, 0, s * 0.1, s * 0.17, s * 0.12, 'rgba(255,255,255,.85)');
  eyes(ctx, s, -s * 0.04, s * 0.13, s * 0.048, blink);
  for (const dx of [-0.04, 0.04]) ellipse(ctx, s * dx, s * 0.08, s * 0.012, s * 0.016, '#2a1640');
  ctx.strokeStyle = '#2a1640'; ctx.lineWidth = s * 0.02; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-s * 0.07, s * 0.13); ctx.quadraticCurveTo(0, s * 0.19, s * 0.07, s * 0.13); ctx.stroke();
  // 별 반짝
  for (let i = 0; i < 4; i++) {
    const a = t * 1.5 + i * (TAU / 4), r = s * 0.46;
    ctx.fillStyle = rainbow[(i * 2) % rainbow.length]; ctx.globalAlpha = 0.6 + Math.sin(t * 5 + i) * 0.4;
    ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r * 0.8, s * 0.022, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawPet(ctx, id, cx, cy, size, t = 0, owned = true) {
  ctx.save();
  ctx.translate(cx, cy + Math.sin(t * 2.4) * size * 0.02);
  if (!owned && id !== 'mystery') ctx.globalAlpha = 0.45; // 아직 없는 펫은 흐리게
  const blink = owned && (t % 3.4) > 3.25;
  if (id === 'dog') dog(ctx, size, t, blink);
  else if (id === 'cat') cat(ctx, size, t, blink);
  else if (id === 'keycap') keycap(ctx, size, t, blink, false);
  else if (id === 'bigkeycap') keycap(ctx, size, t, blink, true);
  else mystery(ctx, size, t, blink, owned);
  ctx.restore();
}

// 알. shake: 0~1 흔들림, crack: 0~1 금 간 정도, open: 0~1 깨져서 벌어진 정도
export function drawEgg(ctx, cx, cy, size, t = 0, { shake = 0, crack = 0, open = 0 } = {}) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(t * 26) * 0.16 * shake + Math.sin(t * 1.6) * 0.03);
  const rx = size * 0.34, ry = size * 0.44;
  // 달걀 모양: 위쪽 반은 길쭉하고 아래쪽 반은 통통하다
  const mid = ry * 0.18;
  const shell = () => {
    ctx.beginPath();
    ctx.ellipse(0, mid, rx, ry + mid, 0, Math.PI, 0);
    ctx.ellipse(0, mid, rx, ry - mid, 0, 0, Math.PI);
    ctx.closePath();
  };
  const paint = () => {
    const g = ctx.createRadialGradient(-rx * 0.3, -ry * 0.35, size * 0.03, 0, 0, ry * 1.1);
    g.addColorStop(0, '#fffdf2'); g.addColorStop(1, '#ffe2a8');
    shell(); ctx.fillStyle = g; ctx.fill();
    // 물방울 무늬
    ctx.save(); shell(); ctx.clip();
    for (const [dx, dy, r, c] of [[-0.14, -0.12, 0.07, '#ff9ec4'], [0.15, 0.02, 0.085, '#9bd4ff'], [-0.08, 0.2, 0.075, '#b9f0a0'], [0.1, -0.26, 0.05, '#d7b8ff'], [0.2, 0.3, 0.06, '#ffd36b']]) ellipse(ctx, size * dx, size * dy, size * r, size * r, c);
    ctx.restore();
    shell(); ctx.strokeStyle = '#c98a2b'; ctx.lineWidth = size * 0.02; ctx.stroke();
  };
  if (open > 0) {
    // 위아래로 갈라진다
    ctx.save(); ctx.beginPath(); ctx.rect(-size, -size - open * size * 0.02, size * 2, size); ctx.clip(); ctx.translate(0, -open * size * 0.3); ctx.rotate(-open * 0.25); paint(); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(-size, 0, size * 2, size); ctx.clip(); ctx.translate(0, open * size * 0.06); paint(); ctx.restore();
  } else paint();
  if (crack > 0 && open <= 0) {
    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = size * 0.018; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const pts = [[-0.3, 0], [-0.2, -0.05], [-0.12, 0.04], [-0.03, -0.05], [0.06, 0.04], [0.15, -0.04], [0.23, 0.03], [0.3, -0.01]];
    const n = Math.max(2, Math.round(pts.length * crack));
    ctx.beginPath(); pts.slice(0, n).forEach(([x, y], i) => (i ? ctx.lineTo(size * x, size * y) : ctx.moveTo(size * x, size * y))); ctx.stroke();
  }
  ctx.restore();
}
