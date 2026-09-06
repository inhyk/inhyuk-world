/** Bounded, renderer-independent night encounters. No timers run while paused. */
export const MAX_MONSTERS = 8;
export const SPAWN_INTERVAL = 8;

/** Numbers per monster on the wire. Keep in step with both methods below. */
const WIRE_STRIDE = 8;
/** Framerate-independent easing, same curve the camera rig uses. */
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

export class NightEncounters {
    constructor({ heightAt, clampPosition, random = Math.random, onEvent = () => {} }) {
        this.heightAt = heightAt;
        this.clampPosition = clampPosition;
        this.random = random;
        this.onEvent = onEvent;
        this.monsters = Array.from({ length: MAX_MONSTERS }, (_, id) => ({
            id, active: false, x: 0, y: 0, z: 0, heading: 0,
            age: 0, hp: 2, hitCooldown: 0, flash: 0, death: 0,
            // Host-fed targets, only ever written on a guest. See `applySnapshot`.
            tx: 0, ty: 0, tz: 0, networked: false,
        }));
        this.wasNight = false;
        this.spawnIn = SPAWN_INTERVAL;
        this.contactCooldown = 0;
        this.defeated = 0;
    }

    get aliveCount() { return this.monsters.filter((m) => m.active && m.hp > 0).length; }

    spawn(player, facing = 0) {
        const m = this.monsters.find((entry) => !entry.active);
        if (!m) return false;
        // Try inward-facing alternatives when the player is at the world's edge.
        for (let attempt = 0; attempt < 12; attempt++) {
            const angle = facing + (this.random() - 0.5) * Math.PI * 2;
            const radius = 14 + this.random() * 7;
            m.x = player.x + Math.sin(angle) * radius;
            m.z = player.z + Math.cos(angle) * radius;
            this.clampPosition(m);
            if (Math.hypot(m.x - player.x, m.z - player.z) < 9) continue;
            m.y = this.heightAt(m.x, m.z);
            m.active = true; m.age = 0; m.hp = 2;
            m.hitCooldown = 0; m.flash = 0; m.death = 0;
            m.heading = Math.atan2(player.x - m.x, player.z - m.z);
            return true;
        }
        return false;
    }

    clear() { for (const m of this.monsters) m.active = false; }

    /** Which body a new shadow appears around. One player: always that one. */
    _anchor(bodies, fallback) {
        if (bodies.length < 2) return fallback;
        return bodies[Math.min(bodies.length - 1, Math.floor(this.random() * bodies.length))];
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
                if (m.death >= 0.65) m.active = false;
                continue;
            }
            // Chase the nearest body, and return to the pool only once every
            // body is out of range — otherwise a shadow would vanish the moment
            // the host walked away from the guest it was hunting.
            let target = bodies[0];
            let distance = Infinity;
            for (let i = 0; i < bodies.length; i++) {
                const d = Math.hypot(bodies[i].x - m.x, bodies[i].z - m.z);
                if (d < distance) { distance = d; target = bodies[i]; }
            }
            if (distance > 75) { m.active = false; continue; }
            const length = distance || 1;
            const nx = distance > 0.001 ? (target.x - m.x) / length : Math.sin(m.heading);
            const nz = distance > 0.001 ? (target.z - m.z) / length : Math.cos(m.heading);
            m.heading = Math.atan2(nx, nz);

            const damage = m.age >= 0.8 && m.hitCooldown === 0
                ? (shielded && distance < 3.5 ? 1 : hitTest(m.x, m.y, m.z)) : 0;
            if (damage) {
                m.hp -= Number(damage); m.flash = 1; m.hitCooldown = 0.7;
                m.x -= nx * 1.35; m.z -= nz * 1.35;
                if (m.hp <= 0) {
                    this.defeated++;
                    this.onEvent("defeat", m);
                    continue;
                }
            }

            const speed = m.hitCooldown > 0 ? 0 : 1.15 + m.id * 0.055;
            if (m.age >= 0.8 && distance > 1.2) {
                const step = Math.min(speed * dt, distance - 1.2);
                m.x += nx * step; m.z += nz * step;
            }
            // The shield and the shove are always about *this* client's body,
            // whoever the shadow happens to be chasing.
            const mine = Math.hypot(m.x - player.x, m.z - player.z);
            const away = mine || 1;
            const ax = mine > 0.001 ? (player.x - m.x) / away : Math.sin(m.heading);
            const az = mine > 0.001 ? (player.z - m.z) / away : Math.cos(m.heading);
            if (shielded && mine < 3.15) {
                m.x = player.x - ax * 3.15; m.z = player.z - az * 3.15;
            } else if (!shielded && mine < 1.55 && m.age >= 0.8 && this.contactCooldown === 0) {
                player.x += ax * 1.7; player.z += az * 1.7;
                this.clampPosition(player);
                player.y = this.heightAt(player.x, player.z);
                this.contactCooldown = 1.5;
                this.onEvent("contact", m);
            }
            this.clampPosition(m);
            m.y = this.heightAt(m.x, m.z);
        }
    }

    // ------------------------------------------------------------ networking
    //
    // In a room the shadows belong to the host. Guests do not simulate them at
    // all: they receive a snapshot fifteen times a second, ease the meshes
    // toward it, and report their own spell hits back. One simulation means
    // everyone in the room fights the same eight creatures rather than eight
    // each.

    /**
     * Flat wire form of every slot, allocated once and reused.
     * @returns {number[]}
     */
    snapshot() {
        const out = this._wire || (this._wire = new Array(MAX_MONSTERS * WIRE_STRIDE));
        for (let i = 0; i < this.monsters.length; i++) {
            const m = this.monsters[i], o = i * WIRE_STRIDE;
            out[o] = m.active ? 1 : 0;
            out[o + 1] = Math.round(m.x * 100) / 100;
            out[o + 2] = Math.round(m.y * 100) / 100;
            out[o + 3] = Math.round(m.z * 100) / 100;
            out[o + 4] = Math.round(m.heading * 1000) / 1000;
            out[o + 5] = m.hp;
            out[o + 6] = Math.round(m.age * 100) / 100;
            out[o + 7] = Math.round(m.death * 100) / 100;
        }
        return out;
    }

    /**
     * Adopt a host snapshot. Positions land in a target the guest eases toward,
     * so a fifteen-hertz feed does not read as fifteen-hertz movement.
     * @param {number[]} wire
     */
    applySnapshot(wire) {
        if (!Array.isArray(wire)) return;
        for (let i = 0; i < this.monsters.length; i++) {
            const m = this.monsters[i], o = i * WIRE_STRIDE;
            if (o + WIRE_STRIDE > wire.length) break;
            const active = wire[o] === 1;
            // A slot that has just come back is placed, not eased in from
            // wherever the previous occupant of the pool died.
            const teleport = active && !m.active;
            m.active = active;
            m.networked = true;
            m.tx = wire[o + 1]; m.ty = wire[o + 2]; m.tz = wire[o + 3];
            if (teleport) { m.x = m.tx; m.y = m.ty; m.z = m.tz; }
            m.heading = wire[o + 4];
            m.hp = wire[o + 5];
            m.age = wire[o + 6];
            m.death = wire[o + 7];
        }
    }

    /**
     * The guest's frame. No spawning, no pursuit, no authority over hit points:
     * ease toward the host's positions, test this client's own spells against
     * them and report, and take contact damage locally.
     *
     * @param {number} dt
     * @param {{x:number,y:number,z:number}} player
     * @param {(x:number,y:number,z:number)=>number} hitTest
     * @param {boolean} shielded
     * @param {(id:number, damage:number)=>void} reportHit
     */
    updateRemote(dt, player, hitTest, shielded, reportHit) {
        if (dt <= 0) return;
        this.contactCooldown = Math.max(0, this.contactCooldown - dt);
        for (const m of this.monsters) {
            if (!m.active) continue;
            m.flash = Math.max(0, m.flash - dt * 3);
            m.hitCooldown = Math.max(0, m.hitCooldown - dt);
            if (m.networked) {
                m.x = damp(m.x, m.tx, 14, dt);
                m.y = damp(m.y, m.ty, 14, dt);
                m.z = damp(m.z, m.tz, 14, dt);
            }
            if (m.hp <= 0) continue;

            const dx = player.x - m.x, dz = player.z - m.z;
            const distance = Math.hypot(dx, dz);
            const length = distance || 1;
            const nx = distance > 0.001 ? dx / length : Math.sin(m.heading);
            const nz = distance > 0.001 ? dz / length : Math.cos(m.heading);

            if (m.age >= 0.8 && m.hitCooldown === 0) {
                const damage = shielded && distance < 3.5 ? 1 : hitTest(m.x, m.y, m.z);
                if (damage) {
                    m.flash = 1;
                    m.hitCooldown = 0.7;
                    reportHit(m.id, Number(damage));
                }
            }
            if (!shielded && distance < 1.55 && m.age >= 0.8 && this.contactCooldown === 0) {
                player.x += nx * 1.7; player.z += nz * 1.7;
                this.clampPosition(player);
                player.y = this.heightAt(player.x, player.z);
                this.contactCooldown = 1.5;
                this.onEvent("contact", m);
            }
        }
    }

    /**
     * Host side: land a hit a guest reported. Same bookkeeping the local path
     * does, so a shadow killed by a guest still counts and still fades out.
     * @param {number} id
     * @param {number} damage
     */
    applyReportedHit(id, damage) {
        const m = this.monsters[id];
        if (!m || !m.active || m.hp <= 0) return;
        const value = Math.min(2, Math.max(0, Number(damage) || 0));
        if (!value) return;
        m.hp -= value;
        m.flash = 1;
        m.hitCooldown = 0.7;
        if (m.hp <= 0) {
            this.defeated++;
            this.onEvent("defeat", m);
        }
    }
}
