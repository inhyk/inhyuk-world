import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';

// 관리 페이지 시험용 Cloudflare Access 흉내: 여기서 만든 RSA 키로 JWT 를 서명하고,
// 서버가 받아 가는 공개키(certs)는 바깥 요청(outboundService)으로 돌려준다.
const TEAM = 'test-team.cloudflareaccess.com';
const pair = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const publicJwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'test-kid', alg: 'RS256', use: 'sig' };
const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);

export default defineConfig(async () => ({
  plugins: [cloudflareTest({
    wrangler: { configPath: './wrangler.jsonc' },
    miniflare: {
      bindings: {
        TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, 'migrations')),
        TEST_ACCESS_PRIVATE_JWK: privateJwk,
        ACCESS_TEAM_DOMAIN: TEAM,
        ACCESS_AUD: 'test-aud',
        ADMIN_EMAILS: 'kubony@gmail.com',
      },
      outboundService: request => {
        if (new URL(request.url).href === `https://${TEAM}/cdn-cgi/access/certs`) {
          return new Response(JSON.stringify({ keys: [publicJwk] }), { headers: { 'Content-Type': 'application/json' } });
        }
        return new Response('blocked in tests', { status: 599 });
      },
    },
  })],
  test: { include: ['test/**/*.test.js'], setupFiles: ['./test/setup.js'] },
}));
