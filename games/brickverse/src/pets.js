// 펫: 광장의 "알 판매"에서 코인 100으로 알을 까면 강아지, 고양이, 판다, 앵무새 중 하나가 나온다.
// 데리고 다니는 펫이 달리기 속도를 올려 준다 (강아지 1.5배, 고양이 2배, 판다 5배, 앵무새 10배).
import { THREE } from './render.js';
import { PETS, EGG_PRICE, petOf, hatchPet, chanceText } from '../core.mjs';
import { EGG_STAND } from '../worlds.mjs';

const mats = new Map();
const mat = c => { if (!mats.has(c)) mats.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 })); return mats.get(c); };
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const ballGeo = new THREE.SphereGeometry(0.5, 14, 10);
const coneGeo = new THREE.ConeGeometry(0.5, 1, 4);

function part(g, geo, c, sx, sy, sz, x, y, z) {
  const m = new THREE.Mesh(geo, mat(c));
  m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true;
  g.add(m);
  return m;
}
const eyes = (g, y, z, gap = 0.16, c = '#1e1f26') => { for (const s of [-1, 1]) part(g, boxGeo, c, 0.09, 0.11, 0.04, s * gap, y, z); };

// 펫 모양 (앞쪽 +z, 발바닥 y=0). legs: 걸을 때 흔드는 다리, wings: 날개
export function makePet(id) {
  const g = new THREE.Group();
  const legs = [], wings = [];
  let tail = null;
  if (id === 'dog' || id === 'cat' || id === 'panda') {
    const c = { dog: '#c98a4b', cat: '#ffb347', panda: '#f6f6f6' }[id];
    const legC = id === 'panda' ? '#26272d' : c;
    part(g, boxGeo, c, 0.62, 0.48, 0.95, 0, 0.55, 0);
    for (const [x, z] of [[-0.2, 0.32], [0.2, 0.32], [-0.2, -0.32], [0.2, -0.32]]) {
      const leg = new THREE.Group(); leg.position.set(x, 0.38, z);
      part(leg, boxGeo, legC, 0.17, 0.38, 0.17, 0, -0.19, 0);
      g.add(leg); legs.push(leg);
    }
    const head = new THREE.Group(); head.position.set(0, 0.92, 0.5); g.add(head);
    part(head, boxGeo, c, 0.6, 0.52, 0.52, 0, 0, 0);
    eyes(head, 0.06, 0.27);
    if (id === 'dog') {
      part(head, boxGeo, '#e8c49a', 0.3, 0.2, 0.22, 0, -0.1, 0.33);
      part(head, boxGeo, '#1e1f26', 0.12, 0.08, 0.06, 0, -0.03, 0.45);
      for (const s of [-1, 1]) part(head, boxGeo, '#7a4a2a', 0.14, 0.36, 0.22, s * 0.36, -0.02, -0.02);
      tail = part(g, boxGeo, c, 0.1, 0.1, 0.42, 0, 0.78, -0.62); tail.rotation.x = 0.7;
    } else if (id === 'cat') {
      for (const s of [-1, 1]) { const e = part(head, coneGeo, c, 0.22, 0.26, 0.16, s * 0.18, 0.36, 0); e.rotation.y = Math.PI / 4; }
      part(head, boxGeo, '#ff8fa8', 0.08, 0.06, 0.04, 0, -0.05, 0.28);
      for (const s of [-1, 1]) part(g, boxGeo, '#e08a2a', 0.64, 0.08, 0.14, 0, 0.72, s * 0.22);
      tail = part(g, boxGeo, c, 0.09, 0.62, 0.09, 0, 0.98, -0.5); tail.rotation.x = -0.35;
    } else {
      for (const s of [-1, 1]) { part(head, ballGeo, '#26272d', 0.2, 0.2, 0.12, s * 0.26, 0.28, 0); part(head, boxGeo, '#26272d', 0.18, 0.16, 0.04, s * 0.16, 0.05, 0.265); }
      eyes(head, 0.07, 0.29, 0.16, '#ffffff');
      part(head, boxGeo, '#26272d', 0.1, 0.07, 0.04, 0, -0.1, 0.28);
      part(g, boxGeo, '#26272d', 0.64, 0.2, 0.5, 0, 0.72, 0.18);
    }
  } else {
    // 앵무새: 빨간 머리, 초록 몸, 파란 날개, 노란 부리, 긴 꼬리
    part(g, ballGeo, '#3fd16b', 0.5, 0.62, 0.5, 0, 0.5, 0);
    part(g, ballGeo, '#ff3b4e', 0.42, 0.4, 0.42, 0, 0.95, 0.08);
    eyes(g, 1.0, 0.27, 0.12);
    const beak = part(g, coneGeo, '#ffd23f', 0.14, 0.24, 0.14, 0, 0.9, 0.34); beak.rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) {
      const w = new THREE.Group(); w.position.set(s * 0.24, 0.62, 0);
      part(w, boxGeo, '#3f7dff', 0.5, 0.06, 0.34, s * 0.25, 0, 0);
      g.add(w); wings.push(w);
    }
    tail = part(g, boxGeo, '#3f7dff', 0.12, 0.05, 0.6, 0, 0.32, -0.4); tail.rotation.x = 0.5;
  }
  g.userData = { legs, wings, tail, fly: id === 'parrot' };
  return g;
}

// 주인을 따라다니는 펫 하나
export class PetFollower {
  constructor(parent) {
    this.parent = parent;
    this.id = '';
    this.mesh = null;
    this.x = 0; this.y = 0; this.z = 0; this.yaw = 0; this.t = Math.random() * 10;
  }
  set(id) {
    if (id === this.id) return;
    this.id = id;
    this.mesh?.removeFromParent();
    this.mesh = id ? makePet(id) : null;
    if (this.mesh) { this.mesh.scale.setScalar(id === 'parrot' ? 0.9 : 1.15); this.parent.add(this.mesh); this.snap = true; }
  }
  // 주인 옆 뒤쪽을 따라간다 (너무 멀면 바로 옆으로)
  update(dt, x, y, z, yaw, visible = true) {
    const m = this.mesh;
    if (!m) return;
    m.visible = visible;
    if (!visible) return;
    const fly = m.userData.fly;
    const side = fly ? 0.75 : 1.3, back = fly ? 0.1 : 1.5;
    const tx = x + Math.cos(yaw) * side - Math.sin(yaw) * back;
    const tz = z - Math.sin(yaw) * side - Math.cos(yaw) * back;
    const ty = y + (fly ? 2.9 : 0);
    if (this.snap || Math.hypot(tx - this.x, tz - this.z) > 30) { this.x = tx; this.y = ty; this.z = tz; this.snap = false; }
    const k = 1 - Math.exp(-dt * 9);
    const px = this.x, pz = this.z;
    this.x += (tx - this.x) * k; this.y += (ty - this.y) * k; this.z += (tz - this.z) * k;
    const sp = Math.hypot(this.x - px, this.z - pz) / Math.max(dt, 1e-3);
    if (sp > 0.6) this.yaw = Math.atan2(this.x - px, this.z - pz);
    else { let d = yaw - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * k * 0.5; }
    this.t += dt * (sp > 0.6 ? 12 : 3);
    const { legs, wings, tail } = m.userData;
    const hop = fly ? Math.sin(this.t * 0.6) * 0.15 : sp > 0.6 ? Math.abs(Math.sin(this.t)) * 0.18 : 0;
    m.position.set(this.x, this.y + hop, this.z);
    m.rotation.y = this.yaw;
    legs.forEach((l, i) => { l.rotation.x = sp > 0.6 ? Math.sin(this.t + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.7 : 0; });
    wings.forEach((w, i) => { w.rotation.z = Math.sin(this.t * 2.4) * 0.8 * (i ? -1 : 1); });
    if (tail && !fly) tail.rotation.z = Math.sin(this.t * 1.5) * 0.4;
  }
  dispose() { this.mesh?.removeFromParent(); this.mesh = null; this.id = ''; }
}

// 가게 앞 팻말: "알 판매" + 동그라미 4개 (그림 그대로)
export function eggSign() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 400;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(8, 8, 1008, 384, 40); g.fill();
  g.strokeStyle = '#ffb347'; g.lineWidth = 14; g.stroke();
  g.fillStyle = '#3a2a1a'; g.font = '120px Jua, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('🥚 알 판매', 512, 92);
  g.fillStyle = '#ffb347'; g.fillRect(60, 160, 904, 8); g.fillRect(60, 362, 904, 8);
  PETS.forEach((p, i) => {
    const x = 160 + i * 235, y = 262;
    g.fillStyle = '#fff3d6'; g.beginPath(); g.arc(x, y, 82, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 6; g.stroke();
    g.font = '86px sans-serif'; g.fillText(p.icon, x, y - 8);
    g.fillStyle = '#e0335a'; g.font = '34px Jua, sans-serif'; g.fillText(`${p.speed}배`, x, y + 56);
    g.fillStyle = '#3a2a1a';
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.2), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
  m.position.set(EGG_STAND.x, 1.3, EGG_STAND.z - 0.52);
  m.rotation.y = Math.PI;
  return m;
}

// 알 까기 창
export class EggShop {
  constructor(game) {
    this.game = game;
    const el = document.createElement('section');
    el.id = 'eggs';
    el.hidden = true;
    el.setAttribute('aria-label', '알 판매');
    el.innerHTML = `<div class="card">
      <button class="x" aria-label="닫기">✕</button>
      <h2>🥚 알 판매</h2>
      <p class="small">코인 ${EGG_PRICE}개로 알을 까면 펫이 나와! 데리고 다니면 달리기가 빨라져.</p>
      <div class="egg-odds">${PETS.map(p => `<div class="odd"><i>${p.icon}</i><b>${p.name}</b><span>속도 ${p.speed}배</span><em>${chanceText(p.chance)}</em></div>`).join('')}</div>
      <div class="egg-stage"><div class="egg-big">🥚</div><p class="egg-msg"></p></div>
      <button class="primary wide hatch">🥚 알 까기 · 🪙 ${EGG_PRICE}</button>
      <h3>내 펫</h3>
      <div class="my-pets"></div>
    </div>`;
    document.body.append(el);
    this.el = el;
    el.querySelector('.x').addEventListener('click', () => { game.sfx('click'); this.close(); });
    el.querySelector('.hatch').addEventListener('click', () => this.hatch());
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-pet]');
      if (!b) return;
      game.sfx('click');
      game.setPet(b.dataset.pet === game.save.pet ? '' : b.dataset.pet);
      this.render();
    });
    this.busy = false;
  }
  get open() { return !this.el.hidden; }
  show() {
    this.game.setShiftLock(false);
    this.el.hidden = false;
    this.game.controlsOff(true);
    this.el.querySelector('.egg-msg').textContent = '';
    this.el.querySelector('.egg-big').textContent = '🥚';
    this.el.querySelector('.egg-big').className = 'egg-big';
    this.render();
  }
  close() { if (this.el.hidden) return; this.el.hidden = true; this.game.controlsOff(false); }
  render() {
    const s = this.game.save;
    const hatch = this.el.querySelector('.hatch');
    hatch.disabled = this.busy;
    hatch.classList.toggle('poor', s.coins < EGG_PRICE);
    const owned = PETS.filter(p => s.pets[p.id] > 0);
    this.el.querySelector('.my-pets').innerHTML = owned.length
      ? owned.map(p => `<button data-pet="${p.id}" class="${s.pet === p.id ? 'on' : ''}"><i>${p.icon}</i><b>${p.name} ×${s.pets[p.id]}</b><span>${s.pet === p.id ? '✓ 같이 다니는 중 (누르면 넣기)' : `데리고 다니기 · ${p.speed}배`}</span></button>`).join('')
      : '<p class="small">아직 펫이 없어. 알을 까 봐!</p>';
  }
  hatch() {
    const g = this.game, s = g.save;
    if (this.busy) return;
    if (s.coins < EGG_PRICE) { g.sfx('nope'); g.ui.toast(`🪙 코인이 ${EGG_PRICE - s.coins}개 모자라! 점프 탑과 게임에서 모아 봐.`); return; }
    this.busy = true;
    s.coins -= EGG_PRICE;
    g.ui.setCoins(s.coins);
    const id = hatchPet();
    const pet = petOf(id);
    s.pets[id] = (s.pets[id] ?? 0) + 1;
    const better = !s.pet || pet.speed > (petOf(s.pet)?.speed ?? 0);
    g.persist();
    const egg = this.el.querySelector('.egg-big'), msg = this.el.querySelector('.egg-msg');
    egg.textContent = '🥚'; egg.className = 'egg-big shake'; msg.textContent = '두근두근…';
    g.sfx('tick');
    this.render();
    setTimeout(() => g.sfx('tick'), 450);
    setTimeout(() => g.sfx('tick'), 900);
    setTimeout(() => {
      egg.textContent = pet.icon; egg.className = `egg-big born ${id}`;
      msg.innerHTML = `<b>${pet.name}</b> 나왔어! 속도 ${pet.speed}배${id === 'parrot' ? ' · 0.1% 대박!!' : id === 'panda' ? ' · 5% 행운!' : ''}`;
      g.sfx(id === 'parrot' || id === 'panda' ? 'win' : 'check');
      const p = g.player;
      g.effects.confetti(p.x, p.y + 3, p.z, id === 'parrot' ? 320 : 120);
      if (better) g.setPet(id);
      g.ui.log(`🥚 알에서 ${pet.icon} ${pet.name} 나왔어!`);
      this.busy = false;
      this.render();
    }, 1400);
  }
}
