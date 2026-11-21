// 술래잡기 마을 (2026-11-21 인혁: "술래잡기도 만들어줘 (포탈)", "술래잡기 포탈에 들어가서 숨바꼭질도 할 수 있게 해줘")
// 🏃 술래잡기: 술래(👹)에게 닿으면 내가 술래. 새 술래는 3초 동안 숫자를 센다. 90초가 끝날 때 술래인 사람이 진다.
// 🙈 숨바꼭질: 술래가 20초 동안 눈을 감고 세는 동안 숨는다. 술래가 닿으면 "찾았다!" 그 사람도 술래 편이 된다.
//   100초 안에 다 찾으면 술래 편, 한 명이라도 끝까지 숨으면 숨은 편이 이긴다.
// 혼자면 봇과, 친구 방이면 방장이 판과 봇과 "닿았나"를 맡는다. 보내는 것은 모두 숫자 (사람 번호 = 자리 번호).
import { THREE } from './render.js';
import { Avatar } from './avatar.js';
import { TAG, TAG_MODES, touching, tagCoins, newPlayer, stepPlayer, seeded, displayName, ADJECTIVES, ANIMALS, SKINS, COLORS, rayBoxes, P } from '../core.mjs';
import { TAG_STARTS, TAG_HALF } from '../worlds.mjs';

const r2 = v => Math.round(v * 100) / 100;
const fmt = s => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;
const RED = 'rgba(224,40,70,0.88)';
const ANGLES = [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35, 1.8, -1.8, 2.4, -2.4, Math.PI];

export class Tag {
  constructor(game) {
    this.game = game;
    this.state = 'lobby';
    this.timer = TAG.LOBBY_WAIT;
    this.mode = 'tag';
    this.nextMode = 'tag';
    this.phase = 'play';      // tag: play · hide: hide(숨는 시간) → seek(찾는 시간)
    this.round = 0;
    this.t = 0;
    this.list = [];           // 이번 판 사람들 (자리 번호 = 순서)
    this.bots = [];
    this.it = new Set();      // 술래 (숨바꼭질은 찾은 사람도 술래 편)
    this.first = -1;          // 숨바꼭질 처음 술래
    this.immune = new Map();  // 방금 넘겨준 술래는 잠깐 다시 못 잡힘
    this.frozen = 0;          // 내가 숫자 세는 중 (못 움직임)
    this.lastCount = 0;
    this.sendT = 0;
    this.modeT = 0;
    this.lostT = 0;
    this.spots = game.world.def.spots ?? [];
    this.buildGrid();
    this.buildNav();
    this.makeHud();
    this.rings = [];
    this.lobbyBots(3);
  }
  get net() { return this.game.net; }
  get auth() { return !this.net.active || this.net.host; }
  get myId() { return this.net.active ? this.net.id : 'me'; }
  get mySlot() { return this.list.indexOf(this.myId); }
  get total() { return this.list.length + this.bots.length; }

  // ───── 블록 찾기 (8칸 격자) ─────
  buildGrid() {
    const C = 8, grid = new Map(), big = [];
    for (const b of this.game.world.boxes) {
      const i0 = Math.floor(b.x0 / C), i1 = Math.floor(b.x1 / C), k0 = Math.floor(b.z0 / C), k1 = Math.floor(b.z1 / C);
      if ((i1 - i0 + 1) * (k1 - k0 + 1) > 40) { big.push(b); continue; }
      for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) { const key = i * 4096 + k; if (!grid.has(key)) grid.set(key, []); grid.get(key).push(b); }
    }
    this.grid = grid; this.bigBoxes = big; this.cell = C; this.stamp = 0;
  }
  boxesIn(x0, z0, x1, z1) {
    const C = this.cell, out = [...this.bigBoxes], st = ++this.stamp;
    for (let i = Math.floor(Math.min(x0, x1) / C); i <= Math.floor(Math.max(x0, x1) / C); i++) {
      for (let k = Math.floor(Math.min(z0, z1) / C); k <= Math.floor(Math.max(z0, z1) / C); k++) {
        const l = this.grid.get(i * 4096 + k);
        if (l) for (const b of l) if (b._tst !== st) { b._tst = st; out.push(b); }
      }
    }
    return out;
  }
  // 눈에서 눈으로 보이나 (벽, 집, 상자에 가리지 않았나)
  sees(a, b) {
    const ox = a.x, oy = a.y + 2.2, oz = a.z, tx = b.x, ty = b.y + 1.5, tz = b.z;
    const dx = tx - ox, dy = ty - oy, dz = tz - oz, d = Math.hypot(dx, dy, dz) || 1;
    return rayBoxes(ox, oy, oz, dx / d, dy / d, dz / d, this.boxesIn(ox, oz, tx, tz), d) >= d - 0.4;
  }
  // 길 찾기 지도: 1칸짜리 바둑판에 막힌 칸(벽, 집, 상자, 짚, 울타리)을 표시해 둔다
  buildNav() {
    const H = TAG_HALF, N = H * 2, pad = P.R + 0.02;
    const bad = new Uint8Array(N * N);
    for (let k = 0; k < N; k++) for (let i = 0; i < N; i++) if (i === 0 || k === 0 || i === N - 1 || k === N - 1) bad[k * N + i] = 1;
    for (const b of this.game.world.boxes) {
      if (b.y1 <= 0.75 || b.y0 >= P.H + 0.2 || b.kind === 'ladder') continue;
      const i0 = Math.max(0, Math.ceil(b.x0 - pad + H - 0.5)), i1 = Math.min(N - 1, Math.floor(b.x1 + pad + H - 0.5));
      const k0 = Math.max(0, Math.ceil(b.z0 - pad + H - 0.5)), k1 = Math.min(N - 1, Math.floor(b.z1 + pad + H - 0.5));
      for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) bad[k * N + i] = 1;
    }
    this.nav = { N, bad };
  }
  cellOf(x, z) { const N = this.nav.N, i = Math.floor(x + TAG_HALF), k = Math.floor(z + TAG_HALF); return i < 0 || k < 0 || i >= N || k >= N ? -1 : k * N + i; }
  freeNear(c) {
    const { N, bad } = this.nav;
    if (c >= 0 && !bad[c]) return c;
    const ci = c % N, ck = Math.floor(c / N);
    for (let r = 1; r < 4; r++) for (let dk = -r; dk <= r; dk++) for (let di = -r; di <= r; di++) {
      const i = ci + di, k = ck + dk;
      if (i >= 0 && k >= 0 && i < N && k < N && !bad[k * N + i]) return k * N + i;
    }
    return -1;
  }
  // 몸 너비만큼 양옆도 비었나 (좁은 문을 비스듬히 지나가지 않게)
  clearLine(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az) || 1, n = Math.ceil(d / 0.3);
    const ox = (-(bz - az) / d) * 0.45, oz = ((bx - ax) / d) * 0.45;
    for (let j = 1; j < n; j++) {
      const x = ax + ((bx - ax) * j) / n, z = az + ((bz - az) * j) / n;
      for (const k of [0, 1, -1]) { const c = this.cellOf(x + ox * k, z + oz * k); if (c < 0 || this.nav.bad[c]) return false; }
    }
    return true;
  }
  // A* 로 길을 찾고, 곧게 갈 수 있는 곳은 건너뛴 점들만 돌려준다
  path(fx, fz, tx, tz) {
    const { N, bad } = this.nav, H = TAG_HALF;
    const s = this.freeNear(this.cellOf(fx, fz)), g = this.freeNear(this.cellOf(tx, tz));
    if (s < 0 || g < 0) return null;
    const cost = new Float32Array(N * N).fill(Infinity), from = new Int32Array(N * N).fill(-1), done = new Uint8Array(N * N);
    const gi = g % N, gk = Math.floor(g / N);
    const hh = c => { const dx = Math.abs((c % N) - gi), dz = Math.abs(Math.floor(c / N) - gk); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    const heap = [[hh(s), s]];
    const push = (f, c) => { heap.push([f, c]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    cost[s] = 0;
    let steps = 0;
    while (heap.length && steps++ < 12000) {
      const [, c] = pop();
      if (done[c]) continue;
      done[c] = 1;
      if (c === g) break;
      const ci = c % N, ck = Math.floor(c / N);
      for (let dk = -1; dk <= 1; dk++) for (let di = -1; di <= 1; di++) {
        if (!di && !dk) continue;
        const i = ci + di, k = ck + dk;
        if (i < 0 || k < 0 || i >= N || k >= N) continue;
        const n = k * N + i;
        if (bad[n] || done[n]) continue;
        if (di && dk && (bad[ck * N + i] || bad[k * N + ci])) continue;
        const nc = cost[c] + (di && dk ? 1.414 : 1);
        if (nc < cost[n]) { cost[n] = nc; from[n] = c; push(nc + hh(n), n); }
      }
    }
    if (from[g] < 0 && g !== s) return null;
    const cells = [];
    for (let c = g; c >= 0; c = from[c]) { cells.push(c); if (c === s) break; }
    cells.reverse();
    const pts = cells.map(c => [(c % N) - H + 0.5, Math.floor(c / N) - H + 0.5]);
    const out = [];
    let a = [fx, fz];
    for (let j = 1; j < pts.length; j++) {
      if (!this.clearLine(a[0], a[1], pts[j][0], pts[j][1])) { out.push(pts[j - 1]); a = pts[j - 1]; }
    }
    out.push([tx, tz]);
    return out;
  }
  // 덤불, 풀숲, 옷장 안 (가까이 와야 보인다)
  covered(p) { return this.spots.some(s => s.cover && Math.hypot(p.x - s.x, p.z - s.z) < 2.0); }

  // ───── 화면 ─────
  makeHud() {
    document.body.classList.add('tagw');
    const bar = document.createElement('div');
    bar.id = 'mode-bar';
    bar.innerHTML = '<small>다음 판</small><button data-m="tag"><kbd>1</kbd>🏃 술래잡기</button><button data-m="hide"><kbd>2</kbd>🙈 숨바꼭질</button>';
    bar.querySelectorAll('button').forEach(b => b.addEventListener('click', () => this.pickMode(b.dataset.m)));
    document.body.append(bar);
    this.modeBar = bar;
    const blind = document.createElement('div');
    blind.id = 'tag-blind';
    blind.hidden = true;
    blind.innerHTML = '<div><b>🙈</b><p>눈 감고 숫자 세는 중…</p><em></em><small>다 세면 찾으러 가!</small></div>';
    document.body.append(blind);
    this.blind = blind;
    this.syncModeBar();
  }
  pickMode(m) {
    if (!this.auth) { this.game.ui.toast('모드는 방장이 골라'); return; }
    this.game.sfx('click');
    this.nextMode = m === 'hide' ? 'hide' : 'tag';
    this.net.send({ t: 'tg', k: 'mode', mode: TAG_MODES.indexOf(this.nextMode) });
    this.syncModeBar();
  }
  syncModeBar() { this.modeBar.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.m === this.nextMode); b.classList.toggle('locked', !this.auth); }); }
  key(code) {
    if (this.state === 'lobby' && (code === 'Digit1' || code === 'Digit2')) { this.pickMode(code === 'Digit2' ? 'hide' : 'tag'); return true; }
    return false;
  }

  // ───── 사람과 봇 ─────
  makeBot(rnd) {
    const look = { skin: Math.floor(rnd() * SKINS.length), shirt: Math.floor(rnd() * COLORS.length), pants: Math.floor(rnd() * COLORS.length), hat: Math.floor(rnd() * 8), face: Math.floor(rnd() * 6), emblem: Math.floor(rnd() * 6), hair: Math.floor(rnd() * 12), hairColor: Math.floor(rnd() * 10) };
    const name = `🤖 ${displayName([Math.floor(rnd() * ADJECTIVES.length), Math.floor(rnd() * ANIMALS.length)])}`;
    const avatar = new Avatar(look, name);
    this.game.world.group.add(avatar.root);
    return { avatar, name, pl: newPlayer(0, 0.3, 0), yaw: rnd() * 6, dir: { x: 0, z: 0 }, jump: false, think: 0, frozen: 0, rnd: seeded(Math.floor(rnd() * 1e9)), target: null, way: [], visited: new Set(), stuck: 0, unstick: 0, flee: 0, lastA: undefined, net: null };
  }
  makeBots(n, seed) {
    for (const b of this.bots) b.avatar.dispose();
    const rnd = seeded(seed);
    this.bots = Array.from({ length: n }, () => this.makeBot(rnd));
  }
  lobbyBots(n) {
    if (this.net.active) return;
    this.makeBots(n, 777);
    this.bots.forEach((b, k) => Object.assign(b.pl, newPlayer(-4 + k * 4, 0.3, 4)));
  }
  isBot(s) { return s >= this.list.length; }
  posOf(s) {
    if (s < 0) return null;
    if (this.isBot(s)) return this.bots[s - this.list.length]?.pl ?? null;
    const id = this.list[s];
    if (id === this.myId) return this.game.player;
    const r = this.game.remotes.get(id);
    return r && r.w === 6 && r.avatar ? r : null;
  }
  nameOf(s) {
    if (s < 0) return '?';
    if (this.isBot(s)) return this.bots[s - this.list.length]?.name ?? '?';
    const id = this.list[s];
    if (id === this.myId) return '나';
    return this.game.remotes.get(id)?.name ?? '친구';
  }
  avatarOf(s) {
    if (this.isBot(s)) return this.bots[s - this.list.length]?.avatar ?? null;
    const id = this.list[s];
    if (id === this.myId) return null;
    return this.game.remotes.get(id)?.avatar ?? null;
  }
  participantsNow() {
    const ids = [this.myId];
    if (this.net.active) for (const id of this.net.peers) if (this.game.remotes.get(id)?.w === 6) ids.push(id);
    return ids;
  }

  // ───── 판 진행 ─────
  startRound(seed, list, nBots, mode, itSlot) {
    const g = this.game;
    this.round++;
    this.mode = mode;
    this.state = 'play';
    this.t = 0;
    this.list = list;
    this.makeBots(nBots, seed);
    const total = this.total;
    itSlot = Math.min(Math.max(0, itSlot | 0), total - 1);
    this.it = new Set([itSlot]);
    this.first = itSlot;
    this.immune = new Map();
    this.lostT = 0;
    const rnd = seeded(seed + 7);
    const starts = TAG_STARTS.map(s => [...s]).sort(() => rnd() - 0.5);
    const place = (s, x, z, yaw) => {
      if (this.isBot(s)) { const b = this.bots[s - list.length]; Object.assign(b.pl, newPlayer(x, 0.3, z)); b.yaw = yaw; b.frozen = 0; b.way = []; b.visited = new Set(); b.target = null; b.flee = 0; }
      else if (list[s] === this.myId) { g.teleport(x, 0.3, z, yaw); g.controls.faceBehind(yaw); }
    };
    for (let s = 0; s < total; s++) {
      if (s === itSlot) place(s, 0, 2.2, 0);
      else if (mode === 'tag') { const [x, z] = starts[s % starts.length]; place(s, x, z, Math.atan2(x, z)); }
      else { const a = (s / total) * Math.PI * 2; place(s, Math.sin(a) * 4.5, Math.cos(a) * 4.5, a); }
    }
    this.phase = mode === 'tag' ? 'play' : 'hide';
    this.timer = mode === 'tag' ? TAG.TIME : TAG.HIDE;
    const me = this.mySlot;
    this.frozen = 0;
    if (mode === 'tag') {
      const b = this.isBot(itSlot) ? this.bots[itSlot - list.length] : null;
      if (b) b.frozen = TAG.FREEZE;
      if (itSlot === me) { this.frozen = TAG.FREEZE; g.ui.big('👹 내가 술래! 3초 세고 잡으러 가!', 2400, 'gold'); }
      else g.ui.big(`🏃 술래잡기! 👹 술래는 ${this.nameOf(itSlot)}`, 2400);
    } else {
      if (itSlot === me) g.ui.big('🙈 내가 술래! 20초 동안 눈 감고 세기', 2400, 'gold');
      else g.ui.big(`🙈 숨바꼭질! 20초 안에 숨어! 👹 ${this.nameOf(itSlot)}`, 2600);
    }
    g.sfx('go');
  }
  // 술래가 닿았다 (방장이 정한다)
  tagged(by, who) {
    const g = this.game;
    if (this.mode === 'tag') {
      this.it = new Set([who]);
      this.immune.set(by, TAG.IMMUNE);
      if (this.isBot(who)) { const b = this.bots[who - this.list.length]; if (b) { b.frozen = TAG.FREEZE; if (b.rnd() < 0.5) b.avatar.say(['으악! 😱', '내가 술래야!', '잡으러 간다!'][Math.floor(b.rnd() * 3)]); } }
      if (who === this.mySlot) { this.frozen = TAG.FREEZE; g.sfx('hurt'); g.ui.big('👹 잡혔다! 이제 내가 술래 · 3초 세고 출발', 2200, 'gold'); }
      else if (by === this.mySlot) { g.sfx('hit'); g.ui.big(`✋ ${this.nameOf(who)} 잡았다! 도망쳐!`, 1600); }
      g.ui.log(`👹 ${this.nameOf(by)} → ${this.nameOf(who)} 술래!`);
    } else {
      this.it.add(who);
      const av = this.avatarOf(who);
      if (av) av.say('찾았다! 👀');
      if (who === this.mySlot) { g.sfx('hurt'); g.ui.big('👀 찾았다! 이제 나도 술래 편, 같이 찾자', 2400); }
      else if (by === this.mySlot) { g.sfx('coin'); g.ui.big(`👀 ${this.nameOf(who)} 찾았다!`, 1500); }
      g.ui.log(`👀 ${this.nameOf(by)} → ${this.nameOf(who)} 찾았다!`);
    }
    const p = this.posOf(who);
    if (p) g.effects.burst(p.x, p.y + 1.5, p.z, ['#ff3b4e', '#ffffff', '#ffd23f'], 16, 5);
  }
  hidersLeft() { let n = 0; for (let s = 0; s < this.total; s++) if (!this.it.has(s) && this.posOf(s)) n++; return n; }

  endRound(hidersWin) {
    const g = this.game, me = this.mySlot;
    this.state = 'end';
    this.timer = TAG.END_WAIT;
    this.frozen = 0;
    this.blind.hidden = true;
    if (me < 0) return;
    const s = g.save.tag;
    if (this.mode === 'tag') {
      const it = this.it.has(me);
      const coins = tagCoins('tag', { it });
      if (!it) s.wins++;
      g.addCoins(coins);
      if (it) { g.sfx('die'); g.ui.big(`👹 술래로 끝났어… 🪙+${coins}`, 3600); }
      else { g.sfx('win'); g.effects.confetti(g.player.x, g.player.y + 3, g.player.z, 140); g.ui.big(`🎉 살았다! 술래는 ${this.nameOf([...this.it][0] ?? -1)} · 🪙+${coins}`, 3600, 'gold'); }
    } else {
      const seeker = this.it.has(me);
      const won = seeker ? !hidersWin : hidersWin;
      const coins = tagCoins('hide', { won });
      if (won && !seeker) s.hideWins++;
      if (won && me === this.first) s.seekWins++;
      g.addCoins(coins);
      if (won) { g.sfx('win'); g.effects.confetti(g.player.x, g.player.y + 3, g.player.z, 160); }
      else g.sfx('die');
      const head = hidersWin ? `🙈 숨은 편 승리! ${this.hidersLeft()}명이 끝까지 숨었어` : '👹 술래 편 승리! 다 찾았어';
      g.ui.big(`${head} · 🪙+${coins}`, 3800, won ? 'gold' : '');
    }
    g.persist();
  }
  toLobby() {
    this.state = 'lobby';
    this.timer = TAG.LOBBY_WAIT;
    this.it = new Set();
    this.frozen = 0;
    this.blind.hidden = true;
    this.list = [];
    this.game.teleport((Math.random() - 0.5) * 6, 0.3, 4 + Math.random() * 3, Math.PI);
    this.lobbyBots(3);
  }

  message(d, from) {
    const hostId = this.net.room.hostId;
    if (from !== hostId) return;
    if (d.k === 'mode') { this.nextMode = TAG_MODES[d.mode] ?? 'tag'; this.syncModeBar(); return; }
    if (d.k === 'start' && Number.isInteger(d.seed) && Array.isArray(d.list)) {
      this.startRound(d.seed, d.list.filter(x => typeof x === 'string').slice(0, 6), Math.max(0, Math.min(TAG.PLAYERS, d.bots | 0)), TAG_MODES[d.mode] ?? 'tag', d.it | 0);
      this.round = d.r | 0;
      return;
    }
    if (d.r !== this.round) return;
    if (d.k === 'tagged' && Number.isInteger(d.by) && Number.isInteger(d.who) && this.state === 'play') this.tagged(d.by, d.who);
    else if (d.k === 'end' && this.state === 'play') { if (Array.isArray(d.it)) this.it = new Set(d.it.filter(Number.isInteger)); this.endRound(!!d.win); }
    else if (d.k === 'lobby') this.toLobby();
    else if (d.k === 'tick' && this.state === 'play') {
      if (Number.isFinite(d.tm)) this.timer = d.tm;
      const ph = ['play', 'hide', 'seek'][d.ph];
      if (ph && ph !== this.phase) { this.phase = ph; if (ph === 'seek') this.seekStarted(); }
      if (Array.isArray(d.it)) {
        const next = new Set(d.it.filter(Number.isInteger));
        // 술래 소식을 놓쳤으면 여기서 맞춘다
        if (this.mode === 'tag' && next.has(this.mySlot) && !this.it.has(this.mySlot)) this.frozen = TAG.FREEZE;
        this.it = next;
      }
      if (Array.isArray(d.q)) d.q.forEach((q, k) => { const b = this.bots[k]; if (b && Array.isArray(q) && q.slice(0, 4).every(Number.isFinite)) b.net = { x: q[0], y: q[1], z: q[2], yaw: q[3] }; });
    }
  }
  seekStarted() {
    const g = this.game;
    g.sfx('go');
    if (this.it.has(this.mySlot)) g.ui.big('🔎 다 셌다! 찾으러 가자', 1800, 'gold');
    else g.ui.big('🔎 술래가 찾으러 와! 숨죽여…', 1800);
  }
  sendTick() {
    const q = this.bots.map(b => [r2(b.pl.x), r2(b.pl.y), r2(b.pl.z), r2(b.yaw)]);
    this.net.send({ t: 'tg', k: 'tick', r: this.round, ph: ['play', 'hide', 'seek'].indexOf(this.phase), tm: r2(this.timer), it: [...this.it], q });
  }

  // ───── 봇 머리 ─────
  // 앞이 막혔나: 0 갈 수 있음, 1 낮아서 점프, 2 벽
  blocked(pl, vx, vz, maxD = 9) {
    let worst = 0;
    for (const dist of maxD < 0.9 ? [Math.max(0.2, maxD)] : maxD < 1.9 ? [0.9] : [0.9, 1.9]) {
      const px = pl.x + vx * dist, pz = pl.z + vz * dist;
      if (Math.abs(px) > TAG_HALF - 0.8 || Math.abs(pz) > TAG_HALF - 0.8) return 2;
      for (const b of this.boxesIn(px - 0.6, pz - 0.6, px + 0.6, pz + 0.6)) {
        if (!b.on || px + P.R <= b.x0 || px - P.R >= b.x1 || pz + P.R <= b.z0 || pz - P.R >= b.z1) continue;
        if (b.y1 <= pl.y + P.STEP || b.y0 >= pl.y + P.H) continue;
        if (b.kind === 'ladder') continue;
        worst = Math.max(worst, b.y1 - pl.y <= 2.1 ? 1 : 2);
        if (worst === 2) return 2;
      }
    }
    return worst;
  }
  steer(b, dx, dz, slow = 1, maxD = 9) {
    const len = Math.hypot(dx, dz);
    if (len < 0.05) { b.dir = { x: 0, z: 0 }; return; }
    const base = Math.atan2(dx, dz);
    let best = null, bs = -1e9;
    for (const off of ANGLES) {
      const a = base + off, vx = Math.sin(a), vz = Math.cos(a);
      const blk = this.blocked(b.pl, vx, vz, maxD);
      let sc = Math.cos(off) - (blk === 2 ? 6 : blk === 1 ? 0.35 : 0);
      if (b.lastA !== undefined) sc += Math.cos(a - b.lastA) * 0.3;
      if (sc > bs) { bs = sc; best = { a, blk }; }
    }
    b.lastA = best.a;
    b.dir = { x: Math.sin(best.a) * slow, z: Math.cos(best.a) * slow };
    if (best.blk === 1 && b.pl.ground) b.jump = true;
  }
  goTo(b, x, z, slow = 1) { const d = Math.hypot(x - b.pl.x, z - b.pl.z); this.steer(b, x - b.pl.x, z - b.pl.z, slow, d); return d; }
  // 집 안의 숨을 곳은 문 밖 → 문 안 → 자리 순서로 간다
  routeTo(spot, from) {
    const found = from && this.path(from.x, from.z, spot.x, spot.z);
    if (found) return found;
    const door = [];
    if (spot.room) { const [hx, hz, d] = spot.room, s = d === 's' ? 1 : -1; door.push([hx, hz + s * 7], [hx, hz + s * 3.2]); }
    return [...door, ...(spot.way ?? []), [spot.x, spot.z]];
  }
  nearestOther(s, filter) {
    const p = this.posOf(s);
    let best = -1, bd = 1e9;
    for (let u = 0; u < this.total; u++) {
      if (u === s || !filter(u)) continue;
      const q = this.posOf(u);
      if (!q) continue;
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < bd) { bd = d; best = u; }
    }
    return { slot: best, dist: bd };
  }

  brain(b, s, dt) {
    b.jump = false;
    if (this.state !== 'play') { this.wander(b, dt, 0.4); return; }
    if (b.frozen > 0) { b.frozen -= dt; b.dir = { x: 0, z: 0 }; return; }
    // 끼었으면 잠깐 아무 쪽으로
    const want = Math.hypot(b.dir.x, b.dir.z) > 0.3, sp = Math.hypot(b.pl.vx, b.pl.vz);
    b.stuck = want && sp < 1.2 ? b.stuck + dt : 0;
    if (b.unstick > 0) { b.unstick -= dt; return; }
    if (b.stuck > 0.8) { b.stuck = 0; b.unstick = 0.5; const a = b.rnd() * 6.28; b.dir = { x: Math.sin(a), z: Math.cos(a) }; b.jump = true; return; }
    b.think -= dt;
    if (b.think > 0) return;
    b.think = 0.12;
    const isIt = this.it.has(s);
    if (this.mode === 'tag') {
      if (isIt) {
        const t = this.nearestOther(s, u => !(this.immune.get(u) > 0));
        const q = t.slot >= 0 ? this.posOf(t.slot) : null;
        if (q) this.goTo(b, q.x, q.z); else this.wander(b, dt, 0.6);
      } else this.runner(b, s, 15);
      return;
    }
    // 숨바꼭질
    if (this.phase === 'hide') {
      if (isIt) { b.dir = { x: 0, z: 0 }; return; }
      if (!b.way.length && !b.hidden) {
        const taken = new Set(this.bots.filter(o => o !== b && o.spot).map(o => o.spot));
        const choices = this.spots.filter(p => !taken.has(p) && Math.hypot(p.x, p.z) > 10);
        b.spot = choices[Math.floor(b.rnd() * choices.length)] ?? this.spots[0];
        b.way = this.routeTo(b.spot, b.pl);
      }
      this.followWay(b);
      return;
    }
    if (isIt) this.seeker(b, s, dt);
    else this.hider(b, s);
  }
  // 다음 점에 가까워지지 않으면 (끼었으면) 지금 자리에서 길을 다시 찾는다
  progress(b, d, replan) {
    if (b.wpKey !== b.way.length || d < (b.wpBest ?? 1e9) - 0.3) { b.wpKey = b.way.length; b.wpBest = d; b.wpT = 0; return; }
    b.wpT += 0.12;
    if (b.wpT > 1.6) { b.wpT = 0; b.wpBest = 1e9; replan(); }
  }
  followWay(b) {
    if (!b.way.length) { b.dir = { x: 0, z: 0 }; return; }
    const [x, z] = b.way[0];
    const d = this.goTo(b, x, z, b.way.length === 1 ? 0.7 : 1);
    this.progress(b, d, () => { if (b.spot) b.way = this.routeTo(b.spot, b.pl); });
    if (d < (b.way.length === 1 ? 0.45 : 0.9)) { b.way.shift(); if (!b.way.length) { b.hidden = true; b.dir = { x: 0, z: 0 }; } }
  }
  wander(b, dt, slow) {
    b.wt = (b.wt ?? 0) - dt;
    if (b.wt <= 0 || !b.wp) { b.wt = 2 + b.rnd() * 3; b.wp = this.state === 'play' ? TAG_STARTS[Math.floor(b.rnd() * TAG_STARTS.length)] : [(b.rnd() - 0.5) * 10, (b.rnd() - 0.5) * 10 + 3]; }
    if (this.goTo(b, b.wp[0], b.wp[1], slow) < 1.2) b.dir = { x: 0, z: 0 };
  }
  // 도망: 술래 반대쪽으로, 울타리 가까우면 안쪽으로 비켜서
  runner(b, s, range) {
    const t = this.nearestOther(s, u => this.it.has(u));
    const q = t.slot >= 0 ? this.posOf(t.slot) : null;
    if (!q || t.dist > range) { this.wander(b, 0.12, 0.55); return false; }
    let dx = b.pl.x - q.x, dz = b.pl.z - q.z;
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const edge = TAG_HALF - 9;
    if (Math.abs(b.pl.x) > edge) dx -= Math.sign(b.pl.x) * 1.2;
    if (Math.abs(b.pl.z) > edge) dz -= Math.sign(b.pl.z) * 1.2;
    // 옆으로 조금 비켜 달리기 (잡히기 어렵게)
    const side = (b.side ??= b.rnd() < 0.5 ? 1 : -1);
    dx += -dz * 0.35 * side; dz += dx * 0.35 * side;
    this.steer(b, dx, dz);
    return true;
  }
  seeker(b, s, dt) {
    // 보이는 사람이 있으면 쫓아간다
    let best = -1, bd = 1e9;
    for (let u = 0; u < this.total; u++) {
      if (this.it.has(u)) continue;
      const q = this.posOf(u);
      if (!q) continue;
      const d = Math.hypot(q.x - b.pl.x, q.z - b.pl.z);
      const see = d < 3.2 || (d < 17 && !this.covered(q) && this.sees(b.pl, q));
      if (see && d < bd) { bd = d; best = u; }
    }
    if (best >= 0) { b.chase = best; b.chaseT = 2.5; }
    else if (b.chase !== undefined && b.chaseT > 0) b.chaseT -= 0.12;
    else b.chase = undefined;
    if (b.chase !== undefined && !this.it.has(b.chase)) {
      const q = this.posOf(b.chase);
      if (q) { this.goTo(b, q.x, q.z); return; }
    }
    // 숨을 만한 곳을 차례로 살펴본다
    if (!b.way.length) {
      let pick = null, pd = 1e9;
      for (const p of this.spots) {
        if (b.visited.has(p)) continue;
        const d = Math.hypot(p.x - b.pl.x, p.z - b.pl.z) + b.rnd() * 8;
        if (d < pd) { pd = d; pick = p; }
      }
      if (!pick) { b.visited.clear(); return; }
      b.visited.add(pick);
      b.way = this.routeTo(pick, b.pl);
    }
    const [x, z] = b.way[0];
    const d = this.goTo(b, x, z);
    if (d < 1.6) b.way.shift();
    else this.progress(b, d, () => { b.way = b.way.length > 1 ? this.path(b.pl.x, b.pl.z, b.way.at(-1)[0], b.way.at(-1)[1]) ?? [] : []; });
    void dt;
  }
  hider(b, s) {
    // 술래가 가까이 와서 보이면 도망, 멀어지면 다른 곳에 다시 숨는다
    const t = this.nearestOther(s, u => this.it.has(u));
    const q = t.slot >= 0 ? this.posOf(t.slot) : null;
    const spotted = q && (t.dist < 3.6 || (t.dist < 8 && !this.covered(b.pl) && this.sees(q, b.pl)));
    if (spotted) { b.flee = 4; b.hidden = false; b.way = []; }
    if (b.flee > 0) {
      b.flee -= 0.12;
      this.runner(b, s, 30);
      if (b.flee <= 0 && t.dist > 12) {
        const choices = this.spots.filter(p => Math.hypot(p.x - q.x, p.z - q.z) > 18);
        b.spot = choices[Math.floor(b.rnd() * choices.length)] ?? b.spot;
        b.way = this.routeTo(b.spot, b.pl);
      }
      return;
    }
    this.followWay(b);
  }

  // ───── 매 프레임 ─────
  update(dt) {
    const g = this.game, net = this.net, auth = this.auth;
    document.body.classList.toggle('tg-lobby', this.state === 'lobby');
    if (this.state === 'lobby') {
      this.timer -= dt;
      const sec = Math.ceil(this.timer);
      if (sec !== this.lastCount && sec <= 3 && sec > 0) { this.lastCount = sec; g.sfx('tick'); g.ui.big(String(sec), 800); }
      this.modeT -= dt;
      if (auth && net.live && this.modeT <= 0) { this.modeT = 2; net.send({ t: 'tg', k: 'mode', mode: TAG_MODES.indexOf(this.nextMode) }); }
      if (this.timer <= 0 && auth) {
        const seed = (Math.random() * 1e9) | 0, list = this.participantsNow();
        const bots = Math.max(0, TAG.PLAYERS - list.length), mode = this.nextMode;
        const it = Math.floor(Math.random() * (list.length + bots));
        this.startRound(seed, list, bots, mode, it);
        net.send({ t: 'tg', k: 'start', r: this.round, seed, list, bots, mode: TAG_MODES.indexOf(mode), it });
      } else if (this.timer <= -3 && !auth) this.timer = TAG.LOBBY_WAIT;
    } else if (this.state === 'play') {
      this.t += dt;
      this.timer -= dt;
      for (const [k, v] of this.immune) if (v - dt <= 0) this.immune.delete(k); else this.immune.set(k, v - dt);
      if (auth) {
        if (this.phase === 'hide' && this.timer <= 0) { this.phase = 'seek'; this.timer = TAG.SEEK; this.seekStarted(); }
        // 닿았나
        if (this.phase !== 'hide') {
          for (const s of [...this.it]) {
            if (this.isBot(s) && this.bots[s - this.list.length]?.frozen > 0) continue;
            if (s === this.mySlot && this.frozen > 0) continue;
            const a = this.posOf(s);
            if (!a) continue;
            for (let u = 0; u < this.total; u++) {
              if (this.it.has(u) || this.immune.get(u) > 0) continue;
              const b = this.posOf(u);
              if (b && touching(a, b)) {
                this.tagged(s, u);
                net.send({ t: 'tg', k: 'tagged', r: this.round, by: s, who: u });
                break;
              }
            }
            if (this.mode === 'tag') break;
          }
        }
        // 술래가 방을 나갔으면 다른 사람에게
        if (this.mode === 'tag') {
          const cur = [...this.it][0];
          if (!this.posOf(cur)) { this.lostT += dt; if (this.lostT > 1.5) { this.lostT = 0; const u = Math.floor(Math.random() * this.total); this.it = new Set([u]); } } else this.lostT = 0;
        }
        const over = this.phase !== 'hide' && this.timer <= 0;
        const allFound = this.mode === 'hide' && this.phase === 'seek' && this.hidersLeft() === 0;
        if (over || allFound) {
          const hidersWin = this.mode === 'hide' && !allFound;
          net.send({ t: 'tg', k: 'end', r: this.round, win: hidersWin ? 1 : 0, it: [...this.it] });
          this.endRound(hidersWin);
        }
        this.sendT -= dt;
        if (net.live && this.sendT <= 0 && this.state === 'play') { this.sendT = 0.1; this.sendTick(); }
      }
    } else if (this.state === 'end') {
      this.timer -= dt;
      if (this.timer <= 0 && auth) { this.toLobby(); net.send({ t: 'tg', k: 'lobby', r: this.round }); }
    }

    // 나: 숫자 세는 중
    const me = this.mySlot;
    const blindNow = this.state === 'play' && this.mode === 'hide' && this.phase === 'hide' && this.it.has(me);
    if (blindNow) this.frozen = Math.max(this.frozen, 0.2);
    else if (this.frozen > 0) {
      const before = Math.ceil(this.frozen);
      this.frozen -= dt;
      if (Math.ceil(this.frozen) !== before && this.frozen > 0) g.sfx('tick');
      if (this.frozen <= 0) { g.sfx('go'); g.ui.big('👹 잡으러 가!', 900, 'gold'); }
    }
    this.blind.hidden = !blindNow;
    if (blindNow) this.blind.querySelector('em').textContent = String(Math.max(1, Math.ceil(this.timer)));

    // 봇
    const boxes = g.world.boxes;
    this.bots.forEach((b, k) => {
      const s = this.list.length + k;
      if (auth) {
        this.brain(b, s, dt);
        stepPlayer(b.pl, { mx: b.dir.x, mz: b.dir.z, jump: b.jump, speed: TAG.BOT_SPEED }, boxes, dt);
        if (b.pl.y < -10) Object.assign(b.pl, newPlayer(0, 0.3, 3));
        const sp = Math.hypot(b.pl.vx, b.pl.vz);
        if (sp > 0.3) b.yaw = Math.atan2(b.pl.vx, b.pl.vz);
        b.avatar.place(b.pl.x, b.pl.y, b.pl.z, b.yaw, dt);
        b.avatar.animate(dt, { speed: sp, grounded: !!b.pl.ground, vy: b.pl.vy, climb: b.pl.climb, emote: 0 });
      } else if (b.net) {
        const kk = 1 - Math.exp(-dt * 12), px = b.pl.x, pz = b.pl.z;
        b.pl.x += (b.net.x - b.pl.x) * kk; b.pl.y += (b.net.y - b.pl.y) * kk; b.pl.z += (b.net.z - b.pl.z) * kk;
        const sp = Math.hypot(b.pl.x - px, b.pl.z - pz) / Math.max(dt, 1e-3);
        b.avatar.place(b.pl.x, b.pl.y, b.pl.z, b.net.yaw, dt);
        b.avatar.animate(dt, { speed: sp, grounded: true, vy: 0, climb: false, emote: 0 });
      }
    });
    this.drawMarks();
    this.updateInfo();
  }

  // 술래 표시: 발밑 빨간 고리 + 빨간 이름표. 숨바꼭질 중에는 숨는 사람 이름표를 감춘다
  drawMarks() {
    const playing = this.state === 'play';
    const its = playing ? [...this.it] : [];
    while (this.rings.length < its.length) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.12, 8, 28), new THREE.MeshStandardMaterial({ color: '#ff3b4e', emissive: '#ff3b4e', emissiveIntensity: 1.3 }));
      m.rotation.x = Math.PI / 2;
      this.game.world.group.add(m);
      this.rings.push(m);
    }
    const now = performance.now() / 1000;
    this.rings.forEach((m, i) => {
      const p = i < its.length ? this.posOf(its[i]) : null;
      m.visible = !!p;
      if (p) { m.position.set(p.x, (p.visualY ?? p.y) + 0.12, p.z); m.scale.setScalar(1 + Math.sin(now * 6) * 0.08); }
    });
    for (let s = 0; s < Math.max(this.total, this.list.length); s++) this.label(s, playing);
    // 대기실 봇 이름표 원래대로
    if (!playing) this.bots.forEach(b => this.setLabel(b.avatar, b.name, null, true));
  }
  label(s, playing) {
    const av = this.avatarOf(s);
    if (!av) return;
    const base = this.isBot(s) ? this.bots[s - this.list.length].name : this.game.remotes.get(this.list[s])?.name ?? '친구';
    const isIt = playing && this.it.has(s);
    const hide = playing && this.mode === 'hide' && !isIt; // 숨은 사람 이름표는 안 보이게
    this.setLabel(av, isIt ? `👹 술래 · ${base.replace('🤖 ', '')}` : base, isIt ? RED : null, !hide);
  }
  setLabel(av, text, color, show) {
    const key = `${text}|${color}`;
    if (av._tagKey !== key || av._tagSprite !== av.tag) { av.setName(text, color ?? undefined); av._tagKey = key; av._tagSprite = av.tag; }
    if (av.tag) av.tag.visible = show;
  }

  updateInfo() {
    const g = this.game, s = g.save.tag;
    let html;
    if (this.state === 'lobby') {
      html = `<b>⏳ 다음 판까지 ${Math.max(0, Math.ceil(this.timer))}초 · ${this.nextMode === 'tag' ? '🏃 술래잡기' : '🙈 숨바꼭질'}</b><small>살아남기 ${s.wins}번 · 끝까지 숨기 ${s.hideWins}번 · 다 찾기 ${s.seekWins}번</small>`;
    } else if (this.state === 'play' && this.mode === 'tag') {
      const it = [...this.it][0] ?? -1, me = this.mySlot;
      let near = '';
      if (me >= 0 && it !== me) { const a = this.posOf(it), b = g.player; if (a) near = ` · 술래까지 ${Math.round(Math.hypot(a.x - b.x, a.z - b.z))}m`; }
      html = `<b>🏃 술래잡기 · ${fmt(this.timer)}</b><small>${it === me ? (this.frozen > 0 ? `👹 내가 술래! ${Math.ceil(this.frozen)}초 세는 중` : '👹 내가 술래! 아무나 잡아!') : `👹 술래: ${this.nameOf(it)}${near}`}</small>`;
    } else if (this.state === 'play') {
      const left = this.hidersLeft();
      html = this.phase === 'hide'
        ? `<b>🙈 숨는 시간 ${Math.max(0, Math.ceil(this.timer))}초</b><small>${this.it.has(this.mySlot) ? '눈 감고 세는 중… 다 세면 찾으러 가!' : '덤불, 풀숲, 옷장, 굴, 놀이터 밑에 숨어!'}</small>`
        : `<b>🔎 찾는 시간 ${fmt(this.timer)} · 남은 사람 ${left}명</b><small>${this.it.has(this.mySlot) ? '👹 술래 편: 숨은 사람에게 닿으면 찾았다!' : '🙈 들키지 마! 술래가 오면 도망쳐'}</small>`;
    } else html = '<b>🏁 판 끝!</b><small>곧 다음 판</small>';
    g.ui.setInfo(html);
  }

  dispose() {
    for (const b of this.bots) b.avatar.dispose();
    this.rings.forEach(m => { m.geometry.dispose(); m.material.dispose(); m.removeFromParent(); });
    this.modeBar.remove();
    this.blind.remove();
    for (const r of this.game.remotes.values()) if (r.avatar) { r.avatar.setName(r.name); if (r.avatar.tag) r.avatar.tag.visible = true; }
    document.body.classList.remove('tagw', 'tg-lobby');
    this.game.ui.setInfo('');
  }
}
