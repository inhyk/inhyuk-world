/**
 * The snowball match.
 *
 * Phases, the clock, my score and my streak — and nothing else. No renderer, no
 * DOM, no network: a guest adopts the host's phase through `adopt`, and other
 * people's scores arrive as numbers through `post`. Everything here runs on the
 * simulation step, so a match paused behind the welcome card is a match that is
 * not running down.
 */

export const COUNTDOWN_SECONDS = 3;
export const MATCH_SECONDS = 120;
export const RESULT_SECONDS = 9;

/** Every third hit in a row is worth double. */
export const COMBO_STEP = 3;

/** @type {readonly string[]} */
export const PHASES = ["off", "countdown", "running", "result"];

export class SnowballFight {
    /** @param {{ onEvent?: (kind: string, detail?: any) => void }} [options] */
    constructor({ onEvent = () => {} } = {}) {
        this.onEvent = onEvent;
        this.phase = "off";
        /** Seconds left in the current phase. */
        this.timer = 0;

        this.score = 0;
        /** Hits in a row. A ball that lands on nothing resets it. */
        this.combo = 0;
        /** The best streak of this match, for the result card. */
        this.bestCombo = 0;
        this.hits = 0;
        this.throws = 0;

        /** id -> { name, colorIndex, score }, everyone else in the room. */
        this.board = new Map();
        /** Best solo score ever, handed in from storage. */
        this.best = 0;
    }

    get running() { return this.phase === "running"; }
    /** True whenever the match owns the world — targets up, HUD showing. */
    get active() { return this.phase !== "off"; }
    /** Whole seconds left, for a clock nobody wants to see flicker. */
    get secondsLeft() { return Math.max(0, Math.ceil(this.timer - 1e-8)); }

    /** Begin the count-in. Safe to call on a match already under way. */
    start() {
        if (this.active) return false;
        this.phase = "countdown";
        this.timer = COUNTDOWN_SECONDS;
        this.score = 0;
        this.combo = 0;
        this.bestCombo = 0;
        this.hits = 0;
        this.throws = 0;
        for (const entry of this.board.values()) entry.score = 0;
        this.onEvent("countdown");
        return true;
    }

    /** End it now, with no result card. Leaving a room, or giving up. */
    stop() {
        if (!this.active) return;
        this.phase = "off";
        this.timer = 0;
        this.onEvent("off");
    }

    /**
     * One ball of mine has finished its flight.
     * @param {boolean} landed true when it hit something worth points
     * @param {number} [worth] points before the streak bonus
     */
    resolve(landed, worth = 1) {
        if (!this.running) return 0;
        this.throws++;
        if (!landed) {
            this.combo = 0;
            return 0;
        }
        this.hits++;
        this.combo++;
        if (this.combo > this.bestCombo) this.bestCombo = this.combo;
        const bonus = this.combo % COMBO_STEP === 0;
        const points = worth * (bonus ? 2 : 1);
        this.score += points;
        this.onEvent("hit", { points, combo: this.combo, bonus });
        return points;
    }

    /** Someone else's score, straight off the wire. */
    post(id, name, colorIndex, score) {
        const entry = this.board.get(id);
        if (entry) {
            entry.name = name;
            entry.colorIndex = colorIndex;
            entry.score = score;
        } else {
            this.board.set(id, { name, colorIndex, score });
        }
    }

    /** Drop everyone who is no longer in the room. @param {Set<string>} ids */
    keepOnly(ids) {
        for (const id of [...this.board.keys()]) if (!ids.has(id)) this.board.delete(id);
    }

    /**
     * Follow the host's match. The phase is theirs; the score is not — every
     * player counts their own hits, so a lost packet costs a scoreboard update
     * and never a point.
     *
     * @param {string} phase @param {number} timer
     */
    adopt(phase, timer) {
        if (!PHASES.includes(phase)) return;
        if (phase !== this.phase) {
            if (phase === "countdown") this.start();
            else if (phase === "off") this.stop();
            else {
                this.phase = phase;
                this.onEvent(phase === "running" ? "go" : "finish");
            }
        }
        // Snap a big gap, ease a small one, so the clock never stutters.
        if (Number.isFinite(timer)) {
            this.timer = Math.abs(timer - this.timer) > 1.5
                ? timer
                : this.timer + (timer - this.timer) * 0.3;
        }
    }

    /** @param {number} dt simulation seconds — zero while paused */
    update(dt) {
        if (!(dt > 0) || this.phase === "off") return;
        let left = dt;
        // The remainder carries into the next phase. One step never spans more
        // than a phase or two in practice, but a step that overshoots the
        // whistle must not hand the whole of it back to the result card.
        for (let guard = 0; guard < 4 && left > 0 && this.phase !== "off"; guard++) {
            if (this.timer > left) {
                this.timer -= left;
                return;
            }
            left -= this.timer;
            this.timer = 0;
            this._advance();
        }
    }

    _advance() {
        if (this.phase === "countdown") {
            this.phase = "running";
            this.timer = MATCH_SECONDS;
            this.onEvent("go");
        } else if (this.phase === "running") {
            this.phase = "result";
            this.timer = RESULT_SECONDS;
            if (this.score > this.best) this.best = this.score;
            this.onEvent("finish");
        } else {
            this.phase = "off";
            this.timer = 0;
            this.onEvent("off");
        }
    }

    /** Everyone, me included, sorted for the scoreboard. */
    standings(myName, myColour) {
        const rows = [{ id: "", name: myName, colorIndex: myColour, score: this.score, mine: true }];
        for (const [id, e] of this.board) {
            rows.push({ id, name: e.name, colorIndex: e.colorIndex, score: e.score, mine: false });
        }
        rows.sort((a, b) => b.score - a.score);
        return rows;
    }
}
