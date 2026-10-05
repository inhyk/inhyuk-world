-- 계정, 친구, 차단, 1:1 대화, 신고, 관리 기록 (D1 데이터베이스 net)
-- 적용: npx wrangler d1 migrations apply net --remote

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL UNIQUE COLLATE NOCASE,   -- 영어 대소문자를 가리지 않고 하나뿐
  pass_hash TEXT NOT NULL,                        -- PBKDF2-SHA256 결과 (base64)
  salt TEXT NOT NULL,                             -- 사람마다 다른 소금 (base64)
  iterations INTEGER NOT NULL,
  created INTEGER NOT NULL,
  suspended_at INTEGER,
  suspended_reason TEXT
);

-- 로그인 토큰. 토큰 원문은 저장하지 않고 SHA-256 만 저장한다.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

-- WebSocket 에 들어갈 때 쓰는 한 번짜리 표 (60초)
CREATE TABLE tickets (
  hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL
);

-- 횟수 제한 기록 (로그인 실패, 가입, 친구 요청, 신고)
CREATE TABLE throttle (
  key TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX throttle_key ON throttle(key, at);

CREATE TABLE friend_requests (
  from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created INTEGER NOT NULL,
  PRIMARY KEY (from_id, to_id)
);
CREATE INDEX friend_requests_to ON friend_requests(to_id);

-- 친구는 양쪽으로 한 줄씩 (A→B, B→A)
CREATE TABLE friends (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created INTEGER NOT NULL,
  PRIMARY KEY (user_id, friend_id)
);

CREATE TABLE blocks (
  blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created INTEGER NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);
CREATE INDEX blocks_blocked ON blocks(blocked_id);

-- 1:1 대화. 거르개를 거친 글만 저장한다.
CREATE TABLE dms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created INTEGER NOT NULL,
  read_at INTEGER
);
CREATE INDEX dms_pair ON dms(from_id, to_id, id);
CREATE INDEX dms_unread ON dms(to_id, read_at);

-- 신고. evidence 는 서버가 직접 모은 기록, client_messages 는 신고한 사람이 보낸 기록.
CREATE TABLE reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  context TEXT NOT NULL,          -- JSON {kind:'dm'|'room'|'profile', game, room}
  reason TEXT,
  client_messages TEXT,           -- JSON
  evidence TEXT,                  -- JSON
  created INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',   -- open | dismissed | actioned
  resolved_at INTEGER,
  resolved_by TEXT
);
CREATE INDEX reports_status ON reports(status, id);

CREATE TABLE admin_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id INTEGER,
  detail TEXT,
  created INTEGER NOT NULL
);
