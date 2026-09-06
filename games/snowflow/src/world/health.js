/**
 * Player vitality — renderer-independent, DOM-independent, deterministic.
 *
 * The demo already had a *monster* health model; the player had none, so a
 * shadow that reached you could only shove you. This adds the other half of
 * that exchange, and it lives here rather than on the controller for the same
 * reason `NightEncounters` lives apart from `MonsterSystem`: it is the part
 * that has to be testable without a GPU.
 *
 * Nothing in here reads the clock or the input state. `update()` is given the
 * step and whether it is night; every timer is bounded by that step.
 */

export const MAX_HP = 100;

/** Contact with a shadow. Four hits from full, with the grace window between. */
export const CONTACT_DAMAGE = 14;
/** A spell landing on another player. Only ever applied in 대전 (duel) rooms. */
export const SPELL_DAMAGE = 18;
/** A snowball. A nuisance next to a spell, and free of any cooldown but the throw. */
export const SNOWBALL_DAMAGE = 8;

/** Seconds after taking a hit before the snow starts closing the wound. */
const REGEN_DELAY = 2.2;
const REGEN_DAY = 6.5;
const REGEN_NIGHT = 2.5;

/** How long you lie in the snow, and how long you are untouchable after. */
const DOWNED_SECONDS = 4;
const REVIVE_GRACE = 3;
/** No second hit can land inside this window. Slightly under the shadows' own. */
const HIT_GRACE = 0.9;

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

export class PlayerHealth {
    /** @param {{ onEvent?: (kind: string, detail?: any) => void }} [options] */
    constructor({ onEvent = () => {} } = {}) {
        this.onEvent = onEvent;
        this.max = MAX_HP;
        this.hp = MAX_HP;

        /** True while lying in the snow. Movement is not blocked; damage is. */
        this.downed = false;
        this.downTimer = 0;
        /** Counts down after a revive — and after the very first spawn. */
        this.grace = REVIVE_GRACE;
        /** Seconds since the last hit landed, for the regeneration delay. */
        this.sinceDamage = REGEN_DELAY;
        /** 0..1, decays. The screen tint and the camera shake read this. */
        this.flash = 0;
        this.downs = 0;
    }

    get fraction() { return clamp01(this.hp / this.max); }
    get alive() { return !this.downed; }
    /** True when nothing can reduce `hp` — lying down, or freshly revived. */
    get invulnerable() { return this.downed || this.grace > 0; }
    /** Seconds left of the lie-down, rounded up for the HUD. */
    get reviveIn() { return Math.max(0, Math.ceil(this.downTimer - 1e-8)); }

    /**
     * @param {number} amount
     * @param {string} [source] "contact" | "spell" | anything the HUD names
     * @returns {number} damage actually taken — 0 when it was refused
     */
    damage(amount, source = "contact") {
        const value = Number(amount);
        if (!(value > 0) || this.invulnerable) return 0;
        const taken = Math.min(this.hp, value);
        this.hp -= taken;
        this.sinceDamage = 0;
        this.grace = HIT_GRACE;
        this.flash = 1;
        if (this.hp <= 0) {
            this.hp = 0;
            this.downed = true;
            this.downTimer = DOWNED_SECONDS;
            this.grace = 0; // the lie-down is its own shield
            this.downs++;
            this.onEvent("down", { source });
        } else {
            this.onEvent("hurt", { source, taken });
        }
        return taken;
    }

    /** @param {number} amount */
    heal(amount) {
        const value = Number(amount);
        if (!(value > 0) || this.downed) return 0;
        const given = Math.min(this.max - this.hp, value);
        this.hp += given;
        return given;
    }

    /** Full heal, on your feet, untouchable for a moment. */
    revive() {
        this.hp = this.max;
        this.downed = false;
        this.downTimer = 0;
        this.grace = REVIVE_GRACE;
        this.sinceDamage = REGEN_DELAY;
        this.flash = 0;
        this.onEvent("revive");
    }

    /** Back to the very first frame. Used when a room is left or joined. */
    reset() {
        this.hp = this.max;
        this.downed = false;
        this.downTimer = 0;
        this.grace = REVIVE_GRACE;
        this.sinceDamage = REGEN_DELAY;
        this.flash = 0;
        this.downs = 0;
    }

    /**
     * @param {number} dt seconds; zero while paused, so no timer leaks
     * @param {boolean} isNight
     */
    update(dt, isNight) {
        if (!(dt > 0)) return;
        this.flash = Math.max(0, this.flash - dt * 2.4);
        if (this.downed) {
            this.downTimer -= dt;
            if (this.downTimer <= 0) this.revive();
            return;
        }
        this.grace = Math.max(0, this.grace - dt);
        this.sinceDamage += dt;
        if (this.sinceDamage >= REGEN_DELAY && this.hp < this.max) {
            this.hp = Math.min(this.max, this.hp + (isNight ? REGEN_NIGHT : REGEN_DAY) * dt);
        }
    }
}
