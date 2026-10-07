-- 게임 기록(레벨, 트로피, 온라인 승리)과 지금 하는 대전 목록 (온라인 랭킹, 관전)
-- 적용: npx wrangler d1 migrations apply net --remote

-- 사람마다, 게임마다 한 줄. level, xp, trophies 는 게임이 올리고(PUT /stats/:game),
-- online_wins 는 서버가 센다 (랜덤 매칭, 초대로 만든 방에서 두 사람이 보낸 결과 보고).
CREATE TABLE player_stats (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  trophies INTEGER NOT NULL DEFAULT 0,
  online_wins INTEGER NOT NULL DEFAULT 0,
  top5_at INTEGER,              -- 세 랭킹 중 하나에서 처음 5등 안에 든 때 (한 번 받으면 계속 가진다)
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, game)
);
CREATE INDEX player_stats_trophies ON player_stats(game, trophies);
CREATE INDEX player_stats_level ON player_stats(game, level, xp);
CREATE INDEX player_stats_wins ON player_stats(game, online_wins);

-- 랜덤 매칭이나 초대로 만든 방에 두 사람이 다 들어와 있는 동안 적어 둔다 (관전 목록). 방이 비면 지운다.
CREATE TABLE live_rooms (
  game TEXT NOT NULL,
  code TEXT NOT NULL,
  p1 INTEGER NOT NULL,
  p2 INTEGER NOT NULL,
  started INTEGER NOT NULL,
  updated INTEGER NOT NULL,
  PRIMARY KEY (game, code)
);
CREATE INDEX live_rooms_updated ON live_rooms(game, updated);
