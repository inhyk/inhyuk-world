// 블록 공장 타이쿤: 떨어뜨리개 → 벨트 → 녹이는 기계 → 돈 받는 발판 → 물건 사기 → 집이 생긴다.
import { THREE, textSprite, signMesh } from './render.js';
import { TYCOON, TYCOON_START_DROP, TYCOON_REWARD, TYCOON_AWAY_RATE, tycoonAvailable, tycoonIncome, tycoonAwayEarnings, displayName } from '../core.mjs';
import {
  PLOT_SLOTS, tycoonBase, tycoonItem, plotBuilder, DROPPERS, DROP_COLOR, BELT, UPGRADERS, COLLECTOR, BUY_SPOTS,
} from '../worlds.mjs';

const dropGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
const money = n => `$${Math.floor(n).toLocaleString('ko-KR')}`;

export class Tycoon {
  constructor(game) {
    this.game = game;
    this.mySlot = game.net.active ? game.net.slot : 0;
    this.plots = new Map(); // slot → { handle, items, owner, sign }
    this.drops = [];
    this.timers = {};
    this.pads = [];
    this.collectBox = null;
    this.standing = null;
    this.signTimer = 0;
    this.dropMesh = new THREE.InstancedMesh(dropGeo, new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.1 }), 160);
    this.dropMesh.count = 0; this.dropMesh.castShadow = true; this.dropMesh.frustumCulled = false;
    game.world.group.add(this.dropMesh);
    this.m = new THREE.Matrix4(); this.c = new THREE.Color(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3(1, 1, 1);
    for (let slot = 0; slot < PLOT_SLOTS.length; slot++) this.buildPlot(slot);
    // 내 땅 앞에서 시작
    const s = PLOT_SLOTS[this.mySlot];
    const b = plotBuilder([], this.mySlot);
    const [x, , z] = b.world(23.5, 0, 0);
    game.world.def.spawn = { x, y: 0.2, z, yaw: Math.atan2(-b.F[0], -b.F[1]) };
    void s;
    // 나가 있던 동안 쌓인 돈 (0.5배)
    const now = Date.now();
    if (this.save.away > 0) {
      const gain = tycoonAwayEarnings(this.save.items, now - this.save.away);
      if (gain > 0) {
        this.save.pending += gain;
        setTimeout(() => game.ui.big(`자리 비운 동안 💵 ${money(gain)} 쌓였어!`, 3200, 'gold'), 1700);
        setTimeout(() => game.ui.toast('초록 발판을 밟으면 받을 수 있어 (나가 있을 때는 0.5배로 쌓여)', 4200), 1900);
        game.persist();
      }
    }
    this.save.away = now;
    this.refreshPads();
    this.updateInfo();
  }

  get save() { return this.game.save.tycoon; }

  ownerOf(slot) {
    if (slot === this.mySlot) return { me: true, items: this.save.items, name: '내 공장' };
    for (const r of this.game.remotes.values()) if (r.slot === slot && r.tycoon) return { me: false, items: r.tycoon, name: `${r.name}의 공장` };
    return null;
  }

  buildPlot(slot) {
    const old = this.plots.get(slot);
    if (old) { this.game.removeParts(old.handle); }
    const owner = this.ownerOf(slot);
    const parts = [];
    let sign;
    if (owner) {
      tycoonBase(parts, slot);
      for (const id of owner.items) tycoonItem(parts, slot, id);
    } else {
      const b = plotBuilder(parts, slot);
      b.plat(0, 0, 0, 41, 41, { c: '#d9dde4', h: 0.4, round: 0.15 });
      b.plat(0, 0, 0.05, 39, 39, { c: '#eceae4', h: 0.4, m: 'stone', round: 0.1 });
    }
    const b = plotBuilder(parts, slot);
    b.box(20.6, 0, 1.7, 0.4, 3.4, 0.4, { c: '#8b5a3c', m: 'wood', deco: true });
    const handle = this.game.makeParts(parts);
    const [sx, sy, sz] = b.world(20.8, 0, 4.1);
    sign = signMesh([owner ? owner.name : '빈 땅', owner ? (owner.me ? '여기가 내 땅이야!' : '친구 공장') : '친구가 오면 여기에 지어요'], { w: 6, h: 1.8, bg: '#ffffff', fg: '#2a2d3a', accent: owner ? '#5ad16b' : '#9aa3b5', sizes: [56, 36] });
    sign.position.set(sx, sy, sz);
    sign.rotation.y = b.yaw();
    handle.group.add(sign);
    let pending = null;
    if (owner?.me) {
      const [px, py, pz] = b.world(COLLECTOR.f, COLLECTOR.r, 6.6);
      pending = textSprite('쌓인 돈', { sub: money(this.save.pending), size: 52 });
      pending.position.set(px, py, pz);
      handle.group.add(pending);
      this.collectBox = handle.boxes.find(bx => bx.part.collect) ?? null;
    }
    this.plots.set(slot, { handle, owner, pending });
  }

  // 사는 발판 (다음에 살 수 있는 것 다섯 개까지)
  refreshPads() {
    for (const p of this.pads) { this.game.removeParts(p.handle); }
    this.pads = [];
    const avail = tycoonAvailable(this.save.items).slice(0, BUY_SPOTS.length);
    avail.forEach((it, i) => {
      const parts = [];
      const b = plotBuilder(parts, this.mySlot);
      const [f, r] = BUY_SPOTS[i];
      const can = this.save.cash >= it.price;
      b.plat(f, r, 0.32, 3.2, 3.2, { c: can ? '#5ad16b' : '#ff6b6b', h: 0.3, buy: it.id });
      b.plat(f, r, 0.36, 2.4, 2.4, { c: '#ffffff', h: 0.06, deco: true, m: 'neon' });
      const handle = this.game.makeParts(parts);
      const [x, y, z] = b.world(f, r, 2.2);
      const label = textSprite(it.name, { sub: money(it.price), size: 44, subColor: can ? '#9dff9d' : '#ffb3b3' });
      label.position.set(x, y, z);
      handle.group.add(label);
      this.pads.push({ handle, item: it, box: handle.boxes[0], label, can });
    });
  }

  updatePadColors() {
    let changed = false;
    for (const p of this.pads) if ((this.save.cash >= p.item.price) !== p.can) changed = true;
    if (changed) this.refreshPads();
  }

  updateInfo() {
    const done = this.save.items.length;
    const rate = tycoonIncome(this.save.items);
    this.game.ui.setInfo(`<b>💵 ${money(this.save.cash)}</b><small>초당 ${money(rate)} · 나가 있으면 ${money(rate * TYCOON_AWAY_RATE)} · 지은 것 ${done}/${TYCOON.length}</small>`);
  }

  buy(it) {
    const s = this.save;
    if (s.items.includes(it.id)) return;
    if (s.cash < it.price) { this.game.sfx('nope'); this.game.ui.toast(`돈이 ${money(it.price - s.cash)} 모자라! 초록 발판에서 쌓인 돈을 받아.`); return; }
    s.cash -= it.price;
    s.items.push(it.id);
    this.stepOff = true;
    this.game.sfx('buy');
    this.buildPlot(this.mySlot);
    this.refreshPads();
    const b = plotBuilder([], this.mySlot);
    const [x, y, z] = b.world(0, -6, 4);
    this.game.effects.burst(x, y, z, ['#ffd23f', '#5ad16b', '#ffffff'], 30, 8);
    this.game.ui.toast(`✨ ${it.name} 완성!`);
    if (it.finale) {
      s.done = true;
      this.game.addCoins(TYCOON_REWARD);
      this.game.effects.confetti(x, y + 4, z, 220);
      this.game.sfx('win');
      this.game.ui.big(`🏆 공장 완성! +${TYCOON_REWARD} 코인`, 3200, 'gold');
    }
    this.game.persist();
    this.game.net.send({ t: 'ty', o: this.itemIndexes() });
    this.updateInfo();
  }

  itemIndexes() { return this.save.items.map(id => TYCOON.findIndex(it => it.id === id)).filter(i => i >= 0); }

  remoteChanged(slot) { if (slot !== this.mySlot && slot >= 0 && slot < PLOT_SLOTS.length) this.buildPlot(slot); }

  droppers() {
    const list = [['start', TYCOON_START_DROP]];
    for (const it of TYCOON) if (it.drop && this.save.items.includes(it.id)) list.push([it.id, it.drop]);
    return list;
  }

  update(dt) {
    const b = plotBuilder([], this.mySlot);
    // 떨어뜨리기
    for (const [id, d] of this.droppers()) {
      this.timers[id] = (this.timers[id] ?? Math.random() * d.every) + dt;
      if (this.timers[id] >= d.every && this.drops.length < 150) {
        this.timers[id] -= d.every;
        this.drops.push({ r: DROPPERS[id], y: BELT.top + 2.6, vy: 0, value: d.value, color: new THREE.Color(DROP_COLOR[id]), on: false, ups: 0, spin: Math.random() * 6 });
      }
    }
    const has = id => this.save.items.includes(id);
    let n = 0, earned = 0;
    this.drops = this.drops.filter(d => {
      if (!d.on) {
        d.vy -= 30 * dt; d.y += d.vy * dt;
        if (d.y <= BELT.top + 0.35) { d.y = BELT.top + 0.35; d.on = true; }
      } else {
        const before = d.r;
        d.r += BELT.speed * dt;
        for (const [id, r] of Object.entries(UPGRADERS)) {
          if (has(id) && before < r && d.r >= r) {
            const it = TYCOON.find(t => t.id === id);
            d.value *= it.mult; d.ups++;
            d.color.set(id === 'up1' ? '#4dfffc' : '#ff6bf1');
          }
        }
        if (d.r >= BELT.r1 + 0.6) { earned += d.value; return false; }
      }
      d.spin += dt * 2;
      const [x, y, z] = b.world(BELT.f, d.r, d.y);
      this.e.set(0, d.spin, 0); this.q.setFromEuler(this.e); this.v.set(x, y, z);
      this.m.compose(this.v, this.q, this.s);
      this.dropMesh.setMatrixAt(n, this.m); this.dropMesh.setColorAt(n, d.color); n++;
      return true;
    });
    this.dropMesh.count = n;
    this.dropMesh.instanceMatrix.needsUpdate = true;
    if (this.dropMesh.instanceColor) this.dropMesh.instanceColor.needsUpdate = true;
    if (earned) {
      this.save.pending += earned;
      const [x, y, z] = b.world(COLLECTOR.f, COLLECTOR.r, 4.4);
      if (Math.random() < 0.5) this.game.effects.burst(x, y, z, ['#ff9a3d', '#ffd23f'], 4, 3);
    }
    this.signTimer -= dt;
    if (this.signTimer <= 0) {
      this.signTimer = 0.25;
      this.save.away = Date.now(); // 여기 있는 동안은 계속 '지금'. 창을 닫으면 이 시각부터 나가 있던 것으로 센다
      this.plots.get(this.mySlot)?.pending?.userData.set('쌓인 돈', money(this.save.pending));
      this.updatePadColors();
      this.updateInfo();
    }
    // 발판 밟기 (산 뒤에는 발판에서 한 번 내려와야 다음 것을 산다)
    const g = this.game.player.ground;
    if (g !== this.standing) {
      this.standing = g;
      const pad = g && this.pads.find(p => p.box === g);
      if (this.stepOff) { if (g && !pad) this.stepOff = false; }
      else if (pad) this.buy(pad.item);
      if (g && g === this.collectBox) this.collect();
    }
  }

  collect() {
    const s = this.save;
    if (s.pending <= 0) { this.game.ui.toast('아직 쌓인 돈이 없어. 블록이 벨트를 지나가면 돈이 쌓여!'); return; }
    s.cash += s.pending;
    this.game.ui.toast(`💵 ${money(s.pending)} 받았어!`);
    s.pending = 0;
    this.game.sfx('cash');
    const p = this.game.player;
    this.game.effects.burst(p.x, p.y + 1, p.z, ['#5ad16b', '#9dff9d', '#ffffff'], 16, 6);
    this.game.persist();
    this.updateInfo();
    this.updatePadColors();
  }

  dispose() {
    this.save.away = Date.now();
    this.game.persist();
    for (const p of this.pads) this.game.removeParts(p.handle);
    for (const p of this.plots.values()) this.game.removeParts(p.handle);
    this.dropMesh.removeFromParent();
    this.dropMesh.dispose();
    this.game.ui.setInfo('');
  }
}

export function remoteTycoonFrom(o) {
  if (!Array.isArray(o)) return null;
  const ids = [];
  for (const i of o) if (Number.isInteger(i) && i >= 0 && i < TYCOON.length) ids.push(TYCOON[i].id);
  // 순서가 맞는 것만
  const ok = [];
  for (const it of TYCOON) if (ids.includes(it.id) && (!it.need || ok.includes(it.need))) ok.push(it.id);
  return ok;
}
export { displayName };
