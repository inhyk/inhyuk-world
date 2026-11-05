// 같이 사는 동네 (shared town): pure rules, testable with node --test (online.test.mjs).
// The browser side (World connection, avatars, chat) is src/town.js.
//
// Cells in the shared World (packages/net/world.mjs):
//   b|<x>|<y.toFixed(2)>|<z>  → { i: blockId, r: rot }   a placed block (owner = who placed it)
//   p|<propKey>               → 1, ttl 600 s             a broken tree / bush / shell (grows back)
// Poses are number arrays: [mode, x, y, z, yaw, kid] (HIDDEN = [4], no position at all).

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

/** {mode, x, y, z, yaw, kid} → compact array (mode name or number). */
export function packPose({ mode = 'idle', x = 0, y = 0, z = 0, yaw = 0, kid = false } = {}) {
  const m = typeof mode === 'number' ? mode : MODE[mode] ?? 0;
  if (m === MODE.hidden) return HIDDEN.slice();
  const a = ((yaw % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  return [m, r2(x), r2(y), r2(z), Math.round(a * 1000) / 1000, kid ? 1 : 0];
}
/** Array from another player → {mode, x, y, z, yaw, kid, hidden}, or null if it is not a pose. */
export function unpackPose(d) {
  if (!Array.isArray(d) || d.length < 1 || d.length > 8) return null;
  const m = d[0];
  if (!Number.isInteger(m) || m < 0 || m >= MODE_NAMES.length) return null;
  if (m === MODE.hidden) return { mode: 'hidden', hidden: true };
  const [, x, y, z, yaw, kid] = d;
  if (![x, y, z, yaw].every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < LIMIT)) return null;
  return { mode: MODE_NAMES[m], x, y, z, yaw, kid: kid === 1, hidden: false };
}
export function samePose(a, b) { return !!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]); }

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
};
/** Short Korean toast for a World error code on a block cell, or null to stay quiet. */
export function placeErrorText(code) {
  return { taken: TEXT.taken, limit: TEXT.limit, 'world-full': TEXT.worldFull, rate: TEXT.tooFast, 'limit-day': TEXT.limitDay, bad: TEXT.failed, 'too-big': TEXT.failed }[code] ?? null;
}
