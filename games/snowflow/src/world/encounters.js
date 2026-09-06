/** Bounded, renderer-independent night encounters. No timers run while paused. */

import { Encounter } from "./encounter.js";

export const MAX_MONSTERS = 8;
export const SPAWN_INTERVAL = 8;

const _near = { x: 0, z: 0, distance: 0, target: null };

/**
 * The ice wraiths. Slow, heavy, two hit points, and they walk straight at
 * whoever is nearest — the night's pressure is that they never stop coming and
 * never let go, not that any one of them is quick.
 */
export class NightEncounters extends Encounter {
    constructor({ heightAt, clampPosition, random = Math.random, onEvent = () => {} }) {
        super({ heightAt, clampPosition, random, onEvent, count: MAX_MONSTERS, hp: 2 });
        this.wasNight = false;
        this.spawnIn = SPAWN_INTERVAL;
    }

    spawn(player, facing = 0) {
        const m = this.monsters.find((entry) => !entry.active);
        if (!m) return false;
        // Try inward-facing alternatives when the player is at the world's edge.
        return this._placeAround(m, player, facing, 14, 21, 9);
    }

    /**
     * @param {number} dt
     * @param {boolean} isNight
     * @param {{x:number,y:number,z:number}} player this client's own body — the
     *   only one that can be shoved or shielded here
     * @param {number} facing
     * @param {(x:number,y:number,z:number)=>number} hitTest
     * @param {boolean} shielded
     * @param {Array<{x:number,y:number,z:number}>} [party] every body in the
     *   room. Shadows spawn around a random one and chase the nearest, so a
     *   guest who wanders off still has a night happening around them.
     */
    update(dt, isNight, player, facing, hitTest, shielded, party) {
        if (dt <= 0) return;
        const bodies = party && party.length ? party : [player];
        if (!isNight) {
            if (this.wasNight) this.onEvent("dawn");
            this.clear();
            this.wasNight = false;
            this.spawnIn = SPAWN_INTERVAL;
            return;
        }
        if (!this.wasNight) {
            this.wasNight = true;
            this.onEvent("night");
            for (let i = 0; i < 4; i++) this.spawn(this._anchor(bodies, player), facing);
            this.spawnIn = SPAWN_INTERVAL;
        }
        this.spawnIn -= dt;
        if (this.spawnIn <= 0) {
            this.spawn(this._anchor(bodies, player), facing);
            // Never burst-spawn after a long frame or a paused browser tab.
            this.spawnIn = SPAWN_INTERVAL;
        }
        this.contactCooldown = Math.max(0, this.contactCooldown - dt);
        for (const m of this.monsters) {
            if (!m.active) continue;
            m.age += dt;
            m.flash = Math.max(0, m.flash - dt * 3);
            m.hitCooldown = Math.max(0, m.hitCooldown - dt);
            if (m.hp <= 0) {
                m.death += dt;
                if (m.death >= this.deathFade) m.active = false;
                continue;
            }
            // Chase the nearest body, and return to the pool only once every
            // body is out of range — otherwise a shadow would vanish the moment
            // the host walked away from the guest it was hunting.
            const near = this._nearest(m, bodies, _near);
            if (near.distance > this.leash) { m.active = false; continue; }
            const nx = near.x, nz = near.z;
            m.heading = Math.atan2(nx, nz);

            const damage = m.age >= this.windup && m.hitCooldown === 0
                ? (shielded && near.distance < this.shieldReach ? 1 : hitTest(m.x, m.y, m.z))
                : 0;
            if (damage) {
                m.hp -= Number(damage);
                m.flash = 1;
                m.hitCooldown = this.hitCooldownSeconds;
                m.x -= nx * 1.35; m.z -= nz * 1.35;
                if (m.hp <= 0) {
                    this.defeated++;
                    this.onEvent("defeat", m);
                    continue;
                }
            }

            const speed = m.hitCooldown > 0 ? 0 : 1.15 + m.id * 0.055;
            if (m.age >= this.windup && near.distance > 1.2) {
                const step = Math.min(speed * dt, near.distance - 1.2);
                m.x += nx * step; m.z += nz * step;
            }
            this._touch(m, player, shielded, dt);
            this.clampPosition(m);
            m.y = this.heightAt(m.x, m.z);
        }
    }
}
