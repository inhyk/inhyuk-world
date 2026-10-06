/**
 * Four-player rooms over the shared seonn.dev net server (`@inhyuk/net`).
 *
 * The server only relays: it hands out seats (`p1`, `p2`, ...), says who came
 * and went, and passes JSON on. The game on top is still a star in spirit —
 * whoever makes the room runs the shadows and the clock and publishes them;
 * guests render what they are told and report the hits their own spells land.
 * Without that, four players in one room would be fighting four private
 * nights and wondering why nobody else could see them.
 *
 * What changed from the PeerJS days is that nobody relays for anybody: every
 * client's packet reaches everyone through the server, and whoever a part of
 * it is not meant for ignores it.
 *
 * The server drops anything over 30 messages a second per connection, so
 * nothing here is sent the moment it happens. Everything — your body, the
 * host's world, the roster, every one-off event — goes into one outbox, and
 * the outbox leaves at most once every SEND_GAP ms as a single packet. A
 * snowball, a cast or a landed hit is never thrown away to make room: it just
 * rides the next packet, at most one gap later.
 *
 * Nothing here touches Babylon, the DOM or the game loop. It takes state in
 * through `publish*`, and hands state out through the callbacks it was built
 * with.
 */

import { Room as NetRoom, MESSAGES, normaliseCode as netCode } from "../../../../packages/net/index.mjs";
import { serverUrl } from "./server.js";

export const MAX_PLAYERS = 4;
export const NET_GAME = "snowflow";

/** The server's room codes: six of A-Z/2-9 without O/0 and I/1. */
export const CODE_LENGTH = 6;

/** Cool, high-contrast against snow, and distinguishable from the ice wraiths. */
export const PLAYER_COLORS = [
    [0.42, 0.72, 1.00], // 호스트: 하늘
    [1.00, 0.58, 0.42], // 노을
    [0.62, 1.00, 0.66], // 새싹
    [0.94, 0.66, 1.00], // 라일락
];

/**
 * At most one packet per this many ms, so at most 20 a second against the
 * server's 30. The game publishes bodies 15 times a second, so in practice
 * one packet per tick, with events folded in.
 */
export const SEND_GAP = 50;

/** Bytes of JSON per packet, leaving room under the server's 16KB. */
const PACKET_BUDGET = 12 * 1024;

/** Numbers per player on the wire. See `publishSelf` / `unpackPlayer`. */
export const STATE_STRIDE = 12;

const q = (value, places = 2) => {
    const k = 10 ** places;
    return Math.round((Number(value) || 0) * k) / k;
};

/** Normalise whatever was typed into the box. */
export function normaliseCode(text) {
    return netCode(text);
}

/** The library's sentences, in this game's voice. Unknown ones pass through. */
const SAY = new Map([
    [MESSAGES.code, "방 코드는 여섯 글자예요."],
    [MESSAGES.create, "방을 만들지 못했어요. 잠시 뒤에 다시 시도해 주세요."],
    [MESSAGES.network, "방 서버에 연결하지 못했어요. 인터넷을 확인해 주세요."],
    [MESSAGES.timeout, "연결이 너무 오래 걸려요. 인터넷을 확인해 주세요."],
    [MESSAGES.notFound, "그 코드의 방을 찾지 못했어요."],
    [MESSAGES.lost, "인터넷 연결이 끊겼어요."],
    [MESSAGES.full(MAX_PLAYERS), `방이 가득 찼어요 (최대 ${MAX_PLAYERS}명).`],
]);
export function describeError(message) {
    return SAY.get(message) || message || "연결하지 못했어요. 잠시 뒤에 다시 시도해 주세요.";
}

export const HOST_LEFT = "방장이 나가서 방이 닫혔어요. 새 방을 만들어 주세요.";

export class Room {
    /**
     * @param {object} hooks
     * @param {(kind: string, detail?: any) => void} [hooks.onStatus]
     *   "connecting" | "open" | "closed"
     * @param {(players: Array) => void} [hooks.onRoster]
     * @param {(wire: number[]) => void} [hooks.onMonsters]  guests only
     * @param {(seconds: number) => void} [hooks.onClock]    guests only
     * @param {(id: number, damage: number) => void} [hooks.onMonsterHit] host only
     * @param {(damage: number, from: string) => void} [hooks.onHurt]
     * @param {object} [options] `server`, `fetch`, `connect` for `@inhyuk/net`
     *   (tests and local servers); the server defaults to `?net=` or production
     */
    constructor(hooks = {}, options = {}) {
        this.hooks = hooks;
        this.options = options;
        /** @type {NetRoom|null} */
        this.net = null;
        this.isHost = false;
        this.code = "";
        this.selfId = "";
        this.name = "";
        /** Whether spells hurt other players. Host decides; guests are told. */
        this.duel = false;

        /** id -> { id, name, colorIndex, isHost, state, hasState, lastSeen } */
        this.players = new Map();
        this._live = false;
        this._hostId = "";
        this._self = new Array(STATE_STRIDE).fill(0);
        this._selfDirty = false;
        /** Host only: the latest world, sent with the next packet. */
        this._world = null;
        this._rosterDirty = false;
        /** One-off events waiting for the next packet. */
        this._events = [];
        this._timer = null;
        this._lastSent = 0;
        /** Packets this client has handed to the server. For checks. */
        this.sentPackets = 0;
    }

    get active() { return this._live; }
    /** Everyone but you. This is what the renderer draws. */
    get others() {
        const out = [];
        for (const p of this.players.values()) if (p.id !== this.selfId) out.push(p);
        return out;
    }
    get count() { return this.players.size; }
    get full() { return this.players.size >= MAX_PLAYERS; }

    // ------------------------------------------------------------- lifecycle

    _makeNet() {
        const net = new NetRoom({
            depart: (id) => this._onDepart(net, id),
            host: (id) => this._onHostChange(net, id),
            rejoin: () => { if (this.net === net && this.isHost) this._announceRoster(); },
            message: (data, from) => { if (this.net === net) this._onPacket(data, from); },
            status: (status, message) => {
                // Only a drop after the room opened. Failures while opening
                // come back as the rejected promise instead.
                if (status === "error" && this.net === net && this._live) this._dropped(describeError(message));
            },
            error: (code) => {
                if (code === "rate" || code === "too-big") console.warn(`[snowflow net] server dropped a packet: ${code}`);
            },
        }, {
            game: NET_GAME,
            maxPlayers: MAX_PLAYERS,
            server: this.options.server ?? serverUrl(globalThis.location?.search ?? ""),
            fetch: this.options.fetch,
            connect: this.options.connect,
        });
        return net;
    }

    /** @param {string} name @returns {Promise<string>} the room code */
    async host(name) {
        return this._open("", name);
    }

    /** @param {string} code @param {string} name */
    async join(code, name) {
        const clean = normaliseCode(code);
        if (clean.length !== CODE_LENGTH) throw new Error("방 코드는 여섯 글자예요.");
        return this._open(clean, name);
    }

    async _open(code, name) {
        this.leave(true);
        const net = this._makeNet();
        this.net = net;
        this.name = trimName(name);
        this.hooks.onStatus?.("connecting");
        try {
            await net.open(code || undefined);
        } catch (error) {
            if (this.net === net) this.net = null;
            throw new Error(describeError(error?.message));
        }
        // Left (or started another room) while this one was connecting.
        if (this.net !== net || !net.active) throw new Error("방에서 나왔어요.");

        this.code = net.code;
        this.selfId = net.id;
        this.isHost = net.host;
        this._hostId = net.hostId;
        this._live = true;
        this.players.clear();
        if (this.isHost) {
            this.players.set(this.selfId, {
                id: this.selfId, name: this.name, colorIndex: 0, isHost: true,
                state: this._self.slice(), hasState: true, lastSeen: now(),
            });
            this._announceRoster();
        } else {
            this._queue({ t: "hello", name: this.name });
        }
        this.hooks.onStatus?.("open");
        return this.code;
    }

    /**
     * @param {boolean} [quiet] true when another connect is about to start, so
     *   the panel does not flash "left the room" on its way into a new one
     */
    leave(quiet = false) {
        const wasActive = this._live;
        this._live = false;
        if (this._timer) { clearTimeout(this._timer); this._timer = null; }
        const net = this.net;
        this.net = null;
        // The server tells everyone else we left; no goodbye packet needed.
        try { net?.leave(); } catch { /* already gone */ }
        this.players.clear();
        this._events.length = 0;
        this._world = null;
        this._selfDirty = false;
        this._rosterDirty = false;
        this.isHost = false;
        this.code = "";
        this.duel = false;
        this._hostId = "";
        if (wasActive && !quiet) this.hooks.onStatus?.("closed");
    }

    _dropped(reason) {
        if (!this._live && !this.net) return;
        this.leave(true);
        this.hooks.onStatus?.("closed", reason);
    }

    // ------------------------------------------------------- server events

    _onDepart(net, id) {
        if (this.net !== net || !id || !this._live) return;
        if (!this.isHost && id === this._hostId) {
            // The host ran the night. Nobody else has the shadows' state, so
            // the room ends here rather than half-continuing.
            this._dropped(HOST_LEFT);
            return;
        }
        if (this.players.delete(id)) {
            if (this.isHost) this._announceRoster();
            else this.hooks.onRoster?.([...this.players.values()]);
        }
    }

    _onHostChange(net, id) {
        if (this.net !== net || !this._live) return;
        // Only happens when the host left. Normally the leave already closed
        // the room; this covers a host that went silent instead.
        if (id !== this._hostId) this._dropped(HOST_LEFT);
    }

    // ------------------------------------------------------------- packets

    /**
     * Everything one client sent in one packet.
     * { s?: body, w?: world (host), r?: roster (host), e?: events }
     */
    _onPacket(data, from) {
        if (!this._live || !data || typeof data !== "object") return;
        const fromHost = from === this._hostId;

        if (fromHost && !this.isHost && data.r && typeof data.r === "object") this._adoptRoster(data.r);

        if (Array.isArray(data.e)) {
            for (const event of data.e) this._onEvent(event, from, fromHost);
        }

        const player = this.players.get(from);
        if (player) {
            player.lastSeen = now();
            if (Array.isArray(data.s)) { player.state = data.s.slice(0, STATE_STRIDE); player.hasState = true; }
        }

        if (fromHost && !this.isHost && data.w && typeof data.w === "object") {
            const w = data.w;
            if (Array.isArray(w.m)) this.hooks.onMonsters?.(w.m, w.d | 0);
            if (typeof w.c === "number") this.hooks.onClock?.(w.c);
            if (Array.isArray(w.g)) this.hooks.onMatch?.(w.g[0], w.g[1]);
            if (Array.isArray(w.w)) this.hooks.onWhirls?.(w.w, w.wd | 0);
        }
    }

    _onEvent(event, from, fromHost) {
        if (!event || typeof event !== "object") return;
        switch (event.t) {
            case "hello": {
                if (!this.isHost) return;
                if (this.players.has(from)) {
                    this.players.get(from).name = trimName(event.name);
                } else {
                    // The server already caps the room at four seats.
                    this.players.set(from, {
                        id: from, name: trimName(event.name), colorIndex: this._freeColor(),
                        isHost: false, state: new Array(STATE_STRIDE).fill(0),
                        // Nothing is drawn at the world origin while we wait
                        // for this guest's first body packet.
                        hasState: false, lastSeen: now(),
                    });
                }
                this._announceRoster();
                return;
            }
            case "ball":
                // Everyone simulates the same ball from the same launch, so a
                // throw is one event and never a stream.
                this.hooks.onBall?.(event.b, from);
                return;
            case "cast":
                // The spell itself is re-run on every machine from the same
                // parameters.
                this.hooks.onCast?.(event.k | 0, event.p ?? null, from);
                return;
            case "hit":
                if (this.isHost) this.hooks.onMonsterHit?.(event.id | 0, Number(event.d) || 0, event.k || "m");
                return;
            case "match":
                if (this.isHost) this.hooks.onMatchRequest?.(!!event.want);
                return;
            case "pvp":
                // Damage is applied by whoever owns the body; everyone else
                // just lets it pass.
                if (event.target === this.selfId) this.hooks.onHurt?.(Number(event.d) || 0, from);
                return;
            default:
        }
    }

    _adoptRoster(r) {
        this.duel = !!r.duel;
        const seen = new Set();
        for (const entry of Array.isArray(r.roster) ? r.roster : []) {
            if (!entry || typeof entry.id !== "string") continue;
            seen.add(entry.id);
            const existing = this.players.get(entry.id);
            if (existing) {
                existing.name = trimName(entry.name);
                existing.colorIndex = entry.colorIndex | 0;
                existing.isHost = !!entry.isHost;
            } else {
                this.players.set(entry.id, {
                    id: entry.id, name: trimName(entry.name), colorIndex: entry.colorIndex | 0,
                    isHost: !!entry.isHost, state: new Array(STATE_STRIDE).fill(0),
                    hasState: false, lastSeen: now(),
                });
            }
        }
        for (const id of [...this.players.keys()]) {
            if (!seen.has(id)) this.players.delete(id);
        }
        this.hooks.onRoster?.([...this.players.values()]);
    }

    _freeColor() {
        const taken = new Set([...this.players.values()].map((p) => p.colorIndex));
        for (let i = 0; i < PLAYER_COLORS.length; i++) if (!taken.has(i)) return i;
        return this.players.size % PLAYER_COLORS.length;
    }

    _announceRoster() {
        this._rosterDirty = true;
        this._schedule();
        this.hooks.onRoster?.([...this.players.values()]);
    }

    /** Host only. Flip friendly fire and tell the room. */
    setDuel(on) {
        if (!this.isHost) return;
        this.duel = !!on;
        this._announceRoster();
    }

    // ------------------------------------------------------------ outbox

    _queue(event) {
        this._events.push(event);
        this._schedule();
    }

    /** One packet per SEND_GAP at most; everything since the last one rides it. */
    _schedule() {
        if (!this._live || this._timer) return;
        const wait = Math.max(0, this._lastSent + SEND_GAP - now());
        this._timer = setTimeout(() => { this._timer = null; this._flush(); }, wait);
    }

    _flush() {
        if (!this._live || !this.net) return;
        const packet = {};
        if (this._selfDirty) { packet.s = this._self.slice(); this._selfDirty = false; }
        if (this._world) { packet.w = this._world; this._world = null; }
        if (this._rosterDirty && this.isHost) {
            packet.r = {
                duel: this.duel,
                roster: [...this.players.values()].map((p) => ({
                    id: p.id, name: p.name, colorIndex: p.colorIndex, isHost: p.isHost,
                })),
            };
        }
        this._rosterDirty = false;
        if (this._events.length) {
            // As many events as fit under the server's 16KB; the rest wait
            // for the next packet instead of being lost.
            let left = PACKET_BUDGET - JSON.stringify(packet).length;
            let n = 0;
            while (n < this._events.length) {
                const size = JSON.stringify(this._events[n]).length + 1;
                if (size > left && n > 0) break;
                left -= size;
                n++;
            }
            packet.e = this._events.splice(0, n);
        }
        if (!packet.s && !packet.w && !packet.r && !packet.e) return;
        // Nobody else here yet: there is no one to tell, and every packet
        // spends the server's daily request budget. A guest who arrives gets
        // the roster when it says hello.
        if (this.net.peers.length === 0) { this._events.length = 0; return; }
        this._lastSent = now();
        if (this.net.send(packet)) this.sentPackets++;
        if (this._events.length) this._schedule();
    }

    // ------------------------------------------------------------ publishing

    /**
     * This client's body, once per network tick.
     * @param {{x:number,y:number,z:number}} position
     */
    publishSelf(position, facing, surf, speed01, hp, downed, castKey, score, aim) {
        if (!this._live) return;
        const s = this._self;
        s[0] = q(position.x); s[1] = q(position.y); s[2] = q(position.z);
        s[3] = q(facing, 3);
        s[4] = q(surf, 2);
        s[5] = q(speed01, 2);
        s[6] = Math.round(hp);
        s[7] = (downed ? 1 : 0) | ((castKey || 0) << 1);
        s[8] = score | 0;
        // Where they are looking, so a held ribbon and the casting stance
        // follow their camera on your screen.
        s[9] = aim ? q(aim.x, 3) : 0;
        s[10] = aim ? q(aim.y, 3) : 0;
        s[11] = aim ? q(aim.z, 3) : 1;
        const me = this.players.get(this.selfId);
        if (me) { me.state = s.slice(); me.hasState = true; }
        this._selfDirty = true;
        this._schedule();
    }

    /** Host only: the shadows and the clock everyone shares. */
    publishWorld(monsterWire, clockSeconds, defeated, match, whirlWire, whirlsDefeated) {
        if (!this._live || !this.isHost || !this.net || this.net.peers.length === 0) return;
        // Copied: the encounter pools reuse their wire arrays every frame.
        this._world = {
            m: Array.isArray(monsterWire) ? monsterWire.slice() : null,
            c: q(clockSeconds, 1), d: defeated | 0,
            g: match ? [match.phase, q(match.timer, 1)] : null,
            w: Array.isArray(whirlWire) ? whirlWire.slice() : null, wd: whirlsDefeated | 0,
        };
        this._schedule();
    }

    /**
     * A throw, to everyone. One event per ball: the flight is the same
     * arithmetic on every machine.
     * @param {number[]} wire [x, y, z, vx, vy, vz]
     */
    throwBall(wire) {
        if (!this._live) return;
        this._queue({ t: "ball", b: wire });
    }

    /**
     * A spell, to everyone. Direction for the waves, a landing point for the
     * placed spells, a hold flag for the ribbon — whatever `perform` needs.
     * @param {number} key @param {number[]|null} params
     */
    castSpell(key, params) {
        if (!this._live) return;
        const p = Array.isArray(params) ? params.map((v) => q(v, 3)) : null;
        this._queue({ t: "cast", k: key, p });
    }

    /** Guest → host: "start a match". Only the host may actually start one. */
    requestMatch(want) {
        if (!this._live || this.isHost) return;
        this._queue({ t: "match", want: !!want });
    }

    /** Guest only: "my spell hit shadow #3 for 2". The host decides if it died. */
    reportMonsterHit(id, damage, kind = "m") {
        if (!this._live || this.isHost) return;
        this._queue({ t: "hit", id, d: damage, k: kind });
    }

    /** Duel rooms: tell another player their own body just took a hit. */
    sendPlayerDamage(targetId, damage) {
        if (!this._live || !this.duel) return;
        this._queue({ t: "pvp", target: targetId, d: damage });
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
        if (!this._live) return out;
        for (const player of this.players.values()) {
            if (player.id === this.selfId || !player.hasState) continue;
            out.push({ x: player.state[0], y: player.state[1], z: player.state[2] });
        }
        return out;
    }
}

// ------------------------------------------------------------------ helpers

const now = () => Date.now();

export function trimName(name) {
    const text = String(name || "").trim().replace(/\s+/g, " ").slice(0, 10);
    return text || "이름없는 마법사";
}

/** Unpack a wire state into the fields the renderer wants. */
export function unpackPlayer(state) {
    const flags = state[7] | 0;
    return {
        x: state[0], y: state[1], z: state[2],
        facing: state[3], surf: state[4], speed01: state[5],
        hp: state[6], downed: (flags & 1) === 1, castKey: flags >> 1,
        score: state[8] | 0,
        aimX: state[9] ?? 0, aimY: state[10] ?? 0, aimZ: state[11] ?? 1,
    };
}
