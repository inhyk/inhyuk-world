export const ARENA = { x: 340, y: 389, w: 440, h: 204 };
export const DIFFICULTIES = {
  easy: { label: '리허설', hp: 64, damage: 2, speed: .60, rate: .65, tier: 0, duration: 6, warning: 1.4, invincible: 1.6, bossHp: 6600, ratingGoal: 10000, timing: 1.7 },
  normal: { label: '라이브', hp: 40, damage: 4, speed: 1, rate: 1, tier: 1, duration: 9, warning: 1, invincible: 1.2, bossHp: 9000, ratingGoal: 10000, timing: 1.35 },
  hard: { label: '앙코르', hp: 32, damage: 6, speed: 1.48, rate: 1.6, tier: 2, duration: 12, warning: .68, invincible: .85, bossHp: 12000, ratingGoal: 10000, timing: 1.05 },
  neo: { label: '메타톤 NEO', hp: 36, damage: 7, speed: 1.6, rate: 1.15, tier: 3, duration: 12, warning: .7, invincible: .85, bossHp: 16000, ratingGoal: 18000, timing: 1.05 },
};
export const PATTERNS = [
  { name: 'STARSTRUCK', ko: '별빛 세례', hint: '별 사이의 틈으로 움직여요.', yellow: false },
  { name: 'DISCO INFERNO', ko: '디스코 인페르노', hint: '회전하는 별의 궤적을 읽어보세요.', yellow: false },
  { core: true, name: 'HEART TO HEART', ko: '하트 투 하트', hint: 'Z를 누르고 코어를 쏘세요! 작은 로봇도 부술 수 있어요.', yellow: true },
  { name: 'STOMP THE STAGE', ko: '런웨이 워크', hint: '분홍색 예고선 밖으로 피하세요!', yellow: false },
  { name: 'COLOR THEORY', ko: '컬러 온 더 댄스 플로어', hint: '파랑은 멈추고, 주황은 움직이세요.', yellow: false },
  { name: 'BOMBSHELL', ko: '폭발적인 인기', hint: 'Z로 폭탄을 부수세요. 폭발 직전에는 거리를 두세요!', yellow: true },
  { name: 'ENCORE RAIN', ko: '앙코르 스타샤워', hint: '반짝이는 별들이 양쪽에서 날아와요.', yellow: false },
  { name: 'LASER LOVE', ko: '레이저 러브', hint: '레이저 예고선과 별을 함께 살펴보세요.', yellow: false },
  { core: true, finale: true, name: 'GRAND FINALE', ko: '그랜드 피날레', hint: '마지막까지 화려하게! Z로 코어를 쏘세요.', yellow: true },
];
export const NEO_PATTERNS = [
  { name: 'NEO BLASTER', ko: '네오 블래스터', hint: '조준선을 피하고 Z로 NEO의 코어를 쏘세요!', yellow: true, core: true },
  { name: 'RAZOR WINGS', ko: '칼날 날개', hint: '양쪽에서 날아오는 날개 탄막! 작은 로봇은 Z로 부술 수 있어요.', yellow: true, core: true },
  { name: 'CORE OVERLOAD', ko: '코어 과부하', hint: '위아래로 움직여 가로 레이저를 피하세요. Z로 코어를 공격!', yellow: true, core: true },
  { name: 'POWER OF NEO', ko: '파워 오브 네오', hint: '안전한 통로로 피하며 Z를 누르세요. 끝까지 버텨요!', yellow: true, core: true, finale: true },
];
export function getPatterns(s) { return s.boss === 'neo' ? NEO_PATTERNS : PATTERNS; }
export function getPattern(s) { return getPatterns(s)[s.pattern]; }
export function roundDuration(s) { return s.config.duration + (getPattern(s).finale ? 2 : 0); }
const TAU = Math.PI * 2;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export function createState(difficulty = 'normal') {
  const config = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  return {
    difficulty: DIFFICULTIES[difficulty] ? difficulty : 'normal', boss: difficulty === 'neo' ? 'neo' : 'ex', config,
    mode: 'lobby', paused: false, time: 0, elapsed: 0, turn: 0, phase: 1,
    hp: config.hp, maxHp: config.hp, bossHp: config.bossHp, maxBossHp: config.bossHp, ratingGoal: config.ratingGoal,
    ratings: 0, peak: 0, hits: 0, grazes: 0, perfects: 0, items: 3,
    player: { x: 560, y: 510, invincible: 0, moving: false },
    bullets: [], shots: [], particles: [], floats: [], events: [],
    pattern: 0, roundTime: 0, spawnClock: 0, spawnIndex: 0, shootClock: 0,
    roundHits: 0, boast: false, boost: 0, shake: 0, flash: 0,
    dialogue: '', dialogueTimer: 0, next: 'menu', fightTime: 0,
    combo: 0, maxCombo: 0, ending: '', target: { x: 560, y: 419, hp: 20 },
    lastStrike: '', randomSeed: 0x12345678,
  };
}
export function random(s) {
  s.randomSeed ^= s.randomSeed << 13;
  s.randomSeed ^= s.randomSeed >>> 17;
  s.randomSeed ^= s.randomSeed << 5;
  return (s.randomSeed >>> 0) / 4294967296;
}
export function event(s, name) { s.events.push(name); }
export function addRatings(s, amount, label, x = 560, y = 370) {
  s.ratings = Math.max(0, Math.round(s.ratings + amount));
  s.peak = Math.max(s.peak, s.ratings);
  if (label) s.floats.push({ x, y, text: `${label} +${amount}`, life: 1.6, color: '#ffe58b' });
}
export function burst(s, x, y, color, count = 14) {
  for (let i = 0; i < count; i++) {
    const a = random(s) * TAU, speed = 35 + random(s) * 150;
    s.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: .4 + random(s) * .6, maxLife: 1, color, size: 2 + random(s) * 3 });
  }
}
export function say(s, text, seconds = 2, next = 'dodge') {
  s.dialogue = text; s.dialogueTimer = seconds; s.dialogueDuration = seconds; s.next = next; s.mode = 'dialogue';
  event(s, 'dialogue');
}
export function start(s) {
  say(s, s.boss === 'neo' ? '앙코르를 넘어왔구나. 이제 내 진짜 힘을 보여주지! METTATON NEO!' : '오, YES! 오늘 밤의 주인공은 바로 너야, 달링!', 2.6, 'menu');
  event(s, 'start');
}
export function win(s, ending) {
  s.mode = 'won'; s.ending = ending; s.bullets = []; s.shots = [];
  s.shake = .2; event(s, 'win');
  for (let i = 0; i < 6; i++) burst(s, 230 + random(s) * 650, 100 + random(s) * 300, ['#ff429d', '#ffe58b', '#77eaf1'][i % 3], 22);
}
export function choose(s, action) {
  if (s.mode !== 'menu' || s.paused) return false;
  if (action === 'fight') { s.mode = 'fight'; s.fightTime = 0; event(s, 'select'); return true; }
  if (action === 'pose') {
    addRatings(s, 950, '완벽한 포즈');
    say(s, '그 포즈... 제법인데? 하지만 진짜 스타는 나야!');
  } else if (action === 'boast') {
    s.boast = true; addRatings(s, 300, '대담한 선언');
    say(s, '한 번도 맞지 않겠다고? 좋아, 카메라 준비!');
  } else if (action === 'dance') {
    s.hp = Math.min(s.maxHp, s.hp + 6); addRatings(s, 400, '댄스 브레이크');
    say(s, '이 리듬을 느껴봐, 달링!  [HP +6]');
  } else if (action === 'item') {
    if (!s.items) { say(s, '스타 파르페가 다 떨어졌다. 행동 → 춤추기로 회복할 수 있다.', 2.5, 'menu'); return true; }
    const heal = Math.min(24, s.maxHp - s.hp);
    s.items--; s.hp += heal; addRatings(s, 350, '협찬 효과');
    say(s, `MTT 브랜드 스타 파르페! 맛도 완벽, 광고도 완벽!  [HP +${heal}]`);
    event(s, 'heal');
  } else if (action === 'mercy') {
    if (s.ratings >= s.ratingGoal) win(s, 'audience');
    else say(s, `아직 방송을 끝낼 수는 없지! 시청률 ${s.ratingGoal.toLocaleString()}을 모아줘, 달링.`, 2.8, 'menu');
  } else return false;
  event(s, 'select'); return true;
}
export function strikePosition(s) { return (s.fightTime / s.config.timing) % 1; }
export function strike(s) {
  if (s.mode !== 'fight' || s.paused) return;
  const accuracy = Math.max(0, 1 - Math.abs(strikePosition(s) - .5) * 2);
  const perfect = accuracy > .90;
  const damage = Math.round(240 + Math.pow(accuracy, 2) * 850);
  s.bossHp = Math.max(0, s.bossHp - damage);
  s.lastStrike = perfect ? 'PERFECT!' : accuracy > .65 ? 'GREAT!' : 'GOOD';
  s.floats.push({ x: 560, y: 185, text: `${s.lastStrike}  −${damage}`, life: 2, color: perfect ? '#ffe58b' : '#ff85bd' });
  addRatings(s, perfect ? 650 : 250, perfect ? '완벽한 타이밍' : '멋진 공격');
  burst(s, 560, 195, '#ff429d', 30); s.shake = perfect ? .42 : .22; s.flash = .15;
  event(s, perfect ? 'perfect' : 'strike');
  if (!s.bossHp) win(s, 'fight');
  else say(s, perfect ? '오! 짜릿한 한 방이네! 시청자들이 열광하잖아!' : '조금 더 화려하게 해봐, 달링!', 1.6);
}
export function beginRound(s) {
  s.mode = 'dodge'; s.roundTime = 0; s.spawnClock = -.65; s.spawnIndex = 0;
  s.roundHits = 0; s.bullets = []; s.shots = []; s.shootClock = 0;
  s.pattern = s.turn % getPatterns(s).length;
  s.phase = Math.min(3, 1 + Math.floor(s.turn / 3));
  s.player = { x: 560, y: 529, invincible: .6, moving: false };
  s.target = { x: 560, y: 418, hp: 20 };
  event(s, 'round');
}
export function finishRound(s) {
  s.bullets = []; s.shots = []; s.turn++;
  const perfect = s.roundHits === 0;
  if (perfect) { s.perfects++; s.combo++; s.maxCombo = Math.max(s.combo, s.maxCombo); }
  else s.combo = 0;
  addRatings(s, perfect ? 700 : 350, perfect ? 'NO HIT!' : '무대 생존');
  if (s.boast && perfect) addRatings(s, 850, '약속을 지켰다!', 560, 343);
  s.boast = false; s.mode = 'menu';
  s.dialogue = s.ratings >= s.ratingGoal ? `시청률 ${s.ratingGoal.toLocaleString()} 돌파! 자비로 최고의 피날레를 완성하세요.` : [
    '관객들이 당신의 다음 행동을 기다리고 있다.', '메타톤이 카메라를 향해 윙크한다.',
    '무대 위로 반짝이는 별가루가 내려앉는다.', '당신의 심장 박동이 음악과 겹쳐진다.',
  ][s.turn % 4];
  event(s, perfect ? 'nohit' : 'menu');
}
export function canHurt(b, moving) {
  if (b.color === 'blue' && !moving) return false;
  if (b.color === 'orange' && moving) return false;
  if (b.kind === 'laser' && b.age < b.delay) return false;
  return true;
}
export function touches(b, p, extra = 0) {
  if (b.kind === 'laser' || b.kind === 'bar') {
    return p.x + 4 + extra > b.x && p.x - 4 - extra < b.x + b.w && p.y + 4 + extra > b.y && p.y - 4 - extra < b.y + b.h;
  }
  return Math.hypot(b.x - p.x, b.y - p.y) < b.r + 4 + extra;
}
export function hurt(s) {
  if (s.player.invincible > 0 || s.mode !== 'dodge') return;
  s.hp = Math.max(0, s.hp - s.config.damage); s.hits++; s.roundHits++;
  s.player.invincible = s.config.invincible; s.shake = .25; s.flash = .11;
  burst(s, s.player.x, s.player.y, '#ff4288', 12); event(s, 'hurt');
  if (!s.hp) { s.mode = 'lost'; s.bullets = []; s.shots = []; event(s, 'lose'); }
}
function bullet(s, x, y, vx, vy, options = {}) {
  s.bullets.push({ x, y, vx, vy, r: 7, kind: 'star', color: 'pink', age: 0, ttl: 12, ...options });
}
function ring(s, x, y, n, speed, offset = 0, options = {}) {
  for (let i = 0; i < n; i++) { const a = offset + i * TAU / n; bullet(s, x, y, Math.cos(a) * speed, Math.sin(a) * speed, options); }
}
function laser(s, x, y, w, h, warning = .9) {
  const delay = warning * s.config.warning;
  bullet(s, x, y, 0, 0, { kind: 'laser', w, h, delay, ttl: delay + .32, color: s.boss === 'neo' ? 'cyan' : 'pink' });
}
function spawnPattern(s) {
  const a = ARENA, n = s.spawnIndex++, v = s.config.speed, p = s.pattern, tier = s.config.tier;
  if (p === 0) {
    const lanes = [6,7,9][tier], pitch = a.w / lanes;
    const sweep = n % ((lanes - 1) * 2), gap = Math.min(sweep, (lanes - 1) * 2 - sweep);
    for (let i = 0; i < lanes; i++) if (i !== gap && !(tier === 0 && Math.abs(i-gap) === 1)) {
      bullet(s, a.x + pitch * (i + .5), a.y - 16, Math.sin(n) * [0,10,22][tier], (100 + n * 2) * v, { r: tier === 0 ? 6 : 7 });
    }
  } else if (p === 1) {
    ring(s, 560 + Math.sin(n * .6) * 95, a.y + 6, [6,9,13][tier], 100 * v, n * .22, { kind: 'note', r: 7, color: n % 2 ? 'white' : 'pink' });
  } else if (p === 2 || p === 8) {
    for (let i = 0; i < (tier === 2 ? 2 : 1); i++) {
      const x = a.x + 25 + random(s) * (a.w - 50);
      bullet(s, x, a.y - 12, Math.sin(n+i) * 22, 83 * v, { kind: 'mini', r: 13, hp: tier === 0 ? 1 : 2, color: 'white' });
    }
    if (p === 8 || n % (tier === 2 ? 2 : 3) === 0) ring(s, s.target.x, s.target.y + 8, (p === 8 ? [5,8,11] : [4,5,8])[tier], 90 * v, n * .31, { r: 6 });
  } else if (p === 3) {
    const gap = n % 5, safeLanes = [3,2,1][tier];
    for (let i = 0; i < 5; i++) if ((i-gap+5)%5 >= safeLanes) laser(s, a.x+i*88+12, a.y, [48,60,64][tier], a.h, .95);
  } else if (p === 4) {
    bullet(s, a.x - 22, a.y, 135 * v, 0, { kind: 'bar', w: [10,14,19][tier], h: a.h, color: n % 2 === 0 ? 'blue' : 'orange' });
  } else if (p === 5) {
    bullet(s, a.x + 30 + random(s) * (a.w - 60), a.y - 15, 0, 56 * v, { kind: 'bomb', r: 13, fuse: [3,2.35,1.7][tier], hp: [1,3,3][tier], color: 'white' });
  } else if (p === 6) {
    const side = n % 2, y = a.y + 25 + random(s) * 135, count = [1,3,5][tier];
    for (let i = 0; i < count; i++) bullet(s, side ? a.x+a.w+10 : a.x-10, y, (side ? -1 : 1)*140*v, (i-(count-1)/2)*39, { kind: 'star', r: 7, color: i % 2 ? 'white' : 'pink' });
  } else if (p === 7) {
    const width = [40,54,66][tier], x = clamp(s.player.x-width/2, a.x, a.x+a.w-width);
    laser(s, x, a.y, width, a.h, .85);
    for (let j = 0; j < [1,3,5][tier]; j++) bullet(s, a.x+random(s)*a.w, a.y-10, 0, 108*v, { r: 6 });
  }
}
function spawnNeoPattern(s) {
  const a = ARENA, n = s.spawnIndex++, v = s.config.speed;
  if (s.pattern === 0) {
    laser(s, clamp(s.player.x-25,a.x,a.x+a.w-50), a.y, 50, a.h, 1.05);
    if (n % 2 === 0) for (let i = -1; i <= 1; i++) bullet(s, s.target.x, a.y+20, i*60, 100*v, { kind: 'shard', color: 'cyan', r: 6 });
  } else if (s.pattern === 1) {
    const side = n % 2, y = a.y+35+(n*41)%125;
    for (let i = -2; i <= 2; i++) bullet(s, side ? a.x+a.w+12 : a.x-12, y, (side ? -1 : 1)*155*v, i*35, { kind: 'shard', color: 'cyan', r: 6 });
    if (n % 3 === 0) bullet(s, a.x+40+random(s)*360, a.y-12, 0, 110, { kind: 'mini', r: 13, hp: 2, color: 'white' });
  } else if (s.pattern === 2) {
    ring(s, s.target.x, a.y+12, 14, 105*v, n*.26, { kind: 'shard', color: 'cyan', r: 6 });
    if (n % 2 === 0) laser(s, a.x, clamp(s.player.y-11,a.y,a.y+a.h-22), a.w, 22, 1.2);
  } else {
    const gap = n % 6, pitch = a.w/6;
    for (let i = 0; i < 6; i++) if (i !== gap && i !== (gap+1)%6) laser(s,a.x+i*pitch+10,a.y,pitch-20,a.h,1.15);
    if (n % 2 === 0) ring(s,s.target.x,a.y+12,10,120,n*.3,{color:'cyan',r:5});
    else bullet(s, a.x+35+random(s)*370, a.y-12, 0, 100, { kind:'bomb', r:13, hp:2, fuse:2.1, color:'white' });
  }
}
export function update(s, dt, input = {}) {
  if (s.paused) return;
  dt = clamp(dt, 0, .05); s.time += dt;
  if (!['lobby', 'won', 'lost'].includes(s.mode)) s.elapsed += dt;
  s.shake = Math.max(0, s.shake - dt); s.flash = Math.max(0, s.flash - dt);
  for (const p of s.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 110 * dt; p.life -= dt; }
  s.particles = s.particles.filter(p => p.life > 0);
  for (const f of s.floats) { f.y -= dt * 23; f.life -= dt; }
  s.floats = s.floats.filter(f => f.life > 0);
  if (s.mode === 'dialogue') {
    s.dialogueTimer -= dt;
    if (s.dialogueTimer <= 0) { if (s.next === 'dodge') beginRound(s); else { s.mode = 'menu'; event(s, 'menu'); } }
    return;
  }
  if (s.mode === 'fight') { s.fightTime += dt; if (s.fightTime >= s.config.timing * 3) { s.fightTime = 0; strike(s); } return; }
  if (s.mode !== 'dodge') return;
  s.roundTime += dt;
  const duration = roundDuration(s);
  if (s.roundTime >= duration) { finishRound(s); return; }
  const p = s.player, a = ARENA;
  const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0), dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const length = Math.hypot(dx, dy) || 1, speed = input.focus ? 100 : 220;
  const oldX = p.x, oldY = p.y;
  p.x = clamp(p.x + dx / length * speed * dt, a.x + 8, a.x + a.w - 8);
  p.y = clamp(p.y + dy / length * speed * dt, a.y + 8, a.y + a.h - 8);
  p.moving = Math.hypot(p.x - oldX, p.y - oldY) > .05;
  p.invincible = Math.max(0, p.invincible - dt);
  s.spawnClock += dt;
  const intervals = [.8, .85, .65, 1.65, 1.65, 1.05, .7, 1.05, .7];
  const interval = (s.boss === 'neo' ? [.95, .85, 1.1, 1.25][s.pattern] : intervals[s.pattern]) / s.config.rate;
  if (s.spawnClock >= interval) { s.spawnClock -= interval; if (s.boss === 'neo') spawnNeoPattern(s); else spawnPattern(s); }
  s.target.x = 560 + Math.sin(s.roundTime * (1 + s.config.speed * .45)) * 135;
  s.shootClock = Math.max(0, s.shootClock - dt);
  if (getPattern(s).yellow && input.shoot && s.shootClock <= 0) {
    s.shots.push({ x: p.x, y: p.y - 12, vy: -480, life: 1 });
    s.shootClock = .14; event(s, 'shoot');
  }
  for (const shot of s.shots) {
    shot.y += shot.vy * dt; shot.life -= dt;
    if (getPattern(s).core && Math.hypot(shot.x - s.target.x, shot.y - s.target.y) < 23) {
      shot.life = 0; s.bossHp = Math.max(0, s.bossHp - 28); addRatings(s, 30);
      burst(s, shot.x, shot.y, '#ffe58b', 3); event(s, 'target');
    }
    for (const b of s.bullets) {
      if (shot.life > 0 && !b.dead && b.hp && Math.hypot(shot.x - b.x, shot.y - b.y) < b.r + 5) {
        shot.life = 0; b.hp--;
        if (!b.hp) { b.dead = true; burst(s, b.x, b.y, '#ffe58b', 10); addRatings(s, b.kind === 'bomb' ? 100 : 70); event(s, 'destroy'); }
        break;
      }
    }
  }
  s.shots = s.shots.filter(b => b.life > 0 && b.y > a.y - 15);
  if (!s.bossHp) { win(s, 'fight'); return; }
  // Explosions are collected separately so newly spawned bullets update next frame.
  const explosions = [];
  for (const b of s.bullets) {
    if (b.dead) continue;
    b.age += dt; b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.kind === 'bomb' && b.age >= b.fuse) { b.dead = true; explosions.push(b); continue; }
    if (b.age >= b.ttl) { b.dead = true; continue; }
    if (b.kind === 'laser' && b.age >= b.delay && !b.fired) { b.fired = true; event(s, 'laser'); }
    if (canHurt(b, p.moving)) {
      if (touches(b, p)) hurt(s);
      else if (!b.grazed && touches(b, p, 13) && b.kind !== 'bar' && b.kind !== 'laser') {
        b.grazed = true; s.grazes++; addRatings(s, 25); burst(s, p.x, p.y, '#77eaf1', 2);
      }
    }
    if (s.mode === 'lost') return;
  }
  for (const b of explosions) {
    ring(s, b.x, b.y, [5,8,11,12][s.config.tier], 135 * s.config.speed, .2, { r: 5, color: 'orange-pink' });
    burst(s, b.x, b.y, '#ffb568', 16); event(s, 'bomb');
  }
  s.bullets = s.bullets.filter(b => !b.dead && b.x > a.x - 80 && b.x < a.x + a.w + 80 && b.y < a.y + a.h + 55 && b.y > a.y - 100);
}
