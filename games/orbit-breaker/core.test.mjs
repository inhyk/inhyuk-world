import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, updateGame, activateNova, snapshot, waveEnemyCount } from '../../public/play/orbit-breaker/core.mjs';

const running = options => { const g = createGame({ random: () => 0.5, ...options }); startGame(g); return g; };
const step = (g, seconds, input = {}) => { for (let i = 0; i < Math.round(seconds * 120); i++) { updateGame(g, 1 / 120, input); g.events = []; } };
const bulletAt = p => ({ x: p.x, y: p.y, vx: 0, vy: 0, r: 5, color: '#fff' });
const enemyAt = (x, y) => ({ x, y, originX: x, hp: 2, r: 18, age: 0, phase: 0, speed: 0, fireTimer: 20, type: 'scout' });

test('difficulty sets survivability and invalid difficulty falls back', () => {
  assert.equal(createGame({ difficulty: 'easy' }).player.hp, 7);
  assert.equal(createGame({ difficulty: 'hard' }).player.hp, 3);
  assert.equal(createGame({ difficulty: 'invalid' }).difficulty, 'normal');
});

test('diagonal movement has the same speed and stays inside the battlefield', () => {
  const straight = running(), diagonal = running();
  step(straight, 0.3, { x: 1 }); step(diagonal, 0.3, { x: 1, y: -1 });
  assert.ok(Math.abs((straight.player.x - 500) - Math.hypot(diagonal.player.x - 500, diagonal.player.y - 580)) < 0.01);
  step(straight, 3, { x: 1, y: 1 });
  assert.equal(straight.player.x, straight.width - 25);
  assert.equal(straight.player.y, straight.height - 28);
  updateGame(straight, 1 / 120, { dragX: -10000, dragY: -10000 });
  assert.equal(straight.player.x, 25); assert.equal(straight.player.y, 48);
});

test('precision movement slows the craft, and a large frame cannot teleport it', () => {
  const g = running(); step(g, 0.5, { x: 1, precise: true });
  assert.ok(Math.abs(g.player.x - 575) < 0.01);
  updateGame(g, 10, { x: 1 }); assert.ok(g.player.x < 600);
});

test('manual firing respects input, cooldown, and weapon levels', () => {
  const g = running(); step(g, 0.2); assert.equal(g.shots.length, 0);
  updateGame(g, 1 / 120, { fire: true }); assert.equal(g.shots.length, 1);
  updateGame(g, 1 / 120, { fire: true }); assert.equal(g.shots.length, 1);
  g.shots = []; g.player.cooldown = 0; g.player.level = 3;
  updateGame(g, 1 / 120, { fire: true }); assert.equal(g.shots.length, 3);
});

test('multiple overlapping bullets only deal one hit during invulnerability', () => {
  const g = running(); g.bullets = [bulletAt(g.player), bulletAt(g.player), bulletAt(g.player)];
  step(g, 1 / 120); assert.equal(g.player.hp, 4);
  g.bullets.push(bulletAt(g.player)); step(g, 0.1); assert.equal(g.player.hp, 4);
  step(g, 1.8); g.bullets.push(bulletAt(g.player)); step(g, 1 / 120); assert.equal(g.player.hp, 3);
});

test('one enemy can only award score once even with simultaneous projectiles', () => {
  const g = running(); g.enemies = [enemyAt(500, 250)];
  g.shots = Array.from({ length: 4 }, () => ({ x: 500, y: 250, vx: 0, vy: 0, r: 4, damage: 1 }));
  step(g, 1 / 120); assert.equal(g.kills, 1); assert.equal(g.score, 80); assert.equal(g.enemies.length, 0);
});

test('nova consumes one charge, clears bullets and lasers, damages enemies and protects the player', () => {
  const g = running(); g.enemies = [enemyAt(400, 150)];
  g.bullets = [bulletAt(g.player)]; g.lasers = [{ x: 500, width: 42, age: 2, warning: 1.5, duration: 0.7 }];
  assert.equal(activateNova(g), true); assert.equal(g.player.novas, 1);
  assert.equal(g.bullets.length, 0); assert.equal(g.lasers.length, 0); assert.equal(g.kills, 1);
  assert.ok(g.player.invincible >= 1.5); assert.equal(activateNova(g), false);
  step(g, 0.7); assert.equal(activateNova(g), true); assert.equal(g.player.novas, 0);
  step(g, 0.7); assert.equal(activateNova(g), false); assert.equal(g.player.novas, 0);
});

test('pausing freezes all combat state and rejects nova', () => {
  const g = running(); step(g, 3, { fire: true }); g.mode = 'paused';
  const before = snapshot(g); step(g, 10, { x: 1, fire: true, nova: true });
  assert.deepEqual(snapshot(g), before); assert.equal(activateNova(g), false);
});

test('six kills guarantee a weapon drop, and pickup upgrades the actual gun', () => {
  const g = running(); g.enemies = Array.from({ length: 6 }, (_, i) => enemyAt(100 + i * 90, 200));
  activateNova(g); assert.equal(g.pickups.length, 1); assert.equal(g.pickups[0].kind, 'power');
  g.player.x = g.pickups[0].x; g.player.y = g.pickups[0].y;
  step(g, 1 / 120); assert.equal(g.player.level, 2); assert.equal(g.pickups.length, 0);
});

test('pickups cap weapons, repair health and cap nova supply', () => {
  const g = running(); g.player.level = 3; g.player.hp = 4; g.player.novas = 3;
  g.pickups = ['power', 'shield', 'nova'].map(kind => ({ ...g.player, kind, age: 0, r: 17 }));
  step(g, 1 / 120);
  assert.equal(g.player.level, 3); assert.equal(g.player.hp, 5); assert.equal(g.player.novas, 3);
  assert.ok(g.player.invincible >= 3); assert.equal(g.score, 300);
});

test('completing a wave repairs one health, awards its bonus and clears hostile shots', () => {
  const g = running(); g.spawned = 14; g.player.hp = 2; g.bullets = [bulletAt(g.player)];
  step(g, 1 / 120); assert.equal(g.wave, 2); assert.equal(g.player.hp, 3);
  assert.equal(g.score, 500); assert.equal(g.bullets.length, 0);
});

test('all four waves progress to the boss even if enemies escape', () => {
  const g = running(); g.player.invincible = 1000;
  step(g, 120);
  assert.equal(g.wave, 5); assert.equal(g.boss.kind, 'sentinel'); assert.ok(g.boss.y >= 100);
  assert.equal(g.mode, 'playing'); assert.ok(g.bullets.length > 0 && g.bullets.length < 300);
});

function bossBattle(wave = 10, options) {
  const g = running(options); g.wave = wave - 1; g.spawned = waveEnemyCount(g);
  step(g, 1 / 120); g.boss.y = 115; return g;
}

test('boss telegraphs lasers before damage; nova removes an active laser', () => {
  const g = bossBattle(); g.boss.laserTimer = 0; g.player.invincible = 0;
  step(g, 1 / 120); assert.equal(g.lasers.length, 2);
  g.player.x = g.lasers[0].x;
  const hp = g.player.hp;
  for (let i = 0; i < 120; i++) { g.bullets = []; updateGame(g, 1 / 120); }
  assert.equal(g.player.hp, hp);
  for (let i = 0; i < 65; i++) { g.bullets = []; updateGame(g, 1 / 120); }
  assert.equal(g.player.hp, hp - 1);
  activateNova(g); assert.equal(g.lasers.length, 0);
});

test('low-health boss fires the second phase and nova deals real boss damage', () => {
  const g = bossBattle(); g.boss.hp = 150; g.boss.fireTimer = 0;
  step(g, 1 / 120); assert.equal(g.bullets.length, 19);
  activateNova(g); assert.equal(g.boss.hp, 100);
});

test('the final shot wins once and clears hazards; terminal state stays frozen', () => {
  const g = bossBattle(); g.boss.hp = 1;
  g.shots.push({ x: g.boss.x, y: g.boss.y, vx: 0, vy: 0, r: 4, damage: 1 });
  step(g, 1 / 120); assert.equal(g.mode, 'won'); assert.equal(g.boss.hp, 0);
  assert.equal(g.bullets.length, 0); assert.ok(g.score >= 5000);
  const before = snapshot(g); step(g, 3, { fire: true, nova: true }); assert.deepEqual(snapshot(g), before);
});

test('losing the final hull point ends the run and restart creates a clean state', () => {
  const g = running(); g.player.hp = 1; g.bullets.push(bulletAt(g.player)); step(g, 1 / 120);
  assert.equal(g.mode, 'lost'); assert.equal(g.player.hp, 0);
  const fresh = running(); assert.equal(fresh.score, 0); assert.equal(fresh.player.hp, 5); assert.equal(fresh.wave, 1);
});

test('wave 5 is a distinct mid-boss; killing it continues to wave 6 instead of winning', () => {
  const g = bossBattle(5); assert.equal(g.boss.kind, 'sentinel');
  assert.ok(g.boss.maxHp < bossBattle(10).boss.maxHp);
  g.boss.hp = 1; activateNova(g);
  assert.equal(g.mode, 'playing'); assert.equal(g.wave, 5); assert.equal(g.boss.hp, 0);
  step(g, 2.6); assert.equal(g.wave, 6); assert.equal(g.boss, null);
  step(g, 3); assert.ok(g.enemies.length > 0);
});

test('a full campaign reaches mid-boss 5, final boss 10, and never wave 11', () => {
  const g = running(); g.player.invincible = 1000;
  const bosses = new Set();
  for (let i = 0; i < 400 * 60 && g.mode === 'playing'; i++) {
    if (g.boss) bosses.add(`${g.wave}:${g.boss.kind}`);
    updateGame(g, 1 / 60, { fire: true, dragX: g.boss?.hp > 0 ? g.boss.x - g.player.x : 0 });
    g.events = [];
  }
  assert.deepEqual([...bosses], ['5:sentinel', '10:eclipse']);
  assert.equal(g.mode, 'won'); assert.equal(g.wave, 10);
  step(g, 20, { fire: true }); assert.equal(g.wave, 10);
});

test('two pilots move and fire independently without friendly fire', () => {
  const g = running({ playerCount: 2 }); const [p1, p2] = g.players;
  const initial = [p1.x, p2.x];
  step(g, 0.3, { players: [{ x: -1, fire: true }, { x: 1, y: -1, fire: true }] });
  assert.ok(p1.x < initial[0] - 90); assert.ok(p2.x > initial[1] + 60);
  assert.equal(p1.y, 580); assert.ok(p2.y < 520);
  assert.ok(g.shots.some(s => s.owner === 0)); assert.ok(g.shots.some(s => s.owner === 1));
  p2.x = p1.x; p2.y = p1.y - 60;
  step(g, 0.4, { players: [{ fire: true }, {}] });
  assert.equal(p1.hp, 5); assert.equal(p2.hp, 5);
});

test('a downed pilot cannot move, shoot, collect or nova, while their teammate continues', () => {
  const g = running({ playerCount: 2 }); const [p1, p2] = g.players;
  p1.hp = 1; g.bullets.push(bulletAt(p1)); step(g, 1 / 120);
  assert.equal(p1.hp, 0); assert.equal(g.mode, 'playing');
  const x = p1.x, p2x = p2.x;
  g.pickups.push({ x: p1.x, y: p1.y, r: 17, kind: 'shield', age: 0 });
  step(g, 0.3, { players: [{ x: 1, fire: true }, { x: 1, fire: true }] });
  assert.equal(p1.x, x); assert.equal(p1.hp, 0); assert.equal(activateNova(g, 0), false);
  assert.ok(p2.x > p2x); assert.ok(g.shots.every(s => s.owner === 1));
});

test('both pilots must be down to lose, including simultaneous hits', () => {
  const g = running({ playerCount: 2 });
  for (const p of g.players) { p.hp = 1; g.bullets.push(bulletAt(p)); }
  step(g, 1 / 120); assert.equal(g.mode, 'lost'); assert.deepEqual(g.players.map(p => p.hp), [0, 0]);
});

test('a surviving teammate revives the downed pilot on the next wave with half hull', () => {
  const g = running({ playerCount: 2 }); const [p1, p2] = g.players;
  p1.hp = 0; p1.level = 2; p2.hp = 3; g.spawned = waveEnemyCount(g);
  step(g, 1 / 120); assert.equal(g.wave, 2); assert.equal(p1.hp, 3); assert.equal(p2.hp, 4);
  assert.equal(p1.level, 2); assert.ok(p1.invincible > 0); assert.equal(g.player, p1);
});

test('power and nova inventories belong to the collecting pilot', () => {
  const g = running({ playerCount: 2 }); const [p1, p2] = g.players;
  g.pickups.push({ x: p2.x, y: p2.y, r: 17, kind: 'power', age: 0 });
  step(g, 1 / 120); assert.equal(p1.level, 1); assert.equal(p2.level, 2);
  assert.equal(activateNova(g, 1), true); assert.equal(p2.novas, 1); assert.equal(p1.novas, 2);
  assert.ok(p1.invincible > 0); assert.ok(p2.invincible > 0);
  assert.equal(activateNova(g, 0), true); assert.equal(p1.novas, 1); assert.equal(p2.novas, 1);
});

test('co-op scales the enemy count and boss hull, and enemies target living players', () => {
  const solo = bossBattle(10), coop = bossBattle(10, { playerCount: 2 });
  assert.ok(coop.boss.maxHp > solo.boss.maxHp);
  assert.ok(waveEnemyCount(running({ playerCount: 2 })) > waveEnemyCount(running()));
  coop.player.hp = 0; coop.boss.fireTimer = 0;
  step(coop, 1 / 120); assert.ok(coop.bullets.length > 0); assert.equal(coop.mode, 'playing');
  assert.ok(coop.bullets.every(b => Number.isFinite(b.vx) && Number.isFinite(b.vy)));
});
