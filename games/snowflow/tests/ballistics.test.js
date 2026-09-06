import test from "node:test";
import assert from "node:assert/strict";
import { Ballistics, MAX_BALLS, BALL_RADIUS, throwVelocity } from "../src/world/ballistics.js";

function setup(ground = 0) {
    const impacts = [];
    const b = new Ballistics({
        heightAt: () => ground,
        onImpact: (ball, target) =>
            impacts.push({ id: ball.id, target, x: ball.x, y: ball.y, z: ball.z }),
    });
    return { b, impacts };
}

const target = (x, z, id = "them") => ({ id, x, y: 0, z, rise: 0.9, radius: 0.55 });

test("a ball arcs, lands, and gives its slot back", () => {
    const { b, impacts } = setup();
    b.launch(0, 1.4, 0, 0, 4, 18, "me", true);
    assert.equal(b.liveCount, 1);
    for (let i = 0; i < 300 && b.liveCount; i++) b.update(1 / 60, []);
    assert.equal(b.liveCount, 0);
    assert.equal(impacts.length, 1);
    assert.equal(impacts[0].target, null, "it hit the ground");
    assert.ok(impacts[0].z > 5, `carried downrange, got ${impacts[0].z}`);
});

test("a fast ball cannot pass through a body between two frames", () => {
    // 26 m/s at someone eight metres away, stepped at 30 Hz: 87 cm of travel a
    // frame against a body 55 cm wide. Without sub-stepping this is a clean
    // miss that nobody could ever explain.
    const { b, impacts } = setup();
    b.launch(0, 1.4, 0, 0, 0, 26, "me", true);
    const them = [target(0, 8)];
    for (let i = 0; i < 120 && b.liveCount; i++) b.update(1 / 30, them);
    assert.equal(impacts.length, 1);
    assert.equal(impacts[0].target, them[0]);
});

test("your own throw cannot hit you, and someone else's can", () => {
    const { b, impacts } = setup();
    // From hand height, six metres out — squarely on the chest either way.
    const me = target(0, 6, "me");
    b.launch(0, 1.4, 0, 0, 0, 22, "me", true);
    for (let i = 0; i < 120 && b.liveCount; i++) b.update(1 / 60, [me]);
    assert.equal(impacts[0].target, null, "passed through its own thrower");

    impacts.length = 0;
    b.launch(0, 1.4, 0, 0, 0, 22, "them", false);
    for (let i = 0; i < 120 && b.liveCount; i++) b.update(1 / 60, [me]);
    assert.equal(impacts[0].target, me);
});

test("the pool is bounded and never grows", () => {
    const { b } = setup();
    for (let i = 0; i < MAX_BALLS + 12; i++) b.launch(0, 2, 0, 0, 1, 10, "me", true);
    assert.equal(b.balls.length, MAX_BALLS);
    assert.equal(b.liveCount, MAX_BALLS);
    assert.equal(b.launch(0, 2, 0, 0, 1, 10, "me", true), null, "a full pool refuses");
    b.clear();
    assert.equal(b.liveCount, 0);
});

test("a ball settles on the ground it was given, not on zero", () => {
    const { b, impacts } = setup(37.5);
    b.launch(0, 40, 0, 0, 0, 6, "me", true);
    for (let i = 0; i < 300 && b.liveCount; i++) b.update(1 / 60, []);
    assert.equal(impacts.length, 1);
    assert.equal(impacts[0].y, 37.5, "it stops on the snow, wherever the snow is");
    assert.ok(BALL_RADIUS > 0);
});

test("a paused frame throws nothing anywhere", () => {
    const { b } = setup();
    const ball = b.launch(0, 2, 0, 0, 0, 10, "me", true);
    const z = ball.z;
    b.update(0, []);
    assert.equal(ball.z, z);
});

test("a level throw is lobbed and a downward one is not", () => {
    const out = [0, 0, 0];
    throwVelocity(0, 0, 1, 1, out);
    assert.ok(out[1] > 0, "aiming at the horizon still arcs");

    const level = out[1];
    throwVelocity(0, -0.9, 0.44, 1, out);
    assert.ok(out[1] < 0, "aiming at someone's boots throws down at them");
    assert.ok(out[1] < level);

    // Charge is the only thing that changes the speed.
    const weak = throwVelocity(0, 0, 1, 0, [0, 0, 0]);
    const strong = throwVelocity(0, 0, 1, 1, [0, 0, 0]);
    assert.ok(Math.hypot(...strong) > Math.hypot(...weak) * 1.4);
});
