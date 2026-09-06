import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import { whenReady } from "../core/gpuUtil.js";
import { NightEncounters } from "./encounters.js";
import vertexSource from "../shaders/monster.vertex.wgsl?raw";
import fragmentSource from "../shaders/monster.fragment.wgsl?raw";
import depthSource from "../shaders/monsterPrepass.fragment.wgsl?raw";

/** Faceted ice wraiths: one pooled mesh/draw per creature, including glowing eyes. */
export class MonsterSystem extends NightEncounters {
    constructor(scene, terrain, rig, spells, depthPass, onEvent) {
        super({ heightAt: (x, z) => terrain.heightAt(x, z),
            clampPosition: (p) => terrain.heightfield.clampToPlayArea(p), onEvent });
        this.rig = rig;
        this.spells = spells;
        this.hitTest = (x, y, z) => spells.hitsMonster(x, y, z);
        /**
         * True on a guest in a room: the shadows belong to the host, and this
         * client only renders them and reports what its own spells hit.
         */
        this.remote = false;
        /** @type {(id: number, damage: number) => void} */
        this.onHit = () => {};
        const template = makeWraith(scene);
        this.depthMaterial = new ShaderMaterial("wraithPrepass", scene,
            { vertexSource, fragmentSource: depthSource }, {
                attributes: ["position", "normal", "color"],
                uniforms: ["world", "viewProjection"], shaderLanguage: ShaderLanguage.WGSL,
            });
        for (const m of this.monsters) {
            m.mesh = m.id === 0 ? template : template.clone(`wraith-${m.id}`);
            m.material = new ShaderMaterial(`wraithMat-${m.id}`, scene,
                { vertexSource, fragmentSource }, {
                    attributes: ["position", "normal", "color"],
                    uniforms: ["world", "viewProjection", "cameraPosition", "flash", "time"],
                    shaderLanguage: ShaderLanguage.WGSL,
                });
            m.mesh.material = m.material;
            m.mesh.renderingGroupId = 1;
            m.mesh.isPickable = false;
            m.mesh.isVisible = false;
            m.material.setFloat("flash", 0);
            m.material.setFloat("time", 0);
            m.material.setVector3("cameraPosition", rig.camera.position);
            depthPass.registerCaster(m.mesh, this.depthMaterial);
        }
    }

    async warmUp() {
        for (const m of this.monsters) {
            await whenReady(m.material, "night monster", [m.mesh, false]);
        }
    }

    update(dt, cycle, player, party) {
        const shielded = this.spells.waterShield.active;
        if (this.remote) {
            super.updateRemote(dt, player, this.hitTest, shielded, this.onHit);
        } else {
            super.update(dt, cycle.isNight, player, this.rig.yaw, this.hitTest, shielded, party);
        }
        for (const m of this.monsters) {
            m.mesh.isVisible = m.active;
            if (!m.active) continue;
            const appear = Math.min(1, m.age / 0.8);
            const fade = m.hp > 0 ? 1 : Math.max(0, 1 - m.death / 0.65);
            const scale = Math.max(0.001, appear * fade);
            m.mesh.scaling.setAll(scale);
            m.mesh.position.set(m.x, m.y + 0.12 + Math.sin(m.age * 2.6 + m.id) * 0.12, m.z);
            m.mesh.rotation.set(0, m.heading, Math.sin(m.age * 2 + m.id) * 0.045);
            m.material.setFloat("flash", Math.max(m.flash, m.hp <= 0 ? fade : 0));
            m.material.setFloat("time", m.age);
            m.material.setVector3("cameraPosition", this.rig.camera.position);
        }
    }
}

function makeWraith(scene) {
    const parts = [];
    const add = (mesh, x, y, z, sx, sy, sz, color, glow = 0) => {
        mesh.position.set(x, y, z);
        mesh.scaling.set(sx, sy, sz);
        const colors = new Float32Array(mesh.getTotalVertices() * 4);
        for (let i = 0; i < colors.length; i += 4) {
            colors.set([color[0], color[1], color[2], glow], i);
        }
        mesh.setVerticesData(VertexBuffer.ColorKind, colors);
        parts.push(mesh);
        return mesh;
    };
    const sphere = () => CreateSphere("wraithPart", { diameter: 1, segments: 5 }, scene);
    const spike = () => CreateCylinder("wraithSpike", {
        height: 1, diameterTop: 0, diameterBottom: 1, tessellation: 6,
    }, scene);
    const body = [0.22, 0.45, 0.65], ice = [0.42, 0.82, 1];
    add(spike(), 0, 0.82, 0, 1.5, 1.7, 1.05, body).rotation.z = Math.PI;
    add(sphere(), 0, 1.45, 0, 1.4, 1.2, 0.9, body);
    add(sphere(), 0, 2.14, 0.08, 0.88, 0.9, 0.8, body);
    for (const side of [-1, 1]) {
        add(spike(), side * 0.38, 2.65, 0, 0.22, 0.9, 0.25, ice, 0.06).rotation.z = -side * 0.32;
        add(spike(), side * 0.88, 1.23, 0.12, 0.4, 1.15, 0.4, ice).rotation.z = side * 2.75;
        add(sphere(), side * 0.2, 2.2, 0.435, 0.2, 0.11, 0.12, ice, 1);
    }
    const mesh = Mesh.MergeMeshes(parts, true, true);
    mesh.name = "wraith-0";
    return mesh;
}
