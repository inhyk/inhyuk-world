import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
// 브릭버스: games/brickverse → public/play/brickverse (base './', /play/brickverse 에서 iframe 으로 연다)
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  build: { outDir: '../../public/play/brickverse', emptyOutDir: true, chunkSizeWarningLimit: 2500 },
  server: { host: '127.0.0.1' },
});
