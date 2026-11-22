// 잡기 화면: 방울을 밀어 던져서 몬스터를 담는다
import * as THREE from 'three';
import { buildStage, Sparks } from './stage.js';
import { buildMon } from './monsters.js';
import { catchChance, fleeChance, ringColor, species, ELEMENTS } from '../core.mjs';

const BALL_COL = { ball: ['#5fd8ff', '#1f9fe0'], ball2: ['#c79aff', '#7a4fd0'], ball3: ['#ffe07a', '#f0a81c'] };
const sph = new THREE.SphereGeometry(1, 28, 20), torus = new THREE.TorusGeometry(1, 0.07, 10, 40), ringGeo = new THREE.RingGeometry(0.94, 1, 64), ringGeo2 = new THREE.RingGeometry(0.9, 1, 64);
const starShape = (() => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.45 : 1; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: false }).translate(0, 0, -0.1); })();

function buildBall() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(sph, new THREE.MeshStandardMaterial({ color: '#5fd8ff', emissive: '#1f9fe0', emissiveIntensity: 0.7, roughness: 0.3 })); core.scale.setScalar(0.62); g.add(core);
  const shell = new THREE.Mesh(sph, new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, transparent: true, opacity: 0.32, clearcoat: 1, depthWrite: false })); g.add(shell);
  const band = new THREE.Mesh(torus, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, emissive: '#ffffff', emissiveIntensity: 0.25 })); band.rotation.x = Math.PI / 2; g.add(band);
  const star = new THREE.Mesh(starShape, new THREE.MeshStandardMaterial({ color: '#fff3a0', emissive: '#ffd84a', emissiveIntensity: 0.8 })); star.scale.setScalar(0.3); star.position.z = 0.95; g.add(star);
  const shine = new THREE.Mesh(sph, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 })); shine.scale.set(0.2, 0.12, 0.05); shine.position.set(-0.4, 0.55, 0.68); shine.lookAt(-0.8, 1.1, 1.4); g.add(shine);
  g.traverse((o) => { if (o.isMesh && o !== shell) o.castShadow = true; });
  g.userData = { core, band, setType(t) { core.material.color.set(BALL_COL[t][0]); core.material.emissive.set(BALL_COL[t][1]); } };
  return g;
}
const ease = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

export class Encounter {
  constructor() { this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900); this.active = false; this.w = 1; this.h = 1; }
  resize(w, h) { this.w = w; this.h = h; this.camera.aspect = w / h; this.camera.fov = w < h ? 60 : 52; this.camera.updateProjectionMatrix(); }
  // hooks: sfx(name), say(text, kind), useBall() -> 남은 방울이 있으면 true, done(result), changed()
  start(mon, biome, mood, hooks) {
    this.mon = mon; this.hooks = hooks; this.active = true; this.t = 0; this.tries = 0; this.finished = false; this.popped = false; this.puffed = false; this.bonus = 0; this.shinyT = undefined; this.result = false; this.berry = null; this.gold = false; this.ballType = 'ball';
    const st = buildStage(biome, mood, mon.lv * 7 + mon.iv[0]); this.scene = st.scene; this.sparks = new Sparks(this.scene);
    const m = (this.model = buildMon(mon.sp, mon.shiny)); this.ms = 1.7; m.scale.multiplyScalar(this.ms);
    this.R = m.userData.radius * this.ms; this.cy = Math.max(m.userData.center * this.ms, this.R * 0.9); this.zM = -4.0 - this.R * 1.5;
    this.holder = new THREE.Group(); this.holder.position.set(0, 0, this.zM); this.holder.add(m); this.scene.add(this.holder); this.monScale = 0;
    // 과녁 고리
    this.ringOut = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide }));
    this.ringIn = new THREE.Mesh(ringGeo2, new THREE.MeshBasicMaterial({ color: '#4be06a', transparent: true, opacity: 0.95, depthTest: false, side: THREE.DoubleSide }));
    this.ringOut.renderOrder = 10; this.ringIn.renderOrder = 11; this.scene.add(this.ringOut, this.ringIn); this.ringS = 1;
    this.bubble = new THREE.Mesh(sph, new THREE.MeshPhysicalMaterial({ color: '#bfefff', roughness: 0.05, transparent: true, opacity: 0.4, clearcoat: 1, emissive: '#7fd8ff', emissiveIntensity: 0.4, depthWrite: false })); this.bubble.visible = false; this.scene.add(this.bubble);
    this.ball = buildBall(); this.ball.scale.setScalar(0.2); this.scene.add(this.ball);
    this.state = 'intro'; this.st = 0; this.hold = false; this.hist = []; this.vel = new THREE.Vector3(); this.act = null; this.actT = 2.5 + Math.random() * 2; this.hopY = 0; this.sway = 0;
    this.rest = new THREE.Vector3(); this.updateCamera(0); this.placeRest(); this.ball.position.copy(this.rest);
    if (mon.shiny) this.shinyT = 0.9;
    hooks.sfx('appear');
  }
  stop() { this.active = false; if (this.scene) this.scene.traverse((o) => { if (o.isInstancedMesh) o.dispose(); }); this.scene = null; }
  chance(bonus = 0) { return catchChance(this.mon, this.ballType, this.berry, bonus); }
  setBall(t) { this.ballType = t; this.ball.userData.setType(t); this.hooks.changed(); }
  feed(kind) { if (this.state !== 'aim') return false; if (kind === 'gberry') this.gold = true; else this.berry = 'berry'; const p = new THREE.Vector3(0, this.cy + this.R, this.zM); this.sparks.burst(p, ['#ff7aa8', '#ffb3c6'], 10, { shape: 'heart', speed: 1.6, gravity: -1.5, life: 1.3, size: 0.2 }); this.act = { t: 'happy', d: 0.9 }; this.hooks.sfx('berry'); this.hooks.changed(); return true; }
  updateCamera(k) { const far = 1 - ease(k); this.camera.position.set(far * 2.5, 1.5 + far * 2.2, 3.3 + far * 3.5); this.camera.lookAt(0, this.cy * 0.8 + 0.25, this.zM); this.camera.updateMatrixWorld(); }
  ndc(x, y) { return new THREE.Vector2((x / this.w) * 2 - 1, -(y / this.h) * 2 + 1); }
  pointAt(n, dist) { const v = new THREE.Vector3(n.x, n.y, 0.5).unproject(this.camera).sub(this.camera.position).normalize(); return this.camera.position.clone().addScaledVector(v, dist); }
  placeRest() { this.rest.copy(this.pointAt(new THREE.Vector2(0, this.w < this.h ? -0.6 : -0.56), 2.0)); }
  down(x, y) { if (!this.active || this.state !== 'aim' || y < this.h * 0.45) return; this.hold = true; this.hist = [[performance.now(), x, y]]; this.px = x; this.py = y; }
  move(x, y) { if (!this.hold) return; this.px = x; this.py = y; this.hist.push([performance.now(), x, y]); if (this.hist.length > 12) this.hist.shift(); }
  up(x, y) {
    if (!this.hold) return; this.hold = false; const now = performance.now(); this.hist.push([now, x, y]);
    const old = this.hist.find((p) => now - p[0] < 130) || this.hist[0], dt = Math.max(16, now - old[0]) / 1000;
    const vx = (x - old[1]) / dt, vy = (y - old[2]) / dt;
    if (-vy < this.h * 0.45) return; // 살짝만 움직이면 던지지 않는다
    if (!this.hooks.useBall(this.ballType)) return;
    const p = Math.min(1.4, Math.max(0.5, -vy / (this.h * 2.5))), side = Math.max(-1.2, Math.min(1.2, vx / Math.max(200, -vy)));
    const P0 = this.ball.position, T = new THREE.Vector3(0, this.cy, this.zM), tf = 0.72, g = 12;
    const v = new THREE.Vector3((T.x - P0.x) / tf, (T.y - P0.y + 0.5 * g * tf * tf) / tf, (T.z - P0.z) / tf);
    this.vel.set(v.x + side * Math.abs(v.z) * 0.8, v.y * (0.8 + 0.2 * p), v.z * (0.62 + 0.38 * p)); this.state = 'fly'; this.st = 0; this.tries++; this.hooks.sfx('throw'); this.hooks.changed();
  }
  setState(s) { this.state = s; this.st = 0; this.hooks.changed(); }
  update(dt) {
    if (!this.active) return; const t = (this.t += dt); this.st += dt; const m = this.model, cam = this.camera;
    m.userData.update(t);
    // 몬스터 움직임
    let hop = 0, guard = false, squash = 1;
    if (this.state === 'aim' || this.state === 'fly') {
      this.actT -= dt;
      if (!this.act && this.actT <= 0 && this.state === 'aim') { const rare = species(this.mon.sp).rare; this.act = Math.random() < 0.55 ? { t: 'hop', d: 0.8 } : { t: 'guard', d: 1.1 }; this.act.e = 0; this.actT = Math.max(1.6, 5.5 - rare * 0.7) + Math.random() * 3; if (this.act.t === 'guard') this.hooks.sfx('guard'); }
    }
    if (this.act) { const a = this.act; a.e = (a.e || 0) + dt; const k = a.e / a.d; if (a.t === 'hop') hop = Math.sin(Math.PI * Math.min(1, k)) * (1.1 + this.R * 0.5); else if (a.t === 'guard') { guard = k > 0.15 && k < 0.9; m.rotation.y = k * Math.PI * 4; } else if (a.t === 'happy') { hop = Math.abs(Math.sin(k * Math.PI * 3)) * 0.3; } if (k >= 1) { this.act = null; m.rotation.y = 0; } }
    this.hopY = hop; this.guarding = guard;
    if (m.userData.float) this.sway = Math.sin(t * 0.9) * 0.7;
    if (this.state === 'intro') { this.updateCamera(this.st / 1.1); this.monScale = ease((this.st - 0.25) / 0.5) * (1 + Math.sin(Math.min(1, Math.max(0, (this.st - 0.25) / 0.6)) * Math.PI) * 0.15); if (this.st > 0.3 && !this.popped) { this.popped = true; this.sparks.burst(new THREE.Vector3(0, 0.3, this.zM), ['#ffffff', '#e8f6ff'], 14, { speed: 3, life: 0.6, size: 0.2, up: 0.5 }); } if (this.st > 1.15) { this.setState('aim'); this.placeRest(); } }
    if (this.shinyT !== undefined && this.state === 'aim') { this.shinyT -= dt; if (this.shinyT < 0) { this.shinyT = undefined; this.sparks.burst(new THREE.Vector3(0, this.cy, this.zM), ['#fff3a0', '#ffffff', '#ffd84a'], 22, { shape: 'star', speed: 3.5, gravity: 2, life: 1.2, size: 0.22 }); this.hooks.sfx('shiny'); this.hooks.say('반짝이다!', 'gold'); } }
    if (this.state !== 'capture' && this.state !== 'drop' && this.state !== 'wobble' && this.state !== 'caught' && this.state !== 'fled') { this.holder.position.set(this.sway, hop, this.zM); this.holder.scale.setScalar(this.monScale); }
    // 과녁
    const center = new THREE.Vector3(this.sway, this.cy + hop, this.zM);
    const showRing = this.state === 'aim' || this.state === 'fly';
    this.ringOut.visible = this.ringIn.visible = showRing;
    if (showRing) {
      if (this.state === 'aim') { this.ringS -= dt * 0.55; if (this.ringS < 0.12) this.ringS = 1; }
      const R = this.R * 1.15; this.ringOut.position.copy(center); this.ringIn.position.copy(center); this.ringOut.quaternion.copy(cam.quaternion); this.ringIn.quaternion.copy(cam.quaternion); this.ringOut.scale.setScalar(R); this.ringIn.scale.setScalar(R * this.ringS);
      this.ringIn.material.color.set(guard ? '#ff4b4b' : ringColor(this.chance())); this.ringOut.material.opacity = guard ? 0.3 : 0.9;
    }
    // 방울
    const b = this.ball;
    if (this.state === 'aim' || this.state === 'intro') {
      b.visible = this.state === 'aim'; b.scale.setScalar(0.2);
      const want = this.hold ? this.pointAt(this.ndc(this.px, this.py), 1.9) : this.rest.clone().add(new THREE.Vector3(0, Math.sin(t * 2.4) * 0.03, 0));
      b.position.lerp(want, Math.min(1, dt * (this.hold ? 30 : 10))); b.rotation.y += dt * (this.hold ? 6 : 1.2); b.rotation.x = Math.sin(t) * 0.2;
    } else if (this.state === 'fly') {
      this.vel.y -= 12 * dt; b.position.addScaledVector(this.vel, dt); b.rotation.x -= dt * 14;
      const d = b.position.distanceTo(center);
      if (d < this.R * 1.2 + 0.3 && this.monScale > 0.9) {
        if (guard) { this.vel.set((Math.random() - 0.5) * 6, 5, 4); this.setState('miss'); this.hooks.say('튕겨 냈다!', 'bad'); this.hooks.sfx('deflect'); this.sparks.burst(b.position, '#ffffff', 8, { speed: 3, life: 0.4 }); }
        else { const s = this.ringS; this.bonus = s < 0.4 ? 3 : s < 0.65 ? 2 : s < 0.9 ? 1 : 0; if (this.bonus) this.hooks.say(['', '좋아요!', '멋져요!', '완벽해요!'][this.bonus], 'good' + this.bonus); this.hooks.sfx('hit'); this.sparks.burst(b.position, ['#ffffff', BALL_COL[this.ballType][0]], 12, { speed: 3, life: 0.5 }); this.hitPos = center.clone(); this.setState('capture'); this.hooks.changed(); }
      } else if (b.position.y < 0.2 || b.position.z < this.zM - 6 || this.st > 2.2) { if (b.position.y < 0.2) { b.position.y = 0.2; this.vel.y = Math.abs(this.vel.y) * 0.4; this.vel.multiplyScalar(0.6); } this.setState('miss'); this.hooks.sfx('miss'); }
    } else if (this.state === 'miss') {
      this.vel.y -= 12 * dt; b.position.addScaledVector(this.vel, dt); if (b.position.y < 0.2) { b.position.y = 0.2; this.vel.y = Math.abs(this.vel.y) * 0.45; } b.scale.setScalar(0.2 * Math.max(0, 1 - this.st / 0.7));
      if (this.st > 0.75) { this.setState('aim'); b.position.copy(this.rest).y -= 0.8; this.hooks.changed(); }
    } else if (this.state === 'capture') {
      // 방울이 커져서 몬스터를 감싸고, 몬스터는 빛이 되어 작아진다
      const k = this.st / 0.9, c = this.hitPos; b.visible = false; this.bubble.visible = true; this.bubble.material.color.set(BALL_COL[this.ballType][0]); this.bubble.material.emissive.set(BALL_COL[this.ballType][1]);
      const grow = ease(k / 0.35), shrink = ease((k - 0.45) / 0.55); const rr = THREE.MathUtils.lerp(0.25, this.R * 1.35, grow) * (1 - shrink) + 0.24 * shrink;
      this.bubble.position.set(c.x, c.y + shrink * 1.0, c.z); this.bubble.scale.setScalar(rr); this.holder.position.set(c.x, (c.y - this.cy) + shrink * (this.cy + 1.0 - 0.0), c.z); this.holder.scale.setScalar(this.monScale * (1 - shrink)); m.rotation.y += dt * 14 * shrink;
      if (Math.random() < 0.5) this.sparks.one(new THREE.Vector3(c.x + (Math.random() - 0.5) * this.R * 2, c.y + (Math.random() - 0.5) * this.R * 2, c.z), '#ffffff', { speed: 0.6, life: 0.4, size: 0.08, gravity: 0 });
      if (k >= 1) { this.holder.visible = false; this.bubble.visible = false; b.visible = true; b.position.set(c.x, c.y + 1.0, c.z); b.scale.setScalar(0.24); b.rotation.set(0, 0, 0); this.vy = 0; this.setState('drop'); const ok = Math.random() < this.chance(this.bonus); this.result = ok; this.shakes = ok ? 3 : Math.floor(Math.random() * 3); this.wob = 0; this.berry = null; }
    } else if (this.state === 'drop') {
      this.vy -= 16 * dt; b.position.y += this.vy * dt; if (b.position.y < 0.24) { b.position.y = 0.24; if (Math.abs(this.vy) > 1.5) { this.vy = -this.vy * 0.4; this.hooks.sfx('bounce'); } else { this.vy = 0; if (this.st > 0.9) this.setState('wobble'); } }
      cam.position.lerp(new THREE.Vector3(0, 1.2, this.zM + 4.2), Math.min(1, dt * 3)); cam.lookAt(0, 0.5, this.zM);
    } else if (this.state === 'wobble') {
      const per = 0.95, k = (this.st % per) / per, n = Math.floor(this.st / per);
      if (n > this.wob - 1 && this.wob < this.shakes + (this.result ? 0 : 1) && k > 0.3 && n === this.wob) { this.wob++; if (this.wob <= this.shakes) this.hooks.sfx('wobble'); }
      b.rotation.z = n < this.shakes && k > 0.3 && k < 0.75 ? Math.sin(((k - 0.3) / 0.45) * Math.PI * 2) * 0.55 : 0; b.position.x = this.hitPos.x + b.rotation.z * 0.1;
      if (n >= this.shakes && k > 0.35) {
        if (this.result) { this.setState('caught'); this.hooks.sfx('caught'); this.sparks.burst(b.position, ['#fff3a0', '#ffffff', '#ffd84a', BALL_COL[this.ballType][0]], 30, { shape: 'star', speed: 4.5, gravity: 5, life: 1.3, size: 0.22 }); this.hooks.say('잡았다!', 'gold'); this.hooks.changed(); }
        else { this.sparks.burst(b.position, ['#ffffff', BALL_COL[this.ballType][0]], 18, { speed: 5, life: 0.6 }); this.hooks.sfx('pop'); this.holder.visible = true; this.holder.position.set(this.sway, 0, this.zM); m.rotation.y = 0; this.escT = 0; if (Math.random() < fleeChance(this.mon)) { this.setState('fled'); this.hooks.say('도망갔다...', 'bad'); } else { this.setState('escape'); this.hooks.say('앗, 나왔다!', 'bad'); } b.visible = false; }
      }
    } else if (this.state === 'escape') {
      const k = this.st / 0.5; this.monScale = ease(k) * (1 + Math.sin(Math.min(1, k) * Math.PI) * 0.2); this.updateCamera(1); cam.position.lerp(new THREE.Vector3(0, 1.5, 3.3), 1);
      if (k >= 1.2) { this.monScale = 1; this.setState('aim'); b.visible = true; b.position.copy(this.rest).y -= 0.8; this.ringS = 1; this.hooks.changed(); }
    } else if (this.state === 'fled') {
      const k = this.st / 0.7; this.holder.scale.setScalar(Math.max(0, 1 - ease(k))); this.holder.position.x += dt * 6; if (this.st > 0.3 && !this.puffed) { this.puffed = true; this.sparks.burst(new THREE.Vector3(0, 0.6, this.zM), ['#ffffff', '#dddddd'], 16, { speed: 3, life: 0.7, size: 0.25, up: 0.4 }); this.hooks.sfx('flee'); }
      if (this.st > 1.5 && !this.finished) { this.finished = true; this.hooks.done({ caught: false, fled: true }); }
    } else if (this.state === 'caught') {
      b.position.y = 0.24 + Math.abs(Math.sin(Math.min(1, this.st / 0.5) * Math.PI)) * 0.5; b.rotation.y += dt * 3; if (Math.random() < 0.25) this.sparks.one(b.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.2, 0)), '#fff3a0', { shape: 'star', speed: 1, gravity: -1, life: 0.8, size: 0.12 });
      if (this.st > 1.5 && !this.finished) { this.finished = true; this.hooks.done({ caught: true, bonus: this.bonus, gold: this.gold, firstTry: this.tries === 1 }); }
    }
    this.sparks.update(dt, cam);
  }
  get label() { const s = species(this.mon.sp); return { name: s.name, el: ELEMENTS[s.el], chance: this.chance(), state: this.state, berry: this.berry, gold: this.gold }; }
}
