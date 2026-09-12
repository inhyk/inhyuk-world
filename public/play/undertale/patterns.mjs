// 언더테일 팬 게임 · 탄막 패턴
// 각 패턴은 { duration, box, soul, setup?, tick } 형태다. tick은 매 프레임 ctx와 함께 호출된다.
// ctx: { t, dt, box, soul, rng, memo, spawn, enemy, player, angry }

function bounds(ctx) { const b = ctx.box; return { l: b.tx - b.tw / 2, r: b.tx + b.tw / 2, t: b.ty - b.th / 2, b: b.ty + b.th / 2, cx: b.tx, cy: b.ty, w: b.tw, h: b.th }; }
// 일정 간격으로 fn을 호출한다. memo에 마지막 호출 시각을 남긴다.
function every(ctx, key, interval, fn, start = 0) { const m = ctx.memo; const k = `_${key}`; if (m[k] === undefined) m[k] = start - interval; while (ctx.t >= m[k] + interval) { m[k] += interval; fn(m[`${k}n`] = (m[`${k}n`] || 0) + 1); } }
function once(ctx, key, at, fn) { const k = `_o${key}`; if (!ctx.memo[k] && ctx.t >= at) { ctx.memo[k] = true; fn(); } }
const rnd = (ctx, a, b) => a + ctx.rng() * (b - a);
const spd = ctx => ctx.angry ? 1.25 : 1;

// 뼈: 세로 뼈는 박스 바닥 또는 천장에서 자란다.
function bone(ctx, { x, y, w = 10, h, vx = 0, vy = 0, color = 'white', ttl = 8, from = 'bottom' }) {
  const B = bounds(ctx);
  if (y === undefined) y = from === 'bottom' ? B.b - h / 2 : B.t + h / 2;
  return ctx.spawn({ kind: 'bone', x, y, w, h, vx, vy, color, ttl });
}
function blaster(ctx, { x, y, orient = 'h', thick = 40, warn = .8, beam = .35, dmg }) {
  const B = bounds(ctx);
  const bl = ctx.spawn({ kind: 'blaster', x: orient === 'h' ? B.cx : x, y: orient === 'h' ? y : B.cy, w: orient === 'h' ? B.w + 200 : thick, h: orient === 'h' ? thick : B.h + 200, orient, warn: true, ttl: warn + beam, phase: 0, dmg, iframes: .5, once: false,
    update: (me) => { if (me.age >= warn) { me.warn = false; me.phase = 1; } } });
  return bl;
}

export const PATTERNS = {
  none: { duration: 1.5, tick() {} },

  // ---------- 폐허 ----------
  flyRing: { duration: 6, box: { w: 220, h: 150 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'fly', .9 / spd(ctx), () => { for (let i = 0; i < 3; i++) { const x = rnd(ctx, B.l + 10, B.r - 10); ctx.spawn({ kind: 'fly', r: 6, x, y: B.t - 10, vy: 80 * spd(ctx), vx: Math.sin(x) * 20, ttl: 4 }); } }); } },
  hopWave: { duration: 6, box: { w: 220, h: 150 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'hop', 1.3 / spd(ctx), n => { const side = n % 2 ? B.l - 8 : B.r + 8; ctx.spawn({ kind: 'frog', r: 8, x: side, y: B.b - 10, vx: (n % 2 ? 1 : -1) * 120 * spd(ctx), vy: -230, ay: 380, ttl: 3, update(me) { if (me.y > B.b - 10) { me.y = B.b - 10; me.vy = -230; } } }); }); } },
  mothDrift: { duration: 5, box: { w: 200, h: 140 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'moth', .35 / spd(ctx), n => { const a = n * .9; ctx.spawn({ kind: 'moth', r: 5, x: B.cx + Math.cos(a) * 80, y: B.t - 8, vy: 55 * spd(ctx), vx: 0, ttl: 4, update(me, c) { me.x += Math.sin(me.age * 4 + a) * 40 * c.dt; } }); }); } },
  jellyFountain: { duration: 6, box: { w: 240, h: 150 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'jelly', .9 / spd(ctx), () => { for (let i = -2; i <= 2; i++) ctx.spawn({ kind: 'jelly', r: 6, x: B.cx, y: B.b - 4, vx: i * 45 * spd(ctx), vy: -240, ay: 260, ttl: 3.5 }); }); } },

  // ---------- 설원 ----------
  crescentFan: { duration: 6, box: { w: 260, h: 150 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'cres', 1 / spd(ctx), n => { for (let i = 0; i < 5; i++) { const a = Math.PI / 2 + (i - 2) * .32 + (n % 2 ? .15 : -.15); ctx.spawn({ kind: 'crescent', r: 7, x: B.cx, y: B.t - 12, vx: Math.cos(a) * 120 * spd(ctx), vy: Math.sin(a) * 120 * spd(ctx), ttl: 3 }); } }); } },
  snowSpiral: { duration: 6, box: { w: 220, h: 170 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'snow', .14 / spd(ctx), n => { const a = n * .5; ctx.spawn({ kind: 'snowflake', r: 5, x: B.cx, y: B.cy, vx: Math.cos(a) * 90 * spd(ctx), vy: Math.sin(a) * 90 * spd(ctx), ttl: 3 }); }); } },
  icicleRain: { duration: 6, box: { w: 260, h: 140 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'ice', .32 / spd(ctx), () => { const x = rnd(ctx, B.l + 8, B.r - 8); ctx.spawn({ kind: 'icicle', w: 8, h: 22, x, y: B.t - 16, vy: 30, ay: 320 * spd(ctx), ttl: 3 }); }); } },
  dogSpears: { duration: 6, box: { w: 260, h: 150 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'dog', .9 / spd(ctx), n => { const y = B.t + 20 + (n % 3) * 45; for (let i = 0; i < 2; i++) ctx.spawn({ kind: 'spear', w: 40, h: 8, x: B.l - 30 - i * 60, y, vx: 200 * spd(ctx), ttl: 3, color: n % 4 === 3 ? 'blue' : 'white' }); }); } },

  // ---------- 폭포 ----------
  muscleWave: { duration: 6, box: { w: 260, h: 150 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'mus', .8 / spd(ctx), n => { const y = B.cy + Math.sin(n) * 50; ctx.spawn({ kind: 'muscle', r: 9, x: n % 2 ? B.r + 10 : B.l - 10, y, vx: (n % 2 ? -1 : 1) * 130 * spd(ctx), ttl: 3, update(me, c) { me.y += Math.cos(me.age * 5) * 60 * c.dt; } }); }); } },
  soapBubbles: { duration: 6, box: { w: 240, h: 160 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'bub', .25 / spd(ctx), n => { ctx.spawn({ kind: 'bubble', r: 6, x: rnd(ctx, B.l + 8, B.r - 8), y: B.b + 8, vy: -70 * spd(ctx), vx: Math.sin(n) * 30, ttl: 3, color: n % 5 === 0 ? 'green' : 'white', heal: 1 }); }); every(ctx, 'stream', 1.2 / spd(ctx), () => { for (let i = 0; i < 6; i++) ctx.spawn({ kind: 'drop', r: 4, x: B.l - 10 - i * 14, y: rnd(ctx, B.t + 10, B.b - 10), vx: 180 * spd(ctx), ttl: 3 }); }); } },
  temFlakes: { duration: 4, box: { w: 220, h: 140 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'tem', .5, () => { ctx.spawn({ kind: 'flake', r: 5, x: rnd(ctx, B.l + 6, B.r - 6), y: B.t - 6, vy: 60, ttl: 4, update(me, c) { me.x += Math.sin(me.age * 6) * 50 * c.dt; } }); }); } },

  // ---------- 열지대 ----------
  lavaSpit: { duration: 6, box: { w: 240, h: 160 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'lava', .7 / spd(ctx), () => { for (let i = 0; i < 4; i++) ctx.spawn({ kind: 'fire', r: 7, x: B.cx + (i - 1.5) * 20, y: B.t - 10, vy: -60, ay: 300 * spd(ctx), vx: (i - 1.5) * 50, ttl: 3.5 }); }); } },
  planeStrafe: { duration: 6, box: { w: 280, h: 140 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'plane', 1 / spd(ctx), n => { const y = B.t + 15 + (n % 3) * 40; ctx.spawn({ kind: 'plane', w: 34, h: 12, x: B.l - 20, y, vx: 170 * spd(ctx), ttl: 3, update(me, c) { if (Math.floor(me.age * 4) !== me.last) { me.last = Math.floor(me.age * 4); c.spawn({ kind: 'heart', r: 5, x: me.x, y: me.y + 8, vy: 90, ttl: 2 }); } } }); }); } },
  ropeSwing: { duration: 6, box: { w: 240, h: 160 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'rope', .9 / spd(ctx), n => { const gap = B.t + 30 + (n % 3) * 40; for (let y = B.t + 10; y < B.b; y += 16) if (Math.abs(y - gap) > 22) ctx.spawn({ kind: 'fire', r: 6, x: n % 2 ? B.r + 8 : B.l - 8, y, vx: (n % 2 ? -1 : 1) * 150 * spd(ctx), ttl: 3 }); }); } },

  // ---------- 토리엘 ----------
  fireRain: { duration: 7, box: { w: 300, h: 150 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'rain', .16, () => { ctx.spawn({ kind: 'fire', r: 7, x: rnd(ctx, B.l + 8, B.r - 8), y: B.t - 12, vy: rnd(ctx, 110, 160), ttl: 3 }); }); } },
  fireSweep: { duration: 7, box: { w: 300, h: 150 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'sw', 1.1, n => { const dir = n % 2 ? 1 : -1; for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + dir * (i - 3) * .18; ctx.spawn({ kind: 'fire', r: 8, x: B.cx + dir * 90, y: B.b + 6, vx: Math.cos(a) * 140 - dir * 60, vy: Math.sin(a) * 140, ay: 120, ttl: 3.5 }); } }); } },
  fireHands: { duration: 7, box: { w: 300, h: 150 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'hand', .6, n => { const sx = n % 2 ? B.l - 10 : B.r + 10; for (let i = 0; i < 5; i++) { const a = Math.atan2(ctx.soul.y - B.cy, ctx.soul.x - sx) + (i - 2) * .22; ctx.spawn({ kind: 'fire', r: 7, x: sx, y: B.cy - 40 + i * 20, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, ttl: 3 }); } }); } },
  // 토리엘이 HP가 낮을 때: 불꽃이 일부러 영혼을 피해 간다.
  fireLowHp: { duration: 5, box: { w: 300, h: 150 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'low', .3, () => { let x = rnd(ctx, B.l + 8, B.r - 8); if (Math.abs(x - ctx.soul.x) < 40) x = ctx.soul.x + (x > ctx.soul.x ? 40 : -40); ctx.spawn({ kind: 'fire', r: 7, x, y: B.t - 12, vy: 90, ttl: 3, update(me, c) { if (Math.abs(me.x - c.soul.x) < 30 && Math.abs(me.y - c.soul.y) < 60) me.x += (me.x > c.soul.x ? 1 : -1) * 120 * c.dt; } }); }); } },

  // ---------- 파피루스 (파란 영혼) ----------
  bonesLow: { duration: 7, soul: 'blue', box: { w: 300, h: 130 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'b', 1.1, () => bone(ctx, { x: B.r + 10, h: 26, vx: -150 })); } },
  bonesGap: { duration: 8, soul: 'blue', box: { w: 300, h: 130 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'b', 1, n => { bone(ctx, { x: B.r + 10, h: 30 + (n % 3) * 14, vx: -170 }); if (n % 2) bone(ctx, { x: B.r + 10, h: 50, from: 'top', vx: -170 }); }); } },
  blueBones: { duration: 8, soul: 'blue', box: { w: 300, h: 130 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'b', .8, n => { bone(ctx, { x: B.r + 10, h: n % 3 === 2 ? 40 : B.h - 6, vx: -190, color: n % 3 === 2 ? 'white' : 'blue' }); }); } },
  bonesJump: { duration: 8, soul: 'blue', box: { w: 320, h: 140 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'b', .7, n => { const dir = n % 4 < 2 ? -1 : 1; bone(ctx, { x: dir < 0 ? B.r + 10 : B.l - 10, h: 22 + (n % 2) * 26, vx: dir * 210 }); }); } },
  bonesTall: { duration: 8, soul: 'blue', box: { w: 320, h: 150 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'b', 1, n => { bone(ctx, { x: B.r + 10, h: B.h - 40, vx: -160, from: n % 2 ? 'top' : 'bottom' }); bone(ctx, { x: B.r + 40, h: 24, vx: -160, from: n % 2 ? 'bottom' : 'top' }); }); } },
  bonesRush: { duration: 9, soul: 'blue', box: { w: 340, h: 150 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'b', .45, n => { bone(ctx, { x: B.r + 10, h: 18 + (n % 4) * 12, vx: -260, color: n % 5 === 4 ? 'orange' : 'white' }); }); every(ctx, 'c', 2.2, () => bone(ctx, { x: B.l - 10, h: 30, vx: 200, color: 'blue' })); } },
  // 파피루스의 "특별 공격": 강아지가 뼈를 물고 가 버렸다. 남은 건 아주 평범한 뼈 하나.
  special: { duration: 6, soul: 'blue', box: { w: 300, h: 130 }, tick(ctx) { const B = bounds(ctx); once(ctx, 's', 2.5, () => bone(ctx, { x: B.r + 10, h: 24, vx: -60, ttl: 8 })); } },

  // ---------- 언다인 (초록 영혼) ----------
  arrows1: { duration: 8, soul: 'green', box: { w: 200, h: 200 }, tick(ctx) { every(ctx, 'a', 1.1, n => arrow(ctx, ['left', 'right', 'up', 'down'][n % 4], 180)); } },
  arrows2: { duration: 8, soul: 'green', box: { w: 200, h: 200 }, tick(ctx) { every(ctx, 'a', .8, n => arrow(ctx, ['left', 'right', 'down', 'up', 'left', 'up'][n % 6], 230)); } },
  arrowsFast: { duration: 9, soul: 'green', box: { w: 200, h: 200 }, tick(ctx) { every(ctx, 'a', .55, () => arrow(ctx, ['left', 'right', 'up', 'down'][Math.floor(ctx.rng() * 4)], 290)); } },
  arrows3: { duration: 9, soul: 'green', box: { w: 200, h: 200 }, tick(ctx) { every(ctx, 'a', .45, n => { const dirs = ['left', 'right', 'up', 'down']; const d = dirs[Math.floor(ctx.rng() * 4)]; arrow(ctx, d, n % 5 === 4 ? 360 : 250, n % 7 === 6); }); } },
  spearRain: { duration: 7, soul: 'red', box: { w: 300, h: 150 }, tick(ctx) { const B = bounds(ctx); every(ctx, 's', .4, () => { const x = rnd(ctx, B.l + 8, B.r - 8); ctx.spawn({ kind: 'spearv', w: 8, h: 44, x, y: B.t - 30, vy: 260, ttl: 3 }); }); every(ctx, 'w', 1.6, n => { for (let i = 0; i < 3; i++) ctx.spawn({ kind: 'spear', w: 44, h: 8, x: n % 2 ? B.l - 30 : B.r + 30, y: B.t + 25 + i * 45, vx: (n % 2 ? 1 : -1) * 230, ttl: 3 }); }); } },
  arrowStorm: { duration: 10, soul: 'green', box: { w: 200, h: 200 }, tick(ctx) { every(ctx, 'a', .32, () => arrow(ctx, ['left', 'right', 'up', 'down'][Math.floor(ctx.rng() * 4)], 340, ctx.rng() < .3)); } },
  spearWall: { duration: 9, soul: 'red', box: { w: 320, h: 160 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'w', .7, n => { const gap = B.t + 20 + (n * 37) % (B.h - 40); for (let y = B.t + 8; y < B.b; y += 14) if (Math.abs(y - gap) > 20) ctx.spawn({ kind: 'spear', w: 40, h: 8, x: n % 2 ? B.l - 30 : B.r + 30, y, vx: (n % 2 ? 1 : -1) * 260, ttl: 3 }); }); } },

  // ---------- 메타톤 EX ----------
  legs: { duration: 7, box: { w: 300, h: 160 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'leg', .8, n => { const x = B.l + 20 + (n * 70) % (B.w - 40); ctx.spawn({ kind: 'leg', w: 18, h: 90, x, y: B.t - 60, vy: 220, ttl: 3 }); }); } },
  discoBall: { duration: 7, box: { w: 300, h: 160 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'd', .5, n => { const a = n * .7; for (let k = 0; k < 2; k++) ctx.spawn({ kind: 'disco', r: 5, x: B.cx, y: B.t + 20, vx: Math.cos(a + k * Math.PI) * 170, vy: Math.abs(Math.sin(a + k * Math.PI)) * 170, ttl: 3, color: n % 3 === 0 ? 'blue' : 'white' }); }); } },
  bombs: { duration: 7, box: { w: 300, h: 160 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'bomb', 1.1, () => { ctx.spawn({ kind: 'bomb', r: 8, x: rnd(ctx, B.l + 20, B.r - 20), y: B.t - 10, vy: 120, ttl: 1.6, update(me, c) { if (me.age > 1.3 && !me.burst) { me.burst = true; me.dead = true; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.spawn({ kind: 'spark', r: 4, x: me.x, y: me.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, ttl: 1.2 }); } } } }); }); } },
  hearts: { duration: 7, box: { w: 300, h: 160 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'h', .45, n => { ctx.spawn({ kind: 'heart', r: 6, x: n % 2 ? B.l - 8 : B.r + 8, y: rnd(ctx, B.t + 10, B.b - 10), vx: (n % 2 ? 1 : -1) * 160, ttl: 3, color: n % 4 === 3 ? 'orange' : 'white' }); }); } },
  neoBeam: { duration: 6, box: { w: 300, h: 150 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'n', .6, n => { ctx.spawn({ kind: 'laser', w: 30, h: 6, x: B.l - 20, y: B.t + 15 + (n * 33) % (B.h - 30), vx: 320, ttl: 2 }); }); } },

  // ---------- 아스고어 ----------
  tridentSweep: { duration: 8, box: { w: 320, h: 160 }, tick(ctx) { const B = bounds(ctx); every(ctx, 't', 1.4, n => { const top = n % 2 === 0; ctx.spawn({ kind: 'trident', w: B.w + 40, h: 40, x: B.cx, y: top ? B.t - 30 : B.b + 30, vy: (top ? 1 : -1) * 110, ttl: 2.6, color: n % 4 === 1 ? 'orange' : n % 4 === 3 ? 'blue' : 'white' }); }); } },
  fireCircle: { duration: 8, box: { w: 320, h: 160 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'c', .12, n => { const a = n * .42; ctx.spawn({ kind: 'fire', r: 7, x: B.cx, y: B.cy, vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, ttl: 3 }); }); } },
  fireWaves: { duration: 8, box: { w: 320, h: 160 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'w', .5, n => { for (let x = B.l + 10; x < B.r; x += 24) ctx.spawn({ kind: 'fire', r: 7, x: x + (n % 2) * 12, y: B.t - 10, vy: 120, ttl: 3, update(me, c) { me.x += Math.sin(me.age * 3 + n) * 30 * c.dt; } }); }); } },
  tridentBounce: { duration: 8, box: { w: 320, h: 160 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'tb', .7, n => { ctx.spawn({ kind: 'fire', r: 9, x: n % 2 ? B.l + 10 : B.r - 10, y: B.t + 10, vx: (n % 2 ? 1 : -1) * 160, vy: 60, ttl: 4, update(me) { if (me.x < B.l + 6 || me.x > B.r - 6) me.vx *= -1; if (me.y > B.b - 6 || me.y < B.t + 6) me.vy *= -1; } }); }); } },

  // ---------- 플라위 ----------
  pelletSpray: { duration: 7, box: { w: 320, h: 160 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'p', .22, n => { const a = Math.atan2(ctx.soul.y - (B.t - 30), ctx.soul.x - B.cx) + Math.sin(n) * .6; ctx.spawn({ kind: 'pellet', r: 6, x: B.cx, y: B.t - 30, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, ttl: 3 }); }); } },
  fingerGuns: { duration: 7, box: { w: 320, h: 160 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'g', .9, n => { const y = B.t + 15 + (n % 4) * 35; for (let i = 0; i < 4; i++) ctx.spawn({ kind: 'bullet', w: 14, h: 6, x: (n % 2 ? B.l - 20 : B.r + 20) - (n % 2 ? 1 : -1) * i * 30, y, vx: (n % 2 ? 1 : -1) * 300, ttl: 3 }); }); } },
  flameThrower: { duration: 7, box: { w: 320, h: 160 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'f', .08, n => { const a = Math.sin(ctx.t * 1.6) * .9 + Math.PI / 2; ctx.spawn({ kind: 'fire', r: 8, x: B.cx + Math.cos(a) * 20, y: B.t - 10, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, ttl: 2, color: n % 9 === 0 ? 'green' : 'white', heal: 3 }); }); } },
  bombDrop: { duration: 7, box: { w: 320, h: 160 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'bd', .55, () => { ctx.spawn({ kind: 'bomb', r: 9, x: rnd(ctx, B.l + 20, B.r - 20), y: B.t - 10, vy: 200, ttl: 3, update(me, c) { if (me.y >= B.b - 12 && !me.burst) { me.burst = true; me.dead = true; for (let i = 0; i < 6; i++) { const a = Math.PI + i * Math.PI / 5; c.spawn({ kind: 'spark', r: 4, x: me.x, y: me.y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, ay: 200, ttl: 1.5 }); } } } }); }); } },
  soulBreak: { duration: 8, box: { w: 320, h: 160 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'sb', .3, n => { const side = n % 4; const x = side === 0 ? B.l - 10 : side === 1 ? B.r + 10 : rnd(ctx, B.l, B.r), y = side === 2 ? B.t - 10 : side === 3 ? B.b + 10 : rnd(ctx, B.t, B.b); const a = Math.atan2(ctx.soul.y - y, ctx.soul.x - x); ctx.spawn({ kind: 'pellet', r: 6, x, y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, ttl: 3 }); }); } },

  // ---------- 아스리엘 ----------
  starBlazing: { duration: 8, box: { w: 320, h: 160 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'st', .6, n => { const x = B.l + 20 + (n * 90) % (B.w - 40); ctx.spawn({ kind: 'star', r: 11, x, y: B.t - 20, vy: 260, ttl: 3, update(me, c) { if (me.y >= B.b - 12 && !me.burst) { me.burst = true; me.dead = true; for (let i = 0; i < 6; i++) { const a = Math.PI + i * Math.PI / 5; c.spawn({ kind: 'star', r: 5, x: me.x, y: me.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, ttl: 1.5 }); } } } }); }); } },
  chaosSaber: { duration: 8, box: { w: 320, h: 160 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'cs', 1, n => { const vertical = n % 2 === 0; const pos = vertical ? rnd(ctx, B.l + 30, B.r - 30) : rnd(ctx, B.t + 30, B.b - 30); ctx.spawn({ kind: 'saber', w: vertical ? 14 : B.w + 20, h: vertical ? B.h + 20 : 14, x: vertical ? pos : B.cx, y: vertical ? B.cy : pos, warn: true, ttl: 1.1, once: true, update(me) { if (me.age > .7) me.warn = false; } }); }); } },
  shockerBreaker: { duration: 8, box: { w: 320, h: 160 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'sh', .5, n => { const x = B.l + 25 + (n * 61) % (B.w - 50); ctx.spawn({ kind: 'lightning', w: 26, h: B.h + 20, x, y: B.cy, warn: true, ttl: 1, once: true, update(me) { if (me.age > .6) me.warn = false; } }); }); } },
  // 하이퍼 고너: 모든 것을 빨아들인다. 피할 수 없지만 죽지도 않는다. 이 뒤에 아스리엘을 구할 수 있다.
  hyperGoner: { duration: 6, box: { w: 320, h: 160 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'hg', .08, n => { const a = n * 1.1; ctx.spawn({ kind: 'goner', r: 5, x: B.cx + Math.cos(a) * 260, y: B.cy + Math.sin(a) * 200, ttl: 2.5, dmg: 1, update(me, c) { const dx = B.cx - me.x, dy = B.cy - me.y; me.vx = dx * 1.3; me.vy = dy * 1.3; if (c.player.hp <= 1) { me.color = 'green'; me.heal = 0; } } }); }); } },

  // ---------- 샌즈 ----------
  bonesSlam: { duration: 8, soul: 'blue', box: { w: 300, h: 140 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'b', .55, n => { bone(ctx, { x: B.r + 10, h: 16 + (n % 5) * 14, vx: -300, from: n % 3 === 2 ? 'top' : 'bottom' }); }); every(ctx, 'w', 2, () => { bone(ctx, { x: B.r + 10, h: B.h - 2, vx: -220, color: 'blue' }); }); } },
  blasterCross: { duration: 8, soul: 'red', box: { w: 260, h: 200 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'bl', 1.1, n => { if (n % 2) blaster(ctx, { orient: 'h', y: B.t + 30 + ((n * 47) % (B.h - 60)) }); else blaster(ctx, { orient: 'v', x: B.l + 30 + ((n * 53) % (B.w - 60)) }); }); every(ctx, 'p', .3, () => ctx.spawn({ kind: 'bone', w: 8, h: 24, x: rnd(ctx, B.l + 8, B.r - 8), y: B.t - 14, vy: 220, ttl: 2 })); } },
  bonePlatforms: { duration: 9, soul: 'blue', box: { w: 340, h: 160 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'b', .4, n => { bone(ctx, { x: B.r + 10, h: 14 + (n % 6) * 12, vx: -330, color: n % 4 === 3 ? 'blue' : 'white' }); }); every(ctx, 't', 1.3, n => bone(ctx, { x: B.r + 10, h: B.h - 50 - (n % 3) * 20, from: 'top', vx: -330 })); } },
  blasterSpin: { duration: 8, soul: 'red', box: { w: 260, h: 200 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'bl', .7, n => { const orient = n % 2 ? 'h' : 'v'; blaster(ctx, { orient, x: B.l + 20 + (n * 71) % (B.w - 40), y: B.t + 20 + (n * 59) % (B.h - 40), warn: .6, beam: .3, thick: 34 }); }); } },
  boneWalls: { duration: 9, soul: 'blue', box: { w: 340, h: 160 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'w', .75, n => { const gap = B.b - 30 - (n % 4) * 28; for (let y = B.t + 8; y < B.b; y += 14) if (Math.abs(y - gap) > 24) ctx.spawn({ kind: 'bone', w: 10, h: 14, x: n % 2 ? B.l - 10 : B.r + 10, y, vx: (n % 2 ? 1 : -1) * 280, ttl: 3 }); }); } },
  gravityFlip: { duration: 9, soul: 'blue', box: { w: 300, h: 180 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'flip', 1.5, n => { ctx.soul.gravity = n % 2 ? 'up' : 'down'; ctx.soul.vy = 0; ctx.soul.grounded = false; const from = n % 2 ? 'top' : 'bottom'; for (let x = B.l + 10; x < B.r; x += 30) if ((x / 30 + n) % 3 !== 0) bone(ctx, { x, h: 30, from, ttl: 1.1, once: true }); }); every(ctx, 'b', .5, n => bone(ctx, { x: B.r + 10, h: 20 + (n % 3) * 12, vx: -300, from: ctx.soul.gravity === 'up' ? 'top' : 'bottom' })); } },
  blasterRain: { duration: 9, soul: 'red', box: { w: 300, h: 200 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'bl', .45, n => blaster(ctx, { orient: 'v', x: B.l + 20 + (n * 83) % (B.w - 40), warn: .55, beam: .3, thick: 40 })); every(ctx, 'h', 1.7, n => blaster(ctx, { orient: 'h', y: B.t + 20 + (n * 67) % (B.h - 40), warn: .7, beam: .3 })); } },
  boneRain: { duration: 9, soul: 'red', box: { w: 300, h: 200 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'r', .12, () => ctx.spawn({ kind: 'bone', w: 8, h: 26, x: rnd(ctx, B.l + 8, B.r - 8), y: B.t - 16, vy: 280, ttl: 2, color: ctx.rng() < .2 ? 'blue' : 'white' })); every(ctx, 's', 1, n => { for (let i = 0; i < 3; i++) ctx.spawn({ kind: 'bone', w: 26, h: 8, x: n % 2 ? B.l - 20 : B.r + 20, y: B.t + 30 + i * 50, vx: (n % 2 ? 1 : -1) * 260, ttl: 3 }); }); } },
  finalBarrage: { duration: 12, soul: 'blue', box: { w: 340, h: 170 }, tick(ctx) { const B = bounds(ctx); every(ctx, 'b', .3, n => bone(ctx, { x: n % 2 ? B.r + 10 : B.l - 10, h: 14 + (n % 5) * 12, vx: (n % 2 ? -1 : 1) * 320, from: n % 4 === 3 ? 'top' : 'bottom' })); every(ctx, 'bl', .9, n => blaster(ctx, { orient: 'v', x: B.l + 20 + (n * 97) % (B.w - 40), warn: .5, beam: .25, thick: 34 })); every(ctx, 'blue', 1.6, () => bone(ctx, { x: B.r + 10, h: B.h - 2, vx: -260, color: 'blue' })); } },
  // 샌즈의 특별 공격: 아무것도 하지 않는다. 그리고 그는 잠든다.
  nothing: { duration: 5, soul: 'red', box: { w: 300, h: 140 }, tick() {} },
};

function arrow(ctx, from, speed, reverse = false) {
  const B = bounds(ctx); const d = 150;
  const start = { left: [B.cx - d, B.cy], right: [B.cx + d, B.cy], up: [B.cx, B.cy - d], down: [B.cx, B.cy + d] }[from];
  const v = { left: [speed, 0], right: [-speed, 0], up: [0, speed], down: [0, -speed] }[from];
  // 반전 화살: 반대편에서 시작해 영혼을 지나쳐 돌아온다. 화살표 색이 노랗다.
  if (reverse) {
    const opp = { left: 'right', right: 'left', up: 'down', down: 'up' }[from];
    const os = { left: [B.cx - d, B.cy], right: [B.cx + d, B.cy], up: [B.cx, B.cy - d], down: [B.cx, B.cy + d] }[opp];
    ctx.spawn({ kind: 'arrow', from, x: os[0], y: os[1], vx: -v[0], vy: -v[1], reverse: true, passing: true, ttl: 5, r: 0, update(me) {
      const passed = from === 'left' ? me.x < B.cx - d + 5 : from === 'right' ? me.x > B.cx + d - 5 : from === 'up' ? me.y < B.cy - d + 5 : me.y > B.cy + d - 5;
      if (passed && !me.turned) { me.turned = true; me.vx = v[0] * 1.5; me.vy = v[1] * 1.5; }
      me.passing = !me.turned; } });
    return;
  }
  ctx.spawn({ kind: 'arrow', from, x: start[0], y: start[1], vx: v[0], vy: v[1], ttl: 4, r: 0 });
}
