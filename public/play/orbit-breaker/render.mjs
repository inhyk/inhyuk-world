const TAU = Math.PI * 2;
const C = '#caf879';

function polygon(ctx, points, fill, stroke, width = 1) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function circle(ctx, x, y, r, fill) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = fill; ctx.fill();
}
function glow(ctx, x, y, r, color) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
  gradient.addColorStop(0, color); gradient.addColorStop(1, 'transparent');
  circle(ctx, x, y, r, gradient);
}

export function drawShip(ctx, x, y, size, t, tilt = 0, invincible = false, precise = false, color = C) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(size, size);
  if (invincible) {
    ctx.strokeStyle = '#9befce'; ctx.lineWidth = 1.1;
    ctx.globalAlpha = 0.5 + Math.sin(t * 18) * 0.25;
    ctx.beginPath(); ctx.ellipse(0, 0, 33, 44, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  const flame = 24 + Math.sin(t * 36) * 7;
  glow(ctx, 0, 24, 45, '#92f5ca29');
  polygon(ctx, [[-8, 19], [-5, 36], [0, 22 + flame], [5, 36], [8, 19]], '#7eefdcb8');
  polygon(ctx, [[-4, 20], [0, 27 + flame * 0.7], [4, 20]], '#eaffbd');
  polygon(ctx, [[-7, -10], [-32, 19], [-31, 29], [-11, 20], [0, 29], [11, 20], [31, 29], [32, 19], [7, -10]], '#233c3d', '#567f76');
  polygon(ctx, [[-8, -10], [-29, 19], [-12, 14]], '#8baf9a');
  polygon(ctx, [[8, -10], [29, 19], [12, 14]], '#6f9784');
  polygon(ctx, [[-30, 20], [-30, 27], [-12, 19], [-12, 13]], color);
  polygon(ctx, [[30, 20], [30, 27], [12, 19], [12, 13]], color);
  const hull = ctx.createLinearGradient(-13, 0, 13, 0);
  hull.addColorStop(0, '#9fb7a7'); hull.addColorStop(0.48, '#e8f0d7'); hull.addColorStop(0.51, '#abc3ae'); hull.addColorStop(1, '#5d8a78');
  polygon(ctx, [[0, -36], [-12, 9], [-10, 24], [0, 18], [10, 24], [12, 9]], hull, color, 0.6);
  polygon(ctx, [[0, -20], [-5, -3], [0, 5], [5, -3]], '#143e42', '#6bb4a1', 0.6);
  polygon(ctx, [[-1, -18], [-3, -4], [0, -1], [2, -5]], '#64c8c0');
  ctx.strokeStyle = '#233d37'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, 14); ctx.stroke();
  ctx.fillStyle = '#dfffba'; ctx.fillRect(-20, 4, 2, 9); ctx.fillRect(18, 4, 2, 9);
  if (precise) { circle(ctx, 0, 0, 3, '#fff'); }
  ctx.restore();
}

function drawEnemy(ctx, e, t) {
  ctx.save(); ctx.translate(e.x, e.y);
  const tank = e.type === 'tank', weaver = e.type === 'weaver';
  ctx.scale(tank ? 1.35 : 1, tank ? 1.35 : 1);
  const color = tank ? '#ffbc7a' : weaver ? '#bba6ff' : '#f88f91';
  glow(ctx, 0, -16, 19, `${color}23`);
  polygon(ctx, [[-6, -17], [0, -28 - Math.sin(t * 20) * 4], [6, -17]], `${color}80`);
  polygon(ctx, [[-25, -17], [-15, -8], [-9, -19], [9, -19], [15, -8], [25, -17], [21, 13], [10, 6], [0, 25], [-10, 6], [-21, 13]], e.flash ? '#fff5df' : '#342c39', color, 1.2);
  polygon(ctx, [[-21, -10], [-18, 7], [-11, 1]], color);
  polygon(ctx, [[21, -10], [18, 7], [11, 1]], color);
  polygon(ctx, [[0, -14], [-7, -2], [0, 13], [7, -2]], e.flash ? '#fff' : '#77505c');
  glow(ctx, 0, -1, 13, `${color}66`); circle(ctx, 0, -1, 4, '#ffe2cf');
  if (tank) { ctx.fillStyle = color; ctx.fillRect(-15, 13, 4, 10); ctx.fillRect(11, 13, 4, 10); }
  ctx.restore();
}

function drawBoss(ctx, b, t) {
  if (!b || b.hp <= 0) return;
  if (b.kind === 'sentinel') {
    ctx.save(); ctx.translate(b.x, b.y);
    const color = '#ffc17c';
    glow(ctx, 0, 0, 115, '#ffb76722');
    polygon(ctx, [[-90, -24], [-55, -47], [-30, -20], [30, -20], [55, -47], [90, -24], [86, 25], [52, 43], [24, 25], [-24, 25], [-52, 43], [-86, 25]], b.flash ? '#fff4dd' : '#4b3c32', color, 2);
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#9c7651'; ctx.fillRect(side * 61 - 12, -27, 24, 53);
      ctx.fillStyle = '#ffd59c'; ctx.fillRect(side * 61 - 5, 20, 10, 32);
      circle(ctx, side * 61, -11, 7, '#302821');
    }
    ctx.save(); ctx.rotate(t * 0.45);
    polygon(ctx, [[0, -54], [39, -27], [39, 27], [0, 54], [-39, 27], [-39, -27]], '#242b2e', color, 2);
    ctx.restore();
    circle(ctx, 0, 0, 24, '#755334'); glow(ctx, 0, 0, 38, '#ffb76760');
    circle(ctx, 0, 0, 14, b.flash ? '#fff' : '#ffe0a3');
    ctx.restore(); return;
  }
  ctx.save(); ctx.translate(b.x, b.y);
  const rage = b.hp < b.maxHp / 2;
  const color = rage ? '#ffb96c' : '#ff858d';
  glow(ctx, 0, 0, 150, `${color}20`);
  ctx.strokeStyle = `${color}44`; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, 88, t * 0.3, t * 0.3 + Math.PI * 1.6); ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.save(); ctx.scale(side, 1);
    polygon(ctx, [[25, -37], [90, -55], [126, -8], [100, 26], [81, 5], [54, 39], [34, 10]], b.flash ? '#fff4dc' : '#3d3343', color, 1.5);
    polygon(ctx, [[60, -24], [89, -38], [111, -7], [97, 4], [90, -8]], '#895263');
    polygon(ctx, [[54, 17], [72, 9], [61, 48], [48, 58]], color);
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(85, -30); ctx.lineTo(101, -9); ctx.stroke();
    circle(ctx, 94, 11, 5, '#ffebba'); ctx.restore();
  }
  polygon(ctx, [[0, -64], [-33, -28], [-38, 22], [0, 65], [38, 22], [33, -28]], b.flash ? '#fff4dc' : '#54404b', color, 1.5);
  polygon(ctx, [[0, -43], [-21, -14], [-19, 20], [0, 41], [19, 20], [21, -14]], '#181f2c', '#ae6766');
  glow(ctx, 0, 0, 35, `${color}a0`);
  polygon(ctx, [[0, -20], [-13, 0], [0, 24], [13, 0]], color);
  polygon(ctx, [[0, -11], [-6, 0], [0, 12], [6, 0]], '#fff6ca');
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let background, cachedWidth = 0, cachedHeight = 0;
  const stars = Array.from({ length: 155 }, (_, i) => ({
    x: ((i * 7919 + 13) % 997) / 997, y: ((i * 3571 + 91) % 991) / 991,
    size: i % 11 === 0 ? 1.7 : i % 3 === 0 ? 1 : 0.6, speed: 9 + (i % 5) * 7,
  }));

  function makeBackground(w, h) {
    background = document.createElement('canvas'); background.width = w; background.height = h;
    const c = background.getContext('2d');
    c.fillStyle = '#070f14'; c.fillRect(0, 0, w, h);
    glow(c, w * 0.76, h * 0.45, w * 0.7, '#18413e60');
    glow(c, w * 0.37, h * 0.98, w * 0.42, '#23576326');
    glow(c, w * 0.82, h * 0.09, w * 0.38, '#50764926');
    c.save(); c.translate(w * 0.78, h * 0.33); c.rotate(-0.45);
    c.strokeStyle = '#689b8327'; c.lineWidth = 1;
    for (const scale of [1, 1.06, 1.45, 2.4]) {
      c.beginPath(); c.ellipse(0, 0, w * 0.28 * scale, h * 0.13 * scale, 0, 0, TAU); c.stroke();
    }
    c.restore();
    const px = w * 0.79, py = h * 0.28, pr = w * 0.158;
    glow(c, px + pr * 0.2, py - pr * 0.2, pr * 1.55, '#82b58b13');
    const planet = c.createRadialGradient(px + pr * 0.54, py - pr * 0.8, 0, px, py, pr * 1.55);
    planet.addColorStop(0, '#88a484'); planet.addColorStop(0.29, '#314a46'); planet.addColorStop(0.65, '#102327'); planet.addColorStop(1, '#071218');
    circle(c, px, py, pr, planet);
    c.save(); c.beginPath(); c.arc(px, py, pr, 0, TAU); c.clip();
    c.strokeStyle = '#75908710';
    for (let i = 0; i < 35; i++) {
      c.lineWidth = 1 + i % 4;
      c.beginPath(); c.ellipse(px, py - pr + i * pr / 17, pr * 1.2, pr * 0.16, -0.35, 0, TAU); c.stroke();
    }
    c.restore();
    c.strokeStyle = '#a6ceaa30'; c.lineWidth = 1;
    c.beginPath(); c.arc(px, py, pr, -2.05, 0.2); c.stroke();
    c.strokeStyle = '#64987909'; c.lineWidth = 1;
    for (let y = 0; y < h; y += 68) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    for (let x = 0; x < w; x += 68) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    cachedWidth = w; cachedHeight = h;
  }

  return function render(g, realTime, precise = false) {
    const { width: w, height: h } = g;
    if (!background || cachedWidth !== w || cachedHeight !== h) makeBackground(w, h);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const pw = Math.round(rect.width * dpr), ph = Math.round(rect.height * dpr);
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
    ctx.drawImage(background, 0, 0);
    const idle = g.mode === 'ready';
    const t = idle ? realTime : g.time;
    for (const s of stars) {
      const y = (s.y * h + t * s.speed * (reducedMotion ? 0.1 : 1)) % h;
      ctx.globalAlpha = s.size === 1.7 ? 0.8 : 0.4;
      ctx.fillStyle = s.size === 1.7 ? '#c5e8d1' : '#709e9d';
      ctx.fillRect(s.x * w, y, s.size, idle ? s.size : s.size * 2.5);
    }
    ctx.globalAlpha = 1;
    ctx.save();
    if (!reducedMotion && g.shake > 0) ctx.translate(Math.sin(realTime * 97) * g.shake, Math.cos(realTime * 83) * g.shake * 0.7);
    if (idle) {
      const mobile = w < 700;
      const x = w * (mobile ? 0.83 : 0.73), y = h * (mobile ? 0.43 : 0.58);
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.23);
      ctx.strokeStyle = '#99c79820'; ctx.setLineDash([3, 9]);
      ctx.beginPath(); ctx.arc(0, 0, mobile ? 123 : 157, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = '#99c79840'; ctx.beginPath(); ctx.arc(0, 0, mobile ? 133 : 167, -0.4, 0.7); ctx.stroke();
      drawShip(ctx, 0, Math.sin(t * 1.5) * (reducedMotion ? 0 : 6), mobile ? 2.3 : 3.1, t, 0);
      if (g.playerCount === 2) drawShip(ctx, mobile ? -57 : 80, mobile ? 108 : 90, mobile ? 1.5 : 2, t, 0.18, false, false, '#83e5ff');
      ctx.restore();
      ctx.font = '9px monospace'; ctx.fillStyle = '#729280'; ctx.textAlign = 'center';
      ctx.fillText(g.playerCount === 2 ? 'OB—01 + OB—02 / LOCAL CO-OP' : 'OB—01 / INTERCEPTOR', x, y + (mobile ? 150 : 191));
      ctx.font = '7px monospace'; ctx.fillStyle = '#3e5e52'; ctx.fillText('CLASS A · NOVA EQUIPPED', x, y + (mobile ? 168 : 209));
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 0.23; drawEnemy(ctx, { x: w * 0.52 + i * 80, y: h * 0.12 - i * 11, type: 'scout' }, t);
      }
      ctx.globalAlpha = 1;
    } else {
      for (const laser of g.lasers) {
        const active = laser.age >= laser.warning;
        ctx.fillStyle = active ? '#ff9b8160' : '#ff73651b';
        ctx.fillRect(laser.x - laser.width / 2, 0, laser.width, h);
        ctx.strokeStyle = active ? '#fff0c8' : '#ff937b99';
        ctx.lineWidth = active ? 9 : 1;
        ctx.setLineDash(active ? [] : [9, 8]);
        ctx.beginPath(); ctx.moveTo(laser.x, 0); ctx.lineTo(laser.x, h); ctx.stroke(); ctx.setLineDash([]);
        if (!active) { ctx.fillStyle = '#ffb48b'; ctx.font = '11px monospace'; ctx.textAlign = 'center'; ctx.fillText('!', laser.x, h - 30); }
      }
      for (const shot of g.shots) {
        ctx.fillStyle = `${shot.color || C}20`; ctx.fillRect(shot.x - 7, shot.y - 17, 14, 31);
        ctx.fillStyle = shot.color || '#dfffac'; ctx.fillRect(shot.x - 2, shot.y - 13, 4, 20);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(shot.x - 1, shot.y - 13, 2, 11);
      }
      for (const enemy of g.enemies) if (!enemy.dead) drawEnemy(ctx, enemy, t);
      drawBoss(ctx, g.boss, t);
      for (const b of g.bullets) {
        circle(ctx, b.x, b.y, b.r + 4, `${b.color}22`);
        circle(ctx, b.x, b.y, b.r, b.color);
        circle(ctx, b.x, b.y, b.r * 0.4, '#fff7da');
      }
      for (const item of g.pickups) {
        const color = item.kind === 'power' ? C : item.kind === 'shield' ? '#83e5ff' : '#ffd782';
        ctx.save(); ctx.translate(item.x, item.y);
        ctx.rotate(Math.sin(t * 3) * 0.12); glow(ctx, 0, 0, 35, `${color}30`);
        polygon(ctx, [[0, -20], [20, 0], [0, 20], [-20, 0]], '#172b27', color, 1.5);
        ctx.fillStyle = color; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(item.kind === 'power' ? 'P' : item.kind === 'shield' ? '+' : 'N', 0, 1); ctx.restore();
      }
      for (const p of g.players) {
        if (p.hp <= 0) continue;
        ctx.globalAlpha = p.invincible > 0 ? 0.65 + Math.sin(t * 28) * 0.25 : 1;
        drawShip(ctx, p.x, p.y, 1, t, p.tilt, p.invincible > 0, p.precise || (g.playerCount === 1 && precise), p.color);
        ctx.globalAlpha = 1;
        if (g.playerCount === 2) {
          ctx.fillStyle = p.color; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
          ctx.fillText(`${p.id + 1}P`, p.x, p.y + 52);
        }
      }
    }
    for (const p of g.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife); ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r * 2);
    }
    for (const ring of g.rings) {
      ctx.globalAlpha = ring.life / ring.maxLife;
      ctx.lineWidth = ring.size > 100 ? 3 : 1; ctx.strokeStyle = ring.color;
      ctx.beginPath(); ctx.arc(ring.x, ring.y, (1 - ring.life / ring.maxLife) * ring.size, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.restore();
    ctx.fillStyle = '#87a99150'; ctx.font = '7px monospace'; ctx.textAlign = 'left';
    ctx.fillText('OB / ' + (idle ? 'STANDBY' : g.mode === 'playing' ? 'FLIGHT ACTIVE' : 'FLIGHT HOLD'), 26, h - 25);
    ctx.textAlign = 'right'; ctx.fillText('SECTOR ' + String(g.wave || 1).padStart(2, '0'), w - 28, h - 25);
  };
}
