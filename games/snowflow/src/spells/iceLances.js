import { FlowSpell, smooth01, STRAND_COLS } from "./flowSpell.js";

const CHARGE = 0.6;
const FLIGHT = 1.2;
const STAGGER = 0.18;

/** 7 — Three charged ice lances converge on the aim and freeze their impacts. */
export class IceLances extends FlowSpell {
    constructor(ctx) {
        super(ctx, 3, 2.9);
        this.origins = new Float32Array(9);
        this.targets = new Float32Array(9);
        this.hit = new Uint8Array(3);
    }

    trigger(x, y, z) {
        if (!this.begin()) return;
        this.hit.fill(0);
        const pos = this.ctx.controller.position;
        const dx = x - pos.x, dz = z - pos.z;
        const len = Math.hypot(dx, dz) || 1;
        const rx = dz / len, rz = -dx / len;
        for (let i = 0; i < 3; i++) {
            const o = i * 3, side = (i - 1) * 1.15;
            this.origins[o] = pos.x + dx / len * 1.4 + rx * side;
            this.origins[o + 1] = pos.y + 1.6 + (i === 1 ? 0.7 : 0);
            this.origins[o + 2] = pos.z + dz / len * 1.4 + rz * side;
            this.targets[o] = x + rx * side * 1.4;
            this.targets[o + 2] = z + rz * side * 1.4;
            this.targets[o + 1] = this.ctx.terrain.heightAt(this.targets[o], this.targets[o + 2]);
        }
    }

    update(dt) {
        if (!this.advance(dt)) return;
        const ctx = this.ctx;
        let lx = 0, ly = 0, lz = 0, live = 0;
        for (let i = 0; i < 3; i++) {
            if (this.hit[i]) continue;
            const o = i * 3;
            const local = this.t - STAGGER * i;
            if (local <= 0) continue;
            const flight = Math.max(0, (local - CHARGE) / FLIGHT);
            const progress = Math.min(1, flight * flight);
            const ox = this.origins[o], oy = this.origins[o + 1], oz = this.origins[o + 2];
            let dx = this.targets[o] - ox, dy = this.targets[o + 1] - oy, dz = this.targets[o + 2] - oz;
            const length = Math.hypot(dx, dy, dz) || 1;
            const x = ox + dx * progress, y = oy + dy * progress, z = oz + dz * progress;
            dx /= length; dy /= length; dz /= length;
            if (flight >= 1 || (flight > 0.08 && y <= ctx.terrain.heightAt(x, z) + 0.05)) {
                this.hit[i] = 1;
                ctx.water.clear(this.strands[i]);
                this.impact(x, z, dx, dz);
                continue;
            }
            const charge = smooth01(local / CHARGE);
            for (let c = 0; c < STRAND_COLS; c++) {
                const u = c / (STRAND_COLS - 1);
                // Needle tip, broad shoulder, long tapering tail.
                const width = Math.sin(Math.PI * Math.pow(u, 0.52));
                const back = u * 3.7 * charge;
                this.point(c, x - dx * back, y - dy * back, z - dz * back,
                    0.24 * width * width * charge, 0.08, 0.72);
            }
            this.tube(i, charge, 0.3);
            lx += x; ly += y; lz += z; live++;
        }
        if (live) ctx.lights.add(lx / live, ly / live, lz / live, 9, 0.4, 0.82, 1, 17);
    }

    impact(x, z, dx, dz) {
        const ctx = this.ctx;
        const y = ctx.terrain.heightAt(x, z);
        ctx.deform.brush(x, z, 0.8, 0.22, 0.18, 0.85, 1, Math.atan2(dx, dz), 1.8, 0.85);
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2;
            const px = x + Math.cos(a) * 0.28, pz = z + Math.sin(a) * 0.28;
            ctx.crystals.plant(px, ctx.terrain.heightAt(px, pz) - 0.08, pz,
                dx * 0.5 + Math.cos(a) * 0.2, 1, dz * 0.5 + Math.sin(a) * 0.2,
                0.9 + i * 0.22, 0.12 + i * 0.02, 0.22, 20);
        }
        this.burst(x, y, z, 95, 4);
        ctx.rig.addTrauma(0.08);
    }
}
