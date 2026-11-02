import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
// 사회적 게임: games/social-game → public/play/social-game (base './', iframe page at /play/social-game)
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  build: { outDir: '../../public/play/social-game', emptyOutDir: true, chunkSizeWarningLimit: 2500 },
  server: { host: '127.0.0.1' },
});
