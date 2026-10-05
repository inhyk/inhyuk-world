// 게임 저장(클라우드 세이브): 같은 계정이면 다른 기기에서도 이어 한다.
// 서버는 저장 내용을 모르고 합치지도 않는다. 고칠 때는 내가 마지막으로 본 revision(baseRevision)을 같이 보내고,
// 그 사이 다른 기기가 먼저 고쳤으면 409 와 서버 쪽 저장을 돌려준다. 어떤 값을 쓸지는 게임별 adapter 가 정한다.
import { json, fail, readJson, now } from './http.js';
import { requireUser, limit } from './auth.js';
import { GAME_RE } from './rooms.js';

export const SAVE_MAX_BYTES = 32 * 1024;
const PUTS_PER_MINUTE = 30;
const IMPORT_RE = /^[A-Za-z0-9_-]{8,64}$/;

function gameOf(params) {
  const game = String(params.game ?? '');
  if (!GAME_RE.test(game)) fail(400, 'bad-game');
  return game;
}

const current = (env, userId, game) =>
  env.DB.prepare('SELECT data, revision, updated_at FROM saves WHERE user_id = ? AND game = ?').bind(userId, game).first();
const view = row => ({ data: row ? JSON.parse(row.data) : null, revision: row?.revision ?? 0, updated: row?.updated_at ?? null });

// GET /saves/:game → { data, revision, updated }, 없으면 404 no-save
export async function load(request, env, params) {
  const me = await requireUser(request, env);
  const game = gameOf(params);
  const row = await current(env, me.id, game);
  if (!row) fail(404, 'no-save');
  return json(view(row));
}

// PUT /saves/:game { data, baseRevision, importId? } → { revision, updated }
// baseRevision 이 지금 revision 과 같을 때만 쓴다(저장이 없으면 0 또는 null). 다르면 409 { error:'conflict', data, revision, updated }.
export async function store(request, env, params) {
  const me = await requireUser(request, env);
  const game = gameOf(params);
  const body = await readJson(request);
  const { data } = body;
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail(400, 'bad-save');
  const text = JSON.stringify(data);
  if (new TextEncoder().encode(text).length > SAVE_MAX_BYTES) fail(413, 'too-big');
  const base = body.baseRevision ?? 0;
  if (!Number.isSafeInteger(base) || base < 0) fail(400, 'bad-revision');
  const importId = body.importId ?? null;
  if (importId !== null && (typeof importId !== 'string' || !IMPORT_RE.test(importId))) fail(400, 'bad-import');
  await limit(env, `save:${me.id}`, 60 * 1000, PUTS_PER_MINUTE);

  // 이미 올린 importId 면 쓰지 않고 지금 것을 알려 준다 (응답을 못 받고 다시 보낸 경우).
  if (importId) {
    const seen = await env.DB.prepare('SELECT 1 FROM save_imports WHERE user_id = ? AND game = ? AND import_id = ?').bind(me.id, game, importId).first();
    if (seen) {
      const { revision, updated } = view(await current(env, me.id, game));
      return json({ revision, updated, duplicate: true });
    }
  }

  const t = now();
  const write = base === 0
    ? env.DB.prepare('INSERT INTO saves (user_id, game, data, revision, updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT DO NOTHING RETURNING revision, updated_at')
      .bind(me.id, game, text, t)
    : env.DB.prepare('UPDATE saves SET data = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND game = ? AND revision = ? RETURNING revision, updated_at')
      .bind(text, t, me.id, game, base);
  // 쓰기와 importId 기록은 한 번에(트랜잭션). 쓰기가 안 됐으면(changes() = 0) importId 도 적지 않는다.
  const statements = [write];
  if (importId) {
    statements.push(env.DB.prepare('INSERT OR IGNORE INTO save_imports (user_id, game, import_id, created) SELECT ?, ?, ?, ? WHERE changes() > 0')
      .bind(me.id, game, importId, t));
  }
  const [written] = await env.DB.batch(statements);
  const row = written.results[0];
  if (!row) fail(409, 'conflict', view(await current(env, me.id, game)));
  return json({ revision: row.revision, updated: row.updated_at });
}
