import test from "node:test";
import assert from "node:assert/strict";
import {
    Room, MAX_PLAYERS, STATE_STRIDE, SEND_GAP, CODE_LENGTH, HOST_LEFT,
    normaliseCode, trimName, unpackPlayer, describeError,
} from "../src/net/room.js";
import { serverUrl } from "../src/net/server.js";
import { DEFAULT_SERVER, MESSAGES } from "../../../packages/net/index.mjs";

/**
 * A pretend net server: the same welcome / join / leave / host / msg frames
 * services/net sends, in memory, so whole rooms of real `Room`s (and the real
 * `@inhyuk/net` client under them) can talk without a network.
 */
function hub() {
    const rooms = new Map();
    let next = 0;
    const codes = ["QWERTY", "ASDFGH", "ZXCVBN"];
    const log = { packets: [] };

    class Socket {
        constructor(url) {
            this.url = url; this.readyState = 1; this.listeners = {};
            const [, game, code] = url.match(/\/rooms\/([^/]+)\/([^/?]+)/);
            this.game = game; this.code = code;
            // The browser socket opens on its own; welcome follows.
            setTimeout(() => this._arrive(), 0);
        }
        addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
        _emit(type, payload) { for (const fn of this.listeners[type] ?? []) fn(payload); }
        _serve(message) { if (this.readyState === 1) this._emit("message", { data: JSON.stringify(message) }); }
        _arrive() {
            const room = rooms.get(this.code);
            if (!room) { this._serve({ t: "error", code: "not-found" }); return this._close(); }
            if (room.members.length >= room.max) { this._serve({ t: "error", code: "full", max: room.max }); return this._close(); }
            this.id = `p${++room.seat}`;
            if (!room.host) room.host = this.id;
            const peers = room.members.map((m) => m.id);
            for (const m of room.members) m._serve({ t: "join", id: this.id });
            room.members.push(this);
            this.room = room;
            this._serve({ t: "welcome", id: this.id, host: room.host, max: room.max, peers });
        }
        send(text) {
            const msg = JSON.parse(text);
            if (msg.t === "ping") return this._serve({ t: "pong" });
            if (msg.t === "bye") return this._close();
            if (msg.t !== "send") return;
            assert.ok(text.length <= 16 * 1024, "server limit: 16KB per message");
            log.packets.push({ from: this.id, at: Date.now(), data: msg.data });
            for (const m of this.room.members) {
                if (m === this || (msg.to && m.id !== msg.to)) continue;
                m._serve({ t: "msg", from: this.id, data: msg.data });
            }
        }
        close() { this._close(); }
        _close() {
            if (this.readyState !== 1) return;
            this.readyState = 3;
            const room = this.room;
            if (room) {
                room.members = room.members.filter((m) => m !== this);
                for (const m of room.members) m._serve({ t: "leave", id: this.id });
                if (room.host === this.id && room.members.length) {
                    room.host = room.members[0].id;
                    for (const m of room.members) m._serve({ t: "host", id: room.host });
                }
            }
            this._emit("close", {});
        }
        /** The network vanishing under this client, not a goodbye. */
        drop() { this._close(); }
    }

    const sockets = [];
    const options = {
        server: "ws://local.test",
        fetch: async (url, init) => {
            const code = codes[next++ % codes.length];
            const body = JSON.parse(init.body);
            rooms.set(code, { max: body.maxPlayers, members: [], seat: 0, host: "" });
            return { ok: true, json: async () => ({ code, maxPlayers: body.maxPlayers }) };
        },
        connect: (url) => { const s = new Socket(url); sockets.push(s); return s; },
    };
    return { options, rooms, sockets, log };
}

const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
/** Long enough for every outbox to have flushed once. */
const settle = () => wait(SEND_GAP * 2 + 10);

function recorder() {
    const seen = { status: [], rosters: [], hurts: [], hits: [], casts: [], balls: [], monsters: [], clocks: [], match: [] };
    return {
        seen,
        hooks: {
            onStatus: (kind, detail) => seen.status.push(detail ? [kind, detail] : [kind]),
            onRoster: (players) => seen.rosters.push(players.map((p) => p.name)),
            onHurt: (d, from) => seen.hurts.push([d, from]),
            onMonsterHit: (id, d, k) => seen.hits.push([id, d, k]),
            onCast: (k, p, from) => seen.casts.push([k, p, from]),
            onBall: (b, from) => seen.balls.push([b, from]),
            onMonsters: (m, d) => seen.monsters.push([m, d]),
            onClock: (c) => seen.clocks.push(c),
            onMatchRequest: (want) => seen.match.push(want),
        },
    };
}

async function party(n) {
    const server = hub();
    const host = recorder();
    const hostRoom = new Room(host.hooks, server.options);
    const code = await hostRoom.host("방장");
    const guests = [];
    for (let i = 1; i < n; i++) {
        const r = recorder();
        const room = new Room(r.hooks, server.options);
        await room.join(code.toLowerCase(), `친구${i}`);
        guests.push({ room, seen: r.seen });
    }
    await settle();
    return { server, code, host: { room: hostRoom, seen: host.seen }, guests };
}

const body = (x, hp = 100) => [{ x, y: 1, z: -x }, 0.5, 0, 0.3, hp, false, 0, 2, { x: 0, y: 0, z: 1 }];

test("room codes are the server's six letters, and typing is forgiving", () => {
    assert.equal(CODE_LENGTH, 6);
    assert.equal(normaliseCode(" ab-cd e2 "), "ABCDE2");
    assert.equal(normaliseCode("abcdefgh"), "ABCDEF");
    assert.equal(normaliseCode(null), "");
});

test("names are trimmed, capped and never empty", () => {
    assert.equal(trimName("  인혁   서  "), "인혁 서");
    assert.equal(trimName("a".repeat(40)).length, 10);
    assert.equal(trimName("   "), "이름없는 마법사");
});

test("the server address is production unless a local one is asked for", () => {
    assert.equal(serverUrl(""), DEFAULT_SERVER);
    assert.equal(serverUrl("?net=http://127.0.0.1:8787/"), "http://127.0.0.1:8787");
    assert.equal(serverUrl("?net=ws://localhost:9000"), "ws://localhost:9000");
    assert.equal(serverUrl("?net=https://evil.example"), DEFAULT_SERVER, "only loopback");
    assert.equal(serverUrl("", { VITE_NET_SERVER: "wss://x.test/" }), "wss://x.test");
});

test("the library's sentences come out in this game's voice", () => {
    assert.equal(describeError(MESSAGES.notFound), "그 코드의 방을 찾지 못했어요.");
    assert.equal(describeError(MESSAGES.full(4)), "방이 가득 찼어요 (최대 4명).");
    assert.equal(describeError(MESSAGES.lost), "인터넷 연결이 끊겼어요.");
    assert.equal(describeError("뭔가 다른 일"), "뭔가 다른 일");
});

test("a body is packed and unpacked without losing the flags", () => {
    const state = [1.23, 4.56, -7.89, 0.5, 1, 0.75, 62, 1 | (7 << 1)];
    const b = unpackPlayer(state);
    assert.equal(b.x, 1.23);
    assert.equal(b.z, -7.89);
    assert.equal(b.hp, 62);
    assert.equal(b.downed, true);
    assert.equal(b.castKey, 7);
    assert.equal(unpackPlayer([0, 0, 0, 0, 0, 0, 100, 0]).downed, false);
    const old = unpackPlayer([0, 0, 0, 0, 0, 0, 100, 0, 0]);
    assert.deepEqual([old.aimX, old.aimY, old.aimZ], [0, 0, 1], "a short packet aims ahead");
});

test("host makes a room, a guest joins by code, and both see the same roster", async () => {
    const { host, guests, code } = await party(2);
    const guest = guests[0];
    assert.equal(code.length, CODE_LENGTH);
    assert.equal(host.room.isHost, true);
    assert.equal(guest.room.isHost, false);
    assert.equal(guest.room.code, code);
    assert.deepEqual(host.seen.status, [["connecting"], ["open"]]);
    assert.deepEqual(guest.seen.status, [["connecting"], ["open"]]);
    assert.deepEqual(host.seen.rosters.at(-1), ["방장", "친구1"]);
    assert.deepEqual(guest.seen.rosters.at(-1), ["방장", "친구1"]);
    const colours = [...guest.room.players.values()].map((p) => p.colorIndex);
    assert.deepEqual(colours, [0, 1], "colours do not collide");
    assert.equal(guest.room.others.length, 1, "you are never in your own pool");
    host.room.leave(); guest.room.leave();
});

test("bodies flow both ways, and nobody is drawn before their first body", async () => {
    const { host, guests } = await party(2);
    const guest = guests[0];
    const fromGuest = host.room.players.get(guest.room.selfId);
    assert.equal(fromGuest.hasState, false, "not drawn yet");
    assert.deepEqual(host.room.partyPositions({ x: 0, y: 0, z: 0 }).length, 1, "a silent guest is not a spawn anchor");

    host.room.publishSelf(...body(5, 90));
    guest.room.publishSelf(...body(30, 44));
    await settle();

    assert.equal(unpackPlayer(host.room.others[0].state).hp, 44);
    assert.equal(unpackPlayer(guest.room.others[0].state).hp, 90);
    assert.deepEqual(host.room.partyPositions({ x: 0, y: 0, z: 0 })[1], { x: 30, y: 1, z: -30 });
    host.room.leave(); guest.room.leave();
});

test("the host's world reaches guests: shadows, clock, tally, match", async () => {
    const { host, guests } = await party(2);
    const wire = [1, 2, 3];
    host.room.publishWorld(wire, 123.456, 7, { phase: 2, timer: 9.87 }, [4, 5], 1);
    wire[0] = 99; // the pools reuse their arrays
    await settle();
    const seen = guests[0].seen;
    assert.deepEqual(seen.monsters.at(-1), [[1, 2, 3], 7]);
    assert.equal(seen.clocks.at(-1), 123.5, "quantised, because nobody can see a millisecond");
    host.room.leave(); guests[0].room.leave();
});

test("events reach the right client: hits and match requests only the host", async () => {
    const { host, guests } = await party(3);
    const [a, b] = guests;
    a.room.reportMonsterHit(3, 2, "w");
    a.room.requestMatch(true);
    a.room.castSpell(1, [0.70710678, 0, 0.70710678]);
    a.room.throwBall([1, 2, 3, 4, 5, 6]);
    await settle();

    assert.deepEqual(host.seen.hits, [[3, 2, "w"]]);
    assert.deepEqual(host.seen.match, [true]);
    assert.deepEqual(b.seen.hits, [], "guests never resolve hits");
    for (const who of [host, b]) {
        assert.deepEqual(who.seen.casts, [[1, [0.707, 0, 0.707], a.room.selfId]]);
        assert.deepEqual(who.seen.balls, [[[1, 2, 3, 4, 5, 6], a.room.selfId]]);
    }
    assert.deepEqual(a.seen.casts, [], "never back to the caster");
    for (const g of [host, ...guests]) g.room.leave();
});

test("duel damage lands only on the body it was aimed at, and only in a duel", async () => {
    const { host, guests } = await party(3);
    const [a, b] = guests;
    a.room.sendPlayerDamage(b.room.selfId, 18);
    await settle();
    assert.deepEqual(b.seen.hurts, [], "friendly fire is off by default");

    host.room.setDuel(true);
    await settle();
    assert.equal(a.room.duel, true, "the mode travels with the roster");

    a.room.sendPlayerDamage(b.room.selfId, 18);
    host.room.sendPlayerDamage(a.room.selfId, 7);
    b.room.sendPlayerDamage(host.room.selfId, 5);
    await settle();
    assert.deepEqual(b.seen.hurts, [[18, a.room.selfId]]);
    assert.deepEqual(a.seen.hurts, [[7, host.room.selfId]]);
    assert.deepEqual(host.seen.hurts, [[5, b.room.selfId]]);
    for (const g of [host, ...guests]) g.room.leave();
});

test("a full room turns the fifth player away", async () => {
    const { server, code, host, guests } = await party(MAX_PLAYERS);
    assert.equal(host.room.count, MAX_PLAYERS);
    const late = new Room({}, server.options);
    await assert.rejects(late.join(code, "늦은친구"), { message: "방이 가득 찼어요 (최대 4명)." });
    assert.equal(late.active, false);
    assert.equal(host.room.count, MAX_PLAYERS, "nobody was displaced");
    for (const g of [host, ...guests]) g.room.leave();
});

test("a wrong code says so in Korean", async () => {
    const server = hub();
    const room = new Room({}, server.options);
    await assert.rejects(room.join("NOPE22", "나"), { message: "그 코드의 방을 찾지 못했어요." });
    await assert.rejects(room.join("abc", "나"), { message: "방 코드는 여섯 글자예요." });
});

test("a guest leaving is dropped from everyone's roster", async () => {
    const { host, guests } = await party(3);
    const [a, b] = guests;
    a.room.leave();
    await settle();
    assert.deepEqual(host.seen.rosters.at(-1), ["방장", "친구2"]);
    assert.deepEqual(b.seen.rosters.at(-1), ["방장", "친구2"]);
    assert.deepEqual(a.seen.status.at(-1), ["closed"]);
    host.room.leave(); b.room.leave();
});

test("the host leaving ends the room for every guest with a clear reason", async () => {
    const { host, guests } = await party(3);
    host.room.leave();
    await settle();
    for (const g of guests) {
        assert.deepEqual(g.seen.status.at(-1), ["closed", HOST_LEFT]);
        assert.equal(g.room.active, false);
        assert.equal(g.room.players.size, 0);
    }
});

test("a guest whose network dies is told, and the host lets them go", async () => {
    const { server, host, guests } = await party(2);
    const g = guests[0];
    server.sockets.find((s) => s.id === g.room.selfId).drop();
    await settle();
    assert.deepEqual(g.seen.status.at(-1), ["closed", "인터넷 연결이 끊겼어요."]);
    assert.equal(g.room.active, false);
    assert.deepEqual(host.seen.rosters.at(-1), ["방장"]);
    host.room.leave();
});

test("a busy frame loop never sends more than one packet per gap", async () => {
    const { server, host, guests } = await party(2);
    const g = guests[0];
    server.log.packets.length = 0;
    const started = Date.now();
    // A frame every 4 ms for a second, everything firing every frame — far
    // more than the game ever does.
    while (Date.now() - started < 1000) {
        g.room.publishSelf(...body(Math.random() * 10));
        g.room.castSpell(2, [1]);
        g.room.reportMonsterHit(1, 1);
        host.room.publishSelf(...body(1));
        host.room.publishWorld([1, 2], 1, 0, null, [], 0);
        await wait(4);
    }
    await settle();
    const span = (Date.now() - started) / 1000;
    for (const id of [host.room.selfId, g.room.selfId]) {
        const mine = server.log.packets.filter((p) => p.from === id);
        const rate = mine.length / span;
        assert.ok(rate <= 1000 / SEND_GAP + 1, `${id}: ${rate.toFixed(1)}/s`);
        assert.ok(rate < 30, "under the server's 30 a second");
    }
    // Nothing was thrown away to keep under it.
    const casts = server.log.packets.filter((p) => p.from === g.room.selfId)
        .flatMap((p) => p.data.e ?? []).filter((e) => e.t === "cast").length;
    assert.equal(host.seen.casts.length, casts);
    assert.ok(casts > 200, `every cast arrived (${casts})`);
    host.room.leave(); g.room.leave();
});

test("a burst of events too big for one packet is split, never cut", async () => {
    const { server, host, guests } = await party(2);
    const g = guests[0];
    server.log.packets.length = 0;
    // 600 casts with long parameter lists: far more than 16KB in one go.
    for (let i = 0; i < 600; i++) g.room.castSpell(i % 9, [i, 0.123, 0.456, 0.789, 1.234, 5.678]);
    g.room.reportMonsterHit(4, 2);
    await wait(SEND_GAP * 12);
    assert.equal(host.seen.casts.length, 600);
    assert.deepEqual(host.seen.casts.map((c) => c[1][0]), [...Array(600).keys()], "in order");
    assert.deepEqual(host.seen.hits, [[4, 2, "m"]]);
    const mine = server.log.packets.filter((p) => p.from === g.room.selfId);
    assert.ok(mine.length > 1, `split into ${mine.length} packets`);
    for (const p of mine) assert.ok(JSON.stringify(p.data).length < 16 * 1024);
    host.room.leave(); g.room.leave();
});

test("waiting alone sends nothing", async () => {
    const server = hub();
    const room = new Room({}, server.options);
    await room.host("혼자");
    for (let i = 0; i < 10; i++) { room.publishSelf(...body(i)); room.castSpell(1, [1]); await wait(10); }
    await settle();
    assert.equal(server.log.packets.length, 0);
    room.leave();
});

test("STATE_STRIDE matches what publishSelf writes", async () => {
    const { host, guests } = await party(2);
    host.room.publishSelf(...body(1));
    await settle();
    assert.equal(guests[0].room.others[0].state.length, STATE_STRIDE);
    host.room.leave(); guests[0].room.leave();
});
