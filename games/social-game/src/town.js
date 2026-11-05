// 같이 사는 동네 (shared town): joins a persistent World on the shared net server
// (packages/net/world.mjs), shows the town's blocks and broken props instead of the solo ones,
// draws other players, and runs the chat with block / report buttons.
// Personal things (story, clock, quests, inventory, money) stay in the personal save as before.
// Pure rules (cell keys, poses, privacy, solo block keeping) are in ../online.mjs.
import * as THREE from 'three';
import { World } from '../../../packages/net/world.mjs';
import { Social } from '../../../packages/net/index.mjs';
import {
  GAME, TOWNS, townId, townName, blockKey, parseBlockKey, buildKeyOf, blockValue, parseBlockValue,
  propKey, parsePropKey, PROP_TTL, packPose, unpackPose, samePose, HIDDEN, lerpAngle, follow, SNAP_DIST,
  isPrivate, lookFor, SoloBlocks, TEXT, placeErrorText,
} from '../online.mjs';
import { xbox } from './places.js';

const $ = (id) => document.getElementById(id);
const POSE_EVERY = 0.1;     // seconds (10 per second)
const PENDING_MS = 6000;    // a placed block the server never answered is taken back
const DRAW_RANGE = 160;     // metres: other players further away are not drawn
const MAX_LINES = 50;

function nameTag(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = '34px Jua, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = Math.min(248, g.measureText(text).width + 28);
  g.fillStyle = 'rgba(28, 26, 34, 0.62)';
  g.beginPath(); g.roundRect(128 - w / 2, 8, w, 48, 20); g.fill();
  g.fillStyle = '#fffaf0'; g.fillText(text, 128, 33);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(1.6, 0.4, 1);
  s.renderOrder = 5;
  return s;
}

export class Town {
  /**
   * g: { engine, build, places, player, vehicle, hud, cloud, input, colliders, breakables, props,
   *      state, flight, openLogin, ensureStarted() → true when the game is running }
   */
  constructor(g) {
    this.g = g;
    this.world = null;
    this.live = false;          // town blocks and props are on screen
    this.townKey = null;
    this.busy = false;
    this.solo = new SoloBlocks();
    this.soloBroken = [];
    this.pending = new Map();   // town key → { rec, id, t }
    this.remotes = new Map();   // peer id → remote player
    this.blocked = new Set();   // user ids blocked on this computer during this session
    this.lines = [];
    this.social = null;
    this.poseT = 0; this.poseIdle = 0; this.lastPose = null; this.checkT = 0;
    this.propsByKey = new Map();
    for (const e of g.breakables) if (e.key) this.propsByKey.set(e.key, e);
    const home = g.places.sites.home;
    this.homeBox = home ? xbox(home, { min: [-home.footprint.w / 2, -5, -home.footprint.d / 2], max: [home.footprint.w / 2, 100, home.footprint.d / 2] }) : null;
    this.setupUi();
  }

  get me() { return this.world?.user?.id ?? null; }
  get inv() { return this.g.state.inventory; }

  // ------------------------------------------------------------------ joining and leaving
  openPicker() {
    if (!this.g.cloud.loggedIn) { this.g.openLogin(); $('login-err').textContent = TEXT.needLogin; return; }
    $('town-pick-msg').textContent = this.live ? `지금 ${townName(this.townKey)}에 있어요` : '';
    for (const b of document.querySelectorAll('#town-pick .town-ch')) b.classList.toggle('on', TOWNS[b.dataset.n - 1] === this.townKey && this.live);
    $('town-pick').classList.remove('hidden');
    this.g.input.enabled = false;
    document.exitPointerLock?.();
  }
  closePicker() { $('town-pick').classList.add('hidden'); this.g.input.enabled = true; }

  pick(n) {
    this.closePicker();
    if (!this.g.ensureStarted()) {
      // a brand-new game first picks its story (the page reloads), then joins
      try { sessionStorage.setItem('sg-town', String(n)); } catch { /* blocked */ }
      $('who').textContent = `이야기를 고르면 ${townName(townId(n))}에 들어가요`;
      return;
    }
    this.join(n);
  }

  async join(n) {
    const id = townId(n);
    if (!id || this.busy) return;
    if (!this.g.cloud.loggedIn) { this.openPicker(); return; }
    if (this.world || this.live) this.leave(true);
    this.hideLost();
    this.busy = true;
    const name = townName(id);
    const hud = this.g.hud;
    hud.toast(TEXT.joining(name), 1500);
    let world = null;
    world = new World({
      status: (s, msg) => { if (world === this.world && s === 'error' && this.live) this.lost(msg); },
      join: (pid, user) => { if (world === this.world) this.addRemote(pid, user); },
      leave: (pid) => { if (world === this.world) this.removeRemote(pid, true); },
      pose: (pid, d) => { if (world === this.world) this.remotePose(pid, d); },
      cell: (k, entry) => { if (world === this.world && this.live) this.applyCell(k, entry); },
      message: (data, from) => { if (world === this.world) this.received(data, from); },
      error: (code, k) => { if (world === this.world) this.serverError(code, k); },
    }, { game: GAME, world: id, server: this.g.cloud.server });
    this.world = world;
    this.townKey = id;
    try {
      const ticket = await this.g.cloud.account.ticket();
      if (world !== this.world) return;
      await world.open(ticket);
      if (world !== this.world || !world.ready) return; // left while connecting
      this.goLive();
      hud.toast(TEXT.joined(name, world.peers.size), 2600);
      this.loadBlocked();
    } catch (e) {
      if (world === this.world) { this.world = null; this.clearRemotes(); }
      const code = e?.code;
      if (code === 'full') { hud.toast(TEXT.full(name), 3400); this.openPicker(); $('town-pick-msg').textContent = TEXT.full(name); }
      else if (code === 'not-deployed') hud.toast(TEXT.notDeployed, 3400);
      else if (code === 'join-rate') hud.toast(TEXT.joinRate, 3000);
      else if (code === 'no-world') hud.toast(TEXT.noWorld, 3000);
      else hud.toast(e?.message && !/^[a-z-]+$/.test(e.message) ? e.message : '동네에 못 들어갔어요. 인터넷을 확인해 봐요', 3000);
    } finally { this.busy = false; }
  }

  /** Back to solo (button, logout, or before joining another town). */
  leave(quiet = false) {
    const w = this.world;
    this.world = null;
    w?.close();
    const was = this.live;
    if (this.live) this.goSolo();
    this.clearRemotes();
    this.hideLost();
    if (was && !quiet) this.g.hud.toast(TEXT.left, 2000);
  }

  lost(message) {
    const n = TOWNS.indexOf(this.townKey) + 1;
    this.world = null;
    if (this.live) this.goSolo();
    this.clearRemotes();
    $('town-lost-text').textContent = message || TEXT.lost;
    $('town-lost').classList.remove('hidden');
    $('town-retry').onclick = () => this.join(n);
    this.g.hud.toast(TEXT.lost, 2600);
  }
  hideLost() { $('town-lost').classList.add('hidden'); }

  /** The town's cells replace the solo blocks and props on screen. */
  goLive() {
    const b = this.g.build;
    this.live = true;
    this.solo.enter(b.dump());
    for (const rec of [...b.placed.values()]) b.removeBlock(rec, false);
    this.soloBroken = this.g.breakables.filter((e) => e.broken);
    for (const e of this.soloBroken) this.showProp(e);
    b.snapY = true;
    b.canBreak = (e) => this.canBreak(e);
    b.onPlaced = (rec) => this.placed(rec);
    b.onBlockBroken = (rec) => this.brokeBlock(rec);
    for (const [k, entry] of this.world.cells) this.applyCell(k, entry);
    b.renderHotbar();
    this.lines = [];
    this.renderChat();
    $('town-panel').classList.remove('hidden');
    $('town-chat').classList.remove('hidden');
    $('btn-town').textContent = '🏘️ 동네';
    this.lastPose = null;
    this.refreshPeople();
  }

  /** Puts the solo blocks and props back exactly as they were. */
  goSolo() {
    const b = this.g.build;
    this.live = false;
    b.canBreak = b.onPlaced = b.onBlockBroken = null;
    b.snapY = false;
    for (const rec of [...b.placed.values()]) b.removeBlock(rec, false);
    for (const p of this.solo.leave()) b.placeBlock(p.id, p.x, p.y, p.z, p.rot ?? 0, false);
    for (const e of this.g.breakables) if (e.broken) this.showProp(e);
    for (const e of this.soloBroken) this.hideProp(e);
    this.soloBroken = [];
    this.pending.clear();
    b.renderHotbar();
    this.closeChat();
    $('town-panel').classList.add('hidden');
    $('town-chat').classList.add('hidden');
    $('btn-town').textContent = '🏘️ 같이 하기';
  }

  // ------------------------------------------------------------------ blocks and props
  applyCell(k, entry) {
    const b = this.g.build;
    if (k.startsWith('b|')) {
      const pos = parseBlockKey(k);
      if (!pos) return;
      const rec = b.placed.get(buildKeyOf(k));
      if (!entry) { if (rec) b.removeBlock(rec, false); return; }
      const v = parseBlockValue(entry.v, b.byId);
      if (!v) return;
      const mine = entry.owner?.id === this.me;
      if (mine) this.pending.delete(k);
      if (rec && rec.id === v.id && rec.rot === v.rot && (mine || !this.pending.has(k))) { rec.owner = entry.owner; return; }
      if (rec) b.removeBlock(rec, false);
      const nr = b.placeBlock(v.id, pos.x, pos.y, pos.z, v.rot, false);
      if (nr) nr.owner = entry.owner;
    } else if (k.startsWith('p|')) {
      const e = this.propsByKey.get(parsePropKey(k));
      if (!e) return;
      if (entry) this.hideProp(e); else this.showProp(e);
    }
  }

  canBreak(e) {
    if (e.kind !== 'block') return null;
    const o = e.rec.owner;
    return o && o.id !== this.me ? TEXT.notMine(o.nickname) : null;
  }

  placed(rec) {
    const k = blockKey(rec.x, rec.y, rec.z);
    if (!k || !this.world?.set(k, blockValue(rec.id, rec.rot))) { this.takeBack({ rec, id: rec.id }, TEXT.failed); return; }
    this.pending.set(k, { rec, id: rec.id, t: performance.now() });
  }

  /** A placed block did not make it: remove it (unless it is now someone else's) and refund it. */
  takeBack(p, text, k = blockKey(p.rec.x, p.rec.y, p.rec.z)) {
    const b = this.g.build;
    const cell = this.world?.cells.get(k);
    if (b.placed.get(buildKeyOf(k)) === p.rec && !(cell && cell.owner?.id !== this.me)) b.removeBlock(p.rec, false);
    this.inv[p.id] = (this.inv[p.id] ?? 0) + 1;
    b.renderHotbar();
    if (text) this.g.hud.toast(text, 1800);
  }

  brokeBlock(rec) {
    const k = blockKey(rec.x, rec.y, rec.z);
    if (!k) return;
    this.pending.delete(k);
    if (this.world?.del(k)) return;
    // not sent: put it back and take the item back, so nothing is doubled
    const nr = this.g.build.placeBlock(rec.id, rec.x, rec.y, rec.z, rec.rot, false);
    if (nr) nr.owner = rec.owner;
    this.inv[rec.id] = Math.max(0, (this.inv[rec.id] ?? 0) - 1);
    this.g.build.renderHotbar();
    this.g.hud.toast(TEXT.failed, 1500);
  }

  /** Called after the game gave the items for a broken prop. */
  propBroken(e) {
    if (!this.live || !e.key) return;
    const k = propKey(e.key);
    if (k) this.world?.set(k, 1, { ttl: PROP_TTL });
  }
  /** The morning regrow skips props the town still marks broken. */
  holdsProp(e) { return this.live && !!e.key && !!this.world?.cells.has(propKey(e.key)); }

  showProp(e) {
    if (!e.broken) return;
    e.broken = false;
    e.scatter?.setVisible(e.index, true);
    this.g.build.addProp(e);
    if (e.col) this.g.colliders.add(e.col);
  }
  hideProp(e) {
    if (e.broken) return;
    e.broken = true;
    e.scatter?.setVisible(e.index, false);
    this.g.build.removeProp(e);
  }

  serverError(code, k) {
    if (code === 'chat-rate') { this.g.hud.toast(TEXT.chatRate, 1400); return; }
    if (typeof k !== 'string') return;
    if (k.startsWith('p|')) {
      // breaking a tree was refused (rate, limit...): the server never marked it, so let it grow back here too
      const e = this.propsByKey.get(parsePropKey(k));
      if (e && !this.world?.cells.has(k)) this.showProp(e);
      return;
    }
    if (!k.startsWith('b|')) return;
    const p = this.pending.get(k);
    if (p) { this.pending.delete(k); this.takeBack(p, placeErrorText(code) ?? TEXT.failed, k); return; }
    if (code !== 'missing' && this.world?.cells.has(k)) {
      // breaking was refused (not-owner, rate, limit-day): show the block again and take the refund back
      const text = placeErrorText(code);
      if (text) this.g.hud.toast(text, 1800);
      const cell = this.world?.cells.get(k);
      if (cell) {
        this.applyCell(k, cell);
        const v = parseBlockValue(cell.v, this.g.build.byId);
        if (v) this.inv[v.id] = Math.max(0, (this.inv[v.id] ?? 0) - 1);
        this.g.build.renderHotbar();
      }
    }
  }

  // ------------------------------------------------------------------ other players
  addRemote(pid, user) {
    const old = this.remotes.get(pid);
    if (old) { old.user = user; this.refreshPeople(); return; }
    const scene = this.g.engine.scene;
    const look = lookFor(user?.id);
    let ch = null;
    try { ch = this.g.props.character?.buildCharacter({ outfit: look.outfit, hair: look.hair, hairColor: look.hairColor, seed: look.seed }) ?? null; } catch (e) { console.warn('remote character failed', e); }
    if (ch) { ch.group.visible = false; scene.add(ch.group); }
    const tag = nameTag(user?.nickname ?? '친구');
    tag.visible = false;
    scene.add(tag);
    this.remotes.set(pid, { pid, user, look, ch, tag, car: null, target: null, pos: new THREE.Vector3(), yaw: 0, seen: false, visible: false });
    this.refreshPeople();
    if (this.live && user?.nickname) this.g.hud.toast(TEXT.hello(user.nickname), 1600);
  }

  removeRemote(pid, say = false) {
    const r = this.remotes.get(pid);
    if (!r) return;
    const scene = this.g.engine.scene;
    if (r.ch) scene.remove(r.ch.group);
    if (r.car) scene.remove(r.car.group);
    scene.remove(r.tag);
    r.tag.material.map?.dispose(); r.tag.material.dispose();
    this.remotes.delete(pid);
    this.refreshPeople();
    if (say && this.live && r.user?.nickname) this.g.hud.toast(TEXT.bye(r.user.nickname), 1600);
  }
  clearRemotes() { for (const pid of [...this.remotes.keys()]) this.removeRemote(pid); this.refreshPeople(); }

  remotePose(pid, d) {
    const r = this.remotes.get(pid);
    const p = unpackPose(d);
    if (r && p) r.target = p;
  }

  privateAt(p) { return isPrivate(this.g.places.inside(p), p, this.homeBox); }

  updateRemotes(dt) {
    const cam = this.g.engine.camera.position;
    const k = follow(dt, 12);
    for (const r of this.remotes.values()) {
      const t = r.target;
      let show = !!t && !t.hidden && !this.blocked.has(r.user?.id);
      if (show) {
        const want = new THREE.Vector3(t.x, t.y, t.z);
        if (this.privateAt(want)) show = false;
        else {
          const before = r.pos.clone();
          if (!r.seen || r.pos.distanceTo(want) > SNAP_DIST) { r.pos.copy(want); r.yaw = t.yaw; r.seen = true; }
          else { r.pos.lerp(want, k); r.yaw = lerpAngle(r.yaw, t.yaw, k); }
          r.speed = dt > 0 ? before.distanceTo(r.pos) / dt : 0;
          if (Math.hypot(r.pos.x - cam.x, r.pos.z - cam.z) > DRAW_RANGE) show = false;
        }
      }
      r.visible = show;
      const driving = show && t.mode === 'drive';
      if (driving && !r.car && this.g.props.car) {
        try { r.car = this.g.props.car.buildCar({ color: r.look.carColor, style: 'sedan' }); this.g.engine.scene.add(r.car.group); } catch (e) { console.warn('remote car failed', e); r.car = null; }
      }
      if (r.car) {
        r.car.group.visible = driving;
        if (driving) { r.car.group.position.copy(r.pos); r.car.group.rotation.set(0, r.yaw, 0); }
      }
      if (r.ch) {
        r.ch.group.visible = show && !driving;
        if (show && !driving) {
          r.ch.group.position.copy(r.pos);
          r.ch.group.rotation.y = r.yaw;
          r.ch.group.scale.setScalar(t.kid ? 0.72 : 1);
          r.ch.update?.(dt, { speed: r.speed, mode: t.mode === 'run' ? 'run' : t.mode === 'walk' || r.speed > 0.3 ? 'walk' : 'idle' });
        }
      }
      r.tag.visible = show;
      if (show) r.tag.position.set(r.pos.x, r.pos.y + (driving ? 2.0 : t.kid ? 1.6 : 2.1), r.pos.z);
    }
  }

  /** Other players for the minimap. */
  dots() {
    const out = [];
    for (const r of this.remotes.values()) if (r.visible) out.push({ x: r.pos.x, z: r.pos.z });
    return out;
  }

  sendPose(dt) {
    if ((this.poseT -= dt) > 0) return;
    this.poseT = POSE_EVERY;
    const { player, vehicle, flight, state } = this.g;
    const driving = !!vehicle?.driving;
    const at = driving ? vehicle.pos : player.pos;
    const kid = state.mode === 'kid';
    let d;
    if (flight?.active || this.privateAt(at)) d = HIDDEN.slice();
    else if (driving) d = packPose({ mode: 'drive', x: vehicle.pos.x, y: vehicle.y ?? vehicle.pos.y, z: vehicle.pos.z, yaw: vehicle.yaw, kid });
    else d = packPose({ mode: player.speed > 5 ? 'run' : player.speed > 0.3 ? 'walk' : 'idle', x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw, kid });
    this.poseIdle += POSE_EVERY;
    if (samePose(d, this.lastPose) && this.poseIdle < 1) return;
    if (this.world?.pose(d)) { this.lastPose = d; this.poseIdle = 0; }
  }

  /** Every frame. */
  update(dt) {
    if (!this.world) return;
    this.updateRemotes(dt);
    if (!this.live) return;
    this.sendPose(dt);
    const inp = this.g.input;
    if (inp.hit('KeyT') || inp.hit('Enter') || inp.hit('NumpadEnter')) this.openChat();
    if ((this.checkT -= dt) <= 0) {
      this.checkT = 1;
      const now = performance.now();
      for (const [k, p] of [...this.pending]) {
        if (now - p.t < PENDING_MS) continue;
        this.pending.delete(k);
        if (this.world.cells.get(k)?.owner?.id !== this.me) this.takeBack(p, TEXT.failed, k);
      }
    }
  }

  // ------------------------------------------------------------------ chat, block, report
  openChat() {
    const el = $('chat-input');
    if (!this.live || !el.classList.contains('hidden')) return;
    el.classList.remove('hidden');
    $('chat-hint').classList.add('hidden');
    this.g.input.enabled = false;
    document.exitPointerLock?.();
    requestAnimationFrame(() => el.focus());
  }
  closeChat(relock = false) {
    const el = $('chat-input');
    if (el.classList.contains('hidden')) return;
    el.value = '';
    el.classList.add('hidden');
    $('chat-hint').classList.remove('hidden');
    el.blur();
    this.g.input.enabled = true;
    if (relock) this.g.input.lock();
  }
  sendChat() {
    const el = $('chat-input');
    const text = el.value.trim().slice(0, 120);
    if (text && this.world?.chat(text)) this.addLine({ me: true, nick: this.world.user?.nickname ?? '나', text });
    this.closeChat(true);
  }

  received(data, from) {
    if (!data || typeof data.chat !== 'string') return;
    const user = this.world?.peers.get(from);   // the nickname comes from the server, never from data
    if (!user || this.blocked.has(user.id)) return;
    this.addLine({ user, nick: user.nickname, text: data.chat.slice(0, 200) });
  }

  addLine(line) {
    this.lines.push({ ...line, t: Date.now() });
    if (this.lines.length > MAX_LINES) this.lines.shift();
    this.renderChat();
  }

  renderChat() {
    const log = $('chat-log');
    log.innerHTML = '';
    for (const l of this.lines.slice(-6)) {
      const d = document.createElement('div');
      d.className = 'line' + (l.me ? ' me' : '');
      const n = document.createElement('b'); n.textContent = l.me ? `${l.nick} (나)` : l.nick;
      const s = document.createElement('span'); s.textContent = l.text;
      d.append(n, s);
      if (!l.me && l.user) d.append(...this.safetyButtons(l.user));
      log.appendChild(d);
    }
  }

  safetyButtons(user) {
    const block = document.createElement('button');
    block.className = 'mini'; block.textContent = '🚫 차단'; block.title = '차단하기';
    block.onclick = () => this.blockUser(user);
    const report = document.createElement('button');
    report.className = 'mini'; report.textContent = '🚨 신고'; report.title = '신고하기';
    report.onclick = () => this.reportUser(user);
    return [block, report];
  }

  refreshPeople() {
    const list = $('town-people');
    if (!list) return;
    $('town-name').textContent = townName(this.townKey);
    const people = [...this.remotes.values()].filter((r) => !this.blocked.has(r.user?.id));
    $('town-count').textContent = `${people.length + 1}명`;
    list.innerHTML = '';
    const me = document.createElement('li');
    me.textContent = `${this.world?.user?.nickname ?? this.g.cloud.nickname} (나)`;
    list.appendChild(me);
    for (const r of people) {
      const li = document.createElement('li');
      const n = document.createElement('span'); n.textContent = r.user?.nickname ?? '친구';
      li.append(n, ...(r.user ? this.safetyButtons(r.user) : []));
      list.appendChild(li);
    }
  }

  socialApi() { return (this.social ??= new Social(this.g.cloud.account)); }

  async loadBlocked() {
    try { for (const b of await this.socialApi().blocks()) this.blocked.add(b.id); this.refreshPeople(); } catch { /* not important */ }
  }

  ask({ title, text, ok, reason = false }) {
    return new Promise((resolve) => {
      $('town-ask-title').textContent = title;
      $('town-ask-text').textContent = text;
      $('town-ask-ok').textContent = ok;
      const r = $('town-ask-reason');
      r.value = '';
      r.classList.toggle('hidden', !reason);
      $('town-ask').classList.remove('hidden');
      this.g.input.enabled = false;
      document.exitPointerLock?.();
      const done = (v) => { $('town-ask').classList.add('hidden'); this.g.input.enabled = true; $('town-ask-ok').onclick = $('town-ask-cancel').onclick = null; resolve(v); };
      $('town-ask-ok').onclick = () => done({ ok: true, reason: r.value.trim().slice(0, 200) });
      $('town-ask-cancel').onclick = () => done({ ok: false });
    });
  }

  async blockUser(user) {
    if (!user?.id) return;
    const a = await this.ask({ title: '🚫 차단할까요?', text: `${user.nickname} 님을 차단하면 그 친구의 말과 모습이 안 보여요. 친구에게는 알리지 않아요.`, ok: '차단하기' });
    if (!a.ok) return;
    try {
      await this.socialApi().block(user.id);
      this.blocked.add(user.id);
      this.lines = this.lines.filter((l) => l.user?.id !== user.id);
      this.renderChat();
      this.refreshPeople();
      this.g.hud.toast(`🚫 ${user.nickname} 님을 차단했어요`, 2200);
    } catch (e) { this.g.hud.toast(e?.message || '차단하지 못했어요', 2200); }
  }

  async reportUser(user) {
    if (!user?.id) return;
    const a = await this.ask({ title: '🚨 신고할까요?', text: `${user.nickname} 님이 한 말과 행동을 어른이 확인해요. 무엇이 싫었는지 짧게 적어 줘요 (안 적어도 돼요).`, ok: '신고하기', reason: true });
    if (!a.ok) return;
    try {
      await this.socialApi().report({
        target: user.id,
        context: { kind: 'world', game: GAME, world: this.townKey },
        reason: a.reason,
        messages: this.lines.slice(-50).map((l) => ({ text: `${l.me ? '나' : l.nick}: ${l.text}` })),
      });
      this.g.hud.toast('🚨 신고했어요. 알려 줘서 고마워요!', 2400);
    } catch (e) { this.g.hud.toast(e?.message || '신고하지 못했어요', 2200); }
  }

  // ------------------------------------------------------------------ DOM
  setupUi() {
    const open = () => this.openPicker();
    $('btn-town').addEventListener('click', open);
    $('town-start').addEventListener('click', open);
    $('town-pick-close').addEventListener('click', () => this.closePicker());
    for (const b of document.querySelectorAll('#town-pick .town-ch')) b.addEventListener('click', () => this.pick(Number(b.dataset.n)));
    $('town-pick-solo').addEventListener('click', () => { this.closePicker(); this.leave(); });
    $('town-leave').addEventListener('click', () => this.leave());
    $('town-solo').addEventListener('click', () => this.hideLost());
    const el = $('chat-input');
    el.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); this.sendChat(); }
      else if (e.key === 'Escape') this.closeChat();
    });
    el.addEventListener('keyup', (e) => e.stopPropagation());
    el.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== el) this.closeChat(); }, 0));
    $('town-ask-reason').addEventListener('keydown', (e) => e.stopPropagation());
  }
}
