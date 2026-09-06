/**
 * The other mages in the room.
 *
 * Pooled exactly the way the shadows are: one merged mesh per slot, cloned
 * from a single template, one material each, all registered with the depth
 * prepass so they are in the depth of field and the light shafts rather than
 * pasted on top of them.
 *
 * They are deliberately *not* the player's own figure. That one is an 18-bone
 * skeleton with a Verlet cloth solve and shell fur behind it; three more of
 * those would be three more cloth solves and seven more pipelines for bodies
 * that are usually fifteen metres away and read as a silhouette and a colour.
 * A lofted robe with the player's colour in the rim does that job at a
 * thousandth of the cost, and — the part that actually matters in play — it
 * stays instantly distinguishable from your own character and from a wraith.
 *
 * Positions arrive at fifteen hertz and are eased here, so the feed rate is
 * never visible in the movement.
 */

import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import { Color3 } from "@babylonjs/core/Maths/math.color";

import { whenReady } from "../core/gpuUtil.js";
import { angleDamp } from "../character/controller.js";
import { MAX_PLAYERS, PLAYER_COLORS, unpackPlayer } from "../net/room.js";
import vertexSource from "../shaders/monster.vertex.wgsl?raw";
import fragmentSource from "../shaders/avatar.fragment.wgsl?raw";
import depthSource from "../shaders/monsterPrepass.fragment.wgsl?raw";

/** You are never in your own pool. */
export const MAX_REMOTE = MAX_PLAYERS - 1;

/** Seconds between duel hits from one caster onto one body. */
const PVP_COOLDOWN = 1.1;

const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

export class RemotePlayers {
    /**
     * @param {import("@babylonjs/core/scene").Scene} scene
     * @param {import("../core/camera.js").CameraRig} rig
     * @param {import("../render/depthPass.js").DepthPass} depthPass
     */
    constructor(scene, rig, depthPass) {
        this.rig = rig;
        this.time = 0;

        const template = makeMage(scene);
        this.depthMaterial = new ShaderMaterial("magePrepass", scene,
            { vertexSource, fragmentSource: depthSource }, {
                attributes: ["position", "normal", "color"],
                uniforms: ["world", "viewProjection"], shaderLanguage: ShaderLanguage.WGSL,
            });

        /** @type {Array<any>} */
        this.slots = [];
        for (let i = 0; i < MAX_REMOTE; i++) {
            const mesh = i === 0 ? template : template.clone(`mage-${i}`);
            const material = new ShaderMaterial(`mageMat-${i}`, scene,
                { vertexSource, fragmentSource }, {
                    attributes: ["position", "normal", "color"],
                    uniforms: ["world", "viewProjection", "cameraPosition", "tint", "flash", "fade"],
                    shaderLanguage: ShaderLanguage.WGSL,
                });
            mesh.material = material;
            mesh.renderingGroupId = 1;
            mesh.isPickable = false;
            mesh.isVisible = false;
            material.setColor3("tint", new Color3(...PLAYER_COLORS[0]));
            material.setFloat("flash", 0);
            material.setFloat("fade", 0);
            material.setVector3("cameraPosition", rig.camera.position);
            // Depth prepass only, exactly like the wraiths: a shadow caster
            // needs a per-cascade material carrying that cascade's matrix, and
            // a 2 m robe's own shadow is a smudge at cascade resolution.
            depthPass.registerCaster(mesh, this.depthMaterial);

            this.slots.push({
                id: "", name: "", colorIndex: 0, live: false, appear: 0,
                mesh, material,
                x: 0, y: 0, z: 0, facing: 0, surf: 0, speed01: 0,
                hp: 100, downed: false, fade: 0, flash: 0, hitCooldown: 0,
            });
        }
    }

    async warmUp() {
        for (const slot of this.slots) {
            await whenReady(slot.material, "remote mage", [slot.mesh, false]);
        }
    }

    /** Everyone currently drawn. The nameplates and duel hits read this. */
    get live() { return this.slots.filter((s) => s.live); }

    /**
     * @param {number} dt real seconds — these keep moving while your own world
     *   is paused behind the welcome card, because theirs is not paused
     * @param {import("../net/room.js").Room|null} room
     */
    update(dt, room) {
        this.time += dt;
        const others = room && room.active ? room.others : [];
        const claimed = new Set();

        for (const player of others) {
            // A roster entry arrives before the body does. Drawing it early
            // would put a mage at the world origin for a fifteenth of a second.
            if (!player.hasState) continue;
            const slot = this._slotFor(player.id, claimed);
            if (!slot) continue;
            claimed.add(slot);
            const state = unpackPlayer(player.state || []);
            const fresh = !slot.live;
            slot.live = true;
            slot.id = player.id;
            slot.name = player.name;
            slot.colorIndex = player.colorIndex % PLAYER_COLORS.length;
            slot.hp = state.hp;
            slot.downed = state.downed;
            if (fresh) {
                slot.x = state.x; slot.y = state.y; slot.z = state.z;
                slot.facing = state.facing;
                slot.appear = 0;
            } else {
                slot.x = damp(slot.x, state.x, 13, dt);
                slot.y = damp(slot.y, state.y, 13, dt);
                slot.z = damp(slot.z, state.z, 13, dt);
                slot.facing = angleDamp(slot.facing, state.facing, 11, dt);
            }
            slot.surf = damp(slot.surf, state.surf, 6, dt);
            slot.speed01 = damp(slot.speed01, state.speed01, 6, dt);
        }

        for (const slot of this.slots) {
            if (slot.live && !claimed.has(slot)) { slot.live = false; slot.id = ""; }
            slot.hitCooldown = Math.max(0, slot.hitCooldown - dt);
            slot.flash = Math.max(0, slot.flash - dt * 2.6);
            slot.appear = slot.live
                ? Math.min(1, slot.appear + dt * 2.4)
                : Math.max(0, slot.appear - dt * 3.6);
            slot.fade = damp(slot.fade, slot.downed ? 1 : 0, 5, dt);

            const mesh = slot.mesh;
            mesh.isVisible = slot.appear > 0.001;
            if (!mesh.isVisible) continue;

            // A walk bob driven by the speed they publish, not by a clock, so a
            // mage standing still stands still.
            const stride = this.time * (3.4 + slot.speed01 * 9);
            const bob = Math.abs(Math.sin(stride)) * 0.045 * Math.min(1, slot.speed01 * 6);
            mesh.position.set(slot.x, slot.y + bob - slot.fade * 0.35, slot.z);
            mesh.rotation.set(
                slot.fade * 1.35,                                   // down in the snow
                slot.facing,
                Math.sin(stride * 0.5) * 0.03 - slot.surf * 0.22    // carve
            );
            mesh.scaling.setAll(slot.appear);
            mesh.scaling.y = slot.appear * (1 - slot.surf * 0.1);

            const colour = PLAYER_COLORS[slot.colorIndex];
            slot.material.setColor3("tint", _colour.set(colour[0], colour[1], colour[2]));
            slot.material.setFloat("flash", slot.flash);
            slot.material.setFloat("fade", slot.fade);
            slot.material.setVector3("cameraPosition", this.rig.camera.position);
        }
    }

    /**
     * Duel rooms only. Test this client's spells against every visible body and
     * tell the owner what landed — a body's hit points are only ever changed by
     * the client that owns it.
     *
     * @param {import("../net/room.js").Room} room
     * @param {(x:number,y:number,z:number)=>number} hitTest
     * @param {number} damage
     */
    resolveDuelHits(room, hitTest, damage) {
        if (!room?.active || !room.duel) return;
        for (const slot of this.slots) {
            if (!slot.live || slot.downed || slot.hitCooldown > 0 || slot.appear < 0.9) continue;
            if (!hitTest(slot.x, slot.y, slot.z)) continue;
            slot.hitCooldown = PVP_COOLDOWN;
            slot.flash = 1;
            room.sendPlayerDamage(slot.id, damage);
        }
    }

    _slotFor(id, claimed) {
        for (const slot of this.slots) if (slot.id === id && !claimed.has(slot)) return slot;
        for (const slot of this.slots) if (!slot.live && !claimed.has(slot)) return slot;
        return null;
    }
}

const _colour = new Color3();

/**
 * A hooded mage, lofted from primitives with feet at y = 0 and the eyes at the
 * same 1.5 m the player's own head sits at, so the two read as the same size.
 *
 * Vertex colour carries `(rgb, tintMix)`: the cloak takes the player's colour,
 * the fur, the face and the staff keep their own.
 */
function makeMage(scene) {
    const parts = [];
    /** @param {number[]} colour rgb @param {number} tintMix 0..1 */
    const add = (mesh, x, y, z, sx, sy, sz, colour, tintMix) => {
        mesh.position.set(x, y, z);
        mesh.scaling.set(sx, sy, sz);
        const data = new Float32Array(mesh.getTotalVertices() * 4);
        for (let i = 0; i < data.length; i += 4) {
            data.set([colour[0], colour[1], colour[2], tintMix], i);
        }
        mesh.setVerticesData(VertexBuffer.ColorKind, data);
        parts.push(mesh);
        return mesh;
    };
    const sphere = (segments = 6) =>
        CreateSphere("magePart", { diameter: 1, segments }, scene);
    const tube = (top, bottom) => CreateCylinder("magePart", {
        height: 1, diameterTop: top, diameterBottom: bottom, tessellation: 8,
    }, scene);

    const cloth = [0.34, 0.38, 0.46];   // takes the player colour
    const fur = [0.80, 0.82, 0.86];
    const shadow = [0.055, 0.05, 0.065];
    const wood = [0.085, 0.065, 0.05];
    const eye = [3.2, 7.4, 9.2];        // reads as emissive after the key light
    const orb = [1.1, 4.4, 6.4];

    add(tube(0.55, 0.98), 0, 0.58, 0, 1, 1.16, 1, cloth, 1);        // robe
    add(sphere(), 0, 1.17, 0, 0.66, 0.52, 0.54, cloth, 1);          // shoulders
    add(sphere(), 0, 1.50, -0.02, 0.52, 0.56, 0.52, cloth, 1);      // hood
    add(tube(0, 0.42), 0.02, 1.80, -0.13, 1, 0.5, 1, cloth, 1)      // hood peak
        .rotation.x = 0.5;
    add(CreateTorus("mageRim", { diameter: 0.52, thickness: 0.11, tessellation: 10 }, scene),
        0, 1.43, 0.03, 1, 1, 1, fur, 0).rotation.x = 0.32;
    add(sphere(5), 0, 1.47, 0.17, 0.34, 0.32, 0.2, shadow, 0);      // face, in shade
    for (const side of [-1, 1]) {
        add(sphere(5), side * 0.085, 1.50, 0.27, 0.075, 0.06, 0.05, eye, 0);
        add(tube(0.16, 0.2), side * 0.34, 1.02, 0.04, 1, 0.62, 1, cloth, 1)
            .rotation.z = side * 0.22;                              // sleeves
    }
    add(tube(0.05, 0.055), 0.44, 0.92, 0.1, 1, 1.85, 1, wood, 0).rotation.z = -0.11;
    add(sphere(6), 0.54, 1.86, 0.1, 0.19, 0.19, 0.19, orb, 0);

    const mesh = Mesh.MergeMeshes(parts, true, true);
    mesh.name = "mage-0";
    return mesh;
}
