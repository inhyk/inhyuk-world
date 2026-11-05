// Puts building sites into the world: transforms their colliders, doors, interactables, lamps and
// people spots to world space, and runs the doors.
import * as THREE from 'three';

export function xform(site, p) {
  const [px, py, pz] = site.worldPos, c = Math.cos(site.worldYaw), s = Math.sin(site.worldYaw);
  return [px + p[0] * c + p[2] * s, py + p[1], pz - p[0] * s + p[2] * c];
}
export function xbox(site, b) {
  const a = xform(site, b.min), c = xform(site, b.max);
  return { min: [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.min(a[2], c[2])], max: [Math.max(a[0], c[0]), Math.max(a[1], c[1]), Math.max(a[2], c[2])] };
}

export class Places {
  constructor(engine, colliders, lights, build) {
    this.engine = engine;
    this.col = colliders;
    this.lights = lights;
    this.build = build;
    this.sites = {};
    this.doors = [];
    this.interactables = [];
    this.indoor = [];
    this.npcSpots = [];
    this.lazy = [];
  }

  add(def, site) {
    site.key = def.key;
    site.def = def;
    site.worldPos = def.pos;
    site.worldYaw = def.yaw;
    def.footprint = site.footprint;
    const g = site.group;
    g.position.set(...def.pos);
    g.rotation.y = def.yaw;
    this.engine.scene.add(g);
    g.updateMatrixWorld(true);
    for (const b of site.colliders) {
      const w = this.col.add({ ...xbox(site, b), tag: def.key });
      this.build?.addStatic(w);
    }
    for (const it of site.interactables) {
      this.interactables.push({ ...it, site: def.key, key: `${def.key}:${it.id}`, wpos: new THREE.Vector3(...xform(site, it.pos)), seatW: it.seat ? { pos: new THREE.Vector3(...xform(site, it.seat.pos)), yaw: it.seat.yaw + def.yaw, pitch: it.seat.pitch ?? 0 } : null, screenW: it.screen ? { center: new THREE.Vector3(...xform(site, it.screen.center)), w: it.screen.w, h: it.screen.h, yaw: (it.screen.yaw ?? 0) + def.yaw } : null });
    }
    for (const d of site.doors) {
      const door = { ...d, site: def.key, open: 0, want: 0, base: { pos: d.pivot.position.clone(), rot: d.pivot.rotation.y } };
      if (d.collider) door.box = this.col.add({ ...xbox(site, d.collider), tag: 'door' });
      const wp = new THREE.Vector3(); d.pivot.getWorldPosition(wp);
      door.center = door.box ? new THREE.Vector3((door.box.min[0] + door.box.max[0]) / 2, wp.y, (door.box.min[2] + door.box.max[2]) / 2) : wp;
      this.doors.push(door);
    }
    for (const v of site.indoor) this.indoor.push({ ...xbox(site, v), site: def.key });
    for (const l of site.lamps) this.lights?.add({ ...l, pos: xform(site, l.pos), when: 'inside', site: def.key, intensity: l.intensity ?? 6, range: l.range ?? 9 });
    for (const m of site.nightGlow) this.lights?.addGlow(m);
    for (const n of site.npcSpots) this.npcSpots.push({ ...n, site: def.key, wpos: new THREE.Vector3(...xform(site, n.pos)), wyaw: (n.yaw ?? 0) + def.yaw });
    this.sites[def.key] = site;
    if (site.extra?.interior?.build) this.lazy.push(site);
    return site;
  }

  /**
   * Interiors are built the first time the camera comes within BUILD_R of a building, then shown only
   * nearby (인혁: "모든 건물에 들어 갈 수 있게 해줘"). onSpots(spots) spawns the people of a new interior.
   */
  updateInteriors(cam, onSpots) {
    const BUILD_R = 45, SHOW_R = 70;
    let built = 0;
    for (const site of this.lazy) {
      const d = Math.hypot(cam.x - site.worldPos[0], cam.z - site.worldPos[2]) - Math.max(site.footprint.w, site.footprint.d) / 2;
      if (!site.interior && d < BUILD_R && built < 1) {
        built++;
        let parts = null;
        try { parts = site.extra.interior.build(); } catch (e) { console.warn('interior failed', site.key, e); site.extra.interior = null; continue; }
        site.interior = parts;
        const key = site.key;
        if (parts.group) { parts.group.userData.dynamic = true; site.group.add(parts.group); }
        for (const b of parts.colliders ?? []) this.build?.addStatic(this.col.add({ ...xbox(site, b), tag: key }));
        for (const it of parts.interactables ?? []) {
          this.interactables.push({ ...it, site: key, key: `${key}:${it.id}`, wpos: new THREE.Vector3(...xform(site, it.pos)), seatW: it.seat ? { pos: new THREE.Vector3(...xform(site, it.seat.pos)), yaw: it.seat.yaw + site.worldYaw, pitch: it.seat.pitch ?? 0 } : null, screenW: it.screen ? { center: new THREE.Vector3(...xform(site, it.screen.center)), w: it.screen.w, h: it.screen.h, yaw: (it.screen.yaw ?? 0) + site.worldYaw } : null });
        }
        for (const v of parts.indoor ?? []) this.indoor.push({ ...xbox(site, v), site: key });
        for (const l of parts.lamps ?? []) this.lights?.add({ ...l, pos: xform(site, l.pos), when: 'inside', site: key, intensity: l.intensity ?? 6, range: l.range ?? 9 });
        const spots = (parts.npcSpots ?? []).map((n) => ({ ...n, site: key, wpos: new THREE.Vector3(...xform(site, n.pos)), wyaw: (n.yaw ?? 0) + site.worldYaw }));
        this.npcSpots.push(...spots);
        onSpots?.(spots);
        this.onInterior?.(site, parts);
      }
      if (site.interior?.group) site.interior.group.visible = d < SHOW_R;
    }
  }

  /** Site key of the indoor volume containing p, or null. */
  inside(p) {
    for (const v of this.indoor) if (p.x > v.min[0] && p.x < v.max[0] && p.z > v.min[2] && p.z < v.max[2] && p.y > v.min[1] - 0.5 && p.y < v.max[1]) return v.site;
    return null;
  }

  /** World point in front of a site's entrance. */
  entrance(key) {
    const s = this.sites[key];
    if (!s) return null;
    return new THREE.Vector3(...xform(s, [0, 0, s.footprint.d / 2 + 2]));
  }

  updateDoors(dt, people, sfx) {
    for (const d of this.doors) {
      if (d.auto) {
        let near = false;
        for (const p of people) if (p && Math.abs(p.x - d.center.x) < 2.6 && Math.abs(p.z - d.center.z) < 2.6 && Math.abs(p.y - d.center.y) < 3) near = true;
        if (near !== (d.want === 1)) { d.want = near ? 1 : 0; sfx?.(d.slide ? 'slide' : 'door'); }
      }
      d.open += (d.want - d.open) * Math.min(1, dt * (d.slide ? 5 : 6));
      if (d.slide) d.pivot.position.copy(d.base.pos).add(new THREE.Vector3(...d.slide).multiplyScalar(d.open));
      else d.pivot.rotation.y = d.base.rot + (d.openAngle ?? -1.6) * d.open;
      if (d.box) d.box.disabled = d.open > 0.3;
    }
  }

  /** Nearest non-auto door within reach of p, for the E prompt. */
  doorNear(p) {
    let best = null, bd = 2.2;
    for (const d of this.doors) {
      if (d.auto) continue;
      const dist = Math.hypot(p.x - d.center.x, p.z - d.center.z);
      if (dist < bd && Math.abs(p.y - d.center.y) < 3) { bd = dist; best = d; }
    }
    return best;
  }
}
