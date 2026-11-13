// 음식 50가지를 코드로 빚는다. makeFood(id, size) 는 바닥이 y=0 이고 크기가 size 인 모델을 돌려준다.
import * as THREE from 'three';

const mats = new Map();
export function mat(color, o = {}) {
  const key = `${color}|${o.rough ?? 0.7}|${o.metal ?? 0}|${o.emissive ?? ''}|${o.glow ?? 1}|${o.flat ? 1 : 0}`;
  if (!mats.has(key)) {
    mats.set(key, new THREE.MeshStandardMaterial({
      color, roughness: o.rough ?? 0.7, metalness: o.metal ?? 0, flatShading: !!o.flat,
      emissive: o.emissive ?? 0x000000, emissiveIntensity: o.emissive ? (o.glow ?? 1) : 0,
    }));
  }
  return mats.get(key);
}
const geos = new Map();
const geo = (key, make) => { if (!geos.has(key)) geos.set(key, make()); return geos.get(key); };
const sphereG = (r, w = 20, h = 14) => geo(`s${r}|${w}|${h}`, () => new THREE.SphereGeometry(r, w, h));
const cylG = (rt, rb, h, seg = 24, open = false) => geo(`c${rt}|${rb}|${h}|${seg}|${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
const boxG = (w, h, d) => geo(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
const torusG = (r, t, seg = 20, arc = Math.PI * 2) => geo(`t${r}|${t}|${seg}|${arc}`, () => new THREE.TorusGeometry(r, t, 8, seg, arc));
const capG = (r, len) => geo(`k${r}|${len}`, () => new THREE.CapsuleGeometry(r, len, 5, 12));
const coneG = (r, h, seg = 16) => geo(`n${r}|${h}|${seg}`, () => new THREE.ConeGeometry(r, h, seg));

export function part(g, m, x = 0, y = 0, z = 0, s) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  if (s) o.scale.set(s[0], s[1], s[2]);
  o.castShadow = true; o.receiveShadow = true;
  return o;
}
const add = (grp, ...kids) => { kids.forEach((k) => grp.add(k)); return grp; };
const rnd = (seed) => { let t = seed * 9301 + 49297; return () => { t = (t * 9301 + 49297) % 233280; return t / 233280; }; };
const ring = (n, r, fn, off = 0) => { for (let i = 0; i < n; i += 1) { const a = off + (i / n) * Math.PI * 2; fn(Math.sin(a) * r, Math.cos(a) * r, a, i); } };

function plate(r = 0.5, color = '#ffffff') {
  const g = new THREE.Group();
  add(g, part(cylG(r, r * 0.72, 0.05), mat(color, { rough: 0.3 }), 0, 0.025, 0), part(torusG(r * 0.96, 0.022, 28), mat(color, { rough: 0.3 }), 0, 0.05, 0));
  g.children[1].rotation.x = Math.PI / 2;
  return g;
}
function bowl(r, bowlColor, soupColor, depth = 0.6) {
  const g = new THREE.Group(), h = r * depth;
  add(g, part(cylG(r, r * 0.55, h, 28), mat(bowlColor, { rough: 0.35 }), 0, h / 2, 0),
    part(cylG(r * 0.6, r * 0.6, 0.04, 20), mat(bowlColor, { rough: 0.35 }), 0, 0.02, 0),
    part(cylG(r * 0.93, r * 0.93, 0.02, 28), mat(soupColor, { rough: 0.25 }), 0, h + 0.003, 0));
  const rim = part(torusG(r, 0.025, 28), mat(bowlColor, { rough: 0.35 }), 0, h, 0);
  rim.rotation.x = Math.PI / 2; g.add(rim);
  g.userData.top = h + 0.015;
  return g;
}
function drumstick() {
  const g = new THREE.Group();
  add(g, part(sphereG(0.2, 12, 10), mat('#c9772b', { rough: 0.9, flat: true }), 0, 0.2, 0, [1, 1.25, 1]),
    part(sphereG(0.13, 10, 8), mat('#d98f3d', { rough: 0.9, flat: true }), 0.06, 0.32, 0.05),
    part(cylG(0.045, 0.045, 0.26, 8), mat('#fff6e6'), 0, 0.52, 0),
    part(sphereG(0.06, 8, 6), mat('#fff6e6'), 0.035, 0.66, 0), part(sphereG(0.06, 8, 6), mat('#fff6e6'), -0.035, 0.66, 0));
  return g;
}
function malatangBowl(r = 0.5) {
  const g = bowl(r, '#22262e', '#c8281e', 0.62), y = g.userData.top, rr = rnd(7);
  const oil = part(cylG(r * 0.6, r * 0.6, 0.01, 18), mat('#e8541f', { rough: 0.2 }), r * 0.1, y + 0.004, 0); g.add(oil);
  for (let i = 0; i < 4; i += 1) { const n = part(torusG(r * (0.22 + i * 0.07), 0.022, 18), mat('#f3dfae'), -r * 0.2, y + 0.01 + i * 0.006, r * 0.1); n.rotation.x = Math.PI / 2; n.rotation.z = i; g.add(n); }
  ring(5, r * 0.55, (x, z, a) => { const b = part(sphereG(0.07, 8, 6), mat('#4caf50', { flat: true }), x, y + 0.03, z, [1.5, 0.6, 0.9]); b.rotation.y = a; g.add(b); }, 0.4);
  ring(3, r * 0.3, (x, z) => { g.add(part(cylG(0.035, 0.03, 0.09, 8), mat('#fff7ea'), x + r * 0.25, y + 0.05, z), part(sphereG(0.06, 8, 6), mat('#b98a5e'), x + r * 0.25, y + 0.1, z, [1, 0.55, 1])); }, 1);
  for (let i = 0; i < 4; i += 1) g.add(part(boxG(0.09, 0.07, 0.09), mat('#fff3c9'), (rr() - 0.5) * r, y + 0.03, (rr() - 0.5) * r));
  for (let i = 0; i < 5; i += 1) { const c = part(coneG(0.025, 0.12, 6), mat('#ff2d2d', { rough: 0.3 }), (rr() - 0.5) * r * 1.1, y + 0.035, (rr() - 0.5) * r * 1.1); c.rotation.set(Math.PI / 2, 0, rr() * 6); g.add(c); }
  ring(3, r * 0.45, (x, z) => g.add(part(cylG(0.06, 0.06, 0.03, 10), mat('#e8786b'), x, y + 0.03, z)), 2.2);
  return g;
}
function donkatsuPlate() {
  const g = plate(0.5);
  for (let i = 0; i < 6; i += 1) g.add(part(boxG(0.085, 0.09, 0.4), mat(i % 2 ? '#c98a3c' : '#b9772b', { rough: 0.95, flat: true }), -0.24 + i * 0.095, 0.1, 0.06));
  g.add(part(boxG(0.56, 0.02, 0.1), mat('#5a2d12', { rough: 0.3 }), -0.0, 0.15, 0.06));
  g.add(part(sphereG(0.17, 10, 8), mat('#d9f2a8', { flat: true }), 0.12, 0.09, -0.28, [1.2, 0.6, 0.8]));
  g.add(part(sphereG(0.1, 10, 8), mat('#ffffff'), -0.2, 0.09, -0.3, [1, 0.7, 1]));
  return g;
}
function instanced(g, material, n, place) {
  const im = new THREE.InstancedMesh(g, material, n), d = new THREE.Object3D();
  for (let i = 0; i < n; i += 1) { place(d, i); d.updateMatrix(); im.setMatrixAt(i, d.matrix); }
  im.castShadow = true; im.receiveShadow = true;
  return im;
}
function cake() {
  const g = new THREE.Group();
  add(g, part(cylG(0.4, 0.4, 0.28, 24), mat('#fff3e0'), 0, 0.14, 0), part(cylG(0.41, 0.41, 0.05, 24), mat('#ff8fb3'), 0, 0.14, 0),
    part(cylG(0.4, 0.4, 0.03, 24), mat('#ffffff', { rough: 0.4 }), 0, 0.295, 0));
  ring(8, 0.31, (x, z) => g.add(part(sphereG(0.06, 8, 6), mat('#ffffff', { rough: 0.4 }), x, 0.33, z)));
  ring(4, 0.15, (x, z) => g.add(part(coneG(0.06, 0.11, 8), mat('#ff3b4e', { rough: 0.4 }), x, 0.36, z)));
  g.children.slice(-4).forEach((c) => { c.rotation.x = Math.PI; });
  return g;
}

const BUILD = {
  majju() {
    const g = new THREE.Group();
    [['#ff9ec4', -0.3], ['#ffd76a', 0], ['#b6e36b', 0.3]].forEach(([c, x], i) => {
      const k = new THREE.Group();
      add(k, part(boxG(0.24, 0.16, 0.34), mat(c, { rough: 0.45 }), 0, 0.08, 0), part(boxG(0.245, 0.05, 0.345), mat('#ffffff', { rough: 0.4 }), 0, 0.08, 0));
      const a = part(coneG(0.09, 0.12, 8), mat('#ffffff', { rough: 0.4 }), 0, 0.08, 0.22), b = part(coneG(0.09, 0.12, 8), mat('#ffffff', { rough: 0.4 }), 0, 0.08, -0.22);
      a.rotation.x = -Math.PI / 2; b.rotation.x = Math.PI / 2; add(k, a, b);
      k.position.set(x, i === 1 ? 0.0 : 0, 0); k.rotation.y = (i - 1) * 0.25; g.add(k);
    });
    const top = g.children[1].clone(); top.position.set(0, 0.17, 0); top.rotation.y = 1.2; g.add(top);
    return g;
  },
  tangerine() {
    const g = new THREE.Group();
    add(g, part(sphereG(0.4), mat('#ff9a1f', { rough: 0.55 }), 0, 0.34, 0, [1, 0.85, 1]), part(cylG(0.05, 0.07, 0.04, 6), mat('#3f8f2e'), 0, 0.69, 0));
    const leaf = part(sphereG(0.12, 8, 6), mat('#4fb33a'), 0.11, 0.71, 0, [1.3, 0.2, 0.6]); leaf.rotation.z = 0.3; g.add(leaf);
    return g;
  },
  apple() {
    const g = new THREE.Group();
    add(g, part(sphereG(0.4), mat('#e8262d', { rough: 0.3 }), 0, 0.38, 0, [1, 0.95, 1]), part(sphereG(0.2), mat('#e8262d', { rough: 0.3 }), 0, 0.12, 0, [1.5, 0.6, 1.5]),
      part(sphereG(0.1, 10, 8), mat('#ffffff', { rough: 0.2 }), 0.17, 0.52, 0.24, [1, 1.6, 0.5]));
    const stem = part(cylG(0.02, 0.025, 0.2, 6), mat('#6b4423'), 0.02, 0.8, 0); stem.rotation.z = -0.2; g.add(stem);
    const leaf = part(sphereG(0.13, 8, 6), mat('#58c043'), 0.16, 0.83, 0, [1.3, 0.2, 0.6]); leaf.rotation.z = 0.5; g.add(leaf);
    return g;
  },
  'seaweed-soup'() {
    const g = bowl(0.5, '#ffffff', '#5b6b3a'), y = g.userData.top, r = rnd(3);
    for (let i = 0; i < 16; i += 1) { const s = part(boxG(0.16, 0.012, 0.07), mat('#17361f', { rough: 0.4 }), (r() - 0.5) * 0.6, y + 0.006 + r() * 0.01, (r() - 0.5) * 0.6); s.rotation.y = r() * 6; g.add(s); }
    for (let i = 0; i < 5; i += 1) g.add(part(boxG(0.07, 0.04, 0.05), mat('#8a5a44', { flat: true }), (r() - 0.5) * 0.45, y + 0.02, (r() - 0.5) * 0.45));
    const spoon = part(capG(0.02, 0.5), mat('#d9dde3', { metal: 0.8, rough: 0.25 }), 0.32, y + 0.12, 0.1); spoon.rotation.set(0.2, 0, -1.0); g.add(spoon);
    return g;
  },
  chicken() {
    const g = new THREE.Group();
    add(g, part(cylG(0.5, 0.38, 0.4, 20, true), mat('#e63946', { rough: 0.6 }), 0, 0.2, 0), part(cylG(0.38, 0.38, 0.03, 20), mat('#e63946'), 0, 0.015, 0),
      part(cylG(0.505, 0.47, 0.1, 20, true), mat('#ffffff'), 0, 0.3, 0));
    g.children[0].material = new THREE.MeshStandardMaterial({ color: '#e63946', roughness: 0.6, side: THREE.DoubleSide });
    ring(5, 0.22, (x, z, a, i) => { const d = drumstick(); d.position.set(x, 0.2, z); d.rotation.set(Math.sin(a) * 0.5, a, -Math.cos(a) * 0.5 + (i % 2) * 0.2); g.add(d); });
    const mid = drumstick(); mid.position.set(0, 0.32, 0); g.add(mid);
    return g;
  },
  pizza() {
    const g = new THREE.Group(), r = rnd(11);
    add(g, part(cylG(0.5, 0.48, 0.07, 28), mat('#d9a25c', { rough: 0.9 }), 0, 0.035, 0), part(cylG(0.43, 0.43, 0.03, 28), mat('#ffcf4a', { rough: 0.5 }), 0, 0.075, 0));
    const crust = part(torusG(0.47, 0.045, 28), mat('#c98a45', { rough: 0.9 }), 0, 0.065, 0); crust.rotation.x = Math.PI / 2; g.add(crust);
    ring(7, 0.27, (x, z) => g.add(part(cylG(0.07, 0.07, 0.02, 12), mat('#c2331f', { rough: 0.5 }), x, 0.098, z)), 0.3);
    g.add(part(cylG(0.07, 0.07, 0.02, 12), mat('#c2331f', { rough: 0.5 }), 0, 0.098, 0));
    for (let i = 0; i < 9; i += 1) { const a = r() * 6.28, d = r() * 0.38; g.add(part(torusG(0.025, 0.01, 8), mat('#2b2b2b'), Math.sin(a) * d, 0.1, Math.cos(a) * d)); g.children.at(-1).rotation.x = Math.PI / 2; }
    for (let i = 0; i < 8; i += 1) { const a = r() * 6.28, d = r() * 0.38; g.add(part(boxG(0.05, 0.012, 0.02), mat('#3fa34d'), Math.sin(a) * d, 0.1, Math.cos(a) * d)); g.children.at(-1).rotation.y = a; }
    for (let i = 0; i < 4; i += 1) { const l = part(boxG(0.86, 0.006, 0.012), mat('#e0a93a'), 0, 0.093, 0); l.rotation.y = (i / 4) * Math.PI; g.add(l); }
    return g;
  },
  malatang: () => malatangBowl(0.5),
  donkatsu3() {
    const g = new THREE.Group();
    [[-0.42, 0, 0.25, 0.3], [0.42, 0, 0.25, -0.3], [0, 0, -0.45, 0], ].forEach(([x, y, z, ry]) => { const p = donkatsuPlate(); p.position.set(x, y, z); p.rotation.y = ry; g.add(p); });
    return g;
  },
  malatang2() {
    const g = new THREE.Group(), a = malatangBowl(0.5), b = malatangBowl(0.5);
    a.position.x = -0.54; b.position.x = 0.54; b.rotation.y = 2;
    return add(g, a, b);
  },
  malatang100() {
    const g = new THREE.Group(), spots = [];
    [30, 24, 18, 13, 9, 5, 1].forEach((n, layer) => {
      const R = n === 1 ? 0 : 0.2 * n / Math.PI;
      if (n > 12) { const inner = Math.round(n * 0.38), outer = n - inner; ring(outer, R * 0.78, (x, z) => spots.push([x, layer * 0.2, z])); ring(inner, R * 0.42, (x, z) => spots.push([x, layer * 0.2, z]), 0.3); } else ring(n, R * 0.62, (x, z) => spots.push([x, layer * 0.2, z]), layer);
    });
    add(g, instanced(cylG(0.17, 0.1, 0.19, 12), mat('#22262e', { rough: 0.35 }), spots.length, (d, i) => d.position.set(spots[i][0], spots[i][1] + 0.095, spots[i][2])),
      instanced(cylG(0.155, 0.155, 0.02, 12), mat('#d8301f', { rough: 0.25 }), spots.length, (d, i) => d.position.set(spots[i][0], spots[i][1] + 0.19, spots[i][2])),
      instanced(sphereG(0.04, 6, 5), mat('#4caf50', { flat: true }), spots.length, (d, i) => d.position.set(spots[i][0] + 0.05, spots[i][1] + 0.21, spots[i][2])),
      instanced(boxG(0.05, 0.04, 0.05), mat('#fff3c9'), spots.length, (d, i) => d.position.set(spots[i][0] - 0.05, spots[i][1] + 0.21, spots[i][2] + 0.03)));
    const flag = part(cylG(0.012, 0.012, 0.4, 6), mat('#ffffff'), 0, 1.6, 0), cloth = part(boxG(0.22, 0.13, 0.01), mat('#ffd43b', { emissive: '#ffb300', glow: 0.4 }), 0.11, 1.72, 0);
    return add(g, flag, cloth);
  },
  bungeoppang() {
    const g = new THREE.Group(), c = mat('#d9963a', { rough: 0.85, flat: true });
    add(g, part(sphereG(0.36, 14, 10), c, -0.08, 0.3, 0, [1.35, 0.8, 0.5]));
    const tail = part(coneG(0.3, 0.34, 4), c, 0.52, 0.3, 0, [1, 1, 0.3]); tail.rotation.z = Math.PI / 2; g.add(tail);
    const fin = part(coneG(0.12, 0.2, 4), c, -0.05, 0.6, 0, [1, 1, 0.3]); g.add(fin);
    for (const s of [1, -1]) {
      g.add(part(sphereG(0.045, 8, 6), mat('#4a2a10'), -0.38, 0.36, 0.14 * s));
      for (let i = 0; i < 3; i += 1) { const sc = part(torusG(0.11, 0.015, 10, Math.PI), mat('#a86a1f'), -0.1 + i * 0.15, 0.3, 0.172 * s); sc.rotation.z = -Math.PI / 2; g.add(sc); }
    }
    g.add(part(sphereG(0.07, 8, 6), mat('#6b2b2b'), -0.56, 0.27, 0, [0.5, 0.6, 1]));
    return g;
  },
  tteokbokki() {
    const g = bowl(0.52, '#3fbf7f', '#d4321c', 0.32), y = g.userData.top, r = rnd(5);
    for (let i = 0; i < 12; i += 1) { const t = part(capG(0.05, 0.2), mat('#ff7a45', { rough: 0.3 }), (r() - 0.5) * 0.6, y + 0.04 + r() * 0.05, (r() - 0.5) * 0.6); t.rotation.set(Math.PI / 2 + (r() - 0.5) * 0.4, 0, r() * 6); g.add(t); }
    for (let i = 0; i < 4; i += 1) { const f = part(coneG(0.1, 0.02, 3), mat('#e9b96e', { rough: 0.5 }), (r() - 0.5) * 0.6, y + 0.07, (r() - 0.5) * 0.6); f.rotation.y = r() * 6; g.add(f); }
    add(g, part(sphereG(0.1, 12, 8), mat('#ffffff', { rough: 0.3 }), 0.2, y + 0.06, -0.15, [1, 0.6, 1.25]), part(sphereG(0.05, 8, 6), mat('#ffb703'), 0.2, y + 0.1, -0.15, [1, 0.5, 1]));
    for (let i = 0; i < 8; i += 1) g.add(part(cylG(0.02, 0.02, 0.015, 6), mat('#6fd66b'), (r() - 0.5) * 0.6, y + 0.11, (r() - 0.5) * 0.6));
    return g;
  },
  gimbap() {
    const g = new THREE.Group();
    g.add(part(boxG(1.1, 0.04, 0.42), mat('#8a5a34', { rough: 0.6 }), 0, 0.02, 0));
    const cols = ['#ffd43b', '#ff922b', '#51cf66', '#ff8fa3', '#8a5a44'];
    for (let i = 0; i < 7; i += 1) {
      const k = new THREE.Group();
      add(k, part(cylG(0.15, 0.15, 0.1, 18), mat('#1c2a22', { rough: 0.5 }), 0, 0, 0), part(cylG(0.135, 0.135, 0.104, 18), mat('#fffdf5'), 0, 0, 0));
      cols.forEach((c, j) => { const a = (j / 5) * 6.28; k.add(part(cylG(0.035, 0.035, 0.108, 8), mat(c), Math.sin(a) * 0.05, 0, Math.cos(a) * 0.05)); });
      k.rotation.set(Math.PI / 2 - 0.5, 0, 0); k.rotation.order = 'YXZ'; k.rotation.y = Math.PI / 2;
      k.position.set(-0.42 + i * 0.14, 0.17, 0); g.add(k);
    }
    add(g, part(sphereG(0.06, 8, 6), mat('#ffe066'), 0.47, 0.06, 0.12, [1.6, 0.4, 1]), part(sphereG(0.06, 8, 6), mat('#ffe066'), 0.47, 0.08, 0.1, [1.6, 0.4, 1]));
    return g;
  },
  ramyeon() {
    const g = new THREE.Group(), pot = mat('#f2c230', { metal: 0.7, rough: 0.3 }), r = rnd(9);
    add(g, part(cylG(0.5, 0.46, 0.36, 28), pot, 0, 0.18, 0), part(cylG(0.47, 0.47, 0.02, 28), mat('#e2551c', { rough: 0.25 }), 0, 0.362, 0));
    const rim = part(torusG(0.5, 0.025, 28), pot, 0, 0.36, 0); rim.rotation.x = Math.PI / 2; g.add(rim);
    for (const s of [1, -1]) { const h = part(torusG(0.09, 0.022, 12, Math.PI), pot, 0.56 * s, 0.3, 0); h.rotation.set(Math.PI / 2, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2); g.add(h); }
    for (let i = 0; i < 9; i += 1) { const n = part(torusG(0.08 + r() * 0.2, 0.02, 18), mat('#ffe08a', { rough: 0.5 }), (r() - 0.5) * 0.3, 0.375 + i * 0.006, (r() - 0.5) * 0.3, [1, 1 - r() * 0.4, 1]); n.rotation.x = Math.PI / 2; n.rotation.z = r() * 6; g.add(n); }
    add(g, part(sphereG(0.14, 12, 8), mat('#ffffff', { rough: 0.3 }), 0.12, 0.4, 0.1, [1, 0.3, 1]), part(sphereG(0.065, 10, 8), mat('#ffb703', { rough: 0.3 }), 0.12, 0.43, 0.1, [1, 0.6, 1]));
    for (let i = 0; i < 10; i += 1) g.add(part(cylG(0.022, 0.022, 0.015, 6), mat('#58c043'), (r() - 0.5) * 0.7, 0.42, (r() - 0.5) * 0.7));
    for (const s of [0, 1]) { const c = part(cylG(0.012, 0.012, 0.9, 6), mat('#8a5a34'), -0.25 + s * 0.05, 0.55, -0.1); c.rotation.set(0.5, 0, 0.9); g.add(c); }
    return g;
  },
  burger() {
    const g = new THREE.Group(), bun = mat('#e0a04a', { rough: 0.7 }), r = rnd(4);
    add(g, part(cylG(0.46, 0.42, 0.14, 24), bun, 0, 0.07, 0), part(cylG(0.5, 0.5, 0.04, 14), mat('#58c043', { flat: true }), 0, 0.16, 0),
      part(cylG(0.47, 0.47, 0.13, 24), mat('#5b3520', { rough: 0.95, flat: true }), 0, 0.245, 0), part(boxG(0.84, 0.03, 0.84), mat('#ffc61a', { rough: 0.4 }), 0, 0.325, 0),
      part(cylG(0.42, 0.42, 0.05, 20), mat('#e8372d', { rough: 0.4 }), 0, 0.365, 0), part(cylG(0.48, 0.48, 0.03, 12), mat('#7bd65a', { flat: true }), 0, 0.405, 0),
      part(sphereG(0.47, 24, 12), bun, 0, 0.42, 0, [1, 0.62, 1]), part(cylG(0.46, 0.46, 0.03, 24), bun, 0, 0.425, 0));
    g.children[3].rotation.y = 0.5;
    for (let i = 0; i < 16; i += 1) { const a = r() * 6.28, d = r() * 0.3; const s = part(sphereG(0.022, 6, 4), mat('#fff3d6'), Math.sin(a) * d, 0.42 + 0.29 * Math.sqrt(1 - (d / 0.47) ** 2) , Math.cos(a) * d, [1, 0.5, 1.6]); s.rotation.y = a; g.add(s); }
    return g;
  },
  jjajang() {
    const g = bowl(0.5, '#ffffff', '#f3dfae', 0.5), y = g.userData.top;
    for (let i = 0; i < 5; i += 1) { const n = part(torusG(0.2 + i * 0.05, 0.022, 18), mat('#f3dfae'), 0, y + 0.01, 0); n.rotation.x = Math.PI / 2; g.add(n); }
    g.add(part(sphereG(0.36, 14, 10), mat('#2a1a10', { rough: 0.25, flat: true }), 0, y, 0, [1, 0.38, 1]));
    const r = rnd(8);
    for (let i = 0; i < 8; i += 1) g.add(part(boxG(0.06, 0.05, 0.06), mat(i % 2 ? '#6b4423' : '#e8d9b0', { rough: 0.3 }), (r() - 0.5) * 0.4, y + 0.1 + r() * 0.03, (r() - 0.5) * 0.4));
    for (let i = 0; i < 7; i += 1) { const c = part(boxG(0.2, 0.014, 0.022), mat('#7bd65a'), 0.02 + (r() - 0.5) * 0.06, y + 0.15 + i * 0.004, (r() - 0.5) * 0.08); c.rotation.y = r() * 3; g.add(c); }
    for (let i = 0; i < 5; i += 1) g.add(part(sphereG(0.025, 6, 5), mat('#51cf66'), (r() - 0.5) * 0.35, y + 0.14, (r() - 0.5) * 0.35));
    return g;
  },
  samgyeopsal() {
    const g = new THREE.Group(), r = rnd(6);
    add(g, part(cylG(0.52, 0.46, 0.08, 28), mat('#2b2d33', { metal: 0.6, rough: 0.5 }), 0, 0.04, 0), part(cylG(0.47, 0.47, 0.01, 28), mat('#3d4047', { metal: 0.5, rough: 0.4 }), 0, 0.083, 0));
    for (let i = 0; i < 5; i += 1) {
      const k = new THREE.Group();
      add(k, part(boxG(0.5, 0.045, 0.12), mat('#e88a7d', { rough: 0.6 }), 0, 0, 0), part(boxG(0.502, 0.047, 0.03), mat('#fff0e6', { rough: 0.5 }), 0, 0, 0.03), part(boxG(0.502, 0.047, 0.02), mat('#fff0e6', { rough: 0.5 }), 0, 0, -0.035));
      k.position.set(-0.08 + (r() - 0.5) * 0.1, 0.115 + i * 0.004, -0.26 + i * 0.13); k.rotation.y = (r() - 0.5) * 0.3; g.add(k);
    }
    for (let i = 0; i < 5; i += 1) g.add(part(sphereG(0.045, 8, 6), mat('#fff3c9'), 0.3 + (r() - 0.5) * 0.12, 0.11, (r() - 0.5) * 0.4, [1, 0.6, 1.3]));
    add(g, part(sphereG(0.13, 8, 6), mat('#e8442d', { flat: true }), 0.22, 0.12, 0.3, [1.2, 0.5, 1]), part(sphereG(0.2, 10, 6), mat('#58c043', { flat: true }), -0.62, 0.05, 0.2, [1, 0.25, 1.3]), part(sphereG(0.18, 10, 6), mat('#7bd65a', { flat: true }), -0.6, 0.09, 0.05, [1, 0.25, 1.3]));
    return g;
  },
  sushi30() {
    const g = new THREE.Group(), cols = ['#ff6b6b', '#ffd43b', '#4dabf7', '#51cf66', '#ff922b', '#b197fc'], tops = ['#ff7f50', '#c0392b', '#ffe066', '#ffb4a2', '#ff7f50'];
    ring(5, 0.5, (x, z, a, i) => {
      for (let k = 0; k < 6; k += 1) add(g, part(cylG(0.2, 0.15, 0.05, 16), mat(cols[(i + k) % 6], { rough: 0.35 }), x, 0.025 + k * 0.055, z));
      const y = 0.33;
      add(g, part(capG(0.055, 0.14), mat('#fffdf5'), x, y + 0.055, z), part(capG(0.06, 0.17), mat(tops[i], { rough: 0.35 }), x, y + 0.1, z, [1, 1, 0.55]));
      g.children.slice(-2).forEach((m) => { m.rotation.set(Math.PI / 2, 0, a); m.rotation.order = 'YXZ'; m.rotation.y = a; });
    });
    return g;
  },
  cake10() {
    const g = new THREE.Group();
    [[0, 0, 0], [0.84, 0, 0], [-0.84, 0, 0], [0.42, 0, 0.73], [-0.42, 0, 0.73], [0.42, 0, -0.73], [-0.42, 0, -0.73], [0.42, 0.36, 0.24], [-0.42, 0.36, 0.24], [0, 0.36, -0.48]].forEach(([x, y, z], i) => {
      const c = cake(); c.position.set(x, y, z); c.rotation.y = i; g.add(c);
    });
    return g;
  },
  chicken1000() {
    const g = new THREE.Group(), r = rnd(2), N = 1000, P = [];
    for (let i = 0; i < N; i += 1) { const h = Math.pow(r(), 1.7), rad = (1 - h) * 0.95 * Math.sqrt(r()), a = r() * 6.28; P.push([Math.sin(a) * rad, 0.42 + h * 1.5, Math.cos(a) * rad, r() * 6, r() * 6, 0.75 + r() * 0.5]); }
    const side = mat('#e63946', { rough: 0.6 });
    add(g, part(cylG(1.05, 0.8, 0.5, 28), side, 0, 0.25, 0), part(cylG(1.06, 1.0, 0.12, 28), mat('#ffffff'), 0, 0.4, 0),
      instanced(sphereG(0.085, 7, 5), mat('#c9772b', { rough: 0.9, flat: true }), N, (d, i) => { const p = P[i]; d.position.set(p[0], p[1], p[2]); d.rotation.set(p[3], p[4], 0); d.scale.set(p[5], p[5] * 1.35, p[5]); }),
      instanced(cylG(0.018, 0.018, 0.13, 5), mat('#fff6e6'), N, (d, i) => { const p = P[i]; d.position.set(p[0], p[1], p[2]); d.rotation.set(p[3], p[4], 0); d.translateY(0.13 * p[5]); }));
    return g;
  },
};

// ── 월드 3 눈꽃 얼음 나라 ──
const gloss = (c) => mat(c, { rough: 0.15 });
function scoopCone() {
  const g = new THREE.Group(), cone = part(coneG(0.24, 0.6, 14), mat('#d9a25c', { rough: 0.9, flat: true }), 0, 0.3, 0); cone.rotation.x = Math.PI;
  add(g, cone, part(sphereG(0.26), mat('#ff9ec4'), 0, 0.68, 0), part(sphereG(0.22), mat('#fff6e0'), 0, 0.98, 0), part(sphereG(0.18), mat('#9be7c4'), 0, 1.22, 0), part(sphereG(0.06, 8, 6), gloss('#e8262d'), 0, 1.42, 0));
  return g;
}
function pizzaStack(n, r = 0.5) {
  const g = new THREE.Group();
  add(g, instanced(cylG(r, r * 0.96, 0.05, 20), mat('#d9a25c', { rough: 0.9 }), n, (d, i) => { d.position.set(Math.sin(i * 1.7) * 0.03, 0.025 + i * 0.06, Math.cos(i * 2.3) * 0.03); d.rotation.y = i; }),
    instanced(cylG(r * 0.86, r * 0.86, 0.02, 20), mat('#ffcf4a', { rough: 0.5 }), n, (d, i) => d.position.set(Math.sin(i * 1.7) * 0.03, 0.055 + i * 0.06, Math.cos(i * 2.3) * 0.03)));
  ring(6, r * 0.5, (x, z) => g.add(part(cylG(0.07, 0.07, 0.02, 10), mat('#c2331f'), x, 0.07 + (n - 1) * 0.06, z)));
  return g;
}
function ramyeonPot(pot, soup, noodle, glow) {
  const g = new THREE.Group(), pm = mat(pot, { metal: 0.8, rough: 0.25 }), r = rnd(9);
  add(g, part(cylG(0.5, 0.46, 0.36, 28), pm, 0, 0.18, 0), part(cylG(0.47, 0.47, 0.02, 28), mat(soup, { rough: 0.25 }), 0, 0.362, 0));
  for (const s of [1, -1]) { const h = part(torusG(0.09, 0.022, 12, Math.PI), pm, 0.56 * s, 0.3, 0); h.rotation.set(Math.PI / 2, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2); g.add(h); }
  for (let i = 0; i < 9; i += 1) { const n = part(torusG(0.08 + r() * 0.2, 0.02, 18), mat(noodle, glow ? { emissive: noodle, glow: 0.6, rough: 0.3 } : { rough: 0.5 }), (r() - 0.5) * 0.3, 0.375 + i * 0.006, (r() - 0.5) * 0.3); n.rotation.x = Math.PI / 2; g.add(n); }
  add(g, part(sphereG(0.14, 12, 8), mat('#ffffff', { rough: 0.3 }), 0.12, 0.4, 0.1, [1, 0.3, 1]), part(sphereG(0.065, 10, 8), mat('#ffb703', { rough: 0.3 }), 0.12, 0.43, 0.1, [1, 0.6, 1]));
  return g;
}
Object.assign(BUILD, {
  icecream: scoopCone,
  tanghulu() {
    const g = new THREE.Group();
    for (const [x, tilt] of [[-0.22, 0.12], [0.22, -0.12]]) {
      const k = new THREE.Group(); k.add(part(cylG(0.02, 0.02, 1.3, 6), mat('#e8cf9a'), 0, 0.65, 0));
      for (let i = 0; i < 4; i += 1) k.add(part(sphereG(0.15, 14, 10), gloss(i % 2 ? '#3fae49' : '#e8262d'), 0, 0.42 + i * 0.27, 0, [1, 1.1, 1]), part(coneG(0.07, 0.05, 5), mat('#2f9e44'), 0, 0.57 + i * 0.27, 0));
      k.position.x = x; k.rotation.z = tilt; g.add(k);
    }
    return g;
  },
  donut() {
    const g = new THREE.Group(), r = rnd(12);
    [['#ff8fc7', 0, 0, 0], ['#6b3a1e', 0.2, 0.22, 0.3]].forEach(([ice, x, y, rot]) => {
      const k = new THREE.Group(), base = part(torusG(0.3, 0.16, 24), mat('#d9963a', { rough: 0.8 }), 0, 0.16, 0), top = part(torusG(0.3, 0.15, 24), mat(ice, { rough: 0.3 }), 0, 0.2, 0, [1, 1, 0.7]);
      base.rotation.x = top.rotation.x = Math.PI / 2; add(k, base, top);
      for (let i = 0; i < 14; i += 1) { const a = r() * 6.28, s = part(boxG(0.06, 0.02, 0.02), mat(['#ffd43b', '#ffffff', '#3fd0ff', '#7bff8a'][i % 4]), Math.sin(a) * 0.3, 0.31, Math.cos(a) * 0.3); s.rotation.y = r() * 3; k.add(s); }
      k.position.set(x, y, x); k.rotation.z = rot; g.add(k);
    });
    return g;
  },
  waffle() {
    const g = plate(0.55);
    for (let k = 0; k < 2; k += 1) {
      const w = new THREE.Group(); w.add(part(boxG(0.7, 0.08, 0.7), mat('#e0a04a', { rough: 0.85 }), 0, 0, 0));
      for (let i = 0; i < 5; i += 1) w.add(part(boxG(0.7, 0.05, 0.05), mat('#c98a3c', { rough: 0.85 }), 0, 0.055, -0.3 + i * 0.15), part(boxG(0.05, 0.05, 0.7), mat('#c98a3c', { rough: 0.85 }), -0.3 + i * 0.15, 0.055, 0));
      w.position.y = 0.1 + k * 0.13; w.rotation.y = k * 0.5; g.add(w);
    }
    add(g, part(boxG(0.16, 0.06, 0.16), mat('#ffe58a', { rough: 0.3 }), 0, 0.34, 0), part(sphereG(0.2, 12, 8), mat('#fff8ea'), 0.18, 0.36, 0.16, [1, 0.6, 1]), part(coneG(0.07, 0.12, 8), gloss('#e8262d'), -0.2, 0.36, 0.2), part(coneG(0.07, 0.12, 8), gloss('#e8262d'), -0.05, 0.36, -0.24));
    return g;
  },
  pudding() {
    const g = plate(0.5);
    add(g, part(cylG(0.24, 0.36, 0.42, 24), mat('#ffd76a', { rough: 0.25 }), 0, 0.26, 0), part(cylG(0.245, 0.27, 0.08, 24), mat('#7a3b12', { rough: 0.2 }), 0, 0.46, 0), part(sphereG(0.1, 12, 8), mat('#ffffff'), 0, 0.53, 0, [1, 0.8, 1]), part(sphereG(0.055, 8, 6), gloss('#e8262d'), 0, 0.62, 0));
    return g;
  },
  macaron() {
    const g = new THREE.Group();
    [['#ff9ec4', 0, 0.0, 0], ['#9be7c4', 0.34, 0, 0.2], ['#ffe08a', -0.32, 0, 0.22], ['#c79bff', 0.02, 0.26, 0.1]].forEach(([c, x, y, z]) => {
      add(g, part(sphereG(0.2, 16, 10), mat(c, { rough: 0.6 }), x, y + 0.08, z, [1, 0.45, 1]), part(cylG(0.18, 0.18, 0.06, 16), mat('#fff8ea'), x, y + 0.13, z), part(sphereG(0.2, 16, 10), mat(c, { rough: 0.6 }), x, y + 0.18, z, [1, 0.45, 1]));
    });
    return g;
  },
  cottoncandy() {
    const g = new THREE.Group(), r = rnd(21); g.add(part(cylG(0.025, 0.025, 1.0, 6), mat('#fff8ea'), 0, 0.5, 0));
    for (let i = 0; i < 16; i += 1) { const a = r() * 6.28, h = r(); g.add(part(geo(`ico${i % 3}`, () => new THREE.IcosahedronGeometry(0.2 + (i % 3) * 0.04, 1)), mat(i % 3 ? '#ffb3dc' : '#b9e3ff', { rough: 1, flat: true }), Math.sin(a) * (0.26 - Math.abs(h - 0.5) * 0.3), 0.75 + h * 0.6, Math.cos(a) * (0.26 - Math.abs(h - 0.5) * 0.3))); }
    g.add(part(sphereG(0.3, 12, 8), mat('#ffc7e6', { rough: 1, flat: true }), 0, 1.05, 0));
    return g;
  },
  bingsu() {
    const g = bowl(0.5, '#bfe6ff', '#ffffff', 0.5), y = g.userData.top, r = rnd(31);
    add(g, part(sphereG(0.42, 16, 10), mat('#ffffff', { rough: 0.9, flat: true }), 0, y, 0, [1, 0.75, 1]), part(sphereG(0.2, 12, 8), mat('#6b2b2b', { rough: 0.6, flat: true }), 0, y + 0.3, 0, [1, 0.6, 1]));
    for (let i = 0; i < 10; i += 1) { const a = r() * 6.28; g.add(part(boxG(0.08, 0.06, 0.08), mat(['#fff3c9', '#ffb703', '#ff7aa8', '#7bd65a'][i % 4]), Math.sin(a) * 0.28, y + 0.16 + r() * 0.08, Math.cos(a) * 0.28)); }
    g.add(part(sphereG(0.06, 8, 6), gloss('#e8262d'), 0, y + 0.42, 0));
    return g;
  },
  hotteok20() {
    const g = new THREE.Group();
    add(g, instanced(cylG(0.34, 0.34, 0.07, 18), mat('#d9963a', { rough: 0.8 }), 20, (d, i) => { const s = i % 2, k = i >> 1; d.position.set((s ? 0.38 : -0.38) + Math.sin(k * 2.1) * 0.04, 0.035 + k * 0.075, Math.cos(k * 1.3) * 0.04); }),
      instanced(cylG(0.2, 0.2, 0.075, 12), mat('#a8641f', { rough: 0.7 }), 20, (d, i) => { const s = i % 2, k = i >> 1; d.position.set((s ? 0.38 : -0.38) + Math.sin(k * 2.1) * 0.04, 0.036 + k * 0.075, Math.cos(k * 1.3) * 0.04); }));
    return g;
  },
  icecream500() {
    const g = new THREE.Group(), r = rnd(41), P = [];
    for (let i = 0; i < 500; i += 1) { const h = Math.pow(r(), 1.6), rad = (1 - h) * 0.9 * Math.sqrt(r()), a = r() * 6.28; P.push([Math.sin(a) * rad, 0.45 + h * 1.5, Math.cos(a) * rad]); }
    add(g, part(cylG(1.0, 0.6, 0.5, 20), mat('#d9a25c', { rough: 0.9, flat: true }), 0, 0.25, 0));
    ['#ff9ec4', '#fff6e0', '#9be7c4', '#8a5a34', '#b9e3ff'].forEach((c, k) => g.add(instanced(sphereG(0.13, 8, 6), mat(c), 100, (d, i) => { const p = P[i * 5 + k]; d.position.set(p[0], p[1], p[2]); })));
    g.add(part(sphereG(0.12, 8, 6), gloss('#e8262d'), 0, 2.05, 0));
    return g;
  },
  // ── 월드 4 우주 정거장 ──
  mandu() {
    const g = new THREE.Group();
    add(g, part(cylG(0.56, 0.56, 0.22, 24), mat('#d9b77a', { rough: 0.9 }), 0, 0.11, 0), part(cylG(0.5, 0.5, 0.02, 24), mat('#f3e3bd'), 0, 0.225, 0));
    const place = (x, z, a) => { const m = part(sphereG(0.15, 12, 8), mat('#fffaf0', { rough: 0.5 }), x, 0.31, z, [1.3, 0.75, 0.8]), fold = part(torusG(0.15, 0.03, 10, Math.PI), mat('#fff3dc'), x, 0.33, z); m.rotation.y = fold.rotation.y = a; g.add(m, fold); };
    ring(6, 0.3, (x, z, a) => place(x, z, a + Math.PI / 2)); place(0, 0, 0.4);
    return g;
  },
  hotdog() {
    const g = new THREE.Group();
    for (const [x, rot] of [[-0.2, 0.15], [0.2, -0.15]]) {
      const k = new THREE.Group();
      add(k, part(cylG(0.02, 0.02, 0.5, 6), mat('#e8cf9a'), 0, 0.25, 0), part(capG(0.15, 0.5), mat('#d9963a', { rough: 0.9, flat: true }), 0, 0.85, 0));
      for (let i = 0; i < 6; i += 1) { const z = part(torusG(0.155, 0.018, 12, Math.PI), mat(x < 0 ? '#e8262d' : '#ffd43b', { rough: 0.3 }), 0, 0.62 + i * 0.1, 0); z.rotation.set(Math.PI / 2 + 0.25, 0, i % 2 ? 0.3 : -0.3); k.add(z); }
      k.position.x = x; k.rotation.z = rot; g.add(k);
    }
    return g;
  },
  taco() {
    const g = new THREE.Group(), r = rnd(51);
    for (const [zz, ry] of [[-0.22, 0.15], [0.22, -0.1]]) {
      const k = new THREE.Group(), shell = new THREE.Mesh(geo('taco', () => new THREE.CylinderGeometry(0.34, 0.34, 0.26, 20, 1, true, 0, Math.PI)), new THREE.MeshStandardMaterial({ color: '#f2c14e', roughness: 0.8, side: THREE.DoubleSide }));
      shell.rotation.set(Math.PI / 2, 0, -Math.PI / 2); shell.position.y = 0.36; shell.castShadow = true; k.add(shell);
      for (let i = 0; i < 6; i += 1) k.add(part(sphereG(0.07, 6, 5), mat('#7a4a2a', { flat: true }), (r() - 0.5) * 0.45, 0.22 + r() * 0.05, (r() - 0.5) * 0.12));
      for (let i = 0; i < 6; i += 1) k.add(part(sphereG(0.07, 6, 5), mat(i % 2 ? '#58c043' : '#e8372d', { flat: true }), (r() - 0.5) * 0.5, 0.32 + r() * 0.05, (r() - 0.5) * 0.14, [1.3, 0.6, 1]));
      for (let i = 0; i < 5; i += 1) k.add(part(boxG(0.1, 0.02, 0.03), mat('#ffd43b'), (r() - 0.5) * 0.45, 0.38, (r() - 0.5) * 0.12));
      k.position.z = zz; k.rotation.y = ry; g.add(k);
    }
    return g;
  },
  curry() {
    const g = plate(0.55), r = rnd(61);
    add(g, part(sphereG(0.3, 16, 10), mat('#fffdf5', { rough: 0.9, flat: true }), -0.18, 0.05, 0, [1, 0.6, 1.1]), part(sphereG(0.34, 16, 10), mat('#c98a1e', { rough: 0.3 }), 0.16, 0.03, 0, [1, 0.35, 1.25]));
    for (let i = 0; i < 9; i += 1) g.add(part(boxG(0.08, 0.07, 0.08), mat(['#ff922b', '#f3dfae', '#8a5a44'][i % 3]), 0.05 + r() * 0.3, 0.13, (r() - 0.5) * 0.5));
    return g;
  },
  bibimbap() {
    const g = bowl(0.52, '#2b2d33', '#fffdf5', 0.5), y = g.userData.top;
    ['#ff922b', '#3fae49', '#8a5a44', '#ffe9a8', '#5b4636', '#e8262d'].forEach((c, i) => { const a = (i / 6) * 6.28, p = part(sphereG(0.17, 10, 8), mat(c, { flat: true }), Math.sin(a) * 0.27, y + 0.02, Math.cos(a) * 0.27, [1.2, 0.4, 0.8]); p.rotation.y = a + Math.PI / 2; g.add(p); });
    add(g, part(sphereG(0.15, 12, 8), mat('#ffffff', { rough: 0.3 }), 0, y + 0.04, 0, [1, 0.3, 1]), part(sphereG(0.07, 10, 8), mat('#ffb703', { rough: 0.3 }), 0, y + 0.08, 0, [1, 0.7, 1]));
    return g;
  },
  steak() {
    const g = plate(0.56);
    add(g, part(sphereG(0.32, 16, 10), mat('#6b3a22', { rough: 0.8 }), -0.05, 0.13, 0.02, [1.2, 0.32, 0.85]), part(boxG(0.12, 0.05, 0.12), mat('#ffe58a', { rough: 0.3 }), -0.05, 0.25, 0.02));
    for (let i = 0; i < 4; i += 1) { const l = part(boxG(0.5, 0.012, 0.03), mat('#2a1a10'), -0.05, 0.226, -0.15 + i * 0.11); l.rotation.y = 0.5; g.add(l); }
    for (let i = 0; i < 4; i += 1) { const s = part(capG(0.022, 0.3), mat('#58c043'), 0.3, 0.08 + i * 0.01, -0.1 + i * 0.07); s.rotation.set(Math.PI / 2, 0, 0.3); g.add(s); }
    for (let i = 0; i < 3; i += 1) g.add(part(sphereG(0.06, 8, 6), gloss('#e8372d'), -0.3 + i * 0.1, 0.1, -0.32));
    return g;
  },
  lobster() {
    const g = plate(0.6), red = mat('#e03a1e', { rough: 0.35 }), dark = mat('#b52a14', { rough: 0.35 });
    add(g, part(sphereG(0.17, 14, 10), red, 0, 0.2, -0.12, [1, 0.8, 1.5]));
    for (let i = 0; i < 5; i += 1) g.add(part(sphereG(0.14 - i * 0.018, 12, 8), i % 2 ? dark : red, 0, 0.17 - i * 0.012, 0.1 + i * 0.1, [1.1, 0.7, 0.8]));
    for (let i = 0; i < 3; i += 1) { const f = part(coneG(0.08, 0.16, 4), red, (i - 1) * 0.09, 0.1, 0.62, [1, 1, 0.3]); f.rotation.x = Math.PI / 2; g.add(f); }
    for (const s of [1, -1]) {
      const arm = part(capG(0.035, 0.22), dark, 0.2 * s, 0.17, -0.36); arm.rotation.set(Math.PI / 2, 0, -0.6 * s);
      add(g, arm, part(sphereG(0.11, 12, 8), red, 0.3 * s, 0.18, -0.52, [0.8, 0.6, 1.5]), part(coneG(0.04, 0.16, 6), red, 0.25 * s, 0.18, -0.66), part(sphereG(0.03, 6, 5), mat('#111111'), 0.06 * s, 0.3, -0.33));
      g.children.at(-2).rotation.x = -Math.PI / 2;
      const an = part(cylG(0.008, 0.008, 0.5, 4), dark, 0.1 * s, 0.34, -0.5); an.rotation.set(-1.0, 0, -0.3 * s); g.add(an);
      for (let i = 0; i < 3; i += 1) { const leg = part(capG(0.016, 0.2), dark, 0.2 * s, 0.1, -0.08 + i * 0.09); leg.rotation.z = 1.1 * s; g.add(leg); }
    }
    add(g, part(cylG(0.1, 0.1, 0.03, 12), mat('#ffe066'), 0.42, 0.07, 0.25), part(sphereG(0.1, 8, 6), mat('#58c043', { flat: true }), -0.42, 0.08, 0.2, [1, 0.4, 1]));
    return g;
  },
  burger50() {
    const g = new THREE.Group(), off = (i) => [Math.sin(i * 0.9) * 0.05, Math.cos(i * 1.3) * 0.05];
    [['#e0a04a', 0.42, 0.1, 0], ['#5b3520', 0.44, 0.09, 1], ['#ffc61a', 0.46, 0.025, 2], ['#58c043', 0.47, 0.03, 3], ['#e8372d', 0.4, 0.035, 4]].forEach(([c, rad, h, k]) => {
      g.add(instanced(cylG(rad, rad, h, 16), mat(c, { rough: 0.7, flat: k === 1 || k === 3 }), 10, (d, i) => { const [x, z] = off(i); d.position.set(x, i * 0.3 + [0.05, 0.145, 0.2, 0.23, 0.265][k], z); }));
    });
    const [x, z] = off(9); g.add(part(sphereG(0.43, 18, 10), mat('#e0a04a', { rough: 0.7 }), x, 3.0, z, [1, 0.55, 1]));
    return g;
  },
  pizza100() {
    const g = new THREE.Group();
    [[-0.52, -0.52], [0.52, -0.52], [-0.52, 0.52], [0.52, 0.52]].forEach(([x, z]) => { const s = pizzaStack(25); s.position.set(x, 0, z); g.add(s); });
    return g;
  },
  meatball10000() {
    const g = new THREE.Group(), r = rnd(71), N = 3000;
    add(g, part(cylG(1.25, 0.9, 0.12, 28), mat('#ffffff', { rough: 0.3 }), 0, 0.06, 0), part(sphereG(1.05, 20, 10), mat('#f3dfae', { rough: 0.9, flat: true }), 0, 0.1, 0, [1, 0.25, 1]), part(sphereG(0.95, 20, 10), mat('#c8281e', { rough: 0.3 }), 0, 0.2, 0, [1, 0.2, 1]),
      instanced(sphereG(0.07, 6, 5), mat('#7a4a2a', { rough: 0.8, flat: true }), N, (d) => { const h = Math.pow(r(), 1.8), rad = (1 - h) * 0.95 * Math.sqrt(r()), a = r() * 6.28; d.position.set(Math.sin(a) * rad, 0.35 + h * 1.7, Math.cos(a) * rad); }));
    return g;
  },
  // ── 월드 5 황금 구름 궁전 ──
  goldapple() {
    const g = new THREE.Group(), gold = mat('#ffcf33', { metal: 1, rough: 0.18, emissive: '#b8860b', glow: 0.35 });
    add(g, part(sphereG(0.4), gold, 0, 0.38, 0, [1, 0.95, 1]), part(sphereG(0.2), gold, 0, 0.12, 0, [1.5, 0.6, 1.5]), part(cylG(0.02, 0.025, 0.2, 6), mat('#6b4423'), 0.02, 0.8, 0), part(sphereG(0.13, 8, 6), mat('#58c043'), 0.16, 0.83, 0, [1.3, 0.2, 0.6]));
    return g;
  },
  watermelon() {
    const g = new THREE.Group();
    g.add(part(sphereG(0.48, 24, 16), mat('#2f9e44', { rough: 0.4 }), -0.25, 0.44, 0, [1, 0.92, 1]));
    for (let i = 0; i < 6; i += 1) { const s = part(torusG(0.475, 0.022, 28), mat('#14532d', { rough: 0.4 }), -0.25, 0.44, 0, [1, 0.92, 1]); s.rotation.y = (i / 6) * Math.PI; g.add(s); }
    const slice = new THREE.Group(), half = (rad, c, h) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, h, 24, 1, false, 0, Math.PI), mat(c, { rough: 0.5 })); m.castShadow = true; return m; };
    add(slice, half(0.42, '#2f9e44', 0.12), half(0.385, '#f4ffe0', 0.124), half(0.36, '#ff4d5e', 0.128));
    for (let i = 0; i < 7; i += 1) for (const s of [1, -1]) slice.add(part(sphereG(0.02, 6, 4), mat('#1a1a1a'), Math.sin(0.4 + i * 0.38) * (0.12 + (i % 3) * 0.08), 0.066 * s, Math.cos(0.4 + i * 0.38) * (0.12 + (i % 3) * 0.08)));
    slice.rotation.set(Math.PI / 2, 0, Math.PI / 2); slice.position.set(0.42, 0.02, 0.1); slice.rotation.order = 'YXZ'; slice.rotation.y = 0.5; g.add(slice);
    return g;
  },
  galbi() {
    const g = plate(0.58);
    for (let i = 0; i < 4; i += 1) {
      const k = new THREE.Group();
      add(k, part(sphereG(0.16, 12, 8), mat(i % 2 ? '#7a3b1e' : '#6b3018', { rough: 0.5, flat: true }), 0, 0, 0, [1.5, 0.7, 0.9]), part(cylG(0.035, 0.035, 0.5, 8), mat('#fff6e6'), 0.2, 0, 0), part(sphereG(0.05, 8, 6), mat('#fff6e6'), 0.46, 0, 0));
      k.children[1].rotation.z = Math.PI / 2; k.position.set(-0.1, 0.16 + (i > 1 ? 0.14 : 0), -0.2 + (i % 2) * 0.3 + (i > 1 ? -0.05 : 0)); k.rotation.y = (i - 1.5) * 0.2; g.add(k);
    }
    for (let i = 0; i < 8; i += 1) g.add(part(cylG(0.02, 0.02, 0.012, 6), mat('#58c043'), -0.1 + Math.sin(i * 2.4) * 0.25, 0.3, Math.cos(i * 1.7) * 0.25));
    return g;
  },
  turkey() {
    const g = plate(0.62, '#ffd43b'), skin = mat('#b5651d', { rough: 0.35 });
    add(g, part(sphereG(0.36, 20, 14), skin, 0, 0.34, 0, [1.25, 0.85, 1]), part(sphereG(0.2, 14, 10), mat('#c9772b', { rough: 0.35 }), 0, 0.5, 0, [1.3, 0.6, 1]));
    for (const s of [1, -1]) {
      const leg = part(sphereG(0.16, 12, 8), skin, 0.3, 0.3, 0.27 * s, [1.6, 0.8, 0.8]); leg.rotation.set(0, -0.5 * s, 0.5); g.add(leg);
      const bone = part(cylG(0.03, 0.03, 0.22, 8), mat('#fff6e6'), 0.56, 0.46, 0.38 * s); bone.rotation.z = -1.0; g.add(bone, part(sphereG(0.06, 8, 6), mat('#ffffff'), 0.66, 0.52, 0.38 * s));
      const wing = part(sphereG(0.12, 10, 8), skin, -0.2, 0.34, 0.36 * s, [1.5, 0.6, 0.6]); g.add(wing);
    }
    ring(7, 0.5, (x, z, a, i) => g.add(part(sphereG(0.07, 6, 5), i % 2 ? gloss('#e8372d') : mat('#58c043', { flat: true }), x, 0.1, z)), 0.2);
    return g;
  },
  octopus() {
    const g = plate(0.62), c = mat('#b0469a', { rough: 0.35 }), c2 = mat('#d07cc0', { rough: 0.35 });
    add(g, part(sphereG(0.3, 20, 14), c, 0, 0.5, 0, [1, 1.15, 1]));
    for (const s of [1, -1]) add(g, part(sphereG(0.06, 10, 8), mat('#ffffff'), 0.11 * s, 0.5, 0.26), part(sphereG(0.03, 8, 6), mat('#111111'), 0.11 * s, 0.5, 0.31));
    ring(8, 1, (dx, dz, a, i) => { for (let k = 0; k < 7; k += 1) { const d = 0.2 + k * 0.065, curl = k > 4 ? (k - 4) * 0.05 : 0; g.add(part(sphereG(0.085 - k * 0.009, 8, 6), k % 2 ? c2 : c, dx * d + Math.cos(a) * curl * (i % 2 ? 1 : -1), 0.22 - k * 0.022 + curl, dz * d - Math.sin(a) * curl * (i % 2 ? 1 : -1))); } }, 0.39);
    return g;
  },
  rainbowcake() {
    const g = plate(0.55);
    ['#b197fc', '#4dabf7', '#51cf66', '#ffd43b', '#ff922b', '#ff5e7e'].forEach((c, i) => add(g, part(cylG(0.42, 0.42, 0.11, 28), mat(c, { rough: 0.6 }), 0, 0.11 + i * 0.14, 0), part(cylG(0.425, 0.425, 0.03, 28), mat('#ffffff', { rough: 0.4 }), 0, 0.18 + i * 0.14, 0)));
    ring(10, 0.34, (x, z, a, i) => g.add(part(sphereG(0.06, 8, 6), mat(['#ff5e7e', '#ffd43b', '#4dabf7'][i % 3], { rough: 0.3 }), x, 0.93, z)));
    g.add(part(new THREE.OctahedronGeometry(0.14), mat('#ffe066', { emissive: '#ffd43b', glow: 0.9 }), 0, 1.08, 0));
    return g;
  },
  goldramyeon: () => ramyeonPot('#ffcf33', '#ffb300', '#fff0a8', true),
  feast() {
    const g = new THREE.Group();
    add(g, part(boxG(2.2, 0.1, 1.3), mat('#8a3b1e', { rough: 0.4 }), 0, 0.4, 0), part(boxG(2.26, 0.04, 1.36), mat('#ffd43b', { metal: 0.8, rough: 0.3 }), 0, 0.34, 0));
    for (const x of [-0.95, 0.95]) for (const z of [-0.5, 0.5]) g.add(part(cylG(0.06, 0.05, 0.36, 8), mat('#6b2b14'), x, 0.18, z));
    [['chicken', -0.75, -0.3], ['pizza', 0, -0.32], ['burger', 0.75, -0.3], ['malatang', -0.75, 0.32], ['rainbowcake', 0, 0.3], ['sushi30', 0.75, 0.32], ['gimbap', -0.38, 0], ['tteokbokki', 0.38, 0]].forEach(([id, x, z]) => { const f = makeFood(id, 0.52); f.position.set(x, 0.45, z); g.add(f); });
    return g;
  },
  malatang10000() {
    const g = new THREE.Group(), r = rnd(81), N = 1600, P = [];
    for (let i = 0; i < N; i += 1) { const h = Math.pow(r(), 1.5), rad = (1 - h) * 1.05 * Math.sqrt(r()), a = r() * 6.28; P.push([Math.sin(a) * rad, h * 2.2, Math.cos(a) * rad, r() * 6]); }
    add(g, part(coneG(1.0, 2.1, 20), mat('#22262e'), 0, 1.05, 0),
      instanced(cylG(0.085, 0.05, 0.09, 8), mat('#22262e', { rough: 0.35 }), N, (d, i) => { d.position.set(P[i][0], P[i][1] + 0.045, P[i][2]); d.rotation.y = P[i][3]; }),
      instanced(cylG(0.078, 0.078, 0.012, 8), mat('#d8301f', { rough: 0.25 }), N, (d, i) => d.position.set(P[i][0], P[i][1] + 0.09, P[i][2])),
      part(cylG(0.015, 0.015, 0.5, 6), mat('#ffffff'), 0, 2.5, 0), part(boxG(0.3, 0.18, 0.012), mat('#ffd43b', { emissive: '#ffb300', glow: 0.5 }), 0.15, 2.65, 0));
    return g;
  },
  earthmajju() {
    const g = new THREE.Group(), r = rnd(91), wrap = mat('#ffffff', { rough: 0.35 });
    g.add(part(sphereG(0.6, 32, 20), mat('#2f8fff', { rough: 0.4 }), 0, 0.62, 0));
    for (let i = 0; i < 16; i += 1) { const a = r() * 6.28, e = (r() - 0.5) * 2.2, R = 0.585; const land = part(sphereG(0.12 + r() * 0.14, 8, 6), mat(i % 5 === 0 ? '#ffffff' : '#3fae49', { rough: 0.8, flat: true }), Math.sin(a) * Math.cos(e) * R, 0.62 + Math.sin(e) * R, Math.cos(a) * Math.cos(e) * R, [1, 1, 0.3]); land.lookAt(0, 0.62, 0); g.add(land); }
    for (const s of [1, -1]) { const c = part(coneG(0.36, 0.5, 12), wrap, 0.85 * s, 0.62, 0); c.rotation.z = (Math.PI / 2) * s; g.add(c, part(torusG(0.16, 0.05, 12), mat('#ff9ec4'), 0.62 * s, 0.62, 0)); g.children.at(-1).rotation.y = Math.PI / 2; }
    return g;
  },
});

export function makeFood(id, size = 1) {
  const inner = (BUILD[id] || BUILD.apple)(), box = new THREE.Box3().setFromObject(inner), dim = box.getSize(new THREE.Vector3());
  const k = size / Math.max(dim.x, dim.y * 1.15, dim.z), c = box.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -box.min.y, -c.z);
  const g = new THREE.Group(); g.add(inner); g.scale.setScalar(k);
  g.userData.height = dim.y * k;
  return g;
}
