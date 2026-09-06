import test from "node:test";
import assert from "node:assert/strict";
import { PlayerHealth, MAX_HP, CONTACT_DAMAGE } from "../src/world/health.js";

function setup() {
    const events = [];
    const health = new PlayerHealth({ onEvent: (kind) => events.push(kind) });
    health.grace = 0; // skip the spawn grace so the first hit lands
    return { health, events };
}

test("a hit lands once, then the grace window refuses the next one", () => {
    const { health, events } = setup();
    assert.equal(health.damage(CONTACT_DAMAGE), CONTACT_DAMAGE);
    assert.equal(health.hp, MAX_HP - CONTACT_DAMAGE);
    assert.equal(health.damage(CONTACT_DAMAGE), 0, "inside the grace window");
    health.update(1.0, true);
    assert.equal(health.damage(CONTACT_DAMAGE), CONTACT_DAMAGE);
    assert.deepEqual(events, ["hurt", "hurt"]);
});

test("four contacts put you down, and the snow puts you back up", () => {
    const { health, events } = setup();
    for (let i = 0; i < 8 && !health.downed; i++) {
        health.damage(CONTACT_DAMAGE);
        health.update(1.0, true);
    }
    assert.ok(health.downed);
    assert.equal(health.hp, 0);
    assert.equal(health.downs, 1);
    assert.equal(health.damage(999), 0, "nothing touches you while down");
    health.update(10, true);
    assert.equal(health.downed, false);
    assert.equal(health.hp, MAX_HP);
    assert.equal(events.at(-1), "revive");
});

test("regeneration waits, then runs faster in daylight than at night", () => {
    const { health } = setup();
    health.damage(50);
    health.update(1.0, false);
    assert.equal(health.hp, 50, "still inside the delay");
    const night = new PlayerHealth();
    night.grace = 0;
    night.damage(50);
    for (let i = 0; i < 200; i++) { health.update(0.05, false); night.update(0.05, true); }
    assert.ok(health.hp > night.hp, "daylight closes the wound faster");
    assert.ok(night.hp > 50, "but the night is not nothing");
});

test("healing is capped, and a paused frame moves no timer", () => {
    const { health } = setup();
    health.damage(30);
    assert.equal(health.heal(1000), 30);
    assert.equal(health.hp, MAX_HP);
    const before = health.sinceDamage;
    health.update(0, false);
    assert.equal(health.sinceDamage, before);
});
