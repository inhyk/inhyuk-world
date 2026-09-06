/**
 * What every creature in this world has in common.
 *
 * A fixed pool, a wire format, and the guest side of a room — the parts that
 * have nothing to do with *what* the creature is. Two things extend it: the ice
 * wraiths of the night, and the frost wolves that run at dawn. They behave
 * nothing alike; they are networked identically, and they should be, because a
 * second hand-written snapshot format is a second place for the host and the
 * guest to quietly disagree.
 *
 * Renderer-independent and clock-independent. No timers run while paused.
 */

/** Numbers per creature on the wire. Shared by every encounter. */
export const WIRE_STRIDE = 8;

const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

export class Encounter {
    /**
     * @param {object} options
     * @param {(x:number,z:number)=>number} options.heightAt
     * @param {(p:{x:number,z:number})=>void} options.clampPosition
     * @param {number} options.count pool size
     * @param {number} options.hp hit points each
     */
    constructor({ heightAt, clampPosition, count, hp, random = Math.random, onEvent = () => {} }) {
        this.heightAt = heightAt;
        this.clampPosition = clampPosition;
        this.random = random;
        this.onEvent = onEvent;
        this.maxHp = hp;

        this.monsters = Array.from({ length: count }, (_, id) => ({
            id, active: false, x: 0, y: 0, z: 0, heading: 0,
            age: 0, hp, hitCooldown: 0, flash: 0, death: 0,
            /** Free per-creature state. The wolves keep their orbit here... */
            phase: 0,
            /** ...and the rhythm of their lunges here. */
            timer: 0,
            // Host-fed targets, only ever written on a guest. See `applySnapshot`.
            tx: 0, ty: 0, tz: 0, networked: false,
        }));

        this.contactCooldown = 0;
        this.defeated = 0;

        // ------------------------------------------------------- tunables
        /** Seconds after a spawn before it can touch or be touched. */
        this.windup = 0.8;
        /** Seconds a creature is stunned after taking a hit. */
        this.hitCooldownSeconds = 0.7;
        /** How close it has to get to shove you. */
        this.contactRadius = 1.55;
        this.knockback = 1.7;
        /** Seconds before anything can shove you again. */
        this.contactSeconds = 1.5;
        /** The water shield holds them out at this radius, and counts as a hit
         *  inside this reach. */
        this.shieldRadius = 3.15;
        this.shieldReach = 3.5;
        /** Seconds a corpse takes to fade before its slot is reused. */
        this.deathFade = 0.65;
        /** Past this from every body in the party, it gives up and despawns. */
        this.leash = 75;
    }

    get aliveCount() { return this.monsters.filter((m) => m.active && m.hp > 0).length; }

    clear() { for (const m of this.monsters) m.active = false; }

    /** Which body a new creature appears around. One player: always that one. */
    _anchor(bodies, fallback) {
        if (bodies.length < 2) return fallback;
        return bodies[Math.min(bodies.length - 1, Math.floor(this.random() * bodies.length))];
    }

    /**
     * Put a creature on the ground somewhere around `anchor`, outside `safe`.
     * @returns {boolean} false when every attempt landed too close
     */
    _placeAround(m, anchor, facing, min, max, safe) {
        for (let attempt = 0; attempt < 12; attempt++) {
            const angle = facing + (this.random() - 0.5) * Math.PI * 2;
            const radius = min + this.random() * (max - min);
            m.x = anchor.x + Math.sin(angle) * radius;
            m.z = anchor.z + Math.cos(angle) * radius;
            this.clampPosition(m);
            if (Math.hypot(m.x - anchor.x, m.z - anchor.z) < safe) continue;
            m.y = this.heightAt(m.x, m.z);
            m.active = true;
            m.age = 0;
            m.hp = this.maxHp;
            m.hitCooldown = 0;
            m.flash = 0;
            m.death = 0;
            m.phase = this.random() * Math.PI * 2;
            m.heading = Math.atan2(anchor.x - m.x, anchor.z - m.z);
            return true;
        }
        return false;
    }

    /** Nearest body in the party, and the unit vector from `m` toward it. */
    _nearest(m, bodies, out) {
        let target = bodies[0];
        let distance = Infinity;
        for (let i = 0; i < bodies.length; i++) {
            const d = Math.hypot(bodies[i].x - m.x, bodies[i].z - m.z);
            if (d < distance) { distance = d; target = bodies[i]; }
        }
        const length = distance || 1;
        out.x = distance > 0.001 ? (target.x - m.x) / length : Math.sin(m.heading);
        out.z = distance > 0.001 ? (target.z - m.z) / length : Math.cos(m.heading);
        out.distance = distance;
        out.target = target;
        return out;
    }

    /**
     * Shield and shove, always against *this* client's body whoever the
     * creature happens to be chasing.
     * @returns {boolean} true when a shove landed
     */
    _touch(m, player, shielded, dt) {
        const mine = Math.hypot(m.x - player.x, m.z - player.z);
        const away = mine || 1;
        const ax = mine > 0.001 ? (player.x - m.x) / away : Math.sin(m.heading);
        const az = mine > 0.001 ? (player.z - m.z) / away : Math.cos(m.heading);
        if (shielded && mine < this.shieldRadius) {
            m.x = player.x - ax * this.shieldRadius;
            m.z = player.z - az * this.shieldRadius;
            return false;
        }
        if (!shielded && mine < this.contactRadius && m.age >= this.windup &&
            this.contactCooldown === 0) {
            player.x += ax * this.knockback;
            player.z += az * this.knockback;
            this.clampPosition(player);
            player.y = this.heightAt(player.x, player.z);
            this.contactCooldown = this.contactSeconds;
            this.onEvent("contact", m);
            return true;
        }
        return false;
    }

    // ------------------------------------------------------------ networking
    //
    // In a room the creatures belong to the host. Guests do not simulate them
    // at all: they receive a snapshot fifteen times a second, ease toward it,
    // and report their own hits back. One simulation means everyone in the room
    // fights the same creatures rather than a private set each.

    /** Flat wire form of every slot, allocated once and reused. */
    snapshot() {
        const out = this._wire ||
            (this._wire = new Array(this.monsters.length * WIRE_STRIDE));
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
     * ease toward the host's positions, test this client's own attacks against
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

            const distance = Math.hypot(player.x - m.x, player.z - m.z);
            if (m.age >= this.windup && m.hitCooldown === 0) {
                const damage = shielded && distance < this.shieldReach
                    ? 1
                    : hitTest(m.x, m.y, m.z);
                if (damage) {
                    m.flash = 1;
                    m.hitCooldown = this.hitCooldownSeconds;
                    reportHit(m.id, Number(damage));
                }
            }
            this._touch(m, player, shielded, dt);
        }
    }

    /**
     * Host side: land a hit a guest reported, or one a snowball landed. Same
     * bookkeeping the local path does, so a creature killed by someone else
     * still counts and still fades out.
     */
    applyReportedHit(id, damage) {
        const m = this.monsters[id];
        if (!m || !m.active || m.hp <= 0) return;
        const value = Math.min(this.maxHp, Math.max(0, Number(damage) || 0));
        if (!value) return;
        m.hp -= value;
        m.flash = 1;
        m.hitCooldown = this.hitCooldownSeconds;
        if (m.hp <= 0) {
            this.defeated++;
            this.onEvent("defeat", m);
        }
    }
}
