// 젤리 타워 친구 우체통. 친구가 게임을 꺼 두었을 때 보낸 메시지·젤리 이모티콘·친구 신청을
// 잠깐 맡아 두었다가, 친구가 게임을 켜서 받아 가면 지운다 (안 받아 가도 7일 뒤 지운다).
//
// 친구 코드마다 "열쇠"(기기에만 있는 32글자 비밀 값)의 해시를 맡아 두고, 열쇠가 맞을 때만
// 그 코드로 보내거나 그 코드의 우체통을 열 수 있다. 그래서 다른 사람인 척 보내거나 남의 편지를 볼 수 없다.
// 친구인지·차단했는지는 받는 사람 기기가 판단한다 (차단한 사람의 편지는 조용히 버린다).
//
// 저장소는 Redis 명령 몇 개만 쓴다: Upstash Redis(사이트) 또는 메모리(개발·테스트).
import { createHash, timingSafeEqual, randomBytes } from 'node:crypto';
import { cleanChat, cleanName, personalInfo, validFriendCode, validMailKey, validSticker } from '../../../games/puyo-puyo/chat.mjs';

export const BOX_MAX = 100;                 // 한 사람 우체통에 쌓이는 편지 수
export const BOX_TTL = 7 * 24 * 3600;       // 7일 (초)
export const KEY_TTL = 400 * 24 * 3600;     // 열쇠는 400일 동안 안 쓰면 잊는다
export const KINDS = ['msg', 'st', 'fr', 'fa', 'fx']; // 메시지, 젤리 이모티콘, 친구 신청, 받기, 안 받기
export const LIMITS = { perMinute: 20, perDay: 300, perIpHour: 400, registerPerIpHour: 30 };

const hashKey = (code, key) => createHash('sha256').update(`jelly-mail:${code}:${key}`).digest('hex');
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const reply = (status, body) => ({ status, body });
const cleanId = id => (typeof id === 'string' && /^[a-z0-9]{8,24}$/.test(id) ? id : randomBytes(8).toString('hex'));

export function createMailbox(store, { now = () => Date.now() } = {}) {
  const box = code => `jm:box:${code}`;
  const keyOf = code => `jm:key:${code}`;

  async function authorised(code, key) {
    if (!validFriendCode(code) || !validMailKey(key)) return false;
    const [stored] = await store.run([['GET', keyOf(code)]]);
    return same(stored, hashKey(code, key));
  }
  // [이름, 한도, 초] 묶음을 한꺼번에 세고, 하나라도 넘으면 false
  async function within(counters) {
    const out = await store.run(counters.flatMap(([name, , seconds]) => [['INCR', name], ['EXPIRE', name, seconds]]));
    return counters.every(([, max], i) => Number(out[i * 2]) <= max);
  }

  async function hello({ code, key }, ip) {
    if (!validFriendCode(code) || !validMailKey(key)) return reply(400, { ok: false, error: 'bad' });
    const hashed = hashKey(code, key);
    const [stored] = await store.run([['GET', keyOf(code)]]);
    if (stored) {
      if (!same(stored, hashed)) return reply(409, { ok: false, error: 'taken' });
      await store.run([['EXPIRE', keyOf(code), KEY_TTL]]);
      return reply(200, { ok: true });
    }
    if (!(await within([[`jm:reg:${ip}:${Math.floor(now() / 3600000)}`, LIMITS.registerPerIpHour, 3600]]))) return reply(429, { ok: false, error: 'limit' });
    const [set] = await store.run([['SET', keyOf(code), hashed, 'NX', 'EX', KEY_TTL]]);
    if (set === 'OK') return reply(200, { ok: true, created: true });
    // 같은 순간에 누가 먼저 만들었다: 그게 내 열쇠인지 한 번만 다시 비교한다
    const [again] = await store.run([['GET', keyOf(code)]]);
    return same(again, hashed) ? reply(200, { ok: true }) : reply(409, { ok: false, error: 'taken' });
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
    if (!(await within([
      [`jm:rm:${code}:${minute}`, LIMITS.perMinute, 120],
      [`jm:rd:${code}:${day}`, LIMITS.perDay, 2 * 86400],
      [`jm:ri:${ip}:${hour}`, LIMITS.perIpHour, 3600],
    ]))) return reply(429, { ok: false, error: 'limit' });
    letter.t = t;
    const out = await store.run([
      ['ZADD', box(to), t, JSON.stringify(letter)],
      ['ZREMRANGEBYSCORE', box(to), '-inf', t - BOX_TTL * 1000],
      ['ZREMRANGEBYRANK', box(to), 0, -(BOX_MAX + 1)],
      ['EXPIRE', box(to), BOX_TTL],
      ['EXISTS', keyOf(to)],
    ]);
    // 친구 신청은 그 코드로 우체통을 연 사람이 있는지 알려 준다 (코드를 잘못 적었는지 알 수 있게)
    return reply(200, { ok: true, id: letter.id, t, ...(kind === 'fr' ? { known: Number(out[4]) > 0 } : {}) });
  }

  // 우체통 열기. ack(시각)를 주면 그 시각까지 받은 편지를 먼저 지운다
  async function inbox({ code, key, ack }) {
    if (!(await authorised(code, key))) return reply(401, { ok: false, error: 'auth' });
    const t = now(), commands = [];
    const upTo = Number(ack);
    if (Number.isFinite(upTo) && upTo > 0) commands.push(['ZREMRANGEBYSCORE', box(code), '-inf', Math.min(upTo, t)]);
    commands.push(['ZRANGE', box(code), 0, BOX_MAX - 1]);
    const out = await store.run(commands);
    const letters = [];
    for (const raw of out[out.length - 1] || []) {
      try {
        const letter = JSON.parse(raw);
        if (letter && validFriendCode(letter.from) && KINDS.includes(letter.kind) && t - letter.t < BOX_TTL * 1000) letters.push(letter);
      } catch { /* 망가진 편지는 건너뛴다 */ }
    }
    return reply(200, { ok: true, letters, now: t });
  }

  // 계정을 지우면 열쇠와 우체통도 지운다
  async function forget({ code, key }) {
    if (!(await authorised(code, key))) return reply(401, { ok: false, error: 'auth' });
    await store.run([['DEL', box(code)], ['DEL', keyOf(code)]]);
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
  };
}

// ---------- 저장소 ----------
// Upstash Redis REST: 명령 여러 개를 한 번에 보낸다 (POST /pipeline)
export function upstashStore(url, token, fetchImpl = fetch) {
  const endpoint = `${String(url).replace(/\/+$/, '')}/pipeline`;
  return {
    async run(commands) {
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(commands.map(c => c.map(String))),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`jelly-mail store ${res.status}`);
      const out = await res.json();
      return out.map(r => { if (r.error) throw new Error(`jelly-mail store: ${r.error}`); return r.result; });
    },
  };
}

// 메모리 저장소: 개발 서버와 테스트용 (서버를 끄면 사라진다). 쓰는 명령만 흉내 낸다.
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
      const removed = e.value.splice(a, b - a + 1).length;
      return removed;
    },
  };
  return {
    data,
    async run(list) { return list.map(([name, ...args]) => commands[name](...args)); },
  };
}
