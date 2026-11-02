// Flying between the two airports: the player sits by a cabin window while the cabin climbs to
// about 430 m and crosses the town, the sea and the Japanese island below, through clouds.
import * as THREE from 'three';
import { displace } from './geom.js';
import { xformPt } from './quests.js';

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ease = (t) => t * t * (3 - 2 * t);

export class Flight {
  constructor(g) {
    this.g = g; // {engine, scene, player, build, hud, sfx, places, life, state, props, sky}
    this.cabin = null;
    this.active = null;
    this.look = { yaw: 0, pitch: 0 };
  }

  ensure() {
    if (this.cabin) return true;
    const A = this.g.props.airplane;
    if (!A?.buildCabin) return false;
    const c = A.buildCabin({ wing: false });
    c.group.visible = false;
    this.g.engine.scene.add(c.group);
    this.cabin = c;
    // fellow passengers ride along as children of the cabin
    let seed = 300;
    for (const sp of c.npcSpots ?? []) {
      if (!this.g.life?.buildCharacter) break;
      const ch = this.g.life.person(seed++, 'casual');
      ch.group.position.set(...sp.pos);
      ch.group.rotation.y = sp.yaw ?? 0;
      ch.update?.(0, { speed: 0, mode: 'sit' });
      c.group.add(ch.group);
      (this.people ??= []).push(ch);
    }
    // a band of clouds along the route
    const geo = displace(new THREE.IcosahedronGeometry(1, 3), (x, y, z) => Math.sin(x * 3.1 + z * 2.2) * 0.08 + Math.sin(y * 4.3 + x * 1.7) * 0.06);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xdfe8f2, emissiveIntensity: 0.25 });
    const n = 90;
    const im = new THREE.InstancedMesh(geo, mat, n * 3);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    let k = 0;
    for (let i = 0; i < n; i++) {
      const x = 200 + Math.random() * 2000, z = (Math.random() - 0.5) * 520, y = 360 + Math.random() * 120;
      const s = 18 + Math.random() * 26;
      for (let j = 0; j < 3; j++) {
        m.compose(new THREE.Vector3(x + (j - 1) * s * 0.9, y + (j === 1 ? s * 0.25 : 0), z + (Math.random() - 0.5) * s), q, new THREE.Vector3(s * (j === 1 ? 1.2 : 0.9), s * 0.55, s * 0.8));
        im.setMatrixAt(k++, m);
      }
    }
    im.count = k;
    im.castShadow = false;
    im.visible = false;
    im.computeBoundingSphere();
    this.g.engine.scene.add(im);
    this.clouds = im;
    return true;
  }

  /** Fly from one airport site to another. Resolves when the player stands in the arrival hall. */
  async fly(fromKey, toKey, text) {
    const g = this.g, P = g.places;
    const from = P.sites[fromKey], to = P.sites[toKey];
    if (!from || !to) return false;
    const f = $('fade');
    f.textContent = '✈️ 탑승 중…';
    f.classList.add('on');
    g.sfx('done');
    await wait(1000);
    const okCabin = this.ensure();
    const start = new THREE.Vector3(from.worldPos[0], 0, from.worldPos[2] - 60);
    const end = new THREE.Vector3(to.worldPos[0], 0, to.worldPos[2] - 60);
    const dir = Math.sign(end.x - start.x) || 1;
    g.player.frozen = true;
    g.build.enabled = false;
    if (g.player.avatar) g.player.avatar.group.visible = false;
    if (g.player.arm) g.player.arm.group.visible = false;
    if (okCabin) {
      this.cabin.group.visible = true;
      if (this.cabin.meal) this.cabin.meal.visible = true;
      this.clouds.visible = true;
      this.active = { t: 0, dur: 18, start, end, yaw: dir > 0 ? -Math.PI / 2 : Math.PI / 2, ate: false };
      this.look.yaw = 0.42; this.look.pitch = -0.3;
      g.sky.fogScale = 0.22; // clear air up high so the land below shows through the window
      this.update(0);
      await wait(200);
      f.classList.remove('on');
      g.hud.toast(text, 3200);
      setTimeout(() => this.active && this.cabin.meal && g.hud.toast('E: 기내식 먹기 🍱', 2400), 3600);
      await new Promise((r) => { this.done = r; });
      f.textContent = '🛬 도착!';
      f.classList.add('on');
      await wait(1100);
      this.cabin.group.visible = false;
      this.clouds.visible = false;
    } else {
      f.textContent = '✈️ 날아가는 중…';
      await wait(2200);
    }
    g.sky.fogScale = 1;
    // arrival hall, facing the exit
    const [x, y, z] = xformPt(to, [0, 0.2, 4]);
    g.player.place(x, y, z, to.worldYaw + Math.PI);
    g.player.frozen = false;
    g.build.enabled = true;
    if (g.player.avatar) g.player.avatar.group.visible = g.player.view === 'third';
    if (g.player.arm) g.player.arm.group.visible = g.player.view === 'first';
    this.active = null;
    f.classList.remove('on');
    return true;
  }

  update(dt, input) {
    const a = this.active;
    if (!a) return;
    a.t += dt;
    const k = Math.min(1, a.t / a.dur);
    const x = THREE.MathUtils.lerp(a.start.x, a.end.x, ease(k));
    const z = THREE.MathUtils.lerp(a.start.z, a.end.z, ease(k)) + Math.sin(k * Math.PI) * 60;
    const alt = 300 * Math.min(1, ease(Math.min(1, k / 0.22)), ease(Math.min(1, (1 - k) / 0.22))) + 40;
    const grp = this.cabin.group;
    grp.position.set(x, alt + Math.sin(a.t * 1.3) * 0.3, z);
    const climb = k < 0.22 ? 0.12 : k > 0.78 ? -0.1 : 0;
    grp.rotation.set(0, a.yaw, 0);
    grp.rotateX(climb);
    grp.rotateZ(Math.sin(a.t * 0.4) * 0.02 + (k > 0.3 && k < 0.45 ? 0.06 : 0));
    this.g.sky.focus.set(x, alt, z);
    if (input) {
      this.look.yaw = THREE.MathUtils.clamp(this.look.yaw - input.mouse.dx * 0.002, -1.0, 1.1);
      this.look.pitch = THREE.MathUtils.clamp(this.look.pitch - input.mouse.dy * 0.002, -0.6, 0.5);
      if (input.hit('KeyE') && this.cabin.meal?.visible) {
        this.cabin.meal.visible = false;
        this.g.state.food = Math.min(100, this.g.state.food + 30);
        this.g.sfx('eat');
        this.g.hud.toast('기내식 냠냠! 불고기 덮밥 (배고픔 +30)', 2200);
      }
    }
    for (const p of this.people ?? []) p.update?.(dt, { speed: 0, mode: 'sit' });
    // camera at the window seat
    const s = this.cabin.seat;
    grp.updateMatrixWorld(true);
    const eye = new THREE.Vector3(s.pos[0] + 0.12, s.pos[1] + 0.04, s.pos[2] + 0.12).applyMatrix4(grp.matrixWorld);
    const cam = this.g.engine.camera;
    cam.position.copy(eye);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((s.pitch ?? 0) + this.look.pitch, (s.yaw ?? 0) + this.look.yaw, 0, 'YXZ'));
    const wq = new THREE.Quaternion(); grp.getWorldQuaternion(wq);
    cam.quaternion.copy(wq.multiply(q));
    if (k >= 1 && this.done) { const d = this.done; this.done = null; d(); }
  }
}
