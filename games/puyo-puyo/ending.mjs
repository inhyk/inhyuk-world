// 엔딩 (인혁이 기획서 10번: 타워가 끝나면). 왕관을 받고, 탑 꼭대기에서 불꽃놀이,
// 층 주인들이 모두 모여 축하하고, 만든 사람 이름이 올라간 뒤 비밀의 혜성이 지나간다.
import { drawCharacter, drawGarbageIcon } from './characters.mjs';
import { Effects } from './effects.mjs';
import { FLOORS } from './tower.mjs';

const TAU = Math.PI * 2;
const FONT = "Jua, 'Noto Sans KR', sans-serif";
const LENGTH = 40;

function sky(ctx, w, h, top, bottom) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}
function stars(ctx, w, h, t, n = 90) {
  for (let i = 0; i < n; i++) {
    const x = (i * 97.3 % 100) / 100 * w, y = (i * 53.7 % 100) / 100 * h * 0.75;
    ctx.fillStyle = `rgba(255,255,240,${0.3 + 0.7 * Math.abs(Math.sin(t * 1.3 + i))})`;
    ctx.beginPath(); ctx.arc(x, y, 1 + (i % 3) * 0.5, 0, TAU); ctx.fill();
  }
}
function text(ctx, str, x, y, size, color = '#fff', alpha = 1) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.font = `${Math.round(size)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.18; ctx.strokeStyle = 'rgba(30,10,60,.85)'; ctx.strokeText(str, x, y);
  ctx.fillStyle = color; ctx.fillText(str, x, y);
  ctx.restore();
}
const fade = (t, a, b, edge = 0.6) => Math.min(1, Math.max(0, (t - a) / edge), Math.max(0, (b - t) / edge));

function tower(ctx, x, base, w, floorH, t) {
  const icons = ['small', 'big', 'rock', 'star', 'moon', 'crown'];
  for (let i = 0; i < 6; i++) {
    const y = base - (i + 1) * floorH, fw = w * (1 - i * 0.07);
    const g = ctx.createLinearGradient(x - fw / 2, 0, x + fw / 2, 0);
    g.addColorStop(0, '#6d4ca8'); g.addColorStop(0.5, '#a88be0'); g.addColorStop(1, '#5b3c93');
    ctx.fillStyle = g; ctx.fillRect(x - fw / 2, y, fw, floorH - 3);
    ctx.fillStyle = 'rgba(255,240,180,.85)';
    for (const k of [-1, 1]) ctx.fillRect(x + k * fw * 0.3 - floorH * 0.12, y + floorH * 0.25, floorH * 0.24, floorH * 0.4);
    drawGarbageIcon(ctx, icons[i], x, y + floorH * 0.5, floorH * 0.6, t);
  }
}

export function playEnding(canvas, { name = '나', sound, onDone } = {}) {
  const ctx = canvas.getContext('2d');
  const fx = new Effects();
  let raf = 0, start = performance.now(), stopped = false, lastBoom = 0, lastSpark = 0;
  const bosses = FLOORS.slice(0, 6);
  const credits = [
    ['뿌요뿌요 타워', 44, '#ffe45c'],
    ['', 20],
    ['기획 · 서인혁', 30, '#fff'],
    ['(손으로 쓴 기획서 12가지를 전부 넣었어!)', 18, '#d9ccff'],
    ['', 20],
    ['만든 곳 · 인혁 월드 seonn.dev', 26, '#fff'],
    ['', 20],
    ['함께한 층 주인들', 30, '#ffb3d9'],
    ...bosses.map(f => [`${f.floor}층 ${f.name} · ${f.boss}`, 22, '#fff']),
    ['', 20],
    ['방해뿌요는 작은 → 큰 → 운석 → 별 → 달 → 왕관', 20, '#9ff2ff'],
    ['', 20],
    [`그리고 타워를 정복한 ${name}!`, 30, '#ffe45c'],
    ['', 30],
    ['플레이해 줘서 고마워!', 34, '#fff'],
  ];

  function resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  addEventListener('resize', resize);

  function frame(now) {
    if (stopped) return;
    const t = (now - start) / 1000;
    const w = canvas.clientWidth, h = canvas.clientHeight, s = Math.min(w, h);
    ctx.clearRect(0, 0, w, h);
    if (t < 6) {
      // 1. 왕관을 건네받는다
      sky(ctx, w, h, '#5a1020', '#c93a4e');
      for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(255,210,120,.18)'; ctx.fillRect((i + 0.5) * w / 6 - 22, 0, 44, h); }
      const kingX = w * 0.68, heroX = w * 0.32, y = h * 0.58;
      drawCharacter(ctx, 'king', kingX, y, s * 0.42, 'sad', t);
      const k = Math.min(1, Math.max(0, (t - 2.2) / 2));
      const cx = kingX + (heroX - kingX) * k, cy = y - s * 0.28 - Math.sin(k * Math.PI) * s * 0.18;
      drawCharacter(ctx, 'hero', heroX, y + s * 0.05, s * 0.3, k >= 1 ? 'happy' : 'idle', t, { crown: k >= 1 });
      if (k < 1) drawGarbageIcon(ctx, 'crown', cx, cy, s * 0.13, t);
      if (k >= 1 && t - lastSpark > 0.15) { lastSpark = t; fx.pop('star', heroX, y - s * 0.12, 4, s * 0.12, 3); }
      text(ctx, '뿌요 대왕: 훌륭하다…! 이 왕관은 이제 너의 것이다!', w / 2, h * 0.14, s * 0.045, '#fff', fade(t, 0.3, 5.8));
    } else if (t < 13) {
      // 2. 탑 꼭대기의 새벽, 불꽃놀이
      const k = (t - 6) / 7;
      sky(ctx, w, h, `rgb(${40 + k * 140},${30 + k * 90},${90 + k * 60})`, `rgb(${255},${150 + k * 60},${120 + k * 40})`);
      stars(ctx, w, h, t, Math.round(80 * (1 - k)));
      const floorH = s * 0.075, base = h * 0.98;
      tower(ctx, w / 2, base, s * 0.42, floorH, t);
      drawCharacter(ctx, 'hero', w / 2, base - floorH * 6 - s * 0.1, s * 0.22, 'happy', t, { crown: true });
      if (t - lastBoom > 0.45) {
        lastBoom = t;
        fx.pop('firework', w * (0.15 + Math.random() * 0.7), h * (0.12 + Math.random() * 0.3), 1 + ((Math.random() * 5) | 0), s * 0.2, 6);
        sound?.sfx('burst');
      }
      text(ctx, `${name}, 뿌요 타워 정복!`, w / 2, h * 0.1, s * 0.07, '#ffe45c', fade(t, 6.4, 12.8));
    } else if (t < 20) {
      // 3. 층 주인들이 모두 모여 축하
      sky(ctx, w, h, '#ffb3d9', '#9fe3ff');
      const n = bosses.length;
      bosses.forEach((f, i) => {
        const x = w * (0.1 + (i / (n - 1)) * 0.8), hop = Math.abs(Math.sin(t * 5 + i)) * s * 0.03;
        drawCharacter(ctx, f.char, x, h * 0.7 - hop, s * 0.2, 'happy', t + i);
      });
      drawCharacter(ctx, 'hero', w / 2, h * 0.42, s * 0.24, 'happy', t, { crown: true });
      if (t - lastSpark > 0.2) { lastSpark = t; fx.pop(['heart', 'star', 'petal', 'note'][(t * 5 | 0) % 4], w * Math.random(), h * 0.6, 1 + ((Math.random() * 5) | 0), s * 0.12, 3); }
      text(ctx, `모두가 ${name}의 승리를 축하했어!`, w / 2, h * 0.14, s * 0.055, '#fff', fade(t, 13.3, 19.8));
    } else if (t < 34) {
      // 4. 만든 사람들
      sky(ctx, w, h, '#0c0620', '#241457');
      stars(ctx, w, h, t);
      for (let i = 0; i < 14; i++) {
        const x = (i * 71 % 100) / 100 * w, y = ((t * 40 + i * 83) % (h + 80)) - 40;
        drawGarbageIcon(ctx, ['small', 'big', 'rock', 'star', 'moon', 'crown'][i % 6], x, y, s * 0.04, t);
      }
      const k = (t - 20) / 14;
      let y = h * 1.05 - k * (h * 1.05 + credits.length * s * 0.075);
      for (const [str, size, color] of credits) {
        if (str) text(ctx, str, w / 2, y, Math.min(size * s / 700, size), color);
        y += s * 0.075;
      }
    } else {
      // 5. 끝, 그리고 비밀의 혜성
      sky(ctx, w, h, '#0c0620', '#1c1a4a');
      stars(ctx, w, h, t);
      drawCharacter(ctx, 'hero', w / 2, h * 0.5, s * 0.3, 'happy', t, { crown: true });
      text(ctx, 'THE END', w / 2, h * 0.2, s * 0.1, '#ffe45c', fade(t, 34.2, 60));
      const c = Math.min(1, (t - 36) / 2.5);
      if (c > 0) {
        const x = w * (1.1 - c * 1.3), cy = h * (0.1 + c * 0.25);
        const g = ctx.createLinearGradient(x, cy, x + s * 0.3, cy - s * 0.12);
        g.addColorStop(0, 'rgba(200,245,255,.95)'); g.addColorStop(1, 'rgba(120,220,255,0)');
        ctx.strokeStyle = g; ctx.lineWidth = s * 0.02; ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + s * 0.3, cy - s * 0.12); ctx.stroke();
        ctx.fillStyle = '#eafcff'; ctx.beginPath(); ctx.arc(x, cy, s * 0.018, 0, TAU); ctx.fill();
        text(ctx, '…그런데 탑 너머 하늘에 혜성이 반짝인다!', w / 2, h * 0.8, s * 0.04, '#9ff2ff', fade(t, 36.5, 60));
        text(ctx, '★ 비밀의 혜성 층이 열렸어 ★', w / 2, h * 0.88, s * 0.035, '#ffe45c', fade(t, 37.5, 60));
      }
    }
    fx.update();
    fx.draw(ctx);
    if (t >= LENGTH) { stop(); onDone?.(); return; }
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    stopped = true;
    cancelAnimationFrame(raf);
    removeEventListener('resize', resize);
  }
  raf = requestAnimationFrame(frame);
  return stop;
}
