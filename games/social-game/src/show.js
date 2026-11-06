// 분수 광장 공연 (인혁 계획 7: "어느날엔 공연도 하게 해줘. 그리고 분수를 만들고 분수에서 공연을 하게 해줘").
// On show days (isShowDay, Fridays) from SHOW_HOUR (19:00) to 21:00 a band plays on the stage in front of
// the fountain: a singer, a guitarist, a keyboard player, a drummer and two dancers, a crowd of town people
// walks in and claps, the fountain jets dance to the music with coloured pool lights and moving-head beams.
// Everyone in town can see it; nothing is shared online.
//   show.update(dt)     every frame (fountain, lights, people, music, morning notice)
//   await show.watch(it) sit on the front bench and watch the whole show (~100 s); resolves true at the end
//                        (E leaves early → false). No show now → a toast says when, resolves false at once.
//   show.start()        debug: start a show right now whatever the day is
import * as THREE from 'three';
import { isShowDay, SHOW_HOUR } from '../show-days.mjs';
import { weekday } from '../core.mjs';
import { xform } from './places.js';
import { audioOut } from './audio.js';
import { ShowMusic, songAt, LENGTH, LYRICS, SECTIONS } from './show-music.js';
import { fountainEnv, WATER_Y, N_ARC, N_RING } from './fountain.js';
import { paint, mat } from './mat.js';
import { rbox, cyl, sphere, box, extrude, put, group, bake } from './geom.js';

const PI = Math.PI;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const FLOOR = 0.1;
const GAP = 10;           // seconds between two shows in the evening
const WISHES = ['퐁당! 🪙 소원이 꼭 이루어질 거예요 ✨', '퐁당! 🪙 부자가 되게 해 주세요! 💰', '퐁당! 🪙 내일도 신나는 하루 되게 해 주세요 🌈', '퐁당! 🪙 햄찌를 키우게 해 주세요 🐹', '퐁당! 🪙 친구랑 여행 가게 해 주세요 ✈️', '퐁당! 🪙 키가 쑥쑥 크게 해 주세요 🌱'];

// ------------------------------------------------------------------ instruments
function guitar() {
  const g = new THREE.Group();
  const body = new THREE.Shape();
  body.absellipse(0, 0, 0.17, 0.13, 0, PI * 2);
  const upper = new THREE.Shape(); upper.absellipse(0.17, 0, 0.13, 0.105, 0, PI * 2);
  const red = paint(0xc8323a, 0.25, 0.1, { clearcoat: 1 }), wood = mat('walnut'), metal = mat('chrome');
  const inner = group(g, 0, 0, 0, PI);
  put(inner, extrude(body, 0.06, 0.01), red, 0, 0, -0.03);
  put(inner, extrude(upper, 0.06, 0.01), red, 0, 0, -0.03);
  put(inner, rbox(0.62, 0.05, 0.03, 0.01), wood, 0.55, 0, 0.02);
  put(inner, rbox(0.14, 0.07, 0.025, 0.01), wood, 0.92, 0, 0.02);
  put(inner, rbox(0.08, 0.11, 0.012, 0.004), mat('blackPlastic'), 0.05, 0, 0.045);
  put(inner, cyl(0.04, 0.04, 0.012, 16), mat('blackPlastic'), 0.17, 0, 0.042, PI / 2);
  for (let i = 0; i < 4; i++) put(inner, box(0.86, 0.002, 0.002), metal, 0.45, -0.015 + i * 0.01, 0.04);
  g.rotation.z = -0.55;
  return g;
}
function mic() {
  const g = new THREE.Group();
  put(g, cyl(0.016, 0.012, 0.17, 12), mat('blackPlastic'), 0, 0, 0);
  put(g, sphere(0.032, 14, 10), paint(0x9aa0a8, 0.35, 0.9), 0, 0.105, 0);
  return g;
}
function stick() { const g = new THREE.Group(); put(g, cyl(0.008, 0.01, 0.4, 6), mat('birch'), 0, -0.12, 0); return g; }
function drumKit(p, x, z) {
  const g = group(p, x, 0, z);
  const shell = paint(0x2856c8, 0.22, 0.45, { clearcoat: 1 }), head = paint(0xf2f0ea, 0.5), chrome = mat('chrome'), brass = paint(0xd8a840, 0.25, 0.95);
  const drum = (r, h, px, py, pz, rx = 0) => { const d = group(g, px, py, pz); d.rotation.x = rx; put(d, cyl(r, r, h, 28), shell); put(d, cyl(r * 1.02, r * 1.02, 0.012, 28), chrome, 0, h / 2, 0); put(d, cyl(r * 0.98, r * 0.98, 0.004, 28), head, 0, h / 2 + 0.008, 0); };
  drum(0.27, 0.36, 0, 0.29, 0.55, PI / 2);            // bass drum facing the crowd
  drum(0.17, 0.14, -0.32, 0.62, 0.32, 0.12);          // snare
  drum(0.13, 0.16, 0.1, 0.8, 0.48, 0.35);             // rack tom
  drum(0.19, 0.38, 0.44, 0.38, 0.25);                 // floor tom
  for (const [cx, cy, cz, r] of [[-0.55, 0.95, 0.32, 0.17], [0.42, 1.25, 0.6, 0.24]]) {
    put(g, cyl(0.012, 0.012, cy, 8), chrome, cx, cy / 2, cz);
    put(g, cyl(r, r * 0.2, 0.012, 28), brass, cx, cy, cz, 0.15);
  }
  put(g, cyl(0.17, 0.17, 0.008, 28), brass, -0.55, 0.92, 0.32);
  put(g, cyl(0.18, 0.15, 0.08, 20), paint(0x1a1a1c, 0.6), 0, 0.5, 0);
  put(g, cyl(0.025, 0.025, 0.46, 8), chrome, 0, 0.23, 0);
  return g;
}
function keyboard(p, x, z, ry) {
  const g = group(p, x, 0, z, ry);
  const black = mat('blackPlastic'), chrome = mat('chrome');
  for (const s of [-1, 1]) { const l = put(g, cyl(0.015, 0.015, 1.0, 8), chrome, s * 0.3, 0.42, 0); l.rotation.z = s * 0.55; }
  put(g, rbox(1.05, 0.08, 0.32, 0.02), black, 0, 0.86, 0);
  put(g, rbox(0.98, 0.02, 0.15, 0.004), paint(0xf6f4ee, 0.4), 0, 0.905, 0.06);
  for (let i = 0; i < 20; i++) if (![2, 6, 9, 13, 16].includes(i % 21)) put(g, box(0.022, 0.018, 0.09), black, -0.47 + i * 0.049 + 0.024, 0.92, 0.035);
  put(g, rbox(0.3, 0.012, 0.05, 0.004), paint(0x55e0ff, 0.3, 0, { emissive: 0x55e0ff, emissiveIntensity: 1.5 }), -0.3, 0.905, -0.1);
  return g;
}

// ------------------------------------------------------------------ poses (applied after ch.update, which resets bones)
function micPose(B, lift) {
  B.shoulderR.rotation.x = lerp(0.15, 0.95, lift); B.shoulderR.rotation.z = lerp(0.08, 0.38, lift);
  B.elbowR.rotation.x = lerp(0.3, 2.35, lift); B.elbowR.rotation.y = lerp(0.1, 0.95, lift);
  B.handR.rotation.x = -0.35 * lift;
}
function clapPose(B, ph, k = 1) {
  const open = Math.pow(Math.abs(Math.sin(ph * PI)), 0.7);
  B.shoulderL.rotation.x = 0.85 * k; B.shoulderR.rotation.x = 0.85 * k;
  B.shoulderL.rotation.z = (0.42 - 0.3 * open) * k; B.shoulderR.rotation.z = -(0.42 - 0.3 * open) * k;
  B.elbowL.rotation.x = 1.25 * k; B.elbowR.rotation.x = 1.25 * k;
  B.elbowL.rotation.y = -0.5 * k; B.elbowR.rotation.y = 0.5 * k;
}
function cheerPose(B, t, k = 1, seed = 0) {
  B.shoulderL.rotation.z = -2.55 * k + 0.15 * Math.sin(t * 9 + seed); B.shoulderR.rotation.z = 2.55 * k + 0.15 * Math.sin(t * 9 + seed + 1);
  B.shoulderL.rotation.x = -0.1; B.shoulderR.rotation.x = -0.1;
  B.elbowL.rotation.x = 0.15; B.elbowR.rotation.x = 0.15;
}
function bowPose(B, k) {
  B.spine.rotation.x = -0.55 * k; B.chest.rotation.x = -0.25 * k; B.head.rotation.x = 0.25 * k;
  B.shoulderL.rotation.x = 0.35 * k; B.shoulderR.rotation.x = 0.35 * k;
}

/** Colour palette per section (HSL hues) at song time. */
function paletteAt(s, i, out) {
  const b = s.beatF;
  switch (s.section) {
    case 'intro': return out.setHSL(0.66 + 0.06 * Math.sin(b * 0.5 + i), 0.85, 0.5);
    case 'verse': return out.setHSL(0.5 + 0.12 * Math.sin(s.barF * 0.8 + i * 0.4), 0.8, 0.52);
    case 'chorus': return out.setHSL((i / 16 + b * 0.0625) % 1, 0.85, 0.55);
    case 'water': return out.setHSL((i / 16 + s.barF * 0.12) % 1, 0.9, 0.55);
    case 'final': return out.setHSL([0.92, 0.12, 0.55, 0.78][(Math.floor(b) + (i % 2)) % 4], 0.9, 0.58);
    case 'end': return out.setHSL(0.12, 0.6, 0.62);
    default: return out.setHSL(0.08 + 0.05 * Math.sin(i), 0.7, 0.55);
  }
}

export class Show {
  /** g = {engine, places, life, sky, state, hud, player, day, lights, input, sfx} */
  constructor(g) {
    this.g = g;
    this.site = g.places?.sites?.plaza ?? null;
    this.watching = false;
    this.forced = false;
    this.showT = -1;          // song time; <0 = waiting between shows
    this.playing = false;     // the song is running
    this.present = false;     // band and crowd are at the plaza
    this.music = null;
    this.toldDay = 0;
    this.notice = { day: 0, morning: false, soon: false, start: false, t: 0 };
    this.col = new THREE.Color();
    this.t = 0;
    this.stats = { shows: 0, watched: 0 };
    if (!this.site) return;
    const site = this.site;
    this.water = site.extra.fountain;
    this.stage = site.extra.stage;
    this.fc = site.extra.fountainPos;
    // everything the show adds lives in plaza-local space
    const root = this.root = new THREE.Group();
    root.name = 'show';
    root.position.set(...site.worldPos);
    root.rotation.y = site.worldYaw;
    g.engine.scene.add(root);
    root.visible = false;
    this.stageCenter = new THREE.Vector3(...xform(site, [0, 1.5, 4]));
    this.buildKit();
    this.buildCast();
    this.buildCrowd();
    this.buildCoins();
    // E on the plaza things: the quest code gets them when they are the current step, the show otherwise
    const day = g.day;
    if (day) {
      const questUse = day.use.bind(day);
      day.use = (it) => {
        if (it?.site === 'plaza' && !(day.step && day.step.target === it.key)) {
          if (day.busy || this.watching) return Promise.resolve(false);
          if (it.id === 'show') return this.watch(it);
          if (it.id === 'fountain') return this.wish(it);
        }
        return questUse(it);
      };
    }
    this.caption = document.createElement('div');
    this.caption.id = 'show-caption';
    Object.assign(this.caption.style, {
      position: 'fixed', left: '50%', bottom: '15%', transform: 'translateX(-50%)', padding: '10px 22px', borderRadius: '18px',
      background: 'rgba(20,14,46,0.55)', color: '#fff', font: '28px Jua, sans-serif', textShadow: '0 2px 6px #000', pointerEvents: 'none',
      whiteSpace: 'nowrap', zIndex: 30, display: 'none', transition: 'opacity .3s',
    });
    document.body.appendChild(this.caption);
  }

  // ---------------------------------------------------------------- building
  buildKit() {
    const kit = this.kit = new THREE.Group();
    kit.name = 'show-kit';
    const y = this.stage.y;
    const dk = drumKit(kit, 1.5, 2.95);
    dk.position.y = y;
    const kb = keyboard(kit, 3.85, 3.85, -0.3);
    kb.position.y = y;
    // mic stand at the front
    const ms = group(kit, 0.6, y, 5.6);
    put(ms, cyl(0.12, 0.14, 0.03, 16), mat('blackPlastic'), 0, 0.015, 0);
    put(ms, cyl(0.012, 0.012, 1.4, 8), mat('chrome'), 0, 0.7, 0);
    bake(kit);
    this.root.add(kit);
  }

  person(look, pos, yaw) {
    const ch = this.g.life.buildCharacter(look);
    ch.group.position.set(...pos);
    ch.group.rotation.y = yaw;
    this.root.add(ch.group);
    return ch;
  }

  buildCast() {
    const L = this.g.life;
    this.cast = [];
    if (!L?.buildCharacter) return;
    const y = this.stage.y;
    const add = (role, look, pos, yaw) => { const ch = this.person(look, pos, yaw); const c = { role, ch, base: new THREE.Vector3(...pos), yaw, ph: this.cast.length * 1.3 }; this.cast.push(c); return c; };
    const singer = add('singer', { hair: 'long', hairColor: 0x2a1a14, outfit: 'suit', skin: 0xf3cfb0, seed: 311 }, [0, y, 5.0], PI);
    const m = mic(); m.position.set(0.0, -0.07, -0.03); m.rotation.set(-1.2, 0, 0); singer.ch.bones.handR.add(m);
    add('dancer', { hair: 'bun', hairColor: 0x3b2a20, outfit: 'casual', skin: 0xeec19c, seed: 322 }, [-2.4, y, 4.55], PI).side = -1;
    add('dancer', { hair: 'spiky', hairColor: 0x1c1a1a, outfit: 'beach', skin: 0xe8b894, seed: 333 }, [2.4, y, 4.55], PI).side = 1;
    const gt = add('guitar', { hair: 'short', hairColor: 0x5a3a24, outfit: 'casual', skin: 0xf1c9a5, seed: 344 }, [-3.9, y, 3.6], PI + 0.3);
    const gu = guitar(); gu.position.set(0.03, -0.3, -0.17); gt.ch.bones.chest.add(gu);
    add('keys', { hair: 'bob', hairColor: 0x2e2420, outfit: 'office', skin: 0xf6d5b8, seed: 355 }, [3.85, y, 3.4], PI - 0.3);
    const dr = add('drums', { hair: 'spiky', hairColor: 0x221a16, outfit: 'casual', skin: 0xd9a47e, seed: 366 }, [1.5, y, 2.95], PI);
    for (const h of ['handL', 'handR']) { const s = stick(); s.rotation.x = -1.2; dr.ch.bones[h].add(s); }
  }

  buildCrowd() {
    const L = this.g.life;
    this.crowd = [];
    if (!L?.person) return;
    // [x, z, kind] in plaza-local space; kinds: s stand, b bench, k kid
    const spots = [
      [-1.7, 7.8, 'k'], [-3.1, 7.1, 's'], [-5.4, 7.6, 's'], [-7.0, 8.4, 'k'], [1.7, 7.8, 'k'], [3.1, 7.1, 's'], [5.4, 7.6, 's'], [7.0, 8.3, 's'],
      [-3.75, 10.55, 'b'], [-2.65, 10.55, 'b'], [2.65, 10.55, 'b'], [3.75, 10.55, 'b'],
      [-6.6, 10.4, 's'], [6.6, 10.6, 's'],
      [-4.8, 12.8, 's'], [-2.2, 13.0, 's'], [0.4, 12.9, 's'], [2.8, 13.1, 's'], [5.2, 12.7, 's'],
    ];
    const outfits = ['casual', 'office', 'casual', 'beach', 'suit', 'casual'];
    spots.forEach(([x, z, k], i) => {
      const ch = L.person(700 + i * 7, outfits[i % outfits.length]);
      if (k === 'k') ch.group.scale.setScalar(0.72);
      ch.group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      ch.group.visible = false;
      this.root.add(ch.group);
      const from = new THREE.Vector3(clamp(x * 1.3 + (i % 3 - 1) * 2, -14, 14), FLOOR, 18.5);
      const yawTo = Math.atan2(-(0 - x), -(3 - z)); // face the singer: yaw so that -Z points at the stage
      this.crowd.push({ ch, spot: new THREE.Vector3(x, FLOOR, z), from, pos: from.clone(), state: 'away', delay: i * 0.55, kind: k, yaw: yawTo, seed: i * 1.7, react: (i * 37) % 5 });
    });
  }

  buildCoins() {
    const g = new THREE.CylinderGeometry(0.035, 0.035, 0.006, 16);
    const m = paint(0xd8b040, 0.28, 0.95);
    this.coins = new THREE.InstancedMesh(g, m, 48);
    this.coins.count = 0;
    this.coins.frustumCulled = false;
    this.water.group.add(this.coins);
    this.coinN = 0;
    this.flyer = new THREE.Mesh(g, m);
    this.flyer.visible = false;
    this.g.engine.scene.add(this.flyer);
  }

  // ---------------------------------------------------------------- schedule
  /** Is today's scheduled show on now (19:00–21:00 on a show day)? */
  scheduled() { const s = this.g.state; return isShowDay(s.day) && s.hour >= SHOW_HOUR && s.hour < SHOW_HOUR + 2; }
  gathering() { const s = this.g.state; return isShowDay(s.day) && s.hour >= SHOW_HOUR - 0.25 && s.hour < SHOW_HOUR + 2; }
  get active() { return this.playing; }

  nextShowText() {
    const s = this.g.state, h12 = SHOW_HOUR > 12 ? SHOW_HOUR - 12 : SHOW_HOUR;
    if (isShowDay(s.day) && s.hour < SHOW_HOUR) return `공연은 오늘 저녁 ${h12}시에 시작해요! 조금만 기다려요 ⏰`;
    let d = s.day + 1;
    while (!isShowDay(d) && d < s.day + 8) d++;
    const n = d - s.day;
    return `${isShowDay(s.day) ? '오늘 공연은 끝났어요. ' : ''}공연은 ${weekday(d)} 저녁 ${h12}시에 해요${n === 1 ? ' (내일!)' : ` (${n}일 뒤)`} 🎤`;
  }

  ensureMusic() {
    if (this.music) return this.music;
    const out = audioOut();
    if (out) try { this.music = new ShowMusic(out); } catch (e) { console.warn('show music failed', e); }
    return this.music;
  }

  begin(at = 0) {
    this.showT = at;
    this.playing = true;
    this.stats.shows++;
    this.lastSection = null;
    const m = this.ensureMusic();
    if (m) m.start(at);
  }

  /** Debug: a show right now, whatever the day. */
  start() { if (!this.site) return false; this.forced = true; this.arrive(true); this.begin(0); return true; }

  arrive(snap) {
    this.present = true;
    this.root.visible = true;
    const far = this.g.engine.camera.position.distanceTo(this.stageCenter) > 60;
    for (const c of this.crowd) {
      if (snap || far) { c.state = 'here'; c.pos.copy(c.spot); }
      else if (c.state !== 'here') { c.state = 'walk'; c.pos.copy(c.from); c.wait = c.delay; }
      c.ch.group.visible = true;
    }
  }
  leave() {
    this.present = false;
    for (const c of this.crowd) if (c.state !== 'away') { c.state = 'leave'; c.wait = c.delay * 0.4; }
  }

  // ---------------------------------------------------------------- watching
  async watch(it) {
    const hud = this.g.hud;
    if (!this.site) { hud?.toast('공연장이 아직 없어요', 2000); return false; }
    if (this.watching) return false;
    if (!this.forced && !this.scheduled()) { hud.toast(this.nextShowText(), 3400); this.g.sfx?.('click'); return false; }
    const day = this.g.day, pl = this.g.player;
    this._wasBusy = !!day.busy;
    day.busy = true;
    this.watching = true;
    this.watchT = 0;
    this.arrive(true);
    this.begin(0);
    const src = it?.seatW ? it : this.g.places.interactables.find((i) => i.key === 'plaza:show');
    this.seatIt = { ...src, seatW: { pos: src.seatW.pos.clone(), yaw: src.seatW.yaw, pitch: src.seatW.pitch } };
    this.seatBase = { yaw: src.seatW.yaw, pitch: src.seatW.pitch };
    const p = new THREE.Vector3(...xform(this.site, [0, FLOOR + 0.05, 10.0]));
    pl.place(p.x, p.y, p.z, this.site.worldYaw);
    this._vis = { avatar: pl.avatar?.group.visible, arm: pl.arm?.group.visible };
    if (pl.avatar) pl.avatar.group.visible = false;
    if (pl.arm) pl.arm.group.visible = false;
    day.sit(this.seatIt);
    this.h0 = Math.max(this.g.state.hour, SHOW_HOUR);
    hud.toast('🎤 공연 시작! 끝까지 보면 박수 👏 (E: 그만 보기)', 3400);
    return new Promise((resolve) => { this._resolve = resolve; });
  }

  finishWatch(full) {
    if (!this.watching) return;
    const day = this.g.day, pl = this.g.player, hud = this.g.hud;
    this.watching = false;
    this.caption.style.display = 'none';
    day.stand();
    day.busy = this._wasBusy;
    if (pl.avatar) pl.avatar.group.visible = this._vis.avatar ?? pl.view === 'third';
    if (pl.arm) pl.arm.group.visible = this._vis.arm ?? pl.view === 'first';
    if (full) { this.stats.watched++; hud.toast('정말 멋진 공연이었어요! 👏👏👏', 3000); this.g.sfx?.('done'); }
    else hud.toast('공연을 그만 봤어요', 1800);
    const r = this._resolve; this._resolve = null;
    r?.(full);
  }

  // ---------------------------------------------------------------- coin wish
  wish() {
    const s = this.g.state, hud = this.g.hud;
    if (this.coin) return Promise.resolve(false);
    if ((s.money ?? 0) < 100) { hud.toast('동전이 없어요… 돈을 모아서 다시 와요 🪙', 2400); return Promise.resolve(false); }
    s.money -= 100;
    this.g.sfx?.('coin');
    const a = Math.random() * PI * 2, r = 2.0 + Math.random() * 2.4;
    const local = new THREE.Vector3(Math.cos(a) * r, WATER_Y, Math.sin(a) * r);
    const to = this.water.group.localToWorld(local.clone());
    const cam = this.g.engine.camera;
    const from = cam.position.clone().add(new THREE.Vector3(0, -0.2, 0)).addScaledVector(cam.getWorldDirection(new THREE.Vector3()), 0.5);
    this.coin = { from, to, local, t: 0 };
    this.flyer.visible = true;
    this.g.day?.g?.save?.();
    return new Promise((resolve) => { this.coin.done = resolve; });
  }
  updateCoin(dt) {
    const c = this.coin;
    if (!c) return;
    c.t += dt / 0.8;
    const k = Math.min(1, c.t);
    this.flyer.position.lerpVectors(c.from, c.to, k);
    this.flyer.position.y += Math.sin(k * PI) * 1.3;
    this.flyer.rotation.x += dt * 18; this.flyer.rotation.z += dt * 7;
    if (k >= 1) {
      this.flyer.visible = false;
      this.water.splash(c.local.x, c.local.z);
      this.ensureMusic()?.plop();
      const m = new THREE.Matrix4().compose(new THREE.Vector3(c.local.x, 0.035, c.local.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05, Math.random() * 6, 0.04)), new THREE.Vector3(1, 1, 1));
      this.coins.setMatrixAt(this.coinN % 48, m);
      this.coinN++;
      this.coins.count = Math.min(48, this.coinN);
      this.coins.instanceMatrix.needsUpdate = true;
      this.g.hud.toast(WISHES[Math.floor(Math.random() * WISHES.length)], 2600);
      const done = c.done; this.coin = null; done?.(true);
    }
  }

  // ---------------------------------------------------------------- frame
  update(dt) {
    if (!this.site) return;
    this.t += dt;
    const g = this.g, s = g.state, cam = g.engine.camera;
    const dist = cam.position.distanceTo(this.stageCenter);
    this.notices(dt);
    this.updateCoin(dt);
    // schedule: band and crowd from 18:45, songs 19:00–21:00 with a short break between
    const sched = this.scheduled();
    if (this.gathering() || this.forced || this.watching) { if (!this.present) this.arrive(false); }
    else if (this.present) this.leave();
    if (!this.playing && sched && !this.watching && !this.forced) {
      if (this.showT < 0 && this.waitT > 0) this.waitT -= dt;
      else this.begin(0);
    }
    if (this.playing) {
      const m = this.music;
      if (m && m.running && m.playing) this.showT = m.time; else this.showT += dt;
      if (this.showT >= LENGTH) {
        this.playing = false;
        this.music?.stop();
        if (this.watching) this.finishWatch(true);
        this.forced = false;
        this.showT = -1; this.waitT = GAP;
      } else if (!sched && !this.forced && !this.watching) { this.playing = false; this.music?.stop(); this.showT = -1; }
    }
    const song = this.playing ? songAt(Math.max(0, this.showT)) : null;
    // music
    if (this.music && this.playing) {
      this.music.volume(this.watching ? 0.95 : clamp(1 - (dist - 14) / 55, 0, 1) * 0.85);
      if (dist < 85 || this.watching) this.music.pump();
    }
    // watching: time, camera, captions, leaving early
    if (this.watching) {
      if (g.engine.gtao) g.engine.gtao.enabled = false; // outdoors: the seat would switch on the costly AO pass
      this.watchT += dt;
      if (song) s.hour = Math.min(SHOW_HOUR + 2 - 0.01, this.h0 + 0.75 * clamp(this.showT / LENGTH, 0, 1));
      const se = this.seatIt.seatW;
      se.yaw = this.seatBase.yaw + Math.sin(this.watchT * 0.13) * 0.06 + (song?.section === 'water' ? 0 : 0);
      se.pitch = this.seatBase.pitch + (song?.section === 'water' || song?.section === 'end' ? 0.12 : 0) * 1 + Math.sin(this.watchT * 0.21) * 0.02;
      this.captionFor(song);
      if (this.watchT > 1 && g.input?.hit('KeyE')) this.finishWatch(false);
    }
    // what is drawn
    const near = dist < 80;
    this.root.visible = (this.present || this.crowd.some((c) => c.state !== 'away')) && near;
    if (this.site.extra.near) this.site.extra.near.visible = dist < 65;
    this.water.group.visible = dist < 260;
    if (this.water.group.visible) this.updateFountain(dt, song, cam);
    if (this.root.visible && dist < 90) this.updatePeople(dt, song);
    this.updateLights(dt, song, dist);
  }

  notices(dt) {
    const s = this.g.state, hud = this.g.hud, n = this.notice;
    if (n.day !== s.day) { n.day = s.day; n.morning = n.soon = n.start = false; n.t = 0; }
    if (!isShowDay(s.day)) return;
    const started = !document.getElementById('hud')?.classList.contains('hidden');
    if (!started || this.g.day?.busy) return;
    n.t += dt;
    if (!n.morning && s.hour < SHOW_HOUR - 0.5 && n.t > 4.5) { n.morning = true; hud.toast(`오늘 저녁 ${SHOW_HOUR - 12}시 분수 광장에서 공연이 있어요! 🎤`, 4200); }
    if (!n.soon && s.hour >= SHOW_HOUR - 0.5 && s.hour < SHOW_HOUR) { n.soon = true; n.morning = true; hud.toast('곧 분수 광장에서 공연이 시작해요! 🎶 늦지 않게 가요', 3600); }
    if (!n.start && s.hour >= SHOW_HOUR && s.hour < SHOW_HOUR + 1.5) { n.start = n.soon = n.morning = true; hud.toast('분수 광장에서 공연이 시작됐어요! 🎤 앞쪽 벤치에서 E로 봐요', 3800); }
  }

  captionFor(song) {
    const el = this.caption;
    if (!song) { el.style.display = 'none'; return; }
    const sec = SECTIONS[song.index];
    let text = '';
    if (sec.name === 'intro') text = '🎤 금요 분수 콘서트 시작!';
    else if (sec.name === 'water') text = '💦 음악 분수 쇼 💦';
    else if (sec.name === 'end') text = '고마워요, 세온 동네! 💖';
    else if (sec.name === 'bow') text = '👏 👏 👏';
    else if (sec.lyric != null) text = `♪ ${LYRICS[sec.lyric + (song.barIn >= 4 ? 1 : 0)]}`;
    if (el.textContent !== text) el.textContent = text;
    el.style.display = text ? 'block' : 'none';
  }

  // ---------------------------------------------------------------- fountain choreography
  updateFountain(dt, song, cam) {
    const w = this.water, sky = this.g.sky;
    const night = 1 - sky.daylight;
    if (!song) w.normal(w.t, night);
    else this.choreo(song);
    const sunDirView = (sky.lightDir ?? new THREE.Vector3(0, 1, 0)).clone().transformDirection(cam.matrixWorldInverse);
    const env = fountainEnv({ daylight: sky.daylight, sunDirView, sun: sky.sun, hemi: sky.hemi, camera: cam, renderer: this.g.engine.renderer });
    if (song) env.glow = Math.max(env.glow, 0.45);
    w.update(dt, env);
  }

  choreo(s) {
    const w = this.water, J = w.jets, col = this.col;
    const ph = s.beat % 1, pulse = Math.exp(-ph * 5), b = s.beatF, sec = s.section;
    let ring = 0;
    for (let i = 0; i < J.length; i++) {
      const j = J[i];
      if (j.kind === 'ring') {
        const k = ring++, a = (k / N_RING) * PI * 2;
        let H = 0.3, R = 0, on = 1;
        if (sec === 'intro') { on = s.barIn === 0 ? 0.25 : 1; H = s.barIn === 0 ? 0.15 : 0.2 + 3.2 * sstep(k * 0.22, k * 0.22 + 0.8, s.beat); }
        else if (sec === 'verse') H = 1.0 + 1.6 * pulse * ((k + Math.floor(b)) % 2 ? 1 : 0.35) + 0.4 * Math.sin(a * 2 + b * 0.5);
        else if (sec === 'chorus') { H = 2.2 + 1.8 * (0.5 + 0.5 * Math.sin(a * 2 - b * PI / 2)) + 1.0 * pulse; R = 0.9 * Math.sin(b * PI / 2 + a); }
        else if (sec === 'water') { const head = (b * 2) % N_RING, d = Math.min(Math.abs(k - head), N_RING - Math.abs(k - head)); H = 0.5 + 6.0 * Math.exp(-d * d * 0.35); }
        else if (sec === 'final') { H = 3.4 + 2.4 * (0.5 + 0.5 * Math.sin(a * 3 - b * PI)) + 1.4 * pulse; R = 1.4 * Math.sin(b * PI / 2 + a * 2); }
        else if (sec === 'end') H = 0.4 + 7 * Math.exp(-s.beat * 0.55);
        else H = 0.3 + 0.08 * Math.sin(this.t * 1.3 + k);
        j.H = H; j.on = on;
        const base = j.base;
        if (Math.abs(R) > 0.05) { const sg = Math.sign(R); j.dir[0] = -base[1] * sg; j.dir[1] = base[0] * sg; j.R = Math.abs(R); }
        else { j.dir[0] = base[0]; j.dir[1] = base[1]; j.R = 0; }
        j.spread = H > 2 ? 0.14 : 0.2;
        paletteAt(s, k, j.color);
      } else if (j.kind === 'arc') {
        const on = sec === 'intro' ? 0 : sec === 'water' ? ((Math.floor(b) + i) % 2 ? 1 : 0.15) : sec === 'bow' || sec === 'verse' || sec === 'end' ? 1 : 1;
        j.on = lerp(j.on, on, 0.25);
        j.H = sec === 'chorus' || sec === 'final' ? 1.9 + 0.3 * pulse : 1.55;
        j.R = 2.2;
        paletteAt(s, i + 3, j.color);
      } else {
        let H = 2.7;
        if (sec === 'intro') H = 0.4 + 2.5 * sstep(0, 8, s.beat);
        else if (sec === 'verse') H = 3 + 0.8 * pulse;
        else if (sec === 'chorus') H = 4.2 + (s.beat < 1 ? 2.2 * (1 - ph) : 0) + pulse;
        else if (sec === 'water') H = 2.5 + 3.5 * pulse;
        else if (sec === 'final') H = 6 + (s.beat < 1 ? 3 * (1 - ph) : 0) + 1.2 * pulse;
        else if (sec === 'end') H = 1 + 9.5 * Math.exp(-s.beat * 0.45);
        j.H = H; j.on = 1;
        paletteAt(s, 5, j.color);
      }
    }
    w.flow = sec === 'intro' && s.barIn === 0 ? 0.4 : 1;
    w.lightCol.forEach((c, i) => { if (i < N_RING) c.copy(J[N_ARC + i].color); else paletteAt(s, i * 3, c); });
    paletteAt(s, 9, col);
    w.curtainMat.uniforms.uCol.value.copy(col);
  }

  // ---------------------------------------------------------------- stage lights
  updateLights(dt, song, dist) {
    const st = this.stage, sky = this.g.sky, night = 1 - sky.daylight;
    const dark = clamp((0.9 - sky.daylight) * 1.6, 0, 1);
    const pool = this.g.lights;
    const on = !!song && dist < 70;
    if (!on) {
      for (const h of st.heads) { h.beam.visible = false; h.lensM.emissiveIntensity = 0; h.pan.rotation.y *= 0.95; h.tilt.rotation.x = lerp(h.tilt.rotation.x, 0.9, 0.05); }
      st.ledM.emissive.setHSL((this.t * 0.02) % 1, 0.6, 0.5); st.ledM.emissiveIntensity = 0.3 + 1.2 * night;
      st.upM.emissiveIntensity = 0;
      for (const m of st.parM) m.emissiveIntensity = 0;
      if (this.stolen) this.releaseLights();
      return;
    }
    const s = song, ph = s.beat % 1, pulse = Math.exp(-ph * 4), sec = s.section, t = this.t;
    const fc = this.fc;
    st.heads.forEach((h, i) => {
      const side = h.side;
      let target;
      if (sec === 'intro') target = [side * 2 * Math.sin(t * 0.7), 0.6, 4.5];
      else if (sec === 'verse') target = [Math.sin(t * 0.6 + i) * 3, 0.6, 4.5 + Math.cos(t * 0.5 + i)];
      else if (sec === 'chorus') target = [side * (4 + 6 * Math.sin(s.beatF * PI / 4 + i)), 18, -6 + 10 * Math.cos(s.beatF * PI / 8 + i)];
      else if (sec === 'water') target = [fc[0] + Math.sin(t * 0.9 + i * 1.6) * 3, 3 + 3 * Math.sin(t * 0.7 + i), fc[2] + Math.cos(t * 0.8 + i) * 2];
      else if (sec === 'final') target = [side * (3 + 8 * Math.sin(s.beatF * PI / 2 + i * 0.7)), 14 + 6 * Math.sin(s.beatF * PI / 4), -4 + 8 * Math.cos(s.beatF * PI / 2 + i)];
      else if (sec === 'end') target = [side * 1.5, 30, -2];
      else target = [0, 0.6, 7];
      const hp = new THREE.Vector3(h.x, 5.45, 3.1);
      const d = new THREE.Vector3(...target).sub(hp);
      const pan = Math.atan2(d.x, d.z) - h.base.rotation.y, tilt = Math.atan2(-d.y, Math.hypot(d.x, d.z));
      h.pan.rotation.y = lerp(h.pan.rotation.y, pan, Math.min(1, dt * 4));
      h.tilt.rotation.x = lerp(h.tilt.rotation.x, tilt, Math.min(1, dt * 4));
      paletteAt(s, i * 4 + 1, h.beam.material.uniforms.uCol.value);
      let I = { intro: 0.5, verse: 0.55, chorus: 1, water: 0.8, final: 1.1, end: 1.3, bow: 0.4 }[sec] ?? 0.5;
      if (sec === 'final' && ph < 0.12) I *= 1.6;
      h.beam.material.uniforms.uI.value = I * dark;
      h.beam.material.uniforms.uTime.value = t;
      h.beam.visible = dark > 0.02;
      h.lensM.emissive.copy(h.beam.material.uniforms.uCol.value);
      h.lensM.emissiveIntensity = 3 + 4 * I;
    });
    paletteAt(s, 2, this.col);
    st.ledM.emissive.copy(this.col); st.ledM.emissiveIntensity = 1.5 + 3 * pulse;
    st.upM.emissive.copy(this.col); st.upM.emissiveIntensity = sec === 'water' ? 1 : 3 + 3 * pulse;
    for (const m of st.parM) { m.emissive.setHSL((s.barF * 0.1) % 1, 0.7, 0.6); m.emissiveIntensity = 3 + 2 * pulse; }
    // borrow two real lights from the pool: a coloured wash on the stage and one in the fountain
    if (pool?.lights?.length && dist < 60) {
      const want = this.g.engine.quality === 'high' ? 2 : 1;
      this.stolen = pool.lights.slice(0, want);
      const wash = new THREE.Vector3(...xform(this.site, [0, 5.4, 7.0])), fl = new THREE.Vector3(...xform(this.site, [this.fc[0], 4.5, this.fc[2] + 1]));
      const L0 = this.stolen[0];
      L0.position.copy(wash); L0.color.copy(this.col).lerp(new THREE.Color(1, 0.92, 0.85), 0.6); L0.distance = 12; L0.intensity = (26 + 12 * pulse) * (0.4 + 0.6 * dark);
      if (this.stolen[1]) { const L1 = this.stolen[1]; L1.position.copy(fl); paletteAt(s, 6, L1.color); L1.distance = 14; L1.intensity = (sec === 'water' || sec === 'end' ? 22 : 12) * (0.3 + 0.7 * dark); }
    } else if (this.stolen) this.releaseLights();
  }
  releaseLights() {
    for (const l of this.stolen ?? []) { l.userData.target = null; l.userData.level = 0; l.intensity = 0; }
    this.stolen = null;
  }

  // ---------------------------------------------------------------- people
  updatePeople(dt, song) {
    const s = song, t = this.t;
    const beatF = s ? s.beatF : t * 2, ph = beatF % 1, sec = s?.section ?? 'idle';
    const big = sec === 'chorus' || sec === 'final';
    // band
    for (const c of this.cast) {
      const ch = c.ch, B = ch.bones, gp = ch.group;
      gp.position.copy(c.base);
      gp.rotation.y = c.yaw;
      const bowK = sec === 'bow' ? sstep(0, 1.2, s.beat + s.barIn * 4) * (1 - sstep(8, 10, s.beat + s.barIn * 4)) : 0;
      if (c.role === 'drums') ch.update(dt, { mode: 'sit', seat: 0.5 });
      else ch.update(dt, { mode: 'idle' });
      if (!s) { if (c.role === 'singer') micPose(B, 0.15); if (c.role === 'guitar') { B.shoulderL.rotation.x = 0.8; B.shoulderL.rotation.z = -0.55; B.elbowL.rotation.x = 1.1; B.shoulderR.rotation.x = 0.4; B.elbowR.rotation.x = 1.3; B.shoulderR.rotation.z = -0.2; } continue; }
      const sway = Math.sin(beatF * PI / 2);
      B.head.rotation.x = 0.07 * Math.sin(beatF * PI * 2);
      B.head.rotation.y = 0;
      if (c.role === 'singer') {
        const singing = sec === 'verse' || big;
        micPose(B, singing ? 1 : sec === 'end' ? 0.6 : 0.2);
        B.hips.rotation.y = 0.12 * sway;
        gp.position.x += 0.12 * sway;
        if (singing) { B.shoulderL.rotation.x = 0.45; B.shoulderL.rotation.z = -0.35 - 0.45 * (0.5 + 0.5 * Math.sin(t * 1.3)); B.elbowL.rotation.x = 0.5; }
        if (sec === 'water') { B.shoulderL.rotation.z = -1.2 - 0.3 * Math.sin(t * 2); B.shoulderR.rotation.z = 1.2 + 0.3 * Math.sin(t * 2); B.elbowR.rotation.x = 0.3; B.elbowR.rotation.y = 0; B.shoulderR.rotation.x = 0.1; }
        if (sec === 'end') { B.shoulderL.rotation.z = -2.6; B.elbowL.rotation.x = 0.2; }
      } else if (c.role === 'dancer') {
        const sd = c.side;
        if (sec === 'intro') { B.shoulderL.rotation.z = -0.3; B.shoulderR.rotation.z = 0.3; }
        else if (sec === 'verse') {
          const up = Math.floor(beatF) % 2 === (sd > 0 ? 0 : 1);
          B.shoulderR.rotation.z = up ? 2.4 : 0.35; B.shoulderL.rotation.z = up ? -0.35 : -2.4;
          B.elbowR.rotation.x = up ? 0.1 : 1.4; B.elbowL.rotation.x = up ? 1.4 : 0.1;
          gp.position.x += 0.28 * Math.sin(beatF * PI / 2);
          B.hips.position.y -= 0.05 * Math.abs(Math.sin(beatF * PI));
          B.kneeL.rotation.x = -0.25 * Math.abs(Math.sin(beatF * PI)); B.kneeR.rotation.x = B.kneeL.rotation.x; B.thighL.rotation.x = 0.12 * Math.abs(Math.sin(beatF * PI)); B.thighR.rotation.x = B.thighL.rotation.x;
        } else if (big) {
          const beat = Math.floor(s.beat);
          cheerPose(B, t, 1, sd);
          B.shoulderL.rotation.z = -2.3 - 0.35 * Math.sin(beatF * PI); B.shoulderR.rotation.z = 2.3 - 0.35 * Math.sin(beatF * PI);
          if (beat % 2 === 0) gp.position.y += 0.2 * Math.sin(ph * PI);
          if ((s.barIn === 3 || s.barIn === 7) && s.beat >= 3) gp.rotation.y += sd * PI * 2 * sstep(3, 4, s.beat);
          if (sec === 'final') clapPose(B, ph * 2 % 1, 1);
        } else if (sec === 'water') {
          B.shoulderL.rotation.z = -1.3 - 0.4 * Math.sin(t * 2 + sd); B.shoulderR.rotation.z = 1.3 - 0.4 * Math.sin(t * 2 + sd + 1);
          gp.rotation.y += Math.sin(t * 0.8) * 0.5;
        } else if (sec === 'end') { B.shoulderR.rotation.z = sd > 0 ? 2.6 : 0.3; B.shoulderL.rotation.z = sd > 0 ? -0.3 : -2.6; }
      } else if (c.role === 'guitar') {
        B.shoulderL.rotation.x = 0.8; B.shoulderL.rotation.z = -0.55; B.elbowL.rotation.x = 1.1; B.elbowL.rotation.y = -0.2;
        const strum = sec === 'water' ? Math.sin(beatF * PI) : Math.sin(beatF * PI * 2);
        B.shoulderR.rotation.x = 0.4; B.shoulderR.rotation.z = -0.22; B.elbowR.rotation.x = 1.3 + 0.3 * strum; B.handR.rotation.x = 0.2 * strum;
        if (big) B.spine.rotation.x = 0.06 * Math.sin(beatF * PI);
      } else if (c.role === 'keys') {
        const tap = Math.max(0, Math.sin(beatF * PI * 4));
        for (const [sd, l] of [[-1, 'L'], [1, 'R']]) {
          B['shoulder' + l].rotation.x = 0.62; B['shoulder' + l].rotation.z = -sd * 0.2; B['elbow' + l].rotation.x = 1.05; B['elbow' + l].rotation.y = sd * 0.35;
          B['hand' + l].rotation.x = -0.3 + 0.25 * (l === 'L' ? tap : 1 - tap);
        }
        B.spine.rotation.x = -0.08;
      } else if (c.role === 'drums') {
        const hitR = Math.exp(-((beatF * 2) % 1) * 7), hitL = Math.floor(beatF) % 2 ? Math.exp(-ph * 7) : 0;
        B.shoulderR.rotation.x = 0.55 + 0.35 * (1 - hitR); B.elbowR.rotation.x = 0.9 + 0.3 * (1 - hitR); B.shoulderR.rotation.z = -0.15;
        B.shoulderL.rotation.x = 0.5 + 0.3 * (1 - hitL); B.elbowL.rotation.x = 0.95 + 0.3 * (1 - hitL); B.shoulderL.rotation.z = 0.25;
        if (sec === 'water' || sec === 'intro' || sec === 'bow') { B.shoulderR.rotation.x = 0.45; B.shoulderL.rotation.x = 0.45; }
      }
      if (bowK > 0) bowPose(B, bowK);
    }
    // crowd
    for (const c of this.crowd) {
      const ch = c.ch, gp = ch.group;
      if (c.state === 'away') { gp.visible = false; continue; }
      gp.visible = true;
      if (c.state === 'walk' || c.state === 'leave') {
        if (c.wait > 0) { c.wait -= dt; if (c.state === 'walk') { gp.visible = false; continue; } }
        const target = c.state === 'walk' ? c.spot : c.from;
        const d = target.clone().sub(c.pos);
        const len = Math.hypot(d.x, d.z);
        if (len < 0.08) {
          if (c.state === 'walk') { c.state = 'here'; c.pos.copy(c.spot); }
          else { c.state = 'away'; gp.visible = false; continue; }
        } else {
          const sp = Math.min(len, 1.35 * dt);
          c.pos.x += d.x / len * sp; c.pos.z += d.z / len * sp;
          gp.position.copy(c.pos);
          gp.rotation.y = Math.atan2(-d.x, -d.z);
          ch.update(dt, { speed: 1.35, mode: 'walk' });
          continue;
        }
      }
      gp.position.copy(c.pos);
      gp.rotation.y = c.kind === 'b' ? 0 : c.yaw;
      const sit = c.kind === 'b';
      ch.update(dt, { mode: sit ? 'sit' : 'idle', seat: 0.45 });
      if (!s) continue;
      const B = ch.bones, my = (beatF + c.seed * 0.05) % 1;
      B.head.rotation.y = 0;
      if (sec === 'water') { B.head.rotation.x = -0.18; if (c.react === 0) cheerPose(B, t, 0.7, c.seed); continue; }
      if (sec === 'bow' || sec === 'end') {
        if (c.react % 2) cheerPose(B, t, 1, c.seed); else clapPose(B, (t * 3 + c.seed) % 1, 1);
        if (c.kind === 'k') gp.position.y += 0.18 * Math.abs(Math.sin(t * 6 + c.seed));
        continue;
      }
      if (big) {
        if (c.react < 3) clapPose(B, my, 1);
        else if (c.react === 3) { cheerPose(B, t, 1, c.seed); B.shoulderL.rotation.z += 0.3 * Math.sin(beatF * PI); }
        if (c.kind === 'k' && !sit) gp.position.y += 0.12 * Math.abs(Math.sin(beatF * PI));
      } else {
        if (!sit) { B.hips.rotation.y = 0.06 * Math.sin(beatF * PI / 2 + c.seed); gp.position.x += 0.04 * Math.sin(beatF * PI / 2 + c.seed); }
        B.head.rotation.x = 0.06 * Math.sin(beatF * PI * 2 + c.seed);
        if (c.react === 4 && sec === 'verse') clapPose(B, my, 0.9);
      }
    }
  }
}
