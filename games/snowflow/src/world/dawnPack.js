/**
 * The frost whirls of the dawn.
 *
 * They run from 05:00 to 07:00 — the hour before sunrise and the hour after —
 * which deliberately overlaps both. At five they join the wraiths that are
 * still out; at six the wraiths melt and the whirls stay. Dawn stops being the
 * safe gap between nights and becomes its own thing.
 *
 * Everything about them is the opposite of a wraith. A wraith has two hit
 * points and walks straight at you at walking pace, and the pressure is that it
 * never stops. A whirl has one hit point and moves three times as fast, and the
 * pressure is that it will not stand still to be hit: it *circles*, holding
 * five metres off your shoulder, and every few seconds one breaks the ring and
 * comes straight in.
 *
 * That difference is the whole point. A slow, aimed spell is the wrong tool
 * against something orbiting you at three and a half metres a second — but a
 * snowball is exactly the right one, so the dawn is the hour the throw earns
 * its place.
 *
 * A note on what they are, because it decided what they are *not*. The obvious
 * dawn creature was an animal, and an animal here would have been a lofted body
 * with four legs that do not move — the whole demo is procedural motion, and a
 * quadruped sliding across snow with its legs held still would be the one thing
 * in the frame that looked unfinished. A whirl of lit snow around a turning
 * core has no pose it can fail to strike: spinning and drifting are complete
 * motions, and the snow it is made of is the best-looking thing the renderer
 * already does.
 */

import { Encounter } from "./encounter.js";

export const MAX_WHIRLS = 5;
/** Real hours. Deliberately spanning the 06:00 boundary. */
export const DAWN_FROM = 5;
export const DAWN_TO = 7;

const SPAWN_INTERVAL = 6;
const OPENING_PACK = 3;

/** How far off your shoulder the ring sits. */
const ORBIT = 5.2;
/** And how close one comes when it breaks the ring. */
const LUNGE_RADIUS = 0.8;

const RUN_SPEED = 3.4;
/** Seconds a lunge lasts, and the wait between one whirl's lunges. */
const LUNGE_SECONDS = 1.15;
const LUNGE_REST = 3.4;

const _near = { x: 0, z: 0, distance: 0, target: null };

export function isDawn(hour) { return hour >= DAWN_FROM && hour < DAWN_TO; }

export class DawnPack extends Encounter {
    constructor({ heightAt, clampPosition, random = Math.random, onEvent = () => {} }) {
        super({ heightAt, clampPosition, random, onEvent, count: MAX_WHIRLS, hp: 1 });
        this.wasDawn = false;
        this.spawnIn = SPAWN_INTERVAL;

        // Quick, light, and they bite rather than shove.
        this.windup = 0.55;
        this.hitCooldownSeconds = 0.45;
        this.contactRadius = 1.25;
        this.knockback = 1.15;
        this.contactSeconds = 1.1;
        this.shieldRadius = 2.9;
        this.shieldReach = 3.2;
        this.deathFade = 0.5;
        this.leash = 70;
    }

    spawn(anchor, facing = 0) {
        const m = this.monsters.find((entry) => !entry.active);
        if (!m) return false;
        if (!this._placeAround(m, anchor, facing, 16, 26, 11)) return false;
        // Staggered, so the pack never lunges in unison.
        m.timer = LUNGE_REST * (0.4 + this.random());
        return true;
    }

    /**
     * @param {number} dt
     * @param {number} hour the world clock, 0..24
     * @param {{x:number,y:number,z:number}} player
     * @param {number} facing
     * @param {(x:number,y:number,z:number)=>number} hitTest
     * @param {boolean} shielded
     * @param {Array<{x:number,y:number,z:number}>} [party]
     */
    update(dt, hour, player, facing, hitTest, shielded, party) {
        if (dt <= 0) return;
        const bodies = party && party.length ? party : [player];

        if (!isDawn(hour)) {
            if (this.wasDawn) this.onEvent("dawnEnd");
            this.clear();
            this.wasDawn = false;
            this.spawnIn = SPAWN_INTERVAL;
            return;
        }
        if (!this.wasDawn) {
            this.wasDawn = true;
            this.onEvent("dawnPack");
            for (let i = 0; i < OPENING_PACK; i++) {
                this.spawn(this._anchor(bodies, player), facing);
            }
            this.spawnIn = SPAWN_INTERVAL;
        }
        this.spawnIn -= dt;
        if (this.spawnIn <= 0) {
            this.spawn(this._anchor(bodies, player), facing);
            this.spawnIn = SPAWN_INTERVAL;
        }

        this.contactCooldown = Math.max(0, this.contactCooldown - dt);
        for (const m of this.monsters) {
            if (!m.active) continue;
            m.age += dt;
            m.flash = Math.max(0, m.flash - dt * 4);
            m.hitCooldown = Math.max(0, m.hitCooldown - dt);
            if (m.hp <= 0) {
                m.death += dt;
                if (m.death >= this.deathFade) m.active = false;
                continue;
            }

            const near = this._nearest(m, bodies, _near);
            if (near.distance > this.leash) { m.active = false; continue; }

            // A single signed timer carries the whole rhythm: positive is the
            // wait, negative is the lunge, and it runs down through zero.
            m.timer -= dt;
            if (m.timer <= -LUNGE_SECONDS) m.timer = LUNGE_REST * (0.7 + this.random() * 0.9);
            const lunging = m.timer < 0;

            // Take a hit. One point is all they have.
            const damage = m.age >= this.windup && m.hitCooldown === 0
                ? (shielded && near.distance < this.shieldReach ? 1 : hitTest(m.x, m.y, m.z))
                : 0;
            if (damage) {
                m.hp -= Number(damage);
                m.flash = 1;
                m.hitCooldown = this.hitCooldownSeconds;
                if (m.hp <= 0) {
                    this.defeated++;
                    this.onEvent("whirlDown", m);
                    continue;
                }
            }

            if (m.age >= this.windup && m.hitCooldown === 0) {
                // Odd ones run the ring the other way, so the pack circles
                // rather than queueing.
                const spin = (m.id % 2 === 0 ? 1 : -1) * (lunging ? 0 : 0.55);
                m.phase += spin * dt;
                const want = lunging ? LUNGE_RADIUS : ORBIT;
                const px = near.target.x + Math.sin(m.phase) * want;
                const pz = near.target.z + Math.cos(m.phase) * want;
                let dx = px - m.x;
                let dz = pz - m.z;
                const reach = Math.hypot(dx, dz);
                if (reach > 0.01) {
                    const speed = RUN_SPEED * (lunging ? 1.35 : 1);
                    const step = Math.min(speed * dt, reach);
                    dx /= reach; dz /= reach;
                    m.x += dx * step;
                    m.z += dz * step;
                    // Faces where it is going, not where you are — that is what
                    // makes a circling animal look like it is circling.
                    m.heading = Math.atan2(dx, dz);
                }
            }

            if (this._touch(m, player, shielded, dt)) this.onEvent("bite", m);
            this.clampPosition(m);
            m.y = this.heightAt(m.x, m.z);
        }
    }
}
