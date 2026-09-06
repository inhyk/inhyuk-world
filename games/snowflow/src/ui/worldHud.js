import { input } from "../core/input.js";

export function initWorldHud(cycle) {
    const clock = document.getElementById("world-clock");
    const phase = document.getElementById("world-phase");
    const detail = document.getElementById("world-detail");
    const marker = document.getElementById("world-marker");
    const encounters = document.getElementById("encounter-hud");
    const count = document.getElementById("night-monster-count");
    const defeated = document.getElementById("monsters-defeated");
    const notice = document.getElementById("world-notice");
    let noticeUntil = 0;
    let lastDetail = "";
    let lastClock = "";

    function announce(kind) {
        const text = {
            night: "밤이 찾아왔어요. 설원의 그림자를 조심하세요!",
            dawn: "해가 떠올랐어요. 밤의 그림자가 사라집니다.",
            contact: "그림자에게 닿아 체력이 줄었어요! 6번 방패로 밀어내세요.",
            spell: "친구의 마법에 맞았어요!",
            revive: "다시 일어났어요. 잠깐은 아무것도 닿지 않아요.",
            joined: "친구가 설원에 들어왔어요.",
            left: "친구가 설원을 떠났어요.",
        }[kind];
        if (!text) return;
        notice.textContent = text;
        noticeUntil = cycle.elapsedSeconds + (kind === "contact" || kind === "spell" ? 3 : 7);
    }

    function update(monsters) {
        const clockKey = `${cycle.clock}-${cycle.label}`;
        if (clockKey !== lastClock) {
            clock.textContent = cycle.clock;
            phase.textContent = `${cycle.isNight ? "☾" : "☀"} ${cycle.label}`;
            lastClock = clockKey;
        }
        const seconds = Math.ceil(cycle.secondsUntilTransition - 1e-8);
        const remaining = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
        const text = `${cycle.day}일째 · ${cycle.running ? `${cycle.isNight ? "일출" : "밤"}까지 ${remaining}` : "일시정지"}`;
        if (text !== lastDetail) { detail.textContent = text; lastDetail = text; }
        marker.style.left = `${((cycle.hour + 18) % 24) / 24 * 100}%`;
        document.getElementById("world-hud").classList.toggle("is-night", cycle.isNight);
        encounters.hidden = !input.active;
        count.textContent = cycle.isNight ? `밤의 그림자 ${monsters.aliveCount} / 8` : "평화로운 설원";
        defeated.textContent = `물리친 몬스터 ${monsters.defeated}`;
        notice.hidden = !input.active || cycle.elapsedSeconds >= noticeUntil;
    }

    return { update, announce };
}
