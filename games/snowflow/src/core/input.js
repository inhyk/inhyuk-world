/**
 * Raw input state. Everything lands in one mutable struct that systems poll —
 * no events fired into game code, no per-frame allocation.
 *
 * Mouse look uses pointer lock, which frees the right button for snow-surf.
 */

export const input = {
    // Movement axes, camera-relative, already normalised to a unit disc.
    moveX: 0,
    moveZ: 0,
    moving: false,

    // Accumulated mouse delta since last `endFrame()`, in radians.
    lookX: 0,
    lookY: 0,

    // Zoom, consumed by the camera rig.
    zoomDelta: 0,

    surf: false, // RMB held
    sprint: false, // shift

    /** Q: scoop a snowball, then hold to wind up and release to throw. */
    throwHeld: false,
    /** Set on the keydown edge, cleared each frame. Starts the scoop. */
    throwPressed: false,

    /** @type {number} 0 = none, else 1..9 — set on keydown, cleared each frame */
    spellPressed: 0,
    /** @type {boolean} spell 2 (Ribbon) is a held cast */
    spellHeld2: false,

    locked: false,
    active: false,
};

const keys = Object.create(null);
let rightHeld = false;
let dragging = false;

function clearHeldInput() {
    for (const key in keys) keys[key] = false;
    rightHeld = false;
    dragging = false;
    input.surf = false;
    input.sprint = false;
    input.spellHeld2 = false;
    input.throwHeld = false;
    input.throwPressed = false;
    input.moveX = input.moveZ = 0;
    input.moving = false;
    endFrame();
}

function notifyInput() {
    document.dispatchEvent(new Event("snowflow:input"));
}

export function pauseInput() {
    clearHeldInput();
    input.active = false;
    if (document.pointerLockElement) document.exitPointerLock();
    notifyInput();
}

export async function startInput(canvas) {
    clearHeldInput();
    canvas.focus({ preventScroll: true });
    input.active = true;
    try {
        if (!canvas.requestPointerLock) throw new Error("Pointer lock unavailable");
        await canvas.requestPointerLock();
    } catch {
        // Drag-to-look keeps keyboard play available when capture is blocked.
        document.getElementById("input-note").textContent =
            "마우스 고정이 지원되지 않아 드래그 시점 모드를 사용해요. 왼쪽 버튼을 누른 채 시점을 움직이세요.";
    }
    notifyInput();
}

const LOOK_SCALE = 0.0022;

/** @type {(() => void)|null} */
let onToggleOverlay = null;

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ onToggleOverlay?: () => void }} [hooks]
 */
export function initInput(canvas, hooks) {
    onToggleOverlay = hooks?.onToggleOverlay ?? null;

    canvas.addEventListener("click", () => {
        if (input.active && !input.locked) void startInput(canvas);
    });

    document.addEventListener("pointerlockchange", () => {
        input.locked = document.pointerLockElement === canvas;
        input.active = input.locked;
        if (!input.locked) {
            clearHeldInput();
        }
        notifyInput();
    });

    document.addEventListener("mousemove", (e) => {
        if (!input.active || (!input.locked && !dragging)) return;
        input.lookX += e.movementX * LOOK_SCALE;
        input.lookY += e.movementY * LOOK_SCALE;
    });

    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    document.addEventListener("mousedown", (e) => {
        if (!input.active || (!input.locked && e.target !== canvas)) return;
        if (e.button === 2) rightHeld = true;
        if (e.button === 0) dragging = true;
    });

    document.addEventListener("mouseup", (e) => {
        if (e.button === 2) rightHeld = false;
        if (e.button === 0) dragging = false;
    });

    document.addEventListener(
        "wheel",
        (e) => {
            if (!input.active) return;
            e.preventDefault();
            input.zoomDelta += e.deltaY * 0.0016;
        },
        { passive: false }
    );

    window.addEventListener("keydown", (e) => {
        // Overlay toggle works whether or not the pointer is locked.
        if (e.code === "F1" || e.code === "Backquote") {
            e.preventDefault();
            if (!e.repeat) onToggleOverlay?.();
            return;
        }
        if (e.code === "Escape" || e.code === "KeyH") {
            if (input.active) pauseInput();
            return;
        }
        if (!input.active || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
        if (e.repeat) return;
        keys[e.code] = true;

        if (e.code === "KeyQ") {
            input.throwPressed = true;
            input.throwHeld = true;
        }

        const n = SPELL_KEYS[e.code];
        if (n) {
            input.spellPressed = n;
            if (n === 2) input.spellHeld2 = true;
        }
    });

    window.addEventListener("keyup", (e) => {
        keys[e.code] = false;
        if (SPELL_KEYS[e.code] === 2) input.spellHeld2 = false;
        if (e.code === "KeyQ") input.throwHeld = false;
    });

    window.addEventListener("blur", pauseInput);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) pauseInput();
    });
}

const SPELL_KEYS = {
    Digit1: 1,
    Digit2: 2,
    Digit3: 3,
    Digit4: 4,
    Digit5: 5,
    Digit6: 6,
    Digit7: 7,
    Digit8: 8,
    Digit9: 9,
};

/** Resolve held keys into movement axes. Called once per frame before update. */
export function pollInput() {
    if (!input.active) {
        clearHeldInput();
        return;
    }
    let x = 0;
    let z = 0;
    if (keys.KeyW || keys.ArrowUp) z += 1;
    if (keys.KeyS || keys.ArrowDown) z -= 1;
    if (keys.KeyD || keys.ArrowRight) x += 1;
    if (keys.KeyA || keys.ArrowLeft) x -= 1;

    // Clamp to a unit disc so diagonals aren't faster.
    const len = Math.sqrt(x * x + z * z);
    if (len > 1) {
        x /= len;
        z /= len;
    }
    input.moveX = x;
    input.moveZ = z;
    input.moving = len > 0.001;
    input.sprint = !!(keys.ShiftLeft || keys.ShiftRight);
    input.surf = rightHeld || !!keys.Space;
}

/** Clear per-frame accumulators. Called at the very end of the frame. */
export function endFrame() {
    input.lookX = 0;
    input.lookY = 0;
    input.zoomDelta = 0;
    input.spellPressed = 0;
    input.throwPressed = false;
}

export function isDown(code) {
    return !!keys[code];
}
