/**
 * The minimap.
 *
 * A 2D canvas rather than a second camera. A top-down render target would mean
 * another pass over 333k clipmap triangles, three more cascade lookups and a
 * second view-projection every frame, to draw something 170 px across — while
 * the terrain the map wants is already sitting in memory as `heightCPU`, the
 * readback the character grounds against. So the relief is baked once into an
 * offscreen canvas at load, and each frame is a `drawImage` plus a handful of
 * dots.
 *
 * North is up and the map does not rotate. A rotating map is easier to steer by
 * and much harder to *remember* — and the thing you actually need it for here
 * is "where did my friend go", which is a memory question.
 *
 * Redrawn at 20 Hz. Nothing on it moves fast enough to earn 144.
 */

import { S, onChange } from "../core/settings.js";
import { input } from "../core/input.js";
import { PLAY_RADIUS } from "../terrain/playArea.js";
import { PLAYER_COLORS } from "../net/room.js";

/** Metres from edge to edge of the baked image. A little past the fence. */
const BAKE_SPAN = PLAY_RADIUS * 2 + 80;
/** Pixels across the bake — about 2 m each, which is finer than the display. */
const BAKE_RES = 660;

/** How much world the map shows, per zoom step, as a radius in metres. */
const ZOOMS = [130, 400, PLAY_RADIUS + 30];
const ZOOM_LABELS = ["가까이", "넓게", "설원 전체"];

const REDRAW_INTERVAL = 1 / 20;

/** Snow, in map colours: cool in the hollows, pale on the crests. */
const LOW = [58, 84, 114];
const HIGH = [226, 240, 250];
/** Outside the fence. Present, so the edge of the world is a place, not a void. */
const BEYOND = [11, 19, 29];

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const css = (colour) => `rgb(${colour.map((c) => Math.round(Math.min(1, c) * 255)).join(",")})`;

/**
 * @param {object} deps
 * @param {import("../terrain/terrain.js").Terrain} deps.terrain
 * @param {import("../character/controller.js").CharacterController} deps.character
 * @param {import("../core/camera.js").CameraRig} deps.rig
 */
export function initMinimap({ terrain, character, rig }) {
    const root = document.getElementById("minimap");
    const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("minimap-canvas"));
    const label = document.getElementById("minimap-zoom");
    const ctx = canvas.getContext("2d");

    const relief = bakeRelief(terrain.heightfield);

    /** Index into `ZOOMS`, or -1 for "the player turned it off". */
    let zoom = 0;
    let since = REDRAW_INTERVAL;
    let cssSize = 0;
    let dpr = 0;

    function resize() {
        const next = root.clientWidth;
        const ratio = window.devicePixelRatio || 1;
        if (next === cssSize && ratio === dpr) return;
        cssSize = next;
        dpr = ratio;
        canvas.width = Math.round(cssSize * ratio);
        canvas.height = Math.round(cssSize * ratio);
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function setZoom(next) {
        zoom = next;
        root.hidden = zoom < 0 || !S.showMinimap;
        label.textContent = zoom < 0 ? "" : ZOOM_LABELS[zoom];
        since = REDRAW_INTERVAL; // redraw on the very next frame
    }

    window.addEventListener("keydown", (event) => {
        if (event.code !== "KeyM" || event.repeat) return;
        if (!input.active || event.ctrlKey || event.metaKey || event.altKey) return;
        // Three steps and off, so the key that shows the map can also hide it.
        setZoom(zoom + 1 >= ZOOMS.length ? -1 : zoom + 1);
    });
    onChange("showMinimap", () => setZoom(S.showMinimap ? Math.max(0, zoom) : -1));

    /**
     * @param {number} dt real seconds
     * @param {{monsters: Array}} monsters
     * @param {Array} remotes live slots from `RemotePlayers`
     * @param {import("../net/room.js").Room|null} room
     */
    function update(dt, monsters, remotes, room) {
        const showing = input.active && zoom >= 0 && S.showMinimap;
        if (root.hidden !== !showing) root.hidden = !showing;
        if (!showing) return;

        since += dt;
        if (since < REDRAW_INTERVAL) return;
        since = 0;
        resize();
        draw(monsters, remotes, room);
    }

    function draw(monsters, remotes, room) {
        const size = cssSize;
        const half = size / 2;
        const view = ZOOMS[zoom];
        // Pixels per metre on screen. Everything below is in these units.
        const scale = half / view;
        const px = character.position.x;
        const pz = character.position.z;

        ctx.clearRect(0, 0, size, size);
        ctx.save();
        ctx.beginPath();
        ctx.arc(half, half, half, 0, Math.PI * 2);
        ctx.clip();

        // ------------------------------------------------------------ relief
        const src = reliefSourceRect(px, pz, view);
        ctx.fillStyle = css([BEYOND[0] / 255, BEYOND[1] / 255, BEYOND[2] / 255]);
        ctx.fillRect(0, 0, size, size);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(relief, src.sx, src.sy, src.span, src.span, 0, 0, size, size);

        // -------------------------------------------------------- view cone
        // Where the camera is pointing, not where the body is facing — that is
        // the direction the screen is about to move in.
        const cone = 0.62;
        ctx.beginPath();
        ctx.moveTo(half, half);
        // Screen angle runs the other way round from world yaw, so the ends
        // are swapped — otherwise the wedge is the 5.6 radians nobody is
        // looking at.
        ctx.arc(half, half, half * 0.9,
            angleToScreen(rig.yaw + cone), angleToScreen(rig.yaw - cone));
        ctx.closePath();
        ctx.fillStyle = "rgba(226, 243, 255, 0.10)";
        ctx.fill();

        // -------------------------------------------------------- the fence
        const fence = PLAY_RADIUS * scale;
        const fx = half - px * scale;
        const fy = half - pz * scale;
        ctx.beginPath();
        ctx.arc(fx, fy, fence, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(180, 214, 236, 0.42)";
        ctx.setLineDash([4, 5]);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        // ----------------------------------------------------- night shadows
        for (const m of monsters.monsters) {
            if (!m.active || m.hp <= 0) continue;
            const x = half + (m.x - px) * scale;
            const y = half + (m.z - pz) * scale;
            if (outside(x, y, half, 4)) continue;
            ctx.beginPath();
            ctx.arc(x, y, 3.2, 0, Math.PI * 2);
            ctx.fillStyle = "#0a1826";
            ctx.fill();
            ctx.strokeStyle = "#6fe0ff";
            ctx.lineWidth = 1.4;
            ctx.stroke();
        }

        // ------------------------------------------------------ other mages
        // A friend past the edge is pinned to it rather than dropped: "which
        // way do I run" is the whole reason to look at this thing.
        for (const slot of remotes) {
            const colour = css(PLAYER_COLORS[slot.colorIndex]);
            const at = pinToEdge((slot.x - px) * scale, (slot.z - pz) * scale, half - 7);
            const pinned = at.pinned;
            ctx.beginPath();
            ctx.arc(half + at.x, half + at.y, pinned ? 3.4 : 4.4, 0, Math.PI * 2);
            if (pinned) {
                ctx.strokeStyle = colour;
                ctx.lineWidth = 1.8;
                ctx.stroke();
            } else {
                ctx.fillStyle = slot.downed ? "#0a1826" : colour;
                ctx.fill();
                ctx.strokeStyle = slot.downed ? colour : "rgba(6, 14, 22, 0.85)";
                ctx.lineWidth = 1.4;
                ctx.stroke();
            }
        }

        // -------------------------------------------------------------- you
        const dx = Math.sin(character.facing);
        const dy = Math.cos(character.facing);
        ctx.beginPath();
        ctx.moveTo(half + dx * 7.5, half + dy * 7.5);
        ctx.lineTo(half - dx * 4.5 - dy * 4.5, half - dy * 4.5 + dx * 4.5);
        ctx.lineTo(half - dx * 4.5 + dy * 4.5, half - dy * 4.5 - dx * 4.5);
        ctx.closePath();
        ctx.fillStyle = room && room.active
            ? css(PLAYER_COLORS[selfColour(room)])
            : "#f0f9ff";
        ctx.fill();
        ctx.strokeStyle = "rgba(6, 14, 22, 0.9)";
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.restore();
    }

    setZoom(S.showMinimap ? 0 : -1);
    return { update };
}

// ------------------------------------------------------------------- maths
//
// Everything below is the part that can be wrong without looking wrong — the
// map is 176 px across and a mirrored axis or a wedge drawn the long way round
// reads as "a bit odd" rather than as a bug. It is exported and tested.

/**
 * Screen-space angle for a world yaw, for `ctx.arc`.
 *
 * The map lays world +X along screen +X and world +Z along screen +Y, so north
 * (−Z) is up. World yaw is measured `atan2(x, z)`; canvas angles are measured
 * `atan2(y, x)` from +X. The two therefore run in opposite directions, which is
 * why any arc drawn from a yaw range has to pass its ends swapped.
 *
 * @param {number} yaw
 */
export function angleToScreen(yaw) {
    return Math.atan2(Math.cos(yaw), Math.sin(yaw));
}

/**
 * Source rectangle, in baked-image pixels, for the square of world visible
 * around a player at `(px, pz)` with a view radius of `view` metres.
 *
 * @param {number} px @param {number} pz @param {number} view
 * @returns {{sx:number, sy:number, span:number}}
 */
export function reliefSourceRect(px, pz, view) {
    const perMetre = BAKE_RES / BAKE_SPAN;
    return {
        sx: (px - view + BAKE_SPAN / 2) * perMetre,
        sy: (pz - view + BAKE_SPAN / 2) * perMetre,
        span: view * 2 * perMetre,
    };
}

/**
 * Place a marker that may be off the map. Anything past the rim is pinned to
 * it and reported as pinned, so the caller can draw it hollow: "your friend is
 * that way, further than this" is more use than no dot at all.
 *
 * @param {number} dx metres east of the player, already scaled to pixels
 * @param {number} dy metres south of the player, already scaled to pixels
 * @param {number} edge pixels from the centre to pin at
 * @returns {{x:number, y:number, pinned:boolean}} offsets from the centre
 */
export function pinToEdge(dx, dy, edge) {
    const distance = Math.hypot(dx, dy);
    if (distance <= edge || distance < 1e-6) return { x: dx, y: dy, pinned: false };
    const k = edge / distance;
    return { x: dx * k, y: dy * k, pinned: true };
}

function outside(x, y, half, margin) {
    return Math.hypot(x - half, y - half) > half + margin;
}

function selfColour(room) {
    const me = room.players.get(room.selfId);
    return (me ? me.colorIndex : 0) % PLAYER_COLORS.length;
}

/**
 * Bake the relief once, into an offscreen canvas covering the whole play area.
 *
 * Hillshaded from a fixed north-west key rather than from the sun: the sun here
 * swings through a full day and sits at thirteen degrees, which at some hours
 * would flatten the map to a single tone exactly when a player most needs to
 * read it. A map's light is a convention, not a light.
 *
 * Exported because it is the one part of the map with no way to tell from the
 * code whether it came out readable — it touches nothing but a 2D context, so
 * it can be run against a stub and looked at.
 *
 * @param {import("../terrain/heightfield.js").Heightfield} field
 */
export function bakeRelief(field) {
    const canvas = document.createElement("canvas");
    canvas.width = BAKE_RES;
    canvas.height = BAKE_RES;
    const ctx = canvas.getContext("2d");
    const image = ctx.createImageData(BAKE_RES, BAKE_RES);
    const out = image.data;

    const heights = field.heightCPU;
    const res = field.cpuRes;
    const origin = field.origin;
    const worldSize = field.size;
    // Bilinear, not the bicubic reconstruction the character grounds against:
    // sixteen taps would move nothing in a 2 m/pixel picture. But not nearest
    // either — the map is sampled at twice the texel spacing, and point
    // sampling turns every dune flank into a staircase that the hillshade then
    // amplifies into visible blocks.
    const clampi = (v, hi) => (v < 0 ? 0 : v > hi ? hi : v);
    const sample = (wx, wz) => {
        if (!heights) return 0;
        const fx = ((wx - origin.x) / worldSize) * res - 0.5;
        const fz = ((wz - origin.y) / worldSize) * res - 0.5;
        const ix = Math.floor(fx);
        const iz = Math.floor(fz);
        const tx = fx - ix;
        const tz = fz - iz;
        const x0 = clampi(ix, res - 1), x1 = clampi(ix + 1, res - 1);
        const z0 = clampi(iz, res - 1) * res, z1 = clampi(iz + 1, res - 1) * res;
        const top = heights[z0 + x0] + (heights[z0 + x1] - heights[z0 + x0]) * tx;
        const bottom = heights[z1 + x0] + (heights[z1 + x1] - heights[z1 + x0]) * tx;
        return top + (bottom - top) * tz;
    };

    const lo = field.minHeight;
    const span = Math.max(1e-3, field.maxHeight - field.minHeight);
    const metresPerPixel = BAKE_SPAN / BAKE_RES;
    // A dune flank is tens of metres across; differencing at one texel measures
    // the bake's own noise instead. Three pixels is the feature the map is for.
    const step = metresPerPixel * 3;

    for (let py = 0; py < BAKE_RES; py++) {
        const wz = (py + 0.5) * metresPerPixel - BAKE_SPAN / 2;
        for (let pxi = 0; pxi < BAKE_RES; pxi++) {
            const wx = (pxi + 0.5) * metresPerPixel - BAKE_SPAN / 2;
            const o = (py * BAKE_RES + pxi) * 4;

            const h = sample(wx, wz);
            // Eased, so the mid-heights — where nearly every texel sits — get
            // the widest part of the ramp instead of a flat grey band.
            const raw = clamp01((h - lo) / span);
            const t = raw * raw * (3 - 2 * raw);

            // Slope, as a pair of differences rather than a normalised normal:
            // the shade only needs their weighted sum. Light from the
            // north-west, the convention every paper map is read with — a
            // surface facing the light has height rising away from it, so both
            // gradients enter positive.
            const gx = (sample(wx + step, wz) - sample(wx - step, wz)) / (2 * step);
            const gz = (sample(wx, wz + step) - sample(wx, wz - step)) / (2 * step);
            // A gain around 1, not a multiplier down from it. Shading the tone
            // *darker* is what turns a snowfield into wet rock: the crests have
            // to be allowed to blow past white.
            const shade = Math.max(0.5, Math.min(1.34, 0.95 + (gx + gz) * 1.7));

            let r = (LOW[0] + (HIGH[0] - LOW[0]) * t) * shade;
            let g = (LOW[1] + (HIGH[1] - LOW[1]) * t) * shade;
            let b = (LOW[2] + (HIGH[2] - LOW[2]) * t) * shade;

            const radius = Math.hypot(wx, wz);
            if (radius > PLAY_RADIUS) {
                // Fade out over the last few metres instead of drawing a hard
                // ring the dashed fence would then fight with.
                const k = clamp01((radius - PLAY_RADIUS) / 26);
                r += (BEYOND[0] - r) * k;
                g += (BEYOND[1] - g) * k;
                b += (BEYOND[2] - b) * k;
            }

            out[o] = r;
            out[o + 1] = g;
            out[o + 2] = b;
            out[o + 3] = 255;
        }
    }

    ctx.putImageData(image, 0, 0);
    return canvas;
}
