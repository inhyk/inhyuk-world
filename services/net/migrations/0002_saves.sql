-- 게임 저장(클라우드 세이브): 사람마다, 게임마다 하나. 다른 기기에서 이어 하려고 쓴다.
-- 적용: npx wrangler d1 migrations apply net --remote

CREATE TABLE saves (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game TEXT NOT NULL,
  data TEXT NOT NULL,            -- JSON 객체 (32KB 까지)
  revision INTEGER NOT NULL,     -- 1부터, 고칠 때마다 1씩 오른다
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, game)
);

-- 기기에 있던 저장을 처음 올릴 때 쓴 importId. 같은 것을 또 올리면 다시 쓰지 않는다.
CREATE TABLE save_imports (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game TEXT NOT NULL,
  import_id TEXT NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY (user_id, game, import_id)
);
