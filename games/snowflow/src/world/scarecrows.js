/**
 * Snow scarecrows — the targets in a solo snowball match.
 *
 * Eight of them stand around the player, and knocking one apart puts it back
 * up somewhere else a second and a half later. That is the whole rule set. The
 * point of them is that a snowball fight should not require a second person to
 * be worth playing, and a scoring run against moving-around targets is a real
 * game rather than a placeholder.
 *
 * Pooled exactly like the wraiths: one merged mesh and one material each, depth
 * prepass only, nothing allocated per frame.
 */

import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import { Color3 } from "@babylonjs/core/Maths/math.color";

import { whenReady } from "../core/gpuUtil.js";
import { clampToPlayArea } from "../terrain/playArea.js";
import vertexSource from "../shaders/monster.vertex.wgsl?raw";
import fragmentSource from "../shaders/scarecrow.fragment.wgsl?raw";
import depthSource from "../shaders/monsterPrepass.fragment.wgsl?raw";

export const SCARECROW_COUNT = 8;

/** How far out they stand. Near enough to hit, far enough to be a throw. */
const MIN_RANGE = 13;
const MAX_RANGE = 46;
/** A knocked-over scarecrow is back up this many seconds later. */
const REBUILD_SECONDS = 1.6;
/** Hit box: they are wide and short, so this is generous on purpose. */
export const HIT_RADIUS = 0.62;
export const HIT_RISE = 0.85;

const _colour = new Color3();

export class Scarecrows {
    constructor(scene, terrain, sky, rig, depthPass) {
        this.terrain = terrain;
        this.sky = sky;
        this.rig = rig;
        this.live = false;

        const template = makeScarecrow(scene);
        this.depthMaterial = new ShaderMaterial("scarecrowPrepass", scene,
            { vertexSource, fragmentSource: depthSource }, {
                attributes: ["position", "normal", "color"],
                uniforms: ["world", "viewProjection"], shaderLanguage: ShaderLanguage.WGSL,
            });

        this.targets = [];
        for (let i = 0; i < SCARECROW_COUNT; i++) {
            const mesh = i === 0 ? template : template.clone(`scarecrow-${i}`);
            const material = new ShaderMaterial(`scarecrowMat-${i}`, scene,
                { vertexSource, fragmentSource }, {
                    attributes: ["position", "normal", "color"],
                    uniforms: [
                        "world", "viewProjection", "cameraPosition",
                        "sunDir", "sunRadiance", "flash",
                    ],
                    shaderLanguage: ShaderLanguage.WGSL,
                });
            mesh.material = material;
            mesh.renderingGroupId = 1;
            mesh.isPickable = false;
            mesh.isVisible = false;
            material.setFloat("flash", 0);
            depthPass.registerCaster(mesh, this.depthMaterial);

            this.targets.push({
                id: `scarecrow-${i}`, kind: "scarecrow", index: i,
                mesh, material,
                x: 0, y: 0, z: 0, spin: 0,
                rise: HIT_RISE, radius: HIT_RADIUS,
                standing: false, rebuild: 0, flash: 0, appear: 0,
            });
        }
    }

    async warmUp() {
        for (const t of this.targets) await whenReady(t.material, "scarecrow", [t.mesh, false]);
    }

    /** Stand them all up around a point. @param {{x:number,z:number}} around */
    deploy(around) {
        this.live = true;
        for (const t of this.targets) {
            this._place(t, around);
            t.appear = 0;
        }
    }

    /** Take them all away. */
    clear() {
        this.live = false;
        for (const t of this.targets) {
            t.standing = false;
            t.mesh.isVisible = false;
        }
    }

    /** Knock one apart. @returns {boolean} true if it was standing */
    knock(target) {
        if (!target || !target.standing) return false;
        target.standing = false;
        target.rebuild = REBUILD_SECONDS;
        target.flash = 1;
        return true;
    }

    /**
     * Append every standing scarecrow to a ballistics target list.
     * @param {Array} out
     */
    collect(out) {
        if (!this.live) return out;
        for (const t of this.targets) if (t.standing && t.appear > 0.4) out.push(t);
        return out;
    }

    /**
     * @param {number} dt
     * @param {{x:number,z:number}} around the player, so they follow you about
     */
    update(dt, around) {
        for (const t of this.targets) {
            t.flash = Math.max(0, t.flash - dt * 3.4);
            if (this.live && !t.standing) {
                t.rebuild -= dt;
                if (t.rebuild <= 0) this._place(t, around);
            }
            t.appear = t.standing
                ? Math.min(1, t.appear + dt * 3.2)
                : Math.max(0, t.appear - dt * 5);

            const mesh = t.mesh;
            mesh.isVisible = t.appear > 0.01;
            if (!mesh.isVisible) continue;
            // They rise out of the snow rather than blinking in, and sink back
            // when they are knocked apart.
            const grow = t.appear * t.appear * (3 - 2 * t.appear);
            mesh.position.set(t.x, t.y - (1 - grow) * 1.2, t.z);
            mesh.rotation.set(0, t.spin, 0);
            mesh.scaling.setAll(0.6 + grow * 0.4);
            t.material.setFloat("flash", t.flash);
            t.material.setVector3("cameraPosition", this.rig.camera.position);
            t.material.setVector3("sunDir", this.sky.sunDir);
            t.material.setColor3("sunRadiance", _colour.copyFrom(this.sky.sunRadiance));
        }
    }

    _place(t, around) {
        for (let attempt = 0; attempt < 10; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const range = MIN_RANGE + Math.random() * (MAX_RANGE - MIN_RANGE);
            t.x = around.x + Math.sin(angle) * range;
            t.z = around.z + Math.cos(angle) * range;
            clampToPlayArea(t);
            if (Math.hypot(t.x - around.x, t.z - around.z) < MIN_RANGE * 0.7) continue;
            break;
        }
        t.y = this.terrain.heightAt(t.x, t.z);
        t.spin = Math.random() * Math.PI * 2;
        t.standing = true;
        t.rebuild = 0;
    }
}

/**
 * A snowman: three stacked balls, a carrot, coal, twigs and a scarf.
 *
 * The scarf is the only saturated thing on it and it is faintly emissive,
 * because at dusk a white figure on white ground at forty metres is invisible,
 * and a target you cannot see is not a target.
 */
function makeScarecrow(scene) {
    const parts = [];
    const add = (mesh, x, y, z, sx, sy, sz, colour, glow = 0) => {
        mesh.position.set(x, y, z);
        mesh.scaling.set(sx, sy, sz);
        const data = new Float32Array(mesh.getTotalVertices() * 4);
        for (let i = 0; i < data.length; i += 4) {
            data.set([colour[0], colour[1], colour[2], glow], i);
        }
        mesh.setVerticesData(VertexBuffer.ColorKind, data);
        parts.push(mesh);
        return mesh;
    };
    const sphere = (segments = 7) => CreateSphere("scarePart", { diameter: 1, segments }, scene);
    const cone = () => CreateCylinder("scareCone", {
        height: 1, diameterTop: 0, diameterBottom: 1, tessellation: 7,
    }, scene);
    const stick = () => CreateCylinder("scareStick", {
        height: 1, diameter: 1, tessellation: 5,
    }, scene);

    const snow = [0.88, 0.91, 0.96];
    const coal = [0.03, 0.03, 0.04];
    const carrot = [1.00, 0.42, 0.10];
    const scarf = [0.95, 0.22, 0.30];
    const twig = [0.10, 0.07, 0.05];

    add(sphere(), 0, 0.42, 0, 0.86, 0.80, 0.86, snow);      // base
    add(sphere(), 0, 1.00, 0, 0.62, 0.60, 0.62, snow);      // middle
    add(sphere(), 0, 1.44, 0, 0.44, 0.44, 0.44, snow);      // head
    add(sphere(6), 0, 1.20, 0, 0.50, 0.16, 0.50, scarf, 0.30);   // scarf
    add(cone(), 0, 1.45, 0.26, 0.11, 0.34, 0.11, carrot).rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) {
        add(sphere(5), side * 0.10, 1.52, 0.19, 0.07, 0.07, 0.05, coal);   // eyes
        add(stick(), side * 0.44, 1.02, 0, 0.035, 0.72, 0.035, twig)
            .rotation.z = side * 1.15;                                      // arms
    }
    add(sphere(5), 0, 1.02, 0.30, 0.09, 0.09, 0.05, coal);   // button
    add(sphere(5), 0, 0.80, 0.32, 0.09, 0.09, 0.05, coal);

    const mesh = Mesh.MergeMeshes(parts, true, true);
    mesh.name = "scarecrow-0";
    return mesh;
}
