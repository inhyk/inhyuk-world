import { ATTACKS, FRIENDS } from './core.mjs';
import { SOUL_COLORS, drawSoul } from './presentation.mjs';
const TAU = Math.PI * 2;
const clamp = n => Math.max(0, Math.min(1, n));
function text(ctx, value, y, size = 22, color = '#fff') {
  ctx.font = `${size}px Galmuri11, sans-serif`; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(value, 400, y);
}
export function drawAura(ctx, state, reduced) {
  const t = reduced ? 0 : state.time, final = state.round >= 5;
  ctx.save(); ctx.translate(400, 166);
  for (let ring = 0; ring < 3; ring++) {
    ctx.save(); ctx.rotate(t * (ring % 2 ? -.08 : .1));
    ctx.strokeStyle = final ? '#c98ffd33' : '#89b5f929'; ctx.lineWidth = ring === 2 ? 1 : 2;
    ctx.beginPath(); ctx.ellipse(0, 0, 105 + ring * 38, 105 + ring * 38, 0, 0, TAU); ctx.stroke();
    for (let tick = 0; tick < 12; tick++) {
      ctx.rotate(TAU / 12); ctx.fillStyle = SOUL_COLORS[(tick + ring) % 6]; ctx.globalAlpha = .28;
      ctx.fillRect(-1, -108 - ring * 38, 2, tick % 3 ? 6 : 12);
    }
    ctx.restore();
  }
  if (final) {
    for (let i = 0; i < 6; i++) {
      const angle = t * .22 + i * TAU / 6;
      ctx.globalAlpha = .65; drawSoul(ctx, Math.cos(angle) * 244, Math.sin(angle) * 90, SOUL_COLORS[i], 1.5);
    }
  }
  ctx.restore();
}
export function drawChapter(ctx, state) {
  if (state.mode === 'title') return;
  ctx.save();
  for (let i = 0; i < ATTACKS.length; i++) {
    ctx.fillStyle = i < state.round ? '#a0e6d2' : i === state.round ? '#ffe1a0' : '#4f405f';
    ctx.fillRect(321 + i * 14, 12, 8, 3);
  }
  ctx.font = '10px Galmuri11, sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#b7a6cf';
  ctx.fillText(`구한 기억 ${state.savedFriends.length} / 3`, 24, 24);
  ctx.textAlign = 'right'; ctx.fillText(state.refusals ? '결의는 부서지지 않는다' : 'ONE SOUL · HOLD ON', 776, 24);
  ctx.restore();
}
export function drawMoment(ctx, state, reduced) {
  const mode = state.mode, t = state.elapsed;
  ctx.save();
  if (mode === 'transform') {
    const fade = Math.sin(clamp(t / 3) * Math.PI);
    ctx.fillStyle = `rgba(15,5,28,${fade * .25})`; ctx.fillRect(0, 0, 800, 620);
    for (let i = 0; i < 24; i++) {
      const a = i * TAU / 24, r = reduced ? 170 : 50 + t * 110;
      ctx.strokeStyle = SOUL_COLORS[i % 6] + '77'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(400 + Math.cos(a) * r, 170 + Math.sin(a) * r);
      ctx.lineTo(400 + Math.cos(a) * (r + 55), 170 + Math.sin(a) * (r + 55)); ctx.stroke();
    }
  } else if (mode === 'memory') {
    ctx.fillStyle = '#080810e8'; ctx.fillRect(0, 330, 800, 224);
    const index = state.memoryIndex, c = SOUL_COLORS[index * 2];
    for (let i = 0; i < 2; i++) drawSoul(ctx, 360 + i * 80, 388 - (reduced ? 0 : Math.sin(t * 3) * 5), SOUL_COLORS[index * 2 + i], 3);
    text(ctx, FRIENDS[index].name, 440, 23, c);
    text(ctx, '기억은, 아직 여기 있었다.', 481, 15, '#d7cce7');
    ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(400, 406, 55 + t * 14, 0, TAU); ctx.globalAlpha = clamp(1 - t / 2.6); ctx.stroke();
  } else if (mode === 'refuse') {
    ctx.fillStyle = '#090812f2'; ctx.fillRect(0, 0, 800, 620);
    const gap = t < 1.2 ? (1.2 - t) * 23 : 0;
    ctx.save(); ctx.beginPath(); ctx.rect(350, 265, 50, 80); ctx.clip(); drawSoul(ctx, 400 - gap, 300, '#ff4569', 4); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(400, 265, 50, 80); ctx.clip(); drawSoul(ctx, 400 + gap, 300, '#ff4569', 4); ctx.restore();
    text(ctx, t < 1.2 ? '…' : '하지만, 거부했다.', 384, 28);
    text(ctx, '너의 결의는 아직 남아 있다.', 434, 15, '#c3adf2');
  } else if (mode === 'salvation') {
    ctx.fillStyle = '#090812'; ctx.fillRect(0, 0, 800, 620);
    const radius = 125 * (1 - clamp((t - 3) / 3)) + 22;
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6 + (reduced ? 0 : t * .2);
      ctx.globalAlpha = clamp((7 - t) / 2); drawSoul(ctx, 400 + Math.cos(a) * radius, 245 + Math.sin(a) * radius, SOUL_COLORS[i], 3);
    }
    ctx.globalAlpha = 1; drawSoul(ctx, 400, 245, '#ff4569', 3 + Math.sin(t * 2) * .15);
    const lines = ['누군가의 이름을, 다시 불렀다.', '모든 기억 너머에…', '아스리엘. 너를 잊지 않았어.', '…고마워. 날 포기하지 않아 줘서.'];
    text(ctx, lines[Math.min(3, Math.floor(t / 2))], 420, 23, '#eadbff');
    text(ctx, 'SAVE  /  너에게 닿는 마지막 빛', 472, 11, '#a08cae');
  } else if (state.soul.invincible > .68 && state.soul.invincible <= .85 && !reduced) {
    ctx.strokeStyle = `rgba(255,80,117,${(state.soul.invincible - .68) * 2})`; ctx.lineWidth = 8; ctx.strokeRect(4, 4, 792, 612);
  }
  ctx.restore();
}
