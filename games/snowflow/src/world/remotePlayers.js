/**
 * The other mages in the room.
 *
 * They are the *same* character you are. Not a lookalike: the same
 * `CharacterController`, the same 18-bone `Figure`, the same Verlet garment
 * solve, the same shell fur, and the same `SnowContact` — so their boots leave
 * the same prints in the same deformation buffer, their carves cut the same
 * grooves, and their robes catch the same wind. Nothing about a remote body is
 * a second, cheaper animation path.
 *
 * That is why the wire carries so little. A position, a heading and a surf
 * blend go across at fifteen hertz; the controller derives velocity from the
 * move it actually made, and gait, lean, carve, footfalls and cloth all fall
 * out of that identically on every machine. Sending a pose would be both bigger
 * and worse — it would arrive at fifteen hertz.
 *
 * Bodies are built when a room opens, not at boot. A solo player never pays for
 * three characters they will not see, and the build lands on the welcome card
 * where someone is already waiting for a connection.
 */

import { CharacterController } from "../character/controller.js";
import { Character } from "../character/character.js";
import { SnowContact } from "../character/snowContact.js";
import { SurfWake } from "../vfx/surfWake.js";
import { S } from "../core/settings.js";
import { MAX_PLAYERS, PLAYER_COLORS, unpackPlayer } from "../net/room.js";

/** You are never in your own pool. */
export const MAX_REMOTE = MAX_PLAYERS - 1;

/** Seconds between duel hits from one caster onto one body. */
const PVP_COOLDOWN = 1.1;

/** Where a body's mass is, above its feet. The duel test samples here too. */
const CHEST_HEIGHT = 0.75;

/** Metres past which a remote robe is skinned rather than simulated. */
const CLOTH_DISTANCE = 55;
/**
 * Metres past which a remote body stops writing to the snow. The deformation
 * window is 80 m across and `brush` culls anything outside it anyway, so this
 * only saves the spray a boot kicks up — grains that would be a pixel wide.
 */
const CONTACT_DISTANCE = 60;

export class RemotePlayers {
    /**
     * @param {object} deps every system a character needs, exactly as the local
     *   one is given them in `main.js`
     */
    constructor({ scene, terrain, sky, shadows, spray, spells, depthPass, rig }) {
        this.scene = scene;
        this.terrain = terrain;
        this.sky = sky;
        this.shadows = shadows;
        this.spray = spray;
        this.spells = spells;
        this.depthPass = depthPass;
        this.rig = rig;

        /** @type {Array<any>} */
        this.slots = [];
        this.ready = false;
        /** @type {Promise<void>|null} */
        this._building = null;
    }

    /**
     * Build and warm up the bodies. Idempotent, and safe to await from the room
     * panel before it reports a connection: a pipeline that first compiles when
     * a friend walks into view is a visible hitch, and this is the one moment
     * in the session where waiting is already the expected thing.
     */
    provision() {
        if (this.ready) return Promise.resolve();
        if (!this._building) {
            this._building = this._build()
                .then(() => { this.ready = true; })
                // Let a second attempt happen. A cached rejected promise would
                // make one bad moment permanent for the rest of the session.
                .catch((err) => { this._building = null; throw err; });
        }
        return this._building;
    }

    async _build() {
        // Resumes rather than restarts, so a retry after a failure halfway
        // through does not build the bodies that already exist a second time.
        while (this.slots.length < MAX_REMOTE) {
            const controller = new CharacterController(this.terrain);
            const avatar = new Character(
                this.scene, this.terrain, this.sky, this.shadows, controller
            );
            avatar.registerPrepass(this.depthPass);
            avatar.setVisible(false);

            // Their feet write into the same buffer yours do. This one line is
            // the whole of "other players leave footprints".
            const contact = new SnowContact(
                controller, this.terrain.deform, avatar.figure, this.spray
            );

            const wake = new SurfWake(
                this.scene, this.sky, this.shadows, controller, this.spray, this.terrain
            );
            wake.registerPrepass(this.depthPass);
            wake.setEnabled(false);

            // Every surface of theirs a spell can light, on the same four-slot
            // pool yours uses — otherwise a vortex lights you and leaves the
            // friend standing inside it flat.
            this.spells.addConsumers(avatar.bodyMat, avatar.clothMat, wake.material);

            // The shader effects are already compiled — every character shares
            // one program set — so this is binding and buffer allocation rather
            // than a second compile. It still has to finish before anything is
            // drawn with it.
            await avatar.warmUp();
            await wake.warmUp();

            this.slots.push({
                id: "", name: "", colorIndex: -1, live: false,
                controller, avatar, contact, wake,
                x: 0, y: 0, z: 0,
                // `flash` is what *you* see when your spell lands. The damage
                // itself is resolved on their machine and comes back a network
                // tick later, which is far too long to feel like a hit.
                hp: 100, downed: false, hitCooldown: 0, flash: 0,
            });
        }
    }

    /** Everyone currently drawn. The nameplates, the map and duels read this. */
    get live() { return this.slots.filter((s) => s.live); }

    /**
     * Claim slots, drive the bodies, pose them and let them mark the snow.
     *
     * @param {number} dt real seconds — these keep moving while your own world
     *   is paused behind the welcome card, because theirs is not paused
     * @param {import("../net/room.js").Room|null} room
     * @param {{x:number,z:number}} here your own body, for the distance cuts
     */
    update(dt, room, here) {
        if (!this.ready) return;
        const others = room && room.active ? room.others : [];
        const claimed = new Set();

        for (const player of others) {
            // A roster entry arrives before the body does. Placing one early
            // would stand a mage at the world origin for a fifteenth of a second.
            if (!player.hasState) continue;
            const slot = this._slotFor(player.id, claimed);
            if (!slot) continue;
            claimed.add(slot);

            const body = unpackPlayer(player.state);
            const fresh = !slot.live;
            slot.live = true;
            slot.id = player.id;
            slot.name = player.name;
            slot.hp = body.hp;
            slot.downed = body.downed;
            this._recolour(slot, player.colorIndex % PLAYER_COLORS.length);

            if (fresh) {
                slot.controller.placeAt(body);
                // Feet, garments and the trail all come with them, rather than
                // being dragged across the field from wherever this slot was
                // last used.
                slot.avatar.reseat();
                slot.contact.reseat();
            } else if (!body.downed) {
                slot.controller.updateRemote(dt, body);
            } else {
                // Down in the snow is a full stop, exactly as it is for you:
                // a zero step is the controller's own idle path.
                slot.controller.updateRemote(0, body);
            }
        }

        for (const slot of this.slots) {
            if (slot.live && !claimed.has(slot)) this._retire(slot);
            slot.hitCooldown = Math.max(0, slot.hitCooldown - dt);
            slot.flash = Math.max(0, slot.flash - dt * 2.2);
            if (!slot.live) continue;

            const p = slot.controller.position;
            slot.x = p.x; slot.y = p.y; slot.z = p.z;
            const away = Math.hypot(p.x - here.x, p.z - here.z);

            slot.avatar.setVisible(S.showCharacter !== false);
            slot.avatar.update(dt, away < CLOTH_DISTANCE);
            if (away < CONTACT_DISTANCE) slot.contact.update(dt);
            slot.wake.setEnabled(S.showWake !== false);
        }
    }

    /**
     * Push this frame's uniforms and swing the wake.
     *
     * Split from `update` for the reason `Character.sync` is: the garments have
     * to be solved before the contact pass reads the feet, and the uniforms
     * cannot be written until the cascades have been refitted. Called from
     * exactly where the local character does both.
     *
     * @param {number} dt @param {import("@babylonjs/core/Maths/math.vector").Vector3} cameraPos
     */
    render(dt, cameraPos) {
        if (!this.ready) return;
        for (const slot of this.slots) {
            if (!slot.live) continue;
            slot.avatar.sync(cameraPos);
            slot.wake.update(dt, cameraPos);
        }
    }

    /** Triangles drawn for everyone else, for the performance overlay. */
    get triangles() {
        let n = 0;
        for (const slot of this.slots) {
            if (!slot.live) continue;
            n += slot.avatar.triangles;
            if (slot.wake.mesh.isVisible) n += slot.wake.mesh.metadata.triangles;
        }
        return n;
    }

    /**
     * Duel rooms only. Test this client's spells against every visible body and
     * tell the owner what landed — a body's hit points are only ever changed by
     * the client that owns it.
     *
     * @param {import("../net/room.js").Room} room
     * @param {(x:number,y:number,z:number)=>number} hitTest
     * @param {number} damage
     * @param {(slot: any) => void} [onLanded] fires on the caster's own machine
     */
    resolveDuelHits(room, hitTest, damage, onLanded) {
        if (!this.ready || !room?.active || !room.duel) return;
        for (const slot of this.slots) {
            if (!slot.live || slot.downed || slot.hitCooldown > 0) continue;
            // Twice up the body. The test was written for wraiths, which are
            // 2.6 m of ice and wide with it; a mage is a slim 1.75 m and the
            // water sphere is under a metre across, so a cast that visibly
            // washed over someone's chest could pass the check at their boots
            // and register nothing.
            if (!hitTest(slot.x, slot.y, slot.z) &&
                !hitTest(slot.x, slot.y + CHEST_HEIGHT, slot.z)) continue;
            slot.hitCooldown = PVP_COOLDOWN;
            slot.flash = 1;
            room.sendPlayerDamage(slot.id, damage);
            onLanded?.(slot);
        }
    }

    /** Hide every body. Called when a room closes. */
    clear() {
        for (const slot of this.slots) this._retire(slot);
    }

    _retire(slot) {
        slot.live = false;
        slot.id = "";
        slot.avatar.setVisible(false);
        slot.wake.setEnabled(false);
    }

    _recolour(slot, colorIndex) {
        if (slot.colorIndex === colorIndex) return;
        slot.colorIndex = colorIndex;
        slot.avatar.tintGarments(PLAYER_COLORS[colorIndex]);
    }

    _slotFor(id, claimed) {
        for (const slot of this.slots) if (slot.id === id && !claimed.has(slot)) return slot;
        for (const slot of this.slots) if (!slot.live && !claimed.has(slot)) return slot;
        return null;
    }
}
