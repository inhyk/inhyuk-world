// 블록 칸 놓기에 같이 쓰는 것: 하늘 타워(src/tower.js)와 모두의 공터(src/commons.js).
// 블록 그리기(종류마다 InstancedMesh 하나), 미리 보기 상자, 화면 위치에서 칸 고르기, 블록 고르는 막대.
import { THREE, material } from './render.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TOWER, BLOCKS } from '../core.mjs';

const geo = new RoundedBoxGeometry(TOWER.CELL, TOWER.CELL, TOWER.CELL, 2, 0.14);
const ICON = { glass: '💎', neon: '✨', gold: '👑', ice: '🧊', bounce: '⤒', ladder: '🪜', wood: '🪵', stone: '🪨' };
const matOf = b => material(b.c, b.m ?? (b.k === 'glass' ? 'glass' : b.k === 'ice' ? 'ice' : 'plastic'));

// 블록 17종을 종류마다 InstancedMesh 하나로 그린다 (종류마다 cap 개까지)
export class BlockMeshes {
  constructor(parent, cap) {
    this.cap = cap;
    this.m = new THREE.Matrix4();
    this.meshes = BLOCKS.map(b => {
      const mesh = new THREE.InstancedMesh(geo, matOf(b), cap);
      mesh.count = 0; mesh.castShadow = b.k !== 'glass'; mesh.receiveShadow = true; mesh.frustumCulled = false;
      parent.add(mesh);
      return mesh;
    });
  }
  // cells: 칸들 (c.t 가 블록 번호), where(c) → [x, y, z] (칸 가운데)
  draw(cells, where) {
    const counts = BLOCKS.map(() => 0);
    for (const c of cells) {
      const n = counts[c.t]++;
      if (n >= this.cap) continue;
      const [x, y, z] = where(c);
      this.m.makeTranslation(x, y, z);
      this.meshes[c.t].setMatrixAt(n, this.m);
    }
    this.meshes.forEach((mesh, t) => { mesh.count = Math.min(this.cap, counts[t]); mesh.instanceMatrix.needsUpdate = true; });
  }
  dispose() { for (const m of this.meshes) { m.removeFromParent(); m.dispose(); } }
}

// 놓을 자리를 보여 주는 반투명 상자와 테두리 선
export class Ghost {
  constructor(parent) {
    const g = new THREE.BoxGeometry(TOWER.CELL + 0.06, TOWER.CELL + 0.06, TOWER.CELL + 0.06);
    this.mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.38, depthWrite: false });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.edges = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: '#ffffff' }));
    this.mesh.add(this.edges);
    this.mesh.visible = false;
    parent.add(this.mesh);
  }
  show(x, y, z, color, opacity, edge) {
    this.mesh.position.set(x, y, z);
    this.mat.color.set(color);
    this.mat.opacity = opacity;
    this.edges.material.color.set(edge);
    this.mesh.visible = true;
  }
  hide() { this.mesh.visible = false; }
  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose(); this.mat.dispose(); this.edges.geometry.dispose(); this.edges.material.dispose();
  }
}

// 화면 위치(cx, cy) → 광선이 처음 닿는 칸 면 또는 바닥.
//   cells: 고를 수 있는 칸들 (c.box 가 부딪힘 상자), groundY: 바닥 높이, ground(x, z) → { i, k } (짓는 땅 밖이면 null)
//   돌려줌: { cell, normal } | { ground: true, i, k } | { outside: true } | null (아무것도 안 닿음)
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
export function pickCell(camera, cx, cy, cells, groundY, ground) {
  ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const o = ray.ray.origin, d = ray.ray.direction;
  let best = 90, hit = null;
  const oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];
  for (const c of cells) {
    const b = c.box;
    const lo = [b.x0, b.y0, b.z0], hi = [b.x1, b.y1, b.z1];
    let t0 = 0, t1 = best, axis = -1, ok = true;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(dd[a]) < 1e-9) { if (oo[a] < lo[a] || oo[a] > hi[a]) { ok = false; break; } continue; }
      let ta = (lo[a] - oo[a]) / dd[a], tb = (hi[a] - oo[a]) / dd[a];
      if (ta > tb) [ta, tb] = [tb, ta];
      if (ta > t0) { t0 = ta; axis = a; }
      if (tb < t1) t1 = tb;
      if (t0 > t1) { ok = false; break; }
    }
    if (ok && axis >= 0 && t0 < best) {
      best = t0;
      const n = [0, 0, 0]; n[axis] = dd[axis] > 0 ? -1 : 1;
      hit = { cell: c, normal: n };
    }
  }
  if (d.y < -1e-6) {
    const tg = (groundY - o.y) / d.y;
    if (tg > 0 && tg < best) {
      const at = ground(o.x + d.x * tg, o.z + d.z * tg);
      hit = at ? { ground: true, i: at.i, k: at.k } : { outside: true };
    }
  }
  return hit;
}

// 블록 고르는 막대 (#build-bar): 놓기/부수기 버튼, 블록 17종, 아래에 도움말.
//   onSelect(n) 블록을 눌렀다, onToggle() 놓기/부수기 버튼을 눌렀다. 다른 버튼은 돌려받은 막대에 더 붙인다.
//   digits: 숫자 키로 고를 수 있으면 true (버튼 설명에 숫자를 적는다)
export function makeBlockBar({ tip, sfx, onSelect, onToggle, digits = true }) {
  const bar = document.createElement('div');
  bar.id = 'build-bar';
  bar.innerHTML = '<button class="mode" title="놓기/부수기 바꾸기 (F)">🧱 놓기</button><div class="blocks"></div><p class="tip"></p>';
  const list = bar.querySelector('.blocks');
  BLOCKS.forEach((b, n) => {
    const btn = document.createElement('button');
    btn.title = `${b.name}${digits && n < 10 ? ` (${(n + 1) % 10})` : ''}`;
    btn.setAttribute('aria-label', b.name);
    btn.style.setProperty('--c', b.c);
    const ic = ICON[b.id];
    if (ic) btn.textContent = ic;
    if (b.k === 'glass') btn.classList.add('glass');
    btn.addEventListener('click', () => { sfx('click'); onSelect(n); });
    list.append(btn);
  });
  bar.querySelector('.mode').addEventListener('click', () => { sfx('click'); onToggle(); });
  bar.querySelector('.tip').textContent = tip;
  document.body.append(bar);
  return bar;
}
// 막대에서 고른 블록 표시
export function barSelect(bar, t) {
  bar.querySelectorAll('.blocks button').forEach((b, n) => b.classList.toggle('on', n === t));
  bar.querySelector('.blocks button.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
// 막대의 놓기/부수기 표시
export function barMode(bar, m) {
  const btn = bar.querySelector('.mode');
  btn.textContent = m === 'place' ? '🧱 놓기' : '⛏️ 부수기';
  btn.classList.toggle('remove', m === 'remove');
}
