export const DIFFICULTIES = {
  easy: { label: '루키', hp: 7, speed: 0.76, fire: 1.35, bossHp: 240 },
  normal: { label: '파일럿', hp: 5, speed: 1, fire: 1, bossHp: 320 },
  hard: { label: '에이스', hp: 3, speed: 1.2, fire: 0.8, bossHp: 400 },
};
export const SECTORS = ['외곽 궤도', '소행성 벨트', '붉은 성운', '전초 기지', '센티넬 관문', '유령 항로', '중력 폭풍', '심연 함대', '최후의 방어선', '이클립스 코어'];
export const TOTAL_WAVES = 10;
export const waveEnemyCount = g => Math.ceil((10 + g.wave * 4) * (g.playerCount === 2 ? 1.25 : 1));
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const collide = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r;

export function createGame({ difficulty = 'normal', width = 1000, height = 680, random = Math.random, playerCount = 1 } = {}) {
  const config = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  playerCount = playerCount === 2 ? 2 : 1;
  const players = Array.from({ length: playerCount }, (_, id) => ({
    id, color: id === 0 ? '#caf879' : '#83e5ff',
    x: width * (playerCount === 1 ? 0.5 : id === 0 ? 0.36 : 0.64), y: height - 100,
    r: 11, hp: config.hp, maxHp: config.hp, invincible: 0, level: 1, novas: 2,
    cooldown: 0, novaCooldown: 0, tilt: 0, precise: false,
  }));
  return {
    mode: 'ready', difficulty: DIFFICULTIES[difficulty] ? difficulty : 'normal', config,
    width, height, random, time: 0, score: 0, kills: 0, combo: 0, comboTime: 0,
    wave: 0, spawned: 0, spawnTimer: 0, waveTimer: 0, waveKills: 0,
    enemies: [], bullets: [], shots: [], pickups: [], particles: [], rings: [], lasers: [],
    boss: null, bossDefeatedTime: 0, shake: 0, banner: '', bannerTime: 0, events: [],
    players, playerCount, player: players[0],
  };
}

function emit(g, type) { g.events.push(type); }
function announce(g, text) { g.banner = text; g.bannerTime = 2.5; }
const livingPlayers = g => g.players.filter(p => p.hp > 0);
function nearestPlayer(g, x, y) {
  return livingPlayers(g).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
}

export function startGame(g) {
  if (g.mode !== 'ready') return;
  g.mode = 'playing';
  nextWave(g);
}

function nextWave(g) {
  g.wave++;
  g.waveKills = 0;
  g.spawned = 0;
  g.spawnTimer = 2.2;
  g.waveTimer = 0;
  g.bullets = [];
  g.lasers = [];
  g.boss = null;
  g.bossDefeatedTime = 0;
  let revived = false;
  if (g.wave > 1) {
    g.score += 500 * (g.wave - 1);
    for (const p of g.players) {
      if (p.hp <= 0) {
        p.hp = Math.ceil(p.maxHp / 2);
        p.x = g.width * (p.id === 0 ? 0.36 : 0.64); p.y = g.height - 100;
        revived = true;
      } else p.hp = Math.min(p.maxHp, p.hp + 1);
      p.invincible = Math.max(p.invincible, 3);
    }
  }
  const isBoss = g.wave === 5 || g.wave === TOTAL_WAVES;
  announce(g, (isBoss ? `WARNING · ${g.wave === 5 ? '중간 보스 센티넬' : '최종 보스 이클립스'}`
    : `WAVE ${String(g.wave).padStart(2, '0')} · ${SECTORS[g.wave - 1]}`) + (revived ? ' · 동료 복귀!' : ''));
  emit(g, isBoss ? 'warning' : 'wave');
  if (isBoss) {
    const kind = g.wave === 5 ? 'sentinel' : 'eclipse';
    const hp = Math.round(g.config.bossHp * (kind === 'sentinel' ? 0.55 : 1) * (g.playerCount === 2 ? 1.65 : 1));
    g.boss = { kind, x: g.width / 2, y: -100, r: kind === 'sentinel' ? 50 : 64, hp,
      maxHp: hp, time: 0, fireTimer: 1.3, laserTimer: 7, volley: 0, flash: 0 };
  }
}

export function burst(g, x, y, color, count = 20) {
  for (let i = 0; i < count; i++) {
    const angle = g.random() * Math.PI * 2;
    const speed = 40 + g.random() * 180;
    const life = 0.25 + g.random() * 0.55;
    g.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life, maxLife: life, color, r: 1 + g.random() * 3 });
  }
  if (g.particles.length > 450) g.particles.splice(0, g.particles.length - 450);
}

function destroyEnemy(g, enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  g.kills++;
  g.waveKills++;
  g.combo++;
  g.comboTime = 3;
  const multiplier = Math.min(4, 1 + Math.floor(g.combo / 8));
  g.score += (enemy.type === 'tank' ? 180 : enemy.type === 'scout' ? 80 : 120) * multiplier;
  burst(g, enemy.x, enemy.y, enemy.type === 'tank' ? '#ffad67' : '#a8f36b', 24);
  g.rings.push({ x: enemy.x, y: enemy.y, life: 0.45, maxLife: 0.45, size: 52, color: '#d9fc9b' });
  g.shake = Math.max(g.shake, 2.8);
  emit(g, 'explode');
  // Guaranteed, repeating drops keep upgrades reachable without lucky rolls.
  if (g.kills % 6 === 0) {
    const cycle = (g.kills / 6 - 1) % 4;
    const kind = cycle === 2 ? 'shield' : cycle === 3 ? 'nova' : 'power';
    g.pickups.push({ x: enemy.x, y: Math.max(35, enemy.y), r: 17, kind, age: 0 });
  }
}

function damageBoss(g, amount) {
  const boss = g.boss;
  if (!boss || boss.hp <= 0 || boss.y < 35 || g.mode !== 'playing') return;
  boss.hp = Math.max(0, boss.hp - amount);
  boss.flash = 0.07;
  if (boss.hp === 0) {
    const finalBoss = g.wave === TOTAL_WAVES;
    g.score += finalBoss ? 5000 + g.players.reduce((sum, p) => sum + p.hp * 500, 0) : 2500;
    g.bullets = [];
    g.lasers = [];
    burst(g, boss.x, boss.y, '#d5ff7a', 100);
    g.rings.push({ x: boss.x, y: boss.y, life: 1.6, maxLife: 1.6, size: 650, color: '#d5ff7a' });
    g.shake = 14;
    if (finalBoss) { g.mode = 'won'; emit(g, 'win'); }
    else {
      g.bossDefeatedTime = 2.4;
      announce(g, 'SENTINEL DOWN · 관문 돌파! 6웨이브로');
      emit(g, 'wave');
      for (const p of livingPlayers(g)) g.pickups.push({ x: p.x, y: p.y - 45, r: 17, kind: 'power', age: 0 });
    }
  }
}

export function activateNova(g, playerId = 0) {
  const p = g.players[playerId];
  if (g.mode !== 'playing' || !p || p.hp <= 0 || p.novas < 1 || p.novaCooldown > 0) return false;
  p.novas--;
  p.novaCooldown = 0.6;
  for (const ally of livingPlayers(g)) ally.invincible = Math.max(1.5, ally.invincible);
  g.bullets = [];
  g.lasers = [];
  for (const enemy of g.enemies) {
    enemy.hp -= 15;
    if (enemy.hp <= 0) destroyEnemy(g, enemy);
  }
  damageBoss(g, 50);
  g.rings.push({ x: p.x, y: p.y, life: 0.85, maxLife: 0.85, size: 1100, color: p.color });
  g.shake = 9;
  emit(g, 'nova');
  return true;
}

function hurt(g, p) {
  if (p.hp <= 0 || p.invincible > 0 || g.mode !== 'playing') return;
  p.hp--;
  p.invincible = 1.7;
  g.combo = 0;
  g.comboTime = 0;
  g.shake = 9;
  burst(g, p.x, p.y, '#ff786c', 22);
  emit(g, 'hurt');
  if (livingPlayers(g).length === 0) {
    g.mode = 'lost';
    emit(g, 'lose');
  } else if (p.hp === 0) announce(g, `${p.id + 1}P 격추 · 동료가 웨이브를 넘기면 복귀합니다`);
}

function firePlayer(g, p) {
  const offsets = p.level === 1 ? [0] : p.level === 2 ? [-9, 9] : [-17, 0, 17];
  for (const offset of offsets) {
    g.shots.push({ x: p.x + offset, y: p.y - 22, vx: p.level === 3 ? offset * 3 : 0, vy: -700, r: 4, damage: 1, owner: p.id, color: p.color });
  }
  p.cooldown = p.level === 1 ? 0.13 : 0.16;
  emit(g, 'shot');
}

function enemyBullet(g, x, y, angle, speed, r = 5, color = '#ff8d8a') {
  g.bullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r, color });
}

function spawnEnemy(g) {
  const type = g.wave >= 2 && g.spawned % 5 === 4 ? 'tank'
    : g.wave >= 2 && g.spawned % 3 === 2 ? 'weaver' : 'scout';
  const x = 50 + g.random() * (g.width - 100);
  g.enemies.push({ x, y: -35, originX: x, r: type === 'tank' ? 26 : 18,
    type, hp: (type === 'tank' ? 9 : type === 'weaver' ? 3 : 2) + (g.wave > 5 ? 1 : 0),
    age: 0, phase: g.random() * Math.PI * 2,
    speed: (type === 'tank' ? 45 : type === 'weaver' ? 68 : 86) * (1 + Math.min(6, g.wave) * 0.1) * g.config.speed,
    fireTimer: (1.1 + g.random() * 0.8) * g.config.fire, flash: 0, dead: false });
  g.spawned++;
}

function updateBoss(g, dt) {
  const b = g.boss;
  if (!b || b.hp <= 0) return;
  b.time += dt;
  b.y = Math.min(115, b.y + dt * 75);
  b.x = g.width / 2 + Math.sin(b.time * 0.52) * (g.width * 0.29);
  b.flash = Math.max(0, b.flash - dt);
  if (b.y < 100) return;
  const sentinel = b.kind === 'sentinel';
  const phase = b.hp > b.maxHp / 2 ? 1 : 2;
  b.fireTimer -= dt;
  b.laserTimer -= dt;
  if (b.fireTimer <= 0) {
    const alive = livingPlayers(g);
    const target = alive[b.volley++ % alive.length];
    if (!target) return;
    const aim = Math.atan2(target.y - b.y, target.x - b.x);
    const count = sentinel ? (phase === 1 ? 3 : 5) : phase === 1 ? 5 : 7;
    for (let i = 0; i < count; i++) {
      enemyBullet(g, b.x, b.y + 40, aim + (i - (count - 1) / 2) * 0.18, (155 + phase * 22) * g.config.speed, 6);
    }
    if (phase === 2 && !sentinel) {
      for (let i = 0; i < 12; i++) enemyBullet(g, b.x, b.y, i / 12 * Math.PI * 2 + b.time * 0.3, 125 * g.config.speed, 5, '#ffc66b');
    }
    b.fireTimer = (sentinel ? 1.3 : phase === 1 ? 1.1 : 0.8) * g.config.fire;
    emit(g, 'enemyShot');
  }
  if (b.laserTimer <= 0) {
    const lanes = sentinel ? [0.5] : phase === 1 ? [0.25, 0.75] : [0.18, 0.5, 0.82];
    for (const lane of lanes) g.lasers.push({ x: g.width * lane, width: 42, age: 0, warning: 1.5, duration: 0.7 });
    b.laserTimer = phase === 1 ? 7 : 5.5;
    emit(g, 'warning');
  }
}

function collect(g, item, p) {
  if (item.kind === 'power') {
    p.level = Math.min(3, p.level + 1);
    announce(g, p.level === 3 ? 'MAX POWER · 트리플 캐논' : 'POWER UP · 듀얼 캐논');
  } else if (item.kind === 'shield') {
    p.hp = Math.min(p.maxHp, p.hp + 2);
    p.invincible = Math.max(p.invincible, 3);
    announce(g, 'SHIELD · 기체 수리 +2');
  } else {
    p.novas = Math.min(3, p.novas + 1);
    announce(g, 'NOVA +1 · 필살기 충전');
  }
  g.score += 100;
  if (g.playerCount === 2) g.banner = `${p.id + 1}P · ${g.banner}`;
  burst(g, item.x, item.y, '#c8ff7d', 16);
  emit(g, 'pickup');
}

export function updateGame(g, dt, input = {}) {
  if (g.mode !== 'playing') return;
  dt = clamp(dt, 0, 0.05);
  g.time += dt;
  g.waveTimer += dt;
  g.bannerTime = Math.max(0, g.bannerTime - dt);
  g.shake = Math.max(0, g.shake - dt * 24);
  g.comboTime = Math.max(0, g.comboTime - dt);
  if (g.comboTime === 0) g.combo = 0;
  for (const p of livingPlayers(g)) {
    const control = input.players ? input.players[p.id] || {} : p.id === 0 ? input : {};
    p.invincible = Math.max(0, p.invincible - dt);
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.novaCooldown = Math.max(0, p.novaCooldown - dt);
    let dx = control.x || 0, dy = control.y || 0;
    const length = Math.hypot(dx, dy);
    if (length > 1) { dx /= length; dy /= length; }
    p.precise = Boolean(control.precise);
    const speed = p.precise ? 150 : 350;
    p.x = clamp(p.x + dx * speed * dt + (control.dragX || 0), 25, g.width - 25);
    p.y = clamp(p.y + dy * speed * dt + (control.dragY || 0), 48, g.height - 28);
    p.tilt += (dx * 0.28 - p.tilt) * Math.min(1, dt * 12);
    if (control.fire && p.cooldown <= 0) firePlayer(g, p);
    if (control.nova) activateNova(g, p.id);
  }
  if (g.mode !== 'playing') return;

  if (g.boss && g.boss.hp <= 0) {
    g.bossDefeatedTime -= dt;
    if (g.bossDefeatedTime <= 0) nextWave(g);
  } else if (g.wave !== 5 && g.wave !== TOTAL_WAVES) {
    const total = waveEnemyCount(g);
    g.spawnTimer -= dt;
    if (g.spawned < total && g.spawnTimer <= 0) {
      spawnEnemy(g);
      g.spawnTimer = Math.max(0.4, 1.05 - g.wave * 0.12) * g.config.fire;
    }
    if (g.spawned >= total && g.enemies.length === 0) nextWave(g);
  }
  updateBoss(g, dt);

  for (const enemy of g.enemies) {
    if (enemy.dead) continue;
    enemy.age += dt;
    enemy.y += enemy.speed * dt;
    enemy.flash = Math.max(0, enemy.flash - dt);
    if (enemy.type === 'weaver') enemy.x = clamp(enemy.originX + Math.sin(enemy.age * 2 + enemy.phase) * 85, 28, g.width - 28);
    enemy.fireTimer -= dt;
    if (enemy.fireTimer <= 0 && enemy.y > 25 && enemy.y < g.height - 110) {
      const target = nearestPlayer(g, enemy.x, enemy.y);
      if (!target) break;
      const aim = Math.atan2(target.y - enemy.y, target.x - enemy.x);
      const spread = enemy.type === 'tank' ? [-0.24, 0, 0.24] : [0];
      for (const offset of spread) enemyBullet(g, enemy.x, enemy.y + 15, aim + offset, (125 + g.wave * 15) * g.config.speed);
      enemy.fireTimer = (enemy.type === 'tank' ? 1.6 : 2.2) * g.config.fire;
    }
    for (const p of livingPlayers(g)) {
      if (!enemy.dead && collide(enemy, p)) {
        hurt(g, p);
        enemy.hp = 0;
        destroyEnemy(g, enemy);
      }
    }
  }
  if (g.mode !== 'playing') return;

  for (const shot of g.shots) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    for (const enemy of g.enemies) {
      if (!enemy.dead && collide(shot, enemy)) {
        enemy.hp -= shot.damage;
        enemy.flash = 0.08;
        shot.dead = true;
        if (enemy.hp <= 0) destroyEnemy(g, enemy);
        break;
      }
    }
    if (!shot.dead && g.boss && g.boss.hp > 0 && collide(shot, g.boss)) {
      damageBoss(g, shot.damage);
      shot.dead = true;
    }
  }
  if (g.mode !== 'playing') return;

  for (const bullet of g.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    for (const p of livingPlayers(g)) {
      if (collide(bullet, p)) { hurt(g, p); bullet.dead = true; break; }
    }
  }
  for (const laser of g.lasers) {
    laser.age += dt;
    for (const p of livingPlayers(g)) {
      if (laser.age >= laser.warning && Math.abs(p.x - laser.x) < laser.width / 2 + p.r) hurt(g, p);
    }
  }
  if (g.mode !== 'playing') return;
  if (g.boss?.hp > 0) for (const p of livingPlayers(g)) if (collide(p, g.boss)) hurt(g, p);
  if (g.mode !== 'playing') return;
  for (const item of g.pickups) {
    item.age += dt;
    item.y += 78 * dt;
    const p = nearestPlayer(g, item.x, item.y);
    if (!p) continue;
    if (Math.hypot(item.x - p.x, item.y - p.y) < 105) {
      item.x += (p.x - item.x) * dt * 5;
      item.y += (p.y - item.y) * dt * 5;
    }
    if (collide(item, { ...p, r: p.r + 12 })) { collect(g, item, p); item.dead = true; }
  }
  g.shots = g.shots.filter(s => !s.dead && s.y > -30 && s.x > -30 && s.x < g.width + 30);
  g.enemies = g.enemies.filter(e => !e.dead && e.y < g.height + 50);
  g.bullets = g.bullets.filter(b => !b.dead && b.y > -60 && b.y < g.height + 60 && b.x > -60 && b.x < g.width + 60);
  g.pickups = g.pickups.filter(p => !p.dead && p.y < g.height + 30);
  g.lasers = g.lasers.filter(l => l.age < l.warning + l.duration);
  updateEffects(g, dt);
}

export function updateEffects(g, dt) {
  for (const p of g.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
  for (const ring of g.rings) ring.life -= dt;
  g.particles = g.particles.filter(p => p.life > 0);
  g.rings = g.rings.filter(r => r.life > 0);
  g.shake = Math.max(0, g.shake - dt * 15);
}

export function snapshot(g) {
  return {
    coordinates: 'origin top-left; x right, y down', width: g.width, height: g.height,
    mode: g.mode, difficulty: g.difficulty, time: Math.round(g.time * 10) / 10,
    wave: g.wave, totalWaves: TOTAL_WAVES, playerCount: g.playerCount, score: g.score, kills: g.kills, combo: g.combo,
    player: { x: Math.round(g.player.x), y: Math.round(g.player.y), hp: g.player.hp,
      level: g.player.level, novas: g.player.novas, invincible: g.player.invincible > 0 },
    players: g.players.map(p => ({ id: p.id, x: Math.round(p.x), y: Math.round(p.y), hp: p.hp,
      maxHp: p.maxHp, level: p.level, novas: p.novas, alive: p.hp > 0, invincible: p.invincible > 0 })),
    enemies: g.enemies.map(e => ({ x: Math.round(e.x), y: Math.round(e.y), hp: e.hp, type: e.type })),
    shots: g.shots.length, shotsByPlayer: g.players.map(p => g.shots.filter(s => s.owner === p.id).length),
    bullets: g.bullets.map(b => ({ x: Math.round(b.x), y: Math.round(b.y) })),
    pickups: g.pickups.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), kind: p.kind })),
    lasers: g.lasers.map(l => ({ x: l.x, active: l.age >= l.warning })),
    boss: g.boss ? { kind: g.boss.kind, hp: g.boss.hp, maxHp: g.boss.maxHp, x: Math.round(g.boss.x), y: Math.round(g.boss.y) } : null,
  };
}
