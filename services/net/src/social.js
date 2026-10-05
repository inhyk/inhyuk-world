// 친구, 검색, 차단, 1:1 대화, 초대, 신고 (D1 + 로비)
import { json, fail, readJson, now, userId } from './http.js';
import { requireUser, limit, publicUser, cleanNickname } from './auth.js';
import { filterText, DM_MAX } from './filter.js';
import { GAME_RE, CODE_RE, roomStub } from './rooms.js';

const DM_PER_MINUTE = 20;
const PAGE = 50;
const REQUESTS_PER_HOUR = 30;
const REPORTS_PER_HOUR = 10;
const SEARCHES_PER_MINUTE = 30;
const REPORT_TEXT_MAX = 300;

export const lobby = env => env.LOBBY.get(env.LOBBY.idFromName('lobby'));

// 알림은 실패해도 요청 자체는 성공으로 둔다 (상대가 접속 안 했을 수도 있다).
async function push(env, uid, event) {
  try { await lobby(env).push(uid, event); } catch (error) { console.error('push failed', error?.message); }
}
// 사람이 들어간 방과 매칭 줄을 로비에 적어 둔다 (정지할 때 그 연결들도 끊으려고).
export async function track(env, uid, kind, name) {
  try { await lobby(env).track(uid, kind, name); } catch (error) { console.error('track failed', error?.message); }
}
async function onlineIds(env, ids) {
  if (!ids.length) return [];
  try { return await lobby(env).online(ids); } catch { return []; }
}

async function findUser(env, id) {
  return env.DB.prepare('SELECT id, nickname, suspended_at FROM users WHERE id = ?').bind(id).first();
}

export async function blockedEither(env, a, b) {
  const row = await env.DB.prepare(
    'SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?) LIMIT 1',
  ).bind(a, b, b, a).first();
  return !!row;
}

async function areFriends(env, a, b) {
  return !!(await env.DB.prepare('SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?').bind(a, b).first());
}

// 상대를 찾는다. 없거나, 정지됐거나, 서로 차단했으면 똑같이 "없음"으로 답한다 (차단 여부를 알려 주지 않는다).
async function reachable(env, me, id) {
  if (id === me.id) fail(400, 'self');
  const other = await findUser(env, id);
  if (!other || other.suspended_at || (await blockedEither(env, me.id, id))) fail(404, 'not-found');
  return publicUser(other);
}

// ---- 검색 ----

// GET /users/search?q=  닉네임 앞부분이 같은 사람 20명까지 (q 는 두 글자 이상)
export async function search(request, env, _params, url) {
  const me = await requireUser(request, env);
  const q = cleanNickname(url.searchParams.get('q')).slice(0, 10);
  // 한 글자로 훑어 모든 닉네임을 모으지 못하게 두 글자부터 찾는다. 1분에 30번까지.
  if ([...q].length < 2) return json({ users: [] });
  await limit(env, `search:${me.id}`, 60 * 1000, SEARCHES_PER_MINUTE);
  const like = q.replace(/[\\%_]/g, ch => `\\${ch}`) + '%';
  const { results } = await env.DB.prepare(`
    SELECT u.id, u.nickname,
      EXISTS (SELECT 1 FROM friends f WHERE f.user_id = ?1 AND f.friend_id = u.id) AS friend,
      EXISTS (SELECT 1 FROM friend_requests r WHERE r.from_id = ?1 AND r.to_id = u.id) AS requested,
      EXISTS (SELECT 1 FROM friend_requests r WHERE r.from_id = u.id AND r.to_id = ?1) AS requested_me
    FROM users u
    WHERE u.nickname LIKE ?2 ESCAPE '\\' AND u.id != ?1 AND u.suspended_at IS NULL
      AND u.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?1)
      AND u.id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = ?1)
    ORDER BY length(u.nickname), u.nickname LIMIT 20`).bind(me.id, like).all();
  return json({
    users: results.map(r => ({ id: r.id, nickname: r.nickname, friend: !!r.friend, requested: !!r.requested, requestedMe: !!r.requested_me })),
  });
}

// ---- 친구 ----

export async function listFriends(request, env) {
  const me = await requireUser(request, env);
  const { results } = await env.DB.prepare(
    'SELECT u.id, u.nickname, f.created FROM friends f JOIN users u ON u.id = f.friend_id WHERE f.user_id = ? AND u.suspended_at IS NULL ORDER BY u.nickname',
  ).bind(me.id).all();
  const online = new Set(await onlineIds(env, results.map(r => r.id)));
  return json({ friends: results.map(r => ({ id: r.id, nickname: r.nickname, since: r.created, online: online.has(r.id) })) });
}

async function makeFriends(env, a, b) {
  const t = now();
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id, created) VALUES (?, ?, ?)').bind(a, b, t),
    env.DB.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id, created) VALUES (?, ?, ?)').bind(b, a, t),
    env.DB.prepare('DELETE FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)').bind(a, b, b, a),
  ]);
}

async function unfriend(env, a, b) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').bind(a, b, b, a),
    env.DB.prepare('DELETE FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)').bind(a, b, b, a),
  ]);
}

// 친구가 됐다고 상대에게 알리고, 상대가 접속 중인지 붙여 돌려준다.
async function announceFriends(env, me, other) {
  const on = new Set(await onlineIds(env, [me.id, other.id]));
  await push(env, other.id, { t: 'friend-accepted', friend: { id: me.id, nickname: me.nickname, online: on.has(me.id) } });
  return { ...other, online: on.has(other.id) };
}

export async function removeFriend(request, env, params) {
  const me = await requireUser(request, env);
  const id = userId(params.id);
  const was = await areFriends(env, me.id, id);
  await unfriend(env, me.id, id);
  if (was) await push(env, id, { t: 'friend-removed', id: me.id });
  return json({ ok: true });
}

export async function listRequests(request, env) {
  const me = await requireUser(request, env);
  const [incoming, outgoing] = await env.DB.batch([
    env.DB.prepare('SELECT u.id, u.nickname, r.created FROM friend_requests r JOIN users u ON u.id = r.from_id WHERE r.to_id = ? AND u.suspended_at IS NULL ORDER BY r.created DESC').bind(me.id),
    env.DB.prepare('SELECT u.id, u.nickname, r.created FROM friend_requests r JOIN users u ON u.id = r.to_id WHERE r.from_id = ? ORDER BY r.created DESC').bind(me.id),
  ]);
  return json({ incoming: incoming.results, outgoing: outgoing.results });
}

// POST /friends/requests { nickname } 또는 { id }. 상대도 나에게 요청해 둔 상태면 바로 친구가 된다.
export async function sendRequest(request, env) {
  const me = await requireUser(request, env);
  const body = await readJson(request);
  let id;
  if (body.id !== undefined) id = userId(body.id);
  else {
    const row = await env.DB.prepare('SELECT id FROM users WHERE nickname = ?').bind(cleanNickname(body.nickname)).first();
    if (!row) fail(404, 'not-found');
    id = row.id;
  }
  const other = await reachable(env, me, id);
  if (await areFriends(env, me.id, id)) return json({ status: 'friends', friend: other });
  const reverse = await env.DB.prepare('SELECT 1 FROM friend_requests WHERE from_id = ? AND to_id = ?').bind(id, me.id).first();
  if (reverse) {
    await makeFriends(env, me.id, id);
    return json({ status: 'friends', friend: await announceFriends(env, me, other) });
  }
  await limit(env, `friend-request:${me.id}`, 60 * 60 * 1000, REQUESTS_PER_HOUR);
  const result = await env.DB.prepare('INSERT OR IGNORE INTO friend_requests (from_id, to_id, created) VALUES (?, ?, ?)').bind(me.id, id, now()).run();
  if (result.meta.changes) await push(env, id, { t: 'friend-request', from: { id: me.id, nickname: me.nickname } });
  return json({ status: 'requested', to: other }, 201);
}

export async function acceptRequest(request, env, params) {
  const me = await requireUser(request, env);
  const id = userId(params.id);
  const row = await env.DB.prepare('SELECT 1 FROM friend_requests WHERE from_id = ? AND to_id = ?').bind(id, me.id).first();
  if (!row) fail(404, 'not-found');
  const other = await reachable(env, me, id);
  await makeFriends(env, me.id, id);
  return json({ status: 'friends', friend: await announceFriends(env, me, other) });
}

export async function declineRequest(request, env, params) {
  const me = await requireUser(request, env);
  const id = userId(params.id);
  await env.DB.prepare('DELETE FROM friend_requests WHERE from_id = ? AND to_id = ?').bind(id, me.id).run();
  return json({ ok: true });
}

export async function cancelRequest(request, env, params) {
  const me = await requireUser(request, env);
  const id = userId(params.id);
  await env.DB.prepare('DELETE FROM friend_requests WHERE from_id = ? AND to_id = ?').bind(me.id, id).run();
  return json({ ok: true });
}

// ---- 차단 ----

export async function listBlocks(request, env) {
  const me = await requireUser(request, env);
  const { results } = await env.DB.prepare(
    'SELECT u.id, u.nickname, b.created FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = ? ORDER BY b.created DESC',
  ).bind(me.id).all();
  return json({ blocks: results });
}

// 차단하면 친구 사이와 오가던 친구 요청도 지운다. 차단당한 사람에게는 알리지 않는다.
export async function block(request, env, params) {
  const me = await requireUser(request, env);
  const id = userId(params.id);
  if (id === me.id) fail(400, 'self');
  if (!(await findUser(env, id))) fail(404, 'not-found');
  await env.DB.prepare('INSERT OR IGNORE INTO blocks (blocker_id, blocked_id, created) VALUES (?, ?, ?)').bind(me.id, id, now()).run();
  await unfriend(env, me.id, id);
  return json({ ok: true });
}

export async function unblock(request, env, params) {
  const me = await requireUser(request, env);
  const id = userId(params.id);
  await env.DB.prepare('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?').bind(me.id, id).run();
  return json({ ok: true });
}

// ---- 1:1 대화 ----

const dmRow = r => ({ id: r.id, from: r.from_id, to: r.to_id, body: r.body, created: r.created, read: r.read_at ?? null });

// GET /dm  안 읽은 메시지가 있는 친구들
export async function unread(request, env) {
  const me = await requireUser(request, env);
  const { results } = await env.DB.prepare(`
    SELECT d.from_id AS id, u.nickname, count(*) AS count, max(d.id) AS last
    FROM dms d JOIN users u ON u.id = d.from_id
    WHERE d.to_id = ? AND d.read_at IS NULL GROUP BY d.from_id ORDER BY last DESC`).bind(me.id).all();
  return json({ unread: results.map(r => ({ id: r.id, nickname: r.nickname, count: r.count })) });
}

// GET /dm/:id?before=<메시지 번호>  오래된 쪽으로 50개씩. 결과는 오래된 것부터.
export async function history(request, env, params, url) {
  const me = await requireUser(request, env);
  const id = userId(params.id);
  const before = Number(url.searchParams.get('before')) || Number.MAX_SAFE_INTEGER;
  const { results } = await env.DB.prepare(`
    SELECT * FROM dms WHERE ((from_id = ?1 AND to_id = ?2) OR (from_id = ?2 AND to_id = ?1)) AND id < ?3
    ORDER BY id DESC LIMIT ?4`).bind(me.id, id, before, PAGE + 1).all();
  const more = results.length > PAGE;
  return json({ messages: results.slice(0, PAGE).reverse().map(dmRow), more });
}

// POST /dm/:id { body }  친구에게만. 300글자까지, 1분에 20개까지. 거른 글만 저장하고 보낸다.
export async function sendDm(request, env, params) {
  const me = await requireUser(request, env);
  const id = userId(params.id);
  const body = await readJson(request);
  if (typeof body.body !== 'string') fail(400, 'empty');
  if ([...body.body.trim()].length > DM_MAX) fail(400, 'too-long');
  // 내가 막은 사람이면 'blocked'. 상대가 나를 막았으면 친구가 아닌 것과 똑같이 'not-friends' (차단 사실을 알리지 않는다).
  if (await env.DB.prepare('SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?').bind(me.id, id).first()) fail(403, 'blocked');
  if ((await blockedEither(env, me.id, id)) || !(await areFriends(env, me.id, id))) fail(403, 'not-friends');
  const { text, kinds } = filterText(body.body, { max: DM_MAX });
  if (!text) fail(400, 'empty');
  await limit(env, `dm:${me.id}`, 60 * 1000, DM_PER_MINUTE);
  const row = await env.DB.prepare('INSERT INTO dms (from_id, to_id, body, created) VALUES (?, ?, ?, ?) RETURNING *').bind(me.id, id, text, now()).first();
  const message = dmRow(row);
  await push(env, id, { t: 'dm', message, from: { id: me.id, nickname: me.nickname } });
  return json({ message, filtered: kinds }, 201);
}

export async function markRead(request, env, params) {
  const me = await requireUser(request, env);
  const id = userId(params.id);
  const result = await env.DB.prepare('UPDATE dms SET read_at = ? WHERE from_id = ? AND to_id = ? AND read_at IS NULL').bind(now(), id, me.id).run();
  return json({ ok: true, count: result.meta.changes });
}

// ---- 초대 ----

// POST /invites { to: 친구 번호, game }  접속 중인 친구에게만. 60초 안에 답이 없으면 사라진다.
export async function invite(request, env) {
  const me = await requireUser(request, env);
  const body = await readJson(request);
  const id = userId(body.to);
  const game = String(body.game ?? '');
  if (!GAME_RE.test(game)) fail(400, 'bad-game');
  const other = await reachable(env, me, id);
  if (!(await areFriends(env, me.id, id))) fail(403, 'not-friends');
  const result = await lobby(env).createInvite({ id: me.id, nickname: me.nickname }, other, game);
  if (result.error) fail(409, result.error);
  return json({ invite: { id: result.id, to: other, game, expires: result.expires } }, 201);
}

export async function acceptInvite(request, env, params) {
  const me = await requireUser(request, env);
  const result = await lobby(env).answerInvite(String(params.id), { id: me.id, nickname: me.nickname }, true);
  if (result.error) fail(result.error === 'not-found' ? 404 : 409, result.error);
  return json(result);
}

export async function declineInvite(request, env, params) {
  const me = await requireUser(request, env);
  const result = await lobby(env).answerInvite(String(params.id), { id: me.id, nickname: me.nickname }, false);
  if (result.error) fail(result.error === 'not-found' ? 404 : 409, result.error);
  return json(result);
}

export async function cancelInvite(request, env, params) {
  const me = await requireUser(request, env);
  const result = await lobby(env).cancelInvite(String(params.id), { id: me.id, nickname: me.nickname });
  if (result.error) fail(404, result.error);
  return json(result);
}

// ---- 신고 ----

// 신고한 사람이 보낸 기록은 글자만 { text } 로 남긴다 (마지막 50개, 한 줄 300글자).
function clientMessages(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-PAGE)
    .map(m => (typeof m === 'string' ? m : typeof m?.text === 'string' ? m.text : null))
    .filter(text => text !== null)
    .map(text => ({ text: [...text].slice(0, REPORT_TEXT_MAX).join('') }));
}

// POST /reports { target, context: { kind: 'dm'|'room'|'profile', game, room }, reason, messages }
// 서버가 직접 증거를 모은다: 1:1 대화는 두 사람 사이 마지막 50개, 대전 채팅은 그 방이 기억하는 마지막 50줄.
// 신고한 사람이 보낸 messages 는 따로(client_messages) 저장한다.
export async function report(request, env) {
  const me = await requireUser(request, env);
  const body = await readJson(request);
  const target = userId(body.target);
  if (target === me.id) fail(400, 'self');
  const targetRow = await findUser(env, target);
  if (!targetRow) fail(404, 'not-found');
  await limit(env, `report:${me.id}`, 60 * 60 * 1000, REPORTS_PER_HOUR);
  const kind = ['dm', 'room', 'profile'].includes(body.context?.kind) ? body.context.kind : 'profile';
  const context = { kind };
  let evidence;
  if (kind === 'dm') {
    const { results } = await env.DB.prepare(`
      SELECT * FROM dms WHERE (from_id = ?1 AND to_id = ?2) OR (from_id = ?2 AND to_id = ?1) ORDER BY id DESC LIMIT ?3`)
      .bind(me.id, target, PAGE).all();
    evidence = { messages: results.reverse().map(dmRow) };
  } else if (kind === 'room') {
    const game = String(body.context.game ?? ''), code = String(body.context.room ?? '').toUpperCase();
    if (!GAME_RE.test(game) || !CODE_RE.test(code)) fail(400, 'bad-room');
    Object.assign(context, { game, room: code });
    const log = await roomStub(env, game, code).chatLog();
    // 신고한 사람이 그 방에 있었을 때만 방 기록을 가져온다.
    evidence = log.users.includes(me.id)
      ? { lines: log.lines, users: log.users, targetWasThere: log.users.includes(target) }
      : { error: 'not-in-room' };
  } else {
    evidence = { nickname: targetRow.nickname };
  }
  // 이유는 관리자만 보므로 거르지 않고 그대로(200글자까지) 둔다.
  const reason = typeof body.reason === 'string' ? [...body.reason].slice(0, 200).join('') : null;
  const row = await env.DB.prepare(`
    INSERT INTO reports (reporter_id, target_id, context, reason, client_messages, evidence, created)
    VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`)
    .bind(me.id, target, JSON.stringify(context), reason, JSON.stringify(clientMessages(body.messages)), JSON.stringify(evidence), now()).first();
  return json({ id: row.id }, 201);
}
