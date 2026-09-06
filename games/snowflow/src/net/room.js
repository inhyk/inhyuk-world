/**
 * Four-player rooms over WebRTC.
 *
 * A star, not a mesh: whoever makes the room owns the peer id
 * `snowflow-room-<code>`, everyone else dials it, and the host relays. That is
 * three connections at four players instead of six, and — more importantly —
 * it gives the night a single simulation. The host runs the shadows and the
 * clock and publishes them; guests render what they are told and report the
 * hits their own spells land. Without that, four players in one room would be
 * fighting four private nights and wondering why nobody else could see them.
 *
 * PeerJS is loaded on demand. Nobody who never opens a room pays for it, and a
 * broker that is down cannot stop the demo from booting.
 *
 * Nothing here touches Babylon, the DOM or the game loop. It takes state in
 * through `publish*`, and hands state out through the callbacks it was built
 * with.
 */

export const MAX_PLAYERS = 4;

/** Room codes: no O/0, no I/1 — they get read aloud and typed by hand. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;
const PEER_PREFIX = "snowflow-room-";

/** Cool, high-contrast against snow, and distinguishable from the ice wraiths. */
export const PLAYER_COLORS = [
    [0.42, 0.72, 1.00], // 호스트: 하늘
    [1.00, 0.58, 0.42], // 노을
    [0.62, 1.00, 0.66], // 새싹
    [0.94, 0.66, 1.00], // 라일락
];

const CONNECT_TIMEOUT = 14000;
/** A peer that has said nothing for this long is treated as gone. */
const PEER_TIMEOUT = 12000;

/** Numbers per player on the wire. See `packSelf` / `unpackPlayer`. */
export const STATE_STRIDE = 9;

const q = (value, places = 2) => {
    const k = 10 ** places;
    return Math.round((Number(value) || 0) * k) / k;
};

export function generateCode() {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return code;
}

/** Normalise whatever was typed into the box. */
export function normaliseCode(text) {
    return String(text || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);
}

function describeError(error) {
    const type = error && error.type;
    if (type === "peer-unavailable") return "그 코드의 방을 찾지 못했어요.";
    if (type === "unavailable-id") return "같은 코드의 방이 이미 있어요. 다시 만들어 주세요.";
    if (type === "browser-incompatible") return "이 브라우저는 멀티플레이를 지원하지 않아요.";
    if (type === "network" || type === "server-error" || type === "socket-error") {
        return "인터넷 연결이 끊겼어요.";
    }
    return "연결하지 못했어요. 잠시 뒤에 다시 시도해 주세요.";
}

/** @type {Promise<any>|null} */
let peerModule = null;
function loadPeer() {
    if (!peerModule) {
        peerModule = import("peerjs").then((m) => m.Peer || m.default?.Peer || m.default);
    }
    return peerModule;
}

export class Room {
    /**
     * @param {object} hooks
     * @param {(kind: string, detail?: any) => void} [hooks.onStatus]
     *   "connecting" | "open" | "closed" | "error" | "roster"
     * @param {(players: Array) => void} [hooks.onRoster]
     * @param {(wire: number[]) => void} [hooks.onMonsters]  guests only
     * @param {(seconds: number) => void} [hooks.onClock]    guests only
     * @param {(id: number, damage: number) => void} [hooks.onMonsterHit] host only
     * @param {(damage: number, from: string) => void} [hooks.onHurt]
     */
    constructor(hooks = {}) {
        this.hooks = hooks;
        this.peer = null;
        this.isHost = false;
        this.code = "";
        this.selfId = "";
        this.name = "";
        /** Whether spells hurt other players. Host decides; guests are told. */
        this.duel = false;

        /** id -> { id, name, colorIndex, isHost, state, lastSeen } */
        this.players = new Map();
        /** Host only: guest id -> DataConnection. */
        this._connections = new Map();
        /** Guest only: the one connection to the host. */
        this._uplink = null;
        this._sweep = null;
        this._self = new Array(STATE_STRIDE).fill(0);
    }

    get active() { return !!this.peer && !this.peer.destroyed; }
    /** Everyone but you. This is what the renderer draws. */
    get others() {
        const out = [];
        for (const p of this.players.values()) if (p.id !== this.selfId) out.push(p);
        return out;
    }
    get count() { return this.players.size; }
    get full() { return this.players.size >= MAX_PLAYERS; }

    // ------------------------------------------------------------- lifecycle

    /** @param {string} name @returns {Promise<string>} the room code */
    async host(name) {
        this.leave(true);
        const Peer = await loadPeer();
        const code = generateCode();
        this.isHost = true;
        this.code = code;
        this.name = trimName(name);
        this.selfId = PEER_PREFIX + code.toLowerCase();
        this.hooks.onStatus?.("connecting");

        this.peer = new Peer(this.selfId, { debug: 0 });
        await this._waitOpen();

        this.players.set(this.selfId, {
            id: this.selfId, name: this.name, colorIndex: 0, isHost: true,
            state: this._self.slice(), hasState: true, lastSeen: now(),
        });

        this.peer.on("connection", (conn) => this._acceptGuest(conn));
        this._startSweep();
        this._announceRoster();
        this.hooks.onStatus?.("open");
        return code;
    }

    /** @param {string} code @param {string} name */
    async join(code, name) {
        const clean = normaliseCode(code);
        if (clean.length !== CODE_LENGTH) throw new Error("방 코드는 다섯 글자예요.");
        this.leave(true);
        const Peer = await loadPeer();
        this.isHost = false;
        this.code = clean;
        this.name = trimName(name);
        this.hooks.onStatus?.("connecting");

        this.peer = new Peer(undefined, { debug: 0 });
        this.selfId = await this._waitOpen();

        // Reliable, deliberately. Most of what crosses this channel is a body
        // fifteen times a second, and losing one of those costs nothing — but
        // the same channel carries every one-shot event in the game: the join,
        // the roster, a spell landing on a friend, a shadow taking a hit. An
        // unreliable channel drops those silently and the symptom is "I hit
        // them and nothing happened". PeerJS gives one channel per connection,
        // so it has to be the one that cannot lose an event; at this rate the
        // head-of-line cost is invisible under the easing.
        const conn = this.peer.connect(PEER_PREFIX + clean.toLowerCase(), {
            reliable: true, serialization: "json",
        });
        this._uplink = conn;
        await waitFor(conn, CONNECT_TIMEOUT, "방이 응답하지 않아요.");

        conn.on("data", (msg) => this._onHostMessage(msg));
        conn.on("close", () => this._dropped("호스트와 연결이 끊겼어요."));
        conn.on("error", () => this._dropped("호스트와 연결이 끊겼어요."));
        conn.send({ t: "hello", name: this.name });
        this._startSweep();
        this.hooks.onStatus?.("open");
        return clean;
    }

    /**
     * @param {boolean} [quiet] true when another connect is about to start, so
     *   the panel does not flash "left the room" on its way into a new one
     */
    leave(quiet = false) {
        const wasActive = this.active;
        if (this._sweep) { clearInterval(this._sweep); this._sweep = null; }
        try {
            if (this._uplink?.open) this._uplink.send({ t: "bye" });
            for (const conn of this._connections.values()) {
                if (conn.open) conn.send({ t: "bye" });
            }
        } catch { /* the socket is going away anyway */ }
        this._connections.clear();
        this._uplink = null;
        this.players.clear();
        if (this.peer) { try { this.peer.destroy(); } catch { /* already gone */ } }
        this.peer = null;
        this.isHost = false;
        this.code = "";
        this.duel = false;
        if (wasActive && !quiet) this.hooks.onStatus?.("closed");
    }

    _waitOpen() {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("연결이 너무 오래 걸려요.")), CONNECT_TIMEOUT);
            this.peer.on("open", (id) => { clearTimeout(timer); resolve(id); });
            this.peer.on("error", (err) => {
                clearTimeout(timer);
                reject(new Error(describeError(err)));
            });
        });
    }

    _dropped(reason) {
        if (!this.active && !this._uplink) return;
        this.leave(true);
        this.hooks.onStatus?.("closed", reason);
    }

    /** Drop peers that have gone quiet without closing cleanly (a shut laptop). */
    _startSweep() {
        this._sweep = setInterval(() => {
            if (!this.isHost) return;
            const cutoff = now() - PEER_TIMEOUT;
            let changed = false;
            for (const [id, player] of this.players) {
                if (id === this.selfId || player.lastSeen > cutoff) continue;
                this.players.delete(id);
                this._connections.get(id)?.close();
                this._connections.delete(id);
                changed = true;
            }
            if (changed) this._announceRoster();
        }, 3000);
    }

    // ------------------------------------------------------------- host side

    _acceptGuest(conn) {
        if (this.full) {
            conn.on("open", () => {
                conn.send({ t: "denied", why: `방이 가득 찼어요 (최대 ${MAX_PLAYERS}명).` });
                setTimeout(() => conn.close(), 200);
            });
            return;
        }
        conn.on("open", () => {
            this._connections.set(conn.peer, conn);
        });
        conn.on("data", (msg) => this._onGuestMessage(conn, msg));
        conn.on("close", () => this._removeGuest(conn.peer));
        conn.on("error", () => this._removeGuest(conn.peer));
    }

    _removeGuest(id) {
        this._connections.delete(id);
        if (this.players.delete(id)) this._announceRoster();
    }

    _onGuestMessage(conn, msg) {
        if (!msg || typeof msg !== "object") return;
        const id = conn.peer;
        const player = this.players.get(id);
        if (player) player.lastSeen = now();

        switch (msg.t) {
            case "hello": {
                if (this.full) {
                    conn.send({ t: "denied", why: `방이 가득 찼어요 (최대 ${MAX_PLAYERS}명).` });
                    setTimeout(() => conn.close(), 200);
                    return;
                }
                this.players.set(id, {
                    id, name: trimName(msg.name), colorIndex: this._freeColor(),
                    isHost: false, state: new Array(STATE_STRIDE).fill(0),
                    // Nothing is drawn at the world origin while we wait for
                    // this guest's first body packet.
                    hasState: false, lastSeen: now(),
                });
                this._announceRoster();
                return;
            }
            case "state":
                if (player && Array.isArray(msg.s)) { player.state = msg.s; player.hasState = true; }
                return;
            case "hit":
                this.hooks.onMonsterHit?.(msg.id | 0, Number(msg.d) || 0);
                return;
            case "ball":
                // Everyone simulates the same ball from the same launch, so a
                // throw is one message and never a stream. The host is also a
                // relay: guests do not see each other directly.
                this.hooks.onBall?.(msg.b, id);
                this._broadcast({ t: "ball", b: msg.b, from: id }, id);
                return;
            case "match":
                this.hooks.onMatchRequest?.(msg.want);
                return;
            case "pvp":
                // Damage is applied by whoever owns the body, so this is only
                // ever forwarded — never resolved here.
                if (msg.target === this.selfId) this.hooks.onHurt?.(Number(msg.d) || 0, id);
                else this._sendTo(msg.target, { t: "pvp", target: msg.target, d: msg.d, from: id });
                return;
            case "bye":
                this._removeGuest(id);
                return;
            default:
        }
    }

    _freeColor() {
        const taken = new Set([...this.players.values()].map((p) => p.colorIndex));
        for (let i = 0; i < PLAYER_COLORS.length; i++) if (!taken.has(i)) return i;
        return this.players.size % PLAYER_COLORS.length;
    }

    _announceRoster() {
        const roster = [...this.players.values()].map((p) => ({
            id: p.id, name: p.name, colorIndex: p.colorIndex, isHost: p.isHost,
        }));
        this._broadcast({ t: "roster", roster, duel: this.duel, host: this.selfId });
        this.hooks.onRoster?.([...this.players.values()]);
    }

    /** Host only. Flip friendly fire and tell the room. */
    setDuel(on) {
        if (!this.isHost) return;
        this.duel = !!on;
        this._announceRoster();
    }

    // ------------------------------------------------------------ guest side

    _onHostMessage(msg) {
        if (!msg || typeof msg !== "object") return;
        switch (msg.t) {
            case "roster": {
                this.duel = !!msg.duel;
                const seen = new Set();
                for (const entry of msg.roster || []) {
                    seen.add(entry.id);
                    const existing = this.players.get(entry.id);
                    if (existing) {
                        existing.name = entry.name;
                        existing.colorIndex = entry.colorIndex;
                        existing.isHost = entry.isHost;
                    } else {
                        this.players.set(entry.id, {
                            ...entry, state: new Array(STATE_STRIDE).fill(0),
                            hasState: false, lastSeen: now(),
                        });
                    }
                }
                for (const id of [...this.players.keys()]) {
                    if (!seen.has(id)) this.players.delete(id);
                }
                this.hooks.onRoster?.([...this.players.values()]);
                return;
            }
            case "players": {
                for (const [id, state] of msg.p || []) {
                    if (id === this.selfId) continue;
                    const player = this.players.get(id);
                    if (player) { player.state = state; player.hasState = true; player.lastSeen = now(); }
                }
                return;
            }
            case "world":
                if (Array.isArray(msg.m)) this.hooks.onMonsters?.(msg.m, msg.d | 0);
                if (typeof msg.c === "number") this.hooks.onClock?.(msg.c);
                if (Array.isArray(msg.g)) this.hooks.onMatch?.(msg.g[0], msg.g[1]);
                return;
            case "ball":
                this.hooks.onBall?.(msg.b, msg.from);
                return;
            case "pvp":
                if (msg.target === this.selfId) this.hooks.onHurt?.(Number(msg.d) || 0, msg.from);
                return;
            case "denied":
                this._dropped(msg.why || "방에 들어가지 못했어요.");
                return;
            case "bye":
                this._dropped("방이 닫혔어요.");
                return;
            default:
        }
    }

    // ------------------------------------------------------------ publishing

    /**
     * This client's body, once per network tick.
     * @param {{x:number,y:number,z:number}} position
     */
    publishSelf(position, facing, surf, speed01, hp, downed, castKey, score) {
        if (!this.active) return;
        const s = this._self;
        s[0] = q(position.x); s[1] = q(position.y); s[2] = q(position.z);
        s[3] = q(facing, 3);
        s[4] = q(surf, 2);
        s[5] = q(speed01, 2);
        s[6] = Math.round(hp);
        s[7] = (downed ? 1 : 0) | ((castKey || 0) << 1);
        s[8] = score | 0;
        if (this.isHost) {
            const me = this.players.get(this.selfId);
            if (me) { me.state = s; me.hasState = true; }
            const packed = [];
            for (const p of this.players.values()) packed.push([p.id, p.state]);
            this._broadcast({ t: "players", p: packed });
        } else if (this._uplink?.open) {
            this._uplink.send({ t: "state", s });
        }
    }

    /** Host only: the shadows and the clock everyone shares. */
    publishWorld(monsterWire, clockSeconds, defeated, match) {
        if (!this.active || !this.isHost || this._connections.size === 0) return;
        this._broadcast({
            t: "world", m: monsterWire, c: q(clockSeconds, 1), d: defeated | 0,
            g: match ? [match.phase, q(match.timer, 1)] : null,
        });
    }

    /**
     * A throw, to everyone. One message per ball: the flight is the same
     * arithmetic on every machine, so re-sending its position would be both
     * bigger and, at fifteen hertz, worse.
     * @param {number[]} wire [x, y, z, vx, vy, vz]
     */
    throwBall(wire) {
        if (!this.active) return;
        if (this.isHost) this._broadcast({ t: "ball", b: wire, from: this.selfId });
        else if (this._uplink?.open) this._uplink.send({ t: "ball", b: wire });
    }

    /** Guest → host: "start a match". Only the host may actually start one. */
    requestMatch(want) {
        if (!this.active || this.isHost || !this._uplink?.open) return;
        this._uplink.send({ t: "match", want: !!want });
    }

    /** Guest only: "my spell hit shadow #3 for 2". The host decides if it died. */
    reportMonsterHit(id, damage) {
        if (!this.active || this.isHost || !this._uplink?.open) return;
        this._uplink.send({ t: "hit", id, d: damage });
    }

    /** Duel rooms: tell another player their own body just took a hit. */
    sendPlayerDamage(targetId, damage) {
        if (!this.active || !this.duel) return;
        if (this.isHost) this._sendTo(targetId, { t: "pvp", target: targetId, d: damage, from: this.selfId });
        else this._uplink?.open && this._uplink.send({ t: "pvp", target: targetId, d: damage });
    }

    /**
     * Every body in the room, as plain positions. The host's shadows spawn
     * around the party rather than around the host, so a guest who wanders is
     * not standing in an empty, peaceful night.
     * @param {{x:number,y:number,z:number}} self
     * @returns {Array<{x:number,y:number,z:number}>}
     */
    partyPositions(self) {
        const out = [self];
        if (!this.active) return out;
        for (const player of this.players.values()) {
            if (player.id === this.selfId || !player.hasState) continue;
            out.push({ x: player.state[0], y: player.state[1], z: player.state[2] });
        }
        return out;
    }

    _sendTo(id, payload) {
        const conn = this._connections.get(id);
        if (conn?.open) conn.send(payload);
    }

    /** @param {string} [except] a guest id to skip — used when relaying */
    _broadcast(payload, except) {
        for (const [id, conn] of this._connections) {
            if (id === except || !conn.open) continue;
            try { conn.send(payload); } catch { /* dropped next sweep */ }
        }
    }
}

// ------------------------------------------------------------------ helpers

const now = () => Date.now();

export function trimName(name) {
    const text = String(name || "").trim().replace(/\s+/g, " ").slice(0, 10);
    return text || "이름없는 마법사";
}

function waitFor(conn, timeout, message) {
    return new Promise((resolve, reject) => {
        if (conn.open) return resolve();
        const timer = setTimeout(() => reject(new Error(message)), timeout);
        conn.on("open", () => { clearTimeout(timer); resolve(); });
        conn.on("error", (err) => { clearTimeout(timer); reject(new Error(describeError(err))); });
        conn.on("close", () => { clearTimeout(timer); reject(new Error(message)); });
    });
}

/** Unpack a wire state into the fields the renderer wants. */
export function unpackPlayer(state) {
    const flags = state[7] | 0;
    return {
        x: state[0], y: state[1], z: state[2],
        facing: state[3], surf: state[4], speed01: state[5],
        hp: state[6], downed: (flags & 1) === 1, castKey: flags >> 1,
        score: state[8] | 0,
    };
}
