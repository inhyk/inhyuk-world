/**
 * The snowball match: clock, scoreboard, count-in, result card, throw meter.
 *
 * Reads the match and the thrower; writes nothing back except the stored best
 * score, which is the one piece of state that has to outlive the tab.
 *
 * Everything is compared against the last frame before it touches the DOM. This
 * runs inside the render loop, and a scoreboard rebuilt sixty times a second is
 * sixty layouts a second for numbers that change twice a minute.
 */

import { input } from "../core/input.js";
import { PLAYER_COLORS } from "../net/room.js";

const BEST_KEY = "snowflow.snowball.best";

const css = (colour) => `rgb(${colour.map((c) => Math.round(Math.min(1, c) * 255)).join(",")})`;
const clock = (seconds) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export function initMatchHud(match) {
    const hud = document.getElementById("match-hud");
    const clockEl = document.getElementById("match-clock");
    const board = document.getElementById("match-board");
    const comboEl = document.getElementById("match-combo");
    const countdown = document.getElementById("match-countdown");
    const countValue = countdown.querySelector("b");
    const result = document.getElementById("match-result");
    const winner = document.getElementById("match-winner");
    const finalBoard = document.getElementById("match-final");
    const bestLine = document.getElementById("match-best");
    const meter = document.getElementById("throw-meter");
    const meterFill = document.getElementById("throw-fill");

    try {
        match.best = Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch { /* private browsing; the record just starts at zero */ }

    let lastClock = -1;
    let lastCount = -1;
    let lastKey = "";
    let lastPhase = "";
    let lastCombo = -1;
    let lastFill = -1;
    let lastArmed = null;

    function rows(into, standings) {
        into.replaceChildren();
        for (const row of standings) {
            const li = document.createElement("li");
            li.classList.toggle("is-mine", row.mine);
            const dot = document.createElement("i");
            dot.style.color = css(PLAYER_COLORS[row.colorIndex % PLAYER_COLORS.length]);
            const name = document.createElement("span");
            name.textContent = row.mine ? `${row.name} (나)` : row.name;
            const score = document.createElement("b");
            score.textContent = String(row.score);
            li.append(dot, name, score);
            into.append(li);
        }
    }

    function finish(standings) {
        const top = standings[0];
        const solo = standings.length === 1;
        if (solo) {
            winner.textContent = `${match.score}점!`;
        } else {
            const tied = standings.filter((r) => r.score === top.score).length > 1;
            winner.textContent = tied
                ? "비겼어요!"
                : `${top.mine ? "내가" : top.name} 이겼어요!`;
        }
        rows(finalBoard, standings);
        const record = match.score >= match.best && match.score > 0;
        bestLine.textContent = solo
            ? `${record ? "새 최고 기록! · " : ""}최고 ${match.best}점 · 명중 ${match.hits}/${match.throws} · 최고 연속 ${match.bestCombo}`
            : `명중 ${match.hits}/${match.throws} · 최고 연속 ${match.bestCombo}`;
        if (record) {
            try { localStorage.setItem(BEST_KEY, String(match.best)); } catch { /* fine */ }
        }
    }

    /**
     * @param {Array} standings from `SnowballFight.standings`
     * @param {{state: string, readiness: number, charge: number}} thrower
     */
    function update(standings, thrower) {
        // ------------------------------------------------------------ meter
        const showMeter = input.active && thrower.state !== "empty";
        if (meter.hidden === showMeter) meter.hidden = !showMeter;
        if (showMeter) {
            const armed = thrower.state === "armed";
            const fill = armed ? Math.max(0.12, thrower.charge) : thrower.readiness;
            if (Math.abs(fill - lastFill) > 0.01) {
                meterFill.style.width = `${(fill * 100).toFixed(0)}%`;
                lastFill = fill;
            }
            if (armed !== lastArmed) {
                meter.classList.toggle("is-armed", armed);
                lastArmed = armed;
            }
        }

        // ------------------------------------------------------------ phase
        const phase = match.phase;
        if (phase !== lastPhase) {
            lastPhase = phase;
            lastKey = "";
            lastClock = -1;
            if (phase === "result") finish(standings);
        }
        const playing = input.active;
        hud.hidden = !playing || (phase !== "running" && phase !== "countdown");
        countdown.hidden = !playing || phase !== "countdown";
        result.hidden = !playing || phase !== "result";

        if (phase === "countdown") {
            const n = Math.max(1, match.secondsLeft);
            if (n !== lastCount) {
                countValue.textContent = String(n);
                // Restart the pop for each number.
                countValue.style.animation = "none";
                void countValue.offsetWidth;
                countValue.style.animation = "";
                lastCount = n;
            }
        }
        if (hud.hidden) return;

        // ------------------------------------------------------- clock, board
        const left = match.secondsLeft;
        if (left !== lastClock) {
            clockEl.textContent = clock(left);
            hud.classList.toggle("is-urgent", left <= 15);
            lastClock = left;
        }
        const key = standings.map((r) => `${r.name}:${r.score}`).join("|");
        if (key !== lastKey) {
            rows(board, standings);
            lastKey = key;
        }
        const combo = match.combo;
        if (combo !== lastCombo) {
            comboEl.hidden = combo < 2;
            if (combo >= 2) comboEl.textContent = `${combo}연속!${combo % 3 === 2 ? " 다음은 2점" : ""}`;
            lastCombo = combo;
        }
    }

    return { update };
}
