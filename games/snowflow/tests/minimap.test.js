import test from "node:test";
import assert from "node:assert/strict";
import { angleToScreen, reliefSourceRect, pinToEdge } from "../src/ui/minimap.js";
import { PLAY_RADIUS, clampToPlayArea } from "../src/terrain/playArea.js";

/**
 * The map is 176 px across, so a mirrored axis or a wedge drawn the long way
 * round reads as "a bit odd" rather than as a bug. These pin the geometry.
 */

const BAKE_SPAN = PLAY_RADIUS * 2 + 80;
const BAKE_RES = 660;
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("north is up: world yaw maps onto canvas angles, mirrored", () => {
    // Yaw 0 faces world +Z, which the map lays along screen +Y — downward.
    close(angleToScreen(0), Math.PI / 2);
    // Yaw PI faces −Z: north, up the screen.
    close(Math.abs(angleToScreen(Math.PI)), Math.PI / 2);
    assert.ok(angleToScreen(Math.PI) < 0, "up is a negative canvas angle");
    // Yaw PI/2 faces +X: east, to the right.
    close(angleToScreen(Math.PI / 2), 0);
    // And the two conventions run opposite ways, which is why any arc built
    // from a yaw range has to pass its ends swapped.
    assert.ok(angleToScreen(0.3) < angleToScreen(0), "canvas angle falls as yaw rises");
});

test("a view cone drawn from a yaw range sweeps the short way", () => {
    const yaw = 0;
    const cone = 0.62;
    // How `draw` orders them: (yaw + cone) first, (yaw - cone) second.
    const start = angleToScreen(yaw + cone);
    const end = angleToScreen(yaw - cone);
    const swept = end - start; // ctx.arc sweeps clockwise, i.e. increasing
    assert.ok(swept > 0, "the arc runs forwards");
    close(swept, cone * 2, 1e-6);
    assert.ok(swept < Math.PI, "and not the 5.6 radians nobody is looking at");
});

test("the relief source rectangle frames the world square in view", () => {
    const view = 130;
    // Standing at the origin: the window is centred in the bake.
    const middle = reliefSourceRect(0, 0, view);
    close(middle.sx + middle.span / 2, BAKE_RES / 2);
    close(middle.sy + middle.span / 2, BAKE_RES / 2);
    close(middle.span, (view * 2 * BAKE_RES) / BAKE_SPAN);

    // Moving east moves the window east by the same number of metres.
    const east = reliefSourceRect(100, 0, view);
    close(east.sx - middle.sx, (100 * BAKE_RES) / BAKE_SPAN);
    close(east.sy, middle.sy);

    // The whole-field zoom covers the fence in both directions.
    const whole = reliefSourceRect(0, 0, PLAY_RADIUS + 30);
    assert.ok(whole.sx >= 0 && whole.sx + whole.span <= BAKE_RES + 1e-6,
        "the widest zoom never asks for pixels the bake does not have");
});

test("a friend past the rim is pinned to it, not dropped", () => {
    const edge = 81;
    const near = pinToEdge(10, -20, edge);
    assert.equal(near.pinned, false);
    assert.deepEqual([near.x, near.y], [10, -20]);

    const far = pinToEdge(300, 0, edge);
    assert.equal(far.pinned, true);
    close(far.x, edge);
    close(far.y, 0);

    // Pinned markers keep their bearing — that is the whole point of them.
    const diagonal = pinToEdge(300, 300, edge);
    close(Math.hypot(diagonal.x, diagonal.y), edge);
    close(Math.atan2(diagonal.y, diagonal.x), Math.PI / 4);

    // Standing exactly on top of someone must not divide by zero.
    const same = pinToEdge(0, 0, edge);
    assert.deepEqual([same.x, same.y, same.pinned], [0, 0, false]);
});

test("the fence the map draws is the fence bodies are held inside", () => {
    const body = { x: 900, y: 0, z: 0 };
    clampToPlayArea(body);
    close(Math.hypot(body.x, body.z), PLAY_RADIUS);
    const inside = { x: 10, y: 0, z: -20 };
    clampToPlayArea(inside);
    assert.deepEqual([inside.x, inside.z], [10, -20]);
});
