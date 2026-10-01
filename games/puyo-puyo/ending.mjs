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

export function playEnding(canvas, { name = '나', kind = 'crown', sound, onDone } = {}) {
  if (kind === 'comet') return playCometEnding(canvas, { name, sound, onDone });
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

// 두 번째 엔딩: 혜성 드래곤과 친구가 되어 별빛을 되찾고 타워로 돌아온다.
function playCometEnding(canvas, { name, sound, onDone }) {
  const ctx = canvas.getContext('2d'), fx = new Effects();
  const start = performance.now();
  let raf = 0, stopped = false, lastSpark = 0;
  function resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function frame(now) {
    if (stopped) return;
    const t = (now - start) / 1000;
    const w = canvas.clientWidth, h = canvas.clientHeight, s = Math.min(w, h);
    sky(ctx, w, h, '#070b27', t < 13 ? '#382065' : '#60549e');
    stars(ctx, w, h, t, 160);
    if (t < 6) {
      const glow = ctx.createRadialGradient(w / 2, h * .55, 0, w / 2, h * .55, s * .6);
      glow.addColorStop(0, '#68dfff55'); glow.addColorStop(1, '#68dfff00');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
      drawCharacter(ctx, 'hero', w * .3, h * .58, s * .3, 'happy', t, { crown: true });
      drawCharacter(ctx, 'comet', w * .7, h * .55, s * .44, 'happy', t);
      text(ctx, '혜성 너머, 새로운 친구', w / 2, h * .15, s * .065, '#a7f3ff', fade(t, .2, 6));
      text(ctx, '코멧: 네 연쇄가 내 마음까지 밝혔어!', w / 2, h * .79, s * .039, '#fff', fade(t, 1, 6));
      text(ctx, '함께 우주의 별빛을 되찾으러 가자!', w / 2, h * .86, s * .037, '#ffe58d', fade(t, 2, 6));
    } else if (t < 13) {
      const k = (t - 6) / 7, x = w * (.2 + k * .6), y = h * (.62 - Math.sin(k * Math.PI) * .17);
      for (let i = 0; i < 5; i++) {
        ctx.strokeStyle = ['#96eeff88', '#b5a2ff88', '#ffa9d688', '#ffed9b88', '#9affd288'][i];
        ctx.lineWidth = s * .012; ctx.beginPath();
        ctx.moveTo(x - s * .08, y + i * s * .016);
        ctx.quadraticCurveTo(x - s * .25, y + s * .1, x - s * .6, y + s * .15 + i * s * .02); ctx.stroke();
      }
      drawCharacter(ctx, 'comet', x, y, s * .37, 'happy', t);
      drawCharacter(ctx, 'hero', x, y - s * .14, s * .2, 'happy', t, { crown: true });
      for (let i = 0; i < 7; i++) drawGarbageIcon(ctx, 'star', w * (.1 + i * .13), h * .28 + Math.sin(t + i) * s * .05, s * .05, t);
      text(ctx, '일곱 빛깔 연쇄가 우주를 밝히고…', w / 2, h * .13, s * .048, '#ffe58d', fade(t, 6.2, 13));
      text(ctx, '작은 뿌요의 용기가 별들까지 닿았어.', w / 2, h * .83, s * .038, '#d3faff', fade(t, 7, 13));
    } else if (t < 21) {
      const base = h * .92, floorH = s * .05;
      tower(ctx, w / 2, base, s * .36, floorH, t);
      FLOORS.forEach((floor, i) => {
        const angle = Math.PI + i / 6 * Math.PI;
        drawCharacter(ctx, floor.char, w / 2 + Math.cos(angle) * s * .37, h * .53 + Math.sin(angle) * s * .16,
          s * .135, 'happy', t + i);
      });
      drawCharacter(ctx, 'hero', w / 2, base - floorH * 6 - s * .08, s * .22, 'happy', t, { crown: true });
      text(ctx, `${name}, 우주까지 정복!`, w / 2, h * .12, s * .062, '#ffe58d', fade(t, 13.2, 21));
      text(ctx, '이제 코멧도 우리 타워의 친구야!', w / 2, h * .22, s * .04, '#d3faff', fade(t, 14, 21));
      if (t - lastSpark > .5) {
        lastSpark = t; fx.pop('firework', w * (.15 + Math.random() * .7), h * (.25 + Math.random() * .3), 1 + (t | 0) % 5, s * .16, 6);
        sound?.sfx('burst');
      }
    } else {
      drawGarbageIcon(ctx, 'comet', w / 2, h * .39, s * .23, t);
      text(ctx, 'THE TRUE END', w / 2, h * .14, s * .075, '#a7f3ff', fade(t, 21.2, 32));
      text(ctx, '우주의 친구들', w / 2, h * .24, s * .05, '#ffe58d', fade(t, 21.6, 32));
      text(ctx, '🌟', w / 2, h * .53, s * .05, '#ffe58d');
      text(ctx, '혜성 꼬리 효과와 함께 모험은 계속돼!', w / 2, h * .63, s * .038, '#fff', fade(t, 22, 32));
      text(ctx, '기획 · 서인혁', w / 2, h * .73, s * .039, '#ffb9dd', fade(t, 23, 32));
      text(ctx, `끝까지 함께해 줘서 고마워, ${name}!`, w / 2, h * .82, s * .037, '#fff', fade(t, 24, 32));
    }
    fx.update(); fx.draw(ctx);
    if (t >= 30) { stop(); onDone?.(); return; }
    raf = requestAnimationFrame(frame);
  }
  function stop() { stopped = true; cancelAnimationFrame(raf); removeEventListener('resize', resize); }
  resize(); addEventListener('resize', resize);
  raf = requestAnimationFrame(frame);
  return stop;
}
