/**
 * Frost whirls — the dawn encounter, rendered.
 *
 * Each one is a turning core of hard-edged ice shards inside a column of lit
 * snow. The shards are geometry; the snow is the spray field, the same pool the
 * boots kick and the wake sheds, emitted along a helix around the core with the
 * core's own velocity added — so the whirl trails when it runs and tightens
 * when it stops. Underneath, a shallow scouring brush follows it across the
 * field: everything that moves here marks the snow, and this is no exception.
 *
 * Renderer half of `dawnPack.js`, on the same pattern as the wraiths: pooled
 * meshes, one material each, depth prepass only.
 */

import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import { Color3 } from "@babylonjs/core/Maths/math.color";

import { whenReady } from "../core/gpuUtil.js";
import { S } from "../core/settings.js";
import { DawnPack } from "./dawnPack.js";
import vertexSource from "../shaders/monster.vertex.wgsl?raw";
import fragmentSource from "../shaders/whirl.fragment.wgsl?raw";
import depthSource from "../shaders/monsterPrepass.fragment.wgsl?raw";

/** Snow grains per second per whirl. Bounded by the pool either way. */
const SNOW_RATE = 95;
const _colour = new Color3();

export class FrostWhirls extends DawnPack {
    constructor(scene, terrain, sky, rig, spells, spray, depthPass, onEvent) {
        super({
            heightAt: (x, z) => terrain.heightAt(x, z),
            clampPosition: (p) => terrain.heightfield.clampToPlayArea(p),
            onEvent,
        });
        this.terrain = terrain;
        this.sky = sky;
        this.rig = rig;
        this.spells = spells;
        this.spray = spray;
        this.hitTest = (x, y, z) => spells.hitsMonster(x, y, z);
        this.remote = false;
        /** @type {(id: number, damage: number) => void} */
        this.onHit = () => {};
        this._time = 0;

        const template = makeCore(scene);
        this.depthMaterial = new ShaderMaterial("whirlPrepass", scene,
            { vertexSource, fragmentSource: depthSource }, {
                attributes: ["position", "normal", "color"],
                uniforms: ["world", "viewProjection"], shaderLanguage: ShaderLanguage.WGSL,
            });
        for (const m of this.monsters) {
            m.mesh = m.id === 0 ? template : template.clone(`whirl-${m.id}`);
            m.material = new ShaderMaterial(`whirlMat-${m.id}`, scene,
                { vertexSource, fragmentSource }, {
                    attributes: ["position", "normal", "color"],
                    uniforms: [
                        "world", "viewProjection", "cameraPosition",
                        "sunDir", "sunRadiance", "flash", "time",
                    ],
                    shaderLanguage: ShaderLanguage.WGSL,
                });
            m.mesh.material = m.material;
            m.mesh.renderingGroupId = 1;
            m.mesh.isPickable = false;
            m.mesh.isVisible = false;
            m.material.setFloat("flash", 0);
            m.material.setFloat("time", 0);
            depthPass.registerCaster(m.mesh, this.depthMaterial);
            // Renderer-side motion state, for the spray and the scour.
            m.prevX = 0; m.prevZ = 0; m.spin = 0; m.owed = 0; m.wasDead = false;
        }
    }

    async warmUp() {
        for (const m of this.monsters) await whenReady(m.material, "frost whirl", [m.mesh, false]);
    }

    /**
     * @param {number} dt
     * @param {import("./dayCycle.js").DayCycle} cycle
     * @param {import("@babylonjs/core/Maths/math.vector").Vector3} player
     * @param {Array|null} party
     */
    update(dt, cycle, player, party) {
        this._time += dt;
        const shielded = this.spells.waterShield.active;
        if (this.remote) {
            super.updateRemote(dt, player, this.hitTest, shielded, this.onHit);
        } else {
            super.update(dt, cycle.hour, player, this.rig.yaw, this.hitTest, shielded, party);
        }

        for (const m of this.monsters) {
            const mesh = m.mesh;
            mesh.isVisible = m.active;
            if (!m.active) { m.wasDead = false; continue; }

            const appear = Math.min(1, m.age / this.windup);
            const alive = m.hp > 0;
            const fade = alive ? 1 : Math.max(0, 1 - m.death / this.deathFade);
            if (!alive && !m.wasDead) { this._burst(m); m.wasDead = true; }

            const vx = dt > 0 ? (m.x - m.prevX) / dt : 0;
            const vz = dt > 0 ? (m.z - m.prevZ) / dt : 0;
            const speed = Math.hypot(vx, vz);
            m.prevX = m.x; m.prevZ = m.z;

            // The core spins faster the harder it runs, and keeps a little
            // turn even at rest so it never reads as a static prop.
            m.spin += dt * (3.2 + speed * 1.6);
            const hover = 0.55 + Math.sin(this._time * 2.4 + m.id * 1.7) * 0.08;
            const scale = Math.max(0.001, appear * (alive ? 1 : fade * fade));
            mesh.position.set(m.x, m.y + hover, m.z);
            // Leans into its own motion: pitch forward along heading by speed.
            mesh.rotation.set(
                Math.min(0.45, speed * 0.09) * Math.cos(m.heading - m.spin),
                m.spin,
                -Math.min(0.45, speed * 0.09) * Math.sin(m.heading - m.spin)
            );
            mesh.scaling.setAll(scale);
            m.material.setFloat("flash", Math.max(m.flash, alive ? 0 : fade));
            m.material.setFloat("time", this._time + m.id);
            m.material.setVector3("cameraPosition", this.rig.camera.position);
            m.material.setVector3("sunDir", this.sky.sunDir);
            m.material.setColor3("sunRadiance", _colour.copyFrom(this.sky.sunRadiance));

            if (alive && dt > 0 && appear > 0.2) {
                this._whirl(m, dt, vx, vz, appear);
                this._scour(m, dt, speed);
            }
        }
    }

    /** The column of snow around the core. */
    _whirl(m, dt, vx, vz, appear) {
        if (!this.spray || S.spellSpray === 0) return;
        m.owed += SNOW_RATE * dt * appear;
        while (m.owed >= 1) {
            m.owed -= 1;
            const a = Math.random() * Math.PI * 2;
            const h = Math.random();
            // Wider at the base, narrower at the top: a funnel, not a cylinder.
            const r = 0.45 + (1 - h) * 0.55 + Math.random() * 0.15;
            const y = m.y + 0.05 + h * 1.7;
            const px = m.x + Math.sin(a) * r;
            const pz = m.z + Math.cos(a) * r;
            // Tangential, so the grains orbit; plus the whirl's own travel so a
            // running one streams behind itself.
            const swirl = 3.6 + (1 - h) * 1.4;
            this.spray.emit(
                px, y, pz,
                Math.cos(a) * swirl + vx * 0.7, 0.9 + h * 0.9 + Math.random() * 0.5,
                -Math.sin(a) * swirl + vz * 0.7,
                0.011 + Math.random() * 0.016, 0.55 + Math.random() * 0.45, 0
            );
        }
    }

    /** A shallow, wide scour under a running whirl. Distance-scaled. */
    _scour(m, dt, speed) {
        const moved = speed * dt;
        if (moved < 0.002) return;
        const k = Math.min(moved, 0.4);
        this.terrain.deform.brush(
            m.x, m.z, 0.62, 0.06 * k, 0.09 * k, 0.25 * k, 0, m.heading, 1.15, 0.55
        );
    }

    /** It comes apart: everything it was made of, thrown outward at once. */
    _burst(m) {
        if (!this.spray) return;
        for (let i = 0; i < 70; i++) {
            const a = Math.random() * Math.PI * 2;
            const up = 1.2 + Math.random() * 3.4;
            const out = 2.2 + Math.random() * 4.0;
            const clod = Math.random() < 0.15 ? 1 : 0;
            this.spray.emit(
                m.x, m.y + 0.3 + Math.random() * 1.4, m.z,
                Math.sin(a) * out, up, Math.cos(a) * out,
                clod ? 0.02 : 0.012 + Math.random() * 0.02, 0.6 + Math.random() * 0.7, clod
            );
        }
        this.terrain.deform.brush(m.x, m.z, 0.9, 0.04, 0.10, 0.2, 0.35, m.heading, 1, 0.7);
    }
}

/**
 * The core: five hexagonal shards of clear ice around a bright heart, each
 * tilted off the axis so the cluster reads as a broken crystal turning rather
 * than as a spinning top. Vertex alpha marks the heart for the shader.
 */
function makeCore(scene) {
    const parts = [];
    const add = (mesh, x, y, z, sx, sy, sz, colour, glow = 0) => {
        mesh.position.set(x, y, z);
        mesh.scaling.set(sx, sy, sz);
        const data = new Float32Array(mesh.getTotalVertices() * 4);
        for (let i = 0; i < data.length; i += 4) data.set([colour[0], colour[1], colour[2], glow], i);
        mesh.setVerticesData(VertexBuffer.ColorKind, data);
        parts.push(mesh);
        return mesh;
    };
    const shard = () => CreateCylinder("whirlShard", {
        height: 1, diameterTop: 0.06, diameterBottom: 0.34, tessellation: 6,
    }, scene);
    const ice = [0.55, 0.80, 1.00];
    const heart = [0.80, 0.94, 1.00];

    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const lean = 0.36 + (i % 2) * 0.16;
        const h = 1.05 + (i % 3) * 0.22;
        const s = add(shard(), Math.sin(a) * 0.16, 0.62 + (i % 2) * 0.1, Math.cos(a) * 0.16,
            0.9, h, 0.9, ice);
        s.rotation.set(Math.cos(a) * lean, a, -Math.sin(a) * lean);
    }
    // Two inverted, shorter, so the silhouette has spikes above and below.
    for (const side of [-1, 1]) {
        const s = add(shard(), side * 0.1, 0.55, 0, 0.7, 0.8, 0.7, ice);
        s.rotation.z = Math.PI + side * 0.35;
    }
    add(CreateSphere("whirlHeart", { diameter: 0.26, segments: 6 }, scene),
        0, 0.68, 0, 1, 1.15, 1, heart, 1);

    const mesh = Mesh.MergeMeshes(parts, true, true);
    mesh.name = "whirl-0";
    return mesh;
}
