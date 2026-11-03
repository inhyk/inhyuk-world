// Driver's licence test (인혁: "자동차 면허시험장도 만들어줘. 면허증이 없으면 운전 못하게").
// Drive the course through every checkpoint in order and stop in the finish box. Knocking a cone costs
// 5 points, every second over the time limit costs 1 point; 70 points or more passes.
import * as THREE from 'three';
import { xformPt } from './quests.js';

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const LIMIT = 120;

export class DriveTest {
  constructor(g) {
    this.g = g; // {engine, places, vehicle, player, hud, sfx, state, day}
    this.active = null;
    this.ring = null;
  }

  get site() { return this.g.places.sites.license; }

  makeRing() {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.12, 10, 40), new THREE.MeshStandardMaterial({ color: 0x5bb0ff, emissive: 0x3a90ff, emissiveIntensity: 2.2 }));
    m.rotation.x = Math.PI / 2;
    this.g.engine.scene.add(m);
    return m;
  }

  async start() {
    const site = this.site, c = site?.extra?.course, v = this.g.vehicle;
    if (!c || !v) { this.g.hud.toast('시험장이 준비 중이에요'); return; }
    const W = (p) => new THREE.Vector3(...xformPt(site, p));
    this.prev = { pos: v.pos.clone(), yaw: v.yaw };
    const f = $('fade');
    f.textContent = '🚗 면허 시험 준비 중…';
    f.classList.add('on');
    await wait(900);
    const start = W(c.start.pos);
    v.park(start.x, start.z, (c.start.yaw ?? 0) + site.worldYaw);
    v.driving = true;
    v.testCar = true;
    if (this.g.player.avatar) this.g.player.avatar.group.visible = false;
    if (this.g.player.arm) this.g.player.arm.group.visible = false;
    const cones = (site.extra.cones ?? []).map((o) => {
      const p = new THREE.Vector3(); o.getWorldPosition(p);
      return { o, p, rest: { pos: o.position.clone(), rot: o.rotation.clone() }, hit: false };
    });
    this.active = {
      cps: c.checkpoints.map((cp) => ({ p: W(cp.pos), r: cp.radius ?? 3 })),
      finish: { p: W(c.finish.pos), r: c.finish.radius ?? 3.5 },
      next: 0, t: 0, hits: 0, cones,
    };
    this.ring ??= this.makeRing();
    this.ring.visible = true;
    $('test').classList.remove('hidden');
    f.classList.remove('on');
    this.g.hud.toast('면허 시험 시작! 파란 고리를 차례로 지나서 "도착" 칸에 멈춰요. 콘을 치면 감점!', 4200);
  }

  update(dt) {
    const a = this.active, v = this.g.vehicle;
    if (!a) return;
    if (!v.driving) { this.end(false, '차에서 내려서 시험이 끝났어요'); return; }
    a.t += dt;
    // cones
    const circles = v.circles();
    for (const c of a.cones) {
      if (c.hit) continue;
      for (const k of circles) if (Math.hypot(k.x - c.p.x, k.z - c.p.z) < k.r + 0.25) {
        c.hit = true; a.hits++;
        c.o.rotation.z = (Math.random() < 0.5 ? -1 : 1) * 1.45;
        c.o.position.y += 0.12;
        this.g.sfx('hit');
        this.g.hud.toast('앗! 콘을 쳤어요 (-5점)', 1000);
        break;
      }
    }
    // checkpoints
    const target = a.next < a.cps.length ? a.cps[a.next] : a.finish;
    this.ring.position.set(target.p.x, target.p.y + 0.6 + Math.sin(a.t * 3) * 0.1, target.p.z);
    this.ring.scale.setScalar(target.r / 1.6);
    const d = Math.hypot(v.pos.x - target.p.x, v.pos.z - target.p.z);
    if (a.next < a.cps.length) {
      if (d < target.r) { a.next++; this.g.sfx('pickup'); }
    } else if (d < target.r && Math.abs(v.speed) < 1.2) {
      const score = Math.max(0, Math.round(100 - a.hits * 5 - Math.max(0, a.t - LIMIT)));
      this.end(score >= 70, null, score);
      return;
    }
    const left = Math.max(0, LIMIT - a.t);
    $('test').innerHTML = `🪪 면허 시험 · 고리 <b>${Math.min(a.next, a.cps.length)}/${a.cps.length}</b>${a.next >= a.cps.length ? ' · 도착 칸에 멈춰요!' : ''} · 남은 시간 <b>${Math.ceil(left)}초</b> · 감점 <b>${a.hits * 5 + Math.max(0, Math.round(a.t - LIMIT))}</b>`;
  }

  /** Where the target is (for the minimap and navigation during the test). */
  target() {
    const a = this.active;
    if (!a) return null;
    return (a.next < a.cps.length ? a.cps[a.next] : a.finish).p.clone();
  }

  async end(pass, why, score = 0) {
    const a = this.active;
    this.active = null;
    this.ring.visible = false;
    $('test').classList.add('hidden');
    const v = this.g.vehicle, s = this.g.state;
    v.testCar = false;
    if (why) this.g.hud.toast(why, 2400);
    await wait(why ? 600 : 1200);
    for (const c of a.cones) { c.o.position.copy(c.rest.pos); c.o.rotation.copy(c.rest.rot); }
    if (pass) {
      s.license = true;
      this.g.sfx('done'); this.g.sfx('coin');
      this.card(score);
      const st = this.g.day.step;
      if (st && st.id === 'license') this.g.day.complete('license');
      // the car waits in the test centre's parking lot
      v.driving = false;
      const p = v.exitPoint();
      this.g.player.place(p.x, p.y + 0.05, p.z, v.yaw);
    } else {
      if (!why) this.g.hud.toast(`불합격… ${score}점 (70점이면 합격). 다시 도전해요!`, 3200);
      this.g.sfx('wrong');
      v.driving = false;
      v.park(this.prev.pos.x, this.prev.pos.z, this.prev.yaw);
      const site = this.site, it = this.g.places.interactables.find((i) => i.key === 'license:license');
      const at = it ? it.wpos : new THREE.Vector3(...site.worldPos);
      this.g.player.place(at.x, Math.max(0.15, at.y - 1.4), at.z + 1.2, site.worldYaw + Math.PI);
    }
    if (this.g.player.avatar) this.g.player.avatar.group.visible = this.g.player.view === 'third';
    if (this.g.player.arm) this.g.player.arm.group.visible = this.g.player.view === 'first';
  }

  card(score) {
    const d = document.createElement('div');
    d.id = 'license-card';
    const name = this.g.cloud?.nickname || '나';
    d.innerHTML = `<div class="lc-top">자동차 운전면허증</div><div class="lc-body"><div class="lc-photo">🙂</div><div><div>이름: <b>${name}</b></div><div>면허 종류: 1종 보통</div><div>시험 점수: ${score}점</div><div class="lc-ok">합격 🎉</div></div></div><div class="lc-foot">세온 운전면허시험장</div>`;
    document.body.appendChild(d);
    this.g.hud.toast('🎉 합격! 운전면허증을 받았어요. 이제 운전할 수 있어요!', 3600);
    setTimeout(() => d.remove(), 4200);
  }
}
