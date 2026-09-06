/**
 * The score, played.
 *
 * Nothing is loaded. There is no audio file in this repository, for the same
 * reason there is no texture: everything you hear is synthesised when the page
 * runs, from the same kind of numbers everything you see is made from. That is
 * not a constraint that was worked around; it is what lets the music *know
 * about the world* — the pad darkens with the sun, the drone rises with the
 * night, the wind sings when you surf, and the pulse comes in when a match
 * starts, because every one of those is a parameter on a node rather than a
 * crossfade between two recordings.
 *
 * Signal path:
 *
 *   pad   ─┐
 *   drone  ├─► dry ─────────────────────────┐
 *   bass   ┤                                ├─► master ─► limiter ─► out
 *   air    ┤                                │
 *   bells  ┤─► send ─► reverb ──────────────┤
 *   lead   ┤─► echo (dotted eighth, ping-pong, tape-dark) ─► send ─┘
 *   pulse  ┘
 *
 * The echo is the sound. A dotted-eighth delay with feedback and a low-pass in
 * the loop, crossed left-to-right, is the single most recognisable device in
 * the idiom this score is written in — the lead lives in it, and the match
 * pulse becomes a gallop through it, the way one famous eighth-note guitar
 * part does.
 *
 * The reverb is a convolution against an impulse that is generated at start —
 * four seconds of shaped noise — which is what turns five thin oscillators into
 * a place. Scheduling is the standard look-ahead pattern: a coarse timer wakes
 * every 25 ms and books events against the audio clock up to 120 ms ahead, so
 * a busy frame never becomes a late note.
 *
 * Every gain that follows game state is eased with `setTargetAtTime`. No
 * parameter here is ever set instantly while sound is passing through it;
 * that click is the one artefact that instantly reads as "programmer audio".
 */

import { S } from "../core/settings.js";
import {
    moodAt, chordFor, nextMelodyNote, melodyPlacements, leadPhrase, mtof, LEAD_LOW, LEAD_HIGH,
} from "./score.js";

const BEATS_PER_BAR = 4;
const LOOKAHEAD = 0.12;
const TICK_MS = 25;

/** Seconds a mood takes to hand over to the next once the score asks. */
const MOOD_FADE = 7;

export class Music {
    constructor() {
        /** @type {AudioContext|null} */
        this.ctx = null;
        this.ready = false;
        this._timer = null;

        // ----------------------------------------------------- score state
        this._bar = 0;
        this._nextBarTime = 0;
        this._chord = null;
        this._melodyPrev = null;
        this._leadPrev = null;
        this._bassPrev = null;
        this._mood = null;
        this._pending = [];

        // ----------------------------------------------------- world state
        this.hour = 6;
        this.nightAmount = 0;
        this.speed01 = 0;
        this.surf = 0;
        this.threat = 0;
        this.matchRunning = false;
        this.lowHealth = false;
        this.paused = true;
        this._bassLevel = 0.14;
    }

    /**
     * Build the graph. Must run inside a user gesture the first time — the
     * start button is one — and is safe to call again.
     */
    async unlock() {
        if (!this.ctx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return false;
            this.ctx = new Ctx({ latencyHint: "playback", sampleRate: 48000 });
            this._build();
        }
        if (this.ctx.state === "suspended") {
            try { await this.ctx.resume(); } catch { /* the next gesture will */ }
        }
        if (this.ctx.state === "running" && !this._timer) {
            this._nextBarTime = this.ctx.currentTime + 0.3;
            this._timer = setInterval(() => this._schedule(), TICK_MS);
            this.ready = true;
        }
        return this.ready;
    }

    // ------------------------------------------------------------ the graph

    _build() {
        const ctx = this.ctx;
        const now = ctx.currentTime;

        this.master = ctx.createGain();
        this.master.gain.value = 0;
        this.limiter = ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -14;
        this.limiter.knee.value = 18;
        this.limiter.ratio.value = 6;
        this.limiter.attack.value = 0.008;
        this.limiter.release.value = 0.25;
        // A high-pass on the whole mix keeps the sub drone from muddying the
        // pad, and the whole thing out of the range where laptop speakers give up.
        this.highpass = ctx.createBiquadFilter();
        this.highpass.type = "highpass";
        this.highpass.frequency.value = 38;
        this.master.connect(this.highpass).connect(this.limiter).connect(ctx.destination);

        this.dry = ctx.createGain();
        this.dry.gain.value = 0.9;
        this.dry.connect(this.master);

        this.send = ctx.createGain();
        this.send.gain.value = 1;
        this.reverb = ctx.createConvolver();
        this.reverb.buffer = makeImpulse(ctx, 4.6);
        this.reverbReturn = ctx.createGain();
        this.reverbReturn.gain.value = 0.62;
        this.send.connect(this.reverb).connect(this.reverbReturn).connect(this.master);

        // ------------------------------------------------------------ pad
        // Four voices, each a triangle, a sine, and a sine an octave down,
        // through one shared low-pass that the sun owns. No sawtooth and no
        // detune, on purpose: a saw is the buzz timbre, and two of them a few
        // cents apart beat against each other — which is the one sound in
        // this score that was heard as "a whine" rather than as weather. The
        // pad is now closer to glass than to strings. The LFO on the cutoff
        // is what makes a held chord breathe instead of sitting there.
        this.padFilter = ctx.createBiquadFilter();
        this.padFilter.type = "lowpass";
        this.padFilter.frequency.value = 900;
        this.padFilter.Q.value = 0.5;
        this.padGain = ctx.createGain();
        this.padGain.gain.value = 0.0;
        this.padFilter.connect(this.padGain);
        this.padGain.connect(this.dry);
        const padSend = ctx.createGain();
        padSend.gain.value = 0.55;
        this.padGain.connect(padSend).connect(this.send);

        this.padLfo = ctx.createOscillator();
        this.padLfo.type = "sine";
        this.padLfo.frequency.value = 0.045;
        this.padLfoGain = ctx.createGain();
        this.padLfoGain.gain.value = 260;
        this.padLfo.connect(this.padLfoGain).connect(this.padFilter.frequency);
        this.padLfo.start(now);

        this.padVoices = [];
        for (let v = 0; v < 4; v++) {
            const gain = ctx.createGain();
            gain.gain.value = 0;
            gain.connect(this.padFilter);
            const a = ctx.createOscillator(); a.type = "triangle";
            const b = ctx.createOscillator(); b.type = "sine";
            const c = ctx.createOscillator(); c.type = "sine";
            const mixA = ctx.createGain(); mixA.gain.value = 0.34;
            const mixB = ctx.createGain(); mixB.gain.value = 0.22;
            const mixC = ctx.createGain(); mixC.gain.value = 0.36;
            a.connect(mixA).connect(gain);
            b.connect(mixB).connect(gain);
            c.connect(mixC).connect(gain);
            a.start(now); b.start(now); c.start(now);
            this.padVoices.push({ gain, oscs: [a, b, c], midi: 0 });
        }

        // ---------------------------------------------------------- drone
        // The root, low, and a sub an octave under it. Night lifts it, and so
        // does a threat nearby — a rise, not a tremor. An amplitude wobble on
        // a sustained tone is the other classic whine, and it went out with
        // the saws.
        this.droneGain = ctx.createGain();
        this.droneGain.gain.value = 0;
        this.droneGain.connect(this.dry);
        const droneSend = ctx.createGain();
        droneSend.gain.value = 0.3;
        this.droneGain.connect(droneSend).connect(this.send);
        this.droneOsc = ctx.createOscillator(); this.droneOsc.type = "sine";
        this.droneSub = ctx.createOscillator(); this.droneSub.type = "sine";
        const subMix = ctx.createGain(); subMix.gain.value = 0.55;
        this.droneOsc.connect(this.droneGain);
        this.droneSub.connect(subMix).connect(this.droneGain);
        this.droneOsc.start(now); this.droneSub.start(now);

        // ----------------------------------------------------------- echo
        // Two delays cross-fed, so a repeat that starts on the left answers
        // on the right. The low-pass in the loop is what makes it tape: every
        // repeat is a little darker than the one before, and the tail fades
        // into the room instead of stacking up bright.
        this.echoIn = ctx.createGain();
        this.echoIn.gain.value = 1;
        this.echoL = ctx.createDelay(2);
        this.echoR = ctx.createDelay(2);
        this.echoFeedL = ctx.createGain(); this.echoFeedL.gain.value = 0.44;
        this.echoFeedR = ctx.createGain(); this.echoFeedR.gain.value = 0.44;
        const echoToneL = ctx.createBiquadFilter(); echoToneL.type = "lowpass"; echoToneL.frequency.value = 2400;
        const echoToneR = ctx.createBiquadFilter(); echoToneR.type = "lowpass"; echoToneR.frequency.value = 2100;
        this.echoIn.connect(this.echoL);
        this.echoL.connect(echoToneL).connect(this.echoFeedL).connect(this.echoR);
        this.echoR.connect(echoToneR).connect(this.echoFeedR).connect(this.echoL);
        const merger = ctx.createChannelMerger(2);
        echoToneL.connect(merger, 0, 0);
        echoToneR.connect(merger, 0, 1);
        this.echoOut = ctx.createGain();
        this.echoOut.gain.value = 0.7;
        merger.connect(this.echoOut);
        this.echoOut.connect(this.dry);
        const echoSend = ctx.createGain(); echoSend.gain.value = 0.6;
        this.echoOut.connect(echoSend).connect(this.send);

        // ----------------------------------------------------------- bass
        // Root and fifth, low and round, sliding between notes rather than
        // stepping. A sine with a whisper of triangle for the pick.
        this.bassGain = ctx.createGain();
        this.bassGain.gain.value = 0;
        this.bassFilter = ctx.createBiquadFilter();
        this.bassFilter.type = "lowpass";
        this.bassFilter.frequency.value = 520;
        this.bassGain.connect(this.bassFilter).connect(this.dry);
        this.bassOsc = ctx.createOscillator(); this.bassOsc.type = "sine";
        this.bassEdge = ctx.createOscillator(); this.bassEdge.type = "triangle";
        const bassEdgeMix = ctx.createGain(); bassEdgeMix.gain.value = 0.18;
        this.bassOsc.connect(this.bassGain);
        this.bassEdge.connect(bassEdgeMix).connect(this.bassGain);
        this.bassOsc.frequency.value = 55;
        this.bassEdge.frequency.value = 55;
        this.bassOsc.start(now); this.bassEdge.start(now);

        // ----------------------------------------------------------- lead
        this.leadGain = ctx.createGain();
        this.leadGain.gain.value = 0.9;
        this.leadTone = ctx.createBiquadFilter();
        this.leadTone.type = "lowpass";
        this.leadTone.frequency.value = 1900;
        this.leadTone.Q.value = 0.8;
        this.leadGain.connect(this.leadTone);
        const leadDry = ctx.createGain(); leadDry.gain.value = 0.55;
        const leadEcho = ctx.createGain(); leadEcho.gain.value = 0.9;
        const leadWet = ctx.createGain(); leadWet.gain.value = 0.7;
        this.leadTone.connect(leadDry).connect(this.dry);
        this.leadTone.connect(leadEcho).connect(this.echoIn);
        this.leadTone.connect(leadWet).connect(this.send);

        // ---------------------------------------------------------- bells
        this.bellGain = ctx.createGain();
        this.bellGain.gain.value = 0.9;
        const bellDry = ctx.createGain(); bellDry.gain.value = 0.35;
        const bellWet = ctx.createGain(); bellWet.gain.value = 1.0;
        this.bellGain.connect(bellDry).connect(this.dry);
        this.bellGain.connect(bellWet).connect(this.send);

        // ------------------------------------------------------------ air
        // Wind: a band of noise the speed opens up. The centre frequency
        // climbs with speed too, which is the difference between a breeze and
        // a carve.
        this.airFilter = ctx.createBiquadFilter();
        this.airFilter.type = "bandpass";
        this.airFilter.frequency.value = 420;
        this.airFilter.Q.value = 0.9;
        this.airGain = ctx.createGain();
        this.airGain.gain.value = 0;
        const noise = ctx.createBufferSource();
        noise.buffer = makeNoise(ctx, 3);
        noise.loop = true;
        noise.connect(this.airFilter).connect(this.airGain).connect(this.dry);
        noise.start(now);

        // ---------------------------------------------------------- pulse
        this.pulseGain = ctx.createGain();
        this.pulseGain.gain.value = 0;
        this.pulseGain.connect(this.dry);
        const pulseEcho = ctx.createGain(); pulseEcho.gain.value = 0.8;
        this.pulseGain.connect(pulseEcho).connect(this.echoIn);

        this.heartGain = ctx.createGain();
        this.heartGain.gain.value = 0;
        this.heartGain.connect(this.dry);
    }

    // ------------------------------------------------------------ scheduler

    _schedule() {
        const ctx = this.ctx;
        if (!ctx || ctx.state !== "running") return;
        const horizon = ctx.currentTime + LOOKAHEAD;
        while (this._nextBarTime < horizon) {
            this._playBar(this._nextBarTime);
            const tempo = this._tempo();
            this._nextBarTime += (60 / tempo) * BEATS_PER_BAR;
        }
    }

    _tempo() {
        const mood = this._mood || moodAt(this.hour).from;
        return mood.tempo * (this.matchRunning ? 1.14 : 1);
    }

    _playBar(t) {
        const bar = this._bar++;
        const blend = moodAt(this.hour);
        // The mood is committed per bar. Inside a bar the crossfade is on the
        // gains; the *chord* comes from whichever side of the blend we are on,
        // so the harmony never sits between two progressions.
        const mood = blend.t > 0.5 ? blend.to : blend.from;
        if (mood !== this._mood) {
            this._mood = mood;
            // Root of the new mode, for the drone.
            const root = mtof(50 + [0, 2, 4, 5, 7, 9, 11][mood.root] - 12);
            this.droneOsc.frequency.setTargetAtTime(root, t, MOOD_FADE / 4);
            this.droneSub.frequency.setTargetAtTime(root / 2, t, MOOD_FADE / 4);
        }

        const chord = chordFor(mood, bar, this._chord);
        this._chord = chord;
        const beat = 60 / this._tempo();

        // Dotted eighth, retuned to the tempo every bar so the repeats always
        // land between the beats.
        const dotted = beat * 0.75;
        this.echoL.delayTime.setTargetAtTime(dotted, t, 0.5);
        this.echoR.delayTime.setTargetAtTime(dotted, t, 0.5);

        // Bass: root on one, fifth on three, sliding. The fifth is the note a
        // fourth below the root as often as above — a bass player's choice,
        // not a theory book's.
        const rootMidi = chord[0] - 12 + (chord[0] - 12 < 36 ? 12 : 0);
        const fifthMidi = rootMidi + (Math.random() < 0.5 ? 7 : -5);
        this._bassNote(t, rootMidi, beat * 0.9);
        this._bassNote(t + beat * 2, fifthMidi, beat * 0.9);

        // Pad: glide each voice to its new note over a beat and a half. A pad
        // that steps is an organ; one that slides is weather.
        for (let v = 0; v < 4; v++) {
            const voice = this.padVoices[v];
            const f = mtof(chord[v]);
            for (let k = 0; k < voice.oscs.length; k++) {
                const target = k === 2 ? f / 2 : f;
                voice.oscs[k].frequency.setTargetAtTime(target, t, beat * 0.45);
            }
            voice.gain.gain.setTargetAtTime(0.19, t, 0.6);
        }

        // The lead. One to three long notes, or nothing.
        for (const note of leadPhrase(mood, BEATS_PER_BAR)) {
            const when = t + note.at * beat;
            const midi = nextMelodyNote(
                mood, this._leadPrev, chord, note.at < 0.25, Math.random, LEAD_LOW, LEAD_HIGH
            );
            this._leadPrev = midi;
            this._lead(when, mtof(midi), note.hold * beat, 0.6 + Math.random() * 0.3);
        }

        // Bells, now the rare sparkle over the top rather than the tune.
        // Only by daylight, and only one in three bars.
        if (mood.brightness > 0.5 && Math.random() < 0.34) {
            const slots = melodyPlacements(mood, BEATS_PER_BAR).slice(0, 1);
            for (const slot of slots) {
                const when = t + slot * beat;
                const midi = nextMelodyNote(mood, this._melodyPrev, chord, slot < 0.25);
                this._melodyPrev = midi;
                this._bell(when, mtof(midi), 0.35 + Math.random() * 0.2);
            }
        }

        // Match pulse: a muted pluck on every beat, the off-beats quieter.
        if (this.matchRunning) {
            const root = mtof(chord[0] + 12);
            for (let b = 0; b < BEATS_PER_BAR; b++) {
                this._pluck(t + b * beat, root, b % 2 === 0 ? 0.5 : 0.28);
                this._pluck(t + (b + 0.5) * beat, root * 1.5, 0.18);
            }
        }
        // Heartbeat: two thumps a bar while low.
        if (this.lowHealth) {
            this._thump(t);
            this._thump(t + beat * 0.32);
            this._thump(t + beat * 2);
            this._thump(t + beat * 2.32);
        }
    }

    /**
     * The lead. A note that swells in rather than strikes, bends up into pitch
     * from a whole tone below, and only starts to shake once it has arrived —
     * the vibrato is delayed, shallow and slow, the way a hand does it and a
     * synthesiser usually does not. Sine with a little triangle an octave up
     * for edge; no distortion, because distortion is harmonics and harmonics
     * are buzz.
     */
    _lead(t, freq, hold, velocity) {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const edge = ctx.createOscillator();
        const edgeMix = ctx.createGain();
        const env = ctx.createGain();
        osc.type = "sine";
        edge.type = "triangle";
        edgeMix.gain.value = 0.16;

        // The bend: start under, arrive over a third of a second.
        const from = freq * Math.pow(2, -2 / 12);
        for (const o of [osc, edge]) {
            const f = o === edge ? 2 : 1;
            o.frequency.setValueAtTime(from * f, t);
            o.frequency.exponentialRampToValueAtTime(freq * f, t + 0.32);
        }
        // Delayed vibrato: nothing for the first 0.55 s, then 10 cents at 5 Hz.
        const vib = ctx.createOscillator();
        const vibDepth = ctx.createGain();
        vib.frequency.value = 4.9;
        vibDepth.gain.setValueAtTime(0, t);
        vibDepth.gain.setValueAtTime(0, t + 0.55);
        vibDepth.gain.linearRampToValueAtTime(10, t + 1.2);
        vib.connect(vibDepth);
        vibDepth.connect(osc.detune);
        vibDepth.connect(edge.detune);

        const peak = 0.42 * velocity;
        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(peak, t + 0.28);
        env.gain.setValueAtTime(peak, t + Math.max(0.3, hold - 0.4));
        env.gain.exponentialRampToValueAtTime(0.0001, t + hold + 0.9);

        osc.connect(env);
        edge.connect(edgeMix).connect(env);
        env.connect(this.leadGain);
        const end = t + hold + 1.0;
        osc.start(t); edge.start(t); vib.start(t);
        osc.stop(end); edge.stop(end); vib.stop(end);
    }

    /** One bass note: glide the running oscillators to it and swell the gain. */
    _bassNote(t, midi, hold) {
        const f = mtof(midi);
        this.bassOsc.frequency.setTargetAtTime(f, t, 0.045);
        this.bassEdge.frequency.setTargetAtTime(f, t, 0.045);
        const g = this.bassGain.gain;
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(this._bassLevel, t + 0.06);
        g.setTargetAtTime(this._bassLevel * 0.55, t + hold * 0.6, 0.25);
    }

    /** FM bell: a sine carrier with a sine modulator at a 3:1 ratio that decays
     *  faster than the tone, so the strike is bright and the ring is pure. */
    _bell(t, freq, velocity) {
        const ctx = this.ctx;
        const carrier = ctx.createOscillator();
        const mod = ctx.createOscillator();
        const modGain = ctx.createGain();
        const env = ctx.createGain();
        carrier.type = "sine";
        mod.type = "sine";
        carrier.frequency.value = freq;
        mod.frequency.value = freq * 3.01;
        modGain.gain.setValueAtTime(freq * 1.6 * velocity, t);
        modGain.gain.exponentialRampToValueAtTime(freq * 0.05, t + 0.9);
        mod.connect(modGain).connect(carrier.frequency);

        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(0.28 * velocity, t + 0.012);
        env.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
        carrier.connect(env).connect(this.bellGain);
        carrier.start(t); mod.start(t);
        carrier.stop(t + 3.4); mod.stop(t + 3.4);
    }

    /** Pulse pluck: a filtered triangle with a very short envelope. Not a
     *  saw — nothing in this score is a saw any more. */
    _pluck(t, freq, velocity) {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const env = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(freq * 6, t);
        filter.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.18);
        filter.Q.value = 2;
        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(0.22 * velocity, t + 0.004);
        env.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        osc.connect(filter).connect(env).connect(this.pulseGain);
        osc.start(t); osc.stop(t + 0.25);
    }

    /** Heartbeat: a pitched-down sine thump. */
    _thump(t) {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(92, t);
        osc.frequency.exponentialRampToValueAtTime(44, t + 0.16);
        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(0.5, t + 0.006);
        env.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
        osc.connect(env).connect(this.heartGain);
        osc.start(t); osc.stop(t + 0.26);
    }

    // --------------------------------------------------------------- update

    /**
     * Once a frame. Everything here is a target on an AudioParam, eased.
     * @param {object} world
     */
    update({ hour, nightAmount, speed01, surf, threat, matchRunning, lowHealth, paused }) {
        this.hour = hour;
        this.nightAmount = nightAmount;
        this.speed01 = speed01;
        this.surf = surf;
        this.threat = threat;
        this.matchRunning = matchRunning;
        this.lowHealth = lowHealth;
        this.paused = paused;
        if (!this.ready) return;

        const ctx = this.ctx;
        const t = ctx.currentTime;
        const on = S.music !== false;
        const volume = on ? (S.musicVolume ?? 0.8) * (paused ? 0.42 : 1) : 0;
        this.master.gain.setTargetAtTime(volume * 0.72, t, 0.4);

        // The sun owns the pad's brightness. Dawn is brightest of all.
        const blend = moodAt(hour);
        const brightness = blend.from.brightness * (1 - blend.t) + blend.to.brightness * blend.t;
        const cutoff = 260 + brightness * 1700 * (1 - nightAmount * 0.55);
        this.padFilter.frequency.setTargetAtTime(cutoff, t, 1.2);
        this.padGain.gain.setTargetAtTime(0.85, t, 1.0);

        // Night lifts the drone; so, a little, does danger.
        this.droneGain.gain.setTargetAtTime(0.04 + nightAmount * 0.15 + threat * 0.06, t, 1.5);

        // Wind follows speed. Surfing opens it right up and raises its pitch.
        const wind = 0.035 + speed01 * 0.16 + surf * 0.05;
        this.airGain.gain.setTargetAtTime(wind, t, 0.25);
        this.airFilter.frequency.setTargetAtTime(380 + speed01 * 1400, t, 0.3);

        this.pulseGain.gain.setTargetAtTime(matchRunning ? 0.8 : 0, t, 0.5);
        this.heartGain.gain.setTargetAtTime(lowHealth ? 0.9 : 0, t, 0.4);
        // The bass steps forward as the light goes.
        // Measured, not guessed: with the bass and the drone both in the low
        // octaves, a full night was sitting at −11 dBFS RMS and leaning on the
        // limiter. Background music wants to live around −16.
        this._bassLevel = 0.10 + (1 - brightness) * 0.10;
    }
}

/**
 * The room. Exponentially decaying noise with a short early hump and a
 * high-frequency roll-off that steepens down the tail, which is what air does
 * to a long reverb and is the difference between "a hall" and "a spring".
 */
function makeImpulse(ctx, seconds) {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const buffer = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
        const data = buffer.getChannelData(ch);
        let low = 0;
        for (let i = 0; i < length; i++) {
            const x = i / length;
            const decay = Math.pow(1 - x, 2.9);
            const early = i < rate * 0.06 ? 1.6 : 1;
            const white = Math.random() * 2 - 1;
            // One-pole low-pass whose coefficient tightens along the tail.
            const k = 0.12 + x * 0.55;
            low += (white - low) * (1 - k);
            data[i] = low * decay * early;
        }
    }
    return buffer;
}

function makeNoise(ctx, seconds) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
}
