// 관리 페이지 (/admin) 와 관리 API (/admin/api/*).
// Worker secret ADMIN_PASSWORD 하나로 들어간다. 비어 있거나 12글자보다 짧으면 /admin 아래는 모두 403 (닫힘).
// 맞으면 32바이트 무작위 토큰을 쿠키(net_admin)로 주고, D1 에는 토큰의 SHA-256 만 12시간 동안 둔다.
import { json, now, userId, clientIp, readText, HttpError } from './http.js';
import { hitStatements, sameText } from './auth.js';
import { lobby } from './social.js';

export const PASSWORD_MIN = 12;
const SESSION_MS = 12 * 60 * 60 * 1000;
const COOKIE = 'net_admin';
const ACTOR = 'admin'; // 관리 동작 기록에 남는 이름 (관리자는 한 사람)
// 로그인 실패: IP 하나에서 10분에 5번, 모든 IP 합쳐 1시간에 20번까지.
const FAIL_WINDOW_MS = 10 * 60 * 1000, FAILS_PER_IP = 5;
const GLOBAL_WINDOW_MS = 60 * 60 * 1000, FAILS_GLOBAL = 20;
const LOGIN_BODY_MAX = 4 * 1024;

const enc = new TextEncoder();
const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha256hex = async text => hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// 비밀번호가 쓸 만하면 그 지문(SHA-256 앞 16글자), 아니면 ''.
async function fingerprint(env) {
  const password = env?.ADMIN_PASSWORD;
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) return '';
  return (await sha256hex(password)).slice(0, 16);
}

function readCookie(request) {
  for (const part of (request.headers.get('Cookie') ?? '').split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE) {
      const value = rest.join('=');
      return /^[A-Za-z0-9_-]{40,60}$/.test(value) ? value : '';
    }
  }
  return '';
}

// 쿠키가 살아 있는 관리자 로그인이면 true. 만료됐거나 비밀번호가 바뀌었으면 false.
async function hasSession(request, env, print) {
  const token = readCookie(request);
  if (!token) return false;
  const row = await env.DB.prepare('SELECT fingerprint, expires FROM admin_sessions WHERE token_hash = ?').bind(await sha256hex(token)).first();
  return !!row && row.expires > now() && sameText(row.fingerprint, print);
}

const SECURITY = {
  'Cache-Control': 'no-store',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  // same-origin: 같은 주소로 보내는 POST 에 Origin 이 붙어야 아래 Origin 검사를 통과한다 (no-referrer 면 Origin: null).
  'Referrer-Policy': 'same-origin',
};
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
const html = (body, status = 200, headers = {}) => new Response(body, { status, headers: { ...SECURITY, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': CSP, ...headers } });
const cookie = (value, maxAge) => `${COOKIE}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=${maxAge}`;
const wantsJson = request => (request.headers.get('Content-Type') ?? '').toLowerCase().startsWith('application/json');

async function login(request, env, print) {
  const asJson = wantsJson(request);
  const answer = (status, error) => asJson ? json({ error }, status, SECURITY) : html(loginPage(LOGIN_ERRORS[error] ?? '다시 해 보세요.'), status);
  const ip = clientIp(request);
  let password = '';
  try {
    const text = await readText(request, LOGIN_BODY_MAX);
    if (asJson) { try { password = JSON.parse(text)?.password; } catch { /* 잘못된 JSON */ } }
    else password = new URLSearchParams(text).get('password');
  } catch (error) {
    if (error instanceof HttpError) return answer(error.status, error.code);
    throw error;
  }
  if (typeof password !== 'string' || !password) return answer(400, 'bad-login');
  // 비교하기 전에 시도를 먼저 적고 센다(insert-then-count). 맞으면 이 IP 의 기록과 이번 전체 기록을 지운다.
  const t = now();
  const limits = [[`admin-login-ip:${ip}`, FAIL_WINDOW_MS, FAILS_PER_IP], ['admin-login-all', GLOBAL_WINDOW_MS, FAILS_GLOBAL]];
  const results = await env.DB.batch(limits.flatMap(([key, windowMs]) => hitStatements(env, key, windowMs, t)));
  if (limits.some(([, , max], i) => results[i * 2 + 1].results[0].n > max)) return answer(429, 'rate');
  // 길이가 새지 않게 양쪽을 SHA-256 으로 같은 길이로 만든 뒤 끝까지 비교한다.
  const ok = sameText(await sha256hex(password), await sha256hex(env.ADMIN_PASSWORD));
  if (!ok) return answer(401, 'wrong-password');

  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.batch([
    env.DB.prepare('DELETE FROM throttle WHERE key = ? OR rowid = ?').bind(limits[0][0], results[2].results[0].id),
    env.DB.prepare('DELETE FROM admin_sessions WHERE expires < ?').bind(t),
    env.DB.prepare('INSERT INTO admin_sessions (token_hash, fingerprint, created, expires, ip) VALUES (?, ?, ?, ?, ?)')
      .bind(await sha256hex(token), print, t, t + SESSION_MS, ip),
  ]);
  const headers = { ...SECURITY, 'Set-Cookie': cookie(token, SESSION_MS / 1000) };
  return asJson ? json({ ok: true }, 200, headers) : new Response(null, { status: 303, headers: { ...headers, Location: '/admin' } });
}

async function logout(request, env) {
  const token = readCookie(request);
  if (token) await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await sha256hex(token)).run();
  const headers = { ...SECURITY, 'Set-Cookie': cookie('', 0) };
  return wantsJson(request) ? json({ ok: true }, 200, headers) : new Response(null, { status: 303, headers: { ...headers, Location: '/admin' } });
}

export async function handleAdmin(request, env, parts) {
  const print = await fingerprint(env);
  if (!print) return html(CLOSED_PAGE, 403);
  const url = new URL(request.url);
  // 쓰기는 같은 주소의 페이지에서만 한다 (다른 사이트가 몰래 부르지 못하게). 쿠키도 SameSite=Strict.
  const origin = request.headers.get('Origin');
  if (request.method !== 'GET' && origin !== url.origin) return new Response('forbidden', { status: 403, headers: SECURITY });

  if (parts.length === 1 && parts[0] === 'login' && request.method === 'POST') return login(request, env, print);
  if (parts.length === 1 && parts[0] === 'logout' && request.method === 'POST') return logout(request, env);

  const signedIn = await hasSession(request, env, print);
  if (parts.length === 0 && request.method === 'GET') return html(signedIn ? PAGE : loginPage(''));
  if (parts[0] !== 'api') return new Response('not found', { status: 404, headers: SECURITY });
  const respond = (body, status = 200) => json(body, status, SECURITY);
  if (!signedIn) return respond({ error: 'login-required' }, 401);
  const path = parts.slice(1).join('/');
  const db = env.DB;
  const ip = clientIp(request);

  if (request.method === 'GET' && path === 'reports') {
    const status = ['open', 'dismissed', 'actioned'].includes(url.searchParams.get('status')) ? url.searchParams.get('status') : 'open';
    const { results } = await db.prepare(`
      SELECT r.*, a.nickname AS reporter_nickname, b.nickname AS target_nickname, b.suspended_at AS target_suspended_at
      FROM reports r JOIN users a ON a.id = r.reporter_id JOIN users b ON b.id = r.target_id
      WHERE r.status = ? ORDER BY r.id DESC LIMIT 100`).bind(status).all();
    return respond({
      reports: results.map(r => ({
        id: r.id, created: r.created, status: r.status, reason: r.reason,
        reporter: { id: r.reporter_id, nickname: r.reporter_nickname },
        target: { id: r.target_id, nickname: r.target_nickname, suspended: !!r.target_suspended_at },
        context: JSON.parse(r.context), evidence: JSON.parse(r.evidence ?? 'null'), clientMessages: JSON.parse(r.client_messages ?? '[]'),
      })),
    });
  }

  if (request.method === 'GET' && path === 'users') {
    const q = String(url.searchParams.get('q') ?? '').trim();
    const like = q.replace(/[\\%_]/g, ch => `\\${ch}`) + '%';
    const { results } = await db.prepare(`
      SELECT u.id, u.nickname, u.created, u.suspended_at, u.suspended_reason,
        (SELECT count(*) FROM reports r WHERE r.target_id = u.id) AS reports
      FROM users u WHERE u.nickname LIKE ? ESCAPE '\\' ORDER BY u.id DESC LIMIT 50`).bind(like).all();
    return respond({ users: results });
  }

  let m = /^reports\/(\d+)\/dismiss$/.exec(path);
  if (request.method === 'POST' && m) {
    const id = Number(m[1]);
    await db.batch([
      db.prepare("UPDATE reports SET status = 'dismissed', resolved_at = ?, resolved_by = ? WHERE id = ?").bind(now(), ACTOR, id),
      db.prepare('INSERT INTO admin_actions (actor, ip, action, target_id, detail, created) VALUES (?, ?, ?, ?, ?, ?)').bind(ACTOR, ip, 'dismiss-report', null, String(id), now()),
    ]);
    return respond({ ok: true });
  }

  m = /^users\/(\d+)\/(suspend|unsuspend)$/.exec(path);
  if (request.method === 'POST' && m) {
    const id = userId(m[1]);
    let body = {};
    try { body = await request.json(); } catch { /* 이유 없음 */ }
    const reason = String(body?.reason ?? '').slice(0, 200);
    if (m[2] === 'suspend') {
      await db.batch([
        db.prepare('UPDATE users SET suspended_at = ?, suspended_reason = ? WHERE id = ?').bind(now(), reason, id),
        db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
        db.prepare('DELETE FROM tickets WHERE user_id = ?').bind(id),
        db.prepare("UPDATE reports SET status = 'actioned', resolved_at = ?, resolved_by = ? WHERE target_id = ? AND status = 'open'").bind(now(), ACTOR, id),
        db.prepare('INSERT INTO admin_actions (actor, ip, action, target_id, detail, created) VALUES (?, ?, ?, ?, ?, ?)').bind(ACTOR, ip, 'suspend', id, reason, now()),
      ]);
      await lobby(env).kick(id, 'suspended'); // 접속 중이면 바로 끊는다
    } else {
      await db.batch([
        db.prepare('UPDATE users SET suspended_at = NULL, suspended_reason = NULL WHERE id = ?').bind(id),
        db.prepare('INSERT INTO admin_actions (actor, ip, action, target_id, detail, created) VALUES (?, ?, ?, ?, ?, ?)').bind(ACTOR, ip, 'unsuspend', id, reason, now()),
      ]);
    }
    return respond({ ok: true });
  }

  return respond({ error: 'not-found' }, 404);
}

const LOGIN_ERRORS = {
  'wrong-password': '비밀번호가 틀렸어요.',
  rate: '너무 많이 틀렸어요. 조금 뒤에 다시 해 보세요.',
  'bad-login': '비밀번호를 넣어 주세요.',
  'too-big': '비밀번호가 너무 길어요.',
};

const STYLE = `body { font: 15px/1.5 system-ui, sans-serif; margin: 0 auto; max-width: 960px; padding: 16px; color: #222; background: #fafafa; }
  h1 { font-size: 20px; } h2 { font-size: 17px; margin-top: 28px; }
  button { font: inherit; padding: 4px 10px; margin-right: 6px; border-radius: 6px; border: 1px solid #aaa; background: #fff; cursor: pointer; }
  input { font: inherit; padding: 4px 8px; }
  .error { color: #b00020; }`;

const CLOSED_PAGE = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>net 관리</title></head>
<body><p>관리자 비밀번호가 설정되지 않았어요.</p></body></html>`;

const escape = text => text.replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
const loginPage = error => `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>net 관리</title>
<style>${STYLE}</style></head>
<body>
<h1>net 관리</h1>
<form method="post" action="/admin/login">
<p><label>관리자 비밀번호 <input type="password" name="password" autocomplete="current-password" required autofocus></label></p>
<p><button>들어가기</button></p>
${error ? `<p class="error">${escape(error)}</p>` : ''}
</form>
</body></html>`;

const PAGE = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>net 관리</title>
<style>
  ${STYLE}
  .card { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin: 10px 0; }
  .meta { color: #666; font-size: 13px; }
  .lines { background: #f4f4f4; border-radius: 6px; padding: 8px; margin: 8px 0; max-height: 260px; overflow: auto; font-size: 14px; }
  .lines div { white-space: pre-wrap; word-break: break-all; }
  .target { color: #b00020; font-weight: 600; }
  button.danger { border-color: #b00020; color: #b00020; }
  table { border-collapse: collapse; width: 100%; } td, th { border-bottom: 1px solid #eee; padding: 6px; text-align: left; }
</style></head>
<body>
<h1>net 관리</h1>
<form method="post" action="/admin/logout"><button>나가기</button></form>
<h2>신고 <select id="status"><option value="open">처리 전</option><option value="actioned">정지함</option><option value="dismissed">무시함</option></select></h2>
<div id="reports">불러오는 중…</div>
<h2>사용자 찾기</h2>
<form id="search"><input id="q" placeholder="닉네임 앞부분"> <button>찾기</button></form>
<table id="users"></table>
<script>
const $ = s => document.querySelector(s);
const el = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
const when = t => t ? new Date(t).toLocaleString('ko-KR') : '';
async function api(path, body) {
  const res = await fetch('/admin/api/' + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (res.status === 401) { location.reload(); throw Error(res.status); } // 로그인이 끝났다
  if (!res.ok) { alert('실패: ' + res.status); throw Error(res.status); }
  return res.json();
}
async function suspend(user) {
  const reason = prompt(user.nickname + ' 계정을 정지할까요? 이유:', '채팅 규칙 위반');
  if (reason === null) return;
  await api('users/' + user.id + '/suspend', { reason }); load();
}
async function unsuspend(user) {
  if (!confirm(user.nickname + ' 계정 정지를 풀까요?')) return;
  await api('users/' + user.id + '/unsuspend', {}); load();
}
function lines(list, targetId) {
  const box = el('div', undefined, 'lines');
  if (!list.length) box.append(el('div', '(기록 없음)'));
  for (const line of list) {
    const who = line.uid ?? line.from;
    const row = el('div', (line.at || line.created ? when(line.at || line.created) + '  ' : '') + '[' + who + '] ' + (line.text ?? line.body ?? JSON.stringify(line)));
    if (who === targetId) row.className = 'target';
    box.append(row);
  }
  return box;
}
async function load() {
  const data = await api('reports?status=' + $('#status').value);
  const root = $('#reports'); root.textContent = '';
  if (!data.reports.length) root.append(el('p', '신고가 없어요.'));
  for (const r of data.reports) {
    const card = el('div', undefined, 'card');
    card.append(el('div', '#' + r.id + '  ' + when(r.created) + '  (' + r.context.kind + (r.context.room ? ' ' + r.context.game + '/' + r.context.room : '') + ')', 'meta'));
    card.append(el('div', r.reporter.nickname + '(' + r.reporter.id + ') 님이 ' + r.target.nickname + '(' + r.target.id + ') 님을 신고' + (r.target.suspended ? ' (정지됨)' : '')));
    if (r.reason) card.append(el('div', '이유: ' + r.reason));
    const ev = r.evidence || {};
    card.append(el('div', '서버가 모은 기록' + (ev.error ? ' (' + ev.error + ')' : ''), 'meta'));
    card.append(lines(ev.messages || ev.lines || [], r.target.id));
    if (r.clientMessages && r.clientMessages.length) {
      card.append(el('div', '신고한 사람이 보낸 기록', 'meta'));
      card.append(lines(r.clientMessages.map(m => typeof m === 'string' ? { text: m } : m), r.target.id));
    }
    if (r.status === 'open') {
      const b1 = el('button', '계정 정지', 'danger'); b1.onclick = () => suspend(r.target);
      const b2 = el('button', '무시'); b2.onclick = async () => { await api('reports/' + r.id + '/dismiss', {}); load(); };
      card.append(b1, b2);
    } else if (r.target.suspended) {
      const b = el('button', '정지 풀기'); b.onclick = () => unsuspend(r.target); card.append(b);
    }
    root.append(card);
  }
}
$('#status').onchange = load;
$('#search').onsubmit = async e => {
  e.preventDefault();
  const data = await api('users?q=' + encodeURIComponent($('#q').value));
  const table = $('#users'); table.textContent = '';
  for (const u of data.users) {
    const tr = el('tr');
    tr.append(el('td', u.id), el('td', u.nickname), el('td', when(u.created)), el('td', '신고 ' + u.reports), el('td', u.suspended_at ? '정지됨: ' + (u.suspended_reason || '') : ''));
    const td = el('td'); const b = u.suspended_at ? el('button', '정지 풀기') : el('button', '정지', 'danger');
    b.onclick = () => (u.suspended_at ? unsuspend(u) : suspend(u)); td.append(b); tr.append(td); table.append(tr);
  }
};
load();
</script>
</body></html>`;
