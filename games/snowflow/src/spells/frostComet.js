import { FlowSpell, bell, smooth01, STRAND_COLS } from "./flowSpell.js";

const FALL_TIME = 1.85;

/** 9 — A glacial comet, followed by an expanding frost ring and ice crater. */
export class FrostComet extends FlowSpell {
    constructor(ctx) {
        super(ctx, 2, 4.4);
        this.x = 0; this.y = 0; this.z = 0;
        this.dx = 0; this.dz = 1;
        this.impacted = false;
    }

    trigger(x, y, z) {
        if (!this.begin()) return;
        this.x = x; this.y = y; this.z = z;
        const dir = this.ctx.rig.forward;
        const length = Math.hypot(dir.x, dir.z) || 1;
        this.dx = dir.x / length; this.dz = dir.z / length;
        this.impacted = false;
    }

    update(dt) {
        if (!this.advance(dt)) return;
        const ctx = this.ctx;
        if (this.t < FALL_TIME) {
            const fall = Math.pow(this.t / FALL_TIME, 1.7);
            const rise = smooth01(this.t / 0.3);
            // Approach from beyond the target so the falling body stays in
            // front of the camera even when aiming at a nearby snow bank.
            const headX = this.x + this.dx * 7 * (1 - fall);
            const headZ = this.z + this.dz * 7 * (1 - fall);
            const headY = this.y + 12 * (1 - fall) + 0.5;
            for (let c = 0; c < STRAND_COLS; c++) {
                const u = c / (STRAND_COLS - 1);
                const body = Math.sin(Math.PI * Math.min(1, u / 0.34));
                const tail = Math.sin(Math.PI * u) * (1 - u) * 0.35;
                this.point(c, headX + this.dx * u * 4, headY + u * 5.5,
                    headZ + this.dz * u * 4, (body * 0.86 + tail) * rise,
                    0.25 + u * 0.6, 1);
            }
            this.tube(0, rise, 0.18);
            // A ground halo previews the impact point while the comet descends.
            this.ring(1.8 + (1 - fall) * 1.2, rise * 0.5, 0.07, 0.03);
            ctx.lights.add(headX, headY, headZ, 13, 0.34, 0.76, 1, 23 * rise);
            ctx.lights.add(this.x, this.y + 0.3, this.z, 8, 0.35, 0.75, 1, 7 * rise);
            return;
        }
        if (!this.impacted) {
            this.impacted = true;
            ctx.water.clear(this.strands[0]);
            this.impact();
        }
        const since = this.t - FALL_TIME;
        const fade = 1 - smooth01(since / (this.duration - FALL_TIME));
        const radius = 1.7 + since * 4.4;
        this.ring(radius, fade, 0.34 * fade, 0.45 * fade);
        ctx.lights.add(this.x, this.y + 1, this.z, 16, 0.4, 0.78, 1, 32 * fade);
        this.brushOwed += dt;
        if (this.brushOwed >= 0.1 && fade > 0.2) {
            this.brushOwed = 0;
            for (let i = 0; i < 20; i++) {
                const a = i * Math.PI / 10;
                ctx.deform.brush(this.x + Math.cos(a) * radius, this.z + Math.sin(a) * radius,
                    0.6, 0.025 * fade, 0.03 * fade, 0.25, 0.8 * fade, a + Math.PI / 2, 1.8, 0.7);
            }
        }
    }

    ring(radius, alpha, thickness, elevation) {
        const ctx = this.ctx;
        for (let c = 0; c < STRAND_COLS; c++) {
            const u = c / (STRAND_COLS - 1), a = u * Math.PI * 2;
            const x = this.x + Math.cos(a) * radius, z = this.z + Math.sin(a) * radius;
            this.point(c, x, ctx.terrain.heightAt(x, z) + 0.1 + elevation, z,
                thickness * (0.75 + 0.25 * bell(u)), 0.5, 0.7);
        }
        this.tube(1, alpha, 0.22);
    }

    impact() {
        const ctx = this.ctx;
        this.y = ctx.terrain.heightAt(this.x, this.z);
        ctx.deform.brush(this.x, this.z, 2.2, 0.85, 0.7, 1, 1, 0, 1, 0.95);
        for (let i = 0; i < 18; i++) {
            const a = i * 2.39996323;
            const r = 1.4 + Math.sqrt(i / 17) * 1.8;
            const x = this.x + Math.cos(a) * r, z = this.z + Math.sin(a) * r;
            ctx.crystals.plant(x, ctx.terrain.heightAt(x, z) - 0.1, z,
                Math.cos(a) * 0.55, 1, Math.sin(a) * 0.55,
                1.3 + (1 - i / 18) * 1.7, 0.16 + (1 - i / 18) * 0.16, 0.6, 28);
        }
        this.burst(this.x, this.y, this.z, 620, 9);
        ctx.rig.addTrauma(0.36);
    }
}
