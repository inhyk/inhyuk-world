import { input, pauseInput, startInput } from "../core/input.js";
import "./experience.css";

export function initExperience(canvas, overlay) {
    const welcome = document.getElementById("welcome");
    const spellBar = document.getElementById("spell-bar");
    const start = document.getElementById("start-button");
    const help = document.getElementById("help-button");
    const spellKeys = spellBar.querySelectorAll("[data-spell]");
    let started = false;

    function sync() {
        const playing = input.active;
        welcome.hidden = playing || overlay.visible;
        spellBar.hidden = !playing;
        document.body.classList.toggle("playing", playing);
        if (playing) started = true;
        if (!playing && started) start.innerHTML = '설원으로 돌아가기 <span aria-hidden="true">↗</span>';
        if (!playing) {
            for (const key of spellKeys) key.classList.remove("casting");
        }
    }

    function toggleSettings() {
        overlay.toggle();
        pauseInput();
        sync();
    }

    start.addEventListener("click", () => void startInput(canvas));
    help.addEventListener("click", () => {
        if (overlay.visible) overlay.toggle();
        pauseInput();
        sync();
    });
    document.getElementById("settings-button").addEventListener("click", toggleSettings);
    document.addEventListener("snowflow:input", sync);
    window.addEventListener("keydown", (event) => {
        if (!input.active || event.repeat) return;
        const number = Number(event.code.replace("Digit", ""));
        if (number < 1 || number > spellKeys.length || !Number.isInteger(number)) return;
        const key = spellKeys[number - 1];
        key.classList.add("casting");
        if (number !== 2) setTimeout(() => key.classList.remove("casting"), 650);
    });
    window.addEventListener("keyup", (event) => {
        if (event.code === "Digit2") spellKeys[1].classList.remove("casting");
    });
    return { toggleSettings };
}
