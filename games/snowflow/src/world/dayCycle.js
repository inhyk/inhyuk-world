/** One full 24-hour day is exactly ten minutes of active, real-world play. */
export const DAY_SECONDS = 600;
const START_SECONDS = DAY_SECONDS / 4; // Start at sunrise, 06:00.
const smooth = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

export class DayCycle {
    constructor() {
        this.elapsedSeconds = 0;
        this.running = false;
        this._previous = null;
    }

    /** Sample on frames AND input changes so paused time never leaks into play. */
    tick(nowMs, running) {
        if (this._previous !== null && this.running) {
            this.advance(Math.max(0, nowMs - this._previous) / 1000);
        }
        this._previous = nowMs;
        this.running = running;
    }

    advance(seconds) {
        if (Number.isFinite(seconds) && seconds > 0) this.elapsedSeconds += seconds;
    }

    /**
     * Follow a host's clock in a room. The local tick keeps running between
     * updates — this only corrects the drift, and eases small corrections so
     * nobody watches the sun jump every time a packet lands. A gap big enough
     * to be a fresh join is taken whole.
     *
     * @param {number} seconds the host's `elapsedSeconds`
     */
    adopt(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) return;
        const gap = seconds - this.elapsedSeconds;
        if (Math.abs(gap) > 3) this.elapsedSeconds = seconds;
        else this.elapsedSeconds += gap * 0.3;
    }

    get hour() { return ((this.elapsedSeconds + START_SECONDS) % DAY_SECONDS) / DAY_SECONDS * 24; }
    get day() { return Math.floor((this.elapsedSeconds + START_SECONDS) / DAY_SECONDS) + 1; }
    get isNight() { return this.hour >= 18 || this.hour < 6; }
    get nightAmount() {
        const h = this.hour;
        return h < 12 ? 1 - smooth((h - 5) / 2) : smooth((h - 17) / 2);
    }
    get label() {
        const h = this.hour;
        return h >= 5 && h < 7 ? "새벽" : h >= 7 && h < 17 ? "낮" : h >= 17 && h < 18 ? "해질녘" : "밤";
    }
    get clock() {
        const minutes = Math.floor(this.hour * 60 + 1e-8);
        return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    }
    get secondsUntilTransition() {
        const h = this.hour;
        return ((h < 6 ? 6 : h < 18 ? 18 : 30) - h) / 24 * DAY_SECONDS;
    }
}
