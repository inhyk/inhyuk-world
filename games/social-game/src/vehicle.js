// Drivable car: arcade physics on the terrain, collisions with tall boxes, chase / driver cameras.
import * as THREE from 'three';
import { bodyFree } from './collide.js';
import { pushOut } from '../online.mjs';
import { keepIn } from './world.js';

const tmp = [];

export class Vehicle {
  /** model = buildCar() result: {group, body, wheels, steeringWheel, driverEye, size, headMats, brakeMats} */
  constructor(engine, model, colliders, groundAt) {
    this.engine = engine;
    this.m = model;
    this.col = colliders;
    this.groundAt = groundAt;
    this.pos = new THREE.Vector3();
    this.yaw = 0;          // forward = (-sin yaw, 0, -cos yaw)
    this.speed = 0;        // m/s along forward
    this.steer = 0;
    this.y = 0;
    this.pitch = 0; this.roll = 0;
    this.wheelSpin = 0;
    this.driving = false;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.lights = false;
    this.half = { w: (model.size?.w ?? 1.9) / 2, l: (model.size?.l ?? 4.4) / 2 };
    // three boxes along the body (front, middle, back) so the collider follows the car's shape at any angle
    this.boxes = [0, 1, 2].map(() => colliders.add({ min: [0, 0, 0], max: [0, 0, 0], tag: 'car' }));
    this.box = this.boxes[1];
    this.others = []; // other cars {pos, radius}
    // 같이 사는 동네: friends' cars and friends on foot, solid while I drive ([{x, z, r, y, person}], town.js)
    this.solids = [];
    this.bump = null; // this frame: { what: 'car' | 'person', speed } when I bumped into a friend's car / a friend
    engine.scene.add(model.group);
  }

  park(x, z, yaw) {
    this.pos.set(x, 0, z);
    this.yaw = yaw;
    this.speed = 0;
    this.y = this.support(x, z);
    this.sync(0);
  }

  get forward() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  /** Ground height under the car including low boxes (curbs, ramps) it can drive over. */
  support(x, z) {
    let h = this.groundAt(x, z);
    const list = this.col.query(x - 0.6, z - 0.6, x + 0.6, z + 0.6, tmp);
    for (const b of list) if (b.tag !== 'car' && b.max[1] <= h + 0.35 && b.max[1] > h) h = b.max[1];
    return h;
  }

  /** Circles along the car's length used for collisions. */
  circles() {
    const f = this.forward, out = [];
    for (const k of [-1, 0, 1]) out.push({ x: this.pos.x + f.x * k * (this.half.l - this.half.w), z: this.pos.z + f.z * k * (this.half.l - this.half.w), r: this.half.w });
    return out;
  }

  update(dt, input) {
    let throttle = 0, steerIn = 0, brake = false;
    if (this.driving && input) {
      if (input.down('KeyW') || input.down('ArrowUp')) throttle += 1;
      if (input.down('KeyS') || input.down('ArrowDown')) throttle -= 1;
      if (input.down('KeyA') || input.down('ArrowLeft')) steerIn += 1;
      if (input.down('KeyD') || input.down('ArrowRight')) steerIn -= 1;
      throttle -= input.stick.y; steerIn -= input.stick.x;
      throttle = THREE.MathUtils.clamp(throttle, -1, 1); steerIn = THREE.MathUtils.clamp(steerIn, -1, 1);
      brake = input.down('Space');
    }
    const maxF = 24, maxR = 7;
    if (throttle > 0) this.speed += (this.speed < 0 ? 14 : 7.5 * (1 - Math.max(0, this.speed) / maxF)) * throttle * dt;
    else if (throttle < 0) this.speed += (this.speed > 0 ? -16 : -5 * (1 - Math.max(0, -this.speed) / maxR)) * -throttle * dt;
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), (2.2 + Math.abs(this.speed) * 0.08) * dt);
    if (brake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 22 * dt);
    this.speed = THREE.MathUtils.clamp(this.speed, -maxR, maxF);
    const maxSteer = 0.55 / (1 + Math.abs(this.speed) * 0.06);
    this.steer += (steerIn * maxSteer - this.steer) * Math.min(1, dt * 6);
    const wheelBase = this.half.l * 1.25;
    this.yaw += (this.speed * Math.tan(this.steer) / wheelBase) * dt;
    const f = this.forward;
    const nx = this.pos.x + f.x * this.speed * dt, nz = this.pos.z + f.z * this.speed * dt;
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.x = nx; this.pos.z = nz;
    this.friendHit = null;
    let hit = this.resolve();
    // the fence at the edge of the land (인혁 계획 6): the car stops short of it
    if (keepIn(this.pos, this.half.l + 0.4)) { hit = hit || true; if (this.driving) this.onEdge?.(); }
    this.bump = this.friendHit ? { what: this.friendHit, speed: Math.abs(this.speed) } : null;
    if (hit) {
      this.impact = Math.abs(this.speed);
      this.speed *= -0.25;
      if (hit === 'stuck') { this.pos.x = ox; this.pos.z = oz; }
    } else {
      this.impact = 0;
      // a friend's car: bounce back a little, no damage. a friend on foot: stop gently in front of them
      if (this.friendHit === 'car') this.speed *= -0.25;
      else if (this.friendHit === 'person') this.speed = 0;
    }
    // ride height and tilt from the ground under the wheels
    const fl = this.half.l * 0.8, fw = this.half.w * 0.8;
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const hF = this.support(this.pos.x - s * fl, this.pos.z - c * fl), hB = this.support(this.pos.x + s * fl, this.pos.z + c * fl);
    const hL = this.support(this.pos.x - c * fw, this.pos.z + s * fw), hR = this.support(this.pos.x + c * fw, this.pos.z - s * fw);
    const target = (hF + hB + hL + hR) / 4;
    this.y += (target - this.y) * Math.min(1, dt * 12);
    this.pitch += (Math.atan2(hF - hB, fl * 2) - this.pitch) * Math.min(1, dt * 10);
    this.roll += (Math.atan2(hL - hR, fw * 2) - this.roll) * Math.min(1, dt * 10);
    this.wheelSpin -= this.speed * dt / 0.34;
    this.sync(dt, throttle);
  }

  /** Push out of boxes taller than a curb and out of other cars. Returns false | true | 'stuck'. */
  resolve() {
    let hit = false;
    // friends (같이 사는 동네) only stop my car while I drive: a friend's car never shoves my parked one
    const friends = this.driving ? this.solids.filter((s) => Math.abs(s.y - this.y) < 2) : [];
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      if (friends.length) {
        const p = pushOut(this.circles(), friends);
        if (p.car || p.person) { this.pos.x += p.x; this.pos.z += p.z; moved = true; this.friendHit = p.car ? 'car' : 'person'; }
      }
      for (const cc of this.circles()) {
        const list = this.col.query(cc.x - cc.r, cc.z - cc.r, cc.x + cc.r, cc.z + cc.r, tmp);
        for (const b of list) {
          // 'friend': the boxes of friends' cars (for walking), handled above as circles
          if (b.tag === 'car' || b.tag === 'friend' || b.tag === 'curb' || b.max[1] < this.y + 0.45 || b.min[1] > this.y + 1.6) continue;
          const px = THREE.MathUtils.clamp(cc.x, b.min[0], b.max[0]), pz = THREE.MathUtils.clamp(cc.z, b.min[2], b.max[2]);
          let dx = cc.x - px, dz = cc.z - pz;
          const d = Math.hypot(dx, dz);
          if (d >= cc.r) continue;
          if (d < 1e-4) return 'stuck';
          const push = cc.r - d;
          this.pos.x += (dx / d) * push; this.pos.z += (dz / d) * push;
          hit = moved = true;
        }
        for (const o of this.others) {
          const dx = cc.x - o.pos.x, dz = cc.z - o.pos.z, d = Math.hypot(dx, dz), r = cc.r + o.radius;
          if (d < r && d > 1e-4) { this.pos.x += (dx / d) * (r - d); this.pos.z += (dz / d) * (r - d); hit = moved = true; o.bumped = 1; }
        }
      }
      if (!moved) break;
    }
    return hit;
  }

  sync(dt, throttle = 0) {
    const g = this.m.group;
    g.position.set(this.pos.x, this.y, this.pos.z);
    g.rotation.set(0, this.yaw, 0);
    if (this.m.body) {
      this.m.body.rotation.x = this.pitch + THREE.MathUtils.clamp(-throttle * 0.015 * Math.min(1, Math.abs(this.speed) / 4), -0.03, 0.03);
      this.m.body.rotation.z = this.roll + THREE.MathUtils.clamp(this.steer * this.speed * 0.004, -0.04, 0.04);
    }
    for (const w of this.m.wheels ?? []) {
      w.pivot.rotation.order = 'YXZ';
      w.pivot.rotation.x = this.wheelSpin;
      if (w.steer) w.pivot.rotation.y = this.steer;
    }
    if (this.m.steeringWheel) this.m.steeringWheel.rotation.z = this.steer * 4;
    const braking = this.driving && (throttle < 0 && this.speed > 0.5);
    for (const mt of this.m.brakeMats ?? []) mt.emissiveIntensity = braking ? 3.2 : this.lights ? 1.4 : 0.35;
    for (const mt of this.m.headMats ?? []) mt.emissiveIntensity = this.lights ? 3.2 : 0.25;
    // collider box around the parked/driven car (so the player can't walk through it)
    const cs = this.circles();
    this.boxes.forEach((b, i) => {
      const c = cs[i], r = c.r * 0.92;
      b.min[0] = c.x - r; b.max[0] = c.x + r; b.min[2] = c.z - r; b.max[2] = c.z + r;
      b.min[1] = this.y; b.max[1] = this.y + 1.4;
      this.col.remove(b); this.col.add(b);
    });
  }

  /** Camera: 'third' chase or 'first' driver seat. */
  updateCamera(dt, view, look = { yaw: 0, pitch: 0 }) {
    const cam = this.engine.camera;
    if (view === 'first') {
      const e = new THREE.Vector3(...(this.m.driverEye ?? [-0.38, 1.18, 0.1]));
      this.m.group.updateMatrixWorld();
      const world = e.clone().applyMatrix4(this.m.group.matrixWorld);
      cam.position.copy(world);
      const y = this.yaw + look.yaw, p = -0.06 + look.pitch;
      cam.lookAt(world.clone().add(new THREE.Vector3(-Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p))));
      return;
    }
    const f = this.forward;
    const back = 7.2 + Math.abs(this.speed) * 0.08;
    const want = new THREE.Vector3(this.pos.x - f.x * back, this.y + 2.7, this.pos.z - f.z * back);
    const rot = new THREE.Vector3(want.x - this.pos.x, 0, want.z - this.pos.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), look.yaw);
    want.x = this.pos.x + rot.x; want.z = this.pos.z + rot.z; want.y += look.pitch * -4;
    const g = this.groundAt(want.x, want.z) + 0.6;
    if (want.y < g) want.y = g;
    // keep the camera out of walls
    const piv = new THREE.Vector3(this.pos.x, this.y + 1.6, this.pos.z);
    const dir = want.clone().sub(piv); const len = dir.length(); dir.normalize();
    const hit = this.col.ray(piv.toArray(), dir.toArray(), len, 'car');
    if (hit < len) want.copy(piv).addScaledVector(dir, Math.max(1.5, hit - 0.4));
    if (this.camPos.lengthSq() === 0 || this.camPos.distanceTo(want) > 30) this.camPos.copy(want);
    this.camPos.lerp(want, Math.min(1, dt * 6));
    this.camLook.set(this.pos.x + f.x * 3, this.y + 1.1, this.pos.z + f.z * 3);
    cam.position.copy(this.camPos);
    cam.lookAt(this.camLook);
  }

  /** Where the driver gets out (left side). */
  exitPoint() { return exitSpot(this.col, this.groundAt, this.pos, this.y, this.yaw, this.half, 1); }
}

/**
 * A free spot next to a car to get out. side 1 = the driver's (left) side first, -1 = the right side first;
 * then the other side, then behind and in front.
 */
export function exitSpot(col, groundAt, pos, y0, yaw, half, side = 1) {
  const s = Math.sin(yaw), c = Math.cos(yaw);
  const at = (d, along = 0) => new THREE.Vector3(pos.x - c * d - s * along, y0, pos.z + s * d - c * along);
  const w = half.w, l = half.l;
  const tries = [at(side * (w + 0.8)), at(side * (w + 1.3)), at(-side * (w + 0.8)), at(-side * (w + 1.3)), at(0, l + 1.0), at(0, -(l + 1.0)), at(side * (w + 2.2))];
  for (const p of tries) {
    const y = Math.max(p.y, groundAt(p.x, p.z));
    if (bodyFree(col, p.x, y + 0.05, p.z)) { p.y = y; return p; }
  }
  return tries[0];
}
