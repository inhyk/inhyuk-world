/**
 * Scooping and throwing snow.
 *
 * The renderer half of `ballistics.js`, plus the little state machine that gets
 * a ball into your hand and out of it again.
 *
 * The scoop is the part that matters. The ball does not appear out of nothing:
 * it is dug out of the ground you are standing on, through the same `brush()`
 * every footprint and every spell writes through, so the hole is real, it has
 * a rim of displaced snow, and it slumps and refills over the next minute like
 * everything else does. Throwing snowballs at a friend for two minutes leaves
 * the ground around you visibly quarried. That is the whole reason this
 * mechanic belongs in this game rather than in any game.
 *
 * Four materials, sixteen meshes. A ball carries its thrower's colour in its
 * rim, and there are only ever four colours in a room, so the tint lives on a
 * material that is swapped onto a mesh at launch rather than on a material per
 * mesh.
 */

import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import { Color3 } from "@babylonjs/core/Maths/math.color";

import { whenReady } from "../core/gpuUtil.js";
import { input } from "../core/input.js";
import { S } from "../core/settings.js";
import { Ballistics, BALL_RADIUS, MAX_BALLS, throwVelocity } from "./ballistics.js";
import { PLAYER_COLORS } from "../net/room.js";
import vertexSource from "../shaders/monster.vertex.wgsl?raw";
import fragmentSource from "../shaders/snowball.fragment.wgsl?raw";
import depthSource from "../shaders/monsterPrepass.fragment.wgsl?raw";

/** Seconds of crouching to pack a ball. Long enough to be a decision. */
const SCOOP_SECONDS = 0.42;
/** Seconds of wind-up from a tap to a full-power throw. */
const CHARGE_SECONDS = 0.75;
/** You cannot dig while travelling at nineteen metres a second. */
const SCOOP_MAX_SPEED = 4.2;

const _hand = new Float32Array(3);
const _vel = new Float32Array(3);
const _colour = new Color3();

export class SnowballSystem extends Ballistics {
    /**
     * @param {object} deps
     * @param {(ball:any, target:any|null)=>void} deps.onImpact called for every
     *   ball this client simulates, whoever threw it
     */
    constructor({ scene, terrain, sky, rig, spray, depthPass, onImpact }) {
        super({
            heightAt: (x, z) => terrain.heightAt(x, z),
            onImpact: (ball, target) => {
                this._splat(ball, target);
                onImpact(ball, target);
            },
            onTrail: (ball) => this._trail(ball),
        });
        this.terrain = terrain;
        this.sky = sky;
        this.rig = rig;
        this.spray = spray;

        // ---------------------------------------------------------- throwing
        /** "empty" | "scooping" | "armed" */
        this.state = "empty";
        this.scoop = 0;
        /** 0..1 wind-up. Only meaningful while armed and the key is held. */
        this.charge = 0;
        /** Set for one frame on a throw, for anything that wants to react. */
        this.threw = false;
        /** Last frame's key state, so a throw is a release and not a "not held". */
        this._wasHeld = false;
        this.colorIndex = 0;
        // Never empty: the ballistics refuses to let a ball hit the id that
        // threw it, and an empty id matches nothing — which would mean your own
        // snowball hitting you in the face every time you played alone.
        this.selfId = "me";
        this._trailOwed = 0;

        // ---------------------------------------------------------- geometry
        const template = makeBall(scene);
        this.depthMaterial = new ShaderMaterial("snowballPrepass", scene,
            { vertexSource, fragmentSource: depthSource }, {
                attributes: ["position", "normal", "color"],
                uniforms: ["world", "viewProjection"], shaderLanguage: ShaderLanguage.WGSL,
            });

        /** One per player colour, swapped onto a mesh when a ball is thrown. */
        this.materials = PLAYER_COLORS.map((colour, i) => {
            const mat = new ShaderMaterial(`snowballMat-${i}`, scene,
                { vertexSource, fragmentSource }, {
                    attributes: ["position", "normal", "color"],
                    uniforms: [
                        "world", "viewProjection", "cameraPosition",
                        "sunDir", "sunRadiance", "tint",
                    ],
                    shaderLanguage: ShaderLanguage.WGSL,
                });
            mat.setColor3("tint", new Color3(colour[0], colour[1], colour[2]));
            mat.setVector3("cameraPosition", rig.camera.position);
            mat.setVector3("sunDir", sky.sunDir);
            mat.setColor3("sunRadiance", sky.sunRadiance);
            return mat;
        });

        /** @type {Mesh[]} one per pool slot, plus the one in your hand. */
        this.meshes = [];
        for (let i = 0; i <= MAX_BALLS; i++) {
            const mesh = i === 0 ? template : template.clone(`snowball-${i}`);
            mesh.material = this.materials[0];
            mesh.renderingGroupId = 1;
            mesh.isPickable = false;
            mesh.isVisible = false;
            depthPass.registerCaster(mesh, this.depthMaterial);
            this.meshes.push(mesh);
        }
        /** The last mesh is reserved for the ball you are holding. */
        this.heldMesh = this.meshes[MAX_BALLS];
    }

    async warmUp() {
        for (const mat of this.materials) {
            await whenReady(mat, "snowball", [this.meshes[0], false]);
        }
    }

    get armed() { return this.state === "armed"; }
    /** 0..1, for the HUD ring. */
    get readiness() {
        if (this.state === "armed") return 1;
        if (this.state === "scooping") return this.scoop / SCOOP_SECONDS;
        return 0;
    }

    /**
     * Read the key, dig, wind up, throw.
     *
     * @param {number} dt simulation seconds
     * @param {object} ctx
     * @param {import("../character/controller.js").CharacterController} ctx.controller
     * @param {import("../character/figure.js").Figure} ctx.figure
     * @param {import("../net/room.js").Room|null} ctx.room
     * @returns {number[]|null} the wire form of a throw, when one happened
     */
    aimAndThrow(dt, { controller, figure, room }) {
        this.threw = false;
        const held = input.throwHeld;
        const released = this._wasHeld && !held;
        this._wasHeld = held;
        if (!(dt > 0)) {
            // Pausing clears every held key, which without this reads as a
            // release — press Q, hit Esc, and the ball would leave your hand
            // the instant you came back. The wind-up is forgotten instead.
            this.charge = 0;
            return null;
        }
        const ch = controller;

        if (this.state === "empty") {
            const canDig = ch.speed <= SCOOP_MAX_SPEED && ch.surf < 0.4;
            if (input.throwPressed && canDig) {
                this.state = "scooping";
                this.scoop = 0;
            }
            return null;
        }

        if (this.state === "scooping") {
            this.scoop += dt;
            // Standing up or dropping into a carve abandons the dig.
            if (ch.surf > 0.6) { this.state = "empty"; return null; }
            if (this.scoop >= SCOOP_SECONDS) {
                this.state = "armed";
                this.charge = 0;
                this._quarry(ch);
            }
            return null;
        }

        // Armed. The key winds up; letting go throws.
        if (held) {
            this.charge = Math.min(1, this.charge + dt / CHARGE_SECONDS);
            // The figure already has a stance for "reaching out at what the
            // camera is pointing at". Borrowing it beats inventing a second one.
            ch.cast = Math.max(ch.cast, Math.min(1, 0.35 + this.charge * 0.65));
            return null;
        }
        // A release throws. So does a tap short enough to land inside one
        // frame — softly, but nobody should press a key and have nothing at
        // all happen. Otherwise the ball just sits in your hand until you want
        // it, which is what carrying one about should feel like.
        if (released || input.throwPressed) return this._release(ch, figure, room);
        return null;
    }

    _release(ch, figure, room) {
        this.state = "empty";
        this.threw = true;
        this.handPoint(figure, ch, _hand);
        const aim = this.rig.forward;
        throwVelocity(aim.x, aim.y, aim.z, this.charge, _vel);
        // Clear of the shoulder, so a throw never begins inside the robe.
        const x = _hand[0] + aim.x * 0.3;
        const y = _hand[1] + aim.y * 0.3;
        const z = _hand[2] + aim.z * 0.3;
        // Your own momentum goes with it. Throwing forward off a fast carve
        // should send the ball further, because it does.
        const vx = _vel[0] + ch.velocity.x * 0.6;
        const vz = _vel[2] + ch.velocity.z * 0.6;
        const ball = this.launch(x, y, z, vx, _vel[1], vz, this.selfId, true);
        if (ball) this.dress(ball, this.colorIndex);
        this.charge = 0;
        const wire = [round(x), round(y), round(z), round(vx), round(_vel[1]), round(vz)];
        room?.throwBall(wire);
        return wire;
    }

    /**
     * A throw that arrived over the wire.
     * @param {number[]} b @param {string} from @param {number} colorIndex
     */
    accept(b, from, colorIndex) {
        if (!Array.isArray(b) || b.length < 6) return;
        const ball = this.launch(b[0], b[1], b[2], b[3], b[4], b[5], from, false);
        if (ball) this.dress(ball, colorIndex || 0);
    }

    /** Where the ball sits. Falls back to the chest when the figure is hidden. */
    handPoint(figure, ch, out) {
        if (figure && S.showCharacter !== false) {
            figure.handPosition(1, out, 0);
            return out;
        }
        out[0] = ch.position.x + Math.sin(ch.facing) * 0.4;
        out[1] = ch.position.y + 1.25;
        out[2] = ch.position.z + Math.cos(ch.facing) * 0.4;
        return out;
    }

    /**
     * Take the snow out of the ground.
     *
     * A hole with a rim, in front of the boots, through the same brush the feet
     * use — so it refills, slumps and lights exactly like every other mark on
     * the field, and a long fight quarries the ground you had it in.
     */
    _quarry(ch) {
        const fx = Math.sin(ch.facing);
        const fz = Math.cos(ch.facing);
        const x = ch.position.x + fx * 0.55;
        const z = ch.position.z + fz * 0.55;
        this.terrain.deform.brush(
            x, z,
            0.26,   // radius
            0.42,   // depth — a scoop is deeper than a boot
            0.30,   // and all of it has to go somewhere: the rim
            0.35,   // barely compressed; you lifted it, you did not tread it
            0,
            ch.facing,
            1.15,
            1.0
        );
        const y = this.terrain.heightAt(x, z);
        for (let i = 0; i < 14; i++) {
            this.spray?.emit(
                x + (Math.random() - 0.5) * 0.3, y + 0.05, z + (Math.random() - 0.5) * 0.3,
                (Math.random() - 0.5) * 1.1, 0.6 + Math.random() * 1.2, (Math.random() - 0.5) * 1.1,
                0.016 + Math.random() * 0.02, 0.4 + Math.random() * 0.4, 0
            );
        }
    }

    /** Powder shed along the flight, so a ball reads as snow and not a stone. */
    _trail(ball) {
        if (!this.spray) return;
        this._trailOwed += 0.55;
        while (this._trailOwed >= 1) {
            this._trailOwed -= 1;
            this.spray.emit(
                ball.x + (Math.random() - 0.5) * 0.1,
                ball.y + (Math.random() - 0.5) * 0.1,
                ball.z + (Math.random() - 0.5) * 0.1,
                ball.vx * 0.05 + (Math.random() - 0.5) * 0.5,
                ball.vy * 0.05 + (Math.random() - 0.5) * 0.5 + 0.2,
                ball.vz * 0.05 + (Math.random() - 0.5) * 0.5,
                0.010 + Math.random() * 0.012, 0.30 + Math.random() * 0.25, 0
            );
        }
    }

    /** The burst. Snow into the air, a dent in the ground under it. */
    _splat(ball, target) {
        const power = Math.min(1.4, 0.5 + Math.hypot(ball.vx, ball.vy, ball.vz) / 26);
        const n = 18 + ((power * 16) | 0);
        for (let i = 0; i < n; i++) {
            const clod = Math.random() < 0.18 ? 1 : 0;
            this.spray?.emit(
                ball.x, ball.y + 0.05, ball.z,
                (Math.random() - 0.5) * 4.2 * power - ball.vx * 0.10,
                0.9 + Math.random() * 3.0 * power,
                (Math.random() - 0.5) * 4.2 * power - ball.vz * 0.10,
                clod ? 0.016 + Math.random() * 0.014 : 0.012 + Math.random() * 0.022,
                0.45 + Math.random() * 0.55,
                clod
            );
        }
        // Only the ground takes a dent; a ball that burst on someone's chest
        // sprayed its snow sideways, it did not dig anything.
        if (!target) {
            this.terrain.deform.brush(
                ball.x, ball.z, 0.30, 0.09 * power, 0.13 * power, 0.45 * power,
                0, Math.atan2(ball.vx, ball.vz), 1.2, 1.0
            );
        }
    }

    /** Place every mesh. @param {object} ctx same shape `aimAndThrow` takes */
    render({ controller, figure }) {
        const camera = this.rig.camera.position;
        for (const mat of this.materials) {
            mat.setVector3("cameraPosition", camera);
            mat.setVector3("sunDir", this.sky.sunDir);
            mat.setColor3("sunRadiance", _colour.copyFrom(this.sky.sunRadiance));
        }

        for (let i = 0; i < MAX_BALLS; i++) {
            const ball = this.balls[i];
            const mesh = this.meshes[i];
            mesh.isVisible = ball.active;
            if (!ball.active) continue;
            mesh.position.set(ball.x, ball.y, ball.z);
            mesh.rotation.set(ball.spin, ball.spin * 0.6, ball.spin * 0.35);
            mesh.scaling.setAll(1);
        }

        // The one in your hand: packed into being over the scoop, then held.
        const held = this.heldMesh;
        const growth = this.readiness;
        held.isVisible = growth > 0.02 && S.showCharacter !== false;
        if (held.isVisible) {
            this.handPoint(figure, controller, _hand);
            held.position.set(_hand[0], _hand[1], _hand[2]);
            held.rotation.set(0, controller.facing, 0);
            held.scaling.setAll(growth);
            held.material = this.materials[this.colorIndex % this.materials.length];
        }
    }

    /** Give a launched ball the thrower's colour. */
    dress(ball, colorIndex) {
        const mesh = this.meshes[ball.id];
        if (mesh) mesh.material = this.materials[colorIndex % this.materials.length];
    }

    /** Drop everything in flight and everything in hand. Leaving a room. */
    reset() {
        this.clear();
        this.state = "empty";
        this.scoop = 0;
        this.charge = 0;
        this.selfId = "me";
        this.colorIndex = 0;
    }
}

const round = (v) => Math.round(v * 100) / 100;

/**
 * A snowball. Low-poly and deliberately lumpy: a smooth sphere at this size
 * reads as a marble, and the facets are what the grain in the shader catches.
 */
function makeBall(scene) {
    const mesh = CreateSphere("snowball-0", { diameter: BALL_RADIUS * 2, segments: 4 }, scene);
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    const normals = mesh.getVerticesData(VertexBuffer.NormalKind);
    for (let i = 0; i < positions.length; i += 3) {
        // Hashed off the bind position, so shared vertices move together and
        // the ball stays closed.
        const h = Math.sin(positions[i] * 91.7 + positions[i + 1] * 47.3 + positions[i + 2] * 63.1);
        const k = 1 + (h - Math.floor(h) - 0.5) * 0.22;
        positions[i] *= k;
        positions[i + 1] *= k;
        positions[i + 2] *= k;
    }
    mesh.setVerticesData(VertexBuffer.PositionKind, positions);
    mesh.setVerticesData(VertexBuffer.NormalKind, normals);
    const colors = new Float32Array(mesh.getTotalVertices() * 4);
    colors.fill(1);
    mesh.setVerticesData(VertexBuffer.ColorKind, colors);
    return mesh;
}
