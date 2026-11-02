// Town life: people at their places (coworkers, clerk, BBQ guests), people walking the
// sidewalks, and cars driving the avenue (they U-turn at the ends and stop for you).
import * as THREE from 'three';
import { LAYOUT } from './world.js';
import { rng } from './noise.js';

const ROLE_OUTFIT = { coworker: 'office', receptionist: 'office', clerk: 'office', client: 'suit', chef: 'chef', guest: 'casual', boss: 'suit', guard: 'office', staff: 'office' };
const HAIRS = ['short', 'spiky', 'bob', 'long', 'bun'];
const HAIR_COLORS = [0x2a211c, 0x3b2a20, 0x1c1a1a, 0x5a3a24, 0x2e2420];
const SKINS = [0xf1c9a5, 0xe8b894, 0xf6d5b8, 0xd9a47e];
const CAR_COLORS = [0xd8d8d4, 0x2b2d31, 0xc23b32, 0x3f6fb5, 0x8a9096, 0xe9e4d8, 0x2f5a46, 0xb8873a];
const STYLES = ['sedan', 'hatch', 'suv', 'taxi', 'van', 'sedan'];

function nameTag(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(20,24,34,0.78)'; g.beginPath(); g.roundRect(4, 6, 248, 52, 18); g.fill();
  g.fillStyle = '#ffe39a'; g.font = '32px Jua, sans-serif'; g.textAlign = 'center'; g.fillText(text, 128, 44);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, transparent: true }));
  sp.scale.set(0.9, 0.225, 1);
  sp.position.set(0, 2.05, 0);
  return sp;
}

export class Life {
  constructor({ engine, places, buildCharacter, buildCar, colliders, groundAt }) {
    this.engine = engine;
    this.places = places;
    this.buildCharacter = buildCharacter;
    this.buildCar = buildCar;
    this.col = colliders;
    this.groundAt = groundAt;
    this.people = [];
    this.walkers = [];
    this.cars = [];
    this.R = rng(42);
  }

  person(seed, outfit) {
    const R = rng(seed * 97 + 3);
    const pick = (a) => a[Math.floor(R() * a.length)];
    return this.buildCharacter({ skin: pick(SKINS), hair: pick(HAIRS), hairColor: pick(HAIR_COLORS), outfit, seed });
  }

  spawnPeople() {
    if (!this.buildCharacter) return;
    let seed = 1;
    for (const sp of this.places.npcSpots) {
      const ch = this.person(seed++, ROLE_OUTFIT[sp.role] ?? (sp.site === 'restaurant' ? 'casual' : 'office'));
      ch.group.position.copy(sp.wpos);
      ch.group.rotation.y = sp.wyaw;
      this.engine.scene.add(ch.group);
      if (sp.role === 'boss') ch.group.add(nameTag('김 부장님'));
      this.people.push({ ch, mode: sp.pose === 'type' ? 'type' : sp.pose === 'sit' ? 'sit' : 'idle', base: sp.pose, site: sp.site, wave: 0, t: this.R() * 10 });
    }
    // sidewalk walkers
    for (let i = 0; i < 8; i++) {
      const side = i % 2 ? 1 : -1;
      const ch = this.person(100 + i, ['casual', 'office', 'casual', 'suit'][i % 4]);
      this.engine.scene.add(ch.group);
      const x = -240 + this.R() * 500;
      this.walkers.push({ ch, x, z: side * (LAYOUT.roadHalf + 1.2 + this.R() * 2), dir: this.R() < 0.5 ? 1 : -1, speed: 1.1 + this.R() * 0.5, pause: 0, x0: LAYOUT.roadX[0], x1: LAYOUT.roadX[1], y: 0.16 });
    }
    // Japan street walkers
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1;
      const ch = this.person(200 + i, ['casual', 'casual', 'office', 'suit'][i % 4]);
      this.engine.scene.add(ch.group);
      this.walkers.push({ ch, x: LAYOUT.jMin[0] + 20 + this.R() * 250, z: side * (LAYOUT.jRoadHalf + 1.1), dir: this.R() < 0.5 ? 1 : -1, speed: 1.0 + this.R() * 0.4, pause: 0, x0: LAYOUT.jMin[0], x1: LAYOUT.jMax[0], y: 0.14 });
    }
  }

  spawnTraffic(n = 7) {
    if (!this.buildCar) return;
    for (let i = 0; i < n; i++) {
      const m = this.buildCar({ color: CAR_COLORS[i % CAR_COLORS.length], style: STYLES[i % STYLES.length] });
      this.engine.scene.add(m.group);
      const dir = i % 2 ? 1 : -1; // +1 east (south lane), -1 west (north lane)
      const car = { m, dir, x: -250 + (i / n) * 520, z: dir * 5.25, speed: 10, want: 10 + this.R() * 3, yaw: dir > 0 ? -Math.PI / 2 : Math.PI / 2, turn: null, spin: 0, pos: new THREE.Vector3(), radius: 1.1 };
      car.box = this.col.add({ min: [0, 0, 0], max: [0, 0, 0], tag: 'traffic' });
      for (const mt of m.headMats ?? []) mt.emissiveIntensity = 0.2;
      this.cars.push(car);
    }
  }

  cheers(site) { for (const p of this.people) if (p.site === site) p.wave = 3; }

  update(dt, playerPos, playerCar, night) {
    const cam = this.engine.camera.position;
    for (const p of this.people) {
      const far = p.ch.group.position.distanceToSquared(cam) > 70 * 70;
      p.ch.group.visible = !far;
      if (far) continue;
      p.t += dt;
      if (p.wave > 0) p.wave -= dt;
      const mode = p.wave > 0 ? 'wave' : p.base === 'type' ? 'type' : p.base === 'sit' ? (Math.sin(p.t * 0.3) > 0.7 ? 'eat' : 'sit') : 'idle';
      p.ch.update?.(dt, { speed: 0, mode });
    }
    const [x0, x1] = LAYOUT.roadX;
    for (const w of this.walkers) {
      if (w.pause > 0) w.pause -= dt;
      else {
        w.x += w.dir * w.speed * dt;
        if (w.x > w.x1 - 10 || w.x < w.x0 + 10) { w.dir *= -1; w.pause = 1 + this.R() * 2; }
        if (this.R() < dt * 0.02) w.pause = 2 + this.R() * 3;
      }
      const g = w.ch.group;
      g.position.set(w.x, w.y, w.z);
      g.rotation.y = w.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      const far = g.position.distanceToSquared(cam) > 90 * 90;
      g.visible = !far;
      if (!far) w.ch.update?.(dt, { speed: w.pause > 0 ? 0 : w.speed, mode: w.pause > 0 ? 'idle' : 'walk' });
    }
    // cars
    const others = [...this.cars];
    for (const c of this.cars) {
      if (c.turn) {
        c.turn.a += (c.speed / c.turn.r) * dt;
        const a = Math.min(Math.PI, c.turn.a);
        c.x = c.turn.cx + c.turn.sx * Math.sin(a) * c.turn.r;
        c.z = c.turn.from * Math.cos(a);
        c.yaw = c.turn.y0 + a;
        if (c.turn.a >= Math.PI) { c.dir *= -1; c.z = c.dir * 5.25; c.yaw = c.dir > 0 ? -Math.PI / 2 : Math.PI / 2; c.turn = null; }
      } else {
        // look ahead for things in this lane
        let gap = 99;
        const ahead = (x, z) => { const d = (x - c.x) * c.dir; if (d > 0 && Math.abs(z - c.z) < 2.4) gap = Math.min(gap, d); };
        for (const o of others) if (o !== c) ahead(o.x, o.z);
        if (playerCar) ahead(playerCar.x, playerCar.z);
        if (playerPos) ahead(playerPos.x, playerPos.z);
        const target = gap < 7 ? 0 : gap < 16 ? c.want * (gap - 7) / 9 : c.want;
        c.speed += (target - c.speed) * Math.min(1, dt * (target < c.speed ? 3 : 0.8));
        c.x += c.dir * c.speed * dt;
        if ((c.dir > 0 && c.x > x1 - 6) || (c.dir < 0 && c.x < x0 + 6)) c.turn = { a: 0, r: 5.25, cx: c.x, sx: c.dir, from: c.z, y0: c.yaw };
      }
      c.spin -= c.speed * dt / 0.34;
      const y = this.groundAt(c.x, c.z);
      c.m.group.position.set(c.x, y, c.z);
      c.m.group.rotation.y = c.yaw;
      for (const w of c.m.wheels ?? []) { w.pivot.rotation.order = 'YXZ'; w.pivot.rotation.x = c.spin; if (w.steer) w.pivot.rotation.y = c.turn ? 0.45 : 0; }
      for (const mt of c.m.headMats ?? []) mt.emissiveIntensity = night > 0.3 ? 3.2 : 0.25;
      for (const mt of c.m.brakeMats ?? []) mt.emissiveIntensity = c.speed < c.want * 0.6 ? 2.2 : night > 0.3 ? 1 : 0.35;
      c.m.group.visible = Math.hypot(c.x - cam.x, c.z - cam.z) < 160;
      c.pos.set(c.x, y, c.z);
      const r = 1.6;
      c.box.min[0] = c.x - r; c.box.max[0] = c.x + r; c.box.min[2] = c.z - r; c.box.max[2] = c.z + r; c.box.min[1] = y; c.box.max[1] = y + 1.5;
      this.col.remove(c.box); this.col.add(c.box);
    }
  }
}
