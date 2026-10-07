// 게임 기록과 온라인 랭킹, 지금 하는 대전 목록(관전).
// - 레벨, 경험치, 트로피는 게임이 올린다(PUT /stats/:game). 온라인 승리는 서버가 센다:
//   랜덤 매칭, 초대로 만든 방에서 두 사람이 보낸 결과 보고가 같을 때(한 사람만 보냈으면 방이 빌 때) recordWin.
// - 랭킹은 세 가지: trophies(트로피), level(레벨, 같으면 경험치), wins(온라인 승리). 정지된 계정은 빠진다.
//   아직 아무것도 하지 않은 사람은 나오지 않는다: 트로피 1개, 온라인 승리 1번, 레벨 2부터 (갓 만든 계정이 5등 보상을 받지 않게).
//   등수는 "나보다 많은 사람 수 + 1" 이라 같은 기록이면 같은 등수다.
// - 세 랭킹 중 하나라도 5등 안에 들면 top5_at 을 적는다. 한 번 적으면 지우지 않는다(전용 보상은 계속 가진다).
// - 관전 목록(live_rooms)은 방(Room)이 두 사람이 다 들어왔을 때 적고, 방이 비면 지운다.
import { json, fail, readJson, now } from './http.js';
import { requireUser, limit } from './auth.js';
import { GAME_RE } from './rooms.js';

const PUTS_PER_MINUTE = 30;
export const RANK_PAGE = 50;
export const TOP_REWARD = 5;
const LIVE_STALE_MS = 12 * 60 * 1000; // 방이 이만큼 소식이 없으면 목록에서 뺀다 (방은 5분마다 소식을 적는다)
const LIVE_PAGE = 30;
export const LIMITS = { level: [1, 99], xp: [0, 100_000_000], trophies: [0, 10_000_000] };

// 랭킹마다: 누가 들어가는지(where), 줄 세우는 순서(order), 나보다 위인 사람(better)과 그 값(bind)
const BOARDS = {
  trophies: {
    where: 's.trophies > 0',
    order: 's.trophies DESC, s.level DESC, s.xp DESC, s.user_id',
    better: 's.trophies > ?', bind: me => [me.trophies], qualifies: me => me.trophies > 0,
    same: (a, b) => a.trophies === b.trophies,
  },
  level: {
    where: 's.level >= 2',
    order: 's.level DESC, s.xp DESC, s.user_id',
    better: '(s.level > ? OR (s.level = ? AND s.xp > ?))', bind: me => [me.level, me.level, me.xp], qualifies: me => me.level >= 2,
    same: (a, b) => a.level === b.level && a.xp === b.xp,
  },
  wins: {
    where: 's.online_wins > 0',
    order: 's.online_wins DESC, s.level DESC, s.xp DESC, s.user_id',
    better: 's.online_wins > ?', bind: me => [me.online_wins], qualifies: me => me.online_wins > 0,
    same: (a, b) => a.online_wins === b.online_wins,
  },
};
export const BOARD_NAMES = Object.keys(BOARDS);

function gameOf(params) {
  const game = String(params.game ?? '');
  if (!GAME_RE.test(game)) fail(400, 'bad-game');
  return game;
}

const statsRow = (env, userId, game) =>
  env.DB.prepare('SELECT level, xp, trophies, online_wins, top5_at FROM player_stats WHERE user_id = ? AND game = ?').bind(userId, game).first();

// PUT /stats/:game { level, xp, trophies } → { ok }
export async function putStats(request, env, params) {
  const me = await requireUser(request, env);
  const game = gameOf(params);
  const body = await readJson(request);
  const values = {};
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    const v = body?.[key];
    if (!Number.isSafeInteger(v) || v < min || v > max) fail(400, 'bad-stats');
    values[key] = v;
  }
  await limit(env, `stats:${me.id}`, 60 * 1000, PUTS_PER_MINUTE);
  await env.DB.prepare(
    `INSERT INTO player_stats (user_id, game, level, xp, trophies, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, game) DO UPDATE SET level = excluded.level, xp = excluded.xp, trophies = excluded.trophies, updated_at = excluded.updated_at`,
  ).bind(me.id, game, values.level, values.xp, values.trophies, now()).run();
  return json({ ok: true });
}

// 이 사람의 등수 (그 랭킹에 들지 못하면 null)
async function rankOf(env, game, board, mine) {
  const b = BOARDS[board];
  if (!mine || !b.qualifies(mine)) return null;
  const row = await env.DB.prepare(
    `SELECT count(*) AS n FROM player_stats s JOIN users u ON u.id = s.user_id
     WHERE s.game = ? AND u.suspended_at IS NULL AND ${b.where} AND ${b.better}`,
  ).bind(game, ...b.bind(mine)).first();
  return row.n + 1;
}

// GET /rankings/:game?by=trophies|level|wins
// → { by, list: [{ rank, id, nickname, level, xp, trophies, wins }], me: { rank, ranks: {trophies, level, wins}, level, trophies, wins, top5 } }
export async function rankings(request, env, params, url) {
  const me = await requireUser(request, env);
  const game = gameOf(params);
  const by = url.searchParams.get('by') ?? 'trophies';
  const board = BOARDS[by];
  if (!board) fail(400, 'bad-board');
  const { results } = await env.DB.prepare(
    `SELECT s.user_id AS id, u.nickname, s.level, s.xp, s.trophies, s.online_wins FROM player_stats s JOIN users u ON u.id = s.user_id
     WHERE s.game = ? AND u.suspended_at IS NULL AND ${board.where} ORDER BY ${board.order} LIMIT ?`,
  ).bind(game, RANK_PAGE).all();
  const list = [];
  results.forEach((r, i) => {
    const rank = i > 0 && board.same(results[i - 1], r) ? list[i - 1].rank : i + 1;
    list.push({ rank, id: r.id, nickname: r.nickname, level: r.level, xp: r.xp, trophies: r.trophies, wins: r.online_wins });
  });

  // 내 등수는 세 랭킹 모두 본다. 하나라도 5등 안이면 전용 보상(top5)을 적어 둔다.
  const mine = await statsRow(env, me.id, game);
  const ranks = {};
  for (const name of BOARD_NAMES) ranks[name] = await rankOf(env, game, name, mine);
  let top5 = !!mine?.top5_at;
  if (mine && !top5 && Object.values(ranks).some(r => r !== null && r <= TOP_REWARD)) {
    await env.DB.prepare('UPDATE player_stats SET top5_at = ? WHERE user_id = ? AND game = ? AND top5_at IS NULL').bind(now(), me.id, game).run();
    top5 = true;
  }
  return json({
    by, list,
    me: { rank: ranks[by], ranks, level: mine?.level ?? null, trophies: mine?.trophies ?? 0, wins: mine?.online_wins ?? 0, top5 },
  });
}

// GET /matches/:game → { matches: [{ code, started, friend, players: [{ id, nickname, level }, ...] }] }
// 지금 하는 대전 (관전할 수 있는 것). 내가 하는 대전, 나와 차단한 사이인 사람의 대전, 정지된 사람의 대전은 빠진다.
// 친구가 하는 대전이 먼저 나오고, 그다음 최근에 시작한 것부터.
export async function matches(request, env, params) {
  const me = await requireUser(request, env);
  const game = gameOf(params);
  const { results } = await env.DB.prepare(
    `SELECT r.code, r.started,
            u1.id AS id1, u1.nickname AS nick1, coalesce(s1.level, 1) AS level1,
            u2.id AS id2, u2.nickname AS nick2, coalesce(s2.level, 1) AS level2,
            EXISTS (SELECT 1 FROM friends f WHERE f.user_id = ?1 AND f.friend_id IN (r.p1, r.p2)) AS friend
     FROM live_rooms r
     JOIN users u1 ON u1.id = r.p1 JOIN users u2 ON u2.id = r.p2
     LEFT JOIN player_stats s1 ON s1.user_id = r.p1 AND s1.game = r.game
     LEFT JOIN player_stats s2 ON s2.user_id = r.p2 AND s2.game = r.game
     WHERE r.game = ?2 AND r.updated > ?3 AND r.p1 != ?1 AND r.p2 != ?1
       AND u1.suspended_at IS NULL AND u2.suspended_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ?1 AND b.blocked_id IN (r.p1, r.p2)) OR (b.blocked_id = ?1 AND b.blocker_id IN (r.p1, r.p2)))
     ORDER BY friend DESC, r.started DESC LIMIT ?4`,
  ).bind(me.id, game, now() - LIVE_STALE_MS, LIVE_PAGE).all();
  return json({
    matches: results.map(r => ({
      code: r.code, started: r.started, friend: !!r.friend,
      players: [{ id: r.id1, nickname: r.nick1, level: r.level1 }, { id: r.id2, nickname: r.nick2, level: r.level2 }],
    })),
  });
}

// ---- 방(Room)이 부르는 것 ----

// 온라인 승리 1개 (두 사람이 같은 결과를 보냈을 때, 또는 한 사람만 보내고 방이 비었을 때)
export async function recordWin(env, game, userId) {
  await env.DB.prepare(
    `INSERT INTO player_stats (user_id, game, online_wins, updated_at) VALUES (?, ?, 1, ?)
     ON CONFLICT (user_id, game) DO UPDATE SET online_wins = online_wins + 1, updated_at = excluded.updated_at`,
  ).bind(userId, game, now()).run();
}

export async function liveRoomStart(env, game, code, p1, p2) {
  const t = now();
  await env.DB.prepare('INSERT OR REPLACE INTO live_rooms (game, code, p1, p2, started, updated) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(game, code, p1, p2, t, t).run();
}
export async function liveRoomTouch(env, game, code) {
  await env.DB.prepare('UPDATE live_rooms SET updated = ? WHERE game = ? AND code = ?').bind(now(), game, code).run();
}
export async function liveRoomEnd(env, game, code) {
  await env.DB.prepare('DELETE FROM live_rooms WHERE game = ? AND code = ?').bind(game, code).run();
}
