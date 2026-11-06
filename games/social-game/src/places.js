// Puts building sites into the world: transforms their colliders, doors, interactables, lamps and
// people spots to world space, and runs the doors.
import * as THREE from 'three';
import { texReady } from './tex.js';

export function xform(site, p) {
  const [px, py, pz] = site.worldPos, c = Math.cos(site.worldYaw), s = Math.sin(site.worldYaw);
  return [px + p[0] * c + p[2] * s, py + p[1], pz - p[0] * s + p[2] * c];
}
export function xbox(site, b) {
  const a = xform(site, b.min), c = xform(site, b.max);
  return { min: [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.min(a[2], c[2])], max: [Math.max(a[0], c[0]), Math.max(a[1], c[1]), Math.max(a[2], c[2])] };
}

/**
 * A building never moves once it is placed, so its matrices are worked out once instead of every
 * frame (three.js re-composes every object's matrix each frame otherwise, ~11 000 objects here).
 * Moving parts are marked userData.dynamic (doors, cones...) and keep updating with all below them,
 * and so do objects in `keep` (things the game reaches through site.extra).
 */
export function freeze(root, keep = null) {
  root.updateMatrixWorld(true);
  const walk = (o) => {
    if (o !== root && (o.userData.dynamic || keep?.has(o))) return;
    o.matrixAutoUpdate = false;
    for (const c of o.children) walk(c);
  };
  walk(root);
}
/** Glass (see-through, both sides) is drawn in one pass instead of two: three.js otherwise draws it
 * twice and re-checks its shader every frame. Thin panes look the same. */
export function singlePassGlass(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m.transparent && m.side === THREE.DoubleSide) m.forceSinglePass = true;
  });
}
const movers = (site) => new Set([...Object.values(site.extra ?? {}).flatMap((v) => (Array.isArray(v) ? v : [v])), ...(site.doors ?? []).map((d) => d.pivot)].filter((v) => v?.isObject3D));

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
    this.culls = [];   // {obj, x, z, r}: hidden when the fog would hide them anyway (cullFar)
    this.aoSkip = [];  // always left out of the AO pass (ground, trees)
  }

  /** Register something big for fog culling: centre (x, z) and radius r on the ground. */
  cullable(obj, x, z, r) { this.culls.push({ obj, x, z, r }); }

  /**
   * Hide what the fog already makes invisible (under 0.3 % left), e.g. the Japan island seen from the
   * town 2 km away. A thinner fog (the plane flies with fogScale 0.22) shows everything again.
   */
  cullFar(cam, density) {
    const far = 2.4 / Math.max(1e-5, density);
    for (const c of this.culls) c.obj.visible = Math.hypot(cam.x - c.x, cam.z - c.z) - c.r < far;
  }

  /** What the AO pass leaves out: buildings farther than `near` metres, and the aoSkip list. */
  aoHide(cam, near = 24) {
    const out = [...this.aoSkip];
    for (const c of this.culls) if (c.site && Math.hypot(cam.x - c.x, cam.z - c.z) - c.r > near) out.push(c.obj);
    return out;
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
    freeze(g, movers(site));
    this.culls.push({ obj: g, x: def.pos[0], z: def.pos[2], r: Math.hypot(site.footprint.w, site.footprint.d) / 2, site: def.key });
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
   * A new interior stays hidden until its shaders are compiled (in the background), so walking up to
   * a building never freezes the picture. The things inside only cast sun shadows while you are at
   * the building (from farther away the walls and roof hide them anyway).
   */
  updateInteriors(cam, onSpots) {
    const BUILD_R = 45, SHOW_R = 70, CAST_R = 8;
    let built = 0;
    for (const site of this.lazy) {
      const d = Math.hypot(cam.x - site.worldPos[0], cam.z - site.worldPos[2]) - Math.max(site.footprint.w, site.footprint.d) / 2;
      if (!site.interior && d < BUILD_R && built < 1) {
        built++;
        let parts = null;
        try { parts = site.extra.interior.build(); } catch (e) { console.warn('interior failed', site.key, e); site.extra.interior = null; continue; }
        site.interior = parts;
        const key = site.key;
        if (parts.group) {
          parts.group.userData.dynamic = true;
          site.group.add(parts.group);
          freeze(parts.group);
          singlePassGlass(parts.group);
          parts.group.visible = false;
          site.interiorReady = false;
          const ready = () => { site.interiorReady = true; };
          const r = this.engine.renderer;
          Promise.all([r.compileAsync?.(parts.group, this.engine.camera, this.engine.scene), texReady()]).then(ready, ready);
        }
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
      const ig = site.interior?.group;
      if (ig) {
        // the player can be inside before the shaders are ready (a teleport): show it right away then
        ig.visible = d < SHOW_R && (site.interiorReady !== false || d < 0);
        const cast = d < CAST_R;
        if (site.interiorCast !== cast) {
          site.interiorCast = cast;
          ig.traverse((o) => { if (o.isMesh) { o.userData.cast ??= o.castShadow; o.castShadow = cast && o.userData.cast; } });
        }
      }
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
      if (Math.abs(d.want - d.open) < 1e-4) { if (d.open === d.want) continue; d.open = d.want; } // resting: nothing to move
      else d.open += (d.want - d.open) * Math.min(1, dt * (d.slide ? 5 : 6));
      if (d.slide) d.pivot.position.copy(d.base.pos).addScaledVector(d.slideV ??= new THREE.Vector3(...d.slide), d.open);
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
