// 시험마다 로컬 D1 에 migrations/ 를 적용한다 (이미 적용된 것은 건너뜀).
import { env, applyD1Migrations } from 'cloudflare:test';

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
