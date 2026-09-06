import { FlowSpell, bell, smooth01, STRAND_COLS } from "./flowSpell.js";
import { PROFILE_SHEET } from "./waterBody.js";

/** 8 — A broad, tall breaking wave that pushes a corridor through the snow. */
export class TidalWave extends FlowSpell {
    constructor(ctx) {
        super(ctx, 1, 4.6);
        this.x = 0; this.z = 0; this.dx = 0; this.dz = 1;
    }

    trigger(dx, dz) {
        if (!this.begin()) return;
        const length = Math.hypot(dx, dz) || 1;
        this.dx = dx / length; this.dz = dz / length;
        this.x = this.ctx.controller.position.x + this.dx * 3;
        this.z = this.ctx.controller.position.z + this.dz * 3;
    }

    update(dt) {
        if (!this.advance(dt)) return;
        const ctx = this.ctx;
        const env = this.envelope(0.85, 1.3);
        const travel = Math.max(0, this.t - 0.55) * 4.8;
        const centerX = this.x + this.dx * travel;
        const centerZ = this.z + this.dz * travel;
        const width = 5.8 + smooth01(this.t / 2) * 2.2;
        const height = 5.6 * env;
        for (let c = 0; c < STRAND_COLS; c++) {
            const u = c / (STRAND_COLS - 1), side = (u - 0.5) * 2;
            const x = centerX + this.dz * side * width - this.dx * side * side * 1.5;
            const z = centerZ - this.dx * side * width - this.dz * side * side * 1.5;
            ctx.water.column(this.strands[0], c, x, ctx.terrain.heightAt(x, z) - 0.14, z,
                height * Math.pow(bell(u), 0.65), this.dx, 0, this.dz,
                0.86 + 0.12 * Math.sin(this.t * 1.3), u * width * 2, this.t / this.duration,
                0.35 + 0.4 * bell(u), 1);
        }
        ctx.water.setParams(this.strands[0], PROFILE_SHEET, 0.24, Math.min(1, env * 1.5), STRAND_COLS);
        ctx.lights.add(centerX, ctx.terrain.heightAt(centerX, centerZ) + height * 0.55,
            centerZ, 15, 0.3, 0.76, 1, 24 * env);

        this.brushOwed += dt;
        if (this.brushOwed >= 0.08 && env > 0.1) {
            const amount = Math.min(this.brushOwed, 0.16);
            this.brushOwed = 0;
            for (let i = 0; i < 15; i++) {
                const u = i / 14, side = (u - 0.5) * 2;
                const x = centerX + this.dz * side * width - this.dx * side * side * 1.5;
                const z = centerZ - this.dx * side * width - this.dz * side * side * 1.5;
                ctx.deform.brush(x, z, 0.85, amount * env * 0.65 * bell(u),
                    amount * env * 0.55 * bell(u), amount * 1.4, 0.28,
                    Math.atan2(this.dz, -this.dx), 1.5, 0.9);
            }
        }
        this.sprayOwed += dt * 650 * env * ctx.sprayScale;
        const count = Math.min(90, Math.floor(this.sprayOwed));
        this.sprayOwed -= count;
        for (let i = 0; i < count; i++) {
            const u = Math.random(), side = (u - 0.5) * 2;
            const x = centerX + this.dz * side * width;
            const z = centerZ - this.dx * side * width;
            ctx.spray.emit(x, ctx.terrain.heightAt(x, z) + height * bell(u) * 0.85, z,
                this.dx * 4 + (Math.random() - 0.5), 1 + Math.random() * 2.5,
                this.dz * 4 + (Math.random() - 0.5), 0.055 + Math.random() * 0.08,
                0.75 + Math.random() * 0.65, 0, 1.3);
        }
    }
}
