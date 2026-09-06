import test from "node:test";
import assert from "node:assert/strict";
import { DawnPack, MAX_WHIRLS, isDawn } from "../src/world/dawnPack.js";
import { NightEncounters } from "../src/world/encounters.js";

function setup() {
    const events = [];
    const pack = new DawnPack({ heightAt: () => 0, clampPosition: () => {},
        random: () => 0.5, onEvent: (kind) => events.push(kind) });
    const player = { x: 0, y: 0, z: 0 };
    const tick = (dt, hour = 5.5, hit = () => 0, shield = false) =>
        pack.update(dt, hour, player, 0, hit, shield);
    return { pack, player, events, tick };
}

test("dawn is 05:00 to 07:00, straddling sunrise", () => {
    assert.equal(isDawn(4.99), false);
    assert.equal(isDawn(5), true);
    assert.equal(isDawn(5.99), true, "still night for the wraiths, and dawn for these");
    assert.equal(isDawn(6.5), true, "day for the wraiths, and still dawn for these");
    assert.equal(isDawn(7), false);
});

test("three arrive at first light, the pack caps at five, and seven o'clock clears them", () => {
    const { pack, events, tick } = setup();
    tick(0.016, 3);
    assert.equal(pack.aliveCount, 0);
    tick(0.016, 5);
    assert.equal(pack.aliveCount, 3);
    for (let i = 0; i < 10; i++) tick(6);
    assert.equal(pack.aliveCount, MAX_WHIRLS);
    tick(0.016, 7);
    assert.equal(pack.aliveCount, 0);
    assert.deepEqual(events, ["dawnPack", "dawnEnd"]);
});

test("they circle rather than close, and one point of damage is enough", () => {
    const { pack, player, tick } = setup();
    tick(0.016, 5);
    for (let i = 0; i < 240; i++) tick(1 / 60);
    // After four seconds every whirl is on the ring, not on top of you.
    for (const m of pack.monsters) {
        if (!m.active) continue;
        const d = Math.hypot(m.x - player.x, m.z - player.z);
        assert.ok(d > 1.5 && d < 9, `held off at ${d.toFixed(1)} m`);
    }
    const before = pack.aliveCount;
    tick(1, 5.5, () => 1);
    assert.equal(pack.defeated, before, "a single hit each");
    assert.equal(pack.aliveCount, 0);
});

test("a lunge comes in, bites, and goes back out", () => {
    const { pack, player, events, tick } = setup();
    tick(0.016, 5);
    let closest = Infinity;
    for (let i = 0; i < 60 * 12; i++) {
        tick(1 / 60);
        for (const m of pack.monsters) {
            if (m.active) closest = Math.min(closest, Math.hypot(m.x - player.x, m.z - player.z));
        }
    }
    assert.ok(closest < 1.5, `something came in to ${closest.toFixed(2)} m`);
    assert.ok(events.includes("contact"), "and it landed");
    assert.ok(events.includes("bite"), "as a bite, not a shove");
});

test("the two encounters speak the same wire format", () => {
    const { pack, tick } = setup();
    tick(0.016, 5);
    const wire = pack.snapshot();
    const guest = new DawnPack({ heightAt: () => 0, clampPosition: () => {} });
    guest.applySnapshot(wire);
    assert.equal(guest.aliveCount, pack.aliveCount);

    const night = new NightEncounters({ heightAt: () => 0, clampPosition: () => {}, random: () => 0.5 });
    night.update(0.016, true, { x: 0, y: 0, z: 0 }, 0, () => 0, false);
    assert.equal(night.snapshot().length / night.monsters.length, wire.length / pack.monsters.length,
        "same stride");
});

test("pausing freezes the whole dawn", () => {
    const { pack, tick } = setup();
    tick(0.016, 5);
    const snap = JSON.stringify(pack.snapshot());
    tick(0, 5.5);
    assert.equal(JSON.stringify(pack.snapshot()), snap);
});
