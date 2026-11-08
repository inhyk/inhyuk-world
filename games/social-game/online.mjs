// 같이 사는 동네 (shared town): pure rules, testable with node --test (online.test.mjs).
// The browser side (World connection, avatars, chat) is src/town.js.
//
// Cells in the shared World (packages/net/world.mjs):
//   b|<x>|<y.toFixed(2)>|<z>  → { i: blockId, r: rot }   a placed block (owner = who placed it)
//   p|<propKey>               → 1, ttl 600 s             a broken tree / bush / shell (grows back)
// Poses are number arrays: [mode, x, y, z, yaw, kid] (HIDDEN = [4], no position at all).
// Slots 6 and 7 (clock, seats / ride / parked car) are explained at packPose.
import { poseAt } from './poses.mjs';

export const GAME = 'social-game';
export const TOWNS = ['town-1', 'town-2', 'town-3', 'town-4'];
export const PROP_TTL = 600;
export const KEY_RE = /^[A-Za-z0-9|._:-]{1,64}$/;
const ID_RE = /^[a-z0-9_-]{1,24}$/;

export function townId(n) { return TOWNS[(n | 0) - 1] ?? null; }
export function townName(id) { const i = TOWNS.indexOf(id); return i < 0 ? '동네' : `동네 ${i + 1}`; }

// ------------------------------------------------------------------ cell keys and values
const num = (s) => (s !== '' && Number.isFinite(Number(s)) ? Number(s) : NaN);

/** Same key the Build uses for its placed map, with the 'b|' prefix. */
export function blockKey(x, y, z) {
  const k = `b|${x}|${Number(y).toFixed(2)}|${z}`;
  return KEY_RE.test(k) ? k : null;
}
export function parseBlockKey(k) {
  if (typeof k !== 'string' || !k.startsWith('b|') || !KEY_RE.test(k)) return null;
  const p = k.split('|');
  if (p.length !== 4) return null;
  const x = num(p[1]), y = num(p[2]), z = num(p[3]);
  if (![x, y, z].every(Number.isFinite)) return null;
  return { x, y, z };
}
/** Build.key() of a town block key (drops the prefix). */
export function buildKeyOf(k) { return k.slice(2); }

export function blockValue(id, rot = 0) { return { i: String(id), r: ((rot | 0) % 4 + 4) % 4 }; }
/** Validated block value, or null. known: Set or object of block ids that exist. */
export function parseBlockValue(v, known) {
  if (!v || typeof v !== 'object' || typeof v.i !== 'string' || !ID_RE.test(v.i)) return null;
  if (known && !(known instanceof Set ? known.has(v.i) : Object.hasOwn(known, v.i))) return null;
  const r = Number.isInteger(v.r) && v.r >= 0 && v.r < 4 ? v.r : 0;
  return { id: v.i, rot: r };
}

export function propKey(key) {
  if (typeof key !== 'string' || !key) return null;
  const k = `p|${key}`;
  return KEY_RE.test(k) ? k : null;
}
export function parsePropKey(k) { return typeof k === 'string' && k.startsWith('p|') && k.length > 2 ? k.slice(2) : null; }

/** Deterministic key for a scattered prop: kind and its index in that kind's Scatter. */
export function scatterKey(kind, index) { return `${kind}.${index}`; }

/** Does a cell entry still count (no exp, or exp in the future)? */
export function cellAlive(entry, now = Date.now()) { return !!entry && (typeof entry.exp !== 'number' || entry.exp > now); }

// ------------------------------------------------------------------ poses
export const MODE = { idle: 0, walk: 1, run: 2, drive: 3, hidden: 4 };
const MODE_NAMES = ['idle', 'walk', 'run', 'drive', 'hidden'];
export const HIDDEN = [MODE.hidden];
const LIMIT = 100000;
const r2 = (n) => Math.round(n * 100) / 100;

/**
 * {mode, x, y, z, yaw, kid, t, seats, ride} → compact array (mode name or number).
 * Slots 6 and 7 are read only by games that know riding (older ones read 0..5 and allow 8 numbers):
 *   [6] t     the sender's clock in centiseconds (mod 1,000,000), so others can play a car back smoothly
 *   [7] link  a driver who takes riders: [p0, p1, p2] peer numbers in the 3 seats (0 = empty)
 *             a rider: the peer number of the driver whose car I want to ride in / ride in
 *             standing still in a pose (not riding): minus the pose number (-1 = 👋, poses.mjs POSES)
 *             anyone else on foot: [x, y, z, yaw] where my own car is parked, so friends see it standing
 *             there and bump into it (games before this read only a peer number here and ignore it).
 *             While I pose, the car is left out and friends keep it where they last saw it.
 */
export function packPose({ mode = 'idle', x = 0, y = 0, z = 0, yaw = 0, kid = false, t, seats, ride, car, pose } = {}) {
  const m = typeof mode === 'number' ? mode : MODE[mode] ?? 0;
  if (m === MODE.hidden) return HIDDEN.slice();
  const d = [m, r2(x), r2(y), r2(z), wrapYaw(yaw), kid ? 1 : 0];
  const link = m === MODE.drive ? cleanSeats(seats) : peerNumOk(ride) ? ride : m === MODE.idle && poseAt(pose) ? -pose : carSlot(car);
  if (t !== undefined || link !== null) d.push(Number.isFinite(t) && t > 0 ? Math.round(t) % CLOCK_WRAP : 0);
  if (link !== null) d.push(link);
  return d;
}
const CLOCK_WRAP = 1000000;
const wrapYaw = (yaw) => Math.round((((yaw % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI) * 1000) / 1000;
const okNum = (n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < LIMIT;
/** {x, y, z, yaw} of a parked car → [x, y, z, yaw] (or null). */
function carSlot(c) {
  if (!c || ![c.x, c.y, c.z, c.yaw].every(okNum)) return null;
  return [r2(c.x), r2(c.y), r2(c.z), wrapYaw(c.yaw)];
}
const peerNumOk = (n) => Number.isInteger(n) && n > 0 && n < 1e9;
function cleanSeats(s) {
  if (!Array.isArray(s) || s.length !== SEATS) return null;
  return s.map((n) => (peerNumOk(n) ? n : 0));
}
/** Array from another player → {mode, x, y, z, yaw, kid, hidden, t, seats, ride, car, pose}, or null if it is not a pose. */
export function unpackPose(d) {
  if (!Array.isArray(d) || d.length < 1 || d.length > 8) return null;
  const m = d[0];
  if (!Number.isInteger(m) || m < 0 || m >= MODE_NAMES.length) return null;
  if (m === MODE.hidden) return { mode: 'hidden', hidden: true };
  const [, x, y, z, yaw, kid, t, link] = d;
  if (![x, y, z, yaw].every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < LIMIT)) return null;
  const drive = m === MODE.drive;
  return {
    mode: MODE_NAMES[m], x, y, z, yaw, kid: kid === 1, hidden: false,
    t: Number.isInteger(t) && t > 0 && t < CLOCK_WRAP ? t : null,
    seats: drive && Array.isArray(link) && link.length === SEATS && link.every((n) => n === 0 || peerNumOk(n)) ? link.slice() : null,
    ride: !drive && peerNumOk(link) ? link : 0,
    car: !drive && Array.isArray(link) && link.length === 4 && link.every(okNum) ? { x: link[0], y: link[1], z: link[2], yaw: link[3] } : null,
    pose: m === MODE.idle && Number.isInteger(link) && poseAt(-link) ? -link : 0,
  };
}
/** Same pose, not counting the clock (slot 6): a player standing still sends once a second only. */
export function samePose(a, b) {
  const eq = (u, v) => u === v || (Array.isArray(u) && Array.isArray(v) && u.length === v.length && u.every((w, i) => w === v[i]));
  return !!a && !!b && a.length === b.length && a.every((v, i) => i === 6 || eq(v, b[i]));
}

/** Shortest-way angle blend. */
export function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
/** Smoothing factor for following a target at `rate` per second (frame-rate independent). */
export function follow(dt, rate = 12) { return 1 - Math.exp(-dt * rate); }
export const SNAP_DIST = 25; // teleports (elevator, flight, waking up) jump instead of sliding

// ------------------------------------------------------------------ riding in a friend's car
// The DRIVER's computer owns the seats: a friend's pose names the driver (link = driver's peer number),
// the driver seats them (front passenger seat first, then the two rear seats) and sends the seat list in
// its own pose. A friend only sits down once it sees itself in that list, so two can never share a seat.
// Nothing extra is sent: asking, sitting and getting out all ride on the poses that go out anyway.
export const SEATS = 3;
/** Car-local spots (sedan, forward = -Z): [x, hip height, z]. Seats 0 front right, 1 rear left, 2 rear right. */
export const SEAT_POS = [[0.37, 0.5, 0.2], [-0.42, 0.5, 1.0], [0.42, 0.5, 1.0]];
export const DRIVER_POS = [-0.37, 0.5, 0.2];
export const RIDE_NEAR = 4.5;   // metres from the friend's car to ask
export const RIDE_SLOW = 3;     // m/s: get in and out only when the car has (nearly) stopped
export const RIDE_WAIT = 4000;  // ms an ask waits for a seat
export const RIDE_STALE = 4000; // ms without news from the driver: get out

/** Server peer id 'p12' → 12 (0 if it is not one). */
export function peerNum(id) { const m = /^p(\d{1,9})$/.exec(typeof id === 'string' ? id : ''); return m ? Number(m[1]) : 0; }

/**
 * Driver side, every frame. seats: [p0, p1, p2] now. riders: people whose pose names me, oldest ask first:
 *   { n, asking, near, blocked, hidden }  (hidden: in a private place; keeps a seat but never gets a new one)
 * open: I am driving. slow: my car is slow enough to get in.
 * → { seats, added: [n], removed: [n] }
 */
export function assignSeats(seats, riders, { open = true, slow = true } = {}) {
  const before = cleanSeats(seats) ?? [0, 0, 0];
  const next = [0, 0, 0];
  const byN = new Map(riders.map((r) => [r.n, r]));
  if (open) {
    for (let i = 0; i < SEATS; i++) {
      const r = byN.get(before[i]);
      if (r && r.asking && !r.blocked) next[i] = r.n;
    }
    if (slow) {
      for (const r of riders) {
        if (!r.asking || r.blocked || !r.near || r.hidden || !peerNumOk(r.n) || next.includes(r.n)) continue;
        const i = next.indexOf(0);
        if (i < 0) break;
        next[i] = r.n;
      }
    }
  }
  return { seats: next, added: next.filter((n) => n && !before.includes(n)), removed: before.filter((n) => n && !next.includes(n)) };
}

/** My seat in a driver's list: 0..2, or -1. */
export function seatOf(seats, me) { return peerNumOk(me) && Array.isArray(seats) ? seats.indexOf(me) : -1; }

/**
 * Passenger side, every frame. ride: { seat: -1 | 0..2, askedAt, lastAt (ms of the driver's last pose) }.
 * pose: the driver's last unpacked pose (or null). gone: the driver left or is blocked.
 * → { what: 'wait' | 'seated' | 'ride' | 'full' | 'closed' | 'out', seat }
 *   seated: just got a seat. full / closed: stop asking (no seat / car not taking riders). out: put out.
 */
export function rideStep(ride, pose, me, now, gone = false) {
  const seated = ride.seat >= 0;
  const stale = now - (ride.lastAt ?? 0) > RIDE_STALE;
  if (gone || stale || !pose || pose.hidden || pose.mode !== 'drive' || !pose.seats) {
    if (seated) return { what: 'out', seat: -1 };
    if (!gone && !stale && pose && !pose.hidden && pose.mode === 'drive' && !pose.seats) return { what: 'closed', seat: -1 };
    return { what: gone || now - ride.askedAt > RIDE_WAIT ? (pose?.mode === 'drive' ? 'full' : 'closed') : 'wait', seat: -1 };
  }
  const i = seatOf(pose.seats, me);
  if (i >= 0) return { what: seated ? 'ride' : 'seated', seat: i };
  if (seated) return { what: 'out', seat: -1 };
  return { what: now - ride.askedAt > RIDE_WAIT ? 'full' : 'wait', seat: -1 };
}

// ------------------------------------------------------------------ cars are solid
// 인혁: "같은 동네에서 만난 사람의 차끼리 안 붙어(그냥 통과) 붙이게 해줘". Each computer still moves only its own
// player and car. Friends' cars (driven or parked) and friends on foot become solid circles on my computer,
// made from the poses that come anyway: my car bumps into them (no damage), I cannot walk through a friend's
// car, and a friend's car that drives onto me nudges me aside. Nothing new is sent to the server.
export const CAR_HALF = { w: 0.99, l: 2.31 }; // the sedan everyone drives
// a friend on foot: small enough that someone standing against a friend's car (its boxes are 0.91 m from the
// middle, the walker 0.3 m wide) does not shove that car when its driver gets in: 0.99 + 0.22 <= 0.91 + 0.3
export const PERSON_R = 0.22;
export const GHOST_IN = 0.4;   // m: a parked car this deep inside another one is a ghost (not drawn, not solid)…
export const GHOST_OUT = 0.5;  // m: …until there is this much room between them
/** Three circles along a car (back, middle, front), the same as Vehicle.circles(). */
export function carCircles(x, z, yaw, half = CAR_HALF, scale = 1) {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), k = half.l - half.w;
  return [-1, 0, 1].map((s) => ({ x: x + fx * s * k, z: z + fz * s * k, r: half.w * scale }));
}
/** How deep two lists of circles overlap, in metres (negative: the gap between them). */
export function overlap(a, b) {
  let best = -Infinity;
  for (const p of a) for (const q of b) best = Math.max(best, p.r + q.r - Math.hypot(p.x - q.x, p.z - q.z));
  return best;
}
/**
 * How far to move a group of circles (one car, or one person) out of solid circles {x, z, r, person}.
 * → { x, z, car, person }: the push, and whether a car / a person was hit.
 */
export function pushOut(circles, solids) {
  let x = 0, z = 0, car = false, person = false;
  for (const c of circles) {
    for (const s of solids) {
      const dx = c.x + x - s.x, dz = c.z + z - s.z, d = Math.hypot(dx, dz), r = c.r + s.r;
      if (d >= r) continue;
      const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0; // exactly on top: out along x
      x += nx * (r - d); z += nz * (r - d);
      if (s.person) person = true; else car = true;
    }
  }
  return { x, z, car, person };
}
/**
 * Everyone's car starts in the same parking spot at home, so a friend's PARKED car can stand right on mine.
 * Such a car is a ghost (not drawn, not solid) until the cars are apart. was: ghost last frame; over: overlap().
 */
export function ghostStep(was, over) { return over > GHOST_IN || (was && over > -GHOST_OUT); }
/**
 * Solid things on my computer from what I see of the others, every frame. Each friend:
 *   { car: {x, y, z, yaw} | null   their car where it is drawn (driven, or parked and not a ghost)
 *     foot: {x, y, z, kid} | null  where they stand (newest pose) when they are drawn on foot (null when driving)
 *     seated: bool, ride: number }   in a car seat / asking to ride: never solid (they belong inside a car)
 * → [{ x, z, r, y, person }] (y: ground height, to skip things on another floor)
 */
export function friendSolids(friends, half = CAR_HALF) {
  const out = [];
  for (const f of friends) {
    if (f.car) for (const c of carCircles(f.car.x, f.car.z, f.car.yaw, half)) out.push({ ...c, y: f.car.y, person: false });
    if (f.foot && !f.seated && !f.ride) out.push({ x: f.foot.x, z: f.foot.z, r: f.foot.kid ? PERSON_R * 0.75 : PERSON_R, y: f.foot.y, person: true });
  }
  return out;
}

/**
 * Plays another player's poses back a little in the past, between the two poses around that time, using the
 * sender's clock (slot 6) so a car glides at an even speed even though poses arrive unevenly (~10 a second).
 */
export class PoseTrack {
  constructor(delay = 150) { this.delay = delay; this.list = []; this.offset = 0; this.err = null; this.at = null; }
  reset() { this.list = []; this.err = null; }
  /** pose: unpacked pose with t (centiseconds); now: my clock in ms. */
  push(p, now) {
    if (!p || p.hidden || !p.t) { this.reset(); return; }
    const st = p.t * 10;
    const last = this.list.at(-1);
    if (last && st <= last.st) {
      if (last.st - st < 1000) return; // late or doubled
      this.reset();                    // their page started again (or the clock wrapped)
    }
    if (last && Math.hypot(p.x - last.x, p.z - last.z) > SNAP_DIST) this.reset(); // teleport
    // a pose that bends the path (late after a pause, a turn) must not make what is on screen jump:
    // the jump goes into an error that fades away over a moment
    const before = this.list.length && this.at !== null ? this.raw(this.at) : null;
    const off = now - st;
    if (!this.list.length || off < this.offset) this.offset = off; // the quickest delivery so far
    else this.offset += (off - this.offset) * 0.02;                // slowly allow for a slower line
    this.list.push({ st, x: p.x, y: p.y, z: p.z, yaw: p.yaw });
    if (this.list.length > 24) this.list.shift();
    if (before) {
      const after = this.raw(this.at), e = this.err ?? { x: 0, y: 0, z: 0, yaw: 0 };
      this.err = { x: e.x + before.x - after.x, y: e.y + before.y - after.y, z: e.z + before.z - after.z, yaw: e.yaw + lerpAngle(after.yaw, before.yaw, 1) - after.yaw };
    }
  }
  get ready() { return this.list.length > 0; }
  /** Position on the path at my time `now` (no smoothing). */
  raw(now) {
    const L = this.list;
    const rt = now - this.offset - this.delay;
    const a0 = L[0];
    if (L.length === 1 || rt <= a0.st) return { x: a0.x, y: a0.y, z: a0.z, yaw: a0.yaw, speed: 0 };
    let i = L.length - 2;
    while (i > 0 && L[i].st > rt) i--;
    const a = L[i], b = L[i + 1];
    const span = Math.max(1, b.st - a.st);
    const speed = Math.hypot(b.x - a.x, b.z - a.z) / (span / 1000);
    // past the newest pose: wait there (guessing ahead would have to slide back when the car had slowed)
    const k = Math.min(1, (rt - a.st) / span);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, yaw: lerpAngle(a.yaw, b.yaw, k), speed: speed > 60 || rt > b.st + 250 ? 0 : speed };
  }
  /** → {x, y, z, yaw, speed} at my time `now`, or null. */
  sample(now) {
    if (!this.list.length) return null;
    const r = this.raw(now);
    const dt = this.at === null ? 0 : Math.max(0, now - this.at) / 1000;
    this.at = now;
    const e = this.err;
    if (!e) return r;
    const f = Math.exp(-dt * 7);
    e.x *= f; e.y *= f; e.z *= f; e.yaw *= f;
    if (Math.abs(e.x) + Math.abs(e.y) + Math.abs(e.z) + Math.abs(e.yaw) < 1e-3) this.err = null;
    return { x: r.x + e.x, y: r.y + e.y, z: r.z + e.z, yaw: r.yaw + e.yaw, speed: r.speed };
  }
}

// ------------------------------------------------------------------ privacy
// Places where a player is never shown to others: our home (apartment 101동 lobby, 8층 hall,
// 802호, or the fallback house), and the rooms people sleep in on trips.
export const PRIVATE_SITES = new Set(['home', 'pension', 'ryokan']);
/**
 * site: places.inside(pos) result; box: world {min, max} of the home tower footprint (or null).
 * Anywhere inside the home tower's footprint counts (elevator shaft, stairs, porch), at any height.
 */
export function isPrivate(site, pos, box = null) {
  if (site && PRIVATE_SITES.has(site)) return true;
  if (box && pos && pos.x > box.min[0] && pos.x < box.max[0] && pos.z > box.min[2] && pos.z < box.max[2]) return true;
  return false;
}

// ------------------------------------------------------------------ looks from the user id
const HAIRS = ['short', 'spiky', 'bob', 'long', 'bun'];
const HAIR_COLORS = [0x221a16, 0x3b2a20, 0x5a3a24, 0x1c1714, 0x6a4a2a];
const OUTFITS = ['casual', 'office', 'beach', 'suit', 'casual', 'chef'];
const CAR_COLORS = [0xd84f4f, 0x4fb86a, 0xf2c230, 0x8a5fd8, 0xf28a3a, 0x3ab8c8, 0xe8e8e8, 0x3a3f48];
export function lookFor(userId) {
  const n = Math.abs(Number(userId) | 0);
  const h = (n * 2654435761) >>> 0;
  return {
    hair: HAIRS[h % HAIRS.length],
    hairColor: HAIR_COLORS[(h >>> 3) % HAIR_COLORS.length],
    outfit: OUTFITS[(h >>> 6) % OUTFITS.length],
    seed: 100 + (n % 1000),
    carColor: CAR_COLORS[(h >>> 9) % CAR_COLORS.length],
  };
}

// ------------------------------------------------------------------ solo blocks while online
/**
 * Keeps the personal (solo) blocks safe while the town's blocks are on screen.
 * The personal save must keep writing the solo list, never the town's.
 */
export class SoloBlocks {
  constructor() { this.saved = null; }
  get active() { return this.saved !== null; }
  /** Going online: remember the solo blocks (a copy of build.dump()). */
  enter(dump) {
    if (this.saved) return this.saved;
    this.saved = (dump ?? []).map(({ id, x, y, z, rot }) => ({ id, x, y, z, rot: rot ?? 0 }));
    return this.saved;
  }
  /** What the personal save should store: the remembered solo list while online. */
  forSave(current) { return this.saved ? this.saved.map((b) => ({ ...b })) : current; }
  /** Going back to solo: the list to put back. */
  leave() { const s = this.saved ?? []; this.saved = null; return s; }
}

// ------------------------------------------------------------------ texts
export const TEXT = {
  needLogin: '같이 하려면 먼저 로그인해요',
  joining: (name) => `${name}에 들어가는 중…`,
  joined: (name, n) => `${name}에 왔어요! ${n > 0 ? `친구 ${n}명이 있어요` : '아직 나 혼자예요'} 👋`,
  full: (name) => `${name}은(는) 꽉 찼어요. 다른 동네로 가 볼까요?`,
  notDeployed: '같이 사는 동네는 아직 준비 중이에요',
  left: '혼자 하기로 돌아왔어요',
  lost: '연결이 끊겼어요. 다시 들어가기를 눌러요',
  replaced: '다른 곳에서 이 동네에 들어갔어요',
  notMine: (nick) => `${nick} 님의 블럭이에요`,
  taken: '다른 친구가 먼저 놓았어요',
  limit: '동네에 놓을 수 있는 블럭을 다 썼어요 (400개)',
  worldFull: '동네에 블럭이 꽉 찼어요',
  failed: '블럭을 못 놓았어요. 다시 해 봐요',
  tooFast: '너무 빨라요. 천천히 놓아 봐요',
  limitDay: '오늘은 이 동네에서 블럭을 많이 바꿨어요. 내일 또 해요',
  joinRate: '너무 자주 들어왔어요. 1분 뒤에 다시 해 봐요',
  noWorld: '이 동네는 아직 없어요',
  chatRate: '조금 천천히 말해요',
  hello: (nick) => `${nick} 님이 왔어요`,
  bye: (nick) => `${nick} 님이 나갔어요`,
  rideAsk: (nick) => `${nick} 님 차에 타는 중…`,
  rideIn: (nick) => `${nick} 님 차에 탔어요! 🚗 E 내리기 · 마우스로 둘러보기`,
  rideGot: (nick) => `${nick} 님이 탔어요 🚗`,
  rideLeft: (nick) => `${nick} 님이 내렸어요`,
  rideFull: (nick) => `${nick} 님 차에 자리가 없어요`,
  rideClosed: (nick) => `${nick} 님 차에는 지금 탈 수 없어요`,
  rideOut: (nick) => `${nick} 님이 차에서 내려서 나도 내렸어요`,
  rideBye: '차에서 내렸어요',
  rideStop: '차가 멈추면 내릴 수 있어요',
  bumpCar: (nick) => `콩! ${nick} 님 차랑 부딪혔어요 (안 다쳐요)`,
  bumpPerson: (nick) => `앗, ${nick} 님이 앞에 있어서 멈췄어요`,
  ridePrompt: (nick) => `같이 타기 (${nick} 님 차)`,
};
/** Short Korean toast for a World error code on a block cell, or null to stay quiet. */
export function placeErrorText(code) {
  return { taken: TEXT.taken, limit: TEXT.limit, 'world-full': TEXT.worldFull, rate: TEXT.tooFast, 'limit-day': TEXT.limitDay, bad: TEXT.failed, 'too-big': TEXT.failed }[code] ?? null;
}
