/**
 * Loading-screen driver.
 *
 * A phase-weighted progress model: each phase declares how much of the bar it
 * owns, and the bar only ever moves forward. `phase()` also yields to the
 * browser so the DOM actually repaints between heavy synchronous steps.
 */

const bar = /** @type {HTMLElement} */ (document.getElementById("boot-bar"));
const label = /** @type {HTMLElement} */ (document.getElementById("boot-phase"));
const root = /** @type {HTMLElement} */ (document.getElementById("boot"));
const hint = /** @type {HTMLElement} */ (document.getElementById("hint"));

let progress = 0;

const phases = {
    "creating device": "그래픽 장치를 준비하고 있어요",
    "building scene": "설원의 윤곽을 만들고 있어요",
    "integrating atmosphere": "하늘에 햇살을 더하고 있어요",
    "baking heightfield": "눈언덕을 쌓고 있어요",
    "placing character": "설원 여행자를 부르고 있어요",
    "compiling pipelines": "아홉 가지 마법을 준비하고 있어요",
    "warming render targets": "눈과 물의 흐름을 깨우고 있어요",
    ready: "준비됐어요",
};

/** Yield to the compositor so the loading screen repaints. */
export function nextFrame() {
    return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

/**
 * @param {string} text shown under the bar
 * @param {number} to target progress, 0..1
 */
export async function phase(text, to) {
    if (label) label.textContent = phases[text] || text;
    progress = Math.max(progress, to);
    if (bar) bar.style.width = (progress * 100).toFixed(1) + "%";
    await nextFrame();
}

export async function done() {
    await phase("ready", 1);
    // Let the bar visibly land before the fade starts.
    await new Promise((r) => setTimeout(r, 360));
    root?.classList.add("gone");
    document.getElementById("experience").hidden = false;
    document.getElementById("start-button")?.focus({ preventScroll: true });
    setTimeout(() => {
        root?.remove();
        hint?.classList.remove("show");
    }, 6000);
}

export function fail(message) {
    root?.remove();
    const experience = document.getElementById("experience");
    if (experience) experience.hidden = true;
    const el = document.getElementById("nogpu");
    if (el) {
        el.classList.add("show");
        const b = el.querySelector("b");
        if (b && message) b.textContent = message;
    }
}
