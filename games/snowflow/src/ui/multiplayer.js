/**
 * The room panel on the welcome card.
 *
 * All of the DOM for making, joining and leaving a room, and none of the
 * transport: it drives a `Room` and renders whatever comes back through the
 * two methods it returns, which `main.js` wires into that room's hooks.
 *
 * Every message here is written for someone who is ten. No error type, no
 * peer id, no "WebRTC" — just what happened and what to try instead.
 */

import { MAX_PLAYERS, PLAYER_COLORS, normaliseCode, trimName } from "../net/room.js";

const NAME_KEY = "snowflow.name";
const CODE_LENGTH = 5;

const css = (colour) => `rgb(${colour.map((c) => Math.round(Math.min(1, c) * 255)).join(",")})`;

/**
 * @param {import("../net/room.js").Room} room
 * @param {{prepare?: () => Promise<void>}} [hooks] `prepare` is awaited before
 *   either connect, so the bodies exist before anyone can walk into view
 */
export function initMultiplayer(room, hooks = {}) {
    const nameInput = /** @type {HTMLInputElement} */ (document.getElementById("room-name"));
    const codeInput = /** @type {HTMLInputElement} */ (document.getElementById("room-code"));
    const createButton = document.getElementById("room-create");
    const joinButton = document.getElementById("room-join");
    const statusLine = document.getElementById("room-status");
    const panel = document.getElementById("room-open");
    const codeValue = document.getElementById("room-code-value");
    const copyButton = document.getElementById("room-copy");
    const rosterList = document.getElementById("room-roster");
    const leaveButton = document.getElementById("room-leave");
    const duelWrap = document.getElementById("room-duel-wrap");
    const duelToggle = /** @type {HTMLInputElement} */ (document.getElementById("room-duel"));

    let busy = false;

    try {
        nameInput.value = localStorage.getItem(NAME_KEY) || "";
    } catch { /* private browsing; the field just starts empty */ }

    function say(text, kind = "") {
        statusLine.textContent = text;
        statusLine.classList.toggle("is-error", kind === "error");
        statusLine.classList.toggle("is-busy", kind === "busy");
    }

    function setBusy(on) {
        busy = on;
        createButton.disabled = on;
        joinButton.disabled = on;
    }

    function rememberName() {
        const name = trimName(nameInput.value);
        try { localStorage.setItem(NAME_KEY, name); } catch { /* fine */ }
        return name;
    }

    function renderOpen() {
        const open = room.active;
        panel.hidden = !open;
        createButton.hidden = open;
        joinButton.hidden = open;
        codeInput.hidden = open;
        nameInput.hidden = open;
        if (!open) return;
        codeValue.textContent = room.code;
        duelWrap.hidden = !room.isHost;
        duelToggle.checked = room.duel;
    }

    function roster(players = []) {
        renderOpen();
        rosterList.replaceChildren();
        for (const player of players) {
            const item = document.createElement("li");
            const dot = document.createElement("i");
            dot.style.color = css(PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length]);
            const name = document.createElement("span");
            name.textContent = player.id === room.selfId ? `${player.name} (나)` : player.name;
            const tag = document.createElement("small");
            tag.textContent = player.isHost ? "방장" : "함께";
            item.append(dot, name, tag);
            rosterList.append(item);
        }
        if (!room.active) return;
        const others = players.length - 1;
        say(others > 0
            ? `${others}명과 함께 있어요. ${room.duel ? "대전 모드예요 — 마법을 조심!" : "힘을 합쳐 밤을 버텨봐요."}`
            : `친구에게 코드 ${room.code} 를 보내주세요. 최대 ${MAX_PLAYERS}명까지 들어올 수 있어요.`);
    }

    /** @param {string} kind @param {string} [detail] */
    function status(kind, detail) {
        if (kind === "connecting") say("연결하는 중이에요…", "busy");
        if (kind === "open") { setBusy(false); renderOpen(); }
        if (kind === "closed") {
            setBusy(false);
            renderOpen();
            rosterList.replaceChildren();
            say(detail || "방에서 나왔어요. 다시 만들거나 참가할 수 있어요.", detail ? "error" : "");
        }
    }

    createButton.addEventListener("click", async () => {
        if (busy) return;
        setBusy(true);
        const name = rememberName();
        try {
            say("친구 맞을 준비를 하고 있어요…", "busy");
            await hooks.prepare?.();
            const code = await room.host(name);
            renderOpen();
            say(`방을 만들었어요! 코드 ${code} 를 친구에게 보내주세요.`);
        } catch (error) {
            setBusy(false);
            say(error.message || "방을 만들지 못했어요.", "error");
        }
    });

    joinButton.addEventListener("click", async () => {
        if (busy) return;
        const code = normaliseCode(codeInput.value);
        if (code.length !== CODE_LENGTH) {
            say(`방 코드 ${CODE_LENGTH}글자를 적어주세요.`, "error");
            codeInput.focus();
            return;
        }
        setBusy(true);
        const name = rememberName();
        try {
            say("친구 맞을 준비를 하고 있어요…", "busy");
            await hooks.prepare?.();
            await room.join(code, name);
            renderOpen();
            say("방에 들어갔어요!");
        } catch (error) {
            setBusy(false);
            say(error.message || "들어가지 못했어요.", "error");
        }
    });

    codeInput.addEventListener("input", () => {
        codeInput.value = normaliseCode(codeInput.value);
    });
    codeInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") joinButton.click();
    });

    copyButton.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(room.code);
            copyButton.textContent = "복사했어요";
        } catch {
            copyButton.textContent = "직접 적어주세요";
        }
        setTimeout(() => { copyButton.textContent = "복사"; }, 1800);
    });

    // `Room.leave` announces itself through `onStatus`, which is what puts the
    // world back to a single-player night — so this must not shortcut to
    // `status("closed")`.
    leaveButton.addEventListener("click", () => room.leave());

    duelToggle.addEventListener("change", () => {
        room.setDuel(duelToggle.checked);
        roster([...room.players.values()]);
    });

    // Closing the tab mid-room should not leave a ghost standing in the snow.
    window.addEventListener("pagehide", () => room.leave());

    renderOpen();
    return { status, roster };
}
