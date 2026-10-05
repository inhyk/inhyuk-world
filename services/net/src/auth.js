// 계정: 닉네임 + 비밀번호. 이메일은 받지 않고, 비밀번호를 잊으면 되찾을 수 없다.
import { fail, json, now, clientIp, readJson } from './http.js';
import { hasProfanity, filterText } from './filter.js';

// Workers 의 WebCrypto 는 PBKDF2 반복을 100,000 번까지만 허용한다. 그 최댓값을 쓴다 (README "비밀번호 저장").
// 무료 요금제 CPU 한도(요청당 10ms)에 걸리면 PBKDF2_ITERATIONS 변수로 낮출 수 있다. 사람마다 쓴 횟수를 저장하므로
// 바꿔도 예전 계정은 그대로 로그인된다.
export const PBKDF2_ITERATIONS = 100_000;
export function iterationsFor(env) {
  const n = Math.floor(Number(env?.PBKDF2_ITERATIONS));
  return Number.isFinite(n) && n > 0 ? Math.min(PBKDF2_ITERATIONS, Math.max(10_000, n)) : PBKDF2_ITERATIONS;
}
export const NICK_RE = /^[가-힣A-Za-z0-9_]{2,10}$/;
export const PASS_MIN = 4, PASS_MAX = 16;
const SESSION_IDLE_MS = 180 * 24 * 60 * 60 * 1000; // 180일 동안 안 쓰면 다시 로그인
const SEEN_EVERY_MS = 60 * 60 * 1000;
const TICKET_MS = 60 * 1000;
// 로그인 실패: 닉네임+IP 마다 10분에 10번, IP 하나에서 10분에 30번, 닉네임 하나에 (모든 IP 합쳐) 1시간에 30번까지.
// 가입: IP 하나에서 1시간에 10번.
const LOGIN_WINDOW_MS = 10 * 60 * 1000, LOGIN_FAILS = 10, LOGIN_FAILS_PER_IP = 30;
const LOGIN_NICK_WINDOW_MS = 60 * 60 * 1000, LOGIN_FAILS_PER_NICK = 30;
const THROTTLE_KEEP_MS = 24 * 60 * 60 * 1000;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000, SIGNUPS_PER_IP = 10;

const enc = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const b64url = bytes => b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function randomBytes(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; }

export async function sha256(text) {
  return b64url(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

export async function hashPassword(password, salt, iterations = PBKDF2_ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations }, key, 256);
  return b64(bits);
}

function sameText(a, b) {
  // 걸린 시간으로 비밀번호를 짐작하지 못하게 끝까지 비교한다.
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function cleanNickname(value) {
  return String(value ?? '').normalize('NFC').trim();
}

export function checkNickname(value) {
  const nick = cleanNickname(value);
  if (!NICK_RE.test(nick)) return 'bad-nickname';
  if (hasProfanity(nick)) return 'bad-nickname-word';
  // 닉네임으로 연락처를 알리지 못하게: 전화번호, 링크, 메신저 아이디, 숫자 7개 이상은 안 된다.
  if (filterText(nick).kinds.length || (nick.match(/[0-9]/g)?.length ?? 0) >= 7) return 'bad-nickname-word';
  return '';
}

export function checkPassword(value) {
  if (typeof value !== 'string' || value.length < PASS_MIN || value.length > PASS_MAX) return 'bad-password';
  return '';
}

// 횟수 제한. 먼저 이번 시도를 적고(insert) 그다음 센다(count). 한꺼번에 몰려온 요청도 모두 세어진다.
// 결과 { id: 적은 줄 번호, n: windowMs 안에 적힌 수(이번 것 포함) }
export function hitStatements(env, key, windowMs, t) {
  return [
    env.DB.prepare('INSERT INTO throttle (key, at) VALUES (?, ?) RETURNING rowid AS id').bind(key, t),
    env.DB.prepare('SELECT count(*) AS n FROM throttle WHERE key = ? AND at > ?').bind(key, t - windowMs),
  ];
}
export async function hit(env, key, windowMs) {
  const t = now();
  const [inserted, counted] = await env.DB.batch(hitStatements(env, key, windowMs, t));
  maybePrune(env);
  return { id: inserted.results[0].id, n: counted.results[0].n };
}
export async function limit(env, key, windowMs, max) {
  if ((await hit(env, key, windowMs)).n > max) fail(429, 'rate');
}
// 하루 지난 횟수 기록을 지운다. 요청 100번에 한 번쯤 한다.
export async function pruneThrottle(env) {
  await env.DB.prepare('DELETE FROM throttle WHERE at < ?').bind(now() - THROTTLE_KEEP_MS).run();
}
function maybePrune(env) {
  if (Math.random() < 0.01) pruneThrottle(env).catch(error => console.error('throttle prune failed', error?.message));
}

async function newSession(env, userId) {
  const token = b64url(randomBytes(32));
  const t = now();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created, last_seen) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), userId, t, t).run();
  return token;
}

export const publicUser = row => ({ id: row.id, nickname: row.nickname });

export async function signup(request, env) {
  const body = await readJson(request);
  const nickname = cleanNickname(body.nickname);
  const problem = checkNickname(nickname) || checkPassword(body.password);
  if (problem) fail(400, problem);
  await limit(env, `signup:${clientIp(request)}`, SIGNUP_WINDOW_MS, SIGNUPS_PER_IP);
  const salt = b64(randomBytes(16));
  const iterations = iterationsFor(env);
  const hash = await hashPassword(body.password, salt, iterations);
  let row;
  try {
    row = await env.DB.prepare('INSERT INTO users (nickname, pass_hash, salt, iterations, created) VALUES (?, ?, ?, ?, ?) RETURNING id, nickname')
      .bind(nickname, hash, salt, iterations, now()).first();
  } catch (error) {
    if (/UNIQUE/i.test(String(error?.message))) fail(409, 'nickname-taken');
    throw error;
  }
  return json({ token: await newSession(env, row.id), user: publicUser(row) }, 201);
}

export async function login(request, env) {
  const body = await readJson(request);
  const nickname = cleanNickname(body.nickname);
  if (!nickname || typeof body.password !== 'string') fail(400, 'bad-login');
  const ip = clientIp(request);
  const nick = nickname.toLowerCase();
  // 비밀번호 계산(PBKDF2) 전에 시도를 먼저 적고 센다. 맞으면 적은 것을 지운다(실패만 남는다).
  const limits = [[`login:${nick}:${ip}`, LOGIN_WINDOW_MS, LOGIN_FAILS], [`login-ip:${ip}`, LOGIN_WINDOW_MS, LOGIN_FAILS_PER_IP],
    [`login-nick:${nick}`, LOGIN_NICK_WINDOW_MS, LOGIN_FAILS_PER_NICK]];
  const t = now();
  const results = await env.DB.batch(limits.flatMap(([key, windowMs]) => hitStatements(env, key, windowMs, t)));
  maybePrune(env);
  const ids = limits.map((_, i) => results[i * 2].results[0].id);
  if (limits.some(([, , max], i) => results[i * 2 + 1].results[0].n > max)) fail(429, 'rate');
  const row = await env.DB.prepare('SELECT * FROM users WHERE nickname = ?').bind(nickname).first();
  // 없는 닉네임도 같은 시간을 들여 계산해서, 걸린 시간으로 닉네임이 있는지 알 수 없게 한다.
  const hash = await hashPassword(body.password.slice(0, PASS_MAX * 4), row?.salt ?? 'no-such-user', row?.iterations ?? iterationsFor(env));
  if (!row || !sameText(hash, row.pass_hash)) fail(401, 'wrong-login');
  await env.DB.prepare(`DELETE FROM throttle WHERE rowid IN (${ids.map(() => '?').join(', ')})`).bind(...ids).run();
  if (row.suspended_at) fail(403, 'suspended', { reason: row.suspended_reason ?? '' });
  return json({ token: await newSession(env, row.id), user: publicUser(row) });
}

function bearer(request) {
  const header = request.headers.get('Authorization') ?? '';
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,100})$/.exec(header.trim());
  return m ? m[1] : '';
}

// 로그인한 사람을 찾는다. 없으면 401, 정지된 계정이면 403.
export async function requireUser(request, env) {
  const token = bearer(request);
  if (!token) fail(401, 'login-required');
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    'SELECT u.id, u.nickname, u.created, u.suspended_at, u.suspended_reason, s.last_seen FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?',
  ).bind(tokenHash).first();
  if (!row || now() - row.last_seen > SESSION_IDLE_MS) fail(401, 'login-required');
  if (row.suspended_at) fail(403, 'suspended', { reason: row.suspended_reason ?? '' });
  if (now() - row.last_seen > SEEN_EVERY_MS) {
    await env.DB.prepare('UPDATE sessions SET last_seen = ? WHERE token_hash = ?').bind(now(), tokenHash).run();
  }
  return { id: row.id, nickname: row.nickname, created: row.created, tokenHash };
}

export async function logout(request, env) {
  const user = await requireUser(request, env);
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(user.tokenHash).run();
  return json({ ok: true });
}

export async function me(request, env) {
  const user = await requireUser(request, env);
  return json({ user: { id: user.id, nickname: user.nickname, created: user.created } });
}

// WebSocket 은 브라우저에서 머리글을 못 붙이므로, 먼저 이 한 번짜리 표를 받아 주소에 붙인다 (?ticket=).
export async function ticket(request, env) {
  const user = await requireUser(request, env);
  const value = b64url(randomBytes(24));
  const t = now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM tickets WHERE expires < ?').bind(t),
    env.DB.prepare('INSERT INTO tickets (hash, user_id, expires) VALUES (?, ?, ?)').bind(await sha256(value), user.id, t + TICKET_MS),
  ]);
  return json({ ticket: value, expires: t + TICKET_MS });
}

// 표를 쓰고 버린다. 맞으면 { id, nickname }, 아니면 null.
export async function useTicket(env, value) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(value ?? '')) return null;
  const row = await env.DB.prepare('DELETE FROM tickets WHERE hash = ? RETURNING user_id, expires').bind(await sha256(value)).first();
  if (!row || row.expires < now()) return null;
  const user = await env.DB.prepare('SELECT id, nickname, suspended_at FROM users WHERE id = ?').bind(row.user_id).first();
  if (!user || user.suspended_at) return null;
  return { id: user.id, nickname: user.nickname };
}
