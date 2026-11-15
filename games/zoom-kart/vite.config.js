import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
// 씽씽 카트: games/zoom-kart → public/play/zoom-kart (base './', /play/zoom-kart 에서 iframe 으로 연다)
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  build: { outDir: '../../public/play/zoom-kart', emptyOutDir: true, chunkSizeWarningLimit: 2500 },
  server: { host: '127.0.0.1', fs: { strict: false } },
});
