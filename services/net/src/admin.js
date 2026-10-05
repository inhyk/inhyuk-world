// 관리 페이지 (/admin) 와 관리 API (/admin/api/*).
// Cloudflare Access 가 앞에서 이메일 인증(일회용 코드)을 하고, 여기서는 Access 가 붙여 준 JWT
// (Cf-Access-Jwt-Assertion) 를 다시 검사한다: RS256 서명, aud, iss, 만료, 관리자 이메일 목록.
// ACCESS_TEAM_DOMAIN, ACCESS_AUD, ADMIN_EMAILS 중 하나라도 비어 있으면 무조건 403 (닫힘).
import { json, now, userId } from './http.js';
import { lobby } from './social.js';

const KEYS_TTL_MS = 10 * 60 * 1000;
const keyCache = new Map(); // team → { at, keys: Map(kid → CryptoKey) }

const b64urlBytes = text => {
  const s = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
};
const b64urlJson = text => JSON.parse(new TextDecoder().decode(b64urlBytes(text)));

export function accessConfig(env) {
  const team = String(env?.ACCESS_TEAM_DOMAIN ?? '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const aud = String(env?.ACCESS_AUD ?? '').trim();
  const admins = String(env?.ADMIN_EMAILS ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!team || !aud || !admins.length) return null;
  return { team, aud, admins, issuer: `https://${team}` };
}

async function accessKeys(team, refresh = false) {
  const cached = keyCache.get(team);
  if (cached && !refresh && now() - cached.at < KEYS_TTL_MS) return cached.keys;
  const response = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!response.ok) throw Error(`certs ${response.status}`);
  const body = await response.json();
  const keys = new Map();
  for (const jwk of body.keys ?? []) {
    if (jwk.kty !== 'RSA' || !jwk.kid) continue;
    keys.set(jwk.kid, await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']));
  }
  keyCache.set(team, { at: now(), keys });
  return keys;
}

// 맞으면 관리자 이메일, 아니면 ''.
export async function verifyAccessJwt(token, env) {
  const config = accessConfig(env);
  if (!config || typeof token !== 'string') return '';
  const parts = token.split('.');
  if (parts.length !== 3) return '';
  try {
    const header = b64urlJson(parts[0]);
    const payload = b64urlJson(parts[1]);
    if (header.alg !== 'RS256' || !header.kid) return '';
    let key = (await accessKeys(config.team)).get(header.kid);
    if (!key) key = (await accessKeys(config.team, true)).get(header.kid); // 키가 바뀌었을 수 있다
    if (!key) return '';
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!ok) return '';
    const t = now() / 1000;
    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (payload.iss !== config.issuer || !auds.includes(config.aud)) return '';
    if (typeof payload.exp !== 'number' || payload.exp < t) return '';
    if (typeof payload.nbf === 'number' && payload.nbf > t + 60) return '';
    const email = String(payload.email ?? '').toLowerCase();
    return config.admins.includes(email) ? email : '';
  } catch (error) {
    console.error('access verify failed', error?.message);
    return '';
  }
}

const SECURITY = {
  'Cache-Control': 'no-store',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

export async function handleAdmin(request, env, parts) {
  const email = await verifyAccessJwt(request.headers.get('Cf-Access-Jwt-Assertion'), env);
  if (!email) return new Response('forbidden', { status: 403, headers: SECURITY });
  const url = new URL(request.url);
  // 관리 API 는 같은 주소의 페이지에서만 부른다 (다른 사이트가 몰래 부르지 못하게).
  const origin = request.headers.get('Origin');
  if (request.method !== 'GET' && origin !== url.origin) return new Response('forbidden', { status: 403, headers: SECURITY });

  if (parts.length === 0 && request.method === 'GET') {
    return new Response(PAGE, { headers: { ...SECURITY, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'" } });
  }
  if (parts[0] !== 'api') return new Response('not found', { status: 404, headers: SECURITY });
  const respond = (body, status = 200) => json(body, status, SECURITY);
  const path = parts.slice(1).join('/');
  const db = env.DB;

  if (request.method === 'GET' && path === 'reports') {
    const status = ['open', 'dismissed', 'actioned'].includes(url.searchParams.get('status')) ? url.searchParams.get('status') : 'open';
    const { results } = await db.prepare(`
      SELECT r.*, a.nickname AS reporter_nickname, b.nickname AS target_nickname, b.suspended_at AS target_suspended_at
      FROM reports r JOIN users a ON a.id = r.reporter_id JOIN users b ON b.id = r.target_id
      WHERE r.status = ? ORDER BY r.id DESC LIMIT 100`).bind(status).all();
    return respond({
      email,
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
      db.prepare("UPDATE reports SET status = 'dismissed', resolved_at = ?, resolved_by = ? WHERE id = ?").bind(now(), email, id),
      db.prepare('INSERT INTO admin_actions (admin_email, action, target_id, detail, created) VALUES (?, ?, ?, ?, ?)').bind(email, 'dismiss-report', null, String(id), now()),
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
        db.prepare("UPDATE reports SET status = 'actioned', resolved_at = ?, resolved_by = ? WHERE target_id = ? AND status = 'open'").bind(now(), email, id),
        db.prepare('INSERT INTO admin_actions (admin_email, action, target_id, detail, created) VALUES (?, ?, ?, ?, ?)').bind(email, 'suspend', id, reason, now()),
      ]);
      await lobby(env).kick(id, 'suspended'); // 접속 중이면 바로 끊는다
    } else {
      await db.batch([
        db.prepare('UPDATE users SET suspended_at = NULL, suspended_reason = NULL WHERE id = ?').bind(id),
        db.prepare('INSERT INTO admin_actions (admin_email, action, target_id, detail, created) VALUES (?, ?, ?, ?, ?)').bind(email, 'unsuspend', id, reason, now()),
      ]);
    }
    return respond({ ok: true });
  }

  return respond({ error: 'not-found' }, 404);
}

const PAGE = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>net 관리</title>
<style>
  body { font: 15px/1.5 system-ui, sans-serif; margin: 0 auto; max-width: 960px; padding: 16px; color: #222; background: #fafafa; }
  h1 { font-size: 20px; } h2 { font-size: 17px; margin-top: 28px; }
  .card { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin: 10px 0; }
  .meta { color: #666; font-size: 13px; }
  .lines { background: #f4f4f4; border-radius: 6px; padding: 8px; margin: 8px 0; max-height: 260px; overflow: auto; font-size: 14px; }
  .lines div { white-space: pre-wrap; word-break: break-all; }
  .target { color: #b00020; font-weight: 600; }
  button { font: inherit; padding: 4px 10px; margin-right: 6px; border-radius: 6px; border: 1px solid #aaa; background: #fff; cursor: pointer; }
  button.danger { border-color: #b00020; color: #b00020; }
  input { font: inherit; padding: 4px 8px; }
  table { border-collapse: collapse; width: 100%; } td, th { border-bottom: 1px solid #eee; padding: 6px; text-align: left; }
</style></head>
<body>
<h1>net 관리</h1>
<p class="meta" id="who"></p>
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
  $('#who').textContent = data.email + ' 로 들어옴';
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
