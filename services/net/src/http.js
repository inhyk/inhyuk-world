// HTTP 도우미: 접속 허용 주소, CORS, JSON 응답, 오류
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function allowedOrigin(origin, env) {
  if (!origin) return false;
  if (LOCAL_ORIGIN.test(origin)) return true;
  const list = String(env?.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  return list.includes(origin);
}

export function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

// 처리하다 멈출 때 던진다. 라우터가 { error: code } 응답으로 바꾼다.
export class HttpError extends Error {
  constructor(status, code, extra = {}) { super(code); this.status = status; this.code = code; this.extra = extra; }
}
export const fail = (status, code, extra) => { throw new HttpError(status, code, extra); };

export const BODY_MAX = 64 * 1024;

// 몸을 글자로 읽는다. Content-Length 를 믿지 않고 실제로 읽은 바이트를 세어 max 를 넘으면 그 자리에서 413.
export async function readText(request, max = BODY_MAX) {
  if (Number(request.headers.get('Content-Length') ?? 0) > max) fail(413, 'too-big');
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      try { await reader.cancel(); } catch { /* 이미 끝남 */ }
      fail(413, 'too-big');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

// JSON 몸을 읽는다(64KB 까지). 잘못된 JSON 이면 {}.
export async function readJson(request, max = BODY_MAX) {
  const text = await readText(request, max);
  if (!text) return {};
  try {
    const body = JSON.parse(text);
    return body && typeof body === 'object' ? body : {};
  } catch { return {}; }
}

export const now = () => Date.now();

export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') ?? '0.0.0.0';
}

// 사용자 번호(숫자)를 읽는다. 잘못되면 400.
export function userId(value) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) fail(400, 'bad-user');
  return n;
}

// 내부 Durable Object 로 넘길 요청. 손님이 보낸 X-Net-* 머리글은 버리고 서버가 정한 값만 넣는다.
export function internalRequest(request, values) {
  const headers = new Headers(request.headers);
  for (const key of [...headers.keys()]) if (key.toLowerCase().startsWith('x-net-')) headers.delete(key);
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== null) headers.set(key, String(value));
  return new Request(request, { headers });
}
