// First/third person walker: input, physics against colliders, camera.
import * as THREE from 'three';
import { moveBody } from './collide.js';

export const EYE = 1.62, RADIUS = 0.3, HEIGHT = 1.75;

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { dx: 0, dy: 0, left: false, right: false, leftPressed: false, rightPressed: false, wheel: 0 };
    this.locked = false;
    this.canvas = canvas;
    this.enabled = true;
    // virtual stick for touch screens
    this.stick = { x: 0, y: 0 };
    this.touchLook = { dx: 0, dy: 0 };
    addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
    addEventListener('mousemove', (e) => { if (this.locked) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; } });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; }
      if (e.button === 2) { this.mouse.right = true; this.mouse.rightPressed = true; }
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.left = false; if (e.button === 2) this.mouse.right = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('wheel', (e) => { if (this.locked) this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
  }
  lock() { if (!this.locked && !matchMedia('(pointer: coarse)').matches) this.canvas.requestPointerLock?.()?.catch?.(() => {}); }
  down(code) { return this.enabled && this.keys.has(code); }
  hit(code) { return this.enabled && this.pressed.has(code); }
  endFrame() { this.pressed.clear(); this.mouse.dx = this.mouse.dy = 0; this.mouse.leftPressed = this.mouse.rightPressed = false; this.mouse.wheel = 0; this.touchLook.dx = this.touchLook.dy = 0; }
}

export class Player {
  constructor(engine, input, colliders, groundAt) {
    this.engine = engine;
    this.input = input;
    this.col = colliders;
    this.groundAt = groundAt;
    this.pos = new THREE.Vector3(0, 0, 0);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.view = 'first'; // 'first' | 'third'
    this.camDist = 3.4;
    this.avatar = null;   // character from props/character.js (third person)
    this.arm = null;      // first person arm
    this.frozen = false;  // seated, driving, in a menu
    this.speed = 0;
    this.fallStart = null;
    this.onLand = null;   // (fallHeight) => void
    this.bob = 0;
    this.camPos = new THREE.Vector3();
    this.stepTimer = 0;
    this.onStep = null;
  }

  place(x, y, z, yaw = this.yaw) { this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.yaw = yaw; this.pitch = 0; }

  setAvatar(ch) { this.avatar = ch; ch.group.visible = this.view === 'third'; this.engine.scene.add(ch.group); }

  toggleView() {
    this.view = this.view === 'first' ? 'third' : 'first';
    if (this.avatar) this.avatar.group.visible = this.view === 'third';
    if (this.arm) this.arm.group.visible = this.view === 'first';
  }

  look(dt) {
    const i = this.input, sens = 0.0022;
    this.yaw -= (i.mouse.dx + i.touchLook.dx) * sens;
    this.pitch -= (i.mouse.dy + i.touchLook.dy) * sens;
    if (i.down('ArrowLeft')) this.yaw += dt * 2.2;
    if (i.down('ArrowRight')) this.yaw -= dt * 2.2;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.45, 1.45);
  }

  update(dt) {
    if (this.frozen) return;
    const i = this.input;
    this.look(dt);
    let fx = 0, fz = 0;
    if (i.down('KeyW') || i.down('ArrowUp')) fz -= 1;
    if (i.down('KeyS') || i.down('ArrowDown')) fz += 1;
    if (i.down('KeyA')) fx -= 1;
    if (i.down('KeyD')) fx += 1;
    fx += i.stick.x; fz += i.stick.y;
    const len = Math.hypot(fx, fz);
    if (len > 1) { fx /= len; fz /= len; }
    const run = i.down('ShiftLeft') || i.down('ShiftRight');
    const maxSpeed = (run ? 7.2 : 4.3) * (this.slow ?? 1);
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const wx = fx * c + fz * s, wz = -fx * s + fz * c;
    const accel = this.onGround ? 14 : 4;
    this.vel.x += (wx * maxSpeed - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (wz * maxSpeed - this.vel.z) * Math.min(1, accel * dt);
    if (this.onGround && i.hit('Space')) { this.vel.y = 7.2; this.onGround = false; }
    this.vel.y -= 22 * dt;
    if (this.vel.y < -40) this.vel.y = -40;
    const wasGround = this.onGround;
    const yBefore = this.pos.y;
    const r = moveBody(this.col, this.pos, RADIUS, HEIGHT, this.vel.x * dt, this.vel.y * dt, this.vel.z * dt, this.groundAt);
    if (r.hitX) this.vel.x = 0;
    if (r.hitZ) this.vel.z = 0;
    if (r.ceiling) this.vel.y = Math.min(0, this.vel.y);
    if (r.onGround) {
      if (!wasGround && this.fallStart != null) { this.onLand?.(this.fallStart - this.pos.y); }
      this.fallStart = null;
      this.vel.y = 0;
    } else if (this.fallStart == null || this.pos.y > this.fallStart) this.fallStart = Math.max(this.pos.y, yBefore);
    this.onGround = r.onGround;
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && this.speed > 0.5) {
      this.bob += dt * this.speed * 2.1;
      this.stepTimer -= dt * this.speed;
      if (this.stepTimer <= 0) { this.stepTimer = 1.55; this.onStep?.(run); }
    }
    if (this.pos.y < -30) this.pos.y = this.groundAt(this.pos.x, this.pos.z) + 1;
  }

  /** Place the camera (call after update). */
  updateCamera(dt) {
    const cam = this.engine.camera;
    const eye = new THREE.Vector3(this.pos.x, this.pos.y + EYE + Math.sin(this.bob * 2) * 0.03 * Math.min(1, this.speed / 4), this.pos.z);
    const dir = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    if (this.view === 'first') {
      cam.position.copy(eye);
      cam.lookAt(eye.clone().add(dir));
    } else {
      const pivot = eye.clone().add(new THREE.Vector3(Math.cos(this.yaw) * 0.45, 0.12, -Math.sin(this.yaw) * 0.45));
      const back = dir.clone().negate();
      const d = this.col.ray(pivot.toArray(), back.toArray(), this.camDist + 0.3);
      const dist = Math.max(0.6, Math.min(this.camDist, d - 0.3));
      const want = pivot.clone().addScaledVector(back, dist);
      const g = this.groundAt(want.x, want.z) + 0.25;
      if (want.y < g) want.y = g;
      cam.position.copy(want);
      cam.lookAt(pivot.clone().add(dir));
    }
    if (this.avatar) {
      const a = this.avatar;
      a.group.position.copy(this.pos);
      a.group.rotation.y = this.yaw;
      a.update?.(dt, { speed: this.speed, mode: this.speed > 5 ? 'run' : this.speed > 0.3 ? 'walk' : 'idle' });
    }
  }

  /** Forward look direction. */
  get forward() { return new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)); }
}
