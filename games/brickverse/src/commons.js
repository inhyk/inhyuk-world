// 🧱 모두의 공터: 브릭 광장 한쪽(COMMONS)의 바닥판에 로그인한 사람들이 같이 블록을 놓는다.
// - 블록은 모두의 광장 세계(src/plaza.js 의 Plaza, World 의 칸)에 저장되어 모두 나가도 남는다.
//   칸 이름은 'b|i|j|k', 값은 블록 번호 하나. 처음 놓은 사람만 부술 수 있다.
// - 서버가 진실이다: 놓으면 plaza.setCell 을 보내고, 화면에는 cell 로 돌아온 칸만 그린다.
//   들어올 때 받은 칸은 opened 뒤 sync() 로 채우고, 광장에서 나오면(reset) 모두 지운다.
// - 막대와 놓기는 광장에 연결돼 있고 공터 안이나 가까이(COMMONS.NEAR) 있을 때만 켜진다.
//   멀리서 화면을 눌러도 블록을 놓지 않는다. 키는 Q E(블록 고르기), F(놓기/부수기)만 쓴다 (1~4 는 표현).
import { BLOCKS, COMMONS, TOWER, commonsKey, commonsBlock, commonsCenter, commonsCellAt, inCommons, nearCommons, countMine, makeBox, touchesCell } from '../core.mjs';
import { COMMONS_TEXT, commonsError, quietNotice } from './plaza.js';
import { BlockMeshes, Ghost, pickCell, makeBlockBar, barSelect, barMode } from './blocks.js';

const CAP = COMMONS.N * COMMONS.N * (COMMONS.TOP + 1);
const PENDING_MS = 4000; // 보낸 뒤 이만큼 답이 없으면 기다리기를 그만둔다

export class Commons {
  constructor(game) {
    this.game = game;
    this.cells = new Map();   // 칸 이름 → { i, j, k, t, owner, box }
    this.pending = new Map(); // 보내고 답을 기다리는 칸 이름 → { a: 'set' | 'del', at }
    this.type = 0;
    this.mode = 'place';
    this.cool = 0;
    this.hover = null;
    this.state = '';
    this.infoTimer = 0;
    this.notice = quietNotice(2500);
    this.blocks = new BlockMeshes(game.world.group, CAP);
    this.ghost = new Ghost(game.world.group);
    this.makeBar();
    this.bind();
    this.sync();
  }

  get plaza() { return this.game.plaza; }
  get live() { return !!this.plaza?.live; }
  get mine() { return countMine(this.plaza?.cells ?? new Map(), this.plaza?.userId ?? null); }

  tell(text) {
    if (this.notice(text, performance.now())) this.game.ui.toast(text, 2200);
  }

  // ───── 칸 ─────
  // 받은 칸으로 공터를 처음부터 다시 채운다 (광장에 들어왔을 때, 나왔을 때, 세계를 새로 만들었을 때)
  sync() {
    this.pending.clear();
    const drop = new Set([...this.cells.values()].map(c => c.box));
    this.cells.clear();
    if (drop.size) {
      this.game.world.boxes = this.game.world.boxes.filter(b => !drop.has(b));
      if (drop.has(this.game.player.ground)) this.game.player.ground = null;
    }
    if (this.live) for (const [k, entry] of this.plaza.cells) this.put(k, commonsBlock(k, entry));
    this.redraw();
    this.updateInfo();
  }

  // plaza 의 cell hook: 칸이 생기거나 바뀌거나 없어졌다
  cell(k, entry) {
    const waited = this.pending.get(k);
    this.pending.delete(k);
    const b = entry ? commonsBlock(k, entry) : null;
    const old = this.cells.get(k);
    if (old && b && old.t === b.t) { old.owner = b.owner; return; }
    if (old) this.drop(k);
    if (b) {
      this.put(k, b);
      if (waited?.a === 'set') this.game.sfx('pop');
    } else if (old) {
      const [x, y, z] = commonsCenter(old.i, old.j, old.k);
      this.game.effects.burst(x, y, z, [BLOCKS[old.t].c, '#ffffff'], 10, 5);
      if (waited?.a === 'del') this.game.sfx('crumble');
    }
    this.redraw();
    this.updateInfo();
  }

  // plaza 의 cellError hook: 서버가 놓기나 부수기를 거절했다
  cellError(code, k) {
    if (k) this.pending.delete(k);
    const text = commonsError(code);
    if (!text) return;
    this.tell(text);
    this.game.sfx('nope');
  }

  put(k, b) {
    if (!b || this.cells.has(k)) return;
    const [x, y, z] = commonsCenter(b.i, b.j, b.k);
    const box = makeBox({ x, y, z, w: TOWER.CELL, h: TOWER.CELL, d: TOWER.CELL, k: BLOCKS[b.t].k });
    this.game.world.boxes.push(box);
    this.cells.set(k, { ...b, box });
    // 다른 사람이 내 자리에 놓았으면 블록 위로 올려 준다 (블록 속에 갇히지 않게)
    const pl = this.game.player;
    if (touchesCell(pl, x, y, z)) { pl.y = box.y1 + 0.01; pl.vy = 0; }
  }

  drop(k) {
    const c = this.cells.get(k);
    if (!c) return;
    this.cells.delete(k);
    this.game.world.boxes = this.game.world.boxes.filter(b => b !== c.box);
    if (this.game.player.ground === c.box) this.game.player.ground = null;
  }

  redraw() { this.blocks.draw(this.cells.values(), c => commonsCenter(c.i, c.j, c.k)); }

  // ───── 지금 놓을 수 있나 ─────
  // far(멀리) | loggedOut | room(방 코드 방에 있음) | waiting(광장에 아직 못 들어감) | live
  where() {
    const g = this.game, pl = g.player;
    if (!g.started || !nearCommons(pl.x, pl.z)) return 'far';
    if (!g.cloud?.loggedIn) return 'loggedOut';
    if (g.net?.active) return 'room';
    if (!this.live) return 'waiting';
    return 'live';
  }

  // ───── 화면 위치 → 칸 ─────
  pick(cx, cy) {
    return pickCell(this.game.camera, cx, cy, this.cells.values(), COMMONS.Y, commonsCellAt);
  }

  target(hit, mode = this.mode) {
    if (!hit) return null;
    if (hit.outside) return mode === 'place' ? { i: 0, j: 0, k: 0, ok: false, why: COMMONS_TEXT.outside, hidden: true } : null;
    if (mode === 'remove') {
      if (!hit.cell) return null;
      const c = hit.cell, key = commonsKey(c.i, c.j, c.k);
      if (this.pending.has(key)) return { i: c.i, j: c.j, k: c.k, ok: false, why: '' };
      const mine = c.owner !== null && c.owner === this.plaza?.userId;
      return { i: c.i, j: c.j, k: c.k, key, ok: mine, why: mine ? '' : COMMONS_TEXT['not-owner'] };
    }
    const [i, j, k] = hit.ground ? [hit.i, 0, hit.k] : [hit.cell.i + hit.normal[0], hit.cell.j + hit.normal[1], hit.cell.k + hit.normal[2]];
    const key = commonsKey(i, j, k);
    let why = '';
    if (!inCommons(i, j, k)) why = j > COMMONS.TOP ? COMMONS_TEXT.top : COMMONS_TEXT.outside;
    else if (this.cells.has(key) || this.pending.has(key)) why = COMMONS_TEXT.exists;
    else if (this.mine >= COMMONS.LIMIT) why = COMMONS_TEXT.limit;
    else {
      const [x, y, z] = commonsCenter(i, j, k), pl = this.game.player;
      if (Math.hypot(x - pl.x, y - (pl.y + 1.6), z - pl.z) > TOWER.REACH) why = COMMONS_TEXT.far;
      else if (touchesCell(pl, x, y, z)) why = COMMONS_TEXT.self;
    }
    return { i, j, k, key, ok: !why, why };
  }

  act(cx, cy, mode = this.mode) {
    if (this.cool > 0 || this.where() !== 'live') return;
    const tg = this.target(this.pick(cx, cy), mode);
    if (!tg) return;
    if (!tg.ok) { if (tg.why) this.tell(tg.why); this.game.sfx('nope'); return; }
    this.cool = COMMONS.RATE;
    const sent = mode === 'remove' ? this.plaza.delCell(tg.key) : this.plaza.setCell(tg.key, this.type);
    if (sent) this.pending.set(tg.key, { a: mode === 'remove' ? 'del' : 'set', at: performance.now() });
  }

  // ───── 입력 ─────
  bind() {
    const c = this.game.canvas;
    this.down = null;
    this.onDown = e => { this.down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, button: e.button }; };
    this.onMove = e => { if (e.pointerType === 'mouse') this.hover = { x: e.clientX, y: e.clientY }; };
    this.onUp = e => {
      const d = this.down; this.down = null;
      if (!d || d.id !== e.pointerId || !this.ready() || this.where() !== 'live') return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || performance.now() - d.t > 450) return;
      const [x, y] = this.game.controls.locked ? [innerWidth / 2, innerHeight / 2] : [e.clientX, e.clientY];
      this.act(x, y, d.button === 2 ? 'remove' : this.mode);
    };
    this.onLeave = () => { this.hover = null; };
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointerleave', this.onLeave);
  }
  ready() { return this.game.started && !this.game.wardrobeOpen && !this.game.isDead(); }

  // 공터에서 놓을 수 있을 때만 키를 쓴다 (숫자 키는 광장의 표현이라 쓰지 않는다)
  key(code) {
    if (this.where() !== 'live') return false;
    if (code === 'KeyQ') { this.select((this.type + BLOCKS.length - 1) % BLOCKS.length); return true; }
    if (code === 'KeyE') { this.select((this.type + 1) % BLOCKS.length); return true; }
    if (code === 'KeyF') { this.setMode(this.mode === 'place' ? 'remove' : 'place'); return true; }
    return false;
  }

  select(t) {
    if (t < 0 || t >= BLOCKS.length) return;
    this.type = t;
    this.setMode('place');
    barSelect(this.bar, t);
  }
  setMode(m) { this.mode = m; barMode(this.bar, m); }

  makeBar() {
    this.bar = makeBlockBar({
      tip: matchMedia('(pointer: coarse)').matches ? '톡: 놓기, 버튼으로 부수기 모드. 내가 놓은 블록만 부숴' : '클릭 놓기, 오른쪽 클릭 부수기, Q E 고르기, F 바꾸기',
      sfx: name => this.game.sfx(name),
      onSelect: n => this.select(n),
      onToggle: () => this.setMode(this.mode === 'place' ? 'remove' : 'place'),
      digits: false,
    });
    this.bar.classList.add('commons');
    this.bar.hidden = true;
    this.select(0);
  }

  updateInfo() {
    const s = this.state;
    if (!s || s === 'far') return;
    const ui = this.game.ui;
    if (s === 'live') ui.setInfo(`<b>🧱 모두의 공터</b><small>내 블록 ${this.mine}/${COMMONS.LIMIT}, 모두 ${this.cells.size}개</small>`);
    else ui.setInfo(`<b>🧱 모두의 공터</b><small>${COMMONS_TEXT[s]}</small>`);
  }

  update(dt) {
    this.cool -= dt;
    const now = performance.now();
    for (const [k, p] of this.pending) if (now - p.at > PENDING_MS) this.pending.delete(k);
    // 가까이 왔거나 멀어졌거나 연결이 바뀌면 막대와 안내를 바꾼다
    const s = this.where();
    if (s !== this.state) {
      const was = this.state;
      this.state = s;
      this.bar.hidden = s !== 'live';
      if (s === 'far') { if (was && was !== 'far') this.game.ui.setInfo(''); }
      else {
        if (s !== 'live') this.tell(COMMONS_TEXT[s]);
        this.updateInfo();
      }
    }
    this.infoTimer -= dt;
    if (this.infoTimer <= 0) { this.infoTimer = 0.3; this.updateInfo(); }
    // 미리 보기 (마우스나 조준점)
    let tg = null;
    if (s === 'live' && this.ready()) {
      const aim = this.game.controls.locked ? { x: innerWidth / 2, y: innerHeight / 2 } : this.hover;
      if (aim) tg = this.target(this.pick(aim.x, aim.y));
    }
    if (tg && !tg.hidden) {
      const [x, y, z] = commonsCenter(tg.i, tg.j, tg.k);
      const col = this.mode === 'remove' ? '#ff4d5e' : tg.ok ? BLOCKS[this.type].c : '#ff4d5e';
      this.ghost.show(x, y, z, col, this.mode === 'remove' ? 0.3 : tg.ok ? 0.45 : 0.22, tg.ok ? '#ffffff' : '#ff4d5e');
    } else this.ghost.hide();
  }

  dispose() {
    const c = this.game.canvas;
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('pointermove', this.onMove);
    c.removeEventListener('pointerup', this.onUp);
    c.removeEventListener('pointerleave', this.onLeave);
    this.bar.remove();
    this.blocks.dispose();
    this.ghost.dispose();
    if (this.state && this.state !== 'far') this.game.ui.setInfo('');
  }
}
