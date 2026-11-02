// A small pool of real point lights that hop to the nearest lamp anchors (interiors, street
// lamps, garden lamps) so every lamp can look lit without paying for hundreds of lights.
import * as THREE from 'three';

export class LightPool {
  constructor(scene, size = 6) {
    this.anchors = [];   // {pos: Vector3, color, intensity, range, when: 'night'|'always'|'inside', site}
    this.lights = [];
    for (let i = 0; i < size; i++) {
      const l = new THREE.PointLight(0xffe2b0, 0, 12, 2);
      l.userData.target = null;
      l.userData.level = 0;
      scene.add(l);
      this.lights.push(l);
    }
    this.glow = [];      // {mat, base, when}
    this.t = 0;
  }
  add(a) { this.anchors.push({ intensity: 6, range: 9, color: 0xffe2b0, when: 'night', ...a, pos: a.pos.isVector3 ? a.pos : new THREE.Vector3(...a.pos) }); }
  remove(pred) { this.anchors = this.anchors.filter((a) => !pred(a)); }
  addGlow(mat, when = 'night') {
    if (!mat || this.glow.some((g) => g.mat === mat)) return;
    this.glow.push({ mat, base: mat.userData?.glowMax ?? mat.emissiveIntensity ?? 1, when });
  }
  /** night 0..1, insideSite = site key the player is in (or null). */
  update(dt, camPos, night, insideSite) {
    for (const g of this.glow) g.mat.emissiveIntensity = g.base * (g.when === 'always' ? 1 : 0.06 + 0.94 * night);
    this.t -= dt;
    if (this.t <= 0) {
      this.t = 0.4;
      const on = (a) => a.when === 'always' || (a.when === 'night' && night > 0.35) || (a.when === 'inside' && (insideSite === a.site || night > 0.35));
      const cand = this.anchors.filter(on).map((a) => ({ a, d: a.pos.distanceTo(camPos) - (a.site && a.site === insideSite ? 30 : 0) })).filter((c) => c.d < 45).sort((x, y) => x.d - y.d).slice(0, this.lights.length);
      const wanted = new Set(cand.map((c) => c.a));
      for (const l of this.lights) if (l.userData.target && !wanted.has(l.userData.target)) l.userData.target = null;
      for (const c of cand) {
        if (this.lights.some((l) => l.userData.target === c.a)) continue;
        const free = this.lights.find((l) => !l.userData.target && l.userData.level < 0.05);
        if (!free) continue;
        free.userData.target = c.a;
        free.position.copy(c.a.pos);
        free.color.set(c.a.color);
        free.distance = c.a.range;
      }
    }
    for (const l of this.lights) {
      const want = l.userData.target ? 1 : 0;
      l.userData.level += (want - l.userData.level) * Math.min(1, dt * 4);
      if (l.userData.target) l.userData.base = l.userData.target.intensity;
      l.intensity = (l.userData.base ?? 0) * l.userData.level;
    }
  }
}
