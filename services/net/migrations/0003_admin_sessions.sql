-- 관리 페이지 로그인(관리자 비밀번호). Cloudflare Access 대신 쓴다.
-- 적용: npx wrangler d1 migrations apply net --remote

-- 관리자 로그인. 토큰 원문은 저장하지 않고 SHA-256(hex) 만. 12시간 뒤 끝난다.
-- fingerprint: 로그인할 때의 ADMIN_PASSWORD SHA-256 앞 16글자. 비밀번호를 바꾸면 맞지 않아 예전 로그인이 모두 풀린다.
CREATE TABLE admin_sessions (
  token_hash TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  created INTEGER NOT NULL,
  expires INTEGER NOT NULL,
  ip TEXT
);
CREATE INDEX admin_sessions_expires ON admin_sessions (expires);

-- 관리 동작 기록: 이메일 대신 누가(지금은 언제나 'admin')와 IP.
ALTER TABLE admin_actions RENAME COLUMN admin_email TO actor;
ALTER TABLE admin_actions ADD COLUMN ip TEXT;
