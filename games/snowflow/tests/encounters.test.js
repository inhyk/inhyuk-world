import test from "node:test";
import assert from "node:assert/strict";
import { NightEncounters, MAX_MONSTERS } from "../src/world/encounters.js";

function setup() {
    const events = [];
    const system = new NightEncounters({ heightAt: () => 0, clampPosition: () => {},
        random: () => 0.5, onEvent: (kind) => events.push(kind) });
    const player = { x: 0, y: 0, z: 0 };
    const tick = (dt, night = true, hit = () => 0, shield = false) =>
        system.update(dt, night, player, 0, hit, shield);
    return { system, player, events, tick };
}

test("no daytime spawns; four at dusk, bounded at eight, dawn clears all", () => {
    const { system: s, events, tick } = setup();
    tick(120, false);
    assert.equal(s.aliveCount, 0);
    tick(0.016);
    assert.equal(s.aliveCount, 4);
    for (let i = 0; i < 20; i++) tick(8);
    assert.equal(s.aliveCount, MAX_MONSTERS);
    assert.equal(s.monsters.length, MAX_MONSTERS);
    tick(0.016, false);
    assert.equal(s.aliveCount, 0);
    assert.deepEqual(events.filter((x) => x !== "contact"), ["night", "dawn"]);
    tick(0.016);
    assert.equal(s.aliveCount, 4);
});

test("spawn has a readable windup and monsters follow the player", () => {
    const { system: s, tick } = setup();
    tick(0.1);
    const initial = s.monsters[0].z;
    tick(0.1);
    assert.equal(s.monsters[0].z, initial);
    tick(1);
    assert(s.monsters[0].z < initial);
});

test("pausing prevents spawning, moving, damage, and repeated transitions", () => {
    const { system: s, events, tick } = setup();
    tick(0);
    assert.equal(s.aliveCount, 0);
    tick(1);
    const before = JSON.stringify(s.monsters);
    tick(0, true, () => 2);
    assert.equal(JSON.stringify(s.monsters), before);
    assert.deepEqual(events, ["night"]);
});

test("damage cooldown prevents per-frame kills; strong magic defeats immediately", () => {
    const { system: s, tick } = setup();
    tick(1, true, () => 1);
    assert.equal(s.monsters[0].hp, 1);
    tick(0.01, true, () => 1);
    assert.equal(s.monsters[0].hp, 1);
    tick(0.71, true, () => 1);
    assert.equal(s.defeated, 4);
    tick(0.66);
    assert.equal(s.monsters.filter((m) => m.active).length, 0);
    tick(0.1, false); tick(1, true, () => 2);
    assert.equal(s.aliveCount, 0);
    assert.equal(s.defeated, 8);
});

test("contact knocks player back with a cooldown; shield blocks contact", () => {
    const { system: s, player, events, tick } = setup();
    tick(1);
    for (const m of s.monsters) if (m.active) { m.x = 0; m.z = 1.3; }
    tick(0.016);
    assert(player.z < 0);
    assert.equal(events.filter((e) => e === "contact").length, 1);
    player.z = 0;
    for (const m of s.monsters) if (m.active) { m.z = 1.3; }
    tick(0.016, true, () => 0, true);
    assert.equal(player.z, 0);
    assert(s.monsters.filter((m) => m.active).every((m) => Math.hypot(m.x, m.z) >= 3.15));
    assert.equal(events.filter((e) => e === "contact").length, 1);
});

test("pool is reused over repeated nights and spawns stay outside safety radius", () => {
    const { system: s, tick } = setup();
    const slots = s.monsters.slice();
    for (let i = 0; i < 100; i++) {
        tick(0.01, false); tick(0.01);
        assert.equal(s.aliveCount, 4);
        assert(s.monsters.filter((m) => m.active).every((m) => Math.hypot(m.x, m.z) >= 9));
    }
    assert.deepEqual(s.monsters, slots);
    s.clampPosition = (p) => { p.x = 0; p.z = 0; };
    s.clear();
    assert.equal(s.spawn({ x: 0, y: 0, z: 0 }), false);
});

test("a guest adopts the host's shadows and never spawns its own", () => {
    const host = setup();
    const guest = setup();
    host.tick(0.016); // dusk: four shadows
    guest.system.applySnapshot(host.system.snapshot());
    assert.equal(guest.system.aliveCount, 4);
    // The guest simulates nothing: a hundred seconds add no shadow of its own.
    for (let i = 0; i < 100; i++) {
        guest.system.updateRemote(1, guest.player, () => 0, false, () => {});
    }
    assert.equal(guest.system.aliveCount, 4);
});

test("a guest's hit is reported once and the host is the one who kills", () => {
    const host = setup();
    const guest = setup();
    host.tick(0.016);
    guest.system.applySnapshot(host.system.snapshot());

    const reports = [];
    const hitAll = () => 1;
    const step = (dt) =>
        guest.system.updateRemote(dt, guest.player, hitAll, false, (id, d) => reports.push([id, d]));

    step(0.016);
    assert.equal(reports.length, 0, "the spawn windup is respected on the guest too");
    // Age belongs to the host, so the windup only passes once a newer snapshot
    // arrives — a guest cannot age a shadow into range on its own.
    host.tick(1);
    guest.system.applySnapshot(host.system.snapshot());
    step(0.016);
    assert.equal(reports.length, 4);
    // The cooldown is the guest's own, so a spell cannot report every frame.
    const before = reports.length;
    step(0.1);
    assert.equal(reports.length, before);

    for (const [id, damage] of reports) host.system.applyReportedHit(id, damage);
    assert.equal(host.system.aliveCount, 4, "one point each, two are needed");
    for (const [id, damage] of reports) host.system.applyReportedHit(id, damage);
    assert.equal(host.system.aliveCount, 0);
    assert.equal(host.system.defeated, 4);
});

test("a snapshot round-trip places a returning slot instead of sliding it", () => {
    const host = setup();
    const guest = setup();
    host.tick(0.016);
    guest.system.applySnapshot(host.system.snapshot());
    const first = guest.system.monsters[0];
    assert.ok(Math.hypot(first.x, first.z) > 9, "placed where the host put it");

    host.system.clear();
    guest.system.applySnapshot(host.system.snapshot());
    assert.equal(guest.system.aliveCount, 0);

    host.system.monsters[0].active = true;
    host.system.monsters[0].hp = 2;
    host.system.monsters[0].x = 40;
    host.system.monsters[0].z = -40;
    guest.system.applySnapshot(host.system.snapshot());
    assert.equal(guest.system.monsters[0].x, 40);
    assert.equal(guest.system.monsters[0].z, -40);
});
