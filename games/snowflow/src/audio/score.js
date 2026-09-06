/**
 * The score — what to play, decided without an AudioContext.
 *
 * The whole day lives in one pitch collection: the seven notes of D major.
 * Dawn is those notes heard from G (Lydian, the raised fourth glowing), day
 * from D (Ionian), dusk from E (Dorian, the warm minor), night from B
 * (Aeolian). Because the *notes* never change, any two moods can be crossfaded
 * at any moment and nothing will ever clash — the sun coming up is a change of
 * centre, not a change of key. That is how film scores move between cues
 * without a seam, and it is the single decision that makes an adaptive score
 * sound composed rather than switched.
 *
 * Everything here is a plain function of (hour, bar, randomness). The synth in
 * `music.js` asks this module what to play and when; it never decides.
 */

/** D major, as semitones above D. Degrees: 0 D · 1 E · 2 F# · 3 G · 4 A · 5 B · 6 C#. */
const PARENT = [0, 2, 4, 5, 7, 9, 11];
const D = 62; // MIDI

/**
 * @typedef {object} Mood
 * @property {string} name
 * @property {number} root MIDI pitch class root of the mode, as an offset from D
 * @property {number} tempo beats per minute
 * @property {number[][]} chords progressions as scale degrees (0-based, of the
 *   parent scale), four notes each, voiced low to high
 * @property {number} density melody notes per bar, on average
 * @property {number} brightness 0..1, drives the pad filter
 */

/** @type {Record<string, Mood>} */
export const MOODS = {
    dawn: {
        name: "dawn", root: 3, tempo: 66, density: 2.6, brightness: 0.85,
        // G Lydian: Gmaj7 · A/G · Bm7 · D/F#. The raised fourth (C#) is in the
        // second chord, and it is the whole colour of first light.
        chords: [[3, 5, 0, 2], [3, 6, 1, 4], [5, 0, 2, 4], [2, 4, 6, 0]],
    },
    day: {
        name: "day", root: 0, tempo: 72, density: 1.8, brightness: 0.72,
        // D Ionian: Dmaj9 · Asus · Bm7 · Gmaj7 — open, unhurried.
        chords: [[0, 4, 1, 6], [4, 1, 0, 3], [5, 0, 2, 4], [3, 5, 0, 2]],
    },
    dusk: {
        name: "dusk", root: 1, tempo: 62, density: 1.4, brightness: 0.48,
        // E Dorian: Em9 · Gmaj7 · D · Asus4 — the warm minor.
        chords: [[1, 3, 5, 2], [3, 5, 0, 2], [0, 2, 4, 6], [4, 0, 1, 5]],
    },
    night: {
        name: "night", root: 5, tempo: 54, density: 0.8, brightness: 0.22,
        // B Aeolian: Bm7 · Em7 · Bm7 · F#m7 — sparse, low, going nowhere on purpose.
        chords: [[5, 0, 2, 4], [1, 3, 5, 0], [5, 0, 2, 4], [2, 4, 6, 1]],
    },
};

/** The order the day moves through them, with the hour each begins. */
export const SCHEDULE = [
    { at: 5, mood: "dawn" },
    { at: 7, mood: "day" },
    { at: 17, mood: "dusk" },
    { at: 18, mood: "night" },
];

/** Game hours a mood takes to cross into the next. */
const BLEND_HOURS = 0.6;

/**
 * Which mood the hour is in, and how far it has crossed into the next.
 * @param {number} hour 0..24
 * @returns {{ from: Mood, to: Mood, t: number }} t = 0 fully `from`, 1 fully `to`
 */
export function moodAt(hour) {
    const h = ((hour % 24) + 24) % 24;
    let index = SCHEDULE.length - 1;
    for (let i = 0; i < SCHEDULE.length; i++) {
        if (h >= SCHEDULE[i].at) index = i;
    }
    const current = SCHEDULE[index];
    const next = SCHEDULE[(index + 1) % SCHEDULE.length];
    let untilNext = next.at - h;
    if (untilNext <= 0) untilNext += 24;
    const t = untilNext < BLEND_HOURS ? 1 - untilNext / BLEND_HOURS : 0;
    return { from: MOODS[current.mood], to: MOODS[next.mood], t };
}

/** MIDI note for a parent-scale degree in a given octave. */
export function degreeToMidi(degree, octave = 0) {
    const d = ((degree % 7) + 7) % 7;
    const wrap = Math.floor(degree / 7);
    return D + PARENT[d] + (octave + wrap) * 12;
}

export function mtof(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * The chord for a bar, voiced so that consecutive chords move as little as
 * possible. Each note is placed in the octave nearest the same voice in the
 * previous chord — the cheapest possible voice leading, and enough that a pad
 * never lurches.
 *
 * @param {Mood} mood
 * @param {number} bar
 * @param {number[]|null} previous last voicing, or null
 * @returns {number[]} four MIDI notes
 */
export function chordFor(mood, bar, previous) {
    const degrees = mood.chords[bar % mood.chords.length];
    const out = [];
    for (let v = 0; v < degrees.length; v++) {
        // Low voice sits an octave down; the rest a little above middle.
        const base = degreeToMidi(degrees[v], v === 0 ? -1 : 0);
        if (!previous) { out.push(base); continue; }
        const prev = previous[v];
        let best = base;
        for (const shift of [-12, 0, 12]) {
            if (Math.abs(base + shift - prev) < Math.abs(best - prev)) best = base + shift;
        }
        out.push(best);
    }
    // Voices never cross: the pad stays a pad and not a knot.
    for (let v = 1; v < out.length; v++) {
        while (out[v] <= out[v - 1]) out[v] += 12;
    }
    return out;
}

/** Bell register: two octaves above the pad. */
const MELODY_LOW = 76;
const MELODY_HIGH = 93;

/**
 * The next melody note: a walk on the parent scale that prefers steps,
 * occasionally leaps, and lands on a chord tone at the top of a bar. A melody
 * that never leaps is a scale exercise; one that leaps at random is noise. The
 * weights are the taste.
 *
 * @param {Mood} mood
 * @param {number|null} previous last MIDI note, or null
 * @param {number[]} chord current voicing
 * @param {boolean} downbeat true at the start of a bar
 * @param {() => number} random
 * @returns {number} MIDI
 */
export function nextMelodyNote(mood, previous, chord, downbeat, random = Math.random) {
    const chordClasses = chord.map((n) => n % 12);
    if (previous === null) {
        // Open on the fifth of the mode, in the middle of the register.
        const fifth = degreeToMidi(mood.root + 4, 1);
        return clampToRange(fifth, MELODY_LOW, MELODY_HIGH);
    }
    const candidates = [];
    for (let m = MELODY_LOW; m <= MELODY_HIGH; m++) {
        if (!PARENT.includes(((m - D) % 12 + 12) % 12)) continue;
        const interval = Math.abs(m - previous);
        if (interval === 0) continue;
        let weight = interval <= 2 ? 6 : interval <= 4 ? 3 : interval <= 7 ? 1.2 : 0.35;
        if (chordClasses.includes(m % 12)) weight *= downbeat ? 3.5 : 1.6;
        // A gentle pull back to the middle of the range.
        const centre = (MELODY_LOW + MELODY_HIGH) / 2;
        weight *= 1 - 0.55 * Math.abs(m - centre) / (MELODY_HIGH - centre);
        candidates.push({ m, weight });
    }
    let total = 0;
    for (const c of candidates) total += c.weight;
    let pick = random() * total;
    for (const c of candidates) {
        pick -= c.weight;
        if (pick <= 0) return c.m;
    }
    return candidates[candidates.length - 1].m;
}

function clampToRange(midi, low, high) {
    while (midi < low) midi += 12;
    while (midi > high) midi -= 12;
    return midi;
}

/**
 * How many melody notes to place in this bar, and where. Sparse and off the
 * grid on purpose: a bell exactly on every beat is a clock.
 *
 * @param {Mood} mood
 * @param {number} beatsPerBar
 * @param {() => number} random
 * @returns {number[]} beat offsets within the bar, ascending
 */
export function melodyPlacements(mood, beatsPerBar, random = Math.random) {
    const count = Math.max(0, Math.round(mood.density + (random() - 0.5) * 1.4));
    const slots = [];
    for (let i = 0; i < count; i++) {
        // Half-beat grid, then a few tens of milliseconds of human off it.
        const grid = Math.floor(random() * beatsPerBar * 2) / 2;
        slots.push(grid + (random() - 0.5) * 0.08);
    }
    slots.sort((a, b) => a - b);
    // Never two bells inside a quarter beat: they would smear into one.
    return slots.filter((s, i) => i === 0 || s - slots[i - 1] >= 0.5);
}
