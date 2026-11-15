// 트랙 풍경 만들기: 도로, 연석, 벽, 출발문, 나무 같은 장식. 전부 코드로 그린다.
import * as THREE from 'three';
import { rng32 } from '../core.mjs';

export const THEMES = {
  forest: { amp: 16, hi: 0x3c9647, bloom: [0.35, 4.4], skyTop: 0x2f8fff, skyBot: 0xd6f1ff, ground: 0x5cc152, shoulder: 0x86d667, road: '#5b606c', line: '#ffffff', curbA: '#ff4d5e', curbB: '#ffffff', wallA: '#ffffff', wallB: '#39c2ff', sun: 0xfff1cf, sunI: 2.6, hemiSky: 0xe2f4ff, hemiGround: 0x4f8a3c, hemiI: 1.25, mountain: 0x4a9d5c, fog: [160, 620] },
  beach: { amp: 5, hi: 0xe2bf74, bloom: [0.35, 4.8], skyTop: 0x1596ff, skyBot: 0xfff1cc, ground: 0xf0d590, shoulder: 0xf8e8b8, road: '#6b707c', line: '#ffffff', curbA: '#00b8d9', curbB: '#ffffff', wallA: '#ffd23e', wallB: '#ff7a59', sun: 0xfff6dd, sunI: 2.9, hemiSky: 0xdff6ff, hemiGround: 0xcaa860, hemiI: 1.3, mountain: 0x2fb3d6, fog: [180, 660] },
  snow: { amp: 22, hi: 0xffffff, bloom: [0.3, 4.6], skyTop: 0x6fa9f5, skyBot: 0xf6fbff, ground: 0xeef4fd, shoulder: 0xdbe7f6, road: '#77828f', line: '#ffffff', curbA: '#4d7cff', curbB: '#ffffff', wallA: '#cfe9ff', wallB: '#6fa8ff', sun: 0xffffff, sunI: 2.3, hemiSky: 0xf2f8ff, hemiGround: 0x9fb4cf, hemiI: 1.45, mountain: 0xd7e4f5, fog: [130, 520] },
  city: { amp: 0, hi: 0x171b30, bloom: [0.42, 1.9], skyTop: 0x070b2a, skyBot: 0x5a2f8f, ground: 0x171b30, shoulder: 0x262b47, road: '#2a2d3b', line: '#21e6ff', curbA: '#ff3df0', curbB: '#21e6ff', wallA: '#21e6ff', wallB: '#7a3dff', sun: 0xb9a8ff, sunI: 1.5, hemiSky: 0x8f7bff, hemiGround: 0x20203a, hemiI: 1.5, mountain: 0x140f38, fog: [150, 560], night: true },
  volcano: { amp: 20, hi: 0x1f1210, bloom: [0.5, 2.6], skyTop: 0x260a0c, skyBot: 0xff7a2e, ground: 0x3b2a26, shoulder: 0x56382d, road: '#423a3b', line: '#ffd23e', curbA: '#ff8a00', curbB: '#2a1a16', wallA: '#6a4a40', wallB: '#ff5a1e', sun: 0xffb37a, sunI: 2.1, hemiSky: 0xff9a5c, hemiGround: 0x3a2018, hemiI: 1.3, mountain: 0x2a1917, fog: [130, 500] },
  cloud: { amp: 7, hi: 0xffe6f5, bloom: [0.3, 4.6], skyTop: 0x5d9dff, skyBot: 0xffdcf3, ground: 0xfbfdff, shoulder: 0xfff0fa, road: 'rainbow', line: '#ffffff', curbA: '#ffe14d', curbB: '#ff7ad9', wallA: '#ffffff', wallB: '#a0e9ff', sun: 0xffffff, sunI: 2.4, hemiSky: 0xffffff, hemiGround: 0xffc9ec, hemiI: 1.5, mountain: 0xffffff, fog: [150, 560] },
};

function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function roadTexture(th) {
  return canvasTex(256, 256, (g, w, h) => {
    if (th.road === 'rainbow') {
      const cols = ['#ff6b8b', '#ffa64d', '#ffe14d', '#6ee08a', '#5fc8ff', '#8f8bff', '#d58bff'];
      cols.forEach((c, i) => { g.fillStyle = c; g.fillRect((i * w) / cols.length, 0, w / cols.length + 1, h); });
      g.fillStyle = 'rgba(255,255,255,.28)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    } else {
      g.fillStyle = th.road; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    }
    g.fillStyle = th.line; g.fillRect(6, 0, 6, h); g.fillRect(w - 12, 0, 6, h);
    g.globalAlpha = 0.85; g.fillRect(w / 2 - 3, 0, 6, h * 0.5); g.globalAlpha = 1;
  });
}
const stripeTexture = (a, b) => canvasTex(64, 64, (g, w, h) => { g.fillStyle = a; g.fillRect(0, 0, w, h / 2); g.fillStyle = b; g.fillRect(0, h / 2, w, h / 2); });
function groundTexture(base) {
  const c = new THREE.Color(base);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#' + c.getHexString(); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const dark = Math.random() < 0.5;
      g.fillStyle = `rgba(${dark ? '0,0,0' : '255,255,255'},${0.025 + Math.random() * 0.04})`;
      g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 4 + Math.random() * 18, 0, 7); g.fill();
    }
  });
}

// 트랙을 따라가는 띠. d0 < d1 (옆 방향 거리)
function ribbon(T, d0, d1, y, vScale) {
  const n = T.n, pos = new Float32Array((n + 1) * 6), uv = new Float32Array((n + 1) * 4), idx = [];
  for (let i = 0; i <= n; i++) {
    const k = i % n, nx = T.tz[k], nz = -T.tx[k], v = (i * T.ds) / vScale;
    pos.set([T.x[k] + nx * d0, y, T.z[k] + nz * d0, T.x[k] + nx * d1, y, T.z[k] + nz * d1], i * 6);
    uv.set([0, v, 1, v], i * 4);
    if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function wallRibbon(T, d, hgt, vScale) {
  const n = T.n, pos = new Float32Array((n + 1) * 6), uv = new Float32Array((n + 1) * 4), idx = [];
  for (let i = 0; i <= n; i++) {
    const k = i % n, x = T.x[k] + T.tz[k] * d, z = T.z[k] - T.tx[k] * d, u = (i * T.ds) / vScale;
    pos.set([x, 0, z, x, hgt, z], i * 6); uv.set([u, 0, u, 1], i * 4);
    if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function inst(group, geo, mat, list, shadow = false) {
  if (!list.length) return null;
  const m = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D();
  list.forEach((p, i) => {
    o.position.set(p.x, p.y || 0, p.z); o.rotation.set(0, p.ry || 0, 0); o.scale.set(p.sx ?? p.s ?? 1, p.sy ?? p.s ?? 1, p.sz ?? p.s ?? 1); o.updateMatrix(); m.setMatrixAt(i, o.matrix);
    if (p.c !== undefined) m.setColorAt(i, new THREE.Color(p.c));
  });
  m.castShadow = shadow; m.instanceMatrix.needsUpdate = true;
  group.add(m);
  return m;
}
const lam = (color, extra) => new THREE.MeshLambertMaterial({ color, ...extra });
const c01 = (v) => Math.max(0, Math.min(1, v));

export function buildWorld(scene, T) {
  const th = THEMES[T.theme], group = new THREE.Group(), rnd = rng32(T.n * 7 + 3), anim = [];
  scene.add(group);
  scene.fog = new THREE.Fog(th.skyBot, th.fog[0], th.fog[1]);
  // 하늘
  const skyGeo = new THREE.SphereGeometry(900, 24, 12), top = new THREE.Color(th.skyTop), bot = new THREE.Color(th.skyBot), cols = [];
  const sp = skyGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) { const f = Math.pow(Math.max(0, sp.getY(i) / 900), 0.55), c = bot.clone().lerp(top, f); cols.push(c.r, c.g, c.b); }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -1; group.add(sky);
  // 빛
  const hemi = new THREE.HemisphereLight(th.hemiSky, th.hemiGround, th.hemiI); group.add(hemi);
  const sun = new THREE.DirectionalLight(th.sun, th.sunI);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 10; sc.far = 220; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
  group.add(sun, sun.target);
  // 땅: 트랙 옆은 평평하고, 멀어질수록 언덕이 솟는다
  let cx = 0, cz = 0; for (let i = 0; i < T.n; i++) { cx += T.x[i]; cz += T.z[i]; } cx /= T.n; cz /= T.n;
  const AMP = th.amp, EDGE = T.theme === 'beach' ? 300 : 700;
  const distTo = (x, z, step = 3) => { let m = Infinity; for (let i = 0; i < T.n; i += step) { const dx = x - T.x[i], dz = z - T.z[i], d = dx * dx + dz * dz; if (d < m) m = d; } return Math.sqrt(m); };
  const hill = (x, z) => (Math.sin(x * 0.013 + 1.7) * Math.cos(z * 0.011 + 0.4) * 0.5 + 0.5) * 0.75 + (Math.sin(x * 0.037 + z * 0.021) * 0.5 + 0.5) * 0.25;
  const heightAt = (x, z, dist = AMP ? distTo(x, z) : 0) => {
    if (!AMP) return 0;
    const m = c01((dist - T.wall - 5) / 70) * c01((EDGE - Math.hypot(x - cx, z - cz)) / 80);
    return AMP * m * m * (3 - 2 * m) * hill(x, z);
  };
  const gt = groundTexture(0xf4f4f4); gt.repeat.set(60, 60);
  const tg = new THREE.PlaneGeometry(1500, 1500, 150, 150).rotateX(-Math.PI / 2).translate(cx, 0, cz), tp = tg.attributes.position, tcol = [];
  const lo = new THREE.Color(th.ground), hi = new THREE.Color(th.hi), tmp = new THREE.Color();
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), z = tp.getZ(i), y = AMP ? heightAt(x, z, distTo(x, z, 4)) : 0;
    tp.setY(i, y); tmp.copy(lo).lerp(hi, AMP ? c01(y / AMP) : 0); tcol.push(tmp.r, tmp.g, tmp.b);
  }
  tg.setAttribute('color', new THREE.Float32BufferAttribute(tcol, 3)); tg.computeVertexNormals();
  const ground = new THREE.Mesh(tg, lam(0xffffff, { map: gt, vertexColors: true }));
  ground.position.y = -0.02; ground.receiveShadow = true; group.add(ground);
  const farGround = new THREE.Mesh(new THREE.CircleGeometry(900, 48), lam(th.ground)); farGround.rotation.x = -Math.PI / 2; farGround.position.y = -0.4; group.add(farGround);
  // 도로와 갓길, 연석
  const road = new THREE.Mesh(ribbon(T, -T.half, T.half, 0.03, 9), lam(0xffffff, { map: roadTexture(th) }));
  road.receiveShadow = true; group.add(road);
  for (const s of [-1, 1]) {
    const a = s < 0 ? -T.wall : T.half, b = s < 0 ? -T.half : T.wall;
    const sh = new THREE.Mesh(ribbon(T, a, b, 0.012, 6), lam(th.shoulder)); sh.receiveShadow = true; group.add(sh);
    const c0 = s < 0 ? -T.half - 0.9 : T.half, curb = new THREE.Mesh(ribbon(T, c0, c0 + 0.9, 0.05, 4), lam(0xffffff, { map: stripeTexture(th.curbA, th.curbB) }));
    curb.receiveShadow = true; group.add(curb);
    const wt = stripeTexture(th.wallA, th.wallB); wt.rotation = Math.PI / 2;
    const wall = new THREE.Mesh(wallRibbon(T, s * T.wall, 1.15, 5), new THREE.MeshLambertMaterial({ map: wt, side: THREE.DoubleSide, emissive: th.night ? new THREE.Color(th.wallA) : 0x000000, emissiveIntensity: th.night ? 0.9 : 0, emissiveMap: th.night ? wt : null }));
    group.add(wall);
  }
  // 출발선과 출발문
  const ch = canvasTex(128, 32, (g) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(i * 8, j * 8, 8, 8); } }, false);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(T.half * 2, 2.2), new THREE.MeshBasicMaterial({ map: ch }));
  line.rotation.set(-Math.PI / 2, 0, -T.h[0]); line.position.set(T.x[0], 0.06, T.z[0]); group.add(line);
  const gate = new THREE.Group(); gate.position.set(T.x[0], 0, T.z[0]); gate.rotation.y = T.h[0];
  const pm = lam(0xffffff), pg = new THREE.CylinderGeometry(0.45, 0.55, 8, 12);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(pg, pm); p.position.set(s * (T.wall + 0.6), 4, 0); p.castShadow = true; gate.add(p); const ball = new THREE.Mesh(new THREE.SphereGeometry(0.8, 14, 10), lam(0xffd23e)); ball.position.set(s * (T.wall + 0.6), 8.4, 0); gate.add(ball); }
  const banner = canvasTex(1024, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#ff4d7a'); gr.addColorStop(0.5, '#ffb400'); gr.addColorStop(1, '#39c2ff');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.font = '900 84px "Jua","Black Han Sans",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,.35)'; g.strokeText('씽씽 카트 · ' + T.name, w / 2, h / 2 + 4); g.fillText('씽씽 카트 · ' + T.name, w / 2, h / 2 + 4);
  }, false);
  const bn = new THREE.Mesh(new THREE.BoxGeometry((T.wall + 0.6) * 2, 2.2, 0.4), [pm, pm, pm, pm, new THREE.MeshBasicMaterial({ map: banner }), new THREE.MeshBasicMaterial({ map: banner })]);
  bn.position.y = 7; gate.add(bn); group.add(gate);

  // ── 장식: 트랙에서 떨어진 곳에만 놓는다 ──
  const far = (x, z, pad) => { for (let i = 0; i < T.n; i += 3) { const dx = x - T.x[i], dz = z - T.z[i]; if (dx * dx + dz * dz < pad * pad) return false; } return true; };
  const scatter = (count, pad, near = 60, tries = 30) => {
    const out = [];
    for (let c = 0; c < count; c++) for (let t = 0; t < tries; t++) {
      // 트랙 옆 가까운 곳에 많이 놓이게: 아무 조각 하나를 골라 옆으로 민다
      const i = Math.floor(rnd() * T.n), side = rnd() < 0.5 ? -1 : 1, d = T.wall + pad + rnd() * near;
      const x = T.x[i] + T.tz[i] * d * side, z = T.z[i] - T.tx[i] * d * side;
      if (far(x, z, T.wall + pad)) { out.push({ x, z, gy: heightAt(x, z), ry: rnd() * 6.28, s: 0.8 + rnd() * 0.6 }); break; }
    }
    return out;
  };
  const cone = (r, h, seg = 8) => new THREE.ConeGeometry(r, h, seg), cyl = (a, b, h, seg = 8) => new THREE.CylinderGeometry(a, b, h, seg), sph = (r, a = 10, b = 8) => new THREE.SphereGeometry(r, a, b);
  const up = (list, y, k = 1) => list.map((p) => ({ ...p, y: y * p.s + p.gy, s: p.s * k }));
  if (T.theme === 'forest') {
    const t = scatter(230, 3);
    inst(group, cyl(0.35, 0.5, 2.4), lam(0x8a5a36), up(t, 1.2), true);
    inst(group, cone(2.3, 4.2), lam(0x2f9e4a), up(t, 4.0), true);
    inst(group, cone(1.7, 3.2), lam(0x46b85a), up(t, 5.9), true);
    const b = scatter(140, 1.5, 30); inst(group, sph(1.1), lam(0x3fae4f), up(b, 0.6));
    const m = scatter(70, 1.2, 22); inst(group, cyl(0.22, 0.28, 0.8), lam(0xfff4e0), up(m, 0.4)); inst(group, sph(0.7, 10, 6), lam(0xff4d5e), up(m, 0.95).map((p) => ({ ...p, sy: p.s * 0.6 })));
    const f = scatter(160, 1, 18); inst(group, sph(0.28, 6, 5), lam(0xffffff), f.map((p, i) => ({ ...p, y: 0.25 + p.gy, c: [0xfff275, 0xff8fb1, 0xffffff, 0xb48cff][i % 4] })));
  } else if (T.theme === 'beach') {
    const t = scatter(150, 3);
    inst(group, cyl(0.22, 0.38, 5.4, 7), lam(0xa9814f), up(t, 2.7), true);
    const leaf = new THREE.SphereGeometry(2.4, 8, 5); leaf.scale(1, 0.28, 1);
    inst(group, leaf, lam(0x2fbf71), up(t, 5.6), true);
    inst(group, sph(0.35, 6, 5), lam(0x7a4a22), up(t, 5.1));
    const p = scatter(60, 2, 26);
    inst(group, cyl(0.07, 0.07, 2.6, 6), lam(0xffffff), up(p, 1.3));
    inst(group, cone(1.9, 0.9, 10), lam(0xffffff), up(p, 2.9).map((q, i) => ({ ...q, c: [0xff5d73, 0x39c2ff, 0xffd23e, 0xff8a3d][i % 4] })), true);
    const r = scatter(90, 1.2, 30); inst(group, new THREE.DodecahedronGeometry(0.8), lam(0xc9b79a), up(r, 0.35));
    const sea = new THREE.Mesh(new THREE.RingGeometry(330, 900, 48), new THREE.MeshLambertMaterial({ color: 0x23b5e8 })); sea.rotation.x = -Math.PI / 2; sea.position.y = 0.01; group.add(sea);
  } else if (T.theme === 'snow') {
    const t = scatter(210, 3);
    inst(group, cyl(0.3, 0.42, 2, 7), lam(0x6b4a34), up(t, 1), true);
    inst(group, cone(2.2, 3.6), lam(0x2f7d5b), up(t, 3.4), true);
    inst(group, cone(1.6, 2.8), lam(0xf4f9ff), up(t, 5.2), true);
    const s = scatter(45, 2, 22);
    inst(group, sph(0.9), lam(0xffffff), up(s, 0.8), true); inst(group, sph(0.62), lam(0xffffff), up(s, 2.0), true); inst(group, cone(0.14, 0.6, 6), lam(0xff8a3d), up(s, 2.05).map((p) => ({ ...p, y: p.y, sx: p.s, sy: p.s, sz: p.s })));
    const r = scatter(110, 1.5, 34); inst(group, new THREE.IcosahedronGeometry(1.1), new THREE.MeshLambertMaterial({ color: 0xbfe6ff, flatShading: true }), up(r, 0.5));
  } else if (T.theme === 'city') {
    const b = scatter(170, 9, 90);
    const win = canvasTex(64, 128, (g, w, h) => { g.fillStyle = '#10142c'; g.fillRect(0, 0, w, h); for (let y = 0; y < 12; y++) for (let x = 0; x < 5; x++) if (Math.random() < 0.62) { g.fillStyle = ['#ffe58a', '#21e6ff', '#ff7ad9', '#fff'][Math.floor(Math.random() * 4)]; g.fillRect(4 + x * 12, 5 + y * 10, 8, 6); } });
    const bm = new THREE.MeshLambertMaterial({ color: 0x8890c0, map: win, emissive: 0xffffff, emissiveMap: win, emissiveIntensity: 1.5 });
    inst(group, new THREE.BoxGeometry(9, 1, 9).translate(0, 0.5, 0), bm, b.map((p) => ({ ...p, ry: Math.round(p.ry / 1.57) * 1.57, sx: 0.8 + rnd() * 0.8, sy: 12 + rnd() * 34, sz: 0.8 + rnd() * 0.8 })));
    const l = scatter(120, 0.8, 2);
    inst(group, cyl(0.1, 0.14, 5, 6), lam(0x3a3f5c), l.map((p) => ({ ...p, y: 2.5, s: 1 })));
    inst(group, sph(0.42, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 4) }), l.map((p, i) => ({ ...p, y: 5.1, s: 1, c: [0x21e6ff, 0xff3df0, 0xffe14d][i % 3] })));
  } else if (T.theme === 'volcano') {
    const r = scatter(220, 2, 50);
    inst(group, new THREE.DodecahedronGeometry(1.6), new THREE.MeshLambertMaterial({ color: 0x3a2a28, flatShading: true }), r.map((p) => ({ ...p, y: 0.6 * p.s + p.gy, sx: p.s * (0.7 + rnd()), sy: p.s * (0.8 + rnd() * 1.8), sz: p.s * (0.7 + rnd()) })), true);
    const lv = scatter(60, 3, 9), lg = new THREE.CircleGeometry(3, 16).rotateX(-Math.PI / 2);
    const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff7a1e }); inst(group, lg, lavaMat, lv.map((p) => ({ ...p, y: 0.06 + p.gy, sx: p.s * (0.7 + rnd()), sz: p.s * (0.7 + rnd()), sy: 1 })));
    anim.push((t) => lavaMat.color.setHSL(0.05 + 0.02 * Math.sin(t * 2), 1, 0.52 + 0.06 * Math.sin(t * 3)).multiplyScalar(3.5));
    const d = scatter(70, 2.5, 30); inst(group, cyl(0.12, 0.3, 3.4, 5), lam(0x1e1513), up(d, 1.7), true);
    const vol = new THREE.Mesh(new THREE.ConeGeometry(190, 200, 28, 1, true), lam(0x2a1917)); vol.position.set(40, 99, 520); group.add(vol);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(46, 16, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff7a1e).multiplyScalar(3), fog: false })); glow.position.set(40, 196, 520); group.add(glow);
  } else {
    const c = scatter(170, 3, 70), puff = sph(2.4, 10, 8), cm = lam(0xffffff);
    inst(group, puff, cm, c.map((p) => ({ ...p, y: 1.2 * p.s + p.gy, sy: p.s * 0.7 })));
    inst(group, puff, cm, c.map((p) => ({ ...p, x: p.x + 2.4 * p.s, y: 0.9 * p.s + p.gy, s: p.s * 0.72 })));
    inst(group, puff, cm, c.map((p) => ({ ...p, x: p.x - 2.2 * p.s, z: p.z + 0.8, y: 0.9 * p.s + p.gy, s: p.s * 0.66 })));
    const st = scatter(90, 2, 40); const starM = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const stars = inst(group, new THREE.OctahedronGeometry(0.7), starM, st.map((p, i) => ({ ...p, y: 2.5 + rnd() * 9 + p.gy, c: [0xffe14d, 0xff9fe0, 0x9fe8ff][i % 3] })));
    anim.push((t) => { stars.rotation.y = Math.sin(t * 0.2) * 0.01; });
    const rb = scatter(12, 18, 60);
    for (const p of rb) {
      const arc = new THREE.Group();
      ['#ff6b8b', '#ffa64d', '#ffe14d', '#6ee08a', '#5fc8ff', '#b48cff'].forEach((col, i) => { const m = new THREE.Mesh(new THREE.TorusGeometry(16 - i * 1.1, 0.55, 6, 28, Math.PI), new THREE.MeshBasicMaterial({ color: col })); arc.add(m); });
      arc.position.set(p.x, p.gy - 1, p.z); arc.rotation.y = p.ry; arc.scale.setScalar(p.s); group.add(arc);
    }
  }
  // ── 커브 화살표 표지판 (바깥쪽 벽 위) ──
  const chev = (dir) => canvasTex(128, 64, (g) => {
    g.fillStyle = '#ffd21f'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#16181f';
    for (let i = 0; i < 3; i++) { const x = 14 + i * 38; g.beginPath(); if (dir < 0) { g.moveTo(x + 24, 6); g.lineTo(x, 32); g.lineTo(x + 24, 58); g.lineTo(x + 36, 58); g.lineTo(x + 12, 32); g.lineTo(x + 36, 6); } else { g.moveTo(x + 12, 6); g.lineTo(x + 36, 32); g.lineTo(x + 12, 58); g.lineTo(x, 58); g.lineTo(x + 24, 32); g.lineTo(x, 6); } g.fill(); }
  }, false);
  const signs = { '-1': [], 1: [] }, posts = [];
  for (let i = 0; i < T.n; i += 5) {
    if (Math.abs(T.curv[i]) < 0.03) continue;
    const left = T.curv[i] > 0, sg = left ? -1 : 1, d = sg * (T.wall + 0.7), x = T.x[i] + T.tz[i] * d, z = T.z[i] - T.tx[i] * d;
    signs[left ? -1 : 1].push({ x, y: 2.1, z, ry: T.h[i] + Math.PI, s: 1 }); posts.push({ x, y: 0.9, z, s: 1 });
  }
  for (const dir of [-1, 1]) inst(group, new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshBasicMaterial({ map: chev(dir), side: THREE.DoubleSide }), signs[dir]);
  inst(group, cyl(0.09, 0.09, 1.8, 6), lam(0x8a93a6), posts);
  // ── 부스터 발판 ──
  if (T.pads.length) {
    const pt = canvasTex(64, 64, (g) => {
      g.fillStyle = '#0b2f66'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#7dfcff'; g.lineWidth = 9; g.lineJoin = 'round';
      for (const y of [6, 38]) { g.beginPath(); g.moveTo(8, y); g.lineTo(32, y + 20); g.lineTo(56, y); g.stroke(); }
    });
    pt.repeat.set(1, 2);
    const pm = new THREE.MeshBasicMaterial({ map: pt, color: new THREE.Color(1, 1, 1).multiplyScalar(th.night ? 2.2 : 5.5) });
    for (const pad of T.pads) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 6).rotateX(-Math.PI / 2), pm); m.position.set(pad.x, 0.075, pad.z); m.rotation.y = pad.h; group.add(m);
      const rim = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 6.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe14d })); rim.position.set(pad.x, 0.065, pad.z); rim.rotation.y = pad.h; group.add(rim);
    }
    anim.push((t) => { pt.offset.y = (t * 1.6) % 1; });
  }
  // ── 출발선 관중석 ──
  for (const side of [-1, 1]) {
    const ok = [-18, -9, 0, 9, 18].every((o) => { const p = { x: T.x[0] + T.tx[0] * o + T.tz[0] * side * (T.wall + 10), z: T.z[0] + T.tz[0] * o - T.tx[0] * side * (T.wall + 10) }; return far(p.x, p.z, T.wall + 6); });
    if (!ok) continue;
    const st = new THREE.Group(); st.position.set(T.x[0] + T.tz[0] * side * (T.wall + 5), 0, T.z[0] - T.tx[0] * side * (T.wall + 5)); st.rotation.y = T.h[0] + (side > 0 ? 0 : Math.PI);
    // 이 묶음 안에서는 +x 가 트랙에서 멀어지는 쪽, z 가 트랙을 따라가는 쪽
    const stepM = lam(th.night ? 0x3a3f66 : 0xdfe5f2), people = [];
    for (let r = 0; r < 4; r++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1 * (r + 1), 40), stepM); b.position.set(1.1 + r * 2.2, 0.55 * (r + 1), 0); b.castShadow = true; st.add(b);
      for (let c = 0; c < 26; c++) people.push({ x: 1.1 + r * 2.2 + (rnd() - 0.5) * 0.6, y: 1.1 * (r + 1) + 0.55, z: -19 + c * 1.5 + rnd() * 0.5, s: 0.8 + rnd() * 0.35, c: [0xff5d73, 0x39c2ff, 0xffd23e, 0x6ee08a, 0xb48cff, 0xffffff, 0xff9a3d][Math.floor(rnd() * 7)] });
    }
    const crowd = inst(st, new THREE.CapsuleGeometry(0.33, 0.5, 3, 8), lam(0xffffff), people);
    const heads = inst(st, sph(0.3, 8, 6), lam(0xffd9b8), people.map((p) => ({ ...p, y: p.y + 0.72 * p.s, c: undefined })));
    const roof = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.35, 42), lam(0xff4d5e)); roof.position.set(4.8, 8.4, 0); roof.rotation.z = 0.08; roof.castShadow = true; st.add(roof);
    for (const z of [-20, 0, 20]) { const post = new THREE.Mesh(cyl(0.18, 0.18, 8.6, 8), lam(0xffffff)); post.position.set(9.4, 4.3, z); st.add(post); }
    anim.push((t) => { const y = Math.abs(Math.sin(t * 5)) * 0.14; crowd.position.y = y; heads.position.y = y; });
    group.add(st);
    break;
  }
  // ── 하늘: 해, 구름, 열기구 / 밤에는 별과 달 ──
  const skyStuff = new THREE.Group(); group.add(skyStuff);
  if (th.night || T.theme === 'volcano') {
    const n = 500, sp2 = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = rnd() * 6.283, e = 0.12 + rnd() * 1.3, r = 800; sp2[i * 3] = Math.cos(a) * Math.cos(e) * r; sp2[i * 3 + 1] = Math.sin(e) * r; sp2[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp2, 3));
    skyStuff.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: T.theme === 'volcano' ? 0xffc08a : 0xffffff, size: 2.4, sizeAttenuation: false, fog: false, transparent: true, opacity: T.theme === 'volcano' ? 0.5 : 0.95 })));
    if (th.night) { const moon = new THREE.Mesh(sph(34, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff6d8).multiplyScalar(2.4), fog: false })); moon.position.set(-360, 330, 620); skyStuff.add(moon); }
  } else {
    const sunBall = new THREE.Mesh(sph(42, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff3b8).multiplyScalar(9), fog: false })); sunBall.position.set(420, 520, 270); skyStuff.add(sunBall);
    const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), puffs = [];
    for (let i = 0; i < 26; i++) { const a = rnd() * 6.283, r = 320 + rnd() * 420, x = Math.cos(a) * r, z = Math.sin(a) * r, y = 150 + rnd() * 120, k = 14 + rnd() * 16; for (const [ox, sc] of [[0, 1], [1.3, 0.72], [-1.25, 0.66], [0.5, 0.8]]) puffs.push({ x: x + ox * k, y: y + (sc - 1) * k * 0.4, z, sx: k * sc, sy: k * sc * 0.55, sz: k * sc * 0.8 }); }
    const clouds = inst(skyStuff, sph(1, 10, 8), cm, puffs);
    anim.push((t) => { clouds.rotation.y = t * 0.004; });
    if (T.theme !== 'cloud') for (let i = 0; i < 5; i++) {
      const b = new THREE.Group(), col = [0xff5d73, 0x39c2ff, 0xffd23e, 0x6ee08a, 0xb48cff][i];
      const top = new THREE.Mesh(sph(8, 16, 12), lam(col)); top.scale.y = 1.15; b.add(top);
      const band = new THREE.Mesh(new THREE.TorusGeometry(7.9, 0.9, 6, 20), lam(0xffffff)); band.rotation.x = Math.PI / 2; b.add(band);
      const neck = new THREE.Mesh(cone(5.5, 7, 12), lam(col)); neck.rotation.x = Math.PI; neck.position.y = -9; b.add(neck);
      const basket = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 2.6), lam(0x8a5a36)); basket.position.y = -14.5; b.add(basket);
      const a = rnd() * 6.283, r = 150 + rnd() * 260, by = 55 + rnd() * 55; b.position.set(cx + Math.cos(a) * r, by, cz + Math.sin(a) * r); skyStuff.add(b);
      anim.push((t) => { b.position.y = by + Math.sin(t * 0.5 + i * 2) * 4; b.rotation.y = t * 0.1 + i; });
    }
  }
  // 먼 산
  const mts = [];
  for (let i = 0; i < 46; i++) { const a = (i / 46) * 6.283 + rnd() * 0.1, r = 560 + rnd() * 180; mts.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: 0, sx: 70 + rnd() * 90, sy: 50 + rnd() * 130, sz: 70 + rnd() * 90, ry: rnd() * 6 }); }
  inst(group, T.theme === 'cloud' ? sph(1, 10, 8) : T.theme === 'city' ? new THREE.BoxGeometry(0.7, 2, 0.7) : new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0), lam(th.mountain, T.theme === 'city' ? { emissive: 0x3a2a7a, emissiveIntensity: 0.5 } : {}), mts);

  return {
    group, sun, theme: th,
    update(t, px, pz) {
      sun.position.set(px + 55, 90, pz + 35); sun.target.position.set(px, 0, pz); sun.target.updateMatrixWorld();
      sky.position.set(px, 0, pz); skyStuff.position.set(T.theme === 'cloud' || th.night || T.theme === 'volcano' ? px : 0, 0, T.theme === 'cloud' || th.night || T.theme === 'volcano' ? pz : 0);
      for (const f of anim) f(t);
    },
    dispose() {
      scene.remove(group);
      group.traverse((o) => { if (o.geometry) o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) { for (const key of ['map', 'emissiveMap']) if (m[key]) m[key].dispose(); m.dispose(); } });
    },
  };
}
