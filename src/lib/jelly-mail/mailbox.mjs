// 젤리 타워 친구 우체통. 친구가 게임을 꺼 두었을 때 보낸 메시지·젤리 이모티콘·친구 신청을
// 잠깐 맡아 두었다가, 친구가 게임을 켜서 받아 가면 지운다 (안 받아 가도 7일 뒤 지운다).
//
// 친구 코드마다 "열쇠"(기기에만 있는 32글자 비밀 값)의 해시를 맡아 두고, 열쇠가 맞을 때만
// 그 코드로 보내거나 그 코드의 우체통을 열 수 있다. 그래서 다른 사람인 척 보내거나 남의 편지를 볼 수 없다.
// 친구인지·차단했는지는 받는 사람 기기가 판단한다 (차단한 사람의 편지는 조용히 버린다).
//
// 저장소는 같은 모양의 함수 몇 개만 있으면 된다:
//   - Vercel Blob (사이트 기본, 비공개 파일): 사람마다 우체통 파일 하나, ETag로 "안 바뀌었을 때만" 고쳐 써서 섞이지 않는다
//   - Upstash Redis (연결되어 있으면 이쪽을 쓴다)
//   - 메모리 (개발·테스트)
import { createHash, timingSafeEqual, randomBytes } from 'node:crypto';
import { cleanChat, cleanName, personalInfo, validFriendCode, validMailKey, validSticker } from '../../../games/puyo-puyo/chat.mjs';

export const BOX_MAX = 100;                 // 한 사람 우체통에 쌓이는 편지 수
export const BOX_TTL = 7 * 24 * 3600;       // 7일 (초)
export const KEY_TTL = 400 * 24 * 3600;     // (Redis) 열쇠는 400일 동안 안 쓰면 잊는다
export const KINDS = ['msg', 'st', 'fr', 'fa', 'fx']; // 메시지, 젤리 이모티콘, 친구 신청, 받기, 안 받기
export const LIMITS = { perMinute: 20, perDay: 300, perIpHour: 400, registerPerIpHour: 30 };

const hashKey = (code, key) => createHash('sha256').update(`jelly-mail:${code}:${key}`).digest('hex');
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const reply = (status, body) => ({ status, body });
const cleanId = id => (typeof id === 'string' && /^[a-z0-9]{8,24}$/.test(id) ? id : randomBytes(8).toString('hex'));
// 7일이 안 지난, 모양이 맞는 편지만 (오래된 것부터)
const freshLetters = (list, t) => (Array.isArray(list) ? list : [])
  .filter(l => l && typeof l === 'object' && validFriendCode(l.from) && KINDS.includes(l.kind) && Number.isFinite(l.t) && t - l.t < BOX_TTL * 1000)
  .sort((a, b) => a.t - b.t);

export function createMailbox(store, { now = () => Date.now() } = {}) {
  async function authorised(code, key) {
    if (!validFriendCode(code) || !validMailKey(key)) return false;
    return same(await store.getKey(code), hashKey(code, key));
  }

  async function hello({ code, key }, ip) {
    if (!validFriendCode(code) || !validMailKey(key)) return reply(400, { ok: false, error: 'bad' });
    const hashed = hashKey(code, key), pace = store.pace;
    const stored = await store.getKey(code);
    if (stored) {
      if (!same(stored, hashed)) return reply(409, { ok: false, error: 'taken' });
      await store.touchKey(code);
      return reply(200, { ok: true, pace });
    }
    if (!(await store.limit([[`reg:${ip}:${Math.floor(now() / 3600000)}`, LIMITS.registerPerIpHour, 3600]]))) return reply(429, { ok: false, error: 'limit' });
    if (await store.createKey(code, hashed)) return reply(200, { ok: true, created: true, pace });
    // 같은 순간에 누가 먼저 만들었다: 그게 내 열쇠인지 한 번만 다시 비교한다
    return same(await store.getKey(code), hashed) ? reply(200, { ok: true, pace }) : reply(409, { ok: false, error: 'taken' });
  }

  async function send(body, ip) {
    const { code, key, to, kind } = body;
    if (!(await authorised(code, key))) return reply(401, { ok: false, error: 'auth' });
    if (!validFriendCode(to) || to === code) return reply(400, { ok: false, error: 'to' });
    if (!KINDS.includes(kind)) return reply(400, { ok: false, error: 'kind' });
    const letter = { id: cleanId(body.id), from: code, kind, name: cleanName(body.name), level: Math.max(1, Math.min(999, Number(body.level) | 0)) };
    if (kind === 'msg') {
      if (personalInfo(body.text)) return reply(400, { ok: false, error: 'personal' });
      const text = cleanChat(body.text);
      if (!text) return reply(400, { ok: false, error: 'empty' });
      letter.text = text;
    } else if (kind === 'st') {
      const sticker = Number(body.sticker);
      if (!validSticker(sticker)) return reply(400, { ok: false, error: 'sticker' });
      letter.sticker = sticker;
    }
    const t = now(), minute = Math.floor(t / 60000), day = Math.floor(t / 86400000), hour = Math.floor(t / 3600000);
    if (!(await store.limit([
      [`m:${code}:${minute}`, LIMITS.perMinute, 120],
      [`d:${code}:${day}`, LIMITS.perDay, 2 * 86400],
      [`i:${ip}:${hour}`, LIMITS.perIpHour, 3600],
    ]))) return reply(429, { ok: false, error: 'limit' });
    letter.t = t;
    await store.addLetter(to, letter);
    // 친구 신청은 그 코드로 우체통을 연 사람이 있는지 알려 준다 (코드를 잘못 적었는지 알 수 있게)
    return reply(200, { ok: true, id: letter.id, t, ...(kind === 'fr' ? { known: await store.hasKey(to) } : {}) });
  }

  // 우체통 열기. ack(시각)를 주면 그 시각까지 받은 편지를 먼저 지운다
  async function inbox({ code, key, ack }) {
    if (!(await authorised(code, key))) return reply(401, { ok: false, error: 'auth' });
    const t = now(), upTo = Number(ack);
    if (Number.isFinite(upTo) && upTo > 0) await store.ack(code, Math.min(upTo, t));
    return reply(200, { ok: true, letters: await store.letters(code), now: t, pace: store.pace });
  }

  // 계정을 지우면 열쇠와 우체통도 지운다
  async function forget({ code, key }) {
    if (!(await authorised(code, key))) return reply(401, { ok: false, error: 'auth' });
    await store.forget(code);
    return reply(200, { ok: true });
  }

  return {
    async handle(body, { ip = 'local' } = {}) {
      if (!body || typeof body !== 'object') return reply(400, { ok: false, error: 'bad' });
      if (body.action === 'hello') return hello(body, ip);
      if (body.action === 'send') return send(body, ip);
      if (body.action === 'inbox') return inbox(body);
      if (body.action === 'forget') return forget(body);
      return reply(400, { ok: false, error: 'action' });
    },
    // 하루 한 번(크론): 7일이 지나도록 아무도 받아 가지 않은 우체통을 지운다
    cleanup: () => (store.cleanup ? store.cleanup() : Promise.resolve(0)),
  };
}

// ---------- Redis 저장소 (Upstash 또는 메모리) ----------
// run(명령 목록) → 결과 목록. 우체통은 시각 순서 집합(ZSET), 열쇠와 한도 세기는 보통 값.
export function redisStore(run, { now = () => Date.now() } = {}) {
  const box = code => `jm:box:${code}`, keyOf = code => `jm:key:${code}`;
  return {
    kind: 'redis',
    run,
    pace: { fast: 8000, slow: 40000 }, // 게임이 우체통을 여는 간격 (친구 화면·채팅 / 그 밖)
    async getKey(code) { const [v] = await run([['GET', keyOf(code)]]); return v ?? null; },
    async createKey(code, hash) { const [set] = await run([['SET', keyOf(code), hash, 'NX', 'EX', KEY_TTL]]); return set === 'OK'; },
    async touchKey(code) { await run([['EXPIRE', keyOf(code), KEY_TTL]]); },
    async hasKey(code) { const [n] = await run([['EXISTS', keyOf(code)]]); return Number(n) > 0; },
    async addLetter(to, letter) {
      await run([
        ['ZADD', box(to), letter.t, JSON.stringify(letter)],
        ['ZREMRANGEBYSCORE', box(to), '-inf', letter.t - BOX_TTL * 1000],
        ['ZREMRANGEBYRANK', box(to), 0, -(BOX_MAX + 1)],
        ['EXPIRE', box(to), BOX_TTL],
      ]);
    },
    async letters(code) {
      const [raw] = await run([['ZRANGE', box(code), 0, BOX_MAX - 1]]);
      const list = [];
      for (const r of raw || []) { try { list.push(JSON.parse(r)); } catch { /* 망가진 편지는 건너뛴다 */ } }
      return freshLetters(list, now());
    },
    async ack(code, upTo) { await run([['ZREMRANGEBYSCORE', box(code), '-inf', upTo]]); },
    async forget(code) { await run([['DEL', box(code)], ['DEL', keyOf(code)]]); },
    // [이름, 한도, 초] 묶음을 한꺼번에 세고, 하나라도 넘으면 false
    async limit(counters) {
      const out = await run(counters.flatMap(([name, , seconds]) => [['INCR', `jm:rl:${name}`], ['EXPIRE', `jm:rl:${name}`, seconds]]));
      return counters.every(([, max], i) => Number(out[i * 2]) <= max);
    },
  };
}

// Upstash Redis REST: 명령 여러 개를 한 번에 보낸다 (POST /pipeline)
export function upstashStore(url, token, fetchImpl = fetch) {
  const endpoint = `${String(url).replace(/\/+$/, '')}/pipeline`;
  return redisStore(async commands => {
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands.map(c => c.map(String))),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`jelly-mail store ${res.status}`);
    const out = await res.json();
    return out.map(r => { if (r.error) throw new Error(`jelly-mail store: ${r.error}`); return r.result; });
  });
}

// 메모리 저장소: 개발 서버와 테스트용 (서버를 끄면 사라진다). 쓰는 Redis 명령만 흉내 낸다.
export function memoryStore({ now = () => Date.now() } = {}) {
  const data = new Map(); // key → { value, expires }
  const live = key => { const e = data.get(key); if (e && e.expires && e.expires <= now()) { data.delete(key); return undefined; } return e; };
  const zset = key => { const e = live(key); return e ? e.value : []; };
  const rank = (len, i) => (i < 0 ? len + i : i);
  const score = v => (v === '-inf' ? -Infinity : v === '+inf' ? Infinity : Number(v));
  const commands = {
    GET: key => { const e = live(key); return e ? e.value : null; },
    EXISTS: key => (live(key) ? 1 : 0),
    DEL: key => (data.delete(key) ? 1 : 0),
    SET: (key, value, ...opts) => {
      const upper = opts.map(o => String(o).toUpperCase());
      if (upper.includes('NX') && live(key)) return null;
      const ex = upper.indexOf('EX');
      data.set(key, { value: String(value), expires: ex >= 0 ? now() + Number(opts[ex + 1]) * 1000 : 0 });
      return 'OK';
    },
    INCR: key => { const e = live(key); const n = (e ? Number(e.value) : 0) + 1; data.set(key, { value: String(n), expires: e?.expires || 0 }); return n; },
    EXPIRE: (key, seconds) => { const e = live(key); if (!e) return 0; e.expires = now() + Number(seconds) * 1000; return 1; },
    ZADD: (key, s, member) => {
      const e = live(key) || { value: [], expires: 0 };
      e.value = e.value.filter(x => x.member !== member);
      e.value.push({ score: Number(s), member: String(member) });
      e.value.sort((a, b) => a.score - b.score || (a.member < b.member ? -1 : 1));
      data.set(key, e);
      return 1;
    },
    ZRANGE: (key, start, stop) => { const z = zset(key); return z.slice(rank(z.length, Number(start)), rank(z.length, Number(stop)) + 1).map(x => x.member); },
    ZREMRANGEBYSCORE: (key, min, max) => { const e = live(key); if (!e) return 0; const before = e.value.length; e.value = e.value.filter(x => x.score < score(min) || x.score > score(max)); return before - e.value.length; },
    ZREMRANGEBYRANK: (key, start, stop) => {
      const e = live(key); if (!e) return 0;
      const a = Math.max(0, rank(e.value.length, Number(start))), b = rank(e.value.length, Number(stop));
      if (b < a) return 0;
      return e.value.splice(a, b - a + 1).length;
    },
  };
  const store = redisStore(async list => list.map(([name, ...args]) => commands[name](...args)), { now });
  store.data = data;
  return store;
}

// ---------- Vercel Blob 저장소 (비공개) ----------
// api: @vercel/blob 의 { put, get, head, del, list } (테스트에서는 흉내 낸 것).
// 무료(Hobby) 한도가 "저장·목록 2천 번, 읽기 1만 번 / 달"이라 아껴 쓴다:
//   - 편지 하나 = 우체통 파일 고쳐 쓰기 1번 (+ 읽기 1번), 받은 편지 지우기는 공짜(del)
//   - 우체통 열기 = 읽기 1번, 열쇠 확인은 서버가 10분 동안 기억해서 읽기를 줄인다
//   - 여럿이 동시에 써도 ETag가 맞을 때만 고쳐 쓰고, 안 맞으면 다시 읽어서 섞이지 않는다
export function blobStore(api, { now = () => Date.now(), prefix = 'jelly-mail' } = {}) {
  const keyPath = code => `${prefix}/key/${code}.json`, boxPath = code => `${prefix}/box/${code}.json`;
  const opts = { access: 'private', addRandomSuffix: false, contentType: 'application/json', cacheControlMaxAge: 60 };
  const keys = new Map();     // 친구 코드 → { h, at } 열쇠 해시 기억
  const counters = new Map(); // 보내기 한도는 이 서버 안에서만 센다 (Blob에는 세는 기능이 없다)
  const errorIs = (e, cls, text) => (cls && e instanceof cls) || text.test(String(e?.message || ''));
  const precondition = e => errorIs(e, api.BlobPreconditionFailedError, /precondition/i);
  const exists = e => /already exists/i.test(String(e?.message || ''));
  const notFound = e => errorIs(e, api.BlobNotFoundError, /does not exist|not found/i);
  async function read(path) { // { data, etag } 또는 null (없음)
    const r = await api.get(path, { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200 || !r.stream) return null;
    const text = await new Response(r.stream).text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* 망가진 파일은 빈 것으로 */ }
    return { data, etag: r.blob.etag };
  }
  return {
    kind: 'blob',
    pace: { fast: 30000, slow: 300000 },
    async getKey(code) {
      const hit = keys.get(code);
      if (hit && now() - hit.at < 600000) return hit.h;
      const r = await read(keyPath(code));
      const h = typeof r?.data?.h === 'string' ? r.data.h : null;
      if (h) keys.set(code, { h, at: now() }); else keys.delete(code);
      return h;
    },
    async createKey(code, hash) {
      try {
        await api.put(keyPath(code), JSON.stringify({ h: hash }), { ...opts, allowOverwrite: false });
      } catch (e) {
        if (exists(e)) return false;
        throw e;
      }
      keys.set(code, { h: hash, at: now() });
      return true;
    },
    async touchKey() { /* Blob 열쇠는 계정을 지울 때까지 둔다 */ },
    async hasKey(code) {
      if (keys.has(code)) return true;
      try { await api.head(keyPath(code)); return true; } catch (e) { if (notFound(e)) return false; throw e; }
    },
    async addLetter(to, letter) {
      for (let tries = 0; tries < 6; tries++) {
        const cur = await read(boxPath(to));
        const letters = freshLetters(cur?.data?.letters, letter.t).concat(letter).slice(-BOX_MAX);
        try {
          await api.put(boxPath(to), JSON.stringify({ letters }), cur ? { ...opts, ifMatch: cur.etag } : { ...opts, allowOverwrite: false });
          return;
        } catch (e) {
          if (!precondition(e) && !exists(e)) throw e; // 누가 먼저 고쳐 썼다 → 다시 읽어서 한 번 더
        }
      }
      throw new Error('jelly-mail: mailbox busy');
    },
    async letters(code) {
      const cur = await read(boxPath(code));
      return freshLetters(cur?.data?.letters, now());
    },
    async ack(code, upTo) {
      for (let tries = 0; tries < 4; tries++) {
        const cur = await read(boxPath(code));
        if (!cur) return;
        const all = Array.isArray(cur.data?.letters) ? cur.data.letters : [];
        const keep = freshLetters(all, now()).filter(l => l.t > upTo);
        if (all.length && keep.length === all.length) return; // 지울 편지가 없다
        try {
          if (keep.length) await api.put(boxPath(code), JSON.stringify({ letters: keep }), { ...opts, ifMatch: cur.etag });
          else await api.del(boxPath(code), { ifMatch: cur.etag }); // 다 받았으면 파일째 지운다 (공짜)
          return;
        } catch (e) {
          if (!precondition(e) && !notFound(e)) throw e; // 그 사이 새 편지가 왔다 → 다시
        }
      }
    },
    async forget(code) {
      keys.delete(code);
      await api.del([keyPath(code), boxPath(code)]).catch(e => { if (!notFound(e)) throw e; });
    },
    async limit(list) {
      const t = now();
      if (counters.size > 5000) for (const [name, c] of counters) if (c.until <= t) counters.delete(name);
      return list.every(([name, max, seconds]) => {
        let c = counters.get(name);
        if (!c || c.until <= t) { c = { n: 0, until: t + seconds * 1000 }; counters.set(name, c); }
        c.n++;
        return c.n <= max;
      });
    },
    // 7일 넘게 아무도 손대지 않은 우체통 파일을 지운다 (목록 1번 + 지우기는 공짜)
    async cleanup() {
      const cutoff = now() - BOX_TTL * 1000;
      let cursor, removed = 0;
      do {
        const page = await api.list({ prefix: `${prefix}/box/`, cursor, limit: 1000 });
        const old = page.blobs.filter(b => new Date(b.uploadedAt).getTime() < cutoff).map(b => b.url);
        if (old.length) { await api.del(old); removed += old.length; }
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return removed;
    },
  };
}
