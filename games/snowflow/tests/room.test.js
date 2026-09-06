import test from "node:test";
import assert from "node:assert/strict";
import {
    Room, MAX_PLAYERS, STATE_STRIDE, generateCode, normaliseCode, trimName, unpackPlayer,
} from "../src/net/room.js";

/**
 * The transport needs a browser; the protocol does not. These drive the
 * message handlers directly with fake connections, which is where every bug
 * that actually bit during development lived — roster drift, a body drawn at
 * the origin before its first packet, a hit resolved by the wrong client.
 */
function fakeConnection(peer) {
    const sent = [];
    const handlers = new Map();
    const conn = {
        peer, open: true, sent,
        send: (msg) => sent.push(msg),
        close() { this.open = false; handlers.get("close")?.(); },
        on(event, fn) {
            handlers.set(event, fn);
            // PeerJS fires "open" as soon as the channel is up; here it already is.
            if (event === "open") fn();
            return conn;
        },
        emit(event, ...args) { handlers.get(event)?.(...args); },
    };
    return conn;
}

function hostRoom(hooks = {}) {
    const room = new Room(hooks);
    room.isHost = true;
    room.code = "ABCDE";
    room.selfId = "snowflow-room-abcde";
    room.players.set(room.selfId, {
        id: room.selfId, name: "호스트", colorIndex: 0, isHost: true,
        state: new Array(STATE_STRIDE).fill(0), hasState: true, lastSeen: Date.now(),
    });
    return room;
}

test("room codes are five unambiguous characters, and typing is forgiving", () => {
    for (let i = 0; i < 50; i++) {
        const code = generateCode();
        assert.match(code, /^[A-HJ-NP-Z2-9]{5}$/, code);
    }
    assert.equal(normaliseCode(" ab-cd e "), "ABCDE");
    assert.equal(normaliseCode("abcdefgh"), "ABCDE");
    assert.equal(normaliseCode(null), "");
});

test("names are trimmed, capped and never empty", () => {
    assert.equal(trimName("  인혁   서  "), "인혁 서");
    assert.equal(trimName("a".repeat(40)).length, 10);
    assert.equal(trimName("   "), "이름없는 마법사");
});

test("a body is packed and unpacked without losing the flags", () => {
    const state = [1.23, 4.56, -7.89, 0.5, 1, 0.75, 62, 1 | (7 << 1)];
    const body = unpackPlayer(state);
    assert.equal(body.x, 1.23);
    assert.equal(body.z, -7.89);
    assert.equal(body.hp, 62);
    assert.equal(body.downed, true);
    assert.equal(body.castKey, 7);
    assert.equal(unpackPlayer([0, 0, 0, 0, 0, 0, 100, 0]).downed, false);
});

test("a guest joins, is drawn only after its first body, and leaves cleanly", () => {
    const rosters = [];
    const room = hostRoom({ onRoster: (players) => rosters.push(players.length) });
    const conn = fakeConnection("guest-1");

    room._acceptGuest(conn);
    room._onGuestMessage(conn, { t: "hello", name: "친구" });
    assert.equal(room.players.size, 2);
    assert.equal(room.players.get("guest-1").hasState, false, "not drawn yet");
    assert.equal(room.others.length, 1);
    assert.notEqual(room.players.get("guest-1").colorIndex, 0, "colours do not collide");

    room._onGuestMessage(conn, { t: "state", s: [1, 2, 3, 0, 0, 0, 90, 0] });
    assert.equal(room.players.get("guest-1").hasState, true);
    assert.equal(unpackPlayer(room.others[0].state).hp, 90);

    room._onGuestMessage(conn, { t: "bye" });
    assert.equal(room.players.size, 1);
    // Two announcements: the join and the leave. The host's own arrival is
    // announced by `host()`, which these tests stand in for.
    assert.deepEqual(rosters, [2, 1]);
});

test("a full room turns the fifth player away instead of dropping someone", () => {
    const room = hostRoom();
    for (let i = 1; i < MAX_PLAYERS; i++) {
        const conn = fakeConnection(`guest-${i}`);
        room._acceptGuest(conn);
        room._onGuestMessage(conn, { t: "hello", name: `친구${i}` });
    }
    assert.equal(room.players.size, MAX_PLAYERS);
    assert.ok(room.full);

    const extra = fakeConnection("guest-late");
    room._acceptGuest(extra);
    room._onGuestMessage(extra, { t: "hello", name: "늦은친구" });
    assert.equal(room.players.size, MAX_PLAYERS, "nobody was displaced");
    assert.equal(extra.sent.at(-1).t, "denied");
});

test("a reported hit reaches the host, and duel damage is only ever forwarded", () => {
    const hits = [];
    const hurts = [];
    const room = hostRoom({
        onMonsterHit: (id, d) => hits.push([id, d]),
        onHurt: (d, from) => hurts.push([d, from]),
    });
    const a = fakeConnection("guest-a");
    const b = fakeConnection("guest-b");
    for (const conn of [a, b]) {
        room._acceptGuest(conn);
        room._onGuestMessage(conn, { t: "hello", name: conn.peer });
    }

    room._onGuestMessage(a, { t: "hit", id: 3, d: 2 });
    assert.deepEqual(hits, [[3, 2]]);

    // Aimed at the host: the host's own body resolves it.
    room._onGuestMessage(a, { t: "pvp", target: room.selfId, d: 18 });
    assert.deepEqual(hurts, [[18, "guest-a"]]);

    // Aimed at another guest: relayed untouched, never resolved here.
    room._onGuestMessage(a, { t: "pvp", target: "guest-b", d: 18 });
    assert.equal(hurts.length, 1, "the host does not apply damage for others");
    assert.deepEqual(b.sent.at(-1), { t: "pvp", target: "guest-b", d: 18, from: "guest-a" });
});

test("the party the shadows spawn around holds only bodies that have arrived", () => {
    const room = hostRoom();
    room.peer = { destroyed: false }; // `active` without a real socket
    const conn = fakeConnection("guest-1");
    room._acceptGuest(conn);
    room._onGuestMessage(conn, { t: "hello", name: "친구" });

    const me = { x: 0, y: 0, z: 0 };
    assert.deepEqual(room.partyPositions(me), [me], "a silent guest is not a spawn anchor");

    room._onGuestMessage(conn, { t: "state", s: [30, 1, -12, 0, 0, 0, 100, 0] });
    const party = room.partyPositions(me);
    assert.equal(party.length, 2);
    assert.deepEqual(party[1], { x: 30, y: 1, z: -12 });
});

test("a guest adopts the host's roster and drops anyone missing from it", () => {
    const room = new Room();
    room.selfId = "guest-me";
    room.peer = { destroyed: false };
    room._onHostMessage({
        t: "roster", duel: true, host: "host-1",
        roster: [
            { id: "host-1", name: "방장", colorIndex: 0, isHost: true },
            { id: "guest-me", name: "나", colorIndex: 1, isHost: false },
            { id: "guest-2", name: "친구", colorIndex: 2, isHost: false },
        ],
    });
    assert.equal(room.players.size, 3);
    assert.equal(room.duel, true);
    assert.equal(room.others.length, 2, "you are never in your own pool");

    room._onHostMessage({ t: "players", p: [["guest-2", [5, 0, 5, 0, 0, 0, 44, 0]]] });
    assert.equal(room.players.get("guest-2").hasState, true);
    assert.equal(unpackPlayer(room.players.get("guest-2").state).hp, 44);

    room._onHostMessage({
        t: "roster", duel: false, host: "host-1",
        roster: [{ id: "host-1", name: "방장", colorIndex: 0, isHost: true },
            { id: "guest-me", name: "나", colorIndex: 1, isHost: false }],
    });
    assert.equal(room.players.has("guest-2"), false);
    assert.equal(room.duel, false);
});

test("the host's world message carries the shadows, the clock and the tally", () => {
    const room = hostRoom();
    room.peer = { destroyed: false };
    const conn = fakeConnection("guest-1");
    room._connections.set("guest-1", conn);

    room.publishWorld([1, 2, 3], 123.456, 7);
    const message = conn.sent.at(-1);
    assert.equal(message.t, "world");
    assert.deepEqual(message.m, [1, 2, 3]);
    assert.equal(message.c, 123.5, "quantised, because nobody can see a millisecond");
    assert.equal(message.d, 7);
});

test("in a two-player room a hit lands on the body that owns it, both ways", () => {
    const hostHurts = [];
    const guestHurts = [];
    const host = hostRoom({ onHurt: (d, from) => hostHurts.push([d, from]) });
    host.peer = { destroyed: false };
    host.duel = true;

    const guest = new Room({ onHurt: (d, from) => guestHurts.push([d, from]) });
    guest.selfId = "guest-1";
    guest.peer = { destroyed: false };

    // Wire the two ends together: what the host writes down the connection is
    // what the guest reads, and what the guest writes up its link is what the
    // host reads.
    const conn = fakeConnection("guest-1");
    conn.send = (msg) => guest._onHostMessage(msg);
    host._acceptGuest(conn);
    host._onGuestMessage(conn, { t: "hello", name: "친구" });
    guest._uplink = { open: true, send: (msg) => host._onGuestMessage(conn, msg) };

    assert.equal(guest.duel, true, "the mode travels with the roster");

    host.sendPlayerDamage("guest-1", 18);
    assert.deepEqual(guestHurts, [[18, host.selfId]], "host → guest");
    assert.equal(hostHurts.length, 0, "and not back onto the caster");

    guest.sendPlayerDamage(host.selfId, 18);
    assert.deepEqual(hostHurts, [[18, "guest-1"]], "guest → host");
    assert.equal(guestHurts.length, 1);
});

test("outside a duel nothing is sent at all", () => {
    const hurts = [];
    const host = hostRoom({ onHurt: (d) => hurts.push(d) });
    host.peer = { destroyed: false };
    const conn = fakeConnection("guest-1");
    const seen = [];
    conn.send = (msg) => seen.push(msg.t);
    host._acceptGuest(conn);
    host._onGuestMessage(conn, { t: "hello", name: "친구" });

    host.sendPlayerDamage("guest-1", 18);
    assert.equal(seen.includes("pvp"), false, "friendly fire is off by default");

    host.setDuel(true);
    host.sendPlayerDamage("guest-1", 18);
    assert.equal(seen.includes("pvp"), true);
});
