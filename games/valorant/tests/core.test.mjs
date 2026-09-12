import test from "node:test";
import assert from "node:assert/strict";
import { Match, WALLS, SITE, WEAPONS, collides, move, lineOfSight, pathTo, directionFor, rayBox, raySphere, inPlantSite } from "../src/core.mjs";

function advance(match, seconds, input = {}) {
  for (let remaining = seconds; remaining > 1e-8; remaining -= 1 / 60) match.update(Math.min(remaining, 1 / 60), input);
}
function active(options = {}) {
  const match = new Match({ random: () => 0.5, ...options });
  advance(match, 5.1);
  assert.equal(match.phase, "active");
  return match;
}
function quiet(match) { match.bots.forEach(b => { b.cooldown = 1000; }); }
function aimAt(match, bot, head = true) {
  const p = match.player;
  p.yaw = Math.atan2(bot.x - p.x, bot.z - p.z);
  p.pitch = -Math.atan2((head ? 1.73 : 1.1) - (1.65 + p.y), Math.hypot(bot.x - p.x, bot.z - p.z));
}

test("spawn, defenders and the entire navigation path stay outside walls", () => {
  const match = new Match({ difficulty: "veteran" });
  assert.equal(collides(match.player.x, match.player.z), false);
  for (const bot of match.bots) {
    assert.equal(collides(bot.x, bot.z), false);
    const path = pathTo(bot, match.player);
    assert.ok(path.length > 0);
    let previous = bot;
    for (const node of path) {
      assert.equal(collides(node.x, node.z, 0.5), false);
      assert.ok(Math.hypot(node.x - previous.x, node.z - previous.z) <= 1.6);
      previous = node;
    }
  }
});
test("movement slides along walls and large dashes cannot tunnel through them", () => {
  const player = { x: -7.8, z: -10 };
  move(player, -10, 3);
  assert.ok(player.x > -8.2);
  assert.ok(player.z > -8);
  assert.equal(collides(player.x, player.z), false);
  const runner = { x: 0, z: -18 };
  move(runner, 0, -100);
  assert.ok(runner.z > -22.7);
});
test("ray tests handle parallel rays, misses, and starting inside smoke", () => {
  assert.equal(rayBox({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, z: 5, w: 2, h: 3, d: 2 }), 4);
  assert.equal(rayBox({ x: 2, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, z: 5, w: 2, h: 3, d: 2 }), Infinity);
  assert.equal(raySphere({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }, 3), 3);
  assert.ok(Math.abs(directionFor(Math.PI / 2).x - 1) < 1e-9);
});
test("preparation blocks movement, damage and firing", () => {
  const match = new Match();
  advance(match, 3, { forward: 1, fire: true });
  assert.equal(match.player.z, -18);
  assert.equal(match.player.hp, 100);
  assert.equal(match.ammo, 25);
  assert.equal(match.shots, 0);
});
test("movement is normalized diagonally and independent of frame rate", () => {
  const straight = active(), diagonal = active();
  quiet(straight); quiet(diagonal);
  const z = straight.player.z;
  advance(straight, 0.5, { forward: 1 });
  advance(diagonal, 0.5, { forward: 1, strafe: 1 });
  assert.ok(Math.abs((straight.player.z - z) - Math.hypot(diagonal.player.x, diagonal.player.z - z)) < 1e-6);
});
test("headshots kill immediately; body hits require multiple bullets", () => {
  const match = active(); quiet(match);
  const first = match.bots[0];
  aimAt(match, first, true);
  assert.equal(match.fire(), true);
  assert.equal(first.hp, 0);
  assert.equal(match.headshots, 1);
  assert.equal(match.kills, 1);
  const next = match.bots[1]; next.x = 0; next.z = -6;
  advance(match, 0.2);
  aimAt(match, next, false); match.fire();
  assert.equal(next.hp, 60);
  advance(match, 0.2); match.fire();
  assert.equal(next.hp, 20);
  advance(match, 0.2); match.fire();
  assert.equal(next.hp, 0);
});
test("a solid wall blocks bullets and defender vision", () => {
  const match = active(); quiet(match);
  const bot = match.bots[0];
  match.player.x = -3.2; match.player.z = -10;
  bot.x = -3.2; bot.z = -3;
  aimAt(match, bot); match.fire();
  assert.equal(bot.hp, 100);
  assert.equal(lineOfSight(match.player, bot), false);
  assert.equal(WALLS.some(w => rayBox({ ...match.player, y: 1.65 }, directionFor(match.player.yaw, match.player.pitch), w) < 7), true);
});
test("reload uses reserve, cannot overfill, and is canceled by switching", () => {
  const match = active(); quiet(match);
  match.player.ammo[0] = 3; match.player.reserve[0] = 10;
  assert.equal(match.reload(), true);
  assert.equal(match.fire(), false);
  advance(match, WEAPONS.vandal.reload + 0.05);
  assert.equal(match.ammo, 13); assert.equal(match.player.reserve[0], 0);
  assert.equal(match.reload(), false);
  match.player.reserve[0] = 20;
  match.reload(); match.switchWeapon(2);
  assert.equal(match.player.reload, 0); assert.equal(match.ammo, 12);
  advance(match, 3); match.switchWeapon(1);
  assert.equal(match.ammo, 13);
});
test("automatic fire respects weapon rate and reloads an empty magazine", () => {
  const match = active({ weapon: "phantom" }); quiet(match);
  match.player.yaw = Math.PI;
  advance(match, 0.5, { fire: true });
  assert.ok(match.shots >= 4 && match.shots <= 5);
  match.player.ammo[0] = 0;
  advance(match, 0.2, { fire: true });
  assert.ok(match.player.reload > 0);
});
test("dash has a cooldown, collides, and can move sideways", () => {
  const match = active(); quiet(match);
  const z = match.player.z;
  assert.equal(match.ability("dash", { forward: 0, strafe: 1 }), true);
  assert.ok(match.player.x > 5); assert.equal(match.player.z, z);
  assert.equal(match.ability("dash"), false);
  advance(match, 12.1);
  assert.equal(match.ability("dash"), true);
  assert.equal(collides(match.player.x, match.player.z), false);
});
test("smoke blocks both directions and inside vision, then expires", () => {
  const match = active(); quiet(match);
  match.ability("smoke");
  assert.equal(match.player.smoke, 1);
  const cloud = match.smokes[0];
  const a = { x: 0, z: cloud.z - 4 }, b = { x: 0, z: cloud.z + 4 };
  assert.equal(lineOfSight(a, b), true);
  assert.equal(lineOfSight(a, b, match.smokes), false);
  assert.equal(lineOfSight(b, a, match.smokes), false);
  assert.equal(lineOfSight(cloud, b, match.smokes), false);
  advance(match, 8.1);
  assert.equal(match.smokes.length, 0);
  assert.equal(lineOfSight(a, b, match.smokes), true);
});
test("defenders cannot shoot through an active smoke", () => {
  const match = active({ difficulty: "veteran" });
  match.bots = [match.bots[0]];
  match.bots[0].x = 0; match.bots[0].z = -9;
  match.smokes.push({ x: 0, z: -13, radius: 3, life: 8, id: 1 });
  advance(match, 2);
  assert.equal(match.player.hp, 100);
  assert.equal(match.player.armor, 50);
});
test("healing is gradual, bounded, and consumes one charge", () => {
  const match = active(); quiet(match);
  assert.equal(match.ability("heal"), false);
  match.player.hp = 20;
  assert.equal(match.ability("heal"), true);
  advance(match, 2);
  assert.ok(Math.abs(match.player.hp - 45) < 0.01);
  advance(match, 2.1);
  assert.ok(match.player.hp >= 70 && match.player.hp <= 70.3);
  assert.equal(match.ability("heal"), false);
});
test("spike requires the site, stationary hold, and completes after 2.5 seconds", () => {
  const match = active(); quiet(match);
  advance(match, 3, { plant: true });
  assert.equal(match.spike, null);
  match.player.x = SITE.x; match.player.z = SITE.z;
  advance(match, 1.5, { plant: true });
  assert.ok(match.plant > 1.4);
  advance(match, 0.1, { plant: true, strafe: 1 });
  assert.equal(match.plant, 0);
  advance(match, 2.6, { plant: true });
  assert.ok(match.spike);
  assert.ok(match.spike.timer > 24);
  assert.equal(match.canPlant, false);
});
test("all four corners of the marked square permit planting, outside does not", () => {
  for (const x of [-3.3, 3.3]) for (const z of [8.7, 15.3]) {
    const match = active(); quiet(match);
    match.player.x = x; match.player.z = z;
    assert.equal(inPlantSite(match.player), true);
    assert.equal(match.canPlant, true);
    advance(match, 2.6, { plant: true });
    assert.ok(match.spike);
  }
  for (const point of [{ x: 3.51, z: 12 }, { x: 0, z: 8.49 }, { x: -3.51, z: 12 }, { x: 0, z: 15.51 }]) assert.equal(inPlantSite(point), false);
});
test("jumping or shooting cancels planting immediately", () => {
  for (const action of ["jump", "fire"]) {
    const match = active(); quiet(match);
    match.player.x = 0; match.player.z = 12;
    advance(match, 1, { plant: true });
    assert.ok(match.plant > 0.9);
    advance(match, 0.1, { plant: true, [action]: true });
    assert.equal(match.plant, 0);
    assert.equal(match.spike, null);
  }
});
test("a planted spike overrides the round timer and explodes for a win", () => {
  const match = active(); quiet(match);
  match.spike = { x: 0, z: 12, timer: 0.2 };
  match.timer = 0.01;
  advance(match, 0.1);
  assert.equal(match.phase, "active");
  advance(match, 0.2);
  assert.equal(match.phase, "roundEnd");
  assert.deepEqual(match.score, [1, 0]);
  assert.equal(match.result.reason, "스파이크 폭발");
});
test("defenders can reach and defuse a spike instead of stalling behind cover", () => {
  const match = active(); quiet(match);
  match.player.x = -17.8; match.player.z = -18;
  match.bots = [match.bots[0]];
  match.bots[0].x = 0; match.bots[0].z = 7;
  match.bots[0].repath = 0;
  match.spike = { x: 0, z: 12, timer: 25 };
  advance(match, 11);
  assert.deepEqual(match.score, [0, 1]);
  assert.equal(match.result.reason, "스파이크 해체됨");
});
test("timeout and death award only one round to defenders", () => {
  const match = active(); quiet(match);
  match.timer = 0.01;
  advance(match, 0.1);
  assert.deepEqual(match.score, [0, 1]);
  match.finishRound(false, "duplicate");
  assert.deepEqual(match.score, [0, 1]);
  const other = active();
  other.damage(1000, other.bots[0]);
  assert.equal(other.player.hp, 0);
  assert.deepEqual(other.score, [0, 1]);
});
test("pausing freezes all state and blocks direct actions", () => {
  const match = active(); quiet(match);
  match.player.ammo[0] = 2;
  match.reload();
  match.ability("smoke");
  match.paused = true;
  const before = JSON.stringify({ p: match.player, bots: match.bots, time: match.timer, smoke: match.smokes });
  advance(match, 20, { forward: 1, fire: true, plant: true });
  assert.equal(match.fire(), false); assert.equal(match.ability("dash"), false);
  match.switchWeapon(2);
  assert.equal(JSON.stringify({ p: match.player, bots: match.bots, time: match.timer, smoke: match.smokes }), before);
});
test("round transitions restore the loadout and the match ends at three wins", () => {
  const match = active({ difficulty: "rookie", weapon: "phantom" });
  for (let round = 1; round <= 3; round++) {
    match.player.hp = 20; match.player.smoke = 0;
    match.finishRound(true, "test win");
    if (round < 3) {
      advance(match, 4.1);
      assert.equal(match.phase, "buy");
      assert.equal(match.player.hp, 100); assert.equal(match.player.smoke, 2); assert.equal(match.ammo, 30);
      advance(match, 5.1);
    }
  }
  assert.equal(match.phase, "finished");
  assert.deepEqual(match.score, [3, 0]);
  assert.equal(match.round, 3);
  advance(match, 20);
  assert.equal(match.round, 3);
});
