// 달걀 도둑: 경비를 피해 둥지의 알을 훔쳐 내 기지 받침대에 놓으면 부화해서 동물이 돈을 번다.
// 돈으로 신발(빨라짐), 받침대, 새 둥지 마당을 산다. 🦝 너구리 도둑이 내 동물을 훔치러 오면 닿아서 잡는다.
// 친구 방이면 친구 기지의 동물도 훔칠 수 있고(🔒 잠그면 못 훔침), 훔쳐 가는 친구에게 닿으면 돌려받는다.
// 기지마다 주인이 자기 동물을 맡는다. 보내는 것은 모두 숫자.
import { THREE, textSprite } from './render.js';
import { Avatar } from './avatar.js';
import { EGG, EGG_ZONES, CRITTERS, critterOf, hatchCritter, petIncome, baseIncome, bootsPrice, bootsSpeed, pedPrice, sellValue, petSpeed, EGG_TREADS, RUN_MAX, runSpeed, runNeed, trainRun, josa, seeded, displayName, ADJECTIVES, ANIMALS, SKINS, COLORS } from '../core.mjs';
import { EGG_SLOTS, EGG_BASE, EGG_GATE_Z, eggPedestals, eggInBase, eggGateParts } from '../worlds.mjs';

const money = n => `$${Math.floor(n).toLocaleString('ko-KR')}`;
const mats = new Map();
const mat = (c, extra) => { const k = c + (extra ? JSON.stringify(extra) : ''); if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...extra })); return mats.get(k); };
const BOX = new THREE.BoxGeometry(1, 1, 1), BALL = new THREE.SphereGeometry(0.5, 14, 10), CONE = new THREE.ConeGeometry(0.5, 1, 8);
function part(g, geo, c, sx, sy, sz, x, y, z, extra) {
  const m = new THREE.Mesh(geo, mat(c, extra));
  m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true;
  g.add(m);
  return m;
}
const eyes = (g, y, z, gap, s = 0.1) => { for (const k of [-1, 1]) { part(g, BOX, '#1e1f26', s, s * 1.2, 0.04, k * gap, y, z); part(g, BOX, '#ffffff', s * 0.35, s * 0.35, 0.02, k * gap - s * 0.2, y + s * 0.3, z + 0.02); } };

// 동물 모양 (앞 +z, 발 y=0). 황금이면 몸이 금빛
const LOOKS = {
  chick: { kind: 'bird', c: '#ffe14d', beak: '#ff9a2a', s: 0.75 },
  duck: { kind: 'bird', c: '#ffffff', beak: '#ffa31a', s: 0.9, neck: true },
  owl: { kind: 'bird', c: '#8a5a36', belly: '#e8c49a', beak: '#ffcf33', s: 0.95, tufts: true, big: true },
  bunny: { kind: 'quad', c: '#ffffff', ears: 'long', tail: 'puff', nose: '#ff8fa8', s: 0.8 },
  squirrel: { kind: 'quad', c: '#b5651d', ears: 'round', tail: 'big', s: 0.75 },
  fox: { kind: 'quad', c: '#ff8a3d', ears: 'pointy', tail: 'brush', snout: '#ffffff', s: 0.95 },
  dino: { kind: 'quad', c: '#5ad16b', spikes: '#ffd23f', tail: 'long', neck: true, s: 1.05 },
  salamander: { kind: 'quad', c: '#ff4d3a', dots: '#ffd23f', tail: 'flame', low: true, s: 1 },
  turtle: { kind: 'quad', c: '#8aa05a', shell: '#3a2a2a', crack: '#ff7a1a', low: true, s: 1.05 },
  unicorn: { kind: 'quad', c: '#ffffff', horn: '#ffd23f', mane: true, tail: 'mane', s: 1.15 },
  whale: { kind: 'whale', c: '#9fd4ff', belly: '#ffffff', s: 1.2 },
  dragon: { kind: 'quad', c: '#9b5cff', horn: '#ffd23f', wings: true, spikes: '#ff8fc7', tail: 'long', s: 1.25 },
  raccoon: { kind: 'quad', c: '#8a8f99', mask: '#2a2d33', ears: 'round', tail: 'ring', s: 1 },
  goose: { kind: 'bird', c: '#ffffff', beak: '#ff8a1a', s: 1.1, neck: true, helmet: '#ff3b4e' },
  bear: { kind: 'quad', c: '#7a4a2a', ears: 'round', snout: '#c9a07a', s: 1.3, helmet: '#3fa7ff' },
  golem: { kind: 'quad', c: '#3a2e2e', crack: '#ff7a1a', s: 1.35, ears: 'none', helmet: '#ffcf33' },
  thunder: { kind: 'bird', c: '#ffd23f', beak: '#3a3f4b', s: 1.2, wings: '#3f7dff', helmet: '#ffffff' },
};
export function makeCritter(id, gold = false) {
  const L = LOOKS[id] ?? LOOKS.chick;
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const c = gold ? '#ffcf33' : L.c, gx = gold ? { metalness: 0.6, roughness: 0.3, emissive: '#7a5200', emissiveIntensity: 0.35 } : undefined;
  const legs = [], wings = [];
  if (L.kind === 'bird') {
    part(body, BALL, c, 0.8, 0.8, 0.85, 0, 0.55, 0, gx);
    if (L.belly) part(body, BALL, L.belly, 0.55, 0.6, 0.3, 0, 0.5, 0.3);
    const hy = L.neck ? 1.25 : 1.05;
    if (L.neck) part(body, BOX, c, 0.22, 0.5, 0.22, 0, 0.95, 0.22, gx);
    const head = new THREE.Group(); head.position.set(0, hy, L.neck ? 0.26 : 0.12); body.add(head);
    part(head, BALL, c, L.big ? 0.62 : 0.5, L.big ? 0.55 : 0.48, 0.5, 0, 0, 0, gx);
    eyes(head, 0.06, 0.25, L.big ? 0.15 : 0.11, L.big ? 0.14 : 0.08);
    const beak = part(head, CONE, L.beak, 0.16, 0.26, 0.16, 0, -0.04, 0.32); beak.rotation.x = Math.PI / 2;
    if (L.tufts) for (const k of [-1, 1]) { const t = part(head, CONE, c, 0.12, 0.22, 0.12, k * 0.2, 0.3, 0); t.rotation.z = -k * 0.4; }
    if (L.helmet) { part(head, BALL, L.helmet, 0.56, 0.3, 0.56, 0, 0.16, -0.02); part(head, BOX, L.helmet, 0.3, 0.06, 0.18, 0, 0.12, 0.26); }
    for (const k of [-1, 1]) {
      const w = new THREE.Group(); w.position.set(k * 0.4, 0.62, 0); body.add(w);
      part(w, BOX, L.wings ?? c, 0.14, 0.4, 0.55, k * 0.05, -0.05, 0, L.wings ? undefined : gx);
      wings.push(w);
      const leg = new THREE.Group(); leg.position.set(k * 0.16, 0.2, 0.05); body.add(leg);
      part(leg, BOX, '#ff9a2a', 0.08, 0.2, 0.08, 0, -0.1, 0); part(leg, BOX, '#ff9a2a', 0.18, 0.04, 0.22, 0, -0.2, 0.05);
      legs.push(leg);
    }
  } else if (L.kind === 'whale') {
    part(body, BALL, c, 1.1, 0.8, 1.5, 0, 0.6, 0, gx);
    part(body, BALL, L.belly, 0.8, 0.4, 1.2, 0, 0.35, 0.05);
    eyes(body, 0.7, 0.62, 0.3, 0.1);
    const tail = part(body, BOX, c, 0.9, 0.1, 0.35, 0, 0.75, -0.85, gx); tail.rotation.x = -0.4;
    for (const k of [-1, 1]) { const f = part(body, BOX, c, 0.45, 0.06, 0.25, k * 0.55, 0.4, 0.15, gx); f.rotation.z = k * 0.4; wings.push(f); }
    part(body, BALL, '#ffffff', 0.2, 0.2, 0.2, 0, 1.2, 0.3);
    part(body, BALL, '#ffffff', 0.14, 0.14, 0.14, 0.12, 1.38, 0.32);
  } else {
    const low = L.low ? 0.7 : 1;
    const by = 0.55 * low;
    part(body, BOX, c, 0.62, 0.48 * low, 0.95, 0, by, 0, gx);
    if (L.dots) for (const [x, z] of [[-0.18, 0.2], [0.15, -0.15], [0.05, 0.3], [-0.1, -0.3]]) part(body, BOX, L.dots, 0.14, 0.04, 0.14, x, by + 0.25 * low, z);
    if (L.shell) { part(body, BALL, L.shell, 0.95, 0.6, 1.15, 0, by + 0.2, 0); if (L.crack) for (const a of [0, 1.2, 2.4, 3.6, 4.8]) part(body, BOX, L.crack, 0.06, 0.04, 0.4, Math.sin(a) * 0.3, by + 0.48, Math.cos(a) * 0.35); }
    if (L.crack && !L.shell) for (const [x, y, z] of [[0.32, by, 0.1], [-0.32, by + 0.05, -0.2], [0, by + 0.25, 0.3]]) part(body, BOX, L.crack, 0.04, 0.3, 0.06, x, y, z, { emissive: L.crack, emissiveIntensity: 1.2 });
    if (L.spikes) for (let i = 0; i < 4; i++) part(body, CONE, L.spikes, 0.14, 0.22, 0.14, 0, by + 0.32 * low, 0.32 - i * 0.22);
    for (const [x, z] of [[-0.2, 0.32], [0.2, 0.32], [-0.2, -0.32], [0.2, -0.32]]) {
      const leg = new THREE.Group(); leg.position.set(x, 0.36 * low, z); body.add(leg);
      part(leg, BOX, L.shell ? c : c, 0.17, 0.36 * low, 0.17, 0, -0.18 * low, 0, gx);
      legs.push(leg);
    }
    const hy = L.neck ? by + 0.65 : by + 0.35 * low;
    if (L.neck) part(body, BOX, c, 0.28, 0.6, 0.28, 0, by + 0.35, 0.42, gx);
    const head = new THREE.Group(); head.position.set(0, hy, L.neck ? 0.55 : 0.5); body.add(head);
    part(head, BOX, c, 0.56, 0.48, 0.5, 0, 0, 0, gx);
    eyes(head, 0.06, 0.26, 0.14);
    if (L.mask) part(head, BOX, L.mask, 0.58, 0.14, 0.04, 0, 0.06, 0.25);
    if (L.snout) part(head, BOX, L.snout, 0.28, 0.18, 0.2, 0, -0.1, 0.32);
    if (L.nose) part(head, BOX, L.nose, 0.1, 0.07, 0.04, 0, -0.04, 0.27);
    if (L.ears === 'long') for (const k of [-1, 1]) part(head, BOX, c, 0.12, 0.5, 0.08, k * 0.14, 0.45, -0.05, gx);
    if (L.ears === 'pointy') for (const k of [-1, 1]) { const e = part(head, CONE, c, 0.2, 0.28, 0.12, k * 0.18, 0.36, 0, gx); e.rotation.y = Math.PI / 4; }
    if (L.ears === 'round') for (const k of [-1, 1]) part(head, BALL, c, 0.18, 0.18, 0.1, k * 0.22, 0.28, -0.02, gx);
    if (L.horn) { const h = part(head, CONE, L.horn, 0.12, 0.42, 0.12, 0, 0.42, 0.12, { metalness: 0.5, emissive: '#7a5200', emissiveIntensity: 0.3 }); h.rotation.x = 0.3; }
    if (L.mane) ['#ff5e7e', '#ffd23f', '#5ad16b', '#3fa7ff', '#9b5cff'].forEach((mc, i) => part(head, BOX, mc, 0.1, 0.16, 0.12, 0, 0.3 - i * 0.12, -0.28));
    if (L.helmet) { part(head, BOX, L.helmet, 0.62, 0.16, 0.56, 0, 0.3, 0); part(head, BOX, L.helmet, 0.62, 0.05, 0.2, 0, 0.24, 0.32); }
    let tail;
    if (L.tail === 'puff') tail = part(body, BALL, '#ffffff', 0.24, 0.24, 0.24, 0, by + 0.1, -0.52);
    else if (L.tail === 'big') { tail = part(body, BOX, c, 0.3, 0.7, 0.24, 0, by + 0.4, -0.58, gx); tail.rotation.x = -0.25; }
    else if (L.tail === 'brush') { tail = part(body, BOX, c, 0.22, 0.22, 0.6, 0, by + 0.12, -0.72, gx); part(body, BOX, '#ffffff', 0.23, 0.23, 0.16, 0, by + 0.12, -1.0); }
    else if (L.tail === 'long') { tail = part(body, BOX, c, 0.18, 0.16, 0.8, 0, by, -0.82, gx); }
    else if (L.tail === 'flame') { tail = part(body, BOX, c, 0.14, 0.12, 0.6, 0, by, -0.75); part(body, CONE, '#ffcf33', 0.26, 0.4, 0.26, 0, by + 0.18, -1.08, { emissive: '#ff7a1a', emissiveIntensity: 1.4 }); }
    else if (L.tail === 'mane') ['#ff5e7e', '#ffd23f', '#3fa7ff'].forEach((mc, i) => part(body, BOX, mc, 0.1, 0.4, 0.1, (i - 1) * 0.08, by - 0.05, -0.52));
    else if (L.tail === 'ring') { for (let i = 0; i < 4; i++) part(body, BOX, i % 2 ? '#2a2d33' : c, 0.24, 0.24, 0.18, 0, by + 0.1 + i * 0.05, -0.56 - i * 0.17); }
    if (L.wings) for (const k of [-1, 1]) {
      const w = new THREE.Group(); w.position.set(k * 0.3, by + 0.25, 0); body.add(w);
      ['#ff8fc7', '#ffd23f', '#7df9ff'].forEach((wc, i) => part(w, BOX, wc, 0.7, 0.05, 0.22, k * 0.4, 0.05, 0.18 - i * 0.2));
      wings.push(w);
    }
    void tail;
  }
  body.scale.setScalar(L.s);
  g.userData = { legs, wings, body, fly: L.kind === 'whale' || id === 'dragon' };
  if (gold) {
    const sp = textSprite('✨', { bg: 'rgba(0,0,0,0)', size: 40, scale: 0.012 });
    sp.position.y = 1.7 * L.s; g.add(sp);
  }
  return g;
}
function animateCritter(m, t, moving) {
  const { legs, wings, body, fly } = m.userData;
  legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(t * 12 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.7 : 0; });
  wings.forEach((w, i) => { w.rotation.z = Math.sin(t * (fly ? 6 : 4)) * (fly ? 0.5 : 0.25) * (i ? -1 : 1); });
  body.position.y = fly ? 0.6 + Math.sin(t * 2) * 0.15 : moving ? Math.abs(Math.sin(t * 12)) * 0.12 : Math.sin(t * 2.2) * 0.03;
}
export function makeEgg(zone) {
  const Z = EGG_ZONES[zone] ?? EGG_ZONES[0];
  const g = new THREE.Group();
  part(g, BALL, Z.eggColor, 0.7, 0.9, 0.7, 0, 0.45, 0, zone === 3 ? { emissive: '#8a6aff', emissiveIntensity: 0.3 } : undefined);
  for (const [x, y, z] of [[0.24, 0.55, 0.2], [-0.2, 0.35, 0.24], [0.05, 0.7, -0.28], [-0.27, 0.6, -0.05]]) part(g, BALL, Z.spot, 0.14, 0.14, 0.08, x, y, z);
  return g;
}
function disposeObj(o) { o?.traverse(c => { if (c.isSprite) { c.material.map?.dispose(); c.material.dispose(); } }); o?.removeFromParent(); }

export class EggHunt {
  constructor(game) {
    this.game = game;
    this.def = game.world.def;
    this.group = new THREE.Group();
    game.world.group.add(this.group);
    this.t = 0;
    this.carry = null;          // { kind: 'egg', zone } · { kind: 'pet', p, owner, i }
    this.carryMesh = null;
    this.gates = new Map();
    this.lockT = 0; this.lockCool = 0;
    this.saveT = 0; this.sendT = 0; this.hitCool = 0; this.toastT = 0; this.grabCool = 0;
    this.others = new Map();    // 친구 기지: slot → { id, pets, lock, meshes }
    this.pending = new Map();   // 내 동물을 훔쳐 가는 중: thief id → { i, p, t }
    this.raccoon = null;
    this.raccoonT = 50 + Math.random() * 30;
    this.makeGates();
    this.makeNests();
    this.makeGuards();
    this.makeLaser();
    this.myPeds = eggPedestals(this.slot).map(p => ({ ...p, mesh: null, label: null, key: '' }));
    this.makeHud();
    this.makeBots();
    this.dirty = true;
    this.sendBase(true);
  }
  get e() { return this.game.save.egg; }
  get net() { return this.game.net; }
  get slot() { return this.net.active ? this.net.slot : 0; }
  get myId() { return this.net.active ? this.net.id : 'me'; }
  // 달리기 빠르기: 알이나 동물을 들면 무거워서 펫 힘은 못 쓴다
  // 러닝머신에서 저절로 달리는 중 (main.js 가 달리는 몸짓과 앞을 보게 한다)
  get treadRun() { return !!(this.onTread && this.running); }
  get speed() { const b = bootsSpeed(this.e.boots) * runSpeed(this.e.run); return this.carry ? b * EGG.CARRY : b * petSpeed(this.game.save.pet); }

  // ───── 울타리 문 ─────
  makeGates() {
    for (let z = 1; z < EGG_ZONES.length; z++) if (this.e.zones <= z) this.gates.set(z, this.game.makeParts(eggGateParts(z)));
  }
  tryGate(px, pz) {
    for (const [z, h] of this.gates) {
      if (Math.abs(pz - EGG_GATE_Z[z]) > 1.6 || Math.abs(px) > 4.6) continue;
      if (z !== this.e.zones) { this.say(`🔒 먼저 ${EGG_ZONES[this.e.zones].name}부터 열어!`); return; }
      const price = EGG_ZONES[z].price;
      if (this.e.cash < price) { this.say(`🔒 ${EGG_ZONES[z].name}: ${money(price - this.e.cash)} 더 모아 와!`); return; }
      this.e.cash -= price;
      this.e.zones = z + 1;
      this.game.removeParts(h);
      this.gates.delete(z);
      this.game.sfx('buy');
      this.game.effects.confetti(0, 4, EGG_GATE_Z[z], 160);
      this.game.ui.big(`${EGG_ZONES[z].icon} ${EGG_ZONES[z].name} 열었다! ${EGG_ZONES[z].egg}을 훔쳐 봐`, 2600, 'gold');
      this.game.persist();
      return;
    }
  }
  say(text) { if (this.toastT > 0) return; this.toastT = 2.2; this.game.ui.toast(text); this.game.sfx('nope'); }

  // ───── 둥지와 알 ─────
  makeNests() {
    this.eggs = [];
    for (const n of this.def.nests) {
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + n.x * 0.1;
        const x = n.x + Math.cos(a) * 1.3, z = n.z + Math.sin(a) * 1.3;
        const mesh = makeEgg(n.zone);
        mesh.position.set(x, 0.5, z);
        this.group.add(mesh);
        this.eggs.push({ zone: n.zone, x, z, mesh, taken: false, t: 0, nest: n });
      }
    }
  }
  makeGuards() {
    this.guards = [];
    for (const n of this.def.nests) {
      const Z = EGG_ZONES[n.zone];
      for (let k = 0; k < Z.guards; k++) {
        const mesh = new THREE.Group(), body = makeCritter(Z.guard);
        body.scale.setScalar(1.6); mesh.add(body);
        const tag = textSprite(`🛡️ ${Z.guardName}`, { size: 34, scale: 0.012 });
        tag.position.y = 3.6; mesh.add(tag);
        const alert = textSprite('❗', { bg: 'rgba(255,59,78,0.9)', size: 44, scale: 0.014 });
        alert.position.y = 4.5; alert.visible = false; mesh.add(alert);
        this.group.add(mesh);
        const a = k * Math.PI;
        this.guards.push({ mesh, body, alert, zone: n.zone, home: n, a, x: n.x + Math.cos(a) * 6, z: n.z + Math.sin(a) * 6, yaw: 0, mode: 'patrol', speed: Z.guardSpeed, t: Math.random() * 9 });
      }
    }
  }
  makeLaser() {
    const b = EGG_SLOTS[this.slot], z = b.z - EGG_BASE.d / 2;
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(EGG_BASE.door, 0.12, 0.12), new THREE.MeshStandardMaterial({ color: '#ff3b4e', emissive: '#ff3b4e', emissiveIntensity: 2 }));
      m.position.set(b.x, 0.6 + i * 0.9, z); g.add(m);
    }
    g.visible = false;
    this.group.add(g);
    this.laser = g;
    this.otherLasers = new Map();
  }
  laserFor(slot) {
    if (!this.otherLasers.has(slot)) {
      const b = EGG_SLOTS[slot], z = b.z - EGG_BASE.d / 2, g = new THREE.Group();
      for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(EGG_BASE.door, 0.12, 0.12), new THREE.MeshStandardMaterial({ color: '#ff3b4e', emissive: '#ff3b4e', emissiveIntensity: 2 })); m.position.set(b.x, 0.6 + i * 0.9, z); g.add(m); }
      this.group.add(g);
      this.otherLasers.set(slot, g);
    }
    return this.otherLasers.get(slot);
  }

  // ───── 화면 ─────
  makeHud() {
    const bar = document.createElement('div');
    bar.id = 'egg-bar';
    bar.innerHTML = '<button data-a="boots"><kbd>1</kbd><span></span></button><button data-a="ped"><kbd>2</kbd><span></span></button><button data-a="lock"><kbd>3</kbd><span></span></button>';
    bar.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) this.act(b.dataset.a); });
    document.body.append(bar);
    document.body.classList.add('eggw');
    this.bar = bar;
    this.syncBar();
  }
  syncBar() {
    const e = this.e, set = (a, txt, can) => { const b = this.bar.querySelector(`[data-a="${a}"]`); b.querySelector('span').textContent = txt; b.classList.toggle('poor', !can); };
    set('boots', e.boots >= EGG.BOOTS_MAX ? `👟 신발 Lv${e.boots} 최고!` : `👟 신발 Lv${e.boots + 1} · ${money(bootsPrice(e.boots))}`, e.boots < EGG.BOOTS_MAX && e.cash >= bootsPrice(e.boots));
    set('ped', e.ped >= EGG.PED_MAX ? `🪺 받침대 ${e.ped}개 최고!` : `🪺 받침대 ${e.ped + 1}개 · ${money(pedPrice(e.ped))}`, e.ped < EGG.PED_MAX && e.cash >= pedPrice(e.ped));
    set('lock', this.lockT > 0 ? `🔒 잠김 ${Math.ceil(this.lockT)}초` : this.lockCool > 0 ? `🔓 ${Math.ceil(this.lockCool)}초 뒤 잠그기` : '🔒 기지 잠그기 30초', this.lockT <= 0 && this.lockCool <= 0);
  }
  key(code) {
    const a = { Digit1: 'boots', Digit2: 'ped', Digit3: 'lock' }[code];
    if (!a) return false;
    this.act(a);
    return true;
  }
  act(a) {
    const g = this.game, e = this.e;
    if (a === 'boots') {
      if (e.boots >= EGG.BOOTS_MAX) return;
      const p = bootsPrice(e.boots);
      if (e.cash < p) { this.say(`👟 ${money(p - e.cash)} 더 있어야 해`); return; }
      e.cash -= p; e.boots++; g.sfx('buy'); g.ui.toast(`👟 신발 Lv${e.boots}! ${bootsSpeed(e.boots).toFixed(1)}배 빨라졌어`);
    } else if (a === 'ped') {
      if (e.ped >= EGG.PED_MAX) return;
      const p = pedPrice(e.ped);
      if (e.cash < p) { this.say(`🪺 ${money(p - e.cash)} 더 있어야 해`); return; }
      e.cash -= p; e.ped++; g.sfx('buy'); g.ui.toast(`🪺 받침대가 ${e.ped}개!`); this.dirty = true;
    } else if (a === 'lock') {
      if (this.lockT > 0 || this.lockCool > 0) { g.sfx('nope'); return; }
      this.lockT = EGG.LOCK; g.sfx('check'); g.ui.toast('🔒 30초 동안 아무도 내 동물을 못 훔쳐!');
      this.sendBase(true);
    }
    g.persist();
    this.syncBar();
  }

  // ───── 내 기지 ─────
  pets() { const e = this.e; while (e.pets.length < e.ped) e.pets.push(null); return e.pets; }
  freeSlot() { return this.pets().findIndex((p, i) => !p && i < this.e.ped); }
  place(p, quiet) {
    const pets = this.pets();
    let i = this.freeSlot();
    if (i < 0) {
      // 자리가 없으면 가장 못 버는 다 큰 동물과 바꾸고(판다), 새 것이 더 못하면 새 것을 판다
      let low = -1, lv = Infinity;
      pets.forEach((q, k) => { if (q && q.t <= 0 && petIncome(q) < lv) { lv = petIncome(q); low = k; } });
      const nv = petIncome({ ...p, t: 0 });
      if (low < 0 || nv <= lv) {
        this.e.cash += sellValue({ ...p, t: 0 });
        if (!quiet) this.game.ui.toast(`🪺 받침대가 꽉 찼어! ${p.t > 0 ? `${critterOf(p.c).name} 알을` : josa(critterOf(p.c).name, '을', '를')} ${money(sellValue({ ...p, t: 0 }))}에 팔았어 · 받침대를 늘려 봐`, 3200);
        return -1;
      }
      const old = pets[low];
      this.e.cash += sellValue(old);
      if (!quiet) this.game.ui.toast(`${critterOf(old.c).icon} ${josa(critterOf(old.c).name, '을', '를')} ${money(sellValue(old))}에 팔고 그 자리에 놓았어`, 2800);
      i = low;
    }
    pets[i] = p;
    this.dirty = true;
    this.sendBase(true);
    return i;
  }
  deliverEgg(zone) {
    const g = this.game;
    const r = hatchCritter(zone);
    const c = critterOf(r.c);
    const i = this.place({ c: r.c, gold: r.gold, t: c.hatch });
    g.addCoins(1);
    g.sfx('coin');
    if (i >= 0) g.ui.toast(`🥚 ${EGG_ZONES[zone].egg}을 놓았어! ${c.hatch}초 뒤에 부화해`, 2200);
    g.persist();
  }
  hatched(p) {
    const g = this.game, c = critterOf(p.c);
    this.e.hatched++;
    const rare = c.chance <= 0.1;
    if (rare || p.gold) g.addCoins(5);
    g.sfx(rare || p.gold ? 'win' : 'check');
    g.ui.big(`${p.gold ? '✨ 황금 ' : ''}${c.icon} ${c.name} 태어났어! ${money(petIncome(p))}/초`, 2200, rare || p.gold ? 'gold' : '');
    this.sendBase(true);
  }
  drawPeds() {
    const pets = this.pets();
    this.myPeds.forEach((ped, i) => {
      const p = i < this.e.ped ? pets[i] : null;
      const locked = i >= this.e.ped;
      const key = locked ? 'lock' : !p ? 'empty' : `${p.c}|${p.gold ? 1 : 0}|${p.t > 0 ? 'egg' : 'pet'}`;
      if (ped.key !== key) {
        disposeObj(ped.mesh); ped.mesh = null;
        if (key === 'lock') { ped.mesh = textSprite('🔒', { bg: 'rgba(20,22,30,0.5)', size: 36, scale: 0.012 }); ped.mesh.position.set(ped.x, 0.9, ped.z); }
        else if (p) { ped.mesh = p.t > 0 ? makeEgg(critterOf(p.c).zone) : makeCritter(p.c, p.gold); ped.mesh.position.set(ped.x, ped.y, ped.z); ped.mesh.rotation.y = Math.PI; }
        if (ped.mesh) this.group.add(ped.mesh);
        disposeObj(ped.label); ped.label = null;
        if (p) { ped.label = textSprite('', { size: 34, scale: 0.012 }); ped.label.position.set(ped.x, 2.9, ped.z); this.group.add(ped.label); ped.lt = ''; }
        ped.key = key;
      }
      if (ped.label && p) {
        const txt = p.t > 0 ? `⏳ ${Math.ceil(p.t)}초` : `${money(petIncome(p))}/초`;
        if (ped.lt !== txt) { ped.label.userData.set(txt, '', p.t > 0 ? { bg: 'rgba(80,60,160,0.85)' } : { bg: 'rgba(30,140,70,0.85)' }); ped.lt = txt; }
      }
      if (ped.mesh && p) {
        if (p.t > 0) { ped.mesh.rotation.z = Math.sin(this.t * (p.t < 3 ? 18 : 6)) * (p.t < 3 ? 0.18 : 0.06); }
        else animateCritter(ped.mesh, this.t + i, false);
      }
    });
  }

  // ───── 친구 기지 ─────
  sendBase(force) {
    if (!this.net.live) return;
    if (!force && this.sendT > 0) return;
    this.sendT = 4;
    const p = this.pets().map(q => (q ? [CRITTERS.findIndex(c => c.id === q.c), q.gold ? 1 : 0, q.t > 0 ? 1 : 0] : [-1, 0, 0]));
    this.net.send({ t: 'eg', k: 'base', p, lk: this.lockT > 0 ? Math.ceil(this.lockT) : 0, n: this.e.ped });
  }
  sendCarry() {
    const c = !this.carry ? -1 : this.carry.kind === 'egg' ? this.carry.zone : 100 + CRITTERS.findIndex(x => x.id === this.carry.p.c);
    this.net.send({ t: 'eg', k: 'carry', c });
  }
  otherBase(slot, id) {
    if (!this.others.has(slot)) this.others.set(slot, { id, pets: [], lock: 0, peds: eggPedestals(slot).map(p => ({ ...p, mesh: null, key: '' })) });
    const o = this.others.get(slot); o.id = id;
    return o;
  }
  drawOthers() {
    for (const [slot, o] of this.others) {
      const r = this.game.remotes.get(o.id);
      const here = r && r.w === 7;
      o.peds.forEach((ped, i) => {
        const p = here ? o.pets[i] : null;
        const key = !p ? '' : `${p.c}|${p.gold}|${p.egg}`;
        if (ped.key !== key) {
          disposeObj(ped.mesh); ped.mesh = null;
          if (p) { ped.mesh = p.egg ? makeEgg(critterOf(p.c)?.zone ?? 0) : makeCritter(p.c, p.gold); ped.mesh.position.set(ped.x, ped.y, ped.z); ped.mesh.rotation.y = Math.PI; this.group.add(ped.mesh); }
          ped.key = key;
        }
        if (ped.mesh && !p?.egg) animateCritter(ped.mesh, this.t + i + slot, false);
      });
      this.laserFor(slot).visible = here && o.lock > 0;
      if (o.lock > 0) o.lock -= 1 / 60;
      // 친구가 들고 있는 것
      if (r) {
        const want = here ? (r.egCarry ?? -1) : -1;
        if (o.carryKey !== want) { disposeObj(o.carryMesh); o.carryMesh = null; if (want >= 0) { o.carryMesh = want >= 100 ? makeCritter(CRITTERS[want - 100]?.id ?? 'chick') : makeEgg(want); this.group.add(o.carryMesh); } o.carryKey = want; }
        if (o.carryMesh) o.carryMesh.position.set(r.x, r.y + 3.1, r.z);
      }
    }
  }
  message(d, from) {
    const g = this.game;
    if (d.k === 'base' && Array.isArray(d.p)) {
      const o = this.otherBase(g.slotOf(from), from);
      o.pets = d.p.slice(0, EGG.PED_MAX).map(q => (Array.isArray(q) && CRITTERS[q[0]] ? { c: CRITTERS[q[0]].id, gold: !!q[1], egg: !!q[2] } : null));
      o.lock = Math.max(0, Math.min(EGG.LOCK, d.lk | 0));
    } else if (d.k === 'carry') {
      const r = g.remotes.get(from);
      if (r) r.egCarry = Number.isInteger(d.c) ? d.c : -1;
    } else if (d.k === 'grab' && Number.isInteger(d.i)) {
      // 누가 내 동물을 집었다 (내가 맡는다)
      const p = this.pets()[d.i];
      if (!p || p.t > 0 || this.lockT > 0 || this.pending.has(from)) { this.net.sendTo(from, { t: 'eg', k: 'nope', lk: this.lockT > 0 ? 1 : 0 }); return; }
      this.pets()[d.i] = null;
      this.pending.set(from, { i: d.i, p, t: 0 });
      this.dirty = true;
      this.net.sendTo(from, { t: 'eg', k: 'took', i: d.i, c: CRITTERS.findIndex(c => c.id === p.c), g: p.gold ? 1 : 0 });
      this.sendBase(true);
      const name = g.remotes.get(from)?.name ?? '친구';
      g.sfx('hurt');
      g.ui.big(`🚨 ${name} 님이 ${critterOf(p.c).icon} ${josa(critterOf(p.c).name, '을', '를')} 훔쳐 가! 닿으면 돌려받아`, 2600);
    } else if (d.k === 'took' && Number.isInteger(d.c) && CRITTERS[d.c]) {
      if (this.carry) return;
      this.carry = { kind: 'pet', p: { c: CRITTERS[d.c].id, gold: !!d.g, t: 0 }, owner: from, i: d.i };
      this.carryChanged();
      g.sfx('coin');
      g.ui.toast(`${CRITTERS[d.c].icon} 훔쳤다! 내 기지까지 달려! 친구가 닿으면 돌려줘야 해`, 2600);
    } else if (d.k === 'nope') {
      this.say(d.lk ? '🔒 이 기지는 잠겨 있어!' : '지금은 못 가져가');
    } else if (d.k === 'catch') {
      if (this.carry?.kind === 'pet' && this.carry.owner === from) {
        this.carry = null; this.carryChanged();
        this.grabCool = 4;
        g.sfx('hurt'); g.ui.big('😵 들켰다! 동물을 돌려줬어', 1800);
      }
    } else if (d.k === 'stolen') {
      const s = this.pending.get(from);
      if (s) { this.pending.delete(from); g.ui.toast(`😭 ${josa(critterOf(s.p.c).name, '을', '를')} 빼앗겼어… 기지를 🔒 잠가 봐`, 3000); }
    }
  }
  // 친구가 나가면 못 가져간 내 동물은 돌아온다
  returnPending(id) {
    const s = this.pending.get(id);
    if (!s) return;
    this.pending.delete(id);
    if (!this.pets()[s.i]) this.pets()[s.i] = s.p; else this.place(s.p, true);
    this.dirty = true;
    this.sendBase(true);
  }

  carryChanged() {
    disposeObj(this.carryMesh); this.carryMesh = null;
    if (this.carry) { this.carryMesh = this.carry.kind === 'egg' ? makeEgg(this.carry.zone) : makeCritter(this.carry.p.c, this.carry.p.gold); this.group.add(this.carryMesh); }
    this.sendCarry();
  }

  // ───── 너구리 도둑 ─────
  spawnRaccoon() {
    const b = EGG_SLOTS[this.slot], side = Math.random() < 0.5 ? -1 : 1;
    const mesh = new THREE.Group(), body = makeCritter('raccoon');
    body.scale.setScalar(1.3); mesh.add(body);
    const tag = textSprite('🦝 너구리 도둑', { bg: 'rgba(60,60,70,0.85)', size: 34, scale: 0.012 });
    tag.position.y = 2.4; mesh.add(tag);
    this.group.add(mesh);
    const doorZ = b.z - EGG_BASE.d / 2;
    this.raccoon = { mesh, body, x: side * 98, z: doorZ - 6, yaw: 0, path: [[b.x, doorZ - 6], [b.x, doorZ - 1.5]], mode: 'in', wait: 0, carry: null, cm: null, side };
    this.game.sfx('hurt');
    this.game.ui.big('🦝 너구리 도둑이 내 동물을 훔치러 와! 닿아서 잡아', 2600);
  }
  updateRaccoon(dt) {
    const rc = this.raccoon, me = this.game.player;
    if (!rc) return;
    const sp = 6.6;
    const go = (x, z) => { const dx = x - rc.x, dz = z - rc.z, d = Math.hypot(dx, dz); if (d > 0.05) { const s = Math.min(d, sp * dt); rc.x += (dx / d) * s; rc.z += (dz / d) * s; rc.yaw = Math.atan2(dx, dz); } return d; };
    if (rc.mode === 'in') {
      const [x, z] = rc.path[0];
      if (rc.path.length === 1 && this.lockT > 0) { rc.wait += dt; if (rc.wait > 4) { rc.mode = 'out'; this.game.ui.toast('🔒 잠겨 있어서 너구리가 그냥 돌아갔어!'); } }
      else if (go(x, z) < 0.3) {
        rc.path.shift();
        if (!rc.path.length) {
          // 가장 많이 버는 다 큰 동물을 집는다
          const pets = this.pets();
          let best = -1, bv = -1;
          pets.forEach((p, i) => { if (p && p.t <= 0 && i < this.e.ped && petIncome(p) > bv) { bv = petIncome(p); best = i; } });
          if (best < 0) rc.mode = 'out';
          else { rc.target = best; rc.path = [[this.myPeds[best].x, this.myPeds[best].z - 1.2]]; rc.mode = 'grab'; }
        }
      }
    } else if (rc.mode === 'grab') {
      const [x, z] = rc.path[0];
      if (go(x, z) < 0.4) {
        const p = this.pets()[rc.target];
        if (p && p.t <= 0) { this.pets()[rc.target] = null; rc.carry = { p, i: rc.target }; rc.cm = makeCritter(p.c, p.gold); this.group.add(rc.cm); this.dirty = true; this.sendBase(true); this.game.ui.toast(`🦝 너구리가 ${josa(critterOf(p.c).name, '을', '를')} 들고 도망가! 쫓아가!`, 2400); this.game.sfx('hurt'); }
        rc.mode = 'out';
        const b = EGG_SLOTS[this.slot];
        rc.path = [[b.x, b.z - EGG_BASE.d / 2 - 1.5], [b.x, b.z - EGG_BASE.d / 2 - 6], [rc.side * 99, b.z - EGG_BASE.d / 2 - 6]];
      }
    } else {
      if (!rc.path?.length) { const b = EGG_SLOTS[this.slot]; rc.path = [[rc.side * 99, b.z - EGG_BASE.d / 2 - 6]]; }
      const [x, z] = rc.path[0];
      if (go(x, z) < 0.4) {
        rc.path.shift();
        if (!rc.path.length) {
          if (rc.carry) this.game.ui.toast(`😭 너구리가 ${josa(critterOf(rc.carry.p.c).name, '을', '를')} 데려갔어… 다음엔 🔒 잠가 봐`, 3000);
          this.removeRaccoon();
          return;
        }
      }
    }
    // 잡기
    if (Math.hypot(me.x - rc.x, me.z - rc.z) < 1.9 && me.y < 3) {
      if (rc.carry) {
        const pets = this.pets();
        if (!pets[rc.carry.i]) pets[rc.carry.i] = rc.carry.p; else this.place(rc.carry.p, true);
        this.dirty = true; this.sendBase(true);
      }
      this.e.saved++;
      this.game.addCoins(3);
      this.game.sfx('win');
      this.game.effects.burst(rc.x, 1.5, rc.z, ['#8a8f99', '#ffffff', '#ffd23f'], 22, 6);
      this.game.ui.big(rc.carry ? '🦝 잡았다! 동물을 되찾았어 · 🪙+3' : '🦝 너구리를 쫓아냈어! 🪙+3', 2200, 'gold');
      this.removeRaccoon();
      this.game.persist();
      return;
    }
    rc.mesh.position.set(rc.x, 0.05, rc.z); rc.mesh.rotation.y = rc.yaw;
    animateCritter(rc.body, this.t * 1.3, true);
    if (rc.cm) rc.cm.position.set(rc.x, 1.6, rc.z);
  }
  removeRaccoon() {
    const rc = this.raccoon;
    if (!rc) return;
    disposeObj(rc.mesh); disposeObj(rc.cm);
    this.raccoon = null;
    this.raccoonT = 70 + Math.random() * 50;
  }

  // ───── 매 프레임 ─────
  update(dt) {
    const g = this.game, e = this.e, me = g.player;
    this.t += dt;
    this.toastT -= dt; this.hitCool -= dt; this.sendT -= dt; this.grabCool -= dt; this.pickCool = (this.pickCool ?? 0) - dt;
    // 부화와 돈
    for (const p of this.pets()) if (p && p.t > 0) { p.t -= dt; if (p.t <= 0) { p.t = 0; this.dirty = true; this.hatched(p); } }
    e.cash += baseIncome(this.pets()) * dt;
    this.saveT -= dt;
    if (this.saveT <= 0) { this.saveT = 5; g.persist(); }
    // 잠금
    if (this.lockT > 0) { this.lockT -= dt; if (this.lockT <= 0) { this.lockCool = EGG.LOCK_COOL; this.sendBase(true); } }
    else if (this.lockCool > 0) this.lockCool -= dt;
    this.laser.visible = this.lockT > 0;
    // 알 줍기
    for (const egg of this.eggs) {
      if (egg.taken) { egg.t -= dt; if (egg.t <= 0) { egg.taken = false; egg.mesh.visible = true; } continue; }
      egg.mesh.position.y = 0.5 + Math.sin(this.t * 2 + egg.x) * 0.05;
      egg.mesh.rotation.y += dt * 0.6;
      if (!this.carry && this.pickCool <= 0 && me.y < 3 && Math.hypot(me.x - egg.x, me.z - egg.z) < 1.5) {
        egg.taken = true; egg.t = EGG.RESPAWN; egg.mesh.visible = false;
        this.carry = { kind: 'egg', zone: egg.zone, egg };
        this.carryChanged();
        g.sfx('pop');
        g.ui.toast(`🥚 ${EGG_ZONES[egg.zone].egg} 훔쳤다! 내 기지까지 달려!`, 1800);
      }
    }
    // 친구 기지에서 훔치기
    if (!this.carry && this.net.live && this.grabCool <= 0) {
      for (const [slot, o] of this.others) {
        if (slot === this.slot || o.lock > 0) continue;
        const r = g.remotes.get(o.id);
        if (!r || r.w !== 7) continue;
        const i = o.peds.findIndex((ped, k) => o.pets[k] && !o.pets[k].egg && Math.hypot(me.x - ped.x, me.z - ped.z) < 1.5);
        if (i >= 0) { this.grabCool = 1.5; this.net.sendTo(o.id, { t: 'eg', k: 'grab', i }); break; }
      }
      if (this.grabCool <= 0) for (const o of this.others.values()) if (o.lock > 0 && o.peds.some((ped, k) => o.pets[k] && Math.hypot(me.x - ped.x, me.z - ped.z) < 1.5)) { this.say('🔒 이 기지는 잠겨 있어!'); this.grabCool = 1.5; }
    }
    // 내 동물을 들고 가는 친구에게 닿으면 돌려받기
    for (const [id, s] of this.pending) {
      s.t += dt;
      const r = g.remotes.get(id);
      if (!r || r.w !== 7 || s.t > 90) { this.returnPending(id); continue; }
      if (Math.hypot(me.x - r.x, me.z - r.z) < 2 && Math.abs(me.y - r.y) < 2.5) {
        this.net.sendTo(id, { t: 'eg', k: 'catch' });
        this.returnPending(id);
        g.sfx('win');
        g.ui.big(`✋ 잡았다! ${critterOf(s.p.c).name} 되찾았어`, 1800, 'gold');
      }
    }
    // 내 기지에 내려놓기
    if (this.carry && eggInBase(this.slot, me.x, me.z)) {
      const c = this.carry;
      this.carry = null;
      if (c.kind === 'egg') this.deliverEgg(c.zone);
      else {
        this.place({ ...c.p, t: 0 });
        this.e.stolen++;
        g.addCoins(2);
        if (c.owner) this.net.sendTo(c.owner, { t: 'eg', k: 'stolen' });
        if (c.bot) c.bot.avatar.say(['으앙 내 동물! 😭', '다음엔 안 뺏겨!', '돌려줘~'][Math.floor(Math.random() * 3)]);
        g.sfx('win');
        g.ui.big(`😎 ${critterOf(c.p.c).name} 훔치기 성공!`, 1800, 'gold');
        g.persist();
      }
      this.carryChanged();
    }
    // 러닝머신
    this.treadmill(dt);
    // 울타리 문
    this.tryGate(me.x, me.z);
    // AI 도둑
    this.updateBots(dt);
    // 경비
    this.updateGuards(dt);
    // 너구리
    const grown = this.pets().filter(p => p && p.t <= 0).length;
    if (!this.raccoon && grown >= 2) { this.raccoonT -= dt; if (this.raccoonT <= 0) this.spawnRaccoon(); }
    this.updateRaccoon(dt);
    // 들고 있는 것 (머리 위)
    if (this.carryMesh) {
      this.carryMesh.position.set(me.x, (g.myAvatar.visualY ?? me.y) + 3.1, me.z);
      this.carryMesh.rotation.y = me.yaw;
    }
    if (this.dirty) { this.dirty = false; this.syncBar(); }
    this.drawPeds();
    this.drawOthers();
    this.sendBase(false);
    this.barT = (this.barT ?? 0) - dt;
    if (this.barT <= 0) { this.barT = 0.5; this.syncBar(); }
    this.updateInfo();
  }
  // 러닝머신 위에서 앞으로 달리면 달리기 힘이 쌓인다 (안 산 러닝머신은 올라서면 산다)
  treadmill(dt) {
    const g = this.game, e = this.e, me = g.player, box = me.ground, k = box?.part?.tread;
    this.onTread = k !== undefined;
    this.running = false;
    if (!this.onTread) return;
    // 벨트는 나를 절대 안 움직인다 (2026-11-22 인혁: "아직 끌려가는데"). 올라가서 가만히 서 있으면 저절로 제자리 달리기.
    const T = EGG_TREADS[k];
    if (k >= e.tread) {
      if (k > e.tread) { this.say(`${T.icon} 먼저 ${EGG_TREADS[e.tread].name}부터 사!`); return; }
      if (e.cash < T.price) { this.say(`${T.icon} ${T.name}: ${money(T.price - e.cash)} 더 모아 와!`); return; }
      e.cash -= T.price; e.tread = k + 1;
      g.sfx('buy'); g.ui.big(`${T.icon} ${T.name} 샀다! ${T.mult}배로 빨리 늘어`, 2200, 'gold');
      g.persist();
    }
    this.running = Math.hypot(me.vx, me.vz) < 1.2 && !this.carry && !g.isDead();
    if (!this.running || e.run >= RUN_MAX) return;
    const r = trainRun(e.run, e.xp, dt * T.mult);
    e.run = r.run; e.xp = r.xp;
    if (r.up) {
      g.sfx('check');
      g.effects.burst(g.player.x, g.player.y + 2, g.player.z, ['#7df9ff', '#ffffff', T.color], 16, 5);
      g.ui.big(`🏃 달리기 Lv${e.run}! 지금 ${Math.round((runSpeed(e.run) - 1) * 100)}% 더 빨라`, 1800, 'gold');
      g.persist();
    }
  }
  // ───── AI 도둑 (2026-11-22 인혁: "근데 왜 ai가 없어") ─────
  // 혼자 할 때 빈 기지 5곳에 AI 도둑이 산다. AI도 경비를 피해 알을 훔쳐 자기 기지에서 키우고 돈을 번다.
  // 가끔 내 기지에 동물을 훔치러 오고(닿으면 되찾음), 내가 AI 기지에서 훔치면 쫓아온다. 친구 방에서는 친구가 상대라 AI가 없다.
  makeBots() {
    this.bots = [];
    if (this.net.active) return;
    const rnd = seeded(Date.now() % 1e9);
    EGG_SLOTS.forEach((b, slot) => {
      if (slot === this.slot) return;
      const look = { skin: Math.floor(rnd() * SKINS.length), shirt: Math.floor(rnd() * COLORS.length), pants: Math.floor(rnd() * COLORS.length), hat: Math.floor(rnd() * 8), face: Math.floor(rnd() * 6), emblem: Math.floor(rnd() * 6), hair: Math.floor(rnd() * 12), hairColor: Math.floor(rnd() * 10) };
      const short = displayName([Math.floor(rnd() * ADJECTIVES.length), Math.floor(rnd() * ANIMALS.length)]);
      const avatar = new Avatar(look, `🤖 ${short}`);
      this.group.add(avatar.root);
      const start = Math.floor(rnd() * 3);
      const pets = [];
      for (let i = 0; i < 1 + start; i++) { const h = hatchCritter(0, rnd(), rnd()); pets.push({ c: h.c, gold: h.gold, t: 0 }); }
      this.bots.push({
        slot, avatar, short, x: b.x, z: b.z, yaw: Math.PI, pets, ped: EGG.PED0, cash: rnd() * 150, zones: 1, boots: rnd() * 0.15,
        state: 'idle', path: [], think: 1 + rnd() * 5, carry: null, cm: null, stun: 0, lockT: 0, lockCool: 20 + rnd() * 40,
        raidT: 70 + rnd() * 80, rnd: seeded(Math.floor(rnd() * 1e9)), peds: eggPedestals(slot).map(p => ({ ...p, mesh: null, key: '' })), saidT: 0,
      });
    });
  }
  botSpeed(b) { return 8.5 * (1 + b.boots) * (b.carry ? EGG.CARRY : 1); }
  // 울타리 문을 지나서 가는 길 (문은 x=0 근처)
  route(b, fromZone, toZone, tx, tz) {
    const off = (b.rnd() - 0.5) * 4, out = [];
    if (toZone > fromZone) for (let z = fromZone + 1; z <= toZone; z++) out.push([off, EGG_GATE_Z[z] + 3], [off, EGG_GATE_Z[z] - 3]);
    else for (let z = fromZone; z > toZone; z--) out.push([off, EGG_GATE_Z[z] - 3], [off, EGG_GATE_Z[z] + 3]);
    out.push([tx, tz]);
    return out;
  }
  zoneAt(z) { let k = 0; for (let i = 1; i < EGG_GATE_Z.length; i++) if (z < EGG_GATE_Z[i]) k = i; return k; }
  botHome(b) {
    const base = EGG_SLOTS[b.slot], door = base.z - EGG_BASE.d / 2;
    const zone = this.zoneAt(b.z);
    return [...this.route(b, zone, 0, base.x, door - 3), [base.x, door + 1.5], [base.x, base.z]];
  }
  botPlan(b) {
    const r = b.rnd();
    // 내 기지 털기 (다 큰 동물이 있고 잠기지 않았을 때)
    if (b.raidT <= 0 && this.pets().some(p => p && p.t <= 0)) {
      b.raidT = 80 + b.rnd() * 90;
      const base = EGG_SLOTS[this.slot], door = base.z - EGG_BASE.d / 2;
      b.state = 'raid';
      b.path = [...this.route(b, this.zoneAt(b.z), 0, base.x + (b.rnd() - 0.5) * 3, door - 3), [base.x, door + 1.2]];
      return;
    }
    // 둥지로 알 훔치러 (내가 연 마당까지만 갈 수 있다)
    const top = Math.min(b.zones, this.e.zones) - 1;
    const zone = r < 0.65 ? top : Math.floor(b.rnd() * (top + 1));
    const eggs = this.eggs.filter(x => x.zone === zone && !x.taken);
    if (!eggs.length) { b.think = 2; return; }
    const egg = eggs[Math.floor(b.rnd() * eggs.length)];
    b.state = 'steal'; b.egg = egg;
    const base = EGG_SLOTS[b.slot];
    b.path = [[base.x, base.z - EGG_BASE.d / 2 - 2], ...this.route(b, 0, zone, egg.x, egg.z)];
  }
  botCaught(b, gd) {
    if (b.carry?.kind === 'egg') { const egg = b.carry.egg; egg.taken = false; egg.t = 0; egg.mesh.visible = true; }
    b.carry = null; disposeObj(b.cm); b.cm = null;
    b.stun = 1.4;
    const dx = b.x - gd.x, dz = b.z - gd.z, d = Math.hypot(dx, dz) || 1;
    b.x += (dx / d) * 3; b.z += (dz / d) * 3;
    if (b.rnd() < 0.5) b.avatar.say(['으악 들켰다!', '꽥꽥 무서워 😱', '다시 해 볼래'][Math.floor(b.rnd() * 3)]);
    b.state = 'home'; b.path = this.botHome(b);
  }
  botCarry(b, item) {
    disposeObj(b.cm); b.cm = null;
    b.carry = item;
    if (item) { b.cm = item.kind === 'egg' ? makeEgg(item.egg.zone) : makeCritter(item.p.c, item.p.gold); this.group.add(b.cm); }
  }
  botPlace(b, p) {
    let i = b.pets.findIndex((q, k) => !q && k < b.ped);
    if (i < 0 && b.pets.length < b.ped) i = b.pets.length;
    if (i < 0) {
      let low = -1, lv = Infinity;
      b.pets.forEach((q, k) => { if (q && q.t <= 0 && petIncome(q) < lv) { lv = petIncome(q); low = k; } });
      if (low < 0 || petIncome({ ...p, t: 0 }) <= lv) { b.cash += sellValue({ ...p, t: 0 }); return; }
      b.cash += sellValue(b.pets[low]); i = low;
    }
    b.pets[i] = p;
  }
  updateBots(dt) {
    const g = this.game, me = g.player;
    for (const b of this.bots) {
      // 돈과 부화, 사기
      for (const p of b.pets) if (p && p.t > 0) p.t = Math.max(0, p.t - dt);
      b.cash += baseIncome(b.pets) * dt;
      if (b.zones < EGG_ZONES.length && b.cash >= EGG_ZONES[b.zones].price * 1.1) { b.cash -= EGG_ZONES[b.zones].price; b.zones++; }
      else if (b.ped < EGG.PED_MAX && b.cash >= pedPrice(b.ped) * 1.5) { b.cash -= pedPrice(b.ped); b.ped++; }
      else if (b.boots < 0.6 && b.cash >= bootsPrice(Math.round(b.boots * 10)) * 2) { b.cash -= bootsPrice(Math.round(b.boots * 10)); b.boots += 0.1; }
      b.raidT -= dt; b.saidT -= dt;
      if (b.lockT > 0) b.lockT -= dt; else { b.lockCool -= dt; if (b.lockCool <= 0 && b.pets.some(p => p && p.t <= 0)) { b.lockT = EGG.LOCK; b.lockCool = 60 + b.rnd() * 80; } }
      if (b.stun > 0) { b.stun -= dt; this.drawBot(b, dt, false); continue; }
      // 내가 이 AI 기지에서 훔친 동물을 들고 있으면 쫓아온다
      const robbed = this.carry?.kind === 'pet' && this.carry.bot === b;
      if (robbed && b.state !== 'chase' && !b.carry && Math.hypot(me.x - b.x, me.z - b.z) < 18) { b.noticeT = (b.noticeT ?? 1.2) - dt; if (b.noticeT <= 0) { b.noticeT = 1.2; b.state = 'chase'; if (b.saidT <= 0) { b.saidT = 5; b.avatar.say('거기 서! 내 동물이야! 😠'); } } }
      if (b.state === 'chase') {
        if (!robbed || Math.hypot(me.x - b.x, me.z - b.z) > 34) { b.state = 'home'; b.path = this.botHome(b); }
        else {
          this.botGo(b, me.x, me.z, dt, 7.0 / this.botSpeed(b)); // 쫓을 때는 7.0: 신발 없이 동물을 든 나(7.65)보다 조금 느리다
          if (Math.hypot(me.x - b.x, me.z - b.z) < 1.7) {
            const c = this.carry;
            this.carry = null; this.carryChanged();
            this.botPlace(b, c.p);
            g.sfx('hurt'); g.ui.big(`😵 ${b.short}에게 잡혔어! 동물을 돌려줬어`, 1800);
            this.grabCool = 3;
            b.state = 'home'; b.path = this.botHome(b);
          }
          this.drawBot(b, dt, true);
          continue;
        }
      }
      // 내 동물을 들고 가는 AI 에게 닿으면 되찾기
      if (b.carry?.kind === 'pet' && b.carry.mine && Math.hypot(me.x - b.x, me.z - b.z) < 1.9) {
        const p = b.carry.p;
        this.botCarry(b, null);
        if (!this.pets()[b.carry0]) this.pets()[b.carry0] = p; else this.place(p, true);
        this.dirty = true;
        this.e.saved++;
        g.addCoins(3); g.sfx('win');
        g.ui.big(`✋ ${josa(b.short, '을', '를')} 잡았다! ${critterOf(p.c).name} 되찾았어 · 🪙+3`, 2000, 'gold');
        b.avatar.say('으앙 들켰다 😭');
        b.state = 'home'; b.path = this.botHome(b);
        g.persist();
      }
      if (b.state === 'idle') { b.think -= dt; if (b.think <= 0) this.botPlan(b); this.drawBot(b, dt, false); continue; }
      if (!b.path.length) {
        if (b.state === 'steal') {
          const egg = b.egg;
          if (egg && !egg.taken && Math.hypot(egg.x - b.x, egg.z - b.z) < 1.6) { egg.taken = true; egg.t = EGG.RESPAWN; egg.mesh.visible = false; this.botCarry(b, { kind: 'egg', egg }); }
          b.state = 'home'; b.path = this.botHome(b);
        } else if (b.state === 'raid') {
          // 내 기지 앞: 잠겨 있으면 돌아가고, 아니면 가장 비싼 동물로
          if (this.lockT > 0) { if (b.saidT <= 0) { b.saidT = 5; b.avatar.say('잠겼네… 🔒'); } b.state = 'home'; b.path = this.botHome(b); }
          else {
            const pets = this.pets(); let best = -1, bv = -1;
            pets.forEach((p, i) => { if (p && p.t <= 0 && i < this.e.ped && petIncome(p) > bv) { bv = petIncome(p); best = i; } });
            if (best < 0) { b.state = 'home'; b.path = this.botHome(b); }
            else { b.state = 'grab'; b.target = best; b.path = [[this.myPeds[best].x, this.myPeds[best].z - 1.2]]; }
          }
        } else if (b.state === 'grab') {
          const p = this.pets()[b.target];
          if (p && p.t <= 0 && this.lockT <= 0) {
            this.pets()[b.target] = null; this.dirty = true;
            b.carry0 = b.target;
            this.botCarry(b, { kind: 'pet', p, mine: true });
            g.sfx('hurt'); g.ui.big(`🚨 ${josa(b.short, '이', '가')} ${critterOf(p.c).icon} ${josa(critterOf(p.c).name, '을', '를')} 훔쳐 가! 쫓아가서 닿아!`, 2400);
            b.avatar.say('헤헤 가져간다~ 😎');
          }
          const base = EGG_SLOTS[this.slot], door = base.z - EGG_BASE.d / 2;
          b.state = 'home'; b.path = [[base.x, door + 1], [base.x, door - 3], ...this.botHome(b)];
        } else if (b.state === 'home') {
          if (b.carry) {
            if (b.carry.kind === 'egg') { const h = hatchCritter(b.carry.egg.zone, b.rnd(), b.rnd()); this.botPlace(b, { c: h.c, gold: h.gold, t: critterOf(h.c).hatch }); }
            else { this.botPlace(b, { ...b.carry.p, t: 0 }); if (b.carry.mine) g.ui.toast(`😭 ${josa(b.short, '이', '가')} ${josa(critterOf(b.carry.p.c).name, '을', '를')} 가져갔어… 🔒 잠그거나 닿아서 되찾아!`, 3000); }
            this.botCarry(b, null);
          }
          b.state = 'idle'; b.think = 0.5 + b.rnd() * 3;
        }
        this.drawBot(b, dt, false);
        continue;
      }
      const [tx, tz] = b.path[0];
      if (this.botGo(b, tx, tz, dt, 1) < 0.5) b.path.shift();
      this.drawBot(b, dt, true);
    }
    // 내가 AI 기지에서 훔치기
    if (!this.carry && this.grabCool <= 0) {
      for (const b of this.bots) {
        const i = b.peds.findIndex((ped, k) => b.pets[k] && b.pets[k].t <= 0 && Math.hypot(me.x - ped.x, me.z - ped.z) < 1.5);
        if (i < 0) continue;
        this.grabCool = 1.2;
        if (b.lockT > 0) { this.say(`🔒 ${b.short}의 기지는 잠겨 있어!`); break; }
        const p = b.pets[i];
        b.pets[i] = null;
        this.carry = { kind: 'pet', p, bot: b, i };
        this.carryChanged();
        g.sfx('coin');
        g.ui.toast(`${critterOf(p.c).icon} 훔쳤다! 내 기지까지 달려! ${josa(b.short, '이', '가')} 쫓아올 거야`, 2600);
        break;
      }
    }
  }
  botGo(b, tx, tz, dt, k) {
    const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
    if (d > 0.05) { const s = Math.min(d, this.botSpeed(b) * k * dt); b.x += (dx / d) * s; b.z += (dz / d) * s; b.yaw = Math.atan2(dx, dz); }
    return d;
  }
  drawBot(b, dt, moving) {
    b.avatar.place(b.x, 0.3, b.z, b.yaw, dt);
    b.avatar.animate(dt, { speed: moving ? this.botSpeed(b) : 0, grounded: true, vy: 0, climb: false, emote: 0 });
    if (b.cm) { b.cm.position.set(b.x, 3.4, b.z); b.cm.rotation.y = b.yaw; }
    // 기지 받침대
    b.peds.forEach((ped, i) => {
      const p = i < b.ped ? b.pets[i] : null;
      const key = !p ? '' : `${p.c}|${p.gold ? 1 : 0}|${p.t > 0 ? 'egg' : 'pet'}`;
      if (ped.key !== key) {
        disposeObj(ped.mesh); ped.mesh = null;
        if (p) { ped.mesh = p.t > 0 ? makeEgg(critterOf(p.c).zone) : makeCritter(p.c, p.gold); ped.mesh.position.set(ped.x, ped.y, ped.z); ped.mesh.rotation.y = Math.PI; this.group.add(ped.mesh); }
        ped.key = key;
      }
      if (ped.mesh && p && p.t <= 0) animateCritter(ped.mesh, this.t + i + b.slot, false);
    });
    this.laserFor(b.slot).visible = b.lockT > 0;
  }
  updateGuards(dt) {
    const g = this.game, me = g.player;
    const safe = eggInBase(this.slot, me.x, me.z);
    for (const gd of this.guards) {
      gd.t += dt;
      // AI 도둑이 이 둥지 알을 들고 가면 그쪽을 쫓는다 (내가 더 가까우면 나)
      let bot = null, bd = 9;
      for (const b of this.bots) { if (b.carry?.kind === 'egg' && b.carry.egg.nest === gd.home && b.stun <= 0) { const d = Math.hypot(b.x - gd.x, b.z - gd.z); if (d < bd) { bd = d; bot = b; } } }
      if (gd.mode === 'chaseBot' && (!gd.bot || gd.bot.carry?.kind !== 'egg' || Math.hypot(gd.bot.x - gd.home.x, gd.bot.z - gd.home.z) > 30)) { gd.mode = 'back'; gd.bot = null; }
      const dHome = Math.hypot(me.x - gd.home.x, me.z - gd.home.z);
      const dMe = Math.hypot(me.x - gd.x, me.z - gd.z);
      const carryingHere = this.carry?.kind === 'egg' && this.carry.egg?.nest === gd.home;
      const spot = !safe && me.y < 4 && (dMe < 9 && (carryingHere || dHome < 6));
      if (bot && gd.mode !== 'chase' && gd.mode !== 'chaseBot' && !(spot && dMe < bd)) { gd.mode = 'chaseBot'; gd.bot = bot; }
      if (spot && gd.mode !== 'chase' && (gd.mode !== 'chaseBot' || dMe < bd)) { gd.mode = 'chase'; if (dMe < 12) g.sfx('tick'); }
      if (gd.mode === 'chase' && (safe || dHome > 30 || (!carryingHere && dHome > 12))) gd.mode = 'back';
      let tx, tz, sp;
      if (gd.mode === 'chaseBot') {
        tx = gd.bot.x; tz = gd.bot.z; sp = gd.speed;
        if (Math.hypot(gd.bot.x - gd.x, gd.bot.z - gd.z) < 1.6) { this.botCaught(gd.bot, gd); gd.mode = 'back'; gd.bot = null; }
      } else if (gd.mode === 'chase') { tx = me.x; tz = me.z; sp = gd.speed; }
      else if (gd.mode === 'back') { tx = gd.home.x + Math.cos(gd.a) * 6; tz = gd.home.z + Math.sin(gd.a) * 6; sp = gd.speed * 0.7; if (Math.hypot(tx - gd.x, tz - gd.z) < 1) gd.mode = 'patrol'; }
      else { gd.a += dt * 0.45; tx = gd.home.x + Math.cos(gd.a) * 6; tz = gd.home.z + Math.sin(gd.a) * 6; sp = 3; }
      const dx = tx - gd.x, dz = tz - gd.z, d = Math.hypot(dx, dz);
      const moving = d > 0.1;
      if (moving) { const s = Math.min(d, sp * dt); gd.x += (dx / d) * s; gd.z += (dz / d) * s; gd.yaw = Math.atan2(dx, dz); }
      gd.mesh.position.set(gd.x, 0, gd.z); gd.mesh.rotation.y = gd.yaw;
      gd.alert.visible = gd.mode === 'chase' || gd.mode === 'chaseBot';
      animateCritter(gd.body, gd.t * (gd.mode === 'chase' ? 1.4 : 0.8), moving);
      // 들켰다
      if (gd.mode === 'chase' && dMe < 1.6 && this.hitCool <= 0) {
        this.hitCool = 1.4;
        this.pickCool = 1.8;
        const kx = (me.x - gd.x) / (dMe || 1), kz = (me.z - gd.z) / (dMe || 1);
        me.vx = kx * 16; me.vz = kz * 16; me.vy = 9; me.ground = null;
        g.sfx('hurt');
        if (this.carry?.kind === 'egg') {
          const egg = this.carry.egg;
          if (egg) { egg.taken = false; egg.t = 0; egg.mesh.visible = true; }
          this.carry = null; this.carryChanged();
          g.ui.big(`💥 ${EGG_ZONES[gd.zone].guardName}에게 들켰어! 알을 떨어뜨렸어`, 1800);
        } else g.ui.toast(`💥 ${EGG_ZONES[gd.zone].guardName}: 둥지에서 떨어져!`, 1400);
        gd.mode = 'back';
      }
    }
  }
  updateInfo() {
    const e = this.e;
    const income = baseIncome(this.pets());
    const holding = !this.carry ? '빈손' : this.carry.kind === 'egg' ? `🥚 ${EGG_ZONES[this.carry.zone].egg} 들고 가는 중!` : `${critterOf(this.carry.p.c).icon} ${critterOf(this.carry.p.c).name} 들고 가는 중!`;
    const next = EGG_ZONES[e.zones];
    const run = this.onTread ? (e.run >= RUN_MAX ? `🏃 달리기 Lv${e.run} 최고!` : `🏃 달리기 Lv${e.run} → ${e.run + 1}: ${Math.floor((e.xp / runNeed(e.run)) * 100)}%${this.running ? '' : ' · 가만히 서 있으면 달려!'}`) : null;
    const raid = this.bots.find(b => b.state === 'raid' || (b.carry?.kind === 'pet' && b.carry.mine));
    const html = `<b>💵 ${money(e.cash)} · +${money(income)}/초</b><small>${run ?? holding}${next ? ` · 다음 ${next.icon} ${money(next.price)}` : ' · 모든 둥지 열림!'}${this.raccoon ? ' · 🦝 너구리!' : ''}${raid ? ` · 🚨 ${josa(raid.short, '이', '가')} 훔치러 와!` : ''}</small>`;
    this.game.ui.setInfo(html);
  }

  dispose() {
    for (const b of this.bots) { b.avatar.dispose(); disposeObj(b.cm); }
    this.removeRaccoon();
    disposeObj(this.carryMesh);
    for (const o of this.others.values()) disposeObj(o.carryMesh);
    this.group.traverse(c => { if (c.isSprite) { c.material.map?.dispose(); c.material.dispose(); } });
    this.group.removeFromParent();
    this.bar.remove();
    document.body.classList.remove('eggw');
    this.game.ui.setInfo('');
    this.game.persist();
  }
}
