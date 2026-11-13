// 먹을수록 배가 나오는 주인공. setFat(1~3.6) 으로 몸이 커지고, bite() 로 한 입 먹는 동작을 한다.
import * as THREE from 'three';
import { mat, part } from './foods.js';

const SKIN = '#ffd2a8';
const S = (r, w = 24, h = 16) => new THREE.SphereGeometry(r, w, h);

export class Character {
  constructor() {
    this.root = new THREE.Group();
    this.fat = 1; this.shownFat = 1; this.biteT = 0; this.walkT = 0; this.jiggle = 0; this.moving = 0; this.cheer = 0;
    this.shirtMat = new THREE.MeshStandardMaterial({ color: '#ff7a59', roughness: 0.75 });
    this.pantsMat = new THREE.MeshStandardMaterial({ color: '#3b5bdb', roughness: 0.8 });
    const skin = mat(SKIN, { rough: 0.6 });

    this.body = new THREE.Group(); this.root.add(this.body);
    this.belly = part(S(0.42, 28, 20), this.shirtMat, 0, 0, 0, [1, 1.15, 0.92]);
    this.pants = part(new THREE.SphereGeometry(0.428, 28, 12, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38), this.pantsMat, 0, 0, 0, [1, 1.15, 0.92]);
    this.button = part(S(0.035, 8, 6), mat('#ffffff'), 0, 0.02, 0.39);
    this.body.add(this.belly, this.pants, this.button);

    this.legs = [1, -1].map((s) => {
      const g = new THREE.Group();
      g.add(part(new THREE.CapsuleGeometry(0.11, 0.3, 4, 10), this.pantsMat, 0, -0.22, 0), part(S(0.14, 12, 8), mat('#ffffff', { rough: 0.5 }), 0, -0.46, 0.05, [1, 0.6, 1.5]));
      g.userData.side = s; this.root.add(g); return g;
    });
    this.arms = [1, -1].map((s) => {
      const g = new THREE.Group();
      g.add(part(new THREE.CapsuleGeometry(0.085, 0.3, 4, 10), this.shirtMat, 0, -0.2, 0), part(S(0.1, 12, 8), skin, 0, -0.44, 0));
      g.userData.side = s; this.root.add(g); return g;
    });
    this.hand = new THREE.Group(); this.hand.position.set(0, -0.5, 0.06); this.arms[0].add(this.hand);

    this.head = new THREE.Group(); this.root.add(this.head);
    this.head.add(part(S(0.34, 28, 20), skin, 0, 0, 0, [1, 0.95, 0.95]));
    this.hair = part(new THREE.SphereGeometry(0.355, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), mat('#3a2718', { rough: 0.9 }), 0, 0.03, -0.03, [1, 0.95, 0.98]);
    this.hair.rotation.x = -0.25; this.head.add(this.hair);
    for (const s of [1, -1]) {
      this.head.add(part(S(0.045, 10, 8), mat('#20232a', { rough: 0.2 }), 0.12 * s, 0.05, 0.295, [1, 1.25, 0.6]), part(S(0.014, 6, 4), mat('#ffffff'), 0.13 * s, 0.07, 0.32),
        part(S(0.07, 10, 8), skin, 0.335 * s, 0, 0));
    }
    this.cheeks = [1, -1].map((s) => { const c = part(S(0.085, 12, 8), mat('#ff9d9d', { rough: 0.7 }), 0.2 * s, -0.07, 0.25, [1, 0.75, 0.5]); this.head.add(c); return c; });
    this.mouth = part(S(0.06, 12, 8), mat('#7a1f2b', { rough: 0.5 }), 0, -0.11, 0.3, [1.2, 0.35, 0.4]); this.head.add(this.mouth);
    this.hat = new THREE.Group(); this.head.add(this.hat);
    this.food = null; this.foodScale = 1;
    this.setFat(1, true);
  }

  setSkin(k) {
    this.rainbow = k.shirt === 'rainbow';
    if (!this.rainbow) this.shirtMat.color.set(k.shirt);
    this.pantsMat.color.set(k.pants);
    this.hat.clear(); this.hair.visible = true;
    const h = this.hat, add = (...m) => m.forEach((x) => h.add(x));
    if (k.hat === 'hood') { add(part(new THREE.SphereGeometry(0.38, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), this.shirtMat, 0, 0.0, -0.04)); h.children[0].rotation.x = -0.35; this.hair.visible = false; }
    if (k.hat === 'chick') { add(part(new THREE.SphereGeometry(0.37, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), mat('#ffe066'), 0, 0.02, -0.02), part(new THREE.ConeGeometry(0.06, 0.12, 8), mat('#ff922b'), 0, 0.22, 0.33)); h.children[0].rotation.x = -0.2; h.children[1].rotation.x = Math.PI / 2; this.hair.visible = false; }
    if (k.hat === 'dino') { add(part(new THREE.SphereGeometry(0.37, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), mat('#51cf66'), 0, 0.02, -0.02)); h.children[0].rotation.x = -0.2; for (let i = 0; i < 4; i += 1) add(part(new THREE.ConeGeometry(0.06, 0.14, 4), mat('#2f9e44', { flat: true }), 0, 0.4 - i * 0.045, 0.1 - i * 0.14)); this.hair.visible = false; }
    if (k.hat === 'bunny') { add(part(new THREE.SphereGeometry(0.37, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), mat('#ffc2df'), 0, 0.02, -0.02)); h.children[0].rotation.x = -0.2; for (const s of [1, -1]) { const e = part(new THREE.CapsuleGeometry(0.06, 0.3, 4, 10), mat('#ffc2df'), 0.14 * s, 0.52, -0.02); e.rotation.z = -0.15 * s; add(e); } this.hair.visible = false; }
    if (k.hat === 'chef') add(part(new THREE.CylinderGeometry(0.2, 0.22, 0.2, 20), mat('#ffffff'), 0, 0.38, -0.02), part(S(0.26, 16, 12), mat('#ffffff'), 0, 0.56, -0.02, [1, 0.6, 1]));
    if (k.hat === 'crown') { add(part(new THREE.CylinderGeometry(0.22, 0.2, 0.14, 20, 1, true), mat('#ffd43b', { metal: 0.8, rough: 0.25 }), 0, 0.36, -0.02)); for (let i = 0; i < 6; i += 1) { const a = (i / 6) * 6.28; add(part(new THREE.ConeGeometry(0.05, 0.12, 4), mat('#ffd43b', { metal: 0.8, rough: 0.25 }), Math.sin(a) * 0.2, 0.48, Math.cos(a) * 0.2 - 0.02), part(S(0.025, 6, 5), mat('#ff3b4e', { emissive: '#ff3b4e', glow: 0.5 }), Math.sin(a) * 0.21, 0.37, Math.cos(a) * 0.21 - 0.02)); } }
    if (k.hat === 'star') { const st = part(new THREE.OctahedronGeometry(0.13), mat('#ffe066', { emissive: '#ffd43b', glow: 0.9 }), 0, 0.62, 0); add(st); this.star = st; }
  }

  setFood(model) {
    if (this.food) this.hand.remove(this.food);
    this.food = model;
    if (model) { this.hand.add(model); model.position.set(0, 0.02, 0.1); }
  }

  setFat(f, now = false) { this.fat = f; if (now) { this.shownFat = f; this.layout(0); } }

  get radius() { return 0.42 * (1 + (this.shownFat - 1)) * 1.02; }
  get height() { return this.headY + 0.36 * this.headS; }

  layout(t) {
    const f = this.shownFat - 1, j = this.jiggle * Math.sin(t * 28) * 0.05;
    const sx = 1 + f + j, sy = 1 + f * 0.55 - j * 0.6, bellyY = 0.45 + 0.483 * sy;
    this.body.position.y = bellyY; this.body.scale.set(sx, sy, sx);
    this.button.scale.set(1 / sx, 1 / sy, 1 / sx);
    this.headS = 1 + f * 0.32;
    this.headY = bellyY + 0.483 * sy * 0.82 + 0.24 * this.headS;
    this.head.position.y = this.headY; this.head.scale.setScalar(this.headS);
    const swing = Math.sin(this.walkT) * 0.7 * this.moving;
    this.legs.forEach((l) => { const s = l.userData.side; l.position.set(0.17 * s * (1 + f * 0.75), 0.56, 0); l.scale.setScalar(1 + f * 0.25); l.rotation.x = swing * s; });
    const eat = this.biteT > 0 ? Math.sin(Math.min(1, this.biteT) * Math.PI) : 0;
    this.arms.forEach((a) => {
      const s = a.userData.side, as = 1 + f * 0.4;
      a.position.set(0.41 * s * sx * 0.96, bellyY + 0.2 * sy, 0.02); a.scale.setScalar(as);
      a.rotation.set(-swing * s * 0.8, 0, s * (0.35 + f * 0.22));
      if (this.cheer > 0) { a.rotation.z = s * 2.6; a.rotation.x = Math.sin(t * 14) * 0.3; }
    });
    // 오른팔은 음식을 들고 있다. 먹을 때 입으로 올린다.
    const hold = this.food ? 1 : 0, ra = this.arms[0];
    if (hold && this.cheer <= 0) { ra.rotation.x = -1.15 - eat * 1.0; ra.rotation.z = 0.25 - eat * 0.75; ra.rotation.y = -eat * 0.5; } else ra.rotation.y = 0;
    this.hand.scale.setScalar(1 / (1 + f * 0.4));
    if (this.food) this.food.scale.setScalar(this.foodScale * (1 + Math.min(f, 3.2) * 0.35) * (1 - eat * 0.25));
    this.mouth.scale.set(1.2 + eat * 0.5, 0.35 + eat * 1.6, 0.4);
    const puff = 1 + f * 0.22 + (this.biteT > 0 ? 0.25 * Math.abs(Math.sin(t * 20)) : 0);
    this.cheeks.forEach((c) => c.scale.set(puff, 0.75 * puff, 0.5));
    const wob = Math.sin(this.walkT) * 0.06 * this.moving * (1 + f * 0.5);
    this.root.rotation.z = wob;
    this.root.position.y = Math.abs(Math.sin(this.walkT)) * 0.07 * this.moving + (this.cheer > 0 ? Math.abs(Math.sin(t * 9)) * 0.5 : 0);
  }

  bite() { this.biteT = 1; this.jiggle = 1; }

  update(dt, t, moving) {
    this.shownFat += (this.fat - this.shownFat) * Math.min(1, dt * 5);
    this.moving += ((moving ? 1 : 0) - this.moving) * Math.min(1, dt * 10);
    if (moving) this.walkT += dt * (9 - Math.min(4, (this.shownFat - 1) * 1.6));
    this.biteT = Math.max(0, this.biteT - dt * 5.5);
    this.jiggle = Math.max(0, this.jiggle - dt * 3);
    this.cheer = Math.max(0, this.cheer - dt);
    if (this.rainbow) this.shirtMat.color.setHSL((t * 0.15) % 1, 0.85, 0.6);
    if (this.star) this.star.rotation.y = t * 2;
    this.layout(t);
  }
}

// 기네스 심사위원 (저울 옆에 서 있는 사람)
export function makeJudge() {
  const g = new THREE.Group(), suit = mat('#27345c'), skin = mat(SKIN, { rough: 0.6 });
  g.add(part(new THREE.CapsuleGeometry(0.3, 0.55, 6, 14), suit, 0, 0.95, 0), part(S(0.26, 20, 14), skin, 0, 1.68, 0),
    part(new THREE.SphereGeometry(0.275, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), mat('#8d8d94', { rough: 0.9 }), 0, 1.7, -0.02),
    part(new THREE.BoxGeometry(0.1, 0.3, 0.04), mat('#e63946'), 0, 1.12, 0.29), part(new THREE.BoxGeometry(0.3, 0.08, 0.04), mat('#ffffff'), 0, 1.33, 0.27));
  for (const s of [1, -1]) {
    g.add(part(new THREE.CapsuleGeometry(0.09, 0.4, 4, 8), mat('#1c2333'), 0.13 * s, 0.3, 0), part(S(0.11, 10, 8), mat('#111318'), 0.13 * s, 0.06, 0.05, [1, 0.6, 1.5]),
      part(S(0.035, 8, 6), mat('#20232a'), 0.09 * s, 1.72, 0.235), part(new THREE.TorusGeometry(0.06, 0.012, 6, 14), mat('#111318'), 0.09 * s, 1.72, 0.25));
  }
  const armL = part(new THREE.CapsuleGeometry(0.075, 0.4, 4, 8), suit, -0.38, 1.05, 0.1); armL.rotation.x = -0.9; g.add(armL);
  const armR = part(new THREE.CapsuleGeometry(0.075, 0.4, 4, 8), suit, 0.38, 1.0, 0); armR.rotation.z = 0.2; g.add(armR);
  g.add(part(new THREE.BoxGeometry(0.42, 0.52, 0.07), mat('#c92a2a', { rough: 0.4 }), -0.3, 1.15, 0.4), part(new THREE.BoxGeometry(0.3, 0.1, 0.075), mat('#ffd43b', { metal: 0.6, rough: 0.3 }), -0.3, 1.25, 0.4));
  g.children.at(-1).rotation.x = g.children.at(-2).rotation.x = -0.25;
  return g;
}
