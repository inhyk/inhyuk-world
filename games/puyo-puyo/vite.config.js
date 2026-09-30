import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)), base: './',
  build: { outDir: '../../public/play/puyo-puyo', emptyOutDir: true, chunkSizeWarningLimit: 2500 },
  server: { port: 5190, strictPort: false },
});
