// 언더테일 팬 게임 · 아스리엘 드리무르 보스전 탄막 (DOM 없음)
// patterns.mjs 가 이 목록을 PATTERNS 에 합친다. 모든 패턴은 { duration, box, soul, tick } 형태를 따른다.
// 새 탄막 속성: free(박스 밖에서도 그림), ghost(충돌 없음, 연출용), hit(me, soul, r)(회전한 칼날·원형 낙뢰처럼 사각형이 아닌 판정)

const bounds = ctx => { const b = ctx.box; return { l: b.tx - b.tw / 2, r: b.tx + b.tw / 2, t: b.ty - b.th / 2, b: b.ty + b.th / 2, cx: b.tx, cy: b.ty, w: b.tw, h: b.th }; };
function every(ctx, key, interval, fn, start = 0) { const m = ctx.memo, k = `_${key}`; if (m[k] === undefined) m[k] = start - interval; while (ctx.t >= m[k] + interval) { m[k] += interval; fn(m[`${k}n`] = (m[`${k}n`] || 0) + 1); } }
function once(ctx, key, at, fn) { const k = `_o${key}`; if (!ctx.memo[k] && ctx.t >= at) { ctx.memo[k] = true; fn(); } }
const rnd = (ctx, a, b) => a + ctx.rng() * (b - a);
const spd = ctx => ctx.angry ? 1.2 : 1;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = k => 1 - (1 - k) ** 3;
// 연출 이벤트: 소리·흔들림을 브라우저 쪽에 알린다.
const fx = (ctx, name, type = 'sfx') => { ctx.b?.asr?.events.push({ type, name }); };
export function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
  const u = clamp(((px - ax) * dx + (py - ay) * dy) / L, 0, 1);
  return Math.hypot(px - (ax + u * dx), py - (ay + u * dy));
}
// 잃어버린 영혼이 기억을 되찾아 가는 중이면 탄막이 영혼 앞에서 머뭇거리다 부서진다.
function hesitate(me, c, radius = 34) {
  const d = Math.hypot(me.x - c.soul.x, me.y - c.soul.y);
  if (d < radius && !me.faded) { me.faded = true; me.ghost = true; me.fadeAt = me.age; me.vx *= .2; me.vy *= .2; me.ax = 0; me.ay = 0; me.ttl = me.age + .35; }
}

// ---------- 공용 탄막 ----------
// 별: 떨어지다가 목표 높이에서 터져 작은 별 고리가 된다.
function bigStar(ctx, { x0, y0, x1, y1, dur = .75, ring = 8, speed = 115, spin = .9, rainbow = false, r = 13, ttl = 3 }) {
  const s = spd(ctx);
  ctx.spawn({ kind: 'asMark', ghost: true, x: x1, y: y1, ttl: dur, r: 14 });
  return ctx.spawn({ kind: 'asStar', big: true, free: true, r, x: x0, y: y0, vx: (x1 - x0) / dur, vy: (y1 - y0) / dur, ttl: dur + .05, rainbow, spinSeed: ctx.rng() * 6,
    update(me, c) {
      if (me.age >= dur && !me.burst) {
        me.burst = true; me.dead = true; fx(c, 'starBurst');
        c.spawn({ kind: 'asFlash', ghost: true, x: me.x, y: me.y, ttl: .3, r: 26 });
        const a0 = c.rng() * Math.PI;
        for (let i = 0; i < ring; i++) {
          const a = a0 + i * Math.PI * 2 / ring;
          c.spawn({ kind: 'asStar', r: 5, x: me.x, y: me.y, vx: Math.cos(a) * speed * s, vy: Math.sin(a) * speed * s, ttl, rainbow, hue: i * 360 / ring,
            update(st, cc) { const w = spin * cc.dt, cs = Math.cos(w), sn = Math.sin(w), vx = st.vx * cs - st.vy * sn; st.vy = st.vx * sn + st.vy * cs; st.vx = vx; } });
        }
      }
    } });
}
// 칼날 부채꼴 참격: 경고로 휩쓸 영역을 보여 준 뒤, 중심점을 축으로 칼날이 a0 → a1 로 휘두른다.
function saber(ctx, { px, py, a0, a1, len = 470, inner = 0, warn = .6, sweep = .26, width = 12, rainbow = false, waves = 0 }) {
  fx(ctx, 'saberWarn');
  return ctx.spawn({ kind: 'asSaber', free: true, warn: true, x: px, y: py, px, py, a0, a1, a: a0, prevA: a0, len, inner, width, rainbow, ttl: warn + sweep + .32, warnT: warn, sweep,
    update(me, c) {
      me.prevA = me.a;
      const k = clamp((me.age - warn) / sweep, 0, 1);
      me.k = k; me.a = me.a0 + (me.a1 - me.a0) * easeOut(k);
      if (me.warn && me.age >= warn) { me.warn = false; fx(c, 'saber'); }
      me.spent = me.age > warn + sweep + .04;
      if (waves && k >= 1 && !me.waved) {
        me.waved = true;
        const ca = Math.cos(me.a1), sa = Math.sin(me.a1), dir = Math.sign(me.a1 - me.a0), nx = -sa * dir, ny = ca * dir;
        for (let i = 1; i <= waves; i++) { const d = 90 + i * 70; c.spawn({ kind: 'asWave', r: 9, x: me.px + ca * d, y: me.py + sa * d, vx: nx * 95, vy: ny * 95, ang: me.a1, ttl: 2.6, rainbow }); }
      }
    },
    hit(me, soul, r) {
      if (me.spent) return false;
      const n = Math.max(1, Math.ceil(Math.abs(me.a - me.prevA) * me.len / 8)); // 칼끝이 한 번에 8px 이상 건너뛰지 않게
      for (let i = 0; i <= n; i++) {
        const a = me.prevA + (me.a - me.prevA) * i / n, ca = Math.cos(a), sa = Math.sin(a);
        if (segDist(soul.x, soul.y, me.px + ca * me.inner, me.py + sa * me.inner, me.px + ca * me.len, me.py + sa * me.len) < me.width / 2 + r - 1) return true;
      }
      return false;
    } });
}
// 번개 기둥: 경고 → 낙뢰. 세로(v) 또는 가로(h).
function bolt(ctx, { x, y, orient = 'v', thick = 26, warn = .7, strike = .26, seed = 0 }) {
  const B = bounds(ctx), v = orient === 'v';
  return ctx.spawn({ kind: 'asBolt', free: true, warn: true, orient, x: v ? x : B.cx, y: v ? B.cy : y, w: v ? thick : B.w + 420, h: v ? B.h + 420 : thick, ttl: warn + strike + .22, warnT: warn, strike, seed: seed || ctx.rng() * 1000,
    update(me, c) { if (me.warn && me.age >= warn) { me.warn = false; fx(c, 'thunder'); if (me.orient === 'v') fx(c, 'shake', 'shake'); } me.spent = me.age > warn + strike; },
    hit(me, soul, r) { if (me.spent) return false; const hw = me.w / 2 - 3, hh = me.h / 2 - 3; const cx = clamp(soul.x, me.x - hw, me.x + hw), cy = clamp(soul.y, me.y - hh, me.y + hh); return Math.hypot(cx - soul.x, cy - soul.y) < r - 1; } });
}
// 원형 낙뢰: 영혼을 겨냥한 고리가 좁혀진 뒤 터진다.
function strikeAt(ctx, x, y, { warn = .8, radius = 34 } = {}) {
  return ctx.spawn({ kind: 'asStrike', free: true, warn: true, x, y, radius, ttl: warn + .38, warnT: warn,
    update(me, c) { if (me.warn && me.age >= warn) { me.warn = false; fx(c, 'thunder'); } me.spent = me.age > warn + .22; },
    hit(me, soul, r) { return !me.spent && Math.hypot(soul.x - me.x, soul.y - me.y) < me.radius + r - 4; } });
}

export const ASRIEL_PATTERNS = {
  // ================= 1막 · 절대신 =================
  // 스타 블레이징: 하늘에서 커다란 별이 떨어져 고리 모양으로 부서지고, 사이사이 유성이 사선으로 긋는다.
  asStarBlazing: { duration: 8, box: { w: 300, h: 170 }, tick(ctx) {
    const B = bounds(ctx), s = spd(ctx);
    every(ctx, 'big', 1.05 / s, n => {
      const x1 = B.l + 34 + ((n * 97) % (B.w - 68)), y1 = B.t + 36 + ((n * 41) % (B.h - 72));
      bigStar(ctx, { x0: x1 + (n % 2 ? -120 : 120), y0: B.t - 190, x1, y1, ring: 8 + (n % 3 === 2 ? 2 : 0), speed: 108 });
      fx(ctx, 'starFall');
    }, .15);
    every(ctx, 'comet', .42 / s, n => {
      const left = n % 4 < 2; ctx.spawn({ kind: 'asStar', r: 5, comet: true, x: left ? B.l - 30 - rnd(ctx, 0, 80) : B.r + 30 + rnd(ctx, 0, 80), y: B.t - 20, vx: (left ? 1 : -1) * 105 * s, vy: 175 * s, ttl: 3 });
    }, 1.6);
  } },
  // 카오스 세이버: 박스 위 모서리를 축으로 거대한 칼이 부채꼴로 휩쓴다. 칼끝이 멈추는 곳 너머가 안전 지대.
  asChaosSaber: { duration: 8.2, box: { w: 290, h: 170 }, tick(ctx) {
    const B = bounds(ctx), s = spd(ctx);
    every(ctx, 'sl', 1.25 / s, n => {
      const left = n % 2 === 1, stop = .52 + ((n * 37) % 30) / 100;
      if (n % 4 === 0) {
        // 엑스자 교차 베기: 두 대각선이 동시에 내려친다
        saber(ctx, { px: B.l - 24, py: B.t - 24, a0: -.25, a1: Math.atan2(B.h + 24, B.w + 24), warn: .62 / s, sweep: .2, width: 11 });
        saber(ctx, { px: B.r + 24, py: B.t - 24, a0: Math.PI + .25, a1: Math.PI - Math.atan2(B.h + 24, B.w + 24), warn: .62 / s, sweep: .2, width: 11 });
        return;
      }
      if (left) saber(ctx, { px: B.l - 30, py: B.t - 30, a0: -.18, a1: stop, warn: .6 / s });
      else saber(ctx, { px: B.r + 30, py: B.t - 30, a0: Math.PI + .18, a1: Math.PI - stop, warn: .6 / s });
    }, .2);
  } },
  // 쇼커 브레이커: 번개 기둥이 경고 뒤 떨어진다. 세 번째 파도마다 영혼을 노린다.
  asShockerBreaker: { duration: 8, box: { w: 300, h: 170 }, tick(ctx) {
    const B = bounds(ctx), s = spd(ctx);
    every(ctx, 'bolt', 1.15 / s, n => {
      const kind = n % 3;
      let xs;
      if (kind === 1) xs = [0, 1, 2, 3].map(i => B.l + 30 + i * (B.w - 60) / 3 + ((n % 2) ? 36 : 0)).filter(x => x < B.r - 10);
      else if (kind === 2) xs = [B.l + rnd(ctx, 20, B.w / 2 - 30), B.cx + rnd(ctx, 30, B.w / 2 - 20)];
      else xs = [clamp(ctx.soul.x, B.l + 16, B.r - 16), clamp(ctx.soul.x + (ctx.rng() < .5 ? -78 : 78), B.l + 16, B.r - 16)];
      xs.forEach((x, i) => bolt(ctx, { x, warn: (.72 - (kind === 0 ? .08 : 0)) / s, seed: n * 13 + i }));
      fx(ctx, 'charge');
    }, .2);
  } },
  // 카오스 버스터: 머리 위의 총구가 영혼을 향해 산탄을 쏘고, 충전탄이 박스 안에서 폭발한다.
  asChaosBuster: { duration: 8.4, box: { w: 300, h: 170 }, tick(ctx) {
    const B = bounds(ctx), s = spd(ctx), gx = B.cx, gy = B.t - 58;
    once(ctx, 'gun', 0, () => ctx.spawn({ kind: 'asGun', ghost: true, free: true, x: gx, y: gy, ttl: (ctx.b?.attack?.duration ?? 8.4) + .2 }));
    const gun = ctx.b?.bullets.find(bl => bl.kind === 'asGun');
    if (gun) gun.aim = Math.atan2(ctx.soul.y - gy, ctx.soul.x - gx);
    every(ctx, 'burst', .95 / s, n => {
      if (n % 3 === 0) return;
      const a = Math.atan2(ctx.soul.y - gy, ctx.soul.x - gx);
      for (let i = -2; i <= 2; i++) { const aa = a + i * .17; ctx.spawn({ kind: 'asShell', r: 4, x: gx + Math.cos(aa) * 20, y: gy + Math.sin(aa) * 20, vx: Math.cos(aa) * 205 * s, vy: Math.sin(aa) * 205 * s, ttl: 3 }); }
      if (gun) gun.kick = 1; fx(ctx, 'gun');
    }, .4);
    every(ctx, 'orb', 2.85 / s, () => {
      const tx = clamp(ctx.soul.x + rnd(ctx, -40, 40), B.l + 30, B.r - 30), ty = clamp(ctx.soul.y + rnd(ctx, -20, 20), B.t + 30, B.b - 30), dur = 1.05;
      fx(ctx, 'charge');
      ctx.spawn({ kind: 'asOrb', free: true, r: 9, x: gx, y: gy, vx: (tx - gx) / dur, vy: (ty - gy) / dur, ttl: dur + .02,
        update(me, c) { if (me.age >= dur && !me.pop) { me.pop = true; me.dead = true; fx(c, 'starBurst'); c.spawn({ kind: 'asFlash', ghost: true, x: me.x, y: me.y, ttl: .35, r: 34 }); for (let i = 0; i < 14; i++) { const a = i * Math.PI * 2 / 14; c.spawn({ kind: 'asShell', r: 4, x: me.x, y: me.y, vx: Math.cos(a) * 150 * s, vy: Math.sin(a) * 150 * s, ttl: 2.4 }); } } } });
    }, 2.3);
  } },
  // 하이퍼 고너: 거대한 염소 해골이 입을 벌려 모든 것을 빨아들인다. 피할 수 없지만 HP 1 아래로는 떨어지지 않는다.
  asHyperGoner: { duration: 7.6, floorHp: 1, box: { w: 230, h: 140 }, tick(ctx) {
    const B = bounds(ctx), mx = B.cx, my = B.t - 16;
    once(ctx, 'skull', 0, () => { ctx.spawn({ kind: 'asSkull', ghost: true, free: true, x: mx, y: my - 64, ttl: 7.8 }); fx(ctx, 'goner'); fx(ctx, 'shake', 'shake'); });
    const skull = ctx.b?.bullets.find(bl => bl.kind === 'asSkull');
    if (skull) skull.open = ctx.t < .8 ? ctx.t / .8 : ctx.t > 7 ? Math.max(0, 1 - (ctx.t - 7) / .45) : 1;
    // 빨아들이는 힘: 영혼이 입 쪽으로 끌려간다. 버티면 제자리를 지킬 수 있다.
    if (ctx.t > .8 && ctx.t < 7) {
      const dx = mx - ctx.soul.x, dy = my - ctx.soul.y, d = Math.hypot(dx, dy) || 1, pull = 62 + Math.min(40, ctx.t * 6);
      ctx.soul.x += dx / d * pull * ctx.dt; ctx.soul.y += dy / d * pull * ctx.dt;
      every(ctx, 'suck', .045, n => {
        const a = n * 2.39996, R = 330 + (n % 5) * 18;
        ctx.spawn({ kind: 'asShard', r: 4, x: mx + Math.cos(a) * R, y: my + 40 + Math.sin(a) * R * .75, ttl: 3.2, dmg: 1, iframes: .12, hue: (n * 29) % 360,
          update(me) { const ddx = mx - me.x, ddy = my - me.y, dd = Math.hypot(ddx, ddy) || 1, sp = 150 + (330 - Math.min(330, dd)) * .9; me.vx = ddx / dd * sp - ddy / dd * 70; me.vy = ddy / dd * sp + ddx / dd * 70; if (dd < 14) me.dead = true; } });
      }, .8);
      every(ctx, 'streak', .09, n => ctx.spawn({ kind: 'asSuck', ghost: true, free: true, x: mx + Math.cos(n * 1.7) * 300, y: my + 30 + Math.sin(n * 1.7) * 220, tx: mx, ty: my, ttl: .6 }), .8);
    }
    once(ctx, 'crunch', 7.1, () => { fx(ctx, 'crunch'); fx(ctx, 'shake', 'shake'); });
  } },

  // ================= 2막 · 최후의 형태 =================
  // 갤럭타 블레이징: 유성우가 한쪽에서 쏟아지다 방향을 바꾸고, 무지개 별이 크게 터진다.
  asGalactaBlazing: { duration: 9, box: { w: 300, h: 180 }, tick(ctx) {
    const B = bounds(ctx), s = spd(ctx);
    const side = Math.floor(ctx.t / 2.4) % 2 === 0 ? 1 : -1;
    every(ctx, 'rain', .13 / s, n => {
      const x = side > 0 ? rnd(ctx, B.l - 200, B.r - 60) : rnd(ctx, B.l + 60, B.r + 200);
      ctx.spawn({ kind: 'asStar', r: 5, comet: true, rainbow: true, hue: (n * 23) % 360, x, y: B.t - 30, vx: side * 120 * s, vy: 235 * s, ttl: 2.6 });
    }, .3);
    every(ctx, 'big', 1.7 / s, n => {
      const x1 = B.l + 40 + ((n * 113) % (B.w - 80)), y1 = B.t + 40 + ((n * 53) % (B.h - 80));
      bigStar(ctx, { x0: x1 - side * 150, y0: B.t - 210, x1, y1, ring: 12, speed: 125, spin: n % 2 ? 1.1 : -1.1, rainbow: true, r: 16, dur: .8 });
      fx(ctx, 'starFall');
    }, .8);
  } },
  // 카오스 슬라이서: 무지개 칼 두 자루가 네 모서리에서 번갈아 휩쓸고, 칼끝에서 초승달 파동이 날아간다.
  asChaosSlicer: { duration: 9.2, box: { w: 300, h: 180 }, tick(ctx) {
    const B = bounds(ctx), s = spd(ctx);
    every(ctx, 'sl', 1.05 / s, n => {
      const stop = .5 + ((n * 29) % 34) / 100, corner = n % 4;
      if (n % 5 === 0) {
        saber(ctx, { px: B.l - 24, py: B.t - 24, a0: -.3, a1: Math.atan2(B.h + 24, B.w + 24), warn: .55 / s, sweep: .18, width: 12, rainbow: true });
        saber(ctx, { px: B.r + 24, py: B.b + 24, a0: Math.PI - .3, a1: Math.PI + Math.atan2(B.h + 24, B.w + 24), warn: .55 / s, sweep: .18, width: 12, rainbow: true });
        return;
      }
      const P = [[B.l - 30, B.t - 30, -.2, stop], [B.r + 30, B.t - 30, Math.PI + .2, Math.PI - stop], [B.r + 30, B.b + 30, Math.PI - .2, Math.PI + stop], [B.l - 30, B.b + 30, .2, -stop]][corner];
      saber(ctx, { px: P[0], py: P[1], a0: P[2], a1: P[3], warn: .52 / s, sweep: .22, rainbow: true, waves: 2 });
    }, .15);
  } },
  // 쇼커 브레이커 II: 세로 기둥과 가로 기둥이 번갈아 떨어지고, 영혼 자리에 원형 낙뢰가 꽂힌다.
  asShockerBreaker2: { duration: 9, box: { w: 300, h: 180 }, tick(ctx) {
    const B = bounds(ctx), s = spd(ctx);
    every(ctx, 'grid', 1.3 / s, n => {
      if (n % 2) { const gap = Math.floor(ctx.rng() * 4); for (let i = 0; i < 4; i++) if (i !== gap) bolt(ctx, { x: B.l + 38 + i * (B.w - 76) / 3, warn: .7 / s, thick: 30 }); }
      else { const gap = Math.floor(ctx.rng() * 3); for (let i = 0; i < 3; i++) if (i !== gap) bolt(ctx, { y: B.t + 30 + i * (B.h - 60) / 2, orient: 'h', warn: .74 / s, thick: 30 }); }
      fx(ctx, 'charge');
    }, .1);
    every(ctx, 'ring', 1.9 / s, () => strikeAt(ctx, clamp(ctx.soul.x, B.l + 20, B.r - 20), clamp(ctx.soul.y, B.t + 20, B.b - 20)), 1.2);
  } },
  // 진짜 마지막 공격: 무지개 빛줄기가 사방에서 모여들고, 결국 박스 전체가 빛에 잠긴다. 피할 수 없다.
  asFinalBeam: { duration: 7.5, finalBeam: true, box: { w: 240, h: 150 }, tick(ctx) {
    const B = bounds(ctx), p = ctx.player;
    once(ctx, 'start', 0, () => { fx(ctx, 'charge'); fx(ctx, 'shake', 'shake'); });
    if (ctx.t < 2.8) every(ctx, 'ray', .16, n => { const a = n * 2.1; ctx.spawn({ kind: 'asRay', ghost: true, free: true, x: B.cx, y: B.cy, ang: a, ttl: .7, hue: (n * 40) % 360 }); if (n % 3 === 0) fx(ctx, 'charge'); });
    if (ctx.t < 2.6) every(ctx, 'spiral', .08, n => { const a = n * .5; ctx.spawn({ kind: 'asStar', r: 4, rainbow: true, hue: n * 17, x: B.cx + Math.cos(a) * 260, y: B.cy + Math.sin(a) * 200, vx: -Math.cos(a) * 150, vy: -Math.sin(a) * 115, ttl: 2 }); });
    once(ctx, 'fill', 2.8, () => { ctx.spawn({ kind: 'asFinal', ghost: true, free: true, x: B.cx, y: B.cy, ttl: 9 }); fx(ctx, 'transform'); fx(ctx, 'shake', 'shake'); });
    if (ctx.t >= 2.8 && p.hp > 0) every(ctx, 'drain', .075, n => {
      // 무적 시간도, 방어력도, 희망도 소용없다. 빛이 HP를 그대로 지워 간다.
      const dmg = Math.max(1, Math.ceil(p.maxHp / 24)); p.hp = Math.max(0, p.hp - dmg);
      if (n % 4 === 1) { ctx.b?.effects.push({ kind: 'hurt', x: ctx.soul.x, y: ctx.soul.y, t: 0, dmg }); fx(ctx, 'hurt'); }
    }, 2.8);
  } },

  // ================= 3막 · 잃어버린 영혼들 =================
  // 언다인과 알피스: 창의 벽이 틈을 두고 밀려오고, 알피스의 작은 전기 불꽃이 지그재그로 떨어진다.
  lsUndyneAlphys: { duration: 7, box: { w: 270, h: 160 }, tick(ctx) {
    const B = bounds(ctx), soft = !!ctx.b?.asr?.souls[0]?.calm;
    every(ctx, 'wall', .95, n => {
      const gap = B.t + 26 + ((n * 47) % (B.h - 52)), fromLeft = n % 2 === 1;
      for (let y = B.t + 10; y < B.b; y += 17) if (Math.abs(y - gap) > 24) ctx.spawn({ kind: 'spear', w: 40, h: 8, x: fromLeft ? B.l - 30 : B.r + 30, y, vx: (fromLeft ? 1 : -1) * 175, ttl: 3, update: soft ? hesitate : null });
      fx(ctx, 'spear');
    }, .2);
    every(ctx, 'spark', .5, n => ctx.spawn({ kind: 'asSpark', r: 5, x: B.l + 20 + ((n * 61) % (B.w - 40)), y: B.t - 8, vy: 95, ttl: 3, seed: n, update(me, c) { me.x += Math.sin(me.age * 9 + me.seed) * 70 * c.dt; if (soft) hesitate(me, c); } }), .5);
  } },
  // 파피루스와 샌즈: 파란 영혼. 파피루스의 뼈 행진을 뛰어넘는 사이, 샌즈의 작은 블래스터가 머리 위를 가른다.
  lsPapyrusSans: { duration: 7.5, soul: 'blue', box: { w: 300, h: 140 }, tick(ctx) {
    const B = bounds(ctx), soft = !!ctx.b?.asr?.souls[1]?.calm;
    every(ctx, 'bone', .82, n => { const h = 20 + (n % 3) * 12; ctx.spawn({ kind: 'bone', w: 10, h, x: B.r + 10, y: B.b - h / 2, vx: -165, ttl: 3.2, color: n % 5 === 4 ? 'blue' : 'white', update: soft ? hesitate : null }); }, .3);
    every(ctx, 'blaster', 2.3, n => {
      const y = B.t + 26 + (n % 2) * 26, warn = .8;
      ctx.spawn({ kind: 'blaster', orient: 'h', x: B.cx, y, w: B.w + 200, h: 26, warn: true, ttl: warn + .32, iframes: .5,
        update(me) { if (me.age >= warn) me.warn = false; if (soft && !me.warn) { me.ghost = true; me.softened = true; } } });
    }, 1.2);
  } },
  // 토리엘과 아스고어: 불꽃 손길이 양옆에서 조준하고, 삼지창의 주황·파랑 물결이 위아래로 지나간다.
  lsTorielAsgore: { duration: 7.5, box: { w: 300, h: 160 }, tick(ctx) {
    const B = bounds(ctx), soft = !!ctx.b?.asr?.souls[2]?.calm;
    every(ctx, 'hand', 1, n => {
      const sx = n % 2 ? B.l - 10 : B.r + 10;
      for (let i = 0; i < 4; i++) { const a = Math.atan2(ctx.soul.y - B.cy, ctx.soul.x - sx) + (i - 1.5) * .24; ctx.spawn({ kind: 'fire', r: 7, x: sx, y: B.cy - 30 + i * 20, vx: Math.cos(a) * 135, vy: Math.sin(a) * 135, ttl: 3, update: soft ? hesitate : null }); }
      fx(ctx, 'fire');
    }, .3);
    every(ctx, 'trident', 2.1, n => { const top = n % 2 === 0; ctx.spawn({ kind: 'trident', w: B.w + 40, h: 30, x: B.cx, y: top ? B.t - 24 : B.b + 24, vy: (top ? 1 : -1) * 95, ttl: 3, color: n % 2 ? 'blue' : 'orange' }); }, 1);
  } },

  // ================= 3막 · 아스리엘을 구하기 =================
  // 잃어버린 영혼을 찾는 동안의 아스리엘: 힘이 흩어진 별비와 가끔의 참격.
  asSaveStars: { duration: 6.5, box: { w: 280, h: 160 }, tick(ctx) {
    const B = bounds(ctx);
    every(ctx, 'rain', .24, n => ctx.spawn({ kind: 'asStar', r: 5, comet: true, rainbow: true, hue: n * 31, x: rnd(ctx, B.l - 60, B.r + 60), y: B.t - 20, vx: rnd(ctx, -40, 40), vy: 150, ttl: 2.6 }), .2);
    every(ctx, 'sl', 2.2, n => { const left = n % 2; saber(ctx, left ? { px: B.l - 30, py: B.t - 30, a0: -.18, a1: .7, warn: .7, rainbow: true } : { px: B.r + 30, py: B.t - 30, a0: Math.PI + .18, a1: Math.PI - .7, warn: .7, rainbow: true }); }, 1);
  } },
  // 절박함 I: 뒤섞인 별과 칼. 조금 느리지만 틈이 좁다.
  asDesperate1: { duration: 8, box: { w: 300, h: 170 }, tick(ctx) {
    const B = bounds(ctx);
    every(ctx, 'big', 1.2, n => bigStar(ctx, { x0: B.cx + (n % 2 ? -160 : 160), y0: B.t - 200, x1: B.l + 40 + ((n * 89) % (B.w - 80)), y1: B.t + 40 + ((n * 43) % (B.h - 80)), ring: 10, speed: 100, rainbow: true, spin: n % 2 ? .8 : -.8 }), .1);
    every(ctx, 'sl', 1.6, n => { const stop = .55 + (n % 3) * .12; saber(ctx, n % 2 ? { px: B.l - 30, py: B.t - 30, a0: -.18, a1: stop, warn: .62, rainbow: true } : { px: B.r + 30, py: B.t - 30, a0: Math.PI + .18, a1: Math.PI - stop, warn: .62, rainbow: true }); }, .9);
  } },
  // 절박함 II: 흔들리는 번개와 눈물처럼 흩어지는 별. 공격이 스스로 부서지기 시작한다.
  asDesperate2: { duration: 8, box: { w: 300, h: 170 }, tick(ctx) {
    const B = bounds(ctx);
    every(ctx, 'bolt', 1.4, n => { const xs = [B.l + 40 + ((n * 71) % (B.w - 80)), B.l + 40 + ((n * 131 + 90) % (B.w - 80))]; xs.forEach((x, i) => bolt(ctx, { x, warn: .85, seed: n * 7 + i })); }, .2);
    every(ctx, 'star', .2, n => ctx.spawn({ kind: 'asStar', r: 5, rainbow: true, hue: n * 19, x: B.cx + Math.cos(n * .9) * 20, y: B.t - 30, vx: Math.cos(n * .9) * 120, vy: 60 + Math.abs(Math.sin(n * .9)) * 110, ttl: 2.8, update(me, c) { if (me.age > 1.1 + (n % 5) * .2) { me.dead = true; c.spawn({ kind: 'asFlash', ghost: true, x: me.x, y: me.y, ttl: .2, r: 8 }); } } }), .4);
  } },
  // 눈물: 아스리엘의 마지막 "공격". 영혼에 닿기 전에 모두 부서진다.
  asTears: { duration: 7.5, box: { w: 240, h: 150 }, tick(ctx) {
    const B = bounds(ctx);
    once(ctx, 'sob', .3, () => fx(ctx, 'sob'));
    every(ctx, 'tear', .16, n => ctx.spawn({ kind: 'asTear', r: 5, ghost: true, x: B.l + 12 + ((n * 67) % (B.w - 24)), y: B.t - 10, vy: 70 + (n % 4) * 12, ttl: 4, update(me, c) { hesitate(me, c, 46); if (me.y > B.b - 8 && !me.faded) { me.faded = true; me.fadeAt = me.age; me.vy = 0; me.ttl = me.age + .35; } } }));
  } },
};
