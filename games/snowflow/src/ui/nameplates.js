/**
 * Who is who: a name and a health pip floating over every other mage, and a
 * party list in the corner.
 *
 * The plates are DOM rather than in-scene geometry on purpose — text in this
 * renderer would mean an atlas, a transparent pass and a sorting decision
 * against the water, for something that has to stay crisp at 11 px. Three
 * absolutely-positioned divs cost nothing and always read.
 *
 * Nodes are made once and then only moved. Nothing here allocates per frame
 * except the projection scratch, which is module scope.
 */

import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import { Viewport } from "@babylonjs/core/Maths/math.viewport";
import { PLAYER_COLORS } from "../net/room.js";
import { input } from "../core/input.js";

/** Past this the plate would be unreadable anyway. */
const MAX_DISTANCE = 140;
/** In front of the near plane, with a little margin. */
const MIN_VIEW_Z = 0.6;

const _world = new Vector3();
const _view = new Vector3();
const _screen = new Vector3();
const _viewport = new Viewport(0, 0, 0, 0);

const css = (colour) => `rgb(${colour.map((c) => Math.round(Math.min(1, c) * 255)).join(",")})`;

export function initNameplates(scene, engine, rig) {
    const layer = document.getElementById("nameplates");
    const party = document.getElementById("party-hud");
    /** @type {Array<{root:HTMLElement,label:HTMLElement,bar:HTMLElement}>} */
    const plates = [];
    /** @type {Array<{root:HTMLElement,dot:HTMLElement,name:HTMLElement,bar:HTMLElement}>} */
    const rows = [];
    let lastRoster = "";

    function plate(index) {
        while (plates.length <= index) {
            const root = document.createElement("div");
            root.className = "nameplate";
            root.hidden = true;
            const label = document.createElement("span");
            const bar = document.createElement("i");
            const inner = document.createElement("b");
            bar.append(inner);
            root.append(label, bar);
            layer.append(root);
            plates.push({ root, label, bar: inner, colour: -1, name: "" });
        }
        return plates[index];
    }

    function row(index) {
        while (rows.length <= index) {
            const root = document.createElement("div");
            const dot = document.createElement("i");
            const name = document.createElement("span");
            const bar = document.createElement("em");
            const inner = document.createElement("b");
            bar.append(inner);
            root.append(dot, name, bar);
            party.append(root);
            rows.push({ root, dot, name, bar: inner });
        }
        return rows[index];
    }

    /**
     * @param {Array} remotes live slots from `RemotePlayers`
     * @param {import("../net/room.js").Room|null} room
     * @param {import("../world/health.js").PlayerHealth} health
     */
    function update(remotes, room, health) {
        const showing = input.active && remotes.length > 0;
        layer.hidden = !showing;
        if (showing) {
            const scaling = engine.getHardwareScalingLevel();
            rig.camera.viewport.toGlobalToRef(
                engine.getRenderWidth(), engine.getRenderHeight(), _viewport
            );
            const transform = scene.getTransformMatrix();
            const view = rig.camera.getViewMatrix();

            for (let i = 0; i < remotes.length; i++) {
                const slot = remotes[i];
                const node = plate(i);
                _world.set(slot.x, slot.y + 2.25, slot.z);
                Vector3.TransformCoordinatesToRef(_world, view, _view);
                const distance = Vector3.Distance(rig.camera.position, _world);
                if (_view.z < MIN_VIEW_Z || distance > MAX_DISTANCE) {
                    node.root.hidden = true;
                    continue;
                }
                Vector3.ProjectToRef(_world, Matrix.IdentityReadOnly, transform, _viewport, _screen);
                node.root.hidden = false;
                node.root.style.transform =
                    `translate(-50%, -100%) translate(${(_screen.x * scaling).toFixed(1)}px, ${(_screen.y * scaling).toFixed(1)}px)`;
                // Fade with distance rather than cutting off at the limit.
                node.root.style.opacity = (1 - Math.min(0.72, distance / MAX_DISTANCE)).toFixed(2);
                node.root.classList.toggle("is-down", slot.downed);
                // Identity changes once per join; only the health pip moves.
                if (node.colour !== slot.colorIndex || node.name !== slot.name) {
                    const colour = css(PLAYER_COLORS[slot.colorIndex]);
                    node.label.textContent = slot.name;
                    node.label.style.color = colour;
                    node.bar.style.background = colour;
                    node.colour = slot.colorIndex;
                    node.name = slot.name;
                }
                node.bar.style.width = `${Math.max(0, Math.min(100, slot.hp))}%`;
            }
            for (let i = remotes.length; i < plates.length; i++) plates[i].root.hidden = true;
        }

        // ------------------------------------------------------- party list
        const members = room && room.active ? [...room.players.values()] : [];
        party.hidden = !input.active || members.length < 2;
        if (party.hidden) return;

        const key = members.map((p) => `${p.id}:${p.colorIndex}:${p.name}`).join("|");
        const changed = key !== lastRoster;
        lastRoster = key;

        for (let i = 0; i < members.length; i++) {
            const member = members[i];
            const node = row(i);
            const mine = member.id === room.selfId;
            const hp = mine ? health.hp : (member.state?.[6] ?? 100);
            const down = mine ? health.downed : ((member.state?.[7] | 0) & 1) === 1;
            node.root.hidden = false;
            node.root.classList.toggle("is-down", down);
            if (changed) {
                node.dot.style.color = css(PLAYER_COLORS[member.colorIndex % PLAYER_COLORS.length]);
                node.name.textContent = mine ? `${member.name} (나)` : member.name;
            }
            node.bar.style.width = `${Math.max(0, Math.min(100, hp))}%`;
        }
        for (let i = members.length; i < rows.length; i++) rows[i].root.hidden = true;
    }

    return { update };
}
