// 엔딩 (인혁이 기획서 10번: 타워가 끝나면). 왕관을 받고, 탑 꼭대기에서 불꽃놀이,
// 층 주인들이 모두 모여 축하하고, 만든 사람 이름이 올라간 뒤 비밀의 혜성이 지나간다.
import { drawCharacter, drawGarbageIcon } from './characters.mjs';
import { Effects } from './effects.mjs';
import { FLOORS } from './tower.mjs';

const TAU = Math.PI * 2;
const FONT = "Jua, 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
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
    ['방해 뿌요는 작은 → 큰 → 운석 → 별 → 달 → 왕관', 20, '#9ff2ff'],
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
    const t = elapsed(now, start);
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
      text(ctx, `${name}, 뿌요뿌요 타워 정복!`, w / 2, h * 0.1, s * 0.07, '#ffe45c', fade(t, 6.4, 12.8));
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

// 엔딩이 시작하고 몇 초 지났는지. 0 보다 작아지지 않는다.
export const elapsed = (now, start) => Math.max(0, (now - start) / 1000);

// 7장, 70초의 혜성 엔딩. 마지막 장면이 다음 보스의 도전으로 이어진다.
export const COMET_ENDING_SECONDS = 70;
// 몇 번째 장면인지 (0 ~ 6). 10초마다 다음 장면.
export const cometScene = t => Math.max(0, Math.min(6, Math.floor(t / 10)));
function playCometEnding(canvas, { name, sound, onDone }) {
  const ctx = canvas.getContext('2d'), fx = new Effects();
  const start = performance.now();
  let raf = 0, stopped = false, lastSpark = 0;
  const chapters = [
    ['혜성 너머, 새로운 친구', '코멧: 네 연쇄가 내 마음까지 밝혔어!', '함께 사라진 별빛을 찾으러 가자.'],
    ['은하수를 건너서', '두 친구는 일곱 빛깔 꼬리를 따라 날아갔어.', '멀리서 작은 별의 목소리가 들렸지.'],
    ['잠들어 버린 별들', '별들은 빛을 잃고 조용히 잠들어 있었어.', '한 사람의 힘만으로는 깨울 수 없었지.'],
    ['우정의 일곱 빛깔 연쇄', '너와 코멧이 힘을 합쳐 큰 연쇄를 만들자…', '별빛이 하나둘 우주로 돌아왔어!'],
    ['타워에 돌아온 영웅들', `${name}, 모두가 너희를 기다렸어!`, '이제 코멧도 우리 타워의 소중한 친구야.'],
    ['별의 문이 열리다', '그때, 가장 먼 하늘에서 새로운 빛이 나타났어.', '노바: 별을 깨운 친구들, 나에게 와 보겠니?'],
    ['우주의 친구들', '혜성의 모험은 끝! 다음 모험은 초신성 층에서.', `기획 · 서인혁 / 고마워, ${name}!`],
  ];
  function resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(canvas.clientWidth * dpr); canvas.height = Math.round(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function frame(now) {
    if (stopped) return;
    // 첫 그림의 시각(now)이 시작 시각보다 조금 앞설 수 있다(단추를 누른 바로 그 화면에서 그릴 때).
    // 그러면 장면 번호가 -1 이 되어 마지막 장면의 글만 찍히고 멈췄다 (인혁이 기획서 2026-10-10 4번).
    const t = elapsed(now, start), scene = cometScene(t), local = t % 10;
    const w = canvas.clientWidth, h = canvas.clientHeight, s = Math.min(w, h);
    canvas.dataset.chapter = String(scene + 1);
    sky(ctx, w, h, scene === 4 ? '#322b66' : '#070b27', scene === 5 ? '#437d79' : '#48366f');
    stars(ctx, w, h, t, 140);
    const alpha = fade(local, 0, 10, .8);
    ctx.save(); ctx.globalAlpha = alpha;
    if (scene === 0) {
      drawCharacter(ctx, 'hero', w * .3, h * .52, s * .3, 'happy', t, { crown: true });
      drawCharacter(ctx, 'comet', w * .7, h * .51, s * .4, 'happy', t);
    } else if (scene === 1) {
      const x = w * (.2 + local / 10 * .6), y = h * .5 - Math.sin(local / 10 * Math.PI) * s * .1;
      for (let i = 0; i < 7; i++) { ctx.strokeStyle = ['#ffb2d7', '#ffe79e', '#a7ffdf', '#a7e8ff', '#c9b4ff'][i % 5] + '88'; ctx.lineWidth = s * .012; ctx.beginPath(); ctx.moveTo(x, y + i * s * .015); ctx.quadraticCurveTo(x - s * .3, y + s * .12, x - s * .7, y + i * s * .03); ctx.stroke(); }
      drawCharacter(ctx, 'comet', x, y, s * .34, 'happy', t);
      drawCharacter(ctx, 'hero', x, y - s * .13, s * .19, 'happy', t, { crown: true });
    } else if (scene === 2 || scene === 3) {
      for (let i = 0; i < 7; i++) {
        ctx.save(); ctx.globalAlpha = alpha * (scene === 2 ? .2 + .15 * Math.sin(t + i) : Math.min(1, .2 + local / 5));
        drawGarbageIcon(ctx, 'star', w * (.12 + i * .126), h * .36 + Math.sin(i * 1.7 + t) * s * .06, s * .09, t); ctx.restore();
      }
      drawCharacter(ctx, 'hero', w * .35, h * .59, s * .24, scene === 2 ? 'sad' : 'attack', t, { crown: true });
      drawCharacter(ctx, 'comet', w * .65, h * .56, s * .3, scene === 2 ? 'sad' : 'attack', t);
      if (scene === 3 && t - lastSpark > .55) { lastSpark = t; fx.pop('nova', w * (.15 + Math.random() * .7), h * .36, 4, s * .12, 7); sound?.sfx('pop', 1 + Math.floor(local) % 7); }
    } else if (scene === 4) {
      tower(ctx, w / 2, h * .69, s * .3, s * .045, t);
      // 탑 양옆에 세 명씩 서고 코멧은 오른쪽 위를 난다. 서로도, 탑 위의 주인공도 가리지 않는 자리.
      const spots = [[-.4, .06], [-.27, -.02], [-.4, -.14], [.27, -.02], [.4, .06], [.4, -.14], [.24, -.25]];
      FLOORS.slice(0, 7).forEach((f, i) => {
        drawCharacter(ctx, f.char, w / 2 + spots[i][0] * s, h * .6 + spots[i][1] * s, s * .13, 'happy', t + i);
      });
      drawCharacter(ctx, 'hero', w / 2, h * .69 - s * .33, s * .2, 'happy', t, { crown: true });
      if (t - lastSpark > .6) { lastSpark = t; fx.pop('confetti', w * (.15 + Math.random() * .7), h * .28, 1, s * .15, 6); sound?.sfx('burst'); }
    } else if (scene === 5) {
      // 별의 문 고리는 제목 글자를 가리지 않는 크기로
      for (let i = 0; i < 4; i++) { ctx.strokeStyle = ['#bb9bff', '#a7ffdd'][i % 2]; ctx.lineWidth = s * .006; ctx.beginPath(); ctx.ellipse(w / 2, h * .47, s * (.2 + i * .018), s * (.215 + i * .018), t * .05, 0, TAU); ctx.stroke(); }
      drawCharacter(ctx, 'nova', w / 2, h * .45, s * .36 * Math.min(1, .4 + local / 4), 'idle', t);
      drawCharacter(ctx, 'hero', w * .23, h * .65, s * .16, 'happy', t, { crown: true });
      drawCharacter(ctx, 'comet', w * .77, h * .62, s * .2, 'happy', t);
    } else {
      drawCharacter(ctx, 'hero', w * .35, h * .43, s * .26, 'happy', t, { crown: true });
      drawCharacter(ctx, 'comet', w * .65, h * .4, s * .3, 'happy', t);
      text(ctx, 'COMET STORY · END', w / 2, h * .63, s * .045, '#aaffec');
      text(ctx, '★ 초신성 층이 열렸어 · 별의 수호자 노바 ★', w / 2, h * .71, s * .035, '#ffe9a7');
    }
    ctx.restore();
    const [title, line1, line2] = chapters[scene];
    text(ctx, `${scene + 1} / 7`, w / 2, h * .07, s * .026, '#d6c6ff', alpha);
    text(ctx, title, w / 2, h * .15, s * .058, '#ffe7a5', alpha);
    text(ctx, line1, w / 2, h * .82, s * .036, '#fff', alpha);
    text(ctx, line2, w / 2, h * .89, s * .033, '#b4f6ff', alpha);
    fx.update(); fx.draw(ctx);
    if (t >= COMET_ENDING_SECONDS) { stop(); onDone?.(); return; }
    raf = requestAnimationFrame(frame);
  }
  function stop() { stopped = true; cancelAnimationFrame(raf); removeEventListener('resize', resize); }
  resize(); addEventListener('resize', resize); raf = requestAnimationFrame(frame);
  return stop;
}
