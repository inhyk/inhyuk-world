/**
 * Health readout: the bar, the sting on the edges of the screen when something
 * lands, and the lie-down card.
 *
 * Reads `PlayerHealth`; writes nothing back. Everything is compared against
 * the last frame's value before it touches the DOM, because this runs inside
 * the render loop and a layout per frame is a layout per frame.
 */

import { input } from "../core/input.js";

/** Below this the bar turns and the edges stay faintly lit. */
const LOW = 0.34;

export function initVitalsHud(health) {
    const root = document.getElementById("vitals");
    const fill = document.getElementById("vitals-fill");
    const value = document.getElementById("vitals-value");
    const veil = document.getElementById("hurt-veil");
    const downed = document.getElementById("downed");
    const countdown = document.getElementById("downed-count");

    let lastShown = -1;
    let lastFraction = -1;
    let lastVeil = -1;
    let lastCountdown = -1;
    let lastDowned = null;

    function update() {
        root.hidden = !input.active;

        const shown = Math.ceil(health.hp - 1e-8);
        if (shown !== lastShown) {
            value.textContent = String(shown);
            lastShown = shown;
        }
        const fraction = health.fraction;
        if (Math.abs(fraction - lastFraction) > 0.002) {
            fill.style.transform = `scaleX(${fraction.toFixed(3)})`;
            root.classList.toggle("is-low", fraction <= LOW);
            lastFraction = fraction;
        }
        root.classList.toggle("is-hurt", health.flash > 0.55);

        // Two sources, one veil: the flash of a hit, and a steady low-health
        // reminder that never pulses — a pulsing screen at 20 HP is the thing
        // that makes people stop playing.
        const low = fraction < LOW ? (LOW - fraction) / LOW * 0.28 : 0;
        const opacity = Math.min(0.82, Math.max(health.flash * 0.6, low));
        if (Math.abs(opacity - lastVeil) > 0.01) {
            veil.style.opacity = opacity.toFixed(2);
            lastVeil = opacity;
        }

        if (health.downed !== lastDowned) {
            downed.hidden = !health.downed;
            lastDowned = health.downed;
        }
        if (health.downed) {
            const seconds = health.reviveIn;
            if (seconds !== lastCountdown) {
                countdown.textContent = String(seconds);
                lastCountdown = seconds;
            }
        }
    }

    return { update };
}
