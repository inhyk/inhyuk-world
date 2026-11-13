import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
// 뚱뚱해지기: games/fat-tycoon → public/play/fat-tycoon (base './', /play/fat-tycoon 에서 iframe 으로 연다)
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  build: { outDir: '../../public/play/fat-tycoon', emptyOutDir: true, chunkSizeWarningLimit: 2500 },
  server: { host: '127.0.0.1' },
});
