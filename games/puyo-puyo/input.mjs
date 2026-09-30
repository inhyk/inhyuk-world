// 키보드·터치 조작. 좌우는 꾹 누르면 잠깐 뒤 빠르게 반복(DAS)된다.
export const DAS = 9, ARR = 2;

// 혼자·AI·타워·온라인: 방향키와 WASD 모두
const SOLO = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', ArrowUp: 'rotR', KeyX: 'rotR', KeyZ: 'rotL', Space: 'drop',
  KeyA: 'left', KeyD: 'right', KeyS: 'down', KeyW: 'rotR', KeyQ: 'rotL', KeyK: 'rotL', KeyL: 'rotR',
};
// 2인 플레이: 1P는 왼손(WASD), 2P는 오른손(방향키)
const P1 = { KeyA: 'left', KeyD: 'right', KeyS: 'down', KeyW: 'rotR', KeyQ: 'rotL', KeyE: 'rotR', Space: 'drop' };
const P2 = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', ArrowUp: 'rotR', Slash: 'rotL', Period: 'rotR', Comma: 'rotL', Enter: 'drop', NumpadEnter: 'drop', ShiftRight: 'rotL' };

export class Pad {
  constructor() { this.clear(); }
  clear() { this.held = {}; this.pulse = {}; this.das = { left: 0, right: 0 }; this.dir = null; this.age = 0; }
  // 누를 때마다 한 번씩은 꼭 움직이도록 개수를 쌓아 두고, 한 프레임에 하나씩 쓴다
  press(a) {
    if (this.held[a]) return;
    this.held[a] = true;
    if (a === 'left' || a === 'right') { this.dir = a; this.das[a] = 0; }
    if (a !== 'down') this.pulse[a] = Math.min(4, (this.pulse[a] || 0) + 1);
    this.age = 0;
  }
  // 조작할 뿌요가 없을 때(다음 뿌요가 나오기 직전): 0.2초 동안은 누른 걸 기억한다
  idle() {
    if (++this.age > 12) this.pulse = {};
    return { down: !!this.held.down };
  }
  release(a) {
    this.held[a] = false;
    if (this.dir === a) this.dir = this.held.left ? 'left' : this.held.right ? 'right' : null;
  }
  frame() {
    const out = { down: !!this.held.down };
    for (const a of ['rotL', 'rotR', 'drop', 'left', 'right']) {
      if (this.pulse[a] > 0) { out[a] = true; this.pulse[a]--; }
    }
    const d = this.dir;
    if (d && this.held[d] && !out[d]) {
      this.das[d]++;
      if (this.das[d] >= DAS && (this.das[d] - DAS) % ARR === 0) out[d] = true;
    }
    return out;
  }
}

export class Controls {
  constructor() {
    this.pads = [new Pad(), new Pad()];
    this.mode = 'solo';   // 'solo' | 'duo'
    this.enabled = false;
    this.onKey = null;    // 게임 밖 단축키 처리
    addEventListener('keydown', e => this.key(e, true));
    addEventListener('keyup', e => this.key(e, false));
    addEventListener('blur', () => this.pads.forEach(p => p.clear()));
  }
  key(e, down) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (down && this.onKey && this.onKey(e)) return;
    if (!this.enabled) return;
    const maps = this.mode === 'duo' ? [P1, P2] : [SOLO];
    maps.forEach((map, i) => {
      const act = map[e.code];
      if (!act) return;
      e.preventDefault();
      if (down) { if (!e.repeat) this.pads[i].press(act); }
      else this.pads[i].release(act);
    });
  }
  // 화면 버튼: data-act, data-pad 속성
  bindButtons(root) {
    root.querySelectorAll('[data-act]').forEach(btn => {
      const act = btn.dataset.act, pad = () => this.pads[Number(btn.dataset.pad || 0)];
      const up = e => { btn.classList.remove('on'); pad().release(act); e?.preventDefault?.(); };
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        try { btn.setPointerCapture(e.pointerId); } catch { /* 없음 */ }
        btn.classList.add('on');
        if (this.enabled) pad().press(act);
      });
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('lostpointercapture', up);
      btn.addEventListener('contextmenu', e => e.preventDefault());
    });
  }
  // 필드 위를 쓸어서 조작 (휴대폰): 좌우로 끌면 이동, 톡 치면 회전, 아래로 휙 내리면 바로 떨어뜨리기
  bindSwipe(el, cellSize) {
    let start = null;
    el.addEventListener('pointerdown', e => {
      if (!this.enabled || e.pointerType === 'mouse') return;
      start = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, lastX: e.clientX, down: false };
    });
    el.addEventListener('pointermove', e => {
      if (!start) return;
      const c = cellSize() * 0.9;
      const dx = e.clientX - start.lastX;
      if (Math.abs(dx) >= c) {
        const steps = Math.trunc(dx / c);
        for (let i = 0; i < Math.abs(steps); i++) { const a = steps > 0 ? 'right' : 'left'; this.pads[0].press(a); this.pads[0].release(a); }
        start.lastX += steps * c;
        start.moved++;
      }
      const dy = e.clientY - start.y;
      if (dy > c * 1.2 && Math.abs(e.clientX - start.x) < c && !start.down) { start.down = true; this.pads[0].press('down'); }
    });
    const end = e => {
      if (!start) return;
      const dt = performance.now() - start.t, dy = e.clientY - start.y, dx = e.clientX - start.x;
      if (start.down) this.pads[0].release('down');
      if (dy > cellSize() * 2 && dt < 260 && Math.abs(dx) < cellSize()) { this.pads[0].press('drop'); this.pads[0].release('drop'); }
      else if (!start.moved && Math.hypot(dx, dy) < 12 && dt < 300) { const a = e.clientX > innerWidth / 2 ? 'rotR' : 'rotL'; this.pads[0].press(a); this.pads[0].release(a); }
      start = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', () => { if (start?.down) this.pads[0].release('down'); start = null; });
  }
  frame(n = 2, active = null) { return this.pads.slice(0, n).map((p, i) => (active && !active[i] ? p.idle() : p.frame())); }
  reset() { this.pads.forEach(p => p.clear()); }
}
