export const SITE = { x: 0, z: 12, radius: 3.5 };
export function inPlantSite(point) {
  return Math.abs(point.x - SITE.x) <= SITE.radius && Math.abs(point.z - SITE.z) <= SITE.radius;
}
export const WALLS = [
  { x: -20, z: 0, w: 2, d: 48, h: 7, style: "boundary" },
  { x: 20, z: 0, w: 2, d: 48, h: 7, style: "boundary" },
  { x: 0, z: 24, w: 42, d: 2, h: 8, style: "boundary" },
  { x: 0, z: -24, w: 42, d: 2, h: 6, style: "boundary" },
  { x: -13, z: -10, w: 9, d: 12, h: 7.8, style: "peach" },
  { x: 13.5, z: -11, w: 8, d: 13, h: 9, style: "ivory" },
  { x: -14, z: 9, w: 7, d: 13, h: 8.2, style: "ivory" },
  { x: 14, z: 10, w: 7, d: 14, h: 7, style: "peach" },
  { x: -5.7, z: 3, w: 3.6, d: 5, h: 3.1, style: "sage" },
  { x: 5.7, z: 4, w: 3.2, d: 3.2, h: 2.5, style: "crate" },
  { x: -3.2, z: -6, w: 2.5, d: 2.5, h: 2.1, style: "crate" },
  { x: 3.7, z: 15, w: 2.8, d: 2.8, h: 2.3, style: "crate" },
  { x: -5.8, z: 17, w: 4, d: 2.5, h: 2.8, style: "sage" },
];

export const WEAPONS = {
  vandal: { name: "VANDAL", label: "밴달", mag: 25, damage: 40, head: 120, interval: 0.15, reload: 2.1, spread: 0.009 },
  phantom: { name: "PHANTOM", label: "팬텀", mag: 30, damage: 32, head: 105, interval: 0.105, reload: 1.8, spread: 0.012 },
  classic: { name: "CLASSIC", label: "클래식", mag: 12, damage: 26, head: 78, interval: 0.26, reload: 1.3, spread: 0.005 },
};
export const DIFFICULTIES = {
  rookie: { name: "연습", count: 3, reaction: 1.25, damage: 7, accuracy: 0.47, speed: 1.7 },
  normal: { name: "일반", count: 4, reaction: 0.85, damage: 9, accuracy: 0.63, speed: 2.1 },
  veteran: { name: "도전", count: 5, reaction: 0.58, damage: 12, accuracy: 0.78, speed: 2.65 },
};
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function collides(x, z, radius = 0.32) {
  return WALLS.some(w => {
    const nearX = clamp(x, w.x - w.w / 2, w.x + w.w / 2);
    const nearZ = clamp(z, w.z - w.d / 2, w.z + w.d / 2);
    return Math.hypot(x - nearX, z - nearZ) < radius;
  });
}

// Substeps keep a dash from crossing a thin wall; axes slide independently.
export function move(entity, dx, dz) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.15));
  for (let i = 0; i < steps; i++) {
    if (!collides(entity.x + dx / steps, entity.z)) entity.x += dx / steps;
    if (!collides(entity.x, entity.z + dz / steps)) entity.z += dz / steps;
  }
}

export function rayBox(origin, direction, wall) {
  let near = 0, far = Infinity;
  for (const [axis, size, middle] of [["x", wall.w, wall.x], ["y", wall.h, wall.h / 2], ["z", wall.d, wall.z]]) {
    const min = middle - size / 2, max = middle + size / 2;
    if (Math.abs(direction[axis]) < 1e-8) {
      if (origin[axis] < min || origin[axis] > max) return Infinity;
    } else {
      let a = (min - origin[axis]) / direction[axis];
      let b = (max - origin[axis]) / direction[axis];
      if (a > b) [a, b] = [b, a];
      near = Math.max(near, a);
      far = Math.min(far, b);
      if (near > far) return Infinity;
    }
  }
  return far >= 0 ? near : Infinity;
}

export function raySphere(origin, direction, center, radius) {
  const x = origin.x - center.x, y = origin.y - center.y, z = origin.z - center.z;
  const b = x * direction.x + y * direction.y + z * direction.z;
  const c = x * x + y * y + z * z - radius * radius;
  const determinant = b * b - c;
  if (determinant < 0) return Infinity;
  const near = -b - Math.sqrt(determinant), far = -b + Math.sqrt(determinant);
  return near >= 0 ? near : far >= 0 ? far : Infinity;
}

export function directionFor(yaw, pitch = 0) {
  return { x: Math.sin(yaw) * Math.cos(pitch), y: -Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) };
}

export function lineOfSight(from, to, smokes = []) {
  const delta = { x: to.x - from.x, y: (to.y ?? 1.4) - (from.y ?? 1.4), z: to.z - from.z };
  const length = Math.hypot(delta.x, delta.y, delta.z);
  if (length < 0.001) return true;
  const dir = { x: delta.x / length, y: delta.y / length, z: delta.z / length };
  const origin = { ...from, y: from.y ?? 1.4 };
  if (WALLS.some(w => rayBox(origin, dir, w) < length)) return false;
  return !smokes.some(s => distance(origin, s) < s.radius || raySphere(origin, dir, { ...s, y: 1.4 }, s.radius) < length);
}

// A small navigation grid is shared by every defender, generated only once.
const nav = new Map();
for (let x = -18; x <= 18; x++) {
  for (let z = -22; z <= 22; z++) if (!collides(x, z, 0.55)) nav.set(`${x},${z}`, { x, z });
}
export function pathTo(from, to) {
  const nearest = p => {
    const rounded = `${Math.round(p.x)},${Math.round(p.z)}`;
    if (nav.has(rounded)) return rounded;
    let key = null, best = Infinity;
    for (const [k, v] of nav) {
      const d = distance(p, v);
      if (d < best) { best = d; key = k; }
    }
    return key;
  };
  const start = nearest(from), goal = nearest(to);
  const queue = [start], previous = new Map([[start, null]]);
  for (let index = 0; index < queue.length; index++) {
    const key = queue[index];
    if (key === goal) break;
    const point = nav.get(key);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = `${point.x + dx},${point.z + dz}`;
      if (nav.has(next) && !previous.has(next)) { previous.set(next, key); queue.push(next); }
    }
  }
  if (!previous.has(goal)) return [];
  const path = [];
  for (let key = goal; key !== start; key = previous.get(key)) path.push(nav.get(key));
  return path.reverse();
}

export class Match {
  constructor({ difficulty = "normal", weapon = "vandal", random = Math.random } = {}) {
    this.difficulty = DIFFICULTIES[difficulty] ? difficulty : "normal";
    this.primary = weapon === "phantom" ? "phantom" : "vandal";
    this.random = random;
    this.score = [0, 0];
    this.round = 0;
    this.kills = 0;
    this.headshots = 0;
    this.shots = 0;
    this.hits = 0;
    this.events = [];
    this.paused = false;
    this.time = 0;
    this.newRound();
  }

  emit(type, data = {}) { this.events.push({ type, ...data }); }
  drainEvents() { return this.events.splice(0); }
  get weapon() { return WEAPONS[this.player.slot === 1 ? this.primary : "classic"]; }
  get ammo() { return this.player.ammo[this.player.slot - 1]; }
  get canPlant() { return this.phase === "active" && !this.spike && inPlantSite(this.player) && this.player.y < 0.1; }

  newRound() {
    this.round++;
    this.phase = "buy";
    this.timer = 5;
    this.spike = null;
    this.plant = 0;
    this.smokes = [];
    this.player = { x: 0, z: -18, y: 0, vy: 0, yaw: 0, pitch: 0, hp: 100, armor: 50, slot: 1,
      ammo: [WEAPONS[this.primary].mag, 12], reserve: [100, 48], reload: 0, fireDelay: 0,
      dash: 0, smoke: 2, heal: 1, healing: 0, recoil: 0, moving: false };
    const positions = [[0, 4], [-8.6, 11], [8, 12], [0, 19], [8, 0]];
    this.bots = positions.slice(0, DIFFICULTIES[this.difficulty].count).map(([x, z], i) => ({
      id: i, x, z, hp: 100, yaw: Math.PI, cooldown: 1 + i * 0.2, visibleFor: 0,
      path: [], repath: 0, seen: 0, flash: 0, defuse: 0,
    }));
    this.emit("round", { round: this.round });
  }

  switchWeapon(slot) {
    if (this.paused || !["active", "buy"].includes(this.phase) || ![1, 2].includes(slot)) return;
    this.player.slot = slot;
    this.player.reload = 0;
    this.player.fireDelay = Math.max(this.player.fireDelay, 0.25);
    this.emit("switch");
  }

  reload() {
    const p = this.player;
    if (this.paused || this.phase !== "active" || p.reload || this.ammo === this.weapon.mag || p.reserve[p.slot - 1] <= 0) return false;
    p.reload = this.weapon.reload;
    this.emit("reload");
    return true;
  }

  ability(name, input = {}) {
    if (this.paused || this.phase !== "active" || this.plant > 0) return false;
    const p = this.player;
    if (name === "dash" && p.dash <= 0) {
      let dx = input.strafe ?? 0, dz = input.forward ?? 1;
      if (!dx && !dz) dz = 1;
      const length = Math.hypot(dx, dz);
      const worldX = (Math.sin(p.yaw) * dz + Math.cos(p.yaw) * dx) / length;
      const worldZ = (Math.cos(p.yaw) * dz - Math.sin(p.yaw) * dx) / length;
      move(p, worldX * 5.5, worldZ * 5.5);
      p.dash = 12;
      this.emit("dash");
      return true;
    }
    if (name === "smoke" && p.smoke > 0) {
      const dir = directionFor(p.yaw, 0), origin = { x: p.x, y: 1.4, z: p.z };
      const nearest = Math.min(9, ...WALLS.map(w => rayBox(origin, dir, w)));
      const range = Math.max(0, nearest - 0.7);
      this.smokes.push({ x: p.x + dir.x * range, z: p.z + dir.z * range, radius: 3, life: 8, id: this.time });
      p.smoke--;
      this.emit("smoke");
      return true;
    }
    if (name === "heal" && p.heal > 0 && p.hp < 100) {
      p.heal--;
      p.healing = 4;
      this.emit("heal");
      return true;
    }
    return false;
  }

  fire() {
    const p = this.player;
    if (this.paused || this.phase !== "active" || p.reload > 0 || p.fireDelay > 0 || this.plant > 0) return false;
    if (this.ammo <= 0) { this.reload(); return false; }
    const weapon = this.weapon;
    p.ammo[p.slot - 1]--;
    p.fireDelay = weapon.interval;
    this.shots++;
    const spread = weapon.spread * (p.moving ? 2.8 : 0.3) + p.recoil * 0.015;
    const dir = directionFor(p.yaw + (this.random() - 0.5) * spread, p.pitch + (this.random() - 0.5) * spread);
    const origin = { x: p.x, y: 1.65 + p.y, z: p.z };
    let length = Math.min(80, ...WALLS.map(w => rayBox(origin, dir, w)));
    let target = null, head = false;
    for (const bot of this.bots) {
      if (bot.hp <= 0) continue;
      const headDistance = raySphere(origin, dir, { x: bot.x, y: 1.73, z: bot.z }, 0.25);
      const bodyDistance = rayBox(origin, dir, { x: bot.x, z: bot.z, h: 1.5, w: 0.65, d: 0.5 });
      const hitDistance = Math.min(headDistance, bodyDistance);
      if (hitDistance < length) { target = bot; head = headDistance <= bodyDistance; length = hitDistance; }
    }
    p.recoil = Math.min(1.5, p.recoil + 0.25);
    this.emit("shot", { origin, end: { x: origin.x + dir.x * length, y: origin.y + dir.y * length, z: origin.z + dir.z * length }, hit: !!target });
    if (target) {
      target.hp = Math.max(0, target.hp - (head ? weapon.head : weapon.damage));
      target.seen = 3;
      this.hits++;
      this.emit("hit", { head, kill: target.hp === 0, id: target.id });
      if (target.hp === 0) {
        this.kills++;
        if (head) this.headshots++;
        this.emit("kill", { head, id: target.id, weapon: weapon.name });
        if (this.bots.every(b => b.hp <= 0)) this.finishRound(true, "적 전원 처치");
      }
    }
    return true;
  }

  finishRound(won, reason) {
    if (this.phase !== "active") return;
    this.score[won ? 0 : 1]++;
    this.phase = this.score.some(s => s >= 3) ? "finished" : "roundEnd";
    this.timer = 4;
    this.result = { won, reason };
    this.plant = 0;
    this.emit("result", { won, reason, final: this.phase === "finished" });
  }

  damage(amount, bot) {
    const p = this.player;
    const shield = Math.min(p.armor, amount * 0.66);
    p.armor -= shield;
    p.hp = Math.max(0, p.hp - (amount - shield));
    this.emit("damage", { x: bot.x, z: bot.z });
    if (p.hp <= 0) this.finishRound(false, "요원 사망");
  }

  update(dt, input = {}) {
    if (this.paused || this.phase === "finished") return;
    dt = clamp(dt, 0, 0.05);
    this.time += dt;
    if (this.phase === "roundEnd") {
      this.timer -= dt;
      if (this.timer <= 0) this.newRound();
      return;
    }
    if (this.phase === "buy") {
      this.timer -= dt;
      if (this.timer <= 0) { this.phase = "active"; this.timer = 90; this.emit("go"); }
      return;
    }
    const p = this.player;
    p.fireDelay = Math.max(0, p.fireDelay - dt);
    p.dash = Math.max(0, p.dash - dt);
    p.recoil = Math.max(0, p.recoil - dt * 2);
    if (p.healing > 0) { p.hp = Math.min(100, p.hp + dt * 12.5); p.healing -= dt; }
    if (p.reload > 0) {
      p.reload = Math.max(0, p.reload - dt);
      if (!p.reload) {
        const amount = Math.min(this.weapon.mag - this.ammo, p.reserve[p.slot - 1]);
        p.ammo[p.slot - 1] += amount;
        p.reserve[p.slot - 1] -= amount;
        this.emit("reloaded");
      }
    }
    const forward = input.forward || 0, strafe = input.strafe || 0;
    const length = Math.max(1, Math.hypot(forward, strafe));
    const speed = input.walk ? 2.5 : 4.8;
    p.moving = !!(forward || strafe);
    const planting = !!input.plant && this.canPlant && !p.moving && !input.jump && !input.fire;
    if (!planting) {
      move(p, (Math.sin(p.yaw) * forward + Math.cos(p.yaw) * strafe) / length * speed * dt,
        (Math.cos(p.yaw) * forward - Math.sin(p.yaw) * strafe) / length * speed * dt);
      if (input.jump && p.y === 0) p.vy = 5;
    }
    p.vy -= dt * 15;
    p.y = Math.max(0, p.y + p.vy * dt);
    if (p.y === 0) p.vy = 0;
    this.plant = planting ? this.plant + dt : 0;
    if (this.plant >= 2.5) {
      this.spike = { x: p.x, z: p.z, timer: 25 };
      this.plant = 0;
      this.emit("planted");
    }
    if (input.fire && !planting) this.fire();
    if (this.phase !== "active") return;
    this.timer -= dt;
    if (this.spike) {
      this.spike.timer -= dt;
      if (this.spike.timer <= 0) { this.finishRound(true, "스파이크 폭발"); return; }
    } else if (this.timer <= 0) { this.finishRound(false, "작전 시간 초과"); return; }
    this.smokes.forEach(s => s.life -= dt);
    this.smokes = this.smokes.filter(s => s.life > 0);
    const config = DIFFICULTIES[this.difficulty];
    for (const bot of this.bots) {
      if (bot.hp <= 0) continue;
      bot.seen = Math.max(0, bot.seen - dt);
      bot.flash = Math.max(0, bot.flash - dt);
      const range = distance(bot, p);
      const visible = range < 35 && lineOfSight(bot, { ...p, y: 1.5 + p.y }, this.smokes);
      bot.visibleFor = visible ? bot.visibleFor + dt : 0;
      bot.cooldown = Math.max(0, bot.cooldown - dt);
      if (visible) {
        bot.yaw = Math.atan2(p.x - bot.x, p.z - bot.z);
        if (bot.visibleFor >= config.reaction && bot.cooldown <= 0) {
          bot.cooldown = 0.48 + this.random() * 0.35;
          bot.seen = 2;
          bot.flash = 0.09;
          this.emit("enemyShot", { id: bot.id, x: bot.x, z: bot.z, to: { x: p.x, y: 1.4 + p.y, z: p.z } });
          if (this.random() < config.accuracy * (p.moving ? 0.65 : 1)) this.damage(config.damage, bot);
          if (this.phase !== "active") return;
        }
      }
      const goal = this.spike || p;
      if (this.spike && distance(bot, this.spike) < 1.6 && !visible) {
        bot.defuse += dt;
        if (bot.defuse >= 7) { this.finishRound(false, "스파이크 해체됨"); return; }
      } else {
        bot.defuse = 0;
        if (!visible || range > 15 || (this.spike && distance(bot, this.spike) > 2)) {
          bot.repath -= dt;
          if (bot.repath <= 0) { bot.path = pathTo(bot, goal); bot.repath = 1.4 + bot.id * 0.13; }
          if (bot.path.length) {
            const next = bot.path[0], d = distance(bot, next);
            if (d < 0.18) bot.path.shift();
            else {
              const step = Math.min(d, config.speed * dt);
              move(bot, (next.x - bot.x) / d * step, (next.z - bot.z) / d * step);
              if (!visible) bot.yaw = Math.atan2(next.x - bot.x, next.z - bot.z);
            }
          }
        } else if (range > 4) {
          const sway = Math.sin(this.time * 1.1 + bot.id * 2) * dt * 0.6;
          move(bot, Math.cos(bot.yaw) * sway, -Math.sin(bot.yaw) * sway);
        }
      }
    }
  }
}
