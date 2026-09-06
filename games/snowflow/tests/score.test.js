import test from "node:test";
import assert from "node:assert/strict";
import {
    MOODS, moodAt, chordFor, nextMelodyNote, melodyPlacements, degreeToMidi, mtof,
} from "../src/audio/score.js";

const PARENT_CLASSES = new Set([62, 64, 66, 67, 69, 71, 73].map((m) => m % 12)); // D major

test("the day moves dawn → day → dusk → night, crossing over just before each change", () => {
    assert.equal(moodAt(5.5).from.name, "dawn");
    assert.equal(moodAt(12).from.name, "day");
    assert.equal(moodAt(17.5).from.name, "dusk");
    assert.equal(moodAt(2).from.name, "night");
    assert.equal(moodAt(2).to.name, "dawn");

    const before = moodAt(16.0);
    assert.equal(before.t, 0, "well clear of the change: no blend");
    const edge = moodAt(16.9);
    assert.equal(edge.from.name, "day");
    assert.equal(edge.to.name, "dusk");
    assert.ok(edge.t > 0.5 && edge.t < 1, `blending, got ${edge.t}`);
    assert.equal(moodAt(24).from.name, moodAt(0).from.name, "midnight wraps");
});

test("every chord of every mood is drawn from one pitch collection", () => {
    for (const mood of Object.values(MOODS)) {
        let previous = null;
        for (let bar = 0; bar < 8; bar++) {
            const chord = chordFor(mood, bar, previous);
            assert.equal(chord.length, 4);
            for (const n of chord) assert.ok(PARENT_CLASSES.has(n % 12), `${mood.name} bar ${bar}: ${n}`);
            for (let v = 1; v < 4; v++) assert.ok(chord[v] > chord[v - 1], "voices never cross");
            previous = chord;
        }
    }
});

test("voice leading moves each voice the short way", () => {
    const mood = MOODS.day;
    const a = chordFor(mood, 0, null);
    const b = chordFor(mood, 1, a);
    for (let v = 0; v < 4; v++) {
        assert.ok(Math.abs(b[v] - a[v]) <= 7, `voice ${v} moved ${b[v] - a[v]}`);
    }
});

test("the melody stays in the scale, in its register, and prefers steps", () => {
    const mood = MOODS.dawn;
    const chord = chordFor(mood, 0, null);
    let seed = 7;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    let previous = nextMelodyNote(mood, null, chord, true, random);
    let steps = 0, total = 0;
    for (let i = 0; i < 400; i++) {
        const n = nextMelodyNote(mood, previous, chord, i % 4 === 0, random);
        assert.ok(PARENT_CLASSES.has(n % 12), `off-scale note ${n}`);
        assert.ok(n >= 76 && n <= 93, `out of register ${n}`);
        assert.notEqual(n, previous, "never repeats a note back to back");
        if (Math.abs(n - previous) <= 2) steps++;
        total++;
        previous = n;
    }
    assert.ok(steps / total > 0.5, `mostly stepwise: ${steps}/${total}`);
});

test("bells are sparse, ordered, and never crowd each other", () => {
    let seed = 3;
    const random = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 50; i++) {
        const slots = melodyPlacements(MOODS.night, 4, random);
        assert.ok(slots.length <= 3, `night is sparse, got ${slots.length}`);
        for (let k = 1; k < slots.length; k++) assert.ok(slots[k] - slots[k - 1] >= 0.5);
    }
});

test("pitch helpers agree with the piano", () => {
    assert.equal(degreeToMidi(0, 0), 62, "D4");
    assert.equal(degreeToMidi(4, 0), 69, "A4");
    assert.equal(degreeToMidi(7, 0), 74, "D5 by wrapping");
    assert.ok(Math.abs(mtof(69) - 440) < 1e-9);
});

test("each mood is centred where it says it is, and its first chord sits on that centre", () => {
    const names = { 62: "D", 64: "E", 67: "G", 71: "B" };
    const expect = { dawn: "G", day: "D", dusk: "E", night: "B" };
    for (const [key, mood] of Object.entries(MOODS)) {
        const root = degreeToMidi(mood.root, 0);
        assert.equal(names[root], expect[key], `${key} is rooted on ${expect[key]}`);
        const bass = chordFor(mood, 0, null)[0];
        assert.equal(bass % 12, root % 12, `${key}'s opening chord has its root in the bass`);
    }
});
