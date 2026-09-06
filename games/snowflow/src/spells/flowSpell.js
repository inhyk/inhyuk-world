import { PROFILE_TUBE, STRAND_COLS } from "./waterBody.js";
import { bell, smooth01, transport } from "./bending.js";

/** Shared lifetime and allocation for the four additional water spells. */
export class FlowSpell {
    constructor(ctx, strandCount, duration) {
        this.ctx = ctx;
        this.duration = duration;
        this.strands = new Int16Array(strandCount).fill(-1);
        this.active = false;
        this.t = 0;
        this.sprayOwed = 0;
        this.brushOwed = 0;
        // x/y/z, radius, foam, flatten. Reused for every strand, every frame.
        this.points = new Float32Array(STRAND_COLS * 6);
        this.right = new Float32Array(3);
    }

    begin() {
        // Recasting replaces this spell's previous shape without taking slots
        // from another spell. Acquisition is atomic if the pool is exhausted.
        this.cancel();
        for (let i = 0; i < this.strands.length; i++) {
            this.strands[i] = this.ctx.water.acquire();
            if (this.strands[i] < 0) {
                this.cancel();
                return false;
            }
        }
        this.t = 0;
        this.sprayOwed = 0;
        this.brushOwed = 0;
        this.active = true;
        return true;
    }

    advance(dt) {
        if (!this.active) return false;
        this.t += dt;
        if (this.t >= this.duration) {
            this.cancel();
            return false;
        }
        return true;
    }

    envelope(rise = 0.45, fall = 0.8) {
        return smooth01(this.t / rise) * (1 - smooth01((this.t - this.duration + fall) / fall));
    }

    point(c, x, y, z, radius, foam = 0.1, flatten = 1) {
        const o = c * 6;
        const p = this.points;
        p[o] = x; p[o + 1] = y; p[o + 2] = z;
        p[o + 3] = radius; p[o + 4] = foam; p[o + 5] = flatten;
    }

    tube(slot, alpha, milkiness = 0.12, count = STRAND_COLS) {
        const s = this.strands[slot];
        if (s < 0) return;
        const p = this.points;
        let rx = 0, ry = 1, rz = 0;
        let tx = p[6] - p[0], ty = p[7] - p[1], tz = p[8] - p[2];
        let len = Math.hypot(tx, ty, tz) || 1;
        tx /= len; ty /= len; tz /= len;
        if (Math.abs(ty) > 0.9) { rx = 1; ry = 0; }
        let distance = 0;
        for (let c = 0; c < count; c++) {
            const o = c * 6;
            if (c > 0) {
                let nx = p[o] - p[o - 6], ny = p[o + 1] - p[o - 5], nz = p[o + 2] - p[o - 4];
                len = Math.hypot(nx, ny, nz) || 1;
                distance += len;
                nx /= len; ny /= len; nz /= len;
                transport(this.right, 0, rx, ry, rz, tx, ty, tz, nx, ny, nz);
                rx = this.right[0]; ry = this.right[1]; rz = this.right[2];
                tx = nx; ty = ny; tz = nz;
            }
            this.ctx.water.column(s, c, p[o], p[o + 1], p[o + 2], p[o + 3],
                rx, ry, rz, 0, distance, this.t / this.duration, p[o + 4], p[o + 5]);
        }
        this.ctx.water.setParams(s, PROFILE_TUBE, milkiness, alpha, count);
    }

    /** Radial impact spray; uses the existing bounded particle pool. */
    burst(x, y, z, count, speed) {
        const n = Math.min(700, Math.floor(count * this.ctx.sprayScale));
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * 0.7;
            const velocity = speed * (0.3 + Math.random() * 0.7);
            this.ctx.spray.emit(x + Math.cos(a) * r, y + 0.15, z + Math.sin(a) * r,
                Math.cos(a) * velocity, speed * (0.35 + Math.random() * 0.7), Math.sin(a) * velocity,
                0.03 + Math.random() * 0.09, 0.7 + Math.random() * 1.1, i % 4 === 0 ? 1 : 0, 1.1);
        }
    }

    cancel() {
        for (let i = 0; i < this.strands.length; i++) {
            if (this.strands[i] >= 0) this.ctx.water.release(this.strands[i]);
            this.strands[i] = -1;
        }
        this.active = false;
    }
}

export { bell, smooth01, STRAND_COLS };
