// 방 코드와 방 만들기 (Worker, Lobby, Matchmaker 가 같이 쓴다)
export const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
export const GAME_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;
export const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4,8}$/;
export const DEFAULT_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const MAX_MESSAGE_BYTES = 16 * 1024;
export const PING = '{"t":"ping"}';
export const PONG = '{"t":"pong"}';
export const CHAT_LINES = 50; // 방마다 기억하는 거른 채팅 줄 수

export function clampPlayers(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_PLAYERS;
  return Math.min(MAX_PLAYERS, Math.max(2, n));
}

export function randomCode() {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return [...bytes].map(n => ALPHABET[n % ALPHABET.length]).join('');
}

export const roomStub = (env, game, code) => env.ROOMS.get(env.ROOMS.idFromName(`${game}:${code}`));

// 비어 있는 새 방 코드를 잡는다. members(사용자 번호 목록)를 주면 그 사람들만 들어올 수 있는 방이 된다.
export async function createRoom(env, game, { maxPlayers = DEFAULT_PLAYERS, members = null } = {}) {
  for (let tries = 0; tries < 5; tries++) {
    const code = randomCode();
    if (await roomStub(env, game, code).reserve(maxPlayers, members, `${game}:${code}`)) return code;
  }
  return '';
}

// 같이 쓰는 세계(World): `<게임>:<세계 이름>` 하나에 Durable Object 하나. 세계 이름은 영어 소문자, 숫자, '-' 16글자까지.
export const WORLD_RE = /^[a-z0-9-]{1,16}$/;
export const worldStub = (env, game, world) => env.WORLDS.get(env.WORLDS.idFromName(`${game}:${world}`));

// ---- Room 과 World 가 같이 쓰는 연결 도우미 ----

// 한 연결이 1초에 보낼 수 있는 메시지: 평소 30개, 몰아서 60개까지. 채팅은 따로 1초에 1줄, 몰아서 5줄까지.
export const RATE_PER_SECOND = 30;
export const RATE_BURST = 60;
export const CHAT_PER_SECOND = 1;
export const CHAT_BURST = 5;
// 15초마다 살펴서 30초 동안 아무 소식 없는 사람은 내보낸다.
export const SWEEP_MS = 15 * 1000;
export const STALE_MS = 30 * 1000;
// 모두 나간 뒤에도 신고할 수 있게 채팅 기록은 10분 더 둔다.
export const CHAT_KEEP_MS = 10 * 60 * 1000;
// 나눠 보낸 전화번호를 찾을 때 볼 같은 사람의 앞줄: 30초 안의 2줄 (이번 줄까지 3줄)
export const SPLIT_LINES = 2, SPLIT_MS = 30 * 1000;

export function safeSend(ws, text) { try { ws.send(text); } catch { /* 닫히는 중 */ } }
export function closeSocket(ws, code, reason) { try { ws.close(code, reason); } catch { /* 이미 닫힘 */ } }

// 메시지가 16KB 를 넘나 (글자 수로 먼저 보고, 한글처럼 3바이트 글자가 많을 때만 바이트를 센다)
export function tooBig(message) {
  return message.length > MAX_MESSAGE_BYTES || (message.length * 3 > MAX_MESSAGE_BYTES && new TextEncoder().encode(message).length > MAX_MESSAGE_BYTES);
}

// 통에서 하나 꺼낸다 (1초에 perSecond 개씩 차고 burst 개까지 모인다). 남아 있었으면 true.
export function takeToken(bucket, perSecond, burst, now = Date.now()) {
  bucket.tokens = Math.min(burst, bucket.tokens + ((now - bucket.at) / 1000) * perSecond);
  bucket.at = now;
  if (bucket.tokens >= 1) { bucket.tokens -= 1; return true; }
  return false;
}

// 연결마다의 횟수 통 (메모리에만 있다. 잠들었다 깨면 새로 찬다).
export function bucketOf(buckets, ws) {
  let bucket = buckets.get(ws);
  if (!bucket) { bucket = { tokens: RATE_BURST, at: Date.now(), heard: 0 }; buckets.set(ws, bucket); }
  return bucket;
}

// 마지막으로 소식을 들은 때. 잠들었다 깨면 메모리 기록은 사라지므로 자동 핑 시각과 들어온 시각도 같이 본다.
export function lastHeard(ctx, buckets, ws, touch = false) {
  const bucket = bucketOf(buckets, ws);
  if (touch) bucket.heard = Date.now();
  const auto = ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? 0;
  const joined = ws.deserializeAttachment()?.joined ?? 0;
  return Math.max(bucket.heard, auto, joined);
}

// 메시지 하나를 보내도 되나. 넘치면 1초에 한 번만 'rate' 를 알린다.
export function allowMessage(buckets, ws, warn) {
  const bucket = bucketOf(buckets, ws);
  const now = Date.now();
  if (takeToken(bucket, RATE_PER_SECOND, RATE_BURST, now)) return true;
  if (!bucket.warned || now - bucket.warned > 1000) { bucket.warned = now; warn(ws, 'rate'); }
  return false;
}

// 채팅 한 줄을 보내도 되나. 넘치면 'chat-rate'.
export function allowChatLine(buckets, ws, warn) {
  const bucket = bucketOf(buckets, ws);
  const now = Date.now();
  bucket.chat ??= { tokens: CHAT_BURST, at: now };
  if (takeToken(bucket.chat, CHAT_PER_SECOND, CHAT_BURST, now)) return true;
  warn(ws, 'chat-rate');
  return false;
}

// 같은 사람(번호 from)이 30초 안에 보낸 마지막 줄들 (나눠 보낸 전화번호 찾기용)
export function recentLinesOf(chat, from) {
  const since = Date.now() - SPLIT_MS;
  return (chat?.lines ?? []).filter(l => l.from === from && l.at >= since).slice(-SPLIT_LINES).map(l => l.text);
}

// 채팅 기록에 한 줄을 더한다 (마지막 CHAT_LINES 줄까지, 거른 글만).
export function pushLine(chat, line) {
  chat.lines.push(line);
  if (chat.lines.length > CHAT_LINES) chat.lines.splice(0, chat.lines.length - CHAT_LINES);
  return chat;
}
