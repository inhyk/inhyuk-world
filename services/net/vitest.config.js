import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';

export default defineConfig(async () => ({
  plugins: [cloudflareTest({
    wrangler: { configPath: './wrangler.jsonc' },
    miniflare: {
      bindings: {
        TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, 'migrations')),
        // 관리 페이지 시험용 비밀번호 (배포에서는 wrangler secret 으로 넣는다)
        ADMIN_PASSWORD: 'test-admin-password',
      },
    },
  })],
  test: { include: ['test/**/*.test.js'], setupFiles: ['./test/setup.js'] },
}));
