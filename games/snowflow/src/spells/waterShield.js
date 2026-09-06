import { FlowSpell, bell, STRAND_COLS } from "./flowSpell.js";

/** 6 — Three flowing bands form an orbiting shell around the traveller. */
export class WaterShield extends FlowSpell {
    constructor(ctx) {
        super(ctx, 3, 6.5);
    }

    trigger() {
        this.begin();
    }

    update(dt) {
        if (!this.advance(dt)) return;
        const ctx = this.ctx;
        const pos = ctx.controller.position;
        const env = this.envelope(0.55, 1.0);
        const radius = 2.1 * env;
        const spin = this.t * 1.5;
        for (let ring = 0; ring < 3; ring++) {
            const tilt = (ring - 1) * 1.02;
            const yaw = spin * (ring === 1 ? -1 : 1) + ring * Math.PI / 3;
            const cy = Math.cos(yaw), sy = Math.sin(yaw);
            for (let c = 0; c < STRAND_COLS; c++) {
                const u = c / (STRAND_COLS - 1);
                const a = u * Math.PI * 2 + spin;
                const ax = Math.cos(a) * radius;
                const az = Math.sin(a) * radius * Math.cos(tilt);
                const x = pos.x + ax * cy - az * sy;
                const z = pos.z + ax * sy + az * cy;
                const y = Math.max(ctx.terrain.heightAt(x, z) + 0.12,
                    pos.y + 1.6 + Math.sin(a) * radius * Math.sin(tilt));
                this.point(c, x, y, z, (0.12 + 0.15 * bell(u)) * env,
                    0.07 + 0.2 * bell(u), 1.35);
            }
            this.tube(ring, env * 0.8, 0.08);
        }
        ctx.lights.add(pos.x, pos.y + 1.5, pos.z, 7, 0.28, 0.85, 1, 13 * env);

        this.brushOwed += dt;
        if (this.brushOwed >= 0.12 && env > 0.15) {
            this.brushOwed %= 0.12;
            for (let i = 0; i < 12; i++) {
                const a = i * Math.PI / 6 + spin;
                ctx.deform.brush(pos.x + Math.cos(a) * radius, pos.z + Math.sin(a) * radius,
                    0.25, 0.012 * env, 0.014 * env, 0.08, 0.3, a + Math.PI / 2, 1.6, 0.6);
            }
        }
        this.sprayOwed += dt * 110 * ctx.sprayScale * env;
        const count = Math.min(30, Math.floor(this.sprayOwed));
        this.sprayOwed -= count;
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            ctx.spray.emit(pos.x + Math.cos(a) * radius, pos.y + 1.5 + Math.sin(a) * radius * 0.5,
                pos.z + Math.sin(a) * radius, -Math.sin(a) * 1.8, 0.5, Math.cos(a) * 1.8,
                0.04, 0.65, 0, 2.4);
        }
    }
}
