// Elevators for sites that declare site.extra.elevator = { landings: [{ name, pos, yaw }] }.
// The site leaves a 1.2 x 2.3 m doorway at each landing and an empty pocket behind it; this module
// adds sliding doors at every landing and one car that rides between them with the player inside.
import * as THREE from 'three';
import { mat, paint } from './mat.js';
import { rbox, box, quad, put, bake } from './geom.js';
import { canvasTex, FONT } from './tex.js';
import { xformPt } from './quests.js';

const W = 1.8, D = 2.0, H = 2.7; // car inside size
const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function panelTex(names) {
  return canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = '#2b2e33'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#9fd0ff'; c.font = `bold 34px ${FONT}`; c.textAlign = 'center'; c.fillText('층 버튼', w / 2, 52);
    names.forEach((n, i) => {
      const y = 110 + i * 110;
      c.fillStyle = '#c9ccd1'; c.beginPath(); c.arc(60, y, 34, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(60, y, 26, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#2b2620'; c.font = `bold 26px ${FONT}`; c.fillText(String(i + 1), 60, y + 9);
      c.fillStyle = '#ffffff'; c.font = `26px ${FONT}`; c.textAlign = 'left'; c.fillText(n, 108, y + 9); c.textAlign = 'center';
    });
  });
}

/** One elevator: landings in world space, doors at each, a car that moves between them. */
class Lift {
  constructor(scene, colliders, site, def) {
    this.col = colliders;
    this.landings = def.landings.map((l) => {
      const pos = new THREE.Vector3(...xformPt(site, l.pos));
      const yaw = (l.yaw ?? 0) + site.worldYaw;
      const f = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)); // from the hall into the car
      return { name: l.name, pos, yaw, f, open: 0, want: 0 };
    });
    this.at = 0;
    this.moving = false;
    // doors (two leaves per landing)
    const steel = mat('steel');
    for (const L of this.landings) {
      const g = new THREE.Group();
      g.position.copy(L.pos);
      g.rotation.y = L.yaw;
      g.userData.dynamic = true;
      L.leaves = [-1, 1].map((sx) => {
        const leaf = new THREE.Mesh(rbox(0.6, 2.3, 0.04, 0.008), steel);
        leaf.position.set(sx * 0.3, 1.15, -0.04);
        leaf.castShadow = true; leaf.receiveShadow = true;
        g.add(leaf);
        return { leaf, sx };
      });
      scene.add(g);
      L.group = g;
      // closed-door collider
      const c = L.pos.clone().addScaledVector(L.f, 0.04);
      const ax = Math.abs(L.f.x) > 0.5;
      L.box = colliders.add({ min: [c.x - (ax ? 0.08 : 0.62), L.pos.y, c.z - (ax ? 0.62 : 0.08)], max: [c.x + (ax ? 0.08 : 0.62), L.pos.y + 2.3, c.z + (ax ? 0.62 : 0.08)], tag: 'door' });
    }
    // the car
    const car = new THREE.Group();
    const wall = mat('steel'), floorM = paint(0x6b5a4a, 0.55), ceil = paint(0xeeeeec, 0.5);
    put(car, rbox(W, 0.06, D, 0.01), floorM, 0, -0.03, -D / 2);
    put(car, rbox(W + 0.12, 0.08, D + 0.06, 0.01), ceil, 0, H + 0.04, -D / 2);
    put(car, rbox(W + 0.12, H, 0.06, 0.01), wall, 0, H / 2, -D - 0.03);
    for (const sx of [-1, 1]) put(car, rbox(0.06, H, D, 0.01), wall, sx * (W / 2 + 0.03), H / 2, -D / 2);
    for (const sx of [-1, 1]) put(car, rbox(0.3, H, 0.06, 0.01), wall, sx * (W / 2 - 0.15), H / 2, -0.03);
    put(car, rbox(W, H - 2.3, 0.06, 0.01), wall, 0, 2.3 + (H - 2.3) / 2, -0.03);
    put(car, rbox(1.2, 1.5, 0.01, 0.005), mat('mirror'), 0, 1.35, -D + 0.005);
    for (const [x, z, ry] of [[0, -D + 0.08, 0], [-W / 2 + 0.08, -D / 2, Math.PI / 2], [W / 2 - 0.08, -D / 2, Math.PI / 2]]) put(car, rbox(ry ? D - 0.4 : W - 0.4, 0.04, 0.04, 0.015), mat('chrome'), x, 0.92, z, 0, ry, 0);
    const lightM = mat('coolGlow');
    put(car, box(1.2, 0.02, 1.2), lightM, 0, H - 0.005, -D / 2).castShadow = false;
    const panel = new THREE.Mesh(quad(0.36, 0.72), new THREE.MeshStandardMaterial({ map: panelTex(this.landings.map((l) => l.name)), emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0.25, roughness: 0.4 }));
    panel.material.emissiveMap = panel.material.map;
    panel.position.set(W / 2 - 0.01, 1.25, -0.45);
    panel.rotation.y = -Math.PI / 2;
    bake(car);
    car.add(panel);
    scene.add(car);
    this.car = car;
    this.carBoxes = [];
    this.placeCar(this.landings[0]);
  }

  /** Put the car (and its wall colliders) behind landing L. */
  placeCar(L) {
    this.car.position.copy(L.pos);
    this.car.rotation.y = L.yaw;
    for (const b of this.carBoxes) this.col.remove(b);
    this.carBoxes = [];
    const pts = (lx0, lz0, lx1, lz1, y0, y1) => {
      const a = new THREE.Vector3(lx0, 0, lz0).applyAxisAngle(new THREE.Vector3(0, 1, 0), L.yaw).add(L.pos);
      const b = new THREE.Vector3(lx1, 0, lz1).applyAxisAngle(new THREE.Vector3(0, 1, 0), L.yaw).add(L.pos);
      this.carBoxes.push(this.col.add({ min: [Math.min(a.x, b.x), L.pos.y + y0, Math.min(a.z, b.z)], max: [Math.max(a.x, b.x), L.pos.y + y1, Math.max(a.z, b.z)], tag: 'lift' }));
    };
    pts(-W / 2, -D, W / 2, 0, -0.3, 0);               // floor
    pts(-W / 2 - 0.1, -D - 0.1, W / 2 + 0.1, -D, 0, H); // back
    pts(-W / 2 - 0.1, -D, -W / 2, 0, 0, H);            // sides
    pts(W / 2, -D, W / 2 + 0.1, 0, 0, H);
  }

  /** Is p inside the car (when the car is at landing L)? */
  inside(p) {
    const L = this.landings[this.at];
    const rel = p.clone().sub(L.pos).applyAxisAngle(new THREE.Vector3(0, 1, 0), -L.yaw);
    return rel.x > -W / 2 && rel.x < W / 2 && rel.z < 0.1 && rel.z > -D && Math.abs(rel.y) < 1;
  }
  /** Landing whose hall the point p stands in front of (within 2.4 m), or -1. */
  near(p) {
    for (let i = 0; i < this.landings.length; i++) {
      const L = this.landings[i];
      const rel = p.clone().sub(L.pos).applyAxisAngle(new THREE.Vector3(0, 1, 0), -L.yaw);
      if (Math.abs(rel.x) < 1.6 && rel.z > -0.2 && rel.z < 2.6 && Math.abs(rel.y) < 1.2) return i;
    }
    return -1;
  }

  update(dt) {
    for (const L of this.landings) {
      L.open += (L.want - L.open) * Math.min(1, dt * 5);
      for (const { leaf, sx } of L.leaves) leaf.position.x = sx * (0.3 + 0.58 * L.open);
      L.box.disabled = L.open > 0.6;
    }
  }
}

export class Elevators {
  constructor(g) {
    this.g = g; // {engine, colliders, places, player, hud, sfx, input}
    this.lifts = [];
    for (const site of Object.values(g.places.sites)) {
      const def = site.extra?.elevator;
      if (def?.landings?.length >= 2) this.lifts.push(new Lift(g.engine.scene, g.colliders, site, def));
    }
    this.busy = false;
  }

  /** E-prompt candidate for the player's position: {label, fn} or null. */
  prompt(p) {
    if (this.busy) return null;
    for (const lift of this.lifts) {
      if (lift.inside(p)) return { label: '층 고르기 (엘리베이터)', fn: () => this.choose(lift) };
      const i = lift.near(p);
      if (i >= 0) {
        const L = lift.landings[i];
        if (lift.at === i && L.want) return null;
        return { label: '엘리베이터 부르기', fn: () => this.call(lift, i) };
      }
    }
    return null;
  }

  async call(lift, i) {
    this.busy = true;
    this.g.sfx('click');
    if (lift.at !== i) {
      for (const L of lift.landings) L.want = 0;
      this.g.hud.toast('엘리베이터가 오고 있어요…', 1400);
      await wait(1500);
      lift.at = i;
      lift.placeCar(lift.landings[i]);
    }
    this.g.sfx('done');
    lift.landings[i].want = 1;
    this.busy = false;
  }

  choose(lift) {
    const box = $('lift');
    box.innerHTML = `<div class="mcard"><h2>🛗 몇 층으로 갈까?</h2>${lift.landings.map((L, i) => `<button data-i="${i}" ${i === lift.at ? 'class="alt"' : ''}>${i + 1}. ${L.name}${i === lift.at ? ' (여기)' : ''}</button>`).join('')}<button class="alt close" data-i="-1">닫기</button></div>`;
    box.classList.remove('hidden');
    this.g.input.enabled = false;
    document.exitPointerLock?.();
    box.querySelectorAll('button').forEach((b) => {
      b.onclick = () => {
        box.classList.add('hidden');
        this.g.input.enabled = true;
        this.g.input.lock();
        const to = Number(b.dataset.i);
        if (to >= 0 && to !== lift.at) this.ride(lift, to);
      };
    });
  }

  async ride(lift, to) {
    this.busy = true;
    const pl = this.g.player;
    const from = lift.landings[lift.at], dest = lift.landings[to];
    from.want = 0;
    this.g.sfx('slide');
    await wait(900);
    pl.frozen = true;
    // player's place in the car frame
    const rel = pl.pos.clone().sub(from.pos).applyAxisAngle(new THREE.Vector3(0, 1, 0), -from.yaw);
    const yawRel = pl.yaw - from.yaw;
    const up = dest.pos.y > from.pos.y;
    const ind = $('lift-ind');
    ind.classList.remove('hidden');
    const steps = 18, dur = 2600;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps, e = t * t * (3 - 2 * t);
      const L = t < 0.5 ? from : dest;
      const off = (t < 0.5 ? e : e - 1) * (up ? 1 : -1) * 1.2; // a little real motion at both ends
      if (k === Math.ceil(steps / 2)) { lift.at = to; lift.placeCar(dest); }
      lift.car.position.copy(L.pos); lift.car.position.y += off;
      const p = rel.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), L.yaw).add(L.pos);
      pl.pos.set(p.x, p.y + off, p.z);
      pl.yaw = L.yaw + yawRel;
      ind.textContent = `${up ? '▲' : '▼'} ${t < 0.5 ? from.name : dest.name}`;
      await wait(dur / steps);
    }
    lift.car.position.copy(dest.pos);
    const p = rel.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), dest.yaw).add(dest.pos);
    pl.place(p.x, p.y + 0.02, p.z, dest.yaw + yawRel);
    pl.frozen = false;
    this.g.sfx('done');
    ind.textContent = `띵! ${dest.name}`;
    setTimeout(() => ind.classList.add('hidden'), 1600);
    dest.want = 1;
    this.busy = false;
  }

  update(dt) { for (const l of this.lifts) l.update(dt); }
}
