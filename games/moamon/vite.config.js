import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
// 모아몬 탐험대: games/moamon → public/play/moamon (base './', /play/moamon 에서 iframe 으로 연다)
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  build: { outDir: '../../public/play/moamon', emptyOutDir: true, chunkSizeWarningLimit: 2500 },
  server: { host: '127.0.0.1', fs: { strict: false } },
});
