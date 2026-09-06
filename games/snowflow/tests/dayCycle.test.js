import test from "node:test";
import assert from "node:assert/strict";
import { DayCycle, DAY_SECONDS } from "../src/world/dayCycle.js";

test("600 active seconds is one complete day, starting at 06:00", () => {
    const c = new DayCycle();
    assert.equal(DAY_SECONDS, 600);
    assert.equal(c.clock, "06:00");
    assert.equal(c.day, 1);
    c.advance(300);
    assert.equal(c.clock, "18:00");
    assert.equal(c.isNight, true);
    c.advance(300);
    assert.equal(c.clock, "06:00");
    assert.equal(c.day, 2);
    assert.equal(c.isNight, false);
});

test("night begins at 18:00 and ends exactly at 06:00", () => {
    const c = new DayCycle();
    c.advance(299.999);
    assert.equal(c.isNight, false);
    c.advance(0.001);
    assert.equal(c.isNight, true);
    assert.equal(c.secondsUntilTransition, 300);
    c.advance(299.999);
    assert.equal(c.isNight, true);
    c.advance(0.001);
    assert.equal(c.isNight, false);
});

test("date changes at midnight, not at sunrise", () => {
    const c = new DayCycle();
    c.advance(450);
    assert.equal(c.clock, "00:00");
    assert.equal(c.day, 2);
    assert.equal(c.isNight, true);
    assert.equal(c.secondsUntilTransition, 150);
});

test("paused/welcome time is never counted, including the resume frame", () => {
    const c = new DayCycle();
    c.tick(0, false);
    c.tick(120000, true); // Begin play after two minutes of welcome.
    c.tick(122500, false); // Pause after 2.5 seconds.
    assert.equal(c.elapsedSeconds, 2.5);
    c.tick(300000, false);
    c.tick(900000, true);
    assert.equal(c.elapsedSeconds, 2.5);
    c.tick(901500, true);
    assert.equal(c.elapsedSeconds, 4);
});

test("long active frames and many complete cycles do not slow the clock", () => {
    const c = new DayCycle();
    c.tick(0, true);
    c.tick(600000, true);
    assert.equal(c.clock, "06:00");
    assert.equal(c.elapsedSeconds, 600);
    c.advance(600 * 1000);
    assert.equal(c.day, 1002);
    assert.equal(c.clock, "06:00");
});

test("lighting is continuous through dawn/dusk and finite across whole cycles", () => {
    const c = new DayCycle();
    for (let i = 0; i <= 1200; i++) {
        const before = c.nightAmount;
        c.advance(1);
        assert(c.nightAmount >= 0 && c.nightAmount <= 1);
        assert(Math.abs(c.nightAmount - before) < 0.04);
    }
    c.advance(NaN); c.advance(Infinity); c.advance(-600);
    assert.equal(c.elapsedSeconds, 1201);
});
