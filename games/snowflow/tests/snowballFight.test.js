import test from "node:test";
import assert from "node:assert/strict";
import {
    SnowballFight, COUNTDOWN_SECONDS, MATCH_SECONDS, RESULT_SECONDS, COMBO_STEP,
} from "../src/world/snowballFight.js";

function setup() {
    const events = [];
    const match = new SnowballFight({ onEvent: (kind) => events.push(kind) });
    return { match, events };
}

test("a match counts in, runs, shows a result and puts itself away", () => {
    const { match, events } = setup();
    assert.equal(match.active, false);
    match.start();
    assert.equal(match.phase, "countdown");
    assert.equal(match.running, false, "no points before the whistle");

    match.update(COUNTDOWN_SECONDS);
    assert.equal(match.phase, "running");
    match.update(MATCH_SECONDS);
    assert.equal(match.phase, "result");
    match.update(RESULT_SECONDS);
    assert.equal(match.phase, "off");
    assert.deepEqual(events, ["countdown", "go", "finish", "off"]);
});

test("every third hit in a row is worth double, and a miss resets the streak", () => {
    const { match } = setup();
    match.start();
    match.update(COUNTDOWN_SECONDS);

    assert.equal(match.resolve(true), 1);
    assert.equal(match.resolve(true), 1);
    assert.equal(match.resolve(true), 2, "the third of a streak");
    assert.equal(match.score, 4);
    assert.equal(match.combo, COMBO_STEP);

    assert.equal(match.resolve(false), 0);
    assert.equal(match.combo, 0);
    assert.equal(match.score, 4, "a miss costs nothing but the streak");

    assert.equal(match.resolve(true), 1, "counting starts again");
    assert.equal(match.bestCombo, 3);
    assert.equal(match.throws, 5);
    assert.equal(match.hits, 4);
});

test("nothing scores outside the running phase", () => {
    const { match } = setup();
    assert.equal(match.resolve(true), 0, "before it starts");
    match.start();
    assert.equal(match.resolve(true), 0, "during the count-in");
    match.update(COUNTDOWN_SECONDS + MATCH_SECONDS);
    assert.equal(match.phase, "result");
    assert.equal(match.resolve(true), 0, "after the whistle");
    assert.equal(match.score, 0);
});

test("a paused frame moves no clock, and a best score survives the match", () => {
    const { match } = setup();
    match.start();
    match.update(COUNTDOWN_SECONDS);
    match.update(0);
    assert.equal(match.timer, MATCH_SECONDS);
    match.resolve(true);
    match.resolve(true);
    match.update(MATCH_SECONDS);
    assert.equal(match.best, 2);

    // A second match starts from zero but keeps the record.
    match.update(RESULT_SECONDS);
    match.start();
    assert.equal(match.score, 0);
    assert.equal(match.best, 2);
});

test("a guest adopts the host's phase without adopting its score", () => {
    const { match, events } = setup();
    match.post("guest-2", "민준", 1, 7);

    match.adopt("countdown", 3);
    assert.equal(match.phase, "countdown");
    match.adopt("running", MATCH_SECONDS);
    assert.equal(match.phase, "running");
    assert.deepEqual(events, ["countdown", "go"]);

    match.resolve(true);
    match.adopt("running", MATCH_SECONDS - 10);
    assert.equal(match.score, 1, "my points are mine to count");

    // A big gap snaps; a small one eases.
    assert.ok(Math.abs(match.timer - (MATCH_SECONDS - 10)) < 1e-6);
    match.adopt("running", MATCH_SECONDS - 10.5);
    assert.ok(match.timer < MATCH_SECONDS - 10 && match.timer > MATCH_SECONDS - 10.5);

    match.adopt("nonsense", 5);
    assert.equal(match.phase, "running", "an unknown phase is ignored");
});

test("the scoreboard holds everyone and sorts by score", () => {
    const { match } = setup();
    match.start();
    match.update(COUNTDOWN_SECONDS);
    match.post("a", "민준", 1, 9);
    match.post("b", "서연", 2, 3);
    match.resolve(true);
    match.resolve(true);
    match.resolve(true); // 4 points

    const rows = match.standings("인혁", 0);
    assert.deepEqual(rows.map((r) => r.name), ["민준", "인혁", "서연"]);
    assert.equal(rows.find((r) => r.mine).score, 4);

    match.keepOnly(new Set(["a"]));
    assert.equal(match.board.size, 1);
});
