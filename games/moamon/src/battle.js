// 도장 싸움: 3 대 3. 화면을 눌러 공격하고, 기운이 차면 큰 기술, 느낌표가 뜨면 피한다
import * as THREE from 'three';
import { buildStage, Sparks } from './stage.js';
import { buildMon } from './monsters.js';
import { stats, damage, effect, species, ELEMENTS, FAST_POWER, CHARGE_POWER, FAST_ENERGY } from '../core.mjs';

const ease = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
export class Battle {
  constructor() { this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 900); this.active = false; }
  resize(w, h) { this.camera.aspect = w / h; this.camera.fov = w < h ? 72 : 48; this.camera.updateProjectionMatrix(); }
  // hooks: sfx, say(text, kind), dmg(n, side, eff), changed(), done({win})
  start(mine, foes, el, mood, hooks) {
    this.hooks = hooks; this.active = true; this.t = 0; this.time = 120; this.over = false;
    this.me = this.foe = null; const st = buildStage('plaza', mood, mine.length * 31 + foes[0].lv, ELEMENTS[el].color); this.scene = st.scene; this.sparks = new Sparks(this.scene, 120);
    const side = (list, pos, face) => ({ list: list.map((m) => ({ mon: m, hp: stats(m).hp * 2, max: stats(m).hp * 2 })), i: 0, energy: 0, pos: new THREE.Vector3(...pos), face, cd: 0, lunge: 0, hurt: 0, model: null, scale: 0 });
    this.me = side(mine, [-1.5, 0, 1.4], 2.45); this.foe = side(foes, [1.5, 0, -1.9], -0.72);
    this.enter(this.me); this.enter(this.foe); this.foe.cd = 1.6; this.warn = 0; this.dodgeT = 0; this.dodgeCd = 0; this.swapCd = 0; this.shake = 0;
    this.camera.position.set(-3.3, 2.3, 5.2); this.camera.lookAt(0.2, 0.9, -0.6);
  }
  stop() { this.active = false; this.scene = null; }
  cur(s) { return s.list[s.i]; }
  enter(s) { if (s.model) this.scene.remove(s.model); const c = this.cur(s), m = buildMon(c.mon.sp, c.mon.shiny); s.base = Math.min(1.25, (s === this.me ? 1.35 : 1.9) / m.userData.height); m.scale.multiplyScalar(s.base); s.full = m.scale.x; m.position.copy(s.pos); m.rotation.y = s.face; this.scene.add(m); s.model = m; s.scale = 0; s.inT = 0; s.cy = m.userData.center * s.base; this.sparks.burst(s.pos.clone().setY(0.4), '#ffffff', 12, { speed: 3, life: 0.5, size: 0.2, up: 0.5 }); }
  elOf(s) { return species(this.cur(s).mon.sp).el; }
  hit(from, to, pow, big) {
    const a = this.cur(from), d = this.cur(to); let n = damage(a.mon, d.mon, pow); const eff = effect(this.elOf(from), this.elOf(to));
    if (to === this.me && big && this.dodged) { n = Math.ceil(n * 0.25); this.hooks.say('피했다!', 'good2'); }
    d.hp = Math.max(0, d.hp - n); to.hurt = 0.3; const p = to.pos.clone().setY(to.cy);
    this.sparks.burst(p, [ELEMENTS[this.elOf(from)].color, '#ffffff'], big ? 34 : 9, { speed: big ? 6 : 3, life: big ? 0.9 : 0.4, size: big ? 0.24 : 0.14, shape: big ? 'star' : 'dot' });
    this.hooks.dmg(n, to === this.me ? 'me' : 'foe', eff); this.hooks.sfx(big ? 'charge' : to === this.me ? 'hurt' : 'attack'); if (big) this.shake = 0.35;
    if (d.hp <= 0) { to.faint = 0.7; this.hooks.sfx('faint'); }
    this.hooks.changed();
  }
  tap() { const s = this.me; if (this.over || s.cd > 0 || s.faint || s.scale < 0.9 || s.casting) return; s.cd = 0.42; s.lunge = 0.22; s.energy = Math.min(100, s.energy + FAST_ENERGY); this.hit(this.me, this.foe, FAST_POWER, false); }
  charge() { const s = this.me; if (this.over || s.energy < 100 || s.faint || s.casting) return; s.energy = 0; s.casting = 0.55; this.hooks.say(ELEMENTS[this.elOf(s)].charge + '!', 'good3'); this.hooks.sfx('charge'); this.hooks.changed(); }
  dodge() { if (this.over || this.dodgeCd > 0) return; this.dodgeT = 0.5; this.dodgeCd = 1.0; if (this.warn > 0) this.dodged = true; this.hooks.sfx('dodge'); }
  swap(i) { const s = this.me; if (this.over || this.swapCd > 0 || i === s.i || s.list[i].hp <= 0 || s.faint) return; s.i = i; this.swapCd = 2.5; s.energy = Math.floor(s.energy * 0.5); this.enter(s); this.hooks.sfx('appear'); this.hooks.changed(); }
  update(dt) {
    if (!this.active) return; const t = (this.t += dt), me = this.me, foe = this.foe;
    for (const s of [me, foe]) {
      const m = s.model; m.userData.update(t); s.inT += dt; s.scale = s.faint ? Math.max(0, s.scale - dt * 2.2) : ease(s.inT / 0.4);
      s.cd = Math.max(0, s.cd - dt); s.lunge = Math.max(0, s.lunge - dt); s.hurt = Math.max(0, s.hurt - dt);
      const dir = s === me ? 1 : -1, toward = new THREE.Vector3(foe.pos.x - me.pos.x, 0, foe.pos.z - me.pos.z).normalize().multiplyScalar(dir);
      const l = Math.sin((s.lunge / 0.22) * Math.PI) * 0.9; m.position.copy(s.pos).addScaledVector(toward, l - (s.hurt > 0 ? Math.sin((s.hurt / 0.3) * Math.PI) * 0.35 : 0));
      if (s === me && this.dodgeT > 0) m.position.x -= Math.sin((this.dodgeT / 0.5) * Math.PI) * 1.6;
      if (s.casting) m.position.y = Math.sin((1 - s.casting / 0.55) * Math.PI) * 0.8;
      m.scale.setScalar(s.full * Math.max(0.001, s.scale));
      if (s.faint) { s.faint -= dt; m.rotation.z += dt * 3; if (s.faint <= 0) { s.faint = 0; m.rotation.z = 0; const nx = s.list.findIndex((c) => c.hp > 0); if (nx < 0) return this.finish(s === foe); s.i = nx; s.energy = 0; this.enter(s); this.hooks.changed(); } }
    }
    if (this.over) { this.sparks.update(dt, this.camera); return; }
    this.time -= dt; this.dodgeT = Math.max(0, this.dodgeT - dt); this.dodgeCd = Math.max(0, this.dodgeCd - dt); this.swapCd = Math.max(0, this.swapCd - dt);
    if (me.casting) { me.casting -= dt; if (Math.random() < 0.8) this.sparks.one(me.pos.clone().setY(me.cy + 0.6).lerp(foe.pos.clone().setY(foe.cy), 1 - me.casting / 0.55), ELEMENTS[this.elOf(me)].color, { speed: 1.5, life: 0.4, size: 0.2, gravity: 0, shape: 'star' }); if (me.casting <= 0) { me.casting = 0; if (!foe.faint) this.hit(me, foe, CHARGE_POWER, true); } }
    // 상대의 공격
    if (!foe.faint && foe.scale > 0.9 && !me.faint) {
      if (this.warn > 0) { this.warn -= dt; if (this.warn <= 0) { this.hit(foe, me, CHARGE_POWER, true); this.dodged = false; foe.cd = 1.4; this.hooks.changed(); } }
      else if (foe.cd <= 0) { if (foe.energy >= 100) { foe.energy = 0; this.warn = 1.15; this.dodged = false; this.hooks.sfx('warn'); this.hooks.say('피해!', 'bad'); this.hooks.changed(); } else { foe.cd = 1.25; foe.lunge = 0.22; foe.energy = Math.min(100, foe.energy + 22); this.hit(foe, me, FAST_POWER * 1.5, false); } }
    }
    if (this.warn > 0 && Math.random() < 0.6) this.sparks.one(foe.pos.clone().setY(foe.cy + 0.5), ELEMENTS[this.elOf(foe)].color, { speed: 2, life: 0.4, size: 0.16, gravity: -3 });
    if (this.time <= 0) return this.finish(false);
    this.shake = Math.max(0, this.shake - dt); const sh = this.shake * 0.5; this.camera.position.set(-3.3 + (Math.random() - 0.5) * sh, 2.3 + (Math.random() - 0.5) * sh, 5.2); this.camera.lookAt(0.2, 0.9, -0.6);
    this.sparks.update(dt, this.camera);
  }
  finish(win) { if (this.over) return; this.over = true; this.hooks.sfx(win ? 'win' : 'lose'); this.hooks.say(win ? '이겼다!' : '졌다...', win ? 'gold' : 'bad'); this.hooks.changed(); setTimeout(() => this.hooks.done({ win }), 1800); }
  get view() { const f = (s) => { const c = this.cur(s), sp = species(c.mon.sp); return { name: sp.name, el: ELEMENTS[sp.el], hp: c.hp, max: c.max, energy: s.energy, i: s.i, team: s.list.map((x) => ({ mon: x.mon, hp: x.hp, max: x.max })) }; }; return { me: f(this.me), foe: f(this.foe), warn: this.warn > 0, time: Math.max(0, Math.ceil(this.time)), over: this.over, swapCd: this.swapCd, dodgeCd: this.dodgeCd }; }
}
