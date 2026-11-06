// 키보드, 마우스, 터치 입력과 3인칭 카메라.
import { rayBoxes } from '../core.mjs';

export class Controls {
  constructor(canvas, stick, jumpButton) {
    this.canvas = canvas;
    this.keys = new Set();
    this.yaw = Math.PI; this.pitch = 0.32; this.dist = 13; this.want = 13;
    this.jumpQueued = false; this.jumpHeld = false;
    this.stickVec = { x: 0, y: 0 };
    this.enabled = true;
    this.dragging = null;
    this.pinch = null;
    this.onKey = null;

    addEventListener('keydown', e => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
      if (k === 'Space' && !this.keys.has('Space')) this.jumpQueued = true;
      this.keys.add(k);
      this.onKey?.(k, e);
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.stickVec.x = this.stickVec.y = 0; });

    const pointers = new Map();
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => {
      canvas.focus({ preventScroll: true });
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture?.(e.pointerId);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), start: this.want };
      }
    });
    canvas.addEventListener('pointermove', e => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (this.pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.want = clamp(this.pinch.start * (this.pinch.d / Math.max(20, d)), 3, 34);
        return;
      }
      const speed = e.pointerType === 'touch' ? 0.0062 : 0.0048;
      this.yaw -= dx * speed;
      this.pitch = clamp(this.pitch + dy * speed, -0.55, 1.25);
    });
    const up = e => { pointers.delete(e.pointerId); if (pointers.size < 2) this.pinch = null; };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => { e.preventDefault(); this.want = clamp(this.want * (1 + Math.sign(e.deltaY) * 0.12), 3, 34); }, { passive: false });

    // 조이스틱
    if (stick) {
      const knob = stick.querySelector('i');
      let id = null, cx = 0, cy = 0;
      const R = 46;
      const move = e => {
        const dx = e.clientX - cx, dy = e.clientY - cy, len = Math.hypot(dx, dy);
        const k = len > R ? R / len : 1;
        this.stickVec.x = (dx * k) / R; this.stickVec.y = (dy * k) / R;
        knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      };
      stick.addEventListener('pointerdown', e => {
        id = e.pointerId; stick.setPointerCapture(id);
        const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
        move(e); e.preventDefault();
      });
      stick.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
      const end = e => { if (e.pointerId !== id) return; id = null; this.stickVec.x = this.stickVec.y = 0; knob.style.transform = ''; };
      stick.addEventListener('pointerup', end);
      stick.addEventListener('pointercancel', end);
    }
    if (jumpButton) {
      jumpButton.addEventListener('pointerdown', e => { e.preventDefault(); this.jumpQueued = true; this.jumpHeld = true; jumpButton.classList.add('on'); });
      const off = () => { this.jumpHeld = false; jumpButton.classList.remove('on'); };
      jumpButton.addEventListener('pointerup', off);
      jumpButton.addEventListener('pointercancel', off);
    }
  }

  // 카메라 기준 이동 방향 (월드 x, z)
  move() {
    if (!this.enabled) return { x: 0, z: 0 };
    let f = 0, r = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) r += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) r -= 1;
    f -= this.stickVec.y; r += this.stickVec.x;
    const len = Math.hypot(f, r);
    if (len > 1) { f /= len; r /= len; }
    // 카메라는 (sin yaw, cos yaw) 쪽에 있고 주인공을 본다 → 앞은 그 반대
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = -fz, rz = fx;
    return { x: fx * f + rx * r, z: fz * f + rz * r };
  }

  takeJump() {
    const j = this.enabled && (this.jumpQueued);
    this.jumpQueued = false;
    return j;
  }

  // 카메라를 주인공 뒤로 (벽을 뚫고 들어가지 않게)
  update(camera, tx, ty, tz, boxes, dt) {
    this.dist += (this.want - this.dist) * (1 - Math.exp(-dt * 10));
    const cp = Math.cos(this.pitch);
    const dx = Math.sin(this.yaw) * cp, dy = Math.sin(this.pitch), dz = Math.cos(this.yaw) * cp;
    const hit = rayBoxes(tx, ty, tz, dx, dy, dz, boxes, this.dist + 0.4);
    const d = Math.max(1.2, Math.min(this.dist, hit - 0.4));
    camera.position.set(tx + dx * d, ty + dy * d, tz + dz * d);
    camera.lookAt(tx, ty, tz);
  }

  faceBehind(yaw) { this.yaw = yaw + Math.PI; }
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
